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

var clusterIDs
var clusterReadAheadIndex=0;
var currentLabel = '0';
var currentTag = '0';
var currentSite = '0';
var currentAnnotator = '0'
var currentStartDate = null
var currentEndDate = null
var prevLabel = '0'
var prevTag = '0'
var prevSite = '0'
var prevAnnotator = '0'
var prevStartDate = null
var prevEndDate = null
var editingEnabled = false
var getClusterAttempts = 0
isTagging = false
isReviewing = true
isKnockdown = false
isBounding = false
isIDing = false
isStaticCheck = false
isTimestampCheck = false

currentRequest = null

wrongStatus = true
dontResetWrong = true
tempTaggingLevel = '-1'

var blockedExploreLabels = ['Knocked Down', 'Remove False Detections', 'Mask Area']

const divSelector = document.querySelector('#divSelector');
const divTagSelector = document.querySelector('#divTagSelector');
const divSiteSelector = document.querySelector('#divSiteSelector');
const divAnnotatorSelector = document.querySelector('#divAnnotatorSelector');
const annotationLevel = document.querySelector('#annotationLevel');

function loadNewCluster(mapID = 'map1') {
    /** loads the next cluster based on the IDs contained in the clusterIDs array. */
    if (clusterReadAheadIndex<clusterIDs.length) {

        var newID = Math.floor(Math.random() * 100000) + 1;
        clusterRequests[mapID].push(newID)

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
            function () {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                }
                else if (this.readyState == 4 && this.status == 200) {
                    info = JSON.parse(this.responseText);

                    if (clusterRequests[mapID].includes(parseInt(info.id))) {
                        clusterRequests[mapID].splice(clusterRequests[mapID].indexOf(parseInt(info.id)), 1)
                        newcluster = info.info[0];
                        clusters[mapID].push(newcluster)

                        // Access control
                        if (info.access == true) {
                            if (annotationLevel.disabled == true) {
                                if (globalKeys==null) {
                                    getKeys()
                                }
                                switchTaggingLevel('-1')
                            }
                            annotationLevel.disabled = false
                            document.getElementById('noteboxExp').readOnly = false
                        }
                        else{
                            annotationLevel.disabled = true
                            while(divBtns.firstChild){
                                divBtns.removeChild(divBtns.firstChild);
                            }
                            document.getElementById('noteboxExp').readOnly = true
                        }

                        if (clusters[mapID].length - 1 == clusterIndex[mapID]) {
                            updateCanvas()
                            updateClusterLabels()
                        }
                        updateButtons()
                        preload()
                        exploreNotes()
                    }
                }
            };
        xhttp.open("GET", '/getCluster?id=' + clusterIDs[clusterReadAheadIndex++] + '&reqId='+newID);
        xhttp.send();
    }
}

function getKeys() {
    /** Initialises the keys for the current tagging level. */
    if (!isBounding) {
        if (globalKeys==null) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/initKeys', true);
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);
                        
                        if (reply == 'error') {
                            globalKeys = null
                        }
                        else{
                            globalKeys = reply
                            for (let key in globalKeys) {
                                if (globalKeys[key].length!=0) {
                                    for (let i=0;i<globalKeys[key][1].length;i++) {
                                        if (blockedExploreLabels.includes(globalKeys[key][1][i])) {
                                            globalKeys[key][1][i] = 'N'
                                            globalKeys[key][0][i] = -967
                                        }
                                    }
                                }
                            }
    
                            res = globalKeys[taggingLevel]
        
                            // Remove undesirable names from the explore page
                            if (res.length!=0) {    
                                initKeys(res);
                            }
                        }
                    }
                }
            xhttp.send();
        } else {
            initKeys(globalKeys[taggingLevel])
        }
    }
}

function populateLevels() {
    /** Populates the tagging-level selector. */
    switchTaggingLevel(annotationLevel.value)
}

annotationLevel.addEventListener('change', function() {
    /** Handles the event when the tagging-level selector is changed. */
    populateLevels()
});

