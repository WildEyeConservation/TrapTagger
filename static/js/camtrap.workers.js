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

const modalAlert = $('#modalAlert');
const modalInvite = $('#modalInvite');
const confirmationModal = $('#confirmationModal');
const modalDetails = $('#modalDetails');
var prev_url = null
var next_url = null
var current_page = '/getWorkers'
var currentUser = null
const btnNextWorkers = document.querySelector('#btnNextWorkers');
const btnPrevWorkers = document.querySelector('#btnPrevWorkers');

function buildWorker(worker) {
    /** Builds the supplied worker item on the page. */
    workerListDiv = document.getElementById('workerListDiv'); 
    newWorkerDiv = document.createElement('div')
    // newWorkerDiv.style.backgroundColor = '#3C4A59';
    newWorkerDiv.setAttribute('style','border-bottom: 1px solid rgb(60,74,89); border-top: 1px solid rgb(60,74,89)')

    workerListDiv.appendChild(newWorkerDiv)

    newWorkerDiv.appendChild(document.createElement('br'))

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    entireRow.setAttribute('style',"margin-left: 10px; margin-right: 10px")
    newWorkerDiv.appendChild(entireRow)

    workerDiv = document.createElement('div')
    workerDiv.classList.add('col-lg-3');
    entireRow.appendChild(workerDiv)
    headingElement = document.createElement('h4')
    headingElement.innerHTML = worker.name
    headingElement.setAttribute('style',"margin-left: 10px; margin-right:10px")
    workerDiv.appendChild(headingElement)

    emailDiv = document.createElement('div')
    emailDiv.classList.add('col-lg-4');
    emailDiv.innerHTML = worker.email
    entireRow.appendChild(emailDiv)

    statsDiv = document.createElement('div')
    statsDiv.classList.add('col-lg-3');
    entireRow.appendChild(statsDiv)

    surveyCount = document.createElement('div')
    surveyCount.classList.add('row');
    surveyCount.setAttribute('style','font-size: 80%')
    surveyCount.innerHTML = 'Surveys annotated: ' + worker.survey_count.toString()
    statsDiv.appendChild(surveyCount)

    batchCount = document.createElement('div')
    batchCount.classList.add('row');
    batchCount.setAttribute('style','font-size: 80%')
    batchCount.innerHTML = 'Batches annotated: ' + worker.batch_count.toString()
    statsDiv.appendChild(batchCount)

    batchCount = document.createElement('div')
    batchCount.classList.add('row');
    batchCount.setAttribute('style','font-size: 80%')
    batchCount.innerHTML = 'Annotation time: ' + worker.taggingTime.toString() + 'h'
    statsDiv.appendChild(batchCount)

    detailsDiv = document.createElement('div')
    detailsDiv.classList.add('col-lg-1');
    entireRow.appendChild(detailsDiv)

    detailsBtn = document.createElement('btn')
    detailsBtn.setAttribute('class','btn btn-primary btn-block btn-sm')
    detailsBtn.innerHTML = 'Details'
    detailsDiv.appendChild(detailsBtn)

    detailsDiv.addEventListener('click', function(wrapWorkerId) {
        return function() {
            currentUser = wrapWorkerId
            modalDetails.modal({keyboard: true});
        }
    }(worker.id));

    removeDiv = document.createElement('div')
    removeDiv.classList.add('col-lg-1');
    entireRow.appendChild(removeDiv)

    removeBtn = document.createElement('btn')
    removeBtn.setAttribute('class','btn btn-danger btn-block  btn-sm')
    removeBtn.innerHTML = 'Remove'
    if (worker.isOwner=='true') {
        removeBtn.classList.add("disabled")
    } else {
        removeBtn.addEventListener('click', function(wrapWorkerId) {
            return function() {
                currentUser = wrapWorkerId
                confirmationModal.modal({keyboard: true});
            }
        }(worker.id));
    }
    removeDiv.appendChild(removeBtn)

    newWorkerDiv.appendChild(document.createElement('br'))
}

function onload(){
    /** Initialises the worker page on load. */
    updatePage(current_page)
    // processingTimer = setInterval(updatePage, 30000)
    // timerWorkerBar = setInterval(updateWorkerProgressBar, 5000);
}

window.addEventListener('load', onload, false);

