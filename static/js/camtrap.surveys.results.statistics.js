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

function addPolarData(data,colour) {
    /**
     * Adds new data to a polar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour with which to display the data
     */
    
    if (colour=='rgba(255,255,255,0.2)') {
        background = 'rgba(0,0,0,0.2)'
    } else {
        background = 'rgba(255,255,255,0.2)'
    }
    dataset = {
        data: data,
        hoverBackgroundColor: background,
        borderWidth: 1,
        backgroundColor: colour
    }
    chart.data.datasets.push(dataset)
    chart.update()
}

function addBarData(data,colour) {
    /**
     * Adds the stipulated data to an active bar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour with which to display the data
     */
    
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    if (xAxisSelection=='1') {
        dataset = {
            data: data,
            hoverBackgroundColor: colour,
            borderColor: 'rgba(255,255,255,1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            backgroundColor: colour
        }
    } else {
        if (colour=='rgba(255,255,255,0.2)') {
            background = 'rgba(0,0,0,0.2)'
        } else {
            background = 'rgba(255,255,255,0.2)'
        }
        dataset = {
            data: data,
            hoverBackgroundColor: background,
            borderColor: 'rgba(255,255,255,1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            backgroundColor: colour
        }
    }
    chart.data.datasets.push(dataset)
    chart.update()
}

function removePolarData(colour) {
    /**
     * Removes a dataset from the active polar chart based on colour.
     * @param {str} colour The colour dataset to remove
     */
    
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (index=0;index<chart.data.datasets.length;index++) {
        if (chart.data.datasets[index].backgroundColor==colour) {
            chart.data.datasets.splice(index, 1);
            break
        }
    }
    polarColours[colour] = false
    chart.update()
}

function removeBarData(colour) {
    /** 
     * Removes a dataset from the active bar chart based on colour.
     * @param {str} colour The colour dataset to remove
     */
    
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (index=0;index<chart.data.datasets.length;index++) {
        if (chart.data.datasets[index].backgroundColor==colour) {
            chart.data.datasets.splice(index, 1);
            break
        }
    }
    barColours[colour] = false
    chart.update()
}

function clearPolarColours() {
    /** Clears the polarColours object */
    for (key in polarColours) {
        polarColours[key] = false
    }
}

function clearBarColours() {
    /** Clears the barColours object */
    for (key in polarColours) {
        barColours[key] = false
    }
}

function editPolarData(data,colour) {
    /** 
     * Edits the data associated with the specified colour in the active polar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour to edit
     */

    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (index=0;index<chart.data.datasets.length;index++) {
        if (chart.data.datasets[index].backgroundColor==colour) {
            chart.data.datasets[index].data=data
            break
        }
    }
    chart.update()
}


function editBarData(data,colour) {
    /** 
     * Edits the data associated with the specified colour in the active bar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour to edit
     */

    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (index=0;index<chart.data.datasets.length;index++) {
        if (chart.data.datasets[index].backgroundColor==colour) {
            if (xAxisSelection=='1') {
                chart.data.datasets[index].hoverBackgroundColor = chart.data.datasets[index].backgroundColor
            } else {
                chart.data.datasets[index].hoverBackgroundColor = 'rgba(255,255,255,0.2)'
            }
            chart.data.datasets[index].data=data
            break
        }
    }
    chart.update()
}

function updatePolarDisplay(IDNum) {
    /**
     * Updates the dispay of a dataset on the active polar chart.
     * @param {int} IDNum The ID number of the item to be updated
     */

    IDkey = IDNum.toString()
    normalisationSelector = document.getElementById('normalisationSelector')
    normalisationSelection = normalisationSelector.options[normalisationSelector.selectedIndex].value
    data = polarData[IDkey]['data']
    colour = polarData[IDkey]['colour']
    
    newData = []
    if (normalisationSelection == '2') { //Normalised
        total = polarData[IDkey]['total']
        if (total != 0) {
            for (ix=0;ix<data.length;ix++) {
                newData.push(+((data[ix]/total).toFixed(2)))
            }
        }
    } else {
        newData = data
    }

    if (polarData[IDkey]['new']) {
        addPolarData(newData,colour)
        polarData[IDkey]['new'] = false
    } else {
        editPolarData(newData,colour)
    }
}


