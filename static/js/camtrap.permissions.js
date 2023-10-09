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

const modalDetailedAccess = $('#modalDetailedAccess');
const modalAlert = $('#modalAlert');
const confirmationModal = $('#confirmationModal');
const modalInvite = $('#modalInvite');
const modalShareData = $('#modalShareData');
const default_access  = {0: 'Worker', 1: 'Hidden', 2: 'Read', 3: 'Write'}
const access_slider_values = {'worker': 0, 'hidden': 1, 'read': 2, 'write': 3}

var selectedUser = null
var selectedOrganisation = null
var selectedSurvey = null
var selectedSurveyShare = null
var tabActive = null
var globalSurveys = []
var globalOrganisations = []
var sharingType = null
var globalDetailedAccess = []


function openPermissionsTab(evt, tabName) {
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

    if (tabName == 'baseUserTab') {
        document.getElementById('btnPermissions').innerHTML = 'Invite User';
        getUsers();
    }
    else if (tabName == 'baseDataSharingTab') {
        document.getElementById('btnPermissions').innerHTML = 'Share Surveys';
        getSharedData();
        getReceivedData();
    }

}

function buildUserTable(users) {
    /**Builds the user table for the user tab.*/
    var usersDiv = document.getElementById('usersDiv')
    while (usersDiv.firstChild) {
        usersDiv.removeChild(usersDiv.firstChild);
    }

    var userTable = document.createElement('table');
    userTable.id = 'userTable';
    userTable.classList.add('table')
    userTable.classList.add('table-bordered')
    userTable.classList.add('table-striped')
    userTable.classList.add('table-hover')
    userTable.style.borderCollapse = 'collapse';
    usersDiv.appendChild(userTable);

    var userTableHead = document.createElement('thead');
    userTable.appendChild(userTableHead);

    var userTableHeadRow = document.createElement('tr');
    userTableHead.appendChild(userTableHeadRow);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Username';
    userTableHeadRowHeader.setAttribute('width','15%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Email';
    userTableHeadRowHeader.setAttribute('width','15%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Default Access';
    userTableHeadRowHeader.setAttribute('width','25%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Job Access';
    userTableHeadRowHeader.setAttribute('width','10%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Survey Creation';
    userTableHeadRowHeader.setAttribute('width','9%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Survey Deletion';
    userTableHeadRowHeader.setAttribute('width','9%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Detailed Access';
    userTableHeadRowHeader.setAttribute('width','9%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Remove';
    userTableHeadRowHeader.setAttribute('width','9%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);


    var userTableBody = document.createElement('tbody');
    userTable.appendChild(userTableBody);

    for (let i = 0; i < users.length; i++) {
        var userTableBodyRow = document.createElement('tr');
        userTableBody.appendChild(userTableBodyRow);

        // Username
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRowData.innerText = users[i].username;
        userTableBodyRow.appendChild(userTableBodyRowData);

        // Email
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRowData.innerText = users[i].email;
        userTableBodyRow.appendChild(userTableBodyRowData);

        // Default Access
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('class','text-center')
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRow.appendChild(userTableBodyRowData);
        
        var row = document.createElement('div')
        row.classList.add('row');
        userTableBodyRowData.appendChild(row)
        
        var col1 = document.createElement('div')
        col1.classList.add('col-lg-12');access_slider_values
        row.appendChild(col1)

        var slider = document.createElement('input');
        slider.setAttribute("type", "range");
        slider.setAttribute("class", "custom-range");
        slider.setAttribute('style','width: 85%;')
        slider.setAttribute("min", "0");
        slider.setAttribute("max", "3");
        slider.setAttribute("step", "1");
        slider.setAttribute("id", "defaultAccessSlider-" + users[i].id);
        slider.setAttribute("list", "accessLevels");
        slider.value = access_slider_values[users[i].default]
        col1.appendChild(slider);

        var row = document.createElement('div')
        row.classList.add('row');
        userTableBodyRowData.appendChild(row)

        var col0 = document.createElement('div')
        col0.classList.add('col-lg-3');
        col0.setAttribute('style','vertical-align: middle; text-align: center;')
        col0.innerText = default_access[0];
        row.appendChild(col0)

        var col1 = document.createElement('div')
        col1.classList.add('col-lg-3');
        col1.setAttribute('style','vertical-align: middle; text-align: center;')
        col1.innerText = default_access[1];
        row.appendChild(col1)

        var col2 = document.createElement('div')
        col2.classList.add('col-lg-3');
        col2.setAttribute('style','vertical-align: middle; text-align: center;')
        col2.innerText = default_access[2];
        row.appendChild(col2)

        var col3 = document.createElement('div')
        col3.classList.add('col-lg-3');
        col3.setAttribute('style','vertical-align: middle; text-align: center;')
        col3.innerText = default_access[3];
        row.appendChild(col3)

        slider.addEventListener('change', function (userID){
            return function() {
                selectedUser = userID
                var permission_type = 'default'
                var slider_value = this.value
                var permission_value = default_access[slider_value].toLowerCase()   

                savePermissions(permission_type, permission_value)
            };
        }(users[i].id));

        // Worker Access
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('class','text-center')
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRow.appendChild(userTableBodyRowData);

        var toggle = document.createElement('label');
        toggle.classList.add('switch');
        userTableBodyRowData.appendChild(toggle);

        var checkbox = document.createElement('input');
        checkbox.setAttribute("type", "checkbox");
        checkbox.id = 'userWorkerAccess-' + users[i].id;
        checkbox.checked = users[i].annotation
        toggle.appendChild(checkbox);

        var slider = document.createElement('span');
        slider.classList.add('slider');
        slider.classList.add('round');
        toggle.appendChild(slider);

        checkbox.addEventListener('change', function (userID){
            return function() {
                selectedUser = userID
                var permission_type = 'annotation'
                var permission_value = this.checked ? '1' : '0'
                savePermissions(permission_type, permission_value)
            };
        }(users[i].id));

        // Survey Creation
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('class','text-center')
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRow.appendChild(userTableBodyRowData);

        var toggle = document.createElement('label');
        toggle.classList.add('switch');
        userTableBodyRowData.appendChild(toggle);

        var checkbox = document.createElement('input');
        checkbox.setAttribute("type", "checkbox");
        checkbox.id = 'userSurveyCreation-' + users[i].id;
        checkbox.checked = users[i].create
        toggle.appendChild(checkbox);

        var slider = document.createElement('span');
        slider.classList.add('slider');
        slider.classList.add('round');
        toggle.appendChild(slider);

        checkbox.addEventListener('change', function (userID){
            return function() {
                selectedUser = userID
                var permission_type = 'create'
                var permission_value = this.checked ? '1' : '0'
                savePermissions(permission_type, permission_value)
            };
        }(users[i].id));

        // Survey Deletion
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('class','text-center')
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRow.appendChild(userTableBodyRowData);

        var toggle = document.createElement('label');
        toggle.classList.add('switch');
        userTableBodyRowData.appendChild(toggle);

        var checkbox = document.createElement('input');
        checkbox.setAttribute("type", "checkbox");
        checkbox.id = 'userSurveyDeletion-' + users[i].id;
        checkbox.checked = users[i].delete
        toggle.appendChild(checkbox);

        var slider = document.createElement('span');
        slider.classList.add('slider');
        slider.classList.add('round');
        toggle.appendChild(slider);

        checkbox.addEventListener('change', function (userID){
            return function() {
                selectedUser = userID
                var permission_type = 'delete'
                var permission_value = this.checked ? '1' : '0'
                savePermissions(permission_type, permission_value)
            };
        }(users[i].id));

        // Detailed Access
        userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('class','text-center')
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRow.appendChild(userTableBodyRowData);

        var button = document.createElement('button');
        button.setAttribute("class",'btn btn-primary btn-sm btn-block')
        button.innerHTML = 'Edit';
        button.id = 'btnEditUser-' + users[i].id;
        userTableBodyRowData.appendChild(button);

        button.addEventListener('click', function (userId, userName){
            return function() {
                selectedUser = userId
                openDetailedAccessModal(userId, userName);
            };
        }(users[i].id, users[i].username));

        // Remove
        var userTableBodyRowData = document.createElement('td');
        userTableBodyRowData.setAttribute('class','text-center')
        userTableBodyRowData.setAttribute('style','vertical-align: middle;')
        userTableBodyRow.appendChild(userTableBodyRowData);

        var button = document.createElement('button');
        button.setAttribute("class",'btn btn-danger btn-sm btn-block')
        button.innerHTML = 'Remove';
        button.id = 'btnRemoveUser-' + users[i].id;
        userTableBodyRowData.appendChild(button);

        button.addEventListener('click', function (userId, userName){
            return function() {
                selectedUser = userId
                document.getElementById('confirmationText').innerText = 'User ' + userName + ' will be removed from your organisation. Do you wish to continue?'
                confirmationModal.modal('show');
            }
        }(users[i].id, users[i].username));

        if (users[i].root_user == true) {
            document.getElementById('btnRemoveUser-' + users[i].id).disabled = true
        }

    }
}

function openDetailedAccessModal(id, username){
    /**Opens the detailed access modal.*/
    document.getElementById('modalDetailedAccessTitle').innerText = 'Detailed Access: ' + username;

    var colTitleDiv = document.getElementById('colTitleDiv')
    while (colTitleDiv.firstChild) {
        colTitleDiv.removeChild(colTitleDiv.firstChild);
    }

    if (document.getElementById('defaultAccessSlider-' + id).value == access_slider_values['worker']) {
        var colTitle = document.createElement('div')
        colTitle.classList.add('col-lg-4')
        colTitle.innerText = 'Survey:'
        colTitleDiv.appendChild(colTitle)

        var colTitle = document.createElement('div')
        colTitle.classList.add('col-lg-8')
        colTitle.innerText = 'Job Access:'
        colTitleDiv.appendChild(colTitle)

        worker = true
    }
    else{
        var colTitle = document.createElement('div')
        colTitle.classList.add('col-lg-4')
        colTitle.innerText = 'Survey:'
        colTitleDiv.appendChild(colTitle)

        var colTitle = document.createElement('div')
        colTitle.classList.add('col-lg-5')
        colTitle.innerText = 'Access:'
        colTitleDiv.appendChild(colTitle)

        var colTitle = document.createElement('div')
        colTitle.classList.add('col-lg-3')
        colTitle.innerText = 'Job Access:'
        colTitleDiv.appendChild(colTitle)

        worker = false
    }

    getDetailedAccess(worker)
    modalDetailedAccess.modal('show');
}

function getUsers() {
    /**Gets the user users from the server.*/
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            buildUserTable(reply.users);
        }
    };
    xhttp.open("GET", "/getUsers");
    xhttp.send();
}


function getSharedData(){
    /**Gets the shared data from the server.*/
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            buildSharedDataTable(reply.shared_data);          
        }
    }
    xhttp.open("GET", '/getSharedData');
    xhttp.send();
}

function buildSharedDataTable(sharedData) {
    /** Builds the data sharing table for the data sharing tab. */
    var dataSharingDiv = document.getElementById('dataSharingDiv')
    while (dataSharingDiv.firstChild) {
        dataSharingDiv.removeChild(dataSharingDiv.firstChild);
    }

    var dataSharingTable = document.createElement('table');
    dataSharingTable.id = 'dataSharingTable';
    dataSharingTable.classList.add('table')
    dataSharingTable.classList.add('table-bordered')
    dataSharingTable.classList.add('table-striped')
    dataSharingTable.classList.add('table-hover')
    dataSharingTable.style.borderCollapse = 'collapse';
    dataSharingDiv.appendChild(dataSharingTable);


    var dataSharingTableHead = document.createElement('thead');
    dataSharingTable.appendChild(dataSharingTableHead);

    var dataSharingTableHeadRow = document.createElement('tr');
    dataSharingTableHead.appendChild(dataSharingTableHeadRow);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Organisation';
    dataSharingTableHeadRowHeader.setAttribute('width','20%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Email';
    dataSharingTableHeadRowHeader.setAttribute('width','20%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Surveys';
    dataSharingTableHeadRowHeader.setAttribute('width','20%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Default Access';
    dataSharingTableHeadRowHeader.setAttribute('width','20%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Remove';
    dataSharingTableHeadRowHeader.setAttribute('width','20%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);


    for (let i = 0; i < sharedData.length; i++) {
        var surveys = sharedData[i].surveys
        var dataSharingTableBody = document.createElement('tbody');
        dataSharingTable.appendChild(dataSharingTableBody);

        for (let j = 0; j < surveys.length; j++) {
            var dataSharingTableBodyRow = document.createElement('tr');
            dataSharingTableBody.appendChild(dataSharingTableBodyRow);

            if (j == 0) {
                // Organisation
                var dataSharingTableBodyRowData = document.createElement('td');
                dataSharingTableBodyRowData.setAttribute('style','vertical-align: middle;')
                dataSharingTableBodyRowData.innerText = sharedData[i].organisation;
                dataSharingTableBodyRowData.rowSpan = sharedData[i].surveys.length;
                dataSharingTableBodyRow.appendChild(dataSharingTableBodyRowData);

                // Email
                var dataSharingTableBodyRowData = document.createElement('td');
                dataSharingTableBodyRowData.setAttribute('style','vertical-align: middle;')
                dataSharingTableBodyRowData.rowSpan = sharedData[i].surveys.length;
                dataSharingTableBodyRowData.innerText = sharedData[i].email;
                dataSharingTableBodyRow.appendChild(dataSharingTableBodyRowData);

            }

            // Shared Surveys
            var dataSharingTableBodyRowData = document.createElement('td');
            dataSharingTableBodyRowData.setAttribute('style','vertical-align: middle;')
            dataSharingTableBodyRowData.innerText = surveys[j].name;
            dataSharingTableBodyRow.appendChild(dataSharingTableBodyRowData);

            // Default Access
            var dataSharingTableBodyRowData = document.createElement('td');
            dataSharingTableBodyRowData.setAttribute('class','text-center')
            dataSharingTableBodyRowData.setAttribute('style','vertical-align: middle;')
            dataSharingTableBodyRow.appendChild(dataSharingTableBodyRowData);
            
            var row = document.createElement('div')
            row.classList.add('row');
            dataSharingTableBodyRowData.appendChild(row)
            
            var col1 = document.createElement('div')
            col1.classList.add('col-lg-12');
            row.appendChild(col1)
    
            var slider = document.createElement('input');
            slider.setAttribute("type", "range");
            slider.setAttribute("class", "custom-range");
            slider.setAttribute('style','width: 90%;')
            slider.setAttribute("min", "1");
            slider.setAttribute("max", "3");
            slider.setAttribute("step", "1");
            slider.setAttribute("id", "defaultAccessSlider-" + surveys[j].ss_id); 
            slider.setAttribute("list", "accessLevels");
            slider.value = access_slider_values[surveys[j].permission]
            col1.appendChild(slider);
    
            var row = document.createElement('div')
            row.classList.add('row');
            dataSharingTableBodyRowData.appendChild(row)
    
            var col0 = document.createElement('div')
            col0.classList.add('col-lg-4');
            col0.setAttribute('style','vertical-align: middle; text-align: left;')
            col0.innerText = default_access[1];
            row.appendChild(col0)
    
            var col1 = document.createElement('div')
            col1.classList.add('col-lg-4');
            col1.setAttribute('style','vertical-align: middle; text-align: center;')
            col1.innerText = default_access[2];
            row.appendChild(col1)
    
            var col2 = document.createElement('div')
            col2.classList.add('col-lg-4');
            col2.setAttribute('style','vertical-align: middle; text-align: right;')
            col2.innerText = default_access[3];
            row.appendChild(col2)

            slider.addEventListener('change', function (ssID){
                return function() {
                    selectedSurveyShare = ssID
                    var slider_value = this.value
                    var permission_value = default_access[slider_value].toLowerCase()
                    saveSharedSurveyPermissions(permission_value)
                };
            }(surveys[j].ss_id));

            // Remove
            var dataSharingTableBodyRowData = document.createElement('td');
            dataSharingTableBodyRowData.setAttribute('class','text-center')
            dataSharingTableBodyRowData.setAttribute('style','vertical-align: middle;')
            dataSharingTableBodyRow.appendChild(dataSharingTableBodyRowData);

            var button = document.createElement('button');
            button.setAttribute("class",'btn btn-danger btn-sm btn-block')
            button.innerHTML = 'Remove';
            button.id = 'btnRemoveSharedSurveys-' + surveys[j].ss_id;
            dataSharingTableBodyRowData.appendChild(button);

            button.addEventListener('click', function (ssID, orgName, surveyName){
                return function() {
                    selectedSurveyShare = ssID
                    sharingType = 'shared'
                    document.getElementById('confirmationText').innerText = 'Survey ' + surveyName + ' will no longer be shared with ' + orgName + '. Do you wish to continue?'
                    confirmationModal.modal('show');
                };
            }(surveys[j].ss_id, sharedData[i].organisation, surveys[j].name));

        }
    }
}

function getDetailedAccess(worker=false){
    /**Gets the detailed access from the server.*/

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)      

            var detailedAccessDiv = document.getElementById('detailedAccessDiv')
            while (detailedAccessDiv.firstChild) {
                detailedAccessDiv.removeChild(detailedAccessDiv.firstChild);
            } 
            globalDetailedAccess = reply.detailed_access
            for (let i = 0; i < reply.detailed_access.length; i++){
                buildDetailedAccessRow()
                document.getElementById('detailedSurveySelect-'+i.toString()).value = reply.detailed_access[i].survey_id
                document.getElementById('detailedSurveySelect-'+i.toString()).classList.add('id-'+reply.detailed_access[i].id)
                document.getElementById('detailedWorkerAccess-'+i.toString()).checked = reply.detailed_access[i].annotation
                document.getElementById('detailedWorkerAccess-'+i.toString()).classList.add('id-'+reply.detailed_access[i].id)
                if (!worker) {
                    document.getElementById('detailedAccessSlider-'+i.toString()).value = access_slider_values[reply.detailed_access[i].permission]
                    document.getElementById('detailedAccessSlider-'+i.toString()).classList.add('id-'+reply.detailed_access[i].id)
                }
                
            }
        }
    }
    xhttp.open("GET", '/getDetailedAccess/'+selectedUser.toString());
    xhttp.send();
}

function buildDetailedAccessRow(){
    /** Builds a row for the detailed access modal. */
    var detailedAccessDiv = document.getElementById('detailedAccessDiv')
    var IDNum = getIdNumforNext('detailedSurveySelect-')

    var worker = false
    if (document.getElementById('defaultAccessSlider-' + selectedUser).value == access_slider_values['worker']) {
        worker = true
    }

    var row = document.createElement('div')
    row.classList.add('row')
    detailedAccessDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    col1.style.display = 'flex'
    col1.style.alignItems = 'center'
    col1.style.justifyContent = 'center'
    row.appendChild(col1)
    
    if (!worker) { 
        var col2 = document.createElement('div')
        col2.classList.add('col-lg-5')
        // col2.style.display = 'flex'
        // col2.style.alignItems = 'center'
        // col2.style.justifyContent = 'center'
        row.appendChild(col2)
    }

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

    // Survey
    var survey = document.createElement('select');
    survey.classList.add('form-control')
    survey.id = 'detailedSurveySelect-' + IDNum;
    col1.appendChild(survey);

    var optionTexts = ['None']
    var optionValues = ["-1"]
    for (let i=0;i<globalSurveys.length;i++) {
        optionTexts.push(globalSurveys[i][1])
        optionValues.push(globalSurveys[i][0])
    }
    fillSelect(survey, optionTexts, optionValues)

    // Default Access
    if (!worker) {
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
        slider.setAttribute("id", "detailedAccessSlider-" + IDNum);
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
    }
    
    // Job Access
    var toggleDiv = document.createElement('div');
    toggleDiv.classList.add('text-center');
    toggleDiv.style.verticalAlign = 'middle';
    col3.appendChild(toggleDiv);

    var toggle = document.createElement('label');
    toggle.classList.add('switch');
    toggleDiv.appendChild(toggle);

    var checkbox = document.createElement('input');
    checkbox.setAttribute("type", "checkbox");
    checkbox.id = 'detailedWorkerAccess-' + IDNum;
    toggle.appendChild(checkbox);

    var slider = document.createElement('span');
    slider.classList.add('slider');
    slider.classList.add('round');
    toggle.appendChild(slider);

    // Remove
    var button = document.createElement('button');
    button.setAttribute("class",'btn btn-info')
    button.innerHTML = '&times;';
    button.id = 'btnRemoveDetailedAccess-' + IDNum;
    col4.appendChild(button);

    button.addEventListener('click', function () {
        this.parentNode.parentNode.remove()
    });

}

function getReceivedData(){
    /**Gets the received surveys from the server.*/
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)

            buildReceivedDataTable(reply.received_surveys)
        }
    }
    xhttp.open("GET", '/getReceivedData');
    xhttp.send();
}

function buildReceivedDataTable(receivedData) {
    var receivedDataDiv = document.getElementById('receivedDataDiv')
    while (receivedDataDiv.firstChild) {
        receivedDataDiv.removeChild(receivedDataDiv.firstChild);
    }

    var receivedDataTable = document.createElement('table');
    receivedDataTable.id = 'receivedDataTable';
    receivedDataTable.classList.add('table')
    receivedDataTable.classList.add('table-bordered')
    receivedDataTable.classList.add('table-striped')
    receivedDataTable.classList.add('table-hover')
    receivedDataTable.style.borderCollapse = 'collapse';
    receivedDataDiv.appendChild(receivedDataTable);

    var receivedDataTableHead = document.createElement('thead');
    receivedDataTable.appendChild(receivedDataTableHead);

    var receivedDataTableHeadRow = document.createElement('tr');
    receivedDataTableHead.appendChild(receivedDataTableHeadRow);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Organisation';
    receivedDataTableHeadRowHeader.setAttribute('width','20%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Email';
    receivedDataTableHeadRowHeader.setAttribute('width','20%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Surveys';
    receivedDataTableHeadRowHeader.setAttribute('width','20%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Default Access';
    receivedDataTableHeadRowHeader.setAttribute('width','20%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Remove';
    receivedDataTableHeadRowHeader.setAttribute('width','20%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    for (let i = 0; i < receivedData.length; i++) {
        var receivedDataTableBody = document.createElement('tbody');
        receivedDataTable.appendChild(receivedDataTableBody);
        
        surveys = receivedData[i].surveys
        for (let j = 0; j < surveys.length; j++) {
            var receivedDataTableBodyRow = document.createElement('tr');
            receivedDataTableBody.appendChild(receivedDataTableBodyRow);

            if (j == 0) {

                // Organisation
                var receivedDataTableBodyRowData = document.createElement('td');
                receivedDataTableBodyRowData.setAttribute('style','vertical-align: middle;')
                receivedDataTableBodyRowData.innerText = receivedData[i].organisation;
                receivedDataTableBodyRowData.rowSpan = receivedData[i].surveys.length;
                receivedDataTableBodyRow.appendChild(receivedDataTableBodyRowData);

                // Email
                var receivedDataTableBodyRowData = document.createElement('td');
                receivedDataTableBodyRowData.setAttribute('style','vertical-align: middle;')
                receivedDataTableBodyRowData.innerText = receivedData[i].email;
                receivedDataTableBodyRowData.rowSpan = receivedData[i].surveys.length;
                receivedDataTableBodyRow.appendChild(receivedDataTableBodyRowData);

            }

            // Survey
            var receivedDataTableBodyRowData = document.createElement('td');
            receivedDataTableBodyRowData.setAttribute('style','vertical-align: middle;')
            receivedDataTableBodyRowData.innerText = surveys[j].name;
            receivedDataTableBodyRow.appendChild(receivedDataTableBodyRowData);

            // Default Access
            var receivedDataTableBodyRowData = document.createElement('td');
            receivedDataTableBodyRowData.setAttribute('class','vertical-align: middle;')
            receivedDataTableBodyRowData.innerText = surveys[j].permission.charAt(0).toUpperCase() + surveys[j].permission.slice(1);
            receivedDataTableBodyRow.appendChild(receivedDataTableBodyRowData);

            // Remove
            var receivedDataTableBodyRowData = document.createElement('td');
            receivedDataTableBodyRowData.setAttribute('style','vertical-align: middle;')
            receivedDataTableBodyRow.appendChild(receivedDataTableBodyRowData);

            var button = document.createElement('button');
            button.setAttribute("class",'btn btn-danger btn-sm btn-block')
            button.innerHTML = 'Remove';
            button.id = 'btnRemoveReceivedSurvey-' + surveys[j].ss_id;
            receivedDataTableBodyRowData.appendChild(button);

            button.addEventListener('click', function (ssID, orgName, surveyName){
                return function() {
                    selectedSurveyShare = ssID
                    sharingType = 'received'
                    document.getElementById('confirmationText').innerText = 'Survey ' + surveyName + ' from ' + orgName + ' will no longer be shared with you. Do you wish to continue?'
                    confirmationModal.modal('show');
                };
            }(surveys[j].ss_id, receivedData[i].organisation, surveys[j].name));

        }
    }
}

function getSurveys(){
    /** Gets the surveys for the current user */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            console.log(surveys)
            globalSurveys = surveys
        }
    }
    xhttp.open("GET", '/getSurveys');
    xhttp.send();
}

function removeFromTable(){
    /** Removes the selected surveys from the selected organisation. */

    if (tabActive == 'baseUserTab') {
        // Remove user
        removeUserFromOrganisation()
    }
    else{
        // Remove shared survey
        removeSharedSurvey()
    }
}

function savePermissions(permission_type, permission_value){
    /**Saves the permissions to the server.*/

    var formData = new FormData();
    formData.append('permission_type', JSON.stringify(permission_type));
    formData.append('permission_value', JSON.stringify(permission_value));
    formData.append('user_id', JSON.stringify(selectedUser));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            console.log(reply)
        }
    }
    xhttp.open("POST", '/savePermissions')
    xhttp.send(formData);
}

function saveSharedSurveyPermissions(permission_value){
    /**Saves the shared survey permissions to the server.*/

    var formData = new FormData();
    formData.append('survey_share_id', JSON.stringify(selectedSurveyShare));
    formData.append('permission_value', JSON.stringify(permission_value));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (reply.status == 'SUCCESS') {
                document.getElementById('dataSharingErrors').innerHTML = ''
                getSharedData()
            }
            else{
                document.getElementById('dataSharingErrors').innerHTML = reply.message
            }
        }
    }
    xhttp.open("POST", '/saveSharedSurveyPermissions')
    xhttp.send(formData);
}


$('#btnPermissions').click(function(){
    /**Function for the permissions button. */
    if (tabActive == 'baseUserTab') {
        openInvite()
    }
    else{
        openShareData()
    }
});

function openInvite() {
    document.getElementById('inviteStatus').innerHTML = ''
    modalInvite.modal({keyboard: true});
}

function sendInvite() {
    inviteEmail = document.getElementById('inviteEmail').value

    var formData = new FormData()
    formData.append("inviteEmail", inviteEmail)

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            document.getElementById('inviteStatus').innerHTML = reply.message
        }
    }
    xhttp.open("POST", "/inviteWorker");
    xhttp.send(formData);
}

