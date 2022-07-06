// Copyright 2022

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var selectedTask = 0
var isTagging
var hotkeys = []
var nothingLabel = -900
var unknownLabel = -900
var downLabel = -900
var wrongLabel = -900
var unKnockLabel = -123
var xl
var isReviewing
var isComparison
var taggingLevel = '-23'
var taggingLabel = 'None'
var reachedEnd = false
var emptyCount = 0
var disableTime = 30000 //30 seconds
var tempDisable
var timerDisable
var modalActive2 = false
var multipleStatus = false
var Progress
var waitModalID = 0
var timerWaitModal
var bucketName = null
var batchComplete = false
var knockedTG = null
var knockWait = false
var EMPTY_HOTKEY_ID = '-967'
var NEXT_CLUSTER_ID = '-729'
var rectOptions
var targetRect = null
var targetUpdated = null
var isTutorial = window.location.href.includes("tutorial");
var doneWait = false
var clusterReadyTimer = null
var isClassCheck = false
var individualsReady
var sendBackMode = false
var activity = true
var pingTimer
var isViewing
var PlsWaitCountDown
var modalWait2Hide = false
var globalKeys = null
var ITEMS='label'
var ITEM_IDS='label_ids'
var wrongStatus = false
var tempTaggingLevel=null
const divBtns = document.querySelector('#divBtns');
const catcounts = document.querySelector('#categorycounts');
const mapdiv2 = document.querySelector('#mapdiv2');
const modalNoteRecon = $('#modalNoteRecon');
const modalDuplicate = $('#modalDuplicate');
const modalNewIndividual = $('#modalNewIndividual');
const modalWait = $('#modalWait');
const modalWait2 = $('#modalWait2');
const modalDone = $('#modalDone');
const modalAlert = $('#modalAlert');
const modalWelcome = $('#modalWelcome');
const btnDone = document.querySelector('#btnDone');
const helpx = document.querySelector('#helpx');
const helpclose = document.querySelector('#helpclose');
const btnSubmitIndividual = document.querySelector('#btnSubmitIndividual');
const btnCancelIndividual = document.querySelector('#btnCancelIndividual');
const nextClusterBtn = document.querySelector('#nextCluster');
const prevClusterBtn = document.querySelector('#prevCluster');
const nextImageBtn = document.querySelector('#nextImage');
const prevImageBtn = document.querySelector('#prevImage');
const clusterPositionCircles = document.getElementById('clusterPosition')
const modalNothingKnock = $('#modalNothingKnock');

var clusters = {"map1": []}
var clusterIndex = {"map1": 0}
var imageIndex = {"map1": 0}
var clusterRequests = {"map1": []}
var finishedDisplaying = {"map1": true}
var map = {"map1": null}
var drawnItems = {"map1": null}
var activeImage = {"map1": null}
var fullRes = {"map1": false}
var mapWidth = {"map1": null}
var mapHeight = {"map1": null}
var mapReady = {"map1": null}
var currentImage = {"map1": null}
var addedDetections = {"map1": false}
var sliderIndex = {"map1": -1}
var waitingForClusters = {"map1": false, "map2": false}
var clusterLabels = {"map1": []}
var clusterPosition = {"map1": document.getElementById('clusterPositionSplide')}
var clusterPositionSplide = {"map1": null}
var mapDivs = {'map1': 'mapDiv', 'map2': 'mapdiv2'}
var splides = {'map1': 'splide', 'map2': 'splide2'}        

var colours = {
    'rgba(67,115,98,1)': false,
    //'rgba(89,228,170,1)': false,
    'rgba(97,167,152,1)': false,
    // 'rgba(57,159,113,1)': false,
    'rgba(35,108,144,1)': false,
    // 'rgba(20,48,55,1)': false,
    'rgba(61,105,121,1)': false,
    // 'rgba(104,38,137,1)': false,
    'rgba(88,63,124,1)': false,
    // 'rgba(78,46,176,1)': false,
    'rgba(182,92,88,1)': false,
    // 'rgba(149,88,63,1)': false,
    'rgba(225,158,139,1)': false,
    // 'rgba(214,131,97,1)': false,
    'rgba(222,156,183,1)': false,
    // 'rgba(202,90,156,1)': false,
    'rgba(215,61,113,1)': false,
    // 'rgba(150,90,115,1)': false,
    'rgba(229,177,54,1)': false,
    // 'rgba(157,110,35,1)': false,
    'rgba(220,173,105,1)': false,
    // 'rgba(143,115,79,1)': false,
    'rgba(223,138,46,1)': false,
    // 'rgba(220,191,155,1)': false,
    'rgba(203,218,69,1)': false,
    // 'rgba(85,159,58,1)': false,
    'rgba(111,129,54,1)': false,
    // 'rgba(117,223,84,1)': false,
    'rgba(189,218,138,1)': false
}

function preload(mapID = 'map1') {
    /** Pre-loads the next three first-images of the next clusters. */
    if (bucketName!=null) {
        if (isKnockdown) {
            if (clusters[mapID][clusterIndex[mapID]].images.length > 1) {
                for (ii=0;ii<clusters[mapID][clusterIndex[mapID]].images.length;ii++) {
                    if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
                        im = new Image();
                        im.src = "https://"+bucketName+".s3.amazonaws.com/" + clusters[mapID][clusterIndex[mapID]].images[ii].url
                    }
                }
            }
        } else if (clusters[mapID].length > 1) {
            for (i=1;i<=3;i++) {
                if (clusters[mapID].length > clusterIndex[mapID] + i) {
                    if ((clusters[mapID][clusterIndex[mapID] + i].id != '-99')&&(clusters[mapID][clusterIndex[mapID] + i].id != '-101')&&(clusters[mapID][clusterIndex[mapID] + i].id != '-782')) {
                        if (clusters[mapID][clusterIndex[mapID] + i].required.length==0) {
                            im = new Image();
                            im.src = "https://"+bucketName+".s3.amazonaws.com/" + clusters[mapID][clusterIndex[mapID] + i].images[0].url
                        } else {
                            for (requiredIndex=0;requiredIndex<clusters[mapID][clusterIndex[mapID] + i].required.length;requiredIndex++) {
                                im = new Image();
                                req = clusters[mapID][clusterIndex[mapID] + i].required[requiredIndex]
                                im.src = "https://"+bucketName+".s3.amazonaws.com/" + clusters[mapID][clusterIndex[mapID] + i].images[req].url
                            }
                        }   
                    }                
                }
            }
        }
    }
}

function imageHighlight(switchOn,mapID = 'map1') {
    imageDiv = document.getElementById(mapDivs[mapID])
    if (switchOn) {
        imageDiv.style.borderWidth = 'thick'
    } else {
        imageDiv.style.borderWidth = '0px'
    }
}

