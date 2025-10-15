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
const modalIndividualsError = $('#modalIndividualsError');
const modalLaunchID = $('#modalLaunchID');
const modalDeleteIndividuals = $('#modalDeleteIndividuals');
const btnPrevTasks = document.getElementById('btnPrevTasks');
const btnNextTasks = document.getElementById('btnNextTasks');
const modalMergeIndividual = $('#modalMergeIndividual');
const modalDissociateImage = $('#modalDissociateImage');
const modalDiscard = $('#modalDiscard');
const modalUnidentifiable = $('#modalUnidentifiable');

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
var individualImages = null
var currentTags = null
var individualFirstSeen = ""
var individualLastSeen = ""
var processingTimer
var prev_url = null
var next_url = null
var allSites = null
var allIndividualImages = null
var minDate = null
var maxDate = null
var pauseControl = null
var playControl = null
var stopControl = null
var playControlImage = null
var drawnItems = null
var jobTimer
var modalDeleteActive = false
var legalDelete = false
var addedDetections = false
var finishedDisplaying = false
var fullRes = false
var mapReady = false
var activeImage = null
var rectOptions = null
var mapWidth = null
var mapHeight = null
var changed_flanks = {}
var mergeIndividualsOpened = false
var mergeMap = {'L': null, 'R': null}
var mergeActiveImage = {'L': null, 'R': null}
var mergeMapReady = {'L': false, 'R': false}
var mergeMapWidth = {'L': null, 'R': null}
var mergeMapHeight = {'L': null, 'R': null}
var mergeImages = {'L': null, 'R': null}
var mergeSplide = {'L': null, 'R': null}
var mergeImageIndex = {'L': 0, 'R': 0}
var mergeDrawnItems = {'L': null, 'R': null}
var addedDetectionsMerge = {'L': false, 'R': false}
var merge_individual_next = null
var merge_individual_prev = null
var selectedMergeIndividual = null
var selectedMergeIndividualName = null
var mergeImageOnly = false
var confirmMerge = false
var selectedIndividual = null
var selectedIndividualName = null
var mergeIndividualsFilters = {'task': null, 'mutual': null, 'search': null, 'order': null, 'tags': null, 'page': null}
var individualBounds = []
var mergeBounds = []
var individualCoords = []
var fullResMerge = {'L': false, 'R': false}
var individualBestDets = {}
var imgMaps = {}
var imgMapsHeight = {}
var imgMapsWidth = {}
var imgMapsActiveImage = {}
var drawnFeatureItems = {}
var leafletFeatureIDs = {}
var featureDrawControl = {}
var editingEnabled = false
var globalFeatures = {}
var individualFlankImages = {}
var flankImageIndex = {'L': 0, 'R': 0 }
var imgMapsFullRes = {}
var tabActiveIndiv = 'baseIndivSummaryTab'
var associationClick = false
var associationID = null
var associationName = null
var unsavedChanges = false
var convexHullPolygon = null
var unidentifiableOpen = false
var individualTasks = []

function getIndividuals(page = null) {
    /** Gets a page of individuals. Gets the first page if none is specified. */
    tasks = []
    
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

        if(tasks.length == 0){
            tasks = ['0']
        }
        selectedLabel = document.getElementById('individualSpeciesSelector').value
        if(selectedLabel == ''){
            selectedLabel = '0'
        }
        selectedTag = document.getElementById('individualTagSelector').value
        if(selectedTag == ''){
            selectedTag = 'None'
        }
        selectedSite = document.getElementById('sitesSelector').value
        if(selectedSite == ''){
            selectedSite = '0'
        }
        selectedStartDate = document.getElementById('startDate').value 
        selectedEndDate = document.getElementById('endDate').value 


        if(selectedStartDate != ''){
            selectedStartDate = selectedStartDate + ' 00:00:00'
        }
        else{
            selectedStartDate = ''
        }

        if(selectedEndDate != ''){
            selectedEndDate = selectedEndDate + ' 23:59:59'
        }
        else{
            selectedEndDate = ''
        }

        var formData = new FormData()
        formData.append("task_ids", JSON.stringify(tasks))
        formData.append("species_name", JSON.stringify(selectedLabel))
        formData.append("tag_name", JSON.stringify(selectedTag))
        formData.append("trap_name", JSON.stringify(selectedSite))
        formData.append('start_date', JSON.stringify(selectedStartDate))
        formData.append('end_date', JSON.stringify(selectedEndDate))
        formData.append("area", JSON.stringify(document.getElementById('areaSelect').value))

        request = '/getAllIndividuals'
        if (page != null) {
            current_page = page
            request += '?page='+page.toString()
            order = orderSelect.options[orderSelect.selectedIndex].value
            request += '&order='+order.toString() 
        }
        else{
            current_page = 1
            order = orderSelect.options[orderSelect.selectedIndex].value
            request += '?order='+order.toString()     
        }
        
        search = document.getElementById('individualSearch').value
        formData.append("search", JSON.stringify(search))

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", request);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                // console.log(reply)
                individuals = reply.individuals
                individualsDiv = document.getElementById('individualsDiv')

                
                while(individualsDiv.firstChild){
                    individualsDiv.removeChild(individualsDiv.firstChild);
                }

                for (let mapID in mergeMap) {
                    if (mapID.includes('indivImageDiv') && mergeMap[mapID] != null) {
                        mergeMap[mapID].remove()
                        mergeMap[mapID] = null
                    }
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
                        // if not the last row, add a break
                        if (i < (individuals.length-4)) {
                            individualsDiv.appendChild(document.createElement('br'))
                        }
                    }

                    col = document.createElement('div')
                    col.classList.add('col-lg-3')
                    row.appendChild(col)

                    // var center = document.createElement('center')
                    // col.appendChild(center)

                    // let div = document.createElement('div')
                    // div.id = 'indivImageDiv'+i
                    // center.appendChild(div)
    
                    // prepImageMap('indivImageDiv'+i, newIndividual.url, newIndividual.detection, 14.10)

                    image = document.createElement('img')
                    image.setAttribute('width','100%')
                    image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCropURL(newIndividual.url, newIndividual.detection.id)

                    image.style.cursor = 'pointer'
                    image.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'
                    image.style.borderRadius = '4px'

                    image.addEventListener('mouseover', function() {
                        this.style.boxShadow = '0 8px 16px 0 rgba(0, 0, 0, 0.2), 0 12px 40px 0 rgba(0, 0, 0, 0.19)'
                        this.style.transform = 'scale(1.03)'
                    });

                    image.addEventListener('mouseout', function() {
                        this.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'
                        this.style.transform = 'scale(1)'
                    });

                    col.appendChild(image)

                    image.addEventListener('error', function(wrapURL) {
                        return function() {
                            this.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(wrapURL)
                        }
                    }(newIndividual.url));

                    h5 = document.createElement('h5')
                    h5.setAttribute('align','center')
                    h5.innerHTML = newIndividual.name
                    col.appendChild(h5)

                    image.addEventListener('click', function(individualID,individualName){
                        return function() {
                            // getIndividual(individualID,individualName)
                            cleanModalIndividual()
                            selectedIndividual = individualID
                            selectedIndividualName = individualName
                            document.getElementById('openIndivSummary').click()
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

function getIndividualInfo(individualID){
    /** Gets the specified individual's information and display's it */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            info = JSON.parse(this.responseText);
            // console.log(info)
            if (info != "error"){
                document.getElementById('labelsDiv').innerHTML = info.label

                document.getElementById('idNotes').value= info.notes
                currentNote = info.notes
                document.getElementById('notesError').innerHTML = ''

                while(surveysDiv.firstChild){
                    surveysDiv.removeChild(surveysDiv.firstChild)
                }

                individualTasks = info.surveys
                surveysDiv = document.getElementById('surveysDiv')                           
                for(let i=0;i<info.surveys.length;i++){
                    survey = info.surveys[i]
                    surveyDiv = document.createElement('div')
                    surveyDiv.innerHTML = survey
                    surveysDiv.appendChild(surveyDiv)
                }

                firstSeen = info.seen_range[0]
                individualFirstSeen = firstSeen
                lastSeen = info.seen_range[1]
                individualLastSeen = lastSeen

                if(firstSeen){
                    document.getElementById('firstSeenDiv').innerHTML =  firstSeen
                    minDate = firstSeen.split(' ')[0].replace(/\//g, '-')
                }

                if(lastSeen){
                    document.getElementById('lastSeenDiv').innerHTML = lastSeen
                    maxDate = lastSeen.split(' ')[0].replace(/\//g, '-')
                }

                document.getElementById('startDateIndiv').setAttribute('min', minDate)
                document.getElementById('endDateIndiv').setAttribute('min', minDate)
                document.getElementById('startDateIndiv').setAttribute('max', maxDate)
                document.getElementById('endDateIndiv').setAttribute('max', maxDate)

                individual_tags = info.tags
                currentTags = [...new Set(individual_tags)]
                for (let i=0;i<globalTags.length;i++) {
                    tag = globalTags[i].tag
                    box = document.getElementById(tag+ "box")
                    if (individual_tags.includes(tag)){
                        box.checked = true
                    } else {                    
                        box.checked = false
                    }

                    if (info.access == 'write'){
                        box.onclick = function(){
                            return true
                        }
                    }
                    else{
                        box.onclick = function(){
                            return false
                        }
                    }
                }

                individualBounds = info.bounds

                individualBestDets = info.best_dets

                if (individualAccess == 'write'){
                    document.getElementById('newIndividualName').readOnly = false
                    document.getElementById('idNotes').readOnly = false
                    document.getElementById('btnDelIndiv').disabled = false
                    document.getElementById('btnSubmitInfoChange').disabled = false
                    document.getElementById('btnMergeIndiv').disabled = false
                    if (individualImages.length == 1){
                        document.getElementById('btnRemoveImg').disabled = true
                        // document.getElementById('btnMergeImg').disabled = true
                    }
                    else{
                        document.getElementById('btnRemoveImg').disabled = false
                        // document.getElementById('btnMergeImg').disabled = false
                    }
                    document.getElementById('btnIndivUnidentifiable').disabled = false
                }
                else{
                    document.getElementById('newIndividualName').readOnly = true
                    document.getElementById('newIndividualName').style.backgroundColor = 'white'
                    document.getElementById('idNotes').readOnly = true
                    document.getElementById('btnDelIndiv').disabled = true
                    document.getElementById('btnRemoveImg').disabled = true
                    document.getElementById('btnSubmitInfoChange').disabled = true
                    // document.getElementById('btnMergeImg').disabled = true
                    document.getElementById('btnMergeIndiv').disabled = true
                    document.getElementById('btnIndivUnidentifiable').disabled = true
                }

            }

            // initialiseStats()
            // initFeatureMaps()
        }
    }
    xhttp.open("GET", '/getIndividualInfo/'+individualID);
    xhttp.send();

}

function getIndividual(individualID, individualName, association=false, order_value='a1', site='0', start_date='', end_date=''){
    /** Gets the specified individual*/
   
    selectedIndividual = individualID
    selectedIndividualName = individualName

    var formData = new FormData()
    formData.append("order", JSON.stringify(order_value))
    formData.append("site", JSON.stringify(site))
    formData.append('start_date', JSON.stringify(start_date))
    formData.append('end_date', JSON.stringify(end_date))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            individualImages = reply.individual
            individualAccess = reply.access

            if (individualAccess == 'write' || individualAccess == 'read'){
                initialiseMapAndSlider()
                var sites = []
                if(order_value == 'a1' && site == '0' && start_date == '' && end_date == ''){
                    allIndividualImages = individualImages
                    allSites = []
                    var valueExists = false
                    for (let i=0;i<allIndividualImages.length;i++) {
                        for (let j=0;j<allSites.length;j++) {
                            if(allIndividualImages[i].trapgroup.tag == allSites[j].tag){
                                valueExists = true
                                break
                            }
                            else{
                                valueExists = false
                            }
                        }

                        if(!valueExists){
                            allSites.push(allIndividualImages[i].trapgroup)
                            sites.push(allIndividualImages[i].trapgroup.tag)
                        }
                    }
                }
                else{
                    for(let i = 0; i < allSites.length; i++){
                        sites.push(allSites[i].tag)
                    }
                }

                texts = ['All']
                texts.push(...sites)
                values = ['0']
                values.push(...sites)
                clearSelect(document.getElementById('sitesIndividualSelector'))
                fillSelect(document.getElementById('sitesIndividualSelector'), texts, values)

                if(individualImages.length > 0){
                    document.getElementById('individualName').innerHTML = individualName
                    document.getElementById('newIndividualName').value = individualName

                    document.getElementById('tgInfo').innerHTML = 'Site: ' + individualImages[0].trapgroup.tag
                    document.getElementById('timeInfo').innerHTML = individualImages[0].timestamp     

                    individualTags(individualID)

                    if (individualAccess == 'write'){
                        if (individualImages.length == 1){
                            document.getElementById('btnRemoveImg').disabled = true
                            // document.getElementById('btnMergeImg').disabled = true
                        }
                        else{
                            document.getElementById('btnRemoveImg').disabled = false
                            // document.getElementById('btnMergeImg').disabled = false
                        }
                        document.getElementById('btnSubmitInfoChange').disabled = false
                        document.getElementById('btnDelIndiv').disabled = false
                        document.getElementById('btnMergeIndiv').disabled = false
                        document.getElementById('btnIndivUnidentifiable').disabled = false
                    } else {
                        document.getElementById('btnRemoveImg').disabled = true
                        document.getElementById('btnDelIndiv').disabled = true
                        document.getElementById('btnSubmitInfoChange').disabled = true
                        document.getElementById('btnMergeIndiv').disabled = true
                        document.getElementById('btnIndivUnidentifiable').disabled = true
                    }

                    document.getElementById('btnDelIndiv').addEventListener('click', ()=>{
                        removeIndividualEventListeners()
                        if (individualImages.length > 1){
                            document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                            document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently delete this individual?'
                            document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','deleteIndividual()')
                            document.getElementById('btnCancelIndividualAlert').setAttribute('onclick','modalIndividual.modal({keyboard: true});')
                            modalAlertIndividualsReturn = true
                            modalIndividual.modal('hide')
                            modalAlertIndividuals.modal({keyboard: true});
                        }
                        else{
                            document.getElementById('modalIndividualsErrorHeader').innerHTML = 'Error'
                            document.getElementById('modalIndividualsErrorBody').innerHTML = 'You cannot delete an individual that is associated with only one detection. All detections for a species must be associated with an individual for the first stage of individual identitification to be considred complete. If you wish to start the identification process again you can select <em>Delete Individuals</em> on the Individuals page to permanently delete individuals for a particular species.'
                            document.getElementById('btnCloseIndivErrorModal').setAttribute('onclick','modalIndividual.modal({keyboard: true});')
                            modalAlertIndividualsReturn = true
                            modalIndividual.modal('hide')
                            modalIndividualsError.modal({keyboard: true});
                        }
                    });


                    document.getElementById('btnRemoveImg').addEventListener('click', ()=>{
                        removeIndividualEventListeners()
                        if (individualImages.length > 1){
                            // document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                            // document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently remove this image from this individual?'
                            // document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','removeImage()')
                            // document.getElementById('btnCancelIndividualAlert').setAttribute('onclick','modalIndividual.modal({keyboard: true});')
                            modalAlertIndividualsReturn = true
                            modalIndividual.modal('hide')
                            // modalAlertIndividuals.modal({keyboard: true});
                            document.getElementById('removeImg').checked = true
                            document.getElementById('modalDissociateTitle').innerHTML = 'Dissociate Image'
                            document.getElementById('dissociateImageInfo').innerHTML = '<i>Dissociating an image will remove the image from the individual it is currently associated with. You can either create a new individual for the image, move it to an existing individual, or mark it as unidentifiable.</i>';
                            document.getElementById('unidentifiableDiv').style.display = 'block'
                            modalDissociateImage.modal({keyboard: true});
                        }
                    });

                    document.getElementById('btnMergeIndiv').addEventListener('click', ()=>{
                        cleanupMergeIndividuals()
                        mergeIndividualsOpened = true
                        mergeImageOnly = false
                        mergeImages['L'] = individualImages
                        modalIndividual.modal('hide')
                        modalMergeIndividual.modal({keyboard: true});

                    });

                    document.getElementById('btnIndivUnidentifiable').addEventListener('click', ()=>{
                        removeIndividualEventListeners()
                        document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                        document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want mark this individual as unidentifiable? This individual will be deleted and all sightings associated with this individual will be marked as unidentifiable.'
                        document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','markUnidentifiable()')
                        document.getElementById('btnCancelIndividualAlert').setAttribute('onclick','modalIndividual.modal({keyboard: true});')
                        modalAlertIndividualsReturn = true
                        modalIndividual.modal('hide')
                        modalAlertIndividuals.modal({keyboard: true});
                    });

                    // document.getElementById('btnMergeImg').addEventListener('click', ()=>{
                    //     if (individualImages.length > 1){
                    //         cleanupMergeIndividuals()
                    //         mergeIndividualsOpened = true
                    //         mergeImageOnly = true
                    //         mergeImages['L'] = [individualImages[individualSplide.index]]
                    //         modalIndividual.modal('hide')
                    //         modalMergeIndividual.modal({keyboard: true});
                    //     }
                    // });

                    // buildAssociationTable(individualID)

                    if(association){
                        prepMapIndividual(individualImages[0])
                        updateSlider()
                    }
                    else{
                        modalIndividual.modal({keyboard: true});
                    }
                
                }
                else{
                    if(start_date != '' || end_date != ''){
                        document.getElementById('dateErrorsIndiv').innerHTML = 'No images available for this date range. Please select another date range.'
                    }
                    
                }   
            }
            else{
                modalIndividual.modal('hide')
            }

        }
    }
    xhttp.open("POST", '/getIndividual/'+individualID);
    xhttp.send(formData)
}

function updateIndividual(individualID, individualName, order_value = 'a1', site='0', start_date='', end_date=''){
    selectedIndividual = individualID
    selectedIndividualName = individualName

    var formData = new FormData()
    formData.append("order", JSON.stringify(order_value))
    formData.append("site", JSON.stringify(site))
    formData.append('start_date', JSON.stringify(start_date))
    formData.append('end_date', JSON.stringify(end_date))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            individualImages = reply.individual
            individualAccess = reply.access
            // console.log(individualImages)
            if (individualAccess == 'write' || individualAccess == 'read'){

                if(individualImages.length > 0){
                    document.getElementById('tgInfo').innerHTML = 'Site: ' + individualImages[0].trapgroup.tag
                    document.getElementById('timeInfo').innerHTML = individualImages[0].timestamp

                    if (individualAccess == 'write'){
                        if (individualImages.length == 1){
                            document.getElementById('btnRemoveImg').disabled = true
                            // document.getElementById('btnMergeImg').disabled = true
                        }
                        else{
                            document.getElementById('btnRemoveImg').disabled = false
                            // document.getElementById('btnMergeImg').disabled = false
                        }
                        document.getElementById('btnSubmitInfoChange').disabled = false
                        document.getElementById('btnDelIndiv').disabled = false
                        document.getElementById('btnMergeIndiv').disabled = false
                        document.getElementById('btnIndivUnidentifiable').disabled = false
                    } else {
                        document.getElementById('btnRemoveImg').disabled = true
                        document.getElementById('btnDelIndiv').disabled = true
                        document.getElementById('btnSubmitInfoChange').disabled = true
                        document.getElementById('btnMergeIndiv').disabled = true
                        document.getElementById('btnIndivUnidentifiable').disabled = true 
                    }

                    initialiseMapAndSlider()
                    prepMapIndividual(individualImages[0])
                    updateSlider()        
                    
                }
                else{
                    if(start_date != '' || end_date != ''){
                        document.getElementById('dateErrorsIndiv').innerHTML = 'No images available for this date range. Please select another date range.'
                    }
                    
                }   
            }
            else{
                modalIndividual.modal('hide')
            }

        }
    }
    xhttp.open("POST", '/getIndividual/'+individualID);
    xhttp.send(formData)
}

