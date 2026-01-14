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

var deleted_file_ids = new Set();
var file_last_modified = {};
var currentFileOrder = {'column': 'filename', 'direction': 'asc'};

function changeFilesTab(evt, tabName) {
    /** Opens the files tab */

    var mainModal = document.getElementById('modalAddFiles');
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
    tabActiveManageFiles = tabName

    if (tabName == 'baseAddFilesTab') {
        openAddImages()
    }
    else if (tabName == 'baseEditFilesTab') {
        openEditFiles()
    }

    document.getElementById('addFilesErrors').innerHTML = ''
    document.getElementById('editFilesErrors').innerHTML = ''
}

function getSurveyFolders(){
    /** Gets the folders in the survey. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            folders = reply.folders
            surveyFolders = folders
            surveyDeletedFiles = []
            surveyDeletedFolders = {}
            surveyMovedFolders = {}
            surveyEditedNames = {'site': {},'camera': {}}
            siteNames = {}
            camNames = {}
            //populate site and camera names
            for (let site_id in folders) {
                siteNames[site_id] = folders[site_id].site
                for (let cam_id in folders[site_id].cameras) {
                    camNames[cam_id] = folders[site_id].cameras[cam_id].camera
                }
            }
            buildSurveyFolders()
        }
    }
    xhttp.open("GET", '/getSurveyFolders/'+selectedSurvey);
    xhttp.send();
}

function buildSurveyFolders(type='folder'){
    /** Builds the folders table. */
    var table_id = 'folders_tbl'
    var div_id = 'folders_table_div'
    if (type=='folder'){
        var folders = surveyFolders
        var folderDiv = document.getElementById('folderDiv')
        while(folderDiv.firstChild){
            folderDiv.removeChild(folderDiv.firstChild);
        }
    }
    else if (type=='delete'){
        var folders = surveyDeletedFolders
        var folderDiv = document.getElementById('deleteFolderDiv')
        while(folderDiv.firstChild){
            folderDiv.removeChild(folderDiv.firstChild);
        }
        if (Object.keys(folders).length == 0){
            document.getElementById('delFoldersHeadingDiv').hidden = true;
        } else {
            document.getElementById('delFoldersHeadingDiv').hidden = false;
        }
        table_id = 'deleted_folders_tbl'
        div_id = 'delete_table_div'
    }

    if (Object.keys(folders).length == 0){
        return
    }

    var tableDiv = document.createElement('div')
    tableDiv.setAttribute('class','table-responsive')
    tableDiv.setAttribute('style','max-height:385px')
    tableDiv.id=div_id
    folderDiv.appendChild(tableDiv)

    var table = document.createElement('table')
    table.classList.add('table');
    table.classList.add('table-striped');
    table.classList.add('table-bordered');
    table.style.borderCollapse = 'collapse'
    table.style.border = '1px solid rgba(0,0,0,0)'
    table.style.marginBottom = '2px'
    table.id = table_id
    tableDiv.appendChild(table)

    var thead = document.createElement('thead')
    table.appendChild(thead)

    var tr = document.createElement('tr')
    thead.appendChild(tr)

    var th = document.createElement('th')
    th.innerHTML = 'Site'
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '10%');
    tr.appendChild(th)

    var th = document.createElement('th')
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '10%');
    th.innerHTML = 'Camera'
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Folder'
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '38%');
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Image Count'
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '10%');
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Video Count'
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '10%');
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Frame Count'
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '10%');
    tr.appendChild(th)

    var th = document.createElement('th')
    th.innerHTML = 'Action'
    if (type=='folder'){
        th.setAttribute('colspan', '3')
    }
    th.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    th.setAttribute('width', '12%');
    tr.appendChild(th)

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Sort by site
    site_ids = Object.keys(folders).sort((a, b) => siteNames[a].localeCompare(siteNames[b]));

    for (let site_id of site_ids) {
        let site_added = false;
        let site = folders[site_id];
        // Sort cameras by name
        let camera_ids = Object.keys(site.cameras).sort((a, b) => camNames[a].localeCompare(camNames[b]));

        for (let camera_id of camera_ids) {
            let cam_added = false;
            let camera = site.cameras[camera_id];;

            for (let i = 0; i < camera.folders.length; i++) {
                let folder = camera.folders[i];

                var tr = document.createElement('tr');
                tbody.appendChild(tr);

                if (!site_added){
                    var tdSite = document.createElement('td');
                    tdSite.classList.add('site');
                    tdSite.classList.add('site-'+site_id);
                    tdSite.setAttribute('rowspan', Object.values(site.cameras).reduce((acc, cam) => acc + cam.folders.length, 0));
                    tdSite.setAttribute('style', 'text-align:left; vertical-align: middle; padding: 8px 12px;');
                    if (type=='folder'&&surveyEditedNames['site'][site_id]){
                        tdSite.innerHTML = surveyEditedNames['site'][site_id];
                        tdSite.style.color = 'rgba(223, 105, 26, 1)';
                        siteNames[site_id] = surveyEditedNames['site'][site_id];
                    } else {
                        tdSite.innerHTML = site.site;
                        siteNames[site_id] = site.site;
                    }
                    tr.appendChild(tdSite);

                    tdSite.addEventListener('mouseenter', function () {
                        highlightCells(this,table.id);
                    });

                    tdSite.addEventListener('mouseleave', function () {
                        clearHighlights();
                    });

                    if (type=='folder'){
                        tdSite.contentEditable = true;

                        tdSite.addEventListener('blur', function (siteID) {
                            return function() {
                                var new_site_name = this.innerHTML.trim();
                                if (new_site_name == ''){
                                    this.innerHTML = folders[siteID].site;
                                    return;
                                }
                                if (new_site_name != folders[siteID].site){
                                    if (validateName(new_site_name, 'site', siteID)){
                                        surveyEditedNames['site'][siteID] = new_site_name;
                                        this.style.color = 'rgba(223, 105, 26, 1)'; 
                                        siteNames[siteID] = new_site_name;
                                    } else {
                                        this.innerHTML = folders[siteID].site;
                                        this.style.color = '';
                                        siteNames[siteID] = folders[siteID].site;
                                    }
                                } else {
                                    if (surveyEditedNames['site'][siteID]){
                                        delete surveyEditedNames['site'][siteID];
                                    }
                                    this.style.color = '';
                                }
                            };
                        }(site_id));

                        tdSite.addEventListener('keydown', function (e) {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                this.blur();
                            }
                        });
                    }

                    site_added = true;
                }

                if (!cam_added) {
                    var tdCamera = document.createElement('td');
                    tdCamera.classList.add('camera');
                    tdCamera.classList.add('camera-'+camera_id);
                    tdCamera.classList.add('site-'+site_id);
                    tdCamera.setAttribute('rowspan', camera.folders.length);
                    tdCamera.setAttribute('style', 'text-align:left; vertical-align: middle; padding: 8px 12px;');
                    if (type=='folder'&&surveyEditedNames['camera'][camera_id]){
                        tdCamera.innerHTML = surveyEditedNames['camera'][camera_id]
                        tdCamera.style.color = 'rgba(223, 105, 26, 1)'; 
                        camNames[camera_id] = surveyEditedNames['camera'][camera_id];
                    } else {
                        tdCamera.innerHTML = camera.camera;
                        camNames[camera_id] = camera.camera;
                    }
                    tr.appendChild(tdCamera);

                    tdCamera.addEventListener('mouseenter', function () {
                        highlightCells(this,table.id);
                    });

                    tdCamera.addEventListener('mouseleave', function () {
                        clearHighlights();
                    });

                    if (type=='folder'){
                        tdCamera.contentEditable = true;

                        tdCamera.addEventListener('blur', function (siteID, camID) {
                            return function() {
                                var new_camera_name = this.innerHTML.trim();
                                if (new_camera_name == ''){
                                    this.innerHTML = folders[siteID].cameras[camID].camera;
                                    return;
                                }
                                if (new_camera_name != folders[siteID].cameras[camID].camera){
                                    if (validateName(new_camera_name, 'camera', siteID, camID)){
                                        surveyEditedNames['camera'][folders[siteID].cameras[camID].camera_id] = new_camera_name;
                                        this.style.color = 'rgba(223, 105, 26, 1)';
                                        camNames[camID] = new_camera_name;
                                    } else {
                                        this.innerHTML = folders[siteID].cameras[camID].camera;
                                        this.style.color = '';
                                        camNames[camID] = folders[siteID].cameras[camID].camera;
                                    }
                                } else {
                                    if (surveyEditedNames['camera'][folders[siteID].cameras[camID].camera_id]){
                                        delete surveyEditedNames['camera'][folders[siteID].cameras[camID].camera_id];
                                    }
                                    this.style.color = '';
                                }
                            };
                        }(site_id, camera_id));

                        tdCamera.addEventListener('keydown', function (e) {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                this.blur();
                            }
                        });
                    }

                    cam_added = true;
                }
    
                var tdFolder = document.createElement('td');
                tdFolder.classList.add('folder');
                tdFolder.classList.add('camera-'+camera_id);
                tdFolder.classList.add('site-'+site_id);
                tdFolder.setAttribute('style', 'text-align:left; vertical-align: middle; padding: 8px 12px;');
                tdFolder.innerHTML = folder.folder.split('/').slice(1).join('/');
                tr.appendChild(tdFolder);

                tdFolder.addEventListener('mouseenter', function () {
                    highlightCells(this,table.id);
                });

                tdFolder.addEventListener('mouseleave', function () {
                    clearHighlights();
                });

                var tdImageCount = document.createElement('td');
                tdImageCount.classList.add('folder');
                tdImageCount.classList.add('camera-'+camera_id);
                tdImageCount.classList.add('site-'+site_id);
                tdImageCount.setAttribute('style', 'text-align:right; vertical-align: middle; padding: 8px 12px;');
                tdImageCount.innerHTML = folder.image_count;
                tr.appendChild(tdImageCount);

                tdImageCount.addEventListener('mouseenter', function () {
                    highlightCells(this,table.id);
                });

                tdImageCount.addEventListener('mouseleave', function () {
                    clearHighlights();
                });

                var tdVideoCount = document.createElement('td');
                tdVideoCount.classList.add('folder');
                tdVideoCount.classList.add('camera-'+camera_id);
                tdVideoCount.classList.add('site-'+site_id);
                tdVideoCount.setAttribute('style', 'text-align:right; vertical-align: middle; padding: 8px 12px;');
                tdVideoCount.innerHTML = folder.video_count;
                tr.appendChild(tdVideoCount);

                tdVideoCount.addEventListener('mouseenter', function () {
                    highlightCells(this,table.id);
                });

                tdVideoCount.addEventListener('mouseleave', function () {
                    clearHighlights();
                });

                var tdFrameCount = document.createElement('td');
                tdFrameCount.classList.add('folder');
                tdFrameCount.classList.add('camera-'+camera_id);
                tdFrameCount.classList.add('site-'+site_id);
                tdFrameCount.setAttribute('style', 'text-align:right; vertical-align: middle; padding: 8px 12px;');
                tdFrameCount.innerHTML = folder.frame_count;
                tr.appendChild(tdFrameCount);

                tdFrameCount.addEventListener('mouseenter', function () {
                    highlightCells(this,table.id);
                });

                tdFrameCount.addEventListener('mouseleave', function () {
                    clearHighlights();
                });


                if (type=='delete'){
                    var tdAction = document.createElement('td');
                    tdAction.classList.add('folder');
                    tdAction.classList.add('camera-'+camera_id);
                    tdAction.classList.add('site-'+site_id);
                    tdAction.setAttribute('style', 'text-align:center; vertical-align: middle; padding: 8px 12px;');
                    tr.appendChild(tdAction);

                    var icon = document.createElement('i');
                    icon.classList.add('fa', 'fa-undo');
                    icon.setAttribute('style', 'cursor:pointer;');
                    icon.setAttribute('title', 'Restore Folder');
                    tdAction.appendChild(icon)

                    icon.addEventListener('click', function (siteID, camID, folderObj) {
                        return function() {
                            removeFolder(siteID, camID, folderObj.folder, surveyDeletedFolders);
                            addFolder(siteID, siteNames[siteID], camID, camNames[camID], folderObj, surveyFolders);
                            buildSurveyFolders()
                            var scrollpos = document.getElementById('delete_table_div').scrollTop;
                            buildSurveyFolders('delete')
                            if (document.getElementById('delete_table_div')) {
                                document.getElementById('delete_table_div').scrollTop = scrollpos;
                            }
                        };
                    }(site_id, camera_id, folder));

                    tdAction.addEventListener('mouseenter', function () {
                        highlightCells(this,table.id);
                    });

                    tdAction.addEventListener('mouseleave', function () {
                        clearHighlights();
                    });
                } else {
                    var tdViewAction = document.createElement('td');
                    tdViewAction.classList.add('folder');
                    tdViewAction.classList.add('camera-'+camera_id);
                    tdViewAction.classList.add('site-'+site_id);
                    tdViewAction.setAttribute('style', 'text-align:center; vertical-align: middle; padding: 8px 12px; width: 4%;');
                    tr.appendChild(tdViewAction);

                    var viewIcon = document.createElement('i');
                    viewIcon.classList.add('fa', 'fa-folder-open'); 
                    viewIcon.setAttribute('style', 'cursor:pointer;');
                    viewIcon.setAttribute('title', 'View Folder Contents');
                    tdViewAction.appendChild(viewIcon)

                    viewIcon.addEventListener('click', function (camID,folderObj) {
                        return function() {
                            cleanFolderContents();
                            editFilesActionOpen = true;
                            selectedViewFolder = folderObj;
                            selectedViewFolder.camera_id = surveyMovedFolders[folderObj.folder] ? surveyMovedFolders[folderObj.folder].old_camera_id : camID;
                            document.getElementById('folderPathDisplay').innerHTML = folderObj.folder.split('/').slice(1).join('/');
                            modalAddFiles.modal('hide');
                            modalFolderFiles.modal({keyboard: true});
                        };
                    }(camera_id, folder));

                    tdViewAction.addEventListener('mouseenter', function () {
                        highlightCells(this,table.id);
                    });

                    tdViewAction.addEventListener('mouseleave', function () {
                        clearHighlights();
                    });

                    var tdMoveAction = document.createElement('td');
                    tdMoveAction.classList.add('folder');
                    tdMoveAction.classList.add('camera-'+camera_id);
                    tdMoveAction.classList.add('site-'+site_id);
                    tdMoveAction.setAttribute('style', 'text-align:center; vertical-align: middle; padding: 8px 12px; width: 4%;');
                    tr.appendChild(tdMoveAction);

                    var moveIcon = document.createElement('i');
                    moveIcon.classList.add('fa', 'fa-arrows-up-down-left-right'); 
                    moveIcon.setAttribute('style', 'cursor:pointer;');
                    moveIcon.setAttribute('title', 'Move Folder');
                    tdMoveAction.appendChild(moveIcon)

                    tdMoveAction.addEventListener('click', function (siteID, camID, folderObj) {
                        return function() {
                            selectedFolderToMove = folderObj;
                            selectedFolderToMove.site_id = siteID;
                            selectedFolderToMove.camera_id = camID;
                            editFilesActionOpen = true;
                            var select = document.getElementById('moveFolderSiteSelector');
                            clearSelect(select)
                            let optionTexts = []
                            let optionValues = []
                            // let sids = Object.keys(surveyFolders).sort((a, b) => siteNames[a].localeCompare(siteNames[b]));
                            // for (let sid of sids) {
                            //     optionTexts.push(siteNames[sid])
                            //     optionValues.push(sid)
                            // }
                            for (let sid in siteNames) {
                                optionTexts.push(siteNames[sid])
                                optionValues.push(sid)
                            }
                            optionTexts.push('NEW SITE')
                            optionValues.push('new')
                            fillSelect(select, optionTexts, optionValues)

                            var cameraSelect = document.getElementById('moveFolderCameraSelector');
                            clearSelect(cameraSelect)
                            let optionTextsCam = []
                            let optionValuesCam = []
                            let cids = Object.keys(surveyFolders[optionValues[0]].cameras).sort((a, b) => camNames[a].localeCompare(camNames[b]));
                            for (let cid of cids) {
                                optionTextsCam.push(camNames[cid])
                                optionValuesCam.push(cid)
                            }
                            if (!optionTextsCam.includes(camNames[camID])){
                                optionTextsCam = [camNames[camID]].concat(optionTextsCam)
                                optionValuesCam = ['n'+camID].concat(optionValuesCam)
                            }
                            optionTextsCam.push('NEW CAMERA')
                            optionValuesCam.push('new')
                            fillSelect(cameraSelect, optionTextsCam, optionValuesCam)

                            modalAddFiles.modal('hide');
                            document.getElementById('moveFolderSiteName').style.display = 'none';
                            document.getElementById('moveFolderSiteName').value = '';
                            document.getElementById('moveFolderCameraName').style.display = 'none';
                            document.getElementById('moveFolderCameraName').value = '';
                            document.getElementById('moveFolderPathDisplay').innerHTML = folderObj.folder.split('/').slice(1).join('/');
                            modalMoveFolder.modal({keyboard: true});
                        };
                    }(site_id, camera_id, folder));

                    tdMoveAction.addEventListener('mouseenter', function () {
                        highlightCells(this,table.id);
                    }); 

                    tdMoveAction.addEventListener('mouseleave', function () {
                        clearHighlights();
                    });

                    if (folder.moved){
                        // set cell color to orange
                        tdFolder.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';
                        tdImageCount.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';
                        tdVideoCount.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';
                        tdFrameCount.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';
                        tdViewAction.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';
                        tdMoveAction.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';

                        var tdAction = document.createElement('td');
                        tdAction.classList.add('folder');
                        tdAction.classList.add('camera-'+camera_id);
                        tdAction.classList.add('site-'+site_id);
                        tdAction.setAttribute('style', 'text-align:center; vertical-align: middle; padding: 8px 12px; width: 4%; background-color: rgba(223, 105, 26, 0.3);');
                        tr.appendChild(tdAction);

                        var icon = document.createElement('i');
                        icon.classList.add('fa', 'fa-undo');
                        icon.setAttribute('style', 'cursor:pointer;');
                        icon.setAttribute('title', 'Undo Move Folder');
                        tdAction.appendChild(icon)

                        icon.addEventListener('click', function (siteID, camID, folderObj) {
                            return function() {
                                /** Event listener for the undoing of a folder move. */
                                removeFolder(siteID, camID, folderObj.folder, surveyFolders);
                                let old_site_id = surveyMovedFolders[folderObj.folder].old_site_id;
                                let old_camera_id = surveyMovedFolders[folderObj.folder].old_camera_id;
                                delete folderObj.moved;
                                addFolder(old_site_id, siteNames[old_site_id], old_camera_id, camNames[old_camera_id], folderObj, surveyFolders);
                                delete surveyMovedFolders[folderObj.folder];

                                var scrollpos = document.getElementById('folders_table_div').scrollTop;
                                buildSurveyFolders()
                                if (document.getElementById('folders_table_div')) {
                                    document.getElementById('folders_table_div').scrollTop = scrollpos;
                                }
                            };
                        }(site_id, camera_id, folder));

                    } else {
                        var tdAction = document.createElement('td');
                        tdAction.classList.add('folder');
                        tdAction.classList.add('camera-'+camera_id);
                        tdAction.classList.add('site-'+site_id);
                        tdAction.setAttribute('style', 'text-align:center; vertical-align: middle; padding: 8px 12px; width: 4%;');
                        tr.appendChild(tdAction);

                        var icon = document.createElement('i');
                        icon.classList.add('fa', 'fa-trash-can'); 
                        icon.setAttribute('style', 'cursor:pointer;');
                        icon.setAttribute('title', 'Delete Folder');
                        tdAction.appendChild(icon)

                        icon.addEventListener('click', function (siteID, camID, folderObj) {
                            return function() {
                                /** Event listener for the deletion of a folder. */
                                var table = document.getElementById('folders_tbl');
                                let row_count = table.getElementsByTagName('tr').length - 1;
                                if (row_count > 1){
                                    removeFolder(siteID, camID, folderObj.folder, surveyFolders);
                                    addFolder(siteID, siteNames[siteID], camID, camNames[camID], folderObj, surveyDeletedFolders);
                                    var scrollpos = document.getElementById('folders_table_div').scrollTop;
                                    buildSurveyFolders()
                                    if (document.getElementById('folders_table_div')) {
                                        document.getElementById('folders_table_div').scrollTop = scrollpos;
                                    }
                                    buildSurveyFolders('delete')
                                    surveyDeletedFiles = surveyDeletedFiles.filter(function(value, index, arr){
                                        return value.folder !== folderObj.folder;
                                    });
                                    buildSurveyDeletedFiles();
                                }
                            };
                        }(site_id, camera_id, folder));
                    }

                    tdAction.addEventListener('mouseenter', function () {
                        highlightCells(this,table.id);
                    });

                    tdAction.addEventListener('mouseleave', function () {
                        clearHighlights();
                    });

                }
            }
        }
    }
}

