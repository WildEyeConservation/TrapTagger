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

batchSize = 200
surveyName = null
filesUploaded = 0
filesActuallyUploaded = 0
filesQueued = 0
uploadQueue = []
globalDirHandle = null
filecount=0
addingBatch = false
uploadPaused = false
uploadID = null
uploadCheck = false
uploadStart = null
retrying = false

async function addBatch(files=null,fileNames=null) {
    if (((filesQueued-filesUploaded)<(0.5*batchSize))&&!addingBatch&&(uploadQueue.length!=0)) {
        addingBatch = true
        
        if (!fileNames) {
            fileNames = []
            files = {}
            while ((fileNames.length<batchSize)&&(uploadQueue.length>0)) {
                item = uploadQueue.pop()
                let file = await item[1].getFile()
                filename = surveyName + '/' + item[0] + '/' + file.name
                fileNames.push(filename)
                files[filename] = file
            }
        }

        try {
            await fetch('/check_upload_files', {
                method: 'post',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filenames: fileNames
                })
            }).then((response) => {
                return response.json()
            }).then((data) => {
                filesToAdd = []
                for (filename in files) {
                    if (!data.includes(filename)) {
                        file = files[filename]
                        filesToAdd.push({
                            name: filename,
                            type: file.type,
                            data: file.slice(0, file.size, file.type),
                        })
                    } else {
                        filesUploaded += 1
                    }
                    filesQueued += 1
                    updateUploadProgress(filesUploaded,filecount)
                }
                uppy.addFiles(filesToAdd)
            })
        } catch(e) {
            setTimeout(function() { addBatch(files,fileNames); }, 10000);
        }
        
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
            updatePathDisplay(folders)
        } else {
            filecount+=1
            uploadQueue.push([path,entry])
        }
    }
    return filecount
}

function buildUploadProgress() {
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
    col11.appendChild(uploadStatus);

    var newProg = document.createElement('div');
    newProg.classList.add('progress');
    newProg.setAttribute('style','background-color: #3C4A59')

    var newProgInner = document.createElement('div');
    newProgInner.classList.add('progress-bar');
    newProgInner.classList.add('progress-bar-striped');
    newProgInner.classList.add('progress-bar-animated');
    newProgInner.classList.add('active');
    newProgInner.setAttribute("role", "progressbar");
    newProgInner.setAttribute("id", "uploadProgBar");
    newProgInner.setAttribute("aria-valuenow", "0");
    newProgInner.setAttribute("aria-valuemin", "0");
    newProgInner.setAttribute("aria-valuemax", "0");
    newProgInner.setAttribute("style", "width:0%");

    newProg.appendChild(newProgInner);
    col21.appendChild(newProg);

    timeRemDiv = document.createElement('div')
    timeRemDiv.setAttribute('id','uploadTimeRemDiv')
    timeRemDiv.setAttribute('style','font-size: 80%')
    col31.appendChild(timeRemDiv);

    if (filecount) {
        updateUploadProgress(filesUploaded,filecount)
    }
}

function initUpload() {
    /** Prepares for a file upload */
    uploadStart = Date.now()
    filesUploaded = 0
    filesActuallyUploaded = 0

    if (!surveyName) { 
        surveyName = document.getElementById('newSurveyName').value
    }

    buildUploadProgress()
    
    if (modalNewSurvey.is(':visible')) {
        modalNewSurvey.modal('hide')
    } else {
        modalAddImages.modal('hide')
    }
}

function updatePathDisplay(folders) {
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
    /** Allows a user to select a folder, which is then iterated through and uploaded */
    globalDirHandle = await window.showDirectoryPicker();
    folders = []
    filesQueued = 0
    uploadQueue = []
    await listFolder(globalDirHandle,globalDirHandle.name)
    folders.push(globalDirHandle.name)
    if (resuming) {
        uploading = true
        uploadFiles()
    } else {
        updatePathDisplay(folders)
        checkTrapgroupCode()
    }
}

async function uploadFiles() {
    /** Uploades the files currently in the queue */
    initUpload()
    addBatch()
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
    /** On successful upload, increment the counts, remove the file from memory, and then check if finished */
    // console.log(file.name+' uploaded successfully!')
    uppy.removeFile(file)
    filesUploaded += 1
    filesActuallyUploaded += 1
    updateUploadProgress(filesUploaded,filecount)
    checkFinishedUpload()
})

uppy.on('upload-error', function (file, error) {
    /** Retry upload on error */
    // console.log(file.name + 'failed to upload: ' + error);
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

async function checkFinishedUpload() {
    /** Check if the upload is finished. Initiate an upload check, and then change survey status if all good. */
    if ((filesUploaded==filesQueued)&&(filesUploaded==filecount)&&(uploadQueue.length==0)) {
        // if (filesActuallyUploaded==0) {
        //completely done
        // do something like just set status to ready if uploadCheck==false and filesActuallyUploaded==0 because nothing was uploaded
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/Ready');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                updatePage(current_page)
            }
        }
        xhttp.send();
        resetUploadStatusVariables()
        console.log('Upload Complete')
        // } else {
        //     //check upload - restart upload
        //     uploadCheck = true
        //     filesQueued = 0
        //     filecount = 0
        //     await listFolder(globalDirHandle,globalDirHandle.name)
        //     uploadFiles()
        // }
    } else {
        addBatch()
    }
}

function resetUploadStatusVariables() {
    /** Resets all the status variables */
    uploading = false
    surveyName = null
    filesUploaded = 0
    filesActuallyUploaded = 0
    filesQueued = 0
    uploadQueue = []
    globalDirHandle = null
    filecount=0
    addingBatch = false
    uploadPaused = false
    uploadID = null
    uploadCheck = false
    uploadStart = null
    retrying = false
}

function pauseUpload() {
    /** Pauses an upload by cancelling it. */
    uppy.cancelAll()
    resetUploadStatusVariables()
    updatePage(current_page)
}

function updateUploadProgress(value,total) {
    /** Updates the file upload progress bar */
    progBar = document.getElementById('uploadProgBar')
    if (progBar) {
        perc=(value/total)*100

        progBar.setAttribute('aria-valuenow',value)
        progBar.setAttribute('style',"width:"+perc+"%")
        progBar.innerHTML = value.toString() + '/' + total.toString() + " images uploaded."
    
        if (uploadCheck) {
            document.getElementById('uploadStatus').innerHTML = 'Checking...'
        } else if (uploadPaused) {
            document.getElementById('uploadStatus').innerHTML = 'Paused'
        } else {
            document.getElementById('uploadStatus').innerHTML = 'Uploading...'
        }
    
        timeElapsed = (Date.now() - uploadStart)/1000
        if ((value!=0) && (value<=total)) {
            rate = timeElapsed/value
            seconds = rate*(total-value)
            timeRemaining = new Date((seconds) * 1000).toISOString().substr(11, 8)
            document.getElementById('uploadTimeRemDiv').innerHTML = 'Time Remaining: ' + timeRemaining //+ ' (' + seconds.toString() + 's)'
        }
    } else if (uploading) {
        buildUploadProgress()
    }
}