function openShareData() {
    /**Opens the share data modal. */

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            globalOrganisations = reply.organisations

            document.getElementById('shareDataErrors').innerHTML = ''
            document.getElementById('inviteOrganisationStatus').innerHTML = ''
            document.getElementById('organisationEmail').value = ''

            var shareDataDiv = document.getElementById('shareDataDiv')
            while (shareDataDiv.firstChild) {
                shareDataDiv.removeChild(shareDataDiv.firstChild);
            }

            buildShareDataRow()

            modalShareData.modal({keyboard: true});
        }
    }
    xhttp.open("GET", "/getLinkedOrganisations");
    xhttp.send();
}

function buildShareDataRow() {
    /**  Builds a row for the share data modal. */  
    var shareDataDiv = document.getElementById('shareDataDiv')
    var IDNum = getIdNumforNext('shareSurveySelect-')

    var row = document.createElement('div')
    row.classList.add('row')
    shareDataDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    col1.style.display = 'flex'
    col1.style.alignItems = 'center'
    col1.style.justifyContent = 'center'
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    col2.style.display = 'flex'
    col2.style.alignItems = 'center'
    col2.style.justifyContent = 'center'
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    var col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    var organisation = document.createElement('select');
    organisation.classList.add('form-control')
    organisation.id = 'organisationSelect-' + IDNum;
    col1.appendChild(organisation);

    var optionTexts = ['None']
    var optionValues = ["-1"]

    for (let i=0;i<globalOrganisations.length;i++) {
        optionTexts.push(globalOrganisations[i].name)
        optionValues.push(globalOrganisations[i].id)
    }

    fillSelect(organisation, optionTexts, optionValues)

    var survey = document.createElement('select');
    survey.classList.add('form-control')
    survey.id = 'shareSurveySelect-' + IDNum;
    col2.appendChild(survey);

    var optionTexts = ['None']
    var optionValues = ["-1"]

    for (let i=0;i<globalSurveys.length;i++) {
        optionTexts.push(globalSurveys[i][1])
        optionValues.push(globalSurveys[i][0])
    }

    fillSelect(survey, optionTexts, optionValues)

    var defaultDiv = document.createElement('div');
    defaultDiv.setAttribute('class','text-center')
    defaultDiv.setAttribute('style','vertical-align: middle;')
    col3.appendChild(defaultDiv);    
    
    var row = document.createElement('div')
    row.classList.add('row');
    defaultDiv.appendChild(row)
    
    var col1 = document.createElement('div')
    col1.classList.add('col-lg-12');
    row.appendChild(col1)

    var slider = document.createElement('input');
    slider.setAttribute("type", "range");
    slider.setAttribute("class", "custom-range");
    slider.setAttribute('style','width: 90%;')
    slider.setAttribute("min", "1");
    slider.setAttribute("max", "3");
    slider.setAttribute("step", "1");
    slider.setAttribute("id", "shareAccessSlider-" + IDNum);
    col1.appendChild(slider);

    var row = document.createElement('div')
    row.classList.add('row');
    defaultDiv.appendChild(row)

    var col0 = document.createElement('div')
    col0.classList.add('col-lg-4');
    col0.setAttribute('style','vertical-align: middle; text-align: left;')
    col0.innerText = 'Hidden';
    row.appendChild(col0)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-4');
    col1.setAttribute('style','vertical-align: middle; text-align: center;')
    col1.innerText = 'Read';
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-4');
    col2.setAttribute('style','vertical-align: middle; text-align: right;')
    col2.innerText = 'Write';
    row.appendChild(col2)

    var button = document.createElement('button');
    button.setAttribute("class",'btn btn-info')
    button.innerHTML = '&times;';
    button.id = 'btnRemoveShareData-' + IDNum;
    col4.appendChild(button);

    button.addEventListener('click', function () {
        this.parentNode.parentNode.remove()
    });
}