function initialiseMapAndSlider(){
    /** Creates map and slider to diplay individual images */
    map = null
    individualSplide = null

    center = document.getElementById('centerMap')
    while(center.firstChild){
        center.removeChild(center.firstChild)
    }

    mapDiv = document.createElement('div')
    mapDiv.setAttribute('id','mapDiv')
    mapDiv.setAttribute('style','height: 800px')
    center.appendChild(mapDiv)


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

    var leftFeatureMap = document.getElementById('leftFeatureMap')
    while(leftFeatureMap.firstChild){
        leftFeatureMap.removeChild(leftFeatureMap.firstChild);
    }

    var rightFeatureMap = document.getElementById('rightFeatureMap')
    while(rightFeatureMap.firstChild){
        rightFeatureMap.removeChild(rightFeatureMap.firstChild);
    }

    var leftFeatureMapDiv = document.createElement('div')
    leftFeatureMapDiv.setAttribute('id','leftFeatureMapDiv')
    leftFeatureMapDiv.setAttribute('style','height: 400px')
    leftFeatureMap.appendChild(leftFeatureMapDiv)

    var rightFeatureMapDiv = document.createElement('div')
    rightFeatureMapDiv.setAttribute('id','rightFeatureMapDiv')
    rightFeatureMapDiv.setAttribute('style','height: 400px')
    rightFeatureMap.appendChild(rightFeatureMapDiv)

}

function individualTags(individual_id){
    /*Create checkboxes for individual's tags*/
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
            if(tags){
                for (let i=0;i<tags.length;i++) {
                    tag = tags[i].tag
                    hotkey = tags[i].hotkey

                    checkDiv = document.createElement('div')
                    checkDiv.setAttribute('class','custom-control custom-checkbox')
                    checkDiv.setAttribute('style','display: inline-block; padding-right: 0.5rem')
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

                    input.addEventListener('click', function() {
                        unsavedChanges = true
                    });

                }
            }
            
            getIndividualInfo(individual_id)
        }
    }
    xhttp.open("GET", '/getTags/' +  individual_id);
    xhttp.send();  
}

function submitIndividualTags(){
    /** Submits the selected tags for specified individual */
    var newTags = []
    var tagsChanged = false
    for (let i=0;i<globalTags.length;i++) {
        tag = globalTags[i].tag
        box = document.getElementById(tag+ "box")
        if(box.checked){
            newTags.push(tag)
            if(!currentTags.includes(tag)){
                tagsChanged = true
            }
        }
        else{
            if(currentTags.includes(tag)){
                tagsChanged = true
            }
        }
    }

    if(tagsChanged){

        var formData = new FormData()
        formData.append("tags", JSON.stringify(newTags))

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/submitTagsIndividual/' + selectedIndividual);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                currentTags = newTags
            }
        }
        xhttp.send(formData);   
    }
}

function submitIndividualName(){
    /** Submits the entered name for specified individual */
    var newName = document.getElementById('newIndividualName').value
    if(newName == ''){
        document.getElementById('newNameErrors').innerHTML = 'Name cannot be blank'
    }
    else if(newName == document.getElementById('individualName').innerHTML){
        document.getElementById('newNameErrors').innerHTML = 'Name is the same as the current name'
    }
    else if (newName.toLowerCase() == 'unidentifiable'){
        document.getElementById('newNameErrors').innerHTML = 'Reserved name. Please choose another name.'
    }
    else if(newName.includes('/')||newName.includes('\\')){
        document.getElementById('newNameErrors').innerHTML = 'Invalid name. Please choose another name.'
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

                if (reply.status == 'success'){
                    document.getElementById('individualName').innerHTML = newName
                    document.getElementById('newNameErrors').innerHTML = ''
                }
                else{
                    document.getElementById('newNameErrors').innerHTML = reply.status
                }
            }
        }
        xhttp.send(formData);
    }
}

function submitIndividualNotes(){
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
    
}

function populateSelectors(){
    /** Populates the species ,tag, and site selectors on the individuals page. */
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getAllLabelsTagsTraps');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            globalLabels = reply.labels
            if (modalActive){
                texts = []
                texts.push(...reply.labels)
                values = []
                values.push(...reply.labels)
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), texts, values)       
            }
            else{
                //Populate species selector
                texts = ['All']
                texts.push(...reply.labels)
                values = ['0']
                values.push(...reply.labels)
                clearSelect(document.getElementById('individualSpeciesSelector'))
                fillSelect(document.getElementById('individualSpeciesSelector'), texts, values)

                //Populate tag selector
                texts = ['All', 'All with Tags' ]
                texts.push(...reply.tags)
                values = ['None','All']
                values.push(...reply.tags)
                clearSelect(document.getElementById('individualTagSelector'))
                fillSelect(document.getElementById('individualTagSelector'), texts, values)

                //Populate site selector
                texts = ['All']
                texts.push(...reply.traps)
                values = ['0']
                values.push(...reply.traps)
                clearSelect(document.getElementById('sitesSelector'))
                fillSelect(document.getElementById('sitesSelector'), texts, values)

                getIndividuals()

            }
            
        }
    }
    xhttp.send();

}

$("#individualSpeciesSelector").change( function() {
    /** Listener for the species selector on the the individuals page. */
    getIndividuals()
})

$("#individualTagSelector").change( function() {
    // Listener for the tags selectors on the the individuals page.
    getIndividuals()
})

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
    }else if(modalUnidentifiable.is(':visible')){
        var dateError = document.getElementById('dateErrorsUnid')
        var startDate = document.getElementById('startDateUnid').value;
        var endDate = document.getElementById('endDateUnid').value;
    }else{
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
    // else if(startDate && !endDate) {
    //     dateError.innerHTML = 'Please enter an end date.'
    //     validDate = false;
    // }
    // else if(!startDate && endDate) {
    //     dateError.innerHTML = 'Please enter a start date.'
    //     validDate = false
    // }
    else{
        validDate = true
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

    editTagsDiv = document.getElementById('editTagsDiv')
    while(editTagsDiv.firstChild){
        editTagsDiv.removeChild(editTagsDiv.firstChild);
    }

    surveysDiv = document.getElementById('surveysDiv')
    while(surveysDiv.firstChild){
        surveysDiv.removeChild(surveysDiv.firstChild);
    }

    associationsDiv = document.getElementById('associationsDiv')
    while(associationsDiv.firstChild){
        associationsDiv.removeChild(associationsDiv.firstChild);
    }

    orderAssociationsDiv = document.getElementById('orderAssociationsDiv')	
    while(orderAssociationsDiv.firstChild){
        orderAssociationsDiv.removeChild(orderAssociationsDiv.firstChild);
    }
    orderAssociationsDiv.hidden = true

    leftFeatureMap = document.getElementById('leftFeatureMap')
    while(leftFeatureMap.firstChild){
        leftFeatureMap.removeChild(leftFeatureMap.firstChild);
    }

    rightFeatureMap = document.getElementById('rightFeatureMap')
    while(rightFeatureMap.firstChild){
        rightFeatureMap.removeChild(rightFeatureMap.firstChild);
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
    minDate = null
    maxDate = null
    addedDetections = false
    changed_flanks = {}

    document.getElementById('tgInfo').innerHTML = 'Site: '
    document.getElementById('timeInfo').innerHTML = ''
    document.getElementById('labelsDiv').innerHTML = ''    
    document.getElementById('firstSeenDiv').innerHTML = ''
    document.getElementById('lastSeenDiv').innerHTML = ''    
    document.getElementById('idNotes').value = ''
    document.getElementById('newIndividualName').value = ''

    document.getElementById('newNameErrors').innerHTML = ''
    document.getElementById('dateErrorsIndiv').innerHTML = ''
    document.getElementById('notesError').innerHTML = ''

    document.getElementById('ascOrder').checked = true
    document.getElementById('orderIndivImages').value = '1'	
    document.getElementById('startDateIndiv').value = ''
    document.getElementById('endDateIndiv').value = ''

    document.getElementById('statsSelect').value = '2'

    imgMaps = {}
    imgMapsHeight = {}
    imgMapsWidth = {}
    imgMapsActiveImage = {}
    imgMapsFullRes = {}
    drawnFeatureItems = {}
    leafletFeatureIDs = {}
    featureDrawControl = {}
    editingEnabled = false
    // globalFeatures = {'removed':[], 'added':{}, 'edited':{}}
    globalFeatures = {}
    individualBestDets = null
    individualFlankImages = {}
    flankImageIndex = {'L': 0, 'R': 0}
    unsavedChanges = false
    convexHullPolygon = null
}

modalIndividual.on('hidden.bs.modal', function(){
    /** Clears the individual modal when closed. */
    if (modalAlertIndividualsReturn) {
        modalAlertIndividualsReturn = false
    } 
    else if(helpReturn){
        helpReturn = false
    }
    else if (mergeIndividualsOpened){
        mergeIndividualsOpened = false
    }
    else {
        if (unsavedChanges) {
            if (associationClick){
                document.getElementById('discardText').innerHTML = 'Any unsaved changes made to this individual will be lost if you close this window and open the selected associated individual.'
            } else {
                document.getElementById('discardText').innerHTML = 'Any unsaved changes made to this individual will be lost if you close this window.'
            }
            modalDiscard.modal({keyboard: false, backdrop: 'static'});
        } else {
            cleanModalIndividual()
            getIndividuals(current_page)
            // getTasks()
        }
    }
});

modalIndividual.on('shown.bs.modal', function(){
    /** Initialises the individual modal when opened. */
    unidentifiableOpen = false
    if (map==null){
        prepMapIndividual(individualImages[0])
        updateSlider()
    }
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
    
    if(validDate && document.getElementById("startDateIndiv").value != "" ){
        startDate = document.getElementById("startDateIndiv").value + ' 00:00:00'
    }
    else{
        startDate = ''
    }

    if(validDate && document.getElementById("endDateIndiv").value != "" ){
        endDate = document.getElementById("endDateIndiv").value + ' 23:59:59'
    }
    else{
        endDate = ''
    }


    updateIndividual(selectedIndividual, selectedIndividualName, order_value, site, startDate, endDate)
}

function buildSurveySelect(){
    /** Builds the selectors for the surveys and annotation sets */

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
    col3.setAttribute('style','padding: 0px;')
    row.appendChild(col3)
    

    if (IDNum > 0 && !modalActive) {
        col1.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }
    
    idSurveySelect = document.createElement('select')
    idSurveySelect.classList.add('form-control')
    idSurveySelect.id = 'idSurveySelect-'+String(IDNum)
    idSurveySelect.name = idSurveySelect.id
    col1.appendChild(idSurveySelect)

    idTaskSelect = document.createElement('select')
    idTaskSelect.classList.add('form-control')
    idTaskSelect.id = 'idTaskSelect-'+String(IDNum)
    idTaskSelect.name = idTaskSelect.id
    col1.appendChild(idTaskSelect)
    

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
        btnRemove.setAttribute("class",'btn btn-info');
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

            idSurveySelect = document.getElementById('idSurveySelect-'+String(wrapIDNum))
            idTaskSelect = document.getElementById('idTaskSelect-'+String(wrapIDNum))
            
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

function buildSurveySelectLaunchID(){
    /** Builds the survey selectors for the modal  */
    
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
    
    idSurveySelect = document.createElement('select')
    idSurveySelect.classList.add('form-control')

    idSurveySelect.id = 'idSurveySelect1-'+String(IDNum)
    
    
    idSurveySelect.name = idSurveySelect.id
    col1.appendChild(idSurveySelect)

    idTaskSelect = document.createElement('select')
    idTaskSelect.classList.add('form-control')

    idTaskSelect.id = 'idTaskSelect1-'+String(IDNum)
    

    idTaskSelect.name = idTaskSelect.id

    col2.appendChild(idTaskSelect)

    if (surveys_launch != null) {    
        
        optionTexts = ['None']
        optionValues = ['-99999'] 
        fillSelect(idTaskSelect, [''], ['-99999'])  

        for (survey_name in surveys_launch){
            optionTexts.push(survey_name)
            optionValues.push(survey_name)
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
            if (survey=="-99999") {
                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, [''], ['-99999'])
                checkSurvey()
            } else {

                optionTexts = []      
                optionValues = []

                survey_name = idSurveySelect.options[idSurveySelect.selectedIndex].text
                for (let i=0;i<surveys_launch[survey_name].length;i++) {
                    optionTexts.push(surveys_launch[survey_name][i].name)
                    optionValues.push(surveys_launch[survey_name][i].task_id)
                }

                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, optionTexts, optionValues)

                checkSurvey()
                            
            }
                               
        }
    }(IDNum));

    $("#"+idTaskSelect.id).change( function() {
        checkSurvey()
    })
}

$('#taskTaggingLevel').change(function(){
    /** Changes the survey selectors when the tagging level is changed  */
    addSurveyTask = document.getElementById('addSurveyTask1')
    while(addSurveyTask.firstChild){
        addSurveyTask.removeChild(addSurveyTask.firstChild);
    }
    surveySelect = document.getElementById('surveySelect1')
    while(surveySelect.firstChild){
        surveySelect.removeChild(surveySelect.firstChild);
    }
    addSurvey()
})

function getSurveysandTasks(){
    /** Get surveys and tasks for Launch ID */

    species = document.getElementById('taskTaggingLevel').value
    if (species == ''){
        species = globalLabels[0]	
    }
        
    var formData = new FormData();
    formData.append('species', species)

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys_launch = JSON.parse(this.responseText);  
            // console.log(surveys_launch)
            buildSurveySelectLaunchID()
        }
    }
    xhttp.open("POST", '/getIndividualIDSurveysTasks');
    xhttp.send(formData);
}

function addSurvey(){
    /** Initialises the survey selectors  */

    if(modalActive){
        getSurveysandTasks()
        addSurveyTask = document.getElementById('addSurveyTask1')
    }
    else{
        var areaSelect = document.getElementById('areaSelect')
        var survey_url = '/getSurveys'
        if (areaSelect.value != '0') {
            survey_url += '?area=' + areaSelect.value;
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                surveys = JSON.parse(this.responseText);  
                buildSurveySelect()
                getIndividuals()
            }
        }
        xhttp.open("GET", survey_url);
        xhttp.send();

        addSurveyTask = document.getElementById('addSurveyTask')
    }
    row = document.createElement('div')
    row.classList.add('row')
    addSurveyTask.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-3')
    row.appendChild(col)

    btnAdd = document.createElement('button');
    btnAdd.setAttribute("class",'btn btn-info');
    btnAdd.innerHTML = '&plus;';
    btnAdd.addEventListener('click', ()=>{
        if(modalActive){    
            buildSurveySelectLaunchID()
        }
        else{
            buildSurveySelect()
        }
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
    var duplicateSurvey = false
    var surveyAll = false
    var oneSurvey = false
    var noneSurvey = false
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

    for (let i=0;i<allSurveys.length;i++) {
        currSurveyVal = allSurveys[i].value
        for (let j=0;j<allSurveys.length;j++) {
            if(allSurveys[j].value == currSurveyVal && j!=i){
                duplicateSurvey = true
            }
        }
    }

    
    if(allSurveys.length == 1 && surveyAll){
        surveyAll = false
    }
    else if(allSurveys.length == 1 && !surveyAll && modalActive){
        if(allSurveys[0].value == '-99999'){
            noneSurvey = true
        }
        else{
            oneSurvey = true
        }
    }
    

    if (duplicateTask) {
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have duplicate annotation sets, please remove the duplicate.'
        surveyErrors.appendChild(newdiv)
    }

    if (duplicateSurvey) {
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have duplicate surveys, please remove the duplicate.'
        surveyErrors.appendChild(newdiv)
    }
    
    if(surveyAll){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You cannot select all surveys and add additional surveys. Please remove additional surveys or "All" surveys.'
        surveyErrors.appendChild(newdiv)
    }

    if(oneSurvey){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You cannot complete individual ID for only one survey. Please add additional surveys.'
        surveyErrors.appendChild(newdiv)
    }

    if(noneSurvey){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have not selected any surveys. Please select a survey and add addional surveys.'
        surveyErrors.appendChild(newdiv)
    }

    if (duplicateTask||surveyAll||oneSurvey||noneSurvey||duplicateSurvey) {
        legalSurvey = false
    } else {
        legalSurvey = true
    }
}

function initialiseStats(){
    /** Initialises the stats for an individual*/
    clearStatistics() 

    statsSelect = document.getElementById('statsSelect')
    if(statsSelect.value == '1'){
        statisticsDiv.appendChild(document.createElement('br'))
        document.getElementById('btnExportIndivStats').disabled = false
        createIndivPolarChart()
    }
    else if(statsSelect.value == '2'){
        statisticsDiv.appendChild(document.createElement('br'))
        document.getElementById('btnExportIndivStats').disabled = false
        createIndivMap()
    }
    else if(statsSelect.value == '3'){
        statisticsDiv.appendChild(document.createElement('br'))
        document.getElementById('btnExportIndivStats').disabled = false
        createIndivBar()
    }
    else if(statsSelect.value == '4'){
        statisticsDiv.appendChild(document.createElement('br'))
        document.getElementById('btnExportIndivStats').disabled = false
        createIndivLine()
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
    populateSelectors()

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

    fillSelect(input, ['Inter-cluster Identification'], ['-5'])

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
      
    btnLaunch = document.getElementById('btnLaunch')

    btnLaunch.addEventListener('click', function(){
        /** Launches the individual ID */
        selectedTasks = []
        allTasks = document.querySelectorAll('[id^=idTaskSelect1-]')
        for (let i=0;i<allTasks.length;i++) {
            if (allTasks[i].value != '-99999'){
                selectedTasks.push(allTasks[i].value)
            } 
            if(allTasks[i].value == ''){
                selectedTasks.push('0')
            }
        }

        taskSize = document.getElementById('taskSize').value
        taskTaggingLevel = '-5,' + document.getElementById('taskTaggingLevel').value
        isBounding = false

        allow = true
        document.getElementById('launchErrors').innerHTML = ''

        checkSurvey()
        if(!legalSurvey){
            document.getElementById('launchErrors').innerHTML = 'Please fix the survey errors before launching.'
            allow = false
        }

        if (document.getElementById('idStage')[document.getElementById('idStage').selectedIndex].text == 'Exhaustive') {
            taskTaggingLevel += ',0,100'
        } else {
            taskTaggingLevel += ',-1,100'
        }

        if (document.getElementById('hotspotter').checked) {
            taskTaggingLevel += ',h'
        } else if (document.getElementById('heuristic').checked) {
            taskTaggingLevel += ',n'
        } else {
            document.getElementById('launchErrors').innerHTML = 'Please select an algorithm.'
            allow = false
        }

        if( taskSize == ''){	
            document.getElementById('launchErrors').innerHTML = 'Batch size cannot be empty.'
            allow = false
        }
        else if (isNaN(taskSize)) {
            document.getElementById('launchErrors').innerHTML = 'Batch size must be a number.'
            allow = false
        } else if (taskSize>10000) {
            document.getElementById('launchErrors').innerHTML = 'Batch size cannot be greater than 10000.'
            allow = false
        } else if (taskSize<1) {
            document.getElementById('launchErrors').innerHTML = 'Batch size cannot be less than 1.'
            allow = false
        }

        if(allow){
            btnLaunch.disabled=true
            document.getElementById('launchErrors').innerHTML = ''	

            var formData = new FormData()
            formData.append("selectedTasks", JSON.stringify(selectedTasks))
            formData.append("taskSize", taskSize)
            formData.append("taskTaggingLevel", taskTaggingLevel)
            formData.append("isBounding", isBounding)

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  

                    if (reply.status=='Success') {
                        modalLaunchID.modal('hide')
                    }
                    else {
                        document.getElementById('launchErrors').innerHTML = reply.message
                    }

                    btnLaunch.disabled=false

                }
                    
            }
            xhttp.open("POST", '/launchTask');
            xhttp.send(formData);
        }
    });
    
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
    document.getElementById('launchErrors').innerHTML = ''
    modalActive = false
    btnLaunch.disabled=false
    getIndividuals(current_page)
    // getTasks()
})

