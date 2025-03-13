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

function buildPolarSelectorRow() {
    /** Builds a new species selector row for the Naive Activity analysis polar chart. */

    IDNum = getIdNumforNext('trapgroupSelect')
    selectorColumn = document.getElementById('selectorColumn')

    containingDiv = document.createElement('div')
    selectorColumn.appendChild(containingDiv)

    row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    colrow1 = document.createElement('div')
    colrow1.classList.add('col-lg-2')
    row.appendChild(colrow1)

    colrow2 = document.createElement('div')
    colrow2.classList.add('col-lg-10')
    row.appendChild(colrow2)

    //delete
    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';
    colrow1.appendChild(btnRemove)

    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            var analysisSelection = document.getElementById('analysisSelector').value
            if (analysisSelection == '1') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                removePolarData(wrapIDNum)
                btnRemove.parentNode.parentNode.parentNode.remove();
                if (polarData.hasOwnProperty(wrapIDNum.toString())) {
                    delete polarData[wrapIDNum.toString()]
                }
                updatePolarErrors()
            } else if (analysisSelection == '4') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                removeLineData(wrapIDNum)
                btnRemove.parentNode.parentNode.parentNode.remove();
                if (lineData.hasOwnProperty(wrapIDNum.toString())) {
                    delete lineData[wrapIDNum.toString()]
                }
                updateLineErrors()
            }
        }
    }(IDNum));

    // trapgroup
    trapgroupSelect = document.createElement('select')
    trapgroupSelect.classList.add('form-control')
    trapgroupSelect.setAttribute('id','trapgroupSelect-'+IDNum)
    colrow2.appendChild(trapgroupSelect)
    fillSelect(trapgroupSelect,trapgroupNames,trapgroupValues)

    $("#"+trapgroupSelect.id).change( function(wrapIDNum) {
        return function() {
            var analysisSelection = document.getElementById('analysisSelector').value
            if (analysisSelection == '1') {
                updatePolarData(wrapIDNum)
                updatePolarErrors()
            } else if (analysisSelection == '4') {
                updateLineData(wrapIDNum)
                updateLineErrors()
            }
        }
    }(IDNum));

    // species
    speciesSelect = document.createElement('select')
    speciesSelect.classList.add('form-control')
    speciesSelect.setAttribute('id','speciesSelect-'+IDNum)
    containingDiv.appendChild(speciesSelect)
    fillSelect(speciesSelect,speciesNames,speciesValues)

    $("#"+speciesSelect.id).change( function(wrapIDNum) {
        return function() {
            var analysisSelection = document.getElementById('analysisSelector').value
            if (analysisSelection == '1') {
                updatePolarData(wrapIDNum)
                updatePolarErrors()
            } else if (analysisSelection == '4') {
                updateLineData(wrapIDNum)
                updateLineErrors()
            }
        }
    }(IDNum));

    containingDiv.appendChild(document.createElement('br'))
}


function buildBarSelectorRow() {
    /** Builds a new species selector row for the numerical analysis bar chart. */

    IDNum = getIdNumforNext('speciesSelect')
    selectorColumn = document.getElementById('selectorColumn')

    containingDiv = document.createElement('div')
    selectorColumn.appendChild(containingDiv)

    row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    colrow1 = document.createElement('div')
    colrow1.classList.add('col-lg-2')
    row.appendChild(colrow1)

    colrow2 = document.createElement('div')
    colrow2.classList.add('col-lg-10')
    row.appendChild(colrow2)

    //delete
    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';
    colrow1.appendChild(btnRemove)

    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
            removeBarData(wrapIDNum)
            btnRemove.parentNode.parentNode.parentNode.remove();
            if (barData.hasOwnProperty(wrapIDNum.toString())) {
                delete barData[wrapIDNum.toString()]
            }
            updateBarErrors()
        }
    }(IDNum));

    // species
    speciesSelect = document.createElement('select')
    speciesSelect.classList.add('form-control')
    speciesSelect.setAttribute('id','speciesSelectNum-'+IDNum)
    colrow2.appendChild(speciesSelect)
    fillSelect(speciesSelect,speciesNames,speciesValues)

    $("#"+speciesSelect.id).change( function(wrapIDNum) {
        return function() {
            updateBarData(wrapIDNum)
            updateBarErrors()
        }
    }(IDNum));

    containingDiv.appendChild(document.createElement('br'))
}