function sendOrganisationInvite() {
    /** Sends an organisation invite to the server. */

    var organisationEmail = document.getElementById('organisationEmail').value
     
    if (organisationEmail == '') {
        document.getElementById('inviteOrganisationStatus').innerHTML = 'Please enter an email address.'
    }
    else{
        // Validate email address
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organisationEmail) == false) {
            document.getElementById('inviteOrganisationStatus').innerHTML = 'Please enter a valid email address.'
        }
        else{
            document.getElementById('inviteOrganisationStatus').innerHTML  = ''

            var formData = new FormData()
            formData.append("organisation_email", JSON.stringify(organisationEmail))
    
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    document.getElementById('inviteOrganisationStatus').innerHTML = reply.message
                }
            }
            xhttp.open("POST", "/inviteOrganisation");
            xhttp.send(formData);
        }
    }
}

function shareSurveys(){
    /** Shares the selected surveys with the selected organisation. */

    var organisationSelects = document.querySelectorAll('[id^="organisationSelect-"]')
    var surveySelects = document.querySelectorAll('[id^="shareSurveySelect-"]')
    var accessSliders = document.querySelectorAll('[id^="shareAccessSlider-"]')

    var sharedData = []

    for (let i=0;i<organisationSelects.length;i++) {
        if (organisationSelects[i].value != -1 && surveySelects[i].value != -1) {
            sharedData.push({
                'organisation_id': organisationSelects[i].value,
                'survey_id': surveySelects[i].value,
                'permission': default_access[accessSliders[i].value].toLowerCase()
            })
        }
    }

    var valid = validateShareData(sharedData)

    if (valid){

        var formData = new FormData();
        formData.append('shared_data', JSON.stringify(sharedData));

        console.log(sharedData)

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)

                if (reply.status == 'SUCCESS') {
                    document.getElementById('shareDataErrors').innerHTML = ''
                    modalShareData.modal('hide');
                    getSharedData()
                }
                else{
                    document.getElementById('shareDataErrors').innerHTML = reply.message
                }
            }
        }
        xhttp.open("POST", '/shareSurveys');
        xhttp.send(formData);
    }
}

