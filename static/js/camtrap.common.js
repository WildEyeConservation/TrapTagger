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

var selectedTask = 0
var selectedSurvey = 0
var isTagging
var hotkeys = []
var skipLabel = -900
var RFDLabel = -900
var nothingLabel = -900
var unknownLabel = -900
var downLabel = -900
var wrongLabel = -900
var unKnockLabel = -123
var maskLabel = -900
var xl
var isReviewing
var isComparison
var isNoteActive = false
var isSearchNoteActive = false
var isDateActive = false
var notesOnly = false
var taggingLevel = '-23'
var taggingLabel = 'None'
var taggingAlgorithm = 'None'
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
var batchComplete = false
var knockedTG = null
var maskedTG = null
var knockWait = false
var EMPTY_HOTKEY_ID = '-967'
var NEXT_CLUSTER_ID = '-729'
var rectOptions
var maskRectOptions
var targetRect = null
var targetUpdated = null
var isTutorial = window.location.href.includes("tutorial");
var doneWait = false
var clusterReadyTimer = null
var isClassCheck = false
var individualsReady
var sendBackMode = false
var sendBackBoundingMode = false
var activity = true
var pingTimer
var isViewing
var PlsWaitCountDown
var modalWait2Hide = false
var globalKeys = null
var ITEMS='label'
var ITEM_IDS='label_ids'
var wrongStatus = false
var dontResetWrong = false
var tempTaggingLevel=null
var orginal_labels
var orginal_label_ids
var skipName = null
var idIndiv101 = false
var isMaskCheck = false
var isTimestampCheck
var ctrlHeld = false

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
const modalNote = $('#modalNote');
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
const modalMaskArea = $('#modalMaskArea');
const forwardImageBtn = document.querySelector('#forwardImage');
const backImageBtn = document.querySelector('#backImage');

const skipNum = 5

var waitModalMap = null
var classificationCheckData = {'overwrite':false,'data':[]}
var baseClassifications = null
var tempClassifications =  {"map1": []}

var clusters = {"map1": []}
var clusterIndex = {"map1": 0}
var imageIndex = {"map1": 0}
var clusterRequests = {"map1": []}
var finishedDisplaying = {"map1": true}
var map = {"map1": null}
var drawnItems = {"map1": null}
var drawnMaskItems = {"map1": null}
var pauseControl = {"map1": null}
var playControl = {"map1": null}
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
var maskCheckData = {}
var globalMasks = {"map1": []}
var maskMode = false
var detectionGroups = {}
var editedFlanks = {}
var preloadImageIndex = {"map1": 0}

// var colours = {
//     'rgba(67,115,98,1)': false,
//     //'rgba(89,228,170,1)': false,
//     'rgba(61,105,121,1)': false,
//     // 'rgba(57,159,113,1)': false,
//     'rgba(102,172,157,1)': false,
//     // 'rgba(20,48,55,1)': false,
//     'rgba(35,108,144,1)': false,
//     // 'rgba(104,38,137,1)': false,
//     'rgba(88,63,124,1)': false,
//     // 'rgba(78,46,176,1)': false,
//     'rgba(182,92,88,1)': false,
//     // 'rgba(149,88,63,1)': false,
//     'rgba(225,158,139,1)': false,
//     // 'rgba(214,131,97,1)': false,
//     'rgba(222,156,183,1)': false,
//     // 'rgba(202,90,156,1)': false,
//     'rgba(215,61,113,1)': false,
//     // 'rgba(150,90,115,1)': false,
//     'rgba(229,177,54,1)': false,
//     // 'rgba(157,110,35,1)': false,
//     'rgba(220,173,105,1)': false,
//     // 'rgba(143,115,79,1)': false,
//     'rgba(223,138,46,1)': false,
//     // 'rgba(220,191,155,1)': false,
//     'rgba(203,218,69,1)': false,
//     // 'rgba(85,159,58,1)': false,
//     'rgba(111,129,54,1)': false,
//     // 'rgba(117,223,84,1)': false,
//     'rgba(189,218,138,1)': false
// }

var colours = {
    'rgba(70,120,100,1)': false,    // Slightly lighter green-blue
    'rgba(38,113,150,1)': false,    // Slightly lighter blue
    'rgba(100,170,155,1)': false,   // Slightly lighter teal
    'rgba(64,110,125,1)': false,    // Slightly lighter grey-blue
    'rgba(91,68,128,1)': false,     // Slightly lighter purple
    'rgba(185,97,92,1)': false,     // Slightly lighter red
    'rgba(230,163,143,1)': false,   // Slightly lighter peach
    'rgba(225,161,187,1)': false,   // Slightly lighter pink
    'rgba(218,66,118,1)': false,    // Slightly lighter magenta
    'rgba(232,182,58,1)': false,    // Slightly lighter yellow
    'rgba(223,178,108,1)': false,   // Slightly lighter light brown
    'rgba(226,143,50,1)': false,    // Slightly lighter orange
    'rgba(206,223,73,1)': false,    // Slightly lighter light green
    'rgba(114,134,58,1)': false,    // Slightly lighter olive
    'rgba(192,223,142,1)': false    // Slightly lighter pale green
}

function modifyToCompURL(url) {
    /** Modifies the source URL to the compressed folder of the user */
    var isImage = checkImage(url)
    if (isImage) {
        splits=url.split('/')
        splits[0]=splits[0]+'-comp'
        return splits.join('/')
    }
    else {
        splits=url.split('/')
        splits[0]=splits[0]+'-comp'
        splits[splits.length-1]=splits[splits.length-1].substring(0, splits[splits.length-1].lastIndexOf('.'))+'.mp4'
        return splits.join('/')
    }
    
}

function checkImage(url){
    /** Checks if the url is an image or not */
    if (url.includes('jpg') || url.includes('JPG') || url.includes('jpeg') || url.includes('JPEG') || url.includes('png') || url.includes('PNG')) {
        return true
    }
    else {
        return false
    }
}

function preload(mapID = 'map1') {
    /** Pre-loads the next three first-images of the next clusters. */
    if (bucketName!=null) {
        if (isKnockdown||isTimestampCheck) {
            if (clusters[mapID][clusterIndex[mapID]].images.length > 1) {
                if (isTimestampCheck){
                    if (imageIndex[mapID] == 0){
                        preloadImageIndex[mapID] = 0
                    }
                    if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
                        for (let j=0;j<3;j++) {
                            if (preloadImageIndex[mapID]+j < clusters[mapID][clusterIndex[mapID]].images.length) {
                                im = new Image();
                                im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID]].images[preloadImageIndex[mapID]+j].url)
                                preloadImageIndex[mapID] += 1
                            }
                        }
                    }
                } else {
                    for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
                        if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
                            im = new Image();
                            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID]].images[i].url)
                        }
                    }
                }
            }
        } else if (clusters[mapID].length > 1) {
            for (let i=1;i<=3;i++) {
                if (clusters[mapID].length > clusterIndex[mapID] + i) {
                    if ((clusters[mapID][clusterIndex[mapID] + i].id != '-99')&&(clusters[mapID][clusterIndex[mapID] + i].id != '-101')&&(clusters[mapID][clusterIndex[mapID] + i].id != '-782')) {
                        if (clusters[mapID][clusterIndex[mapID] + i].required.length==0) {
                            im = new Image();
                            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID] + i].images[0].url)
                            if (isStaticCheck) {
                                for (let j=1;j<4;j++) {
                                    if (clusters[mapID][clusterIndex[mapID] + i].images.length > j) {
                                        im = new Image();
                                        im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID] + i].images[j].url)
                                    }
                                }
                            }
                        } else {
                            for (let requiredIndex=0;requiredIndex<clusters[mapID][clusterIndex[mapID] + i].required.length;requiredIndex++) {
                                im = new Image();
                                req = clusters[mapID][clusterIndex[mapID] + i].required[requiredIndex]
                                im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID] + i].images[req].url)
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

