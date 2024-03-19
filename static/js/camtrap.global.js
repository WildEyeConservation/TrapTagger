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
const modalHelp = $('#modalHelp');
const modalNotification = $('#modalNotification');

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


function onload() {
    /** Sets up the notification badge and timer and checks for global notifications. */
    checkNotifications()
}

window.addEventListener('load', onload, false);
