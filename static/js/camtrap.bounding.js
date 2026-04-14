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

isTagging=false
isReviewing = false
isKnockdown = false
isBounding = true
isIDing = false
isStaticCheck = false
isTimestampCheck = false
var dbDetIds = {}
var addDetCnt
var drawControl = null
var toolTipsOpen = true
var labelHierarchy
var currentHierarchicalLevel = []
var plusInProgress = false
var contextLocation
var clusterIdList = []
var editingEnabled = false
var multiContextVal = 0
var subDividedContList
var prevClickBounding = null
var boundingClusterLabels = {}
var bounding_actions = []

// const modalNote = $('#modalNote');

function loadNewCluster(mapID = 'map1') {
    /**
     * Requests the next batch of clusters from the server, and splits each image out into it's own cluster object, 
     * thus forcing the user to look at every image in the cluster. 
     */

    if (!waitingForClusters[mapID]) {
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
        
                        if (clusterRequests[mapID].includes(parseInt(info.id))) {
                            for (let i=0;i<info.info.length;i++) {
                                newcluster = info.info[i];

                                if (((knockedTG!=null)&&(parseInt(newcluster.trapGroup)>0)&&(newcluster.trapGroup!=knockedTG))||(newcluster.id == '-101')) {
                                    knockedTG=null
                                }

                                if(((maskedTG!=null)&&(parseInt(newcluster.trapGroup)>0)&&(newcluster.trapGroup==maskedTG))||(newcluster.id == '-101')) {
                                    maskedTG=null
                                }
                                
                                if (knockedTG==null && maskedTG==null) {
                                    if ((!clusterIdList.includes(newcluster.id))||(newcluster.id=='-101')) {
                                        clusterIdList.push(newcluster.id)
                                        for (let n=0;n<newcluster.images.length;n++) {
                                            var newsubcluster = {
                                                id: newcluster.id, 
                                                images: [newcluster.images[n]],
                                                label: newcluster.label,
                                                tags: newcluster.tags,
                                                groundTruth: newcluster.groundTruth,
                                                trapGroup: newcluster.trapGroup,
                                                clusterLength: newcluster.images.length,
                                                imageIndex: n,
                                                ready: true,
                                                required: []
                                            }

                                            boundingClusterLabels[newsubcluster.id] = newsubcluster.label

                                            // Sort image detections by area
                                            newsubcluster.images[0].detections.sort((a, b) => ((b.right-b.left)*(b.bottom-b.top)) - ((a.right-a.left)*(a.bottom-a.top)))

                                            if ((clusters[mapID].length>0)&&(clusters[mapID][clusters[mapID].length-1].id=='-101')&&(clusterIndex[mapID] < clusters[mapID].length-1)) {
                                                clusters[mapID].splice(clusters[mapID].length-1, 0, newsubcluster)
                                            } else {
                                                clusters[mapID].push(newsubcluster)
                                            }

                                            if (clusters[mapID].length-1 == clusterIndex[mapID]){
                                                updateCanvas()
                                                // updateButtons()
                                            } else if (knockWait == true) {
                                                if (modalWait2.is(':visible')) {
                                                    modalWait2.modal('hide');
                                                }
                                                nextCluster()
                                            }
                                            preload()
                                            knockWait = false

                                        }
                                        updateButtons()
                                    }
                                }
                            }
                        }                
                    }
                };
            xhttp.open("POST", '/getCluster?task='+selectedTask+'&reqId='+newID);
            xhttp.send();
        }
    }
}

window.addEventListener('load', onload, false);

btnDone.addEventListener('click', ()=>{
    /** Redirects the user to the done endpoint, when they confirm that they are done. */
    window.location.replace("done")
});

modalWait.on('shown.bs.modal', function(){
    /** Set the modalActive state to true when the modal is open. */
    modalActive = true;
});
modalWait.on('hidden.bs.modal', function(){
    /** Set the state to false when closed. */
    modalActive = false;
});

modalNote.on('shown.bs.modal', function(){
    /** Set the modalActive state, and focus on the notebox. */
    modalActive = true;
    document.getElementById('notebox').value = clusters['map1'][clusterIndex['map1']].notes
    var length = document.getElementById('notebox').value.length;
    document.getElementById('notebox').setSelectionRange(length, length);
    document.getElementById('notebox').focus()
});
modalNote.on('hidden.bs.modal', function(){
    /** Clear the notebox on close. */
    modalActive = false;
    document.getElementById('notif').innerHTML = ""
    document.getElementById('notebox').value = ""
});

