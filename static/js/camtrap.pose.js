// Pose review on the existing annotation page. Tagging level -9,<label id>.

var poseReviewMode = 'pose'
var poseSelectedId = null
var poseMarkers = null
var poseContextBound = false
var POSE_POINT_NAMES = [
    'left_eye', 'right_eye', 'nose', 'neck', 'tail',
    'left_shoulder', 'left_elbow', 'left_front_paw',
    'right_shoulder', 'right_elbow', 'right_front_paw',
    'left_hip', 'left_knee', 'left_back_paw',
    'right_hip', 'right_knee', 'right_back_paw',
    'shoulder_top'
]

function isPoseReview() {
    return typeof taggingLevel === 'string' && taggingLevel.indexOf('-9') === 0
}

function buildPoseReviewPanel(res) {
    if (divBtns == null) return
    while (divBtns.firstChild) {
        divBtns.removeChild(divBtns.firstChild)
    }

    var mode = document.createElement('select')
    mode.id = 'poseModeSelector'
    mode.className = 'form-control'
    mode.style.marginTop = '3px'
    mode.style.marginBottom = '3px'
    var poseOption = new Option('Pose keypoints', 'pose')
    var speciesOption = new Option('Species', 'species')
    mode.add(poseOption)
    mode.add(speciesOption)
    mode.value = poseReviewMode
    mode.addEventListener('change', function() {
        poseReviewMode = this.value
        switchToLabel = poseReviewMode === 'species'
        poseRefresh()
    })
    divBtns.appendChild(mode)

    var flank = document.createElement('select')
    flank.id = 'poseFlankSelector'
    flank.className = 'form-control'
    flank.style.marginTop = '3px'
    flank.style.marginBottom = '3px'
    ;['Left', 'Right', 'Ambiguous'].forEach(function(name) {
        flank.add(new Option(name, name))
    })
    flank.addEventListener('change', function() {
        var detection = poseSelectedDetection()
        if (!detection) return
        detection.flank = this.value
        detection.poseDirty = true
    })
    divBtns.appendChild(flank)

    var measurements = document.createElement('div')
    measurements.id = 'poseMeasurements'
    measurements.style.margin = '4px 0'
    measurements.innerHTML = 'Shoulder height: -<br>Back length: -'
    divBtns.appendChild(measurements)

    var unusable = document.createElement('button')
    unusable.className = 'btn btn-danger btn-block btn-sm'
    unusable.style.marginTop = '3px'
    unusable.innerHTML = 'Mark unusable'
    unusable.addEventListener('click', function() {
        var detection = poseSelectedDetection()
        if (!detection) return
        detection.unusable = true
        detection.keypoints = []
        detection.shoulder_height = 0
        detection.back_length = 0
        detection.poseDirty = true
        poseRefresh()
    })
    divBtns.appendChild(unusable)

    var speciesDiv = document.createElement('div')
    speciesDiv.id = 'poseSpeciesButtons'
    speciesDiv.style.display = 'none'
    if (res && res[0]) {
        for (var i = 0; i < res[0].length; i++) {
            if (!res[1][i] || res[1][i] === 'N' || res[1][i] === 'Skip') continue
            var button = document.createElement('button')
            button.className = 'btn btn-primary btn-block btn-sm'
            button.style.marginTop = '3px'
            button.innerHTML = res[1][i]
            button.setAttribute('data-label', res[1][i])
            button.addEventListener('click', function(event) {
                poseSetSpecies(event.currentTarget.getAttribute('data-label'))
            })
            speciesDiv.appendChild(button)
        }
    }
    divBtns.appendChild(speciesDiv)

    var submit = document.createElement('button')
    submit.className = 'btn btn-primary btn-block btn-sm'
    submit.style.marginTop = '3px'
    submit.innerHTML = 'Submit cluster'
    submit.addEventListener('click', function() { poseSave(true) })
    divBtns.appendChild(submit)

    var skip = document.createElement('button')
    skip.className = 'btn btn-info btn-block btn-sm'
    skip.style.marginTop = '3px'
    skip.innerHTML = 'Skip'
    skip.addEventListener('click', poseSkipCluster)
    divBtns.appendChild(skip)

    switchToLabel = false
}

