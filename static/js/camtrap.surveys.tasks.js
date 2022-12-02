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

function buildTask(taskDiv, task, disableSurvey, survey) {
    /**
     * Builds the task row for given survey in the stipulated div.
     * @param {div} taskDiv The fic where the task div must be added
     * @param {obj} task The task information object
     * @param {bool} disableSurvey Whether the survey is disabled
     * @param {obj} survey The survey information object
     */

    newTaskDiv = document.createElement('div')
    newTaskDiv.classList.add('row');
    newTaskDiv.classList.add('center');

    col = document.createElement('div')
    col.classList.add('col-lg-2');
    newTaskDiv.appendChild(col)

    taskNameElement = document.createElement('div')
    taskNameElement.classList.add('row');
    taskNameElement.setAttribute("style","padding-left: 15px; font-size:100%")
    taskNameElement.innerHTML = task.name
    col.appendChild(taskNameElement)

    taskStatusElement = document.createElement('div')
    taskStatusElement.classList.add('row');
    taskStatusElement.setAttribute("id","taskStatusElement"+task.id)
    taskStatusElement.setAttribute("style","padding-left: 15px; font-size: 70%")
    col.appendChild(taskStatusElement)

    taskInfoCol = document.createElement('div')
    taskInfoCol.classList.add('col-lg-2');
    newTaskDiv.appendChild(taskInfoCol)

    if (task.status==null) {
        taskStatusElement.innerHTML = 'Unlaunched'
    } else {
        if (task.status == 'PROGRESS') {
            status = 'In Progress'
        } else if (task.status == 'FAILURE') {
            status = 'Error'
        } else if ((task.status == 'REVOKED')||(task.status == 'Stopped')) {
            status = 'Stopped'
        } else if ((task.status == 'PENDING')||(task.status == 'Started')) {
            status = 'Initialising'
        } else if ((task.status == 'SUCCESS')||(task.status == 'successInitial')) {
            status = 'Success'
        } else {
            status = task.status
        }
        taskStatusElement.innerHTML = status
    }      

    if ((task.status!='PROGRESS')) {
        taskStatusBtn = document.createElement('button')
        taskStatusBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        taskStatusBtn.innerHTML = 'Details'
        taskInfoCol.appendChild(taskStatusBtn)

        taskStatusBtn.addEventListener('click', function(wrapTaskId) {
            return function() {
                selectedTask = wrapTaskId
                modalStatus.modal({keyboard: true});
            }
        }(task.id));

        launchTaskCol = document.createElement('div')
        launchTaskCol.classList.add('col-lg-2');
        launchTaskBtn = document.createElement('button')
        launchTaskBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        launchTaskBtn.setAttribute("id","launchTaskBtn"+task.id)
        launchTaskCol.appendChild(launchTaskBtn)
        newTaskDiv.appendChild(launchTaskCol)
        launchTaskBtn.innerHTML = 'Launch'

        if (task.status=='successInitial') {
            launchTaskBtn.addEventListener('click', function(wrapTaskId) {
                return function() {
                    document.getElementById('modalConfirmHeader').innerHTML = 'Knocked-Down Analysis'
                    document.getElementById('modalConfirmBody').innerHTML = 'You have marked cameras as knocked down. You now need to check whether they were picked up before the end of the survey. \
                    This is performed in the knocked-down analysis where you are shown a number of images from each knocked-down camera. You must indicate whether they are knocked down or not \
                    to determine if/when the camera was picked up. Do you wish to continue?'
                    document.getElementById('btnConfirm').addEventListener('click', function(wrapWrapTaskId) {
                        return function() {
                            window.location.href = '/exploreKnockdowns?task='+wrapWrapTaskId;
                        }
                    }(wrapTaskId));
                    modalConfirm.modal({keyboard: true});
                }
            }(task.id));
        } else {
            launchTaskBtn.addEventListener('click', function(wrapTaskId) {
                return function() {
                    selectedTask = wrapTaskId
                    modalLaunchTask.modal({keyboard: true});
                }
            }(task.id));
        }

        editTaskCol = document.createElement('div')
        editTaskCol.classList.add('col-lg-2');
        editTaskBtn = document.createElement('button')
        editTaskBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        editTaskBtn.setAttribute("id","editTaskBtn"+task.id)
        editTaskBtn.innerHTML = 'Edit'
        editTaskCol.appendChild(editTaskBtn)
        newTaskDiv.appendChild(editTaskCol)

        editTaskBtn.addEventListener('click', function(wrapTaskId) {
            return function() {
                selectedTask = wrapTaskId
                modalEditTask.modal({keyboard: true});
            }
        }(task.id));

        resultsCol = document.createElement('div')
        resultsCol.classList.add('col-lg-2');
        resultsBtn = document.createElement('button')
        if (task.complete) {
            resultsBtn.setAttribute("class","btn btn-success btn-block btn-sm")
        } else {
            resultsBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        }
        resultsBtn.setAttribute("id","resultsBtn"+task.id)
        resultsBtn.innerHTML = 'Results'
        resultsCol.appendChild(resultsBtn)
        newTaskDiv.appendChild(resultsCol)

        resultsBtn.addEventListener('click', function(wrapTaskId,wrapTaskName,wrapSurveyId,wrapSurveyName) {
            return function() {
                selectedTask = wrapTaskId
                taskName = wrapTaskName
                selectedSurvey = wrapSurveyId
                surveyName = wrapSurveyName
                modalResults.modal({keyboard: true});
            }
        }(task.id,task.name,survey.id,survey.name));

        deleteCol = document.createElement('div')
        deleteCol.classList.add('col-lg-2');
        deleteBtn = document.createElement('button')
        deleteBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
        deleteBtn.setAttribute("id","deleteTaskBtn"+task.id)
        deleteBtn.innerHTML = 'Delete'
        deleteCol.appendChild(deleteBtn)
        newTaskDiv.appendChild(deleteCol)

        if (disableSurvey) {
            launchTaskBtn.disabled = true
            editTaskBtn.disabled = true
            resultsBtn.disabled = true
            deleteBtn.disabled = true
            taskStatusBtn.disabled = true
        } else {
            launchTaskBtn.disabled = false
            editTaskBtn.disabled = false
            resultsBtn.disabled = false
            deleteBtn.disabled = false
            taskStatusBtn.disabled = false
        }

        deleteBtn.addEventListener('click', function(wrapTaskId, wrapTaskName) {
            return function() {
                selectedTask = wrapTaskId
                document.getElementById('modalConfirmHeader').innerHTML = 'Confirmation Required'
                document.getElementById('modalConfirmBody').innerHTML = 'Do you wish to delete ' + wrapTaskName + '?'
                document.getElementById('btnConfirm').addEventListener('click', confirmTaskDelete);
                document.getElementById('confirmclose').addEventListener('click', removeTaskDeleteListeners);
                modalConfirm.modal({keyboard: true});
            }
        }(task.id, task.name));

    } else {
        taskHitsActive = document.createElement('div')
        taskHitsActive.classList.add('row');
        taskHitsActive.setAttribute("id","taskHitsActive"+task.id)
        taskHitsActive.setAttribute("style","font-size: 70%")
        taskInfoCol.appendChild(taskHitsActive)
        taskHitsActive.innerHTML = 'Jobs Available: ' + task.jobsAvailable
    
        taskHitsCompleted = document.createElement('div')
        taskHitsCompleted.classList.add('row');
        taskHitsCompleted.setAttribute("id","taskHitsCompleted"+task.id)
        taskHitsCompleted.setAttribute("style","font-size: 70%")
        taskInfoCol.appendChild(taskHitsCompleted)
        taskHitsCompleted.innerHTML = 'Jobs Completed: ' + task.jobsCompleted

        taskProgressBarCol = document.createElement('div')
        taskProgressBarCol.classList.add('col-lg-6');
        
        taskProgressBarDiv = document.createElement('div')
        taskProgressBarDiv.setAttribute("id","taskProgressBarDiv"+task.id)

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
        newProgInner.setAttribute("style", "width:"+(task.completed/task.total)*100+"%;transition:none");
    
        newProg.appendChild(newProgInner);
        taskProgressBarDiv.appendChild(newProg);
        taskProgressBarCol.appendChild(taskProgressBarDiv);
        newTaskDiv.appendChild(taskProgressBarCol)

        stopTaskCol = document.createElement('div')
        stopTaskCol.classList.add('col-lg-1');
        stopTaskBtn = document.createElement('button')
        stopTaskBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
        stopTaskBtn.innerHTML = '&times;'
        stopTaskCol.appendChild(stopTaskBtn)
        newTaskDiv.appendChild(stopTaskCol)

        stopTaskBtn.addEventListener('click', function(wrapTaskId) {
            return function() {
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(){
                    if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);   
                        if (reply=='success') {
                            updatePage(current_page)
                        }
                    }
                }
                xhttp.open("GET", '/stopTask/'+wrapTaskId);
                xhttp.send();
            }
        }(task.id));

        tagTaskCol = document.createElement('div')
        tagTaskCol.classList.add('col-lg-1');

        tagTaskLink = document.createElement('a')
        tagTaskLink.setAttribute("href","/jobs")
        
        tagTaskBtn = document.createElement('button')
        tagTaskBtn.setAttribute("class","btn btn-primary btn-block btn-sm")

        icon = document.createElement('i')
        icon.classList.add('fa');
        icon.classList.add('fa-external-link');
        
        tagTaskBtn.appendChild(icon)
        tagTaskLink.appendChild(tagTaskBtn)
        tagTaskCol.appendChild(tagTaskLink)
        newTaskDiv.appendChild(tagTaskCol)
    }

    taskDiv.appendChild(newTaskDiv)
    newTaskDiv.setAttribute('style',"margin-right:10px")
}

