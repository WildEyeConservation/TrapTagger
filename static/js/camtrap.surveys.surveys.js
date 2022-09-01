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
var detailledStatusCount = 0
var next_camera_url = null
var prev_camera_url = null
var global_corrected_timestamps = {}

var s3 = null
var stopFlag = true
var files
var s3Setup = false
var surveyName
var uploading = false
const modalUploadProgress = $('#modalUploadProgress');

const modalNotification = $('#modalNotification');
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

var disabledSurveyStatuses = ['re-clustering','extracting labels','correcting timestamps','reclustering','removing duplicate images','importing coordinates','processing','uploading','deleting','launched','importing','removing humans','removing static detections','clustering','complete','cancelled','prepping task','classifying','calculating scores']
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

    entireRowHeading = document.createElement('div')
    entireRowHeading.classList.add('row');
    surveyDivHeading = document.createElement('div')
    surveyDivHeading.classList.add('col-lg-6');
    taskDivHeading = document.createElement('div')
    taskDivHeading.classList.add('col-lg-6');
    taskDivHeading.setAttribute('style',"padding-left: 10px; padding-top:15px; font-size: 110%")
    taskDivHeading.innerHTML = 'Annotation Sets:'
    entireRowHeading.appendChild(surveyDivHeading)
    entireRowHeading.appendChild(taskDivHeading)
    newSurveyDiv.appendChild(entireRowHeading)

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
    surveyDivHeading.appendChild(headingElement)

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

    infoElementRow2 = document.createElement('div')
    infoElementRow2.classList.add('row');
    infoElementRow2.classList.add('center');
    infoElementRow2.setAttribute('style',"margin-left: 10px")

    infoElementNumTrapgroups = document.createElement('div')
    infoElementNumTrapgroups.classList.add('col-lg-3');
    infoElementNumTrapgroups.setAttribute("style","font-size: 80%")
    infoElementNumTrapgroups.innerHTML = 'Sites: ' + survey.numTrapgroups
    infoElementRow.appendChild(infoElementNumTrapgroups)

    infoElementNumImages = document.createElement('div')
    infoElementNumImages.classList.add('col-lg-2');
    infoElementNumImages.setAttribute("style","font-size: 80%")
    infoElementNumImages.innerHTML = 'Images: ' + survey.numImages
    infoElementRow.appendChild(infoElementNumImages)

    infoElementDescription = document.createElement('div')
    infoElementDescription.classList.add('col-lg-3');
    infoElementDescription.setAttribute("style","font-size: 80%")
    infoElementDescription.innerHTML = 'Status: ' + survey.status
    infoElementRow2.appendChild(infoElementDescription)

    infoElementFiller = document.createElement('div')
    infoElementFiller.classList.add('col-lg-9');
    if (!['',' ','null','None',null].includes(survey.description)) {
        infoElementFiller.setAttribute("style","font-size: 80%")
        infoElementFiller.innerHTML = 'Description: ' + survey.description
    }
    infoElementRow2.appendChild(infoElementFiller)

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
    addTaskCol.classList.add('col-lg-3');
    addTaskBtn = document.createElement('button')
    addTaskBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
    addTaskBtn.setAttribute("id","addTaskBtn"+survey.id)
    addTaskBtn.innerHTML = 'Add Annotation Set'
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
    surveyDiv.appendChild(infoElementRow2)

    newSurveyDiv.appendChild(document.createElement('br'))
    surveyListDiv.appendChild(newSurveyDiv) 
}

function checkNotifications() {
    /**Checks for and displays new notifications.*/
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/checkNotifications');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  

            if (reply.status=='success') {
                document.getElementById('modalNotificationBody').innerHTML = reply.content
                modalNotification.modal({keyboard: true});
            }
        }
    }
    xhttp.send();
}

