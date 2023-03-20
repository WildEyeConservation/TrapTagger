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
const modalEditTags = $('#modalEditTags');

var modalAlertIndividualsReturn = false
var modalEditNameReturn = false
var modalEditNotesReturn = false
var modalEditTagsReturn = false
var individualSplide = null
var map = null
var displayedIndividuals = null
var legalSurvey = false
var tasks = []
var currentNote = ''
var globalTags = null
var globalLabels = null

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
    checkSurvey()
    tasks = []

    console.log(globalTags)

    allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    for (let i=0;i<allTasks.length;i++) {
        if (allTasks[i].value != '-99999'){
            tasks.push(allTasks[i].value)
        }     
    }

    if(legalSurvey && !modalActive){
        selectedSpecies = document.getElementById('individualSpeciesSelector').value
    indexSpecies = document.getElementById('individualSpeciesSelector').selectedIndex
    selectedSpeciesText = document.getElementById('individualSpeciesSelector')[indexSpecies].text

    var formData = new FormData()
    formData.append("task_ids", JSON.stringify(tasks))
    formData.append("species_name", JSON.stringify(selectedSpecies))
    
    request = '/getAllIndividuals'
    if (page != null) {
        request += '?page='+page.toString()
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
                        selectedIndividual = individualID
                        var xhttp = new XMLHttpRequest();
                        xhttp.onreadystatechange =
                        function(){
                            if (this.readyState == 4 && this.status == 200) {
                                individualImages = JSON.parse(this.responseText);

                                document.getElementById('individualName').innerHTML = individualName
                    
                                document.getElementById('tgInfo').innerHTML = 'Trap: ' + individualImages[0].trapgroup
                                document.getElementById('timeInfo').innerHTML = individualImages[0].timestamp

                                

                                center = document.getElementById('centerMap')
                                while(center.firstChild){
                                    center.removeChild(center.firstChild)
                                }

                                mapDiv = document.createElement('div')
                                mapDiv.setAttribute('id','mapDiv')
                                mapDiv.setAttribute('style','height: 800px')
                                center.appendChild(mapDiv)

                                var xhttp = new XMLHttpRequest();
                                xhttp.onreadystatechange =
                                function(){
                                    if (this.readyState == 4 && this.status == 200) {
                                        info = JSON.parse(this.responseText);
                                        console.log(info)
                                        if (info != "error"){
                                            labels = document.getElementById('idLabels')
                                            tags = document.getElementById('idTags')
                                            note = document.getElementById('idNotes')
                                            labels.innerHTML = "Label: " + info.label
                                            tags.innerHTML= "Tags: " + info.tags
                                            note.value= info.notes
                                            currentNote = info.notes
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


                                document.getElementById('editName').addEventListener('click', ()=>{
                                    modalEditNameReturn = true
                                    modalIndividual.modal('hide')
                                    modalEditName.modal({keyboard: true})
                                })

                                document.getElementById('editNotes').addEventListener('click', ()=>{
                                    modalEditNotesReturn = true
                                    modalIndividual.modal('hide')
                                    modalEditNotes.modal({keyboard: true})
                                })

                                document.getElementById('editTags').addEventListener('click', ()=>{
                                    modalEditTagsReturn = true
                                    modalIndividual.modal('hide')
                                    modalEditTags.modal({keyboard: true})
                                })



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

                                modalIndividual.modal({keyboard: true});
                            }
                        }
                        xhttp.open("GET", '/getIndividual/'+individualID);
                        xhttp.send();
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
                document.getElementById('tgInfo').innerHTML = "Trap: " + image.trapgroup
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
}

modalIndividual.on('hidden.bs.modal', function(){
    /** Clears the individual modal when closed. */
    if (modalAlertIndividualsReturn) {
        modalAlertIndividualsReturn = false
    } 
    else if (modalEditNameReturn) {
        modalEditNameReturn = false
    }
    else if(modalEditNotesReturn){
        modalEditNotesReturn = false
    }
    else if(modalEditTagsReturn){
        modalEditTagsReturn = false
    }
    else if(helpReturn){
        helpReturn = false
    }
    else {
        cleanModalIndividual()
        getIndividuals()
    }
});

modalIndividual.on('shown.bs.modal', function(){
    /** Initialises the individual modal when opened. */
    if (map==null) {
        prepMap(individualImages[0])
        updateSlider()
    }
});

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
                getIndividuals()
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
    }
    else{
        IDNum = getIdNumforNext('idSurveySelect-')
        surveySelect = document.getElementById('surveySelect')
    }

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
    col2.appendChild(idTaskSelect)

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
                getIndividuals()
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
    getIndividuals()
})

modalEditName.on('hidden.bs.modal', function(){
    /** Clears the editName modal */
    document.getElementById('newNameErrors').innerHTML = ''
    document.getElementById('newIndividualName').value = ''
            
    modalIndividual.modal({keyboard: true});
})

modalEditName.on('shown.bs.modal', function(){
    /** Initialises the editName modal */
    document.getElementById('newNameErrors').innerHTML = ''
    document.getElementById('newIndividualName').value = ''
    document.getElementById('newIndividualName').focus()
})

modalEditNotes.on('hidden.bs.modal', function(){
    /** Clears the editNotes modal */
    document.getElementById('newNoteErrors').innerHTML = ''
    document.getElementById('noteboxIndividual').value = ''
            
    modalIndividual.modal({keyboard: true});
})

modalEditNotes.on('shown.bs.modal', function(){
    /** Initialises the editNotes modal */
    document.getElementById('newNoteErrors').innerHTML = ''
    document.getElementById('noteboxIndividual').value = currentNote
    document.getElementById('noteboxIndividual').focus()

})

modalEditTags.on('hidden.bs.modal', function(){
    /** Clears the editTags modal */
    tagsDiv  = document.getElementById('tagsDiv')
    while(tagsDiv.firstChild){
        tagsDiv.removeChild(tagsDiv.firstChild)
    }    
    modalIndividual.modal({keyboard: true});
    
})

modalEditTags.on('shown.bs.modal', function(){
    /** Initialises the editTags modal */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            tags = JSON.parse(this.responseText);  
            globalTags = tags
            console.log(tags)
            if(tags){
                tagsDiv  = document.getElementById('tagsDiv')
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
                }
            }
            
        }
    }
    xhttp.open("GET", '/getTags/' +  selectedIndividual);
    xhttp.send();  
})

