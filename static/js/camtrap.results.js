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


// function addSurveys(){
//     /** Adds the survey and annotation set selectors to the page */
//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             surveys = JSON.parse(this.responseText);  
//             buildSurveySelect()
//         }
//     }
//     xhttp.open("GET", '/getSurveys');
//     xhttp.send();

//     var addSurveyTask = document.getElementById('addSurveyTask')
    
//     row = document.createElement('div')
//     row.classList.add('row')
//     addSurveyTask.appendChild(row)

//     col = document.createElement('div')
//     col.classList.add('col-lg-3')
//     row.appendChild(col)

//     btnAdd = document.createElement('button');
//     btnAdd.setAttribute("class",'btn btn-info');
//     btnAdd.innerHTML = '&plus;';
//     btnAdd.addEventListener('click', ()=>{
//         buildSurveySelect()
//         checkSurvey()
//     });
//     col.appendChild(btnAdd);
// }

// function buildSurveySelect(){
//     /** Builds the selectors for the surveys and annotation sets */

//     IDNum = getIdNumforNext('idSurveySelect-')
//     surveySelect = document.getElementById('surveySelect')

//     row = document.createElement('div')
//     row.classList.add('row')
//     surveySelect.appendChild(row)

//     col1 = document.createElement('div')
//     col1.classList.add('col-lg-8')
//     row.appendChild(col1)

//     col3 = document.createElement('div')
//     col3.classList.add('col-lg-2')
//     col3.setAttribute('style','padding: 0px;')
//     row.appendChild(col3)
    

//     if (IDNum > 0) {
//         col1.appendChild(document.createElement('br'))
//         col3.appendChild(document.createElement('br'))
//     }
    
//     idSurveySelect = document.createElement('select')
//     idSurveySelect.classList.add('form-control')
//     idSurveySelect.id = 'idSurveySelect-'+String(IDNum)
//     idSurveySelect.name = idSurveySelect.id
//     col1.appendChild(idSurveySelect)

//     idTaskSelect = document.createElement('select')
//     idTaskSelect.classList.add('form-control')
//     idTaskSelect.id = 'idTaskSelect-'+String(IDNum)
//     idTaskSelect.name = idTaskSelect.id
//     col1.appendChild(idTaskSelect)
    

//     if (surveys != null) {
        
//         if(IDNum==0){
//             optionTexts = ['All']
//             optionValues = ["0"]  
//             fillSelect(idTaskSelect, [''], ['0'])
//         }
//         else{
//             optionTexts = ['None']
//             optionValues = ['-1'] 
//             fillSelect(idTaskSelect, [''], ['-1'])
//         }

//         for (let i=0;i<surveys.length;i++) {
//             optionTexts.push(surveys[i][1])
//             optionValues.push(surveys[i][0])
//         }
//         clearSelect(idSurveySelect)
//         fillSelect(idSurveySelect, optionTexts, optionValues)
        
        
//     }

//     if (IDNum!=0) {
//         btnRemove = document.createElement('button');
//         btnRemove.setAttribute("class",'btn btn-info');
//         btnRemove.innerHTML = '&times;';
//         btnRemove.addEventListener('click', (evt)=>{
//             evt.target.parentNode.parentNode.remove();
//             checkSurvey()
//             updateResults(true)

//         });
//         col3.appendChild(btnRemove);
//     }

//     $("#"+idSurveySelect.id).change( function(wrapIDNum) {
//         return function() {

//             idSurveySelect = document.getElementById('idSurveySelect-'+String(wrapIDNum))
//             idTaskSelect = document.getElementById('idTaskSelect-'+String(wrapIDNum))
            
//             survey = idSurveySelect.options[idSurveySelect.selectedIndex].value
//             if (survey=="0" || survey=="-1") {
//                 clearSelect(idTaskSelect)
//                 fillSelect(idTaskSelect, [''], ['0'])
//                 checkSurvey()
//                 updateResults(true)
//             } else {
//                 var xhttp = new XMLHttpRequest();
//                 xhttp.onreadystatechange =
//                 function(wrapidTaskSelect){
//                     return function() {
//                         if (this.readyState == 4 && this.status == 200) {
//                             tasks = JSON.parse(this.responseText);  
//                             optionTexts = []      
//                             optionValues = []
//                             for (let i=0;i<tasks.length;i++) {
//                                 optionTexts.push(tasks[i][1])
//                                 optionValues.push(tasks[i][0])
//                             }
//                             clearSelect(wrapidTaskSelect)
//                             fillSelect(wrapidTaskSelect, optionTexts, optionValues)
 
