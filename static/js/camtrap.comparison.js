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
var confusionMatrix = null
var confusionLabels = null
var selectedRow
var selectedCol
isComparison = true
xl=false;
isTagging = false
isReviewing = false
isKnockdown = false 
const modalDisplay = $('#modalDisplay');
isBounding = false
isIDing = false

function prepareTable() {
    /** Builds the confusion matrix table. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);
            if (response != 'Error') {
                confusionMatrix = response

                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(){
                    if (this.readyState == 4 && this.status == 200) {
                        response = JSON.parse(this.responseText);
                        if (response != 'Error') {
                            confusionLabels = response

                            tableDiv = document.getElementById('confusionMatrix')
                            table = document.createElement('table')
                            table.setAttribute('style','width:100%; table-layout:fixed')
                            table.classList.add('table')
                            table.classList.add('table-bordered')
                            table.classList.add('table-matrix')
                            tableDiv.appendChild(table)

                            thead = document.createElement('thead')
                            table.appendChild(thead)

                            tableRow = document.createElement('tr')
                            tableCol = document.createElement('th')
                            tableCol.setAttribute('scope','col')
                            tableCol.setAttribute('style','border-bottom: 1px solid white;width: 10%')
                            tableRow.appendChild(tableCol)
                            for (let key in confusionLabels) {
                                tableCol = document.createElement('th')
                                tableCol.setAttribute('scope','col')
                                tableCol.setAttribute('style','border-bottom: 1px solid white')
                                tableRow.appendChild(tableCol)

                                thdiv = document.createElement('div')
                                thdiv.setAttribute('style','writing-mode: vertical-rl;text-orientation: mixed;display: block;white-space: nowrap;margin: 0 auto;transform: rotate(-180deg)')
                                thdiv.classList.add('box_rotate')
                                thdiv.innerHTML = confusionLabels[key].name
                                tableCol.appendChild(thdiv)
                            }
                            thead.appendChild(tableRow)

                            tbody = document.createElement('tbody')
                            table.appendChild(tbody)

                            rowIndex = 2
                            for (let row in confusionMatrix) {
                                if (row != 'multi') {
                                    tableRow = document.createElement('tr')
                                    tableCol = document.createElement('th')
                                    tableCol.setAttribute('scope','row')
                                    tableCol.innerHTML = confusionLabels[row].name
                                    tableRow.appendChild(tableCol)
                                    tbody.appendChild(tableRow)
                                    colIndex = 2
                                    for (let col in confusionMatrix[row]) {
                                        tableCol = document.createElement('td')
                                        tableCol.innerHTML = confusionMatrix[row][col].length
                                        if (rowIndex==colIndex) {
                                            tableCol.setAttribute('style','background-color: rgba(255,255,255,0.4);font-size: 80%; padding-left: 3px; padding-right: 3px;')
                                        } else {
                                            tableCol.setAttribute('style','font-size: 80%; padding-left: 3px; padding-right: 3px;')
                                        }
                                        tableRow.appendChild(tableCol)
    
                                        tableCol.addEventListener('click', function(wrapRow,wrapCol) {
                                            return function() {
                                                selectedRow = wrapRow
                                                selectedCol = wrapCol
                                                modalDisplay.modal({backdrop: 'static', keyboard: false});
                                            }
                                        }(row,col));
                                        colIndex++
                                    }
                                    rowIndex++ 
                                }
                            }

                            multi = document.getElementById("multiWayErrors")
                            multi.innerHTML = confusionMatrix['multi'].length.toString()

                            multi.addEventListener('click', function(wrapMulti) {
                                return function() {
                                    selectedRow = wrapMulti
                                    selectedCol = null
                                    modalDisplay.modal({backdrop: 'static', keyboard: false});
                                }
                            }('multi'));
                        }
                    }
                }
                xhttp.open("GET", '/getConfusionLabels');
                xhttp.send();
            }
        }
    }
    xhttp.open("GET", '/getConfusionMatrix');
    xhttp.send();
}

function loadNewCluster(mapID = 'map1') {
    /** Performs the usual getCLuster task, but gets specific images in this case. */

    var newID = Math.floor(Math.random() * 100000) + 1;
    clusterRequests[mapID].push(newID)
    if (clusterReadAheadIndex<clusterIDs.length) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 200) {
                    info = JSON.parse(this.responseText);
                    if (clusterRequests[mapID].includes(parseInt(info.id))) {
                        newcluster = info.info;
                        clusters[mapID].push(newcluster)
                        if (clusters[mapID].length - 1 == clusterIndex[mapID]) {
                            updateCanvas()
                        }
                        updateButtons()
                        preload()
                    }
                }
            };
        xhttp.open("GET", '/getImage?id=' + clusterIDs[clusterReadAheadIndex++] + '&reqId='+newID);
        xhttp.send();
    } else {
        if (modalWait2.is(':visible')) {
            modalWait2.modal('hide');
        }
    }
}

modalDisplay.on('shown.bs.modal', function(){
    /** Initialises the variables and starts loading images when the display modal is opened. */
    
    if (selectedCol != null) {
        clusterIDs = confusionMatrix[selectedRow][selectedCol]
    } else {
        clusterIDs = confusionMatrix[selectedRow]
    }

    if (clusterIDs.length==0) {
        modalDisplay.modal('hide');
    } else {
        clusters['map1']=[]
        clusterReadAheadIndex = 0
        clusterIndex['map1'] = 0
        imageIndex['map1'] = 0
        
        for (let i=0;i<3;i++){
            loadNewCluster()
        }
    }
});

window.addEventListener('load', onload, false);