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
isIDing = false
isStaticCheck = false
isTimestampCheck = false

var drawControl = null
var toolTipsOpen = true
var editingEnabled = false
var maskId = {'map1': null}
var maskLayer = {'map1': null}
var classCheckOriginalLevel = null
var boundingBackControl = null
var clusterIdList = []
var dbDetIds = {'map1': {}}
var addDetCnt = 0
// const modalNote = $('#modalNote');

function loadNewCluster(mapID = 'map1') {
    /** Requests the next back of clusters from the server. */
    if (!waitingForClusters[mapID]) {
        waitingForClusters[mapID] = true
        var newID = Math.floor(Math.random() * 100000) + 1;
        clusterRequests[mapID].push(newID)

        if (!batchComplete) {
            var formData = new FormData();
            if (clusterIdList.length>0) {
                // In case the batch size is huge, only send the last n cluster IDs. Only the last couple where the labels have yet to be processed are needed anyway.
                formData.append('cluster_id_list', clusterIdList.slice(-100));
            }

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
                                            if (isClassCheck) {
                                                tempClassifications[mapID].push(newcluster.classification.slice())
                                            }
                                        }

                                        // if (taggingLevel.includes('-2') && (multipleStatus==false)) {
                                        //     activateMultiple()
                                        // }
                                        
                                        if (clusters[mapID].length-1 == clusterIndex[mapID]){
                                            // updateCanvas()
                                            // updateButtons()
                                            if (isClassCheck) {
                                                baseClassifications = clusters[mapID][clusterIndex[mapID]].classification.slice()
                                            }
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
                        }                
                    }
                };
            xhttp.open("POST", '/getCluster?task='+selectedTask+'&reqId='+newID);
            xhttp.send(formData);
        }
    }
}

function suggestionBack(resetLabels=true,mapID='map1') {
    /** Returns the tagging level back to the correct value for the classification check and intialises the keys. */
    if (resetLabels) {
        clusters[mapID][clusterIndex[mapID]][ITEMS] = orginal_labels
        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = orginal_label_ids
        updateDebugInfo()
    }
    if (isClassCheck) {
        taggingLevel = classCheckOriginalLevel
    }
    // else if (isMaskCheck) {
    //     taggingLevel = '-6'
    // }
    getKeys()
}

// function populateLevels() {
//     /** Populates the tagging-level selector options. */
//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 278) {
//             window.location.replace(JSON.parse(this.responseText)['redirect'])
//         } else if (this.readyState == 4 && this.status == 200) {
//             species = JSON.parse(this.responseText);
//             ss = document.getElementById('level-selector')

//             while(ss.firstChild){
//                 ss.removeChild(ss.firstChild);
//             }

//             for (let i=0;i<species.length;i++) {
//                 a = document.createElement('button')
//                 a.classList.add('dropdown-item');
//                 a.setAttribute('type', 'button')
//                 a.setAttribute('onclick', 'switchTaggingLevel('+species[i][0] +')')
//                 a.innerHTML = species[i][1]
//                 ss.appendChild(a)
//             }
//             switchTaggingLevel(species[0][0])
//         }
//     }
//     xhttp.open("GET", '/getTaggingLevels');
//     xhttp.send();
// }

