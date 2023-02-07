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

var clusterIDs
var clusterReadAheadIndex=0;
var currentLabel = '0';
var selectedCamera = 1;
var currentCluster = 0;
var T_index = 0
var F_index = 0
var waiting = false
isTagging = false
isReviewing = false
isKnockdown = true
isBounding = false
isIDing = false

const divSelector = document.querySelector('#divSelector');
const modalAllFineCheck = $('#modalAllFineCheck');
const modalCompleteReclusterCheck = $('#modalCompleteReclusterCheck');

function getKnock(KnockedStatus, mapID = 'map1') {
    /** Gets the next batch of images for the knockdown analysis. */

    if (!waiting) {
        waiting = true
        if (modalAllFineCheck.is(':visible')) {
            modalAllFineCheck.modal('hide');
        }
        if (modalCompleteReclusterCheck.is(':visible')) {
            modalCompleteReclusterCheck.modal('hide');
        }
    
        waitModalID = clusters[mapID][clusterIndex[mapID]]
        waitModalMap = mapID
        modalWait2.modal({backdrop: 'static', keyboard: false});
    
        if (clusters[mapID][clusterIndex[mapID]] != null) {
            knockIndex = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].index
        } else {
            knockIndex = -1
        }
    
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 200) {
                    info = JSON.parse(this.responseText);
                    T_index = info.T_index
                    F_index = info.F_index
                    
                    newcluster = info.info;
                    currentCluster = newcluster.id
    
                    if (currentCluster=='-100') {
                        // takejob + do task
                        takeJob(selectedTask)
                    } else if (currentCluster=='-101') {
                        window.location.replace("surveys")
                    } else if (currentCluster=='-102') {
                        // wait
                        waiting = false
                        // waitModalID = currentCluster
                        if (modalWait2.is(':visible')) {
                            modalWait2.modal('hide');
                        }    
                        if (!modalWait.is(':visible')) {
                            modalWait.modal({backdrop: 'static', keyboard: false});
                        }
                        setTimeout(function() { getKnock(0); }, 5000);
                    } else {
                        if (modalWait2.is(':visible')) {
                            modalWait2.modal('hide');
                        }    
                        imageIndex[mapID] = 0
                        if (KnockedStatus != 87) {
                            clusterIndex[mapID] += 1
                        }
                        clusters[mapID].push(newcluster)
                        updateCanvas()
                        updateButtons()
                        preload()
                        waiting = false
                    }
                }
            };
        xhttp.open("GET", '/getKnockCluster/'+selectedTask+'/'+KnockedStatus+'/'+currentCluster+'/'+knockIndex+'/'+imageIndex[mapID]+'/'+T_index+'/'+F_index);
        xhttp.send();
    }
} 

function handleKnock(KnockedStatus, mapID = 'map1') {
    /** Handles the user input of knocked-down or not - loading the next image or the next cluster accordingly. */
    if (!modalWait2.is(':visible')) {
        if (KnockedStatus==1) {
            if (imageIndex[mapID] < (clusters[mapID][clusterIndex[mapID]].images.length-1)) {
                nextImage()
            } else {
                loadNewCluster(1)
            }
        } else {
            loadNewCluster(0)
        }
    }
}

function loadNewCluster(KnockedStatus) {
    /** Gets the next cluster of images. */
    if (!modalWait2.is(':visible')) {
        getKnock(KnockedStatus)
    }
}

window.addEventListener('load', onload, false);
