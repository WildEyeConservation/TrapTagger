// Pose review on the existing annotation page. Tagging level -9,<label id>.

var poseReviewMode = 'pose'
var poseSelectedId = null
var poseMarkers = null
var poseContextBound = false
var poseSaveSeq = 0
var poseKeepView = false
var poseSubmitting = false
var poseHotkeyNames = []
var poseLastImageId = null
var poseMenuOpen = false
var poseUnusableScope = 'detection'
var poseMarkerContext = null
var POSE_SKELETON_COLOUR = '#A9C8F5'
var POSE_POINT_COLOURS = {
    left_eye: {fill: '#1A69DF', edge: '#0B3F86'},
    right_eye: {fill: '#2E8B57', edge: '#145C32'},
    nose: {fill: '#C43B6E', edge: '#7A2044'},
    neck: {fill: '#7B3FA0', edge: '#4A2266'},
    tail: {fill: '#B8860B', edge: '#6E5006'},
    left_shoulder: {fill: '#0E8A8A', edge: '#085858'},
    left_elbow: {fill: '#3D85C6', edge: '#1C4E78'},
    left_front_paw: {fill: '#6AA84F', edge: '#38761D'},
    right_shoulder: {fill: '#E69138', edge: '#B45F06'},
    right_elbow: {fill: '#A64D79', edge: '#741B47'},
    right_front_paw: {fill: '#45818E', edge: '#134F5C'},
    left_hip: {fill: '#3C78D8', edge: '#1155CC'},
    left_knee: {fill: '#76A5AF', edge: '#45818E'},
    left_back_paw: {fill: '#93C47D', edge: '#6AA84F'},
    right_hip: {fill: '#F6B26B', edge: '#E69138'},
    right_knee: {fill: '#D5A6BD', edge: '#A64D79'},
    right_back_paw: {fill: '#9FC5E8', edge: '#6FA8DC'},
    shoulder_top: {fill: '#FF6D01', edge: '#B34700'}
}
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
var POSE_FLANKS = ['Left', 'Ambiguous', 'Right']

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
    mode.add(new Option('Pose Keypoints', 'pose'))
    mode.add(new Option('Species Labelling', 'species'))
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
    flankRow.style.display = 'flex'
    flankRow.style.gap = '4px'
    POSE_FLANKS.forEach(function(name) {
        var button = document.createElement('button')
        button.type = 'button'
        button.id = 'poseFlank' + name
        button.innerHTML = name === 'Ambiguous' ? 'Ambiguous (A)' : (name + ' (' + name.charAt(0) + ')')
        button.className = 'btn btn-sm'
        button.style.flex = '1'
        button.style.padding = '4px 2px'
        button.style.fontSize = '85%'
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
        else poseShowUnusableModal('detection')
    })
    divBtns.appendChild(unusable)

    var imageUnusable = document.createElement('button')
    imageUnusable.id = 'poseImageUnusableButton'
    imageUnusable.className = 'btn btn-danger btn-block btn-sm'
    imageUnusable.style.marginTop = '3px'
    imageUnusable.innerHTML = 'Mark Image Unusable'
    imageUnusable.addEventListener('click', function(event) {
        event.preventDefault()
        event.stopPropagation()
        poseShowUnusableModal('image')
    })
    divBtns.appendChild(imageUnusable)

    var clusterUnusable = document.createElement('button')
    clusterUnusable.id = 'poseClusterUnusableButton'
    clusterUnusable.className = 'btn btn-danger btn-block btn-sm'
    clusterUnusable.style.marginTop = '3px'
    clusterUnusable.innerHTML = 'Mark Cluster Unusable'
    clusterUnusable.addEventListener('click', function(event) {
        event.preventDefault()
        event.stopPropagation()
        poseShowUnusableModal('cluster')
    })
    divBtns.appendChild(clusterUnusable)

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
    poseEnsureLegend()
    poseUpdateDrawTool()
    poseLayoutNav()
}

