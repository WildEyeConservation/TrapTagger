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

var polarColours = {'rgba(10,120,80,0.2)':false,
                    'rgba(255,255,255,0.2)':false,
                    'rgba(223,105,26,0.2)':false,
                    'rgba(196,26,26,0.2)':false,
                    'rgba(190,26,190,0.2)':false,
                    'rgba(70,130,180,0.2)':false,
                    'rgba(0,0,0,0.2)':false,
                    'rgba(234,209,26,0.2)':false,
                    'rgba(26,234,219,0.2)':false,
                    'rgba(124,234,26,0.2)':false,
                    'rgba(140,26,234,0.2)':false
                }

var barColours = {
    'rgba(67,115,98,0.4)': false,
    'rgba(89,228,170,0.4)': false,
    'rgba(97,167,152,0.4)': false,
    'rgba(57,159,113,0.4)': false,
    'rgba(35,108,144,0.4)': false,
    'rgba(20,48,55,0.4)': false,
    'rgba(61,105,121,0.4)': false,
    'rgba(104,38,137,0.4)': false,
    'rgba(88,63,124,0.4)': false,
    'rgba(78,46,176,0.4)': false,
    'rgba(182,92,88,0.4)': false,
    'rgba(149,88,63,0.4)': false,
    'rgba(225,158,139,0.4)': false,
    'rgba(214,131,97,0.4)': false,
    'rgba(222,156,183,0.4)': false,
    'rgba(202,90,156,0.4)': false,
    'rgba(215,61,113,0.4)': false,
    'rgba(150,90,115,0.4)': false,
    'rgba(229,177,54,0.4)': false,
    'rgba(157,110,35,0.4)': false,
    'rgba(220,173,105,0.4)': false,
    'rgba(143,115,79,0.4)': false,
    'rgba(223,138,46,0.4)': false,
    'rgba(220,191,155,0.4)': false,
    'rgba(203,218,69,0.4)': false,
    'rgba(85,159,58,0.4)': false,
    'rgba(111,129,54,0.4)': false,
    'rgba(117,223,84,0.4)': false,
    'rgba(189,218,138,0.4)': false
}

var lineColours = {
        'rgba(89,228,170,0.9)': false,
        'rgba(42,173,206,0.9)': false,
        'rgba(176,41,169,0.9)': false,
        'rgba(60,144,52,0.9)': false,
        'rgba(32,81,110,0.9)': false,
        'rgba(195,26,68,0.9)': false,
        'rgba(86,124,179,0.9)': false,
        'rgba(137,23,166,0.9)': false,
        'rgba(98,185,64,0.9)': false,
        'rgba(215,43,156,0.9)': false,
        'rgba(114,72,153,0.9)': false,
        'rgba(173,22,56,0.9)': false,
        'rgba(53,98,206,0.9)': false,
        'rgba(96,173,93,0.9)': false,
        'rgba(194,66,154,0.9)': false,
        'rgba(79,193,25,0.9)': false
        }

var chartColours = {
    'rgba(89,228,170,0.6)': false,
    'rgba(42,173,206,0.6)': false,
    'rgba(176,41,169,0.6)': false,
    'rgba(60,144,52,0.6)': false,
    'rgba(32,81,110,0.6)': false,
    'rgba(195,26,68,0.6)': false,
    'rgba(86,124,179,0.6)': false,
    'rgba(137,23,166,0.6)': false,
    'rgba(98,185,64,0.6)': false,
    'rgba(215,43,156,0.6)': false,
    'rgba(114,72,153,0.6)': false,
    'rgba(173,22,56,0.6)': false,
    'rgba(53,98,206,0.6)': false,
    'rgba(96,173,93,0.6)': false,
    'rgba(194,66,154,0.6)': false,
    'rgba(79,193,25,0.6)': false
}

var globalLabels = []
var globalSites = []
var globalSitesIDs = []
var chart = null
var trapgroupNames
var trapgroupValues
var polarData = {}
var barData = {}
var lineData = {}
var map = null
var trapgroupInfo
var heatmapLayer = null
var markers = null
var invHeatmapLayer = null
var refData
var heatMapData
var mapWidth
var mapHeight
var activeRequest = {}
var markers = []
var species_count_warning = false
var selectedTask = null
var timeLabels = []
var spatialExportControl = null
var activeBaseLayer = null
var exportCanvas = null
var textColour = 'white'
var axisColour = 'rgba(0,0,0,0.2)'
var borderColour = 'rgba(255,255,255,1)'
var includeBorders = true 
var includeLegend = true
var includeLabels = true
var includeRadialAxisLabels = true
var includeGridLines = true
var backgroundColour = null 
var tabActive = 'baseAnalysisDiv'
var selectedAnnotationSets = {}
var suveysAndSets = []
var globalAnnotationSets = []

const modalExportAlert = $('#modalExportAlert')
const modalAnnotationsSets = $('#modalAnnotationsSets')

function getLabelsAndSites(){
    /** Builds the selectors for generating results*/
    tasks = ['0']

    var formData = new FormData()
    formData.append('task_ids', JSON.stringify(tasks))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/getAllLabelsAndSites');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            globalLabels = reply.labels
            globalSites = []
            for (let i=0;i<reply.sites.length;i++) {
                let site = reply.sites[i].tag + ' (' + (parseFloat(reply.sites[i].latitude).toFixed(4)).toString() + ', ' +  (parseFloat(reply.sites[i].longitude).toFixed(4)).toString() + ')'
                globalSites.push(site)   


                let siteIds = reply.sites_ids[i].join(',')
                globalSitesIDs.push(siteIds)

            }

            updateLabelsAndSites()

        }
    }
    xhttp.send(formData);

}

function updateLabelsAndSites(){
    /** Updates the labels and sites selectors based on the selected surveys and annotation sets */
    allSpeciesSelector = document.querySelectorAll('[id^=speciesSelect-]')
    allSiteSelector = document.querySelectorAll('[id^=trapgroupSelect-]')
    speciesSelector = document.getElementById('speciesSelect')
    siteSelector = document.getElementById('trapgroupSelect')
    allSpeciesSelectorNum = document.querySelectorAll('[id^=speciesSelectNum-]')
    allSiteSelectorSpat = document.querySelectorAll('[id^=trapgroupSelectSpat-]')

    if (speciesSelector) {
        clearSelect(speciesSelector)
        var optionValues = ['-1', '0']
        var optionTexts = ['None', 'All']
        optionValues = optionValues.concat(globalLabels)
        optionTexts = optionTexts.concat(globalLabels)
        fillSelect(speciesSelector, optionTexts, optionValues)
    }


    if (siteSelector) {
        clearSelect(siteSelector)
        optionValues = ['-1', '0']
        optionTexts = ['None', 'All']
        optionValues = optionValues.concat(globalSitesIDs)
        optionTexts = optionTexts.concat(globalSites)
        fillSelect(siteSelector, optionTexts, optionValues)
    }

    for (let i=0;i<allSpeciesSelector.length;i++) {
        clearSelect(allSpeciesSelector[i])
        var optionValues = ['-1', '0']
        var optionTexts = ['None', 'All']
        optionValues = optionValues.concat(globalLabels)
        optionTexts = optionTexts.concat(globalLabels)
        fillSelect(allSpeciesSelector[i], optionTexts, optionValues)
    }

    for (let i=0;i<allSiteSelector.length;i++) {
        clearSelect(allSiteSelector[i])
        var optionValues = ['-1', '0']
        var optionTexts = ['None', 'All']
        optionValues = optionValues.concat(globalSitesIDs)
        optionTexts = optionTexts.concat(globalSites)
        fillSelect(allSiteSelector[i], optionTexts, optionValues)
    }

    for (let i=0;i<allSpeciesSelectorNum.length;i++) {
        clearSelect(allSpeciesSelectorNum[i])
        var optionValues = ['-1', '0']
        var optionTexts = ['None', 'All']
        optionValues = optionValues.concat(globalLabels)
        optionTexts = optionTexts.concat(globalLabels)
        fillSelect(allSpeciesSelectorNum[i], optionTexts, optionValues)
    }

    for (let i=0;i<allSiteSelectorSpat.length;i++) {
        clearSelect(allSiteSelectorSpat[i])
        var optionValues = ['0']
        var optionTexts = ['All']
        optionValues = optionValues.concat(globalSitesIDs)
        optionTexts = optionTexts.concat(globalSites)
        fillSelect(allSiteSelectorSpat[i], optionTexts, optionValues)
    }

}


