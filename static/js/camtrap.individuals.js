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

const modalIndividual = $('#modalIndividual');
const modalAlertIndividuals = $('#modalAlertIndividuals');
const modalLaunchID = $('#modalLaunchID');

var modalAlertIndividualsReturn = false

var individualSplide = null
var map = null
var mapStats = null
var displayedIndividuals = null
var legalSurvey = false
var validDate = false
var currentNote = ''
var globalTags = null
var globalLabels = null
var current_page = null

isTagging = false
isReviewing = false
isKnockdown = false
isBounding = false
isIDing = false


function next_individuals() {
    /** Gets the next page of individuals in the individuals modal. */
    getIndividuals(individual_next)
}

function prev_individuals() {
    /** Gets the previous page of individuals from the individuals modal. */
    getIndividuals(individual_prev)
}

function getIndividuals(page = null) {
    /** Gets a page of individuals. Gets the first page if none is specified. */
    var tasks = []
    var selectedLabel = '0'
    var selectedTag = 'None'
    var selectedTrap = '0'
    var selectedStartDate = ''
    var selectedEndDate = ''

    checkSurvey()
    validateDateRange()

    allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    for (let i=0;i<allTasks.length;i++) {
        if (allTasks[i].value != '-99999'){
            tasks.push(allTasks[i].value)
        } 
        if(allTasks[i].value == ''){
            tasks.push('0')
        }
    }

    if(legalSurvey && !modalActive && validDate){
        selectedLabel = document.getElementById('individualSpeciesSelector').value
        selectedTag = document.getElementById('individualTagSelector').value
        selectedTrap = document.getElementById('sitesSelector').value
        selectedStartDate = document.getElementById('startDate').value 
        selectedEndDate = document.getElementById('endDate').value 

        if(selectedStartDate != '' && selectedEndDate != ''){
            dates = [selectedStartDate + ' 00:00:00',selectedEndDate + ' 23:59:59']
        }
        else{
            dates = []
        }

        var formData = new FormData()
        formData.append("task_ids", JSON.stringify(tasks))
        formData.append("species_name", JSON.stringify(selectedLabel))
        formData.append("tag_name", JSON.stringify(selectedTag))
        formData.append("trap_name", JSON.stringify(selectedTrap))
        formData.append("dates", JSON.stringify(dates))
        console.log(tasks, selectedLabel, selectedTag, selectedTrap, dates)
        request = '/getAllIndividuals'
        if (page != null) {
            current_page = page
            request += '?page='+page.toString()
            order = orderSelect.options[orderSelect.selectedIndex].value
            request += '&order='+order.toString() 
        }
        else{
            order = orderSelect.options[orderSelect.selectedIndex].value
            request += '?order='+order.toString()     
        }
        
        search = document.getElementById('individualSearch').value
        if( search != null){
            request += '&search='+search.toString()
        }

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", request);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                individuals = reply.individuals
                individualsDiv = document.getElementById('individualsDiv')

                
                while(individualsDiv.firstChild){
                    individualsDiv.removeChild(individualsDiv.firstChild);
                }
                
                row = document.createElement('div')
                row.classList.add('row')
                individualsDiv.appendChild(row)
                runningCount = 0
                for (let i=0;i<individuals.length;i++) {
                    newIndividual = individuals[i]

                    if (runningCount%4==0) {
                        runningCount = 0
                        row = document.createElement('div')
                        row.classList.add('row')
                        individualsDiv.appendChild(row)
                        individualsDiv.appendChild(document.createElement('br'))
                    }

                    col = document.createElement('div')
                    col.classList.add('col-lg-3')
                    row.appendChild(col)

                    image = document.createElement('img')
                    image.setAttribute('width','100%')
                    image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(newIndividual.url)
                    col.appendChild(image)

                    h5 = document.createElement('h5')
                    h5.setAttribute('align','center')
                    h5.innerHTML = newIndividual.name
                    col.appendChild(h5)

                    image.addEventListener('click', function(individualID,individualName){
                        return function() {
                            getIndividual(individualID,individualName)
                            modalIndividual.modal({keyboard: true});
                        }
                    }(newIndividual.id,newIndividual.name));

                    runningCount += 1
                }

                if (reply.next==null) {
                    document.getElementById('btnNextIndividuals').style.visibility = 'hidden'
                    individual_next = null
                } else {
                    document.getElementById('btnNextIndividuals').style.visibility = 'visible'
                    individual_next = reply.next
                }

                if (reply.prev==null) {
                    document.getElementById('btnPrevIndividuals').style.visibility = 'hidden'
                    individual_prev = null
                } else {
                    document.getElementById('btnPrevIndividuals').style.visibility = 'visible'
                    individual_prev = reply.prev
                }
            }
        }
        xhttp.send(formData);
    }
    
}

