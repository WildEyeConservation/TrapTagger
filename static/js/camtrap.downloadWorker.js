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

const limitAWS=pLimit(6)
const limitTT=pLimit(6)
const limitFiles=pLimit(6)

var max_processing = 50
var globalTopLevelHandle
var errorEcountered = false
var surveyName
var downloadingTaskName
var wrappingUp
var downloadingTask
var filesDownloaded = 0
var filesToDownload = 0
var filesActuallyDownloaded
var finishedIterating = false
var species
var species_sorted
var individual_sorted
var flat_structure
var include_empties
var local_files_processing
var downloading = false
var localQueue = []
var checking_local_folder
var consuming
var init
var initCount = 0
var delete_items
var count_initialised = false
var downloading_count = 0
var include_video 
var include_video_init
var include_frames

onmessage = function (evt) {
    /** Take instructions from main js */
    if (evt.data.func=='startDownload') {
        init = true
        globalTopLevelHandle = evt.data.args[0]
        surveyName = evt.data.args[2]
        species = evt.data.args[4]
        species_sorted = evt.data.args[5]
        individual_sorted = evt.data.args[6]
        flat_structure = evt.data.args[7]
        include_empties = evt.data.args[8]
        delete_items = evt.data.args[9]
        include_video = evt.data.args[10]
        include_video_init = evt.data.args[10]
        include_frames = evt.data.args[11]
        startDownload(evt.data.args[1],evt.data.args[3])
    } else if (evt.data.func=='checkDownloadStatus') {
        checkDownloadStatus()
    } else if (evt.data.func=='updateDownloadProgress') {
        updateDownloadProgress()
    } else if (evt.data.func=='wrapUpDownload') {
        wrapUpDownload(evt.data.args[0])
    }
};

async function startDownload(selectedTask,taskName,count=0) {
    /** Begins the download */

    console.log('Started Download')

    downloadingTask = selectedTask
    downloadingTaskName = taskName
    consuming = false
    downloading = false
    errorEcountered = false
    filesActuallyDownloaded = 0
    filesDownloaded = 0
    local_files_processing = 0
    finishedIterating = false
    wrappingUp = false
    localQueue = []
    checking_local_folder = 0
    initCount = 0
    downloading_count=0
    filesToDownload = 0
    count_initialised = false

    postMessage({'func': 'initDisplayForDownload', 'args': [downloadingTask]})
    updateDownloadProgress()

    var reply = await limitTT(()=> fetch('/fileHandler/set_download_status', {
        method: 'post',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            species: species,
            selectedTask: downloadingTask,
            include_empties: include_empties,
            include_video: include_video_init,
            include_frames: include_frames
        }),
    })).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        } else {
            return response.json()
        }
    }).catch( (error) => {
        if (count<=5) {
            setTimeout(function() { startDownload(selectedTask,taskName,count+1); }, 1000*(5**count));
        }
    })

    waitUntilDownloadReady()

    if (reply=='success') {
        await checkLocalFiles(globalTopLevelHandle,globalTopLevelHandle.name)
        init = false
    }
}

async function waitUntilDownloadReady(count=0) {
    /** Checks to see if the download is ready to commence */
    if (downloadingTask) {
        initCount += 1
        var response = await limitTT(()=> fetch('/fileHandler/check_download_initialised', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                selectedTask: downloadingTask
            }),
        })).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else {
                return response.json()
            }
        }).catch( (error) => {
            if (count<=5) {
                setTimeout(function() { waitUntilDownloadReady(count+1); }, 1000*(5**count));
            }
        })

        if (response) {
            if ('filesToDownload' in response) {
                filesToDownload = response.filesToDownload
                count_initialised = true
            }
    
            if (response.status=='not ready') {
                setTimeout(function() { waitUntilDownloadReady(); }, 2000);
            } else {
                if (init) {
                    await checkLocalFiles(globalTopLevelHandle,globalTopLevelHandle.name)
                    init = false
                }
            }
        
            updateDownloadProgress()
        }
    }
}

