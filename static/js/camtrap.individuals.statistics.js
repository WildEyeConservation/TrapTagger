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

var mapStats = null
var timeLabels = []
var polarData = {}
var barData = {}
var lineData = {}
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
}

var lineColours = {
    'rgba(89,228,170,0.4)': false,
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

function createIndivMap() {
    /** Initialises the individual heat map. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            info = JSON.parse(this.responseText);

            trapgroupInfo = info.trapgroups
            
            statisticsDiv = document.getElementById('statisticsDiv')
            mainDiv = document.createElement('indivMapDiv')
            statisticsDiv.appendChild(mainDiv)

            div = document.createElement('div')
            div.classList.add('row')
            mainDiv.appendChild(div)

            col1 = document.createElement('div')
            col1.classList.add('col-lg-10')
            div.appendChild(col1)

            mapDivIndiv = document.createElement('div')
            mapDivIndiv.setAttribute('id','mapIndivDiv')
            mapDivIndiv.setAttribute('style','height: 750px')
            col1.appendChild(mapDivIndiv)

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

            mapStats = new L.map('mapIndivDiv', {
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

            L.control.layers(baseMaps).addTo(mapStats);
            L.control.scale().addTo(mapStats);
            mapStats._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
            mapStats._controlCorners['bottomright'].style.marginBottom = "14px";

            mapStats.on('baselayerchange', function(e) {
                if (e.name.includes('Google')) {
                    mapStats._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
                    mapStats._controlCorners['bottomright'].style.marginBottom = "14px";
                }
            });

            markers = []
            refMarkers = []
            for (let i=0;i<trapgroupInfo.length;i++) {
                marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(mapStats)
                markers.push(marker)
                mapStats.addLayer(marker)
                
                marker.bindPopup(trapgroupInfo[i].tag);
                // marker.bindPopup(trapgroupSightings[i]);
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
            mapStats.fitBounds(group.getBounds().pad(0.1))
            if(markers.length == 1) {
                mapStats.setZoom(10)
            }

            h5 = document.createElement('h5')
            h5.innerHTML = 'Date'
            h5.setAttribute('style','margin-bottom: 2px')
            selectorDiv.appendChild(h5)

            h5 = document.createElement('div')
            h5.innerHTML = "<i>Select the date range for which you would like to view the individual's sightings.</i>"
            h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            selectorDiv.appendChild(h5)

            dateRange = document.createElement('div')
            selectorDiv.appendChild(dateRange)

            startDateLabel = document.createElement('label');
            startDateLabel.textContent = 'Start date:';
            startDateLabel.setAttribute('for', 'startDateSpatial');
            dateRange.appendChild(startDateLabel)

            dateRange.appendChild(document.createElement('br'));

            startDateInput = document.createElement('input');
            startDateInput.setAttribute('type', 'date');
            startDateInput.setAttribute('id', 'startDateSpatial');
            dateRange.appendChild(startDateInput)

            dateRange.appendChild(document.createElement('br'));

            endDateLabel = document.createElement('label');
            endDateLabel.textContent = 'End date:';
            endDateLabel.setAttribute('for', 'endDateSpatial');
            dateRange.appendChild(endDateLabel)

            dateRange.appendChild(document.createElement('br'));

            endDateInput = document.createElement('input');
            endDateInput.setAttribute('type', 'date');
            endDateInput.setAttribute('id', 'endDateSpatial');
            dateRange.appendChild(endDateInput)

            dateError = document.createElement('div')
            dateError.setAttribute('id', 'dateErrorSpat')
            dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
            dateError.innerHTML = ''
            dateRange.appendChild(dateError)

            if(minDate && maxDate) {
                startDateInput.setAttribute('min', minDate)
                startDateInput.setAttribute('max', maxDate)
                endDateInput.setAttribute('min', minDate)
                endDateInput.setAttribute('max', maxDate)
            }
            
            $("#startDateSpatial").change( function() {
                /** Listener for the date selector on the individual mapStats modal. */
                valid = false 
                document.getElementById('dateErrorSpat').innerHTML = ''
                errorMessage = ''
                startDateSpat = document.getElementById('startDateSpatial').value
                endDateSpat = document.getElementById('endDateSpatial').value
                
                if(startDateSpat == '' && endDateSpat == '') 
                {
                    valid = true
                } else if (startDateSpat == '' || endDateSpat == '') {
                    valid = true
                } else{
            
                    if (startDateSpat > endDateSpat) {
                        valid = false
                        errorMessage = 'Start date must be before end date.'
                    }
                    else{
                        valid = true
                    }
                } 
                if(valid){
                    updateHeatMap()
                } 
                else{
                    document.getElementById('dateErrorSpat').innerHTML = errorMessage
                } 
                
            })

            $("#endDateSpatial").change( function() {
                /** Listener for the date selector on the individual mapStats modal. */
                valid = false 
                document.getElementById('dateErrorSpat').innerHTML = ''
                errorMessage = ''
                startDateSpat = document.getElementById('startDateSpatial').value
                endDateSpat = document.getElementById('endDateSpatial').value
                
                if(startDateSpat == '' && endDateSpat == '') 
                {
                    valid = true
                } else if (startDateSpat == '' || endDateSpat == '') {
                    valid = true
                } else{
            
                    if (startDateSpat > endDateSpat) {
                        valid = false
                        errorMessage = 'The start date must be before end date.'
                    }
                    else{
                        valid = true
                    }
                } 
                if(valid){
                    updateHeatMap()
                } 
                else{
                    document.getElementById('dateErrorSpat').innerHTML = errorMessage
                } 
                
            })

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

            fillSelect(select, ['Sightings', 'Clusters' ,'Images'], ['3','2','1'])
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
                
                if(document.getElementById('normalisationCheckBox').checked){
                    reScaleNormalisation(value)
                }
                else{
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
                        if (!mapStats.hasLayer(markers[i])) {
                            mapStats.addLayer(markers[i])
                        }
                    }
                } else {
                    for (let i=0;i<markers.length;i++) {
                        if (mapStats.hasLayer(markers[i])) {
                            mapStats.removeLayer(markers[i])
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
                    updateHeatMap()
                    mapStats.addLayer(heatmapLayer)
                } else {
                    mapStats.removeLayer(heatmapLayer)
                }
            });
            
            updateHeatMap()
        }
    }
    xhttp.open("GET", '/getCoordsIndividual/'+selectedIndividual);
    xhttp.send();

}