function getIndividual(individualID, individualName, order_value = 'a1', site='0', dates=[]){
    selectedIndividual = individualID
    selectedIndividualName = individualName

    var formData = new FormData()
    formData.append("order", JSON.stringify(order_value))
    formData.append("site", JSON.stringify(site))
    formData.append('dates', JSON.stringify(dates))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            individualImages = JSON.parse(this.responseText);
            console.log(individualImages)
            if(individualImages.length > 0){
                document.getElementById('individualName').innerHTML = individualName

                document.getElementById('tgInfo').innerHTML = 'Trap: ' + individualImages[0].trapgroup.tag
                document.getElementById('timeInfo').innerHTML = individualImages[0].timestamp

                center = document.getElementById('centerMap')
                while(center.firstChild){
                    center.removeChild(center.firstChild)
                }

                mapDiv = document.createElement('div')
                mapDiv.setAttribute('id','mapDiv')
                mapDiv.setAttribute('style','height: 800px')
                center.appendChild(mapDiv)
                
                individualTags()

                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(){
                    if (this.readyState == 4 && this.status == 200) {
                        info = JSON.parse(this.responseText);
                        console.log(info)
                        if (info != "error"){
                            document.getElementById('idLabels').innerHTML = "Label: " + info.label

                            document.getElementById('idNotes').value= info.notes
                            currentNote = info.notes
                            document.getElementById('notesError').innerHTML = ''

                            id_surveys = document.getElementById('idSurveys')
                            id_surveys.innerHTML = "Surveys: " + info.surveys

                            firstSeen = info.seen_range[0]
                            lastSeen = info.seen_range[1]
                            document.getElementById('idFirstSeen').innerHTML = "First Seen: " + firstSeen
                            document.getElementById('idLastSeen').innerHTML = "Last Seen: " + lastSeen

                            minDate = firstSeen.split(' ')[0].replace(/\//g, '-')
                            maxDate = lastSeen.split(' ')[0].replace(/\//g, '-')

                            document.getElementById('startDateIndiv').setAttribute('min', minDate)
                            document.getElementById('endDateIndiv').setAttribute('min', minDate)
                            document.getElementById('startDateIndiv').setAttribute('max', maxDate)
                            document.getElementById('endDateIndiv').setAttribute('max', maxDate)

                            individual_tags = info.tags
                            for (let i=0;i<globalTags.length;i++) {
                                tag = globalTags[i].tag
                                box = document.getElementById(tag+ "box")
                                if (individual_tags.includes(tag)){
                                    box.checked = true
                                } else {                    
                                    box.checked = false
                                }
                            }
                        }
                    }
                }
                xhttp.open("GET", '/getIndividualInfo/'+individualID);
                xhttp.send();

                document.getElementById('btnDelIndiv').addEventListener('click', ()=>{
                    document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                    document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently delete this individual?'
                    document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','deleteIndividual()')
                    modalAlertIndividualsReturn = true
                    modalIndividual.modal('hide')
                    modalAlertIndividuals.modal({keyboard: true});
                });


                document.getElementById('btnRemoveImg').addEventListener('click', ()=>{
                    if (individualImages.length > 1){
                        document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                        document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently remove this image from this individual?'
                        document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','removeImage()')
                        modalAlertIndividualsReturn = true
                        modalIndividual.modal('hide')
                        modalAlertIndividuals.modal({keyboard: true});
                    }

                    
                });

                splideDive = document.getElementById('splideDiv')

                while(splideDiv.firstChild){
                    splideDiv.removeChild(splideDiv.firstChild);
                }

                card = document.createElement('div')
                card.classList.add('card')
                card.setAttribute('style','background-color: rgb(60, 74, 89);margin-top: 5px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 5px')
                splideDiv.appendChild(card)

                body = document.createElement('div')
                body.classList.add('card-body')
                body.setAttribute('style','margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px')
                card.appendChild(body)

                splide = document.createElement('div')
                splide.classList.add('splide')
                splide.setAttribute('id','splide')
                body.appendChild(splide)

                track = document.createElement('div')
                track.classList.add('splide__track')
                splide.appendChild(track)

                list = document.createElement('ul')
                list.classList.add('splide__list')
                list.setAttribute('id','imageSplide')
                track.appendChild(list)

                // initialiseStats()

                if(modalIndividual.is(':visible')){
                    map = null
                    individualSplide = null
                    prepMap(individualImages[0])
                    updateSlider()
                }

            }
            else{
                if(dates){
                    document.getElementById('dateErrorsIndiv').innerHTML = 'No images available for this date range. Please select another date range.'
                }
                
            }   

        }
    }
    xhttp.open("POST", '/getIndividual/'+individualID);
    xhttp.send(formData)
}

