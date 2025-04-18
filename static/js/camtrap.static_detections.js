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


isTagging = false
isReviewing = false
isKnockdown = false
isBounding = false
isIDing = false
isStaticCheck = true
isTimestampCheck = false

var clusterIdList = []
var staticgroupIDs = []
var staticgroupReadAheadIndex = 0
var total_staticgroups = 0
var completed_staticgroups = 0
var staticCheckPage = {}

const divSelector = document.querySelector('#divSelector');

function loadNewCluster(mapID = 'map1') {
    /** Requests the next back of clusters from the server. */
    if (staticgroupReadAheadIndex < staticgroupIDs.length) {
        if (staticgroupReadAheadIndex == staticgroupIDs.length-1) {
            lastStaticGroup = true
        } else {
            lastStaticGroup = false
        }
        waitingForClusters[mapID] = true
        var newID = Math.floor(Math.random() * 100000) + 1;
        clusterRequests[mapID].push(newID)

        if (!batchComplete) {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        waitingForClusters[mapID] = false
                        info = JSON.parse(this.responseText);
                        // console.log(info)

                        if (info.static_detections.length == 1 && info.static_detections[0].id == '-101') {
                            window.location.replace("surveys")
                        }

                        if (clusterRequests[mapID].includes(parseInt(info.id))) {

                            for (let i=0;i<info.static_detections.length;i++) {
                                newcluster = info.static_detections[i];

                                if (((knockedTG!=null)&&(parseInt(newcluster.trapGroup)>0)&&(newcluster.trapGroup!=knockedTG))||(newcluster.id == '-101')) {
                                    knockedTG=null
                                }

                                if (((maskedTG!=null)&&(parseInt(newcluster.trapGroup)>0)&&(newcluster.trapGroup!=maskedTG))||(newcluster.id == '-101')) {
                                    maskedTG=null
                                }
                                
                                if (knockedTG==null && maskedTG==null) {
                                    if ((!clusterIdList.includes(newcluster.id))||(newcluster.id=='-101')) {
                                        clusterIdList.push(newcluster.id)

                                        if ((clusters[mapID].length>0)&&(clusters[mapID][clusters[mapID].length-1].id=='-101')&&(clusterIndex[mapID] < clusters[mapID].length-1)) {
                                            clusters[mapID].splice(clusters[mapID].length-1, 0, newcluster)
                                        } else {
                                            clusters[mapID].push(newcluster)
                                            staticCheckPage[newcluster.id].next_page = info.next_page
                                        }
                                        
                                        if (clusters[mapID].length-1 == clusterIndex[mapID]){
                                            update(mapID)
                                        } else if (knockWait == true) {
                                            if (modalWait2.is(':visible')) {
                                                modalWait2.modal('hide');
                                            }
                                            nextCluster()
                                        }
                                        preload()
                                        knockWait = false
                                    }
                                }
                            }

                            if (lastStaticGroup && clusters[mapID].length == staticgroupIDs.length) {
                                clusters[mapID].push({id: '-101'})
                            }
                            
                            var newDetections = info.staticgroup_detections
                            var group_keys = Object.keys(newDetections)
                            for (let i=0;i<group_keys.length;i++) {
                                detectionGroups[group_keys[i]] = newDetections[group_keys[i]]
                            }
                        }                
                    }
                };
            xhttp.open("GET", '/getStaticDetections/' + selectedSurvey + '/' + newID + '?staticgroup_id=' + staticgroupIDs[staticgroupReadAheadIndex++]);
            xhttp.send();
        }
    }
}


function handleStatic(staticCheck, mapID = 'map1') {
    /** Handles the user input of static or not - loading the next image with detection accordingly. */
    if (!modalActive && !modalActive2 && finishedDisplaying[mapID]) {
        if (staticCheck==1) {
            static_status = 'accept_static'
        } else {
            static_status = 'reject_static'
        }

        var formData = new FormData();
        formData.append('static_status', JSON.stringify(static_status));
        formData.append('survey_id', JSON.stringify(selectedSurvey));
        formData.append('staticgroup_id', JSON.stringify(clusters[mapID][clusterIndex[mapID]].id));
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapClusterIndex,wrapMapID){
            return function() {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                } else if (this.readyState == 4 && this.status == 200) {                    
                    response = JSON.parse(this.responseText);
                    clusters[wrapMapID][wrapClusterIndex].ready = true
                    // nextCluster(wrapMapID)
                }
            }
        }(clusterIndex[mapID],mapID);
        xhttp.open("POST", '/assignStatic');
        xhttp.send(formData);

        completed_staticgroups += 1
        updateProgBar([completed_staticgroups, total_staticgroups])
        nextCluster(mapID)
    }
}