function getKeys() {
    /** Sets up the keys, depending on the current tagging level. */
    if (!isBounding) {
        if ((taggingLevel == '-3')||(taggingLevel == '-8')) {
            // classifier check
            multipleStatus = false
            selectBtns = document.getElementById('selectBtns')

            while(selectBtns.firstChild){
                selectBtns.removeChild(selectBtns.firstChild);
            }

            while(divBtns.firstChild){
                divBtns.removeChild(divBtns.firstChild);
            }

            var newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-primary');
            newbtn.innerHTML = 'Accept (A)';
            newbtn.setAttribute("id", 1);
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            newbtn.addEventListener('click', (evt)=>{
                assignLabel('accept_classification');
            });
            divBtns.appendChild(newbtn);

            var newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-primary');
            newbtn.innerHTML = 'Reject (R)';
            newbtn.setAttribute("id", 2);
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            newbtn.addEventListener('click', (evt)=>{
                assignLabel('reject_classification');
            });
            divBtns.appendChild(newbtn);

            var newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-primary');
            newbtn.innerHTML = 'Overwrite (space)';
            newbtn.setAttribute("id", 3);
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            newbtn.addEventListener('click', (evt)=>{
                assignLabel('overwrite_classification');
            });
            divBtns.appendChild(newbtn);

            var newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-primary');
            newbtn.innerHTML = 'Other (O)';
            newbtn.setAttribute("id", 1);
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            newbtn.addEventListener('click', (evt)=>{
                assignLabel('other_classification');
            });
            divBtns.appendChild(newbtn);

            hotkeys = Array(38).fill(EMPTY_HOTKEY_ID)
            hotkeys[10] = 'accept_classification' //a
            hotkeys[27] = 'reject_classification' //r
            hotkeys[24] = 'other_classification' //o
            hotkeys[36] = 'overwrite_classification' //space

            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/initKeys', true);
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        globalKeys = JSON.parse(this.responseText);
                    }
                }
            xhttp.send();


        } else if (isTagging && maskMode && (taggingLevel == '-1' || parseInt(taggingLevel) > 0)) {
            multipleStatus = false
            selectBtns = document.getElementById('selectBtns')

            while(selectBtns.firstChild){
                selectBtns.removeChild(selectBtns.firstChild);
            }

            while(divBtns.firstChild){
                divBtns.removeChild(divBtns.firstChild);
            }

            var newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-primary');
            newbtn.innerHTML = 'Submit Masks (S)';
            newbtn.setAttribute("id", 1);
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            newbtn.addEventListener('click', (evt)=>{
                assignLabel('submit_mask');
            });

            divBtns.appendChild(newbtn);

            var newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-primary');
            newbtn.innerHTML = 'Cancel (C)';
            newbtn.setAttribute("id", 2);
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            newbtn.addEventListener('click', (evt)=>{
                assignLabel('cancel_mask');
            });

            divBtns.appendChild(newbtn);

            hotkeys = Array(38).fill(EMPTY_HOTKEY_ID)
            hotkeys[28] = 'submit_mask' //s
            hotkeys[12] = 'cancel_mask' //c

            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/initKeys', true);
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        globalKeys = JSON.parse(this.responseText);
                    }
                }
            xhttp.send();

        // } else if (taggingLevel == '-6') {
        //     multipleStatus = false
        //     selectBtns = document.getElementById('selectBtns')

        //     while(selectBtns.firstChild){
        //         selectBtns.removeChild(selectBtns.firstChild);
        //     }

        //     while(divBtns.firstChild){
        //         divBtns.removeChild(divBtns.firstChild);
        //     }

        //     var newbtn = document.createElement('button');
        //     newbtn.classList.add('btn');
        //     newbtn.classList.add('btn-primary');
        //     newbtn.innerHTML = 'Accept (A)';
        //     newbtn.setAttribute("id", 1);
        //     newbtn.classList.add('btn-block');
        //     newbtn.classList.add('btn-sm');
        //     newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
        //     newbtn.addEventListener('click', (evt)=>{
        //         console.log('accept')
        //         assignLabel('accept_mask');
        //     });
        //     divBtns.appendChild(newbtn);

        //     var newbtn = document.createElement('button');
        //     newbtn.classList.add('btn');
        //     newbtn.classList.add('btn-primary');
        //     newbtn.innerHTML = 'Reject (R)';
        //     newbtn.setAttribute("id", 2);
        //     newbtn.classList.add('btn-block');
        //     newbtn.classList.add('btn-sm');
        //     newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
        //     newbtn.addEventListener('click', (evt)=>{
        //         console.log('reject')
        //         assignLabel('reject_mask');
        //     });
        //     divBtns.appendChild(newbtn);

        //     hotkeys = Array(38).fill(EMPTY_HOTKEY_ID)
        //     hotkeys[10] = 'accept_mask' //a
        //     hotkeys[27] = 'reject_mask' //r

        //     var xhttp = new XMLHttpRequest();
        //     xhttp.open("GET", '/initKeys', true);
        //     xhttp.onreadystatechange =
        //         function () {
        //             if (this.readyState == 4 && this.status == 278) {
        //                 window.location.replace(JSON.parse(this.responseText)['redirect'])
        //             } else if (this.readyState == 4 && this.status == 200) {
        //                 globalKeys = JSON.parse(this.responseText);
        //             }
        //         }
        //     xhttp.send();

        } else {
            if (globalKeys==null) {
                var xhttp = new XMLHttpRequest();
                xhttp.open("GET", '/initKeys', true);
                xhttp.onreadystatechange =
                    function () {
                        if (this.readyState == 4 && this.status == 278) {
                            window.location.replace(JSON.parse(this.responseText)['redirect'])
                        } else if (this.readyState == 4 && this.status == 200) {
                            globalKeys = JSON.parse(this.responseText);
                            initKeys(globalKeys[taggingLevel]);
                            if (taggingLevel.includes('-2') && (multipleStatus==false)) {
                                activateMultiple()
                            }
                        }
                    }
                xhttp.send();
            } else {
                initKeys(globalKeys[taggingLevel])
            }
        }
    }
}

