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

var tabActiveLaunch = 'baseSpeciesLabellingTab'
var taskCompletionStatus = 'False'

launchMTurkTaskBtn.addEventListener('click', ()=>{
    /** Event listener for the launch-task button. Submits all info to the server after doing the necessary checks. */

    taskSize = parseInt(document.getElementById('taskSize').value)
    taskTaggingLevel = document.getElementById('taskTaggingLevel').value

    if (tabActiveLaunch == 'baseSightingTab' || tabActiveLaunch == 'baseMultiSpeciesTab') {
        isBounding = true
    } else {
        isBounding = false
    }

    allow = true
    if (tabActiveLaunch == 'baseIndividualTab'){
        taskTaggingLevel = document.getElementById('idStage').value+','+document.getElementById('taskTaggingLevel').options[document.getElementById('taskTaggingLevel').selectedIndex].text
        if (document.getElementById('idStage').value=='-4') {
            // if (document.getElementById('wordName').checked) {
            //     taskTaggingLevel += ',w'
            // } else if (document.getElementById('numberedName').checked) {
            //     taskTaggingLevel += ',n'
            // } else {
            //     allow = false
            // }
            taskTaggingLevel += ',n'
            taskTaggingLevel += ',m'
            // if (document.getElementById('autoGenSingles').checked) {
            //     taskTaggingLevel += ',a'
            // } else if (document.getElementById('manualSingles').checked) {
            //     taskTaggingLevel += ',m'
            // } else {
            //     allow = false
            // }
            if (document.getElementById('hotspotter').checked) {
                taskTaggingLevel += ',h'
            } else if (document.getElementById('heuristic').checked) {
                taskTaggingLevel += ',n'
            } else {
                allow = false
            }
        } else if (document.getElementById('idStage').value=='-5') {
            if (document.getElementById('idStage')[document.getElementById('idStage').selectedIndex].text == 'Exhaustive') {
                taskTaggingLevel += ',0'
            } else {
                taskTaggingLevel += ',-1'
            }
        }
    }

    if (isNaN(taskSize)) {
        document.getElementById('launchErrors').innerHTML = 'Batch size must be a number.'
        allow = false
    } else if (taskSize>10000) {
        document.getElementById('launchErrors').innerHTML = 'Batch size cannot be greater than 10000.'
        allow = false
    } else if (taskSize<1) {
        document.getElementById('launchErrors').innerHTML = 'Batch size cannot be less than 1.'
        allow = false
    }

    if ((taskSize != NaN)&&(isBounding != null)&&allow) {
        document.getElementById('launchMTurkTaskBtn').disabled=true

        var formData = new FormData()
        formData.append("selectedTasks", JSON.stringify([selectedTask]))
        formData.append("taskSize", taskSize)
        formData.append("taskTaggingLevel", taskTaggingLevel)
        formData.append("isBounding", isBounding)

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='Success') {
                    modalLaunchTask.modal('hide')
                    updatePage(current_page)
                } else if (reply.status=='untranslated') {
                    //need to edit translations
                    translationsDiv = document.querySelector('#translationsDiv')
                    while(translationsDiv.firstChild){
                        translationsDiv.removeChild(translationsDiv.firstChild);
                    }
                    for (let i=0;i<reply.untranslated.length;i++) {
                        IDNum = getIdNumforNext('classTranslationSelect-')
                        buildTranslationRow(IDNum,reply.untranslated[i],'translationsDiv',reply.labels)
                    }
                    editTranslationsSubmitted = false
                    modalLaunchTask.modal('hide')
                    modalEditTranslations.modal({keyboard: true})
                } else if (reply.status=='tags') {
                    divTag = document.getElementById('divTag')
                    while(divTag.firstChild){
                        divTag.removeChild(divTag.firstChild);
                    }

                    tags = reply.tags
                    tagIdTranslate = {}
                    deletedTags = []
                    if (tags.length == 0) {
                        BuildTagRow(0, 'divTag')
                    } else {
                        for (let i=0;i<tags.length;i++) {
                            tagDescription = tags[i][0]
                            tagHotkey = tags[i][1]
                            tagID = tags[i][2]
        
                            IDNum = getIdNumforNext('tagdescription');
                            BuildTagRow(IDNum, 'divTag')
                            tagIdTranslate[IDNum.toString()] = tagID
        
                            document.getElementById('tagdescription-'+i.toString()).value = tagDescription
                            document.getElementById('taghotkey-'+i.toString()).value = tagHotkey
                        }   
                    }

                    checkTags()
                    modalLaunchTask.modal('hide')
                    modalTags.modal({keyboard: true})
                } else {
                    document.getElementById('modalAlertHeader').innerHTML = 'Alert'
                    document.getElementById('modalAlertBody').innerHTML = reply.message
                    modalLaunchTask.modal('hide')
                    modalAlert.modal({keyboard: true});
                    document.getElementById('launchMTurkTaskBtn').disabled=false
                }
            }
        }
        xhttp.open("POST", '/launchTask');
        xhttp.send(formData);
    }
});