function individualTags(){
    tagsDiv  = document.getElementById('editTagsDiv')
    while(tagsDiv.firstChild){
        tagsDiv.removeChild(tagsDiv.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            tags = JSON.parse(this.responseText);  
            globalTags = tags
            console.log(tags)
            if(tags){
                
                for (let i=0;i<tags.length;i++) {
                    tag = tags[i].tag
                    hotkey = tags[i].hotkey

                    checkDiv = document.createElement('div')
                    checkDiv.setAttribute('class','custom-control custom-checkbox')
                    tagsDiv.appendChild(checkDiv)
            
                    input = document.createElement('input')
                    input.setAttribute('type','checkbox')
                    input.classList.add('custom-control-input')
                    input.setAttribute('id',tag+'box')
                    input.setAttribute('name',tag+'box')
                    checkDiv.appendChild(input)
            
                    label = document.createElement('label')
                    label.classList.add('custom-control-label')
                    label.setAttribute('for',tag+'box')
                    label.innerHTML = tag
                    checkDiv.appendChild(label)

                    input.addEventListener('click', ()=>{
                        submitIndividualTags()                  
                    })

                }
            }
            
        }
    }
    xhttp.open("GET", '/getTags/' +  selectedIndividual);
    xhttp.send();  
}

function submitIndividualTags(){
    /** Submits the selected tags for specified individual */
    var newTags = []
    for (let i=0;i<globalTags.length;i++) {
        tag = globalTags[i].tag
        box = document.getElementById(tag+ "box")
        if(box.checked){
            newTags.push(tag)
        }
    }

    var formData = new FormData()
    formData.append("tags", JSON.stringify(newTags))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/submitTagsIndividual/' + selectedIndividual);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)    
        }
    }
    xhttp.send(formData);   
}

$("#individualSpeciesSelector").change( function() {
    /** Listener for the species selector on the the individuals page. */
    getIndividuals()
})

function populateSpecies() {
    /**Populates the species selector on the individuals page*/

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getAllLabels');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (modalActive){
                texts = []
                texts.push(...reply.labels)
                values = []
                values.push(...reply.labels)
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), texts, values)
            }
            else{
                texts = ['All']
                texts.push(...reply.labels)
                values = ['0']
                values.push(...reply.labels)
                clearSelect(document.getElementById('individualSpeciesSelector'))
                fillSelect(document.getElementById('individualSpeciesSelector'), texts, values)
                getIndividuals()
            }
            
        }
    }
    xhttp.send();

    individualsDiv = document.getElementById('individualsDiv')
    while(individualsDiv.firstChild){
        individualsDiv.removeChild(individualsDiv.firstChild);
    }

}

function populateTags() {
    /**Populates the tags selector on the individuals page*/

    var xhttp = new XMLHttpRequest();   
    xhttp.open("GET", '/getAllTags');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            texts = ['All', 'All Tags' ]
            texts.push(...reply.tags)
            values = ['None','All']
            values.push(...reply.tags)
            clearSelect(document.getElementById('individualTagSelector'))
            fillSelect(document.getElementById('individualTagSelector'), texts, values)
            getIndividuals()
        }
    }
    xhttp.send();
}


$("#individualTagSelector").change( function() {
    // Listener for the tags selectors on the the individuals page.
    getIndividuals()
})

function populateTraps() {
    /**Populates the tags selector on the individuals page*/

    var xhttp = new XMLHttpRequest();   
    xhttp.open("GET", '/getAllTraps');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            texts = ['All']
            texts.push(...reply.traps)
            values = ['0']
            values.push(...reply.traps)
            clearSelect(document.getElementById('sitesSelector'))
            fillSelect(document.getElementById('sitesSelector'), texts, values)
            getIndividuals()
        }
    }
    xhttp.send();
}


$("#sitesSelector").change( function() {
    // Listener for the tags selectors on the the individuals page.
    getIndividuals()
})

$("#startDate").change( function() {
    /** Listener for the start date selector on the the individuals page. */
    validateDateRange()
    if(validDate) {
        getIndividuals()
    }
})

$("#endDate").change( function() {
    /** Listener for the end date selector on the the individuals page. */
    validateDateRange()
    if(validDate) {
        getIndividuals()
    }
})

function validateDateRange() {
    /** Validates the date range on the individuals page. */

    if(modalIndividual.is(':visible')){
        var dateError = document.getElementById('dateErrorsIndiv')	
        var startDate = document.getElementById('startDateIndiv').value;
        var endDate = document.getElementById('endDateIndiv').value;
    }
    else{
        var dateError = document.getElementById('dateErrors')
        var startDate = document.getElementById('startDate').value;
        var endDate = document.getElementById('endDate').value;
    }
    dateError.innerHTML = ''
    if (startDate && endDate) {
        if (startDate > endDate) {
            dateError.innerHTML = 'Start date must be before end date.'
            validDate = false;
        }
        else{
            validDate = true
        }
    }
    else if(startDate && !endDate) {
        dateError.innerHTML = 'Please enter an end date.'
        validDate = false;
    }
    else if(!startDate && endDate) {
        dateError.innerHTML = 'Please enter a start date.'
        validDate = false
    }
    else{
        validDate = true
    }
}

function modifyToCompURL(url) {
    /** Modifies the source URL to the compressed folder of the user */
    splits=url.split('/')
    splits[0]=splits[0]+'-comp'
    return splits.join('/')
}