function confirmTaskDelete() {
    /** Confirms that the user wishes to delete the selected task, and submits the request to the server. */
    
    removeTaskDeleteListeners()
    modalConfirm.modal('hide')

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/deleteTask/'+selectedTask);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  

            if (reply.status=='success') {
                document.getElementById('modalAlertHeader').innerHTML = 'Success'
                document.getElementById('modalAlertBody').innerHTML = 'Task deletion successfully initiated.'
                alertReload = true
                modalAlert.modal({keyboard: true});
            } else {
                document.getElementById('modalAlertHeader').innerHTML = 'Error'
                document.getElementById('modalAlertBody').innerHTML = reply.message
                modalAlert.modal({keyboard: true});
            }
        }
    }
    xhttp.send();
}

function removeTaskDeleteListeners() {
    /** Remoces the event listeners on the task-deletion confirmation modal */
    document.getElementById('btnConfirm').removeEventListener('click', confirmTaskDelete);
    document.getElementById('confirmclose').removeEventListener('click', removeTaskDeleteListeners);
}

function resetModalAddTask1() {
    /** Resets the first new task modal. */
    newTaskFormDiv = document.getElementById('newTaskFormDiv')

    while(newTaskFormDiv.firstChild){
        newTaskFormDiv.removeChild(newTaskFormDiv.firstChild);
    }

    document.getElementById('newTaskSelect').checked = false
    document.getElementById('csvUploadSelect').checked = false
    document.getElementById('newTaskName').value = ''
}

function BuildLabelRow(IDNum, isLoad, div, includeParent) {
    /**
     * Builds a new label definition row.
     * @param {str} IDNum The ID number of the row
     * @param {bool} isLoad Whether the label is loaded
     * @param {str} div The ID of the div where the row must be build
     * @param {bool} includeParent Whether to include a parent selector
     */

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
    nameInput.id = 'labeldescription-'+IDNum;
    nameInput.name = nameInput.id;
    if (div=='LabelDisplayDiv') {
        nameInput.setAttribute("data-edited","false")
    }
    col1.appendChild(nameInput);

    hotkeyInput = document.createElement('input');
    hotkeyInput.setAttribute("type","text")
    hotkeyInput.classList.add('form-control');
    hotkeyInput.required = true
    hotkeyInput.id = 'labelhotkey-'+IDNum;
    hotkeyInput.name = hotkeyInput.id;
    hotkeyInput.setAttribute("maxlength","1")
    col2.appendChild(hotkeyInput);

    if (includeParent) {
        parentSelector = document.createElement('select');
        parentSelector.classList.add('form-control');
        parentSelector.id = 'labelparent-'+IDNum;
        parentSelector.name = parentSelector.id;
        col3.appendChild(parentSelector);
    }

    inputgroup.appendChild(col1)
    inputgroup.appendChild(col2)
    inputgroup.appendChild(col3)
    col4.appendChild(btnRemove);
    inputgroup.appendChild(col4)
    row.appendChild(inputgroup)
    theDiv.appendChild(row)

    if (includeParent) {
        if (!isLoad) {
            updateAllParentSelects()
        }
    
        $("#"+nameInput.id).change( function() {
            updateAllParentSelects()
            checkLabels(false)
        });
        $("#"+hotkeyInput.id).change( function() {
            checkLabels(false)
        });
        $("#"+parentSelector.id).change( function() {
            checkLabels(false)
        });
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.parentNode.remove();
            updateAllParentSelects()
            checkLabels(false)
        });
    } else {
        $("#"+nameInput.id).change( function(wrapIDNum) {
            return function() {
                checkLabels(true)
                document.getElementById('labeldescription-'+wrapIDNum).setAttribute("data-edited","true")
            }
        }(IDNum));
        $("#"+hotkeyInput.id).change( function(wrapIDNum) {
            return function() {
                checkLabels(true)
                document.getElementById('labeldescription-'+wrapIDNum).setAttribute("data-edited","true")
            }
        }(IDNum));
        btnRemove.addEventListener('click', (evt)=>{
            if (evt.target.parentNode.parentNode.parentNode.parentNode==document.getElementById('LabelDisplayDiv')) {
                sessionDeletes.push(evt.target.id.split("-")[evt.target.id.split("-").length-1])
            }
            evt.target.parentNode.parentNode.parentNode.remove();
            checkLabels(true)
        });
    }
}

function updateAllParentSelects() {
    /** Updates all parent label selectors. */
    allLabels = document.querySelectorAll('[id^=labeldescription-]');
    optionTexts = ['None', 'Vehicles/Humans/Livestock']
    optionValues = ["-99999", "-100000"]
    for (idx = 0; idx < allLabels.length; idx++){
        if ((allLabels[idx].value != '')&&(!optionTexts.includes(allLabels[idx].value))) {
            optionTexts.push(allLabels[idx].value)
            optionValues.push(allLabels[idx].id.replace(/.*-(\d{1,4}).*/m, '$1'))
        }
    }

    allSelectors = document.querySelectorAll('[id^=labelparent-]');
    for (n = 0; n < allSelectors.length; n++){
        if (allSelectors[n].options.length == 0) {
            clearSelect(allSelectors[n])
            fillSelect(allSelectors[n], optionTexts, optionValues)
        } else {
            storedVal = allSelectors[n].options[allSelectors[n].selectedIndex].value;
            clearSelect(allSelectors[n])
            fillSelect(allSelectors[n], optionTexts, optionValues)
            if (!optionValues.includes(storedVal)) {
                allSelectors[n].value = "-99999"
            } else {
                allSelectors[n].value = storedVal
            }
        }
    }
}

