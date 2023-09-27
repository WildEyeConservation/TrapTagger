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

function addPolarData(data,colour,legend,IDNum) {
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
        id: 'data-'+IDNum,
        label: legend,
        data: data,
        hoverBackgroundColor: background,
        borderWidth: 1,
        backgroundColor: colour
    }
    chart.data.datasets.push(dataset)

    chart.options.legend.labels = {
        fontColor: 'white',
        generateLabels: function (chart) {
          const datasets = chart.data.datasets;
          const labels = datasets.map((dataset) => ({
            text: dataset.label,
            fillStyle: dataset.backgroundColor,
            borderColor: dataset.borderColor,
          }));
    
          return labels;
        }
    }

    chart.update()
}

function addBarData(data,colour,legend,IDNum) {
    /**
     * Adds the stipulated data to an active bar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour with which to display the data
     */
    

    if (colour=='rgba(255,255,255,0.2)') {
        background = 'rgba(0,0,0,0.2)'
    } else {
        background = 'rgba(255,255,255,0.2)'
    }
    dataset = {
        id: 'data-'+IDNum,
        label: legend,
        data: data,
        hoverBackgroundColor: background,
        borderColor: 'rgba(255,255,255,0.8)',
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        backgroundColor: colour
    }
    
    chart.data.datasets.push(dataset)
    chart.update()
}

function removePolarData(IDNum) {
    /**
     * Removes a dataset from the active polar chart based on colour.
     * @param {str} colour The colour dataset to remove
     */
    
    var datasets = []
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum || chart.data.datasets[i].id=='trendline-'+IDNum) {
            chartColours[chart.data.datasets[i].backgroundColor] = false
        }
        else{
            datasets.push(chart.data.datasets[i])
        }
    }
    chart.data.datasets = datasets
    chart.update()
}

function removeBarData(IDNum) {
    /** 
     * Removes a dataset from the active bar chart based on colour.
     * @param {str} colour The colour dataset to remove
     */
    
    var datasets = []
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum || chart.data.datasets[i].id=='trendline-'+IDNum) {
            chartColours[chart.data.datasets[i].backgroundColor] = false
        }
        else{
            datasets.push(chart.data.datasets[i])
        }
    }
    chart.data.datasets = datasets
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

function clearData() {
    /** Clears the polarData, barData, lineData objects */
    for (let key in polarData) {
        polarData[key]['data'] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        polarData[key]['total'] = 0
        polarData[key]['legend'] = null
        updatePolarDisplay(key)
    }
    for (let key in barData) {
        barData[key]['data'] = [0]
        barData[key]['total'] = 0
        barData[key]['legend'] = null
        updateBarDisplay(key)
    }
    for (let key in lineData) {
        lineData[key]['data'] = []
        lineData[key]['labels'] = []
        lineData[key]['legend'] = null
        updateLineDisplay(key)
    }
}

function editPolarData(data,IDNum,legend) {
    /** 
     * Edits the data associated with the specified colour in the active polar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour to edit
     */

    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum) {
            chart.data.datasets[i].data=data
            chart.data.datasets[i].label=legend
            break
        }
    }
    chart.update()
}