async function checkLocalFiles(dirHandle,path){
    /** Cycles through the local folders and deals with the files it finds */
    checking_local_folder += 1
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='directory'){
            checkLocalFiles(entry,path+'/'+entry.name)
        } else {
            localQueue.push([entry,dirHandle])
        }
    }
    checking_local_folder -= 1
    updateDownloadProgress()
}

function updateDownloadProgress() {
    /** Updates the download progress on the page and also kicks of queue consumption or image downloading as needed. */
    var totalCount = filesToDownload
    if (!count_initialised) {
        totalCount = filesDownloaded
    }
    postMessage({'func': 'updateDownloadProgress', 'args': [downloadingTask,filesDownloaded,totalCount,count_initialised]})
    if (!downloading) {
        consumeQueue()
        if ((local_files_processing==0) && (!init) && (checking_local_folder==0) && (localQueue.length==0)) {
            downloading = true
            console.log('Local processing finished')
            fetchRemainingImages()
        }
    }
}

async function consumeQueue() {
    /** Consumes from the local queue, limiting the number of open files to the max_processing variable */
    if ((!consuming) && (local_files_processing<max_processing)&&(localQueue.length>0)) {
        consuming = true
        for (let i=0;i<(max_processing-local_files_processing);i++) {
            if (localQueue.length==0) {
                break
            } else {
                var data = localQueue.pop()
                handleLocalFile(data[0],data[1])
            }
        }
        consuming = false
    }
}

async function handleLocalFile(entry,dirHandle) {
    /** Opens a local file and calculates its EXIF-less hash */
    local_files_processing += 1
    if (['jpeg', 'jpg', 'mp4', 'avi'].some(element => entry.name.toLowerCase().includes(element))) {
        var file = await entry.getFile()
        var reader = new FileReader();
        reader.addEventListener("load", function(wrapReader,wrapDirHandle,wrapFileName) {
            return async function() {
                var jpegData = wrapReader.result
                try {
                    var hash = getHash(jpegData,wrapFileName)
                    getLocalImageInfo(hash,downloadingTask,jpegData,wrapDirHandle,wrapFileName)
                } catch {
                    // delete malformed/corrupted files
                    local_files_processing -= 1
                    if (delete_items) {
                        wrapDirHandle.removeEntry(wrapFileName)
                    }
                }    
            }
        }(reader,dirHandle,entry.name));
        reader.readAsBinaryString(file)
    } else {
        //delete non-jpgs or non-mp4s/avis
        if (delete_items) {
            dirHandle.removeEntry(entry.name)
        }
        local_files_processing -= 1
    }
}

async function getLocalImageInfo(hash,downloadingTask,jpegData,dirHandle,fileName,count=0) {
    /** Fetches a local image's info based on its hash and initates the writing process for the required paths */
    if (!wrappingUp) {
        var data = await limitTT(()=> fetch('/fileHandler/get_image_info', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                hash: hash,
                task_id: downloadingTask,
                species: species,
                species_sorted: species_sorted,
                individual_sorted: individual_sorted,
                flat_structure: flat_structure,
                include_empties: include_empties,
                include_video: include_video,
                include_frames: include_frames,
                fileName: fileName
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            }
            return response.json()
        }).catch( (error) => {
            if (count>5) {
                errorEcountered = true
                local_files_processing -= 1
                filesDownloaded += 1
            } else {
                setTimeout(function() { getLocalImageInfo(hash,downloadingTask,jpegData,dirHandle,fileName,count+1); }, 1000*(5**count));
            }
        }))
        
        if (data) {
            if (data.length>1) {
                filesToDownload += data.length-1
            }
    
            // Delete the original file before writing to prevent self-deletion
            if (delete_items) {
                dirHandle.removeEntry(fileName)
            }
    
            for (let i=0;i<data.length;i++) {
                await writeFile(jpegData,data[i].path,data[i].labels,data[i].fileName)
            }
            
            local_files_processing -= 1
            updateDownloadProgress()
        }
    }
}

