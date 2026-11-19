// Pose review on the existing annotation page. Tagging level -9,<label id>.

var poseReviewMode = 'pose'
var poseSelectedId = null
var poseMarkers = null
var poseContextBound = false
var poseModesBound = false
var poseEditMode = false
var poseEditSaved = false
var poseSaveSeq = 0
var poseEditSnapshot = null
var poseMenuOpen = false
var poseDeleteMode = false
var poseDeleteSaved = false
var poseKeepView = false
var poseSubmitting = false
var poseHotkeyNames = []
var POSE_COLOURS = [
    {fill: '#1A69DF', line: '#A9C8F5', edge: '#0B3F86'},
    {fill: '#2E8B57', line: '#A8D5B5', edge: '#145C32'},
    {fill: '#7B3FA0', line: '#D4B3E8', edge: '#4A2266'},
    {fill: '#0E8A8A', line: '#A6DEDE', edge: '#085858'},
    {fill: '#C43B6E', line: '#F0B3C8', edge: '#7A2044'},
    {fill: '#B8860B', line: '#E8D49A', edge: '#6E5006'}
]
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
    var poseOption = new Option('Pose Keypoints', 'pose')
    var speciesOption = new Option('Species Labelling', 'species')
    mode.add(poseOption)
    mode.add(speciesOption)
    mode.value = poseReviewMode
    mode.addEventListener('change', function() {
        poseReviewMode = this.value
        switchToLabel = poseReviewMode === 'species'
        poseRefresh()
    })
    divBtns.appendChild(mode)

    var flankLabel = document.createElement('div')
    flankLabel.id = 'poseFlankLabel'
    flankLabel.innerHTML = 'Flank Selection'
    flankLabel.style.marginTop = '8px'
    flankLabel.style.borderTop = '1px solid #3c4a59'
    flankLabel.style.paddingTop = '6px'
    flankLabel.style.fontSize = '100%'
    flankLabel.style.fontWeight = '600'
    divBtns.appendChild(flankLabel)

    var flankRow = document.createElement('div')
    flankRow.id = 'poseFlankRow'
    flankRow.style.margin = '4px 0 8px 0'
    ;['Left', 'Right'].forEach(function(name) {
        var button = document.createElement('button')
        button.type = 'button'
        button.id = 'poseFlank' + name
        button.innerHTML = name
        button.className = 'btn btn-sm'
        button.style.width = '48%'
        button.style.marginRight = name === 'Left' ? '4%' : '0'
        button.style.background = '#ffffff'
        button.style.color = '#333333'
        button.style.border = '1px solid #cccccc'
        button.addEventListener('click', function() { poseChooseFlank(name) })
        flankRow.appendChild(button)
    })
    divBtns.appendChild(flankRow)

    var measurements = document.createElement('div')
    measurements.id = 'poseMeasurements'
    measurements.style.margin = '6px 0'
    measurements.style.fontSize = '115%'
    measurements.style.fontWeight = '600'
    measurements.style.lineHeight = '1.4'
    measurements.innerHTML = 'Shoulder Height: -<br>Back Length: -'
    divBtns.appendChild(measurements)

    var unusable = document.createElement('button')
    unusable.id = 'poseUnusableButton'
    unusable.className = 'btn btn-danger btn-block btn-sm'
    unusable.style.marginTop = '3px'
    unusable.innerHTML = 'Mark Unusable (U)'
    unusable.addEventListener('click', function(event) {
        event.preventDefault()
        event.stopPropagation()
        var detection = poseSelectedDetection()
        if (!detection) return
        if (detection.unusable) poseUndoUnusable(detection)
        else $('#modalPoseUnusable').modal('show')
    })
    divBtns.appendChild(unusable)

    var speciesDiv = document.createElement('div')
    speciesDiv.id = 'poseSpeciesButtons'
    speciesDiv.style.display = 'none'
    var multiple = document.createElement('button')
    multiple.id = 'multipleBtn'
    multiple.className = 'btn btn-danger btn-block btn-sm'
    multiple.style.marginTop = '3px'
    multiple.innerHTML = 'Multiple Species (Ctrl)'
    multiple.addEventListener('click', function() { activateMultiple() })
    speciesDiv.appendChild(multiple)
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
            var buttonClass = 'btn-primary'
            if (names[i] === 'Skip' || names[i] === 'Wrong' || names[i] === 'Mask Area' || names[i] === 'Remove False Detections') buttonClass = 'btn-danger'
            else if (i >= 10 && i !== labs.length - 3) buttonClass = 'btn-info'
            button.className = 'btn btn-block btn-sm ' + buttonClass
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
    }
    divBtns.appendChild(speciesDiv)

    var skip = document.createElement('button')
    skip.id = 'poseSkipCluster'
    skip.className = 'btn btn-danger btn-block btn-sm'
    skip.style.marginTop = '3px'
    skip.innerHTML = 'Skip (0)'
    skip.addEventListener('click', poseSkipCluster)
    divBtns.appendChild(skip)

    var submit = document.createElement('button')
    submit.id = 'poseSubmitCluster'
    submit.className = 'btn btn-success btn-block btn-sm'
    submit.style.marginTop = '3px'
    submit.innerHTML = 'Submit (Ctrl)'
    submit.addEventListener('click', function() { poseSubmitImage() })
    divBtns.appendChild(submit)

    switchToLabel = false
    poseUpdateDrawTool()
    poseLayoutNav()
}