function removeFolder(site_id,cam_id,folder_path,source){
    /** Removes a folder from the source (either 'surveyFolders' or 'surveyDeletedFolders'). */
    // site_id = parseInt(site_id);
    // cam_id = parseInt(cam_id);
    if (!source[site_id] || !source[site_id].cameras[cam_id]){
        return;
    }

    source[site_id].cameras[cam_id].folders = source[site_id].cameras[cam_id].folders.filter(function(value, index, arr){
        return value.folder !== folder_path;
    });

    if (source[site_id].cameras[cam_id].folders.length == 0){
        delete source[site_id].cameras[cam_id];
    }

    if (Object.keys(source[site_id].cameras).length == 0){
        delete source[site_id];
        if (site_id.startsWith('n')){
            delete siteNames[site_id];
        }
    }
}

function addFolder(site_id, site_name, cam_id, cam_name, folder_obj, source){
    /** Adds a folder to the source (either 'surveyFolders' or 'surveyDeletedFolders'). */
    // site_id = parseInt(site_id);
    // cam_id = parseInt(cam_id);
    if (!source[site_id]){
        source[site_id] = { site_id: site_id, site: site_name, cameras: {} };
    }
    if (!source[site_id].cameras[cam_id]){
        source[site_id].cameras[cam_id] = { camera_id: cam_id, camera: cam_name, folders: [] };
    }
    source[site_id].cameras[cam_id].folders.push(folder_obj);
}

