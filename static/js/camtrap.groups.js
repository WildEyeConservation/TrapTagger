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


const modalSitesMap = $('#modalSitesMap')
const modalConfirmDelete = $('#modalConfirmDelete')
const modalViewGroups = $('#modalViewGroups')
const modalGroups = $('#modalGroups')

var mapSites = null
var sitesMarkers = []
var drawnItems = null
var markersInPoly = []
var allCheckboxes = []
var selectedGroup = null
var groupSites = []
var site_col_count = 0
var modalGroupsReturn = false
var modalGroupsViewReturn = false
var modalSitesMapReturn = false
var modalSiteActive = false


function searchSites() {
    /** Searches for the sited based on the search bar and allow user to select sites*/
    
    var search = document.getElementById('searchSites').value;
    var sitesDiv = document.getElementById('sitesDiv');
    var advancedSearch = document.getElementById('advancedSearch').checked;
    
    while(sitesDiv.firstChild) {
        sitesDiv.removeChild(sitesDiv.firstChild);
    }

    console.log(advancedSearch.toString());
    var formData = new FormData();
    formData.append('search', JSON.stringify(search));
    formData.append('advanced', JSON.stringify(advancedSearch.toString()));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply);

            var row = document.createElement('div')
            row.setAttribute('class','row')
            sitesDiv.appendChild(row)

            for ( let i = 0; i < 4; i++) {
                let col = document.createElement('div')
                col.setAttribute('class','col-lg-3')
                col.id = 'col-' + i
                row.appendChild(col)
            }

            var col0 = document.getElementById('col-0')

            checkDiv = document.createElement('div')
            checkDiv.setAttribute('class','custom-control custom-checkbox')
            checkDiv.setAttribute('style','display: inline-block; padding-right: 1.5rem')
            col0.appendChild(checkDiv)

            input = document.createElement('input')
            input.setAttribute('type','checkbox')
            input.classList.add('custom-control-input')
            input.setAttribute('id','AllSites-box')
            input.setAttribute('name','AllSites-box')
            input.setAttribute('value',0)
            checkDiv.appendChild(input)

            label = document.createElement('label')
            label.classList.add('custom-control-label')
            label.setAttribute('for','AllSites-box')
            label.innerHTML = 'Select All'
            checkDiv.appendChild(label)

            $('#AllSites-box').change( function() {
                /** Listens for changes in the select all check box and selects or unselects all boxes */
                for (let i = 0; i < allCheckboxes.length; i++) {
                    document.getElementById(allCheckboxes[i]).checked = this.checked
                    if (this.checked) {
                        addSiteToGroup(document.getElementById(allCheckboxes[i]))
                    }
                    else {
                        removeSiteFromGroup(document.getElementById(allCheckboxes[i]))
                    }
                }
            });

            allCheckboxes = []
            var col_count = 1
            var check = false
            for ( let i = 0; i < reply.sites.length; i++) {
                if (groupSites.includes(reply.ids[i].join(','))) {
                    check = true
                } else {
                    check = false
                }
                
                addSite(reply.sites[i].tag, reply.sites[i].latitude, reply.sites[i].longitude , reply.ids[i].join(','), 'col-'+col_count, check)
                col_count += 1
                if (col_count == 4) {
                    col_count = 0
                }
            }
        }
    }
    xhttp.open("POST", '/searchSites');
    xhttp.send(formData);

}

function addSite(site_tag, site_lat, site_lng, ids, col_id, check = false) {
    /** Adds the sites to the sitesDiv */
    var site_lat = parseFloat(site_lat).toFixed(4).toString()
    var site_lng = parseFloat(site_lng).toFixed(4).toString()
    var site_text = site_tag + ' (' + site_lat + ', ' + site_lng + ')'
    var site_ids = ids
    var tag = site_tag + '_' + site_lat + '_' + site_lng
    allCheckboxes.push(tag+'-box')

    var col = document.getElementById(col_id)

    checkDiv = document.createElement('div')
    checkDiv.setAttribute('class','custom-control custom-checkbox')
    checkDiv.setAttribute('style','display: inline-block;')
    col.appendChild(checkDiv)

    input = document.createElement('input')
    input.setAttribute('type','checkbox')
    input.classList.add('custom-control-input')
    input.setAttribute('id',tag+'-box')
    input.setAttribute('name',tag+'-box')
    input.setAttribute('value',site_ids)
    checkDiv.appendChild(input)

    label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for',tag+'-box')
    label.innerHTML = site_text
    checkDiv.appendChild(label)

    input.checked = check

    input.addEventListener('change', function() {
        if (this.checked) {
            addSiteToGroup(this)
        }
        else {
            removeSiteFromGroup(this)
            if (document.getElementById('AllSites-box').checked) {
                document.getElementById('AllSites-box').checked = false
            }
        }
    });
}

