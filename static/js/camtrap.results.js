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

var globalLabels = []
var globalSites = []
var chart = null
var trapgroupNames
var trapgroupValues
var polarData = {}
var barData = {}
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


function addSurveys(){
    /** Adds the survey and annotation set selectors to the page */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            buildSurveySelect()
        }
    }
    xhttp.open("GET", '/getSurveys');
    xhttp.send();

    var addSurveyTask = document.getElementById('addSurveyTask')
    
    row = document.createElement('div')
    row.classList.add('row')
    addSurveyTask.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-3')
    row.appendChild(col)

    btnAdd = document.createElement('button');
    btnAdd.setAttribute("class",'btn btn-info');
    btnAdd.innerHTML = '&plus;';
    btnAdd.addEventListener('click', ()=>{
        buildSurveySelect()
        checkSurvey()
    });
    col.appendChild(btnAdd);
}

function buildSurveySelect(){
    /** Builds the selectors for the surveys and annotation sets */

    IDNum = getIdNumforNext('idSurveySelect-')
    surveySelect = document.getElementById('surveySelect')

    row = document.createElement('div')
    row.classList.add('row')
    surveySelect.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-8')
    row.appendChild(col1)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.setAttribute('style','padding: 0px;')
    row.appendChild(col3)
    

    if (IDNum > 0) {
        col1.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }
    
    idSurveySelect = document.createElement('select')
    idSurveySelect.classList.add('form-control')
    idSurveySelect.id = 'idSurveySelect-'+String(IDNum)
    idSurveySelect.name = idSurveySelect.id
    col1.appendChild(idSurveySelect)

    idTaskSelect = document.createElement('select')
    idTaskSelect.classList.add('form-control')
    idTaskSelect.id = 'idTaskSelect-'+String(IDNum)
    idTaskSelect.name = idTaskSelect.id
    col1.appendChild(idTaskSelect)
    

    if (surveys != null) {
        
        if(IDNum==0){
            optionTexts = ['All']
            optionValues = ["0"]  
            fillSelect(idTaskSelect, [''], ['0'])
        }
        else{
            optionTexts = ['None']
            optionValues = ['-99999'] 
            fillSelect(idTaskSelect, [''], ['-99999'])
        }

        for (let i=0;i<surveys.length;i++) {
            optionTexts.push(surveys[i][1])
            optionValues.push(surveys[i][0])
        }
        clearSelect(idSurveySelect)
        fillSelect(idSurveySelect, optionTexts, optionValues)
        
        
    }

    if (IDNum!=0) {
        btnRemove = document.createElement('button');
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.remove();
            checkSurvey()
            updateResults(true)

        });
        col3.appendChild(btnRemove);
    }

    $("#"+idSurveySelect.id).change( function(wrapIDNum) {
        return function() {

            idSurveySelect = document.getElementById('idSurveySelect-'+String(wrapIDNum))
            idTaskSelect = document.getElementById('idTaskSelect-'+String(wrapIDNum))
            
            survey = idSurveySelect.options[idSurveySelect.selectedIndex].value
            if (survey=="0" || survey=="-99999") {
                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, [''], ['0'])
                checkSurvey()
                // getLabelsAndSites()
                updateResults(true)
            } else {
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(wrapidTaskSelect){
                    return function() {
                        if (this.readyState == 4 && this.status == 200) {
                            tasks = JSON.parse(this.responseText);  
                            optionTexts = []      
                            optionValues = []
                            for (let i=0;i<tasks.length;i++) {
                                optionTexts.push(tasks[i][1])
                                optionValues.push(tasks[i][0])
                            }
                            clearSelect(wrapidTaskSelect)
                            fillSelect(wrapidTaskSelect, optionTexts, optionValues)
 
                            checkSurvey()
                            // getLabelsAndSites()
                            updateResults(true)
                        }
                    }
                }(idTaskSelect)
                xhttp.open("GET", '/getTasks/'+survey);
                xhttp.send();
            }
        }
    }(IDNum));

    $("#"+idTaskSelect.id).change( function() {
        checkSurvey()
        // getLabelsAndSites()
        updateResults(true)
    })
    
}