function addDetections(mapID = 'map1') {
    /** Adds the bounding boxes to the active image. */
    if (!addedDetections[mapID]) {
        if (isBounding||isIDing) {
            dbDetIds[mapID] = {}
            addDetCnt = 1
        }
        image = currentImage[mapID]
        map[mapID].setZoom(map[mapID].getMinZoom())
        fullRes[mapID] = false
        drawnItems[mapID].clearLayers()
        for (iii=0;iii<image.detections.length;iii++) {
            detection = image.detections[iii]
            if (detection.static == false) {
                
                if (detection.individual!='-1') {
                    rectOptions.color = individuals[individualIndex][detection.individual].colour
                } else {
                    rectOptions.color = "rgba(223,105,26,1)"
                }

                rect = L.rectangle([[detection.top*mapHeight[mapID],detection.left*mapWidth[mapID]],[detection.bottom*mapHeight[mapID],detection.right*mapWidth[mapID]]], rectOptions)

                if (isBounding) {
                    rect.bindTooltip(detection.label,{permanent: true, direction:"center"})

                    var center = L.latLng([(rect._bounds._northEast.lat+rect._bounds._southWest.lat)/2,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                    var bottom = L.latLng([rect._bounds._southWest.lat,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                    var centerPoint = map[mapID].latLngToContainerPoint(center)
                    var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
                    var offset = [0,centerPoint.y-bottomPoint.y]
            
                    rect._tooltip.options.offset = offset
                    rect._tooltip.options.opacity = 0.8
                    rect.openTooltip()

                } else if ((document.getElementById('btnSendToBack')!=null)&&(detection.individual!='-1')) {
                    rect.bindTooltip(individuals[individualIndex][detection.individual].name,{permanent: true, direction:"center"})

                    var center = L.latLng([(rect._bounds._northEast.lat+rect._bounds._southWest.lat)/2,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                    var bottom = L.latLng([rect._bounds._southWest.lat,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                    var centerPoint = map[mapID].latLngToContainerPoint(center)
                    var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
                    var offset = [0,centerPoint.y-bottomPoint.y]
            
                    rect._tooltip.options.offset = offset
                    rect._tooltip.options.opacity = 0.8
                    rect.openTooltip()
                }

                drawnItems[mapID].addLayer(rect)
                if (isBounding||isIDing) {
                    if (!toolTipsOpen) {
                        rect.closeTooltip()
                    }
                    dbDetIds[mapID][rect._leaflet_id.toString()] = detection.id.toString()
                }
                if (document.getElementById('btnSendToBack')!=null) {
                    rect.addEventListener('click', function(wrapMapID,wrapDetectionID,wrapImageID,wrapRect) {
                        return function() {
                            if (individualsReady) {
                                wrapIndividual = '-1'
                                for (individualID in individuals[individualIndex]) {
                                    if (individuals[individualIndex][individualID].detections.includes(wrapDetectionID)) {
                                        wrapIndividual = individualID
                                        break
                                    }
                                }
    
                                if (deleteMode) {
                                    // Delete selected invidual
                                    if (wrapIndividual!='-1') {
                                        if (individuals.length>0) {
                                            newSet = JSON.parse(JSON.stringify(individuals[individualIndex]))
                                        } else {
                                            newSet = {}
                                        }
                                        colours[newSet[wrapIndividual].colour]=false
                                        delete newSet[wrapIndividual]

                                        for (individualID in newSet) {
                                            index = newSet[individualID].family.indexOf(wrapIndividual);
                                            if (index > -1) {
                                                newSet[individualID].family.splice(index, 1);
                                            }

                                            index = newSet[individualID].children.indexOf(wrapIndividual);
                                            if (index > -1) {
                                                newSet[individualID].children.splice(index, 1);
                                            }
                                        }

                                        individuals.push(newSet)
                                        individualIndex += 1
                                        buildIndividuals()
                                        deleteIndividualPress()
                                    }
    
                                } else if (sendBackMode) {
                                    wrapRect.bringToBack()
                                    sendToBack()
                                } else if (unidentifiableMode) {
                                    if (wrapIndividual=='-1') {
                                        if (individuals.length>0) {
                                            newSet = JSON.parse(JSON.stringify(individuals[individualIndex]))
                                        } else {
                                            newSet = {}
                                        }

                                        newID = 'n' + wrapDetectionID.toString()
                                        for (colour in colours) {
                                            if (colours[colour]==false) {
                                                colours[colour] = true
                                                break
                                            }
                                        }

                                        newSet[newID] = {"name": "unidentifiable", "tags": [], "notes": "", "colour": colour, "detections": [wrapDetectionID], "images": [wrapImageID], "children": [], "family": []}
                                        individuals.push(newSet)
                                        individualIndex += 1
                                        buildIndividuals()
                                    }
                                    activateUnidentifiable()
                                } else {   
                                    disallow = false
                                    if (previousClick != null) {
                                        if (previousClick.individual != '-1') {
                                            prevList = individuals[individualIndex][previousClick.individual].images
                                        } else {
                                            prevList = [previousClick.image]
                                        }
            
                                        if (wrapIndividual != '-1') {
                                            wrapList = individuals[individualIndex][wrapIndividual].images
                                        } else {
                                            wrapList = [wrapImageID]
                                        }
                                        
                                        for (dx=0;dx<prevList.length;dx++) {
                                            if (wrapList.includes(prevList[dx])) {
                                                disallow = true
                                            }
                                        }
                                    }
        
                                    if ((disallow)||(previousClick == null)||(previousClick.map==wrapMapID)||(previousClick.image==wrapImageID)||((previousClick.individual==wrapIndividual)&&(wrapIndividual!='-1'))) {
                                        if (previousClick != null) {
                                            if (previousClick.individual != '-1') {
                                                colour = individuals[individualIndex][previousClick.individual].colour
                                            } else {
                                                colour = "rgba(223,105,26,1)"
                                            }
                                            previousClick.rect.setStyle({color: colour}); //un-highlight old selection
                                        }
                                        wrapRect.setStyle({color: "rgba(225,225,225,1)"}); //highlight new selection
                                        previousClick = {'detID': wrapDetectionID, 'map': wrapMapID, 'image': wrapImageID, 'rect': wrapRect, "individual": wrapIndividual}
                                    } else {
                                        //match created
                                        goAhead = true
                                        if (individuals.length>0) {
                                            newSet = JSON.parse(JSON.stringify(individuals[individualIndex]))
                                        } else {
                                            newSet = {}
                                        }
                                        if ((previousClick.individual=='-1')&&(wrapIndividual=='-1')) { //if new
                                            if (!parentMode) {
                                                newID = 'n' + previousClick.detID.toString()
                                                for (colour in colours) {
                                                    if (colours[colour]==false) {
                                                        colours[colour] = true
                                                        break
                                                    }
                                                }
                                                detIdList = [previousClick.detID,wrapDetectionID]
                                                imIdList = [previousClick.image,wrapImageID]
                                                newSet[newID] = {"colour": colour, "detections": detIdList, "images": imIdList, "children": [], "family": []}
                                                globalIndividual = newID
                                                goAhead = false
            
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
                                            } else {
                                                activateParent()
                                            }
                                        } else { //else combine individuals
                                            if (!parentMode) {
                                                if ((previousClick.individual != '-1')&&(wrapIndividual != '-1')) {
                                                    // combine two individuals
                                                    if (newSet[previousClick.individual].detections.length >= newSet[wrapIndividual].detections.length) {
                                                        // Use previous click individual
                                                        newID = previousClick.individual
                                                        detIdList = newSet[wrapIndividual].detections
                                                        imIdList = newSet[wrapIndividual].images
                                                        tagList = newSet[wrapIndividual].tags
                                                        childList = newSet[wrapIndividual].children
                                                        familyList = newSet[wrapIndividual].family
                                                        otherNotes = newSet[wrapIndividual].notes
                                                        otherName = newSet[wrapIndividual].name
                                                        colours[newSet[wrapIndividual].colour]=false
                                                        delete newSet[wrapIndividual]
                                                    } else {
                                                        // Use new click individual
                                                        newID = wrapIndividual
                                                        detIdList = newSet[previousClick.individual].detections
                                                        imIdList = newSet[previousClick.individual].images
                                                        tagList = newSet[previousClick.individual].tags
                                                        childList = newSet[previousClick.individual].children
                                                        familyList = newSet[previousClick.individual].family
                                                        otherNotes = newSet[previousClick.individual].notes
                                                        otherName = newSet[previousClick.individual].name
                                                        colours[newSet[previousClick.individual].colour]=false
                                                        delete newSet[previousClick.individual]
                                                    }
                                                } else if (previousClick.individual != '-1') {
                                                    // associate with previous individual
                                                    newID = previousClick.individual
                                                    detIdList = [wrapDetectionID]
                                                    imIdList = [wrapImageID]
                                                    tagList = []
                                                    childList = []
                                                    familyList = []
                                                    otherNotes = ''
                                                } else {
                                                    // associate with new click individual
                                                    newID = wrapIndividual
                                                    detIdList = [previousClick.detID]
                                                    imIdList = [previousClick.image]
                                                    tagList = []
                                                    childList = []
                                                    familyList = []
                                                    otherNotes = ''
                                                }
                                                colour = newSet[newID].colour
            
                                                newSet[newID].detections.push(...detIdList)
                                                newSet[newID].detections = [...new Set(newSet[newID].detections)]
            
                                                newSet[newID].images.push(...imIdList)
                                                newSet[newID].images = [...new Set(newSet[newID].images)]
            
                                                newSet[newID].tags.push(...tagList)
                                                newSet[newID].tags = [...new Set(newSet[newID].tags)]

                                                newSet[newID].children.push(...childList)
                                                newSet[newID].children = [...new Set(newSet[newID].children)]

                                                newSet[newID].family.push(...familyList)
                                                newSet[newID].family = [...new Set(newSet[newID].family)]

                                                if ((newSet[newID].notes!='')&&(otherNotes!='')&&(otherNotes!=newSet[newID].notes)) {
                                                    document.getElementById('reconName1').innerHTML = newSet[newID].name
                                                    document.getElementById('reconBox1').value = newSet[newID].notes
                                                    document.getElementById('reconName2').innerHTML = otherName
                                                    document.getElementById('reconBox2').value = otherNotes
                                                    globalIndividual = newID
                                                    modalNoteRecon.modal({backdrop: 'static', keyboard: false});
                                                }

                                            } else {
                                                if ((previousClick.individual != '-1')&&(wrapIndividual != '-1')) {
                                                    if (!newSet[previousClick.individual].family.includes(wrapIndividual)) {
                                                        newSet[previousClick.individual].children.push(wrapIndividual)
                                                        newSet[previousClick.individual].family.push(wrapIndividual)
                                                    }
                                                }
                                                activateParent()
                                            }
                                        }
                                        
                                        individuals.push(newSet)
                                        individualIndex += 1
                                        if (goAhead) {
                                            buildIndividuals()
                                        }
                                        previousClick = null
                                    }
                                }
                            }
                        }
                    }(mapID,detection.id,image.id,rect));

                    //Right click
                    rect.addEventListener('contextmenu', function(wrapMapID,wrapDetID,wrapImageID,wrapRect) {
                        return function() {

                            alreadyAllocated = false
                            for (individualID in individuals[individualIndex]) {
                                if (individuals[individualIndex][individualID].detections.includes(wrapDetID)) {
                                    alreadyAllocated = true
                                }
                            }

                            if (!alreadyAllocated) {
                                if (individuals.length>0) {
                                    newSet = JSON.parse(JSON.stringify(individuals[individualIndex]))
                                } else {
                                    newSet = {}
                                }
                                newID = 'n' + wrapDetID.toString()
                                for (colour in colours) {
                                    if (colours[colour]==false) {
                                        colours[colour] = true
                                        break
                                    }
                                }

                                detIdList = [wrapDetID]
                                imIdList = [wrapImageID]
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
                    }(mapID,detection.id,image.id,rect));

                }
            }
        }
        if (isBounding) {
            drawControl._toolbars.edit._toolbarContainer.firstElementChild.title = '(E)dit sightings'
            drawControl._toolbars.edit._toolbarContainer.lastElementChild.title = '(D)elete sightings'
        }
        addedDetections[mapID] = true
        finishedDisplaying[mapID] = true
    }
}

function updateCanvas(mapID = 'map1') {
    /** Updates the currently displayed image. */
    if (mapReady[mapID]==null) {
        prepMap(mapID)
    } else {
        finishedDisplaying[mapID] = false

        if (clusters[mapID][clusterIndex[mapID]].id=='-101') {
    
            finishedDisplaying[mapID] = true
            batchComplete = true
            doneWait = true
            if (!modalWait2.is(':visible')) {
                waitModalID = clusters[mapID][clusterIndex[mapID]]
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
            if (clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].includes(nothingLabel.toString())) {
                redirectToDone()
            } else {
                prevCluster(mapID)
            }
    
        } else if ((clusters[mapID][clusterIndex[mapID]].images.length == 0)||(clusters[mapID][clusterIndex[mapID]].id=='-99')||(clusters[mapID][clusterIndex[mapID]].id=='-782')) {
    
            if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                waitModalID = clusters[mapID][clusterIndex[mapID]]
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
    
            finishedDisplaying[mapID] = true
            nextCluster(mapID)
    
        } else {

            if (imageIndex[mapID]>=clusters[mapID][clusterIndex[mapID]].images.length) {
                imageIndex[mapID] = 0
            }
    
            if ((bucketName!=null) && (Object.keys(activeImage).includes(mapID)) && (imageIndex[mapID]<clusters[mapID][clusterIndex[mapID]].images.length)) {
                if ((isBounding)||(isIDing && (document.getElementById('btnSendToBack')==null))) {
                    setRectOptions()
                }
                image=clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]]

                //update cluster position circles
                if (clusterPositionCircles != null) {
                    circles = ''
                    if (isViewing) {
                        cirNum = clusters[mapID][clusterIndex[mapID]].images.length
                        if (cirNum > 10) {
                            circles = ' '
                        } else {
                            for (i=0;i<cirNum;i++) {
                                if (i == imageIndex[mapID]) {
                                    circles += '&#9679;'
                                } else {
                                    circles += '&#9675;'
                                }
                            }
                        }
                    } else if (isBounding) {
                        cirNum = clusters[mapID][clusterIndex[mapID]].clusterLength
                        if (cirNum > 72) {
                            cirNum = 72
                        }
                        for (i=0;i<cirNum;i++) {
                            if (i == clusters[mapID][clusterIndex[mapID]].imageIndex) {
                                circles += '&#9679;'
                            } else {
                                circles += '&#9675;'
                            }
                        }
                    } else {
                        cirNum = clusters[mapID][clusterIndex[mapID]].images.length
                        if (cirNum > 72) {
                            cirNum = 72
                        }
                        for (i=0;i<cirNum;i++) {
                            if (i == imageIndex[mapID]) {
                                circles += '&#9679;'
                            } else {
                                circles += '&#9675;'
                            }
                        }
                    }
                    clusterPositionCircles.innerHTML = circles
                }

                if ((clusterIndex[mapID]==0)&&(imageIndex[mapID]==0)) {
                    updateSlider(mapID)
                }
    
                currentImage[mapID] = image
                addedDetections[mapID] = false

                if (activeImage[mapID] != null) {
                    activeImage[mapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + image.url)
                }

                if (isIDing && (typeof clusters['map1'][clusterIndex['map1']] != 'undefined') && (Object.keys(clusters).includes('map2')) && (typeof clusters['map2'][clusterIndex['map2']] != 'undefined') && (imageIndex['map1']<clusters['map1'][clusterIndex['map1']].images.length) && (imageIndex['map2']<clusters['map2'][clusterIndex['map2']].images.length)) {
                    sameCam = document.getElementById('sameCam')
                    timeDelta = document.getElementById('timeDelta')
                    distDelta = document.getElementById('distDelta')
                    debugInfo = document.getElementById('debugInfo')
                    if ((debugInfo != null)&&(DEBUGGING)) {
                        image1 = clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].id
                        image2 = clusters['map2'][0].images[imageIndex['map2']].id

                        while(debugInfo.firstChild){
                            debugInfo.removeChild(debugInfo.firstChild);
                        }

                        titleSim = document.createElement('div')
                        titleSim.innerHTML = 'Simialrities:'
                        debugInfo.append(titleSim)

                        if ('indsim' in clusters['map2'][0]) {
                            indSim = document.createElement('div')
                            indSim.innerHTML = 'Individual: ' + String(clusters['map2'][0]['indsim'])
                            debugInfo.append(indSim)
                        }

                        if (('detsim' in clusters['map2'][0])&&(image1 in clusters['map2'][0]['detsim'])&&(image2 in clusters['map2'][0]['detsim'][image1])) {
                            detSim = document.createElement('div')
                            detSim.innerHTML = 'Hotspotter: ' + String(clusters['map2'][0]['detsim'][image1][image2])
                            debugInfo.append(detSim)
                        }

                        if (('adjsim' in clusters['map2'][0])&&(image1 in clusters['map2'][0]['adjsim'])&&(image2 in clusters['map2'][0]['adjsim'][image1])) {
                            adjSim = document.createElement('div')
                            adjSim.innerHTML = 'Adjusted: ' + String(clusters['map2'][0]['adjsim'][image1][image2])
                            debugInfo.append(adjSim)
                        }
                    }
                    if (sameCam != null) {
                        if (clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].camera==clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].camera) {
                            sameCam.innerHTML = '&isin;'
                            sameCam.setAttribute('style','color:green;font-size:60px')
                        } else {
                            sameCam.innerHTML = '&notin;'
                            sameCam.setAttribute('style','color:red;font-size:60px')
                        }
                    }
                    if (timeDelta != null) {
                        tDelta = Math.abs(clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].timestamp-clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].timestamp)
                        days = Math.floor(tDelta/(3600*24))
                        tDelta -= days*3600*24
                        hours = Math.floor(tDelta/3600)
                        tDelta -= hours*3600
                        minutes = Math.floor(tDelta/60)
                        tDelta -= minutes*60
                        seconds = tDelta
                        timeInfo = ''
                        if (days != 0) {
                            timeInfo += days.toString()+' days'
                        }
                        if (hours != 0) {
                            timeInfo += ' '+hours.toString()+'h'
                        }
                        if (minutes != 0) {
                            timeInfo += ' '+minutes.toString()+'m'
                        }
                        if (seconds != 0) {
                            timeInfo += ' '+seconds.toString()+'s'
                        }
                        if (timeInfo == '') {
                            timeInfo = '0s'
                        }
                        timeDelta.innerHTML = timeInfo
                    }
                    if (distDelta != null) {
                        lat1 = clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].latitude
                        lon1 = clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].longitude
                        lat2 = clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].latitude
                        lon2 = clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].longitude
                        distance = coordinateDistance(lat1,lon1,lat2,lon2)
                        if (distance<1) {
                            distDelta.innerHTML = Math.floor(distance*1000).toString()+'m'
                        } else {
                            distDelta.innerHTML = distance.toFixed(3)+'km'
                        }
                    }
                }
                
                if (modalWait2.is(':visible')) {
                    modalWait2Hide = true
                    modalWait2.modal('hide');
                }

                if (clusters[mapID][clusterIndex[mapID]].required.length > 1) {
                    if ((imageIndex[mapID]+1) >= clusters[mapID][clusterIndex[mapID]].required.length) {
                        reachedEnd = true
                    }
                } else {
                    reachedEnd = true
                }
                
                // else if (imageIndex[mapID] == (clusters[mapID][clusterIndex[mapID]].images.length-1)) {
                //     reachedEnd = true
                // }

                imageHighlight(!reachedEnd)
                
                if (doneWait == true) {
                    if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                        window.location.replace("done")
                    } else {
                        modalDone.modal({backdrop: 'static', keyboard: false});
                        doneWait = false
                    }
                }
            } else {
                finishedDisplaying[mapID] = true
            }

        }
    
        if ((!isTagging) || (taggingLevel=='-3') || (isClassCheck)) { //(taggingLevel=='-2'))
            if (clusters[mapID][clusterIndex[mapID]].images.length != 0) {
                updateDebugInfo(mapID)
            }
        }
    }
}

