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

isTagging=true
isReviewing = false
isKnockdown = false
isBounding = false
isIDing = true
isStaticCheck = false
isTimestampCheck = false

var suggestions = []
var suggestionIndex = 0
var suggestionImageIndex = 0
var clusterIdList = []
// const modalNote = $('#modalNote');
const modalNextIndividual = $('#modalNextIndividual');
const modalAlertNextIndividual = $('#modalAlertNextIndividual');
const btnNoteRecon = document.querySelector('#btnNoteRecon');
const btnDuplicate = document.querySelector('#btnDuplicate');
var dbDetIds = {}
var toolTipsOpen = true
var popUpsOpen = true
var contextLocation

var globalIndividual = null
var globalTags = null
var deleteMode = false
var individualIndex = 0
var parentMode = false
var unidentifiableMode = false
var blockIndividualSubmit = false

var previousClick = null
var individuals = [{}]
var bufferedName = ''
var actions = []
var submittedResponse = false
var backIndex = 0

var DEBUGGING = false

const detection_flanks = ['Left','Right','Ambiguous']
var kpts_layer = {'map1':null,'map2':null}
var savedKpts = {}
var detection_zoom = {'map1':{},'map2':{}}
var fitBoundsInProcess = {'map1':false,'map2':false}
var defaultOpactity = 30
var defaultRadius = 15
var updatingFlank = false
var tabActiveIndividual = 'baseNewIndividualTab'
var next_known = null
var prev_know = null
var selectedKnownIndividual = null
var selectedKnownIndividualName = null
var siteCoords = {}
var knownIndividualsFilters = {'task': null, 'search': null, 'order': null, 'tags': null, 'page': null}
var imgMaps = {}
var imgMapsHeight = {}
var imgMapsWidth = {}
var imgMapsActiveImage = {}

function radians(degrees) {
    /** Converts desgres into radians. */
    return degrees * Math.PI / 180
}

function coordinateDistance(lat1,lon1,lat2,lon2) {
    /** Returns the distance (in km) between two coordinate points. */
    a = Math.pow(Math.sin(radians(lat2-lat1)/2),2) + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.pow(Math.sin(radians(lon2-lon1)/2),2)
	return 6371 * 2 * Math.atan2(Math.pow(a,0.5), Math.pow((1-a),0.5))
}

function idNextCluster() {
    /** Allocates a new individual to the individual for ID. */
    if ((!submittedResponse) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        // actions.push('n')
        // We don't want users to go back after beig allocated a new individual
        actions = []
        nextCluster()
    }
}

function acceptSuggestion() {
    /** Accepts the suggested individual, combining its images with the those of the user's allocated individual. */
    if ((!submittedResponse) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        submittedResponse = true
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                submittedResponse = false
                if (reply.status == 'success') {
                    actions.push([clusters['map1'][clusterIndex['map1']].id,clusters['map2'][clusterIndex['map2']].id])
                    updateProgBar(reply.progress)
                    getSuggestions()
                }
            }
        };
        xhttp.open("GET", '/acceptSuggestion/'+clusters['map1'][clusterIndex['map1']].id+'/'+clusters['map2'][clusterIndex['map2']].id);
        xhttp.send();
        if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
            waitModalID = clusters['map2'][clusterIndex['map2']]
            waitModalMap = 'map2'
            modalWait2Hide = false
            modalWait2.modal({backdrop: 'static', keyboard: false});
        }
        clusters['map1'][clusterIndex['map1']].images.push(...clusters['map2'][clusterIndex['map2']].images)
        sliderIndex['map1'] = '-1'
        savedKpts = {}
        update('map1')
    }
}

function suggestionUnidentifiable() {
    /** Marks the suggested individual as unidentifiable. */
    if ((!submittedResponse) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        submittedResponse = true
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                submittedResponse = false
                if (reply.status == 'success') {
                    actions.push([reply.id,clusters['map2'][clusterIndex['map2']].id])
                    prog_bar = document.getElementById('progress')
                    updateProgBar([prog_bar.ariaValueNow,prog_bar.ariaValueMax-1])
                    getSuggestions()
                }
            }
        };
        xhttp.open("GET", '/suggestionUnidentifiable/'+clusters['map2'][clusterIndex['map2']].id);
        xhttp.send();
        if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
            waitModalID = clusters['map2'][clusterIndex['map2']]
            waitModalMap = 'map2'
            modalWait2Hide = false
            modalWait2.modal({backdrop: 'static', keyboard: false});
        }
        savedKpts = {}
    }
}

function rejectSuggestion() {
    /** Marks the suggested individual as being different to the one currently allocated to the user. */
    if ((!submittedResponse) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        submittedResponse = true
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                submittedResponse = false
                if (reply.status == 'success') {
                    actions.push([clusters['map1'][clusterIndex['map1']].id,clusters['map2'][clusterIndex['map2']].id])
                    updateProgBar(reply.progress)
                    getSuggestions()
                }
            }
        };
        xhttp.open("GET", '/rejectSuggestion/'+clusters['map1'][clusterIndex['map1']].id+'/'+clusters['map2'][clusterIndex['map2']].id);
        xhttp.send();
        if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
            waitModalID = clusters['map2'][clusterIndex['map2']]
            waitModalMap = 'map2'
            modalWait2Hide = false
            modalWait2.modal({backdrop: 'static', keyboard: false});
        }
        savedKpts = {}
    }
}

function skipSuggestion() {
    /** Skips the current suggestion, leaving it to be examined at a later stage with hopefully more context. */
    if ((!submittedResponse) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        submittedResponse = true
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                submittedResponse = false
                if (reply.status == 'success') {
                    actions.push([clusters['map1'][clusterIndex['map1']].id,clusters['map2'][clusterIndex['map2']].id])
                    updateProgBar(reply.progress)
                    getSuggestions()
                }
            }
        };
        xhttp.open("GET", '/skipSuggestion/'+clusters['map1'][clusterIndex['map1']].id+'/'+clusters['map2'][clusterIndex['map2']].id);
        xhttp.send();
        if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
            waitModalID = clusters['map2'][clusterIndex['map2']]
            waitModalMap = 'map2'
            modalWait2Hide = false
            modalWait2.modal({backdrop: 'static', keyboard: false});
        }
        savedKpts = {}
    }
}

function undoPreviousSuggestion() {
    /** Undoes the previous individual ID action - accept/reject/skip/dissociate. */
    if ((actions.length > 0) && (!submittedResponse) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        submittedResponse = true
        previous = actions.pop()

        if (previous=='n') {
            // We don't want users to be able to go back after having been allocated a new individual
            // prevCluster()
            // getSuggestions()
            // submittedResponse = false
        } else if (previous[0]=='dissociation') {
            mapID = previous[3]
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function (wrapPrevious) {
                return function() {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);
                        submittedResponse = false
                        if (reply.status == 'success') {
                            mapID = wrapPrevious[3]
                            clusters[mapID][clusterIndex[mapID]].images.push(JSON.parse(JSON.stringify(wrapPrevious[2])))
                            sliderIndex[mapID] = '-1'
                            update(mapID)
                        } else {
                            actions = []
                            document.getElementById('modalAlertText').innerHTML = 'Cannot perform undo. You have reached the end of your buffer.'
                            if (modalWait2.is(':visible')) {
                                modalWait2Hide = true
                                modalWait2.modal('hide');
                            }
                            modalAlert.modal({keyboard: true});
                        }
                    }
                }
            }(previous);
            xhttp.open("GET", '/reAssociateDetection/'+previous[1]+'/'+previous[4]);
            xhttp.send();

            if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                waitModalID = clusters['map2'][clusterIndex['map2']]
                waitModalMap = 'map2'
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
        } else {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function (wrapID1,wrapID2) {
                return function() {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);
                        submittedResponse = false
                        if (reply.status == 'success') {
                            if ((wrapID1 != clusters['map1'][clusterIndex['map1']].id)&&((clusterIndex['map1']-1)>=0)&&(wrapID1 == clusters['map1'][clusterIndex['map1']-1].id)) {
                                prevCluster()
                            }

                            if (clusters['map1'][clusterIndex['map1']].id == parseInt(reply.id)) {
                                sliderIndex['map1'] = '-1'
                                clusters['map1'][clusterIndex['map1']].images = reply.images
                                update('map1')
                            }

                            updateProgBar(reply.progress)
                            getSuggestions(wrapID2)
                            
                        } else {
                            actions = []
                            document.getElementById('modalAlertText').innerHTML = 'Cannot perform undo. You have reached the end of your buffer.'
                            modalAlert.modal({keyboard: true});
                        }
                    }
                }
            }(previous[0],previous[1]);
            xhttp.open("GET", '/undoPreviousSuggestion/'+previous[0]+'/'+previous[1]);
            xhttp.send();

            if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                waitModalID = clusters['map2'][clusterIndex['map2']]
                waitModalMap = 'map2'
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
        }
    }
}

function goToMax() {
    /** Focuses on the pair of images with the greates similarity score. */
    maximums = clusters['map2'][clusterIndex['map2']].max_pair
    for (let i=0;i<clusters['map1'][clusterIndex['map1']].images.length;i++) {
        if (maximums.includes(clusters['map1'][clusterIndex['map1']].images[i].detections[0].id)) {
            clusterPositionSplide['map1'].go(i)
            imageIndex['map1'] = i
            update('map1')
            break
        }
    }
    for (let i=0;i<clusters['map2'][clusterIndex['map2']].images.length;i++) {
        if (maximums.includes(clusters['map2'][clusterIndex['map2']].images[i].detections[0].id)) {
            clusterPositionSplide['map2'].go(i)
            imageIndex['map2'] = i
            update('map2')
            break
        }
    }
}

function getSuggestions(prevID = null) {
    /** Gets suggested matches for the user's individual. In the case of cluster ID, just duplicates the individual in the second panel. */
    imageIndex['map2'] = 0
    clusterIndex['map2'] = 0

    if (document.getElementById('btnSendToBack')!=null) {
        if (clusterIndex['map1']<clusters['map1'].length) {
            clusters['map2'] = [clusters['map1'][clusterIndex['map1']]]
        } else {
            index = clusters['map1'].length - 1
            clusters['map2'] = [clusters['map1'][index]]
        }
        if (!('map2' in clusterPosition)) {
            clusterPosition["map2"] = document.getElementById('clusterPositionSplide2')
        }
        sliderIndex['map2'] = '-1'
        update('map2')
    } else {
        if ((typeof clusters['map1'][clusterIndex['map1']] != 'undefined')&&(!['-101','-99','-782'].includes(clusters['map1'][clusterIndex['map1']].id))) {

            if (prevID != null) {
                request = '/getSuggestion/'+clusters['map1'][clusterIndex['map1']].id+'?suggestion='+prevID
            } else {
                request = '/getSuggestion/'+clusters['map1'][clusterIndex['map1']].id
            }

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        info = JSON.parse(this.responseText);
                        if (info.id == '-876') {
                            modalWait2Hide = true
                            modalWait2.modal('hide');
                            modalNextIndividual.modal({keyboard: true});
                        } else {
                            clusters['map2'] = [info]
                            if ('detsim' in info) {
                                DEBUGGING = true
                            }
                            sliderIndex['map2'] = '-1'
                            if (!('map2' in clusterPosition)) {
                                clusterPosition["map2"] = document.getElementById('clusterPositionSplide2')
                            }
                            update('map2')
                            goToMax()
                            updateKpts()
                            
                            individualDistance = document.getElementById('individualDistance')
                            if (individualDistance != null) {
                                var minDistances = []
                                for (let i=0;i<clusters['map2'][clusterIndex['map2']].images.length;i++) {
                                    for (let j=0;j<clusters['map1'][clusterIndex['map1']].images.length;j++) {
                                        lat1 = clusters['map1'][clusterIndex['map1']].images[j].latitude
                                        lon1 = clusters['map1'][clusterIndex['map1']].images[j].longitude
                                        lat2 = clusters['map2'][clusterIndex['map2']].images[i].latitude
                                        lon2 = clusters['map2'][clusterIndex['map2']].images[i].longitude
                                        distance = coordinateDistance(lat1,lon1,lat2,lon2)
                                        minDistances.push(distance)
                                    }
                                }
                                minDistance = Math.min(...minDistances)
                                if (minDistance<1) {
                                    individualDistance.innerHTML = 'Individual distance: '+Math.floor(minDistance*1000).toString()+'m'
                                } else {
                                    individualDistance.innerHTML = 'Individual distance: '+minDistance.toFixed(3)+'km'
                                }
                            }
                        }
                    }
                };
            xhttp.open("GET", request);
            xhttp.send();
        }
    }
}