function addSiteToGroup(checkbox) {
    /** Adds the site to the group site div*/

    if (!groupSites.includes(checkbox.value)) {
        var checkBoxExists = false
        for (let j = 0; j < 4; j++) {
            var col = document.getElementById('groupSitesCol-' + j)
            var colDivs = col.childNodes
            for (let i = 0; i < colDivs.length; i++) {
                if (colDivs[i].childNodes[0].id == checkbox.id) {
                    colDivs[i].childNodes[0].checked = true
                    groupSites.push(checkbox.value)
                    checkBoxExists = true
                    break
                }
            }
    
        }

        if (!checkBoxExists) {

            if (site_col_count == 4) {
                site_col_count = 0
            }
                
            var col = document.getElementById('groupSitesCol-' + site_col_count)

            var groupSiteDiv = document.createElement('div')
            groupSiteDiv.setAttribute('class','custom-control custom-checkbox')
            groupSiteDiv.setAttribute('style','display: inline-block;')
            col.appendChild(groupSiteDiv)

            input = document.createElement('input')
            input.setAttribute('type','checkbox')
            input.classList.add('custom-control-input')
            input.setAttribute('id',checkbox.id)
            input.setAttribute('name',checkbox.id)
            input.setAttribute('value',checkbox.value)
            groupSiteDiv.appendChild(input)

            label = document.createElement('label')
            label.classList.add('custom-control-label')
            label.setAttribute('for',checkbox.id)
            label.innerHTML = checkbox.parentNode.childNodes[1].innerHTML
            groupSiteDiv.appendChild(label)

            input.checked = true

            groupSites.push(checkbox.value)
            site_col_count += 1
        }
    }
    
}

function removeSiteFromGroup(checkbox) {
    /** Removes the site from the group site div*/   
    for (let j = 0; j < 4; j++) {
        var col = document.getElementById('groupSitesCol-' + j)
        var colDivs = col.childNodes
        for (let i = 0; i < colDivs.length; i++) {
            if (colDivs[i].childNodes[0].id == checkbox.id) {
                // col.removeChild(colDivs[i])
                // site_col_count -= 1
                colDivs[i].childNodes[0].checked = false
                break
            }
        }
    }
    var index = groupSites.indexOf(checkbox.value)
    if (index > -1) {
        groupSites.splice(index, 1);
    }
}

function initialiseSitesMap() {
    /** Initialises the sites map */

    var tasks = getSelectedTasks()
    
    var formData = new FormData();
    formData.append('task_ids', JSON.stringify(tasks));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            info = JSON.parse(this.responseText);
            trapgroupInfo = info.trapgroups

            mainDiv = document.getElementById('mapSitesDiv')

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
            mapDiv.setAttribute('id','mapDivDraw')
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

            mapSites = new L.map('mapDivDraw', {
                layers: [gSat]
            });

            baseMaps = {
                "Google Satellite": gSat,
                // "Google Roadmap": gStr,
                // "Google Terrain": gTer,
                "Google Hybrid": gHyb,
                "OpenStreetMaps Satellite": osmSat,
                "OpenStreetMaps Roadmap": osmSt
            };

            L.control.layers(baseMaps).addTo(mapSites);
            L.control.scale().addTo(mapSites);
            mapSites._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
            mapSites._controlCorners['bottomright'].style.marginBottom = "14px";

            mapSites.on('baselayerchange', function(e) {
                if (e.name.includes('Google')) {
                    mapSites._controlCorners['bottomleft'].firstChild.style.marginBottom = "25px";
                    mapSites._controlCorners['bottomright'].style.marginBottom = "14px";
                }
            });

            siteMarkers = []
            for (let i=0;i<trapgroupInfo.length;i++) {
                marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(mapSites)
                siteMarkers.push(marker)
                mapSites.addLayer(marker)
                marker.bindPopup(trapgroupInfo[i].tag);
                marker.on('mouseover', function (e) {
                    this.openPopup();
                });
                marker.on('mouseout', function (e) {
                    this.closePopup();
                });
            }

            var group = new L.featureGroup(siteMarkers);
            mapSites.fitBounds(group.getBounds().pad(0.1))
            if(siteMarkers.length == 1) {
                mapSites.setZoom(10)
            }

            drawnItems = L.featureGroup().addTo(mapSites);
            var drawOptions = {
                position: 'topleft',
                draw: {
                    polyline: false,
                    polygon: {
                        allowIntersection: false,
                        shapeOptions: {
                            color: "rgba(223,105,26,1)"
                        }   
                    },
                    circle: false,
                    circlemarker: false,
                    rectangle: false,
                    marker: false,
                },
                edit: {
                    featureGroup: drawnItems,
                    poly: {
                        allowIntersection: false
                    }
                }
            };
            mapSites.addControl(new L.Control.Draw(drawOptions));
        
            mapSites.on(L.Draw.Event.CREATED, function (event) {
                var layer = event.layer;
                var polygon = layer
                drawnItems.addLayer(layer);
            });

        }
    }
    xhttp.open("POST", '/getCoords');
    xhttp.send(formData);

}

