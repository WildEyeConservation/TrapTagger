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

const modalNewSurvey = $('#modalNewSurvey');
const btnNewSurvey = document.querySelector('#btnNewSurvey');
const modalEditSurvey = $('#modalEditSurvey');
const modalAddFiles = $('#modalAddFiles');
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
var coco_task_ids = []
var export_task_ids = []
var csvInfo = null
var csvDisallowedGlobals = null
var levelChoiceTexts = []
var levelChoiceValues = []
var speciesChoiceTexts = []
var speciesChoiceValues = []
var csv_ids_to_remove = []
var coco_ids_to_remove = []
var excel_ids_to_remove = []
var export_ids_to_remove = []
var legalCSV = false
var globalLabels = null
var taskEditDict = {};
var sessionDeletes = []
var discardCancelled = false
var discardOpened = false
var confirmCancelled = false
var confirmOpened = false
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
var barData = {}
var lineData = {}
var timeLabels = []
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
var tgCheckFolder = null
var tgCheckCode = null
var hierarchicalLabels=null
var detailledStatusCount = 0
var next_camera_url = null
var prev_camera_url = null
var global_corrected_timestamps = {}
var global_original_timestamps = {}
var checkingTrapgroupCode = false
var next_classifier_url
var prev_classifier_url
// var currentDownloads = []
// var currentDownloadTasks = []
var checkingTGC = false
var checkingCameraCode = false
var checkingCamC = false
var camCheckID = null
var camCheckFolder = null
var camCheckCode = null
var next_structure_url = null 
var prev_structure_url = null
var cameragroup_corrected_timestamps = {}
var cameragroup_original_timestamps = {}
var globalSurveyStructure = {}
var globalStructureCounts = {'sites':0,'cameras':0}
var structure_page = 1
var tags_per_page = 10
var speciesAndTasks = {}
var speciesEditDict = {}
var speciesLabelIDs = {}
var speciesParentIDs = []
var coordProblems = []

var s3 = null
var stopFlag = true
var files
var s3Setup = false
var surveyName
var surveyOrganisation
var uploading = false
const modalUploadProgress = $('#modalUploadProgress');

const modalDownload = $('#modalDownload');
const btnOpenExport = document.querySelector('#btnOpenExport');
const modalExport = $('#modalExport');
const modalAlertIndividuals = $('#modalAlertIndividuals');
const modalIndividualsError = $('#modalIndividualsError');
const modalIndividual = $('#modalIndividual');
const modalIndividuals = $('#modalIndividuals');
const submitTagsBtn = document.querySelector('#submitTagsBtn');
const btnAddTag = document.querySelector('#btnAddTag');
const modalTags = $('#modalTags');
const modalEditTranslations = $('#modalEditTranslations');
const btnSubmitTranslations = document.querySelector('#btnSubmitTranslations');
// const btnReClassify = document.querySelector('#btnReClassify');
const btnModalAddTaskBack = document.querySelector('#btnModalAddTaskBack');
const btnModalAddTaskBack2 = document.querySelector('#btnModalAddTaskBack2');
const btnCreateTask2 = document.querySelector('#btnCreateTask2');
const btnCreateTask3 = document.querySelector('#btnCreateTask3');
const modalAddTask2 = $('#modalAddTask2');
// const modalAddTask3 = $('#modalAddTask3');
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
const modalConfirmEditSpecies = $('#modalConfirmEditSpecies');
const modalConfirmEditClose = $('#modalConfirmEditClose');
const modalConfirmEmpty = $('#modalConfirmEmpty');
const modalConfirmRestore = $('#modalConfirmRestore');
const btnConfirmRestore = document.querySelector('#btnConfirmRestore')
const btnCancelRestore = document.querySelector('#btnCancelRestore')
const modalConfirmDownload = $('#modalConfirmDownload');
const modalConfirmExport = $('#modalConfirmExport');
const modalEditTaskAlert = $('#modalEditTaskAlert');

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

var disabledSurveyStatuses = ['re-clustering','extracting labels','correcting timestamps','reclustering','removing duplicate images','importing coordinates','processing','deleting','launched','importing','removing humans','identifying static detections','clustering','import queued','cancelled','prepping annotation set','classifying','calculating scores', 'static detection analysis','extracting timestamps','copying', 'processing cameras', 'processing static detections']
var diabledTaskStatuses = ['wrapping up','prepping','deleting','importing','processing','pending','started','initialising','stopping','copying','waiting']
const launchMTurkTaskBtn = document.querySelector('#launchMTurkTaskBtn');
const btnCreateTask = document.querySelector('#btnCreateTask');

var selectedSurvey = 0;
var selectedTask = 0;
var legalLabels = false;
var legalTags = true; //false
var globalHotkeysParents = ['v', 'q', 'n', 'u', '-', '0']
var globalDescriptions = ['none', 'vehicles/humans/livestock', 'knocked down', 'wrong', 'nothing', 'unknown', 'skip', 'remove false detections', 'mask area']
var globalHotkeysChildren = ['9', '0']
var taskNames = []

var prev_url = null
var next_url = null
var current_page = '/getHomeSurveys'
var GHSreqID = null

var timerTaskStatus = null

var pathDisplay = null

const default_access  = {0: 'Worker', 1: 'Hidden', 2: 'Read', 3: 'Write', 4: 'Admin'}
const access_slider_values = {'worker': 0, 'hidden': 1, 'read': 2, 'write': 3 , 'admin': 4}
var globalOrganisationUsers = []
var tabActiveEditSurvey = 'baseAddCoordinatesTab'

var finishedDisplayingMask = null
var finishedDisplayingTime = null
var finishedDisplayingStatic = null
var drawnItemsMask = null
var drawnItemsStatic = null
var drawnMaskItems = null
var cameras = []
var maskCamIndex = 0
var maskImgIndex = 0
var mapTime = null
var activeImageTime = null
var mapReadyTime = null
var mapStatic = null
var activeImageStatic = null
var addedDetectionsStatic = false
var mapReadyStatic = null
var mapMask = null
var activeImageMask = null
var editingEnabled = false
var addedDetectionsMask = false
var mapReadyMask = null
var drawControl = null
var leafletMaskIDs = {}
var removedMasks = []
var editedMasks = {}
var addedMasks = {}
var maskCamIDs = []
var maskCamReadAheadIndex = 0
var maskCam_ids = []
var staticgroupIndex = 0
var staticImgIndex = 0
var staticgroupIDs = []
var staticgroupReadAheadIndex = 0
var staticgroups = []
var staticgroup_ids = []
var staticgroupDetections = {}
var og_staticgroup_status = {}
var staticCameras = []
var selectedTimestampType = 'missing'
var cameraIDs = []
var camera_ids = []
var cameraReadAheadIndex = 0
var imageIndex = 0
var cameraIndex = 0
var images = []
var new_missing_timestamps = {}
var original_extracted_timestamps = {}
var corrected_extracted_timestamps = {}
var original_edited_timestamps = {}
var corrected_edited_timestamps = {}
var currentYear = new Date().getFullYear()
var original_coordinates = {}
var corrected_coordinates = {}
var timestampSites = []
var timestampCameras = {}
var timestampSpecies = []
var confirmEmptyReturn = false
var confirmedEmpty = false
var surveyFormData = null
var classificationLabels = []
var tabActiveEditTask = 'baseLabelsTab'
var prevTaskTranslations = {}
var removedTags = []
var tagEditDict = {}
var translationEditDict = {}
var globalTags = {}
var translationLabels = {}
var globalTranslations = {}
var confirmRestore = false
var confirmDownloadReturn = false
var surveyClassifier = null
var surveyClassifierName = null
var confirmClassifierChange = false
var confirmExportReturn = false
var cameragroup_page = {}
var staticgroup_page = {}
var timestamp_page = {}
var editTaskAlertCount = 0
var mergeMap = {}
var mergeActiveImage = {}
var mergeMapWidth = {}
var mergeMapHeight = {}

function buildSurveys(survey,disableSurvey) {
    /**
     * Builds the survey row
     * @param {obj} survey object describing ths urvey
     * @param {bool} disableSurvey whether the survey is to be disabled or not
    */

    surveyListDiv = document.getElementById('surveyListDiv'); 
    newSurveyDiv = document.createElement('div')
    
    if (survey.status.toLowerCase()=='uploading') {
        newSurveyDiv.setAttribute('style','background-color: rgb(111, 123, 137); border-bottom: 1px solid rgb(60,74,89); border-top: 1px solid rgb(60,74,89)')
    } else {
        newSurveyDiv.setAttribute('style','border-bottom: 1px solid rgb(60,74,89); border-top: 1px solid rgb(60,74,89)')
    }
    
    // newSurveyDiv.style.backgroundColor = '#3C4A59';

    newSurveyDiv.appendChild(document.createElement('br'))

    entireRowHeading = document.createElement('div')
    entireRowHeading.classList.add('row');
    surveyDivHeading = document.createElement('div')
    surveyDivHeading.classList.add('col-lg-6');
    surveyDivHeading.setAttribute('style',"margin-bottom: 10px;")
    taskDivHeading = document.createElement('div')
    taskDivHeading.classList.add('col-lg-6');
    taskDivHeading.setAttribute('style',"padding-left: 10px; padding-top:35px; font-size: 110%;")
    entireRowHeading.appendChild(surveyDivHeading)
    entireRowHeading.appendChild(taskDivHeading)
    newSurveyDiv.appendChild(entireRowHeading)

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    surveyDiv = document.createElement('div')
    surveyDiv.classList.add('col-lg-6');
    taskDiv = document.createElement('div')
    taskDiv.setAttribute('style',"border-left: thin solid #ffffff;")
    taskDiv.setAttribute('id','taskDiv-'+survey.name)
    taskDiv.classList.add('col-lg-6');
    entireRow.appendChild(surveyDiv)
    entireRow.appendChild(taskDiv)

    headingElement = document.createElement('h4')
    headingElement.innerHTML = survey.name
    headingElement.setAttribute('style',"margin-left: 10px; margin-right:10px; margin-bottom: 2px;")
    surveyDivHeading.appendChild(headingElement)

    organisationDiv = document.createElement('div')
    organisationDiv.setAttribute('style',"margin-left: 10px; margin-right:10px; font-size: 80%;")
    organisationDiv.innerHTML = '<i>' + survey.organisation + '</i>'
    surveyDivHeading.appendChild(organisationDiv)

    newSurveyDiv.appendChild(entireRow)

    surveyRow = document.createElement('div')
    surveyRow.classList.add('row');
    surveyDiv.appendChild(surveyRow)

    var infoCol = document.createElement('div')
    infoCol.classList.add('col-lg-4');
    surveyRow.appendChild(infoCol)

    infoElementRow1 = document.createElement('div')
    infoElementRow1.classList.add('row');
    infoElementRow1.classList.add('center');
    infoElementRow1.setAttribute('style',"margin-left: 10px")
    infoCol.appendChild(infoElementRow1)

    infoElementRow2 = document.createElement('div')
    infoElementRow2.classList.add('row');
    infoElementRow2.classList.add('center');
    infoElementRow2.setAttribute('style',"margin-left: 10px")
    infoCol.appendChild(infoElementRow2)

    infoElementRow3 = document.createElement('div')
    infoElementRow3.classList.add('row');
    infoElementRow3.classList.add('center');
    infoElementRow3.setAttribute('style',"margin-left: 10px")
    infoCol.appendChild(infoElementRow3)

    if ((survey.status.toLowerCase()!='uploading')&&(survey.status.toLowerCase()!='preprocessing')){
        
        infoElementDescription = document.createElement('div')
        infoElementDescription.classList.add('col-lg-6');
        infoElementDescription.setAttribute("style","font-size: 80%")
        infoElementDescription.innerHTML = 'Status: ' + survey.status
        infoElementRow1.appendChild(infoElementDescription)

        infoElementNumTrapgroups = document.createElement('div')
        infoElementNumTrapgroups.classList.add('col-lg-6');
        infoElementNumTrapgroups.setAttribute("style","font-size: 80%")
        infoElementNumTrapgroups.innerHTML = 'Sites: ' + survey.numTrapgroups
        infoElementRow1.appendChild(infoElementNumTrapgroups)

        infoElementNumImages = document.createElement('div')
        infoElementNumImages.classList.add('col-lg-6');
        infoElementNumImages.setAttribute("style","font-size: 80%")
        infoElementNumImages.innerHTML = 'Images: ' + survey.numImages
        infoElementRow2.appendChild(infoElementNumImages)

        infoElementNumVideos = document.createElement('div')
        infoElementNumVideos.classList.add('col-lg-6');
        infoElementNumVideos.setAttribute("style","font-size: 80%")
        infoElementNumVideos.innerHTML = 'Videos: ' + survey.numVideos
        infoElementRow2.appendChild(infoElementNumVideos)

        infoElementNumFrames = document.createElement('div')
        infoElementNumFrames.classList.add('col-lg-6');
        infoElementNumFrames.setAttribute("style","font-size: 80%")
        infoElementNumFrames.innerHTML = 'Frames: ' + survey.numFrames
        infoElementRow3.appendChild(infoElementNumFrames)

        infoFiller = document.createElement('div')
        infoFiller.classList.add('col-lg-6');
        infoElementRow3.appendChild(infoFiller)	


    } else {
        infoElementDescription = document.createElement('div')
        infoElementDescription.classList.add('col-lg-12');
        infoElementDescription.setAttribute("style","font-size: 80%")
        infoElementDescription.innerHTML = 'Status: ' + survey.status
        infoElementRow1.appendChild(infoElementDescription)
    }

    if (!['',' ','null','None',null].includes(survey.description)) {
        infoElementRow0 = document.createElement('div')
        infoElementRow0.classList.add('row');
        infoElementRow0.classList.add('center');
        infoElementRow0.setAttribute('style',"margin-left: 10px")
        surveyDiv.appendChild(infoElementRow0)

        infoElementFiller = document.createElement('div')
        infoElementFiller.classList.add('col-lg-12');
        infoElementFiller.setAttribute("style","font-size: 80%")
        infoElementFiller.innerHTML = 'Description: ' + survey.description
        infoElementRow0.appendChild(infoElementFiller)
    }

    if (survey.status.toLowerCase()=='restoring files') {
        // var buttonCol = document.createElement('div')
        // buttonCol.classList.add('col-lg-8');
        // buttonCol.setAttribute('style','align-items: center; display: flex; justify-content: center;');
        // surveyRow.appendChild(buttonCol)
    
        // var buttonRow = document.createElement('div')
        // buttonRow.classList.add('row');
        // buttonCol.appendChild(buttonRow)

        var progBarCol = document.createElement('div')
        progBarCol.classList.add('col-lg-7');
        surveyRow.appendChild(progBarCol)

        // Restore
        var restoreBarDiv = document.createElement('div')
        restoreBarDiv.setAttribute("id","restoreProgDiv"+survey.id)
        progBarCol.appendChild(restoreBarDiv)

        var newProg = document.createElement('div');
        newProg.classList.add('progress');
        newProg.setAttribute('style','background-color: #3C4A59')
        restoreBarDiv.appendChild(newProg)

        var newProgInner = document.createElement('div');
        newProgInner.classList.add('progress-bar');
        newProgInner.classList.add('progress-bar-striped');
        newProgInner.classList.add('progress-bar-animated');
        newProgInner.classList.add('active');
        newProgInner.setAttribute("role", "progressbar");
        newProgInner.setAttribute("id", "restoreProgress"+survey.id);
        newProgInner.setAttribute("aria-valuenow", "0");
        newProgInner.setAttribute("aria-valuemin", "0");
        newProgInner.setAttribute("aria-valuemin", "0");
        newProgInner.setAttribute("aria-valuenow", survey.restore);
        newProgInner.setAttribute("aria-valuemax", survey.total_restore);
        time_left = survey.total_restore - survey.restore
        if (time_left<0) {
            time_left = 0
        }
        newProgInner.setAttribute("style", "width:"+(survey.restore/survey.total_restore)*100+"%;transition:none");
        if (time_left == 1) {	
            newProgInner.innerHTML = time_left + ' hour remaining'
        } else {
            newProgInner.innerHTML = time_left + ' hours remaining'
        }
        newProg.appendChild(newProgInner);

        var cancelCol = document.createElement('div')
        cancelCol.classList.add('col-lg-1');
        surveyRow.appendChild(cancelCol)

        var cancelRestoreBtn = document.createElement('button')
        cancelRestoreBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
        cancelRestoreBtn.innerHTML = '&times;'
        cancelRestoreBtn.id = 'cancelRestoreBtn'+survey.id
        cancelCol.appendChild(cancelRestoreBtn)

        cancelRestoreBtn.addEventListener('click', function(wrapSurveyId) {
            return function() {
                document.getElementById('cancelRestoreBtn'+wrapSurveyId).disabled = true
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(){
                    if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);   
                        updatePage(current_page)
                    }
                }
                xhttp.open("GET", '/cancelRestore/'+wrapSurveyId);
                xhttp.send();
            }
        }(survey.id));

    } else {
        var buttonCol = document.createElement('div')
        buttonCol.classList.add('col-lg-8');
        surveyRow.appendChild(buttonCol)
    
        var buttonRow = document.createElement('div')
        buttonRow.classList.add('row');
        buttonCol.appendChild(buttonRow)

        editCol = document.createElement('div')
        editCol.classList.add('col-lg-2');
        buttonRow.appendChild(editCol)
    
        addImagesCol = document.createElement('div')
        addImagesCol.classList.add('col-lg-3');
        buttonRow.appendChild(addImagesCol)
    
        addTaskCol = document.createElement('div')
        addTaskCol.classList.add('col-lg-4');
        buttonRow.appendChild(addTaskCol)
    
        deleteSurveyCol = document.createElement('div')
        deleteSurveyCol.classList.add('col-lg-3');
        buttonRow.appendChild(deleteSurveyCol)

        var deleteSurveyBtn = document.createElement('button')
        deleteSurveyBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
        deleteSurveyBtn.setAttribute("id","deleteSurveyBtn"+survey.id)
        deleteSurveyBtn.innerHTML = 'Delete'
        deleteSurveyCol.appendChild(deleteSurveyBtn)
    
        deleteSurveyBtn.addEventListener('click', function(wrapSurveyName,wrapSurveyId) {
            return function() {
                selectedSurvey = wrapSurveyId
                document.getElementById('modalConfirmHeader').innerHTML = 'Confirmation Required'
                document.getElementById('modalConfirmBody').innerHTML = 'Do you wish to delete ' + wrapSurveyName + '?'
                document.getElementById('btnConfirm').addEventListener('click', confirmSurveyDelete);
                document.getElementById('confirmclose').addEventListener('click', removeSurveyDeleteListeners);
                modalConfirm.modal({keyboard: true});
            }
        }(survey.name, survey.id));
    }

    // surveyDiv.appendChild(infoElementRow)
    // surveyDiv.appendChild(infoElementRow2)
    // surveyDiv.appendChild(infoElementRow3)

    newSurveyDiv.appendChild(document.createElement('br'))
    surveyListDiv.appendChild(newSurveyDiv) 

    if (survey.status.toLowerCase()=='uploading') {
        // uploadID = survey.id
        // surveyName = survey.name
        var addImagesBtn = null
        var addTaskBtn = null
        
        if (survey.id==uploadID) {
            uploadWorker.postMessage({'func': 'buildUploadProgress', 'args': null});
            disableSurvey = true
        } else {
            row = document.createElement('div')
            row.classList.add('row')
            taskDiv.appendChild(row)
    
            col1 = document.createElement('div')
            col1.classList.add('col-lg-9')
            row.appendChild(col1)
    
            col2 = document.createElement('div')
            col2.classList.add('col-lg-3')
            row.appendChild(col2)
    
            btnResume = document.createElement('button')
            btnResume.setAttribute("class","btn btn-primary btn-sm")
            btnResume.setAttribute('onclick','checkUploadAvailable('+survey.id+',"'+survey.name+'")')
            btnResume.innerHTML = 'Resume Upload'
            if (uploadID) {
                btnResume.disabled = true
            }
            col2.appendChild(btnResume)
        }
    } else if (survey.status.toLowerCase()=='preprocessing') {
        var addTaskBtn = null

        taskDivHeading.innerHTML = 'Preprocessing Steps:'

        var row = document.createElement('div')
        row.classList.add('row')
        row.setAttribute("style","margin-right: 15px")
        taskDiv.appendChild(row)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-8')
        row.appendChild(col1)

        var col2 = document.createElement('div')
        col2.classList.add('col-lg-2')
        row.appendChild(col2)

        var col3 = document.createElement('div')
        col3.classList.add('col-lg-2')
        row.appendChild(col3)

        // Progress
        var progressBarDiv = document.createElement('div')
        progressBarDiv.setAttribute("id","stepsProgressDiv"+survey.id)
        col1.appendChild(progressBarDiv)

        var newProg = document.createElement('div');
        newProg.classList.add('progress');
        newProg.setAttribute('style','background-color: #3C4A59')
        progressBarDiv.appendChild(newProg)

        var newProgInner = document.createElement('div');
        newProgInner.classList.add('progress-bar');
        newProgInner.classList.add('progress-bar-striped');
        newProgInner.classList.add('progress-bar-animated');
        newProgInner.classList.add('active');
        newProgInner.setAttribute("role", "progressbar");
        newProgInner.setAttribute("id", "stepsProgress"+survey.id);
        newProgInner.setAttribute("aria-valuenow", "0");
        newProgInner.setAttribute("aria-valuemin", "0");
        newProgInner.setAttribute("aria-valuemax", "2");
        newProgInner.setAttribute("style", "width:"+(survey.prep_progress/survey.prep_statusses.length)*100+"%;transition:none; ");
        newProgInner.innerHTML = (survey.prep_progress/survey.prep_statusses.length)*100+"% Complete";
        newProg.appendChild(newProgInner);

        var stepsDiv = document.createElement('div')
        stepsDiv.setAttribute("id","stepsDiv"+survey.id)
        stepsDiv.setAttribute("style","margin-top: 5px")
        col1.appendChild(stepsDiv)

        var row1 = document.createElement('div')
        row1.classList.add('row')
        row1.setAttribute("style","font-size:80%")
        stepsDiv.appendChild(row1)

        var cols1 = document.createElement('div')
        cols1.classList.add('col-lg-6')
        cols1.innerHTML = 'Timestamp Correction'
        row1.appendChild(cols1)

        var cols2 = document.createElement('div')
        cols2.classList.add('col-lg-6')
        cols2.setAttribute("style","padding-left: 2px")
        cols2.innerHTML = 'Static Detection Check'
        row1.appendChild(cols2)

        var row2 = document.createElement('div')
        row2.classList.add('row')
        row2.setAttribute("style","font-size:70%")
        stepsDiv.appendChild(row2)

        var cols3 = document.createElement('div')
        cols3.classList.add('col-lg-6')
        cols3.setAttribute("id","step1Status"+survey.id)
        cols3.innerHTML = survey.prep_statusses[0]
        row2.appendChild(cols3)

        var cols4 = document.createElement('div')
        cols4.classList.add('col-lg-6')
        cols4.setAttribute("id","step2Status"+survey.id)
        cols4.setAttribute("style","padding-left: 2px")
        cols4.innerHTML = survey.prep_statusses[1]
        row2.appendChild(cols4)

        var disblePrep = false
        if (survey.prep_statusses.includes('In Progress')) {
            disblePrep = true
            disableSurvey = true
        }
        if (survey.prep_progress == 2) {
            disblePrep = true
        }

        // Launch
        var launchStep = document.createElement('button')
        launchStep.setAttribute("id","launchStep"+survey.id)
        launchStep.setAttribute("class","btn btn-primary btn-block btn-sm")
        launchStep.innerHTML = 'Launch'
        launchStep.disabled = disblePrep
        col2.appendChild(launchStep)

        launchStep.addEventListener('click', function(wrapSurveyId, wrapProgress) {
            return function() {
                selectedSurvey = wrapSurveyId

                if (wrapProgress == 0) {
                    // Timestamp Correction
                    document.location.href = '/checkTimestamps?survey='+wrapSurveyId
                } else if (wrapProgress == 1) {
                    // Static Detection Check
                    document.location.href = '/checkStaticDetections?survey='+wrapSurveyId;
                }
            }
        }(survey.id, survey.prep_progress));

        // Skip
        var skipStep = document.createElement('button')
        skipStep.setAttribute("id","skipStep"+survey.id)
        skipStep.setAttribute("class","btn btn-danger btn-block btn-sm")
        skipStep.innerHTML = 'Skip'
        skipStep.disabled = disblePrep
        col3.appendChild(skipStep)

        skipStep.addEventListener('click', function(wrapSurveyId, wrapProgress) {
            return function() {
                
                selectedSurvey = wrapSurveyId

                if (wrapProgress == 0) {
                    step = 'timestamp'
                    confirmStep = 'Timestamp Correction'
                    warningMsg = '<i> Please note that skipping this step will result in the affected images and/or videos not having timestamps. It may have an impact on the clustering of your data as well as any subsequent analysis.</i>'
                } else if (wrapProgress == 1) {
                    step = 'static'
                    confirmStep = 'Static Detection Check'
                    warningMsg = '<i> Please note that skipping this step may result in missed animal detections that were wrongly marked as static. It may have an impact on the accuracy of your data. It is strongly recommended to complete this step.</i>'
                }

                document.getElementById('modalConfirmHeader').innerHTML = 'Confirmation Required'
                document.getElementById('modalConfirmBody').innerHTML = 'Do you wish to skip ' + confirmStep + ' for this survey?<br><br>' + warningMsg
                document.getElementById('btnConfirm').addEventListener('click', function() {
                    var xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status == 200) {
                            updatePage(current_page)
                        }
                    }
                    xhttp.open("GET", "/skipPreprocessing/"+wrapSurveyId+"/"+step);
                    xhttp.send();
                });
                modalConfirm.modal({keyboard: true});
            }
        }(survey.id, survey.prep_progress));
    } else if (survey.status.toLowerCase()=='restoring files') {
        var addTaskBtn = null
        var deleteSurveyBtn = null
        taskDivHeading.innerHTML = 'Annotation Sets:'
        for (let i=0;i<survey.tasks.length;i++) {
            buildTask(taskDiv, survey.tasks[i], disableSurvey, survey)
            if (i < survey.tasks.length-1) {
                taskDiv.appendChild(document.createElement('br'))
            }
        }
    } else {
        taskDivHeading.innerHTML = 'Annotation Sets:'
        for (let i=0;i<survey.tasks.length;i++) {
            buildTask(taskDiv, survey.tasks[i], disableSurvey, survey)
            if (i < survey.tasks.length-1) {
                taskDiv.appendChild(document.createElement('br'))
            }
        }

        var editSurveyBtn = document.createElement('button')
        editSurveyBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        editSurveyBtn.setAttribute("id","editSurveyBtn"+survey.id)
        editSurveyBtn.innerHTML = 'Edit'
        editCol.appendChild(editSurveyBtn)
    
        editSurveyBtn.addEventListener('click', function(wrapSurveyName,wrapSurveyId) {
            return function() {
                selectedSurvey = wrapSurveyId
                document.getElementById('editSurveyHeader').innerHTML =  'Edit Survey: ' + wrapSurveyName
                clearEditSurveyModal()
                modalEditSurvey.modal({keyboard: true});
                document.getElementById('openAddCoordinatesTab').click()
            }
        }(survey.name,survey.id));

        var addImagesBtn = document.createElement('button')
        addImagesBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        addImagesBtn.setAttribute("id","addImagesBtn"+survey.id)
        addImagesBtn.setAttribute("style","white-space: normal; word-wrap: break-word;")
        addImagesBtn.innerHTML = 'Add Files'
        addImagesCol.appendChild(addImagesBtn)
    
        addImagesBtn.addEventListener('click', function(wrapSurveyName,wrapSurveyId) {
            return function() {
                surveyName = wrapSurveyName
                selectedSurvey = wrapSurveyId
                document.getElementById('addFilesHeader').innerHTML =  'Add Files: ' + wrapSurveyName
                clearAddFilesModal()
                modalAddFiles.modal({keyboard: true});
                openAddImages()
            }
        }(survey.name,survey.id));

        var addTaskBtn = document.createElement('button')
        addTaskBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
        addTaskBtn.setAttribute("id","addTaskBtn"+survey.id)
        addTaskBtn.setAttribute("style","white-space: normal; word-wrap: break-word;")
        addTaskBtn.innerHTML = 'Add Annotation Set'
        addTaskCol.appendChild(addTaskBtn)

        addTaskBtn.addEventListener('click', function(wrapSurveyId) {
            return function() {
                selectedSurvey = wrapSurveyId
                resetModalAddTask1()
                resetModalAddTask2()
                // resetModalAddTask3()
                getClassificationLabels()
                modalAddTask.modal({keyboard: true});
            }
        }(survey.id));
    }
    if (disableSurvey) {
        if (addTaskBtn) {
            addImagesBtn.disabled = true
            addTaskBtn.disabled = true
            editSurveyBtn.disabled = true
        }
        if (deleteSurveyBtn) {
            deleteSurveyBtn.disabled = true
        }
    } else {
        if (survey.access == 'read'){
            if (addTaskBtn) {
                addImagesBtn.disabled = true
                addTaskBtn.disabled = true
                editSurveyBtn.disabled = true
            }
            if (deleteSurveyBtn) {
                deleteSurveyBtn.disabled = true
            }

            if (survey.status.toLowerCase()=='uploading' && !uploading) {
                if (survey.create) {
                    btnResume.disabled = false
                }
                else {
                    btnResume.disabled = true
                }
            }
        }
        else if (survey.access == 'write' || survey.access == 'admin'){
            if (addTaskBtn) {
                addImagesBtn.disabled = false
                addTaskBtn.disabled = false
                editSurveyBtn.disabled = false
            }

            if  (survey.status.toLowerCase()=='uploading' && !uploading) {
                if (survey.create) {
                    btnResume.disabled = false
                }
                else {
                    btnResume.disabled = true
                }
            }
            if (deleteSurveyBtn) {
                if (survey.delete){
                    deleteSurveyBtn.disabled = false
                }
                else{
                    deleteSurveyBtn.disabled = true
                }
            }
        }
        else{
            if (addTaskBtn) {
                addImagesBtn.disabled = true
                addTaskBtn.disabled = true
                editSurveyBtn.disabled = true
            }
            if (deleteSurveyBtn) {
                deleteSurveyBtn.disabled = true
            }
            if (survey.status.toLowerCase()=='uploading' && !uploading) {
                if (survey.create) {
                    btnResume.disabled = false
                }
                else {
                    btnResume.disabled = true
                }
            }
        }
    }
}

function onload(){
    /**Function for initialising the page on load.*/
    document.getElementById('downloadsNav').hidden = false
    updatePage(current_page)
}

window.addEventListener('load', onload, false);

function updatePage(url){
    /**
     * Updates the current page using the stipulated url, includes optional paramaters like order and pagination.
     * @param {str} url the url to load for the page
     */

    if (url==null) {
        url = (' ' + current_page).slice(1);
    } else {
        current_page = (' ' + url).slice(1);
    }

    // Add request ID to prevent reload on response race
    GHSreqID = Math.floor(Math.random() * 100000) + 1;
    if (!url.includes('?')) {
        url+='?'
    } else {
        url += '&'
    }
    url += 'reqID='+GHSreqID.toString()
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            // if (reply.surveys[0] && reply.surveys[0].status.toLowerCase()=='uploading') {
            //     document.getElementById('btnNewSurvey').disabled = true
            // } else {
            //     document.getElementById('btnNewSurvey').disabled = false
            // }

            if (reply.reqID.toString()==GHSreqID.toString()) {

                surveyListDiv = document.getElementById('surveyListDiv'); 
                while(surveyListDiv.firstChild){
                    surveyListDiv.removeChild(surveyListDiv.firstChild);
                }
    
                if (reply.surveys.length > 0) {
                    surveyListDiv.setAttribute('class','')
                    document.getElementById('mainCard').setAttribute('style','')
                } else {
                    surveyListDiv.setAttribute('class','card-body')
                    document.getElementById('mainCard').setAttribute('style','min-height:400px')
                }
    
                // taskProcessing = false
                for (let i=0;i<reply.surveys.length;i++) {
                    disableSurvey = false
                    for (let n=0;n<reply.surveys[i].tasks.length;n++) {
                        if ((diabledTaskStatuses.includes(reply.surveys[i].tasks[n].status.toLowerCase()))||(reply.surveys[i].tasks[n].disabledLaunch=='true')) {
                            disableSurvey = true
                            // taskProcessing = true
                        }
                    }
                    // if (disabledSurveyStatuses.includes(reply.surveys[i].status.toLowerCase())||(currentDownloads.includes(reply.surveys[i].id))) {
                    if (disabledSurveyStatuses.includes(reply.surveys[i].status.toLowerCase())) {
                        disableSurvey = true
                        // taskProcessing = true
                    }
                    buildSurveys(reply.surveys[i],disableSurvey)
                    // if (i < reply.surveys.length-1) {
                    //     surveyListDiv.appendChild(document.createElement('br'))
                    // }
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
    
                if (uploading&&!uploadStart) {
                    uploadFiles()
                }
    
                // if (taskProcessing==true) {
                //     if (processingTimer != null) {
                //         clearInterval(processingTimer)
                //     }
                //     processingTimer = setTimeout(function() { updatePage(url); }, 10000)
                // } else {
                //     if (processingTimer != null) {
                //         clearInterval(processingTimer)
                //     }
                //     processingTimer = null
                // }
    
                // always refresh the page
                if (processingTimer != null) {
                    clearTimeout(processingTimer)
                }
                processingTimer = setTimeout(function() { updatePage(current_page); }, 5000)
            }
        }
    }
    xhttp.open("GET", url);
    xhttp.send();
}