//                             checkSurvey()
//                             updateResults(true)
//                         }
//                     }
//                 }(idTaskSelect)
//                 xhttp.open("GET", '/getTasks/'+survey);
//                 xhttp.send();
//             }
//         }
//     }(IDNum));

//     $("#"+idTaskSelect.id).change( function() {
//         checkSurvey()
//         updateResults(true)
//     })
    
// }

// function checkSurvey(){
//     /** Checks that the slected surveys and annotation sets are valid */

//     var duplicateTask = false
//     var surveyAll = false
//     var noneSurvey = false
//     legalSurvey = false
    
    
//     surveyErrors = document.getElementById('surveysErrors')
//     allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
//     allSurveys = document.querySelectorAll('[id^=idSurveySelect-]') 
    
    
//     while(surveyErrors.firstChild){
//         surveyErrors.removeChild(surveyErrors.firstChild)
//     }    

//     for (let i=0;i<allTasks.length;i++) {
//         currTaskVal = allTasks[i].value
//         for (let j=0;j<allTasks.length;j++) {
//             if(allTasks[j].value == currTaskVal && j!=i){
//                 duplicateTask = true
//             }
//         }
//         if (currTaskVal=='0'){
//             surveyAll = true
//         }
//     }

    
//     if(allSurveys.length == 1 && surveyAll){
//         surveyAll = false
//     }
//     else if(allSurveys.length == 1 && !surveyAll && modalActive){
//         if(allSurveys[0].value == '-1'){
//             noneSurvey = true
//         }
//     }
    

//     if (duplicateTask) {
//         newdiv = document.createElement('div')
//         newdiv.innerHTML =  'You have duplicate annotation sets, please remove the duplicate.'
//         surveyErrors.appendChild(newdiv)
//     }
    

//     if(surveyAll){
//         newdiv = document.createElement('div')
//         newdiv.innerHTML =  'You cannot select all surveys and add additional surveys. Please remove additional surveys or "All" surveys.'
//         surveyErrors.appendChild(newdiv)
//     }


//     if(noneSurvey){
//         newdiv = document.createElement('div')
//         newdiv.innerHTML =  'You have not selected any surveys. Please select a survey.'
//         surveyErrors.appendChild(newdiv)
//     }

//     if (duplicateTask||surveyAll||noneSurvey) {
//         legalSurvey = false
//     } else {
//         legalSurvey = true
//     }
// }

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

    if (allSpeciesSelector.length==0) {
        speciesSelector = document.getElementById('speciesSelect')
        if (speciesSelector) {
            clearSelect(speciesSelector)
            var optionValues = ['-1', '0']
            var optionTexts = ['None', 'All']
            optionValues = optionValues.concat(globalLabels)
            optionTexts = optionTexts.concat(globalLabels)
            fillSelect(speciesSelector, optionTexts, optionValues)
        }

        siteSelector = document.getElementById('trapgroupSelect')
        if (siteSelector) {
            clearSelect(siteSelector)
            optionValues = ['-1', '0']
            optionTexts = ['None', 'All']
            optionValues = optionValues.concat(globalSitesIDs)
            optionTexts = optionTexts.concat(globalSites)
            fillSelect(siteSelector, optionTexts, optionValues)
        }
    }
    else{
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
    }
}