function createPolarChart() {
    /** Initialises a Naive Activity analysis polar chart. */

    polarData = {}

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify([selectedTask]));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            trapgroupNames = reply.names
            trapgroupValues = reply.values
            
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    speciesNames = reply.names
                    speciesValues = reply.ids
                    
                    mainDiv = document.getElementById('statisticsDiv')

                    div = document.createElement('div')
                    div.classList.add('row')
                    mainDiv.appendChild(div)

                    colDiv1 = document.createElement('div')
                    colDiv1.classList.add('col-lg-1')
                    div.appendChild(colDiv1)

                    aDiv2 = document.createElement('div')
                    aDiv2.classList.add('col-lg-8')
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
                
                    selectorDiv = document.createElement('div')
                    selectorDiv.classList.add('col-lg-2')
                    div.appendChild(selectorDiv)
                
                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Normalisation'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Normalise the counts using the total count for each item to make comparison easier between species with vastly different sighting numbers.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','normalisationSelector')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select, ['Raw Count', 'Normalised'], ['1','2'])
                    $("#normalisationSelector").change( function() {
                        normalisePolar()
                    });

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Data Unit'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select which unit of data to count.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','baseUnitSelector')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select, ['Clusters','Sightings','Images'], ['2','3','1'])
                    $("#baseUnitSelector").change( function() {
                        updateBaseUnitPolar()
                    });

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Date'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    h5 = document.createElement('div')
                    h5.innerHTML = "<i>Select the date range for which you would like to view results for.</i>"
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    dateRange = document.createElement('div')
                    selectorDiv.appendChild(dateRange)
        
                    startDateLabel = document.createElement('label');
                    startDateLabel.textContent = 'Start date:';
                    startDateLabel.setAttribute('for', 'startDate');
                    dateRange.appendChild(startDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    startDateInput = document.createElement('input');
                    startDateInput.setAttribute('type', 'date');
                    startDateInput.setAttribute('id', 'startDate');
                    dateRange.appendChild(startDateInput)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateLabel = document.createElement('label');
                    endDateLabel.textContent = 'End date:';
                    endDateLabel.setAttribute('for', 'endDate');
                    dateRange.appendChild(endDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateInput = document.createElement('input');
                    endDateInput.setAttribute('type', 'date');
                    endDateInput.setAttribute('id', 'endDate');
                    dateRange.appendChild(endDateInput)
        
                    dateError = document.createElement('div')
                    dateError.setAttribute('id', 'dateErrors')
                    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
                    dateError.innerHTML = ''
                    dateRange.appendChild(dateError)

                    $("#startDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            for (let IDNum in polarData) {
                                updatePolarData(IDNum)
                            }
                        }
                        else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    $("#endDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            for (let IDNum in polarData) {
                                updatePolarData(IDNum)
                            }
                        }
                        else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Data'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select which site and species combinations you would like to see.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    selectorColumn = document.createElement('div')
                    selectorColumn.setAttribute('id','selectorColumn')
                    selectorDiv.appendChild(selectorColumn)
                
                    buildPolarSelectorRow()

                    button1 = document.createElement('button')
                    button1.classList.add('btn')
                    button1.classList.add('btn-info')
                    button1.setAttribute('type','button')
                    button1.setAttribute('id','btnAddPolar')
                    button1.innerHTML = '+'
                    selectorDiv.appendChild(button1)

                    button1.addEventListener('click', ()=>{
                        if (document.querySelectorAll('[id^=trapgroupSelect]').length < Object.keys(chartColours).length) {
                            buildPolarSelectorRow()
                        }
                    });
                
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
            }
            xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
            xhttp.send();
        }
    }
    xhttp.open("POST", '/getTrapgroups');
    xhttp.send(formData);
}

