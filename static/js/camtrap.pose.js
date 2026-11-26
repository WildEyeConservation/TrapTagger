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
var poseSelectLastOnImage = false
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

function isPoseExplore() {
    return isPoseReview() && typeof isReviewing !== 'undefined' && isReviewing
}

function buildPoseReviewPanel(res) {
    if (divBtns == null) return
    while (divBtns.firstChild) {
        divBtns.removeChild(divBtns.firstChild)
    }

    if (isPoseExplore()) {
        poseReviewMode = 'pose'
    } else {
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
    }

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
    flankRow.style.flexDirection = 'column'
    flankRow.style.gap = '2px'
    POSE_FLANKS.forEach(function(name) {
        var button = document.createElement('button')
        button.type = 'button'
        button.id = 'poseFlank' + name
        button.innerHTML = name === 'Ambiguous' ? 'Ambiguous (A)' : (name + ' (' + name.charAt(0) + ')')
        button.className = 'btn btn-sm btn-block'
        button.style.width = '100%'
        button.style.padding = '5px 8px'
        button.style.marginTop = '0'
        button.style.marginBottom = '0'
        button.style.fontSize = '110%'
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
    imageUnusable.innerHTML = 'Mark Image Unusable (I)'
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
    clusterUnusable.innerHTML = 'Mark Cluster Unusable (C)'
    clusterUnusable.addEventListener('click', function(event) {
        event.preventDefault()
        event.stopPropagation()
        poseShowUnusableModal('cluster')
    })
    divBtns.appendChild(clusterUnusable)

    if (!isPoseExplore()) {
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
    }

    if (!isPoseExplore()) {
        var skipImage = document.createElement('button')
        skipImage.id = 'poseSkipImage'
        skipImage.className = 'btn btn-danger btn-block btn-sm'
        skipImage.style.marginTop = '3px'
        skipImage.innerHTML = 'Skip Image (K)'
        skipImage.addEventListener('click', poseSkipImage)
        divBtns.appendChild(skipImage)

        var skip = document.createElement('button')
        skip.id = 'poseSkipCluster'
        skip.className = 'btn btn-danger btn-block btn-sm'
        skip.style.marginTop = '3px'
        skip.innerHTML = 'Skip Cluster (S)'
        skip.addEventListener('click', poseSkipCluster)
        divBtns.appendChild(skip)
    }

    switchToLabel = false
    poseEnsureLegend()
    poseUpdateDrawTool()
    poseLayoutNav()
    // Panel is built async with getKeys; first cluster may already be on screen.
    // Re-paint measurements so the initial detection is not left on the default '-'.
    poseShowMeasurements(poseSelectedDetection())
}

function poseEnsureLegend() {
    var host = document.getElementById('poseLegendHost')
    if (!host) return
    var html = '<div style="font-weight:700;margin-bottom:8px;font-size:120%;">Keypoints</div>'
    POSE_POINT_NAMES.forEach(function(name) {
        var colour = poseColourForName(name)
        html += '<div style="display:flex;align-items:center;margin-bottom:3px;min-width:0;font-size:100%;">'
            + '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;'
            + 'background:' + colour.fill + ';border:1px solid ' + colour.edge + ';margin-right:6px;flex-shrink:0;"></span>'
            + '<span style="white-space:normal;overflow-wrap:break-word;word-break:keep-all;min-width:0;flex:1;">' + name + '</span></div>'
    })
    host.innerHTML = html
    host.style.display = (isPoseReview() && poseReviewMode === 'pose') ? 'block' : 'none'
    if (map && map['map1'] && map['map1'].invalidateSize) {
        setTimeout(function() { map['map1'].invalidateSize() }, 0)
    }
}

function poseStyleNavButton(button) {
    if (!button) return
    button.style.whiteSpace = 'normal'
    button.style.lineHeight = '1.25'
    button.style.padding = '10px 8px'
    button.style.minHeight = '48px'
    button.style.height = 'auto'
    button.style.fontSize = '95%'
}

function poseStyleExploreDetButton(button) {
    if (!button) return
    button.className = 'btn btn-secondary btn-sm'
    button.style.cssText = 'width:auto; white-space:nowrap; margin:0; padding:6px 10px; line-height:1.5; height:auto; font-size:100%;'
}

function poseLayoutExploreNav() {
    var detRow = document.getElementById('poseDetectionNavRow')
    if (detRow) {
        // Half-width columns so Prev Detection right-aligns to Prev Image's right edge
        // (and may extend left past it), mirroring Next Detection under Next Image.
        detRow.style.display = (isPoseReview() && poseReviewMode === 'pose') ? '' : 'none'
        detRow.style.justifyContent = ''
        detRow.style.alignItems = ''
        detRow.style.flexWrap = ''
    }
    var prevWrap = document.getElementById('posePrevDetectionWrap')
    var nextWrap = document.getElementById('poseNextDetectionWrap')
    if (prevWrap) {
        prevWrap.className = 'col-lg-6'
        prevWrap.style.cssText = 'display:flex; justify-content:flex-end; padding-right:15px; padding-left:15px;'
    }
    if (nextWrap) {
        nextWrap.className = 'col-lg-6'
        nextWrap.style.cssText = 'display:flex; justify-content:flex-start; padding-left:15px; padding-right:15px;'
    }
    var prevDet = document.getElementById('posePrevDetection')
    var nextDet = document.getElementById('poseNextDetection')
    if (prevDet) {
        prevDet.innerHTML = '<span style="font-size:100%">&#x276e;</span> Previous Detection (Z)'
        prevDet.onclick = function() { posePrevDetection() }
        poseStyleExploreDetButton(prevDet)
    }
    if (nextDet) {
        nextDet.innerHTML = 'Next Detection (X) <span style="font-size:100%">&#x276f;</span>'
        nextDet.onclick = function() { poseNextDetection() }
        poseStyleExploreDetButton(nextDet)
    }
    // Match Next Detection width to Previous Detection (longer label).
    if (prevDet && nextDet) {
        prevDet.style.width = 'auto'
        nextDet.style.width = 'auto'
        var matched = Math.ceil(Math.max(prevDet.offsetWidth, nextDet.offsetWidth))
        if (matched > 0) {
            prevDet.style.width = matched + 'px'
            nextDet.style.width = matched + 'px'
        }
    }
    poseUpdateDetectionCount()
}

function poseLayoutNav() {
    if (isPoseExplore()) {
        poseLayoutExploreNav()
        return
    }

    ;['backImage', 'prevImage', 'forwardImage'].forEach(function(id) {
        var button = document.getElementById(id)
        if (button && button.parentElement) button.parentElement.style.display = 'none'
    })

    // Annotation uses one Back / one Next; hide the explore-style detection pair.
    ;['posePrevDetectionWrap', 'poseNextDetectionWrap'].forEach(function(id) {
        var wrap = document.getElementById(id)
        if (wrap) wrap.style.display = 'none'
    })

    var back = document.getElementById('prevCluster')
    var next = document.getElementById('nextImage')
    // Match sighting (box) correction: centred col-lg-3 buttons, not full-width stretch.
    if (back && back.parentElement && back.parentElement.parentElement) {
        back.parentElement.parentElement.className = 'row justify-content-center'
        back.parentElement.parentElement.style.cssText = ''
    }
    if (back) {
        back.innerHTML = 'Previous Detection (Z)'
        back.className = 'btn btn-secondary btn-block'
        back.onclick = function() { poseBack() }
        back.removeAttribute('style')
        if (back.parentElement) {
            back.parentElement.className = 'col-lg-3'
            back.parentElement.style.cssText = ''
        }
    }
    if (next) {
        next.innerHTML = 'Next Detection (X)'
        next.className = 'btn btn-primary btn-block'
        next.onclick = function() { poseNext() }
        next.removeAttribute('style')
        if (next.parentElement) {
            next.parentElement.className = 'col-lg-3'
            next.parentElement.style.cssText = ''
        }
    }

    var oldCountRow = document.getElementById('poseDetectionCountRow')
    if (oldCountRow && oldCountRow.parentElement) oldCountRow.parentElement.removeChild(oldCountRow)

    poseUpdateDetectionCount()
}

function poseClearExploreUi() {
    var detRow = document.getElementById('poseDetectionNavRow')
    if (detRow) detRow.style.display = 'none'
    var count = document.getElementById('poseDetectionCount')
    if (count) count.style.display = 'none'
    var note = document.getElementById('poseEmptyNote')
    if (note) note.style.display = 'none'
    var host = document.getElementById('poseLegendHost')
    if (host) {
        host.style.display = 'none'
        host.innerHTML = ''
    }
    if (map && map['map1'] && poseMarkers) {
        map['map1'].removeLayer(poseMarkers)
        poseMarkers = null
    }
    poseSelectedId = null
    poseLastImageId = null
    poseUpdateDrawTool()
    if (map && map['map1']) {
        addedDetections['map1'] = false
        addDetections('map1')
    }
}

function poseUpdateDetectionNavEnabled() {
    var dets = poseOrderedDetections()
    var enable = isPoseReview() && poseReviewMode === 'pose' && dets.length > 1
    ;['posePrevDetection', 'poseNextDetection'].forEach(function(id) {
        var button = document.getElementById(id)
        if (!button) return
        button.disabled = !enable
        if (enable) button.classList.remove('disabled')
        else button.classList.add('disabled')
    })
}

function poseUpdateEmptyNote(detection) {
    var note = document.getElementById('poseEmptyNote')
    if (!note) return
    var show = isPoseReview() && poseReviewMode === 'pose' && detection && !detection.unusable
        && (!detection.keypoints || !detection.keypoints.length)
    note.style.display = show ? 'block' : 'none'
}

function poseUpdateDetectionCount() {
    var node = document.getElementById('poseDetectionCount')
    if (!node) return
    var speciesMode = poseReviewMode === 'species'
    node.style.display = (!isPoseReview() || speciesMode) ? 'none' : 'block'
    var dets = poseOrderedDetections()
    poseUpdateDetectionNavEnabled()
    if (isPoseExplore()) {
        var detRow = document.getElementById('poseDetectionNavRow')
        if (detRow) detRow.style.display = (!speciesMode && isPoseReview()) ? '' : 'none'
    }
    if (!dets.length) {
        node.innerHTML = 'Detection 0 / 0'
        poseUpdateEmptyNote(null)
        return
    }
    var index = poseSelectedIndex()
    if (index < 0) {
        poseEnsureSelection(true)
        index = poseSelectedIndex()
    }
    if (index < 0) index = 0
    node.innerHTML = 'Detection ' + (index + 1) + ' / ' + dets.length
    poseUpdateEmptyNote(dets[index])
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
    if (!map[mapID]) return
    if (poseMarkers) {
        map[mapID].removeLayer(poseMarkers)
        poseMarkers = null
    }
    posePaintBoxes(mapID)
    if (poseReviewMode !== 'pose') return
    poseMarkers = L.layerGroup({pane: 'markerPane'}).addTo(map[mapID])
    var detection = poseSelectedDetection()
    if (detection && !detection.unusable) {
        var points = detection.keypoints || []
        poseDrawSkeleton(mapID, detection, points)
        for (var p = 0; p < points.length; p++) {
            poseAddMarker(mapID, detection, points[p])
        }
    }
    // Keep keypoints above detection rectangles after any box restyle.
    poseMarkers.eachLayer(function(marker) {
        if (marker.bringToFront) marker.bringToFront()
    })
}

function posePrevDetection() {
    // Explore-only: stay within the current image's detections.
    if (!isPoseReview() || poseSubmitting) return
    if (poseOrderedDetections().length <= 1) return
    var index = poseSelectedIndex()
    if (index < 0) {
        poseEnsureSelection(true)
        poseSelectByIndex(0)
        return
    }
    poseSelectByIndex(index - 1)
}

function poseNextDetection() {
    // Explore-only: stay within the current image's detections.
    if (!isPoseReview() || poseSubmitting) return
    if (poseOrderedDetections().length <= 1) return
    var index = poseSelectedIndex()
    if (index < 0) {
        poseEnsureSelection(true)
        poseSelectByIndex(0)
        return
    }
    poseSelectByIndex(index + 1)
}

function poseNext() {
    /** Annotation Next: next detection, then check+next image, then next cluster. */
    if (!isPoseReview() || isPoseExplore() || poseSubmitting) return
    if (typeof editingEnabled !== 'undefined' && editingEnabled) return
    if (typeof finishedDisplaying !== 'undefined' && finishedDisplaying['map1'] != true) return
    if (typeof modalActive !== 'undefined' && modalActive && !(typeof modalAlert !== 'undefined' && modalAlert.is(':visible'))) return
    if (typeof modalActive2 !== 'undefined' && modalActive2 && !(typeof modalAlert !== 'undefined' && modalAlert.is(':visible'))) return
    var cluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
    if (!cluster || ['-99', '-101', '-782'].indexOf(String(cluster.id)) !== -1) return

    var dets = poseOrderedDetections()
    var index = poseSelectedIndex()
    if (dets.length && index >= 0 && index < dets.length - 1) {
        poseSelectByIndex(index + 1)
        return
    }
    // Last detection (or no detections): mark image checked and advance.
    poseSave(true)
}

function poseBack() {
    /** Annotation Back: previous detection, then previous image (last det), then previous cluster. */
    if (!isPoseReview() || poseSubmitting) return
    if (typeof editingEnabled !== 'undefined' && editingEnabled) return
    if (typeof finishedDisplaying !== 'undefined' && finishedDisplaying['map1'] != true) return
    if (isPoseExplore()) {
        // Explore Back stays image-level; detection stepping uses Z/X.
        var exploreCluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
        if (!exploreCluster) return
        poseSave(false)
        if (imageIndex['map1'] > 0) {
            imageIndex['map1'] -= 1
            update('map1')
            return
        }
        if (clusterIndex['map1'] <= 0) return
        var explorePrev = clusters['map1'][clusterIndex['map1'] - 1]
        if (!explorePrev || ['-99', '-101', '-782'].indexOf(String(explorePrev.id)) !== -1) return
        clusterIndex['map1'] -= 1
        imageIndex['map1'] = explorePrev.images && explorePrev.images.length ? explorePrev.images.length - 1 : 0
        update('map1')
        return
    }

    var cluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
    if (!cluster) return
    poseSave(false)

    var dets = poseOrderedDetections()
    var index = poseSelectedIndex()
    if (dets.length && index > 0) {
        poseSelectByIndex(index - 1)
        return
    }

    if (imageIndex['map1'] > 0) {
        poseSelectLastOnImage = true
        imageIndex['map1'] -= 1
        update('map1')
        return
    }
    if (clusterIndex['map1'] <= 0) return
    var previous = clusters['map1'][clusterIndex['map1'] - 1]
    if (!previous || ['-99', '-101', '-782'].indexOf(String(previous.id)) !== -1) return
    poseSelectLastOnImage = true
    clusterIndex['map1'] -= 1
    imageIndex['map1'] = previous.images && previous.images.length ? previous.images.length - 1 : 0
    update('map1')
}

function poseRefresh() {
    var speciesMode = poseReviewMode === 'species'
    var speciesDiv = document.getElementById('poseSpeciesButtons')
    if (speciesDiv) speciesDiv.style.display = speciesMode ? 'block' : 'none'
    var skipImage = document.getElementById('poseSkipImage')
    var skip = document.getElementById('poseSkipCluster')
    if (skipImage) skipImage.style.display = (speciesMode || isPoseExplore()) ? 'none' : 'block'
    if (skip) skip.style.display = (speciesMode || isPoseExplore()) ? 'none' : 'block'
    var measurements = document.getElementById('poseMeasurements')
    var unusable = document.getElementById('poseUnusableButton')
    var imageUnusable = document.getElementById('poseImageUnusableButton')
    var clusterUnusable = document.getElementById('poseClusterUnusableButton')
    var flankLabel = document.getElementById('poseFlankLabel')
    var flankRow = document.getElementById('poseFlankRow')
    if (measurements) measurements.style.display = speciesMode ? 'none' : 'block'
    if (unusable) unusable.style.display = speciesMode ? 'none' : 'block'
    if (imageUnusable) imageUnusable.style.display = speciesMode ? 'none' : 'block'
    if (clusterUnusable) clusterUnusable.style.display = speciesMode ? 'none' : 'block'
    if (flankLabel) flankLabel.style.display = speciesMode ? 'none' : 'block'
    if (flankRow) {
        flankRow.style.display = speciesMode ? 'none' : 'flex'
        flankRow.style.flexDirection = 'column'
    }
    if (isPoseExplore()) {
        var detRow = document.getElementById('poseDetectionNavRow')
        if (detRow) detRow.style.display = speciesMode ? 'none' : ''
    } else {
        ;['posePrevDetectionWrap', 'poseNextDetectionWrap'].forEach(function(id) {
            var wrap = document.getElementById(id)
            if (wrap) wrap.style.display = 'none'
        })
    }
    poseUpdateDetectionCount()
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
    // Flank may be set even when the detection has no keypoints yet.
    var allow = !!(detection && !detection.unusable)
    POSE_FLANKS.forEach(function(name) {
        var button = document.getElementById('poseFlank' + name)
        if (!button) return
        button.disabled = !allow
        if (allow) button.classList.remove('disabled')
        else button.classList.add('disabled')
        var selected = allow && chosen === name
        button.style.background = selected ? '#DF691A' : '#ffffff'
        button.style.color = selected ? '#ffffff' : '#333333'
        button.style.border = '1px solid ' + (selected ? '#DF691A' : '#cccccc')
        button.style.opacity = allow ? '1' : '0.55'
        button.style.pointerEvents = allow ? '' : 'none'
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
        if (confirm) confirm.innerHTML = 'Mark Image Unusable (I)'
    } else if (poseUnusableScope === 'cluster') {
        if (title) title.innerHTML = 'Mark Cluster Unusable'
        if (body) body.innerHTML = 'This will delete all pose keypoints for every sighting in this cluster, and their shoulder heights and back lengths. They cannot be restored after this is saved.'
        if (confirm) confirm.innerHTML = 'Mark Cluster Unusable (C)'
    } else {
        if (title) title.innerHTML = 'Mark Unusable'
        if (body) body.innerHTML = 'This will delete all pose keypoints for this sighting, and its shoulder height and back length. They cannot be restored after this is saved.'
        if (confirm) confirm.innerHTML = 'Mark Unusable (U)'
    }
    $('#modalPoseUnusable').modal('show')
}

function poseConfirmUnusable() {
    // Image/cluster unusable: mark checked, then advance (explore stays put).
    if (poseUnusableScope === 'image') {
        poseMarkDetectionsUnusable(poseOrderedDetections(), true, isPoseExplore() ? null : 'nextImage')
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
        poseMarkDetectionsUnusable(dets, true, isPoseExplore() ? null : 'nextCluster')
        return
    }
    var detection = poseSelectedDetection()
    if (!detection || detection.unusable) return
    poseMarkDetectionsUnusable([detection], false, null)
}

function poseMarkDetectionsUnusable(detections, markChecked, after) {
    if (!detections || !detections.length) return
    for (var i = 0; i < detections.length; i++) {
        var detection = detections[i]
        if (!detection) continue
        if (!detection.unusable) {
            detection.unusable = true
            detection.keypoints = []
            detection.shoulder_height = 0
            detection.back_length = 0
            detection._measuresPending = false
            detection._pointsPending = false
            detection._flankPending = false
            detection.poseDirty = true
        }
        if (markChecked) {
            detection.pose_checked = true
            detection._checkOnSave = true
            detection.poseDirty = true
        }
    }
    poseShowMeasurements(poseSelectedDetection())
    poseRefresh()
    // Image unusable: submit+advance like finishing the image. Cluster: save then examine+next.
    if (after === 'nextImage') poseSave(true)
    else if (after === 'nextCluster') poseSave(false, {after: 'nextCluster'})
    else poseSave(false)
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
    // Flank-only edits are allowed with zero keypoints; only pending point edits require remeasure UI.
    detection._measuresPending = !!detection._pointsPending || (detection._flankPending && !!(detection.keypoints && detection.keypoints.length))
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
    poseUpdateEmptyNote(detection)
    if (typeof isReviewing !== 'undefined' && isReviewing && typeof updateDetInfo === 'function') {
        updateDetInfo(detection)
    }
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

function poseHideDetectionTooltip(layer) {
    if (!layer) return
    if (layer.getTooltip && layer.getTooltip()) {
        layer.closeTooltip()
        layer.unbindTooltip()
    }
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
        // In pose mode boxes are visual-only: permanent explore tooltips and box hit-targets
        // sit above keypoints and block hover / drag / right-click edit.
        if (poseMode) {
            poseHideDetectionTooltip(layer)
            if (layer._path) layer._path.style.pointerEvents = 'none'
            if (!selected) {
                layer.setStyle({color: colourBase, weight: 0, opacity: 0, fillOpacity: 0, dashArray: null})
                continue
            }
            if (detection.unusable) {
                layer.setStyle({color: '#DF0000', weight: 5, opacity: 1, fillOpacity: 0, dashArray: null})
            } else {
                layer.setStyle({
                    color: colourSelected,
                    weight: 5,
                    opacity: 1,
                    fillOpacity: 0,
                    dashArray: null
                })
            }
            continue
        }
        if (layer._path) layer._path.style.pointerEvents = ''
        layer.setStyle({
            color: selected ? colourSelected : colourBase,
            weight: selected ? 5 : 3,
            opacity: 1,
            fillOpacity: 0,
            dashArray: null
        })
    }
    if (poseMode && poseMarkers && map[mapID] && map[mapID].hasLayer(poseMarkers)) {
        poseMarkers.eachLayer(function(marker) {
            if (marker.bringToFront) marker.bringToFront()
        })
    }
}

function posePaintBoxesSoon(mapID) {
    posePaintBoxes(mapID)
    // Leaflet can drop an immediate setStyle right after layers are created; re-apply next frame.
    setTimeout(function() {
        if (isPoseReview() && poseReviewMode === 'pose') posePaintBoxes(mapID)
    }, 0)
    setTimeout(function() {
        if (isPoseReview() && poseReviewMode === 'pose') posePaintBoxes(mapID)
    }, 50)
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
    // Explore has no species sub-mode; always keep pose selection like annotation.
    if (isPoseExplore()) poseReviewMode = 'pose'
    poseEnsureSelection(imageChanged)
    if (poseSelectLastOnImage) {
        poseSelectLastOnImage = false
        var ordered = poseOrderedDetections()
        if (ordered.length) poseSelectByIndex(ordered.length - 1)
    }
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
    posePaintBoxesSoon(mapID)
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
    // User-placed/edited points are always trusted, even if an old model score remains.
    if (point.source === 'user' || point.source === 'user_edited') return true
    if (point.score == null || point.score === '') return true
    var score = Number(point.score)
    return !isNaN(score) && score >= 0.3
}

function poseMarkUserPoint(point) {
    if (!point) return
    if (point.source !== 'user') point.source = 'user_edited'
    // Drop stale model confidence so readiness / server measurement treat the point as usable.
    point.score = null
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
        fillOpacity: 1,
        interactive: true,
        bubblingMouseEvents: false
    })
    marker.bindTooltip(point.name, {
        permanent: false,
        direction: 'top',
        opacity: 0.95,
        sticky: true,
        interactive: false
    })
    marker.poseDetection = detection
    marker.posePoint = point
    marker.on('mouseover', function() {
        marker.setStyle({radius: hoverRadius})
        marker.setRadius(hoverRadius)
        if (marker.openTooltip) marker.openTooltip()
    })
    marker.on('mouseout', function() {
        marker.setStyle({radius: baseRadius})
        marker.setRadius(baseRadius)
        if (marker.closeTooltip) marker.closeTooltip()
    })
    marker.on('mousedown', function(event) {
        if (event.originalEvent && event.originalEvent.button !== 0) return
        L.DomEvent.stopPropagation(event)
        if (event.originalEvent) L.DomEvent.preventDefault(event.originalEvent)
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
                poseMarkUserPoint(point)
                poseMarkPointsPending(detection)
                poseSave(false)
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
    poseMarkUserPoint(point)
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
        poseMarkUserPoint(existing)
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

function poseHotkeyUnusable(scope) {
    if (!isPoseReview() || poseReviewMode !== 'pose') return
    var target = scope || 'detection'
    var modal = $('#modalPoseUnusable')
    if (modal.length && modal.is(':visible')) {
        if (!scope || poseUnusableScope === target) {
            poseConfirmUnusable()
            modal.modal('hide')
        }
        return
    }
    if (target === 'image' || target === 'cluster') {
        poseShowUnusableModal(target)
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

function poseSkipImage() {
    /** Leave current image's dets unchecked and advance to the next image (or skip cluster on the last image). */
    if (!isPoseReview() || isPoseExplore() || poseSubmitting) return
    if (typeof editingEnabled !== 'undefined' && editingEnabled) return
    if (typeof finishedDisplaying !== 'undefined' && finishedDisplaying['map1'] != true) return
    var cluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
    if (!cluster || ['-99', '-101', '-782'].indexOf(String(cluster.id)) !== -1) return
    poseSave(false)
    if (imageIndex['map1'] < cluster.images.length - 1) {
        imageIndex['map1'] += 1
        update('map1')
        return
    }
    poseSkipCluster()
}

function poseExamineAndNextCluster() {
    /** Mark the current cluster examined and move to the next one (no pose_checked changes). */
    var cluster = clusters['map1'] && clusters['map1'][clusterIndex['map1']]
    if (!cluster || ['-99', '-101', '-782'].indexOf(String(cluster.id)) !== -1) return
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

function poseSkipCluster() {
    /** Leave remaining dets unchecked, mark the cluster examined, and move on. */
    if (!isPoseReview() || isPoseExplore() || poseSubmitting) return
    var cluster = clusters['map1'][clusterIndex['map1']]
    if (!cluster || ['-99', '-101', '-782'].indexOf(String(cluster.id)) !== -1) return
    poseSave(false)
    poseExamineAndNextCluster()
}

function poseSaveOnLeave() {
    if (!isPoseReview()) return
    poseSave(false)
}

function poseSave(submitImage, options) {
    if (!isPoseReview()) return
    options = options || {}
    if (isPoseExplore()) {
        submitImage = false
        options = {}
    }
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
                var unusableEdit = {unusable: true}
                if (detection._checkOnSave) {
                    unusableEdit.pose_checked = true
                    detection._checkOnSave = false
                }
                edits[detection.id] = unusableEdit
            } else if (detection.poseDirty) {
                var edit = {}
                if (detection._flankPending || detection._pointsPending) {
                    if (detection._flankPending) edit.flank = detection.flank
                    if (detection._pointsPending) edit.keypoints = detection.keypoints || []
                } else {
                    edit.flank = detection.flank
                    edit.keypoints = detection.keypoints || []
                }
                // Flank-only is valid with zero keypoints; still send flank so Explore can set it first.
                if (edit.flank == null && detection.flank) edit.flank = detection.flank
                edits[detection.id] = edit
            }
            detection.poseDirty = false
        }
    }
    if (Object.keys(edits).length === 0 && !submitImage) {
        if (options.after === 'nextCluster') poseExamineAndNextCluster()
        return
    }
    var lastImage = imageIndex['map1'] >= cluster.images.length - 1
    if (submitImage || options.after === 'nextCluster') poseSubmitting = true
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
    formData.append('image_width', imagePixelWidth['map1'] || 0)
    formData.append('image_height', imagePixelHeight['map1'] || 0)
    formData.append('cluster_id', JSON.stringify(cluster.id))
    formData.append('image_id', image.id)
    formData.append('submit_image', submitImage ? 'true' : 'false')
    formData.append('last_image', lastImage ? 'true' : 'false')
    var xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function(savedSeq, savedSubmit, savedLast, afterAction) {
        return function() {
            if (this.readyState != 4) return
            if (savedSubmit || afterAction === 'nextCluster') poseSubmitting = false
            if (this.status == 278) {
                window.location.replace(JSON.parse(this.responseText)['redirect'])
                return
            }
            var imageNow = poseCurrentImage()
            var clearRecalc = function(ok, measurements) {
                if (!imageNow || !imageNow.detections) return
                for (var n = 0; n < imageNow.detections.length; n++) {
                    if (imageNow.detections[n]._saveSeq !== savedSeq) continue
                    imageNow.detections[n]._recalculating = false
                    if (!ok) continue
                    var fresh = null
                    if (measurements) {
                        fresh = measurements[imageNow.detections[n].id]
                        if (!fresh) fresh = measurements[String(imageNow.detections[n].id)]
                    }
                    if (fresh) {
                        imageNow.detections[n].shoulder_height = fresh.shoulder_height
                        imageNow.detections[n].back_length = fresh.back_length
                    }
                    imageNow.detections[n]._committedFlank = poseCanonicalFlank(imageNow.detections[n].flank)
                    imageNow.detections[n]._flankPending = false
                    imageNow.detections[n]._pointsPending = false
                    imageNow.detections[n]._measuresPending = false
                }
                poseShowMeasurements(poseSelectedDetection())
                poseUpdateLines('map1')
            }
            if (this.status == 200) {
                var reply = JSON.parse(this.responseText)
                clearRecalc(reply && reply.status !== 'error', reply && reply.measurements)
                if (afterAction === 'nextCluster') {
                    poseExamineAndNextCluster()
                    return
                }
                if (savedSubmit) {
                    if (reply.progress) updateProgBar(reply.progress)
                    if (savedLast) nextCluster('map1')
                    else {
                        imageIndex['map1'] = imageIndex['map1'] + 1
                        update('map1')
                    }
                }
            } else {
                clearRecalc(false, null)
            }
        }
    }(seq, submitImage, lastImage, options.after || null)
    xhttp.open('POST', '/savePoseReview')
    xhttp.send(formData)
}