function loadNewCluster(mapID = 'map1') {
    /** Loads new individuals for the left-hand panel. Treats an individual as a cluster of images. */
    if (!waitingForClusters[mapID]) {
        waitingForClusters[mapID] = true
        // console.log(mapID)
        var newID = Math.floor(Math.random() * 100000) + 1;
        clusterRequests[mapID].push(newID)

        if (!batchComplete) {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
                function (wrapMapID) {
                    return function() {
                        if (this.readyState == 4 && this.status == 278) {
                            window.location.replace(JSON.parse(this.responseText)['redirect'])
                        } else if (this.readyState == 4 && this.status == 200) {
                            waitingForClusters[wrapMapID] = false
                            info = JSON.parse(this.responseText);
                            // console.log(info)
                            var new_clusters = []
                            var new_cluster_index = 0
                            var new_cluster_ids = {}
                            if (info.info.length>0) {
                                if (document.getElementById('btnSendToBack')!=null) {
                                    //Order the clusters in info by timestamp of the first image
                                    info.info.sort((a,b) => (a.images[0].timestamp > b.images[0].timestamp) ? 1 : ((b.images[0].timestamp > a.images[0].timestamp) ? -1 : 0))
                                    for (let j=0;j<info.info[0].images.length;j++) {
                                        info.info[0].images[j].cluster_id = info.info[0].id
                                    }
                                }
                                new_clusters = [info.info[0]]
                                new_cluster_ids[info.info[0].id] = [info.info[0].id]
                                new_cluster_index = 1

                                for (let i=1;i<info.info.length;i++) {
                                    if (document.getElementById('btnSendToBack')==null) {
                                        new_clusters.push(info.info[i])
                                        new_cluster_index += 1
                                        new_cluster_ids[info.info[i].id] = [info.info[i].id]
                                    }
                                    else{
                                        if (info.info[i].id == '-101') {
                                            new_clusters.push(info.info[i])
                                            new_cluster_index += 1
                                        }
                                        else{
                                            current_timestamp = new_clusters[new_cluster_index-1].images[new_clusters[new_cluster_index-1].images.length-1].timestamp
                                            new_timestamp = info.info[i].images[0].timestamp
                                            // If timestamp is within 30 minutes of the previous cluster, add to the same cluster
                                            allow_merge = (new_timestamp==0 || current_timestamp==0) ? false : true
                                            time_diff = new_timestamp-current_timestamp
                                            if (allow_merge && time_diff < 1800) {
                                                for (let j=0;j<info.info[i].images.length;j++) {
                                                    info.info[i].images[j].cluster_id = info.info[i].id
                                                    new_clusters[new_cluster_index-1].images.push(info.info[i].images[j])
                                                }
                                                if (info.info[i].notes != null) {
                                                    if (new_clusters[new_cluster_index-1].notes != null) {
                                                        new_clusters[new_cluster_index-1].notes += ' '+info.info[i].notes
                                                    }
                                                    else{
                                                        new_clusters[new_cluster_index-1].notes = info.info[i].notes
                                                    }
                                                }
                                                new_clusters[new_cluster_index-1].tag_ids.push(...info.info[i].tag_ids)
                                                new_clusters[new_cluster_index-1].tags.push(...info.info[i].tags)
                                                new_clusters[new_cluster_index-1].tag_ids = [...new Set(new_clusters[new_cluster_index-1].tag_ids)]
                                                new_clusters[new_cluster_index-1].tags = [...new Set(new_clusters[new_cluster_index-1].tags)]
                                                new_cluster_ids[new_clusters[new_cluster_index-1].id].push(info.info[i].id)
                                            }
                                            else{
                                                for (let j=0;j<info.info[i].images.length;j++) {
                                                    info.info[i].images[j].cluster_id = info.info[i].id
                                                }
                                                new_clusters.push(info.info[i])
                                                new_cluster_index += 1
                                                new_cluster_ids[info.info[i].id] = [info.info[i].id]
                                            }
                                        }
                                    }
                                }
                            }
            
                            if (clusterRequests[wrapMapID].includes(parseInt(info.id))) {
                                for (let i=0;i<new_clusters.length;i++) {
                                    newcluster = new_clusters[i]

                                    if((newcluster.id == '-101') && (document.getElementById('btnSendToBack')==null)){
                                        idIndiv101 = true
                                        modalAlertNextIndividual.modal({keyboard: true});
                                    }
                                    else{
                                        idIndiv101 = false
                                        if (((knockedTG!=null)&&(parseInt(newcluster.trapGroup)>0)&&(newcluster.trapGroup!=knockedTG))||(newcluster.id == '-101')) {
                                            knockedTG=null
                                        }

                                        if(((maskedTG!=null)&&(parseInt(newcluster.trapGroup)>0)&&(newcluster.trapGroup==maskedTG))||(newcluster.id == '-101')) {
                                            maskedTG=null
                                        }
                                        
                                        if (knockedTG==null && maskedTG==null) {
                                            if (true) { //(!clusterIdList.includes(newcluster.id))||(newcluster.id=='-101')
                                                clusterIdList.push(...new_cluster_ids[newcluster.id])
    
                                                if ((clusters[wrapMapID].length>0)&&(clusters[wrapMapID][clusters[wrapMapID].length-1].id=='-101')&&(clusterIndex[wrapMapID] < clusters[wrapMapID].length-1)) {
                                                    clusters[wrapMapID].splice(clusters[wrapMapID].length-1, 0, newcluster)
                                                } else {
                                                    clusters[wrapMapID].push(newcluster)
                                                }
                                                
                                                if (clusters[wrapMapID].length-1 == clusterIndex[wrapMapID]){
                                                    update(wrapMapID)
    
                                                    if ((mapID == 'map1')&&(mapdiv2 != null)) {
                                                        getSuggestions()
                                                    }
                                        
                                                    if (document.getElementById('btnSendToBack')!=null) {
                                                        individuals = [{}]
                                                        individualIndex = 0
                                                        for (let colour in colours) {
                                                            colours[colour] = false
                                                        }
                                                        buildIndividualsObject()
                                                    } else {
                                                        updateProgress()
                                                    }
    
                                                } else if (knockWait == true) {
                                                    if (modalWait2.is(':visible')) {
                                                        modalWait2Hide = true
                                                        modalWait2.modal('hide');
                                                    }
                                                    nextCluster(wrapMapID)
                                                }
                                                preload(wrapMapID)
                                                knockWait = false
                                            }
                                        }
                                    
                                    }
                                }
                            }                
                        }
                    }
                }(mapID);
            xhttp.open("POST", '/getCluster?task='+selectedTask+'&reqId='+newID);
            xhttp.send();
        }
    }
}

function nextIndividual() {
    /** Handles the selection to move onto the next individual when the user has exhausted all suggestions for their current individual. */
    modalNextIndividual.modal('hide');
    modalActive = false
    nextCluster()
}

function idKeys(key) {
    /** Sets up the hotkeys for the individual ID tasks. */
    if (document.getElementById('btnSendToBack')!=null) {
        if (modalNewIndividual.is(':visible')) {
            if (['escape','enter'].includes(key)) {
                switch (key){
                    case 'escape': cancelIndividual()
                        break;
                    case 'enter': 
                        if (document.getElementById('btnSubmitIndividual').disabled == false) {
                            submitIndividual()
                        }
                        break;
                }
            } else {
                if ((document.activeElement != document.getElementById('newIndividualName')) && (document.activeElement != document.getElementById('notebox'))) { // disable hotkeys while typing
                    for (let i=0;i<globalTags.length;i++) {
                        if (globalTags[i].hotkey == key) {
                            box = document.getElementById(globalTags[i].tag+'box')
                            if (box.checked) {
                                box.checked = false
                            } else {
                                box.checked = true
                            }
                        }
                    }
                }
            }
        } else if (modalNoteRecon.is(':visible')||modalDuplicate.is(':visible')) {
            // allow for typing
        } else {
            switch (key){
                case 'arrowleft': prevImage('map2')
                    break;
                case 'arrowright': nextImage('map2')
                    break;
                case 'a': prevImage('map1')
                    break;
                case 'd': nextImage('map1')
                    break;
                case ' ': 
                    if (backIndex > 0) {
                        submitIndividuals()
                    }
                    break;
                case 'u': undo()
                    break;
                case 'e': deleteIndividualPress()
                    break;
                case 'b': sendToBack()
                    break;
                case 'p': activateParent()
                    break;
                case 'i': activateUnidentifiable()
                    break;
                case 'h': hideBoundingLabels()
                    break;
                case 'n': createSingleIndividual()
                    break;
                case '`': 
                case '~':
                    prevCluster()
                    break;
            }
        }
    } else {
        switch (key){
            case 'arrowleft': prevImage('map2')
                break;
            case 'arrowright': nextImage('map2')
                break;
            case 'a': prevImage('map1')
                break;
            case 'd': nextImage('map1')
                break;
            case 'r': rejectSuggestion()
                break;
            case ' ': acceptSuggestion()
                break;
            case 's': skipSuggestion()
                break;
            case 'u': suggestionUnidentifiable()
                break;
            case '`':
            case '~':
                undoPreviousSuggestion()
                break;
            case 'n': idNextCluster()
                break;
            case 'h': document.getElementById('cxFeaturesHeatmap').click()
                break;
        }
    }
}

function generateName() {
    /** Returns a unique name for the new individual. */
    blockIndividualSubmit = true
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            uniqueName = JSON.parse(this.responseText);
            for (let individualID in individuals[individualIndex]) {
                if (uniqueName == individuals[individualIndex][individualID].name) {
                    uniqueName = String(Object.keys(individuals[individualIndex]).length+parseInt(uniqueName)-1)
                    break
                }
            }
            document.getElementById('newIndividualName').value = uniqueName
            blockIndividualSubmit = false
        }
    }
    xhttp.open("GET", '/getUniqueName');
    xhttp.send();
    return true
}

