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

var pauseControl = null
var playControl = null
var stopControl = null
var playControlImage = null


function cleanModalIndividual() {
    /** Clears the individual modal */
    
    individualDiv = document.getElementById('individualDiv')
    while(individualDiv.firstChild){
        individualDiv.removeChild(individualDiv.firstChild);
    }
    individualSplide = null
    individualImages = null
    mapReady = null
    finishedDisplaying = true
    activeImage = null
    drawnItems = null
    fullRes = false
    rectOptions = null
    mapWidth = null
    mapHeight = null
    map = null
}

modalIndividual.on('hidden.bs.modal', function(){
    /** Clears the individuals modal when closed. */
    if (modalAlertIndividualsReturn) {
        modalAlertIndividualsReturn = false
    }
    else if (helpReturn) {
        helpReturn = false
    }
    else {
        cleanModalIndividual()
        modalIndividuals.modal({keyboard: true});
    }
});

modalIndividual.on('shown.bs.modal', function(){
    /** Initialises the individuals modal when opened. */
    if (map==null) {
        prepMapIndividual(individualImages[0])
        updateSlider()
    }
});

function getIndividuals(page = null) {
    /** Gets a page of individuals. Gets the first page if none is specified. */

    individualSpeciesSelector = document.getElementById('individualSpeciesSelector')
    selectedSpecies = individualSpeciesSelector.options[individualSpeciesSelector.selectedIndex].text
    request = '/getIndividuals/'+selectedTask+'/'+selectedSpecies
    if (page != null) {
        request += '?page='+page.toString()
    }

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", request);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            individuals = reply.individuals
            individualsDiv = document.getElementById('individualsDiv')

            while(individualsDiv.firstChild){
                individualsDiv.removeChild(individualsDiv.firstChild);
            }
            
            row = document.createElement('div')
            row.classList.add('row')
            individualsDiv.appendChild(row)

            runningCount = 0
            for (let i=0;i<individuals.length;i++) {
                newIndividual = individuals[i]

                if (runningCount%4==0) {
                    runningCount = 0
                    row = document.createElement('div')
                    row.classList.add('row')
                    individualsDiv.appendChild(row)
                    individualsDiv.appendChild(document.createElement('br'))
                }

                col = document.createElement('div')
                col.classList.add('col-lg-3')
                row.appendChild(col)

                image = document.createElement('img')
                image.setAttribute('width','100%')
                image.src = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(newIndividual.url)
                col.appendChild(image)

                h5 = document.createElement('h5')
                h5.setAttribute('align','center')
                h5.innerHTML = newIndividual.name
                col.appendChild(h5)

                image.addEventListener('click', function(individualID,individualName){
                    return function() {
                        selectedIndividual = individualID

                        var formData = new FormData()
                        formData.append("order", JSON.stringify('d3'))
                        formData.append("site", JSON.stringify('0'))
                        formData.append('start_date', JSON.stringify(''))
                        formData.append('end_date', JSON.stringify(''))

                        var xhttp = new XMLHttpRequest();
                        xhttp.onreadystatechange =
                        function(){
                            if (this.readyState == 4 && this.status == 200) {
                                reply = JSON.parse(this.responseText);
                                individualImages = reply.individual
                                indivdualAccess = reply.access

                                if (individualImages.length > 0) {
                                    individualDiv = document.getElementById('individualDiv')
                                    document.getElementById('individualName').innerHTML = individualName

                                    while(individualDiv.firstChild){
                                        individualDiv.removeChild(individualDiv.firstChild);
                                    }

                                    //build image viewer
                                    info = document.createElement('h5')
                                    info.setAttribute('id','tgInfo')
                                    info.setAttribute('align','center')
                                    info.innerHTML = 'Site: ' + individualImages[0].trapgroup.tag
                                    individualDiv.appendChild(info)

                                    info2 = document.createElement('h6')
                                    info2.setAttribute('id','timeInfo')
                                    info2.setAttribute('align','center')
                                    info2.innerHTML = individualImages[0].timestamp
                                    individualDiv.appendChild(info2)

                                    row = document.createElement('div')
                                    row.classList.add('row')
                                    individualDiv.appendChild(row)

                                    col1 = document.createElement('div')
                                    col1.classList.add('col-lg-3')
                                    row.appendChild(col1)

                                    col2 = document.createElement('div')
                                    col2.classList.add('col-lg-6')
                                    row.appendChild(col2)

                                    col3 = document.createElement('div')
                                    col3.classList.add('col-lg-2')
                                    row.appendChild(col3)

                                    col4 = document.createElement('div')
                                    col4.classList.add('col-lg-1')
                                    row.appendChild(col4)

                                    btn = document.createElement('button');
                                    btn.classList.add('btn');
                                    btn.classList.add('btn-danger');
                                    btn.classList.add('btn-block');
                                    btn.setAttribute('style','margin-top: 2px; margin-bottom: 2px;')
                                    btn.innerHTML = 'Delete Individual';
                                    col3.appendChild(btn)

                                    btn.addEventListener('click', ()=>{
                                        if (individualImages.length > 1) {
                                            document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                                            document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently delete this individual?'
                                            document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','deleteIndividual()')
                                            modalAlertIndividualsReturn = true
                                            modalIndividual.modal('hide')
                                            modalAlertIndividuals.modal({keyboard: true});
                                        }
                                    });

                                    if (indivdualAccess == 'write'){
                                        btn.disabled = false
                                    }
                                    else{
                                        btn.disabled = true
                                    }

                                    btn2 = document.createElement('button');
                                    btn2.classList.add('btn');
                                    btn2.classList.add('btn-primary');
                                    btn2.classList.add('btn-block');
                                    btn2.setAttribute('style','margin-top: 2px; margin-bottom: 2px;')
                                    btn2.innerHTML = 'Remove Image';
                                    col3.appendChild(btn2)

                                    btn2.addEventListener('click', ()=>{
                                        if(individualImages.length > 1){
                                            document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                                            document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently remove this image from this individual?'
                                            document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','removeImage()')
                                            modalAlertIndividualsReturn = true
                                            modalIndividual.modal('hide')
                                            modalAlertIndividuals.modal({keyboard: true});
                                        }
                                    });

                                    if (indivdualAccess == 'write'){
                                        btn2.disabled = false
                                    }
                                    else{
                                        btn2.disabled = true
                                    }

                                    center = document.createElement('center')
                                    col2.appendChild(center)

                                    mapDiv = document.createElement('div')
                                    mapDiv.setAttribute('id','mapDiv')
                                    mapDiv.setAttribute('style','height: 800px')
                                    center.appendChild(mapDiv)

                                    row = document.createElement('div')
                                    row.classList.add('row')
                                    individualDiv.appendChild(row)

                                    col1 = document.createElement('div')
                                    col1.classList.add('col-lg-1')
                                    row.appendChild(col1)

                                    col2 = document.createElement('div')
                                    col2.classList.add('col-lg-10')
                                    row.appendChild(col2)

                                    col3 = document.createElement('div')
                                    col3.classList.add('col-lg-1')
                                    row.appendChild(col3)

                                    card = document.createElement('div')
                                    card.classList.add('card')
                                    card.setAttribute('style','background-color: rgb(60, 74, 89);margin-top: 5px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 5px')
                                    col2.appendChild(card)

                                    body = document.createElement('div')
                                    body.classList.add('card-body')
                                    body.setAttribute('style','margin-top: 0px; margin-bottom: 0px; margin-left: 0px; margin-right: 0px; padding-top: 0px; padding-bottom: 0px; padding-left: 0px; padding-right: 0px')
                                    card.appendChild(body)

                                    splide = document.createElement('div')
                                    splide.classList.add('splide')
                                    splide.setAttribute('id','splide')
                                    body.appendChild(splide)

                                    track = document.createElement('div')
                                    track.classList.add('splide__track')
                                    splide.appendChild(track)
                        
                                    list = document.createElement('ul')
                                    list.classList.add('splide__list')
                                    list.setAttribute('id','imageSplide')
                                    track.appendChild(list)

                                    modalIndividuals.modal('hide')
                                    modalIndividual.modal({keyboard: true});
                                }
                            }
                        }
                        xhttp.open("POST", '/getIndividual/'+individualID);
                        xhttp.send(formData);
                    }
                }(newIndividual.id,newIndividual.name));

                runningCount += 1
            }

            if (reply.next==null) {
                document.getElementById('btnNextIndividuals').style.visibility = 'hidden'
                individual_next = null
            } else {
                document.getElementById('btnNextIndividuals').style.visibility = 'visible'
                individual_next = reply.next
            }

            if (reply.prev==null) {
                document.getElementById('btnPrevIndividuals').style.visibility = 'hidden'
                individual_prev = null
            } else {
                document.getElementById('btnPrevIndividuals').style.visibility = 'visible'
                individual_prev = reply.prev
            }
        }
    }
    xhttp.send();
}

$("#individualSpeciesSelector").change( function() {
    /** Listener for the species selector on the the individuals modal. */
    getIndividuals()
})

function openIndividualsModal() {
    /** Clears and opens the individuals modal. */

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/getTaggingLevelsbyTask/'+selectedTask+'/individualID');
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            texts = ['All']
            texts.push(...reply.texts)
            values = [0]
            values.push(...reply.values)
            clearSelect(document.getElementById('individualSpeciesSelector'))
            fillSelect(document.getElementById('individualSpeciesSelector'), texts, values)
            getIndividuals()
        }
    }
    xhttp.send();

    individualsDiv = document.getElementById('individualsDiv')
    while(individualsDiv.firstChild){
        individualsDiv.removeChild(individualsDiv.firstChild);
    }

    modalResults.modal('hide')
    modalIndividuals.modal({keyboard: true});
}