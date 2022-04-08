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
var current_page = '/getQualUsers'
var processingTimer
var timerQualStatus
var timerQualBar
const btnNextQuals = document.querySelector('#btnNextQuals');
const btnPrevQuals = document.querySelector('#btnPrevQuals');

function buildQual(qual) {
    /** Builds a qualification row on the page. */
    qualListDiv = document.getElementById('qualListDiv'); 
    newQualDiv = document.createElement('div')
    newQualDiv.style.backgroundColor = '#3C4A59';

    qualListDiv.appendChild(newQualDiv)

    newQualDiv.appendChild(document.createElement('br'))

    entireRow = document.createElement('div')
    entireRow.classList.add('row');
    entireRow.setAttribute('style',"margin-left: 10px; margin-right: 10px")
    newQualDiv.appendChild(entireRow)

    qualDiv = document.createElement('div')
    qualDiv.classList.add('col-lg-8');
    entireRow.appendChild(qualDiv)
    headingElement = document.createElement('h4')
    headingElement.innerHTML = qual.username
    headingElement.setAttribute('style',"margin-left: 10px; margin-right:10px")
    qualDiv.appendChild(headingElement)

    takeQualDiv = document.createElement('div')
    takeQualDiv.classList.add('col-lg-4');
    takeQualBtn = document.createElement('button')
    takeQualBtn.setAttribute("class","btn btn-primary btn-block btn-sm")
    takeQualBtn.setAttribute("id","takeQualBtn"+qual.id)
    takeQualBtn.innerHTML = 'Request Qualification'
    takeQualDiv.appendChild(takeQualBtn)
    entireRow.appendChild(takeQualDiv)

    takeQualBtn.addEventListener('click', function(wrapQualId) {
        return function() {
            requestQual(wrapQualId)
        }
    }(qual.id));

    newQualDiv.appendChild(document.createElement('br'))
}

function requestQual(qualID) {
    /** Requests a qualification from the specified user. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply=='success') {
                document.getElementById('modalAlertHeader').innerHTML = 'Success'
                document.getElementById('modalAlertBody').innerHTML = 'Your qualification request has been submitted.'
                modalAlert.modal({keyboard: true});
            } else {
                document.getElementById('modalAlertHeader').innerHTML = 'Error'
                document.getElementById('modalAlertBody').innerHTML = 'Something went wrong. Please try again later.'
                modalAlert.modal({keyboard: true});
            }
        }
    }
    xhttp.open("GET", '/requestQualification/'+qualID);
    xhttp.send();
}

function onload(){
    /** Initialises the page on load. */
    updatePage(current_page)
    processingTimer = setInterval(updatePage, 30000)
}

window.addEventListener('load', onload, false);

function updatePage(url){
    /** Updates the current page of paginated qualifications, or loads the specified new one. */
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

            qualListDiv = document.getElementById('qualListDiv'); 
            while(qualListDiv.firstChild){
                qualListDiv.removeChild(qualListDiv.firstChild);
            }

            for (iii=0;iii<reply.quals.length;iii++) {
                buildQual(reply.quals[iii])
                if (iii < reply.quals.length-1) {
                    qualListDiv.appendChild(document.createElement('br'))
                }
            }
            
            if (reply.next_url==null) {
                btnNextQuals.style.visibility = 'hidden'
            } else {
                btnNextQuals.style.visibility = 'visible'
                next_url = reply.next_url
            }

            if (reply.prev_url==null) {
                btnPrevQuals.style.visibility = 'hidden'
            } else {
                btnPrevQuals.style.visibility = 'visible'
                prev_url = reply.prev_url
            }
        }
    }
    xhttp.open("GET", url);
    xhttp.send();
}

btnNextQuals.addEventListener('click', ()=>{
    /** Loads the next set of paginated qualifications. */
    updatePage(next_url)
});

btnPrevQuals.addEventListener('click', ()=>{
    /** Loads the previous set of paginated qualifications. */
    updatePage(prev_url)
});