function buildDetection(image,detection,mapID = 'map1',colour=null) {
    if (detection.static == false || (detection.static == true && isStaticCheck == true)) {
                 
        if (isIDing && (detection.individual!='-1') && mapID!='known') {
            rectOptions.color = individuals[individualIndex][detection.individual].colour
        } else {
            if (colour) {
                rectOptions.color = colour
            } else {
                rectOptions.color = "rgba(223,105,26,1)"
            }
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

        } else if ((document.getElementById('btnSendToBack')!=null)&&(isIDing)&&(mapID!='known')) {
            if (detection.individual!='-1') {
                // rect.bindTooltip(individuals[individualIndex][detection.individual].name,{permanent: true, direction:"center"})
                // var center = L.latLng([(rect._bounds._northEast.lat+rect._bounds._southWest.lat)/2,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                // var bottom = L.latLng([rect._bounds._southWest.lat,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                // var centerPoint = map[mapID].latLngToContainerPoint(center)
                // var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
                // var offset = [0,centerPoint.y-bottomPoint.y]
                // rect._tooltip.options.offset = offset
                // rect._tooltip.options.opacity = 0.8
                // rect.openTooltip()

                var center = L.latLng([(rect._bounds._northEast.lat+rect._bounds._southWest.lat)/2,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                var top = L.latLng([rect._bounds._northEast.lat,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                var centerPoint = map[mapID].latLngToContainerPoint(center)
                var topPoint = map[mapID].latLngToContainerPoint(top)
                var offset = [0,topPoint.y-centerPoint.y]

                // If the popup is too close to the top of the map, move it down
                if (rect._bounds._northEast.lat >= map[mapID].getBounds().getNorth()-15) {
                    offset = [0, 0]
                }
        
                rect.bindPopup(individuals[individualIndex][detection.individual].name,{closeButton: false, autoClose: false, closeOnClick: false, autoPan: false, minWidth: 0})
                rect._popup.options.offset = offset

                rect.on('mouseover', function (e) {
                    this.openPopup();
                });
                rect.on('mouseout', function (e) {
                    this.closePopup();
                });

            }

            if (detection.id in editedFlanks) {
                rect.bindTooltip(editedFlanks[detection.id],{permanent: true, direction:"center"})
            }
            else{
                rect.bindTooltip(detection.flank,{permanent: true, direction:"center"})
            }

            var center = L.latLng([(rect._bounds._northEast.lat+rect._bounds._southWest.lat)/2,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
            var bottom = L.latLng([rect._bounds._southWest.lat,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
            var centerPoint = map[mapID].latLngToContainerPoint(center)
            var bottomPoint = map[mapID].latLngToContainerPoint(bottom)
            var offset = [0,centerPoint.y-bottomPoint.y]
    
            rect._tooltip.options.offset = offset
            rect._tooltip.options.opacity = 0.8
            rect.openTooltip()
        }
        else if (isIDing && (document.getElementById('btnSendToBack')==null)&&(mapID!='known')) {
            //Set the map view to fit detection bounds when viewing individual
            fitBoundsInProcess[mapID] = true
            map[mapID].fitBounds(rect.getBounds(), {padding: [10,10]});
            // map[mapID].once('moveend', function(wrapMapID,wrapDetectionID) {
            //     return function() {
            //         if (fitBoundsInProcess[wrapMapID]) {
            //             fitBoundsInProcess[wrapMapID] = false
            //             detection_zoom[wrapMapID][wrapDetectionID] = map[mapID].getZoom()
            //             updateKpts()
            //         }
            //     }
            // }(mapID,detection.id));
        }

        drawnItems[mapID].addLayer(rect)
        if (isBounding) {
            if (!toolTipsOpen) {
                rect.closeTooltip()
            }
            dbDetIds[mapID][rect._leaflet_id.toString()] = detection.id.toString()
        }

        if (isIDing&&(mapID!='known')) {
            if (!toolTipsOpen) {
                rect.closeTooltip()
            }
            if (!popUpsOpen) {
                rect.closePopup()
            }
            dbDetIds[mapID][rect._leaflet_id.toString()] = detection.id.toString()
        }

        if (document.getElementById('btnSendBoundingBack')!=null&&(mapID!='known')){
            // Highlights and un-highlight when click on bounding box
            rect.addEventListener('click', function(wrapRect){
                return function() {
                    // Send to bounding boxes back when editing sightings (bounding-box correction)
                    if (sendBackBoundingMode) {
                        wrapRect.bringToBack()
                        sendBoundingBack()
                    }
                    else if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
                        if (prevClickBounding != null){
                            colour = "rgba(223,105,26,1)"
                            prevClickBounding.rect.setStyle({color: colour}); //un-highlight old selection
                        }
                    
                        wrapRect.setStyle({color: "rgba(225,225,225,1)"}); //highlight new selection
                        prevClickBounding = {'rect': wrapRect}
                    }
                    
                }
            }(rect));      
            // Highlights and un-highlight when right click on bounding box
            rect.addEventListener('contextmenu', function(wrapRect){
                return function() {
                    if(!drawControl._toolbars.edit._activeMode && !drawControl._toolbars.draw._activeMode){
                        if (prevClickBounding != null){
                            colour = "rgba(223,105,26,1)"
                            prevClickBounding.rect.setStyle({color: colour}); //un-highlight old selection
                        }
                    
                        wrapRect.setStyle({color: "rgba(225,225,225,1)"}); //highlight new selection
                        prevClickBounding = {'rect': wrapRect}
                    }
                }
            }(rect));
        }

        if (document.getElementById('btnSendToBack')!=null&&(mapID!='known')) {
            rect.addEventListener('click', function(wrapMapID,wrapDetectionID,wrapImageID,wrapRect) {
                return function() {
                    if (individualsReady) {
                        wrapIndividual = '-1'
                        for (let individualID in individuals[individualIndex]) {
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

                                for (let individualID in newSet) {
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
                                for (var colour in colours) {
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
                                    // wrapList = [wrapImageID]
                                    wrapList = []
                                }
                                
                                for (let i=0;i<prevList.length;i++) {
                                    if (wrapList.includes(prevList[i])) {
                                        disallow = true
                                    }
                                }
                            }

                            // if ((disallow)||(previousClick == null)||(previousClick.map==wrapMapID)||(previousClick.image==wrapImageID)||((previousClick.individual==wrapIndividual)&&(wrapIndividual!='-1'))) {                            
                            if ((disallow)||(previousClick == null)||(previousClick.map==wrapMapID)||((previousClick.individual==wrapIndividual)&&(wrapIndividual!='-1'))) {    
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
                                        for (var colour in colours) {
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

                    // alreadyAllocated = false
                    // for (let individualID in individuals[individualIndex]) {
                    //     if (individuals[individualIndex][individualID].detections.includes(wrapDetID)) {
                    //         alreadyAllocated = true
                    //     }
                    // }

                    // if (!alreadyAllocated) {
                    //     if (individuals.length>0) {
                    //         newSet = JSON.parse(JSON.stringify(individuals[individualIndex]))
                    //     } else {
                    //         newSet = {}
                    //     }
                    //     newID = 'n' + wrapDetID.toString()
                    //     for (var colour in colours) {
                    //         if (colours[colour]==false) {
                    //             colours[colour] = true
                    //             break
                    //         }
                    //     }

                    //     detIdList = [wrapDetID]
                    //     imIdList = [wrapImageID]
                    //     newSet[newID] = {"colour": colour, "detections": detIdList, "images": imIdList, "children": [], "family": []}
                    //     globalIndividual = newID
                    //     individuals.push(newSet)
                    //     individualIndex += 1

                    //     if (globalTags==null) {
                    //         var xhttp = new XMLHttpRequest();
                    //         xhttp.onreadystatechange =
                    //             function () {
                    //                 if (this.readyState == 4 && this.status == 278) {
                    //                     window.location.replace(JSON.parse(this.responseText)['redirect'])
                    //                 } else if (this.readyState == 4 && this.status == 200) {
                    //                     globalTags = JSON.parse(this.responseText);
                    //                     prepIndividualModal()
                    //                 }
                    //             };
                    //         xhttp.open("GET", '/prepNewIndividual');
                    //         xhttp.send();
                    //     } else {
                    //         prepIndividualModal()
                    //     }
                    // }
                }
            }(mapID,detection.id,image.id,rect));

        }
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
        if(!isIDing || document.getElementById('btnSendToBack')!=null){
            map[mapID].setZoom(map[mapID].getMinZoom())
        }
        fullRes[mapID] = false
        drawnItems[mapID].clearLayers()
        for (let i=0;i<image.detections.length;i++) {
            buildDetection(image,image.detections[i],mapID)
        }
        if ('comparison' in image) {
            for (let i=0;i<image.comparison.length;i++) {
                buildDetection(image,image.comparison[i],mapID,'rgba(26,105,223,1)')
            }
        }
        if (isBounding) {
            drawControl._toolbars.edit._toolbarContainer.firstElementChild.title = '(E)dit sightings'
            drawControl._toolbars.edit._toolbarContainer.lastElementChild.title = '(D)elete sightings'
        }
        if(isStaticCheck && detectionGroups){
            sg_detections = detectionGroups[clusters[mapID][clusterIndex[mapID]].id]
            for (let i=0;i<sg_detections.length;i++) {
                buildDetection(image,sg_detections[i],mapID)
            }
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
                waitModalMap = mapID
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
            if ((typeof clusters[mapID][clusterIndex[mapID]-1] != 'undefined') && (typeof clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS] != 'undefined') && ((clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].includes(RFDLabel.toString())) || (clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].includes(downLabel)) || (clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].includes(maskLabel)))) {
                redirectToDone()
            } else {
                prevCluster(mapID)
            }
    
        } else if ((clusters[mapID][clusterIndex[mapID]].images.length == 0)||(clusters[mapID][clusterIndex[mapID]].id=='-99')||(clusters[mapID][clusterIndex[mapID]].id=='-782')) {
    
            if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                waitModalID = clusters[mapID][clusterIndex[mapID]]
                waitModalMap = mapID
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

                //update cluster position circles (pagination) - bounding & tutorial pagination needs to be disabled
                if (clusterPositionCircles != null) {
                    var addNext = null
                    var next_function = null
                    if (isBounding) {
                        cirNum = clusters[mapID][clusterIndex[mapID]].clusterLength
                        circlesIndex = clusters[mapID][clusterIndex[mapID]].imageIndex
                    }
                    else if (isStaticCheck) {
                        cirNum = clusters[mapID][clusterIndex[mapID]].images.length
                        circlesIndex = imageIndex[mapID]
                        addNext = staticCheckPage[clusters[mapID][clusterIndex[mapID]].id].next_page
                        next_function = 'nextPageStatic('+addNext+')'
                    }
                    else{
                        cirNum = clusters[mapID][clusterIndex[mapID]].images.length
                        circlesIndex = imageIndex[mapID]
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

                    paginationCircles = document.getElementById('paginationCircles')
                    while (paginationCircles.firstChild) {
                        paginationCircles.removeChild(paginationCircles.firstChild);
                    }


                    if (multiple && beginIndex != 0 && circlesIndex > 2) {
                        first = document.createElement('li')
                        if (isBounding || isTutorial) {
                            first.setAttribute('class','disabled')
                        }
                        else {
                            first.setAttribute('onclick','updateImageIndex(0)')
                        }
                        first.innerHTML = '1'
                        paginationCircles.append(first)
                    
                        more = document.createElement('li')
                        more.setAttribute('class','disabled')
                        more.innerHTML = '...'
                        paginationCircles.append(more)
                    }


                    for (let i=beginIndex;i<endIndex;i++) {
                        li = document.createElement('li')
                        li.innerHTML = (i+1).toString()
                        if (!isBounding && !isTutorial) {
                            li.setAttribute('onclick','updateImageIndex('+(i).toString()+')')
                        }
                        paginationCircles.append(li)

                        if (i == circlesIndex) {
                            li.setAttribute('class','active')
                        } else {
                            if (isBounding || isTutorial) {
                                li.setAttribute('class','disabled')
                            }
                            else {
                                li.setAttribute('class','')
                            }
                        }
                    }

                    if (multiple && endIndex != cirNum && circlesIndex < cirNum-3) {
                        more = document.createElement('li')
                        more.setAttribute('class','disabled')
                        more.innerHTML = '...'
                        paginationCircles.append(more)

                        last_index = cirNum - 1
                        last = document.createElement('li')
                        if (isBounding || isTutorial) {
                            last.setAttribute('class','disabled')
                        }
                        else {
                            last.setAttribute('onclick','updateImageIndex('+(last_index).toString()+')')
                        }
                        last.innerHTML = (last_index+1).toString()
                        paginationCircles.append(last)
                    }

                    if (addNext) {
                        next = document.createElement('li')
                        next.setAttribute('onclick',next_function)
                        next.innerHTML = '>'
                        paginationCircles.append(next)
                    }
                }


                if ((clusterIndex[mapID]==0)&&(imageIndex[mapID]==0)) {
                    updateSlider(mapID)
                }
    
                currentImage[mapID] = image
                addedDetections[mapID] = false

                if (activeImage[mapID] != null) {
                    if (isReviewing){
                        var image_img = checkImage(image.url)
                        if (activeImage[mapID]._url.length == 1){
                            var activeImage_img = checkImage(activeImage[mapID]._url[0])
                        }
                        else{
                            var activeImage_img = checkImage(activeImage[mapID]._url)
                        }

                        if (image_img != activeImage_img){
                            updateMap(mapID, url = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
                        }
                        else{
                            activeImage[mapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
                        }
                    }
                    else if (isIDing && document.getElementById('btnSendToBack')==null) {
                        activeImage[mapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + image.url)
                        fullRes[mapID] = true
                    }
                    else{
                        activeImage[mapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
                    }
                }

                if (isIDing && (typeof clusters['map1'][clusterIndex['map1']] != 'undefined') && (Object.keys(clusters).includes('map2')) && (typeof clusters['map2'][clusterIndex['map2']] != 'undefined') && (imageIndex['map1']<clusters['map1'][clusterIndex['map1']].images.length) && (imageIndex['map2']<clusters['map2'][clusterIndex['map2']].images.length)) {
                    sameCam = document.getElementById('sameCam')
                    timeDelta = document.getElementById('timeDelta')
                    distDelta = document.getElementById('distDelta')
                    debugInfo = document.getElementById('debugInfo')
                    sameCluster = document.getElementById('sameCluster')
                    if ((debugInfo != null)&&(DEBUGGING)) {
                        image1 = clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].id
                        image2 = clusters['map2'][0].images[imageIndex['map2']].id

                        while(debugInfo.firstChild){
                            debugInfo.removeChild(debugInfo.firstChild);
                        }

                        titleSim = document.createElement('div')
                        titleSim.innerHTML = 'Similarities:'
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
                            sameCam.setAttribute('style','color:green;font-size:40px')
                        } else {
                            sameCam.setAttribute('style','color:red;font-size:40px')
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
                            distDelta.innerHTML = 'Image distance: '+Math.floor(distance*1000).toString()+'m'
                        } else {
                            distDelta.innerHTML = 'Image distance: '+distance.toFixed(3)+'km'
                        }
                    }
                    if (sameCluster != null) {
                        if (clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].cluster_id==clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].cluster_id) {
                            sameCluster.setAttribute('style','color:green;font-size:40px')
                        } else {
                            sameCluster.setAttribute('style','color:red;font-size:40px')
                        }
                    }

                    heatmapDiv = document.getElementById('heatmapDiv')
                    if (heatmapDiv != null) {
                        if (taggingAlgorithm == 'hotspotter') {
                            heatmapDiv.hidden = false
                        }
                        else {
                            heatmapDiv.hidden = true
                        }
                    }
                }
                
                if (modalWait2.is(':visible')&&((mapID==waitModalMap)||(waitModalMap==null))) {
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
    
        if ((!isTagging) || (taggingLevel=='-3') || (isClassCheck) || (taggingLevel=='-8')) { //(taggingLevel=='-2'))
            if (clusters[mapID][clusterIndex[mapID]].images.length != 0) {
                updateDebugInfo(mapID)
            }
        }
    }
}

function updateButtons(mapID = 'map1'){
    /** Enables/disables the next/previous image/cluster & undo buttons. */
    if (prevClusterBtn != null) {
        if (isBounding||isClassCheck) {
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
            if ((clusterIndex[mapID]==0)||((clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS]!=undefined)&&(clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].some(r=> [downLabel,downLabel.toString(),RFDLabel,RFDLabel.toString(),maskLabel,maskLabel.toString()].includes(r))))) {
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
                    if (isStaticCheck && staticCheckPage[clusters[mapID][clusterIndex[mapID]].id].next_page!=null){
                        nextImageBtn.classList.remove("disabled")
                    }
                }else{
                    nextImageBtn.classList.remove("disabled")
                }
            }
        }
    }

    if (forwardImageBtn != null) {
        if (taggingLevel == '-3' || taggingLevel == '-8') {
            forwardImageBtn.hidden = false
            if (imageIndex[mapID]>clusters[mapID][clusterIndex[mapID]].images.length-(skipNum+1)){
                forwardImageBtn.disabled = true
            }else if (clusters[mapID][clusterIndex[mapID]].required.includes(imageIndex[mapID])&&(reachedEnd == false)){  // Cannot skip required images
                forwardImageBtn.disabled = true 
            }else{
                forwardImageBtn.disabled = false
            }
        }
        else{
            forwardImageBtn.hidden = true
        }
    }

    if (backImageBtn != null) {
        if (taggingLevel == '-3' || taggingLevel == '-8') {
            backImageBtn.hidden = false
            if (imageIndex[mapID]>skipNum-1){
                backImageBtn.disabled = false
            }else{
                backImageBtn.disabled = true
            }
        }
        else{
            backImageBtn.hidden = true
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
        //     for (let i=0;i<clusters[mapID][clusterIndex[mapID]][ITEMS].length;i++){
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
        for (let imInd=0;imInd<clusters[mapID][clusterIndex[mapID]].images.length;imInd++) {
            for (let detInd=0;detInd<clusters[mapID][clusterIndex[mapID]].images[imInd].detections.length;detInd++) {
                if (clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].individual.includes('n')||clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].individual.includes('e')) {
                    newID = '-1'
                    for (let individualID in individuals[0]) {
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
    if (batchComplete && isTimestampCheck) {
        imageIndex[mapID] = clusters[mapID][clusterIndex[mapID]].images.length-1   
    }
    updateClusterLabels(mapID)

    if (isTagging && !isTutorial && (taggingLevel == '-1' || parseInt(taggingLevel) > 0)) {
        drawnMaskItems[mapID].clearLayers()
        updateMasks(mapID)
    }

    if (wrongStatus && !isReviewing) {
        initKeys(globalKeys[taggingLevel])
    }

    if (document.getElementById('btnSendToBack')!=null) {
        getSuggestions()
        individuals = [{}]
        individualIndex = 0
        for (let colour in colours) {
            colours[colour] = false
        }
        previousClick = null
        backIndex += 1
        document.getElementById('btnNextCluster').hidden = false 
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
            if (isClassCheck && (baseClassifications.length!=clusters[mapID][clusterIndex[mapID]].classification.length)) {
                clusters[mapID][clusterIndex[mapID]].classification = tempClassifications[mapID][clusterIndex[mapID]].slice()
                classificationCheckData = {'overwrite':false,'data':[]}
                updateDebugInfo(mapID)
                if (clusterIndex[mapID]>0){
                    goToPrevCluster(mapID)
                }
                
            } else if (clusterIndex[mapID]>0) {
                if (isBounding||isClassCheck||(document.getElementById('btnSendToBack')!=null)) {
                    if ((clusters[mapID][clusterIndex[mapID]-1].ready)||(clusters[mapID][clusterIndex[mapID]-1].id == '-99')||(clusters[mapID][clusterIndex[mapID]-1].id == '-101')||(clusters[mapID][clusterIndex[mapID]-1].id == '-782')) {
                        goToPrevCluster(mapID)
                    } else {
                        if (clusterReadyTimer==null) {
                            clusterReadyTimer = setInterval(checkClusterReady, 500, mapID);
                        }
                    }
                } else {
                    if ((!isTagging)||((clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS]!=undefined)&&(!clusters[mapID][clusterIndex[mapID]-1][ITEM_IDS].some(r=> [downLabel,downLabel.toString(),RFDLabel,RFDLabel.toString(),maskLabel,maskLabel.toString()].includes(r))))) {
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
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]][ITEM_IDS].length;i++) {
            label_id = parseInt(clusters[mapID][clusterIndex[mapID]][ITEM_IDS][i])
            if (label_id != 0) {
                clusterLabels[mapID].push(label_id)
            }
        }
    }
}

function updateDebugInfo(mapID = 'map1',updateLabels = true) {
    /** Updates the displayed image/cluster info. */
    if ((!isViewing && !isTagging && !isBounding && !isKnockdown && !isStaticCheck && !isTimestampCheck) ||(taggingLevel=='-3')||(isClassCheck)||(taggingLevel=='-8')) { //(!isTagging)
        if ((clusters[mapID][clusterIndex[mapID]].id == '-99')||(clusters[mapID][clusterIndex[mapID]].id == '-101')||(clusters[mapID][clusterIndex[mapID]].id == '-782')) {
            document.getElementById('debugImage').innerHTML =  '';
            document.getElementById('debugLabels').innerHTML = '';
            if (document.getElementById('groundLabels')) {
                document.getElementById('groundLabels').innerHTML = '';
            }
            
        } else {
            if (!isClassCheck) {
                document.getElementById('debugImage').innerHTML =  clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url.split('/').slice(1).join('/');
            } else {
                classifierLabels = document.getElementById('classifierLabels')
                while(classifierLabels.firstChild){
                    classifierLabels.removeChild(classifierLabels.firstChild);
                }

                classifierLabels.innerHTML = 'Suggestion:'

                for (let i=0;i<clusters[mapID][clusterIndex[mapID]].classification.length;i++) {
                    span = document.createElement('span')
                    if (i!=0) {
                        span.setAttribute('style','font-size: 80%;color: rgba(150,150,150,100)')
                    }
                    text = ' ' + clusters[mapID][clusterIndex[mapID]].classification[i][0] //+ ' (' + clusters[mapID][clusterIndex[mapID]].classification[i][1] + ')'
                    if (i!=clusters[mapID][clusterIndex[mapID]].classification.length-1) {
                        text += ','
                    }
                    span.innerHTML = text
                    classifierLabels.appendChild(span)
                }
            }
            
            if (updateLabels) {
                var temp =''
                if (!isReviewing) {
                    temp += "Labels: "
                }
                if (isClassCheck){
                    if (classificationCheckData['overwrite'] != true) {
                        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].label.length;i++) {
                            temp += clusters[mapID][clusterIndex[mapID]].label[i]
                            temp += ', '
                        }
                    }
                    for (let j=0;j<classificationCheckData['data'].length;j++) {
                        if (classificationCheckData['data'][j]['action']=='accept') {
                            temp += classificationCheckData['data'][j]['label']
                            temp += ', '
                        }
                    }
                    temp = temp.slice(0,-2)
                }
                else{
                    for (let i=0;i<clusters[mapID][clusterIndex[mapID]].label.length;i++) {
                        temp += clusters[mapID][clusterIndex[mapID]].label[i]
                        if (i != clusters[mapID][clusterIndex[mapID]].label.length-1) {
                            temp += ', '
                        }
                    }
                }
                document.getElementById('debugLabels').innerHTML = temp;
            }

            if (document.getElementById('groundLabels')) {
                var temp =''
                for (let i=0;i<clusters[mapID][clusterIndex[mapID]].groundTruth[imageIndex[mapID]].length;i++) {
                    temp += clusters[mapID][clusterIndex[mapID]].groundTruth[imageIndex[mapID]][i]
                    if (i != clusters[mapID][clusterIndex[mapID]].groundTruth[imageIndex[mapID]].length-1) {
                        temp += ', '
                    }
                }
                document.getElementById('groundLabels').innerHTML = "Ground Truth: "+temp;
            }

            if (!isClassCheck&&document.getElementById('classifierLabels')) {
                var temp =''
                if (!isReviewing) {
                    temp += "Tags: "
                }
                for (let i=0;i<clusters[mapID][clusterIndex[mapID]].tags.length;i++) {
                    temp += clusters[mapID][clusterIndex[mapID]].tags[i]
                    if (i != clusters[mapID][clusterIndex[mapID]].tags.length-1) {
                        temp += ', '
                    }
                }
                document.getElementById('classifierLabels').innerHTML = temp;
            }

            // Update notes in explore
            if(isReviewing && document.getElementById('noteboxExp')){
                noteTextBox.value = clusters[mapID][clusterIndex[mapID]].notes
                document.getElementById('notif').innerHTML = ""
            }

            if (isReviewing && document.getElementById('annotatorLabel')){
                document.getElementById('annotatorLabel').innerHTML = clusters[mapID][clusterIndex[mapID]].annotator
            }

            if (isReviewing && document.getElementById('siteLabel')){
                document.getElementById('siteLabel').innerHTML = clusters[mapID][clusterIndex[mapID]].site_tag
            }

            if (isReviewing && document.getElementById('debugCoords')){
                document.getElementById('debugCoords').innerHTML = clusters[mapID][clusterIndex[mapID]].latitude + ", " + clusters[mapID][clusterIndex[mapID]].longitude
            }

            if (isReviewing && document.getElementById('imageIndividuals')){
                imageIndividuals = []
                for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections.length;i++) {
                    imageIndividuals.push(...clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].detections[i]['individual_names'])
                }
                if (imageIndividuals.length>0) {
                    document.getElementById('imageIndividualsParent').hidden = false
                } else {
                    document.getElementById('imageIndividualsParent').hidden = true
                }
                document.getElementById('imageIndividuals').innerHTML = imageIndividuals.join(',')
            }

            if (isReviewing && document.getElementById('imageTimestamp')){
                timestamp = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].timestamp

                if (timestamp == 0 || timestamp == null) {
                    document.getElementById('imageTimestamp').innerHTML = "N/A"
                } else {
                    var date = new Date(timestamp * 1000);
                    var year = date.getUTCFullYear();
                    var month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Month is zero-based
                    var day = date.getUTCDate().toString().padStart(2, '0');
                    var hours = date.getUTCHours().toString().padStart(2, '0');
                    var minutes = date.getUTCMinutes().toString().padStart(2, '0');
                    var seconds = date.getUTCSeconds().toString().padStart(2, '0');
                    var formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                    document.getElementById('imageTimestamp').innerHTML = formattedDate
                }
            }
        } 
    }

    if (multipleStatus) {
        if ((clusters[mapID][clusterIndex[mapID]].id != '-99')&&(clusters[mapID][clusterIndex[mapID]].id != '-101')&&(clusters[mapID][clusterIndex[mapID]].id != '-782')) {
            for (let i=0;i<clusters[mapID][clusterIndex[mapID]][ITEMS].length;i++){
                name = clusters[mapID][clusterIndex[mapID]][ITEMS][i]
                if (name==skipName) {
                    name = 'Skip'
                }
                idx = names.indexOf(name)
                if (idx > -1) {
                    var btn = document.getElementById(hotkeys[idx]);
                    btn.setAttribute("class", "btn btn-success btn-block btn-sm");           
                }
            }
        } 
    }

    if (isStaticCheck) {
        document.getElementById('debugImage').innerHTML =  clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url.split('/').slice(1).join('/');
    }

    if (isTimestampCheck) {
        document.getElementById('debugImage').innerHTML = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].name.split('/').slice(1).join('/');
        yearInput.value = ''
        monthInput.value = ''
        dayInput.value = ''
        hourInput.value = ''
        minutesInput.value = ''
        secondsInput.value = ''
        document.getElementById('btnClearTimestamp').hidden = true
        if (clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].extracted_data != '' && clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].extracted_data != null) {
            extracted_data = clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].extracted_data.split(',')
            for (let i=0;i<extracted_data.length;i++) {
                switch (i){
                    case 0:
                        yearInput.value = parseInt(extracted_data[i])
                        monthInput.focus()
                        break
                    case 1:
                        monthInput.value = parseInt(extracted_data[i])
                        dayInput.focus()
                        break
                    case 2:
                        dayInput.value = parseInt(extracted_data[i])
                        hourInput.focus()
                        break
                    case 3:
                        hourInput.value = parseInt(extracted_data[i])
                        minutesInput.focus()
                        break
                    case 4:
                        minutesInput.value = parseInt(extracted_data[i])
                        secondsInput.focus()
                        break
                    case 5:
                        secondsInput.value = parseInt(extracted_data[i])
                        secondsInput.focus()
                        break
                }
            }
            document.getElementById('btnClearTimestamp').hidden = false
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
            else if (isStaticCheck&&imageIndex[mapID]==clusters[mapID][clusterIndex[mapID]].images.length-1&&staticCheckPage[clusters[mapID][clusterIndex[mapID]].id] != null) {
                nextPageStatic(staticCheckPage[clusters[mapID][clusterIndex[mapID]].id].next_page)
            }
        }
    }
}