document.getElementById('btnSubmitInfoChange').addEventListener('click', function(){
    /** Submits the changes to the individual's information. */

    this.disabled = true

    submitIndividualTags()

    if(document.getElementById('individualName').innerHTML != document.getElementById('newIndividualName').value){
        submitIndividualName()
    }

    if(currentNote != document.getElementById('idNotes').value){
        submitIndividualNotes()
    }

    if(Object.keys(changed_flanks).length > 0){
        submitFlanks()
    }

    submitFeatures()

    unsavedChanges = false
});

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

// function buildIdTask(task){
//     idTasksListDiv = document.getElementById('idTasksListDiv'); 
//     newTask = document.createElement('div')
//     newTask.setAttribute("style", "border-bottom: 1px solid rgb(60,74,89); padding: 1.25rem;")

//     idTasksListDiv.appendChild(newTask)

//     entireRow = document.createElement('div')
//     entireRow.classList.add('row');
//     newTask.appendChild(entireRow)

//     taskDiv = document.createElement('div')
//     taskDiv.classList.add('col-lg-9');
//     entireRow.appendChild(taskDiv)
//     headingElement = document.createElement('h5')
//     headingElement.innerHTML = task.name
//     taskDiv.appendChild(headingElement)

//     stopTaskCol = document.createElement('div')
//     stopTaskCol.setAttribute('class', 'col-lg-3');
//     stopTaskBtn = document.createElement('button')
//     stopTaskBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
//     stopTaskBtn.innerHTML = '&times;'
//     stopTaskCol.appendChild(stopTaskBtn)
//     entireRow.appendChild(stopTaskCol)

//     if (task.remaining == 'Preparing...'){
//         stopTaskBtn.disabled = true
//     }
//     else{
//         stopTaskBtn.disabled = false
//     }

//     stopTaskBtn.addEventListener('click', function(wrapTaskId) {
//         return function() {
//             var xhttp = new XMLHttpRequest();
//             xhttp.onreadystatechange =
//             function(){
//                 if (this.readyState == 4 && this.status == 200) {
//                     reply = JSON.parse(this.responseText);   
//                     if (reply=='success') {
//                         getTasks()
//                     }
//                 }
//             }
//             xhttp.open("GET", '/stopTask/'+wrapTaskId);
//             xhttp.send();
//         }
//     }(task.id));
        

//     entireRow = document.createElement('div')
//     entireRow.classList.add('row');
//     newTask.appendChild(entireRow)

//     jobProgressBarCol = document.createElement('div')
//     jobProgressBarCol.classList.add('col-lg-12');
    
//     jobProgressBarDiv = document.createElement('div')
//     jobProgressBarDiv.setAttribute("id","jobProgressBarDiv"+task.id)

//     var newProg = document.createElement('div');
//     newProg.classList.add('progress');
//     newProg.setAttribute('style','background-color: #3C4A59')

//     var newProgInner = document.createElement('div');
//     newProgInner.classList.add('progress-bar');
//     newProgInner.classList.add('progress-bar-striped');
//     newProgInner.classList.add('progress-bar-animated');
//     newProgInner.classList.add('active');
//     newProgInner.setAttribute("role", "progressbar");
//     newProgInner.setAttribute("id", "progBar"+task.id);
//     newProgInner.setAttribute("aria-valuenow", task.completed);
//     newProgInner.setAttribute("aria-valuemin", "0");
//     newProgInner.setAttribute("aria-valuemax", task.total);
//     newProgInner.setAttribute("style", "width:"+(task.completed/task.total)*100+"%;transition:none; ");
//     newProgInner.innerHTML = task.remaining

//     newProg.appendChild(newProgInner);
//     jobProgressBarDiv.appendChild(newProg);
//     jobProgressBarCol.appendChild(jobProgressBarDiv);
//     entireRow.appendChild(jobProgressBarCol)

// }

// function getTasks(url=null){
//     /** Gets the current individual ID tasks */

//     if (url==null) {
//         request = '/getJobs?individual_id=' + true
//     }
//     else{
//         request = url
//     }

//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             reply = JSON.parse(this.responseText);
//             // console.log(reply)
//             idTasksListDiv = document.getElementById('idTasksListDiv'); 
//             while(idTasksListDiv.firstChild){
//                 idTasksListDiv.removeChild(idTasksListDiv.firstChild);
//             }

//             for (let i=0;i<reply.jobs.length;i++) {
//                 buildIdTask(reply.jobs[i])
//             }

//             if (reply.next_url==null) {
//                 btnNextTasks.style.visibility = 'hidden'
//             } else {
//                 btnNextTasks.style.visibility = 'visible'
//                 next_url = reply.next_url + '&individual_id=' + true
//             }

//             if (reply.prev_url==null) {
//                 btnPrevTasks.style.visibility = 'hidden'
//             } else {
//                 btnPrevTasks.style.visibility = 'visible'
//                 prev_url = reply.prev_url + '&individual_id=' + true
//             }

//             if(jobTimer!=null){	
//                 clearTimeout(jobTimer);
//             }
//             jobTimer = setTimeout(function(){getTasks(url)}, 10000);

//         }
//     }
//     xhttp.open("GET", request);
//     xhttp.send();
// }

// btnNextTasks.addEventListener('click', ()=>{
//     /** Loads the next set of paginated surveys. */
//     getTasks(next_url)
// });

// btnPrevTasks.addEventListener('click', ()=>{
//     /** Loads the previous set of paginated surveys. */
//     getTasks(prev_url)
// });

function clear_filters(){
    /** Clears all the filters and updates the page accordingly. */

    surveySelect = document.getElementById('surveySelect')
    while(surveySelect.firstChild){
        surveySelect.removeChild(surveySelect.firstChild);
    }
    addSurveyTask = document.getElementById('addSurveyTask')
    while(addSurveyTask.firstChild){
        addSurveyTask.removeChild(addSurveyTask.firstChild);
    }

    // addSurvey()
    getAreas()

    document.getElementById('individualSpeciesSelector').value = '0'
    document.getElementById('individualTagSelector').value = 'None'
    document.getElementById('sitesSelector').value = '0'

    document.getElementById('startDate').value = ''
    document.getElementById('endDate').value = ''

    getIndividuals()
}

function buildAssociationTable(individual_id){
    /** Builds the table of associations for the individual. */

    var associationsDiv = document.getElementById('associationsDiv');

    var table = document.createElement('table');
    table.classList.add('table');
    table.classList.add('table-striped');
    table.setAttribute('id','associationsTable');
    table.setAttribute('style','width:100%');
    // Set border of table
    table.setAttribute('style','border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;');

    var tableHead = document.createElement('thead');
    var tableHeadRow = document.createElement('tr');
    tableHeadRow.setAttribute('style','border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')
    // tableHeadRow.setAttribute('style','background-color: #4E5D6C');
    var tableHeadCell = document.createElement('th');
    tableHeadCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')
    tableHeadCell.innerHTML = 'Individual Image';
    tableHeadRow.appendChild(tableHeadCell);
    tableHeadCell = document.createElement('th');
    tableHeadCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')
    tableHeadCell.innerHTML = 'Individual Name';
    tableHeadRow.appendChild(tableHeadCell);
    tableHeadCell = document.createElement('th');
    tableHeadCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')
    tableHeadCell.innerHTML = 'Nr. Cluster Associations';
    tableHeadRow.appendChild(tableHeadCell);
    tableHeadCell = document.createElement('th');
    tableHeadCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')
    tableHeadCell.innerHTML = 'Nr. Image Associations';
    tableHeadRow.appendChild(tableHeadCell);
    tableHead.appendChild(tableHeadRow);
    table.appendChild(tableHead);

    var tableBody = document.createElement('tbody');
    tableBody.setAttribute('id','associationsTableBody');
    table.appendChild(tableBody);

    associationsDiv.appendChild(table)

    
    var orderAssociationsDiv = document.getElementById('orderAssociationsDiv');
    orderAssociationsDiv.hidden = true 

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Order'
    h5.setAttribute('style','margin-bottom: 2px')
    orderAssociationsDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.innerHTML = '<i>Select the order you would like to view your individual\'s associations.</i>'
    h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    orderAssociationsDiv.appendChild(h5)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','associationOrderSelector')
    orderAssociationsDiv.appendChild(select)

    fillSelect(select, ['Name', 'Clusters' ,'Images'], ['1','2','3'])
    select.value = '2'

    $("#associationOrderSelector").change( function() {
        getIndividualAssociations(individual_id)
    });

    var divRadio = document.createElement('div')
    divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');

    var radio = document.createElement('input')
    radio.setAttribute('type', 'radio')
    radio.setAttribute('id', 'ascOrderAssoc')
    radio.setAttribute('name', 'orderAssoc')
    radio.setAttribute('class', 'custom-control-input')
    radio.setAttribute('value', 'asc')
    divRadio.appendChild(radio)

    var label = document.createElement('label')
    label.setAttribute('class', 'custom-control-label')
    label.setAttribute('for', 'ascOrderAssoc')
    label.innerHTML = 'Ascending'
    divRadio.appendChild(label)

    orderAssociationsDiv.appendChild(divRadio)

    divRadio = document.createElement('div')
    divRadio.setAttribute('class', 'custom-control custom-radio custom-control-inline');

    radio = document.createElement('input')
    radio.setAttribute('type', 'radio')
    radio.setAttribute('id', 'descOrderAssoc')
    radio.setAttribute('name', 'orderAssoc')
    radio.setAttribute('class', 'custom-control-input')
    radio.setAttribute('value', 'desc')
    radio.checked = true
    divRadio.appendChild(radio)

    label = document.createElement('label')
    label.setAttribute('class', 'custom-control-label')
    label.setAttribute('for', 'descOrderAssoc')
    label.innerHTML = 'Descending'
    divRadio.appendChild(label)

    orderAssociationsDiv.appendChild(divRadio)

    $('#ascOrderAssoc').change( function() {
        getIndividualAssociations(individual_id)
    });

    $('#descOrderAssoc').change( function() {
        getIndividualAssociations(individual_id)
    });

    var row = document.createElement('div')
    row.setAttribute('class', 'row')

    var col1 = document.createElement('div')
    col1.setAttribute('class', 'col-lg-2')

    var col2 = document.createElement('div')	
    col2.setAttribute('class', 'col-lg-8')

    var col3 = document.createElement('div')
    col3.setAttribute('class', 'col-lg-2')

    row.appendChild(col1)
    row.appendChild(col2)
    row.appendChild(col3)

    associationsDiv.appendChild(row)

    var button = document.createElement('button')
    button.setAttribute('class', 'btn btn-primary float-left')
    button.setAttribute('type', 'button')
    button.setAttribute('id', 'btnPrevAssoc')
    button.innerHTML = 'Prev'
    button.style.visibility = 'hidden'
    col1.appendChild(button)

    $('#btnPrevAssoc').click( function() {
        getIndividualAssociations(individual_id, associations_prev)
    });

    button = document.createElement('button')
    button.setAttribute('class', 'btn btn-primary float-right')
    button.setAttribute('type', 'button')
    button.setAttribute('id', 'btnNextAssoc')
    button.innerHTML = 'Next'
    button.style.visibility = 'hidden'
    col3.appendChild(button)

    $('#btnNextAssoc').click( function() {
        getIndividualAssociations(individual_id, associations_next)
    });

    getIndividualAssociations(individual_id)
    
}

function getIndividualAssociations(individual_id, page=null){
    /** Gets the associations for the current individual. */

    var orderSelect = document.getElementById('associationOrderSelector').value
    var radioAsc = document.getElementById('ascOrderAssoc')
    var order = ''

    if (radioAsc.checked) {
        order = 'a' + orderSelect.toString()
    } else {
        order = 'd' + orderSelect.toString()
    }

    var request = '/getIndividualAssociations/' + individual_id.toString() + '/' + order.toString() 

    if (page != null) {
        request += '?page=' + page.toString()
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            var tableBody = document.getElementById('associationsTableBody');
            tableBody.innerHTML = ''

            for (let mapID in mergeMap) {
                if (mapID.includes('associationImageDiv') && mergeMap[mapID] != null) {
                    mergeMap[mapID].remove()
                    mergeMap[mapID] = null
                }
            }

            if (reply.associations.length == 0) {
                var row = document.createElement('tr');
                row.setAttribute('style','border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')

                var cell = document.createElement('td');
                cell.setAttribute('colspan', '4')
                cell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse; text-align: center; vertical-align: middle;')
                cell.innerHTML = 'No associations found.'
                row.appendChild(cell);
                tableBody.appendChild(row);

                var orderAssociationsDiv = document.getElementById('orderAssociationsDiv');
                while (orderAssociationsDiv.firstChild) {
                    orderAssociationsDiv.removeChild(orderAssociationsDiv.firstChild);
                }
                orderAssociationsDiv.hidden = true;
            }
            else{
                var orderAssociationsDiv = document.getElementById('orderAssociationsDiv');
                orderAssociationsDiv.hidden = false;
                for (let i=0;i<reply.associations.length;i++) {
                    buildAssociation(reply.associations[i],i)
                }
            }

            if (reply.next==null) {
                document.getElementById('btnNextAssoc').style.visibility = 'hidden'
                associations_next = null
            } else {
                document.getElementById('btnNextAssoc').style.visibility = 'visible'
                associations_next = reply.next
            }

            if (reply.prev==null) {
                document.getElementById('btnPrevAssoc').style.visibility = 'hidden'
                associations_prev = null
            } else {
                document.getElementById('btnPrevAssoc').style.visibility = 'visible'
                associations_prev = reply.prev
            }
            
        }
    }
    xhttp.open("GET", request);
    xhttp.send();
}

function buildAssociation(association,n){
    /** Builds the association row in table. */

    var table = document.getElementById('associationsTableBody');
    var row = document.createElement('tr');
    row.setAttribute('style','border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')

    var imageCell = document.createElement('td');
    imageCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse; text-align: center; vertical-align: middle;')
    row.appendChild(imageCell);

    // var center = document.createElement('center')
    // imageCell.appendChild(center)

    // var div = document.createElement('div')
    // div.id = 'associationImageDiv'+n.toString()
    // div.setAttribute('style','width: 100%; height: 100%; overflow: hidden;')
    // center.appendChild(div)

    // prepImageMap('associationImageDiv'+n.toString(), association.url, association.detection, 14.15)

    // div.addEventListener('click', function(individualID,individualName,wN){
    //     return function() {
    //         mergeMap['associationImageDiv'+wN.toString()].remove()
    //         mergeMap['associationImageDiv'+wN.toString()] = null
    //         cleanModalIndividual()
    //         getIndividual(individualID,individualName, true)
    //         modalIndividual.scrollTop(0)
    //     }
    // }(association.id,association.name,n));
  
    image = document.createElement('img')
    image.setAttribute('width','100%')
    image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCropURL(association.url, association.detection.id)
    imageCell.appendChild(image)

    image.style.cursor = 'pointer'
    image.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'
    image.style.borderRadius = '4px'

    image.addEventListener('error', function(wrapURL) {
        return function() {
            this.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(wrapURL)
        }
    }(association.url));

    image.addEventListener('click', function(individualID,individualName){
        return function() {
            associationClick = true
            associationID = individualID
            associationName = individualName
            if (unsavedChanges) {
                modalIndividual.modal('hide')
            } else {
                cleanModalIndividual()
                // getIndividual(individualID,individualName, true)
                selectedIndividual = individualID
                selectedIndividualName = individualName
                
                document.getElementById('openIndivSummary').click()
                modalIndividual.scrollTop(0)
            }
        }
    }(association.id,association.name));
    
    var nameCell = document.createElement('td');
    nameCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;  text-align: center; vertical-align: middle;')
    nameCell.textContent = association.name;
    row.appendChild(nameCell);
  
    var clusterCountCell = document.createElement('td');
    clusterCountCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;  text-align: center; vertical-align: middle;')
    clusterCountCell.textContent = association.cluster_count;
    row.appendChild(clusterCountCell);
  
    var imageCountCell = document.createElement('td');
    imageCountCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;  text-align: center; vertical-align: middle;')
    imageCountCell.textContent = association.image_count;
    row.appendChild(imageCountCell);

    table.appendChild(row);
}

function getIndividualSurveysTasks(){
    /** Gets the surveys and tasks which contain individuals for deletion. */

    var surveySelect = document.getElementById('surveySelectDel')
    while(surveySelect.firstChild){
        surveySelect.removeChild(surveySelect.firstChild);
    }

    var speciesSelect = document.getElementById('speciesSelectDel')
    while(speciesSelect.firstChild){
        speciesSelect.removeChild(speciesSelect.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            console.log(reply)
            indiv_surveys = reply.surveys
            indiv_tasks = reply.tasks
            indiv_species = reply.species
            buildSurveySelectDelete()
            buildSpeciesSelectDelete()
        }
    }
    xhttp.open("GET", '/getIndividualSurveysTasks');
    xhttp.send();
}

function buildSurveySelectDelete(){
    /** Builds the survey selectors for the modal  */
    
    var IDNum = getIdNumforNext('idSurveySelectDel-')
    var surveySelect = document.getElementById('surveySelectDel')

    var row = document.createElement('div')
    row.classList.add('row')
    surveySelect.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-5')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-5')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)
    
    var idSurveySelect = document.createElement('select')
    idSurveySelect.classList.add('form-control')
    idSurveySelect.id = 'idSurveySelectDel-'+String(IDNum)
    idSurveySelect.name = idSurveySelect.id
    col1.appendChild(idSurveySelect)

    var idTaskSelect = document.createElement('select')
    idTaskSelect.classList.add('form-control')
    idTaskSelect.id = 'idTaskSelectDel-'+String(IDNum)
    idTaskSelect.name = idTaskSelect.id
    col2.appendChild(idTaskSelect)

    if (indiv_surveys != null) {    
        optionTexts = ['None']
        optionValues = ['-99999'] 
        fillSelect(idTaskSelect, [''], ['-99999'])  

        for (survey_id in indiv_surveys){
            optionTexts.push(indiv_surveys[survey_id].name)
            optionValues.push(survey_id)
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
        });
        col3.appendChild(btnRemove);
    }

    $("#"+idSurveySelect.id).change( function(wrapIDNum) {
        return function() {
            idSurveySelect = document.getElementById('idSurveySelectDel-'+String(wrapIDNum))
            idTaskSelect = document.getElementById('idTaskSelectDel-'+String(wrapIDNum))
            survey = idSurveySelect.options[idSurveySelect.selectedIndex].value
            if (survey=="-99999") {
                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, [''], ['-99999'])
            } else {
                optionTexts = []      
                optionValues = []

                survey_id = idSurveySelect.options[idSurveySelect.selectedIndex].value
                for (let i=0;i<indiv_surveys[survey_id].task_ids.length;i++) {
                    optionTexts.push(indiv_tasks[indiv_surveys[survey_id].task_ids[i]])
                    optionValues.push(indiv_surveys[survey_id].task_ids[i])
                }

                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, optionTexts, optionValues)
            }
               
        }
    }(IDNum));
}

function buildSpeciesSelectDelete(){
    /** Builds the species selector for the modal  */

    var IDNum = getIdNumforNext('idSpeciesSelectDel-')
    var speciesSelect = document.getElementById('speciesSelectDel')

    var row = document.createElement('div')
    row.classList.add('row')
    speciesSelect.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-5')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-2')
    row.appendChild(col2)

    var idSpeciesSelect = document.createElement('select')
    idSpeciesSelect.classList.add('form-control')
    idSpeciesSelect.id = 'idSpeciesSelectDel-'+String(IDNum)
    idSpeciesSelect.name = idSpeciesSelect.id
    col1.appendChild(idSpeciesSelect)

    if (indiv_species != null) {
        if(IDNum==0){
            optionTexts = ['All']
            optionValues = ['0'] 
        }
        else{
            optionTexts = []
            optionValues = []
        }
        
        for (let i=0;i<indiv_species.length;i++) {
            optionTexts.push(indiv_species[i])
            optionValues.push(indiv_species[i])
        }
        clearSelect(idSpeciesSelect)
        fillSelect(idSpeciesSelect, optionTexts, optionValues)  
    }

    if (IDNum!=0) {
        btnRemove = document.createElement('button');
        btnRemove.classList.add('btn');
        btnRemove.classList.add('btn-info');
        btnRemove.innerHTML = '&times;';
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.remove();
        });
        col2.appendChild(btnRemove);
    }
}