function updateSlider() {
    /** Updates the image slider for the individual modal. */
    
    imageSplide = document.getElementById('imageSplide')
    while(imageSplide.firstChild){
        imageSplide.removeChild(imageSplide.firstChild);
    }

    for (let i=0;i<individualImages.length;i++) {
        img = document.createElement('img')
        img.setAttribute('src',"https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualImages[i].url))
        imgli = document.createElement('li')
        imgli.classList.add('splide__slide')
        imgli.appendChild(img)
        imageSplide.appendChild(imgli)
    }

    if (individualSplide==null) {
        // Initialise Splide
        individualSplide = new Splide( document.getElementById('splide'), {
            rewind      : false,
            fixedWidth  : 200,
            fixedHeight : 128,
            isNavigation: true,
            keyboard    : true,
            gap         : 5,
            pagination  : false,
            cover       : true,
            breakpoints : {
                '600': {
                    fixedWidth  : 66,
                    fixedHeight : 40
                }
            }
        } ).mount();

        individualSplide.on( 'moved', function() {
            if (bucketName!=null) {
                finishedDisplaying = false
                image = individualImages[individualSplide.index]
                document.getElementById('tgInfo').innerHTML = "Trap: " + image.trapgroup.tag
                document.getElementById('timeInfo').innerHTML = image.timestamp
                addedDetections = false
                activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
            }
        });

        var track = individualSplide.Components.Elements.track
        individualSplide.on( 'click', function(wrapTrack) {
            return function() {
                imageIndex = parseInt(event.toElement.id.split("slide")[1])-1
                individualSplide.go(imageIndex)
            }
        }(track));

    } else {
        individualSplide.refresh()
    }
}

function cleanModalIndividual() {
    /** Clears the individual modal */
    
    splideDiv = document.getElementById('splideDiv')
    while(splideDiv.firstChild){
        splideDiv.removeChild(splideDiv.firstChild);
    }

    center = document.getElementById('centerMap')
    while(center.firstChild){
        center.removeChild(center.firstChild)
    }

    statisticsDiv = document.getElementById('statisticsDiv')
    while(statisticsDiv.firstChild){
        statisticsDiv.removeChild(statisticsDiv.firstChild)
    }
    
    individualSplide = null
    individualImages = null
    mapReady = null
    finishedDisplaying = true
    activeImage = null
    drawnItems = null
    fullRes = false
    rectOptions = null
    mapWidth = null
    mapHeight = null
    map = null
    mapStats = null

    document.getElementById('ascOrder').checked = true
    document.getElementById('orderIndivImages').value = '1'	
    document.getElementById('startDateIndiv').value = ''
    document.getElementById('endDateIndiv').value = ''

    document.getElementById('statsSelect').value = '0'
}

modalIndividual.on('hidden.bs.modal', function(){
    /** Clears the individual modal when closed. */
    if (modalAlertIndividualsReturn) {
        modalAlertIndividualsReturn = false
    } 
    else if(helpReturn){
        helpReturn = false
    }
    else {
        cleanModalIndividual()
        getIndividuals(current_page)
    }
});

modalIndividual.on('shown.bs.modal', function(){
    /** Initialises the individual modal when opened. */
    if (map==null && individualImages) {
        prepMap(individualImages[0])
        updateSlider()
    }
    
    sites = []
    for (let i=0;i<individualImages.length;i++) {
        if (!sites.includes(individualImages[i].trapgroup.tag)) {
            sites.push(individualImages[i].trapgroup.tag)
        }
    }
    sites.sort()
    texts = ['All']
    texts.push(...sites)
    values = ['0']
    values.push(...sites)
    clearSelect(document.getElementById('sitesIndividualSelector'))
    fillSelect(document.getElementById('sitesIndividualSelector'), texts, values)

});

$('#orderIndivImages').on('change', function() {
    updateIndividualFilter()
});

$('#ascOrder').on('change', function() {
    updateIndividualFilter()
});

$('#decOrder').on('change', function() {
    updateIndividualFilter()
});

$('#sitesIndividualSelector').on('change', function() {
    updateIndividualFilter()
});

$("#startDateIndiv").change( function() {
    /** Listener for the start date selector on the the individuals page. */
    validateDateRange()
    if(validDate){
        updateIndividualFilter()
    }
})

$("#endDateIndiv").change( function() {
    /** Listener for the end date selector on the the individuals page. */
    validateDateRange()
    if(validDate){
        updateIndividualFilter()
    }
})

function updateIndividualFilter() {
    /** Updates the individual filter. */
    order_value = document.getElementById("orderIndivImages").value
    if(document.getElementById('ascOrder').checked){
        order_value = 'a' + order_value
    }
    else{
        order_value = 'd' + order_value
    }
    site = document.getElementById("sitesIndividualSelector").value

    validateDateRange()
    if (validDate && document.getElementById("startDateIndiv").value != "" && document.getElementById("endDateIndiv").value != ""){
        startDate = document.getElementById("startDateIndiv").value
        endDate = document.getElementById("endDateIndiv").value
        dates = [startDate + ' 00:00:00',endDate + ' 23:59:59']
    }
    else{
        dates = []
    }
    

    getIndividual(selectedIndividual, selectedIndividualName, order_value, site, dates)
}


function addDetections(image) {
    //** Adds detections to the main image displayed in the individual modal. */
    if (!addedDetections) {
        map.setZoom(map.getMinZoom())
        fullRes = false
        drawnItems.clearLayers()
        for (let i=0;i<image.detections.length;i++) {
            detection = image.detections[i]
            if (detection.static == false) {
                rectOptions.color = "rgba(223,105,26,1)"
                rect = L.rectangle([[detection.top*mapHeight,detection.left*mapWidth],[detection.bottom*mapHeight,detection.right*mapWidth]], rectOptions)
                drawnItems.addLayer(rect)
            }
        }
        finishedDisplaying = true
        addedDetections = true
    }
}

function prepMap(image) {
    /** Initialises the Leaflet image map for the individual ID modal. */

    if (bucketName != null) {
        mapReady = false
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height


            if (w>h) {
                document.getElementById('mapDiv').setAttribute('style','height: calc(38vw *'+(h/w)+');  width:38vw')               
            } else {
                document.getElementById('mapDiv').setAttribute('style','height: calc(38vw *'+(w/h)+');  width:38vw')
            }

            L.Browser.touch = true
    
            map = new L.map('mapDiv', {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0
            })

            var h1 = document.getElementById('mapDiv').clientHeight
            var w1 = document.getElementById('mapDiv').clientWidth
    
            var southWest = map.unproject([0, h1], 2);
            var northEast = map.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mapWidth = northEast.lng
            mapHeight = southWest.lat
    
            activeImage = L.imageOverlay(imageUrl, bounds).addTo(map);
            activeImage.on('load', function() {
                addedDetections = false
                addDetections(individualImages[individualSplide.index])
            });
            map.setMaxBounds(bounds);
            map.fitBounds(bounds)
            map.setMinZoom(map.getZoom())

            hc = document.getElementById('mapDiv').clientHeight
            wc = document.getElementById('mapDiv').clientWidth
            map.on('resize', function(){
                if(document.getElementById('mapDiv').clientHeight){
                    h1 = document.getElementById('mapDiv').clientHeight
                    w1 = document.getElementById('mapDiv').clientWidth
                }
                else{
                    h1 = hc
                    w1 = wc
                }
                
                southWest = map.unproject([0, h1], 2);
                northEast = map.unproject([w1, 0], 2);
                bounds = new L.LatLngBounds(southWest, northEast);
        
                mapWidth = northEast.lng
                mapHeight = southWest.lat

                map.invalidateSize()
                map.setMaxBounds(bounds)
                map.fitBounds(bounds)
                map.setMinZoom(map.getZoom())
                activeImage.setBounds(bounds)
                addedDetections = false
                addDetections(individualImages[individualSplide.index])    
            });


            map.on('drag', function() {
                map.panInsideBounds(bounds, { animate: false });
            });
    
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
    
            map.on('zoomstart', function() {
                if (!fullRes) {
                    activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + individualImages[individualSplide.index].url)
                    fullRes = true
                }
            });
    
            rectOptions = {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }            

            mapReady = true
        };
        img.src = imageUrl
    }

}


