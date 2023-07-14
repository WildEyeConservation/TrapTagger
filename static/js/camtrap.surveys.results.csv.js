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

function updateCustomColNames() {
    /** Updates the custom column names in the csv custom column selectors. */
    
    allLevels = document.querySelectorAll('[id^=csvColLevelElement-]')
    for (let i=0;i<allLevels.length;i++) {
        level = allLevels[i].options[allLevels[i].selectedIndex].text
        if (level == 'Custom') {
            IDNum = allLevels[i].id.split("-")[allLevels[i].id.split("-").length-1]
            csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))

            for (let n=0;n<csvColDataElement.options.length;n++) {
                csvColDataElement.options[n].text = customColumns[csvColDataElement.options[n].value]
            }
        }
    }
}

function updateCustomRows() {
    /** Updates the custom row text fields in the csv form on a per-task basis. */

    allLevels = document.querySelectorAll('[id^=csvColLevelElement-]')
    allccTextInputs = document.querySelectorAll('[id^=ccTextInput-]')

    allTaskIDs = []
    allCustColumnID1s = []
    allCustCoumnID2s = []
    for (let i=0;i<allccTextInputs.length;i++) {
        splits = allccTextInputs[i].id.split('-')
        allTaskIDs.push(splits[3])
        allCustColumnID1s.push(splits[1])
        allCustCoumnID2s.push(splits[1]+'-'+splits[2])
    }

    handledTaskIDs = []
    handledCustColumnID1s = []
    handledCustCoumnID2s = []
    for (let i=0;i<allLevels.length;i++) {
        IDNum = allLevels[i].id.split("-")[allLevels[i].id.split("-").length-1]
        CSVCustColParDiv = document.getElementById('CSVCustColParDiv-'+String(IDNum))
        level = allLevels[i].options[allLevels[i].selectedIndex].text

        if (level == 'Custom') {
            csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
            ccID = csvColDataElement.options[csvColDataElement.selectedIndex].value
            custColLevels = document.querySelectorAll('[id^=custColLevelElement-'+String(ccID)+'-]')
            allTasks = document.querySelectorAll('[id^=csvTaskSelect-]')
            allSurveys = document.querySelectorAll('[id^=csvSurveySelect-]')
        
            hasText = false
            for (let n=0;n<custColLevels.length;n++) {
                data = custColLevels[n].options[custColLevels[n].selectedIndex].text
                if (data=='Text') {
                    hasText = true
                    break
                }
            }
        
            if (hasText) {
                handledCustColumnID1s.push(ccID)
                for (let n=0;n<allTasks.length;n++) {
                    taskID = allTasks[n].options[allTasks[n].selectedIndex].value
                    if (taskID != '-99999') {
                        handledTaskIDs.push(taskID)
                        text_field_count = 0
                        for (let k=0;k<custColLevels.length;k++) {
                            data = custColLevels[k].options[custColLevels[k].selectedIndex].text
                            if (data=='Text') {
                                text_field_count += 1
                                idNum2 = custColLevels[k].id.split('custColLevelElement-'+String(ccID)+'-')[1]
                                handledCustCoumnID2s.push(ccID+'-'+idNum2)
                                objectID = 'ccTextInput-'+String(ccID)+'-'+String(idNum2)+'-'+String(taskID)
                                if (document.getElementById(objectID)==null) {
                                    // Doesn't exist -> build it
                                    ccTaskDiv = document.getElementById('ccTaskDiv-'+String(ccID)+'-'+String(taskID))
                                    if (ccTaskDiv==null) {
                                        taskName = allTasks[n].options[allTasks[n].selectedIndex].text
                                        surveyName = allSurveys[n].options[allSurveys[n].selectedIndex].text
                        
                                        ccTaskDiv = document.createElement('div')
                                        ccTaskDiv.id = 'ccTaskDiv-'+String(ccID)+'-'+String(taskID)
                                        CSVCustColParDiv.appendChild(ccTaskDiv)
                        
                                        ccTaskRow = document.createElement('div')
                                        ccTaskRow.classList.add('row')
                                        ccTaskRow.id = 'ccTaskRow-'+String(ccID)+'-'+String(idNum2)+'-'+String(taskID)
                                        ccTaskDiv.append(ccTaskRow)
                        
                                        col1 = document.createElement('div')
                                        col1.classList.add('col-lg-3')
                                        ccTaskRow.appendChild(col1)
                        
                                        col2 = document.createElement('div')
                                        col2.classList.add('col-lg-3')
                                        col2.setAttribute('style',"display: flex; justify-content: center; align-content: center; flex-direction: column;")
                                        col2.innerHTML = surveyName + '-' + taskName
                                        ccTaskRow.appendChild(col2)
                        
                                        col3 = document.createElement('div')
                                        col3.classList.add('col-lg-3')
                                        ccTaskRow.appendChild(col3)
                                    } else {
                                        ccTaskRow = document.createElement('div')
                                        ccTaskRow.classList.add('row')
                                        ccTaskRow.id = 'ccTaskRow-'+String(ccID)+'-'+String(idNum2)+'-'+String(taskID)
                                        ccTaskDiv.append(ccTaskRow)
                        
                                        col1 = document.createElement('div')
                                        col1.classList.add('col-lg-3')
                                        ccTaskRow.appendChild(col1)
                        
                                        col2 = document.createElement('div')
                                        col2.classList.add('col-lg-3')
                                        ccTaskRow.appendChild(col2)
                        
                                        col3 = document.createElement('div')
                                        col3.classList.add('col-lg-3')
                                        ccTaskRow.appendChild(col3)
                                    }
                
                                    textInput = document.createElement('input')
                                    textInput.setAttribute('style',"background-color:white")
                                    textInput.setAttribute('type','text')
                                    textInput.setAttribute('placeholder','Text Field '+String(text_field_count))
                                    textInput.setAttribute('id',objectID)
                                    textInput.classList.add('form-control')
                                    col3.appendChild(textInput)
                                } else {
                                    document.getElementById(objectID).setAttribute('placeholder','Text Field '+String(text_field_count))
                                }
                            }
                        }
                    }
                }
            } else {
                //clear
                while(CSVCustColParDiv.firstChild){
                    CSVCustColParDiv.removeChild(CSVCustColParDiv.firstChild);
                }
            }
        } else {
            while(CSVCustColParDiv.firstChild){
                CSVCustColParDiv.removeChild(CSVCustColParDiv.firstChild);
            }
        }
    }

    // Remove excess ID2s
    for (let i=0;i<allCustCoumnID2s.length;i++) {
        if (!handledCustCoumnID2s.includes(allCustCoumnID2s[i])) {
            // ID2 has been removed
            ccID = allCustCoumnID2s[i].split('-')[0]
            idNum2 = allCustCoumnID2s[i].split('-')[1]
            for (let n=0;n<allTasks.length;n++) {
                taskID = allTasks[n].options[allTasks[n].selectedIndex].value
                document.getElementById('ccTaskRow-'+String(ccID)+'-'+String(idNum2)+'-'+String(taskID)).remove()
            }
        }
    }

    // Remove excess tasks
    for (let i=0;i<allTaskIDs.length;i++) {
        if (!handledTaskIDs.includes(allTaskIDs[i])) {
            taskID = allTaskIDs[i]
            for (let ccID in customColumns) {
                document.getElementById('ccTaskDiv-'+String(ccID)+'-'+String(taskID)).remove()
            }
        }
    }

    // Remove excess ID1s
    for (let i=0;i<allCustColumnID1s.length;i++) {
        if (!handledCustColumnID1s.includes(allCustColumnID1s[i])) {
            for (let n=0;n<allLevels.length;n++) {
                level = allLevels[n].options[allLevels[n].selectedIndex].text
        
                if (level == 'Custom') {
                    IDNum = allLevels[n].id.split("-")[allLevels[n].id.split("-").length-1]
                    csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
                    ccID = csvColDataElement.options[csvColDataElement.selectedIndex].value

                    if (ccID==allCustColumnID1s[i]) {
                        CSVCustColParDiv = document.getElementById('CSVCustColParDiv-'+String(IDNum))
                        while(CSVCustColParDiv.firstChild){
                            CSVCustColParDiv.removeChild(CSVCustColParDiv.firstChild);
                        }

                        allLevels[n].selectedIndex = 0
                    }
                }
            }
        }
    }
}