$('#btnDeleteIndividuals').click( function() {
    indiv_surveys = {}
    indiv_tasks = {}
    species = []
    getIndividualSurveysTasks()
    document.getElementById('deleteIndivErrors').innerHTML = ''
    modalDeleteIndividuals.modal({keyboard: true})
});

function checkDeleteValid(){
    /** Checks that the selected annotation sets and species are valid for deletion. */

    legalDelete = false
    var speciesAll = false
    var duplicateTask = false
    var noneSurvey = false

    var surveySelects = document.querySelectorAll('[id^=idSurveySelectDel-]')
    var taskSelects = document.querySelectorAll('[id^=idTaskSelectDel-]')
    var speciesSelects = document.querySelectorAll('[id^=idSpeciesSelectDel-]')

    var deleteErrors = document.getElementById('deleteIndivErrors')
    while(deleteErrors.firstChild){
        deleteErrors.removeChild(deleteErrors.firstChild)
    }

    for (let i=0;i<taskSelects.length;i++) {
        currTaskVal = taskSelects[i].value
        for (let j=0;j<taskSelects.length;j++) {
            if(taskSelects[j].value == currTaskVal && j!=i){
                duplicateTask = true
            }
        }
    }

    for (let i=0;i<surveySelects.length;i++) {
        if(surveySelects[i].value == '-99999'){
            noneSurvey = true
        }
    }

    if (speciesSelects.length > 1) {
        for (let i=0;i<speciesSelects.length;i++) {
            if(speciesSelects[i].value == '0'){
                speciesAll = true
            }
        }
    }
    
    if (duplicateTask) {
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have duplicate annotation sets, please remove the duplicate.'
        deleteErrors.appendChild(newdiv)
    }

    if(noneSurvey){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have not selected any surveys and annotation sets. Please select a survey and annotation set.'
        deleteErrors.appendChild(newdiv)
    }

    if(speciesAll){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have selected all species and added additional species. Please remove additional species or "All" species.'
        deleteErrors.appendChild(newdiv)
    }

    if (duplicateTask||noneSurvey||speciesAll) {
        legalDelete = false
    } else {
        legalDelete = true
    }

}

$('#btnDeleteIndivs').click( function() {
    /** Checks if the deletion is valid and then asks for confirmation. */
    checkDeleteValid()
    if(legalDelete){

        var confirmString = 'You are about to permanently delete all the individuals for the following annotation sets and species: <br><br>'
        var surveySelects = document.querySelectorAll('[id^=idSurveySelectDel-]')
        var taskSelects = document.querySelectorAll('[id^=idTaskSelectDel-]')
        var speciesSelects = document.querySelectorAll('[id^=idSpeciesSelectDel-]')
        confirmString += '<b>Annotation Sets:</b><br>'
        for (let i=0;i<surveySelects.length;i++) {
            if (surveySelects[i].value != '-99999') {
                confirmString += surveySelects[i].options[surveySelects[i].selectedIndex].text + ' - ' + taskSelects[i].options[taskSelects[i].selectedIndex].text + '<br>'
            }
        }
        confirmString += '<br><b>Species:</b><br>'
        for (let i=0;i<speciesSelects.length;i++) {
            if (speciesSelects[i].value != '0') {
                confirmString += speciesSelects[i].options[speciesSelects[i].selectedIndex].text + '<br>'
            }
            else{
                confirmString += 'All<br>'
            }
        }

        confirmString += '<br>You will be required to start the identification process again for the selected species and annotation sets. Please note that this action cannot be undone.<br><br>Do you wish to continue?'
                
        document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
        document.getElementById('modalAlertIndividualsBody').innerHTML = confirmString
        document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','deleteIndividuals()')
        document.getElementById('btnCancelIndividualAlert').setAttribute('onclick','modalDeleteIndividuals.modal({keyboard: true});')
        modalAlertIndividualsReturn = true
        modalDeleteIndividuals.modal('hide')
        modalAlertIndividuals.modal({keyboard: true}); 
    }
});

modalDeleteIndividuals.on('hidden.bs.modal', function(){
    /** Clears the delete individuals modal */
    if (!modalAlertIndividualsReturn&&!helpReturn) {
        var surveySelect = document.getElementById('surveySelectDel')
        while(surveySelect.firstChild){
            surveySelect.removeChild(surveySelect.firstChild);
        }
        var speciesSelect = document.getElementById('speciesSelectDel')
        while(speciesSelect.firstChild){
            speciesSelect.removeChild(speciesSelect.firstChild);
        }

        getIndividuals()
    }
    else{
        modalAlertIndividualsReturn = false
        helpReturn = false
    }
});

function deleteIndividuals(){
    /** Deletes the individuals for the selected annotation sets and species. */
    var task_ids = []
    var species = []

    var taskSelects = document.querySelectorAll('[id^=idTaskSelectDel-]')
    var speciesSelects = document.querySelectorAll('[id^=idSpeciesSelectDel-]')

    for (let i=0;i<taskSelects.length;i++) {
        if (taskSelects[i].value != '-99999' && task_ids.indexOf(taskSelects[i].value) == -1) {
            task_ids.push(taskSelects[i].value)
        }
    }

    for (let i=0;i<speciesSelects.length;i++) {
        if (species.indexOf(speciesSelects[i].value) == -1) {
            species.push(speciesSelects[i].value)
        }
    }

    var formData = new FormData()
    formData.append("task_ids", JSON.stringify(task_ids))
    formData.append("species", JSON.stringify(species))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply.status=='success') {
                document.getElementById('modalIndividualsErrorHeader').innerHTML = 'Success'
                document.getElementById('modalIndividualsErrorBody').innerHTML = reply.message
                modalIndividualsError.modal({keyboard: true});
            }
            else{
                document.getElementById('modalIndividualsErrorHeader').innerHTML = 'Error'
                document.getElementById('modalIndividualsErrorBody').innerHTML = reply.message
                modalIndividualsError.modal({keyboard: true});
            }
        }
    }
    xhttp.open("POST", '/deleteIndividuals');
    xhttp.send(formData);

    modalAlertIndividualsReturn = false
    modalAlertIndividuals.modal('hide')

    document.getElementById('deleteIndivErrors').innerHTML = ''
}

modalIndividualsError.on('hidden.bs.modal', function(){
    /** Clears the error modal */
    if (!modalAlertIndividualsReturn) {
        getIndividuals()
    }
});

function submitFlanks(){
    /** Submits the flanks for the individual's detections. */

    var formData = new FormData()
    formData.append("individual_id", JSON.stringify(selectedIndividual))
    formData.append("flanks", JSON.stringify(changed_flanks))	

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply.status=='success') {
                for (let i=0;i<individualImages.length;i++) {
                    detection_id = individualImages[i].detections[0].id
                    if (changed_flanks[detection_id] != undefined) {
                        individualImages[i].detections[0].flank = changed_flanks[detection_id]
                        delete changed_flanks[detection_id]
                    }
                }
            }
        }
    }
    xhttp.open("POST", '/submitIndividualFlanks');
    xhttp.send(formData);

}


function initialiseMergeIndividualsLeft(){
    /** Initialises the merge individuals modal. */

    //Left map (current individual)
    var individualMergeDivL = document.getElementById('individualMergeDivL')

    while(individualMergeDivL.firstChild){
        individualMergeDivL.removeChild(individualMergeDivL.firstChild);
    }

    var mCol1 = document.getElementById('mCol1')
    while(mCol1.firstChild){
        mCol1.removeChild(mCol1.firstChild)
    }

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Individual: ' + selectedIndividualName
    mCol1.appendChild(h5)

    var row = document.createElement('div')
    row.classList.add('row')
    individualMergeDivL.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    col1.setAttribute('style','padding-right: 0px;')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-9')
    col2.setAttribute('style','padding-left: 0px;')
    row.appendChild(col2)

    var info = document.createElement('div')
    info.setAttribute('id','tgInfoMergeL')
    info.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
    info.innerHTML = 'Site: ' + mergeImages['L'][0].trapgroup.tag
    col1.appendChild(info)

    var info2 = document.createElement('div')
    info2.setAttribute('id','timeInfoMergeL')
    info2.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
    info2.innerHTML = 'Timestamp: '+ mergeImages['L'][0].timestamp
    col1.appendChild(info2)

    var info5 = document.createElement('div')
    info5.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
    var timestamp = 'None'
    if (mergeImageOnly) {
        if (mergeImages['L'][0].timestamp != null) {
            timestamp = mergeImages['L'][0].timestamp
        } 
    } else {
        if (individualFirstSeen != null) {
            timestamp = individualFirstSeen
        }
    }
    info5.innerHTML = 'First Seen: ' + timestamp
    col1.appendChild(info5)

    var info6 = document.createElement('div')
    info6.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
    var timestamp = 'None'
    if (mergeImageOnly) {
        if (mergeImages['L'][0].timestamp != null) {
            timestamp = mergeImages['L'][0].timestamp
        }
    } else {
        if (individualLastSeen != null) {
            timestamp = individualLastSeen
        }
    }
    info6.innerHTML = 'Last Seen: ' + timestamp
    col1.appendChild(info6)

    var info7 = document.createElement('div')
    info7.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
    var tags =  currentTags!= null && currentTags.length > 0 ? currentTags.join(', ') : 'None'
    info7.innerHTML = 'Tags: ' + tags
    col1.appendChild(info7)

    var info8 = document.createElement('div')
    info8.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
    var note = currentNote != null && currentNote.length > 0 ? currentNote : 'None'
    info8.innerHTML = 'Notes: ' + note
    col1.appendChild(info8)

    var info3 = document.createElement('div')
    info3.setAttribute('style','font-size: 80%;')
    info3.innerHTML = 'Surveys:'
    col1.appendChild(info3)

    for (let i=0;i<individualTasks.length;i++) {
        var info4 = document.createElement('div')
        info4.setAttribute('style','font-size: 80%;')
        info4.innerHTML = individualTasks[i]
        col1.appendChild(info4)
    }

    var trapgroupInfo = []
    var noCoords = true
    for (let i=0;i<mergeImages['L'].length;i++) {
        var info = mergeImages['L'][i].trapgroup
        var found = false
        for (let j=0;j<trapgroupInfo.length;j++) {
            if (trapgroupInfo[j].tag == info.tag) {
                found = true
                break
            }
        }
        if (!found) {
            trapgroupInfo.push(info)
            if (info.latitude != 0 || info.longitude != 0) {
                noCoords = false
            }
        }
    }

    individualCoords = trapgroupInfo

    if (mergeImageOnly) {
        mergeBounds = [[individualCoords[0].latitude, individualCoords[0].longitude]]
    } else {
        mergeBounds = individualBounds
    }

    if (noCoords) {
        var site_tags = []
        for (let i=0;i<trapgroupInfo.length;i++) {
            site_tags.push(trapgroupInfo[i].tag)
        }

        var info9 = document.createElement('div')
        info9.setAttribute('style','font-size: 80%; margin-top: 5px;')
        info9.innerHTML = 'Sites: ' + site_tags.join(', ')
        col1.appendChild(info9)

    } else {

        var info9 = document.createElement('div')
        info9.setAttribute('style','font-size: 80%; margin-top: 5px;')
        info9.innerHTML = 'Sites:'
        col1.appendChild(info9)

        var sitesMapDiv = document.createElement('div')
        sitesMapDiv.setAttribute('id','sitesMapDivL')
        sitesMapDiv.setAttribute('style','height: 250px;')
        col1.appendChild(sitesMapDiv)

        // gHyb = L.gridLayer.googleMutant({type: 'hybrid' })

        var osmSat = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        // attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        attribution: '© <a href="https://www.openstreetmap.org/">OSM</a> & <a href="https://www.mapbox.com/">Mapbox</a>', // Small map -simplified attribution
        maxZoom: 18,
        id: 'mapbox/satellite-v9',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
        })

        var mapSitesL = new L.map('sitesMapDivL', {
            zoomControl: true,
        });
        
        mapSitesL.addLayer(osmSat);

        var siteMarkers = []
        for (let i=0;i<trapgroupInfo.length;i++) {
            marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(mapSitesL)
            siteMarkers.push(marker)
            mapSitesL.addLayer(marker)
            marker.bindPopup(trapgroupInfo[i].tag);
            marker.on('mouseover', function (e) {
                this.openPopup();
            });
            marker.on('mouseout', function (e) {
                this.closePopup();
            });
        }

        var group = new L.featureGroup(siteMarkers);
        mapSitesL.fitBounds(group.getBounds().pad(0.1))
        if(siteMarkers.length == 1) {
            mapSitesL.setZoom(10)
        }

        if (mergeBounds.length == 1) {
            var circle = L.circle([mergeBounds[0][0], mergeBounds[0][1]], {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.2,
                opacity: 0.8,
                radius: 1000,
                weight:3,
                contextmenu: false,
            }).addTo(mapSitesL)
        
        } else {
            var poly1 = L.polygon(mergeBounds, {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.2,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }).addTo(mapSitesL)
        }

    }

    var center = document.createElement('center')
    col2.appendChild(center)

    var mergeMapDivL = document.createElement('div')
    mergeMapDivL.setAttribute('id','mergeMapDivL')
    mergeMapDivL.setAttribute('style','height: 750px;')
    center.appendChild(mergeMapDivL)

    var card = document.createElement('div')
    card.classList.add('card')
    card.setAttribute('style','background-color: rgb(60, 74, 89);margin-top: 5px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 5px')
    col2.appendChild(card)

    var body = document.createElement('div')
    body.classList.add('card-body')
    body.setAttribute('style','margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px')
    card.appendChild(body)

    var splide = document.createElement('div')
    splide.classList.add('splide')
    splide.setAttribute('id','splideML')
    body.appendChild(splide)

    var track = document.createElement('div')
    track.classList.add('splide__track')
    splide.appendChild(track)

    var list = document.createElement('ul')
    list.classList.add('splide__list')
    list.setAttribute('id','imageSplideML')
    track.appendChild(list)

    prepMergeMapIndividual('L','mergeMapDivL',mergeImages['L'][0])
    updateMergeSlider('L', 'imageSplideML','splideML')

}

function initialiseMergeIndividualsRight(){
    /** Initialises the merge individuals modal. */

    document.getElementById('btnMerge').hidden = true

    //Right map 
    var individualMergeDivR = document.getElementById('individualMergeDivR')

    while(individualMergeDivR.firstChild){
        individualMergeDivR.removeChild(individualMergeDivR.firstChild);
    }


    var mCol2 = document.getElementById('mCol2')
    while(mCol2.firstChild){
        mCol2.removeChild(mCol2.firstChild);
    }

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Individuals:'
    mCol2.appendChild(h5)

    var bigRow = document.createElement('div')
    bigRow.classList.add('row')
    individualMergeDivR.appendChild(bigRow)

    var bigCol1 = document.createElement('div')
    bigCol1.classList.add('col-lg-9')
    bigRow.appendChild(bigCol1)

    var mergeIndividualsDiv = document.createElement('div')
    mergeIndividualsDiv.setAttribute('id','mergeIndividualsDiv')
    bigCol1.appendChild(mergeIndividualsDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    bigCol1.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-1')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-10')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-1')
    row.appendChild(col3)

    var btnMPrev = document.createElement('button')
    btnMPrev.setAttribute('class','btn btn-primary btn-block btn-sm')
    btnMPrev.setAttribute('id','btnMPrev')
    btnMPrev.innerHTML = '<span style="font-size:100%">&#x276e;</span>'
    btnMPrev.disabled = true
    col1.appendChild(btnMPrev)

    var btnMNext = document.createElement('button')
    btnMNext.setAttribute('class','btn btn-primary btn-block btn-sm')
    btnMNext.setAttribute('id','btnMNext')
    btnMNext.innerHTML = '<span style="font-size:100%">&#x276f;</span>'
    btnMNext.disabled = true
    col3.appendChild(btnMNext)

    var rowDiv = document.createElement('div');
    rowDiv.classList.add('row');
    col2.appendChild(rowDiv);

    var colDiv = document.createElement('div');
    colDiv.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center');
    rowDiv.appendChild(colDiv);

    var paginationDiv = document.createElement('div');
    paginationDiv.id = 'individualsPosition';
    colDiv.appendChild(paginationDiv);

    var paginationUl = document.createElement('ul');
    paginationUl.classList.add('pagination');
    paginationUl.id = 'paginationCircles';
    paginationUl.style.margin = '5px';
    paginationDiv.appendChild(paginationUl);


    $('#btnMPrev').click( function() {
        getMergeIndividuals(merge_individual_prev)
    });

    $('#btnMNext').click( function() {
        getMergeIndividuals(merge_individual_next)
    });


    var bigCol2 = document.createElement('div')
    bigCol2.classList.add('col-lg-3')
    bigRow.appendChild(bigCol2)

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Surveys and Annotation Sets:'
    h5.setAttribute('style','margin-bottom: 2px')
    bigCol2.appendChild(h5)

    var select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','mergeTaskSelect')
    bigCol2.appendChild(select)
    fillSelect(select, ['All'], ['-1'])
    select.value = '-1'

    var cbxDiv = document.createElement('div')
    cbxDiv.setAttribute('class','custom-control custom-checkbox')
    cbxDiv.setAttribute('style','display: inline-block;')
    bigCol2.appendChild(cbxDiv)

    var checkbox = document.createElement('input')
    checkbox.setAttribute('type','checkbox')
    checkbox.classList.add('custom-control-input')
    checkbox.setAttribute('id','mutualOnly')
    checkbox.setAttribute('name','mutualOnly')
    checkbox.setAttribute('value','mutualOnly')
    cbxDiv.appendChild(checkbox)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','mutualOnly')
    label.innerHTML = 'Mutual Surveys Only'
    cbxDiv.appendChild(label)

    if (mergeIndividualsFilters['mutual'] != null && mergeIndividualsFilters['mutual'] == true) {
        document.getElementById('mutualOnly').checked = true
    } 

    $('#mutualOnly').change( function() {
        mergeIndividualsFilters['page'] = null
        mergeIndividualsFilters['mutual'] = document.getElementById('mutualOnly').checked
        getMergeTasks()
    });

    $('#mergeTaskSelect').change( function() {
        mergeIndividualsFilters['page'] = null
        mergeIndividualsFilters['task'] = document.getElementById('mergeTaskSelect').value
        getMergeIndividuals()
    });

    bigCol2.appendChild(document.createElement('br'))
    bigCol2.appendChild(document.createElement('br'))

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Search:'
    h5.setAttribute('style','margin-bottom: 2px')
    bigCol2.appendChild(h5)

    var search = document.createElement('input')
    search.setAttribute('type','text')
    search.setAttribute('id','searchMergeIndividuals')
    search.setAttribute('class','form-control')
    search.setAttribute('placeholder','Search')
    bigCol2.appendChild(search)

    bigCol2.appendChild(document.createElement('br'))

    if (mergeIndividualsFilters['search'] != null) {
        document.getElementById('searchMergeIndividuals').value = mergeIndividualsFilters['search']
    }

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Order By:'
    h5.setAttribute('style','margin-bottom: 2px')
    bigCol2.appendChild(h5)
    
    var order = document.createElement('select')
    order.setAttribute('id','orderMergeIndividuals')
    order.setAttribute('class','form-control')
    bigCol2.appendChild(order)
    fillSelect(order, ['Similarity', 'Distance', 'Name'], ['oSim', 'oDist','oName'])
    order.value = 'oSim'

    bigCol2.appendChild(document.createElement('br'))

    if (mergeIndividualsFilters['order'] != null) {
        document.getElementById('orderMergeIndividuals').value = mergeIndividualsFilters['order']
    }

    $('#searchMergeIndividuals').on('change', function() {
        mergeIndividualsFilters['page'] = null
        mergeIndividualsFilters['search'] = document.getElementById('searchMergeIndividuals').value
        getMergeIndividuals()
    });

    $("#orderMergeIndividuals").change( function() {
        mergeIndividualsFilters['page'] = null
        mergeIndividualsFilters['order'] = document.getElementById('orderMergeIndividuals').value
        getMergeIndividuals()
    });

    var h5 = document.createElement('h6')
    h5.innerHTML = 'Tags:'
    h5.setAttribute('style','margin-bottom: 2px')
    bigCol2.appendChild(h5)
    
    var tags = document.createElement('select')
    tags.setAttribute('id','tagsMergeIndividuals')
    tags.setAttribute('class','form-control')
    bigCol2.appendChild(tags)
    fillSelect(tags, ['All'], ['-1'])
    tags.value = '-1'

    bigCol2.appendChild(document.createElement('br'))

    $('#tagsMergeIndividuals').change( function() {
        mergeIndividualsFilters['page'] = null
        mergeIndividualsFilters['tags'] = document.getElementById('tagsMergeIndividuals').value
        getMergeIndividuals()
    });

    getMergeTasks()
    
}