$('#btnCancelEditFiles').on('click', function() {
    /** Event listener for the cancellation of the editing of files. */
    modalConfirmEditFiles.modal('hide')
    modalAddFiles.modal({keyboard: true})
});

$('#btnConfirmEditFiles').on('click', function() {
    /** Event listener for the confirmation of the editing of files. */
    editFiles();
});

function editFiles() {
    /** Edits the survey files based on the user's changes. */
    document.getElementById('btnConfirmEditFiles').disabled = true

    if (Object.keys(surveyDeletedFolders).length == 0 && surveyDeletedFiles.length == 0 && Object.keys(surveyMovedFolders).length == 0 && Object.keys(surveyEditedNames['site']).length == 0 && Object.keys(surveyEditedNames['camera']).length == 0){
        document.getElementById('btnConfirmEditFiles').disabled = false
        modalConfirmEditFiles.modal('hide')
    } else {

        // update the cam names for moved folders
        let move_folders = []
        let i = 0;
        for (let folder in surveyMovedFolders){
            let new_site_id = surveyMovedFolders[folder]['new_site_id'];
            if (new_site_id.startsWith('n')){
                if (surveyEditedNames['site'][new_site_id]){
                    surveyMovedFolders[folder]['new_site_name'] = surveyEditedNames['site'][new_site_id];
                } else {
                    surveyMovedFolders[folder]['new_site_name'] = siteNames[new_site_id];
                }
            }
            let new_cam_id = surveyMovedFolders[folder]['new_camera_id'];
            if (new_cam_id.startsWith('n')){
                if (surveyEditedNames['camera'][new_cam_id]){
                    surveyMovedFolders[folder]['new_camera_name'] = surveyEditedNames['camera'][new_cam_id];
                } else {
                    surveyMovedFolders[folder]['new_camera_name'] = camNames[new_cam_id];
                }
            }
            move_folders.push(surveyMovedFolders[folder]);
            delete move_folders[i]['image_count'];
            delete move_folders[i]['video_count'];
            delete move_folders[i]['frame_count'];
            i += 1;
        }

        //remove 'n'ids from surveyEditedNames
        let cleanEditedNames = {'site': {},'camera': {}};
        for (let site_id in surveyEditedNames['site']){
            if (!site_id.startsWith('n')){
                cleanEditedNames['site'][site_id] = surveyEditedNames['site'][site_id];
            }
        }
        for (let cam_id in surveyEditedNames['camera']){
            if (!cam_id.startsWith('n')){
                cleanEditedNames['camera'][cam_id] = surveyEditedNames['camera'][cam_id];
            }
        }

        let deleted_folders = [];
        for (let site_id in surveyDeletedFolders){
            for (let cam_id in surveyDeletedFolders[site_id].cameras){
                for (let i = 0; i < surveyDeletedFolders[site_id].cameras[cam_id].folders.length; i++) {
                    let folder = surveyDeletedFolders[site_id].cameras[cam_id].folders[i];
                    deleted_folders.push({'folder': folder.folder, 'site_id': site_id});
                }
            }
        }

        let deleted_files = {
            'image_ids': [],
            'video_ids': [],
            'site_ids': []
        }
        for (let i = 0; i < surveyDeletedFiles.length; i++) {
            if (surveyDeletedFiles[i].type == 'image'){
                deleted_files['image_ids'].push(surveyDeletedFiles[i].id);
            } else if (surveyDeletedFiles[i].type == 'video'){
                deleted_files['video_ids'].push(surveyDeletedFiles[i].id);
            }
            if (!deleted_files['site_ids'].includes(surveyDeletedFiles[i].site_id)){
                deleted_files['site_ids'].push(surveyDeletedFiles[i].site_id);
            }
        }

        var formData = new FormData();
        // console.log(deleted_folders, deleted_files, move_folders, cleanEditedNames)
        formData.append('delete_folders', JSON.stringify(deleted_folders));
        formData.append('delete_files', JSON.stringify(deleted_files));
        formData.append('move_folders', JSON.stringify(move_folders));
        formData.append('name_changes', JSON.stringify(cleanEditedNames));

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                modalConfirmEditFiles.modal('hide')
                document.getElementById('btnConfirmEditFiles').disabled = false
                if (reply.status=='success') {
                    updatePage(current_page);
                } else {
                    document.getElementById('modalAlertHeader').innerHTML = 'Error'
                    document.getElementById('modalAlertBody').innerHTML = reply.message
                    modalAlert.modal({keyboard: true});
                }
            }
        }
        xhttp.open("POST", '/editSurveyFiles/'+selectedSurvey);
        xhttp.send(formData);

    }
}

