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

function buildTaskProgress(taskDiv,newTaskDiv,survey,task,progressType) {
    /** Builds a task progress bar depending on the type required. */

    taskProgressBarCol = document.createElement('div')
    taskProgressBarDiv = document.createElement('div')

    if (progressType=='launched') {

        taskInfoCol = document.createElement('div')
        taskInfoCol.classList.add('col-lg-2');
        newTaskDiv.appendChild(taskInfoCol)
    
        taskHitsActive = document.createElement('div')
        taskHitsActive.classList.add('row');
        taskHitsActive.setAttribute("id","taskHitsActive"+task.id)
        taskHitsActive.setAttribute("style","font-size: 70%")
        taskInfoCol.appendChild(taskHitsActive)
        if (task.jobsAvailable==null) {
            taskHitsActive.innerHTML = 'Jobs Available: 0'
        } else {
            taskHitsActive.innerHTML = 'Jobs Available: ' + task.jobsAvailable
        }

        taskHitsCompleted = document.createElement('div')
        taskHitsCompleted.classList.add('row');
        taskHitsCompleted.setAttribute("id","taskHitsCompleted"+task.id)
        taskHitsCompleted.setAttribute("style","font-size: 70%")
        taskInfoCol.appendChild(taskHitsCompleted)
        if (task.jobsCompleted==null) {
            taskHitsCompleted.innerHTML = 'Jobs Completed: 0'
        } else {
            taskHitsCompleted.innerHTML = 'Jobs Completed: ' + task.jobsCompleted
        }

        taskProgressBarCol.classList.add('col-lg-6');
        taskProgressBarDiv.setAttribute("id","taskProgressBarDiv"+task.id)
    } else {
        taskProgressBarCol.classList.add('col-lg-9');
    }    

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
    newProgInner.setAttribute("aria-valuemin", "0");

    if (progressType=='launched') {
        newProgInner.setAttribute("aria-valuenow", task.completed);
        newProgInner.setAttribute("aria-valuemax", task.total);
        newProgInner.setAttribute("style", "width:"+(task.completed/task.total)*100+"%;transition:none");
        newProgInner.innerHTML = task.remaining

        newProg.appendChild(newProgInner);
        taskProgressBarDiv.appendChild(newProg);
        taskProgressBarCol.appendChild(taskProgressBarDiv);
        newTaskDiv.appendChild(taskProgressBarCol)
    } else if (progressType=='downloading') {
        newProg.appendChild(newProgInner);
        taskProgressBarDiv.appendChild(newProg);
        taskProgressBarCol.appendChild(taskProgressBarDiv);
        newTaskDiv.appendChild(taskProgressBarCol)
        updateDownloadProgress(task.id,globalDownloaded,globalToDownload,global_count_initialised)
        downloadWorker.postMessage({'func': 'updateDownloadProgress', 'args': null})
    }

    stopTaskCol = document.createElement('div')
    stopTaskCol.classList.add('col-lg-1');
    stopTaskBtn = document.createElement('button')
    stopTaskBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
    stopTaskBtn.innerHTML = '&times;'
    stopTaskCol.appendChild(stopTaskBtn)
    newTaskDiv.appendChild(stopTaskCol)

    if (survey.access=='write' || survey.access=='admin') {
        stopTaskBtn.disabled = false
    } else {
        if (survey.access=='read' && progressType=='downloading') {
            stopTaskBtn.disabled = false
        }   
        else {
            stopTaskBtn.disabled = true
        }
    }

    if (progressType=='launched') {
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
    } else if (progressType=='downloading') {
        stopTaskBtn.addEventListener('click', ()=>{
            downloadWorker.postMessage({'func': 'wrapUpDownload', 'args': [true]})
        })
    }

    if (progressType=='launched') {
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

    newTaskDiv.setAttribute('style',"margin-right:10px")
    taskDiv.appendChild(newTaskDiv)
}

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

    if ((task.status=='PROGRESS')) {
        buildTaskProgress(taskDiv,newTaskDiv,survey,task,'launched')
    // } else if (currentDownloads.includes(survey.id)&&currentDownloadTasks.includes(task.name)) {
    //     taskStatusElement.innerHTML = 'Downloading'
    //     buildTaskProgress(taskDiv,newTaskDiv,survey,task,'downloading')
    } else {
        taskInfoCol = document.createElement('div')
        taskInfoCol.classList.add('col-lg-2');
        newTaskDiv.appendChild(taskInfoCol)

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
                    resetLaunchTaskPage()
                    document.getElementById('launchMTurkTaskBtn').disabled=false
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

        editTaskBtn.addEventListener('click', function(wrapTaskId, wrapTaskName, wrapSurveyId) {
            return function() {
                selectedTask = wrapTaskId
                document.getElementById('editTaskTitle').innerHTML = 'Edit Task: ' + wrapTaskName
                selectedSurvey = wrapSurveyId
                modalEditTask.modal({keyboard: true});
            }
        }(task.id, task.name, survey.id));

        resultsCol = document.createElement('div')
        resultsCol.classList.add('col-lg-2');
        resultsBtn = document.createElement('button')
        resultsBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
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
            if (survey.access=='read' || survey.status.toLowerCase()=='restoring files') {
                launchTaskBtn.disabled = true
                editTaskBtn.disabled = true
                resultsBtn.disabled = false
                taskStatusBtn.disabled = false
                deleteBtn.disabled = true
            }
            else if (survey.access=='write' || survey.access=='admin') {
                launchTaskBtn.disabled = false
                editTaskBtn.disabled = false
                resultsBtn.disabled = false
                taskStatusBtn.disabled = false
                if (survey.delete){
                    deleteBtn.disabled = false
                }
                else{
                    deleteBtn.disabled = true
                }
            }
            else{
                launchTaskBtn.disabled = true
                editTaskBtn.disabled = true
                resultsBtn.disabled = true
                taskStatusBtn.disabled = true
                deleteBtn.disabled = true
            }
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

        newTaskDiv.setAttribute('style',"margin-right:10px")
        taskDiv.appendChild(newTaskDiv)
    }

    if (taskStatusElement.innerHTML=='') {
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
    }
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
                del_id = evt.target.id.split("-")[evt.target.id.split("-").length-1]
                if (Object.keys(speciesLabelIDs).includes(del_id)) {
                    document.getElementById('modalAlertHeader').innerHTML = 'Error'
                    document.getElementById('modalAlertBody').innerHTML = 'This label is associated with individuals. It cannot be deleted.'
                    modalAlert.modal({keyboard: true});
                }
                else if (speciesParentIDs.includes(parseInt(del_id))) {
                    document.getElementById('modalAlertHeader').innerHTML = 'Error'
                    document.getElementById('modalAlertBody').innerHTML = "This label has child labels that are associated with individuals. It cannot be deleted."
                    modalAlert.modal({keyboard: true});
                }
                else {
                    sessionDeletes.push(del_id)
                    evt.target.parentNode.parentNode.parentNode.remove();
                    checkLabels(true)
                }
            }
            else if (evt.target.parentNode.parentNode.parentNode.parentNode==document.getElementById('AddLabelDiv')) {
                evt.target.parentNode.parentNode.parentNode.remove();
                checkLabels(true)
            }
        });
    }
}