function editBarData(data,IDNum,legend) {
    /** 
     * Edits the data associated with the specified colour in the active bar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour to edit
     */

    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum) {
            chart.data.datasets[i].hoverBackgroundColor = 'rgba(255,255,255,0.2)'
            chart.data.datasets[i].data=data
            chart.data.datasets[i].label=legend
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
    legend = polarData[IDkey]['legend']
    
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
        addData(newData,colour, chartType, legend, IDkey)
        polarData[IDkey]['new'] = false
    } else {
        editData(newData,colour, chartType, legend, IDkey)
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
    legend = barData[IDkey]['legend']
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
        addData(newData,colour,chartType, legend, IDkey)
        barData[IDkey]['new'] = false
    } else {
        editData(newData,colour,chartType,legend, IDkey)
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

            if (tasks != '-1') {
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
}


function updateBarErrors() {
    /** Checks for sighting counts in the current bar chart, and displays a warning if a species has not had its sightings checked. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    if (baseUnitSelection == '3') {
        species_count_warning = false
        for (let IDNum in barData) {
            speciesSelector = document.getElementById('speciesSelectNum-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }

            if (tasks != '-1') {
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
}

function updatePolarData(IDNum) {
    /** Requests the dataset associated with the specified ID number, for the active polar chart. */
    var trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    var trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value
    var site = trapgroupSelector.options[trapgroupSelector.selectedIndex].text
    var speciesSelector = document.getElementById('speciesSelect-'+IDNum)
    var species = speciesSelector.options[speciesSelector.selectedIndex].text
    var baseUnitSelector = document.getElementById('baseUnitSelector')
    var baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    var startDate = document.getElementById('startDate').value
    var endDate = document.getElementById('endDate').value
    var validDates = checkDates()

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
        var normliseBySite = document.getElementById('normaliseBySiteEffort').checked
        if (normliseBySite) {
            normliseBySite = '1'
        }
        else {
            normliseBySite = '0'
        }
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
    var group = '-1'
    if (trapgroup.includes('s-')) {
        var trapgroupVal = trapgroup.split('-')[1]
    }
    else if (trapgroup.includes('g-')) {
        var groupVal = trapgroup.split('-')[1]
        group = groupVal
        var trapgroupVal = '-1'
    }
    else {
        var trapgroupVal = trapgroup
    }

    if (trapgroupVal.includes(',')) {
        traps = trapgroupVal.split(',')
    }
    else {
        if (isNaN(trapgroupVal) || trapgroupVal == '0' || trapgroupVal == '-1') {
            traps = trapgroupVal
        }
        else {
            traps = [trapgroupVal]
        }
    }
    
    if (((traps!='-1' && traps!= 'None')||(group!='-1')) && (species!= 'None' && species!= '-1') && (tasks!='-1') && (validDates)) {
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
        formData.append('group', JSON.stringify(group));

        if (baseUnitSelection == '4'){
            var timeToIndependence = document.getElementById('timeToIndependence').value
            var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
            formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
            formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
        }

        if (!selectedTask){
            formData.append('normaliseBySite', JSON.stringify(normliseBySite));
            disablePanel()
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum, wrapSpecies, wrapSite){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    // console.log(response)
                    IDkey = wrapIDNum.toString()

                    if (!selectedTask){
                        enablePanel()
                    }

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

                            var colourSelector = document.getElementById('colourSelect-'+wrapIDNum)
                            if (colourSelector) {
                                if (colourSelector.style.backgroundColor != '') {
                                    colour = colourSelector.style.backgroundColor
                                    polarData[IDkey] = {}
                                    polarData[IDkey]['colour'] = colour
                                    polarData[IDkey]['new'] = true
                                }
                                else {
                                    if (colour != null) {
                                        colourSelector.value = colour
                                        colourSelector.style.backgroundColor = colour
                                        polarData[IDkey] = {}
                                        polarData[IDkey]['colour'] = colour
                                        polarData[IDkey]['new'] = true
                                    }
                                }
                            }
                            else{
                                if (colour != null) {
                                    btnColour = colour
                                    btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                                    btnRemove.setAttribute('style','background-color: '+btnColour)
                                    polarData[IDkey] = {}
                                    polarData[IDkey]['colour'] = colour
                                    polarData[IDkey]['new'] = true
                                }
                            }
                        }
                        polarData[IDkey]['data'] = reply

                        var species_text = ''
                        var site_text = ''

                        if (wrapSpecies == '0') {
                            species_text = 'All'
                        }
                        else {
                            species_text = wrapSpecies
                        }

                        if (wrapSite.includes(',')) {
                            site_text = wrapSite.split(',')[0] 
                            polarData[IDkey]['legend'] = site_text + ' '+ species_text  
                        }
                        else {
                            polarData[IDkey]['legend'] = species_text  
                        }
        
                        total = 0
                        for (let i=0;i<reply.length;i++) {
                            total += reply[i]
                        }
                        polarData[IDkey]['total'] = total
        
                        updatePolarDisplay(wrapIDNum)
                    }
                }
                else if (this.readyState == 4 && this.status != 200) {
                    if (!selectedTask){
                        enablePanel()
                    }
                }
            }
        }(IDNum, species, site);
        xhttp.open("POST", 'getPolarData');
        xhttp.send(formData);
    } else {
        IDkey = IDNum.toString()
        if (polarData.hasOwnProperty(IDkey)) {
            polarData[IDkey]['data'] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
            polarData[IDkey]['total'] = 0
            polarData[IDkey]['legend'] = ''	
            updatePolarDisplay(IDNum)
        }
    }
}