function checkCSV() {
    /** Checks the format of the csv modal, updates the legalCSV status and updates the errors list accordingly. */
    
    updateCustomRows()
    allLevels = document.querySelectorAll('[id^=csvColLevelElement-]');

    columns = []
    duplicateColumns = false
    allClash = false
    surveyAll = false
    surveySpecies = false
    trapAll = false
    trapSpecies = false
    cameraAll = false
    cameraSpecies = false
    excludeProblem = false
    duplicateTask = false
    invalidDate = false
    invalidName = false

    // Handles the selection of duplicate annototation tasks
    allTasks = document.querySelectorAll('[id^=csvTaskSelect-]')
    for (let i=0;i<allTasks.length;i++) {
        currTaskVal = allTasks[i].value
        for (let j=0;j<allTasks.length;j++) {
            if(allTasks[j].value == currTaskVal && j!=i){
                duplicateTask = true
            }
        }
    }

    // Handle include/exclude
    if (document.getElementById('excludeLabels').checked) {
        includeSelectors = document.querySelectorAll('[id^=includeSelect-]')
        for (let i=0;i<includeSelectors.length;i++) {
            label = includeSelectors[i].options[includeSelectors[i].selectedIndex].text
            if (label == 'All') {
                excludeProblem = true
                break
            }
        }
    }

    // Handle date
    startDateCSV = document.getElementById('startDateCSV').value
    endDateCSV = document.getElementById('endDateCSV').value
    if (startDateCSV != '' && endDateCSV != '') {
        if (startDateCSV > endDateCSV) {
            invalidDate = true
        }
    }

    species_count_warning = false
    for (let i=0;i<allLevels.length;i++) {
        IDNum = allLevels[i].id.split("-")[allLevels[i].id.split("-").length-1]
        csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
        level = allLevels[i].options[allLevels[i].selectedIndex].text
        data = csvColDataElement.options[csvColDataElement.selectedIndex].text

        csvErrors = document.getElementById('csvErrors')
        while(csvErrors.firstChild){
            csvErrors.removeChild(csvErrors.firstChild);
        }

        if (data == 'Species Count') {
            csvColSpeciesElement = document.getElementById('csvColSpeciesElement-'+String(IDNum))
            species = csvColSpeciesElement.options[csvColSpeciesElement.selectedIndex].text
            if (species=='All') {
                if (level=='Survey') {
                    surveyAll = true
                } else if (level=='Trapgroup') {
                    trapAll = true
                } else {
                    cameraAll = true
                }
            } else {
                if (level=='Survey') {
                    surveySpecies = true
                } else if (level=='Trapgroup') {
                    trapSpecies = true
                } else {
                    cameraSpecies = true
                }
            }
            column = level+'_'+data+'_'+species
            if (columns.includes(column)) {
                duplicateColumns = true
            } else {
                columns.push(column)
            }

            var formData = new FormData()
            formData.append("task_ids", JSON.stringify([selectedTask]))
            formData.append("species", JSON.stringify(species))

            var xhttp = new XMLHttpRequest();
            xhttp.open("POST", '/checkSightingEditStatus');
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);  
                    if ((reply.status=='warning')&&(species_count_warning==false)) {
                        species_count_warning = true
                        newdiv = document.createElement('div')
                        newdiv.innerHTML = reply.message
                        document.getElementById('csvErrors').appendChild(newdiv)
                    }
                }
            }
            xhttp.send(formData);

        } else {
            column = level+'_'+data
            if (columns.includes(column)) {
                duplicateColumns = true
            } else {
                columns.push(column)
            }
        }
    }

    allNames = document.querySelectorAll('[id^=csvColNameElement-]')
    for (let i=0;i<allNames.length;i++) {
        var name = allNames[i].value
        if (name=='') {
            invalidName = true
        }
    }

    if (surveyAll&&surveySpecies) {
        allClash = true
    } else if (trapAll&&trapSpecies) {
        allClash = true
    } else if (cameraAll&&cameraSpecies) {
        allClash = true
    }

    if (excludeProblem) {
        document.getElementById('cludeErrors').innerHTML = 'You cannot exclude all labels. This results in an empty csv.'
    } else {
        document.getElementById('cludeErrors').innerHTML = ''
    }

    if (allClash) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'You can either have all species counts for a particular level, or specific species counts, but not both.'
        csvErrors.appendChild(newdiv)
    }

    if (duplicateColumns) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'You have duplicate columns, please remove one.'
        csvErrors.appendChild(newdiv)
    }

    if (invalidName) {
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'You have an empty column name, please fill it in.'
        csvErrors.appendChild(newdiv)
    }

    if (duplicateTask) {
        document.getElementById('taskError').innerHTML = 'You have duplicate annotation sets, please remove the duplicate.'
    } else {
        document.getElementById('taskError').innerHTML = ''
    }

    if (invalidDate) {
        document.getElementById('dateErrorsCSV').innerHTML = 'The start date must be before the end date.'
    } else {
        document.getElementById('dateErrorsCSV').innerHTML = ''
    }

    if (excludeProblem||allClash||duplicateColumns||(allLevels.length==0)||duplicateTask||invalidDate||invalidName) {
        legalCSV = false
    } else {
        legalCSV = true
    }
}

