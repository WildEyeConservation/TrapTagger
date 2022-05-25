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

const modalNewSurvey = $('#modalNewSurvey');
const btnNewSurvey = document.querySelector('#btnNewSurvey');
const modalAddImages = $('#modalAddImages');
const modalAddTask = $('#modalAddTask');
const modalResults = $('#modalResults');
const modalExploreTask = $('#modalExploreTask');
const modalLaunchTask = $('#modalLaunchTask');
const modalAlert = $('#modalAlert');
const modalPW = $('#modalPW');
const modalConfirm = $('#modalConfirm');
const formNewSurvey = document.querySelector('#formNewSurvey');
var alertReload = false
const btnCompare = document.querySelector('#btnCompare');
var waitForDownloadTimer = null
var processingTimer = null
var excel_task_ids = []
var csv_task_ids = []
var export_task_ids = []
var csvInfo = null
var levelChoiceTexts = []
var levelChoiceValues = []
var speciesChoiceTexts = []
var speciesChoiceValues = []
var csv_ids_to_remove = []
var excel_ids_to_remove = []
var export_ids_to_remove = []
var legalCSV = false
var globalLabels = null
var taskEditDict = {};
var sessionDeletes = []
var discardCancelled = false
var discardOpened = false
var sessionIDs = []
var selectedTaskName = null
var allLabelsComp = null
var globalUnusedTextsLeft = []
var globalUnusedTextsRight = []
var duplicateLabels
var chart = null
var trapgroupNames
var trapgroupValues
var polarData = {}
var map = null
var trapgroupInfo
var heatmapLayer = null
var markers = null
var invHeatmapLayer = null
var refData
var heatMapData
var activeRequest = {}
var addTaskInfo = null
var addTaskDescriptions = null
var addTaskHeading = false
var editTranslationsSubmitted = false
var speciesDisabled
var legalTags
var tagIdTranslate
var deletedTags
var bucketName = null
var individualSplide = null
var individualImages
var mapReady = null
var finishedDisplaying = true
var activeImage = null
var drawnItems = null
var fullRes = false
var rectOptions
var mapWidth
var mapHeight
var addedDetections = false
var selectedIndividual
var modalAlertIndividualsReturn = false
var surveys = null
var customColumns = {}
var individual_next = null
var individual_prev = null
var surveyClassifications = null
var tgCheckID = null
var tgCheckTimer = null
var hierarchicalLabels=null

const modalDownload = $('#modalDownload');
const btnOpenExport = document.querySelector('#btnOpenExport');
const modalExport = $('#modalExport');
const modalAlertIndividuals = $('#modalAlertIndividuals');
const modalIndividual = $('#modalIndividual');
const modalIndividuals = $('#modalIndividuals');
const submitTagsBtn = document.querySelector('#submitTagsBtn');
const btnAddTag = document.querySelector('#btnAddTag');
const modalTags = $('#modalTags');
const modalEditTranslations = $('#modalEditTranslations');
const btnSubmitTranslaions = document.querySelector('#btnSubmitTranslaions');
const btnReClassify = document.querySelector('#btnReClassify');
const btnModalAddTaskBack = document.querySelector('#btnModalAddTaskBack');
const btnModalAddTaskBack2 = document.querySelector('#btnModalAddTaskBack2');
const btnCreateTask2 = document.querySelector('#btnCreateTask2');
const btnCreateTask3 = document.querySelector('#btnCreateTask3');
const modalAddTask2 = $('#modalAddTask2');
const modalAddTask3 = $('#modalAddTask3');
const modalStatus = $('#modalStatus');
const analysisSelector = document.getElementById('analysisSelector')
const modalStatistics = $('#modalStatistics');
const btnOpenStatistics = document.querySelector('#btnOpenStatistics');
const btnSubmitCompare = document.querySelector('#btnSubmitCompare');
const modalCompare = $('#modalCompare');
const btnPrevSurveys = document.querySelector('#btnPrevSurveys');
const btnNextSurveys = document.querySelector('#btnNextSurveys');
const btnDiscardChanges = document.querySelector('#btnDiscardChanges');
const btnCancelDiscard = document.querySelector('#btnCancelDiscard');
const modalConfirmEdit = $('#modalConfirmEdit');
const btnEditTaskSubmit = document.querySelector('#btnEditTaskSubmit');
const btnSaveLabelChanges = document.querySelector('#btnSaveLabelChanges');
const btnAddNewLabel = document.querySelector('#btnAddNewLabel');
const modalEditTask = $('#modalEditTask');
const exploreTaskBtn = document.querySelector('#exploreTaskBtn');
const csvGenClose = document.querySelector('#csvGenClose');
const CompClose = document.querySelector('#CompClose');
const btnAddCSVCol = document.querySelector('#btnAddCSVCol');
const modalCSVGenerate = $('#modalCSVGenerate');
const btnCsvGenerate = document.querySelector('#btnCsvGenerate');
const btnExcelDownload = document.querySelector('#btnExcelDownload');
const btnCsvDownload = document.querySelector('#btnCsvDownload');

var polarColours = {'rgba(10,120,80,0.2)':false,
                    'rgba(255,255,255,0.2)':false,
                    'rgba(223,105,26,0.2)':false,
                    'rgba(196,26,26,0.2)':false,
                    'rgba(190,26,190,0.2)':false,
                    'rgba(70,130,180,0.2)':false,
                    'rgba(0,0,0,0.2)':false,
                    'rgba(234,209,26,0.2)':false,
                    'rgba(26,234,219,0.2)':false,
                    'rgba(124,234,26,0.2)':false,
                    'rgba(140,26,234,0.2)':false
                }

var barColours = {
    'rgba(67,115,98,0.4)': false,
    'rgba(89,228,170,0.4)': false,
    'rgba(97,167,152,0.4)': false,
    'rgba(57,159,113,0.4)': false,
    'rgba(35,108,144,0.4)': false,
    'rgba(20,48,55,0.4)': false,
    'rgba(61,105,121,0.4)': false,
    'rgba(104,38,137,0.4)': false,
    'rgba(88,63,124,0.4)': false,
    'rgba(78,46,176,0.4)': false,
    'rgba(182,92,88,0.4)': false,
    'rgba(149,88,63,0.4)': false,
    'rgba(225,158,139,0.4)': false,
    'rgba(214,131,97,0.4)': false,
    'rgba(222,156,183,0.4)': false,
    'rgba(202,90,156,0.4)': false,
    'rgba(215,61,113,0.4)': false,
    'rgba(150,90,115,0.4)': false,
    'rgba(229,177,54,0.4)': false,
    'rgba(157,110,35,0.4)': false,
    'rgba(220,173,105,0.4)': false,
    'rgba(143,115,79,0.4)': false,
    'rgba(223,138,46,0.4)': false,
    'rgba(220,191,155,0.4)': false,
    'rgba(203,218,69,0.4)': false,
    'rgba(85,159,58,0.4)': false,
    'rgba(111,129,54,0.4)': false,
    'rgba(117,223,84,0.4)': false,
    'rgba(189,218,138,0.4)': false
}