function generateResults(){
    /** Updates the generate results div based on the selected analysis type */
    var generateDiv = document.getElementById('generateDiv')
    var analysisType = document.getElementById('analysisSelector').value
    var resultsDiv = document.getElementById('resultsDiv')

    while(generateDiv.firstChild){
        generateDiv.removeChild(generateDiv.firstChild)
    }

    while(resultsDiv.firstChild){
        resultsDiv.removeChild(resultsDiv.firstChild)
    }    

    if (analysisType=='1') {
        //Builds the selectors for the temporal analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeSelector').disabled = false
        document.getElementById('chartTypeSelector').value = 'polarArea'
        generateTemporal()
    }
    else if (analysisType=='2') {
        //Builds the selectors for the spatial analysis
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeSelector').disabled = true
        generateSpatial()
    }
    else if (analysisType=='3') {
        //Builds the selectors for the numerical analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeSelector').disabled = false
        document.getElementById('chartTypeSelector').value = 'bar'
        generateNumerical()
    }
    else if (analysisType=='4') {
        //Builds the selectors for the time series analysis
        document.getElementById('btnExportResults').disabled = false
        document.getElementById('chartTypeSelector').disabled = false
        document.getElementById('chartTypeSelector').value = 'line'
        generateTime()
    }
    else{
        document.getElementById('btnExportResults').disabled = true
        document.getElementById('chartTypeSelector').disabled = false
    }

}

function generateTemporal(){
    /** Updates the generate results div for temporal analysis */
    var generateDiv = document.getElementById('generateDiv')

    polarData = {}

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Normalisation'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Normalise the counts using the total count for each item.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)
    
    var row = document.createElement('div')
    row.classList.add('row')
    generateDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','normalisationSelector')
    col1.appendChild(select)

    fillSelect(select, ['Raw Count', 'Normalised'], ['1','2'])
    $("#normalisationSelector").change( function() {
        normalisePolar()
    });

    generateDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Data'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select which site and species combinations you would like to see.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    var selectorColumn = document.createElement('div')
    selectorColumn.setAttribute('id','selectorColumn')
    generateDiv.appendChild(selectorColumn)

    buildSpeciesAndSiteSelectorRow()

    var buttonAdd = document.createElement('button')
    buttonAdd.classList.add('btn')
    buttonAdd.classList.add('btn-info')
    buttonAdd.setAttribute('type','button')
    buttonAdd.setAttribute('id','btnAddSpeciesAndSite')
    buttonAdd.innerHTML = '+'
    generateDiv.appendChild(buttonAdd)

    buttonAdd.addEventListener('click', ()=>{
        buildSpeciesAndSiteSelectorRow()  
    });

    generateDiv.appendChild(document.createElement('br'))

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
            display: true,
            labels: {
                fontColor: 'white'
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
                display: true,
                fontColor: 'white',
                showLabelBackdrop: false
            },
            pointLabels: {
                display: true,
                fontColor: 'white'
            }
        }
    }

    chart = new Chart(ctx, {
        data: data,
        type: 'polarArea',
        options: options
    });

}