function checkLabels(editing) {
    /**
     * Checks the legality of the labels, updates the legalLabels status, and updates the error messages accordingly.
     * @param {bool} editing Whether the labels being checked are new labels, or labels being edited.
    */
   
    allHotkeys = document.querySelectorAll('[id^=labelhotkey-]');
    allDescriptions = document.querySelectorAll('[id^=labeldescription-]');

    var duplicateDescriptions = []
    var duplicateKeys = {}
    var globalHotkeysUsed = []
    var globalDescriptionsUsed = []
    var emptyDescription = false
    var emptyHotkey = false
    var selfParent = false
    var descriptionSlash = false
    var hotkeySlash = false

    var dict = {};
    dict['none'] = []
    dict['vehicles/humans/livestock'] = []
    if (editing) {
        for (oT=0;oT<optionTexts.length;oT++) {
            dict[optionTexts[oT].toLowerCase()] = []
        }
    }
    for (n = 0; n < allDescriptions.length; n++){
        if (allDescriptions[n].value != '') {
            description = allDescriptions[n].value.toLowerCase()

            if ((description.includes('/'))||(description.includes('\\'))) {
                descriptionSlash = true
            }

            if (globalDescriptions.includes(description)) {
                if (!globalDescriptionsUsed.includes(description)) {
                    globalDescriptionsUsed.push(description)
                }
            } else {
                if (!(description in dict)) {
                    dict[description] = [];
                } else {
                    if ((!duplicateDescriptions.includes(description))&&((allDescriptions[n].parentNode.parentNode.parentNode.parentNode.id=='AddLabelDiv')||(allDescriptions[n].parentNode.parentNode.parentNode.parentNode.id=='divLabel'))) {
                        duplicateDescriptions.push(description)
                    }
                }
            }
        } else {
            if (allHotkeys[n].value!='') {
                emptyDescription = true
            }
        }
    }

    for (n = 0; n < allDescriptions.length; n++){
        IDNum = allDescriptions[n].id.split("-")[allDescriptions[n].id.split("-").length-1]

        if (editing) {
            selectElement = document.getElementById('LabelLevelSelector');
        } else {
            selectElement = document.getElementById('labelparent-'+IDNum);
        }
        parent = selectElement.options[selectElement.selectedIndex].text.toLowerCase(); 
        hotkey = document.getElementById('labelhotkey-'+IDNum).value.toLowerCase();

        if (parent==allDescriptions[n].value.toLowerCase()) {
            selfParent=true
        }

        if ((!hotkey.match(/^[0-9a-z]$/))&&(hotkey!=' ')) {
            if ((hotkey == '') && (allDescriptions[n].value == '')) {
                //pass
            } else {
                hotkeySlash = true
            }
        }

        if ((parent=='none')&&(globalHotkeysParents.includes(hotkey))&&(!globalHotkeysUsed.includes(hotkey))) {
            globalHotkeysUsed.push(hotkey)
        } else if ((parent!='none')&&(globalHotkeysChildren.includes(hotkey))&&(!globalHotkeysUsed.includes(hotkey))) {
            globalHotkeysUsed.push(hotkey)
        }

        if (parent in dict) {
            if (hotkey != '') {
                if (!dict[parent].includes(hotkey)) {
                    dict[parent].push(hotkey)
                } else {
                    if (!(parent in duplicateKeys)) {
                        duplicateKeys[parent] = []
                    }
                    if (!duplicateKeys[parent].includes(hotkey)) {
                        duplicateKeys[parent].push(hotkey)
                    }
                }
            } else {
                if (allDescriptions[n].value != '') {
                    emptyHotkey = true
                }
            }
        }        
    }

    // Print
    if (editing) {
        labelErrors = document.getElementById('labelEditErrors')
    } else {
        labelErrors = document.getElementById('labelErrors')
    }
    
    while(labelErrors.firstChild){
        labelErrors.removeChild(labelErrors.firstChild);
    }
    if (duplicateDescriptions.length != 0) {
        newdiv = document.createElement('div')
        labtext = 'Duplicate Labels: '
        for (n = 0; n < duplicateDescriptions.length; n++){
            labtext += duplicateDescriptions[n]
            if (n != duplicateDescriptions.length-1) {
                labtext += ', '
            }
        }
        newdiv.innerHTML = labtext
        labelErrors.appendChild(newdiv)
    }
    if (Object.keys(duplicateKeys).length != 0) {
        newdiv = document.createElement('div')
        hotext = 'Duplicate Hotkeys: '

        Object.entries(duplicateKeys).forEach(([key, value]) => {
            hotext += '(' + key + ': '
            for (n = 0; n < value.length; n++){
                hotext += value[n]
                if (n != value.length-1) {
                    hotext += ', '
                }
            }
            hotext += ')  '
        });

        newdiv.innerHTML = hotext
        labelErrors.appendChild(newdiv)
    }

    if (globalDescriptionsUsed.length != 0) {
        newdiv = document.createElement('div')
        labtext = 'Disallowed Labels Used: '
        for (n = 0; n < globalDescriptionsUsed.length; n++){
            labtext += globalDescriptionsUsed[n]
            if (n != globalDescriptionsUsed.length-1) {
                labtext += ', '
            }
        }
        newdiv.innerHTML = labtext
        labelErrors.appendChild(newdiv)
    }

    if (globalHotkeysUsed.length != 0) {
        newdiv = document.createElement('div')
        labtext = 'Disallowed Hotkeys Used: '
        for (n = 0; n < globalHotkeysUsed.length; n++){
            labtext += globalHotkeysUsed[n]
            if (n != globalHotkeysUsed.length-1) {
                labtext += ', '
            }
        }
        newdiv.innerHTML = labtext
        labelErrors.appendChild(newdiv)
    }

    if (selfParent) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'A label cannot be its own parent'
        labelErrors.appendChild(newdiv)
    }

    if (hotkeySlash) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'A hotkey can only be a letter, a number, or the space character.'
        labelErrors.appendChild(newdiv)
    }

    if (descriptionSlash) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'A label name cannot include slashes.'
        labelErrors.appendChild(newdiv)
    }

    if ((!hotkeySlash)&&(!descriptionSlash)&&(!selfParent)&&(!emptyDescription)&&(!emptyHotkey)&&(Object.keys(duplicateKeys).length==0)&&(duplicateDescriptions.length==0)&&(globalHotkeysUsed.length==0)&&(globalDescriptionsUsed.length==0)) {
        legalLabels = true
    } else {
        legalLabels = false
    }
}

