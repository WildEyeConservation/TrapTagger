// Copyright 2026

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

document.addEventListener('click', function(event){
    /** Un-highlights the selected bounding box */
    if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
        if (event.target.classList.contains('leaflet-interactive')==false&&event.target.classList.contains('bounding-btn')==false&&event.target.classList.contains('select-all-bounding-btn')==false){
            if (!event.target.classList.contains('label-btn')) {
                clearBoundingSelect()  
            }
        }   
    }   
    
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
        if (isReviewing) {
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = 'Finish'
            drawControl._toolbars.edit._actionsContainer.children[2].firstElementChild.innerHTML = 'Clear all'
        } else {
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = '(F)inish'
            drawControl._toolbars.edit._actionsContainer.children[2].firstElementChild.innerHTML = '(C)lear all'
        }
        drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.title = 'Accept changes'
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
        if (isReviewing) {
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = 'Finish'
        } else {
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = '(F)inish'
        }
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
            var colour = colourBase
            if (!event.ctrlKey){
                for (let leafletID in drawnItems[mapID]._layers) {
                    drawnItems[mapID]._layers[leafletID].setStyle({color: colour}); //un-highlight all selections
                }
            }
            this.setStyle({color: colourSelected}); //highlight selected
            prevClickBounding = {'rect': this};
            if (isReviewing) {
                updateDetInfo(null, mapID)
            }
        });

        if (!isBounding) {
            let action = 'add'
            let detection_edits = {}
            detection_edits[dbDetIds[mapID][layer._leaflet_id]] = {
                'label': layer._tooltip._content,
                'top': layer.getBounds().getNorthEast().lat/mapHeight[mapID],
                'bottom': layer.getBounds().getSouthWest().lat/mapHeight[mapID],
                'left': layer.getBounds().getSouthWest().lng/mapWidth[mapID],
                'right': layer.getBounds().getNorthEast().lng/mapWidth[mapID]
            }
            submitSightingChanges(detection_edits, action)

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

    map[mapID].on('contextmenu', function (e) {
        /** remove duplicate items on more than one right click */
        if (isReviewing){
            if (document.getElementById('detIndividual').innerHTML != 'None') {
                map[mapID].contextmenu.hide()
                return
            }
        }
        if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
            // nr_items = 2*clusters[mapID][clusterIndex[mapID]].label.length + 1
            nr_items = 5

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
        if (!isBounding) {
            let has_indiv = false
            let det_id = dbDetIds[mapID][targetRect]
            for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.length;i++) {
                if (clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].id==det_id) {
                    if (clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].individual != '-1') {
                        has_indiv = true
                        return
                    }
                }
            }
        }
        if (targetUpdated) {  
            if (e.el.textContent=='▼') {
                multiContextVal += 1
                map[mapID].contextmenu.removeAllItems()
                buildContextMenu()  
            } else if (e.el.textContent=='▲') {
                multiContextVal -= 1
                map[mapID].contextmenu.removeAllItems()
                buildContextMenu()  
            } 
            else if (e.el.textContent=='EDIT') {
                editBounding()
            } else if (e.el.textContent=='DELETE') {
                // immediately delete the bounding box
                drawnItems[mapID].removeLayer(drawnItems[mapID]._layers[targetRect])
                if (!isBounding) {
                    let action = 'delete'
                    let detection_ids = [Number(dbDetIds[mapID][targetRect])]
                    submitSightingChanges(detection_ids, action)
                }
            } else if (e.el.textContent=='LABEL') {
                map[mapID].contextmenu.removeAllItems()
                indexNum = 0
                for (let i=0;i<boundingClusterLabels[clusters[mapID][clusterIndex[mapID]].id].length;i++) {
                    item = {
                        text: boundingClusterLabels[clusters[mapID][clusterIndex[mapID]].id][i],
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
                // Add other label
                item = {
                    text: '+',
                    index: indexNum,
                    callback: updateTargetRect
                }
                map[mapID].contextmenu.addItem(item)
                map[mapID].contextmenu.showAt(contextLocation)

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

                    if (!isBounding) {
                        let action = 'label'
                        let detection_edits = {
                            'ids': [Number(dbDetIds[mapID][targetRect])],
                            'label': e.el.textContent
                        }
                        submitSightingChanges(detection_edits, action)
                        document.getElementById('detLabel').innerHTML = e.el.textContent
                    }
                }
            }
            targetUpdated = false
        } else {
            alert('Error! Select is being handled before target updated.')
        }
    });

    if (!isBounding) {
        map[mapID].on('draw:edited', function(e) {
            let action = 'edit'
            let detection_edits = {}
            var layers = e.layers
            // traverse the event layers and get the detection ids
            layers.eachLayer(function(layer) {
                detection_edits[Number(dbDetIds[mapID][layer._leaflet_id])] = {
                    'bounding_box': {
                        'top': layer.getBounds().getNorthEast().lat/mapHeight[mapID],
                        'bottom': layer.getBounds().getSouthWest().lat/mapHeight[mapID],
                        'left': layer.getBounds().getSouthWest().lng/mapWidth[mapID],
                        'right': layer.getBounds().getNorthEast().lng/mapWidth[mapID]
                    },
                    'label': layer._tooltip._content
                }
            });
            submitSightingChanges(detection_edits, action)
        });

        map[mapID].on('draw:deleted', function(e) {
            let action = 'delete'
            let detection_ids = []
            // traverse the event layers and get the detection ids
            var layers = e.layers
            layers.eachLayer(function(layer) {
                detection_ids.push(Number(dbDetIds[mapID][layer._leaflet_id]))
            });

            submitSightingChanges(detection_ids, action)
        });
    }
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

        if (!isBounding) {
            let action = 'label'
            let detection_edits = {
                'ids': [Number(dbDetIds[mapID][targetRect])],
                'label': labelText
            }
            submitSightingChanges(detection_edits, action)
            document.getElementById('detLabel').innerHTML = labelText
        }

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
    let menuActions = ['EDIT', 'DELETE', 'LABEL']

    for (let action of menuActions) {
        let item = {
            text: action,
            index: indexNum,
            callback: updateTargetRect
        }
        indexNum += 1
        menuItems.push(item)

        if (action != 'LABEL') {
            item = {
                separator: true,
                index: indexNum,
            }
            indexNum += 1
            menuItems.push(item)
        }
    }

    rectOptions = {
        color: colourBase,
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
    if (isReviewing) {
        drawControl._toolbars.draw._toolbarContainer.firstElementChild.title = 'Add a sighting'
    } else {
        drawControl._toolbars.draw._toolbarContainer.firstElementChild.title = '(A)dd a sighting'
    }

    if (isReviewing) {

        if (selectAllControl != null) {
            selectAllControl.remove()
        }

        const SelectAllControl = L.Control.extend({
            options: {
                position: 'topleft' 
            },
        
            onAdd: function (map) {
                const container = L.DomUtil.create('div', 'leaflet-bar');
        
                const button = L.DomUtil.create('a', '', container);
                button.innerHTML = '✔'; 
                button.href = '#';
                button.style.color = '#333';
                button.title = 'Select All';
                button.classList.add('select-all-bounding-btn')
        
                // prevent map interactions when clicking
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.on(button, 'click', function (e) {
                    L.DomEvent.preventDefault(e);
                    selectAllBounding(mapID)
                });

                const buttonSendBoundingBack = L.DomUtil.create('a', '', container);
                buttonSendBoundingBack.innerHTML = '⧉'
                buttonSendBoundingBack.href = '#';
                buttonSendBoundingBack.style.color = '#333';
                buttonSendBoundingBack.title = 'Send to Back';
                buttonSendBoundingBack.classList.add('send-bounding-back-btn')
                buttonSendBoundingBack.id = 'ctrlBtnSendBoundingBack'

                L.DomEvent.on(buttonSendBoundingBack, 'click', function (e) {
                    L.DomEvent.preventDefault(e);
                    sendBoundingBack()
                });

                return container;
            }
        });

        selectAllControl = new SelectAllControl();
        map[mapID].addControl(selectAllControl);

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
    if (document.getElementById('btnSendBoundingBack')!=null) {
        if (sendBackBoundingMode) {
            sendBackBoundingMode = false
            document.getElementById('btnSendBoundingBack').setAttribute('class','btn btn-danger btn-block btn-sm')
            document.getElementById('btnSendBoundingBack').innerHTML = 'Send to (B)ack'
        } else {
            sendBackBoundingMode = true
            document.getElementById('btnSendBoundingBack').setAttribute('class','btn btn-danger btn-block btn-sm')
            document.getElementById('btnSendBoundingBack').innerHTML = 'Cancel'
        }  
    } else if (document.getElementById('ctrlBtnSendBoundingBack')!=null) {
        if (sendBackBoundingMode) {
            sendBackBoundingMode = false
            document.getElementById('ctrlBtnSendBoundingBack').innerHTML = '⧉'
        } else {
            sendBackBoundingMode = true
            document.getElementById('ctrlBtnSendBoundingBack').innerHTML = '✕'
        }
    }
}

function clearBoundingSelect(mapID = 'map1') {
    /** Clears(Un-highlight) the selected bounding box */
    for (let leafletID in drawnItems[mapID]._layers) {
        drawnItems[mapID]._layers[leafletID].setStyle({color: colourBase}); //un-highlight all selections
    }
    prevClickBounding = null
    if (isReviewing) {
        updateDetInfo(null, mapID)
    }
}

function selectAllBounding(mapID = 'map1') {
    /** Selects all bounding boxes. */

    for (let leafletID in drawnItems[mapID]._layers) {
        drawnItems[mapID]._layers[leafletID].setStyle({color: colourSelected}); //highlight all selections
    }
    prevClickBounding = null
    if (isReviewing) {
        updateDetInfo(null, mapID)
    }
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

function submitSightingChanges(detection_edits, action, mapID = 'map1') {
    /** Submits the changes to the server. */
    console.log(detection_edits, action)
    if (action == 'delete') {
        clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.filter(det => !detection_edits.includes(det.id))
    } else if (action == 'edit') {
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.length;i++) {
            let det_id = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].id
            if (detection_edits.hasOwnProperty(det_id)) {
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].label = detection_edits[det_id].label
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].labels = [detection_edits[det_id].label]
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].top = detection_edits[det_id].bounding_box.top
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].bottom = detection_edits[det_id].bounding_box.bottom
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].left = detection_edits[det_id].bounding_box.left
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].right = detection_edits[det_id].bounding_box.right
            }
        }
    } else if (action == 'add') {
        for (let detID in detection_edits) {
            clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.push({
                id: detID,
                label: detection_edits[detID].label,
                labels: [detection_edits[detID].label],
                top: detection_edits[detID].top,
                bottom: detection_edits[detID].bottom,
                left: detection_edits[detID].left,
                right: detection_edits[detID].right,
                category: 1,
                individual: '-1',
                individuals: ['-1'],
                individual_names: [],
                static: false,
                flank: 'None'
            })
        }
    } else if (action == 'label') {
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.length;i++) {
            let det_id = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].id
            if (detection_edits.ids.includes(det_id)) {
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].label = detection_edits.label
                clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i].labels = [detection_edits.label]
            }
        }
    }

    var formData = new FormData();
    formData.append('detection_edits', JSON.stringify(detection_edits));
    formData.append('action', JSON.stringify(action));
    formData.append('image_id', JSON.stringify(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id));

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/editSightingsGeneral/'+selectedTask);
    xhttp.onreadystatechange =
    function(wrapClusterIndex,wrapImageIndex,wrapMapID){
        return function() {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText)
                detDbIDs = reply.detDbIDs
                cluster_labels = reply.cluster_labels

                for (let detID in detDbIDs) {
                    for (let i=0;i<clusters[wrapMapID][wrapClusterIndex].images[wrapImageIndex].detections.length;i++) {
                        if (clusters[wrapMapID][wrapClusterIndex].images[wrapImageIndex].detections[i].id==detID) {
                            clusters[wrapMapID][wrapClusterIndex].images[wrapImageIndex].detections[i].id = detDbIDs[detID]
                            for (let leafID in dbDetIds[wrapMapID]) {
                                if (dbDetIds[wrapMapID][leafID]==detID) {
                                    dbDetIds[wrapMapID][leafID] = detDbIDs[detID].toString()
                                    break
                                }
                            }
                            break
                        }
                    }
                }

                for (let clusterID in cluster_labels) {
                    if (clusterID==clusters[wrapMapID][wrapClusterIndex].id) {
                        clusters[wrapMapID][wrapClusterIndex].label = cluster_labels[clusterID].label
                        clusters[wrapMapID][wrapClusterIndex].label_ids = cluster_labels[clusterID].label_ids
                        boundingClusterLabels[clusterID] = cluster_labels[clusterID].label
                        if (reply.annotator != '') {
                            clusters[wrapMapID][wrapClusterIndex].annotator = reply.annotator
                        }
                        if (reply.update_labels) {
                            for (let i=0;i<clusters[wrapMapID][wrapClusterIndex].images.length;i++) {
                                for (let j=0;j<clusters[wrapMapID][wrapClusterIndex].images[i].detections.length;j++) {
                                    if (clusters[wrapMapID][wrapClusterIndex].images[i].detections[j].label == 'None') {
                                        clusters[wrapMapID][wrapClusterIndex].images[i].detections[j].labels = cluster_labels[clusterID].label
                                        clusters[wrapMapID][wrapClusterIndex].images[i].detections[j].label = cluster_labels[clusterID].label[0]
                                    }
                                }
                            }
                        }
                    }
                }

                updateDebugInfo()
            }
        }
    }(clusterIndex[mapID],imageIndex[mapID],mapID);
    xhttp.send(formData);
}

function checkMultipleSightingsSelected(mapID = 'map1') {
    /** Checks if multiple sightings are selected. */
    let selected_count = 0
    for (let leafletID in drawnItems[mapID]._layers) {
        if (drawnItems[mapID]._layers[leafletID].options.color == colourSelected) {
            selected_count++
            if (selected_count > 1) {
                return true
            }
        }
    }
    return false
}