function updateButtons(mapID = 'map1'){
    /** Enables/disables the next/previous image/cluster & undo buttons. */
    if (prevClusterBtn != null) {
        if (isBounding) {
            if (clusterIndex[mapID]==0){
                prevClusterBtn.classList.add("disabled")
            }else{
                if (!clusters[mapID][clusterIndex[mapID]-1].ready) {
                    prevClusterBtn.classList.add("disabled")
                } else {
                    prevClusterBtn.classList.remove("disabled")
                }
            }
        } else {
            if ((clusterIndex[mapID]==0)||(clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].some(r=> [downLabel,downLabel.toString(),nothingLabel,nothingLabel.toString()].includes(r)))) {
                prevClusterBtn.classList.add("disabled")
            }else{
                prevClusterBtn.classList.remove("disabled")
            }
        }
    }
    if (prevImageBtn != null) {
        if (imageIndex[mapID]==0){
            prevImageBtn.classList.add("disabled")
        }else{
            prevImageBtn.classList.remove("disabled")
        }
    }
    if (nextClusterBtn != null) {
        if (clusterIndex[mapID]==clusters[mapID].length-1){
            nextClusterBtn.classList.add("disabled")
        }else{
            nextClusterBtn.classList.remove("disabled")
        }
    }
    if (nextImageBtn != null) {
        if (clusters[mapID][clusterIndex[mapID]] != null) {
            if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
                if (imageIndex[mapID]==clusters[mapID][clusterIndex[mapID]].images.length-1){
                    nextImageBtn.classList.add("disabled")
                }else{
                    nextImageBtn.classList.remove("disabled")
                }
            }
        }
    }
}

function update(mapID = 'map1'){
    /** Updates the current image, pre-loads the next few, and updates the buttons. */
    updateSlider(mapID)
    updateCanvas(mapID)
    preload(mapID)
    updateButtons(mapID)
    if (isTagging && taggingLevel.includes('-2') && (multipleStatus==false)) {
        activateMultiple()
    }
}

function goToPrevCluster(mapID = 'map1') {
    /** Performs the function of going to the previous cluster. */

    if (clusterReadyTimer!=null) {
        clearInterval(clusterReadyTimer)
        clusterReadyTimer = null
    }

    if (multipleStatus && (divBtns != null)) {
        // if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
        //     for (i=0;i<clusters[mapID][clusterIndex[mapID]][ITEMS].length;i++){
        //         idx = names.indexOf(clusters[mapID][clusterIndex[mapID]][ITEMS][i])
        //         if (idx > -1) {
        //             var btn = document.getElementById(hotkeys[idx]);
        //             if (idx < 10) {
        //                 btn.setAttribute("class", "btn btn-primary btn-block btn-sm");
        //             } else {
        //                 btn.setAttribute("class", "btn btn-info btn-block btn-sm");
        //             }   
        //         }
        //     }
        // } 

        // divBtns.removeChild(document.getElementById('clearBtn'));
    
        // var multibtn = document.getElementById('multipleBtn');
        // multibtn.innerHTML = 'Multiple Species (Ctrl)'
        // multibtn.setAttribute("class", "btn btn-danger btn-block btn-sm");
        getKeys()
        multipleStatus = false
    }

    if ((document.getElementById('btnSendToBack')!=null)&&(!['-101','-99','-782'].includes(clusters[mapID][clusterIndex[mapID]].id))) {
        for (imInd=0;imInd<clusters[mapID][clusterIndex[mapID]].images.length;imInd++) {
            for (detInd=0;detInd<clusters[mapID][clusterIndex[mapID]].images[imInd].detections.length;detInd++) {
                if (clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].individual.includes('n')||clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].individual.includes('e')) {
                    newID = '-1'
                    for (individualID in individuals[0]) {
                        if (individuals[0][individualID].detections.includes(clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].id)) {
                            newID = individualID
                            break
                        }
                    }
                    clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].individual = newID
                }
            }
        }
    }

    imageIndex[mapID]=0
    clusterIndex[mapID] = clusterIndex[mapID] - 1
    updateClusterLabels(mapID)

    if (wrongStatus) {
        initKeys(globalKeys[taggingLevel])
    }

    if (document.getElementById('btnSendToBack')!=null) {
        getSuggestions()
        individuals = [{}]
        individualIndex = 0
        for (colour in colours) {
            colours[colour] = false
        }
        previousClick = null
        backIndex += 1
        document.getElementById('btnNextCluster').disabled = false
        buildIndividualsObject()
    }

    if (isIDing && (document.getElementById('btnSendToBack')==null)) {
        updateProgress()
    }

    reachedEnd = false
    if ((clusters[mapID][clusterIndex[mapID]].id == '-99')||(clusters[mapID][clusterIndex[mapID]].id == '-101')||(clusters[mapID][clusterIndex[mapID]].id == '-782')) {
        prevCluster(mapID)
    } else {
        update(mapID)
    }
}

function checkClusterReady(mapID = 'map1') {
    /** Checks if the previous cluster is ready, and goes to it if it is. */
    if (clusters[mapID][clusterIndex[mapID]-1].ready) {
        prevCluster(mapID)
    }
}

