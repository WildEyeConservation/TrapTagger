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
var chart1 = null
var chart2 = null
var chart3 = null
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
var tabActive = 'baseDataDiv'
var tabActiveResults = 'dataSummaryTab'
var selectedAnnotationSets = {}
var globalAnnotationSets = []
var activeImage = {}
var summaryTrapUnit = '0'
var globalSiteCovariates = []
var globalDetectionCovariates = []
var globalCovariateOptions = []
var globalCSVData = []
var activity = true
var timeout = null
var globalGroupNames = []
var globalGroupIDs = []
var globalSurveys = []
var globalTasks = {}
var multipleAnnotationSets = false
var selectedTasks = []
var covariateSites = []
var globalSummaryResults = null
var globalActivityResults = null 
var globalOccupancyResults = null
var globalSCRResults = null

const modalExportAlert = $('#modalExportAlert')
const modalCovariates = $('#modalCovariates')
const modalImportCovariates = $('#modalImportCovariates')
const modalRScript = $('#modalRScript')

function getLabelsSitesTagsAndGroups(){
    /**Gets the labels, sites and tags for the selected tasks */
    tasks = getSelectedTasks()

    var formData = new FormData()
    formData.append('task_ids', JSON.stringify(tasks))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/getAllLabelsTagsSitesAndGroups', true);
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
            globalGroupNames = reply.group_names
            globalGroupIDs = reply.group_ids

            speciesSelector = document.getElementById('speciesSelect')
            if (speciesSelector) {
                clearSelect(speciesSelector)
                var optionValues = ['-1', '0']
                var optionTexts = ['None', 'All']
                optionValues = optionValues.concat(globalLabels)
                optionTexts = optionTexts.concat(globalLabels)
                fillSelect(speciesSelector, optionTexts, optionValues)
            }

            var dataDiv = document.getElementById('dataDiv')
            while(dataDiv.firstChild){
                dataDiv.removeChild(dataDiv.firstChild);
            }
            buildDataSelectorRow()

            var speciesDiv = document.getElementById('speciesDiv')
            while(speciesDiv.firstChild){
                speciesDiv.removeChild(speciesDiv.firstChild);
            }
            buildSpeciesSelectorRow()

            var speciesSelectorDiv = document.getElementById('speciesSelectorDiv')
            while(speciesSelectorDiv.firstChild){
                speciesSelectorDiv.removeChild(speciesSelectorDiv.firstChild);
            }
            buildRSpeciesRows()
            
        }
    }
    xhttp.send(formData);
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

    document.getElementById('statisticsErrors').innerHTML = ''

    if (analysisType=='0') {
        //Builds the selectors for the summary analysis
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = true
        document.getElementById('btnDownloadResultsCSV').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = false
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= false
        resultsDiv = document.getElementById('resultsDiv')
        while(resultsDiv.firstChild){
            resultsDiv.removeChild(resultsDiv.firstChild)
        }

        if (globalSummaryResults) {
            buildSummary(globalSummaryResults)
        }
    }
    else if (analysisType=='1') {
        //Builds the selectors for the naive activity analysis
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
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= false
        generateNaiveActivity()
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
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= true
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
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= false
        generateNumerical()
    }
    else if (analysisType=='4') {
        //Builds the selectors for the temporal analysis
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
        document.getElementById('trendlineDiv').hidden = false
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = false
        document.getElementById('openChartTab').disabled= false
        generateTemporal()
    }
    else if (analysisType=='5') {
        //Builds the selectors for the activity analysis
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = false
        document.getElementById('optionsDiv').hidden = false
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = false
        document.getElementById('btnDownloadResultsCSV').hidden = false
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= true

        if (globalActivityResults) {
            generateActivity()
            initialiseImageMap(globalActivityResults)
        }
    }
    else if (analysisType=='6') {
        //Builds the selectors for the occupancy analysis
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = false
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = false
        document.getElementById('btnDownloadResultsCSV').hidden = false
        document.getElementById('covariatesDiv').hidden = false
        document.getElementById('observationWindowDiv').hidden = false
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = false
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= true

        if (globalOccupancyResults) {
            buildOccupancyTabs(globalOccupancyResults)	
        }
    }
    else if (analysisType=='7') {
        //Builds the selectors for spatial capture recapture analysis
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = false
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = false
        document.getElementById('btnViewScript').hidden = false
        document.getElementById('btnDownloadResultsCSV').hidden = false
        document.getElementById('covariatesDiv').hidden = false
        document.getElementById('observationWindowDiv').hidden = false
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = true
        document.getElementById('indivCharacteristicsDiv').hidden = false
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= true

        if (globalSCRResults) {
            buildSCRtabs(globalSCRResults)
        }
    }
    else{
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('normalisationDiv').hidden = true
        document.getElementById('timeUnitSelectionDiv').hidden = true 
        document.getElementById('spatialOptionsDiv').hidden = true
        document.getElementById('spatialDataDiv').hidden = true
        document.getElementById('analysisDataDiv').hidden = true
        document.getElementById('comparisonDiv').hidden = true
        document.getElementById('numericalDataDiv').hidden = true
        document.getElementById('trendlineDiv').hidden = true
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = true
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= false
    }

}

function disablePanel(){
    /** Disables the panel while the results are being generated */
    var analysisType = document.getElementById('analysisSelector').value

    document.getElementById('openSiteTab').disabled = true
    document.getElementById('openDataTab').disabled = true

    document.getElementById('btnExportResults').disabled = true
    document.getElementById('btnClearResults').disabled = true
    document.getElementById('analysisSelector').disabled = true
    document.getElementById('baseUnitSelector').disabled = true
    document.getElementById('timeToIndependence').disabled = true
    document.getElementById('timeToIndependenceUnit').disabled = true

    if (analysisType=='0') {
        // Summary analysis
        document.getElementById('cameraSelector').disabled = true
        document.getElementById('btnRunScript').disabled = true
        document.getElementById('btnCancelResults').disabled = false
    }
    else if (analysisType=='1') {
        // Naive Activity analysis
        document.getElementById('chartTypeSelector').disabled = true
        document.getElementById('normalisationSelector').disabled = true
        document.getElementById('trendlineSelector').disabled = true
        document.getElementById('trendlineOnlyCheckbox').disabled = true
        document.getElementById('btnAddSpeciesAndSite').disabled = true

        var allTrapgroupSelectors = document.querySelectorAll('[id^=trapgroupSelect-]') 
        var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelect-]')
        var allColourSelectors = document.querySelectorAll('[id^=colourSelect-]')
        var allRemoveButtons = document.querySelectorAll('[id^=btnRemove-]')

        for (let i=0;i<allTrapgroupSelectors.length;i++) {
            allTrapgroupSelectors[i].disabled = true
            allSpeciesSelectors[i].disabled = true
            allColourSelectors[i].disabled = true
            allRemoveButtons[i].disabled = true
        }
    }
    else if (analysisType=='2') {
        // Spatial analysis
        document.getElementById('speciesSelect').disabled = true
        document.getElementById('radiusSlider').disabled = true
        document.getElementById('markerCheckBox').disabled = true
        document.getElementById('normalisationCheckBox').disabled = true
        document.getElementById('heatMapCheckBox').disabled = true
        if (document.getElementById('excludeNothing')) {
            document.getElementById('excludeNothing').disabled = true
            document.getElementById('excludeKnocks').disabled = true
            document.getElementById('excludeVHL').disabled = true
        }
    }
    else if (analysisType=='3') {
        // Numerical analysis
        document.getElementById('chartTypeSelector').disabled = true
        document.getElementById('xAxisSelector').disabled = true
        document.getElementById('normalisationSelector').disabled = true
        document.getElementById('btnAddSpecies').disabled = true

        var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelectNum-]')
        var allColourSelectors = document.querySelectorAll('[id^=colourSelectSpecies-]')
        var allRemoveButtons = document.querySelectorAll('[id^=btnRemoveSpecies-]')

        for (let i=0;i<allSpeciesSelectors.length;i++) {
            allSpeciesSelectors[i].disabled = true
            allColourSelectors[i].disabled = true
            allRemoveButtons[i].disabled = true
        }
    }
    else if (analysisType=='4') {
        // Temporal analysis
        document.getElementById('chartTypeSelector').disabled = true
        document.getElementById('startDateTA').disabled = true
        document.getElementById('endDateTA').disabled = true
        document.getElementById('timeUnitNumber').disabled = true
        document.getElementById('timeUnitSelector').disabled = true
        document.getElementById('trendlineSelector').disabled = true
        document.getElementById('trendlineOnlyCheckbox').disabled = true
        document.getElementById('btnAddSpeciesAndSite').disabled = true

        var allTrapgroupSelectors = document.querySelectorAll('[id^=trapgroupSelect-]') 
        var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelect-]')
        var allColourSelectors = document.querySelectorAll('[id^=colourSelect-]')
        var allRemoveButtons = document.querySelectorAll('[id^=btnRemove-]')

        for (let i=0;i<allTrapgroupSelectors.length;i++) {
            allTrapgroupSelectors[i].disabled = true
            allSpeciesSelectors[i].disabled = true
            allColourSelectors[i].disabled = true
            allRemoveButtons[i].disabled = true
        }
    }
    else if (analysisType=='5') {
        // Activity analysis
        document.getElementById('centreDay').disabled = true
        document.getElementById('centreNight').disabled = true
        document.getElementById('unitDensity').disabled = true
        document.getElementById('unitFreq').disabled = true
        document.getElementById('clockTime').disabled = true
        document.getElementById('solarTime').disabled = true
        document.getElementById('overlapEst').disabled = true
        document.getElementById('btnRunScript').disabled = true
        document.getElementById('btnCancelResults').disabled = false
        document.getElementById('btnViewScript').disabled = false
        document.getElementById('btnDownloadResultsCSV').disabled = true

        var speciesSelectors = document.querySelectorAll('[id^=speciesSelector-]')
        for (let i=0;i<speciesSelectors.length;i++) {
            speciesSelectors[i].disabled = true
        }
        var removeButtons = document.querySelectorAll('[id^=btnRemoveSpeciesR-]')
        for (let i=0;i<removeButtons.length;i++) {
            removeButtons[i].disabled = true
        }
        document.getElementById('btnAddSpeciesR').disabled = true
    }
    else if (analysisType=='6') {
        // Occupancy analysis
        document.getElementById('observationWindow').disabled = true
        document.getElementById('btnCreateCovariates').disabled = true
        document.getElementById('btnRunScript').disabled = true
        document.getElementById('btnCancelResults').disabled = false
        document.getElementById('btnViewScript').disabled = false
        document.getElementById('btnDownloadResultsCSV').disabled = true
        document.getElementById('speciesSelect').disabled = true
    }
    else if (analysisType=='7') {
        // SCR analysis
        document.getElementById('observationWindow').disabled = true
        document.getElementById('indivCharSelector').disabled = true
        document.getElementById('btnCreateCovariates').disabled = true
        document.getElementById('btnRunScript').disabled = true
        document.getElementById('btnCancelResults').disabled = false
        document.getElementById('btnViewScript').disabled = false
        document.getElementById('btnDownloadResultsCSV').disabled = true
        document.getElementById('speciesSelect').disabled = true
        if (document.getElementById('maleSelector')) {
            document.getElementById('maleSelector').disabled = true
            document.getElementById('femaleSelector').disabled = true
        }
    }

}