function updateBarData(IDNum) {
    /** Requests the dataset associated with the specified ID number, for the active bar chart. */

    var speciesSelector = document.getElementById('speciesSelectNum-'+IDNum)
    var species = speciesSelector.options[speciesSelector.selectedIndex].text
    var baseUnitSelector = document.getElementById('baseUnitSelector')
    var baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    var xAxisSelector = document.getElementById('xAxisSelector')
    var xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    var startDate = document.getElementById('startDate').value
    var endDate = document.getElementById('endDate').value
    var validDates = checkDates()

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
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
        var normaliseBySite = document.getElementById('normaliseBySiteEffort').checked
        if (normaliseBySite) {
            normaliseBySite = '1'
        }
        else {
            normaliseBySite = '0'
        }
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
    if (!selectedTask) {
        formData.append('sites_ids', JSON.stringify(sites));
        formData.append('groups', JSON.stringify(groups));
        formData.append('normaliseBySite', JSON.stringify(normaliseBySite));
    }

    if (baseUnitSelection == '4'){
        var timeToIndependence = document.getElementById('timeToIndependence').value
        var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
        formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
        formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
    }

    if (species!='-1' && species!='None' && tasks!='-1' && validDates) {

        if (!selectedTask){
            disablePanel()
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum, wrapSpecies){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    // console.log(reply)
                    IDkey = wrapIDNum.toString()

                    if (!selectedTask){
                        enablePanel()
                    }

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

                        var colourSelector = document.getElementById('colourSelectSpecies-'+wrapIDNum)
                        if (colourSelector){
                            if (colourSelector.style.backgroundColor != '') {
                                colour = colourSelector.style.backgroundColor
                                barData[IDkey] = {}
                                barData[IDkey]['colour'] = colour
                                barData[IDkey]['new'] = true
                            }
                            else {
                                if (colour != null) {
                                    colourSelector.value = colour
                                    colourSelector.style.backgroundColor = colour
                                    barData[IDkey] = {}
                                    barData[IDkey]['colour'] = colour
                                    barData[IDkey]['new'] = true
                                }
                            }
                        }
                        else{
                            if (colour != null) {
                                btnColour = colour
                                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                                btnRemove.setAttribute('style','background-color: '+btnColour)
                                barData[IDkey] = {}
                                barData[IDkey]['colour'] = colour
                                barData[IDkey]['new'] = true
                            }
                        }
                    }
                    barData[IDkey]['data'] = reply.data

                    var species_text = ''

                    if (wrapSpecies == '0') {
                        species_text = 'All'
                    }
                    else {
                        species_text = wrapSpecies
                    }
                        
                    barData[IDkey]['legend'] = species_text  
    
                    total = 0
                    for (let i=0;i<reply.data.length;i++) {
                        total += reply.data[i]
                    }
                    barData[IDkey]['total'] = total
    
                    updateBarDisplay(wrapIDNum)
                }
                else if (this.readyState == 4 && this.status != 200) {
                    if (!selectedTask){
                        enablePanel()
                    }
                }
            }
        }(IDNum, species);
        xhttp.open("POST", 'getBarData');
        xhttp.send(formData);
    } else {
        IDkey = IDNum.toString()
        if (barData.hasOwnProperty(IDkey)) {
            barData[IDkey]['data'] = [0]
            barData[IDkey]['total'] = 0
            updateBarDisplay(IDNum)
        }
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

            if (tasks != '-1') {
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
}

function updateBaseUnitBar() {
    /** Updates the base unit of the active bar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (let IDNum in barData) {
        updateBarData(IDNum)

        if (document.getElementById('baseUnitSelector').options[document.getElementById('baseUnitSelector').selectedIndex].value=='3') {
            speciesSelector = document.getElementById('speciesSelectNum-'+IDNum)
            species = speciesSelector.options[speciesSelector.selectedIndex].text
            if(selectedTask){
                var tasks = [selectedTask]
            }else{
                var tasks = getSelectedTasks()
            }
            if (tasks != '-1') {
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
    var validDates = checkDates()

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
        var selectedSites = getSelectedSites()
        var sites = selectedSites[0]
        var groups = selectedSites[1]
        var normaliseBySite = document.getElementById('normaliseBySiteEffort').checked
        if (normaliseBySite) {
            normaliseBySite = '1'
        }
        else {
            normaliseBySite = '0'
        }
    }

    if(species == 'All'){
        species = '0'
    }

    document.getElementById('statisticsErrors').innerHTML = ''

    if (tasks != '-1' && validDates) {
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
                formData.append('sites', JSON.stringify(sites));
                formData.append('groups', JSON.stringify(groups));
                formData.append('normaliseBySite', JSON.stringify(normaliseBySite));
            }

            if (baseUnit == '4'){
                var timeToIndependence = document.getElementById('timeToIndependence').value
                var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
                formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
                formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
            }

            if (!selectedTask){
                disablePanel()
            }

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    // console.log(reply)
                    heatMapData = JSON.parse(JSON.stringify(reply))

                    if (!selectedTask){
                        enablePanel()
                    }

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
                else if (this.readyState == 4 && this.status != 200) {
                    if (!selectedTask){
                        enablePanel()
                    }
                }
            }
            xhttp.open("POST", '/getTrapgroupCounts?excludeNothing='+excludeNothing+'&excludeKnocks='+excludeKnocks+'&excludeVHL='+excludeVHL);
            xhttp.send(formData);
        }
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
    var trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    var trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value
    var site = trapgroupSelector.options[trapgroupSelector.selectedIndex].text
    var speciesSelector = document.getElementById('speciesSelect-'+IDNum)
    var species = speciesSelector.options[speciesSelector.selectedIndex].text
    var selection = speciesSelector.options[speciesSelector.selectedIndex].value
    var baseUnitSelector = document.getElementById('baseUnitSelector')
    var baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    var timeUnitSelector = document.getElementById('timeUnitSelector')
    var timeUnitSelection = timeUnitSelector.options[timeUnitSelector.selectedIndex].value
    var timeUnitNumber = document.getElementById('timeUnitNumber').value
    var startDate = document.getElementById('startDate').value
    var endDate = document.getElementById('endDate').value
    var validDates = checkDates()

    if (document.getElementById('startDateTA')){
        var startDateTA = document.getElementById('startDateTA').value
        var endDateTA = document.getElementById('endDateTA').value

        if (startDateTA != '' && endDateTA != '') {
            if (startDateTA > endDateTA) {
                validDates = false
            }
        }

        startDate = startDateTA
        endDate = endDateTA
    }

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
        var normliseBySite = document.getElementById('normaliseBySiteEffort').checked
        if (normliseBySite) {
            normliseBySite = '1'
        }
        else {
            normliseBySite = '0'
        }
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
    var group = '-1'
    if (trapgroup.includes('s-')) {
        var trapgroupVal = trapgroup.split('-')[1]
    }
    else if (trapgroup.includes('g-')) {
        var groupVal = trapgroup.split('-')[1]
        group = groupVal
        var trapgroupVal = '-1'
    }
    else {
        var trapgroupVal = trapgroup
    }

    if (trapgroupVal.includes(',')) {
        traps = trapgroupVal.split(',')
    }
    else {
        if (isNaN(trapgroupVal) || trapgroupVal == '0' || trapgroupVal == '-1') {
            traps = trapgroupVal
        }
        else {
            traps = [trapgroupVal]
        }
    }
    

    var formData = new FormData();
    formData.append('task_ids', JSON.stringify(tasks));
    formData.append('species', JSON.stringify(species));
    formData.append('baseUnit', JSON.stringify(baseUnitSelection));
    formData.append('trapgroup', JSON.stringify(traps));
    formData.append('timeUnit', JSON.stringify(timeUnitSelection));
    formData.append('timeUnitNumber', JSON.stringify(timeUnitNumber));
    formData.append('startDate', JSON.stringify(startDate));
    formData.append('endDate', JSON.stringify(endDate));
    formData.append('group', JSON.stringify(group));
    

    if (baseUnitSelection == '4'){
        var timeToIndependence = document.getElementById('timeToIndependence').value
        var timeToIndependenceUnit = document.getElementById('timeToIndependenceUnit').value
        formData.append('timeToIndependence', JSON.stringify(timeToIndependence))
        formData.append('timeToIndependenceUnit', JSON.stringify(timeToIndependenceUnit))
    }

    if (trapgroup!='-1' && selection != '-1' && tasks!='-1' && validDates) {

        if (!selectedTask){
            disablePanel()
            formData.append('normaliseBySite', JSON.stringify(normliseBySite));
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum, wrapSpecies, wrapSite, wrapTimeUnit){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    // console.log(response)
                    IDkey = wrapIDNum.toString()
   
                    if (!selectedTask){
                        enablePanel()
                    }

                    if (!lineData.hasOwnProperty(IDkey)) {
                        colour = null
                        for (let key in chartColours) {
                            if (chartColours[key]==false) {
                                chartColours[key] = true
                                colour = key
                                break
                            }
                        }

                        var colourSelector = document.getElementById('colourSelect-'+wrapIDNum)
                        if (colourSelector){
                            if (colourSelector.style.backgroundColor != '') {
                                colour = colourSelector.style.backgroundColor
                                lineData[IDkey] = {}
                                lineData[IDkey]['colour'] = colour
                                lineData[IDkey]['new'] = true
                            }
                            else {
                                if (colour != null) {
                                    colourSelector.value = colour
                                    colourSelector.style.backgroundColor = colour
                                    lineData[IDkey] = {}
                                    lineData[IDkey]['colour'] = colour
                                    lineData[IDkey]['new'] = true
                                }
                            }
                        }
                        else{                            
                            if (colour != null) {
                                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                                btnRemove.setAttribute('style','background-color: '+colour)
                                lineData[IDkey] = {}
                                lineData[IDkey]['colour'] = colour
                                lineData[IDkey]['new'] = true
                            }
                        }
                    }

                    lineData[IDkey]['data'] = response.data
                    lineData[IDkey]['labels'] = response.labels

                    timeLabels = response.labels
                    chart.data.labels = response.labels

                    var species_text = ''
                    var site_text = ''

                    if (wrapSpecies == '0') {
                        species_text = 'All'
                    }
                    else {
                        species_text = wrapSpecies
                    }

                    if (wrapSite.includes(',')) {
                        site_text = wrapSite.split(',')[0] 
                        lineData[IDkey]['legend'] = site_text + ' '+ species_text  
                    }
                    else {
                        lineData[IDkey]['legend'] = species_text  
                    }

                    updateLineDisplay(wrapIDNum)

                }
                else if (this.readyState == 4 && this.status != 200) {
                    if (!selectedTask){
                        enablePanel()
                    }
                }
            }
        }(IDNum, species, site, timeUnitSelection);
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
    legend = lineData[IDkey]['legend']

    if (document.getElementById('chartTypeSelector')){     
        chartType = document.getElementById('chartTypeSelector').options[document.getElementById('chartTypeSelector').selectedIndex].value
    } else {
        chartType = 'line'
    }

    if (lineData[IDkey]['new']) {
        addData(data,colour,chartType, legend, IDkey)
        lineData[IDkey]['new'] = false
    } else {
        editData(data,colour,chartType,legend, IDkey)
    }
}

function addLineData(data,colour, legend, IDNum) {
    /**
     * Adds the stipulated data to an active line chart.
     * @param {arr} data The data points
     * @param {str} colour The colour with which to display the data
     */
    
    data = data.map((value) => (value === 0 ? null : value));
    dataset = {
        id: 'data-'+IDNum,
        label: legend,
        data: data,
        hoverBackgroundColor: colour,
        backgroundColor: colour,
        borderColor: colour,
        borderWidth: 2,
        fill: false,
        tension : 0,
        spanGaps: true
    }
    chart.data.datasets.push(dataset)
    chart.update()
}

function editLineData(data,IDNum,legend) {
    /** Edits the stipulated data in an active line chart. */
    data = data.map((value) => (value === 0 ? null : value));
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum) {
            chart.data.datasets[i].data=data
            chart.data.datasets[i].label=legend
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

            if (tasks != '-1') {
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

            if (tasks != '-1') {
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
}

function removeLineData(IDNum) {
    /**
     * Removes a dataset from the active line chart based on colour.
     * @param {str} colour The colour dataset to remove
     */

    var datasets = []
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum || chart.data.datasets[i].id=='trendline-'+IDNum) {
            chartColours[chart.data.datasets[i].backgroundColor] = false
        }
        else{
            datasets.push(chart.data.datasets[i])
        }
    }
    chart.data.datasets = datasets
    chart.update()
}

function clearLineColours(){
    /** Clears the lineColours object */
    for (let key in lineColours) {
        lineColours[key] = false
    }
}

function updateTimeLabels(labels, timeUnit, timeUnitNumber) {
    /** Updates the line chart's labels*/

    var start_date =lineData[0]['labels'][0]
    var end_date = lineData[0]['labels'][lineData[0]['labels'].length-1]
    var timeLabels = []

    for (let i=0; i < lineData.length; i++) {
        if (lineData[i]['labels'][0] < start_date) {
            start_date = lineData[i]['labels'][0]
        }

        if (lineData[i]['labels'][lineData[i]['labels'].length-1] > end_date) {
            end_date = lineData[i]['labels'][lineData[i]['labels'].length-1]
        }
    }

    var min_date = new Date(start_date)
    var max_date = new Date(end_date)
    timeLabels = []

    while (min_date <= max_date) {
        var date = new Date(min_date)
        if (timeUnit === '1') {
            timeLabels.push(date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }));
            min_date.setDate(min_date.getDate() + timeUnitNumber);
        } else if (timeUnit === '2') {
            timeLabels.push(date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' }));
            min_date.setMonth(min_date.getMonth() + timeUnitNumber);
        } else if (timeUnit === '3') {
            timeLabels.push(date.toLocaleDateString('en-GB', { year: 'numeric' }));
            min_date.setFullYear(min_date.getFullYear() + timeUnitNumber);
        }
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
                    lineData[IDNum]['data'].push(null)
                    lineData[IDNum]['labels'].push(timeLabels[i])
                }
            }
        }
    }
}

