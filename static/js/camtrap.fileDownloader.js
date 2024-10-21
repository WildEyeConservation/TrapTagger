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
var global_count_initialised = false

downloadWorker.onmessage = function(evt){
    /** Take instructions from the web worker */
    if (evt.data.func=='updateDownloadProgress') {
        updateDownloadProgress(evt.data.args[0],evt.data.args[1],evt.data.args[2],evt.data.args[3])
    } else if (evt.data.func=='initDisplayForDownload') {
        initDisplayForDownload(evt.data.args[0])
    } else if (evt.data.func=='resetDownloadState') {
        resetDownloadState(evt.data.args[0],evt.data.args[1])
    } else if (evt.data.func=='checkingDownload') {
        checkingDownload = evt.data.args[0]
    } else if (evt.data.func=='reload') {
        location.reload()
    }
}

async function initDisplayForDownload(download_id) {
    /** Prepares the display for download status */
    if (!checkingDownload) {
        // updatePage(generate_url())
        modalDownload.modal('hide')
        updateDownloads()
    }
    progBar = document.getElementById('progBar'+download_id)
    if (progBar) {
        progBar.innerHTML = 'Initialising...'
    }
}

async function initiateDownload() {
    // Select the download folder & get access

    if (currentDownloads.length==0) {
        document.getElementById('btnDownloadStart').disabled = true

        var response = await fetch('/fileHandler/check_download_available', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                task_id: selectedTask
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else {
                return response.json()
            }
        }).catch( (error) => {
            // pass
        })

        if (response=='available') {
            raw_files = document.getElementById('rawFiles').checked
            species_sorted = document.getElementById('speciesSorted').checked
            individual_sorted = document.getElementById('individualSorted').checked
            flat_structure = document.getElementById('flatStructure').checked
            include_empties = document.getElementById('emptyInclude').checked
            delete_items = document.getElementById('deleteTrue').checked
            if(document.getElementById('videoTrue').checked ) {
                include_video = true
                include_frames = false	
            }
            else if(document.getElementById('videoFramesTrue').checked) {
                include_video = false
                include_frames = true
            }
            else if (document.getElementById('videoAndFramesTrue').checked) {
                include_video = true
                include_frames = true
            }
            else {
                include_video = false
                include_frames = false
            }
    
            species = []
            downloadSpecies = document.querySelectorAll('[id^=downloadSpecies-]');
            for (let i=0;i<downloadSpecies.length;i++) {
                species.push(downloadSpecies[i].options[downloadSpecies[i].selectedIndex].value)
            }

            restore_required = raw_files || include_video || include_empties

            if (restore_required) {
                var restore_response = await fetch('/fileHandler/restore_for_download', {
                    method: 'post',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        task_id: selectedTask,
                        species: species,
                        species_sorted: species_sorted,
                        individual_sorted: individual_sorted,
                        flat_structure: flat_structure,
                        include_empties: include_empties,
                        delete_items: delete_items,
                        include_video: include_video,
                        include_frames: include_frames,
                        raw_files: raw_files
                    }),
                }).then((response) => {
                    if (!response.ok) {
                        throw new Error(response.statusText)
                    } else {
                        return response.json()
                    }
                }).catch( (error) => {
                    // pass
                })

                document.getElementById('modalAlertHeader').innerHTML = 'Alert'
                document.getElementById('modalAlertBody').innerHTML = restore_response.message
                modalDownload.modal('hide')
                modalAlert.modal({keyboard: true});

                if (restore_response.status=='success') {
                    alertReload = true
                }

            }
            else{
                try {
                    var topLevelHandle = await window.showDirectoryPicker({
                        writable: true //ask for write permission
                    });
                
                    await verifyPermission(topLevelHandle)
                
                    // Create a new download request
                    var response = await fetch('/fileHandler/init_download_request', {
                        method: 'post',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                        },
                        body: JSON.stringify({
                            task_id: selectedTask,
                        }),
                    }).then((response) => {
                        if (!response.ok) {
                            throw new Error(response.statusText)
                        } else {
                            return response.json()
                        }
                    }).catch( (error) => {
                        // pass
                    })

                    if (response.status=='success') {
                        download_id = response.download_id

                        checkingDownload = false
                        // if (!currentDownloadTasks.includes(taskName)) {
                            // currentDownloadTasks.push(taskName)
                            // currentDownloads.push(selectedSurvey)
                        // }
                        if (!currentDownloads.includes(download_id)) {
                            currentDownloads.push(download_id)
                        }
            
                        globalDownloaded = 0
                        globalToDownload = 0
                        global_count_initialised = false

                        downloadWorker.postMessage({'func': 'startDownload', 'args': [topLevelHandle,selectedTask,surveyName,taskName,species,species_sorted,individual_sorted,flat_structure,include_empties,delete_items, include_video, include_frames, selectedSurvey, raw_files, download_id]})
                    }
                    else {
                        document.getElementById('btnDownloadStart').disabled = false
                    }
                
                } catch {
                    document.getElementById('btnDownloadStart').disabled = false
                }
            }

        }  else {
            document.getElementById('modalAlertHeader').innerHTML = 'Alert'
            document.getElementById('modalAlertBody').innerHTML = 'This survey is currently being downloaded. Please try again later.'
            modalDownload.modal('hide')
            modalAlert.modal({keyboard: true});
        }

    } else {
        document.getElementById('modalAlertHeader').innerHTML = 'Alert'
        document.getElementById('modalAlertBody').innerHTML = 'You already have a download in progress. Please wait for that to complete before initiating a new one, or open a new tab.'
        modalDownload.modal('hide')
        modalAlert.modal({keyboard: true});
    }
}