function createIndivMap() {
    /** Initialises the individual heat map. */
    trapgroupInfo = []
    dates = []
    hm_data = []
    for (images in individualImages){
        if(!(trapgroupInfo.some(e => e.tag == individualImages[images].trapgroup.tag))){
            trapgroupInfo.push(individualImages[images].trapgroup)

            filteredArray = individualImages.filter((item) => item.trapgroup.tag == individualImages[images].trapgroup.tag)

            dict_data = {
                'lat': individualImages[images].trapgroup.latitude, 
                'lng': individualImages[images].trapgroup.longitude, 
                'count': filteredArray.length, 
                'tag': individualImages[images].trapgroup.tag
            }
            hm_data.push(dict_data)
        }

        date = individualImages[images].timestamp
        date = date.slice(0, date.indexOf(' ') )
        if(!dates.includes(date)){
            dates.push(date)
        }  

    }
    statisticsDiv = document.getElementById('statisticsDiv')
    mainDiv = document.createElement('indivMapDiv')
    statisticsDiv.appendChild(mainDiv)

    div = document.createElement('div')
    div.classList.add('row')
    mainDiv.appendChild(div)

    // space = document.createElement('div')
    // space.classList.add('col-lg-1')
    // div.appendChild(space)

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

    // space = document.createElement('div')
    // space.classList.add('col-lg-1')
    // div.appendChild(space)

    

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
    h5.innerHTML = "<i>Select the date for which you would like to view the individual's sightings.</i>"
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    selectorDiv.appendChild(h5)

    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','mapDateSelector')
    selectorDiv.appendChild(select)

    texts = ['All']
    values = ['0']

    dates.sort((a, b) => new Date(b) - new Date(a));
    for (d in dates){
        texts.push(dates[d])
        values.push(dates[d])
    }

    clearSelect(select)
    fillSelect(select, texts, values)

    $("#mapDateSelector").change( function() {
        /** Listener for the date selector on the individual mapStats modal. */
        updateMap()
    })

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
        
        if(document.getElementById('heatMapCheckBox').checked){
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
    checkBox.setAttribute('id','heatMapCheckBox')
    checkBox.setAttribute('name','heatMapCheckBox')
    checkBox.checked = false
    checkBoxDiv.appendChild(checkBox)

    checkBoxLabel = document.createElement('label')
    checkBoxLabel.setAttribute('class','custom-control-label')
    checkBoxLabel.setAttribute('for','heatMapCheckBox')
    checkBoxLabel.innerHTML = 'Show Heat Map'
    checkBoxDiv.appendChild(checkBoxLabel)

    $("#heatMapCheckBox").change( function() {
        updateMap()
    });
        
}



function updateMap(){
    /** Updates the map based on the date selector and heat map checkbox. */
    traps = []
    if (select.value == '0'){
        for (let i=0;i<markers.length;i++) {
            if (!mapStats.hasLayer(markers[i])) {
                mapStats.addLayer(markers[i])
            }
        }

        if (document.getElementById('heatMapCheckBox').checked) {
            mapStats.removeLayer(heatmapLayer)
            data = {
                'data' : hm_data,
                'max': individualImages.length
            }
            heatmapLayer.setData(data)
            mapStats.addLayer(heatmapLayer)
        }else{
            mapStats.removeLayer(heatmapLayer)
        }

    }
    else  {
        
        for (i in individualImages){
            if(individualImages[i].timestamp.includes(select.value)){
                if(!traps.includes(individualImages[i].trapgroup.tag)){
                    traps.push(individualImages[i].trapgroup.tag)
                }
            }
        }

        for (let i=0;i<markers.length;i++) {
            for (let t=0;t<traps.length;t++) {
                if(markers[i]._popup._content == traps[t]){
                    if (!mapStats.hasLayer(markers[i])) {
                        mapStats.addLayer(markers[i])
                    }
                }
                else{
                    if (mapStats.hasLayer(markers[i])) {
                        mapStats.removeLayer(markers[i])
                    }
                }
            }
                
        }

        if (document.getElementById('heatMapCheckBox').checked) {
            mapStats.removeLayer(heatmapLayer)
            filteredArray = hm_data.filter((item) => traps.includes(item.tag));
            data = {
                'data' : filteredArray,
                'max': individualImages.length
            }
            heatmapLayer.setData(data)
            mapStats.addLayer(heatmapLayer)
        }else{
            mapStats.removeLayer(heatmapLayer)
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

function deleteIndividual() {
    /** Deletes the selected individual. */
    modalAlertIndividuals.modal('hide')
    cleanModalIndividual()
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply=='success') {
                getIndividuals(current_page)
            }
        }
    }
    xhttp.open("GET", '/deleteIndividual/'+selectedIndividual.toString());
    xhttp.send();
}

function removeImage() {
    /** Removes the currently displayed individual from the selected individual. */
    modalAlertIndividuals.modal('hide')
    modalIndividual.modal({keyboard: true});
    if (individualImages.length > 1){
        image = individualImages[individualSplide.index]
        detection = image.detections[0]
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if (reply.status=='success') {
                    index = individualImages.indexOf(image);
                    if (index > -1) {
                        individualImages.splice(index, 1);
                    }
                    updateSlider()
                    individualSplide.go(0)
                }
            }
        }
        xhttp.open("GET", '/dissociateDetection/'+detection.id.toString()+'?individual_id='+selectedIndividual.toString());
        xhttp.send();
    }
    
}