var btnOpacity = 0.2

var disabledSurveyStatuses = ['extracting labels','correcting timestamps','reclustering','removing duplicate images','importing coordinates','processing','uploading','deleting','launched','importing','removing humans','removing static detections','clustering','complete','cancelled','prepping task','classifying','calculating scores']
var diabledTaskStatuses = ['prepping','deleting','importing','processing','pending','started','initialising']
const launchMTurkTaskBtn = document.querySelector('#launchMTurkTaskBtn');
const btnCreateTask = document.querySelector('#btnCreateTask');

var selectedSurvey = 0;
var selectedTask = 0;
var legalLabels = false;
var legalTags = true; //false
var globalHotkeysParents = ['v', 'q', 'n', 'u']
var globalDescriptions = ['none', 'vehicles/humans/livestock', 'knocked down', 'wrong', 'nothing', 'unknown', 'skip']
var globalHotkeysChildren = ['9', '0']
var taskNames = []

var prev_url = null
var next_url = null
var current_page = '/getHomeSurveys'

var timerTaskStatus = null
var timerTaskBar = null

var selectFiles = null
var inputFile = null

function buildSurveys(survey,disableSurvey) {
    /**
     * Builds the survey row
     * @param {obj} survey object describing ths urvey
     * @param {bool} disableSurvey whether the survey is to be disabled or not
    */

    surveyListDiv = document.getElementById('surveyListDiv'); 
    newSurveyDiv = document.createElement('div')
    newSurveyDiv.style.backgroundColor = '#3C4A59';

    newSurveyDiv.appendChild(document.createElement('br'))

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    surveyDiv = document.createElement('div')
    surveyDiv.classList.add('col-lg-6');
    taskDiv = document.createElement('div')
    taskDiv.setAttribute('style',"border-left: thin solid #ffffff;")
    taskDiv.classList.add('col-lg-6');
    entireRow.appendChild(surveyDiv)
    entireRow.appendChild(taskDiv)

    headingElement = document.createElement('h4')
    headingElement.innerHTML = survey.name
    headingElement.setAttribute('style',"margin-left: 10px; margin-right:10px")
    newSurveyDiv.appendChild(headingElement)

    newSurveyDiv.appendChild(entireRow)

    for (ii=0;ii<survey.tasks.length;ii++) {
        buildTask(taskDiv, survey.tasks[ii], disableSurvey, survey)
        if (ii < survey.tasks.length-1) {
            taskDiv.appendChild(document.createElement('br'))
        }
    }

    infoElementRow = document.createElement('div')
    infoElementRow.classList.add('row');
    infoElementRow.classList.add('center');
    infoElementRow.setAttribute('style',"margin-left: 10px")

    infoElementNumTrapgroups = document.createElement('div')
    infoElementNumTrapgroups.classList.add('col-lg-2');
    infoElementNumTrapgroups.setAttribute("style","font-size: 80%")
    infoElementNumTrapgroups.innerHTML = 'Trapgroups: ' + survey.numTrapgroups
    infoElementRow.appendChild(infoElementNumTrapgroups)

    infoElementNumImages = document.createElement('div')
    infoElementNumImages.classList.add('col-lg-2');
    infoElementNumImages.setAttribute("style","font-size: 80%")
    infoElementNumImages.innerHTML = 'Images: ' + survey.numImages
    infoElementRow.appendChild(infoElementNumImages)

    infoElementDescription = document.createElement('div')
    infoElementDescription.classList.add('col-lg-2');
    infoElementDescription.setAttribute("style","font-size: 80%")
    infoElementDescription.innerHTML = 'Status: ' + survey.status
    infoElementRow.appendChild(infoElementDescription)

    addImagesCol = document.createElement('div')
    addImagesCol.classList.add('col-lg-2');
    addImagesBtn = document.createElement('button')
    addImagesBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
    addImagesBtn.setAttribute("id","addImagesBtn"+survey.id)
    addImagesBtn.innerHTML = 'Edit'
    addImagesCol.appendChild(addImagesBtn)
    infoElementRow.appendChild(addImagesCol)

    addImagesBtn.addEventListener('click', function(wrapSurveyName,wrapSurveyId) {
        return function() {
            surveyName = wrapSurveyName
            selectedSurvey = wrapSurveyId
            document.getElementById('addImagesHeader').innerHTML =  'Edit Survey: ' + wrapSurveyName
            modalAddImages.modal({keyboard: true});
        }
    }(survey.name,survey.id));

    addTaskCol = document.createElement('div')
    addTaskCol.classList.add('col-lg-2');
    addTaskBtn = document.createElement('button')
    addTaskBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
    addTaskBtn.setAttribute("id","addTaskBtn"+survey.id)
    addTaskBtn.innerHTML = 'Add Task'
    addTaskCol.appendChild(addTaskBtn)
    infoElementRow.appendChild(addTaskCol)

    addTaskBtn.addEventListener('click', function(wrapSurveyId) {
        return function() {
            selectedSurvey = wrapSurveyId
            resetModalAddTask1()
            resetModalAddTask2()
            resetModalAddTask3()
            modalAddTask.modal({keyboard: true});
        }
    }(survey.id));

    deleteSurveyCol = document.createElement('div')
    deleteSurveyCol.classList.add('col-lg-2');
    deleteSurveyBtn = document.createElement('button')
    deleteSurveyBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
    deleteSurveyBtn.setAttribute("id","deleteSurveyBtn"+survey.id)
    deleteSurveyBtn.innerHTML = 'Delete'
    deleteSurveyCol.appendChild(deleteSurveyBtn)
    infoElementRow.appendChild(deleteSurveyCol)

    deleteSurveyBtn.addEventListener('click', function(wrapSurveyName) {
        return function() {
            document.getElementById('modalConfirmHeader').innerHTML = 'Confirmation Required'
            document.getElementById('modalConfirmBody').innerHTML = 'Do you wish to delete ' + wrapSurveyName + '?'
            document.getElementById('btnConfirm').addEventListener('click', confirmSurveyDelete);
            document.getElementById('confirmclose').addEventListener('click', removeSurveyDeleteListeners);
            modalConfirm.modal({keyboard: true});
        }
    }(survey.name));

    if (disableSurvey) {
        addImagesBtn.disabled = true
        deleteSurveyBtn.disabled = true
        addTaskBtn.disabled = true
    } else {
        addImagesBtn.disabled = false
        deleteSurveyBtn.disabled = false
        addTaskBtn.disabled = false
    }

    surveyDiv.appendChild(infoElementRow)

    newSurveyDiv.appendChild(document.createElement('br'))
    surveyListDiv.appendChild(newSurveyDiv) 
}

