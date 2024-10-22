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

var prevModal = null
var helpReturn = false
var modalActive = false
var notificationTimer = null
var notifications_next = null
var notifications_prev = null
var notifications_current_page = 1
var downloadsTimer = null
var downloads_next = null
var downloads_prev = null
var downloads_current_page = 1
const modalHelp = $('#modalHelp');
const modalNotification = $('#modalNotification');
var currentDownloads = []

function getActiveModal() {
    /** Returns the ID of the currently active modal. Returns null otherwise. */
    activeModal = null
    allModals = document.querySelectorAll('[id^=modal]');
    for (let i=0;i<allModals.length;i++) {
        if (allModals[i].classList.contains('show')) {
            activeModal = allModals[i].id
            break
        }
    }
    return activeModal
}

function helpOpen(requiredHelp) {
    /** Handles the opening of the help modal by requesting the necessary text from the server. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                text = JSON.parse(this.responseText);
                helpDiv = document.getElementById('helpBody')
                helpDiv.innerHTML = text
                prevModal = getActiveModal()
                if (prevModal) {
                    $('#'+prevModal).modal('hide');
                }
                helpReturn = true
                modalActive = true
                modalHelp.modal({keyboard: true});
            }
        };
    xhttp.open("GET", '/getHelp?req=' + requiredHelp);
    xhttp.send();
}

function helpClose() {
    /** Handles the clsoing of the help modal by re-opening the previous modal. */
    modalActive = false
    modalHelp.modal('hide');
    if (prevModal) {
        $('#'+prevModal).modal({keyboard: true});
    }
}

function takeJob(jobID) {
    /** Requests the selected job, and re-directs the user to that job if its still available. */
    document.getElementById('takeJobBtn'+jobID.toString()).disabled = true
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(wrapJobID){
        return function() {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if (reply.status=='success') {
                    if (reply.code.includes('tutorial')) {
                        localStorage.setItem("currentTask", reply.code.split('/tutorial/')[1])
                        window.location.replace('/tutorial')
                    } else {
                        window.location.replace(reply.code)
                    }
                } else {
                    document.getElementById('modalAlertHeader').innerHTML = 'Alert'
                    document.getElementById('modalAlertBody').innerHTML = 'Sorry, it appears that somebody snatched the last job before you!'
                    modalAlert.modal({keyboard: true});
                    document.getElementById('takeJobBtn'+wrapJobID.toString()).disabled = false
                }
            }
        }
    }(jobID)
    xhttp.open("GET", '/takeJob/'+jobID);
    xhttp.send();
}