function updateHeatMap(){
    /** Updates the heatmap based on the date selector. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnit = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    document.getElementById('statisticsErrors').innerHTML = ''

    formData = new FormData()
    startDateSpat = document.getElementById('startDateSpatial').value
    endDateSpat = document.getElementById('endDateSpatial').value
    if(startDateSpat != '' ){
        startDateSpat = startDateSpat + ' 00:00:00'
    }

    if(endDateSpat != '' ){
        endDateSpat = endDateSpat + ' 23:59:59'
    }   

    formData.append('start_date',JSON.stringify(startDateSpat))
    formData.append('end_date',JSON.stringify(endDateSpat))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            hm_data = []
            hm_max = 0
            for(let i=0;i<reply.data.length;i++){
                if(reply.data[i].count > 0){
                    hm_data.push(reply.data[i])
                    if(reply.data[i].count > hm_max){
                        hm_max = reply.data[i].count
                    }
                } 
            }

            heatMapData = JSON.parse(JSON.stringify(hm_data))
            if (document.getElementById('normalisationCheckBox').checked) {
                if (document.getElementById('heatMapCheckBox').checked) {
                    mapStats.removeLayer(heatmapLayer)
                }
                mapStats.addLayer(invHeatmapLayer)
                maxVal = 0
                for (let i=0;i<hm_data.length;i++) {
                    value = invHeatmapLayer._heatmap.getValueAt(mapStats.latLngToLayerPoint(L.latLng({lat:hm_data[i].lat, lng:hm_data[i].lng})))
                    if (value!=0) {
                        hm_data[i].count = (1000*hm_data[i].count)/value
                        if (hm_data[i].count>maxVal) {
                            maxVal = hm_data[i].count
                        }
                    }
                }
                hm_max = 1.25*maxVal
                mapStats.removeLayer(invHeatmapLayer)
                if (document.getElementById('heatMapCheckBox').checked) {
                    mapStats.addLayer(heatmapLayer)
                }
            }

            
            data ={
                'data' : hm_data,
                'max': hm_max,
            }
            heatmapLayer._data = []
            heatmapLayer.setData(data);
            heatmapLayer._update()
        }
    }
    xhttp.open("POST", '/getTrapgroupCountsIndividual/'+selectedIndividual+'/'+baseUnit);
    xhttp.send(formData);

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

    hmdata = JSON.parse(JSON.stringify(heatMapData))
    hmmax = 0

    mapStats.removeLayer(heatmapLayer)
    mapStats.addLayer(invHeatmapLayer)

    invHeatmapLayer.cfg.radius = newScale
    invHeatmapLayer._update()

    maxVal = 0
    for (let i=0;i< hmdata.length;i++) {
        value = invHeatmapLayer._heatmap.getValueAt(mapStats.latLngToLayerPoint(L.latLng({lat:hmdata[i].lat, lng:hmdata[i].lng})))
        if (value!=0) {
            hmdata[i].count = (1000*hmdata[i].count)/value
            if (hmdata[i].count>maxVal) {
                maxVal = hmdata[i].count
            }
        }
    }
    hmmax = 1.25*maxVal
    mapStats.removeLayer(invHeatmapLayer)
    mapStats.addLayer(heatmapLayer)

    data ={
        'data' : hmdata,
        'max': hmmax,
    }

    heatmapLayer._data = []
    heatmapLayer.setData(data);
    heatmapLayer.cfg.radius = newScale
    heatmapLayer._update()
}

function createIndivPolarChart() {
    /** Initialises a temporal analysis polar chart. */

    polarData = {}
                    
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
    canvasDiv.setAttribute('style','height: 750px')
    secCol2.appendChild(canvasDiv)

    canvas = document.createElement('canvas')
    canvas.setAttribute('id','statisticsChart')
    canvas.setAttribute('height','750')
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
    h5.innerHTML = '<i>Normalise the counts using the total count for each item.</i>'
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

    fillSelect(select, ['Sightings', 'Clusters' ,'Images'], ['3','2','1'])
    $("#baseUnitSelector").change( function() {
        updateBaseUnitPolar()
    });

    selectorDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Date'
    h5.setAttribute('style','margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = "<i>Select the date range for which you would like to view the individual's sightings.</i>"
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    dateRange = document.createElement('div')
    selectorDiv.appendChild(dateRange)

    startDateLabel = document.createElement('label');
    startDateLabel.textContent = 'Start date:';
    startDateLabel.setAttribute('for', 'startDateTemp');
    dateRange.appendChild(startDateLabel)

    dateRange.appendChild(document.createElement('br'));

    startDateInput = document.createElement('input');
    startDateInput.setAttribute('type', 'date');
    startDateInput.setAttribute('id', 'startDateTemp');
    dateRange.appendChild(startDateInput)

    dateRange.appendChild(document.createElement('br'));

    endDateLabel = document.createElement('label');
    endDateLabel.textContent = 'End date:';
    endDateLabel.setAttribute('for', 'endDateTemp');
    dateRange.appendChild(endDateLabel)

    dateRange.appendChild(document.createElement('br'));

    endDateInput = document.createElement('input');
    endDateInput.setAttribute('type', 'date');
    endDateInput.setAttribute('id', 'endDateTemp');
    dateRange.appendChild(endDateInput)

    dateError = document.createElement('div')
    dateError.setAttribute('id', 'dateErrorTemp')
    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
    dateError.innerHTML = ''
    dateRange.appendChild(dateError)

    startDateInput.setAttribute('min', minDate)
    startDateInput.setAttribute('max', maxDate)
    endDateInput.setAttribute('min', minDate)
    endDateInput.setAttribute('max', maxDate)
    
    $("#startDateTemp").change( function() {
        /** Listener for the date selector on the individual mapStats modal. */
        updateDatePolar()
    })

    $("#endDateTemp").change( function() {
        /** Listener for the date selector on the individual mapStats modal. */
        updateDatePolar()
    })

    selectorDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.innerHTML = 'Site'
    h5.setAttribute('style','margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select which site you would like to see.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    selectorColumn = document.createElement('div')
    selectorColumn.setAttribute('id','selectorColumn')
    selectorDiv.appendChild(selectorColumn)

    buildSiteSelectorRow()

    button1 = document.createElement('button')
    button1.classList.add('btn')
    button1.classList.add('btn-info')
    button1.setAttribute('type','button')
    button1.setAttribute('id','btnAddPolar')
    button1.innerHTML = '+'
    selectorDiv.appendChild(button1)

    button1.addEventListener('click', ()=>{
        if (document.querySelectorAll('[id^=trapgroupSelect]').length < Object.keys(polarColours).length) {
            buildSiteSelectorRow()
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

function buildSiteSelectorRow() {
    /** Builds a new site selector row for the temporal analysis polar chart. */
    sites = []
    sites_id = []
    for (let i=0;i<allSites.length;i++) {
        sites.push(allSites[i].tag)
        sites_id.push(allSites[i].id)
    }

    trapgroupNames = ['None', 'All', ...sites]
    trapgroupValues = ['-1', '0', ...sites]

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

    // trapgroup
    trapgroupSelect = document.createElement('select')
    trapgroupSelect.classList.add('form-control')
    trapgroupSelect.setAttribute('id','trapgroupSelect-'+IDNum)
    colrow2.appendChild(trapgroupSelect)
    fillSelect(trapgroupSelect,trapgroupNames,trapgroupValues)

    $("#"+trapgroupSelect.id).change( function(wrapIDNum) {
        return function() {
            var selection = document.getElementById('statsSelect').value
            if (selection == '1') {
                updatePolarData(wrapIDNum)
            }
            else if (selection == '4') {
                updateLineData(wrapIDNum)
            }
            
        }
    }(IDNum));


    //delete
    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';
    colrow1.appendChild(btnRemove)

    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            var selection = document.getElementById('statsSelect').value
            if (selection == '1') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                colour = btnRemove.style.backgroundColor
                removePolarData(colour)
                btnRemove.parentNode.parentNode.parentNode.remove();
                if (polarData.hasOwnProperty(wrapIDNum.toString())) {
                    delete polarData[wrapIDNum.toString()]
                }
            }
            else if (selection == '4') {
                btnRemove = document.getElementById('btnRemove-'+wrapIDNum)
                colour = btnRemove.style.backgroundColor
                removeLineData(colour)
                btnRemove.parentNode.parentNode.parentNode.remove();
                if (lineData.hasOwnProperty(wrapIDNum.toString())) {
                    delete lineData[wrapIDNum.toString()]
                }
            }
        }
    }(IDNum));

}

function updatePolarData(IDNum) {
    /** Requests the dataset associated with the specified ID number, for the active polar chart. */

    trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value
    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value

    if (trapgroup!='-1') {
        var formData = new FormData();
        if(trapgroup=='0') {
            trapgroup_tags = []
            for (let i=0;i<allSites.length;i++) {
                trapgroup_tags.push(allSites[i].tag) 
            }
            formData.append('trapgroup_tags', JSON.stringify(trapgroup_tags));
        }
        else {
            formData.append('trapgroup_tags', JSON.stringify([trapgroup]));
        }

        startDateTemp = document.getElementById('startDateTemp').value
        endDateTemp = document.getElementById('endDateTemp').value
        if(startDateTemp != '' ){
            startDateTemp = startDateTemp + ' 00:00:00'
        }    
    
        if(endDateTemp != '' ){
            endDateTemp = endDateTemp + ' 23:59:59'
        }   

    
        formData.append('start_date',JSON.stringify(startDateTemp))
        formData.append('end_date',JSON.stringify(endDateTemp))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    IDkey = wrapIDNum.toString()
                    reply = response.data
                    // console.log(reply)
                    if (!polarData.hasOwnProperty(IDkey)) {
                        colour = null
                        for (let key in polarColours) {
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
                    for (let i=0;i<reply.length;i++) {
                        total += reply[i]
                    }
                    polarData[IDkey]['total'] = total
    
                    updatePolarDisplay(wrapIDNum)
                    
                }
            }
        }(IDNum);
        xhttp.open("POST", 'getPolarDataIndividual/'+selectedIndividual+'/'+baseUnitSelection);
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

function normalisePolar() {
    /** Normalises the polar chart data. */
    for (let IDNum in polarData) {
        updatePolarDisplay(IDNum)
    }
}

function updatePolarDisplay(IDNum) {
    /**
     * Updates the dispay of a dataset on the active polar chart.
     * @param {int} IDNum The ID number of the item to be updated
     */

    IDkey = IDNum.toString()
    normalisationSelector = document.getElementById('normalisationSelector')
    normalisationSelection = normalisationSelector.options[normalisationSelector.selectedIndex].value
    // normalisationSelection = '1'
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

    if (polarData[IDkey]['new']) {
        addPolarData(newData,colour)
        polarData[IDkey]['new'] = false
    } else {
        editPolarData(newData,colour)
    }
}

function updateBaseUnitPolar() {
    /** Updates the base unit of the active polar chart */

    document.getElementById('statisticsErrors').innerHTML = ''
    species_count_warning = false
    for (let IDNum in polarData) {
        updatePolarData(IDNum)
    }
}

function updateDatePolar() {
    /** Updates the date range of the active polar chart */

    valid = false
    document.getElementById('dateErrorTemp').innerHTML = ''
    errorMessage = ''

    startDateTemp = document.getElementById('startDateTemp').value
    endDateTemp = document.getElementById('endDateTemp').value

    if(startDateTemp == '' && endDateTemp == '') 
    {
        valid = true
    } else if (startDateTemp == '' || endDateTemp == '') {
        valid = true
    } else{

        if (startDateTemp > endDateTemp) {
            valid = false
            errorMessage = 'The start date must be before the end date.'
        }
        else{
            valid = true
        }
    }   

    if (valid) {
        for (let IDNum in polarData) {
            updatePolarData(IDNum)
        }
    }
    else {
        document.getElementById('dateErrorTemp').innerHTML = errorMessage
    }
}


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
    polarColours[colour] = false
    chart.update()
}

function clearPolarColours() {
    /** Clears the polarColours object */
    for (let key in polarColours) {
        polarColours[key] = false
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
    barColours[colour] = false
    chart.update()
}

function clearBarColours() {
    /** Clears the barColours object */
    for (let key in barColours) {
        barColours[key] = false
    }
}

function updateBarDisplay() {
    /**
     * Updates the dispay of a dataset on the active bar chart.
     * @param {int} IDNum The ID number of the item to be updated
     */

    removeBarData(barData['colour'])
    
    data = barData['data']
    colour = barData['colour']
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value

    newData = data

    addBarData(newData,colour)
}


function addBarData(data,colour,IDNum) {
    /**
     * Adds the stipulated data to an active bar chart.
     * @param {arr} data The data points
     * @param {str} colour The colour with which to display the data
     */
    
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value
    if (xAxisSelection=='1') {
        dataset = {
            id: 'data-'+IDNum,
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
            id: 'data-'+IDNum,
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

function updateBarData() {
    /** Requests the dataset for the active bar chart. */

    baseUnitSelector = document.getElementById('baseUnitSelector')
    baseUnitSelection = baseUnitSelector.options[baseUnitSelector.selectedIndex].value
    // siteSelector = document.getElementById('barSiteSelector')
    // siteSelection = siteSelector.options[siteSelector.selectedIndex].value
    xAxisSelector = document.getElementById('xAxisSelector')
    xAxisSelection = xAxisSelector.options[xAxisSelector.selectedIndex].value



    var formData = new FormData();
    startDateNum = document.getElementById('startDateNum').value
    endDateNum = document.getElementById('endDateNum').value
    if(startDateNum != '' ){
        startDateNum = startDateNum.replace(/-/g, '/') + ' 00:00:00'
    }
    else{
        startDateNum = individualFirstSeen.split(' ')[0] +' 00:00:00'
    }

    if(endDateNum != '' ){
        endDateNum = endDateNum.replace(/-/g, '/') + ' 23:59:59'
    }   
    else{
        endDateNum = individualLastSeen.split(' ')[0] +' 23:59:59'
    }

    formData.append('startDate',JSON.stringify(startDateNum))
    formData.append('endDate',JSON.stringify(endDateNum))
    formData.append('individual_id',JSON.stringify(selectedIndividual))
    formData.append('baseUnit',JSON.stringify(baseUnitSelection))
    formData.append('axis',JSON.stringify(xAxisSelection))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)

            chart.data.labels = reply.labels


            colour = null
            for (let key in barColours) {
                if (barColours[key]==false) {
                    barColours[key] = true
                    colour = key
                    break
                }
            }
            if (colour != null) {
                btnColour = colour
                barData = {}
                barData['colour'] = colour
                barData['new'] = true
            }
            
            barData['data'] = reply.data

            total = 0
            for (let i=0;i<reply.data.length;i++) {
                total += reply.data[i]
            }
            barData['total'] = total

            updateBarDisplay()
        }
        
    }
    xhttp.open("POST", 'getBarDataIndividual');
    xhttp.send(formData);
    
}

function createIndivBar() {
    /** Initialises a numerical-analysis bar chart. */

    barData = {}
              
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
    h5.innerHTML = 'Date'
    h5.setAttribute('style','margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = "<i>Select the date range for which you would like to view the individual's sightings.</i>"
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    dateRange = document.createElement('div')
    selectorDiv.appendChild(dateRange)

    startDateLabel = document.createElement('label');
    startDateLabel.textContent = 'Start date:';
    startDateLabel.setAttribute('for', 'startDateNum');
    dateRange.appendChild(startDateLabel)

    dateRange.appendChild(document.createElement('br'));

    startDateInput = document.createElement('input');
    startDateInput.setAttribute('type', 'date');
    startDateInput.setAttribute('id', 'startDateNum');
    dateRange.appendChild(startDateInput)

    dateRange.appendChild(document.createElement('br'));

    endDateLabel = document.createElement('label');
    endDateLabel.textContent = 'End date:';
    endDateLabel.setAttribute('for', 'endDateNum');
    dateRange.appendChild(endDateLabel)

    dateRange.appendChild(document.createElement('br'));

    endDateInput = document.createElement('input');
    endDateInput.setAttribute('type', 'date');
    endDateInput.setAttribute('id', 'endDateNum');
    dateRange.appendChild(endDateInput)

    dateError = document.createElement('div')
    dateError.setAttribute('id', 'dateErrorNum')
    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
    dateError.innerHTML = ''
    dateRange.appendChild(dateError)

    startDateInput.setAttribute('min', minDate)
    startDateInput.setAttribute('max', maxDate)
    endDateInput.setAttribute('min', minDate)
    endDateInput.setAttribute('max', maxDate)
    
    $("#startDateNum").change( function() {
        /** Listener for the date selector */
        valid = false
        document.getElementById('dateErrorNum').innerHTML = ''
        errorMessage = ''

        if(startDateInput.value == '' && endDateInput.value == ''){
            valid = true
        }
        else if(startDateInput.value == '' || endDateInput.value == ''){
            valid = true
        }
        else{
            if(startDateInput.value > endDateInput.value){
                valid = false
                errorMessage = 'The start date must be before the end date.'
            }
            else{
                valid = true
            }
        }    

        if (valid) {
            updateBarData()
        }
        else{
            document.getElementById('dateErrorNum').innerHTML = errorMessage
        }

    })

    $("#endDateNum").change( function() {
        /** Listener for the date selector*/
        valid = false
        document.getElementById('dateErrorNum').innerHTML = ''
        errorMessage = ''

        if(startDateInput.value == '' && endDateInput.value == ''){
            valid = true
        }
        else if(startDateInput.value == '' || endDateInput.value == ''){
            valid = true
        }
        else{
            if(startDateInput.value > endDateInput.value){
                valid = false
                errorMessage = 'The start date must be before the end date.'
            }
            else{
                valid = true
            }
        }    

        if (valid) {
            updateBarData()
        }
        else{
            document.getElementById('dateErrorNum').innerHTML = errorMessage
        }
    })

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

    fillSelect(select, ['Sightings', 'Clusters' ,'Images'], ['3','2','1'])
    $("#baseUnitSelector").change( function() {
        updateBarData()
    });


    selectorDiv.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
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
    select.value = '2'

    $("#xAxisSelector").change( function() {
        updateBarData()
    });

    selectorDiv.appendChild(document.createElement('br'))

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
        type: 'bar',
        options: options
    });   
    
    updateBarData()

}

function createIndivLine() {
    /** Initialises a numerical-analysis bar chart. */

    lineData = {}
              
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
    h5.innerHTML = 'Date'
    h5.setAttribute('style','margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = "<i>Select the date range for which you would like to view the individual's sightings.</i>"
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    dateRange = document.createElement('div')
    selectorDiv.appendChild(dateRange)

    startDateLabel = document.createElement('label');
    startDateLabel.textContent = 'Start date:';
    startDateLabel.setAttribute('for', 'startDateTime');
    dateRange.appendChild(startDateLabel)

    dateRange.appendChild(document.createElement('br'));

    startDateInput = document.createElement('input');
    startDateInput.setAttribute('type', 'date');
    startDateInput.setAttribute('id', 'startDateTime');
    dateRange.appendChild(startDateInput)

    dateRange.appendChild(document.createElement('br'));

    endDateLabel = document.createElement('label');
    endDateLabel.textContent = 'End date:';
    endDateLabel.setAttribute('for', 'endDateTime');
    dateRange.appendChild(endDateLabel)

    dateRange.appendChild(document.createElement('br'));

    endDateInput = document.createElement('input');
    endDateInput.setAttribute('type', 'date');
    endDateInput.setAttribute('id', 'endDateTime');
    dateRange.appendChild(endDateInput)

    dateError = document.createElement('div')
    dateError.setAttribute('id', 'dateErrorTime')
    dateError.setAttribute('style', 'color: #DF691A; font-size: 80%')
    dateError.innerHTML = ''
    dateRange.appendChild(dateError)

    startDateInput.setAttribute('min', minDate)
    startDateInput.setAttribute('max', maxDate)
    endDateInput.setAttribute('min', minDate)
    endDateInput.setAttribute('max', maxDate)
    
    $("#startDateTime").change( function() {
        /** Listener for the date selector */
        valid = false
        document.getElementById('dateErrorTime').innerHTML = ''
        errorMessage = ''

        if(startDateInput.value == '' && endDateInput.value == ''){
            valid = true
        }
        else if(startDateInput.value == '' || endDateInput.value == ''){
            valid = true
        }
        else{
            if(startDateInput.value > endDateInput.value){
                valid = false
                errorMessage = 'The start date must be before the end date.'
            }
            else{
                valid = true
            }
        }    

        if (valid) {
            updateLine()
        }
        else{
            document.getElementById('dateErrorTime').innerHTML = errorMessage
        }

    })

    $("#endDateTime").change( function() {
        /** Listener for the date selector*/
        valid = false
        document.getElementById('dateErrorTime').innerHTML = ''
        errorMessage = ''

        if(startDateInput.value == '' && endDateInput.value == ''){
            valid = true
        }
        else if(startDateInput.value == '' || endDateInput.value == ''){
            valid = true
        }
        else{
            if(startDateInput.value > endDateInput.value){
                valid = false
                errorMessage = 'The start date must be before the end date.'
            }
            else{
                valid = true
            }
        }    

        if (valid) {
            updateLine()
        }
        else{
            document.getElementById('dateErrorNum').innerHTML = errorMessage
        }
    })

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

    fillSelect(select, ['Sightings', 'Clusters' ,'Images'], ['3','2','1'])
    $("#baseUnitSelector").change( function() {
        updateLine()
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

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','timeUnitSelector')
    selectorDiv.appendChild(select)

    fillSelect(select, ['Day', 'Month', 'Year'], ['1','2','3'])
    $("#timeUnitSelector").change( function() {
        updateLine()
    });
    select.value = '2'

    selectorDiv.appendChild(document.createElement('br'))
    
    h5 = document.createElement('h5')
    h5.innerHTML = 'Site'
    h5.setAttribute('style','margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select which site you would like to see.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    selectorColumn = document.createElement('div')
    selectorColumn.setAttribute('id','selectorColumn')
    selectorDiv.appendChild(selectorColumn)

    buildSiteSelectorRow()

    button1 = document.createElement('button')
    button1.classList.add('btn')
    button1.classList.add('btn-info')
    button1.setAttribute('type','button')
    button1.setAttribute('id','btnAddPolar')
    button1.innerHTML = '+'
    selectorDiv.appendChild(button1)

    button1.addEventListener('click', ()=>{
        if (document.querySelectorAll('[id^=trapgroupSelect]').length < Object.keys(polarColours).length) {
            buildSiteSelectorRow()
        }
    });

    selectorDiv.appendChild(document.createElement('br'))

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

    updateLineData()

}

function updateLineData(IDNum=0) {
    /** Updates the line chart with the current data. */
    var startDateTime = document.getElementById('startDateTime').value
    var endDateTime = document.getElementById('endDateTime').value
    var baseUnit = document.getElementById('baseUnitSelector').value
    var timeUnit = document.getElementById('timeUnitSelector').value
    var trapgroupSelector = document.getElementById('trapgroupSelect-'+IDNum);
    var trapgroup = trapgroupSelector.options[trapgroupSelector.selectedIndex].value

    var formData = new FormData();
    if(startDateTime != '' ){
        startDateTime = startDateTime + ' 00:00:00'
    }
    else{
        startDateTime = individualFirstSeen.replace(/\//g, '-').split(' ')[0] +' 00:00:00'
    }

    if(endDateTime != '' ){
        endDateTime = endDateTime + ' 23:59:59'
    }   
    else{
        endDateTime = individualLastSeen.replace(/\//g, '-').split(' ')[0] +' 23:59:59'
    }

    formData.append('startDate',JSON.stringify(startDateTime))
    formData.append('endDate',JSON.stringify(endDateTime))
    formData.append('individual_id',JSON.stringify(selectedIndividual))
    formData.append('baseUnit',JSON.stringify(baseUnit))
    formData.append('timeUnit',JSON.stringify(timeUnit))
    formData.append('trapgroup',JSON.stringify(trapgroup))

    if (trapgroup!='-1') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapIDNum){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    response = JSON.parse(this.responseText);
                    // console.log(response)

                    IDkey = wrapIDNum.toString()

                    timeLabels = response.labels
                    chart.data.labels = timeLabels

                    if (!lineData.hasOwnProperty(IDkey)) {
                        colour = null
                        for (let key in lineColours) {
                            if (lineColours[key]==false) {
                                lineColours[key] = true
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

                    updateLineDisplay(IDkey)
                    
                }
            }
        }(IDNum);
        xhttp.open("POST", 'getLineDataIndividual');
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
    /** Updates the line chart with the current data. */
    IDkey = IDNum.toString()
    data = lineData[IDkey]['data']
    colour = lineData[IDkey]['colour']

    if (lineData[IDkey]['new']) {
        addLineData(data,colour)
        lineData[IDkey]['new'] = false
    } else {
        editLineData(data,colour)
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
        borderColor: colour,
        borderWidth: 2,
        fill: false,
        tension : 0.2
    }
    chart.data.datasets.push(dataset)
    chart.update()
}

function editLineData(data,colour) {
    /** Edits the stipulated data in an active line chart.*/	
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

function updateLine(){
    /** Updates all the line data */
    timeLabels = []
    for (let IDNum in lineData) {
        updateLineData(IDNum)
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
    lineColours[colour] = false
    chart.update()

}

function clearLineColours(){
    /** Clears the lineColours object */
    for (let key in lineColours) {
        lineColours[key] = false
    }
}

function clearStatistics() {
    /** Clears the statistics modal. */
    statisticsDiv = document.getElementById('statisticsDiv')
    while(statisticsDiv.firstChild){
        statisticsDiv.removeChild(statisticsDiv.firstChild);
    }
    clearPolarColours()
    clearLineColours()
    clearBarColours()
    document.getElementById('statisticsErrors').innerHTML = ''
}

function exportIndivResults(){
    /** Exports the results of the individual statistics to a PNG file. */
    var statsSelect = document.getElementById('statsSelect')
    if (statsSelect.value != '2'){
        var canvas = document.getElementById('statisticsChart')
        var image = canvas.toDataURL("image/png", 1.0).replace("image/png", "image/octet-stream");
        var link = document.createElement('a');
        link.download = 'chart.png';
        link.href = image;
        link.click();
    }    
}