function poseEnsureLegend() {
    var host = document.getElementById('poseLegendHost')
    if (!host) return
    host.style.paddingTop = '40px'
    host.style.paddingLeft = '4px'
    host.style.fontSize = '75%'
    host.style.lineHeight = '1.35'
    host.style.color = '#dee2e6'
    var html = '<div style="font-weight:600;margin-bottom:6px;">Keypoints</div>'
    POSE_POINT_NAMES.forEach(function(name) {
        var colour = poseColourForName(name)
        html += '<div style="display:flex;align-items:center;margin-bottom:3px;">'
            + '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;'
            + 'background:' + colour.fill + ';border:1px solid ' + colour.edge + ';margin-right:6px;flex-shrink:0;"></span>'
            + '<span style="word-break:break-word;">' + name + '</span></div>'
    })
    host.innerHTML = html
    host.style.display = (isPoseReview() && poseReviewMode === 'pose') ? 'block' : 'none'
}

function poseLayoutNav() {
    ;['backImage', 'prevImage', 'forwardImage'].forEach(function(id) {
        var button = document.getElementById(id)
        if (button && button.parentElement) button.parentElement.style.display = 'none'
    })

    var back = document.getElementById('prevCluster')
    var next = document.getElementById('nextImage')
    if (back) {
        back.innerHTML = '<span style="font-size:100%">&#x276e;</span> Previous Image'
        back.className = 'btn btn-primary btn-block'
        back.onclick = function() { poseBack() }
        if (back.parentElement) back.parentElement.className = 'col-lg-2'
    }
    if (next) {
        next.innerHTML = 'Next Image <span style="font-size:100%">&#x276f;</span>'
        next.className = 'btn btn-primary btn-block'
        next.onclick = function() { nextImage() }
        if (next.parentElement) next.parentElement.className = 'col-lg-2'
    }

    var prevDet = document.getElementById('posePrevDetection')
    var nextDet = document.getElementById('poseNextDetection')
    if (!prevDet && back && back.parentElement && back.parentElement.parentElement) {
        var row = back.parentElement.parentElement
        var prevWrap = document.createElement('div')
        prevWrap.className = 'col-lg-2'
        prevWrap.id = 'posePrevDetectionWrap'
        prevDet = document.createElement('button')
        prevDet.id = 'posePrevDetection'
        prevDet.type = 'button'
        prevDet.className = 'btn btn-secondary btn-block'
        prevDet.innerHTML = '<span style="font-size:100%">&#x276e;</span> Previous Detection ([)'
        prevWrap.appendChild(prevDet)

        var nextWrap = document.createElement('div')
        nextWrap.className = 'col-lg-2'
        nextWrap.id = 'poseNextDetectionWrap'
        nextDet = document.createElement('button')
        nextDet.id = 'poseNextDetection'
        nextDet.type = 'button'
        nextDet.className = 'btn btn-secondary btn-block'
        nextDet.innerHTML = 'Next Detection (]) <span style="font-size:100%">&#x276f;</span>'
        nextWrap.appendChild(nextDet)

        row.insertBefore(nextWrap, next ? next.parentElement : null)
        row.insertBefore(prevWrap, nextWrap)
    }
    if (prevDet) prevDet.onclick = function() { posePrevDetection() }
    if (nextDet) nextDet.onclick = function() { poseNextDetection() }

    var count = document.getElementById('poseDetectionCount')
    if (!count) {
        var navRow = back && back.parentElement ? back.parentElement.parentElement : null
        if (navRow && navRow.parentElement) {
            var countRow = document.createElement('div')
            countRow.className = 'row justify-content-center'
            countRow.id = 'poseDetectionCountRow'
            countRow.style.marginTop = '2px'
            var countCol = document.createElement('div')
            countCol.className = 'col-lg-12'
            countCol.style.textAlign = 'right'
            countCol.style.paddingRight = '18%'
            count = document.createElement('div')
            count.id = 'poseDetectionCount'
            count.style.fontSize = '90%'
            count.style.fontWeight = '600'
            count.innerHTML = 'Detection - / -'
            countCol.appendChild(count)
            countRow.appendChild(countCol)
            navRow.parentElement.insertBefore(countRow, navRow.nextSibling)
        }
    }
    poseUpdateDetectionCount()
}

function poseUpdateDetectionCount() {
    var node = document.getElementById('poseDetectionCount')
    if (!node) return
    var dets = poseOrderedDetections()
    var index = poseSelectedIndex()
    if (!dets.length || index < 0) node.innerHTML = 'Detection - / -'
    else node.innerHTML = 'Detection ' + (index + 1) + ' / ' + dets.length
}