function poseLayoutNav() {
    ;['backImage', 'prevImage', 'forwardImage'].forEach(function(id) {
        var button = document.getElementById(id)
        if (button && button.parentElement) button.parentElement.style.display = 'none'
    })
    var back = document.getElementById('prevCluster')
    var next = document.getElementById('nextImage')
    if (back) {
        back.innerHTML = 'Back'
        back.onclick = function() { poseBack() }
        if (back.parentElement) back.parentElement.className = 'col-lg-3'
    }
    if (next) {
        next.innerHTML = 'Next'
        next.className = 'btn btn-primary btn-block'
        next.onclick = function() { nextImage() }
        if (next.parentElement) next.parentElement.className = 'col-lg-3'
    }
}

function poseBack() {
    if (!isPoseReview() || poseSubmitting) return
    if (typeof editingEnabled !== 'undefined' && editingEnabled) return
    if (typeof finishedDisplaying !== 'undefined' && finishedDisplaying['map1'] != true) return
    var cluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
    if (!cluster) return
    poseSave(false)
    if (imageIndex['map1'] > 0) {
        imageIndex['map1'] -= 1
        update('map1')
        return
    }
    if (clusterIndex['map1'] <= 0) return
    var previous = clusters['map1'][clusterIndex['map1'] - 1]
    if (!previous || ['-99', '-101', '-782'].indexOf(String(previous.id)) !== -1) return
    clusterIndex['map1'] -= 1
    imageIndex['map1'] = previous.images && previous.images.length ? previous.images.length - 1 : 0
    update('map1')
}

function poseRefresh() {
    var speciesMode = poseReviewMode === 'species'
    var speciesDiv = document.getElementById('poseSpeciesButtons')
    if (speciesDiv) speciesDiv.style.display = speciesMode ? 'block' : 'none'
    var submit = document.getElementById('poseSubmitCluster')
    var skip = document.getElementById('poseSkipCluster')
    if (submit) submit.style.display = speciesMode ? 'none' : 'block'
    if (skip) skip.style.display = speciesMode ? 'none' : 'block'
    var measurements = document.getElementById('poseMeasurements')
    var unusable = document.getElementById('poseUnusableButton')
    var flankLabel = document.getElementById('poseFlankLabel')
    var flankRow = document.getElementById('poseFlankRow')
    if (measurements) measurements.style.display = speciesMode ? 'none' : 'block'
    if (unusable) unusable.style.display = speciesMode ? 'none' : 'block'
    if (flankLabel) flankLabel.style.display = speciesMode ? 'none' : 'block'
    if (flankRow) flankRow.style.display = speciesMode ? 'none' : 'block'
    poseKeepView = true
    addedDetections['map1'] = false
    addDetections('map1')
    poseKeepView = false
    if (poseEditMode || poseDeleteMode) poseFreezeBoxes('map1')
    poseUpdateDrawTool()
}

