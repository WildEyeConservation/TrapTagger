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

var globalLabels = []
var globalOrganisations = []
var globalSurveys = []
var surveyNames = {}
var globalERIntegrations = {}
var globalLiveIntegrations = {}
var editedERIntegrations = {}
var editedLiveIntegrations = {}
var deletedERIntegrations = []
var deletedLiveIntegrations = []
var newERIntegrations = {}
var newLiveIntegrations = {}
var tabActive = 'baseAccountTab'
var isRoot = false

const modalConfirmChange = $('#modalConfirmChange')
const modalAPIKey = $('#modalAPIKey')

function getLabels(){
    /** Function for getting the labels from the database. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            globalLabels = reply.labels
        }
    }
    xhttp.open("GET", '/getAllLabels');
    xhttp.send();
}

function getOrganisations(){
    /** Function for getting the organisations from the database. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            globalOrganisations = reply.organisations
            globalSurveys = reply.surveys
            surveyNames = {}
            for (let i = 0; i < globalSurveys.length; i++){
                surveyNames[globalSurveys[i].id] = globalSurveys[i].name
            }
        }
    }
    xhttp.open("GET", '/getAdminOrganisations?include_surveys=true');
    xhttp.send();
}

function buildIntegrationSelect(){
    /** Function for building the integration select dropdown. */

    var integrationSelect = document.getElementById('integrationSelect')
    if (integrationSelect.value == 'earthranger'){
        var keys = Object.keys(newERIntegrations)
        var newId = 'n'+ keys.length.toString()
        buildEarthRanger(newId)
        var org_id = document.getElementById('earthRangerOrganisation-'+newId).value
        newERIntegrations[newId] = {'api_key': '', 'species': '', 'org_id': org_id}
    }
    else if (integrationSelect.value == 'live'){
        var keys = Object.keys(newLiveIntegrations)
        var newId = 'n'+ keys.length.toString()
        buildLive(newId, true)
        var survey_id = document.getElementById('surveySelect-'+newId).value
        newLiveIntegrations[newId] = {'survey_id': survey_id}
    }
}