function knockdown(mapID = 'map1'){
    /** Marks the currently-viewed image as knocked down if it is not already labelled as such. */
    if (!clusters[mapID][clusterIndex[mapID]][ITEMS].includes(downLabel)) {
        knockedTG = clusters[mapID][clusterIndex[mapID]].trapGroup
        clusterRequests[mapID] = [];
        clusters[mapID] = clusters[mapID].slice(0,clusterIndex[mapID]+1);
        imageID=clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id
        clusterID=clusters[mapID][clusterIndex[mapID]].id
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            }
        }
        xhttp.open("GET", '/knockdown/'+imageID+'/'+clusterID, true);
        xhttp.send();
    
        clusters[mapID][clusterIndex[mapID]][ITEMS] = [downLabel];
        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = [downLabel];

        if (batchComplete) {
            redirectToDone()
        }

        clusterIndex[mapID] += 1
        imageIndex[mapID] = 0
    }
    nextCluster()
}   

function UndoKnockDown(label,mapID = 'map1') {
    /** Marks a knocked-down cluster as not knocked down. */
    imageID=clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id
    clusterID=clusters[mapID][clusterIndex[mapID]].id
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 278) {
            window.location.replace(JSON.parse(this.responseText)['redirect'])
        }
    }
    xhttp.open("GET", '/undoknockdown/'+imageID+'/'+clusterID+'/'+label, true);
    xhttp.send();

    clusters[mapID] = clusters[mapID].slice(0,clusterIndex[mapID]+1);
    clusters[mapID][clusterIndex[mapID]][ITEMS] = [unKnockLabel,label]
    clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = [unKnockLabel,label]
    if (!multipleStatus) {
        if (batchComplete) {
            window.location.replace("done")
        }
        nextCluster()
    }
}

// function Notes() {
//     /** Submits the users note to the server if there is one, otherwise just closes the modal. */
//     if (modalNote.is(':visible')) {
//         sendNote()
//     } else {
//         document.getElementById("notebox").value = ''
//         modalNote.modal({keyboard: true});
//     }
// }

// function sendNote(mapID = 'map1') {
//     /** Sends the note to the server. */
//     note = document.getElementById("notebox").value

//     if (note.length > 512) {
//         document.getElementById('notif').innerHTML = "A note cannot be more than 512 characters."
//     } else {

//         if (note != "") {
//             clusterID=clusters[mapID][clusterIndex[mapID]].id
//             var xhttp = new XMLHttpRequest();
//             xhttp.onreadystatechange =
//             function(){
//                 if (this.readyState == 4 && this.status == 278) {
//                     window.location.replace(JSON.parse(this.responseText)['redirect'])
//                 }
//             }
//             xhttp.open("GET", '/assignNote/'+clusterID+'/'+note, true);
//             xhttp.send();
//         }
    
//         modalNote.modal('hide');
//     }
// }

window.addEventListener('load', onload, false);