function enablePanel(){
    /** Enables the panel after the results have been generated */

    var analysisType = document.getElementById('analysisSelector').value

    document.getElementById('openSiteTab').disabled = false
    document.getElementById('openDataTab').disabled = false

    document.getElementById('btnExportResults').disabled = false
    document.getElementById('btnClearResults').disabled = false
    document.getElementById('analysisSelector').disabled = false
    document.getElementById('baseUnitSelector').disabled = false
    document.getElementById('timeToIndependence').disabled = false
    document.getElementById('timeToIndependenceUnit').disabled = false

    if (analysisType=='0') {
        // Summary analysis
        document.getElementById('cameraSelector').disabled = false
        document.getElementById('btnRunScript').disabled = false
        document.getElementById('btnCancelResults').disabled = true
    }
    else if (analysisType=='1') {
        // Naive Activity analysis
        document.getElementById('chartTypeSelector').disabled = false
        document.getElementById('normalisationSelector').disabled = false
        document.getElementById('trendlineSelector').disabled = false
        document.getElementById('trendlineOnlyCheckbox').disabled = false
        document.getElementById('btnAddSpeciesAndSite').disabled = false

        var allTrapgroupSelectors = document.querySelectorAll('[id^=trapgroupSelect-]')
        var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelect-]')
        var allColourSelectors = document.querySelectorAll('[id^=colourSelect-]')
        var allRemoveButtons = document.querySelectorAll('[id^=btnRemove-]')

        for (let i=0;i<allTrapgroupSelectors.length;i++) {
            allTrapgroupSelectors[i].disabled = false
            allSpeciesSelectors[i].disabled = false
            allColourSelectors[i].disabled = false
            allRemoveButtons[i].disabled = false
        }
    }
    else if (analysisType=='2') {
        // Spatial analysis
        document.getElementById('speciesSelect').disabled = false
        document.getElementById('radiusSlider').disabled = false
        document.getElementById('markerCheckBox').disabled = false
        document.getElementById('normalisationCheckBox').disabled = false
        document.getElementById('heatMapCheckBox').disabled = false
        if (document.getElementById('excludeNothing')) {
            document.getElementById('excludeNothing').disabled = false
            document.getElementById('excludeKnocks').disabled = false
            document.getElementById('excludeVHL').disabled = false
        }
    }
    else if (analysisType=='3') {
        // Numerical analysis
        document.getElementById('chartTypeSelector').disabled = false
        document.getElementById('xAxisSelector').disabled = false
        document.getElementById('normalisationSelector').disabled = false
        document.getElementById('btnAddSpecies').disabled = false

        var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelectNum-]')
        var allColourSelectors = document.querySelectorAll('[id^=colourSelectSpecies-]')
        var allRemoveButtons = document.querySelectorAll('[id^=btnRemoveSpecies-]')

        for (let i=0;i<allSpeciesSelectors.length;i++) {
            allSpeciesSelectors[i].disabled = false
            allColourSelectors[i].disabled = false
            allRemoveButtons[i].disabled = false
        }
    }
    else if (analysisType=='4') {
        // Temporal analysis
        document.getElementById('chartTypeSelector').disabled = false
        document.getElementById('startDateTA').disabled = false
        document.getElementById('endDateTA').disabled = false
        document.getElementById('timeUnitNumber').disabled = false
        document.getElementById('timeUnitSelector').disabled = false
        document.getElementById('trendlineSelector').disabled = false
        document.getElementById('trendlineOnlyCheckbox').disabled = false
        document.getElementById('btnAddSpeciesAndSite').disabled = false

        var allTrapgroupSelectors = document.querySelectorAll('[id^=trapgroupSelect-]')
        var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelect-]')
        var allColourSelectors = document.querySelectorAll('[id^=colourSelect-]')
        var allRemoveButtons = document.querySelectorAll('[id^=btnRemove-]')

        for (let i=0;i<allTrapgroupSelectors.length;i++) {
            allTrapgroupSelectors[i].disabled = false
            allSpeciesSelectors[i].disabled = false
            allColourSelectors[i].disabled = false
            allRemoveButtons[i].disabled = false
        }
    }
    else if (analysisType=='5') {
        // Activity analysis
        document.getElementById('centreDay').disabled = false
        document.getElementById('centreNight').disabled = false
        document.getElementById('unitDensity').disabled = false
        document.getElementById('unitFreq').disabled = false
        document.getElementById('clockTime').disabled = false
        document.getElementById('solarTime').disabled = false
        document.getElementById('overlapEst').disabled = false
        document.getElementById('btnRunScript').disabled = false
        document.getElementById('btnCancelResults').disabled = true
        document.getElementById('btnViewScript').disabled = false
        document.getElementById('btnDownloadResultsCSV').disabled = false

        var speciesSelectors = document.querySelectorAll('[id^=speciesSelector-]')
        for (let i=0;i<speciesSelectors.length;i++) {
            speciesSelectors[i].disabled = false
        }
        var removeButtons = document.querySelectorAll('[id^=btnRemoveSpeciesR-]')
        for (let i=0;i<removeButtons.length;i++) {
            removeButtons[i].disabled = false
        }

        document.getElementById('btnAddSpeciesR').disabled = false
    }
    else if (analysisType=='6') {
        // Occupancy analysis
        document.getElementById('observationWindow').disabled = false
        document.getElementById('btnCreateCovariates').disabled = false
        document.getElementById('btnRunScript').disabled = false
        document.getElementById('btnCancelResults').disabled = true
        document.getElementById('btnViewScript').disabled = false
        document.getElementById('btnDownloadResultsCSV').disabled = false
        document.getElementById('speciesSelect').disabled = false
    }
    else if (analysisType=='7') {
        // SCR analysis
        document.getElementById('observationWindow').disabled = false
        document.getElementById('indivCharSelector').disabled = false
        document.getElementById('btnCreateCovariates').disabled = false
        document.getElementById('btnRunScript').disabled = false
        document.getElementById('btnCancelResults').disabled = true
        document.getElementById('btnViewScript').disabled = false
        document.getElementById('btnDownloadResultsCSV').disabled = false
        document.getElementById('speciesSelect').disabled = false
        if (document.getElementById('maleSelector')) {
            document.getElementById('maleSelector').disabled = false
            document.getElementById('femaleSelector').disabled = false
        }
    }
    else{
        document.getElementById('cameraSelector').disabled = false;
        document.getElementById('btnRunScript').disabled = false;
        document.getElementById('btnCancelResults').disabled = true;
        document.getElementById('btnViewScript').disabled = false;
        document.getElementById('btnDownloadResultsCSV').disabled = false;
        document.getElementById('chartTypeSelector').disabled = false;
        document.getElementById('normalisationSelector').disabled = false;
        document.getElementById('trendlineSelector').disabled = false;
        document.getElementById('trendlineOnlyCheckbox').disabled = false;
        document.getElementById('btnAddSpeciesAndSite').disabled = false;
        document.getElementById('speciesSelect').disabled = false;
        document.getElementById('radiusSlider').disabled = false;
        document.getElementById('markerCheckBox').disabled = false;
        document.getElementById('normalisationCheckBox').disabled = false;
        document.getElementById('heatMapCheckBox').disabled = false;
        if (document.getElementById('excludeNothing')) {
            document.getElementById('excludeNothing').disabled = false;
            document.getElementById('excludeKnocks').disabled = false;
            document.getElementById('excludeVHL').disabled = false;
        }
        document.getElementById('chartTypeSelector').disabled = false;
        document.getElementById('xAxisSelector').disabled = false;
        document.getElementById('normalisationSelector').disabled = false;
        document.getElementById('btnAddSpecies').disabled = false;
        document.getElementById('startDateTA').disabled = false;
        document.getElementById('endDateTA').disabled = false;
        document.getElementById('timeUnitNumber').disabled = false;
        document.getElementById('timeUnitSelector').disabled = false;
        document.getElementById('centreDay').disabled = false;
        document.getElementById('centreNight').disabled = false;
        document.getElementById('unitDensity').disabled = false;
        document.getElementById('unitFreq').disabled = false;
        document.getElementById('clockTime').disabled = false;
        document.getElementById('solarTime').disabled = false;
        document.getElementById('overlapEst').disabled = false;
        document.getElementById('btnCreateCovariates').disabled = false;
        document.getElementById('btnAddSpeciesR').disabled = false;
        document.getElementById('observationWindow').disabled = false;
        document.getElementById('indivCharSelector').disabled = false;
        if (document.getElementById('maleSelector')) {
            document.getElementById('maleSelector').disabled = false
            document.getElementById('femaleSelector').disabled = false
        }

        // var allTrapgroupSelectors = document.querySelectorAll('[id^=trapgroupSelect-]');
        // var allSpeciesSelectors = document.querySelectorAll('[id^=speciesSelect-]');
        // var allColourSelectors = document.querySelectorAll('[id^=colourSelect-]');
        // var allRemoveButtons = document.querySelectorAll('[id^=btnRemove-]');
        // for (let i = 0; i < allTrapgroupSelectors.length; i++) {
        //     allTrapgroupSelectors[i].disabled = false;
        //     allSpeciesSelectors[i].disabled = false;
        //     allColourSelectors[i].disabled = false;
        //     allRemoveButtons[i].disabled = false;
        // }
        
        // var allSpeciesSelectorsNum = document.querySelectorAll('[id^=speciesSelectNum-]');
        // var allColourSelectorsSpecies = document.querySelectorAll('[id^=colourSelectSpecies-]');
        // var allRemoveButtonsSpecies = document.querySelectorAll('[id^=btnRemoveSpecies-]');
        // for (let i = 0; i < allSpeciesSelectorsNum.length; i++) {
        //     allSpeciesSelectorsNum[i].disabled = false;
        //     allColourSelectorsSpecies[i].disabled = false;
        //     allRemoveButtonsSpecies[i].disabled = false;
        // }

        // var speciesSelectorsR = document.querySelectorAll('[id^=speciesSelector-]');
        // var removeButtonsR = document.querySelectorAll('[id^=btnRemoveSpeciesR-]');
        // for (let i = 0; i < speciesSelectorsR.length; i++) {
        //     speciesSelectorsR[i].disabled = false;
        //     removeButtonsR[i].disabled = false;
        // }
    }
}

