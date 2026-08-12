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
importScripts('crypto-js.min.js')
var exports = {}
importScripts('piexif.js')

const limitTT=pLimit(6)

batchSize = 250
lambdaBatchSize = 250
uploadSurveyName = null
uploadID = null
filesUploaded = 0
filesActuallyUploaded = 0
filesQueued = 0
proposedQueue = []
uploadQueue = []
filecount=0
calibrationFileCount = 0
addingBatch = false
checkingFiles = false
folders = []
calibrationFolderPaths = []
calibrationFolderEmptyPaths = []
lambdaQueue = []
checkingLambda = false
largeFiles = 0
fileRenames = {}
calibrationCode = null
var rootDirHandle = null

onmessage = function (evt) {
    /** Take instructions from main js */
    if (evt.data.func=='selectFiles') {
        uploadSurveyName = evt.data.args[2]
        uploadID = evt.data.args[3]
        calibrationCode = evt.data.args[4] || null
        selectFiles(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='uploadFiles') {
        uploadSurveyName = evt.data.args[0]
        uploadID = evt.data.args[1]
        calibrationCode = evt.data.args[2]
        uploadFiles()
    } else if (evt.data.func=='checkFinishedUpload') {
        checkFinishedUpload()
    } else if (evt.data.func=='fileUploadedSuccessfully') {
        file_name = evt.data.args[0]
        fileUploadedSuccessfully(file_name)
    } else if (evt.data.func=='resetUploadStatusVariables') {
        resetUploadStatusVariables()
    } else if (evt.data.func=='buildUploadProgress') {
        buildUploadProgress()
    } else if (evt.data.func=='pauseUpload') {
        checkLambdaQueue(true)
        resetUploadStatusVariables()
    } else if (evt.data.func=='rescanCalibrationFolders') {
        calibrationCode = evt.data.args[1] || null
        rescanCalibrationFolders(evt.data.args[0])
    }
};

async function checkFileBatch() {
    /** Pulls a batch of files from the proposed queue and checks if they already exist on the server. */
    if (proposedQueue.length>0) {
        checkingFiles = true
        let files = []
        let items = []
        while ((files.length<batchSize)&&(proposedQueue.length>0)) {
            let item = proposedQueue.pop(0)
            var file = await item[1].getFile()
            let hash = ''
            var total_pixel = null
            if (file.type.startsWith('image/')) {
                try {
                    // Get Image resolution
                    let blob = file.slice(0, file.size);
                    let bitmap = await createImageBitmap(blob);
                    total_pixel = bitmap.width * bitmap.height;
                } catch (e) {
                    total_pixel = null;
                }
            }
            if (file != null && file.size > 500000000) { // 500MB
                largeFiles += 1
            } else if (total_pixel != null && total_pixel > 65000000) { // 65MP
                largeFiles += 1
            } else {
                let fileData = await new Promise((resolve, reject) => {
                    let reader = new FileReader();
                    reader.addEventListener("load", function() {
                        resolve(reader.result)
                    });
                    reader.addEventListener("error", reject)
                    reader.readAsBinaryString(file)
                });

                hash = getHash(fileData, item[1].name)
            }
            if (hash=='') {
                filesUploaded += 1
                filesQueued += 1
                updateUploadProgress(filesUploaded,filecount)
            } else {
                items.push(item)
                files.push({
                    name: uploadSurveyName + '/' + item[0] + '/' + item[1].name,
                    hash: hash
                })
            }
        }

        limitTT(()=> fetch('/fileHandler/check_upload_files', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: files,
                survey_id: uploadID
            })
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else if (response.status==278) {
                postMessage({'func': 'reloadPage', 'args': [largeFiles]})
            } else {
                return response.json()
            }
        }).then((data) => {
            uploaded = data[0]
            require_lambda = data[1]
            new_names = data[2]
            for (let i=0;i<items.length;i++) {
                let item = items[i]
                if (!uploaded.includes(uploadSurveyName + '/' + item[0] + '/' + item[1].name)) {
                    if ((uploadSurveyName + '/' + item[0] + '/' + item[1].name) in new_names) {
                        filepath = uploadSurveyName + '/' + item[0] + '/' 
                        fileRenames[filepath + item[1].name] = filepath + new_names[filepath + item[1].name]
                    }
                    uploadQueue.push(item)
                } else {
                    filesUploaded += 1
                    filesQueued += 1
                    updateUploadProgress(filesUploaded,filecount)
                }

                if (require_lambda.includes(uploadSurveyName + '/' + item[0] + '/' + item[1].name)) {
                    if ((uploadSurveyName + '/' + item[0] + '/' + item[1].name) in new_names) {
                        filepath = uploadSurveyName + '/' + item[0] + '/'
                        lambdaQueue.push(filepath + new_names[filepath + item[1].name])
                    } else {
                        lambdaQueue.push(uploadSurveyName + '/' + item[0] + '/' + item[1].name)
                    }
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
            let filename = uploadSurveyName + '/' + item[0] + '/' + item[1].name
            if (filename in fileRenames) {
                filename = fileRenames[filename]
                delete fileRenames[filename]
            }
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

function isCalUploadDistanceFilename(filename) {
    /** True if filename is a JPEG whose stem contains a positive distance number. */
    if (!/^[^.].*\.jpe?g$/i.test(filename)) return false
    var stem = filename.replace(/\.[^/.]+$/i, '')
    var match = stem.match(/\d+(?:\.\d+)?/)
    if (!match) return false
    var d = parseFloat(match[0])
    return !isNaN(d) && d > 0
}

function isCalibrationFolder(dirName, dirPath) {
    /** True if dirName contains the calibration keyword (case-insensitive). */

    if (!calibrationCode) {
        return false;
    }

    // Soft keyword match (substring, case-insensitive).
    // Previous exact / regex path against survey.calibration_code:
    // try {
    //     var nameRe = new RegExp('^' + calibrationCode + '$');
    //     return nameRe.test(dirName);
    // } catch (e) {
    //     return false;
    // }
    // return dirName === calibrationCode;
    var keyword = (calibrationCode || 'calibration').toLowerCase();
    return !!(dirName && dirName.toLowerCase().indexOf(keyword) !== -1);
}

async function listFolder(dirHandle,path){
    /** Iterates through a folder, adding the files to the upload queue */
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='directory'){
            var nextPath = path + '/' + entry.name
            if (isCalibrationFolder(entry.name, nextPath)) {
                await listCalibrationFolder(entry, nextPath, path)
            } else {
                await listFolder(entry, nextPath)
                updatePathDisplay()
            }
        } else {
            // only accept desired video and image file types and ignore hidden files
            if (/^[^.].*\.(jpe?g|avi|mp4|mov)$/.test(entry.name.toLowerCase())) {
                filecount+=1
                proposedQueue.push([path,entry])
                if (!folders.includes(path)) {
                    folders.push(path)
                }
                if ((!checkingFiles)&&(proposedQueue.length>=batchSize)&&uploading) {
                    checkFileBatch()
                }
            }
        }
    }
    return filecount
}

async function listCalibrationFolder(dirHandle, path, cameraPath) {
    // path = full path TO the cal folder, e.g. MySurvey/Site1/Cam1/extra
    if (!calibrationFolderPaths.includes(path)) {
        calibrationFolderPaths.push(path)
    }

    var validCount = 0
    for await (const entry of dirHandle.values()) {
        if (entry.kind == 'file') {
            if (/^[^.].*\.(jpe?g)$/i.test(entry.name)) {
                if (isCalUploadDistanceFilename(entry.name)) {
                    filecount += 1
                    calibrationFileCount += 1
                    proposedQueue.push([path, entry])
                    validCount += 1
                }
            }
        }
    }

    if (validCount === 0 && !calibrationFolderEmptyPaths.includes(path)) {
        calibrationFolderEmptyPaths.push(path)
    }
}

async function auditCalibrationFolderFiles(dirHandle, path) {
    var validCount = 0
    for await (const entry of dirHandle.values()) {
        if (entry.kind == 'file' && /^[^.].*\.(jpe?g)$/i.test(entry.name)) {
            if (isCalUploadDistanceFilename(entry.name)) {
                validCount += 1
            }
        }
    }
    if (validCount === 0 && !calibrationFolderEmptyPaths.includes(path)) {
        calibrationFolderEmptyPaths.push(path)
    }
}

async function walkForCalibrationFolders(dirHandle, path) {
    /** Finds cal folder paths and checks each contains valid distance-named JPEGs. */
    for await (const entry of dirHandle.values()) {
        if (entry.kind == 'directory') {
            var nextPath = path + '/' + entry.name
            if (isCalibrationFolder(entry.name, nextPath)) {
                if (!calibrationFolderPaths.includes(nextPath)) {
                    calibrationFolderPaths.push(nextPath)
                }
                await auditCalibrationFolderFiles(entry, nextPath)
            } else {
                await walkForCalibrationFolders(entry, nextPath)
            }
        }
    }
}

async function rescanCalibrationFolders(dirHandle) {
    calibrationFolderPaths = []
    calibrationFolderEmptyPaths = []
    if (dirHandle && calibrationCode) {
        await walkForCalibrationFolders(dirHandle, dirHandle.name)
    }
    updateCalibrationFolders()
}

function updateCalibrationFolders() {
    postMessage({
        'func': 'updateCalibrationFolders',
        'args': [calibrationFolderPaths, calibrationFolderEmptyPaths]
    })
}

function buildUploadProgress() {
    /** Wrapper function for buildUploadProgress so that the main js can update the page. */
    postMessage({'func': 'buildUploadProgress', 'args': [filesUploaded, filecount, calibrationFileCount]})
}

function updatePathDisplay() {
    /** Wrapper function for updatePathDisplay so that the main js can update the page. */
    postMessage({
        'func': 'updatePathDisplay',
        'args': [folders, filecount, calibrationFolderPaths, calibrationFolderEmptyPaths, calibrationFileCount]
    })
}

function updateUploadProgress(value,total) {
    /** Wrapper function for updateUploadProgress so that the main js can update the page. */
    postMessage({'func': 'updateUploadProgress', 'args': [value, total, calibrationFileCount]})
}

function fileUploadedSuccessfully(filename) {
    /** Update counts etc. when Uppy successfully uploads a file. */
    filesUploaded += 1
    filesActuallyUploaded += 1
    lambdaQueue.push(filename)
    updateUploadProgress(filesUploaded,filecount)
    checkFinishedUpload()
}

async function selectFiles(dirHandle,resuming=false) {
    /** Takes the users selected folder and iterates through it. */
    rootDirHandle = dirHandle
    resetScanResults()
    calibrationCode = calibrationCode || null
    await listFolder(dirHandle,dirHandle.name)
    if (resuming) {
        uploadFiles()
    } else {
        updatePathDisplay()
        postMessage({'func': 'checkTrapgroupCode', 'args': null})
    }
}

async function uploadFiles() {
    /** Kicks off the uplod process. Rescans with final calibrationCode if needed. */
    if (rootDirHandle) {
        resetScanResults()
        calibrationCode = calibrationCode || null
        await listFolder(rootDirHandle, rootDirHandle.name)
        updatePathDisplay()

        if (calibrationCode && calibrationFolderEmptyPaths.length > 0) {
            postMessage({
                'func': 'calibrationUploadBlocked',
                'args': [calibrationFolderEmptyPaths]
            })
            return
        }
    }

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
    if ((filesUploaded==filesQueued)&&(filesUploaded==filecount)&&(uploadQueue.length==0)&&(proposedQueue.length==0)&&(lambdaQueue.length==0)) {
        //completely done

        if (filesActuallyUploaded==0) {
            // don't bother importing
            // newStatus = 'Ready'
            newStatus = 'Import Queued'
        } else {
            newStatus = 'Import Queued'
        }

        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/updateSurveyStatus/'+uploadID+'/'+newStatus);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                postMessage({'func': 'updatePage', 'args': null})
            }
        }
        xhttp.send();

        console.log('Upload Complete')
        postMessage({'func': 'reloadPage', 'args': [largeFiles]})
        resetUploadStatusVariables()

    } else {
        if (!checkingFiles&&(proposedQueue.length!=0)) {
            checkFileBatch()
        }
        addBatch()
        if (!checkingLambda&&lambdaQueue.length>0) {
            checkLambdaQueue()
        }
    }
}

function resetScanResults() {
    uploading = false
    filesUploaded = 0
    filesActuallyUploaded = 0
    filesQueued = 0
    proposedQueue = []
    uploadQueue = []
    filecount = 0
    calibrationFileCount = 0
    addingBatch = false
    checkingFiles = false
    folders = []
    calibrationFolderPaths = []
    calibrationFolderEmptyPaths = []
    lambdaQueue = []
    checkingLambda = false
    largeFiles = 0
    fileRenames = {}
}

function resetUploadStatusVariables() {
    resetScanResults()
    calibrationCode = null
    rootDirHandle = null
}

function getHash(jpegData, filename) {
    /** Returns the hash of the EXIF-less image */
    try {
        if (['mp4', 'avi', 'mov'].some(element => filename.toLowerCase().includes(element))){
            if (jpegData.length>500000000) { // 500MB
                hash = ''
                largeFiles += 1
            }
            else {
                hash = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(jpegData)).toString()   
            }
            return hash
        }
        else{
            if (jpegData.length>10000000) { // 10MB
                largeFiles += 1
                return ''
            }
            else {
                return CryptoJS.MD5(CryptoJS.enc.Latin1.parse(exports.piexif.insert(exports.piexif.dump({'0th':{},'1st':{},'Exif':{},'GPS':{},'Interop':{},'thumbnail':null}), jpegData))).toString()
            }
        }
    }
    catch (err) {
        return ''
    }
}

