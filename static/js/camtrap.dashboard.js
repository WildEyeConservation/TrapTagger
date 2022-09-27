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

var chart

function updateChart() {
    /** Updates the dashboard trend graph based on the selected parameters */
    trendSelect = document.getElementById('trendSelect')
    trendSelect.disabled=true
    trend = trendSelect.options[trendSelect.selectedIndex].value
    periodSelect = document.getElementById('periodSelect')
    periodSelect.disabled=true
    period = periodSelect.options[periodSelect.selectedIndex].value

    if (period=='year') {
        period=12
    }

    var formData = new FormData()
    formData.append("trend", trend)
    formData.append("period", period)

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status=='success') {
                chart.data = {
                    labels: reply.labels,
                    datasets: [{
                        backgroundColor: 'rgb(223,105,26)',
                        borderColor: 'rgb(20,25,30)',
                        data: reply.data,
                    }]
                }

                chart.config.options.scales.yAxes[0].scaleLabel.labelString=reply.axis_label
                
                chart.update()
                trendSelect.disabled=false
                periodSelect.disabled=false
            }
        }
    }
    xhttp.open("POST", '/getDashboardTrends');
    xhttp.send(formData);
}

function initChart() {
    /** Initialises the trand graph */
    
    config = {
        type: 'line',
        data: {},
        options: {
            legend: {
                display: false
            },
            elements: {
                line: {
                    tension: 0
                }
            }
        }
    }

    Chart.defaults.global.defaultFontColor = "#fff";
    Chart.defaults.global.defaultFontSize=16
    
    chart = new Chart(
        document.getElementById('trendChart'),
        config
    )

    chart.config.options.scales.yAxes[0].scaleLabel.display=true

    updateChart()
}

function getUserInfo() {
    /** Fetches and populates the user info table. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status=='success') {
                userInfoTableBody=document.getElementById('userInfoTableBody')
                for (uii=0;uii<reply.data.length;uii++) {
                    tr=document.createElement('tr')

                    th=document.createElement('th')
                    th.setAttribute('scope','row')
                    th.innerHTML = reply.data[uii]['account']
                    tr.appendChild(th)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[uii]['affiliation']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[uii]['surveys']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[uii]['images']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[uii]['regions']
                    tr.appendChild(td)

                    userInfoTableBody.appendChild(tr)
                }
            }
        }
    }
    xhttp.open("POST", '/getActiveUserData');
    xhttp.send();
}

function initMap() {
    /** Initalises the trap site map */
    // var map = L.map('mapDiv').setView([0, 0], 1);
    gSat = L.gridLayer.googleMutant({type: 'satellite'})
    map = new L.map('mapDiv', {
        layers: [gSat]
    });
    // osmSat = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    //     attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    //     maxZoom: 18,
    //     id: 'mapbox/satellite-v9',
    //     tileSize: 512,
    //     zoomOffset: -1,
    //     accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
    // }).addTo(map)
}

$("#trendSelect").change( function() {
    /** updates the trand chart when the trend selection changes */
    updateChart()
})

$("#periodSelect").change( function() {
    /** updates the trand chart when the period selection changes */
    updateChart()
})

function initPage() {
    /** Initialises the page info */
    initChart()
    getUserInfo()
    // initMap()
}

window.addEventListener('load', initPage, false);