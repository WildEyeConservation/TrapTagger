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

function modifyToCompURL(url) {
    /** Modifies the source URL to the compressed folder of the user */
    var isImage = checkIfImage(url)
    if (isImage) {
        splits=url.split('/')
        splits[0]=splits[0]+'-comp'
        return splits.join('/')
    }
    else {
        splits=url.split('/')
        splits[0]=splits[0]+'-comp'
        splits[splits.length-1]=splits[splits.length-1].split('.')[0]+'.mp4'
        return splits.join('/')
    }
}

function updateSlider() {
    /** Updates the image slider for the individual modal. */
    
    imageSplide = document.getElementById('imageSplide')
    while(imageSplide.firstChild){
        imageSplide.removeChild(imageSplide.firstChild);
    }

    for (let i=0;i<individualImages.length;i++) {
        img = document.createElement('img')
        img.setAttribute('src',"https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualImages[i].url))
        imgli = document.createElement('li')
        imgli.classList.add('splide__slide')
        imgli.appendChild(img)
        imageSplide.appendChild(imgli)
    }

    if (individualSplide==null) {
        // Initialise Splide
        individualSplide = new Splide( document.getElementById('splide'), {
            rewind      : false,
            fixedWidth  : 200,
            fixedHeight : 128,
            isNavigation: true,
            keyboard    : true,
            gap         : 5,
            pagination  : false,
            cover       : true,
            breakpoints : {
                '600': {
                    fixedWidth  : 66,
                    fixedHeight : 40
                }
            }
        } ).mount();

        individualSplide.on( 'moved', function() {
            if (bucketName!=null) {
                finishedDisplaying = false
                image = individualImages[individualSplide.index]
                document.getElementById('tgInfo').innerHTML = "Site: " + image.trapgroup.tag
                document.getElementById('timeInfo').innerHTML = image.timestamp
                addedDetections = false
                var isImage = checkIfImage(image.url)
                var isActiveImage = checkIfImage(activeImage._url)
                if (isImage != isActiveImage) {
                    updateMap(image.url)
                }
                updatePlayControlImage()
                activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
            }
        });

        var track = individualSplide.Components.Elements.track
        individualSplide.on( 'click', function(wrapTrack) {
            return function() {
                imageIndex = parseInt(event.toElement.id.split("slide")[1])-1
                individualSplide.go(imageIndex)
            }
        }(track));

    } else {
        individualSplide.refresh()
    }
}

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
    } else {
        cleanModalIndividual()
        modalIndividuals.modal({keyboard: true});
    }
});

modalIndividual.on('shown.bs.modal', function(){
    /** Initialises the individuals modal when opened. */
    if (map==null) {
        prepMap(individualImages[0])
        updateSlider()
    }
});

function addDetections(image) {
    //** Adds detections to the main image displayed in the individual modal. */
    if (!addedDetections) {
        map.setZoom(map.getMinZoom())
        fullRes = false
        drawnItems.clearLayers()
        for (let i=0;i<image.detections.length;i++) {
            detection = image.detections[i]
            if (detection.static == false) {
                rectOptions.color = "rgba(223,105,26,1)"
                rect = L.rectangle([[detection.top*mapHeight,detection.left*mapWidth],[detection.bottom*mapHeight,detection.right*mapWidth]], rectOptions)
                drawnItems.addLayer(rect)
            }
        }
        finishedDisplaying = true
        addedDetections = true
    }
}