function generateResults(){
    /** Updates the generate results div based on the selected analysis type */
    var analysisType = document.getElementById('analysisSelector').value
    var resultsDiv = document.getElementById('resultsDiv')

    while(resultsDiv.firstChild){
        resultsDiv.removeChild(resultsDiv.firstChild)
    }    

    barData = {}
    polarData = {}
    lineData = {}

    clearChartColours()
    clearButtonColours()

    if (analysisType=='1') {
        //Builds the selectors for the temporal analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('chartTypeSelector').value = 'polarArea'
        document.getElementById('normalisationDiv').hidden = false
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = false
        // document.getElementById('comparisonDiv').hidden = true
        // document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        generateTemporal()
    }
    else if (analysisType=='2') {
        //Builds the selectors for the spatial analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = false
        document.getElementById('spatialDataDiv').hidden = false
        document.getElementById('analysisDataDiv').hidden = true
        // document.getElementById('comparisonDiv').hidden = true
        // document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        generateSpatial()
    }
    else if (analysisType=='3') {
        //Builds the selectors for the numerical analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('chartTypeSelector').value = 'bar'
        document.getElementById('normalisationDiv').hidden = false
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = false
        // document.getElementById('comparisonDiv').hidden = false
        // document.getElementById('numericalDataDiv').hidden = false
        document.getElementById('btnSaveGroupFromData').disabled = true
        document.getElementById('trendlineDiv').hidden = false
        generateNumerical()
    }
    else if (analysisType=='4') {
        //Builds the selectors for the time series analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('chartTypeSelector').value = 'line'
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = false 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = false
        // document.getElementById('comparisonDiv').hidden = true
        // document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = false
        generateTime()
    }
    else{
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        // document.getElementById('comparisonDiv').hidden = true
        // document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = true
        document.getElementById('trendlineDiv').hidden = true
    }

}

function generateTemporal(){
    /** Updates the results div for temporal analysis */
    // Polar map
    mainDiv = document.getElementById('resultsDiv')

    div = document.createElement('div')
    div.classList.add('row')
    mainDiv.appendChild(div)

    colDiv1 = document.createElement('div')
    colDiv1.classList.add('col-lg-1')
    div.appendChild(colDiv1)

    aDiv2 = document.createElement('div')
    aDiv2.classList.add('col-lg-10')
    aDiv2.setAttribute('align','center')
    div.appendChild(aDiv2)

    colDiv2 = document.createElement('div')
    colDiv2.classList.add('row')
    aDiv2.appendChild(colDiv2)

    secCol2 = document.createElement('div')
    secCol2.classList.add('col-lg-12')
    secCol2.setAttribute('style','margin:0px;margin:0px')
    colDiv2.appendChild(secCol2)

    colDiv3 = document.createElement('div')
    colDiv3.classList.add('col-lg-1')
    div.appendChild(colDiv3)

    canvasDiv = document.createElement('div')
    canvasDiv.setAttribute('style','height: 850px')
    secCol2.appendChild(canvasDiv)

    canvas = document.createElement('canvas')
    canvas.setAttribute('id','statisticsChart')
    canvas.setAttribute('height','850')
    canvasDiv.appendChild(canvas)

    // Polar chart 
    var ctx = document.getElementById('statisticsChart').getContext('2d');
                
    var data = {
        datasets: [],
        labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00']
    };

    var options = {
        maintainAspectRatio: false,
        legend: {
            display: includeLegend,
            labels: {
                fontColor : textColour
            },
            onClick: null
        },
        tooltips: {
            displayColors: false,
            callbacks: {
                title: function(tooltipItems, data) {
                    return '';
                },
                label: function(tooltipItem, data) {
                    var datasetLabel = '';
                    var label = data.labels[tooltipItem.index];
                    return data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                }           
            }
        },
        scale: {
            ticks: {
                display: includeRadialAxisLabels,
                fontColor : textColour,
                showLabelBackdrop: false
            },
            pointLabels: {
                display: includeLabels,
                fontColor : textColour
            },
            gridLines: {
                display: includeGridLines,
                color: axisColour
            }
        }
    }

    chart = new Chart(ctx, {
        data: data,
        type: 'polarArea',
        options: options
    });

    updateResults()
}

function generateSpatial(){
    /** Updates the generate results div for spatial analysis */
    // Map

    var tasks = getSelectedTasks()
    
    var formData = new FormData();
    formData.append('task_ids', JSON.stringify(tasks));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            info = JSON.parse(this.responseText);
            trapgroupInfo = info.trapgroups

            mainDiv = document.getElementById('resultsDiv')

            div = document.createElement('div')
            div.classList.add('row')
            mainDiv.appendChild(div)

            space = document.createElement('div')
            space.classList.add('col-lg-1')
            div.appendChild(space)

            col1 = document.createElement('div')
            col1.classList.add('col-lg-10')
            div.appendChild(col1)

            mapDiv = document.createElement('div')
            mapDiv.setAttribute('id','mapDiv')
            mapDiv.setAttribute('style','height: 800px')
            col1.appendChild(mapDiv)

            space = document.createElement('div')
            space.classList.add('col-lg-1')
            div.appendChild(space)

            selectorDiv = document.createElement('div')
            selectorDiv.classList.add('col-lg-2')
            div.appendChild(selectorDiv)

            // Create all the layers
            osmSat = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox/satellite-v9',
                tileSize: 512,
                zoomOffset: -1,
                accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
            })

            osmSt = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1,
                accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
            })

            gSat = L.gridLayer.googleMutant({type: 'satellite'})
            // gStr = L.gridLayer.googleMutant({type: 'roadmap'})    
            // gTer = L.gridLayer.googleMutant({type: 'terrain'})
            gHyb = L.gridLayer.googleMutant({type: 'hybrid' })

            var cfg = {
                "radius": 0.05,
                "maxOpacity": .8,
                "scaleRadius": true,
                "useLocalExtrema": false,
                latField: 'lat',
                lngField: 'lng',
                valueField: 'count'
            };

            var invCfg = {
                "radius": 0.05,
                "maxOpacity": 0,
                "scaleRadius": true,
                "useLocalExtrema": false,
                latField: 'lat',
                lngField: 'lng',
                valueField: 'count'
            };

            heatmapLayer = new HeatmapOverlay(cfg);
            invHeatmapLayer = new HeatmapOverlay(invCfg);

            map = new L.map('mapDiv', {
                layers: [gSat, heatmapLayer]
            });

            baseMaps = {
                "Google Satellite": gSat,
                // "Google Roadmap": gStr,
                // "Google Terrain": gTer,
                "Google Hybrid": gHyb,
                "OpenStreetMaps Satellite": osmSat,
                "OpenStreetMaps Roadmap": osmSt,
            };

            L.control.layers(baseMaps).addTo(map);
            L.control.scale().addTo(map);
            map._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
            map._controlCorners['bottomright'].style.marginBottom = "14px";

            map.on('baselayerchange', function(e) {
                if (e.name.includes('Google')) {
                    map._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
                    map._controlCorners['bottomright'].style.marginBottom = "14px";
                }
                activeBaseLayer = e;
            });

            markers = []
            refMarkers = []
            for (let i=0;i<trapgroupInfo.length;i++) {
                marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(map)
                markers.push(marker)
                map.addLayer(marker)
                marker.bindPopup(trapgroupInfo[i].tag);
                marker.on('mouseover', function (e) {
                    this.openPopup();
                });
                marker.on('mouseout', function (e) {
                    this.closePopup();
                });
                refMarkers.push({lat:trapgroupInfo[i].latitude,lng:trapgroupInfo[i].longitude,count:1000,tag:trapgroupInfo[i].tag})
            }
            refData = {max:2000,data:refMarkers}
            invHeatmapLayer.setData(refData)

            var group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1))
            if(markers.length == 1) {
                map.setZoom(10)
            }

            spatialExportControl = L.control.bigImage({position: 'topright', maxScale: 1}).addTo(map);
            // document.getElementById('print-btn').style.color = 'black'

            updateResults(true)
        }
    }
    xhttp.open("POST", '/getCoords');
    xhttp.send(formData);

}

function generateNumerical(){
    /** Updates the generate results div for numerical analysis */
    // var generateDiv = document.getElementById('generateDiv')

    // barData = {}
    activeRequest = {}
    // getTrapgroups()

    // Bar chart
    mainDiv = document.getElementById('resultsDiv')

    div = document.createElement('div')
    div.classList.add('row')
    mainDiv.appendChild(div)

    col = document.createElement('div')
    col.classList.add('col-lg-1')
    div.appendChild(col)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    div.appendChild(col1)

    col = document.createElement('div')
    col.classList.add('col-lg-1')
    div.appendChild(col)

    div = document.createElement('div')
    div.classList.add('row')
    col1.appendChild(div)

    colDiv2 = document.createElement('div')
    colDiv2.setAttribute('style','padding:4px;margin:0px')
    colDiv2.classList.add('col-lg-12')
    div.appendChild(colDiv2)

    canvas = document.createElement('canvas')
    canvas.setAttribute('id','statisticsChart')
    canvas.setAttribute('height','650')
    colDiv2.appendChild(canvas)

    var ctx = document.getElementById('statisticsChart').getContext('2d');

    var data = {
        datasets: [],
        labels: ['Survey Count']
    };

    var options = {
        maintainAspectRatio: false,
        legend: {
            display: includeLegend,
            labels: {
                fontColor : textColour
            },
            onClick: null
        },
        tooltips: {
            displayColors: false,
            callbacks: {
                title: function(tooltipItems, data) {
                    return '';
                },
                label: function(tooltipItem, data) {
                    xAxisSelector = document.getElementById('xAxisSelector')
                    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
                    var datasetLabel = '';
                    var label = data.labels[tooltipItem.index];
                    if (xAxisSelection=='1') {
                        selector = document.querySelectorAll('[id^=speciesSelectNum-]')[tooltipItem.datasetIndex]
                        speciesName = selector.options[selector.selectedIndex].text
                        return speciesName+': '+data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                    } else {
                        return label+': '+data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                    }
                }           
            }
        },
        ticks: {
            min: 0
        },
        scales: {
            yAxes: [{
                ticks: {
                    fontColor : textColour,
                    beginAtZero: true,
                    display: includeLabels
                },
                gridLines: {
                    drawOnChartArea: includeGridLines,
                    color: axisColour
                }
                // scaleLabel: {
                //     display: true,
                //     labelString: 'Species Count',
                //     fontColor : textColour
                // }
            }],
            xAxes: [{
                ticks: {
                    fontColor : textColour,
                    display: includeLabels
                },
                gridLines: {
                    drawOnChartArea: includeGridLines,
                    color: axisColour
                }
            }] 
        }
    }

    chart = new Chart(ctx, {
        data: data,
        type: 'bar',
        options: options
    });


    updateResults()

}