function cleanupMergeIndividuals(){
    /** Cleans up the merge individuals modal. */

    var individualMergeDivL = document.getElementById('individualMergeDivL')
    while(individualMergeDivL.firstChild){
        individualMergeDivL.removeChild(individualMergeDivL.firstChild);
    }

    var individualMergeDivR = document.getElementById('individualMergeDivR')
    while(individualMergeDivR.firstChild){
        individualMergeDivR.removeChild(individualMergeDivR.firstChild);
    }

    var mCol1 = document.getElementById('mCol1')
    while(mCol1.firstChild){
        mCol1.removeChild(mCol1.firstChild)
    }

    var mCol2 = document.getElementById('mCol2')
    while(mCol2.firstChild){
        mCol2.removeChild(mCol2.firstChild)
    }

    document.getElementById('btnMerge').hidden = true

    mergeMap = {'L': null, 'R': null}
    mergeActiveImage = {'L': null, 'R': null}
    mergeMapReady = {'L': false, 'R': false}
    mergeMapWidth = {'L': null, 'R': null}
    mergeMapHeight = {'L': null, 'R': null}
    mergeImages = {'L': null, 'R': null}
    mergeSplide = {'L': null, 'R': null}
    mergeImageIndex = {'L': 0, 'R': 0}
    addedDetectionsMerge = {'L': false, 'R': false} 
    mergeIndividualsFilters = {'task': null, 'mutual': null, 'search': null, 'order': null, 'tags': null, 'page': null}
    fullResMerge = {'L': false, 'R': false}

    confirmMerge = false
    merge_individual_prev = null
    merge_individual_next = null

}


function prepMergeMapIndividual(mapID,divID,image) {
    /** Initialises the Leaflet image map for the individual ID modal. */

    if (bucketName != null) {
        mapReady = false
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height

            if (w>h) {
                document.getElementById(divID).setAttribute('style','height: calc(33vw *'+(h/w)+');  width:33vw')               
            } else {
                document.getElementById(divID).setAttribute('style','height: calc(33vw *'+(w/h)+');  width:33vw')
            }

            L.Browser.touch = true
    
            mergeMap[mapID] = new L.map(divID, {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0
            })


            var h1 = document.getElementById(divID).clientHeight
            var w1 = document.getElementById(divID).clientWidth

    
            var southWest = mergeMap[mapID].unproject([0, h1], 2);
            var northEast = mergeMap[mapID].unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mergeMapWidth[mapID] = northEast.lng
            mergeMapHeight[mapID] = southWest.lat
    
            addedDetectionsMerge[mapID] = false
            mergeActiveImage[mapID] = L.imageOverlay(imageUrl, bounds).addTo(mergeMap[mapID]);
            mergeActiveImage[mapID].on('load', function() {
                // addedDetectionsMerge[mapID] = false
                addDetectionsMergeIndividual(mapID,mergeImages[mapID][mergeSplide[mapID].index])
            });
            mergeActiveImage[mapID].on('error', function() {
                if (this._url.includes('-comp')) {
                    finishedDisplaying = true
                }
                else{
                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(mergeImages[mapID][mergeSplide[mapID].index].url))
                }
            });
            mergeMap[mapID].setMaxBounds(bounds);
            mergeMap[mapID].fitBounds(bounds)
            mergeMap[mapID].setMinZoom(mergeMap[mapID].getZoom())

            hc = document.getElementById(divID).clientHeight
            wc = document.getElementById(divID).clientWidth

            mergeMap[mapID].on('resize', function(){
                if (mergeMap[mapID] != null) {
                    if(document.getElementById(divID) && document.getElementById(divID).clientHeight){
                        var h1 = document.getElementById(divID).clientHeight
                        var w1 = document.getElementById(divID).clientWidth
                    }
                    else{
                        var h1 = hc
                        var w1 = wc
                    }
                    
                    var southWest = map.unproject([0, h1], 2);
                    var northEast = map.unproject([w1, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);
            
                    mergeMapWidth[mapID] = northEast.lng
                    mergeMapHeight[mapID] = southWest.lat

                    mergeMap[mapID].invalidateSize()
                    mergeMap[mapID].setMaxBounds(bounds)
                    mergeMap[mapID].fitBounds(bounds)
                    mergeMap[mapID].setMinZoom(mergeMap[mapID].getZoom())
                    mergeActiveImage[mapID].setBounds(bounds)
                    if(checkIfImage(mergeActiveImage[mapID]._url)){
                        addedDetectionsMerge[mapID] = false
                        addDetectionsMergeIndividual(mapID,mergeImages[mapID][mergeSplide[mapID].index])  
                    }  
                }
            });


            mergeMap[mapID].on('drag', function() {
                mergeMap[mapID].panInsideBounds(bounds, { animate: false });
            });
    
            mergeDrawnItems[mapID] = new L.FeatureGroup();
            mergeMap[mapID].addLayer(mergeDrawnItems[mapID]);
    
            mergeMap[mapID].on('zoomstart', function() {
                if (!fullResMerge[mapID]) {
                    if(checkIfImage(mergeActiveImage[mapID]._url)){
                        mergeActiveImage[mapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + mergeImages[mapID][mergeSplide[mapID].index].url)
                        fullResMerge[mapID] = true
                    }
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

            mergeMapReady[mapID] = true
        };
        img.src = imageUrl  
    }
}

function updateMergeSlider(mapID, divIDImageSplide, divID) {
    /** Updates the image slider for the individual modal. */
    
    var imageSplide = document.getElementById(divIDImageSplide)
    while(imageSplide.firstChild){
        imageSplide.removeChild(imageSplide.firstChild);
    }

    for (let i=0;i<mergeImages[mapID].length;i++) {
        img = document.createElement('img')
        // img.setAttribute('src',"https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(mergeImages[mapID][i].url))
        if (mergeImages[mapID][i].detections.length>0){
            image_url = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCropURL(mergeImages[mapID][i].url, mergeImages[mapID][i].detections[0].id)
        } else {
            image_url = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(mergeImages[mapID][i].url)
        }
        img.setAttribute('data-splide-lazy', image_url)
        imgli = document.createElement('li')
        imgli.classList.add('splide__slide')
        imgli.appendChild(img)
        imageSplide.appendChild(imgli)

        // add a error handler to the image to replace it with the compressed version if the crop does not exist
        img.onerror = function() {
            this.onerror = null;
            this.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(mergeImages[mapID][i].url)
        };
    }

    if (mergeSplide[mapID]==null) {

        client_width = document.getElementById(divID).clientWidth
        numberPages =Math.ceil(client_width/200) + 1
        
        // Initialise Splide
        mergeSplide[mapID] = new Splide( document.getElementById(divID), { 
            rewind      : false,
            fixedWidth  : 200,
            fixedHeight : 128,
            isNavigation: true,
            keyboard    : true,
            gap         : 5,
            pagination  : false,
            cover       : true,
            lazyLoad    : 'nearby',
            preloadPages: numberPages,
            breakpoints : {
                '600': {
                    fixedWidth  : 66,
                    fixedHeight : 40
                }
            }
        } ).mount();

        mergeSplide[mapID].on( 'moved', function() {
            if (bucketName!=null) {
                finishedDisplaying = false
                image = mergeImages[mapID][mergeSplide[mapID].index]
                if (mapID == 'L') {
                    document.getElementById('tgInfoMergeL').innerHTML = "Site: " + image.trapgroup.tag
                    document.getElementById('timeInfoMergeL').innerHTML = image.timestamp
                } else {
                    document.getElementById('tgInfoMergeR').innerHTML = "Site: " + image.trapgroup.tag
                    document.getElementById('timeInfoMergeR').innerHTML = "Timestamp: " + image.timestamp
                }
                addedDetectionsMerge[mapID] = false
                mergeActiveImage[mapID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
            }
        });

        var track = mergeSplide[mapID].Components.Elements.track
        mergeSplide[mapID].on( 'click', function(wrapTrack) {
            return function(event) {
                mergeImageIndex[mapID] = event.index
                mergeSplide[mapID].go(mergeImageIndex[mapID])
            }
        }(track));

    } else {
        mergeSplide[mapID].refresh()
    }
}

function addDetectionsMergeIndividual(mapID,image) {
    //** Adds detections to the main image displayed in the individual modal. */
    if (!addedDetectionsMerge[mapID]) {
        mergeMap[mapID].setZoom(mergeMap[mapID].getMinZoom())
        fullResMerge[mapID] = false
        mergeDrawnItems[mapID].clearLayers()
        for (let i=0;i<image.detections.length;i++) {
            detection = image.detections[i]
            if (detection.static == false) {
                rectOptions.color = "rgba(223,105,26,1)"
                rect = L.rectangle([[detection.top*mergeMapHeight[mapID],detection.left*mergeMapWidth[mapID]],[detection.bottom*mergeMapHeight[mapID],detection.right*mergeMapWidth[mapID]]], rectOptions)
                mergeDrawnItems[mapID].addLayer(rect)
                
            }
        }
        finishedDisplaying[mapID] = true
        addedDetectionsMerge[mapID] = true
    }
}

function getMergeIndividuals(page = null) {
    /** Gets a page of individuals. Gets the first page if none is specified. */
    var formData = new FormData()
    formData.append("individual_id", JSON.stringify(selectedIndividual))
    task_id = document.getElementById('mergeTaskSelect').value
    formData.append("task_id", JSON.stringify(task_id))
    mutualOnly = document.getElementById('mutualOnly').checked 
    formData.append("mutual", JSON.stringify(mutualOnly))
    tag = document.getElementById('tagsMergeIndividuals').value
    if (tag != '-1' || tag != '0' || tag != null) {
        formData.append("tag", JSON.stringify(tag))
    }
    

    request = '/getMergeIndividuals'
    if (page != null) {
        request += '?page='+page.toString()
    }
    else{
        if (mergeIndividualsFilters['page'] != null) {
            request += '?page='+mergeIndividualsFilters['page'].toString()
        }
    }
    
    search = document.getElementById('searchMergeIndividuals').value
    order = document.getElementById('orderMergeIndividuals').value
    formData.append("search", JSON.stringify(search))
    formData.append("order", JSON.stringify(order))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", request);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            var individuals = reply.individuals
            var mergeIndividualsDiv = document.getElementById('mergeIndividualsDiv')

            
            while(mergeIndividualsDiv.firstChild){
                mergeIndividualsDiv.removeChild(mergeIndividualsDiv.firstChild);
            }

            for (let mapID in mergeMap) {
                if (mapID.includes('imgDiv') && mergeMap[mapID] != null) {
                    mergeMap[mapID].remove()
                    mergeMap[mapID] = null
                }
            }
            
            var row = document.createElement('div')
            row.classList.add('row')
            mergeIndividualsDiv.appendChild(row)
            runningCount = 0
            for (let i=0;i<individuals.length;i++) {
                let newIndividual = individuals[i]

                if (runningCount%3==0) {
                    runningCount = 0
                    row = document.createElement('div')
                    row.classList.add('row')
                    mergeIndividualsDiv.appendChild(row)
                    // individualMergeDivR.appendChild(document.createElement('br'))
                }

                let col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)

                // let center = document.createElement('center')
                // col.appendChild(center)

                // let div = document.createElement('div')
                // div.setAttribute('id','imgDiv'+i)
                // center.appendChild(div)

                // prepImageMap('imgDiv'+i, newIndividual.url, newIndividual.detection)

                image = document.createElement('img')
                image.setAttribute('width','100%')
                image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCropURL(newIndividual.url, newIndividual.detection.id)
                col.appendChild(image)

                image.style.cursor = 'pointer'
                image.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'
                image.style.borderRadius = '4px'

                image.addEventListener('mouseover', function() {
                    this.style.boxShadow = '0 8px 16px 0 rgba(0, 0, 0, 0.2), 0 12px 40px 0 rgba(0, 0, 0, 0.19)'
                    this.style.transform = 'scale(1.03)'
                });

                image.addEventListener('mouseout', function() {
                    this.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'
                    this.style.transform = 'scale(1)'
                });

                image.addEventListener('error', function(wrapURL) {
                    return function() {
                        this.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(wrapURL)
                    }
                }(newIndividual.url));

                let h5 = document.createElement('h5')
                h5.setAttribute('align','center')
                h5.setAttribute('style','font-size: 95%;')
                h5.innerHTML = newIndividual.name
                col.appendChild(h5)

                image.addEventListener('click', function(individualID,individualName){
                    return function() {
                        selectedMergeIndividual = individualID
                        selectedMergeIndividualName = individualName
                        viewMergeIndividual()
                    }
                }(newIndividual.id,newIndividual.name));

                runningCount += 1
            }

            if (reply.next==null) {
                document.getElementById('btnMNext').disabled = true
                merge_individual_next = null
            } else {
                document.getElementById('btnMNext').disabled = false
                merge_individual_next = reply.next
            }

            if (reply.prev==null) {
                document.getElementById('btnMPrev').disabled = true
                merge_individual_prev = null
            } else {
                document.getElementById('btnMPrev').disabled = false
                merge_individual_prev = reply.prev
            }

            mergeIndividualsFilters['page'] = reply.current

            updateMergePaginationCircles(reply.current, reply.nr_pages)
        }
    }
    xhttp.send(formData);
    
}

function viewMergeIndividual(){
    /** Views the selected individual in the merge individuals modal. */

    var individualMergeDivR = document.getElementById('individualMergeDivR')

    while (individualMergeDivR.firstChild) {
        individualMergeDivR.removeChild(individualMergeDivR.firstChild);
    }


    var mCol2 = document.getElementById('mCol2')
    while(mCol2.firstChild){
        mCol2.removeChild(mCol2.firstChild)
    }

    var formData = new FormData()
    formData.append("order", JSON.stringify('a1'))
    formData.append("site", JSON.stringify('0'))
    formData.append('start_date', JSON.stringify(''))
    formData.append('end_date', JSON.stringify(''))

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            mergeImages['R'] =  reply.individual

            var row = document.createElement('div')
            row.classList.add('row')
            mCol2.appendChild(row)

            var col1 = document.createElement('div')
            col1.classList.add('col-lg-11')
            row.appendChild(col1)

            var col2 = document.createElement('div')
            col2.classList.add('col-lg-1')
            row.appendChild(col2)
            
            var h5 = document.createElement('h5')
            h5.innerHTML = 'Individual: ' + selectedMergeIndividualName
            col1.appendChild(h5)

            var cancelBtn = document.createElement('button')
            cancelBtn.setAttribute('class','btn btn-primary btn-block btn-sm')
            cancelBtn.innerHTML = '<i class="fa fa-times"></i>'
            cancelBtn.id = 'btnCancelMerge'
            col2.appendChild(cancelBtn)
        
            $('#btnCancelMerge').click( function() {
                selectedMergeIndividual = null
                selectedMergeIndividualName = null
                mergeMap['R'].remove()
                mergeSplide['R'].destroy()
                mergeMap['R'] = null
                mergeSplide['R'] = null
                mergeActiveImage['R'] = null
                mergeMapReady['R'] = false
                mergeMapWidth['R'] = null
                mergeMapHeight['R'] = null
                mergeImages['R'] = null
                addedDetectionsMerge['R'] = false
                mergeImageIndex['R'] = 0
                initialiseMergeIndividualsRight()
            });

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    var info = JSON.parse(this.responseText);

                    var row = document.createElement('div')
                    row.classList.add('row')
                    individualMergeDivR.appendChild(row)
        
                    var col1 = document.createElement('div')
                    col1.classList.add('col-lg-3')
                    col1.setAttribute('style','padding-right: 0px;')
                    row.appendChild(col1)
        
                    var col2 = document.createElement('div')
                    col2.classList.add('col-lg-9')
                    col2.setAttribute('style','padding-left: 0px;')
                    row.appendChild(col2)
                
                    var info1 = document.createElement('div')
                    info1.setAttribute('id','tgInfoMergeR')
                    info1.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    info1.innerHTML = 'Site: ' + mergeImages['R'][0].trapgroup.tag
                    col1.appendChild(info1)
        
                    var info2 = document.createElement('div')
                    info2.setAttribute('id','timeInfoMergeR')
                    info2.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    info2.innerHTML = 'Timestamp: '+ mergeImages['R'][0].timestamp
                    col1.appendChild(info2)
        
                    var info5 = document.createElement('div')
                    info5.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    if (info.seen_range[0] == null) {
                        info5.innerHTML = 'First Seen: None'
                    } else {
                        info5.innerHTML = 'First Seen: ' + info.seen_range[0]
                    }
                    col1.appendChild(info5)
        
                    var info6 = document.createElement('div')
                    info6.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    if (info.seen_range[1] == null) {
                        info6.innerHTML = 'Last Seen: None'
                    } else {
                        info6.innerHTML = 'Last Seen: ' + info.seen_range[1]
                    }
                    col1.appendChild(info6)
        
                    var info7 = document.createElement('div')
                    info7.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    var tags =  info.tags.length > 0 ? [...new Set(info.tags)].join(', ') : 'None'
                    info7.innerHTML = 'Tags: ' + tags
                    col1.appendChild(info7)

                    var info8 = document.createElement('div')
                    info8.setAttribute('style','font-size: 80%; margin-bottom: 5px;')
                    var note = info.notes != null && info.notes.length > 0 ? info.notes : 'None'
                    info8.innerHTML = 'Notes: ' + note
                    col1.appendChild(info8)
        
                    var info3 = document.createElement('div')
                    info3.setAttribute('style','font-size: 80%;')
                    info3.innerHTML = 'Surveys:'
                    col1.appendChild(info3)
        
                    for (let i=0;i<info.surveys.length;i++) {
                        var info4 = document.createElement('div')
                        info4.setAttribute('style','font-size: 80%;')
                        info4.innerHTML = info.surveys[i]
                        col1.appendChild(info4)
                    }

                    var trapgroupInfo = []
                    var noCoords = true
                    for (let i=0;i<mergeImages['R'].length;i++) {
                        var site = mergeImages['R'][i].trapgroup
                        var found = false
                        for (let j=0;j<trapgroupInfo.length;j++) {
                            if (trapgroupInfo[j].tag == site.tag) {
                                found = true
                                break
                            }
                        }
                        if (!found) {
                            trapgroupInfo.push(site)
                            if (site.latitude != 0 || site.longitude != 0) {
                                noCoords = false
                            }
                        }
                    }

                    if (noCoords) {
                        var site_tags = []
                        for (let i=0;i<trapgroupInfo.length;i++) {
                            site_tags.push(trapgroupInfo[i].tag)
                        }

                        var info9 = document.createElement('div')
                        info9.setAttribute('style','font-size: 80%; margin-top: 5px;')
                        info9.innerHTML = 'Sites: ' + site_tags.join(', ')
                        col1.appendChild(info9)

                    }
                    else{
                        var info9 = document.createElement('div')
                        info9.setAttribute('style','font-size: 80%; margin-top: 5px;')
                        info9.innerHTML = 'Sites:'
                        col1.appendChild(info9)
                    
                        var sitesMapDiv = document.createElement('div')
                        sitesMapDiv.setAttribute('id','sitesMapDivR')
                        sitesMapDiv.setAttribute('style','height: 250px;')
                        col1.appendChild(sitesMapDiv)
                    
                        // gHyb = L.gridLayer.googleMutant({type: 'hybrid' })

                        var osmSat = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
                        // attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                        attribution: '© <a href="https://www.openstreetmap.org/">OSM</a> & <a href="https://www.mapbox.com/">Mapbox</a>', // Small map -simplified attribution
                        maxZoom: 18,
                        id: 'mapbox/satellite-v9',
                        tileSize: 512,
                        zoomOffset: -1,
                        accessToken: 'pk.eyJ1IjoibmljaG9sYXNpbm5vdmVudGl4IiwiYSI6ImNrZTJrdjdjcjBhYTIyeXBkamd2N2ZlengifQ.IXU45GintSGY47C7PlBGXA'
                        })

                        var mapSitesR = new L.map('sitesMapDivR', {
                            zoomControl: true,
                        });
                    
                        mapSitesR.addLayer(osmSat);
                    
                        var siteMarkers = []
                        var added_coords = []
                        for (let i=0;i<trapgroupInfo.length;i++) {
                            marker = L.marker([trapgroupInfo[i].latitude, trapgroupInfo[i].longitude]).addTo(mapSitesR)
                            siteMarkers.push(marker)
                            mapSitesR.addLayer(marker)
                            marker.bindPopup(trapgroupInfo[i].tag);
                            marker.on('mouseover', function (e) {
                                this.openPopup();
                            });
                            marker.on('mouseout', function (e) {
                                this.closePopup();
                            });
                            added_coords.push(trapgroupInfo[i].latitude + ',' + trapgroupInfo[i].longitude)
                        }

                        for (let i=0;i<individualCoords.length;i++) {
                            if (added_coords.includes(individualCoords[i].latitude + ',' + individualCoords[i].longitude)) {
                                continue
                            }
                            var marker = L.marker([individualCoords[i].latitude, individualCoords[i].longitude]).addTo(mapSitesR)
                            siteMarkers.push(marker)
                            mapSitesR.addLayer(marker)
                            marker.bindPopup(individualCoords[i].tag);
                            marker.on('mouseover', function (e) {
                                this.openPopup();
                            });
                            marker.on('mouseout', function (e) {
                                this.closePopup();
                            });
                        }
                    
                        var group = new L.featureGroup(siteMarkers);
                        mapSitesR.fitBounds(group.getBounds().pad(0.1))
                        if(siteMarkers.length == 1) {
                            mapSitesR.setZoom(10)
                        }


                        if (mergeBounds.length == 1){
                            var circle = L.circle([mergeBounds[0][0], mergeBounds[0][1]], {
                                color: "rgba(223,105,26,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                radius: 1000,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSitesR)
                        } else {
                            var poly1 = L.polygon(mergeBounds, {
                                color: "rgba(223,105,26,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSitesR)
                        }

                        if (info.bounds.length == 1){
                            var circle = L.circle([info.bounds[0][0], info.bounds[0][1]], {
                                color: "rgba(91,192,222,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                radius: 1000,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSitesR)
                        } else {
                            var poly2 = L.polygon(info.bounds, {
                                color: "rgba(91,192,222,1)",
                                fill: true,
                                fillOpacity: 0.2,
                                opacity: 0.8,
                                weight:3,
                                contextmenu: false,
                            }).addTo(mapSitesR)
                        }

                    }
                
                    var center = document.createElement('center')
                    col2.appendChild(center)
        
                    var mergeMapDivL = document.createElement('div')
                    mergeMapDivL.setAttribute('id','mergeMapDivR')
                    mergeMapDivL.setAttribute('style','height: 750px;')
                    center.appendChild(mergeMapDivL)
        
                    var card = document.createElement('div')
                    card.classList.add('card')
                    card.setAttribute('style','background-color: rgb(60, 74, 89);margin-top: 5px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 5px')
                    col2.appendChild(card)
                
                    var body = document.createElement('div')
                    body.classList.add('card-body')
                    body.setAttribute('style','margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px')
                    card.appendChild(body)
                
                    var splide = document.createElement('div')
                    splide.classList.add('splide')
                    splide.setAttribute('id','splideMR')
                    body.appendChild(splide)
                
                    var track = document.createElement('div')
                    track.classList.add('splide__track')
                    splide.appendChild(track)
                
                    var list = document.createElement('ul')
                    list.classList.add('splide__list')
                    list.setAttribute('id','imageSplideMR')
                    track.appendChild(list)
        
                    document.getElementById('btnMerge').hidden = false
                
                    prepMergeMapIndividual('R','mergeMapDivR',mergeImages['R'][0])
                    updateMergeSlider('R', 'imageSplideMR','splideMR')

                }
            }
            xhttp.open("GET", '/getIndividualInfo/'+selectedMergeIndividual);
            xhttp.send();

        }
    }
    xhttp.open("POST", '/getIndividual/'+selectedMergeIndividual);
    xhttp.send(formData)

}

