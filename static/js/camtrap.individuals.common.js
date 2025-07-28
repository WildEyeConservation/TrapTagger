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

// const detection_flanks = ['Left','Right','Ambiguous']
// var targetRect = null
// var targetUpdated = false
// var dbDetIds = {}
// var toolTipsOpen = true

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
        splits[splits.length-1]=splits[splits.length-1].substring(0, splits[splits.length-1].lastIndexOf('.'))+'.mp4'
        return splits.join('/')
    }
}

function modifyToCropURL(url,detection_id) {
    /** Modifies the source URL to the cropped image of detection */
    splits=url.split('/')
    crop_url = splits[0] + '-comp/' + splits[1] + '/_crops_/' + detection_id.toString() + '.JPG'
    return crop_url
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
        // img.setAttribute('src',"https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualImages[i].url))
        img.setAttribute('data-splide-lazy',"https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualImages[i].url))
        imgli = document.createElement('li')
        imgli.classList.add('splide__slide')
        imgli.appendChild(img)
        imageSplide.appendChild(imgli)
    }

    client_width = document.getElementById('splide').clientWidth
    numberPages =Math.ceil(client_width/200) + 1

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
            lazyLoad    : 'nearby',
            preloadPages: numberPages,
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
                activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
            }
        });

        var track = individualSplide.Components.Elements.track
        individualSplide.on( 'click', function(wrapTrack) {
            return function(event) {
                imageIndex = event.index
                individualSplide.go(imageIndex)
            }
        }(track));

        individualSplide.on('lazyload', (img) => {
            console.log('Lazy-loaded image:', img.dataset.splideLazy);
        });

    } else {
        individualSplide.refresh()
    }
}

function addDetectionsIndividual(image) {
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
                
                // if (document.getElementById('btnSubmitInfoChange') != null) {
                //     if (Object.keys(changed_flanks).includes(detection.id.toString())) {
                //         flank = changed_flanks[detection.id]
                //     } else {
                //         flank = detection.flank
                //     }

                //     rect.bindTooltip(flank,{permanent: true, direction:"center"})

                //     var center = L.latLng([(rect._bounds._northEast.lat+rect._bounds._southWest.lat)/2,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                //     var bottom = L.latLng([rect._bounds._southWest.lat,(rect._bounds._northEast.lng+rect._bounds._southWest.lng)/2])
                //     var centerPoint = map.latLngToContainerPoint(center)
                //     var bottomPoint = map.latLngToContainerPoint(bottom)
                //     var offset = [0,centerPoint.y-bottomPoint.y]
            
                //     rect._tooltip.options.offset = offset
                //     rect._tooltip.options.opacity = 0.8
                //     rect.openTooltip()

                //     dbDetIds[rect._leaflet_id.toString()] = detection.id.toString()
                // }
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
                // addedDetections = false
                addDetectionsIndividual(individualImages[individualSplide.index])
            });
            activeImage.on('error', function() {
                if (this._url.includes('-comp')) {
                    finishedDisplaying = true
                }
                else{
                    this.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(individualImages[individualSplide.index].url))
                }
            });
            map.setMaxBounds(bounds);
            map.fitBounds(bounds)
            map.setMinZoom(map.getZoom())

            hc = document.getElementById('mapDiv').clientHeight
            wc = document.getElementById('mapDiv').clientWidth
            map.on('resize', function(){
                if(!map){
                    return
                }
                if(document.getElementById('mapDiv') && document.getElementById('mapDiv').clientHeight){
                    var h1 = document.getElementById('mapDiv').clientHeight
                    var w1 = document.getElementById('mapDiv').clientWidth
                }
                else{
                    var h1 = hc
                    var w1 = wc
                }
                
                var southWest = map.unproject([0, h1], 2);
                var northEast = map.unproject([w1, 0], 2);
                var bounds = new L.LatLngBounds(southWest, northEast);
        
                mapWidth = northEast.lng
                mapHeight = southWest.lat

                map.invalidateSize()
                map.setMaxBounds(bounds)
                map.fitBounds(bounds)
                map.setMinZoom(map.getZoom())
                activeImage.setBounds(bounds)
                if(checkIfImage(activeImage._url)){
                    addedDetections = false
                    addDetectionsIndividual(individualImages[individualSplide.index])  
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
                        activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + individualImages[individualSplide.index].url)
                        fullRes = true
                    }
                }
            });    

            // if (document.getElementById('btnSubmitInfoChange') != null) {
            //     updateIndividualRectOptions()
            //     flankMapPrep()
            // }
            // else{
            //     rectOptions = {
            //         color: "rgba(223,105,26,1)",
            //         fill: true,
            //         fillOpacity: 0.0,
            //         opacity: 0.8,
            //         weight:3,
            //         contextmenu: false,
            //     }      
            // }

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
                // addedDetections = false
                addDetectionsIndividual(individualImages[individualSplide.index])
            });

            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
            
            // if (document.getElementById('btnSubmitInfoChange') != null) {
            //     updateIndividualRectOptions()
            //     flankMapPrep()
            // }
            // else{
            //     rectOptions = {
            //         color: "rgba(223,105,26,1)",
            //         fill: true,
            //         fillOpacity: 0.0,
            //         opacity: 0.8,
            //         weight:3,
            //         contextmenu: false,
            //     }      
            // }

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
    document.getElementById('btnContinueIndividualAlert').disabled = true
    modalAlertIndividualsReturn = false
    modalAlertIndividuals.modal('hide')
    cleanModalIndividual()
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);
            if (document.getElementById('btnContinueIndividualAlert')) {
                document.getElementById('btnContinueIndividualAlert').disabled = false
            }
            getIndividuals(current_page)
        }
    }
    xhttp.open("GET", '/deleteIndividual/'+selectedIndividual.toString());
    xhttp.send();

    if (document.getElementById('modalIndividuals')) {
        modalIndividuals.modal({keyboard: true});
    }
    
}