function generateTime(){
    /** Updates the generate results div for time series analysis */
    // Line chart
    var mainDiv = document.getElementById('resultsDiv')

    var div = document.createElement('div')
    div.classList.add('row')
    mainDiv.appendChild(div)

    var col = document.createElement('div')
    col.classList.add('col-lg-1')
    div.appendChild(col)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    div.appendChild(col1)

    col = document.createElement('div')
    col.classList.add('col-lg-1')
    div.appendChild(col)

    div = document.createElement('div')
    div.classList.add('row')
    col1.appendChild(div)

    colDiv2 = document.createElement('div')
    colDiv2.setAttribute('style','padding:4px;margin:0px')
    colDiv2.classList.add('col-lg-12')
    div.appendChild(colDiv2)

    canvas = document.createElement('canvas')
    canvas.setAttribute('id','statisticsChart')
    canvas.setAttribute('height','650')
    colDiv2.appendChild(canvas)

    var ctx = document.getElementById('statisticsChart').getContext('2d');

    var data = {
        datasets: [],
        labels: []
    };

    var options = {
        maintainAspectRatio: false,
        legend: {
            display: includeLegend,
            labels: {
                fontColor : textColour
            },
            onClick: null
        },
        tooltips: {
            displayColors: false,
            callbacks: {
                title: function(tooltipItems, data) {
                    return '';
                },
                label: function(tooltipItem, data) {
                    var label = data.labels[tooltipItem.index];
                    return label+': '+data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                }           
            }
        },
        ticks: {
            min: 0,
        },
        scales: {
            yAxes: [{
                ticks: {
                    fontColor : textColour,
                    beginAtZero: true,
                    display: includeLabels
                },
                title: {
                    display: true,
                    fontColor : textColour,
                    text: 'Count'
                },
                gridLines: {
                    drawOnChartArea: includeGridLines,
                    color: axisColour
                }
            }],
            xAxes: [{
                ticks: {
                    fontColor : textColour,
                    display: includeLabels,
                    beginAtZero: true,
                    // soure: 'labels',
                    // maxTicksLimit: 32
                },
                gridLines: {
                    drawOnChartArea: includeGridLines,
                    color: axisColour
                },
                // type: 'time',
                // time: {
                //     minUnit: 'day',
                //     maxUnit: 'year',
                //     displayFormats: {
                //         'day': 'DD  MMM YYYY',
                //         'month': 'MMM YYYY',
                //         'year': 'YYYY'
                //     }
                // },
            }]
        }
    }

    chart = new Chart(ctx, {
        data: data,
        type: 'line',
        options: options
    });


    updateResults()

}

function buildSpeciesAndSiteSelectorRow(){
    /** Builds a row for the species and site selectors */

    var dataDiv = document.getElementById('dataDiv')
    var IDNum = getIdNumforNext('speciesSelect-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','speciesSelectDiv-'+String(IDNum))
    dataDiv.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-8')
    col1.style.paddingRight = '0px'
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-2')
    col2.style.paddingLeft = '0px'
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.style.padding = '0px'
    row.appendChild(col3)

    if (IDNum > 0) {
        col1.appendChild(document.createElement('br'))
        col2.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }

    var siteSelector = document.createElement('select')
    siteSelector.classList.add('form-control')
    siteSelector.id = 'trapgroupSelect-'+String(IDNum)
    col1.appendChild(siteSelector)
    var siteOptionTexts = ['None', 'All']
    var siteOptionValues = ['-1','0']
    siteOptionTexts.push(...globalSites)
    siteOptionValues.push(...globalSitesIDs)
    fillSelect(siteSelector, siteOptionTexts, siteOptionValues)

    $("#"+siteSelector.id).change( function(wrapIDNum) {
        return function() {
            var analysisSelector = document.getElementById('analysisSelector')
            var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
            if (analysisSelection == '1') {
                updatePolarData(wrapIDNum)
                updatePolarErrors()
            }
            else if (analysisSelection == '3') {
                updateBarData(wrapIDNum)
                updateBarErrors()
            }
            else if (analysisSelection == '4') {
                updateLineData(wrapIDNum)
                updateLineErrors()
            }
            
        }
    }(IDNum));
    

    var speciesSelector = document.createElement('select')
    speciesSelector.classList.add('form-control')
    speciesSelector.id = 'speciesSelect-'+String(IDNum)
    col1.appendChild(speciesSelector)
    var speciesOptionTexts = ['None', 'All']
    var speciesOptionValues = ['-1','0']
    speciesOptionTexts.push(...globalLabels) 
    speciesOptionValues.push(...globalLabels)

    fillSelect(speciesSelector, speciesOptionTexts, speciesOptionValues)

    $("#"+speciesSelector.id).change( function(wrapIDNum) {
        return function() {
            var analysisSelector = document.getElementById('analysisSelector')
            var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
            if (analysisSelection == '1') {
                updatePolarData(wrapIDNum)
                updatePolarErrors()
            }
            else if (analysisSelection == '3') {
                updateBarData(wrapIDNum)
                updateBarErrors()
            }
            else if (analysisSelection == '4') {
                updateLineData(wrapIDNum)
                updateLineErrors()
            }
        }
    }(IDNum));


    var selectColour = document.createElement('select');
    selectColour.classList.add('form-control');
    selectColour.id = 'colourSelect-' + String(IDNum);
    col2.appendChild(selectColour);
    
    var optionTexts = [];
    var optionValues = [];
    var optionColours = [];
    for (colour in chartColours) {
        optionValues.push(colour);
        optionTexts.push(' ');
        optionColours.push(colour);
    }
    optionValues.push('custom-' + String(IDNum));
    optionTexts.push('Custom');
    optionColours.push('white');
    
    fillSelect(selectColour, optionTexts, optionValues, null, optionColours);
    
    var colourPicker = document.createElement('input');
    colourPicker.type = 'color';
    colourPicker.id = 'colourPicker-' + IDNum;
    colourPicker.value = '#000000';
    colourPicker.style.width = '50%';
    colourPicker.style.height = '50%';
    colourPicker.style.padding = '0px';
    colourPicker.hidden = true;
    col2.appendChild(colourPicker);
    
    $("#" + selectColour.id).change(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelect-' + wrapIDNum);
            var colourPicker = document.getElementById('colourPicker-' + wrapIDNum);
    
            if (selectColour.value === 'custom-' + wrapIDNum) {
                colourPicker.hidden = false;
                // colourPicker.click();
            } else {
                selectColour.style.backgroundColor = selectColour.value;
                selectColour.value = selectColour.value;
                updateDataColour(wrapIDNum, selectColour.value);
            }
        };
    }(IDNum));

    $("#" + selectColour.id).mousedown(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelect-' + wrapIDNum);
            selectColour.style.backgroundColor = 'white';	
        };
    }(IDNum));

    $("#" + colourPicker.id).change(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelect-' + wrapIDNum);
            var colourPicker = document.getElementById('colourPicker-' + wrapIDNum);
            var selectedColor = colourPicker.value;
            var r = parseInt(selectedColor.slice(1,3), 16)
            var g = parseInt(selectedColor.slice(3,5), 16)
            var b = parseInt(selectedColor.slice(5,7), 16)
            var a = 0.6
            var rgba = 'rgba('+r+','+g+','+b+','+a+')'

            selectColour.style.backgroundColor = rgba;

            console.log(selectedColor, rgba)
            colourPicker.hidden = true;
            updateDataColour(wrapIDNum, rgba);
        };
    }(IDNum));
    

    var btnRemove = document.createElement('button');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.setAttribute("class",'btn btn-default');
    btnRemove.innerHTML = '&times;';
    col3.appendChild(btnRemove);


    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            var analysisSelector = document.getElementById('analysisSelector')
            var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
            if (analysisSelection == '1') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                // colour = btnRemove.style.backgroundColor
                if (document.getElementById('chartTypeSelector')){     
                    chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
                } else {
                    chartType = 'polarArea'
                }
                removeData(wrapIDNum, chartType)
                btnRemove.parentNode.parentNode.remove();
                if (polarData.hasOwnProperty(wrapIDNum.toString())) {
                    delete polarData[wrapIDNum.toString()]
                }
                updatePolarErrors()
            }
            else if (analysisSelection == '3') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                // colour = btnRemove.style.backgroundColor
                if (document.getElementById('chartTypeSelector')){
                    chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
                } else {
                    chartType = 'bar'
                }
                removeData(wrapIDNum, chartType)
                btnRemove.parentNode.parentNode.remove();
                if (barData.hasOwnProperty(wrapIDNum.toString())) {
                    delete barData[wrapIDNum.toString()]

                }
                updateBarErrors()
            }
            else if (analysisSelection == '4') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                // colour = btnRemove.style.backgroundColor
                if (document.getElementById('chartTypeSelector')){     
                    chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
                } else {
                    chartType = 'line'
                }
                removeData(wrapIDNum, chartType)
                btnRemove.parentNode.parentNode.remove();
                if (lineData.hasOwnProperty(wrapIDNum.toString())) {
                    delete lineData[wrapIDNum.toString()]
                }
                updateLineErrors()
            }
        }
    }(IDNum));
    
}