function saveSitesOnMap(){
    /** Saves the marekers that are covered by poly on the map */
    var polygons = [];

    mapSites.eachLayer(function(layer) {
    if (layer instanceof L.Polygon) {
        polygons.push(layer);
    }
    });

    for (let i=0;i<siteMarkers.length;i++) {
        var marker = siteMarkers[i];
        var markerLatLng = marker.getLatLng();

        polygons.forEach(function(polygon) {
            pg = L.geoJSON(polygon.toGeoJSON())
            if (leafletPip.pointInLayer([markerLatLng.lng, markerLatLng.lat], pg ).length > 0) {
                markersInPoly.push(marker);
                return;
            } 
        });
        
    }

    allCheckboxes = []
    console.log(markersInPoly)
    for (let i=0;i<markersInPoly.length;i++) {
        var site_tag = markersInPoly[i].getPopup().getContent();
        var site_lat = parseFloat(markersInPoly[i].getLatLng().lat).toFixed(4).toString();
        var site_lng = parseFloat(markersInPoly[i].getLatLng().lng).toFixed(4).toString();
        var site_text = site_tag + ' (' + site_lat + ', ' + site_lng + ')'
        var site_ids = globalSitesIDs[globalSites.indexOf(site_text)]
        var tag = site_tag + '_' + site_lat + '_' + site_lng

        if (!groupSites.includes(site_ids)) {
            allCheckboxes.push(tag+'-box')

            var checkBoxExists = false
            for (let j = 0; j < 4; j++) {
                var col = document.getElementById('groupSitesCol-' + j)
                var colDivs = col.childNodes
                for (let i = 0; i < colDivs.length; i++) {
                    if (colDivs[i].childNodes[0].value == site_ids) {
                        colDivs[i].childNodes[0].checked = true
                        groupSites.push(site_ids)
                        checkBoxExists = true
                        break
                    }
                }
        
            }

            if (!checkBoxExists) {

                if (site_col_count == 4) {
                    site_col_count = 0
                }

                var col = document.getElementById('groupSitesCol-'+site_col_count)
            
                checkDiv = document.createElement('div')
                checkDiv.setAttribute('class','custom-control custom-checkbox')
                checkDiv.setAttribute('style','display: inline-block;')
                col.appendChild(checkDiv)
            
                input = document.createElement('input')
                input.setAttribute('type','checkbox')
                input.classList.add('custom-control-input')
                input.setAttribute('id',tag+'-box')
                input.setAttribute('name',tag+'-box')
                input.setAttribute('value',site_ids)
                checkDiv.appendChild(input)
            
                label = document.createElement('label')
                label.classList.add('custom-control-label')
                label.setAttribute('for',tag+'-box')
                label.innerHTML = site_text
                checkDiv.appendChild(label)
            
                input.checked = true
                
                groupSites.push(site_ids)
                site_col_count += 1

                input.addEventListener('change', function() {
                    if (!this.checked) {
                        // this.parentNode.remove()
                        var index = groupSites.indexOf(this.value)
                        if (index > -1) {
                            groupSites.splice(index, 1);
                        }
                    }
                });
            }
        }
    }

    modalSitesMap.modal('hide');
}

function checkValidGroup() {
    /** Checks if the created group are valid*/
    var emptyName = false
    var noSites = false
    var descriptionLong = false
    var groupName = document.getElementById('groupName').value
    var groupDescription = document.getElementById('groupDescription').value
    var error = ''
    var groupError = document.getElementById('groupErrors')

    if (groupName == '') {
        emptyName = true
        error += 'Please enter a group name. '
    }

    if (groupDescription.length > 500) {
        descriptionLong = true
        error += 'Description must be less than 500 characters. '
    }

    if (groupSites.length == 0) {
        noSites = true
        error += 'Please add at least one site. '
    }

    if (emptyName||noSites||descriptionLong) {
        groupError.innerHTML = error
        return false
    }
    else{
        groupError.innerHTML = ''
        return true
    }
    
}   

function saveGroup() {
    /** Saves the group to the database */
    var groupName = document.getElementById('groupName').value
    var groupDescription = document.getElementById('groupDescription').value
    var sites_ids = []

    for (let i = 0; i < groupSites.length; i++) {
        var split = groupSites[i].split(',')
        sites_ids.push(...split)
    }

    var formData = new FormData();
    formData.append('name', JSON.stringify(groupName));
    formData.append('description', JSON.stringify(groupDescription));
    formData.append('sites_ids', JSON.stringify(sites_ids));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status == 'success') {
                modalGroups.modal('hide');
                getLabelsSitesTagsAndGroups(true)
            }
            else{
                document.getElementById('groupErrors').innerHTML = reply.message
            }
        }
    }
    xhttp.open("POST", '/saveGroup');
    xhttp.send(formData);
}

function getGroups() {
    /** Gets the groups from the database */
    var groupsDiv = document.getElementById('groupsDiv')
    while (groupsDiv.firstChild) {
        groupsDiv.removeChild(groupsDiv.firstChild);
    }
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            groups = reply.groups
            console.log(groups)

            for (let i=0; i<groups.length; i++) {
                buildGroup(groups[i])
            }
        }
    }
    xhttp.open("GET", '/getGroups');
    xhttp.send();
}

