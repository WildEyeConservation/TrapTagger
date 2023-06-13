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
    
    // xAxisSelector = document.getElementById('xAxisSelector')
    // xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    // if (xAxisSelection=='1') {
    //     dataset = {
    //         data: data,
    //         hoverBackgroundColor: colour,
    //         borderColor: 'rgba(255,255,255,1)',
    //         borderWidth: 1,
    //         barPercentage: 1.0,
    //         categoryPercentage: 1.0,
    //         backgroundColor: colour
    //     }
    // } else {
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
    // }
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
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets.splice(i, 1);
            break
        }
    }
    chartColours[colour] = false
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
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets.splice(i, 1);
            break
        }
    }
    chartColours[colour] = false
    chart.update()
}

function clearPolarColours() {
    /** Clears the polarColours object */
    for (let key in polarColours) {
        polarColours[key] = false
    }
}

function clearBarColours() {
    /** Clears the barColours object */
    for (let key in barColours) {
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
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets[i].data=data
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

    // xAxisSelector = document.getElementById('xAxisSelector')
    // xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            // if (xAxisSelection=='1') {
            //     chart.data.datasets[i].hoverBackgroundColor = chart.data.datasets[i].backgroundColor
            // } else {
            //     chart.data.datasets[i].hoverBackgroundColor = 'rgba(255,255,255,0.2)'
            // }
            chart.data.datasets[i].hoverBackgroundColor = 'rgba(255,255,255,0.2)'
            chart.data.datasets[i].data=data
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
            for (let i=0;i<data.length;i++) {
                newData.push(+((data[i]/total).toFixed(2)))
            }
        }
    } else {
        newData = data
    }

    if (document.getElementById('chartTypeSelector')){     
        chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
    } else {
        chartType = 'polarArea'
    }

    if (polarData[IDkey]['new']) {
        addData(newData,colour, chartType)
        polarData[IDkey]['new'] = false
    } else {
        editData(newData,colour, chartType)
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
                for (let i=0;i<data.length;i++) {
                    newData.push(+((data[i]/total).toFixed(2)))
                }
            }
        } else {
            newData = data
        }
    }
    if (document.getElementById('chartTypeSelector')){     
        chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
    } else {
        chartType = 'bar'
    }

    if (barData[IDkey]['new']) {
        addData(newData,colour,chartType)
        barData[IDkey]['new'] = false
    } else {
        editData(newData,colour,chartType)
    }
}

