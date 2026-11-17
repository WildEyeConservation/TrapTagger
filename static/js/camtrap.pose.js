// Pose review on the existing annotation page. Tagging level -9,<label id>.

var poseReviewMode = 'pose'
var poseSelectedId = null
var poseMarkers = null
var poseContextBound = false
var poseModesBound = false
var poseEditMode = false
var poseDeleteMode = false
var poseDeleteSaved = false
var poseHotkeyNames = []
var POSE_EDGES = [
    ['left_eye', 'nose'], ['right_eye', 'nose'], ['nose', 'neck'], ['neck', 'tail'],
    ['neck', 'left_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_front_paw'],
    ['neck', 'right_shoulder'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_front_paw'],
    ['tail', 'left_hip'], ['left_hip', 'left_knee'], ['left_knee', 'left_back_paw'],
    ['tail', 'right_hip'], ['right_hip', 'right_knee'], ['right_knee', 'right_back_paw']
]
var POSE_KEY_INDEX = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15, 'g': 16, 'h': 17, 'i': 18, 'j': 19,
    'k': 20, 'l': 21, 'm': 22, 'n': 23, 'o': 24, 'p': 25, 'q': 26, 'r': 27, 's': 28, 't': 29,
    'u': 30, 'v': 31, 'w': 32, 'x': 33, 'y': 34, 'z': 35, ' ': 36, '-': 38
}
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
    measurements.style.margin = '6px 0'
    measurements.style.fontSize = '140%'
    measurements.style.fontWeight = '600'
    measurements.style.lineHeight = '1.4'
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
    poseHotkeyNames = []
    if (res && res[0]) {
        var labs = res[0]
        var names = res[1]
        for (var i = 0; i < labs.length; i++) {
            hotkeys[i] = labs[i]
            poseHotkeyNames[i] = names[i]
            if (!names[i] || names[i] === 'N' || labs[i] == EMPTY_HOTKEY_ID) continue
            var button = document.createElement('button')
            var labelName = names[i]
            if (i < 10) labelName += ' (' + String.fromCharCode(i + 48) + ')'
            else if (i === labs.length - 3) labelName += ' (Space)'
            else if (i === labs.length - 1) labelName += ' (-)'
            else labelName += ' (' + String.fromCharCode(i + 55) + ')'
            button.className = 'btn btn-block btn-sm ' + (names[i] === 'Skip' ? 'btn-danger' : 'btn-primary')
            button.style.marginTop = '3px'
            button.innerHTML = labelName
            button.setAttribute('data-label', names[i])
            button.addEventListener('click', function(event) {
                var chosen = event.currentTarget.getAttribute('data-label')
                if (chosen === 'Skip') poseSkipCluster()
                else poseSetSpecies(chosen)
            })
            speciesDiv.appendChild(button)
        }
        var speciesSubmit = document.createElement('button')
        speciesSubmit.className = 'btn btn-primary btn-block btn-sm'
        speciesSubmit.style.marginTop = '3px'
        speciesSubmit.innerHTML = 'Submit cluster'
        speciesSubmit.addEventListener('click', function() { poseSave(true) })
        speciesDiv.appendChild(speciesSubmit)
    }
    divBtns.appendChild(speciesDiv)

    var submit = document.createElement('button')
    submit.id = 'poseSubmitCluster'
    submit.className = 'btn btn-primary btn-block btn-sm'
    submit.style.marginTop = '3px'
    submit.innerHTML = 'Submit cluster'
    submit.addEventListener('click', function() { poseSave(true) })
    divBtns.appendChild(submit)

    var skip = document.createElement('button')
    skip.id = 'poseSkipCluster'
    skip.className = 'btn btn-info btn-block btn-sm'
    skip.style.marginTop = '3px'
    skip.innerHTML = 'Skip'
    skip.addEventListener('click', poseSkipCluster)
    divBtns.appendChild(skip)

    switchToLabel = false
}

function poseRefresh() {
    var speciesMode = poseReviewMode === 'species'
    var speciesDiv = document.getElementById('poseSpeciesButtons')
    if (speciesDiv) speciesDiv.style.display = speciesMode ? 'block' : 'none'
    var submit = document.getElementById('poseSubmitCluster')
    var skip = document.getElementById('poseSkipCluster')
    if (submit) submit.style.display = speciesMode ? 'none' : 'block'
    if (skip) skip.style.display = speciesMode ? 'none' : 'block'
    addedDetections['map1'] = false
    addDetections('map1')
}

function poseCm(value) {
    if (value == null || value === '') return '-'
    var number = Number(value)
    if (isNaN(number)) return '-'
    return number.toFixed(2)
}

function poseHotkey(key) {
    var index = POSE_KEY_INDEX[key]
    if (index == null) return false
    var name = poseHotkeyNames[index]
    if (!name || name === 'N' || hotkeys[index] == EMPTY_HOTKEY_ID) return false
    if (name === 'Skip') poseSkipCluster()
    else poseSetSpecies(name)
    return true
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
    node.innerHTML = 'Shoulder height: ' + poseCm(detection.shoulder_height) + ' cm<br>Back length: ' + poseCm(detection.back_length) + ' cm'
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
    poseBindModes(mapID)
    poseMarkers = L.layerGroup().addTo(map[mapID])
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        var points = detection.keypoints || []
        poseDrawSkeleton(mapID, points)
        for (var p = 0; p < points.length; p++) {
            poseAddMarker(mapID, detection, points[p])
        }
    }
    if (!poseContextBound) {
        map[mapID].on('contextmenu', poseMapContext)
        poseContextBound = true
    }
}