function checkSurvey(){
    /** Checks that the slected surveys and annotation sets are valid */

    var duplicateTask = false
    var surveyAll = false
    var noneSurvey = false
    legalSurvey = false
    
    
    surveyErrors = document.getElementById('surveysErrors')
    allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    allSurveys = document.querySelectorAll('[id^=idSurveySelect-]') 
    
    
    while(surveyErrors.firstChild){
        surveyErrors.removeChild(surveyErrors.firstChild)
    }    

    for (let i=0;i<allTasks.length;i++) {
        currTaskVal = allTasks[i].value
        for (let j=0;j<allTasks.length;j++) {
            if(allTasks[j].value == currTaskVal && j!=i){
                duplicateTask = true
            }
        }
        if (currTaskVal=='0'){
            surveyAll = true
        }
    }

    
    if(allSurveys.length == 1 && surveyAll){
        surveyAll = false
    }
    else if(allSurveys.length == 1 && !surveyAll && modalActive){
        if(allSurveys[0].value == '-99999'){
            noneSurvey = true
        }
    }
    

    if (duplicateTask) {
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have duplicate annotation sets, please remove the duplicate.'
        surveyErrors.appendChild(newdiv)
    }
    

    if(surveyAll){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You cannot select all surveys and add additional surveys. Please remove additional surveys or "All" surveys.'
        surveyErrors.appendChild(newdiv)
    }


    if(noneSurvey){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have not selected any surveys. Please select a survey.'
        surveyErrors.appendChild(newdiv)
    }

    if (duplicateTask||surveyAll||noneSurvey) {
        legalSurvey = false
    } else {
        legalSurvey = true
    }
}

function getLabelsAndSites(){
    /** Builds the selectors for generating results*/

    // var allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    // var tasks = []
    // for (let i=0;i<allTasks.length;i++) {
    //     if (allTasks[i].value != '-99999' && allTasks[i].value != '0'){
    //         tasks.push(allTasks[i].value)
    //     } 
    // }

    // if (tasks.length==0) {
    //     globalLabels = []
    //     globalSites = []
    //     updateLabelsAndSites()
    //     return
    // }

    tasks = ['0']

    console.log(tasks)
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
            globalSites = reply.sites            

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
            var optionValues = ['-99999', '0']
            var optionTexts = ['None', 'All']
            optionValues = optionValues.concat(globalLabels)
            optionTexts = optionTexts.concat(globalLabels)
            fillSelect(speciesSelector, optionTexts, optionValues)
        }

        siteSelector = document.getElementById('trapgroupSelect')
        if (siteSelector) {
            clearSelect(siteSelector)
            optionValues = ['-99999', '0']
            optionTexts = ['None', 'All']
            optionValues = optionValues.concat(globalSites)
            optionTexts = optionTexts.concat(globalSites)
            fillSelect(siteSelector, optionTexts, optionValues)
        }
    }
    else{
        for (let i=0;i<allSpeciesSelector.length;i++) {
            clearSelect(allSpeciesSelector[i])
            var optionValues = ['-99999', '0']
            var optionTexts = ['None', 'All']
            optionValues = optionValues.concat(globalLabels)
            optionTexts = optionTexts.concat(globalLabels)
            fillSelect(allSpeciesSelector[i], optionTexts, optionValues)
        }

        for (let i=0;i<allSiteSelector.length;i++) {
            clearSelect(allSiteSelector[i])
            var optionValues = ['-99999', '0']
            var optionTexts = ['None', 'All']
            optionValues = optionValues.concat(globalSites)
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
        generateTemporal()
    }
    else if (analysisType=='2') {
        //Builds the selectors for the spatial analysis
        generateSpatial()
    }
    else if (analysisType=='3') {
        //Builds the selectors for the numerical analysis
        generateNumerical()
    }
    else if (analysisType=='4') {
        //Builds the selectors for the time series analysis
        generateTime()
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
    col1.classList.add('col-lg-8')
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

    secCol1 = document.createElement('div')
    secCol1.classList.add('col-lg-1')
    secCol1.setAttribute('style','padding-right:4px;margin-right:0px;display:flex;justify-content:center;align-items:center')
    colDiv2.appendChild(secCol1)

    secCol2 = document.createElement('div')
    secCol2.classList.add('col-lg-10')
    secCol2.setAttribute('style','margin:0px;margin:0px')
    colDiv2.appendChild(secCol2)

    secCol3 = document.createElement('div')
    secCol3.classList.add('col-lg-1')
    secCol3.setAttribute('style','padding-left:4px;margin-left:0px;display:flex;justify-content:center;align-items:center')
    colDiv2.appendChild(secCol3)

    colDiv3 = document.createElement('div')
    colDiv3.classList.add('col-lg-1')
    div.appendChild(colDiv3)

    h5 = document.createElement('h5')
    h5.setAttribute('style','padding-right:4px;margin-right:0px')
    h5.setAttribute('align','right')
    h5.innerHTML = '18:00'
    secCol1.appendChild(h5)

    h5 = document.createElement('h5')
    h5.setAttribute('style','padding-bottom:15px;margin-bottom:0px')
    h5.setAttribute('align','center')
    h5.innerHTML = '00:00'
    secCol2.appendChild(h5)

    canvasDiv = document.createElement('div')
    canvasDiv.setAttribute('style','height: 850px')
    secCol2.appendChild(canvasDiv)

    canvas = document.createElement('canvas')
    canvas.setAttribute('id','statisticsChart')
    canvas.setAttribute('height','850')
    canvasDiv.appendChild(canvas)

    h5 = document.createElement('h5')
    h5.setAttribute('style','padding-top:15px;margin-top:0px')
    h5.setAttribute('align','center')
    h5.innerHTML = '12:00'
    secCol2.appendChild(h5)

    h5 = document.createElement('h5')
    h5.setAttribute('style','padding-left:4px;margin-left:0px')
    h5.setAttribute('align','left')
    h5.innerHTML = '06:00'
    secCol3.appendChild(h5)

    // Polar chart 
    var ctx = document.getElementById('statisticsChart').getContext('2d');
                
    var data = {
        datasets: [],
        labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00']
    };

    var options = {
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
                    var datasetLabel = '';
                    var label = data.labels[tooltipItem.index];
                    return data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                }           
            }
        },
        scale: {
            ticks: {
                display: false
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
    col1.classList.add('col-lg-8')
    row.appendChild(col1)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','speciesSelect')
    col1.appendChild(select)

    fillSelect(select, ['None', 'All'], ['-99999','0'])

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
    col1.classList.add('col-lg-8')
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
    col1.classList.add('col-lg-8')
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
            col1.classList.add('col-lg-8')
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
            display: false
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
        type: 'bar',
        options: options
    });




}

