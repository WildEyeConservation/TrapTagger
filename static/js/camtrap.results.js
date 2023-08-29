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
var globalTags = []
var chart = null
var trapgroupNames
var trapgroupValues
var polarData = {}
var barData = {}
var lineData = {}
var map = {}
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
var tabActiveResults = 'dataSummaryTab'
var selectedAnnotationSets = {}
var suveysAndSets = []
var globalAnnotationSets = []
var activeImage = {}
var summaryTrapUnit = '0'
var globalSiteCovariates = []
var globalDetectionCovariates = []
var globalCovariateOptions = []
var globalCSVData = []

const modalExportAlert = $('#modalExportAlert')
const modalCovariates = $('#modalCovariates')
const modalImportCovariates = $('#modalImportCovariates')
// const modalAnnotationsSets = $('#modalAnnotationsSets')

function getLabelsAndSites(){
    /** Builds the selectors for generating results*/
    tasks = ['0']

    var formData = new FormData()
    formData.append('task_ids', JSON.stringify(tasks))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/getAllLabelsTagsAndSites');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            globalLabels = reply.labels
            globalTags = reply.tags
            globalSites = []
            for (let i=0;i<reply.sites.length;i++) {
                let site = reply.sites[i].tag + ' (' + (parseFloat(reply.sites[i].latitude).toFixed(4)).toString() + ', ' +  (parseFloat(reply.sites[i].longitude).toFixed(4)).toString() + ')'
                globalSites.push(site)   


                let siteIds = reply.sites_ids[i].join(',')
                globalSitesIDs.push(siteIds)

            }

            updateLabelsAndSites()
            buildDataSelectorRow()
            buildSiteSelectorRow()
            buildSpeciesSelectorRow()
            buildRSiteRows()
            buildRSpeciesRows()

        }
    }
    xhttp.send(formData);

}

function updateLabelsAndSites(){
    /** Updates the labels and sites selectors based on the selected surveys and annotation sets */
    // allSpeciesSelector = document.querySelectorAll('[id^=speciesSelect-]')
    // allSiteSelector = document.querySelectorAll('[id^=trapgroupSelect-]')
    speciesSelector = document.getElementById('speciesSelect')
    // siteSelector = document.getElementById('trapgroupSelect')
    // allSpeciesSelectorNum = document.querySelectorAll('[id^=speciesSelectNum-]')
    // allSiteSelectorSpat = document.querySelectorAll('[id^=trapgroupSelectSpat-]')

    if (speciesSelector) {
        clearSelect(speciesSelector)
        var optionValues = ['-1', '0']
        var optionTexts = ['None', 'All']
        optionValues = optionValues.concat(globalLabels)
        optionTexts = optionTexts.concat(globalLabels)
        fillSelect(speciesSelector, optionTexts, optionValues)
    }


    // if (siteSelector) {
    //     clearSelect(siteSelector)
    //     optionValues = ['-1', '0']
    //     optionTexts = ['None', 'All']
    //     optionValues = optionValues.concat(globalSitesIDs)
    //     optionTexts = optionTexts.concat(globalSites)
    //     fillSelect(siteSelector, optionTexts, optionValues)
    // }

    // for (let i=0;i<allSpeciesSelector.length;i++) {
    //     clearSelect(allSpeciesSelector[i])
    //     var optionValues = ['-1', '0']
    //     var optionTexts = ['None', 'All']
    //     optionValues = optionValues.concat(globalLabels)
    //     optionTexts = optionTexts.concat(globalLabels)
    //     fillSelect(allSpeciesSelector[i], optionTexts, optionValues)
    // }

    // for (let i=0;i<allSiteSelector.length;i++) {
    //     clearSelect(allSiteSelector[i])
    //     var optionValues = ['-1', '0']
    //     var optionTexts = ['None', 'All']
    //     optionValues = optionValues.concat(globalSitesIDs)
    //     optionTexts = optionTexts.concat(globalSites)
    //     fillSelect(allSiteSelector[i], optionTexts, optionValues)
    // }

    // for (let i=0;i<allSpeciesSelectorNum.length;i++) {
    //     clearSelect(allSpeciesSelectorNum[i])
    //     var optionValues = ['-1', '0']
    //     var optionTexts = ['None', 'All']
    //     optionValues = optionValues.concat(globalLabels)
    //     optionTexts = optionTexts.concat(globalLabels)
    //     fillSelect(allSpeciesSelectorNum[i], optionTexts, optionValues)
    // }

    // for (let i=0;i<allSiteSelectorSpat.length;i++) {
    //     clearSelect(allSiteSelectorSpat[i])
    //     var optionValues = ['0']
    //     var optionTexts = ['All']
    //     optionValues = optionValues.concat(globalSitesIDs)
    //     optionTexts = optionTexts.concat(globalSites)
    //     fillSelect(allSiteSelectorSpat[i], optionTexts, optionValues)
    // }

}


function generateResults(){
    /** Updates the generate results div based on the selected analysis type */
    var analysisType = document.getElementById('analysisSelector').value
    var resultsDiv = document.getElementById('resultsDiv')
    var resultsTab = document.getElementById('resultsTab')

    while(resultsDiv.firstChild){
        resultsDiv.removeChild(resultsDiv.firstChild)
    }   
    
    resultsTab = document.getElementById('resultsTab')
    while(resultsTab.firstChild){
        resultsTab.removeChild(resultsTab.firstChild);
    }

    barData = {}
    polarData = {}
    lineData = {}

    map = {}
    activeImage = {}

    clearChartColours()
    clearButtonColours()

    if (analysisType=='0') {
        //Builds the selectors for the summary analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = true
        // document.getElementById('chartTypeSelector').value = 'bar'
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = true
        document.getElementById('btnDownloadResultsCSV').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('groupButtonsDiv').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = false
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        resultsDiv = document.getElementById('resultsDiv')
        while(resultsDiv.firstChild){
            resultsDiv.removeChild(resultsDiv.firstChild)
        }
    }
    else if (analysisType=='1') {
        //Builds the selectors for the temporal analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('chartTypeSelector').value = 'polarArea'
        document.getElementById('normalisationDiv').hidden = false
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = false
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('groupButtonsDiv').hidden = false
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
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
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('groupButtonsDiv').hidden = false
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        generateSpatial()
    }
    else if (analysisType=='3') {
        //Builds the selectors for the numerical analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('chartTypeSelector').value = 'bar'
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = false
        document.getElementById('numericalDataDiv').hidden = false
        document.getElementById('btnSaveGroupFromData').disabled = true
        document.getElementById('trendlineDiv').hidden = false
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('groupButtonsDiv').hidden = false
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
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
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = false
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('groupButtonsDiv').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        generateTime()
    }
    else if (analysisType=='5') {
        //Builds the selectors for the activity analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = false
        document.getElementById('speciesDataDiv').hidden = false
        document.getElementById('optionsDiv').hidden = false
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = false
        document.getElementById('btnDownloadResultsCSV').hidden = false
        document.getElementById('groupButtonsDiv').hidden = false
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        generateActivity()
    }
    else if (analysisType=='6') {
        //Builds the selectors for the occupancy analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = false
        document.getElementById('speciesDataDiv').hidden = false
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = false
        document.getElementById('btnDownloadResultsCSV').hidden = false
        document.getElementById('groupButtonsDiv').hidden = false
        document.getElementById('covariatesDiv').hidden = false
        document.getElementById('observationWindowDiv').hidden = false
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
    }
    else if (analysisType=='7') {
        //Builds the selectors for spatial capture recapture analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = false
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = false
        document.getElementById('speciesDataDiv').hidden = false
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = false
        document.getElementById('btnDownloadResultsCSV').hidden = false
        document.getElementById('groupButtonsDiv').hidden = false
        document.getElementById('covariatesDiv').hidden = false
        document.getElementById('observationWindowDiv').hidden = false
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = true
        document.getElementById('indivCharacteristicsDiv').hidden = false
    }
    else{
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = false
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('btnSaveGroupFromData').disabled = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('groupButtonsDiv').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
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

    document.getElementById('statisticsChart').style.backgroundColor = backgroundColour

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

    document.getElementById('statisticsChart').style.backgroundColor = backgroundColour

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

    document.getElementById('statisticsChart').style.backgroundColor = backgroundColour

    updateResults()

}

function generateActivity(){
    /** Updates the generate results div for activity analysis */
    // Chart generated from R script

    var mainDiv = document.getElementById('resultsDiv')

    div = document.createElement('div')
    div.classList.add('row')
    mainDiv.appendChild(div)

    space = document.createElement('div')
    space.classList.add('col-lg-1')
    div.appendChild(space)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    div.appendChild(col1)

    center = document.createElement('center')
    col1.appendChild(center)

    mapDiv = document.createElement('div')
    mapDiv.setAttribute('id','mapDiv')
    mapDiv.setAttribute('style','height: 800px')
    center.appendChild(mapDiv)

    space = document.createElement('div')
    space.classList.add('col-lg-1')
    div.appendChild(space)

}

function buildDataSelectorRow(){
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
                // selectColour.hidden = true;
                // colourPicker.hidden = false;
                colourPicker.click();
            } else {
                // colourPicker.hidden = true;
                // selectColour.hidden = false;
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

            // console.log(selectedColor, rgba)
            // colourPicker.hidden = true;
            // selectColour.hidden = false;
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

    // Bug in chart.js that causes the bar chart legend not to update unless the chart is updated again
    if ( chartType == 'bar' ) {
        chart.update();
    }
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
    // colourPicker.style.width = '50%';
    // colourPicker.style.height = '50%';
    // colourPicker.style.padding = '0px';
    colourPicker.hidden = true;
    col2.appendChild(colourPicker);
    
    $("#" + selectColour.id).change(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelectSpecies-' + wrapIDNum);
            var colourPicker = document.getElementById('colourPickerSpecies-' + wrapIDNum);
    
            if (selectColour.value === 'custom-' + wrapIDNum) {
                // selectColour.hidden = true;
                // colourPicker.hidden = false;
                colourPicker.click();
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

            // console.log(selectedColor, rgba)
            // colourPicker.hidden = true;
            // selectColour.hidden = false;
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


function buildSiteCountSelectorRow(){
    /** Builds a row for the site selectors */
    var siteCountSelectorDiv = document.getElementById('siteCountSelectorDiv')
    var IDNum = getIdNumforNext('trapgroupSelectNum-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','siteSelCountDiv-'+String(IDNum))
    siteCountSelectorDiv.appendChild(containingDiv)

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

    siteCountSelectorDiv.appendChild(row)
    
    var siteSelector = document.createElement('select')
    siteSelector.classList.add('form-control')
    siteSelector.id = 'trapgroupSelectNum-'+String(IDNum)
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
        btnRemove.id = 'btnRemoveSiteCount-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                site = document.getElementById('trapgroupSelectNum-'+wrapIDNum).options[document.getElementById('trapgroupSelectNum-'+wrapIDNum).selectedIndex].text 
                site_tag = site.split(' ')[0]
                site_index = chart.data.labels.indexOf(site_tag)
                chart.data.labels.splice(site_index, 1)
                chart.data.datasets.forEach((dataset) => {
                    dataset.data.splice(site_index, 1);
                }
                );
                chart.update();
                btnRemove = document.getElementById('btnRemoveSiteCount-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();
            }
        }(IDNum));
    }
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

    if (analysisSelection == '0') {
        // document.getElementById('resultsDiv').style.display = 'none'
        // document.getElementById('loadingDiv').style.display = 'block'
        // document.getElementById('loadingCircle').style.display = 'block'
        document.getElementById('btnExportResults').disabled = true
        analysisSelector.disabled = true
        getSummary()
    }
    else if (analysisSelection == '1') {
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
            getTrapgroups()
        }
        updateBar()
    }
    else if (analysisSelection == '4') {
        timeLabels = []
        updateLine()
    }
    else if (analysisSelection == '5') {
        analysisSelector.disabled = true
        updateActivity()
    }
    else if (analysisSelection == '6') {
        analysisSelector.disabled = true
        updateOccupancy()
    }
    else if (analysisSelection == '7') {
        analysisSelector.disabled = true
        updateSCR()
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

function updateActivity(check=false){
    /** Updates the activity chart  */
    if (check) {
        var species = '0'
        var validActivity = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var density = document.getElementById('unitDensity').checked
        var centreDay = document.getElementById('centreDay').checked
        var overlap = document.getElementById('overlapEst').checked
        var clockTime = document.getElementById('clockTime').checked
    
        var validActivity = checkActivity(species, overlap)
    
        var unit = density ? 'density' : 'frequency';
        var centre = centreDay ? 'day' : 'night';
        var time = clockTime ? 'clock' : 'solar';
        var overlap = overlap ? 'true' : 'false';
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('unit', JSON.stringify(unit));
        formData.append('centre', JSON.stringify(centre));
        formData.append('time', JSON.stringify(time));
        formData.append('overlap', JSON.stringify(overlap));
    
        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validActivity) {

        if (!check) {
            document.getElementById('resultsDiv').style.display = 'none'
            document.getElementById('loadingDiv').style.display = 'block'
            document.getElementById('loadingCircle').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a few minutes to run. Do not navigate away from this page until the analysis is complete.'
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                resultsDiv = document.getElementById('resultsDiv')
                if(reply.status == 'SUCCESS'){
                    image_url = reply.activity_img_url
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    resultsDiv.style.display = 'block'
                    document.getElementById('analysisSelector').disabled = false
                    document.getElementById('statisticsErrors').innerHTML = ''
                    if (image_url){
                        if (activeImage['mapDiv']) {
                            activeImage['mapDiv'].setUrl(image_url)
                        }
                        else{
                            while(resultsDiv.firstChild){
                                resultsDiv.removeChild(resultsDiv.firstChild);
                            }
                            generateActivity()
                            initialiseImageMap(image_url)
                        }
                    }
                    else{

                        while (resultsDiv.firstChild) {
                            resultsDiv.removeChild(resultsDiv.firstChild);
                        }

                        document.getElementById('statisticsErrors').innerHTML = 'No data available for this analysis. Please try again.'

                    }

                }
                else if(reply.status == 'FAILURE'){

                    while (resultsDiv.firstChild) {
                        resultsDiv.removeChild(resultsDiv.firstChild);
                    }

                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    resultsDiv.style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML = 'An error occurred while running the analysis. Please try again.'
                    document.getElementById('analysisSelector').disabled = false
                }
                else {
                    setTimeout(function(){updateActivity(true)}, 10000);
                }

            }
        }
        xhttp.open("POST", '/getActivityPattern');
        xhttp.send(formData);

    }

}

function checkActivity(species, overlap){
    /** Checks if the activity parameters are valid */
    var rErrors = document.getElementById('rErrors')
    message = ''
    var valid = true

    if (species == '-1') {
        message = 'Please select a species.'
        valid = false
    }

    // console.log(overlap)

    if (overlap){
        if (species.length != 2){
            message = 'Overlap estimation requires exactly two species.'
            valid = false
        }
    }

    if (valid) {
        rErrors.innerHTML = ''
    }
    else {
        rErrors.innerHTML = message
    }

    return valid
}


function initialiseImageMap(image_url, map_id='mapDiv'){
    /**Initialises the image map */
    var mapDiv = document.getElementById(map_id)
    var imageUrl = image_url
    var img = new Image();
    img.onload = function(){

        mapDiv = document.getElementById(map_id)

        w = this.width
        h = this.height

        // console.log(w,h)
    
        if (w>h) {
            mapDiv.setAttribute('style','height: calc(45vw *'+(h/w)+');  width:45vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
        } else {
            mapDiv.setAttribute('style','height: calc(45vw *'+(w/h)+');  width:45vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
        }

        L.Browser.touch = true
        // console.log(mapDiv)
        map[map_id] = new L.map(mapDiv, {
            crs: L.CRS.Simple,
            maxZoom: 10,
            center: [0, 0],
            zoomSnap: 0
        })
        // console.log(map)
        var h1 = mapDiv.clientHeight
        var w1 = mapDiv.clientWidth

        var southWest = map[map_id].unproject([0, h1], 2);
        var northEast = map[map_id].unproject([w1, 0], 2);
        var bounds = new L.LatLngBounds(southWest, northEast);

        mapWidth = northEast.lng
        mapHeight = southWest.lat

        activeImage[map_id] = L.imageOverlay(imageUrl, bounds).addTo(map[map_id]);
        map[map_id].setMaxBounds(bounds);
        map[map_id].fitBounds(bounds)
        map[map_id].setMinZoom(map[map_id].getZoom())

        
        map[map_id].on('resize', function(wrap_map_id) {
            return function() {
                mapDiv = document.getElementById(wrap_map_id)
                if (mapDiv) {
                    h1 = mapDiv.clientHeight
                    w1 = mapDiv.clientWidth

                    southWest = map[wrap_map_id].unproject([0, h1], 2);
                    northEast = map[wrap_map_id].unproject([w1, 0], 2);
                    bounds = new L.LatLngBounds(southWest, northEast);

                    mapWidth = northEast.lng
                    mapHeight = southWest.lat

                    map[wrap_map_id].invalidateSize()
                    map[wrap_map_id].setMaxBounds(bounds)
                    map[wrap_map_id].fitBounds(bounds)
                    map[wrap_map_id].setMinZoom(map[wrap_map_id].getZoom())
                    activeImage[wrap_map_id].setBounds(bounds)
                }
            }
        }(map_id));

        map[map_id].on('drag', function(wrap_map_id) {
            return function() {
                map[wrap_map_id].panInsideBounds(bounds, { animate: false });
            }
        }(map_id));

    };
    img.src = imageUrl

}

function getActivityPatternCSV(check=false){
    /** Downloads the activity pattern CSV */

    if (check) {
        var species = '0'
        var validActivity = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var density = document.getElementById('unitDensity').checked
        var centreDay = document.getElementById('centreDay').checked
        var overlap = document.getElementById('overlapEst').checked
        var clockTime = document.getElementById('clockTime').checked
    
        var validActivity = checkActivity(species, overlap)
    
        var unit = density ? 'density' : 'frequency';
        var centre = centreDay ? 'day' : 'night';
        var time = clockTime ? 'clock' : 'solar';
        var overlap = overlap ? 'true' : 'false';
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('unit', JSON.stringify(unit));
        formData.append('centre', JSON.stringify(centre));
        formData.append('time', JSON.stringify(time));
        formData.append('overlap', JSON.stringify(overlap));
    
        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validActivity) {
        document.getElementById('rErrors').innerHTML = 'Downloading CSV...'
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    csv_url = reply.activity_csv_url
                    filename = csv_url.split('/')[csv_url.split('/').length-1]
                    
                    var link = document.createElement('a');
                    link.setAttribute('download', filename);
                    link.setAttribute('href', csv_url);
                    link.click();

                    document.getElementById('rErrors').innerHTML = ''

                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                }
                else{
                    setTimeout(function(){getActivityPatternCSV(true)}, 10000);
                }

            }
        }
        xhttp.open("POST", '/getActivityPatternCSV');
        xhttp.send(formData);

    }

}

