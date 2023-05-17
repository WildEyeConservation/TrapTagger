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
var prev_url = null
var next_url = null
var current_page = '/getJobs'
var processingTimer
var timerJobStatus
var jobTimer
const btnNextJobs = document.querySelector('#btnNextJobs');
const btnPrevJobs = document.querySelector('#btnPrevJobs');

function buildJob(job) {
    /** Builds the supplied job item on the page. */
    jobListDiv = document.getElementById('jobListDiv'); 
    newJobDiv = document.createElement('div')
    // newJobDiv.style.backgroundColor = '#3C4A59';
    newJobDiv.setAttribute('style','border-bottom: 1px solid rgb(60,74,89); border-top: 1px solid rgb(60,74,89)')

    jobListDiv.appendChild(newJobDiv)

    newJobDiv.appendChild(document.createElement('br'))

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    entireRow.setAttribute('style',"margin-left: 10px; margin-right: 10px")
    newJobDiv.appendChild(entireRow)

    jobDiv = document.createElement('div')
    jobDiv.classList.add('col-lg-3');
    entireRow.appendChild(jobDiv)
    headingElement = document.createElement('h4')
    headingElement.innerHTML = job.name
    headingElement.setAttribute('style',"margin-left: 10px; margin-right:10px")
    jobDiv.appendChild(headingElement)

    jobsAvailableCol = document.createElement('div')
    jobsAvailableCol.classList.add('col-lg-1');
    entireRow.appendChild(jobsAvailableCol)
    jobsAvailable = document.createElement('div')
    jobsAvailable.setAttribute("id","jobsAvailable"+job.id)
    jobsAvailable.setAttribute("style","font-size: 70%")
    jobsAvailable.innerHTML = 'Jobs Available: ' + job.jobsAvailable
    jobsAvailableCol.appendChild(jobsAvailable)

    jobsCompleted = document.createElement('div')
    jobsCompleted.setAttribute("id","jobsCompleted"+job.id)
    jobsCompleted.setAttribute("style","font-size: 70%")
    jobsCompleted.innerHTML = 'Jobs Completed: ' + job.jobsCompleted
    jobsAvailableCol.appendChild(jobsCompleted)

    jobProgressBarCol = document.createElement('div')
    jobProgressBarCol.classList.add('col-lg-7');
    
    jobProgressBarDiv = document.createElement('div')
    jobProgressBarDiv.setAttribute("id","jobProgressBarDiv"+job.id)

    var newProg = document.createElement('div');
    newProg.classList.add('progress');
    newProg.setAttribute('style','background-color: #3C4A59')

    var newProgInner = document.createElement('div');
    newProgInner.classList.add('progress-bar');
    newProgInner.classList.add('progress-bar-striped');
    newProgInner.classList.add('progress-bar-animated');
    newProgInner.classList.add('active');
    newProgInner.setAttribute("role", "progressbar");
    newProgInner.setAttribute("id", "progBar"+job.id);
    newProgInner.setAttribute("aria-valuenow", job.completed);
    newProgInner.setAttribute("aria-valuemin", "0");
    newProgInner.setAttribute("aria-valuemax", job.total);
    newProgInner.setAttribute("style", "width:"+(job.completed/job.total)*100+"%;transition:none");
    newProgInner.innerHTML = job.remaining

    newProg.appendChild(newProgInner);
    jobProgressBarDiv.appendChild(newProg);
    jobProgressBarCol.appendChild(jobProgressBarDiv);
    entireRow.appendChild(jobProgressBarCol)

    takeJobDiv = document.createElement('div')
    takeJobDiv.classList.add('col-lg-1');
    takeJobBtn = document.createElement('button')
    takeJobBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
    takeJobBtn.setAttribute("id","takeJobBtn"+job.id)
    takeJobBtn.innerHTML = 'Take Job'
    takeJobDiv.appendChild(takeJobBtn)
    entireRow.appendChild(takeJobDiv)

    takeJobBtn.addEventListener('click', function(wrapJobId) {
        return function() {
            takeJob(wrapJobId)
        }
    }(job.id));

    if (job.jobsAvailable==0) {
        takeJobBtn.disabled = true
    } else {
        takeJobBtn.disabled = false
    }

    newJobDiv.appendChild(document.createElement('br'))
}

function onload(){
    /** Initialises the jobs page on load. */
    updatePage(current_page)
}

window.addEventListener('load', onload, false);

function updatePage(url){
    /** Updates the current page of paginated jobs, or switches the current page to the specified URL. */

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

            jobListDiv = document.getElementById('jobListDiv'); 
            while(jobListDiv.firstChild){
                jobListDiv.removeChild(jobListDiv.firstChild);
            }

            if (reply.jobs.length > 0) {
                jobListDiv.setAttribute('class','')
                document.getElementById('mainCard').setAttribute('style','')
            } else {
                jobListDiv.setAttribute('class','card-body')
                document.getElementById('mainCard').setAttribute('style','min-height:400px')
            }

            for (let i=0;i<reply.jobs.length;i++) {
                buildJob(reply.jobs[i])
                // if (i < reply.jobs.length-1) {
                //     jobListDiv.appendChild(document.createElement('br'))
                // }
            }
            
            if (reply.next_url==null) {
                btnNextJobs.style.visibility = 'hidden'
            } else {
                btnNextJobs.style.visibility = 'visible'
                next_url = reply.next_url
            }

            if (reply.prev_url==null) {
                btnPrevJobs.style.visibility = 'hidden'
            } else {
                btnPrevJobs.style.visibility = 'visible'
                prev_url = reply.prev_url
            }

            if (jobTimer != null) {
                clearTimeout(jobTimer);
            }
            jobTimer = setTimeout(function() { updatePage(url); }, 10000);

        }
    }
    xhttp.open("GET", url);
    xhttp.send();
}

function generate_url() {
    /** Generates the url based on the current order selection and search query */
    order = orderSelect.options[orderSelect.selectedIndex].value
    search = document.getElementById('jobSearch').value
    return '/getJobs?page=1&order='+order+'&search='+search.toString()
}

$('#orderSelect').change( function() {
    /** Listens for changes in the ordering and updates the page accordingly. */
    url = generate_url()
    updatePage(url)
});

$('#jobSearch').change( function() {
    /** Listens for changes in the worker search bar and updates the page accordingly. */
    url = generate_url()
    updatePage(url)
});

btnNextJobs.addEventListener('click', ()=>{
    /** Loads the next set of paginated surveys. */
    updatePage(next_url)
});

btnPrevJobs.addEventListener('click', ()=>{
    /** Loads the previous set of paginated surveys. */
    updatePage(prev_url)
});