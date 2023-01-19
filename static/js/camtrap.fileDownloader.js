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
var checkingDownload = false

async function getBlob(url) {
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
    var blob = await getBlob(url)
    if (blob!='error') {
        var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        if (await verifyPermission(fileHandle, true)) {
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
    if (await verifyPermission(dirHandle, true)) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind=='directory') {
                await deleteFolder(entry)
            }
            await dirHandle.removeEntry(entry.name)
        }
    }
    if (parentHandle) {
        if (await verifyPermission(parentHandle, true)) {
            parentHandle.removeEntry(dirHandle.name)
        }
    }
}

async function checkFiles(files,dirHandle,expectedDirectories,path) {
    // Get list of files that already exist in folder
    // filesToDownload += files.length
    updateDownloadProgress()
    var existingFiles = []
    var existingDirectories = []
    if (await verifyPermission(dirHandle, true)) {
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
        if (await verifyPermission(dirHandle, true)) {
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
    var expectedDirectories = []
    for (item in directories) {
        expectedDirectories.push(item)
    }

    getDirectoryFiles(path,dirHandle,expectedDirectories)

    for (item in directories) {
        if (await verifyPermission(dirHandle, true)) {
            var newDirHandle = await dirHandle.getDirectoryHandle(item, { create: true })
            if (await verifyPermission(newDirHandle, true)) {
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

async function startDownload() {
    downloadingTask = selectedTask
    finishedIteratingDirectories = false
    pathsBeingChecked = []
    errorEcountered = false
    filesDownloaded = 0
    filesToDownload = 0
    filesActuallyDownloaded = 0

    if (!currentDownloadTasks.includes(taskName)) {
        currentDownloadTasks.push(taskName)
        currentDownloads.push(surveyName)
    }

    url = generate_url()
    updatePage(url)
    // updateDownloadProgress()
    modalResults.modal('hide')

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

async function initiateDownload() {
    // Select the download folder & get access
    globalTopLevelHandle = await window.showDirectoryPicker({
        writable: true //ask for write permission
    });
    checkingDownload = false
    startDownload()
}

async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

function updateDownloadProgress() {
    // console.log(filesDownloaded.toString()+', '+filesToDownload.toString())
    progBar = document.getElementById('progBar'+downloadingTask)
    progBar.setAttribute("aria-valuenow", filesDownloaded);
    progBar.setAttribute("aria-valuemax", filesToDownload);
    progBar.setAttribute("style", "width:"+(filesDownloaded/filesToDownload)*100+"%;transition:none");

    if (filesToDownload!=0) {
        if (checkingDownload) {
            progBar.innerHTML = 'Checking files... ' + filesDownloaded.toString() + '/' + filesToDownload.toString()
        } else {
            progBar.innerHTML = filesDownloaded.toString() + '/' + filesToDownload.toString() + ' files downloaded'
        }
    }
    
    checkDownloadStatus()
}

function checkDownloadStatus() {
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
    downloadingTask = null

    var index = currentDownloadTasks.indexOf(taskName)
    if (index > -1) {
        currentDownloadTasks.splice(index, 1)
    }

    var index = currentDownloads.indexOf(surveyName)
    if (index > -1) {
        currentDownloads.splice(index, 1)
    }

    updatePage(generate_url())
}

async function wrapUpDownload() {
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