btnAddTag.addEventListener('click', ()=>{
    /** Event listener to add a new tag row. */
    IDNum = getIdNumforNext('tagdescription');
    BuildTagRow(IDNum, 'divTag')
});

submitTagsBtn.addEventListener('click', ()=>{
    /** Event listener for the submit tags button. Submits the tags if they are legal. */

    checkTags()
    if (legalTags) {
        editedTags = []
        newTags = []
        allDescriptions = document.querySelectorAll('[id^=tagdescription-]');
        for (let i=0;i<allDescriptions.length;i++) {
            IDNum = allDescriptions[i].id.split("-")[allDescriptions[i].id.split("-").length-1]
            description = allDescriptions[i].value
            hotkey = document.getElementById('taghotkey-'+IDNum).value
            if ((description!='')&&(hotkey!='')) {
                if (Object.keys(tagIdTranslate).includes(IDNum.toString())) {
                    // edited
                    editedTags.push([tagIdTranslate[IDNum.toString()],description,hotkey])
                } else {
                    // new
                    newTags.push([description,hotkey])
                }
            }
        }

        var formData = new FormData()
        formData.append("deletedTags", JSON.stringify(deletedTags))
        formData.append("editedTags", JSON.stringify(editedTags))
        formData.append("newTags", JSON.stringify(newTags))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='success') {
                    modalTags.modal('hide')
                    updatePage(current_page)
                }
            }
        }
        xhttp.open("POST", '/submitTags/'+selectedTask);
        xhttp.send(formData);
    }
});

function checkTags() {
    /** Checks the legality of the user-specified tags by looking for duplicates etc. */

    allHotkeys = document.querySelectorAll('[id^=taghotkey-]');
    allDescriptions = document.querySelectorAll('[id^=tagdescription-]');

    var duplicateDescriptions = []
    var duplicateKeys = []
    var emptyDescription = false
    var emptyHotkey = false
    var descriptionSlash = false
    var hotkeySlash = false

    var usedDescriptions = []
    var usedHotkeys = []
    for (let i = 0; i < allDescriptions.length; i++){
        description = allDescriptions[i].value.toLowerCase()
        hotkey = allHotkeys[i].value.toLowerCase()

        if (allDescriptions[i].value != '') {
            if (hotkey=='') {
                emptyHotkey = true
            }
        } else {
            if (allHotkeys[i].value!='') {
                emptyDescription = true
            }
        }

        if (allDescriptions[i].value != '') {
            if (allHotkeys[i].value!='') {
    
                if ((description.includes('/'))||(description.includes('\\'))) {
                    descriptionSlash = true
                }
    
                if ((!hotkey.match(/^[0-9a-z]$/))&&(hotkey!=' ')) {
                    hotkeySlash = true
                }
    
                if (usedDescriptions.includes(description)) {
                    if (!duplicateDescriptions.includes(description)) {
                        duplicateDescriptions.push(description)
                    }
                } else {
                    usedDescriptions.push(description)
                }
    
                if (usedHotkeys.includes(hotkey)) {
                    if (!duplicateKeys.includes(hotkey)) {
                        duplicateKeys.push(hotkey)
                    }
                } else {
                    usedHotkeys.push(hotkey)
                }
            }
        }
    }

    // Print
    tagErrors = document.getElementById('tagErrors')   
    while(tagErrors.firstChild){
        tagErrors.removeChild(tagErrors.firstChild);
    }

    if (duplicateDescriptions.length != 0) {
        newdiv = document.createElement('div')
        labtext = 'Duplicate Tags: '
        for (let i = 0; i < duplicateDescriptions.length; i++){
            labtext += duplicateDescriptions[i]
            if (i != duplicateDescriptions.length-1) {
                labtext += ', '
            }
        }
        newdiv.innerHTML = labtext
        tagErrors.appendChild(newdiv)
    }

    if (duplicateKeys.length != 0) {
        newdiv = document.createElement('div')
        labtext = 'Duplicate Hotkeys: '
        for (let i = 0; i < duplicateKeys.length; i++){
            labtext += duplicateKeys[i]
            if (i != duplicateKeys.length-1) {
                labtext += ', '
            }
        }
        newdiv.innerHTML = labtext
        tagErrors.appendChild(newdiv)
    }

    if (hotkeySlash) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'A hotkey can only be a letter, a number, or the space character.'
        tagErrors.appendChild(newdiv)
    }

    if (descriptionSlash) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'A tag name cannot include slashes.'
        tagErrors.appendChild(newdiv)
    }

    if ((!emptyDescription)&&(!emptyHotkey)&&(!descriptionSlash)&&(!hotkeySlash)&&(duplicateDescriptions.length==0)&&(duplicateKeys.length==0)) {
        legalTags = true
    } else {
        legalTags = false
    }
}