function getTrapgroups(){
    /**Gets all trapgroups from server for the specified tasks*/
    // var formData = new FormData();
    // var tasks = getSelectedTasks()

    // formData.append('task_ids', JSON.stringify(tasks));

    // var xhttp = new XMLHttpRequest();
    // xhttp.onreadystatechange =
    // function(){
    //     if (this.readyState == 4 && this.status == 200) {
    //         reply = JSON.parse(this.responseText);
    //         trapgroupNames = reply.names 
    //         trapgroupValues = reply.values

    //         var analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
    //         if (analysisSelection == '3') {
    //             var xAxisSelection = document.getElementById('xAxisSelector').options[document.getElementById('xAxisSelector').selectedIndex].value
    //             if (xAxisSelection == '1') {
    //                 chart.data.labels = ['Survey Count']
    //             } else if (xAxisSelection == '2') {
    //                 chart.data.labels = trapgroupNames.slice(2)
    //             }
    //         }
    //     }
    // }
    // xhttp.open("POST", '/getTrapgroups');
    // xhttp.send(formData);

    // var sites = getSelectedSites(true)
    // var validSites = checkSitesSpatial() // hierdeie update 
    // var analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
    // if (analysisSelection == '3') {
    //     var xAxisSelection = document.getElementById('xAxisSelector').options[document.getElementById('xAxisSelector').selectedIndex].value
    //     if (xAxisSelection == '1') {
    //         chart.data.labels = ['Survey Count']
    //     }
    //     else if (xAxisSelection == '2' && validSites) {
    //         chart.data.labels = sites
    //     }
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
    else if (analysis == '3'){
        allSites = document.querySelectorAll('[id^=trapgroupSelectNum-]')
    }
    else if (analysis=='5' || analysis=='6' || analysis=='7'){
        allSites = document.querySelectorAll('[id^=siteSelector-]')
    }
    else if (analysis=='0' || analysis=='-1'){
        return '0'
    }
    else {
        allSites = document.querySelectorAll('[id^=trapgroupSelect-]')
    }
    // console.log(allSites)
    if (text) {
        for (let i=0;i<allSites.length;i++) {
            if (allSites[i].options[allSites[i].selectedIndex].text.includes(' ')){
                let split = allSites[i].options[allSites[i].selectedIndex].text.split(' ')
                // console.log(split)  
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


    // console.log(sites)
    return sites
}

function getSelectedSpecies(){
    //* Gets all the selected species from the species selectors*/
    var species = []
    var allSpecies = document.querySelectorAll('[id^=speciesSelector-]')
    for (let i=0;i<allSpecies.length;i++) {
        if (allSpecies[i].value != '-1' && allSpecies[i].value != '0' && species.indexOf(allSpecies[i].value) == -1){
            species.push(allSpecies[i].value)
        }
    }

    if (species.length==0) {
        if (allSpecies.length > 0) {
            species = allSpecies[0].value
        }
    }

    return species
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

    analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
    if (analysisSelection == '0') {
        options.legend.display = false
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
    analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
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

    if (chart && document.getElementById('statisticsChart')) {
        var chartData = chart.data
        var chartOptions = chart.options
        var chartType = chart.config.type

        if (analysisSelection == '0'){
            chartOptions.legend.display = false
        }
        else{
            chartOptions.legend.display = includeLegend
        }
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


        if (analysisSelection == '0'){
            if(chart1 && document.getElementById('ct_canvas1')){
                var chartData1 = chart1.data
                var chartOptions1 = chart1.options
                var chartType1 = chart1.config.type

                chartOptions1.legend.display = false
                chartOptions1.legend.labels.fontColor = textColour
                chartOptions1.legend.onClick = null

                if (axisColourSelector == '1') {
                    axisColour = 'rgba(255,255,255,0.2)'
                }
                else {
                    axisColour = 'rgba(0,0,0,0.2)'
                }

                if (chartOptions1.scale != undefined) {
                    if (chartOptions1.scale.pointLabels != undefined) {
                        chartOptions1.scale.pointLabels.display = includeLabels
                        chartOptions1.scale.pointLabels.fontColor = textColour
                    }
                    if (chartOptions1.scale.ticks != undefined) {
                        chartOptions1.scale.ticks.display = includeRadialAxisLabels
                        chartOptions1.scale.ticks.fontColor = textColour
                    }
                    if (chartOptions1.scale.gridLines != undefined) {
                        chartOptions1.scale.gridLines.display = includeGridLines
                        chartOptions1.scale.gridLines.color = axisColour
                    }
                }
                else if (chartOptions1.scales != undefined){
                    if (chartOptions1.scales.xAxes != undefined) {
                        chartOptions1.scales.xAxes[0].ticks.display = includeLabels
                        chartOptions1.scales.xAxes[0].ticks.fontColor = textColour
                        chartOptions1.scales.xAxes[0].gridLines.drawOnChartArea = includeGridLines
                        chartOptions1.scales.xAxes[0].gridLines.color = axisColour
                    }

                    if (chartOptions1.scales.yAxes != undefined) {
                        chartOptions1.scales.yAxes[0].ticks.display = includeLabels
                        chartOptions1.scales.yAxes[0].ticks.fontColor = textColour
                        chartOptions1.scales.yAxes[0].gridLines.drawOnChartArea = includeGridLines
                        chartOptions1.scales.yAxes[0].gridLines.color = axisColour
                    }

                }

                if (chartType1 != 'line') {
                    for (let i=0;i<chartData1.datasets.length;i++) {
                        chartData1.datasets[i].borderColor = borderColour
                        chartData1.datasets[i].borderWidth = includeBorders ? 1 : 0
                    }
                }

                chart1.destroy()

                var ctx1 = document.getElementById('ct_canvas1').getContext('2d');

                chart1 = new Chart(ctx1, {
                    data: chartData1,
                    type: chartType1,
                    options: chartOptions1
                });

                document.getElementById('ct_canvas1').style.backgroundColor = backgroundColour

            }

            if(chart2 && document.getElementById('ct_canvas2')){
                var chartData2 = chart2.data
                var chartOptions2 = chart2.options
                var chartType2 = chart2.config.type

                chartOptions2.legend.display = false

                if (axisColourSelector == '1') {
                    axisColour = 'rgba(255,255,255,0.2)'
                }
                else {
                    axisColour  = 'rgba(0,0,0,0.2)'
                }

                if (chartOptions2.scale != undefined) {
                    if (chartOptions2.scale.pointLabels != undefined) {
                        chartOptions2.scale.pointLabels.display = includeLabels
                        chartOptions2.scale.pointLabels.fontColor = textColour
                    }

                    if (chartOptions2.scale.ticks != undefined) {
                        chartOptions2.scale.ticks.display = includeRadialAxisLabels
                        chartOptions2.scale.ticks.fontColor = textColour
                    }

                    if (chartOptions2.scale.gridLines != undefined) {
                        chartOptions2.scale.gridLines.display = includeGridLines
                        chartOptions2.scale.gridLines.color = axisColour
                    }

                }
                else if (chartOptions2.scales != undefined){
                    if (chartOptions2.scales.xAxes != undefined) {
                        chartOptions2.scales.xAxes[0].ticks.display = includeLabels
                        chartOptions2.scales.xAxes[0].ticks.fontColor = textColour
                        chartOptions2.scales.xAxes[0].gridLines.drawOnChartArea = includeGridLines
                        chartOptions2.scales.xAxes[0].gridLines.color = axisColour
                    }

                    if (chartOptions2.scales.yAxes != undefined) {
                        chartOptions2.scales.yAxes[0].ticks.display = includeLabels
                        chartOptions2.scales.yAxes[0].ticks.fontColor = textColour
                        chartOptions2.scales.yAxes[0].gridLines.drawOnChartArea = includeGridLines
                        chartOptions2.scales.yAxes[0].gridLines.color = axisColour
                    }

                }

                if (chartType2 != 'line') {
                    for (let i=0;i<chartData2.datasets.length;i++) {
                        chartData2.datasets[i].borderColor = borderColour
                        chartData2.datasets[i].borderWidth = includeBorders ? 1 : 0
                    }
                }

                chart2.destroy()

                var ctx2 = document.getElementById('ct_canvas2').getContext('2d');

                chart2 = new Chart(ctx2, {
                    data: chartData2,
                    type: chartType2,
                    options: chartOptions2
                });

                document.getElementById('ct_canvas2').style.backgroundColor = backgroundColour

            }


            if (document.getElementById('div_ct3')){
                chart3 = document.getElementById('div_ct3')
                // CHart 3 is a PLotly chart and the style needs to be updated 
                var chartData3 = chart3.data
                var chartLayout3 = chart3.layout

                chartLayout3.font.color = textColour

                if (axisColourSelector == '1') {
                    axisColour = 'rgba(255,255,255,0.2)'
                }
                else{
                    axisColour = 'rgba(0,0,0,0.2)'
                }

                if (chartLayout3.xaxis != undefined) {
                    chartLayout3.xaxis.color = textColour
                    chartLayout3.xaxis.showgrid = includeGridLines
                    chartLayout3.xaxis.gridcolor = axisColour
                }

                if (chartLayout3.yaxis != undefined) {
                    chartLayout3.yaxis.color = textColour
                    chartLayout3.yaxis.showgrid = includeGridLines
                    chartLayout3.yaxis.gridcolor = axisColour
                }

                // CHange the background colour
                if (backgroundColour != null) {
                    chartLayout3.plot_bgcolor = backgroundColour
                    chartLayout3.paper_bgcolor = backgroundColour
                }
                else{
                    chartLayout3.paper_bgcolor= 'rgb(78,93,108)'
                    chartLayout3.plot_bgcolor= 'rgb(78,93,108'
                }

                // Show or don't show the labels
                if (includeLabels) {
                    if (chartLayout3.xaxis != undefined) {
                        chartLayout3.xaxis.showticklabels = true
                    }

                    if (chartLayout3.yaxis != undefined) {
                        chartLayout3.yaxis.showticklabels = true
                    }
                }
                else{
                    if (chartLayout3.xaxis != undefined) {
                        chartLayout3.xaxis.showticklabels = false
                    }

                    if (chartLayout3.yaxis != undefined) {
                        chartLayout3.yaxis.showticklabels = false
                    }
                }


                Plotly.react('div_ct3', chartData3, chartLayout3, {displayModeBar: false});
                
            }

        }

    }
}

function getSurveysAndAnnotationSets(clear=false){
    // Gets the surveys with multiple annotation sets 

    var formData = new FormData()

    if (clear) {
        sites_ids = '0'
        start_date = ''
        end_date = ''
    }
    else{
        sites_ids = getSelectedSites()
        start_date = document.getElementById('startDate').value
        end_date = document.getElementById('endDate').value
    }

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

            if (selectedAnnotationSets) {
                allSets = document.querySelectorAll('[id^=annotationSetSelect-]')
                for (let i = 0; i < allSets.length; i++) {
                    s_id = allSets[i].id.split('-')[1]
                    if (selectedAnnotationSets[s_id] != undefined) {
                        allSets[i].value = selectedAnnotationSets[s_id]
                    }
                }

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
                    label: 'Trend ' + datasets[i].label,
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

function buildRSiteRows(){
    var siteSelectorDiv = document.getElementById('siteSelectorDiv')
    var IDNum = getIdNumforNext('siteSelector-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','siteSelDiv-'+String(IDNum))
    siteSelectorDiv.appendChild(containingDiv)

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

    siteSelectorDiv.appendChild(row)
    
    var siteSelector = document.createElement('select')
    siteSelector.classList.add('form-control')
    siteSelector.id = 'siteSelector-'+String(IDNum)
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

    if (IDNum > 0) {
        btnRemove = document.createElement('button');
        btnRemove.id = 'btnRemoveSiteR-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                btnRemove = document.getElementById('btnRemoveSiteR-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();
            }
        }(IDNum));
    }
}

function buildRSpeciesRows(){
    var analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
    var speciesSelectorDiv = document.getElementById('speciesSelectorDiv')
    var IDNum = getIdNumforNext('speciesSelector-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','speciesSelDiv-'+String(IDNum))
    speciesSelectorDiv.appendChild(containingDiv)

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

    speciesSelectorDiv.appendChild(row)

    var speciesSelector = document.createElement('select')
    speciesSelector.classList.add('form-control')
    speciesSelector.id = 'speciesSelector-'+String(IDNum)
    col1.appendChild(speciesSelector)

    var speciesOptionTexts = ['None', 'All']
    var speciesOptionValues = ['-1','0']
    speciesOptionTexts.push(...globalLabels) 
    speciesOptionValues.push(...globalLabels)

    fillSelect(speciesSelector, speciesOptionTexts, speciesOptionValues)

    if (IDNum > 0) {
        btnRemove = document.createElement('button');
        btnRemove.id = 'btnRemoveSpeciesR-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                btnRemove = document.getElementById('btnRemoveSpeciesR-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();
            }
        }(IDNum));
    }
}