function generateNaiveActivity(){
    /** Updates the results div for Naive Activity analysis */
    // Polar map
    mainDiv = document.getElementById('resultsDiv')

    var row = document.createElement('div')
    row.classList.add('row')
    row.setAttribute('style','margin:0px')
    mainDiv.appendChild(row)

    var h5 = document.createElement('h5');
    h5.innerHTML = 'Naive Activity Analysis'
    h5.setAttribute('style','margin-bottom: 2px')
    row.appendChild(h5);

    var help = document.createElement('button');
    help.setAttribute('type', 'button');
    help.setAttribute('class', 'btn btn-link btn-sm');
    help.setAttribute('align', 'left');
    help.setAttribute('value', 'help');
    help.setAttribute('data-toggle', 'tooltip');
    help.setAttribute('title', 'Help');
    help.setAttribute('onclick', 'helpOpen(\'naive_activity_analysis\')');
    help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
    help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
    row.appendChild(help);

    h5 = document.createElement('h5')
    h5.innerHTML = '<div><i> The following chart shows the unit counts for each hour of the day. </i></div>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    mainDiv.appendChild(h5)

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
    
    if (tasks != '-1'){
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                info = JSON.parse(this.responseText);
                trapgroupInfo = info.trapgroups

                mainDiv = document.getElementById('resultsDiv')

                var row = document.createElement('div')
                row.classList.add('row')
                row.setAttribute('style','margin:0px')
                mainDiv.appendChild(row)

                var h5 = document.createElement('h5');
                h5.innerHTML = 'Spatial Analysis'
                h5.setAttribute('style','margin-bottom: 2px')
                row.appendChild(h5);
            
                var help = document.createElement('button');
                help.setAttribute('type', 'button');
                help.setAttribute('class', 'btn btn-link btn-sm');
                help.setAttribute('align', 'left');
                help.setAttribute('value', 'help');
                help.setAttribute('data-toggle', 'tooltip');
                help.setAttribute('title', 'Help');
                help.setAttribute('onclick', 'helpOpen(\'spatial_analysis\')');
                help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
                help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
                row.appendChild(help);
            
                h5 = document.createElement('h5')
                h5.innerHTML = '<div><i> The following map showcase the a heatmap of the unit counts for each site.</i></div>'
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                mainDiv.appendChild(h5)

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
                    "OpenStreetMaps Roadmap": osmSt
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

}

function generateNumerical(){
    /** Updates the generate results div for numerical analysis */
    activeRequest = {}

    // Bar chart
    mainDiv = document.getElementById('resultsDiv')

    var row = document.createElement('div')
    row.classList.add('row')
    row.setAttribute('style','margin:0px')
    mainDiv.appendChild(row)

    var h5 = document.createElement('h5');
    h5.innerHTML = 'Numerical Analysis'
    h5.setAttribute('style','margin-bottom: 2px')
    row.appendChild(h5);

    var help = document.createElement('button');
    help.setAttribute('type', 'button');
    help.setAttribute('class', 'btn btn-link btn-sm');
    help.setAttribute('align', 'left');
    help.setAttribute('value', 'help');
    help.setAttribute('data-toggle', 'tooltip');
    help.setAttribute('title', 'Help');
    help.setAttribute('onclick', 'helpOpen(\'numerical_analysis\')');
    help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
    help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
    row.appendChild(help);

    h5 = document.createElement('h5')
    h5.innerHTML = '<div><i> The following chart shows the unit counts for a species at a specified site or the total unit counts for a species across all sites. </i></div>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    mainDiv.appendChild(h5)

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
    canvas.setAttribute('height','850')
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

function generateTemporal(){
    /** Updates the generate results div for temporal analysis */
    // Line chart
    var mainDiv = document.getElementById('resultsDiv')

    var row = document.createElement('div')
    row.classList.add('row')
    row.setAttribute('style','margin:0px')
    mainDiv.appendChild(row)

    var h5 = document.createElement('h5');
    h5.innerHTML = 'Temporal Analysis'
    h5.setAttribute('style','margin-bottom: 2px')
    row.appendChild(h5);

    var help = document.createElement('button');
    help.setAttribute('type', 'button');
    help.setAttribute('class', 'btn btn-link btn-sm');
    help.setAttribute('align', 'left');
    help.setAttribute('value', 'help');
    help.setAttribute('data-toggle', 'tooltip');
    help.setAttribute('title', 'Help');
    help.setAttribute('onclick', 'helpOpen(\'temporal_analysis\')');
    help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
    help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
    row.appendChild(help);

    h5 = document.createElement('h5')
    h5.innerHTML = '<div><i> The following chart shows the unit counts for a species as a function of time. </i></div>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    mainDiv.appendChild(h5)

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
    canvas.setAttribute('height','850')
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
                },
                gridLines: {
                    drawOnChartArea: includeGridLines,
                    color: axisColour
                },
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
    /** Updates the generate results div for activity pattern analysis */
    // Chart generated from R script

    var mainDiv = document.getElementById('resultsDiv')

    var row = document.createElement('div')
    row.classList.add('row')
    row.setAttribute('style','margin:0px')
    mainDiv.appendChild(row)

    var h5 = document.createElement('h5');
    h5.innerHTML = 'Activity Pattern'
    h5.setAttribute('style','margin-bottom: 2px')
    row.appendChild(h5);

    var help = document.createElement('button');
    help.setAttribute('type', 'button');
    help.setAttribute('class', 'btn btn-link btn-sm');
    help.setAttribute('align', 'left');
    help.setAttribute('value', 'help');
    help.setAttribute('data-toggle', 'tooltip');
    help.setAttribute('title', 'Help');
    help.setAttribute('onclick', 'helpOpen(\'activity_pattern\')');
    help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
    help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
    row.appendChild(help);

    h5 = document.createElement('h5')
    h5.innerHTML = '<div><i> The following chart shows the activity pattern of the selected species at the selected site(s). The activity pattern is the proportion of the total number of detections of the species at each hour of the day. </i></div>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    mainDiv.appendChild(h5)

    mainDiv.appendChild(document.createElement('br'))

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
    // siteOptionTexts.push(...globalSites)
    // siteOptionValues.push(...globalSitesIDs)

    for (let i=0;i<globalGroupNames.length;i++) {
        siteOptionTexts.push(globalGroupNames[i])
        val = 'g-'+globalGroupIDs[i]
        siteOptionValues.push(val)
    }

    for (let i=0;i<globalSites.length;i++) {
        siteOptionTexts.push(globalSites[i])
        val = 's-'+globalSitesIDs[i]
        siteOptionValues.push(val)
    }
    
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
            var selectColour = document.getElementById('colourSelect-' + wrapIDNum);
            // selectColour.style.backgroundColor = 'white';	
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
    /** Builds a row for the species selectors for numerical analysis  */

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
    colourPicker.hidden = true;
    col2.appendChild(colourPicker);
    
    $("#" + selectColour.id).change(function(wrapIDNum) {
        return function() {
            var selectColour = document.getElementById('colourSelectSpecies-' + wrapIDNum);
            var colourPicker = document.getElementById('colourPickerSpecies-' + wrapIDNum);
    
            if (selectColour.value === 'custom-' + wrapIDNum) {
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
            // selectColour.style.backgroundColor = 'white';	
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

function updateResults(update=false){
    /** Updates the results div based on the selected analysis type */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection == '0') {
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
        updateBar()
    }
    else if (analysisSelection == '4') {
        timeLabels = []
        updateLine()
    }
    else if (analysisSelection == '5') {
        updateActivity()
    }
    else if (analysisSelection == '6') {
        updateOccupancy()
    }
    else if (analysisSelection == '7') {
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
    /** Updates the spatial analysis map */

    var tasks = getSelectedTasks()
    var sites = getSelectedSites(true)[0]
    var selected = getSelectedSites()
    var site_ids = selected[0]
    var group_ids = selected[1]

    if (tasks != '-1') {
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        if (site_ids != '0' && site_ids != '-1') {
            formData.append('site_ids', JSON.stringify(site_ids));
        }
        if (group_ids != '0' && group_ids != '-1') {
            formData.append('group_ids', JSON.stringify(group_ids));
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                info = JSON.parse(this.responseText);
                trapgroupInfo = info.trapgroups

                console.log(trapgroupInfo)

                for (let i=0;i<markers.length;i++) {
                    if (map.hasLayer(markers[i])) {
                        map.removeLayer(markers[i])
                    }
                }

                markers = []
                refMarkers = []
                if (trapgroupInfo.length > 0) {
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
        }
        xhttp.open("POST", '/getCoords');
        xhttp.send(formData);

        updateHeatMap()
    }
}

function updateActivity(check=false){
    /** Gets the activity pattern analysis results */
    if (check) {
        var species = '0'
        var tasks = '0'
        var validActivity = true 
        var validDates = true
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var density = document.getElementById('unitDensity').checked
        var centreDay = document.getElementById('centreDay').checked
        var overlap = document.getElementById('overlapEst').checked
        var clockTime = document.getElementById('clockTime').checked
    
        var validActivity = checkActivity(species, overlap)
        var validDates = checkDates(startDate, endDate)
    
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
        formData.append('csv', JSON.stringify('0'));
        formData.append('groups', JSON.stringify(groups));
    
        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }

        if (baseUnit == '4'){
            var timeToIndependence = document.getElementById('timeToIndependence').value
            var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
            formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
            formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
        }
    }

    if (species != '-1' && validActivity && tasks != '-1' && validDates) {

        if (!check) {
            document.getElementById('resultsDiv').style.display = 'none'
            document.getElementById('loadingDiv').style.display = 'block'
            document.getElementById('loadingCircle').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a few minutes to run. Do not navigate away from this page until the analysis is complete.'
            disablePanel()
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                resultsDiv = document.getElementById('resultsDiv')
                if(reply.status == 'SUCCESS'){
                    clearTimeout(timeout)
                    image_url = reply.activity_url
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    resultsDiv.style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML = ''
                    enablePanel()

                    globalActivityResults = image_url

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
                    enablePanel()
                }
                else {
                    timeout = setTimeout(function(){updateActivity(true)}, 10000);
                }

            }
            else if (this.readyState == 4 && this.status != 200) {
                while (resultsDiv.firstChild) {
                    resultsDiv.removeChild(resultsDiv.firstChild);
                }

                document.getElementById('loadingDiv').style.display = 'none'
                document.getElementById('loadingCircle').style.display = 'none'
                resultsDiv.style.display = 'block'
                document.getElementById('statisticsErrors').innerHTML = 'An error occurred while running the analysis. Please try again.'
                enablePanel()
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
    /**Initialises the image map for displaying graphs*/
    var mapDiv = document.getElementById(map_id)
    var imageUrl = image_url
    var img = new Image();
    img.onload = function(){
        mapDiv = document.getElementById(map_id)

        w = this.width
        h = this.height
    
        if (w>h) {
            mapDiv.setAttribute('style','height: calc(45vw *'+(h/w)+');  width:45vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
        } else {
            mapDiv.setAttribute('style','height: calc(45vw *'+(w/h)+');  width:45vw ;border-style: solid; border-width: 0px; border-color: rgba(223,105,26,1)')
        }

        L.Browser.touch = true

        map[map_id] = new L.map(mapDiv, {
            crs: L.CRS.Simple,
            maxZoom: 10,
            center: [0, 0],
            zoomSnap: 0
        })

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
        var tasks = '0'
        var validActivity = true 
        var validDates = true
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var density = document.getElementById('unitDensity').checked
        var centreDay = document.getElementById('centreDay').checked
        var overlap = document.getElementById('overlapEst').checked
        var clockTime = document.getElementById('clockTime').checked
    
        var validActivity = checkActivity(species, overlap)
        var validDates = checkDates()
    
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
        formData.append('csv', JSON.stringify('1'));
        formData.append('groups', JSON.stringify(groups));
    
        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }

        if (baseUnit == '4'){
            var timeToIndependence = document.getElementById('timeToIndependence').value
            var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
            formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
            formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
        }
    }

    if (species != '-1' && validActivity && tasks != '-1' && validDates) {
        document.getElementById('rErrors').innerHTML = 'Downloading CSV...'
        disablePanel()
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    clearTimeout(timeout)
                    csv_url = reply.activity_url
                    filename = csv_url.split('/')[csv_url.split('/').length-1]
                    
                    var link = document.createElement('a');
                    link.setAttribute('download', filename);
                    link.setAttribute('href', csv_url);
                    link.click();

                    document.getElementById('rErrors').innerHTML = ''
                    enablePanel()

                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                    enablePanel()
                }
                else{
                    timeout = setTimeout(function(){getActivityPatternCSV(true)}, 10000);
                }

            }
            else if (this.readyState == 4 && this.status != 200) {
                document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                enablePanel()
            }
        }
        xhttp.open("POST", '/getActivityPattern');
        xhttp.send(formData);

    }

}

function getSelectedTasks(){
    //* Gets all the selected tasks *
    document.getElementById('analysisOptionsErrors').innerHTML = ''
    if (selectedTasks.length == 0) {
        saveDataSelection()
        if (selectedTasks.length == 0 || selectedTasks == '-1') {
            error = 'Invalid data selection. Please navigate to the Data Selection tab and select data.'
            document.getElementById('analysisOptionsErrors').innerHTML = error
            return '-1'
        }
        else{
            return selectedTasks
        }
    }
    else if (selectedTasks == '-1'){
        error = 'Invalid data selection. Please navigate to the Data Selection tab and select data.'
        document.getElementById('analysisOptionsErrors').innerHTML = error
        return '-1'
    }
    else{
        return selectedTasks
    }
}

function getSelectedSites(text=false){
    //* Gets all the selected sites from the site selectors*/
    var sites = []
    var groups = '-1'
    var allSites = groupSites['S']
    var allSitesTags = groupSitesTags['S']
    var allSitesChecked = document.getElementById('allSites-box').checked

    if (allSitesChecked) {
        sites = '0'
    }
    else{
        if (allSites.length == 0) {
            sites = '0'
            document.getElementById('allSites-box').checked = true
        }
        else{
            if (text) {
                for (let i=0;i<allSitesTags.length;i++) {
                    if (allSitesTags[i].includes('_')){
                        let site = allSitesTags[i].replace('_',',')
                        if(sites.indexOf(site) == -1){
                            sites.push(site)
                        }
                    }
                }
            }
            else{
                for (let i=0;i<allSites.length;i++) {
                    if (allSites[i].includes(',')){
                        let split = allSites[i].split(',')
                        for (let j=0;j<split.length;j++) {
                            if (sites.indexOf(split[j]) == -1){
                                sites.push(split[j])
                            }
                        }
                    }
                    else if (allSites[i] != '-1' && allSites[i] != '0' && sites.indexOf(allSites[i]) == -1){
                        sites.push(allSites[i])
                    }
                }
            }
        }
    }

    return [sites, groups]
}

function getSelectedSpecies(){
    //* Gets all the selected species from the species selectors*/
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    var species = []
    if (analysisSelection == '5') {
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
    }
    else if (analysisSelection == '6' || analysisSelection == '7') {
        var allSpecies = document.getElementById('speciesSelect').value
        if (allSpecies != '-1' && allSpecies != '0') {
            species = [allSpecies]
        }
        else{
            species = allSpecies
        }
    }


    return species
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
    else if (analysisSelection == '3') {
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

    if (analysisSelection != '3') {
        updateTrendline()
    }
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
    else if (parseFloat(timeUnitNumber) != parseInt(timeUnitNumber) ){
        valid = false
        message = 'Time unit must be an integer.'
    }

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
    else if (backgroundValue.includes('c-')){
        backgroundColour = backgroundValue.split('-')[1]
        console.log(backgroundColour)
        if (backgroundColour == '0') {
            backgroundColour = null
        }
    }

    if (borderColour.includes('c-')){
        borderColour = borderColour.split('-')[1]
        console.log(borderColour)
        if (borderColour == '0') {
            borderColour = 'white'
        }
    }

    if (textColour.includes('c-')){
        textColour = textColour.split('-')[1]
        console.log(textColour)
        if (textColour == '0') {
            textColour = 'white'
        }
    }

    if (axisColourSelector == '1') {
        axisColour = 'rgba(255,255,255,0.2)'
    }
    else if (axisColourSelector == '2') {
        axisColour = 'rgba(0,0,0,0.2)'
    }
    else if (axisColourSelector.includes('c-')){
        axisColour = axisColourSelector.split('-')[1]
        console.log(axisColour)
        if (axisColour == '0') {
            axisColour = 'rgba(0,0,0,0.2)'
        }
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

    if (analysisSelection == '0'){
        if(chart1 && document.getElementById('ct_canvas1')){
            var chartData1 = chart1.data
            var chartOptions1 = chart1.options
            var chartType1 = chart1.config.type

            chartOptions1.legend.display = false
            chartOptions1.legend.labels.fontColor = textColour
            chartOptions1.legend.onClick = null

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

function getSurveysAndAnnotationSets(){
    // Gets the surveys and annotation sets for the task selection

    var surveyAndAsDiv = document.getElementById('surveyAndAsDiv')
    while (surveyAndAsDiv.firstChild) {
        surveyAndAsDiv.removeChild(surveyAndAsDiv.firstChild);
    }

    var annotationDiv = document.getElementById('annotationDiv')
    while (annotationDiv.firstChild) {
        annotationDiv.removeChild(annotationDiv.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            globalSurveys = reply.surveys
            globalTasks = reply.tasks
            buildSurveyAndAsRow()
            buildSurveysAndSets(reply.surveys, reply.tasks)
        }
    }
    xhttp.open("GET", '/getSurveysAndTasksForResults');
    xhttp.send();
    
}

function buildSurveysAndSets(surveys, surveys_tasks){
    // Builds the surveys and annotation sets for the task selection

    var annotationDiv = document.getElementById('annotationDiv')
    while (annotationDiv.firstChild) {
        annotationDiv.removeChild(annotationDiv.firstChild);
    }

    for (let i = 0 ; i < surveys.length; i++) {
        var survey = surveys[i]
        var tasks = surveys_tasks[survey.id]

        if (tasks.length > 1) {
            var surveyDiv = document.createElement('div')
            surveyDiv.classList.add('row')
            annotationDiv.appendChild(surveyDiv)
    
            var surveyName = document.createElement('div')
            surveyName.classList.add('col-6')
            surveyName.style = 'display: flex; align-items: center;'
            surveyName.innerHTML = survey.name
            surveyDiv.appendChild(surveyName)
    
            var surveySets = document.createElement('div')
            surveySets.classList.add('col-6')
            surveySets.style = 'display: flex; align-items: center;'
            surveyDiv.appendChild(surveySets)
    
            var surveySetSelect = document.createElement('select')
            surveySetSelect.classList.add('form-control')
            surveySetSelect.id = 'annotationSetSelect-' + survey.id
            surveySets.appendChild(surveySetSelect)
    
            var optionTexts = []
            var optionValues = []
            for(let j = 0; j < tasks.length; j++) {
                optionTexts.push(tasks[j].name)
                optionValues.push(tasks[j].id)
            }
            clearSelect(surveySetSelect)
            fillSelect(surveySetSelect, optionTexts, optionValues)

            multipleAnnotationSets = true
        }
    }

    if (multipleAnnotationSets) {
        document.getElementById('annotationSetDiv').hidden = false
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

function buildRSpeciesRows(){
    /** Builds the species selection rows for the R-based analysis */
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
    /** Updates the results when the analysis type is changed */
    activeImage = {}
    generateResults()
});

$('#baseUnitSelector').on('change', function() {
    /** Updates the results when the base unit is changed */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (this.value == '4') {
        document.getElementById('timeToIndependenceDiv').hidden = false
    }
    else{
        document.getElementById('timeToIndependenceDiv').hidden = true
    }

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
    /** Updates the results when the start or end date is changed */
    var vaild = checkDates()
    
    if (vaild) {
        document.getElementById('dateErrors').innerHTML = ''
    }
    else{
        document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
    }
    
});

$('#startDateTA, #endDateTA').on('change', function() {
    /** Updates the results when the start or end date is changed */
    var startDate = document.getElementById('startDateTA').value
    var endDate = document.getElementById('endDateTA').value
    var vaild = true

    if (startDate != '' && endDate != '') {
        if (startDate > endDate) {
            vaild = false
        }
    }
    
    if (vaild) {
        document.getElementById('dateErrorsTA').innerHTML = ''
    }
    else{
        document.getElementById('dateErrorsTA').innerHTML = 'Start date must be before end date.'
    }

    updateResults()
    
});


$('#chartTypeSelector').on('change', function() {
    /** Updates the results when the chart type is changed */
    var chartTypeSelector = document.getElementById('chartTypeSelector')
    var chartTypeSelection = chartTypeSelector.options[chartTypeSelector.selectedIndex].value
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection != '-1') {
        updateChart(chartTypeSelection)
    }
});

$("#normalisationSelector").change( function() {
    /** Updates the results when the normalisation type is changed */
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
    /** Updates the results when the time unit is changed */
    var validUnit = checkTimeUnit()
    if (validUnit) {
        updateResults()
    }
});

$('#timeUnitNumber').on('change', function() {
    /** Updates the results when the time unit number is changed */
    var validUnit = checkTimeUnit()
    if (validUnit) {
        updateResults()
    }
});

$("#xAxisSelector").change( function() {
    /** Updates the results when the x-axis is changed */
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

            if (tasks != '-1'){
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
    }
});

$("#radiusSlider").change( function() {
    /** Updates the results when the radius slider is changed */
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
    /** Updates the results when the marker checkbox is changed */
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
    /** Updates the results when the normalisation checkbox is changed */
    updateHeatMap()
});

$("#heatMapCheckBox").change( function() {
    /** Updates the results when the heatmap checkbox is changed */
    if (document.getElementById('heatMapCheckBox').checked) {
        map.addLayer(heatmapLayer)
    } else {
        map.removeLayer(heatmapLayer)
    }
});

$("#speciesSelect").change( function() {
    /** Updates the results when the species selection is changed */
    analysisSelector = document.getElementById('analysisSelector')
    analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    if (analysisSelection == '2') {
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
    }
});

$('#trendlineSelector').change( function() {
    /** Updates the results when the trendline type is changed */
    if (document.getElementById('trendlineSelector').value == 'polynomial') {
        document.getElementById('trendlineOrderDiv').hidden = false
    }
    else {
        document.getElementById('trendlineOrderDiv').hidden = true
    }

    updateTrendline()
});

$('#trendlineOrder').change( function() {
    /** Updates the results when the trendline order is changed */
    updateTrendline()

});

$('#trendlineOnlyCheckbox').change( function() {
    /** Updates the results when the trendline only checkbox is changed */
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

$('#btnViewScript').click( function() {
    /** Gets the R script for the analysis */

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
                document.getElementById('scriptNotice').innerHTML = ''
                modalRScript.modal({keyboard: true})
                var textarea = document.getElementById('scriptTextArea');
                textarea.innerHTML = reply.script
                textarea.scrollTop = 0;
            }
        }
        xhttp.open("POST", '/getRScript');
        xhttp.send(formData);
    }

});

$('#btnExportScript').click( function() {
    /** Exports the R script for the analysis to the clipboard */
    var textarea = document.getElementById('scriptTextArea');
    textarea.select();
    document.execCommand('copy');

    document.getElementById('scriptNotice').innerHTML = 'Copied to clipboard.'
});

$('#btnDownloadResultsCSV').click( function() {
    /** Downloads the results as a CSV */
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

function clearAnalysis(){
    var resultsDiv = document.getElementById('resultsDiv')
    while(resultsDiv.firstChild){
        resultsDiv.removeChild(resultsDiv.firstChild);
    }

    var dataDiv = document.getElementById('dataDiv')
    while(dataDiv.firstChild){
        dataDiv.removeChild(dataDiv.firstChild);
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

    clearChartColours()
    timeLabels = []
    barData = {}
    polarData = {}
    lineData = {} 

    // globalSummaryResults = null
    // globalActivityResults = null 
    // globalOccupancyResults = null
    // globalSCRResults = null
}


function clearResults(){
    /** Clears the results div */
    if (tabActive == 'baseAnalysisDiv') {
        clearAnalysis()

        document.getElementById('loadingDiv').style.display = 'none'
        document.getElementById('loadingCircle').style.display = 'none'
        document.getElementById('resultsDiv').style.display = 'block'
        document.getElementById('btnCancelResults').disabled = true
        document.getElementById('btnRunScript').disabled = false
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
        document.getElementById('chartTypeDiv').hidden = true
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('trendlineOnlyCheckbox').checked = false
        document.getElementById('speciesDataDiv').hidden = true
        document.getElementById('optionsDiv').hidden = true
        document.getElementById('buttonsR').hidden = true
        document.getElementById('covariatesDiv').hidden = true
        document.getElementById('observationWindowDiv').hidden = true
        document.getElementById('cameraTrapDiv').hidden = true
        document.getElementById('dataUnitDiv').hidden = true
        document.getElementById('indivCharacteristicsDiv').hidden = true 
        document.getElementById('dateDivTA').hidden = true
        document.getElementById('openChartTab').disabled= false

        getLabelsSitesTagsAndGroups()
        enablePanel()
    }
    else if (tabActive == 'baseChartDiv'){
        document.getElementById('backgroundSelector').value = '1'
        document.getElementById('backgroundSelector').style.backgroundColor = 'white'
        document.getElementById('textColourSelector').value = 'white'
        document.getElementById('textColourSelector').style.backgroundColor = 'white'
        document.getElementById('axisColourSelector').value = '2'
        document.getElementById('axisColourSelector').style.backgroundColor = 'white'
        document.getElementById('borderColourSelector').value = 'white'
        document.getElementById('borderColourSelector').style.backgroundColor = 'white'
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
    else if (tabActive == 'baseDataDiv'){
        getSurveysAndAnnotationSets()
    }
    else if (tabActive == 'baseSitesDiv'){
        initialiseGroups()
    }
}

function exportResults(){
    /** Exports the results as images */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    document.getElementById('statisticsErrors').innerHTML = ''
    if (analysisSelection == '0') {
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
                document.getElementById('statisticsErrors').innerHTML = 'Cannot export analysis with Google map. The analysis will be exported with the OpenStreetMaps Satellite map'
                var baseLayer = baseMaps['OpenStreetMaps Satellite']
                map.removeLayer(activeBaseLayer)
                map.addLayer(baseLayer)
                activeBaseLayer = baseLayer
                spatialExportControl._print();
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
                    document.getElementById('statisticsErrors').innerHTML = 'Cannot export analysis with Google map. The analysis will be exported with the OpenStreetMaps Satellite map'
                    var baseLayer = baseMaps['OpenStreetMaps Satellite']
                    map[map_id].removeLayer(activeBaseLayer)
                    map[map_id].addLayer(baseLayer)
                    activeBaseLayer = baseLayer
                    spatialExportControl._print();
                }
                else{
                    spatialExportControl._print();
                }  
            }
        }
        else if (map_id == 'mapDiv_densityMap') {
            dm_heatmap = document.getElementById('densityMap_heatmap').checked
            if (dm_heatmap){
                if (spatialExportControl){
                    if (activeBaseLayer.name.includes('Google')){
                        document.getElementById('statisticsErrors').innerHTML = 'Cannot export analysis with Google map. The analysis will be exported with the OpenStreetMaps Satellite map'
                        var baseLayer = baseMaps['OpenStreetMaps Satellite']
                        map[map_id].removeLayer(activeBaseLayer)
                        map[map_id].addLayer(baseLayer)
                        activeBaseLayer = baseLayer
                        spatialExportControl._print();
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
    /** Opens the analysis edit tab */
    var i, tabcontent, tablinks;
    var filterCard = document.getElementById('filterCard')

    tabcontent = filterCard.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    tablinks = filterCard.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    document.getElementById(editName).style.display = "block";
    evt.currentTarget.className += " active";
    var prevTabActive = tabActive
    tabActive = editName

    if (prevTabActive == 'baseDataDiv' && tabActive != 'baseDataDiv') {
        saveDataSelection()
        clearAnalysis()
        generateResults()
        getLabelsSitesTagsAndGroups()
    }

    if (tabActive == 'baseAnalysisDiv') {
        var analysisSelector = document.getElementById('analysisSelector')
        var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
        if (analysisSelection != '0' && analysisSelection != '5' && analysisSelection != '6' && analysisSelection != '7'){
            updateResults()
        }
    }
}

function openResultsTab(evt, tabName, results) {
    /** Opens the results tab */
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
    /** Gets a data summary for the selected tasks */

    if (check) {
        var formData = new FormData()
        task_ids = '0'
        validDates = true
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
        var selected = getSelectedSites()
        var sites = selected[0]
        var groups = selected[1]

        var validDates = checkDates()
    
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
        if (baseUnit == '4'){
            var timeToIndependence = document.getElementById('timeToIndependence').value
            var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
            formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
            formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
        }
        formData.append('sites', JSON.stringify(sites))
        formData.append('groups', JSON.stringify(groups))

        document.getElementById('resultsDiv').style.display = 'none'
        document.getElementById('loadingDiv').style.display = 'block'
        document.getElementById('loadingCircle').style.display = 'block'
        document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a few minutes to run. Do not navigate away from this page until the analysis is complete.'
        disablePanel()

        resultsTab = document.getElementById('resultsTab')
        while(resultsTab.firstChild){
            resultsTab.removeChild(resultsTab.firstChild)
        }
    }

    if (task_ids != '-1' && validDates ) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if (reply.status == 'SUCCESS') {
                    clearTimeout(timeout)
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML = ''
                    enablePanel()

                    resultsDiv = document.getElementById('resultsDiv')
                    while(resultsDiv.firstChild){
                        resultsDiv.removeChild(resultsDiv.firstChild);
                    }
                    
                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild);
                    }

                    globalSummaryResults = reply.summary

                    buildSummary(reply.summary)
                }
                else if (reply.status == 'FAILURE'){
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML = 'An error occurred while running the analysis. Please try again.'
                    enablePanel()

                    resultsDiv = document.getElementById('resultsDiv')
                    while(resultsDiv.firstChild){
                        resultsDiv.removeChild(resultsDiv.firstChild);
                    }

                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }
                }
                else {
                    timeout = setTimeout(function(){getSummary(true)}, 10000);
                }
            }
            else if (this.readyState == 4 && this.status != 200) {
                document.getElementById('loadingDiv').style.display = 'none'
                document.getElementById('loadingCircle').style.display = 'none'
                document.getElementById('resultsDiv').style.display = 'block'
                document.getElementById('statisticsErrors').innerHTML = 'An error occurred while running the analysis. Please try again.'
                enablePanel()

                resultsDiv = document.getElementById('resultsDiv')
                while(resultsDiv.firstChild){
                    resultsDiv.removeChild(resultsDiv.firstChild);
                }

                resultsTab = document.getElementById('resultsTab')
                while(resultsTab.firstChild){
                    resultsTab.removeChild(resultsTab.firstChild)
                }
            }
        }
        xhttp.open("POST", '/getResultsSummary');
        xhttp.send(formData);
    }
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = true
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = true
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
            row.setAttribute('style','margin:0px')
            dataSummaryTab.appendChild(row)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Data Summary';
            h5.setAttribute('style','margin-bottom: 2px')
            row.appendChild(h5);
        
            var help = document.createElement('button');
            help.setAttribute('type', 'button');
            help.setAttribute('class', 'btn btn-link btn-sm');
            help.setAttribute('align', 'left');
            help.setAttribute('value', 'help');
            help.setAttribute('data-toggle', 'tooltip');
            help.setAttribute('title', 'Help');
            help.setAttribute('onclick', 'helpOpen(\'data_summary\')');
            help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
            row.appendChild(help);

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'summaryTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following table shows the number of images, clusters and sightings for your surveys.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            dataSummaryTab.appendChild(h5)

            var row = document.createElement('div')
            row.classList.add('row')
            dataSummaryTab.appendChild(row)

            var col0 = document.createElement('div')
            col0.classList.add('col-lg-12')
            row.appendChild(col0)

            //Data summary table
            var table = document.createElement('table');
            table.id = 'summaryTable'
            table.style.borderCollapse = 'collapse';
            table.classList.add('table-bordered')
            table.classList.add('table-hover')
            var thead = table.createTHead();
            var tbody = table.createTBody();

            // Add the title row for column headers (Name, Description, Value)
            var titleRow = thead.insertRow();
            var nameTitleCell = titleRow.insertCell();
            nameTitleCell.innerHTML = 'Name';
            nameTitleCell.style.fontWeight = 'bold';
            nameTitleCell.style.padding = '10px';

            var descTitleCell = titleRow.insertCell();
            descTitleCell.innerHTML = 'Description';
            descTitleCell.style.fontWeight = 'bold';
            descTitleCell.style.padding = '10px';
            
            var valueTitleCell = titleRow.insertCell();
            valueTitleCell.innerHTML = 'Value';
            valueTitleCell.style.fontWeight = 'bold';
            valueTitleCell.style.padding = '10px';

            var data = summary.summary_counts

            for (var key in data) {
                var row = tbody.insertRow();
                var nameCell = row.insertCell();
                nameCell.innerHTML = key;
                nameCell.style.padding = '10px';
            
                var descCell = row.insertCell();
                descCell.innerHTML = data[key].description;
                descCell.style.padding = '10px';
            
                var valueCell = row.insertCell();
                valueCell.innerHTML = data[key].value;
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
            row.setAttribute('style','margin:0px')
            diversityTab.appendChild(row)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Diversity Indices';
            h5.setAttribute('style','margin-bottom: 2px')
            row.appendChild(h5);
        
            var help = document.createElement('button');
            help.setAttribute('type', 'button');
            help.setAttribute('class', 'btn btn-link btn-sm');
            help.setAttribute('align', 'left');
            help.setAttribute('value', 'help');
            help.setAttribute('data-toggle', 'tooltip');
            help.setAttribute('title', 'Help');
            help.setAttribute('onclick', 'helpOpen(\'diversity_indices\')');
            help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
            row.appendChild(help);

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'diversityTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            h5 = document.createElement('div')
            h5.innerHTML = '<i>The following indices are a measure of diversity in a community.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            diversityTab.appendChild(h5)

            var row = document.createElement('div')
            row.classList.add('row')
            diversityTab.appendChild(row)

            var col1 = document.createElement('div')
            col1.classList.add('col-lg-12')
            row.appendChild(col1)

            var table = document.createElement('table');
            table.id = 'diversityTable'
            table.style.borderCollapse = 'collapse';
            table.classList.add('table-hover')
            table.classList.add('table-bordered')

            var thead = table.createTHead();
            var tbody = table.createTBody();
            
            var titleRow = thead.insertRow();
            var nameTitleCell = titleRow.insertCell();
            nameTitleCell.innerHTML = 'Name';
            nameTitleCell.style.fontWeight = 'bold';
            nameTitleCell.style.padding = '10px';
            
            var descTitleCell = titleRow.insertCell();
            descTitleCell.innerHTML = 'Description';
            descTitleCell.style.fontWeight = 'bold';
            descTitleCell.style.padding = '10px';
            
            var valueTitleCell = titleRow.insertCell();
            valueTitleCell.innerHTML = 'Value';
            valueTitleCell.style.fontWeight = 'bold';
            valueTitleCell.style.padding = '10px';
            
            data = summary.summary_indexes;
            
            for (var key in data) {
            var row = tbody.insertRow();
            var nameCell = row.insertCell();
            nameCell.innerHTML = key;
            nameCell.style.padding = '10px';
            
            var descCell = row.insertCell();
            descCell.innerHTML = data[key].description;
            descCell.style.padding = '10px';
            
            var valueCell = row.insertCell();
            valueCell.innerHTML = data[key].value.toFixed(2);
            valueCell.style.padding = '10px';
            }
            
            col1.appendChild(table);
        }
    }
    else if (tab == 'abundanceTab') {
    // Species abundance tab
        var abundanceTab = document.getElementById('abundanceTab')

        while(abundanceTab.firstChild) {
            abundanceTab.removeChild(abundanceTab.firstChild)
        }

        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        abundanceTab.appendChild(row)

        var h5 = document.createElement('h5');
        h5.innerHTML = 'Species Abundance';
        h5.setAttribute('style','margin-bottom: 2px')
        row.appendChild(h5);

        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'species_abundance\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

        h5 = document.createElement('div')
        h5.innerHTML = '<i>The following graph shows the abundance of each species in your data.</i>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        abundanceTab.appendChild(h5)

        var row1 = document.createElement('div')
        row1.classList.add('row')
        abundanceTab.appendChild(row1)

        var col2 = document.createElement('div')
        col2.classList.add('col-lg-12')
        row1.appendChild(col2)

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
                borderColor: borderColour,
                borderWidth: includeBorders ? 1 : 0,
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

        document.getElementById('statisticsChart').style.backgroundColor = backgroundColour
        
        
    }
    else if (tab == 'effortDaysTab') {
        // Effort days  tab
        var effortDaysTab = document.getElementById('effortDaysTab')

        while(effortDaysTab.firstChild){
            effortDaysTab.removeChild(effortDaysTab.firstChild)
        }
        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        effortDaysTab.appendChild(row)

        var h5 = document.createElement('h5');
        h5.innerHTML = 'Effort Days';
        h5.setAttribute('style','margin-bottom: 2px')
        row.appendChild(h5);

        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'effort_days\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

        h5 = document.createElement('div')
        h5.innerHTML = '<i>The following graph shows the total number of days that each site/camera was active.</i>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        effortDaysTab.appendChild(h5)

        var row = document.createElement('div')
        row.classList.add('row')
        effortDaysTab.appendChild(row)

        var col = document.createElement('div')
        col.classList.add('col-lg-12')
        row.appendChild(col)

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
                borderColor: borderColour,
                borderWidth: includeBorders ? 1 : 0,
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

        document.getElementById('ct_canvas1').style.backgroundColor = backgroundColour
    }
    else if (tab == 'cameraTrapDataCountsTab') {
        // Camera trap data counts tab
        var cameraTrapDataCountsTab = document.getElementById('cameraTrapDataCountsTab')

        while (cameraTrapDataCountsTab.firstChild) {
            cameraTrapDataCountsTab.removeChild(cameraTrapDataCountsTab.firstChild)
        }

        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        cameraTrapDataCountsTab.appendChild(row)

        var h5 = document.createElement('h5');
        h5.innerHTML = ' Data Unit Counts'; 
        h5.setAttribute('style','margin-bottom: 2px')
        row.appendChild(h5);

        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'data_counts\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

        h5 = document.createElement('div')
        h5.innerHTML = '<i>The following graph shows the total cluster/image/sighting count of each site/camera.</i>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        cameraTrapDataCountsTab.appendChild(h5)

        var row = document.createElement('div')
        row.classList.add('row')
        cameraTrapDataCountsTab.appendChild(row)

        var col = document.createElement('div')
        col.classList.add('col-lg-12')
        row.appendChild(col)

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
                borderColor: borderColour,
                borderWidth: includeBorders ? 1 : 0,
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

        document.getElementById('ct_canvas2').style.backgroundColor = backgroundColour

    }
    else if (tab == 'cameraTrapActivityTab') {

        // Camera trap activity tab
        var cameraTrapActivityTab = document.getElementById('cameraTrapActivityTab')

        while (cameraTrapActivityTab.firstChild) {
            cameraTrapActivityTab.removeChild(cameraTrapActivityTab.firstChild)
        }

        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        cameraTrapActivityTab.appendChild(row)

        var h5 = document.createElement('h5');
        h5.innerHTML = 'Active Days';
        h5.setAttribute('style','margin-bottom: 2px')
        row.appendChild(h5);

        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'active_days\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

        h5 = document.createElement('div')
        h5.innerHTML = '<i>The following graph indicates on which days each site/camera was active. The heatmap represents the image count of each site/camera on each day.</i>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        cameraTrapActivityTab.appendChild(h5)

        var row = document.createElement('div')
        row.classList.add('row')
        cameraTrapActivityTab.appendChild(row)

        var col = document.createElement('div')
        col.classList.add('col-lg-12')
        row.appendChild(col)

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
        var maxwidth = 0
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

            width = unit_names[i].length * 10
            if (width > maxwidth) {
                maxwidth = width
            }
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

        if (backgroundColour){
            bgcolor = backgroundColour
        }
        else{
            bgcolor = 'rgb(78,93,108)'
        }

        var layout = {
            paper_bgcolor: bgcolor,
            plot_bgcolor: bgcolor,
            font : {
                color: textColour
            },
            xaxis: {
                gridcolor: axisColour,
                showgrid: includeGridLines,
                color: textColour,
                showticklabels: includeLabels

            },
            yaxis: {
                gridcolor: axisColour,
                showgrid: includeGridLines,
                color: textColour,
                showticklabels: includeLabels
            },
            margin: {
                l: maxwidth + 10,
                r: 40,
                b: 40,
                t: 40,
                pad: 0
            }
        }

        Plotly.newPlot('div_ct3', plot_active_data, layout);

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

    var sites = getSelectedSites(true)[0]
    var groups = getSelectedSites()[1]
    if (sites == '0' && groups == '-1'){
        sites = []
        for (let i=0; i<globalSites.length; i++){
            let split = globalSites[i].split(' ')
            let site = split[0] + '_' + split[1].split('(')[1].split(',')[0] + '_' + split[2].split(')')[0]
            sites.push(site)
        }
        covariateSites = sites
        initialiseCovariates(sites)
    }
    else if (sites == '0' && groups != '-1'){
        sites = []
        console.log(groups)
        
        var formData = new FormData()
        formData.append('group_ids', JSON.stringify(groups))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                var response = JSON.parse(this.responseText)
                console.log(response)
                sites_data = response.sites
                sites = []
                for (let i=0; i<sites_data.length; i++){
                    var site_tag = sites_data[i].tag
                    var site_lat = parseFloat(sites_data[i].latitude).toFixed(4).toString();
                    var site_lng = parseFloat(sites_data[i].longitude).toFixed(4).toString();
                    var site = site_tag + '_' + site_lat + '_' + site_lng
                    sites.push(site)
                }
                covariateSites = sites
                initialiseCovariates(sites)

            }
        }
        xhttp.open("POST", "/getGroupSites")
        xhttp.send(formData)

    }
    else if (sites != '0' && groups == '-1'){
        for (let i=0; i<sites.length; i++){
            sites[i] = sites[i].replace(/,/g,'_')
        }
        covariateSites = sites
        initialiseCovariates(sites)
    }
    else if (sites != '0' && groups != '-1'){

        for (let i=0; i<sites.length; i++){
            sites[i] = sites[i].replace(/,/g,'_')
        }

        var formData = new FormData()
        formData.append('group_ids', JSON.stringify(groups))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                var response = JSON.parse(this.responseText)
                console.log(response)
                sites_data = response.sites
                for (let i=0; i<sites_data.length; i++){
                    var site_tag = sites_data[i].tag
                    var site_lat = parseFloat(sites_data[i].latitude).toFixed(4).toString();
                    var site_lng = parseFloat(sites_data[i].longitude).toFixed(4).toString();
                    var site = site_tag + '_' + site_lat + '_' + site_lng

                    if (sites.indexOf(site) == -1){
                        sites.push(site)
                    }
                }
                covariateSites = sites
                initialiseCovariates(sites)

            }
        }
        xhttp.open("POST", "/getGroupSites")
        xhttp.send(formData)
    }

}

function initialiseCovariates(sites){
    /** Initialises the covariates modal for occuancy analysis  */
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

    var sites = covariateSites

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
    /** Get the occupancy results */
    if (check) {
        var species = '0'
        var tasks = '0'
        var validOccupancy = true 
        var validDates = true
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var observationWindow = document.getElementById('observationWindow').value

        var validOccupancy = checkOccupancy(species,observationWindow, globalSiteCovariates, globalDetectionCovariates)  
        var validDates = checkDates()
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('detCovs', JSON.stringify(globalDetectionCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));
        formData.append('csv', JSON.stringify('0'));
        formData.append('groups', JSON.stringify(groups));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }

        if (baseUnit == '4'){
            var timeToIndependence = document.getElementById('timeToIndependence').value
            var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
            formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
            formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
        }
    }

    console.log(species)

    if (species != '-1' && validOccupancy && tasks != '-1' && validDates){

        if (!check) {
            document.getElementById('resultsDiv').style.display = 'none'
            document.getElementById('loadingDiv').style.display = 'block'
            document.getElementById('loadingCircle').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a while to run. Please do not navigate away from this page until the analysis has completed.'
            disablePanel()

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
                    clearTimeout(timeout)
                    results = reply.results
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML = ''
                    enablePanel()
                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }
                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }

                    globalOccupancyResults = results
                    buildOccupancyTabs(results)

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
                    enablePanel()
                }
                else {
                    timeout = setTimeout(function(){updateOccupancy(true)}, 10000);
                }

            }
            else if (this.readyState == 4 && this.status != 200) {
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
                enablePanel()
            }
        }
        xhttp.open("POST", '/getOccupancy');
        xhttp.send(formData);

    }

}


