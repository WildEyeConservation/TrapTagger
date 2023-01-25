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

function buildLabelRow(label) {
    /** Builds a label row */

    IDNum = getIdNumforNext('desiredLabel-')
    labelDiv = document.getElementById('labelDiv')
    row = document.createElement('div')
    row.setAttribute('class','row')
    labelDiv.appendChild(row)

    labelDiv.appendChild(document.createElement('br'))

    // Column 1: Checkbox
    checkBoxID = 'labelCheckBox-' + IDNum
    
    col1 = document.createElement('div')
    col1.setAttribute('class','col-lg-2')
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

    // Column 2: Label Name
    col2 = document.createElement('div')
    col2.setAttribute('class','col-lg-3')
    col2.setAttribute('id','originalLabel-'+IDNum)
    col2.innerHTML = label.name
    row.appendChild(col2)

    // Column 3: Label Count
    col3 = document.createElement('div')
    col3.setAttribute('class','col-lg-3')
    col3.innerHTML = label.count
    row.appendChild(col3)

    // Column 4: Desired label
    col4 = document.createElement('div')
    col4.setAttribute('class','col-lg-4')
    row.appendChild(col4)

    input = document.createElement('input')
    input.classList.add('form-control')
    input.setAttribute('type','text')
    input.required = true
    input.setAttribute('id','desiredLabel-' + IDNum)
    col4.appendChild(input)
}

function clearLabels() {
    /** Clears the labels div */
    labelDiv = document.getElementById('labelDiv')
    while(labelDiv.firstChild){
        labelDiv.removeChild(labelDiv.firstChild);
    }
}

function requestLabels() {
    /** Requests the labels for translation, and builds the rows. */

    var formData = new FormData()
    bucketName = document.getElementById('bucketName').value

    if (bucketName!='') {
        formData.append("sourceBucket", bucketName)
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/getClassificationDsLables');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            labels = JSON.parse(this.responseText);
            clearLabels()
            for (let i=0;i<labels.length;i++) {
                buildLabelRow(labels[i])
            }
        }
    }
    xhttp.send(formData);    
}

function submitRequest() {
    /** Submits the label_spec request form. */

    var formData = new FormData()
    bucketName = document.getElementById('bucketName').value
    if (bucketName!='') {
        formData.append("sourceBucket", bucketName)
    }

    // Extract survey & task info
    translations = {}
    desiredLabels = document.querySelectorAll('[id^=desiredLabel]');
    for (let i=0;i<desiredLabels.length;i++) {
        IDNum = desiredLabels[i].id.split('-')[desiredLabels[i].id.split('-').length-1]
        checkBox = document.getElementById('labelCheckBox-'+IDNum)
        if (!checkBox.checked) {
            originalLabel = document.getElementById('originalLabel-'+IDNum).innerHTML
            desiredLabel = desiredLabels[i].value
            if (!translations.hasOwnProperty(desiredLabel)) {
                translations[desiredLabel] = []
            }
            translations[desiredLabel].push(originalLabel)
        }
    }

    formData.append("translations", JSON.stringify(translations))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/requestLabelSpec');
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