$('#analysisSelector').on('change', function() {
    activeImage = {}
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

$('#startDate, #endDate').on('change', function() {
    var vaild = checkDates()
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    
    if (vaild) {
        if(analysisSelection != '0' && analysisSelection != '5' && analysisSelection != '6' && analysisSelection != '7'){
            updateResults()
        }
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
        document.getElementById('siteCountDiv').hidden = true
    } else if (xAxisSelection == '2') {
        chart.data.labels = []
        document.getElementById('normalisationDiv').hidden = false 
        document.getElementById('siteCountDiv').hidden = false
        buildSiteCountSelectorRow()
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

// $("#btnManageAnnotationSets").click( function() {
//     getSurveysAndAnnotationSets()
//     modalAnnotationsSets.modal({keyboard: true})
// });

$("#btnSaveSets").click( function() {
    globalAnnotationSets = []
    selectedAnnotationSets = {}
    var allSets = document.querySelectorAll('[id^=annotationSetSelect-]')
    for (let i=0;i<allSets.length;i++) {
        globalAnnotationSets.push(allSets[i].value)
        selectedAnnotationSets[allSets[i].id.split('-')[1]] = allSets[i].value
    }

    // modalAnnotationsSets.modal('hide')
    analysisSelection = document.getElementById('analysisSelector').options[document.getElementById('analysisSelector').selectedIndex].value
    if(analysisSelection != '0' && analysisSelection != '5' && analysisSelection != '6' && analysisSelection != '7'){
        updateResults()
    }
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

// $('#solarTime, #clockTime').change( function() {
//     var solarTime = document.getElementById('solarTime').checked
//     if (solarTime) {
//         document.getElementById('solarDiv').hidden = false
//     } else {
//         document.getElementById('solarDiv').hidden = true
//     }

// });

$('#btnViewScript').click( function() {
    // View the R script for the analysis
    scriptDiv = document.getElementById('scriptDiv')
    if (scriptDiv.hidden) {
        var analysisSelector = document.getElementById('analysisSelector')
        var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

        if (analysisSelection == '5') {
            filename = 'activity_pattern'
        }
        else if (analysisSelection == '6') {
            filename = 'occupancy'
        }
        else if (analysisSelection == '7') {
            filename = 'spatial_capture_recapture'
        }
        else{
            filename = null
        }

        if (filename){
            var formData = new FormData()
            formData.append('filename', JSON.stringify(filename))

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    document.getElementById('scriptTextArea').innerHTML = reply.script
                    document.getElementById('scriptDiv').hidden = false
                }
            }
            xhttp.open("POST", '/getRScript');
            xhttp.send(formData);
        }
    }
    else {
        document.getElementById('scriptDiv').hidden = true
    }

});

$('#btnDownloadResultsCSV').click( function() {
    // Downloads the data for the results as a CSV file
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection == '5') {
        getActivityPatternCSV()
    }
    else if (analysisSelection == '6') {
        getOccupancyCSV()
    }
    else if (analysisSelection == '7') {
        getSCRcsv()
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

        var resultsTab = document.getElementById('resultsTab')
        while(resultsTab.firstChild){
            resultsTab.removeChild(resultsTab.firstChild);
        }

        document.getElementById('loadingDiv').style.display = 'none'
        document.getElementById('loadingCircle').style.display = 'none'
        document.getElementById('resultsDiv').style.display = 'block'
        
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
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
        document.getElementById('siteDataDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('scriptDiv').hidden = true
        document.getElementById('groupButtonsDiv').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 

        clearChartColours()

        timeLabels = []

        barData = {}
        polarData = {}
        lineData = {}

        buildDataSelectorRow()
        buildSiteSelectorRow()
        buildSpeciesSelectorRow()
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
    else if (tabActive == 'baseTasksDiv'){
        selectedAnnotationSets = {}
        globalAnnotationSets = []
        getSurveysAndAnnotationSets(true)
    }
}

function exportResults(){
    /** Exports the charts to an image */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection == '0') {
        // Export each element on the summary page
        // if (tabActiveResults == 'dataSummaryTab'){
        //     var table = document.getElementById('summaryTable')
            
        //     // Create image from table
        //     html2canvas(table, {
        //         onrendered: function(canvas) {
        //             var image = canvas.toDataURL("image/png", 1.0).replace("image/png", "image/octet-stream");
        //             var link = document.createElement('a');
        //             link.download = 'summary.png';
        //             link.href = image;
        //             link.click();
        //         }
        //     });

        // }
        if (tabActiveResults == 'abundanceTab'){
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
        else if (tabActiveResults == 'effortDaysTab'){
            var canvas = document.getElementById('ct_canvas1');
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
            link.download = 'chart1.png';
            link.href = image;
            link.click();

        }
        else if (tabActiveResults == 'cameraTrapDataCountsTab'){

            var canvas = document.getElementById('ct_canvas2');
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
            link.download = 'chart2.png';
            link.href = image;
            link.click();
        }
        else if (tabActiveResults == 'cameraTrapActivityTab'){

            downloadButton = document.querySelector('[data-title="Download plot as a png"]');
            downloadButton.click();
        }

    }    
    else if (analysisSelection == '2') {
        if (spatialExportControl){
            if (activeBaseLayer.name.includes('Google')){
                modalExportAlert.modal({keyboard: true})
            }
            else{
                spatialExportControl._print();
            }  
        }
    }
    else if (analysisSelection == '5') {
        if (activeImage['mapDiv'] && activeImage['mapDiv']._url != '') {
            var imageUrl = activeImage['mapDiv']._url;
            var link = document.createElement('a');
            link.href = imageUrl;
            link.click();
        }
    }
    else if (analysisSelection == '6') {
        // Get active tab and export selected graph 
        occu_name = tabActiveResults.split('occuTab_')[1]
        map_id = 'mapDiv_' + occu_name
        if (activeImage[map_id] && activeImage[map_id]._url != '') {
            var imageUrl = activeImage[map_id]._url;
            var link = document.createElement('a');
            link.href = imageUrl;
            link.click();
        }

    }
    else if (analysisSelection == '7') {
        // Get active tab and export selected graph
        scr_name = tabActiveResults.split('Tab')[0]
        map_id = 'mapDiv_' + scr_name

        if (map_id == 'mapDiv_srcHeatmap') {
            if (spatialExportControl){
                if (activeBaseLayer.name.includes('Google')){
                    modalExportAlert.modal({keyboard: true})
                }
                else{
                    spatialExportControl._print();
                }  
            }
        }
        else{
            if (activeImage[map_id] && activeImage[map_id]._url != '') {
                var imageUrl = activeImage[map_id]._url;
                var link = document.createElement('a');
                link.href = imageUrl;
                link.click();
            }
        }

    }
    else{
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

}

function openAnalysisEdit(evt, editName) {
    // Declare all variables
    var i, tabcontent, tablinks;
    var filterCard = document.getElementById('filterCard')
    // Get all elements with class="tabcontent" and hide them
    tabcontent = filterCard.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = filterCard.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(editName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActive = editName

    if (tabActive == 'baseTasksDiv') {
        getSurveysAndAnnotationSets()
    }
}

function openResultsTab(evt, tabName, results) {
    // Declare all variables
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value;
    var resultsCard = document.getElementById('mainCard')
    var tabcontent = resultsCard.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    var tablinks = resultsCard.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActiveResults = tabName

    if (analysisSelection == '0'){
        buildSummaryTab(results, tabName)
    }
    else if (analysisSelection == '6'){
        buildOccupancyResults(results, tabName)
    }
    else if (analysisSelection == '7'){
        buildSCR(results, tabName)
    }
}

function getSummary(check){
    /** Gets the summary of the results */

    if (check) {
        var formData = new FormData()
    }
    else{
        var task_ids = getSelectedTasks()
        var baseUnit = document.getElementById('baseUnitSelector').value
        var start_date = document.getElementById('startDate').value
        var end_date = document.getElementById('endDate').value
        if (document.getElementById('cameraSelector')){
            var trap_unit = document.getElementById('cameraSelector').value
        }
        else{
            var trap_unit = '0'
        }
        summaryTrapUnit = trap_unit
    
        var formData = new FormData()
        formData.append('task_ids', JSON.stringify(task_ids))
        formData.append('baseUnit', JSON.stringify(baseUnit))
        if (start_date != '') {	
            start_date = start_date + ' 00:00:00'
            formData.append('startDate', JSON.stringify(start_date))
        }
        if (end_date != '') {
            end_date = end_date + ' 23:59:59'
            formData.append('endDate', JSON.stringify(end_date))
        }
        formData.append('trapUnit', JSON.stringify(trap_unit))

        document.getElementById('resultsDiv').style.display = 'none'
        document.getElementById('loadingDiv').style.display = 'block'
        document.getElementById('loadingCircle').style.display = 'block'
        document.getElementById('statisticsErrors').innerHTML = ''

        resultsTab = document.getElementById('resultsTab')
        while(resultsTab.firstChild){
            resultsTab.removeChild(resultsTab.firstChild)
        }
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (reply.status == 'SUCCESS') {
                document.getElementById('loadingDiv').style.display = 'none'
                document.getElementById('loadingCircle').style.display = 'none'
                document.getElementById('resultsDiv').style.display = 'block'
                document.getElementById('btnExportResults').disabled = false
                document.getElementById('analysisSelector').disabled = false
                document.getElementById('statisticsErrors').innerHTML = ''

                resultsDiv = document.getElementById('resultsDiv')
                while(resultsDiv.firstChild){
                    resultsDiv.removeChild(resultsDiv.firstChild);
                }
                
                resultsTab = document.getElementById('resultsTab')
                while(resultsTab.firstChild){
                    resultsTab.removeChild(resultsTab.firstChild);
                }

                buildSummary(reply.summary)
            }
            else if (reply.status == 'FAILURE'){
                document.getElementById('loadingDiv').style.display = 'none'
                document.getElementById('loadingCircle').style.display = 'none'
                document.getElementById('resultsDiv').style.display = 'block'
                document.getElementById('btnExportResults').disabled = true

                resultsDiv = document.getElementById('resultsDiv')
                while(resultsDiv.firstChild){
                    resultsDiv.removeChild(resultsDiv.firstChild);
                }

                resultsTab = document.getElementById('resultsTab')
                while(resultsTab.firstChild){
                    resultsTab.removeChild(resultsTab.firstChild)
                }

                document.getElementById('statisticsErrors').innerHTML = 'An error occurred while running the analysis. Please try again.'
                document.getElementById('analysisSelector').disabled = false
            }
            else {
                setTimeout(function(){getSummary(true)}, 10000);
            }
        }
    }
    xhttp.open("POST", '/getResultsSummary');
    xhttp.send(formData);
}

function buildSummary(summary){
    /** Builds the summary div */
    var resultsDiv = document.getElementById('resultsDiv')
    var resultsTab = document.getElementById('resultsTab')

    // Create the tab buttons and tabs for summary results

    // Data summary tab
    var dataSummaryTabButton = document.createElement('button')
    dataSummaryTabButton.classList.add('tablinks')
    dataSummaryTabButton.classList.add('active')
    dataSummaryTabButton.innerHTML = 'Data Summary'
    resultsTab.appendChild(dataSummaryTabButton)

    var dataSummaryTab = document.createElement('div')
    dataSummaryTab.classList.add('tabcontent')
    dataSummaryTab.setAttribute('id', 'dataSummaryTab')
    dataSummaryTab.style.display = 'none'
    resultsDiv.appendChild(dataSummaryTab)

    dataSummaryTabButton.addEventListener('click', function(event){
        openResultsTab(event, 'dataSummaryTab', summary)
    });


    // Diversity tab

    var diversityTabButton = document.createElement('button')
    diversityTabButton.classList.add('tablinks')
    diversityTabButton.innerHTML = 'Diversity Indices'
    resultsTab.appendChild(diversityTabButton)

    var diversityTab = document.createElement('div')
    diversityTab.classList.add('tabcontent')
    diversityTab.setAttribute('id', 'diversityTab')
    diversityTab.style.display = 'none'
    resultsDiv.appendChild(diversityTab)

    diversityTabButton.addEventListener('click', function(event){
        openResultsTab(event, 'diversityTab', summary)
    });
    
    // Species abundance tab
    var abundanceTabButton = document.createElement('button')
    abundanceTabButton.classList.add('tablinks')
    abundanceTabButton.innerHTML = 'Species Abundance'
    resultsTab.appendChild(abundanceTabButton)

    var abundanceTab = document.createElement('div')
    abundanceTab.classList.add('tabcontent')
    abundanceTab.setAttribute('id', 'abundanceTab')
    abundanceTab.style.display = 'none'
    resultsDiv.appendChild(abundanceTab)

    abundanceTabButton.addEventListener('click', function(event){
        openResultsTab(event, 'abundanceTab', summary)
    });


    // Effort Days tab

    var effortDaysButton = document.createElement('button')
    effortDaysButton.classList.add('tablinks')
    effortDaysButton.innerHTML = 'Camera Trap Effort'
    resultsTab.appendChild(effortDaysButton)

    var effortDaysTab = document.createElement('div')
    effortDaysTab.classList.add('tabcontent')
    effortDaysTab.setAttribute('id', 'effortDaysTab')
    effortDaysTab.style.display = 'none'
    resultsDiv.appendChild(effortDaysTab)

    effortDaysButton.addEventListener('click', function(event){
        openResultsTab(event, 'effortDaysTab', summary)
    });
        

    // Camera Trap Data Counts tab

    var cameraTrapDataCountsButton = document.createElement('button')
    cameraTrapDataCountsButton.classList.add('tablinks')
    cameraTrapDataCountsButton.innerHTML = 'Camera Trap Data Counts'
    resultsTab.appendChild(cameraTrapDataCountsButton)

    var cameraTrapDataCountsTab = document.createElement('div')
    cameraTrapDataCountsTab.classList.add('tabcontent')
    cameraTrapDataCountsTab.setAttribute('id', 'cameraTrapDataCountsTab')
    cameraTrapDataCountsTab.style.display = 'none'
    resultsDiv.appendChild(cameraTrapDataCountsTab)

    cameraTrapDataCountsButton.addEventListener('click', function(event){
        openResultsTab(event, 'cameraTrapDataCountsTab', summary)
    });

    // Camera Trap Activity tab

    var cameraTrapActivityButton = document.createElement('button')
    cameraTrapActivityButton.classList.add('tablinks')
    cameraTrapActivityButton.innerHTML = 'Camera Trap Activity'
    resultsTab.appendChild(cameraTrapActivityButton)

    var cameraTrapActivityTab = document.createElement('div')
    cameraTrapActivityTab.classList.add('tabcontent')
    cameraTrapActivityTab.setAttribute('id', 'cameraTrapActivityTab')
    cameraTrapActivityTab.style.display = 'none'
    resultsDiv.appendChild(cameraTrapActivityTab)

    cameraTrapActivityButton.addEventListener('click', function(event){
        openResultsTab(event, 'cameraTrapActivityTab', summary)
    });


    dataSummaryTabButton.click()
}


function buildSummaryTab(summary, tab){
    /** Builds the summary div */

    // Create the tab buttons and tabs for summary results

    if (tab == 'dataSummaryTab') {
    // Data summary tab
        dataSummaryTab = document.getElementById('dataSummaryTab')
        if (dataSummaryTab.firstChild == null) {

            var row = document.createElement('div')
            row.classList.add('row')
            dataSummaryTab.appendChild(row)

            var col0 = document.createElement('div')
            col0.classList.add('col-lg-12')
            row.appendChild(col0)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Data Summary';
            h5.setAttribute('style','margin-bottom: 2px')
            col0.appendChild(h5);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following table shows the number of images, clusters and sightings for your surveys.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            col0.appendChild(h5)

            //Data summary table
            var table = document.createElement('table');
            table.id = 'summaryTable'
            table.style.borderCollapse = 'collapse';
            // table.classList.add('table');
            // // table.classList.add('table-sm');
            // table.classList.add('table-striped');
            // table.classList.add('table-bordered');
            // table.classList.add('table')
            table.classList.add('table-bordered')
            // table.classList.add('table-striped')
            table.classList.add('table-hover')
            var thead = table.createTHead();
            var tbody = table.createTBody();

            // Add the title row for column headers (Name, Description, Value)
            var titleRow = thead.insertRow();
            var nameTitleCell = titleRow.insertCell();
            nameTitleCell.innerHTML = 'Name';
            nameTitleCell.style.fontWeight = 'bold';
            // nameTitleCell.style.border = '1px solid rgba(0,0,0,0.2)';
            nameTitleCell.style.padding = '10px';

            var descTitleCell = titleRow.insertCell();
            descTitleCell.innerHTML = 'Description';
            descTitleCell.style.fontWeight = 'bold';
            // descTitleCell.style.border = '1px solid rgba(0,0,0,0.2)';
            descTitleCell.style.padding = '10px';
            
            var valueTitleCell = titleRow.insertCell();
            valueTitleCell.innerHTML = 'Value';
            valueTitleCell.style.fontWeight = 'bold';
            // valueTitleCell.style.border = '1px solid rgba(0,0,0,0.2)';
            valueTitleCell.style.padding = '10px';

            var data = summary.summary_counts

            for (var key in data) {
                var row = tbody.insertRow();
                var nameCell = row.insertCell();
                nameCell.innerHTML = key;
                // nameCell.style.border = '1px solid rgba(0,0,0,0.2)';
                nameCell.style.padding = '10px';
            
                var descCell = row.insertCell();
                descCell.innerHTML = data[key].description;
                // descCell.style.border = '1px solid rgba(0,0,0,0.2)';
                descCell.style.padding = '10px';
            
                var valueCell = row.insertCell();
                valueCell.innerHTML = data[key].value;
                // valueCell.style.border = '1px solid rgba(0,0,0,0.2)';
                valueCell.style.padding = '10px';
            }
            
            col0.appendChild(table);
        }
    }
    else if (tab == 'diversityTab') {
    // Diversity tab
        var diversityTab = document.getElementById('diversityTab')

        if (diversityTab.firstChild == null) {

            var row = document.createElement('div')
            row.classList.add('row')
            diversityTab.appendChild(row)

            var col1 = document.createElement('div')
            col1.classList.add('col-lg-12')
            row.appendChild(col1)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Diversity Indices';
            h5.setAttribute('style','margin-bottom: 2px')
            col1.appendChild(h5);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following indices are a measure of diversity in a community.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            col1.appendChild(h5)

            var table = document.createElement('table');
            table.id = 'diversityTable'
            table.style.borderCollapse = 'collapse';
            table.classList.add('table-hover')
            // table.classList.add('table')
            table.classList.add('table-bordered')
            // table.classList.add('table-striped')

            var thead = table.createTHead();
            var tbody = table.createTBody();
            
            // Add the title row for column headers (Name, Description, Value)
            var titleRow = thead.insertRow();
            var nameTitleCell = titleRow.insertCell();
            nameTitleCell.innerHTML = 'Name';
            nameTitleCell.style.fontWeight = 'bold';
            // nameTitleCell.style.border = '1px solid rgba(0,0,0,0.2)';
            nameTitleCell.style.padding = '10px';
            
            var descTitleCell = titleRow.insertCell();
            descTitleCell.innerHTML = 'Description';
            descTitleCell.style.fontWeight = 'bold';
            // descTitleCell.style.border = '1px solid rgba(0,0,0,0.2)';
            descTitleCell.style.padding = '10px';
            
            var valueTitleCell = titleRow.insertCell();
            valueTitleCell.innerHTML = 'Value';
            valueTitleCell.style.fontWeight = 'bold';
            // valueTitleCell.style.border = '1px solid rgba(0,0,0,0.2)';
            valueTitleCell.style.padding = '10px';
            
            data = summary.summary_indexes;
            
            for (var key in data) {
            var row = tbody.insertRow();
            var nameCell = row.insertCell();
            nameCell.innerHTML = key;
            // nameCell.style.border = '1px solid rgba(0,0,0,0.2)';
            nameCell.style.padding = '10px';
            
            var descCell = row.insertCell();
            descCell.innerHTML = data[key].description;
            // descCell.style.border = '1px solid rgba(0,0,0,0.2)';
            descCell.style.padding = '10px';
            
            var valueCell = row.insertCell();
            valueCell.innerHTML = data[key].value.toFixed(2);
            // valueCell.style.border = '1px solid rgba(0,0,0,0.2)';
            valueCell.style.padding = '10px';
            }
            
            col1.appendChild(table);
        }
    }
    else if (tab == 'abundanceTab') {
    // Species abundance tab
        var abundanceTab = document.getElementById('abundanceTab')

        if (abundanceTab.firstChild == null) {

            var row1 = document.createElement('div')
            row1.classList.add('row')
            abundanceTab.appendChild(row1)

            var col2 = document.createElement('div')
            col2.classList.add('col-lg-12')
            row1.appendChild(col2)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Species Abundance';
            h5.setAttribute('style','margin-bottom: 2px')
            col2.appendChild(h5);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following graph shows the abundance of each species in your data.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            col2.appendChild(h5)

            var rowc = document.createElement('div')
            rowc.classList.add('row')
            col2.appendChild(rowc)

            var col = document.createElement('div')
            col.classList.add('col-lg-12')
            col.setAttribute('style','padding:10px;margin:0px')
            rowc.appendChild(col)

            canvas = document.createElement('canvas')
            canvas.setAttribute('id','statisticsChart')
            canvas.setAttribute('style','width:100%;height:750px')
            col.appendChild(canvas)

            var ctx = document.getElementById('statisticsChart').getContext('2d');

            var species = []
            var abundance = []

            for (i=0;i<summary.species_count.length;i++) {
                if (summary.species_count[i]['count'] > 0) {
                    species.push(summary.species_count[i]['species'])
                    abundance.push(summary.species_count[i]['count'])
                }
            }

            var data = {
                datasets: [{
                    id: 'data-abundance',
                    data: abundance,
                    hoverBackgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,1)',
                    borderWidth: 1,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0,
                    backgroundColor: 'rgba(223, 105, 26, 0.6)',
                }],
                labels: species
            };

            var options_bar = {
                maintainAspectRatio: false,
                legend: {
                    display: false
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

            chart = new Chart(ctx, {
                data: data,
                type: 'bar',
                options: options_bar
            });
        }
    }
    else if (tab == 'effortDaysTab') {
        // Effort days  tab
        var effortDaysTab = document.getElementById('effortDaysTab')

        if (effortDaysTab.firstChild == null) {
            var row = document.createElement('div')
            row.classList.add('row')
            effortDaysTab.appendChild(row)

            var col = document.createElement('div')
            col.classList.add('col-lg-12')
            row.appendChild(col)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Effort Days';
            h5.setAttribute('style','margin-bottom: 2px')
            col.appendChild(h5);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following graph shows the total number of days that each site/camera was active.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            col.appendChild(h5)

            var row_ct1 = document.createElement('div')
            row_ct1.classList.add('row')
            effortDaysTab.appendChild(row_ct1)

            var col_ct1 = document.createElement('div')
            col_ct1.classList.add('col-lg-12')
            col_ct1.setAttribute('style','padding:10px;margin:0px')
            row_ct1.appendChild(col_ct1)

            row_ct1.appendChild(document.createElement('br'))

            var ct_canvas1 = document.createElement('canvas')	
            ct_canvas1.setAttribute('id','ct_canvas1')
            ct_canvas1.setAttribute('height','750')
            col_ct1.appendChild(ct_canvas1)

            // Effort Days
            var ctx1 = document.getElementById('ct_canvas1').getContext('2d');

            var effort_labels = []
            var effort_count = []
            for (i=0;i<summary.effort_days.length;i++) {
                if (summary.effort_days[i]['count'] > 0) {
                    effort_labels.push(summary.effort_days[i]['name'])
                    effort_count.push(summary.effort_days[i]['count'])
                }
            }

            var data1 = {
                datasets: [{
                    id: 'data-effort',
                    data: effort_count,
                    hoverBackgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,1)',
                    borderWidth: 1,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0,
                    backgroundColor: 'rgba(223, 105, 26, 0.6)',
                }],
                labels: effort_labels
            };

            var options_bar = {
                maintainAspectRatio: false,
                legend: {
                    display: false
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
            };

            chart1 = new Chart(ctx1, {
                data: data1,
                type: 'bar',
                options: options_bar
            });
        }
    }
    else if (tab == 'cameraTrapDataCountsTab') {

        // Camera trap data counts tab
        var cameraTrapDataCountsTab = document.getElementById('cameraTrapDataCountsTab')

        if (cameraTrapDataCountsTab.firstChild == null) {

            var row = document.createElement('div')
            row.classList.add('row')
            cameraTrapDataCountsTab.appendChild(row)

            var col = document.createElement('div')
            col.classList.add('col-lg-12')
            row.appendChild(col)

            var h5 = document.createElement('h5');
            h5.innerHTML = ' Data Unit Counts'; 
            h5.setAttribute('style','margin-bottom: 2px')
            col.appendChild(h5);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following graph shows the total cluster/image/sighting count of each site/camera.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            col.appendChild(h5)

            var row_ct2 = document.createElement('div')
            row_ct2.classList.add('row')
            cameraTrapDataCountsTab.appendChild(row_ct2)

            var col_ct2 = document.createElement('div')
            col_ct2.classList.add('col-lg-12')
            col_ct2.setAttribute('style','padding:10px;margin:0px')
            row_ct2.appendChild(col_ct2)

            row_ct2.appendChild(document.createElement('br'))

            var ct_canvas2 = document.createElement('canvas')
            ct_canvas2.setAttribute('id','ct_canvas2')
            ct_canvas2.setAttribute('height','750')
            col_ct2.appendChild(ct_canvas2)

            // Camera unit counts

            var ctx2 = document.getElementById('ct_canvas2').getContext('2d');

            var unit_labels = []
            var unit_count = []

            for (i=0;i<summary.unit_counts.length;i++) {
                if (summary.unit_counts[i]['count'] > 0) {
                    unit_labels.push(summary.unit_counts[i]['name'])
                    unit_count.push(summary.unit_counts[i]['count'])
                }
            }

            var data2 = {
                datasets: [{
                    id: 'data-camera',
                    data: unit_count,
                    hoverBackgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,1)',
                    borderWidth: 1,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0,
                    backgroundColor: 'rgba(223, 105, 26, 0.6)',
                }],
                labels: unit_labels
            };

            var options_bar = {
                maintainAspectRatio: false,
                legend: {
                    display: false
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
            };

            chart2 = new Chart(ctx2, {
                data: data2,
                type: 'bar',
                options: options_bar
            });

        }
    }
    else if (tab == 'cameraTrapActivityTab') {

        // Camera trap activity tab

        var cameraTrapActivityTab = document.getElementById('cameraTrapActivityTab')

        if (cameraTrapActivityTab.firstChild == null) {

            var row = document.createElement('div')
            row.classList.add('row')
            cameraTrapActivityTab.appendChild(row)

            var col = document.createElement('div')
            col.classList.add('col-lg-12')
            row.appendChild(col)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Active Days';
            h5.setAttribute('style','margin-bottom: 2px')
            col.appendChild(h5);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following graph indicates on which days each site/camera was active. The heatmap represents the image count of each site/camera on each day.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            col.appendChild(h5)

            var row_ct3 = document.createElement('div')
            row_ct3.classList.add('row')
            cameraTrapActivityTab.appendChild(row_ct3)

            var col_ct3 = document.createElement('div')
            col_ct3.classList.add('col-lg-12')
            col_ct3.setAttribute('style','padding:10px;margin:0px')
            row_ct3.appendChild(col_ct3)

            row_ct3.appendChild(document.createElement('br'))	

            var div_ct3 = document.createElement('div')
            div_ct3.setAttribute('id','div_ct3')
            div_ct3.setAttribute('style','height:750px')
            col_ct3.appendChild(div_ct3)

            // Camera active days
            var active_dict = summary.active_days.active_dict
            var start_date = summary.active_days.start_date
            var end_date = summary.active_days.end_date
            var unit_names = summary.active_days.unit_names

            var activeMap = new Map()
            for (let i=0; i < active_dict.length; i++) {
                const {name, date, count} = active_dict[i]
                const dateKey = date.split('T')[0]
                activeMap.set(name + dateKey, count)
            }

            start_date = start_date.split('T')[0] + ' 00:00:00'
            end_date = end_date.split('T')[0] + ' 23:59:59'

            date_labels = []
            var date = new Date(start_date)
            while (date <= new Date(end_date)) {
                date_labels.push(new Date(date))
                date.setDate(date.getDate() + 1)
            }

            var active_data = []
            for (let i=0; i < unit_names.length; i++) {
                var unit_data = []
                for (let j=0; j < date_labels.length; j++) {
                    var count = null
                    var dateKey = date_labels[j].toISOString().split('T')[0]
                    if (activeMap.has(unit_names[i] + dateKey)) {
                        count = activeMap.get(unit_names[i] + dateKey)
                    }
                    unit_data.push(count)
                }
                active_data.push(unit_data)
            }


            var plot_active_data = [{
                type: 'heatmap',
                y: unit_names,
                x: date_labels,
                z: active_data,
                colorscale: 'Jet',
                showscale: true,
                hoverongaps: false
            }];

            var layout = {
                paper_bgcolor: 'rgb(78,93,108)',
                plot_bgcolor: 'rgb(78,93,108',
                font : {
                    color: textColour
                },
                xaxis: {
                    gridcolor: axisColour,
                },
                yaxis: {
                    gridcolor: axisColour,
                    automargin: true
                },
                margin: {
                    l: 40,
                    r: 40,
                    b: 40,
                    t: 40,
                    pad: 0
                }
            }

            Plotly.newPlot('div_ct3', plot_active_data, layout);

        }
    }

}


function buildCovariates(){
    /** Builds the covariates modal for occuancy analysis  */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    var siteCovariatesDiv = document.getElementById('siteCovariatesDiv')
    var detectionCovariatesDiv = document.getElementById('detectionCovariatesDiv')
    document.getElementById('covariatesError').innerHTML = ''
    var siteCovariatesExtraDiv = document.getElementById('siteCovariatesExtraDiv')
    var detectionCovariatesExtraDiv = document.getElementById('detectionCovariatesExtraDiv')

    while(siteCovariatesDiv.firstChild){
        siteCovariatesDiv.removeChild(siteCovariatesDiv.firstChild);
    }

    while(detectionCovariatesDiv.firstChild){
        detectionCovariatesDiv.removeChild(detectionCovariatesDiv.firstChild);
    }

    while(siteCovariatesExtraDiv.firstChild){
        siteCovariatesExtraDiv.removeChild(siteCovariatesExtraDiv.firstChild);
    }

    while(detectionCovariatesExtraDiv.firstChild){
        detectionCovariatesExtraDiv.removeChild(detectionCovariatesExtraDiv.firstChild);
    }

    var sites = getSelectedSites(true)
    // console.log(sites)
    if (sites == '0'){
        sites = []
        for (let i=0; i<globalSites.length; i++){
            let split = globalSites[i].split(' ')
            let site = split[0] + '_' + split[1].split('(')[1].split(',')[0] + '_' + split[2].split(')')[0]
            sites.push(site)
        }
    }
    else{
        for (let i=0; i<sites.length; i++){
            // sites[i] = sites[i].replace('/,','_')
            // replace all commas with underscores
            sites[i] = sites[i].replace(/,/g,'_')
        }
    }
    // console.log(sites)

    // Site covariates
    var table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.width = '100%'
    table.style.tableLayout = 'fixed'
    table.id = 'siteCovariatesTable'
    siteCovariatesDiv.appendChild(table)

    var thead = document.createElement('thead')
    table.appendChild(thead)

    var tr = document.createElement('tr')
    thead.appendChild(tr)

    var th = document.createElement('th')
    th.innerHTML = 'Covariates'
    th.style.width = '250px'
    tr.appendChild(th)

    for (let i = 0; i < sites.length; i++) {
        var th = document.createElement('th')
        th.innerHTML = sites[i].split('_')[0]
        th.style.width = '150px'
        tr.appendChild(th)
    }

    var tbody = document.createElement('tbody')
    table.appendChild(tbody)


    // Site covariates Extra table
    var table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.width = '100%'
    // table.style.tableLayout = 'fixed'
    table.id = 'siteCovariatesTableExtra'
    siteCovariatesExtraDiv.appendChild(table)

    var thead = document.createElement('thead')
    table.appendChild(thead)

    var tr = document.createElement('tr')
    thead.appendChild(tr)

    var th = document.createElement('th')
    th.innerHTML = 'Type'
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Scale'
    tr.appendChild(th)

    var tbody = document.createElement('tbody')
    table.appendChild(tbody)


    // Detection covariates
    var table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.width = '100%'
    table.style.tableLayout = 'fixed'
    table.id = 'detectionCovariatesTable'
    detectionCovariatesDiv.appendChild(table)
    
    var thead = document.createElement('thead')
    table.appendChild(thead)

    var tr = document.createElement('tr')
    thead.appendChild(tr)

    var th = document.createElement('th')
    th.innerHTML = 'Covariates'
    th.style.width = '250px'

    tr.appendChild(th)

    for (let i = 0; i < sites.length; i++) {
        var th = document.createElement('th')
        th.style.width = '150px'
        th.innerHTML = sites[i].split('_')[0]
        tr.appendChild(th)
    }

    var tbody = document.createElement('tbody')
    table.appendChild(tbody)


    // Detection covariates Extra table
    var table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.width = '100%'
    // table.style.tableLayout = 'fixed'
    table.id = 'detectionCovariatesTableExtra'
    detectionCovariatesExtraDiv.appendChild(table)

    var thead = document.createElement('thead')
    table.appendChild(thead)

    var tr = document.createElement('tr')
    thead.appendChild(tr)

    var th = document.createElement('th')
    th.innerHTML = 'Type'
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Scale'
    tr.appendChild(th)

    var tbody = document.createElement('tbody')
    table.appendChild(tbody)



    if (globalSiteCovariates.length > 0){
        fillCovariatesTable('site', sites)
    }


    if (globalDetectionCovariates.length > 0){
        fillCovariatesTable('detection', sites)
    }

    if (analysisSelection == '6'){
        document.getElementById('detCovDiv').hidden = false
        document.getElementById('iDetCovDiv').hidden = false
    }
    else if (analysisSelection == '7'){
        document.getElementById('detCovDiv').hidden = true
        document.getElementById('iDetCovDiv').hidden = true
    }

    modalCovariates.modal({keyboard: true})

}

function fillCovariatesTable(type, sites){
    /** Fills the covariates table with the global covariates */
    if (type == 'site'){
        var table = document.getElementById('siteCovariatesTable')
        var tableR = document.getElementById('siteCovariatesTableExtra')
        var covariates = globalSiteCovariates
    }
    else {
        var table = document.getElementById('detectionCovariatesTable')
        var tableR = document.getElementById('detectionCovariatesTableExtra')
        var covariates = globalDetectionCovariates
    }
    var options = globalCovariateOptions
    var tbody = table.getElementsByTagName('tbody')[0]
    var tbodyR = tableR.getElementsByTagName('tbody')[0]

    for (let i = 0; i < covariates.length; i++) {
        var tr = document.createElement('tr')
        tbody.appendChild(tr)

        var td = document.createElement('td')
        var input = document.createElement('input')
        input.setAttribute('class','form-control')
        input.setAttribute('type','text')
        input.setAttribute('style','width:100%')
        input.value = covariates[i]['covariate']
        td.appendChild(input)
        tr.appendChild(td)

        for (let j = 0; j < sites.length; j++) {
            var td = document.createElement('td')
            td.style.width = '150px'
            var input = document.createElement('input')
            input.setAttribute('class','form-control')
            input.setAttribute('type','text')
            input.setAttribute('id',type + 'cov@' + sites[j])
            input.classList.add(sites[j])
            input.setAttribute('style','width:100%')
            if (covariates[i][sites[j]] != undefined){
                input.value = covariates[i][sites[j]]
            }
            td.appendChild(input)
            tr.appendChild(td)
        }

        idx_options = options.findIndex(x => x['covariate'] == covariates[i]['covariate'])
        var tr = document.createElement('tr')
        tbodyR.appendChild(tr)

        var td = document.createElement('td')
        var select = document.createElement('select')
        select.setAttribute('class','form-control')
        select.setAttribute('style','width:100%')
    
        var sOptions = ['Numeric','Categorical']
        var sTexts = ['Numeric','Categorical']
    
        clearSelect(select)
        fillSelect(select,sOptions,sTexts)

        select.value = options[idx_options]['type']

        td.appendChild(select)
        tr.appendChild(td)
    
        var td = document.createElement('td')
        var select = document.createElement('select')
        select.setAttribute('class','form-control')
        select.setAttribute('style','width:100%')
    
        var sOptions = ['No','Yes']
        var sTexts = ['No','Yes']
    
        clearSelect(select)
        fillSelect(select,sOptions,sTexts)

        select.value = options[idx_options]['scale']

        td.appendChild(select)
        tr.appendChild(td)


        var td = document.createElement('td')
        var button = document.createElement('button')
        button.setAttribute('class','btn btn-info')
        button.setAttribute('onclick','removeCovariateRow(this,\'' + type + '\')')
        button.innerHTML = '&times;'
        td.appendChild(button)
        tr.appendChild(td)

    }

}

function buildCovRow(type){
    /** Builds a row in the site covariates table*/
    if (type == 'site'){
        var table = document.getElementById('siteCovariatesTable')
        var tableR = document.getElementById('siteCovariatesTableExtra')
    } else {
        var table = document.getElementById('detectionCovariatesTable')
        var tableR = document.getElementById('detectionCovariatesTableExtra')
    }
    var tbody = table.getElementsByTagName('tbody')[0]
    var tr = document.createElement('tr')
    tbody.appendChild(tr)

    var td = document.createElement('td')
    var input = document.createElement('input')
    input.setAttribute('class','form-control')
    input.setAttribute('type','text')
    input.setAttribute('style','width:100%')

    td.appendChild(input)
    tr.appendChild(td)

    var sites = getSelectedSites(true)
    if (sites == '0'){
        sites = []
        for (let i=0; i<globalSites.length; i++){
            let split = globalSites[i].split(' ')
            let site = split[0] + '_' + split[1].split('(')[1].split(',')[0] + '_' + split[2].split(')')[0]
            sites.push(site)
        }
    }
    else{
        for (let i=0; i<sites.length; i++){
            // sites[i] = sites[i].replace(',','_')
            sites[i] = sites[i].replace(/,/g,'_')
        }
    }

    for (let i = 0; i < sites.length; i++) {
        var td = document.createElement('td')
        td.style.width = '150px'
        var input = document.createElement('input')
        input.setAttribute('class','form-control')
        input.setAttribute('type','text')
        input.setAttribute('id','cov@' + sites[i])
        input.classList.add(sites[i])
        input.setAttribute('style','width:100%')
        td.appendChild(input)
        tr.appendChild(td)
    }

    var tbodyR = tableR.getElementsByTagName('tbody')[0]    
    var tr = document.createElement('tr')
    tbodyR.appendChild(tr)

    var td = document.createElement('td')
    var select = document.createElement('select')
    select.setAttribute('class','form-control')
    select.setAttribute('style','width:100%')

    sOptions = ['Numeric','Categorical']
    sTexts = ['Numeric','Categorical']

    clearSelect(select)
    fillSelect(select,sOptions,sTexts)
    td.appendChild(select)
    tr.appendChild(td)

    var td = document.createElement('td')
    var select = document.createElement('select')
    select.setAttribute('class','form-control')
    select.setAttribute('style','width:100%')

    sOptions = ['No','Yes']
    sTexts = ['No','Yes']

    clearSelect(select)
    fillSelect(select,sOptions,sTexts)
    td.appendChild(select)
    tr.appendChild(td)

    var td = document.createElement('td')
    var button = document.createElement('button')
    button.setAttribute('class','btn btn-info')
    button.setAttribute('onclick','removeCovariateRow(this,\'' + type + '\')')
    button.innerHTML = '&times;'
    td.appendChild(button)
    tr.appendChild(td)

    
}

function removeCovariateRow(button, type){
    /** Removes a row from the covariates table */

    // Remove button from button table first

    var row = button.parentNode.parentNode
    row_index = row.rowIndex
    row.parentNode.removeChild(row)

    // Romove row from covariate table
    if (type == 'site'){
        var table = document.getElementById('siteCovariatesTable')
    }
    else {
        var table = document.getElementById('detectionCovariatesTable')
    }

    var tbody = table.getElementsByTagName('tbody')[0]
    var rows = tbody.getElementsByTagName('tr')
    var row = rows[row_index-1]
    row.parentNode.removeChild(row)

}

function saveCovariates(){
    /** Saves the covariates to the global variables */
    var valid = validateCovariates()
    // valid = true
    if (valid){
        
        var siteCovariates = []
        var detectionCovariates = []
        var covariateOptions = []

        var siteCovariatesTable = document.getElementById('siteCovariatesTable')
        var detectionCovariatesTable = document.getElementById('detectionCovariatesTable')
        var siteCovariatesTableExtra = document.getElementById('siteCovariatesTableExtra')
        var detectionCovariatesTableExtra = document.getElementById('detectionCovariatesTableExtra')

        var siteCovariatesRows = siteCovariatesTable.getElementsByTagName('tr')
        var detectionCovariatesRows = detectionCovariatesTable.getElementsByTagName('tr')
        var siteCovariatesRowsExtra = siteCovariatesTableExtra.getElementsByTagName('tr')
        var detectionCovariatesRowsExtra = detectionCovariatesTableExtra.getElementsByTagName('tr')

        var tableExtraHeadings = ['type', 'scale']

        for (let i = 0; i < siteCovariatesRows.length; i++) {
            var row = siteCovariatesRows[i]
            var cells = row.getElementsByTagName('td')
            if (cells.length > 0){
                var covariate = cells[0].getElementsByTagName('input')[0].value.trim()
                var siteCovariate = {}
                siteCovariate['covariate'] = covariate
                for (let j = 1; j < cells.length; j++) {
                    var site = cells[j].getElementsByTagName('input')[0].id.split('@')[1]
                    var value = cells[j].getElementsByTagName('input')[0].value
                    siteCovariate[site] = value
                }
                siteCovariates.push(siteCovariate)
                
                var rowExtra = siteCovariatesRowsExtra[i]
                var cellsExtra = rowExtra.getElementsByTagName('td')
                var covariateOption = {}
                covariateOption['covariate'] = covariate
                for (let j = 0; j < cellsExtra.length -1 ; j++) {
                    var option = cellsExtra[j].getElementsByTagName('select')[0].value
                    covariateOption[tableExtraHeadings[j]] = option
                }
                covariateOptions.push(covariateOption)

            }
        }

        for (let i = 0; i < detectionCovariatesRows.length; i++) {
            var row = detectionCovariatesRows[i]
            var cells = row.getElementsByTagName('td')
            if (cells.length > 0){
                var covariate = cells[0].getElementsByTagName('input')[0].value.trim()
                var detectionCovariate = {}
                detectionCovariate['covariate'] = covariate
                for (let j = 1; j < cells.length; j++) {
                    var site = cells[j].getElementsByTagName('input')[0].id.split('@')[1]
                    var value = cells[j].getElementsByTagName('input')[0].value
                    detectionCovariate[site] = value
                }
                detectionCovariates.push(detectionCovariate)

                var rowExtra = detectionCovariatesRowsExtra[i]
                var cellsExtra = rowExtra.getElementsByTagName('td')
                var covariateOption = {}
                covariateOption['covariate'] = covariate
                for (let j = 0; j < cellsExtra.length -1 ; j++) {
                    var option = cellsExtra[j].getElementsByTagName('select')[0].value
                    covariateOption[tableExtraHeadings[j]] = option
                }
                covariateOptions.push(covariateOption)
            }
        }

        globalSiteCovariates = siteCovariates
        globalDetectionCovariates = detectionCovariates
        globalCovariateOptions = covariateOptions

        modalCovariates.modal('hide')
    } 
}

function validateCovariates(){
    /** Validates the covariates by checking if any cells are empty and cov inputs are numeric*/
    var siteCovariatesTable = document.getElementById('siteCovariatesTable')
    var detectionCovariatesTable = document.getElementById('detectionCovariatesTable')
    var siteCovariatesTableExtra = document.getElementById('siteCovariatesTableExtra')
    var detectionCovariatesTableExtra = document.getElementById('detectionCovariatesTableExtra')

    var siteCovariatesRows = siteCovariatesTable.getElementsByTagName('tr')
    var detectionCovariatesRows = detectionCovariatesTable.getElementsByTagName('tr')
    var siteCovariatesRowsExtra = siteCovariatesTableExtra.getElementsByTagName('tr')
    var detectionCovariatesRowsExtra = detectionCovariatesTableExtra.getElementsByTagName('tr')

    var emptyCells = false
    var notNumeric = false
    var cannotScale = false
    var duplicateCovariates = false
    var covariateNames = []

    var error = ''

    for (let i = 1; i < siteCovariatesRows.length; i++) {
        var row = siteCovariatesRows[i]
        var cells = row.getElementsByTagName('td')
        var rowExtra = siteCovariatesRowsExtra[i]
        var cellsExtra = rowExtra.getElementsByTagName('td')
        var type = cellsExtra[0].getElementsByTagName('select')[0].value
        var scale = cellsExtra[1].getElementsByTagName('select')[0].value

        if (type == 'Categorical' && scale == 'Yes'){
            cannotScale = true
        }

        if (cells.length > 0){
            for (let j = 0; j < cells.length ; j++) {
                if (cells[j].getElementsByTagName('input')[0].id != undefined  && cells[j].getElementsByTagName('input')[0].id.includes('cov@')){
                    var value = cells[j].getElementsByTagName('input')[0].value
                    if (value == ''){
                        emptyCells = true
                    }
                    else if (type == 'Numeric' && isNaN(value)){
                        notNumeric = true
                    }
                }
                else{
                    var value = cells[j].getElementsByTagName('input')[0].value
                    if (value == ''){
                        emptyCells = true
                    }
                    else{
                        if (covariateNames.includes(value)){
                            duplicateCovariates = true
                        }
                        else{
                            covariateNames.push(value)
                        }
                    }
                }
            }
        }
    }

    for (let i = 1; i < detectionCovariatesRows.length; i++) {
        var row = detectionCovariatesRows[i]
        var cells = row.getElementsByTagName('td')
        var rowExtra = detectionCovariatesRowsExtra[i]
        var cellsExtra = rowExtra.getElementsByTagName('td')
        var type = cellsExtra[0].getElementsByTagName('select')[0].value
        var scale = cellsExtra[1].getElementsByTagName('select')[0].value

        if (type == 'Categorical' && scale == 'Yes'){
            cannotScale = true
        }

        if (cells.length > 0){
            for (let j = 0; j < cells.length ; j++) {
                if (cells[j].getElementsByTagName('input')[0].id != undefined  && cells[j].getElementsByTagName('input')[0].id.includes('cov@')){
                    var value = cells[j].getElementsByTagName('input')[0].value
                    if (value == ''){
                        emptyCells = true
                    }
                    else if (type == 'Numeric' && isNaN(value)){
                        notNumeric = true
                    }

                }
                else{
                    var value = cells[j].getElementsByTagName('input')[0].value
                    if (value == ''){
                        emptyCells = true
                    }
                    else{
                        if (covariateNames.includes(value)){
                            duplicateCovariates = true
                        }
                        else{
                            covariateNames.push(value)
                        }
                    }
                }
            }
        }
    }

    if (emptyCells){
        error = 'Please ensure all cells are filled. '
    }
    
    if (notNumeric){
        error += 'Please ensure all covariates which are of type Numeric contain only numeric values. '
    }

    if (duplicateCovariates){
        error += 'Please ensure all covariate names are unique. '
    }

    if (cannotScale){
        error += 'Categorical covariates cannot be scaled. Please ensure all categorical covariates are not scaled.'
    }

    if (emptyCells || notNumeric || duplicateCovariates || cannotScale){
        document.getElementById('covariatesError').innerHTML = error
        return false
    }
    else{
        document.getElementById('covariatesError').innerHTML = ''
        return true
    }

}

function updateOccupancy(check=false){
    /** Updates the occupancy results */
    if (check) {
        var species = '0'
        var validOccupancy = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var observationWindow = document.getElementById('observationWindow').value


        var validOccupancy = checkOccupancy(observationWindow, globalSiteCovariates, globalDetectionCovariates)
    
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('detCovs', JSON.stringify(globalDetectionCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validOccupancy) {

        if (!check) {
            document.getElementById('resultsDiv').style.display = 'none'
            document.getElementById('loadingDiv').style.display = 'block'
            document.getElementById('loadingCircle').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a while to run. Please do not navigate away from this page until the analysis has completed.'

            resultsTab = document.getElementById('resultsTab')
            while(resultsTab.firstChild){
                resultsTab.removeChild(resultsTab.firstChild)
            }
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    results = reply.results
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('analysisSelector').disabled = false
                    document.getElementById('statisticsErrors').innerHTML = ''
                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }
                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }
                    buildOccupancyTabs(results)
                    // buildOccupancyResults(results)

                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'

                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }

                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }

                    document.getElementById('statisticsErrors').innerHTML = 'An error occurred while running the analysis. Please ensure that your selected analysis options are valid and try again.'
                    document.getElementById('analysisSelector').disabled = false
                }
                else {
                    setTimeout(function(){updateOccupancy(true)}, 10000);
                }

            }
        }
        xhttp.open("POST", '/getOccupancy');
        xhttp.send(formData);

    }

}


function getOccupancyCSV(check=false){
    /** Updates the activity chart  */
    if (check) {
        var species = '0'
        var validOccupancy = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var observationWindow = document.getElementById('observationWindow').value


        var validOccupancy = checkOccupancy(observationWindow, globalSiteCovariates, globalDetectionCovariates)
    
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('detCovs', JSON.stringify(globalDetectionCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validOccupancy) {

        document.getElementById('rErrors').innerHTML = 'Downloading CSV...'

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    csv_urls = reply.csv_urls
                    downloadCSV(csv_urls)      
                    document.getElementById('rErrors').innerHTML = ''
                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                }
                else {
                    setTimeout(function(){getOccupancyCSV(true)}, 10000);
                }

            }
        }
        xhttp.open("POST", '/getOccupancyCSV');
        xhttp.send(formData);

    }
}

async function downloadCSV(csv_urls){
    /** Downloads the CSVs */
    for (var i=0; i<csv_urls.length; i++){
        csv_url = csv_urls[i]
        filename = csv_url.split('/')[csv_url.split('/').length-1]

        var link = document.createElement('a');
        link.setAttribute('download', filename);
        link.setAttribute('href', csv_url);
        link.click();

        // Add a delay to allow the csv to download (otherwise it will only download the last csv)
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
}

function buildOccupancyTabs(results){
    // Builds the occupancy tabs 
    var resultsDiv = document.getElementById('resultsDiv')
    var resultsTab = document.getElementById('resultsTab')

    var btnSummaryOccuTab = document.createElement('button')
    btnSummaryOccuTab.classList.add('tablinks')
    btnSummaryOccuTab.classList.add('active')
    btnSummaryOccuTab.innerHTML = 'Summary'
    resultsTab.appendChild(btnSummaryOccuTab)

    var summaryOccuTab = document.createElement('div')
    summaryOccuTab.classList.add('tabcontent')
    summaryOccuTab.setAttribute('id', 'summaryOccuTab')
    summaryOccuTab.style.display = 'none'
    resultsDiv.appendChild(summaryOccuTab)

    btnSummaryOccuTab.addEventListener('click', function(event){
        openResultsTab(event, 'summaryOccuTab', results)
    });

    if (results.model_formula == "~1 ~ 1"){
        var btnNullOccuTab = document.createElement('button')
        btnNullOccuTab.classList.add('tablinks')
        btnNullOccuTab.innerHTML = 'Covariates: None'
        resultsTab.appendChild(btnNullOccuTab)

        var nullOccuTab = document.createElement('div')
        nullOccuTab.classList.add('tabcontent')
        nullOccuTab.setAttribute('id', 'occuTab_' + results.model_formula)
        nullOccuTab.style.display = 'none'
        resultsDiv.appendChild(nullOccuTab)

        btnNullOccuTab.addEventListener('click', function(event){
            var tabName = 'occuTab_' + results.model_formula
            openResultsTab(event, tabName, results)
        });
    }
    else{
        for (let i = 0; i < results.occu_files.length; i++){
            var btnOccuTab = document.createElement('button')
            btnOccuTab.classList.add('tablinks')
            btnOccuTab.innerHTML = 'Covariate: ' + results.occu_files[i].name
            resultsTab.appendChild(btnOccuTab)

            var occuTab = document.createElement('div')
            occuTab.classList.add('tabcontent')
            occuTab.setAttribute('id', 'occuTab_' + results.occu_files[i].name)
            occuTab.style.display = 'none'
            resultsDiv.appendChild(occuTab)

            btnOccuTab.addEventListener('click', function(event){
                tabName = 'occuTab_' + results.occu_files[i].name
                openResultsTab(event, tabName, results)
            });
        }
    }

    btnSummaryOccuTab.click()

}

function buildOccupancyResults(results, tab){
    /** Builds the occupancy results */

    if (tab == 'summaryOccuTab'){
        var summaryOccuTab = document.getElementById('summaryOccuTab')
        if (summaryOccuTab.firstChild == null){
            var occu_files = results.occu_files
            var naive_occupancy = results.naive_occupancy
            naive_occupancy = Math.round(naive_occupancy * 1000) / 1000
            var model_formula = results.model_formula
            var total_sites = results.total_sites
            var total_sites_occupied = results.total_sites_occupied

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Occupancy Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summaryOccuTab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays a summary of the occupancy analysis for the selected species. Naive occupancy is the proportion of sites occupied by the species. The best model formula is the covariate formula that best explains the occupancy of the species. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create table to display naive occupancy and model formula
            var table = document.createElement('table')
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            // table.classList.add('border-collapse')
            table.style.borderCollapse = 'collapse';


            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            var th = document.createElement('th')
            th.innerHTML = 'Total Sites'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Total Sites Occupied'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Naive Occupancy'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Best Model Formula'
            tr.appendChild(th)

            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            var tr = document.createElement('tr')
            tbody.appendChild(tr)

            var td = document.createElement('td')
            td.innerHTML = total_sites
            tr.appendChild(td)

            var td = document.createElement('td')
            td.innerHTML = total_sites_occupied
            tr.appendChild(td)

            var td = document.createElement('td')
            td.innerHTML = naive_occupancy
            tr.appendChild(td)

            model_formula = model_formula.split('~')
            for (let i = 0; i < model_formula.length; i++){
                if (model_formula[i].includes('1')){
                    model_formula[i] = 'None'
                }
            }
            var new_model_formula = 'Det covs: ' + model_formula[1] + ' | ' + 'Site covs: ' + model_formula[2]
            var td = document.createElement('td')
            td.innerHTML = new_model_formula
            tr.appendChild(td)

            summaryOccuTab.appendChild(table)


            // // Create table to display AIC results
            // var table = document.createElement('table')
            // table.classList.add('table')
            // table.classList.add('table-bordered')
            // table.classList.add('table-striped')
            // table.classList.add('table-hover')
            // table.classList.add('border-collapse')
            summaryOccuTab.appendChild(document.createElement('br'))

            aic = results.aic

            var h5 = document.createElement('h5')
            h5.innerHTML = 'AICc Results'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summaryOccuTab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the AICc results for the best model selection. The best model is the model with the lowest AICc value. The delta AICc is the difference between the best model and the other models. The weight is the probability that the model is the best model. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // var thead = document.createElement('thead')
            // table.appendChild(thead)

            // var tr = document.createElement('tr')
            // thead.appendChild(tr)

            // for (let i=0; i<aic.length; i++){
            //     var th = document.createElement('th')
            //     th.innerHTML = aic[i][0]
            //     tr.appendChild(th)
            // }

            // var tbody = document.createElement('tbody')
            // table.appendChild(tbody)

            // for (let i=0; i<aic[0][1].length; i++){
            //     var tr = document.createElement('tr')
            //     tbody.appendChild(tr)

            //     for (let j=0; j<aic.length; j++){
            //         var td = document.createElement('td')
            //         td.innerHTML = aic[j][1][i]
            //         tr.appendChild(td)
            //     }
            // }

            // resultsDiv.appendChild(table)

            // Create a single table to display all AIC results
            var table = document.createElement('table');
            table.classList.add('table');
            table.classList.add('table-bordered');
            table.classList.add('table-striped');
            table.classList.add('table-hover');
            // table.classList.add('border-collapse');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';


            var keys = Object.keys(aic[0]); // Assuming all aic objects have the same keys

            // Create table header
            var thead = document.createElement('thead');
            table.appendChild(thead);

            var tr = document.createElement('tr');
            thead.appendChild(tr);

            for (let i = 0; i < keys.length; i++) {
                var th = document.createElement('th');
                th.innerHTML = keys[i];
                tr.appendChild(th);
            }

            // Create table body
            var tbody = document.createElement('tbody');
            table.appendChild(tbody);

            // Loop through each aic result and create table rows
            for (let i = 0; i < aic.length; i++) {
                var result = aic[i];
                var trBody = document.createElement('tr');
                tbody.appendChild(trBody);

                for (let j = 0; j < keys.length; j++) {
                    var td = document.createElement('td');
                    var value = result[keys[j]]

                    if (keys[j] == 'K'){
                        td.innerHTML = value.toFixed(0)
                    }
                    else if (keys[j] == 'Modnames'){
                        value = value.replace(/\s/g, '')
                        formula = value.split('~')
                        // console.log(formula)
                        for (let k=0; k<formula.length; k++){
                            if (formula[k].includes('1')){
                                formula[k] = 'None'
                            }
                        }
                        td.innerHTML = 'Det Covs: ' + formula[1] + ' | ' + 'Site Covs: ' + formula[2]
                        
                    }
                    else {
                        td.innerHTML = value.toFixed(4)
                    }
                    
                    trBody.appendChild(td);
                }
            }

            // Append the table to the resultsDiv element
            summaryOccuTab.appendChild(table);

            summaryOccuTab.appendChild(document.createElement('br'))

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Best Model Occupancy Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summaryOccuTab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the occupancy estimate summary for the selected best model. The occupancy estimate is the probability that a site is occupied given that the species is present. Please note the values are in logit scale. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create a table to display the model summaries
            var table = document.createElement('table')
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            // table.classList.add('border-collapse')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'
            
            best_model_summary_state = results.best_model_summary_state

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(best_model_summary_state[0]) // Assuming all model summaries have the same keys

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            // Loop through each model summary and create table rows
            for (let i=0; i<best_model_summary_state.length; i++){
                var model_summary = best_model_summary_state[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = model_summary[keys[j]]
                    if (isNaN(value)){
                        td.innerHTML = value
                    } else {
                        td.innerHTML = value.toFixed(4)
                    }
                    trBody.appendChild(td)
                }
            }

            // Append the table to the resultsDiv element
            summaryOccuTab.appendChild(table)

            summaryOccuTab.appendChild(document.createElement('br'))

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Best Model Detection Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summaryOccuTab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the detection estimate summary for the selected best model. The detection estimate is the probability that the species is detected given that the species is present. Please note the values are in logit scale.</i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create a table to display the model summaries
            var table = document.createElement('table')
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            // table.classList.add('border-collapse')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'


            best_model_summary_det = results.best_model_summary_det

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(best_model_summary_det[0]) // Assuming all model summaries have the same keys

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            // Loop through each model summary and create table rows
            for (let i=0; i<best_model_summary_det.length; i++){
                var model_summary = best_model_summary_det[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = model_summary[keys[j]]
                    if (isNaN(value)){
                        td.innerHTML = value
                    } else {
                        td.innerHTML = value.toFixed(4)
                    }
                    trBody.appendChild(td)
                }
            }

            // Append the table to the resultsDiv element
            summaryOccuTab.appendChild(table)

        }
    }
    else {
        var occuTab = document.getElementById(tab)
        // Only split the first underscore
        var split = tab.split('_')
        split.shift()
        var cov_name = split.join('_')
        var occu_files = results.occu_files
        var cov_idx = 0
        for (let i=0; i<occu_files.length; i++){
            if (occu_files[i].name == cov_name){
                cov_idx = i
                break
            }
        }
        

        while(occuTab.firstChild){
            occuTab.removeChild(occuTab.firstChild)
        }

        var h5 = document.createElement('h5')
        if (cov_name == '~1 ~ 1'){
            h5.innerHTML = 'Covariate Results: No Covariates'
        } else {
            h5.innerHTML = 'Covariate Results: ' + cov_name
        }
        h5.setAttribute('style','margin-bottom: 2px')
        occuTab.appendChild(h5)

        // Create a radio button to select the type of graph
        var divRadio = document.createElement('div')
        divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');
        
        var radio = document.createElement('input')
        radio.setAttribute('type', 'radio')
        radio.setAttribute('id', 'siteProbGraph_' + cov_name)
        radio.setAttribute('name', 'occuGraph_' + cov_name)
        radio.setAttribute('class', 'custom-control-input')
        radio.setAttribute('value', '0')
        radio.checked = true
        divRadio.appendChild(radio)
            
        var label = document.createElement('label')
        label.setAttribute('class', 'custom-control-label')
        label.setAttribute('for', 'siteProbGraph_' + cov_name)
        if (cov_name == '~1 ~ 1'){
            label.innerHTML = 'Occupancy Probability Plot per Site'
        }
        else {
            label.innerHTML = 'Probability Plot per Site'
        }
        divRadio.appendChild(label)
        
        occuTab.appendChild(divRadio)

        divRadio = document.createElement('div')
        divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');

        radio = document.createElement('input')
        radio.setAttribute('type', 'radio')
        radio.setAttribute('id', 'covarProbGraph_' + cov_name)
        radio.setAttribute('name', 'occuGraph_' + cov_name)
        radio.setAttribute('class', 'custom-control-input')
        radio.setAttribute('value', '1')
        divRadio.appendChild(radio)

        label = document.createElement('label')
        label.setAttribute('class', 'custom-control-label')
        label.setAttribute('for', 'covarProbGraph_' + cov_name)
        if (cov_name == '~1 ~ 1'){
            label.innerHTML = 'Detection Probability Plot per Site'
        }
        else {
            label.innerHTML = 'Covariate Probability Plot'
        }
        divRadio.appendChild(label)

        occuTab.appendChild(divRadio)

        // EVent listener for the radio buttons
        radio = document.getElementById('siteProbGraph_' + cov_name)
        radio.addEventListener('change', function(occuFiles){
            // Set active image on map to be the first image
            return function(){
                if (this.checked){
                    // Display correct heading
                    var headingDiv = document.getElementById('headingDiv_' + occuFiles.name + '_site')
                    headingDiv.style.display = 'block'
                    headingDiv = document.getElementById('headingDiv_' + occuFiles.name + '_covar')
                    headingDiv.style.display = 'none'
                    var map_id = 'mapDiv_' + occuFiles.name
                    activeImage[map_id].setUrl(occuFiles.images[0])
                }
            }
        }(occu_files[cov_idx]))

        radio = document.getElementById('covarProbGraph_' + cov_name)
        radio.addEventListener('change', function(occuFiles){
            // Set active image on map to be the second image
            return function(){
                if (this.checked){
                    // Display correct heading
                    var headingDiv = document.getElementById('headingDiv_' + occuFiles.name + '_site')
                    headingDiv.style.display = 'none'
                    headingDiv = document.getElementById('headingDiv_' + occuFiles.name + '_covar')
                    headingDiv.style.display = 'block'
                    var map_id = 'mapDiv_' + occuFiles.name
                    activeImage[map_id].setUrl(occuFiles.images[1])
                }
            }
        }(occu_files[cov_idx]))

        occuTab.appendChild(document.createElement('br'))
        occuTab.appendChild(document.createElement('br'))

        var headingDiv = document.createElement('div')
        headingDiv.classList.add('row')
        headingDiv.id = 'headingDiv_' + cov_name + '_site'
        occuTab.appendChild(headingDiv)

        var col = document.createElement('div')
        col.classList.add('col-lg-12')
        headingDiv.appendChild(col)

        var h5 = document.createElement('h5')
        if (cov_name == '~1 ~ 1'){
            h5.innerHTML = 'Occupancy Probability Plot per Site'
        }
        else {
            h5.innerHTML = 'Probability Plot per Site'
        }
        h5.setAttribute('style','margin-bottom: 2px')
        col.appendChild(h5)

        h5 = document.createElement('h5')
        if (cov_name == '~1 ~ 1'){
            h5.innerHTML = '<div><i> The following plot displays the occupancy probability of the species in relation to the sites. </i></div>'
        }
        else {
            h5.innerHTML = '<div><i> The following plot displays the occupancy or detection probability of the species in relation to the sites. The covariate value for each site is used to calculate the probability. </i></div>'
        }
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        col.appendChild(h5)

        // headingDiv.appendChild(document.createElement('br'))

        headingDiv = document.createElement('div')
        headingDiv.classList.add('row')
        headingDiv.id = 'headingDiv_' + cov_name + '_covar'
        headingDiv.setAttribute('style','display: none')
        occuTab.appendChild(headingDiv)

        var col = document.createElement('div')
        col.classList.add('col-lg-12')
        headingDiv.appendChild(col)

        h5 = document.createElement('h5')
        if (cov_name == '~1 ~ 1'){
            h5.innerHTML = 'Detection Probability Plot per Site'
        }
        else {
            h5.innerHTML = 'Covariate Probability Plot'
        }
        h5.setAttribute('style','margin-bottom: 2px')
        col.appendChild(h5)

        h5 = document.createElement('h5')
        if (cov_name == '~1 ~ 1'){
            h5.innerHTML = '<div><i> The following plot displays the detection probability of the species in relation to the sites. </i></div>'
        }
        else {
            h5.innerHTML = '<div><i> The following plot displays the occupancy or detection probability of the species in relation to the covariates. The plot displays the effect of the covariate on the probability. </i></div>'
        }
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        col.appendChild(h5)

        // headingDiv.appendChild(document.createElement('br'))

        occuTab.appendChild(document.createElement('br'))

        var occu_images = occu_files[cov_idx].images

        div = document.createElement('div')
        div.classList.add('row')
        occuTab.appendChild(div)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        col1 = document.createElement('div')
        col1.classList.add('col-lg-10')
        div.appendChild(col1)

        center = document.createElement('center')
        col1.appendChild(center)

        map_id = 'mapDiv_' + cov_name
        mapDiv = document.createElement('div')
        mapDiv.setAttribute('id',map_id)
        mapDiv.setAttribute('style','height: 750px')
        center.appendChild(mapDiv)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        occuTab.appendChild(document.createElement('br'))
        initialiseImageMap(occu_images[0], map_id) 

    }

}


function checkOccupancy(observationWindow, siteCovariates, detectionCovariates){
    /** Checks if the occupancy analysis is valid */
    var valid = false
    var windowEmpty = false
    var windowNotNum = false
    var siteCovsNotMatch = false
    var detCovsNotMatch = false
    var error = ''

    if (observationWindow == ''){
        windowEmpty = true
    }
    else if (isNaN(observationWindow)){
        windowNotNum = true
    }
    else if (observationWindow.includes('.') || observationWindow.includes(',')){
        windowNotNum = true
    }

    var sites = getSelectedSites(true)
    if (sites == '0'){
        sites = []
        for (let i=0; i<globalSites.length; i++){
            let split = globalSites[i].split(' ')
            let site = split[0] + '_' + split[1].split('(')[1].split(',')[0] + '_' + split[2].split(')')[0]
            sites.push(site)
        }
    }
    else{
        for (let i=0; i<sites.length; i++){
            // sites[i] = sites[i].replace(',','_')
            sites[i] = sites[i].replace(/,/g,'_')
        }
    }

    if (siteCovariates.length != 0){
        for (let i=0; i<siteCovariates.length; i++){
            var cov = siteCovariates[i]
            if (cov['covariate'] == ''){
                siteCovsNotMatch = true
            }
            else{
                for (let j=0; j<sites.length; j++){
                    if (cov[sites[j]] == undefined){
                        siteCovsNotMatch = true
                    }
                }
            }
        }   
    }


    if (detectionCovariates.length != 0){
        for (let i=0; i<detectionCovariates.length; i++){
            var cov = detectionCovariates[i]
            if (cov['covariate'] == ''){
                detCovsNotMatch = true
            }
            else{
                for (let j=0; j<sites.length; j++){
                    if (cov[sites[j]] == undefined){
                        detCovsNotMatch = true
                    }
                }
            }
        }   
    }

    if(windowEmpty){
        error += 'Please enter an observation window. '
    }

    if(windowNotNum){
        error += 'Please enter a valid observation window. '
    }

    if(siteCovsNotMatch){
        error += 'Please ensure that all site covariates have a value. '
    }

    if(detCovsNotMatch){
        error += 'Please ensure that all detection covariates have a value. '
    }

    if (windowEmpty || windowNotNum || siteCovsNotMatch || detCovsNotMatch){
        valid = false
        document.getElementById('rErrors').innerHTML = error
    }
    else{
        valid = true
        document.getElementById('rErrors').innerHTML = ''
    }

    return valid

}

function importCSV(){
    modalCovariates.modal('hide')
    // modalImportCovariates.modal({keyboard: true})

    siteColDiv = document.getElementById('siteCovColsDiv')
    while (siteColDiv.firstChild){
        siteColDiv.removeChild(siteColDiv.firstChild)
    }

    detColDiv = document.getElementById('detCovColsDiv')
    while (detColDiv.firstChild){
        detColDiv.removeChild(detColDiv.firstChild)
    }

    addSiteCovCol()
    addDetCovCol()

    // Clear selects
    var select = document.getElementById('siteCol')
    clearSelect(select)

    var select = document.getElementById('latCol')
    clearSelect(select)

    var select = document.getElementById('longCol')
    clearSelect(select)

    var selects = document.getElementsByClassName('siteColSelect')
    for (let i=0; i<selects.length; i++){
        clearSelect(selects[i])
    }

    var selects = document.getElementsByClassName('detColSelect')
    for (let i=0; i<selects.length; i++){
        clearSelect(selects[i])
    }

    // Clear file input
    covariatesFile = document.getElementById('covariatesFile')
    covariatesFile.value = ''

    modalImportCovariates.modal({keyboard: true})

}

modalCovariates.on('show.bs.modal', function(){
    document.body.style.overflowY = 'hidden'
})

modalCovariates.on('hidden.bs.modal', function(){
    if (modalImportCovariates.hasClass('show')){
        document.body.style.overflowY = 'hidden'
    } else {	
        document.body.style.overflowY = 'auto'
    }
})


modalImportCovariates.on('hidden.bs.modal', function(){
    modalCovariates.modal({keyboard: true})
})

function importCovariates(){
    /** Imports the covariates from the csv file and populates the Covariates inputs on modalCovariates. */
    // Get csv data
    var csv_data = globalCSVData
    var siteCol = '' 
    var latCol = ''
    var longCol = ''

    if (csv_data.length == 0){
        document.getElementById('covariatesImportError').innerHTML = 'Please import a csv file.'
    }
    else {
        document.getElementById('covariatesImportError').innerHTML = ''

        // Get site tag
        var siteColIdx = document.getElementById('siteCol').value
        if (siteColIdx != ''){
            siteCol = csv_data[0][siteColIdx]
        }

        //Get lat col
        var latColIdx = document.getElementById('latCol').value
        if (latColIdx != ''){
            latCol = csv_data[0][latColIdx]
        }

        //Get lon col
        var longColIdx = document.getElementById('longCol').value
        if (longColIdx != ''){
            longCol = csv_data[0][longColIdx]
        }


        // Get site covariates
        var siteCovariates = []
        var siteCovariateNames = []
        var selects = document.getElementsByClassName('siteColSelect')
        for (let i=0; i<selects.length; i++){
            var select = selects[i]
            var cov = select.options[select.selectedIndex].value
            if (cov != '-1'){
                siteCovariates.push(cov)
                siteCovariateNames.push(csv_data[0][cov])
            }
        }

        // Get detection covariates
        var detectionCovariates = []
        var detectionCovariateNames = []
        var selects = document.getElementsByClassName('detColSelect')
        for (let i=0; i<selects.length; i++){
            var select = selects[i]
            var cov = select.options[select.selectedIndex].value
            if (cov != '-1'){
                detectionCovariates.push(cov)
                detectionCovariateNames.push(csv_data[0][cov])
            }
        }

        var validCols = validateCovColumns(siteCol, latCol, longCol, siteCovariateNames, detectionCovariateNames)

        if (validCols){
            var siteCovValues = {}
            var detCovValues = {}
            var csv_sites = []
            var csv_lat = []
            var csv_long = []

            for (let i=0; i<siteCovariates.length; i++){
                var cov = csv_data[0][siteCovariates[i]]
                siteCovValues[cov] = []
            }

            for (let i=0; i<detectionCovariates.length; i++){
                var cov = csv_data[0][detectionCovariates[i]]
                detCovValues[cov] = []
            }

            for (let i=1; i<csv_data.length; i++){
                var row = csv_data[i]

                var site = row[siteColIdx]
                csv_sites.push(site)

                var lat = row[latColIdx]
                var long = row[longColIdx]

                csv_lat.push(lat)
                csv_long.push(long)

                for (let j=0; j<siteCovariates.length; j++){
                    var idx = siteCovariates[j]
                    siteCovValues[siteCovariateNames[j]].push(row[idx])
                }

                for (let j=0; j<detectionCovariates.length; j++){
                    var idx = detectionCovariates[j]
                    detCovValues[detectionCovariateNames[j]].push(row[idx])
                }
            }

            // Populate covariate inputs
            var site_ids = []
            for (let i=0; i<csv_sites.length; i++){
                var site = csv_sites[i]
                // Covert lat and long to 4 decimal places
                var lat = parseFloat(csv_lat[i]).toFixed(4)
                var long = parseFloat(csv_long[i]).toFixed(4)
                var site_id = site + '_' + lat + '_' + long
                site_ids.push(site_id)
            }

            // Populate site covariates
            var siteTable = document.getElementById('siteCovariatesTable')
            var tbody = siteTable.getElementsByTagName('tbody')[0]
            var siteTableExtra = document.getElementById('siteCovariatesTableExtra')
            var tbodyExtra = siteTableExtra.getElementsByTagName('tbody')[0]

            // Remove existing rows
            var rows = tbody.getElementsByTagName('tr')
            for (let i=rows.length-1; i>=0; i--){
                tbody.removeChild(rows[i])
            }

            // Remove existing extra rows
            var rows = tbodyExtra.getElementsByTagName('tr')
            for (let i=rows.length-1; i>=0; i--){
                tbodyExtra.removeChild(rows[i])
            }

            // Add new rows
            for (let i=0; i<siteCovariateNames.length; i++){
                buildCovRow('site')
                var row = tbody.getElementsByTagName('tr')[i]
                var inputs = row.getElementsByTagName('input')
                var cov = siteCovariateNames[i]
                var values = siteCovValues[cov]

                inputs[0].value = cov
                for (let j=0; j<values.length; j++){
                    input_id = 'cov-' + site_ids[j]
                    var input = row.getElementsByClassName(site_ids[j])[0]
                    if (input != undefined && input.id == input_id){
                        input.value = values[j]
                    }
                }
            }

            // Populate detection covariates
            var detTable = document.getElementById('detectionCovariatesTable')
            var tbody = detTable.getElementsByTagName('tbody')[0]
            var detTableExtra = document.getElementById('detectionCovariatesTableExtra')
            var tbodyExtra = detTableExtra.getElementsByTagName('tbody')[0]

            // Remove existing rows
            var rows = tbody.getElementsByTagName('tr')
            for (let i=rows.length-1; i>=0; i--){
                tbody.removeChild(rows[i])
            }

            // Remove existing extra rows
            var rows = tbodyExtra.getElementsByTagName('tr')
            for (let i=rows.length-1; i>=0; i--){
                tbodyExtra.removeChild(rows[i])
            }

            // Add new rows
            for (let i=0; i<detectionCovariateNames.length; i++){
                buildCovRow('detection')
                var row = tbody.getElementsByTagName('tr')[i]
                var inputs = row.getElementsByTagName('input')
                var cov = detectionCovariateNames[i]
                var values = detCovValues[cov]

                inputs[0].value = cov
                for (let j=0; j<values.length; j++){
                    input_id = 'cov-' + site_ids[j]
                    var input = row.getElementsByClassName(site_ids[j])[0]
                    if (input != undefined && input.id == input_id){
                        input.value = values[j]
                    }
                }
                
            }


            modalImportCovariates.modal('hide')

        }

    }
    
}


function validateCovColumns(siteCol, latCol, longCol, siteCovariates, detectionCovariates){
    /** Validates the covariate columns. */

    var valid = true
    var isEmpty = false
    var bothCovs = false
    var hasDuplicates = false
    var error = ''

    // Check for empty columns
    if (siteCol == ''){
        isEmpty = true
    }

    if (latCol == ''){
        isEmpty = true
    }

    if (longCol == ''){
        isEmpty = true
    }

    // Check for empty covariates
    if (siteCovariates.length == 0 && detectionCovariates.length == 0){
        bothCovs = true
    }

    // Check for duplicates
    var allCovs = siteCovariates.concat(detectionCovariates)
    allCovs.push(siteCol)
    allCovs.push(latCol)
    allCovs.push(longCol)

    var uniqueCovs = [...new Set(allCovs)]
    if (uniqueCovs.length != allCovs.length){
        hasDuplicates = true
    }

    if (isEmpty){
        error += 'One or more columns are empty. '
        valid = false
    }

    if (hasDuplicates){
        error += 'One or more columns are duplicated. '
        valid = false
    }
    
    if (bothCovs){
        error += 'Please select at least one site covariate or detection covariate. '
        valid = false
    }

    if (valid){
        document.getElementById('covariatesImportError').innerHTML = ''
    } else {
        document.getElementById('covariatesImportError').innerHTML = error
    }

    return valid
}


function addSiteCovCol(){
    /** Adds a select to the div */
    var selectorColumn = document.getElementById('siteCovColsDiv')
    var IDNum = getIdNumforNext('siteColSelect-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','siteColDiv-'+String(IDNum))
    selectorColumn.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    // col3.style.padding = '0px'
    row.appendChild(col3)

    selectorColumn.appendChild(row)
    
    var siteSelector = document.createElement('select')
    siteSelector.classList.add('form-control')
    siteSelector.id = 'siteColSelect-'+String(IDNum)
    siteSelector.classList.add('siteColSelect')
    col1.appendChild(siteSelector)

    var siteOptionTexts = ['None']
    var siteOptionValues = ['-1']

    if(globalCSVData.length > 0){
        var csv_columns = globalCSVData[0]

        for (let i=0; i<csv_columns.length; i++){
            siteOptionValues.push(i)
            siteOptionTexts.push(csv_columns[i])
        }
    }

    fillSelect(siteSelector, siteOptionTexts, siteOptionValues)

    if (IDNum > 0) {
        btnRemove = document.createElement('button');
        btnRemove.id = 'btnRemoveSiteCov-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                btnRemove = document.getElementById('btnRemoveSiteCov-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();

            }
        }(IDNum));
    }

}

function addDetCovCol(){
    /** Adds a select to the div */
    var selectorColumn = document.getElementById('detCovColsDiv')
    var IDNum = getIdNumforNext('detColSelect-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','detColDiv-'+String(IDNum))
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

    var detSelector = document.createElement('select')
    detSelector.classList.add('form-control')
    detSelector.id = 'detColSelect-'+String(IDNum)
    detSelector.classList.add('detColSelect')
    col1.appendChild(detSelector)

    var detOptionTexts = ['None']
    var detOptionValues = ['-1']

    if (globalCSVData.length > 0){
        var csv_columns = globalCSVData[0]

        for (let i=0; i<csv_columns.length; i++){
            detOptionValues.push(i)
            detOptionTexts.push(csv_columns[i])
        }
    }

    fillSelect(detSelector, detOptionTexts, detOptionValues)

    if (IDNum > 0) {
        btnRemove = document.createElement('button');
        btnRemove.id = 'btnRemoveDetCov-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                btnRemove = document.getElementById('btnRemoveDetCov-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();

            }
        }(IDNum));
    }

}