btnCsvGenerate.addEventListener('click', ()=>{
    /** Listener on the generate csv button that opens the associated modal. */
    modalResults.modal('hide')
    modalCSVGenerate.modal({keyboard: true});
});

function translateCsvInfo(levelSelection,dataSelection) {
    /** Translates from new naming conevtions to old */

    if (levelSelection=='site') {
        levelSelection='trapgroup'
    } else if (levelSelection=='sighting') {
        levelSelection='detection'
    }

    if (['Name','ID'].includes(dataSelection)) {
        if ((levelSelection=='image')&&(dataSelection=='ID')) {
            dataSelection = 'id'
        } else if (levelSelection!='capture') {
            dataSelection = levelSelection
        }
    }

    if (dataSelection=='Description') {
        dataSelection = 'Survey Description'
    }

    if ((levelSelection=='capture')&&(dataSelection=='Number')) {
        dataSelection = 'Capture'
    }

    return {'levelSelection':levelSelection,'dataSelection':dataSelection}
}

btnCsvDownload.addEventListener('click', ()=>{
    /** Listener on the csv download button. Checks the legality of the csv before packaging the information and sending the request to the server. */
    checkCSV()
   
    if (legalCSV) {
        document.getElementById('btnCsvDownload').disabled = true
        allColumns = document.querySelectorAll('[id^=csvColLevelElement-]');
        level = CSVlevelSelector.options[CSVlevelSelector.selectedIndex].text.toLowerCase();
        noEmpties = true

        if (level=='site') {
            level = 'trapgroup'
        } else if (level=='sighting') {
            level = 'detection'
        }

        //label_type
        if (document.getElementById('listLabelFormat').checked) {
            label_type='list'
        } else if (document.getElementById('columnLabelFormat').checked) {
            label_type='column'
        } else if (document.getElementById('rowLabelFormat').checked) {
            label_type='row'
        }
    
        columns = []
        var column_translations = {}
        for (let i=0;i<allColumns.length;i++) {
            IDNum = allColumns[i].id.split("-")[allColumns[i].id.split("-").length-1]
            csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
            levelSelection = allColumns[i].options[allColumns[i].selectedIndex].text.toLowerCase()
            dataSelection = csvColDataElement.options[csvColDataElement.selectedIndex].text
            csvColNameElement = document.getElementById('csvColNameElement-'+String(IDNum))

            if ((levelSelection=='')||(dataSelection=='')) {
                noEmpties = false
            }

            translation = translateCsvInfo(levelSelection,dataSelection)
            levelSelection = translation['levelSelection']
            dataSelection = translation['dataSelection']
            var col_translation = ''
            if (levelSelection == 'custom') {
                selection = dataSelection
                col_translation = selection
            } else if (dataSelection == 'Species Count') {
                csvColSpeciesElement = document.getElementById('csvColSpeciesElement-'+String(IDNum))
                speciesSelection = csvColSpeciesElement.options[csvColSpeciesElement.selectedIndex].text
                selection = levelSelection+'_'+speciesSelection.toLowerCase().replace(' ','_')+'_count'
                col_translation = selection
            } else if (['Image Count', 'Animal Count'].includes(dataSelection)) {
                selection = levelSelection+'_'+dataSelection.toLowerCase().replace(' ','_')
                col_translation = selection
            } else if (dataSelection == 'Labels') {
                selection = levelSelection+'_labels'
                if (label_type != 'column') {
                    col_translation = selection
                } else {
                    col_translation = levelSelection+'_label'
                }
            } else if (dataSelection == 'Tags') {
                selection = levelSelection+'_tags'
                if (label_type != 'column') {
                    col_translation = selection
                } else {
                    col_translation = levelSelection+'_tag'
                }
            } else if (dataSelection == 'URL') {
                selection = levelSelection+'_url'
                col_translation = selection
            } else if (dataSelection == 'Individuals') {
                selection = levelSelection+'_individuals'
                if (label_type != 'column') {
                    col_translation = selection
                } else {
                    col_translation = levelSelection+'_individual'
                }         
            } else if (dataSelection == 'Sighting Count') {
                selection = levelSelection+'_sighting_count'
                col_translation = selection
            } else {
                selection = dataSelection.toLowerCase().replace(' ','_')
                col_translation = selection
            }
            columns.push(selection)

            if (csvColNameElement.value.toLowerCase() != selection.toLowerCase()) {
                column_translations[col_translation] = csvColNameElement.value
            }
        }

        selectedTasks = []
        allTasks = document.querySelectorAll('[id^=csvTaskSelect-]')
        for (let i=0;i<allTasks.length;i++) {
            task_id = allTasks[i].options[allTasks[i].selectedIndex].value
            if (task_id != '-99999') {
                selectedTasks.push(task_id)
            }
        }

        // Handle include/exclude
        includes = []
        excludes = []
        includeSelectors = document.querySelectorAll('[id^=includeSelect-]')
        for (let i=0;i<includeSelectors.length;i++) {
            label = includeSelectors[i].options[includeSelectors[i].selectedIndex].text
            if (label == 'All') {
                includes = []
                excludes = []
                break
            }
            if (document.getElementById('excludeLabels').checked) {
                excludes.push(label)
            } else {
                includes.push(label)
            }
        }

        custom_columns = {}
        for (let n=0;n<selectedTasks.length;n++) {
            task_id = selectedTasks[n]
            custom_columns[task_id] = {}
            for (let IDNum1 in customColumns) {
                custColLevelElements = document.querySelectorAll('[id^=custColLevelElement-'+String(IDNum1)+'-]');
                custom_name = customColumns[IDNum1]
                
                custom_column = ''
                for (let i=0;i<custColLevelElements.length;i++) {
                    IDNum2 = custColLevelElements[i].id.split('custColLevelElement-'+String(IDNum1)+'-')[1]
                    custColDataElement = document.getElementById('custColDataElement-'+String(IDNum1)+'-'+String(IDNum2))
                    levelSelection = custColLevelElements[i].options[custColLevelElements[i].selectedIndex].text.toLowerCase()
                    dataSelection = custColDataElement.options[custColDataElement.selectedIndex].text

                    translation = translateCsvInfo(levelSelection,dataSelection)
                    levelSelection = translation['levelSelection']
                    dataSelection = translation['dataSelection']

                    if (levelSelection=='text') {
                        selection = document.getElementById('ccTextInput-'+String(IDNum1)+'-'+String(IDNum2)+'-'+String(task_id)).value
                    } else {                
                        if (dataSelection == 'Species Count') {
                            // TODO: This probably doesn't work anymore
                            csvColSpeciesElement = document.getElementById('csvColSpeciesElement-'+String(IDNum))
                            speciesSelection = csvColSpeciesElement.options[csvColSpeciesElement.selectedIndex].text
                            selection = levelSelection+'_'+speciesSelection+'_count'
                        } else if (['Image Count', 'Animal Count'].includes(dataSelection)) {
                            selection = levelSelection+'_'+dataSelection.toLowerCase().replace(' ','_')
                        } else if (dataSelection == 'Labels') {
                            selection = levelSelection+'_labels'
                        } else if (dataSelection == 'Tags') {
                            selection = levelSelection+'_tags'
                        } else if (dataSelection == 'URL') {
                            selection = levelSelection+'_url'
                        } else if (dataSelection == 'Individuals') {
                            selection = levelSelection+'_individuals'
                        } else if (dataSelection == 'Sighting Count') {
                            selection = levelSelection+'_sighting_count'
                        } else {
                            selection = dataSelection.toLowerCase().replace(' ','_')
                        }
                    }

                    custom_column += '%%%%'+selection+'%%%%'
                }

                custom_columns[task_id][custom_name] = custom_column
            }
        }
        // Date range
        startDateCSV = document.getElementById('startDateCSV').value
        endDateCSV = document.getElementById('endDateCSV').value

        if(startDateCSV != ''){
            startDateCSV = startDateCSV + ' 00:00:00'
        }

        if(endDateCSV != ''){
            endDateCSV = endDateCSV + ' 23:59:59'
        }

        if (noEmpties) {
            var formData = new FormData()
            formData.append("selectedTasks", JSON.stringify(selectedTasks))
            formData.append("level", JSON.stringify(level))
            formData.append("columns", JSON.stringify(columns))
            formData.append("custom_columns", JSON.stringify(custom_columns))
            formData.append("label_type", JSON.stringify(label_type))
            formData.append("includes", JSON.stringify(includes))
            formData.append("excludes", JSON.stringify(excludes))
            formData.append("start_date", JSON.stringify(startDateCSV))
            formData.append("end_date", JSON.stringify(endDateCSV))
            formData.append("column_translations", JSON.stringify(column_translations))

            var xhttp = new XMLHttpRequest();
            xhttp.open("POST", '/generateCSV');
            xhttp.onreadystatechange =
            function(selectedtask){
                return function() {
                    if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);  
                        if (reply.status=='success') {
                            document.getElementById('modalPWH').innerHTML = 'Please Wait'
                            document.getElementById('modalPWB').innerHTML = 'Your CSV file is being generated and the download will commence shortly. Please note that this may take a while, especially for larger data sets. Do not navigate away from this page.'
                            modalCSVGenerate.modal('hide')
                            modalPW.modal({keyboard: true});
                            csv_task_ids.push(selectedtask)
                            waitForDownload()
                        } else {
                            document.getElementById('modalPWH').innerHTML = 'Error'
                            if(reply.message == null){
                                document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'  
                            }
                            else{
                                document.getElementById('modalPWB').innerHTML = reply.message
                            }
                            modalPW.modal({keyboard: true});
                            document.getElementById('btnCsvDownload').disabled = false
                        }
                    }
                }
            }(selectedTasks[0])
            xhttp.send(formData);
        } else {
            csvErrors = document.getElementById('csvErrors')
            newdiv = document.createElement('div')
            newdiv.innerHTML = 'You cannot have empty columns.'
            csvErrors.appendChild(newdiv)
            document.getElementById('btnCsvDownload').disabled = false
        }
    }
});