function prepIndividualModal() {
    /** Initialises the new individal modal. */
    document.getElementById('newIndividualName').value = ''
    document.getElementById('notebox').value = ''
    generateName()

    if (globalTags.length>0) {
        characteristicsDiv = document.getElementById('characteristicsDiv')
        while(characteristicsDiv.firstChild){
            characteristicsDiv.removeChild(characteristicsDiv.firstChild);
        }

        h5 = document.createElement('h5')
        h5.setAttribute('style','margin-bottom: 2px')
        h5.innerHTML = 'Characteristics'
        characteristicsDiv.appendChild(h5)

        div = document.createElement('div')
        div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        div.innerHTML = '<i>Select the applicable characteristics for this individual.</i>'
        characteristicsDiv.appendChild(div)
    
        for (let i=0;i<globalTags.length;i++) {
            tag = globalTags[i].tag
            hotkey = globalTags[i].hotkey
    
            checkDiv = document.createElement('div')
            checkDiv.setAttribute('class','custom-control custom-checkbox')
            characteristicsDiv.appendChild(checkDiv)
    
            input = document.createElement('input')
            input.setAttribute('type','checkbox')
            input.classList.add('custom-control-input')
            input.setAttribute('id',tag+'box')
            input.setAttribute('name',tag+'box')
            checkDiv.appendChild(input)
    
            label = document.createElement('label')
            label.classList.add('custom-control-label')
            label.setAttribute('for',tag+'box')
            label.innerHTML = tag
            checkDiv.appendChild(label)
        }

        characteristicsDiv.appendChild(document.createElement('br'))
    }

    document.getElementById('newIndividualErrors').innerHTML = ''
    modalNewIndividual.modal({backdrop: 'static', keyboard: false});
    document.getElementById('openNewIndivTab').click()
}


function buildIndividuals() {
    /** Builds the individuals' bounding boxes in the currently-viewed images. */

    // Clear all
    for (let mapID in dbDetIds) {
        if (mapID == 'known'){
            continue
        }
        for (let leafletID in dbDetIds[mapID]) {
            // drawnItems[mapID]._layers[leafletID].unbindTooltip()
            drawnItems[mapID]._layers[leafletID].unbindPopup()
            drawnItems[mapID]._layers[leafletID].setStyle({color: "rgba(223,105,26,1)"})
        }

        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
            for (let n=0;n<clusters[mapID][clusterIndex[mapID]].images[i].detections.length;n++) {
                clusters[mapID][clusterIndex[mapID]].images[i].detections[n].individual = '-1'
            }
        }
    }

    for (let individualID in individuals[individualIndex]) {
        colour = individuals[individualIndex][individualID].colour
        individualName = individuals[individualIndex][individualID].name

        // Tooltips and recolour
        for (let mapID in dbDetIds) {
            if (mapID == 'known'){
                continue
            }
            for (let leafletID in dbDetIds[mapID]) {
                if (individuals[individualIndex][individualID].detections.includes(parseInt(dbDetIds[mapID][leafletID]))) {

                    // drawnItems[mapID]._layers[leafletID].bindTooltip(individualName,{permanent: true, direction:"center"})
                    // var center = L.latLng([(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat)/2,(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng)/2])
                    // var bottom = L.latLng([drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat,(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng)/2])
                    // var centerPoint = map[mapID].latLngToContainerPoint(center)
                    // var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
                    // var offset = [0,centerPoint.y-bottomPoint.y]
                    // drawnItems[mapID]._layers[leafletID]._tooltip.options.offset = offset
                    // drawnItems[mapID]._layers[leafletID]._tooltip.options.opacity = 0.8
                    // drawnItems[mapID]._layers[leafletID].openTooltip()
                    // if (!toolTipsOpen) {
                    //     rect.closeTooltip()
                    // }

                    drawnItems[mapID]._layers[leafletID].setStyle({color: colour})
                    drawnItems[mapID]._layers[leafletID].bindPopup(individualName, {closeButton: false, autoClose: false, closeOnClick: false, autoPan: false, minWidth: 0})
                    drawnItems[mapID]._layers[leafletID].on('mouseover', function (e) {
                        this.openPopup();
                    });
                    drawnItems[mapID]._layers[leafletID].on('mouseout', function (e) {
                        this.closePopup();
                    });

                    var center = L.latLng([(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat)/2,(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng)/2])
                    var top = L.latLng([drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat,(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng)/2])
                    var centerPoint = map[mapID].latLngToContainerPoint(center)
                    var topPoint = map[mapID].latLngToContainerPoint(top)
                    var offset = [0,topPoint.y-centerPoint.y]

                    // If the popup is too close to the top of the map, move it down
                    if (drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat >= map[mapID].getBounds().getNorth()-15) {
                        offset = [0, 0]
                    }

                    drawnItems[mapID]._layers[leafletID]._popup.options.offset = offset

                    if (!popUpsOpen) {
                        drawnItems[mapID]._layers[leafletID].closePopup()
                    }
                }
            }
        }

        // Set in pools
        for (let mapID in clusters) {
            if (mapID == 'known'){
                continue
            }
            for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
                for (let n=0;n<clusters[mapID][clusterIndex[mapID]].images[i].detections.length;n++) {
                    if (individuals[individualIndex][individualID].detections.includes(clusters[mapID][clusterIndex[mapID]].images[i].detections[n].id)) {
                        clusters[mapID][clusterIndex[mapID]].images[i].detections[n].individual = individualID
                    }
                }
            }   
        }
    }

    // If finished and not on an undo: auto-submit
    if (backIndex==0) {
        allow = true
        for (let tempMapID in clusters) {
            if (tempMapID == 'known'){
                continue
            }
            for (let i=0;i<clusters[tempMapID][clusterIndex[tempMapID]].images.length;i++) {
                for (let n=0;n<clusters[tempMapID][clusterIndex[tempMapID]].images[i].detections.length;n++) {
                    if (clusters[tempMapID][clusterIndex[tempMapID]].images[i].detections[n].individual=='-1') {
                        allow = false
                    }
                }
            }   
        }
        if (allow&&individualsReady) {
            submitIndividuals()
        }
    }
}

function buildIndividualsObject() {
    /** Builds the individuals object that contains all required info for the current clusters. */
    individualsReady = false
    for (let mapID in clusters) {
        if (mapID == 'known'){
            continue
        }
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
            for (let n=0;n<clusters[mapID][clusterIndex[mapID]].images[i].detections.length;n++) {
                individualID = clusters[mapID][clusterIndex[mapID]].images[i].detections[n].individual
                if ((individualID!='-1') && ((typeof(individualID)=='string')&&(!individualID.includes('n')) )) {
                    if (!(individualID in individuals[individualIndex])) {

                        for (var colour in colours) {
                            if (colours[colour]==false) {
                                colours[colour] = true
                                break
                            }
                        }
                        individuals[individualIndex][individualID] = {"colour": colour, "detections": [clusters[mapID][clusterIndex[mapID]].images[i].detections[n].id], "images": [clusters[mapID][clusterIndex[mapID]].images[i].id]}

                        var xhttp = new XMLHttpRequest();
                        xhttp.onreadystatechange =
                            function () {
                                if (this.readyState == 4 && this.status == 278) {
                                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                                } else if (this.readyState == 4 && this.status == 200) {
                                    info = JSON.parse(this.responseText);

                                    individuals[individualIndex][info.id]['tags'] = info.tags
                                    individuals[individualIndex][info.id]['name'] = info.name
                                    individuals[individualIndex][info.id]['notes'] = info.notes
                                    individuals[individualIndex][info.id]['children'] = info.children
                                    individuals[individualIndex][info.id]['family'] = info.family
                                    individuals[individualIndex][info.id]['known'] = 'false'
                                    if (info.surveys.length>1) {
                                        individuals[individualIndex][info.id]['known'] = 'true'
                                    }
                                    buildIndividuals()

                                    stat = true
                                    for (let individualID in individuals[individualIndex]) {
                                        if (!('name' in individuals[individualIndex][individualID])) {
                                            stat = false
                                        }
                                    }
                                    individualsReady = stat
                                }
                            };
                        xhttp.open("GET", '/getIndividualInfo/'+individualID);
                        xhttp.send();

                    } else {
                        individuals[individualIndex][individualID].detections.push(clusters[mapID][clusterIndex[mapID]].images[i].detections[n].id)
                        individuals[individualIndex][individualID].detections = [...new Set(individuals[individualIndex][individualID].detections)]

                        individuals[individualIndex][individualID].images.push(clusters[mapID][clusterIndex[mapID]].images[i].id)
                        individuals[individualIndex][individualID].images = [...new Set(individuals[individualIndex][individualID].images)]
                    }
                }
            }
        }
    }

    stat = true
    for (let individualID in individuals[individualIndex]) {
        if (!('name' in individuals[individualIndex][individualID])) {
            stat = false
        }
    }
    individualsReady = stat
}

function createSingleIndividual() {
    /** Creates a new single individual for all of the detections in the cluster. */

    // Only if there is a single detection in the cluster
    if ((finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false) && (!['-101','-99','-782'].includes(clusters['map1'][clusterIndex['map1']].id))) {
        
        allow = true
        for (let i=0;i<clusters['map1'][clusterIndex['map1']].images.length;i++) {
            if (clusters['map1'][clusterIndex['map1']].images[i].detections.length > 1) {
                allow = false
            }
        }

        if (allow) {
            if (Object.keys(individuals[individualIndex]).length==0) {
                newSet = {}

                for (let i=0;i<clusters['map1'][clusterIndex['map1']].images.length;i++) {
                    if (clusters['map1'][clusterIndex['map1']].images[i].detections.length >= 1) {
                        newID = 'n' + clusters['map1'][clusterIndex['map1']].images[i].detections[0].id.toString()
                        break
                    }
                }
                
                for (var colour in colours) {
                    if (colours[colour]==false) {
                        colours[colour] = true
                        break
                    }
                }

                detIdList=[]
                imIdList=[]
                for (let i=0;i<clusters['map1'][clusterIndex['map1']].images.length;i++) {
                    imIdList.push(clusters['map1'][clusterIndex['map1']].images[i].id)
                    for (let n=0;n<clusters['map1'][clusterIndex['map1']].images[i].detections.length;n++) {
                        detIdList.push(clusters['map1'][clusterIndex['map1']].images[i].detections[n].id)
                    }
                }
    
                newSet[newID] = {"colour": colour, "detections": detIdList, "images": imIdList, "children": [], "family": []}
                globalIndividual = newID
                individuals.push(newSet)
                individualIndex += 1
    
                if (globalTags==null) {
                    var xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange =
                        function () {
                            if (this.readyState == 4 && this.status == 278) {
                                window.location.replace(JSON.parse(this.responseText)['redirect'])
                            } else if (this.readyState == 4 && this.status == 200) {
                                globalTags = JSON.parse(this.responseText);
                                prepIndividualModal()
                            }
                        };
                    xhttp.open("GET", '/prepNewIndividual');
                    xhttp.send();
                } else {
                    prepIndividualModal()
                }
            }
        }
    }
}

function undo() {
    /** Undoes the previous cluster-ID action. */
    if (individualIndex >= 1) {
        individuals.pop()
        individualIndex -= 1
        buildIndividuals()
    } else {
        individuals = [{}]
        individualIndex = 0
        for (let colour in colours) {
            colours[colour] = false
        }
        buildIndividuals()
    }
}