function generateSpatial(){
    /** Updates the generate results div for spatial analysis */
    var generateDiv = document.getElementById('generateDiv')

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Sites'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select the sites you would like to see results for.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    selectorColumn = document.createElement('div')
    selectorColumn.setAttribute('id','selectorColumn')
    generateDiv.appendChild(selectorColumn)

    buildSiteSelectorRow()

    var buttonAdd = document.createElement('button')
    buttonAdd.classList.add('btn')
    buttonAdd.classList.add('btn-info')
    buttonAdd.setAttribute('type','button')
    buttonAdd.setAttribute('id','btnAddSites')
    buttonAdd.innerHTML = '+'
    generateDiv.appendChild(buttonAdd)

    buttonAdd.addEventListener('click', ()=>{
        buildSiteSelectorRow()
    });

    generateDiv.appendChild(document.createElement('br'))
    generateDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Species'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select which species you would like to see results for.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    var row = document.createElement('div')
    row.classList.add('row')
    generateDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','speciesSelect')
    col1.appendChild(select)

    fillSelect(select, ['None', 'All'], ['-1','0'])

    $("#speciesSelect").change( function() {
        mapSpeciesSelector = document.getElementById('speciesSelect')
        selection = mapSpeciesSelector.options[mapSpeciesSelector.selectedIndex].value
        if (selection == '0') {
            excludeDiv = document.getElementById('excludeDiv')
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
            excludeDiv = document.getElementById('excludeDiv')
            while(excludeDiv.firstChild){
                excludeDiv.removeChild(excludeDiv.firstChild);
            }
        }
                        
        updateResults()
    });

    generateDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Radius'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Set the heatmap radius to help identify different trends.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    var row = document.createElement('div')
    row.classList.add('row')
    generateDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    slideRow = document.createElement('div')
    slideRow.classList.add('row')
    col1.appendChild(slideRow)

    slidecol1 = document.createElement('div')
    slidecol1.classList.add('col-lg-10')
    slidecol1.setAttribute('style','padding: 0px')
    slidecol1.setAttribute('align','center')
    slideRow.appendChild(slidecol1)

    slidecol2 = document.createElement('div')
    slidecol2.classList.add('col-lg-2')
    slidecol2.setAttribute('style','padding-left: 0px')
    slideRow.appendChild(slidecol2)

    radiusSliderdiv1 = document.createElement('div')
    radiusSliderdiv1.setAttribute('class','justify-content-center')
    slidecol1.appendChild(radiusSliderdiv1)

    radiusSliderdiv2 = document.createElement('div')
    radiusSliderdiv2.setAttribute('class','w-75')
    radiusSliderdiv1.appendChild(radiusSliderdiv2)

    radiusSliderspan = document.createElement('div')
    radiusSliderspan.setAttribute('id','radiusSliderspan')
    radiusSliderspan.setAttribute('align','right')
    radiusSliderspan.setAttribute('style','font-size: 80%')
    radiusSliderspan.innerHTML = '50'
    slidecol2.appendChild(radiusSliderspan)

    radiusSlider = document.createElement('input')
    radiusSlider.setAttribute('type','range')
    radiusSlider.setAttribute('class','custom-range')
    radiusSlider.setAttribute('id','radiusSlider')
    radiusSlider.setAttribute('min','0')
    radiusSlider.setAttribute('max','100')
    radiusSlider.value = 54
    radiusSliderdiv2.appendChild(radiusSlider)

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

    generateDiv.appendChild(document.createElement('br'))

    checkBoxDiv = document.createElement('div')
    checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
    generateDiv.appendChild(checkBoxDiv)

    checkBox = document.createElement('input')
    checkBox.setAttribute('type','checkbox')
    checkBox.setAttribute('class','custom-control-input')
    checkBox.setAttribute('id','markerCheckBox')
    checkBox.setAttribute('name','markerCheckBox')
    checkBox.checked = true
    checkBoxDiv.appendChild(checkBox)

    checkBoxLabel = document.createElement('label')
    checkBoxLabel.setAttribute('class','custom-control-label')
    checkBoxLabel.setAttribute('for','markerCheckBox')
    checkBoxLabel.innerHTML = 'Show Sites'
    checkBoxDiv.appendChild(checkBoxLabel)

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

    checkBoxDiv = document.createElement('div')
    checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
    generateDiv.appendChild(checkBoxDiv)

    checkBox = document.createElement('input')
    checkBox.setAttribute('type','checkbox')
    checkBox.setAttribute('class','custom-control-input')
    checkBox.setAttribute('id','normalisationCheckBox')
    checkBox.setAttribute('name','normalisationCheckBox')
    checkBox.checked = false
    checkBoxDiv.appendChild(checkBox)

    checkBoxLabel = document.createElement('label')
    checkBoxLabel.setAttribute('class','custom-control-label')
    checkBoxLabel.setAttribute('for','normalisationCheckBox')
    checkBoxLabel.innerHTML = 'Normalise for Site Density'
    checkBoxDiv.appendChild(checkBoxLabel)

    $("#normalisationCheckBox").change( function() {
        updateHeatMap()
    });

    checkBoxDiv = document.createElement('div')
    checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
    generateDiv.appendChild(checkBoxDiv)

    checkBox = document.createElement('input')
    checkBox.setAttribute('type','checkbox')
    checkBox.setAttribute('class','custom-control-input')
    checkBox.setAttribute('id','heatMapCheckBox')
    checkBox.setAttribute('name','heatMapCheckBox')
    checkBox.checked = true
    checkBoxDiv.appendChild(checkBox)

    checkBoxLabel = document.createElement('label')
    checkBoxLabel.setAttribute('class','custom-control-label')
    checkBoxLabel.setAttribute('for','heatMapCheckBox')
    checkBoxLabel.innerHTML = 'Show Heat Map'
    checkBoxDiv.appendChild(checkBoxLabel)

    $("#heatMapCheckBox").change( function() {
        if (document.getElementById('heatMapCheckBox').checked) {
            map.addLayer(heatmapLayer)
        } else {
            map.removeLayer(heatmapLayer)
        }
    });

    excludeDiv = document.createElement('div')
    excludeDiv.setAttribute('id','excludeDiv')
    generateDiv.appendChild(excludeDiv)

    if (document.getElementById('speciesSelect').value=='0') {
        excludeDiv.setAttribute('style','display: none')
    }

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

            var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            });

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
                "OpenTopoMap": OpenTopoMap
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

            L.control.bigImage({position: 'topright', maxScale: 1}).addTo(map);
            document.getElementById('print-btn').style.color = 'black'

        }
    }
    xhttp.open("POST", '/getCoords');
    xhttp.send(formData);
}