function getClusterIDs(mapID = 'map1'){
    /** Gets a list of cluster IDs to be explored for the current combination of task and label. */
    var xhttp = new XMLHttpRequest();
    var formData = new FormData()
    if(notesOnly){
        formData.append('notesOnly', JSON.stringify('True'))
    }
    if(currentStartDate){
        formData.append('startDate', JSON.stringify(currentStartDate))
    }
    if(currentEndDate){
        formData.append('endDate', JSON.stringify(currentEndDate))
    }
    notes = document.getElementById('noteboxExpSearch').value
    if (notes != ''){
        formData.append('notes', JSON.stringify(notes))
    }
    var newID = Math.floor(Math.random() * 100000) + 1;
    currentRequest = newID
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                clusters[mapID]=[]
                clusterReadAheadIndex = 0
                clusterIndex[mapID] = 0
                imageIndex[mapID] = 0
                updateClusterLabels()
                response = JSON.parse(this.responseText);
                if (parseInt(response.reqID)==currentRequest) {
                    clusterIDs = response.clusterIDs
                    if(clusterIDs.length == 0){
                        document.getElementById('modalAlertText').innerHTML = 'There are no clusters available.'
                        modalAlert.modal({keyboard: true});
                        if(notesOnly){
                            document.getElementById('onlyNotesCheckbox').checked = false
                            notesOnly = false
                        }
                        currentLabel= prevLabel
                        divSelector.value = currentLabel
                        currentTag = prevTag
                        divTagSelector.value = currentTag
                        currentSite = prevSite
                        divSiteSelector.value = currentSite
                        currentAnnotator = prevAnnotator
                        divAnnotatorSelector.value = currentAnnotator
                        currentStartDate = prevStartDate
                        document.getElementById('expStartDate').value = currentStartDate ? currentStartDate.split(' ')[0] : ''
                        currentEndDate = prevEndDate
                        document.getElementById('expEndDate').value = currentEndDate ? currentEndDate.split(' ')[0] : ''
                        document.getElementById('noteboxExpSearch').value = ''
                        document.getElementById('notif1').innerHTML = ''
                        if (getClusterAttempts<5){
                            getClusterAttempts += 1
                            getClusterIDs()
                        }
                    }
                    else{
                        getClusterAttempts = 0
                        for (let i=0;i<3;i++){
                            loadNewCluster()
                        }
                    }
                }
            }
        };
    xhttp.open("POST", '/getClustersBySpecies/'+selectedTask+'/'+currentLabel+'/'+currentTag+'/'+currentSite+'/'+currentAnnotator+'?reqId='+newID);
    xhttp.send(formData);
}

function searchNotes(mapID='map1'){
    /** Searches for clusters with notes specified in explore page search bar */
    var xhttp = new XMLHttpRequest();
    var formData = new FormData()
    notes = document.getElementById('noteboxExpSearch').value
    formData.append('notes', JSON.stringify(notes))
    if(currentStartDate){
        formData.append('startDate', JSON.stringify(currentStartDate))
    }
    if(currentEndDate){
        formData.append('endDate', JSON.stringify(currentEndDate))
    }
    var newID = Math.floor(Math.random() * 100000) + 1;
    currentRequest = newID
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                clusters[mapID]=[]
                clusterReadAheadIndex = 0
                clusterIndex[mapID] = 0
                imageIndex[mapID] = 0
                updateClusterLabels()
                response = JSON.parse(this.responseText);
                if (parseInt(response.reqID)==currentRequest) {
                    clusterIDs = response.clusterIDs

                    if (clusterIDs[0]){
                        for (let i=0;i<3;i++){
                            loadNewCluster()
                        }
                        document.getElementById('notif1').innerHTML = ''
                    }
                    else{
                        document.getElementById('notif1').innerHTML = 'No notes matches your search.'
                    }
                }
            }
        };
    xhttp.open("POST", '/getClustersBySpecies/'+selectedTask+'/'+currentLabel+'/'+currentTag+'/'+currentSite+'/'+currentAnnotator+'?reqId='+newID);
    xhttp.send(formData);
}

// function populateSpeciesSelector(label, mapID = 'map1'){
//     /** Populates the species-to-be-explored selector. Also builds sub-species selectors as needed. */
//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             response = JSON.parse(this.responseText);

//             clearSelect(divSelector)
//             var optionTexts = []
//             var optionValues = []
//             labels = response[0]
//             for (let i=0;i<labels.length;i++) {
//                 optionTexts.push(labels[i][1])
//                 optionValues.push(labels[i][0])
//             }
//             fillSelect(divSelector, optionTexts, optionValues)

