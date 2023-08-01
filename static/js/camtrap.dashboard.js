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

var chart
var map
const btnNextUsers = document.querySelector('#btnNextUsers');
const btnPrevUsers = document.querySelector('#btnPrevUsers');
var next_url
var prev_url

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
    chart.options.scales.xAxes[0] = {
        type: 'time',
        position: 'bottom',
        time: {
            parser: 'YYYY/MM/DD',
            displayFormats: {'day': 'MM/YY'},
            tooltipFormat: 'YY/MM/DD',
            unit: 'month',
        }
    }

    updateChart()
}

function getUserInfo(url=null) {
    /** Fetches and populates the user info table. */

    userOrderSelect = document.getElementById('userOrderSelect')
    userOrderSelect.disabled=true
    order = userOrderSelect.options[userOrderSelect.selectedIndex].value

    activeUserSelect = document.getElementById('activeUserSelect')
    activeUserSelect.disabled=true
    users = activeUserSelect.options[activeUserSelect.selectedIndex].value

    if (url==null) {
        url = '/getActiveUserData?page=1&order=total&users=active_users'
    } else {
        url= url.split('&order=')[0]+'&users='+users+'&order='+order
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status=='success') {
                userInfoTableBody=document.getElementById('userInfoTableBody')
                while(userInfoTableBody.firstChild){
                    userInfoTableBody.removeChild(userInfoTableBody.firstChild);
                }
                
                for (let i=0;i<reply.data.length;i++) {
                    tr=document.createElement('tr')

                    th=document.createElement('th')
                    th.setAttribute('scope','row')
                    th.innerHTML = reply.data[i]['account']
                    tr.appendChild(th)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[i]['affiliation']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[i]['surveys']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[i]['images']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[i]['images_this_month']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[i]['images_last_month']
                    tr.appendChild(td)

                    td=document.createElement('td')
                    td.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
                    td.innerHTML = reply.data[i]['regions']
                    tr.appendChild(td)

                    userInfoTableBody.appendChild(tr)
                }

                if (reply.next_url==null) {
                    btnNextUsers.style.visibility = 'hidden'
                } else {
                    btnNextUsers.style.visibility = 'visible'
                    next_url = reply.next_url
                }
    
                if (reply.prev_url==null) {
                    btnPrevUsers.style.visibility = 'hidden'
                } else {
                    btnPrevUsers.style.visibility = 'visible'
                    prev_url = reply.prev_url
                }

                userOrderSelect = document.getElementById('userOrderSelect')
                userOrderSelect.disabled=false

                activeUserSelect = document.getElementById('activeUserSelect')
                activeUserSelect.disabled=false
            }
        }
    }
    xhttp.open("POST", url);
    xhttp.send();
}

function initMap() {
    /** Initalises the trap site map */

    gSat = L.gridLayer.googleMutant({type: 'satellite'})
    map = new L.map('mapDiv', {
        layers: [gSat]
    }).setView([0, 0], 3)

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status=='success') {
                var markers = L.markerClusterGroup();
                for (let i=0;i<reply.data.length;i++) {
                    markers.addLayer(L.marker(reply.data[i]));
                }
                map.addLayer(markers)
            }
        }
    }
    xhttp.open("POST", '/getAllSites');
    xhttp.send();
}

$("#trendSelect").change( function() {
    /** updates the trand chart when the trend selection changes */
    updateChart()
})

$("#periodSelect").change( function() {
    /** updates the trand chart when the period selection changes */
    updateChart()
})

$("#userOrderSelect").change( function() {
    /** updates the trand chart when the trend selection changes */
    getUserInfo()
})

$("#activeUserSelect").change( function() {
    /** updates the trand chart when the period selection changes */
    getUserInfo()
})

function initPage() {
    /** Initialises the page info */
    initChart()
    getUserInfo()
    initMap()
}

window.addEventListener('load', initPage, false);