function poseOrderedDetections() {
    var image = poseCurrentImage()
    if (!image || !image.detections) return []
    return image.detections.filter(function(detection) {
        return detection && detection.active !== false
    }).slice().sort(function(a, b) {
        var leftDiff = (a.left || 0) - (b.left || 0)
        if (leftDiff !== 0) return leftDiff
        return String(a.id).localeCompare(String(b.id))
    })
}

function poseSelectedIndex() {
    var dets = poseOrderedDetections()
    for (var i = 0; i < dets.length; i++) {
        if (String(dets[i].id) === String(poseSelectedId)) return i
    }
    return -1
}

function poseEnsureSelection(forceLeftmost) {
    var dets = poseOrderedDetections()
    if (!dets.length) {
        poseSelectedId = null
        return
    }
    if (forceLeftmost) {
        poseSelectedId = dets[0].id
        return
    }
    if (poseSelectedId != null) {
        for (var i = 0; i < dets.length; i++) {
            if (String(dets[i].id) === String(poseSelectedId)) return
        }
    }
    poseSelectedId = dets[0].id
}

function poseSelectByIndex(index) {
    var dets = poseOrderedDetections()
    if (!dets.length) return
    if (index < 0) index = dets.length - 1
    if (index >= dets.length) index = 0
    poseSelectedId = dets[index].id
    poseShowMeasurements(poseSelectedDetection())
    poseUpdateDetectionCount()
    poseRedrawPoseLayers('map1')
}

function poseRedrawPoseLayers(mapID) {
    if (!isPoseReview() || mapID !== 'map1') return
    if (poseMarkers) {
        map[mapID].removeLayer(poseMarkers)
        poseMarkers = null
    }
    posePaintBoxes(mapID)
    if (poseReviewMode !== 'pose') return
    poseMarkers = L.layerGroup().addTo(map[mapID])
    var detection = poseSelectedDetection()
    if (detection && !detection.unusable) {
        var points = detection.keypoints || []
        poseDrawSkeleton(mapID, detection, points)
        for (var p = 0; p < points.length; p++) {
            poseAddMarker(mapID, detection, points[p])
        }
    }
}

function posePrevDetection() {
    if (!isPoseReview() || poseSubmitting) return
    var index = poseSelectedIndex()
    if (index < 0) {
        poseEnsureSelection(true)
        poseSelectByIndex(0)
        return
    }
    poseSelectByIndex(index - 1)
}

function poseNextDetection() {
    if (!isPoseReview() || poseSubmitting) return
    var index = poseSelectedIndex()
    if (index < 0) {
        poseEnsureSelection(true)
        poseSelectByIndex(0)
        return
    }
    poseSelectByIndex(index + 1)
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
    var imageUnusable = document.getElementById('poseImageUnusableButton')
    var clusterUnusable = document.getElementById('poseClusterUnusableButton')
    var flankLabel = document.getElementById('poseFlankLabel')
    var flankRow = document.getElementById('poseFlankRow')
    var countRow = document.getElementById('poseDetectionCountRow')
    var prevWrap = document.getElementById('posePrevDetectionWrap')
    var nextWrap = document.getElementById('poseNextDetectionWrap')
    if (measurements) measurements.style.display = speciesMode ? 'none' : 'block'
    if (unusable) unusable.style.display = speciesMode ? 'none' : 'block'
    if (imageUnusable) imageUnusable.style.display = speciesMode ? 'none' : 'block'
    if (clusterUnusable) clusterUnusable.style.display = speciesMode ? 'none' : 'block'
    if (flankLabel) flankLabel.style.display = speciesMode ? 'none' : 'block'
    if (flankRow) flankRow.style.display = speciesMode ? 'none' : 'flex'
    if (countRow) countRow.style.display = 'block'
    if (prevWrap) prevWrap.style.display = 'block'
    if (nextWrap) nextWrap.style.display = 'block'
    poseEnsureLegend()
    poseKeepView = true
    addedDetections['map1'] = false
    addDetections('map1')
    poseKeepView = false
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
    if (name === 'a' || name === 'ambiguous') return 'Ambiguous'
    return 'None'
}

function poseCommittedFlank(detection) {
    if (!detection._committedFlank) detection._committedFlank = poseCanonicalFlank(detection.flank)
    return detection._committedFlank
}