function populatePreviousLabels() {
    /** Populates the labels in the new task modal from a previous task. */
    
    taskElement = document.getElementById('prevLabelsTask')
    task = taskElement.options[taskElement.selectedIndex].value;

    if (task != '-99999') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                labels = JSON.parse(this.responseText); 
                divLabel = document.querySelector('#divLabel') 

                while(divLabel.firstChild){
                    divLabel.removeChild(divLabel.firstChild);
                }

                optionTexts = ['None', 'Vehicles/Humans/Livestock']
                optionValues = ["-99999", "-100000"]
                for (iiii=0;iiii<labels.length;iiii++) {
                    optionTexts.push(labels[iiii][0])
                    optionValues.push(iiii.toString())
                }

                for (iiiii=0;iiiii<labels.length;iiiii++) {
                    labelDescription = labels[iiiii][0]
                    labelHotkey = labels[iiiii][1]
                    labelParent = labels[iiiii][2]

                    IDNum = getIdNumforNext('labeldescription');
                    BuildLabelRow(IDNum, true, 'divLabel', true)

                    document.getElementById('labeldescription-'+iiiii.toString()).value = labelDescription
                    document.getElementById('labelhotkey-'+iiiii.toString()).value = labelHotkey

                    selector = document.getElementById('labelparent-'+iiiii.toString())
                    clearSelect(selector)
                    fillSelect(selector, optionTexts, optionValues)

                    if (labelParent == 'None') {
                        selector.value = "-99999"
                    } else if (labelParent == 'Vehicles/Humans/Livestock') {
                        selector.value = "-100000"
                    } else {
                        selector.value = (optionTexts.indexOf(labelParent)-2).toString()
                    }
                }
                checkLabels(false)
            }
        }
        xhttp.open("GET", '/getLabels/'+task);
        xhttp.send();
    } else {
        // If None is selected, clear the list
        divLabel = document.querySelector('#divLabel')
        while(divLabel.firstChild){
            divLabel.removeChild(divLabel.firstChild);
        }
        BuildLabelRow(0, false, 'divLabel', true)

        document.getElementById('prevLabels').removeChild(taskElement)
        document.getElementById('prevLabelsSurvey').value = '-99999'
        checkLabels(false)
    }
}

function populateTaskNames() {
    /** Populates the taskNames variable, used to check if a task name is already in use for the selected survey. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            tasks = JSON.parse(this.responseText);  
            taskNames = []            
            for (iiiiiiii=0;iiiiiiii<tasks.length;iiiiiiii++) {
                taskNames.push(tasks[iiiiiiii][1])
            }
        }
    }
    xhttp.open("GET", '/getTasks/'+selectedSurvey);
    xhttp.send();
}

function prepNewTask() {
    /** Initialises the label section of the new-task modal. */

    BuildLabelRow(0, false, 'divLabel', true)
    prevLabelsDiv = document.getElementById('prevLabels')
    populateTaskNames()
    surveyElement = document.createElement('select');
    surveyElement.classList.add('form-control');
    surveyElement.id = 'prevLabelsSurvey';
    surveyElement.name = surveyElement.id;
    prevLabelsDiv.appendChild(surveyElement);

    $("#prevLabelsSurvey").change( function() {
        surveyElement = document.getElementById('prevLabelsSurvey')
        survey = surveyElement.options[surveyElement.selectedIndex].value;
    
        if (survey != '-99999') {
            taskElement = document.getElementById('prevLabelsTask');
            if (!taskElement) {
                prevLabelsDiv = document.getElementById('prevLabels')
                taskElement = document.createElement('select');
                taskElement.classList.add('form-control');
                taskElement.id = 'prevLabelsTask';
                taskElement.name = taskElement.id;
                prevLabelsDiv.appendChild(taskElement);
            
                $("#prevLabelsTask").change( function() {
                    populatePreviousLabels()
                });
            }
            updateTasks(surveyElement, taskElement)
        } else {
            divLabel = document.querySelector('#divLabel')
            while(divLabel.firstChild){
                divLabel.removeChild(divLabel.firstChild);
            }
            BuildLabelRow(0, false, 'divLabel', true)

            taskElement = document.getElementById('prevLabelsTask')
            if (taskElement) {
                document.getElementById('prevLabels').removeChild(taskElement)
            }

            checkLabels(false)
        }
    });
    updateSurveys(surveyElement)
    updateAllParentSelects()
}

function buildNewTaskForm() {
    /** Builds the new-task form. */

    newTaskFormDiv = document.getElementById('newTaskFormDiv')
    while(newTaskFormDiv.firstChild){
        newTaskFormDiv.removeChild(newTaskFormDiv.firstChild);
    }
    
    h51 = document.createElement('h5')
    h51.setAttribute('style','margin-bottom: 2px')
    h51.innerHTML = 'Labels'
    newTaskFormDiv.appendChild(h51)

    div1 = document.createElement('div')
    div1.setAttribute('style', 'font-size: 80%; margin-bottom: 2px')
    div1.innerHTML = '<i>Set up the labels based on the species you expect to encounter.</i>'
    newTaskFormDiv.appendChild(div1)

    newTaskFormDiv.appendChild(document.createElement('br'))

    div1 = document.createElement('div')
    div1.innerHTML = 'Load Labels'
    newTaskFormDiv.appendChild(div1)

    div1 = document.createElement('div')
    div1.setAttribute('style', 'font-size: 80%; margin-bottom: 2px')
    div1.innerHTML = '<i>Load labels from a previous annotation set or a template.</i>'
    newTaskFormDiv.appendChild(div1)

    div2 = document.createElement('div')
    div2.classList.add('row')
    newTaskFormDiv.appendChild(div2)

    div3 = document.createElement('div')
    div3.classList.add('col-lg-4')
    div2.appendChild(div3)

    div4 = document.createElement('div')
    div4.setAttribute('id','prevLabels')
    div3.appendChild(div4)

    newTaskFormDiv.appendChild(document.createElement('br'))

    div5 = document.createElement('div')
    div5.setAttribute('id','labelErrors')
    div5.setAttribute('style','font-size: 80%; color: #DF691A')
    newTaskFormDiv.appendChild(div5)

    div6 = document.createElement('div')
    div6.classList.add('row')
    newTaskFormDiv.appendChild(div6)

    div7 = document.createElement('div')
    div7.classList.add('col-lg-4')
    div7.innerHTML = 'Label Name'
    div6.appendChild(div7)

    div8 = document.createElement('div')
    div8.classList.add('col-lg-1')
    div8.innerHTML = 'Hotkey'
    div6.appendChild(div8)

    div9 = document.createElement('div')
    div9.classList.add('col-lg-4')
    div9.innerHTML = 'Parent'
    div6.appendChild(div9)
    
    div10 = document.createElement('div')
    div10.classList.add('row')
    newTaskFormDiv.appendChild(div10)

    div11 = document.createElement('div')
    div11.classList.add('col-lg-12')
    div11.setAttribute('id','divLabel')
    div10.appendChild(div11)

    div12 = document.createElement('div')
    div12.classList.add('row')
    newTaskFormDiv.appendChild(div12)

    div13 = document.createElement('div')
    div13.classList.add('col-lg-9')
    div12.appendChild(div13)

    div14 = document.createElement('div')
    div14.classList.add('col-lg-3')
    div12.appendChild(div14)

    button1 = document.createElement('button')
    button1.classList.add('btn')
    button1.classList.add('btn-info')
    button1.setAttribute('type','button')
    button1.setAttribute('id','btnAddLabel')
    button1.innerHTML = '+'
    div14.appendChild(button1)

    button1.addEventListener('click', ()=>{
        IDNum = getIdNumforNext('labeldescription');
        BuildLabelRow(IDNum, false, 'divLabel', true)
    });
}