function forwardImage(mapID = 'map1'){
    /** Switches to the next image in the cluster if its available. */
    if (finishedDisplaying[mapID] == true) {
        // Make an exception for finish looking at cluster modal
        allowBypass=false
        if (modalAlert.is(':visible')) {
            modalAlert.modal('hide');
            allowBypass=true
        }
        if (clusters[mapID][clusterIndex[mapID]].required.includes(imageIndex[mapID])&&(reachedEnd == false)){  // Cannot skip required images
            return;
        }
        if (((modalActive == false) && (modalActive2 == false))||(allowBypass)) {
            if (imageIndex[mapID]<clusters[mapID][clusterIndex[mapID]].images.length-skipNum){
                if ((mapdiv2 != null)&&(previousClick!=null)) {
                    if (previousClick.map==mapID) {
                        previousClick = null
                    }
                }
                if (clusterPositionSplide[mapID] != null) {
                    clusterPositionSplide[mapID].go('+'+skipNum)
                } else {
                    imageIndex[mapID] += skipNum
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

function backImage(mapID = 'map1'){
    /** Switches to the previous image in a cluster. */
    if (finishedDisplaying[mapID] == true) {
        // Make an exception for finish looking at cluster modal
        allowBypass=false
        if (modalAlert.is(':visible')) {
            modalAlert.modal('hide');
            allowBypass=true
        }
        if (((modalActive == false) && (modalActive2 == false))||(allowBypass)) {
            if (imageIndex[mapID]>skipNum-1) {
                if ((mapdiv2 != null)&&(previousClick!=null)) {
                    if (previousClick.map==mapID) {
                        previousClick = null
                    }
                }
                if (clusterPositionSplide[mapID] != null) {
                    clusterPositionSplide[mapID].go('-'+skipNum)
                } else {
                    imageIndex[mapID] -= skipNum
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
        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
            imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID]].images[i].url)
            img = document.createElement('img')
            img.setAttribute('src',imageUrl)
            imgli = document.createElement('li')
            imgli.classList.add('splide__slide')
            imgli.appendChild(img)
            clusterPosition[mapID].appendChild(imgli)
            if (document.getElementById('btnSendToBack') != null) {
                // Create a divider between images from different clusters
                if (i<clusters[mapID][clusterIndex[mapID]].images.length-1 && clusters[mapID][clusterIndex[mapID]].images[i].cluster_id != clusters[mapID][clusterIndex[mapID]].images[i+1].cluster_id) {
                    divider = document.createElement('vl')
                    divider.style.borderLeft = '2px solid #DF691A'
                    divider.style.height = '128px'
                    divider.style.marginRight = '5px'
                    clusterPosition[mapID].appendChild(divider)
                }
            }

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
                    if (wrapMapID=='known'){
                        updateCanvas(wrapMapID)
                        document.getElementById('tgInfoKnown').innerHTML = 'Site: ' + clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].trapgroup.tag
                        document.getElementById('timeInfoKnown').innerHTML = 'Timestamp: ' + clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].timestamp
                    } else {
                        update(wrapMapID)
                        if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                            updateKpts()
                        }
                    }
                }
            }(mapID));

            var track = clusterPositionSplide[mapID].Components.Elements.track
            clusterPositionSplide[mapID].on( 'click', function(wrapMapID,wrapTrack) {
                return function(event) {
                    // imageIndex[wrapMapID] = parseInt(event.target.attributes.id.value.split("slide")[1])-1
                    imageIndex[wrapMapID] = event.index
                    clusterPositionSplide[wrapMapID].go(imageIndex[wrapMapID])
                    if (wrapMapID=='known'){
                        updateCanvas(wrapMapID)
                        document.getElementById('tgInfoKnown').innerHTML = 'Site: ' + clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].trapgroup.tag
                        document.getElementById('timeInfoKnown').innerHTML = 'Timestamp: ' + clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].timestamp
                    } else {
                        update(wrapMapID)
                        if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                            updateKpts()
                        }
                    }
                }
            }(mapID,track));

        } else {
            clusterPositionSplide[mapID].refresh()
        }
        if (clusterIndex['map1']!=0 && document.getElementById('btnSendToBack')!=null) {
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

        if (clusterIndex[mapID]==clusters[mapID].length-1){
            if (clusterRequests[mapID].length==0) {
                document.getElementById('modalAlertText').innerHTML = 'There are no more clusters to display.'
                modalAlert.modal({keyboard: true});
            }
        } 
    }

    if (allow && (finishedDisplaying[mapID] == true) && (multipleStatus==false)) {
        if (modalActive == false) {
            if (clusterIndex[mapID] >= clusters[mapID].length-1) {
                if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                    waitModalID = clusters[mapID][clusterIndex[mapID]]
                    waitModalMap = mapID
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

                if (isClassCheck) {
                    baseClassifications = clusters[mapID][clusterIndex[mapID]].classification.slice()
                }

                update(mapID)

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
                }

            } else if (clusterIndex[mapID]==clusters[mapID].length-1) {
                clusterIndex[mapID] = clusterIndex[mapID] + 1
                reachedEnd = false
            }

            updateClusterLabels(mapID)

            if (isTagging && !isTutorial && (taggingLevel == '-1' || parseInt(taggingLevel) > 0)) {
                drawnMaskItems[mapID].clearLayers()
                updateMasks(mapID)
            }

            if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                actions = []
                preLoadCount = 1
                updateProgress()
            } else {
                preLoadCount = 20
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
                    populateSpeciesSelector()
                    populateTagSelector()
                    populateSiteSelector()
                    populateAnnotatorSelector()
                    selectSpecies(0)
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
    if (!isTagging && !isReviewing && !isKnockdown && !isStaticCheck){
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
    var hasIndividuals = false
    
    if (isTutorial) {
        if (finishedDisplaying[mapID] && !modalActive && !modalActive2) {
            if (!tutProcessUserInput(label)) return;
        } else {
            return;
        }
    }
    else if (isReviewing){
        for (let imInd=0;imInd<clusters[mapID][clusterIndex[mapID]].images.length;imInd++) {
            for (let detInd=0;detInd<clusters[mapID][clusterIndex[mapID]].images[imInd].detections.length;detInd++) {
                if (clusters[mapID][clusterIndex[mapID]].images[imInd].detections[detInd].individual != '-1'){
                    hasIndividuals = true
                    break
                }
            }
        }
    }

    if ((label==taggingLevel)&&(label==tempTaggingLevel)) {
        label = skipLabel
    }
    
    if (label != EMPTY_HOTKEY_ID && !editingEnabled) {
        if (multipleStatus && ((nothingLabel==label)||(downLabel==label)||(RFDLabel==label)||(skipLabel==label)||(maskLabel==label))) {
            //ignore nothing, skip and knocked down labels in multi
        } else if ([RFDLabel,downLabel].includes(parseInt(label)) && !modalNothingKnock.is(':visible')) {
            // confirmation modal for nothing and knockdowns
            if (label==RFDLabel) {
                if (isReviewing) {
                    document.getElementById('modalNothingKnockText').innerHTML = 'You are about to mark the current cluster as containing nothing.<br><br><i>If you wish to continue, press the "-" hotkey again.</i><br><br><i>Otherwise press "Esc" or label the cluster as anything else.</i>'
                } else {
                    document.getElementById('modalNothingKnockText').innerHTML = 'You are about to mark the current cluster as containing nothing and have the associated false detections removed from all other images from this camera.<br><br><i>If you wish to continue, press the "-" hotkey again.</i><br><br><i>Otherwise press "Esc" or label the cluster as anything else.</i>'
                }
            } else if (label==downLabel) {
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
        } else if (label==maskLabel && !maskMode) {
            maskMode = true
            getKeys()
            initMaskMode(mapID)
        } else if (isReviewing && !modalNothingKnock.is(':visible') && hasIndividuals && taggingLevel != '-2') {
            document.getElementById('modalNothingKnockText').innerHTML = 'This cluster contains detections that are linked to specific individuals. If you choose to label this cluster as a different species, all associated detections will be removed from their respective individuals. Please note that this action is irreversible and cannot be undone. <br><br><i>If you wish to continue, press the label hotkey again.</i><br><br><i>Otherwise, press "Esc".</i>'
            modalNothingKnock.modal({keyboard: true}) 
        } else if ((finishedDisplaying[mapID] == true) && (!modalActive) && (modalActive2 == false) && (clusters[mapID][clusterIndex[mapID]].id != '-99') && (clusters[mapID][clusterIndex[mapID]].id != '-101') && (clusters[mapID][clusterIndex[mapID]].id != '-782')) {
    
            if ((taggingLevel=='-3')||(taggingLevel=='-8')) {
                // classification check
    
                var checkVar = 0
                if (clusters[mapID][clusterIndex[mapID]].required.length>1) {
                    // We don't want to force check on accept or overwrite for these types of tasks
                    if ((reachedEnd == false) && (['reject_classification','other_classification'].includes(label))) {
                        document.getElementById('modalAlertText').innerHTML = 'This cluster may contain more species, please cycle through all images before tagging it.'
                        modalAlert.modal({keyboard: true});
                        checkVar = 1
                    }
                }
    
                if (checkVar == 0) {
    
                    if (label == 'other_classification') {
                        // other
                        if (divBtns != null) {
                            orginal_labels = clusters[mapID][clusterIndex[mapID]][ITEMS]
                            orginal_label_ids = clusters[mapID][clusterIndex[mapID]][ITEM_IDS]
                            clusters[mapID][clusterIndex[mapID]][ITEMS] = ['None']
                            clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = ['0']
                            clusterLabels[mapID] = []
                            updateDebugInfo(mapID,false)
    
                            selectBtns = document.getElementById('selectBtns')
                            multipleStatus = false
                            wrongStatus = true
                            tempTaggingLevel = '-1'
                            taggingLevel = '-1'
    
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
    
                            // dropdown = document.createElement('div')
                            // dropdown.classList.add('dropdown')
                            // selectBtns.appendChild(dropdown)
    
                            // dropbutton = document.createElement('button')
                            // dropbutton.setAttribute('class','btn btn-danger btn-block dropdown-toggle btn-sm')
                            // dropbutton.setAttribute('type','button')
                            // dropbutton.setAttribute('data-toggle','dropdown')
                            // dropbutton.innerHTML = 'Annotation Level'
                            // dropdown.appendChild(dropbutton)
    
                            // levelSelector = document.createElement('div')
                            // levelSelector.setAttribute('id','level-selector')
                            // levelSelector.setAttribute('class','dropdown-menu')
                            // dropdown.appendChild(levelSelector)
    
                            // populateLevels()
                            initKeys(globalKeys['-1'])
                        }
                    } else {
                        wrongStatus = false
                        classification = clusters[mapID][clusterIndex[mapID]].classification.shift()
    
                        if (classification != undefined) {
                            // Append to labels
                            classification = classification[0]
        
                            if (label == 'accept_classification') {
                                // accept
                                classificationCheckData['data'].push({'label':classification,'action':'accept'})
                            } else if (label == 'reject_classification') {
                                // reject
                                classificationCheckData['data'].push({'label':classification,'action':'reject'})
                            } else if (label == 'overwrite_classification') {
                                // overwrite
                                classificationCheckData['overwrite'] = true
                                classificationCheckData['data'].push({'label':classification,'action':'accept'})
                            }
                        }
        
                        if (clusters[mapID][clusterIndex[mapID]].classification.length==0) {
                            // Finished - submit
                            classificationCheckData['cluster_id'] = clusters[mapID][clusterIndex[mapID]].id
                            var formData = new FormData()
                            formData.append("data", JSON.stringify(classificationCheckData))
        
                            var xhttp = new XMLHttpRequest();
                            xhttp.onreadystatechange =
                            function(wrapClusterIndex,wrapMapID){
                                return function() {
                                    if (this.readyState == 4 && this.status == 278) {
                                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                                    } else if (this.readyState == 4 && this.status == 200) {                    
                                        response = JSON.parse(this.responseText);
                                        clusters[wrapMapID][wrapClusterIndex].classification = response.classifications
                                        clusters[wrapMapID][wrapClusterIndex].label = response.labels
                                        clusters[wrapMapID][wrapClusterIndex].label_ids = response.label_ids
                                        clusters[wrapMapID][wrapClusterIndex].ready = true
                                        updateProgBar(response.progress)
                                    }
                                }
                            }(clusterIndex[mapID],mapID);
                            xhttp.open("POST", '/reviewClassification');
                            clusters[mapID][clusterIndex[mapID]].ready = false
                            xhttp.send(formData);
        
                            classificationCheckData = {'overwrite':false,'data':[]}
                            nextCluster(mapID)
                        } else {
                            updateDebugInfo()
                        }
                    }
                }
            

            // } else if (taggingLevel=='-6') {    
            //     // Not in use
            //     // Review Mask
            //     if (label == 'accept_mask') {
            //         // accept
            //         maskCheckData['mask'] = 'accept'

            //         maskCheckData['cluster_id'] = clusters[mapID][clusterIndex[mapID]].id
            //         maskCheckData['image_ids'] = []
            //         maskCheckData['detection_ids'] = []
            //         for (let i=0;i<clusters[mapID][clusterIndex[mapID]].images.length;i++) {
            //             maskCheckData['image_ids'].push(clusters[mapID][clusterIndex[mapID]].images[i].id)
            //             for (let j=0;j<clusters[mapID][clusterIndex[mapID]].images[i].detections.length;j++) {
            //                 maskCheckData['detection_ids'].push(clusters[mapID][clusterIndex[mapID]].images[i].detections[j].id)
            //             }
            //         }
    
            //         var formData = new FormData()
            //         formData.append("data", JSON.stringify(maskCheckData))
    
            //         var xhttp = new XMLHttpRequest();
            //         xhttp.onreadystatechange =
            //         function(wrapClusterIndex,wrapMapID){
            //             return function() {
            //                 if (this.readyState == 4 && this.status == 278) {
            //                     window.location.replace(JSON.parse(this.responseText)['redirect'])
            //                 } else if (this.readyState == 4 && this.status == 200) {                    
            //                     response = JSON.parse(this.responseText);
            //                     clusters[wrapMapID][wrapClusterIndex].ready = true
            //                     updateProgBar(response.progress)
            //                 }
            //             }
            //         }(clusterIndex[mapID],mapID);
            //         xhttp.open("POST", '/reviewMask');
            //         clusters[mapID][clusterIndex[mapID]].ready = false
            //         xhttp.send(formData);
    
            //         maskCheckData = {}
            //         nextCluster(mapID)


            //     } else if (label == 'reject_mask') {
            //         // reject
            //         // maskCheckData['mask'] = 'reject'

            //         if (divBtns != null) {
            //             orginal_labels = clusters[mapID][clusterIndex[mapID]][ITEMS]
            //             orginal_label_ids = clusters[mapID][clusterIndex[mapID]][ITEM_IDS]
            //             // clusters[mapID][clusterIndex[mapID]][ITEMS] = ['None']
            //             // clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = ['0']
            //             // clusterLabels[mapID] = []
            //             updateDebugInfo(mapID,false)

            //             selectBtns = document.getElementById('selectBtns')
            //             // multipleStatus = false
            //             wrongStatus = true
            //             tempTaggingLevel = '-1'
            //             taggingLevel = '-1'

            //             while(divBtns.firstChild){
            //                 divBtns.removeChild(divBtns.firstChild);
            //             }

            //             var newbtn = document.createElement('button');
            //             newbtn.classList.add('btn');
            //             newbtn.classList.add('btn-danger');
            //             newbtn.innerHTML = 'Back';
            //             newbtn.setAttribute("id", 0);
            //             newbtn.classList.add('btn-block');
            //             newbtn.classList.add('btn-sm');
            //             newbtn.setAttribute("style", "margin-top: 3px; margin-bottom: 3px");
            //             newbtn.addEventListener('click', (evt)=>{
            //                 suggestionBack();
            //             });
            //             selectBtns.appendChild(newbtn);

            //             // populateLevels()
            //             initKeys(globalKeys['-1'])

            //             activateMultiple()
            //         }

            //     }

                    
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
                    } else if (label==maskLabel) {
                        maskArea(mapID)
                    } else if (label=='cancel_mask') {
                        cancelMask(mapID)
                    } else if (label=='submit_mask') {
                        modalMaskArea.modal({keyboard: true}) 
                    } else {
                        var checkVar = 0
                        if ((!taggingLevel.includes('-2'))&&((label==unknownLabel)||(label==nothingLabel)||(label==RFDLabel)||clusters[mapID][clusterIndex[mapID]].required.length>1)) {
                            if ((reachedEnd == false)&&(clusters[mapID][clusterIndex[mapID]].required.length>1)) {
                                text = 'This cluster may contain more species, please cycle through all images before tagging it.'
                                document.getElementById('modalAlertText').innerHTML = text
                                modalAlert.modal({keyboard: true});
                                checkVar = 1
                            }
                        }
            
                        if (checkVar==0) {
                            console.log(label)
                            idx = hotkeys.indexOf(label)
    
                            if (idx > -1) {
    
                                if (wrongStatus) {
                                    for (let key in globalKeys) {
                                        for (let i=0;i<globalKeys[key][0].length;i++) {
                                            if (globalKeys[key][0][i]==label) {
                                                labelName = globalKeys[key][1][i]
                                                break
                                            }
                                        }
                                    }
                                } else {
                                    labelName = names[idx]
                                }
    
                                if (clusters[mapID][clusterIndex[mapID]][ITEMS].includes(labelName)) {
            
                                    var btn = document.getElementById(label);
                                    if (idx == 0) {
                                        btn.setAttribute("class", "btn btn-danger btn-block btn-sm");
                                    } else if (idx < 10) {
                                        btn.setAttribute("class", "btn btn-primary btn-block btn-sm");
                                    } else {
                                        btn.setAttribute("class", "btn btn-info btn-block btn-sm");
                                    }
                                    
                                    index = clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(labelName)
                                    if (index>-1) {
                                        clusters[mapID][clusterIndex[mapID]][ITEMS].splice(index, 1);
                                    }
                                    
                                    index=clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(label)
                                    if (index>-1) {
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(index, 1);
                                    }
                                    
                                    if (clusters[mapID][clusterIndex[mapID]][ITEMS].length == 0) {
                                        clusters[mapID][clusterIndex[mapID]][ITEMS] = ['None']
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = ['0']
                                    }
                                    if (isClassCheck) {
                                        updateDebugInfo(mapID,false)
                                    } else {
                                        updateDebugInfo(mapID)
                                    }
    
                                    index = clusterLabels[mapID].indexOf(parseInt(label))
                                    if (index>-1){
                                        clusterLabels[mapID].splice(index, 1)
                                    }
                                    
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
                                            index = clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(taggingLabel)
                                            if (index>-1) {
                                                clusters[mapID][clusterIndex[mapID]][ITEMS].splice(index, 1);
                                            }
                                            
                                            index = clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(taggingLevel)
                                            if (index>-1) {
                                                clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(index, 1);
                                            }
                                            
                                        }
                                        clusters[mapID][clusterIndex[mapID]][ITEMS].push(labelName);
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].push(label);
                                        clusterLabels[mapID].push(parseInt(label))
        
                                    } else {
    
                                        if (isReviewing) {
                                            clusters[mapID][clusterIndex[mapID]][ITEMS] = []
                                            clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = []
                                            clusterLabels[mapID] = []
                                        } else {
                                            // Clear other current-level labels
                                            for (let i=0;i<globalKeys[taggingLevel][0].length;i++) {
                                                label_id = globalKeys[taggingLevel][0][i].toString()
                                                if (clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(label_id)) {
                                                    label_name = globalKeys[taggingLevel][1][i]

                                                    index = clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(label_name)
                                                    if (index>-1) {
                                                        clusters[mapID][clusterIndex[mapID]][ITEMS].splice(index, 1);
                                                    }
                                                    
                                                    index = clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(label_id)
                                                    if (index>1) {
                                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(index, 1);
                                                    }
                                                    
                                                    index = clusterLabels[mapID].indexOf(parseInt(label_id))
                                                    if (index>-1) {
                                                        clusterLabels[mapID].splice(index, 1)
                                                    }
                                                }
                                            }
    
                                            // Clear other same-level labels in wrong mode
                                            if (wrongStatus) {
                                                for (let i=0;i<globalKeys[tempTaggingLevel][0].length;i++) {
                                                    label_id = globalKeys[tempTaggingLevel][0][i].toString()
                                                    if (clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(label_id)) {
                                                        label_name = globalKeys[tempTaggingLevel][1][i]

                                                        index = clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf(label_name)
                                                        if (index>-1) {
                                                            clusters[mapID][clusterIndex[mapID]][ITEMS].splice(index, 1);
                                                        }
                                                        
                                                        index = clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf(label_id)
                                                        if (index>-1) {
                                                            clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(index, 1);
                                                        }
                                                        
                                                        index = clusterLabels[mapID].indexOf(parseInt(label_id))
                                                        if (index>-1) {
                                                            clusterLabels[mapID].splice(index, 1)    
                                                        }
                                                    }
                                                }
                                            }
                                        }
    
                                        if (clusters[mapID][clusterIndex[mapID]][ITEMS].includes('None')) {
                                            index = clusters[mapID][clusterIndex[mapID]][ITEMS].indexOf('None')
                                            if (index>-1) {
                                                clusters[mapID][clusterIndex[mapID]][ITEMS].splice(index, 1);
                                            }
                                            
                                            index = clusters[mapID][clusterIndex[mapID]][ITEM_IDS].indexOf('0')
                                            if (index>-1) {
                                                clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(index, 1);
                                            }
                                        }
                                        clusters[mapID][clusterIndex[mapID]][ITEMS].push(labelName);
                                        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].push(label);
                                        clusterLabels[mapID].push(parseInt(label))
    
                                        // clusters[mapID][clusterIndex[mapID]][ITEMS] = [labelName]
                                        // clusters[mapID][clusterIndex[mapID]][ITEM_IDS] = [label]
                                        // clusterLabels[mapID] = [parseInt(label)]
    
                                        if (unknocked) {
                                            clusters[mapID][clusterIndex[mapID]][ITEMS].push(unKnockLabel)
                                        }
                                    }
                                    if (isClassCheck) {
                                        updateDebugInfo(mapID,false)
                                    } else {
                                        updateDebugInfo(mapID)
                                    }
                                    
                                    // if (wrongStatus&&!isClassCheck&&!dontResetWrong&&!isMaskCheck) {
                                    if (wrongStatus&&!isClassCheck&&!dontResetWrong) {
                                        wrongStatus = false
                                        tempTaggingLevel = taggingLevel
                                        initKeys(globalKeys[taggingLevel])
                                    } else if (dontResetWrong) {
                                        tempTaggingLevel = taggingLevel
                                        initKeys(globalKeys[taggingLevel])
                                    }
                                    
                                    if ((!isTutorial)&&(!multipleStatus)) {
                                        submitLabels(mapID)
                                    }
        
                                    if (!multipleStatus) {
                                        // if (isClassCheck||isMaskCheck) {
                                        if (isClassCheck) {
                                            wrongStatus = false
                                            suggestionBack(false)
                                        }
                                        if (!clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(RFDLabel.toString()) || isTutorial) {
                                            // nothings need to wait to see if they are edited first
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
            taggingAlgorithm = taggingInfo.taggingAlgorithm

            if (taggingInfo.wrongStatus=='true') {
                wrongStatus = true
                dontResetWrong = true
                tempTaggingLevel = taggingLevel
            }

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
            if ((taggingLevel == '-3')||(taggingLevel == '-8')) {
                isClassCheck = true
                classCheckOriginalLevel = taggingLevel
            }

            // if (taggingLevel == '-6'){
            //     isMaskCheck = true
            // }

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
        } else if (isTimestampCheck){
            document.getElementById('progressText').innerHTML = prog[0] + " of "+prog[1] + " timestamps completed."
        } else if (isStaticCheck){
            document.getElementById('progressText').innerHTML = prog[0] + " of "+prog[1] + " static detection groups completed."
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
    /** Initialises the Leaflet map for displaying images or videos(in explore). */
    if (clusters[mapID][clusterIndex[mapID]].id=='-101') {
        window.location.replace("done")
    } else if ((clusters[mapID][clusterIndex[mapID]].id=='-99')||(clusters[mapID][clusterIndex[mapID]].id=='-782')) {
        nextCluster(mapID)
    } else {
        if (bucketName != null) {
            mapReady[mapID] = false            
            var isImage = checkImage(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url)

            if (!isImage) {
                videoURL ="https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url)
                vid = document.createElement('video')
                vid.setAttribute('controls',true)
                vid.setAttribute('width', 500);

                // Video must be in mp4/webm format to be displayed 
                sourceMP4 = document.createElement('source')
                sourceMP4.setAttribute('src',videoURL)
                sourceMP4.setAttribute('type','video/mp4')  

                vid.appendChild(sourceMP4) 

                vid.addEventListener('loadedmetadata', function() {
                    // Video metadata has been loaded
                    var w = vid.videoWidth
                    var h = vid.videoHeight
    
                    if (w>h) {
                        if (mapdiv2 != null) {
                            document.getElementById(mapDivs[mapID]).setAttribute('style','height: calc(36vw *'+(h/w)+');  width:36vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                        }
                        else{
                            document.getElementById(mapDivs[mapID]).setAttribute('style','height: calc(50vw *'+(h/w)+');  width:50vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                        }
                    } else {
                        if (mapdiv2 != null) {
                            document.getElementById(mapDivs[mapID]).setAttribute('style','height: calc(36vw *'+(w/h)+');  width:36vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                        }
                        else{
                            document.getElementById(mapDivs[mapID]).setAttribute('style','height: calc(50vw *'+(w/h)+');  width:50vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                        }
                    }

                    map[mapID] = L.map(mapDivs[mapID], {
                        crs: L.CRS.Simple,
                        maxZoom: 10,
                        center: [0, 0],
                        zoomSnap: 0
                    })
                    var h1 = document.getElementById(mapDivs[mapID]).clientHeight
                    var w1 = document.getElementById(mapDivs[mapID]).clientWidth
                    var southWest = map[mapID].unproject([0, h1], 2);
                    var northEast = map[mapID].unproject([w1, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);
    
                    mapWidth[mapID] = northEast.lng
                    mapHeight[mapID] = southWest.lat
    
                    activeImage[mapID] = L.videoOverlay(videoURL, bounds, {
                        opacity: 1,
                        autoplay: false,
                        loop: false
                    }).addTo(map[mapID]);
    
                    activeImage[mapID].on('load', function () {

                        while(map[mapID]._controlCorners['topright'].firstChild){
                            map[mapID]._controlCorners['topright'].removeChild(map[mapID]._controlCorners['topright'].firstChild);
                        }

                        var MyPauseControl = L.Control.extend({
                            onAdd: function() {
                                var button = L.DomUtil.create('button');
                                button.innerHTML = '⏸';
                                L.DomEvent.on(button, 'click', function () {
                                    activeImage[mapID].getElement().pause();
                                });
                                return button;
                            }
                        });
                        var MyPlayControl = L.Control.extend({
                            onAdd: function() {
                                var button = L.DomUtil.create('button');
                                button.innerHTML = '⏵';
                                L.DomEvent.on(button, 'click', function () {
                                    activeImage[mapID].getElement().play();
                                });
                                return button;
                            }
                        });
                        
                        playControl[mapID] = (new MyPlayControl()).addTo(map[mapID]);
                        pauseControl[mapID] = (new MyPauseControl()).addTo(map[mapID]);
                        
                        finishedDisplaying[mapID] = true
                    });

                    activeImage[mapID].on('error', function () {
                        finishedDisplaying[mapID] = true
                    });
                    
                    map[mapID].setMaxBounds(bounds);
                    map[mapID].fitBounds(bounds);
                    map[mapID].setMinZoom(map[mapID].getZoom())

                    map[mapID].on('resize', function(wrapMapID){
                        return function () {
                            var h1 = document.getElementById(mapDivs[wrapMapID]).clientHeight
                            var w1 = document.getElementById(mapDivs[wrapMapID]).clientWidth

                            var southWest = map[wrapMapID].unproject([0, h1], 2);
                            var northEast = map[wrapMapID].unproject([w1, 0], 2);
                            var bounds = new L.LatLngBounds(southWest, northEast);

                            mapWidth[wrapMapID] = northEast.lng
                            mapHeight[wrapMapID] = southWest.lat

                            map[wrapMapID].invalidateSize()
                            map[wrapMapID].setMaxBounds(bounds)
                            map[wrapMapID].fitBounds(bounds)
                            map[wrapMapID].setMinZoom(map[wrapMapID].getZoom())
                            activeImage[wrapMapID].setBounds(bounds)

                            var isImg = checkImage(activeImage[wrapMapID]._url)
                            if (isImg) {
                                addedDetections[wrapMapID] = false
                                addDetections(wrapMapID)    
                            }
                        }
                    }(mapID))

                    map[mapID].on('drag', function(wrapMapID) {
                        return function () {
                            map[wrapMapID].panInsideBounds(bounds, { animate: false });
                        }
                    }(mapID));

                    map[mapID].on('zoomstart', function(wrapMapID) {
                        return function () { 
                            if ((!fullRes[wrapMapID])&&(!['-101','-99','-782'].includes(clusters[wrapMapID][clusterIndex[wrapMapID]].id))) {
                                var isImg = checkImage(clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].url)
                                if (isImg) {
                                    activeImage[wrapMapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + clusters[wrapMapID][clusterIndex[wrapMapID]].images[imageIndex[wrapMapID]].url)
                                    fullRes[wrapMapID] = true
                                }
                            }
                        }
                    }(mapID));

                    mapReady[mapID] = true
                    updateCanvas(mapID)

                });                   
            }
            else{    
                imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].url)
                var img = new Image();
                img.onload = function(wrapMapID){
                    return function() {
                        w = this.width
                        h = this.height
                    
                        if (w>h) {
                            if (mapID=='known'){
                                document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height: calc(32vw *'+(h/w)+');  width:32vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                            }
                            else if (mapdiv2 != null) {
                                document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height: calc(36vw *'+(h/w)+');  width:36vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                            }
                            else{
                                document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height: calc(50vw *'+(h/w)+');  width:50vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                            }
                        } else {
                            if (mapID=='known'){
                                document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height: calc(32vw *'+(w/h)+');  width:32vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')

                            } else if (mapdiv2 != null) {
                                document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height: calc(36vw *'+(w/h)+');  width:36vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                            }
                            else{
                                document.getElementById(mapDivs[wrapMapID]).setAttribute('style','height: calc(50vw *'+(w/h)+');  width:50vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
                            }
                        }

                        L.Browser.touch = true

                        var mapAttributes = {
                            crs: L.CRS.Simple,
                            maxZoom: 10,
                            center: [0, 0],
                            zoomSnap: 0
                        }
                        
                        if (isTimestampCheck) {
                            mapAttributes.attributionControl = false // Remove Leaflet attribution (because it might block the timestamp)
                        }
                
                        map[wrapMapID] = new L.map(mapDivs[wrapMapID], mapAttributes)

                        var h1 = document.getElementById(mapDivs[wrapMapID]).clientHeight
                        var w1 = document.getElementById(mapDivs[wrapMapID]).clientWidth

                        var southWest = map[wrapMapID].unproject([0, h1], 2);
                        var northEast = map[wrapMapID].unproject([w1, 0], 2);
                        var bounds = new L.LatLngBounds(southWest, northEast);
                
                        mapWidth[wrapMapID] = northEast.lng
                        mapHeight[wrapMapID] = southWest.lat

                        map[wrapMapID].setMaxBounds(bounds);
                        map[wrapMapID].fitBounds(bounds)
                        map[wrapMapID].setMinZoom(map[wrapMapID].getZoom())
                
                        activeImage[wrapMapID] = L.imageOverlay(imageUrl, bounds).addTo(map[wrapMapID]);
                        activeImage[wrapMapID].on('load', function(wrapWrapMapID) {
                            return function () {
                                addDetections(wrapWrapMapID)
                            }
                        }(wrapMapID));

                        activeImage[wrapMapID].on('error', function(wrapWrapMapID) {
                            return function () {
                                if (this._url.includes('-comp')) {
                                    // If image already compressed, then it is likely that the image is not available   
                                    finishedDisplaying[wrapWrapMapID] = true
                                }
                                else{
                                    // If raw image not available, then try loading the compressed version
                                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(clusters[wrapWrapMapID][clusterIndex[wrapWrapMapID]].images[imageIndex[wrapWrapMapID]].url))
                                }
                            }
                        }(wrapMapID));

                        map[wrapMapID].on('resize', function(wrapWrapMapID){
                            return function () {
                                var h1 = document.getElementById(mapDivs[wrapMapID]).clientHeight
                                var w1 = document.getElementById(mapDivs[wrapMapID]).clientWidth
        
                                var southWest = map[wrapMapID].unproject([0, h1], 2);
                                var northEast = map[wrapMapID].unproject([w1, 0], 2);
                                var bounds = new L.LatLngBounds(southWest, northEast);
                        
                                mapWidth[wrapWrapMapID] = northEast.lng
                                mapHeight[wrapWrapMapID] = southWest.lat

                                map[wrapWrapMapID].invalidateSize()
                                map[wrapWrapMapID].setMaxBounds(bounds)
                                map[wrapWrapMapID].fitBounds(bounds)
                                map[wrapWrapMapID].setMinZoom(map[wrapWrapMapID].getMinZoom())
                                activeImage[wrapWrapMapID].setBounds(bounds)

                                var isImg = checkImage(activeImage[wrapWrapMapID]._url)
                                if (isImg) {
                                    addedDetections[wrapWrapMapID] = false
                                    addDetections(wrapWrapMapID)    
                                }
                                if (isIDing && (document.getElementById('btnSendToBack')==null)) {
                                    if (document.getElementById('cxFeaturesHeatmap').checked){
                                        var detID1 = clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']].detections[0].id
                                        var detID2 = clusters['map2'][clusterIndex['map2']].images[imageIndex['map2']].detections[0].id
                                        getMatchingKpts(detID1,detID2)
                                    }
                                }
                            }
                        }(wrapMapID));


                        map[wrapMapID].on('drag', function(wrapWrapMapID) {
                            return function () {
                                map[wrapWrapMapID].panInsideBounds(bounds, { animate: false });
                            }
                        }(wrapMapID));
                
                        drawnItems[wrapMapID] = new L.FeatureGroup();
                        map[wrapMapID].addLayer(drawnItems[wrapMapID]);

                        drawnMaskItems[wrapMapID] = new L.FeatureGroup();
                        map[wrapMapID].addLayer(drawnMaskItems[wrapMapID]);
                
                        map[wrapMapID].on('zoomstart', function(wrapWrapMapID) {
                            return function () { 
                                if ((!fullRes[wrapWrapMapID])&&(!['-101','-99','-782'].includes(clusters[wrapWrapMapID][clusterIndex[wrapWrapMapID]].id))) {
                                    var isImg = checkImage(clusters[wrapWrapMapID][clusterIndex[wrapWrapMapID]].images[imageIndex[wrapWrapMapID]].url)
                                    if (isImg) {
                                        activeImage[wrapWrapMapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + clusters[wrapWrapMapID][clusterIndex[wrapWrapMapID]].images[imageIndex[wrapWrapMapID]].url)
                                        fullRes[wrapWrapMapID] = true
                                    }
                                }
                            }
                        }(wrapMapID));
                
                        if (isBounding) {
                            fetchLabelHierarchy()
                            setRectOptions()
                            sightingAnalysisMapPrep()
                        } else if (isIDing && (document.getElementById('btnSendToBack')==null) && mapID != 'known') {
                            setRectOptions()
                            IDMapPrep(wrapMapID)
                        } else if (isIDing && (document.getElementById('btnSendToBack')!=null) && mapID != 'known') {
                            setClusterIDRectOptions()
                            clusterIDMapPrep(wrapMapID)
                        } else {
                            rectOptions = {
                                color: "rgba(223,105,26,1)",
                                fill: true,
                                fillOpacity: 0.0,
                                opacity: 0.8,
                                weight:3,
                                contextmenu: false,
                            }      
                            
                            if (isTagging && !isTutorial && (taggingLevel == '-1' || parseInt(taggingLevel) > 0)) {
                                maskRectOptions = {
                                    color: "rgba(91,192,222,1)",
                                    fill: true,
                                    fillOpacity: 0.0,
                                    opacity: 0.8,
                                    weight:3,
                                    contextmenu: false,
                                }

                                taggingMapPrep(wrapMapID)

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
}

function updateMap(mapID = 'map1', url){
    /** Updates the map displayed depending if the source is a video or image. */

    if (isReviewing){

        mapReady[mapID] = false
        var isImage = checkImage(url)
        map[mapID].removeLayer(activeImage[mapID])
        if (drawnItems[mapID] != null) {
            map[mapID].removeLayer(drawnItems[mapID])
        }
        if (pauseControl[mapID] != null && playControl[mapID] != null) {
            pauseControl[mapID].remove()
            playControl[mapID].remove()
        }

        if (isImage){
            imageUrl = url
            var img = new Image();
            img.onload = function(wrapMapID){
                return function() {
                    w = this.width
                    h = this.height              

                    document.getElementById(mapDivs[wrapMapID]).style.height = 'calc(50vw *'+(h/w)+')'
                    document.getElementById(mapDivs[wrapMapID]).style.width = '50vw'  

                    var h1 = document.getElementById(mapDivs[wrapMapID]).clientHeight
                    var w1 = document.getElementById(mapDivs[wrapMapID]).clientWidth

                    var southWest = map[wrapMapID].unproject([0, h1], 2);
                    var northEast = map[wrapMapID].unproject([w1, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);
            
                    mapWidth[wrapMapID] = northEast.lng
                    mapHeight[wrapMapID] = southWest.lat
            
                    activeImage[wrapMapID] = L.imageOverlay(imageUrl, bounds).addTo(map[wrapMapID]);
                    activeImage[wrapMapID].on('load', function(wrapWrapMapID) {
                        return function () {
                            addDetections(wrapWrapMapID)
                        }
                    }(wrapMapID));

                    drawnItems[wrapMapID] = new L.FeatureGroup();
                    map[wrapMapID].addLayer(drawnItems[wrapMapID]);
                    
                    rectOptions = {
                        color: "rgba(223,105,26,1)",
                        fill: true,
                        fillOpacity: 0.0,
                        opacity: 0.8,
                        weight:3,
                        contextmenu: false,
                    }    
                    
                    mapReady[mapID] = true
                    updateCanvas(mapID)       
                }
            }(mapID);
            img.src = imageUrl

        } else {
            videoURL = url
            vid = document.createElement('video')
            vid.setAttribute('controls',true)
            vid.setAttribute('width', 500);

            sourceMP4 = document.createElement('source')
            sourceMP4.setAttribute('src',videoURL)
            sourceMP4.setAttribute('type','video/mp4')  

            vid.appendChild(sourceMP4) 

            vid.addEventListener('loadedmetadata', function() {
                var w = vid.videoWidth
                var h = vid.videoHeight

                document.getElementById(mapDivs[mapID]).style.height = 'calc(50vw *'+(h/w)+')'
                document.getElementById(mapDivs[mapID]).style.width = '50vw'  

                var h1 = document.getElementById(mapDivs[mapID]).clientHeight
                var w1 = document.getElementById(mapDivs[mapID]).clientWidth
                var southWest = map[mapID].unproject([0, h1], 2);
                var northEast = map[mapID].unproject([w1, 0], 2);
                var bounds = new L.LatLngBounds(southWest, northEast);
    
                mapWidth[mapID] = northEast.lng
                mapHeight[mapID] = southWest.lat
    
                activeImage[mapID] = L.videoOverlay(videoURL, bounds, {
                    opacity: 1,
                    autoplay: false,
                    loop: false
                }).addTo(map[mapID]);
                

                activeImage[mapID].on('load', function () {
                    while(map[mapID]._controlCorners['topright'].firstChild){
                        map[mapID]._controlCorners['topright'].removeChild(map[mapID]._controlCorners['topright'].firstChild);
                    }

                    var MyPauseControl = L.Control.extend({
                        onAdd: function() {
                            var button = L.DomUtil.create('button');
                            button.innerHTML = '⏸';
                            L.DomEvent.on(button, 'click', function () {
                                activeImage[mapID].getElement().pause();
                            });
                            return button;
                        }
                    });
                    var MyPlayControl = L.Control.extend({
                        onAdd: function() {
                            var button = L.DomUtil.create('button');
                            button.innerHTML = '⏵';
                            L.DomEvent.on(button, 'click', function () {
                                activeImage[mapID].getElement().play();
                            });
                            return button;
                        }
                    });
                    
                    playControl[mapID] = (new MyPlayControl()).addTo(map[mapID]);
                    pauseControl[mapID] = (new MyPauseControl()).addTo(map[mapID]);
                    
                    finishedDisplaying[mapID] = true
                });          

                mapReady[mapID] = true
                updateCanvas(mapID)

            });                   
        }
    }
}

function pingServer() {
    /** Pings the server to let it know that the user is still active. */
    if (!isTutorial) {
        if ((activity||modalWait.is(':visible')||modalWait2.is(':visible'))&&(!waitingForClusters['map1'])) {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                }
                else if (this.readyState == 4 && this.status == 200) {
                    setTimeout(function() { pingServer(); }, 30000);
                }
            }
            xhttp.open("POST", '/ping');
            xhttp.send();
        } else {
            setTimeout(function() { pingServer(); }, 30000);
        }
        activity = false
    }
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
    if (!isViewing) {
        pingServer()
    }

    if (isTutorial) {
        modalWelcome.modal({backdrop: 'static', keyboard: false});
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

    if (isViewing) {
        clusters['map1'] = sentClusters
        update()
    }

    if (isTagging||isBounding) {
        emptyCount = 0
        if (isIDing && (document.getElementById('btnSendToBack')==null)) {
            loadNewCluster()
        } else {
            for (let i=0;i<1;i++){
                loadNewCluster()
            }
        }
    }

    if (isStaticCheck) {
        selectedSurvey = /survey=([^&]+)/.exec(document.location.href)[1]
        clusters['map1'] = []
        clusterIndex['map1'] = 0
        imageIndex['map1'] = 0
        detectionGroups = {}
        // loadNewCluster()
        getStaticGroupIDs()
    }

    if (isTimestampCheck) {
        selectedSurvey = /survey=([^&]+)/.exec(document.location.href)[1]
        clusters['map1'] = []
        clusterIndex['map1'] = 0
        imageIndex['map1'] = 0
        getCameraIDs()
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
    
    if (labelIndex>-1) {
        clusters[mapID][clusterIndex[mapID]][ITEMS].splice(labelIndex, 1);
        clusters[mapID][clusterIndex[mapID]][ITEM_IDS].splice(labelIndex, 1);
    }

    index = clusterLabels[mapID].indexOf(parseInt(label_id))
    if (index>-1) {
        clusterLabels[mapID].splice(index, 1)
    }

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
    
    
        if ((((modalActive == false) && (modalActive2 == false)) || (taggingLevel.includes('-2'))) && (allow==true) && (taggingLevel!='-3') && (taggingLevel!='-8') && (clusters[mapID][clusterIndex[mapID]].id != '-99') && (clusters[mapID][clusterIndex[mapID]].id != '-101') && (clusters[mapID][clusterIndex[mapID]].id != '-782')) {
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

                    // remove skip
                    // if (dontResetWrong&&(skipName==null)) {
                    //     idx = names.indexOf('Skip')
                    //     if (idx > -1) {
                    //         var btn = document.getElementById(hotkeys[idx]);
                    //         if (btn) {
                    //             btn.remove()
                    //         }
                    //     }
                    // }
        
                    if (taggingLevel.includes('-2')) {
                        for (let i=0;i<clusters[mapID][clusterIndex[mapID]].tags.length;i++){
                            idx = names.indexOf(clusters[mapID][clusterIndex[mapID]].tags[i])
                            if (idx > -1) {
                                var btn = document.getElementById(hotkeys[idx]);
                                btn.setAttribute("class", "btn btn-success btn-block btn-sm");               
                            }
                        }
                    } else {
                        for (let i=0;i<clusters[mapID][clusterIndex[mapID]][ITEMS].length;i++){
                            name = clusters[mapID][clusterIndex[mapID]][ITEMS][i]
                            if (name==skipName) {
                                name = 'Skip'
                            }
                            idx = names.indexOf(name)
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

                if (wrongStatus) {
                    tempTaggingLevel = taggingLevel
                    initKeys(globalKeys[taggingLevel])
                } else {
                    getKeys()
                }
    
                if (!taggingLevel.includes('-2') && clusters[mapID][clusterIndex[mapID]][ITEMS].includes(taggingLabel) && !clusters[mapID][clusterIndex[mapID]][ITEMS].includes('Skip')) {
                    // nothing
                } else if ((taggingLevel.includes('-2')) || ((clusters[mapID][clusterIndex[mapID]][ITEMS].length > 0) && (!clusters[mapID][clusterIndex[mapID]][ITEMS].includes('None')))) {
                    submitLabels(mapID)
                    // if (isClassCheck||isMaskCheck) {
                    if (isClassCheck) {
                        wrongStatus = false
                        suggestionBack(false)
                    }
                    if (!clusters[mapID][clusterIndex[mapID]][ITEM_IDS].includes(RFDLabel.toString())) {
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
    if (!isTutorial) {
        var formData = new FormData()
        formData.append("labels", JSON.stringify(clusterLabels[mapID]))
        if (taggingLevel.includes('-2') && isReviewing) {
            formData.append("taggingLevel", '-2')
        }
        console.log(clusterLabels[mapID])
        nothingStatus = false
        if (clusterLabels[mapID].includes(parseInt(RFDLabel)) && isTagging) {
            // reallocate on nothing
            nothingStatus = true
            if ((!modalWait2.is(':visible'))&&(!modalWait.is(':visible'))) {
                waitModalID = clusters[mapID][clusterIndex[mapID]]
                waitModalMap = mapID
                modalWait2Hide = false
                modalWait2.modal({backdrop: 'static', keyboard: false});
            }
        }
        clusterID = clusters[mapID][clusterIndex[mapID]].id
        url = '/assignLabel/'+clusterID
        var xhttp = new XMLHttpRequest();
        if (isReviewing) {
            url += '?explore=true'
            xhttp.onreadystatechange = function(wrapMapID,wrapIndex) {
                return function() {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);
                        if (reply!='error') {
                            if (wrapIndex>-1) {
                                clusters[wrapMapID][wrapIndex].annotator = reply.username
                                if (reply.individual_check) {
                                    clusters[wrapMapID].splice(wrapIndex,1)
                                    clusterIndex[wrapMapID] -= 1
                                }
                            }
                            updateDebugInfo()
                        }
                    }
                }
            }(mapID,clusterIndex[mapID])
        } else if (isTagging) { 
            xhttp.onreadystatechange = function(wrapNothingStatus,wrapMapID,wrapIndex) {
                return function() {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);
                        if (reply!='error') {
                            if (isReviewing) {
                                clusters[wrapMapID][wrapIndex].annotator = reply.username
                                updateDebugInfo()
                            }
                            if (wrapNothingStatus) {
                                if (reply.reAllocated==true) {
                                    clusterRequests[wrapMapID] = [];
                                    clusters[wrapMapID] = clusters[wrapMapID].slice(0,clusterIndex[wrapMapID]+1);
                                    clusters[wrapMapID].push(...reply.newClusters)
                                    clusterIdList = []
                                }
                                if (modalWait2.is(':visible')) {
                                    modalWait2Hide = true
                                    modalWait2.modal('hide');
                                }
                                nextCluster(wrapMapID)
                            }
                            if (isClassCheck) {
                                clusters[wrapMapID][wrapIndex].ready = true
                                clusters[wrapMapID][wrapIndex].classification = reply.classifications
                            }
                            // if (isMaskCheck) {
                            //     clusters[wrapMapID][wrapIndex].ready = true
                            // }
                            Progress = reply.progress
                            updateProgBar(Progress)
                        }
                    }
                }
            }(nothingStatus,mapID,clusterIndex[mapID])
        }
        xhttp.open("POST", url, true);
        if (isClassCheck) {
            wrongStatus = false
            clusters[mapID][clusterIndex[mapID]].ready = false
        }
        // if (isMaskCheck) {
        //     wrongStatus = false
        //     clusters[mapID][clusterIndex[mapID]].ready = false
        // }
        xhttp.send(formData);
        if (batchComplete&&nothingStatus) {
            redirectToDone()
        }
    }
}

function Notes() {
    /** Submits the users note to the server if there is one, otherwise just closes the modal. */
    if (modalNote.is(':visible')) {
        sendNote()
    } else {
        document.getElementById("notebox").value = ''
        modalNote.modal({keyboard: true});
    }
}

function sendNote(mapID = 'map1') {
    /** Sends the note to the server. */
    note = document.getElementById("notebox").value
    
    if (note.length > 512) {
        document.getElementById('notif').innerHTML = "A note cannot be more than 512 characters."
    } else {

        if (note != "") {
            clusterID=clusters[mapID][clusterIndex[mapID]].id
            var formData = new FormData()
            formData.append('cluster_id', JSON.stringify(clusterID))
            formData.append('note', JSON.stringify((note)))
            formData.append('type', JSON.stringify('cluster'))
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                }
            }
            xhttp.open("POST", '/assignNote', true);
            xhttp.send(formData);
        }
    
        modalNote.modal('hide');
    }
}

function exploreNotes(mapID='map1'){
    /** Initialises the notes in explore page */
    document.getElementById('notif').innerHTML = ""
    noteTextBox = document.getElementById('noteboxExp')
    noteSearchTextBox = document.getElementById('noteboxExpSearch')
    noteTextBox.value = clusters[mapID][clusterIndex[mapID]].notes

    noteTextBox.blur()
    noteSearchTextBox.blur()
    isNoteActive = false
}

function sendNoteExplore(mapID = 'map1') {
    /** Sends the note to the server submitted from the explore page. */
    var note = document.getElementById("noteboxExp").value
    var noteIndex = clusterIndex[mapID]

    if (note != clusters[mapID][clusterIndex[mapID]].notes) {
        clusterID=clusters[mapID][clusterIndex[mapID]].id
        var formData = new FormData()
        formData.append('cluster_id', JSON.stringify(clusterID))
        formData.append('note', JSON.stringify((note)))
        formData.append('type', JSON.stringify('cluster'))
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            }
            else if (this.readyState == 4 && this.status == 200)
            {   
                reply = JSON.parse(this.responseText);
                if (reply!='error') {
                    clusters[mapID][noteIndex].notes = note
                }
                else{
                    document.getElementById("noteboxExp").value = clusters[mapID][noteIndex].notes
                }
            }
        }
        xhttp.open("POST", '/assignNote', true);
        xhttp.send(formData);
    }
    noteTextBox.blur()
    isNoteActive = false
}

function initKeys(res){
    /** Initialises the buttons for the current task, using the input data. */
    if ((!isBounding) && (divBtns != null)) {
        skipName = null
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
        for (let i=0;i<labs.length;i++) {
            if (((names[i]=='Wrong')||(names[i]=='Skip')||(names[i]=='Remove False Detections')||(names[i]=='Mask Area'))&&(labs[i] != EMPTY_HOTKEY_ID)) {

                hotkeys[i] = labs[i].toString()
                labelName = names[i]

                if (names[i]=='Wrong') {
                    wrongLabel = labs[i]
                    if (wrongStatus) {
                        labelName = 'Back'
                    }
                } else if ((names[i]=='Skip')&&(wrongStatus)&&(tempTaggingLevel!='-1')) {
                    for (let key in globalKeys) {
                        for (let n=0;n<globalKeys[key][0].length;n++) {
                            if (globalKeys[key][0][n]==tempTaggingLevel) {
                                labelName = globalKeys[key][1][n]
                                hotkeys[i] = tempTaggingLevel.toString()
                                skipName = labelName
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
                // } else if (i == labs.length-2 && labelName == 'Remove False Detections') {
                //     newbtn.classList.add('btn-danger');
                //     newbtn.innerHTML = labelName + ' (-)';
                } else if (i == labs.length-3) {
                    newbtn.classList.add('btn-danger');
                    newbtn.innerHTML = labelName + ' (Space)';
                } else if (i == labs.length-1 && labelName == 'Mask Area') {
                    newbtn.classList.add('btn-danger');
                    newbtn.innerHTML = labelName + ' (-)';
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
        for (let i=0;i<labs.length;i++) {
            if (names[i]=='Unknown') {
                unknownLabel = labs[i]
            } else if (names[i]=='Nothing') {
                nothingLabel = labs[i]
            } else if (names[i]=='Remove False Detections') {
                RFDLabel = labs[i]
            } else if (names[i]=='Knocked Down') {
                downLabel = labs[i]
            } else if (names[i]=='Skip') {
                skipLabel = labs[i]
            } else if (names[i]=='Mask Area') {
                maskLabel = labs[i]
            }

            if ((names[i]!='Wrong')&&(names[i]!='Skip')&&(names[i]!='Remove False Detections')&&(names[i]!='Mask Area')) {
                hotkeys[i] = labs[i].toString()
                labelName = names[i]
    
                if (labs[i] != EMPTY_HOTKEY_ID) {
                    var newbtn = document.createElement('button');
                    newbtn.classList.add('btn');
                    if (i < 10) {
                        newbtn.classList.add('btn-primary');
                        newbtn.innerHTML = labelName + ' (' + String.fromCharCode(parseInt(i)+48) + ')';
                    // } else if (i == labs.length-2 && labelName == 'Remove False Detections') {
                    //     newbtn.classList.add('btn-info');
                    //     newbtn.innerHTML = labelName + ' (-)';
                    } else if (i == labs.length-3) {
                        newbtn.classList.add('btn-info');
                        newbtn.innerHTML = labelName + ' (Space)';
                    } else if (i == labs.length-1 && labelName == 'Mask Area') {
                        newbtn.classList.add('btn-info');
                        newbtn.innerHTML = labelName + ' (-)';
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
        if (!(((typeof modalNote != 'undefined') && (modalNote.is(':visible'))) || ((typeof modalNewIndividual != 'undefined')&&(modalNewIndividual.is(':visible'))) || (isNoteActive) || (isDateActive))) {
            event.preventDefault()
        }
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

    //Check if Ctrl is being held down
    if (event.ctrlKey) {
        ctrlHeld = true
        return;
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
        if (((typeof modalNote == 'undefined') || (!modalNote.is(':visible'))) && !isNoteActive && !isDateActive) {
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

                // case ('-'):assignLabel(hotkeys[37]) //RFD
                //     break;

                case ('-'):assignLabel(hotkeys[38])  //Mask Area
                    break;

                case 'control': 
                    if (!ctrlHeld){
                        activateMultiple()
                    }
                    break;
    
                case 'enter': if (isTagging){
                    Notes()
                }
                    break;
    
                case 'alt': nextCluster()
                    break;
                case '~':
                case '`':
                    prevCluster()
                    break;
    
                case 'arrowright': nextImage()
                    break;
                case 'arrowleft': prevImage()
                    break;
                case 'arrowup': 
                    if (taggingLevel=='-3'||taggingLevel=='-8') {
                        forwardImage()
                    }
                    break;
                case 'arrowdown':
                    if (taggingLevel=='-3'||taggingLevel=='-8') {
                        backImage()
                    }
                    break;
            }

        }
        else if(isNoteActive){
            switch (event.key.toLowerCase()){
                case 'alt': nextCluster()
                    break;
                case '~':
                case '`':
                    prevCluster()
                    break;

            }
        
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
            case '`':
            case '~':
                prevCluster()
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
            case 'b': sendBoundingBack()
                break;
        }
    } else if (isStaticCheck) {
        switch (event.key.toLowerCase()){
            case ('a'):handleStatic(1)
                break;
            case ('r'):handleStatic(0)
                break;
            case (' '): hideDetections(false)
                break;
            case 'arrowright': nextImage()
                break;
            case 'arrowleft': prevImage()
                break;
        }
    } else if (isTimestampCheck) {
        switch (event.key.toLowerCase()){
            case ('n'):submitTimestamp(true)
                break;
            case ('enter'): skipTimeUnit()
                break;
            case (' '): skipTimeUnit()
                break;
            case ('s'): skipCamera() 
                break;
            case '~': undoTimestamp()
                break;
            case '`': undoTimestamp()
                break;
            case ('c'): if (document.getElementById('btnClearTimestamp').hidden == false){
                clearInputs()
                break;
            }
        }
    } else {
        switch (event.key.toLowerCase()){
            case 'arrowright': nextImage()
                break;
            case 'arrowleft': prevImage()
                break;
        }
    }
    ctrlHeld = false
}

document.onkeydown = function(event){
    /** Sets up the hotkeys. */
    if (isTimestampCheck) {
        if (event.key.toLowerCase() == 'tab') {
            // Prevent default for tab has to be done on keydown
            event.preventDefault()
            skipTimeUnit()
        }
        else if (event.key.toLowerCase() == 'backspace') {
            // Only want to do this if the input is empty and the user is trying to go back (not after they've just deleted a character)
            if (document.activeElement.value == ''){
                event.preventDefault()
                skipTimeUnit(true)
            }
        }
    }
    else if(isStaticCheck){
        if (event.key.toLowerCase() == ' ') {
            event.preventDefault()
            hideDetections(true)
        }
    }
}


document.onclick = function (event){
    /** Closes the context menu on click when editing the bounding boxes, or whilst doing individual ID. */
    activity = true
    if (isBounding) {
        for (let mapID in map) {
            if (map[mapID].contextmenu.isVisible()) {
                map[mapID].contextmenu.hide()
                plusInProgress = false
                currentHierarchicalLevel = []
                map[mapID].contextmenu.removeAllItems()
            }
        }
    } else if (isIDing && (document.getElementById('btnSendToBack')==null)) {
        for (let mapID in map) {
            if (mapID == 'known'){
                continue
            }
            if (map[mapID].contextmenu.isVisible()) {
                map[mapID].contextmenu.hide()
            }
        }
    } else if (isIDing && (document.getElementById('btnSendToBack')!=null)) {
        for (let mapID in map) {
            if (mapID == 'known'){
                continue
            }
            if (map[mapID].contextmenu.isVisible()) {
                map[mapID].contextmenu.hide()
            }

            if (map[mapID]._popup!=undefined) {
                map[mapID].closePopup()
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
        if (isComparison) {
            PlsWaitCountDown = 40
        } else {
            window.location.replace("done")
            document.getElementById('PlsWaitCountDownDiv').innerHTML = "0"
        }
    } else {
        document.getElementById('PlsWaitCountDownDiv').innerHTML = PlsWaitCountDown
    }

    if ((xl == false)&&(isTagging ==false)&&(isReviewing ==false)&&(isKnockdown == false)&&(isStaticCheck == false)) {
        if (clusterIndex[mapID] >= clusterIDs.length) {
            if (modalWait2.is(':visible')) {
                modalWait2Hide = true
                modalWait2.modal('hide');
            }
        }
    } else {
        if ((clusters[mapID].length <= clusterIndex[mapID])&&(!idIndiv101)) {
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
            mapID = waitModalMap
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

function updateImageIndex(newIndex, mapID = 'map1') {
    /** Updates the image index and loads the new image. */
    if (finishedDisplaying[mapID] == true) {
        // Make an exception for finish looking at cluster modal
        allowBypass=false
        if (modalAlert.is(':visible')) {
            modalAlert.modal('hide');
            allowBypass=true
        }

        if (reachedEnd==false && clusters[mapID][clusterIndex[mapID]].required.length>1) {
            if (newIndex>(imageIndex[mapID]+1)) {
            // Canot skip required images 
                return;
            }
        }

        if (((modalActive == false) && (modalActive2 == false))||(allowBypass)) {
            if (imageIndex[mapID]<clusters[mapID][clusterIndex[mapID]].images.length){
                imageIndex[mapID] = newIndex
                update(mapID)
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
modalWelcome.on('hidden.bs.modal', function(){
    modalActive = false;
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
    PlsWaitCountDown = 40
    document.getElementById('PlsWaitCountDownDiv').innerHTML = PlsWaitCountDown
    timerWaitModal = setInterval(checkWaitModal, 1000);
});
modalWait2.on('hidden.bs.modal', function(){
    /** Additionally clear the redirect countdown. */
    modalActive2 = false;
    clearInterval(timerWaitModal);
    document.getElementById("modalWait2p").innerHTML = ''
});