function poseStyleFlank(detection) {
    var chosen = detection ? poseCanonicalFlank(detection.flank) : 'None'
    POSE_FLANKS.forEach(function(name) {
        var button = document.getElementById('poseFlank' + name)
        if (!button) return
        var selected = chosen === name
        button.style.background = selected ? '#DF691A' : '#ffffff'
        button.style.color = selected ? '#ffffff' : '#333333'
        button.style.border = '1px solid ' + (selected ? '#DF691A' : '#cccccc')
    })
}

function poseShowUnusableModal(scope) {
    poseUnusableScope = scope || 'detection'
    var modal = document.getElementById('modalPoseUnusable')
    var title = modal ? modal.querySelector('.modal-title') : null
    var body = modal ? modal.querySelector('.modal-body p') : null
    var confirm = document.getElementById('btnPoseUnusableConfirm')
    if (poseUnusableScope === 'image') {
        if (title) title.innerHTML = 'Mark Image Unusable'
        if (body) body.innerHTML = 'This will delete all pose keypoints for every sighting on this image, and their shoulder heights and back lengths. They cannot be restored after this is saved.'
        if (confirm) confirm.innerHTML = 'Mark Image Unusable'
    } else if (poseUnusableScope === 'cluster') {
        if (title) title.innerHTML = 'Mark Cluster Unusable'
        if (body) body.innerHTML = 'This will delete all pose keypoints for every sighting in this cluster, and their shoulder heights and back lengths. They cannot be restored after this is saved.'
        if (confirm) confirm.innerHTML = 'Mark Cluster Unusable'
    } else {
        if (title) title.innerHTML = 'Mark Unusable'
        if (body) body.innerHTML = 'This will delete all pose keypoints for this sighting, and its shoulder height and back length. They cannot be restored after this is saved.'
        if (confirm) confirm.innerHTML = 'Mark Unusable (U)'
    }
    $('#modalPoseUnusable').modal('show')
}

function poseConfirmUnusable() {
    if (poseUnusableScope === 'image') {
        poseMarkDetectionsUnusable(poseOrderedDetections())
        return
    }
    if (poseUnusableScope === 'cluster') {
        var cluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
        var dets = []
        if (cluster && cluster.images) {
            for (var i = 0; i < cluster.images.length; i++) {
                var image = cluster.images[i]
                if (!image || !image.detections) continue
                for (var d = 0; d < image.detections.length; d++) {
                    if (image.detections[d] && image.detections[d].active !== false) dets.push(image.detections[d])
                }
            }
        }
        poseMarkDetectionsUnusable(dets)
        return
    }
    var detection = poseSelectedDetection()
    if (!detection || detection.unusable) return
    poseMarkDetectionsUnusable([detection])
}

function poseMarkDetectionsUnusable(detections) {
    if (!detections || !detections.length) return
    for (var i = 0; i < detections.length; i++) {
        var detection = detections[i]
        if (!detection || detection.unusable) continue
        detection.unusable = true
        detection.keypoints = []
        detection.shoulder_height = 0
        detection.back_length = 0
        detection._measuresPending = false
        detection._pointsPending = false
        detection._flankPending = false
        detection.poseDirty = true
    }
    poseShowMeasurements(poseSelectedDetection())
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
    poseUpdateDetectionCount()
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
    // Pose mode always keeps a selected detection; only species mode may clear.
    if (isPoseReview() && poseReviewMode === 'pose') return
    poseSelectedId = null
    poseShowMeasurements(null)
    poseUpdateDetectionCount()
}

function poseColourForName(name) {
    return POSE_POINT_COLOURS[name] || {fill: '#1A69DF', edge: '#0B3F86'}
}