function onload(){
    /**Function for initialising the page on load.*/
    updatePage(current_page)
}

window.addEventListener('load', onload, false);

function updatePage(url){
    /**
     * Updates the current page using the stipulated url, includes optional paramaters like order and pagination.
     * @param {str} url the url to load for the page
     */

    if (url==null) {
        url = current_page
    } else {
        current_page = url
    }
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);    
            surveyListDiv = document.getElementById('surveyListDiv'); 
            while(surveyListDiv.firstChild){
                surveyListDiv.removeChild(surveyListDiv.firstChild);
            }
            taskProcessing = false

            for (iii=0;iii<reply.surveys.length;iii++) {
                disableSurvey = false
                for (z=0;z<reply.surveys[iii].tasks.length;z++) {
                    if ((diabledTaskStatuses.includes(reply.surveys[iii].tasks[z].status.toLowerCase()))||(reply.surveys[iii].tasks[z].disabledLaunch=='true')) {
                        disableSurvey = true
                        taskProcessing = true
                    }
                }
                if (disabledSurveyStatuses.includes(reply.surveys[iii].status.toLowerCase())) {
                    disableSurvey = true
                    taskProcessing = true
                }
                buildSurveys(reply.surveys[iii],disableSurvey)
                if (iii < reply.surveys.length-1) {
                    surveyListDiv.appendChild(document.createElement('br'))
                }
            }

            if (taskProcessing==true) {
                if (processingTimer != null) {
                    clearInterval(processingTimer)
                    processingTimer = setInterval(updatePage, 30000)
                } else {
                    processingTimer = setInterval(updatePage, 30000)
                }
            } else {
                if (processingTimer != null) {
                    clearInterval(processingTimer)
                }
                processingTimer = null
            }
            
            if (reply.next_url==null) {
                btnNextSurveys.style.visibility = 'hidden'
            } else {
                btnNextSurveys.style.visibility = 'visible'
                next_url = reply.next_url
            }

            if (reply.prev_url==null) {
                btnPrevSurveys.style.visibility = 'hidden'
            } else {
                btnPrevSurveys.style.visibility = 'visible'
                prev_url = reply.prev_url
            }

            updateTaskStatus()
            updateTaskProgressBar()

            if (timerTaskStatus != null) {
                clearInterval(timerTaskStatus)
            }

            if (timerTaskBar != null) {
                clearInterval(timerTaskBar)
            }

            timerTaskStatus = setInterval(updateTaskStatus, 5000); //5 seconds
            timerTaskBar = setInterval(updateTaskProgressBar, 5000); //5 seconds
        }
    }
    xhttp.open("GET", url);
    xhttp.send();
}

function confirmSurveyDelete() {
    /** Handles the confirmation of survey deletion, submitting the request to the server. */

    removeSurveyDeleteListeners()
    modalConfirm.modal('hide')

    var surveyName = document.getElementById('modalConfirmBody').innerHTML.split('Do you wish to delete ')[1].split('?')[0]

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/deleteSurvey/'+surveyName);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  

            if (reply.status=='success') {
                document.getElementById('modalAlertHeader').innerHTML = 'Success'
                document.getElementById('modalAlertBody').innerHTML = 'Survey deletion successfully initiated.'
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

function removeSurveyDeleteListeners() {
    /** Removes the event listens from the buttons of the survey-deletion confirmation modal. */

    document.getElementById('btnConfirm').removeEventListener('click', confirmSurveyDelete);
    document.getElementById('confirmclose').removeEventListener('click', removeSurveyDeleteListeners);
}

btnNewSurvey.addEventListener('click', ()=>{
    /** Event listener that opens the new survey modal. */
    modalNewSurvey.modal({keyboard: true});
});

function updateSurveys(surveyElement) {
    /** Fills the supplied element with a list of all surveys. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            optionTexts = ['None','Templates']
            optionValues = ["-99999",'-1']           
            for (iiiiii=0;iiiiii<surveys.length;iiiiii++) {
                optionTexts.push(surveys[iiiiii][1])
                optionValues.push(surveys[iiiiii][0])
            }
            clearSelect(surveyElement)
            fillSelect(surveyElement, optionTexts, optionValues)
        }
    }
    xhttp.open("GET", '/getSurveys');
    xhttp.send();
}

function updateTasks(surveyElement, taskElement) {
    /** Fills the suplied task element with a list of all tasks associated with the survey selected in the supllied survey element. */
    survey = surveyElement.options[surveyElement.selectedIndex].value;

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            tasks = JSON.parse(this.responseText);  
            optionTexts = ['None']
            optionValues = ["-99999"]             
            for (iiiiiii=0;iiiiiii<tasks.length;iiiiiii++) {
                optionTexts.push(tasks[iiiiiii][1])
                optionValues.push(tasks[iiiiiii][0])
            }
            clearSelect(taskElement)
            fillSelect(taskElement, optionTexts, optionValues)
        }
    }
    xhttp.open("GET", '/getTasks/'+survey);
    xhttp.send();
}

function resetNewSurveyPage() {
    /** Clears the new survey modal. */
    
    document.getElementById('newSurveyName').value = ''
    document.getElementById('newSurveyDescription').value = ''
    document.getElementById('newSurveyTGCode').value = ''
    document.getElementById('newSurveyErrors').innerHTML = ''

    document.getElementById('S3BucketUpload').checked = false
    document.getElementById('BrowserUpload').checked = false
    document.getElementById('newSurveyCheckbox').checked = false

    document.getElementById('kmlFileUploadText').value = ''
    document.getElementById('kmlFileUpload').value = ''

    document.getElementById('newSurveyTGInfo').innerHTML = ''

    newSurveyFormDiv = document.querySelector('#newSurveyFormDiv')
    while(newSurveyFormDiv.firstChild){
        newSurveyFormDiv.removeChild(newSurveyFormDiv.firstChild);
    }

    newSurveyTgBuilder = document.querySelector('#newSurveyTgBuilder')
    while(newSurveyTgBuilder.firstChild){
        newSurveyTgBuilder.removeChild(newSurveyTgBuilder.firstChild);
    }
}