function getOccupancyCSV(check=false){
    /** Get the occupancy results CSV*/
    if (check) {
        var species = '0'
        var tasks = '0'	
        var validDates = true
        var validOccupancy = true 
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
        var species = getSelectedSpecies()
        var baseUnit = document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value
        var startDate = document.getElementById('startDate').value
        var endDate = document.getElementById('endDate').value
        var observationWindow = document.getElementById('observationWindow').value
        var validDates = checkDates()

        var validOccupancy = checkOccupancy(species,observationWindow, globalSiteCovariates, globalDetectionCovariates)
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('detCovs', JSON.stringify(globalDetectionCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));
        formData.append('csv', JSON.stringify('1'));
        formData.append('groups', JSON.stringify(groups));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }

        if (baseUnit == '4'){
            var timeToIndependence = document.getElementById('timeToIndependence').value
            var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
            formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
            formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
        }
    }

    if (species != '-1' && validOccupancy && tasks != '-1' && validDates){

        document.getElementById('rErrors').innerHTML = 'Downloading CSV...'
        disablePanel()

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    clearTimeout(timeout)
                    csv_urls = reply.results.csv_urls
                    downloadCSV(csv_urls)      
                    document.getElementById('rErrors').innerHTML = ''
                    enablePanel()
                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                    enablePanel()
                }
                else {
                    timeout = setTimeout(function(){getOccupancyCSV(true)}, 10000);
                }

            }
            else if (this.readyState == 4 && this.status != 200) {
                document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                enablePanel()
            }
        }
        xhttp.open("POST", '/getOccupancy');
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = true
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
            document.getElementById('statisticsErrors').innerHTML = ''
            var tabName = 'occuTab_' + results.model_formula
            document.getElementById('btnExportResults').disabled = false
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
                document.getElementById('statisticsErrors').innerHTML = ''
                tabName = 'occuTab_' + results.occu_files[i].name
                document.getElementById('btnExportResults').disabled = false
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
            var occu_est = results.occu_est
            var det_est = results.det_est

            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summaryOccuTab.appendChild(row)

            var h5 = document.createElement('h5');
            h5.innerHTML = 'Occupancy Summary';
            h5.setAttribute('style', 'margin-bottom: 2px;');
            row.appendChild(h5);
        
            var help = document.createElement('button');
            help.setAttribute('type', 'button');
            help.setAttribute('class', 'btn btn-link btn-sm');
            help.setAttribute('align', 'left');
            help.setAttribute('value', 'help');
            help.setAttribute('data-toggle', 'tooltip');
            help.setAttribute('title', 'Help');
            help.setAttribute('onclick', 'helpOpen(\'occupancy\')');
            help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
            row.appendChild(help);

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'occuSummaryTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays a summary of the occupancy analysis for the selected species. Naive occupancy is the proportion of sites occupied by the species. The best model formula is the covariate formula that best explains the occupancy of the species. The occupancy estimate is the probability that the species is present at a site. The detection estimate is the probability that the species is detected at a site given that it is present. The occupancy and detection estimates given is the estimate that is determined with all covariates set to 0. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create table to display naive occupancy and model formula
            var table = document.createElement('table')
            table.id = 'occuSummaryTable'
            table.classList.add('table')
            table.classList.add('table-bordered')
            table.classList.add('table-striped')
            table.classList.add('table-hover')
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

            var th = document.createElement('th')
            th.innerHTML = 'Occupancy Estimate'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Detection Estimate'
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

            var td = document.createElement('td')
            td.innerHTML = occu_est.toFixed(4)
            tr.appendChild(td)

            var td = document.createElement('td')
            td.innerHTML = det_est.toFixed(4)
            tr.appendChild(td)

            summaryOccuTab.appendChild(table)
            summaryOccuTab.appendChild(document.createElement('br'))

            aic = results.aic

            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summaryOccuTab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'AICc Results'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'occuAicTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the AICc results for the best model selection. The best model is the model with the lowest AICc value. The delta AICc is the difference between the best model and the other models. The weight is the probability that the model is the best model. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create a single table to display all AIC results
            var table = document.createElement('table');
            table.id = 'occuAicTable'
            table.classList.add('table');
            table.classList.add('table-bordered');
            table.classList.add('table-striped');
            table.classList.add('table-hover');
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

            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summaryOccuTab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Best Model Occupancy Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'occuEstTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the occupancy estimate summary for the selected best model. The occupancy estimate is the probability that a site is occupied given that the species is present. Please note the values are in logit scale. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create a table to display the model summaries
            var table = document.createElement('table')
            table.id = 'occuEstTable'
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

            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summaryOccuTab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Best Model Detection Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'detEstTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the detection estimate summary for the selected best model. The detection estimate is the probability that the species is detected given that the species is present. Please note the values are in logit scale.</i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryOccuTab.appendChild(h5)

            // Create a table to display the model summaries
            var table = document.createElement('table')
            table.id = 'detEstTable'
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
        var predict_tables = results.predict_tables

        while(occuTab.firstChild){
            occuTab.removeChild(occuTab.firstChild)
        }

        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        occuTab.appendChild(row)
    
        var h5 = document.createElement('h5')
        if (cov_name == '~1 ~ 1'){
            h5.innerHTML = 'Covariate Results: No Covariates'
        } else {
            h5.innerHTML = 'Covariate Results: ' + cov_name
        }
        h5.setAttribute('style','margin-bottom: 2px')
        row.appendChild(h5)
    
        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'covariates_results\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

        // Create a radio button to select the type of graph
        var divRadio = document.createElement('div')
        divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');
        
        var radio = document.createElement('input')
        radio.setAttribute('type', 'radio')
        radio.setAttribute('id', 'siteProbGraph_' + cov_name)
        radio.setAttribute('name', 'occuGraph_' + cov_name)
        radio.setAttribute('class', 'custom-control-input')
        radio.setAttribute('value', '0')
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

        divRadio = document.createElement('div')
        divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');

        radio = document.createElement('input')
        radio.setAttribute('type', 'radio')
        radio.setAttribute('id', 'predProbTable_' + cov_name)
        radio.setAttribute('name', 'occuGraph_' + cov_name)
        radio.setAttribute('class', 'custom-control-input')
        radio.setAttribute('value', '2')
        divRadio.appendChild(radio)

        label = document.createElement('label')
        label.setAttribute('class', 'custom-control-label')
        label.setAttribute('for', 'predProbTable_' + cov_name)
        label.innerHTML = 'Prediction Table'
        divRadio.appendChild(label)

        occuTab.appendChild(divRadio)

        // EVent listener for the radio buttons
        radio = document.getElementById('siteProbGraph_' + cov_name)
        radio.addEventListener('change', function(occuFiles){
            // Set active image on map to be the first image
            return function(){
                if (this.checked){
                    // Display correct heading
                    var occuDiv = document.getElementById('occuDiv_' + occuFiles.name)
                    while(occuDiv.firstChild){
                        occuDiv.removeChild(occuDiv.firstChild)
                    }

                    var row = document.createElement('div')
                    row.classList.add('row')
                    occuDiv.appendChild(row)

                    var col = document.createElement('div')
                    col.classList.add('col-lg-12')
                    row.appendChild(col)

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

                    occuDiv.appendChild(document.createElement('br'))
            
                    var map_id = 'mapDiv_' + occuFiles.name

                    div = document.createElement('div')
                    div.classList.add('row')
                    occuDiv.appendChild(div)

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

                    occuDiv.appendChild(document.createElement('br'))
                    initialiseImageMap(occuFiles.images[0], map_id) 
                }
            }
        }(occu_files[cov_idx]))

        radio = document.getElementById('covarProbGraph_' + cov_name)
        radio.addEventListener('change', function(occuFiles){
            // Set active image on map to be the second image
            return function(){
                if (this.checked){
                    // Display correct heading
                    var occuDiv = document.getElementById('occuDiv_' + occuFiles.name)
                    while(occuDiv.firstChild){
                        occuDiv.removeChild(occuDiv.firstChild)
                    }

                    var row = document.createElement('div')
                    row.classList.add('row')
                    occuDiv.appendChild(row)

                    var col = document.createElement('div')
                    col.classList.add('col-lg-12')
                    row.appendChild(col)

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

                    occuDiv.appendChild(document.createElement('br'))

                    var map_id = 'mapDiv_' + occuFiles.name

                    div = document.createElement('div')
                    div.classList.add('row')
                    occuDiv.appendChild(div)

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

                    occuDiv.appendChild(document.createElement('br'))
                    initialiseImageMap(occuFiles.images[1], map_id) 
                }
            }
        }(occu_files[cov_idx]))

        radio = document.getElementById('predProbTable_' + cov_name)
        radio.addEventListener('change', function(predTables){
            return function(){
                if (this.checked){
                    covName = this.id.split('_')[1]

                    var occuDiv = document.getElementById('occuDiv_' + covName)
                    while(occuDiv.firstChild){
                        occuDiv.removeChild(occuDiv.firstChild)
                    }

                    for (let i=0; i<predTables.length; i++){
                        if (predTables[i].name == covName){
                            var predTable = predTables[i]
                            var row = document.createElement('div')
                            row.classList.add('row')
                            occuDiv.appendChild(row)

                            var col = document.createElement('div')
                            col.classList.add('col-lg-12')
                            row.appendChild(col)

                            var rowH = document.createElement('div')
                            rowH.classList.add('row')
                            rowH.setAttribute('style','margin:0px')
                            col.appendChild(rowH)
                    
                            var h5 = document.createElement('h5')
                            if (predTable.type == 'state'){
                                h5.innerHTML = 'Occupancy Probabilty Prediction Table'
                            }
                            else {
                                h5.innerHTML = 'Detection Probabilty Prediction Table'
                            }
                            h5.setAttribute('style','margin-bottom: 2px')
                            rowH.appendChild(h5)

                            var copyClipboard = document.createElement('button');
                            copyClipboard.setAttribute('type', 'button');
                            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
                            copyClipboard.setAttribute('align', 'left');
                            copyClipboard.setAttribute('data-toggle', 'tooltip');
                            copyClipboard.setAttribute('title', 'Copy to clipboard');
                            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'predTable_' + covName + '_' + predTable.type + "\')");
                            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
                            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
                            rowH.appendChild(copyClipboard);
                    
                            h5 = document.createElement('h5')
                            if (predTable.type == 'state'){
                                h5.innerHTML = '<div><i> The following table displays the occupancy probability of the species in relation to the sites. </i></div>'
                            }
                            else {
                                h5.innerHTML = '<div><i> The following table displays the detection probability of the species in relation to the sites. </i></div>'
                            }
                            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                            col.appendChild(h5)

                            occuDiv.appendChild(document.createElement('br'))

                            var pred_table  = predTable.table

                            var table = document.createElement('table')
                            table.classList.add('table')
                            table.classList.add('table-bordered')
                            table.classList.add('table-striped')
                            table.classList.add('table-hover')
                            table.style.borderCollapse = 'collapse';
                            table.style.width = '100%';
                            table.id = 'predTable_' + covName + '_' + predTable.type

                            var thead = document.createElement('thead')
                            table.appendChild(thead)

                            var keys = Object.keys(pred_table[0])

                            var tr = document.createElement('tr')
                            thead.appendChild(tr)

                            for (let i=0; i<keys.length; i++){
                                var th = document.createElement('th')
                                th.innerHTML = keys[i]
                                tr.appendChild(th)
                            }

                            var tbody = document.createElement('tbody')
                            table.appendChild(tbody)

                            for (let i=0; i<pred_table.length; i++){
                                var tr = document.createElement('tr')
                                tbody.appendChild(tr)

                                for (let j=0; j<keys.length; j++){
                                    var td = document.createElement('td')
                                    var value = pred_table[i][keys[j]]
                                    if (isNaN(value)){
                                        td.innerHTML = value
                                    } else {
                                        td.innerHTML = parseFloat(value).toFixed(4)
                                    }
                                    tr.appendChild(td)
                                }

                            }

                            occuDiv.appendChild(table)
                            occuDiv.appendChild(document.createElement('br'))
                        }
                    }
                }
            }
        }(predict_tables))


        occuTab.appendChild(document.createElement('br'))
        occuTab.appendChild(document.createElement('br'))

        var div = document.createElement('div')
        div.id = 'occuDiv_' + cov_name
        occuTab.appendChild(div)

        document.getElementById('siteProbGraph_' + cov_name).click()

    }

}