function validateShareData(sharedData){
    /** Validates the shared data. */

    var valid = true
    var emptyData = false
    var duplicateData = false

    var duplicates = []

    if (sharedData.length == 0) {
        emptyData = true
    }
    else{
        for (let i = 0; i < sharedData.length; i++) {
            value = sharedData[i].organisation_id.toString() + '-' + sharedData[i].survey_id.toString()
            if (duplicates.indexOf(value) == -1) {
                duplicates.push(value)
            }
            else{
                duplicateData = true
            }
        }
    }

    if (emptyData) {
        document.getElementById('shareDataErrors').innerHTML = 'Please select an organisation and a survey.'
        valid = false
    }
    else if (duplicateData) {
        document.getElementById('shareDataErrors').innerHTML = 'Please do not share the same survey with the same organisation more than once.'
        valid = false
    }
    else{
        document.getElementById('shareDataErrors').innerHTML = ''
    }

    return valid
}

function saveDetailedAccess(){
/** Saves the detailed access for the user */
    var valid, detailed_access = getDetailedAccessForSave()

    if (valid) {
        document.getElementById('detailedAccessErrors').innerHTML = 'Please do not select the same survey more than once.'
    }
    else{
        document.getElementById('detailedAccessErrors').innerHTML = ''

        var formData = new FormData();
        formData.append('detailed_access', JSON.stringify(detailed_access));
        formData.append('user_id', JSON.stringify(selectedUser));

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                document.getElementById('detailedAccessErrors').innerHTML = reply.message
                if (reply.status == 'SUCCESS') {
                    modalDetailedAccess.modal('hide');
                    getUsers()
                }
            }
        }
        xhttp.open("POST", '/saveDetailedAccess');
        xhttp.send(formData);
    }
}