async function writeFile(jpegData,path,labels,fileName) {
    /** Writes the specified labels into the image EXIF data and saves it to the specified path */

    // Handle folders
    var folders = path.split('/')
    var dirHandle = globalTopLevelHandle
    for (var i=0;i<folders.length;i++) {
        if (folders[i] != "") {
            dirHandle = await dirHandle.getDirectoryHandle(folders[i], { create: true })
        }
    }

    if (fileName.toLowerCase().includes('.mp4') || fileName.toLowerCase().includes('.avi')) {
        // If it's a video, just save it
        jpegData = jpegData

    } else {
        // If it's an image, save the labels in the EXIF
        try {
            var exifObj = exports.piexif.load(jpegData)
            exifObj['Exif'][37510] = labels.toString()
            var exifStr = exports.piexif.dump(exifObj)
            jpegData = exports.piexif.insert(exifStr, jpegData)
        } catch {
            // If there is something odd in the EXIF info, just overwrite everything
            var exifObj = {'0th':{},'1st':{},'Exif':{},'GPS':{},'Interop':{},'thumbnail':null}
            exifObj['Exif'][37510] = labels.toString()
            var exifStr = exports.piexif.dump(exifObj)
            jpegData = exports.piexif.insert(exifStr, jpegData)
        }
    }

    // Save
    var blob = new Uint8Array(jpegData.length);
    for (var i=0; i<jpegData.length; i++)
        blob[i] = jpegData.charCodeAt(i);
    await writeBlob(dirHandle,blob,fileName)

    filesDownloaded += 1
    if (downloading_count>0) {
        downloading_count -= 1
    }
    updateDownloadProgress()
}

async function writeBlob(dirHandle,blob,fileName) {
    /** writes the specifie blow to the specified location */
	var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(blob);
	await writable.close();
}

async function fetchRemainingImages() {
    /** Fetches a batch of images that must be downloaded */
    var data = await limitTT(()=> fetch('/fileHandler/get_required_files', {
        method: 'post',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            task_id: downloadingTask,
            species: species,
            species_sorted: species_sorted,
            individual_sorted: individual_sorted,
            flat_structure: flat_structure,
            include_empties: include_empties,
            include_video: include_video,
            include_frames: include_frames
        }),
    }).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.json()
    }).catch( (error) => {
        // do nothing - will automatically continue
    }))
    console.log('fetching data')
    console.log(data)
    if (data) {
        if (data.ids.length>0) {
            await confirmReceipt(data.ids)
            getRequiredImages(data.requiredFiles)
        } 
        else if(data.ids.length==0 && include_video == true){
            // If done with videos move onto images
            include_video = false
        }
        else { // if (download_initialised_check)
            finishedIterating = true
        }
    }

    if (!finishedIterating) {
        fetchRemainingImages()
        // if (data&&(data.ids.length==0)) {
        //     // Probably waitng for download prep to finish - slow down requests
        //     setTimeout(function() { fetchRemainingImages(); }, 5000)
        // } else {
        //     fetchRemainingImages()
        // }
    } else {
        checkDownloadStatus()
    }
}

async function confirmReceipt(image_ids,count=0) {
    /** Tells the server to mark the specified set of images as received */
    if (!wrappingUp) {
        await limitTT(()=> fetch('/fileHandler/mark_images_downloaded', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                image_ids: image_ids,
                include_video: include_video,
                include_frames: include_frames
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            }
        }).catch( (error) => {
            if (count<=5) {
                setTimeout(function() { confirmReceipt(image_ids,count+1); }, 1000*(5**count));
            }
        }))
    }
}

async function getRequiredImages(requiredImages) {
    /** Kicks off the download of the batch of images */
    updateDownloadProgress()
    for (let i=0;i<requiredImages.length;i++) {
        imageInfo = requiredImages[i]
        downloading_count += imageInfo.paths.length
        if (imageInfo.paths.length>1) {
            filesToDownload += imageInfo.paths.length-1
        }
        downloadFile(imageInfo.url,imageInfo.paths,imageInfo.labels)
    }
}