function openEditFiles() {
    /** Opens the edit files tab. */

    var editFilesDiv = document.getElementById('editFilesDiv')
    if (editFilesDiv.firstChild==null) {

        // Heading
        var headingDiv = document.createElement('div')
        editFilesDiv.appendChild(headingDiv)

        var h5 = document.createElement('h5')
        h5.innerHTML = 'Survey Structure'
        h5.setAttribute('style','margin-bottom: 2px')
        headingDiv.appendChild(h5)

        var div = document.createElement('div')
        div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        div.innerHTML = '<i>Below is the current folder structure of your survey. You can edit the Site and Camera names directly and use the action buttons to manage your folders.</i>';
        headingDiv.appendChild(div)
        
        // Structure
        var div = document.createElement('div')
        div.id = 'folderDiv'
        editFilesDiv.appendChild(div)

        var searchRow = document.createElement('div')
        searchRow.setAttribute('class','row')
        searchRow.setAttribute('style','margin-top: 4px; margin-bottom: 4px')
        editFilesDiv.appendChild(searchRow)

        var scol1 = document.createElement('div')
        scol1.setAttribute('class', 'col-4')
        searchRow.appendChild(scol1)

        var scol2 = document.createElement('div')
        scol2.setAttribute('class', 'col-4')
        searchRow.appendChild(scol2)

        var scol3 = document.createElement('div')
        scol3.setAttribute('class', 'col-4')
        searchRow.appendChild(scol3)

        var input = document.createElement('input')
        input.setAttribute('type', 'text')
        input.setAttribute('class', 'form-control')
        input.setAttribute('placeholder', 'Search structure...')
        input.id = 'searchStructureInput'
        scol2.appendChild(input)
        
        $('#searchStructureInput').change(function() {
            filterFolderStructure();
        });

        headingDiv = document.createElement('div')
        headingDiv.id = 'delFoldersHeadingDiv'
        headingDiv.hidden = true
        editFilesDiv.appendChild(headingDiv)


        var h5 = document.createElement('h5')
        h5.setAttribute('style','margin-bottom: 2px')
        h5.innerHTML = 'Folders to Delete'
        headingDiv.appendChild(h5)

        var div = document.createElement('div')
        div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        div.innerHTML = '<i>Below are the folders you have selected to delete. </i>'
        headingDiv.appendChild(div)

        var deleteFolderDiv = document.createElement('div')
        deleteFolderDiv.id = 'deleteFolderDiv'
        editFilesDiv.appendChild(deleteFolderDiv)

        headingDiv = document.createElement('div')
        headingDiv.id = 'delFilesHeadingDiv'
        headingDiv.hidden = true
        editFilesDiv.appendChild(headingDiv)

        headingDiv.appendChild(document.createElement('br'))

        var h5 = document.createElement('h5')
        h5.innerHTML = 'Files to Delete'
        h5.setAttribute('style','margin-bottom: 2px')
        headingDiv.appendChild(h5)

        var div = document.createElement('div')
        div.setAttribute('style','font-size: 80%; margin-bottom: 2px')
        div.innerHTML = '<i>Below are the files you have selected to delete. </i>'
        headingDiv.appendChild(div)

        var deleteFilesDiv = document.createElement('div')
        deleteFilesDiv.id = 'deleteFilesDiv'
        editFilesDiv.appendChild(deleteFilesDiv)

        getSurveyFolders();

    }
}