function buildEarthRanger(IDNum){
    /** Function for building the EarthRanger Integration options. */

    var erDiv = document.getElementById('erDiv')

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','integrationSelectDiv-'+String(IDNum))
    containingDiv.style.borderTop = '1px solid rgb(60,74,89)'
    containingDiv.style.padding = '20px'
    erDiv.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-5')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-5')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Organisation'
    h5.setAttribute('style','margin-bottom: 2px;')
    col1.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Select the organisation for which you would like to set up the integration.</i>'
    col1.appendChild(h5)

    var earthRangerOrganisation = document.createElement('select')
    earthRangerOrganisation.setAttribute('class','form-control')
    earthRangerOrganisation.setAttribute('id','earthRangerOrganisation-'+String(IDNum))
    earthRangerOrganisation.setAttribute('placeholder','Select Organisation')
    col1.appendChild(earthRangerOrganisation)

    var optionTexts = []
    var optionValues = []
    for (let i=0;i<globalOrganisations.length;i++) {
        optionTexts.push(globalOrganisations[i].name)
        optionValues.push(globalOrganisations[i].id)
    }
    fillSelect(earthRangerOrganisation, optionTexts, optionValues)

    earthRangerOrganisation.addEventListener('change', function() {
        id = this.id.split('-')[1]
        speciesSelects = document.querySelectorAll('[id^="speciesSelectorER_'+id+'-"]')
        for (let i = 0; i < speciesSelects.length; i++){
            er_id = speciesSelects[i].id.split('-')[1]
            if (String(er_id).includes('n')){
                newERIntegrations[er_id]['org_id'] = this.value
            }
            else{
                if (er_id in editedERIntegrations){
                    editedERIntegrations[er_id]['org_id'] = this.value
                }
                else{
                    api_key = document.getElementById('earthRangerApiKey-'+id).value
                    species = document.getElementById('speciesSelectorER_'+id+'-'+er_id).value
                    editedERIntegrations[er_id] = {'api_key': api_key, 'species': species, 'org_id': this.value, 'id': er_id}
                }
            }
        }
    });

    col1.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
    h5.innerHTML = 'EarthRanger API Key'
    h5.setAttribute('style','margin-bottom: 2px;')
    col2.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Enter the API key that will be used to authenticate with EarthRanger.</i>'
    col2.appendChild(h5)

    var earthRangerApiKey = document.createElement('input')
    earthRangerApiKey.setAttribute('type','text')
    earthRangerApiKey.setAttribute('class','form-control')
    earthRangerApiKey.setAttribute('id','earthRangerApiKey-'+String(IDNum))
    earthRangerApiKey.setAttribute('placeholder','Enter API Key')
    col2.appendChild(earthRangerApiKey)

    earthRangerApiKey.addEventListener('change', function() {
        id = this.id.split('-')[1]
        speciesSelects = document.querySelectorAll('[id^="speciesSelectorER_'+id+'-"]')
        for (let i = 0; i < speciesSelects.length; i++){
            er_id = speciesSelects[i].id.split('-')[1]
            if (String(er_id).includes('n')){
                newERIntegrations[er_id]['api_key'] = this.value
            }
            else{
                if (er_id in editedERIntegrations){
                    editedERIntegrations[er_id]['api_key'] = this.value
                }
                else{
                    species = document.getElementById('speciesSelectorER_'+id+'-'+er_id).value
                    org_id = document.getElementById('earthRangerOrganisation-'+id).value
                    editedERIntegrations[er_id] = {'api_key': this.value, 'species': species, 'org_id': org_id, 'id': er_id}
                }
            }
        }
    });

    col2.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
    h5.innerHTML = 'EarthRanger Species'
    h5.setAttribute('style','margin-bottom: 2px;')
    col1.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Select the species you would like synchronised.</i>'
    col1.appendChild(h5)

    var earthRangerSpeciesDiv = document.createElement('div')
    earthRangerSpeciesDiv.setAttribute('id','earthRangerSpeciesDiv-'+String(IDNum))
    col1.appendChild(earthRangerSpeciesDiv)

    if (String(IDNum).includes('n')){
        buildERSpeciesSelect(IDNum, IDNum)
    }

    var btnAddSpecies = document.createElement('button')
    btnAddSpecies.setAttribute('class','btn btn-info')
    btnAddSpecies.id = 'btnAddSpecies-'+String(IDNum)
    btnAddSpecies.innerHTML = '+'
    btnAddSpecies.addEventListener('click', function() {
        let id_num = this.id.split('-')[1]
        var keys = Object.keys(newERIntegrations)
        var IDNum = 'n'+ keys.length.toString()
        buildERSpeciesSelect(id_num, IDNum)
        var api_key = document.getElementById('earthRangerApiKey-'+id_num).value
        var org_id = document.getElementById('earthRangerOrganisation-'+id_num).value
        newERIntegrations[IDNum] = {'api_key': api_key, 'species': '', 'org_id': org_id}
    });

    col1.appendChild(btnAddSpecies)


    btnRemove = document.createElement('button');
    btnRemove.id = 'btnRemoveIntegration-'+IDNum;
    btnRemove.setAttribute("class",'btn btn-danger btn-block');
    btnRemove.innerHTML = 'Remove';
    col3.appendChild(btnRemove);
    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            btnRemove = document.getElementById('btnRemoveIntegration-'+wrapIDNum)

            var speciesSelects = document.querySelectorAll('[id^="speciesSelectorER_'+wrapIDNum+'-"]')
            for (let i = 0; i < speciesSelects.length; i++){
                er_id = speciesSelects[i].id.split('-')[1]
                if (String(er_id).includes('n')){
                    delete newERIntegrations[er_id]
                }
                else{
                    delete editedERIntegrations[er_id]
                    deletedERIntegrations.push(er_id)
                }
            }

            btnRemove.parentNode.parentNode.parentNode.remove();
        }
    }(IDNum));

    // var earthRangerErrors = document.createElement('div')
    // earthRangerErrors.setAttribute('id','earthRangerErrors-'+String(IDNum))
    // earthRangerErrors.setAttribute('style','font-size: 80%; color: #DF691A')
    // containingDiv.appendChild(earthRangerErrors)

}

