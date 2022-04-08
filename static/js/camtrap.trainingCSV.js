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

const userSelector = document.getElementById('userSelector')

function clearSurveys() {
    /** Clears the surveys div */
    surveyDiv = document.getElementById('surveyDiv')
    while(surveyDiv.firstChild){
        surveyDiv.removeChild(surveyDiv.firstChild);
    }
}

function buildSurveyRow(survey) {
    /** Builds a survey and task row */

    surveyDiv = document.getElementById('surveyDiv')
    row = document.createElement('div')
    row.setAttribute('class','row')
    surveyDiv.appendChild(row)

    surveyDiv.appendChild(document.createElement('br'))

    // Column 1: Checkbox
    checkBoxID = 'surveyCheckBox-' + survey.id.toString()
    
    col1 = document.createElement('div')
    col1.setAttribute('class','col-lg-1')
    row.appendChild(col1)

    checkBoxDiv = document.createElement('div')
    checkBoxDiv.setAttribute('class','custom-control custom-checkbox')
    col1.appendChild(checkBoxDiv)

    checkBox = document.createElement('input')
    checkBox.setAttribute('type','checkbox')
    checkBox.setAttribute('class','custom-control-input')
    checkBox.setAttribute('id',checkBoxID)
    checkBox.setAttribute('name',checkBoxID)
    checkBoxDiv.appendChild(checkBox)

    checkBoxLabel = document.createElement('label')
    checkBoxLabel.setAttribute('class','custom-control-label')
    checkBoxLabel.setAttribute('for',checkBoxID)
    checkBoxDiv.appendChild(checkBoxLabel)

    // Column 2: Survey Name
    col2 = document.createElement('div')
    col2.setAttribute('class','col-lg-7')
    col2.innerHTML = survey.name
    row.appendChild(col2)

    // Column 3: Task selector
    col3 = document.createElement('div')
    col3.setAttribute('class','col-lg-4')
    row.appendChild(col3)

    select = document.createElement('select')
    select.classList.add('form-control')
    select.setAttribute('id','taskSelector-' + survey.id.toString())
    col3.appendChild(select)

    taskNames = []
    taskValues = []
    for (i=0;i<survey.tasks.length;i++) {
        task = survey.tasks[i]
        taskNames.push(task.name)
        taskValues.push(task.value)
    }

    fillSelect(select,taskNames,taskValues)
}

function buildSurveys() {
    /** Requests the surveys and associated tasks for the selected user, and builds the required selection rows. */
    selection = userSelector.options[userSelector.selectedIndex].value

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getSurveysAndTasksByUser/'+selection);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);
            for (n=0;n<surveys.length;n++) {
                buildSurveyRow(surveys[n])
            }
        }
    }
    xhttp.send();
}

userSelector.addEventListener('click', ()=>{
    /** Event listener on the user selector that updates the survey selectors accordingly. */
    selection = userSelector.options[userSelector.selectedIndex].value
    clearSurveys()
    if (selection != '-1') {
        buildSurveys()
    }
});

function submitRequest() {
    /** Submits the training csv request form. */

    bucketName = document.getElementById('bucketName').value
    min_area = document.getElementById('min_area').value

    var formData = new FormData()

    if (bucketName!='') {
        formData.append("bucketName", bucketName)
    }
    
    if (min_area!='') {
        formData.append("min_area", min_area)
    }

    // Extract survey & task info
    tasks = []
    taskSelectors = document.querySelectorAll('[id^=taskSelector]');
    for (b=0;b<taskSelectors.length;b++) {
        IDNum = taskSelectors[b].id.split('-')[taskSelectors[b].id.split('-').length-1]
        checkBox = document.getElementById('surveyCheckBox-'+IDNum)
        if (checkBox.checked) {
            tasks.push(taskSelectors[b].options[taskSelectors[b].selectedIndex].value)
        }
    }

    if (tasks.length>0) {
        formData.append("tasks", JSON.stringify(tasks))
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/generateTrainingCSV');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply.status=='success') {
                window.location.replace('/surveys')
            } else {
                document.getElementById('errors').innerHTML = reply.message
            }
        }
    }
    xhttp.send(formData);
}