function checkOccupancy(species,observationWindow, siteCovariates, detectionCovariates){
    /** Checks if the occupancy analysis is valid */
    var valid = false
    var windowEmpty = false
    var windowNotNum = false
    var siteCovsNotMatch = false
    var detCovsNotMatch = false
    var error = ''
    var noSpecies = false

    if (species == '-1'){
        noSpecies = true
    }

    if (observationWindow == ''){
        windowEmpty = true
    }
    else if (isNaN(observationWindow)){
        windowNotNum = true
    }
    else if (observationWindow.includes('.') || observationWindow.includes(',')){
        windowNotNum = true
    }

    var sites = getSelectedSites(true)[0]
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

    if (noSpecies){
        error += 'Please select a species. '
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

    if (windowEmpty || windowNotNum || siteCovsNotMatch || detCovsNotMatch || noSpecies){
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
    /** Imports the csv file and populates the Covariates inputs on modalCovariates. */
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
    /** When modalCovariates is shown, hide the scroll bar on the body. */
    document.body.style.overflowY = 'hidden'
})

modalCovariates.on('hidden.bs.modal', function(){
    /** When modalCovariates is hidden, show the scroll bar on the body. */
    if (modalImportCovariates.hasClass('show')){
        document.body.style.overflowY = 'hidden'
    } else {	
        document.body.style.overflowY = 'auto'
    }
})

modalImportCovariates.on('hidden.bs.modal', function(){
    /** When modalImportCovariates is hidden, show the scroll bar on the body. */
    if (!helpReturn){
        modalCovariates.modal({keyboard: true})
        helpReturn = false
    }
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
                    input_id = 'cov@' + site_ids[j]
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
                    input_id = 'cov@' + site_ids[j]
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
    /** Adds site covariate column select to the div */
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
    /** Adds a detection covariate column select to the div */
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
                var site = cells[j].getElementsByTagName('input')[0].id.split('@')[1]
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
                var site = cells[j].getElementsByTagName('input')[0].id.split('@')[1]
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

        console.log(siteCovariates)
        console.log(detectionCovariates)

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
    // Function for generating the saptial capture recapture analysis

    if (check) {
        var species = '0'
        var tasks = '0'
        var validSCR = true 
        var validDates = true
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
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

        var selected = getSelectedSites(true)
        var sites_text = selected[0]
        var groups_text = selected[1]
        var validSCR = validateSCR(species, sites_text, groups_text, tags, startDate, endDate, observationWindow)
        var validDates = checkDates()
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('tags', JSON.stringify(tags));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));
        formData.append('csv', JSON.stringify('0'));
        formData.append('groups', JSON.stringify(groups));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validSCR && tasks != '-1' && validDates){

        if (!check) {
            document.getElementById('resultsDiv').style.display = 'none'
            document.getElementById('loadingDiv').style.display = 'block'
            document.getElementById('loadingCircle').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = 'Please note that this analysis may take a while to run. Please do not navigate away from this page until the analysis is complete.'
            disablePanel()

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
                    clearTimeout(timeout)
                    results = reply.results
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML = ''
                    enablePanel()
                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }
                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }

                    globalSCRResults = results

                    buildSCRtabs(results)
                }
                else if(reply.status == 'FAILURE'){
                    clearTimeout(timeout)
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML =  'An error occurred while running the analysis. Please ensure that your selected analysis options are valid and try again.'
                    enablePanel()

                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }

                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }
                }
                else if (reply.status == 'NO_INDIVIDUALS'){
                    clearTimeout(timeout)
                    document.getElementById('loadingDiv').style.display = 'none'
                    document.getElementById('loadingCircle').style.display = 'none'
                    document.getElementById('resultsDiv').style.display = 'block'
                    document.getElementById('statisticsErrors').innerHTML =  'There are no individuals identified for the selected species. Please complete the individual identification task and try again or select a different species.'
                    enablePanel()

                    while(document.getElementById('resultsDiv').firstChild){
                        document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                    }

                    resultsTab = document.getElementById('resultsTab')
                    while(resultsTab.firstChild){
                        resultsTab.removeChild(resultsTab.firstChild)
                    }
                }
                else {
                    timeout = setTimeout(function(){updateSCR(true)}, 10000);
                }

            }
            else if (this.readyState == 4 && this.status != 200) {
                document.getElementById('loadingDiv').style.display = 'none'
                document.getElementById('loadingCircle').style.display = 'none'
                document.getElementById('resultsDiv').style.display = 'block'
                document.getElementById('statisticsErrors').innerHTML =  'An error occurred while running the analysis. Please ensure that your selected analysis options are valid and try again.'
                enablePanel()

                while(document.getElementById('resultsDiv').firstChild){
                    document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild)
                }

                resultsTab = document.getElementById('resultsTab')
                while(resultsTab.firstChild){
                    resultsTab.removeChild(resultsTab.firstChild)
                }
            }
        }
        xhttp.open("POST", '/getSpatialCaptureRecapture');
        xhttp.send(formData);

    }


}