function buildLive(IDNum, newIntegration=false){
    /** Builds the Live Data Integration */

    var liveDiv = document.getElementById('liveDiv')
    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','integrationSelectDiv-'+String(IDNum))
    containingDiv.style.borderTop = '1px solid rgb(60,74,89)'
    containingDiv.style.padding = '20px'
    liveDiv.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-5')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-5')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var surveyDiv = document.createElement('div')
    surveyDiv.setAttribute('id','surveyDiv-'+String(IDNum))
    col1.appendChild(surveyDiv)

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Survey'
    h5.setAttribute('style','margin-bottom: 2px;')
    surveyDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    surveyDiv.appendChild(h5)

    if (newIntegration){
        h5.innerHTML = '<i>Select the survey that will receive data from the Live Data integration.</i>'

        var surveySelect = document.createElement('select')
        surveySelect.setAttribute('class','form-control')
        surveySelect.setAttribute('id','surveySelect-'+String(IDNum))
        surveySelect.setAttribute('placeholder','Select Survey')
        surveyDiv.appendChild(surveySelect)

        var optionTexts = ['None']
        var optionValues = ['-1']

        for (let i=0;i<globalSurveys.length;i++) {
            optionTexts.push(globalSurveys[i].name)
            optionValues.push(globalSurveys[i].id)
        }
        fillSelect(surveySelect, optionTexts, optionValues)

        $('#surveySelect-'+String(IDNum)).on('change', function() {
            id = this.id.split('-')[1]
            if (String(id).includes('n')){
                newLiveIntegrations[id] = {'survey_id': this.value}
            }
        });

    }
    else{
        h5.innerHTML = '<i>Survey that will receive data from the Live Data integration.</i>'
        var surveyInput = document.createElement('input')
        surveyInput.setAttribute('type','text')
        surveyInput.setAttribute('class','form-control')
        surveyInput.setAttribute('id','surveyInput-'+String(IDNum))
        surveyInput.disabled = true
        surveyInput.style.backgroundColor = 'white'
        surveyDiv.appendChild(surveyInput)
    }

    var keyDiv = document.createElement('div')
    keyDiv.setAttribute('id','keyDiv-'+String(IDNum))
    col2.appendChild(keyDiv)

    var h5 = document.createElement('h5')
    h5.innerHTML = 'API Key'
    h5.setAttribute('style','margin-bottom: 2px;')
    keyDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Select whether you would like to generate a new API Key.</i>'
    keyDiv.appendChild(h5)

    var toggle = document.createElement('label');
    toggle.classList.add('switch');
    keyDiv.appendChild(toggle);

    var checkbox = document.createElement('input');
    checkbox.setAttribute("type", "checkbox");
    checkbox.id = 'sApiKey-' + String(IDNum)
    toggle.appendChild(checkbox);

    var slider = document.createElement('span');
    slider.classList.add('slider');
    slider.classList.add('round');
    toggle.appendChild(slider);

    if (newIntegration){
        checkbox.checked = true
        checkbox.disabled = true
    }
    else{
        checkbox.checked = false
        checkbox.disabled = false
    }

    checkbox.addEventListener('change', function() {
        id = this.id.split('-')[1]
        if (this.checked){
            editedLiveIntegrations[id] = {'survey_id': globalLiveIntegrations[id].survey_id}
        }
        else{
            delete editedLiveIntegrations[id]
        }
    });

    btnRemove = document.createElement('button');
    btnRemove.id = 'btnRemoveIntegration-'+IDNum;
    btnRemove.setAttribute("class",'btn btn-danger btn-block');
    btnRemove.innerHTML = 'Remove';
    col3.appendChild(btnRemove);
    btnRemove.addEventListener('click', function(wrapIDNum) {
        return function() {
            btnRemove = document.getElementById('btnRemoveIntegration-'+wrapIDNum)

            if (String(wrapIDNum).includes('n')){
                delete newLiveIntegrations[wrapIDNum]
            }
            else{
                delete editedLiveIntegrations[wrapIDNum]
                deletedLiveIntegrations.push(wrapIDNum)
            }
 
            btnRemove.parentNode.parentNode.parentNode.remove();

        }
    }(IDNum));


}