function openNotifications() {
    /** Builds a notification dropdown menu and opens it. */
    checkNotifications()

    if (notifications_current_page == null){
        notifications_current_page = 1
    }

    // Get the notifications
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);


            var notifications = reply.notifications;
            var notificationMenu = document.getElementById('notificationMenu');
            while (notificationMenu.firstChild) {
                notificationMenu.removeChild(notificationMenu.firstChild);
            }

            for (let i = 0; i < notifications.length; i++) {
                let notification = document.createElement('div');
                notification.id = 'notification-' + notifications[i].id;
                notification.setAttribute('style','border-bottom: 1px solid rgb(60,74,89); padding: 10px; padding-right: 10px; height: auto; cursor: pointer;');
                notificationMenu.appendChild(notification);

                p = document.createElement('p');
                p.setAttribute('style', 'margin-bottom: 0px; margin-top: 0px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;');
                p.innerHTML = notifications[i].contents;
                notification.appendChild(p);

                if (notifications[i].seen == false) {
                    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }
                else{
                    notification.style.backgroundColor = '';
                }

                notification.addEventListener('click', (function (notification) {
                    return function () {
                        // Check if this click was on a link on the notification or not
                        if (event.target.tagName != 'A') {
                            var modalNotificationBody = document.getElementById('modalNotificationBody');
                            modalNotificationBody.innerHTML = '<p>' + notification.contents + '</p>';
                            modalNotification.modal({ keyboard: true });

                            if (notification.seen == false) {
                                var xhttp = new XMLHttpRequest();
                                xhttp.onreadystatechange = function () {
                                    if (this.readyState == 4 && this.status == 200) {
                                        reply = JSON.parse(this.responseText);
                                        if (reply.status == 'SUCCESS') {
                                            document.getElementById('notificationBadge').innerHTML = parseInt(document.getElementById('notificationBadge').innerHTML) - 1;
                                            document.getElementById('notification-' + notification.id).style.backgroundColor = '';
                                        }
                                    }
                                };
                                xhttp.open('GET', '/markNotificationSeen/' + notification.id);
                                xhttp.send();
                            }
                        }
                    };
                })(notifications[i]));
                
                notification.addEventListener('mouseover', function () {
                    this.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                });

                notification.addEventListener('mouseout', function (notifSeen) {
                    return function () {
                        if (notifSeen) {
                            this.style.backgroundColor = '';
                        }
                        else {
                            this.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                        }
                    }
                }(notifications[i].seen));
            }

            if (notifications.length == 0) {
                var notificationsCard = document.getElementById('notificationsCard')
                notificationsCard.getElementsByClassName('card-footer')[0].setAttribute('style', 'border-top: 1px solid rgb(60,74,89);');
            }
            else {
                var notificationsCard = document.getElementById('notificationsCard')
                notificationsCard.getElementsByClassName('card-footer')[0].setAttribute('style', 'border-top: none;');
            }

            notifications_next = reply.next;
            if( notifications_next == null){
                document.getElementById('btnNextNotifications').disabled = true;
            }
            else{
                document.getElementById('btnNextNotifications').disabled = false;
            }

            notifications_prev = reply.prev;
            if( notifications_prev == null){
                document.getElementById('btnPrevNotifications').disabled = true;
            }
            else{
                document.getElementById('btnPrevNotifications').disabled = false;
            }

        }
    };
    xhttp.open('GET', '/getNotifications?page=' + notifications_current_page);
    xhttp.send();
}

$('#btnNextNotifications').click(function(event){
    notifications_current_page = notifications_next
    event.stopPropagation()
    openNotifications()
});

$('#btnPrevNotifications').click(function(event){
    notifications_current_page = notifications_prev
    event.stopPropagation()
    openNotifications()
});

$('#btnClearNotifications').click(function(event){
    event.stopPropagation()
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply.status == 'SUCCESS') {
                document.getElementById('notificationBadge').innerHTML = 0;
                openNotifications()
            }
        }
    };
    xhttp.open('GET', '/clearNotifications');
    xhttp.send();
});

modalNotification.on('hidden.bs.modal', function () {
    document.getElementById('modalNotificationBody').innerHTML = '';
    document.getElementById('notificationsButton').click();
});


function checkNotifications() {
    /**Checks for and displays new notifications.*/
    if (document.getElementById('notificationBadge')) {
        url = '/checkNotifications'
        if (modalNotification.is(':visible')) {
            url+='?allow_global=false'
        }
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", url);
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  

                if (reply.global_notification && reply.global_notification.contents) {
                    document.getElementById('modalNotificationBody').innerHTML = reply.global_notification.contents;
                    modalNotification.modal({keyboard: true});
                }

                var notificationBadge = document.getElementById('notificationBadge')
                notificationBadge.innerHTML = reply.total_unseen

                if (reply.total_unseen > 0) {
                    document.getElementById('btnClearNotifications').hidden = false;
                }
                else {
                    document.getElementById('btnClearNotifications').hidden = true;
                }

                if (notificationTimer) {
                    clearTimeout(notificationTimer)
                }

                notificationTimer = setTimeout(checkNotifications, 30000)
            }
        }
        xhttp.send();
    }
    else{
        if (notificationTimer) {
            clearTimeout(notificationTimer)
        }
        notificationTimer = setTimeout(checkNotifications, 30000)
    }
}

