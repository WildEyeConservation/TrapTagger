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

isTagging = false
isReviewing = false
isKnockdown = false
isBounding = false
isIDing = false
isStaticCheck = false
isTimestampCheck = true

var total_timestamps = 0
var completed_timestamps = 0
var image_counts = {}
var clusterIdList = [];
var currentYear = new Date().getFullYear();
var timestampCheckPage = {}

const yearInput = document.getElementById('year');
const monthInput = document.getElementById('month');
const dayInput = document.getElementById('day');
const hourInput = document.getElementById('hour');
const minutesInput = document.getElementById('minutes');
const secondsInput = document.getElementById('seconds');

const modalCameraNoTimestamp =  $('#modalCameraNoTimestamp');

function loadNewCluster(mapID = 'map1') {
    /** Requests the next back of clusters from the server. */

    if (cameraReadAheadIndex < cameraIDs.length) {

        if (cameraReadAheadIndex == cameraIDs.length-1) {
            lastCamera = true 
        }else{
            lastCamera = false
        }

        var formData = new FormData();

        waitingForClusters[mapID] = true
        var newID = Math.floor(Math.random() * 100000) + 1;
        clusterRequests[mapID].push(newID)

        if (!batchComplete) {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 278) {
                        window.location.replace(JSON.parse(this.responseText)['redirect'])
                    } else if (this.readyState == 4 && this.status == 200) {
                        waitingForClusters[mapID] = false
                        info = JSON.parse(this.responseText);
                        // console.log(info)

                        if (info.images.length == 1 && info.images[0].id == '-101') {
                            window.location.replace("surveys")
                        }

                        if (clusterRequests[mapID].includes(parseInt(info.id))) {

                            for (let i=0;i<info.images.length;i++) {
                                newcluster = info.images[i];
                                if ((!clusterIdList.includes(newcluster.id))||(newcluster.id=='-101')||(!skippedCameras.includes(newcluster.camera_id))) {
                                    clusterIdList.push(newcluster.id)

                                    if ((clusters[mapID].length>0)&&(clusters[mapID][clusters[mapID].length-1].id=='-101')&&(clusterIndex[mapID] < clusters[mapID].length-1)) {
                                        clusters[mapID].splice(clusters[mapID].length-1, 0, newcluster)
                                    } else {
                                        clusters[mapID].push(newcluster)
                                        timestampCheckPage[newcluster.id].next_page = info.next_page
                                    }
                                    
                                    if (clusters[mapID].length-1 == clusterIndex[mapID]){
                                        update(mapID)
                                    } 
                                    preload()
                                
                                }
                            }

                            if (lastCamera && clusters[mapID].length == cameraIDs.length) {
                                clusters[mapID].push({'id': '-101'})
                            }
                        }                
                    }
                };
            xhttp.open("POST", '/getTimestampImages/' + selectedSurvey + '/' + newID + '?camera_id=' + cameraIDs[cameraReadAheadIndex++]);  
            xhttp.send(formData);
        }
    }
}

function getCameraIDs(mapID = 'map1'){
    /** Requests the image IDs from the server. */
    yearInput.focus()
    var formData = new FormData();
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                clusters[mapID]=[]
                cameraReadAheadIndex = 0
                clusterIndex[mapID] = 0
                imageIndex[mapID] = 0
                reply = JSON.parse(this.responseText);
                cameraIDs = reply.camera_ids
                image_counts = reply.image_counts
                total_timestamps = reply.total_image_count
                completed_timestamps = 0
                timestampCheckPage = {}

                if (cameraIDs.length == 0) {
                    window.location.replace("surveys")
                }
                else if (cameraIDs.length == 1 && cameraIDs[0] == '-101') {
                    finishTimestampCheck()
                }
                else{
                    for (let t=0;t<cameraIDs.length;t++){
                        timestampCheckPage[cameraIDs[t]] = {'page': 1, 'next_page': null}
                    }

                    updateProgBar([completed_timestamps,total_timestamps])
                    for (let i=0;i<3;i++){
                        loadNewCluster()
                    }
                }
            }
        };
    xhttp.open("POST", '/getTimestampCameraIDs/' + selectedSurvey);
    xhttp.send(formData);
}

