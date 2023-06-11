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

function checkIfImage(url){
    /** Checks if the url is an image or not */
    if (url.includes('jpg') || url.includes('JPG') || url.includes('jpeg') || url.includes('JPEG') || url.includes('png') || url.includes('PNG')) {
        return true
    }
    else {
        return false
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

function updateSlider() {
    /** Updates the image slider for the individual modal. */
    
    imageSplide = document.getElementById('imageSplide')
    while(imageSplide.firstChild){
        imageSplide.removeChild(imageSplide.firstChild);
    }

    for (let i=0;i<individualImages.length;i++) {
        img = document.createElement('img')
        img.setAttribute('src',"https://"+host_ip+"/images" + modifyToCompURL(individualImages[i].url))
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
                    updateMapIndividual(image.url)
                }
                updatePlayControlImage()
                activeImage.setUrl("https://"+host_ip+"/images" + modifyToCompURL(image.url))
            }
        });

        var track = individualSplide.Components.Elements.track
        individualSplide.on( 'click', function(wrapTrack) {
            return function(event) {
                imageIndex = event.index
                individualSplide.go(imageIndex)
            }
        }(track));

    } else {
        individualSplide.refresh()
    }
}

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

function prepMapIndividual(image) {
    /** Initialises the Leaflet image map for the individual ID modal. */

    if (bucketName != null) {
        mapReady = false
        imageUrl = "https://"+host_ip+"/images" + modifyToCompURL(image.url)
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
                addedDetections = false
                addDetections(individualImages[individualSplide.index])
            });
            map.setMaxBounds(bounds);
            map.fitBounds(bounds)
            map.setMinZoom(map.getZoom())

            hc = document.getElementById('mapDiv').clientHeight
            wc = document.getElementById('mapDiv').clientWidth
            map.on('resize', function(){
                if(document.getElementById('mapDiv').clientHeight){
                    h1 = document.getElementById('mapDiv').clientHeight
                    w1 = document.getElementById('mapDiv').clientWidth
                }
                else{
                    h1 = hc
                    w1 = wc
                }
                
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
                if(checkIfImage(activeImage._url)){
                    addedDetections = false
                    addDetections(individualImages[individualSplide.index])  
                }  
            });


            map.on('drag', function() {
                map.panInsideBounds(bounds, { animate: false });
            });
    
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
    
            map.on('zoomstart', function() {
                if (!fullRes) {
                    if(checkIfImage(activeImage._url)){
                        activeImage.setUrl("https://"+host_ip+"/images" + individualImages[individualSplide.index].url)
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
                            updateMapIndividual(individualImages[individualSplide.index].video_url)
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
                        updateMapIndividual(individualImages[individualSplide.index].video_url)
                    });
                    return button;
                }
            });
            playControlImage = (new MyPlayControlImage()).addTo(map);
        }
    }
}

function updateMapIndividual( url){
    /** Updates the map displayed for viewing individuals depending if the source is a video or image. */
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
        imageUrl = "https://"+host_ip+"/images" + modifyToCompURL(url)
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
        videoURL = "https://"+host_ip+"/images" + modifyToCompURL(url)
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
                            updateMapIndividual(individualImages[individualSplide.index].url)
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
                getIndividuals(current_page)
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
    if (individualImages.length > 1){
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