function onload(){
    /**Function for initialising the page on load.*/
    checkNotifications()
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

    // document.getElementById('kmlFileUploadText').value = ''
    // document.getElementById('kmlFileUpload').value = ''

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
    document.getElementById('addImagesAdvanced').checked = false
    document.getElementById('addImagesAddImages').disabled = false
    document.getElementById('addImagesAddCoordinates').disabled = false
    document.getElementById('addImagesEditTimestamps').disabled = false
    document.getElementById('addImagesAdvanced').disabled = false

    clearEditSurveyModal()
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
            S3FolderInput = document.getElementById('S3FolderInput')
            s3Folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
            if (s3Folder!='') {
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

            infoDiv.innerHTML = tgs.length.toString() + ' sites found: ' + tgs.toString()
        }
    } else if (folderChecked) {
        S3FolderInput = document.getElementById('S3FolderInput')
        folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
    
        if (((document.getElementById('newSurveyTGCode').value!='')||(document.getElementById('addImagesTGCode').value!=''))&&(folder!='')) {
            infoDiv.innerHTML = 'Checking...'
    
            var formData = new FormData()
            formData.append("tgCode", tgCode)
            formData.append("folder", folder)
            formData.append("task_id", 'none')
        
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    S3FolderInput = document.getElementById('S3FolderInput')
                    folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
                    if (folder!='') {
                        response = JSON.parse(this.responseText)
                        if (response.status == 'PENDING') {
                            tgCheckID = response.data
                            if (tgCheckTimer != null) {
                                clearInterval(tgCheckTimer)
                                tgCheckTimer = setInterval(pingTgCheck, 5000)
                            } else {
                                tgCheckTimer = setInterval(pingTgCheck, 5000)
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

function buildBucketUpload(divID,folders) {
    /** Builds the bucket image upload form into the specified div. */

    div = document.getElementById(divID)

    while(div.firstChild){
        div.removeChild(div.firstChild);
    }

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Folder Name'
    div.appendChild(h5)

    div2 = document.createElement('div')
    div2.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div2.innerHTML = '<i>Select the name of the folder of images you wish to import (after having uploaded it to the cloud using <a href="https://cyberduck.io/">CyberDuck</a> - see the help file for instructions).</i>'
    div.appendChild(div2)

    row = document.createElement('div')
    row.classList.add('row')
    div.append(row)

    col = document.createElement('div')
    col.classList.add('col-lg-4')
    row.appendChild(col)

    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','S3FolderInput')
    col.appendChild(select)

    fillSelect(select, folders, [...Array(folders.length).keys()])

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
    label.innerHTML = 'Bucket Upload (Recommended)'
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
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getFolders');
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  
                    buildBucketUpload('addImagesFormDiv',reply)
                }
            }
            xhttp.send();
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
    h5.innerHTML = 'Site Identifier'
    addImagesAddImsDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>The identifier used to designate a site in your folder structure. Eg. "Site" if your sites are stored in folders named "Site1", "Site2" etc. Becomes a <a href="https://www.w3schools.com/python/python_regex.asp">regular expression</a> search query if the advanced option is selected.</i>'
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
    label.innerHTML = 'Advanced'
    checkDiv.appendChild(label)

    tgBuilder = document.createElement('div')
    tgBuilder.setAttribute('id','addImagesTgBuilder')
    addImagesAddImsDiv.appendChild(tgBuilder)

    addImagesAddImsDiv.appendChild(document.createElement('br'))

    $("#addImagesCheckbox").change( function() {
        addImagesCheckbox = document.getElementById('addImagesCheckbox')
        if (addImagesCheckbox.checked) {
            document.getElementById('addImagesErrors').innerHTML = 'Note that you are now required to enter a regular expression for your site identifier. It will be used to identify your sites based on your folder structure.'
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

function buildCameras(camera_url='/getCameraStamps') {
    /** Updates the timestamp editor based on the current page */

    if (camera_url=='/getCameraStamps') {
        camera_url += '?survey_id='+selectedSurvey
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", camera_url);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            if ((reply.survey==selectedSurvey)&&(modalAddImages.is(':visible'))) {
                if (reply.next_url==null) {
                    btnNextCameras.style.visibility = 'hidden'
                } else {
                    btnNextCameras.style.visibility = 'visible'
                    next_camera_url = reply.next_url
                }
    
                if (reply.prev_url==null) {
                    btnPrevCameras.style.visibility = 'hidden'
                } else {
                    btnPrevCameras.style.visibility = 'visible'
                    prev_camera_url = reply.prev_url
                }

                reply = reply.data

                addImagesCamerasDiv = document.getElementById('addImagesCamerasDiv')

                while(addImagesCamerasDiv.firstChild){
                    addImagesCamerasDiv.removeChild(addImagesCamerasDiv.firstChild);
                }
    
                document.getElementById('addImagesAddImages').disabled = false
                document.getElementById('addImagesAddCoordinates').disabled = false
                document.getElementById('addImagesEditTimestamps').disabled = false
                document.getElementById('addImagesAdvanced').disabled = false
                addImagesCamerasDiv.appendChild(document.createElement('br'))
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Edit Timestamps'
                addImagesCamerasDiv.appendChild(h5)
            
                div = document.createElement('div')
                div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                div.innerHTML = '<i>Here you can view and edit the timestamps of the fist image taken by each camera in the selected survey. All images taken by an edited camera will be shifted by the same amount.</i>'
                addImagesCamerasDiv.appendChild(div)

                errors = document.createElement('div')
                errors.setAttribute('id','timestampErrors')
                errors.setAttribute('style','font-size: 80%; color: #DF691A')
                addImagesCamerasDiv.appendChild(errors)
            
                addImagesCamerasDiv.appendChild(document.createElement('br'))
            
                row = document.createElement('div')
                row.classList.add('row')
                addImagesCamerasDiv.appendChild(row)
            
                col = document.createElement('div')
                col.classList.add('col-lg-6')
                row.appendChild(col)
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Camera'
                col.appendChild(h5)
            
                col = document.createElement('div')
                col.classList.add('col-lg-3')
                row.appendChild(col)
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Original'
                col.appendChild(h5)
            
                col = document.createElement('div')
                col.classList.add('col-lg-3')
                row.appendChild(col)
            
                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Corrected'
                col.appendChild(h5)
            
                for (trapgroup=0;trapgroup<reply.length;trapgroup++) {
                    h5 = document.createElement('h5')
                    h5.setAttribute('style','margin-bottom: 2px')
                    h5.innerHTML = reply[trapgroup].tag
                    addImagesCamerasDiv.appendChild(h5)
    
                    for (camera=0;camera<reply[trapgroup].cameras.length;camera++) {
                        row = document.createElement('div')
                        row.setAttribute('class','row center')
                        addImagesCamerasDiv.appendChild(row)
                    
                        col = document.createElement('div')
                        col.classList.add('col-lg-6')
                        col.innerHTML = reply[trapgroup].cameras[camera].folder
                        row.appendChild(col)
    
                        col = document.createElement('div')
                        col.classList.add('col-lg-3')
                        // col.setAttribute('id','original_timestamp-'+reply[trapgroup].cameras[camera].id)
                        col.innerHTML = reply[trapgroup].cameras[camera].timestamp
                        row.appendChild(col)
    
                        // input = document.createElement('input')
                        // input.setAttribute('type','text')
                        // input.classList.add('form-control')
                        // input.value = reply[trapgroup].cameras[camera].timestamp
                        // input.disabled = true
                        // col.appendChild(input)
    
                        col = document.createElement('div')
                        col.classList.add('col-lg-3')
                        row.appendChild(col)
    
                        input = document.createElement('input')
                        input.setAttribute('type','text')
                        input.classList.add('form-control')
                        if (reply[trapgroup].cameras[camera].id in global_corrected_timestamps) {
                            input.value = global_corrected_timestamps[reply[trapgroup].cameras[camera].id]
                        } else {
                            input.value = reply[trapgroup].cameras[camera].corrected_timestamp
                        }
                        input.setAttribute('id','corrected_timestamp-'+reply[trapgroup].cameras[camera].id.toString())
                        col.appendChild(input)

                        $('#corrected_timestamp-'+reply[trapgroup].cameras[camera].id.toString()).change( function(wrapID) {
                            return function() {
                                corrected_timestamp = document.getElementById('corrected_timestamp-'+wrapID.toString())
                                if (isValidDate(new Date(corrected_timestamp.value))) {
                                    document.getElementById('timestampErrors').innerHTML = ''
                                    global_corrected_timestamps[wrapID] = corrected_timestamp.value
                                } else {
                                    document.getElementById('timestampErrors').innerHTML = 'There are one or more invalid dates.'
                                    delete global_corrected_timestamps[wrapID]
                                }
                            }
                        }(reply[trapgroup].cameras[camera].id));
                    }
    
                    addImagesCamerasDiv.appendChild(document.createElement('br'))
                }
            }
        }
    }
    xhttp.send();
}

function buildEditTimestamp() {
    /** Builds the form for editing timestamps on the edit survey modal. */
    
    document.getElementById('addImagesAddImages').disabled = true
    document.getElementById('addImagesAddCoordinates').disabled = true
    document.getElementById('addImagesEditTimestamps').disabled = true
    document.getElementById('addImagesAdvanced').disabled = true

    global_corrected_timestamps = {}

    addImagesEditTimestampsDiv = document.getElementById('addImagesEditTimestampsDiv')

    div = document.createElement('div')
    div.setAttribute('id','addImagesCamerasDiv')
    addImagesEditTimestampsDiv.appendChild(div)

    row = document.createElement('div')
    row.classList.add('row')
    addImagesEditTimestampsDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    btnPrevCameras = document.createElement('button')
    btnPrevCameras.setAttribute("class","btn btn-primary btn-block")
    btnPrevCameras.setAttribute("id","btnPrevCameras")
    btnPrevCameras.innerHTML = 'Previous'
    col1.appendChild(btnPrevCameras)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-8')
    row.appendChild(col2)

    col5 = document.createElement('div')
    col5.classList.add('col-lg-2')
    row.appendChild(col5)

    btnNextCameras = document.createElement('button')
    btnNextCameras.setAttribute("class","btn btn-primary btn-block")
    btnNextCameras.setAttribute("id","btnNextCameras")
    btnNextCameras.innerHTML = 'Next'
    col5.appendChild(btnNextCameras)

    btnNextCameras.addEventListener('click', ()=>{
        buildCameras(next_camera_url)
    });
    
    btnPrevCameras.addEventListener('click', ()=>{
        buildCameras(prev_camera_url)
    });
    
    buildCameras()
}

function buildKml() {
    /** Builds the kml upload functionality in the edit survey modal. */
    
    addImagesAddCoordinates = document.getElementById('addImsCoordsDiv')
    addImagesAddCoordinates.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Site Coordinates'
    addImagesAddCoordinates.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Upload a kml file containing your site coordinates. This can be exported from <a href="https://earth.google.com/web/">Google Earth</a>.</i>'
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
        clearEditSurveyModal()
        buildAddIms()
    }
})

function buildManualCoords() {
    /** Build the manual coords editor */
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getTrapgroupCoords/'+selectedSurvey);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            
            addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
            addImsCoordsDiv.appendChild(document.createElement('br'))
            
            headingRow = document.createElement('div')
            headingRow.setAttribute('class','row')
            addImsCoordsDiv.appendChild(headingRow)

            headingCol = document.createElement('div')
            headingCol.setAttribute('class','col-lg-3')
            headingCol.innerHTML = 'Site'
            headingRow.appendChild(headingCol)

            headingCol = document.createElement('div')
            headingCol.setAttribute('class','col-lg-3')
            headingCol.innerHTML = 'Latitude'
            headingRow.appendChild(headingCol)

            headingCol = document.createElement('div')
            headingCol.setAttribute('class','col-lg-3')
            headingCol.innerHTML = 'Longitude'
            headingRow.appendChild(headingCol)
            
            headingCol = document.createElement('div')
            headingCol.setAttribute('class','col-lg-3')
            headingCol.innerHTML = 'Altitude'
            headingRow.appendChild(headingCol)            

            for (tg=0;tg<reply.length;tg++) {
                trapgroup = reply[tg]

                row = document.createElement('div')
                row.setAttribute('class','row')
                addImsCoordsDiv.appendChild(row)
    
                col1 = document.createElement('div')
                col1.setAttribute('class','col-lg-3')
                col1.innerHTML = trapgroup.tag
                row.appendChild(col1)

                col2 = document.createElement('div')
                col2.setAttribute('class','col-lg-3')
                row.appendChild(col2)

                input1 = document.createElement('input')
                input1.setAttribute('type','text')
                input1.setAttribute('class','form-control')
                input1.setAttribute('id','latitude-'+trapgroup.tag)
                input1.value = trapgroup.latitude
                col2.appendChild(input1)

                col3 = document.createElement('div')
                col3.setAttribute('class','col-lg-3')
                row.appendChild(col3)

                input2 = document.createElement('input')
                input2.setAttribute('type','text')
                input2.setAttribute('class','form-control')
                input2.setAttribute('id','longitude-'+trapgroup.tag)
                input2.value = trapgroup.longitude
                col3.appendChild(input2)

                col4 = document.createElement('div')
                col4.setAttribute('class','col-lg-3')
                row.appendChild(col4)

                input3 = document.createElement('input')
                input3.setAttribute('type','text')
                input3.setAttribute('class','form-control')
                input3.setAttribute('id','altitude-'+trapgroup.tag)
                input3.value = trapgroup.altitude
                col4.appendChild(input3)
            }
        }
    }
    xhttp.send();
}

function buildCoordsOptions() {
    /** Builds the selector to selct between kml upload and manual. */

    addImagesAddCoordsDiv = document.getElementById('addImagesAddCoordsDiv')
    while(addImagesAddCoordsDiv.firstChild){
        addImagesAddCoordsDiv.removeChild(addImagesAddCoordsDiv.firstChild);
    }

    addImagesAddCoordsDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Method'
    addImagesAddCoordsDiv.appendChild(h5)

    infoDiv = document.createElement('div')
    infoDiv.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    infoDiv.innerHTML = '<i>Select how you would like to edit your site coordinates.</i>'
    addImagesAddCoordsDiv.appendChild(infoDiv)

    optionDiv = document.createElement('div')
    optionDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    addImagesAddCoordsDiv.appendChild(optionDiv)
    
    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','addCoordinatesKMLMethod')
    input.setAttribute('name','coordsMethodSelection')
    input.setAttribute('value','customEx')
    optionDiv.appendChild(input)

    label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','addCoordinatesKMLMethod')
    label.innerHTML = 'File upload'
    optionDiv.appendChild(label)

    $("#addCoordinatesKMLMethod").change( function() {
        if (document.getElementById('addCoordinatesKMLMethod').checked) {
            addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
            while(addImsCoordsDiv.firstChild){
                addImsCoordsDiv.removeChild(addImsCoordsDiv.firstChild);
            }
            buildKml()
        }
    })

    optionDiv = document.createElement('div')
    optionDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    addImagesAddCoordsDiv.appendChild(optionDiv)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','addCoordinatesManualMethod')
    input.setAttribute('name','coordsMethodSelection')
    input.setAttribute('value','customEx')
    optionDiv.appendChild(input)

    label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','addCoordinatesManualMethod')
    label.innerHTML = 'Manual'
    optionDiv.appendChild(label)

    $("#addCoordinatesManualMethod").change( function() {
        if (document.getElementById('addCoordinatesManualMethod').checked) {
            addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
            while(addImsCoordsDiv.firstChild){
                addImsCoordsDiv.removeChild(addImsCoordsDiv.firstChild);
            }
            buildManualCoords()
        }
    })

    addImsCoordsDiv = document.createElement('div')
    addImsCoordsDiv.setAttribute('id','addImsCoordsDiv')
    addImagesAddCoordsDiv.appendChild(addImsCoordsDiv)
}

function clearEditSurveyModal() {
    /** Clears the edit survey modal */
    
    addImagesAddImsDiv = document.getElementById('addImagesAddImsDiv') 
    while(addImagesAddImsDiv.firstChild){
        addImagesAddImsDiv.removeChild(addImagesAddImsDiv.firstChild);
    }

    addImagesEditTimestampsDiv = document.getElementById('addImagesEditTimestampsDiv')
    while(addImagesEditTimestampsDiv.firstChild){
        addImagesEditTimestampsDiv.removeChild(addImagesEditTimestampsDiv.firstChild);
    }

    addImagesAddCoordsDiv = document.getElementById('addImagesAddCoordsDiv')
    while(addImagesAddCoordsDiv.firstChild){
        addImagesAddCoordsDiv.removeChild(addImagesAddCoordsDiv.firstChild);
    }

    addImagesAdvancedDiv = document.getElementById('addImagesAdvancedDiv')
    while(addImagesAdvancedDiv.firstChild){
        addImagesAdvancedDiv.removeChild(addImagesAdvancedDiv.firstChild);
    }
}

function buildAdvancedOptions() {
    /** Builds the advanced options for the edit survey modal. */

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getAdvancedOptions/'+selectedSurvey);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            
            addImagesAdvancedDiv = document.getElementById('addImagesAdvancedDiv')
            addImagesAdvancedDiv.appendChild(document.createElement('br'))

            row = document.createElement('div')
            row.setAttribute('class','row')
            addImagesAdvancedDiv.appendChild(row)

            h5 = document.createElement('h5')
            h5.setAttribute('style','padding-top: 16px; padding-left: 15px; padding-right: 10px; margin-bottom: 2px')
            h5.innerHTML = 'Ignore Small Detections'
            row.appendChild(h5)

            div = document.createElement('div')
            div.setAttribute('class','custom-control custom-checkbox')
            row.appendChild(div)

            input = document.createElement('input')
            input.setAttribute('type','checkbox')
            input.classList.add('custom-control-input')
            input.setAttribute('id','smallDetectionsCheckbox')
            input.setAttribute('name','smallDetectionsCheckbox')
            div.appendChild(input)

            if (reply.smallDetections=='True') {
                input.checked = true
            }
        
            label = document.createElement('label')
            label.classList.add('custom-control-label')
            label.setAttribute('for','smallDetectionsCheckbox')
            // label.innerHTML = 'Ignore Small Detections'
            div.appendChild(label)
        
            div = document.createElement('div')
            div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            div.innerHTML = '<i>Filters out triggers from small animals like birds. Improves system performance for waterhole cameras in exchange for some reduced recall.</i>'
            addImagesAdvancedDiv.appendChild(div)

            addImagesAdvancedDiv.appendChild(document.createElement('br'))

            row = document.createElement('div')
            row.setAttribute('class','row')
            addImagesAdvancedDiv.appendChild(row)

            h5 = document.createElement('h5')
            h5.setAttribute('style','padding-top: 16px; padding-left: 15px; padding-right: 10px; margin-bottom: 2px')
            h5.innerHTML = 'Mask Sky Detections'
            row.appendChild(h5)

            div = document.createElement('div')
            div.setAttribute('class','custom-control custom-checkbox')
            row.appendChild(div)

            input = document.createElement('input')
            input.setAttribute('type','checkbox')
            input.classList.add('custom-control-input')
            input.setAttribute('id','skyMaskCheckbox')
            input.setAttribute('name','skyMaskCheckbox')
            div.appendChild(input)

            if (reply.skyMask=='True') {
                input.checked = true
            }
        
            label = document.createElement('label')
            label.classList.add('custom-control-label')
            label.setAttribute('for','skyMaskCheckbox')
            // label.innerHTML = 'Mask Sky Detections'
            div.appendChild(label)
        
            div = document.createElement('div')
            div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
            div.innerHTML = '<i>Ignores detections where the bottom occurs in the top third of the image - useful for ignoring triggers from birds. Improves system performance for waterhole cameras in exchange for some reduced recall.</i>'
            addImagesAdvancedDiv.appendChild(div)
        }
    }
    xhttp.send();
}