function buildSurveySelect(){
    /** Builds the selectors for the surveys and annotation sets */
    if(modalActive){
        IDNum = getIdNumforNext('idSurveySelect1-')
        surveySelect = document.getElementById('surveySelect1')

        row = document.createElement('div')
        row.classList.add('row')
        surveySelect.appendChild(row)

        col1 = document.createElement('div')
        col1.classList.add('col-lg-4')
        row.appendChild(col1)

        col2 = document.createElement('div')
        col2.classList.add('col-lg-4')
        row.appendChild(col2)

        col3 = document.createElement('div')
        col3.classList.add('col-lg-2')
        row.appendChild(col3)
    }
    else{
        IDNum = getIdNumforNext('idSurveySelect-')
        surveySelect = document.getElementById('surveySelect')

        row = document.createElement('div')
        row.classList.add('row')
        surveySelect.appendChild(row)

        col1 = document.createElement('div')
        col1.classList.add('col-lg-10')
        row.appendChild(col1)

        col3 = document.createElement('div')
        col3.classList.add('col-lg-2')
        row.appendChild(col3)
    }

    if (IDNum > 0 && !modalActive) {
        col1.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }

    idSurveySelect = document.createElement('select')
    idSurveySelect.classList.add('form-control')
    if(modalActive){
        idSurveySelect.id = 'idSurveySelect1-'+String(IDNum)
    }
    else{
        idSurveySelect.id = 'idSurveySelect-'+String(IDNum)
    }
    idSurveySelect.name = idSurveySelect.id
    col1.appendChild(idSurveySelect)

    idTaskSelect = document.createElement('select')
    idTaskSelect.classList.add('form-control')
    if(modalActive){
        idTaskSelect.id = 'idTaskSelect1-'+String(IDNum)
    }
    else{
        idTaskSelect.id = 'idTaskSelect-'+String(IDNum)
    }
    idTaskSelect.name = idTaskSelect.id
    if(modalActive){
        col2.appendChild(idTaskSelect)
    }
    else{
        col1.appendChild(idTaskSelect)
    }

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
        btnRemove.classList.add('btn');
        btnRemove.classList.add('btn-info');
        btnRemove.innerHTML = '&times;';
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.remove();
            checkSurvey()
            if(!(modalLaunchID).is(':visible')){
                getIndividuals(current_page)
            }
        });
        col3.appendChild(btnRemove);
    }

    $("#"+idSurveySelect.id).change( function(wrapIDNum) {
        return function() {
            if(modalActive){
                idSurveySelect = document.getElementById('idSurveySelect1-'+String(wrapIDNum))
                idTaskSelect = document.getElementById('idTaskSelect1-'+String(wrapIDNum))
            }
            else{
                idSurveySelect = document.getElementById('idSurveySelect-'+String(wrapIDNum))
                idTaskSelect = document.getElementById('idTaskSelect-'+String(wrapIDNum))
            }
            
            survey = idSurveySelect.options[idSurveySelect.selectedIndex].value
            if (survey=="0") {
                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, [''], ['0'])
                checkSurvey()
                if(!(modalLaunchID).is(':visible')){
                    getIndividuals()
                }
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
                            if(!(modalLaunchID).is(':visible')){
                                getIndividuals()
                            }
                            
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
        if(!(modalLaunchID).is(':visible')){
            getIndividuals()
        }
    })
    
}