function updateBarDisplay(IDNum) {
    /**
     * Updates the dispay of a dataset on the active bar chart.
     * @param {int} IDNum The ID number of the item to be updated
     */

    IDkey = IDNum.toString()
    data = barData[IDkey]['data']
    colour = barData[IDkey]['colour']
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value

    if (xAxisSelection == '1') { //don't check normal
        newData = data
    } else if (xAxisSelection == '2') {
        normalisationSelector = document.getElementById('normalisationSelector')
        normalisationSelection = normalisationSelector.options[normalisationSelector.selectedIndex].value
        newData = []
        if (normalisationSelection == '2') { //Normalised
            total = barData[IDkey]['total']
            if (total != 0) {
                for (ix=0;ix<data.length;ix++) {
                    newData.push(+((data[ix]/total).toFixed(2)))
                }
            }
        } else {
            newData = data
        }
    }

    if (barData[IDkey]['new']) {
        addBarData(newData,colour)
        barData[IDkey]['new'] = false
    } else {
        editBarData(newData,colour)
    }
}

function updatePolarErrors() {
    /** Checks for sighting counts in the current polar chart, and displays a warning if a species has not had its sightings checked. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnitSelection == '3') {
        species_count_warning = false
        for (IDNum in polarData) {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkSightingEditStatus/'+selectedTask+'/'+species);
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
            xhttp.send();
        }
    }
}


function updateBarErrors() {
    /** Checks for sighting counts in the current bar chart, and displays a warning if a species has not had its sightings checked. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnitSelection == '3') {
        species_count_warning = false
        for (IDNum in barData) {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkSightingEditStatus/'+selectedTask+'/'+species);
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
            xhttp.send();
        }
    }
}

function updatePolarData(IDNum) {
    /** Requests the dataset associated with the specified ID number, for the active polar chart. */

    trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value
    speciesSelector = document.getElementById('speciesSelect-'+IDNum)
    species = speciesSelector.options[speciesSelector.selectedIndex].value
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    if (trapgroup!='-1') {
        var reqID = Math.floor(Math.random() * 100000) + 1;
        activeRequest[IDNum.toString()] = reqID
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    IDkey = wrapIDNum.toString()
                    if (parseInt(response.reqID)==activeRequest[IDkey]) {
                        reply = response.data
        
                        if (!polarData.hasOwnProperty(IDkey)) {
                            colour = null
                            for (key in polarColours) {
                                if (polarColours[key]==false) {
                                    polarColours[key] = true
                                    colour = key
                                    break
                                }
                            }
                            if (colour != null) {
                                btnColour = colour
                                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                                btnRemove.setAttribute('style','background-color: '+btnColour)
                                polarData[IDkey] = {}
                                polarData[IDkey]['colour'] = colour
                                polarData[IDkey]['new'] = true
                            }
                        }
                        polarData[IDkey]['data'] = reply
        
                        total = 0
                        for (x=0;x<reply.length;x++) {
                            total += reply[x]
                        }
                        polarData[IDkey]['total'] = total
        
                        updatePolarDisplay(wrapIDNum)
                    }
                }
            }
        }(IDNum);
        xhttp.open("GET", 'getPolarData/'+selectedTask+'/'+trapgroup+'/'+species+'/'+baseUnitSelection+'/'+reqID);
        xhttp.send();
    } else {
        IDkey = IDNum.toString()
        if (polarData.hasOwnProperty(IDkey)) {
            polarData[IDkey]['data'] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
            polarData[IDkey]['total'] = 0
            updatePolarDisplay(IDNum)
        }
    }
}


