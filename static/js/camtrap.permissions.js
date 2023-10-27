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
const modalAdminConfirm = $('#modalAdminConfirm');
const default_access  = {0: 'Worker', 1: 'Hidden', 2: 'Read', 3: 'Write', 4: 'Admin'}
const access_slider_values = {'worker': 0, 'hidden': 1, 'read': 2, 'write': 3 , 'admin': 4}

var selectedUser = null
var selectedOrganisation = null
var selectedSurvey = null
var selectedSurveyShare = null
var tabActive = null
var globalSurveys = []
var globalOrganisations = []
var sharingType = null
var globalDetailedAccess = []
var currentUserPage = 1
var nextUserPage = null
var prevUserPage = null
var currentDataSharedPage = 1
var nextDataSharedPage = null
var prevDataSharedPage = null
var currentDataReceivedPage = 1
var nextDataReceivedPage = null
var prevDataReceivedPage = null
var shareOrganisation = null
var receiveOrganisation = null

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
        document.getElementById('btnPermissions').innerHTML = 'Share Survey';
        getSharedData();
    }
    else if (tabName == 'baseDataReceivedTab') {
        document.getElementById('btnPermissions').innerHTML = 'Share Survey';
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
    userTableHeadRowHeader.setAttribute('width','10%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Email';
    userTableHeadRowHeader.setAttribute('width','15%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Organisation';
    userTableHeadRowHeader.setAttribute('width','10%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Default Access';
    userTableHeadRowHeader.setAttribute('width','25%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Job Access';
    userTableHeadRowHeader.setAttribute('width','8%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Survey Creation';
    userTableHeadRowHeader.setAttribute('width','8%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Survey Deletion';
    userTableHeadRowHeader.setAttribute('width','8%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Detailed Access';
    userTableHeadRowHeader.setAttribute('width','8%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    var userTableHeadRowHeader = document.createElement('th');
    userTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    userTableHeadRowHeader.innerText = 'Remove';
    userTableHeadRowHeader.setAttribute('width','8%')
    userTableHeadRow.appendChild(userTableHeadRowHeader);

    for (let i = 0; i < users.length; i++) {
        var userTableBody = document.createElement('tbody');
        userTable.appendChild(userTableBody);

        user_permissions = users[i].user_permissions
        for (let j = 0; j < user_permissions.length; j++){

            var userTableBodyRow = document.createElement('tr');
            userTableBody.appendChild(userTableBodyRow);

            if (j == 0) {
                // Username
                var userTableBodyRowData = document.createElement('td');
                userTableBodyRowData.setAttribute('style','vertical-align: middle;')
                userTableBodyRowData.innerText = users[i].username;
                userTableBodyRowData.rowSpan = user_permissions.length;
                userTableBodyRow.appendChild(userTableBodyRowData);

                // Email
                var userTableBodyRowData = document.createElement('td');
                userTableBodyRowData.setAttribute('style','vertical-align: middle;')
                userTableBodyRowData.innerText = users[i].email;
                userTableBodyRowData.rowSpan = user_permissions.length;
                userTableBodyRow.appendChild(userTableBodyRowData);
            }

            // Organisation
            var userTableBodyRowData = document.createElement('td');
            userTableBodyRowData.setAttribute('style','vertical-align: middle;')
            userTableBodyRowData.innerText = user_permissions[j].organisation;
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
            slider.setAttribute("max", "4");
            slider.setAttribute("step", "1");
            slider.setAttribute("id", "defaultAccessSlider-" + users[i].id + '-' + user_permissions[j].organisation_id);
            slider.value = access_slider_values[user_permissions[j].default]
            col1.appendChild(slider);

            var row = document.createElement('div')
            row.classList.add('row');
            userTableBodyRowData.appendChild(row)

            var col0 = document.createElement('div')
            col0.classList.add('col-lg-3');
            col0.setAttribute('style','vertical-align: middle; text-align: center; padding: 0px;')
            col0.innerText = default_access[0];
            row.appendChild(col0)

            var col1 = document.createElement('div')
            col1.classList.add('col-lg-2');
            col1.setAttribute('style','vertical-align: middle; text-align: left; padding: 0px;')
            col1.innerText = default_access[1];
            row.appendChild(col1)

            var col2 = document.createElement('div')
            col2.classList.add('col-lg-2');
            col2.setAttribute('style','vertical-align: middle; text-align: center; padding: 0px;')
            col2.innerText = default_access[2];
            row.appendChild(col2)

            var col3 = document.createElement('div')
            col3.classList.add('col-lg-2');
            col3.setAttribute('style','vertical-align: middle; text-align: right; padding: 0px;')
            col3.innerText = default_access[3];
            row.appendChild(col3)

            var col4 = document.createElement('div')
            col4.classList.add('col-lg-3');
            col4.setAttribute('style','vertical-align: middle; text-align: center; padding: 0px;')
            col4.innerText = default_access[4];
            row.appendChild(col4)

            slider.addEventListener('change', function (userID, orgID){
                return function() {
                    selectedUser = userID
                    selectedOrganisation = orgID
                    var permission_type = 'default'
                    var slider_value = this.value
                    var permission_value = default_access[slider_value].toLowerCase()   

                    if (permission_value == 'admin') {
                        modalAdminConfirm.modal('show');
                    }
                    else{
                        document.getElementById('btnEditUser-' + userID + '-' + orgID).disabled = false

                        if (permission_value == 'worker') {
                            document.getElementById('userSurveyCreation-' + userID + '-' + orgID).checked = false
                            document.getElementById('userSurveyCreation-' + userID + '-' + orgID).disabled = true
                            // savePermissions('create', '0')
                            document.getElementById('userSurveyDeletion-' + userID + '-' + orgID).checked = false
                            document.getElementById('userSurveyDeletion-' + userID + '-' + orgID).disabled = true
                            // savePermissions('delete', '0')
                        }
                        else{
                            document.getElementById('userSurveyCreation-' + userID + '-' + orgID).disabled = false
                            
                            if (access_slider_values[permission_value] < access_slider_values['write']) {
                                document.getElementById('userSurveyDeletion-' + userID + '-' + orgID).checked = false
                                document.getElementById('userSurveyDeletion-' + userID + '-' + orgID).disabled = true
                                // savePermissions('delete', '0')
                            }
                        }

                        savePermissions(permission_type, permission_value)
                    }

                    
                };
            }(users[i].id, user_permissions[j].organisation_id));

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
            checkbox.id = 'userWorkerAccess-' + users[i].id + '-' + user_permissions[j].organisation_id;
            checkbox.checked = user_permissions[j].annotation
            toggle.appendChild(checkbox);

            var slider = document.createElement('span');
            slider.classList.add('slider');
            slider.classList.add('round');
            toggle.appendChild(slider);

            checkbox.addEventListener('change', function (userID, orgID){
                return function() {
                    selectedUser = userID
                    selectedOrganisation = orgID
                    var permission_type = 'annotation'
                    var permission_value = this.checked ? '1' : '0'
                    savePermissions(permission_type, permission_value)
                };
            }(users[i].id, user_permissions[j].organisation_id));

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
            checkbox.id = 'userSurveyCreation-' + users[i].id + '-' + user_permissions[j].organisation_id;
            checkbox.checked = user_permissions[j].create
            toggle.appendChild(checkbox);

            var slider = document.createElement('span');
            slider.classList.add('slider');
            slider.classList.add('round');
            toggle.appendChild(slider);

            if (user_permissions[j].default == 'worker') {
                document.getElementById('userSurveyCreation-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = true
            }
            else{
                document.getElementById('userSurveyCreation-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = false
            }

            checkbox.addEventListener('change', function (userID, orgID, defaultAccess){
                return function() {
                    selectedUser = userID
                    selectedOrganisation = orgID
                    var permission_type = 'create'
                    var permission_value = this.checked ? '1' : '0'

                    if (this.checked) {
                        if (access_slider_values[defaultAccess] < access_slider_values['hidden']) {
                            document.getElementById('userSurveyCreation-' + userID + '-' + orgID).checked = false
                            modalAlert.modal('show');
                        }
                        else{
                            savePermissions(permission_type, permission_value)
                        }
                    }
                    else{
                        savePermissions(permission_type, permission_value)
                    }
                };
            }(users[i].id, user_permissions[j].organisation_id, user_permissions[j].default));

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
            checkbox.id = 'userSurveyDeletion-' + users[i].id + '-' + user_permissions[j].organisation_id;
            checkbox.checked = user_permissions[j].delete
            toggle.appendChild(checkbox);

            var slider = document.createElement('span');
            slider.classList.add('slider');
            slider.classList.add('round');
            toggle.appendChild(slider);

            if (access_slider_values[user_permissions[j].default] < access_slider_values['write']) {
                document.getElementById('userSurveyDeletion-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = true
            }
            else{
                document.getElementById('userSurveyDeletion-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = false
            }

            checkbox.addEventListener('change', function (userID, orgID, defaultAccess){
                return function() {
                    selectedUser = userID
                    selectedOrganisation = orgID
                    var permission_type = 'delete'
                    var permission_value = this.checked ? '1' : '0'

                    if (this.checked) {

                        if (access_slider_values[defaultAccess] < access_slider_values['write']) {
                            document.getElementById('userSurveyDeletion-' + userID + '-' + orgID).checked = false
                            modalAlert.modal('show');
                        }
                        else{
                            savePermissions(permission_type, permission_value)
                        }
                    }
                    else{
                        savePermissions(permission_type, permission_value)
                    }
                };
            }(users[i].id, user_permissions[j].organisation_id, user_permissions[j].default));

            // Detailed Access
            userTableBodyRowData = document.createElement('td');
            userTableBodyRowData.setAttribute('class','text-center')
            userTableBodyRowData.setAttribute('style','vertical-align: middle;')
            userTableBodyRow.appendChild(userTableBodyRowData);

            var button = document.createElement('button');
            button.setAttribute("class",'btn btn-primary btn-sm btn-block')
            button.innerHTML = 'Edit';
            button.id = 'btnEditUser-' + users[i].id + '-' + user_permissions[j].organisation_id;
            userTableBodyRowData.appendChild(button);

            button.addEventListener('click', function (userId, userName, orgId, orgName){
                return function() {
                    selectedUser = userId
                    selectedOrganisation = orgId
                    openDetailedAccessModal(userId, userName, orgId, orgName)
                };
            }(users[i].id, users[i].username, user_permissions[j].organisation_id, user_permissions[j].organisation));

            if (user_permissions[j].default == 'admin') {
                document.getElementById('btnEditUser-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = true
            }
            else{
                document.getElementById('btnEditUser-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = false
            }

            // Remove
            var userTableBodyRowData = document.createElement('td');
            userTableBodyRowData.setAttribute('class','text-center')
            userTableBodyRowData.setAttribute('style','vertical-align: middle;')
            userTableBodyRow.appendChild(userTableBodyRowData);

            var button = document.createElement('button');
            button.setAttribute("class",'btn btn-danger btn-sm btn-block')
            button.innerHTML = 'Remove';
            button.id = 'btnRemoveUser-' + users[i].id + '-' + user_permissions[j].organisation_id;
            userTableBodyRowData.appendChild(button);

            button.addEventListener('click', function (userId, userName, orgID, orgName){
                return function() {
                    selectedUser = userId
                    selectedOrganisation = orgID
                    document.getElementById('confirmationText').innerText = 'User ' + userName + ' will be removed from organisation '+ orgName + '. Do you wish to continue?'
                    confirmationModal.modal('show');
                }
            }(users[i].id, users[i].username, user_permissions[j].organisation_id, user_permissions[j].organisation));

            if (user_permissions[j].root_user == true) {
                document.getElementById('btnRemoveUser-' + users[i].id + '-' + user_permissions[j].organisation_id).disabled = true
            }
        }
    }
}

function openDetailedAccessModal(id, username, org_id, org_name) {
    /**Opens the detailed access modal.*/
    document.getElementById('modalDetailedAccessTitle').innerText = 'Detailed Access: ' + username + ' for ' + org_name

    var colTitleDiv = document.getElementById('colTitleDiv')
    while (colTitleDiv.firstChild) {
        colTitleDiv.removeChild(colTitleDiv.firstChild);
    }

    if (document.getElementById('defaultAccessSlider-' + id + '-' + org_id).value == access_slider_values['worker']) {
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

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            console.log(surveys)
            globalSurveys = surveys

            getDetailedAccess(worker)
            modalDetailedAccess.modal('show');
        }
    }
    xhttp.open("GET", '/getOrganisationSurveys/' + org_id);
    xhttp.send();

}

function getUsers() {
    /**Gets the user users from the server.*/

    order = document.getElementById('permissionOrder').value
    search = document.getElementById('permissionSearch').value

    if (currentUserPage == null) {
        currentUserPage = 1
    }

    user_url = '/getUsers?page=' + currentUserPage.toString() + '&order=' + order
    if (search != '') {
        user_url += '&search=' + search
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)

            nextUserPage = reply.next
            prevUserPage = reply.prev

            if (nextUserPage == null) {
                document.getElementById('btnNextPermissions').hidden = true
            }
            else {
                document.getElementById('btnNextPermissions').hidden = false
            }

            if (prevUserPage == null) {
                document.getElementById('btnPrevPermissions').hidden = true
            }
            else {
                document.getElementById('btnPrevPermissions').hidden = false
            }

            buildUserTable(reply.users);
        }
    };
    xhttp.open("GET", user_url);
    xhttp.send();
}


function getSharedData(){
    /**Gets the shared data from the server.*/

    order = document.getElementById('permissionOrder').value
    search = document.getElementById('permissionSearch').value

    if (currentDataSharedPage == null) {
        currentDataSharedPage = 1
    }

    data_url = '/getSharedData?page=' + currentDataSharedPage.toString() + '&order=' + order
    if (search != '') {
        data_url += '&search=' + search
    }
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)

            nextDataSharedPage = reply.next
            prevDataSharedPage = reply.prev

            if (nextDataSharedPage == null) {
                document.getElementById('btnNextPermissions').hidden = true
            }
            else {
                document.getElementById('btnNextPermissions').hidden = false
            }

            if (prevDataSharedPage == null) {
                document.getElementById('btnPrevPermissions').hidden = true
            }
            else {
                document.getElementById('btnPrevPermissions').hidden = false
            }

            buildSharedDataTable(reply.shared_data);          
        }
    }
    xhttp.open("GET", data_url);
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
    dataSharingTableHeadRowHeader.setAttribute('width','16%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Email';
    dataSharingTableHeadRowHeader.setAttribute('width','16%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Surveys';
    dataSharingTableHeadRowHeader.setAttribute('width','16%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'From Organisation';
    dataSharingTableHeadRowHeader.setAttribute('width','16%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Default Access';
    dataSharingTableHeadRowHeader.setAttribute('width','20%')
    dataSharingTableHeadRow.appendChild(dataSharingTableHeadRowHeader);

    var dataSharingTableHeadRowHeader = document.createElement('th');
    dataSharingTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    dataSharingTableHeadRowHeader.innerText = 'Remove';
    dataSharingTableHeadRowHeader.setAttribute('width','16%')
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

            // From
            var dataSharingTableBodyRowData = document.createElement('td');
            dataSharingTableBodyRowData.setAttribute('style','vertical-align: middle;')
            dataSharingTableBodyRowData.innerText = surveys[j].share_org_name
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

            slider.addEventListener('change', function (ssID, shareOrgID){
                return function() {
                    selectedSurveyShare = ssID
                    shareOrganisation = shareOrgID
                    var slider_value = this.value
                    var permission_value = default_access[slider_value].toLowerCase()
                    saveSharedSurveyPermissions(permission_value)
                };
            }(surveys[j].ss_id, surveys[j].share_org_id));

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

            button.addEventListener('click', function (ssID, orgName, surveyName, shareOrgID){
                return function() {
                    selectedSurveyShare = ssID
                    sharingType = 'shared'
                    shareOrganisation = shareOrgID
                    document.getElementById('confirmationText').innerText = 'Survey ' + surveyName + ' will no longer be shared with ' + orgName + '. Do you wish to continue?'
                    confirmationModal.modal('show');
                };
            }(surveys[j].ss_id, sharedData[i].organisation, surveys[j].name, surveys[j].share_org_id));

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
    xhttp.open("GET", '/getDetailedAccess/'+selectedUser.toString()+'/'+selectedOrganisation.toString());
    xhttp.send();
}

function buildDetailedAccessRow(){
    /** Builds a row for the detailed access modal. */
    var detailedAccessDiv = document.getElementById('detailedAccessDiv')
    var IDNum = getIdNumforNext('detailedSurveySelect-')

    var worker = false
    if (document.getElementById('defaultAccessSlider-' + selectedUser + '-' + selectedOrganisation).value == access_slider_values['worker']) {
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

        // var col_4 = document.createElement('div')
        // col_4.classList.add('col-lg-2');
        // col_4.setAttribute('style','vertical-align: middle; text-align: center;')
        // col_4.innerText = default_access[4];
        // row.appendChild(col_4)
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

    order = document.getElementById('permissionOrder').value
    search = document.getElementById('permissionSearch').value

    if (currentDataReceivedPage == null) {
        currentDataReceivedPage = 1
    }

    data_url = '/getReceivedData?page=' + currentDataReceivedPage.toString() + '&order=' + order
    if (search != '') {
        data_url += '&search=' + search
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)

            nextDataReceivedPage = reply.next
            prevDataReceivedPage = reply.prev

            if (nextDataReceivedPage == null) {
                document.getElementById('btnNextPermissions').hidden = true
            }
            else {
                document.getElementById('btnNextPermissions').hidden = false
            }

            if (prevDataReceivedPage == null) {
                document.getElementById('btnPrevPermissions').hidden = true
            }
            else {
                document.getElementById('btnPrevPermissions').hidden = false
            }

            buildReceivedDataTable(reply.received_surveys)
        }
    }
    xhttp.open("GET", data_url);
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
    receivedDataTableHeadRowHeader.setAttribute('width','17%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Email';
    receivedDataTableHeadRowHeader.setAttribute('width','17%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Surveys';
    receivedDataTableHeadRowHeader.setAttribute('width','17%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'To Organisation';
    receivedDataTableHeadRowHeader.setAttribute('width','17%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Default Access';
    receivedDataTableHeadRowHeader.setAttribute('width','17%')
    receivedDataTableHeadRow.appendChild(receivedDataTableHeadRowHeader);

    var receivedDataTableHeadRowHeader = document.createElement('th');
    receivedDataTableHeadRowHeader.setAttribute('style','vertical-align: middle;')
    receivedDataTableHeadRowHeader.innerText = 'Remove';
    receivedDataTableHeadRowHeader.setAttribute('width','15%')
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

            // To
            var receivedDataTableBodyRowData = document.createElement('td');
            receivedDataTableBodyRowData.setAttribute('style','vertical-align: middle;')
            receivedDataTableBodyRowData.innerText = surveys[j].received_org_name
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

            button.addEventListener('click', function (ssID, orgName, surveyName, receivedOrgID){
                return function() {
                    selectedSurveyShare = ssID
                    sharingType = 'received'
                    receiveOrganisation = receivedOrgID
                    document.getElementById('confirmationText').innerText = 'Survey ' + surveyName + ' from ' + orgName + ' will no longer be shared with you. Do you wish to continue?'
                    confirmationModal.modal('show');
                };
            }(surveys[j].ss_id, receivedData[i].organisation, surveys[j].name, surveys[j].received_org_id));

        }
    }
}

// function getOrganisationSurveys(){
//     /** Gets the surveys for the current user */
//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             surveys = JSON.parse(this.responseText);  
//             console.log(surveys)
//             globalSurveys = surveys
//         }
//     }
//     xhttp.open("GET", '/getOrganisationSurveys');
//     xhttp.send();
// }

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
    formData.append('organisation_id', JSON.stringify(selectedOrganisation));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply.status == 'SUCCESS') {
                if(modalAdminConfirm.hasClass('show')){
                    modalAdminConfirm.modal('hide')
                }
            }

            getUsers()
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
    formData.append('org_id', JSON.stringify(shareOrganisation));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            console.log(reply)
            if (reply.status == 'SUCCESS') {
                document.getElementById('dataSharingErrors').innerHTML = '' 
            }
            else{
                document.getElementById('dataSharingErrors').innerHTML = reply.message
            }

            getSharedData()
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
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            organisations = reply.organisations
            var optionTexts = []
            var optionValues = []
            for (let i=0;i<organisations.length;i++) {
                optionTexts.push(organisations[i].name)
                optionValues.push(organisations[i].id)
            }
            var select = document.getElementById('organisationSelect')
            clearSelect(select)
            fillSelect(select, optionTexts, optionValues)

            document.getElementById('inviteStatus').innerHTML = ''
            document.getElementById('inviteUsername').value = ''
            modalInvite.modal({keyboard: true});
        }
    }
    xhttp.open("GET", "/getAdminOrganisations");
    xhttp.send();

}

function sendInvite() {
    inviteUsername = document.getElementById('inviteUsername').value
    orgID = document.getElementById('organisationSelect').value

    var formData = new FormData()
    formData.append("inviteUsername", JSON.stringify(inviteUsername))
    formData.append("orgID", JSON.stringify(orgID))

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

    document.getElementById('shareDataErrors').innerHTML = ''
    document.getElementById('shareOrganisationStatus').innerHTML = ''
    document.getElementById('organisationName').value = ''

    var shareDataDiv = document.getElementById('shareDataDiv')
    while (shareDataDiv.firstChild) {
        shareDataDiv.removeChild(shareDataDiv.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            console.log(surveys)
            globalSurveys = surveys

            buildShareDataRow()
            modalShareData.modal({keyboard: true});
        }
    }
    xhttp.open("GET", '/getOrganisationSurveys/0');
    xhttp.send();


}

function buildShareDataRow() {
    /**  Builds a row for the share data modal. */  
    var shareDataDiv = document.getElementById('shareDataDiv')
    // var IDNum = getIdNumforNext('shareSurveySelect-')

    var row = document.createElement('div')
    row.classList.add('row')
    shareDataDiv.appendChild(row)

    var col1 = document.createElement('div')
    col1.classList.add('col-lg-5')
    col1.style.display = 'flex'
    col1.style.alignItems = 'center'
    col1.style.justifyContent = 'center'
    row.appendChild(col1)

    var col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    var col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    row.appendChild(col3)

    var survey = document.createElement('select');
    survey.classList.add('form-control')
    survey.id = 'shareSurveySelect';
    col1.appendChild(survey);

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
    col2.appendChild(defaultDiv);    
    
    var row = document.createElement('div')
    row.classList.add('row');
    defaultDiv.appendChild(row)
    
    var col_1 = document.createElement('div')
    col_1.classList.add('col-lg-12');
    row.appendChild(col_1)

    var slider = document.createElement('input');
    slider.setAttribute("type", "range");
    slider.setAttribute("class", "custom-range");
    slider.setAttribute('style','width: 90%;')
    slider.setAttribute("min", "2");
    slider.setAttribute("max", "3");
    slider.setAttribute("step", "1");
    slider.setAttribute("id", "shareAccessSlider");
    col_1.appendChild(slider);

    var row = document.createElement('div')
    row.classList.add('row');
    defaultDiv.appendChild(row)

    var col11 = document.createElement('div')
    col11.classList.add('col-lg-6');
    col11.setAttribute('style','vertical-align: middle; text-align: left;')
    col11.innerText = 'Read';
    row.appendChild(col11)

    var col12 = document.createElement('div')
    col12.classList.add('col-lg-6');
    col12.setAttribute('style','vertical-align: middle; text-align: right;')
    col12.innerText = 'Write';
    row.appendChild(col12)

    // var button = document.createElement('button');
    // button.setAttribute("class",'btn btn-info')
    // button.innerHTML = '&times;';
    // button.id = 'btnRemoveShareData-' + IDNum;
    // col3.appendChild(button);

    // button.addEventListener('click', function () {
    //     this.parentNode.parentNode.remove()
    // });
}

function shareSurveys(){
    /** Shares the selected surveys with the selected organisation. */

    var organisationName = document.getElementById('organisationName').value
    // var surveySelects = document.querySelectorAll('[id^="shareSurveySelect-"]')
    // var accessSliders = document.querySelectorAll('[id^="shareAccessSlider-"]')
    var surveySelect = document.getElementById('shareSurveySelect')
    var accessSlider = document.getElementById('shareAccessSlider')

    var sharedData = {
        'survey_id': surveySelect.value,
        'permission': default_access[accessSlider.value].toLowerCase()
    }

    // for (let i=0;i<surveySelects.length;i++) {
    //     if (surveySelects[i].value != -1 && surveySelects[i].value != -1) {
    //         sharedData.push({
    //             'survey_id': surveySelects[i].value,
    //             'permission': default_access[accessSliders[i].value].toLowerCase()
    //         })
    //     }
    // }

    var valid = validateShareData(sharedData, organisationName)

    if (valid){
        var formData = new FormData();
        formData.append('shared_data', JSON.stringify(sharedData));
        formData.append('organisation_name', JSON.stringify(organisationName));

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                console.log(reply)
                document.getElementById('shareDataErrors').innerHTML = reply.message
            }
        }
        xhttp.open("POST", '/shareSurveys');
        xhttp.send(formData);
    }
}

function validateShareData(sharedData, organisationName){
    /** Validates the shared data. */

    var valid = true

    if (organisationName == '') {
        document.getElementById('shareDataErrors').innerHTML = 'Please enter a name for the organisation.'
        valid = false
    }
    else if (sharedData.survey_id == -1) {
        document.getElementById('shareDataErrors').innerHTML = 'Please select a survey.'
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
        formData.append('organisation_id', JSON.stringify(selectedOrganisation));

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
    if (document.getElementById('defaultAccessSlider-' + selectedUser + '-' + selectedOrganisation).value == access_slider_values['worker']) {
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
    formData.append('org_id', JSON.stringify(selectedOrganisation));

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
            }
            else{
                document.getElementById('confirmationText').innerText = reply.message
            }

            if (sharingType == 'received') {
                getReceivedData()
            }
            else{
                getSharedData()
            }
        }
    }
    xhttp.open("POST", '/removeSharedSurvey');
    xhttp.send(formData);
}

function setToAdmin(){
    /** Sets the user to admin. */

    document.getElementById('btnEditUser-' + selectedUser + '-' + selectedOrganisation).disabled = true
    document.getElementById('userSurveyCreation-' + selectedUser + '-' + selectedOrganisation).disabled = false
    document.getElementById('userSurveyDeletion-' + selectedUser + '-' + selectedOrganisation).disabled = false
    savePermissions('default', 'admin')
}

modalShareData.on('hidden.bs.modal', function () {
    /** Function for when the share data modal is closed. */
    document.getElementById('shareDataErrors').innerHTML = ''
    document.getElementById('organisationName').value = ''

    var shareDataDiv = document.getElementById('shareDataDiv')
    while (shareDataDiv.firstChild) {
        shareDataDiv.removeChild(shareDataDiv.firstChild);
    }

    getSharedData()
    getReceivedData()
});

modalInvite.on('hidden.bs.modal', function () {
    /** Function for when the invite modal is closed. */
    document.getElementById('inviteStatus').innerHTML = ''
    document.getElementById('inviteUsername').value = ''
    getUsers()
});

modalAdminConfirm.on('hidden.bs.modal', function () {
    /** Function for when the admin confirmation modal is closed. */
    getUsers()
});

$('#btnNextPermissions').click(function(){
    /**Function for the next permissions button. */
    if (tabActive == 'baseUserTab') {
        currentUserPage = nextUserPage
        getUsers()
    }
    else if (tabActive == 'baseDataSharingTab') {
        currentDataSharedPage = nextDataSharedPage
        getSharedData()
    }
    else if (tabActive == 'baseDataReceivedTab') {
        currentDataReceivedPage = nextDataReceivedPage
        getReceivedData()
    }
});

$('#btnPrevPermissions').click(function(){
    /**Function for the previous permissions button. */
    if (tabActive == 'baseUserTab') {
        currentUserPage = prevUserPage
        getUsers()
    }
    else if (tabActive == 'baseDataSharingTab') {
        currentDataSharedPage = prevDataSharedPage
        getSharedData()
    }
    else if (tabActive == 'baseDataReceivedTab') {
        currentDataReceivedPage = prevDataReceivedPage
        getReceivedData()
    }
});

$('#permissionOrder').change(function(){
    /**Function for the order by select. */
    if (tabActive == 'baseUserTab') {
        currentUserPage = 1
        getUsers()
    }
    else if (tabActive == 'baseDataSharingTab') {
        currentDataSharedPage = 1
        getSharedData()
    }
    else if (tabActive == 'baseDataReceivedTab') {
        currentDataReceivedPage = 1
        getReceivedData()
    }
});

$('#permissionSearch').change(function(){
    /**Function for the search select. */
    if (tabActive == 'baseUserTab') {
        currentUserPage = 1
        getUsers()
    }
    else if (tabActive == 'baseDataSharingTab') {
        currentDataSharedPage = 1
        getSharedData()
    }
    else if (tabActive == 'baseDataReceivedTab') {
        currentDataReceivedPage = 1
        getReceivedData()
    }
});

function onload(){
    /**Function for initialising the page on load.*/
    document.getElementById('openUserTab').click();
    // getOrganisationSurveys()   
}

window.addEventListener('load', onload, false);