function createBar() {
    /** Initialises a numerical-analysis bar chart. */

    barData = {}
    activeRequest = {}

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify([selectedTask]));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            trapgroupNames = reply.names
            trapgroupValues = reply.values
            
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    speciesNames = reply.names
                    speciesNames.unshift('None')
                    speciesValues = reply.ids
                    speciesValues.unshift('-1')
                    
                    mainDiv = document.getElementById('statisticsDiv')

                    div = document.createElement('div')
                    div.classList.add('row')
                    mainDiv.appendChild(div)
                
                    col1 = document.createElement('div')
                    col1.classList.add('col-lg-10')
                    div.appendChild(col1)
                
                    selectorDiv = document.createElement('div')
                    selectorDiv.classList.add('col-lg-2')
                    div.appendChild(selectorDiv)

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Comparison'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select what type of comparison you would like to do.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','xAxisSelector')
                    selectorDiv.appendChild(select)
                
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
                        
                            select = document.createElement('select')
                            select.classList.add('form-control')
                            select.setAttribute('id','normalisationSelector')
                            normalDiv.appendChild(select)
                        
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
                                speciesSelector = document.getElementById('speciesSelectNum-'+IDNum)
                                species = speciesSelector.options[speciesSelector.selectedIndex].text

                                var formData = new FormData()
                                formData.append("task_ids", JSON.stringify([selectedTask]))
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

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Date'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    h5 = document.createElement('div')
                    h5.innerHTML = "<i>Select the date range for which you would like to view results for.</i>"
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    dateRange = document.createElement('div')
                    selectorDiv.appendChild(dateRange)
        
                    startDateLabel = document.createElement('label');
                    startDateLabel.textContent = 'Start date:';
                    startDateLabel.setAttribute('for', 'startDate');
                    dateRange.appendChild(startDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    startDateInput = document.createElement('input');
                    startDateInput.setAttribute('type', 'date');
                    startDateInput.setAttribute('id', 'startDate');
                    dateRange.appendChild(startDateInput)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateLabel = document.createElement('label');
                    endDateLabel.textContent = 'End date:';
                    endDateLabel.setAttribute('for', 'endDate');
                    dateRange.appendChild(endDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateInput = document.createElement('input');
                    endDateInput.setAttribute('type', 'date');
                    endDateInput.setAttribute('id', 'endDate');
                    dateRange.appendChild(endDateInput)
        
                    dateError = document.createElement('div')
                    dateError.setAttribute('id', 'dateErrors')
                    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
                    dateError.innerHTML = ''
                    dateRange.appendChild(dateError)

                    $("#startDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            for (let IDNum in barData) {
                                updateBarData(IDNum)
                            }
                        }else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    $("#endDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            for (let IDNum in barData) {
                                updateBarData(IDNum)
                            }
                        }else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Data Unit'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select which unit of data to count.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','baseUnitSelector')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select, ['Clusters','Sightings','Images'], ['2','3','1'])
                    $("#baseUnitSelector").change( function() {
                        updateBaseUnitBar()
                    });

                    normalDiv = document.createElement('div')
                    normalDiv.setAttribute('id','normalDiv')
                    selectorDiv.appendChild(normalDiv)

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Species'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select the species you would like to see.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    selectorColumn = document.createElement('div')
                    selectorColumn.setAttribute('id','selectorColumn')
                    selectorDiv.appendChild(selectorColumn)
                
                    buildBarSelectorRow()

                    button1 = document.createElement('button')
                    button1.classList.add('btn')
                    button1.classList.add('btn-info')
                    button1.setAttribute('type','button')
                    button1.setAttribute('id','btnAddPolar')
                    button1.innerHTML = '+'
                    selectorDiv.appendChild(button1)

                    button1.addEventListener('click', ()=>{
                        if (document.querySelectorAll('[id^=speciesSelect]').length < Object.keys(chartColours).length) {
                            buildBarSelectorRow()
                        }
                    });
                
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
            }
            xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
            xhttp.send();
        }
    }
    xhttp.open("POST", '/getTrapgroups');
    xhttp.send(formData);
}