function validateSCR(species, sites, groups, tags, startDate, endDate, observationWindow){
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
        error += 'Please select a species. '
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

    if (sites != '0' && groups == '-1'){
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

    // CR Summary
    var btnSummaryCRtab = document.createElement('button')
    btnSummaryCRtab.classList.add('tablinks')
    btnSummaryCRtab.innerHTML = 'Capture-Recapture'
    resultsTab.appendChild(btnSummaryCRtab)

    var summaryCRtab = document.createElement('div')
    summaryCRtab.classList.add('tabcontent')
    summaryCRtab.setAttribute('id', 'summaryCRtab')
    summaryCRtab.style.display = 'none'
    resultsDiv.appendChild(summaryCRtab)

    btnSummaryCRtab.addEventListener('click', function(event){
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = true
        openResultsTab(event, 'summaryCRtab', results)
    });

    // SCR Summary
    var btnSummarySCRtab = document.createElement('button')
    btnSummarySCRtab.classList.add('tablinks')
    btnSummarySCRtab.classList.add('active')
    btnSummarySCRtab.innerHTML = 'Spatial Capture-Recapture'
    resultsTab.appendChild(btnSummarySCRtab)

    var summarySCRtab = document.createElement('div')
    summarySCRtab.classList.add('tabcontent')
    summarySCRtab.setAttribute('id', 'summarySCRtab')
    summarySCRtab.style.display = 'none'
    resultsDiv.appendChild(summarySCRtab)

    btnSummarySCRtab.addEventListener('click', function(event){
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = true
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
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
        document.getElementById('statisticsErrors').innerHTML = ''
        document.getElementById('btnExportResults').disabled = false
        openResultsTab(event, 'srcHeatmapTab', results)
    });

    btnSummaryCRtab.click()

}

function buildSCR(results, tab){
    /**Function for building the spatial capture-recapture results */

    document.getElementById('statisticsErrors').innerHTML = ''
    if (tab == 'summaryCRtab'){
        var summaryCRtab = document.getElementById('summaryCRtab')
        if (summaryCRtab.firstChild == null){
            var cr = results.cr

            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summaryCRtab.appendChild(row)

            // Capture Recapture
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Capture Recapture'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)
        
            var help = document.createElement('button');
            help.setAttribute('type', 'button');
            help.setAttribute('class', 'btn btn-link btn-sm');
            help.setAttribute('align', 'left');
            help.setAttribute('value', 'help');
            help.setAttribute('data-toggle', 'tooltip');
            help.setAttribute('title', 'Help');
            help.setAttribute('onclick', 'helpOpen(\'capture_recapture\')');
            help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
            row.appendChild(help);

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'summaryCRTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

            var h5 = document.createElement('h5')
            h5.innerHTML = '<div><i> The following table displays the Capture Recapture results. It displays abundance estimates for your species calculated by different models without the use of any spatial information. </i></div>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            summaryCRtab.appendChild(h5)

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

                summaryCRtab.appendChild(table)
            }
            else{
                var h5 = document.createElement('h5')
                h5.innerHTML = 'No capture recapture results could be generated. Please ensure that your data is correct. '
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px; color: #DF691A;')
                summaryCRtab.appendChild(h5)
            }
            summaryCRtab.appendChild(document.createElement('br'))
        }
    }
    else if (tab == 'summarySCRtab'){
        var summarySCRtab = document.getElementById('summarySCRtab')
        if (summarySCRtab.firstChild == null){
            var density = results.density
            var abundance = results.abundance
            var det_prob = results.det_prob
            var sigma = results.sigma
            var summary = results.summary
            var aic = results.aic
            var message = results.message

            // Spatial Capture Recapture
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Spatial Capture Recapture'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            if (message != ''){
                var h5 = document.createElement('h5')
                h5.innerHTML = message
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px; color: #DF691A;')
                summarySCRtab.appendChild(h5)
            }
        
            var help = document.createElement('button');
            help.setAttribute('type', 'button');
            help.setAttribute('class', 'btn btn-link btn-sm');
            help.setAttribute('align', 'left');
            help.setAttribute('value', 'help');
            help.setAttribute('data-toggle', 'tooltip');
            help.setAttribute('title', 'Help');
            help.setAttribute('onclick', 'helpOpen(\'spatial_capture_recapture\')');
            help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
            row.appendChild(help);

            // Spatial Capture Recapture Summary 
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'SCR Data Summary'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'summarySRCTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

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
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'AIC'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'aicTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

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
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Density per 100km<sup>2</sup>'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'densityTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

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
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Abundance'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'abundanceTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

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
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Detection Probability'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'detProbTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

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
            var row = document.createElement('div')
            row.classList.add('row')
            row.setAttribute('style','margin:0px')
            summarySCRtab.appendChild(row)

            var h5 = document.createElement('h5')
            h5.innerHTML = 'Space use (&sigma;) in km'
            h5.setAttribute('style', 'margin-bottom: 2px;')
            row.appendChild(h5)

            var copyClipboard = document.createElement('button');
            copyClipboard.setAttribute('type', 'button');
            copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
            copyClipboard.setAttribute('align', 'left');
            copyClipboard.setAttribute('data-toggle', 'tooltip');
            copyClipboard.setAttribute('title', 'Copy to clipboard');
            copyClipboard.setAttribute('onclick', "copyToClipboard(\'" + 'sigmaTable' + "\')");
            copyClipboard.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
            copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
            row.appendChild(copyClipboard);

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
        
        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        spatialCapturesTab.appendChild(row)
    
        // Builds the tab for the spatial captures plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'Spatial Captures'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        row.appendChild(h5)
    
        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'spatial_captures\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

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
        
        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        stateSpaceTab.appendChild(row)
    
        // Builds the tab for the state space plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'State Space'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        row.appendChild(h5)
    
        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'state_space\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);
        
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
        if (results.raster.length > 0){
            var max_density = results.raster[results.raster.length - 1].max_density
            var map_densities = results.raster.slice(0, -1)
        }
        else{
            var max_density = 0
            var map_densities = []
        }
        var sites_density = results.sites_density
        var indiv_counts = results.indiv_counts

        while(densityMapTab.firstChild){
            densityMapTab.removeChild(densityMapTab.firstChild)
        }
        
        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        densityMapTab.appendChild(row)
    
        // Builds the tab for the density map plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'Density Map'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        row.appendChild(h5)
    
        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'density_map\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

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
                    var map_id = 'mapDiv_densityMap'
                    var mapDiv = document.getElementById(map_id)

                    if (map[map_id]){
                        map[map_id].remove()
                    }

                    while (mapDiv.firstChild){
                        mapDiv.removeChild(mapDiv.firstChild)
                    }

                    if (densities.length > 0){
                        document.getElementById('DHM_OptionsDiv').hidden = false
                        document.getElementById('radiusSliderDHM').value = 54
                        initialiseDensityHeatmap(densities, max_density, sites_density, map_id)
                    }
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

        // Slider and checkboxex
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

        $("#radiusSliderDHM").change( function(){

            scale = document.getElementById('radiusSliderDHM').value
            scale = logslider(scale)   

            densHeatmapLayer.cfg.radius = scale
            densHeatmapLayer._update()
        });
            

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

        densityMapTab.appendChild(document.createElement('br'))

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

        var map_id = 'mapDiv_densityMap'
        var mapDiv = document.createElement('div')
        mapDiv.setAttribute('id',map_id)
        mapDiv.setAttribute('style','height: 750px')
        col1.appendChild(mapDiv)

        space = document.createElement('div')
        space.classList.add('col-lg-1')
        div.appendChild(space)

        densityMapTab.appendChild(document.createElement('br'))

        document.getElementById('DHM_OptionsDiv').hidden = true
        document.getElementById('densityMap_heatmap').click()

    }
    else if (tab == 'srcHeatmapTab'){
        var max_count = results.individual_counts[results.individual_counts.length - 1].max_count
        var indiv_counts = results.individual_counts.slice(0, -1)
        var srcHeatmapTab = document.getElementById('srcHeatmapTab')

        while(srcHeatmapTab.firstChild){
            srcHeatmapTab.removeChild(srcHeatmapTab.firstChild)
        }
        
        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute('style','margin:0px')
        srcHeatmapTab.appendChild(row)
    
        // Builds the tab for the heatmap plot
        var h5 = document.createElement('h5')
        h5.innerHTML = 'Individual Counts Heatmap'
        h5.setAttribute('style', 'margin-bottom: 2px;')
        row.appendChild(h5)
    
        var help = document.createElement('button');
        help.setAttribute('type', 'button');
        help.setAttribute('class', 'btn btn-link btn-sm');
        help.setAttribute('align', 'left');
        help.setAttribute('value', 'help');
        help.setAttribute('data-toggle', 'tooltip');
        help.setAttribute('title', 'Help');
        help.setAttribute('onclick', 'helpOpen(\'individual_counts\')');
        help.setAttribute('style', 'font-size: 1.10em; padding: 0px; margin-left: 5px; margin-bottom: 0px;');
        help.innerHTML = '<i class="fa fa-question" aria-hidden="true"></i>'
        row.appendChild(help);

        h5 = document.createElement('h5')
        h5.innerHTML = '<div><i> The following map displays a heatmap of the individual counts at each site. The heatmap is a representation of the density of the individuals at each site. The darker the colour, the higher the density of individuals. </i></div>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        srcHeatmapTab.appendChild(h5)

        // Slider and checkboxex
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

    spatialExportControl = L.control.bigImage({position: 'topright', maxScale: 1}).addTo(map[map_id]);
}

function getSCRcsv(check=false){
    /** Gets the CSV for the SCR results. */
    if (check) {
        var species = '0'
        var tasks = '0'
        var validSCR = true 
        var validDates = true
        var formData = new FormData();
    }
    else{
        var tasks = getSelectedTasks()
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
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

        var selected = getSelectedSites(true)
        var sites_text = selected[0]
        var groups_text = selected[1]
        var validSCR = validateSCR(species, sites_text, groups_text, tags, startDate, endDate, observationWindow)
        var validDates = checkDates()
    
        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('trapgroups', JSON.stringify(sites));
        formData.append('species', JSON.stringify(species));
        formData.append('window', JSON.stringify(observationWindow));
        formData.append('tags', JSON.stringify(tags));
        formData.append('siteCovs', JSON.stringify(globalSiteCovariates));
        formData.append('covOptions', JSON.stringify(globalCovariateOptions));
        formData.append('csv', JSON.stringify('1'));
        formData.append('groups', JSON.stringify(groups));

        if(startDate != ''){
            startDate = startDate + ' 00:00:00'
            formData.append('startDate', JSON.stringify(startDate));
        }
    
        if(endDate != ''){
            endDate = endDate + ' 23:59:59'
            formData.append('endDate', JSON.stringify(endDate));
        }
    }

    if (species != '-1' && validSCR && tasks != '-1' && validDates){

        document.getElementById('rErrors').innerHTML = 'Downloading CSV...'
        disablePanel()
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if(reply.status == 'SUCCESS'){
                    clearTimeout(timeout)
                    csv_urls = reply.results
                    downloadCSV(csv_urls)      
                    document.getElementById('rErrors').innerHTML = ''
                    enablePanel()
                }
                else if(reply.status == 'FAILURE'){
                    document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                    enablePanel()
                }
                else if(reply.status == 'NO_INDIVIDUALS'){
                    document.getElementById('rErrors').innerHTML = 'No individuals were found for the selected species. Please try again.'
                    enablePanel()
                }
                else {
                    timeout = setTimeout(function(){getSCRcsv(true)}, 10000);
                }

            }
            else if (this.readyState == 4 && this.status != 200) {
                document.getElementById('rErrors').innerHTML = 'An error occured while downloading the CSV. Please try again.'
                enablePanel()
            }
        }
        xhttp.open("POST", '/getSpatialCaptureRecapture');
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

$('#timeToIndependence').on('change', function(){
    /**Function for updating the time to independence div. */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection != 0 && analysisSelection != 5 && analysisSelection != 6){
        updateResults()
    }
})