$("#addImagesAddCoordinates").change( function() {
    /** Listens for and initialises the add kml file form on the edit survey modal when the radio button is selected. */

    addImagesAddCoordinates = document.getElementById('addImagesAddCoordinates')
    if (addImagesAddCoordinates.checked) {
        clearEditSurveyModal()
        buildCoordsOptions()
    }
})

$("#addImagesAdvanced").change( function() {
    /** Listens for and initialises the advanced options form on the edit survey modal when the radio button is selected. */

    addImagesAdvanced = document.getElementById('addImagesAdvanced')
    if (addImagesAdvanced.checked) {
        clearEditSurveyModal()
        buildAdvancedOptions()
    }
})

$("#addImagesEditTimestamps").change( function() {
    /** Listens for and initialises the edit timestamps form on the edit survey modal when the radio button is selected. */

    addImagesEditTimestamps = document.getElementById('addImagesEditTimestamps')
    if (addImagesEditTimestamps.checked) {
        clearEditSurveyModal()
        buildEditTimestamp()
    }
})

$("#newSurveyCheckbox").change( function() {
    /** Listens for and warns the user when they select the adanced trapgroup code option. */

    newSurveyCheckbox = document.getElementById('newSurveyCheckbox')
    if (newSurveyCheckbox.checked) {
        document.getElementById('newSurveyErrors').innerHTML = 'Note that you are now required to enter a regular expression for your site identifier. It will be used to identify your sites based on your folder structure.'
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
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getFolders');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                buildBucketUpload('newSurveyFormDiv',reply)
            }
        }
        xhttp.send();
    }
})