$("#newTaskSelect").change( function() {
    /** Listener on the new-task radio button. */
    newTaskSelect = document.getElementById('newTaskSelect')
    if (newTaskSelect.checked) {
        buildNewTaskForm()
        prepNewTask()
    }
})

$("#csvUploadSelect").change( function() {
    /** Listener on the import task radio button. */
    csvUploadSelect = document.getElementById('csvUploadSelect')
    if (csvUploadSelect.checked) {
        buildCSVUploadForm()
    }
})

function buildCSVUploadForm() {
    /** Builds the csv upload form in the new-task modal. */

    newTaskFormDiv = document.getElementById('newTaskFormDiv')

    while(newTaskFormDiv.firstChild){
        newTaskFormDiv.removeChild(newTaskFormDiv.firstChild);
    }

    h51 = document.createElement('h5')
    h51.setAttribute('style','margin-bottom: 2px')
    h51.innerHTML = 'CSV Upload'
    newTaskFormDiv.appendChild(h51)

    div1 = document.createElement('div')
    div1.setAttribute('style', 'font-size: 80%; margin-bottom: 2px')
    div1.innerHTML = '<i>Import annotations from a CSV file. All labels will be automatically generated.</i>'
    newTaskFormDiv.appendChild(div1)

    row = document.createElement('div')
    row.classList.add('row')
    newTaskFormDiv.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-6')
    row.appendChild(col)

    div = document.createElement('div')
    div.classList.add('input-group')
    col.appendChild(div)

    input = document.createElement('input')
    input.setAttribute('style',"background-color:white")
    input.setAttribute('type','text')
    input.setAttribute('id','csvFileUploadText')
    input.classList.add('form-control')
    input.disabled = true
    div.appendChild(input)

    label = document.createElement('label')
    label.classList.add('input-group-btn')
    div.appendChild(label)

    span = document.createElement('span')
    span.classList.add('btn')
    span.classList.add('btn-primary')
    span.innerHTML = 'Browse'
    label.appendChild(span)

    input2 = document.createElement('input')
    input2.setAttribute('type','file')
    input2.setAttribute('style','display:none')
    input2.setAttribute('id','csvFileUpload')
    input2.setAttribute('accept','.csv,.CSV')
    span.appendChild(input2)

    errordiv = document.createElement('div')
    errordiv.setAttribute('id','csvUploadErrors')
    errordiv.setAttribute('style','font-size: 80%; color: #DF691A')
    newTaskFormDiv.append(errordiv)

    $("#csvFileUpload").change( function() {
        document.getElementById('csvFileUploadText').value = document.getElementById("csvFileUpload").files[0].name
    })
}

btnAddNewLabel.addEventListener('click', ()=>{
    /** Adds a new label row when the button is pressed. */
    IDNum = getIdNumforNext('labeldescription-');
    BuildLabelRow(IDNum, false, 'AddLabelDiv', false)
});

btnModalAddTaskBack.addEventListener('click', ()=>{
    /** Opens the previous add task modal when the user presses back. */
    modalAddTask2.modal('hide');
    modalAddTask.modal({keyboard: true});
});

btnModalAddTaskBack2.addEventListener('click', ()=>{
    /** Opens the previous add task modal when the user presses back. */
    modalAddTask3.modal('hide');
    modalAddTask2.modal({keyboard: true});
});

btnSaveLabelChanges.addEventListener('click', ()=>{
    /** Listener that locally saves label edits to be submitted later. */

    checkLabels(true)
    if (legalLabels) {
        selectElement = document.getElementById('LabelLevelSelector');
        parent = selectElement.options[selectElement.selectedIndex].value;

        allHotkeys = document.querySelectorAll('[id^=labelhotkey-]');
        allDescriptions = document.querySelectorAll('[id^=labeldescription-]');

        for (iiiiiiiii=0;iiiiiiiii<sessionDeletes.length;iiiiiiiii++) {
            if (sessionDeletes[iiiiiiiii].includes('s')) {
                // Session label deleted
                if (sessionDeletes[iiiiiiiii] in taskEditDict[parent]['additional']) {
                    delete taskEditDict[parent]['additional'][sessionDeletes[iiiiiiiii]]
                }
            }
        }

        taskEditDict[parent]['edits']['delete'].push(...sessionDeletes)

        for (iiiiiiiiii=0;iiiiiiiiii<allDescriptions.length;iiiiiiiiii++) {
            if ((allDescriptions[iiiiiiiiii].value!='')&&(allHotkeys[iiiiiiiiii].value!='')) {
                if (allDescriptions[iiiiiiiiii].parentNode.parentNode.parentNode.parentNode==document.getElementById('AddLabelDiv')) {
                    //new labels
                    NID = 's'+allDescriptions[iiiiiiiiii].id.split("-")[allDescriptions[iiiiiiiiii].id.split("-").length-1]
                    while (sessionIDs.includes(NID)) {
                        NID = 's'+NID
                    }
                    sessionIDs.push(NID)
                    taskEditDict[parent]['additional'][NID] = {}
                    taskEditDict[parent]['additional'][NID]['description'] = allDescriptions[iiiiiiiiii].value
                    taskEditDict[parent]['additional'][NID]['hotkey'] = allHotkeys[iiiiiiiiii].value
    
                    if (!(NID in taskEditDict)) {
                        taskEditDict[NID] = {}
                        taskEditDict[NID]['edits'] = {}
                        taskEditDict[NID]['edits']['delete'] = []
                        taskEditDict[NID]['edits']['modify'] = {}
                        taskEditDict[NID]['additional'] = {}
                    }
                } else {
                    //edited labels
                    if (allDescriptions[iiiiiiiiii].getAttribute('data-edited')=='true') {
                        NID = allDescriptions[iiiiiiiiii].id.split("-")[allDescriptions[iiiiiiiiii].id.split("-").length-1]
    
                        if (NID.includes('s')) {
                            // Edited new label, so edit original additional
                            taskEditDict[parent]['additional'][NID]['description'] = allDescriptions[iiiiiiiiii].value
                            taskEditDict[parent]['additional'][NID]['hotkey'] = allHotkeys[iiiiiiiiii].value
                        } else {
                            // Multiple edits in the same session just overwrite each other
                            taskEditDict[parent]['edits']['modify'][NID] = {}
                            taskEditDict[parent]['edits']['modify'][NID]['description'] = allDescriptions[iiiiiiiiii].value
                            taskEditDict[parent]['edits']['modify'][NID]['hotkey'] = allHotkeys[iiiiiiiiii].value
                        }
                    }
                }
            }
        }

        // Clear
        updateEditLabelDisplay()
    }
});

btnEditTaskSubmit.addEventListener('click', ()=>{
    /** Submit the edited task laels to the server when button is pushed. */

    document.getElementById('btnEditTaskSubmit').disabled = true

    var formData = new FormData()
    formData.append("editDict", JSON.stringify(taskEditDict))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/editTask/'+selectedTask);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply=='success') {
                modalEditTask.modal('hide')
            } else {
                document.getElementById('btnEditTaskSubmit').disabled = false
            }
        }
    }
    xhttp.send(formData);
});

btnCreateTask2.addEventListener('click', ()=>{
    /** Opens the next add-task modal when the button is pressed. */
    modalAddTask2.modal('hide')
    modalAddTask3.modal({keyboard: true})
});