function sendToBack() {
    /** Activates 'send to back' mode. */
    if ((parentMode==false)&&(unidentifiableMode==false)&&(deleteMode==false)) {
        if (previousClick != null) {
            if (previousClick.individual != '-1') {
                colour = individuals[individualIndex][previousClick.individual].colour
            } else {
                colour = "rgba(223,105,26,1)"
            }
            previousClick.rect.setStyle({color: colour}); //un-highlight old selection
        }
        previousClick = null
        if (sendBackMode) {
            sendBackMode = false
            document.getElementById('btnSendToBack').setAttribute('class','btn btn-primary btn-block')
            document.getElementById('btnSendToBack').innerHTML = 'Send to (B)ack'  
        } else {
            sendBackMode = true
            document.getElementById('btnSendToBack').setAttribute('class','btn btn-danger btn-block')
            document.getElementById('btnSendToBack').innerHTML = 'Cancel'
        }   
    }
}

function activateParent() {
    /** Activates parent mode. */
    if ((sendBackMode==false)&&(unidentifiableMode==false)&&(deleteMode==false)) {
        if (parentMode) {
            parentMode = false
            document.getElementById('btnParent').setAttribute('class','btn btn-primary btn-block')
            document.getElementById('btnParent').innerHTML = '(P)arent'
        } else {
            parentMode = true
            document.getElementById('btnParent').setAttribute('class','btn btn-danger btn-block')
            document.getElementById('btnParent').innerHTML = 'Cancel'
        }   
    }
}

function activateUnidentifiable() {
    /** Activates unidentifiable mode. */
    if ((finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false) && (!['-101','-99','-782'].includes(clusters['map1'][clusterIndex['map1']].id))) {
        if ((sendBackMode==false)&&(parentMode==false)&&(deleteMode==false)) {
            if (previousClick != null) {
                if (previousClick.individual != '-1') {
                    colour = individuals[individualIndex][previousClick.individual].colour
                } else {
                    colour = "rgba(223,105,26,1)"
                }
                previousClick.rect.setStyle({color: colour}); //un-highlight old selection
            }
            previousClick = null
            if (unidentifiableMode) {
                unidentifiableMode = false
                document.getElementById('btnUnidentifiable').setAttribute('class','btn btn-primary btn-block')
                document.getElementById('btnUnidentifiable').innerHTML = 'Un(i)dentifiable'
            } else {
                // if only one, then mark it as unidentifiable
                detCount = 0
                if (Object.keys(individuals[individualIndex]).length==0) {
                    for (let i=0;i<clusters['map1'][clusterIndex['map1']].images.length;i++) {
                        for (let n=0;n<clusters['map1'][clusterIndex['map1']].images[i].detections.length;n++) {
                            detCount += 1
                            imID = clusters['map1'][clusterIndex['map1']].images[i].id
                            detID = clusters['map1'][clusterIndex['map1']].images[i].detections[n].id
                        }
                    }
                }
                if ((detCount==1)&&(Object.keys(individuals[individualIndex]).length==0)) {
                    newSet = {}
        
                    newID = 'n' + detID.toString()
                    for (var colour in colours) {
                        if (colours[colour]==false) {
                            colours[colour] = true
                            break
                        }
                    }
        
                    newSet[newID] = {"name": "unidentifiable", "tags": [], "notes": "", "colour": colour, "detections": [detID], "images": [imID], "children": [], "family": []}
                    individuals.push(newSet)
                    individualIndex += 1
                    buildIndividuals()
                } else {
                    unidentifiableMode = true
                    document.getElementById('btnUnidentifiable').setAttribute('class','btn btn-danger btn-block')
                    document.getElementById('btnUnidentifiable').innerHTML = 'Cancel'
                }
            }   
        }
    }
}

function deleteIndividualPress() {
    /** Activates delete-individual mode. */
    if ((sendBackMode==false)&&(parentMode==false)&&(unidentifiableMode==false)) {
        if (previousClick != null) {
            if (previousClick.individual != '-1') {
                colour = individuals[individualIndex][previousClick.individual].colour
            } else {
                colour = "rgba(223,105,26,1)"
            }
            previousClick.rect.setStyle({color: colour}); //un-highlight old selection
        }
        previousClick = null
        if (deleteMode) {
            deleteMode = false
            document.getElementById('btnDeleteIndividual').setAttribute('class','btn btn-primary btn-block')
            document.getElementById('btnDeleteIndividual').innerHTML = 'D(e)lete'
        } else {
            deleteMode = true
            document.getElementById('btnDeleteIndividual').setAttribute('class','btn btn-danger btn-block')
            document.getElementById('btnDeleteIndividual').innerHTML = 'Cancel'
        }   
    }
}

function submitIndividuals() {
    /** Submits all current individuals in the cluster for cluster ID. */
    if ((finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        allow = true
        for (let tempMapID in clusters) {
            if (tempMapID == 'known'){
                continue
            }
            for (let i=0;i<clusters[tempMapID][clusterIndex[tempMapID]].images.length;i++) {
                for (let n=0;n<clusters[tempMapID][clusterIndex[tempMapID]].images[i].detections.length;n++) {
                    if (clusters[tempMapID][clusterIndex[tempMapID]].images[i].detections[n].individual=='-1') {
                        allow = false
                    }
                }
            }   
        }
    
        if (!allow) {
            document.getElementById('modalAlertText').innerHTML = 'There are unidentified individuals remaining.'
            modalAlert.modal({keyboard: true});
        } else if (!individualsReady) {
            allow = false
            document.getElementById('modalAlertText').innerHTML = 'Please be patient.'
            modalAlert.modal({keyboard: true});
        }
    
        if (allow) {
            previousClick = null
            var formData = new FormData()
            formData.append("individuals", JSON.stringify(individuals[individualIndex]))

            if (backIndex>0) {
                backIndex -= 1
            }

            if (backIndex==0) {
                document.getElementById('btnNextCluster').hidden = true
            }
        
            var xhttp = new XMLHttpRequest();
            xhttp.open("POST", '/submitIndividuals');
            xhttp.onreadystatechange =
            function(wrapIndex){
                return function() {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);  
                        if (reply.status=='success') {
                            nextCluster()
                            translations = reply.translations
        
                            for (let i=0;i<clusters['map1'][wrapIndex].images.length;i++) {
                                for (let n=0;n<clusters['map1'][wrapIndex].images[i].detections.length;n++) {
                                    clusters['map1'][wrapIndex].images[i].detections[n].individual = translations[clusters['map1'][wrapIndex].images[i].detections[n].individual]
                                }
                            }
        
                            clusters['map1'][wrapIndex].ready = true
                            updateProgBar(reply.progress)
                        } else {
                            modalDuplicateDiv = document.getElementById('modalDuplicateDiv')
    
                            while(modalDuplicateDiv.firstChild){
                                modalDuplicateDiv.removeChild(modalDuplicateDiv.firstChild);
                            }
    
                            for (let i=0;i<reply.data.length;i++) {
                                row = document.createElement('div')
                                row.classList.add('row')
                                modalDuplicateDiv.appendChild(row)
    
                                col = document.createElement('div')
                                col.classList.add('col-lg-8')
                                row.appendChild(col)
    
                                input = document.createElement('input')
                                input.setAttribute('type','text')
                                input.setAttribute('class','form-control')
                                input.setAttribute('id',reply.data[i])
                                input.value = reply.data[i]
                                input.required = true
                                col.appendChild(input)
    
                                modalDuplicateDiv.appendChild(document.createElement('br'))
                            }
                            modalWait2Hide = true
                            modalWait2.modal('hide')
                            modalDuplicate.modal({backdrop: 'static', keyboard: false})
                        }
                    }
                }
            }(clusterIndex['map1'])
            xhttp.send(formData);
            clusters['map1'][clusterIndex['map1']].ready = false
            if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                waitModalID = clusters['map2'][clusterIndex['map2']]
                waitModalMap = 'map2'
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
        }
    }
}

function submitIndividual(){
    /** Submits the new-individual modal, adding the individual to the individuals object for the cluster, and building the bounding boxes. */
    if (!blockIndividualSubmit) {
        if (!['','dummy','unidentifiable'].includes(document.getElementById('newIndividualName').value.toLowerCase())) {
            document.getElementById('newIndividualErrors').innerHTML = ''
            tags = []
            for (let i=0;i<globalTags.length;i++) {
                box = document.getElementById(globalTags[i].tag+'box')
                if (box.checked) {
                    tags.push(globalTags[i].tag)
                }
            }
            individuals[individualIndex][globalIndividual]['tags'] = tags
            individuals[individualIndex][globalIndividual]['name'] = document.getElementById('newIndividualName').value
            individuals[individualIndex][globalIndividual]['notes'] = document.getElementById('notebox').value
            individuals[individualIndex][globalIndividual]['known'] = 'false'
            buildIndividuals()
            modalNewIndividual.modal('hide');
        } else {
            document.getElementById('newIndividualErrors').innerHTML = 'That is a reserved name. Please choose another.'
        }
    }
}

function submitKnownIndividual() {
    /** Submits the new-individual modal, adding the individual to the individuals object for the cluster, and building the bounding boxes. */
    if (!blockIndividualSubmit && selectedKnownIndividual != null) {

        document.getElementById('knownIndividualErrors').innerHTML = ''

        individuals[individualIndex][selectedKnownIndividual] = individuals[individualIndex][globalIndividual]
        delete individuals[individualIndex][globalIndividual]
        globalIndividual = selectedKnownIndividual
        individuals[individualIndex][globalIndividual]['known'] = 'true'
        individuals[individualIndex][globalIndividual]['id'] = selectedKnownIndividual
        individuals[individualIndex][globalIndividual]['name'] = selectedKnownIndividualName
        individuals[individualIndex][globalIndividual]['notes'] = document.getElementById('knownNotebox').value

        var tags = []
        var allCbx = document.querySelectorAll('[id^="Cbx_"]')
        for (var i = 0; i < allCbx.length; i++) {
            if (allCbx[i].checked) {
                tags.push(allCbx[i].id.replace('Cbx_',''))
            }
        }

        individuals[individualIndex][globalIndividual]['tags'] = tags
        buildIndividuals()
        modalNewIndividual.modal('hide');

    }

}

btnSubmitIndividual.addEventListener('click', ()=>{
    /** Listener that submits the new-individual form on button press. */
    if (tabActiveIndividual=='baseNewIndividualTab') {
        submitIndividual()
    } else if (tabActiveIndividual=='baseKnownIndividualTab') {
        submitKnownIndividual()
    }
});

function cancelIndividual() {
    /** Cancels the creation of a new individual during the new-individual modal phase. */
    colours[individuals[individualIndex][globalIndividual].colour]=false
    individuals.pop()
    individualIndex -= 1
    modalNewIndividual.modal('hide');
}

btnCancelIndividual.addEventListener('click', ()=>{
    /** Listener that cancels the new individual on button press. */
    cancelIndividual()
});

btnNoteRecon.addEventListener('click', ()=>{
    /** Accepts the the note recon, and closes the modal. */
    individuals[individualIndex][globalIndividual].notes = document.getElementById('reconbox').value
    modalNoteRecon.modal('hide')
});