function updateBarData(IDNum) {
    /** Requests the dataset associated with the specified ID number, for the active bar chart. */

    speciesSelector = document.getElementById('speciesSelect-'+IDNum)
    species = speciesSelector.options[speciesSelector.selectedIndex].value
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value

    if (species!='-1') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    IDkey = wrapIDNum.toString()
    
                    if (!barData.hasOwnProperty(IDkey)) {
                        colour = null
                        for (key in barColours) {
                            if (barColours[key]==false) {
                                barColours[key] = true
                                colour = key
                                break
                            }
                        }
                        if (colour != null) {
                            btnColour = colour
                            btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                            btnRemove.setAttribute('style','background-color: '+btnColour)
                            barData[IDkey] = {}
                            barData[IDkey]['colour'] = colour
                            barData[IDkey]['new'] = true
                        }
                    }
                    barData[IDkey]['data'] = reply
    
                    total = 0
                    for (x=0;x<reply.length;x++) {
                        total += reply[x]
                    }
                    barData[IDkey]['total'] = total
    
                    updateBarDisplay(wrapIDNum)
                }
            }
        }(IDNum);
        xhttp.open("GET", 'getBarData/'+selectedTask+'/'+species+'/'+baseUnitSelection+'/'+xAxisSelection);
        xhttp.send();
    } else {
        barData[IDkey]['data'] = [0]
        barData[IDkey]['total'] = 0
        updateBarDisplay(IDNum)
    }
}

function normalisePolar() {
    /** Normalises the polar chart data. */
    for (IDNum in polarData) {
        updatePolarDisplay(IDNum)
    }
}

function normaliseBar() {
    /** Normalises the bar chart data */
    for (IDNum in barData) {
        updateBarDisplay(IDNum)
    }
}

function updateBaseUnitPolar() {
    /** Updates the base unit of the active polar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (IDNum in polarData) {
        updatePolarData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkSightingEditStatus/'+selectedTask+'/'+species);
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
            xhttp.send();
        }
    }
}

function updateBaseUnitBar() {
    /** Updates the base unit of the active bar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (IDNum in barData) {
        updateBarData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkSightingEditStatus/'+selectedTask+'/'+species);
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
            xhttp.send();
        }
    }
}

function buildPolarSelectorRow() {
    /** Builds a new species selector row for the temporal analysis polar chart. */

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
            btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
            colour = btnRemove.style.backgroundColor
            removePolarData(colour)
            btnRemove.parentNode.parentNode.parentNode.remove();
            if (polarData.hasOwnProperty(wrapIDNum.toString())) {
                delete polarData[wrapIDNum.toString()]
            }
            updatePolarErrors()
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
            updatePolarData(wrapIDNum)
            updatePolarErrors()
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
            updatePolarData(wrapIDNum)
            updatePolarErrors()
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
            colour = btnRemove.style.backgroundColor
            removeBarData(colour)
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
    speciesSelect.setAttribute('id','speciesSelect-'+IDNum)
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
    /** Initialises a temporal analysis polar chart. */

    polarData = {}
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
                        if (document.querySelectorAll('[id^=trapgroupSelect]').length < Object.keys(polarColours).length) {
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
    xhttp.open("GET", '/getTrapgroups/'+selectedTask);
    xhttp.send();
}

function createBar() {
    /** Initialises a numerical-analysis bar chart. */

    barData = {}
    activeRequest = {}
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
                        for (IDNum in barData) {
                            updateBarData(IDNum)
                    
                            if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
                                speciesSelector = document.getElementById('speciesSelect-'+IDNum)
                                species = speciesSelector.options[speciesSelector.selectedIndex].text
                                var xhttp = new XMLHttpRequest();
                                xhttp.open("GET", '/checkSightingEditStatus/'+selectedTask+'/'+species);
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
                                xhttp.send();
                            }
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
                        if (document.querySelectorAll('[id^=speciesSelect]').length < Object.keys(barColours).length) {
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
            }
            xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
            xhttp.send();
        }
    }
    xhttp.open("GET", '/getTrapgroups/'+selectedTask);
    xhttp.send();
}