$('#covariatesFile').change(function(){
    /** Function for when the covariates csv file is changed. */
    var file = document.getElementById('covariatesFile').files[0];
    var reader = new FileReader();

    reader.onload = function(event){
        var csv = event.target.result;
        var data = $.csv.toArrays(csv);

        if (data.length > 0) {
            var columns = data[0];

            // Fill site select with columns
            var siteSelect = document.getElementById('siteCol');
            clearSelect(siteSelect);
            var cOptions = [];
            var cTexts = [];
            for (let i = 0; i < columns.length; i++){
                cOptions.push(i)
                cTexts.push(columns[i])
            }
            fillSelect(siteSelect, cTexts, cOptions);

            // Fill latitude select with columns
            var latSelect = document.getElementById('latCol');
            clearSelect(latSelect);
            var cOptions = [];
            var cTexts = [];
            for (let i = 0; i < columns.length; i++){
                cOptions.push(i)
                cTexts.push(columns[i])
            }    
            fillSelect(latSelect, cTexts, cOptions);

            // Fill longitude select with columns
            var longSelect = document.getElementById('longCol');
            clearSelect(longSelect);
            var cOptions = [];
            var cTexts = [];
            for (let i = 0; i < columns.length; i++){
                cOptions.push(i)
                cTexts.push(columns[i])
            }
            fillSelect(longSelect, cTexts, cOptions);

            // Fill all site covariates selectors with columns
            var siteCovSelects = document.getElementsByClassName('siteColSelect');
            for (let i = 0; i < siteCovSelects.length; i++){
                var select = siteCovSelects[i];
                var cOptions = ['-1'];
                var cTexts = ['None'];
                for (let j = 0; j < columns.length; j++){
                    cOptions.push(j)
                    cTexts.push(columns[j])
                }
                clearSelect(select);
                fillSelect(select, cTexts, cOptions);
            }

            // Fill detection covariate selectors with columns
            var detColSelects = document.getElementsByClassName('detColSelect');
            for (let i = 0; i < detColSelects.length; i++){
                var select = detColSelects[i];
                var cOptions = ['-1'];
                var cTexts = ['None'];
                for (let j = 0; j < columns.length; j++){
                    cOptions.push(j)
                    cTexts.push(columns[j])
                }
                
                clearSelect(select);
                fillSelect(select, cTexts, cOptions);
            }

            globalCSVData = data;
        } else {
            console.error("CSV file is empty.");
        }
    };

    reader.readAsText(file);
});