btnDuplicate.addEventListener('click', ()=>{
    /** Submits the new name for an idividual with a suplicated name. */
    newSet = JSON.parse(JSON.stringify(individuals[individualIndex]))
    for (let individualID in newSet) {
        element = document.getElementById(newSet[individualID].name)
        if (element!=null) {
            newSet[individualID].name = element.value
        }
    }
    individuals.push(newSet)
    individualIndex += 1
    buildIndividuals()
    modalDuplicate.modal('hide')
    // submitIndividuals() // Not neccessary, as this is done in the buildIndividuals function
});

function hideBoundingLabels() {
    /** Hides/shows the bounding box labels. */
    for (let mapID in drawnItems) {
        if (mapID == 'known'){
            continue
        }
        for (let layer in drawnItems[mapID]._layers) {
            if (drawnItems[mapID]._layers[layer].isTooltipOpen()) {
                toolTipsOpen = false
                drawnItems[mapID]._layers[layer].closeTooltip()
            } else {
                toolTipsOpen = true
                drawnItems[mapID]._layers[layer].openTooltip()
            }   
        }
    }
}

function dissociateDetection(detID,mapID="map1") {
    /** Dissociates the specified individual from it's individual during the inter-cliuster ID phase. */
    if ((clusters[mapID][clusterIndex[mapID]].images.length > 1) && (finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
            if (clusters[mapID][clusterIndex[mapID]].images[i].detections[0].id == detID) {
                actions.push(['dissociation',detID,JSON.parse(JSON.stringify(clusters[mapID][clusterIndex[mapID]].images[i])),mapID,clusters[mapID][clusterIndex[mapID]].id])
                clusters[mapID][clusterIndex[mapID]].images.splice(i, 1)
                break
            }
        }

        sliderIndex[mapID] = '-1'
        update(mapID)
        
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function (wrapDetID,wrapMapID) {
            return function() {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                } else if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    // if (reply.status == 'success') {
                    //     for (let i=0;i<clusters[wrapMapID][clusterIndex[wrapMapID]].images.length;i++) {
                    //         if (wrapDetID==clusters[wrapMapID][clusterIndex[wrapMapID]].images[i].detections[0].id) {
                    //             actions.push(['dissociation',wrapDetID,JSON.parse(JSON.stringify(clusters[wrapMapID][clusterIndex[wrapMapID]].images[i])),wrapMapID,clusters[wrapMapID][clusterIndex[wrapMapID]].id])
                    //             clusters[wrapMapID][clusterIndex[wrapMapID]].images.splice(i, 1)
                    //             break
                    //         }
                    //     }
    
                    //     sliderIndex[wrapMapID] = '-1'
                    //     update(wrapMapID)
                    // }
                }
            }
        }(detID,mapID);
        xhttp.open("GET", '/dissociateDetection/'+detID);
        xhttp.send();
        
        if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
            waitModalID = clusters['map2'][clusterIndex['map2']]
            waitModalMap = 'map2'
            modalWait2Hide = false
            modalWait2.modal({backdrop: 'static', keyboard: false});
        } 
    }
}

function updateTargetRect (e) {
    /** Updates the target rectangle to the last-clicked one. */
    if (e.relatedTarget) {
        targetRect = e.relatedTarget._leaflet_id
    }
    contextLocation = e.latlng
    targetUpdated = true
}

function setRectOptions() {
    /** Sets the bounding box options. */

    menuItems = [{
        text: 'Dissociate',
        index: 0,
        callback: updateTargetRect
    }]

    rectOptions = {
        color: "rgba(223,105,26,1)",
        fill: true,
        fillOpacity: 0.0,
        opacity: 0.8,
        weight:3,
        contextmenu: true,
        contextmenuWidth: 140,
        contextmenuItems: menuItems
    }
}

function IDMapPrep(mapID = 'map1') {
    /** Finishes prepping the map for inter-cluster individual ID by adding the dissociate option to the context menu. */

    map[mapID].on('contextmenu.select', function (wrapMapID) {
        return function(e) {
            if (targetUpdated) {  
                if (e.el.textContent=='Dissociate') {
                    dissociateDetection(dbDetIds[wrapMapID][targetRect.toString()],wrapMapID)
                }
                targetUpdated = false
            } else {
                alert('Error! Select is being handled before target updated.')
            }
        }
    }(mapID));

    map[mapID].on('contextmenu', function (e) {
        /** remove duplicate items on more than one right click of contextmenu*/
        nr_items = 1

        if(map[mapID].contextmenu._items.length > nr_items){
            for (let i=map[mapID].contextmenu._items.length-1;i>nr_items-1;i--) 
            {
                map[mapID].contextmenu.removeItem(i)
            }
        } 
    });

    map[mapID].on('moveend', function(wrapMapID){
        return function(){
            if (fitBoundsInProcess[wrapMapID]) {
                det_id = clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].detections[0].id
                detection_zoom[wrapMapID][det_id] = map[mapID].getZoom()
                fitBoundsInProcess[wrapMapID] = false
                // updateKpts()
            }
        }
    }(mapID));
}

function setClusterIDRectOptions() {
    /** Sets the bounding box options. */

    menuItems = []
    index = 0
    for (let i=0;i<detection_flanks.length;i++) {
        menuItems.push({
            text: detection_flanks[i],
            index: index,
            callback: updateTargetRect
        })
        index += 1

        menuItems.push({
            separator: true,
            index: index
        })
        index += 1
    }

    rectOptions = {
        color: "rgba(223,105,26,1)",
        fill: true,
        fillOpacity: 0.0,
        opacity: 0.8,
        weight:3,
        contextmenu: true,
        contextmenuWidth: 140,
        contextmenuItems: menuItems
    }
}


function clusterIDMapPrep(mapID = 'map1') {
    /** Finishes prepping the map for intra-cluster individual ID by adding the dissociate option to the context menu. */

    map[mapID].on('contextmenu.select', function (wrapMapID) {
        return function(e) {
            if (targetUpdated && !updatingFlank) {
                updatingFlank = true
                detection_id = dbDetIds[wrapMapID][targetRect.toString()]
                editDetectionFlank(detection_id,e.el.textContent)
                targetUpdated = false
            } else {
                alert('Error! Select is being handled before target updated.')
            }
        }
    }(mapID));

    map[mapID].on('contextmenu', function (e) {
        /** remove duplicate items on more than one right click of contextmenu*/
        nr_items = 2*detection_flanks.length - 1

        if(map[mapID].contextmenu._items.length > nr_items){
            for (let i=map[mapID].contextmenu._items.length-1;i>nr_items-1;i--) 
            {
                map[mapID].contextmenu.removeItem(i)
            }
        } 
    });

    map[mapID].on('zoom', function(e){
        /** update position of bounding box labels on zoom */
        if (toolTipsOpen) {
            for (let layer in drawnItems[mapID]._layers) {
                var drawn_layer = drawnItems[mapID]._layers[layer]
                var center = L.latLng([(drawn_layer._bounds._northEast.lat+drawn_layer._bounds._southWest.lat)/2,(drawn_layer._bounds._northEast.lng+drawn_layer._bounds._southWest.lng)/2])
                var bottom = L.latLng([drawn_layer._bounds._southWest.lat,(drawn_layer._bounds._northEast.lng+drawn_layer._bounds._southWest.lng)/2])
                var centerPoint = map[mapID].latLngToContainerPoint(center)
                var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
                var offset = [0,centerPoint.y-bottomPoint.y]
                drawn_layer._tooltip.options.offset = offset
            }
        }
    });
}

window.addEventListener('load', onload, false);

btnDone.addEventListener('click', ()=>{
    /** Wraps up the user's session when they click the done button. */
    window.location.replace("done")
});

// Handles ModalActive status
modalNextIndividual.on('shown.bs.modal', function(){
    modalActive = true;
});
modalNextIndividual.on('hidden.bs.modal', function(){
    modalActive = false;
});
modalWait.on('shown.bs.modal', function(){
    modalActive = true;
});
modalWait.on('hidden.bs.modal', function(){
    modalActive = false;
});
modalDuplicate.on('shown.bs.modal', function(){
    /** Additionally hides the please wait modal. */
    if (modalWait2.is(':visible')) {
        modalWait2Hide = true
        modalWait2.modal('hide');
    }
});
modalAlertNextIndividual.on('shown.bs.modal', function(){
    if (modalWait2.is(':visible')) {
        modalWait2Hide = true
        modalWait2.modal('hide');r
    }
    if (modalWait.is(':visible')) {
        modalWait.modal('hide');
    }
    modalActive = true;
});
modalAlertNextIndividual.on('hidden.bs.modal', function(){
    if(modalActive){
        window.location.replace('done')
    }
    modalActive = false;
});

function editDetectionFlank(detID,flank) {
    /** Edits the flank of a detection. */
    if ((finishedDisplaying['map1']) && (finishedDisplaying['map2']) && (modalActive == false) && (modalActive2 == false)) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function() {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if ('id' in reply && 'flank' in reply) {
                    det_id = reply.id
                    new_flank = reply.flank
                    editedFlanks[det_id] = new_flank
                    for (let map_id in dbDetIds) {
                        if (map_id == 'known'){
                            continue
                        }
                        for (let leafletID in dbDetIds[map_id]) {
                            if (dbDetIds[map_id][leafletID] == det_id) {
                                drawnItems[map_id]._layers[leafletID].closeTooltip()
                                drawnItems[map_id]._layers[leafletID]._tooltip._content= new_flank
                                if (toolTipsOpen) {
                                    drawnItems[map_id]._layers[leafletID].openTooltip()
                                }
                                break
                            }
                        }
                    }
                }
                updatingFlank = false
            }
        }
        xhttp.open("GET", '/editDetectionFlank/'+detID+'/'+flank);
        xhttp.send();
    }
}

function getMatchingKpts(detID1, detID2) {
    /** Retrieves the matching keypoints between two detections. */

    for (let mapID in kpts_layer) {
        if(kpts_layer[mapID]) {
            map[mapID].removeLayer(kpts_layer[mapID])
        }
    }

    id = detID1 + '_' + detID2
    if (id in savedKpts) {
        addHotspotsHeatmap('map1', savedKpts[id].kpts[detID1], savedKpts[id].scores, detection_zoom['map1'][detID1])
        addHotspotsHeatmap('map2', savedKpts[id].kpts[detID2], savedKpts[id].scores, detection_zoom['map2'][detID2])
    }
    else{
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapDetID1,wrapDetID2) {
        return function() {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                results = reply.results
                // console.log(results)

                id = wrapDetID1 + '_' + wrapDetID2
                savedKpts[id] = results
    
                addHotspotsHeatmap('map1', results.kpts[wrapDetID1], results.scores,detection_zoom['map1'][wrapDetID1])
                addHotspotsHeatmap('map2', results.kpts[wrapDetID2], results.scores,detection_zoom['map2'][wrapDetID2])
            }
        }}(detID1,detID2);
        xhttp.open("GET", '/ibsHandler/getMatchingKpts/'+detID1+'/'+detID2);
        xhttp.send();
    }

}