function BuildTagRow(IDNum, div) {
    /** Builds a tag input row for the specified ID number, inside the specified div. */

    theDiv = document.querySelector('#'+div);
    inputgroup = document.createElement('div')
    inputgroup.classList.add('input-group')

    row = document.createElement('div')
    row.classList.add('row')

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')

    col2 = document.createElement('div')
    col2.classList.add('col-lg-1')

    col3 = document.createElement('div')
    col3.classList.add('col-lg-4')

    col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
  
    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';

    nameInput = document.createElement('input');
    nameInput.setAttribute("type","text")
    nameInput.classList.add('form-control');
    nameInput.required = true
    nameInput.id = 'tagdescription-'+IDNum;
    nameInput.name = nameInput.id;
    col1.appendChild(nameInput);

    hotkeyInput = document.createElement('input');
    hotkeyInput.setAttribute("type","text")
    hotkeyInput.classList.add('form-control');
    hotkeyInput.required = true
    hotkeyInput.id = 'taghotkey-'+IDNum;
    hotkeyInput.name = hotkeyInput.id;
    hotkeyInput.setAttribute("maxlength","1")
    col2.appendChild(hotkeyInput);

    inputgroup.appendChild(col1)
    inputgroup.appendChild(col2)
    inputgroup.appendChild(col3)
    col4.appendChild(btnRemove);
    inputgroup.appendChild(col4)
    row.appendChild(inputgroup)
    theDiv.appendChild(row)

    $("#"+nameInput.id).change( function(wrapIDNum) {
        return function() {
            checkTags()
        }
    }(IDNum));
    $("#"+hotkeyInput.id).change( function(wrapIDNum) {
        return function() {
            checkTags()
        }
    }(IDNum));
    btnRemove.addEventListener('click', (evt)=>{
        IDNum = evt.target.id.split("-")[evt.target.id.split("-").length-1]
        if (Object.keys(tagIdTranslate).includes(IDNum.toString())) {
            deletedTags.push(tagIdTranslate[IDNum.toString()])
        }
        evt.target.parentNode.parentNode.parentNode.remove();
        checkTags()
    });
}

function updateTaskStatus() {
    /** Updates the task status information, including the jobs completed, and remaining. */
    
    taskProgressBarDivs = document.querySelectorAll('[id^=taskProgressBarDiv]');
    tskds = []
    for (let i = 0; i < taskProgressBarDivs.length; i++) {
        tskds.push(taskProgressBarDivs[i].id.split('taskProgressBarDiv')[1])
    }

    if (tskds.length>0) {
        var formData = new FormData()
        formData.append("task_ids", JSON.stringify(tskds))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                for (let i = 0; i < reply.length; i++) {
                    if ((document.getElementById('taskStatusElement'+reply[i].id).innerHTML!='SUCCESS')&&(document.getElementById('taskStatusElement'+reply[i].id).innerHTML!='Error')) {
                        if (reply[i].state==null) {
                            document.getElementById('taskStatusElement'+reply[i].id).innerHTML = 'Unlaunched'
                        } else {
                            if (reply[i].state == 'PROGRESS') {
                                status = 'In Progress'
                            } else if (reply[i].state == 'FAILURE') {
                                status = 'Error'
                            } else if ((reply[i].state == 'REVOKED')||(reply[i].state == 'Stopped')) {
                                status = 'Stopped'
                            } else if ((reply[i].state == 'PENDING')||(reply[i].state == 'Started')) {
                                status = 'Started'
                            } else {
                                status = reply[i].state
                            }
                            document.getElementById('taskStatusElement'+reply[i].id).innerHTML = status
                            if (status=='Ready') {
                                document.getElementById('launchTaskBtn'+reply[i].id).disabled = false
                                document.getElementById('deleteTaskBtn'+reply[i].id).disabled = false
                            } else if (status=='Deleting') {
                                document.getElementById('launchTaskBtn'+reply[i].id).disabled = true
                                document.getElementById('deleteTaskBtn'+reply[i].id).disabled = true
                                document.getElementById('exploreTaskBtn'+reply[i].id).disabled = true
                                document.getElementById('resultsBtn'+reply[i].id).disabled = true
                            }
                        }   
        
                        document.getElementById('taskHitsCompleted'+reply[i].id).innerHTML = 'Jobs Completed: ' + reply[i].hitsCompleted
                        document.getElementById('taskHitsActive'+reply[i].id).innerHTML = 'Jobs Available: ' + reply[i].hitsActive
            
                        if ((reply[i].state=='SUCCESS')||(reply[i].state=='FAILURE')) {
                            updatePage(current_page)
                        }
                    }
                }
                
                if(timerTaskStatus != null) {
                    clearTimeout(timerTaskStatus);
                    timerTaskStatus = setTimeout(function() { updateTaskStatus(); }, 5000); //5 seconds
                }
                else{
                    timerTaskStatus = setTimeout(function() { updateTaskStatus(); }, 5000); //5 seconds
                }
            }
        }
        xhttp.open("POST", '/MturkStatus');
        xhttp.send(formData);
    }
    else{
        clearTimeout(timerTaskStatus);
    }
}

