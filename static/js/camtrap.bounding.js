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

document.addEventListener('click', function(event){
    /** Un-highlights the selected bounding box */
    if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
        if (event.target.classList.contains('leaflet-interactive')==false&&event.target.classList.contains('bounding-btn')==false){
            clearBoundingSelect()  
        }   
    }   
    
});

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

function updateTargetRect (e) {
    /** Updates the targetRect global to the Leaflet ID of the recangle clicked on by the user. */
    if (e.relatedTarget) {
        targetRect = e.relatedTarget._leaflet_id
    }
    contextLocation = e.latlng
    targetUpdated = true
}

function sightingAnalysisMapPrep(mapID = 'map1') {
    /** Preps the map for sighting analysis by editing the draw controls, and adding the species context menu. */

    map[mapID].on("draw:deletestart", function(e) {
        drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = '(F)inish'
        drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.title = 'Accept changes'
        drawControl._toolbars.edit._actionsContainer.children[2].firstElementChild.innerHTML = '(C)lear all'
        drawControl._toolbars.edit._actionsContainer.children[2].firstElementChild.title = 'Remove all sightings'
        editingEnabled = true

        clearBoundingSelect()
    })

    map[mapID].on("draw:deletestop", function(e) {
        editingEnabled = false
    })

    map[mapID].on("draw:editstart", function(e) {
        if (toolTipsOpen) {
            for (let layer in drawnItems[mapID]._layers) {
                drawnItems[mapID]._layers[layer].closeTooltip()
            }
        }
        drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = '(F)inish'
        drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.title = 'Accept changes'
        editingEnabled = true

        clearBoundingSelect()
    })

    map[mapID].on("draw:editstop", function(e) {
        if (toolTipsOpen) {
            for (let layer in drawnItems[mapID]._layers) {
                drawnItems[mapID]._layers[layer].openTooltip()
            }
        }
        editingEnabled = false
    })

    map[mapID].on("draw:drawstart", function(e) {
        editingEnabled = true

        clearBoundingSelect()
    })

    map[mapID].on("draw:drawstop", function(e) {
        editingEnabled = false
    })

    map[mapID].on('draw:created', function (e) {
        var type = e.layerType,
            layer = e.layer;

        layer.bindTooltip(clusters[mapID][clusterIndex[mapID]].label[0],{permanent: true, direction:"center"}).openTooltip()
        drawnItems[mapID].addLayer(layer)
        if (!toolTipsOpen) {
            layer.closeTooltip()
        }
        dbDetIds[mapID][layer._leaflet_id] = 'n'+addDetCnt.toString()
        addDetCnt+=1

        // add eventlistener to highligh bounding box when selected
        layer.on('click', function() {
            var colour = "rgba(223,105,26,1)"
            for (let leafletID in drawnItems[mapID]._layers) {
                drawnItems[mapID]._layers[leafletID].setStyle({color: colour}); //un-highlight all selections
            }
            this.setStyle({color: "rgba(225,225,225,1)"}); //highlight selected
            prevClickBounding = {'rect': this};
        });
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

    map[mapID].on('contextmenu', function (e) {
        /** remove duplicate items on more than one right click */
        if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
            nr_items = 2*clusters[mapID][clusterIndex[mapID]].label.length + 1

            if(map[mapID].contextmenu._items.length > nr_items){
                for (let i=map[mapID].contextmenu._items.length-1;i>nr_items-1;i--) 
                {
                    map[mapID].contextmenu.removeItem(i)
                }
            } 
        } else {
            map[mapID].contextmenu.hide()
        }
    });

    map[mapID].on('contextmenu.select', function (e) {
        if (targetUpdated) {           
            if (e.el.textContent=='▼') {
                multiContextVal += 1
                map[mapID].contextmenu.removeAllItems()
                buildContextMenu()  
            } else if (e.el.textContent=='▲') {
                multiContextVal -= 1
                map[mapID].contextmenu.removeAllItems()
                buildContextMenu()  
            } else {
                if (e.el.textContent=='+') {
                    plusInProgress = true
                }

                if (plusInProgress) {
                    plusFunc(e.el.textContent)
                } else {
                    drawnItems[mapID]._layers[targetRect].closeTooltip()
                    drawnItems[mapID]._layers[targetRect]._tooltip._content=e.el.textContent
                    if (toolTipsOpen) {
                        drawnItems[mapID]._layers[targetRect].openTooltip()
                    }
                    plusInProgress = false
                    currentHierarchicalLevel = []
                }
            }
            targetUpdated = false
        } else {
            alert('Error! Select is being handled before target updated.')
        }
    });
}

function plusFunc(labelText,mapID = 'map1') {
    /** 
     * Function for handling user input from the species context menu, navigating the user through the hierarchical levels. 
     * @param {str} labelText The name of the selected label
    */
   
    currentLevel = JSON.parse(JSON.stringify(labelHierarchy))
    for (let i=0;i<currentHierarchicalLevel.length;i++) {
        currentLevel = JSON.parse(JSON.stringify(currentLevel[currentHierarchicalLevel[i]]))
    }

    if (labelText != '+') {
        currentLevel = JSON.parse(JSON.stringify(currentLevel[labelText]))
        currentHierarchicalLevel.push(labelText)
    }

    if (Object.keys(currentLevel).length==0) {
        drawnItems[mapID]._layers[targetRect].closeTooltip()
        drawnItems[mapID]._layers[targetRect]._tooltip._content=labelText
        if (toolTipsOpen) {
            drawnItems[mapID]._layers[targetRect].openTooltip()
        }
        plusInProgress = false
        currentHierarchicalLevel = []
        map[mapID].contextmenu.removeAllItems()
    } else {
        map[mapID].contextmenu.removeAllItems()
        subDividedContList = []
        tempList = []
        counter = 0
        for (let label in currentLevel) {
            tempList.push(label)
            counter += 1
            if (counter==10) {
                subDividedContList.push(tempList)
                tempList = []
                counter = 0
            }
        }
        subDividedContList.push(tempList)
        multiContextVal = 0
        buildContextMenu()        
    }
}

function buildContextMenu(mapID = 'map1') {
    /** Builds a new context menu with the updated list of global options. */

    indexNum = 0
    if (multiContextVal > 0) {
        item = {
            text: '▲',
            index: indexNum,
            callback: updateTargetRect
        }
        indexNum += 1
        map[mapID].contextmenu.addItem(item)

        item = {
            separator: true,
            index: indexNum,
        }
        indexNum += 1
        map[mapID].contextmenu.addItem(item)
    }

    for (let i=0;i<subDividedContList[multiContextVal].length;i++) {
        item = {
            text: subDividedContList[multiContextVal][i],
            index: indexNum,
            callback: updateTargetRect
        }
        indexNum += 1
        map[mapID].contextmenu.addItem(item)

        if (i < subDividedContList[multiContextVal].length-1) {
            item = {
                separator: true,
                index: indexNum,
            }
            indexNum += 1
            map[mapID].contextmenu.addItem(item)
        }
    }

    if (multiContextVal < subDividedContList.length-1) {
        item = {
            separator: true,
            index: indexNum,
        }
        indexNum += 1
        map[mapID].contextmenu.addItem(item)
        
        item = {
            text: '▼',
            index: indexNum,
            callback: updateTargetRect
        }
        indexNum += 1
        map[mapID].contextmenu.addItem(item)
    }

    map[mapID].contextmenu.showAt(contextLocation)
}

function setRectOptions(mapID = 'map1') {
    /** Sets the bounding box label, context menu options, and initialises the draw control. */

    menuItems = []
    indexNum = 0
    for (let i=0;i<clusters[mapID][clusterIndex[mapID]].label.length;i++) {
        item = {
            text: clusters[mapID][clusterIndex[mapID]].label[i],
            index: indexNum,
            callback: updateTargetRect
        }
        indexNum += 1
        menuItems.push(item)

        item = {
            separator: true,
            index: indexNum,
        }
        indexNum += 1
        menuItems.push(item)
    }

    // Add other label
    item = {
        text: '+',
        index: indexNum,
        callback: updateTargetRect
    }
    menuItems.push(item)

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

    if (drawControl != null) {
        drawControl.remove()
    }

    drawControl = new L.Control.Draw({
        draw: {
            polygon: false,
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false,
            rectangle: {
                shapeOptions: rectOptions,
                showArea: false
            }
        },
        edit: {
            featureGroup: drawnItems[mapID]
        }
    });
    map[mapID].addControl(drawControl);
    drawControl._toolbars.draw._toolbarContainer.firstElementChild.title = '(A)dd a sighting'
}

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
                    clusters[wrapMapID][wrapClusterID].ready = true
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


function saveBounding() {
    /** Saves the current bounding box edit. */

    if (drawControl._toolbars.edit._activeMode) {
        drawControl._toolbars.edit._save()
    }
}

function cancelBounding() {
    /** Cancels the current draw/edit/delete session. */

    if (drawControl._toolbars.draw._activeMode) {//draw active
        drawControl._toolbars.draw._actionsContainer.firstElementChild.firstElementChild.click()
    } else if (drawControl._toolbars.edit._activeMode) {
        if (drawControl._toolbars.edit._activeMode.buttonIndex==0) {//edit active
            drawControl._toolbars.edit._actionsContainer.lastElementChild.firstElementChild.click()
        } else if (drawControl._toolbars.edit._activeMode.buttonIndex==1) {//delete active
            drawControl._container.lastElementChild.lastElementChild.children[1].firstElementChild.click()
        }
    }
}

function deleteBounding() {
    /** Enters/exits delete mode. */
    handled = false
    if (drawControl._toolbars.edit._activeMode) {
        if (drawControl._toolbars.edit._activeMode.buttonIndex==1) {//delete active
            drawControl._container.lastElementChild.lastElementChild.children[1].firstElementChild.click()
            handled = true
        }
    }
    if (!handled) {
        drawControl._toolbars.edit._modes.remove.handler.enable()
    }
}

function addBounding() {
    /** Enters/exits add sighting mode. */
    if (drawControl._toolbars.draw._activeMode) {//draw active
        drawControl._toolbars.draw._actionsContainer.firstElementChild.firstElementChild.click()
    } else {
        drawControl._toolbars.draw._modes.rectangle.button.click()
    }
}

function editBounding() {
    /** Enters/exits the edit bounding box mode. */
    handled = false
    if (drawControl._toolbars.edit._activeMode) {
        if (drawControl._toolbars.edit._activeMode.buttonIndex==0) {//edit active
            drawControl._toolbars.edit._actionsContainer.lastElementChild.firstElementChild.click()
            handled = true
        }
    }
    if (!handled) {
        drawControl._toolbars.edit._modes.edit.handler.enable()
    }
}

function clearBounding() {
    /** Clear all bounding boxes. */
    if (drawControl._toolbars.edit._activeMode) {
        if (drawControl._toolbars.edit._activeMode.buttonIndex==1) {//delete active
            drawControl._container.lastElementChild.lastElementChild.children[2].firstElementChild.click()
        }
    }
}

function hideBoundingLabels(mapID = 'map1') {
    /** Toggle show/hide bounding boxes. */
    editActive = false
    if (drawControl._toolbars.edit._activeMode) {
        if (drawControl._toolbars.edit._activeMode.buttonIndex==0) {
            editActive = true
        }
    }

    if (!editActive) {
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

function sendBoundingBack() {
    /** Activates 'send to back' mode. */
    clearBoundingSelect()
    if (sendBackBoundingMode) {
        sendBackBoundingMode = false
        document.getElementById('btnSendBoundingBack').setAttribute('class','btn btn-primary btn-block')
        document.getElementById('btnSendBoundingBack').innerHTML = 'Send to (B)ack'
    } else {
        sendBackBoundingMode = true
        document.getElementById('btnSendBoundingBack').setAttribute('class','btn btn-danger btn-block')
        document.getElementById('btnSendBoundingBack').innerHTML = 'Cancel'
    }  

}

function clearBoundingSelect(mapID = 'map1') {
    /** Clears(Un-highlight) the selected bounding box */
    colour = "rgba(223,105,26,1)"
    for (let leafletID in drawnItems[mapID]._layers) {
        drawnItems[mapID]._layers[leafletID].setStyle({color: colour}); //un-highlight all selections
    }
    prevClickBounding = null
}

function fetchLabelHierarchy() {
    /** Fetches the label hierarchy, and saves it in the labelHierarchy global. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            labelHierarchy = JSON.parse(this.responseText);
        }
    }
    xhttp.open("GET", '/getLabelHierarchy/'+selectedTask);
    xhttp.send();
}

function buildBoundingKeys(mapID='map1'){
    /** Builds the buttons for the bounding keys */
    while(divBtns.firstChild){
        divBtns.removeChild(divBtns.firstChild);
    }
    hotkeys = Array(10).fill(EMPTY_HOTKEY_ID)

    current_labels = clusters[mapID][clusterIndex[mapID]].label
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
        selected_colour = "rgba(225,225,225,1)";
        none_selected = true 

        for (let leafletID in drawnItems[mapID]._layers) {
            if (drawnItems[mapID]._layers[leafletID].options.color==selected_colour) {
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