$('#btnMerge').click( function() {
    if (mergeImageOnly){
        document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
        if (selectedIndividualName == 'Unidentifiable Sighting') {
            document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to merge the sighting marked as unidentifiable into individual '+selectedMergeIndividualName+'?'
        } else {
            document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to merge the selected image from individual '+selectedIndividualName+' into individual '+selectedMergeIndividualName+'?'
        }
        document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','mergeImage()')
        document.getElementById('btnCancelIndividualAlert').setAttribute('onclick','modalMergeIndividual.modal({keyboard: true});')
        modalAlertIndividualsReturn = true
        modalMergeIndividual.modal('hide')
        modalAlertIndividuals.modal({keyboard: true});
    }
    else{
        document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
        // document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to merge individual '+selectedIndividualName+' into individual '+selectedMergeIndividualName+'?'
        var modalAlertIndividualsBody = document.getElementById('modalAlertIndividualsBody')
        while(modalAlertIndividualsBody.firstChild){
            modalAlertIndividualsBody.removeChild(modalAlertIndividualsBody.firstChild)
        }

        var p = document.createElement('div')
        p.innerHTML = 'Do you want to merge individual '+selectedIndividualName+' and individual '+selectedMergeIndividualName+'?'
        p.setAttribute('style','margin-bottom: 2px')
        modalAlertIndividualsBody.appendChild(p)

        modalAlertIndividualsBody.appendChild(document.createElement('br'))

        var h5 = document.createElement('h5')
        h5.innerHTML = 'Name'
        h5.setAttribute('style','margin-bottom: 2px')
        modalAlertIndividualsBody.appendChild(h5)
    
        h5 = document.createElement('div')
        h5.innerHTML = '<i>Select what name to use for the merged individual.</i>'
        h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        modalAlertIndividualsBody.appendChild(h5)

        var row = document.createElement('div')
        row.classList.add('row')
        modalAlertIndividualsBody.appendChild(row)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-6')
        row.appendChild(col1)

        var col2 = document.createElement('div')
        col2.classList.add('col-lg-6')
        row.appendChild(col2)
    
        var select = document.createElement('select')
        select.classList.add('form-control')
        select.setAttribute('id','mergeIndivName')
        col1.appendChild(select)
    
        fillSelect(select, [selectedIndividualName, selectedMergeIndividualName, 'Custom'], [selectedIndividualName, selectedMergeIndividualName, 'Custom'])
        select.value = selectedIndividualName
        
        var customInput = document.createElement('input')
        customInput.setAttribute('type','text')
        customInput.setAttribute('id','customMergeName')
        customInput.setAttribute('class','form-control')
        customInput.setAttribute('placeholder','Custom name')
        customInput.setAttribute('style','display:none')
        col2.appendChild(customInput)

        select.addEventListener('change', function() {
            /** Changes the custom name input based on the selected option. */
            if (select.value == 'Custom') {
                customInput.style.display = 'block'
            }
            else {
                customInput.style.display = 'none'
                customInput.value = ''
            }
        });

        h5 = document.createElement('div')
        h5.id = 'mergeIndivNameError'
        h5.setAttribute('style',"font-size: 80%; color: #DF691A")
        h5.innerHTML = ''
        modalAlertIndividualsBody.appendChild(h5)
        
        document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','mergeIndividuals()')
        document.getElementById('btnCancelIndividualAlert').setAttribute('onclick','modalMergeIndividual.modal({keyboard: true});')
        modalAlertIndividualsReturn = true
        modalMergeIndividual.modal('hide')
        modalAlertIndividuals.modal({keyboard: true});
    }
});


function mergeIndividuals(){
    /** Merges the selected individual into the selected merge individual. */
    document.getElementById('btnContinueIndividualAlert').disabled = true
    confirmMerge = true
    // modalAlertIndividuals.modal('hide')

    validName = true
    var name = document.getElementById('mergeIndivName').value
    if (name == 'Custom') {
        name = document.getElementById('customMergeName').value
    }
    name = name.trim()

    if (name == '') {
        document.getElementById('mergeIndivNameError').innerHTML = 'Please select a name for the merged individual.'
        validName = false
        document.getElementById('btnContinueIndividualAlert').disabled = false
    }
    else if (name.toLowerCase() == 'unidentifiable') {
        document.getElementById('mergeIndivNameError').innerHTML = 'Reserved name. Please select a different name.'
        validName = false
        document.getElementById('btnContinueIndividualAlert').disabled = false
    }
    else if (name.includes('/') || name.includes('\\')){
        document.getElementById('mergeIndivNameError').innerHTML = 'Invalid name. Please choose a different name.'
        validName = false
        document.getElementById('btnContinueIndividualAlert').disabled = false
    }
    else {
        document.getElementById('mergeIndivNameError').innerHTML = ''
    }


    if (selectedIndividual != null && selectedMergeIndividual != null && validName) {

        var formData = new FormData()
        formData.append("individual_id1", JSON.stringify(selectedMergeIndividual))
        formData.append("individual_id2", JSON.stringify(selectedIndividual))
        formData.append("name", JSON.stringify(name))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if (reply.status=='error') {
                    document.getElementById('mergeIndivNameError').innerHTML = reply.message
                    document.getElementById('btnContinueIndividualAlert').disabled = false
                }
                else{
                    modalAlertIndividuals.modal('hide')
                    document.getElementById('btnContinueIndividualAlert').disabled = false
                    cleanupMergeIndividuals()
                    cleanModalIndividual()
                    getIndividuals()
                }

            }
        }
        xhttp.open("POST", '/mergeIndividuals');
        xhttp.send(formData)

    }
}

function mergeImage(){
    /** Merges the selected image into the selected individual. */
    confirmMerge = true
    modalAlertIndividuals.modal('hide')

    detection_id = individualImages[individualSplide.index].detections[0].id
    if (unidentifiableOpen){
        access = individualImages[individualSplide.index].access
        if (access != 'write'){
            cleanupMergeIndividuals()
            cleanModalIndividual()
            cleanUnidentifiableModal()
            getIndividuals()
        }
    }
    if (selectedIndividual != null && selectedMergeIndividual != null) {
        var formData = new FormData()
        formData.append("merge_individual_id", JSON.stringify(selectedMergeIndividual))
        formData.append("individual_id", JSON.stringify(selectedIndividual))
        formData.append("detection_id", JSON.stringify(detection_id))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                cleanupMergeIndividuals()
                cleanModalIndividual()
                cleanUnidentifiableModal()
                getIndividuals()
            }
        }
        xhttp.open("POST", '/mergeDetectionIntoIndividual');
        xhttp.send(formData)
    }
}

function getMergeTasks(){
    /** Gets the merge tasks for the selected individual. */

    var mutualOnly = document.getElementById('mutualOnly').checked ? 1 : 0

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            var select = document.getElementById('mergeTaskSelect')
            clearSelect(select)
            fillSelect(select, ['All'], ['-1'])
            select.value = '-1'
            for (let i=0;i<reply.tasks.length;i++) {
                let task = reply.tasks[i]
                fillSelect(select, [task.name], [task.id])
            }

            if (mergeIndividualsFilters['task'] != null) {
                document.getElementById('mergeTaskSelect').value = mergeIndividualsFilters['task']
            }

            var tagSelect = document.getElementById('tagsMergeIndividuals')
            clearSelect(tagSelect)
            fillSelect(tagSelect, ['All'], ['0'])
            fillSelect(tagSelect, reply.tags, reply.tags)

            if (mergeIndividualsFilters['tags'] != null) {
                if (reply.tags.includes(mergeIndividualsFilters['tags'])) {
                    document.getElementById('tagsMergeIndividuals').value = mergeIndividualsFilters['tags']
                }
                else{
                    document.getElementById('tagsMergeIndividuals').value = '0'
                    mergeIndividualsFilters['tags'] = '0'
                }
            }

            getMergeIndividuals()
        }
    }
    xhttp.open("GET", '/getMergeTasks/'+selectedIndividual + '/individual?mutual='+mutualOnly);
    xhttp.send();
}

modalMergeIndividual.on('shown.bs.modal', function(){
    /** Initialises the merge individuals modal. */
    if (!modalAlertIndividualsReturn && !helpReturn) {
        initialiseMergeIndividualsLeft()
        initialiseMergeIndividualsRight()
    }
    else if (modalAlertIndividualsReturn) {
        modalAlertIndividualsReturn = false
    }
    else if (helpReturn) {
        helpReturn = false
    }
})

modalMergeIndividual.on('hidden.bs.modal', function(){
    /** Clears the merge individuals modal. */
    if (!modalAlertIndividualsReturn && !helpReturn) {
        cleanupMergeIndividuals()
        if (confirmMerge) {
            if (unidentifiableOpen){
                cleanUnidentifiableModal()
            } else {
                cleanModalIndividual()
            }
            confirmMerge = false
        }
        else{
            if (unidentifiableOpen){
                modalUnidentifiable.modal({keyboard: true})
            } else {
                modalIndividual.modal({keyboard: true})
            }
        }
    }
})


$('#btnConfirmDissociate').click( function() {
    /** Confirms the dissociation of the selected individual. */

    var removeImg = document.getElementById('removeImg').checked
    var moveImg = document.getElementById('moveImg').checked
    var imgUnidentifiable = document.getElementById('imgUnidentifiable').checked
    if (unidentifiableOpen){
        if (removeImg) {
            if (individualImages.length > 0 && individualImages[individualSplide.index].access=='write'){
                modalDissociateImage.modal('hide')
                restoreUnidSighting()
            }
        } else if (moveImg) {
            if (individualImages.length > 0 && individualImages[individualSplide.index].access=='write'){
                cleanupMergeIndividuals()
                mergeIndividualsOpened = true
                mergeImageOnly = true
                mergeImages['L'] = [individualImages[individualSplide.index]]
                individualTasks = [mergeImages['L'][0].detections[0].task]
                selectedIndividual = mergeImages['L'][0].detections[0].individual_id
                selectedIndividualName = 'Unidentifiable Sighting'
                modalDissociateImage.modal('hide')
                modalMergeIndividual.modal({keyboard: true});
            }
        }
    } else {
        if (removeImg) {
            if (individualImages.length > 1){
                modalDissociateImage.modal('hide')
                removeImage()
            }
        } else if (moveImg) {
            if (individualImages.length > 1){
                cleanupMergeIndividuals()
                mergeIndividualsOpened = true
                mergeImageOnly = true
                mergeImages['L'] = [individualImages[individualSplide.index]]
                modalDissociateImage.modal('hide')
                modalMergeIndividual.modal({keyboard: true});
            }
        } else if (imgUnidentifiable) {
            if (individualImages.length > 1){
                modalDissociateImage.modal('hide')
                markImgUnidentifiable()
            }
        }
    }
})

$('#btnCancelDissociate').click( function() {
    /** Cancels the dissociation of the selected individual. */
    modalDissociateImage.modal('hide')
    document.getElementById('removeImg').checked = true
    if (unidentifiableOpen){
        modalUnidentifiable.modal({keyboard: true})
    } else {
        modalIndividual.modal({keyboard: true});
    }
})

function updateMergePaginationCircles(current,total){
    /** Updates pagination circles on the merge modal. */

    var individualsPosition = null
    var cirNum = total
    var circlesIndex = current - 1
    var individualsPosition = document.getElementById('individualsPosition')
    var paginationCircles = document.getElementById('paginationCircles')


    if (individualsPosition != null) {
        while (paginationCircles.firstChild) {
            paginationCircles.removeChild(paginationCircles.firstChild);
        }

        var beginIndex = 0
        var endIndex = cirNum
        var multiple = false
        if (cirNum > 10) {
            multiple =  true
            beginIndex = Math.max(0,circlesIndex-2)
            if (beginIndex < 2) {
                beginIndex = 0
                endIndex = 5
            }
            else {
                endIndex = Math.min(cirNum,circlesIndex+3)
                if (endIndex > cirNum-2) {
                    endIndex = cirNum
                    beginIndex = cirNum - 5
                }
            }
        }

        if (multiple && beginIndex != 0 && circlesIndex > 2) {
            first = document.createElement('li')
            first.setAttribute('onclick','getMergeIndividuals(1)')
            first.style.fontSize = '60%'
            first.innerHTML = '1'
            paginationCircles.append(first)
        
            more = document.createElement('li')
            more.setAttribute('class','disabled')
            more.style.fontSize = '60%'
            more.innerHTML = '...'
            paginationCircles.append(more)
        }


        for (let i=beginIndex;i<endIndex;i++) {
            li = document.createElement('li')
            li.innerHTML = (i+1).toString()
            li.setAttribute('onclick','getMergeIndividuals('+(i+1).toString()+')')
            li.style.fontSize = '60%'
            paginationCircles.append(li)

            if (i == circlesIndex) {
                li.setAttribute('class','active')
            } else {
                li.setAttribute('class','')
            }
        }

        if (multiple && endIndex != cirNum && circlesIndex < cirNum-3) {
            more = document.createElement('li')
            more.setAttribute('class','disabled')
            more.innerHTML = '...'
            more.style.fontSize = '60%'
            paginationCircles.append(more)

            last_index = cirNum - 1
            last = document.createElement('li')
            last.setAttribute('onclick','getMergeIndividuals('+(last_index+1).toString()+')')
            last.innerHTML = (last_index+1).toString()
            last.style.fontSize = '60%'
            paginationCircles.append(last)
        }
    }

}

function initFeatureMaps(){
    /** Initialises the feature maps for the individual modal. */
    //Left feature
    var leftFeatureMapDiv = document.getElementById('leftFeatureMapDiv')
    while (leftFeatureMapDiv.firstChild) {
        leftFeatureMapDiv.removeChild(leftFeatureMapDiv.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var response = JSON.parse(this.responseText);
            // Process the response as needed
            individualFlankImages['L'] = response.data;
            flankImageIndex['L'] = 0
            globalFeatures['L'] = {}
            if (individualFlankImages['L'].length > 0) {
                if (imgMaps['leftFeatureMapDiv'] != null) {
                    imgMaps['leftFeatureMapDiv'].remove();
                }
                prepFeatureMap('leftFeatureMapDiv', 'L', individualFlankImages['L'][0].url, individualFlankImages['L'][0].detection, 30);
            }
            else {
                leftFeatureMapDiv.innerHTML = 'No Left Flank Features';
                updateFeatureButtons('L');
            }
            
        }
    };
    xhttp.open("GET", '/getIndividualFlankDets/'+selectedIndividual+'/L');
    xhttp.send();

    //Right feature
    var rightFeatureMapDiv = document.getElementById('rightFeatureMapDiv')
    while (rightFeatureMapDiv.firstChild) {
        rightFeatureMapDiv.removeChild(rightFeatureMapDiv.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var response = JSON.parse(this.responseText);
            // Process the response as needed
            individualFlankImages['R'] = response.data;
            flankImageIndex['R'] = 0
            globalFeatures['R'] = {}
            if (individualFlankImages['R'].length > 0) {
                if (imgMaps['rightFeatureMapDiv'] != null) {
                    imgMaps['rightFeatureMapDiv'].remove();
                }
                prepFeatureMap('rightFeatureMapDiv', 'R', individualFlankImages['R'][0].url, individualFlankImages['R'][0].detection, 30);
            }
            else {
                rightFeatureMapDiv.innerHTML = 'No Right Flank Features';
                updateFeatureButtons('R');
            }
        }
    }
    xhttp.open("GET", '/getIndividualFlankDets/'+selectedIndividual+'/R');
    xhttp.send();
}