function confirmSurveyDelete() {
    /** Handles the confirmation of survey deletion, submitting the request to the server. */

    removeSurveyDeleteListeners()
    modalConfirm.modal('hide')

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/deleteSurvey/'+selectedSurvey);
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
    if (uploading) {
        document.getElementById('modalAlertHeader').innerHTML = "Alert"
        document.getElementById('modalAlertBody').innerHTML = "If you wish to add an additional survey, please wait for the current upload to complete, or open a new tab."
        modalAlert.modal({keyboard: true});
    } else {
        resetNewSurveyPage()
        modalNewSurvey.modal({keyboard: true});
    }
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
            for (let i=0;i<surveys.length;i++) {
                optionTexts.push(surveys[i][1])
                optionValues.push(surveys[i][0])
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
            for (let i=0;i<tasks.length;i++) {
                optionTexts.push(tasks[i][1])
                optionValues.push(tasks[i][0])
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
    document.getElementById('newSurveyCamCode').value = ''

    document.getElementById('S3BucketUpload').checked = false
    document.getElementById('BrowserUpload').checked = true
    document.getElementById('newSurveyCheckbox').checked = false
    document.getElementById('detailedAccessSurveyCb').checked = false
    document.getElementById('detailedAccessSurveyDiv').hidden = true

    document.getElementById('newSurveyTrails').checked = true
    document.getElementById('newSurveyPlains').checked = false
    document.getElementById('newSurveyWaterholes').checked = false
    document.getElementById('newSurveyBaited').checked = false

    document.getElementById('newSurveyMotion').checked = true
    document.getElementById('newSurveyTime').checked = false

    document.getElementById('camAdvancedCheckbox').checked = false
    document.getElementById('camRegExp').checked = false
    document.getElementById('camLvlFolder').checked = true
    document.getElementById('camSameAsSite').checked = true
    document.getElementById('multipleCam').checked = false
    document.getElementById('camIdDiv').hidden = true
    document.getElementById('camFolderDiv').hidden = true
    document.getElementById('camOptionDesc').innerHTML = ''
    document.getElementById('multiCamDiv').hidden = true

    document.getElementById('siteFolderN').checked = true
    document.getElementById('siteIdentifier').checked = false
    document.getElementById('siteFolderDiv').hidden = false
    document.getElementById('siteIdDiv').hidden = true
    
    document.getElementById('siteOptionDesc').innerHTML = '<i>Select the folder level from the path below that corresponds to the sites/stations in your folder structure. For example, in "Survey/Site1/Camera1", you should select the "Site1" folder.</i>'

    // document.getElementById('kmlFileUploadText').value = ''
    // document.getElementById('kmlFileUpload').value = ''

    // document.getElementById('newSurveyTGInfo').innerHTML = ''
    document.getElementById('newSurveyStructureDiv').innerHTML = ''

    clearSelect(document.getElementById('newSurveyOrg'))
    document.getElementById('newSurveyPermission').value = 'default'
    document.getElementById('newSurveyAnnotation').value = 'default'
    

    speciesClassifierDiv = document.querySelector('#speciesClassifierDiv')
    while(speciesClassifierDiv.firstChild){
        speciesClassifierDiv.removeChild(speciesClassifierDiv.firstChild);
    }

    newSurveyFormDiv = document.querySelector('#newSurveyFormDiv')
    while(newSurveyFormDiv.firstChild){
        newSurveyFormDiv.removeChild(newSurveyFormDiv.firstChild);
    }

    newSurveyTgBuilder = document.querySelector('#newSurveyTgBuilder')
    while(newSurveyTgBuilder.firstChild){
        newSurveyTgBuilder.removeChild(newSurveyTgBuilder.firstChild);
    }

    newSurveyCamBuilder = document.querySelector('#newSurveyCamBuilder')
    while(newSurveyCamBuilder.firstChild){
        newSurveyCamBuilder.removeChild(newSurveyCamBuilder.firstChild);
    }

    surveyPermissionsDiv = document.querySelector('#surveyPermissionsDiv')
    while(surveyPermissionsDiv.firstChild){
        surveyPermissionsDiv.removeChild(surveyPermissionsDiv.firstChild);
    }

    siteFolderDiv = document.getElementById('siteFolderDiv')
    while(siteFolderDiv.firstChild){
        siteFolderDiv.removeChild(siteFolderDiv.firstChild);
    }

    confirmedEmpty = false
    confirmEmptyReturn = false
    surveyFormData = null

    document.getElementById('btnSaveSurvey').disabled=false
    document.getElementById('newSurveyErrors').innerHTML = ''
}

function resetEditSurveyModal() {
    /** Clears the edit survey modal. */

    // document.getElementById('classifierVersion').value = ''
    // document.getElementById('btnReClassify').disabled = true
    // document.getElementById('addImagesAddImages').checked = false
    // document.getElementById('addImagesAddCoordinates').checked = false
    // document.getElementById('addImagesEditTimestamps').checked = false
    // document.getElementById('addImagesEditClassifier').checked = false
    // document.getElementById('addImagesAdvanced').checked = false
    // document.getElementById('addImagesAddImages').disabled = false
    // document.getElementById('addImagesAddCoordinates').disabled = false
    // document.getElementById('addImagesEditTimestamps').disabled = false
    // document.getElementById('addImagesEditClassifier').disabled = false
    // document.getElementById('addImagesAdvanced').disabled = false


    var mainModal = document.getElementById('modalEditSurvey')
    var tablinks = mainModal.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

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
    h5.innerHTML = 'Files to Upload'
    formGroup.appendChild(h5)

    div2 = document.createElement('div')
    div2.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div2.innerHTML = '<i>Upload the survey files by selecting the entire folder you wish to upload.</i>'
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
    input.setAttribute('id','pathDisplay')
    col.appendChild(input)

    formGroup.appendChild(document.createElement('br'))

    row2 = document.createElement('div')
    row2.classList.add('row')
    formGroup.append(row2)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row2.appendChild(col2)

    btn = document.createElement('button')
    btn.setAttribute('onclick','selectFiles()')
    btn.setAttribute("class","btn btn-primary btn-block")
    btn.innerHTML = 'Select Files'
    col2.appendChild(btn)

    // label = document.createElement('label')
    // label.setAttribute('class','btn btn-primary btn-sm btn-block')
    // label.setAttribute('for','inputFile')
    // label.innerHTML = 'Select Images'
    // col2.appendChild(label)

    // input2 = document.createElement('input')
    // input2.setAttribute('type','file')
    // input2.classList.add('form-control-file')
    // input2.setAttribute('id','inputFile')
    // input2.multiple = true
    // input2.setAttribute('style','display:none;')
    // input2.setAttribute('webkitdirectory','')
    // input2.setAttribute('directory','')
    // label.append(input2)

    // input2.addEventListener( 'input', () => {
    //     inputFile = document.getElementById('inputFile')
    //     selectFiles = document.getElementById('selectFiles')
    //     for (let i = 0; i < inputFile.files.length; i++){
    //         let option = document.createElement('option');
    //         option.text = inputFile.files[i].webkitRelativePath;
    //         option.value = i;
    //         selectFiles.add(option);
    //     }
    //     checkTrapgroupCode()
    // });

    // Initalise tg code check
    if (document.getElementById('addImagesTGCode')!=null) {
        $("#addImagesTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#addImagesCheckbox").change( function() {
            checkTrapgroupCode()
        })
        $("#addImagesCamCode").change( function() {
            checkTrapgroupCode()
        })
        $("#addImagesCamCheckbox").change( function() {
            checkTrapgroupCode()
        })
    } else {
        $("#newSurveyTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#newSurveyCheckbox").change( function() {
            checkTrapgroupCode()
        })
        $("#newSurveyCamCode").change( function() {
            checkTrapgroupCode()
        })
        $("#camAdvancedCheckbox").change( function() {
            checkTrapgroupCode()
        })
    }

    updateSiteFolderSelect()
    updateCamFolderSelect()
    checkTrapgroupCode()
}

function pingTgCheck() {
    if (modalNewSurvey.is(':visible')||modalAddFiles.is(':visible')) {
        if (!checkingTrapgroupCode) {
            checkingTrapgroupCode = true
            S3FolderInput = document.getElementById('S3FolderInput')
            folder = S3FolderInput.options[S3FolderInput.selectedIndex].text

            if (document.getElementById('addImagesTGCode')!=null) {
                siteFolderN = document.getElementById('siteFolderN_ES').checked
                siteIdentifier = document.getElementById('siteIdentifierES').checked
                if (siteFolderN) {
                    tgCode = ''
                    // look for a selected site folder
                    selectedFolder = document.querySelector(".site-folder.selected");
                    if (selectedFolder) {
                        index = selectedFolder.dataset.index;
                        tgCode = "(?:[^/]*/){"+index+"}([^/]*)"
                    }
                } else {
                    tgCode = document.getElementById('addImagesTGCode').value
                }
                infoDiv = document.getElementById('addImagesStructureDiv')
                camRegExp = document.getElementById('camRegExpES').checked
                camSameAsSite = document.getElementById('camSameAsSiteES').checked
                camLvlFolder = document.getElementById('camLvlFolderES').checked
                camAdvanced = document.getElementById('addImagesCamCheckbox').checked
                if (camSameAsSite) {
                    camCode = tgCode
                    camRegExp = false
                    camLvlFolder = false
                }
                else{
                    if (camRegExp) {
                        camCode = document.getElementById('addImagesCamCode').value
                        if (!camAdvanced&&camCode!='') {
                            camCode += '[0-9]+'
                        }
                    } else if (camLvlFolder) {
                        camCode = ''
                        selectedFolder = document.querySelector(".cam-folder.selected");
                        if (selectedFolder) {
                            index = selectedFolder.dataset.index;
                            camCode = "(?:[^/]*/){"+index+"}([^/]*)"
                        }
                    }
                }

            } else {
                siteFolderN = document.getElementById('siteFolderN').checked
                siteIdentifier = document.getElementById('siteIdentifier').checked
                if (siteFolderN) {
                    tgCode = ''
                    // look for a selected site folder
                    selectedFolder = document.querySelector(".site-folder.selected");
                    if (selectedFolder) {
                        index = selectedFolder.dataset.index;
                        tgCode = "(?:[^/]*/){"+index+"}([^/]*)"
                    }
                } else {
                    tgCode = document.getElementById('newSurveyTGCode').value
                }
                infoDiv = document.getElementById('newSurveyStructureDiv')
                camRegExp = document.getElementById('camRegExp').checked
                camSameAsSite = document.getElementById('camSameAsSite').checked
                camLvlFolder = document.getElementById('camLvlFolder').checked
                camAdvanced = document.getElementById('camAdvancedCheckbox').checked
                if (camSameAsSite) {
                    camCode = tgCode
                    camRegExp = false
                    camLvlFolder = false
                }
                else{
                    if (camRegExp) {
                        camCode = document.getElementById('newSurveyCamCode').value
                        if (!camAdvanced&&camCode!='') {
                            camCode += '[0-9]+'
                        }
                    } else if (camLvlFolder) {
                        camCode = ''
                        selectedFolder = document.querySelector(".cam-folder.selected");
                        if (selectedFolder) {
                            index = selectedFolder.dataset.index;
                            camCode = "(?:[^/]*/){"+index+"}([^/]*)"
                        }
                    }
                }
            }            
            if ((tgCode=='')||(folder=='')||(camCode=='')) {
                infoDiv.innerHTML = ''

                var formData = new FormData()
                formData.append("revoke_id", tgCheckID)
                var xhttp = new XMLHttpRequest();
                xhttp.open("POST", '/checkTrapgroupCode');
                xhttp.send(formData);

                tgCheckFolder = null
                tgCheckCode = null
                camCheckCode = null
                checkingTGC = false
                checkingTrapgroupCode = false

            }
            else if (tgCode.endsWith('.*') || tgCode.endsWith('.+') || tgCode.endsWith('.*[0-9]+') || tgCode.endsWith('.+[0-9]+' ) || camCode.endsWith('.*') || camCode.endsWith('.+') || camCode.endsWith('.*[0-9]+') || camCode.endsWith('.+[0-9]+' )) {
                error_message = 'Your site identifier or camera identifier is invalid. Please try again or contact us for assistance.'

                infoDiv.innerHTML = error_message

                var formData = new FormData()
                formData.append("revoke_id", tgCheckID)
                var xhttp = new XMLHttpRequest();
                xhttp.open("POST", '/checkTrapgroupCode');
                xhttp.send(formData);

                tgCheckFolder = null
                tgCheckCode = null
                camCheckCode = null
                checkingTGC = false
                checkingTrapgroupCode = false

            }
            else {
                if (siteIdentifier) {
                    if (document.getElementById('addImagesTGCode')!=null) {
                        if ((!document.getElementById('addImagesCheckbox').checked)&&(tgCode!='')) {
                            tgCode+='[0-9]+'
                            if (camSameAsSite) {
                                camCode+='[0-9]+'
                            }
                        }
                    } else {
                        if ((!document.getElementById('newSurveyCheckbox').checked)&&(tgCode!='')) {
                            tgCode+='[0-9]+'
                            if (camSameAsSite) {
                                camCode+='[0-9]+'
                            }
                        }
                    }
                }

                var formData = new FormData()
                if ((tgCheckFolder==folder)&&(tgCheckCode==tgCode)&&(camCheckCode==camCode)) {
                    // Still the same - just checking status
                    if (modalNewSurvey.is(':visible')) {
                        surveyName = document.getElementById('newSurveyName').value
                        surveyOrganisation = document.getElementById('newSurveyOrg').value
                        formData.append("organisation_id", surveyOrganisation)
                    }
                    else{
                        formData.append("survey_id", selectedSurvey)
                    }
                    formData.append("task_id", tgCheckID)
                    formData.append("surveyName", surveyName)
                } else {
                    // changed - revoke old task
                    formData.append("surveyName", surveyName)
                    formData.append("revoke_id", tgCheckID)
                    formData.append("task_id", 'none')
                    formData.append("tgCode", tgCode)
                    formData.append("folder", folder)
                    formData.append("camCode", camCode)
                    if (modalNewSurvey.is(':visible')) {
                        surveyOrganisation = document.getElementById('newSurveyOrg').value
                        formData.append("organisation_id", surveyOrganisation)
                    }
                    else{
                        formData.append("survey_id", selectedSurvey)
                    }
                    tgCheckFolder = folder
                    tgCheckCode = tgCode
                    camCheckCode = camCode
                }
            
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(){
                    if (this.readyState == 4 && this.status == 200) {
                        response = JSON.parse(this.responseText)
                        tgCheckID = response.task_id
                        if ((tgCheckFolder==folder)&&(tgCheckCode==tgCode)) {
                            if (response.status=='SUCCESS') {
                                // infoDiv.innerHTML = response.data
                                data = response.data

                                if (data.message != 'Structure found.'){
                                    infoDiv.innerHTML = data.message
                                }
                                else{
                                    infoDiv.innerHTML = ''
                                    if (data.structure != null) {
                                        globalStructureCounts['sites'] = data.nr_sites
                                        globalStructureCounts['cameras'] = data.nr_cams
                                        structure_page = 1
                                        globalSurveyStructure = {}
                                        globalSurveyStructure[structure_page] = {}

                                        page_count = 1
                                        var tgs = Object.keys(data.structure)
                                        // console.log(tgs)
                                        var highestCamsPerSite = 0
                                        for (let i=0;i<tgs.length;i++) {
                                            globalSurveyStructure[page_count][tgs[i]] = data.structure[tgs[i]]
                                            if (Object.keys(globalSurveyStructure[page_count]).length == tags_per_page && i < tgs.length-1) {
                                                page_count += 1
                                                globalSurveyStructure[page_count] = {}
                                            }
                                            highestCamsPerSite = Math.max(highestCamsPerSite, Object.keys(data.structure[tgs[i]]).length)
                                        }

                                        updateSurveyStructure()

                                        if (highestCamsPerSite > 2) {
                                            document.getElementById('modalAlertHeader').innerHTML = "Warning"
                                            document.getElementById('modalAlertBody').innerHTML = "<p>More than 2 cameras are associated with at least one site/station. This is unusual, as sites/stations typically have only 1 or 2 cameras, and a survey typically contains multiple sites/stations.<br><br>Please verify that your site/station and camera identifiers are correct as well as the detected survey structure. If this setup is intentional, you may safely ignore this message.</p>"
                                            modalAlert.modal({keyboard: true, backdrop: 'static'})
                                        }
                                    }
                                    else{
                                        infoDiv.innerHTML = 'No structure found.'
                                    }
                                }
                                tgCheckFolder = null
                                tgCheckCode = null
                                camCheckCode = null
                                checkingTGC = false
                            } else if (response.status=='FAILURE') {
                                infoDiv.innerHTML = 'Check failed.'
                                tgCheckFolder = null
                                tgCheckCode = null
                                camCheckCode = null
                                checkingTGC = false
                            } else {
                                setTimeout(function() { pingTgCheck(); }, 3000)
                            }
                        }
                        checkingTrapgroupCode = false
                    }
                }
                xhttp.open("POST", '/checkTrapgroupCode');
                xhttp.send(formData);
            }
        }
    } else {
        var formData = new FormData()
        formData.append("revoke_id", tgCheckID)
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/checkTrapgroupCode');
        xhttp.send(formData);

        tgCheckFolder = null
        tgCheckCode = null
        camCheckCode = null
        checkingTGC = false
        checkingTrapgroupCode = false
    }
}

function buildFolders(path, divID, folderType='site') {
    /** Builds the folder structure into the specified div. */
    var div = document.getElementById(divID);
    while (div.firstChild) {
        div.removeChild(div.firstChild);
    }

    if (path) {
        var folders = path.split("/");
        folders.forEach((folder, index) => {
            let folderDiv = document.createElement("div");
            folderDiv.className = "folder " + folderType + "-folder";
            folderDiv.textContent = folder;
            folderDiv.dataset.index = index;
            folderDiv.id = folderType + 'Folder-' + index;
            folderDiv.addEventListener("click", () => {
                document.querySelectorAll("." + folderType + "-folder").forEach(el => el.classList.remove("selected"));
                folderDiv.classList.add("selected");
                checkTrapgroupCode();
            });
            if (index > 0) {
                let slash = document.createElement("span");
                slash.className = "slash";
                slash.textContent = "/";
                div.appendChild(slash);
            }
            div.appendChild(folderDiv);
        });
    } else {
        div.innerHTML = 'No files selected.'
    }
}

function updateSiteFolderSelect(){
    /** Updates the site folder select element with the current folder structure. */

    if (document.getElementById('siteFolderDivES') != null) {
        var div_id = 'siteFolderDivES'
        var browser = document.getElementById('BrowserAdd').checked;
    }
    else{
        var div_id = 'siteFolderDiv'
        var browser = document.getElementById('BrowserUpload').checked;
    }

    var siteFolderDiv = document.getElementById(div_id);
    while (siteFolderDiv.firstChild) {
        siteFolderDiv.removeChild(siteFolderDiv.firstChild);
    }

    if (browser) {
        var path = null;
        var pathDisplay = document.getElementById('pathDisplay');
        if (pathDisplay&&pathDisplay.options.length>2) {
            path = pathDisplay.options[2].text;
        }
        buildFolders(path, div_id, 'site');

    } else {

        var S3FolderInput = document.getElementById('S3FolderInput')
        var s3_folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
        if (div_id == 'siteFolderDivES') {
            var survey_id = selectedSurvey
            var org_id = 0
        }else{
            var survey_id = 0
            var org_id = document.getElementById('newSurveyOrg').value
        }
        
        if ((org_id||survey_id)&&s3_folder) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getFolderFirstFile/'+org_id+'/'+survey_id+'/'+s3_folder);
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  
                    buildFolders(reply, div_id, 'site');
                }
            }
            xhttp.send();
        }
        else{
            buildFolders(null, div_id, 'site');
        }
    }
}


function updateCamFolderSelect(){
    /** Updates the cam folder select element with the current folder structure. */

    if (document.getElementById('camFolderDivES') != null) {
        var div_id = 'camFolderDivES'
        var browser = document.getElementById('BrowserAdd').checked;
    }
    else{
        var div_id = 'camFolderDiv'
        var browser = document.getElementById('BrowserUpload').checked;
    }

    var camFolderDiv = document.getElementById(div_id);
    while (camFolderDiv.firstChild) {
        camFolderDiv.removeChild(camFolderDiv.firstChild);
    }

    if (browser) {
        var path = null;
        var pathDisplay = document.getElementById('pathDisplay');
        if (pathDisplay&&pathDisplay.options.length>2) {
            path = pathDisplay.options[2].text;
        }
        buildFolders(path, div_id, 'cam');

    } else {

        var S3FolderInput = document.getElementById('S3FolderInput')
        var s3_folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
        if (div_id == 'camFolderDivES') {
            var survey_id = selectedSurvey
            var org_id = 0
        }else{
            var survey_id = 0
            var org_id = document.getElementById('newSurveyOrg').value
        }
        if ((org_id||survey_id)&&s3_folder) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getFolderFirstFile/'+org_id+'/'+survey_id+'/'+s3_folder);
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  
                    buildFolders(reply, div_id, 'cam');
                }
            }
            xhttp.send();
        }
        else{
            buildFolders(null, div_id, 'cam');
        }
    }
}

function checkTrapgroupCode() {
    /** Checks the trapgroup code and updates the TG info field. */

    globalSurveyStructure = {}
    globalStructureCounts = {}
    structure_page = 1

    if (document.getElementById('addImagesTGCode')!=null) {
        siteFolderN = document.getElementById('siteFolderN_ES').checked
        siteIdentifier = document.getElementById('siteIdentifierES').checked
        if (siteFolderN) {
            tgCode = ''
            // look for a selected site folder
            selectedFolder = document.querySelector(".site-folder.selected");
            if (selectedFolder) {
                index = selectedFolder.dataset.index;
                tgCode = "(?:[^/]*/){"+index+"}([^/]*)"
            }
        } else {
            tgCode = document.getElementById('addImagesTGCode').value
        }
        infoDiv = document.getElementById('addImagesStructureDiv')
        browserChecked = document.getElementById('BrowserAdd').checked
        folderChecked = document.getElementById('S3BucketAdd').checked
        camLvlFolder = document.getElementById('camLvlFolderES').checked
        camSameAsSite = document.getElementById('camSameAsSiteES').checked
        camRegExp = document.getElementById('camRegExpES').checked

        if (camSameAsSite){
            camCode = tgCode
            camLvlFolder = false
            camRegExp = false
        }
        else{
            if (camRegExp) {
                camCode = document.getElementById('addImagesCamCode').value
                if (!document.getElementById('addImagesCamCheckbox').checked&&camCode!='') {
                    camCode += '[0-9]+'
                }
            }
            else if (camLvlFolder) {
                camCode = ''
                // look for a selected camera folder
                selectedFolder = document.querySelector(".cam-folder.selected");
                if (selectedFolder) {
                    index = selectedFolder.dataset.index;
                    camCode = "(?:[^/]*/){"+index+"}([^/]*)"
                }
            }
            else{
                camCode = 'None'
            }
        }
    } else {
        siteFolderN = document.getElementById('siteFolderN').checked
        siteIdentifier = document.getElementById('siteIdentifier').checked
        if (siteFolderN) {
            tgCode = ''
            // look for a selected site folder
            selectedFolder = document.querySelector(".site-folder.selected");
            if (selectedFolder) {
                index = selectedFolder.dataset.index;
                tgCode = "(?:[^/]*/){"+index+"}([^/]*)"
            }
        } else {
            tgCode = document.getElementById('newSurveyTGCode').value
        }
        infoDiv = document.getElementById('newSurveyStructureDiv')
        browserChecked = document.getElementById('BrowserUpload').checked
        folderChecked = document.getElementById('S3BucketUpload').checked
        camLvlFolder = document.getElementById('camLvlFolder').checked
        camSameAsSite = document.getElementById('camSameAsSite').checked
        camRegExp = document.getElementById('camRegExp').checked

        if(camSameAsSite) {
            camCode = tgCode
            camLvlFolder = false
            camRegExp = false
        }
        else{
            if (camRegExp) {
                camCode = document.getElementById('newSurveyCamCode').value
                if (!document.getElementById('camAdvancedCheckbox').checked&&camCode!='') {
                    camCode += '[0-9]+'
                }
            } else if (camLvlFolder) {
                camCode = ''
                // look for a selected camera folder
                selectedFolder = document.querySelector(".cam-folder.selected");
                if (selectedFolder) {
                    index = selectedFolder.dataset.index;
                    camCode = "(?:[^/]*/){"+index+"}([^/]*)"
                }
            }
            else{
                camCode = 'None'
            }
        }
    }


    if (siteIdentifier) {
        if (document.getElementById('addImagesTGCode')!=null) {
            if ((!document.getElementById('addImagesCheckbox').checked)&&(tgCode!='')) {
                tgCode+='[0-9]+'
                if (camSameAsSite) {
                    camCode+='[0-9]+'
                }
            }
        } else {
            if ((!document.getElementById('newSurveyCheckbox').checked)&&(tgCode!='')) {
                tgCode+='[0-9]+'
                if (camSameAsSite) {
                    camCode+='[0-9]+'
                }
            }
        }
    }

    infoDiv.innerHTML = ''
    if (browserChecked) {
        pathDisplay = document.getElementById('pathDisplay')
        if ((tgCode!='')&&(camCode!='')&&(pathDisplay.options.length>0)) {
            if (tgCode.endsWith('.*') || tgCode.endsWith('.+') || tgCode.endsWith('.*[0-9]+') || tgCode.endsWith('.+[0-9]+' )) {
                error_message = 'Your site identifier is invalid. Please try again or contact us for assistance.'
                infoDiv.innerHTML = error_message
            } else if (camCode.endsWith('.*') || camCode.endsWith('.+') || camCode.endsWith('.*[0-9]+') || camCode.endsWith('.+[0-9]+' )) {
                error_message = 'Your camera identifier is invalid. Please try again or contact us for assistance.'
                infoDiv.innerHTML = error_message
            } else {
                infoDiv.innerHTML = 'Checking...'
                pattern = new RegExp(tgCode)
                if (camCode != 'None') {
                    camPattern = new RegExp(camCode)
                }
                
                tgs = []
                cams = []
                structure = {}
                indices = {}
                for (let i=2;i<pathDisplay.options.length;i++) {
                    matches = pathDisplay.options[i].text.match(pattern)
                    match = null 
                    camMatch = null
                    if (matches!=null) {
                        if (siteFolderN){
                            match = matches[1]
                        }
                        else{
                            match = matches[0]
                        }
                    }
                    if (camCode == 'None') {
                        path_split = pathDisplay.options[i].text.split('/')
                        cam_folder = path_split[path_split.length-1]
                        camMatch = cam_folder
                    }
                    else{
                        camPath = pathDisplay.options[i].text
                        if (camCode != tgCode && !camLvlFolder) {
                            if (match!=null) {
                                camPath = camPath.replace(match, '')
                            }
                        }
                        camMatches = camPath.match(camPattern)
                        if (camMatches!=null) {
                            if (camLvlFolder) {
                                camMatch = camMatches[1]
                            } else if (camSameAsSite && siteFolderN) {
                                camMatch = camMatches[1]
                            } else {
                                camMatch = camMatches[0]
                            }
                        }
                    }
                    if (match!=null && camMatch!=null) {
                        tg = match
                        cam = camMatch
                        if (!tgs.includes(tg)) {
                            tgs.push(tg)
                        }
                        if (!cams.includes(cam)) {
                            cams.push(cam)
                        }
                        if (tg in structure) {
                            if (!structure[tg].includes(cam)){
                                structure[tg].push(cam)
                            }
                        }
                        else {
                            structure[tg] = [cam]
                        }
                        if (tg in indices) {
                            idx = pathDisplay.options[i].text.indexOf(tg)
                            if (cam in indices[tg]['cams']) {
                                indices[tg]['cams'][cam] = pathDisplay.options[i].text.indexOf(cam)
                            } else {
                                indices[tg]['cams'][cam] = pathDisplay.options[i].text.indexOf(cam)
                            }
                            if (indices[tg]['index'] > idx) {
                                indices[tg]['index'] = idx
                            }
                        } else {
                            indices[tg] = {
                                'index': pathDisplay.options[i].text.indexOf(tg),
                                'cams': {}
                            }
                            indices[tg]['cams'][cam] = pathDisplay.options[i].text.indexOf(cam)
                        }

                    }
                }

                validStructure = true
                infoDiv.innerHTML = ''
                if (tgs.length==0) {
                    validStructure = false
                }
                if (cams.length==0) {
                    validStructure = false
                }
                var totCams = 0
                var highestCamsPerSite = 0
                for (let i=0;i<tgs.length;i++) {
                    if (structure[tgs[i]].length==0) {
                        validStructure = false
                    }
                    totCams += structure[tgs[i]].length
                    highestCamsPerSite = Math.max(highestCamsPerSite, structure[tgs[i]].length)
                }

                //Need to check that the cameras are not before the sites in the structure
                for (let i=0;i<tgs.length;i++) {
                    tg = tgs[i]
                    for (let j=0;j<structure[tg].length;j++) {
                        cam = structure[tg][j]
                        if (indices[tg]['index'] > indices[tg]['cams'][cam]) {
                            validStructure = false
                            break
                        }
                    }
                    if (!validStructure) {
                        break
                    }
                }

                if (validStructure) {
                    structure_page = 1
                    page_count = 1
                    globalSurveyStructure = {}
                    globalSurveyStructure[page_count] = {}
                    
                    globalStructureCounts['sites'] = tgs.length
                    globalStructureCounts['cameras'] = totCams

                    for (let i=0;i<tgs.length;i++) {
                        globalSurveyStructure[page_count][tgs[i]] = structure[tgs[i]]
                        if (Object.keys(globalSurveyStructure[page_count]).length == tags_per_page && i < tgs.length-1) {
                            page_count += 1
                            globalSurveyStructure[page_count] = {}
                        }
                    }

                    if (highestCamsPerSite > 2) {
                        document.getElementById('modalAlertHeader').innerHTML = "Warning"
                        document.getElementById('modalAlertBody').innerHTML = "<p>More than 2 cameras are associated with at least one site/station. This is unusual, as sites/stations typically have only 1 or 2 cameras, and a survey typically contains multiple sites/stations.<br><br>Please verify that your site/station and camera identifiers are correct as well as the detected survey structure. If this setup is intentional, you may safely ignore this message.</p>"
                        modalAlert.modal({keyboard: true, backdrop: 'static'})
                    }
                }
                else{
                    globalSurveyStructure = {}
                    globalStructureCounts = {}
                    structure_page = 1
                    infoDiv.innerHTML = 'Invalid structure. Please check your site and camera identifiers.'
                }

            }
        }
    } else if (folderChecked) {
        S3FolderInput = document.getElementById('S3FolderInput')
        folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
    
        if ((tgCode!='')&&(folder!='')) {
            infoDiv.innerHTML = 'Checking...'

            if (!checkingTGC) {
                checkingTGC = true
                pingTgCheck()
                // tgCheckTimer = setTimeout(function() { pingTgCheck(); }, 3000)
            }
            
            // checkingTrapgroupCode = true
            // tgCheckFolder = folder
            // tgCheckCode = tgCode
    
            // var formData = new FormData()
            // formData.append("tgCode", tgCode)
            // formData.append("folder", folder)
            // formData.append("task_id", 'none')
        
            // var xhttp = new XMLHttpRequest();
            // xhttp.onreadystatechange =
            // function(){
            //     if (this.readyState == 4 && this.status == 200) {
            //         S3FolderInput = document.getElementById('S3FolderInput')
            //         folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
            //         if (folder!='') {
            //             response = JSON.parse(this.responseText)
            //             if (response.status == 'PENDING') {
            //                 tgCheckID = response.data
            //                 tgCheckTimer = setInterval(pingTgCheck, 5000)
            //                 if (tgCheckTimer != null) {
            //                     clearInterval(tgCheckTimer)
            //                     tgCheckTimer = setInterval(pingTgCheck, 5000)
            //                 } else {
            //                     tgCheckTimer = setInterval(pingTgCheck, 5000)
            //                 }
            //             }
            //         }
            //         checkingTrapgroupCode = false
            //     }
            // }
            // xhttp.open("POST", '/checkTrapgroupCode');
            // xhttp.send(formData);
        }
    }

    updateSurveyStructure()
}