function resetLaunchTaskPage() {
    /** Clears the launch-task page. */
    document.getElementById('taskSize').value = 200
    document.getElementById('launchErrors').value = ''
    document.getElementById('openSightingTab').disabled = true
    document.getElementById('openMultiSpeciesTab').disabled = true
    document.getElementById('openIndividualTab').disabled = true
    document.getElementById('openAISpeciesTab').disabled = true
    document.getElementById('openInfoTab').disabled = true
    document.getElementById('openSpeciesLabellingTab').disabled = false
    // document.getElementById('openMaskedTab').disabled = true
    clearSelect(document.getElementById('taskTaggingLevel'))

    individualLevel = document.getElementById('individualLevel')
    while(individualLevel.firstChild){
        individualLevel.removeChild(individualLevel.firstChild);
    }

    document.getElementById('annotationDescription').innerHTML = "<i>Label the species contained in each unlabelled image cluster.</i>"

    var mainModal = document.getElementById('modalLaunchTask')
    var tablinks = mainModal.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
}

function openClusterTag() {
    /** Listens for cluster species annotation in the launch task modal, and populates the species-level accordingly. */

    if (tabActiveLaunch == 'baseSpeciesLabellingTab') {
        individualLevel = document.getElementById('individualLevel')
        while(individualLevel.firstChild){
            individualLevel.removeChild(individualLevel.firstChild);
        }

        document.getElementById('openSightingTab').disabled = true
        document.getElementById('openMultiSpeciesTab').disabled = true
        document.getElementById('openIndividualTab').disabled = true
        document.getElementById('openAISpeciesTab').disabled = true
        document.getElementById('openInfoTab').disabled = true
        // document.getElementById('openMaskedTab').disabled = true

        document.getElementById('annotationDescription').innerHTML = "<i>Label the species contained in each unlabelled image cluster.</i>"

        clearSelect(document.getElementById('taskTaggingLevel'))
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/clusterTag');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
    
                if (reply.disabled == 'true') {
                    document.getElementById('taskTaggingLevel').disabled = true
                } else {
                    document.getElementById('taskTaggingLevel').disabled = false
                }

                if (taskCompletionStatus == 'True') {
                    document.getElementById('openSightingTab').disabled = false
                    document.getElementById('openMultiSpeciesTab').disabled = false
                    document.getElementById('openIndividualTab').disabled = false
                    document.getElementById('openAISpeciesTab').disabled = false
                    document.getElementById('openInfoTab').disabled = false
                    // document.getElementById('openMaskedTab').disabled = false
                }
            }
        }
        xhttp.send();
    }
}