function prepFeatureMap(div_id, flank, image_url, detection,size=15) {
    /** Prepares the image map for the individual modal. */
    if (bucketName != null) {
        // var imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCropURL(image_url,detection.id)
        imgMapsFullRes[div_id] = false
        var imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image_url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height
            if (w>h) {
                document.getElementById(div_id).setAttribute('style','height: calc('+size+'vw *'+(h/w)+');  width:'+size+'vw')
            } else {
                document.getElementById(div_id).setAttribute('style','height: calc('+size+'vw *'+(w/h)+');  width:'+size+'vw')
            }
            L.Browser.touch = true
        
            imgMaps[div_id] = new L.map(div_id, {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0
            })

            var h1 = document.getElementById(div_id).clientHeight
            var w1 = document.getElementById(div_id).clientWidth
            var southWest = imgMaps[div_id].unproject([0, h1], 2);
            var northEast = imgMaps[div_id].unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);

            imgMapsActiveImage[div_id] = L.imageOverlay(imageUrl, bounds).addTo(imgMaps[div_id]);

            imgMapsActiveImage[div_id].on('load', function() {
                if (individualFlankImages[flank].length > 0 && individualFlankImages[flank][flankImageIndex[flank]] != null) {
                    addFeatures(div_id, individualFlankImages[flank][flankImageIndex[flank]].detection)
                    let det = individualFlankImages[flank][flankImageIndex[flank]].detection
                    if (det != null) {
                        det_bounds = [[det.top*imgMapsHeight[div_id],det.left*imgMapsWidth[div_id]],[det.bottom*imgMapsHeight[div_id],det.right*imgMapsWidth[div_id]]]
                        imgMaps[div_id].fitBounds(det_bounds, {padding: [10,10]});
                    }
                }
            });
            imgMapsActiveImage[div_id].on('error', function() {
                if (!this._url.includes('-comp')) {
                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualFlankImages[flank][flankImageIndex[flank]].url));
                }
            });

            imgMapsWidth[div_id] = northEast.lng
            imgMapsHeight[div_id] = southWest.lat
            imgMaps[div_id].setMaxBounds(bounds);
            imgMaps[div_id].fitBounds(bounds)
            imgMaps[div_id].setMinZoom(imgMaps[div_id].getZoom())

            imgMaps[div_id].on('resize', function(){
                if (imgMaps[div_id] != null&&document.getElementById(div_id) && document.getElementById(div_id).clientHeight) {
                    var h1 = document.getElementById(div_id).clientHeight
                    var w1 = document.getElementById(div_id).clientWidth

                    var southWest = imgMaps[div_id].unproject([0, h1], 2);
                    var northEast = imgMaps[div_id].unproject([w1, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);

                    imgMapsWidth[div_id] = northEast.lng
                    imgMapsHeight[div_id] = southWest.lat

                    imgMaps[div_id].invalidateSize()
                    imgMaps[div_id].setMaxBounds(bounds)
                    imgMaps[div_id].fitBounds(bounds)
                    imgMaps[div_id].setMinZoom(imgMaps[div_id].getMinZoom())
                    imgMapsActiveImage[div_id].setBounds(bounds)

                    if (individualFlankImages[flank].length > 0 && individualFlankImages[flank][flankImageIndex[flank]] != null) {
                        addFeatures(div_id, individualFlankImages[flank][flankImageIndex[flank]].detection)
                    }

                    setTimeout(function() {
                        let det = individualFlankImages[flank][flankImageIndex[flank]].detection
                        if (det != null) {
                            var det_bounds = [[det.top*imgMapsHeight[div_id],det.left*imgMapsWidth[div_id]],[det.bottom*imgMapsHeight[div_id],det.right*imgMapsWidth[div_id]]]
                            imgMaps[div_id].fitBounds(det_bounds, {padding: [10,10]});
                        }
                    }, 500);
                }
            });

            imgMaps[div_id].on('drag', function(divID, wrapBounds) {
                /** Prevents the map from being dragged outside of the bounds. */
                return function () {
                    imgMaps[divID].panInsideBounds(wrapBounds, { animate: false });
                }
            }(div_id, bounds));

            imgMaps[div_id].on('zoomstart', function(divID) {
                return function () { 
                    if (!imgMapsFullRes[divID]) {
                        imgMapsActiveImage[divID].setUrl("https://"+bucketName+".s3.amazonaws.com/" + individualFlankImages[flank][flankImageIndex[flank]].url);
                        imgMapsFullRes[divID] = true;
                    }
                }
            }(div_id));

            drawnFeatureItems[div_id] = new L.FeatureGroup();
            imgMaps[div_id].addLayer(drawnFeatureItems[div_id]);
            leafletFeatureIDs[div_id] = {}

            featureOptions = {
                color: "rgba(91,192,222,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }

            if (featureDrawControl[div_id] != null) {
                featureDrawControl[div_id].remove()
            }
            featureDrawControl[div_id] = new L.Control.Draw({
                draw: {
                    polygon: {
                        shapeOptions: featureOptions,
                        allowIntersection: false,
                    },
                    polyline: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    rectangle: false
                },
                edit: {
                    featureGroup: drawnFeatureItems[div_id],
                }
            });
            imgMaps[div_id].addControl(featureDrawControl[div_id]);
            featureDrawControl[div_id]._toolbars.draw._toolbarContainer.children[0].title = 'Draw a feature'


            featureEditPrep(flank,div_id)

            updateFeatureButtons(flank);

        }
        img.src = imageUrl
    }
}

function addFeatures(div_id, detection) {
    /** Adds features to the map. */
    featureOptions = {
        color: "rgba(91,192,222,1)",
        fill: true,
        fillOpacity: 0.0,
        opacity: 0.8,
        weight:3,
        contextmenu: false,
    }

    drawnFeatureItems[div_id].clearLayers()
    leafletFeatureIDs[div_id] = {}

    for (let i=0;i<detection.features.length;i++) {
        var feature = detection.features[i]

        if (globalFeatures[detection.flank][detection.id] && globalFeatures[detection.flank][detection.id]['removed'].includes(feature.id.toString())) {
            continue          
        }

        if (globalFeatures[detection.flank][detection.id] && globalFeatures[detection.flank][detection.id]['edited'][feature.id]) {
            var poly_coords = []
            for (let j=0;j<globalFeatures[detection.flank][detection.id]['edited'][feature.id].coords.length;j++) {
                poly_coords.push([globalFeatures[detection.flank][detection.id]['edited'][feature.id].coords[j][1]*imgMapsHeight[div_id],globalFeatures[detection.flank][detection.id]['edited'][feature.id].coords[j][0]*imgMapsWidth[div_id]])
            }
        } else {
            var poly_coords = []
            for (let j=0;j<feature.coords.length;j++) {
                poly_coords.push([feature.coords[j][1]*imgMapsHeight[div_id],feature.coords[j][0]*imgMapsWidth[div_id]])
            }
        }

        var poly = L.polygon(poly_coords, featureOptions).addTo(imgMaps[div_id])
        drawnFeatureItems[div_id].addLayer(poly)
        leafletFeatureIDs[div_id][feature.id] = poly._leaflet_id
    }

    if (globalFeatures[detection.flank][detection.id] && globalFeatures[detection.flank][detection.id]['added']) {
        for (let feature_id in globalFeatures[detection.flank][detection.id]['added']) {
            var feature = globalFeatures[detection.flank][detection.id]['added'][feature_id]
            var poly_coords = []
            for (let j=0;j<feature.coords.length;j++) {
                poly_coords.push([feature.coords[j][1]*imgMapsHeight[div_id],feature.coords[j][0]*imgMapsWidth[div_id]])
            }
            var poly = L.polygon(poly_coords, featureOptions).addTo(imgMaps[div_id])
            drawnFeatureItems[div_id].addLayer(poly)
            leafletFeatureIDs[div_id][feature_id] = poly._leaflet_id
        }
    }
}

function updateFeatureButtons(flank) {
    /** Updates the feature buttons in the modal. */

    if (flank=='L') {
        var leftBtn = document.getElementById('btnLeftFlankPrev')
        var rightBtn = document.getElementById('btnLeftFlankNext')
        var flankImagesPosition = document.getElementById('leftFlankPosition')
        var paginationCircles = document.getElementById('leftFlankPaginationCircles')
        var cxPrimaryImage = document.getElementById('cxLeftPrimaryImage')
        var cxPrimaryDiv = document.getElementById('cxLeftPrimaryDiv')
        var div_id = 'leftFeatureMapDiv'
    }
    else if (flank=='R') {
        var leftBtn = document.getElementById('btnRightFlankPrev')
        var rightBtn = document.getElementById('btnRightFlankNext')
        var flankImagesPosition = document.getElementById('rightFlankPosition')
        var paginationCircles = document.getElementById('rightFlankPaginationCircles')
        var cxPrimaryImage = document.getElementById('cxRightPrimaryImage')
        var cxPrimaryDiv = document.getElementById('cxRightPrimaryDiv')
        var div_id = 'rightFeatureMapDiv'
    }

    if (featureDrawControl[div_id]) {
        if(individualBestDets[flank] && individualBestDets[flank].length > 0 && individualBestDets[flank][0].detection.id == individualFlankImages[flank][flankImageIndex[flank]].detection.id) {
            cxPrimaryImage.checked = true
            if (individualAccess=='write') {
                cxPrimaryImage.disabled = false
                featureDrawControl[div_id]._toolbars.draw._toolbarContainer.style.display = 'block';
                featureDrawControl[div_id]._toolbars.edit._toolbarContainer.style.display = 'block';
            } else {
                cxPrimaryImage.disabled = true
                featureDrawControl[div_id]._toolbars.draw._toolbarContainer.style.display = 'none';
                featureDrawControl[div_id]._toolbars.edit._toolbarContainer.style.display = 'none';
            }
        } else {
            if (individualAccess=='write') {
                cxPrimaryImage.disabled = false
            } else {
                cxPrimaryImage.disabled = true
            }
            cxPrimaryImage.checked = false
            featureDrawControl[div_id]._toolbars.draw._toolbarContainer.style.display = 'none';
            featureDrawControl[div_id]._toolbars.edit._toolbarContainer.style.display = 'none';
        }
    }


    if (individualFlankImages[flank].length == 0) {
        leftBtn.hidden = true
        rightBtn.hidden = true
        cxPrimaryDiv.hidden = true
    } else{
        leftBtn.hidden = false
        rightBtn.hidden = false
        cxPrimaryDiv.hidden = false
    }

    if (flankImageIndex[flank] == 0) {
        leftBtn.disabled = true
    }
    else {
        leftBtn.disabled = false
    }
    if (flankImageIndex[flank] == individualFlankImages[flank].length - 1) {
        rightBtn.disabled = true
    }
    else {
        rightBtn.disabled = false
    }

    var cirNum = individualFlankImages[flank].length
    var circlesIndex = flankImageIndex[flank]

    if (flankImagesPosition != null) {
        while (paginationCircles.firstChild) {
            paginationCircles.removeChild(paginationCircles.firstChild);
        }

        var beginIndex = 0
        var endIndex = cirNum
        var multiple = false
        if (cirNum > 10) {
            multiple =  true
            beginIndex = Math.max(0,circlesIndex-2)
            if (beginIndex < 2) {
                beginIndex = 0
                endIndex = 5
            }
            else {
                endIndex = Math.min(cirNum,circlesIndex+3)
                if (endIndex > cirNum-2) {
                    endIndex = cirNum
                    beginIndex = cirNum - 5
                }
            }
        }

        if (multiple && beginIndex != 0 && circlesIndex > 2) {
            first = document.createElement('li')
            first.addEventListener('click', function() {updateFlankImageIndex(flank, 0);});
            // first.style.fontSize = '80%'
            first.innerHTML = '1'
            paginationCircles.append(first)
        
            more = document.createElement('li')
            more.setAttribute('class','disabled')
            // more.style.fontSize = '80%'
            more.innerHTML = '...'
            paginationCircles.append(more)
        }


        for (let i=beginIndex;i<endIndex;i++) {
            li = document.createElement('li')
            li.innerHTML = (i+1).toString()
            li.addEventListener('click', function() {updateFlankImageIndex(flank, i);});
            // li.style.fontSize = '80%'
            paginationCircles.append(li)

            if (i == circlesIndex) {
                li.setAttribute('class','active')
            } else {
                li.setAttribute('class','')
            }
        }

        if (multiple && endIndex != cirNum && circlesIndex < cirNum-3) {
            more = document.createElement('li')
            more.setAttribute('class','disabled')
            more.innerHTML = '...'
            // more.style.fontSize = '80%'
            paginationCircles.append(more)

            last_index = cirNum - 1
            last = document.createElement('li')
            last.addEventListener('click', function() {updateFlankImageIndex(flank, last_index);});
            last.innerHTML = (last_index+1).toString()
            // last.style.fontSize = '80%'
            paginationCircles.append(last)
        }
    }
}

function updateFlankImageIndex(flank,index) {
    /** Updates the flank image index and refreshes the feature map. */
    if (index >= 0 && index < individualFlankImages[flank].length) {
        flankImageIndex[flank] = index
        updateFeatureMap(flank)
    }
}

function updateFeatureMap(flank){
    /** Updates the feature map for the selected flank. */
    if (flank == 'L') {
        var div_id = 'leftFeatureMapDiv'
    }
    else if (flank == 'R') {
        var div_id = 'rightFeatureMapDiv'
    }

    if (imgMaps[div_id] == null){
        prepFeatureMap(div_id, flank, individualFlankImages[flank][flankImageIndex[flank]].url, individualFlankImages[flank][flankImageIndex[flank]].detection, 30)
    }
    else if (imgMapsActiveImage[div_id] != null && individualFlankImages[flank][flankImageIndex[flank]] != null) {
        // imgMapsActiveImage[div_id].setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCropURL(individualFlankImages[flank][flankImageIndex[flank]].url, individualFlankImages[flank][flankImageIndex[flank]].detection.id));
        imgMapsFullRes[div_id] = false
        imgMapsActiveImage[div_id].setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualFlankImages[flank][flankImageIndex[flank]].url));
    }

    updateFeatureButtons(flank);
}

$('#btnLeftFlankPrev').click( function() {
    /** Goes to the previous left flank image. */
    if (flankImageIndex['L'] > 0) {
        updateFlankImageIndex('L', flankImageIndex['L'] - 1)
    } else {
        updateFeatureButtons('L');
    }
});

$('#btnLeftFlankNext').click( function() {
    /** Goes to the next left flank image. */
    if (flankImageIndex['L'] < individualFlankImages['L'].length - 1) {
        updateFlankImageIndex('L', flankImageIndex['L'] + 1)
    } else {
        updateFeatureButtons('L');
    }
});

$('#btnRightFlankPrev').click( function() {
    /** Goes to the previous right flank image. */
    if (flankImageIndex['R'] > 0) {
        updateFlankImageIndex('R', flankImageIndex['R'] - 1)
    } else {
        updateFeatureButtons('R');
    }
});

$('#btnRightFlankNext').click( function() {
    /** Goes to the next right flank image. */
    if (flankImageIndex['R'] < individualFlankImages['R'].length - 1) {
        updateFlankImageIndex('R', flankImageIndex['R'] + 1)
    } else {
        updateFeatureButtons('R');
    }
});


$('#cxLeftPrimaryImage').on('change', function() {
    /** Toggles the primary image for the features. */
    unsavedChanges = true
    updateFlankPrimary(this.checked, 'L', 'leftFeatureMapDiv');
});


$('#cxRightPrimaryImage').on('change', function() {
    /** Toggles the primary image for the features. */
    unsavedChanges = true
    updateFlankPrimary(this.checked, 'R', 'rightFeatureMapDiv');
});

function updateFlankPrimary(checked,flank,div_id) {
    /** Updates the flank primary image. */
    det_id = individualFlankImages[flank][flankImageIndex[flank]].detection.id
    if (checked) {
        /** Sets the current flank image as the primary image. */
        featureDrawControl[div_id]._toolbars.draw._toolbarContainer.style.display = 'block';
        featureDrawControl[div_id]._toolbars.edit._toolbarContainer.style.display = 'block';
        if (!globalFeatures[flank][det_id]) {
            globalFeatures[flank][det_id] = {}
        }
        globalFeatures[flank][det_id]['edited'] = {}
        globalFeatures[flank][det_id]['added'] = {}
        globalFeatures[flank][det_id]['removed'] = []
        globalFeatures[flank][det_id]['user_selected'] = 'true'
        individualBestDets[flank] = [{
            'detection': individualFlankImages[flank][flankImageIndex[flank]].detection,
            'url': individualFlankImages[flank][flankImageIndex[flank]].url,
        }]
    } else {
        /** Unsets the current flank image as the primary image. */
        featureDrawControl[div_id]._toolbars.draw._toolbarContainer.style.display = 'none';
        featureDrawControl[div_id]._toolbars.edit._toolbarContainer.style.display = 'none';
        delete globalFeatures[flank][det_id]
        individualBestDets[flank] = []
    }
}


function featureEditPrep(flank,div_id){

    imgMaps[div_id].on("draw:drawstart", function(e) {
        /** Enables editing when drawing starts. */
        editingEnabled = true
    })

    imgMaps[div_id].on("draw:drawstop", function(e) {
        /** Disables editing when drawing stops. */
        editingEnabled = false
    })

    imgMaps[div_id].on("draw:editstart", function(e) {
        /** Enables editing when editing starts. */
        editingEnabled = true
    })

    imgMaps[div_id].on("draw:editstop", function(e) {
        /** Disables editing when editing stops and updates the features. */
        document.getElementById('individualFeaturesErrors').innerHTML = ""
        editingEnabled = false

        // check any overlaps
        var isOverlapping = false;
        drawnFeatureItems[div_id].eachLayer(function (layer) {
            var bounds = layer.getBounds();
            drawnFeatureItems[div_id].eachLayer(function (otherLayer) {
                if (layer != otherLayer && bounds.intersects(otherLayer.getBounds())) {
                    isOverlapping = true;
                    return; // Use return to exit the inner function
                }
            });
            if (isOverlapping){return; } // Exit the outer function if an overlap is found
        });

        if (isOverlapping && document.getElementById('individualFeaturesErrors') != null) {
            document.getElementById('individualFeaturesErrors').innerHTML = "The feature you've outlined overlaps with another feature. It is recommended that you either adjust the existing feature or delete it and create a new one."
        }

        updateFeatures(flank,div_id)
    })

    imgMaps[div_id].on("draw:deletestart", function(e) {
        /** Enables editing when deleting starts. */
        editingEnabled = true
    })

    imgMaps[div_id].on("draw:deletestop", function(e) {
        /** Disables editing when deleting stops and updates the features. */
        document.getElementById('individualFeaturesErrors').innerHTML = ""
        editingEnabled = false
        updateFeatures(flank,div_id)
    })

    imgMaps[div_id].on('draw:created', function (e) {
        /** Adds a new feature when created. */
        document.getElementById('individualFeaturesErrors').innerHTML = ""
        var newLayer = e.layer;
        var newBounds = newLayer.getBounds();
        var isOverlapping = false;

        // Check if the new feature is contained within det_bounds
        var detection = individualFlankImages[flank][flankImageIndex[flank]].detection
        var det_bounds = [[detection.top*imgMapsHeight[div_id], detection.left*imgMapsWidth[div_id]],[detection.bottom*imgMapsHeight[div_id], detection.right*imgMapsWidth[div_id]]]
        det_bounds = L.latLngBounds(det_bounds)
        if (!det_bounds.contains(newBounds)) {
            return;
        }

        drawnFeatureItems[div_id].eachLayer(function (layer) {
            if (newBounds.intersects(layer.getBounds())) {
                isOverlapping = true;
            }
        });

        if (isOverlapping && document.getElementById('individualFeaturesErrors') != null) {
            document.getElementById('individualFeaturesErrors').innerHTML = "The feature you've outlined overlaps with another feature. It is recommended that you either adjust the existing feature or delete it and create a new one."
        }
        
        drawnFeatureItems[div_id].addLayer(newLayer);
        let added_ids = []
        if (globalFeatures[flank][detection.id] && globalFeatures[flank][detection.id]['added']) {
            added_ids = Object.keys(globalFeatures[flank][detection.id]['added']);
        }
        let new_id = 'l_' + (added_ids.length > 0 ? Math.max(...added_ids.map(id => parseInt(id.replace('l_', '')))) + 1 : 1);

        leafletFeatureIDs[div_id][new_id] = newLayer._leaflet_id

        updateFeatures(flank,div_id)

    });

}