function downloadPreFormattedCSV() {
    /** requests a pre-formatted csv for the currently selected task. */
    var formData = new FormData()
    formData.append("preformatted", JSON.stringify(selectedTask))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/generateCSV');
    xhttp.onreadystatechange =
    function(selectedtask){
        return function() {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply.status=='success') {
                    document.getElementById('modalPWH').innerHTML = 'Please Wait'
                    document.getElementById('modalPWB').innerHTML = 'Your CSV file is being generated and the download will commence shortly. Please note that this may take a while, especially for larger data sets. Do not navigate away from this page.'
                    modalResults.modal('hide')
                    modalPW.modal({keyboard: true});
                    csv_task_ids.push(selectedtask)
                    waitForDownload()
                } else {
                    document.getElementById('modalPWH').innerHTML = 'Error'
                    if(reply.message == null){
                        document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'  
                    }
                    else{
                        document.getElementById('modalPWB').innerHTML = reply.message
                    }
                    modalPW.modal({keyboard: true});
                }
            }
        }
    }(selectedTask)
    xhttp.send(formData);
}

function downloadCOCO() {
    /** requests a COCO file for the currently selected task. */
    var formData = new FormData()
    formData.append("task_id", JSON.stringify(selectedTask))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/generateCOCO');
    xhttp.onreadystatechange =
    function(selectedtask){
        return function() {
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);  
                if (reply=='success') {
                    document.getElementById('modalPWH').innerHTML = 'Please Wait'
                    document.getElementById('modalPWB').innerHTML = 'Your COCO file is being generated and the download will commence shortly. Please note that this may take a while, especially for larger data sets. Do not navigate away from this page.'
                    modalResults.modal('hide')
                    modalPW.modal({keyboard: true});
                    coco_task_ids.push(selectedtask)
                    waitForDownload()
                } else {
                    document.getElementById('modalPWH').innerHTML = 'Error'
                    document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'
                    modalPW.modal({keyboard: true});
                }
            }
        }
    }(selectedTask)
    xhttp.send(formData);
}

btnAddCSVCol.addEventListener('click', ()=>{
    /** Adds a csv column to the csv form. */
    IDNum = getIdNumforNext('csvColLevelElement');
    buildCSVrow(IDNum)
});

function updateSpeciesElement(IDNum) {
    /** Updates the species selector element with the specified ID number in the csv modal for species count columns. */

    csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
    data = csvColDataElement.options[csvColDataElement.selectedIndex].text;
    if (data=='Species Count') {
        CSVCol3 = document.getElementById('CSVCol3-'+String(IDNum))
        csvColSpeciesElement = document.createElement('select');
        csvColSpeciesElement.classList.add('form-control');
        csvColSpeciesElement.id = 'csvColSpeciesElement-'+String(IDNum);
        csvColSpeciesElement.name = csvColSpeciesElement.id;
        CSVCol3.appendChild(csvColSpeciesElement);
        clearSelect(csvColSpeciesElement)
        fillSelect(csvColSpeciesElement, speciesChoiceTexts, speciesChoiceValues)
        $('#csvColSpeciesElement-'+String(IDNum)).change( function(wrapIDNum) {
            return function() {
                updateNameElement(wrapIDNum)
                checkCSV()
            }
        }(IDNum));
    } else {
        var check = document.getElementById('csvColSpeciesElement-'+String(IDNum));
        if (check) {
            check.remove()
        }
    }
}