btnDone.addEventListener('click', ()=>{
    /** Wraps up a users session when they click the done button. */
    window.location.replace("done")
});

// Handles the modalActive state on shown/hidden
modalWait.on('shown.bs.modal', function(){
    modalActive = true;
});
modalWait.on('hidden.bs.modal', function(){
    modalActive = false;
});
modalNote.on('shown.bs.modal', function(){
    /** Additionally focuses on the note box when it is opened. */
    modalActive = true;
    document.getElementById('notebox').value = clusters['map1'][clusterIndex['map1']].notes
    var length = document.getElementById('notebox').value.length;
    document.getElementById('notebox').setSelectionRange(length, length);
    document.getElementById('notebox').focus()
});
modalNote.on('hidden.bs.modal', function(){
    /** Additionally clears the note box when it is closed. */
    modalActive = false;
    document.getElementById('notebox').value = ''
    document.getElementById('notif').innerHTML = ""
});


function taggingMapPrep(mapID = 'map1') {
    /** Preps the map for masking and tagging. */

    map[mapID].on("draw:drawstart", function(e) {
        editingEnabled = true
    })

    map[mapID].on("draw:drawstop", function(e) {
        editingEnabled = false
    })

    map[mapID].on("draw:editstart", function(e) {
        editingEnabled = true
        if (!maskMode) {
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = 'Finish'
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.title = 'Accept changes'
        }
    })

    map[mapID].on("draw:editstop", function(e) {
        editingEnabled = false
    })

    map[mapID].on("draw:deletestart", function(e) {
        editingEnabled = true
        if (!maskMode) {
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.innerHTML = 'Finish'
            drawControl._toolbars.edit._actionsContainer.children[2].firstElementChild.innerHTML = 'Clear all'
            drawControl._toolbars.edit._actionsContainer.children[0].firstElementChild.title = 'Accept changes'
            drawControl._toolbars.edit._actionsContainer.children[2].firstElementChild.title = 'Remove all sightings'
        }
    })

    map[mapID].on("draw:deletestop", function(e) {
        editingEnabled = false
    })

    map[mapID].on('draw:created', function (e) {
        if (maskMode) {
            var newLayer = e.layer;
            var newBounds = newLayer.getBounds();
            var isOverlapping = false;

            drawnMaskItems[mapID].eachLayer(function (layer) {
                if (newBounds.intersects(layer.getBounds())) {
                    isOverlapping = true;
                }
            });

            if (isOverlapping) {
                document.getElementById('modalAlertText').innerHTML = "The masked area you've outlined overlaps with another masked area. A detection will only be considered masked if it is fully within the boundaries of a single mask. It is recommended that you either adjust the existing mask to cover the entire detection area or delete it and create a new one."
                modalAlert.modal({keyboard: true});
                drawnMaskItems[mapID].removeLayer(newLayer);
            } else {
                drawnMaskItems[mapID].addLayer(newLayer);  
            }
        } else {
            var newLayer = e.layer;
            drawnItems[mapID].addLayer(newLayer);  
            dbDetIds[mapID][newLayer._leaflet_id] = 'n'+addDetCnt.toString()
            addDetCnt+=1
            let action = 'add'
            let detection_edits = {}
            detection_edits[dbDetIds[mapID][newLayer._leaflet_id]] = {
                'top': newLayer.getBounds().getNorthEast().lat/mapHeight[mapID],
                'bottom': newLayer.getBounds().getSouthWest().lat/mapHeight[mapID],
                'left': newLayer.getBounds().getSouthWest().lng/mapWidth[mapID],
                'right': newLayer.getBounds().getNorthEast().lng/mapWidth[mapID]
            }
            submitSightingChanges(detection_edits, action) 
        }

    });

    map[mapID].on('draw:edited', function(e) {
        if (!maskMode) {
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
                    }
                }
            });
            submitSightingChanges(detection_edits, action)
        }
    });

    map[mapID].on('draw:deleted', function(e) {
        if (!maskMode) {
            let action = 'delete'
            let detection_ids = []
            // traverse the event layers and get the detection ids
            var layers = e.layers
            layers.eachLayer(function(layer) {
                detection_ids.push(Number(dbDetIds[mapID][layer._leaflet_id]))
            });

            submitSightingChanges(detection_ids, action)
        }
    });

    map[mapID].on('contextmenu', function (e) {
        /** remove duplicate items on more than one right click */
        if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
            nr_items = 3
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
        if (!maskMode) {
            if (targetUpdated) {
                if (e.el.textContent == 'EDIT') {
                    editBounding()
                }
                else if (e.el.textContent == 'DELETE') {
                    // immediately delete the bounding box
                    drawnItems[mapID].removeLayer(drawnItems[mapID]._layers[targetRect])
                    if (!isBounding) {
                        let action = 'delete'
                        let detection_ids = [Number(dbDetIds[mapID][targetRect])]
                        submitSightingChanges(detection_ids, action)
                    }
                }
                targetUpdated = false
            }
            else {
                alert('Error! Select is being handled before target updated.')
            }
        } else {
            map[mapID].contextmenu.hide()
        }
    });

}