function removeImage() {
    /** Removes the currently displayed individual from the selected individual. */
    document.getElementById('btnContinueIndividualAlert').disabled = true
    modalAlertIndividuals.modal('hide')
    
    if (individualImages.length > 1){
        image = individualImages[individualSplide.index]
        detection = image.detections[0]

        individualImages.splice(individualSplide.index, 1)
        updateSlider()
        if (individualSplide.index > 0){
            individualSplide.go(0)
        }
        else{
            finishedDisplaying = false
            image = individualImages[0]
            document.getElementById('tgInfo').innerHTML = "Site: " + image.trapgroup.tag
            document.getElementById('timeInfo').innerHTML = image.timestamp
            addedDetections = false
            var isImage = checkIfImage(image.url)
            var isActiveImage = checkIfImage(activeImage._url)
            if (isImage != isActiveImage) {
                updateMapIndividual(image.url)
            }
            updatePlayControlImage()
            activeImage.setUrl("https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image.url))
        }
    
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);
                if (document.getElementById('btnContinueIndividualAlert')) {
                    document.getElementById('btnContinueIndividualAlert').disabled = false
                }
            }
        }
        xhttp.open("GET", '/dissociateDetection/'+detection.id.toString()+'?individual_id='+selectedIndividual.toString());
        xhttp.send();

        modalIndividual.modal({keyboard: true});
    }
    
}

// NOTE: We are currenlty not allowing the users to edit a detection flank on the Individuals page and it can only be edited 
// in a Cluster ID (-4 task). The reason we have disallowed this is because of having to recalculate all detection similarities 
// and individual similaties associated with the detection whose flank has changed. 

// function flankMapPrep() {
//     /** Finishes prepping the map for intra-cluster individual ID by adding the dissociate option to the context menu. */

//     map.on('contextmenu.select', function(e) {
//         if (targetUpdated) {  
//             detection_id = dbDetIds[targetRect.toString()]
//             original_flank = individualImages[individualSplide.index].detections[0].flank
//             if (original_flank != e.el.textContent) {
//                 changed_flanks[detection_id] = e.el.textContent
//             }
//             else{
//                 delete changed_flanks[detection_id]
//             }
            
//             drawnItems._layers[targetRect].closeTooltip()
//             drawnItems._layers[targetRect]._tooltip._content=e.el.textContent
//             if (toolTipsOpen) {
//                 drawnItems._layers[targetRect].openTooltip()
//             }

//             targetUpdated = false
//         } else {
//             alert('Error! Select is being handled before target updated.')
//         }
//     });

//     map.on('contextmenu', function (e) {
//         /** remove duplicate items on more than one right click of contextmenu*/
//         nr_items = 2*detection_flanks.length - 1

//         if(map.contextmenu._items.length > nr_items){
//             for (let i=map.contextmenu._items.length-1;i>nr_items-1;i--) 
//             {
//                 map.contextmenu.removeItem(i)
//             }
//         } 
//     });

//     map.on('zoom', function(e){
//         /** update position of bounding box labels on zoom */
//         if (toolTipsOpen) {
//             for (let layer in drawnItems._layers) {
//                 var drawn_layer = drawnItems._layers[layer]
//                 var center = L.latLng([(drawn_layer._bounds._northEast.lat+drawn_layer._bounds._southWest.lat)/2,(drawn_layer._bounds._northEast.lng+drawn_layer._bounds._southWest.lng)/2])
//                 var bottom = L.latLng([drawn_layer._bounds._southWest.lat,(drawn_layer._bounds._northEast.lng+drawn_layer._bounds._southWest.lng)/2])
//                 var centerPoint = map.latLngToContainerPoint(center)
//                 var bottomPoint = map.latLngToContainerPoint(bottom)
//                 var offset = [0,centerPoint.y-bottomPoint.y]
//                 drawn_layer._tooltip.options.offset = offset
//             }
//         }
//     });
// }

// function updateIndividualRectOptions() {
//     /** Sets the bounding box options. */

//     var menuItems = []
//     var index = 0
    
//     for (let i=0;i<detection_flanks.length;i++) {
//         menuItems.push({
//             text: detection_flanks[i],
//             index: index,
//             callback: updateTargetRect
//         })
//         index += 1