function updateDataElement(IDNum) {
    /** Updates the data element with the specified ID number in the generate csv form, depending on the level selected. */
    
    csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
    csvColLevelElement = document.getElementById('csvColLevelElement-'+String(IDNum))
    
    level = csvColLevelElement.options[csvColLevelElement.selectedIndex].value;
    levelName = csvColLevelElement.options[csvColLevelElement.selectedIndex].text;
    clearSelect(csvColDataElement)
    if (level == '-99999') {
        // Empty level
        fillSelect(csvColDataElement, [''], ['-99999'])
    } else if (levelName == 'Custom') {
        // Custom
        optionTexts = []
        optionValues = []
        for (let IDNum in customColumns) {
            optionValues.push(IDNum)
            optionTexts.push(customColumns[IDNum])
        }
        fillSelect(csvColDataElement, optionTexts, optionValues)
    } else {
        fillSelect(csvColDataElement, csvInfo[level].columns, [...Array(csvInfo[level].columns.length).keys()])
    }
}

function updateNameElement(IDNum) {
    /** Updates the name element with the specified ID number in the generate csv form, depending on the data selected. */

    csvColLevelElement = document.getElementById('csvColLevelElement-'+String(IDNum))
    csvColDataElement = document.getElementById('csvColDataElement-'+String(IDNum))
    levelSelection = csvColLevelElement.options[csvColLevelElement.selectedIndex].text
    dataSelection = csvColDataElement.options[csvColDataElement.selectedIndex].text

    if ((levelSelection=='')||(dataSelection=='')) {
        noEmpties = false
    }

    translation = translateCsvInfo(levelSelection,dataSelection)
    levelSelection = translation['levelSelection']
    dataSelection = translation['dataSelection']

    if (levelSelection == 'custom') {
        selection = dataSelection
    } else if (dataSelection == 'Species Count') {
        csvColSpeciesElement = document.getElementById('csvColSpeciesElement-'+String(IDNum))
        speciesSelection = csvColSpeciesElement.options[csvColSpeciesElement.selectedIndex].text
        selection = levelSelection+'_'+speciesSelection.toLowerCase().replace(' ','_')+'_count'
    } else if (['Image Count', 'Animal Count'].includes(dataSelection)) {
        selection = levelSelection+'_'+dataSelection.toLowerCase().replace(' ','_')
    } else if (dataSelection == 'Labels') {
        selection = levelSelection+'_labels'
    } else if (dataSelection == 'Tags') {
        selection = levelSelection+'_tags'
    } else if (dataSelection == 'URL') {
        selection = levelSelection+'_url'
    } else if (dataSelection == 'Individuals') {
        selection = levelSelection+'_individuals'
    } else if (dataSelection == 'Sighting Count') {
        selection = levelSelection+'_sighting_count'
    } else {
        selection = dataSelection.toLowerCase().replace(' ','_')
    }

    csvColNameElement = document.getElementById('csvColNameElement-'+String(IDNum))
    csvColNameElement.value = selection

}

function buildCSVrow(IDNum) {
    /** Builds a row in the generate csv form. */
    
    CSVColDiv = document.getElementById('CSVColDiv')

    CSVColParDiv = document.createElement('div')
    CSVColDiv.appendChild(CSVColParDiv)

    CSVCustColParDiv = document.createElement('div')
    CSVCustColParDiv.id = 'CSVCustColParDiv-'+String(IDNum)
    CSVColDiv.appendChild(CSVCustColParDiv)

    CSVColRow = document.createElement('div');
    CSVColRow.classList.add('row')
    CSVColParDiv.appendChild(CSVColRow);

    CSVCol0 = document.createElement('div');
    CSVCol0.classList.add('col-lg-3')
    CSVColRow.appendChild(CSVCol0);

    CSVCol1 = document.createElement('div');
    CSVCol1.classList.add('col-lg-3')
    CSVColRow.appendChild(CSVCol1);

    CSVCol2 = document.createElement('div');
    CSVCol2.classList.add('col-lg-3')
    CSVColRow.appendChild(CSVCol2);

    CSVCol3 = document.createElement('div');
    CSVCol3.classList.add('col-lg-2')
    CSVCol3.id = 'CSVCol3-'+String(IDNum);
    CSVColRow.appendChild(CSVCol3);

    CSVCol4 = document.createElement('div');
    CSVCol4.classList.add('col-lg-1')
    CSVColRow.appendChild(CSVCol4);

    csvColNameElement = document.createElement('input');
    csvColNameElement.classList.add('form-control');
    csvColNameElement.id = 'csvColNameElement-'+String(IDNum);
    csvColNameElement.name = csvColNameElement.id;
    CSVCol0.appendChild(csvColNameElement);

    csvColLevelElement = document.createElement('select');
    csvColLevelElement.classList.add('form-control');
    csvColLevelElement.id = 'csvColLevelElement-'+String(IDNum);
    csvColLevelElement.name = csvColLevelElement.id;
    CSVCol1.appendChild(csvColLevelElement);
    clearSelect(csvColLevelElement)
    fillSelect(csvColLevelElement, levelChoiceTexts, levelChoiceValues)

    csvColDataElement = document.createElement('select');
    csvColDataElement.classList.add('form-control');
    csvColDataElement.id = 'csvColDataElement-'+String(IDNum);
    csvColDataElement.name = csvColDataElement.id;
    CSVCol2.appendChild(csvColDataElement);
    fillSelect(csvColDataElement, [''], ['-99999'])

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.innerHTML = '&times;';
    btnRemove.addEventListener('click', (evt)=>{
        csvColLevelElement = evt.target.parentNode.parentNode.firstChild.firstChild
        IDNum = csvColLevelElement.id.split('-')[1]
        document.getElementById('CSVCustColParDiv-'+String(IDNum)).remove()
        evt.target.parentNode.parentNode.parentNode.remove();
        checkCSV()
    });
    CSVCol4.appendChild(btnRemove);

    $("#"+csvColLevelElement.id).change( function(wrapIDNum) {
        return function() {
            updateDataElement(wrapIDNum)
            updateSpeciesElement(wrapIDNum)
            updateNameElement(wrapIDNum)
            checkCSV()
        }
    }(IDNum));

    $("#"+csvColDataElement.id).change( function(wrapIDNum) {
        return function() {
            updateSpeciesElement(wrapIDNum)
            updateNameElement(wrapIDNum)
            checkCSV()
        }
    }(IDNum));
}

function buildCustColAddBtn(IDNum1,customColumnBtnDiv) {
    /** Builds the add-row button to a custom column in the generate-csv form. */
    
    row = document.createElement('div')
    row.classList.add('row')
    customColumnBtnDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    row.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    btnAdd = document.createElement('button');
    btnAdd.classList.add('btn');
    btnAdd.classList.add('btn-info');
    btnAdd.innerHTML = '+';
    btnAdd.addEventListener('click', function(wrapIDNum) {
        return function() {
            IDNum2 = getIdNumforNext('custColLevelElement-'+String(wrapIDNum)+'-')
            buildCustColRow(wrapIDNum,IDNum2)
        }
    }(IDNum1));
    col4.appendChild(btnAdd);
}