function posePaintBoxes(mapID) {
    if (!isPoseReview() || !drawnItems[mapID]) return
    var image = poseCurrentImage()
    if (!image) return
    var poseMode = poseReviewMode === 'pose'
    for (var leafletID in drawnItems[mapID]._layers) {
        var layer = drawnItems[mapID]._layers[leafletID]
        var detection = null
        for (var d = 0; d < image.detections.length; d++) {
            if (String(image.detections[d].id) === String(dbDetIds[mapID][leafletID])) detection = image.detections[d]
        }
        if (!detection) continue
        var selected = String(detection.id) === String(poseSelectedId)
        if (poseMode && !selected) {
            layer.setStyle({color: colourBase, weight: 0, opacity: 0, fillOpacity: 0, dashArray: null})
            if (layer._path) layer._path.style.pointerEvents = 'none'
            continue
        }
        if (layer._path) layer._path.style.pointerEvents = ''
        if (detection.unusable) {
            layer.setStyle({color: '#DF0000', weight: selected ? 5 : 4, opacity: 1, fillOpacity: 0, dashArray: null})
            continue
        }
        layer.setStyle({
            color: selected ? colourSelected : colourBase,
            weight: selected ? 5 : 3,
            opacity: 1,
            fillOpacity: 0,
            dashArray: null
        })
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

    var imageChanged = String(image.id) !== String(poseLastImageId)
    poseLastImageId = image.id
    poseEnsureSelection(imageChanged)
    poseShowMeasurements(poseSelectedDetection())
    poseUpdateDetectionCount()

    for (var leafletID in drawnItems[mapID]._layers) {
        var layer = drawnItems[mapID]._layers[leafletID]
        if (poseReviewMode === 'pose') {
            if (layer._showContextMenu) layer.off('contextmenu', layer._showContextMenu, layer)
            layer.on('contextmenu', function(event) {
                if (event.originalEvent) L.DomEvent.stop(event.originalEvent)
                // Let the map handler build the keypoint label menu inside the selected box.
            })
        }
        layer.on('click', function(id) {
            return function() {
                if (poseReviewMode === 'pose') return
                poseSelectedId = id
                poseShowMeasurements(poseSelectedDetection())
                poseUpdateDetectionCount()
                posePaintBoxes(mapID)
            }
        }(dbDetIds[mapID][leafletID]))
    }
    poseRedrawPoseLayers(mapID)
    if (!poseContextBound) {
        map[mapID].on('contextmenu', poseMapContext)
        poseContextBound = true
    }
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
            {color: POSE_SKELETON_COLOUR, weight: 2, interactive: false}
        )
        line.poseDetection = detection
        poseMarkers.addLayer(line)
    })
}

function poseUpdateLines(mapID) {
    if (!poseMarkers) return
    var detection = poseSelectedDetection()
    var lines = []
    poseMarkers.eachLayer(function(layer) {
        if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) lines.push(layer)
    })
    lines.forEach(function(line) { poseMarkers.removeLayer(line) })
    if (detection && !detection.unusable) {
        poseDrawSkeleton(mapID, detection, detection.keypoints || [])
    }
}