function updateTgCode() {
    /** Extracts the info from the trapgroup code builder and populates the trapgroup code accordingly. */

    tgCode = ''
    charSelects = document.querySelectorAll('[id^=charSelect-]')
    for (let i=0;i<charSelects.length;i++) {
        IDNum = charSelects[i].id.split("-")[charSelects[i].id.split("-").length-1]
        
        selection = charSelects[i].options[charSelects[i].selectedIndex].text
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

    if (tgCode.endsWith('.*') || tgCode.endsWith('.+') || tgCode.endsWith('.*[0-9]+') || tgCode.endsWith('.+[0-9]+' )) {
        error_message = 'Your site identifier is invalid. Please try again or contact us for assistance.'
        if (document.getElementById('addImagesTGCode')!=null) {
            document.getElementById('addFilesErrors').innerHTML = error_message
        }
        else {
            document.getElementById('newSurveyErrors').innerHTML = error_message
        }
    } else {
        checkTrapgroupCode()
    }
    
}

function buildTgBuilderRow() {
    /** Builds a row for the trapgroup code builder. */

    IDNum = getIdNumforNext('charSelect-')

    if (IDNum==0) {
        // Initialising - build headings
        if (document.getElementById('addImagesTGCode')!=null) {
            tgBuilder = document.getElementById('addImagesTgBuilder')
        } else {
            tgBuilder = document.getElementById('newSurveyTgBuilder')
        }

        while(tgBuilder.firstChild){
            tgBuilder.removeChild(tgBuilder.firstChild);
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
        $("#addImagesCamCode").change( function() {
            checkTrapgroupCode()
        })
        $("#addImagesCamCheckbox").change( function() {
            checkTrapgroupCode()
        })
    } else {
        $("#newSurveyTGCode").change( function() {
            checkTrapgroupCode()
        })
        $("#newSurveyCheckbox").change( function() {
            checkTrapgroupCode()
        })
        $("#newSurveyCamCode").change( function() {
            checkTrapgroupCode()
        })
        $("#camAdvancedCheckbox").change( function() {
            checkTrapgroupCode()
        })
    }

    $("#S3FolderInput").change( function() {
        updateSiteFolderSelect()
        updateCamFolderSelect()
        checkTrapgroupCode()
    });

    updateSiteFolderSelect()
    updateCamFolderSelect()
    checkTrapgroupCode()
}

function buildAddIms() {
    /** Builds the add images form for use in the edit survey modal. */
    
    addFilesDiv = document.getElementById('addFilesDiv')
    // addFilesDiv.appendChild(document.createElement('br'))

    // Upload Type
    UTdiv = document.createElement('div')
    if (cloudAccess=='False') {
        UTdiv.setAttribute('hidden','true')
    }
    addFilesDiv.appendChild(UTdiv)

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Upload Type'
    UTdiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>The file-upload method you would like to use.</i>'
    UTdiv.appendChild(div)

    div = document.createElement('div')
    div.setAttribute('class','custom-control custom-radio custom-control-inline')
    UTdiv.appendChild(div)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','BrowserAdd')
    input.setAttribute('name','addImagesSelection')
    input.setAttribute('value','customEx')
    input.setAttribute('checked','true')
    div.appendChild(input)

    label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','BrowserAdd')
    label.innerHTML = 'Browser Upload (Recommended)'
    div.appendChild(label)

    div = document.createElement('div')
    div.setAttribute('class','custom-control custom-radio custom-control-inline')
    UTdiv.appendChild(div)

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
    label.innerHTML = 'Bucket Upload'
    div.appendChild(label)

    UTdiv.appendChild(document.createElement('br'))
    UTdiv.appendChild(document.createElement('br'))

    div = document.createElement('div')
    div.setAttribute('id','addImagesFormDiv')
    addFilesDiv.appendChild(div)

    $("#S3BucketAdd").change( function() {
        S3BucketAdd = document.getElementById('S3BucketAdd')
        if (S3BucketAdd.checked) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getFolders?survey_id='+selectedSurvey);
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
    h5.innerHTML = 'Site/Station Identifier'
    addFilesDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Select how you would like to identify your site. Please note that <span style="color: #DF691A">a site is not an area - it is a singular point in space</span> that can be described using a single pair of coordinates (latitude,longitude). If there are multiple cameras at a site, these cameras would typically be triggered by the same event - ie. an animal passing by. Typically, a multiple-camera-per-site setup would be cameras overlooking the same waterhole or bait station, or on either side of a game trail to capture both flanks of individuals as they pass by.</i>'
    addFilesDiv.appendChild(div)

    // info = document.createElement('div')
    // info.setAttribute('id','addImagesTGInfo')
    // info.setAttribute('style','font-size: 80%; color: #DF691A')
    // addFilesDiv.appendChild(info)

    var div = document.createElement('div')
    div.style.marginBottom = '5px'
    addFilesDiv.appendChild(div)

    var radioDiv = document.createElement('div')
    radioDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    div.appendChild(radioDiv)

    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','siteFolderN_ES')
    input.setAttribute('name','siteCodeSelection')
    input.setAttribute('value','0')
    input.checked = true
    input.setAttribute('onchange','updateSiteDiv()')
    radioDiv.appendChild(input)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','siteFolderN_ES')
    label.innerHTML = 'Folder'
    radioDiv.appendChild(label)

    var radioDiv = document.createElement('div')
    radioDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    div.appendChild(radioDiv)
    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','siteIdentifierES')
    input.setAttribute('name','siteCodeSelection')
    input.setAttribute('value','0')
    input.checked = false
    input.setAttribute('onchange','updateSiteDiv()')
    radioDiv.appendChild(input)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','siteIdentifierES')
    label.innerHTML = 'Site Identifier'
    radioDiv.appendChild(label)

    var div = document.createElement('div')
    div.id = 'addImagesSiteDesc'
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Select the folder level from the path below that corresponds to the sites/stations in your folder structure. For example, in "Survey/Site1/Camera1", you should select the "Site1" folder.</i>'
    addFilesDiv.appendChild(div)

    var div = document.createElement('div')
    div.setAttribute('id','siteFolderDivES')
    div.innerHTML = 'No files selected.'
    div.hidden = false
    addFilesDiv.appendChild(div)

    var div = document.createElement('div')
    div.setAttribute('id','siteIdDivES')
    div.hidden = true
    addFilesDiv.appendChild(div)

    row = document.createElement('div')
    row.classList.add('row')
    div.appendChild(row)

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
    addFilesDiv.appendChild(tgBuilder)

    addFilesDiv.appendChild(document.createElement('br'))

    $("#addImagesCheckbox").change( function() {
        addImagesCheckbox = document.getElementById('addImagesCheckbox')
        if (addImagesCheckbox.checked) {
            document.getElementById('addFilesErrors').innerHTML = 'Note that you are now required to enter a regular expression for your site identifier. It will be used to identify your sites based on your folder structure.'
            buildTgBuilderRow()
        } else {
            document.getElementById('addFilesErrors').innerHTML = ''

            // Clear TG Builder
            addImagesTgBuilder = document.getElementById('addImagesTgBuilder')
            while(addImagesTgBuilder.firstChild){
                addImagesTgBuilder.removeChild(addImagesTgBuilder.firstChild);
            }    
        }
    })

    // Camera Code
    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Camera Identifier'
    addFilesDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>How many cameras do you have per site/station?</i>'
    addFilesDiv.appendChild(div)

    var div = document.createElement('div')
    div.style.marginBottom = '5px'
    addFilesDiv.appendChild(div)

    var radioDiv = document.createElement('div')
    radioDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    div.appendChild(radioDiv)

    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','camSameAsSiteES')
    input.setAttribute('name','camSelectionES')
    input.setAttribute('value','customEx')
    input.checked = true
    input.setAttribute('onchange','updateCamDiv()')
    radioDiv.appendChild(input)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','camSameAsSiteES')
    label.innerHTML = 'One camera per site/station'
    radioDiv.appendChild(label)

    var radioDiv = document.createElement('div')
    radioDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    div.appendChild(radioDiv)

    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','multipleCamES')
    input.setAttribute('name','camSelectionES')
    input.setAttribute('value','customEx')
    input.checked = false
    input.setAttribute('onchange','updateCamDiv()')
    radioDiv.appendChild(input)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','multipleCamES')
    label.innerHTML = 'Multiple cameras per site/station'
    radioDiv.appendChild(label)

    var multiCamDiv = document.createElement('div')
    multiCamDiv.setAttribute('id','multiCamDivES')
    multiCamDiv.hidden = true
    addFilesDiv.appendChild(multiCamDiv)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Select the method you would like to use to identify your cameras.</i>'
    multiCamDiv.appendChild(div)

    var div = document.createElement('div')
    div.style.marginBottom = '5px'
    multiCamDiv.appendChild(div)

    var radioDiv = document.createElement('div')
    radioDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    div.appendChild(radioDiv)

    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','camLvlFolderES')
    input.setAttribute('name','camCodeSelectionES')
    input.setAttribute('value','customEx')
    input.checked = true
    input.setAttribute('onchange','updateCamDiv()')
    radioDiv.appendChild(input)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','camLvlFolderES')
    label.innerHTML = 'Folder'
    radioDiv.appendChild(label)

    var radioDiv = document.createElement('div')
    radioDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    div.appendChild(radioDiv)

    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.classList.add('custom-control-input')
    input.setAttribute('id','camRegExpES')
    input.setAttribute('name','camCodeSelectionES')
    input.setAttribute('value','customEx')
    input.checked = false
    input.setAttribute('onchange','updateCamDiv()')
    radioDiv.appendChild(input)

    var label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','camRegExpES')
    label.innerHTML = 'Camera Identifier'
    radioDiv.appendChild(label)

    div = document.createElement('div')
    div.id = 'addImagesCamDesc'
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Select the folder level from the path below that corresponds to the cameras in your folder structure. For example, in "Survey/Site1/Camera1", you should select the "Camera1" folder.</i>'
    multiCamDiv.appendChild(div)

    var camFDiv = document.createElement('div')
    camFDiv.setAttribute('id','camFolderDivES')
    camFDiv.hidden = true
    camFDiv.innerHTML = 'No files selected.'
    addFilesDiv.appendChild(camFDiv)

    var camDiv = document.createElement('div')
    camDiv.id = 'addImagesCamDiv'
    camDiv.hidden = true
    addFilesDiv.appendChild(camDiv)

    row = document.createElement('div')
    row.classList.add('row')
    camDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    row.appendChild(col1)

    input = document.createElement('input')
    input.setAttribute('type','text')
    input.classList.add('form-control')
    input.required = true
    input.setAttribute('id','addImagesCamCode')
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
    input2.setAttribute('id','addImagesCamCheckbox')
    input2.setAttribute('name','addImagesCamCheckbox')
    checkDiv.appendChild(input2)

    label = document.createElement('label')
    label.classList.add('custom-control-label')
    label.setAttribute('for','addImagesCamCheckbox')
    label.innerHTML = 'Advanced'
    checkDiv.appendChild(label)

    cameraBuilder = document.createElement('div')
    cameraBuilder.setAttribute('id','addImagesCamBuilder')
    camDiv.appendChild(cameraBuilder)


    $("#addImagesCamCheckbox").change( function() {
        addImagesCamCheckbox = document.getElementById('addImagesCamCheckbox')
        if (addImagesCamCheckbox.checked) {
            document.getElementById('addFilesErrors').innerHTML = 'Note that you are now required to enter a regular expression for your camera identifier. It will be used to identify your cameras based on your folder structure.'
            buildCamBuilderRow()
        } else {
            document.getElementById('addFilesErrors').innerHTML = ''

            // Clear TG Builder
            addImagesCameraBuilder = document.getElementById('addImagesCamBuilder')
            while(addImagesCameraBuilder.firstChild){
                addImagesCameraBuilder.removeChild(addImagesCameraBuilder.firstChild);
            }
        }
    })

    addFilesDiv.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Structure'
    addFilesDiv.appendChild(h5)

    var div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Check the detected structure of your survey. Eg. "Site1 : Camera1, Camera2", "Site2 : Camera3", etc. </i>'
    addFilesDiv.appendChild(div)

    var div = document.createElement('div')
    div.setAttribute('id','addImagesStructureDiv')
    div.setAttribute('style','font-size: 80%; color: #DF691A')
    addFilesDiv.appendChild(div)

    var addImagesStructureDiv2 = document.createElement('div')
    addImagesStructureDiv2.setAttribute('id','addImagesStructureDiv2')
    addFilesDiv.appendChild(addImagesStructureDiv2)

    var row = document.createElement('div')
    row.classList.add('row')
    addImagesStructureDiv2.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-1')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-10')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-1')
    row.appendChild(col3)

    var btn = document.createElement('button')
    btn.setAttribute('class','btn btn-primary btn-sm')
    btn.setAttribute('id','btnPrevStructureES')
    btn.innerHTML = '<'
    btn.onclick = function() { prevStructure() }
    btn.hidden = true
    col1.appendChild(btn)

    var btn = document.createElement('button')
    btn.setAttribute('class','btn btn-primary btn-sm pull-right')
    btn.setAttribute('id','btnNextStructureES')
    btn.innerHTML = '>'
    btn.onclick = function() { nextStructure() }
    btn.hidden = true
    col3.appendChild(btn)


    buildBrowserUpload('addImagesFormDiv')
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

            if ((reply.survey==selectedSurvey)&&(modalEditSurvey.is(':visible'))) {
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

                var table = document.createElement('table')
                table.classList.add('table');
                table.classList.add('table-striped');
                table.classList.add('table-bordered');
                // table.classList.add('table-hover');
                table.style.borderCollapse = 'collapse'
                table.style.border = '1px solid rgba(0,0,0,0)'
                addImagesCamerasDiv.appendChild(table)
    
                var thead = document.createElement('thead')
                table.appendChild(thead)
    
                var tr = document.createElement('tr')
                thead.appendChild(tr)
    
                var th = document.createElement('th')
                th.innerHTML = 'Site'
                th.setAttribute('width','10%')
                tr.appendChild(th)
    
                var th = document.createElement('th')
                th.innerHTML = 'Camera'
                th.setAttribute('width','50%')
                tr.appendChild(th)
    
                var th = document.createElement('th')
                th.innerHTML = 'Current Timestamp'
                th.setAttribute('width','20%')
                tr.appendChild(th)
    
                var th = document.createElement('th')
                th.innerHTML = 'Corrected Timestamp'
                th.setAttribute('width','20%')
                tr.appendChild(th)

            
                for (let trapgroup=0;trapgroup<reply.length;trapgroup++) {
                    var tbody = document.createElement('tbody');
                    tbody.classList.add('timestamps')
                    table.appendChild(tbody);

                    for (let camera=0;camera<reply[trapgroup].cameras.length;camera++) {

                        var tr = document.createElement('tr')
                        tbody.appendChild(tr)

                        if (camera==0) {
                            var td = document.createElement('td')
                            td.setAttribute('rowspan',reply[trapgroup].cameras.length)
                            td.setAttribute('style', 'text-align:left; padding-top: 0px; padding-bottom: 0px; vertical-align: middle;' )
                            td.innerHTML = reply[trapgroup].tag
                            tr.appendChild(td)
                        }

                        var td = document.createElement('td')
                        td.setAttribute('style', 'text-align:left; padding-top: 0px; padding-bottom: 0px; vertical-align: middle;')
                        td.innerHTML = reply[trapgroup].cameras[camera].folder
                        tr.appendChild(td)

                        var td = document.createElement('td')
                        td.setAttribute('style', 'text-align:left; padding-top: 0px; padding-bottom: 0px; vertical-align: middle;')
                        td.innerHTML = reply[trapgroup].cameras[camera].corrected_timestamp
                        tr.appendChild(td)

                        var td = document.createElement('td')
                        td.setAttribute('style', ' padding: 0px; vertical-align: middle;')
                        tr.appendChild(td)
    
                        input = document.createElement('input')
                        input.setAttribute('type','text')
                        // input.setAttribute('style','width: td.offsetWidth; height: td.offsetHeight; padding: 0px; margin: 0px;')
                        input.classList.add('form-control')
                        global_original_timestamps[reply[trapgroup].cameras[camera].id] = reply[trapgroup].cameras[camera].corrected_timestamp
                        if (reply[trapgroup].cameras[camera].id in global_corrected_timestamps) {
                            input.value = global_corrected_timestamps[reply[trapgroup].cameras[camera].id]
                        } else {
                            // input.value = reply[trapgroup].cameras[camera].corrected_timestamp
                            input.value = ''
                        }
                        input.setAttribute('id','corrected_timestamp-'+reply[trapgroup].cameras[camera].id.toString())
                        td.appendChild(input)

                        $('#corrected_timestamp-'+reply[trapgroup].cameras[camera].id.toString()).change( function(wrapID) {
                            return function() {
                                corrected_timestamp = document.getElementById('corrected_timestamp-'+wrapID.toString())
                                if (corrected_timestamp.value==''){
                                    delete global_corrected_timestamps[wrapID]
                                }
                                else{
                                    if (isValidDate(new Date(corrected_timestamp.value))) {
                                        const timestamp_format = new RegExp('^[0-9]{4}/[0-9]{2}/[0-9]{2} [0-9]{2}:[0-5][0-9]:[0-5][0-9]$')
                                        if (timestamp_format.test(corrected_timestamp.value)) {
                                            document.getElementById('timestampErrors').innerHTML = ''
                                            global_corrected_timestamps[wrapID] = corrected_timestamp.value
                                        } else {
                                            document.getElementById('timestampErrors').innerHTML = 'Please enter your timestamps in the format YYYY/MM/DD HH:MM:SS.'
                                            delete global_corrected_timestamps[wrapID]
                                        }
                                    } else {
                                        document.getElementById('timestampErrors').innerHTML = 'There are one or more invalid dates.'
                                        delete global_corrected_timestamps[wrapID]
                                    }
                                }
                            }
                        }(reply[trapgroup].cameras[camera].id));
                    }
                }
            }
        }
    }
    xhttp.send();
}

function buildEditTimestamp() {
    /** Builds the form for editing timestamps on the edit survey modal. */

    global_corrected_timestamps = {}
    global_original_timestamps = {}

    editTimestampsDiv = document.getElementById('editTimestampsDiv')

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Edit Timestamps'
    editTimestampsDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Here you can view and edit the timestamps of the fist image taken by each camera in the selected survey. All images taken by an edited camera will be shifted by the same amount.</i>'
    editTimestampsDiv.appendChild(div)

    errors = document.createElement('div')
    errors.setAttribute('id','timestampErrors')
    errors.setAttribute('style','font-size: 80%; color: #DF691A')
    editTimestampsDiv.appendChild(errors)

    editTimestampsDiv.appendChild(document.createElement('br'))

    addImagesCamerasDiv = document.createElement('div')
    addImagesCamerasDiv.setAttribute('id','addImagesCamerasDiv')
    editTimestampsDiv.appendChild(addImagesCamerasDiv)

    editTimestampsDiv.appendChild(document.createElement('br'))

    row = document.createElement('div')
    row.classList.add('row')
    editTimestampsDiv.appendChild(row)

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

function buildEditImageTimestamp() {
    /** Builds the form for editing timestamps on the edit survey modal. */

    new_missing_timestamps = {}
    corrected_extracted_timestamps = {}
    original_extracted_timestamps = {}
    corrected_edited_timestamps = {}
    original_edited_timestamps = {}
    selectedTimestampType = 'missing'
    mapTime = null
    imageIndex = 0
    cameraReadAheadIndex = 0
    cameraIndex = 0
    images = []
    camera_ids = []

    editImgTimestampsDiv = document.getElementById('editImgTimestampsDiv')

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Edit File Timestamps'
    editImgTimestampsDiv.appendChild(h5)

    var row = document.createElement('div')
    editImgTimestampsDiv.appendChild(row)
    
    var radio = document.createElement('div')
    radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    row.appendChild(radio)

    var input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','missingTimestamps')
    input.setAttribute('name','timestampCorrection')
    input.setAttribute('value','customEx')
    radio.appendChild(input)

    var label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','missingTimestamps')
    label.innerHTML = 'Missing Timestamps'
    radio.appendChild(label)

    document.getElementById('missingTimestamps').addEventListener('click', ()=>{
        document.getElementById('correctTimestampsDecscription').innerHTML = '<i>Here you add timestamps to images or videos that do not have them. </i>'
        selectedTimestampType = 'missing'
        imageIndex = 0
        cameraIndex = 0
        cameraReadAheadIndex = 0
        images = []
        camera_ids = []
        mapTime = null
        buildTimestampsMap()
    });

    radio = document.createElement('div')
    radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    row.appendChild(radio)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','extractedTimestamps')
    input.setAttribute('name','timestampCorrection')
    input.setAttribute('value','customEx')
    radio.appendChild(input)

    label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','extractedTimestamps')
    label.innerHTML = 'Extracted Timestamps'
    radio.appendChild(label)

    document.getElementById('extractedTimestamps').addEventListener('click', ()=>{
        document.getElementById('correctTimestampsDecscription').innerHTML = '<i>Here you can view and edit the timestamps of videos and images that were visually extracted by AI. </i>'
        selectedTimestampType = 'extracted'
        imageIndex = 0
        cameraIndex = 0
        cameraReadAheadIndex = 0
        images = []
        camera_ids = []
        mapTime = null
        buildTimestampsMap()
    });

    radio = document.createElement('div')
    radio.setAttribute('class','custom-control custom-radio custom-control-inline')
    row.appendChild(radio)

    input = document.createElement('input')
    input.setAttribute('type','radio')
    input.setAttribute('class','custom-control-input')
    input.setAttribute('id','editedTimestamps')
    input.setAttribute('name','timestampCorrection')
    input.setAttribute('value','customEx')
    radio.appendChild(input)

    label = document.createElement('label')
    label.setAttribute('class','custom-control-label')
    label.setAttribute('for','editedTimestamps')
    label.innerHTML = 'Edited Timestamps'
    radio.appendChild(label)

    document.getElementById('editedTimestamps').addEventListener('click', ()=>{
        document.getElementById('correctTimestampsDecscription').innerHTML = '<i>Here you can view and edit the timestamps of videos and images that you have edited. </i>'
        selectedTimestampType = 'edited'
        imageIndex = 0
        cameraIndex = 0
        cameraReadAheadIndex = 0
        images = []
        camera_ids = []
        mapTime = null
        buildTimestampsMap()
    });

    div = document.createElement('div')
    div.id = 'correctTimestampsDecscription'
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Here you can add timestamps to images or videos that do not have any timestamps. </i>'
    editImgTimestampsDiv.appendChild(div)

    var row = document.createElement('div')
    row.classList.add('row')
    editImgTimestampsDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    col1.setAttribute('style', 'padding-right: 0px;')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-10')
    col2.setAttribute('style','padding-right: 0px;')
    row.appendChild(col2)

    timestampsFilterDiv = document.createElement('div')
    timestampsFilterDiv.setAttribute('id','timestampsFilterDiv')
    timestampsFilterDiv.setAttribute('style','margin-top: 10px')
    col1.appendChild(timestampsFilterDiv)

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Site'
    timestampsFilterDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Filter your files by site.</i>'
    timestampsFilterDiv.appendChild(div)

    var select = document.createElement('select');
    select.id = 'timeSiteSelect';
    select.classList.add('form-control');
    timestampsFilterDiv.appendChild(select);

    document.getElementById('timeSiteSelect').addEventListener('change', ()=>{
        imageIndex = 0
        cameraIndex = 0
        cameraReadAheadIndex = 0
        images = []
        camera_ids = []
        mapTime = null

        timeCamSelect = document.getElementById('timeCamSelect')
        clearSelect(timeCamSelect)
        optionTexts = ['All']
        optionValues = ['0']
        site_id = parseInt(document.getElementById('timeSiteSelect').value)
        if (site_id != 0) {
            for (var i=0; i<timestampCameras[site_id].length; i++) {
                optionTexts.push(timestampCameras[site_id][i].name)
                optionValues.push(timestampCameras[site_id][i].id)
            }
        }
        fillSelect(timeCamSelect, optionTexts, optionValues)

        buildTimestampsMap()
    });

    timeSiteSelect = document.getElementById('timeSiteSelect')
    clearSelect(timeSiteSelect)

    optionTexts = ['All']
    optionValues = ['0']
    for (var i=0; i<timestampSites.length; i++) {
        optionTexts.push(timestampSites[i].name)
        optionValues.push(timestampSites[i].id)
    }

    fillSelect(timeSiteSelect, optionTexts, optionValues)

    timestampsFilterDiv.appendChild(document.createElement('br'))
    
    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Camera'
    timestampsFilterDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Filter your files by camera.</i>'
    timestampsFilterDiv.appendChild(div)

    var select = document.createElement('select');
    select.id = 'timeCamSelect';
    select.classList.add('form-control');
    timestampsFilterDiv.appendChild(select);

    document.getElementById('timeCamSelect').addEventListener('change', ()=>{
        imageIndex = 0
        cameraIndex = 0
        cameraReadAheadIndex = 0
        images = []
        camera_ids = []
        mapTime = null
        buildTimestampsMap()
    });

    timeCamSelect = document.getElementById('timeCamSelect')
    clearSelect(timeCamSelect)
    optionTexts = ['All']
    optionValues = ['0']
    fillSelect(timeCamSelect, optionTexts, optionValues)

    timestampsFilterDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Species'
    timestampsFilterDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Filter your files by species.</i>'
    timestampsFilterDiv.appendChild(div)

    var select = document.createElement('select');
    select.id = 'timeSpeciesSelect';
    select.classList.add('form-control');
    timestampsFilterDiv.appendChild(select);

    document.getElementById('timeSpeciesSelect').addEventListener('change', ()=>{
        imageIndex = 0
        cameraIndex = 0
        cameraReadAheadIndex = 0
        images = []
        camera_ids = []
        mapTime = null
        buildTimestampsMap()
    });

    timeSpeciesSelect = document.getElementById('timeSpeciesSelect')
    clearSelect(timeSpeciesSelect)

    optionTexts = ['All']
    optionValues = ['0']
    for (var i=0; i<timestampSpecies.length; i++) {
        optionTexts.push(timestampSpecies[i])
        optionValues.push(timestampSpecies[i])
    }

    fillSelect(timeSpeciesSelect, optionTexts, optionValues)

    timestampsFilterDiv.appendChild(document.createElement('br'))

    addImagesImagesDiv = document.createElement('div')
    addImagesImagesDiv.setAttribute('id','addImagesImagesDiv')
    addImagesImagesDiv.setAttribute('style','margin-top: 10px')
    col2.appendChild(addImagesImagesDiv)

    document.getElementById('missingTimestamps').click()
}

function buildKml() {
    /** Builds the kml upload functionality in the edit survey modal. */
    
    addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
    addImsCoordsDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Site Coordinates'
    addImsCoordsDiv.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Upload a kml file containing your site coordinates. This can be exported from <a href="https://earth.google.com/web/">Google Earth</a>.</i>'
    addImsCoordsDiv.appendChild(div)

    row = document.createElement('div')
    row.classList.add('row')
    addImsCoordsDiv.appendChild(row)

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

    addImsCoordsDiv.appendChild(document.createElement('br'))

    $("#kmlFileUpload2").change( function() {
        if (document.getElementById("kmlFileUpload2").files.length > 0) {
            document.getElementById('kmlFileUploadText2').value = document.getElementById("kmlFileUpload2").files[0].name
        } else {
            document.getElementById('kmlFileUploadText2').value = ''
        }
    })
}

function openAddImages(){
    /** Listens for and initialises the add images form on the edit survey modal when the radio button is selected. */
    clearAddFilesModal()
    buildAddIms()
}

function buildManualCoords() {
    /** Build the manual coords editor */
    var coordsButtonsDiv = document.getElementById('coordsButtonsDiv')
    while(coordsButtonsDiv.firstChild){
        coordsButtonsDiv.removeChild(coordsButtonsDiv.firstChild);
    }

    coordsButtonsDiv.appendChild(document.createElement('br'))

    var row = document.createElement('div')
    row.classList.add('row')
    coordsButtonsDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    var btnPrevSites = document.createElement('button')
    btnPrevSites.setAttribute("class","btn btn-primary btn-block")
    btnPrevSites.setAttribute("id","btnPrevSites")
    btnPrevSites.innerHTML = 'Previous'
    col1.appendChild(btnPrevSites)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-8')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var btnNextSites = document.createElement('button')
    btnNextSites.setAttribute("class","btn btn-primary btn-block")
    btnNextSites.setAttribute("id","btnNextSites")
    btnNextSites.innerHTML = 'Next'
    col3.appendChild(btnNextSites)

    btnNextSites.addEventListener('click', ()=>{
        getCoords(next_sites_url)
    });
    
    btnPrevSites.addEventListener('click', ()=>{
        getCoords(prev_sites_url)
    });

    getCoords()

}

function getCoords(url='/getTrapgroupCoords') {
    /** Get the coordinates for the selected survey */
    if (url=='/getTrapgroupCoords') {
        url += '?survey_id='+selectedSurvey
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", url);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            if (reply.next_url==null) {
                document.getElementById('btnNextSites').style.visibility = 'hidden'
            } else {
                document.getElementById('btnNextSites').style.visibility = 'visible'
                next_sites_url = reply.next_url
            }

            if (reply.prev_url==null) {
                document.getElementById('btnPrevSites').style.visibility = 'hidden'
            } else {
                document.getElementById('btnPrevSites').style.visibility = 'visible'
                prev_sites_url = reply.prev_url
            }
            
            addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
            while(addImsCoordsDiv.firstChild){
                addImsCoordsDiv.removeChild(addImsCoordsDiv.firstChild);
            }
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
            
            trapgroups = reply.trapgroups

            for (let i=0;i<trapgroups.length;i++) {
                trapgroup = trapgroups[i]
                original_coordinates[trapgroup.id] = {'latitude':trapgroup.latitude, 'longitude':trapgroup.longitude, 'altitude':trapgroup.altitude}
                if (!corrected_coordinates[trapgroup.id]) {
                    corrected_coordinates[trapgroup.id] = {}
                }

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
                input1.setAttribute('id','latitude-'+trapgroup.id)
                if (corrected_coordinates[trapgroup.id].latitude) {
                    input1.value = corrected_coordinates[trapgroup.id].latitude
                } else {
                    input1.value = trapgroup.latitude
                }
                col2.appendChild(input1)

                col3 = document.createElement('div')
                col3.setAttribute('class','col-lg-3')
                row.appendChild(col3)

                input2 = document.createElement('input')
                input2.setAttribute('type','text')
                input2.setAttribute('class','form-control')
                input2.setAttribute('id','longitude-'+trapgroup.id)
                if (corrected_coordinates[trapgroup.id].longitude) {
                    input2.value = corrected_coordinates[trapgroup.id].longitude
                } else {
                    input2.value = trapgroup.longitude
                }
                col3.appendChild(input2)

                col4 = document.createElement('div')
                col4.setAttribute('class','col-lg-3')
                row.appendChild(col4)

                input3 = document.createElement('input')
                input3.setAttribute('type','text')
                input3.setAttribute('class','form-control')
                input3.setAttribute('id','altitude-'+trapgroup.id)
                if (corrected_coordinates[trapgroup.id].altitude) {
                    input3.value = corrected_coordinates[trapgroup.id].altitude
                } else {
                    input3.value = trapgroup.altitude
                }
                col4.appendChild(input3)

                $('#latitude-'+trapgroup.id).change(function(wrapID) {
                    return function() {
                        coordID = 'latitude-'+wrapID.toString()
                        latitude = document.getElementById(coordID)
                        if (isNaN(latitude.value)) {
                            if (!coordProblems.includes(coordID)) {coordProblems.push(coordID)}
                            delete corrected_coordinates[wrapID].latitude
                        } else {
                            if (coordProblems.includes(coordID)) {coordProblems.splice(coordProblems.indexOf(coordID), 1)}
                            if (latitude.value!=original_coordinates[wrapID].latitude) {
                                corrected_coordinates[wrapID].latitude = latitude.value
                            } else {
                                delete corrected_coordinates[wrapID].latitude
                            }
                        }
                        if (coordProblems.length>0) {
                            document.getElementById('editSurveyErrors').innerHTML = 'Invalid coordinates. Please enter a valid number.'
                        } else {
                            document.getElementById('editSurveyErrors').innerHTML = ''
                        }
                    }
                }(trapgroup.id));

                $('#longitude-'+trapgroup.id).change(function(wrapID) {
                    return function() {
                        coordID = 'longitude-'+wrapID.toString()
                        longitude = document.getElementById(coordID)
                        if (isNaN(longitude.value)) {
                            if (!coordProblems.includes(coordID)) {coordProblems.push(coordID)}
                            delete corrected_coordinates[wrapID].longitude
                        } else {
                            if (coordProblems.includes(coordID)) {coordProblems.splice(coordProblems.indexOf(coordID), 1)}
                            if (longitude.value!=original_coordinates[wrapID].longitude) {
                                corrected_coordinates[wrapID].longitude = longitude.value
                            } else {
                                delete corrected_coordinates[wrapID].longitude
                            }
                        }
                        if (coordProblems.length>0) {
                            document.getElementById('editSurveyErrors').innerHTML = 'Invalid coordinates. Please enter a valid number.'
                        } else {
                            document.getElementById('editSurveyErrors').innerHTML = ''
                        }
                    }
                }(trapgroup.id));

                $('#altitude-'+trapgroup.id).change(function(wrapID) {
                    return function() {
                        coordID = 'altitude-'+wrapID.toString()
                        altitude = document.getElementById(coordID)
                        if (isNaN(altitude.value)) {
                            if (!coordProblems.includes(coordID)) {coordProblems.push(coordID)}
                            delete corrected_coordinates[wrapID].altitude
                        } else {
                            if (coordProblems.includes(coordID)) {coordProblems.splice(coordProblems.indexOf(coordID), 1)}
                            if (altitude.value!=original_coordinates[wrapID].altitude) {
                                corrected_coordinates[wrapID].altitude = altitude.value
                            } else {
                                delete corrected_coordinates[wrapID].altitude
                            }
                        }
                        if (coordProblems.length>0) {
                            document.getElementById('editSurveyErrors').innerHTML = 'Invalid coordinates. Please enter a valid number.'
                        } else {
                            document.getElementById('editSurveyErrors').innerHTML = ''
                        }
                    }
                }(trapgroup.id));

            }
        }
    }
    xhttp.send();
}

function buildCoordsOptions() {
    /** Builds the selector to selct between kml upload and manual. */

    original_coordinates = {}
    corrected_coordinates = {}
    coordProblems = []

    editCoordsDiv = document.getElementById('editCoordsDiv')
    while(editCoordsDiv.firstChild){
        editCoordsDiv.removeChild(editCoordsDiv.firstChild);
    }

    // editCoordsDiv.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Method'
    editCoordsDiv.appendChild(h5)

    infoDiv = document.createElement('div')
    infoDiv.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    infoDiv.innerHTML = '<i>Select how you would like to edit your site coordinates.</i>'
    editCoordsDiv.appendChild(infoDiv)

    optionDiv = document.createElement('div')
    optionDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    editCoordsDiv.appendChild(optionDiv)
    
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
            var addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
            while(addImsCoordsDiv.firstChild){
                addImsCoordsDiv.removeChild(addImsCoordsDiv.firstChild);
            }
            var coordsButtonsDiv = document.getElementById('coordsButtonsDiv')
            while(coordsButtonsDiv.firstChild){
                coordsButtonsDiv.removeChild(coordsButtonsDiv.firstChild);
            }
            buildKml()
        }
    })

    optionDiv = document.createElement('div')
    optionDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
    editCoordsDiv.appendChild(optionDiv)

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
            var addImsCoordsDiv = document.getElementById('addImsCoordsDiv')
            while(addImsCoordsDiv.firstChild){
                addImsCoordsDiv.removeChild(addImsCoordsDiv.firstChild);
            }
            var coordsButtonsDiv = document.getElementById('coordsButtonsDiv')
            while(coordsButtonsDiv.firstChild){
                coordsButtonsDiv.removeChild(coordsButtonsDiv.firstChild);
            }
            buildManualCoords()
        }
    })

    addImsCoordsDiv = document.createElement('div')
    addImsCoordsDiv.setAttribute('id','addImsCoordsDiv')
    editCoordsDiv.appendChild(addImsCoordsDiv)

    coordsButtonsDiv = document.createElement('div')
    coordsButtonsDiv.setAttribute('id','coordsButtonsDiv')
    editCoordsDiv.appendChild(coordsButtonsDiv)

    document.getElementById('addCoordinatesKMLMethod').click()
    
}