function addHotspotsHeatmap(mapID, kpts, scores, zoom=0) {
    /** Adds the heatmap of keypoints to the map. */

    if(kpts_layer[mapID]) {
        map[mapID].removeLayer(kpts_layer[mapID])
    }

    var heatMapData = []
    var maxScore = 0
    for (i = 0; i < kpts.length; i++) {
        x = kpts[i][0] * mapWidth[mapID]
        y = kpts[i][1] * mapHeight[mapID]
        heatMapData.push({lat: y, lng: x, count: scores[i]})
        if (scores[i] > maxScore) {
            maxScore = scores[i]
        }
    }

    // zoom = map[mapID].getZoom()
    scaleFactor = Math.pow(2, zoom)
    inputRadius = document.getElementById('radiusInput').value
    if (inputRadius == 0 || inputRadius == null || inputRadius == '') {
        inputRadius = defaultRadius
        document.getElementById('radiusInput').value = defaultRadius
    }
    radius = inputRadius/scaleFactor
    opacity = document.getElementById('opacityInput').value
    if (opacity == 0 || opacity == null || opacity == '') {
        opacity = defaultOpactity
        document.getElementById('opacityInput').value = defaultOpactity
    }

    var cfg = {
        "radius": radius,
        "maxOpacity": opacity/100,
        "scaleRadius": true,
        "useLocalExtrema": false,
        latField: 'lat',
        lngField: 'lng',
        valueField: 'count'
    };

    hm_data = {
        data: heatMapData,
        max: maxScore
    }

    kpts_layer[mapID] = new HeatmapOverlay(cfg);
    kpts_layer[mapID].addTo(map[mapID]);

    kpts_layer[mapID].setData(hm_data);
    kpts_layer[mapID]._update()

    //Set z-index of heatmap to be above images
    kpts_layer[mapID]._el.style.zIndex = 1000

}

$('#cxFeaturesHeatmap').on('change', function() {
    /** Handles the change in the heatmap selection. */
    updateKpts()
});

function updateKpts() {
    /** Updates the keypoints heatmap. */
    if (isIDing && (document.getElementById('btnSendToBack')==null)) {
        if (document.getElementById('cxFeaturesHeatmap').checked){
            document.getElementById('heatmapOptionsDiv').hidden = false
            detID1 = clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].detections[0].id
            detID2 = clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].detections[0].id
            getMatchingKpts(detID1,detID2)
        }
        else{
            document.getElementById('heatmapOptionsDiv').hidden = true
            if (kpts_layer['map1'] != null){
                map['map1'].removeLayer(kpts_layer['map1'])
            }
            if (kpts_layer['map2'] != null){
                map['map2'].removeLayer(kpts_layer['map2'])
            }
        }
    }
}

$('#opacityInput').on('change', function() {
    /** Handles the change in the heatmap opacity. */
    document.getElementById('opacityInputSpan').innerHTML = document.getElementById('opacityInput').value
    updateKpts() // Opacity does not update with _update() so need to remove and re-add the heatmap
});

$('#radiusInput').on('change', function() {
    /** Handles the change in the heatmap radius. */
    var radius = document.getElementById('radiusInput').value
    document.getElementById('radiusInputSpan').innerHTML = radius 

    if (kpts_layer['map1'] != null){
        zoom1 = detection_zoom['map1'][clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].detections[0].id]
        scaleFactor1 = Math.pow(2, zoom1)
        radius1 = radius/scaleFactor1
        kpts_layer['map1'].cfg.radius = radius1
        kpts_layer['map1']._update()
    }
    if (kpts_layer['map2'] != null){
        zoom2 = detection_zoom['map2'][clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].detections[0].id]
        scaleFactor2 = Math.pow(2, zoom2)
        radius2 = radius/scaleFactor2
        kpts_layer['map2'].cfg.radius = radius2
        kpts_layer['map2']._update()
    }
});

function changeIndividualTab(evt, tabName) {
    /** Opens the permissions tab */

    var mainModal = document.getElementById('modalNewIndividual')
    var tabcontent = mainModal.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    var tablinks = mainModal.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActiveIndividual = tabName

    if (tabName == 'baseNewIndividualTab') {
        document.getElementById('btnSubmitIndividual').innerHTML = 'Create'
        document.getElementById('btnSubmitIndividual').disabled = false
    }
    else if (tabName == 'baseKnownIndividualTab') {
        document.getElementById('btnSubmitIndividual').innerHTML = 'Select'
        document.getElementById('btnSubmitIndividual').disabled = true
        map['known'] = null 
        mapDivs['known'] = 'knownMapDiv'
        splides['known'] = 'splideKnown'
        activeImage['known'] = null 
        drawnItems['known'] = null
        fullRes['known'] = false
        mapHeight['known'] = null
        mapWidth['known'] = null
        mapReady['known'] = false
        addedDetections['known'] = false
        sliderIndex['known'] = '-1'
        clusterPositionSplide['known'] = null
        clusterPosition['known'] = null
        clusters['known'] = []	
        clusterIndex['known'] = 0
        imageIndex['known'] = 0
        if (Object.keys(siteCoords).length == 0) {
            getCoords()
        }
        knownIndividualsFilters = {'task': null, 'search': null, 'order': null, 'tags': null, 'page': null}
        buildKnownIndividuals()
    }
}

function buildKnownIndividuals(){
    /** Builds the known individuals tab. */

    document.getElementById('knownDescription').hidden = false

    var knownInfoCol = document.getElementById('knownInfoCol')
    while(knownInfoCol.firstChild){
        knownInfoCol.removeChild(knownInfoCol.firstChild);
    }

    var knownIndivCol = document.getElementById('knownIndivCol')
    while(knownIndivCol.firstChild){
        knownIndivCol.removeChild(knownIndivCol.firstChild);
    }

    // Individuals filters

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Search Name:'
    h5.setAttribute('style','margin-bottom: 2px')
    knownInfoCol.appendChild(h5)

    var search = document.createElement('input')
    search.setAttribute('type','text')
    search.setAttribute('id','knownSearch')
    search.setAttribute('class','form-control')
    search.setAttribute('placeholder','Search')
    knownInfoCol.appendChild(search)

    if (knownIndividualsFilters['search'] != null) {
        search.value = knownIndividualsFilters['search']
    }

    knownInfoCol.appendChild(document.createElement('br'))

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Order By:'
    h5.setAttribute('style','margin-bottom: 2px')
    knownInfoCol.appendChild(h5)
    
    var order = document.createElement('select')
    order.setAttribute('id','knownOrderBy')
    order.setAttribute('class','form-control')
    knownInfoCol.appendChild(order)
    fillSelect(order, ['Name', 'Distance'], ['oName','oDist'])
    order.value = 'oName'

    if (knownIndividualsFilters['order'] != null) {
        order.value = knownIndividualsFilters['order']
    }

    knownInfoCol.appendChild(document.createElement('br'))

    $('#knownSearch').on('change', function() {
        knownIndividualsFilters['page'] = null
        knownIndividualsFilters['search'] = document.getElementById('knownSearch').value
        getKnownIndividuals()
    });

    $("#knownOrderBy").change( function() {
        knownIndividualsFilters['page'] = null
        knownIndividualsFilters['order'] = document.getElementById('knownOrderBy').value
        getKnownIndividuals()
    });

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Surveys and Annotation Sets:'
    h5.setAttribute('style','margin-bottom: 2px')
    knownInfoCol.appendChild(h5)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','knownTaskSelect')
    knownInfoCol.appendChild(select)
    fillSelect(select, ['All'], ['-1'])
    select.value = '-1'

    $('#knownTaskSelect').change( function() {
        knownIndividualsFilters['page'] = null
        knownIndividualsFilters['task'] = document.getElementById('knownTaskSelect').value
        getKnownIndividuals()
    });

    knownInfoCol.appendChild(document.createElement('br'))

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Tags:'
    h5.setAttribute('style','margin-bottom: 2px')
    knownInfoCol.appendChild(h5)
    
    var tags = document.createElement('select')
    tags.setAttribute('id','knownTags')
    tags.setAttribute('class','form-control')
    knownInfoCol.appendChild(tags)
    fillSelect(tags, ['All'], ['-1'])
    tags.value = '-1'

    knownInfoCol.appendChild(document.createElement('br'))

    $('#knownTags').change( function() {
        knownIndividualsFilters['page'] = null
        knownIndividualsFilters['tags'] = document.getElementById('knownTags').value
        getKnownIndividuals()
    });

    // Individuals
    var knownIndividualsDiv = document.createElement('div')
    knownIndividualsDiv.setAttribute('id','knownIndividualsDiv')
    knownIndivCol.appendChild(knownIndividualsDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    knownIndivCol.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-1')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-10')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-1')
    row.appendChild(col3)

    var btnKnownPrev = document.createElement('button')
    btnKnownPrev.setAttribute('class','btn btn-primary btn-block btn-sm')
    btnKnownPrev.setAttribute('id','btnKnownPrev')
    btnKnownPrev.innerHTML = '<span style="font-size:100%">&#x276e;</span>'
    btnKnownPrev.disabled = true
    col1.appendChild(btnKnownPrev)

    var btnKnownNext = document.createElement('button')
    btnKnownNext.setAttribute('class','btn btn-primary btn-block btn-sm')
    btnKnownNext.setAttribute('id','btnKnownNext')
    btnKnownNext.innerHTML = '<span style="font-size:100%">&#x276f;</span>'
    btnKnownNext.disabled = true
    col3.appendChild(btnKnownNext)

    $('#btnKnownPrev').click( function() {
        getKnownIndividuals(prev_known)
    });

    $('#btnKnownNext').click( function() {
        getKnownIndividuals(next_known)
    });

    var rowDiv = document.createElement('div');
    rowDiv.classList.add('row');
    col2.appendChild(rowDiv);

    var colDiv = document.createElement('div');
    colDiv.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center');
    rowDiv.appendChild(colDiv);

    var paginationDiv = document.createElement('div');
    paginationDiv.id = 'individualsPosition';
    colDiv.appendChild(paginationDiv);

    var paginationUl = document.createElement('ul');
    paginationUl.classList.add('pagination');
    paginationUl.id = 'paginationCircles';
    paginationUl.style.margin = '5px';
    paginationDiv.appendChild(paginationUl);

    cluster_id = clusters['map1'][clusterIndex['map1']].id
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 278) {
            window.location.replace(JSON.parse(this.responseText)['redirect'])
        } else if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            var select = document.getElementById('knownTaskSelect')
            clearSelect(select)
            fillSelect(select, ['All'], ['-1'])
            select.value = '-1'
            for (let i=0;i<reply.tasks.length;i++) {
                let task = reply.tasks[i]
                fillSelect(select, [task.name], [task.id])
            }

            if (knownIndividualsFilters['task'] != null) {
                select.value = knownIndividualsFilters['task']
            }

            var tagSelect = document.getElementById('knownTags')
            clearSelect(tagSelect)
            fillSelect(tagSelect, ['All'], ['0'])
            fillSelect(tagSelect, reply.tags, reply.tags)

            if (knownIndividualsFilters['tags'] != null) {
                if (reply.tags.includes(knownIndividualsFilters['tags'])) {
                    tagSelect.value = knownIndividualsFilters['tags']
                }
                else{
                    tagSelect.value = '0'
                    knownIndividualsFilters['tags'] = null
                }
            }

            getKnownIndividuals()

        }
    }
    xhttp.open("GET", '/getMergeTasks/'+ cluster_id + '/cluster');
    xhttp.send();

}