function poseRefresh() {
    var speciesDiv = document.getElementById('poseSpeciesButtons')
    if (speciesDiv) speciesDiv.style.display = poseReviewMode === 'species' ? 'block' : 'none'
    addedDetections['map1'] = false
    addDetections('map1')
}

function poseCurrentImage() {
    if (!clusters['map1'] || clusters['map1'][clusterIndex['map1']] == null) return null
    return clusters['map1'][clusterIndex['map1']].images[imageIndex['map1']]
}

function poseShowMeasurements(detection) {
    var node = document.getElementById('poseMeasurements')
    if (!node) return
    if (!detection) {
        node.innerHTML = 'Shoulder height: -<br>Back length: -'
        return
    }
    var shoulder = detection.shoulder_height == null ? '-' : detection.shoulder_height
    var back = detection.back_length == null ? '-' : detection.back_length
    node.innerHTML = 'Shoulder height: ' + shoulder + ' cm<br>Back length: ' + back + ' cm'
}

function poseSelectedDetection() {
    var image = poseCurrentImage()
    if (!image || poseSelectedId == null) return null
    for (var i = 0; i < image.detections.length; i++) {
        if (String(image.detections[i].id) === String(poseSelectedId)) return image.detections[i]
    }
    return null
}

function poseAfterDetections(mapID) {
    if (!isPoseReview() || mapID !== 'map1') return
    if (poseMarkers) {
        map[mapID].removeLayer(poseMarkers)
        poseMarkers = null
    }
    var image = poseCurrentImage()
    if (!image) return
    for (var leafletID in drawnItems[mapID]._layers) {
        drawnItems[mapID]._layers[leafletID].on('click', function(id) {
            return function() {
                poseSelectedId = id
                var detection = poseSelectedDetection()
                var flank = document.getElementById('poseFlankSelector')
                if (detection && flank) {
                    var value = detection.flank || 'Ambiguous'
                    if (value.toLowerCase() === 'left') value = 'Left'
                    else if (value.toLowerCase() === 'right') value = 'Right'
                    else if (value.toLowerCase() === 'ambiguous' || value.toLowerCase() === 'none') value = 'Ambiguous'
                    flank.value = value
                }
                poseShowMeasurements(detection)
            }
        }(dbDetIds[mapID][leafletID]))
    }
    if (poseReviewMode !== 'pose') return
    poseMarkers = L.layerGroup().addTo(map[mapID])
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        var points = detection.keypoints || []
        for (var p = 0; p < points.length; p++) {
            poseAddMarker(mapID, detection, points[p])
        }
    }
    if (!poseContextBound) {
        map[mapID].on('contextmenu', poseMapContext)
        poseContextBound = true
    }
}

function poseAddMarker(mapID, detection, point) {
    var marker = L.marker(
        [point.y * mapHeight[mapID], point.x * mapWidth[mapID]],
        {draggable: true, title: point.name}
    )
    marker.bindTooltip(point.name, {permanent: false, direction: 'top'})
    marker.poseDetection = detection
    marker.posePoint = point
    marker.on('dragend', function(event) {
        var latlng = event.target.getLatLng()
        event.target.posePoint.x = Math.max(0, Math.min(1, latlng.lng / mapWidth[mapID]))
        event.target.posePoint.y = Math.max(0, Math.min(1, latlng.lat / mapHeight[mapID]))
        if (event.target.posePoint.source !== 'user') event.target.posePoint.source = 'user_edited'
        event.target.poseDetection.poseDirty = true
    })
    marker.on('contextmenu', function(event) {
        L.DomEvent.stopPropagation(event)
        poseDeletePoint(event.target.poseDetection, event.target.posePoint.name)
    })
    poseMarkers.addLayer(marker)
}

function poseDeletePoint(detection, name) {
    detection.keypoints = (detection.keypoints || []).filter(function(point) {
        return point.name !== name
    })
    detection.poseDirty = true
    poseRefresh()
}