function updatePolarErrors() {
    /** Checks for sighting counts in the current polar chart, and displays a warning if a species has not had its sightings checked. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnitSelection == '3') {
        species_count_warning = false
        for (let IDNum in polarData) {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text

            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }

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


function updateBarErrors() {
    /** Checks for sighting counts in the current bar chart, and displays a warning if a species has not had its sightings checked. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnitSelection == '3') {
        species_count_warning = false
        for (let IDNum in barData) {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }
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

function updatePolarData(IDNum) {
    /** Requests the dataset associated with the specified ID number, for the active polar chart. */

    trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value
    site = trapgroupSelector.options[trapgroupSelector.selectedIndex].text
    speciesSelector = document.getElementById('speciesSelect-'+IDNum)
    species = speciesSelector.options[speciesSelector.selectedIndex].text
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    startDate = document.getElementById('startDate').value
    endDate = document.getElementById('endDate').value

    if(startDate != ''){
        startDate = startDate + ' 00:00:00'
    }
    else{
        startDate = ''
    }

    if(endDate != ''){
        endDate = endDate + ' 23:59:59'
    }
    else{
        endDate = ''
    }

    if(selectedTask){
        var tasks = [selectedTask]
    }else{
        var tasks = getSelectedTasks()
    }

    if (species == 'All') {
        species = '0'
    }

    if (site == 'All') {	
        site = '0'
    }
    else if (site.includes('(')) {
        var split = site.split(' ')
        site = split[0] + ',' + split[1].split('(')[1].split(',')[0] + ',' + split[2].split(')')[0]
    }

    var traps = null
    if (trapgroup.includes(',')) {
        traps = trapgroup.split(',')
    }
    else {
        if (isNaN(trapgroup) || trapgroup == '0') {
            traps = trapgroup
        }
        else {
            traps = [trapgroup]
        }
    }

    if (trapgroup!='-1') {
        var reqID = Math.floor(Math.random() * 100000) + 1;
        activeRequest[IDNum.toString()] = reqID

        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnitSelection));
        formData.append('trapgroup', JSON.stringify(traps));
        formData.append('reqID', JSON.stringify(reqID));
        formData.append('startDate', JSON.stringify(startDate));
        formData.append('endDate', JSON.stringify(endDate));

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    console.log(response)
                    IDkey = wrapIDNum.toString()
                    if (parseInt(response.reqID)==activeRequest[IDkey]) {
                        reply = response.data
                        
                        if (!polarData.hasOwnProperty(IDkey)) {
                            colour = null
                            for (let key in chartColours) {
                                if (chartColours[key]==false) {
                                    chartColours[key] = true
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
                        for (let i=0;i<reply.length;i++) {
                            total += reply[i]
                        }
                        polarData[IDkey]['total'] = total
        
                        updatePolarDisplay(wrapIDNum)
                    }
                }
            }
        }(IDNum);
        xhttp.open("POST", 'getPolarData');
        xhttp.send(formData);
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
    species = speciesSelector.options[speciesSelector.selectedIndex].text
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    startDate = document.getElementById('startDate').value
    endDate = document.getElementById('endDate').value

    if(startDate != ''){
        startDate = startDate + ' 00:00:00'
    }
    else{
        startDate = ''
    }

    if(endDate != ''){
        endDate = endDate + ' 23:59:59'
    }
    else{
        endDate = ''
    }

    if(selectedTask){
        var tasks = [selectedTask]
    }else{
        var tasks = getSelectedTasks()
    }

    if(species == 'All'){
        species = '0'
    }

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify(tasks));
    formData.append('species', JSON.stringify(species));
    formData.append('baseUnit', JSON.stringify(baseUnitSelection));
    formData.append('axis', JSON.stringify(xAxisSelection));
    formData.append('startDate', JSON.stringify(startDate));
    formData.append('endDate', JSON.stringify(endDate));

    if (species!='-1') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
  
                    IDkey = wrapIDNum.toString()

                    trapgroupNames = reply.labels
                    chart.data.labels = trapgroupNames
    
                    if (!barData.hasOwnProperty(IDkey)) {
                        colour = null
                        for (let key in chartColours) {
                            if (chartColours[key]==false) {
                                chartColours[key] = true
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
                    barData[IDkey]['data'] = reply.data
    
                    total = 0
                    for (let i=0;i<reply.data.length;i++) {
                        total += reply.data[i]
                    }
                    barData[IDkey]['total'] = total
    
                    updateBarDisplay(wrapIDNum)
                }
            }
        }(IDNum);
        xhttp.open("POST", 'getBarData');
        xhttp.send(formData);
    } else {
        barData[IDkey]['data'] = [0]
        barData[IDkey]['total'] = 0
        updateBarDisplay(IDNum)
    }
}

function normalisePolar() {
    /** Normalises the polar chart data. */
    for (let IDNum in polarData) {
        updatePolarDisplay(IDNum)
    }
}

function normaliseBar() {
    /** Normalises the bar chart data */
    for (let IDNum in barData) {
        updateBarDisplay(IDNum)
    }
}