btnCreateTask3.addEventListener('click', ()=>{
    /** Submits the new-task information to the server when the last modal is completed. */

    document.getElementById('btnCreateTask3').disabled=true

    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]')
    includes = []
    for (cbno=0;cbno<allCheckBoxes.length;cbno++) {
        if (allCheckBoxes[cbno].checked) {
            classification = allCheckBoxes[cbno].parentNode.children[1].innerHTML
            includes.push(classification)
        }
    }
    
    allTranslations = document.querySelectorAll('[id^=classTranslationText-]')
    translationInfo = {}
    for (cbno=0;cbno<allTranslations.length;cbno++) {
        IDNum = allTranslations[cbno].id.split("-")[allTranslations[cbno].id.split("-").length-1]
        classification = allTranslations[cbno].innerHTML

        translationSelect = document.getElementById('classTranslationSelect-'+IDNum)
        translation = translationSelect.options[translationSelect.selectedIndex].text

        if (translation=='nothing (ignore)') {
            translation='nothing'
        }
        translationInfo[classification] = translation
    }
    
    var formData = new FormData()
    formData.append("info", addTaskInfo)
    formData.append("includes", includes)
    formData.append("translation", JSON.stringify(translationInfo))

    parentLabel = document.getElementById('parentLabel').checked

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/createTask/'+selectedSurvey+'/'+parentLabel);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply=='success') {
                modalAddTask3.modal('hide')
                updatePage(current_page)
            } else {
                document.getElementById('btnCreateTask3').disabled=false
            }
        }
    }
    xhttp.send(formData);
});

btnCreateTask.addEventListener('click', ()=>{
    /** Checks user info in the first add-task form for legality and packages the info for later submission. Also submits the annotation csv if needed. */
    
    newTaskName = document.getElementById('newTaskName').value

    if ((newTaskName.toLowerCase()=='default')||(newTaskName.toLowerCase().includes('_o_l_d_'))||(newTaskName.toLowerCase().includes('_copying'))) {
        nameUsed = true
        document.getElementById('nameErrors').innerHTML = 'That task name is reserved. Please choose another.'
    }

    if (taskNames.includes(newTaskName)) {
        nameUsed = true
        document.getElementById('nameErrors').innerHTML = 'Task name is already in use.'
    } else {
        nameUsed = false
        document.getElementById('nameErrors').innerHTML = ''
    }

    if ((newTaskName.includes('/'))||(newTaskName.includes('\\'))) {
        nameSlash = true
        document.getElementById('nameErrors').innerHTML = 'Task name cannot contain slashes.'
    } else {
        nameSlash = false
        document.getElementById('nameErrors').innerHTML = ''
    }

    if ((!nameSlash)&&(!nameUsed)&&(newTaskName.length!=0)) {
        if (document.getElementById('newTaskSelect').checked) {
            if ((legalLabels)&&(legalTags)) {
                info = '["'
                info += newTaskName + '",['
        
                labelDescriptions = document.querySelectorAll('[id^=labeldescription-]');
                labelHotkeys = document.querySelectorAll('[id^=labelhotkey-]');
                labelParents = document.querySelectorAll('[id^=labelparent-]');

                addTaskDescriptions = []
                addTaskDescriptions.push('nothing (ignore)')
                addTaskDescriptions.push('vehicles/humans/livestock')
                for (i = 0; i < labelDescriptions.length; i++){
                    if ((labelDescriptions[i].value!='')&&(labelHotkeys[i].value!='')) {
                        addTaskDescriptions.push(labelDescriptions[i].value.toLowerCase())
                        info += '["'+labelDescriptions[i].value+'","'+labelHotkeys[i].value+'","'+labelParents[i].options[labelParents[i].selectedIndex].text.replace(/\//g, '*****')
                        if (i == labelDescriptions.length-1) {
                            info += '"]'
                        } else {
                            info += '"],'
                        }
                    }
                }

                if (info[info.length-1]==',') {
                    info.substring(0, info.length-1)
                }
        
                info += ']]'
                addTaskInfo = info
                modalAddTask.modal('hide')
                modalAddTask2.modal({keyboard: true})
            }
        } else if (document.getElementById('csvUploadSelect').checked) {
    
            csvFileUpload = document.getElementById("csvFileUpload")
            document.getElementById('csvUploadErrors').innerHTML = ''
    
            if (csvFileUpload.files.length==1) {
                if (csvFileUpload.files[0].size>50000000) {
                    document.getElementById('csvUploadErrors').innerHTML = 'File cannot be larger than 50MB.'
                } else {
    
                    var reader = new FileReader()
                    reader.addEventListener('load', (event) => {
                        csvdata = event.target.result
                        if (csvdata.split('\n')[0].split(',').includes('filename')&&csvdata.split('\n')[0].toLowerCase().includes('label')) {
                            var formData = new FormData()
                            formData.append("csv", csvFileUpload.files[0])
                            formData.append("taskName", newTaskName)
                            formData.append("survey", selectedSurvey)
                    
                            var xhttp = new XMLHttpRequest();
                            xhttp.open("POST", '/UploadCSV');
                            xhttp.onreadystatechange =
                            function(){
                                if (this.readyState == 4 && this.status == 200) {
                                    reply = JSON.parse(this.responseText);  
                                    if (reply=='success') {
                                        modalAddTask.modal('hide')
                                        updatePage(current_page)
                                    } else {
                                        document.getElementById('csvUploadErrors').innerHTML = 'The images in the csv file could not be matched with those in this survey. Please check your format.'
                                    }
                                }
                            }
                            xhttp.send(formData);
                        } else {
                            document.getElementById('csvUploadErrors').innerHTML = 'The format of your csv file is incorrect. It must contain a "filename" column and at least one "label" column.'
                        }
                    });
                    reader.readAsText(csvFileUpload.files[0])
                }
            } else {
                document.getElementById('csvUploadErrors').innerHTML = 'There is no file selected for upload.'
            }
        }
    }
});

btnDiscardChanges.addEventListener('click', ()=>{
    /** Opens the discard label-changes confirmation modal. */
    discardOpened = true
    modalEditTask.modal('hide')
    modalConfirmEdit.modal({keyboard: true});
});

btnCancelDiscard.addEventListener('click', ()=>{
    /** Cancels the requested discarding of label changes, and re-opens the edit labels modal. */
    discardCancelled = true
    modalConfirmEdit.modal('hide')
    modalEditTask.modal({keyboard: true});
});

modalAddTask.on('hidden.bs.modal', function(){
    /** Resets the helpReturn variable when the add task modal is closed. */
    if (!helpReturn) {
        // pass
    } else {
        helpReturn = false
    }
});

function resetModalAddTask2() {
    /** Clears the second page of the add-task modal. */

    addTaskHeading = false

    classTranslationHeading = document.getElementById('classTranslationHeading')
    while(classTranslationHeading.firstChild){
        classTranslationHeading.removeChild(classTranslationHeading.firstChild);
    }

    classTranslationDiv = document.getElementById('classTranslationDiv')
    while(classTranslationDiv.firstChild){
        classTranslationDiv.removeChild(classTranslationDiv.firstChild);
    }
}

function resetModalAddTask3() {
    /** Clears the third page of the add-task modal. */

    document.getElementById('selectAllClassifications').checked = false
    document.getElementById('speciesLabel').checked = true
    document.getElementById('parentLabel').checked = false
    surveyClassifications = null

    classificationSelection = document.getElementById('classificationSelection')
    while(classificationSelection.firstChild){
        classificationSelection.removeChild(classificationSelection.firstChild);
    }
}

modalAddTask2.on('hidden.bs.modal', function(){
    /** Resets the helpReturn variable when the add task modal is closed. */
    if (!helpReturn) {
        // pass
    } else {
        helpReturn = false
    }
});

modalAddTask3.on('hidden.bs.modal', function(){
    /** Resets the helpReturn variable when the add task modal is closed. */
    if (!helpReturn) {
        // pass
        document.getElementById('btnCreateTask3').disabled = false
    } else {
        helpReturn = false
    }
});

function buildTranslationRow(IDNum,classification,translationDiv,taskLabels) {
    /**
     * Builds a translation row with the specified information.
     * @param {str} IDNum The ID number for the row
     * @param {str} classification The classification to be translated
     * @param {div} translationDiv The div where the row must be constructed
     * @param {arr} taskLabels The labels for the task
     * */
    
    classTranslationDiv = document.getElementById(translationDiv)

    div = document.createElement('div')
    div.classList.add('row')
    div.setAttribute('id','classTranslation-'+IDNum)
    classTranslationDiv.appendChild(div)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    col1.id = 'classTranslationText-'+IDNum
    col1.innerHTML = classification
    div.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-1')
    col2.innerHTML='&#x276f;'
    div.appendChild(col2)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-4')
    div.appendChild(col3)

    select = document.createElement('select')
    select.classList.add('form-control')
    select.id = 'classTranslationSelect-'+IDNum
    select.name = select.id
    col3.appendChild(select)

    optionValues = []
    for (vb=0;vb<taskLabels.length;vb++) {
        optionValues.push(vb)
    }

    fillSelect(select, taskLabels, optionValues)
}

function updateTranslationMatrix() {
    /** Updates the label translation selectors in the new task form. */

    document.getElementById('btnCreateTask2').disabled=true
    
    optionValues = []
    for (vb=0;vb<addTaskDescriptions.length;vb++) {
        optionValues.push(vb)
    }
    classTranslationSelects = document.querySelectorAll('[id^=classTranslationSelect');
    for (jj=0;jj<classTranslationSelects.length;jj++) {
        selection = classTranslationSelects[jj].options[classTranslationSelects[jj].selectedIndex].text;
        updatedIndex = addTaskDescriptions.indexOf(selection)
        clearSelect(classTranslationSelects[jj])
        fillSelect(classTranslationSelects[jj], addTaskDescriptions, optionValues)
        classTranslationSelects[jj].selectedIndex = updatedIndex
    }

    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]');
    for (cbno=0;cbno<allCheckBoxes.length;cbno++) {
        IDNum = allCheckBoxes[cbno].id.split("-")[allCheckBoxes[cbno].id.split("-").length-1]
        classification = allCheckBoxes[cbno].parentNode.children[1].innerHTML
        if ((!addTaskDescriptions.includes(classification.toLowerCase()))&&(classification!='Vehicles/Humans/Livestock')&&(classification!='Nothing')) {
            if (!addTaskHeading) {
                classTranslationHeading = document.getElementById('classTranslationHeading')

                while(classTranslationHeading.firstChild){
                    classTranslationHeading.removeChild(classTranslationHeading.firstChild);
                }

                h5 = document.createElement('h5')
                h5.innerHTML = 'Classification Translations'
                h5.setAttribute('style','margin-bottom: 2px')
                classTranslationHeading.appendChild(h5)

                h5 = document.createElement('div')
                h5.innerHTML = '<i>Translate the AI-generated classifications to your labels. Select nothing (ignore) if you do not expect a species in your region.</i>'
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                classTranslationHeading.appendChild(h5)

                addTaskHeading = true
            }
            check = document.getElementById('classTranslation-'+IDNum)
            if (!check) {
                buildTranslationRow(IDNum,classification,'classTranslationDiv',addTaskDescriptions)
            }
        } else {
            check = document.getElementById('classTranslation-'+IDNum)
            if (check) {
                check.remove()
            }
        }
    }
    if (!document.getElementById('classTranslationDiv').firstChild) {
        classTranslationHeading = document.getElementById('classTranslationHeading')
        while(classTranslationHeading.firstChild){
            classTranslationHeading.removeChild(classTranslationHeading.firstChild);
        }

        h5 = document.createElement('h5')
        h5.innerHTML = 'All classifications are matched - no translations required.'
        h5.setAttribute('style','margin-bottom: 2px')
        classTranslationHeading.appendChild(h5)

        addTaskHeading = false
    }

    document.getElementById('btnCreateTask2').disabled=false
}