function resetEditSurveyModal() {
    /** Clears the edit survey modal. */

    document.getElementById('classifierVersion').value = ''
    document.getElementById('btnReClassify').disabled = true
    document.getElementById('addImagesAddImages').checked = false
    document.getElementById('addImagesAddCoordinates').checked = false
    document.getElementById('addImagesEditTimestamps').checked = false
    document.getElementById('addImagesAddImages').disabled = false
    document.getElementById('addImagesAddCoordinates').disabled = false
    document.getElementById('addImagesEditTimestamps').disabled = false

    addImagesAddImsDiv = document.getElementById('addImagesAddImsDiv')
    while(addImagesAddImsDiv.firstChild){
        addImagesAddImsDiv.removeChild(addImagesAddImsDiv.firstChild);
    }

    addImagesAddCoordsDiv = document.getElementById('addImagesAddCoordsDiv')
    while(addImagesAddCoordsDiv.firstChild){
        addImagesAddCoordsDiv.removeChild(addImagesAddCoordsDiv.firstChild);
    }

    addImagesEditTimestampsDiv = document.getElementById('addImagesEditTimestampsDiv')
    while(addImagesEditTimestampsDiv.firstChild){
        addImagesEditTimestampsDiv.removeChild(addImagesEditTimestampsDiv.firstChild);
    }
}

function buildBrowserUpload(divID) {
    /** Builds the browser image upload form into the specified div. */
    
    div = document.getElementById(divID)
    while(div.firstChild){
        div.removeChild(div.firstChild);
    }

    formGroup = document.createElement('div')
    formGroup.classList.add('form-group')
    div.appendChild(formGroup)

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Images to Upload'
    formGroup.appendChild(h5)

    div2 = document.createElement('div')
    div2.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div2.innerHTML = '<i>Upload the survey images by selecting the entire folder you wish to upload.</i>'
    formGroup.appendChild(div2)

    row = document.createElement('div')
    row.classList.add('row')
    formGroup.append(row)

    col = document.createElement('div')
    col.classList.add('col-lg-12')
    row.appendChild(col)

    input = document.createElement('select')
    input.setAttribute('size','15')
    input.classList.add('form-control')
    input.setAttribute('id','selectFiles')
    col.appendChild(input)

    formGroup.appendChild(document.createElement('br'))

    row2 = document.createElement('div')
    row2.classList.add('row')
    formGroup.append(row2)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-2')
    row2.appendChild(col2)

    label = document.createElement('label')
    label.setAttribute('class','btn btn-primary btn-sm btn-block')
    label.setAttribute('for','inputFile')
    label.innerHTML = 'Select Images'
    col2.appendChild(label)

    input2 = document.createElement('input')
    input2.setAttribute('type','file')
    input2.classList.add('form-control-file')
    input2.setAttribute('id','inputFile')
    input2.multiple = true
    input2.setAttribute('style','display:none;')
    input2.setAttribute('webkitdirectory','')
    input2.setAttribute('directory','')
    label.append(input2)

    input2.addEventListener( 'input', () => {
        inputFile = document.getElementById('inputFile')
        selectFiles = document.getElementById('selectFiles')
        for (let idx = 0; idx < inputFile.files.length; idx++){
            let option = document.createElement('option');
            option.text = inputFile.files[idx].webkitRelativePath;
            option.value = idx;
            selectFiles.add(option);
        }
        checkTrapgroupCode()
    });

    // Initalise tg code check
    if (document.getElementById('addImagesTGCode')!=null) {
        $("#addImagesTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#addImagesCheckbox").change( function() {
            checkTrapgroupCode()
        })
    } else {
        $("#newSurveyTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#newSurveyCheckbox").change( function() {
            checkTrapgroupCode()
        })
    }
}

function pingTgCheck() {
    var formData = new FormData()
    formData.append("task_id", tgCheckID)

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            if (document.getElementById('S3FolderInput').value!='') {
                response = JSON.parse(this.responseText)
                if (response.status=='SUCCESS') {
                    infoDiv.innerHTML = response.data
                    clearInterval(tgCheckTimer)
                } else if (response.status=='FAILURE') {
                    clearInterval(tgCheckTimer)
                }
            }
        }
    }
    xhttp.open("POST", '/checkTrapgroupCode');
    xhttp.send(formData);
}

function checkTrapgroupCode() {
    /** Checks the trapgroup code and updates the TG info field. */

    if (document.getElementById('addImagesTGCode')!=null) {
        tgCode = document.getElementById('addImagesTGCode').value
        infoDiv = document.getElementById('addImagesTGInfo')
        browserChecked = document.getElementById('BrowserAdd').checked
        folderChecked = document.getElementById('S3BucketAdd').checked
    } else {
        tgCode = document.getElementById('newSurveyTGCode').value
        infoDiv = document.getElementById('newSurveyTGInfo')
        browserChecked = document.getElementById('BrowserUpload').checked
        folderChecked = document.getElementById('S3BucketUpload').checked
    }

    if (document.getElementById('addImagesTGCode')!=null) {
        if (!document.getElementById('addImagesCheckbox').checked) {
            tgCode+='[0-9]+'
        }
    } else {
        if (!document.getElementById('newSurveyCheckbox').checked) {
            tgCode+='[0-9]+'
        }
    }

    infoDiv.innerHTML = ''
    if (browserChecked) {
        if ((tgCode!='')&&(inputFile.files.length>0)) {
            infoDiv.innerHTML = 'Checking...'
            pattern = new RegExp(tgCode)
    
            tgs = []
            for (fi=0;fi<inputFile.files.length;fi++) {
                matches = inputFile.files[fi].webkitRelativePath.match(pattern)
                if (matches!=null) {
                    tg = matches[0]
                    if (!tgs.includes(tg)) {
                        tgs.push(tg)
                    }
                }
            }

            infoDiv.innerHTML = tgs.length.toString() + ' trapgroups found: ' + tgs.toString()
        }
    } else if (folderChecked) {
        folder = document.getElementById('S3FolderInput').value
    
        if ((tgCode!='')&&(folder!='')) {
            infoDiv.innerHTML = 'Checking...'
    
            var formData = new FormData()
            formData.append("tgCode", tgCode)
            formData.append("folder", folder)
            formData.append("task_id", 'none')
        
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    if (document.getElementById('S3FolderInput').value!='') {
                        response = JSON.parse(this.responseText)
                        if (response.status == 'PENDING') {
                            tgCheckID = response.data
                            if (tgCheckTimer != null) {
                                clearInterval(tgCheckTimer)
                                tgCheckTimer = setInterval(pingTgCheck, 1000)
                            } else {
                                tgCheckTimer = setInterval(pingTgCheck, 1000)
                            }
                        }
                    }
                }
            }
            xhttp.open("POST", '/checkTrapgroupCode');
            xhttp.send(formData);
        }
    }
}

