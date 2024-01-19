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
var globalERIntegrations = []
var tabActive = 'baseAccountTab'
var isRoot = false

const modalConfirmChange = $('#modalConfirmChange')

function getLabels(){
    /** Function for getting the labels from the database. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            globalLabels = reply.labels

            loadIntegrations();
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
        }
    }
    xhttp.open("GET", '/getAdminOrganisations');
    xhttp.send();
}

function buildIntegrationSelect(){
    /** Function for building the integration select dropdown. */
    var integrationsDiv = document.getElementById('integrationsDiv')
    var IDNum = getIdNumforNext('integrationSelect-')
    document.getElementById('settingsErrors').innerHTML = ''

    var containingDiv = document.createElement('div')
    containingDiv.setAttribute('id','integrationSelectDiv-'+String(IDNum))
    containingDiv.style.borderTop = '1px solid rgb(60,74,89)'
    containingDiv.style.padding = '20px'
    integrationsDiv.appendChild(containingDiv)

    var row = document.createElement('div')
    row.classList.add('row')
    containingDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-6')
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-4')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var integrationSelector = document.createElement('select')
    integrationSelector.classList.add('form-control')
    integrationSelector.id = 'integrationSelect-'+String(IDNum)
    col1.appendChild(integrationSelector)

    var integrationOptionTexts = ['None', 'EarthRanger']
    var integrationOptionValues = ['-1', 'earthranger']
    fillSelect(integrationSelector, integrationOptionTexts, integrationOptionValues)

    integrationSelector.value = 'earthranger'

    $('#integrationSelect-'+String(IDNum)).on('change', function() {
        /** Event listener for the integration select dropdown. This will show/hide the relevant integration options. */
        var selected = $(this).val();
        var id = this.id.split('-')[1]
        if (selected == 'earthranger'){
            document.getElementById('earthRangerDiv-'+id).hidden = false;
            document.getElementById('earthRangerErrors-'+id).innerHTML = ''
            document.getElementById('settingsErrors').innerHTML = ''   
        }
        else{
            document.getElementById('earthRangerDiv-'+id).hidden = true;
            document.getElementById('settingsErrors').innerHTML = ''
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
            btnRemove.parentNode.parentNode.parentNode.remove();
            document.getElementById('settingsErrors').innerHTML = ''
        }
    }(IDNum));

    var earthRangerDiv = document.createElement('div')
    earthRangerDiv.setAttribute('id','earthRangerDiv-'+String(IDNum))
    col1.appendChild(earthRangerDiv)

    earthRangerDiv.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
    h5.innerHTML = 'Organisation'
    h5.setAttribute('style','margin-bottom: 2px;')
    earthRangerDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Select the organisation for which to set up the integration.</i>'
    earthRangerDiv.appendChild(h5)

    var row = document.createElement('div')
    row.classList.add('row')
    earthRangerDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

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

    earthRangerDiv.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
    h5.innerHTML = 'EarthRanger API Key'
    h5.setAttribute('style','margin-bottom: 2px;')
    earthRangerDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Enter the API key that will be used to authenticate with EarthRanger.</i>'
    earthRangerDiv.appendChild(h5)

    var row = document.createElement('div')
    row.classList.add('row')
    earthRangerDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-10')
    row.appendChild(col1)

    var earthRangerApiKey = document.createElement('input')
    earthRangerApiKey.setAttribute('type','text')
    earthRangerApiKey.setAttribute('class','form-control')
    earthRangerApiKey.setAttribute('id','earthRangerApiKey-'+String(IDNum))
    earthRangerApiKey.setAttribute('placeholder','Enter API Key')
    col1.appendChild(earthRangerApiKey)

    earthRangerDiv.appendChild(document.createElement('br'))

    var h5 = document.createElement('h5')
    h5.innerHTML = 'EarthRanger Species'
    h5.setAttribute('style','margin-bottom: 2px;')
    earthRangerDiv.appendChild(h5)

    h5 = document.createElement('div')
    h5.setAttribute('style',"font-size: 80%; margin-bottom: 2px")
    h5.innerHTML = '<i>Select all the species of interest for which to receive data from TrapTagger.</i>'
    earthRangerDiv.appendChild(h5)

    var earthRangerSpeciesDiv = document.createElement('div')
    earthRangerSpeciesDiv.setAttribute('id','earthRangerSpeciesDiv-'+String(IDNum))
    earthRangerDiv.appendChild(earthRangerSpeciesDiv)

    buildERSpeciesSelect(IDNum)

    var btnAddSpecies = document.createElement('button')
    btnAddSpecies.setAttribute('class','btn btn-info')
    btnAddSpecies.id = 'btnAddSpecies-'+String(IDNum)
    btnAddSpecies.innerHTML = '+'
    btnAddSpecies.addEventListener('click', function() {
        let id_num = this.id.split('-')[1]
        buildERSpeciesSelect(id_num)
    });

    earthRangerDiv.appendChild(btnAddSpecies)

    var earthRangerErrors = document.createElement('div')
    earthRangerErrors.setAttribute('id','earthRangerErrors-'+String(IDNum))
    earthRangerErrors.setAttribute('style','font-size: 80%; color: #DF691A')
    earthRangerDiv.appendChild(earthRangerErrors)
 
}