function createMap() {
    /** Initialises the species heat map. */

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify([selectedTask]));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            info = JSON.parse(this.responseText);
            trapgroupInfo = info.trapgroups

            noCoordinates = true 
            for (let i=0;i<trapgroupInfo.length;i++) {
                if ((trapgroupInfo[i].latitude != 0) || (trapgroupInfo[i].longitude != 0)) {
                    noCoordinates = false
                    break
                }
            }

            mainDiv = document.getElementById('statisticsDiv')

            if (noCoordinates) {
                //Let appear in the middle of the page
                newDiv = document.createElement('div')
                newDiv.style.display = "flex";
                newDiv.style.justifyContent = "center";
                newDiv.style.alignItems = "center";
                newDiv.innerHTML = '<h5>There are no coordinates to display.</h5>'
                mainDiv.appendChild(newDiv)
                return
            }

            div = document.createElement('div')
            div.classList.add('row')
            mainDiv.appendChild(div)
        
            space = document.createElement('div')
            space.classList.add('col-lg-1')
            div.appendChild(space)
        
            col1 = document.createElement('div')
            col1.classList.add('col-lg-8')
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

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);

                    speciesNames = reply.names
                    speciesValues = reply.ids

                    speciesNames.unshift('None');
                    speciesValues.unshift('-1');

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Species'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select the species you would like to examine.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','speciesSelect')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select,speciesNames,speciesValues)

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
                        updateHeatMap()
                    });
                
                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Data Unit'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select which unit of data to count.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','baseUnitSelector')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select, ['Clusters','Sightings','Images'], ['2','3','1'])
                    $("#baseUnitSelector").change( function() {
                        updateHeatMap()
                    });
        
                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Date'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    h5 = document.createElement('div')
                    h5.innerHTML = "<i>Select the date range for which you would like to view results for.</i>"
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    dateRange = document.createElement('div')
                    selectorDiv.appendChild(dateRange)
        
                    startDateLabel = document.createElement('label');
                    startDateLabel.textContent = 'Start date:';
                    startDateLabel.setAttribute('for', 'startDate');
                    dateRange.appendChild(startDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    startDateInput = document.createElement('input');
                    startDateInput.setAttribute('type', 'date');
                    startDateInput.setAttribute('id', 'startDate');
                    dateRange.appendChild(startDateInput)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateLabel = document.createElement('label');
                    endDateLabel.textContent = 'End date:';
                    endDateLabel.setAttribute('for', 'endDate');
                    dateRange.appendChild(endDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateInput = document.createElement('input');
                    endDateInput.setAttribute('type', 'date');
                    endDateInput.setAttribute('id', 'endDate');
                    dateRange.appendChild(endDateInput)
        
                    dateError = document.createElement('div')
                    dateError.setAttribute('id', 'dateErrors')
                    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
                    dateError.innerHTML = ''
                    dateRange.appendChild(dateError)

                    $("#startDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            updateHeatMap()
                        }else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    $("#endDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            updateHeatMap()
                        }else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    selectorDiv.appendChild(document.createElement('br'))
                
                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Radius'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Set the heatmap radius to help identify different trends.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    slideRow = document.createElement('div')
                    slideRow.classList.add('row')
                    selectorDiv.appendChild(slideRow)
        
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
        
                    selectorDiv.appendChild(document.createElement('br'))
        
                    checkBoxDiv = document.createElement('div')
                    checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
                    selectorDiv.appendChild(checkBoxDiv)
        
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
                    selectorDiv.appendChild(checkBoxDiv)
        
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
                    selectorDiv.appendChild(checkBoxDiv)
        
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
                    selectorDiv.appendChild(excludeDiv)
                }
            }
            xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
            xhttp.send();
        }
    }
    xhttp.open("POST", '/getCoords');
    xhttp.send(formData);
}

btnOpenStatistics.addEventListener('click', ()=>{
    /** Event listener that opens the statistics modal. */
    modalResults.modal('hide')
    modalStatistics.modal({keyboard: true});
});