function generateNumerical(){
    /** Updates the generate results div for numerical analysis */
    var generateDiv = document.getElementById('generateDiv')

    barData = {}
    activeRequest = {}

    getTrapgroups()

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Comparison'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)
    
    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select what type of comparison you would like to do.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    var row = document.createElement('div')
    row.classList.add('row')
    generateDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)
    
    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','xAxisSelector')
    col1.appendChild(select)

    fillSelect(select, ['Survey Counts','Site Counts'], ['1','2'])
    $("#xAxisSelector").change( function() {
        xAxisSelector = document.getElementById('xAxisSelector')
        xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value

        normalDiv = document.getElementById('normalDiv')
        while(normalDiv.firstChild){
            normalDiv.removeChild(normalDiv.firstChild);
        }

        if (xAxisSelection == '1') {
            chart.data.labels = ['Survey Count']
        } else if (xAxisSelection == '2') {
            chart.data.labels = trapgroupNames.slice(2)

            normalDiv.appendChild(document.createElement('br'))

            h5 = document.createElement('h5')
            h5.innerHTML = 'Normalisation'
            h5.setAttribute('style','margin-bottom: 2px')
            normalDiv.appendChild(h5)

            h5 = document.createElement('div')
            h5.innerHTML = '<i>Normalise the counts using the total count for each item to make comparison easier between species with vastly different sighting numbers.</i>'
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            normalDiv.appendChild(h5)

            row = document.createElement('div')
            row.classList.add('row')
            normalDiv.appendChild(row)

            col1 = document.createElement('div')
            col1.classList.add('col-lg-10')
            row.appendChild(col1)
        
            select = document.createElement('select')
            select.classList.add('form-control')
            select.setAttribute('id','normalisationSelector')
            col1.appendChild(select)
        
            fillSelect(select, ['Raw Count', 'Normalised'], ['1','2'])
            $("#normalisationSelector").change( function() {
                normaliseBar()
            });
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

    var normalDiv = document.createElement('div')
    normalDiv.setAttribute('id','normalDiv')
    generateDiv.appendChild(normalDiv)

    generateDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Species'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select the species you would like to see results for.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    selectorColumn = document.createElement('div')
    selectorColumn.setAttribute('id','selectorColumn')
    generateDiv.appendChild(selectorColumn)

    buildSpeciesSelectorRow()

    var buttonAdd = document.createElement('button')
    buttonAdd.classList.add('btn')
    buttonAdd.classList.add('btn-info')
    buttonAdd.setAttribute('type','button')
    buttonAdd.setAttribute('id','btnAddSpecies')
    buttonAdd.innerHTML = '+'
    generateDiv.appendChild(buttonAdd)

    buttonAdd.addEventListener('click', ()=>{
        buildSpeciesSelectorRow()
    });

    generateDiv.appendChild(document.createElement('br'))

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
            display: true,
            labels: {
                fontColor: 'white'
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
                        selector = document.querySelectorAll('[id^=speciesSelect-]')[tooltipItem.datasetIndex]
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
                    fontColor: "white",
                    beginAtZero: true
                },
                // scaleLabel: {
                //     display: true,
                //     labelString: 'Species Count',
                //     fontColor: 'white'
                // }
            }],
            xAxes: [{
                ticks: {
                    fontColor: "white"
                }
            }] 
        }
    }

    chart = new Chart(ctx, {
        data: data,
        type: 'bar',
        options: options
    });




}