function updateDataColour(IDNum, colour) {
    /** Updates the colour of the data in the chart */
    var chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
    for (var i = 0; i < chart.data.datasets.length; i++) {
        if (chart.data.datasets[i].id == 'data-' + IDNum) {
            chart.data.datasets[i].backgroundColor = colour;
            if (chartType == 'line') {
                chart.data.datasets[i].borderColor = colour;
            }
        }

        if (chart.data.datasets[i].id == 'trendline-' + IDNum) {
            chart.data.datasets[i].borderColor = colour;
            chart.data.datasets[i].backgroundColor = colour;
        }
    }

    chart.update();
}

function buildSpeciesSelectorRow(){
    /** Builds a row for the species and site selectors */

    var selectorColumn = document.getElementById('speciesDiv')
    var IDNum = getIdNumforNext('speciesSelectNum-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','speciesSelectDiv-'+String(IDNum))
    selectorColumn.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-8')
    col1.style.paddingRight = '0px'
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-2')
    col2.style.paddingLeft = '0px'
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.style.padding = '0px'
    row.appendChild(col3)
    
    var speciesSelector = document.createElement('select')
    speciesSelector.classList.add('form-control')
    speciesSelector.id = 'speciesSelectNum-'+String(IDNum)
    col1.appendChild(speciesSelector)
    var speciesOptionTexts = ['None', 'All']
    var speciesOptionValues = ['-1','0']
    speciesOptionTexts.push(...globalLabels) 
    speciesOptionValues.push(...globalLabels)

    fillSelect(speciesSelector, speciesOptionTexts, speciesOptionValues)

    $("#"+speciesSelector.id).change( function(wrapIDNum) {
        return function() {
            updateBarData(wrapIDNum)
            updateBarErrors()
        }
    }(IDNum));

    var selectColour = document.createElement('select');
    selectColour.classList.add('form-control');
    selectColour.id = 'colourSelectSpecies-' + String(IDNum);
    col2.appendChild(selectColour);
    
    var optionTexts = [];
    var optionValues = [];
    var optionColours = [];
    for (colour in chartColours) {
        optionValues.push(colour);
        optionTexts.push(' ');
        optionColours.push(colour);
    }
    optionValues.push('custom-' + String(IDNum));
    optionTexts.push('Custom');
    optionColours.push('white');
    
    fillSelect(selectColour, optionTexts, optionValues, null, optionColours);
    
    var colourPicker = document.createElement('input');
    colourPicker.type = 'color';
    colourPicker.id = 'colourPickerSpecies-' + IDNum;
    colourPicker.value = '#000000';
    colourPicker.style.width = '50%';
    colourPicker.style.height = '50%';
    colourPicker.style.padding = '0px';
    colourPicker.hidden = true;
    col2.appendChild(colourPicker);
    
    $("#" + selectColour.id).change(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelectSpecies-' + wrapIDNum);
            var colourPicker = document.getElementById('colourPickerSpecies-' + wrapIDNum);
    
            if (selectColour.value === 'custom-' + wrapIDNum) {
                colourPicker.hidden = false;
                // colourPicker.click();
            } else {
                selectColour.style.backgroundColor = selectColour.value;
                selectColour.value = selectColour.value;
                updateDataColour(wrapIDNum, selectColour.value);
            }
        };
    }(IDNum));

    $("#" + selectColour.id).mousedown(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelectSpecies-' + wrapIDNum);
            selectColour.style.backgroundColor = 'white';	
        };
    }(IDNum));

    $("#" + colourPicker.id).change(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelectSpecies-' + wrapIDNum);
            var colourPicker = document.getElementById('colourPickerSpecies-' + wrapIDNum);
            var selectedColor = colourPicker.value;
            var r = parseInt(selectedColor.slice(1,3), 16)
            var g = parseInt(selectedColor.slice(3,5), 16)
            var b = parseInt(selectedColor.slice(5,7), 16)
            var a = 0.6
            var rgba = 'rgba('+r+','+g+','+b+','+a+')'

            selectColour.style.backgroundColor = rgba;

            console.log(selectedColor, rgba)
            colourPicker.hidden = true;
            updateDataColour(wrapIDNum, rgba);
        };
    }(IDNum));

    
    btnRemove = document.createElement('button');
    btnRemove.id = 'btnRemoveSpecies-'+IDNum;
    btnRemove.setAttribute("class",'btn btn-default');
    btnRemove.innerHTML = '&times;';
    col3.appendChild(btnRemove);
    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            btnRemove = document.getElementById('btnRemoveSpecies-'+wrapIDNum)
            // colour = btnRemove.style.backgroundColor
            if (document.getElementById('chartTypeSelector')){     
                chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
            } else {
                chartType = 'bar'
            }
            removeData(wrapIDNum, chartType)
            btnRemove.parentNode.parentNode.remove();
            if (barData.hasOwnProperty(wrapIDNum.toString())) {
                delete barData[wrapIDNum.toString()]
            }
            updateBarErrors()
        }
    }(IDNum));
    
}

function buildSiteSelectorRow(){
    /** Builds a row for the species and site selectors */

    var selectorColumn = document.getElementById('selectorColumn')
    var IDNum = getIdNumforNext('trapgroupSelectSpat-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','siteSelectDiv-'+String(IDNum))
    selectorColumn.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.style.padding = '0px'
    row.appendChild(col3)

    selectorColumn.appendChild(row)
    
    var siteSelector = document.createElement('select')
    siteSelector.classList.add('form-control')
    siteSelector.id = 'trapgroupSelectSpat-'+String(IDNum)
    col1.appendChild(siteSelector)
    if (IDNum == 0) {
        var siteOptionTexts = ['All']
        var siteOptionValues = ['0']
    }
    else{
        var siteOptionTexts = []
        var siteOptionValues = []
    }
    siteOptionTexts.push(...globalSites) 
    siteOptionValues.push(...globalSitesIDs)

    fillSelect(siteSelector, siteOptionTexts, siteOptionValues)

    $("#"+siteSelector.id).change( function(wrapIDNum) {
        return function() {
            updateResults(true)
        }
    }(IDNum));

    if (IDNum > 0) {
        btnRemove = document.createElement('button');
        btnRemove.id = 'btnRemoveSite-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                // var siteSelector = document.getElementById('trapgroupSelectSpat-'+wrapIDNum)
                // var siteText = siteSelector.options[siteSelector.selectedIndex].text
                // console.log(siteText)
                // var validSites = checkSitesSpatial()
                // if(siteText=='None'){
                //     var sites = getSelectedSites(true)
                //     console.log(sites)
                //     for (let i=0;i<markers.length;i++) {
                //         let marker_text = markers[i]._popup._content + ',' + parseFloat(markers[i].getLatLng().lat).toFixed(4).toString() + ',' + parseFloat(markers[i].getLatLng().lng).toFixed(4).toString()
                //         console.log(marker_text)
                //         if (!sites.includes(marker_text)){
                //             if (map.hasLayer(markers[i])) {
                //                 map.removeLayer(markers[i])
                //             }
                //             markers.splice(i,1)
                //         }
                //     }
                // }

                // if (validSites){
                //     siteText = siteText.split(' ')
                //     var lat = siteText[1].split('(')[1].split(',')[0]
                //     var lng = siteText[2].split(')')[0]

                //     for (let i=0;i<markers.length;i++) {
                //         if (markers[i].getLatLng().lat == lat && markers[i].getLatLng().lng == lng ){
                //             if (map.hasLayer(markers[i])) {
                //                 map.removeLayer(markers[i])
                //             }
                //             markers.splice(i,1)
                //         }
                //     }
                // }

                btnRemove = document.getElementById('btnRemoveSite-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();
                updateMap()

            }
        }(IDNum));
    }

    if(IDNum > 0){
        updateMap()
    }
    
}

function updateResults(update=false){
    /** Updates the results div based on the selected analysis type */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection == '1') {
        updatePolar()
    }
    else if (analysisSelection == '2') {
        if(update){
            updateMap()
        }
        else{
            updateHeatMap()
        }
    }
    else if (analysisSelection == '3') {
        if (update) {
            // getTrapgroups()
        }
        updateBar()
    }
    else if (analysisSelection == '4') {
        timeLabels = []
        updateLine()
    }
}