function buildGroup(group) {
    /** Builds the group on the page */
    var groupsDiv = document.getElementById('groupsDiv')

    var groupDiv = document.createElement('div')
    groupDiv.id = 'groupDiv-' + group.id
    groupDiv.setAttribute("style", "border-bottom: 1px solid rgb(60,74,89); padding: 1.25rem; margin-bottom: -1px;")
    groupsDiv.appendChild(groupDiv)

    var row = document.createElement('div')
    row.setAttribute('class','row')
    groupDiv.appendChild(row)

    var col0 = document.createElement('div')
    col0.setAttribute('class','col-lg-3')
    row.appendChild(col0)

    var col1 = document.createElement('div')
    col1.setAttribute('class','col-lg-7')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.setAttribute('class','col-lg-1')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.setAttribute('class','col-lg-1')
    row.appendChild(col3)

    var groupName = document.createElement('h5')
    groupName.innerHTML = group.name
    groupName.setAttribute('style','margin-bottom: 2px')
    col0.appendChild(groupName)

    var groupDescription = document.createElement('div')
    groupDescription.innerHTML = '<i>' + group.description + '</i>'
    groupDescription.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    col0.appendChild(groupDescription)

    var sites = ''
    for (let i=0; i<group.sites.length; i++) {
        sites += group.sites[i].tag + ' (' + parseFloat(group.sites[i].latitude).toFixed(4).toString() + ', ' + parseFloat(group.sites[i].longitude).toFixed(4).toString() + '), ' 
    }
    sites = sites.slice(0, -2)

    var groupSitesDiv = document.createElement('div')
    groupSitesDiv.innerHTML = sites
    col1.appendChild(groupSitesDiv)

    var groupEdit = document.createElement('button')
    groupEdit.id = 'btnGroupEdit-' + group.id
    groupEdit.setAttribute("class","btn btn-primary btn-block btn-sm")
    groupEdit.innerHTML = 'Edit'
    col2.appendChild(groupEdit)

    groupEdit.addEventListener('click', function(wrapGroup) {
        return function() {
            selectedGroup = wrapGroup.id
            

            document.getElementById('groupHeader').innerHTML = 'Edit Group: ' + wrapGroup.name
            document.getElementById('groupName').value = wrapGroup.name
            document.getElementById('groupDescription').value = wrapGroup.description

            var groupSitesDiv = document.getElementById('groupSitesDiv')

            var row = document.createElement('div')
            row.setAttribute('class','row')
            groupSitesDiv.appendChild(row)
            site_col_count = 0
            for (let i = 0; i < 4 ; i++) {
                var col = document.createElement('div')
                col.setAttribute('class','col-3')
                col.setAttribute('id','groupSitesCol-'+i)
                row.appendChild(col)
            }

            allCheckboxes = []
            groupSites = []

            for (let i=0;i<wrapGroup.sites.length;i++) {
                var site = wrapGroup.sites[i]
                var site_tag = site.tag
                var site_lat = parseFloat(site.latitude).toFixed(4).toString()
                var site_lng = parseFloat(site.longitude).toFixed(4).toString()
                var site_text = site_tag + ' (' + site_lat + ', ' + site_lng + ')'
                var site_ids = site.ids
                var tag = site_tag + '_' + site_lat + '_' + site_lng

                if (!groupSites.includes(site_ids)) {
        
                    if (site_col_count == 4) {
                        site_col_count = 0
                    }
    
                    var col = document.getElementById('groupSitesCol-'+site_col_count)

                    allCheckboxes.push(tag+'-box')
                    checkDiv = document.createElement('div')
                    checkDiv.setAttribute('class','custom-control custom-checkbox')
                    checkDiv.setAttribute('style','display: inline-block')
                    col.appendChild(checkDiv)
                
                    input = document.createElement('input')
                    input.setAttribute('type','checkbox')
                    input.classList.add('custom-control-input')
                    input.setAttribute('id',tag+'-box')
                    input.setAttribute('name',tag+'-box')
                    input.setAttribute('value',site_ids)
                    checkDiv.appendChild(input)
                
                    label = document.createElement('label')
                    label.classList.add('custom-control-label')
                    label.setAttribute('for',tag+'-box')
                    label.innerHTML = site_text
                    checkDiv.appendChild(label)
                
                    input.checked = true
                    groupSites.push(site_ids)
                    site_col_count += 1
        
                    input.addEventListener('change', function() {
                        if (!this.checked) {
                            groupSites.splice(groupSites.indexOf(this.value),1)
                        }
                        else {
                            groupSites.push(this.value)
                        }
                    });
                    
                }
            }

            modalGroups.modal({keyboard: true}); 
            modalViewGroups.modal('hide');
            
        }
    }(group))

    var groupDelete = document.createElement('button')
    groupDelete.id = 'btnGroupDelete-' + group.id
    groupDelete.setAttribute("class","btn btn-danger btn-block btn-sm")
    groupDelete.innerHTML = 'Delete'
    col3.appendChild(groupDelete)

    groupDelete.addEventListener('click', function(wrapId, wrapName) {
        return function() {
            selectedGroup = wrapId
            modalConfirmDelete.modal({keyboard: true});
            modalViewGroups.modal('hide');
            document.getElementById('modalConfirmBody').innerHTML = 'Do you wish to delete group ' + wrapName + '?'
            document.getElementById('btnConfirmDelete').addEventListener('click', function() {
                deleteGroup()
            })
        }
    }(group.id, group.name))

}

