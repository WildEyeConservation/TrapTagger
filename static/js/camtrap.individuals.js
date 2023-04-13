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

                document.getElementById('firstSeenDiv').innerHTML =  firstSeen
                document.getElementById('lastSeenDiv').innerHTML = lastSeen

                minDate = firstSeen.split(' ')[0].replace(/\//g, '-')
                maxDate = lastSeen.split(' ')[0].replace(/\//g, '-')

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

                prepMap(individualImages[0])
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
                prepMap(individualImages[0])
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
                document.getElementById('tgInfo').innerHTML = "Site: " + image.trapgroup.tag
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

    editTagsDiv = document.getElementById('editTagsDiv')
    while(editTagsDiv.firstChild){
        editTagsDiv.removeChild(editTagsDiv.firstChild);
    }

    surveysDiv = document.getElementById('surveysDiv')
    while(surveysDiv.firstChild){
        surveysDiv.removeChild(surveysDiv.firstChild);
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

// modalIndividual.on('shown.bs.modal', function(){
//     /** Initialises the individual modal when opened. */

//     if (map==null) {
//         prepMap(individualImages[0])
//         updateSlider()
//     }

// });


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

        for (survey_name in surveys){
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
            if (survey=="0") {
                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, [''], ['0'])
                checkSurvey()
            } else {

                optionTexts = []      
                optionValues = []

                survey_name = idSurveySelect.options[idSurveySelect.selectedIndex].text
                for (let i=0;i<surveys[survey_name].length;i++) {
                    optionTexts.push(surveys[survey_name][i].name)
                    optionValues.push(surveys[survey_name][i].task_id)
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
            surveys = JSON.parse(this.responseText);  
            // console.log(surveys)
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
            console.log(reply)
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

function onload(){
    /**Function for initialising the page on load.*/
    addSurvey()
    checkSurvey()
    populateSelectors()
    getTasks()
    processingTimer = setInterval(getTasks, 30000)

}

window.addEventListener('load', onload, false);