function updatePolar(){
    /** Updates the polar chart  */
    if (Object.keys(polarData).length == 0) {
        var allData = document.querySelectorAll('[id^=speciesSelect-]')
        if (allData.length != 0) {
            for (let i=0;i<allData.length;i++) {
                updatePolarData(i)
            }
        }
    }
    else{
        for (let IDNum in polarData) {
            updatePolarData(IDNum)
        }
    }
}

function updateBar(){
    /** Updates the bar chart  */
    if (Object.keys(barData).length == 0) {
        var allData = document.querySelectorAll('[id^=speciesSelectNum-]')
        if (allData.length != 0) {
            for (let i=0;i<allData.length;i++) {
                updateBarData(i)
            }
        }
    }
    else{
        for (let IDNum in barData) {
            updateBarData(IDNum)
        }
    }
}

function updateLine(){
    /** Updates the line chart  */
    if (Object.keys(lineData).length == 0) {
        var allData = document.querySelectorAll('[id^=speciesSelect-]')
        if (allData.length != 0) {
            for (let i=0;i<allData.length;i++) {
                updateLineData(i)
            }
        }
    }
    else{
        for (let IDNum in lineData) {
            updateLineData(IDNum)
        }
    }
}

function updateMap(){
    /** Updates the map */

    var tasks = getSelectedTasks()
    var sites = getSelectedSites(true)
    var validSites = checkSitesSpatial()

    if (sites == '0' && validSites) {
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                info = JSON.parse(this.responseText);
                trapgroupInfo = info.trapgroups

                for (let i=0;i<markers.length;i++) {
                    if (map.hasLayer(markers[i])) {
                        map.removeLayer(markers[i])
                    }
                }

                markers = []
                refMarkers = []
                for (let i=0;i<trapgroupInfo.length;i++) {
                    marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(map)
                    markers.push(marker)
                    map.addLayer(marker)
                    marker.bindPopup(trapgroupInfo[i].tag);
                    marker.on('mouseover', function (e) {
                        this.openPopup();
                    });
                    marker.on('mouseout', function (e) {
                        this.closePopup();
                    });
                    refMarkers.push({lat:trapgroupInfo[i].latitude,lng:trapgroupInfo[i].longitude,count:1000,tag:trapgroupInfo[i].tag})
                }
                refData = {max:2000,data:refMarkers}
                invHeatmapLayer.setData(refData)

                var group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1))
                if(markers.length == 1) {
                    map.setZoom(10)
                }
            }
        }
        xhttp.open("POST", '/getCoords');
        xhttp.send(formData);

        updateHeatMap()
    }
    else if (validSites) {
        for (let i=0;i<markers.length;i++) {
            if (map.hasLayer(markers[i])) {
                map.removeLayer(markers[i])
            }
        }

        markers = []
        refMarkers = []
        for (let i=0;i<sites.length;i++) {
            let split = sites[i].split(',')
            marker = L.marker([split[1], split[2]]).addTo(map)
            markers.push(marker)
            map.addLayer(marker)
            marker.bindPopup(split[0]);
            marker.on('mouseover', function (e) {
                this.openPopup();
            });
            marker.on('mouseout', function (e) {
                this.closePopup();
            });
            refMarkers.push({lat:split[1],lng:split[2],count:1000,tag:split[0]})
        }
        refData = {max:2000,data:refMarkers}
        invHeatmapLayer.setData(refData)

        var group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1))
        if(markers.length == 1) {
            map.setZoom(10)
        }

        updateHeatMap()
    }
}

function getTrapgroups(){
    /**Gets all trapgroups from server for the specified tasks*/
    var formData = new FormData();
    var tasks = getSelectedTasks()

    formData.append('task_ids', JSON.stringify(tasks));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            trapgroupNames = reply.names 
            trapgroupValues = reply.values

            var analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
            if (analysisSelection == '3') {
                var xAxisSelection = document.getElementById('xAxisSelector').options[document.getElementById('xAxisSelector').selectedIndex].value
                if (xAxisSelection == '1') {
                    chart.data.labels = ['Survey Count']
                } else if (xAxisSelection == '2') {
                    chart.data.labels = trapgroupNames.slice(2)
                }
            }
        }
    }
    xhttp.open("POST", '/getTrapgroups');
    xhttp.send(formData);
}

function getSelectedTasks(){
    //* Gets all the selected tasks *
    if (globalAnnotationSets.length > 0) {
        return globalAnnotationSets
    }
    else{
        return ['0']
    }
}

function getSelectedSites(text=false){
    //* Gets all the selected sites from the site selectors*/
    var sites = []
    var analysis = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
    var allSites = null
    if (analysis == '2'){
        allSites = document.querySelectorAll('[id^=trapgroupSelectSpat-]')
    }
    else {
        allSites = document.querySelectorAll('[id^=trapgroupSelect-]')
    }
    console.log(allSites)
    if (text) {
        for (let i=0;i<allSites.length;i++) {
            if (allSites[i].options[allSites[i].selectedIndex].text.includes(' ')){
                let split = allSites[i].options[allSites[i].selectedIndex].text.split(' ')
                console.log(split)  
                let site = split[0] + ',' + split[1].split('(')[1].split(',')[0] + ',' + split[2].split(')')[0]
                if(sites.indexOf(site) == -1){
                    sites.push(site)
                }
            }
        }
    }
    else{    
        for (let i=0;i<allSites.length;i++) {
            if (allSites[i].value.includes(',')){
                let split = allSites[i].value.split(',')
                if (sites.indexOf(split[0]) == -1){
                    sites.push(...split)
                }
            }
            else if (allSites[i].value != '-1' && allSites[i].value != '0' && sites.indexOf(allSites[i].value) == -1){
                sites.push(allSites[i].value)
            }
        }
    }


    if (sites.length==0) {
        sites = '0'
    }
    // else if (sites.length > 1){
    //     sites = sites.filter((value) => !value.includes('-1'))

    // }


    console.log(sites)
    return sites
}

function checkSitesSpatial(){
    var valid = true
    var allCheck = false
    var duplicateCheck = false
    var allSites = document.querySelectorAll('[id^=trapgroupSelectSpat-]')
    var sites_values = Array.from(allSites).map((element) => element.value)
    var message = ''
    for (let i=0;i<allSites.length;i++) {
        if (sites_values.filter((value) => value == allSites[i].value).length > 1) {
            duplicateCheck = true
            break
        }

        if (allSites[i].value == '0') {
            allCheck = true
        }
    }

    if (allCheck && allSites.length > 1) {
        valid = false
        message = 'Invalid site selection. Cannot select all sites and other sites. '
    }

    if (duplicateCheck) {
        valid = false
        message += 'Invalid site selection. Cannot select the same site more than once.'
    }
    
    if (!valid) {
        document.getElementById('spatialDataErrors').innerHTML = message
    }
    else{
        document.getElementById('spatialDataErrors').innerHTML = ''
    }

    return valid
}

