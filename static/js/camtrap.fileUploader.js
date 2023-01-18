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

surveyName = null
uploadID = null
uploadStart = null
retrying = false

worker.onmessage = function(evt){
    /** Take instructions from the web worker */
    if (evt.data.func=='updateUploadProgress') {
        updateUploadProgress(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='uppyAddFiles') {
        uppy.addFiles(evt.data.args)
    } else if (evt.data.func=='updatePathDisplay') {
        updatePathDisplay(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='checkTrapgroupCode') {
        checkTrapgroupCode()
    } else if (evt.data.func=='buildUploadProgress') {
        buildUploadProgress(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='updatePage') {
        updatePage(current_page)
    } else if (evt.data.func=='uploadStart') {
        uploading = true
        uploadStart = Date.now()
    }
};

function buildUploadProgress(filesUploaded,filecount) {
    /** Builds the upload progress bar */

    deleteSurveyBtn = document.getElementById('deleteSurveyBtn'+uploadID.toString())
    deleteSurveyBtn.disabled = true

    taskDiv = document.getElementById('taskDiv-'+surveyName)
    while(taskDiv.firstChild){
        taskDiv.removeChild(taskDiv.firstChild);
    }
    
    row = document.createElement('div')
    row.classList.add('row')
    taskDiv.appendChild(row)

    row2 = document.createElement('div')
    row2.setAttribute('class','row center')
    row2.setAttribute('style','margin-right:10px')
    taskDiv.appendChild(row2)

    row3 = document.createElement('div')
    row3.classList.add('row')
    taskDiv.appendChild(row3)

    col11 = document.createElement('div')
    col11.classList.add('col-lg-10')
    row.appendChild(col11)

    col21 = document.createElement('div')
    col21.classList.add('col-lg-10')
    row2.appendChild(col21)

    col31 = document.createElement('div')
    col31.classList.add('col-lg-10')
    row3.appendChild(col31)

    col22 = document.createElement('div')
    col22.classList.add('col-lg-2')
    row2.appendChild(col22)

    btnPause = document.createElement('button')
    btnPause.setAttribute("class","btn btn-primary btn-sm btn-block")
    btnPause.setAttribute('onclick','pauseUpload()')
    btnPause.setAttribute('id','btnPause')
    btnPause.innerHTML = 'Pause'
    col22.appendChild(btnPause)

    uploadStatus = document.createElement('div')
    uploadStatus.setAttribute('id','uploadStatus')
    uploadStatus.innerHTML = 'Uploading...'
    col11.appendChild(uploadStatus);

    var newProg = document.createElement('div');
    newProg.classList.add('progress');
    newProg.setAttribute('style','background-color: #3C4A59')

    perc=(filesUploaded/filecount)*100

    var newProgInner = document.createElement('div');
    newProgInner.classList.add('progress-bar');
    newProgInner.classList.add('progress-bar-striped');
    newProgInner.classList.add('progress-bar-animated');
    newProgInner.classList.add('active');
    newProgInner.setAttribute("role", "progressbar");
    newProgInner.setAttribute("id", "uploadProgBar");
    newProgInner.setAttribute("aria-valuenow", filesUploaded);
    newProgInner.setAttribute("aria-valuemin", "0");
    newProgInner.setAttribute("aria-valuemax", filecount);
    newProgInner.setAttribute("style","width:"+perc+"%");
    newProgInner.innerHTML = filesUploaded.toString() + '/' + filecount.toString() + " images uploaded."

    newProg.appendChild(newProgInner);
    col21.appendChild(newProg);

    timeRemDiv = document.createElement('div')
    timeRemDiv.setAttribute('id','uploadTimeRemDiv')
    timeRemDiv.setAttribute('style','font-size: 80%')
    timeRemDiv.innerHTML = 'Time Remaining: ' + getTimeRemaining(filesUploaded,filecount)
    col31.appendChild(timeRemDiv);
}

function updatePathDisplay(folders,filecount) {
    /** Updates the folders found display */
    pathDisplay = document.getElementById('pathDisplay')

    if (pathDisplay) {
        while(pathDisplay.firstChild){
            pathDisplay.removeChild(pathDisplay.firstChild);
        }

        // add file count
        let fileCountOption = document.createElement('option');
        fileCountOption.text = 'Files detected: '+filecount.toString();
        fileCountOption.value = 0;
        pathDisplay.add(fileCountOption);

        // add folder heading
        let folderDisplay = document.createElement('option');
        folderDisplay.text = 'Paths found:';
        folderDisplay.value = 1;
        pathDisplay.add(folderDisplay)

        //add paths
        for (let idx = 2; idx < folders.length; idx++){
            let option = document.createElement('option');
            option.text = folders[idx];
            option.value = idx;
            pathDisplay.add(option);
        }
    }
}

async function selectFiles(resuming=false) {
    /** Allows a user to select a folder, and then passes the handle to the web work to process */
    resetUploadStatusVariables()
    dirHandle = await window.showDirectoryPicker();
    worker.postMessage({'func': 'selectFiles', 'args': [dirHandle,resuming,surveyName]});
}

async function uploadFiles() {
    /** Kicks off the upload by instructing the worker accordingly */
    if (modalNewSurvey.is(':visible')) {
        modalNewSurvey.modal('hide')
    } else {
        modalAddImages.modal('hide')
    }
    worker.postMessage({'func': 'uploadFiles', 'args': surveyName});
}

var uppy = new Uppy.Uppy({
    /** New uppy instance that auto uploads as soon as it is handed a file */
    autoProceed: true
})

uppy.use(Uppy.AwsS3, {
    /** Uppy is set up to directly upload to S3 using a presigned URL from the application server */
    getUploadParameters (file) {
        return fetch('/get_presigned_url', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
            }),
        }).then((response) => {
            return response.text()
        }).then((url) => {
            return {
                method: 'PUT',
                url: url,
                fields: {},
                headers: {
                    'Content-Type': file.type,
                }
            }
        })
    },
})