function buildERSpeciesSelect(ID, IDNum){
    /** Function for building the species select dropdown for EarthRanger Integration. */
    var earthRangerSpeciesDiv = document.getElementById('earthRangerSpeciesDiv-'+String(ID))

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','speciesSelectERDiv_'+String(ID)+'-'+String(IDNum))
    earthRangerSpeciesDiv.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.style.padding = '0px'
    row.appendChild(col3)

    var speciesSelector = document.createElement('select')
    speciesSelector.classList.add('form-control')
    speciesSelector.id = 'speciesSelectorER_'+String(ID)+'-'+String(IDNum)
    col1.appendChild(speciesSelector)

    var speciesOptionTexts = ['None']
    var speciesOptionValues = ['-1']
    speciesOptionTexts.push(...globalLabels) 
    speciesOptionValues.push(...globalLabels)

    fillSelect(speciesSelector, speciesOptionTexts, speciesOptionValues)

    speciesSelector.addEventListener('change', function() {
        id = this.id.split('-')[1]
        if (String(id).includes('n')){
            newERIntegrations[id]['species'] = this.value
        }
        else{
            if (id in editedERIntegrations){
                editedERIntegrations[id]['species'] = this.value
            }
            else{
                div_id = this.id.split('_')[1].split('-')[0]
                api_key = document.getElementById('earthRangerApiKey-'+div_id).value
                org_id = document.getElementById('earthRangerOrganisation-'+div_id).value
                editedERIntegrations[id] = {'api_key': api_key, 'species': this.value, 'org_id': org_id, 'id': id}
            }
        }   
    });

    btnRemove = document.createElement('button');
    btnRemove.id = 'btnRemoveSpeciesER_'+String(ID)+'-'+String(IDNum);
    btnRemove.setAttribute("class",'btn btn-info');
    btnRemove.innerHTML = '&times;';
    col3.appendChild(btnRemove);
    btnRemove.addEventListener('click', function(){
        this.parentNode.parentNode.remove();
        id = this.id.split('-')[1]
        if (String(id).includes('n')){
            delete newERIntegrations[id]
        }
        else{
            delete editedERIntegrations[id]
            deletedERIntegrations.push(id)
        }
    });

}

function saveSettings(){
    /** Function for saving settings to the database. */

    if (tabActive == 'baseAccountTab'){
        if (isRoot){
            modalConfirmChange.modal({keyboard: true});
        }
        else {
            saveAccountInfo()
        }
    }
    else if (tabActive == 'baseIntegrationsTab'){
        saveIntegrations()
    }
}

