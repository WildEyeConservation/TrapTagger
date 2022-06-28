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

btnOpenExport.addEventListener('click', ()=>{
    /** Listener on the export button tat opens the associated modal. */
    modalResults.modal('hide')
    modalExport.modal({keyboard: true});
});

modalExport.on('shown.bs.modal', function(){
    /** Initialises the export modal when it is opened. */

    if (helpReturn) {
        helpReturn = false
    } else {

        divExport = document.getElementById('divExport')
        while(divExport.firstChild){
            divExport.removeChild(divExport.firstChild);
        }

        exportSelector = document.getElementById('exportSelector')
        clearSelect(exportSelector)
        fillSelect(exportSelector, ['','WildBook'], [0,1])

        $("#exportSelector").change( function() {
            divExport = document.getElementById('divExport')
            exportSelector = document.getElementById('exportSelector')
            selection = exportSelector.options[exportSelector.selectedIndex].text

            while(divExport.firstChild){
                divExport.removeChild(divExport.firstChild);
            }

            if (selection=='WildBook') {
                
                // Species selector
                h5 = document.createElement('h5')
                h5.innerHTML = 'Species'
                h5.setAttribute('style','margin-bottom: 2px')
                divExport.appendChild(h5)

                h5 = document.createElement('div')
                h5.innerHTML = '<i>Select the species you would like to export.</i>'
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                divExport.appendChild(h5)
            
                row = document.createElement('div')
                row.classList.add('row')
                divExport.appendChild(row)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)

                select = document.createElement('select')
                select.classList.add('form-control')
                select.setAttribute('id','exportSpeciesSelector')
                col.appendChild(select)

                var xhttp = new XMLHttpRequest();
                xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/individualID');
                xhttp.onreadystatechange =
                function(){
                    if (this.readyState == 4 && this.status == 200) {
                        reply = JSON.parse(this.responseText);
                        clearSelect(document.getElementById('exportSpeciesSelector'))
                        fillSelect(document.getElementById('exportSpeciesSelector'), reply.texts, reply.values)
                    }
                }
                xhttp.send();

                divExport.appendChild(document.createElement('br'))

                // Genus input
                h5 = document.createElement('h5')
                h5.innerHTML = 'Genus'
                h5.setAttribute('style','margin-bottom: 2px')
                divExport.appendChild(h5)

                h5 = document.createElement('div')
                h5.innerHTML = '<i>Enter the genus for your selected species.</i>'
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                divExport.appendChild(h5)

                row = document.createElement('div')
                row.classList.add('row')
                divExport.appendChild(row)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)

                input = document.createElement('input');
                input.setAttribute("type","text")
                input.classList.add('form-control');
                input.required = true
                input.id = 'exportGenus'
                col.appendChild(input);

                divExport.appendChild(document.createElement('br'))

                // Specific Epithet input
                h5 = document.createElement('h5')
                h5.innerHTML = 'Specific Epithet'
                h5.setAttribute('style','margin-bottom: 2px')
                divExport.appendChild(h5)

                h5 = document.createElement('div')
                h5.innerHTML = '<i>Enter the specific epithet for your selected species.</i>'
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                divExport.appendChild(h5)

                row = document.createElement('div')
                row.classList.add('row')
                divExport.appendChild(row)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)

                input = document.createElement('input');
                input.setAttribute("type","text")
                input.classList.add('form-control');
                input.required = true
                input.id = 'exportEpithet'
                col.appendChild(input);

                divExport.appendChild(document.createElement('br'))

                // WildBook ID input
                h5 = document.createElement('h5')
                h5.innerHTML = 'WildBook ID'
                h5.setAttribute('style','margin-bottom: 2px')
                divExport.appendChild(h5)

                h5 = document.createElement('div')
                h5.innerHTML = '<i>Enter your WildBook ID.</i>'
                h5.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                divExport.appendChild(h5)

                row = document.createElement('div')
                row.classList.add('row')
                divExport.appendChild(row)
            
                col = document.createElement('div')
                col.classList.add('col-lg-4')
                row.appendChild(col)

                input = document.createElement('input');
                input.setAttribute("type","text")
                input.classList.add('form-control');
                input.required = true
                input.id = 'exportWildBookID'
                col.appendChild(input);

                divExport.appendChild(document.createElement('br'))
            }
        })
        
    }
});

modalExport.on('hidden.bs.modal', function(){
    /** Clears the export modal when closed. */
    
    if (!helpReturn) {
        clearSelect(document.getElementById('exportSelector'))

        divExport = document.getElementById('divExport')
        while(divExport.firstChild){
            divExport.removeChild(divExport.firstChild);
        }

        document.getElementById('btnExportDownload').disabled = false
    }
})

function submitExportRequest() {
    /** Submites an export request to the server based on the data contained in the export form. */
    
    allow = true
    exportSelector = document.getElementById('exportSelector')
    selection = exportSelector.options[exportSelector.selectedIndex].text

    exportData = {}
    if (selection=='') {
        allow = false
    } else if (selection=='WildBook') {
        exportSpeciesSelector = document.getElementById('exportSpeciesSelector')
        exportData['species'] = exportSpeciesSelector.options[exportSpeciesSelector.selectedIndex].value
        
        exportGenus = document.getElementById('exportGenus').value
        if (exportGenus=='') {
            allow = false
        } else {
            exportData['genus'] = exportGenus
        }

        exportEpithet = document.getElementById('exportEpithet').value
        if (exportEpithet=='') {
            allow = false
        } else {
            exportData['epithet'] = exportEpithet
        }

        exportWildBookID = document.getElementById('exportWildBookID').value
        if (exportWildBookID=='') {
            allow = false
        } else {
            exportData['wildbookid'] = exportWildBookID
        }
    }

    if (allow) {
        document.getElementById('btnExportDownload').disabled = true
        var formData = new FormData()
        formData.append("task", selectedTask)
        formData.append("type", selection)
        formData.append("data", JSON.stringify(exportData))

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText); 
                modalExport.modal('hide')
                
                if (reply=='Success') {
                    document.getElementById('modalPWH').innerHTML = 'Please Wait'
                    document.getElementById('modalPWB').innerHTML = 'Your export file is being generated and the download will commence shortly. Please note that this may take a while, especially for larger data sets. Do not navigate away from this page.'
                    modalPW.modal({keyboard: true});
                    export_task_ids.push(selectedTask)
                    if (waitForDownloadTimer != null) {
                        clearInterval(waitForDownloadTimer)
                        waitForDownloadTimer = setInterval(waitForDownload, 10000)
                    } else {
                        waitForDownloadTimer = setInterval(waitForDownload, 10000)
                    }
                } else {
                    document.getElementById('modalPWH').innerHTML = 'Error'
                    document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'
                    modalPW.modal({keyboard: true});
                    document.getElementById('btnExportDownload').disabled = false
                }
            }
        }
        xhttp.open("POST", '/exportRequest');
        xhttp.send(formData);
    }
}