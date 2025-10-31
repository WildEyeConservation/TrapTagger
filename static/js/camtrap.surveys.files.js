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
                            let sids = Object.keys(surveyFolders).sort((a, b) => siteNames[a].localeCompare(siteNames[b]));
                            for (let sid of sids) {
                                optionTexts.push(siteNames[sid])
                                optionValues.push(sid)
                            }
                            fillSelect(select, optionTexts, optionValues)

                            var cameraSelect = document.getElementById('moveFolderCameraSelector');
                            clearSelect(cameraSelect)
                            let optionTextsCam = []
                            let optionValuesCam = []
                            let cids = Object.keys(surveyFolders[sids[0]].cameras).sort((a, b) => camNames[a].localeCompare(camNames[b]));
                            for (let cid of cids) {
                                optionTextsCam.push(camNames[cid])
                                optionValuesCam.push(cid)
                            }
                            if (!optionTextsCam.includes(camNames[camID])){
                                optionTextsCam = [camNames[camID]].concat(optionTextsCam)
                                optionValuesCam = [camID].concat(optionValuesCam)
                            }
                            fillSelect(cameraSelect, optionTextsCam, optionValuesCam)

                            modalAddFiles.modal('hide');
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
    site_id = parseInt(site_id);
    cam_id = parseInt(cam_id);
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
    }
}

function addFolder(site_id, site_name, cam_id, cam_name, folder_obj, source){
    /** Adds a folder to the source (either 'surveyFolders' or 'surveyDeletedFolders'). */
    site_id = parseInt(site_id);
    cam_id = parseInt(cam_id);
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


});

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
        

        headingDiv = document.createElement('div')
        headingDiv.id = 'delFoldersHeadingDiv'
        headingDiv.hidden = true
        editFilesDiv.appendChild(headingDiv)

        headingDiv.appendChild(document.createElement('br'))

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
    var new_site_id = select.value;
    var new_camera_id = camSelect.value;
    if (new_site_id != selectedFolderToMove.site_id || new_camera_id != selectedFolderToMove.camera_id) {
        let old_site_id = selectedFolderToMove.site_id
        let old_camera_id = selectedFolderToMove.camera_id
        if (surveyMovedFolders[selectedFolderToMove.folder]) {
            old_site_id = surveyMovedFolders[selectedFolderToMove.folder]['old_site_id']
            old_camera_id = surveyMovedFolders[selectedFolderToMove.folder]['old_camera_id']
        }
        surveyMovedFolders[selectedFolderToMove.folder] = {
            'folder': selectedFolderToMove.folder,
            'old_site_id': old_site_id,
            'old_camera_id': old_camera_id,
            'new_site_id': new_site_id,
            'new_camera_id': new_camera_id,
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
    var pattern = /^[a-zA-Z0-9 _-]+$/;
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
    let cids = Object.keys(surveyFolders[site_id].cameras).sort((a, b) => camNames[a].localeCompare(camNames[b]));
    for (let cid of cids) {
        if (cid != camID) {
            optionTextsCam.push(camNames[cid]);
            optionValuesCam.push(cid);
        }
    }
    if (!optionTextsCam.includes(camNames[camID])){
        optionTextsCam = [camNames[camID]].concat(optionTextsCam)
        optionValuesCam = [camID].concat(optionValuesCam)
    }
    fillSelect(cameraSelect, optionTextsCam, optionValuesCam);
});

modalFolderFiles.on('shown.bs.modal', function () {
    /** Event handler for when the folder files modal is shown. */
    // buildFolderFilesTable();
    getFolderContents();
});

function getFolderContents() {
    /** Gets the contents of the selected folder via an AJAX request. */
    var contentsDiv = document.getElementById('folderContentsDiv');
    while (contentsDiv.firstChild) {
        contentsDiv.removeChild(contentsDiv.firstChild);
    }

    if (selectedViewFolder && selectedViewFolder.folder && selectedViewFolder.camera_id) {

        var formData = new FormData();
        formData.append('folder', JSON.stringify(selectedViewFolder.folder));
        
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                folderFiles = reply.files;
                let already_deleted_file_ids = surveyDeletedFiles.map(f => f.id);
                for (var file_idx in folderFiles) {
                    if (already_deleted_file_ids.includes(folderFiles[file_idx].id)) {
                        folderFiles[file_idx].to_delete = true;
                    }
                }
                buildContentsTable();
            }
        }
        xhttp.open("POST", '/getFolderContents/'+selectedViewFolder.camera_id);
        xhttp.send(formData);

    }
}

function buildContentsTable() {
    /** Builds the folder contents table. */
    var contentsDiv = document.getElementById('folderContentsDiv');
    while (contentsDiv.firstChild) {
        contentsDiv.removeChild(contentsDiv.firstChild);
    }

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

    var thDelete = document.createElement('th');
    thDelete.innerHTML = 'Delete';
    thDelete.setAttribute('style', 'width: 8%; text-align: center; vertical-align: middle; padding: 8px 12px;');
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
        tdFilename.innerHTML = fileObj.name.split('/').slice(1).join('/');
        tr.appendChild(tdFilename); 

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
    document.getElementById('folderPathDisplay').innerHTML = '';
}

$('#btnConfirmDeleteFiles').on('click', function() {
    /** Event listener for confirming the deletion of files from the folder contents modal. */
    let already_deleted_file_ids = surveyDeletedFiles.map(file => file.id );
    let remove_ids = [];
    for (var file_idx in folderFiles) {
        var fileObj = folderFiles[file_idx];
        if (fileObj.to_delete && !already_deleted_file_ids.includes(fileObj.id)) {
            surveyDeletedFiles.push({
                'id': fileObj.id,
                'name': fileObj.name,
                'folder': selectedViewFolder.folder,
            });
        } else if (!fileObj.to_delete && already_deleted_file_ids.includes(fileObj.id)) {
            remove_ids.push(fileObj.id);
        }
    }
    surveyDeletedFiles = surveyDeletedFiles.filter(function(value, index, arr){
        return !remove_ids.includes(value.id);
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
        tdFilename.innerHTML = fileObj.name.split('/').slice(1).join('/');
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
                let fileObj = surveyDeletedFiles[fileIDX];
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