function saveIntegrations(){
    /** Function for saving the integrations to the database. */

    document.getElementById('settingsErrors').innerHTML = ''
    var valid = validateIntegrationSettings()
    if (valid){
        var integrations = []
        var earth_ranger_integrations = getEarthRangerIntegrations()
        var live_integrations = getLiveIntegrations()
        integrations = {
            'earthranger': earth_ranger_integrations,
            'live': live_integrations
        }

        var formData = new FormData();
        formData.append('integrations', JSON.stringify(integrations))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                // console.log(reply)
                document.getElementById('settingsErrors').innerHTML = reply.message

                if (reply.status == 'SUCCESS'){
                    if (reply.new_api_keys && reply.new_api_keys.length > 0){
                        loadApiKeys(reply.new_api_keys)
                    }
                    else{
                        globalERIntegrations = {}
                        globalLiveIntegrations = {}
                    
                        newERIntegrations = {}
                        editedERIntegrations = {}
                        deletedERIntegrations = []
                    
                        newLiveIntegrations = {}
                        editedERIntegrations = {}
                        deletedLiveIntegrations = []
                        loadIntegrations();
                    }
                }
            }
        }
        xhttp.open("POST", '/saveIntegrations');
        xhttp.send(formData);
    }
}

function getEarthRangerIntegrations(){
    /** Get the EarthRanger integrations from the page.  (New, Edited, Deleted) */

    var new_integrations = []
    var edited_integrations = []

    for (var key in newERIntegrations){
        if (newERIntegrations[key].species != '' && newERIntegrations[key].species != '-1' && newERIntegrations[key].api_key != ''){
            new_integrations.push(newERIntegrations[key])
        }
    }

    for (var key in editedERIntegrations){
        if (editedERIntegrations[key].species != '' && editedERIntegrations[key].species != '-1' && editedERIntegrations[key].api_key != ''){
            if (globalERIntegrations[key]){
                if (globalERIntegrations[key].species != editedERIntegrations[key].species || globalERIntegrations[key].api_key != editedERIntegrations[key].api_key || globalERIntegrations[key].org_id != editedERIntegrations[key].org_id){
                    edited_integrations.push(editedERIntegrations[key])
                }
            }
        }
    }

    return {'new': new_integrations, 'edited': edited_integrations, 'deleted': deletedERIntegrations}
}

function getLiveIntegrations(){
    /** Get the Live data integrations from the page.  (New, Edited, Deleted) */

    var new_integrations = []
    var edited_integrations = []

    for (var key in newLiveIntegrations){
        if (newLiveIntegrations[key].survey_id != '' && newLiveIntegrations[key].survey_id != '-1'){
            new_integrations.push(newLiveIntegrations[key])
        }
    }

    for (var key in editedLiveIntegrations){
        edited_integrations.push({
            'id': key,
            'survey_id': editedLiveIntegrations[key].survey_id
        })
    }

    return {'new': new_integrations, 'edited': edited_integrations, 'deleted': deletedLiveIntegrations}
}