function exportCSV(){
    /** Function for exporting the covariates as a csv file. */
    
    var siteCovariates = []
    var detectionCovariates = []
    var siteCovariatesTable = document.getElementById('siteCovariatesTable')
    var detectionCovariatesTable = document.getElementById('detectionCovariatesTable')
    var siteCovariatesRows = siteCovariatesTable.getElementsByTagName('tr')
    var detectionCovariatesRows = detectionCovariatesTable.getElementsByTagName('tr')
    document.getElementById('covariatesError').innerHTML = ''

    for (let i = 0; i < siteCovariatesRows.length; i++) {
        var row = siteCovariatesRows[i]
        var cells = row.getElementsByTagName('td')
        if (cells.length > 0){
            var covariate = cells[0].getElementsByTagName('input')[0].value.trim()
            var siteCovariate = {}
            siteCovariate['covariate'] = covariate
            for (let j = 1; j < cells.length; j++) {
                var site = cells[j].getElementsByTagName('input')[0].id.split('-')[1]
                var value = cells[j].getElementsByTagName('input')[0].value
                siteCovariate[site] = value
            }
            siteCovariates.push(siteCovariate)
        }
    }

    for (let i = 0; i < detectionCovariatesRows.length; i++) {
        var row = detectionCovariatesRows[i]
        var cells = row.getElementsByTagName('td')
        if (cells.length > 0){
            var covariate = cells[0].getElementsByTagName('input')[0].value.trim()
            var detectionCovariate = {}
            detectionCovariate['covariate'] = covariate
            for (let j = 1; j < cells.length; j++) {
                var site = cells[j].getElementsByTagName('input')[0].id.split('-')[1]
                var value = cells[j].getElementsByTagName('input')[0].value
                detectionCovariate[site] = value
            }
            detectionCovariates.push(detectionCovariate)
        }
    }

    if (siteCovariates.length == 0 && detectionCovariates.length == 0){
        document.getElementById('covariatesError').innerHTML = 'No covariates to export.'
    }
    else {
        var formData = new FormData();
        formData.append('siteCovs', JSON.stringify(siteCovariates));
        formData.append('detCovs', JSON.stringify(detectionCovariates));
        
        document.getElementById('covariatesError').innerHTML = 'Downloading CSV...'
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/getCovariateCSV');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                var csv_url = reply.cov_url
                if (csv_url){
                    var filename = csv_url.split('/')[csv_url.split('/').length-1]
                    var link = document.createElement('a');
                    link.setAttribute('download', filename);
                    link.setAttribute('href', csv_url);
                    link.click();
    
                    document.getElementById('covariatesError').innerHTML = ''
                }
                else{
                    document.getElementById('covariatesError').innerHTML = 'Error downloading CSV.'
                }
            }
        }
        xhttp.send(formData);

    }

}