function openDownloads(){
    /** Opens the downloads modal. */

    checkDownloads()

    if (downloads_current_page == null){
        downloads_current_page = 1
    }
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            var download_requests = reply.download_requests;

            var downloadsMenu = document.getElementById('downloadsMenu');
            while (downloadsMenu.firstChild) {
                downloadsMenu.removeChild(downloadsMenu.firstChild);
            }

            if (download_requests.length == 0) {
                var downloadsCard = document.getElementById('downloadsCard')
                downloadsCard.getElementsByClassName('card-footer')[0].setAttribute('style', 'border-top: 1px solid rgb(60,74,89);');
            }
            else {
                var downloadsCard = document.getElementById('downloadsCard')
                downloadsCard.getElementsByClassName('card-footer')[0].setAttribute('style', 'border-top: none;');
            }

            for (let i = 0; i < download_requests.length; i++) {
                buildDownloadRequest(download_requests[i]);
            }

            downloads_next = reply.next;
            if( downloads_next == null){
                document.getElementById('btnNextDownloads').disabled = true;
            }
            else{
                document.getElementById('btnNextDownloads').disabled = false;
            }

            downloads_prev = reply.prev;
            if( downloads_prev == null){
                document.getElementById('btnPrevDownloads').disabled = true;
            }
            else{
                document.getElementById('btnPrevDownloads').disabled = false;
            }
        }
    }
    xhttp.open('GET', '/getDownloadRequests?page=' + downloads_current_page);
    xhttp.send();

}