function poseAddMarker(mapID, detection, point) {
    var colour = poseColourForName(point.name)
    var baseRadius = 6
    var hoverRadius = 9
    var marker = L.circleMarker(posePointLatLng(mapID, point), {
        radius: baseRadius,
        color: colour.edge,
        weight: 1,
        fillColor: colour.fill,
        fillOpacity: 1
    })
    marker.bindTooltip(point.name, {permanent: false, direction: 'top'})
    marker.poseDetection = detection
    marker.posePoint = point
    marker.on('mouseover', function() {
        marker.setStyle({radius: hoverRadius})
        marker.setRadius(hoverRadius)
    })
    marker.on('mouseout', function() {
        marker.setStyle({radius: baseRadius})
        marker.setRadius(baseRadius)
    })
    marker.on('mousedown', function(event) {
        if (event.originalEvent && event.originalEvent.button !== 0) return
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
    marker.on('contextmenu', function(event) {
        L.DomEvent.stop(event)
        if (event.originalEvent) {
            L.DomEvent.stop(event.originalEvent)
            if (event.originalEvent.stopImmediatePropagation) event.originalEvent.stopImmediatePropagation()
        }
        poseMarkerContextMenu(event, detection, point)
    })
    poseMarkers.addLayer(marker)
}

function poseMarkerContextMenu(event, detection, point) {
    if (!isPoseReview() || poseReviewMode !== 'pose') return
    if (!detection || detection.unusable) return
    poseMenuOpen = true
    poseMarkerContext = {detection: detection, point: point}
    map['map1'].contextmenu.removeAllItems()
    map['map1'].contextmenu.addItem({
        text: 'Delete',
        callback: function() {
            poseDeletePoint(detection, point)
            poseMarkerContext = null
        }
    })
    map['map1'].contextmenu.addItem({separator: true})
    map['map1'].contextmenu.addItem({
        text: 'Change label',
        callback: function() {
            setTimeout(function() {
                poseShowLabelMenu(detection, point, event.containerPoint || map['map1'].latLngToContainerPoint(event.latlng))
            }, 10)
        }
    })
    map['map1'].contextmenu.showAt(event.containerPoint || map['map1'].latLngToContainerPoint(event.latlng))
}

function poseShowLabelMenu(detection, point, containerPoint) {
    poseMenuOpen = true
    map['map1'].contextmenu.removeAllItems()
    POSE_POINT_NAMES.forEach(function(name) {
        map['map1'].contextmenu.addItem({
            text: name,
            callback: function(chosen) {
                return function() {
                    poseChangePointLabel(detection, point, chosen)
                    poseMarkerContext = null
                }
            }(name)
        })
    })
    map['map1'].contextmenu.showAt(containerPoint)
}

function poseDeletePoint(detection, point) {
    if (!detection || !point) return
    detection.keypoints = (detection.keypoints || []).filter(function(item) { return item !== point })
    poseMarkPointsPending(detection)
    poseRefresh()
    poseSave(false)
}

function poseChangePointLabel(detection, point, name) {
    if (!detection || !point || !name) return
    if (point.name === name) return
    detection.keypoints = (detection.keypoints || []).filter(function(item) {
        return item === point || item.name !== name
    })
    point.name = name
    if (point.source !== 'user') point.source = 'user_edited'
    poseMarkPointsPending(detection)
    poseRefresh()
    poseSave(false)
}

function posePlaceOrMovePoint(detection, name, x, y) {
    if (!detection || detection.unusable || !name) return
    if (!detection.keypoints) detection.keypoints = []
    var existing = null
    for (var i = 0; i < detection.keypoints.length; i++) {
        if (detection.keypoints[i].name === name) {
            existing = detection.keypoints[i]
            break
        }
    }
    if (existing) {
        existing.x = x
        existing.y = y
        if (existing.source !== 'user') existing.source = 'user_edited'
    } else {
        detection.keypoints.push({name: name, x: x, y: y, score: null, source: 'user'})
    }
    poseMarkPointsPending(detection)
    poseSelectedId = detection.id
    poseRefresh()
    poseSave(false)
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
    poseMenuOpen = true
    poseMarkerContext = null
    map['map1'].contextmenu.removeAllItems()
    POSE_POINT_NAMES.forEach(function(name) {
        map['map1'].contextmenu.addItem({
            text: name,
            callback: function(chosen, det, px, py) {
                return function() { posePlaceOrMovePoint(det, chosen, px, py) }
            }(name, detection, x, y)
        })
    })
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
    else poseShowUnusableModal('detection')
}

function poseUpdateDrawTool() {
    var hide = isPoseReview() && poseReviewMode === 'pose'
    if (typeof drawControl !== 'undefined' && drawControl && drawControl._toolbars) {
        if (drawControl._toolbars.draw && drawControl._toolbars.draw._toolbarContainer) {
            drawControl._toolbars.draw._toolbarContainer.style.display = hide ? 'none' : ''
            if (hide && drawControl._toolbars.draw._activeMode && drawControl._toolbars.draw._activeMode.handler) {
                drawControl._toolbars.draw._activeMode.handler.disable()
            }
        }
        if (drawControl._toolbars.edit && drawControl._toolbars.edit._toolbarContainer) {
            drawControl._toolbars.edit._toolbarContainer.style.display = hide ? 'none' : ''
            if (hide && drawControl._toolbars.edit._activeMode && drawControl._toolbars.edit._activeMode.handler) {
                drawControl._toolbars.edit._activeMode.handler.disable()
            }
        }
    }
    var sendBack = document.getElementById('ctrlBtnSendBoundingBack')
    if (sendBack) {
        var bar = sendBack.closest ? sendBack.closest('.leaflet-bar') : sendBack.parentElement
        if (bar) bar.style.display = hide ? 'none' : ''
    }
    if (typeof sendBackBoundingMode !== 'undefined' && hide) sendBackBoundingMode = false
}

function poseCreatePoint(detection, name, x, y) {
    posePlaceOrMovePoint(detection, name, x, y)
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
    var dirtyImages = cluster.images || [image]
    for (var imgIdx = 0; imgIdx < dirtyImages.length; imgIdx++) {
        var img = dirtyImages[imgIdx]
        if (!img || !img.detections) continue
        for (var i = 0; i < img.detections.length; i++) {
            var detection = img.detections[i]
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