function prevCluster(mapID = 'map1'){
    /** Checks if the user is able to go to the previous cluster, and calls goToPrevCluster if they are. */
    if (isTutorial) {
        if (finishedDisplaying[mapID] && !modalActive && !modalActive2) {
            if (!tutProcessUserInput('prevCluster')) return;
        } else {
            return;
        }
    }
    if ((finishedDisplaying[mapID] == true) && ((taggingLevel.includes('-2')) || (multipleStatus==false))) {
        if (modalActive == false) {
            if (clusterIndex[mapID]>0){
                if (isBounding||(document.getElementById('btnSendToBack')!=null)) {
                    if ((clusters[mapID][clusterIndex[mapID]-1].ready)||(clusters[mapID][clusterIndex[mapID]-1].id == '-99')||(clusters[mapID][clusterIndex[mapID]-1].id == '-101')||(clusters[mapID][clusterIndex[mapID]-1].id == '-782')) {
                        goToPrevCluster(mapID)
                    } else {
                        if (clusterReadyTimer==null) {
                            clusterReadyTimer = setInterval(checkClusterReady, 500, mapID);
                        }
                    }
                } else {
                    if ((!isTagging)||(!clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].some(r=> [downLabel,downLabel.toString(),nothingLabel,nothingLabel.toString()].includes(r)))) {
                        goToPrevCluster(mapID)
                    }
                }
            }
        }
    }
}

function updateClusterLabels(mapID = 'map1') {
    /** Updates the global list of labels for the current cluster. */
    clusterLabels[mapID] = []
    if ((clusters[mapID][clusterIndex[mapID]]!=undefined)&&(clusters[mapID][clusterIndex[mapID]][ITEM_IDS]!=undefined)) {
        for (i=0;i<clusters[mapID][clusterIndex[mapID]][ITEM_IDS].length;i++) {
            label_id = clusters[mapID][clusterIndex[mapID]][ITEM_IDS][i]
            if (parseInt(label_id) != 0) {
                clusterLabels[mapID].push(label_id)
            }
        }
    }
}

function updateDebugInfo(mapID = 'map1') {
    /** Updates the displayed image/cluster info. */
    if ((!isViewing && !isTagging && !isBounding && !isKnockdown)||(taggingLevel=='-3')||(isClassCheck)) { //(!isTagging)
        if ((clusters[mapID][clusterIndex[mapID]].id == '-99')||(clusters[mapID][clusterIndex[mapID]].id == '-101')||(clusters[mapID][clusterIndex[mapID]].id == '-782')) {
            document.getElementById('debugImage').innerHTML =  '';
            document.getElementById('debugLabels').innerHTML = '';
            if (document.getElementById('groundLabels')) {
                document.getElementById('groundLabels').innerHTML = '';
            }
            
        } else {
            if (!isClassCheck) {
                document.getElementById('debugImage').innerHTML =  clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url;
            } else {
                var temp =''
                for (i=0;i<clusters[mapID][clusterIndex[mapID]].classification.length;i++) {
                    temp += clusters[mapID][clusterIndex[mapID]].classification[i]
                    if (i != clusters[mapID][clusterIndex[mapID]].classification.length-1) {
                        temp += ', '
                    }
                }
                document.getElementById('classifierLabels').innerHTML = "Suggestion: "+temp;
            }
            
            var temp =''
            for (i=0;i<clusters[mapID][clusterIndex[mapID]].label.length;i++) {
                temp += clusters[mapID][clusterIndex[mapID]].label[i]
                if (i != clusters[mapID][clusterIndex[mapID]].label.length-1) {
                    temp += ', '
                }
            }
            document.getElementById('debugLabels').innerHTML = "Labels: "+temp;

            if (document.getElementById('groundLabels')) {
                var temp =''
                for (i=0;i<clusters[mapID][clusterIndex[mapID]].groundTruth[imageIndex[mapID]].length;i++) {
                    temp += clusters[mapID][clusterIndex[mapID]].groundTruth[imageIndex[mapID]][i]
                    if (i != clusters[mapID][clusterIndex[mapID]].groundTruth[imageIndex[mapID]].length-1) {
                        temp += ', '
                    }
                }
                document.getElementById('groundLabels').innerHTML = "Ground Truth: "+temp;
            }

            if (!isClassCheck) {
                var temp =''
                for (i=0;i<clusters[mapID][clusterIndex[mapID]].tags.length;i++) {
                    temp += clusters[mapID][clusterIndex[mapID]].tags[i]
                    if (i != clusters[mapID][clusterIndex[mapID]].tags.length-1) {
                        temp += ', '
                    }
                }
                document.getElementById('classifierLabels').innerHTML = "Tags: "+temp;
            }
        }
    }

    if (multipleStatus) {
        if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
            for (i=0;i<clusters[mapID][clusterIndex[mapID]][ITEMS].length;i++){
                idx = names.indexOf(clusters[mapID][clusterIndex[mapID]][ITEMS][i])
                if (idx > -1) {
                    var btn = document.getElementById(hotkeys[idx]);
                    btn.setAttribute("class", "btn btn-success btn-block btn-sm");           
                }
            }
        } 
    }
}


function nextImage(mapID = 'map1'){
    /** Switches to the next image in the cluster if its available. */
    if (isTutorial) {
        if (finishedDisplaying[mapID] && !modalActive && !modalActive2) {
            if (!tutProcessUserInput('nextImage')) return;
        } else {
            return;
        }
    }
    
    if (finishedDisplaying[mapID] == true) {

        // Make an exception for finish looking at cluster modal
        allowBypass=false
        if (modalAlert.is(':visible')) {
            modalAlert.modal('hide');
            allowBypass=true
        }

        if (((modalActive == false) && (modalActive2 == false))||(allowBypass)) {
            if (imageIndex[mapID]<clusters[mapID][clusterIndex[mapID]].images.length-1){
                if ((mapdiv2 != null)&&(previousClick!=null)) {
                    if (previousClick.map==mapID) {
                        previousClick = null
                    }
                }
                if (clusterPositionSplide[mapID] != null) {
                    clusterPositionSplide[mapID].go('+1')
                } else {
                    imageIndex[mapID] = imageIndex[mapID] + 1
                    update(mapID)
                }
            }
        }
    }
}

function prevImage(mapID = 'map1'){
    /** Switches to the previous image in a cluster. */
    if (isTutorial) {
        if (finishedDisplaying[mapID] && !modalActive && !modalActive2) {
            if (!tutProcessUserInput('prevImage')) return;
        } else {
            return;
        }
    }

    if (finishedDisplaying[mapID] == true) {

        // Make an exception for finish looking at cluster modal
        allowBypass=false
        if (modalAlert.is(':visible')) {
            modalAlert.modal('hide');
            allowBypass=true
        }

        if (((modalActive == false) && (modalActive2 == false))||(allowBypass)) {
            if (imageIndex[mapID]>0) {
                if ((mapdiv2 != null)&&(previousClick!=null)) {
                    if (previousClick.map==mapID) {
                        previousClick = null
                    }
                }
                if (clusterPositionSplide[mapID] != null) {
                    clusterPositionSplide[mapID].go('-1')
                } else {
                    imageIndex[mapID] -= 1
                    update(mapID)
                }
            }
        }
    }
}

function updateSlider(mapID = 'map1') {
    /** Updates the specified image slider. Initialises it if needed. */
    if ((document.getElementById(splides[mapID]) != null) && (sliderIndex[mapID] != clusterIndex[mapID]) && (typeof clusters[mapID][clusterIndex[mapID]] != 'undefined') && (bucketName != null) && (!['-101','-99','-782'].includes(clusters[mapID][clusterIndex[mapID]].id))) {
        sliderIndex[mapID] = clusterIndex[mapID]
        while(clusterPosition[mapID].firstChild){
            clusterPosition[mapID].removeChild(clusterPosition[mapID].firstChild);
        }
        for (ndx=0;ndx<clusters[mapID][clusterIndex[mapID]].images.length;ndx++) {
            imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + clusters[mapID][clusterIndex[mapID]].images[ndx].url
            img = document.createElement('img')
            img.setAttribute('src',imageUrl)
            imgli = document.createElement('li')
            imgli.classList.add('splide__slide')
            imgli.appendChild(img)
            clusterPosition[mapID].appendChild(imgli)
        }
    
        if (clusterPositionSplide[mapID]==null) {
            clusterPositionSplide[mapID] = new Splide( document.getElementById(splides[mapID]), {
                rewind      : false,
                fixedWidth  : 200,
                fixedHeight : 128,
                isNavigation: true,
                keyboard: false,
                gap         : 5,
                pagination  : false,
                cover       : true,
                breakpoints : {
                    '600': {
                        fixedWidth  : 66,
                        fixedHeight : 40
                    }
                }
            } ).mount();

            clusterPositionSplide[mapID].on( 'moved', function(wrapMapID) {
                return function() {
                    imageIndex[wrapMapID] = clusterPositionSplide[wrapMapID].index
                    update(wrapMapID)
                }
            }(mapID));

            var track = clusterPositionSplide[mapID].Components.Elements.track
            clusterPositionSplide[mapID].on( 'click', function(wrapMapID,wrapTrack) {
                return function() {
                    imageIndex[wrapMapID] = parseInt(event.target.attributes.id.value.split("slide")[1])-1
                    clusterPositionSplide[wrapMapID].go(imageIndex[wrapMapID])
                    update(wrapMapID)
                }
            }(mapID,track));

        } else {
            clusterPositionSplide[mapID].refresh()
        }
        if (clusterIndex['map1']!=0) {
            clusterPositionSplide[mapID].go(0)
        }
    }
}


function nextCluster(mapID = 'map1') {
    /** Goes to the next cluster. */
    allow = true
    if (isReviewing) {
        if (clusterIndex[mapID] >= (clusters[mapID].length-1)) {
            allow = false
        }
    }

    if (allow && (finishedDisplaying[mapID] == true) && (multipleStatus==false)) {
        if (modalActive == false) {
            if (clusterIndex[mapID] >= clusters[mapID].length-1) {
                if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                    waitModalID = clusters[mapID][clusterIndex[mapID]]
                    modalWait2Hide = false
                    modalWait2.modal({backdrop: 'static', keyboard: false});
                }
            }

            if (clusterPositionSplide[mapID] == null) {
                imageIndex[mapID] = 0
            }

            if (clusterIndex[mapID]<clusters[mapID].length-1) {
                clusterIndex[mapID] = clusterIndex[mapID] + 1
                reachedEnd = false
                update(mapID)

                if ((mapID == 'map1')&&(mapdiv2 != null)) {
                    getSuggestions()
                }
    
                if (document.getElementById('btnSendToBack')!=null) {
                    individuals = [{}]
                    individualIndex = 0
                    for (colour in colours) {
                        colours[colour] = false
                    }
                    buildIndividualsObject()
                }

            } else if (clusterIndex[mapID]==clusters[mapID].length-1) {
                clusterIndex[mapID] = clusterIndex[mapID] + 1
                reachedEnd = false
            }

            updateClusterLabels(mapID)

            if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                preLoadCount = 1
                updateProgress()
            } else {
                preLoadCount = 5
            }
        
            if ((clusterIndex[mapID]>clusters[mapID].length-preLoadCount)&&(clusters[mapID][clusters[mapID].length-1].id != '-101')) {
                if (!waitingForClusters[mapID]) {
                    loadNewCluster(mapID)
                }
            }
        }
    }
}