function generateTime(){
    /** Updates the generate results div for time series analysis */
    var generateDiv = document.getElementById('generateDiv')

    lineData = {}

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Time Unit'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select the time unit you would like to see your results in.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)
    
    var row = document.createElement('div')
    row.classList.add('row')
    generateDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','timeUnitSelector')
    col1.appendChild(select)

    fillSelect(select, ['Day', 'Month', 'Year'], ['1','2','3'])
    $("#timeUnitSelector").change( function() {
        updateResults()
    });
    select.value = '2'

    generateDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Data'
    h5.setAttribute('style','margin-bottom: 2px')
    generateDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select which site and species combinations you would like to see.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    generateDiv.appendChild(h5)

    var selectorColumn = document.createElement('div')
    selectorColumn.setAttribute('id','selectorColumn')
    generateDiv.appendChild(selectorColumn)

    buildSpeciesAndSiteSelectorRow()

    var buttonAdd = document.createElement('button')
    buttonAdd.classList.add('btn')
    buttonAdd.classList.add('btn-info')
    buttonAdd.setAttribute('type','button')
    buttonAdd.setAttribute('id','btnAddSpeciesAndSite')
    buttonAdd.innerHTML = '+'
    generateDiv.appendChild(buttonAdd)

    buttonAdd.addEventListener('click', ()=>{
        buildSpeciesAndSiteSelectorRow()  
    });

    generateDiv.appendChild(document.createElement('br'))
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
            display: true,
            labels: {
                fontColor: 'white'
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
                    fontColor: "white",
                    beginAtZero: true
                },
                title: {
                    display: true,
                    fontColor: 'white',
                    text: 'Count'
                }
            }],
            xAxes: [{
                ticks: {
                    fontColor: "white"
                }
            }]
        }
    }

    chart = new Chart(ctx, {
        data: data,
        type: 'line',
        options: options
    });


    updateLineData(0)

}

function buildSpeciesAndSiteSelectorRow(){
    /** Builds a row for the species and site selectors */

    var selectorColumn = document.getElementById('selectorColumn')
    var IDNum = getIdNumforNext('speciesSelect-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','speciesSelectDiv-'+String(IDNum))
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

    if (IDNum > 0) {
        col1.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }

    selectorColumn.appendChild(row)


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
        var analysisSelector = document.getElementById('analysisSelector')
        var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
        return function() {
            if (analysisSelection == '1') {
                updatePolarData(wrapIDNum)
                updatePolarErrors()
            }
            else if (analysisSelection == '4') {
                updateLineData(wrapIDNum)
                updateLineErrors()
            }
        }
    }(IDNum));

    
    btnRemove = document.createElement('button');
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
                colour = btnRemove.style.backgroundColor
                if (document.getElementById('chartTypeSelector')){     
                    chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
                } else {
                    chartType = 'polarArea'
                }
                removeData(colour, chartType)
                btnRemove.parentNode.parentNode.remove();
                if (polarData.hasOwnProperty(wrapIDNum.toString())) {
                    delete polarData[wrapIDNum.toString()]
                }
                updatePolarErrors()
            }
            else if (analysisSelection == '4') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                colour = btnRemove.style.backgroundColor
                if (document.getElementById('chartTypeSelector')){     
                    chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
                } else {
                    chartType = 'line'
                }
                removeData(colour, chartType)
                btnRemove.parentNode.parentNode.remove();
                if (lineData.hasOwnProperty(wrapIDNum.toString())) {
                    delete lineData[wrapIDNum.toString()]
                }
                updateLineErrors()
            }
        }
    }(IDNum));
    
}

