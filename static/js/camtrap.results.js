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


function addSurveys(){
    /** Adds the survey and annotation set selectors to the page */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            buildSurveySelect()
        }
    }
    xhttp.open("GET", '/getSurveys');
    xhttp.send();

    var addSurveyTask = document.getElementById('addSurveyTask')
    
    row = document.createElement('div')
    row.classList.add('row')
    addSurveyTask.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-3')
    row.appendChild(col)

    btnAdd = document.createElement('button');
    btnAdd.setAttribute("class",'btn btn-info');
    btnAdd.innerHTML = '&plus;';
    btnAdd.addEventListener('click', ()=>{
        buildSurveySelect()
        checkSurvey()
    });
    col.appendChild(btnAdd);
}

function buildSurveySelect(){
    /** Builds the selectors for the surveys and annotation sets */

    IDNum = getIdNumforNext('idSurveySelect-')
    surveySelect = document.getElementById('surveySelect')

    row = document.createElement('div')
    row.classList.add('row')
    surveySelect.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-8')
    row.appendChild(col1)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-2')
    col3.setAttribute('style','padding: 0px;')
    row.appendChild(col3)
    

    if (IDNum > 0) {
        col1.appendChild(document.createElement('br'))
        col3.appendChild(document.createElement('br'))
    }
    
    idSurveySelect = document.createElement('select')
    idSurveySelect.classList.add('form-control')
    idSurveySelect.id = 'idSurveySelect-'+String(IDNum)
    idSurveySelect.name = idSurveySelect.id
    col1.appendChild(idSurveySelect)

    idTaskSelect = document.createElement('select')
    idTaskSelect.classList.add('form-control')
    idTaskSelect.id = 'idTaskSelect-'+String(IDNum)
    idTaskSelect.name = idTaskSelect.id
    col1.appendChild(idTaskSelect)
    

    if (surveys != null) {
        
        if(IDNum==0){
            optionTexts = ['All']
            optionValues = ["0"]  
            fillSelect(idTaskSelect, [''], ['0'])
        }
        else{
            optionTexts = ['None']
            optionValues = ['-99999'] 
            fillSelect(idTaskSelect, [''], ['-99999'])
        }
                 
        for (let i=0;i<surveys.length;i++) {
            optionTexts.push(surveys[i][1])
            optionValues.push(surveys[i][0])
        }
        clearSelect(idSurveySelect)
        fillSelect(idSurveySelect, optionTexts, optionValues)
        
        
    }

    if (IDNum!=0) {
        btnRemove = document.createElement('button');
        btnRemove.setAttribute("class",'btn btn-info');
        btnRemove.innerHTML = '&times;';
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.remove();
            checkSurvey()

        });
        col3.appendChild(btnRemove);
    }

    $("#"+idSurveySelect.id).change( function(wrapIDNum) {
        return function() {

            idSurveySelect = document.getElementById('idSurveySelect-'+String(wrapIDNum))
            idTaskSelect = document.getElementById('idTaskSelect-'+String(wrapIDNum))
            
            survey = idSurveySelect.options[idSurveySelect.selectedIndex].value
            if (survey=="0") {
                clearSelect(idTaskSelect)
                fillSelect(idTaskSelect, [''], ['0'])
                checkSurvey()

            } else {
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(wrapidTaskSelect){
                    return function() {
                        if (this.readyState == 4 && this.status == 200) {
                            tasks = JSON.parse(this.responseText);  
                            optionTexts = []      
                            optionValues = []
                            for (let i=0;i<tasks.length;i++) {
                                optionTexts.push(tasks[i][1])
                                optionValues.push(tasks[i][0])
                            }
                            clearSelect(wrapidTaskSelect)
                            fillSelect(wrapidTaskSelect, optionTexts, optionValues)
 
                            checkSurvey()
                            
                        }
                    }
                }(idTaskSelect)
                xhttp.open("GET", '/getTasks/'+survey);
                xhttp.send();
            }
        }
    }(IDNum));

    $("#"+idTaskSelect.id).change( function() {
        checkSurvey()
    })
    
}

function checkSurvey(){
    /** Checks that the slected surveys and annotation sets are valid */

    var duplicateTask = false
    var surveyAll = false
    var noneSurvey = false
    legalSurvey = false
    
    
    surveyErrors = document.getElementById('surveysErrors')
    allTasks = document.querySelectorAll('[id^=idTaskSelect-]')
    allSurveys = document.querySelectorAll('[id^=idSurveySelect-]') 
    
    
    while(surveyErrors.firstChild){
        surveyErrors.removeChild(surveyErrors.firstChild)
    }    

    for (let i=0;i<allTasks.length;i++) {
        currTaskVal = allTasks[i].value
        for (let j=0;j<allTasks.length;j++) {
            if(allTasks[j].value == currTaskVal && j!=i){
                duplicateTask = true
            }
        }
        if (currTaskVal=='0'){
            surveyAll = true
        }
    }

    
    if(allSurveys.length == 1 && surveyAll){
        surveyAll = false
    }
    else if(allSurveys.length == 1 && !surveyAll && modalActive){
        if(allSurveys[0].value == '-99999'){
            noneSurvey = true
        }
    }
    

    if (duplicateTask) {
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have duplicate annotation sets, please remove the duplicate.'
        surveyErrors.appendChild(newdiv)
    }
    

    if(surveyAll){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You cannot select all surveys and add additional surveys. Please remove additional surveys or "All" surveys.'
        surveyErrors.appendChild(newdiv)
    }


    if(noneSurvey){
        newdiv = document.createElement('div')
        newdiv.innerHTML =  'You have not selected any surveys. Please select a survey.'
        surveyErrors.appendChild(newdiv)
    }

    if (duplicateTask||surveyAll||noneSurvey) {
        legalSurvey = false
    } else {
        legalSurvey = true
    }
}

function buildGenResultsSelectors(){
    /** Builds the selectors for generating results*/

    // var genrateDiv = document.getElementById('generateDiv')
    // var analysisType = document.getElementById('analysisSelector').value

    // while(genrateDiv.firstChild){
    //     genrateDiv.removeChild(genrateDiv.firstChild)
    // }

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getAllLabelsTagsTraps');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            globalLabels = reply.labels
            
            //Populate species selector
            texts = ['All']
            texts.push(...reply.labels)
            values = ['0']
            values.push(...reply.labels)
            clearSelect(document.getElementById('resultsSpeciesSelector'))
            fillSelect(document.getElementById('resultsSpeciesSelector'), texts, values)                
        }
    }
    xhttp.send();

}

function onload(){
    /**Function for initialising the page on load.*/
    addSurveys()
    buildGenResultsSelectors()
}

window.addEventListener('load', onload, false);