function editGroup() {
    /** Edits the group in the database */

    var sites_ids = []
    var groupName = document.getElementById('groupName').value
    var groupDescription = document.getElementById('groupDescription').value

    for (let i = 0; i < groupSites.length; i++) {
        var split = groupSites[i].split(',')
        sites_ids.push(...split)
    }

    var formData = new FormData();
    formData.append('group_id', JSON.stringify(selectedGroup));
    formData.append('sites_ids', JSON.stringify(sites_ids));
    formData.append('group_name', JSON.stringify(groupName));
    formData.append('group_description', JSON.stringify(groupDescription));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status == 'success') {
                modalGroups.modal('hide');
                getLabelsSitesTagsAndGroups(true)
            }
            else{
                document.getElementById('groupErrors').innerHTML = reply.message
            }

        }
    }
    xhttp.open("POST", '/editGroup');
    xhttp.send(formData);
}

function deleteGroup() {
    /** Deletes the group from the database */
    var xhhtp = new XMLHttpRequest();
    xhhtp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status == 'success') {
                modalConfirmDelete.modal('hide');
                getLabelsSitesTagsAndGroups(true)
            }
            else{
                document.getElementById('modalConfirmBody').innerHTML = reply.message
            }
        }
    }
    xhhtp.open("GET", '/deleteGroup/'+selectedGroup);
    xhhtp.send();
}

function updateSitesSelectionMethod(){
    /** Updates the sites seleection metod for adding sites to groups - either by searching or drawing an are on a map */

    var searchSitesRb = document.getElementById('searchSitesRb')
    var addSitesDiv = document.getElementById('addSitesDiv')

    while(addSitesDiv.firstChild) {
        addSitesDiv.removeChild(addSitesDiv.firstChild);
    }
    var row = document.createElement('div')
    row.setAttribute('class','row')
    addSitesDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.setAttribute('class','col-6')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.setAttribute('class','col-6')
    row.appendChild(col2)

    if (searchSitesRb.checked) {
        var searchSitesInput = document.createElement('input')
        searchSitesInput.setAttribute('type','text')
        searchSitesInput.setAttribute('class','form-control')
        searchSitesInput.setAttribute('id','searchSites')
        searchSitesInput.setAttribute('placeholder','Search')
        col1.appendChild(searchSitesInput)

        $('#searchSites').change( function() {
            /** Listens for changes in the sites search bar */
            searchSites();
        });

        var checkDiv = document.createElement('div')
        checkDiv.setAttribute('class','custom-control custom-checkbox')
        checkDiv.setAttribute('style','display: inline-block')
        col2.appendChild(checkDiv)

        var input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.classList.add('custom-control-input')
        input.setAttribute('id','advancedSearch')
        checkDiv.appendChild(input)

        var label = document.createElement('label')
        label.classList.add('custom-control-label')
        label.setAttribute('for','advancedSearch')
        label.innerHTML = 'Advanced'
        checkDiv.appendChild(label)


        $('#advancedSearch').change( function() {
            // Regular expression search
            var advancedSearchDiv = document.getElementById('advancedSearchDiv')
            while(advancedSearchDiv.firstChild) {
                advancedSearchDiv.removeChild(advancedSearchDiv.firstChild);
            }
            if (this.checked) {
                buildRegExp()
            }
        });

        var row2 = document.createElement('div')
        row2.setAttribute('class','row')
        addSitesDiv.appendChild(row2)

        var col3 = document.createElement('div')
        col3.setAttribute('class','col-12')
        row2.appendChild(col3)

        var advancedSearchDiv = document.createElement('div')
        advancedSearchDiv.setAttribute('id','advancedSearchDiv')
        col3.appendChild(advancedSearchDiv)

        addSitesDiv.appendChild(document.createElement('br'))

        sitesDiv = document.createElement('div')
        sitesDiv.setAttribute('id','sitesDiv')
        addSitesDiv.appendChild(sitesDiv)

    }
    else {
        var btnDrawSitesMap = document.createElement('button')
        btnDrawSitesMap.setAttribute('class','btn btn-primary btn-block')
        btnDrawSitesMap.setAttribute('id','btnDrawSitesMap')
        btnDrawSitesMap.innerHTML = 'Draw on map'
        col1.appendChild(btnDrawSitesMap)

        $('#btnDrawSitesMap').click( function() {
            /** Listens for clicks on the draw sites map button and opens the map modal */
            allCheckboxes = []
            initialiseSitesMap();

            modalSiteActive = true
            // modalGroups.modal('hide');
            modalSitesMap.modal({keyboard: true});
            // modalGroups.modal('hide');
        });
    }

    // addSitesDiv.appendChild(document.createElement('br'))
}