$("#BrowserUpload").change( function() {
    /** Listens for and initialises the browser upload form when the option is selected. */
    
    BrowserUpload = document.getElementById('BrowserUpload')
    if (BrowserUpload.checked) {
        buildBrowserUpload('newSurveyFormDiv')
    }
})

// $("#kmlFileUpload").change( function() {
//     /** Updates the file upload text area when a file is selected. */
//     if (document.getElementById("kmlFileUpload").files.length > 0) {
//         document.getElementById('kmlFileUploadText').value = document.getElementById("kmlFileUpload").files[0].name
//     } else {
//         document.getElementById('kmlFileUploadText').value = ''
//     }
// })

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

    tableCol = document.createElement('th')
    tableCol.setAttribute('scope','row')
    tableCol.innerHTML = label
    tableRow.appendChild(tableCol)

    for (heading in headings) {
        for (qq=0;qq<headings[heading].length;qq++) {
            heading2 = headings[heading][qq]
            tableCol = document.createElement('td')
            tableCol.innerHTML = info[heading][heading2]
            tableCol.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
            tableRow.appendChild(tableCol)
        }
    }
}

function changeRowVisibility(labels,init=false,multi=false,rootLabel=null) {
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
    
    if (init && multi) {
        br1 = document.getElementById('statusTableBr1-'+rootLabel.toString())
        br2 = document.getElementById('statusTableBr2-'+rootLabel.toString())
        if (br1!=null) {
            br1.remove()
            br2.remove()
            tableRow = document.getElementById('detailedStatusRow-'+rootLabel.toString())
            tableRow.setAttribute('style','')
        } else {
            br = document.createElement('br')
            br.setAttribute('id','statusTableBr2-'+rootLabel.toString())
            tableRow.parentElement.insertBefore(br,tableRow.nextElementSibling)

            tableRow = document.getElementById('detailedStatusRow-'+rootLabel.toString())
            br = document.createElement('br')
            br.setAttribute('id','statusTableBr1-'+rootLabel.toString())
            tableRow.parentElement.insertBefore(br,tableRow)
            tableRow.setAttribute('style','background-color: rgba(255,255,255,0.4); color: rgba(0,0,0,0.8)')
        }
    }
}

