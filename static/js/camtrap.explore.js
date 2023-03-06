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
var currentTag = '0';
isTagging = false
isReviewing = true
isKnockdown = false
isBounding = false
isIDing = false
var blockedExploreLabels = ['Skip', 'Wrong', 'Knocked Down', 'Remove False Detections']

const divSelector = document.querySelector('#divSelector');

function loadNewCluster(mapID = 'map1') {
    /** loads the next cluster based on the IDs contained in the clusterIDs array. */
    if (clusterReadAheadIndex<clusterIDs.length) {

        var newID = Math.floor(Math.random() * 100000) + 1;
        clusterRequests[mapID].push(newID)

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 200) {
                    info = JSON.parse(this.responseText);
                    if (clusterRequests[mapID].includes(parseInt(info.id))) {
                        newcluster = info.info[0];
                        clusters[mapID].push(newcluster)
                        if (clusters[mapID].length - 1 == clusterIndex[mapID]) {
                            updateCanvas()
                            updateClusterLabels()
                        }
                        updateButtons()
                        preload()
                        exploreNotes()
                    }
                }
            };
        xhttp.open("GET", '/getCluster?id=' + clusterIDs[clusterReadAheadIndex++] + '&reqId='+newID);
        xhttp.send();
    }
}

function getKeys() {
    /** Initialises the keys for the current tagging level. */
    if (!isBounding) {
        if (globalKeys==null) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/initKeys', true);
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 200) {
                        globalKeys = JSON.parse(this.responseText);

                        for (let key in globalKeys) {
                            if (globalKeys[key].length!=0) {
                                for (let i=0;i<globalKeys[key][1].length;i++) {
                                    if (blockedExploreLabels.includes(globalKeys[key][1][i])) {
                                        globalKeys[key][1][i] = 'N'
                                        globalKeys[key][0][i] = -967
                                    }
                                }
                            }
                        }

                        res = globalKeys[taggingLevel]
    
                        // Remove undesirable names from the explore page
                        if (res.length!=0) {    
                            initKeys(res);
                        }
                    }
                }
            xhttp.send();
        } else {
            initKeys(globalKeys[taggingLevel])
        }
    }
}

function populateLevels() {
    /** Populates the tagging-level selector. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            species = JSON.parse(this.responseText);
            for (let i=0;i<species.length;i++) {
                ss = document.getElementById('level-selector')
                a = document.createElement('button')
                a.classList.add('dropdown-item');
                a.setAttribute('type', 'button')
                a.setAttribute('onclick', 'switchTaggingLevel('+species[i][0] +')')
                a.innerHTML = species[i][1]
                ss.appendChild(a)
            }
            switchTaggingLevel(species[0][0])
            switchTaggingLevel(-1)  // Loads labels by default
        }
    }
    xhttp.open("GET", '/getTaggingLevels');
    xhttp.send();
}

function getClusterIDs(mapID = 'map1'){
    /** Gets a list of cluster IDs to be explored for the current combination of task and label. */
    var xhttp = new XMLHttpRequest();
    var formData = new FormData()
    if(notesOnly){
        formData.append('notes', JSON.stringify('True'))
    }
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                clusters[mapID]=[]
                clusterReadAheadIndex = 0
                clusterIndex[mapID] = 0
                imageIndex[mapID] = 0
                updateClusterLabels()
                clusterIDs = JSON.parse(this.responseText);
                for (let i=0;i<3;i++){
                    loadNewCluster()
                }
            }
        };
    xhttp.open("POST", '/getClustersBySpecies/'+selectedTask+'/'+currentLabel+'/'+currentTag);
    xhttp.send(formData);
}

function populateSpeciesSelector(label, mapID = 'map1'){
    /** Populates the species-to-be-explored selector. Also builds sub-species selectors as needed. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);

            while(divSelector.firstChild){
                divSelector.removeChild(divSelector.firstChild);
            }

            for (let i=0;i<response.length;i++) {
                newdiv = document.createElement('div');
                newdiv.classList.add('dropdown');
                
                newbtn = document.createElement('button');
                newbtn.classList.add('btn');
                newbtn.classList.add('btn-danger');
                newbtn.classList.add('btn-block');
                newbtn.classList.add('btn-sm');
                newbtn.classList.add('dropdown-toggle');
                newbtn.setAttribute("type", 'button');
                newbtn.setAttribute("data-toggle", 'dropdown');

                if (i==0) {
                    newbtn.innerHTML = 'Select Species to be Explored';
                } else {
                    newbtn.innerHTML = 'Select Sub-Species to be Explored';
                }

                newul = document.createElement('div');
                newul.classList.add('dropdown-menu');

                for (let n=0;n<response[i].length;n++) {
                    a = document.createElement('button');
                    a.classList.add('dropdown-item');
                    a.setAttribute('type', 'button')
                    a.setAttribute('onclick', 'populateSpeciesSelector('+response[i][n][0]+')');
                    a.innerHTML = "Show "+response[i][n][1];
                    newul.appendChild(a);
                }

                newdiv.appendChild(newbtn);
                newdiv.appendChild(newul);
                divSelector.appendChild(newdiv);
            }
            currentLabel = label
            clusterRequests[mapID] = [];
            getClusterIDs()
        }
    }
    xhttp.open("GET", '/getSpeciesSelectorBySurvey/'+label);
    xhttp.send();
}

function populateTagSelector() {
    /** Populates the tag selector. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);

            divTagSelector = document.getElementById('divTagSelector')
            while(divTagSelector.firstChild){
                divTagSelector.removeChild(divTagSelector.firstChild);
            }

            newdiv = document.createElement('div');
            newdiv.classList.add('dropdown');
            
            newbtn = document.createElement('button');
            newbtn.classList.add('btn');
            newbtn.classList.add('btn-danger');
            newbtn.classList.add('btn-block');
            newbtn.classList.add('btn-sm');
            newbtn.classList.add('dropdown-toggle');
            newbtn.setAttribute("type", 'button');
            newbtn.setAttribute("data-toggle", 'dropdown');
            newbtn.innerHTML = 'Select Tag to be Explored';

            newul = document.createElement('div');
            newul.classList.add('dropdown-menu');

            for (let i=0;i<response.length;i++) {
                a = document.createElement('button');
                a.classList.add('dropdown-item');
                a.setAttribute('type', 'button')
                a.setAttribute('onclick', 'selectTag('+response[i][0]+')');
                a.innerHTML = "Show "+response[i][1];
                newul.appendChild(a);
            }

            newdiv.appendChild(newbtn);
            newdiv.appendChild(newul);
            divTagSelector.appendChild(newdiv);
        }
    }
    xhttp.open("GET", '/populateTagSelector');
    xhttp.send();
}

function selectTag(tag) {
    currentTag = tag
    clusterRequests['map1'] = [];
    getClusterIDs()
}


$("#onlyNotesCheckbox").change( function() {
    onlyNotesCheckbox = document.getElementById('onlyNotesCheckbox')
    if (onlyNotesCheckbox.checked) {
        notesOnly = true
        document.getElementById('noteboxExpSearch').value = ''
    }
    else{
        notesOnly = false
        document.getElementById('noteboxExpSearch').value = ''
    }
    getClusterIDs()
})


window.addEventListener('load', onload, false);