function getDetailedAccessForSave(){
    /** Gets the detailed access for the user. */

    var newAccess = []
    var deleteAccess = []
    var editedAccess = []
    var valid = true
    var dupSurveys = []

    var worker = false
    if (document.getElementById('defaultAccessSlider-' + selectedUser).value == access_slider_values['worker']) {
        worker = true
    }

    var surveySelects = document.querySelectorAll('[id^="detailedSurveySelect-"]')
    var workerAccesses = document.querySelectorAll('[id^="detailedWorkerAccess-"]')
    if (!worker) {
        var accessSliders = document.querySelectorAll('[id^="detailedAccessSlider-"]')
    }

    for (let i=0;i<surveySelects.length;i++) {
        if (surveySelects[i].classList[1] && surveySelects[i].classList[1].includes('id-')) {
            if (surveySelects[i].value != -1) {	
                editedAccess.push({
                    'id': surveySelects[i].classList[1].split('-')[1],
                    'survey_id': surveySelects[i].value,
                    'permission': worker ? 'worker' : default_access[accessSliders[i].value].toLowerCase(),
                    'annotation': workerAccesses[i].checked ? '1' : '0'
                })
            }
        }
        else{
            if (surveySelects[i].value != -1) {
                newAccess.push({
                    'survey_id': surveySelects[i].value,
                    'permission': worker ? 'worker' : default_access[accessSliders[i].value].toLowerCase(),
                    'annotation': workerAccesses[i].checked ? '1' : '0'
                })
            }
        }

        if (dupSurveys.indexOf(surveySelects[i].value) == -1) {
            dupSurveys.push(surveySelects[i].value)
        }
        else{
            valid = false
        }
    }
    

    for (var i = 0; i < globalDetailedAccess.length; i++){
        var found = false
        for (var j = 0; j < editedAccess.length; j++){
            if (globalDetailedAccess[i].id == editedAccess[j].id){
                found = true
                if (globalDetailedAccess[i].survey_id == editedAccess[j].survey_id && globalDetailedAccess[i].permission == editedAccess[j].permission){
                    if ((globalDetailedAccess[i].annotation == true && editedAccess[j].annotation == '1') || (globalDetailedAccess[i].annotation == false && editedAccess[j].annotation == '0')){
                        editedAccess.splice(j,1)
                    }
                }
            }
        }
        if (!found){
            deleteAccess.push({'id': globalDetailedAccess[i].id})
        }
    }

    console.log(newAccess)
    console.log(deleteAccess)
    console.log(editedAccess)

    return valid , {'new': newAccess, 'delete': deleteAccess, 'edit': editedAccess}
}

function removeUserFromOrganisation(){
    /** Removes the user from the organisation. */

    var formData = new FormData();
    formData.append('user_id', JSON.stringify(selectedUser));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (reply.status == 'SUCCESS') {
                confirmationModal.modal('hide');
                getUsers()
            }
            else{
                document.getElementById('confirmationText').innerText = reply.message
            }
        }
    }
    xhttp.open("POST", '/removeUserFromOrganisation');
    xhttp.send(formData);
}

function removeSharedSurvey(){
    /** Removes the shared survey from db (either recevied or shared). */

    var formData = new FormData();
    formData.append('survey_share_id', JSON.stringify(selectedSurveyShare));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (reply.status == 'SUCCESS') {
                confirmationModal.modal('hide');
                if (sharingType == 'received') {
                    getReceivedData()
                }
                else{
                    getSharedData()
                }
            }
            else{
                document.getElementById('confirmationText').innerText = reply.message
            }
        }
    }
    xhttp.open("POST", '/removeSharedSurvey');
    xhttp.send(formData);
}


function onload(){
    /**Function for initialising the page on load.*/
    document.getElementById('openUserTab').click();
    getSurveys()   
}

window.addEventListener('load', onload, false);