function buildCustColRow(IDNum1,IDNum2) {
    /**
     * Builds a custom column row in the generate-csv form.
     * @param {str} IDNum1 The ID number of the custom column
     * @param {str} IDNum2 The ID number of the row within the custom column
     */

    if ((IDNum1==0)&&(IDNum2==0)) {
        // Build heading row
        customColumnHeadingDiv = document.getElementById('customColumnHeadingDiv')

        row = document.createElement('div')
        row.classList.add('row')
        customColumnHeadingDiv.appendChild(row)
    
        col1 = document.createElement('div')
        col1.classList.add('col-lg-3')
        col1.innerHTML = 'Name'
        row.appendChild(col1)
    
        col2 = document.createElement('div')
        col2.classList.add('col-lg-3')
        col2.innerHTML = 'Level'
        row.appendChild(col2)
    
        col3 = document.createElement('div')
        col3.classList.add('col-lg-3')
        col3.innerHTML = 'Data'
        row.appendChild(col3)
    }

    if (IDNum2==0) {
        columnDiv = document.getElementById('customColumnDiv')

        customColumnParDiv = document.createElement('div')
        customColumnParDiv.id = 'customColumnDiv-' + String(IDNum1)
        columnDiv.appendChild(customColumnParDiv)

        customColumnDiv = document.createElement('div')
        customColumnDiv.id = 'customColumnRowsDiv-' + String(IDNum1)
        customColumnParDiv.appendChild(customColumnDiv)

        customColumnBtnDiv = document.createElement('div')
        customColumnParDiv.appendChild(customColumnBtnDiv)

        buildCustColAddBtn(IDNum1,customColumnBtnDiv)
    } else {
        customColumnDiv = document.getElementById('customColumnRowsDiv-' + String(IDNum1))
    }

    row = document.createElement('div')
    row.classList.add('row')
    row.id = 'custColRow-'+String(IDNum1)+'-'+String(IDNum2)
    customColumnDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    row.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    if (IDNum2==0) {
        colName = document.createElement('input')
        colName.setAttribute('style',"background-color:white")
        colName.setAttribute('type','text')
        colName.setAttribute('id','custColName-'+String(IDNum1))
        colName.classList.add('form-control')
        col1.appendChild(colName)

        $("#"+colName.id).change( function(wrapIDNum1) {
            return function() {
                colName = document.getElementById('custColName-'+String(wrapIDNum1)).value
                if (colName!='') {
                    customColumns[wrapIDNum1] = colName
                    updateCustomColNames()
                } else {
                    if (wrapIDNum1 in customColumns) {
                        delete customColumns[wrapIDNum1]
                    }
                }

            }
        }(IDNum1));
    }

    custCol  = document.createElement('select');
    custCol.classList.add('form-control');
    custCol.id = 'custColLevelElement-'+String(IDNum1)+'-'+String(IDNum2)
    custCol.name = custCol.id;
    col2.appendChild(custCol);
    texts = levelChoiceTexts.slice(0)
    index = texts.indexOf('Custom')
    texts.splice(index, 1);
    texts.splice(1, 0, 'Text')
    values = levelChoiceValues.slice(0)
    values.splice(index, 1);
    values.splice(1, 0, '-100')
    fillSelect(custCol, texts, values)

    custColData = document.createElement('select');
    custColData.classList.add('form-control');
    custColData.id = 'custColDataElement-'+String(IDNum1)+'-'+String(IDNum2)
    custColData.name = custColData.id;
    col3.appendChild(custColData);
    fillSelect(custColData, [''], ['-99999'])

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.innerHTML = '&times;';
    if (IDNum2==0) {
        btnRemove.addEventListener('click', function(wrapIDNum) {
            return function() {
                delete customColumns[wrapIDNum]
                document.getElementById('customColumnDiv-' + String(wrapIDNum)).remove()
                updateCustomRows()

                allNames = document.querySelectorAll('[id^=custColName-]');
                if (allNames.length==0) {
                    customColumnHeadingDiv = document.getElementById('customColumnHeadingDiv')
                    while(customColumnHeadingDiv.firstChild){
                        customColumnHeadingDiv.removeChild(customColumnHeadingDiv.firstChild);
                    }
                }
            }
        }(IDNum1));
    } else {
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.remove();
            updateCustomRows()
        });
    }
    col4.appendChild(btnRemove);

    $("#"+custCol.id).change( function(wrapIDNum1,wrapIDNum2) {
        return function() {
            custColDataElement = document.getElementById('custColDataElement-'+String(wrapIDNum1)+'-'+String(wrapIDNum2))
            csvColLevelElement = document.getElementById('custColLevelElement-'+String(wrapIDNum1)+'-'+String(wrapIDNum2))
            
            level = csvColLevelElement.options[csvColLevelElement.selectedIndex].value;
            
            clearSelect(custColDataElement)

            if ((level != '-99999')&&(level != '-100')) {
                optionTexts = []
                optionValues = []
                for (let i=0;i<csvInfo[level].columns.length;i++) {
                    if (csvInfo[level].columns[i]!='Species Count') {
                        optionTexts.push(csvInfo[level].columns[i])
                    }
                }
                fillSelect(custColDataElement, optionTexts, [...Array(optionTexts.length).keys()])
            } else {
                fillSelect(custColDataElement, [''], ['-99999'])
            }
            updateCustomRows()
        }
    }(IDNum1,IDNum2));

    $("#"+custColData.id).change( function() {
        updateCustomRows()
    });
}

