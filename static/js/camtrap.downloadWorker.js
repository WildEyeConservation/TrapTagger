// Copyright 2022

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

importScripts('yoctoQueue.js')
importScripts('pLimit.js')
const limitAWS=pLimit(6)
const limitTT=pLimit(6)

var downloadingTask
var filesDownloaded
var filesToDownload
var totalFilesToDownload
var filesActuallyDownloaded
var globalTopLevelHandle
var errorEcountered = false
var finishedIteratingDirectories = false
var pathsBeingChecked = []
var surveyName
var downloadingTaskName
var filesSucceeded

onmessage = function (evt) {
    /** Take instructions from main js */
    if (evt.data.func=='startDownload') {
        globalTopLevelHandle = evt.data.args[0]
        surveyName = evt.data.args[2]
        startDownload(evt.data.args[1],evt.data.args[3])
    } else if (evt.data.func=='checkDownloadStatus') {
        checkDownloadStatus()
    } else if (evt.data.func=='updateDownloadProgress') {
        updateDownloadProgress()
    }
};

async function getBlob(url) {
    /** Returns the data from a specified url */
    const blob = await limitAWS(()=> fetch(url
    ).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.blob()
    }).catch( (error) => {
        errorEcountered = true
        return 'error'
    }))
    return blob;
}

async function downloadFile(fileName,url,dirHandle,count=0) {
    /** Downloads the specified file to the diven directory handle */
    var blob = await getBlob(url)
    if (blob!='error') {
        var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        filesActuallyDownloaded += 1
        filesSucceeded += 1
        filesDownloaded += 1
    } else if (count>=3) {
        filesDownloaded += 1
    } else {
        setTimeout(function() { downloadFile(fileName,url,dirHandle,count+1); }, 5000);
    }
    updateDownloadProgress()
}

async function deleteFolder(dirHandle,parentHandle=null) {
    /** Recursive function for deleting an unwanted folder and all of its contents */
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='directory') {
            await deleteFolder(entry)
        }
        await dirHandle.removeEntry(entry.name)
    }
    if (parentHandle) {
        parentHandle.removeEntry(dirHandle.name)
    }
}

async function checkFiles(files,dirHandle,expectedDirectories,path) {
    /** Compares the given files against the contents of the given directory and downloads or deletes accordingly*/

    // Get list of files that already exist in folder
    updateDownloadProgress()
    var existingFiles = []
    var existingDirectories = []
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='file') {
            existingFiles.push(entry.name)
        } else if (entry.kind=='directory') {
            if (!expectedDirectories.includes(entry.name)) {
                existingDirectories.push(entry)
            }
        }
    }

    for (let i=0; i<files.length; i++) {
        var file = files[i]
        if (!existingFiles.includes(file.fileName)) {
            // If file doesn't already exist, download it
            downloadFile(file.fileName,file.URL,dirHandle)
        } else {
            // if it does exist and is supposed to be there, remove it from the list
            filesDownloaded += 1
            filesSucceeded += 1
            updateDownloadProgress()
            var fileIndex = existingFiles.indexOf(file.fileName)
            if (fileIndex > -1) {
                existingFiles.splice(fileIndex, 1)
            }
        }
    }

    // Delete the remaining files that shouldn't be there
    if (path.split('/').length!=1) {
        for (let i=0; i<existingFiles.length; i++) {
            dirHandle.removeEntry(existingFiles[i])
        }
        for (let i=0; i<existingDirectories.length; i++) {
            deleteFolder(existingDirectories[i],dirHandle)
        }
    }
}

async function getDirectoryFiles(path,dirHandle,expectedDirectories,count=0) {
    /** Fetches a list of files for the given directory */
    
    //need this check to make sure it doesn't download other annotation sets, or overwrite them locally
    if (path != surveyName) {
        if (!pathsBeingChecked.includes(path)) {
            pathsBeingChecked.push(path)
        }
    
        files = await limitTT(()=> fetch('/get_directory_files', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                surveyName: surveyName,
                path: path
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            }
            return response.json()
        }).then((files) => {
            if (files=='error') {
                location.reload()
            } else {
                return files
            }
        }).catch( (error) => {
            if (count>=3) {
                errorEcountered = true
                var index = pathsBeingChecked.indexOf(path)
                if (index > -1) {
                    pathsBeingChecked.splice(index, 1)
                }
            } else {
                setTimeout(function() { getDirectoryFiles(path,dirHandle,expectedDirectories,count+1); }, 5000);
            }
        }))
    
        if (files) {
            filesToDownload += files.length
            await checkFiles(files,dirHandle,expectedDirectories,path)
            var index = pathsBeingChecked.indexOf(path)
            if (index > -1) {
                pathsBeingChecked.splice(index, 1)
            }
        }
    
        checkDownloadStatus()
    }
}

