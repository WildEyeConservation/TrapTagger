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
var filesSucceeded
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

onmessage = function (evt) {
    /** Take instructions from main js */
    if (evt.data.func=='startDownload') {
        globalTopLevelHandle = evt.data.args[0]
        surveyName = evt.data.args[2]
        species = evt.data.args[4]
        species_sorted = evt.data.args[5]
        individual_sorted = evt.data.args[6]
        flat_structure = evt.data.args[7]
        include_empties = evt.data.args[8]
        startDownload(evt.data.args[1],evt.data.args[3])
    } else if (evt.data.func=='checkDownloadStatus') {
        checkDownloadStatus()
    } else if (evt.data.func=='updateDownloadProgress') {
        updateDownloadProgress()
    }
};

// async function downloadFile(fileName,url,dirHandle,count=0) {
//     /** Downloads the specified file to the diven directory handle */
//     var blob = await getBlob(url)
//     if (blob!='error') {
//         var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
//         const writable = await fileHandle.createWritable();
//         await writable.write(blob);
//         await writable.close();
//         filesActuallyDownloaded += 1
//         filesSucceeded += 1
//         filesDownloaded += 1
//     } else if (count>5) {
//         filesDownloaded += 1
//     } else {
//         setTimeout(function() { downloadFile(fileName,url,dirHandle,count+1); }, 1000*(5**count));
//     }
//     updateDownloadProgress()
// }

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

async function checkFiles(files,dirHandle,folders) {
    /** Compares the given files against the contents of the given directory and downloads or deletes accordingly*/

    // Get list of files that already exist in folder
    updateDownloadProgress()
    var existingFiles = []
    var existingDirectories = []
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='file') {
            existingFiles.push(entry.name)
        } else if (entry.kind=='directory') {
            if (!folders.includes(entry.name)) {
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

    // Delete the remaining files and folders that shouldn't be there
    for (let i=0; i<existingFiles.length; i++) {
        dirHandle.removeEntry(existingFiles[i])
    }
    for (let i=0; i<existingDirectories.length; i++) {
        deleteFolder(existingDirectories[i],dirHandle)
    }
}

async function getDirectoryFiles(path,dirHandle,count=0) {
    /** Fetches a list of files for the given directory */
    
    //need this check to make sure it doesn't download other annotation sets, or overwrite them locally
    if (path != surveyName) {
        if (!pathsBeingChecked.includes(path)) {
            pathsBeingChecked.push(path)
        }
    
        var data = await limitTT(()=> fetch('/get_directory_files', {
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
        }).then((data) => {
            if (data=='error') {
                location.reload()
            } else {
                return data
            }
        }).catch( (error) => {
            if (count>5) {
                errorEcountered = true
                var index = pathsBeingChecked.indexOf(path)
                if (index > -1) {
                    pathsBeingChecked.splice(index, 1)
                }
            } else {
                setTimeout(function() { getDirectoryFiles(path,dirHandle,count+1); }, 1000*(5**count));
            }
        }))

        if (data) {
            for (let i=0; i<data.folders.length; i++) {
                var newDirHandle = await dirHandle.getDirectoryHandle(data.folders[i], { create: true })
                getDirectoryFiles(path+'/'+data.folders[i],newDirHandle)
            }
            
            if (data.files) {
                // filesToDownload += data.files.length
                await checkFiles(data.files,dirHandle,data.folders)
                var index = pathsBeingChecked.indexOf(path)
                if (index > -1) {
                    pathsBeingChecked.splice(index, 1)
                }
            }
        }
    
        checkDownloadStatus()
    }
}

async function startDownload(selectedTask,taskName,count=0) {
    /** Begins the download */

    console.log('Started Download')

    downloadingTask = selectedTask
    downloadingTaskName = taskName

    postMessage({'func': 'initDisplayForDownload', 'args': [downloadingTask]})

    await limitTT(()=> fetch('/reset_download_status', {
        method: 'post',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            species: species,
            selectedTask: selectedTask,
            include_empties: include_empties
        }),
    })).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        } else {
            return response.json()
        }
    }).then((count) => {
        filesToDownload = count
        start_download()
    }).catch( (error) => {
        if (count<=5) {
            setTimeout(function() { startDownload(selectedTask,taskName,count+1); }, 1000*(5**count));
        }
    })   

    // console.log('Started Download')

    // downloadingTask = selectedTask
    // downloadingTaskName = taskName
    // finishedIteratingDirectories = false
    // pathsBeingChecked = []
    // errorEcountered = false
    // filesDownloaded = 0
    // filesToDownload = 0
    // filesActuallyDownloaded = 0
    // filesSucceeded = 0
    // wrappingUp = false

    // postMessage({'func': 'initDisplayForDownload', 'args': [downloadingTask]})

    // var surveyDirHandle = await globalTopLevelHandle.getDirectoryHandle(surveyName, { create: true })
    // var taskDirHandle = await surveyDirHandle.getDirectoryHandle(taskName, { create: true })
    
    // await getDirectoryFiles(surveyName+'/'+taskName,taskDirHandle)
    // finishedIteratingDirectories = true
}