$('#btnConfirmMoveFolder').on('click', function() {
    /** Event listener for confirming the move folder action. */
    var select = document.getElementById('moveFolderSiteSelector');
    var camSelect = document.getElementById('moveFolderCameraSelector');
    if (select.value == 'new'){
        var new_name = document.getElementById('moveFolderSiteName').value.trim();
        if (!validateName(new_name, 'site')){
            return;
        } 
        var new_site_id = 'n'+Date.now();
        siteNames[new_site_id] = new_name;
    } else {
        var new_site_id = select.value;
    }
    if (camSelect.value == 'new'){
        var new_cam_name = document.getElementById('moveFolderCameraName').value.trim();
        if (select.value == 'new'){
            if (!new_cam_name || new_cam_name.length == 0){
                return;
            }
        } else {
            if (!validateName(new_cam_name, 'camera', new_site_id)){
                return;
            }
        }
        var new_camera_id = 'n'+Date.now();
        camNames[new_camera_id] = new_cam_name;
    } else {
        var new_camera_id = camSelect.value;
    }
    if (new_site_id != selectedFolderToMove.site_id || new_camera_id != selectedFolderToMove.camera_id) {
        let old_site_id = selectedFolderToMove.site_id
        let old_camera_id = selectedFolderToMove.camera_id
        if (surveyMovedFolders[selectedFolderToMove.folder]) {
            old_site_id = surveyMovedFolders[selectedFolderToMove.folder]['old_site_id']
            old_camera_id = surveyMovedFolders[selectedFolderToMove.folder]['old_camera_id']
        }
        if (new_camera_id.startsWith('n') && !camNames[new_camera_id]) {
            camNames[new_camera_id] = camNames[new_camera_id.slice(1)];
        }
        surveyMovedFolders[selectedFolderToMove.folder] = {
            'folder': selectedFolderToMove.folder,
            'old_site_id': old_site_id,
            'old_camera_id': old_camera_id,
            'new_site_id': new_site_id,
            'new_camera_id': new_camera_id,
            'image_count': selectedFolderToMove.image_count,
            'video_count': selectedFolderToMove.video_count,
            'frame_count': selectedFolderToMove.frame_count
        };
        removeFolder(selectedFolderToMove.site_id, selectedFolderToMove.camera_id, selectedFolderToMove.folder, surveyFolders);
        selectedFolderToMove.moved = true;
        delete selectedFolderToMove.camera_id;
        delete selectedFolderToMove.site_id;
        addFolder(new_site_id, siteNames[new_site_id], new_camera_id, camNames[new_camera_id], selectedFolderToMove, surveyFolders);
        buildSurveyFolders()
    }
    modalMoveFolder.modal('hide')
});

modalMoveFolder.on('hidden.bs.modal', function () {
    /** Event handler for when the move folder modal is hidden. */
    editFilesActionOpen = false;
    clearSelect(document.getElementById('moveFolderSiteSelector'));
    clearSelect(document.getElementById('moveFolderCameraSelector'));
    document.getElementById('moveFolderSiteName').style.display = 'none';
    document.getElementById('moveFolderSiteName').value = '';
    document.getElementById('moveFolderCameraName').style.display = 'none';
    document.getElementById('moveFolderCameraName').value = '';
    document.getElementById('moveFolderPathDisplay').innerHTML = ''
    modalAddFiles.modal({keyboard: true});
});

modalFolderFiles.on('hidden.bs.modal', function () {
    /** Event handler for when the folder files modal is hidden. */
    editFilesActionOpen = false;
    cleanFolderContents();
    modalAddFiles.modal({keyboard: true});
});

function validateName(name, type, site_id=null, camera_id=null){ 
    /** Validates the edited site or camera name. */
    var valid_name = true;
    var pattern = /^[A-Za-z0-9._ -]+$/;
    if (name==null || name.length == 0 || name.length > 64 || !pattern.test(name)) {
        valid_name = false;
        return valid_name;
    }

    // check duplicate names
    if (type=='site') {
        for (let sid in siteNames) {
            if (site_id != null && sid == site_id) {
                continue;
            }
            if (siteNames[sid] == name) {
                valid_name = false;
                return valid_name;
            }
        }

    } else if (type=='camera') {
        for (let cid in surveyFolders[site_id].cameras) {
            if (cid == camera_id) {
                continue;
            }
            if (camNames[cid] == name) {
                valid_name = false;
                return valid_name;
            }
        }
    
    }

    return valid_name;
}

$('#moveFolderSiteSelector').on('change', function() {
    /** Event listener for when the site selection is changed in the move folder modal. */
    var site_id = this.value;
    var cameraSelect = document.getElementById('moveFolderCameraSelector');
    clearSelect(cameraSelect)
    let camID = selectedFolderToMove.camera_id;
    let optionTextsCam = [];
    let optionValuesCam = [];
    if (site_id != 'new' && surveyFolders[site_id]) {
        let cids = Object.keys(surveyFolders[site_id].cameras).sort((a, b) => camNames[a].localeCompare(camNames[b]));
        for (let cid of cids) {
            if (cid != camID) {
                optionTextsCam.push(camNames[cid]);
                optionValuesCam.push(cid);
            }
        }
    }
    if (!optionTextsCam.includes(camNames[camID])){
        optionTextsCam = [camNames[camID]].concat(optionTextsCam)
        optionValuesCam = ['n'+camID].concat(optionValuesCam)
    }
    optionTextsCam.push('NEW CAMERA')
    optionValuesCam.push('new')
    fillSelect(cameraSelect, optionTextsCam, optionValuesCam);

    document.getElementById('moveFolderSiteName').value = '';
    if (site_id == 'new'){
        document.getElementById('moveFolderSiteName').style.display = 'block';
        document.getElementById('moveFolderSiteName').focus();
    } else {
        document.getElementById('moveFolderSiteName').style.display = 'none';
    }
});

$('#moveFolderCameraSelector').on('change', function() {
    /** Event listener for when the camera selection is changed in the move folder modal. */
    var camera_id = this.value;
    document.getElementById('moveFolderCameraName').value = '';
    if (camera_id == 'new'){
        document.getElementById('moveFolderCameraName').style.display = 'block';
        document.getElementById('moveFolderCameraName').focus();
    } else {
        document.getElementById('moveFolderCameraName').style.display = 'none';
    }
});

modalFolderFiles.on('shown.bs.modal', function () {
    /** Event handler for when the folder files modal is shown. */

    deleted_file_ids = new Set();
    file_last_modified = {};
    getLastModified();
});

$('#filterFolderContentsInput').change(function() {
    /** Event listener for filtering the folder contents table. */
    getFolderContents();
});

$('#startDateContents').change(function() {
    /** Event listener for filtering the folder contents table by start date. */
    getFolderContents();
});

$('#endDateContents').change(function() {
    /** Event listener for filtering the folder contents table by end date. */
    getFolderContents();
});

$('#regExpCbxContents').on('change', function() {
    /** Event listener for toggling regex search in the folder contents table. */
    getFolderContents();
});

