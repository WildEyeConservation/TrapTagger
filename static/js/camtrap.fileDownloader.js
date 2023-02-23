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

var checkingDownload = false
var globalDownloaded = 0
var globalToDownload = 0

downloadWorker.onmessage = function(evt){
    /** Take instructions from the web worker */
    if (evt.data.func=='updateDownloadProgress') {
        updateDownloadProgress(evt.data.args[0],evt.data.args[1],evt.data.args[2])
    } else if (evt.data.func=='initDisplayForDownload') {
        initDisplayForDownload(evt.data.args[0])
    } else if (evt.data.func=='resetDownloadState') {
        resetDownloadState(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='checkingDownload') {
        checkingDownload = evt.data.args[0]
    }
}

async function initDisplayForDownload(task_id) {
    /** Prepares the display for download status */
    if (!checkingDownload) {
        updatePage(generate_url())
        modalDownload.modal('hide')
    }
    progBar = document.getElementById('progBar'+task_id)
    if (progBar) {
        progBar.innerHTML = 'Initialising...'
    }
}

async function initiateDownload() {
    // Select the download folder & get access

    if (currentDownloads.length==0) {

        document.getElementById('btnDownloadStart').disabled = true
        species_sorted = document.getElementById('speciesSorted').checked
        individual_sorted = document.getElementById('individualSorted').checked
        flat_structure = document.getElementById('flatStructure').checked
        include_empties = document.getElementById('emptyInclude').checked

        species = []
        downloadSpecies = document.querySelectorAll('[id^=downloadSpecies-]');
        for (let i=0;i<downloadSpecies.length;i++) {
            species.push(downloadSpecies[i].options[downloadSpecies[i].selectedIndex].value)
        }

        try {
            var topLevelHandle = await window.showDirectoryPicker({
                writable: true //ask for write permission
            });
        
            await verifyPermission(topLevelHandle)
        
            checkingDownload = false
            if (!currentDownloadTasks.includes(taskName)) {
                currentDownloadTasks.push(taskName)
                currentDownloads.push(surveyName)
            }
        
            downloadWorker.postMessage({'func': 'startDownload', 'args': [topLevelHandle,selectedTask,surveyName,taskName,species,species_sorted,individual_sorted,flat_structure,include_empties]})
        
        } catch {
            document.getElementById('btnDownloadStart').disabled = false
        }
    } else {
        document.getElementById('modalAlertText').innerHTML = 'You already have a download in progress. Please wait for that to complete before initiating a new one.'
        modalDownload.modal('hide')
        modalAlert.modal({keyboard: true});
    }
}

function resetDownloadState(survey,task) {
    /** Cleans up after a download is complete */

    checkingDownload = false

    var index = currentDownloadTasks.indexOf(task)
    if (index > -1) {
        currentDownloadTasks.splice(index, 1)
    }

    var index = currentDownloads.indexOf(survey)
    if (index > -1) {
        currentDownloads.splice(index, 1)
    }

    updatePage(generate_url())
}

function updateDownloadProgress(task_id,downloaded,toDownload) {
    /** Updates the download progress bar with the given information */
    globalDownloaded = downloaded
    globalToDownload = toDownload
    progBar = document.getElementById('progBar'+task_id)
    if (progBar) {
        progBar.setAttribute("aria-valuenow", downloaded);
    
        if (toDownload!=0) {
            progBar.setAttribute("aria-valuemax", toDownload);
            progBar.setAttribute("style", "width:"+(downloaded/toDownload)*100+"%;transition:none");
            progBar.innerHTML = downloaded.toString() + '/' + toDownload.toString() + ' files downloaded'

            // if (checkingDownload) {
            //     progBar.innerHTML = 'Checking files... ' + downloaded.toString() + '/' + toDownload.toString()
            // } else {
            //     progBar.innerHTML = downloaded.toString() + '/' + toDownload.toString() + ' files downloaded'
            // }
        } else {
            progBar.setAttribute("aria-valuemax", 100);
            progBar.setAttribute("style", "width:0%;transition:none");
            progBar.innerHTML = 'Initialising...'
        }
    }
    
    downloadWorker.postMessage({'func': 'checkDownloadStatus', 'args': null})
}

async function verifyPermission(fileHandle) {
    /** Checks for the necessary file/folder permissions and requests them if necessary */
    const options = {}
    options.mode = 'readwrite'
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true
    }
    return false
}