document.getElementById('btnCancelName').addEventListener('click', ()=>{
    modalEditName.modal('hide')
})

document.getElementById('btnCancelIndivNotes').addEventListener('click', ()=>{
    modalEditNotes.modal('hide')
})

document.getElementById('btnCancelIndivTags').addEventListener('click', ()=>{
    modalEditTags.modal('hide')
})

document.getElementById('btnSubmitName').addEventListener('click', ()=>{
    /** Submits the entered name for specified individual */
    var newName = document.getElementById('newIndividualName').value

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
                modalEditName.modal('hide')
                document.getElementById('individualName').innerHTML = newName
            }
            else{
                document.getElementById('newNameErrors').innerHTML = reply.status
            }
            
        }
    }
    xhttp.send(formData);
})

document.getElementById('btnSubmitIndivNotes').addEventListener('click', ()=>{
    /** Submits the entered notes for specified individual */
    var newNote = document.getElementById('noteboxIndividual').value

    if(newNote.length > 512)
    {
        document.getElementById('newNoteErrors').innerHTML = "A note cannot be more than 512 characters."
    }
    else{
        document.getElementById('newNoteErrors').innerHTML = ''

        var formData = new FormData()
        formData.append("individual_id", JSON.stringify(selectedIndividual))
        formData.append("note", JSON.stringify(newNote))
        formData.append("type", JSON.stringify('individual'))

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/assignNote');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                modalEditNotes.modal('hide')
                document.getElementById('idNotes').value = newNote
                currentNote = newNote                   
            }
        }
        xhttp.send(formData);
    }  
})


document.getElementById('btnSubmitIndivTags').addEventListener('click', ()=>{
    /** Submits the selected tags for specified individual */
    var newTags = []
    for (let i=0;i<globalTags.length;i++) {
        tag = globalTags[i].tag
        box = document.getElementById(tag+ "box")
        if(box.checked){
            newTags.push(tag)
            box.checked = false 
        }
    }
    console.log(newTags)
    var formData = new FormData()
    formData.append("tags", JSON.stringify(newTags))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/submitTagsIndividual/' + selectedIndividual);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (reply == 'success'){
                modalEditTags.modal('hide')
                document.getElementById('idTags').innerHTML = "Tags: " + newTags
            }
            
        }
    }
    xhttp.send(formData);   
})


function onload(){
    /**Function for initialising the page on load.*/
    addSurvey()
    checkSurvey()
    populateSpecies()

}

window.addEventListener('load', onload, false);