function validateIntegrationSettings(){
    /** Function for validating the integration settings. */
    var valid = true
    var live_surveys = []
    var duplicate_er = []
    var erErrors = []
    var liveErrors = []

    //EarthRanger Validation 
    var speciesSelects = document.querySelectorAll('[id^="speciesSelectorER_"]')
    for (let i = 0; i < speciesSelects.length; i++){
        let speciesSelect = speciesSelects[i]
        let parent_id = speciesSelect.id.split('_')[1].split('-')[0]
        let id = speciesSelect.id.split('_')[1].split('-')[1]
        let org_id = document.getElementById('earthRangerOrganisation-'+parent_id).value
        let api_key = document.getElementById('earthRangerApiKey-'+parent_id).value
        let species = speciesSelect.value
        let value = api_key + '-' + org_id + '-' + species
        if (duplicate_er.indexOf(value) == -1){
            duplicate_er.push(value)
        }
        else{
            valid = false
            erErrors.push('EarthRanger Integrations must be unique.')
        }
    }

    var erIntegrations = {...newERIntegrations, ...editedERIntegrations};
    for (var key in erIntegrations){
        var api_key = erIntegrations[key].api_key
        var org_id = erIntegrations[key].org_id
        var species = erIntegrations[key].species
        if (api_key == ''){
            valid = false
            erErrors.push('EarthRanger API Key is required.')
        }

        if (org_id == '-1' || org_id == ''){
            valid = false
            erErrors.push('Organisation is required.')
        }

        if (species == '' || species == '-1'){
            valid = false
            erErrors.push('A species must be selected.')
        }
    }

    erErrors = [...new Set(erErrors)]

    //Live Data Validation 
    var surveySelects = document.querySelectorAll('[id^="surveySelect-"]')
    var surveyInputs = document.querySelectorAll('[id^="surveyInput-"]')
    for (let i = 0; i < surveyInputs.length; i++){
        surveyInputs[i].classList.forEach(function(item){
            if (item.includes('id-')){
                id_class = item
            }
        })
        let survey_id = id_class.split('-')[1]
        live_surveys.push(survey_id)
    }
    
    for (let i = 0; i < surveySelects.length; i++){
        let survey = surveySelects[i].value
        if (live_surveys.indexOf(survey) == -1){
            live_surveys.push(survey)
        }
        else{
            valid = false
            liveErrors.push('Live Data Integrations must be unique.')
        }
    }

    var liveIntegrations = newLiveIntegrations
    for (var key in liveIntegrations){
        var survey = liveIntegrations[key].survey_id
        if (survey == '-1' || survey == ''){
            valid = false
            liveErrors.push('Survey is required.')
        }
    }

    //Unique errors
    liveErrors = [...new Set(liveErrors)]

    if (!valid){
        errorMessage = 'You have errors in your integrations settings. Please correct them before saving. <br>'
        if (erErrors.length > 0){
            errorMessage += '<b>EarthRanger Integration:</b> <br>'
            for (let i = 0; i < erErrors.length; i++){
                errorMessage += erErrors[i] + ' '
            }
            errorMessage += '<br>'
        }
        if (liveErrors.length > 0){
            errorMessage += '<b>Live Data Integration:</b> <br>'
            for (let i = 0; i < liveErrors.length; i++){
                errorMessage += liveErrors[i] + ' '
            }
        }
        document.getElementById('settingsErrors').innerHTML = errorMessage
    }
    else{
        document.getElementById('settingsErrors').innerHTML = ''
    }
    
    return valid
}

function loadEarthRangerIntegration(IDNum, api_key, species, ids, organisation){
    /** Function for loading the EarthRanger Integration options from the database. */
    document.getElementById('earthRangerApiKey-'+String(IDNum)).value = api_key
    document.getElementById('earthRangerOrganisation-'+String(IDNum)).value = organisation

    earthRangerSpeciesDiv = document.getElementById('earthRangerSpeciesDiv-'+String(IDNum))
    while (earthRangerSpeciesDiv.firstChild) {
        earthRangerSpeciesDiv.removeChild(earthRangerSpeciesDiv.firstChild);
    }
    
    for (var i = 0; i < species.length; i++){
        buildERSpeciesSelect(IDNum, ids[i])
        var speciesSelect = document.getElementById('speciesSelectorER_'+String(IDNum)+'-'+ids[i].toString())
        speciesSelect.value = species[i]
        globalERIntegrations[ids[i]] = {'species': species[i], 'api_key': api_key, 'org_id': organisation}
    }
}

function loadLiveIntegration(survey_id,survey_name,id){
    /** Function for loading the Live data Integration options from the database. */
    document.getElementById('surveyInput-'+String(id)).value = survey_name
    document.getElementById('surveyInput-'+String(id)).classList.add('id-'+String(survey_id))
    globalLiveIntegrations[id] = {'survey_id': survey_id}
}