function clearEditSurveyModal() {
    /** Clears the edit survey modal */
    
    editTimestampsDiv = document.getElementById('editTimestampsDiv')
    while(editTimestampsDiv.firstChild){
        editTimestampsDiv.removeChild(editTimestampsDiv.firstChild);
    }

    editImgTimestampsDiv = document.getElementById('editImgTimestampsDiv')
    while(editImgTimestampsDiv.firstChild){
        editImgTimestampsDiv.removeChild(editImgTimestampsDiv.firstChild);
    }

    editClassifierDiv = document.getElementById('editClassifierDiv')
    while(editClassifierDiv.firstChild){
        editClassifierDiv.removeChild(editClassifierDiv.firstChild);
    }

    editCoordsDiv = document.getElementById('editCoordsDiv')
    while(editCoordsDiv.firstChild){
        editCoordsDiv.removeChild(editCoordsDiv.firstChild);
    }

    editAdvancedDiv = document.getElementById('editAdvancedDiv')
    while(editAdvancedDiv.firstChild){
        editAdvancedDiv.removeChild(editAdvancedDiv.firstChild);
    }

    editMasksDiv = document.getElementById('editMasksDiv')
    while(editMasksDiv.firstChild){
        editMasksDiv.removeChild(editMasksDiv.firstChild);
    }

    editStaticDiv = document.getElementById('editStaticDiv')
    while(editStaticDiv.firstChild){
        editStaticDiv.removeChild(editStaticDiv.firstChild);
    }

    editSurveyStructureDiv = document.getElementById('editSurveyStructureDiv')
    while(editSurveyStructureDiv.firstChild){
        editSurveyStructureDiv.removeChild(editSurveyStructureDiv.firstChild);
    }

    tabActiveEditSurvey = 'baseAddCoordinatesTab'
    global_corrected_timestamps = {}
    global_original_timestamps = {}
    finishedDisplayingTime = null
    finishedDisplayingStatic = null
    drawnItemsMask = null
    drawnItemsStatic = null
    drawnMaskItems = null
    cameras = []
    maskCamIndex = 0
    maskImgIndex = 0
    if (mapTime) {
        mapTime.remove()
    }
    mapTime = null
    activeImageTime = null
    mapReadyTime = null
    if (mapStatic) {
        mapStatic.remove()
    }
    mapStatic = null
    activeImageStatic = null
    addedDetectionsStatic = false
    mapReadyStatic = null
    if (mapMask) {
        mapMask.remove()
    }
    mapMask = null
    activeImageMask = null
    editingEnabled = false
    addedDetectionsMask = false
    mapReadyMask = null
    drawControl = null
    leafletMaskIDs = {}
    removedMasks = []
    editedMasks = {}
    addedMasks = {}
    maskCamIDs = []
    maskCamReadAheadIndex = 0
    maskCam_ids = []
    staticgroupIndex = 0
    staticImgIndex = 0
    staticgroupIDs = []
    staticgroupReadAheadIndex = 0
    staticgroups = []
    staticgroup_ids = []
    staticgroupDetections = {}
    og_staticgroup_status = {}
    staticCameras = []
    selectedTimestampType = 'missing'
    cameraIDs = []
    camera_ids = []
    cameraReadAheadIndex = 0
    imageIndex = 0
    cameraIndex = 0
    images = []
    new_missing_timestamps = {}
    original_extracted_timestamps = {}
    corrected_extracted_timestamps = {}
    original_edited_timestamps = {}
    corrected_edited_timestamps = {}
    original_coordinates = {}
    corrected_coordinates = {}
    coordProblems = []
    timestampSites = []
    timestampCameras = {}
    timestampSpecies = []
    surveyClassifier = null
    surveyClassifierName = null
    confirmClassifierChange = false
    confirmRestore = false
}

function clearAddFilesModal(){
    /** Clears the add files modal */

    addFilesDiv = document.getElementById('addFilesDiv') 
    while(addFilesDiv.firstChild){
        addFilesDiv.removeChild(addFilesDiv.firstChild);
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
            
            editAdvancedDiv = document.getElementById('editAdvancedDiv')
            // editAdvancedDiv.appendChild(document.createElement('br'))

            row = document.createElement('div')
            row.setAttribute('class','row')
            editAdvancedDiv.appendChild(row)

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
            editAdvancedDiv.appendChild(div)

            editAdvancedDiv.appendChild(document.createElement('br'))

            row = document.createElement('div')
            row.setAttribute('class','row')
            editAdvancedDiv.appendChild(row)

            h5 = document.createElement('h5')
            h5.setAttribute('style','padding-top: 16px; padding-left: 15px; padding-right: 10px; margin-bottom: 2px')
            h5.innerHTML = 'Ignore Sky Detections'
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
            editAdvancedDiv.appendChild(div)
        }
    }
    xhttp.send();
}

function openAddCoordinates(){
    /** Listens for and initialises the add kml file form on the edit survey modal when the radio button is selected. */

    if (tabActiveEditSurvey=='baseAddCoordinatesTab') {
        editCoordsDiv = document.getElementById('editCoordsDiv')
        if (editCoordsDiv.firstChild==null) {
            buildCoordsOptions()
        }
    }
}

function openAdvanced(){
    /** Listens for and initialises the advanced options form on the edit survey modal when the radio button is selected. */

    if (tabActiveEditSurvey=='baseAdvancedTab') {
        editAdvancedDiv = document.getElementById('editAdvancedDiv')
        if (editAdvancedDiv.firstChild==null) {
            buildAdvancedOptions()
        }
    }
}

function openEditTimestamps(){
    /** Listens for and initialises the edit timestamps form on the edit survey modal when the radio button is selected. */

    if (tabActiveEditSurvey=='baseEditTimestampsTab') {
        editTimestampsDiv = document.getElementById('editTimestampsDiv')
        if (editTimestampsDiv.firstChild==null) {
            buildEditTimestamp()
        }
    }
}

function openEditImageTimestamps(){
    /** Listens for and initialises the edit timestamps form on the edit survey modal when the radio button is selected. */

    if (tabActiveEditSurvey=='baseEditImgTimestampsTab') {
        editImgTimestampsDiv = document.getElementById('editImgTimestampsDiv')
        if (editImgTimestampsDiv.firstChild==null) {
            getTimestampSitesCameraAndSpecies()
        }
    }
}

function openEditClassifier(){
    /** Listens for and initialises the edit timestamps form on the edit survey modal when the radio button is selected. */

    if (tabActiveEditSurvey=='baseEditClassifierTab') {
        editClassifierDiv = document.getElementById('editClassifierDiv')
        if (editClassifierDiv.firstChild==null) {
            buildClassifierSelectTable(editClassifierDiv)
        }
    }
}

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
    document.getElementById('newSurveyStructureDiv').innerHTML = ''
    S3BucketUpload = document.getElementById('S3BucketUpload')
    org_id = document.getElementById('newSurveyOrg').value
    if (S3BucketUpload.checked) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getFolders?org_id='+org_id);
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
    document.getElementById('newSurveyStructureDiv').innerHTML = ''
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

// btnReClassify.addEventListener('click', ()=>{
//     /** Listener that initiates the re-classification of the selected surey when the button is pressed. */
    
//     var xhttp = new XMLHttpRequest();
//     xhttp.open("GET", '/reClassify/'+selectedSurvey);
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             reply = JSON.parse(this.responseText);  
//             if (reply=='Success') {
//                 modalAddImages.modal('hide')
//                 updatePage(current_page)
//             }
//         }
//     }
//     xhttp.send();
// });

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

    for (let heading in headings) {
        for (let i=0;i<headings[heading].length;i++) {
            heading2 = headings[heading][i]
            tableCol = document.createElement('td')
            tableCol.innerHTML = info[heading][heading2]
            tableCol.setAttribute('style','font-size: 100%; padding-left: 3px; padding-right: 3px;')
            tableRow.appendChild(tableCol)
        }
    }
}

function changeRowVisibility(labels,init=false,multi=false,rootLabel=null) {
    /** Iterates through the selected row and its children, changing their visibility as needed. */
    for (let label in labels) {
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
    for (let label in labels) {
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

    for (var label in labels) {
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
                            // if (detailledStatusCount<=0) {
                            //     document.getElementById('detailledStatusPleaseWait').remove()
                            // }
                        }
                    } else {
                        // document.getElementById('detailledStatusPleaseWait').innerHTML = reply.message
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

    for (let heading in headings) {
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

    for (let heading in headings) {
        for (let i=0;i<headings[heading].length;i++) {
            tableCol = document.createElement('th')
            tableCol.setAttribute('scope','col')
            tableCol.setAttribute('style','border-bottom: 1px solid white')
            tableRow.appendChild(tableCol)
    
            thdiv = document.createElement('div')
            thdiv.innerHTML = headings[heading][i]
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

        // div = document.createElement('p')
        // div.innerHTML = 'Loading... Please be patient.'
        // div.setAttribute('id','detailledStatusPleaseWait')
        // StatusTableDiv.appendChild(div)

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
                        // document.getElementById('detailledStatusPleaseWait').innerHTML = reply.message
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
    
    if (!helpReturn && !confirmEmptyReturn) {
        resetNewSurveyPage()
    } 
});

function updateClassifierTable(url=null) {
    /** fetches and updates the classifier selection table*/

    if (!url) {
        url='/getClassifierInfo'
    }

    if (modalEditSurvey.is(':visible')) {
        if (!url.includes('?')) {
            url += '?'
        }
        url += '&showCurrent=' + selectedSurvey.toString()
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", url);
    xhttp.onreadystatechange =
    function() {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            data = reply.data

            classifierSelectionTableInfo = document.getElementById('classifierSelectionTableInfo')
            while(classifierSelectionTableInfo.firstChild){
                classifierSelectionTableInfo.removeChild(classifierSelectionTableInfo.firstChild);
            }

            for (let i=0;i<data.length;i++) {
                datum = data[i]
                tr = document.createElement('tr')

                td = document.createElement('td')
                td.setAttribute('style','text-align:left')
                div = document.createElement('div')
                div.setAttribute('class',"custom-control custom-radio custom-control-inline")
                input = document.createElement('input')
                input.setAttribute('type','radio')
                input.setAttribute('class','custom-control-input')
                input.setAttribute('id',datum.name)
                input.setAttribute('name','classifierSelection')
                input.setAttribute('value',datum.id)
                if (datum.active) {
                    input.checked = true
                    surveyClassifier = datum.id
                    surveyClassifierName = datum.name
                }
                label = document.createElement('label')
                label.setAttribute('class','custom-control-label')
                label.setAttribute('for',datum.name)
                label.innerHTML = datum.name
                div.appendChild(input)
                div.appendChild(label)
                td.appendChild(div)
                tr.appendChild(td)

                if (modalEditSurvey.is(':visible')) {
                    input.addEventListener('change', function() {
                        if (this.checked) {
                            if (this.value != surveyClassifier && !confirmClassifierChange && tabActiveEditSurvey=='baseEditClassifierTab') {
                                confirmRestore = true 
                                removeRestoreEventListeners()
                                document.getElementById('modalConfirmBodyRestore').innerHTML = '<p>Changing the classifier will require the raw images to be restored from our archival storage for processing purposes. This will take 48 hours to complete.<br><br>Would you like to proceed?</p>'
                                modalEditSurvey.modal('hide')
                                btnConfirmRestore.disabled = false
                                modalConfirmRestore.modal({keyboard: true})
                                
                                btnConfirmRestore.addEventListener('click', confirmRestoreEdit);
                                btnCancelRestore.addEventListener('click', cancelRestoreEdit);
                            }
                        }
                    });
                }

                td = document.createElement('td')
                td.setAttribute('style','text-align:left')
                td.innerHTML = datum.version
                tr.appendChild(td)

                td = document.createElement('td')
                td.setAttribute('style','text-align:left')
                td.innerHTML = datum.source
                tr.appendChild(td)

                td = document.createElement('td')
                td.setAttribute('style','text-align:left')
                td.innerHTML = datum.region
                tr.appendChild(td)

                td = document.createElement('td')
                td.setAttribute('style','text-align:left')
                td.innerHTML = datum.labels
                tr.appendChild(td)

                td = document.createElement('td')
                td.setAttribute('style','text-align:left')
                td.innerHTML = datum.description
                tr.appendChild(td)

                classifierSelectionTableInfo.appendChild(tr)
            }

            if (reply.next_url==null) {
                document.getElementById('classifierBtnNext').style.visibility = 'hidden'
            } else {
                document.getElementById('classifierBtnNext').style.visibility = 'visible'
                next_classifier_url = reply.next_url
            }

            if (reply.prev_url==null) {
                document.getElementById('classifierBtnPrev').style.visibility = 'hidden'
            } else {
                document.getElementById('classifierBtnPrev').style.visibility = 'visible'
                prev_classifier_url = reply.prev_url
            }
        }
    }
    xhttp.send();
}

function buildClassifierSelectTable(speciesClassifierDiv) {
    /** Populates the classifier selection table in the specified div */

    tableDiv = document.createElement('div')
    tableDiv.setAttribute('class','table-responsive')
    tableDiv.setAttribute('style','max-height:500px')
    speciesClassifierDiv.appendChild(tableDiv)

    table = document.createElement('table')
    table.setAttribute('id','classifierSelectionTable')
    table.setAttribute('class','table table-striped table-bordered table-sm')
    table.setAttribute('cellspacing','0')
    table.setAttribute('width','100%')
    table.setAttribute('style','margin-bottom: 0px;')
    tableDiv.appendChild(table)

    thead = document.createElement('thead')
    table.appendChild(thead)

    tr = document.createElement('tr')
    thead.appendChild(tr)

    th = document.createElement('th')
    th.classList.add('th-sm')
    th.innerHTML='Name'
    tr.appendChild(th)

    th = document.createElement('th')
    th.classList.add('th-sm')
    th.innerHTML='Version'
    tr.appendChild(th)
    
    th = document.createElement('th')
    th.classList.add('th-sm')
    th.innerHTML='Source'
    tr.appendChild(th)

    th = document.createElement('th')
    th.classList.add('th-sm')
    th.innerHTML='Region'
    tr.appendChild(th)

    th = document.createElement('th')
    th.classList.add('th-sm')
    th.innerHTML='Labels'
    tr.appendChild(th)

    th = document.createElement('th')
    th.classList.add('th-sm')
    th.innerHTML='Description'
    tr.appendChild(th)

    tbody = document.createElement('tbody')
    tbody.setAttribute('id','classifierSelectionTableInfo')
    table.appendChild(tbody)

    speciesClassifierDiv.appendChild(document.createElement('br'))
    row = document.createElement('div')
    row.classList.add('row')
    col0 = document.createElement('div')
    col0.classList.add('col-lg-3')
    col1 = document.createElement('div')
    col1.classList.add('col-lg-1')
    btn = document.createElement('btn')
    btn.setAttribute('class','btn btn-primary btn-block')
    btn.setAttribute('id','classifierBtnPrev')
    btn.setAttribute('style','visibility: hidden')
    btn.setAttribute('onclick','updateClassifierTable(prev_classifier_url)')
    btn.innerHTML='&#x276e;'
    col1.appendChild(btn)
    col2 = document.createElement('div')
    col2.classList.add('col-lg-4')
    col3 = document.createElement('div')
    col3.classList.add('col-lg-1')
    btn = document.createElement('btn')
    btn.setAttribute('class','btn btn-primary btn-block')
    btn.setAttribute('id','classifierBtnNext')
    btn.setAttribute('style','visibility: hidden')
    btn.setAttribute('onclick','updateClassifierTable(next_classifier_url)')
    btn.innerHTML='&#x276f;'
    col3.appendChild(btn)
    col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col0)
    row.appendChild(col1)
    row.appendChild(col2)
    row.appendChild(col3)
    row.appendChild(col4)
    speciesClassifierDiv.appendChild(row)

    input = document.createElement('input')
    input.setAttribute('type','text')
    input.setAttribute('class','form-control')
    input.setAttribute('placeholder','Search')
    input.setAttribute('id','classifierSearch')
    col2.appendChild(input)

    $('#classifierSearch').change( function() {
        search = document.getElementById('classifierSearch').value
        url = '/getClassifierInfo?search='+search
        updateClassifierTable(url)
    });

    updateClassifierTable()
}

modalNewSurvey.on('shown.bs.modal', function(){
    /** Populates the new survey modal when opened. */

    if (!helpReturn && !confirmEmptyReturn) {
        if (cloudAccess=='True') {
            document.getElementById('uploadTypeSelect').hidden = false
        }
        speciesClassifierDiv = document.getElementById('speciesClassifierDiv')
        buildClassifierSelectTable(speciesClassifierDiv)
        buildBrowserUpload('newSurveyFormDiv')
        getOrganisations()
    }
    else {
        helpReturn = false
        confirmEmptyReturn = false
    }
      
});

modalEditSurvey.on('shown.bs.modal', function(){
    /** Initialises the edit-survey modal when opened. */
    if (!helpReturn) {
        // var xhttp = new XMLHttpRequest();
        // xhttp.open("GET", '/getSurveyClassificationLevel/'+selectedSurvey);
        // xhttp.onreadystatechange =
        // function(){
        //     if (this.readyState == 4 && this.status == 200) {
        //         reply = JSON.parse(this.responseText);

        //         document.getElementById('classifierVersion').value = reply.classifier_version

        //         if (reply.update_available == 'true') {
        //             document.getElementById('btnReClassify').disabled = false
        //         }
        //     }
        // }
        // xhttp.send();
    }
});

modalEditSurvey.on('hidden.bs.modal', function(){
    /** Clears the edit-survey modal when closed. */

    if (!helpReturn && !alertReload &&!confirmRestore) {
        modalConfirmEditClose.modal({keyboard: true});
    } else if (!helpReturn && !confirmRestore && alertReload) {
        resetEditSurveyModal()
        document.getElementById('btnEditSurvey').disabled = false
    } else {
        helpReturn = false
    }
});

$('#btnCancelCloseES').click( function() {
    /** Event listener for the cancel button on the edit-survey modal close confirmation modal. */
    modalConfirmEditClose.modal('hide')
    modalEditSurvey.modal({keyboard: true});
});

$('#btnConfirmCloseES').click( function() {
    /** Event listener for the confirm button on the edit-survey modal close confirmation modal. */
    modalConfirmEditClose.modal('hide')
    resetEditSurveyModal()
    document.getElementById('btnEditSurvey').disabled = false
});

modalAddFiles.on('hidden.bs.modal', function(){
    /** Clears the add-files modal when closed. */
    if (!helpReturn) {
        clearAddFilesModal()
    } else {
        helpReturn = false
    }
});

function generate_url() {
    /** Generates the url based on the current order selection and search query */
    order = orderSelect.options[orderSelect.selectedIndex].value
    search = document.getElementById('surveySearch').value
    // return '/getHomeSurveys?page=1&order='+order+'&search='+search.toString()+'&downloads='+currentDownloads.toString()
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

// function uploadSurveyToCloud(surveyName) {
//     stopFlag=false
//     inputFiles = document.getElementById('inputFile')
//     if (inputFiles.files.length>0) {
//         uploadImageToCloud(0,surveyName,1)
//     }
// }

// function uploadImageToCloud(fileIndex,surveyName,attempts) {

//     var formData = new FormData()
//     formData.append("image", document.getElementById('inputFile').files[fileIndex])
//     formData.append("surveyName", surveyName)

//     var xhttp = new XMLHttpRequest();
//     xhttp.open("POST", '/uploadImageToCloud');
//     xhttp.onreadystatechange =
//     function(wrapFileIndex,wrapSurveyName,wrapAttempts){
//         return function() {
//             if (this.readyState == 4 && this.status == 200) {
//                 reply = JSON.parse(this.responseText)
//                 if (stopFlag) {
//                     var xhttp = new XMLHttpRequest();
//                     xhttp.open("GET", '/deleteImages/'+surveyName);
//                     xhttp.send();
//                 } else if ((reply.status!='success') && (wrapAttempts<5)) {
//                     uploadImageToCloud(wrapFileIndex,wrapSurveyName,wrapAttempts+1)
//                 } else if (wrapFileIndex < document.getElementById('inputFile').files.length-1) {
//                     updateUploadProgress(wrapFileIndex+1,document.getElementById('inputFile').files.length)
//                     uploadImageToCloud(wrapFileIndex+1,wrapSurveyName,1)
//                 } else {
//                     // DONE! Close modals etc.
//                     var xhttp = new XMLHttpRequest();
//                     xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/Complete');
//                     xhttp.send();
//                     modalUploadProgress.modal('hide')
//                     document.getElementById('modalAlertHeader').innerHTML = 'Success'
//                     document.getElementById('modalAlertBody').innerHTML = 'All images uploaded successfully.'
//                     modalAlert.modal({keyboard: true});
//                 }
//             }
//         }
//     }(fileIndex,surveyName,attempts)
//     xhttp.send(formData);
// }

document.getElementById('btnSaveSurvey').addEventListener('click', ()=>{
    /** 
     * Event listener on the new survey modal's submit button. Retries the info and submits it to the server. Also checks 
     * the format of kml files.
    */

    surveyName = document.getElementById('newSurveyName').value
    surveyOrganisation = document.getElementById('newSurveyOrg').value
    newSurveyDescription = document.getElementById('newSurveyDescription').value
    newSurveyTGCode = document.getElementById('newSurveyTGCode').value
    newSurveyCheckbox = document.getElementById('newSurveyCheckbox')
    newSurveyPermission = document.getElementById('newSurveyPermission').value
    newSurveyAnnotation = document.getElementById('newSurveyAnnotation').value
    detailedAccessSurvey = document.getElementById('detailedAccessSurveyCb').checked
    camRegExp = document.getElementById('camRegExp').checked
    camLvlFolder = document.getElementById('camLvlFolder').checked
    camSameAsSite = document.getElementById('camSameAsSite').checked
    newSurveyStructureDiv = document.getElementById('newSurveyStructureDiv')
    classifier_id = document.querySelector('input[name="classifierSelection"]:checked')
    newSurveyTrails = document.getElementById('newSurveyTrails').checked
    newSurveyPlains = document.getElementById('newSurveyPlains').checked
    newSurveyWaterholes = document.getElementById('newSurveyWaterholes').checked
    newSurveyBaited = document.getElementById('newSurveyBaited').checked
    newSurveyMotion = document.getElementById('newSurveyMotion').checked
    newSurveyIgnoreSmallDets = document.getElementById('cbxIgnoreSmallDets').checked
    newSurveyIgnoreSkyDets = document.getElementById('cbxIgnoreSkyDets').checked
    siteFolderN = document.getElementById('siteFolderN').checked
    siteIdentifier = document.getElementById('siteIdentifier').checked

    while(document.getElementById('newSurveyErrors').firstChild){
        document.getElementById('newSurveyErrors').removeChild(document.getElementById('newSurveyErrors').firstChild);
    }

    if (classifier_id==null) {
        document.getElementById('newSurveyErrors').innerHTML = 'You must select a classifier.'
    } else {
        classifier_id = classifier_id.value
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

    legalOrganisation = true
    if (surveyOrganisation == ''){
        legalOrganisation = false
        document.getElementById('newSurveyErrors').innerHTML = 'Please select an organisation.'
    }

    legalDescription = true
    if ((newSurveyDescription.includes('/'))||(newSurveyDescription.includes('\\'))) {
        legalDescription = false
        document.getElementById('newSurveyErrors').innerHTML = 'The survey description cannot contain slashes.'
    }

    legalPermission = true
    if (newSurveyPermission == ''){
        legalPermission = false
        document.getElementById('newSurveyErrors').innerHTML = 'Please select a access level.'
    }

    if (newSurveyAnnotation == ''){
        legalPermission = false
        document.getElementById('newSurveyErrors').innerHTML = 'Please select an annotation access level.'
    }

    var detailed_access = []
    if (detailedAccessSurvey) {
        // Get all selectors 
        var surveyUserPermissions =  document.querySelectorAll('[id^=surveyUserPermission-]')
        if (surveyUserPermissions.length==0) {
            document.getElementById('newSurveyErrors').innerHTML = 'You must select at least one user to set permission exceptions for.'
            legalPermission = false
        } else {
            var dup_users = []
            for (let i=0;i<surveyUserPermissions.length;i++) {
                user_id = surveyUserPermissions[i].value
                if (dup_users.indexOf(user_id)==-1) {
                    dup_users.push(user_id)
                    var id_num = surveyUserPermissions[i].id.split('-')[1]
                    var user_permission = default_access[document.getElementById('detailedAccessSurvey-'+id_num).value].toLowerCase()
                    var annotation = document.getElementById('detailedJobAccessSurvey-'+id_num).checked
                    detailed_access.push({
                        'user_id': parseInt(user_id),
                        'permission': user_permission,
                        'annotation': annotation ? '1' : '0'
                    })
                }
                else{
                    document.getElementById('newSurveyErrors').innerHTML = 'You cannot select the same user twice.'
                    legalPermission = false
                }
            }
        }
    }

    legalInput = false
    var emptySurvey = false
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
        pathDisplay = document.getElementById('pathDisplay')
        if (pathDisplay.options.length == 0) {
            // document.getElementById('newSurveyErrors').innerHTML = 'You must select images to upload.'
            emptySurvey = true
            legalInput = true
            newSurveyS3Folder = 'none'
        } else {
            legalInput = true
            newSurveyS3Folder = 'none'
            // files = inputFile.files
        }
    } else {
        document.getElementById('newSurveyErrors').innerHTML = 'You must select an image upload method.'
    }


    legalTGCode = true
    if (emptySurvey){
        legalTGCode = true
        newSurveyTGCode = ''
    } else if (siteFolderN) {
        // Folder Level
        newSurveyTGCode = ''
        selectedFolder = document.querySelector(".site-folder.selected");
        if (selectedFolder) {
            index = selectedFolder.dataset.index;
            newSurveyTGCode = "(?:[^/]*/){"+index+"}([^/]*)"
        }
        else{
            legalTGCode = false
            document.getElementById('newSurveyErrors').innerHTML = 'You have not selected the folder-level that represents your sites.'
        }
    } else {
        // Regular expression 
        if (newSurveyTGCode == '') {
            legalTGCode = false
            document.getElementById('newSurveyErrors').innerHTML = 'The site identifier field cannot be empty.'
        }
        else{
            if (newSurveyTGCode.endsWith('.*') || newSurveyTGCode.endsWith('.+') || newSurveyTGCode.endsWith('.*[0-9]+') || newSurveyTGCode.endsWith('.+[0-9]+' )) {
                legalTGCode = false
                error_message = 'Your site identifier is invalid. Please try again or send an email for assistance.'
                document.getElementById('newSurveyErrors').innerHTML = error_message 
            }   
        }
    }


    legalCamCode = true
    if (emptySurvey) {
        legalCamCode = true
    }
    else{
        if (camSameAsSite) {
            // Site identifier
            legalCamCode = legalTGCode
            camRegExp = false
            camLvlFolder = false
        }else{
            if (camRegExp) {
                // Regular expression
                var newSurveyCamCode = document.getElementById('newSurveyCamCode').value
                if (newSurveyCamCode == '') {
                    legalCamCode = false
                    document.getElementById('newSurveyErrors').innerHTML = 'The camera code field cannot be empty.'
                }
                else{
                    if (newSurveyCamCode.endsWith('.*') || newSurveyCamCode.endsWith('.+') || newSurveyCamCode.endsWith('.*[0-9]+') || newSurveyCamCode.endsWith('.+[0-9]+' )) {
                        legalCamCode = false
                        error_message = 'Your camera code is invalid. Please try again or send an email for assistance.'
                        document.getElementById('newSurveyErrors').innerHTML = error_message 
                    }   
                }
            }
            else if (camLvlFolder) {
                // Folder level 
                newSurveyCamCode = ''
                selectedFolder = document.querySelector(".cam-folder.selected");
                if (selectedFolder) {
                    index = selectedFolder.dataset.index;
                    newSurveyCamCode = "(?:[^/]*/){"+index+"}([^/]*)"
                }
                else{
                    legalCamCode = false
                    document.getElementById('newSurveyErrors').innerHTML = 'You have not selected the folder-level that represents your cameras.'
                }
            } else {
                legalCamCode = false
                document.getElementById('newSurveyErrors').innerHTML = 'You must select a camera code option.'
            }
        }
    }

    structureCheckReady = true
    if (emptySurvey) {
        structureCheckReady = true
    }
    else {
        if ((newSurveyStructureDiv!=null)&&(newSurveyStructureDiv.innerHTML=='Checking...')) {
            structureCheckReady = false
            document.getElementById('newSurveyErrors').innerHTML = 'Please wait for your structure check to finish.'
        }
    
        if ((newSurveyStructureDiv!=null)&&(newSurveyStructureDiv.innerHTML == '')||(newSurveyStructureDiv.innerHTML == 'Malformed expression. Please try again.')||(newSurveyStructureDiv.innerHTML == 'Invalid structure. Please check your site and camera identifiers.')||(newSurveyStructureDiv.innerHTML.includes('identifier is invalid'))) {
            legalTGCode = false
            legalCamCode = false
            document.getElementById('newSurveyErrors').innerHTML = 'Your specified site or camera identifiers are invalid. Please try again.'
        }
    }

    if (legalName&&legalOrganisation&&legalDescription&&legalPermission&&legalTGCode&&legalInput&&structureCheckReady&&classifier_id&&legalCamCode) {
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
            if (siteFolderN) {
                selectedFolder = document.querySelector(".site-folder.selected");
                index = selectedFolder.dataset.index;
                newSurveyTGCode = "(?:[^/]*/){"+index+"}([^/]*)"
                newSurveyCheckboxChecked = true
            }
            else{
                newSurveyTGCode = document.getElementById('newSurveyTGCode').value
                newSurveyCheckboxChecked = newSurveyCheckbox.checked
            }
            var formData = new FormData()
            formData.append("surveyName", surveyName)
            formData.append("newSurveyDescription", newSurveyDescription)
            formData.append("newSurveyTGCode", newSurveyTGCode)
            formData.append("newSurveyS3Folder", newSurveyS3Folder)
            formData.append("checkbox", newSurveyCheckboxChecked.toString())
            formData.append("correctTimestamps", 'false')
            formData.append("classifier_id", classifier_id)
            formData.append("organisation_id", surveyOrganisation)
            formData.append("permission", newSurveyPermission)
            formData.append("annotation", newSurveyAnnotation)
            if (detailedAccessSurvey) {
                formData.append("detailed_access", JSON.stringify(detailed_access))
            }
            if (camSameAsSite) {
                formData.append("newSurveyCamCode", newSurveyTGCode)
                formData.append("camCheckbox", newSurveyCheckboxChecked.toString())
            }
            else{
                if (camRegExp) {
                    formData.append("newSurveyCamCode", document.getElementById('newSurveyCamCode').value)
                    formData.append("camCheckbox", document.getElementById('camAdvancedCheckbox').checked.toString())
                }
                else if (camLvlFolder) {
                    selectedFolder = document.querySelector(".cam-folder.selected");
                    index = selectedFolder.dataset.index;
                    newSurveyCamCode = "(?:[^/]*/){"+index+"}([^/]*)"
                    formData.append("newSurveyCamCode", newSurveyCamCode)
                    formData.append("camCheckbox", 'true')
                }
            }

            if (newSurveyTrails) {
                formData.append("dataSource", 'trails')
            } else if (newSurveyPlains) {
                formData.append("dataSource", 'plains')
            } else if (newSurveyWaterholes) {
                formData.append("dataSource", 'waterhole')
            } else if (newSurveyBaited) {
                formData.append("dataSource", 'baited')
            }

            if (newSurveyMotion) {
                formData.append("triggerSource", 'motion')
            } else {
                formData.append("triggerSource", 'time')
            }

            if(newSurveyIgnoreSmallDets){
                formData.append("ignoreSmallDets", 'true')
            } else {
                formData.append("ignoreSmallDets", 'false')
            }

            if(newSurveyIgnoreSkyDets){
                formData.append("ignoreSkyDets", 'true')
            } else {
                formData.append("ignoreSkyDets", 'false')
            }

            if (emptySurvey) {
                formData.append("emptySurvey", 'true')
                surveyFormData = formData
                confirmEmptyReturn = true
                modalNewSurvey.modal('hide')
                modalConfirmEmpty.modal({keyboard: true}); 
            }
            else {
                submitNewSurvey(formData)
            }
        }
    }
});

function submitNewSurvey(formData) {
    /** Submits the new survey info to the server. Begins the browser uploaded if necessary. */
    
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/createNewSurvey');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  

            if (reply.status=='success') {

                if (reply.action=='upload') {
                    uploadID = reply.newSurvey_id
                    uploadSurveyName = reply.surveyName

                    uploading = true
                    updatePage(current_page)
                    // uploading = true
                    // ProgBarDiv = document.getElementById('uploadProgBarDiv')

                    // while(ProgBarDiv.firstChild){
                    //     ProgBarDiv.removeChild(ProgBarDiv.firstChild);
                    // }

                    // var newProg = document.createElement('div');
                    // newProg.classList.add('progress');

                    // var newProgInner = document.createElement('div');
                    // newProgInner.classList.add('progress-bar');
                    // newProgInner.classList.add('progress-bar-striped');
                    // newProgInner.classList.add('active');
                    // newProgInner.setAttribute("role", "progressbar");
                    // newProgInner.setAttribute("id", "uploadProgBar");
                    // newProgInner.setAttribute("aria-valuenow", "0");
                    // newProgInner.setAttribute("aria-valuemin", "0");
                    // newProgInner.setAttribute("aria-valuemax", files.length.toString());
                    // newProgInner.setAttribute("style", "width:0%");

                    // newProg.appendChild(newProgInner);
                    // ProgBarDiv.appendChild(newProg);

                    // modalNewSurvey.modal('hide')
                    // modalUploadProgress.modal({backdrop: 'static', keyboard: false});

                    // uploadSurveyToCloud(surveyName)
                } else if (reply.action=='empty') {
                    document.getElementById('modalAlertHeader').innerHTML = 'Success'
                    document.getElementById('modalAlertBody').innerHTML = 'Your survey has been created.'
                    alertReload = true
                    modalNewSurvey.modal('hide')
                    modalAlert.modal({keyboard: true});
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

modalConfirmEmpty.on('hidden.bs.modal', function(){
    /** Clears the empty survey modal when closed. */
    if (!confirmedEmpty) {	
        document.getElementById('btnSaveSurvey').disabled = false
        modalNewSurvey.modal({keyboard: true});
    }
});

$('#btnConfirmEmpty').click( function() {
    /** Event listener for the confirm button on the empty survey modal. */
    confirmedEmpty = true
    modalConfirmEmpty.modal('hide')
    submitNewSurvey(surveyFormData)
});

document.getElementById('btnAddFiles').addEventListener('click', ()=>{
    /** Handles the submission of the add files modal. */

    var addFilesErrors = document.getElementById('addFilesErrors')
    while(addFilesErrors.firstChild){
        addFilesErrors.removeChild(addFilesErrors.firstChild);
    }

    legalTGCode = true
    legalCamCode = true
    addImagesTGCode = document.getElementById('addImagesTGCode').value
    addImagesCheckboxChecked = document.getElementById('addImagesCheckbox').checked
    siteFolderN_ES = document.getElementById('siteFolderN_ES').checked

    if (siteFolderN_ES) {
        addImagesTGCode = ''
        selectedFolder = document.querySelector(".site-folder.selected");
        if (selectedFolder) {
            index = selectedFolder.dataset.index;
            addImagesTGCode = "(?:[^/]*/){"+index+"}([^/]*)"
            addImagesCheckboxChecked = true
        }
        else{
            legalTGCode = false
            addFilesErrors.innerHTML = 'You have not selected the folder-level that represents your sites.'
        }
    }
    else{
        if ((addImagesTGCode == '')||(addImagesTGCode == ' ')) {
            legalTGCode = false
            addFilesErrors.innerHTML = 'The site identifier field cannot be empty.'
        } else if ((addImagesTGCode.includes('/'))||(addImagesTGCode.includes('\\'))) {
            legalTGCode = false
            addFilesErrors.innerHTML = 'The site identifier cannot contain slashes.'
        }
        else if (addImagesTGCode.endsWith('.*') || addImagesTGCode.endsWith('.+') || addImagesTGCode.endsWith('.*[0-9]+') || addImagesTGCode.endsWith('.+[0-9]+' )) {
            legalTGCode = false
            error_message = 'Your site identifier is invalid. Please try again or contact us for assistance.'
            addFilesErrors.innerHTML = error_message 
        }   
    }

    camRegExp = document.getElementById('camRegExpES').checked
    camLvlFolder = document.getElementById('camLvlFolderES').checked
    camSameAsSite = document.getElementById('camSameAsSiteES').checked

    if (camSameAsSite) {
        // Site identifier
        legalCamCode = legalTGCode
        addImagesCamCode = addImagesTGCode
        addImagesCamCheckboxChecked = addImagesCheckboxChecked
        camRegExp = false
        camLvlFolder = false
    } else {
        if (camRegExp) {
            // Regular expression
            addImagesCamCode = document.getElementById('addImagesCamCode').value
            addImagesCamCheckboxChecked = document.getElementById('addImagesCamCheckbox').checked

            if ((addImagesCamCode == '') || (addImagesCamCode == ' ')) {
                legalCamCode = false
                addFilesErrors.innerHTML = 'The camera code field cannot be empty.'
            }
            else if ((addImagesCamCode.includes('/'))||(addImagesCamCode.includes('\\'))) {
                legalCamCode = false
                addFilesErrors.innerHTML = 'The camera code cannot contain slashes.'
            }
            else{
                if (addImagesCamCode.endsWith('.*') || addImagesCamCode.endsWith('.+') || addImagesCamCode.endsWith('.*[0-9]+') || addImagesCamCode.endsWith('.+[0-9]+' )) {
                    legalCamCode = false
                    error_message = 'Your camera code is invalid. Please try again or send an email for assistance.'
                    addFilesErrors.innerHTML = error_message 
                }   
            }
        }
        else if (camLvlFolder) {
            addImagesCamCheckboxChecked = false
            addImagesCamCode = ''
            //Folder level
            selectedFolder = document.querySelector(".cam-folder.selected");
            if (selectedFolder) {
                index = selectedFolder.dataset.index;
                addImagesCamCode = "(?:[^/]*/){"+index+"}([^/]*)"
                addImagesCamCheckboxChecked = true
            } else {
                legalCamCode = false
                addFilesErrors.innerHTML = 'You have not selected the folder-level that represents your cameras.'
            }
        
        } else {
            legalCamCode = false
            addImagesCamCheckboxChecked = false
            addImagesCamCode = ' '
            document.getElementById('newSurveyErrors').innerHTML = 'You must select a camera code option.'
        }
    }
    
    legalInput = false
    if (document.getElementById('S3BucketAdd').checked == true) {
        S3FolderInput = document.getElementById('S3FolderInput')
        addImagesS3Folder = S3FolderInput.options[S3FolderInput.selectedIndex].text
        if (addImagesS3Folder=='') {
            addFilesErrors.innerHTML = 'The folder name field cannot be empty.'
        } else if (addImagesS3Folder.toLowerCase()=='none') {
            addFilesErrors.innerHTML = 'The folder cannot be called "none".'
        } else if ((addImagesS3Folder.includes('/'))||(addImagesS3Folder.includes('\\'))) {
            addFilesErrors.innerHTML = 'The folder name cannot contain slashes.'
        } else {
            legalInput = true
        }
    } else if (document.getElementById('BrowserAdd').checked == true) {
        pathDisplay = document.getElementById('pathDisplay')
        if (pathDisplay.options.length == 0) {
            addFilesErrors.innerHTML = 'You must select files to upload.'
        } else {
            legalInput = true
            addImagesS3Folder = 'none'
            // files = inputFile.files
        }
    } else {
        addFilesErrors.innerHTML = 'You must select a file upload method.'
    }

    structureCheckReady = true
    addImagesStructureDiv = document.getElementById('addImagesStructureDiv')
    if ((addImagesStructureDiv!=null)&&(addImagesStructureDiv.innerHTML=='Checking...')) {
        structureCheckReady = false
        document.getElementById('addFilesErrors').innerHTML = 'Please wait for your structure check to finish.'
    }

    if ((addImagesStructureDiv!=null)&&((addImagesStructureDiv.innerHTML == '')||(addImagesStructureDiv.innerHTML == 'Malformed expression. Please try again.')||(addImagesStructureDiv.innerHTML == 'Invalid structure. Please check your site and camera identifiers.')||(addImagesStructureDiv.innerHTML.includes('identifier is invalid')))) {
        legalTGCode = false
        legalCamCode = false
        document.getElementById('addFilesErrors').innerHTML = 'Your specified site or camera identifiers are invalid. Please try again.'
    }

    if (legalTGCode&&legalInput&&structureCheckReady&&legalCamCode) {
        var formData = new FormData()
        formData.append("survey_id", selectedSurvey)
        formData.append("newSurveyTGCode", addImagesTGCode)
        formData.append("newSurveyS3Folder", addImagesS3Folder)
        formData.append("checkbox", addImagesCheckboxChecked.toString())
        formData.append("newSurveyCamCode", addImagesCamCode)
        formData.append("camCheckbox", addImagesCamCheckboxChecked.toString())

        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/addFiles');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='success') {
                    if (document.getElementById('BrowserAdd').checked) {
                        uploadID = reply.survey_id
                        uploadSurveyName = reply.survey_name
                        uploading = true
                        updatePage(current_page)
                    }

                    modalAddFiles.modal('hide')
                    clearAddFilesModal()
                }
                else{
                    document.getElementById('addFilesErrors').innerHTML = reply.message
                    document.getElementById('btnAddFiles').disabled = false
                }
            }
        }
        xhttp.send(formData);
    }

});


document.getElementById('btnEditSurvey').addEventListener('click', ()=>{
    /** Handles the submission of the edit survey modal. */

    var editSurveyErrors = document.getElementById('editSurveyErrors')
    while(editSurveyErrors.firstChild){
        editSurveyErrors.removeChild(editSurveyErrors.firstChild);
    }

    //Coordinates
    legalFile = true
    if (document.getElementById('addCoordinatesManualMethod').checked) {
        if (coordProblems.length>0) {
            legalFile=false
            document.getElementById('editSurveyErrors').innerHTML = 'Invalid coordinates. Please enter a valid number.'
        }
        coordData = []
        for (site_id in corrected_coordinates){
            if(corrected_coordinates[site_id].latitude || corrected_coordinates[site_id].longitude || corrected_coordinates[site_id].altitude){
                let lat = corrected_coordinates[site_id].latitude ? corrected_coordinates[site_id].latitude : original_coordinates[site_id].latitude
                let lon = corrected_coordinates[site_id].longitude ? corrected_coordinates[site_id].longitude : original_coordinates[site_id].longitude
                let alt = corrected_coordinates[site_id].altitude ? corrected_coordinates[site_id].altitude : original_coordinates[site_id].altitude
                coordData.push({'site_id':site_id,'latitude':lat,'longitude':lon,'altitude':alt})
            }
        }
    } else if (document.getElementById('addCoordinatesKMLMethod').checked) {
        kmlFileUpload = document.getElementById('kmlFileUpload2')
        if (kmlFileUpload.files.length > 1) {
            document.getElementById('editSurveyErrors').innerHTML = 'You can only upload a single coordinate file'
            legalFile = false
        } else if (kmlFileUpload.files.length == 1) {
            if (kmlFileUpload.files[0].size>50000000) {
                document.getElementById('editSurveyErrors').innerHTML = 'File cannot be larger than 50MB.'
                legalFile = false
            } else {
                if (!kmlFileUpload.files[0].name.includes('.kml')) {
                    document.getElementById('editSurveyErrors').innerHTML = 'The trap coordinate file must be a .kml file.'
                    legalFile = false
                }
            }
        }
    }
    
    //Classifier
    legalClassifier = true
    classifier_id = document.querySelector('input[name="classifierSelection"]:checked')
    if (classifier_id==null) {
        // document.getElementById('editSurveyErrors').innerHTML = 'You must select a classifier.'
        // legalClassifier = false
        classifier_id = 'none'
    } else {
        classifier_id = classifier_id.value
    }
    

    //Image Timestamps
    legalTimestamp = true
    if(document.getElementById('year')) {
        legalTimestamp = validateTimestamp()
    }
    imageTimestampData = {}
    allTimestamps = Object.assign({},new_missing_timestamps,corrected_extracted_timestamps,corrected_edited_timestamps)
    for (image_id in allTimestamps) {
        imageTimestampData[image_id] = getTimestamp(allTimestamps[image_id])
    }

    //Camera Timestamps
    timestampData = {}
    for (camera_id in global_corrected_timestamps) {
        timestampData[camera_id] = {'original': global_original_timestamps[camera_id], 'corrected': global_corrected_timestamps[camera_id]}
    }

    //Advanced 
    ignore_small_detections= 'none'
    sky_masked = 'none'
    if (document.getElementById('smallDetectionsCheckbox')!=null) {
        ignore_small_detections = document.getElementById('smallDetectionsCheckbox').checked.toString()
        sky_masked = document.getElementById('skyMaskCheckbox').checked.toString()
    }

    //Masks
    var new_masks = []
    var edit_masks = []
    for (var key in addedMasks) {
        new_masks.push(addedMasks[key])
    }
    for (var key in editedMasks) {
        edit_masks.push({'id': key, 'coords': editedMasks[key]})
    }
    mask_dict = {
        'removed' : removedMasks,
        'added' : new_masks,
        'edited' : edit_masks
    }

    //Static Detections
    staticgroup_data = []
    for (let i=0;i<staticgroups.length;i++) {
        if (staticgroups[i].staticgroup_status!=og_staticgroup_status[staticgroups[i].id]) {
            staticgroup_data.push({
                'id': staticgroups[i].id,
                'status': staticgroups[i].staticgroup_status
            })
        }
    }


    if (legalFile&&legalClassifier&&!editingEnabled&&legalTimestamp) {
        document.getElementById('btnEditSurvey').disabled = true

        var formData = new FormData()
        formData.append("survey_id", selectedSurvey)
        formData.append("classifier_id", classifier_id)          
        formData.append("timestamps", JSON.stringify(timestampData))     
        formData.append("imageTimestamps", JSON.stringify(imageTimestampData))
        formData.append("masks", JSON.stringify(mask_dict))
        formData.append("staticgroups", JSON.stringify(staticgroup_data))
        formData.append("ignore_small_detections", ignore_small_detections)
        formData.append("sky_masked", sky_masked)
        if (document.getElementById('addCoordinatesManualMethod').checked) {
            formData.append("coordData", JSON.stringify(coordData))
        }
        else if (document.getElementById('addCoordinatesKMLMethod').checked) {
            formData.append("kml", kmlFileUpload.files[0])
        }
    
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", '/editSurvey');
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='success') {
                    document.getElementById('modalAlertBody').innerHTML = 'Your survey is being edited. Please note that this may take some time.'
                    document.getElementById('modalAlertHeader').innerHTML = 'Success'
                    alertReload = true
                    modalEditSurvey.modal('hide')
                    modalAlert.modal({keyboard: true});
                    clearEditSurveyModal()

                } else {
                    document.getElementById('editSurveyErrors').innerHTML = reply.message
                    document.getElementById('btnEditSurvey').disabled = false
                }
            }
        } 
        xhttp.send(formData);
    }
});