function submitChanges(mapID = 'map1') {
    /** Submits the updated bounding boxes to the sever. */

    if ((!map[mapID].contextmenu.isVisible())&&(finishedDisplaying[mapID] == true)&&(editingEnabled == false)&&(clusters[mapID][clusterIndex[mapID]].ready)) {
        output = {}
        idList = []
        for (let leafletID in drawnItems[mapID]._layers) {
            idList.push(dbDetIds[mapID][leafletID])
            output[dbDetIds[mapID][leafletID]] = {
                label: drawnItems[mapID]._layers[leafletID]._tooltip._content,
                top: drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat/mapHeight[mapID],
                bottom: drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat/mapHeight[mapID],
                left: drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng/mapWidth[mapID],
                right: drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng/mapWidth[mapID]
            }
            // clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections
            if (dbDetIds[mapID][leafletID].includes('n')) {
                det = {
                    id: dbDetIds[mapID][leafletID],
                    label: drawnItems[mapID]._layers[leafletID]._tooltip._content,
                    top: drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat/mapHeight[mapID],
                    bottom: drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat/mapHeight[mapID],
                    left: drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng/mapWidth[mapID],
                    right: drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng/mapWidth[mapID],
                    category: 1,
                    individual: '-1',
                    static: false
                }
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.push(det)
            } else {
                for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.length;i++) {
                    if (dbDetIds[mapID][leafletID]==clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].id.toString()) {
                        clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].label = drawnItems[mapID]._layers[leafletID]._tooltip._content,
                        clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].top = drawnItems[mapID]._layers[leafletID]._bounds._northEast.lat/mapHeight[mapID],
                        clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].bottom = drawnItems[mapID]._layers[leafletID]._bounds._southWest.lat/mapHeight[mapID],
                        clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].left = drawnItems[mapID]._layers[leafletID]._bounds._southWest.lng/mapWidth[mapID],
                        clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].right = drawnItems[mapID]._layers[leafletID]._bounds._northEast.lng/mapWidth[mapID]
                    }
                }
            }

            if (!boundingClusterLabels[clusters[mapID][clusterIndex[mapID]].id].includes(drawnItems[mapID]._layers[leafletID]._tooltip._content)){
                boundingClusterLabels[clusters[mapID][clusterIndex[mapID]].id].push(drawnItems[mapID]._layers[leafletID]._tooltip._content)
            }
        }

        to_remove = []
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.length;i++) {
            if (!idList.includes(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].id.toString())) {
                to_remove.push(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i])
            }
        }

        for (let i=0;i<to_remove.length;i++) {
            index = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.indexOf(to_remove[i])
            clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.splice(index, 1)
        }

        var formData = new FormData()
        formData.append("detections", JSON.stringify(output))
    
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/editSightings/'+clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id+'/'+selectedTask);
        xhttp.onreadystatechange =
        function(wrapClusterID,wrapMapID){
            return function() {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                }
                else if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText)
                    for (let key in reply.detIDs) {
                        for (let i=0;i<clusters[wrapMapID][wrapClusterID].images[0].detections.length;i++) {
                            if (clusters[wrapMapID][wrapClusterID].images[0].detections[i].id==key) {
                                clusters[wrapMapID][wrapClusterID].images[0].detections[i].id = reply.detIDs[key]
                            }
                        }
                    }
                    bounding_actions.push({type: 'submit'})
                    clusters[wrapMapID][wrapClusterID].ready = true
                    skip_count= bounding_actions.filter(action => action.type ==='skip').length
                    reply.progress[0] += skip_count
                    updateProgBar(reply.progress)
                    updateButtons()
                }
            }
        }(clusterIndex[mapID],mapID);
        xhttp.send(formData);
    
        clusters[mapID][clusterIndex[mapID]].ready = false
        nextCluster()
    }
}

function buildBoundingKeys(mapID='map1'){
    /** Builds the buttons for the bounding keys */
    while(divBtns.firstChild){
        divBtns.removeChild(divBtns.firstChild);
    }
    hotkeys = Array(10).fill(EMPTY_HOTKEY_ID)

    current_labels = boundingClusterLabels[clusters[mapID][clusterIndex[mapID]].id]
    current_labels.sort();
    for (let i=0;i<current_labels.length;i++) {

        var newbtn = document.createElement('button');
        newbtn.classList.add('btn');
        newbtn.classList.add('btn-primary');
        newbtn.innerHTML = current_labels[i];
        if (i<9){
            newbtn.innerHTML += ' ('+(i+1).toString()+')';
            hotkeys[i+1] = current_labels[i];
        } 
        newbtn.setAttribute("id", 1);
        newbtn.classList.add('btn-block');
        newbtn.classList.add('btn-sm');
        newbtn.classList.add('bounding-btn');
        newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
        newbtn.addEventListener('click', ()=>{
            assignBoundingLabel(current_labels[i]);
        });
        divBtns.appendChild(newbtn);

    }

    var otherBtn = document.createElement('button');
    otherBtn.classList.add('btn');
    otherBtn.classList.add('btn-info');
    otherBtn.innerHTML = 'Other (O)';
    otherBtn.setAttribute("id", 1);
    otherBtn.classList.add('btn-block');
    otherBtn.classList.add('btn-sm');
    otherBtn.classList.add('bounding-btn');
    otherBtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
    otherBtn.addEventListener('click', ()=>{
        buildOtherKeys();
    });
    divBtns.appendChild(otherBtn);

}