function logslider(position) {
    /** Converts a position value from a linear slider into a logorithmic value between 0.01 and 2. */
    
    // position will be between 0 and 100
    var minp = 0;
    var maxp = 100;
  
    // The result should be between 0.01 an 2
    var minv = Math.log(0.01);
    var maxv = Math.log(0.2);
  
    // calculate adjustment factor
    var scale = (maxv-minv) / (maxp-minp);
  
    return Math.exp(minv + scale*(position-minp));
}

function reScaleNormalisation(newScale) {
    /**
     * Updates the species heatmap when it is normalised and the radius slider is changed.
     * @param {int} newScale The new scale to adjust to.
    */

    reply = JSON.parse(JSON.stringify(heatMapData))

    map.removeLayer(heatmapLayer)
    map.addLayer(invHeatmapLayer)

    invHeatmapLayer.cfg.radius = newScale
    invHeatmapLayer._update()

    maxVal = 0
    for (dx=0;dx<reply.data.length;dx++) {
        value = invHeatmapLayer._heatmap.getValueAt(map.latLngToLayerPoint(L.latLng({lat:reply.data[dx].lat, lng:reply.data[dx].lng})))
        if (value!=0) {
            reply.data[dx].count = (1000*reply.data[dx].count)/value
            if (reply.data[dx].count>maxVal) {
                maxVal = reply.data[dx].count
            }
        }
    }
    reply.max = 1.25*maxVal
    map.removeLayer(invHeatmapLayer)
    map.addLayer(heatmapLayer)

    heatmapLayer._data = []
    heatmapLayer.setData(reply);
    heatmapLayer.cfg.radius = newScale
    heatmapLayer._update()
}

function updateHeatMap() {
    /** Updates the species heatmap. */

    mapSpeciesSelector = document.getElementById('mapSpeciesSelector')
    selection = mapSpeciesSelector.options[mapSpeciesSelector.selectedIndex].value
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnit = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnit=='3') {
        species = mapSpeciesSelector.options[mapSpeciesSelector.selectedIndex].text
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/checkSightingEditStatus/'+selectedTask+'/'+species);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='warning') {
                    document.getElementById('statisticsErrors').innerHTML = reply.message
                }
            }
        }
        xhttp.send();
    }

    if (selection == '-1') {
        heatmapLayer._data = []
        heatmapLayer._update()
    } else {
        if (selection == '0') {
            excludeNothing = document.getElementById('excludeNothing').checked
            excludeKnocks = document.getElementById('excludeKnocks').checked
            excludeVHL = document.getElementById('excludeVHL').checked
        } else {
            excludeNothing = null
            excludeKnocks = null
            excludeVHL = null
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                heatMapData = JSON.parse(JSON.stringify(reply))

                if (document.getElementById('normalisationCheckBox').checked) {
                    if (document.getElementById('heatMapCheckBox').checked) {
                        map.removeLayer(heatmapLayer)
                    }
                    map.addLayer(invHeatmapLayer)
                    maxVal = 0
                    for (dx=0;dx<reply.data.length;dx++) {
                        value = invHeatmapLayer._heatmap.getValueAt(map.latLngToLayerPoint(L.latLng({lat:reply.data[dx].lat, lng:reply.data[dx].lng})))
                        if (value!=0) {
                            reply.data[dx].count = (1000*reply.data[dx].count)/value
                            if (reply.data[dx].count>maxVal) {
                                maxVal = reply.data[dx].count
                            }
                        }
                    }
                    reply.max = 1.25*maxVal
                    map.removeLayer(invHeatmapLayer)
                    if (document.getElementById('heatMapCheckBox').checked) {
                        map.addLayer(heatmapLayer)
                    }
                }

                heatmapLayer._data = []
                heatmapLayer.setData(reply);
                heatmapLayer._update()
            }
        }
        xhttp.open("GET", '/getTrapgroupCounts/'+selectedTask+'/'+selection+'/'+baseUnit+'?excludeNothing='+excludeNothing+'&excludeKnocks='+excludeKnocks+'&excludeVHL='+excludeVHL);
        xhttp.send();
    }
}