function updateBaseUnitPolar() {
    /** Updates the base unit of the active polar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (let IDNum in polarData) {
        updatePolarData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text

            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }

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

function updateBaseUnitBar() {
    /** Updates the base unit of the active bar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (let IDNum in barData) {
        updateBarData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }
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
    for (let i=0;i<reply.data.length;i++) {
        value = invHeatmapLayer._heatmap.getValueAt(map.latLngToLayerPoint(L.latLng({lat:reply.data[i].lat, lng:reply.data[i].lng})))
        if (value!=0) {
            reply.data[i].count = (1000*reply.data[i].count)/value
            if (reply.data[i].count>maxVal) {
                maxVal = reply.data[i].count
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

    var mapSpeciesSelector = document.getElementById('speciesSelect')
    var selection = mapSpeciesSelector.options[mapSpeciesSelector.selectedIndex].value
    var species = mapSpeciesSelector.options[mapSpeciesSelector.selectedIndex].text
    var baseUnitSelector = document.getElementById('baseUnitSelector')
    var baseUnit = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    var startDate = document.getElementById('startDate').value
    var endDate = document.getElementById('endDate').value

    if(startDate != ''){
        startDate = startDate + ' 00:00:00'
    }
    else{
        startDate = ''
    }

    if(endDate != ''){
        endDate = endDate + ' 23:59:59'
    }
    else{
        endDate = ''
    }

    if(selectedTask){
        var tasks = [selectedTask]
    }else{
        var tasks = getSelectedTasks()
        var sites = getSelectedSites()
    }

    if(species == 'All'){
        species = '0'
    }

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnit=='3') {
        var formData = new FormData()
        formData.append("task_ids", JSON.stringify(tasks))
        formData.append("species", JSON.stringify(species))

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/checkSightingEditStatus');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='warning') {
                    document.getElementById('statisticsErrors').innerHTML = reply.message
                }
            }
        }
        xhttp.send(formData);
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

        var formData = new FormData();
        formData.append('task_ids', JSON.stringify(tasks));
        formData.append('species', JSON.stringify(species));
        formData.append('baseUnit', JSON.stringify(baseUnit));
        formData.append('startDate', JSON.stringify(startDate));
        formData.append('endDate', JSON.stringify(endDate));
        if (!selectedTask) {
            console.log(sites)
            formData.append('sites', JSON.stringify(sites));
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
                    for (let i=0;i<reply.data.length;i++) {
                        value = invHeatmapLayer._heatmap.getValueAt(map.latLngToLayerPoint(L.latLng({lat:reply.data[i].lat, lng:reply.data[i].lng})))
                        if (value!=0) {
                            reply.data[i].count = (1000*reply.data[i].count)/value
                            if (reply.data[i].count>maxVal) {
                                maxVal = reply.data[i].count
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
        xhttp.open("POST", '/getTrapgroupCounts?excludeNothing='+excludeNothing+'&excludeKnocks='+excludeKnocks+'&excludeVHL='+excludeVHL);
        xhttp.send(formData);
    }
}

function checkDates(){
    /** Checks that the start date is before the end date. */
    var valid = true
    var startDate = document.getElementById('startDate').value
    var endDate = document.getElementById('endDate').value

    document.getElementById('dateErrors').innerHTML = ''

    if(startDate != '' && endDate != ''){
        if(startDate > endDate){
            valid = false
        }
    }

    return valid
}

function updateLineData(IDNum){
    /** Updates the line chart data. */
    trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value
    site = trapgroupSelector.options[trapgroupSelector.selectedIndex].text
    speciesSelector = document.getElementById('speciesSelect-'+IDNum)
    species = speciesSelector.options[speciesSelector.selectedIndex].text
    selection = speciesSelector.options[speciesSelector.selectedIndex].value
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    timeUnitSelector = document.getElementById('timeUnitSelector')
    timeUnitSelection = timeUnitSelector.options[timeUnitSelector.selectedIndex].value
    startDate = document.getElementById('startDate').value
    endDate = document.getElementById('endDate').value

    if(startDate != ''){
        startDate = startDate + ' 00:00:00'
    }
    else{
        startDate = ''
    }

    if(endDate != ''){
        endDate = endDate + ' 23:59:59'
    }
    else{
        endDate = ''
    }

    if(selectedTask){
        var tasks = [selectedTask]
    }else{
        var tasks = getSelectedTasks()
    }

    if (species == 'All') {
        species = '0'
    }

    if (site == 'All') {	
        site = '0'
    }
    else if (site.includes('(')) {
        var split = site.split(' ')
        site = split[0] + ',' + split[1].split('(')[1].split(',')[0] + ',' + split[2].split(')')[0]
    }

    var traps = null
    if (trapgroup.includes(',')) {
        traps = trapgroup.split(',')
    }
    else {
        if (isNaN(trapgroup) || trapgroup == '0') {
            traps = trapgroup
        }
        else {
            traps = [trapgroup]
        }
    }

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify(tasks));
    formData.append('species', JSON.stringify(species));
    formData.append('baseUnit', JSON.stringify(baseUnitSelection));
    formData.append('trapgroup', JSON.stringify(traps));
    formData.append('timeUnit', JSON.stringify(timeUnitSelection));
    formData.append('startDate', JSON.stringify(startDate));
    formData.append('endDate', JSON.stringify(endDate));

    if (trapgroup!='-1' && selection != '-1') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    console.log(response)
                    IDkey = wrapIDNum.toString()

                    if (startDate != '' && endDate != '') {
                        timeLabels = response.labels
                    } else {
                        updateTimeLabels(response.labels, response.timeUnit)
                    }
                    chart.data.labels = timeLabels

                    if (!lineData.hasOwnProperty(IDkey)) {
                        colour = null
                        for (let key in chartColours) {
                            if (chartColours[key]==false) {
                                chartColours[key] = true
                                colour = key
                                break
                            }
                        }
                        if (colour != null) {
                            btnColour = colour
                            btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                            btnRemove.setAttribute('style','background-color: '+btnColour)
                            lineData[IDkey] = {}
                            lineData[IDkey]['colour'] = colour
                            lineData[IDkey]['new'] = true
                        }
                    }

                    lineData[IDkey]['data'] = response.data
                    lineData[IDkey]['labels'] = response.labels

                    if (startDate != '' && endDate != '') {
                        updateLineDisplay(wrapIDNum)
                    } else {
                        updatLineDataAndLabels()

                        for (let IDNum in lineData) {
                            updateLineDisplay(IDNum)
                        }
                    }
                }
            }
        }(IDNum);
        xhttp.open("POST", 'getLineData');
        xhttp.send(formData);
    } else {
        IDkey = IDNum.toString()
        if (lineData.hasOwnProperty(IDkey)) {
            lineData[IDkey]['data'] = []
            lineData[IDkey]['labels'] = []
            updateLineDisplay(IDNum)
        }
    }
}

