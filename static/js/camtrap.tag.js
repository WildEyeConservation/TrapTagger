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

var clisterIdList = []
// const modalNote = $('#modalNote');

function loadNewCluster(mapID = 'map1') {
    /** Requests the next back of clusters from the server. */
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
                            
                            if (knockedTG==null) {
                                if ((!clisterIdList.includes(newcluster.id))||(newcluster.id=='-101')) {
                                    clisterIdList.push(newcluster.id)

                                    if ((clusters[mapID].length>0)&&(clusters[mapID][clusters[mapID].length-1].id=='-101')&&(clusterIndex[mapID] < clusters[mapID].length-1)) {
                                        clusters[mapID].splice(clusters[mapID].length-1, 0, newcluster)
                                    } else {
                                        clusters[mapID].push(newcluster)
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
        xhttp.open("GET", '/getCluster?task='+selectedTask+'&reqId='+newID);
        xhttp.send();
    }
}

function suggestionBack(resetLabels=true,mapID='map1') {
    /** Returns the tagging level back to the correct value for the classification check and intialises the keys. */
    if (resetLabels) {
        clusters[mapID][clusterIndex[mapID]][ITEMS] = orginal_labels
        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = orginal_label_ids
        updateDebugInfo()
    }
    taggingLevel = '-3'
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
        if (taggingLevel == '-3') {
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
    document.getElementById('notebox').focus()
    document.getElementById('notebox').select()
});
modalNote.on('hidden.bs.modal', function(){
    /** Additionally clears the note box when it is closed. */
    modalActive = false;
    document.getElementById('notif').innerHTML = ""
});