function updateChart(chartType){
    /**Updates the chart to a different chart type*/
    var data = chart.data
    var labels = data.labels
    var fillData = true
    var options = {}

    if (chartType == 'polarArea') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: includeLegend,
                labels: {
                    fontColor: textColour,
                    generateLabels: function (chart) {
                        var datasets = chart.data.datasets; // Move the declaration here
                        var labels = [];
    
                        for (let i = 0; i < datasets.length; i++) {
                            var dataset = datasets[i];
                            var label = dataset.label;
                            var fillStyle = dataset.backgroundColor;
                            var borderColor = borderColour;
                            labels.push({
                                text: label,
                                fillStyle: fillStyle,
                                borderColor: borderColor,
                                borderWidth: includeBorders ? 1 : 0
                            });
                        }
    
                        return labels;
                    }
                },
                onClick: null
            },
            tooltips: {
                displayColors: false,
                callbacks: {
                    title: function(tooltipItems, data) {
                        return '';
                    },
                    label: function(tooltipItem, data) {
                        var datasetLabel = '';
                        var label = data.labels[tooltipItem.index];
                        return label + ': ' + data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                    }           
                }
            },
            scale: {
                ticks: {
                    display: includeRadialAxisLabels,
                    fontColor: textColour,
                    showLabelBackdrop: false
                },
                pointLabels: {
                    display: includeLabels,
                    fontColor: textColour
                },
                gridLines: {
                    display: includeGridLines,
                    color: axisColour
                }
            }

        }

        document.getElementById('trendlineDiv').hidden = true

    } else if (chartType == 'bar') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: includeLegend,
                labels: {
                    fontColor : textColour
                },
                onClick: null
            },
            tooltips: {
                displayColors: false,
                callbacks: {
                    title: function(tooltipItems, data) {
                        return '';
                    },
                    label: function(tooltipItem, data) {
                        var datasetLabel = '';
                        var label = data.labels[tooltipItem.index];
                        return label+': '+data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                    }           
                }
            },
            ticks: {
                min: 0
            },
            scales: {
                yAxes: [{
                    ticks: {
                        fontColor : textColour,
                        beginAtZero: true,
                        display: includeLabels
                    },
                    title: {
                        display: true,
                        fontColor : textColour,
                        text: 'Count'
                    },
                    gridLines: {
                        drawOnChartArea: includeGridLines,
                        color: axisColour
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor : textColour,
                        display: includeLabels
                    },
                    gridLines: {
                        drawOnChartArea: includeGridLines,
                        color: axisColour
                    }
                }]
            }
        }

        document.getElementById('trendlineDiv').hidden = false

    } else if (chartType == 'line') {
        fillData = false
        options = {
            maintainAspectRatio: false,
            legend: {
                display: includeLegend,
                labels: {
                    fontColor : textColour
                },
                onClick: null
            },
            tooltips: {
                displayColors: false,
                callbacks: {
                    title: function(tooltipItems, data) {
                        return '';
                    },
                    label: function(tooltipItem, data) {
                        var label = data.labels[tooltipItem.index];
                        return label+': '+data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                    }           
                }
            },
            ticks: {
                min: 0
            },
            scales: {
                yAxes: [{
                    ticks: {
                        fontColor : textColour,
                        beginAtZero: true,
                        display: includeLabels
                    },
                    title: {
                        display: true,
                        fontColor : textColour,
                        text: 'Count'
                    },
                    gridLines: {
                        drawOnChartArea: includeGridLines,
                        color: axisColour
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor : textColour,
                        display: includeLabels
                    },
                    gridLines: {
                        drawOnChartArea: includeGridLines,
                        color: axisColour
                    }
                }]
            }
        }

        document.getElementById('trendlineDiv').hidden = false

    } else if (chartType == 'scatter') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: includeLegend,
                labels: {
                    fontColor : textColour
                },
                onClick: null
            },
            tooltips: {
                displayColors: false,
                callbacks: {
                    title: function(tooltipItems, data) {
                        return '';
                    },
                    label: function(tooltipItem, data) {
                        var label = data.labels[tooltipItem.index];
                        return label + ': ' + data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].y;
                    }
                }
            },
            scales: {
                yAxes: [{
                    ticks: {
                        fontColor : textColour,
                        beginAtZero: true,
                        display: includeLabels
                    },
                    gridLines: {
                        drawOnChartArea: includeGridLines,
                        color: axisColour
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor : textColour,
                        display: includeLabels
                    },
                    type: 'category',
                    labels: labels,
                    gridLines: {
                        drawOnChartArea: includeGridLines,
                        color: axisColour
                    }
                }]
            }
        };

        document.getElementById('trendlineDiv').hidden = false

    } else if (chartType == 'radar') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: includeLegend,
                labels: {
                    fontColor : textColour
                },
                onClick: null
            },
            tooltips: {
                displayColors: false,
                callbacks: {
                    title: function(tooltipItems, data) {
                        return '';
                    },
                    label: function(tooltipItem, data) {
                        var datasetLabel = '';
                        var label = data.labels[tooltipItem.index];
                        return label + ': ' + data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                    }           
                }
            },
            scale: {
                ticks: {
                    display: includeRadialAxisLabels,
                    fontColor : textColour,
                    showLabelBackdrop: false
                },
                pointLabels: {
                    display: includeLabels,
                    fontColor : textColour
                },
                gridLines: {
                    display: includeGridLines,
                    color: axisColour
                }
            }
        }

        document.getElementById('trendlineDiv').hidden = true
    }

    data = updateChartData(chartType, data, fillData)

    chart.destroy()

    var ctx = document.getElementById('statisticsChart').getContext('2d');

    chart = new Chart(ctx, {
        data: data,
        type: chartType,
        options: options
    });

    updateTrendline()
}

function updateChartData(chartType, data, fillData){
    /**Updates the chart data to a different chart type*/

    for (let i=0;i<data.datasets.length;i++) {
        data.datasets[i].fill = fillData
        if (chartType == 'line') {
            data.datasets[i].borderColor = data.datasets[i].backgroundColor
            data.datasets[i].borderWidth = 2
            data.datasets[i].tension = 0
            data.datasets[i].spanGaps = true

        }
        else{
            data.datasets[i].data = data.datasets[i].data.map((value) => (value === null ? 0 : value));
            data.datasets[i].borderColor = borderColour
            data.datasets[i].hoverBackgroundColor = 'rgba(255,255,255,0.2)'
            data.datasets[i].borderWidth = includeBorders ? 1 : 0
            if (chartType == 'bar') {
                data.datasets[i].barPercentage = 1.0
                data.datasets[i].categoryPercentage = 1.0
            }
        }
        

        if (chartType == 'scatter') {
            for (let j=0;j<data.datasets[i].data.length;j++) {
                var dict = {
                    x: j,
                    y: data.datasets[i].data[j]
                }
                data.datasets[i].data[j] = dict
            }
        }
        else{
            if (data.datasets[i].data[0] != null  && data.datasets[i].data[0].x != undefined) {
                for (let j=0;j<data.datasets[i].data.length;j++) {
                    data.datasets[i].data[j] = data.datasets[i].data[j].y
                }
            }

            if (chartType == 'line') {
                data.datasets[i].data = data.datasets[i].data.map((value) => (value === 0 ? null : value));
            }
        }
    }

    data.datasets = data.datasets.filter((value) => !value.id.includes('trendline'));

    return data

}

function checkTimeUnit(){
    // Checks if the time unit is valid for the selected analysis
    var timeUnitNumber = document.getElementById('timeUnitNumber').value
    var valid = true
    var error = document.getElementById('timeUnitErrors')
    var message = ''

    if (timeUnitNumber == '') {
        valid = false
        message = 'Time unit cannot be empty. Please enter a number.'
    }
    else if (timeUnitNumber < 1) {
        valid = false
        message = 'Time unit must be greater than 0.'
    }
    else if (timeUnitNumber > 100) {
        valid = false
        message = 'Time unit must be less than 100. Change the time unit to a larger unit.'
    }
    // else if (timeUnitNumber.isDigit() == false) {
    //     valid = false
    //     message = 'Time unit must be a number.'
    // }

    if (valid) {
        error.innerHTML = ''
    }
    else{
        error.innerHTML = message
    }

    return valid
}

function updateChartStyle(){
    // Updates the chart style based on the selected style

    var chartData = chart.data
    var chartOptions = chart.options
    var chartType = chart.config.type
    textColour = document.getElementById('textColourSelector').value
    var axisColourSelector = document.getElementById('axisColourSelector').value
    includeLegend = document.getElementById('includeLegend').checked
    includeGridLines = document.getElementById('includeGridLines').checked
    includeRadialAxisLabels = document.getElementById('includeRadialAxisLabels').checked
    includeLabels = document.getElementById('includeLabels').checked
    includeBorders = document.getElementById('includeBorders').checked
    borderColour = document.getElementById('borderColourSelector').value
    var backgroundValue = document.getElementById('backgroundSelector').value
    backgroundColour = null
    if (backgroundValue == '2') {
        backgroundColour = 'white'
    }
    else if (backgroundValue == '3') {
        backgroundColour = 'black'
    }
    else if (backgroundValue == '4') {
        backgroundColour = '#4E5D6C'
    }

    chartOptions.legend.display = includeLegend
    chartOptions.legend.labels.fontColor = textColour
    chartOptions.legend.onClick = null

    if (axisColourSelector == '1') {
        axisColour = 'rgba(255,255,255,0.2)'
    }
    else {
        axisColour = 'rgba(0,0,0,0.2)'
    }

    if (chartOptions.scale != undefined) {
        if (chartOptions.scale.pointLabels != undefined) {
            chartOptions.scale.pointLabels.display = includeLabels
            chartOptions.scale.pointLabels.fontColor = textColour
        }
        if (chartOptions.scale.ticks != undefined) {
            chartOptions.scale.ticks.display = includeRadialAxisLabels
            chartOptions.scale.ticks.fontColor = textColour
        }
        if (chartOptions.scale.gridLines != undefined) {
            chartOptions.scale.gridLines.display = includeGridLines
            chartOptions.scale.gridLines.color = axisColour
        }
    }
    else if (chartOptions.scales != undefined){
    
        if (chartOptions.scales.xAxes != undefined) {
            chartOptions.scales.xAxes[0].ticks.display = includeLabels
            chartOptions.scales.xAxes[0].ticks.fontColor = textColour
            chartOptions.scales.xAxes[0].gridLines.drawOnChartArea = includeGridLines
            chartOptions.scales.xAxes[0].gridLines.color = axisColour
        }
    
        if (chartOptions.scales.yAxes != undefined) {
            chartOptions.scales.yAxes[0].ticks.display = includeLabels
            chartOptions.scales.yAxes[0].ticks.fontColor = textColour
            chartOptions.scales.yAxes[0].gridLines.drawOnChartArea = includeGridLines
            chartOptions.scales.yAxes[0].gridLines.color = axisColour
        }
    }

    if (chartType != 'line') {
        for (let i=0;i<chartData.datasets.length;i++) {
            chartData.datasets[i].borderColor = borderColour
            chartData.datasets[i].borderWidth = includeBorders ? 1 : 0
        }
    }

    chart.destroy()

    var ctx = document.getElementById('statisticsChart').getContext('2d');

    chart = new Chart(ctx, {
        data: chartData,
        type: chartType,
        options: chartOptions
    });

    document.getElementById('statisticsChart').style.backgroundColor = backgroundColour
}

