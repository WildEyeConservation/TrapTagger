// Copyright 2022

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
const modalHelp = $('#modalHelp');

function getActiveModal() {
    /** Returns the ID of the currently active modal. Returns null otherwise. */
    activeModal = null
    allModals = document.querySelectorAll('[id^=modal]');
    for (am=0;am<allModals.length;am++) {
        if (allModals[am].classList.contains('show')) {
            activeModal = allModals[am].id
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
                }
                document.getElementById('takeJobBtn'+wrapJobID.toString()).disabled = false
            }
        }
    }(jobID)
    xhttp.open("GET", '/takeJob/'+jobID);
    xhttp.send();
}