async function iterateDirectories(directories,dirHandle,path='') {
    /** Recursive function for iterating through the given directories and downloading the necessary files */

    var expectedDirectories = []
    for (let item in directories) {
        expectedDirectories.push(item)
    }

    getDirectoryFiles(path,dirHandle,expectedDirectories)

    for (let item in directories) {
        var newDirHandle = await dirHandle.getDirectoryHandle(item, { create: true })
        var newDirectories = directories[item]
        if (path=='') {
            var newPath = item
        } else {
            var newPath = path + '/' + item
        }
        await iterateDirectories(newDirectories,newDirHandle,newPath)
        expectedDirectories.push(item)
    }
}

async function fetchDirectories(path) {
    /** Recursive function that fetches the directories to be downloaded from. */

    directories = await limitTT(()=> fetch('/get_download_directories', {
        method: 'post',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            surveyName: surveyName,
            taskName: downloadingTaskName,
            path: path
        }),
    }).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.json()
    }).then((data) => {
        if (data=='error') {
            location.reload()
        } else {
            totalFilesToDownload += data.fileCount
            updateDownloadProgress()
            return data.directories
        }
    }).catch( (error) => {
        errorEcountered = true
        // setTimeout(function() { startDownload(downloadingTask,downloadingTaskName); }, 5000);
    }))

    if (directories) {
        for (item in directories) {
            directories[item] = await fetchDirectories(path+'/'+item)
        }
    } else {
        directories = {}
    }

    return directories
}

async function startDownload(selectedTask,taskName) {
    /** Begins the download */

    console.log('Started Download')

    downloadingTask = selectedTask
    downloadingTaskName = taskName
    finishedIteratingDirectories = false
    pathsBeingChecked = []
    errorEcountered = false
    filesDownloaded = 0
    filesToDownload = 0
    totalFilesToDownload = 0
    filesActuallyDownloaded = 0
    filesSucceeded = 0

    postMessage({'func': 'initDisplayForDownload', 'args': [downloadingTask]})

    // Fetch directory tree and start
    directories = {surveyName: {taskName: await fetchDirectories('')}}

    if (directories) {
        await iterateDirectories(directories,globalTopLevelHandle)
        finishedIteratingDirectories = true
    }
}

function updateDownloadProgress() {
    /** Wrapper function for updateDownloadProgress so that the main js can update the page. */
    postMessage({'func': 'updateDownloadProgress', 'args': [downloadingTask,filesSucceeded,totalFilesToDownload]})
}

function checkDownloadStatus() {
    /** Checks the status of the download. Wraps up if finished. */
    if ((filesDownloaded==filesToDownload)&&(totalFilesToDownload!=0)&&finishedIteratingDirectories&&(pathsBeingChecked.length==0)) {
        if ((filesActuallyDownloaded==0)&&(!errorEcountered)) {
            // finished
            wrapUpDownload()
        } else {
            // check download
            postMessage({'func': 'checkingDownload', 'args': [true]})
            startDownload(downloadingTask,downloadingTaskName)
        }
    }
}

function resetDownloadState() {
    /** Wrapper function for resetDownloadState so that the main js can update the page. */
    downloadingTask = null
    postMessage({'func': 'resetDownloadState', 'args': [surveyName,downloadingTaskName]})
}

async function wrapUpDownload() {
    /** Wraps up the download by letting the server know that the client download is finished */
    if (downloadingTask != null) {
        await limitTT(()=> fetch('/download_complete', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                task_id: downloadingTask,
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else {
                resetDownloadState()
            }
        }).catch( (error) => {
            setTimeout(function() { wrapUpDownload(); }, 5000);
        }))
    }
}