function buildERSpeciesSelect(ID){
    /** Function for building the species select dropdown for EarthRanger Integration. */
    var earthRangerSpeciesDiv = document.getElementById('earthRangerSpeciesDiv-'+String(ID))
    var IDNum = getIdNumforNext('speciesSelectorER_'+String(ID)+'-')

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

    if (IDNum > 0) {
        btnRemove = document.createElement('button');
        btnRemove.id = 'btnRemoveSpeciesER_'+String(ID)+'-'+String(IDNum);
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        col3.appendChild(btnRemove);
        btnRemove.addEventListener('click', function(){
            this.parentNode.parentNode.remove();
            document.getElementById('settingsErrors').innerHTML = ''
        });
    }

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
    document.getElementById('settingsErrors').innerHTML = ''
    var valid = validateIntegrationSettings()

    if (valid){
        var integrations = []
        var earth_ranger_integrations = getEarthRangerIntegrations()
        integrations = {
            'earthranger': earth_ranger_integrations
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
                    loadIntegrations();
                }
            }
        }
        xhttp.open("POST", '/saveIntegrations');
        xhttp.send(formData);
    }
}

function getEarthRangerIntegrations(){
    /** Get the EarthRanger integrations from the page.  (New, Edited, Deleted) */
    var editedERIntegrations = []
    var deletedERIntegrations = []
    var newERIntegrations = []
    var integrationSelects = document.querySelectorAll('[id^="integrationSelect-"]')
    for (var i = 0; i < integrationSelects.length; i++){
        var integration = integrationSelects[i].value
        if (integration == 'earthranger'){
            var integrationID = integrationSelects[i].id.split('-')[1]
            var api_key = document.getElementById('earthRangerApiKey-'+String(integrationID)).value
            var org_id = document.getElementById('earthRangerOrganisation-'+String(integrationID)).value
            var earthRangerSpeciesDiv = document.getElementById('earthRangerSpeciesDiv-'+String(integrationID))
            var speciesSelects = earthRangerSpeciesDiv.getElementsByTagName('select')
            var species = []
            for (var j = 0; j < speciesSelects.length; j++){
                label = speciesSelects[j].value
                if (label != '-1' && species.indexOf(label) == -1){
                    species.push(label)
                    if (speciesSelects[j].classList[1] && speciesSelects[j].classList[1].includes('id-')){
                        id = speciesSelects[j].classList[1].split('-')[1]
                        editedERIntegrations.push({'id': id, 'species': label, 'api_key': api_key, 'org_id': org_id})
                    }
                    else{
                        id = -1
                        newERIntegrations.push({'id': id, 'species': label, 'api_key': api_key, 'org_id': org_id})
                    }
                }
            }
        }
    }

    for (var i = 0; i < globalERIntegrations.length; i++){
        var found = false
        for (var j = 0; j < editedERIntegrations.length; j++){
            if (globalERIntegrations[i].id == editedERIntegrations[j].id){
                found = true
                if (globalERIntegrations[i].species == editedERIntegrations[j].species && globalERIntegrations[i].api_key == editedERIntegrations[j].api_key  && globalERIntegrations[i].org_id == editedERIntegrations[j].org_id){
                    editedERIntegrations.splice(j,1)
                }
            }
        }
        if (!found){
            deletedERIntegrations.push(globalERIntegrations[i])
        }
    }

    return {'new': newERIntegrations, 'edited': editedERIntegrations, 'deleted': deletedERIntegrations}
}