function loadIntegrations(){
    /** Function for loading the user's integrations from the database. */
    document.getElementById('settingsErrors').innerHTML = ''
    var erDiv = document.getElementById('erDiv')
    while (erDiv.firstChild) {
        erDiv.removeChild(erDiv.firstChild);
    }

    var liveDiv = document.getElementById('liveDiv')
    while (liveDiv.firstChild) {
        liveDiv.removeChild(liveDiv.firstChild);
    }

    var integrationSelect = document.getElementById('integrationSelect')
    if (integrationSelect.value == 'live'){
        erDiv.hidden = true
        liveDiv.hidden = false
    }
    else{
        erDiv.hidden = false
        liveDiv.hidden = true
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            var integrations = reply.integrations
            for (let i = 0; i < integrations.length; i++){
                if (integrations[i].integration == 'earthranger'){
                    ids = integrations[i].ids.join(',')
                    buildEarthRanger(ids)
                    loadEarthRangerIntegration(ids, integrations[i].api_key, integrations[i].species, integrations[i].ids, integrations[i].organisation)
                }
                else if (integrations[i].integration == 'live'){
                    buildLive(integrations[i].id)
                    loadLiveIntegration(integrations[i].survey_id, integrations[i].survey, integrations[i].id)
                }
            }
        }
    }
    xhttp.open("GET", '/getIntegrations');
    xhttp.send();
}

function openSettingsTab(evt, tabName) {
    /** Opens the permissions tab */

    globalERIntegrations = {}
    globalLiveIntegrations = {}

    newERIntegrations = {}
    editedERIntegrations = {}
    deletedERIntegrations = []

    newLiveIntegrations = {}
    editedLiveIntegrations = {}
    deletedLiveIntegrations = []

    var mainCard = document.getElementById('mainCard')
    var tabcontent = mainCard.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    var tablinks = mainCard.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    tabActive = tabName

    if (tabName == 'baseAccountTab') {
        document.getElementById('saveSettingsButton').innerHTML = 'Save Account Info'
        getAccountInfo()
    }
    else if (tabName == 'baseIntegrationsTab') {
        document.getElementById('saveSettingsButton').innerHTML = 'Save Integrations'
        loadIntegrations();
    }
}

function getAccountInfo(){
    // Function for getting the user's account info from the database.

    s3Div = document.getElementById('s3Div')
    while (s3Div.firstChild) {
        s3Div.removeChild(s3Div.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            document.getElementById('username').value = reply.username
            document.getElementById('email').value = reply.email

            if (reply.cloud_access){
                buildS3Folders(reply.organisations)
                document.getElementById('orgFolder').hidden = false
            }
            else{
                document.getElementById('orgFolder').hidden = true
            }

            if (reply.admin){
                document.getElementById('settingsPageTabs').hidden = false
            }
            else{
                document.getElementById('settingsPageTabs').hidden = true
            }

            if (reply.root){
                isRoot = true
            }
            else{
                isRoot = false
            }
        }
    }
    xhttp.open("GET", '/getAccountInfo');
    xhttp.send();
}


function buildS3Folders(organisations){
    /** Function for building the S3 folders. */
    s3Div = document.getElementById('s3Div')

    for (let i = 0; i < organisations.length ; i++){

        var row = document.createElement('div')
        row.classList.add('row')
        s3Div.appendChild(row)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-6')
        row.appendChild(col1)

        var col2 = document.createElement('div')
        col2.classList.add('col-lg-6')
        row.appendChild(col2)

        var inputName = document.createElement('input')
        inputName.setAttribute('type','text')
        inputName.setAttribute('class','form-control')
        inputName.value = organisations[i].name
        inputName.disabled = true
        inputName.style.backgroundColor = 'white'
        col1.appendChild(inputName)

        var inputFolder = document.createElement('input')
        inputFolder.setAttribute('type','text')
        inputFolder.setAttribute('class','form-control')
        inputFolder.value = organisations[i].folder
        inputFolder.disabled = true
        inputFolder.style.backgroundColor = 'white'
        col2.appendChild(inputFolder)

    }
    
}

