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
const surveySelect = document.getElementById('surveySelect');
const taskSelect = document.getElementById('taskSelect');
const statsTable = document.getElementById('statsTable');

function onload(){
    /** Initialises the page by getting a list of the user's surveys. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            optionTexts = ['None']
            optionValues = ["-99999"]             
            
            for (i=0;i<surveys.length;i++) {
                optionTexts.push(surveys[i][1])
                optionValues.push(surveys[i][0])
            }
            clearSelect(surveySelect)
            fillSelect(surveySelect, optionTexts, optionValues)
        }
    }
    xhttp.open("GET", '/getSurveys');
    xhttp.send();
}

window.addEventListener('load', onload, false);

surveySelect.addEventListener('click', ()=>{
    /** Populates the task options on survey selection */
    survey = surveySelect.options[surveySelect.selectedIndex].value;
    if (survey != '-99999') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                tasks = JSON.parse(this.responseText);  
                optionTexts = ['None']
                optionValues = ["-99999"]             
                for (i=0;i<tasks.length;i++) {
                    optionTexts.push(tasks[i][1])
                    optionValues.push(tasks[i][0])
                }
                clearSelect(taskSelect)
                fillSelect(taskSelect, optionTexts, optionValues)
            }
        }
        xhttp.open("GET", '/getTasks/'+survey);
        xhttp.send();
    } else {
        optionTexts = ['None']
        optionValues = ["-99999"] 
        clearSelect(taskSelect)
        fillSelect(taskSelect, optionTexts, optionValues)
    }
});

taskSelect.addEventListener('click', ()=>{
    /** Builds and populates the information table on task selection. */
    task = taskSelect.options[taskSelect.selectedIndex].value;
    if (task != '-99999') {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                
                if (reply != 'error') {
                    tableDiv = document.getElementById('statsTable')
                    table = document.createElement('table')
                    table.setAttribute('style','width:100%; table-layout:fixed')
                    table.classList.add('table')
                    table.classList.add('table-bordered')
                    table.classList.add('table-matrix')
                    tableDiv.appendChild(table)
                    
                    thead = document.createElement('thead')
                    table.appendChild(thead)
                    
                    tableRow = document.createElement('tr')
                    for (key in reply.headings) {
                        tableCol = document.createElement('th')
                        tableCol.setAttribute('scope','col')
                        tableCol.setAttribute('style','border-bottom: 1px solid white')
                        tableRow.appendChild(tableCol)
                    
                        thdiv = document.createElement('div')
                        thdiv.innerHTML = reply.headings[key]
                        tableCol.appendChild(thdiv)
                    }
                    thead.appendChild(tableRow)
                    
                    tbody = document.createElement('tbody')
                    table.appendChild(tbody)
                    
                    for (n=0;n<reply.data.length;n++) {
                        for (key in reply.headings) {
                            if (key=='username') {
                                tableRow = document.createElement('tr')
                                tableCol = document.createElement('th')
                                tableCol.setAttribute('scope','row')
                            } else {
                                tableCol = document.createElement('td')
                            }
                            tableCol.innerHTML = reply.data[n][key]
                            tableRow.appendChild(tableCol)
                        }
                        tbody.appendChild(tableRow)
                    }
                }
            }
        }
        xhttp.open("GET", '/getWorkerStats?task_id='+task);
        xhttp.send();
    } else {
        while(statsTable.firstChild){
            statsTable.removeChild(statsTable.firstChild);
        }
    }
});