function addSurvey(){
    /** Initialises the survey selectors  */
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

    if(modalActive){
        addSurveyTask = document.getElementById('addSurveyTask1')
    }
    else{
        addSurveyTask = document.getElementById('addSurveyTask')
    }
    row = document.createElement('div')
    row.classList.add('row')
    addSurveyTask.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-2')
    row.appendChild(col)

    btnAdd = document.createElement('button');
    btnAdd.classList.add('btn');
    btnAdd.classList.add('btn-info');
    btnAdd.innerHTML = '&plus;';
    btnAdd.addEventListener('click', ()=>{
        buildSurveySelect()
        checkSurvey()
        if(!(modalLaunchID).is(':visible')){
            getIndividuals()
        }

    });
    col.appendChild(btnAdd);

}


function launchID(){
    /** Launch Individual ID accross surveys modal */
    modalLaunchID.modal({keyboard: true});
}

function checkSurvey(){
    /** Checks that the slected surveys and annotation sets are valid */

    var duplicateTask = false
    var surveyAll = false
    var oneSurvey = false
    legalSurvey = false
    
    
    if(modalActive){
        surveyErrors = document.getElementById('surveysErrors1')
        allTasks = document.querySelectorAll('[id^=idTaskSelect1-]')
        allSurveys = document.querySelectorAll('[id^=idSurveySelect1-]') 
    }
    else{
        surveyErrors = document.getElementById('surveysErrors')
        allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
        allSurveys = document.querySelectorAll('[id^=idSurveySelect-]') 
    }
    
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
        oneSurvey = true
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

    if(oneSurvey){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You cannot complete individual ID for only one survey. Please add additional surveys or select "All" surveys.'
        surveyErrors.appendChild(newdiv)
    }

    

    if (duplicateTask||surveyAll||oneSurvey) {
        legalSurvey = false
    } else {
        legalSurvey = true
    }
}

function initialiseStats(){
    /** Initialises the stats for an individual*/
    statisticsDiv = document.getElementById('statisticsDiv')
    while(statisticsDiv.firstChild){
        statisticsDiv.removeChild(statisticsDiv.firstChild)
    }   

    statsSelect = document.getElementById('statsSelect')
    if(statsSelect.value == '1'){
        statisticsDiv.appendChild(document.createElement('br'))
    }
    else if(statsSelect.value == '2'){
        // indivMapDiv = document.createElement('indivMapDiv')
        statisticsDiv.appendChild(document.createElement('br'))
        createIndivMap()
    }
    else if(statsSelect.value == '3'){
        statisticsDiv.appendChild(document.createElement('br'))
    }
    
}

$('#statsSelect').on('change', function() {
    /** Changes the stats for an individual */
    initialiseStats()
});