function updateLineDisplay(IDNum){
    /** Updates the line chart display. */
    IDkey = IDNum.toString()
    data = lineData[IDkey]['data']
    colour = lineData[IDkey]['colour']

    if (document.getElementById('chartTypeSelector')){     
        chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
    } else {
        chartType = 'line'
    }

    if (lineData[IDkey]['new']) {
        addData(data,colour,chartType)
        lineData[IDkey]['new'] = false
    } else {
        editData(data,colour,chartType)
    }
}

function addLineData(data,colour) {
    /**
     * Adds the stipulated data to an active line chart.
     * @param {arr} data The data points
     * @param {str} colour The colour with which to display the data
     */
    
    dataset = {
        data: data,
        hoverBackgroundColor: colour,
        backgroundColor: colour,
        borderColor: colour,
        borderWidth: 2,
        fill: false,
        tension : 0.1
    }
    chart.data.datasets.push(dataset)
    chart.update()
}

function editLineData(data,colour) {
    /** Edits the stipulated data in an active line chart. */
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].borderColor==colour) {
            chart.data.datasets[i].data=data
            break
        }
    }
    chart.update()
}

function updateLineErrors() {
    /** Checks for sighting counts in the current polar chart, and displays a warning if a species has not had its sightings checked. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnitSelection == '3') {
        species_count_warning = false
        for (let IDNum in polarData) {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text

            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }

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

function updateBaseUnitLine() {
    /** Updates the base unit of the active polar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (let IDNum in lineData) {
        updateLineData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelect-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text

            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }

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

function removeLineData(colour) {
    /**
     * Removes a dataset from the active line chart based on colour.
     * @param {str} colour The colour dataset to remove
     */

    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].borderColor==colour) {
            chart.data.datasets.splice(i, 1);
            break
        }
    }
    chartColours[colour] = false
    chart.update()

}

function clearLineColours(){
    /** Clears the lineColours object */
    for (let key in lineColours) {
        lineColours[key] = false
    }
}

function updateTimeLabels(labels, timeUnit) {
    /** Updates the line chart's labels*/
    var dTimeLabels = timeLabels.map(date => new Date(date));
    var dLabels = labels.map(date => new Date(date));

    var min_date = new Date(Math.min(...dTimeLabels, ...dLabels));
    var max_date = new Date(Math.max(...dTimeLabels, ...dLabels));

    while (min_date <= max_date) {
        if (timeUnit === '1') {
            if (!dTimeLabels.some(d => d.getDate() === min_date.getDate() && d.getMonth() === min_date.getMonth() && d.getFullYear() === min_date.getFullYear())) {
                dTimeLabels.push(new Date(min_date));
            }
            min_date.setDate(min_date.getDate() + 1);
        } else if (timeUnit === '2') {
            if (!dTimeLabels.some(d => d.getMonth() === min_date.getMonth() && d.getFullYear() === min_date.getFullYear())) {
                dTimeLabels.push(new Date(min_date));
            }
            min_date.setMonth(min_date.getMonth() + 1);
        } else if (timeUnit === '3') {
            if (!dTimeLabels.some(d => d.getFullYear() === min_date.getFullYear())) {
                dTimeLabels.push(new Date(min_date));
            }
            min_date.setFullYear(min_date.getFullYear() + 1);
        }
    }

    dTimeLabels.sort((a, b) => a.getTime() - b.getTime());

    if (timeUnit === '1') {
        timeLabels = dTimeLabels.map(date => date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }));
    } else if (timeUnit === '2') {
        timeLabels = dTimeLabels.map(date => date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' }));
    } else if (timeUnit === '3') {
        timeLabels = dTimeLabels.map(date => date.toLocaleDateString('en-GB', { year: 'numeric' }));
    }

}


