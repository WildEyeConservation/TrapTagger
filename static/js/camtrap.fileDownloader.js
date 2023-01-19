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

var checkingDownload = false

downloadWorker.onmessage = function(evt){
    /** Take instructions from the web worker */
    if (evt.data.func=='updateDownloadProgress') {
        updateDownloadProgress(evt.data.args[0],evt.data.args[1],evt.data.args[2])
    } else if (evt.data.func=='initDisplayForDownload') {
        initDisplayForDownload()
    } else if (evt.data.func=='resetDownloadState') {
        resetDownloadState()
    } else if (evt.data.func=='verifyPermission') {
        verifyPermission(evt.data.args[0])
    }
}

async function initDisplayForDownload() {
    /** Prepares the display for download status */
    updatePage(generate_url())
    modalResults.modal('hide')
}

async function initiateDownload() {
    // Select the download folder & get access
    var topLevelHandle = await window.showDirectoryPicker({
        writable: true //ask for write permission
    });

    await verifyPermission(topLevelHandle)

    checkingDownload = false
    if (!currentDownloadTasks.includes(taskName)) {
        currentDownloadTasks.push(taskName)
        currentDownloads.push(surveyName)
    }

    downloadWorker.postMessage({'func': 'startDownload', 'args': [topLevelHandle,selectedTask,surveyName,taskName]})
}

function resetDownloadState() {
    /** Cleans up after a download is complete */

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

function updateDownloadProgress(task_id,downloaded,toDownload) {
    /** Updates the download progress bar with the given information */
    progBar = document.getElementById('progBar'+task_id)
    progBar.setAttribute("aria-valuenow", downloaded);
    progBar.setAttribute("aria-valuemax", toDownload);
    progBar.setAttribute("style", "width:"+(downloaded/toDownload)*100+"%;transition:none");

    if (toDownload!=0) {
        if (checkingDownload) {
            progBar.innerHTML = 'Checking files... ' + downloaded.toString() + '/' + toDownload.toString()
        } else {
            progBar.innerHTML = downloaded.toString() + '/' + toDownload.toString() + ' files downloaded'
        }
    }
    
    downloadWorker.postMessage({'func': 'checkDownloadStatus', 'args': null})
}

// async function verifyPermission(fileHandle) {
//     /** Checks for the necessary file/folder permissions and requests them if necessary */
//     console.log('Verifying Permission')
//     const options = {}
//     options.mode = 'readwrite'
//     if ((await fileHandle.queryPermission(options)) === 'granted') {
//         console.log('Permission obtained')
//         downloadWorker.postMessage({'func': 'permissionGiven', 'args': true})
//     } else if ((await fileHandle.requestPermission(options)) === 'granted') {
//         console.log('Permission obtained')
//         downloadWorker.postMessage({'func': 'permissionGiven', 'args': true})
//     } else {
//         console.log('Permission NOT obtained')
//         downloadWorker.postMessage({'func': 'permissionGiven', 'args': false})
//     }
// }

async function verifyPermission(fileHandle) {
    /** Checks for the necessary file/folder permissions and requests them if necessary */
    console.log('Verifying Permission')
    const options = {}
    options.mode = 'readwrite'
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        console.log('Permission obtained')
        return true
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        console.log('Permission obtained')
        return true
    }
    console.log('Permission NOT obtained')
    return false
}