function addScatterData(data, colour,legend,IDNum){
    /** Adds data to the active scatter chart */
    dataset = {
        id: 'data-'+IDNum,
        label: legend,
        data: data,
        hoverBackgroundColor: colour,
        backgroundColor: colour,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,1)'
    }
    chart.data.datasets.push(dataset)
    chart.options.scales.xAxes[0].labels = chart.data.labels
    chart.update()

}

function editScatterData(data, IDNum, legend){
    /** Edits the active scatter chart's data */

    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum) {
            chart.data.datasets[i].data = []
            let new_data = []
            for (let j=0;j<data.length;j++) {
                var dict = {
                    x: j,
                    y: data[j]
                }
                new_data.push(dict)
            }
            chart.data.datasets[i].data = new_data
            chart.data.datasets[i].label = legend
            break
        }
    }
    chart.options.scales.xAxes[0].labels = chart.data.labels
    chart.update()

}

function addRadarData(data, colour, legend){
    /** Adds data to the active radar chart */
    if (colour=='rgba(255,255,255,0.2)') {
        background = 'rgba(0,0,0,0.2)'
    } else {
        background = 'rgba(255,255,255,0.2)'
    }
    dataset = {
        id: 'data-'+chart.data.datasets.length,
        label: legend,
        data: data,
        hoverBackgroundColor: background,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,1)',
        backgroundColor: colour
    }
    chart.data.datasets.push(dataset)
    chart.update()

}