function updateTgCode() {
    /** Extracts the info from the trapgroup code builder and populates the trapgroup code accordingly. */

    tgCode = ''
    charSelects = document.querySelectorAll('[id^=charSelect-]')
    for (cs=0;cs<charSelects.length;cs++) {
        IDNum = charSelects[cs].id.split("-")[charSelects[cs].id.split("-").length-1]
        
        selection = charSelects[cs].options[charSelects[cs].selectedIndex].text
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

    if (document.getElementById('addImagesTGCode')!=null) {
        document.getElementById('addImagesTGCode').value = tgCode
    } else {
        document.getElementById('newSurveyTGCode').value = tgCode
    }

    checkTrapgroupCode()
}

function buildTgBuilderRow() {
    /** Builds a row for the trapgroup code builder. */

    IDNum = getIdNumforNext('charSelect')

    if (IDNum==0) {
        // Initialising - build headings
        if (document.getElementById('addImagesTGCode')!=null) {
            tgBuilder = document.getElementById('addImagesTgBuilder')
        } else {
            tgBuilder = document.getElementById('newSurveyTgBuilder')
        }
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
            buildTgBuilderRow()
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
                    updateTgCode()
                })

                col3 = document.getElementById('tgBuilderCol3-'+wrapIDNum)
                
                select = document.createElement('select')
                select.classList.add('form-control')
                select.setAttribute('id','CustomCharSelect-'+wrapIDNum)
                col3.appendChild(select)

                $("#CustomCharSelect-"+wrapIDNum).change( function() {
                    updateTgCode()
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
            updateTgCode()
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
                    updateTgCode()
                })
            } else {
                // Remove any custom row
                div = document.getElementById('tgBuilderCol5-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }
            }
            updateTgCode()
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
        updateTgCode()
    });

    if (IDNum!=0) {
        updateTgCode()
    }
}

function buildBucketUpload(divID) {
    /** Builds the bucket image upload form into the specified div. */

    div = document.getElementById(divID)

    while(div.firstChild){
        div.removeChild(div.firstChild);
    }

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'S3 Folder Name'
    div.appendChild(h5)

    div2 = document.createElement('div')
    div2.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div2.innerHTML = '<i>If you have already uploaded the survey to Amazon S3, please enter the name of the folder below.</i>'
    div.appendChild(div2)

    row = document.createElement('div')
    row.classList.add('row')
    div.append(row)

    col = document.createElement('div')
    col.classList.add('col-lg-4')
    row.appendChild(col)

    input = document.createElement('input')
    input.setAttribute('type','text')
    input.classList.add('form-control')
    input.required = true
    input.setAttribute('id','S3FolderInput')
    col.appendChild(input)

    div.append(document.createElement('br'))

    // Initalise tg code check
    if (document.getElementById('addImagesTGCode')!=null) {
        $("#addImagesTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#addImagesCheckbox").change( function() {
            checkTrapgroupCode()
        })
    } else {
        $("#newSurveyTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#newSurveyCheckbox").change( function() {
            checkTrapgroupCode()
        })
    }

    $("#S3FolderInput").change( function() {
        checkTrapgroupCode()
    })
}

function buildAddIms() {
    /** Builds the add images form for use in the edit survey modal. */
    
    addImagesAddImsDiv = document.getElementById('addImagesAddImsDiv')
    addImagesAddImsDiv.appendChild(document.createElement('br'))

    // Upload Type
    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Upload Type'
    addImagesAddImsDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>The image-upload method you would like to use.</i>'
    addImagesAddImsDiv.appendChild(div)

    div = document.createElement('div')
    div.setAttribute('class','custom-control custom-radio custom-control-inline')
    addImagesAddImsDiv.appendChild(div)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','S3BucketAdd')
    input.setAttribute('name','addImagesSelection')
    input.setAttribute('value','customEx')
    div.appendChild(input)

    label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','S3BucketAdd')
    label.innerHTML = 'S3 Bucket Upload'
    div.appendChild(label)

    div = document.createElement('div')
    div.setAttribute('class','custom-control custom-radio custom-control-inline')
    addImagesAddImsDiv.appendChild(div)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','BrowserAdd')
    input.setAttribute('name','addImagesSelection')
    input.setAttribute('value','customEx')
    div.appendChild(input)

    label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','BrowserAdd')
    label.innerHTML = 'Browser Upload'
    div.appendChild(label)

    addImagesAddImsDiv.appendChild(document.createElement('br'))
    addImagesAddImsDiv.appendChild(document.createElement('br'))

    div = document.createElement('div')
    div.setAttribute('id','addImagesFormDiv')
    addImagesAddImsDiv.appendChild(div)

    $("#S3BucketAdd").change( function() {
        S3BucketAdd = document.getElementById('S3BucketAdd')
        if (S3BucketAdd.checked) {
            buildBucketUpload('addImagesFormDiv')
        }
    })
    
    $("#BrowserAdd").change( function() {
        BrowserAdd = document.getElementById('BrowserAdd')
        if (BrowserAdd.checked) {
            buildBrowserUpload('addImagesFormDiv')
        }
    })

    // Trapgroup Code
    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Trapgroup Code'
    addImagesAddImsDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>The trapgroup designator in your folder structure. Eg. "Site" if your sites are stored in folders named "Site1", "Site2" etc. Becomes a regular expression search query if the advanced code option is selected.</i>'
    addImagesAddImsDiv.appendChild(div)

    info = document.createElement('div')
    info.setAttribute('id','addImagesTGInfo')
    info.setAttribute('style','font-size: 80%; color: #DF691A')
    addImagesAddImsDiv.appendChild(info)

    row = document.createElement('div')
    row.classList.add('row')
    addImagesAddImsDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    row.appendChild(col1)

    input = document.createElement('input')
    input.setAttribute('type','text')
    input.classList.add('form-control')
    input.required = true
    input.setAttribute('id','addImagesTGCode')
    col1.appendChild(input)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-4')
    row.appendChild(col2)

    checkDiv = document.createElement('div')
    checkDiv.setAttribute('class','custom-control custom-checkbox')
    col2.appendChild(checkDiv)

    input2 = document.createElement('input')
    input2.setAttribute('type','checkbox')
    input2.classList.add('custom-control-input')
    input2.setAttribute('id','addImagesCheckbox')
    input2.setAttribute('name','addImagesCheckbox')
    checkDiv.appendChild(input2)

    label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','addImagesCheckbox')
    label.innerHTML = 'Advanced Code'
    checkDiv.appendChild(label)

    tgBuilder = document.createElement('div')
    tgBuilder.setAttribute('id','addImagesTgBuilder')
    addImagesAddImsDiv.appendChild(tgBuilder)

    addImagesAddImsDiv.appendChild(document.createElement('br'))

    $("#addImagesCheckbox").change( function() {
        addImagesCheckbox = document.getElementById('addImagesCheckbox')
        if (addImagesCheckbox.checked) {
            document.getElementById('addImagesErrors').innerHTML = 'Note that you are now required to enter a regular expression for your trapgroup code. It will be used to identify your unique camera-trap locations based on your folder structure.'
            buildTgBuilderRow()
        } else {
            document.getElementById('addImagesErrors').innerHTML = ''

            // Clear TG Builder
            addImagesTgBuilder = document.getElementById('addImagesTgBuilder')
            while(addImagesTgBuilder.firstChild){
                addImagesTgBuilder.removeChild(addImagesTgBuilder.firstChild);
            }    
        }
    })
}