// function addImagesSendRequest(formData) {
//     /** Submits the add-images request to the server, and begins the browser upload if necessary. */

//     var xhttp = new XMLHttpRequest();
//     xhttp.open("POST", '/editSurvey');
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             reply = JSON.parse(this.responseText);  

//             if (reply.status=='success') {

//                 if ((tabActiveEditSurvey=='baseAddImagesTab')&&(document.getElementById('BrowserAdd').checked)) {
//                     uploadID = reply.survey_id
//                     surveyName = reply.survey_name
//                     uploading = true
//                     updatePage(current_page)
//                     // uploadFiles(true)
//                     // uploading = true
//                     // var xhttp = new XMLHttpRequest();
//                     // xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/Uploading');
//                     // xhttp.send();
                    
//                     // ProgBarDiv = document.getElementById('uploadProgBarDiv')

//                     // while(ProgBarDiv.firstChild){
//                     //     ProgBarDiv.removeChild(ProgBarDiv.firstChild);
//                     // }

//                     // var newProg = document.createElement('div');
//                     // newProg.classList.add('progress');

//                     // var newProgInner = document.createElement('div');
//                     // newProgInner.classList.add('progress-bar');
//                     // newProgInner.classList.add('progress-bar-striped');
//                     // newProgInner.classList.add('active');
//                     // newProgInner.setAttribute("role", "progressbar");
//                     // newProgInner.setAttribute("id", "uploadProgBar");
//                     // newProgInner.setAttribute("aria-valuenow", "0");
//                     // newProgInner.setAttribute("aria-valuemin", "0");
//                     // newProgInner.setAttribute("aria-valuemax", files.length.toString());
//                     // newProgInner.setAttribute("style", "width:0%");

//                     // newProg.appendChild(newProgInner);
//                     // ProgBarDiv.appendChild(newProg);

//                     // modalAddImages.modal('hide')
//                     // modalUploadProgress.modal({backdrop: 'static', keyboard: false});

//                     // uploadSurveyToCloud(surveyName)
//                 } else {

//                     if ((tabActiveEditSurvey=='baseAddImagesTab')&&(tabActiveEditSurvey=='baseAddCoordinatesTab')) {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your additional images and coordinates are being imported.'
//                     } else if (tabActiveEditSurvey=='baseAddImagesTab') {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your additional images are being imported.'
//                     } else if (tabActiveEditSurvey=='baseEditTimestampsTab') {
//                         document.getElementById('modalAlertBody').innerHTML = `<p>Your camera timestamps will now be edited.</p><p>Please note that if you have muliple cameras per site, 
//                                                                                 the images from the affected sites will need to be re-clustered if the operation periods of the edited 
//                                                                                 cameras overlap with any others (before or after having  had their timestamps edited). In such a case, 
//                                                                                 auto-classification will need to be performed again and any old auto-classifications will be overwritten. 
//                                                                                 In addition, any manually-annotated clusters that were incorrectly clustered (ie. specifically those that 
//                                                                                 need to be split up) will have their labels removed to ensure accurate annoation of your data. However, 
//                                                                                 any sighting-level labels that were manually checked in the "sighting (box) correction" workflow will be 
//                                                                                 retained.</p><p>In light of the above, your annotation sets for this survey may need some more annotation 
//                                                                                 upon completion of the processing required. Moreover, this process may take a while depending on the number 
//                                                                                 of affected images.</p><p>In general, it is strongly recommended that camera timestamps should be corrected 
//                                                                                 prior to the annotation of your data due to the cluster-centric approach used in TrapTagger. In particular, 
//                                                                                 this step should be peformed directly after data importation for best results. However, editing your 
//                                                                                 timestamps later on will not affect the integrity of you data - you may just need to re-annotate some 
//                                                                                 percentage of it.</p>`
//                     } else if (tabActiveEditSurvey=='baseEditImgTimestampsTab') {
//                         document.getElementById('modalAlertBody').innerHTML = `<p>Your image timestamps will now be edited.</p><p>Images or videos whose
//                                                                                 timestamps have been corrected that were missing or extracted will need to be re-clustered. In such a case, 
//                                                                                 auto-classification will need to be performed again and any old auto-classifications will be overwritten. 
//                                                                                 In addition, any manually-annotated clusters that were incorrectly clustered (ie. specifically those that 
//                                                                                 need to be split up) will have their labels removed to ensure accurate annoation of your data. However, 
//                                                                                 any sighting-level labels that were manually checked in the "sighting (box) correction" workflow will be 
//                                                                                 retained.</p><p>In light of the above, your annotation sets for this survey may need some more annotation 
//                                                                                 upon completion of the processing required. Moreover, this process may take a while depending on the number 
//                                                                                 of affected images.</p><p>In general, it is strongly recommended that image timestamps should be corrected 
//                                                                                 prior to the annotation of your data due to the cluster-centric approach used in TrapTagger. In particular, 
//                                                                                 this step should be peformed directly after data importation for best results. However, editing your 
//                                                                                 timestamps later on will not affect the integrity of you data - you may just need to re-annotate some 
//                                                                                 percentage of it.</p>`
//                     } else if (tabActiveEditSurvey=='baseEditClassifierTab') {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your survey is now being re-classified. This may take a while.'
//                     } else if (tabActiveEditSurvey=='baseEditMasksTab') {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your masks are being updated. You may be required to annotate some images again if there are detections that are no longer masked. Please note that this may take a while.'
//                     } else if (tabActiveEditSurvey=='baseStaticTab') {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your static detections are being updated. You may be required to annotate again if there are detections that are no longer static. Please note that this may take a while.'
//                     } else if ((document.getElementById('addCoordinatesManualMethod')!=null)&&(document.getElementById('addCoordinatesManualMethod').checked)) {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your coordinates are being updated.'
//                     } else if (document.getElementById('smallDetectionsCheckbox')!=null) {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your survey options are being updated.'
//                     } else {
//                         document.getElementById('modalAlertBody').innerHTML = 'Your coordinates are being imported.'
//                     }

//                     document.getElementById('modalAlertHeader').innerHTML = 'Success'
//                     alertReload = true
//                     modalEditSurvey.modal('hide')
//                     modalAlert.modal({keyboard: true});
//                 }

//             } else {
//                 document.getElementById('editSurveyErrors').innerHTML = reply.message
//                 document.getElementById('btnEditSurvey').disabled = false
//             }
//         }
//     }
//     xhttp.send(formData);
// }

// document.getElementById('cancelUpload').addEventListener('click', ()=>{
//     /** Cancels the browser upload when the concel button is pressed. */
//     stopFlag = true
//     var xhttp = new XMLHttpRequest();
//     xhttp.open("GET", '/deleteSurvey/'+surveyName);
//     xhttp.send();
// });

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

// modalUploadProgress.on('hidden.bs.modal', function(){
//     /** Clears the new survey and edit survey modals when the upload modal is closed. */
//     resetNewSurveyPage()
//     // resetAddImagesPage()
//     uploading = false
// });


function isValidDate(d) {
    /** Returns whether the specified date is valid or not */
    return d instanceof Date && !isNaN(d);
}

function getOrganisations(){
    /* Gets the organisations for the current user and populates the organisation select for the new survey modal. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            var organisations = reply.organisations
            var select = document.getElementById('newSurveyOrg')
            clearSelect(select)
            var optionTexts = []
            var optionValues = []
            for (var i=0;i<organisations.length;i++) {
                optionTexts.push(organisations[i].name)
                optionValues.push(organisations[i].id)
            }
            fillSelect(select,optionTexts,optionValues)
        }
    }
    xhttp.open("GET", '/getOrganisations?create=true');
    xhttp.send();
    
}

$('#detailedAccessSurveyCb').change( function() {
    /** Event listener for the detailed access checkbox on the create new survey modal. */
    if (this.checked) {
        org_id = document.getElementById('newSurveyOrg').value
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                globalOrganisationUsers = reply

                var surveyPermissionsDiv = document.getElementById('surveyPermissionsDiv')
                while(surveyPermissionsDiv.firstChild){
                    surveyPermissionsDiv.removeChild(surveyPermissionsDiv.firstChild);
                }

                document.getElementById('detailedAccessSurveyDiv').hidden = false
                buildSurveyPermissionRow()
            }
        }
        xhttp.open("GET", '/getOrganisationUsers/'+org_id);
        xhttp.send();

    }
    else{
        document.getElementById('detailedAccessSurveyDiv').hidden = true
        var surveyPermissionsDiv = document.getElementById('surveyPermissionsDiv')
        while(surveyPermissionsDiv.firstChild){
            surveyPermissionsDiv.removeChild(surveyPermissionsDiv.firstChild);
        }
    }
});

$('#newSurveyOrg').change( function() {
    /** Event listener for the organisation select on the create new survey modal. */
    if (document.getElementById('detailedAccessSurveyCb').checked) {
        org_id = document.getElementById('newSurveyOrg').value
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                globalOrganisationUsers = reply

                var surveyPermissionsDiv = document.getElementById('surveyPermissionsDiv')
                while(surveyPermissionsDiv.firstChild){
                    surveyPermissionsDiv.removeChild(surveyPermissionsDiv.firstChild);
                }
                
                buildSurveyPermissionRow()
            }
        }
        xhttp.open("GET", '/getOrganisationUsers/'+org_id);
        xhttp.send();
    }

    S3BucketUpload = document.getElementById('S3BucketUpload')
    org_id = document.getElementById('newSurveyOrg').value
    if (S3BucketUpload.checked) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", '/getFolders?org_id='+org_id);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                buildBucketUpload('newSurveyFormDiv',reply)
            }
        }
        xhttp.send();
    }
});

function buildSurveyPermissionRow(){
    /** Builds a row for the detailed survey permission section on the create new survey modal. */
    var surveyPermissionsDiv = document.getElementById('surveyPermissionsDiv')
    var IDNum = getIdNumforNext('surveyUserPermission-')

    var row = document.createElement('div')
    row.classList.add('row')
    surveyPermissionsDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    col1.style.display = 'flex'
    col1.style.alignItems = 'center'
    col1.style.justifyContent = 'center'
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-5')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.style.display = 'flex'
    col3.style.alignItems = 'center'
    col3.style.justifyContent = 'center'
    row.appendChild(col3)

    var col4 = document.createElement('div')
    col4.classList.add('col-lg-1')
    col4.style.display = 'flex'
    col4.style.alignItems = 'center'
    col4.style.justifyContent = 'center'
    row.appendChild(col4)

    // User
    var user = document.createElement('select');
    user.classList.add('form-control')
    user.id = 'surveyUserPermission-' + IDNum;
    col1.appendChild(user);

    var optionTexts = []
    var optionValues = []
    for (var i=0;i<globalOrganisationUsers.length;i++) {
        optionTexts.push(globalOrganisationUsers[i][1])
        optionValues.push(globalOrganisationUsers[i][0])
    }
    fillSelect(user,optionTexts,optionValues)

    user.addEventListener('change', function (wrapIDNum) {
        return function() {
            user_id = this.value
            def_access = globalOrganisationUsers.filter(function(item) {
                return item[0] == user_id;
            })[0][2]

            var accessSlider = document.getElementById('detailedAccessSurvey-' + wrapIDNum);
            if (def_access=='worker') {
                accessSlider.value = 0
                accessSlider.disabled = true
            }
            else{
                accessSlider.disabled = false
            }
        }
    }(IDNum));

    // Access
    var defaultDiv = document.createElement('div');
    defaultDiv.setAttribute('class','text-center')
    defaultDiv.setAttribute('style','vertical-align: middle;')
    col2.appendChild(defaultDiv);    
    
    var row = document.createElement('div')
    row.classList.add('row');
    defaultDiv.appendChild(row)
    
    var col1 = document.createElement('div')
    col1.classList.add('col-lg-12');
    row.appendChild(col1)

    var slider = document.createElement('input');
    slider.setAttribute("type", "range");
    slider.setAttribute("class", "custom-range");
    slider.setAttribute('style','width: 85%;')
    slider.setAttribute("min", "0");
    slider.setAttribute("max", "3");
    slider.setAttribute("step", "1");
    slider.setAttribute("id", "detailedAccessSurvey-" + IDNum);
    col1.appendChild(slider);

    var row = document.createElement('div')
    row.classList.add('row');
    defaultDiv.appendChild(row)

    var col_0 = document.createElement('div')
    col_0.classList.add('col-lg-3');
    col_0.setAttribute('style','vertical-align: middle; text-align: center;')
    col_0.innerText = default_access[0];
    row.appendChild(col_0)

    var col_1 = document.createElement('div')
    col_1.classList.add('col-lg-3');
    col_1.setAttribute('style','vertical-align: middle; text-align: center;')
    col_1.innerText = default_access[1];
    row.appendChild(col_1)

    var col_2 = document.createElement('div')
    col_2.classList.add('col-lg-3');
    col_2.setAttribute('style','vertical-align: middle; text-align: center;')
    col_2.innerText = default_access[2];
    row.appendChild(col_2)

    var col_3 = document.createElement('div')
    col_3.classList.add('col-lg-3');
    col_3.setAttribute('style','vertical-align: middle; text-align: center;')
    col_3.innerText = default_access[3];
    row.appendChild(col_3)

    // Annotation Access
    var toggleDiv = document.createElement('div');
    toggleDiv.classList.add('text-center');
    toggleDiv.style.verticalAlign = 'middle';
    col3.appendChild(toggleDiv);

    var toggle = document.createElement('label');
    toggle.classList.add('switch');
    toggleDiv.appendChild(toggle);

    var checkbox = document.createElement('input');
    checkbox.setAttribute("type", "checkbox");
    checkbox.id = 'detailedJobAccessSurvey-' + IDNum;
    toggle.appendChild(checkbox);

    var slider = document.createElement('span');
    slider.classList.add('slider');
    slider.classList.add('round');
    toggle.appendChild(slider);

    // Remove
    var button = document.createElement('button');
    button.setAttribute("class",'btn btn-info')
    button.innerHTML = '&times;';
    button.id = 'btnRemoveSurveyAccess-' + IDNum;
    col4.appendChild(button);

    button.addEventListener('click', function () {
        this.parentNode.parentNode.remove()
    });

}

function changeEditSurveyTab(evt, tabName) {
    /** Opens the permissions tab */

    var mainModal = document.getElementById('modalEditSurvey')
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
    tabActiveEditSurvey = tabName

    if (tabName == 'baseAddCoordinatesTab') {
        openAddCoordinates()
    }
    else if (tabName == 'baseEditTimestampsTab') {
        openEditTimestamps()
    }
    else if (tabName == 'baseEditClassifierTab') {
        openEditClassifier()
    }
    else if (tabName == 'baseAdvancedTab') {
        openAdvanced()
    }
    else if (tabName == 'baseEditMasksTab') {
        openEditMasks()
    }
    else if (tabName == 'baseStaticTab'){
        openStaticDetections()
    }
    else if (tabName == 'baseStructureTab'){
        openStructure()
    }
    else if (tabName == 'baseEditImgTimestampsTab') {
        openEditImageTimestamps()
    }

    document.getElementById('editSurveyErrors').innerHTML = ''
}

function openEditMasks() {
    /** Listens for and initialises the edit masks form on the edit survey modal when the radio button is selected. */
    if (tabActiveEditSurvey=='baseEditMasksTab') {
        var editMasksDiv = document.getElementById('editMasksDiv')
        if (editMasksDiv.firstChild==null) {
            removedMasks = []
            addedMasks = {}
            editedMasks = {}
            maskCamIndex = 0
            maskImgIndex = 0
            leafletMaskIDs = {}
            if (mapMask){
                mapMask.remove()
            }
            mapMask = null
            maskCamIDs = []
            maskCamReadAheadIndex = 0
            cameras = []
            maskCam_ids = []
            finishedDisplayingMask = true
            cameragroup_page = {}
            buildEditMasks()
        }
    }
}


function buildEditMasks() {
    /** Builds the edit masks layout on the edit survey modal. */

    var editMasksDiv = document.getElementById('editMasksDiv')

    while(editMasksDiv.firstChild){
        editMasksDiv.removeChild(editMasksDiv.firstChild);
    }

    var row = document.createElement('div')
    row.classList.add('row')
    editMasksDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-8')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var h6 = document.createElement('h6')
    h6.id = 'mapTitle_mask'
    h6.innerHTML = 'Loading...'
    col2.appendChild(h6)

    var row = document.createElement('div')
    row.classList.add('row')
    editMasksDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-8')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var center = document.createElement('center')
    col2.appendChild(center)

    var mapDiv = document.createElement('div')
    mapDiv.id = 'mapDiv_mask'
    mapDiv.style.height = '700px'
    center.appendChild(mapDiv)

    var rowDiv2 = document.createElement('div');
    rowDiv2.classList.add('row');
    col3.appendChild(rowDiv2);

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Users'
    col3.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>The users that have created or edited the masks for this camera.</i>'
    col3.appendChild(div)

    var rowDiv3 = document.createElement('div');
    rowDiv3.classList.add('row');
    col3.appendChild(rowDiv3);

    var colU = document.createElement('div')
    colU.classList.add('col-lg-12')
    rowDiv3.append(colU)

    var input = document.createElement('textarea')
    input.id = 'maskUsers'
    input.classList.add('form-control')
    // input.setAttribute('type','text')
    input.setAttribute('style', 'background-color: white; outline-color: #DF691A; rows: 2; resize: none;')
    input.disabled = true
    colU.appendChild(input)


    var row = document.createElement('div')
    row.classList.add('row')
    editMasksDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-1')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-10')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-1')
    row.appendChild(col3)

    var rowDiv = document.createElement('div');
    rowDiv.classList.add('row');
    col2.appendChild(rowDiv);

    var colDiv = document.createElement('div');
    colDiv.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center');
    rowDiv.appendChild(colDiv);

    var clusterDiv = document.createElement('div');
    clusterDiv.id = 'clusterPosition_mask';
    colDiv.appendChild(clusterDiv);

    var paginationUl = document.createElement('ul');
    paginationUl.classList.add('pagination');
    paginationUl.id = 'paginationCircles_mask';
    paginationUl.style.margin = '10px';
    clusterDiv.appendChild(paginationUl);


    var row = document.createElement('div')
    row.classList.add('row')
    col2.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    var col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnPrevCameraMask'
    button.innerHTML = '<span style="font-size:100%">&#x276e;&#x276e;</span> Previous Camera'
    button.disabled = true
    col1.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnPrevImageMask'
    button.innerHTML = '<span style="font-size:100%">&#x276e;</span> Previous Image'
    button.disabled = true
    col2.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnNextImageMask'
    button.innerHTML = 'Next Image <span style="font-size:100%">&#x276f;</span>'
    button.disabled = true
    col3.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnNextCameraMask'
    button.innerHTML = 'Next Camera <span style="font-size:100%">&#x276f;&#x276f;</span>'
    button.disabled = true
    col4.appendChild(button)

    document.getElementById('btnPrevCameraMask').addEventListener('click', ()=>{
        if (maskCamIndex>0 && !editingEnabled && finishedDisplayingMask) {
            maskCamIndex -= 1
            maskImgIndex = 0
            updateMaskMap()
        }
    });

    document.getElementById('btnPrevImageMask').addEventListener('click', ()=>{
        if (maskImgIndex>0 && !editingEnabled && finishedDisplayingMask) {
            maskImgIndex -= 1
            updateMaskMap()
        }
    });

    document.getElementById('btnNextImageMask').addEventListener('click', ()=>{
        if (maskImgIndex<cameras[maskCamIndex].images.length-1 && !editingEnabled && finishedDisplayingMask) {
            maskImgIndex += 1
            updateMaskMap()
        }
        else if (maskImgIndex==cameras[maskCamIndex].images.length-1 && !editingEnabled && finishedDisplayingMask && cameragroup_page[cameras[maskCamIndex].id].next_page != null) {	
            getNextMasks(cameragroup_page[cameras[maskCamIndex].id].next_page)
        }
    });

    document.getElementById('btnNextCameraMask').addEventListener('click', ()=>{
        if (maskCamIndex<cameras.length-1 && !editingEnabled && finishedDisplayingMask) {
            maskCamIndex += 1
            maskImgIndex = 0
            updateMaskMap()
            if (maskCamIndex > cameras.length - 3){
                getMasks()
            }
        }
    });

    document.getElementById('btnPrevCameraMask').hidden = true
    document.getElementById('btnNextCameraMask').hidden = true
    document.getElementById('btnPrevImageMask').hidden = true
    document.getElementById('btnNextImageMask').hidden = true

    getMaskCameras()

}