function getFolderContents(include_empty_last_modified=false) {
    /** Gets the contents of the selected folder. */
    editFiltersDisabledState(true);
    var contentsDiv = document.getElementById('folderContentsDiv');
    while (contentsDiv.firstChild) {
        contentsDiv.removeChild(contentsDiv.firstChild);
    }

    contentsDiv.style.display = 'flex';
    contentsDiv.style.alignItems = 'center';
    contentsDiv.style.justifyContent = 'center';
    contentsDiv.style.height = '100%';

    var loadCircle = document.createElement('div');
    loadCircle.setAttribute('class','loading-circle');
    contentsDiv.appendChild(loadCircle);
    loadCircle.style.display = 'block';

    document.getElementById('selectAllFiles').checked = false;

    if (selectedViewFolder && selectedViewFolder.folder && selectedViewFolder.camera_id) {

        var formData = new FormData();
        formData.append('folder', JSON.stringify(selectedViewFolder.folder));
        var regex_check = document.getElementById('regExpCbxContents').checked;
        var search_value = document.getElementById('filterFolderContentsInput').value;
        if (regex_check){
            formData.append('search', JSON.stringify(''));
        } else {
            formData.append('search', JSON.stringify(search_value));
        }
        var start_date = document.getElementById('startDateContents').value; 
        if(start_date != ''){
            start_date = start_date + ' 00:00:00'  
        } else {
            start_date = ''
        }
        formData.append('start_date', JSON.stringify(start_date));
        var end_date = document.getElementById('endDateContents').value;
        if(end_date != ''){
            end_date = end_date + ' 23:59:59'
        } else {
            end_date = ''
        }
        formData.append('end_date', JSON.stringify(end_date));
        if (include_empty_last_modified) {
            formData.append('include_zip_lm', JSON.stringify(file_last_modified));
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                folderFiles = reply.files;

                if (reply.empty_last_modified) {
                    for (let file in reply.empty_last_modified) {
                        file_last_modified[file] = (new Date(reply.empty_last_modified[file])).toLocaleDateString('en-CA').replace(/-/g, "/");
                    }
                }

                if (regex_check && search_value.trim() != ''){
                    var pattern = new RegExp(search_value);
                    folderFiles = folderFiles.filter(function(fileObj) {
                        return pattern.test(fileObj.name);
                    });
                }

                let already_deleted_file_ids = surveyDeletedFiles.map(f => f.id);
                already_deleted_file_ids = already_deleted_file_ids.concat((Array.from(deleted_file_ids)));
                for (var file_idx in folderFiles) {
                    if (already_deleted_file_ids.includes(folderFiles[file_idx].id)) {
                        folderFiles[file_idx].to_delete = true;
                    }
                    // asign last modified date
                    let lm_date = file_last_modified[folderFiles[file_idx].folder+'/'+folderFiles[file_idx].name] ? file_last_modified[folderFiles[file_idx].folder+'/'+folderFiles[file_idx].name] : null;
                    if (!lm_date && folderFiles[file_idx].type=='video'){
                        let idx = folderFiles[file_idx].name.lastIndexOf('.')
                        let fn = folderFiles[file_idx].name.substring(0, idx) + '.mp4';
                        lm_date = file_last_modified[folderFiles[file_idx].folder+'/'+fn] ? file_last_modified[folderFiles[file_idx].folder+'/'+fn] : null;
                    }
                    folderFiles[file_idx].last_modified = lm_date;
                }

                //Filter by last modified date
                var lm_start_date = document.getElementById('lastModifiedStartDate').value;
                var lm_end_date = document.getElementById('lastModifiedEndDate').value;
                if (lm_start_date != '' || lm_end_date != '') {
                    let start_dt = lm_start_date != '' ? new Date(lm_start_date + ' 00:00:00') : null;
                    let end_dt = lm_end_date != '' ? new Date(lm_end_date + ' 23:59:59') : null;
                    folderFiles = folderFiles.filter(function(fileObj) {
                        let lm_date = fileObj.last_modified ? fileObj.last_modified : null;
                        if (!lm_date) {
                            return false;
                        }
                        let file_lm = new Date(lm_date);
                        if (start_dt && file_lm < start_dt) {
                            return false;
                        }
                        if (end_dt && file_lm > end_dt) {
                            return false;
                        }
                        return true;
                    });
                }
                
                orderFilesBy(currentFileOrder.column, currentFileOrder.direction);
                buildContentsTable();
                editFiltersDisabledState(false);
            }
        }
        xhttp.open("POST", '/getFolderContents/'+selectedViewFolder.camera_id);
        xhttp.send(formData);

    } else {
        while (contentsDiv.firstChild) {
            contentsDiv.removeChild(contentsDiv.firstChild);
        }
        editFiltersDisabledState(false);
    }
}

function getLastModified(token=null) {
    /** Gets the contents of the selected folder. */
    if (!token) {
        editFiltersDisabledState(true);
        var contentsDiv = document.getElementById('folderContentsDiv');
        while (contentsDiv.firstChild) {
            contentsDiv.removeChild(contentsDiv.firstChild);
        }

        contentsDiv.style.display = 'flex';
        contentsDiv.style.alignItems = 'center';
        contentsDiv.style.justifyContent = 'center';
        contentsDiv.style.height = '100%';

        var loadCircle = document.createElement('div');
        loadCircle.setAttribute('class','loading-circle');
        contentsDiv.appendChild(loadCircle);
        loadCircle.style.display = 'block';
    }
    
    if (selectedViewFolder && selectedViewFolder.folder && selectedViewFolder.camera_id) {
        var formData = new FormData();
        formData.append('folder', JSON.stringify(selectedViewFolder.folder));
        formData.append('cameragroup_id', JSON.stringify(selectedViewFolder.camera_id));
        if (token) {
            formData.append('token', JSON.stringify(token));
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                let contents = reply.contents;

                for (let file in contents.files) {
                    file_last_modified[file] = (new Date(contents.files[file])).toLocaleDateString('en-CA').replace(/-/g, "/");
                }
                if (contents.token!=null) {
                    getLastModified(contents.token);
                } else {
                    getFolderContents(true);
                }
            }
        }
        xhttp.open("POST", '/getFolderLastModified');
        xhttp.send(formData);

    } else {
        while (contentsDiv.firstChild) {
            contentsDiv.removeChild(contentsDiv.firstChild);
        }
        editFiltersDisabledState(false);
    }
}

function editFiltersDisabledState(state) {
    document.getElementById('filterFolderContentsInput').disabled = state;
    document.getElementById('startDateContents').disabled = state;
    document.getElementById('endDateContents').disabled = state;
    document.getElementById('regExpCbxContents').disabled = state;
    document.getElementById('lastModifiedStartDate').disabled = state;
    document.getElementById('lastModifiedEndDate').disabled = state;
    document.getElementById('selectAllFiles').disabled = state;
}