function clearStatistics() {
    /** Clears the statistics modal. */
    statisticsDiv = document.getElementById('statisticsDiv')
    while(statisticsDiv.firstChild){
        statisticsDiv.removeChild(statisticsDiv.firstChild);
    }
    clearChartColours()
    document.getElementById('statisticsErrors').innerHTML = ''
}

function createLine(){
    /** Creates the line chart for temporal analysis */
    lineData = {}

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify([selectedTask]));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            trapgroupNames = reply.names
            trapgroupValues = reply.values
            
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    speciesNames = reply.names
                    speciesValues = reply.ids
                    
                    mainDiv = document.getElementById('statisticsDiv')

                    div = document.createElement('div')
                    div.classList.add('row')
                    mainDiv.appendChild(div)

                    colDiv1 = document.createElement('div')
                    colDiv1.classList.add('col-lg-1')
                    div.appendChild(colDiv1)

                    aDiv2 = document.createElement('div')
                    aDiv2.classList.add('col-lg-8')
                    aDiv2.setAttribute('align','center')
                    div.appendChild(aDiv2)

                    colDiv3 = document.createElement('div')
                    colDiv3.classList.add('col-lg-1')
                    div.appendChild(colDiv3)

                    canvasDiv = document.createElement('div')
                    canvasDiv.setAttribute('style','height: 650px')
                    aDiv2.appendChild(canvasDiv)

                    canvas = document.createElement('canvas')
                    canvas.setAttribute('id','statisticsChart')
                    canvas.setAttribute('height','650')
                    canvasDiv.appendChild(canvas)
                
                    selectorDiv = document.createElement('div')
                    selectorDiv.classList.add('col-lg-2')
                    div.appendChild(selectorDiv)

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Data Unit'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select which unit of data to count.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','baseUnitSelector')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select, ['Clusters','Sightings','Images'], ['2','3','1'])
                    $("#baseUnitSelector").change( function() {
                        updateBaseUnitLine()
                    });

                    selectorDiv.appendChild(document.createElement('br'))

                    var h5 = document.createElement('h5')
                    h5.innerHTML = 'Time Unit'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select the time unit you would like to see your results in.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                    
                    var row = document.createElement('div')
                    row.classList.add('row')
                    selectorDiv.appendChild(row)

                    var col0 = document.createElement('div')
                    col0.classList.add('col-lg-5')
                    row.appendChild(col0)
                
                    var col1 = document.createElement('div')
                    col1.classList.add('col-lg-7')
                    row.appendChild(col1)

                    var input = document.createElement('input')
                    input.setAttribute('type','number')
                    input.setAttribute('id','timeUnitNumber')
                    input.setAttribute('class','form-control')
                    input.setAttribute('min','1')
                    input.setAttribute('value','1')
                    input.setAttribute('step','1')
                    col0.appendChild(input)

                    $("#timeUnitNumber").change( function() {

                        var timeUnitNumber = this.value
                        var valid = true
                        var error = document.getElementById('timeUnitError')
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
                            timeLabels = []
                            for (let IDNum in lineData) {
                                updateLineData(IDNum)
                            }
                        }
                        else{
                            error.innerHTML = message
                        }
                    });
                
                    var select = document.createElement('select')
                    select.classList.add('form-control')
                    select.setAttribute('id','timeUnitSelector')
                    col1.appendChild(select)
                
                    fillSelect(select, ['Day', 'Month', 'Year'], ['1','2','3'])
                    $("#timeUnitSelector").change( function() {
                        timeLabels = []
                        for (let IDNum in lineData) {
                            updateLineData(IDNum)
                        }
                    });
                    select.value = '2'

                    var timeUnitErrors = document.createElement('div')
                    timeUnitErrors.setAttribute('id', 'timeUnitError')
                    timeUnitErrors.setAttribute('style', 'color: #DF691A; font-size: 80%')
                    timeUnitErrors.innerHTML = ''
                    selectorDiv.appendChild(timeUnitErrors)

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Date'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    h5 = document.createElement('div')
                    h5.innerHTML = "<i>Select the date range for which you would like to view results for.</i>"
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
        
                    dateRange = document.createElement('div')
                    selectorDiv.appendChild(dateRange)
        
                    startDateLabel = document.createElement('label');
                    startDateLabel.textContent = 'Start date:';
                    startDateLabel.setAttribute('for', 'startDate');
                    dateRange.appendChild(startDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    startDateInput = document.createElement('input');
                    startDateInput.setAttribute('type', 'date');
                    startDateInput.setAttribute('id', 'startDate');
                    dateRange.appendChild(startDateInput)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateLabel = document.createElement('label');
                    endDateLabel.textContent = 'End date:';
                    endDateLabel.setAttribute('for', 'endDate');
                    dateRange.appendChild(endDateLabel)
        
                    dateRange.appendChild(document.createElement('br'));
        
                    endDateInput = document.createElement('input');
                    endDateInput.setAttribute('type', 'date');
                    endDateInput.setAttribute('id', 'endDate');
                    dateRange.appendChild(endDateInput)
        
                    dateError = document.createElement('div')
                    dateError.setAttribute('id', 'dateErrors')
                    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
                    dateError.innerHTML = ''
                    dateRange.appendChild(dateError)

                    $("#startDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            timeLabels = []
                            for (let IDNum in lineData) {
                                updateLineData(IDNum)
                            }
                        }
                        else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    $("#endDate").change( function() {
                        var valid = checkDates()
                        if (valid) {
                            timeLabels = []
                            for (let IDNum in lineData) {
                                updateLineData(IDNum)
                            }
                        }
                        else{
                            document.getElementById('dateErrors').innerHTML = 'Start date must be before end date.'
                        }
                    });

                    selectorDiv.appendChild(document.createElement('br'))

                    h5 = document.createElement('h5')
                    h5.innerHTML = 'Data'
                    h5.setAttribute('style','margin-bottom: 2px')
                    selectorDiv.appendChild(h5)

                    h5 = document.createElement('div')
                    h5.innerHTML = '<i>Select which site and species combinations you would like to see.</i>'
                    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                    selectorDiv.appendChild(h5)
                
                    selectorColumn = document.createElement('div')
                    selectorColumn.setAttribute('id','selectorColumn')
                    selectorDiv.appendChild(selectorColumn)
                
                    buildPolarSelectorRow()

                    button1 = document.createElement('button')
                    button1.classList.add('btn')
                    button1.classList.add('btn-info')
                    button1.setAttribute('type','button')
                    button1.setAttribute('id','btnAddPolar')
                    button1.innerHTML = '+'
                    selectorDiv.appendChild(button1)

                    button1.addEventListener('click', ()=>{
                        if (document.querySelectorAll('[id^=trapgroupSelect]').length < Object.keys(chartColours).length) {
                            buildPolarSelectorRow()
                        }
                    });

                    var ctx = document.getElementById('statisticsChart').getContext('2d');

                    var data = {
                        datasets: [],
                        labels: []
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
                
                
                }
            }
            xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
            xhttp.send();
        }
    }
    xhttp.open("POST", '/getTrapgroups');
    xhttp.send(formData);

}

analysisSelector.addEventListener('change', ()=>{
    /** Event listener on the analysis selector that selects what type of analysis the user would like to see. */
    selection = analysisSelector.options[analysisSelector.selectedIndex].value
    clearStatistics()
    if (selection == '1') {
        createPolarChart()
    } else if (selection == '2') {
        createMap()
    } else if (selection == '3') {
        createBar()
    }
    else if (selection == '4') {
        createLine()
    }
});

modalStatistics.on('hidden.bs.modal', function(){
    /** Clears the statistics modal when it is closed, unless it is being closed to open the help modal. */
    if (!helpReturn) {
        clearChartColours()
        clearStatistics()
        analysisSelector.selectedIndex = 0
        modalResults.modal({keyboard: true});
    } else {
        helpReturn = false
    }
});