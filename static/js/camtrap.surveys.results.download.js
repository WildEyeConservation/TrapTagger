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

function buildDownloadSpeciesRow() {
    /** Builds a species-selector row for the download modal. */
    
    downloadSpeciesDiv = document.getElementById('downloadSpeciesDiv')
    IDNum = getIdNumforNext('downloadSpecies-')

    row = document.createElement('div')
    row.classList.add('row')
    downloadSpeciesDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-4')
    row.appendChild(col1)

    input = document.createElement('select')
    input.classList.add('form-control')
    input.setAttribute('id','downloadSpecies-'+IDNum)
    col1.appendChild(input)
    
    fillSelect(input, speciesChoiceTexts, speciesChoiceValues)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-5')
    row.appendChild(col2)

    col3 = document.createElement('div')
    col3.classList.add('col-lg-3')
    row.appendChild(col3)

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';
    col3.appendChild(btnRemove)

    btnRemove.addEventListener('click', (evt)=>{
        evt.target.parentNode.parentNode.remove()
    });
}

// modalDownload.on('shown.bs.modal', function(){
//     /** Initialises the download modal when it is opened. */
//     if (helpReturn) {
//         helpReturn = false
//     } else if (confirmDownloadReturn) {
//         confirmDownloadReturn = false
//     } else {
//         resetDownloadForm()

//         confirmDownloadReturn = false

//         var xhttp = new XMLHttpRequest();
//         xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
//         xhttp.onreadystatechange =
//         function(){
//             if (this.readyState == 4 && this.status == 200) {
//                 reply = JSON.parse(this.responseText);
//                 speciesChoiceTexts = reply.names
//                 speciesChoiceValues = reply.ids
//                 buildDownloadSpeciesRow()
//             }
//         }
//         xhttp.send();
//     }
// });

modalDownload.on('hidden.bs.modal', function(){
    /** Clears the download modal when it is closed. */
    if (!helpReturn && !confirmDownloadReturn) {
        resetDownloadForm()
    }
    else if (helpReturn) {
        helpReturn = false
    }
    else {
        confirmDownloadReturn = false
    }
})

function openDownloadModal() {
    /** Closes the results modal and opens the download modal. */
    modalResults.modal('hide')
    resetDownloadForm()
    modalDownload.modal({keyboard: true});

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getSpeciesandIDs/'+selectedTask);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            speciesChoiceTexts = reply.names
            speciesChoiceValues = reply.ids
            buildDownloadSpeciesRow()
        }
    }
    xhttp.send();
}

// function submitDownloadRequest() {
//     /** Submits a download export request to the server. */

//     document.getElementById('btnDownloadStart').disabled = true
    
//     if (document.getElementById('speciesSorted').checked) {
//         species_sorted = 'True'
//     } else {
//         species_sorted = 'False'
//     }

//     if (document.getElementById('individualSorted').checked) {
//         individual_sorted = 'True'
//     } else {
//         individual_sorted = 'False'
//     }

//     if (document.getElementById('flatStructure').checked) {
//         flat_structure = 'True'
//     } else {
//         flat_structure = 'False'
//     }

//     species = []
//     downloadSpecies = document.querySelectorAll('[id^=downloadSpecies-]');
//     for (let i=0;i<downloadSpecies.length;i++) {
//         species.push(downloadSpecies[i].options[downloadSpecies[i].selectedIndex].value)
//     }

//     var formData = new FormData()
//     formData.append("task", selectedTask)
//     formData.append("species", JSON.stringify(species))
//     formData.append("species_sorted", JSON.stringify(species_sorted))
//     formData.append("individual_sorted", JSON.stringify(individual_sorted))
//     formData.append("flat_structure", JSON.stringify(flat_structure))

//     var xhttp = new XMLHttpRequest();
//     xhttp.open("POST", '/RequestExif');
//     xhttp.onreadystatechange =
//     function(){
//         if (this.readyState == 4 && this.status == 200) {
//             reply = JSON.parse(this.responseText);  
//             if (reply=='Success') {
//                 updatePage(current_page)
//                 document.getElementById('modalPWH').innerHTML = 'Success'
//                 document.getElementById('modalPWB').innerHTML = 'Your dataset is being prepared. Depending on the size of your survey, this may take a while. Once it is ready, the status of your survey will change along with the colour of its results button, indicating an available download. If you then click that button, you will find an option to download your prepared dataset.'
//             } else {
//                 document.getElementById('modalPWH').innerHTML = 'Error'
//                 document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'
//                 document.getElementById('btnDownloadStart').disabled = false
//             }
//             modalDownload.modal('hide')
//             modalPW.modal({keyboard: true});
//         }
//     }
//     xhttp.send(formData);
// }

function resetDownloadForm() {
    /** Resets the download form. */
    document.getElementById('localFiles').checked = true
    document.getElementById('originalStructure').checked = true
    document.getElementById('flatStructure').checked = false
    document.getElementById('originalSorted').checked = true
    document.getElementById('speciesSorted').checked = false
    document.getElementById('individualUnSorted').checked = true
    document.getElementById('individualSorted').checked = false
    document.getElementById('emptyExclude').checked = true
    document.getElementById('emptyInclude').checked = false
    document.getElementById('deleteTrue').checked = true
    document.getElementById('deleteFalse').checked = false
    document.getElementById('videoFramesTrue').checked = true
    document.getElementById('videoTrue').checked = false
    document.getElementById('videoAndFramesTrue').checked = false

    downloadSpeciesDiv = document.getElementById('downloadSpeciesDiv')
    while(downloadSpeciesDiv.firstChild){
        downloadSpeciesDiv.removeChild(downloadSpeciesDiv.firstChild);
    }

    document.getElementById('btnDownloadStart').disabled = false

    confirmDownloadReturn = false
}

function checkDownload(){
    /** Checks the download options and opens the confirm download modal. */
    if (document.getElementById('rawFiles').checked || document.getElementById('emptyInclude').checked || document.getElementById('videoTrue').checked || document.getElementById('videoAndFramesTrue').checked) {
        confirmDownloadReturn = true
        modalDownload.modal('hide')
        modalConfirmDownload.modal({keyboard: true});
    }
    else{
        confirmDownloadReturn = false
        initiateDownload()
    }
}

$('#btnCancelDownload').click(function(){
    /** Cancels the download request that requires images to be restored from archive. */
    modalConfirmDownload.modal('hide')
    modalDownload.modal({keyboard: true});
});