function iterateRows(labels,targetRow) {
    /** Iterates through the detailed status rows and if it finds the target row, it changes that row's visibility */
    for (label in labels) {
        if (label==targetRow) {
            if (Object.keys(labels[label]).length!=0) {
                multi = true
            } else {
                multi = false
            }
            changeRowVisibility(labels[label],true,multi,label)
            break
        }
        iterateRows(labels[label],targetRow)
    }
}

function iterateLabels(labels,headings,init=false) {
    /** Iterates through a nested labels object and builds the detailled status table. */

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
                    if (reply.status=='success') {
                        if (modalStatus.is(':visible')) {
                            buildStatusRow(reply,wrapTableRow,headings)
                            detailledStatusCount -= 1
                            if (detailledStatusCount<=0) {
                                document.getElementById('detailledStatusPleaseWait').remove()
                            }
                        }
                    } else {
                        document.getElementById('detailledStatusPleaseWait').innerHTML = reply.message
                    }
                }
            }
        }(tableRow);
        xhttp.send();
        detailledStatusCount += 1

        iterateLabels(labels[label],headings)
    }

    if ((Object.keys(labels).length%2!=0)&&(!init)) {
        tableRow = document.createElement('tr')
        tableRow.setAttribute('id','detailedStatusRow-'+label.toString())
        tableRow.setAttribute('style','display:none')
        tbody.appendChild(tableRow)
    }
}

function buildStatusTable(labels,headings) {
    /** Builds the status table with the given data object. */

    tableDiv = document.getElementById('StatusTableDiv')
    table = document.createElement('table')
    table.setAttribute('style','width:100%; table-layout:fixed')
    table.classList.add('table')
    table.classList.add('table-bordered')
    tableDiv.appendChild(table)

    thead = document.createElement('thead')
    table.appendChild(thead)

    //Top row headings
    tableRow = document.createElement('tr')
    tableCol = document.createElement('th')
    tableCol.setAttribute('scope','col')
    tableCol.setAttribute('style','border-bottom: 1px solid white;width: 20%')
    tableRow.appendChild(tableCol)

    for (heading in headings) {
        tableCol = document.createElement('th')
        tableCol.setAttribute('scope','col')
        tableCol.setAttribute('style','border-bottom: 1px solid white')
        tableCol.setAttribute('colspan',headings[heading].length)
        tableRow.appendChild(tableCol)

        thdiv = document.createElement('div')
        thdiv.innerHTML = heading
        tableCol.appendChild(thdiv)
    }
    thead.appendChild(tableRow)

    //bottom row headings
    tableRow = document.createElement('tr')
    tableRow.setAttribute('class','stripe')
    tableCol = document.createElement('th')
    tableCol.setAttribute('scope','col')
    tableCol.setAttribute('style','border-bottom: 1px solid white;width: 20%')
    tableCol.innerHTML = 'Label'
    tableRow.appendChild(tableCol)

    for (heading in headings) {
        for (hi=0;hi<headings[heading].length;hi++) {
            tableCol = document.createElement('th')
            tableCol.setAttribute('scope','col')
            tableCol.setAttribute('style','border-bottom: 1px solid white')
            tableRow.appendChild(tableCol)
    
            thdiv = document.createElement('div')
            thdiv.innerHTML = headings[heading][hi]
            tableCol.appendChild(thdiv)
        }
    }
    thead.appendChild(tableRow)

    tbody = document.createElement('tbody')
    tbody.setAttribute('class','table-matrix stripe')
    table.appendChild(tbody)

    iterateLabels(labels,headings,true)
}