function buildEditTimestamp() {
    /** Builds the form for editing timestamps on the edit survey modal. */
    
    document.getElementById('addImagesAddImages').disabled = true
    document.getElementById('addImagesAddCoordinates').disabled = true
    document.getElementById('addImagesEditTimestamps').disabled = true
    document.getElementById('addImagesEditTimestampsDiv').innerHTML = 'Loading...'
    
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getCameraStamps/'+selectedSurvey);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            if ((reply.survey==selectedSurvey)&&(modalAddImages.is(':visible'))) {
                reply = reply.data

                addImagesEditTimestampsDiv = document.getElementById('addImagesEditTimestampsDiv')

                while(addImagesEditTimestampsDiv.firstChild){
                    addImagesEditTimestampsDiv.removeChild(addImagesEditTimestampsDiv.firstChild);
                }
    
                document.getElementById('addImagesAddImages').disabled = false
                document.getElementById('addImagesAddCoordinates').disabled = false
                document.getElementById('addImagesEditTimestamps').disabled = false
                addImagesEditTimestampsDiv.appendChild(document.createElement('br'))
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Edit Timestamps'
                addImagesEditTimestampsDiv.appendChild(h5)
            
                div = document.createElement('div')
                div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                div.innerHTML = '<i>Edit the starting timestamps for each of the cameras in your survey.</i>'
                addImagesEditTimestampsDiv.appendChild(div)

                errors = document.createElement('div')
                errors.setAttribute('id','timestampErrors')
                errors.setAttribute('style','font-size: 80%; color: #DF691A')
                addImagesEditTimestampsDiv.appendChild(errors)
            
                addImagesEditTimestampsDiv.appendChild(document.createElement('br'))
            
                row = document.createElement('div')
                row.classList.add('row')
                addImagesEditTimestampsDiv.appendChild(row)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Camera'
                col.appendChild(h5)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Original'
                col.appendChild(h5)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Corrected'
                col.appendChild(h5)
            
                for (trapgroup=0;trapgroup<reply.length;trapgroup++) {
                    h5 = document.createElement('h5')
                    h5.setAttribute('style','margin-bottom: 2px')
                    h5.innerHTML = reply[trapgroup].tag
                    addImagesEditTimestampsDiv.appendChild(h5)
    
                    for (camera=0;camera<reply[trapgroup].cameras.length;camera++) {
                        row = document.createElement('div')
                        row.classList.add('row')
                        addImagesEditTimestampsDiv.appendChild(row)
                    
                        col = document.createElement('div')
                        col.classList.add('col-lg-4')
                        col.innerHTML = reply[trapgroup].cameras[camera].folder
                        row.appendChild(col)
    
                        col = document.createElement('div')
                        col.classList.add('col-lg-4')
                        row.appendChild(col)
    
                        input = document.createElement('input')
                        input.setAttribute('type','text')
                        input.classList.add('form-control')
                        input.value = reply[trapgroup].cameras[camera].timestamp
                        input.disabled = true
                        col.appendChild(input)
    
                        col = document.createElement('div')
                        col.classList.add('col-lg-4')
                        row.appendChild(col)
    
                        input = document.createElement('input')
                        input.setAttribute('type','text')
                        input.classList.add('form-control')
                        input.value = reply[trapgroup].cameras[camera].corrected_timestamp
                        input.setAttribute('id','corrected_timestamp-'+reply[trapgroup].cameras[camera].folder)
                        col.appendChild(input)
                    }
    
                    addImagesEditTimestampsDiv.appendChild(document.createElement('br'))
                }
            }
        }
    }
    xhttp.send();
}

function buildKml() {
    /** Builds the kml upload functionality in the edit survey modal. */
    
    addImagesAddCoordinates = document.getElementById('addImagesAddCoordsDiv')
    addImagesAddCoordinates.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Trapgroup Coordinates'
    addImagesAddCoordinates.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Upload a kml file containing your trapgroup coordinates. This can be exported from <a href="https://earth.google.com/web/">Google Earth</a></i>'
    addImagesAddCoordinates.appendChild(div)

    row = document.createElement('div')
    row.classList.add('row')
    addImagesAddCoordinates.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-6')
    row.appendChild(col1)

    div2 = document.createElement('div')
    div2.classList.add('input-group')
    col1.appendChild(div2)

    input = document.createElement('input')
    input.setAttribute('style','background-color:white')
    input.setAttribute('type','text')
    input.setAttribute('id','kmlFileUploadText2')
    input.classList.add('form-control')
    input.setAttribute('disabled','')
    div2.appendChild(input)

    label = document.createElement('label')
    label.classList.add('input-group-btn')
    div2.appendChild(label)

    span = document.createElement('span')
    span.setAttribute('class','btn btn-primary')
    span.innerHTML = 'Browse'
    label.appendChild(span)

    input2 = document.createElement('input')
    input2.setAttribute('type','file')
    input2.setAttribute('style','display:none')
    input2.setAttribute('id','kmlFileUpload2')
    input2.setAttribute('accept','.kml')
    span.appendChild(input2)

    addImagesAddCoordinates.appendChild(document.createElement('br'))

    $("#kmlFileUpload2").change( function() {
        if (document.getElementById("kmlFileUpload2").files.length > 0) {
            document.getElementById('kmlFileUploadText2').value = document.getElementById("kmlFileUpload2").files[0].name
        } else {
            document.getElementById('kmlFileUploadText2').value = ''
        }
    })
}