function openInfoTag() {
    /** Listens for informational tagging in the launch task modal, and populates the species-level accordingly. */

    if (tabActiveLaunch == 'baseInfoTab') {
        individualLevel = document.getElementById('individualLevel')
        while(individualLevel.firstChild){
            individualLevel.removeChild(individualLevel.firstChild);
        }

        document.getElementById('openSightingTab').disabled = true
        document.getElementById('openMultiSpeciesTab').disabled = true
        document.getElementById('openIndividualTab').disabled = true
        document.getElementById('openAISpeciesTab').disabled = true
        document.getElementById('openSpeciesLabellingTab').disabled = true
        // document.getElementById('openMaskedTab').disabled = true

        document.getElementById('annotationDescription').innerHTML = "<i>Add additional informational tags to each cluster containing a chosen species. You will be able to set up and edit these tags on launch.</i>"

        clearSelect(document.getElementById('taskTaggingLevel'))
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/infoTag');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
    
                if (reply.disabled == 'true') {
                    document.getElementById('taskTaggingLevel').disabled = true
                } else {
                    document.getElementById('taskTaggingLevel').disabled = false
                }

                document.getElementById('openSightingTab').disabled = false
                document.getElementById('openMultiSpeciesTab').disabled = false
                document.getElementById('openIndividualTab').disabled = false
                document.getElementById('openAISpeciesTab').disabled = false
                document.getElementById('openSpeciesLabellingTab').disabled = false
                // document.getElementById('openMaskedTab').disabled = false
            }
        }
        xhttp.send();
    }
}

$("#taskTaggingLevel").change( function() {
    /** Listens for changes in the task tagging level, and enables/disables the individual ID stage selector accordingly. */
    
    if (tabActiveLaunch=='baseIndividualTab') {
        if (speciesDisabled[document.getElementById('taskTaggingLevel').options[document.getElementById('taskTaggingLevel').selectedIndex].text] == 'true') {
            document.getElementById('idStage').disabled = true
        } else {
            document.getElementById('idStage').disabled = false
        }
    }
})

function buildIndividualOptions() {
    /** Builds the individual ID form in the launch task modal. */
    
    individualOptionsDiv = document.getElementById('individualOptionsDiv')
    individualOptionsDiv.appendChild(document.createElement('br'))

    // algorithm
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

    // names
    // h5 = document.createElement('h5')
    // h5.setAttribute('style','margin-bottom: 2px')
    // h5.innerHTML = 'Name Generation'
    // individualOptionsDiv.appendChild(h5)

    // div = document.createElement('div')
    // div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    // div.innerHTML = '<i>Select how you would like your individual names to generated.</i>'
    // individualOptionsDiv.appendChild(div)

    // row = document.createElement('div')
    // individualOptionsDiv.appendChild(row)

    // radio = document.createElement('div')
    // radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    // row.appendChild(radio)

    // input = document.createElement('input')
    // input.setAttribute('type','radio')
    // input.setAttribute('class','custom-control-input')
    // input.setAttribute('id','wordName')
    // input.setAttribute('name','nameSelection')
    // input.setAttribute('value','customEx')
    // radio.appendChild(input)

    // label = document.createElement('label')
    // label.setAttribute('class','custom-control-label')
    // label.setAttribute('for','wordName')
    // label.innerHTML = 'Words'
    // radio.appendChild(label)
    
    // radio = document.createElement('div')
    // radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    // row.appendChild(radio)

    // input = document.createElement('input')
    // input.setAttribute('type','radio')
    // input.setAttribute('class','custom-control-input')
    // input.setAttribute('id','numberedName')
    // input.setAttribute('name','nameSelection')
    // input.setAttribute('value','customEx')
    // radio.appendChild(input)

    // label = document.createElement('label')
    // label.setAttribute('class','custom-control-label')
    // label.setAttribute('for','numberedName')
    // label.innerHTML = 'Numbered'
    // radio.appendChild(label)

    // individualOptionsDiv.appendChild(document.createElement('br'))

    // auto single individuals
    // h5 = document.createElement('h5')
    // h5.setAttribute('style','margin-bottom: 2px')
    // h5.innerHTML = 'Single Detections'
    // individualOptionsDiv.appendChild(h5)

    // div = document.createElement('div')
    // div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    // div.innerHTML = '<i>Select how you would like clusters containing only one detection to be handled. Select manual if you intend to rely on informational tags and prefer greater accuracy. Select auto-generate if you wish to reply more on the AI, and do things more quickly.</i>'
    // individualOptionsDiv.appendChild(div)

    // row = document.createElement('div')
    // individualOptionsDiv.appendChild(row)

    // radio = document.createElement('div')
    // radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    // row.appendChild(radio)

    // input = document.createElement('input')
    // input.setAttribute('type','radio')
    // input.setAttribute('class','custom-control-input')
    // input.setAttribute('id','autoGenSingles')
    // input.setAttribute('name','autoGenSelection')
    // input.setAttribute('value','customEx')
    // radio.appendChild(input)

    // label = document.createElement('label')
    // label.setAttribute('class','custom-control-label')
    // label.setAttribute('for','autoGenSingles')
    // label.innerHTML = 'Auto-Generate'
    // radio.appendChild(label)
    
    // radio = document.createElement('div')
    // radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    // row.appendChild(radio)

    // input = document.createElement('input')
    // input.setAttribute('type','radio')
    // input.setAttribute('class','custom-control-input')
    // input.setAttribute('id','manualSingles')
    // input.setAttribute('name','autoGenSelection')
    // input.setAttribute('value','customEx')
    // radio.appendChild(input)

    // label = document.createElement('label')
    // label.setAttribute('class','custom-control-label')
    // label.setAttribute('for','manualSingles')
    // label.innerHTML = 'Manual'
    // radio.appendChild(label)
}