function updatLineDataAndLabels(){
    /** Updates the line data to correspond to the correct labels */

    for (let IDNum in lineData) {
        if (lineData[IDNum]['data'].length != timeLabels.length || lineData[IDNum]['labels'][0] != timeLabels[0]) {
            temp_data = lineData[IDNum]['data']
            temp_labels = lineData[IDNum]['labels']
            lineData[IDNum]['data'] = []
            lineData[IDNum]['labels'] = []
            for (let i=0;i<timeLabels.length;i++) {
                if (temp_labels.includes(timeLabels[i])) {
                    lineData[IDNum]['data'].push(temp_data[temp_labels.indexOf(timeLabels[i])])
                    lineData[IDNum]['labels'].push(timeLabels[i])
                } else {
                    lineData[IDNum]['data'].push(0)
                    lineData[IDNum]['labels'].push(timeLabels[i])
                }
            }
        }
    }
}

function addScatterData(data, colour){
    /** Adds data to the active scatter chart */
    console.log('Add scatter data')
    dataset = {
        data: data,
        hoverBackgroundColor: colour,
        backgroundColor: colour,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,1)'
    }
    chart.data.datasets.push(dataset)
    chart.update()

}

function editScatterData(data, colour){
    /** Edits the active scatter chart's data */
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets[i].data=data
            break
        }
    }
    chart.update()

}

function addRadarData(data, colour){
    /** Adds data to the active radar chart */
    if (colour=='rgba(255,255,255,0.2)') {
        background = 'rgba(0,0,0,0.2)'
    } else {
        background = 'rgba(255,255,255,0.2)'
    }
    dataset = {
        data: data,
        hoverBackgroundColor: background,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,1)',
        backgroundColor: colour
    }
    chart.data.datasets.push(dataset)
    chart.update()

}

function editRadarData(data, colour){
    /** Edits the active radar chart's data */
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }

    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets[i].data=data
            break
        }
    }
    chart.update()

}

function removeRadarData(colour){
    /** Removes data from the active radar chart */
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets.splice(i, 1);
            break
        }
    }
    chartColours[colour] = false
    chart.update()
}

function removeScatterData(colour){
    /** Removes data from the active radar chart */
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].borderColor==colour) {
            chart.data.datasets.splice(i, 1);
            break
        }
    }
    chartColours[colour] = false
    chart.update()
}

function addData(data, colour, chartType){
    /** Adds data to the active chart */
    if (chartType=='line'){
        addLineData(data, colour)
    }
    else if (chartType=='polarArea'){
        addPolarData(data, colour)
    }
    else if (chartType=='bar'){
        addBarData(data, colour)
    }
    else if (chartType=='scatter'){
        addScatterData(data, colour)
    }
    else if (chartType=='radar'){
        addRadarData(data, colour)
    }
}

function editData(data, colour, chartType){
    /** Edits the active chart's data */
    if (chartType=='line'){
        editLineData(data, colour)
    }
    else if (chartType=='polarArea'){
        editPolarData(data, colour)
    }
    else if (chartType=='bar'){
        editBarData(data, colour)
    }
    else if (chartType=='scatter'){
        editScatterData(data, colour)
    }
    else if (chartType=='radar'){
        editRadarData(data, colour)
    }
}

function removeData(colour, chartType){
    /** Removes data from the active chart */
    if (chartType=='line'){
        removeLineData(colour)
    }
    else if (chartType=='polarArea'){
        removePolarData(colour)
    }
    else if (chartType=='bar'){
        removeBarData(colour)
    }
    else if (chartType=='scatter'){
        removeScatterData(colour)
    }
    else if (chartType=='radar'){
        removeRadarData(colour)
    }
}

function clearChartColours(){
    /** Clears the chartColours object */
    for (let key in chartColours) {
        chartColours[key] = false
    }
}