function editRadarData(data, colour, legend){
    /** Edits the active radar chart's data */
    pieces = colour.split(', ')
    if (pieces.length>1) {
        colour = pieces[0]+','+pieces[1]+','+pieces[2]+','+pieces[3]
    }

    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].backgroundColor==colour) {
            chart.data.datasets[i].data=data
            chart.data.datasets[i].label=legend
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

function removeScatterData(IDNum){
    /** Removes data from the active radar chart */
    var datasets = []
    for (let i=0;i<chart.data.datasets.length;i++) {
        if (chart.data.datasets[i].id=='data-'+IDNum || chart.data.datasets[i].id=='trendline-'+IDNum) {
            chartColours[chart.data.datasets[i].backgroundColor] = false
        }
        else{
            datasets.push(chart.data.datasets[i])
        }
    }
    chart.data.datasets = datasets
    chart.update()
}

function addData(data, colour, chartType, legend, IDkey){
    /** Adds data to the active chart */
    if (chartType=='line'){
        addLineData(data, colour, legend, IDkey)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='polarArea'){
        addPolarData(data, colour, legend, IDkey)
    }
    else if (chartType=='bar'){
        addBarData(data, colour, legend, IDkey)
        if (document.getElementById('trendlineSelector')&& document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='scatter'){
        addScatterData(data, colour, legend, IDkey)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='radar'){
        addRadarData(data, colour, legend, IDkey)
    }
}

function editData(data, colour, chartType, legend, IDkey){
    /** Edits the active chart's data */
    if (chartType=='line'){
        editLineData(data, IDkey, legend)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='polarArea'){
        editPolarData(data, IDkey, legend)
    }
    else if (chartType=='bar'){
        editBarData(data, IDkey, legend)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='scatter'){
        editScatterData(data, IDkey, legend)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='radar'){
        editRadarData(data, colour, legend, IDkey)
    }
}

function removeData(IDkey, chartType){
    /** Removes data from the active chart */
    if (chartType=='line'){
        removeLineData(IDkey)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='polarArea'){
        removePolarData(IDkey)
    }
    else if (chartType=='bar'){
        removeBarData(IDkey)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='scatter'){
        removeScatterData(IDkey)
        if (document.getElementById('trendlineSelector') && document.getElementById('analysisSelector').value!='3'){
            updateTrendline()
        }
    }
    else if (chartType=='radar'){
        removeRadarData(IDkey)
    }
}

function clearChartColours(){
    /** Clears the chartColours object */
    for (let key in chartColours) {
        chartColours[key] = false
    }
}

function clearButtonColours(){
    var allRemoveButtons = document.querySelectorAll('[id^=btnRemove-]')    
    for (let i=0;i<allRemoveButtons.length;i++) {
        allRemoveButtons[i].style.backgroundColor = 'white'
    }

    var allRemoveDataButtons = document.querySelectorAll('[id^=btnRemoveSpecies-]')
    for (let i=0;i<allRemoveDataButtons.length;i++) {
        allRemoveDataButtons[i].style.backgroundColor = 'white'
    }
}