function resetDownloadState() {
    /** Wrapper function for resetDownloadState so that the main js can update the page. */
    downloadingTask = null
    postMessage({'func': 'resetDownloadState', 'args': [surveyName,downloadingTaskName]})
}




// ///////////////////////////////////////////////////////////

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

// function readFile(file){
//     return new Promise((resolve, reject) => {

//         var reader = new FileReader();
//         reader.addEventListener("load", function(wrapReader,wrapPaths,wrapLabels) {
//             return async function() {
//                 var jpegData = wrapReader.result

//                 for (let i=0;i<wrapPaths.length;i++) {
//                     splits = wrapPaths[i].split('/')
//                     fileName = splits[splits.length-1]
//                     splits.pop()
//                     path = splits.join('/')
//                     write_local(jpegData,path,wrapLabels,fileName)
//                     filesActuallyDownloaded += 1
//                 }
//             }
//         }(reader,paths,labels));
//         reader.readAsBinaryString(blob);





//         var fr = new FileReader();  
//         fr.onload = () => {
//             resolve(fr.result )
//         };
//         fr.onerror = reject;
//         fr.readAsText(file.blob);
//     });
//   }

async function downloadFile(url,paths,labels,count=0) {
    /** Downloads the specified file to the diven directory handle */
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
                    write_local(jpegData,path,wrapLabels,fileName)
                    filesActuallyDownloaded += 1
                }
            }
        }(reader,paths,labels));
        limitFiles(()=> reader.readAsBinaryString(blob));
    } else if (count>5) {
        errorEcountered = true
        filesDownloaded += 1
    } else {
        setTimeout(function() { downloadFile(url,paths,labels,count+1); }, 1000*(5**count));
    }
    // updateDownloadProgress()
}

function get_hash(jpegData) {
    /** Returns the hash of the EXIF-less image */
    return CryptoJS.MD5(CryptoJS.enc.Latin1.parse(exports.piexif.insert(exports.piexif.dump({'0th':{},'1st':{},'Exif':{},'GPS':{},'Interop':{},'thumbnail':null}), jpegData))).toString()
}

async function get_image_info(hash,downloadingTask,jpegData,dirHandle,fileName,count=0) {
    var data = await limitTT(()=> fetch('/get_image_info', {
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
            include_empties: include_empties
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
            setTimeout(function() { get_image_info(hash,downloadingTask,jpegData,dirHandle,fileName,count+1); }, 1000*(5**count));
        }
    }))
    
    if (data) {
        if (data.length>1) {
            filesToDownload += data.length-1
        }
        
        for (let i=0;i<data.length;i++) {
            await write_local(jpegData,data[i].path,data[i].labels,data[i].fileName)
        }
    
        // Delete the original file when done
        dirHandle.removeEntry(fileName)
        
        local_files_processing -= 1
        updateDownloadProgress()
    }
}

// function readLocalEntry(entry){
//     return new Promise((resolve, reject) => {
//         var file = await entry.getFile()
//         var reader = new FileReader();  
//         reader.onload = () => function(wrapReader,wrapDirHandle,wrapFileName) {
//             return async function() {
//                 try {
//                     var jpegData = wrapReader.result
//                     var hash = get_hash(jpegData)
//                     await get_image_info(hash,downloadingTask,jpegData,wrapDirHandle,wrapFileName)
//                     resolve
//                 } catch {
//                     // delete malformed/corrupted files
//                     local_files_processing -= 1
//                     wrapDirHandle.removeEntry(wrapFileName)
//                     reject
//                 }
//             }
//         }(reader,dirHandle,entry.name);
//         reader.onerror = reject;
//         reader.readAsBinaryString(file);
//     });
// }

async function consumeQueue() {
    if ((!consuming) && (local_files_processing<max_processing)&&(localQueue.length>0)) {
        consuming = true
        for (let i=0;i<(max_processing-local_files_processing);i++) {
            if (localQueue.length==0) {
                break
            } else {
                var data = localQueue.pop()
                handle_file(data[0],data[1])
            }
        }
        consuming = false
    }
}