uppy.on('upload-success', (file, response) => {
    /** On successful upload, remove the file from memory and tell the worker to increment the counts and check if finished. */
    uppy.removeFile(file)
    worker.postMessage({'func': 'fileUploadedSuccessfully', 'args': null});
})

uppy.on('upload-error', function (file, error) {
    /** Retry upload on error */
    if (!retrying) {
        retrying = true
        setTimeout(function() { retryUpload(); }, 10000);
    }
});

function retryUpload() {
    /** retries the failed uploads */
    retrying = false
    uppy.retryAll()
}

function resetUploadStatusVariables() {
    /** Resets all the status variables */
    uploading = false
    uploadStart = null
    retrying = false
}

function pauseUpload() {
    /** Pauses an upload by cancelling it. */
    uppy.cancelAll()
    resetUploadStatusVariables()
    worker.postMessage({'func': 'resetUploadStatusVariables', 'args': null});
    updatePage(current_page)
}

function getTimeRemaining(value,total) {
    /** Returns the stringified time remaining for the upload */
    timeElapsed = (Date.now() - uploadStart)/1000
    if ((value!=0) && (value<=total)) {
        rate = timeElapsed/value
        seconds = rate*(total-value)
        timeRemaining = new Date((seconds) * 1000).toISOString().substr(11, 8)
    } else {
        timeRemaining = ''
    }
    return timeRemaining
}

function updateUploadProgress(value,total) {
    /** Updates the file upload progress bar */
    progBar = document.getElementById('uploadProgBar')
    if (progBar) {
        perc=(value/total)*100
        progBar.setAttribute('aria-valuenow',value)
        progBar.setAttribute('style',"width:"+perc+"%")
        progBar.innerHTML = value.toString() + '/' + total.toString() + " images uploaded."
        document.getElementById('uploadStatus').innerHTML = 'Uploading...'
        document.getElementById('uploadTimeRemDiv').innerHTML = 'Time Remaining: ' + getTimeRemaining(value,total)
    } else if (uploading) {
        worker.postMessage({'func': 'buildUploadProgress', 'args': null});
    }
}

// function downloadFile(fileName) {
//     return fetch('/get_presigned_download_url', {
//         method: 'post',
//         headers: {
//             accept: 'application/json',
//             'content-type': 'application/json',
//         },
//         body: JSON.stringify({
//             filename: fileName
//         }),
//     }).then((response) => {
//         return response.text()
//     }).then((url) => {
//         return fetch(url)
//     }).then((response) => {
//         return response.blob()
//     }).then(blob => {
//         var url = window.URL.createObjectURL(blob);
//         var a = document.createElement('a');
//         a.style.display = 'none';
//         a.href = url;
//         a.download = fileName;
//         document.body.appendChild(a);
//         a.click();
//         window.URL.revokeObjectURL(url);
//     })
// }


// function directDownload(url) {
//     return fetch(url)
//     .then((response) => {
//         return response.blob()
//     }).then(blob => {
//         var url = window.URL.createObjectURL(blob);
//         var a = document.createElement('a');
//         a.style.display = 'none';
//         a.href = url;
//         a.download = fileName;
//         document.body.appendChild(a);
//         a.click();
//         window.URL.revokeObjectURL(url);
//     })
// }





var downloadingTask
var filesDownloaded
var filesToDownload
var filesActuallyDownloaded
var globalTopLevelHandle
var errorEcountered = false
var finishedIteratingDirectories = false
var pathsBeingChecked = []

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
    filesToDownload += files.length
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
    currentDownloadTasks.push(taskName)
    currentDownloads.push(surveyName)

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
    }).then((directories) => {
        if (directories=='error') {
            location.reload()
        } else {
            return directories
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
    newProgInner.innerHTML = filesToDownload.toString() + '/' + filesDownloaded.toString() + ' files downloaded'
    checkDownloadStatus()
}

function checkDownloadStatus() {
    if ((filesDownloaded==filesToDownload)&&(filesToDownload!=0)&&finishedIteratingDirectories&&(pathsBeingChecked.length==0)) {
        if ((filesActuallyDownloaded==0)&&(!errorEcountered)) {
            // finished
            wrapUpDownload()
        } else {
            // check download
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

    updatePage()
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