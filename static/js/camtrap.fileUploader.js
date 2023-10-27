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

const limitTT=pLimit(6)

surveyName = null
uploadID = null
uploadStart = null
retrying = false

uploadWorker.onmessage = function(evt){
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
    newProgInner.innerHTML = filesUploaded.toString() + '/' + filecount.toString() + " files uploaded."

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
        for (let i = 0; i < folders.length; i++){
            let option = document.createElement('option');
            option.text = folders[i];
            option.value = i;
            pathDisplay.add(option);
        }
    }
}

async function selectFiles(resuming=false) {
    /** Allows a user to select a folder, and then passes the handle to the web work to process */
    resetUploadStatusVariables()
    dirHandle = await window.showDirectoryPicker();
    uploadWorker.postMessage({'func': 'selectFiles', 'args': [dirHandle,resuming,surveyName,uploadID]});
}

async function uploadFiles() {
    /** Kicks off the upload by instructing the worker accordingly */
    if (modalNewSurvey.is(':visible')) {
        modalNewSurvey.modal('hide')
    } else {
        modalAddImages.modal('hide')
    }
    uploadWorker.postMessage({'func': 'uploadFiles', 'args': [surveyName,uploadID]});
}

var uppy = new Uppy.Uppy({
    /** New uppy instance that auto uploads as soon as it is handed a file */
    autoProceed: true
})

uppy.use(Uppy.AwsS3, {
    /** Uppy is set up to directly upload to S3 using a presigned URL from the application server */
    getUploadParameters (file) {
        return limitTT(()=> fetch('/fileHandler/get_presigned_url', {
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
        }))
    },
})

uppy.on('upload-success', (file, response) => {
    /** On successful upload, remove the file from memory and tell the worker to increment the counts and check if finished. */
    uppy.removeFile(file)
    uploadWorker.postMessage({'func': 'fileUploadedSuccessfully', 'args': null});
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
    uploadWorker.postMessage({'func': 'resetUploadStatusVariables', 'args': null});
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
        progBar.innerHTML = value.toString() + '/' + total.toString() + " files uploaded."
        document.getElementById('uploadStatus').innerHTML = 'Uploading...'
        document.getElementById('uploadTimeRemDiv').innerHTML = 'Time Remaining: ' + getTimeRemaining(value,total)
    } else if (uploading) {
        uploadWorker.postMessage({'func': 'buildUploadProgress', 'args': null});
    }
}