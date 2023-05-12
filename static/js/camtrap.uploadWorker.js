// Copyright 2023

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

const limitTT=pLimit(6)

batchSize = 200
surveyName = null
filesUploaded = 0
filesActuallyUploaded = 0
filesQueued = 0
proposedQueue = []
uploadQueue = []
filecount=0
addingBatch = false
checkingFiles = false
folders = []

onmessage = function (evt) {
    /** Take instructions from main js */
    if (evt.data.func=='selectFiles') {
        surveyName = evt.data.args[2]
        selectFiles(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='uploadFiles') {
        surveyName = evt.data.args
        uploadFiles()
    } else if (evt.data.func=='checkFinishedUpload') {
        checkFinishedUpload()
    } else if (evt.data.func=='fileUploadedSuccessfully') {
        fileUploadedSuccessfully()
    } else if (evt.data.func=='resetUploadStatusVariables') {
        resetUploadStatusVariables()
    } else if (evt.data.func=='buildUploadProgress') {
        buildUploadProgress()
    }
};

async function checkFileBatch() {
    /** Pulls a batch of files from the proposed queue and checks if they already exist on the server. */
    if (proposedQueue.length>0) {
        checkingFiles = true
        let fileNames = []
        let items = []
        while ((fileNames.length<batchSize)&&(proposedQueue.length>0)) {
            let item = proposedQueue.pop()
            items.push(item)
            fileNames.push(surveyName + '/' + item[0] + '/' + item[1].name)
        }

        limitTT(()=> fetch('/fileHandler/check_upload_files', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filenames: fileNames
            })
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else {
                return response.json()
            }
        }).then((data) => {
            for (let i=0;i<items.length;i++) {
                let item = items[i]
                if (!data.includes(surveyName + '/' + item[0] + '/' + item[1].name)) {
                    uploadQueue.push(item)
                } else {
                    filesUploaded += 1
                    filesQueued += 1
                    updateUploadProgress(filesUploaded,filecount)
                }
            }
            checkFinishedUpload()
        })).catch( (error) => {
            proposedQueue.push(...items)
            setTimeout(function() { checkFileBatch(); }, 10000);
        })

        checkFileBatch()
    } else {
        checkingFiles = false
    }
    return true
}

async function addBatch() {
    /** Opens a batch of images from the checked queue and moves them to Uppy for upload. */
    if (((filesQueued-filesUploaded)<(0.5*batchSize))&&!addingBatch&&(uploadQueue.length!=0)) {
        addingBatch = true
        let filesToAdd = []
        while ((filesToAdd.length<batchSize)&&(uploadQueue.length>0)) {
            let item = uploadQueue.pop()
            let file = await item[1].getFile()
            let filename = surveyName + '/' + item[0] + '/' + item[1].name
            filesToAdd.push({
                name: filename,
                type: file.type,
                data: file.slice(0, file.size, file.type),
            })
            filesQueued += 1
            updateUploadProgress(filesUploaded,filecount)
        }
        // uppy.addFiles(filesToAdd)
        postMessage({'func': 'uppyAddFiles', 'args': filesToAdd})
        addingBatch = false
        checkFinishedUpload()
    }
    return true
}

async function listFolder(dirHandle,path){
    /** Iterates through a folder, adding the files to the upload queue */
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='directory'){
            await listFolder(entry,path+'/'+entry.name)
            folders.push(path+'/'+entry.name)
            updatePathDisplay()
        } else {
            filecount+=1
            proposedQueue.push([path,entry])
            if ((!checkingFiles)&&(proposedQueue.length>=batchSize)&&uploading) {
                checkFileBatch()
            }
        }
    }
    return filecount
}

function buildUploadProgress() {
    /** Wrapper function for buildUploadProgress so that the main js can update the page. */
    postMessage({'func': 'buildUploadProgress', 'args': [filesUploaded,filecount]})
}

function updatePathDisplay() {
    /** Wrapper function for updatePathDisplay so that the main js can update the page. */
    postMessage({'func': 'updatePathDisplay', 'args': [folders,filecount]})
}

function updateUploadProgress(value,total) {
    /** Wrapper function for updateUploadProgress so that the main js can update the page. */
    postMessage({'func': 'updateUploadProgress', 'args': [value,total]})
}

function fileUploadedSuccessfully() {
    /** Update counts etc. when Uppy successfully uploads a file. */
    filesUploaded += 1
    filesActuallyUploaded += 1
    updateUploadProgress(filesUploaded,filecount)
    checkFinishedUpload()
}

async function selectFiles(dirHandle,resuming=false) {
    /** Takes the users selected folder and iterates through it. */
    resetUploadStatusVariables()
    await listFolder(dirHandle,dirHandle.name)
    folders.push(dirHandle.name)
    if (resuming) {
        uploadFiles()
    } else {
        updatePathDisplay()
        postMessage({'func': 'checkTrapgroupCode', 'args': null})
    }
}

async function uploadFiles() {
    /** Kicks off the uplod process. */
    if (!checkingFiles) {
        checkFileBatch()
    }

    uploading = true
    buildUploadProgress()
    postMessage({'func': 'uploadStart', 'args': null})
    addBatch()
}

async function checkFinishedUpload() {
    /** Check if the upload is finished. Initiate an upload check, and then change survey status if all good. */
    if ((filesUploaded==filesQueued)&&(filesUploaded==filecount)&&(uploadQueue.length==0)&&(proposedQueue.length==0)) {
        //completely done

        if (filesActuallyUploaded==0) {
            // don't bother importing
            // newStatus = 'Ready'
            newStatus = 'Complete'
        } else {
            newStatus = 'Complete'
        }

        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/'+newStatus);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                postMessage({'func': 'updatePage', 'args': null})
            }
        }
        xhttp.send();

        resetUploadStatusVariables()
        console.log('Upload Complete')
    } else {
        if (!checkingFiles&&(proposedQueue.length!=0)) {
            checkFileBatch()
        }
        addBatch()
    }
}

function resetUploadStatusVariables() {
    /** Resets all the status variables */
    uploading = false
    filesUploaded = 0
    filesActuallyUploaded = 0
    filesQueued = 0
    proposedQueue = []
    uploadQueue = []
    filecount=0
    addingBatch = false
    checkingFiles = false
    folders = []
}