function updateAllParentSelects() {
    /** Updates all parent label selectors. */
    allLabels = document.querySelectorAll('[id^=labeldescription-]');
    optionTexts = ['None', 'Vehicles/Humans/Livestock']
    optionValues = ["-99999", "-100000"]
    for (let i = 0; i < allLabels.length; i++){
        if ((allLabels[i].value != '')&&(!optionTexts.includes(allLabels[i].value))) {
            optionTexts.push(allLabels[i].value)
            optionValues.push(allLabels[i].id.replace(/.*-(\d{1,4}).*/m, '$1'))
        }
    }

    allSelectors = document.querySelectorAll('[id^=labelparent-]');
    for (let i = 0; i < allSelectors.length; i++){
        if (allSelectors[i].options.length == 0) {
            clearSelect(allSelectors[i])
            fillSelect(allSelectors[i], optionTexts, optionValues)
        } else {
            storedVal = allSelectors[i].options[allSelectors[i].selectedIndex].value;
            clearSelect(allSelectors[i])
            fillSelect(allSelectors[i], optionTexts, optionValues)
            if (!optionValues.includes(storedVal)) {
                allSelectors[i].value = "-99999"
            } else {
                allSelectors[i].value = storedVal
            }
        }
    }
}

function checkLabels(editing) {
    /**
     * Checks the legality of the labels, updates the legalLabels status, and updates the error messages accordingly.
     * @param {bool} editing Whether the labels being checked are new labels, or labels being edited.
    */

    if (editing) {
        parentDiv = document.getElementById('modalEditTask')
    }
    else {
        parentDiv = document.getElementById('modalAddTask')
    }

    allHotkeys = parentDiv.querySelectorAll('[id^=labelhotkey-]');
    allDescriptions = parentDiv.querySelectorAll('[id^=labeldescription-]');

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
        for (let i=0;i<optionTexts.length;i++) {
            dict[optionTexts[i].toLowerCase()] = []
        }
    }
    for (let n = 0; n < allDescriptions.length; n++){
        if (allDescriptions[n].value != '') {
            description = allDescriptions[n].value.toLowerCase().trim();

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
                    if (editing) {
                        if ((!duplicateDescriptions.includes(description))&&((allDescriptions[n].parentNode.parentNode.parentNode.parentNode.id=='AddLabelDiv')||(allDescriptions[n].parentNode.parentNode.parentNode.parentNode.id=='labelDisplayDiv'))) {
                            duplicateDescriptions.push(description)
                        }
                    } else {
                        if ((!duplicateDescriptions.includes(description))&&(allDescriptions[n].parentNode.parentNode.parentNode.parentNode.id=='divLabel')) {
                            duplicateDescriptions.push(description)
                        }
                    }
                }
            }
        } else {
            if (allHotkeys[n].value!='') {
                emptyDescription = true
            }
        }
    }

    for (let n = 0; n < allDescriptions.length; n++){
        IDNum = allDescriptions[n].id.split("-")[allDescriptions[n].id.split("-").length-1]

        if (editing) {
            selectElement = document.getElementById('LabelLevelSelector');
        } else {
            selectElement = document.getElementById('labelparent-'+IDNum);
        }
        parent = selectElement.options[selectElement.selectedIndex].text.toLowerCase(); 
        hotkey = document.getElementById('labelhotkey-'+IDNum).value.toLowerCase();

        if (parent.trim()==allDescriptions[n].value.toLowerCase().trim()) {
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
        for (let n = 0; n < duplicateDescriptions.length; n++){
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
            for (let n = 0; n < value.length; n++){
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
        for (let n = 0; n < globalDescriptionsUsed.length; n++){
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
        for (let n = 0; n < globalHotkeysUsed.length; n++){
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
                for (let i=0;i<labels.length;i++) {
                    optionTexts.push(labels[i][0])
                    optionValues.push(i.toString())
                }

                for (let i=0;i<labels.length;i++) {
                    labelDescription = labels[i][0]
                    labelHotkey = labels[i][1]
                    labelParent = labels[i][2]

                    IDNum = getIdNumforNext('labeldescription');
                    BuildLabelRow(IDNum, true, 'divLabel', true)

                    document.getElementById('labeldescription-'+i.toString()).value = labelDescription
                    document.getElementById('labelhotkey-'+i.toString()).value = labelHotkey

                    selector = document.getElementById('labelparent-'+i.toString())
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
            for (let i=0;i<tasks.length;i++) {
                taskNames.push(tasks[i][1])
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
                    resetModalAddTask2()
                    prevTaskTranslations = {}
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

// btnModalAddTaskBack2.addEventListener('click', ()=>{
//     /** Opens the previous add task modal when the user presses back. */
//     modalAddTask3.modal('hide');
//     modalAddTask2.modal({keyboard: true});
// });

btnSaveLabelChanges.addEventListener('click', ()=>{
    /** Listener that locally saves label edits to be submitted later. */

    checkLabels(true)
    if (legalLabels) {
        selectElement = document.getElementById('LabelLevelSelector');
        parent = selectElement.options[selectElement.selectedIndex].value;

        allHotkeys = document.querySelectorAll('[id^=labelhotkey-]');
        allDescriptions = document.querySelectorAll('[id^=labeldescription-]');

        for (let i=0;i<sessionDeletes.length;i++) {
            if (sessionDeletes[i].includes('s')) {
                // Session label deleted
                if (sessionDeletes[i] in taskEditDict[parent]['additional']) {
                    delete taskEditDict[parent]['additional'][sessionDeletes[i]]
                }
            }
            delete translationLabels[sessionDeletes[i]]
        }

        taskEditDict[parent]['edits']['delete'].push(...sessionDeletes)

        for (let i=0;i<allDescriptions.length;i++) {
            if ((allDescriptions[i].value!='')&&(allHotkeys[i].value!='')) {
                if (allDescriptions[i].parentNode.parentNode.parentNode.parentNode==document.getElementById('AddLabelDiv')) {
                    //new labels
                    NID = 's'+allDescriptions[i].id.split("-")[allDescriptions[i].id.split("-").length-1]
                    while (sessionIDs.includes(NID)) {
                        NID = 's'+NID
                    }
                    sessionIDs.push(NID)
                    taskEditDict[parent]['additional'][NID] = {}
                    taskEditDict[parent]['additional'][NID]['description'] = allDescriptions[i].value.trim()
                    taskEditDict[parent]['additional'][NID]['hotkey'] = allHotkeys[i].value
    
                    if (!(NID in taskEditDict)) {
                        taskEditDict[NID] = {}
                        taskEditDict[NID]['edits'] = {}
                        taskEditDict[NID]['edits']['delete'] = []
                        taskEditDict[NID]['edits']['modify'] = {}
                        taskEditDict[NID]['additional'] = {}
                    }

                    translationLabels[NID] = allDescriptions[i].value
                } else {
                    //edited labels
                    if (allDescriptions[i].getAttribute('data-edited')=='true') {
                        NID = allDescriptions[i].id.split("-")[allDescriptions[i].id.split("-").length-1]
    
                        if (NID.includes('s')) {
                            // Edited new label, so edit original additional
                            taskEditDict[parent]['additional'][NID]['description'] = allDescriptions[i].value.trim()
                            taskEditDict[parent]['additional'][NID]['hotkey'] = allHotkeys[i].value
                        } else {
                            // Multiple edits in the same session just overwrite each other
                            taskEditDict[parent]['edits']['modify'][NID] = {}
                            taskEditDict[parent]['edits']['modify'][NID]['description'] = allDescriptions[i].value.trim()
                            taskEditDict[parent]['edits']['modify'][NID]['hotkey'] = allHotkeys[i].value
                        }

                        translationLabels[NID] = allDescriptions[i].value
                    }
                }
            }
        }

        // Clear
        updateEditLabelDisplay()
    }

    classifications = document.querySelectorAll('[id^=classTranslationTextEdit-]')
    for (let i=0;i<classifications.length;i++) {
        // IDNum = classifications[i].id.split("-")[classifications[i].id.split("-").length-1]
        classification = classifications[i].innerHTML
        IDNum = classification

        translationSelect = document.getElementById('classTranslationSelectEdit-'+IDNum)
        translation = translationSelect.options[translationSelect.selectedIndex].text
        classify = document.getElementById('classificationSelectionEdit-'+IDNum).checked
        label_id = translationSelect.value

        labelDeleted = false
        if (label_id in translationLabels) {
            if (translationLabels[label_id] != translation) {
                translation = translationLabels[label_id]
            }
        }
        else if (label_id != '0' && label_id != '-1'){
            labelDeleted = true
        }

        if (classification in globalTranslations) {
            if (labelDeleted) {
                global_label_id = globalTranslations[classification].label_id
                global_label = globalTranslations[classification].label
                if (global_label.toLowerCase()=='nothing') {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = 0
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                    translationEditDict[classification] = {
                        'label': 'nothing',
                        'label_id': 0,
                        'classify': 'False',
                        'edited': 'False'
                    }
                } 
                else if (global_label.toLowerCase()=='vehicles/humans/livestock') {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = -1
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = globalTranslations[classification].classify
                    translationEditDict[classification] = {
                        'label': 'vehicles/humans/livestock',
                        'label_id': -1,
                        'classify': globalTranslations[classification].classify ? 'True' : 'False',
                        'edited': 'False'
                    }
                }
                else if (global_label_id in translationLabels) {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = global_label_id
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = globalTranslations[classification].classify
                    translationEditDict[classification] = {
                        'label': translationLabels[global_label_id],
                        'label_id': global_label_id,
                        'classify': globalTranslations[classification].classify ? 'True' : 'False',
                        'edited': 'False'
                    }
                }
                else {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = 0
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                    translationEditDict[classification] = {
                        'label': 'nothing',
                        'label_id': 0,
                        'classify': 'False',
                        'edited': 'True'
                    }
                }
            } 
            else if (globalTranslations[classification].label_id != label_id || globalTranslations[classification].classify != classify) {
                if (translation.toLowerCase()=='nothing (ignore)') {
                    translationEditDict[classification] = {
                        'label': 'nothing',
                        'label_id': label_id,
                        'classify': 'False',
                        'edited': 'False'
                    }
                    if (globalTranslations[classification].label.toLowerCase() != 'nothing') {
                        translationEditDict[classification].edited = 'True'
                    }
                }
                else if (translation.toLowerCase()=='vehicles/humans/livestock') {
                    translationEditDict[classification] = {
                        'label': 'vehicles/humans/livestock',
                        'label_id': label_id,
                        'classify': classify ? 'True' : 'False',
                        'edited': 'False'
                    }
                    if (globalTranslations[classification].label.toLowerCase() != 'vehicles/humans/livestock' || globalTranslations[classification].classify != classify) {
                        translationEditDict[classification].edited = 'True'
                    }
                }
                else{
                    translationEditDict[classification] = {
                        'label': translation,
                        'label_id': label_id,
                        'classify': classify ? 'True' : 'False',
                        'edited': 'True'
                    }
                }
            }
            else {
                translationEditDict[classification] = {
                    'label': translation,
                    'label_id': label_id,
                    'classify': classify ? 'True' : 'False',
                    'edited': 'False'
                }
            }
        }
        else {
            if (labelDeleted) {
                document.getElementById('classTranslationSelectEdit-'+IDNum).value = 0
                document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                translationEditDict[classification] = {
                    'label': 'nothing',
                    'label_id': 0,
                    'classify': 'False',
                    'edited': 'True'
                }
            }
            else if (translation.toLowerCase()=='nothing (ignore)') {
                translationEditDict[classification] = {
                    'label': 'nothing',
                    'label_id': label_id,
                    'classify': 'False',
                    'edited': 'True'
                }
            }
            else{
                translationEditDict[classification] = {
                    'label': translation,
                    'label_id': label_id,
                    'classify': classify ? 'True' : 'False',
                    'edited': 'True'
                }
            }
        }
    }

    updateEditTranslationDisplay()

    checkTags(true)
    if (legalTags) {
        allTags = document.querySelectorAll('[id^=tag-]')
        for (let i=0;i<removedTags.length;i++) {
            tagID = removedTags[i]
            if (tagID.includes('n')) {
                delete tagEditDict['additional'][tagID]
            } else {
                tagEditDict['delete'].push(tagID)
                delete tagEditDict['modify'][tagID]
            }
        }

        for (let i=0;i<allTags.length;i++) {
            tagID  = allTags[i].id.split("-")[1]
            tagHotkey = document.getElementById('tagHotkey-'+tagID).value
            if (allTags[i].value != '' && tagHotkey != '') {
                if (tagID.includes('n')) {
                    tagEditDict['additional'][tagID] = {
                        'description': allTags[i].value.trim(),
                        'hotkey': tagHotkey
                    }
                }
                else{
                    if (globalTags[tagID].description != allTags[i].value || globalTags[tagID].hotkey != tagHotkey) {
                        tagEditDict['modify'][tagID] = {
                            'description': allTags[i].value.trim(),
                            'hotkey': tagHotkey
                        }
                    }
                    else {
                        delete tagEditDict['modify'][tagID]
                    }
                }
            }
        }

        updateEditTagDisplay()
    }
});

btnEditTaskSubmit.addEventListener('click', ()=>{
    /** Submit the edited task laels to the server when button is pushed. */

    var speciesChange = checkSpeciesChange()
    var labelsEdited = false
    for (let key in taskEditDict) {
        if (Object.keys(taskEditDict[key]['edits']['modify']).length>0) {
            labelsEdited = true
            break
        }
        if (Object.keys(taskEditDict[key]['additional']).length>0) {
            labelsEdited = true
            break
        }
        if (taskEditDict[key]['edits']['delete'].length>0) {
            labelsEdited = true
            break
        }
    }
    if (editTaskAlertCount==0 && labelsEdited) {
        confirmOpened = true
        modalEditTask.modal('hide')
        editTaskAlertCount = 1
        modalEditTaskAlert.modal({keyboard: true});
    }
    else if (speciesChange) {
        confirmOpened = true
        modalEditTask.modal('hide')
        document.getElementById('modalConfirmEditSpeciesError').innerHTML = ''
        modalConfirmEditSpecies.modal({keyboard: true});
    }
    else{
        document.getElementById('btnEditTaskSubmit').disabled = true

        if (Object.keys(tagEditDict).length==0) {
            tagEditDict['delete'] = []
            tagEditDict['modify'] = {}
            tagEditDict['additional'] = {}
        }

        var delete_label = document.getElementById('deleteClusterLabel').checked ? 'true' : 'false'

        var formData = new FormData()
        formData.append("editDict", JSON.stringify(taskEditDict))
        formData.append("tagsDict", JSON.stringify(tagEditDict))
        formData.append("translationsDict", JSON.stringify(translationEditDict))
        formData.append("deleteAutoLabels", JSON.stringify(delete_label))
    
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/editTask/'+selectedTask);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='success') {
                    modalEditTask.modal('hide')
                    updatePage(current_page)
                } else {
                    document.getElementById('btnEditTaskSubmit').disabled = false
                    modalEditTask.modal('hide')
                    document.getElementById('modalAlertHeader').innerHTML = 'Error'
                    document.getElementById('modalAlertBody').innerHTML = reply.message
                    modalAlert.modal({keyboard: true});
                }
            }
        }
        xhttp.send(formData);
    }
});

btnCreateTask2.addEventListener('click', ()=>{
    /** Opens the next add-task modal when the button is pressed. */
    document.getElementById('btnCreateTask2').disabled=true

    includes = []    
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
        else {
            classificationCheckbox = document.getElementById('classificationSelection-'+IDNum)
            if (classificationCheckbox.checked) {
                includes.push(classification)
            }
        }

        translationInfo[classification] = translation
    }
    
    var formData = new FormData()
    formData.append("info", addTaskInfo)
    formData.append("includes", includes)
    formData.append("translation", JSON.stringify(translationInfo))

    // parentLabel = document.getElementById('parentLabel').checked
    parentLabel = false

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/createTask/'+selectedSurvey+'/'+parentLabel);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply.status=='success') {
                modalAddTask2.modal('hide')
                updatePage(current_page)
            } else {
                document.getElementById('btnCreateTask2').disabled=false
                document.getElementById('modalAlertHeader').innerHTML = 'Error'
                document.getElementById('modalAlertBody').innerHTML = reply.message
                modalAddTask2.modal('hide')
                modalAlert.modal({keyboard: true})
            }
        }
    }
    xhttp.send(formData);
});

// btnCreateTask3.addEventListener('click', ()=>{
//     /** Submits the new-task information to the server when the last modal is completed. */

//     document.getElementById('btnCreateTask3').disabled=true

//     allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]')
//     includes = []
//     for (let i=0;i<allCheckBoxes.length;i++) {
//         if (allCheckBoxes[i].checked) {
//             classification = allCheckBoxes[i].parentNode.children[1].innerHTML
//             includes.push(classification)
//         }
//     }
    
//     allTranslations = document.querySelectorAll('[id^=classTranslationText-]')
//     translationInfo = {}
//     for (let i=0;i<allTranslations.length;i++) {
//         IDNum = allTranslations[i].id.split("-")[allTranslations[i].id.split("-").length-1]
//         classification = allTranslations[i].innerHTML

//         translationSelect = document.getElementById('classTranslationSelect-'+IDNum)
//         translation = translationSelect.options[translationSelect.selectedIndex].text

//         if (translation.toLowerCase()=='nothing (ignore)') {
//             translation='nothing'
//         }
//         translationInfo[classification] = translation
//     }
    
//     var formData = new FormData()
//     formData.append("info", addTaskInfo)
//     formData.append("includes", includes)
//     formData.append("translation", JSON.stringify(translationInfo))

//     parentLabel = document.getElementById('parentLabel').checked

//     var xhttp = new XMLHttpRequest();
//     xhttp.open("POST", '/createTask/'+selectedSurvey+'/'+parentLabel);
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             reply = JSON.parse(this.responseText);  
//             if (reply=='success') {
//                 // modalAddTask3.modal('hide')

//                 updatePage(current_page)
//             } else {
//                 document.getElementById('btnCreateTask3').disabled=false
//             }
//         }
//     }
//     xhttp.send(formData);
// });

btnCreateTask.addEventListener('click', ()=>{
    /** Checks user info in the first add-task form for legality and packages the info for later submission. Also submits the annotation csv if needed. */
    
    newTaskName = document.getElementById('newTaskName').value
    document.getElementById('nameErrors').innerHTML = ''

    if ((newTaskName.toLowerCase()=='default')||(newTaskName.toLowerCase().includes('_o_l_d_'))||(newTaskName.toLowerCase().includes('_copying'))) {
        reservedNameUsed = true
        document.getElementById('nameErrors').innerHTML = 'That task name is reserved. Please choose another.'
    } else {
        reservedNameUsed = false
    }

    if (taskNames.includes(newTaskName)) {
        nameUsed = true
        document.getElementById('nameErrors').innerHTML = 'Task name is already in use.'
    } else {
        nameUsed = false
    }

    if ((newTaskName.includes('/'))||(newTaskName.includes('\\'))) {
        nameSlash = true
        document.getElementById('nameErrors').innerHTML = 'Task name cannot contain slashes.'
    } else {
        nameSlash = false
    }

    if ((!nameSlash)&&(!nameUsed)&&(!reservedNameUsed)&&(newTaskName.length!=0)) {
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
                for (let i = 0; i < labelDescriptions.length; i++){
                    if ((labelDescriptions[i].value!='')&&(labelHotkeys[i].value!='')) {
                        addTaskDescriptions.push(labelDescriptions[i].value.toLowerCase().trim())
                        info += '["'+labelDescriptions[i].value.trim()+'","'+labelHotkeys[i].value+'","'+labelParents[i].options[labelParents[i].selectedIndex].text.trim().replace(/\//g, '*****')
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

    classTranslationDiv = document.getElementById('classTranslationDiv')
    while(classTranslationDiv.firstChild){
        classTranslationDiv.removeChild(classTranslationDiv.firstChild);
    }

    document.getElementById('btnCreateTask2').disabled = false
    document.getElementById('selectAllClassifications').checked = false
}

// function resetModalAddTask3() {
//     /** Clears the third page of the add-task modal. */

//     document.getElementById('selectAllClassifications').checked = false
//     document.getElementById('speciesLabel').checked = true
//     document.getElementById('parentLabel').checked = false
//     surveyClassifications = null

//     classificationSelection = document.getElementById('classificationSelection')
//     while(classificationSelection.firstChild){
//         classificationSelection.removeChild(classificationSelection.firstChild);
//     }
// }

modalAddTask2.on('hidden.bs.modal', function(){
    /** Resets the helpReturn variable when the add task modal is closed. */
    if (!helpReturn) {
        // pass
    } else {
        helpReturn = false
    }
});

// modalAddTask3.on('hidden.bs.modal', function(){
//     /** Resets the helpReturn variable when the add task modal is closed. */
//     if (!helpReturn) {
//         // pass
//         document.getElementById('btnCreateTask3').disabled = false
//     } else {
//         helpReturn = false
//     }
// });

function buildTranslationRow(IDNum,classification,translationDiv,taskLabels,edit=false) {
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
    if (edit) {
        div.setAttribute('id','classTranslationEdit-'+IDNum)
    } else {
        div.setAttribute('id','classTranslation-'+IDNum)
    }
    classTranslationDiv.appendChild(div)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    if (edit) {
        col1.id = 'classTranslationTextEdit-'+IDNum
    } else {
        col1.id = 'classTranslationText-'+IDNum
    }
    col1.innerHTML = classification
    col1.style.display = 'flex';
    col1.style.flexDirection = 'column';
    col1.style.justifyContent = 'center';
    div.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-1')
    col2.innerHTML='&#x276f;'
    col2.style.display = 'flex';
    col2.style.flexDirection = 'column';
    col2.style.justifyContent = 'center';
    div.appendChild(col2)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-5')
    div.appendChild(col3)

    col4 = document.createElement('div')
    col4.classList.add('col-lg-2')
    col4.style.display = 'flex';
    col4.style.flexDirection = 'column';
    col4.style.justifyContent = 'center';
    div.appendChild(col4)

    select = document.createElement('select')
    select.classList.add('form-control')
    if (edit) {
        select.id = 'classTranslationSelectEdit-'+IDNum
    } else {
        select.id = 'classTranslationSelect-'+IDNum
    }
    select.name = select.id
    col3.appendChild(select)

    if (edit) {
        var optionTexts = ['Nothing (Ignore)', 'Vehicles/Humans/Livestock']
        var optionValues = ["0", "-1"]
        for (let i=0;i<taskLabels.length;i++) {
            optionTexts.push(taskLabels[i][0])
            optionValues.push(taskLabels[i][1])
        }

        fillSelect(select, optionTexts, optionValues)

        document.getElementById('classTranslationSelectEdit-'+IDNum).addEventListener('change', function() {
            if (this.value=='0') {
                document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                document.getElementById('classificationSelectionEdit-'+IDNum).disabled = true
            }
            else{
                document.getElementById('classificationSelectionEdit-'+IDNum).disabled = false
                if (document.getElementById('selectAllClassificationsEdit').checked) {
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = true
                }
            }
        });
        
    } else {
        optionValues = []
        for (let i=0;i<taskLabels.length;i++) {
            optionValues.push(i)
        }

        fillSelect(select, taskLabels, optionValues)

        document.getElementById('classTranslationSelect-'+IDNum).addEventListener('change', function() {
            if (this.value=='0') {
                document.getElementById('classificationSelection-'+IDNum).checked = false
                document.getElementById('classificationSelection-'+IDNum).disabled = true
            }
            else{
                document.getElementById('classificationSelection-'+IDNum).disabled = false
                if (translationDiv == 'classTranslationDiv' && document.getElementById('selectAllClassifications').checked){
                    document.getElementById('classificationSelection-'+IDNum).checked = true
                }
                else if (translationDiv == 'translationsDiv' && document.getElementById('selectAllClassificationsL').checked){
                    document.getElementById('classificationSelection-'+IDNum).checked = true
                }
            }
        });
    }

    // Auto Classify
    var toggleDiv = document.createElement('div');
    toggleDiv.classList.add('text-center');
    toggleDiv.style.verticalAlign = 'middle';
    col4.appendChild(toggleDiv);

    var toggle = document.createElement('label');
    toggle.classList.add('switch');
    toggleDiv.appendChild(toggle);

    var checkbox = document.createElement('input');
    checkbox.setAttribute("type", "checkbox");
    if (edit) {
        checkbox.id = 'classificationSelectionEdit-' + IDNum;
    } else {
        checkbox.id = 'classificationSelection-' + IDNum;
    }
    checkbox.checked = true;
    toggle.appendChild(checkbox);

    var slider = document.createElement('span');
    slider.classList.add('slider');
    slider.classList.add('round');
    toggle.appendChild(slider);


    if (!edit) {
        taskLabels = taskLabels.map(x => x.toLowerCase())
        classification = classification.toLowerCase()
        if (prevTaskTranslations && Object.keys(prevTaskTranslations).includes(classification)) {
            prev_label = prevTaskTranslations[classification].label.toLowerCase()
            if (prev_label == 'nothing') {
                select.value = 0
                checkbox.checked = false
                checkbox.disabled = true
            }
            else if (taskLabels.includes(prev_label)) {
                select.value = taskLabels.indexOf(prev_label)
                if (select.value == 0) {
                    checkbox.checked = false
                    checkbox.disabled = true
                } else {
                    checkbox.checked = prevTaskTranslations[classification].classify
                }
            }
            else{
                checkbox.checked = false
                checkbox.disabled = true
            }
        }
        else if (taskLabels.includes(classification) && classification != 'nothing') {
            select.value = taskLabels.indexOf(classification)
            checkbox.checked = true
        }
        else{
            checkbox.checked = false
            checkbox.disabled = true
        }
    }

}

function updateTranslationMatrix() {
    /** Updates the label translation selectors in the new task form. */

    document.getElementById('btnCreateTask2').disabled=true

    let defaultLabels = addTaskDescriptions.slice(0,2)
    let otherLabels = addTaskDescriptions.slice(2).sort()
    addTaskDescriptions = defaultLabels.concat(otherLabels)
    
    optionValues = []
    for (let i=0;i<addTaskDescriptions.length;i++) {
        optionValues.push(i)
    }
    classTranslationSelects = document.querySelectorAll('[id^=classTranslationSelect-');
    for (let i=0;i<classTranslationSelects.length;i++) {
        selection = classTranslationSelects[i].options[classTranslationSelects[i].selectedIndex].text;
        updatedIndex = addTaskDescriptions.indexOf(selection)
        clearSelect(classTranslationSelects[i])
        fillSelect(classTranslationSelects[i], addTaskDescriptions, optionValues)
        classTranslationSelects[i].selectedIndex = updatedIndex
        if (updatedIndex==-1) {
            classTranslationSelects[i].selectedIndex = 0
            idnum = classTranslationSelects[i].id.split("-")[1]
            document.getElementById('classificationSelection-'+idnum).checked = false
        }
    }

    for (let i=0;i<classificationLabels.length;i++) {
        IDNum = i
        classification = classificationLabels[i]
        
        if (!['unknown', 'nothing', 'knocked down'].includes(classification)) {
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


    document.getElementById('btnCreateTask2').disabled=false
}

function updateClassificationBoxes() {
    /** Updates the auto-classification checkboxes based on ignored classifications. */

    allTranslations = document.querySelectorAll('[id^=classTranslationText-]')
    ignores = []
    for (let i=0;i<allTranslations.length;i++) {
        IDNum = allTranslations[i].id.split("-")[allTranslations[i].id.split("-").length-1]
        classification = allTranslations[i].innerHTML

        translationSelect = document.getElementById('classTranslationSelect-'+IDNum)
        translation = translationSelect.options[translationSelect.selectedIndex].text

        if (translation=='nothing (ignore)') {
            ignores.push(classification)
        }
    }

    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]');
    for (let i=0;i<allCheckBoxes.length;i++) {
        IDNum = allCheckBoxes[i].id.split("-")[allCheckBoxes[i].id.split("-").length-1]
        classification = allCheckBoxes[i].parentNode.children[1].innerHTML
        if (ignores.includes(classification)) {
            allCheckBoxes[i].parentNode.remove()
        }
    }
}

// modalAddTask3.on('shown.bs.modal', function(){
//     /** Updates the auto-classification form when the modal is opened. */
//     document.getElementById('btnCreateTask2').disabled = true
//     updateClassificationBoxes()
//     document.getElementById('btnCreateTask2').disabled = false
// });

function buildClassificationCheckBoxes() {
    /** Build the auto-classification checkboxes in the add task form. */

    classificationSelection = document.getElementById('classificationSelection')
    while(classificationSelection.firstChild){
        classificationSelection.removeChild(classificationSelection.firstChild);
    }

    for (let i=0;i<surveyClassifications.length;i++) {
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
        label.innerHTML = surveyClassifications[i]
        div.appendChild(label)
    }
}

modalAddTask2.on('shown.bs.modal', function(){
    /** Updates the label translation form in the add-task modal when opened. */
    var surveyElement = document.getElementById('prevLabelsSurvey')
    if (surveyElement.value != '-99999') {
        var taskElement = document.getElementById('prevLabelsTask')
        var task = taskElement.options[taskElement.selectedIndex].value;
    } else {
        task = null 
    }
    if (prevTaskTranslations == null || Object.keys(prevTaskTranslations).length == 0) {
        if (task != '-1' && task != null) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getTaskTranslations/'+task);
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    prevTaskTranslations = reply.translations;
                    updateTranslationMatrix()
                }
            }
            xhttp.send();
        }
        else{
            prevTaskTranslations = {}
            updateTranslationMatrix()
        }
    }
    else{
        prevTaskTranslations = {}
        updateTranslationMatrix()
    }
});

$("#selectAllClassifications").change( function() {
    /** Listener on the select all species-classification selector on the add-task modal that checks all the boxes if selected, and clears otherwise. */
    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]');
    if (document.getElementById('selectAllClassifications').checked) {
        for (let i=0;i<allCheckBoxes.length;i++) {
            if (!allCheckBoxes[i].disabled) {
                allCheckBoxes[i].checked = true
            }
        }
    } else {
        for (let i=0;i<allCheckBoxes.length;i++) {
            allCheckBoxes[i].checked = false
        }
    }
})

$("#selectAllClassificationsL").change( function() {
    /** Listener on the select all species-classification selector on the add-task modal that checks all the boxes if selected, and clears otherwise. */
    allCheckBoxes = document.querySelectorAll('[id^=classificationSelection-]');
    if (document.getElementById('selectAllClassificationsL').checked) {
        for (let i=0;i<allCheckBoxes.length;i++) {
            if (!allCheckBoxes[i].disabled) {
                allCheckBoxes[i].checked = true
            }
        }
    } else {
        for (let i=0;i<allCheckBoxes.length;i++) {
            allCheckBoxes[i].checked = false
        }
    }
})

$("#selectAllClassificationsEdit").change( function() {
    /** Listener on the select all species-classification selector on the add-task modal that checks all the boxes if selected, and clears otherwise. */
    allCheckBoxes = document.querySelectorAll('[id^=classificationSelectionEdit-]');
    if (document.getElementById('selectAllClassificationsEdit').checked) {
        for (let i=0;i<allCheckBoxes.length;i++) {
            if (!allCheckBoxes[i].disabled) {
                allCheckBoxes[i].checked = true
            }
        }
    } else {
        for (let i=0;i<allCheckBoxes.length;i++) {
            allCheckBoxes[i].checked = false
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

    for (let i=0;i<globalLabels.length;i++) {
        labelDeleted = false
        labelEdited = false
        labelDescription = globalLabels[i][0]
        labelHotkey = globalLabels[i][1]
        labelParent = globalLabels[i][2]
        labelID = globalLabels[i][3]
        ParentID = globalLabels[i][4]

        for (let level in taskEditDict) {
            if (taskEditDict[level]['edits']['delete'].includes(String(labelID))) {
                labelDeleted = true
            }
        }

        if (!labelDeleted) {
            for (let level in taskEditDict) {
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

    for (let level in taskEditDict) {
        for (let NID in taskEditDict[level]['additional']) {
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
    for (let i=0;i<LabelLevelSelector.options.length;i++) {
        if (LabelLevelSelector.options[i].value==selectedLevel) {
            LabelLevelSelector.selectedIndex = i
        }
    }

    IDNum = getIdNumforNext('labeldescription-');
    BuildLabelRow(IDNum, true, 'AddLabelDiv', false)
}

modalEditTask.on('shown.bs.modal', function(){
    /** Initialises the label-editing modal when it is opened. */

    if (discardCancelled||helpReturn||confirmCancelled||editTaskAlertCount!=0) {
        discardCancelled = false
        helpReturn = false
        confirmCancelled = false
    } else {
        globalTags = {}
        taskEditDict = {}
        tagEditDict = {}
        translationEditDict = {}
        removedTags = []
        sessionDeletes = []
        sessionIDs = []
        globalTranslations = {}
        translationLabels = {}
        editTaskAlertCount = 0
        document.getElementById('deleteClusterLabel').checked = true
        document.getElementById('selectAllClassificationsEdit').checked = false
        document.getElementById('openLabelsTab').click()
    }
});

function openLabelTab(){
    /** Opens the label-editing tab in the edit-task modal. */
    if (Object.keys(taskEditDict).length==0) {
        taskEditDict = {}
        sessionDeletes = []
        sessionIDs = []
        translationLabels = {}

        document.getElementById('openLabelsTab').disabled = true
        document.getElementById('openTranslationsTab').disabled = true
        document.getElementById('openTagsTab').disabled = true

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                globalLabels = JSON.parse(this.responseText);
    
                optionTexts = ['None','Vehicles/Humans/Livestock']
                optionValues = ['-99999','-100000']
                for (let i=0;i<globalLabels.length;i++) {
                    optionTexts.push(globalLabels[i][0])
                    optionValues.push(globalLabels[i][3])
                    translationLabels[globalLabels[i][3]] = globalLabels[i][0]
                }
        
                LabelLevelSelector = document.getElementById('LabelLevelSelector')
                clearSelect(LabelLevelSelector)
                fillSelect(LabelLevelSelector, optionTexts, optionValues)

                $('#LabelLevelSelector').change( function() {
                    updateEditLabelDisplay()
                });

                for (let i=0;i<optionValues.length;i++) {
                    taskEditDict[optionValues[i]] = {}
                    taskEditDict[optionValues[i]]['edits'] = {}
                    taskEditDict[optionValues[i]]['edits']['delete'] = []
                    taskEditDict[optionValues[i]]['edits']['modify'] = {}
                    taskEditDict[optionValues[i]]['additional'] = {}
                }

                updateEditLabelDisplay()

                getSpeciesAndTasks()

                openTranslationTab()
                openTagsTab()

                document.getElementById('openLabelsTab').disabled = false
                document.getElementById('openTranslationsTab').disabled = false
                document.getElementById('openTagsTab').disabled = false
            }
        }
        xhttp.open("GET", '/getLabels/'+selectedTask);
        xhttp.send();
    }
}

modalEditTask.on('hidden.bs.modal', function(){
    /** Clears the label-editing modal when closed. */
    if ((!helpReturn)&&(!discardOpened)&&(!confirmOpened)) {
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

        var editTranslationsDiv = document.getElementById('editTranslationsDiv')
        while(editTranslationsDiv.firstChild){
            editTranslationsDiv.removeChild(editTranslationsDiv.firstChild);
        }

        var editTagsDiv = document.getElementById('editTagsDiv')
        while(editTagsDiv.firstChild){
            editTagsDiv.removeChild(editTagsDiv.firstChild);
        }

        var addTagsDiv = document.getElementById('addTagsDiv')
        while(addTagsDiv.firstChild){
            addTagsDiv.removeChild(addTagsDiv.firstChild);
        }

        var tagEditErrors = document.getElementById('tagEditErrors')
        while(tagEditErrors.firstChild){
            tagEditErrors.removeChild(tagEditErrors.firstChild);
        }

        var mainModal = document.getElementById('modalEditTask')
        var tabcontent = mainModal.getElementsByClassName("tabcontent");
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
    
        var tablinks = mainModal.getElementsByClassName("tablinks");
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }

        document.getElementById('btnEditTaskSubmit').disabled = false

        globalTags = {}
        taskEditDict = {}
        tagEditDict = {}
        translationEditDict = {}
        removedTags = []
        sessionDeletes = []
        sessionIDs = []
        globalTranslations = {}
        translationLabels = {}
        editTaskAlertCount = 0

    } else {
        discardOpened = false
        confirmOpened = false
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

function checkSpeciesChange(){
    /** Checks if a label that is associated with a species has been changed. */

    var needChange = false
    var species = Object.keys(speciesAndTasks)
    for (let i=0;i<globalLabels.length;i++) {
        labelID = globalLabels[i][3]
        parentID = globalLabels[i][4]
        labelDescription = globalLabels[i][0]

        if (species.includes(labelDescription)) {
            if (Object.keys(taskEditDict[parentID]['edits']['modify']).includes(String(labelID))) {
                needChange = true
                speciesEditDict[labelDescription] = {}
                speciesEditDict[labelDescription]['description'] = taskEditDict[parentID]['edits']['modify'][labelID]['description']
                speciesEditDict[labelDescription]['tasks'] = speciesAndTasks[labelDescription]['tasks']

            }
        }
    }

    return needChange
}

document.getElementById('btnConfirmEditSpecies').addEventListener('click', ()=>{
    /** Submits the edited task labels to the server when the user confirms the changes (if species labels have been changed). */
    document.getElementById('btnConfirmEditSpecies').disabled = true

    if (Object.keys(tagEditDict).length==0) {
        tagEditDict['delete'] = []
        tagEditDict['modify'] = {}
        tagEditDict['additional'] = {}
    }

    var delete_label = document.getElementById('deleteClusterLabel').checked ? 'true' : 'false'

    var formData = new FormData()
    formData.append("editDict", JSON.stringify(taskEditDict))
    formData.append("speciesEditDict", JSON.stringify(speciesEditDict))
    formData.append("tagsDict", JSON.stringify(tagEditDict))
    formData.append("translationsDict", JSON.stringify(translationEditDict))
    formData.append("deleteAutoLabels", JSON.stringify(delete_label))
    
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/editTask/'+selectedTask);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply.status=='success') {
                modalConfirmEditSpecies.modal('hide')
                modalEditTask.modal('hide')
                updatePage(current_page)
            } 
            else{
                // document.getElementById('modalConfirmEditSpeciesError').innerHTML = 'There was an error submitting your changes. Please try again.'
                modalConfirmEditSpecies.modal('hide')
                modalEditTask.modal('hide')
                document.getElementById('modalAlertHeader').innerHTML = 'Error'
                document.getElementById('modalAlertBody').innerHTML = reply.message
                modalAlert.modal({keyboard: true});
            }
            document.getElementById('btnConfirmEditSpecies').disabled = false
        }
    }
    xhttp.send(formData);
});

document.getElementById('btnCancelConfirmSpecies').addEventListener('click', ()=>{
    /** Cancels the species change confirmation and re-opens the edit labels modal. */
    confirmCancelled = true
    modalConfirmEditSpecies.modal('hide')
    modalEditTask.modal({keyboard: true});
});

modalConfirmEditSpecies.on('shown.bs.modal', function(){
    document.getElementById('modalConfirmEditSpeciesError').innerHTML = ''
    document.getElementById('modalConfirmEditSpeciesBody').innerHTML = ''
    speciesTasksString = ''
    for (let species in speciesEditDict) {
        speciesTasks = speciesAndTasks[species]['task_names']
        speciesDescription = speciesEditDict[species]['description']
        for (let i=0;i<speciesTasks.length;i++) {
            speciesTasksString += speciesTasks[i] + ' : ' + species + ' -> ' + speciesDescription + '<br>'
        }
    }

    document.getElementById('modalConfirmEditSpeciesBody').innerHTML = speciesTasksString
});

function getSpeciesAndTasks() {
    /** Gets the species and tasks for the current survey. */
    speciesAndTasks = {}
    speciesLabelIDs = {}
    speciesEditDict = {}
    speciesParentIDs = []
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            speciesAndTasks = reply.species_info
            speciesParentIDs = reply.parent_ids
            speciesLabelIDs = {}
            for (let i=0;i<globalLabels.length;i++) {
                labelID = globalLabels[i][3]
                labelDescription = globalLabels[i][0]
                if (Object.keys(speciesAndTasks).includes(labelDescription)) {
                    speciesLabelIDs[labelID] = labelDescription
                }
            }
        }
    }
    xhttp.open("GET", '/getIndividualSpeciesAndTasksForEdit/'+selectedTask);
    xhttp.send();
}

function getClassificationLabels(){
    /** Gets the classification labels for the current survey. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            classificationLabels = reply.classifications
            if (tabActiveEditTask == 'baseTranslationsTab' || modalEditTask.is(':visible')) {
                updateEditTranslationDisplay()
                document.getElementById('openTranslationsTab').disabled = false
                document.getElementById('openLabelsTab').disabled = false
                document.getElementById('openTagsTab').disabled = false
            }
        }
    }
    xhttp.open("GET", '/getClassificationLabels/'+selectedSurvey);
    xhttp.send();
}

function openTaskEditTab(evt, tabName){       
    /** Opens the specified tab in the edit task modal. */
    var mainModal = document.getElementById('modalEditTask')
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
    tabActiveEditTask = tabName

    if (tabName == 'baseLabelsTab') {
        openLabelTab()
    }
    else if (tabName == 'baseTranslationsTab') {
        openTranslationTab()
    }
    else if (tabName == 'baseTagsTab') {
        openTagsTab()
    }

}

function openTranslationTab(){
    /** Opens the translations tab in the edit task modal. */
    
    if (Object.keys(translationEditDict).length==0 && Object.keys(globalTranslations).length==0) {
        document.getElementById('openLabelsTab').disabled = true
        document.getElementById('openTranslationsTab').disabled = true
        document.getElementById('openTagsTab').disabled = true

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                globalTranslations = reply.translations
                getClassificationLabels()
            }
        }
        xhttp.open("GET", '/getTaskTranslations/'+selectedTask);
        xhttp.send();
    }
}

function openTagsTab(){
    /** Opens the tags tab in the edit task modal. */

    if (Object.keys(globalTags).length==0 && Object.keys(tagEditDict).length==0) {
        document.getElementById('openLabelsTab').disabled = true
        document.getElementById('openTranslationsTab').disabled = true
        document.getElementById('openTagsTab').disabled = true

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                taskTags = reply.tags
                var editTagsDiv = document.getElementById('editTagsDiv')
                while(editTagsDiv.firstChild){
                    editTagsDiv.removeChild(editTagsDiv.firstChild);
                }

                for (let i=0;i<taskTags.length;i++) {
                    globalTags[taskTags[i].id] = taskTags[i]
                }

                tagEditDict = {}
                tagEditDict['delete'] = []
                tagEditDict['modify'] = {}
                tagEditDict['additional'] = {}

                updateEditTagDisplay()

                document.getElementById('openLabelsTab').disabled = false
                document.getElementById('openTranslationsTab').disabled = false
                document.getElementById('openTagsTab').disabled = false
            }
        }
        xhttp.open("GET", '/getTaskTags/'+selectedTask);
        xhttp.send();
    }
}

$('#btnNewTag').on('click', ()=>{
    /** Adds a new tag row to the edit task modal. */
    IDNum = getIdNumforNext('tag-n');
    IDNum = 'n'+IDNum
    buildTag(IDNum)
});

function buildTag(IDNum,tag=null) {
    /** Builds tag row in Edit Task (Tags) */

    if (tag == null) {
        var tagDiv = document.getElementById('addTagsDiv')
    }
    else{
        var tagDiv = document.getElementById('editTagsDiv')
    }

    var row = document.createElement('div');
    row.classList.add('row');
    tagDiv.appendChild(row);

    var col1 = document.createElement('div');
    col1.classList.add('col-lg-4');
    row.appendChild(col1);

    var col2 = document.createElement('div');
    col2.classList.add('col-lg-1');
    row.appendChild(col2);

    var col3 = document.createElement('div');
    col3.classList.add('col-lg-4');
    row.appendChild(col3);

    var col4 = document.createElement('div');
    col4.classList.add('col-lg-3');
    row.appendChild(col4);

    var input = document.createElement('input');
    input.classList.add('form-control');
    input.setAttribute('type','text');
    input.setAttribute('id','tag-'+IDNum);
    input.setAttribute('name','tag-'+IDNum);
    if (tag != null) {
        input.value = tag.description
    }
    col1.appendChild(input);

    var input = document.createElement('input');
    input.classList.add('form-control');
    input.setAttribute('type','text');
    input.setAttribute('id','tagHotkey-'+IDNum);
    input.setAttribute('name','tagHotkey-'+IDNum);
    if (tag != null) {
        input.value = tag.hotkey
    }
    col2.appendChild(input);

    var btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemoveTag-'+IDNum;
    btnRemove.innerHTML = '&times;';
    col4.appendChild(btnRemove);

    btnRemove.addEventListener('click', function(){
        id = this.id.split('-')[1]
        removedTags.push(id)
        this.parentNode.parentNode.remove();
    });
}

function updateEditTagDisplay() {
    /** Updates the tag display in the edit task modal. */
    var editTagsDiv = document.getElementById('editTagsDiv')
    while(editTagsDiv.firstChild){
        editTagsDiv.removeChild(editTagsDiv.firstChild);
    }

    var addTagsDiv = document.getElementById('addTagsDiv')
    while(addTagsDiv.firstChild){
        addTagsDiv.removeChild(addTagsDiv.firstChild);
    }

    for (tagID in globalTags) {
        if (!tagEditDict['delete'].includes(tagID)) {
            if (Object.keys(tagEditDict['modify']).includes(tagID)) {
                buildTag(tagID,tagEditDict['modify'][tagID])
            }
            else{
                buildTag(tagID,globalTags[tagID])
            }
        }
    }

    for (tagID in tagEditDict['additional']) {
        buildTag(tagID,tagEditDict['additional'][tagID])
    }

    IDNum = getIdNumforNext('tag-n');
    IDNum = 'n'+IDNum
    buildTag(IDNum)
}

function updateEditTranslationDisplay(){
    /** Updates the translation display in the edit task modal. */
    var editTranslationsDiv = document.getElementById('editTranslationsDiv')
    while(editTranslationsDiv.firstChild){
        editTranslationsDiv.removeChild(editTranslationsDiv.firstChild);
    }

    var label_dict = {}
    for (key in translationLabels) {
        label_dict[translationLabels[key]] = key
    }
    var labels_list = Object.keys(label_dict).sort()
    var labels = []
    for (let i=0;i<labels_list.length;i++) {
        labels.push([labels_list[i],label_dict[labels_list[i]]])
    }

    for (let i=0;i<classificationLabels.length;i++) {
        classification = classificationLabels[i]
        if (!['unknown', 'nothing', 'knocked down'].includes(classification)) {
            IDNum = classification
            buildTranslationRow(IDNum,classification,'editTranslationsDiv',labels,true)

            if (classification in translationEditDict) {
                if (translationEditDict[classification].label.toLowerCase() == 'vehicles/humans/livestock') {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = -1
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = translationEditDict[classification].classify == 'True' ? true : false
                }
                else if (translationEditDict[classification].label_id in translationLabels) {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = translationEditDict[classification].label_id
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = translationEditDict[classification].classify == 'True' ? true : false
                }
                else{
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = 0
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                    document.getElementById('classificationSelectionEdit-'+IDNum).disabled = true
                }
            }
            else if (classification in globalTranslations) {
                if (globalTranslations[classification].label.toLowerCase() == 'vehicles/humans/livestock') {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = -1
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = globalTranslations[classification].classify 
                }
                else if (globalTranslations[classification].label_id in translationLabels) {
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = globalTranslations[classification].label_id
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = globalTranslations[classification].classify 
                }
                else{
                    document.getElementById('classTranslationSelectEdit-'+IDNum).value = 0
                    document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                    document.getElementById('classificationSelectionEdit-'+IDNum).disabled = true
                }
            }
            else{
                document.getElementById('classTranslationSelectEdit-'+IDNum).value = 0
                document.getElementById('classificationSelectionEdit-'+IDNum).checked = false
                document.getElementById('classificationSelectionEdit-'+IDNum).disabled = true
            }
        }
    }
}

modalEditTaskAlert.on('hidden.bs.modal', function(){
    /** Clears the alert modal when closed. */
    modalEditTask.modal('show')
});