function getSurveysAndAnnotationSets(){
    // Gets the surveys with multiple annotation sets 

    var formData = new FormData()
    sites_ids = getSelectedSites()
    start_date = document.getElementById('startDate').value
    end_date = document.getElementById('endDate').value

    if (start_date != '') {
        start_date= start_date + ' 00:00:00'
    }
    if (end_date != '') {
        end_date = end_date + ' 23:59:59'
    }

    formData.append('sites_ids', JSON.stringify(sites_ids))
    formData.append('start_date', JSON.stringify(start_date))
    formData.append('end_date', JSON.stringify(end_date))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)

            for (let i = 0; i < reply.length; i++) {
                buildSurveysAndSets(reply)
            }
        }
    }
    xhttp.open("POST", '/getSurveysAndTasksForResults');
    xhttp.send(formData);
    
}

function buildSurveysAndSets(surveys){
    // Builds the surveys and annotation sets for the annotation set modal

    var annotationDiv = document.getElementById('annotationDiv')
    while (annotationDiv.firstChild) {
        annotationDiv.removeChild(annotationDiv.firstChild);
    }

    for (let i = 0 ; i < surveys.length; i++) {
        survey = surveys[i]

        var surveyDiv = document.createElement('div')
        surveyDiv.classList.add('row')
        annotationDiv.appendChild(surveyDiv)

        var surveyName = document.createElement('div')
        surveyName.classList.add('col-6')
        surveyName.style = 'display: flex; align-items: center;'
        surveyName.innerHTML = survey['name']
        surveyDiv.appendChild(surveyName)

        var surveySets = document.createElement('div')
        surveySets.classList.add('col-6')
        surveySets.style = 'display: flex; align-items: center;'
        surveyDiv.appendChild(surveySets)

        var surveySetSelect = document.createElement('select')
        surveySetSelect.classList.add('form-control')
        surveySetSelect.id = 'annotationSetSelect-' + survey['id']
        surveySets.appendChild(surveySetSelect)

        var optionTexts = []
        var optionValues = []
        for(let j = 0; j < survey['tasks'].length; j++) {
            task = survey['tasks'][j]
            optionTexts.push(task['name'])
            optionValues.push(task['id'])
        }
        clearSelect(surveySetSelect)
        fillSelect(surveySetSelect, optionTexts, optionValues)

        annotationDiv.appendChild(document.createElement('br'))
    }
}

function calculateTrendlines(x, y, type, order=2){
    // Calculates the trendline for the data

    var trendline = []
    var data = x.map((xi, index) => [xi, y[index]])
    if (type == 'linear') {
        var linearResult = regression.linear(data);
        var linearEquation = linearResult.equation;
        trendline = x.map((xi) => linearEquation[0] * xi + linearEquation[1]);
    }
    else if (type == 'exponential') {
        var exponentialResult = regression.exponential(data);
        var exponentialEquation = exponentialResult.equation;
        trendline = x.map((xi) => exponentialEquation[0] * Math.exp(exponentialEquation[1] * xi));
    }
    else if (type == 'logarithmic') {
        var logarithmicResult = regression.logarithmic(data);
        var logarithmicEquation = logarithmicResult.equation;
        trendline = x.map((xi) => logarithmicEquation[0] + logarithmicEquation[1] * Math.log(xi));
    }
    else if (type == 'power') {
        var powerResult = regression.power(data);
        var powerEquation = powerResult.equation;
        trendline = x.map((xi) => powerEquation[0] * Math.pow(xi, powerEquation[1]));
    }
    else if (type == 'polynomial') {
        var polynomialResult = regression.polynomial(data, { order: parseInt(order) });
        var polynomialEquation = polynomialResult.equation;
        trendline = x.map((xi) => {
            let trend = 0;
            for (let i = 0; i < polynomialEquation.length; i++) {
              trend += polynomialEquation[i] * Math.pow(xi, polynomialEquation.length - 1 - i);
            }
            return trend;
          });

    }

    return trendline
}

function updateTrendline(){
    // Updates the trendline when the trendline type is changed

    var chartType = document.getElementById('chartTypeSelector').value
    var trendlineType = document.getElementById('trendlineSelector').value
    var trendlineOrder = document.getElementById('trendlineOrder').value
    var trendline_datasets = []

    chart.data.datasets = chart.data.datasets.filter((value) => !value.id.includes('trendline'));

    if (trendlineType != '-1' && chartType != 'polarArea') {
        var datasets = chart.data.datasets
        for (let i = 0; i < datasets.length; i++) {
            var data = datasets[i].data
            var data_id = datasets[i].id.split('-')[1]
            if (data.length > 0) {
                var xValues = []
                var yValues = []
                for (let j = 1; j <= data.length; j++) {
                    xValues.push(j)
                    if (chartType == 'scatter'){
                        yValues.push(data[j-1].y)
                    } else {
                        yValues.push(data[j-1])
                    }
                }
                yValues = yValues.map((value) => value === 0 ? null : value)
                var trendline = calculateTrendlines(xValues, yValues, trendlineType, trendlineOrder)
                if (chartType == 'scatter') {
                    trendline = trendline.map((value, index) => {return {x: index, y: value}})
                }

                trendline_datasets.push({
                    id: 'trendline-' + data_id,
                    label: 'Trendline ' + datasets[i].label,
                    data: trendline,
                    borderColor: chart.data.datasets[i].backgroundColor,
                    backgroundColor: chart.data.datasets[i].backgroundColor,
                    fill: false,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    type: 'line'
                })
            }
        }

        for (let i = 0; i < trendline_datasets.length; i++) {
            chart.data.datasets.push(trendline_datasets[i])
        }
    }
    
    chart.update()
}

$('#analysisSelector').on('change', function() {
    generateResults()
});

$('#baseUnitSelector').on('change', function() {
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection == '1') {
        updateBaseUnitPolar()
    }
    else if (analysisSelection == '2') {
        updateHeatMap()
    }
    else if (analysisSelection == '3') {
        updateBaseUnitBar()
    }
    else if (analysisSelection == '4') {
        updateBaseUnitLine()
    }
});

$('#startDate').on('change', function() {
    var vaild = checkDates()
    if (vaild) {
        updateResults()
    }
    else{
        document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
    }
});

$('#endDate').on('change', function() {
    var vaild = checkDates()
    if (vaild) {
        updateResults()
    }
    else{
        document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
    }
});

$('#chartTypeSelector').on('change', function() {
    var chartTypeSelector = document.getElementById('chartTypeSelector')
    var chartTypeSelection = chartTypeSelector.options[chartTypeSelector.selectedIndex].value
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection != '-1') {
        updateChart(chartTypeSelection)
    }
});

$("#normalisationSelector").change( function() {
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    if (analysisSelection == '1') {
        normalisePolar()
    }
    else if (analysisSelection == '3') {
        normaliseBar()
    }
    else if (analysisSelection == '4') {
        normaliseLine()
    }
});

$("#timeUnitSelector").change( function() {
    var validUnit = checkTimeUnit()
    if (validUnit) {
        // chart.options.scales.xAxes[0].time.unit = document.getElementById('timeUnitSelector').options[document.getElementById('timeUnitSelector').selectedIndex].text.toLowerCase()
        updateResults()
    }
});

$('#timeUnitNumber').on('change', function() {
    var validUnit = checkTimeUnit()
    if (validUnit) {
        updateResults()
    }
});

$("#xAxisSelector").change( function() {
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value

    if (xAxisSelection == '1') {
        chart.data.labels = ['Survey Count']
        document.getElementById('normalisationDiv').hidden = true
    } else if (xAxisSelection == '2') {
        chart.data.labels = []
        document.getElementById('normalisationDiv').hidden = false 
    }

    document.getElementById('statisticsErrors').innerHTML = ''
    
    species_count_warning = false
    for (let IDNum in barData) {
        updateBarData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text

            var tasks = getSelectedTasks()

            var formData = new FormData()
            formData.append("task_ids", JSON.stringify(tasks))
            formData.append("species", JSON.stringify(species))

            var xhttp = new XMLHttpRequest();
            xhttp.open("POST", '/checkSightingEditStatus');
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  
                    if ((reply.status=='warning')&&(species_count_warning==false)) {
                        species_count_warning = true
                        document.getElementById('statisticsErrors').innerHTML = reply.message
                    }
                }
            }
            xhttp.send(formData);
        }
    }
});

$("#radiusSlider").change( function() {
    value = document.getElementById('radiusSlider').value
    value = logslider(value)
    document.getElementById('radiusSliderspan').innerHTML = Math.floor(value*1000)
    if (document.getElementById('normalisationCheckBox').checked) {
        reScaleNormalisation(value)
    } else {
        heatmapLayer.cfg.radius = value
        heatmapLayer._update()
    }
});

$("#markerCheckBox").change( function() {
    if (document.getElementById('markerCheckBox').checked) {
        for (let i=0;i<markers.length;i++) {
            if (!map.hasLayer(markers[i])) {
                map.addLayer(markers[i])
            }
        }
    } else {
        for (let i=0;i<markers.length;i++) {
            if (map.hasLayer(markers[i])) {
                map.removeLayer(markers[i])
            }
        }
    }
});

$("#normalisationCheckBox").change( function() {
    updateHeatMap()
});

