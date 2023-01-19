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

var downloadingTask
var filesDownloaded
var filesToDownload
var filesActuallyDownloaded
var globalTopLevelHandle
var errorEcountered = false
var finishedIteratingDirectories = false
var pathsBeingChecked = []
var surveyName
var waitingForPermission = false

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
    } else if (evt.data.func=='permissionGiven') {
        permissionGiven()
    }
};

async function getBlob(url) {
    /** Returns the data from a specified url */
    console.log('Fetching blob')
    const blob = await fetch(url
    ).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.blob()
    }).catch( (error) => {
        errorEcountered = true
        return 'error'
    })
    return blob;
}

async function downloadFile(fileName,url,dirHandle) {
    /** Downloads the specified file to the diven directory handle */
    console.log('Downloading file')
    var blob = await getBlob(url)
    if (blob!='error') {
        var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        if (await verifyPermission(fileHandle)) {
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            filesActuallyDownloaded += 1
        }
    }
    filesDownloaded += 1
    updateDownloadProgress()
}

async function deleteFolder(dirHandle,parentHandle=null) {
    /** Recursive function for deleting an unwanted folder and all of its contents */
    console.log('Deleting folder')
    if (await verifyPermission(dirHandle)) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind=='directory') {
                await deleteFolder(entry)
            }
            await dirHandle.removeEntry(entry.name)
        }
    }
    if (parentHandle) {
        if (await verifyPermission(parentHandle)) {
            parentHandle.removeEntry(dirHandle.name)
        }
    }
}

async function checkFiles(files,dirHandle,expectedDirectories,path) {
    /** Compares the given files against the contents of the given directory and downloads or deletes accordingly*/

    console.log('Checking files')

    // Get list of files that already exist in folder
    updateDownloadProgress()
    var existingFiles = []
    var existingDirectories = []
    if (await verifyPermission(dirHandle)) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind=='file') {
                existingFiles.push(entry.name)
            } else if (entry.kind=='directory') {
                if (!expectedDirectories.includes(entry.name)) {
                    existingDirectories.push(entry)
                }
            }
        }
    }

    for (var index=0; index<files.length; index++) {
        var file = files[index]
        if (!existingFiles.includes(file.fileName)) {
            // If file doesn't already exist, download it
            downloadFile(file.fileName,file.URL,dirHandle)
        } else {
            // if it does exist and is supposed to be there, remove it from the list
            filesDownloaded += 1
            updateDownloadProgress()
            var fileIndex = existingFiles.indexOf(file.fileName)
            if (fileIndex > -1) {
                existingFiles.splice(fileIndex, 1)
            }
        }
    }

    // Delete the remaining files that shouldn't be there
    if (path.split('/').length!=1) {
        if (await verifyPermission(dirHandle)) {
            for (var index=0; index<existingFiles.length; index++) {
                dirHandle.removeEntry(existingFiles[index])
            }
            for (var index=0; index<existingDirectories.length; index++) {
                deleteFolder(existingDirectories[index],dirHandle)
            }
        }
    }
}

async function getDirectoryFiles(path,dirHandle,expectedDirectories) {
    /** Fetches a list of files for the given directory */

    console.log('Fetching files')
    
    pathsBeingChecked.push(path)

    files = await fetch('/get_directory_files', {
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
        errorEcountered = true
    })

    await checkFiles(files,dirHandle,expectedDirectories,path)

    var index = pathsBeingChecked.indexOf(path)
    if (index > -1) {
        pathsBeingChecked.splice(index, 1)
    }
    checkDownloadStatus()
}

async function iterateDirectories(directories,dirHandle,path='') {
    /** Recursive function for iterating through the given directories and downloading the necessary files */

    console.log('Iterating directory')

    var expectedDirectories = []
    for (item in directories) {
        expectedDirectories.push(item)
    }

    getDirectoryFiles(path,dirHandle,expectedDirectories)

    for (item in directories) {
        if (await verifyPermission(dirHandle)) {
            var newDirHandle = await dirHandle.getDirectoryHandle(item, { create: true })
            if (await verifyPermission(newDirHandle)) {
                var newDirectories = directories[item]
                if (path=='') {
                    var newPath = item
                } else {
                    var newPath = path + '/' + item
                }
                await iterateDirectories(newDirectories,newDirHandle,newPath)
            }
            expectedDirectories.push(item)
        }
    }
}

async function startDownload(selectedTask,taskName) {
    /** Begins the download */

    console.log('Started Download')

    downloadingTask = selectedTask
    finishedIteratingDirectories = false
    pathsBeingChecked = []
    errorEcountered = false
    filesDownloaded = 0
    filesToDownload = 0
    filesActuallyDownloaded = 0
    waitingForPermission = false

    postMessage({'func': 'initDisplayForDownload', 'args': null})

    // Fetch directory tree and start
    directories = await fetch('/get_download_directories', {
        method: 'post',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            surveyName: surveyName,
            taskName: taskName
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
            filesToDownload = data.fileCount
            return data.directories
        }
    }).catch( (error) => {
        errorEcountered = true
        startDownload()
    })
    await iterateDirectories(directories,globalTopLevelHandle)
    finishedIteratingDirectories = true
}

async function permissionGiven() {
    waitingForPermission = false
}

async function verifyPermission(fileHandle) {
    /** Checks for the necessary file/folder permissions and requests them if necessary */
    const timer = ms => new Promise(res => setTimeout(res, ms))
    waitingForPermission = true
    postMessage({'func': 'verifyPermission', 'args': [fileHandle]})
    while (waitingForPermission) {
        await timer(3000);
    }
    // console.log('Verifying Permission')
    // const options = {}
    // options.mode = 'readwrite'
    // if ((await fileHandle.queryPermission(options)) === 'granted') {
    //     console.log('Permission obtained')
    //     return true
    // }
    // if ((await fileHandle.requestPermission(options)) === 'granted') {
    //     console.log('Permission obtained')
    //     return true
    // }
    // console.log('Permission NOT obtained')
    // return false
    return true
}

function updateDownloadProgress() {
    /** Wrapper function for updateDownloadProgress so that the main js can update the page. */
    postMessage({'func': 'initDisplayForDownload', 'args': [downloadingTask,filesDownloaded,filesToDownload]})
}

function checkDownloadStatus() {
    /** Checks the status of the download. Wraps up if finished. */
    if ((filesDownloaded==filesToDownload)&&(filesToDownload!=0)&&finishedIteratingDirectories&&(pathsBeingChecked.length==0)) {
        if ((filesActuallyDownloaded==0)&&(!errorEcountered)) {
            // finished
            wrapUpDownload()
        } else {
            // check download
            checkingDownload = true
            startDownload()
        }
    }
}

function resetDownloadState() {
    /** Wrapper function for resetDownloadState so that the main js can update the page. */
    downloadingTask = null
    postMessage({'func': 'resetDownloadState', 'args': null})
}

async function wrapUpDownload() {
    /** Wraps up the download by letting the server know that the client download is finished */
    if (downloadingTask != null) {
        fetch('/download_complete', {
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
            }
        }).then(
            resetDownloadState()
        ).catch( (error) => {
            wrapUpDownload()
        })
    }
}