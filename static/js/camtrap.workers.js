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

const modalAlert = $('#modalAlert');
var prev_url = null
var next_url = null
var current_page = '/getWorkers'
// var processingTimer
// var timerWorkerStatus
// var timerWorkerBar
const btnNextWorkers = document.querySelector('#btnNextWorkers');
const btnPrevWorkers = document.querySelector('#btnPrevWorkers');

function buildWorker(worker) {
    /** Builds the supplied worker item on the page. */
    workerListDiv = document.getElementById('workerListDiv'); 
    newWorkerDiv = document.createElement('div')
    newWorkerDiv.style.backgroundColor = '#3C4A59';

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
    emailDiv.classList.add('col-lg-2');
    emailDiv.innerHTML = worker.email
    entireRow.appendChild(emailDiv)

    statsDiv = document.createElement('div')
    statsDiv.classList.add('col-lg-3');
    entireRow.appendChild(statsDiv)

    surveyCount = document.createElement('div')
    surveyCount.classList.add('row');
    surveyCount.setAttribute('style','font-size: 80%')
    surveyCount = 'Surveys annotated: ' + worker.survey_count.toString()
    statsDiv.appendChild(surveyCount)

    batchCount = document.createElement('div')
    batchCount.classList.add('row');
    batchCount.setAttribute('style','font-size: 80%')
    batchCount = 'Batches annotated: ' + worker.batch_count.toString()
    statsDiv.appendChild(batchCount)

    detailsDiv = document.createElement('div')
    detailsDiv.classList.add('col-lg-2');
    entireRow.appendChild(detailsDiv)

    detailsBtn = document.createElement('btn')
    detailsBtn.setAttribute('class','btn btn-primary btn-block')
    detailsBtn.innerHTML = 'Details'
    detailsDiv.appendChild(detailsBtn)

    removeDiv = document.createElement('div')
    removeDiv.classList.add('col-lg-2');
    entireRow.appendChild(removeDiv)

    removeBtn = document.createElement('btn')
    removeBtn.setAttribute('class','btn btn-danger btn-block')
    removeBtn.innerHTML = 'Remove'
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

            for (iii=0;iii<reply.workers.length;iii++) {
                buildWorker(reply.workers[iii])
                if (iii < reply.workers.length-1) {
                    workerListDiv.appendChild(document.createElement('br'))
                }
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
            // updateJobProgressBar()
        }
    }
    xhttp.open("GET", url);
    xhttp.send();
}

// function updateJobProgressBar() {
//     /** Updates the progress bars of all visible jobs. */
//     jobProgressBarDivs = document.querySelectorAll('[id^=jobProgressBarDiv]');

//     tskds = []
//     for (i = 0; i < jobProgressBarDivs.length; i++) {
//         tskds.push(jobProgressBarDivs[i].id.split('jobProgressBarDiv')[1])
//     }

//     for (b=0;b<tskds.length;b++) {
//         var xhttp = new XMLHttpRequest();
//         xhttp.onreadystatechange =
//         function(wrapTaskID) {
//             return function() {
//                 if (this.readyState == 4 && this.status == 200) {
//                     reply = JSON.parse(this.responseText);  

//                     document.getElementById('jobsCompleted'+reply.id).innerHTML = 'Jobs Completed: ' + reply.jobsCompleted
//                     document.getElementById('jobsAvailable'+reply.id).innerHTML = 'Jobs Available: ' + reply.jobsAvailable

//                     if (reply.jobsAvailable==0) {
//                         document.getElementById("takeJobBtn"+reply.id).disabled = true
//                     } else {
//                         document.getElementById("takeJobBtn"+reply.id).disabled = false
//                     }

//                     progBar = document.getElementById('progBar'+wrapTaskID)
        
//                     progBar.setAttribute('aria-valuenow',reply.completed)
//                     progBar.setAttribute('aria-valuemax',reply.total)
//                     perc=(reply.completed/reply.total)*100
//                     progBar.setAttribute('style',"width:"+perc+"%")
//                     progBar.innerHTML = reply.remaining
//                 }
//             }
//         }(tskds[b]);
//         xhttp.open("GET", '/updateTaskProgressBar/'+tskds[b]);
//         xhttp.send();
//     }
// }

// function goQual() {
//     /** Redirects the user to the qualifications page. */
//     window.location.href = '/qualifications'
// }