function prepMap(image) {
    /** Initialises the Leaflet image map for the individual ID modal. */
    
    if (bucketName != null) {
        mapReady = false
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url)
        videoUrl = image.video_url
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height


            if (w>h) {
                document.getElementById('mapDiv').setAttribute('style','height: calc(38vw *'+(h/w)+');  width:38vw')               
            } else {
                document.getElementById('mapDiv').setAttribute('style','height: calc(38vw *'+(w/h)+');  width:38vw')
            }

            L.Browser.touch = true
    
            map = new L.map('mapDiv', {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0
            })

            var h1 = document.getElementById('mapDiv').clientHeight
            var w1 = document.getElementById('mapDiv').clientWidth
    
            var southWest = map.unproject([0, h1], 2);
            var northEast = map.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mapWidth = northEast.lng
            mapHeight = southWest.lat
    
            activeImage = L.imageOverlay(imageUrl, bounds).addTo(map);
            activeImage.on('load', function() {
                addDetections(individualImages[individualSplide.index])
            });
            map.setMaxBounds(bounds);
            map.fitBounds(bounds)
            map.setMinZoom(map.getZoom())

            map.on('resize', function(){
                h1 = document.getElementById('mapDiv').clientHeight
                w1 = document.getElementById('mapDiv').clientWidth
                southWest = map.unproject([0, h1], 2);
                northEast = map.unproject([w1, 0], 2);
                bounds = new L.LatLngBounds(southWest, northEast);
        
                mapWidth = northEast.lng
                mapHeight = southWest.lat

                map.invalidateSize()
                map.setMaxBounds(bounds)
                map.fitBounds(bounds)
                map.setMinZoom(map.getZoom())
                activeImage.setBounds(bounds)
                addedDetections = false
                addDetections(individualImages[individualSplide.index])    
            });


            map.on('drag', function() {
                map.panInsideBounds(bounds, { animate: false });
            });
    
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
    
            map.on('zoomstart', function() {
                if (!fullRes) {
                    if(checkIfImage(activeImage._url)){
                        activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + individualImages[individualSplide.index].url)
                        fullRes = true
                    }
                }
            });   
    
            rectOptions = {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }    
            
            if (videoUrl != null) {

                var MyPlayControlImage = L.Control.extend({
                    onAdd: function() {
                        var button = L.DomUtil.create('button');
                        button.innerHTML = '⏵';
                        L.DomEvent.on(button, 'click', function () {
                            updateMap(individualImages[individualSplide.index].video_url)
                        });
                        return button;
                    }
                });
                
                playControlImage = (new MyPlayControlImage()).addTo(map);

            }

            mapReady = true
        };
        img.src = imageUrl
    }

}

function checkIfImage(url){
    /** Checks if the url is an image or not */
    if (url.includes('jpg') || url.includes('JPG') || url.includes('jpeg') || url.includes('JPEG') || url.includes('png') || url.includes('PNG')) {
        return true
    }
    else {
        return false
    }
}

function updatePlayControlImage(){
    /** Removes or add a play control to image depending on if it has a video associated with it */
    if (individualImages[individualSplide.index].video_url == null){
        if (playControlImage != null){
            playControlImage.remove()
            playControlImage = null
        }
    }
    else{
        if (playControlImage == null){
            var MyPlayControlImage = L.Control.extend({
                onAdd: function() {
                    var button = L.DomUtil.create('button');
                    button.innerHTML = '⏵';
                    L.DomEvent.on(button, 'click', function () {
                        updateMap(individualImages[individualSplide.index].video_url)
                    });
                    return button;
                }
            });
            playControlImage = (new MyPlayControlImage()).addTo(map);
        }
    }

}

