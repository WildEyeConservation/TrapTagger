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
const btnPrevTasks = document.getElementById('btnPrevTasks');
const btnNextTasks = document.getElementById('btnNextTasks');

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
                            individualTags(individualID)
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
                currentTags = individual_tags
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

            initialiseStats()
        }
    }
    xhttp.open("GET", '/getIndividualInfo/'+individualID);
    xhttp.send();

}

function getIndividual(individualID, individualName, order_value = 'a1', site='0', start_date='', end_date=''){
    /** Gets the specified individual*/
    initialiseMapAndSlider()
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
            individualImages = JSON.parse(this.responseText);
            // console.log(individualImages)
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

                getIndividualInfo(individualID)

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

                prepMapIndividual(individualImages[0])
                updateSlider()

                buildAssociationTable(individualID)
             
            }
            else{
                if(start_date != '' || end_date != ''){
                    document.getElementById('dateErrorsIndiv').innerHTML = 'No images available for this date range. Please select another date range.'
                }
                
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
            individualImages = JSON.parse(this.responseText);
            // console.log(individualImages)

            if(individualImages.length > 0){
                document.getElementById('tgInfo').innerHTML = 'Site: ' + individualImages[0].trapgroup.tag
                document.getElementById('timeInfo').innerHTML = individualImages[0].timestamp

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

                }
            }
            
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
        getTasks()
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

    if (duplicateTask||surveyAll||oneSurvey||noneSurvey) {
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
        createIndivPolarChart()
    }
    else if(statsSelect.value == '2'){
        statisticsDiv.appendChild(document.createElement('br'))
        createIndivMap()
    }
    else if(statsSelect.value == '3'){
        statisticsDiv.appendChild(document.createElement('br'))
        createIndivBar()
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
            taskTaggingLevel += ',0'
        } else {
            taskTaggingLevel += ',-1'
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
    getTasks()
})

document.getElementById('btnSubmitInfoChange').addEventListener('click', function(){
    /** Submits the changes to the individual's information. */

    submitIndividualTags()

    if(document.getElementById('individualName').innerHTML != document.getElementById('newIndividualName').value){
        submitIndividualName()
    }

    if(currentNote != document.getElementById('idNotes').value){
        submitIndividualNotes()
    }
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

function buildIdTask(task){
    idTasksListDiv = document.getElementById('idTasksListDiv'); 
    newTask = document.createElement('div')
    newTask.setAttribute("style", "border-bottom: 1px solid rgb(60,74,89); padding: 1.25rem;")

    idTasksListDiv.appendChild(newTask)

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    newTask.appendChild(entireRow)

    taskDiv = document.createElement('div')
    taskDiv.classList.add('col-lg-9');
    entireRow.appendChild(taskDiv)
    headingElement = document.createElement('h5')
    headingElement.innerHTML = task.name
    taskDiv.appendChild(headingElement)

    stopTaskCol = document.createElement('div')
    stopTaskCol.setAttribute('class', 'col-lg-3');
    stopTaskBtn = document.createElement('button')
    stopTaskBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
    stopTaskBtn.innerHTML = '&times;'
    stopTaskCol.appendChild(stopTaskBtn)
    entireRow.appendChild(stopTaskCol)

    if (task.remaining == 'Preparing...'){
        stopTaskBtn.disabled = true
    }
    else{
        stopTaskBtn.disabled = false
    }

    stopTaskBtn.addEventListener('click', function(wrapTaskId) {
        return function() {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);   
                    if (reply=='success') {
                        getTasks()
                    }
                }
            }
            xhttp.open("GET", '/stopTask/'+wrapTaskId);
            xhttp.send();
        }
    }(task.id));
        

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    newTask.appendChild(entireRow)

    jobProgressBarCol = document.createElement('div')
    jobProgressBarCol.classList.add('col-lg-12');
    
    jobProgressBarDiv = document.createElement('div')
    jobProgressBarDiv.setAttribute("id","jobProgressBarDiv"+task.id)

    var newProg = document.createElement('div');
    newProg.classList.add('progress');
    newProg.setAttribute('style','background-color: #3C4A59')

    var newProgInner = document.createElement('div');
    newProgInner.classList.add('progress-bar');
    newProgInner.classList.add('progress-bar-striped');
    newProgInner.classList.add('progress-bar-animated');
    newProgInner.classList.add('active');
    newProgInner.setAttribute("role", "progressbar");
    newProgInner.setAttribute("id", "progBar"+task.id);
    newProgInner.setAttribute("aria-valuenow", task.completed);
    newProgInner.setAttribute("aria-valuemin", "0");
    newProgInner.setAttribute("aria-valuemax", task.total);
    newProgInner.setAttribute("style", "width:"+(task.completed/task.total)*100+"%;transition:none; ");
    newProgInner.innerHTML = task.remaining

    newProg.appendChild(newProgInner);
    jobProgressBarDiv.appendChild(newProg);
    jobProgressBarCol.appendChild(jobProgressBarDiv);
    entireRow.appendChild(jobProgressBarCol)

}

function getTasks(url=null){
    /** Gets the current individual ID tasks */

    if (url==null) {
        request = '/getJobs?individual_id=' + true
    }
    else{
        request = url
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            idTasksListDiv = document.getElementById('idTasksListDiv'); 
            while(idTasksListDiv.firstChild){
                idTasksListDiv.removeChild(idTasksListDiv.firstChild);
            }

            for (let i=0;i<reply.jobs.length;i++) {
                buildIdTask(reply.jobs[i])
            }

            if (reply.next_url==null) {
                btnNextTasks.style.visibility = 'hidden'
            } else {
                btnNextTasks.style.visibility = 'visible'
                next_url = reply.next_url + '&individual_id=' + true
            }

            if (reply.prev_url==null) {
                btnPrevTasks.style.visibility = 'hidden'
            } else {
                btnPrevTasks.style.visibility = 'visible'
                prev_url = reply.prev_url + '&individual_id=' + true
            }

            setTimeout(function(){getTasks(url)}, 30000);

        }
    }
    xhttp.open("GET", request);
    xhttp.send();
}

btnNextTasks.addEventListener('click', ()=>{
    /** Loads the next set of paginated surveys. */
    getTasks(next_url)
});

btnPrevTasks.addEventListener('click', ()=>{
    /** Loads the previous set of paginated surveys. */
    getTasks(prev_url)
});

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

    addSurvey()

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
            }
            else{
                for (let i=0;i<reply.associations.length;i++) {
                    buildAssociation(reply.associations[i])
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

function buildAssociation(association){
    /** Builds the association row in table. */

    var table = document.getElementById('associationsTableBody');
    var row = document.createElement('tr');
    row.setAttribute('style','border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse;')

    var imageCell = document.createElement('td');
    imageCell.setAttribute('style','width: 25%; border: 1px solid rgba(0,0,0,0.2); border-collapse: collapse; text-align: center; vertical-align: middle;')
    var image = document.createElement('img');
    image.setAttribute('width','100%')
    image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(association.url)
    imageCell.appendChild(image);
    row.appendChild(imageCell);

    image.addEventListener('click', function(individualID,individualName){
        return function() {
            cleanModalIndividual()        
            individualTags(individualID)
            getIndividual(individualID,individualName)
            modalIndividual.scrollTop(0)
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

function onload(){
    /**Function for initialising the page on load.*/
    addSurvey()
    checkSurvey()
    populateSelectors()
    getTasks()

}

window.addEventListener('load', onload, false);