function validateIntegrationSettings(){
    /** Function for validating the integration settings. */
    var valid = true
    var api_keys_org_ids = []

    var integrationSelects = document.querySelectorAll('[id^="integrationSelect-"]')
    for (var i = 0; i < integrationSelects.length; i++){
        var integration = integrationSelects[i].value
        var dupSpecies = false
        if (integration == 'earthranger'){
            var errorMessages = ''
            var integrationID = integrationSelects[i].id.split('-')[1]
            var api_key = document.getElementById('earthRangerApiKey-'+String(integrationID)).value
            var org_id = document.getElementById('earthRangerOrganisation-'+String(integrationID)).value

            if (api_key == ''){
                valid = false
                errorMessages += 'EarthRanger API Key is required. '
            }
            else if (org_id == '-1' || org_id == ''){
                valid = false
                errorMessages += 'Organisation is required. '
            }
            else {
                api_org = api_key + '-' + org_id
                if (api_keys_org_ids.indexOf(api_org) == -1){
                    api_keys_org_ids.push(api_org)
                }
                else{
                    valid = false
                    errorMessages += 'EarthRanger API Key and Organisation must be unique for each integration. '
                }
            }

            var earthRangerSpeciesDiv = document.getElementById('earthRangerSpeciesDiv-'+String(integrationID))
            var speciesSelects = earthRangerSpeciesDiv.getElementsByTagName('select')
            var species = []

            for (var j = 0; j < speciesSelects.length; j++){
                label = speciesSelects[j].value
                if (label != '-1' && species.indexOf(label) == -1){
                    species.push(label)
                }
                else if (label != '-1' && species.indexOf(label) != -1){
                    dupSpecies = true
                }
            }

            if (species.length == 0){
                valid = false
                errorMessages += 'At least one species must be selected. '
            }
            
            if (dupSpecies){
                valid = false
                errorMessages += 'Species must be unique for each integration. '
            }

            document.getElementById('earthRangerErrors-'+String(integrationID)).innerHTML = errorMessages
        }
   
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
        buildERSpeciesSelect(IDNum)
        var speciesSelect = document.getElementById('speciesSelectorER_'+String(IDNum)+'-'+i.toString())
        speciesSelect.value = species[i]
        speciesSelect.classList.add('id-'+ids[i])
        globalERIntegrations.push({'id': ids[i], 'species': species[i], 'api_key': api_key, 'org_id': organisation})
    }
}

function loadIntegrations(){
    /** Function for loading the user's integrations from the database. */
    globalERIntegrations = []
    var integrationsDiv = document.getElementById('integrationsDiv')
    while (integrationsDiv.firstChild) {
        integrationsDiv.removeChild(integrationsDiv.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            // console.log(reply)
            var integrations = reply.integrations
            for (let i = 0; i < integrations.length; i++){
                buildIntegrationSelect()
                var integrationSelect = document.getElementById('integrationSelect-'+i.toString())
                integrationSelect.value = integrations[i].integration
                integrationSelect.dispatchEvent(new Event('change'));
                if (integrations[i].integration == 'earthranger'){
                    loadEarthRangerIntegration(i, integrations[i].api_key, integrations[i].species, integrations[i].ids, integrations[i].organisation)
                }
            }
        }
    }
    xhttp.open("GET", '/getIntegrations');
    xhttp.send();
}

function openSettingsTab(evt, tabName) {
    /** Opens the permissions tab */

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
        getAccountInfo()
    }
    else if (tabName == 'baseIntegrationsTab') {
        getLabels();
        getOrganisations();
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

function onload(){
    /**Function for initialising the page on load.*/
    document.getElementById('openAccountTab').click();
}

window.addEventListener('load', onload, false);