//         menuItems.push({
//             separator: true,
//             index: index
//         })
//         index += 1
//     }

//     rectOptions = {
//         color: "rgba(223,105,26,1)",
//         fill: true,
//         fillOpacity: 0.0,
//         opacity: 0.8,
//         weight:3,
//         contextmenu: true,
//         contextmenuWidth: 140,
//         contextmenuItems: menuItems
//     }
// }

// function updateTargetRect (e) {
//     /** Updates the targetRect global to the Leaflet ID of the recangle clicked on by the user. */
//     if (e.relatedTarget) {
//         targetRect = e.relatedTarget._leaflet_id
//     }
//     contextLocation = e.latlng
//     targetUpdated = true
// }

function prepImageMap(div_id, image_url, detection, vw=10) {
    /** Prepares the image map for the individual modal. */
    if (bucketName != null) {
        var imageUrl = "https://"+bucketName+".s3.amazonaws.com/" + modifyToCompURL(image_url)
        var img = new Image();
        img.onload = function(){
            w = this.width
            h = this.height
            if (w>h) {
                // document.getElementById(div_id).setAttribute('style','height: calc(10vw *'+(h/w)+');  width:10vw')
                document.getElementById(div_id).setAttribute('style','height: calc('+vw+'vw *'+(h/w)+');  width:'+vw+'vw')
            } else {
                // document.getElementById(div_id).setAttribute('style','height: calc(10vw *'+(w/h)+');  width:10vw')
                document.getElementById(div_id).setAttribute('style','height: calc('+vw+'vw *'+(w/h)+');  width:'+vw+'vw')
            }
            L.Browser.touch = true
        
            mergeMap[div_id] = new L.map(div_id, {
                crs: L.CRS.Simple,
                maxZoom: 10,
                center: [0, 0],
                zoomSnap: 0,
                attributionControl: false,
            })

            // disable zoom controls and drag etc
            mergeMap[div_id].zoomControl.remove()
            mergeMap[div_id].dragging.disable()
            mergeMap[div_id].touchZoom.disable()
            mergeMap[div_id].doubleClickZoom.disable()
            mergeMap[div_id].scrollWheelZoom.disable()
            mergeMap[div_id].boxZoom.disable()
            mergeMap[div_id].keyboard.disable()   
            mergeMap[div_id].boxZoom.disable()


            var h1 = document.getElementById(div_id).clientHeight
            var w1 = document.getElementById(div_id).clientWidth
            var southWest = mergeMap[div_id].unproject([0, h1], 2);
            var northEast = mergeMap[div_id].unproject([w1, 0], 2);
            var bounds = new L.LatLngBounds(southWest, northEast);

            mergeActiveImage[div_id] = L.imageOverlay(imageUrl, bounds).addTo(mergeMap[div_id]);

            mergeActiveImage[div_id].on('load', function() {
                // I want to zoom the map to fit the bounds of detection
                if (detection != null) {
                    det_bounds = [[detection.top*mergeMapHeight[div_id],detection.left*mergeMapWidth[div_id]],[detection.bottom*mergeMapHeight[div_id],detection.right*mergeMapWidth[div_id]]]
                    mergeMap[div_id].fitBounds(det_bounds, {padding: [10,10]});
                }
            });


            mergeMapWidth[div_id] = northEast.lng
            mergeMapHeight[div_id] = southWest.lat
            mergeMap[div_id].setMaxBounds(bounds);
            mergeMap[div_id].fitBounds(bounds)
            mergeMap[div_id].setMinZoom(mergeMap[div_id].getZoom())



            mergeMap[div_id].on('resize', function(){
                if (mergeMap[div_id] != null && document.getElementById(div_id) && document.getElementById(div_id).clientHeight){

                    var h1 = document.getElementById(div_id).clientHeight
                    var w1 = document.getElementById(div_id).clientWidth

                    var southWest = mergeMap[div_id].unproject([0, h1], 2);
                    var northEast = mergeMap[div_id].unproject([w1, 0], 2);
                    var bounds = new L.LatLngBounds(southWest, northEast);

                    mergeMapWidth[div_id] = northEast.lng
                    mergeMapHeight[div_id] = southWest.lat
                        
                    mergeMap[div_id].invalidateSize()
                    mergeMap[div_id].setMaxBounds(bounds)
                    mergeMap[div_id].fitBounds(bounds)
                    mergeMap[div_id].setMinZoom(2)
                    mergeActiveImage[div_id].setBounds(bounds)
                    
                    // add a small delay to allow the map to resize
                    setTimeout(function() {
                        if (detection != null) {
                            var det_bounds = [[detection.top*mergeMapHeight[div_id],detection.left*mergeMapWidth[div_id]],[detection.bottom*mergeMapHeight[div_id],detection.right*mergeMapWidth[div_id]]]
                            mergeMap[div_id].fitBounds(det_bounds, {padding: [10,10]});
                        }
                    }, 500);

                }
            });
        }
        img.src = imageUrl
    }
}