function switchToTask(task){
    /** Switches the active task to the specified task ID. */
    if (selectedTask != task) {
        selectedTask=task;
        clusterRequests['map1'] = [];

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                if (isTagging) {
                    //nothing
                } else if (isReviewing) {
                    populateLevels()
                    populateSpeciesSelector(0)
                    populateTagSelector()
                } else if (isKnockdown) {
                    clusters['map1'] = []
                    clusterIndex['map1'] = 0
                    imageIndex['map1'] = 0
                    loadNewCluster(87)
                } else {
                    getcatcounts()
                    populateMetrics()
                } 
            }
        }
        xhttp.open("GET", '/setAdminTask/'+task);
        xhttp.send();
    }
    if (!isTagging && !isReviewing && !isKnockdown){
        populateSpecies(task)
    }
}

function switchTaggingLevel(level) {
    /** Handles the switch to a new tagging level by updating the keys, and the global variable. */
    if (level.toString().includes('-2')) {
        taggingLevel = '-2'
    } else {
        taggingLevel = level.toString()
    }
    
    if (taggingLevel.includes('-2')) {
        ITEMS = 'tags'
        ITEM_IDS = 'tag_ids'
    } else {
        ITEMS = 'label'
        ITEM_IDS = 'label_ids'
    }
    updateClusterLabels()
    getKeys()
}