function submitTimestamp(no_time = false, mapID = 'map1') {
    /** Submits the timestamps to the server. */

    if (modalCameraNoTimestamp.is(':visible')){
        modalCameraNoTimestamp.modal('hide')
    }

    var year = yearInput.value
    var month = monthInput.value
    var day = dayInput.value
    var hour = hourInput.value
    var minutes = minutesInput.value
    var seconds = secondsInput.value

    validTimestamp = true
    if (no_time){
        clearInputs()
    }
    else{

        if ((year!= '') && (year.length != 4 || isNaN(year) || parseInt(year) > currentYear || parseInt(year) < 1900)){
            validTimestamp = false
            document.getElementById('errorYear').innerHTML = 'Invalid year. Please try again.'
        }
        if ((month!= '') && (isNaN(month) || parseInt(month) > 12 || parseInt(month) < 1)){
            validTimestamp = false
            document.getElementById('errorMonth').innerHTML = 'Invalid month. Please try again.'
        }
        if ((day!= '') && (isNaN(day) || parseInt(day) > 31 || parseInt(day) < 1)){
            validTimestamp = false
            document.getElementById('errorDay').innerHTML = 'Invalid day. Please try again.'
        }
        if ((hour!= '') && (isNaN(hour) || parseInt(hour) > 23 || parseInt(hour) < 0)){
            validTimestamp = false
            document.getElementById('errorHour').innerHTML = 'Invalid hour. Please try again.'
        }
        if ((minutes!= '') && (isNaN(minutes) || parseInt(minutes) > 59 || parseInt(minutes) < 0)){
            validTimestamp = false
            document.getElementById('errorMinutes').innerHTML = 'Invalid minutes. Please try again.'
        }
        if ((seconds!= '') && (isNaN(seconds) || parseInt(seconds) > 59 || parseInt(seconds) < 0)){
            validTimestamp = false
            document.getElementById('errorSeconds').innerHTML = 'Invalid seconds. Please try again.'
        }

    }

    if (validTimestamp && finishedDisplaying[mapID] && !modalActive2 && !modalActive){
        var formData = new FormData();
        formData.append('image_id', JSON.stringify(clusters[mapID][clusterIndex[mapID]].images[imageIndex[mapID]].id));
        formData.append('survey_id', JSON.stringify(selectedSurvey));
        if (!no_time){
            var timestamp = ''
            var timestamp_format = ''
            if (year != ''){
                timestamp = year
                timestamp_format = '%Y'
            }
            if (month != ''){
                if (timestamp != ''){
                    timestamp += '-'
                    timestamp_format += '-'
                }
                timestamp += month
                timestamp_format += '%m'
            }
            if (day != ''){
                if (timestamp != ''){
                    timestamp += '-'
                    timestamp_format += '-'
                }
                timestamp += day
                timestamp_format += '%d'
            }
            if (hour != ''){
                if (timestamp != ''){
                    timestamp += ' '
                    timestamp_format += ' '
                }
                timestamp += hour
                timestamp_format += '%H'
            }
            if (minutes != ''){
                if (timestamp != ''){
                    timestamp += ':'
                    timestamp_format += ':'
                }
                timestamp += minutes
                timestamp_format += '%M'
            }
            if (seconds != ''){
                if (timestamp != ''){
                    timestamp += ':'
                    timestamp_format += ':'
                }
                timestamp += seconds
                timestamp_format += '%S'
            }

            if (timestamp != ''){
                formData.append('timestamp', JSON.stringify(timestamp));
                formData.append('timestamp_format', JSON.stringify(timestamp_format));
            }
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(wrapClusterIndex,wrapMapID){
            return function() {
                if (this.readyState == 4 && this.status == 278) {
                    window.location.replace(JSON.parse(this.responseText)['redirect'])
                } else if (this.readyState == 4 && this.status == 200) {                    
                    response = JSON.parse(this.responseText);
                    clusters[wrapMapID][wrapClusterIndex].ready = true
                    clusters[mapID][clusterIndex[mapID]].skipped = false
                }
            }
        }(clusterIndex[mapID],mapID);
        xhttp.open("POST", '/submitTimestamp');
        xhttp.send(formData)

        yearInput.focus()

        document.getElementById('errorYear').innerHTML = ''
        document.getElementById('errorMonth').innerHTML = ''
        document.getElementById('errorDay').innerHTML = ''
        document.getElementById('errorHour').innerHTML = ''
        document.getElementById('errorMinutes').innerHTML = ''
        document.getElementById('errorSeconds').innerHTML = ''

        completed_timestamps += 1
        updateProgBar([completed_timestamps,total_timestamps])
        if (imageIndex[mapID] < clusters[mapID][clusterIndex[mapID]].images.length-1){
            nextImage(mapID)
            if (timestampCheckPage[clusters[mapID][clusterIndex[mapID]].id].next_page != null){
                nextPageTimestamps(clusters[mapID][clusterIndex[mapID]].id,1)
            }
        } else {
            nextCluster(mapID)
        }
        prevClusterBtn.disabled = false

    } 
}

function undoTimestamp(mapID = 'map1') {
    /** Goes back to the previous cluster. */
    if (((clusterIndex[mapID] > 0) || (imageIndex[mapID] > 0)) && finishedDisplaying[mapID] && !modalActive2 && !modalActive){
        clearInputs()
        completed_timestamps -= 1
        updateProgBar([completed_timestamps,total_timestamps])
        if (imageIndex[mapID] > 0){
            prevImage(mapID)
        } else {
            prevCluster(mapID)
        }
    }
}

function clearInputs(){
    /** Clears the inputs. */
    yearInput.value = ''
    monthInput.value = ''
    dayInput.value = ''
    hourInput.value = ''
    minutesInput.value = ''
    secondsInput.value = ''
    yearInput.focus()
    document.getElementById('errorYear').innerHTML = ''
    document.getElementById('errorMonth').innerHTML = ''
    document.getElementById('errorDay').innerHTML = ''
    document.getElementById('errorHour').innerHTML = ''
    document.getElementById('errorMinutes').innerHTML = ''
    document.getElementById('errorSeconds').innerHTML = ''
}

function skipTimeUnit(back = false){
    /** SKips the current time unit  */

    if (yearInput == document.activeElement){
        back ? yearInput.focus() : monthInput.focus()
    }
    else if (monthInput == document.activeElement){
        back ? yearInput.focus() : dayInput.focus()
    }
    else if (dayInput == document.activeElement){
        back ? monthInput.focus() : hourInput.focus()
    }
    else if (hourInput == document.activeElement){
        back ? dayInput.focus() : minutesInput.focus()
    }
    else if (minutesInput == document.activeElement){
        back ? hourInput.focus() : secondsInput.focus()
    }
    else if (secondsInput == document.activeElement){
        back ? minutesInput.focus() : submitTimestamp()
    }
    else{
        yearInput.focus()
    }
    
}

function skipCamera(mapID = 'map1'){
    /** Skips the current camera. */
    if(finishedDisplaying[mapID] && !modalActive2 && !modalActive){
        if (modalCameraNoTimestamp.is(':visible')){
            cameragroup_id = clusters[mapID][clusterIndex[mapID]].id
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange =
                function () {
                    if (this.readyState == 4 && this.status == 200) {
                        // console.log(this.responseText)
                    }
                };
            xhttp.open("GET", '/skipTimestampCamera/' + selectedSurvey + '/' + cameragroup_id);
            xhttp.send();

            modalCameraNoTimestamp.modal('hide')

            image_count = image_counts[cameragroup_id]
            completed_timestamps += (image_count - imageIndex[mapID])
            updateProgBar([completed_timestamps,total_timestamps])
            clusters[mapID].splice(clusterIndex[mapID], 1)
            cameraIDs.splice(cameraIDs.indexOf(cameragroup_id), 1)
            if (cameraIDs.length == 0){
                finishTimestampCheck()
            }
            else{
                cameraReadAheadIndex--
                clusterIndex[mapID]--
                prevClusterBtn.disabled = true
                nextCluster(mapID)
            }
        }
        else {
            modalCameraNoTimestamp.modal({keyboard: true})
        }
    }
}


yearInput.addEventListener('input', function() {

    if (yearInput.value.length > 4){
        yearInput.value = yearInput.value.slice(0,4)
    }

    if (yearInput.value.length == 4) {
        if (isNaN(yearInput.value) || parseInt(yearInput.value) > currentYear || parseInt(yearInput.value) < 1900){
            document.getElementById('errorYear').innerHTML = 'Invalid year. Please try again.'
            yearInput.value = ''
            yearInput.focus()
        }
        else{
            monthInput.focus()
            document.getElementById('errorYear').innerHTML = ''
        }
    }
});

monthInput.addEventListener('input', function() {

    if (monthInput.value.length > 2){
        monthInput.value = monthInput.value.slice(0,2)
    }
    
    if (monthInput.value.length == 2) {
        if (isNaN(monthInput.value) || parseInt(monthInput.value) > 12 || parseInt(monthInput.value) < 1){
            document.getElementById('errorMonth').innerHTML = 'Invalid month. Please try again.'
            monthInput.value = ''
            monthInput.focus()
        }
        else{
            dayInput.focus()
            document.getElementById('errorMonth').innerHTML = ''
        }
    }
    else if (monthInput.value.length < 2){
        if (parseInt(monthInput.value) > 1){
            monthInput.value = '0' + monthInput.value
            dayInput.focus()
            document.getElementById('errorMonth').innerHTML = ''
        }
    }
});

dayInput.addEventListener('input', function() {

    if (dayInput.value.length > 2){
        dayInput.value = dayInput.value.slice(0,2)
    }

    if (dayInput.value.length == 2) {
        if (isNaN(dayInput.value) || parseInt(dayInput.value) > 31 || parseInt(dayInput.value) < 1){
            document.getElementById('errorDay').innerHTML = 'Invalid day. Please try again.'
            dayInput.value = ''
            dayInput.focus()
        }
        else{
            hourInput.focus()
            document.getElementById('errorDay').innerHTML = ''
        }
    }
    else if (dayInput.value.length < 2){
        if (parseInt(dayInput.value) > 3){
            dayInput.value = '0' + dayInput.value
            hourInput.focus()
            document.getElementById('errorDay').innerHTML = ''
        }
    }
});

hourInput.addEventListener('input', function() {

    if (hourInput.value.length > 2){
        hourInput.value = hourInput.value.slice(0,2)
    }

    if (hourInput.value.length == 2) {
        if (isNaN(hourInput.value) || parseInt(hourInput.value) > 23 || parseInt(hourInput.value) < 0){
            document.getElementById('errorHour').innerHTML = 'Invalid hour. Please try again.'
            hourInput.value = ''
            hourInput.focus()
        }
        else{
            minutesInput.focus()
            document.getElementById('errorHour').innerHTML = ''
        }
    }
    else if (hourInput.value.length < 2){
        if (parseInt(hourInput.value) > 2){
            hourInput.value = '0' + hourInput.value
            minutesInput.focus()
            document.getElementById('errorHour').innerHTML = ''
        }
    }
});

minutesInput.addEventListener('input', function() {
    if (minutesInput.value.length > 2){
        minutesInput.value = minutesInput.value.slice(0,2)
    }

    if (minutesInput.value.length == 2) {
        if (isNaN(minutesInput.value) || parseInt(minutesInput.value) > 59 || parseInt(minutesInput.value) < 0){
            document.getElementById('errorMinutes').innerHTML = 'Invalid minutes. Please try again.'
            minutesInput.value = ''
            minutesInput.focus()
        }
        else{
            secondsInput.focus()
            document.getElementById('errorMinutes').innerHTML = ''
        }
    }
    else if (minutesInput.value.length < 2){
        if (parseInt(minutesInput.value) > 5){
            minutesInput.value = '0' + minutesInput.value
            secondsInput.focus()
            document.getElementById('errorMinutes').innerHTML = ''
        }
    }
});

secondsInput.addEventListener('input', function() {

    if (secondsInput.value.length > 2){
        secondsInput.value = secondsInput.value.slice(0,2)
    }

    if (secondsInput.value.length == 2) {
        if (isNaN(secondsInput.value) || parseInt(secondsInput.value) > 59 || parseInt(secondsInput.value) < 0){
            document.getElementById('errorSeconds').innerHTML = 'Invalid seconds. Please try again.'
            secondsInput.value = ''
            secondsInput.focus()
        }
        else{
            submitTimestamp()
            document.getElementById('errorSeconds').innerHTML = ''
        }
    }
    else if (secondsInput.value.length < 2){
        if (parseInt(secondsInput.value) > 5){
            secondsInput.value = '0' + secondsInput.value
            submitTimestamp()
            document.getElementById('errorSeconds').innerHTML = ''
        }
    }
});

btnDone.addEventListener('click', () => {
    /** Wraps up the user's session when they click the done button. */
    finishTimestampCheck()
});

function finishTimestampCheck(){
    /** Wraps up the timestamp check. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                window.location.replace("surveys")
            }
        };
    xhttp.open("GET", '/finishTimestampCheck/' + selectedSurvey);
    xhttp.send();
}

function saveProgress(){
    /** Saves the user's progress. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                // console.log(this.responseText)
                window.location.replace("surveys")
            }
        };
    xhttp.open("GET", '/finishTimestampCheck/' + selectedSurvey + '?save=true');
    xhttp.send();
}

function nextPageTimestamps(id,page,mapID='map1'){
    /** Requests the next page of timestamps. */
    var image_ids = clusters[mapID][clusterIndex[mapID]].images.map(x => x.id)
    var formData = new FormData();
    formData.append('image_ids', JSON.stringify(image_ids));

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
        function () {
            if (this.readyState == 4 && this.status == 200) {
                info = JSON.parse(this.responseText);

                if (info.images.length > 0) {
                    timestampCheckPage[info.images[0].id].next_page = info.next_page
                }
                for (let i=0;i<info.images.length;i++) {
                    newcluster = info.images[i];
                    time_index = clusters[mapID].findIndex(x => x.id == newcluster.id)
                    if (time_index != -1){
                        if (newcluster.images.length > 0){
                            image_index = clusters[mapID][time_index].images.findIndex(x => x.id == newcluster.images[0].id)
                            if (image_index == -1){
                                clusters[mapID][time_index].images.push(...newcluster.images)
                            }
                        }
                    }
                }

            }
        };
    xhttp.open("POST", '/getTimestampImages/' + selectedSurvey + '/0?camera_id=' + id + '&page=' + page);
    xhttp.send(formData);
}

window.addEventListener('load', onload, false);