function buildContentsTable() {
    /** Builds the folder contents table. */
    var contentsDiv = document.getElementById('folderContentsDiv');
    while (contentsDiv.firstChild) {
        contentsDiv.removeChild(contentsDiv.firstChild);
    }

    contentsDiv.style.alignItems = 'flex-start';
    contentsDiv.style.justifyContent = 'flex-start';

    if (folderFiles.length == 0) {
        var div = document.createElement('div');
        div.innerHTML = 'No files found in this folder.';
        contentsDiv.appendChild(div);
        return;
    }

    var tableDiv = document.createElement('div')
    tableDiv.setAttribute('class','table-responsive')
    tableDiv.setAttribute('style','max-height:500px')
    tableDiv.id='folder_contents_table_div'
    contentsDiv.appendChild(tableDiv)

    var table = document.createElement('table')
    table.classList.add('table');
    table.classList.add('table-striped');
    table.classList.add('table-bordered');
    table.style.borderCollapse = 'collapse'
    table.style.border = '1px solid rgba(0,0,0,0)'
    table.style.marginBottom = '2px'
    table.id = 'folder_contents_tbl'
    tableDiv.appendChild(table)

    var thead = document.createElement('thead');
    table.appendChild(thead);
    var headerRow = document.createElement('tr');
    thead.appendChild(headerRow);

    var thFilename = document.createElement('th');
    thFilename.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    thFilename.innerHTML = 'Filename';
    headerRow.appendChild(thFilename);

    if (currentFileOrder.column == 'filename') {
        if (currentFileOrder.direction == 'asc') {
            thFilename.innerHTML += ' <i class="fa fa-sort-up"></i>';
        } else {
            thFilename.innerHTML += ' <i class="fa fa-sort-down"></i>';
        }
    }

    // add ordering functionality to the name header column
    thFilename.style.cursor = 'pointer';
    thFilename.title = 'Sort by Filename';
    thFilename.addEventListener('click', function() {
        /** Event listener for sorting the folder contents table by filename. */
        if (currentFileOrder.column == 'filename' && currentFileOrder.direction == 'asc') {
            orderFilesBy('filename', 'desc');
        } else {
            orderFilesBy('filename', 'asc');
        }
        buildContentsTable();
    });

    var thTimestamp = document.createElement('th');
    thTimestamp.setAttribute('style', 'width: 22%; vertical-align: middle; padding: 8px 12px;');
    thTimestamp.innerHTML = 'Timestamp';
    headerRow.appendChild(thTimestamp);

    if (currentFileOrder.column == 'timestamp') {
        if (currentFileOrder.direction == 'asc') {
            thTimestamp.innerHTML += ' <i class="fa fa-sort-up"></i>';
        } else {
            thTimestamp.innerHTML += ' <i class="fa fa-sort-down"></i>';
        }
    }

    thTimestamp.style.cursor = 'pointer';
    thTimestamp.title = 'Sort by Timestamp';
    thTimestamp.addEventListener('click', function() {
        /** Event listener for sorting the folder contents table by timestamp. */
        if (currentFileOrder.column == 'timestamp' && currentFileOrder.direction == 'asc') {
            orderFilesBy('timestamp', 'desc');
        } else {
            orderFilesBy('timestamp', 'asc');
        }
        buildContentsTable();
    });

    var thLastModified = document.createElement('th');
    thLastModified.setAttribute('style', 'width: 14%; vertical-align: middle; padding: 8px 12px;');
    thLastModified.innerHTML = 'Import Date';
    headerRow.appendChild(thLastModified);

    if (currentFileOrder.column == 'last_modified') {
        if (currentFileOrder.direction == 'asc') {
            thLastModified.innerHTML += ' <i class="fa fa-sort-up"></i>';
        } else {
            thLastModified.innerHTML += ' <i class="fa fa-sort-down"></i>';
        }
    }

    thLastModified.style.cursor = 'pointer';
    thLastModified.title = 'Sort by Import Date';
    thLastModified.addEventListener('click', function() {
        /** Event listener for sorting the folder contents table by last modified date. */
        if (currentFileOrder.column == 'last_modified' && currentFileOrder.direction == 'asc') {
            orderFilesBy('last_modified', 'desc');
        } else {
            orderFilesBy('last_modified', 'asc');
        }
        buildContentsTable();
    });

    var thDelete = document.createElement('th');
    thDelete.innerHTML = 'Delete';
    thDelete.setAttribute('style', 'width: 6%; text-align: center; vertical-align: middle; padding: 8px 12px;');
    headerRow.appendChild(thDelete);

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    for (var file_idx in folderFiles) {
        var fileObj = folderFiles[file_idx];
        var tr = document.createElement('tr');
        tr.setAttribute('id', 'file-'+fileObj.id);
        tbody.appendChild(tr);

        var tdFilename = document.createElement('td');
        tdFilename.setAttribute('style', 'text-align: left; vertical-align: middle; padding: 8px 12px;');
        tdFilename.innerHTML = fileObj.name;
        tr.appendChild(tdFilename); 

        var tdTimestamp = document.createElement('td');
        tdTimestamp.setAttribute('style', 'text-align: left; vertical-align: middle; padding: 8px 12px;');
        tdTimestamp.innerHTML = fileObj.timestamp;
        tr.appendChild(tdTimestamp);

        var tdLastModified = document.createElement('td');
        tdLastModified.setAttribute('style', 'text-align: left; vertical-align: middle; padding: 8px 12px;');
        tdLastModified.innerHTML = fileObj.last_modified ? fileObj.last_modified : 'N/A';
        tr.appendChild(tdLastModified);

        var tdDelete = document.createElement('td');
        tdDelete.setAttribute('style', 'text-align: center; vertical-align: middle; padding: 8px 12px;');
        tdDelete.id = 'deleteFile-'+fileObj.id;

        if (fileObj.to_delete) {
            var undoIcon = document.createElement('i');
            undoIcon.classList.add('fa', 'fa-undo');
            undoIcon.setAttribute('style', 'cursor: pointer;');
            undoIcon.setAttribute('title', 'Undo Delete File');
            tdDelete.appendChild(undoIcon);
            tr.appendChild(tdDelete);

            undoIcon.addEventListener('click', function(fileIDX) {
                return function() {
                    /** Event listener for undoing the deletion of a file from the folder contents table. */
                    delete folderFiles[fileIDX].to_delete;
                    deleted_file_ids.delete(folderFiles[fileIDX].id);
                    var scrollpos = document.getElementById('folder_contents_table_div').scrollTop;
                    buildContentsTable();
                    if (document.getElementById('folder_contents_table_div')) {
                        document.getElementById('folder_contents_table_div').scrollTop = scrollpos;
                    }
                };
            }(file_idx));

            tr.style.backgroundColor = 'rgba(223, 105, 26, 0.3)';

        } else {
            var deleteIcon = document.createElement('i');
            deleteIcon.classList.add('fa', 'fa-trash-can');
            deleteIcon.setAttribute('style', 'cursor: pointer;');
            deleteIcon.setAttribute('title', 'Delete File');
            tdDelete.appendChild(deleteIcon);
            tr.appendChild(tdDelete);

            deleteIcon.addEventListener('click', function(fileIDX) {
                return function() {
                    /** Event listener for deleting a file from the folder contents table. */
                    folderFiles[fileIDX].to_delete = true;
                    deleted_file_ids.add(folderFiles[fileIDX].id);
                    var scrollpos = document.getElementById('folder_contents_table_div').scrollTop;
                    buildContentsTable();
                    if (document.getElementById('folder_contents_table_div')) {
                        document.getElementById('folder_contents_table_div').scrollTop = scrollpos;
                    }
                };
            }(file_idx));
        }
    }

}

function cleanFolderContents() {
    /** Cleans up the folder contents modal when closed. */
    var contentsDiv = document.getElementById('folderContentsDiv');
    while (contentsDiv.firstChild) {
        contentsDiv.removeChild(contentsDiv.firstChild);
    }

    folderFiles = [];
    selectedViewFolder = null;
    deleted_file_ids.clear();
    currentFileOrder = { column: 'filename', direction: 'asc' };
    file_last_modified = {};

    document.getElementById('folderPathDisplay').innerHTML = '';
    document.getElementById('filterFolderContentsInput').value = '';
    document.getElementById('startDateContents').value = '';
    document.getElementById('endDateContents').value = '';
    document.getElementById('lastModifiedStartDate').value = '';
    document.getElementById('lastModifiedEndDate').value = '';
    document.getElementById('regExpCbxContents').checked = false;
    document.getElementById('selectAllFiles').checked = false;
}

$('#btnConfirmDeleteFiles').on('click', function() {
    /** Event listener for confirming the deletion of files from the folder contents modal. */
    let already_deleted_file_ids = surveyDeletedFiles.map(file => file.id );
    let remove_ids = [];
    for (var file_idx in folderFiles) {
        var fileObj = folderFiles[file_idx];
        if (fileObj.to_delete && !already_deleted_file_ids.includes(fileObj.id)) {
            let opj_cpy = Object.assign({}, fileObj);
            delete opj_cpy.to_delete;
            surveyDeletedFiles.push(opj_cpy);
        } else if (!fileObj.to_delete && already_deleted_file_ids.includes(fileObj.id)) {
            remove_ids.push(fileObj.id);
        }
    }
    surveyDeletedFiles = surveyDeletedFiles.filter(function(value, index, arr){
        return !remove_ids.includes(value.id);
    });
    //order by folder and name
    surveyDeletedFiles.sort(function(a, b) {
        if (a.folder === b.folder) {
            return a.name.localeCompare(b.name);
        }
        return a.folder.localeCompare(b.folder);
    });
    modalFolderFiles.modal('hide');
    buildSurveyDeletedFiles();
});