function updateMap( url){
    /** Updates the map displayed depending if the source is a video or image. */
    console.log('updateMap')
    mapReady = false
    var isImage = checkIfImage(url)
    map.removeLayer(activeImage)
    if (drawnItems != null) {
        map.removeLayer(drawnItems)
    }
    if (pauseControl != null && playControl != null && stopControl != null) {
        pauseControl.remove()
        playControl.remove()
        stopControl.remove()
    }
    if (playControlImage != null){
        playControlImage.remove()
        playControlImage = null
    }

    if (isImage){
        imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height              

            document.getElementById('mapDiv').style.height = 'calc(38vw *'+(h/w)+')'
            document.getElementById('mapDiv').style.width = '38vw'  

            var h1 = document.getElementById('mapDiv').clientHeight
            var w1 = document.getElementById('mapDiv').clientWidth

            var southWest = map.unproject([0, h1], 2);
            var northEast = map.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);
    
            mapWidth = northEast.lng
            mapHeight = southWest.lat
    
            activeImage = L.imageOverlay(imageUrl, bounds).addTo(map);
            activeImage.on('load', function() {
                addedDetections = false
                addDetections(individualImages[individualSplide.index])
            });

            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
            
            rectOptions = {
                color: "rgba(223,105,26,1)",
                fill: true,
                fillOpacity: 0.0,
                opacity: 0.8,
                weight:3,
                contextmenu: false,
            }    

            updatePlayControlImage()
            
            mapReady = true     
            
        };
        img.src = imageUrl

    } else {
        videoURL = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(url)
        vid = document.createElement('video')
        vid.setAttribute('controls',true)
        vid.setAttribute('width', 500);

        sourceMP4 = document.createElement('source')
        sourceMP4.setAttribute('src',videoURL)
        sourceMP4.setAttribute('type','video/mp4')  

        vid.appendChild(sourceMP4) 

        vid.addEventListener('loadedmetadata', function() {
            var w = vid.videoWidth
            var h = vid.videoHeight

            document.getElementById('mapDiv').style.height = 'calc(38vw *'+(h/w)+')'
            document.getElementById('mapDiv').style.width = '38vw'  

            var h1 = document.getElementById('mapDiv').clientHeight
            var w1 = document.getElementById('mapDiv').clientWidth
            var southWest = map.unproject([0, h1], 2);
            var northEast = map.unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);

            mapWidth = northEast.lng
            mapHeight = southWest.lat

            activeImage = L.videoOverlay(videoURL, bounds, {
                opacity: 1,
                autoplay: false,
                loop: false
            }).addTo(map);
            

            activeImage.on('load', function () {
                while(map._controlCorners['topright'].firstChild){
                    map._controlCorners['topright'].removeChild(map._controlCorners['topright'].firstChild);
                }

                var MyPauseControl = L.Control.extend({
                    onAdd: function() {
                        var button = L.DomUtil.create('button');
                        button.innerHTML = '⏸';
                        L.DomEvent.on(button, 'click', function () {
                            activeImage.getElement().pause();
                        });
                        return button;
                    }
                });
                var MyPlayControl = L.Control.extend({
                    onAdd: function() {
                        var button = L.DomUtil.create('button');
                        button.innerHTML = '⏵';
                        L.DomEvent.on(button, 'click', function () {
                            activeImage.getElement().play();
                        });
                        return button;
                    }
                });

                var MyStopControl = L.Control.extend({
                    onAdd: function() {
                        var button = L.DomUtil.create('button');
                        button.innerHTML = '⏹';
                        L.DomEvent.on(button, 'click', function () {
                            updateMap(individualImages[individualSplide.index].url)
                        });
                        return button;
                    }
                });
                
                
                playControl = (new MyPlayControl()).addTo(map);
                pauseControl = (new MyPauseControl()).addTo(map);
                stopControl = (new MyStopControl()).addTo(map);

                finishedDisplaying = true
            });          

            mapReady = true
            activeImage.setUrl(videoURL)

        });                   
    }
}

function deleteIndividual() {
    /** Deletes the selected individual. */
    modalAlertIndividuals.modal('hide')
    cleanModalIndividual()
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (reply=='success') {
                modalIndividuals.modal({keyboard: true});
                getIndividuals()
            }
        }
    }
    xhttp.open("GET", '/deleteIndividual/'+selectedIndividual.toString());
    xhttp.send();
}

function removeImage() {
    /** Removes the currently displayed individual from the selected individual. */
    modalAlertIndividuals.modal('hide')
    modalIndividual.modal({keyboard: true});
    if(individualImages.length >1){
        image = individualImages[individualSplide.index]
        detection = image.detections[0]
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if (reply.status=='success') {
                    index = individualImages.indexOf(image);
                    if (index > -1) {
                        individualImages.splice(index, 1);
                    }
                    updateSlider()
                    individualSplide.go(0)
                }
            }
        }
        xhttp.open("GET", '/dissociateDetection/'+detection.id.toString()+'?individual_id='+selectedIndividual.toString());
        xhttp.send();
    }
}
function next_individuals() {
    /** Gets the next page of individuals in the individuals modal. */
    getIndividuals(individual_next)
}

function prev_individuals() {
    /** Gets the previous page of individuals from the individuals modal. */
    getIndividuals(individual_prev)
}

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
                                individualImages = JSON.parse(this.responseText);
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
                                    document.getElementById('modalAlertIndividualsHeader').innerHTML = 'Confirmation'
                                    document.getElementById('modalAlertIndividualsBody').innerHTML = 'Do you want to permanently delete this individual?'
                                    document.getElementById('btnContinueIndividualAlert').setAttribute('onclick','deleteIndividual()')
                                    modalAlertIndividualsReturn = true
                                    modalIndividual.modal('hide')
                                    modalAlertIndividuals.modal({keyboard: true});
                                });

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