function getStaticGroupIDs(mapID = 'map1'){
    /** Gets a list of cluster IDs to be explored for the current combination of task and label. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                clusters[mapID]=[]
                staticgroupReadAheadIndex = 0
                clusterIndex[mapID] = 0
                imageIndex[mapID] = 0
                staticgroupIDs = JSON.parse(this.responseText);
                total_staticgroups = staticgroupIDs.length
                completed_staticgroups = 0
                staticCheckPage = {}
                

                if (staticgroupIDs.length == 0) {
                    window.location.replace("surveys")
                }
                else if (staticgroupIDs.length == 1 && staticgroupIDs[0] == '-101') {
                    finishStaticDetectionCheck()
                }
                else{
                    for (let s=0;s<staticgroupIDs.length;s++){
                        staticCheckPage[staticgroupIDs[s]] = {'page': 1, 'next_page': null}
                    }

                    updateProgBar([completed_staticgroups, total_staticgroups])
                    for (let i=0;i<3;i++){
                        loadNewCluster()
                    }
                }
            }
        };
    xhttp.open("GET", '/getStaticGroupIDs/' + selectedSurvey);
    xhttp.send();
}

function undoStatic(mapID = 'map1') {
    /** Goes back to the previous cluster. */
    if (clusterIndex[mapID]>0 && finishedDisplaying[mapID] && !modalActive && !modalActive2) {
        completed_staticgroups -= 1
        updateProgBar([completed_staticgroups, total_staticgroups])
        prevCluster()
    }
}

btnDone.addEventListener('click', () => {
    /** Wraps up the user's session when they click the done button. */
    finishStaticDetectionCheck()
});

function finishStaticDetectionCheck() {
    /** Wraps up tha static detection check. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                window.location.replace("surveys")
            }
        };
    xhttp.open("GET", '/finishStaticDetectionCheck/' + selectedSurvey);
    xhttp.send();
}

function saveProgress() {
    /** Wraps up tha static detection check. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                window.location.replace("surveys")
            }
        };
    xhttp.open("GET", '/finishStaticDetectionCheck/' + selectedSurvey + '?save=true');
    xhttp.send();
}

function hideDetections(hide,mapID='map1') {
    /** Hides the detections on the map when hotkey is pressed. */
    if (finishedDisplaying[mapID] && !modalActive && !modalActive2){
        if (hide){
            addedDetections[mapID] = false
            drawnItems[mapID].clearLayers()
        }
        else{
            addedDetections[mapID] = false
            addDetections(mapID)
        }
    }
}

function nextPageStatic(page,mapID='map1') {
    /** Loads the next page of detections for the current static group. */

    if (page == null) {
        update(mapID)
    } else {
        staticgroup_id = clusters[mapID][clusterIndex[mapID]].id
        staticCheckPage[staticgroup_id].page = page

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 200) {
                    info = JSON.parse(this.responseText);
                    newClusters = info.static_detections
                    newDetections = info.staticgroup_detections
                    
                    if (newClusters.length > 0) {
                        staticCheckPage[newClusters[0].id].next_page = info.next_page
                    }

                    for (let i=0;i<newClusters.length;i++) {
                        newcluster = newClusters[i];
                        s_index = clusters[mapID].findIndex(x => x.id == newcluster.id)
                        if (s_index  != -1) {
                            new_image_index = clusters[mapID][s_index].images.length
                            clusters[mapID][s_index].images.push(...newcluster.images)
                            if (newcluster.images.length > 0) {
                                imageIndex[mapID] = new_image_index
                            }
                        }
                    }
                    
                    var group_keys = Object.keys(newDetections)
                    for (let i=0;i<group_keys.length;i++) {
                        detectionGroups[group_keys[i]].push(...newDetections[group_keys[i]])
                    }

                    update(mapID)
                    preload()
                }
            };
        xhttp.open("GET", '/getStaticDetections/' + selectedSurvey + '/0?staticgroup_id=' + staticgroup_id + '&page=' + page);
        xhttp.send();
    }
}

window.addEventListener('load', onload, false);