function openIndividualID() {
    /** Listens for individual ID being selected, and populates the form accordingly. */
    
    if (tabActiveLaunch == 'baseIndividualTab') {
        
        document.getElementById('openSightingTab').disabled = true
        document.getElementById('openMultiSpeciesTab').disabled = true
        document.getElementById('openSpeciesLabellingTab').disabled = true
        document.getElementById('openAISpeciesTab').disabled = true
        document.getElementById('openInfoTab').disabled = true
        // document.getElementById('openMaskedTab').disabled = true

        document.getElementById('annotationDescription').innerHTML = "<i>Identify specific individuals for a chosen individual. Begin by identifying individuals on a cluster-by-cluster basis to try combine multiple viewing angles. Then identify individuals across different clusters based on suggested matches. It is recommended that you correct your sightings (boxes) for your species of interest before beginning this process/</i>"
        clearSelect(document.getElementById('taskTaggingLevel'))
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/individualID');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
                speciesDisabled = reply.disabled

                if (speciesDisabled[document.getElementById('taskTaggingLevel').options[document.getElementById('taskTaggingLevel').selectedIndex].text] == 'true') {
                    document.getElementById('idStage').disabled = true
                } else {
                    document.getElementById('idStage').disabled = false
                }

                document.getElementById('openSightingTab').disabled = false
                document.getElementById('openMultiSpeciesTab').disabled = false
                document.getElementById('openInfoTab').disabled = false
                document.getElementById('openAISpeciesTab').disabled = false
                document.getElementById('openSpeciesLabellingTab').disabled = false
                // document.getElementById('openMaskedTab').disabled = false
                
            }
        }
        xhttp.send();

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

        $("#idStage").change( function() {
            individualOptionsDiv = document.getElementById('individualOptionsDiv')
            while(individualOptionsDiv.firstChild){
                individualOptionsDiv.removeChild(individualOptionsDiv.firstChild);
            }
            if (document.getElementById('idStage').value=='-4') {
                buildIndividualOptions()
            }
        })

        fillSelect(input, ['Cluster Identification', 'Inter-cluster Identification'], ['-4','-5'])

        individualOptionsDiv = document.createElement('div')
        individualOptionsDiv.setAttribute('id','individualOptionsDiv')
        individualLevel.appendChild(individualOptionsDiv)

        buildIndividualOptions()

    } else {
        individualLevel = document.getElementById('individualLevel')
        while(individualLevel.firstChild){
            individualLevel.removeChild(individualLevel.firstChild);
        }
    }
}

function openClassTag() {
    /** Listens for the AI-check annotation task being selected, and populates the form accordingly. */

    if (tabActiveLaunch == 'baseAISpeciesTab') {
        individualLevel = document.getElementById('individualLevel')
        while(individualLevel.firstChild){
            individualLevel.removeChild(individualLevel.firstChild);
        }

        document.getElementById('openSightingTab').disabled = true
        document.getElementById('openMultiSpeciesTab').disabled = true
        document.getElementById('openIndividualTab').disabled = true
        document.getElementById('openInfoTab').disabled = true
        document.getElementById('openSpeciesLabellingTab').disabled = true
        // document.getElementById('openMaskedTab').disabled = true

        document.getElementById('annotationDescription').innerHTML = "<i>Check your cluster-level species labels against the AI to find mistakes.</i>"

        clearSelect(document.getElementById('taskTaggingLevel'))
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/AIcheck');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
    
                if (reply.disabled == 'true') {
                    document.getElementById('taskTaggingLevel').disabled = true
                } else {
                    document.getElementById('taskTaggingLevel').disabled = false
                }

                document.getElementById('openSightingTab').disabled = false
                document.getElementById('openMultiSpeciesTab').disabled = false
                document.getElementById('openIndividualTab').disabled = false
                document.getElementById('openInfoTab').disabled = false
                document.getElementById('openSpeciesLabellingTab').disabled = false
                // document.getElementById('openMaskedTab').disabled = false
            }
        }
        xhttp.send();
    }
}