$("#heatMapCheckBox").change( function() {
    if (document.getElementById('heatMapCheckBox').checked) {
        map.addLayer(heatmapLayer)
    } else {
        map.removeLayer(heatmapLayer)
    }
});

$("#speciesSelect").change( function() {
    mapSpeciesSelector = document.getElementById('speciesSelect')
    selection = mapSpeciesSelector.options[mapSpeciesSelector.selectedIndex].value
    if (selection == '0') {
        excludeDiv = document.getElementById('extraSpatOptionsDiv')
        excludeDiv.appendChild(document.createElement('br'))

        h5 = document.createElement('h5')
        h5.innerHTML = 'Exclude'
        h5.setAttribute('style','margin-bottom: 2px')
        excludeDiv.appendChild(h5)

        h5 = document.createElement('div')
        h5.innerHTML = '<i>Choose which categories to exclude.</i>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        excludeDiv.appendChild(h5)

        // Nothing
        checkBoxDiv = document.createElement('div')
        checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
        excludeDiv.appendChild(checkBoxDiv)

        checkBox = document.createElement('input')
        checkBox.setAttribute('type','checkbox')
        checkBox.setAttribute('class','custom-control-input')
        checkBox.setAttribute('id','excludeNothing')
        checkBox.setAttribute('name','excludeNothing')
        checkBox.checked = true
        checkBoxDiv.appendChild(checkBox)

        checkBoxLabel = document.createElement('label')
        checkBoxLabel.setAttribute('class','custom-control-label')
        checkBoxLabel.setAttribute('for','excludeNothing')
        checkBoxLabel.innerHTML = 'Empty Images/Clusters'
        checkBoxDiv.appendChild(checkBoxLabel)

        $("#excludeNothing").change( function() {
            updateHeatMap()
        });

        // Knocks
        checkBoxDiv = document.createElement('div')
        checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
        excludeDiv.appendChild(checkBoxDiv)

        checkBox = document.createElement('input')
        checkBox.setAttribute('type','checkbox')
        checkBox.setAttribute('class','custom-control-input')
        checkBox.setAttribute('id','excludeKnocks')
        checkBox.setAttribute('name','excludeKnocks')
        checkBox.checked = true
        checkBoxDiv.appendChild(checkBox)

        checkBoxLabel = document.createElement('label')
        checkBoxLabel.setAttribute('class','custom-control-label')
        checkBoxLabel.setAttribute('for','excludeKnocks')
        checkBoxLabel.innerHTML = 'Knocked-Down Cameras'
        checkBoxDiv.appendChild(checkBoxLabel)

        $("#excludeKnocks").change( function() {
            updateHeatMap()
        });

        // VHL
        checkBoxDiv = document.createElement('div')
        checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
        excludeDiv.appendChild(checkBoxDiv)

        checkBox = document.createElement('input')
        checkBox.setAttribute('type','checkbox')
        checkBox.setAttribute('class','custom-control-input')
        checkBox.setAttribute('id','excludeVHL')
        checkBox.setAttribute('name','excludeVHL')
        checkBox.checked = true
        checkBoxDiv.appendChild(checkBox)

        checkBoxLabel = document.createElement('label')
        checkBoxLabel.setAttribute('class','custom-control-label')
        checkBoxLabel.setAttribute('for','excludeVHL')
        checkBoxLabel.innerHTML = 'Vehicles/Humans/Livestock'
        checkBoxDiv.appendChild(checkBoxLabel)

        $("#excludeVHL").change( function() {
            updateHeatMap()
        });
    } else {
        excludeDiv = document.getElementById('extraSpatOptionsDiv')
        while(excludeDiv.firstChild){
            excludeDiv.removeChild(excludeDiv.firstChild);
        }
    }
                    
    updateResults()
});

$("#btnManageAnnotationSets").click( function() {
    getSurveysAndAnnotationSets()
    modalAnnotationsSets.modal({keyboard: true})
});

$("#btnSaveSets").click( function() {
    globalAnnotationSets = []
    var allSets = document.querySelectorAll('[id^=annotationSetSelect-]')
    for (let i=0;i<allSets.length;i++) {
        globalAnnotationSets.push(allSets[i].value)
    }

    modalAnnotationsSets.modal('hide')

    updateResults()
});

$('#trendlineSelector').change( function() {
    if (document.getElementById('trendlineSelector').value == 'polynomial') {
        document.getElementById('trendlineOrderDiv').hidden = false
    }
    else {
        document.getElementById('trendlineOrderDiv').hidden = true
    }

    updateTrendline()
});

$('#trendlineOrder').change( function() {
    updateTrendline()

});

$('#trendlineOnlyCheckbox').change( function() {
    if (document.getElementById('trendlineOnlyCheckbox').checked) {
        for (let i = 0; i < chart.data.datasets.length; i++) {
            if (!chart.data.datasets[i].id.includes('trendline')) {
                chart.data.datasets[i].hidden = true
            }
        }
        chart.update()
    } else {
        for (let i = 0; i < chart.data.datasets.length; i++) {
            if (!chart.data.datasets[i].id.includes('trendline')) {
                chart.data.datasets[i].hidden = false
            }
        }
        chart.update()
    }
});

function clearResults(){
    /** Clears the results div */
    if (tabActive == 'baseAnalysisDiv') {
        var resultsDiv = document.getElementById('resultsDiv')
        while(resultsDiv.firstChild){
            resultsDiv.removeChild(resultsDiv.firstChild);
        }

        var dataDiv = document.getElementById('dataDiv')
        while(dataDiv.firstChild){
            dataDiv.removeChild(dataDiv.firstChild);
        }

        var selectorColumn = document.getElementById('selectorColumn')
        while(selectorColumn.firstChild){
            selectorColumn.removeChild(selectorColumn.firstChild);
        }

        var extraSpatOptionsDiv = document.getElementById('extraSpatOptionsDiv')
        while(extraSpatOptionsDiv.firstChild){
            extraSpatOptionsDiv.removeChild(extraSpatOptionsDiv.firstChild);
        }

        var speciesDiv = document.getElementById('speciesDiv')
        while(speciesDiv.firstChild){
            speciesDiv.removeChild(speciesDiv.firstChild);
        }
        
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        // document.getElementById('comparisonDiv').hidden = true
        // document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('trendlineOrderDiv').hidden = true
        document.getElementById('dateErrors').innerHTML = ''
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('analysisSelector').value = '-1'
        document.getElementById('baseUnitSelector').value = '2'
        document.getElementById('startDate').value = ''
        document.getElementById('endDate').value = ''
        document.getElementById('chartTypeSelector').value = 'line'
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('btnSaveGroupFromData').disabled = true
        document.getElementById('trendlineOnlyCheckbox').checked = false

        clearChartColours()

        timeLabels = []

        barData = {}
        polarData = {}
        lineData = {}

        buildSpeciesAndSiteSelectorRow()
        buildSiteSelectorRow()
        // buildSpeciesSelectorRow()
    }
    else if (tabActive == 'baseChartDiv'){
        document.getElementById('backgroundSelector').value = '1'
        document.getElementById('textColourSelector').value = 'white'
        document.getElementById('axisColourSelector').value = '2'
        document.getElementById('borderColourSelector').value = 'white'
        document.getElementById('includeGridLines').checked = true
        document.getElementById('includeLegend').checked = true
        document.getElementById('includeRadialAxisLabels').checked = true
        document.getElementById('includeLabels').checked = true
        document.getElementById('includeBorders').checked = true

        textColour = 'white'
        axisColour = 'rgba(0,0,0,0.1)'
        borderColour = 'rgba(255,255,255,1)'
        includeBorders = true 
        includeLegend = true
        includeLabels = true
        includeRadialAxisLabels = true
        includeGridLines = true
        backgroundColour = null 
        chartBorderWidth = 1

        updateChartStyle()

    }
}

function exportResults(){
    /** Exports the charts to an image */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    if (analysisSelection != '2'){
        var canvas = document.getElementById('statisticsChart');
        var newCanvas = document.createElement('canvas');
        newCanvas.width = canvas.width;
        newCanvas.height = canvas.height;
        var newContext = newCanvas.getContext('2d');
        if (backgroundColour) {
            newContext.fillStyle = backgroundColour;
            newContext.fillRect(0, 0, newCanvas.width, newCanvas.height);
        }
        newContext.drawImage(canvas, 0, 0);

        var image = newCanvas.toDataURL("image/png", 1.0).replace("image/png", "image/octet-stream");
        var link = document.createElement('a');
        link.download = 'chart.png';
        link.href = image;
        link.click();

    }
    else{
        if (spatialExportControl){
            if (activeBaseLayer.name.includes('Google')){
                modalExportAlert.modal({keyboard: true})
            }
            else{
                spatialExportControl._print();
            }  
        }
    }

}

function openAnalysisEdit(evt, editName) {
    // Declare all variables
    var i, tabcontent, tablinks;
  
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(editName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActive = editName
  }

function onload(){
    /**Function for initialising the page on load.*/
    document.getElementById("openAnalysisTab").click();
    barData = {}
    polarData = {}
    lineData = {}
    getLabelsAndSites()
    buildSpeciesAndSiteSelectorRow()
    buildSiteSelectorRow()
    // buildSpeciesSelectorRow()
}

window.addEventListener('load', onload, false);