//             divSelector.value = label

//             prevLabel = currentLabel
//             prevTag = currentTag
//             prevSite = currentSite
//             prevAnnotator = currentAnnotator
//             prevStartDate = currentStartDate
//             prevEndDate = currentEndDate
//             currentLabel = label
//             clusterRequests[mapID] = [];
//             getClusterIDs()
//         }
//     }
//     xhttp.open("GET", '/getSpeciesSelectorBySurvey/'+label);
//     xhttp.send();
// }

function populateSpeciesSelector(){
    /** Populates the species-to-be-explored selector. Also builds sub-species selectors as needed. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);

            clearSelect(divSelector)
            var optionTexts = []
            var optionValues = []
            labels = response
            for (let i=0;i<labels.length;i++) {
                optionTexts.push(labels[i][1])
                optionValues.push(labels[i][0])
            }
            fillSelect(divSelector, optionTexts, optionValues)

        }
    }
    xhttp.open("GET", '/populateSpeciesSelector');
    xhttp.send();
}

divSelector.addEventListener('change', function() {
    /** Handles the event when a species is selected. */
    selectSpecies(divSelector.value)
})

function selectSpecies(label) {
    /** Selects the species. */
    prevLabel = currentLabel
    prevTag = currentTag
    prevSite = currentSite
    prevAnnotator = currentAnnotator
    prevStartDate = currentStartDate
    prevEndDate = currentEndDate
    currentLabel = label
    clusterRequests['map1'] = [];
    getClusterIDs()
}

function populateTagSelector() {
    /** Populates the tag selector. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);

            clearSelect(divTagSelector)
            var optionTexts = []
            var optionValues = []
            tags = response
            for (let i=0;i<tags.length;i++) {
                optionTexts.push(tags[i][1])
                optionValues.push(tags[i][0])
            }
            fillSelect(divTagSelector, optionTexts, optionValues)
        }
    }
    xhttp.open("GET", '/populateTagSelector');
    xhttp.send();
}

divTagSelector.addEventListener('change', function() {
    /** Handles the event when a tag is selected. */
    selectTag(divTagSelector.value)
});

function populateSiteSelector() {
    /** Populates the site selector. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);

            clearSelect(divSiteSelector)
            var optionTexts = []
            var optionValues = []
            sites = response
            for (let i=0;i<sites.length;i++) {
                optionTexts.push(sites[i][1])
                optionValues.push(sites[i][0])
            }
            fillSelect(divSiteSelector, optionTexts, optionValues)

        }
    }
    xhttp.open("GET", '/populateSiteSelector');
    xhttp.send();
}

divSiteSelector.addEventListener('change', function() {
    /** Handles the event when a site is selected. */
    selectSite(divSiteSelector.value)
});

function populateAnnotatorSelector() {
    /** Populates the annotator selector. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            response = JSON.parse(this.responseText);

            clearSelect(divAnnotatorSelector)
            var optionTexts = []
            var optionValues = []
            annotators = response
            for (let i=0;i<annotators.length;i++) {
                optionTexts.push(annotators[i][1])
                optionValues.push(annotators[i][0])
            }
            fillSelect(divAnnotatorSelector, optionTexts, optionValues)

        }
    }
    xhttp.open("GET", '/populateAnnotatorSelector');
    xhttp.send();
}

divAnnotatorSelector.addEventListener('change', function() {
    /** Handles the event when a site is selected. */
    selectAnnotator(divAnnotatorSelector.value)
});

function selectTag(tag) {
    prevTag = currentTag
    prevLabel = currentLabel
    prevSite = currentSite
    prevAnnotator = currentAnnotator
    prevStartDate = currentStartDate
    prevEndDate = currentEndDate
    currentTag = tag
    clusterRequests['map1'] = [];
    getClusterIDs()
}

function selectSite(site) {
    prevTag = currentTag
    prevLabel = currentLabel
    prevSite = currentSite
    prevAnnotator = currentAnnotator
    prevStartDate = currentStartDate
    prevEndDate = currentEndDate
    currentSite = site
    clusterRequests['map1'] = [];
    getClusterIDs()
}