function poseStoredZero(value) {
    if (value == null || value === '') return false
    var number = Number(value)
    return !isNaN(number) && number === 0
}

function poseHasDistance(detection) {
    if (!detection || detection.distance == null || detection.distance === '') return false
    return Number(detection.distance) > 0
}

function posePointsByName(detection) {
    var byName = {}
    var points = detection && detection.keypoints ? detection.keypoints : []
    for (var i = 0; i < points.length; i++) {
        if (points[i] && points[i].name) byName[points[i].name] = points[i]
    }
    return byName
}

function poseShoulderReady(detection) {
    var byName = posePointsByName(detection)
    if (!posePointUsable(byName.shoulder_top)) return false
    var leftNames = ['left_shoulder', 'left_elbow', 'left_front_paw']
    var rightNames = ['right_shoulder', 'right_elbow', 'right_front_paw']
    var leftOk = poseLegComplete(byName, leftNames)
    var rightOk = poseLegComplete(byName, rightNames)
    var flank = poseCanonicalFlank(detection.flank)
    if (flank === 'Left') return leftOk || rightOk
    if (flank === 'Right') return rightOk || leftOk
    return leftOk || rightOk
}

function poseBackReady(detection) {
    var byName = posePointsByName(detection)
    return posePointUsable(byName.neck) && posePointUsable(byName.tail)
}

function poseMeasureText(detection, value, ready) {
    if (value != null && value !== '') {
        var number = Number(value)
        if (!isNaN(number) && number > 0) return number.toFixed(2) + ' cm'
        if (poseStoredZero(value)) return 'Unusable'
    }
    if (!poseHasDistance(detection)) return 'Missing distance'
    if (!ready) return 'Insufficient keypoints'
    return '-'
}