$('#timeToIndependenceUnit').on('change', function(){
    /**Function for updating the time to independence div. */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection != 0 && analysisSelection != 5 && analysisSelection != 6){
        updateResults()
    }
})


window.onclick = function() { 
    activity = true
}

function pingServer() {
    /** Pings the server to let it know that the user is still active. */
    analysisSelector = document.getElementById('analysisSelector')
    analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    if (activity) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
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

function buildSurveyAndAsRow(){
    /**Function for building the survey and annotation set row in data selection tab */
    var surveyAndAsDiv = document.getElementById('surveyAndAsDiv')
    var IDNum = getIdNumforNext('surveySelect-')

    var containingDiv = document.createElement('div')
    containingDiv.id = 'sasDiv-' + IDNum
    surveyAndAsDiv.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-5')
    col1.style.paddingRight = '0px'
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-5')
    col2.style.paddingRight = '0px'
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    //Survey Select
    var surveySelect = document.createElement('select')
    surveySelect.classList.add('form-control')
    surveySelect.setAttribute('id', 'surveySelect-' + IDNum)
    col1.appendChild(surveySelect)

    if (IDNum != 0){
        var surveyOptionsTexts = []
        var surveyOptionsValues = []
    }
    else{
        var surveyOptionsTexts = ['All']
        var surveyOptionsValues = ['0']
    }

    for (let i=0; i<globalSurveys.length; i++){
        surveyOptionsTexts.push(globalSurveys[i].name)
        surveyOptionsValues.push(globalSurveys[i].id)
    }

    clearSelect(surveySelect)
    fillSelect(surveySelect, surveyOptionsTexts, surveyOptionsValues)

    $('#'+surveySelect.id).on('change', function(){
        var IDNum = this.id.split('-')[1]
        var asSelect = document.getElementById('asSelect-' + IDNum)
        var surveyID = this.value
        var asOptionsTexts = []
        var asOptionsValues = []

        if (surveyID == 0){
            clearSelect(asSelect)
            document.getElementById('annotationSetDiv').hidden = false
        }
        else{
            surveyTasks = globalTasks[surveyID]
            for (let i=0; i<surveyTasks.length; i++){
                asOptionsTexts.push(surveyTasks[i].name)
                asOptionsValues.push(surveyTasks[i].id)
            }
            clearSelect(asSelect)
            fillSelect(asSelect, asOptionsTexts, asOptionsValues)
            document.getElementById('annotationSetDiv').hidden = true
        }
    })

    //Annotation Set Select
    var asSelect = document.createElement('select')
    asSelect.classList.add('form-control')
    asSelect.setAttribute('id', 'asSelect-' + IDNum)
    col2.appendChild(asSelect)

    clearSelect(asSelect)

    if (IDNum != 0){
        var asOptionsTexts = []
        var asOptionsValues = []
        var tasks = globalTasks[globalSurveys[0].id]
        for (let i=0; i<tasks.length; i++){
            asOptionsTexts.push(tasks[i].name)
            asOptionsValues.push(tasks[i].id)
        }
        fillSelect(asSelect, asOptionsTexts, asOptionsValues)
    }

    //Remove Button
    if (IDNum != 0){
        var removeButton = document.createElement('button')
        removeButton.id = 'btnRemoveSAS-'+IDNum;
        removeButton.setAttribute("class",'btn btn-default');
        removeButton.innerHTML = '&times;'
        col3.appendChild(removeButton)

        $('#'+removeButton.id).on('click', function(){
            var IDNum = this.id.split('-')[1]
            var containingDiv = document.getElementById('sasDiv-' + IDNum)
            containingDiv.parentNode.removeChild(containingDiv)
        })
    }
    
}

function saveDataSelection(){
    /**Function for saving the data selection. */

    var allTaskSelctors =  document.querySelectorAll('[id^=asSelect-]')
    var allSurveySelctors =  document.querySelectorAll('[id^=surveySelect-]')
    var allMultipleAnnotationSets = document.querySelectorAll('[id^=annotationSetSelect-]')

    var validDataSelection = true
    var error = ""
    if (allSurveySelctors[0].value == 0 && allSurveySelctors.length > 1){
        validDataSelection = false
        error = "Please select either All surveys or multiple surveys. You cannot select both."
    }

    if (validDataSelection){
        selectedATasks = []

        if (allSurveySelctors[0].value == 0){
            if (allMultipleAnnotationSets.length == 0){
                taskIDs = ['0']
            }
            else{
                var taskIDs = []
                for (let i=0; i<allMultipleAnnotationSets.length; i++){
                    if (allMultipleAnnotationSets[i].value){
                        taskIDs.push(allMultipleAnnotationSets[i].value)
                    }
                }

                for (let i=0; i<globalSurveys.length; i++){
                    var surveyTasks = globalTasks[globalSurveys[i].id]
                    if (surveyTasks.length == 1){
                        taskIDs.push(surveyTasks[0].id.toString())
                    }
                }
            }
        }
        else{
            var taskIDs = []
            for (let i=0; i<allTaskSelctors.length; i++){
                if (allTaskSelctors[i].value){
                    taskIDs.push(allTaskSelctors[i].value)
                }
            }
        }

        selectedTasks = taskIDs
        // document.getElementById('dataSelectionError').innerHTML = ''
    }
    else{
        selectedTasks = '-1'
        // document.getElementById('dataSelectionError').innerHTML = error
    }

}

function cancelResults(){
    /**Function for cancelling the R results. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)

            document.getElementById('rErrors').innerHTML = ''
            document.getElementById('loadingDiv').style.display = 'none'
            document.getElementById('loadingCircle').style.display = 'none'
            document.getElementById('resultsDiv').style.display = 'block'
            document.getElementById('statisticsErrors').innerHTML = ''
            enablePanel()
            while (document.getElementById('resultsDiv').firstChild) {
                document.getElementById('resultsDiv').removeChild(document.getElementById('resultsDiv').firstChild);
            }
            activeImage = {}
            clearTimeout(timeout)
            
        }
    }
    xhttp.open("POST", '/cancelResults');
    xhttp.send();
}

function copyToClipboard(id) {
    /**Function for copying table to clipboard. */
    var table = document.getElementById(id)

    var tableExport = table.cloneNode(true);
    tableExport.style.backgroundColor = 'white';
    tableExport.style.color = 'black';
    document.body.appendChild(tableExport);

    var range = document.createRange();
    range.selectNode(tableExport);
    window.getSelection().addRange(range);
    document.execCommand('copy');
    document.body.removeChild(tableExport);
    window.getSelection().removeAllRanges();

    document.getElementById('statisticsErrors').innerHTML = 'Table copied to clipboard.'
}


$('#backgroundSelector').on('change', function(){
    /**Function for updating the chart colours. */
    this.style.backgroundColor = 'white'
    if (this.value.includes('c-')){
        document.getElementById('bgColourPicker').click()
    }
    else{
        updateChartStyle()
    }
});

$('#textColourSelector').on('change', function(){
    /**Function for updating the chart colours. */
    this.style.backgroundColor = 'white'
    if (this.value.includes('c-')){
        document.getElementById('textColourPicker').click()
    }
    else{
        updateChartStyle()
    }
});

$('#axisColourSelector').on('change', function(){
    /**Function for updating the chart colours. */
    this.style.backgroundColor = 'white'
    if (this.value.includes('c-')){
        document.getElementById('axisColourPicker').click()
    }
    else{
        updateChartStyle()
    }
});

$('#borderColourSelector').on('change', function(){
    /**Function for updating the chart colours. */
    this.style.backgroundColor = 'white'
    if (this.value.includes('c-')){
        document.getElementById('borderColourPicker').click()
    }
    else{
        updateChartStyle()
    }
});

$('#bgColourPicker').on('change', function(){
    /**Function for updating the chart colours. */
    var selector = document.getElementById('backgroundSelector')
    var colour = this.value
    selector[selector.selectedIndex].value = 'c-' + colour
    selector.style.backgroundColor = this.value
    updateChartStyle()
});

$('#textColourPicker').on('change', function(){
    /**Function for updating the chart colours. */
    var selector = document.getElementById('textColourSelector')
    var colour = this.value
    selector[selector.selectedIndex].value = 'c-' + colour
    selector.style.backgroundColor = this.value
    updateChartStyle()
});

$('#axisColourPicker').on('change', function(){
    /**Function for updating the chart colours. */
    var selector = document.getElementById('axisColourSelector')
    var colour = this.value
    selector[selector.selectedIndex].value = 'c-' + colour
    selector.style.backgroundColor = this.value
    updateChartStyle()
});

$('#borderColourPicker').on('change', function(){
    /**Function for updating the chart colours. */
    var selector = document.getElementById('borderColourSelector')
    var colour = this.value
    selector[selector.selectedIndex].value = 'c-' + colour
    selector.style.backgroundColor = this.value
    updateChartStyle()
});


function onload(){
    /**Function for initialising the page on load.*/
    getSurveysAndAnnotationSets()
    document.getElementById("openDataTab").click();
    barData = {}
    polarData = {}
    lineData = {}
    // getLabelsSitesTagsAndGroups()
    generateResults()
    pingServer()
    initialiseGroups()
    cancelResults()
}

window.addEventListener('load', onload, false);