function updateFeatures(flank,divID) {
    /** Updates the features after an edit has been performed. */
    unsavedChanges = true
    any_out_of_bounds = false
    det_id = individualFlankImages[flank][flankImageIndex[flank]].detection.id
    if (!globalFeatures[flank][det_id]) {
        globalFeatures[flank][det_id] = {}

        globalFeatures[flank][det_id]['user_selected'] = 'false'
        globalFeatures[flank][det_id]['removed'] = []
        globalFeatures[flank][det_id]['edited'] = {}
        globalFeatures[flank][det_id]['added'] = {}
    }

    // globalFeatures[flank][det_id]['edited'] = {}
    // globalFeatures[flank][det_id]['added'] = {}
    // globalFeatures[flank][det_id]['removed'] = []

    drawnFeatureItems[divID].eachLayer(function (layer) {
        /** Iterates through each drawn feature and updates the global features. */
        var coords = layer._latlngs;
        if (coords.length > 0) {
            coords = coords[0];
        }

        var outofbounds = false
        var detection = individualFlankImages[flank][flankImageIndex[flank]].detection
        var det_bounds = [[detection.top*imgMapsHeight[divID], detection.left*imgMapsWidth[divID]],[detection.bottom*imgMapsHeight[divID], detection.right*imgMapsWidth[divID]]]
        det_bounds = L.latLngBounds(det_bounds)
        if (!det_bounds.contains(layer.getBounds())) {
            outofbounds = true
        }
        if (outofbounds) {
            any_out_of_bounds = true  
            // go to next layer
            return;
        }
        var new_coords = [];
        for (var j = 0; j < coords.length; j++) {
            new_coords.push([coords[j].lng / imgMapsWidth[divID], coords[j].lat / imgMapsHeight[divID]]);
        }
        new_coords.push(new_coords[0]); // Ensure the polygon is closed
        var featureID = Object.keys(leafletFeatureIDs[divID]).find(key => leafletFeatureIDs[divID][key] === layer._leaflet_id);
        if (featureID) {
            if (featureID.startsWith('l_')) {
                // New feature added
                globalFeatures[flank][det_id]['added'][featureID] = {
                    'coords': new_coords,
                    'detection_id': det_id,
                };
            } else {
                // Existing feature edited
                globalFeatures[flank][det_id]['edited'][featureID] = {
                    'coords': new_coords,
                    'detection_id': det_id,
                };
            }
        }
    });

    // Remove features that are not in the drawn items

    for (var featureID in leafletFeatureIDs[divID]) {
        /** Checks if the feature is still in the drawn items and removes it if not. */
        if (!drawnFeatureItems[divID].getLayer(leafletFeatureIDs[divID][featureID])) {
            if (featureID.startsWith('l_')) {
                // If it's a new feature, remove it from added
                delete globalFeatures[flank][det_id]['added'][featureID];
            } else {
                // If it's an existing feature, add it to removed
                globalFeatures[flank][det_id]['removed'].push(featureID);
                delete globalFeatures[flank][det_id]['edited'][featureID];
            }
            delete leafletFeatureIDs[divID][featureID];
        }
    }

    globalFeatures[flank][det_id]['removed'] = [...new Set(globalFeatures[flank][det_id]['removed'])];
    if (any_out_of_bounds){
        addFeatures(divID, individualFlankImages[flank][flankImageIndex[flank]].detection)
    }
}

function submitFeatures(){
    /** Submits the features for the selected individual. */

    if (editingEnabled) {
        document.getElementById('individualFeaturesErrors').innerHTML = "Please finish editing before submitting features."
        document.getElementById('btnSubmitInfoChange').disabled = false
        return;
    }

    var featuresDict = {}
    for (let flank in globalFeatures) {
        for (let det_id in globalFeatures[flank]) {
            if (globalFeatures[flank][det_id]['user_selected'] == 'true' || (Object.keys(globalFeatures[flank][det_id]['edited']).length > 0 || Object.keys(globalFeatures[flank][det_id]['added']).length > 0 || globalFeatures[flank][det_id]['removed'].length > 0)) {
                featuresDict[det_id] = globalFeatures[flank][det_id]
            }
        }
    }

    console.log(featuresDict)

    if (Object.keys(featuresDict).length > 0 && selectedIndividual != null && document.getElementById('individualFeaturesErrors').innerHTML == "") {
        var formData = new FormData()
        formData.append("features", JSON.stringify(featuresDict))
        formData.append("individual_id", selectedIndividual)

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                document.getElementById('btnSubmitInfoChange').disabled = false
                initFeatureMaps()
            }
        }
        xhttp.open("POST", '/submitFeatures');
        xhttp.send(formData)

    } else{
        document.getElementById('btnSubmitInfoChange').disabled = false
    }

}

function changeIndivTab(evt, tabName) {
    /** Opens the indivs tab */

    var mainModal = document.getElementById('modalIndividual')
    var tabcontent = mainModal.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    var tablinks = mainModal.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActiveIndiv = tabName

    if (tabName == 'baseIndivSummaryTab') {
        // getIndividual(selectedIndividual,selectedIndividualName)
        openIndivTab()
    }
    else if (tabName == 'baseIndivFeaturesTab') {
        // initFeatureMaps()
        openFeaturesTab()
    }
    else if (tabName == 'baseIndivStatsTab') {
        // initialiseStats()
        openStatsTab()
    }
    else if (tabName == 'baseIndivAssociationsTab') {
        // buildAssociationTable(selectedIndividual)
        openAssociationsTab()
    }

}

function openIndivTab() {
    /** Opens the individual tab and populates the individual data. */
    if (map==null||associationClick) {
        getIndividual(selectedIndividual,selectedIndividualName,associationClick)
        associationClick = false
    }
}

function openFeaturesTab() {
    /** Opens the features tab and initialises the feature maps. */
    if (Object.keys(individualFlankImages).length == 0) {
        initFeatureMaps()
    }
}

function openStatsTab() {
    /** Opens the stats tab and initialises the stats. */
    if (document.getElementById('statisticsDiv').firstChild===null) {
        initialiseStats()
    }
}

function openAssociationsTab() {
    /** Opens the associations tab and builds the association table. */
    if (document.getElementById('associationsDiv').firstChild===null) {
        buildAssociationTable(selectedIndividual)
    }
}

$('#newIndividualName').on('change', function() {
    unsavedChanges = true
});

$('#idNotes').on('change', function() {
    unsavedChanges = true
});

$('#btnCancelDiscard').click( function() {
    /** Cancels the discard and reopens the modal. */
    associationClick = false
    modalDiscard.modal('hide')
    modalIndividual.modal({keyboard: true})
});

$('#btnConfirmDiscard').click( function() {
    /** Confirms the discard and closes the modal. */
    modalDiscard.modal('hide')
    if (associationClick) {
        /** If the discard was triggered by an association click, reset the individual selection. */
            associationClick = false
            cleanModalIndividual()
            selectedIndividual = associationID
            selectedIndividualName = associationName
            document.getElementById('openIndivSummary').click()
    } else {
        cleanModalIndividual()
        getIndividuals(current_page)
        // getTasks()
    }
});

function getAreas(){
    /** Fetches the areas from the server and populates the area selector. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var reply = JSON.parse(this.responseText);
            var areas = reply.areas
            var areaSelect = document.getElementById('areaSelect')
            clearSelect(areaSelect)
            var areaOptionTexts = ['All']
            var areaOptionValues = ['0']
            for (var i=0;i<areas.length;i++) {
                areaOptionTexts.push(areas[i])
                areaOptionValues.push(areas[i])
            }
            fillSelect(areaSelect,areaOptionTexts,areaOptionValues)

            addSurvey()
            checkSurvey()
        }
    };
    xhttp.open("GET", '/getAreas');
    xhttp.send();
}

$('#areaSelect').on('change', function() {
    /** Updates the area when the area selector changes. */
    surveySelect = document.getElementById('surveySelect')
    while(surveySelect.firstChild){
        surveySelect.removeChild(surveySelect.firstChild);
    }
    addSurveyTask = document.getElementById('addSurveyTask')
    while(addSurveyTask.firstChild){
        addSurveyTask.removeChild(addSurveyTask.firstChild);
    }
    addSurvey()
    checkSurvey()
});

function getUnidentifiable(){
    /** Fetches unidentifiable sightings based on the selected filters. */

    var species = document.getElementById('unidSpeciesSelect').value
    var site = document.getElementById('unidSitesSelect').value
    var task = document.getElementById('unidTaskSelect').value

    var order_value = document.getElementById("orderUnidImages").value
    if(document.getElementById('ascOrderUnid').checked){
        order_value = 'a' + order_value
    }
    else{
        order_value = 'd' + order_value
    }

    validateDateRange()
    
    if(validDate && document.getElementById("startDateUnid").value != "" ){
        startDate = document.getElementById("startDateUnid").value + ' 00:00:00'
    }
    else{
        startDate = ''
    }

    if(validDate && document.getElementById("endDateUnid").value != "" ){
        endDate = document.getElementById("endDateUnid").value + ' 23:59:59'
    }
    else{
        endDate = ''
    }

    var formData = new FormData()
    formData.append("species", JSON.stringify(species))
    formData.append("site", JSON.stringify(site))
    formData.append("task_id", JSON.stringify(task))
    formData.append("order", JSON.stringify(order_value))
    formData.append("start_date", JSON.stringify(startDate))
    formData.append("end_date", JSON.stringify(endDate))


    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            individualImages = reply.individual
            if (individualImages.length>0){

                document.getElementById('tgInfoUnid').innerHTML = individualImages[0].trapgroup.tag
                document.getElementById('timeInfoUnid').innerHTML = individualImages[0].timestamp

                document.getElementById('labelsDivUnid').innerHTML =  individualImages[0].detections[0].species
                document.getElementById('surveysDivUnid').innerHTML = individualImages[0].detections[0].task

                if (individualImages[0].access=='write'){
                    document.getElementById('btnRestoreDetUnid').disabled = false
                }
                else{
                    document.getElementById('btnRestoreDetUnid').disabled = true
                }

                initUnidMap()
                prepMapIndividual(individualImages[0])
                updateSlider()
            } else {
                var center = document.getElementById('centerMapUnid')
                while(center.firstChild){
                    center.removeChild(center.firstChild)
                }

                var splideDiv = document.getElementById('splideDivUnid')
                while(splideDiv.firstChild){
                    splideDiv.removeChild(splideDiv.firstChild);
                }

                document.getElementById('tgInfoUnid').innerHTML = ''
                document.getElementById('timeInfoUnid').innerHTML = ''
                
                document.getElementById('labelsDivUnid').innerHTML =  ''
                document.getElementById('surveysDivUnid').innerHTML = ''

                var noData = document.createElement('h4')
                noData.setAttribute('style','color: white; text-align: center; margin-top: 20px')
                noData.innerHTML = 'No unidentifiable sightings found.'
                center.appendChild(noData)

                document.getElementById('btnRestoreDetUnid').disabled = true
            }

        }
    };
    xhttp.open("POST", '/getUnidentifiable');
    xhttp.send(formData)
        
}

$('#btnEditUnidentifiable').click( function() {
    /** Opens the unidentifiable modal. */
    cleanModalIndividual()
    cleanUnidentifiableModal()
    modalUnidentifiable.modal({keyboard: true})
});

function cleanUnidentifiableModal() {
    /** Cleans the unidentifiable modal */
    var splideDiv = document.getElementById('splideDivUnid')
    while(splideDiv.firstChild){
        splideDiv.removeChild(splideDiv.firstChild);
    }

    var center = document.getElementById('centerMapUnid')
    while(center.firstChild){
        center.removeChild(center.firstChild)
    }

    clearSelect(document.getElementById('unidSpeciesSelect'))
    clearSelect(document.getElementById('unidSitesSelect'))
    clearSelect(document.getElementById('unidTaskSelect'))

    document.getElementById('ascOrderUnid').checked = true
    document.getElementById('orderUnidImages').value = '1'	
    document.getElementById('startDateUnid').value = ''
    document.getElementById('endDateUnid').value = ''

    document.getElementById('tgInfoUnid').innerHTML = ''
    document.getElementById('timeInfoUnid').innerHTML = ''
    
    document.getElementById('labelsDivUnid').innerHTML =  ''
    document.getElementById('surveysDivUnid').innerHTML = ''

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
    addedDetections = false
    selectedIndividual = null
    selectedIndividualName = null
    individualTasks = []

}

modalUnidentifiable.on('shown.bs.modal', function () {
    /** Initializes the unidentifiable modal when shown. */
    if (map== null || !unidentifiableOpen) {
        unidentifiableOpen = true
        initUnidentifiable()
    }
});

modalUnidentifiable.on('hidden.bs.modal', function () {
    /** Cleans the unidentifiable modal when hidden. */
    if (!helpReturn && !modalAlertIndividualsReturn) {
        unidentifiableOpen = false
        cleanUnidentifiableModal()
        getIndividuals(current_page)
    } else {
        helpReturn = false
        modalAlertIndividualsReturn = false
    }
});


function initUnidMap(){
    /** Initializes the unidentifiable map and slider components. */
    map = null
    individualSplide = null

    var center = document.getElementById('centerMapUnid')
    while(center.firstChild){
        center.removeChild(center.firstChild)
    }

    var mapDiv = document.createElement('div')
    mapDiv.setAttribute('id','mapDiv')
    mapDiv.setAttribute('style','height: 700px')
    center.appendChild(mapDiv)


    var splideDiv = document.getElementById('splideDivUnid')

    while(splideDiv.firstChild){
        splideDiv.removeChild(splideDiv.firstChild);
    }

    var card = document.createElement('div')
    card.classList.add('card')
    card.setAttribute('style','background-color: rgb(60, 74, 89);margin-top: 5px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 5px')
    splideDiv.appendChild(card)

    var body = document.createElement('div')
    body.classList.add('card-body')
    body.setAttribute('style','margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px')
    card.appendChild(body)

    var splide = document.createElement('div')
    splide.classList.add('splide')
    splide.setAttribute('id','splide')
    body.appendChild(splide)

    var track = document.createElement('div')
    track.classList.add('splide__track')
    splide.appendChild(track)

    var list = document.createElement('ul')
    list.classList.add('splide__list')
    list.setAttribute('id','imageSplide')
    track.appendChild(list)

}

function initUnidentifiable() {
    /** Initializes the unidentifiable modal by resetting components. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            //Populate species selector
            texts = ['All']
            texts.push(...reply.species)
            values = ['0']
            values.push(...reply.species)
            clearSelect(document.getElementById('unidSpeciesSelect'))
            fillSelect(document.getElementById('unidSpeciesSelect'), texts, values)

            //Populate site selector
            texts = ['All']
            texts.push(...reply.sites)
            values = ['0']
            values.push(...reply.sites)
            clearSelect(document.getElementById('unidSitesSelect'))
            fillSelect(document.getElementById('unidSitesSelect'), texts, values)


            texts = ['All']
            values = ['0']
            for (let i=0;i<reply.tasks.length;i++) {
                texts.push(reply.tasks[i].name)
                values.push(reply.tasks[i].id)
            }
            clearSelect(document.getElementById('unidTaskSelect'))
            fillSelect(document.getElementById('unidTaskSelect'), texts, values)

            getUnidentifiable()
        }
    }
    xhttp.open("GET", '/getAllUnidSpeciesSitesAndTasks');
    xhttp.send();

}

$('#orderUnidImages').on('change', function() {
    getUnidentifiable()
});

$('#ascOrderUnid').on('change', function() {
    getUnidentifiable()
});

$('#ascOrderUnid').on('change', function() {
    getUnidentifiable()
});

$('#unidSitesSelect').on('change', function() {
    getUnidentifiable()
});

$('#unidSpeciesSelect').on('change', function() {
    getUnidentifiable()
});

$('#unidTaskSelect').on('change', function() {
    getUnidentifiable()
});

$("#startDateUnid").change( function() {
    /** Listener for the start date selector on the the individuals page. */
    validateDateRange()
    if(validDate){
        getUnidentifiable()
    }
})

$("#endDateUnid").change( function() {
    /** Listener for the end date selector on the the individuals page. */
    validateDateRange()
    if(validDate){
        getUnidentifiable()
    }
})

function restoreUnidSighting(){
    /** Restores the unidentifiable sighting to a new individual. */
    document.getElementById('btnContinueIndividualAlert').disabled = true
    modalAlertIndividuals.modal('hide')
    
    if (individualImages.length > 0 && individualImages[individualSplide.index].access=='write'){
        var image = individualImages[individualSplide.index]
        var detection = image.detections[0]

        individualImages.splice(individualSplide.index, 1)
        if (individualImages.length == 0){
            var center = document.getElementById('centerMapUnid')
            while(center.firstChild){
                center.removeChild(center.firstChild)
            }

            var splideDiv = document.getElementById('splideDivUnid')
            while(splideDiv.firstChild){
                splideDiv.removeChild(splideDiv.firstChild);
            }

            document.getElementById('tgInfoUnid').innerHTML = ''
            document.getElementById('timeInfoUnid').innerHTML = ''
            
            document.getElementById('labelsDivUnid').innerHTML =  ''
            document.getElementById('surveysDivUnid').innerHTML = ''

            var noData = document.createElement('h4')
            noData.setAttribute('style','color: white; text-align: center; margin-top: 20px')
            noData.innerHTML = 'No unidentifiable sightings found.'
            center.appendChild(noData)
        } else {
            updateSlider()
            if (individualSplide.index > 0){
                individualSplide.go(0)
            }
            else{
                finishedDisplaying = false
                image = individualImages[individualSplide.index]

                document.getElementById('tgInfoUnid').innerHTML = image.trapgroup.tag
                document.getElementById('timeInfoUnid').innerHTML = image.timestamp
                document.getElementById('labelsDivUnid').innerHTML =  image.detections[0].species
                document.getElementById('surveysDivUnid').innerHTML = image.detections[0].task

                addedDetections = false
                activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
            }
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if (document.getElementById('btnContinueIndividualAlert')) {
                    document.getElementById('btnContinueIndividualAlert').disabled = false
                    removeIndividualEventListeners()
                }
            }
        }
        xhttp.open("GET", '/restoreUnidentifiableDetection/'+detection.id.toString()+'/'+detection.individual_id.toString());
        xhttp.send();

        modalUnidentifiable.modal({keyboard: true});
    }
}

$('#btnRestoreDetUnid').on('click', function() {
    /** Restores the unidentifiable detection. */
    removeIndividualEventListeners()
    if (individualImages.length > 0 && individualImages[individualSplide.index].access=='write'){
        modalAlertIndividualsReturn = true
        modalUnidentifiable.modal('hide')
        document.getElementById('removeImg').checked = true
        document.getElementById('modalDissociateTitle').innerHTML = 'Restore Sighting'
        document.getElementById('dissociateImageInfo').innerHTML = '<i>Do you want to restore this sighting from being marked as unidentifiable? You can either create a new individual for the sighting or move it to an existing individual.</i>';
        document.getElementById('unidentifiableDiv').style.display = 'none'
        modalDissociateImage.modal({keyboard: true});
    }
});

function onload(){
    /**Function for initialising the page on load.*/
    getAreas()
    // addSurvey()
    // checkSurvey()
    populateSelectors()
    // getTasks()

}

document.onclick = function () {
    /** Hides the context menu when clicking outside of it. */
    if (map && map.contextmenu.isVisible()) {
        map.contextmenu.hide()
    }
}

window.addEventListener('load', onload, false);