function getMasks() {
    /** Gets the masks for the current survey. */

    if (maskCamReadAheadIndex < maskCamIDs.length) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                new_cameras = reply.masks

                if (new_cameras.length>0) {
                    cameragroup_page[new_cameras[0].id].next_page = reply.next_page
                }
                
                for (var i=0; i<new_cameras.length; i++) {
                    if (maskCam_ids.indexOf(new_cameras[i].id) == -1) {
                        maskCam_ids.push(new_cameras[i].id)
                        cameras.push(new_cameras[i])
                    }
                }

                if (cameras.length - 1 == maskCamIndex) {
                    updateMaskMap()
                }
                updateButtons()
                preloadImages()
            }
        }
        xhttp.open("GET", '/getSurveyMasks/'+selectedSurvey+'/'+maskCamIDs[maskCamReadAheadIndex++]);
        xhttp.send();
    }
}

function getNextMasks(page) {
    /** Gets the masks for the current survey. */

    if (page==null){
        updateMaskMap()
        updateButtons()
    } else {

        var cameragroup_id = cameras[maskCamIndex].id
        cameragroup_page[cameragroup_id].page = page

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                new_cameras = reply.masks
                if (new_cameras.length>0) {
                    cameragroup_page[new_cameras[0].id].next_page = reply.next_page
                }
                
                for (var i=0; i<new_cameras.length; i++) {
                    camera_id = new_cameras[i].id
                    var m_index = cameras.findIndex(x => x.id == camera_id)
                    if (m_index != -1) {
                        new_index = cameras[m_index].images.length
                        cameras[m_index].images.push(...new_cameras[i].images)
                        if (new_cameras[i].images.length > 0) {
                            maskImgIndex = new_index
                        }
                    }
                }

                updateMaskMap()
                updateButtons()
                preloadImages()
            }
        }
        xhttp.open("GET", '/getSurveyMasks/'+selectedSurvey+'/'+cameragroup_id+'?page='+page);
        xhttp.send();
    }
}

function prepMapMask(image) {
    /** Initialises the Leaflet image map for the edit survey modal. */
    if (bucketName != null) {
        mapReadyMask = false
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height

            if (w>h) {
                document.getElementById('mapDiv_mask').setAttribute('style','height: calc(38vw *'+(h/w)+');  width:38vw')               
            } else {
                document.getElementById('mapDiv_mask').setAttribute('style','height: calc(38vw *'+(w/h)+');  width:38vw')
            }

            L.Browser.touch = true

            map_config = {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0
            }
    
            mapMask = new L.map('mapDiv_mask', map_config);

            var h1 = document.getElementById('mapDiv_mask').clientHeight
            var w1 = document.getElementById('mapDiv_mask').clientWidth
    
            var southWest = mapMask.unproject([0, h1], 2);
            var northEast = mapMask.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mapWidth = northEast.lng
            mapHeight = southWest.lat
    
            activeImageMask = L.imageOverlay(imageUrl, bounds).addTo(mapMask);
            activeImageMask.on('load', function() {
                // addedDetectionsMask = false
                addDetections()
                finishedDisplayingMask = true
            });
            activeImageMask.on('error', function() {
                if (this._url.includes('-comp')) {
                    finishedDisplayingMask = true
                }
                else{
                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/"+modifyToCompURL(cameras[maskCamIndex].images[maskImgIndex].url))
                }
            });
            mapMask.setMaxBounds(bounds);
            mapMask.fitBounds(bounds)
            mapMask.setMinZoom(mapMask.getZoom())

            hc = document.getElementById('mapDiv_mask').clientHeight
            wc = document.getElementById('mapDiv_mask').clientWidth
            mapMask.on('resize', function(){
                if(document.getElementById('mapDiv_mask') && document.getElementById('mapDiv_mask').clientHeight){
                    var h1 = document.getElementById('mapDiv_mask').clientHeight
                    var w1 = document.getElementById('mapDiv_mask').clientWidth
                }
                else{
                    var h1 = hc
                    var w1 = wc
                }
                
                var southWest = mapMask.unproject([0, h1], 2);
                var northEast = mapMask.unproject([w1, 0], 2);
                var bounds = new L.LatLngBounds(southWest, northEast);
        
                mapWidth = northEast.lng
                mapHeight = southWest.lat

                mapMask.invalidateSize()
                mapMask.setMaxBounds(bounds)
                mapMask.fitBounds(bounds)
                mapMask.setMinZoom(mapMask.getZoom())
                activeImageMask.setBounds(bounds)

                addedDetectionsMask = false
                addDetections()

            });


            mapMask.on('drag', function() {
                mapMask.panInsideBounds(bounds, { animate: false });
            });
    
            mapMask.on('zoomstart', function() {
                if (!fullRes) {
                    activeImageMask.setUrl("https://"+bucketName+".s3.amazonaws.com/" + cameras[maskCamIndex].images[maskImgIndex].url)
                    fullRes = true  
                }
            });    

            drawnItemsMask = new L.FeatureGroup();
            mapMask.addLayer(drawnItemsMask);

            rectOptions = {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }  

            drawnMaskItems = new L.FeatureGroup();
            mapMask.addLayer(drawnMaskItems);
        
            maskRectOptions = {
                color: "rgba(91,192,222,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }
    
            if (drawControl != null) {
                drawControl.remove()
            }
        
            drawControl = new L.Control.Draw({
                draw: {
                    polygon: {
                        shapeOptions: maskRectOptions,
                        allowIntersection: false,
                    },
                    polyline: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    rectangle: {
                        shapeOptions: maskRectOptions,
                        showArea: false
                    }
                },
                edit: {
                    featureGroup: drawnMaskItems,
                }
            });
            mapMask.addControl(drawControl);
            drawControl._toolbars.draw._toolbarContainer.children[0].title = 'Draw a mask'
            drawControl._toolbars.draw._toolbarContainer.children[1].title = 'Draw a mask'

            maskEditPrep()
        
            mapReadyMask = true
        };
        img.src = imageUrl  
    }
}

function prepMapStatic(image) {
    /** Initialises the Leaflet image map for the edit survey modal. */

    if (bucketName != null) {
        mapReadyStatic = false
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height

            if (w>h) {
                document.getElementById('mapDiv_static').setAttribute('style','height: calc(38vw *'+(h/w)+');  width:38vw')               
            } else {
                document.getElementById('mapDiv_static').setAttribute('style','height: calc(38vw *'+(w/h)+');  width:38vw')
            }

            L.Browser.touch = true

            map_config = {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0
            }
    
            mapStatic = new L.map('mapDiv_static', map_config);

            var h1 = document.getElementById('mapDiv_static').clientHeight
            var w1 = document.getElementById('mapDiv_static').clientWidth
    
            var southWest = mapStatic.unproject([0, h1], 2);
            var northEast = mapStatic.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mapWidth = northEast.lng
            mapHeight = southWest.lat
    
            activeImageStatic = L.imageOverlay(imageUrl, bounds).addTo(mapStatic);
            activeImageStatic.on('load', function() {
                // addedDetectionsStatic = false
                addDetections()
                finishedDisplayingStatic = true
            });
            activeImageStatic.on('error', function() {
                if (this._url.includes('-comp')) {
                    finishedDisplayingStatic = true
                }
                else{
                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(staticgroups[staticgroupIndex].images[staticImgIndex].url))
                }
            });
            mapStatic.setMaxBounds(bounds);
            mapStatic.fitBounds(bounds)
            mapStatic.setMinZoom(mapStatic.getZoom())

            hc = document.getElementById('mapDiv_static').clientHeight
            wc = document.getElementById('mapDiv_static').clientWidth
            mapStatic.on('resize', function(){
                if(document.getElementById('mapDiv_static') && document.getElementById('mapDiv_static').clientHeight){
                    var h1 = document.getElementById('mapDiv_static').clientHeight
                    var w1 = document.getElementById('mapDiv_static').clientWidth
                }
                else{
                    var h1 = hc
                    var w1 = wc
                }
                
                var southWest = mapStatic.unproject([0, h1], 2);
                var northEast = mapStatic.unproject([w1, 0], 2);
                var bounds = new L.LatLngBounds(southWest, northEast);
        
                mapWidth = northEast.lng
                mapHeight = southWest.lat

                mapStatic.invalidateSize()
                mapStatic.setMaxBounds(bounds)
                mapStatic.fitBounds(bounds)
                mapStatic.setMinZoom(mapStatic.getZoom())
                activeImageStatic.setBounds(bounds)

                addedDetectionsStatic = false
                addDetections()

            });


            mapStatic.on('drag', function() {
                mapStatic.panInsideBounds(bounds, { animate: false });
            });
    
            mapStatic.on('zoomstart', function() {
                if (!fullRes) {
                    activeImageStatic.setUrl("https://"+bucketName+".s3.amazonaws.com/" + staticgroups[staticgroupIndex].images[staticImgIndex].url)
                    fullRes = true  
                }
            });    

            drawnItemsStatic = new L.FeatureGroup();
            mapStatic.addLayer(drawnItemsStatic);

            rectOptions = {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }  

            mapReadyStatic = true
        };
        img.src = imageUrl  
    }
}


function prepMapTime(image) {
    /** Initialises the Leaflet image map for the edit survey modal. */

    if (bucketName != null) {
        mapReadyTime = false
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height

            if (w>h) {
                document.getElementById('mapDiv_time').setAttribute('style','height: calc(38vw *'+(h/w)+');  width:38vw')               
            } else {
                document.getElementById('mapDiv_time').setAttribute('style','height: calc(38vw *'+(w/h)+');  width:38vw')
            }

            L.Browser.touch = true

            map_config = {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0,
                attributionControl: false
            }
    
            mapTime = new L.map('mapDiv_time', map_config);

            var h1 = document.getElementById('mapDiv_time').clientHeight
            var w1 = document.getElementById('mapDiv_time').clientWidth
    
            var southWest = mapTime.unproject([0, h1], 2);
            var northEast = mapTime.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mapWidth = northEast.lng
            mapHeight = southWest.lat
    
            activeImageTime = L.imageOverlay(imageUrl, bounds).addTo(mapTime);
            activeImageTime.on('load', function() {
                finishedDisplayingTime = true
            });
            activeImageTime.on('error', function() {
                if (this._url.includes('-comp')) {
                    finishedDisplayingTime = true
                }
                else{
                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(images[cameraIndex].images[imageIndex].url))
                }
            });
            mapTime.setMaxBounds(bounds);
            mapTime.fitBounds(bounds)
            mapTime.setMinZoom(mapTime.getZoom())

            hc = document.getElementById('mapDiv_time').clientHeight
            wc = document.getElementById('mapDiv_time').clientWidth
            mapTime.on('resize', function(){
                if(document.getElementById('mapDiv_time') && document.getElementById('mapDiv_time').clientHeight){
                    var h1 = document.getElementById('mapDiv_time').clientHeight
                    var w1 = document.getElementById('mapDiv_time').clientWidth
                }
                else{
                    var h1 = hc
                    var w1 = wc
                }
                
                var southWest = mapTime.unproject([0, h1], 2);
                var northEast = mapTime.unproject([w1, 0], 2);
                var bounds = new L.LatLngBounds(southWest, northEast);
        
                mapWidth = northEast.lng
                mapHeight = southWest.lat

                mapTime.invalidateSize()
                mapTime.setMaxBounds(bounds)
                mapTime.fitBounds(bounds)
                mapTime.setMinZoom(mapTime.getZoom())
                activeImageTime.setBounds(bounds)

            });


            mapTime.on('drag', function() {
                mapTime.panInsideBounds(bounds, { animate: false });
            });
    
            mapTime.on('zoomstart', function() {
                if (!fullRes) {
                    activeImageTime.setUrl("https://"+bucketName+".s3.amazonaws.com/" + images[cameraIndex].images[imageIndex].url)
                    fullRes = true  
                }
            });    

            mapReadyTime = true
        };
        img.src = imageUrl  
    }
}

function addDetections() {
    /** Adds the detections to the map. */

    if (tabActiveEditSurvey=='baseEditMasksTab') {
        if (addedDetectionsMask == false) {
            fullRes = false
            drawnItemsMask.clearLayers()
            drawnMaskItems.clearLayers()
            mapMask.setZoom(mapMask.getMinZoom())

            // Draw detections
            for(var i=0;i<cameras[maskCamIndex].images[maskImgIndex].detections.length;i++){
                var detection = cameras[maskCamIndex].images[maskImgIndex].detections[i]
                rect = L.rectangle([[detection.top*mapHeight,detection.left*mapWidth],[detection.bottom*mapHeight,detection.right*mapWidth]], rectOptions)
                drawnItemsMask.addLayer(rect)
            }

            // Draw masks
            for(var i=0;i<cameras[maskCamIndex].masks.length;i++){
                var mask = cameras[maskCamIndex].masks[i]
                var coords = mask['coords']
                poly_coords = []
                for(var j=0;j<coords.length;j++){
                    poly_coords.push([coords[j][1]*mapHeight,coords[j][0]*mapWidth])
                }
                poly = L.polygon(poly_coords, maskRectOptions)
                drawnMaskItems.addLayer(poly)
                leafletMaskIDs[mask.id] = poly._leaflet_id
            }

            addedDetectionsMask = true
        }
    }
    else if (tabActiveEditSurvey=='baseStaticTab') {
        if (addedDetectionsStatic == false) {
            fullRes = false
            drawnItemsStatic.clearLayers()
            mapStatic.setZoom(mapStatic.getMinZoom())

            // Draw detections
            for(var i=0;i<staticgroupDetections[staticgroups[staticgroupIndex].id].length;i++){
                var detection = staticgroupDetections[staticgroups[staticgroupIndex].id][i]
                rect = L.rectangle([[detection.top*mapHeight,detection.left*mapWidth],[detection.bottom*mapHeight,detection.right*mapWidth]], rectOptions)
                drawnItemsStatic.addLayer(rect)
            }

            addedDetectionsStatic = true
        }
    }
    
}

function modifyToCompURL(url) {
    /** Modifies the URL to be compatible with the S3 bucket. */
    splits=url.split('/')
    splits[0]=splits[0]+'-comp'
    return splits.join('/')
}


function updateMaskMap() {
    /** Updates the mask map after an action has been performed. */

    finishedDisplayingMask = false
    fullRes = false
    addedDetectionsMask = false

    document.getElementById('mapTitle_mask').innerHTML = cameras[maskCamIndex].images[maskImgIndex].url.split('/').slice(1).join('/')

    document.getElementById('maskUsers').value = ''
    mask_users=''
    for (let i=0; i<cameras[maskCamIndex].masks.length; i++){
        if (!mask_users.includes(cameras[maskCamIndex].masks[i].user) && cameras[maskCamIndex].masks[i].user != 'None') {
            mask_users += cameras[maskCamIndex].masks[i].user + ', '
        }
    }
    document.getElementById('maskUsers').value = mask_users.slice(0,-2)

    if (mapMask != null) {
        activeImageMask.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(cameras[maskCamIndex].images[maskImgIndex].url))
    }
    else{
        prepMapMask(cameras[maskCamIndex].images[maskImgIndex])
    }

    updateButtons()
    preloadImages(true)
}

function updateImageIndex(index) {
    /** Updates the image index. */
    if (tabActiveEditSurvey=='baseEditMasksTab') {
        if (index >= 0 && index < cameras[maskCamIndex].images.length && !editingEnabled && finishedDisplayingMask) {
            maskImgIndex = index
            updateMaskMap()
        }
    }
    else if (tabActiveEditSurvey=='baseStaticTab'){
        if (index >= 0 && index < staticgroups[staticgroupIndex].images.length && finishedDisplayingStatic) {
            staticImgIndex = index
            updateStaticMap()
        }
    }
    else if (tabActiveEditSurvey=='baseEditImgTimestampsTab'){
        validTimestamp = validateTimestamp()
        if (index >= 0 && index < images[cameraIndex].images.length && validTimestamp && finishedDisplayingTime) {
            imageIndex = index
            updateImageMap()
        }
    }
}


function maskEditPrep() {
    /** Preps the mapMask for masking and tagging. */

    mapMask.on("draw:drawstart", function(e) {
        editingEnabled = true
    })

    mapMask.on("draw:drawstop", function(e) {
        editingEnabled = false
    })

    mapMask.on("draw:editstart", function(e) {
        editingEnabled = true
    })

    mapMask.on("draw:editstop", function(e) {
        editingEnabled = false
        updateMasks()
    })

    mapMask.on("draw:deletestart", function(e) {
        editingEnabled = true
    })

    mapMask.on("draw:deletestop", function(e) {
        editingEnabled = false
        updateMasks()
    })

    mapMask.on('draw:created', function (e) {
        var newLayer = e.layer;
        var newBounds = newLayer.getBounds();
        var isOverlapping = false;

        drawnMaskItems.eachLayer(function (layer) {
            if (newBounds.intersects(layer.getBounds())) {
                isOverlapping = true;
            }
        });

        if (isOverlapping && document.getElementById('modalAlertText') != null) {
            document.getElementById('modalAlertText').innerHTML = "The masked area you've outlined overlaps with another masked area. A detection will only be considered masked if it is fully within the boundaries of a single mask. It is recommended that you either adjust the existing mask to cover the entire detection area or delete it and create a new one."
            modalAlert.modal({keyboard: true});
            drawnMaskItems.removeLayer(newLayer);
        } else {
            drawnMaskItems.addLayer(newLayer);  
        }

        leafletMaskIDs['l_' + newLayer._leaflet_id] = newLayer._leaflet_id
        var new_mask = {'id':'l_' + newLayer._leaflet_id, 'coords':[]}
        cameras[maskCamIndex].masks.push(new_mask)

        updateMasks()

    });

}

function updateMasks() {
    /** Updates the masks after an edit has been performed. */

    for (var i=0;i<cameras[maskCamIndex].masks.length;i++) {
        if (drawnMaskItems.getLayer(leafletMaskIDs[cameras[maskCamIndex].masks[i].id]) == null) {
            if (!cameras[maskCamIndex].masks[i].id.toString().startsWith('l_')) {
                removedMasks.push(cameras[maskCamIndex].masks[i].id)
                delete editedMasks[cameras[maskCamIndex].masks[i].id]
            }
            else{
                delete addedMasks[cameras[maskCamIndex].masks[i].id]
            }
            delete leafletMaskIDs[cameras[maskCamIndex].masks[i].id]
            cameras[maskCamIndex].masks.splice(i,1)
            i -= 1
        }
        else{
            var coords = drawnMaskItems.getLayer(leafletMaskIDs[cameras[maskCamIndex].masks[i].id])._latlngs[0]
            var new_coords = []
            for (var j=0;j<coords.length;j++) {
                new_coords.push([coords[j].lng/mapWidth,coords[j].lat/mapHeight])
            }
            new_coords.push(new_coords[0])

            edit_coords = false
            // Check if coords are different
            if (cameras[maskCamIndex].masks[i].coords.length == new_coords.length) {
                for (var j=0;j<cameras[maskCamIndex].masks[i].coords.length;j++) {
                    if (cameras[maskCamIndex].masks[i].coords[j][0] != new_coords[j][0] || cameras[maskCamIndex].masks[i].coords[j][1] != new_coords[j][1]) {
                        edit_coords = true
                        break
                    }
                }
            }
            else{
                edit_coords = true
            }

            if (edit_coords) {
                cameras[maskCamIndex].masks[i].coords = new_coords
                if (cameras[maskCamIndex].masks[i].id.toString().startsWith('l_')) {
                    addedMasks[cameras[maskCamIndex].masks[i].id] = {
                        'coords': new_coords,
                        'cameragroup_id': cameras[maskCamIndex].id,
                    }
                }
                else{
                    editedMasks[cameras[maskCamIndex].masks[i].id] = new_coords
                }

            }
        }
    }
}

function getMaskCameras(){
    /* Gets the cameras for the current survey that has masks */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            maskCamIDs = reply

            cameragroup_page = {}
            for (var i=0; i<maskCamIDs.length; i++) {
                cameragroup_page[maskCamIDs[i]] = {'page':1, 'next_page':null}
            }

            cameras = []

            if (maskCamIDs.length>0) {
                document.getElementById('btnPrevCameraMask').hidden = false
                document.getElementById('btnNextCameraMask').hidden = false
                document.getElementById('btnPrevImageMask').hidden = false
                document.getElementById('btnNextImageMask').hidden = false

                for (var i=0; i<3; i++) {
                    getMasks()
                }  
            }
            else{
                editMasksDiv = document.getElementById('editMasksDiv')
                while(editMasksDiv.firstChild){
                    editMasksDiv.removeChild(editMasksDiv.firstChild);
                }

                var row = document.createElement('div')
                row.classList.add('row')
                editMasksDiv.appendChild(row)

                var col1 = document.createElement('div')
                col1.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center')
                row.appendChild(col1)

                var h6 = document.createElement('h6')
                h6.innerHTML = 'You have no masks to edit.'
                col1.appendChild(h6)
            }
        }
    }
    xhttp.open("GET", '/getMaskCameragroups/'+selectedSurvey);
    xhttp.send();
}

function updateButtons() {
    /** Updates the buttons on the edit survey modal. */
    
    if (tabActiveEditSurvey === 'baseEditMasksTab') {
        const btnPrevImage = document.getElementById('btnPrevImageMask');
        const btnNextImage = document.getElementById('btnNextImageMask');
        const btnPrevCamera = document.getElementById('btnPrevCameraMask');
        const btnNextCamera = document.getElementById('btnNextCameraMask');
        btnPrevImage.disabled = maskImgIndex === 0;
        btnNextImage.disabled = maskImgIndex === cameras[maskCamIndex].images.length - 1 && !cameragroup_page[cameras[maskCamIndex].id].next_page;
        btnPrevCamera.disabled = maskCamIndex === 0;
        btnNextCamera.disabled = maskCamIndex === cameras.length - 1;
    } else if (tabActiveEditSurvey === 'baseStaticTab') {
        const btnPrevImage = document.getElementById('btnPrevImageStatic');
        const btnNextImage = document.getElementById('btnNextImageStatic');
        const btnPrevGroup = document.getElementById('btnPrevGroup');
        const btnNextGroup = document.getElementById('btnNextGroup');
        btnPrevImage.disabled = staticImgIndex === 0;
        btnNextImage.disabled = staticImgIndex === staticgroups[staticgroupIndex].images.length - 1 && !staticgroup_page[staticgroups[staticgroupIndex].id].next_page;
        btnPrevGroup.disabled = staticgroupIndex === 0;
        btnNextGroup.disabled = staticgroupIndex === staticgroups.length - 1;
    } else if (tabActiveEditSurvey === 'baseEditImgTimestampsTab') {
        const btnPrevImage = document.getElementById('btnPrevImage');
        const btnNextImage = document.getElementById('btnNextImage');
        const btnPrevCamera = document.getElementById('btnPrevCamera');
        const btnNextCamera = document.getElementById('btnNextCamera');
        btnPrevImage.disabled = imageIndex === 0;
        btnNextImage.disabled = imageIndex === images[cameraIndex].images.length - 1 && !timestamp_page[images[cameraIndex].id].next_page;
        btnPrevCamera.disabled = cameraIndex === 0;
        btnNextCamera.disabled = cameraIndex === images.length - 1;
    }

    updatePaginationCircles();
}

function updatePaginationCircles(){
    /** Updates pagination circles on the edit survey modal. */

    clusterPosition = null
    addNext = null
    if (tabActiveEditSurvey=='baseEditMasksTab'){
        cirNum = cameras[maskCamIndex].images.length
        circlesIndex = maskImgIndex
        clusterPosition = document.getElementById('clusterPosition_mask')
        paginationCircles = document.getElementById('paginationCircles_mask')
        addNext = cameragroup_page[cameras[maskCamIndex].id].next_page
        next_function = 'getNextMasks('+addNext+')'
    }
    else if (tabActiveEditSurvey=='baseStaticTab'){
        cirNum = staticgroups[staticgroupIndex].images.length
        circlesIndex = staticImgIndex
        clusterPosition = document.getElementById('clusterPosition_static')
        paginationCircles = document.getElementById('paginationCircles_static')
        addNext = staticgroup_page[staticgroups[staticgroupIndex].id].next_page
        next_function = 'getNextStaticDetections('+addNext+')'
    }
    else if (tabActiveEditSurvey=='baseEditImgTimestampsTab'){
        cirNum = images[cameraIndex].images.length
        circlesIndex = imageIndex
        clusterPosition = document.getElementById('clusterPosition_time')
        paginationCircles = document.getElementById('paginationCircles_time')
        addNext = timestamp_page[images[cameraIndex].id].next_page
        next_function = 'getNextTimestampImages('+addNext+')'
    }

    if (clusterPosition != null) {
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
            first.setAttribute('onclick','updateImageIndex(0)')
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
            li.setAttribute('onclick','updateImageIndex('+(i).toString()+')')
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
            last.setAttribute('onclick','updateImageIndex('+(last_index).toString()+')')
            last.innerHTML = (last_index+1).toString()
            last.style.fontSize = '60%'
            paginationCircles.append(last)
        }

        if (addNext) {
            next = document.createElement('li')
            next.setAttribute('onclick',next_function)
            next.innerHTML = '>'
            next.style.fontSize = '60%'
            paginationCircles.append(next)
        }
    }

}

function openStaticDetections() {
    /** Listens for and initialises the edit masks form on the edit survey modal when the radio button is selected. */
    if (tabActiveEditSurvey=='baseStaticTab') {
        var editStaticDiv = document.getElementById('editStaticDiv')
        if (editStaticDiv.firstChild==null) {
            staticgroupIndex = 0
            staticImgIndex = 0
            if (mapStatic){
                mapStatic.remove()
            }
            mapStatic = null
            staticgroupIDs = []
            staticgroupReadAheadIndex = 0
            staticgroups = []
            staticgroup_ids = []
            finishedDisplayingStatic = true
            staticgroupDetections = {}
            og_staticgroup_status = {}
            staticCameras = []
            getStaticCameras()
        }
    }
}


function buildViewStatic() {
    /** Builds the view static layout on the edit survey modal. */

    var editStaticDiv = document.getElementById('editStaticDiv')

    while(editStaticDiv.firstChild){
        editStaticDiv.removeChild(editStaticDiv.firstChild);
    }

    var row = document.createElement('div')
    row.classList.add('row')
    editStaticDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-8')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var h6 = document.createElement('h6')
    h6.id = 'mapTitle_static'
    h6.innerHTML = 'Loading...'
    col2.appendChild(h6)

    var row = document.createElement('div')
    row.classList.add('row')
    editStaticDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-8')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var center = document.createElement('center')
    col2.appendChild(center)

    var mapDiv = document.createElement('div')
    mapDiv.id = 'mapDiv_static'
    mapDiv.style.height = '700px'
    center.appendChild(mapDiv)

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'User'
    col3.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>This is who checked the static detections.</i>'
    col3.appendChild(div)

    var rowDiv3 = document.createElement('div');
    rowDiv3.classList.add('row');
    col3.appendChild(rowDiv3);

    var colU = document.createElement('div')
    colU.classList.add('col-lg-12')
    rowDiv3.append(colU)

    var input = document.createElement('input')
    input.id = 'staticCheckedBy'
    input.classList.add('form-control')
    input.setAttribute('type','text')
    input.setAttribute('style', 'background-color: white;') 
    input.disabled = true
    colU.appendChild(input)

    col3.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Camera'
    col3.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>Filter your static detections by camera.</i>'
    col3.appendChild(div)

    var select = document.createElement('select');
    select.id = 'sgCamSelect';
    select.classList.add('form-control');
    col3.appendChild(select);

    document.getElementById('sgCamSelect').addEventListener('change', ()=>{
        if (finishedDisplayingStatic) {
            staticgroups = []
            staticgroupIndex = 0
            staticImgIndex = 0
            staticgroupIDs = []
            staticgroupReadAheadIndex = 0
            staticgroup_ids = []
            finishedDisplayingStatic = true
            staticgroupDetections = {}
            og_staticgroup_status = {}
            staticgroup_page = {}
            getStaticGroups()
        }
    });

    sgCamSelect = document.getElementById('sgCamSelect')
    clearSelect(sgCamSelect)

    optionTexts = ['All']
    optionValues = ['0']
    for (var i=0; i<staticCameras.length; i++) {
        optionTexts.push(staticCameras[i].name)
        optionValues.push(staticCameras[i].id)
    }

    fillSelect(sgCamSelect, optionTexts, optionValues)

    col3.appendChild(document.createElement('br'))

    h5 = document.createElement('h5')
    h5.setAttribute('style','margin-bottom: 2px')
    h5.innerHTML = 'Static'
    col3.appendChild(h5)

    div = document.createElement('div')
    div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
    div.innerHTML = '<i>The status of the current set of detections.</i>'
    col3.appendChild(div)

    var rowDiv = document.createElement('div');
    rowDiv.classList.add('row');
    col3.appendChild(rowDiv);

    var colDiv2 = document.createElement('div');
    colDiv2.classList.add('col-lg-12')
    rowDiv.appendChild(colDiv2);

    var toggleDiv = document.createElement('div');
    toggleDiv.classList.add('justify-content-left');
    toggleDiv.style.verticalAlign = 'middle';
    colDiv2.appendChild(toggleDiv);

    var toggle = document.createElement('label');
    toggle.classList.add('switch');
    toggleDiv.appendChild(toggle);

    var checkbox = document.createElement('input');
    checkbox.setAttribute("type", "checkbox");
    checkbox.id = 'staticToggle';
    toggle.appendChild(checkbox);

    var slider = document.createElement('span');
    slider.classList.add('slider');
    slider.classList.add('round');
    toggle.appendChild(slider);

    document.getElementById('staticToggle').addEventListener('change', ()=>{
        if (document.getElementById('staticToggle').checked) {
            staticgroups[staticgroupIndex].staticgroup_status = 'accepted'
        }
        else{
            staticgroups[staticgroupIndex].staticgroup_status = 'rejected'
        }
    });

    var div = document.createElement('div')
    div.innerHTML = '* Hold Spacebar to hide detections.'
    div.setAttribute('style','font-size: 64%; margin-top: 5px')
    col3.appendChild(div)
    
    var row = document.createElement('div')
    row.classList.add('row')
    editStaticDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-1')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-10')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-1')
    row.appendChild(col3)

    var rowDiv = document.createElement('div');
    rowDiv.classList.add('row');
    col2.appendChild(rowDiv);

    var colDiv = document.createElement('div');
    colDiv.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center');
    rowDiv.appendChild(colDiv);

    var clusterDiv = document.createElement('div');
    clusterDiv.id = 'clusterPosition_static';
    colDiv.appendChild(clusterDiv);

    var paginationUl = document.createElement('ul');
    paginationUl.classList.add('pagination');
    paginationUl.id = 'paginationCircles_static';
    paginationUl.style.margin = '10px';
    clusterDiv.appendChild(paginationUl);

    var row = document.createElement('div')
    row.classList.add('row')
    col2.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    var col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnPrevGroup'
    button.innerHTML = '<span style="font-size:100%">&#x276e;&#x276e;</span> Previous Group'
    button.disabled = true
    col1.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnPrevImageStatic'
    button.innerHTML = '<span style="font-size:100%">&#x276e;</span> Previous Image'
    button.disabled = true
    col2.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnNextImageStatic'
    button.innerHTML = 'Next Image <span style="font-size:100%">&#x276f;</span>'
    button.disabled = true
    col3.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnNextGroup'
    button.innerHTML = 'Next Group <span style="font-size:100%">&#x276f;&#x276f;</span>'
    button.disabled = true
    col4.appendChild(button)

    document.getElementById('btnPrevGroup').addEventListener('click', ()=>{
        if (staticgroupIndex>0 && finishedDisplayingStatic) {
            staticgroupIndex -= 1
            staticImgIndex = 0
            updateStaticMap()
        }
    });

    document.getElementById('btnPrevImageStatic').addEventListener('click', ()=>{
        if (staticImgIndex>0 && finishedDisplayingStatic) {
            staticImgIndex -= 1
            updateStaticMap()
        }
    });

    document.getElementById('btnNextImageStatic').addEventListener('click', ()=>{
        if (staticImgIndex<staticgroups[staticgroupIndex].images.length-1 && finishedDisplayingStatic) {
            staticImgIndex += 1
            updateStaticMap()
        }
        else if (staticImgIndex == staticgroups[staticgroupIndex].images.length-1 && staticgroup_page[staticgroups[staticgroupIndex].id].next_page != null && finishedDisplayingStatic) {
            getNextStaticDetections(staticgroup_page[staticgroups[staticgroupIndex].id].next_page)
        }
    });

    document.getElementById('btnNextGroup').addEventListener('click', ()=>{
        if (staticgroupIndex<staticgroups.length-1 && finishedDisplayingStatic) {
            staticgroupIndex += 1
            staticImgIndex = 0
            updateStaticMap()
            if (staticgroupIndex > staticgroups.length - 3){
                getStaticDetections()
            }
        }
    });

    document.getElementById('btnPrevGroup').hidden = true
    document.getElementById('btnPrevImageStatic').hidden = true
    document.getElementById('btnNextImageStatic').hidden = true
    document.getElementById('btnNextGroup').hidden = true

    getStaticGroups()

}

function getStaticGroups(){
    /* Gets the static groups for the current survey */

    if (document.getElementById('sgCamSelect')) {
        selectedCamera = document.getElementById('sgCamSelect').value
        if (selectedCamera == ''){
            selectedCamera = '0'
        }
    }
    else{
        selectedCamera = '0'
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            staticgroupIDs = reply
            // console.log(staticgroupIDs)

            staticgroup_page = {}
            for (var i=0; i<staticgroupIDs.length; i++) {
                staticgroup_page[staticgroupIDs[i]] = {'page':1, 'next_page':null}
            }

            if (staticgroupIDs.length>0) {
                document.getElementById('btnPrevGroup').hidden = false
                document.getElementById('btnPrevImageStatic').hidden = false
                document.getElementById('btnNextImageStatic').hidden = false
                document.getElementById('btnNextGroup').hidden = false
                
                for (var i=0; i<3; i++) {
                    getStaticDetections()
                }  
            }
            else{
                editStaticDiv = document.getElementById('editStaticDiv')
                while(editStaticDiv.firstChild){
                    editStaticDiv.removeChild(editStaticDiv.firstChild);
                }

                var row = document.createElement('div')
                row.classList.add('row')
                editStaticDiv.appendChild(row)

                var col1 = document.createElement('div')
                col1.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center')
                row.appendChild(col1)

                var h6 = document.createElement('h6')
                h6.innerHTML = 'You have no static detections to edit.'
                col1.appendChild(h6)
            }
        }
    }
    xhttp.open("GET", '/getStaticGroupIDs/'+selectedSurvey + '?edit=true&cameragroup_id=' + selectedCamera);
    xhttp.send();
}