function updateClassificationBoxes() {
    /** Updates the auto-classification checkboxes based on ignored classifications. */

    allTranslations = document.querySelectorAll('[id^=classTranslationText-]')
    ignores = []
    for (cbno=0;cbno<allTranslations.length;cbno++) {
        IDNum = allTranslations[cbno].id.split("-")[allTranslations[cbno].id.split("-").length-1]
        classification = allTranslations[cbno].innerHTML

        translationSelect = document.getElementById('classTranslationSelect-'+IDNum)
        translation = translationSelect.options[translationSelect.selectedIndex].text

        if (translation=='nothing (ignore)') {
            ignores.push(classification)
        }
    }

    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]');
    for (cbno=0;cbno<allCheckBoxes.length;cbno++) {
        IDNum = allCheckBoxes[cbno].id.split("-")[allCheckBoxes[cbno].id.split("-").length-1]
        classification = allCheckBoxes[cbno].parentNode.children[1].innerHTML
        if (ignores.includes(classification)) {
            allCheckBoxes[cbno].parentNode.remove()
        }
    }
}

modalAddTask3.on('shown.bs.modal', function(){
    /** Updates the auto-classification form when the modal is opened. */
    document.getElementById('btnCreateTask2').disabled = true
    updateClassificationBoxes()
    document.getElementById('btnCreateTask2').disabled = false
});

function buildClassificationCheckBoxes() {
    /** Build the auto-classification checkboxes in the add task form. */

    classificationSelection = document.getElementById('classificationSelection')
    while(classificationSelection.firstChild){
        classificationSelection.removeChild(classificationSelection.firstChild);
    }

    for (cno=0;cno<surveyClassifications.length;cno++) {
        IDNum = getIdNumforNext('classificationSelection-')

        div = document.createElement('div')
        div.setAttribute('class','custom-control custom-checkbox')
        classificationSelection.appendChild(div)

        input = document.createElement('input')
        input.setAttribute('type','checkbox')
        input.setAttribute('class','custom-control-input')
        input.setAttribute('id','classificationSelection-'+IDNum)
        input.setAttribute('name','classificationSelection-'+IDNum)
        div.appendChild(input)

        label = document.createElement('label')
        label.setAttribute('class','custom-control-label')
        label.setAttribute('for','classificationSelection-'+IDNum)
        label.innerHTML = surveyClassifications[cno]
        div.appendChild(label)
    }
}

modalAddTask2.on('shown.bs.modal', function(){
    /** Updates the label translation form in the add-task modal when opened. */

    if (surveyClassifications!=null) {
        buildClassificationCheckBoxes()
        updateTranslationMatrix()
    } else {
        document.getElementById('btnCreateTask2').disabled = true
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getSurveyClassifications/'+selectedSurvey);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                surveyClassifications = JSON.parse(this.responseText);
                buildClassificationCheckBoxes()
                updateTranslationMatrix()
                document.getElementById('btnCreateTask2').disabled = false
            }
        }
        xhttp.send();
    }
});