function openSightingTag() {
    /** Listens for the bounding-box correction task being selected, and populates the form accordingly. */

    if (tabActiveLaunch == 'baseSightingTab') {
        individualLevel = document.getElementById('individualLevel')
        while(individualLevel.firstChild){
            individualLevel.removeChild(individualLevel.firstChild);
        }

        document.getElementById('openMultiSpeciesTab').disabled = true
        document.getElementById('openIndividualTab').disabled = true
        document.getElementById('openAISpeciesTab').disabled = true
        document.getElementById('openInfoTab').disabled = true
        document.getElementById('openSpeciesLabellingTab').disabled = true
        // document.getElementById('openMaskedTab').disabled = true

        document.getElementById('annotationDescription').innerHTML = "<i>Correct the AI-generated boxes for a particular species. Use this to obtain more accurate animal counts or to prepare for individual identification.</i>"

        clearSelect(document.getElementById('taskTaggingLevel'))
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/bounding');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
    
                if (reply.disabled == 'true') {
                    document.getElementById('taskTaggingLevel').disabled = true
                } else {
                    document.getElementById('taskTaggingLevel').disabled = false
                }

                document.getElementById('openMultiSpeciesTab').disabled = false
                document.getElementById('openIndividualTab').disabled = false
                document.getElementById('openAISpeciesTab').disabled = false
                document.getElementById('openInfoTab').disabled = false
                document.getElementById('openSpeciesLabellingTab').disabled = false
                // document.getElementById('openMaskedTab').disabled = false

            }
        }
        xhttp.send();
    }
}

function openMultiSpeciesTag() {
    /** Listens for the bounding-box correction task being selected, and populates the form accordingly. */

    if (tabActiveLaunch == 'baseMultiSpeciesTab') {
        individualLevel = document.getElementById('individualLevel')
        while(individualLevel.firstChild){
            individualLevel.removeChild(individualLevel.firstChild);
        }

        document.getElementById('openSightingTab').disabled = true
        document.getElementById('openIndividualTab').disabled = true
        document.getElementById('openAISpeciesTab').disabled = true
        document.getElementById('openInfoTab').disabled = true
        document.getElementById('openSpeciesLabellingTab').disabled = true
        // document.getElementById('openMaskedTab').disabled = true

        document.getElementById('annotationDescription').innerHTML = "<i>Differentiate which species each box/sighting contains in clusters that contain multiple species. Do this to obatin more accurate animal counts, and more accurate image-level labelling. Also necessary preparation for individual identification</i>"

        clearSelect(document.getElementById('taskTaggingLevel'))
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/differentiation');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                clearSelect(document.getElementById('taskTaggingLevel'))
                fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
    
                if (reply.disabled == 'true') {
                    document.getElementById('taskTaggingLevel').disabled = true
                } else {
                    document.getElementById('taskTaggingLevel').disabled = false
                }

                document.getElementById('openSightingTab').disabled = false
                document.getElementById('openIndividualTab').disabled = false
                document.getElementById('openAISpeciesTab').disabled = false
                document.getElementById('openInfoTab').disabled = false
                document.getElementById('openSpeciesLabellingTab').disabled = false
                // document.getElementById('openMaskedTab').disabled = false
            }
        }
        xhttp.send();
    }
}

// function openMaskedTag() {
//     /** Listens for the bounding-box correction task being selected, and populates the form accordingly. */

//     if (tabActiveLaunch == 'baseMaskedTab') {
//         individualLevel = document.getElementById('individualLevel')
//         while(individualLevel.firstChild){
//             individualLevel.removeChild(individualLevel.firstChild);
//         }

//         document.getElementById('openSightingTab').disabled = true
//         document.getElementById('openMultiSpeciesTab').disabled = true
//         document.getElementById('openIndividualTab').disabled = true
//         document.getElementById('openAISpeciesTab').disabled = true
//         document.getElementById('openInfoTab').disabled = true
//         document.getElementById('openSpeciesLabellingTab').disabled = true

//         document.getElementById('annotationDescription').innerHTML = "<i>Review all sightings that were masked if you have masked an area in a previous task. This can be to ensure that no sightings were missed, or to correct any mistakes.</i>"