function updatePage(url){
    /** Updates the current page of paginated workers, or switches the current page to the specified URL. */

    if (url==null) {
        url = current_page
    } else {
        current_page = url
    }
    
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            workerListDiv = document.getElementById('workerListDiv'); 
            while(workerListDiv.firstChild){
                workerListDiv.removeChild(workerListDiv.firstChild);
            }

            if (reply.workers.length > 0) {
                workerListDiv.setAttribute('class','')
                document.getElementById('mainCard').setAttribute('style','')
            } else {
                workerListDiv.setAttribute('class','card-body')
                document.getElementById('mainCard').setAttribute('style','min-height:400px')
            }

            for (let i=0;i<reply.workers.length;i++) {
                buildWorker(reply.workers[i])
                // if (i < reply.workers.length-1) {
                //     workerListDiv.appendChild(document.createElement('br'))
                // }
            }
            
            if (reply.next_url==null) {
                btnNextWorkers.style.visibility = 'hidden'
            } else {
                btnNextWorkers.style.visibility = 'visible'
                next_url = reply.next_url
            }

            if (reply.prev_url==null) {
                btnPrevWorkers.style.visibility = 'hidden'
            } else {
                btnPrevWorkers.style.visibility = 'visible'
                prev_url = reply.prev_url
            }
        }
    }
    xhttp.open("GET", url);
    xhttp.send();
}

function removeWorkerQualification() {
    var formData = new FormData()
    formData.append("worker_id", currentUser)

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            document.getElementById('modalAlertHeader').innerHTML = reply.status
            document.getElementById('modalAlertBody').innerHTML = reply.message
            modalAlert.modal({keyboard: true});
            updatePage()
        }
    }
    xhttp.open("POST", "/removeWorkerQualification");
    xhttp.send(formData);

    confirmationModal.modal('hide')
}

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

function generate_url() {
    /** Generates the url based on the current order selection and search query */
    order = orderSelect.options[orderSelect.selectedIndex].value
    search = document.getElementById('workerSearch').value
    return '/getWorkers?page=1&order='+order+'&search='+search.toString()
}

$('#workerSearch').change( function() {
    /** Listens for changes in the worker search bar and updates the page accordingly. */
    url = generate_url()
    updatePage(url)
});

$('#orderSelect').change( function() {
    /** Listens for changes in the ordering and updates the page accordingly. */
    url = generate_url()
    updatePage(url)
});

modalDetails.on('shown.bs.modal', function(){
    /** Initialises the details modal. */
    while(statsTable.firstChild){
        statsTable.removeChild(statsTable.firstChild);
    }

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            optionTexts = ['None']
            optionValues = ["-99999"]             
            
            for (let i=0;i<surveys.length;i++) {
                optionTexts.push(surveys[i][1])
                optionValues.push(surveys[i][0])
            }
            clearSelect(surveySelect)
            fillSelect(surveySelect, optionTexts, optionValues)
        }
    }
    xhttp.open("GET", '/getWorkerSurveys?worker_id='+currentUser.toString());
    xhttp.send();
});

surveySelect.addEventListener('change', ()=>{
    /** Populates the task options on survey selection */
    survey = surveySelect.options[surveySelect.selectedIndex].value;
    while(statsTable.firstChild){
        statsTable.removeChild(statsTable.firstChild);
    }
    if (survey != '-99999') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                tasks = JSON.parse(this.responseText);  
                optionTexts = ['None']
                optionValues = ["-99999"]             
                for (let i=0;i<tasks.length;i++) {
                    optionTexts.push(tasks[i][1])
                    optionValues.push(tasks[i][0])
                }
                clearSelect(taskSelect)
                fillSelect(taskSelect, optionTexts, optionValues)
            }
        }
        xhttp.open("GET", '/getTasks/'+survey+'?worker_id='+currentUser.toString());
        xhttp.send();
    } else {
        optionTexts = ['None']
        optionValues = ["-99999"] 
        clearSelect(taskSelect)
        fillSelect(taskSelect, optionTexts, optionValues)
    }
});

taskSelect.addEventListener('change', ()=>{
    /** Builds and populates the information table on task selection. */
    task = taskSelect.options[taskSelect.selectedIndex].value;
    while(statsTable.firstChild){
        statsTable.removeChild(statsTable.firstChild);
    }
    if (task != '-99999') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                
                if (reply != 'error') {
                    tableDiv = document.getElementById('statsTable')
                    for (let key in reply.headings) {
                        row = document.createElement('div')
                        row.classList.add('row')
                        tableDiv.appendChild(row)

                        col1 = document.createElement('div')
                        col1.classList.add('col-lg-4')
                        row.appendChild(col1)

                        col1.innerHTML = reply.headings[key]

                        col2 = document.createElement('div')
                        col2.classList.add('col-lg-4')
                        row.appendChild(col2)

                        col2.innerHTML = reply.data[0][key]
                    }
                }
            }
        }
        xhttp.open("GET", '/getWorkerStats?task_id='+task+'&worker_id='+currentUser.toString());
        xhttp.send();
    }
});