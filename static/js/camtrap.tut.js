// Copyright 2022

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

isTagging = true
isReviewing = false
isKnockdown = false
isBounding = false
isIDing = false

var clusterIdx = 0;
var clisterIdList = []
const modalNote = $('#modalNote');

function loadNewCluster(mapID = 'map1') {
    /** load fixed clusters from tut_cluster_list */
    var newID = Math.floor(Math.random() * 100000) + 1;
    clusterRequests[mapID].push(newID);

    if (!batchComplete) {
        if (clusterIdx >= tut_cluster_list.length) {
            return;
        }
        info = tut_cluster_list[clusterIdx++];

        newcluster = info.info;

        if (!clisterIdList.includes(newcluster.id)) {
            clisterIdList.push(newcluster.id)
            clusters[mapID].push(newcluster)
            if (clusters[mapID].length - 1 == clusterIndex[mapID]) {
                updateCanvas()
                updateButtons()
            } else if (knockWait == true) {
                if (modalWait2.is(':visible')) {
                    modalWait2.modal('hide');
                }
                nextCluster()
            }
            preload()
            knockWait = false
        } else {
            loadNewCluster()
        }
    }
}

function getKeys() {
    /** Loads the buttons from a pre-defined list. */
    if (!isBounding) {
        initKeys(cluster_keys);
    }
}

/* Compatibility with camtrap.tag.js */
function knockdown() {}
function UndoKnockDown(label) {}
function sendNote() {
    tutProcessUserInput("sendNote");
}

function Notes() {
    /** Submits the note, or closes the modal if empty. */
    if (modalNote.is(':visible')) {
        sendNote()
    } else {
        document.getElementById("notebox").value = ''
        modalNote.modal({ keyboard: true });
    }
}

window.addEventListener('load', onload, false);

btnDone.addEventListener('click', () => {
    /** Wraps up the user's session when they click the done button. */
    window.location.replace("done")
});

// Handles the modalActive status
modalWait.on('shown.bs.modal', function () {
    modalActive = true;
});
modalWait.on('hidden.bs.modal', function () {
    modalActive = false;
});
modalNote.on('shown.bs.modal', function () {
    /** Additionally forces focus on the note box when opened. */
    modalActive = true;
    document.getElementById('notebox').focus()
    document.getElementById('notebox').select()
});
modalNote.on('hidden.bs.modal', function () {
    /** Additionally clears the note box on close. */
    modalActive = false;
    document.getElementById('notif').innerHTML = ""
});