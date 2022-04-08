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

$("#csvFileUpload").change( function() {
    /** Updates the file upload text area when a file is selected. */
    if (document.getElementById("csvFileUpload").files.length > 0) {
        document.getElementById('csvFileUploadText').value = document.getElementById("csvFileUpload").files[0].name
    } else {
        document.getElementById('csvFileUploadText').value = ''
    }
})

function submitRequest() {
    /** Submits the data pipeline form */

    surveyName = document.getElementById('surveyName').value
    bucketName = document.getElementById('bucketName').value
    dataSource = document.getElementById('dataSource').value
    trapgroupCode = document.getElementById('trapgroupCode').value
    min_area = document.getElementById('min_area').value
    exclusions = document.getElementById('exclusions').value
    sourceBucket = document.getElementById('sourceBucket').value
    csvFileUpload = document.getElementById("csvFileUpload")

    var formData = new FormData()

    if (surveyName!='') {
        formData.append("surveyName", surveyName)
    }

    if (bucketName!='') {
        formData.append("bucketName", bucketName)
    }
    
    if (dataSource!='') {
        formData.append("dataSource", dataSource)
    }
    
    if (trapgroupCode!='') {
        formData.append("trapgroupCode", trapgroupCode)
    }
    
    if (min_area!='') {
        formData.append("min_area", min_area)
    }

    if (exclusions!='') {
        formData.append("exclusions", exclusions)
    }
    
    if (sourceBucket!='') {
        formData.append("sourceBucket", sourceBucket)
    }
    
    if (csvFileUpload.files.length > 0) {
        formData.append("csv", csvFileUpload.files[0])
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/pipelineData');
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