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

function waitForDownload() {
    /**
     * Enquires about the status of all currently pending downloads, and automatically downloads those that are ready.
     * Clears its own interval once all downloads are complete.
     * */
    
    if ((csv_task_ids.length==0)&&(excel_task_ids.length==0)&&(export_task_ids.length==0)) {
        clearInterval(waitForDownloadTimer)
    } else {
        for (let i = 0; i < csv_ids_to_remove.length; i++){
            var index = csv_task_ids.indexOf(csv_ids_to_remove[i]);
            if (index !== -1) csv_task_ids.splice(index, 1);
        }

        csv_ids_to_remove = []
        for (let i = 0; i < csv_task_ids.length; i++){
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkDownload/csv/'+csv_task_ids[i]);
            xhttp.onreadystatechange =
            function(wrapTaskID){
                return function() {
                    if (this.readyState == 4 && this.status == 200) { 
                        if (this.responseText=='"ready"') {
                            csv_ids_to_remove.push(wrapTaskID)
                            window.location.href = '/Download/csv/'+wrapTaskID
                            if (modalPW.is(':visible')) {
                                modalPW.modal('hide')
                                modalResults.modal({keyboard: true})
                            }                
                        }
                    }
                }
            }(csv_task_ids[i]);
            xhttp.send();
        }

        for (let i = 0; i < excel_ids_to_remove.length; i++){
            var index = excel_task_ids.indexOf(excel_ids_to_remove[i]);
            if (index !== -1) excel_task_ids.splice(index, 1);
        }

        excel_ids_to_remove = []
        for (let i = 0; i < excel_task_ids.length; i++){
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkDownload/excel/'+excel_task_ids[i]);
            xhttp.onreadystatechange =
            function(wrapTaskID){
                return function() {
                    if (this.readyState == 4 && this.status == 200) { 
                        if (this.responseText=='"ready"') {
                            excel_ids_to_remove.push(wrapTaskID)
                            window.location.href = '/Download/excel/'+wrapTaskID
                            if (modalPW.is(':visible')) {
                                modalPW.modal('hide')
                                modalResults.modal({keyboard: true})
                            }                
                        }
                    }
                }
            }(excel_task_ids[i]);
            xhttp.send();
        }

        for (let i = 0; i < export_ids_to_remove.length; i++){
            var index = export_task_ids.indexOf(export_ids_to_remove[i]);
            if (index !== -1) export_task_ids.splice(index, 1);
        }

        export_ids_to_remove = []
        for (let i = 0; i < export_task_ids.length; i++){
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkDownload/export/'+export_task_ids[i]);
            xhttp.onreadystatechange =
            function(wrapTaskID){
                return function() {
                    if (this.readyState == 4 && this.status == 200) { 
                        if (this.responseText=='"ready"') {
                            export_ids_to_remove.push(wrapTaskID)
                            window.location.href = '/Download/export/'+wrapTaskID
                            if (modalPW.is(':visible')) {
                                modalPW.modal('hide')
                                modalResults.modal({keyboard: true})
                            }                
                        }
                    }
                }
            }(export_task_ids[i]);
            xhttp.send();
        }
    }
}

btnExcelDownload.addEventListener('click', ()=>{
    /** Listener that initiates the download of the Excel file when the associated button is clicked. Also initiates the wait for download sequence. */
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", '/generateExcel/'+selectedTask);
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);  
            if (reply=='success') {
                document.getElementById('modalPWH').innerHTML = 'Please Wait'
                document.getElementById('modalPWB').innerHTML = 'Your Excel file is being generated and the download will commence shortly. Please note that this may take a while, especially for larger datasets. Do not navigate away from this page.'
                modalResults.modal('hide')
                modalPW.modal({keyboard: true});
                excel_task_ids.push(selectedTask)
                if (waitForDownloadTimer != null) {
                    clearInterval(waitForDownloadTimer)
                    waitForDownloadTimer = setInterval(waitForDownload, 10000)
                } else {
                    waitForDownloadTimer = setInterval(waitForDownload, 10000)
                }
            } else {
                document.getElementById('modalPWH').innerHTML = 'Error'
                document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'
                modalPW.modal({keyboard: true});
            }
        }
    }
    xhttp.send();
});

exploreTaskBtn.addEventListener('click', function() {
    /** Redirects the user to the explore task page when clicked. */
    document.location.href = '/explore?task='+selectedTask
});