$("#selectAllClassifications").change( function() {
    /** Listener on the select all species-classification selector on the add-task modal that checks all the boxes if selected, and clears otherwise. */
    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]');
    if (document.getElementById('selectAllClassifications').checked) {
        for (sAc=0;sAc<allCheckBoxes.length;sAc++) {
            allCheckBoxes[sAc].checked = true
        }
    } else {
        for (sAc=0;sAc<allCheckBoxes.length;sAc++) {
            allCheckBoxes[sAc].checked = false
        }
    }
})

function updateEditLabelDisplay() {
    /** Updates the edit label modal based on the current session information. */

    LabelDisplayDiv = document.getElementById('LabelDisplayDiv')
    while(LabelDisplayDiv.firstChild){
        LabelDisplayDiv.removeChild(LabelDisplayDiv.firstChild);
    }

    AddLabelDiv = document.getElementById('AddLabelDiv')
    while(AddLabelDiv.firstChild){
        AddLabelDiv.removeChild(AddLabelDiv.firstChild);
    }

    sessionDeletes = []

    LabelLevelSelector = document.getElementById('LabelLevelSelector')
    selectedLevel = LabelLevelSelector.options[LabelLevelSelector.selectedIndex].value

    optionTexts = ['None','Vehicles/Humans/Livestock']
    optionValues = ['-99999','-100000']

    for (iiiiiiiiiii=0;iiiiiiiiiii<globalLabels.length;iiiiiiiiiii++) {
        labelDeleted = false
        labelEdited = false
        labelDescription = globalLabels[iiiiiiiiiii][0]
        labelHotkey = globalLabels[iiiiiiiiiii][1]
        labelParent = globalLabels[iiiiiiiiiii][2]
        labelID = globalLabels[iiiiiiiiiii][3]
        ParentID = globalLabels[iiiiiiiiiii][4]

        for (level in taskEditDict) {
            if (taskEditDict[level]['edits']['delete'].includes(String(labelID))) {
                labelDeleted = true
            }
        }

        if (!labelDeleted) {
            for (level in taskEditDict) {
                if (labelID in taskEditDict[level]['edits']['modify']) {
                    optionTexts.push(taskEditDict[level]['edits']['modify'][labelID]['description'])
                    optionValues.push(labelID)
                    labelEdited = true

                    if (ParentID==selectedLevel) {
                        BuildLabelRow(labelID, true, 'LabelDisplayDiv', false)
                        document.getElementById('labeldescription-'+labelID).value = taskEditDict[level]['edits']['modify'][labelID]['description']
                        document.getElementById('labelhotkey-'+labelID).value = taskEditDict[level]['edits']['modify'][labelID]['hotkey']
                    }
                }
            }

            if (!labelEdited) {
                optionTexts.push(labelDescription)
                optionValues.push(labelID)

                if (ParentID==selectedLevel) {
                    BuildLabelRow(labelID, true, 'LabelDisplayDiv', false)
                    document.getElementById('labeldescription-'+labelID).value = labelDescription
                    document.getElementById('labelhotkey-'+labelID).value = labelHotkey
                }
            }
        }
    }

    for (level in taskEditDict) {
        for (NID in taskEditDict[level]['additional']) {
            optionTexts.push(taskEditDict[level]['additional'][NID]['description'])
            optionValues.push(NID)
            if (level==selectedLevel) {
                BuildLabelRow(NID, true, 'LabelDisplayDiv', false)
                document.getElementById('labeldescription-'+NID).value = taskEditDict[level]['additional'][NID]['description']
                document.getElementById('labelhotkey-'+NID).value = taskEditDict[level]['additional'][NID]['hotkey']
            }
        }
    }

    clearSelect(LabelLevelSelector)
    fillSelect(LabelLevelSelector, optionTexts, optionValues)
    for (iiiiiiiiiiii=0;iiiiiiiiiiii<LabelLevelSelector.options.length;iiiiiiiiiiii++) {
        if (LabelLevelSelector.options[iiiiiiiiiiii].value==selectedLevel) {
            LabelLevelSelector.selectedIndex = iiiiiiiiiiii
        }
    }

    IDNum = getIdNumforNext('labeldescription-');
    BuildLabelRow(IDNum, true, 'AddLabelDiv', false)
}

modalEditTask.on('shown.bs.modal', function(){
    /** Initialises the label-editing modal when it is opened. */

    if (discardCancelled||helpReturn) {
        discardCancelled = false
        helpReturn = false
    } else {
        taskEditDict = {}
        sessionDeletes = []
        sessionIDs = []
    
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                globalLabels = JSON.parse(this.responseText);
    
                optionTexts = ['None','Vehicles/Humans/Livestock']
                optionValues = ['-99999','-100000']
                for (iiiiiiiiiiiii=0;iiiiiiiiiiiii<globalLabels.length;iiiiiiiiiiiii++) {
                    optionTexts.push(globalLabels[iiiiiiiiiiiii][0])
                    optionValues.push(globalLabels[iiiiiiiiiiiii][3])
                }
    
                LabelLevelSelector = document.getElementById('LabelLevelSelector')
                clearSelect(LabelLevelSelector)
                fillSelect(LabelLevelSelector, optionTexts, optionValues)
    
                $('#LabelLevelSelector').change( function() {
                    updateEditLabelDisplay()
                });
    
                for (iiiiiiiiiiiiii=0;iiiiiiiiiiiiii<optionValues.length;iiiiiiiiiiiiii++) {
                    taskEditDict[optionValues[iiiiiiiiiiiiii]] = {}
                    taskEditDict[optionValues[iiiiiiiiiiiiii]]['edits'] = {}
                    taskEditDict[optionValues[iiiiiiiiiiiiii]]['edits']['delete'] = []
                    taskEditDict[optionValues[iiiiiiiiiiiiii]]['edits']['modify'] = {}
                    taskEditDict[optionValues[iiiiiiiiiiiiii]]['additional'] = {}
                }
    
                updateEditLabelDisplay()
            }
        }
        xhttp.open("GET", '/getLabels/'+selectedTask);
        xhttp.send();
    }
});

modalEditTask.on('hidden.bs.modal', function(){
    /** Clears the label-editing modal when closed. */
    
    if ((!helpReturn)&&(!discardOpened)) {
        LabelDisplayDiv = document.getElementById('LabelDisplayDiv')
        while(LabelDisplayDiv.firstChild){
            LabelDisplayDiv.removeChild(LabelDisplayDiv.firstChild);
        }
    
        AddLabelDiv = document.getElementById('AddLabelDiv')
        while(AddLabelDiv.firstChild){
            AddLabelDiv.removeChild(AddLabelDiv.firstChild);
        }

        labelErrors = document.getElementById('labelEditErrors')
        while(labelErrors.firstChild){
            labelErrors.removeChild(labelErrors.firstChild);
        }

        document.getElementById('btnEditTaskSubmit').disabled = false
    } else {
        discardOpened = false
    }
});

modalConfirmEdit.on('hidden.bs.modal', function(){
    /** Clears the edit-label modal when the user confirms that they wish to discard their current session. */
    
    if (!discardCancelled) {
        while(LabelDisplayDiv.firstChild){
            LabelDisplayDiv.removeChild(LabelDisplayDiv.firstChild);
        }
    
        AddLabelDiv = document.getElementById('AddLabelDiv')
        while(AddLabelDiv.firstChild){
            AddLabelDiv.removeChild(AddLabelDiv.firstChild);
        }
    }
});