function buildCSVsurveyRow() {
    /** Builds a survey row in the csv form. */
    
    IDNum = getIdNumforNext('csvSurveySelect-')
    addSurveyDiv = document.getElementById('addSurveyDiv')

    row = document.createElement('div')
    row.classList.add('row')
    addSurveyDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-3')
    row.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    col4 = document.createElement('div')
    col4.classList.add('col-lg-3')
    row.appendChild(col4)

    csvSurveySelect = document.createElement('select')
    csvSurveySelect.classList.add('form-control')
    csvSurveySelect.id = 'csvSurveySelect-'+String(IDNum)
    csvSurveySelect.name = csvSurveySelect.id
    col1.appendChild(csvSurveySelect)

    csvTaskSelect = document.createElement('select')
    csvTaskSelect.classList.add('form-control')
    csvTaskSelect.id = 'csvTaskSelect-'+String(IDNum)
    csvTaskSelect.name = csvTaskSelect.id
    col2.appendChild(csvTaskSelect)

    if (surveys != null) {
        if (IDNum==0) {
            clearSelect(csvSurveySelect)
            csvSurveySelect.disabled = true
            csvTaskSelect.disabled = true
            fillSelect(csvSurveySelect, [surveyName], [String(selectedSurvey)])
            fillSelect(csvTaskSelect, [taskName], [String(selectedTask)])
        } else {
            optionTexts = ['None']
            optionValues = ["-99999"]           
            for (let i=0;i<surveys.length;i++) {
                optionTexts.push(surveys[i][1])
                optionValues.push(surveys[i][0])
            }
            clearSelect(csvSurveySelect)
            fillSelect(csvSurveySelect, optionTexts, optionValues)
            fillSelect(csvTaskSelect, [''], ['-99999'])
        }
    }

    if (IDNum!=0) {
        btnRemove = document.createElement('button');
        btnRemove.classList.add('btn');
        btnRemove.classList.add('btn-default');
        btnRemove.innerHTML = '&times;';
        btnRemove.addEventListener('click', (evt)=>{
            evt.target.parentNode.parentNode.remove();
            updateCustomRows()
        });
        col4.appendChild(btnRemove);
    }

    $("#"+csvSurveySelect.id).change( function(wrapIDNum) {
        return function() {
            csvSurveySelect = document.getElementById('csvSurveySelect-'+String(wrapIDNum))
            csvTaskSelect = document.getElementById('csvTaskSelect-'+String(wrapIDNum))
            survey = csvSurveySelect.options[csvSurveySelect.selectedIndex].value
            if (survey=="-99999") {
                clearSelect(csvTaskSelect)
                fillSelect(csvTaskSelect, [''], ['-99999'])
                csvSurveyUpdates()
            } else {
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange =
                function(wrapCsvTaskSelect){
                    return function() {
                        if (this.readyState == 4 && this.status == 200) {
                            tasks = JSON.parse(this.responseText);  
                            optionTexts = []      
                            optionValues = []
                            for (let i=0;i<tasks.length;i++) {
                                optionTexts.push(tasks[i][1])
                                optionValues.push(tasks[i][0])
                            }
                            clearSelect(wrapCsvTaskSelect)
                            fillSelect(wrapCsvTaskSelect, optionTexts, optionValues)
                            csvSurveyUpdates()
                        }
                    }
                }(csvTaskSelect)
                xhttp.open("GET", '/getTasks/'+survey);
                xhttp.send();
            }
        }
    }(IDNum));

    $("#"+csvTaskSelect.id).change( function() {
        csvSurveyUpdates()
        checkCSV()
    })
}

function updateIncludeFields() {
    /** Updates all include/exclude fields */
    includeSelectors = document.querySelectorAll('[id^=includeSelect-]')
    for (let i=0;i<includeSelectors.length;i++) {
        if (includeSelectors[i].selectedIndex == -1) {
            label = null
        } else {
            label = includeSelectors[i].options[includeSelectors[i].selectedIndex].text
        }
        clearSelect(includeSelectors[i])
        texts = speciesChoiceTexts
        values = speciesChoiceValues
        if (!texts.includes('Nothing'))
        {
            texts.splice(1, 0, 'Nothing')
            values.splice(1, 0, '-98')
        }
        fillSelect(includeSelectors[i],texts,values)
        if (label != null) {
            for (let n=0;n<includeSelectors[i].options.length;n++) {
                if (includeSelectors[i].options[n].text == label) {
                    includeSelectors[i].selectedIndex = n
                    break
                }
            }
        }
    }
}

function csvSurveyUpdates() {
    /** Updates all necessary selectors and rows when the survey list in the csv form changes. */
    updateCustomRows()

    selectedTasks = []
    allTasks = document.querySelectorAll('[id^=csvTaskSelect-]')
    for (let i=0;i<allTasks.length;i++) {
        task_id = allTasks[i].options[allTasks[i].selectedIndex].value
        if (task_id != '-99999') {
            selectedTasks.push(task_id)
        }
    }

    var formData = new FormData()
    formData.append("selectedTasks", JSON.stringify(selectedTasks))

    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", '/getSpeciesandIDs/0');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            speciesChoiceTexts = reply.names
            speciesChoiceValues = reply.ids
            
            csvColSpeciesElements = document.querySelectorAll('[id^=csvColSpeciesElement-]');
            for (let i=0;i<csvColSpeciesElements.length;i++) {
                csvColSpeciesElement = csvColSpeciesElements[i]
                species = csvColSpeciesElement.options[csvColSpeciesElement.selectedIndex].text
                index = speciesChoiceTexts.indexOf(species)
                clearSelect(csvColSpeciesElement)
                fillSelect(csvColSpeciesElement, speciesChoiceTexts, speciesChoiceValues)
                csvColSpeciesElement.selectedIndex = index
            }

            updateIncludeFields()
        }
    }
    xhttp.send(formData);
}

function buildIncludeRow() {
    /** Builds an include/exclude row */

    IDNum = getIdNumforNext('includeSelect')
    csvIncludeDiv = document.getElementById('csvIncludeDiv')

    row = document.createElement('div')
    row.classList.add('row')
    csvIncludeDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-6')
    row.appendChild(col1)

    select = document.createElement('select')
    select.classList.add('form-control')
    select.id = 'includeSelect-'+String(IDNum)
    select.name = select.id
    col1.appendChild(select)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-1')
    row.appendChild(col2)

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.innerHTML = '&times;';
    btnRemove.addEventListener('click', (evt)=>{
        evt.target.parentNode.parentNode.remove();
    });
    col2.appendChild(btnRemove);

    $('#includeSelect-'+String(IDNum)).change( function() {
        checkCSV()
    });

    updateIncludeFields()
}