function getKnownIndividuals(page = null){
    /** Gets a page of individuals. Gets the first page if none is specified. */
    var formData = new FormData()
    formData.append("cluster_id", JSON.stringify(clusters['map1'][clusterIndex['map1']].id))    
    task_id = document.getElementById('knownTaskSelect').value
    formData.append("task_id", JSON.stringify(task_id))
    tag = document.getElementById('knownTags').value
    if (tag != '-1' || tag != '0' || tag != null) {
        formData.append("tag", JSON.stringify(tag))
    }
    

    request = '/getKnownIndividuals'
    if (page != null) {
        request += '?page='+page.toString()
    }
    else{
        if (knownIndividualsFilters['page'] != null) {
            request += '?page='+knownIndividualsFilters['page'].toString()
        }
    }
    
    var search = document.getElementById('knownSearch').value
    var order = document.getElementById('knownOrderBy').value
    formData.append("search", JSON.stringify(search))
    formData.append("order", JSON.stringify(order))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", request);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 278) {
            window.location.replace(JSON.parse(this.responseText)['redirect'])
        } else if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            var known_individuals = reply.individuals
            var knownIndividualsDiv = document.getElementById('knownIndividualsDiv')
            while(knownIndividualsDiv.firstChild){
                knownIndividualsDiv.removeChild(knownIndividualsDiv.firstChild);
            }
            
            var row = document.createElement('div')
            row.classList.add('row')
            knownIndividualsDiv.appendChild(row)
            runningCount = 0
            for (let i=0;i<known_individuals.length;i++) {
                let newIndividual = known_individuals[i]

                if (runningCount%3==0) {
                    runningCount = 0
                    row = document.createElement('div')
                    row.classList.add('row')
                    knownIndividualsDiv.appendChild(row)
                }

                let col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)

                // let image = document.createElement('img')
                // image.setAttribute('width','100%')
                // image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(newIndividual.url)
                // col.appendChild(image)

                let div = document.createElement('div')
                div.setAttribute('id','imgDiv'+i)
                col.appendChild(div)

                prepImageMap('imgDiv'+i, newIndividual.url, newIndividual.detection)

                let h5 = document.createElement('h5')
                h5.setAttribute('align','center')
                h5.setAttribute('style','font-size: 95%;')
                h5.innerHTML = newIndividual.name
                col.appendChild(h5)

                // image.addEventListener('click', function(individualID,individualName){
                //     return function() {
                //         selectedKnownIndividual = individualID
                //         selectedKnownIndividualName = individualName
                //         viewKnownIndividual()
                //     }
                // }(newIndividual.id,newIndividual.name));

                div.addEventListener('click', function(individualID,individualName){
                    return function() {
                        selectedKnownIndividual = individualID
                        selectedKnownIndividualName = individualName
                        viewKnownIndividual()
                    }
                }(newIndividual.id,newIndividual.name));

                runningCount += 1
            }

            if (reply.next==null) {
                document.getElementById('btnKnownNext').disabled = true
                next_known = null
            } else {
                document.getElementById('btnKnownNext').disabled = false
                next_known = reply.next
            }

            if (reply.prev==null) {
                document.getElementById('btnKnownPrev').disabled = true
                prev_known = null
            } else {
                document.getElementById('btnKnownPrev').disabled = false
                prev_known = reply.prev
            }

            updateKnownPaginationCircles(reply.current, reply.nr_pages)

            knownIndividualsFilters['page'] = reply.current
        }
    }
    xhttp.send(formData);
    
}