modalLaunchID.on('shown.bs.modal', function(){
    /** Initialises the launchID modal */
    modalActive = true
    addSurvey()
    checkSurvey()
    populateSpecies()

    individualLevel = document.getElementById('individualLevel')
    while(individualLevel.firstChild){
        individualLevel.removeChild(individualLevel.firstChild);
    }

    // ID stage
    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Identification Stage'
    individualLevel.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Select the stage of individual identification you would like to launch.</i>'
    individualLevel.appendChild(div)

    row = document.createElement('div')
    row.classList.add('row')
    individualLevel.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    row.appendChild(col1)

    input = document.createElement('select')
    input.classList.add('form-control')
    input.setAttribute('id','idStage')
    col1.appendChild(input)

    fillSelect(input, ['Inter-cluster Identification', 'Exhaustive'], ['-5','-5'])

    col1.appendChild(document.createElement('br'))

    individualOptionsDiv = document.createElement('div')
    individualOptionsDiv.setAttribute('id','individualOptionsDiv')
    individualLevel.appendChild(individualOptionsDiv)

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Algorithm'
    individualOptionsDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Select the algorithm you wish to use as an aid in individual identification.</i>'
    individualOptionsDiv.appendChild(div)

    row = document.createElement('div')
    individualOptionsDiv.appendChild(row)

    radio = document.createElement('div')
    radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    row.appendChild(radio)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','hotspotter')
    input.setAttribute('name','algorithmSelection')
    input.setAttribute('value','customEx')
    radio.appendChild(input)

    label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','hotspotter')
    label.innerHTML = 'Hotspotter'
    radio.appendChild(label)
    
    radio = document.createElement('div')
    radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    row.appendChild(radio)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','heuristic')
    input.setAttribute('name','algorithmSelection')
    input.setAttribute('value','customEx')
    radio.appendChild(input)

    label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','heuristic')
    label.innerHTML = 'Heuristic Only (None)'
    radio.appendChild(label)

    individualOptionsDiv.appendChild(document.createElement('br'))
      

    
})

modalLaunchID.on('hidden.bs.modal', function(){
    /** Clears the launchID modal */
    addSurveyTask = document.getElementById('addSurveyTask1')
    while(addSurveyTask.firstChild){
        addSurveyTask.removeChild(addSurveyTask.firstChild);
    }
    surveySelect = document.getElementById('surveySelect1')
    while(surveySelect.firstChild){
        surveySelect.removeChild(surveySelect.firstChild);
    }
    individualLevel = document.getElementById('individualLevel')
    while(individualLevel.firstChild){
        individualLevel.removeChild(individualLevel.firstChild);
    }
    modalActive = false
    getIndividuals(current_page)
})

document.getElementById('editNotes').addEventListener('click', ()=>{
    /** Submits the entered notes for specified individual */
    var newNote = document.getElementById('idNotes').value

    if(newNote.length > 512)
    {
        document.getElementById('notesError').innerHTML = "A note cannot be more than 512 characters."
    }
    else{
        document.getElementById('notesError').innerHTML = ''

        var formData = new FormData()
        formData.append("individual_id", JSON.stringify(selectedIndividual))
        formData.append("note", JSON.stringify(newNote))
        formData.append("type", JSON.stringify('individual'))

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/assignNote');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                document.getElementById('idNotes').value = newNote
                currentNote = newNote                   
            }
        }
        xhttp.send(formData);
    }  
})

document.getElementById('editName').addEventListener('click', ()=>{
    document.getElementById('editNameDiv').hidden = false
    document.getElementById('editName').hidden = true
    document.getElementById('newIndividualName').value = document.getElementById('individualName').innerHTML
})

document.getElementById('btnSubmitName').addEventListener('click', ()=>{
    /** Submits the entered name for specified individual */
    var newName = document.getElementById('newIndividualName').value
    if(newName == ''){
        document.getElementById('newNameErrors').innerHTML = 'Name cannot be blank'
    }
    else if(newName == document.getElementById('individualName').innerHTML){
        document.getElementById('editNameDiv').hidden = true
        document.getElementById('editName').hidden = false
    }
    else{
        var formData = new FormData()
        formData.append("individual_id", JSON.stringify(selectedIndividual))
        formData.append("name", JSON.stringify(newName))

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/editIndividualName');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                if (reply.status == 'success'){
                    document.getElementById('individualName').innerHTML = newName
                    document.getElementById('editNameDiv').hidden = true
                    document.getElementById('editName').hidden = false
                    document.getElementById('newNameErrors').innerHTML = ''
                }
                else{
                    document.getElementById('newNameErrors').innerHTML = reply.status
                }
            }
        }
        xhttp.send(formData);
    }
})

$('.modal').on("hidden.bs.modal", function (e) { 
    if ($('.modal:visible').length) { 
        $('body').addClass('modal-open');
    }
});

$('#orderSelect').change( function() {
    /** Listens for changes in the ordering and updates the page accordingly. */
    getIndividuals()
});

$('#individualSearch').change( function() {
    /** Listens for changes in the worker search bar and updates the page accordingly. */
    getIndividuals()
});

function onload(){
    /**Function for initialising the page on load.*/
    addSurvey()
    checkSurvey()
    populateSpecies()
    populateTags()
    populateTraps()
}

window.addEventListener('load', onload, false);