function updateSCR(check=false){
    // Function for generating the capture recapture analysis

    if (check) {
        var species = '0'
        var validSCR = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
        var species = getSelectedSpecies()
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var observationWindow = document.getElementById('observationWindow').value
        var indivCharSelect = document.getElementById('indivCharSelector').value

        if (indivCharSelect != '-1'){
            var tags = [document.getElementById('maleSelector').value, document.getElementById('femaleSelector').value]
        }
        else{
            tags = '-1'
        }


        // Add validation for capture recapture
        sites_text = getSelectedSites(true)
        var validSCR = validateSCR(species, sites_text, tags, startDate, endDate, observationWindow)

        // console.log(sites)
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('tags', JSON.stringify(tags));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validSCR) {

        if (!check) {
            document.getElementById('resultsDiv').style.display = 'none'
            document.getElementById('loadingDiv').style.display = 'block'
            document.getElementById('loadingCircle').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a while to run. Please do not navigate away from this page until the analysis is complete.'

            resultsTab = document.getElementById('resultsTab')
            while(resultsTab.firstChild){
                resultsTab.removeChild(resultsTab.firstChild)
            }
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    results = reply.results
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('analysisSelector').disabled = false
                    document.getElementById('statisticsErrors').innerHTML = ''
                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }
                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }

                    // Build cap recap results
                    buildSCRtabs(results)

                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML =  'An error occurred while running the analysis. Please ensure that your selected analysis options are valid and try again.'

                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }

                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }

                    document.getElementById('analysisSelector').disabled = false
                }
                else {
                    setTimeout(function(){updateSCR(true)}, 10000);
                }

            }
        }
        xhttp.open("POST", '/getSpatialCaptureRecapture');
        xhttp.send(formData);

    }


}

function validateSCR(species, sites, tags, startDate, endDate, observationWindow){
    /** Validates the capture recapture inputs. */
    var validSpecies = true
    var validWindow = true
    var validDates = true 
    var vaildTags = true
    var validSites = true
    var error = ''

    // Check that species is not -1
    if (species == '-1'){
        validSpecies = false
        error += 'You must select a species. '
    }

    // Check that window is greater than one and a integer value
    if (observationWindow != ''){
        if (isNaN(observationWindow)){
            validWindow = false
        }
        else if (parseInt(observationWindow) < 1){
            validWindow = false
        }
        else if (parseInt(observationWindow) != parseFloat(observationWindow)){
            validWindow = false
        }

        if (!validWindow){
            error += 'The observation window must be a positive integer. '
        }
    }
    else{
        validWindow = false
        error += 'The observation window must be a positive integer. '
    }

    // Check that start date is before end date if both are provided
    if (startDate != '' && endDate != ''){
        if (startDate > endDate){
            validDates = false
            error += 'The start date must be before the end date. '
        }
    }

    // Check that there are no duplicate tags
    if (tags != '-1'){
        if (tags[0] == tags[1]){
            vaildTags = false
            error += 'You cannot have the same tag for both Male and Female. '
        }
    }

    // Check that sites are either '0' or more than one site
    if (sites != '0'){
        if (sites.length < 2){
            validSites = false
            error += 'You must select more than one site or all sites. '
        }
    }

    if (validSpecies && validWindow && validDates && vaildTags && validSites){
        document.getElementById('rErrors').innerHTML = ''
        return true
    }
    else{
        document.getElementById('rErrors').innerHTML = error
        return false
    }

}

function buildSCRtabs(results){
    /**Function for building the tabs for the SCR results.*/
    var resultsDiv = document.getElementById('resultsDiv')
    var resultsTab = document.getElementById('resultsTab')

    // SCR Summary
    var btnSummarySCRtab = document.createElement('button')
    btnSummarySCRtab.classList.add('tablinks')
    btnSummarySCRtab.classList.add('active')
    btnSummarySCRtab.innerHTML = 'SCR Summary'
    resultsTab.appendChild(btnSummarySCRtab)

    var summarySCRtab = document.createElement('div')
    summarySCRtab.classList.add('tabcontent')
    summarySCRtab.setAttribute('id', 'summarySCRtab')
    summarySCRtab.style.display = 'none'
    resultsDiv.appendChild(summarySCRtab)

    btnSummarySCRtab.addEventListener('click', function(event){
        openResultsTab(event, 'summarySCRtab', results)
    });


    // SCR Spatial Captures Plot
    var btnSpatialCapturesTab = document.createElement('button')
    btnSpatialCapturesTab.classList.add('tablinks')
    btnSpatialCapturesTab.innerHTML = 'Spatial Captures'
    resultsTab.appendChild(btnSpatialCapturesTab)

    var spatialCapturesTab = document.createElement('div')
    spatialCapturesTab.classList.add('tabcontent')
    spatialCapturesTab.setAttribute('id', 'spatialCapturesTab')
    spatialCapturesTab.style.display = 'none'
    resultsDiv.appendChild(spatialCapturesTab)

    btnSpatialCapturesTab.addEventListener('click', function(event){
        openResultsTab(event, 'spatialCapturesTab', results)
    });

    // SCR State space plot 
    var btnStateSpaceTab = document.createElement('button')
    btnStateSpaceTab.classList.add('tablinks')
    btnStateSpaceTab.innerHTML = 'State Space'
    resultsTab.appendChild(btnStateSpaceTab)

    var stateSpaceTab = document.createElement('div')
    stateSpaceTab.classList.add('tabcontent')
    stateSpaceTab.setAttribute('id', 'stateSpaceTab')
    stateSpaceTab.style.display = 'none'
    resultsDiv.appendChild(stateSpaceTab)

    btnStateSpaceTab.addEventListener('click', function(event){
        openResultsTab(event, 'stateSpaceTab', results)
    });

    // SCR Density Map 
    var btnDensityMapTab = document.createElement('button')
    btnDensityMapTab.classList.add('tablinks')
    btnDensityMapTab.innerHTML = 'Density Map'
    resultsTab.appendChild(btnDensityMapTab)

    var densityMapTab = document.createElement('div')
    densityMapTab.classList.add('tabcontent')
    densityMapTab.setAttribute('id', 'densityMapTab')
    densityMapTab.style.display = 'none'
    resultsDiv.appendChild(densityMapTab)

    btnDensityMapTab.addEventListener('click', function(event){
        openResultsTab(event, 'densityMapTab', results)
    });


    //SCR Heatmap
    var btnHeatmapTab = document.createElement('button')
    btnHeatmapTab.classList.add('tablinks')
    btnHeatmapTab.innerHTML = 'Counts Heatmap'
    resultsTab.appendChild(btnHeatmapTab)

    var heatmapTab = document.createElement('div')
    heatmapTab.classList.add('tabcontent')
    heatmapTab.setAttribute('id', 'srcHeatmapTab')
    heatmapTab.style.display = 'none'
    resultsDiv.appendChild(heatmapTab)

    btnHeatmapTab.addEventListener('click', function(event){
        openResultsTab(event, 'srcHeatmapTab', results)
    });


    
    btnSummarySCRtab.click()

}

