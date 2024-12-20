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

function waitForDownload() {
    /**
     * Enquires about the status of all currently pending downloads, and automatically downloads those that are ready.
     * Clears its own interval once all downloads are complete.
     * */
    
    if ((csv_task_ids.length==0)&&(excel_task_ids.length==0)&&(export_task_ids.length==0)&&(coco_task_ids.length==0)) {
        clearTimeout(waitForDownloadTimer)
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
                        reply = JSON.parse(this.responseText);  
                        if (reply!="not ready yet") {
                            csv_ids_to_remove.push(wrapTaskID)
                            // window.location.href = '/Download/csv/'+wrapTaskID
                            split = reply.split('/')
                            downloadFile(reply, split[split.length-1])
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

        for (let i = 0; i < coco_ids_to_remove.length; i++){
            var index = coco_task_ids.indexOf(coco_ids_to_remove[i]);
            if (index !== -1) coco_task_ids.splice(index, 1);
        }

        coco_ids_to_remove = []
        for (let i = 0; i < coco_task_ids.length; i++){
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/checkDownload/coco/'+coco_task_ids[i]);
            xhttp.onreadystatechange =
            function(wrapTaskID){
                return function() {
                    if (this.readyState == 4 && this.status == 200) { 
                        reply = JSON.parse(this.responseText);  
                        if (reply!="not ready yet") {
                            coco_ids_to_remove.push(wrapTaskID)
                            // window.location.href = '/Download/coco/'+wrapTaskID
                            split = reply.split('/')
                            downloadFile(reply, split[split.length-1])
                            if (modalPW.is(':visible')) {
                                modalPW.modal('hide')
                                modalResults.modal({keyboard: true})
                            }                
                        }
                    }
                }
            }(coco_task_ids[i]);
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
                        reply = JSON.parse(this.responseText);  
                        if (reply!="not ready yet") {
                            excel_ids_to_remove.push(wrapTaskID)
                            // window.location.href = '/Download/excel/'+wrapTaskID
                            split = reply.split('/')
                            downloadFile(reply, split[split.length-1])
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
                        reply = JSON.parse(this.responseText);  
                        if (reply!="not ready yet") {
                            export_ids_to_remove.push(wrapTaskID)
                            // window.location.href = '/Download/export/'+wrapTaskID
                            split = reply.split('/')
                            downloadFile(reply, split[split.length-1])
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

        if (waitForDownloadTimer != null) {
            clearTimeout(waitForDownloadTimer)
            waitForDownloadTimer = setTimeout(function(){waitForDownload()}, 10000)
        }
        else{
            waitForDownloadTimer = setTimeout(function(){waitForDownload()}, 10000)
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
            if (reply.status=='success') {
                document.getElementById('modalPWH').innerHTML = 'Alert'
                document.getElementById('modalPWB').innerHTML = 'Your Excel file is being generated - you can monitor its progress in the Downloads menu. Once ready, it will be available for a period of 7 days. Please note that this may take a while, especially for larger data sets.'
                modalResults.modal('hide')
                modalPW.modal({keyboard: true});
                excel_task_ids.push(selectedTask)
                // waitForDownload()
            } else {
                document.getElementById('modalPWH').innerHTML = 'Error'
                if (reply.message != null) {
                    document.getElementById('modalPWB').innerHTML = reply.message
                }
                else {
                    document.getElementById('modalPWB').innerHTML = 'An unexpected error has occurred. Please try again.'
                }
                modalResults.modal('hide')
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

function downloadFile(url, filename) {
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
}