function finishCSVprep() {
    /** Finishes the prep of the csv form after the necessary information has been recieved from the server. */

    // Prep survey selector
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            surveys = JSON.parse(this.responseText);  
            buildCSVsurveyRow()
        }
    }
    xhttp.open("GET", '/getSurveys');
    xhttp.send();

    // add survey button
    addSurveyBtnDiv = document.getElementById('addSurveyBtnDiv')
    row = document.createElement('div')
    row.classList.add('row')
    addSurveyBtnDiv.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-2')
    row.appendChild(col)

    btnAdd = document.createElement('button');
    btnAdd.classList.add('btn');
    btnAdd.classList.add('btn-primary');
    btnAdd.classList.add('btn-block');
    btnAdd.innerHTML = 'Add Survey';
    btnAdd.addEventListener('click', ()=>{
        buildCSVsurveyRow()
    });
    col.appendChild(btnAdd);

    // add new custom column button
    customColumnBtnDiv = document.getElementById('customColumnBtnDiv')
    row = document.createElement('div')
    row.classList.add('row')
    customColumnBtnDiv.appendChild(row)

    col = document.createElement('div')
    col.classList.add('col-lg-2')
    row.appendChild(col)

    btnAdd = document.createElement('button');
    btnAdd.classList.add('btn');
    btnAdd.classList.add('btn-primary');
    btnAdd.classList.add('btn-block');
    btnAdd.innerHTML = 'Add Column';
    btnAdd.addEventListener('click', ()=>{
        IDNum1 = getIdNumforNext('custColName-')
        buildCustColRow(IDNum1,0)
    });
    col.appendChild(btnAdd);

    // Fill level selector, with an on change: prep first row
    CSVlevelSelector = document.getElementById('CSVlevelSelector')
    var optionTexts=[]
    var optionValues=[]
    for (let key in csvInfo) {
        if (csvInfo.hasOwnProperty(key)) {
            if (csvInfo[key].name != 'Custom') {
                optionTexts.push(csvInfo[key].name)
                optionValues.push(key)
            }
        }
    }
    clearSelect(CSVlevelSelector)
    fillSelect(CSVlevelSelector, optionTexts, optionValues)
    CSVlevelSelector.value='1'

    // Update level choices
    level = CSVlevelSelector.options[CSVlevelSelector.selectedIndex].value;
    levelChoiceTexts = ['']
    levelChoiceValues = ['-99999']
    levelInt = parseInt(level)
    for (let key in csvInfo) {
        if (csvInfo.hasOwnProperty(key)) {
            if (parseInt(key)>=levelInt) {
                levelChoiceTexts.push(csvInfo[key].name)
                levelChoiceValues.push(key)
            }
        }
    }

    // Build include/exclude row
    csvIncludeDiv = document.getElementById('csvIncludeDiv')
    while(csvIncludeDiv.firstChild){
        csvIncludeDiv.removeChild(csvIncludeDiv.firstChild);
    }
    buildIncludeRow()

    // Build first row
    buildCSVrow(0)

    $("#CSVlevelSelector").change( function() {
        // Clear rows
        CSVColDiv = document.getElementById('CSVColDiv')
        while(CSVColDiv.firstChild){
            CSVColDiv.removeChild(CSVColDiv.firstChild);
        }

        // Clear warnings
        csvErrors = document.getElementById('csvErrors')
        while(csvErrors.firstChild){
            csvErrors.removeChild(csvErrors.firstChild);
        }

        // Clear Custom Columns
        customColumnDiv = document.getElementById('customColumnDiv')
        while(customColumnDiv.firstChild){
            customColumnDiv.removeChild(customColumnDiv.firstChild);
        }
        customColumnHeadingDiv = document.getElementById('customColumnHeadingDiv')
        while(customColumnHeadingDiv.firstChild){
            customColumnHeadingDiv.removeChild(customColumnHeadingDiv.firstChild);
        }

        // Update level choices
        CSVlevelSelector = document.getElementById('CSVlevelSelector')
        level = CSVlevelSelector.options[CSVlevelSelector.selectedIndex].value;
        levelChoiceTexts = ['']
        levelChoiceValues = ['-99999']
        levelInt = parseInt(level)
        for (let key in csvInfo) {
            if (csvInfo.hasOwnProperty(key)) {
                if (parseInt(key)>=levelInt) {
                    levelChoiceTexts.push(csvInfo[key].name)
                    levelChoiceValues.push(key)
                }
            }
        }

        // Create first row
        buildCSVrow(0) 
    });
}

modalCSVGenerate.on('shown.bs.modal', function(){
    /** Begins the prep of the generate csv modal when it is opened. */
    
    if (helpReturn) {
        helpReturn = false
    } else {
        document.getElementById('listLabelFormat').checked = false
        document.getElementById('columnLabelFormat').checked = true
        document.getElementById('rowLabelFormat').checked = false
        document.getElementById('includeLabels').checked = true
        document.getElementById('excludeLabels').checked = false
        if (csvInfo==null) {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getCSVinfo');
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    csvInfo = JSON.parse(this.responseText);
    
                    var xhttp = new XMLHttpRequest();
                    xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
                    xhttp.onreadystatechange =
                    function(){
                        if (this.readyState == 4 && this.status == 200) {
                            reply = JSON.parse(this.responseText);
                            speciesChoiceTexts = reply.names
                            speciesChoiceValues = reply.ids
                            finishCSVprep()
                        }
                    }
                    xhttp.send();
                }
            }
            xhttp.send();
        } else {
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    reply = JSON.parse(this.responseText);
                    speciesChoiceTexts = reply.names
                    speciesChoiceValues = reply.ids
                    finishCSVprep()
                }
            }
            xhttp.send();
        }
    }
});

modalCSVGenerate.on('hidden.bs.modal', function(){
    /** Clears the csv modal when it is closed. */
    
    if (!helpReturn) {
        clearSelect(document.getElementById('CSVlevelSelector'))
        CSVColDiv = document.getElementById('CSVColDiv')
        while(CSVColDiv.firstChild){
            CSVColDiv.removeChild(CSVColDiv.firstChild);
        }
        csvErrors = document.getElementById('csvErrors')
        while(csvErrors.firstChild){
            csvErrors.removeChild(csvErrors.firstChild);
        }
        addSurveyDiv = document.getElementById('addSurveyDiv')
        while(addSurveyDiv.firstChild){
            addSurveyDiv.removeChild(addSurveyDiv.firstChild);
        }
        customColumnDiv = document.getElementById('customColumnDiv')
        while(customColumnDiv.firstChild){
            customColumnDiv.removeChild(customColumnDiv.firstChild);
        }
        customColumnHeadingDiv = document.getElementById('customColumnHeadingDiv')
        while(customColumnHeadingDiv.firstChild){
            customColumnHeadingDiv.removeChild(customColumnHeadingDiv.firstChild);
        }
        addSurveyBtnDiv = document.getElementById('addSurveyBtnDiv')
        while(addSurveyBtnDiv.firstChild){
            addSurveyBtnDiv.removeChild(addSurveyBtnDiv.firstChild);
        }
        customColumnBtnDiv = document.getElementById('customColumnBtnDiv')
        while(customColumnBtnDiv.firstChild){
            customColumnBtnDiv.removeChild(customColumnBtnDiv.firstChild);
        }
        customColumns = {}
        csvIncludeDiv = document.getElementById('csvIncludeDiv')
        while(csvIncludeDiv.firstChild){
            csvIncludeDiv.removeChild(csvIncludeDiv.firstChild);
        }
        document.getElementById('btnCsvDownload').disabled = false

        document.getElementById('startDateCSV').value = ''
        document.getElementById('endDateCSV').value = ''
        document.getElementById('dateErrorsCSV').innerHTML = ''
    }
});

csvGenClose.addEventListener('click', ()=>{
    /** Returns the user to the results modal when they close the generate-csv modal. */
    modalResults.modal({keyboard: true});
});

$('#excludeLabels').change( function() {
    /** When include/exclude selctor is changed, check the csv file format */
    checkCSV()
});