function createMap() {
    /** Initialises the species heat map. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            info = JSON.parse(this.responseText);
            trapgroupInfo = info.trapgroups

            mainDiv = document.getElementById('statisticsDiv')

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
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery ?? <a href="https://www.mapbox.com/">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox/satellite-v9',
                tileSize: 512,
                zoomOffset: -1,
                accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
            })

            osmSt = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery ?? <a href="https://www.mapbox.com/">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1,
                accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
            })

            gSat = L.gridLayer.googleMutant({type: 'satellite'})
            gStr = L.gridLayer.googleMutant({type: 'roadmap'})
            gTer = L.gridLayer.googleMutant({type: 'terrain'})
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
                "Google Roadmap": gStr,
                "Google Terrain": gTer,
                "Google Hybrid": gHyb,
                "OpenStreetMaps Satellite": osmSat,
                "OpenStreetMaps Roadmap": osmSt
            };

            L.control.layers(baseMaps).addTo(map);
            L.control.scale().addTo(map);
            map._controlCorners['bottomleft'].style.marginBottom = "25px";
            map._controlCorners['bottomright'].style.marginBottom = "14px";

            map.on('baselayerchange', function(e) {
                if (e.name.includes('Google')) {
                    map._controlCorners['bottomleft'].style.marginBottom = "25px";
                    map._controlCorners['bottomright'].style.marginBottom = "14px";
                }
            });

            markers = []
            refMarkers = []
            for (l=0;l<trapgroupInfo.length;l++) {
                marker = L.marker([trapgroupInfo[l].latitude, trapgroupInfo[l].longitude]).addTo(map)
                markers.push(marker)
                map.addLayer(marker)
                marker.bindPopup(trapgroupInfo[l].name);
                marker.on('mouseover', function (e) {
                    this.openPopup();
                });
                marker.on('mouseout', function (e) {
                    this.closePopup();
                });
                refMarkers.push({lat:trapgroupInfo[l].latitude,lng:trapgroupInfo[l].longitude,count:1000,tag:trapgroupInfo[l].name})
            }
            refData = {max:2000,data:refMarkers}
            invHeatmapLayer.setData(refData)

            var group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1))

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
                    select.setAttribute('id','mapSpeciesSelector')
                    selectorDiv.appendChild(select)
                
                    fillSelect(select,speciesNames,speciesValues)

                    $("#mapSpeciesSelector").change( function() {
                        mapSpeciesSelector = document.getElementById('mapSpeciesSelector')
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
                    checkBoxLabel.innerHTML = 'Show Traps'
                    checkBoxDiv.appendChild(checkBoxLabel)
        
                    $("#markerCheckBox").change( function() {
                        if (document.getElementById('markerCheckBox').checked) {
                            for (mx=0;mx<markers.length;mx++) {
                                if (!map.hasLayer(markers[mx])) {
                                    map.addLayer(markers[mx])
                                }
                            }
                        } else {
                            for (mx=0;mx<markers.length;mx++) {
                                if (map.hasLayer(markers[mx])) {
                                    map.removeLayer(markers[mx])
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
                    checkBoxLabel.innerHTML = 'Normalise for Trap Density'
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
    xhttp.open("GET", '/getCoords/'+selectedTask);
    xhttp.send();
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
    clearPolarColours()
    clearBarColours()
    document.getElementById('statisticsErrors').innerHTML = ''
}

analysisSelector.addEventListener('click', ()=>{
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
});

modalStatistics.on('hidden.bs.modal', function(){
    /** Clears the statistics modal when it is closed, unless it is being closed to open the help modal. */
    if (!helpReturn) {
        clearPolarColours()
        clearBarColours()
        clearStatistics()
        analysisSelector.selectedIndex = 0
        modalResults.modal({keyboard: true});
    } else {
        helpReturn = false
    }
});