function buildSCR(results, tab){
    /**Function for build sing the spatial capture-recapture results */

    document.getElementById('statisticsErrors').innerHTML = ''
    if (tab == 'summarySCRtab'){
        var summarySCRtab = document.getElementById('summarySCRtab')
        if (summarySCRtab.firstChild == null){
            var density = results.density
            var abundance = results.abundance
            var det_prob = results.det_prob
            var sigma = results.sigma
            var summary = results.summary
            var aic = results.aic
            var cr = results.cr
            var message = results.message

            // Capture Recapture
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Capture Recapture'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            var h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the Capture Recapture results. It displays abundance estimates for your species calculated by different models without the use of any spatial information. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            var table = document.createElement('table')
            table.id = 'summaryCRTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            if (cr.length > 0){

                keys = Object.keys(cr[0])

                for (let i=0; i<keys.length; i++){
                    var th = document.createElement('th')
                    th.innerHTML = keys[i]
                    tr.appendChild(th)
                }

                // Create table body
                var tbody = document.createElement('tbody')
                table.appendChild(tbody)

                // Loop through each model summary and create table rows
                for (let i=0; i<cr.length; i++){
                    var cr_estimate = cr[i]
                    var trBody = document.createElement('tr')
                    tbody.appendChild(trBody)

                    for (let j=0; j<keys.length; j++){
                        var td = document.createElement('td')
                        var value = cr_estimate[keys[j]]
                        if (isNaN(value)){
                            td.innerHTML = value
                        }
                        else{
                            if (parseFloat(value) != parseInt(value)){
                                td.innerHTML = parseFloat(value).toFixed(4)
                            }
                            else{
                                td.innerHTML = parseInt(value)
                            }
                        }
                        trBody.appendChild(td)
                    }
                }

                summarySCRtab.appendChild(table)
            }
            else{
                var h5 = document.createElement('h5')
                h5.innerHTML = 'No capture recapture results could be generated. Please ensure that your data is correct. '
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px; color: #DF691A;')
                summarySCRtab.appendChild(h5)
            }
            summarySCRtab.appendChild(document.createElement('br'))

            summarySCRtab.appendChild(document.createElement('br'))

            // Spatial Capture Recapture
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Spatial Capture Recapture'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            if (message != ''){
                var h5 = document.createElement('h5')
                h5.innerHTML = message
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px; color: #DF691A;')
                summarySCRtab.appendChild(h5)
            }

            // Spatial Capture RecaptureSummary 
            var h5 = document.createElement('h5')
            h5.innerHTML = 'SCR Data Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the data summary for the SCR analysis. Individuals and sites indicate the number of individuals and sites in the analysis. Occasions indicate the number of sampling occasions. MMDM and HMMDM indicate the mean and half mean maximum distances moved. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            if (summary.length > 0){

            var table = document.createElement('table')
            table.id = 'summarySRCTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'
            

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(summary[0]) // Assuming all model summaries have the same keys

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            // Loop through each model summary and create table rows
            for (let i=0; i<summary.length; i++){
                var summary_estimate = summary[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = summary_estimate[keys[j]]
                    if (keys[j] == 'MMDM' || keys[j] == 'HMMDM'){
                        if(keys[j] == 'MMDM'){
                            // console.log('mmdm')
                            // console.log(value)
                            if (parseInt(value) == 0){
                                document.getElementById('statisticsErrors').innerHTML = 'The MMDM is 0 for your indiviual data. For the analysis it was set to 1. The results may not be accurate. A MMDM of 0 indicates that no individuals moved between sites or that you have not specified coordinates for your sites. Please ensure that your data is correct.'
                            }
                        }
                        td.innerHTML = value.toFixed(2)
                    }
                    else{
                        td.innerHTML = value
                    }
                    trBody.appendChild(td)
                }
            }

            summarySCRtab.appendChild(table)
            }
            summarySCRtab.appendChild(document.createElement('br'))

            // AIC
            var h5 = document.createElement('h5')
            h5.innerHTML = 'AIC'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the AIC for each model. The AIC is a measure of the relative quality of a statistical model for a given set of data. The model with the lowest AIC is considered the best model. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            if (aic.length > 0){

            var table = document.createElement('table')
            table.id = 'aicTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(aic[0])

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            // Loop through each model summary and create table rows
            for (let i=0; i<aic.length; i++){
                var aic_estimate = aic[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = aic_estimate[keys[j]]
                    if (isNaN(value)){
                        td.innerHTML = value
                    }
                    else{
                        if (parseFloat(value) != parseInt(value)){
                            td.innerHTML = parseFloat(value).toFixed(4)
                        }
                        else{
                            td.innerHTML = parseInt(value)
                        }
                    }
                    trBody.appendChild(td)
                }
            }

            summarySCRtab.appendChild(table)
            }
            summarySCRtab.appendChild(document.createElement('br'))

            // Density
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Density per 100km<sup>2</sup>'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the estimated density per 100km<sup>2</sup> of the specified species for each session. The estimate indiciates the average number of individuals per 100km<sup>2</sup> of the population. The standard error is the standard deviation of the estimated density. The lower and upper bounds are the lower and upper bounds of the 95% confidence interval of the estimated density. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            if (density.length > 0){

            var table = document.createElement('table')
            table.id = 'densityTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'
        

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(density[0]) // Assuming all model summaries have the same keys

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)
            var float_keys = ['Estimate', 'Standard Error', 'Lower Bound', 'Upper Bound']
            // Loop through each model summary and create table rows
            for (let i=0; i<density.length; i++){
                var density_estimate = density[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = density_estimate[keys[j]]
                    if (isNaN(value) || !float_keys.includes(keys[j])){
                        td.innerHTML = value
                    } else {
                        td.innerHTML = value.toFixed(4)
                    }
                    trBody.appendChild(td)
                }
            }

            summarySCRtab.appendChild(table)
            }
            summarySCRtab.appendChild(document.createElement('br'))


            // Abundance
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Abundance'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the estimated abundance of the specified species for each session. The estimate indiciates the average number of individuals of the population. The standard error is the standard deviation of the estimated abundance. The lower and upper bounds are the lower and upper bounds of the 95% confidence interval of the estimated abundance. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            if (abundance.length > 0){

            var table = document.createElement('table')
            table.id = 'abundanceTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(abundance[0]) 

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            // Loop through each model summary and create table rows
            for (let i=0; i<abundance.length; i++){
                var abundance_estimate = abundance[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = abundance_estimate[keys[j]]
                    if (isNaN(value) || keys[j] == 'Session'){
                        td.innerHTML = value
                    } else {
                        td.innerHTML = value.toFixed(4)
                    }
                    trBody.appendChild(td)
                }
            }

            summarySCRtab.appendChild(table)
            }
            summarySCRtab.appendChild(document.createElement('br'))

            // Detection Probability 
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Detection Probability'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the estimated detection probability of the specified species for each session. The estimate indiciates the average detection probability of the species. The standard error is the standard deviation of the estimated detection probability. The lower and upper bounds are the lower and upper bounds of the 95% confidence interval of the estimated detection probability. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            if (det_prob.length > 0){

            var table = document.createElement('table')
            table.id = 'detProbTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(det_prob[0])

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            var float_keys = ['Estimate', 'Standard Error', 'Lower Bound', 'Upper Bound']

            // Loop through each model summary and create table rows
            for (let i=0; i<det_prob.length; i++){
                var detProb_estimate = det_prob[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = detProb_estimate[keys[j]]
                    if (isNaN(value) || !float_keys.includes(keys[j])){
                        td.innerHTML = value
                    } else {
                        td.innerHTML = value.toFixed(4)
                    }
                    trBody.appendChild(td)
                }
            }

            summarySCRtab.appendChild(table)
            }
            summarySCRtab.appendChild(document.createElement('br'))

        // Sigma
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Space use (&sigma;)'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            summarySCRtab.appendChild(h5)

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the estimated space use (&sigma;) in km of the specified species for each session. The estimate indiciates the average space use (&sigma;) of the individuals. The standard error is the standard deviation of the estimated space use (&sigma;). The lower and upper bounds are the lower and upper bounds of the 95% confidence interval of the estimated space use (&sigma;). </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summarySCRtab.appendChild(h5)

            if (sigma.length > 0){

            var table = document.createElement('table')
            table.id = 'sigmaTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%'

            // Create table header
            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            keys = Object.keys(sigma[0])

            for (let i=0; i<keys.length; i++){
                var th = document.createElement('th')
                th.innerHTML = keys[i]
                tr.appendChild(th)
            }

            // Create table body
            var tbody = document.createElement('tbody')
            table.appendChild(tbody)

            // Loop through each model summary and create table rows
            for (let i=0; i<sigma.length; i++){
                var sigma_estimate = sigma[i]
                var trBody = document.createElement('tr')
                tbody.appendChild(trBody)

                for (let j=0; j<keys.length; j++){
                    var td = document.createElement('td')
                    var value = sigma_estimate[keys[j]]
                    if (isNaN(value) || keys[j] == 'Session' || keys[j] == 'Sex'){
                        td.innerHTML = value
                    } else {
                        td.innerHTML = value.toFixed(4)
                    }
                    trBody.appendChild(td)
                }

            }

            summarySCRtab.appendChild(table)
            }
            summarySCRtab.appendChild(document.createElement('br'))

        }
    }
    else if (tab == 'spatialCapturesTab'){
        var spatialCapturesTab = document.getElementById('spatialCapturesTab')

        while(spatialCapturesTab.firstChild){
            spatialCapturesTab.removeChild(spatialCapturesTab.firstChild)
        }
        
        // Builds the tab for the spatial captures plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'Spatial Captures'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        spatialCapturesTab.appendChild(h5)

        h5 = document.createElement('h5')
        h5.innerHTML = '<div><i> The following plot displays the spatial captures of the species. The circles indicate the average spatial location of the individual. The crosses indicate the site locations. The lines indicate the sites visited by the individual (if an individual is detected at more than one site). </i></div>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        spatialCapturesTab.appendChild(h5)

        var div = document.createElement('div')
        div.classList.add('row')
        spatialCapturesTab.appendChild(div)

        var space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-10')
        div.appendChild(col1)

        var center = document.createElement('center')
        col1.appendChild(center)

        var map_id = 'mapDiv_spatialCaptures'
        var mapDiv = document.createElement('div')
        mapDiv.setAttribute('id',map_id)
        mapDiv.setAttribute('style','height: 750px')
        center.appendChild(mapDiv)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        spatialCapturesTab.appendChild(document.createElement('br'))

        var sc_image = results.scr_files[0]
        initialiseImageMap(sc_image, map_id)

    }
    else if (tab == 'stateSpaceTab'){
        var stateSpaceTab = document.getElementById('stateSpaceTab')

        while(stateSpaceTab.firstChild){
            stateSpaceTab.removeChild(stateSpaceTab.firstChild)
        }
        
        // Builds the tab for the state space plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'State Space'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        stateSpaceTab.appendChild(h5)

        h5 = document.createElement('h5')
        h5.innerHTML = '<div><i> The following plot displays the state space of the population. All the grey pixels indicate your state space (including the buffer). The state space is dicretised reprensentation of the sites. The circles or points indicate your sites. The red S\'s indicate the area where individuals were detected (sites or average spatial location). The lines indicate whether individuals were seen at multiple sites. </i></div>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        stateSpaceTab.appendChild(h5)

        var div = document.createElement('div')
        div.classList.add('row')
        stateSpaceTab.appendChild(div)

        var space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-10')
        div.appendChild(col1)

        var center = document.createElement('center')
        col1.appendChild(center)

        var map_id = 'mapDiv_stateSpace'
        var mapDiv = document.createElement('div')
        mapDiv.setAttribute('id',map_id)
        mapDiv.setAttribute('style','height: 750px')
        center.appendChild(mapDiv)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        stateSpaceTab.appendChild(document.createElement('br'))

        var ss_image = results.scr_files[1]
        initialiseImageMap(ss_image, map_id)

    }
    else if (tab == 'densityMapTab'){
        var densityMapTab = document.getElementById('densityMapTab')
        var max_density = results.raster[results.raster.length - 1].max_density
        var map_densities = results.raster.slice(0, -1)
        var sites_density = results.sites_density
        var indiv_counts = results.indiv_counts

        while(densityMapTab.firstChild){
            densityMapTab.removeChild(densityMapTab.firstChild)
        }
        
        // Builds the tab for the density map plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'Density Map'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        densityMapTab.appendChild(h5)

        h5 = document.createElement('h5')
        h5.id = 'densityMapDescription'
        h5.innerHTML = '<div><i> The following map displays a heatmap of the density of the species. The heatmap is a representation of the density of the species in relation to the state space. The darker the colour, the higher the density of the species. </i></div>'            
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        densityMapTab.appendChild(h5)

        // Radio buttons for density map
        var divRadio = document.createElement('div')
        divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');
        densityMapTab.appendChild(divRadio)

        var radio = document.createElement('input')
        radio.setAttribute('type', 'radio')
        radio.setAttribute('id', 'densityMap_heatmap')
        radio.setAttribute('name', 'densityMap')
        radio.setAttribute('class', 'custom-control-input')
        radio.setAttribute('value', '0')
        // radio.checked = true
        divRadio.appendChild(radio)
            
        var label = document.createElement('label')
        label.setAttribute('class', 'custom-control-label')
        label.setAttribute('for', 'densityMap_heatmap')
        label.innerHTML = 'Heatmap'
        divRadio.appendChild(label)
        
        $('#densityMap_heatmap').change(function(densities, max_density, sites_density){
            return function(){
                if (this.checked){
                    document.getElementById('densityMapDescription').innerHTML = '<div><i> The following map displays a heatmap of the density of the species. The heatmap is a representation of the density of the species in relation to the state space. The darker the colour, the higher the density of the species. </i></div>'
                    document.getElementById('DHM_OptionsDiv').hidden = false
                    document.getElementById('radiusSliderDHM').value = 54
                    var map_id = 'mapDiv_densityMap'
                    var mapDiv = document.getElementById(map_id)

                    if (map[map_id]){
                        map[map_id].remove()
                    }

                    while (mapDiv.firstChild){
                        mapDiv.removeChild(mapDiv.firstChild)
                    }

                    initialiseDensityHeatmap(densities, max_density, sites_density, map_id)
                }
            }
        }(map_densities, max_density, sites_density))

        divRadio = document.createElement('div')
        divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');
        densityMapTab.appendChild(divRadio)

        radio = document.createElement('input')
        radio.setAttribute('type', 'radio')
        radio.setAttribute('id', 'densityMap_plot')
        radio.setAttribute('name', 'densityMap')
        radio.setAttribute('class', 'custom-control-input')
        radio.setAttribute('value', '1')
        divRadio.appendChild(radio)                     

        label = document.createElement('label')
        label.setAttribute('class', 'custom-control-label')
        label.setAttribute('for', 'densityMap_plot')
        label.innerHTML = 'Plot'
        divRadio.appendChild(label)

        $('#densityMap_plot').change(function(image_url){
            return function(){
                if (this.checked){
                    document.getElementById('densityMapDescription').innerHTML ='<div><i> The following plot displays the density map of the species. The density map displays the predicted density per pixel of the species in relation to the state space.</i></div>'     
                    document.getElementById('DHM_OptionsDiv').hidden = true 
                    map_id = 'mapDiv_densityMap'

                    if (map[map_id]){
                        map[map_id].remove()
                    }

                    mapDiv = document.getElementById(map_id)
                    while (mapDiv.firstChild){
                        mapDiv.removeChild(mapDiv.firstChild)
                    }

                    initialiseImageMap(image_url, map_id)
                }
            }
        }(results.scr_files[2]))

        var heatmapOptionsDiv = document.createElement('div')
        heatmapOptionsDiv.id = 'DHM_OptionsDiv'
        densityMapTab.appendChild(heatmapOptionsDiv)

        // SLider and checkboxex
        var div = document.createElement('div')
        div.classList.add('row')
        heatmapOptionsDiv.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-1')
        div.appendChild(col)

        var label = document.createElement('label')
        label.setAttribute('for','radiusSliderDHM')
        label.innerHTML = 'Radius: '
        col.appendChild(label)


        var col = document.createElement('div')
        col.classList.add('col-lg-2')
        col.setAttribute('style','padding-left: 0px')
        col.setAttribute('align','center')
        div.appendChild(col)

        var div1 = document.createElement('div')
        div1.classList.add('justify-content-center')
        col.appendChild(div1)

        var div2 = document.createElement('div')
        div2.classList.add('w-75')
        div1.appendChild(div2)

        var input = document.createElement('input')
        input.setAttribute('type','range')
        input.setAttribute('class','custom-range')
        input.setAttribute('id','radiusSliderDHM')
        input.setAttribute('min','0')
        input.setAttribute('max','100')
        input.setAttribute('value','54')
        div2.appendChild(input)

        $("#radiusSliderDHM").change( function(counts, max_density){
            return function(){
                scale = document.getElementById('radiusSliderDHM').value
                scale = logslider(scale)
                
                if (document.getElementById('nomaliseCxDHM').checked){
                    var mapDHM = map['mapDiv_densityMap']

                    var heatmap_data = []
                    for (let i=0;i<counts.length;i++) {
                        var latitude = counts[i].lat
                        var longitude = counts[i].lng
                        var count = counts[i].density
                        if (count > 0){
                            heatmap_data.push({lat:latitude,lng:longitude,count:count})
                        } 
                    }

                    mapDHM.removeLayer(densHeatmapLayer)
                    mapDHM.addLayer(invDensHeatmapLayer)

                    invDensHeatmapLayer.cfg.radius = scale
                    invDensHeatmapLayer._update()

                    var maxVal = 0
                    var hm_data = heatmap_data
                    for (let i=0;i<hm_data.length;i++) {
                        value = invDensHeatmapLayer._heatmap.getValueAt(mapDHM.latLngToLayerPoint(L.latLng({lat:hm_data[i].lat, lng:hm_data[i].lng})))
                        if (value!=0) {
                            hm_data[i].count = (1000*hm_data[i].count)/value
                            if (hm_data[i].count>maxVal) {
                                maxVal = hm_data[i].count
                            }
                        }
                    }

                    hm_max = 1.25*maxVal
                    mapDHM.removeLayer(invDensHeatmapLayer)
                    mapDHM.addLayer(densHeatmapLayer)

                    densHeatmapLayer._data = []
                    var data = {max:hm_max,data:hm_data}
                    densHeatmapLayer.setData(data)
                    densHeatmapLayer.cfg.radius = scale
                    densHeatmapLayer._update()

                }
                else{
                    densHeatmapLayer.cfg.radius = scale
                    densHeatmapLayer._update()
                }
            }
            
        }(map_densities, max_density));

        var div = document.createElement('div')
        div.classList.add('row')
        heatmapOptionsDiv.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-4')
        div.appendChild(col)

        var cxDiv = document.createElement('div')
        cxDiv.classList.add('custom-control')
        cxDiv.classList.add('custom-checkbox')
        col.appendChild(cxDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','showSitesDHM')
        input.setAttribute('name','showSitesDHM')
        cxDiv.appendChild(input)

        
        var label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','showSitesDHM')
        label.innerHTML = 'Show Sites'
        cxDiv.appendChild(label)

        document.getElementById('showSitesDHM').addEventListener('change', function(){
            if (document.getElementById('showSitesDHM').checked) {
                for (let i=0;i<densMarkers.length;i++) {
                    if (!map['mapDiv_densityMap'].hasLayer(densMarkers[i])) {
                        map['mapDiv_densityMap'].addLayer(densMarkers[i])
                    }
                }
            } else {
                for (let i=0;i<densMarkers.length;i++) {
                    if (map['mapDiv_densityMap'].hasLayer(densMarkers[i])) {
                        map['mapDiv_densityMap'].removeLayer(densMarkers[i])
                    }
                }
            }
        });

        document.getElementById('showSitesDHM').checked = true

        var div = document.createElement('div')
        div.classList.add('row')
        heatmapOptionsDiv.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-4')
        div.appendChild(col)

        var cxDiv = document.createElement('div')
        cxDiv.classList.add('custom-control')
        cxDiv.classList.add('custom-checkbox')
        col.appendChild(cxDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','nomaliseCxDHM')
        input.setAttribute('name','nomaliseCxDHM')
        cxDiv.appendChild(input)

        
        var label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','nomaliseCxDHM')
        label.innerHTML = 'Normalise for Site Density'
        cxDiv.appendChild(label)

        document.getElementById('nomaliseCxDHM').addEventListener('change', function(counts, max_density){
            return function(){
                var checkbox = document.getElementById('nomaliseCxDHM')
                var mapDHM = map['mapDiv_densityMap']

                var heatmap_data = []
                for (let i=0;i<counts.length;i++) {
                    var latitude = counts[i].lat
                    var longitude = counts[i].lng
                    var count = counts[i].density
                    if (count > 0){
                        heatmap_data.push({lat:latitude,lng:longitude,count:count})
                    } 
                }

                if (checkbox.checked){
                    mapDHM.removeLayer(densHeatmapLayer)
                    mapDHM.addLayer(invDensHeatmapLayer)

                    var maxVal = 0
                    var hm_data = heatmap_data
                    for (let i=0;i<hm_data.length;i++) {
                        value = invDensHeatmapLayer._heatmap.getValueAt(mapDHM.latLngToLayerPoint(L.latLng({lat:hm_data[i].lat, lng:hm_data[i].lng})))
                        if (value!=0) {
                            hm_data[i].count = (1000*hm_data[i].count)/value
                            if (hm_data[i].count>maxVal) {
                                maxVal = hm_data[i].count
                            }
                        }
                    }

                    hm_max = 1.25*maxVal
                    mapDHM.removeLayer(invDensHeatmapLayer)
                    mapDHM.addLayer(densHeatmapLayer)

                    var data = {max:hm_max,data:hm_data}
                    densHeatmapLayer.setData(data)

                }
                else{
                    mapDHM.removeLayer(densHeatmapLayer)
                    mapDHM.addLayer(invDensHeatmapLayer)
        
                    var data = {max:max_density,data:heatmap_data}
                    densHeatmapLayer.setData(data)

                    mapDHM.removeLayer(invDensHeatmapLayer)
                    mapDHM.addLayer(densHeatmapLayer)
                    
                }
            }
        }(map_densities, max_density));

        var div = document.createElement('div')
        div.classList.add('row')
        heatmapOptionsDiv.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-4')
        div.appendChild(col)

        var cxDiv = document.createElement('div')
        cxDiv.classList.add('custom-control')
        cxDiv.classList.add('custom-checkbox')
        col.appendChild(cxDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','showHeatMapDHM')
        input.setAttribute('name','showHeatMapDHM')
        cxDiv.appendChild(input)

        
        var label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','showHeatMapDHM')
        label.innerHTML = 'Show Heatmap'
        cxDiv.appendChild(label)

        document.getElementById('showHeatMapDHM').addEventListener('change', function(){
            if (document.getElementById('showHeatMapDHM').checked) {
                map['mapDiv_densityMap'].addLayer(densHeatmapLayer)
            } else {
                map['mapDiv_densityMap'].removeLayer(densHeatmapLayer)
            }
        });

        document.getElementById('showHeatMapDHM').checked = true



        var div = document.createElement('div')
        div.classList.add('row')
        densityMapTab.appendChild(div)

        var space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-10')
        col1.setAttribute('align','center')
        div.appendChild(col1)

        // var center = document.createElement('center')
        // col1.appendChild(center)

        var map_id = 'mapDiv_densityMap'
        var mapDiv = document.createElement('div')
        mapDiv.setAttribute('id',map_id)
        mapDiv.setAttribute('style','height: 750px')
        col1.appendChild(mapDiv)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        densityMapTab.appendChild(document.createElement('br'))

        document.getElementById('DHM_OptionsDiv').hidden = false
        document.getElementById('densityMap_heatmap').click()

    }
    else if (tab == 'srcHeatmapTab'){
        var max_count = results.individual_counts[results.individual_counts.length - 1].max_count
        var indiv_counts = results.individual_counts.slice(0, -1)
        var srcHeatmapTab = document.getElementById('srcHeatmapTab')

        while(srcHeatmapTab.firstChild){
            srcHeatmapTab.removeChild(srcHeatmapTab.firstChild)
        }
        
        // Builds the tab for the heatmap plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'Individual Counts Heatmap'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        srcHeatmapTab.appendChild(h5)

        h5 = document.createElement('h5')
        h5.innerHTML = '<div><i> The following map displays a heatmap of the individual counts at each site. The heatmap is a representation of the density of the individuals at each site. The darker the colour, the higher the density of individuals. </i></div>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        srcHeatmapTab.appendChild(h5)

        // SLider and checkboxex
        var div = document.createElement('div')
        div.classList.add('row')
        srcHeatmapTab.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-1')
        div.appendChild(col)

        var label = document.createElement('label')
        label.setAttribute('for','radiusSliderSRC')
        label.innerHTML = 'Radius: '
        col.appendChild(label)


        var col = document.createElement('div')
        col.classList.add('col-lg-2')
        col.setAttribute('style','padding-left: 0px')
        col.setAttribute('align','center')
        div.appendChild(col)

        var div1 = document.createElement('div')
        div1.classList.add('justify-content-center')
        col.appendChild(div1)

        var div2 = document.createElement('div')
        div2.classList.add('w-75')
        div1.appendChild(div2)

        var input = document.createElement('input')
        input.setAttribute('type','range')
        input.setAttribute('class','custom-range')
        input.setAttribute('id','radiusSliderSRC')
        input.setAttribute('min','0')
        input.setAttribute('max','100')
        input.setAttribute('value','54')
        div2.appendChild(input)

        $("#radiusSliderSRC").change( function(counts, max_count){
            
            return function(){
                scale = document.getElementById('radiusSliderSRC').value
                scale = logslider(scale)
                
                if (document.getElementById('nomaliseCxSRC').checked){
                    var mapSRC = map['mapDiv_srcHeatmap']

                    var heatmap_data = []
                    for (let i=0;i<counts.length;i++) {
                        var tag = counts[i].site_id.split('_')[0]
                        var latitude = counts[i].site_id.split('_')[1]
                        var longitude = counts[i].site_id.split('_')[2]
                        var count = counts[i].count
                        if (count > 0){
                            heatmap_data.push({lat:latitude,lng:longitude,count:count,tag:tag})
                        } 
                    }

                    mapSRC.removeLayer(heatmapLayer)
                    mapSRC.addLayer(invHeatmapLayer)

                    invHeatmapLayer.cfg.radius = scale
                    invHeatmapLayer._update()

                    var maxVal = 0
                    var hm_data = heatmap_data
                    for (let i=0;i<hm_data.length;i++) {
                        value = invHeatmapLayer._heatmap.getValueAt(mapSRC.latLngToLayerPoint(L.latLng({lat:hm_data[i].lat, lng:hm_data[i].lng})))
                        if (value!=0) {
                            hm_data[i].count = (1000*hm_data[i].count)/value
                            if (hm_data[i].count>maxVal) {
                                maxVal = hm_data[i].count
                            }
                        }
                    }

                    hm_max = 1.25*maxVal
                    mapSRC.removeLayer(invHeatmapLayer)
                    mapSRC.addLayer(heatmapLayer)

                    heatmapLayer._data = []
                    var data = {max:hm_max,data:hm_data}
                    heatmapLayer.setData(data)
                    heatmapLayer.cfg.radius = scale
                    heatmapLayer._update()

                }
                else{
                    heatmapLayer.cfg.radius = scale
                    heatmapLayer._update()
                }
            }
            
        }(indiv_counts, max_count));

        var div = document.createElement('div')
        div.classList.add('row')
        srcHeatmapTab.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-4')
        div.appendChild(col)

        var cxDiv = document.createElement('div')
        cxDiv.classList.add('custom-control')
        cxDiv.classList.add('custom-checkbox')
        col.appendChild(cxDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','showSitesSRC')
        input.setAttribute('name','showSitesSRC')
        cxDiv.appendChild(input)

        
        var label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','showSitesSRC')
        label.innerHTML = 'Show Sites'
        cxDiv.appendChild(label)

        document.getElementById('showSitesSRC').addEventListener('change', function(){
            if (document.getElementById('showSitesSRC').checked) {
                for (let i=0;i<markers.length;i++) {
                    if (!map['mapDiv_srcHeatmap'].hasLayer(markers[i])) {
                        map['mapDiv_srcHeatmap'].addLayer(markers[i])
                    }
                }
            } else {
                for (let i=0;i<markers.length;i++) {
                    if (map['mapDiv_srcHeatmap'].hasLayer(markers[i])) {
                        map['mapDiv_srcHeatmap'].removeLayer(markers[i])
                    }
                }
            }
        });

        document.getElementById('showSitesSRC').checked = true

        var div = document.createElement('div')
        div.classList.add('row')
        srcHeatmapTab.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-4')
        div.appendChild(col)

        var cxDiv = document.createElement('div')
        cxDiv.classList.add('custom-control')
        cxDiv.classList.add('custom-checkbox')
        col.appendChild(cxDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','nomaliseCxSRC')
        input.setAttribute('name','nomaliseCxSRC')
        cxDiv.appendChild(input)

        
        var label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','nomaliseCxSRC')
        label.innerHTML = 'Normalise for Site Density'
        cxDiv.appendChild(label)

        document.getElementById('nomaliseCxSRC').addEventListener('change', function(counts, max_count){
            return function(){
                var checkbox = document.getElementById('nomaliseCxSRC')
                var mapSRC = map['mapDiv_srcHeatmap']

                var heatmap_data = []
                for (let i=0;i<counts.length;i++) {
                    var latitude = counts[i].site_id.split('_')[1]
                    var longitude = counts[i].site_id.split('_')[2]
                    var count = counts[i].count
                    if (count > 0){
                        heatmap_data.push({lat:latitude,lng:longitude,count:count,tag:tag})
                    } 
                }

                if (checkbox.checked){
                    mapSRC.removeLayer(heatmapLayer)
                    mapSRC.addLayer(invHeatmapLayer)

                    var maxVal = 0
                    var hm_data = heatmap_data
                    for (let i=0;i<hm_data.length;i++) {
                        value = invHeatmapLayer._heatmap.getValueAt(mapSRC.latLngToLayerPoint(L.latLng({lat:hm_data[i].lat, lng:hm_data[i].lng})))
                        if (value!=0) {
                            hm_data[i].count = (1000*hm_data[i].count)/value
                            if (hm_data[i].count>maxVal) {
                                maxVal = hm_data[i].count
                            }
                        }
                    }

                    hm_max = 1.25*maxVal
                    mapSRC.removeLayer(invHeatmapLayer)
                    mapSRC.addLayer(heatmapLayer)

                    var data = {max:hm_max,data:hm_data}
                    heatmapLayer.setData(data)

                }
                else{
                    mapSRC.removeLayer(heatmapLayer)
                    mapSRC.addLayer(invHeatmapLayer)
        
                    var data = {max:max_count,data:heatmap_data}
                    heatmapLayer.setData(data)

                    mapSRC.removeLayer(invHeatmapLayer)
                    mapSRC.addLayer(heatmapLayer)
                    
                }
            }
        }(indiv_counts, max_count));

        var div = document.createElement('div')
        div.classList.add('row')
        srcHeatmapTab.appendChild(div)

        var col = document.createElement('div')
        col.classList.add('col-lg-4')
        div.appendChild(col)

        var cxDiv = document.createElement('div')
        cxDiv.classList.add('custom-control')
        cxDiv.classList.add('custom-checkbox')
        col.appendChild(cxDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','showHeatMapSRC')
        input.setAttribute('name','showHeatMapSRC')
        cxDiv.appendChild(input)

        
        var label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','showHeatMapSRC')
        label.innerHTML = 'Show Heatmap'
        cxDiv.appendChild(label)

        document.getElementById('showHeatMapSRC').addEventListener('change', function(){
            if (document.getElementById('showHeatMapSRC').checked) {
                map['mapDiv_srcHeatmap'].addLayer(heatmapLayer)
            } else {
                map['mapDiv_srcHeatmap'].removeLayer(heatmapLayer)
            }
        });

        document.getElementById('showHeatMapSRC').checked = true

        srcHeatmapTab.appendChild(document.createElement('br'))

        // Map
        var div = document.createElement('div')
        div.classList.add('row')
        srcHeatmapTab.appendChild(div)

        var space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-10')
        div.appendChild(col1)

        // var center = document.createElement('center')
        // col1.appendChild(center)

        var map_id = 'mapDiv_srcHeatmap'
        var mapDiv = document.createElement('div')
        mapDiv.setAttribute('id',map_id)
        mapDiv.setAttribute('style','height: 750px')
        col1.appendChild(mapDiv)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        var osmSat = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/satellite-v9',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
        })

        var osmSt = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox/streets-v11',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
        })

        var gSat = L.gridLayer.googleMutant({type: 'satellite'})
        var gHyb = L.gridLayer.googleMutant({type: 'hybrid' })

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

        map[map_id] = new L.map('mapDiv_srcHeatmap', {
            layers: [gSat, heatmapLayer]
        });

        baseMaps = {
            "Google Satellite": gSat,
            "Google Hybrid": gHyb,
            "OpenStreetMaps Satellite": osmSat,
            "OpenStreetMaps Roadmap": osmSt,
        };

        L.control.layers(baseMaps).addTo(map[map_id]);
        L.control.scale().addTo(map[map_id]);
        map[map_id]._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
        map[map_id]._controlCorners['bottomright'].style.marginBottom = "14px";

        map[map_id].on('baselayerchange', function(wrap_map_id) {
            return function(e) {
                if (e.name.includes('Google')) {
                    map[wrap_map_id]._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
                    map[wrap_map_id]._controlCorners['bottomright'].style.marginBottom = "14px";
                }
                activeBaseLayer = e;
            }
        }(map_id));

        markers = []
        var refMarkers = []
        for (let i=0;i<indiv_counts.length;i++) {
            var tag = indiv_counts[i].site_id.split('_')[0]
            var latitude = indiv_counts[i].site_id.split('_')[1]
            var longitude = indiv_counts[i].site_id.split('_')[2]

            marker = L.marker([latitude, longitude]).addTo(map[map_id])
            markers.push(marker)
            map[map_id].addLayer(marker)
            text = '<b>Site: </b>' + tag + '<br><b>Count: </b>' + indiv_counts[i].count
            marker.bindPopup(text);
            // marker.bindPopup(tag);
            marker.on('mouseover', function (e) {
                this.openPopup();
            });
            marker.on('mouseout', function (e) {
                this.closePopup();
            });
            refMarkers.push({lat:latitude,lng:longitude,count:1000,tag:tag})
        }
        var refData = {max:2000,data:refMarkers}
        invHeatmapLayer.setData(refData)

        var group = new L.featureGroup(markers);
        map[map_id].fitBounds(group.getBounds().pad(0.1))
        if(markers.length == 1) {
            map[map_id].setZoom(10)
        }

        spatialExportControl = L.control.bigImage({position: 'topright', maxScale: 1}).addTo(map[map_id]);

        var heatmap_data = []
        for (let i=0;i<indiv_counts.length;i++) {
            var tag = indiv_counts[i].site_id.split('_')[0]
            var latitude = indiv_counts[i].site_id.split('_')[1]
            var longitude = indiv_counts[i].site_id.split('_')[2]
            var count = indiv_counts[i].count
            if (count > 0){
                heatmap_data.push({lat:latitude,lng:longitude,count:count,tag:tag})
            } 
        }

        var data = {max:max_count,data:heatmap_data}
        heatmapLayer.setData(data)

        srcHeatmapTab.appendChild(document.createElement('br'))
    }

}

function initialiseDensityHeatmap(map_densities, max_density, sites_density, map_id){
    /**Initialises the density heatmap. */

    var osmSat = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/satellite-v9',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
    })

    var osmSt = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
    })

    var gSat = L.gridLayer.googleMutant({type: 'satellite'})
    var gHyb = L.gridLayer.googleMutant({type: 'hybrid' })

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

    densHeatmapLayer = new HeatmapOverlay(cfg);
    invDensHeatmapLayer = new HeatmapOverlay(invCfg);

    map[map_id] = new L.map(map_id, {
        layers: [gSat, densHeatmapLayer]
    });

    baseMaps = {
        "Google Satellite": gSat,
        "Google Hybrid": gHyb,
        "OpenStreetMaps Satellite": osmSat,
        "OpenStreetMaps Roadmap": osmSt,
    };

    L.control.layers(baseMaps).addTo(map[map_id]);
    L.control.scale().addTo(map[map_id]);
    map[map_id]._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
    map[map_id]._controlCorners['bottomright'].style.marginBottom = "14px";

    map[map_id].on('baselayerchange', function(wrap_map_id) {
        return function(e) {
            if (e.name.includes('Google')) {
                map[wrap_map_id]._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
                map[wrap_map_id]._controlCorners['bottomright'].style.marginBottom = "14px";
            }
            activeBaseLayer = e;
        }
    }(map_id));

    densMarkers = []
    var refMarkers = []
    for (let i=0;i<sites_density.length;i++) {
        var tag = sites_density[i].site_id.split('_')[0]
        var latitude = sites_density[i].site_id.split('_')[1]
        var longitude = sites_density[i].site_id.split('_')[2]
        var density = parseFloat(sites_density[i].density).toFixed(4)

        marker = L.marker([latitude, longitude]).addTo(map[map_id])
        densMarkers.push(marker)
        map[map_id].addLayer(marker)
        text = '<b>Site: </b>' + tag + '<br><b>Density: </b>' + density
        marker.bindPopup(text);
        // marker.bindPopup(tag);
        marker.on('mouseover', function (e) {
            this.openPopup();
        });
        marker.on('mouseout', function (e) {
            this.closePopup();
        });
        refMarkers.push({lat:latitude,lng:longitude,count:1000,tag:tag})
    }
    var refData = {max:2000,data:refMarkers}
    invDensHeatmapLayer.setData(refData)

    var group = new L.featureGroup(densMarkers);
    map[map_id].fitBounds(group.getBounds().pad(0.1))
    if(densMarkers.length == 1) {
        map[map_id].setZoom(10)
    }

    dhmExportControl = L.control.bigImage({position: 'topright', maxScale: 1}).addTo(map[map_id]);

    var heatmap_data = []
    for (let i=0;i<map_densities.length;i++) {
        var latitude = map_densities[i].lat
        var longitude = map_densities[i].lng
        var count = map_densities[i].density
        if (count > 0){
            heatmap_data.push({lat:latitude,lng:longitude,count:count})
        } 
    }

    var data = {max:max_density,data:heatmap_data}

    densHeatmapLayer.setData(data)

}