function buildSpeciesSelectorRow(){
    /** Builds a row for the species and site selectors */

    var selectorColumn = document.getElementById('selectorColumn')
    var IDNum = getIdNumforNext('speciesSelect-')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','speciesSelectDiv-'+String(IDNum))
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
            updateBarData(wrapIDNum)
            updateBarErrors()
        }
    }(IDNum));

    
    btnRemove = document.createElement('button');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.setAttribute("class",'btn btn-default');
    btnRemove.innerHTML = '&times;';
    col3.appendChild(btnRemove);
    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
            colour = btnRemove.style.backgroundColor
            if (document.getElementById('chartTypeSelector')){     
                chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
            } else {
                chartType = 'bar'
            }
            removeData(colour, chartType)
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
    var IDNum = getIdNumforNext('trapgroupSelect-')

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
    siteSelector.id = 'trapgroupSelect-'+String(IDNum)
    col1.appendChild(siteSelector)
    if (IDNum == 0) {
        var siteOptionTexts = ['All']
        var siteOptionValues = ['0']
    }
    else{
        var siteOptionTexts = ['None', 'All']
        var siteOptionValues = ['-1','0']
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
        btnRemove.id = 'btnRemove-'+IDNum;
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                var siteSelector = document.getElementById('trapgroupSelect-'+wrapIDNum)
                console.log(siteSelector)
                var siteText = siteSelector.options[siteSelector.selectedIndex].text.split(' ')
                var lat = siteText[1].split('(')[1].split(',')[0]
                var lng = siteText[2].split(')')[0]

                for (let i=0;i<markers.length;i++) {
                    if (markers[i].getLatLng().lat == lat && markers[i].getLatLng().lng == lng ){
                        if (map.hasLayer(markers[i])) {
                            map.removeLayer(markers[i])
                        }
                        markers.splice(i,1)
                    }
                }

                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                btnRemove.parentNode.parentNode.remove();
                updateHeatMap()
            }
        }(IDNum));
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
        updateHeatMap()
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
}

function updatePolar(){
    /** Updates the polar chart  */
    if (polarData.length == 0) {
        updatePolarData(0)
    }
    else{
        for (let IDNum in polarData) {
            updatePolarData(IDNum)
        }
    }
}

function updateBar(){
    /** Updates the bar chart  */
    if (barData.length == 0) {
        updateBarData(0)
    }
    else{
        for (let IDNum in barData) {
            updateBarData(IDNum)
        }
    }
}

function updateLine(){
    /** Updates the line chart  */
    if (lineData.length == 0) {
        updateLineData(0)
    }
    else{
        for (let IDNum in lineData) {
            updateLineData(IDNum)
        }
    }
}

function updateMap(){
    /** Updates the map */

    var validSites = checkSites()
    var tasks = getSelectedTasks()
    var sites = getSelectedSites(true)

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
    //* Gets all the selected tasks from the task selectors*/
    // var tasks = []
    // var allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    // for (let i=0;i<allTasks.length;i++) {
    //     if (allTasks[i].value != '-1' && allTasks[i].value != '0'){
    //         tasks.push(allTasks[i].value)
    //     }
    // }

    // if (tasks.length==0) {
    //     tasks.push('0')
    // }

    // return tasks

    return ['0']
}

function getSelectedSites(text=false){
    //* Gets all the selected sites from the site selectors*/
    var sites = []
    var allSites = document.querySelectorAll('[id^=trapgroupSelect-]')
    console.log(allSites)
    if (text) {
        for (let i=0;i<allSites.length;i++) {
            if (allSites[i].options[allSites[i].selectedIndex].text.includes(' ')){
                let split = allSites[i].options[allSites[i].selectedIndex].text.split(' ')
                console.log(split)  
                let site = split[0] + ',' + split[1].split('(')[1].split(',')[0] + ',' + split[2].split(')')[0]
                sites.push(site)
            }
        }
    }
    else{    
        for (let i=0;i<allSites.length;i++) {
            if (allSites[i].value.includes(',')){
                let split = allSites[i].value.split(',')
                sites.push(...split)
            }
        }
    }


    if (sites.length==0) {
        sites = '0'
    }
    console.log(sites)
    return sites
}