function poseNoteStoredUnusable(detection) {
    if (!detection || detection.unusable) return
    if (poseStoredZero(detection.shoulder_height) && poseStoredZero(detection.back_length)) detection.unusable = true
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

function poseCanonicalFlank(value) {
    var name = (value || '').toString().toLowerCase()
    if (name === 'l' || name === 'left') return 'Left'
    if (name === 'r' || name === 'right') return 'Right'
    return 'None'
}

function poseCommittedFlank(detection) {
    if (!detection._committedFlank) detection._committedFlank = poseCanonicalFlank(detection.flank)
    return detection._committedFlank
}

function poseStyleFlank(detection) {
    var chosen = detection ? poseCanonicalFlank(detection.flank) : 'None'
    ;['Left', 'Right'].forEach(function(name) {
        var button = document.getElementById('poseFlank' + name)
        if (!button) return
        var selected = chosen === name
        button.style.background = selected ? '#DF691A' : '#ffffff'
        button.style.color = selected ? '#ffffff' : '#333333'
        button.style.border = '1px solid ' + (selected ? '#DF691A' : '#cccccc')
    })
}

function poseConfirmUnusable() {
    var detection = poseSelectedDetection()
    if (!detection || detection.unusable) return
    detection.unusable = true
    detection.keypoints = []
    detection.shoulder_height = 0
    detection.back_length = 0
    detection._measuresPending = false
    detection._pointsPending = false
    detection._flankPending = false
    detection.poseDirty = true
    poseShowMeasurements(detection)
    poseRefresh()
    poseSave(false)
}

function poseUndoUnusable(detection) {
    detection.unusable = false
    detection.shoulder_height = null
    detection.back_length = null
    detection._measuresPending = false
    detection._recalculating = false
    detection._pointsPending = false
    detection._flankPending = false
    detection.poseDirty = true
    poseShowMeasurements(detection)
    poseRefresh()
    poseSave(false)
}

function poseChooseFlank(name) {
    var detection = poseSelectedDetection()
    if (!detection || detection.unusable) return
    var committed = poseCommittedFlank(detection)
    detection.flank = name
    detection._flankPending = name !== committed
    detection.poseDirty = detection._flankPending || !!detection._pointsPending
    detection._measuresPending = detection.poseDirty
    poseStyleFlank(detection)
    poseShowMeasurements(detection)
    if (detection.poseDirty) poseSave(false)
}

function poseMarkPointsPending(detection) {
    detection._pointsPending = true
    detection._measuresPending = true
    detection.poseDirty = true
    if (poseSelectedDetection() === detection) poseShowMeasurements(detection)
}

function poseShowMeasurements(detection) {
    var node = document.getElementById('poseMeasurements')
    if (!node) return
    poseNoteStoredUnusable(detection)
    poseStyleFlank(detection)
    var unusableButton = document.getElementById('poseUnusableButton')
    if (unusableButton) unusableButton.innerHTML = detection && detection.unusable ? 'Undo Unusable (U)' : 'Mark Unusable (U)'
    if (!detection) {
        node.innerHTML = 'Shoulder Height: -<br>Back Length: -'
        return
    }
    if (detection.unusable) {
        node.innerHTML = 'Shoulder Height: Unusable<br>Back Length: Unusable'
        return
    }
    if (detection._recalculating) {
        node.innerHTML = 'Shoulder Height: Recalculating...<br>Back Length: Recalculating...'
        return
    }
    if (detection._measuresPending) {
        node.innerHTML = 'Shoulder Height: Recalculation Required<br>Back Length: Recalculation Required'
        return
    }
    node.innerHTML = 'Shoulder Height: ' + poseMeasureText(detection, detection.shoulder_height, poseShoulderReady(detection)) + '<br>Back Length: ' + poseMeasureText(detection, detection.back_length, poseBackReady(detection))
}

function poseClearSelection() {
    poseSelectedId = null
    poseShowMeasurements(null)
}

function poseColourFor(detection) {
    if (!detection) return POSE_COLOURS[0]
    if (detection._poseColourIndex == null) {
        var image = poseCurrentImage()
        var index = 0
        if (image) {
            for (var i = 0; i < image.detections.length; i++) {
                if (String(image.detections[i].id) === String(detection.id)) {
                    index = i
                    break
                }
            }
        }
        detection._poseColourIndex = index
    }
    return POSE_COLOURS[detection._poseColourIndex % POSE_COLOURS.length]
}

function poseSendDetectionToBack(detection) {
    var image = poseCurrentImage()
    if (!image || !detection) return
    var index = -1
    for (var i = 0; i < image.detections.length; i++) {
        if (String(image.detections[i].id) === String(detection.id)) {
            index = i
            break
        }
    }
    if (index > 0) {
        image.detections.splice(index, 1)
        image.detections.unshift(detection)
    }
    if (!poseMarkers) return
    var own = []
    poseMarkers.eachLayer(function(layer) {
        if (layer.poseDetection && String(layer.poseDetection.id) === String(detection.id)) own.push(layer)
    })
    own.forEach(function(layer) {
        if (layer.bringToBack) layer.bringToBack()
    })
}

function posePaintBoxes(mapID) {
    if (!isPoseReview() || !drawnItems[mapID]) return
    var image = poseCurrentImage()
    if (!image) return
    for (var leafletID in drawnItems[mapID]._layers) {
        var layer = drawnItems[mapID]._layers[leafletID]
        var detection = null
        for (var d = 0; d < image.detections.length; d++) {
            if (String(image.detections[d].id) === String(dbDetIds[mapID][leafletID])) detection = image.detections[d]
        }
        if (!detection) continue
        var selected = String(detection.id) === String(poseSelectedId)
        if (detection.unusable) {
            layer.setStyle({color: selected ? colourSelected : '#DF691A', weight: selected ? 5 : 4, dashArray: '6 4'})
            continue
        }
        layer.setStyle({color: selected ? colourSelected : colourBase, weight: selected ? 5 : 3, dashArray: null})
    }
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
    for (var u = 0; u < image.detections.length; u++) poseNoteStoredUnusable(image.detections[u])
    for (var leafletID in drawnItems[mapID]._layers) {
        var layer = drawnItems[mapID]._layers[leafletID]
        var detectionForBox = null
        for (var d = 0; d < image.detections.length; d++) {
            if (String(image.detections[d].id) === String(dbDetIds[mapID][leafletID])) detectionForBox = image.detections[d]
        }
        if (poseReviewMode === 'pose' && detectionForBox && detectionForBox.unusable && layer._showContextMenu) {
            layer.off('contextmenu', layer._showContextMenu, layer)
            layer.on('contextmenu', function(event) {
                if (event.originalEvent) L.DomEvent.stop(event.originalEvent)
                if (map[mapID].contextmenu) map[mapID].contextmenu.hide()
            })
        }
        layer.on('click', function(id) {
            return function() {
                poseSelectedId = id
                poseShowMeasurements(poseSelectedDetection())
            }
        }(dbDetIds[mapID][leafletID]))
    }
    posePaintBoxes(mapID)
    if (poseReviewMode !== 'pose') return
    poseBindModes(mapID)
    poseMarkers = L.layerGroup().addTo(map[mapID])
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        var points = detection.keypoints || []
        poseDrawSkeleton(mapID, detection, points)
        for (var p = 0; p < points.length; p++) {
            poseAddMarker(mapID, detection, points[p])
        }
    }
    if (!poseContextBound) {
        map[mapID].on('contextmenu', poseMapContext)
        poseContextBound = true
    }
}