async function checkLambdaQueue(pause=false) {
    /** Check if the lambda queue is empty. If not, send the next batch to the lambda function. */
    var files = []
    if (lambdaQueue.length>= lambdaBatchSize) {
        checkingLambda = true
        while (files.length<lambdaBatchSize) {
            let file = lambdaQueue.pop(0)
            fileSuffix = file.substring(file.lastIndexOf('.') + 1)
            let fileType;
            if (/jpe?g$/i.test(fileSuffix)) {
                fileType = 'image';
            } else if (/(avi|mp4|mov)$/i.test(fileSuffix)) {
                fileType = 'video';
            } else {
                fileType = 'other';
            }
            files.push({
                filename: file,
                type: fileType
            })
        }
    }
    else if ((lambdaQueue.length>0)&&((filesUploaded==filesQueued)&&(filesUploaded==filecount)&&(uploadQueue.length==0)&&(proposedQueue.length==0)||pause)){
        checkingLambda = true
        while (lambdaQueue.length>0) {
            let file = lambdaQueue.pop(0)
            fileSuffix = file.substring(file.lastIndexOf('.') + 1)
            let fileType;
            if (/jpe?g$/i.test(fileSuffix)) {
                fileType = 'image';
            } else if (/(avi|mp4|mov)$/i.test(fileSuffix)) {
                fileType = 'video';
            } else {
                fileType = 'other';
            }
            files.push({
                filename: file,
                type: fileType
            })
        }
    }

    if (files.length>0) {

        limitTT(()=> fetch('/fileHandler/invoke_lambda', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: files,
                survey_id: uploadID
            })
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else if (response.status==278) {
                postMessage({'func': 'reloadPage', 'args': [largeFiles]})
            }
            checkingLambda = false
            if (!pause){
                if (lambdaQueue.length==0){
                    checkFinishedUpload()
                }
                else{
                    checkLambdaQueue()
                }
            }
        }).catch( (error) => {
            if (!pause){
                lambdaQueue.push(...files)
                setTimeout(function() { checkLambdaQueue(pause); }, 10000);
            }
        }))
    }
    else {
        checkingLambda = false
    }

    return true
}