function maskArea(mapID = 'map1') {
    /** Masks the area drawn by the user. */
    if (!clusters[mapID][clusterIndex[mapID]][ITEMS].includes(maskLabel)) {
        updateMasks(mapID)
        if (globalMasks[mapID].length > 0 && globalMasks[mapID][0] != -1) {
            maskedTG = clusters[mapID][clusterIndex[mapID]].trapGroup
            clusterRequests[mapID] = [];
            clusters[mapID] = clusters[mapID].slice(0,clusterIndex[mapID]+1);
            imageID=clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id
            clusterID=clusters[mapID][clusterIndex[mapID]].id

            var formData = new FormData();
            formData.append('masks', JSON.stringify(globalMasks[mapID]));
            formData.append('cluster_id', clusterID);
            formData.append('image_id', imageID);

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                }
            }
            xhttp.open("POST", '/maskArea', true);
            xhttp.send(formData);

            clusters[mapID][clusterIndex[mapID]][ITEMS] = [maskLabel];
            clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = [maskLabel];

            if (batchComplete) {
                redirectToDone()
            }

            clusterIndex[mapID] += 1
            imageIndex[mapID] = 0

            if (drawnMaskItems[mapID] != null) {
                drawnMaskItems[mapID].eachLayer(function (layer) {
                    drawnMaskItems[mapID].removeLayer(layer);
                });
            }
            
            if (drawControl != null) {
                drawControl.remove()
            }

            if (boundingBackControl != null) {
                boundingBackControl.remove()
            }
        
            updateMasks(mapID)
        
            maskMode = false
            multipleStatus = false
            getKeys()

            nextCluster()
        }
        else if (globalMasks[mapID][0] == -1) {
            document.getElementById('modalAlertText').innerHTML = 'The area you have masked is too small. Please try again.'
            modalAlert.modal({keyboard: true});
        }
        else {
            document.getElementById('modalAlertText').innerHTML = 'You have no masked areas. Please draw a mask and try again or cancel if you do not wish to mask this image.'
            modalAlert.modal({keyboard: true});
        }
    }
} 

function updateMasks(mapID = 'map1') {
    /** Updates the masks on the map. */
    globalMasks[mapID] = []
    if (drawnMaskItems[mapID] != null) {
        drawnMaskItems[mapID].eachLayer(function (layer) {
            mask_dict = {}
            if (layer instanceof L.Polygon) {
                mask_dict['poly_coords'] = []
                layer._latlngs[0].forEach(function (point) {
                    mask_dict['poly_coords'].push([point.lng/mapWidth[mapID], point.lat/mapHeight[mapID]])
                });
                mask_dict['poly_coords'].push(mask_dict['poly_coords'][0])

                // Create a box around the polygon
                poly_box = {}
                poly_box['top'] = layer._bounds._northEast.lat/mapHeight[mapID]
                poly_box['bottom'] = layer._bounds._southWest.lat/mapHeight[mapID]
                poly_box['left'] = layer._bounds._southWest.lng/mapWidth[mapID]
                poly_box['right'] = layer._bounds._northEast.lng/mapWidth[mapID]
                mask_dict['poly_box'] = poly_box

                // Check area of polygon
                var area = (poly_box['bottom']-poly_box['top']) * (poly_box['right']-poly_box['left']) 
                if (area >= 0.001) {
                    globalMasks[mapID].push(mask_dict)
                }
                else{
                    globalMasks[mapID] = [-1]
                }
            }
        });
    }
}