async function handle_file(entry,dirHandle) {
    local_files_processing += 1
    if (['jpeg', 'jpg'].some(element => entry.name.toLowerCase().includes(element))) {
        var file = await entry.getFile()
        var reader = new FileReader();
        reader.addEventListener("load", function(wrapReader,wrapDirHandle,wrapFileName) {
            return async function() {
                var jpegData = wrapReader.result
                try {
                    var hash = get_hash(jpegData)
                    get_image_info(hash,downloadingTask,jpegData,wrapDirHandle,wrapFileName)
                } catch {
                    // delete malformed/corrupted files
                    local_files_processing -= 1
                    wrapDirHandle.removeEntry(wrapFileName)
                }    
            }
        }(reader,dirHandle,entry.name));
        reader.readAsBinaryString(file)
    } else {
        //delete non-jpgs
        dirHandle.removeEntry(entry.name)
        local_files_processing -= 1
    }
}

async function checkLocalFiles(dirHandle,path){
    checking_local_folder += 1
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='directory'){
            checkLocalFiles(entry,path+'/'+entry.name)
        } else {
            localQueue.push([entry,dirHandle])
            // handle_file(entry,dirHandle)
        }
    }
    checking_local_folder -= 1
    updateDownloadProgress()
}

async function get_required_images(requiredImages) {
    // filesToDownload += requiredImages.length
    updateDownloadProgress()
    for (let i=0;i<requiredImages.length;i++) {
        imageInfo = requiredImages[i]
        if (imageInfo.paths.length>1) {
            filesToDownload += imageInfo.paths.length-1
        }
        downloadFile(imageInfo.url,imageInfo.paths,imageInfo.labels)
    }
}

async function fetch_remaining_images() {
    await limitTT(()=> fetch('/get_required_images', {
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
            include_empties: include_empties
        }),
    }).then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.json()
    }).then((data) => {
        if (data.hashes.length>0) {
            get_required_images(data.requiredImages)
        } else {
            finishedIterating = true
        }
    }).catch( (error) => {
        // do nothing - will automatically continue
    }))
    if (!finishedIterating) {
        fetch_remaining_images()
    } else {
        checkDownloadStatus()
    }
}

async function start_download() {
    consuming = false
    downloading = false
    errorEcountered = false
    filesActuallyDownloaded = 0
    filesDownloaded = 0
    // filesToDownload = 0
    local_files_processing = 0
    finishedIterating = false
    wrappingUp = false
    localQueue = []
    checking_local_folder = 0
    updateDownloadProgress(true)
    checkLocalFiles(globalTopLevelHandle,globalTopLevelHandle.name)
    // fetch_remaining_images()
}

async function write_local(jpegData,path,labels,fileName) {

    // Handle folders
    var folders = path.split('/')
    var dirHandle = globalTopLevelHandle
    for (var i=0;i<folders.length;i++) {
        if (folders[i] != "") {
            dirHandle = await dirHandle.getDirectoryHandle(folders[i], { create: true })
        }
    }

    // EXIF
    var exifObj = exports.piexif.load(jpegData)
    exifObj['Exif'][37510] = labels.toString()
    var exifStr = exports.piexif.dump(exifObj)
    jpegData = exports.piexif.insert(exifStr, jpegData)

    // Save
    var blob = new Uint8Array(jpegData.length);
    for (var i=0; i<jpegData.length; i++)
        blob[i] = jpegData.charCodeAt(i);
    await writeBlob(dirHandle,blob,fileName)

    filesDownloaded += 1
    updateDownloadProgress()
}

async function writeBlob(dirHandle,blob,fileName) {
	var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(blob);
	await writable.close();
}

function updateDownloadProgress(init=false) {
    /** Wrapper function for updateDownloadProgress so that the main js can update the page. */
    if (!downloading && (local_files_processing==0) && (!init) && (checking_local_folder==0)) {
        downloading = true
        console.log('Local processing finished')
        fetch_remaining_images()
    }
    postMessage({'func': 'updateDownloadProgress', 'args': [downloadingTask,filesDownloaded,filesToDownload]})
    if (!downloading) {
        consumeQueue()   
    }
}

function checkDownloadStatus() {
    /** Checks the status of the download. Wraps up if finished. */
    if ((filesDownloaded==filesToDownload)&&(filesToDownload!=0)&&finishedIterating) {
        if (!errorEcountered) { //((filesActuallyDownloaded==0)&&(!errorEcountered))
            // finished
            wrapUpDownload()
        } else {
            // check download
            postMessage({'func': 'checkingDownload', 'args': [true]})
            startDownload(downloadingTask,downloadingTaskName)
        }
    }
}

async function wrapUpDownload(count=0) {
    /** Wraps up the download by letting the server know that the client download is finished */
    if (downloadingTask&&!wrappingUp) {
        console.log('Download complete!')
        wrappingUp = true
        await cleanEmptyFolders(globalTopLevelHandle)
        resetDownloadState()
        wrappingUp = false
    }
}

async function cleanEmptyFolders(dirHandle) {
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