function checkSites(){
    var valid = true
    var allSites = document.querySelectorAll('[id^=trapgroupSelect-]')
    for (let i=0;i<allSites.length;i++) {
        if (allSites[i].value.includes('-1')) {
            valid = false
        }
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
                display: true,
                labels: {
                    fontColor: 'white',
                    generateLabels: function (chart) {
                        var datasets = chart.data.datasets; // Move the declaration here
                        var labels = [];
    
                        for (let i = 0; i < datasets.length; i++) {
                            var dataset = datasets[i];
                            var label = dataset.label;
                            var fillStyle = dataset.backgroundColor;
                            var borderColor = dataset.borderColor;
                            labels.push({
                                text: label,
                                fillStyle: fillStyle,
                                borderColor: borderColor
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
                    display: true,
                    fontColor: 'white',
                    showLabelBackdrop: false
                },
                pointLabels: {
                    display: true,
                    fontColor: 'white'
                }
            }

        }
    } else if (chartType == 'bar') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: true,
                labels: {
                    fontColor: 'white'
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
                        fontColor: "white",
                        beginAtZero: true
                    },
                    title: {
                        display: true,
                        fontColor: 'white',
                        text: 'Count'
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor: "white"
                    }
                }]
            }
        }
    } else if (chartType == 'line') {
        fillData = false
        options = {
            maintainAspectRatio: false,
            legend: {
                display: true,
                labels: {
                    fontColor: 'white'
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
                        fontColor: "white",
                        beginAtZero: true
                    },
                    title: {
                        display: true,
                        fontColor: 'white',
                        text: 'Count'
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor: "white"
                    }
                }]
            }
        }

    } else if (chartType == 'scatter') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: true,
                labels: {
                    fontColor: 'white'
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
                        fontColor: "white",
                        beginAtZero: true
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor: "white",
                    },
                    type: 'category',
                    labels: labels
                    
                }],
                y : {
                    title: {
                        display: true,
                        fontColor: 'white',
                        text: 'Count'
                    }
                }
            }
        };

    } else if (chartType == 'radar') {
        options = {
            maintainAspectRatio: false,
            legend: {
                display: true,
                labels: {
                    fontColor: 'white'
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
                    display: true,
                    fontColor: 'white',
                    showLabelBackdrop: false
                },
                pointLabels: {
                    display: true,
                    fontColor: 'white'
                }
            }
        }
    }

    data = updateChartData(chartType, data, fillData)

    chart.destroy()

    var ctx = document.getElementById('statisticsChart').getContext('2d');

    chart = new Chart(ctx, {
        data: data,
        type: chartType,
        options: options
    });

}

function updateChartData(chartType, data, fillData){
    /**Updates the chart data to a different chart type*/

    for (let i=0;i<data.datasets.length;i++) {
        data.datasets[i].fill = fillData
        if (chartType == 'line') {
            data.datasets[i].borderColor = data.datasets[i].backgroundColor
            data.datasets[i].borderWidth = 2
            data.datasets[i].tension = 0.1

        }
        else{
            data.datasets[i].borderColor = 'rgba(255,255,255,1)'
            data.datasets[i].hoverBackgroundColor = 'rgba(255,255,255,0.2)'
            data.datasets[i].borderWidth = 1
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
            if (data.datasets[i].data[0].x != undefined) {
                for (let j=0;j<data.datasets[i].data.length;j++) {
                    data.datasets[i].data[j] = data.datasets[i].data[j].y
                }
            }
        }
    }

    return data

}

$('#analysisSelector').on('change', function() {
    clearChartColours()
    generateResults()
    updateLabelsAndSites()
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

function clearResults(){
    /** Clears the results div */
    var resultsDiv = document.getElementById('resultsDiv')
    while(resultsDiv.firstChild){
        resultsDiv.removeChild(resultsDiv.firstChild);
    }

    var generateDiv = document.getElementById('generateDiv')
    while(generateDiv.firstChild){
        generateDiv.removeChild(generateDiv.firstChild);
    }

    document.getElementById('dateErrors').innerHTML = ''
    document.getElementById('statisticsErrors').innerHTML = ''
    document.getElementById('analysisSelector').value = '-1'
    document.getElementById('baseUnitSelector').value = '2'
    document.getElementById('startDate').value = ''
    document.getElementById('endDate').value = ''
    document.getElementById('chartTypeSelector').value = 'line'
    document.getElementById('chartTypeSelector').disabled = false
    document.getElementById('btnExportResults').disabled = true

    clearChartColours()

    timeLabels = []
}

function exportResults(){
    /** Exports the charts to an image */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value
    if (analysisSelection != '2'){
        var canvas = document.getElementById('statisticsChart')
        var image = canvas.toDataURL("image/png", 1.0).replace("image/png", "image/octet-stream");
        var link = document.createElement('a');
        link.download = 'chart.png';
        link.href = image;
        link.click();
    }

}

function onload(){
    /**Function for initialising the page on load.*/
    // addSurveys()
    getLabelsAndSites()
    // getGroups()
}

window.addEventListener('load', onload, false);