function assignLabel(label,mapID = 'map1'){
    /** Assigns the specified label to the current cluster. */
    if (isTutorial) {
        if (finishedDisplaying[mapID] && !modalActive && !modalActive2) {
            if (!tutProcessUserInput(label)) return;
        } else {
            return;
        }
    }

    if (multipleStatus && ((nothingLabel==label)||(downLabel==label))) {
        //ignore nothing and knocked down labels in multi
    } else if ([nothingLabel,downLabel].includes(parseInt(label)) && !modalNothingKnock.is(':visible') && !isTutorial) {
        // confirmation modal for nothing and knockdowns
        if (label==nothingLabel) {
            document.getElementById('modalNothingKnockText').innerHTML = 'You are about to mark the current cluster as containing nothing. This will filter out any present false detections from all other images from this camera.<br><br><i>If you wish to continue, press the "N" hotkey again.</i><br><br><i>Otherwise press "Esc" or label the cluster as anything else.</i>'
        } else {
            document.getElementById('modalNothingKnockText').innerHTML = 'You are about to mark the current camera as knocked down. This will filter out all images from this camera from this timestamp onward.<br><br><i>If you wish to continue, press the "Q" hotkey again.</i><br><br><i>Otherwise press "Esc" or label the cluster as anything else.</i>'
        }
        modalNothingKnock.modal({keyboard: true}) //{backdrop: 'static', keyboard: false});
    } else if (label==wrongLabel) {
        wrongStatus = true
        tempTaggingLevel = -1
        initKeys(globalKeys[tempTaggingLevel])
    } else if (wrongStatus && (label in globalKeys) && (label != tempTaggingLevel)) {
        tempTaggingLevel = label
        initKeys(globalKeys[tempTaggingLevel])
    } else if ((finishedDisplaying[mapID] == true) && (!modalActive) && (modalActive2 == false) && (clusters[mapID][clusterIndex[mapID]].id != '-99') && (clusters[mapID][clusterIndex[mapID]].id != '-101') && (clusters[mapID][clusterIndex[mapID]].id != '-782')) {

        if (taggingLevel=='-3') {
            // classification check

            var checkVar = 0
            if (clusters[mapID][clusterIndex[mapID]].required.length>1) {
                if (reachedEnd == false) {
                    document.getElementById('modalAlertText').innerHTML = 'This cluster may contain more species, please cycle through all images before tagging it.'
                    modalAlert.modal({keyboard: true});
                    checkVar = 1
                }
            }

            if (checkVar == 0) {
                if (label == '1') {
                    // accept
                    clusters[mapID][clusterIndex[mapID]][ITEMS] = clusters[mapID][clusterIndex[mapID]].classification
                    clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = ['-254']
                    var xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange =
                        function () {
                            if (this.readyState == 4 && this.status == 278) {
                                window.location.replace(JSON.parse(this.responseText)['redirect'])
                            } else if (this.readyState == 4 && this.status == 200) {                    
                                Progress = JSON.parse(this.responseText);
                                if (!multipleStatus) {
                                    updateProgBar(Progress)
                                }
                            }
                        }
                    xhttp.open("GET", '/acceptClassification/true/'+clusters[mapID][clusterIndex[mapID]].id+'/false', true);
                    xhttp.send();
    
                    nextCluster(mapID)
                } else if (label == '2') {
                    // reject
                    var xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange =
                        function () {
                            if (this.readyState == 4 && this.status == 278) {
                                window.location.replace(JSON.parse(this.responseText)['redirect'])
                            } else if (this.readyState == 4 && this.status == 200) {                    
                                Progress = JSON.parse(this.responseText);
                                if (!multipleStatus) {
                                    updateProgBar(Progress)
                                }
                            }
                        }
                    xhttp.open("GET", '/acceptClassification/false/'+clusters[mapID][clusterIndex[mapID]].id+'/false', true);
                    xhttp.send();
    
                    nextCluster(mapID)
                } else if (label == '3') {
                    // other
                    if (divBtns != null) {
                        selectBtns = document.getElementById('selectBtns')
                        multipleStatus = false
                
                        while(divBtns.firstChild){
                            divBtns.removeChild(divBtns.firstChild);
                        }
                
                        var newbtn = document.createElement('button');
                        newbtn.classList.add('btn');
                        newbtn.classList.add('btn-danger');
                        newbtn.innerHTML = 'Back';
                        newbtn.setAttribute("id", 0);
                        newbtn.classList.add('btn-block');
                        newbtn.classList.add('btn-sm');
                        newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
                        newbtn.addEventListener('click', (evt)=>{
                            suggestionBack();
                        });
                        selectBtns.appendChild(newbtn);
                
                        dropdown = document.createElement('div')
                        dropdown.classList.add('dropdown')
                        selectBtns.appendChild(dropdown)
                
                        dropbutton = document.createElement('button')
                        dropbutton.setAttribute('class','btn btn-danger btn-block dropdown-toggle btn-sm')
                        dropbutton.setAttribute('type','button')
                        dropbutton.setAttribute('data-toggle','dropdown')
                        dropbutton.innerHTML = 'Annotation Level'
                        dropdown.appendChild(dropbutton)
                
                        levelSelector = document.createElement('div')
                        levelSelector.setAttribute('id','level-selector')
                        levelSelector.setAttribute('class','dropdown-menu')
                        dropdown.appendChild(levelSelector)
                
                        populateLevels()
                    }
                } else if (label == '4') {
                    // accept additional
                    if (!clusters[mapID][clusterIndex[mapID]][ITEMS].includes(clusters[mapID][clusterIndex[mapID]].classification[0])) {
                        clusters[mapID][clusterIndex[mapID]][ITEMS].push(clusters[mapID][clusterIndex[mapID]].classification[0])
                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].push('-254')
                    }
                    var xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange =
                        function () {
                            if (this.readyState == 4 && this.status == 278) {
                                window.location.replace(JSON.parse(this.responseText)['redirect'])
                            } else if (this.readyState == 4 && this.status == 200) {                    
                                Progress = JSON.parse(this.responseText);
                                if (!multipleStatus) {
                                    updateProgBar(Progress)
                                }
                            }
                        }
                    xhttp.open("GET", '/acceptClassification/true/'+clusters[mapID][clusterIndex[mapID]].id+'/true', true);
                    xhttp.send();
    
                    nextCluster(mapID)
                }
            }
        
        } else {

            if (modalNothingKnock.is(':visible')) {
                modalNothingKnock.modal('hide')
            }

            if ((clusters[mapID][clusterIndex[mapID]][ITEMS].includes(downLabel)) && (label != downLabel)) { //If already marked as knocked down - undo that knockdown
                UndoKnockDown(label, mapID)
            } else if ((clusters[mapID][clusterIndex[mapID]][ITEMS].includes(unKnockLabel)) && (label == downLabel)) {
                // disallow undo of undo knockdown
                nextCluster()
            } else {
                if (label==downLabel) {
                    knockdown(mapID)
                } else {
                    var checkVar = 0
                    if ((!taggingLevel.includes('-2'))&&((label==unknownLabel)||(label==nothingLabel)||clusters[mapID][clusterIndex[mapID]].required.length>1)) {
                        if ((reachedEnd == false)&&(clusters[mapID][clusterIndex[mapID]].required.length>1)) {
                            text = 'This cluster may contain more species, please cycle through all images before tagging it.'
                            document.getElementById('modalAlertText').innerHTML = text
                            modalAlert.modal({keyboard: true});
                            checkVar = 1
                        }
                    }
        
                    if ((label != EMPTY_HOTKEY_ID)&&(checkVar==0)) {
                        console.log(label)
                        idx = hotkeys.indexOf(label)

                        if (idx > -1) {

                            if (wrongStatus) {
                                for (tl in globalKeys) {
                                    for (tl2=0;tl2<globalKeys[tl][0].length;tl2++) {
                                        if (globalKeys[tl][0][tl2]==label) {
                                            labelName = globalKeys[tl][1][tl2]
                                            break
                                        }
                                    }
                                }
                            } else {
                                labelName = names[idx]
                            }

                            if (clusters[mapID][clusterIndex[mapID]][ITEMS].includes(labelName)) {
        
                                var btn = document.getElementById(label);
                                if (idx < 10) {
                                    btn.setAttribute("class", "btn btn-primary btn-block btn-sm");
                                } else {
                                    btn.setAttribute("class", "btn btn-info btn-block btn-sm");
                                }
            
                                clusters[mapID][clusterIndex[mapID]][ITEMS].splice(clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(labelName), 1);
                                clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(label), 1);
                                if (clusters[mapID][clusterIndex[mapID]][ITEMS].length == 0) {
                                    clusters[mapID][clusterIndex[mapID]][ITEMS] = ['None']
                                    clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = ['0']
                                }
                                updateDebugInfo(mapID)

                                clusterLabels[mapID].splice(clusterLabels[mapID].indexOf(label), 1)
                            } else {

                                unknocked = false
                                if (clusters[mapID][clusterIndex[mapID]][ITEMS].includes(unKnockLabel)) {
                                    unknocked = true
                                }
    
                                if (multipleStatus) {
                                    if (clusters[mapID][clusterIndex[mapID]][ITEMS].includes('None')) {
                                        clusters[mapID][clusterIndex[mapID]][ITEMS] = []
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = []
                                    }
                                    if (clusters[mapID][clusterIndex[mapID]][ITEMS].includes(taggingLabel)) {
                                        clusters[mapID][clusterIndex[mapID]][ITEMS].splice(clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(taggingLabel), 1);
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(taggingLevel), 1);
                                    }
                                    clusters[mapID][clusterIndex[mapID]][ITEMS].push(labelName);
                                    clusters[mapID][clusterIndex[mapID]][ITEM_IDS].push(label);
                                    clusterLabels[mapID].push(label)
    
                                } else {

                                    if (isReviewing) {
                                        clusters[mapID][clusterIndex[mapID]][ITEMS] = []
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = []
                                        clusterLabels[mapID] = []
                                    } else {
                                        // Clear other current-level labels
                                        for (tl=0;tl<globalKeys[taggingLevel][0].length;tl++) {
                                            label_id = globalKeys[taggingLevel][0][tl].toString()
                                            if (clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(label_id)) {
                                                label_name = globalKeys[taggingLevel][1][tl]
                                                clusters[mapID][clusterIndex[mapID]][ITEMS].splice(clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(label_name), 1);
                                                clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(label_id), 1);
                                                clusterLabels[mapID].splice(clusterLabels[mapID].indexOf(label_id), 1)
                                            }
                                        }

                                        // Clear other same-level labels in wrong mode
                                        if (wrongStatus) {
                                            for (tl=0;tl<globalKeys[tempTaggingLevel][0].length;tl++) {
                                                label_id = globalKeys[tempTaggingLevel][0][tl].toString()
                                                if (clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(label_id)) {
                                                    label_name = globalKeys[tempTaggingLevel][1][tl]
                                                    clusters[mapID][clusterIndex[mapID]][ITEMS].splice(clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(label_name), 1);
                                                    clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(label_id), 1);
                                                    clusterLabels[mapID].splice(clusterLabels[mapID].indexOf(label_id), 1)
                                                }
                                            }
                                        }
                                    }

                                    clusters[mapID][clusterIndex[mapID]][ITEMS].push(labelName);
                                    clusters[mapID][clusterIndex[mapID]][ITEM_IDS].push(label);
                                    clusterLabels[mapID].push(label)

                                    // clusters[mapID][clusterIndex[mapID]][ITEMS] = [labelName]
                                    // clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = [label]
                                    // clusterLabels[mapID] = [label]

                                    if (unknocked) {
                                        clusters[mapID][clusterIndex[mapID]][ITEMS].push(unKnockLabel)
                                    }
                                }
                                updateDebugInfo(mapID)    
                                
                                if (wrongStatus) {
                                    wrongStatus = false
                                    initKeys(globalKeys[taggingLevel])
                                }
                                
                                if ((!isTutorial)&&(!multipleStatus)) {
                                    submitLabels(mapID)
                                }
    
                                if (!multipleStatus) {
                                    if (isClassCheck) {
                                        suggestionBack()
                                    }
                                    if (!clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(nothingLabel.toString())) {
                                        // nothings need to wait to see if they ae ediected first
                                        nextCluster(mapID)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

function fetchTaggingLevel() {
    /** Fetches the tagging level from the server, setting the global variables accordingly before fetching the associated labels. */
    if (isTutorial) {
        taggingLevel = "-1";
        taggingLabel = "None";
        getKeys();
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 278) {
            window.location.replace(JSON.parse(this.responseText)['redirect'])
        } else if (this.readyState == 4 && this.status == 200) {
            taggingInfo = JSON.parse(this.responseText);
            taggingLevel = taggingInfo.taggingLevel

            if (taggingLevel.includes('-2')) {
                taggingLevel = '-2'
            }

            if (taggingLevel.includes('-2')) {
                ITEMS = 'tags'
                ITEM_IDS = 'tag_ids'
            } else {
                ITEMS = 'label'
                ITEM_IDS = 'label_ids'
            }
            taggingLabel = taggingInfo.taggingLabel
            if (taggingLevel == '-3') {
                isClassCheck = true
            }
            if ((!taggingLevel.includes('-4'))&&(!taggingLevel.includes('-5'))) {
                getKeys()
            }
        }
    }
    xhttp.open("GET", '/getTaggingLevel');
    xhttp.send();
}


function updateProgBar(prog) {
    /** Updates the progress bar with the specified info. */
    if (isTutorial) {
        return;
    }
    if (prog[0]<=prog[1]){
        prog_bar = document.getElementById('progress')
        prog_bar.setAttribute('aria-valuemax',prog[1])
        prog_bar.setAttribute('aria-valuenow',prog[0])
        perc=prog[0]/prog[1]*100
        prog_bar.setAttribute('style',"width:"+perc+"%")
        if (isIDing && (document.getElementById('btnSendToBack')==null)) {
            document.getElementById('progressText').innerHTML = prog[0] + " of "+prog[1] + " suggestions for the current individual."
        } else {
            document.getElementById('progressText').innerHTML = prog[0] + " of "+prog[1] + " clusters completed."
        }
    }
}


function updateImageProperty(property,func,val) {
    /**
     * Updates the displayed image brightness, contrast etc. based on the specified parameters.
     * @param {str} property The property to be updated
     * @param {str} func Increase/decrease
     * @param {str} val The value by which the current value should be modified
     */

    re = new RegExp(property+'\\([0-9]+%\\)')
    value = parseInt(docStyle.innerHTML.match(re)[0].match(/[0-9]+/)[0])
    if (func=='increase') {
        if (value<200) {
            value += val
        }
    } else {
        if (value>0) {
            value -= val
        }
    }    
    docStyle.innerHTML = docStyle.innerHTML.replace(re,property+'('+value+'%)')
}


function resetImageProperty() {
    /** Resets all properties of the current image to default. */
    re = new RegExp('brightness'+'\\([0-9]+%\\)')
    docStyle.innerHTML = docStyle.innerHTML.replace(re,'brightness(100%)')
    re = new RegExp('contrast'+'\\([0-9]+%\\)')
    docStyle.innerHTML = docStyle.innerHTML.replace(re,'contrast(100%)')
    re = new RegExp('saturate'+'\\([0-9]+%\\)')
    docStyle.innerHTML = docStyle.innerHTML.replace(re,'saturate(100%)')
}


function prepMap(mapID = 'map1') {
    /** Initialises the Leaflet map for displaying images. */
    if (clusters[mapID][clusterIndex[mapID]].id=='-101') {
        window.location.replace("done")
    } else if ((clusters[mapID][clusterIndex[mapID]].id=='-99')||(clusters[mapID][clusterIndex[mapID]].id=='-782')) {
        nextCluster(mapID)
    } else {
        if (bucketName != null) {
            mapReady[mapID] = false
            imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url
            var img = new Image();
            img.onload = function(wrapMapID){
                return function() {
                    w = this.width
                    h = this.height

                    if (mapdiv2 != null) {
                        imWidth = 700
                    } else {
                        imWidth = 1000
                    }
            
                    if (w>h) {
                        ratio = (h/w)*imWidth
                        document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height:'+ratio.toString()+'px;width:'+imWidth.toString()+'px; border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                    } else {
                        ratio = (w/h)*imWidth
                        document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height:'+imWidth.toString()+'px;width:'+ratio.toString()+'px; border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                    }

                    L.Browser.touch = true
            
                    map[wrapMapID] = new L.map(mapDivs[wrapMapID], {
                        crs: L.CRS.Simple,
                        maxZoom: 10,
                        center: [0, 0],
                        zoomSnap: 0
                    })
            
                    var southWest = map[wrapMapID].unproject([0, h], 2);
                    var northEast = map[wrapMapID].unproject([w, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);
            
                    mapWidth[wrapMapID] = northEast.lng
                    mapHeight[wrapMapID] = southWest.lat
            
                    activeImage[wrapMapID] = L.imageOverlay(imageUrl, bounds).addTo(map[wrapMapID]);
                    activeImage[wrapMapID].on('load', function(wrapWrapMapID) {
                        return function () {
                            addDetections(wrapWrapMapID)
                        }
                    }(wrapMapID));
                    map[wrapMapID].setMaxBounds(bounds);
                    map[wrapMapID].fitBounds(bounds)
                    map[wrapMapID].setMinZoom(map[wrapMapID].getZoom())

                    map[wrapMapID].on('drag', function(wrapWrapMapID) {
                        return function () {
                            map[wrapWrapMapID].panInsideBounds(bounds, { animate: false });
                        }
                    }(wrapMapID));
            
                    drawnItems[wrapMapID] = new L.FeatureGroup();
                    map[wrapMapID].addLayer(drawnItems[wrapMapID]);
            
                    map[wrapMapID].on('zoomstart', function(wrapWrapMapID) {
                        return function () { 
                            if ((!fullRes[wrapWrapMapID])&&(!['-101','-99','-782'].includes(clusters[wrapWrapMapID][clusterIndex[wrapWrapMapID]].id))) {
                                activeImage[wrapWrapMapID].setUrl("https://"+bucketName+"-raw.s3.amazonaws.com/" + clusters[wrapWrapMapID][clusterIndex[wrapWrapMapID]].images[imageIndex[wrapWrapMapID]].url)
                                fullRes[wrapWrapMapID] = true
                            }
                        }
                    }(wrapMapID));
            
                    if (isBounding) {
                        fetchLabelHierarchy()
                        setRectOptions()
                        sightingAnalysisMapPrep()
                    } else if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                        setRectOptions()
                        IDMapPrep(wrapMapID)
                    } else {
                        rectOptions = {
                            color: "rgba(223,105,26,1)",
                            fill: true,
                            fillOpacity: 0.0,
                            opacity: 0.8,
                            weight:3,
                            contextmenu: false,
                        }            
                    }
                    mapReady[wrapMapID] = true
                    updateCanvas(wrapMapID)
                }
            }(mapID);
            img.src = imageUrl
        }
    }
}

function pingServer() {
    /** Pings the server to let it know that the user is still active. */
    if (activity||modalWait.is(':visible')||modalWait2.is(':visible')) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            }
        }
        xhttp.open("POST", '/ping');
        xhttp.send();
    }
    activity = false
}

function updateProgress() {
    /** Updates the user's progress bar. */

    skip = false
    request = '/updateprog'
    if (isIDing && (document.getElementById('btnSendToBack')==null)) {
        if (clusters['map1'][clusterIndex['map1']] != undefined) {
            request += '?id='+clusters['map1'][clusterIndex['map1']].id.toString()
        } else {
            skip = true
        }
    }

    if (!skip) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                Progress = JSON.parse(this.responseText);
                updateProgBar(Progress)
            }
        };
        xhttp.open("POST", request);
        xhttp.send();
    }
}