$("#addImagesAddImages").change( function() {
    /** Listens for and initialises the add images form on the edit survey modal when the radio button is selected. */

    addImagesAddImages = document.getElementById('addImagesAddImages')
    if (addImagesAddImages.checked) {

        addImagesAddCoordsDiv = document.getElementById('addImagesAddCoordsDiv')
        while(addImagesAddCoordsDiv.firstChild){
            addImagesAddCoordsDiv.removeChild(addImagesAddCoordsDiv.firstChild);
        }

        addImagesEditTimestampsDiv = document.getElementById('addImagesEditTimestampsDiv')
        while(addImagesEditTimestampsDiv.firstChild){
            addImagesEditTimestampsDiv.removeChild(addImagesEditTimestampsDiv.firstChild);
        }

        buildAddIms()
    }
})

$("#addImagesAddCoordinates").change( function() {
    /** Listens for and initialises the add kml file form on the edit survey modal when the radio button is selected. */

    addImagesAddCoordinates = document.getElementById('addImagesAddCoordinates')
    if (addImagesAddCoordinates.checked) {

        addImagesAddImsDiv = document.getElementById('addImagesAddImsDiv') 
        while(addImagesAddImsDiv.firstChild){
            addImagesAddImsDiv.removeChild(addImagesAddImsDiv.firstChild);
        }

        addImagesEditTimestampsDiv = document.getElementById('addImagesEditTimestampsDiv')
        while(addImagesEditTimestampsDiv.firstChild){
            addImagesEditTimestampsDiv.removeChild(addImagesEditTimestampsDiv.firstChild);
        }

        buildKml()
    }
})

$("#addImagesEditTimestamps").change( function() {
    /** Listens for and initialises the edit timestamps form on the edit survey modal when the radio button is selected. */

    addImagesEditTimestamps = document.getElementById('addImagesEditTimestamps')
    if (addImagesEditTimestamps.checked) {

        addImagesAddImsDiv = document.getElementById('addImagesAddImsDiv') 
        while(addImagesAddImsDiv.firstChild){
            addImagesAddImsDiv.removeChild(addImagesAddImsDiv.firstChild);
        }

        addImagesAddCoordsDiv = document.getElementById('addImagesAddCoordsDiv')
        while(addImagesAddCoordsDiv.firstChild){
            addImagesAddCoordsDiv.removeChild(addImagesAddCoordsDiv.firstChild);
        }

        buildEditTimestamp()
    }
})

$("#newSurveyCheckbox").change( function() {
    /** Listens for and warns the user when they select the adanced trapgroup code option. */

    newSurveyCheckbox = document.getElementById('newSurveyCheckbox')
    if (newSurveyCheckbox.checked) {
        document.getElementById('newSurveyErrors').innerHTML = 'Note that you are now required to enter a regular expression for your trapgroup code. It will be used to identify your unique camera-trap locations based on your folder structure.'
        buildTgBuilderRow()
    } else {
        document.getElementById('newSurveyErrors').innerHTML = ''

        // Clear TG Builder
        newSurveyTgBuilder = document.getElementById('newSurveyTgBuilder')
        while(newSurveyTgBuilder.firstChild){
            newSurveyTgBuilder.removeChild(newSurveyTgBuilder.firstChild);
        }      
    }
})

$("#S3BucketUpload").change( function() {
    /** Listens for and initialises the bucket upload form when the option is selected. */

    S3BucketUpload = document.getElementById('S3BucketUpload')
    if (S3BucketUpload.checked) {
        buildBucketUpload('newSurveyFormDiv')
    }
})

$("#BrowserUpload").change( function() {
    /** Listens for and initialises the browser upload form when the option is selected. */
    
    BrowserUpload = document.getElementById('BrowserUpload')
    if (BrowserUpload.checked) {
        buildBrowserUpload('newSurveyFormDiv')
    }
})

$("#kmlFileUpload").change( function() {
    /** Updates the file upload text area when a file is selected. */
    if (document.getElementById("kmlFileUpload").files.length > 0) {
        document.getElementById('kmlFileUploadText').value = document.getElementById("kmlFileUpload").files[0].name
    } else {
        document.getElementById('kmlFileUploadText').value = ''
    }
})

$("#kmlFileUpload2").change( function() {
    /** Updates the file upload text area when a file is selected. */
    if (document.getElementById("kmlFileUpload2").files.length > 0) {
        document.getElementById('kmlFileUploadText2').value = document.getElementById("kmlFileUpload2").files[0].name
    } else {
        document.getElementById('kmlFileUploadText2').value = ''
    }
})

btnReClassify.addEventListener('click', ()=>{
    /** Listener that initiates the re-classification of the selected surey when the button is pressed. */
    
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/reClassify/'+selectedSurvey);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply=='Success') {
                modalAddImages.modal('hide')
                updatePage(current_page)
            }
        }
    }
    xhttp.send();
});

btnNextSurveys.addEventListener('click', ()=>{
    /** Loads the next set of paginated surveys. */
    updatePage(next_url)
});

btnPrevSurveys.addEventListener('click', ()=>{
    /** Loads the previous set of paginated surveys. */
    updatePage(prev_url)
});

function buildStatusRow(info,tableRow,headings) {
    /** Builds a row for the detailed task status table */

    label = info.label
    data = info.data

    tableCol = document.createElement('th')
    tableCol.setAttribute('scope','row')
    tableCol.innerHTML = label
    tableRow.appendChild(tableCol)

    for (qq=0;qq<headings.length;qq++) {
        tableCol = document.createElement('td')
        if (headings[qq]=='checked_detections') {
            if (data['checked_perc']=='-') {
                tableCol.innerHTML = '-'
            } else {
                tableCol.innerHTML = data[headings[qq]]+' ('+data['checked_perc']+'%)'
            }
        } else if (headings[qq]=='deleted_detections') {
            if (data['deleted_perc']=='-') {
                tableCol.innerHTML = '-'
            } else {
                tableCol.innerHTML = data[headings[qq]]+' ('+data['deleted_perc']+'%)'
            }
        } else if (headings[qq]=='added_detections') {
            if (data['added_perc']=='-') {
                tableCol.innerHTML = '-'
            } else {
                tableCol.innerHTML = data[headings[qq]]+' ('+data['added_perc']+'%)'
            }
        } else if (headings[qq]=='default_accuracy') {
            if (data['default_accuracy']=='-') {
                tableCol.innerHTML = '-'
            } else {
                tableCol.innerHTML = data['default_accuracy']+'%'
            }
        } else {
            tableCol.innerHTML = data[headings[qq]]
        }
        tableCol.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
        tableRow.appendChild(tableCol)
    }
}