function buildSurveyDeletedFiles() {
    /** Builds the survey deleted files section in the edit files tab. */
    var delFilesHeadingDiv = document.getElementById('delFilesHeadingDiv');
    var deleteFilesDiv = document.getElementById('deleteFilesDiv');

    while (deleteFilesDiv.firstChild) {
        deleteFilesDiv.removeChild(deleteFilesDiv.firstChild);
    }

    if (surveyDeletedFiles.length == 0) {
        delFilesHeadingDiv.hidden = true;
        return;
    } else {
        delFilesHeadingDiv.hidden = false;
    }

    var tableDiv = document.createElement('div')
    tableDiv.setAttribute('class','table-responsive')
    tableDiv.setAttribute('style','max-height:385px')
    tableDiv.id='deleted_files_table_div'
    deleteFilesDiv.appendChild(tableDiv)

    var table = document.createElement('table')
    table.classList.add('table');
    table.classList.add('table-striped');
    table.classList.add('table-bordered');
    table.style.borderCollapse = 'collapse'
    table.style.border = '1px solid rgba(0,0,0,0)'
    table.style.marginBottom = '2px'
    table.id = 'deleted_files_tbl'
    tableDiv.appendChild(table)

    var thead = document.createElement('thead');
    table.appendChild(thead);
    var headerRow = document.createElement('tr');
    thead.appendChild(headerRow);

    var thFilename = document.createElement('th');
    thFilename.setAttribute('style', 'vertical-align: middle; padding: 8px 12px;');
    thFilename.innerHTML = 'Filename';
    headerRow.appendChild(thFilename);

    var thRestore = document.createElement('th');
    thRestore.innerHTML = 'Action';
    thRestore.setAttribute('style', 'width: 12%; text-align: center; vertical-align: middle; padding: 8px 12px;');
    headerRow.appendChild(thRestore);

    var tbody = document.createElement('tbody');
    table.appendChild(tbody);

    for (var file_idx in surveyDeletedFiles) {
        var fileObj = surveyDeletedFiles[file_idx];
        var tr = document.createElement('tr');
        tr.setAttribute('id', 'deleted_file-'+fileObj.id);
        tbody.appendChild(tr);

        var tdFilename = document.createElement('td');
        tdFilename.setAttribute('style', 'text-align: left; vertical-align: middle; padding: 8px 12px;');
        tdFilename.innerHTML = fileObj.folder.split('/').slice(1).join('/') + '/' + fileObj.name;
        tr.appendChild(tdFilename); 

        var tdRestore = document.createElement('td');
        tdRestore.setAttribute('style', 'text-align: center; vertical-align: middle; padding: 8px 12px;');
        tr.appendChild(tdRestore);

        var restoreIcon = document.createElement('i');
        restoreIcon.classList.add('fa', 'fa-undo');
        restoreIcon.setAttribute('style', 'cursor: pointer;');
        restoreIcon.setAttribute('title', 'Restore File');
        tdRestore.appendChild(restoreIcon);

        restoreIcon.addEventListener('click', function(fileIDX) {
            return function() {
                /** Event listener for restoring a deleted file from the survey deleted files section. */
                surveyDeletedFiles.splice(fileIDX, 1);
                var scrollpos = document.getElementById('deleted_files_table_div').scrollTop;
                buildSurveyDeletedFiles();
                if (document.getElementById('deleted_files_table_div')) {
                    document.getElementById('deleted_files_table_div').scrollTop = scrollpos;
                }
            };
        }(file_idx));
    }
}

function filterFolderStructure() {
    /** Filters the folder structure table based on the search input. */
    var input = document.getElementById('searchStructureInput');
    var filter = input.value.toLowerCase();

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            folders = reply.folders
            surveyFolders = folders

            // remove all the folders that are in deleted folders
            for (let site_id in surveyDeletedFolders){
                for (let cam_id in surveyDeletedFolders[site_id].cameras){
                    for (let i = 0; i < surveyDeletedFolders[site_id].cameras[cam_id].folders.length; i++) {
                        let folder = surveyDeletedFolders[site_id].cameras[cam_id].folders[i];
                        removeFolder(site_id, cam_id, folder.folder, surveyFolders);
                    }
                }
            }

            // move folders that are in moved folders
            for (let folder in surveyMovedFolders){
                let moveInfo = surveyMovedFolders[folder];
                removeFolder(moveInfo.old_site_id, moveInfo.old_camera_id, moveInfo.folder, surveyFolders);
                let folderObj = { folder: moveInfo.folder, image_count: moveInfo.image_count, video_count: moveInfo.video_count, frame_count: moveInfo.frame_count, moved: true };
                addFolder(moveInfo.new_site_id, siteNames[moveInfo.new_site_id], moveInfo.new_camera_id, camNames[moveInfo.new_camera_id], folderObj, surveyFolders);
            }

            buildSurveyFolders()
        }
    }
    xhttp.open("GET", '/getSurveyFolders/'+selectedSurvey+'?search='+encodeURIComponent(filter));
    xhttp.send();
}

$('#lastModifiedStartDate, #lastModifiedEndDate').on('change', function() {
    /** Event listener for filtering the folder contents table by last modified date. */
    getFolderContents();
});

$('#selectAllFiles').on('change', function() {
    /** Event listener for selecting or deselecting all files in the folder contents table. */
    var selectAll = this.checked;
    for (var file_idx in folderFiles) {
        var fileObj = folderFiles[file_idx];
        if (selectAll) {
            if (!fileObj.to_delete) {
                folderFiles[file_idx].to_delete = true;
                deleted_file_ids.add(fileObj.id);
            }
        } else {
            if (fileObj.to_delete) {
                delete folderFiles[file_idx].to_delete;
                deleted_file_ids.delete(fileObj.id);
            }
        }
    }
    buildContentsTable();
});

function orderFilesBy(column, direction) {
    /** Orders the folder files by the specified column and direction. */

    folderFiles.sort(function(a, b) {
        var res = 0;
        if (column == 'filename') {
            if (a.name < b.name) res = -1;
            else if (a.name > b.name) res = 1;
            else res = 0;
        } else if (column == 'timestamp') {
            res = new Date(a.timestamp) - new Date(b.timestamp);
        } else if (column == 'last_modified') {
            res = new Date(a.last_modified) - new Date(b.last_modified);
        }

        res = direction == 'asc' ? res : -res;

        if (res == 0) {
            if (a.name < b.name) res = -1;
            else if (a.name > b.name) res = 1;
            else res = 0;
        }

        return res;
    });

    currentFileOrder.column = column;
    currentFileOrder.direction = direction;
}

$('#openAddFilesTab').on('click', function() {
    /** Event listener for opening the add files tab. */
    if (Object.keys(surveyDeletedFolders).length>0 || Object.keys(surveyMovedFolders).length>0 || surveyDeletedFiles.length>0 || Object.keys(surveyEditedNames['site']).length>0 || Object.keys(surveyEditedNames['camera']).length>0) {
        document.getElementById('manageCloseWarning').innerHTML = 'Any unsaved changes will be lost if you change tabs.';
        filesTabChange = true
        modalAddFiles.modal('hide');
        modalManageFilesClose.modal({keyboard: true});
    } else {
        filesTabChange = false
        changeFilesTab(event, 'baseAddFilesTab')
    }
});

$('#openEditFilesTab').on('click', function() {
    /** Event listener for opening the edit files tab. */
    let pathDisplay = document.getElementById('pathDisplay');
    if (pathDisplay && pathDisplay.children.length > 0) {
        document.getElementById('manageCloseWarning').innerHTML = 'Any unsaved changes will be lost if you change tabs.';
        filesTabChange = true
        modalAddFiles.modal('hide');
        modalManageFilesClose.modal({keyboard: true});
    } else {
        filesTabChange = false
        changeFilesTab(event, 'baseEditFilesTab')
    }

});