function saveAccountInfo(){
    /** Function for saving the user's account info to the database. */
    var accountErrors = document.getElementById('accountErrors')
    accountErrors.innerHTML = ''

    var username = document.getElementById('username').value
    var email = document.getElementById('email').value

    var valid = true
    if (username == ''){
        valid = false
        accountErrors.innerHTML += 'Username is required. '
    }

    if (email == ''){
        valid = false
        accountErrors.innerHTML += 'Email is required. '
    }
    else{
        var emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)){
            valid = false
            accountErrors.innerHTML += 'Email is invalid. '
        }
    }

    if (valid){
        var formData = new FormData();
        formData.append('username', JSON.stringify(username))
        formData.append('email', JSON.stringify(email))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                // console.log(reply)
                accountErrors.innerHTML = reply.message
                if (reply.status == 'SUCCESS'){
                    getAccountInfo()
                }
            }
        }
        xhttp.open("POST", '/saveAccountInfo');
        xhttp.send(formData);
    }
}

$('#btnConfirmChange').on('click', function() {
    /** Event listener for the confirm change button. */
    modalConfirmChange.modal('hide');
    saveAccountInfo()
});

$('#integrationSelect').on('change', function() {
    /** Event listener for the integration select dropdown. */
    var erDiv = document.getElementById('erDiv')
    var liveDiv = document.getElementById('liveDiv')

    if (this.value == 'live'){
        erDiv.hidden = true
        liveDiv.hidden = false
    }
    else{
        erDiv.hidden = false
        liveDiv.hidden = true
    }   
});

function loadApiKeys(api_keys){
    /** Displays the new API keys in a modal. */
    var apiKeyDiv = document.getElementById('apiKeyDiv')
    while (apiKeyDiv.firstChild) {
        apiKeyDiv.removeChild(apiKeyDiv.firstChild);
    }

    for (let i = 0; i < api_keys.length; i++){
        var row = document.createElement('div')
        row.classList.add('row')
        apiKeyDiv.appendChild(row)
    
        var col1 = document.createElement('div')
        col1.classList.add('col-lg-5')
        row.appendChild(col1)
    
        var col2 = document.createElement('div')
        col2.classList.add('col-lg-6')
        row.appendChild(col2)
    
        var col3 = document.createElement('div')
        col3.classList.add('col-lg-1')
        col3.style.paddingLeft = '0px'
        col3.classList.add('justify-content-center')
        row.appendChild(col3)

        var inputName = document.createElement('input')
        inputName.setAttribute('type','text')
        inputName.setAttribute('class','form-control')
        inputName.value = surveyNames[api_keys[i].survey_id]
        inputName.disabled = true
        inputName.style.backgroundColor = 'white'
        col1.appendChild(inputName)

        var inputKey = document.createElement('input')
        inputKey.setAttribute('type','text')
        inputKey.setAttribute('class','form-control')
        inputKey.id = 'id-'+api_keys[i].survey_id
        inputKey.value = api_keys[i].api_key
        inputKey.disabled = true
        inputKey.style.backgroundColor = 'white'
        col2.appendChild(inputKey)

        var copyClipboard = document.createElement('button');
        copyClipboard.setAttribute('type', 'button');
        copyClipboard.setAttribute('class', 'btn btn-link btn-sm');
        copyClipboard.setAttribute('align', 'left');
        copyClipboard.setAttribute('data-toggle', 'tooltip');
        copyClipboard.setAttribute('title', 'Copy to clipboard');
        copyClipboard.setAttribute('style', 'font-size: 1.4em; padding: 0px; margin-left: 0px; margin-bottom: 0px;');
        copyClipboard.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i>';
        col3.appendChild(copyClipboard);

        copyClipboard.addEventListener('click', function(wrapSurveyID){
            return function() {
                var copyText = document.getElementById('id-'+wrapSurveyID).value
                navigator.clipboard.writeText(copyText)
            }
        }(api_keys[i].survey_id));
    }

    modalAPIKey.modal({keyboard: true});	
}

modalAPIKey.on('hidden.bs.modal', function () {
    /** Event listener for the API Key modal close. */
    loadIntegrations()
});

function onload(){
    /**Function for initialising the page on load.*/
    getLabels();
    getOrganisations();
    
    document.getElementById('openAccountTab').click();
}

window.addEventListener('load', onload, false);