function changeRowVisibility(labels,init=false) {
    /** Iterates through the selected row and its children, changing their visibility as needed. */
    for (label in labels) {
        tableRow = document.getElementById('detailedStatusRow-'+label.toString())
        if (init) {
            if (tableRow.style.display == 'none') {
                tableRow.setAttribute('style','')
            } else {
                tableRow.setAttribute('style','display:none')
            }
        } else {
            tableRow.setAttribute('style','display:none')
        }
        changeRowVisibility(labels[label])
    }
}

function iterateRows(labels,targetRow) {
    /** Iterates through the detailed status rows and if it finds the target row, it changes that row's visibility */
    for (label in labels) {
        if (label==targetRow) {
            changeRowVisibility(labels[label],true)
            break
        }
        iterateRows(labels[label],targetRow)
    }
}

function iterateLabels(labels,headings,init=false) {
    /** Iterates through a nested object */
    for (label in labels) {
        tableRow = document.createElement('tr')
        tableRow.setAttribute('id','detailedStatusRow-'+label.toString())
        if (Object.keys(labels[label]).length!=0) {
            tableRow.setAttribute('class','table-matrix')
        }
        if (!init) {
            tableRow.setAttribute('style','display:none')
        }
        tbody.appendChild(tableRow)

        tableRow.addEventListener('click', function(wraplabel) {
            return function() {
                iterateRows(hierarchicalLabels,wraplabel)
            }
        }(label));

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/getDetailedTaskStatus/'+selectedTask+'?label='+label);
        xhttp.onreadystatechange =
        function(wrapTableRow){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  
                    if (modalStatus.is(':visible')) {
                        buildStatusRow(reply,wrapTableRow,headings)
                    }
                }
            }
        }(tableRow);
        xhttp.send();

        iterateLabels(labels[label],headings)
    }

    if ((Object.keys(labels).length%2!=0)&&(!init)) {
        tableRow = document.createElement('tr')
        tableRow.setAttribute('id','detailedStatusRow-'+label.toString())
        tbody.appendChild(tableRow)
    }
}

function buildStatusTable(labels) {
    /** Builds the status table with the given data object. */

    tableDiv = document.getElementById('StatusTableDiv')
    tableDiv.innerHTML = ''
    table = document.createElement('table')
    table.setAttribute('style','width:100%; table-layout:fixed')
    table.classList.add('table')
    table.classList.add('table-bordered')
    table.classList.add('table-matrix')
    tableDiv.appendChild(table)

    thead = document.createElement('thead')
    table.appendChild(thead)

    tableRow = document.createElement('tr')
    tableCol = document.createElement('th')
    tableCol.setAttribute('scope','col')
    tableCol.setAttribute('style','border-bottom: 1px solid white;width: 20%')
    tableRow.appendChild(tableCol)

    headings = ['Clusters','Images','Sightings','Checked Sightings','Deleted Sightings','Added Sightings','Default Sighting Accuracy','Tagged','Complete']
    for (qq=0;qq<headings.length;qq++) {
        tableCol = document.createElement('th')
        tableCol.setAttribute('scope','col')
        tableCol.setAttribute('style','border-bottom: 1px solid white')
        tableRow.appendChild(tableCol)

        thdiv = document.createElement('div')
        thdiv.innerHTML = headings[qq]
        tableCol.appendChild(thdiv)
    }
    thead.appendChild(tableRow)

    tbody = document.createElement('tbody')
    table.appendChild(tbody)

    headings = ['clusters','images','detections','checked_detections','deleted_detections','added_detections','default_accuracy','tagged','complete']
    iterateLabels(labels,headings,true)
}

modalStatus.on('shown.bs.modal', function(){
    /** Populates the status table modal when it is opened. */

    if (!helpReturn) {
        document.getElementById('StatusTableDiv').innerHTML = 'Loading... Please be patient.'
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/getDetailedTaskStatus/'+selectedTask+'?init=true');
        xhttp.onreadystatechange =
        function(wrapSelectedTask){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    hierarchicalLabels = JSON.parse(this.responseText);  
                    if (modalStatus.is(':visible')&&(selectedTask==wrapSelectedTask)) {
                        buildStatusTable(hierarchicalLabels)
                    }
                }
            }
        }(selectedTask);
        xhttp.send();
    } else {
        helpReturn = false
    }
});

modalStatus.on('hidden.bs.modal', function(){
    /** Clears the status table modal when it is close */

    if (!helpReturn) {
        StatusTableDiv = document.getElementById('StatusTableDiv')
        while(StatusTableDiv.firstChild){
            StatusTableDiv.removeChild(StatusTableDiv.firstChild);
        }
    }
});

modalNewSurvey.on('hidden.bs.modal', function(){
    /** Clears the new-survey modal when closed. */
    
    if ((!helpReturn)&&(!uploading)) {
        resetNewSurveyPage()
    } else {
        helpReturn = false
    }
});

modalAddImages.on('shown.bs.modal', function(){
    /** Initialises the edit-survey modal when opened. */

    if (!helpReturn) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getSurveyClassificationLevel/'+selectedSurvey);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);

                document.getElementById('classifierVersion').value = reply.classifier_version

                if (reply.update_available == 'true') {
                    document.getElementById('btnReClassify').disabled = false
                }
            }
        }
        xhttp.send();
    }
});

modalAddImages.on('hidden.bs.modal', function(){
    /** Clears the edit-survey modal when closed. */

    if ((!helpReturn)&&(!uploading)) {
        resetEditSurveyModal()
    } else {
        helpReturn = false
    }
});

function generate_url() {
    /** Generates the url based on the current order selection and search query */
    order = orderSelect.options[orderSelect.selectedIndex].value
    search = document.getElementById('surveySearch').value
    return '/getHomeSurveys?page=1&order='+order+'&search='+search.toString()
}

$('#orderSelect').change( function() {
    /** Listens for changes in the ordering of surveys and updates the page accordingly. */
    url = generate_url()
    updatePage(url)
});

$('#surveySearch').change( function() {
    /** Listens for changes in the survey search barr and updates the page accordingly. */
    url = generate_url()
    updatePage(url)
});

$('.modal').on("hidden.bs.modal", function (e) { 
    if ($('.modal:visible').length) { 
        $('body').addClass('modal-open');
    }
});