function poseMapContext(event) {
    if (!isPoseReview() || poseReviewMode !== 'pose') return
    var image = poseCurrentImage()
    if (!image || mapWidth['map1'] == null) return
    var x = event.latlng.lng / mapWidth['map1']
    var y = event.latlng.lat / mapHeight['map1']
    var detection = null
    for (var i = 0; i < image.detections.length; i++) {
        var box = image.detections[i]
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
            detection = box
            break
        }
    }
    if (!detection) return
    L.DomEvent.preventDefault(event)
    var present = {}
    ;(detection.keypoints || []).forEach(function(point) { present[point.name] = true })
    map['map1'].contextmenu.removeAllItems()
    POSE_POINT_NAMES.forEach(function(name) {
        if (present[name]) return
        map['map1'].contextmenu.addItem({
            text: name,
            callback: function(chosen, det, px, py) {
                return function() { poseCreatePoint(det, chosen, px, py) }
            }(name, detection, x, y)
        })
    })
    map['map1'].contextmenu.showAt(event.containerPoint)
}

function poseCreatePoint(detection, name, x, y) {
    if (!detection.keypoints) detection.keypoints = []
    detection.keypoints.push({name: name, x: x, y: y, score: null, source: 'user'})
    detection.poseDirty = true
    poseSelectedId = detection.id
    poseRefresh()
}

function poseSetSpecies(label) {
    var detection = poseSelectedDetection()
    if (!detection) return
    submitSightingChanges({ids: [Number(detection.id)], label: label}, 'label')
}

function poseSkipCluster() {
    var cluster = clusters['map1'][clusterIndex['map1']]
    if (!cluster) return
    var xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var reply = JSON.parse(this.responseText)
            if (reply.progress) updateProgBar(reply.progress)
            nextCluster('map1')
        }
    }
    xhttp.open('GET', '/skipBoundingCluster/' + cluster.id)
    xhttp.send()
}

function poseSaveOnLeave() {
    if (!isPoseReview()) return
    poseSave(false)
}

function poseSave(submitCluster) {
    if (!isPoseReview()) return
    var image = poseCurrentImage()
    var cluster = clusters['map1'][clusterIndex['map1']]
    if (!image || !cluster || String(cluster.id).indexOf('-') === 0) return
    var edits = {}
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        if (!detection.poseDirty && !submitCluster) continue
        if (detection.unusable) {
            edits[detection.id] = {unusable: true}
        } else if (detection.poseDirty) {
            edits[detection.id] = {
                flank: detection.flank,
                keypoints: detection.keypoints || []
            }
        }
        detection.poseDirty = false
    }
    if (Object.keys(edits).length === 0 && !submitCluster) return
    var formData = new FormData()
    formData.append('detections', JSON.stringify(edits))
    formData.append('image_width', mapWidth['map1'])
    formData.append('image_height', mapHeight['map1'])
    formData.append('cluster_id', JSON.stringify(cluster.id))
    formData.append('submit_cluster', submitCluster ? 'true' : 'false')
    var xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 278) {
            window.location.replace(JSON.parse(this.responseText)['redirect'])
        } else if (this.readyState == 4 && this.status == 200) {
            var reply = JSON.parse(this.responseText)
            var imageNow = poseCurrentImage()
            if (reply.measurements && imageNow) {
                for (var n = 0; n < imageNow.detections.length; n++) {
                    var fresh = reply.measurements[imageNow.detections[n].id]
                    if (!fresh) fresh = reply.measurements[String(imageNow.detections[n].id)]
                    if (!fresh) continue
                    imageNow.detections[n].shoulder_height = fresh.shoulder_height
                    imageNow.detections[n].back_length = fresh.back_length
                }
                poseShowMeasurements(poseSelectedDetection())
            }
            if (submitCluster) {
                if (reply.progress) updateProgBar(reply.progress)
                nextCluster('map1')
            }
        }
    }
    xhttp.open('POST', '/savePoseReview')
    xhttp.send(formData)
}