function getStaticDetections() {
    /* Gets the static detections for the current survey */

    var selectedCamera = '0'
    if (document.getElementById('sgCamSelect')) {
        selectedCamera = document.getElementById('sgCamSelect').value
        if (selectedCamera == ''){
            selectedCamera = '0'
        }
    }

    if (staticgroupReadAheadIndex < staticgroupIDs.length) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                new_groups = reply.static_detections
                new_detections = reply.staticgroup_detections
                // console.log(new_groups)

                if (new_groups.length > 0) {
                    staticgroup_page[new_groups[0].id].next_page = reply.next_page
                }

                for (var i=0; i<new_groups.length; i++) {
                    if (staticgroup_ids.indexOf(new_groups[i].id) == -1) {
                        staticgroup_ids.push(new_groups[i].id)
                        staticgroups.push(new_groups[i])
                        og_staticgroup_status[new_groups[i].id] = new_groups[i].staticgroup_status
                    }
                }

                keys = Object.keys(new_detections)
                for (var i=0; i<keys.length; i++) {
                    staticgroupDetections[keys[i]] = new_detections[keys[i]]
                }

                if (staticgroups.length - 1 == staticgroupIndex) {
                    updateStaticMap()
                }
                updateButtons()
                preloadImages()
            }
        }
        xhttp.open("GET", '/getStaticDetections/' + selectedSurvey + '/' + 0 + '?staticgroup_id=' + staticgroupIDs[staticgroupReadAheadIndex++] + '&edit=true&cameragroup_id=' + selectedCamera);
        xhttp.send();
    }

}

function getNextStaticDetections(next_page) {
    /* Gets the next page of static detections */

    if (next_page == null) {
        updateStaticMap()
        updateButtons()
    }else{
        var selectedCamera = '0'
        if (document.getElementById('sgCamSelect')) {
            selectedCamera = document.getElementById('sgCamSelect').value
            if (selectedCamera == ''){
                selectedCamera = '0'
            }
        }

        var staticgroup_id = staticgroups[staticgroupIndex].id
        staticgroup_page[staticgroup_id].page = next_page

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                new_groups = reply.static_detections
                new_detections = reply.staticgroup_detections

                if (new_groups.length > 0) {
                    staticgroup_page[new_groups[0].id].next_page = reply.next_page
                }

                for (var i=0; i<new_groups.length; i++) {
                    sg_index = staticgroups.findIndex(x => x.id == new_groups[i].id)
                    if (sg_index != -1) {
                        new_img_index = staticgroups[sg_index].images.length
                        staticgroups[sg_index].images.push(...new_groups[i].images)
                        if (new_groups[i].images.length > 0) {
                            staticImgIndex = new_img_index
                        }
                    }
                }

                keys = Object.keys(new_detections)
                for (var i=0; i<keys.length; i++) {
                    staticgroupDetections[keys[i]].push(...new_detections[keys[i]])
                }

                updateStaticMap()
                updateButtons()
                preloadImages()
            
            }
        }
        xhttp.open("GET", '/getStaticDetections/' + selectedSurvey + '/' + 0 + '?staticgroup_id=' + staticgroup_id + '&edit=true&cameragroup_id=' + selectedCamera + '&page=' + next_page);
        xhttp.send();
    }
}

function getStaticCameras(){
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            staticCameras = reply
            // console.log(staticCameras)

            buildViewStatic()

        }

    }
    xhttp.open("GET", '/getStaticCameragroups/'+selectedSurvey);
    xhttp.send();
}

function updateStaticMap() {
    /** Updates the static map after an action has been performed. */

    finishedDisplayingStatic = false
    fullRes = false
    addedDetectionsStatic = false

    document.getElementById('mapTitle_static').innerHTML = staticgroups[staticgroupIndex].images[staticImgIndex].url.split('/').slice(1).join('/')
    if (staticgroups[staticgroupIndex].user){
        document.getElementById('staticCheckedBy').value = staticgroups[staticgroupIndex].user
    }
    else{
        document.getElementById('staticCheckedBy').value =  'None'
    }
    
    if (staticgroups[staticgroupIndex].staticgroup_status == 'rejected') {
        document.getElementById('staticToggle').checked = false
    }
    else if (staticgroups[staticgroupIndex].staticgroup_status == 'accepted') {
        document.getElementById('staticToggle').checked = true
    }
    else if (staticgroups[staticgroupIndex].staticgroup_status == 'unknown') {
        document.getElementById('staticToggle').checked = true
        staticgroups[staticgroupIndex].staticgroup_status = 'accepted'
    }

    if (mapStatic != null) {
        activeImageStatic.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(staticgroups[staticgroupIndex].images[staticImgIndex].url))
    }
    else{
        prepMapStatic(staticgroups[staticgroupIndex].images[staticImgIndex])
    }

    updateButtons()
    preloadImages(true)

}


function updateCamDiv() {
    /** Updates the Camera Identifier Div based on the option selected */

    if (document.getElementById('camSameAsSiteES') != null) {
        var camSameAsSite = document.getElementById('camSameAsSiteES').checked
        var multipleCam = document.getElementById('multipleCamES').checked
        var multiCamDiv = document.getElementById('multiCamDivES')
        var camRegExp = document.getElementById('camRegExpES').checked 
        var camLvlFolder = document.getElementById('camLvlFolderES').checked
        var camIdDiv = document.getElementById('addImagesCamDiv')
        var camFolderDiv = document.getElementById('camFolderDivES')
        var camOptionDesc = document.getElementById('addImagesCamDesc')
        var newSurveyCamBuilder = document.getElementById('addImagesCamBuilder')
        var camAdvancedCheckbox = document.getElementById('addImagesCamCheckbox')
        var newSurveyCamCode = document.getElementById('addImagesCamCode')

    } else {
        var camSameAsSite = document.getElementById('camSameAsSite').checked
        var multipleCam = document.getElementById('multipleCam').checked
        var multiCamDiv = document.getElementById('multiCamDiv')
        var camRegExp = document.getElementById('camRegExp').checked 
        var camLvlFolder = document.getElementById('camLvlFolder').checked
        var camIdDiv = document.getElementById('camIdDiv')
        var camFolderDiv = document.getElementById('camFolderDiv')
        var camOptionDesc = document.getElementById('camOptionDesc') 
        var newSurveyCamBuilder = document.getElementById('newSurveyCamBuilder')
        var camAdvancedCheckbox = document.getElementById('camAdvancedCheckbox')
        var newSurveyCamCode = document.getElementById('newSurveyCamCode')
    }


    if (camSameAsSite){
        multiCamDiv.hidden = true
        camFolderDiv.hidden = true
        camIdDiv.hidden = true
        camOptionDesc.innerHTML = ''

        while(camFolderDiv.firstChild){
            camFolderDiv.removeChild(camFolderDiv.firstChild);
        }

        while(newSurveyCamBuilder.firstChild){
            newSurveyCamBuilder.removeChild(newSurveyCamBuilder.firstChild);
        }
        camAdvancedCheckbox.checked = false
        newSurveyCamCode.value = ''
        if (document.getElementById('camRegExpES') != null) {
            document.getElementById('camRegExpES').checked = false
            document.getElementById('camLvlFolderES').checked = true
        } else {
            document.getElementById('camRegExp').checked = false
            document.getElementById('camLvlFolder').checked = true
        }
        checkTrapgroupCode()
    } else if (multipleCam) {
        multiCamDiv.hidden = false 
        if (camRegExp){
            camOptionDesc.innerHTML = '<i>The identifier used to designate a camera in your folder structure. Eg. "Camera" if your cameras are stored in folders named "Camera1", "Camera2" etc. Becomes a <a href="https://www.w3schools.com/python/python_regex.asp">regular expression</a> search query if the advanced option is selected.</i>'
            camFolderDiv.hidden = true
            camIdDiv.hidden = false

            while(newSurveyCamBuilder.firstChild){
                newSurveyCamBuilder.removeChild(newSurveyCamBuilder.firstChild);
            }
            camAdvancedCheckbox.checked = false
            newSurveyCamCode.value = ''

            checkTrapgroupCode()
        }
        else if (camLvlFolder){
            camOptionDesc.innerHTML = '<i>Select the folder level from the path below that corresponds to the cameras in your folder structure. For example, in "Survey/Site1/Camera1", you should select the "Camera1" folder.</i>'
            camIdDiv.hidden = true
            camFolderDiv.hidden = false

            while(camFolderDiv.firstChild){
                camFolderDiv.removeChild(camFolderDiv.firstChild);
            }

            updateCamFolderSelect()
            checkTrapgroupCode()
        }
    }

}

function updateSiteDiv() {
    /** Updates the Site Identifier Div based on the option selected */

    if (document.getElementById('siteFolderN_ES') != null) {
        var siteFolderN = document.getElementById('siteFolderN_ES').checked 
        var siteIdentifier = document.getElementById('siteIdentifierES').checked
        var siteIdDiv = document.getElementById('siteIdDivES')
        var siteFolderDiv = document.getElementById('siteFolderDivES')
        var siteOptionDesc = document.getElementById('addImagesSiteDesc')
    }
    else{
        var siteFolderN = document.getElementById('siteFolderN').checked 
        var siteIdentifier = document.getElementById('siteIdentifier').checked
        var siteIdDiv = document.getElementById('siteIdDiv')
        var siteFolderDiv = document.getElementById('siteFolderDiv')
        var siteOptionDesc = document.getElementById('siteOptionDesc') 
    }

    if (siteIdentifier) {
        siteOptionDesc.innerHTML = '<i>The identifier used to designate a site in your folder structure. Eg. "Site" if your sites are stored in folders named "Site1", "Site2" etc. Becomes a <a href="https://www.w3schools.com/python/python_regex.asp">regular expression</a> search query if the advanced option is selected.</i>'
        siteFolderDiv.hidden = true
        siteIdDiv.hidden = false

        if (document.getElementById('addImagesTgBuilder') != null) {
            var surveyTgBuilder = document.getElementById('addImagesTgBuilder')
            var surveyCheckbox = document.getElementById('addImagesCheckbox')
            var surveyTGCode = document.getElementById('addImagesTGCode')
        }
        else{
            var surveyTgBuilder = document.getElementById('newSurveyTgBuilder')
            var surveyCheckbox = document.getElementById('newSurveyCheckbox')
            var surveyTGCode = document.getElementById('newSurveyTGCode')
        }

        while(surveyTgBuilder.firstChild){
            surveyTgBuilder.removeChild(surveyTgBuilder.firstChild);
        }
        surveyCheckbox.checked = false
        surveyTGCode.value = ''

        checkTrapgroupCode()
    }
    else if (siteFolderN) {
        siteOptionDesc.innerHTML = '<i>Select the folder level from the path below that corresponds to the sites/stations in your folder structure. For example, in "Survey/Site1/Camera1", you should select the "Site1" folder.</i>'
        siteIdDiv.hidden = true
        siteFolderDiv.hidden = false
        updateSiteFolderSelect()
        checkTrapgroupCode()
    }

}

$("#camAdvancedCheckbox").change( function() {
    /** Listens for and warns the user when they select the adanced trapgroup code option. */

    var camAdvancedCheckbox = document.getElementById('camAdvancedCheckbox')
    if (camAdvancedCheckbox.checked && document.getElementById('camRegExp').checked) {
        document.getElementById('newSurveyErrors').innerHTML = 'Note that you are now required to enter a regular expression for your camera identifier. It will be used to identify your cameras based on your folder structure.'
        buildCamBuilderRow()
    } else {
        document.getElementById('newSurveyErrors').innerHTML = ''

        // Clear TG Builder
        var newSurveyCamBuilder = document.getElementById('newSurveyCamBuilder')
        while(newSurveyCamBuilder.firstChild){
            newSurveyCamBuilder.removeChild(newSurveyCamBuilder.firstChild);
        }      
    }
})

function updateCamCode() {
    /** Extracts the info from the trapgroup code builder and populates the trapgroup code accordingly. */

    camCode = ''
    charSelectCams = document.querySelectorAll('[id^=charSelectCam-]')
    for (let i=0;i<charSelectCams.length;i++) {
        IDNum = charSelectCams[i].id.split("-")[charSelectCams[i].id.split("-").length-1]
        
        selection = charSelectCams[i].options[charSelectCams[i].selectedIndex].text
        if (selection=='Any Digit') {
            camCode += '[0-9]'
        } else if (selection=='Any Letter (Upper)') {
            camCode += '[A-Z]'
        } else if (selection=='Any Letter (Lower)') {
            camCode += '[a-z]'
        } else if (selection=='Any Letter (Any)') {
            camCode += '[A-Za-z]'
        } else if (selection=='Any Character') {
            camCode += '.'
        } else if (selection=='Custom Set') {
            customCharactersCam = document.getElementById('customCharactersCam-'+IDNum).value
            CustomCharSelectCam = document.getElementById('CustomCharSelectCam-'+IDNum)
            selection = CustomCharSelectCam.options[CustomCharSelectCam.selectedIndex].text
            if (selection=='Exactly') {
                camCode += customCharactersCam
            } else if (selection=='Or') {
                camCode += '['+customCharactersCam+']'
            }
        }
        
        occurrenceSelectCam = document.getElementById('occurrenceSelectCam-'+IDNum)
        selection = occurrenceSelectCam.options[occurrenceSelectCam.selectedIndex].text
        if (selection=='Once') {
            //pass
        } else if (selection=='Zero or More') {
            camCode += '*'
        } else if (selection=='Zero or One') {
            camCode += '?'
        } else if (selection=='One or More') {
            camCode += '+'
        } else if (selection=='Custom Count') {
            customOccurrenceCam = document.getElementById('customOccurrenceCam-'+IDNum).value
            camCode += '{'+customOccurrenceCam.toString()+'}'
        }
    }

    if (document.getElementById('addImagesCamCode') != null) {
        document.getElementById('addImagesCamCode').value = camCode
    }
    else{
        document.getElementById('newSurveyCamCode').value = camCode
    }
    

    if (camCode.endsWith('.*') || camCode.endsWith('.+') || camCode.endsWith('.*[0-9]+') || camCode.endsWith('.+[0-9]+' )) {
        error_message = 'Your site identifier is invalid. Please try again or contact us for assistance.'
        if (document.getElementById('addFilesErrors')!=null) {
            document.getElementById('addFilesErrors').innerHTML = error_message
        }
        else {
            document.getElementById('newSurveyErrors').innerHTML = error_message
        }
    } else {
        checkTrapgroupCode()
    }
    
}

function buildCamBuilderRow() {
    /** Builds a row for the trapgroup code builder. */

    IDNum = getIdNumforNext('charSelectCam')

    if (IDNum==0) {
        // Initialising - build headings
        if (document.getElementById('addImagesCamBuilder') == null) {
            camBuilder = document.getElementById('newSurveyCamBuilder')
        }
        else{
            camBuilder = document.getElementById('addImagesCamBuilder')
        }

        while(camBuilder.firstChild){
            camBuilder.removeChild(camBuilder.firstChild);
        }

        camBuilder.append(document.createElement('br'))

        camBuilderRows = document.createElement('div')
        camBuilderRows.setAttribute('id','camBuilderRows')
        camBuilder.append(camBuilderRows)

        // Add add-row button
        camBuilderBtnRow = document.createElement('div')
        camBuilderBtnRow.classList.add('row')
        camBuilder.append(camBuilderBtnRow)

        col1 = document.createElement('div')
        col1.classList.add('col-lg-11')
        camBuilderBtnRow.appendChild(col1)

        col2 = document.createElement('div')
        col2.classList.add('col-lg-1')
        camBuilderBtnRow.appendChild(col2)  
        
        btnAdd = document.createElement('button');
        btnAdd.classList.add('btn');
        btnAdd.classList.add('btn-primary');
        btnAdd.innerHTML = '+';
        col2.appendChild(btnAdd)
        
        btnAdd.addEventListener('click', (evt)=>{
            buildCamBuilderRow()
        });

        // Heading Row
        row = document.createElement('div')
        row.classList.add('row')
        camBuilderRows.append(row)

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
        camBuilderRows = document.getElementById('camBuilderRows')
    }

    row = document.createElement('div')
    row.classList.add('row')
    camBuilderRows.append(row)

    // Character column
    col1 = document.createElement('div')
    col1.classList.add('col-lg-2')
    row.appendChild(col1)

    selectID = 'charSelectCam-'+IDNum
    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id',selectID)
    col1.appendChild(select)

    $("#"+selectID).change( function(wrapIDNum) {
        return function() {
            select = document.getElementById('charSelectCam-'+wrapIDNum)
            selection = select.options[select.selectedIndex].text
            if (selection == 'Custom Set') {
                //Build custom row
                col2 = document.getElementById('camBuilderCol2-'+wrapIDNum)

                input = document.createElement('input')
                input.setAttribute('type','text')
                input.classList.add('form-control')
                input.required = true
                input.setAttribute('id','customCharactersCam-'+wrapIDNum)
                col2.appendChild(input)

                $("#customCharactersCam-"+wrapIDNum).change( function() {
                    updateCamCode()
                })

                col3 = document.getElementById('camBuilderCol3-'+wrapIDNum)
                
                select = document.createElement('select')
                select.classList.add('form-control')
                select.setAttribute('id','CustomCharSelectCam-'+wrapIDNum)
                col3.appendChild(select)

                $("#CustomCharSelectCam-"+wrapIDNum).change( function() {
                    updateCamCode()
                })

                fillSelect(select, ['Exactly','Or'], [1,2])

            } else {
                // Remove any custom row
                div = document.getElementById('camBuilderCol2-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }

                div = document.getElementById('camBuilderCol3-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }
            }
            updateCamCode()
        }
    }(IDNum));

    fillSelect(select, ['Any Digit','Any Letter (Upper)','Any Letter (Lower)','Any Letter (Any)','Any Character','Custom Set'], [1,2,3,4,5,7])

    // Custom Character Column
    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    col2.setAttribute('id','camBuilderCol2-'+IDNum)
    row.appendChild(col2)

    // Custom Character Operation Column
    col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.setAttribute('id','camBuilderCol3-'+IDNum)
    row.appendChild(col3)

    // Occurrence Column
    col4 = document.createElement('div')
    col4.classList.add('col-lg-2')
    row.appendChild(col4)

    selectID = 'occurrenceSelectCam-'+IDNum
    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id',selectID)
    col4.appendChild(select)

    $("#"+selectID).change( function(wrapIDNum) {
        return function() {
            select = document.getElementById('occurrenceSelectCam-'+wrapIDNum)
            selection = select.options[select.selectedIndex].text
            if (selection == 'Custom Count') {
                //Build custom row
                col5 = document.getElementById('camBuilderCol5-'+wrapIDNum)

                input = document.createElement('input')
                input.setAttribute('type','text')
                input.classList.add('form-control')
                input.required = true
                input.setAttribute('id','customOccurrenceCam-'+wrapIDNum)
                col5.appendChild(input)

                $("#customOccurrenceCam-"+wrapIDNum).change( function() {
                    updateCamCode()
                })
            } else {
                // Remove any custom row
                div = document.getElementById('camBuilderCol5-'+wrapIDNum)
                while(div.firstChild){
                    div.removeChild(div.firstChild);
                }
            }
            updateCamCode()
        }
    }(IDNum));

    fillSelect(select, ['Once','Zero or More','Zero or One','One or More','Custom Count'], [1,2,3,4,5])

    // Custom Occurrence Column
    col5 = document.createElement('div')
    col5.classList.add('col-lg-2')
    col5.setAttribute('id','camBuilderCol5-'+IDNum)
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
        updateCamCode()
    });

    if (IDNum!=0) {
        updateCamCode()
    }
}

function openStructure() {
    /** Opens the structure tab in edit survey. */

    // var editSurveyStructureDiv = document.getElementById('editSurveyStructureDiv')
    // while(editSurveyStructureDiv.firstChild){
    //     editSurveyStructureDiv.removeChild(editSurveyStructureDiv.firstChild);
    // }

    var editSurveyStructureDiv = document.getElementById('editSurveyStructureDiv')
    if (editSurveyStructureDiv .firstChild==null) {

        // Heading
        var headingDiv = document.createElement('div')
        editSurveyStructureDiv.appendChild(headingDiv)

        var h5 = document.createElement('h5')
        h5.innerHTML = 'Survey Structure'
        h5.setAttribute('style','margin-bottom: 2px')
        headingDiv.appendChild(h5)

        var div = document.createElement('div')
        div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        div.innerHTML = '<i> Here you can view the structure of your survey by site, camera and folder and see how many images, videos and frames are in each folder. Please note that duplicate images or videos (based on hashes) are not stored in the database therefore the counts may not match the number of files in your dataset. </i>'
        headingDiv.appendChild(div)

        headingDiv.appendChild(document.createElement('br'))
        
        // Structure
        var div = document.createElement('div')
        div.id = 'structureDiv'
        editSurveyStructureDiv.appendChild(div)

        // Buttons
        var div = document.createElement('div')
        div.setAttribute('id','structureButtonsDiv')
        editSurveyStructureDiv.appendChild(div)

        var row = document.createElement('div')
        row.classList.add('row')
        editSurveyStructureDiv.appendChild(row)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-2')
        row.appendChild(col1)

        var btnPrevStructure = document.createElement('button')
        btnPrevStructure.setAttribute("class","btn btn-primary btn-block")
        btnPrevStructure.setAttribute("id","btnPrevSurveyStructure")
        btnPrevStructure.innerHTML = 'Previous'
        col1.appendChild(btnPrevStructure)

        var col2 = document.createElement('div')
        col2.classList.add('col-lg-8')
        row.appendChild(col2)

        var col5 = document.createElement('div')
        col5.classList.add('col-lg-2')
        row.appendChild(col5)

        var btnNextStructure = document.createElement('button')
        btnNextStructure.setAttribute("class","btn btn-primary btn-block")
        btnNextStructure.setAttribute("id","btnNextSurveyStructure")
        btnNextStructure.innerHTML = 'Next'
        col5.appendChild(btnNextStructure)

        btnNextStructure.addEventListener('click', ()=>{
            buildStructure(next_structure_url)
        });
        
        btnPrevStructure.addEventListener('click', ()=>{
            buildStructure(prev_structure_url)
        });
        
        buildStructure()

    }
}


function buildStructure(structure_url='/getSurveyStructure') {
    if (structure_url=='/getSurveyStructure') {
        structure_url += '?survey_id='+selectedSurvey
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            if ((reply.survey==selectedSurvey)&&(modalEditSurvey.is(':visible'))) {
                if (reply.next_url==null) {
                    document.getElementById('btnNextSurveyStructure').hidden = true
                } else {
                    document.getElementById('btnNextSurveyStructure').hidden = false
                    next_structure_url = reply.next_url
                }

                if (reply.prev_url==null) {
                    document.getElementById('btnPrevSurveyStructure').hidden = true
                } else {
                    document.getElementById('btnPrevSurveyStructure').hidden = false
                    prev_structure_url = reply.prev_url
                }
            }

            survey_structure = reply.structure

            var structureDiv = document.getElementById('structureDiv')
            while(structureDiv.firstChild){
                structureDiv.removeChild(structureDiv.firstChild);
            }

            var table = document.createElement('table')
            table.classList.add('table');
            table.classList.add('table-striped');
            table.classList.add('table-bordered');
            // table.classList.add('table-hover');
            table.style.borderCollapse = 'collapse'
            table.style.border = '1px solid rgba(0,0,0,0)'
            structureDiv.appendChild(table)

            var thead = document.createElement('thead')
            table.appendChild(thead)

            var tr = document.createElement('tr')
            thead.appendChild(tr)

            var th = document.createElement('th')
            th.innerHTML = 'Site'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Camera'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Folder'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Image Count'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Video Count'
            tr.appendChild(th)

            var th = document.createElement('th')
            th.innerHTML = 'Frame Count'
            tr.appendChild(th)

            var tbody = document.createElement('tbody');
            table.appendChild(tbody);

            for (let i = 0; i < survey_structure.length; i++) {
                for (let j = 0; j < survey_structure[i].cameras.length; j++) {
                    for (let k = 0; k < survey_structure[i].cameras[j].folders.length; k++) {
                        var tr = document.createElement('tr');
                        tbody.appendChild(tr);
            
                        if (j === 0 && k === 0) {
                            var tdSite = document.createElement('td');
                            tdSite.classList.add('site');
                            tdSite.classList.add('site-'+survey_structure[i].id);
                            tdSite.setAttribute('rowspan', survey_structure[i].nr_folders);
                            tdSite.setAttribute('style', 'text-align:left; vertical-align: middle;');
                            tdSite.innerHTML = survey_structure[i].site;
                            tr.appendChild(tdSite);

                            tdSite.addEventListener('mouseenter', function () {
                                highlightCells(this);
                            });
                    
                            tdSite.addEventListener('mouseleave', function () {
                                clearHighlights();
                            });
                        }
            
                        if (k === 0) {
                            var tdCamera = document.createElement('td');
                            tdCamera.classList.add('camera');
                            tdCamera.classList.add('camera-'+survey_structure[i].cameras[j].id);
                            tdCamera.classList.add('site-'+survey_structure[i].id);
                            tdCamera.setAttribute('rowspan', survey_structure[i].cameras[j].folders.length);
                            tdCamera.setAttribute('style', 'text-align:left; vertical-align: middle;');
                            tdCamera.innerHTML = survey_structure[i].cameras[j].name;
                            tr.appendChild(tdCamera);

                            tdCamera.addEventListener('mouseenter', function () {
                                highlightCells(this);
                            });

                            tdCamera.addEventListener('mouseleave', function () {
                                clearHighlights();
                            });
                        }
            
                        var tdFolder = document.createElement('td');
                        tdFolder.classList.add('folder');
                        tdFolder.classList.add('camera-'+survey_structure[i].cameras[j].id);
                        tdFolder.classList.add('site-'+survey_structure[i].id);
                        tdFolder.setAttribute('style', 'text-align:left');
                        tdFolder.innerHTML = survey_structure[i].cameras[j].folders[k].path.split('/').slice(1).join('/');
                        tr.appendChild(tdFolder);

                        tdFolder.addEventListener('mouseenter', function () {
                            highlightCells(this);
                        });

                        tdFolder.addEventListener('mouseleave', function () {
                            clearHighlights();
                        });

                        var tdImageCount = document.createElement('td');
                        tdImageCount.classList.add('folder');
                        tdImageCount.classList.add('camera-'+survey_structure[i].cameras[j].id);
                        tdImageCount.classList.add('site-'+survey_structure[i].id);
                        tdImageCount.innerHTML = survey_structure[i].cameras[j].folders[k].image_count;
                        tr.appendChild(tdImageCount);

                        tdImageCount.addEventListener('mouseenter', function () {
                            highlightCells(this);
                        });

                        tdImageCount.addEventListener('mouseleave', function () {
                            clearHighlights();
                        });

                        var tdVideoCount = document.createElement('td');
                        tdVideoCount.classList.add('folder');
                        tdVideoCount.classList.add('camera-'+survey_structure[i].cameras[j].id);
                        tdVideoCount.classList.add('site-'+survey_structure[i].id);
                        tdVideoCount.innerHTML = survey_structure[i].cameras[j].folders[k].video_count;
                        tr.appendChild(tdVideoCount);

                        tdVideoCount.addEventListener('mouseenter', function () {
                            highlightCells(this);
                        });

                        tdVideoCount.addEventListener('mouseleave', function () {
                            clearHighlights();
                        });

                        var tdFrameCount = document.createElement('td');
                        tdFrameCount.classList.add('folder');
                        tdFrameCount.classList.add('camera-'+survey_structure[i].cameras[j].id);
                        tdFrameCount.classList.add('site-'+survey_structure[i].id);
                        tdFrameCount.innerHTML = survey_structure[i].cameras[j].folders[k].frame_count;
                        tr.appendChild(tdFrameCount);

                        tdFrameCount.addEventListener('mouseenter', function () {
                            highlightCells(this);
                        });

                        tdFrameCount.addEventListener('mouseleave', function () {
                            clearHighlights();
                        });

                    }
                }
            }

        }
    }
    xhttp.open("GET", structure_url);
    xhttp.send();

}

function updateSurveyStructure(){
    /** Updates the survey structure display. */

    if (document.getElementById('addImagesTGCode')!=null) {
        var infoDiv = document.getElementById('addImagesStructureDiv')
        var camSameAsSite = document.getElementById('camSameAsSiteES').checked
        var btnPrevStructure = document.getElementById('btnPrevStructureES')
        var btnNextStructure = document.getElementById('btnNextStructureES')
    } else {
        var infoDiv = document.getElementById('newSurveyStructureDiv')
        var camSameAsSite = document.getElementById('camSameAsSite').checked
        var btnPrevStructure = document.getElementById('btnPrevStructure')
        var btnNextStructure = document.getElementById('btnNextStructure')
    }
    
    btnPrevStructure.hidden = true
    btnNextStructure.hidden = true

    var structurePages = Object.keys(globalSurveyStructure)

    if (structurePages.length > 0) {
        infoDiv.innerHTML = ''
        infoDiv.innerHTML = 'Structure found: ' + globalStructureCounts['sites'] + ' sites, ' + globalStructureCounts['cameras'] + ' cameras. <br>'

        if (camSameAsSite) {
            for (let i = 0; i < structurePages.length; i++) {
                var tags = Object.keys(globalSurveyStructure[structurePages[i]])
                for (let j = 0; j < tags.length; j++) {
                    infoDiv.innerHTML += tags[j] + ' , '
                }
            }
            infoDiv.innerHTML = infoDiv.innerHTML.slice(0, -3) + '<br>'
        }
        else{
            var tags = Object.keys(globalSurveyStructure[structure_page])
            for (let i=0;i<tags.length;i++) {
                infoDiv.innerHTML += tags[i] + ' : '
                for (let n=0;n<globalSurveyStructure[structure_page][tags[i]].length;n++) {
                    infoDiv.innerHTML += globalSurveyStructure[structure_page][tags[i]][n] + ' , '
                }
                infoDiv.innerHTML = infoDiv.innerHTML.slice(0, -3) + '<br>'
            }
    
            if (structure_page != structurePages[0]) {
                btnPrevStructure.hidden = false
            }
            if (structure_page != structurePages[structurePages.length-1]) {
                btnNextStructure.hidden = false
            }
            
        }
    }
    else{
        if (infoDiv.innerHTML != 'Checking...') {
            infoDiv.innerHTML = 'Invalid structure. Please check your site and camera identifiers.'
        }
    }
}

function prevStructure(){
    /** Moves to the previous structure page. */
    var structurePages = Object.keys(globalSurveyStructure)
    var structureIndex = structurePages.indexOf(structure_page.toString())

    if (structureIndex > 0) {
        structure_page = structurePages[structureIndex-1]
    }
    else{
        structure_page = structurePages[0]
    }

    updateSurveyStructure()
}

function nextStructure(){
    /** Moves to the next structure page. */
    var structurePages = Object.keys(globalSurveyStructure)
    var structureIndex = structurePages.indexOf(structure_page.toString())

    if (structureIndex < structurePages.length-1) {
        structure_page = structurePages[structureIndex+1]
    }
    else{
        structure_page = structurePages[structurePages.length-1]
    }

    updateSurveyStructure()
}


function highlightCells(cell) {
    /** Highlights the cells in the structure table. */
    clearHighlights();

    cellsToHighlight = [cell];

    cellClass = cell.classList[0];
    

    if(cellClass == 'site'){
        cellSiteClass = cell.classList[1];
        //Find all cells with site class
        var allCells = document.querySelectorAll('.' + cellSiteClass);
        for (let i = 0; i < allCells.length; i++) {
            cellsToHighlight.push(allCells[i]);
        }
    }
    else if (cellClass == 'camera'){
        //Find all cells with site and camera class
        cellCameraClass = cell.classList[1];
        cellSiteClass = cell.classList[2];

        var allCells = document.querySelectorAll('.' + cellCameraClass + '.' + cellSiteClass);
        for (let i = 0; i < allCells.length; i++) {
            cellsToHighlight.push(allCells[i]);
        }

        var siteCell = document.querySelector('.' + cellSiteClass + '.site');
        cellsToHighlight.push(siteCell);
    }
    else{
        cellCameraClass = cell.classList[1];
        cellSiteClass = cell.classList[2];
        //Find all celss in the current row
        var row = cell.parentNode;
        for (let i = 0; i < row.children.length; i++) {
            cellsToHighlight.push(row.children[i]);
        }

        //Find camera cell with same class as current cell
        var cameraCell = document.querySelector('.' + cellCameraClass + '.' + cellSiteClass + '.camera');
        cellsToHighlight.push(cameraCell);
        
        //Find site cell with same class as current cell
        var siteCell = document.querySelector('.' + cellSiteClass + '.site');
        cellsToHighlight.push(siteCell);
    }

    for (let i = 0; i < cellsToHighlight.length; i++) {
        cellsToHighlight[i].classList.add('highlight');
    }

}

function clearHighlights() {
    /** Clears the highlights in the structure table. */
    var highlightedCells = document.querySelectorAll('.highlight');
    highlightedCells.forEach(function (highlightedCell) {
        highlightedCell.classList.remove('highlight');
    });
}