function onload (){
    /** Initialises the page on load. */
    if (!isReviewing && !isViewing) {
        pingTimer = setInterval(pingServer, 30000);
    }

    if (document.location.href.includes('task')) {
        switchToTask(/task=([^&]+)/.exec(document.location.href)[1])
    }

    if (isTagging) { 
        fetchTaggingLevel()

        if (!isTutorial) {
            updateProgress()
        }
    }

    if (isComparison) {
        prepareTable()
    }

    if (isTutorial) {
        bucketName = "traptagger";
    } else {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.readyState == 4 && this.status == 200) {
                bucketName = JSON.parse(this.responseText).bucketName
                if (isViewing) {
                    clusters['map1'] = sentClusters
                    update()
                }
            }
        }
        xhttp.open("GET", '/get_s3_info');
        xhttp.send();
    }

    if (isTagging||isBounding) {
        emptyCount = 0
        if (isIDing && (document.getElementById('btnSendToBack')==null)) {
            loadNewCluster()
        } else {
            for (i=0;i<1;i++){
                loadNewCluster()
            }
        }
    }

    // if (document.location.href.includes('task')) {
    //     switchToTask(/task=([^&]+)/.exec(document.location.href)[1])
    // }

    // if (isTagging) { 
    //     fetchTaggingLevel()

    //     if (!isTutorial) {
    //         updateProgress()
    //     }
    // }
}

function removeMultiLabel(label,mapID = 'map1') {
    /** Removes the specified label from a set of multiple labels for the current cluster. */
    labelbtn = document.getElementById(label)

    if (divBtns != null) {
        divBtns.removeChild(labelbtn)
    }

    labelIndex = clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(label)
    label_id = clusters[mapID][clusterIndex[mapID]][ITEM_IDS][labelIndex]
    clusters[mapID][clusterIndex[mapID]][ITEMS].splice(labelIndex, 1);
    clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(labelIndex, 1);
    clusterLabels[mapID].splice(clusterLabels[mapID].indexOf(label_id), 1)

    if (clusters[mapID][clusterIndex[mapID]][ITEMS].length == 0) {
        clusters[mapID][clusterIndex[mapID]][ITEMS] = ['None']
        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = ['0']
    }
    updateDebugInfo(mapID) 
}


function activateMultiple(mapID = 'map1') {
    /** Activates/deactivates multiple-label mode, submitting the labels if necessary. */

    if (clusters[mapID][clusterIndex[mapID]] != undefined) {
        if (isTutorial) {
            if (finishedDisplaying[mapID] && !modalActive && !modalActive2) {
                if (!tutProcessUserInput("multiple")) return;
            } else {
                return;
            }
        }
    
        allow = true
        if (clusters[mapID][clusterIndex[mapID]].required.length>1) {
            if (reachedEnd == false) {
                allow = false
                document.getElementById('modalAlertText').innerHTML = 'This cluster may contain more species, please cycle through all images before tagging it.'
                modalAlert.modal({keyboard: true});
            }
        }
    
    
        if ((((modalActive == false) && (modalActive2 == false)) || (taggingLevel.includes('-2'))) && (allow==true) && (taggingLevel!='-3') && (clusters[mapID][clusterIndex[mapID]].id != '-99') && (clusters[mapID][clusterIndex[mapID]].id != '-101') && (clusters[mapID][clusterIndex[mapID]].id != '-782')) {
            if ((multipleStatus == false) && (divBtns != null)) {
                var multibtn = document.getElementById('multipleBtn');
                
                if (multibtn!=null) {
                    if (taggingLevel.includes('-2')) {
                        multibtn.innerHTML = 'Submit (Ctrl)'
                    } else {
                        multibtn.innerHTML = 'Done (Ctrl)'
                    }
        
                    multibtn.setAttribute("class", "btn btn-success btn-block btn-sm");
                    multipleStatus = true
        
                    if (taggingLevel.includes('-2')) {
                        for (i=0;i<clusters[mapID][clusterIndex[mapID]].tags.length;i++){
                            idx = names.indexOf(clusters[mapID][clusterIndex[mapID]].tags[i])
                            if (idx > -1) {
                                var btn = document.getElementById(hotkeys[idx]);
                                btn.setAttribute("class", "btn btn-success btn-block btn-sm");               
                            }
                        }
                    } else {
                        for (i=0;i<clusters[mapID][clusterIndex[mapID]][ITEMS].length;i++){
                            idx = names.indexOf(clusters[mapID][clusterIndex[mapID]][ITEMS][i])
                            if (idx > -1) {
                                var btn = document.getElementById(hotkeys[idx]);
                                btn.setAttribute("class", "btn btn-success btn-block btn-sm");               
                            } else if (((isReviewing||isTagging)||isClassCheck)&&(clusters[mapID][clusterIndex[mapID]][ITEMS][i].toLowerCase()!='none')) {
                                // add selected buttons from other tagging levels
                                var newbtn = document.createElement('button');
                                newbtn.innerHTML = clusters[mapID][clusterIndex[mapID]][ITEMS][i];
                                newbtn.setAttribute("id", clusters[mapID][clusterIndex[mapID]][ITEMS][i]);
                                newbtn.setAttribute("class", "btn btn-success btn-block btn-sm");
                                newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
                                newbtn.addEventListener('click', (evt)=>{
                                    removeMultiLabel(evt.target.id);
                                });
                                divBtns.insertBefore(newbtn, multibtn.nextSibling);
                            }
                        }
                    }
                }
            } else {
                multipleStatus = false
    
                if (isClassCheck) {
                    suggestionBack()
                } else {
                    getKeys()
                }
    
                if (!taggingLevel.includes('-2') && clusters[mapID][clusterIndex[mapID]][ITEMS].includes(taggingLabel) && !clusters[mapID][clusterIndex[mapID]][ITEMS].includes('Skip')) {
                    // nothing
                } else if ((taggingLevel.includes('-2')) || ((clusters[mapID][clusterIndex[mapID]][ITEMS].length > 0) && (!clusters[mapID][clusterIndex[mapID]][ITEMS].includes('None')))) {
                    submitLabels(mapID)
                    if (!clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(nothingLabel.toString())) {
                        // nothings need to wait to see if they ae ediected first
                        nextCluster(mapID)
                    }
                }
            }
        }
    }
}

function submitLabels(mapID = 'map1') {
    /** Submits the labels contained in the clusterLabels global as the labels for the current cluster. */
    var formData = new FormData()
    formData.append("labels", JSON.stringify(clusterLabels[mapID]))
    if (taggingLevel.includes('-2') && isReviewing) {
        formData.append("taggingLevel", '-2')
    }
    console.log(clusterLabels[mapID])
    nothingStatus = false
    if (clusterLabels[mapID].includes(nothingLabel.toString())) {
        // reallocate on nothing
        nothingStatus = true
    }
    clusterID = clusters[mapID][clusterIndex[mapID]].id
    var xhttp = new XMLHttpRequest();
    if (isTagging) { 
        xhttp.onreadystatechange = function(wrapNothingStatus) {
            return function() {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                } else if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    if (reply!='error') {
                        if (wrapNothingStatus) {
                            if (reply.reAllocated=='true') {
                                clusterRequests[mapID] = [];
                                clusters[mapID] = clusters[mapID].slice(0,clusterIndex[mapID]+1);
                            } else {
                                nextCluster(mapID)
                            } 
                        }               
                        Progress = reply.progress
                        updateProgBar(Progress)
                    }
                }
            }
        }(nothingStatus)
    }
    xhttp.open("POST", '/assignLabel/'+clusterID, true);
    xhttp.send(formData);
    if (batchComplete&&nothingStatus) {
        redirectToDone()
    }
}

function initKeys(res){
    /** Initialises the buttons for the current task, using the input data. */
    if ((!isBounding) && (divBtns != null)) {
        if (multipleStatus) {
            reActivate = true
        } else {
            reActivate = false
        }

        while(divBtns.firstChild){
            divBtns.removeChild(divBtns.firstChild);
        }

        // Add multiple species button
        var newbtn = document.createElement('button');

        if (taggingLevel.includes('-2')) {
            newbtn.innerHTML = 'Multiple Tags (Ctrl)';
        } else {
            newbtn.innerHTML = 'Multiple Species (Ctrl)';
        }

        newbtn.setAttribute("id", 'multipleBtn');
        newbtn.setAttribute("class", "btn btn-danger btn-block btn-sm");
        newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
        newbtn.addEventListener('click', (evt)=>{
            activateMultiple();
        });
        divBtns.appendChild(newbtn);

        labs = res[0]
        names = res[1]

        // Add other important buttons
        for (i=0;i<labs.length;i++) {
            if (((names[i]=='Wrong')||(names[i]=='Skip'))&&(labs[i] != EMPTY_HOTKEY_ID)) {
                hotkeys[i] = labs[i].toString()
                labelName = names[i]

                if (names[i]=='Wrong') {
                    wrongLabel = labs[i]
                    if (wrongStatus) {
                        labelName = 'Back'
                    }
                } else if ((names[i]=='Skip')&&(wrongStatus)) {
                    for (tl in globalKeys) {
                        for (tl2=0;tl2<globalKeys[tl][0].length;tl2++) {
                            if (globalKeys[tl][0][tl2]==tempTaggingLevel) {
                                labelName = globalKeys[tl][1][tl2]
                                hotkeys[i] = tempTaggingLevel.toString()
                                break
                            }
                        }
                    }
                }

                var newbtn = document.createElement('button');
                newbtn.classList.add('btn');
                if (i < 10) {
                    newbtn.classList.add('btn-danger');
                    newbtn.innerHTML = labelName + ' (' + String.fromCharCode(parseInt(i)+48) + ')';
                } else if (i == labs.length-1) {
                    newbtn.classList.add('btn-danger');
                    newbtn.innerHTML = labelName + ' (Space)';
                } else {
                    newbtn.classList.add('btn-danger');
                    newbtn.innerHTML = labelName + ' (' + String.fromCharCode(parseInt(i)+55) + ')';
                }
                newbtn.setAttribute("id", hotkeys[i]);
                newbtn.classList.add('btn-block');
                newbtn.classList.add('btn-sm');
                newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
                newbtn.addEventListener('click', (evt)=>{
                    assignLabel(evt.target.id);
                });
                divBtns.appendChild(newbtn);
            }
        }

        // Add other buttons
        for (i=0;i<labs.length;i++) {
            if ((names[i]!='Wrong')&&(names[i]!='Skip')) {
                hotkeys[i] = labs[i].toString()
                labelName = names[i]

                if (names[i]=='Unknown') {
                    unknownLabel = labs[i]
                } else if (names[i]=='Nothing') {
                    nothingLabel = labs[i]
                } else if (names[i]=='Knocked Down') {
                    downLabel = labs[i]
                }
    
                if (labs[i] != EMPTY_HOTKEY_ID) {
                    var newbtn = document.createElement('button');
                    newbtn.classList.add('btn');
                    if (i < 10) {
                        newbtn.classList.add('btn-primary');
                        newbtn.innerHTML = labelName + ' (' + String.fromCharCode(parseInt(i)+48) + ')';
                    } else if (i == labs.length-1) {
                        newbtn.classList.add('btn-info');
                        newbtn.innerHTML = labelName + ' (Space)';
                    } else {
                        newbtn.classList.add('btn-info');
                        newbtn.innerHTML = labelName + ' (' + String.fromCharCode(parseInt(i)+55) + ')';
                    }
                    newbtn.setAttribute("id", hotkeys[i]);
                    newbtn.classList.add('btn-block');
                    newbtn.classList.add('btn-sm');
                    newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
                    newbtn.addEventListener('click', (evt)=>{
                        assignLabel(evt.target.id);
                    });
                    divBtns.appendChild(newbtn);
                }
            }
        }

        // if (taggingLevel.includes('-2') && (multipleStatus==false)) {
        //     activateMultiple()
        // } else 
        // if ((!isTagging) || isClassCheck) {
        //     if (multipleStatus==true) {
        //         multipleStatus = false
        //         activateMultiple()
        //     }
        // } else {
        //     multipleStatus = false
        // }
        multipleStatus = false

        if (reActivate) {
            activateMultiple()
        }
    }
}