function selectAnnotator(annotator) {
    /** Selects the annotator. */
    prevTag = currentTag
    prevLabel = currentLabel
    prevSite = currentSite
    prevAnnotator = currentAnnotator
    prevStartDate = currentStartDate
    prevEndDate = currentEndDate
    currentAnnotator = annotator
    clusterRequests['map1'] = [];
    getClusterIDs()
}

$('#expStartDate').change(function() {
    /** Handles the event when the start date is changed. */
    valid = validateDates()
    if (valid){
        document.getElementById('expDateErrors').innerHTML = ''
        prevTag = currentTag
        prevLabel = currentLabel
        prevSite = currentSite
        prevAnnotator = currentAnnotator
        prevStartDate = currentStartDate
        prevEndDate = currentEndDate
        clusterRequests['map1'] = [];

        if (this.value == '') {
            currentStartDate = null
        }
        else{
            currentStartDate = this.value + ' 00:00:00'
        }

        getClusterIDs()
    }
});

$('#expEndDate').change(function() {
    /** Handles the event when the end date is changed. */
    valid = validateDates()
    if (valid){
        document.getElementById('expDateErrors').innerHTML = ''
        prevTag = currentTag
        prevLabel = currentLabel
        prevSite = currentSite
        prevAnnotator = currentAnnotator
        prevStartDate = currentStartDate
        prevEndDate = currentEndDate
        clusterRequests['map1'] = [];

        if (this.value == '') {
            currentEndDate = null
        }
        else{
            currentEndDate = this.value + ' 23:59:59'
        }

        getClusterIDs()
    }
});

$("#onlyNotesCheckbox").change( function() {
    /** Checks when the checkbox for filtering the cluster by notes is checked */
    onlyNotesCheckbox = document.getElementById('onlyNotesCheckbox')
    if (onlyNotesCheckbox.checked) {
        notesOnly = true
        // document.getElementById('noteboxExpSearch').value = ''
    }
    else{
        notesOnly = false
        // document.getElementById('noteboxExpSearch').value = ''
    }
    getClusterIDs()
})

$("#noteboxExpSearch").change( function() {
    /** Handles the event when the search bar for notes is changed */
    prevTag = currentTag
    prevLabel = currentLabel
    prevSite = currentSite
    prevAnnotator = currentAnnotator
    prevStartDate = currentStartDate
    prevEndDate = currentEndDate
    prevAnnotator = currentAnnotator
    clusterRequests['map1'] = [];

    searchNotes()
});

$("#noteboxExp").on('focus', function(){
    isNoteActive = true
})

$("#noteboxExp").on('blur', function(){
    isNoteActive = false
    sendNoteExplore()
})

$("#noteboxExpSearch").on('focus', function(){
    isNoteActive = true
    isSearchNoteActive = true
})

$("#noteboxExpSearch").on('blur', function(){
    isNoteActive = false
    isSearchNoteActive = false
})

$('#expStartDate').on('focus', function(){
    isDateActive = true
})

$('#expStartDate').on('blur', function(){
    isDateActive = false
})

$('#expEndDate').on('focus', function(){
    isDateActive = true
})

$('#expEndDate').on('blur', function(){
    isDateActive = false
})

function validateDates(){
    /** Validates the dates */
    startDate = document.getElementById('expStartDate').value
    endDate = document.getElementById('expEndDate').value
    if (startDate != '' && endDate != '') {
        if (new Date(startDate) > new Date(endDate)) {
            document.getElementById('expDateErrors').innerHTML = 'Start date must be before end date.'
            return false
        }
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (startDate != ''){
        // Check if the start date is valid
        if (!startDate.match(dateRegex)){
            document.getElementById('expDateErrors').innerHTML = 'Invalid date.'
            return false
        }

        if (new Date(startDate) > new Date() || new Date(startDate) < new Date('1900-01-01')){
            document.getElementById('expDateErrors').innerHTML = 'Invalid date.'
            return false
        }
        
    }

    if (endDate != ''){
        // Check if the end date is valid
        if (!endDate.match(dateRegex)){
            document.getElementById('expDateErrors').innerHTML = 'Invalid date.'
            return false
        }

        if (new Date(endDate) < new Date('1900-01-01')){
            document.getElementById('expDateErrors').innerHTML = 'Invalid date.'
            return false
        }
    }

    return true
}

window.addEventListener('load', onload, false);