function buildTimestampsMap(){
    /** Builds the timestamps map for Edit Timestamps. */
    var addImagesImagesDiv = document.getElementById('addImagesImagesDiv')
    while(addImagesImagesDiv.firstChild){
        addImagesImagesDiv.removeChild(addImagesImagesDiv.firstChild);
    }

    // addImagesImagesDiv.appendChild(document.createElement('br'))

    var row = document.createElement('div')
    row.classList.add('row')
    addImagesImagesDiv.appendChild(row)

    // var col1 = document.createElement('div')
    // col1.classList.add('col-lg-1')
    // row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-9')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    var h6 = document.createElement('h6')
    h6.id = 'mapTitle_time'
    h6.innerHTML = 'Loading...'
    col2.appendChild(h6)

    var row = document.createElement('div')
    row.classList.add('row')
    addImagesImagesDiv.appendChild(row)

    // var col1 = document.createElement('div')
    // col1.classList.add('col-lg-1')
    // row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-9')
    col2.setAttribute('style','text-align: center;')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    col3.setAttribute('style','padding-left: 0px;')
    row.appendChild(col3)

    var center = document.createElement('center')
    col2.appendChild(center)

    var mapDiv = document.createElement('div')
    mapDiv.id = 'mapDiv_time'
    mapDiv.style.height = '700px'
    center.appendChild(mapDiv)

    var rowDiv2 = document.createElement('div');
    rowDiv2.classList.add('row');
    col3.appendChild(rowDiv2);

    var card = document.createElement('div');
    card.classList.add('card');
    card.setAttribute('style','font-size: 80%; border: 0px;')
    col3.appendChild(card);

    var cardBody = document.createElement('div');
    cardBody.classList.add('card-body');
    cardBody.setAttribute('style','padding-top: 0px; padding-bottom: 0px;')
    card.appendChild(cardBody);

    var btn = document.createElement('button');
    btn.setAttribute('class',"btn btn-danger btn-block  btn-sm");
    btn.setAttribute('style',"margin-bottom: 3px; margin-top: 3px;")
    btn.innerHTML = 'No Timestamp (N)';
    btn.id = 'btnNoTimestamp';
    cardBody.appendChild(btn);

    document.getElementById('btnNoTimestamp').addEventListener('click', function(){
        noTimestamp()
    });

    if (selectedTimestampType != 'missing'){
        var btn = document.createElement('button');
        btn.setAttribute('class',"btn btn-primary btn-block  btn-sm");
        btn.setAttribute('style',"margin-bottom: 3px; margin-top: 3px;")
        btn.innerHTML = 'Clear (C)';
        btn.id = 'btnClearTimestamp';
        cardBody.appendChild(btn);

        document.getElementById('btnClearTimestamp').addEventListener('click', function(){
            clearTimestamp()
        });
    }

    const labels = ['Year', 'Month', 'Day', 'Hour (24h)', 'Minutes', 'Seconds'];
    const placeholders = ['YYYY', 'MM', 'DD', 'HH', 'MM', 'SS'];
    const minValues = [1900, 1, 1, 0, 0, 0];
    const maxValues = [2100, 12, 31, 23, 59, 59];
    const inputIds = ['year', 'month', 'day', 'hour', 'minutes', 'seconds'];

    labels.forEach((label, index) => {
        var labelElem = document.createElement('label');
        labelElem.setAttribute('for', inputIds[index]);
        labelElem.style.marginBottom = '2px';
        labelElem.textContent = label;
        cardBody.appendChild(labelElem);

        var inputElem = document.createElement('input');
        inputElem.setAttribute('type', 'number');
        inputElem.id = inputIds[index];
        inputElem.classList.add('form-control');
        inputElem.style.marginBottom = '2px';
        inputElem.setAttribute('placeholder', placeholders[index]);
        inputElem.setAttribute('min', minValues[index]);
        inputElem.setAttribute('max', maxValues[index]);
        cardBody.appendChild(inputElem);

        var errorElem = document.createElement('div');
        errorElem.id = 'error' + label.split(' ')[0];
        errorElem.setAttribute('style',"font-size: 80%; color: #DF691A")
        cardBody.appendChild(errorElem);
    });

    var div = document.createElement('div');
    div.setAttribute('style','font-size: 80%')
    div.innerHTML = '* Press Spacebar/Enter/Tab to skip a field.'
    cardBody.appendChild(div);

    var yearInput = document.getElementById('year');
    var monthInput = document.getElementById('month');
    var dayInput = document.getElementById('day');
    var hourInput = document.getElementById('hour');
    var minutesInput = document.getElementById('minutes');
    var secondsInput = document.getElementById('seconds');

    yearInput.addEventListener('input', function() {
        document.getElementById('errorYear').innerHTML = ''
        if (yearInput.value.length > 4){
            yearInput.value = yearInput.value.slice(0,4)
        }

        if (yearInput.value.length == 4) {
            if (isNaN(yearInput.value) || parseInt(yearInput.value) > currentYear || parseInt(yearInput.value) < 1900){
                document.getElementById('errorYear').innerHTML = 'Invalid year. Please try again.'
                yearInput.value = ''
                yearInput.focus()
            }
            else{
                monthInput.focus()
                addTimestamp()
            }
        }
    });
    
    monthInput.addEventListener('input', function() {
        document.getElementById('errorMonth').innerHTML = ''
        if (monthInput.value.length > 2){
            monthInput.value = monthInput.value.slice(0,2)
        }
        
        if (monthInput.value.length == 2) {
            if (isNaN(monthInput.value) || parseInt(monthInput.value) > 12 || parseInt(monthInput.value) < 1){
                document.getElementById('errorMonth').innerHTML = 'Invalid month. Please try again.'
                monthInput.value = ''
                monthInput.focus()
            }
            else{
                dayInput.focus()
                addTimestamp()
            }
        }
        else if (monthInput.value.length < 2){
            if (parseInt(monthInput.value) > 1){
                monthInput.value = '0' + monthInput.value
                dayInput.focus()
                addTimestamp()
            }
        }
    });
    
    dayInput.addEventListener('input', function() {
        document.getElementById('errorDay').innerHTML = ''
        if (dayInput.value.length > 2){
            dayInput.value = dayInput.value.slice(0,2)
        }
    
        if (dayInput.value.length == 2) {
            if (isNaN(dayInput.value) || parseInt(dayInput.value) > 31 || parseInt(dayInput.value) < 1){
                document.getElementById('errorDay').innerHTML = 'Invalid day. Please try again.'
                dayInput.value = ''
                dayInput.focus()
            }
            else{
                hourInput.focus()
                addTimestamp()
            }
        }
        else if (dayInput.value.length < 2){
            if (parseInt(dayInput.value) > 3){
                dayInput.value = '0' + dayInput.value
                hourInput.focus()
                addTimestamp()
            }
        }
    });
    
    hourInput.addEventListener('input', function() {
        document.getElementById('errorHour').innerHTML = ''
        if (hourInput.value.length > 2){
            hourInput.value = hourInput.value.slice(0,2)
        }
    
        if (hourInput.value.length == 2) {
            if (isNaN(hourInput.value) || parseInt(hourInput.value) > 23 || parseInt(hourInput.value) < 0){
                document.getElementById('errorHour').innerHTML = 'Invalid hour. Please try again.'
                hourInput.value = ''
                hourInput.focus()
            }
            else{
                minutesInput.focus()
                addTimestamp()
            }
        }
        else if (hourInput.value.length < 2){
            if (parseInt(hourInput.value) > 2){
                hourInput.value = '0' + hourInput.value
                minutesInput.focus()
                addTimestamp()
            }
        }
    });

    minutesInput.addEventListener('input', function() {
        document.getElementById('errorMinutes').innerHTML = ''
        if (minutesInput.value.length > 2){
            minutesInput.value = minutesInput.value.slice(0,2)
        }
    
        if (minutesInput.value.length == 2) {
            if (isNaN(minutesInput.value) || parseInt(minutesInput.value) > 59 || parseInt(minutesInput.value) < 0){
                document.getElementById('errorMinutes').innerHTML = 'Invalid minutes. Please try again.'
                minutesInput.value = ''
                minutesInput.focus()
            }
            else{
                secondsInput.focus()
                addTimestamp()
            }
        }
        else if (minutesInput.value.length < 2){
            if (parseInt(minutesInput.value) > 5){
                minutesInput.value = '0' + minutesInput.value
                secondsInput.focus()
                addTimestamp()
            }
        }
    });
    
    secondsInput.addEventListener('input', function() {
        document.getElementById('errorSeconds').innerHTML = ''
        if (secondsInput.value.length > 2){
            secondsInput.value = secondsInput.value.slice(0,2)
        }
    
        if (secondsInput.value.length == 2) {
            if (isNaN(secondsInput.value) || parseInt(secondsInput.value) > 59 || parseInt(secondsInput.value) < 0){
                document.getElementById('errorSeconds').innerHTML = 'Invalid seconds. Please try again.'
                secondsInput.value = ''
                secondsInput.focus()
            }
            else{
                addTimestamp()
                nextTimestamp()
            }
        }
        else if (secondsInput.value.length < 2){
            if (parseInt(secondsInput.value) > 5){
                secondsInput.value = '0' + secondsInput.value
                addTimestamp()
                nextTimestamp()
            }
        }
    });

    // col2.appendChild(document.createElement('br'))

    var rowDiv = document.createElement('div');
    rowDiv.classList.add('row');
    col2.appendChild(rowDiv);

    var colDiv = document.createElement('div');
    colDiv.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center');
    rowDiv.appendChild(colDiv);

    var clusterDiv = document.createElement('div');
    clusterDiv.id = 'clusterPosition_time';
    colDiv.appendChild(clusterDiv);

    var paginationUl = document.createElement('ul');
    paginationUl.classList.add('pagination');
    paginationUl.id = 'paginationCircles_time';
    paginationUl.style.margin = '10px';
    clusterDiv.appendChild(paginationUl);

    var row = document.createElement('div')
    row.classList.add('row')
    col2.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    var col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnPrevCamera'
    button.innerHTML = '<span style="font-size:100%">&#x276e;&#x276e;</span> Previous Camera'
    button.disabled = true
    col1.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnPrevImage'
    button.innerHTML = '<span style="font-size:100%">&#x276e;</span> Previous'
    button.disabled = true
    col2.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnNextImage'
    button.innerHTML = 'Next <span style="font-size:100%">&#x276f;</span>'
    button.disabled = true
    col3.appendChild(button)

    var button = document.createElement('button')
    button.classList.add('btn')
    button.classList.add('btn-primary')
    button.classList.add('btn-block')
    button.id = 'btnNextCamera'
    button.innerHTML = 'Next Camera <span style="font-size:100%">&#x276f;&#x276f;</span>'
    button.disabled = true
    col4.appendChild(button)

    document.getElementById('btnPrevCamera').addEventListener('click', ()=>{
        let validTimestamp = validateTimestamp()
        if (cameraIndex>0 && finishedDisplayingTime && validTimestamp) {
            cameraIndex -= 1
            imageIndex = 0
            updateImageMap()
        }
    });

    document.getElementById('btnPrevImage').addEventListener('click', ()=>{
        let validTimestamp = validateTimestamp()
        if (imageIndex>0  && finishedDisplayingTime && validTimestamp) {
            imageIndex -= 1
            updateImageMap()
        }
    });

    document.getElementById('btnNextImage').addEventListener('click', ()=>{
        let validTimestamp = validateTimestamp()
        if (imageIndex<images[cameraIndex].images.length-1  && finishedDisplayingTime && validTimestamp) {
            imageIndex += 1
            updateImageMap()
        }
        else if (imageIndex == images[cameraIndex].images.length-1 && finishedDisplayingTime && validTimestamp && timestamp_page[images[cameraIndex].id].next_page != null) {
            getNextTimestampImages(timestamp_page[images[cameraIndex].id].next_page)
        }
    });

    document.getElementById('btnNextCamera').addEventListener('click', ()=>{
        let validTimestamp = validateTimestamp()
        if (cameraIndex<images.length-1 && finishedDisplayingTime && validTimestamp) {
            cameraIndex += 1
            imageIndex = 0
            updateImageMap()
            if (cameraIndex > images.length - 3){
                getTimestampImages()
            }
        }
    });

    document.getElementById('btnPrevCamera').hidden = true
    document.getElementById('btnPrevImage').hidden = true
    document.getElementById('btnNextImage').hidden = true
    document.getElementById('btnNextCamera').hidden = true

    getTimestampCameraIDs()
}


function getTimestampCameraIDs(){
    /** Requests the image IDs from the server. */

    trapgroup_id = document.getElementById('timeSiteSelect').value
    camera_id = document.getElementById('timeCamSelect').value
    species = document.getElementById('timeSpeciesSelect').value
    var formData = new FormData();
    formData.append('trapgroup_id', JSON.stringify(trapgroup_id));
    formData.append('camera_id', JSON.stringify(camera_id));
    formData.append('species', JSON.stringify(species));
    formData.append('type', JSON.stringify(selectedTimestampType));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                cameraIDs = reply.camera_ids

                timestamp_page = {}
                for (let i=0; i<cameraIDs.length; i++) {
                    timestamp_page[cameraIDs[i]] = {'page': 1, 'next_page': null}
                }

                if (cameraIDs.length == 0) {
                    var addImagesImagesDiv = document.getElementById('addImagesImagesDiv')
                    while(addImagesImagesDiv.firstChild){
                        addImagesImagesDiv.removeChild(addImagesImagesDiv.firstChild);
                    }

                    addImagesImagesDiv.setAttribute('style','width: 100%; height:100%;')
    
                    // var row = document.createElement('div')
                    // row.classList.add('row')
                    // addImagesImagesDiv.appendChild(row)

                    var col1 = document.createElement('div')
                    col1.classList.add('col-lg-12', 'd-flex', 'align-items-center', 'justify-content-center', 'text-center', 'h-100')
                    addImagesImagesDiv.appendChild(col1)
                    
                    if (selectedTimestampType == 'missing') {
                        var h6 = document.createElement('h6')
                        h6.innerHTML = 'You have no missing timestamps for this survey that match the current filters.'
                        col1.appendChild(h6)
                    } else if (selectedTimestampType == 'extracted') {
                        var h6 = document.createElement('h6')
                        h6.innerHTML = 'You have no extracted timestamps for this survey that match the current filters.'
                        col1.appendChild(h6)
                    }
                    else{
                        var h6 = document.createElement('h6')
                        h6.innerHTML = 'You have no edited timestamps for this survey that match the current filters.'
                        col1.appendChild(h6)
                    }
                }
                else{

                    document.getElementById('btnPrevCamera').hidden = false
                    document.getElementById('btnPrevImage').hidden = false
                    document.getElementById('btnNextImage').hidden = false
                    document.getElementById('btnNextCamera').hidden = false

                    for (let i=0; i<3; i++) {
                        getTimestampImages()
                    }
                }
            }
        };
    xhttp.open("POST", '/getTimestampCameraIDs/' + selectedSurvey );
    xhttp.send(formData);
}

function getTimestampImages(){
    /** Requests the image IDs from the server. */

    species = document.getElementById('timeSpeciesSelect').value

    if (cameraReadAheadIndex < cameraIDs.length){
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    // console.log(reply)
                    new_images = reply.images

                    if (new_images.length > 0) {
                        timestamp_page[new_images[0].id].next_page = reply.next_page
                    }

                    for (let i=0; i<new_images.length; i++) {
                        if(camera_ids.indexOf(new_images[i].id)==-1){
                            camera_ids.push(new_images[i].id)
                            images.push(new_images[i])
                        }
                    }

                    if (images.length - 1 == imageIndex) {
                        updateImageMap()
                    }
                    updateButtons()
                    preloadImages()

                }
            };
            xhttp.open("POST", '/getTimestampImages/' + selectedSurvey + '/' + 0 + '?camera_id=' + cameraIDs[cameraReadAheadIndex++] + '&type=' + selectedTimestampType + '&species=' + species);
            xhttp.send();

    }
}

function getNextTimestampImages(page){
    /** Requests the image IDs from the server. */

    if (page==null) {
        updateImageMap()
        updateButtons()

    } else {

        species = document.getElementById('timeSpeciesSelect').value

        camera_id = images[cameraIndex].id
        timestamp_page[camera_id].page = page

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    new_images = reply.images

                    if (new_images.length > 0) {
                        timestamp_page[new_images[0].id].next_page = reply.next_page
                    }

                    for (let i=0; i<new_images.length; i++) {                
                        time_index = images.findIndex(x => x.id == new_images[i].id)
                        if (time_index != -1) {
                            new_img_index = images[time_index].images.length
                            images[time_index].images.push(...new_images[i].images)
                            if (new_images[i].images.length > 0) {
                                imageIndex = new_img_index
                            }
                        }
                    }

                    updateImageMap()
                    updateButtons()
                    preloadImages()

                }
            };
        xhttp.open("POST", '/getTimestampImages/' + selectedSurvey + '/' + 0 + '?camera_id=' + camera_id + '&type=' + selectedTimestampType + '&species=' + species + '&page=' + page);
        xhttp.send();

    }
}

function updateImageMap(){
    /** Updates the image map with the current image. */
    fullRes = false 
    finishedDisplayingTime = false
    document.getElementById('year').focus()

    document.getElementById('mapTitle_time').innerHTML = images[cameraIndex].images[imageIndex].name.split('/').slice(1).join('/')
    if (mapTime != null) {
        mapTime.setZoom(mapTime.getMinZoom())
        activeImageTime.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(images[cameraIndex].images[imageIndex].url))
    }
    else{
        prepMapTime(images[cameraIndex].images[imageIndex])
    }

    var yearInput = document.getElementById('year');
    var monthInput = document.getElementById('month');
    var dayInput = document.getElementById('day');
    var hourInput = document.getElementById('hour');
    var minutesInput = document.getElementById('minutes');
    var secondsInput = document.getElementById('seconds');

    if (images[cameraIndex].images[imageIndex].timestamp) {

        if (corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id]) {
            yearInput.value = corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id].year
            monthInput.value = corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id].month
            dayInput.value = corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id].day
            hourInput.value = corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id].hour
            minutesInput.value = corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id].minutes
            secondsInput.value = corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id].seconds
        }
        else if (corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id]) {
            yearInput.value = corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id].year
            monthInput.value = corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id].month
            dayInput.value = corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id].day
            hourInput.value = corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id].hour
            minutesInput.value = corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id].minutes
            secondsInput.value = corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id].seconds
        }
        else{
            var date = images[cameraIndex].images[imageIndex].timestamp.split(' ')[0]
            var time = images[cameraIndex].images[imageIndex].timestamp.split(' ')[1]
            var year = parseInt(date.split('-')[0])
            var month = parseInt(date.split('-')[1])
            var day = parseInt(date.split('-')[2])
            var hour = parseInt(time.split(':')[0])
            var minutes = parseInt(time.split(':')[1])
            var seconds = parseInt(time.split(':')[2])
            yearInput.value = year
            monthInput.value = month
            dayInput.value = day
            hourInput.value = hour
            minutesInput.value = minutes
            secondsInput.value = seconds
            if (selectedTimestampType=='extracted'){
                original_extracted_timestamps[images[cameraIndex].images[imageIndex].id] = {'year': year, 'month': month, 'day': day, 'hour': hour, 'minutes': minutes, 'seconds': seconds}
            }
            else if (selectedTimestampType=='edited'){
                original_edited_timestamps[images[cameraIndex].images[imageIndex].id] = {'year': year, 'month': month, 'day': day, 'hour': hour, 'minutes': minutes, 'seconds': seconds}
            }
        }
    }
    else{
        if (new_missing_timestamps[images[cameraIndex].images[imageIndex].id]) {
            yearInput.value = parseInt(new_missing_timestamps[images[cameraIndex].images[imageIndex].id].year)
            monthInput.value = parseInt(new_missing_timestamps[images[cameraIndex].images[imageIndex].id].month)
            dayInput.value = parseInt(new_missing_timestamps[images[cameraIndex].images[imageIndex].id].day)
            hourInput.value = parseInt(new_missing_timestamps[images[cameraIndex].images[imageIndex].id].hour)
            minutesInput.value = parseInt(new_missing_timestamps[images[cameraIndex].images[imageIndex].id].minutes)
            secondsInput.value = parseInt(new_missing_timestamps[images[cameraIndex].images[imageIndex].id].seconds)
        }
        else{
            yearInput.value = ''
            monthInput.value = ''
            dayInput.value = ''
            hourInput.value = ''
            minutesInput.value = ''
            secondsInput.value = ''
        }
    }

    updateButtons()
    preloadImages(true)
}

function addTimestamp(){
    /** Adds the current timestamp to the list of timestamps. */
    var yearInput = document.getElementById('year');
    var monthInput = document.getElementById('month');
    var dayInput = document.getElementById('day');
    var hourInput = document.getElementById('hour');
    var minutesInput = document.getElementById('minutes');
    var secondsInput = document.getElementById('seconds');

    var timeDict = {'year': yearInput.value, 'month': monthInput.value, 'day': dayInput.value, 'hour': hourInput.value, 'minutes': minutesInput.value, 'seconds': secondsInput.value}
    var timestamp = getTimestamp(timeDict).timestamp

    if (selectedTimestampType=='missing'){
        if (timestamp != ''){
            new_missing_timestamps[images[cameraIndex].images[imageIndex].id] = {'year': yearInput.value, 'month': monthInput.value, 'day': dayInput.value, 'hour': hourInput.value, 'minutes': minutesInput.value, 'seconds': secondsInput.value}
        }
        else{
            delete new_missing_timestamps[images[cameraIndex].images[imageIndex].id]
        }
    }
    else if (selectedTimestampType=='extracted'){
        var ogTimestamp = getTimestamp(original_extracted_timestamps[images[cameraIndex].images[imageIndex].id]).timestamp
        if ((timestamp != '' && new Date(timestamp).getTime() != new Date(ogTimestamp).getTime()) || (timestamp == '' && ogTimestamp != '')){
            corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id] = timeDict
        }
        else{
            delete corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id]
        }
    }
    else if (selectedTimestampType=='edited'){
        var ogTimestamp = getTimestamp(original_edited_timestamps[images[cameraIndex].images[imageIndex].id]).timestamp
        if ((timestamp != '' && new Date(timestamp).getTime() != new Date(ogTimestamp).getTime()) || (timestamp == '' && ogTimestamp != '')){
            corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id] = timeDict
        }
        else{
            delete corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id]
        }
    }
}

function noTimestamp(){
    /** Removes the current timestamp. */
    document.getElementById('year').value = ''
    document.getElementById('month').value = ''
    document.getElementById('day').value = ''
    document.getElementById('hour').value = ''
    document.getElementById('minutes').value = ''
    document.getElementById('seconds').value = ''

    if (selectedTimestampType=='missing'){
        delete new_missing_timestamps[images[cameraIndex].images[imageIndex].id]
    }
    else if (selectedTimestampType=='extracted'){
        var ogTimestamp = getTimestamp(original_extracted_timestamps[images[cameraIndex].images[imageIndex].id]).timestamp
        if (ogTimestamp != ''){
            corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id] = {'year': '', 'month': '', 'day': '', 'hour': '', 'minutes': '', 'seconds': ''}
        }
        else{
            delete corrected_extracted_timestamps[images[cameraIndex].images[imageIndex].id]
        }
    }
    else if (selectedTimestampType=='edited'){
        var ogTimestamp = getTimestamp(original_edited_timestamps[images[cameraIndex].images[imageIndex].id]).timestamp
        if (ogTimestamp != ''){
            corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id] = {'year': '', 'month': '', 'day': '', 'hour': '', 'minutes': '', 'seconds': ''}
        }
        else{
            delete corrected_edited_timestamps[images[cameraIndex].images[imageIndex].id]
        }
    }

    nextTimestamp()
}

function skipTime(back=false){
    /** Skips the current time unit and moves to the next one. */
    var yearInput = document.getElementById('year');
    var monthInput = document.getElementById('month');
    var dayInput = document.getElementById('day');
    var hourInput = document.getElementById('hour');
    var minutesInput = document.getElementById('minutes');
    var secondsInput = document.getElementById('seconds');
    var validTimestamp = validateTimestamp()

    if (validTimestamp){
        if (yearInput == document.activeElement){
            back ? yearInput.focus() : monthInput.focus()
            addTimestamp()
        }
        else if (monthInput == document.activeElement){
            back ? yearInput.focus() : dayInput.focus();
            addTimestamp()
        }
        else if (dayInput == document.activeElement){
            back ? monthInput.focus() : hourInput.focus()
            addTimestamp()
        }
        else if (hourInput == document.activeElement){
            back ? dayInput.focus() : minutesInput.focus()
            addTimestamp()
        }
        else if (minutesInput == document.activeElement){
            back ? hourInput.focus() : secondsInput.focus()
            addTimestamp()
        }
        else if (secondsInput == document.activeElement){
            addTimestamp()
            back ? minutesInput.focus() : nextTimestamp()
        }
        else{
            yearInput.focus()
            addTimestamp()
        }
    }
}

function clearTimestamp(){
    /** Clears the current timestamp so that a new one can be entered. */
    document.getElementById('year').value = ''
    document.getElementById('month').value = ''
    document.getElementById('day').value = ''
    document.getElementById('hour').value = ''
    document.getElementById('minutes').value = ''
    document.getElementById('seconds').value = ''
    addTimestamp()
    document.getElementById('year').focus()
}

function validateTimestamp(){
    /** Validates the current timestamp. */

    var year = document.getElementById('year').value
    var month = document.getElementById('month').value
    var day = document.getElementById('day').value
    var hour = document.getElementById('hour').value
    var minutes = document.getElementById('minutes').value
    var seconds = document.getElementById('seconds').value
    var validTimestamp = true

    document.getElementById('errorYear').innerHTML = '' 
    if ((year!= '') && (year.length != 4 || isNaN(year) || parseInt(year) > currentYear || parseInt(year) < 1900)){
        validTimestamp = false
        document.getElementById('errorYear').innerHTML = 'Invalid year. Please try again.'
    }
    document.getElementById('errorMonth').innerHTML = ''
    if ((month!= '') && (isNaN(month) || parseInt(month) > 12 || parseInt(month) < 1)){
        validTimestamp = false
        document.getElementById('errorMonth').innerHTML = 'Invalid month. Please try again.'
    }
    document.getElementById('errorDay').innerHTML = ''
    if ((day!= '') && (isNaN(day) || parseInt(day) > 31 || parseInt(day) < 1)){
        validTimestamp = false
        document.getElementById('errorDay').innerHTML = 'Invalid day. Please try again.'
    }
    document.getElementById('errorHour').innerHTML = ''
    if ((hour!= '') && (isNaN(hour) || parseInt(hour) > 23 || parseInt(hour) < 0)){
        validTimestamp = false
        document.getElementById('errorHour').innerHTML = 'Invalid hour. Please try again.'
    }
    document.getElementById('errorMinutes').innerHTML = ''
    if ((minutes!= '') && (isNaN(minutes) || parseInt(minutes) > 59 || parseInt(minutes) < 0)){
        validTimestamp = false
        document.getElementById('errorMinutes').innerHTML = 'Invalid minutes. Please try again.'
    }
    document.getElementById('errorSeconds').innerHTML = ''
    if ((seconds!= '') && (isNaN(seconds) || parseInt(seconds) > 59 || parseInt(seconds) < 0)){
        validTimestamp = false
        document.getElementById('errorSeconds').innerHTML = 'Invalid seconds. Please try again.'
    }

    return validTimestamp
}

function getTimestamp(time_dict){
    /** Gets the timestamp from the time_dict. */
    var year = time_dict.year
    var month = time_dict.month
    var day = time_dict.day
    var hour = time_dict.hour
    var minutes = time_dict.minutes
    var seconds = time_dict.seconds
    var timestamp = ''
    var timestamp_format = ''
    if (year.toString() != ''){
        timestamp = year
        timestamp_format = '%Y'
    }
    if (month.toString() != ''){
        if (timestamp != ''){
            timestamp += '-'
            timestamp_format += '-'
        }
        timestamp += month
        timestamp_format += '%m'
    }
    if (day.toString() != ''){
        if (timestamp != ''){
            timestamp += '-'
            timestamp_format += '-'
        }
        timestamp += day
        timestamp_format += '%d'
    }
    if (hour.toString() != ''){
        if (timestamp != ''){
            timestamp += ' '
            timestamp_format += ' '
        }
        timestamp += hour
        timestamp_format += '%H'
    }
    if (minutes.toString() != ''){
        if (timestamp != ''){
            timestamp += ':'
            timestamp_format += ':'
        }
        timestamp += minutes
        timestamp_format += '%M'
    }
    if (seconds.toString() != ''){
        if (timestamp != ''){
            timestamp += ':'
            timestamp_format += ':'
        }
        timestamp += seconds
        timestamp_format += '%S'
    }

    timestamp_dict = {'timestamp': timestamp, 'format': timestamp_format}

    return timestamp_dict
}

modalEditSurvey.on('keyup', function(event) {
    /** Event listener for hotkeys on Edit Timestamps. */
    if (tabActiveEditSurvey=='baseEditImgTimestampsTab' && (document.getElementById('missingTimestamps').checked||document.getElementById('extractedTimestamps').checked||document.getElementById('editedTimestamps').checked)){
        if (event.key.toLowerCase() == 'n') {
            event.preventDefault()
            noTimestamp()
        }
        else if (event.key.toLowerCase() == 'c') {
            event.preventDefault()
            clearTimestamp()
        }
        else if ((event.key.toLowerCase() == ' ')||(event.key.toLowerCase() == 'tab')||(event.key.toLowerCase() == 'enter')) {
            event.preventDefault()
            skipTime()
        }
    }
    else if (tabActiveEditSurvey=='baseStaticTab'){
        if (event.key.toLowerCase() == ' ') {
            event.preventDefault()
            hideDetections(false)
        }
    }
});

modalEditSurvey.on('keydown', function(event) {
    /** Event listener for hotkeys on Edit Timestamps. */
    if (tabActiveEditSurvey=='baseEditImgTimestampsTab' && (document.getElementById('missingTimestamps').checked||document.getElementById('extractedTimestamps').checked||document.getElementById('editedTimestamps').checked)){
        if (event.key.toLowerCase() == 'tab') {
            event.preventDefault()
        }
        else if (event.key.toLowerCase() == 'backspace') {
            if (document.activeElement.value == ''){
                event.preventDefault()
                skipTime(true)
            }
        }
    }
    else if (tabActiveEditSurvey=='baseStaticTab'){
        if (event.key.toLowerCase() == ' ') {
            event.preventDefault()
            hideDetections(true)
        }
    }
});

function nextTimestamp(){
    if (imageIndex < images[cameraIndex].images.length - 1){
        document.getElementById('btnNextImage').click()
    }
    else if ((imageIndex == images[cameraIndex].images.length - 1) && timestamp_page[images[cameraIndex].id].next_page != null){
        document.getElementById('btnNextImage').click()
    }
    else if ((cameraIndex < images.length - 1) && imageIndex == images[cameraIndex].images.length - 1){
        document.getElementById('btnNextCamera').click()
    }
}

function hideDetections(hide) {
    /** Hides the detections on the map when hotkey is pressed. */
    if (hide){
        addedDetectionsStatic = false
        drawnItemsStatic.clearLayers()
    }
    else{
        addedDetectionsStatic = false
        addDetections()
    }
}


function preloadImages(imageOnly=false){
    /** Preloads the images for the structure table. */

    if (tabActiveEditSurvey === 'baseEditMasksTab') {

        if (maskImgIndex < cameras[maskCamIndex].images.length - 1) {
            im = new Image();
            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(cameras[maskCamIndex].images[maskImgIndex + 1].url)
        }

        if (maskCamIndex<cameras.length-1 && !imageOnly){
            im = new Image();
            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(cameras[maskCamIndex+1].images[0].url)
        }
        
    } else if (tabActiveEditSurvey === 'baseStaticTab') {

        if (staticImgIndex < staticgroups[staticgroupIndex].images.length - 1) {
            im = new Image();
            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(staticgroups[staticgroupIndex].images[staticImgIndex + 1].url)
        }

        if (staticgroupIndex<staticgroups.length-1 && !imageOnly){
            im = new Image();
            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(staticgroups[staticgroupIndex+1].images[0].url)
        }

    } else if (tabActiveEditSurvey === 'baseEditImgTimestampsTab') {

        if (imageIndex < images[cameraIndex].images.length - 1) {
            im = new Image();
            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(images[cameraIndex].images[imageIndex + 1].url)
        }

        if (cameraIndex<images.length-1 && !imageOnly){
            im = new Image();
            im.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(images[cameraIndex+1].images[0].url)
        }
    }
}

function getTimestampSitesCameraAndSpecies(){
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            timestampSites = reply.sites
            timestampCameras = reply.cameras
            timestampSpecies = reply.species

            buildEditImageTimestamp()

        }

    }
    xhttp.open("GET", '/getTimestampSitesCameraAndSpecies/'+selectedSurvey);
    xhttp.send();
}

function confirmRestoreEdit() {
    /** Event listener for the confirmation of the restoration of images. */
    confirmClassifierChange = true 
    modalConfirmRestore.modal('hide')
    modalEditSurvey.modal({keyboard: true})
}

function cancelRestoreEdit() {
    /** Event listener for the cancellation of the restoration of images. */
    confirmClassifierChange = false
    modalConfirmRestore.modal('hide')
}

function removeRestoreEventListeners() {
    /** Removes the event listeners from the buttons on the confirm restore modal. */

    btnConfirmRestore.removeEventListener('click', confirmRestoreLaunch)
    btnCancelRestore.removeEventListener('click', cancelRestoreLaunch)

    btnConfirmRestore.removeEventListener('click', confirmRestoreEdit)
    btnCancelRestore.removeEventListener('click', cancelRestoreEdit)

}

modalConfirmRestore.on('hidden.bs.modal', function () {
    /** Event listener for the closing of the confirm restore modal. */
    if (document.getElementById('modalConfirmBodyRestore').innerHTML.includes('classifier')){
        if (!confirmClassifierChange){
            document.getElementById(surveyClassifierName).checked = true
        }
        confirmRestore = false
        removeRestoreEventListeners()
        modalEditSurvey.modal({keyboard: true})
    }
    else{
        removeRestoreEventListeners()
        if (confirmRestore){
            modalLaunchTask.modal({keyboard: true})
        }
    }
});