function genrateTime(){
    /** Updates the generate results div for time series analysis */
    var generateDiv = document.getElementById('generateDiv')

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
    col1.classList.add('col-lg-8')
    row.appendChild(col1)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
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
    var siteOptionValues = ['-99999','0']
    siteOptionTexts.push(...globalSites)
    siteOptionValues.push(...globalSites)
    fillSelect(siteSelector, siteOptionTexts, siteOptionValues)

    $("#"+siteSelector.id).change( function(wrapIDNum) {
        return function() {
            updatePolarData(wrapIDNum)
            updatePolarErrors()
        }
    }(IDNum));
    

    var speciesSelector = document.createElement('select')
    speciesSelector.classList.add('form-control')
    speciesSelector.id = 'speciesSelect-'+String(IDNum)
    col1.appendChild(speciesSelector)
    var speciesOptionTexts = ['None', 'All']
    var speciesOptionValues = ['-99999','0']
    speciesOptionTexts.push(...globalLabels) 
    speciesOptionValues.push(...globalLabels)

    fillSelect(speciesSelector, speciesOptionTexts, speciesOptionValues)

    $("#"+speciesSelector.id).change( function(wrapIDNum) {
        return function() {
            updatePolarData(wrapIDNum)
            updatePolarErrors()
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
            removePolarData(colour)
            btnRemove.parentNode.parentNode.remove();
            if (polarData.hasOwnProperty(wrapIDNum.toString())) {
                delete polarData[wrapIDNum.toString()]
            }
            updatePolarErrors()
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
    col1.classList.add('col-lg-8')
    row.appendChild(col1)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    if (IDNum > 0) {
        col1.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }

    selectorColumn.appendChild(row)
    
    var speciesSelector = document.createElement('select')
    speciesSelector.classList.add('form-control')
    speciesSelector.id = 'speciesSelect-'+String(IDNum)
    col1.appendChild(speciesSelector)
    var speciesOptionTexts = ['None', 'All']
    var speciesOptionValues = ['-99999','0']
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
            removeBarData(colour)
            btnRemove.parentNode.parentNode.remove();
            if (barData.hasOwnProperty(wrapIDNum.toString())) {
                delete barData[wrapIDNum.toString()]
            }
            updateBarErrors()
        }
    }(IDNum));
    
}

function updateResults(tasksChanged=false){
    /** Updates the results div based on the selected analysis type */
    var analysisSelector = document.getElementById('analysisSelector')
    var analysisSelection = analysisSelector.options[analysisSelector.selectedIndex].value

    if (analysisSelection == '1') {
        updatePolar()
    }
    else if (analysisSelection == '2') {
        if(tasksChanged){
            updateMap()
        }
        updateHeatMap()
    }
    else if (analysisSelection == '3') {
        if (tasksChanged) {
            getTrapgroups()
        }
        updateBar()
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

function updateMap(){
    /** Updates the map */
    var tasks = getSelectedTasks()
    
    var formData = new FormData();
    formData.append('task_ids', JSON.stringify(tasks));

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
            console.log(reply)
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
    var tasks = []
    var allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    for (let i=0;i<allTasks.length;i++) {
        if (allTasks[i].value != '-99999' && allTasks[i].value != '0'){
            tasks.push(allTasks[i].value)
        }
    }

    if (tasks.length==0) {
        tasks.push('0')
    }

    return tasks
}


$('#analysisSelector').on('change', function() {
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
});

$('#startDate').on('change', function() {
    updateResults()
});

$('#endDate').on('change', function() {
    updateResults()
});

function onload(){
    /**Function for initialising the page on load.*/
    addSurveys()
    getLabelsAndSites()
}

window.addEventListener('load', onload, false);