function poseSnapshotEdit() {
    poseEditSnapshot = {}
    var image = poseCurrentImage()
    if (!image) return
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        detection._pointsPendingAtEditStart = !!detection._pointsPending
        poseEditSnapshot[detection.id] = (detection.keypoints || []).map(function(point) {
            return {name: point.name, x: point.x, y: point.y, score: point.score, source: point.source}
        })
    }
}

function poseRestoreEdit() {
    var image = poseCurrentImage()
    if (!image || !poseEditSnapshot) return
    for (var i = 0; i < image.detections.length; i++) {
        var saved = poseEditSnapshot[image.detections[i].id]
        if (saved) image.detections[i].keypoints = saved
        image.detections[i]._pointsPending = !!image.detections[i]._pointsPendingAtEditStart
        image.detections[i]._measuresPending = !!image.detections[i]._flankPending || !!image.detections[i]._pointsPending
    }
    poseEditSnapshot = null
    poseRefresh()
    poseShowMeasurements(poseSelectedDetection())
}

function poseCommitEdit() {
    var image = poseCurrentImage()
    if (!image || !poseEditSnapshot) return
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        var saved = poseEditSnapshot[detection.id] || []
        if (JSON.stringify(saved) !== JSON.stringify(detection.keypoints || [])) poseMarkPointsPending(detection)
    }
    poseEditSnapshot = null
    poseSave(false)
}