function initMaskMode(mapID='map1'){
    /** Initialises the map for masking. */
    if (isTagging && (taggingLevel == '-1' || parseInt(taggingLevel) > 0)) {

        if (drawControl != null) {
            drawControl.remove()
        }

        if (boundingBackControl != null) {
            boundingBackControl.remove()
        }

        drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    shapeOptions: maskRectOptions,
                    allowIntersection: false,
                },
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
                rectangle: {
                    shapeOptions: maskRectOptions,
                    showArea: false
                }
            },
            edit: {
                featureGroup: drawnMaskItems[mapID],
            }
        });
        map[mapID].addControl(drawControl);
        drawControl._toolbars.draw._toolbarContainer.children[0].title = 'Mask Area'
        drawControl._toolbars.draw._toolbarContainer.children[1].title = 'Mask Area'

    }
}

function cancelMask(mapID = 'map1') {
    /** Cancels the current mask. */
    if (drawnMaskItems[mapID] != null) {
        drawnMaskItems[mapID].eachLayer(function (layer) {
            drawnMaskItems[mapID].removeLayer(layer);
        });
    }
    
    if (drawControl != null) {
        drawControl.remove()
    }

    if (boundingBackControl != null) {
        boundingBackControl.remove()
    }

    updateMasks(mapID)

    maskMode = false
    multipleStatus = false
    getKeys()
    addTaggingControl(mapID)
}

function submitMasks(mapID = 'map1') {
    /** Submits the current masks. */
    updateMasks(mapID)
    assignLabel(maskLabel)
    modalMaskArea.modal('hide')
    addTaggingControl(mapID)
}

function setRectOptions(mapID = 'map1') {
    /** Sets the rectangle options for the draw control. */

    menuItems = []
    indexNum = 0

    let item = {
        text: 'EDIT',
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
    
    item = {
        text: 'DELETE',
        index: indexNum,
        callback: updateTargetRect
    }
    indexNum += 1
    menuItems.push(item)


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

    maskRectOptions = {
        color: "rgba(91,192,222,1)",
        fill: true,
        fillOpacity: 0.0,
        opacity: 0.8,
        weight:3,
        contextmenu: false,
    }

    addTaggingControl(mapID)
}

function addTaggingControl(mapID = 'map1') {
    /** Adds the tagging control to the map. */

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

    drawControl._toolbars.draw._toolbarContainer.firstElementChild.title = 'Add a sighting'

    if (boundingBackControl != null) {
        boundingBackControl.remove()
    }

    const BoundingBackControl = L.Control.extend({
        options: {
            position: 'topleft' 
        },
    
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar');

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

    boundingBackControl = new BoundingBackControl();
    map[mapID].addControl(boundingBackControl);
}


function sendBoundingBack() {
    /** Activates 'send to back' mode. */
    if (document.getElementById('ctrlBtnSendBoundingBack')!=null) {
        if (sendBackBoundingMode) {
            sendBackBoundingMode = false
            document.getElementById('ctrlBtnSendBoundingBack').innerHTML = '⧉'
        } else {
            sendBackBoundingMode = true
            document.getElementById('ctrlBtnSendBoundingBack').innerHTML = '✕'
        }
    }
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
                label: 'None',
                labels: ['None'],
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
            }
        }
    }(clusterIndex[mapID],imageIndex[mapID],mapID);
    xhttp.send(formData);
}

function updateTargetRect (e) {
    /** Updates the targetRect global to the Leaflet ID of the recangle clicked on by the user. */
    if (e.relatedTarget) {
        targetRect = e.relatedTarget._leaflet_id
    }
    contextLocation = e.latlng
    targetUpdated = true
}