function buildOtherKeys(level=null, mapID='map1'){
    /** Builds the buttons for the other keys in the hierarchy */

    if (editingEnabled){
        return
    }

    while(divBtns.firstChild){
        divBtns.removeChild(divBtns.firstChild);
    }
    hotkeys = Array(10).fill(EMPTY_HOTKEY_ID)

    var backBtn = document.createElement('button');
    backBtn.classList.add('btn');
    backBtn.classList.add('btn-danger');
    backBtn.innerHTML = 'Back';
    backBtn.setAttribute("id", 1);
    backBtn.classList.add('btn-block');
    backBtn.classList.add('btn-sm');
    backBtn.classList.add('bounding-btn');
    backBtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
    backBtn.addEventListener('click', ()=>{
        if (level==null){
            buildBoundingKeys(mapID);
        } else {
            buildOtherKeys(null,mapID);
        }
    });
    divBtns.appendChild(backBtn);

    if (level == null){
        var current_labels = Object.keys(labelHierarchy);
    } else {
        var current_labels = Object.keys(labelHierarchy[level]);
    }

    for (let i=0;i<current_labels.length;i++) {
        var newbtn = document.createElement('button');
        newbtn.classList.add('btn');
        newbtn.classList.add('btn-primary');
        newbtn.innerHTML = current_labels[i];
        newbtn.setAttribute("id", 1);
        newbtn.classList.add('btn-block');
        newbtn.classList.add('btn-sm');
        newbtn.classList.add('bounding-btn');
        newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
        newbtn.addEventListener('click', ()=>{
            // check whether there is another level
            if (level == null) {
                check = Object.keys(labelHierarchy[current_labels[i]]).length > 0;
            } else {
                check = Object.keys(labelHierarchy[level][current_labels[i]]).length > 0;
            }
            if (check) {
                // If there is another level, build the keys for that level
                buildOtherKeys(current_labels[i], mapID);
            } else {
                assignBoundingLabel(current_labels[i]);
            }
        });
        divBtns.appendChild(newbtn);
    }
}

function assignBoundingLabel(label,mapID='map1') {
    /** Assigns the selected label to the currently selected bounding boxes - if nothing selected apply to all */
    if (!editingEnabled && label!=EMPTY_HOTKEY_ID){
        none_selected = true 

        for (let leafletID in drawnItems[mapID]._layers) {
            if (drawnItems[mapID]._layers[leafletID].options.color==colourSelected) {
                drawnItems[mapID]._layers[leafletID]._tooltip._content = label;
                if (toolTipsOpen) {
                    drawnItems[mapID]._layers[leafletID].openTooltip()
                }
                none_selected = false;
            }
        }

        if (none_selected){
            for (let leafletID in drawnItems[mapID]._layers) {
                drawnItems[mapID]._layers[leafletID]._tooltip._content = label;
                if (toolTipsOpen) {
                    drawnItems[mapID]._layers[leafletID].openTooltip()
                }
            }
        }

        clearBoundingSelect(mapID);
        buildBoundingKeys(mapID);
    }
}

function skipBoundingCluster(mapID='map1') {
    /** Skips the current cluster, and marks it as examined on the server. */

    var currentIndex = clusterIndex[mapID]
    var currentID = clusters[mapID][currentIndex].id
    var newIndex = currentIndex + 1
    while ((newIndex < clusters[mapID].length) && (clusters[mapID][newIndex].id == currentID)) {
        newIndex += 1
    }

    if (newIndex-1 < clusters[mapID].length) {

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            }
            else if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText)
                bounding_actions.push({type: 'skip', index: currentIndex})
                clusters[mapID][currentIndex].ready = true
                skip_count= bounding_actions.filter(action => action.type ==='skip').length
                reply.progress[0] += skip_count
                updateProgBar(reply.progress)
            }
        }
        xhttp.open("GET", '/skipBoundingCluster/'+currentID);
        xhttp.send();

        clusterIndex[mapID] = newIndex -1
        clusters[mapID][currentIndex].ready = false
        nextCluster(mapID)
    }
}