async function resetDownloadState(download_id) {
    /** Cleans up after a download is complete */

    checkingDownload = false

    var index = currentDownloads.indexOf(download_id)
    if (index > -1) {
        currentDownloads.splice(index, 1)
    }

    updateDownloads()
}

function updateDownloadProgress(download_id,downloaded,toDownload,count_initialised) {
    /** Updates the download progress bar with the given information */
    globalDownloaded = downloaded
    globalToDownload = toDownload
    global_count_initialised = count_initialised
    if (downloaded > toDownload) {
        // Not an issue if an image is downloaded twice - just hide it from the user
        downloaded = toDownload
    }
    progBar = document.getElementById('progBar'+download_id)
    if (progBar) {
        progBar.setAttribute("aria-valuenow", downloaded);
    
        if (toDownload!=0) {
            progBar.setAttribute("aria-valuemax", toDownload);

            if (count_initialised) {
                progBar.setAttribute("style", "width:"+(downloaded/toDownload)*100+"%;transition:none");
                progBar.innerHTML = downloaded.toString() + '/' + toDownload.toString() + ' files downloaded'
            } else {
                // unknown total count - do something pretty
                progBar.setAttribute("style", "width:50%;transition:none");
                progBar.innerHTML = downloaded.toString() + ' files downloaded'
            }

        } else {
            progBar.setAttribute("aria-valuemax", 100);
            progBar.setAttribute("style", "width:0%;transition:none");
            progBar.innerHTML = 'Initialising... '
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

async function initiateDownloadAfterRestore(request_id,task_id) {
    // Select the download folder & get access

    if (currentDownloads.length==0) {

        document.getElementById('launchRestoreDownloadBtn-'+request_id.toString()).disabled = true

        var response = await fetch('/fileHandler/check_download_available', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                task_id: task_id,
                download_request_id: request_id
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText)
            } else {
                return response.json()
            }
        }).catch( (error) => {
            // pass
        })


        if (response=='available') {

            try {
                var topLevelHandle = await window.showDirectoryPicker({
                    writable: true //ask for write permission
                });
            
                await verifyPermission(topLevelHandle)

                var response = await fetch('/fileHandler/init_download_after_restore', {
                    method: 'post',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        download_request_id: request_id
                    }),
                }).then((response) => {
                    if (!response.ok) {
                        throw new Error(response.statusText)
                    } else {
                        return response.json()
                    }
                }).catch( (error) => {
                    // pass
                })

                if (response.status=='success') {

                    selectedTask = response.download_params.task_id
                    selectedSurvey = response.download_params.survey_id
                    taskName = response.download_params.task_name
                    raw_files = response.download_params.raw_files
                    species_sorted = response.download_params.species_sorted
                    individual_sorted = response.download_params.individual_sorted
                    flat_structure = response.download_params.flat_structure
                    include_empties = response.download_params.include_empties
                    delete_items = response.download_params.delete_items
                    include_video = response.download_params.include_video
                    include_frames = response.download_params.include_frames
                    species = response.download_params.species
                
                    checkingDownload = false
                    if (!currentDownloads.includes(request_id)) {
                        currentDownloads.push(request_id)
                    }
        
                    globalDownloaded = 0
                    globalToDownload = 0
                    global_count_initialised = false
                
                    downloadWorker.postMessage({'func': 'startDownload', 'args': [topLevelHandle,selectedTask,surveyName,taskName,species,species_sorted,individual_sorted,flat_structure,include_empties,delete_items, include_video, include_frames, selectedSurvey, raw_files, request_id]})
                }
                else {
                    document.getElementById('modalAlertHeader').innerHTML = 'Alert'
                    document.getElementById('modalAlertBody').innerHTML = response.message
                    document.getElementById('downloadsBtn').click()
                    modalAlert.modal({keyboard: true});
                    document.getElementById('launchRestoreDownloadBtn-'+request_id.toString()).disabled = false
                }

            } catch {
                document.getElementById('launchRestoreDownloadBtn-'+request_id.toString()).disabled = false
            }
            

        } else {
            document.getElementById('modalAlertHeader').innerHTML = 'Alert'
            document.getElementById('modalAlertBody').innerHTML = 'This survey is currently being downloaded. Please try again later.'
            document.getElementById('downloadsBtn').click()
            modalAlert.modal({keyboard: true});

            document.getElementById('launchRestoreDownloadBtn-'+request_id.toString()).disabled = false
        }

    } else {
        document.getElementById('modalAlertHeader').innerHTML = 'Alert'
        document.getElementById('modalAlertBody').innerHTML = 'You already have a download in progress. Please wait for that to complete before initiating a new one, or open a new tab.'
        document.getElementById('downloadsBtn').click()
        modalAlert.modal({keyboard: true});

        document.getElementById('launchRestoreDownloadBtn-'+request_id.toString()).disabled = true
    }
}