function buildDownloadRequest(download){
    /** Builds a download request element. */

    var downloadsMenu = document.getElementById('downloadsMenu');

    var downloadRequest = document.createElement('div');
    downloadRequest.setAttribute('class', 'row');
    downloadRequest.id = 'downloadRequest-' + download.id;
    downloadRequest.setAttribute('style','border-bottom: 1px solid rgb(60,74,89); margin: 0px; padding: 10px;');
    downloadsMenu.appendChild(downloadRequest);

    if (download.status == 'Available'){
        var col1 = document.createElement('div');
        col1.setAttribute('class', 'col-lg-9');
        col1.setAttribute('style', 'padding: 0px;');
        downloadRequest.appendChild(col1);
    
        var col2 = document.createElement('div');
        col2.setAttribute('class', 'col-lg-1');
        col2.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col2);

        var filler = document.createElement('div');
        filler.setAttribute('class', 'col-lg-1');
        filler.setAttribute('style', 'padding: 0px;');
        downloadRequest.appendChild(filler);

        var col3 = document.createElement('div');
        col3.setAttribute('class', 'col-lg-1');
        col3.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col3);
    
        var h6 = document.createElement('h7');
        h6.innerHTML = download.file;
        h6.setAttribute('style', 'margin: 0px;');
        col1.appendChild(h6);

        if (download.expires != null){
            expiry_date = new Date(download.expires).toLocaleString();
            ed = expiry_date.split(',')[0]
            et = expiry_date.split(',')[1]
            expiry_date = ed.split('/')[2] + '-' + ed.split('/')[1] + '-' + ed.split('/')[0] + et

            var div = document.createElement('div');
            div.setAttribute('style', 'margin: 0px; padding: 0px; font-size: 80%;');
            div.innerHTML = '<i>Status: '+ download.status + '<br>Expires: ' + expiry_date + '</i>';
            col1.appendChild(div);
        }
        else{
            var div = document.createElement('div');
            div.setAttribute('style', 'margin: 0px; padding: 0px; font-size: 80%;');
            div.innerHTML = '<i>Status: '+ download.status + '</i>';
            col1.appendChild(div);
        }

        if (download.type == 'file'){        
            var downloadBtn = document.createElement('a');
            downloadBtn.innerHTML = '<i class="fa-solid fa-circle-arrow-down fa-2xl"></i>';
            downloadBtn.setAttribute('style', 'cursor: pointer; color: #DF691A;');
            downloadBtn.setAttribute('title', 'Download');
            downloadBtn.id = 'launchRestoreDownloadBtn-' + download.id;
            col2.appendChild(downloadBtn);

            downloadBtn.addEventListener('click', function(){
                initiateDownloadAfterRestore(download.id,download.task_id)
            });
        }
        else{
            var downloadBtn = document.createElement('a');
            downloadBtn.innerHTML = '<i class="fa-solid fa-circle-arrow-down fa-2xl"></i>';
            downloadBtn.setAttribute('style', 'cursor: pointer;');
            downloadBtn.setAttribute('title', 'Download');
            downloadBtn.setAttribute('href', download.url);
            col2.appendChild(downloadBtn);

        }

        var deleteBtn = document.createElement('a');
        deleteBtn.innerHTML = '<i class="fa-solid fa-circle-xmark fa-2xl"></i>';
        deleteBtn.setAttribute('style', 'cursor: pointer; color: #D9534F;');
        deleteBtn.setAttribute('title', 'Delete');
        deleteBtn.id = 'deleteDownloadBtn-' + download.id;
        col3.appendChild(deleteBtn);

        deleteBtn.addEventListener('click', function(){
            let download_id = this.id.split('-')[1]
            deleteDownload(download_id)
        });
    }
    else if (download.status == 'Restoring Files'){
        var col1 = document.createElement('div');
        col1.setAttribute('class', 'col-lg-4');
        col1.setAttribute('style', 'padding: 0px;');
        downloadRequest.appendChild(col1);
    
        var col2 = document.createElement('div');
        col2.setAttribute('class', 'col-lg-8');
        col2.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col2);
    
        var h6 = document.createElement('h7');
        h6.innerHTML = download.file;
        h6.setAttribute('style', 'margin: 0px;');
        col1.appendChild(h6);

        var div = document.createElement('div');
        div.setAttribute('style', 'margin: 0px; padding: 0px; font-size: 80%;');
        div.innerHTML = '<i>Status: ' + download.status + '</i>';
        col1.appendChild(div);

        var progCol = document.createElement('div');
        progCol.setAttribute('class', 'col-lg-12');
        col2.appendChild(progCol);

        var progDiv = document.createElement('div');
        progCol.appendChild(progDiv);

        var newProg = document.createElement('div');
        newProg.classList.add('progress');
        newProg.setAttribute('style','background-color: #3C4A59')
        progDiv.appendChild(newProg);
    
        var newProgInner = document.createElement('div');
        newProgInner.classList.add('progress-bar');
        newProgInner.classList.add('progress-bar-striped');
        newProgInner.classList.add('progress-bar-animated');
        newProgInner.classList.add('active');
        newProgInner.setAttribute("role", "progressbar");
        newProgInner.setAttribute("id", "progBar"+download.id);

        newProgInner.setAttribute("aria-valuemin", "0");
        newProgInner.setAttribute("aria-valuenow", download.restore);
        newProgInner.setAttribute("aria-valuemax", download.total_restore);
        time_left = download.total_restore - download.restore
        if (time_left<0) {
            time_left = 0
        }
        newProgInner.setAttribute("style", "width:"+(download.restore/download.total_restore)*100+"%;transition:none");
        newProgInner.innerHTML = time_left + ' hours remaining'
        newProg.appendChild(newProgInner);
    }
    else if (download.status == 'Downloading' && currentDownloads.includes(download.id)){
        var col1 = document.createElement('div');
        col1.setAttribute('class', 'col-lg-4');
        col1.setAttribute('style', 'padding: 0px;');
        downloadRequest.appendChild(col1);
    
        var col2 = document.createElement('div');
        col2.setAttribute('class', 'col-lg-7');
        col2.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col2);

        var col3 = document.createElement('div');
        col3.setAttribute('class', 'col-lg-1');
        col3.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col3);
    
        var h6 = document.createElement('h7');
        h6.innerHTML = download.file;
        h6.setAttribute('style', 'margin: 0px;');
        col1.appendChild(h6);

        var div = document.createElement('div');
        div.setAttribute('style', 'margin: 0px; padding: 0px; font-size: 80%;');
        div.innerHTML = '<i>Status: ' + download.status + '</i>';
        col1.appendChild(div);

        var progCol = document.createElement('div');
        progCol.setAttribute('class', 'col-lg-12');
        col2.appendChild(progCol);

        var progDiv = document.createElement('div');
        progCol.appendChild(progDiv);

        var newProg = document.createElement('div');
        newProg.classList.add('progress');
        newProg.setAttribute('style','background-color: #3C4A59')
        progDiv.appendChild(newProg);
    
        var newProgInner = document.createElement('div');
        newProgInner.classList.add('progress-bar');
        newProgInner.classList.add('progress-bar-striped');
        newProgInner.classList.add('progress-bar-animated');
        newProgInner.classList.add('active');
        newProgInner.setAttribute("role", "progressbar");
        newProgInner.setAttribute("id", "progBar"+download.id);
        newProg.appendChild(newProgInner);

        updateDownloadProgress(download.id,globalDownloaded,globalToDownload,global_count_initialised)
        downloadWorker.postMessage({'func': 'updateDownloadProgress', 'args': null})
        
        var stopTaskBtn = document.createElement('button')
        stopTaskBtn.setAttribute("class","btn btn-danger btn-block btn-sm")
        stopTaskBtn.innerHTML = '&times;'
        col3.appendChild(stopTaskBtn)

        stopTaskBtn.addEventListener('click', ()=>{
            downloadWorker.postMessage({'func': 'wrapUpDownload', 'args': [true]})
        })
    
    }
    else{
        var col1 = document.createElement('div');
        col1.setAttribute('class', 'col-lg-9');
        col1.setAttribute('style', 'padding: 0px;');
        downloadRequest.appendChild(col1);
    
        var col2 = document.createElement('div');
        col2.setAttribute('class', 'col-lg-1');
        col2.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col2);

        var filler = document.createElement('div');
        filler.setAttribute('class', 'col-lg-1');
        filler.setAttribute('style', 'padding: 0px;');
        downloadRequest.appendChild(filler);

        var col3 = document.createElement('div');
        col3.setAttribute('class', 'col-lg-1');
        col3.setAttribute('style', 'padding: 0px; align-items: center; display: flex; justify-content: center;');
        downloadRequest.appendChild(col3);
    
        var h6 = document.createElement('h7');
        h6.innerHTML = download.file;
        h6.setAttribute('style', 'margin: 0px;');
        col1.appendChild(h6);

        var div = document.createElement('div');
        div.setAttribute('style', 'margin: 0px; padding: 0px; font-size: 80%;');
        div.innerHTML = '<i>Status: ' + download.status; + '</i>';
        col1.appendChild(div);

        col2.innerHTML = '<i class="fa-solid fa-spinner fa-spin fa-2xl" style="color: #DF694A"></i>';

        if (download.type != 'file'){
            var deleteBtn = document.createElement('a');
            deleteBtn.innerHTML = '<i class="fa-solid fa-circle-xmark fa-2xl"></i>';
            deleteBtn.setAttribute('style', 'cursor: pointer; color: #D9534F;');
            deleteBtn.setAttribute('title', 'Delete');
            deleteBtn.id = 'deleteDownloadBtn-' + download.id;
            col3.appendChild(deleteBtn);

            deleteBtn.addEventListener('click', function(){
                let download_id = this.id.split('-')[1]
                deleteDownload(download_id)
            });
        }
    }
}