function poseBindModes(mapID) {
    if (poseModesBound) return
    poseModesBound = true
    map[mapID].on('draw:editstart', function() { poseEditMode = true })
    map[mapID].on('draw:editstop', function() { poseEditMode = false })
    map[mapID].on('draw:deletestart', function() { poseDeleteMode = true })
    map[mapID].on('draw:deleted', function() {
        poseDeleteSaved = true
        poseCommitDeletes()
    })
    map[mapID].on('draw:deletestop', function() {
        if (!poseDeleteSaved) poseClearDeleteMarks()
        poseDeleteSaved = false
        poseDeleteMode = false
    })
}

function posePointLatLng(mapID, point) {
    return [point.y * mapHeight[mapID], point.x * mapWidth[mapID]]
}

function poseDrawSkeleton(mapID, points) {
    var byName = {}
    for (var i = 0; i < points.length; i++) byName[points[i].name] = points[i]
    var edges = POSE_EDGES.slice()
    if (byName.shoulder_top) {
        var top = byName.shoulder_top
        var nearest = null
        var nearestDistance = null
        ;['left_shoulder', 'right_shoulder'].forEach(function(name) {
            if (!byName[name]) return
            var distance = Math.abs(byName[name].x - top.x)
            if (nearestDistance == null || distance < nearestDistance) {
                nearest = name
                nearestDistance = distance
            }
        })
        if (nearest) edges.push(['shoulder_top', nearest])
    }
    edges.forEach(function(edge) {
        if (!byName[edge[0]] || !byName[edge[1]]) return
        poseMarkers.addLayer(L.polyline(
            [posePointLatLng(mapID, byName[edge[0]]), posePointLatLng(mapID, byName[edge[1]])],
            {color: '#F2C14E', weight: 2, interactive: false}
        ))
    })
}

function poseUpdateLines(mapID) {
    if (!poseMarkers) return
    var image = poseCurrentImage()
    if (!image) return
    var lines = []
    poseMarkers.eachLayer(function(layer) {
        if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) lines.push(layer)
    })
    lines.forEach(function(line) { poseMarkers.removeLayer(line) })
    for (var i = 0; i < image.detections.length; i++) {
        poseDrawSkeleton(mapID, image.detections[i].keypoints || [])
    }
}

function poseAddMarker(mapID, detection, point) {
    var marker = L.circleMarker(posePointLatLng(mapID, point), {
        radius: 6,
        color: '#7A3E00',
        weight: 1,
        fillColor: '#DF691A',
        fillOpacity: 1
    })
    marker.bindTooltip(point.name, {permanent: false, direction: 'top'})
    marker.poseDetection = detection
    marker.posePoint = point
    marker.on('mousedown', function(event) {
        if (!poseEditMode) return
        L.DomEvent.stopPropagation(event)
        map[mapID].dragging.disable()
        var move = function(ev) { marker.setLatLng(ev.latlng) }
        var up = function(ev) {
            map[mapID].off('mousemove', move)
            map[mapID].off('mouseup', up)
            map[mapID].dragging.enable()
            var latlng = ev.latlng
            point.x = Math.max(0, Math.min(1, latlng.lng / mapWidth[mapID]))
            point.y = Math.max(0, Math.min(1, latlng.lat / mapHeight[mapID]))
            if (point.source !== 'user') point.source = 'user_edited'
            detection.poseDirty = true
            marker.setLatLng(posePointLatLng(mapID, point))
            poseUpdateLines(mapID)
        }
        map[mapID].on('mousemove', move)
        map[mapID].on('mouseup', up)
    })
    marker.on('click', function() {
        if (!poseDeleteMode) return
        point.pendingDelete = !point.pendingDelete
        marker.setStyle({fillColor: point.pendingDelete ? '#888888' : '#DF691A', fillOpacity: point.pendingDelete ? 0.35 : 1})
    })
    poseMarkers.addLayer(marker)
}

function poseCommitDeletes() {
    if (!isPoseReview() || poseReviewMode !== 'pose') return
    var image = poseCurrentImage()
    if (!image) return
    var changed = false
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        var before = (detection.keypoints || []).length
        detection.keypoints = (detection.keypoints || []).filter(function(point) { return !point.pendingDelete })
        if (detection.keypoints.length !== before) {
            detection.poseDirty = true
            changed = true
        }
    }
    if (changed) poseRefresh()
}

function poseClearDeleteMarks() {
    var image = poseCurrentImage()
    if (!image || !poseMarkers) return
    for (var i = 0; i < image.detections.length; i++) {
        (image.detections[i].keypoints || []).forEach(function(point) { point.pendingDelete = false })
    }
    poseMarkers.eachLayer(function(layer) {
        if (layer.posePoint) layer.setStyle({fillColor: '#DF691A', fillOpacity: 1})
    })
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