function poseBindModes(mapID) {
    if (poseModesBound) return
    poseModesBound = true
    map[mapID].on('draw:editstart', function() {
        poseEditMode = true
        poseEditSaved = false
        poseSnapshotEdit()
        setTimeout(function() {
            poseCornerCursors()
            poseFreezeBoxes(mapID)
        }, 0)
    })
    map[mapID].on('draw:edited', function() { poseEditSaved = true })
    map[mapID].on('draw:editstop', function() {
        poseEditMode = false
        if (poseEditSaved) poseCommitEdit()
        else poseRestoreEdit()
        poseEditSaved = false
    })
    map[mapID].on('draw:deletestart', function() {
        poseDeleteMode = true
        setTimeout(function() { poseFreezeBoxes(mapID) }, 0)
    })
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

function posePointUsable(point) {
    if (!point) return false
    if (point.score == null || point.score === '') return true
    var score = Number(point.score)
    return !isNaN(score) && score >= 0.3
}

function poseLegComplete(byName, names) {
    for (var i = 0; i < names.length; i++) {
        if (!posePointUsable(byName[names[i]])) return false
    }
    return true
}

function poseMeanScore(byName, names) {
    var total = 0
    for (var i = 0; i < names.length; i++) {
        var point = byName[names[i]]
        total += (point.score == null || point.score === '') ? 1 : Number(point.score)
    }
    return total / names.length
}

function poseCalculatedShoulder(detection, byName) {
    if (!detection || detection._measuresPending || detection._recalculating) return null
    if (!(Number(detection.shoulder_height) > 0)) return null
    var leftNames = ['left_shoulder', 'left_elbow', 'left_front_paw']
    var rightNames = ['right_shoulder', 'right_elbow', 'right_front_paw']
    var leftOk = poseLegComplete(byName, leftNames)
    var rightOk = poseLegComplete(byName, rightNames)
    var flank = poseCanonicalFlank(detection.flank)
    if (flank === 'Left') {
        if (leftOk) return 'left_shoulder'
        if (rightOk) return 'right_shoulder'
        return null
    }
    if (flank === 'Right') {
        if (rightOk) return 'right_shoulder'
        if (leftOk) return 'left_shoulder'
        return null
    }
    if (leftOk && rightOk) return poseMeanScore(byName, leftNames) >= poseMeanScore(byName, rightNames) ? 'left_shoulder' : 'right_shoulder'
    if (leftOk) return 'left_shoulder'
    if (rightOk) return 'right_shoulder'
    return null
}

function poseDrawSkeleton(mapID, detection, points) {
    var colour = poseColourFor(detection)
    var byName = {}
    for (var i = 0; i < points.length; i++) byName[points[i].name] = points[i]
    var edges = POSE_EDGES.slice()
    if (byName.shoulder_top) {
        if (byName.neck) edges.push(['shoulder_top', 'neck'])
        if (byName.tail) edges.push(['shoulder_top', 'tail'])
        var shoulder = poseCalculatedShoulder(detection, byName)
        if (shoulder && byName[shoulder]) edges.push(['shoulder_top', shoulder])
    }
    edges.forEach(function(edge) {
        if (!byName[edge[0]] || !byName[edge[1]]) return
        var line = L.polyline(
            [posePointLatLng(mapID, byName[edge[0]]), posePointLatLng(mapID, byName[edge[1]])],
            {color: colour.line, weight: 2, interactive: false}
        )
        line.poseDetection = detection
        poseMarkers.addLayer(line)
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
        poseDrawSkeleton(mapID, image.detections[i], image.detections[i].keypoints || [])
    }
}

function poseAddMarker(mapID, detection, point) {
    var colour = poseColourFor(detection)
    var marker = L.circleMarker(posePointLatLng(mapID, point), {
        radius: 6,
        color: colour.edge,
        weight: 1,
        fillColor: colour.fill,
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
            var nextX = Math.max(0, Math.min(1, latlng.lng / mapWidth[mapID]))
            var nextY = Math.max(0, Math.min(1, latlng.lat / mapHeight[mapID]))
            if (Math.abs(nextX - point.x) > 1e-4 || Math.abs(nextY - point.y) > 1e-4) {
                point.x = nextX
                point.y = nextY
                if (point.source !== 'user') point.source = 'user_edited'
                poseMarkPointsPending(detection)
            }
            marker.setLatLng(posePointLatLng(mapID, point))
            poseUpdateLines(mapID)
        }
        map[mapID].on('mousemove', move)
        map[mapID].on('mouseup', up)
    })
    marker.on('click', function() {
        if (!poseDeleteMode) return
        point.pendingDelete = !point.pendingDelete
        marker.setStyle({fillColor: point.pendingDelete ? '#888888' : poseColourFor(detection).fill, fillOpacity: point.pendingDelete ? 0.35 : 1})
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
            poseMarkPointsPending(detection)
            changed = true
        }
    }
    if (changed) {
        poseRefresh()
        poseSave(false)
    }
}

function poseClearDeleteMarks() {
    var image = poseCurrentImage()
    if (!image || !poseMarkers) return
    for (var i = 0; i < image.detections.length; i++) {
        (image.detections[i].keypoints || []).forEach(function(point) { point.pendingDelete = false })
    }
    poseMarkers.eachLayer(function(layer) {
        if (layer.posePoint) layer.setStyle({fillColor: poseColourFor(layer.poseDetection).fill, fillOpacity: 1})
    })
}

function poseMapContext(event) {
    if (!isPoseReview() || poseReviewMode !== 'pose') return
    var image = poseCurrentImage()
    if (!image || mapWidth['map1'] == null) return
    var detection = poseSelectedDetection()
    if (!detection || detection.unusable) return
    var x = event.latlng.lng / mapWidth['map1']
    var y = event.latlng.lat / mapHeight['map1']
    if (x < detection.left || x > detection.right || y < detection.top || y > detection.bottom) return
    L.DomEvent.preventDefault(event)
    var present = {}
    ;(detection.keypoints || []).forEach(function(point) { present[point.name] = true })
    poseMenuOpen = true
    map['map1'].contextmenu.removeAllItems()
    var missing = POSE_POINT_NAMES.filter(function(name) { return !present[name] })
    if (missing.length === 0) {
        map['map1'].contextmenu.addItem({
            text: 'All keypoints are present',
            callback: function() {}
        })
    } else {
        missing.forEach(function(name) {
            map['map1'].contextmenu.addItem({
                text: name,
                callback: function(chosen, det, px, py) {
                    return function() { poseCreatePoint(det, chosen, px, py) }
                }(name, detection, x, y)
            })
        })
    }
    map['map1'].contextmenu.showAt(event.containerPoint)
}

function poseHotkeyUnusable() {
    if (!isPoseReview() || poseReviewMode !== 'pose') return
    var modal = $('#modalPoseUnusable')
    if (modal.length && modal.is(':visible')) {
        poseConfirmUnusable()
        modal.modal('hide')
        return
    }
    var detection = poseSelectedDetection()
    if (!detection) return
    if (detection.unusable) poseUndoUnusable(detection)
    else modal.modal('show')
}

function poseUpdateDrawTool() {
    if (typeof drawControl === 'undefined' || !drawControl || !drawControl._toolbars || !drawControl._toolbars.draw) return
    var toolbar = drawControl._toolbars.draw
    var container = toolbar._toolbarContainer
    if (!container) return
    var hide = isPoseReview() && poseReviewMode === 'pose'
    container.style.display = hide ? 'none' : ''
    if (hide && toolbar._activeMode && toolbar._activeMode.handler) toolbar._activeMode.handler.disable()
}

function poseFreezeBoxes(mapID) {
    if (!isPoseReview() || poseReviewMode !== 'pose' || !drawnItems[mapID]) return
    drawnItems[mapID].eachLayer(function(layer) {
        if (layer.editing && layer.editing.enabled && layer.editing.enabled()) layer.editing.disable()
    })
    var toolbar = (typeof drawControl !== 'undefined' && drawControl && drawControl._toolbars) ? drawControl._toolbars.edit : null
    var handler = toolbar && toolbar._activeMode ? toolbar._activeMode.handler : null
    if (!handler) return
    if (handler._disableLayerDelete) {
        drawnItems[mapID].eachLayer(function(layer) { handler._disableLayerDelete(layer) })
    }
    if (!handler._poseIgnoreBoxes && handler.removeAllLayers) {
        handler._poseIgnoreBoxes = true
        var removeAllLayers = handler.removeAllLayers
        handler.removeAllLayers = function() {
            if (isPoseReview() && poseReviewMode === 'pose') return
            return removeAllLayers.apply(this, arguments)
        }
    }
}

function poseCornerCursors() {
    if (!drawnItems['map1']) return
    drawnItems['map1'].eachLayer(function(layer) {
        if (!layer.editing || !layer.editing._resizeMarkers || !layer.getBounds) return
        var bounds = layer.getBounds()
        layer.editing._resizeMarkers.forEach(function(marker) {
            if (!marker._icon || !marker.getLatLng) return
            var latlng = marker.getLatLng()
            var north = Math.abs(latlng.lat - bounds.getNorth()) <= Math.abs(latlng.lat - bounds.getSouth())
            var west = Math.abs(latlng.lng - bounds.getWest()) <= Math.abs(latlng.lng - bounds.getEast())
            marker._icon.style.cursor = (north === west) ? 'nwse-resize' : 'nesw-resize'
        })
    })
}

function poseCreatePoint(detection, name, x, y) {
    if (!detection || detection.unusable) return
    if (!detection.keypoints) detection.keypoints = []
    detection.keypoints.push({name: name, x: x, y: y, score: null, source: 'user'})
    poseMarkPointsPending(detection)
    poseSelectedId = detection.id
    poseRefresh()
    poseSave(false)
}

function poseSetSpecies(label) {
    var detection = poseSelectedDetection()
    if (!detection) return
    var mapID = 'map1'
    if (drawnItems[mapID]) {
        for (var leafletID in drawnItems[mapID]._layers) {
            if (String(dbDetIds[mapID][leafletID]) !== String(detection.id)) continue
            var layer = drawnItems[mapID]._layers[leafletID]
            if (!layer.getTooltip()) {
                layer.bindTooltip(label, {permanent: true, direction: 'center'})
                var bounds = layer.getBounds()
                var center = bounds.getCenter()
                var bottom = L.latLng(bounds.getSouth(), center.lng)
                var offsetY = map[mapID].latLngToContainerPoint(center).y - map[mapID].latLngToContainerPoint(bottom).y
                layer.getTooltip().options.offset = [0, offsetY]
                layer.getTooltip().options.opacity = 0.8
            } else {
                layer.setTooltipContent(label)
            }
            if (typeof toolTipsOpen === 'undefined' || toolTipsOpen) layer.openTooltip()
        }
    }
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

function poseSubmitImage() {
    if (!isPoseReview() || poseSubmitting) return
    if (typeof editingEnabled !== 'undefined' && editingEnabled) return
    poseSave(true)
}

function poseSave(submitImage) {
    if (!isPoseReview()) return
    if (submitImage && poseSubmitting) return
    var image = poseCurrentImage()
    var cluster = clusters['map1'][clusterIndex['map1']]
    if (!image || !cluster || String(cluster.id).indexOf('-') === 0) return
    var edits = {}
    for (var i = 0; i < image.detections.length; i++) {
        var detection = image.detections[i]
        if (!detection.poseDirty && !submitImage) continue
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
    if (Object.keys(edits).length === 0 && !submitImage) return
    var lastImage = imageIndex['map1'] >= cluster.images.length - 1
    if (submitImage) poseSubmitting = true
    var seq = ++poseSaveSeq
    for (var id in edits) {
        for (var m = 0; m < image.detections.length; m++) {
            if (String(image.detections[m].id) !== String(id)) continue
            if (image.detections[m].unusable) continue
            image.detections[m]._recalculating = true
            image.detections[m]._saveSeq = seq
        }
    }
    poseShowMeasurements(poseSelectedDetection())
    var formData = new FormData()
    formData.append('detections', JSON.stringify(edits))
    formData.append('image_width', imagePixelWidth['map1'])
    formData.append('image_height', imagePixelHeight['map1'])
    formData.append('cluster_id', JSON.stringify(cluster.id))
    formData.append('image_id', image.id)
    formData.append('submit_image', submitImage ? 'true' : 'false')
    formData.append('last_image', lastImage ? 'true' : 'false')
    var xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function(savedSeq, savedSubmit, savedLast) {
        return function() {
            if (this.readyState != 4) return
            if (savedSubmit) poseSubmitting = false
            if (this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
            } else if (this.status == 200) {
                var reply = JSON.parse(this.responseText)
                var imageNow = poseCurrentImage()
                if (reply.measurements && imageNow) {
                    for (var n = 0; n < imageNow.detections.length; n++) {
                        if (imageNow.detections[n]._saveSeq !== savedSeq) continue
                        var fresh = reply.measurements[imageNow.detections[n].id]
                        if (!fresh) fresh = reply.measurements[String(imageNow.detections[n].id)]
                        imageNow.detections[n]._recalculating = false
                        if (!fresh) continue
                        imageNow.detections[n].shoulder_height = fresh.shoulder_height
                        imageNow.detections[n].back_length = fresh.back_length
                        imageNow.detections[n]._committedFlank = poseCanonicalFlank(imageNow.detections[n].flank)
                        imageNow.detections[n]._flankPending = false
                        imageNow.detections[n]._pointsPending = false
                        imageNow.detections[n]._measuresPending = false
                    }
                    poseShowMeasurements(poseSelectedDetection())
                    poseUpdateLines('map1')
                }
                if (savedSubmit) {
                    if (reply.progress) updateProgBar(reply.progress)
                    if (savedLast) nextCluster('map1')
                    else {
                        imageIndex['map1'] = imageIndex['map1'] + 1
                        update('map1')
                    }
                }
            }
        }
    }(seq, submitImage, lastImage)
    xhttp.open('POST', '/savePoseReview')
    xhttp.send(formData)
}