modalStatus.on('shown.bs.modal', function(){
    /** Populates the status table modal when it is opened. */

    if (!helpReturn) {
        StatusTableDiv = document.getElementById('StatusTableDiv')
        while(StatusTableDiv.firstChild){
            StatusTableDiv.removeChild(StatusTableDiv.firstChild);
        }

        div = document.createElement('p')
        div.innerHTML = 'Loading... Please be patient.'
        div.setAttribute('id','detailledStatusPleaseWait')
        StatusTableDiv.appendChild(div)

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/getDetailedTaskStatus/'+selectedTask+'?init=true');
        xhttp.onreadystatechange =
        function(wrapSelectedTask){
            return function() {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    if (reply.status=='success') {
                        hierarchicalLabels = reply.labels
                        headings = reply.headings
                        if (modalStatus.is(':visible')&&(selectedTask==wrapSelectedTask)) {
                            detailledStatusCount = 0
                            buildStatusTable(hierarchicalLabels,headings)
                        }
                    } else {
                        document.getElementById('detailledStatusPleaseWait').innerHTML = reply.message
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
        document.getElementById('btnSaveSurvey').disabled=false
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
        document.getElementById('btnAddImages').disabled = false
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

function uploadSurveyToCloud(surveyName) {
    stopFlag=false
    inputFiles = document.getElementById('inputFile')
    if (inputFiles.files.length>0) {
        uploadImageToCloud(0,surveyName,1)
    }
}

function updateUploadProgress(value,total) {
    progBar = document.getElementById('uploadProgBar')
    perc=(value/total)*100
    remaining = total-value

    progBar.setAttribute('aria-valuenow',value)
    progBar.setAttribute('style',"width:"+perc+"%")
    progBar.innerHTML = remaining + " images remaining."
}

function uploadImageToCloud(fileIndex,surveyName,attempts) {

    var formData = new FormData()
    formData.append("image", document.getElementById('inputFile').files[fileIndex])
    formData.append("surveyName", surveyName)

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/uploadImageToCloud');
    xhttp.onreadystatechange =
    function(wrapFileIndex,wrapSurveyName,wrapAttempts){
        return function() {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText)
                if (stopFlag) {
                    var xhttp = new XMLHttpRequest();
                    xhttp.open("GET", '/deleteImages/'+surveyName);
                    xhttp.send();
                } else if ((reply.status!='success') && (wrapAttempts<5)) {
                    uploadImageToCloud(wrapFileIndex,wrapSurveyName,wrapAttempts+1)
                } else if (wrapFileIndex < document.getElementById('inputFile').files.length-1) {
                    updateUploadProgress(wrapFileIndex+1,document.getElementById('inputFile').files.length)
                    uploadImageToCloud(wrapFileIndex+1,wrapSurveyName,1)
                } else {
                    // DONE! Close modals etc.
                    var xhttp = new XMLHttpRequest();
                    xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/Complete');
                    xhttp.send();
                    modalUploadProgress.modal('hide')
                    document.getElementById('modalAlertHeader').innerHTML = 'Success'
                    document.getElementById('modalAlertBody').innerHTML = 'All images uploaded successfully.'
                    modalAlert.modal({keyboard: true});
                }
            }
        }
    }(fileIndex,surveyName,attempts)
    xhttp.send(formData);
}

document.getElementById('btnSaveSurvey').addEventListener('click', ()=>{
    /** 
     * Event listener on the new survey modal's submit button. Retries the info and submits it to the server. Also checks 
     * the format of kml files.
    */

    surveyName = document.getElementById('newSurveyName').value
    newSurveyDescription = document.getElementById('newSurveyDescription').value
    newSurveyTGCode = document.getElementById('newSurveyTGCode').value
    newSurveyCheckbox = document.getElementById('newSurveyCheckbox')

    while(document.getElementById('newSurveyErrors').firstChild){
        document.getElementById('newSurveyErrors').removeChild(document.getElementById('newSurveyErrors').firstChild);
    }

    if (newSurveyDescription == '') {
        newSurveyDescription = 'None'
    }

    legalName = true
    if (surveyName == '') {
        legalName = false
        document.getElementById('newSurveyErrors').innerHTML = 'The name field cannot be empty.'
    } else if ((surveyName.includes('/'))||(surveyName.includes('\\'))) {
        legalName = false
        document.getElementById('newSurveyErrors').innerHTML = 'The survey name cannot contain slashes.'
    }

    legalDescription = true
    if ((newSurveyDescription.includes('/'))||(newSurveyDescription.includes('\\'))) {
        legalDescription = false
        document.getElementById('newSurveyErrors').innerHTML = 'The survey description cannot contain slashes.'
    }

    legalTGCode = true
    if (newSurveyTGCode == '') {
        legalTGCode = false
        document.getElementById('newSurveyErrors').innerHTML = 'The site identifier field cannot be empty.'
    } else if ((newSurveyTGCode.includes('/'))||(newSurveyTGCode.includes('\\'))) {
        legalTGCode = false
        document.getElementById('newSurveyErrors').innerHTML = 'The site identifier code cannot contain slashes.'
    }
    
    legalInput = false
    if (document.getElementById('S3BucketUpload').checked == true) {
        S3FolderInput = document.getElementById('S3FolderInput')
        newSurveyS3Folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
        if (newSurveyS3Folder=='') {
            document.getElementById('newSurveyErrors').innerHTML = 'The folder name field cannot be empty.'
        } else if (newSurveyS3Folder.toLowerCase()=='none') {
            document.getElementById('newSurveyErrors').innerHTML = 'The folder cannot be called "none".'
        } else if ((newSurveyS3Folder.includes('/'))||(newSurveyS3Folder.includes('\\'))) {
            document.getElementById('newSurveyErrors').innerHTML = 'The folder name cannot contain slashes.'
        } else {
            legalInput = true
        }
    } else if (document.getElementById('BrowserUpload').checked == true) {
        inputFile = document.getElementById('inputFile')
        if (inputFile.files.length == 0) {
            document.getElementById('newSurveyErrors').innerHTML = 'You must select images to upload.'
        } else {
            legalInput = true
            newSurveyS3Folder = 'none'
            files = inputFile.files
        }
    } else {
        document.getElementById('newSurveyErrors').innerHTML = 'You must select an image upload method.'
    }

    TGCheckReady = true
    tgInfoDiv = document.getElementById('newSurveyTGInfo')
    if ((tgInfoDiv!=null)&&(tgInfoDiv.innerHTML=='Checking...')) {
        TGCheckReady = false
        document.getElementById('newSurveyErrors').innerHTML = 'Please wait for your site-identifier check to finish.'
    }

    if ((tgInfoDiv!=null)&&(tgInfoDiv.innerHTML == '0 sites found: ')) {
        legalTGCode = false
        document.getElementById('newSurveyErrors').innerHTML = 'Your specified site identifier has not detected any sites. Please try again.'
    }

    if (legalName&&legalDescription&&legalTGCode&&legalInput&&TGCheckReady) {
        document.getElementById('btnSaveSurvey').disabled = true
        if (false) {
            var reader = new FileReader()
            reader.addEventListener('load', (event) => {
                kmldata = event.target.result
                if (newSurveyCheckbox.checked==true) {
                    regex = newSurveyTGCode
                } else {
                    regex = newSurveyTGCode + '[0-9]+'
                }                        
                if ((newSurveyCheckbox||kmldata.match(regex))&&(kmldata.includes('Placemark'))&&(kmldata.includes('Point'))) {
                    var formData = new FormData()
                    formData.append("kml", kmlFileUpload.files[0])
                    submitNewSurvey(formData,surveyName,newSurveyDescription,newSurveyTGCode,newSurveyS3Folder,newSurveyCheckbox.checked.toString(),'false')
                } else {
                    document.getElementById('newSurveyErrors').innerHTML = 'There is an error in the format of your .kml file.'
                    document.getElementById('btnSaveSurvey').disabled = false
                }
            });
            reader.readAsText(kmlFileUpload.files[0])
        } else {
            var formData = new FormData()
            submitNewSurvey(formData,surveyName,newSurveyDescription,newSurveyTGCode,newSurveyS3Folder,newSurveyCheckbox.checked.toString(),'false')
        }
    }
});

function submitNewSurvey(formData,surveyName,newSurveyDescription,newSurveyTGCode,newSurveyS3Folder,newSurveyCheckbox,correctTimestamps) {
    /** Submits the new survey info to the server. Begins the browser uploaded if necessary. */
    
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/createNewSurvey/'+surveyName+'/'+newSurveyDescription+'/'+newSurveyTGCode+'/'+newSurveyS3Folder+'/'+newSurveyCheckbox+'/'+correctTimestamps);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  

            if (reply.status=='success') {

                if (document.getElementById('BrowserUpload').checked == true) {
                    uploading = true
                    ProgBarDiv = document.getElementById('uploadProgBarDiv')

                    while(ProgBarDiv.firstChild){
                        ProgBarDiv.removeChild(ProgBarDiv.firstChild);
                    }

                    var newProg = document.createElement('div');
                    newProg.classList.add('progress');

                    var newProgInner = document.createElement('div');
                    newProgInner.classList.add('progress-bar');
                    newProgInner.classList.add('progress-bar-striped');
                    newProgInner.classList.add('active');
                    newProgInner.setAttribute("role", "progressbar");
                    newProgInner.setAttribute("id", "uploadProgBar");
                    newProgInner.setAttribute("aria-valuenow", "0");
                    newProgInner.setAttribute("aria-valuemin", "0");
                    newProgInner.setAttribute("aria-valuemax", files.length.toString());
                    newProgInner.setAttribute("style", "width:0%");

                    newProg.appendChild(newProgInner);
                    ProgBarDiv.appendChild(newProg);

                    modalNewSurvey.modal('hide')
                    modalUploadProgress.modal({backdrop: 'static', keyboard: false});

                    uploadSurveyToCloud(surveyName)
                } else {
                    document.getElementById('modalAlertHeader').innerHTML = 'Success'
                    document.getElementById('modalAlertBody').innerHTML = 'Your survey is being imported.'
                    alertReload = true
                    modalNewSurvey.modal('hide')
                    modalAlert.modal({keyboard: true});
                }

            } else {
                document.getElementById('newSurveyErrors').innerHTML = reply.message
                document.getElementById('btnSaveSurvey').disabled = false
            }
        }
    }
    xhttp.send(formData);
}

document.getElementById('btnAddImages').addEventListener('click', ()=>{
    /** Handles the submission of the edit survey modal. */

    while(document.getElementById('addImagesErrors').firstChild){
        document.getElementById('addImagesErrors').removeChild(document.getElementById('addImagesErrors').firstChild);
    }

    legalFile = true
    if (document.getElementById('addImagesAddCoordinates').checked) {
        if (document.getElementById('addCoordinatesManualMethod').checked) {
            coordData = []
            allLatitudes = document.querySelectorAll('[id^=latitude-]');
            for (tg=0;tg<allLatitudes.length;tg++) {
                item = allLatitudes[tg]
                tag = item.id.split("latitude-")[item.id.split("latitude-").length-1]
                latitude = document.getElementById('latitude-'+tag).value
                longitude = document.getElementById('longitude-'+tag).value
                altitude = document.getElementById('altitude-'+tag).value
                coordData.push({'tag':tag,'latitude':latitude,'longitude':longitude,'altitude':altitude})
            }
        } else if (document.getElementById('addCoordinatesKMLMethod').checked) {
            kmlFileUpload = document.getElementById('kmlFileUpload2')
            if (kmlFileUpload.files.length > 1) {
                document.getElementById('addImagesErrors').innerHTML = 'You can only upload a single coordinate file'
                legalFile = false
            } else if (kmlFileUpload.files.length == 1) {
                if (kmlFileUpload.files[0].size>50000000) {
                    document.getElementById('addImagesErrors').innerHTML = 'File cannot be larger than 50MB.'
                    legalFile = false
                } else {
                    if (!kmlFileUpload.files[0].name.includes('.kml')) {
                        document.getElementById('addImagesErrors').innerHTML = 'The trap coordinate file must be a .kml file.'
                        legalFile = false
                    }
                }
            }
        }
    }

    legalTGCode = true
    if (document.getElementById('addImagesAddImages').checked) {
        addImagesTGCode = document.getElementById('addImagesTGCode').value
        addImagesCheckboxChecked = document.getElementById('addImagesCheckbox').checked

        if ((addImagesTGCode == '')||(addImagesTGCode == ' ')) {
            legalTGCode = false
            document.getElementById('addImagesErrors').innerHTML = 'The site identifier field cannot be empty.'
        } else if ((addImagesTGCode.includes('/'))||(addImagesTGCode.includes('\\'))) {
            legalTGCode = false
            document.getElementById('addImagesErrors').innerHTML = 'The site identifier cannot contain slashes.'
        }
        
        legalInput = false
        if (document.getElementById('S3BucketAdd').checked == true) {
            S3FolderInput = document.getElementById('S3FolderInput')
            addImagesS3Folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
            if (addImagesS3Folder=='') {
                document.getElementById('addImagesErrors').innerHTML = 'The folder name field cannot be empty.'
            } else if (addImagesS3Folder.toLowerCase()=='none') {
                document.getElementById('addImagesErrors').innerHTML = 'The folder cannot be called "none".'
            } else if ((addImagesS3Folder.includes('/'))||(addImagesS3Folder.includes('\\'))) {
                document.getElementById('addImagesErrors').innerHTML = 'The folder name cannot contain slashes.'
            } else {
                legalInput = true
            }
        } else if (document.getElementById('BrowserAdd').checked == true) {
            inputFile = document.getElementById('inputFile')
            if (inputFile.files.length == 0) {
                document.getElementById('addImagesErrors').innerHTML = 'You must select images to upload.'
            } else {
                legalInput = true
                addImagesS3Folder = 'none'
                files = inputFile.files
            }
        } else {
            document.getElementById('addImagesErrors').innerHTML = 'You must select an image upload method.'
        }
    } else {
        legalInput = true
        addImagesTGCode = ' '
        addImagesS3Folder = 'none'
        addImagesCheckboxChecked = false
    }

    TGCheckReady = true
    tgInfoDiv = document.getElementById('addImagesTGInfo')
    if ((tgInfoDiv!=null)&&(tgInfoDiv.innerHTML=='Checking...')) {
        TGCheckReady = false
        document.getElementById('addImagesErrors').innerHTML = 'Please wait for your site-identifier check to finish.'
    }
    
    if ((tgInfoDiv!=null)&&(tgInfoDiv.innerHTML == '0 sites found: ')) {
        legalTGCode = false
        document.getElementById('addImagesErrors').innerHTML = 'Your specified site identifier has not detected any sites. Please try again.'
    }

    if (legalTGCode&&legalInput&&legalFile&&TGCheckReady) {
        document.getElementById('btnAddImages').disabled = true
        if (document.getElementById('addImagesAddCoordinates').checked) {
            if (document.getElementById('addCoordinatesManualMethod').checked) {
                var formData = new FormData()
                formData.append("coordData", JSON.stringify(coordData))                
                addImagesSendRequest(formData,surveyName,addImagesTGCode,addImagesS3Folder,addImagesCheckboxChecked.toString())
            } else {
                var reader = new FileReader()
                reader.addEventListener('load', (event) => {
                    kmldata = event.target.result

                    if (!document.getElementById('addImagesAddImages').checked) {
                        var xhttp = new XMLHttpRequest();
                        xhttp.open("GET", '/getSurveyTGcode/'+surveyName);
                        xhttp.onreadystatechange =
                        function(){
                            if (this.readyState == 4 && this.status == 200) {
                                regex = JSON.parse(this.responseText);                      
                                if ((kmldata.match(regex)||!regex.includes('[0-9]+'))&&(kmldata.includes('Placemark'))&&(kmldata.includes('Point'))) {
                                    var formData = new FormData()
                                    formData.append("kml", kmlFileUpload.files[0])

                                    if (document.getElementById('addImagesEditTimestamps').checked) {
                                        formData.append("timestamps", JSON.stringify(global_corrected_timestamps))
                                    }

                                    addImagesSendRequest(formData,surveyName,addImagesTGCode,addImagesS3Folder,addImagesCheckboxChecked.toString())
                                } else {
                                    document.getElementById('addImagesErrors').innerHTML = 'There is an error in the format of your .kml file.'
                                    document.getElementById('btnAddImages').disabled = false
                                }

                            }
                        }
                        xhttp.send();
                    } else {
                        if (addImagesCheckboxChecked==true) {
                            regex = addImagesTGCode
                        } else {
                            regex = addImagesTGCode + '[0-9]+'
                        }
                        if ((addImagesCheckboxChecked||kmldata.match(regex))&&(kmldata.includes('Placemark'))&&(kmldata.includes('Point'))) {
                            var formData = new FormData()
                            formData.append("kml", kmlFileUpload.files[0])
                            
                            if (document.getElementById('addImagesEditTimestamps').checked) {
                                formData.append("timestamps", JSON.stringify(global_corrected_timestamps))
                            }

                            addImagesSendRequest(formData,surveyName,addImagesTGCode,addImagesS3Folder,addImagesCheckboxChecked.toString())
                        } else {
                            document.getElementById('addImagesErrors').innerHTML = 'There is an error in the format of your .kml file.'
                            document.getElementById('btnAddImages').disabled = false
                        }
                    }
                });
                reader.readAsText(kmlFileUpload.files[0])
            }
        } else {
            var formData = new FormData()

            if (document.getElementById('addImagesEditTimestamps').checked) {
                formData.append("timestamps", JSON.stringify(global_corrected_timestamps))
            }                

            addImagesSendRequest(formData,surveyName,addImagesTGCode,addImagesS3Folder,addImagesCheckboxChecked.toString())
        }
    }
});

function addImagesSendRequest(formData,surveyName,addImagesTGCode,addImagesS3Folder,addImagesCheckbox) {
    /** Submits the add-images request to the server, and begins the browser upload if necessary. */

    ignore_small_detections= 'none'
    sky_masked = 'none'
    if (document.getElementById('smallDetectionsCheckbox')!=null) {
        ignore_small_detections = document.getElementById('smallDetectionsCheckbox').checked.toString()
        sky_masked = document.getElementById('skyMaskCheckbox').checked.toString()
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/editSurvey/'+surveyName+'/'+addImagesTGCode+'/'+addImagesS3Folder+'/'+addImagesCheckbox+'/'+ignore_small_detections+'/'+sky_masked);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  

            if (reply.status=='success') {

                if ((document.getElementById('addImagesAddImages').checked)&&(document.getElementById('BrowserAdd').checked)) {
                    uploading = true
                    var xhttp = new XMLHttpRequest();
                    xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/Uploading');
                    xhttp.send();
                    
                    ProgBarDiv = document.getElementById('uploadProgBarDiv')

                    while(ProgBarDiv.firstChild){
                        ProgBarDiv.removeChild(ProgBarDiv.firstChild);
                    }

                    var newProg = document.createElement('div');
                    newProg.classList.add('progress');

                    var newProgInner = document.createElement('div');
                    newProgInner.classList.add('progress-bar');
                    newProgInner.classList.add('progress-bar-striped');
                    newProgInner.classList.add('active');
                    newProgInner.setAttribute("role", "progressbar");
                    newProgInner.setAttribute("id", "uploadProgBar");
                    newProgInner.setAttribute("aria-valuenow", "0");
                    newProgInner.setAttribute("aria-valuemin", "0");
                    newProgInner.setAttribute("aria-valuemax", files.length.toString());
                    newProgInner.setAttribute("style", "width:0%");

                    newProg.appendChild(newProgInner);
                    ProgBarDiv.appendChild(newProg);

                    modalAddImages.modal('hide')
                    modalUploadProgress.modal({backdrop: 'static', keyboard: false});

                    uploadSurveyToCloud(surveyName)
                } else {

                    if ((document.getElementById('addImagesAddImages').checked)&&(document.getElementById('addImagesAddCoordinates').checked)) {
                        document.getElementById('modalAlertBody').innerHTML = 'Your additional images and coordinates are being imported.'
                    } else if (document.getElementById('addImagesAddImages').checked) {
                        document.getElementById('modalAlertBody').innerHTML = 'Your additional images are being imported.'
                    } else if (document.getElementById('addImagesEditTimestamps').checked) {
                        document.getElementById('modalAlertBody').innerHTML = 'Your camera timestamps have been edited. The survey must now be re-clustered. This may take a while.'
                    } else if ((document.getElementById('addCoordinatesManualMethod')!=null)&&(document.getElementById('addCoordinatesManualMethod').checked)) {
                        document.getElementById('modalAlertBody').innerHTML = 'Your coordinates are being updated.'
                    } else if (document.getElementById('smallDetectionsCheckbox')!=null) {
                        document.getElementById('modalAlertBody').innerHTML = 'Your survey options are being updated.'
                    } else {
                        document.getElementById('modalAlertBody').innerHTML = 'Your coordinates are being imported.'
                    }

                    document.getElementById('modalAlertHeader').innerHTML = 'Success'
                    alertReload = true
                    modalAddImages.modal('hide')
                    modalAlert.modal({keyboard: true});
                }

            } else {
                document.getElementById('addImagesErrors').innerHTML = reply.message
                document.getElementById('btnAddImages').disabled = false
            }
        }
    }
    xhttp.send(formData);
}

document.getElementById('cancelUpload').addEventListener('click', ()=>{
    /** Cancels the browser upload when the concel button is pressed. */
    stopFlag = true
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/deleteSurvey/'+surveyName);
    xhttp.send();
});

modalAlert.on('hidden.bs.modal', function(){
    /** Updates the appropriate flag and updates the page when the alert modal is closed. */
    if (stopFlag==false) {
        stopFlag = true
        updatePage(current_page)
    } else if (alertReload) {
        alertReload = false
        updatePage(current_page)
    }
});

modalUploadProgress.on('hidden.bs.modal', function(){
    /** Clears the new survey and edit survey modals when the upload modal is closed. */
    resetNewSurveyPage()
    resetAddImagesPage()
    uploading = false
});

modalNotification.on('hidden.bs.modal', function(){
    /** Checks for the next notification on close*/
    checkNotifications()
});