//         clearSelect(document.getElementById('taskTaggingLevel'))
//         var xhttp = new XMLHttpRequest();
//         xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/maskedTag');
//         xhttp.onreadystatechange =
//         function(){
//             if (this.readyState == 4 && this.status == 200) {
//                 reply = JSON.parse(this.responseText);  
//                 clearSelect(document.getElementById('taskTaggingLevel'))
//                 fillSelect(document.getElementById('taskTaggingLevel'), reply.texts, reply.values, reply.colours)
    
//                 if (reply.disabled == 'true') {
//                     document.getElementById('taskTaggingLevel').disabled = true
//                 } else {
//                     document.getElementById('taskTaggingLevel').disabled = false
//                 }

//                 document.getElementById('openSightingTab').disabled = false
//                 document.getElementById('openMultiSpeciesTab').disabled = false
//                 document.getElementById('openIndividualTab').disabled = false
//                 document.getElementById('openAISpeciesTab').disabled = false
//                 document.getElementById('openInfoTab').disabled = false
//                 document.getElementById('openSpeciesLabellingTab').disabled = false

//             }
//         }
//         xhttp.send();
//     }
// }


modalEditTranslations.on('hidden.bs.modal', function(){
    /** Cancels the launch task request for the selected task if the user cancels the edit translations modal. */
	if ((!helpReturn)&&(!editTranslationsSubmitted)) {
	    var xhttp = new XMLHttpRequest();
	    xhttp.open("GET", '/releaseTask/'+selectedTask);
	    xhttp.send();
	}
});

btnSubmitTranslaions.addEventListener('click', ()=>{
    /** Submits the user's translations to the server. */
    
    allTranslations = document.querySelectorAll('[id^=classTranslationText-]')
    translationInfo = {}
    for (let i=0;i<allTranslations.length;i++) {
        IDNum = allTranslations[i].id.split("-")[allTranslations[i].id.split("-").length-1]
        classification = allTranslations[i].innerHTML

        translationSelect = document.getElementById('classTranslationSelect-'+IDNum)
        translation = translationSelect.options[translationSelect.selectedIndex].text

        if (translation.toLowerCase()=='nothing (ignore)') {
            translation='nothing'
        }

        translationInfo[classification] = translation
    }
    
    var formData = new FormData()
    formData.append("translation", JSON.stringify(translationInfo))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/editTranslations/'+selectedTask);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply=='success') {
                editTranslationsSubmitted = true
                modalEditTranslations.modal('hide')
                updatePage(current_page)
            }
        }
    }
    xhttp.send(formData);
});

modalLaunchTask.on('shown.bs.modal', function(){
    /** Intitialises the launch-task modal when opened. */

    if (!helpReturn) {

        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getTaskCompletionStatus/'+selectedTask);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                taskCompletionStatus = JSON.parse(this.responseText);  
                if (taskCompletionStatus == 'True') {
                    document.getElementById('openSightingTab').disabled = false
                    document.getElementById('openMultiSpeciesTab').disabled = false
                    document.getElementById('openIndividualTab').disabled = false
                    document.getElementById('openAISpeciesTab').disabled = false
                    document.getElementById('openInfoTab').disabled = false
                    // document.getElementById('openMaskedTab').disabled = false
                }
                document.getElementById('openSpeciesLabellingTab').disabled = false
                document.getElementById('openSpeciesLabellingTab').click()
            }
        }
        xhttp.send();

    } else {
        helpReturn = false
    }
});

modalLaunchTask.on('hidden.bs.modal', function(){
    /** Resets the launch-task modal when closed. */
    if (!helpReturn) {
        resetLaunchTaskPage()
        document.getElementById('launchMTurkTaskBtn').disabled=false
    }
});

function changeAnnotationTab(evt, tabName) {
    /** Opens the permissions tab */

    var mainModal = document.getElementById('modalLaunchTask')
    // var tabcontent = mainCard.getElementsByClassName("tabcontent");
    // for (let i = 0; i < tabcontent.length; i++) {
    //     tabcontent[i].style.display = "none";
    // }

    var tablinks = mainModal.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActiveLaunch = tabName

    if (tabName == 'baseSpeciesLabellingTab') {
        openClusterTag()
    }
    else if (tabName == 'baseAISpeciesTab') {
        openClassTag()
    }
    // else if (tabName == 'baseMaskedTab') {
    //     openMaskedTag()
    // }
    else if (tabName == 'baseInfoTab') {
        openInfoTag()
    }
    else if (tabName == 'baseMultiSpeciesTab') {
        openMultiSpeciesTag()
    }
    else if (tabName == 'baseSightingTab') {
        openSightingTag()
    }
    else if (tabName == 'baseIndividualTab') {
        openIndividualID()
    }

}