function getSCRcsv(check=false){
    /** Updates the activity chart  */
    if (check) {
        var species = '0'
        var validSCR = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
        var species = getSelectedSpecies()
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var observationWindow = document.getElementById('observationWindow').value
        var indivCharSelect = document.getElementById('indivCharSelector').value

        if (indivCharSelect != '-1'){
            var tags = [document.getElementById('maleSelector').value, document.getElementById('femaleSelector').value]
        }
        else{
            tags = '-1'
        }

        sites_text = getSelectedSites(true)
        var validSCR = validateSCR(species, sites_text, tags, startDate, endDate, observationWindow)
    
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('tags', JSON.stringify(tags));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validSCR) {

        document.getElementById('rErrors').innerHTML = 'Downloading CSV...'

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    csv_urls = reply.csv_urls
                    downloadCSV(csv_urls)      
                    document.getElementById('rErrors').innerHTML = ''
                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                }
                else {
                    setTimeout(function(){getSCRcsv(true)}, 10000);
                }

            }
        }
        xhttp.open("POST", '/getSpatialCaptureRecaptureCSV');
        xhttp.send(formData);

    }
}

$('#indivCharSelector').on('change', function(){
    /**Function for updating the individual characteristics div. */

    var selected = $(this).val()
    var indivCharDiv = document.getElementById('indivCharDiv')

    while(indivCharDiv.firstChild){
        indivCharDiv.removeChild(indivCharDiv.firstChild)
    }

    if (selected != '-1'){	

        var row1 = document.createElement('div')
        row1.classList.add('row')
        indivCharDiv.appendChild(row1)

        var col11 = document.createElement('div')
        col11.classList.add('col-lg-2')
        row1.appendChild(col11)

        var col12 = document.createElement('div')
        col12.classList.add('col-lg-10')
        row1.appendChild(col12)

        var row2 = document.createElement('div')
        row2.classList.add('row')
        indivCharDiv.appendChild(row2)

        var col21 = document.createElement('div')
        col21.classList.add('col-lg-2')
        row2.appendChild(col21)

        var col22 = document.createElement('div')
        col22.classList.add('col-lg-10')
        row2.appendChild(col22)

        var sOptions = globalTags
        var sTexts = globalTags

        if (selected == 'sex') {
            var maleLabel = document.createElement('label')
            maleLabel.innerHTML = 'Male: '
            col11.appendChild(maleLabel)

            var maleSelector = document.createElement('select')
            maleSelector.classList.add('form-control')
            maleSelector.setAttribute('id', 'maleSelector')
            col12.appendChild(maleSelector)

            clearSelect(maleSelector)
            fillSelect(maleSelector, sOptions, sTexts)

            for (let i=0; i<sOptions.length; i++){
                if (sOptions[i].toLowerCase() == 'male'){
                    maleSelector.selectedIndex = i
                    break
                }
            }


            var femaleLabel = document.createElement('label')
            femaleLabel.innerHTML = 'Female: '
            col21.appendChild(femaleLabel)

            var femaleSelector = document.createElement('select')
            femaleSelector.classList.add('form-control')
            femaleSelector.setAttribute('id', 'femaleSelector')
            col22.appendChild(femaleSelector)

            clearSelect(femaleSelector)
            fillSelect(femaleSelector, sOptions, sTexts)

            for (let i=0; i<sOptions.length; i++){
                if (sOptions[i].toLowerCase() == 'female'){
                    femaleSelector.selectedIndex = i
                    break
                }
            }

        }
    }

})

function onload(){
    /**Function for initialising the page on load.*/
    document.getElementById("openAnalysisTab").click();
    barData = {}
    polarData = {}
    lineData = {}
    getLabelsAndSites()
    generateResults()
    // Run summary analysis (uncomment for prod)
    document.getElementById('btnRunScript').click()
}

window.addEventListener('load', onload, false);