function viewKnownIndividual(mapID='known') {
    /** Views the selected known individual. */

    document.getElementById('knownDescription').hidden = true

    var knownInfoCol = document.getElementById('knownInfoCol')
    while(knownInfoCol.firstChild){
        knownInfoCol.removeChild(knownInfoCol.firstChild);
    }

    var knownIndivCol = document.getElementById('knownIndivCol')
    while(knownIndivCol.firstChild){
        knownIndivCol.removeChild(knownIndivCol.firstChild);
    }

    var formData = new FormData()
    formData.append("order", JSON.stringify('a1'))
    formData.append("site", JSON.stringify('0'))
    formData.append('start_date', JSON.stringify(''))
    formData.append('end_date', JSON.stringify(''))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            // knownImages =  reply.individual
            clusters[mapID][clusterIndex[mapID]] = {
                id: 0,
                images: reply.individual,
                classification : [],
                notes: null,
                required: [],
                trapGroup: reply.individual[0].trapgroup.id,
                tag_ids: [],
                tags: [],
                label: [],
                label_ids: []
            }           
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Individual: ' + selectedKnownIndividualName
            knownInfoCol.appendChild(h5)

            var row = document.createElement('div')
            row.classList.add('row')
            knownIndivCol.appendChild(row)

            var col1 = document.createElement('div')
            col1.classList.add('col-lg-11')
            row.appendChild(col1)

            var col2 = document.createElement('div')
            col2.classList.add('col-lg-1')
            row.appendChild(col2)

            var cancelBtn = document.createElement('button')
            cancelBtn.setAttribute('class','btn btn-primary btn-block btn-sm')
            cancelBtn.innerHTML = '<i class="fa fa-times"></i>'
            cancelBtn.id = 'btnCancelKnown'
            col2.appendChild(cancelBtn)
        
            $('#btnCancelKnown').click( function() {
                document.getElementById('btnSubmitIndividual').disabled = true
                selectedKnownIndividual = null
                selectedKnownIndividualName = null
                map['known'].remove()
                map['known'] = null 
                mapDivs['known'] = 'knownMapDiv'
                splides['known'] = 'splideKnown'
                activeImage['known'] = null 
                drawnItems['known'] = null
                fullRes['known'] = false
                mapHeight['known'] = null
                mapWidth['known'] = null
                mapReady['known'] = false
                addedDetections['known'] = false
                sliderIndex['known'] = '-1'
                clusterPositionSplide['known'] = null
                clusterPosition['known'] = null
                clusters['known'] = []	
                clusterIndex['known'] = 0
                imageIndex['known'] = 0
                buildKnownIndividuals()
            });

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    var info = JSON.parse(this.responseText);
                
                    var info1 = document.createElement('div')
                    info1.setAttribute('id','tgInfoKnown')
                    info1.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    info1.innerHTML = 'Site: ' + clusters[mapID][clusterIndex[mapID]].images[0].trapgroup.tag
                    knownInfoCol.appendChild(info1)
        
                    var info2 = document.createElement('div')
                    info2.setAttribute('id','timeInfoKnown')
                    info2.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    info2.innerHTML = 'Timestamp: '+ clusters[mapID][clusterIndex[mapID]].images[0].timestamp
                    knownInfoCol.appendChild(info2)
        
                    var info5 = document.createElement('div')
                    info5.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    if (info.seen_range[0] == null) {
                        info5.innerHTML = 'First Seen: None'
                    } else {
                        info5.innerHTML = 'First Seen: ' + info.seen_range[0]
                    }
                    knownInfoCol.appendChild(info5)
        
                    var info6 = document.createElement('div')
                    info6.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    if (info.seen_range[1] == null) {
                        info6.innerHTML = 'Last Seen: None'
                    } else {
                        info6.innerHTML = 'Last Seen: ' + info.seen_range[1]
                    }
                    knownInfoCol.appendChild(info6)

                    var info3 = document.createElement('div')
                    info3.setAttribute('style','font-size: 80%;')
                    info3.innerHTML = 'Surveys:'
                    knownInfoCol.appendChild(info3)
        
                    for (let i=0;i<info.surveys.length;i++) {
                        var info4 = document.createElement('div')
                        info4.setAttribute('style','font-size: 80%;')
                        info4.innerHTML = info.surveys[i]
                        knownInfoCol.appendChild(info4)
                    }
        
                    var info7 = document.createElement('div')
                    info7.setAttribute('style','font-size: 80%; margin-top: 5px;')
                    // var tags =  info.tags.length > 0 ? [...new Set(info.tags)].join(', ') : 'None'
                    info7.innerHTML = 'Tags: '
                    knownInfoCol.appendChild(info7)

                    var tagRow = document.createElement('div')
                    tagRow.setAttribute('class','row')
                    knownInfoCol.appendChild(tagRow)

                    for (let i=0;i<2;i++) {
                        var tagCol = document.createElement('div')
                        tagCol.setAttribute('class','col-lg-6')
                        tagCol.setAttribute('id','tagCol'+i)
                        tagCol.style.paddingRight = '0px'
                        tagRow.appendChild(tagCol)
                    }

                    colCount = 0
                    for (let i=0;i<globalTags.length;i++) {
                        var tag = globalTags[i].tag

                        var col = document.getElementById('tagCol'+colCount)
                
                        var checkDiv = document.createElement('div')
                        checkDiv.setAttribute('class','custom-control custom-checkbox')
                        checkDiv.setAttribute('style','display: inline-block;')
                        col.appendChild(checkDiv)
                
                        var input = document.createElement('input')
                        input.setAttribute('type','checkbox')
                        input.classList.add('custom-control-input')
                        input.setAttribute('id','Cbx_'+tag)
                        input.setAttribute('name','Cbx_'+tag)
                        checkDiv.appendChild(input)
                
                        var label = document.createElement('label')
                        label.classList.add('custom-control-label')
                        label.setAttribute('for','Cbx_'+tag)
                        label.innerHTML = tag
                        checkDiv.appendChild(label)

                        colCount += 1
                        if (colCount > 1) {
                            colCount = 0
                        }
                    }
                
                    for (let i=0;i<info.tags.length;i++) {
                        var tag = info.tags[i]
                        var check = document.getElementById('Cbx_'+tag)
                        if (check) {
                            check.checked = true
                        } else {
                            col = document.getElementById('tagCol'+colCount)
                            var checkDiv = document.createElement('div')
                            checkDiv.setAttribute('class','custom-control custom-checkbox')
                            checkDiv.setAttribute('style','display: inline-block;')
                            col.appendChild(checkDiv)
                
                            var input = document.createElement('input')
                            input.setAttribute('type','checkbox')
                            input.classList.add('custom-control-input')
                            input.setAttribute('id','Cbx_'+tag)
                            input.setAttribute('name','Cbx_'+tag)
                            input.checked = true
                            checkDiv.appendChild(input)
                
                            var label = document.createElement('label')
                            label.classList.add('custom-control-label')
                            label.setAttribute('for','Cbx_'+tag)
                            label.innerHTML = tag
                            checkDiv.appendChild(label)

                            colCount += 1
                            if (colCount > 1) {
                                colCount = 0
                            }
                        }
                    }

                    var info8 = document.createElement('div')
                    info8.setAttribute('style','font-size: 80%;  margin-top: 5px;')
                    var note = info.notes != null && info.notes.length > 0 ? info.notes : ''
                    info8.innerHTML = 'Notes: '
                    knownInfoCol.appendChild(info8)

                    var knownNotebox = document.createElement('textarea')
                    knownNotebox.setAttribute('id','knownNotebox')
                    knownNotebox.setAttribute('rows','2')
                    knownNotebox.setAttribute('class','form-control')
                    knownNotebox.setAttribute('style','resize: none; font-size: 80%;')
                    knownNotebox.value = note
                    knownInfoCol.appendChild(knownNotebox)

                    var trapgroupInfo = []
                    var noCoords = true
                    for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
                        var site =clusters[mapID][clusterIndex[mapID]].images[i].trapgroup
                        var found = false
                        for (let j=0;j<trapgroupInfo.length;j++) {
                            if (trapgroupInfo[j].tag == site.tag) {
                                found = true
                                break
                            }
                        }
                        if (!found) {
                            trapgroupInfo.push(site)
                            if (site.latitude != 0 || site.longitude != 0) {
                                noCoords = false
                            }
                        }
                    }

                    if (noCoords) {
                        var site_tags = []
                        for (let i=0;i<trapgroupInfo.length;i++) {
                            site_tags.push(trapgroupInfo[i].tag)
                        }

                        var info9 = document.createElement('div')
                        info9.setAttribute('style','font-size: 80%; margin-top: 5px;')
                        info9.innerHTML = 'Sites: ' + site_tags.join(', ')
                        knownInfoCol.appendChild(info9)

                    }
                    else{

                        var info9 = document.createElement('div')
                        info9.setAttribute('style','font-size: 80%; margin-top: 5px;')
                        info9.innerHTML = 'Sites:'
                        knownInfoCol.appendChild(info9)
                    
                        var sitesMapDiv = document.createElement('div')
                        sitesMapDiv.setAttribute('id','sitesMapDiv')
                        sitesMapDiv.setAttribute('style','height: 250px;')
                        knownInfoCol.appendChild(sitesMapDiv)
                    
                        gHyb = L.gridLayer.googleMutant({type: 'hybrid' })
                    
                        var mapSites = new L.map('sitesMapDiv', {
                            zoomControl: true,
                        });
                    
                        mapSites.addLayer(gHyb);
                    
                        var siteMarkers = []
                        var added_coords = []
                        for (let i=0;i<trapgroupInfo.length;i++) {
                            marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(mapSites)
                            siteMarkers.push(marker)
                            mapSites.addLayer(marker)
                            marker.bindPopup(trapgroupInfo[i].tag);
                            marker.on('mouseover', function (e) {
                                this.openPopup();
                            });
                            marker.on('mouseout', function (e) {
                                this.closePopup();
                            });
                            added_coords.push(trapgroupInfo[i].latitude + ',' + trapgroupInfo[i].longitude)
                        }

                        var clusterCoords = siteCoords[clusters['map1'][clusterIndex['map1']].trapGroup]
                        if (clusterCoords != null || clusterCoords != undefined) {
                            if (!added_coords.includes(clusterCoords.latitude + ',' + clusterCoords.longitude) && (clusterCoords.latitude != 0 || clusterCoords.longitude != 0)) {
                                var marker = L.marker([clusterCoords.latitude, clusterCoords.longitude]).addTo(mapSites)
                                siteMarkers.push(marker)
                                mapSites.addLayer(marker)
                                marker.bindPopup(clusterCoords.tag);
                                marker.on('mouseover', function (e) {
                                    this.openPopup();
                                });
                                marker.on('mouseout', function (e) {
                                    this.closePopup();
                                });
                            }
                        }

                        var group = new L.featureGroup(siteMarkers);
                        mapSites.fitBounds(group.getBounds().pad(0.1))
                        if(siteMarkers.length == 1) {
                            mapSites.setZoom(10)
                        }

                        if ((clusterCoords != null || clusterCoords != undefined) && (clusterCoords.latitude != 0 || clusterCoords.longitude != 0)){
                            var circle = L.circle([clusterCoords.latitude, clusterCoords.longitude], {
                                color: "rgba(223,105,26,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                radius: 1000,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSites)
                        }

                        if (info.bounds.length == 1){
                            var circle = L.circle([info.bounds[0][0], info.bounds[0][1]], {
                                color: "rgba(91,192,222,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                radius: 1000,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSites)
                        } else {
                            var poly2 = L.polygon(info.bounds, {
                                color: "rgba(91,192,222,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSites)
                        }

                    }
                
                    var center = document.createElement('center')
                    knownIndivCol.appendChild(center)
        
                    var knownMapDiv = document.createElement('div')
                    knownMapDiv.setAttribute('id','knownMapDiv')
                    knownMapDiv.setAttribute('style','height: 750px;')
                    center.appendChild(knownMapDiv)
        
                    var card = document.createElement('div')
                    card.classList.add('card')
                    card.setAttribute('style','background-color: rgb(60, 74, 89);margin-top: 5px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 5px')
                    knownIndivCol.appendChild(card)
                
                    var body = document.createElement('div')
                    body.classList.add('card-body')
                    body.setAttribute('style','margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px')
                    card.appendChild(body)
                
                    var splide = document.createElement('div')
                    splide.classList.add('splide')
                    splide.setAttribute('id','splideKnown')
                    body.appendChild(splide)
                
                    var track = document.createElement('div')
                    track.classList.add('splide__track')
                    splide.appendChild(track)
                
                    var list = document.createElement('ul')
                    list.classList.add('splide__list')
                    list.setAttribute('id','imageSplideKnown')
                    track.appendChild(list)
        
                    clusterPosition[mapID] = document.getElementById('imageSplideKnown')

                    prepMap(mapID)
                    updateSlider(mapID)

                    document.getElementById('btnSubmitIndividual').disabled = false

                }
            }
            xhttp.open("GET", '/getIndividualInfo/'+selectedKnownIndividual);
            xhttp.send();

        }
    }
    xhttp.open("POST", '/getIndividual/'+selectedKnownIndividual);
    xhttp.send(formData)

}

function getCoords(){
    /** Gets the coordinates of all sites for the current task. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            siteCoords = reply
        }
    }
    xhttp.open("GET", '/getSiteCoords');
    xhttp.send()
}

function updateKnownPaginationCircles(current,total){
    /** Updates pagination circles on the known modal. */

    var individualsPosition = null
    var cirNum = total
    var circlesIndex = current - 1
    var individualsPosition = document.getElementById('individualsPosition')
    var paginationCircles = document.getElementById('paginationCircles')


    if (individualsPosition != null) {
        while (paginationCircles.firstChild) {
            paginationCircles.removeChild(paginationCircles.firstChild);
        }

        var beginIndex = 0
        var endIndex = cirNum
        var multiple = false
        if (cirNum > 10) {
            multiple =  true
            beginIndex = Math.max(0,circlesIndex-2)
            if (beginIndex < 2) {
                beginIndex = 0
                endIndex = 5
            }
            else {
                endIndex = Math.min(cirNum,circlesIndex+3)
                if (endIndex > cirNum-2) {
                    endIndex = cirNum
                    beginIndex = cirNum - 5
                }
            }
        }

        if (multiple && beginIndex != 0 && circlesIndex > 2) {
            first = document.createElement('li')
            first.setAttribute('onclick','getKnownIndividuals(1)')
            first.style.fontSize = '60%'
            first.innerHTML = '1'
            paginationCircles.append(first)
        
            more = document.createElement('li')
            more.setAttribute('class','disabled')
            more.style.fontSize = '60%'
            more.innerHTML = '...'
            paginationCircles.append(more)
        }


        for (let i=beginIndex;i<endIndex;i++) {
            li = document.createElement('li')
            li.innerHTML = (i+1).toString()
            li.setAttribute('onclick','getKnownIndividuals('+(i+1).toString()+')')
            li.style.fontSize = '60%'
            paginationCircles.append(li)

            if (i == circlesIndex) {
                li.setAttribute('class','active')
            } else {
                li.setAttribute('class','')
            }
        }

        if (multiple && endIndex != cirNum && circlesIndex < cirNum-3) {
            more = document.createElement('li')
            more.setAttribute('class','disabled')
            more.innerHTML = '...'
            more.style.fontSize = '60%'
            paginationCircles.append(more)

            last_index = cirNum - 1
            last = document.createElement('li')
            last.setAttribute('onclick','getKnownIndividuals('+(last_index+1).toString()+')')
            last.innerHTML = (last_index+1).toString()
            last.style.fontSize = '60%'
            paginationCircles.append(last)
        }
    }
}

function prepImageMap(div_id, image_url, detection) {
    /** Prepares the image map for the individual modal. */
    if (bucketName != null) {
        var imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image_url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height
            if (w>h) {
                document.getElementById(div_id).setAttribute('style','height: calc(10vw *'+(h/w)+');  width:10vw')
            } else {
                document.getElementById(div_id).setAttribute('style','height: calc(10vw *'+(w/h)+');  width:10vw')
            }
            L.Browser.touch = true
        
            imgMaps[div_id] = new L.map(div_id, {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0,
                attributionControl: false,
            })

            // disable zoom controls and drag etc
            imgMaps[div_id].zoomControl.remove()
            imgMaps[div_id].dragging.disable()
            imgMaps[div_id].touchZoom.disable()
            imgMaps[div_id].doubleClickZoom.disable()
            imgMaps[div_id].scrollWheelZoom.disable()
            imgMaps[div_id].boxZoom.disable()
            imgMaps[div_id].keyboard.disable()   
            imgMaps[div_id].boxZoom.disable()


            var h1 = document.getElementById(div_id).clientHeight
            var w1 = document.getElementById(div_id).clientWidth
            var southWest = imgMaps[div_id].unproject([0, h1], 2);
            var northEast = imgMaps[div_id].unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);

            imgMapsActiveImage[div_id] = L.imageOverlay(imageUrl, bounds).addTo(imgMaps[div_id]);

            imgMapsActiveImage[div_id].on('load', function() {
                // I want to zoom the map to fit the bounds of detection
                if (detection != null) {
                    det_bounds = [[detection.top*imgMapsHeight[div_id],detection.left*imgMapsWidth[div_id]],[detection.bottom*imgMapsHeight[div_id],detection.right*imgMapsWidth[div_id]]]
                    imgMaps[div_id].fitBounds(det_bounds, {padding: [10,10]});
                }
            });


            imgMapsWidth[div_id] = northEast.lng
            imgMapsHeight[div_id] = southWest.lat
            imgMaps[div_id].setMaxBounds(bounds);
            imgMaps[div_id].fitBounds(bounds)
            imgMaps[div_id].setMinZoom(imgMaps[div_id].getZoom())



            imgMaps[div_id].on('resize', function(){
                if (imgMaps[div_id] != null&&document.getElementById(div_id) && document.getElementById(div_id).clientHeight) {
                    var h1 = document.getElementById(div_id).clientHeight
                    var w1 = document.getElementById(div_id).clientWidth

                    var southWest = imgMaps[div_id].unproject([0, h1], 2);
                    var northEast = imgMaps[div_id].unproject([w1, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);

                    imgMapsWidth[div_id] = northEast.lng
                    imgMapsHeight[div_id] = southWest.lat

                    imgMaps[div_id].invalidateSize()
                    imgMaps[div_id].setMaxBounds(bounds)
                    imgMaps[div_id].fitBounds(bounds)
                    imgMaps[div_id].setMinZoom(imgMaps[div_id].getZoom())
                    imgMapsActiveImage[div_id].setBounds(bounds)

                    setTimeout(function() {
                        if (detection != null) {
                            var det_bounds = [[detection.top*imgMapsHeight[div_id],detection.left*imgMapsWidth[div_id]],[detection.bottom*imgMapsHeight[div_id],detection.right*imgMapsWidth[div_id]]]
                            imgMaps[div_id].fitBounds(det_bounds, {padding: [10,10]});
                        }
                    }, 500);
                }
            });

        }
        img.src = imageUrl
    }
}