async function downloadFile(url,paths,labels,count=0) {
    /** Downloads the specified file to the given paths */
    if (paths.length>0) {
        var blob = await getBlob(url)
        if (blob!='error') {
            var reader = new FileReader();
            reader.addEventListener("load", function(wrapReader,wrapPaths,wrapLabels) {
                return async function() {
                    var jpegData = wrapReader.result
    
                    for (let i=0;i<wrapPaths.length;i++) {
                        splits = wrapPaths[i].split('/')
                        fileName = splits[splits.length-1]
                        splits.pop()
                        path = splits.join('/')
                        writeFile(jpegData,path,wrapLabels,fileName)
                        filesActuallyDownloaded += 1
                    }
                }
            }(reader,paths,labels));
            limitFiles(()=> reader.readAsBinaryString(blob));
        } else if (count>5) {
            errorEcountered = true
            filesDownloaded += paths.length
        } else {
            setTimeout(function() { downloadFile(url,paths,labels,count+1); }, 1000*(5**count));
        }
    }
}

async function getBlob(url) {
    /** Returns the data from a specified url */
    const blob = await limitAWS(()=> fetch(url
    ).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.blob()
    }).catch( (error) => {
        // errorEcountered = true
        return 'error'
    }))
    return blob;
}

function getHash(jpegData, filename) {
    /** Returns the hash of the EXIF-less image */
    if (['mp4', 'avi'].some(element => filename.toLowerCase().includes(element))){
        return CryptoJS.MD5(CryptoJS.enc.Latin1.parse(jpegData)).toString()
    }
    else{
        return CryptoJS.MD5(CryptoJS.enc.Latin1.parse(exports.piexif.insert(exports.piexif.dump({'0th':{},'1st':{},'Exif':{},'GPS':{},'Interop':{},'thumbnail':null}), jpegData))).toString()
    }
}

async function checkDownloadStatus() {
    /** Checks the status of the download. Wraps up if finished or restarts if an error was encountered. */
    if ((filesDownloaded>=filesToDownload)&&(finishedIterating)&&!wrappingUp&&(localQueue.length==0)&&(downloading_count==0)) { //&&(filesToDownload!=0)
        if (!errorEcountered) { //((filesActuallyDownloaded==0)&&(!errorEcountered))
            // finished
            wrappingUp = true
            console.log('Download complete!')
            if (delete_items) {
                await cleanEmptyFolders(globalTopLevelHandle)
            }
            wrapUpDownload(false)
        } else {
            // check download
            postMessage({'func': 'checkingDownload', 'args': [true]})
            if(include_video_init){
                include_video = true
            }
            startDownload(downloadingTask,downloadingTaskName)
        }
    }
}

async function wrapUpDownload(reload,count=0) {
    /** Wraps up the download by cleaning up any remaining empty folders and updating the UI */
    if (downloadingTask) {
        var response = await limitTT(()=> fetch('/fileHandler/download_complete', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                task_id: downloadingTask
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else {
                return true
            }
        }).catch( (error) => {
            if (count<=5) {
                setTimeout(function() { wrapUpDownload(reload,count+1); }, 1000*(5**count));
            }
        }))
        if (response) {
            if (reload) {
                postMessage({'func': 'reload', 'args': null})
            }
            resetDownloadState()
            wrappingUp = false
        }
    }
}

async function cleanEmptyFolders(dirHandle) {
    /** Deletes any remaining empty folders */
    var contents_count = 0
    for await (const entry of dirHandle.values()) {
        contents_count += 1
        if (entry.kind=='directory'){
            empty = await cleanEmptyFolders(entry)
            if (empty) {
                dirHandle.removeEntry(entry.name)
                contents_count -= 1
            }
        }
    }
    if (contents_count==0) {
        return true
    }
    return false
}

function resetDownloadState() {
    /** Wrapper function for resetDownloadState so that the main js can update the page. */
    downloadingTask = null
    postMessage({'func': 'resetDownloadState', 'args': [surveyName,downloadingTaskName]})
}