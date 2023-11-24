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
            update('map1')
            break
        }
    }
    for (let i=0;i<clusters['map2'][clusterIndex['map2']].images.length;i++) {
        if (maximums.includes(clusters['map2'][clusterIndex['map2']].images[i].detections[0].id)) {
            clusterPositionSplide['map2'].go(i)
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
        console.log(mapID)
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
            
                            if (clusterRequests[wrapMapID].includes(parseInt(info.id))) {
                                for (let i=0;i<info.info.length;i++) {
                                    newcluster = info.info[i];

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
                                                clusterIdList.push(newcluster.id)
    
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
            xhttp.open("GET", '/getCluster?task='+selectedTask+'&reqId='+newID);
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
                    case 'enter': submitIndividual()
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
}


function buildIndividuals() {
    /** Builds the individuals' bounding boxes in the currently-viewed images. */

    // Clear all
    for (let mapID in dbDetIds) {
        for (let leafletID in dbDetIds[mapID]) {
            drawnItems[mapID]._layers[leafletID].unbindTooltip()
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
            for (let leafletID in dbDetIds[mapID]) {
                if (individuals[individualIndex][individualID].detections.includes(parseInt(dbDetIds[mapID][leafletID]))) {
                    drawnItems[mapID]._layers[leafletID].setStyle({color: colour})
                    drawnItems[mapID]._layers[leafletID].bindTooltip(individualName,{permanent: true, direction:"center"})

                    var center = L.latLng([(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat)/2,(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng)/2])
                    var bottom = L.latLng([drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat,(drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng+drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng)/2])
                    var centerPoint = map[mapID].latLngToContainerPoint(center)
                    var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
                    var offset = [0,centerPoint.y-bottomPoint.y]
            
                    drawnItems[mapID]._layers[leafletID]._tooltip.options.offset = offset
                    drawnItems[mapID]._layers[leafletID]._tooltip.options.opacity = 0.8
                    drawnItems[mapID]._layers[leafletID].openTooltip()
                    if (!toolTipsOpen) {
                        rect.closeTooltip()
                    }
                }
            }
        }

        // Set in pools
        for (let mapID in clusters) {
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
            buildIndividuals()
            modalNewIndividual.modal('hide');
        } else {
            document.getElementById('newIndividualErrors').innerHTML = 'That is a reserved name. Please choose another.'
        }
    }
}

btnSubmitIndividual.addEventListener('click', ()=>{
    /** Listener that submits the new-individual form on button press. */
    submitIndividual()
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
    submitIndividuals()
});

function hideBoundingLabels() {
    /** Hides/shows the bounding box labels. */
    for (let mapID in drawnItems) {
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
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function (wrapDetID,wrapMapID) {
            return function() {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                } else if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    if (reply.status == 'success') {
                        for (let i=0;i<clusters[wrapMapID][clusterIndex[wrapMapID]].images.length;i++) {
                            if (wrapDetID==clusters[wrapMapID][clusterIndex[wrapMapID]].images[i].detections[0].id) {
                                actions.push(['dissociation',wrapDetID,JSON.parse(JSON.stringify(clusters[wrapMapID][clusterIndex[wrapMapID]].images[i])),wrapMapID,clusters[wrapMapID][clusterIndex[wrapMapID]].id])
                                clusters[wrapMapID][clusterIndex[wrapMapID]].images.splice(i, 1)
                                break
                            }
                        }
    
                        sliderIndex[wrapMapID] = '-1'
                        update(wrapMapID)
                    }
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