$('#downloadsDropdown').click(function(){
    event.stopPropagation()
});

function checkDownloads(){
    /** Checks for new downloads. */
    if (document.getElementById('downloadsBadge')) {
        var xhttp = new XMLHttpRequest();
        xhttp.open('GET', '/checkAvailableDownloads');
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                var downloadsBadge = document.getElementById('downloadsBadge');
                downloadsBadge.innerHTML = reply.available_downloads;
                if (downloadsTimer) {
                    clearTimeout(downloadsTimer)
                }
                downloadsTimer = setTimeout(checkDownloads, 60000)
            }
        }
        xhttp.send();
    }
    else{
        if (downloadsTimer) {
            clearTimeout(downloadsTimer)
        }
        downloadsTimer = setTimeout(checkDownloads, 60000)
    }
}

function deleteDownload(download_id){
    /** Deletes a download request. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            openDownloads()
        }
    };
    xhttp.open('GET', '/deleteDownloadRequest/' + download_id);
    xhttp.send();
}

$('#btnNextDownloads').click(function(event){
    downloads_current_page = downloads_next
    openDownloads()
});

$('#btnPrevDownloads').click(function(event){
    downloads_current_page = downloads_prev
    openDownloads()
});

$('#notificationsButton').click(function(){
    notifications_current_page = 1
    openNotifications()
});

$('#downloadsBtn').click(function(){
    downloads_current_page = 1
    openDownloads()
});

function updateDownloads(){
    //if already open, update the downloads
    document.getElementById('downloadsBtn').click()
    classList = document.getElementById('downloadsDropdown').classList
    if (!classList.contains('show')){
        document.getElementById('downloadsBtn').click()
    }
}

function onload() {
    /** Sets up the notification badge and timer and checks for global notifications. */
    checkNotifications()
    checkDownloads()
}

window.addEventListener('load', onload, false);