document.onkeydown = function(event) {
    /** Prevent scrolling from key presses */
    if (['insert','pagedown','pageup','home','end',' '].includes(event.key.toLowerCase())) {
        event.preventDefault()
    }
}

document.onkeyup = function(event){
    /** Sets up the hotkeys. */
    event.preventDefault()
    activity = true
    if (isTutorial) {
        if (finishedDisplaying['map1'] && !modalActive && !modalActive2) {
            if (event.key.toLowerCase() == ']' || 
                event.key.toLowerCase() == '[' ||
                event.key.toLowerCase() == 'enter') {
                tutProcessUserInput(event.key.toLowerCase());
            }
        } else {
            return;
        }
    }

    switch (event.key.toLowerCase()){
        case (']'):
        case ('insert'):
            updateImageProperty('brightness','increase',10)
            break;
        case ('['):
        case ('delete'):
            updateImageProperty('brightness','decrease',10)
            break;
        case ("'"):
        case ('home'):
            updateImageProperty('contrast','increase',10)
            break;
        case (';'):
        case ('end'):
            updateImageProperty('contrast','decrease',10)
            break;
        case ('.'):
        case ('pageup'):
            updateImageProperty('saturate','increase',10)
            break;
        case (','):
        case ('pagedown'):
            updateImageProperty('saturate','decrease',10)
            break;
        case ('/'):
        case ('backspace'):
            resetImageProperty()
            break;
    }

    if (isIDing) {
        idKeys(event.key.toLowerCase())
    } else if (isTagging||isReviewing) {
        // console.log(event)
        switch (event.key.toLowerCase()){
            case ('0'):assignLabel(hotkeys[0])
                break;
            case ('1'):assignLabel(hotkeys[1])
                break;
            case ('2'):assignLabel(hotkeys[2])
                break;
            case ('3'):assignLabel(hotkeys[3])
                break;
            case ('4'):assignLabel(hotkeys[4])
                break;
            case ('5'):assignLabel(hotkeys[5])
                break;
            case ('6'):assignLabel(hotkeys[6])
                break;
            case ('7'):assignLabel(hotkeys[7])
                break;
            case ('8'):assignLabel(hotkeys[8])
                break;
            case ('9'):assignLabel(hotkeys[9])
                break;

            case ('a'):assignLabel(hotkeys[10])
                break;
            case ('b'):assignLabel(hotkeys[11])
                break;
            case ('c'):assignLabel(hotkeys[12])
                break;
            case ('d'):assignLabel(hotkeys[13])
                break;
            case ('e'):assignLabel(hotkeys[14])
                break;
            case ('f'):assignLabel(hotkeys[15])
                break;
            case ('g'):assignLabel(hotkeys[16])
                break;
            case ('h'):assignLabel(hotkeys[17])
                break;
            case ('i'):assignLabel(hotkeys[18])
                break;
            case ('j'):assignLabel(hotkeys[19])
                break;

            case ('k'):assignLabel(hotkeys[20])
                break;
            case ('l'):assignLabel(hotkeys[21])
                break;
            case ('m'):assignLabel(hotkeys[22])
                break;
            case ('n'):assignLabel(hotkeys[23])
                break;
            case ('o'):assignLabel(hotkeys[24])
                break;
            case ('p'):assignLabel(hotkeys[25])
                break;
            case ('q'):assignLabel(hotkeys[26])
                break;
            case ('r'):assignLabel(hotkeys[27])
                break;
            case ('s'):assignLabel(hotkeys[28])
                break;
            case ('t'):assignLabel(hotkeys[29])
                break;

            case ('u'):assignLabel(hotkeys[30])
                break;
            case ('v'):assignLabel(hotkeys[31])
                break;
            case ('w'):assignLabel(hotkeys[32])
                break;
            case ('x'):assignLabel(hotkeys[33])
                break;
            case ('y'):assignLabel(hotkeys[34])
                break;
            case ('z'):assignLabel(hotkeys[35])
                break;

            case (' '):assignLabel(hotkeys[36])
                break;

            case 'control': activateMultiple()
                break;

            case 'enter': Notes()
                break;

            case '`': 
            case '~':
                prevCluster()
                break;

            case 'arrowright': nextImage()
                break;
            case 'arrowleft': prevImage()
                break;
        }
    } else if (isKnockdown) {
        switch (event.key.toLowerCase()){
            case ('k'):handleKnock(1)
                break;
            case ('n'):handleKnock(0)
                break;
        }
    } else if (isComparison) {
        switch (event.key.toLowerCase()){
            case 'arrowright': nextCluster()
                break;
            case 'arrowleft': prevCluster()
                break;
        }
    } else if (isBounding) {
        switch (event.key.toLowerCase()){
            case '`': prevCluster()
                break;
            case (' '): submitChanges()
                break;
            case 'f': saveBounding()
                break;
            case 'escape': cancelBounding()
                break;
            case 'd': deleteBounding()
                break;
            case 'a': addBounding()
                break;
            case 'e': editBounding()
                break;
            case 'c': clearBounding()
                break;
            case 'h': hideBoundingLabels()
                break;
        }
    } else {
        switch (event.key.toLowerCase()){
            case 'arrowright': nextImage()
                break;
            case 'arrowleft': prevImage()
                break;
        }
    }
}

document.onclick = function (event){
    /** Closes the context menu on click when editing the bounding boxes, or whilst doing individual ID. */
    activity = true
    if (isBounding) {
        for (mapID in map) {
            if (map[mapID].contextmenu.isVisible()) {
                map[mapID].contextmenu.hide()
                plusInProgress = false
                currentHierarchicalLevel = []
                map[mapID].contextmenu.removeAllItems()
            }
        }
    } else if (isIDing && (document.getElementById('btnSendToBack')==null)) {
        for (mapID in map) {
            if (map[mapID].contextmenu.isVisible()) {
                map[mapID].contextmenu.hide()
            }
        }
    }
}

function redirectToDone() {
    /** Wraps up the user's session when they save & exit. */
    window.location.replace("done")
}

function checkWaitModal(mapID = 'map1') {
    /** Countdown to redirect on please wait modal. Attempts to load new clusters as well. */

    PlsWaitCountDown -= 1
    if (PlsWaitCountDown<=0) {
        window.location.replace("done")
        document.getElementById('PlsWaitCountDownDiv').innerHTML = "0"
    } else {
        document.getElementById('PlsWaitCountDownDiv').innerHTML = PlsWaitCountDown
    }

    if ((xl == false)&&(isTagging ==false)&&(isReviewing ==false)&&(isKnockdown == false)) {
        if (clusterIndex[mapID] >= clusterIDs.length) {
            if (modalWait2.is(':visible')) {
                modalWait2Hide = true
                modalWait2.modal('hide');
            }
        }
    } else {
        if (clusters[mapID].length <= clusterIndex[mapID]) {
            loadNewCluster(mapID)
        }        
    }
    if (clusters[mapID][clusterIndex[mapID]]!=undefined) {
        if (waitModalID==undefined) {
            if (modalWait2.is(':visible')) {
                modalWait2Hide = true
                modalWait2.modal('hide');
            }
        } else if (waitModalID!=undefined) {
            if (isKnockdown) {
                if (clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id != waitModalID.images[imageIndex[mapID]].id) {
                    if (modalWait2.is(':visible')) {
                        modalWait2Hide = false
                        modalWait2.modal('hide');
                    }
                }
            } else {
                if (clusters[mapID][clusterIndex[mapID]].id != waitModalID.id) {
                    if (modalWait2.is(':visible')) {
                        modalWait2Hide = false
                        modalWait2.modal('hide');
                    }
                }
            }
        }
    }
}

//This snippet just serves to deselect a button after being clicked. Otherwise spacebar just serves to repeat whichever
//button was clicked (by mouse) last.
document.addEventListener('click', function(e) { if(document.activeElement.toString() == '[object HTMLButtonElement]'){ document.activeElement.blur(); } })
// window.addEventListener("resize", sizeCanvas);

//Maintain modalActive status
modalWelcome.on('shown.bs.modal', function(){
    modalActive = true;
});
modalAlert.on('shown.bs.modal', function(){
    modalActive = true;
});
modalAlert.on('hidden.bs.modal', function(){
    modalActive = false;
});
modalDone.on('shown.bs.modal', function(){
    /** Additionally close other modals when done modal is displayed. */
    if (modalWait2.is(':visible')) {
        modalWait2Hide = true
        modalWait2.modal('hide');
    }
    if (modalWait.is(':visible')) {
        modalWait.modal('hide');
    }
    modalActive = true;
});
modalDone.on('hidden.bs.modal', function(){
    modalActive = false;
});
modalWait2.on('shown.bs.modal', function(){
    /** Additionally begin countdown to redirect. */
    if (modalWait2Hide || ((typeof(modalDuplicate)!='undefined')&&(modalDuplicate.is(':visible')))) {
        modalWait2.modal('hide');
    }
    modalActive2 = true;
    PlsWaitCountDown = 30
    document.getElementById('PlsWaitCountDownDiv').innerHTML = PlsWaitCountDown
    timerWaitModal = setInterval(checkWaitModal, 1000);
});
modalWait2.on('hidden.bs.modal', function(){
    /** Additionally clear the redirect countdown. */
    modalActive2 = false;
    clearInterval(timerWaitModal);
    document.getElementById("modalWait2p").innerHTML = ''
});