function buildRegExp(){
    /** Builds the advanced search div for the sites search bar */
    
    IDNum = getIdNumforNext('charSelect')

    if (IDNum==0) {
        // Initialising - build headings
        tgBuilder = document.getElementById('advancedSearchDiv')
        tgBuilder.append(document.createElement('br'))

        tgBuilderRows = document.createElement('div')
        tgBuilderRows.setAttribute('id','tgBuilderRows')
        tgBuilder.append(tgBuilderRows)

        // Add add-row button
        tgBuilderBtnRow = document.createElement('div')
        tgBuilderBtnRow.classList.add('row')
        tgBuilder.append(tgBuilderBtnRow)

        col1 = document.createElement('div')
        col1.classList.add('col-lg-11')
        tgBuilderBtnRow.appendChild(col1)

        col2 = document.createElement('div')
        col2.classList.add('col-lg-1')
        tgBuilderBtnRow.appendChild(col2)  
        
        btnAdd = document.createElement('button');
        btnAdd.classList.add('btn');
        btnAdd.classList.add('btn-primary');
        btnAdd.innerHTML = '+';
        col2.appendChild(btnAdd)
        
        btnAdd.addEventListener('click', (evt)=>{
            buildRegExp();
        });

        // Heading Row
        row = document.createElement('div')
        row.classList.add('row')
        tgBuilderRows.append(row)

        // Character column
        col1 = document.createElement('div')
        col1.classList.add('col-lg-2')
        col1.innerHTML = 'Character(s)'
        row.appendChild(col1)

        // Custom Character Column
        col2 = document.createElement('div')
        col2.classList.add('col-lg-3')
        row.appendChild(col2)

        // Custom Character Operation Column
        col3 = document.createElement('div')
        col3.classList.add('col-lg-2')
        row.appendChild(col3)

        // Occurrence Column
        col4 = document.createElement('div')
        col4.classList.add('col-lg-2')
        col4.innerHTML = 'Occurence'
        row.appendChild(col4)

        // Custom Occurrence Column
        col5 = document.createElement('div')
        col5.classList.add('col-lg-2')
        row.appendChild(col5)

        // Delete Button Column
        col6 = document.createElement('div')
        col6.classList.add('col-lg-1')
        row.appendChild(col6)
    } else {
        tgBuilderRows = document.getElementById('tgBuilderRows')
    }

    row = document.createElement('div')
    row.classList.add('row')
    tgBuilderRows.append(row)

    // Character column
    col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    selectID = 'charSelect-'+IDNum
    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id',selectID)
    col1.appendChild(select)

    $("#"+selectID).change( function(wrapIDNum) {
        return function() {
            select = document.getElementById('charSelect-'+wrapIDNum)
            selection = select.options[select.selectedIndex].text
            if (selection == 'Custom Set') {
                //Build custom row
                col2 = document.getElementById('tgBuilderCol2-'+wrapIDNum)

                input = document.createElement('input')
                input.setAttribute('type','text')
                input.classList.add('form-control')
                input.required = true
                input.setAttribute('id','customCharacters-'+wrapIDNum)
                col2.appendChild(input)

                $("#customCharacters-"+wrapIDNum).change( function() {
                    updateRegExp()
                })

                col3 = document.getElementById('tgBuilderCol3-'+wrapIDNum)
                
                select = document.createElement('select')
                select.classList.add('form-control')
                select.setAttribute('id','CustomCharSelect-'+wrapIDNum)
                col3.appendChild(select)

                $("#CustomCharSelect-"+wrapIDNum).change( function() {
                    updateRegExp()
                })

                fillSelect(select, ['Exactly','Or'], [1,2])

            } else {
                // Remove any custom row
                div = document.getElementById('tgBuilderCol2-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }

                div = document.getElementById('tgBuilderCol3-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }
            }
            updateRegExp()
        }
    }(IDNum));

    fillSelect(select, ['Any Digit','Any Letter (Upper)','Any Letter (Lower)','Any Letter (Any)','Any Character','Custom Set'], [1,2,3,4,5,7])

    // Custom Character Column
    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    col2.setAttribute('id','tgBuilderCol2-'+IDNum)
    row.appendChild(col2)

    // Custom Character Operation Column
    col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.setAttribute('id','tgBuilderCol3-'+IDNum)
    row.appendChild(col3)

    // Occurrence Column
    col4 = document.createElement('div')
    col4.classList.add('col-lg-2')
    row.appendChild(col4)

    selectID = 'occurrenceSelect-'+IDNum
    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id',selectID)
    col4.appendChild(select)

    $("#"+selectID).change( function(wrapIDNum) {
        return function() {
            select = document.getElementById('occurrenceSelect-'+wrapIDNum)
            selection = select.options[select.selectedIndex].text
            if (selection == 'Custom Count') {
                //Build custom row
                col5 = document.getElementById('tgBuilderCol5-'+wrapIDNum)

                input = document.createElement('input')
                input.setAttribute('type','text')
                input.classList.add('form-control')
                input.required = true
                input.setAttribute('id','customOccurrence-'+wrapIDNum)
                col5.appendChild(input)

                $("#customOccurrence-"+wrapIDNum).change( function() {
                    updateRegExp()
                })
            } else {
                // Remove any custom row
                div = document.getElementById('tgBuilderCol5-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }
            }
            updateRegExp()
        }
    }(IDNum));

    fillSelect(select, ['Once','Zero or More','Zero or One','One or More','Custom Count'], [1,2,3,4,5])

    // Custom Occurrence Column
    col5 = document.createElement('div')
    col5.classList.add('col-lg-2')
    col5.setAttribute('id','tgBuilderCol5-'+IDNum)
    row.appendChild(col5)

    // Delete Column
    col6 = document.createElement('div')
    col6.classList.add('col-lg-1')
    row.appendChild(col6)

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    // btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';
    col6.appendChild(btnRemove)
    
    btnRemove.addEventListener('click', (evt)=>{
        evt.target.parentNode.parentNode.remove();
        updateRegExp()
    });

    if (IDNum!=0) {
        updateRegExp()
    }


}

function updateRegExp() {
    /** Extracts the info from the trapgroup code builder and populates the trapgroup code accordingly. */

    tgCode = ''
    charSelects = document.querySelectorAll('[id^=charSelect-]')
    for (let i=0;i<charSelects.length;i++) {
        IDNum = charSelects[i].id.split("-")[charSelects[i].id.split("-").length-1]
        
        selection = charSelects[i].options[charSelects[i].selectedIndex].text
        if (selection=='Any Digit') {
            tgCode += '[0-9]'
        } else if (selection=='Any Letter (Upper)') {
            tgCode += '[A-Z]'
        } else if (selection=='Any Letter (Lower)') {
            tgCode += '[a-z]'
        } else if (selection=='Any Letter (Any)') {
            tgCode += '[A-Za-z]'
        } else if (selection=='Any Character') {
            tgCode += '.'
        } else if (selection=='Custom Set') {
            customCharacters = document.getElementById('customCharacters-'+IDNum).value
            CustomCharSelect = document.getElementById('CustomCharSelect-'+IDNum)
            selection = CustomCharSelect.options[CustomCharSelect.selectedIndex].text
            if (selection=='Exactly') {
                tgCode += customCharacters
            } else if (selection=='Or') {
                tgCode += '['+customCharacters+']'
            }
        }
        
        occurrenceSelect = document.getElementById('occurrenceSelect-'+IDNum)
        selection = occurrenceSelect.options[occurrenceSelect.selectedIndex].text
        if (selection=='Once') {
            //pass
        } else if (selection=='Zero or More') {
            tgCode += '*'
        } else if (selection=='Zero or One') {
            tgCode += '?'
        } else if (selection=='One or More') {
            tgCode += '+'
        } else if (selection=='Custom Count') {
            customOccurrence = document.getElementById('customOccurrence-'+IDNum).value
            tgCode += '{'+customOccurrence.toString()+'}'
        }
    }

    document.getElementById('searchSites').value = tgCode
    searchSites()

}

function viewGroups(){
    modalViewGroups.modal({keyboard: true});
}

function saveGroupFromData(){
    // Opens the createGroup modal and populates it with the data selected from the generate analysis card
    document.getElementById('groupHeader').innerHTML = 'Create Group'
    var groupSitesDiv = document.getElementById('groupSitesDiv')
    var row = document.createElement('div')
    row.setAttribute('class','row')
    groupSitesDiv.appendChild(row)
    site_col_count = 0
    for (let i = 0; i < 4 ; i++) {
        var col = document.createElement('div')
        col.setAttribute('class','col-3')
        col.setAttribute('id','groupSitesCol-'+i)
        row.appendChild(col)
    }

    var sites = getSitesForGroup()

    allCheckboxes = []
    groupSites = []
    console.log(sites)

    for (let i=0;i<sites.length;i++) {
        var site = sites[i]
        var site_text = site.text
        var site_ids = site.ids
        var splits = site.text.split(' ')
        var tag = splits[0] + '_' + splits[1].split('(')[1].split(',')[0] + '_' + splits[2].split(')')[0]

        if (!groupSites.includes(site_ids)) {

            if (site_col_count == 4) {
                site_col_count = 0
            }

            var col = document.getElementById('groupSitesCol-'+site_col_count)

            allCheckboxes.push(tag+'-box')
            checkDiv = document.createElement('div')
            checkDiv.setAttribute('class','custom-control custom-checkbox')
            checkDiv.setAttribute('style','display: inline-block')
            col.appendChild(checkDiv)
        
            input = document.createElement('input')
            input.setAttribute('type','checkbox')
            input.classList.add('custom-control-input')
            input.setAttribute('id',tag+'-box')
            input.setAttribute('name',tag+'-box')
            input.setAttribute('value',site_ids)
            checkDiv.appendChild(input)
        
            label = document.createElement('label')
            label.classList.add('custom-control-label')
            label.setAttribute('for',tag+'-box')
            label.innerHTML = site_text
            checkDiv.appendChild(label)
        
            input.checked = true
            groupSites.push(site_ids)
            site_col_count += 1

            input.addEventListener('change', function() {
                if (!this.checked) {
                    groupSites.splice(groupSites.indexOf(this.value),1)
                }
                else {
                    groupSites.push(this.value)
                }
            });
            
        }
    }

    modalGroups.modal({keyboard: true});
}

function getSitesForGroup(){
    /** Gets the sites for the group from the generate analysis card */
    var analysisType = document.getElementById('analysisSelector').value    
    if (analysisType == '2'){
        allSites = document.querySelectorAll('[id^=trapgroupSelectSpat-]')
    }
    else if (analysisType == '3'){
        allSites = document.querySelectorAll('[id^=trapgroupSelectNum-]')
    }
    else if (analysisType=='0' || analysisType=='5' || analysisType=='6' || analysisType=='7'){
        allSites = document.querySelectorAll('[id^=siteSelector-]')
    }
    else if (analysisType=='-1'){
        return '0'
    }
    else {
        allSites = document.querySelectorAll('[id^=trapgroupSelect-]')
    }

    var sites = []
    var selectAll = false

    if (allSites){
        for (let i = 0; i < allSites.length; i++) {
            if (allSites[i].value != '0' && allSites[i].value != '-1'){
                if (allSites[i].value.includes('s-')){
                    sites.push({
                        'ids': allSites[i].value.split('-')[1],
                        'text': allSites[i].options[allSites[i].selectedIndex].text
                    })
                }
            }
            else if (allSites[i].value == '0'){
                selectAll = true
                break
            }
        }
    
        if (selectAll) {
            sites = []
            for (let i = 0; i < globalSites.length; i++) {
                sites.push({
                    'ids': globalSitesIDs[i], 
                    'text': globalSites[i]
                })
            }
        }
    }

    return sites
}

modalGroups.on('show.bs.modal', function(){
    document.body.style.overflow = 'hidden';
    modalGroups.css('overflow', 'auto');
    modalGroupReturn = true 
    document.getElementById('searchSitesRb').checked = true
    updateSitesSelectionMethod()

});

modalGroups.on('hidden.bs.modal', function(){
    /** Clears the groups modal when closed. */
    console.log(!modalSiteActive)
    console.log(!helpReturn)
    if (!helpReturn) {
        document.body.style.overflow = 'auto'
        modalGroups.css('overflow', 'auto')
        if (!modalSiteActive) {
            var addSitesDiv = document.getElementById('addSitesDiv');
            while(addSitesDiv.firstChild) {
                addSitesDiv.removeChild(addSitesDiv.firstChild);
            }
            var groupSitesDiv = document.getElementById('groupSitesDiv');
            while(groupSitesDiv.firstChild) {
                groupSitesDiv.removeChild(groupSitesDiv.firstChild);
            }
            document.getElementById('groupName').value = '';
            document.getElementById('groupDescription').value = '';
            document.getElementById('groupErrors').innerHTML = '';
            allCheckboxes = []
            groupSites = []
            selectedGroup = null
            document.getElementById('groupHeader').innerHTML = ''
            site_col_count = 0

            modalViewGroups.modal({keyboard: true});

        }
        helpReturn = false
    }
});

modalSitesMap.on('hidden.bs.modal', function(){
    /** Clears the sites map modal when closed. */
    if (!helpReturn) {	
        mapSites.remove()
        mapSites = null
        drawnItems = null
        sitesMarkers = null
        var mapSitesDiv = document.getElementById('mapSitesDiv'); 
        while(mapSitesDiv.firstChild) {
            mapSitesDiv.removeChild(mapSitesDiv.firstChild);
        }

        modalGroups.modal({keyboard: true});
        modalSiteActive = false
        helpReturn = false
    }
    
});

modalConfirmDelete.on('hidden.bs.modal', function(){
    modalViewGroups.modal({keyboard: true});
    selectedGroup = null
});

modalViewGroups.on('show.bs.modal', function(){
    selectedGroup = null
    getGroups()
});

$('#btnSaveGroup').click( function() {
    var vaild = checkValidGroup()
    if (vaild) {
        if (selectedGroup){
            editGroup()
        }
        else {
            saveGroup()
        }
    }
});

$('#btnSaveSitesOnMap').click( function() {
    markersInPoly = []
    saveSitesOnMap()
});

$('#searchSitesRb').change( function() {
    updateSitesSelectionMethod()
});

$('#selectSitesRb').change( function() {
    updateSitesSelectionMethod()
});


$('#btnCreateGroup').on('click', function() {
    document.getElementById('groupHeader').innerHTML = 'Create Group'
    var groupSitesDiv = document.getElementById('groupSitesDiv')
    var row = document.createElement('div')
    row.setAttribute('class','row')
    groupSitesDiv.appendChild(row)
    site_col_count = 0
    for (let i = 0; i < 4 ; i++) {
        var col = document.createElement('div')
        col.setAttribute('class','col-3')
        col.setAttribute('id','groupSitesCol-'+i)
        row.appendChild(col)
    }

    modalViewGroups.modal('hide');
    modalGroups.modal({keyboard: true});

});



