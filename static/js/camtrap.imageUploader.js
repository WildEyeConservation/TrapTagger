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

// export default function FilesUploadComponent(props){
//     const limitDetWeb=pLimit(6)
//     const limitAWS=pLimit(6)
//     const limitConnections=pLimit(6)
//     let count=0
//     let completeCount=0

//     // async function upload(path,entry){
//     //     let file=await entry.getFile()
//     //     let url = await limitDetWeb(()=>fetch('/api/s3-sign', {
//     //               method: 'post',
//     //               // Send and receive JSON.
//     //               headers: {
//     //                 accept: 'application/json',
//     //                 'Content-Type': 'application/json',
//     //               },
//     //               body: JSON.stringify({
//     //                 filename: path+'/'+file.name,
//     //                 contentType: file.type,
//     //               }),
//     //             }).then(response=>response.text()))
//     //     return limitAWS(()=>fetch(url, {method: 'PUT', headers: {'Content-Type': file.type,},body: file}))
//     // }

//     async function upload(path,entry){
//         let file=await entry.getFile()
//         console.log(path+'/'+file.name)
//         // let url = await limitDetWeb(()=>fetch('/api/s3-sign', {
//         //           method: 'post',
//         //           // Send and receive JSON.
//         //           headers: {
//         //             accept: 'application/json',
//         //             'Content-Type': 'application/json',
//         //           },
//         //           body: JSON.stringify({
//         //             filename: path+'/'+file.name,
//         //             contentType: file.type,
//         //           }),
//         //         }).then(response=>response.text()))
//         // return limitAWS(()=>fetch(url, {method: 'PUT', headers: {'Content-Type': file.type,},body: file}))
//     }
      
//     // async function listFolder2(dirHandle,path){
//     //     let files=[]
//     //     for await (const entry of dirHandle.values()) {
//     //         if (entry.kind=='directory'){
//     //             await listFolder2(entry,path+'/'+entry.name)
//     //         } else {
//     //             count+=1
//     //             setFileCount(count)
//     //             limitConnections(()=>upload(path,entry).then(()=>{completeCount+=1; setCompleteState(completeCount)}))
//     //         }
//     //     }
//     //     console.log(path,count)
//     //     return (count)
//     // }

//     async function listFolder2(dirHandle,path){
//         let files=[]
//         for await (const entry of dirHandle.values()) {
//             if (entry.kind=='directory'){
//                 await listFolder2(entry,path+'/'+entry.name)
//             } else {
//                 count+=1
//                 // setFileCount(count)
//                 upload(path,entry)
//                 // limitConnections(()=>upload(path,entry).then(()=>{completeCount+=1; setCompleteState(completeCount)}))
//             }
//         }
//         // console.log(path,count)
//         return (count)
//     }

//     async function f(){
//         const dirHandle = await window.showDirectoryPicker();
//         if (!startTime){
//             setStartTime(Date.now())
//         }
//         listFolder2(dirHandle,dirHandle.name)
//     }
      
      
//     // React.useEffect(() => {return () => uppy.close({ reason: 'unmount' })}, [uppy])
//     const [fileCount,setFileCount]=React.useState(0)  
//     const [completeState,setCompleteState]=React.useState(0)  
//     const [startTime,setStartTime]=React.useState(null)  
//     return (
//         <div><Button onClick={f}>Load</Button>
//         <br/>
//         Uploaded {completeState} of {fileCount} files...
//         ETA {moment().add((Date.now()-startTime)*(fileCount-completeState)/completeState/1000, 'seconds').calendar()} 
//         {/* <Dashboard
//         theme = 'dark'
//         width = {750}
//         showProgressDetails = {false}
//         showSelectedFiles = {false}
//         disableInformer = {true}
//         disableThumbnailGenerator= {false}
//         uppy={uppy}
//         {...props}
//     />*/}
//     </div>)
// }

batchSize = 200
surveyName = null
filesUploaded = 0
filesActuallyUploaded = 0
filesQueued = 0
uploadQueue = []
finishedQueueing = false
globalDirHandle = null
filecount=0
addingBatch = false
uploadPaused = false
uploadID = null
uploadCheck = false
uploadStart = null

async function addBatch() {
    addingBatch = true
    fileNames = []
    files = {}
    while ((fileNames.length<batchSize)&&(uploadQueue.length>0)) {
        item = uploadQueue.pop()
        let file = await item[1].getFile()
        filename = surveyName + '/' + item[0] + '/' + file.name
        fileNames.push(filename)
        files[filename] = file
    }
    await fetch('/check_upload_files', {
        method: 'post',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filenames: fileNames
        })
    }).then((response) => {
        return response.json()
    }).then((data) => {
        filesToAdd = []
        for (filename in files) {
            if (!data.includes(filename)) {
                file = files[filename]
                filesToAdd.push({
                    name: filename,
                    type: file.type,
                    data: file.slice(0, file.size, file.type),
                  })
            } else {
                filesUploaded += 1
            }
            filesQueued += 1
            updateUploadProgress(filesUploaded,filecount)
        }
        uppy.addFiles(filesToAdd)
        checkFinishedUpload()
    })
    addingBatch = false
    return true
}

// async function handleEntry(path,entry) {
//     if (entry.kind=='directory'){
//         await listFolder2(entry,path+'/'+entry.name)
//     } else {
//         count+=1
//         uploadQueue.push([path,entry])
//         if (((filesQueued-filesUploaded)<(0.5*batchSize))&&(uploadQueue.length>=batchSize)) {
//             await addBatch()
//         }
//         // setFileCount(count)
//         // limitConnections(()=>upload(path,entry).then(()=>{completeCount+=1; setCompleteState(completeCount)}))
//     }
//     return true
// }

async function listFolder2(dirHandle,path){
    // let files=[]
    for await (const entry of dirHandle.values()) {
        // await handleEntry(path,entry)
        if (entry.kind=='directory'){
            await listFolder2(entry,path+'/'+entry.name)
            folders.push(path+'/'+entry.name)
            updatePathDisplay(folders)
        } else {
            filecount+=1
            uploadQueue.push([path,entry])
            // if (((filesQueued-filesUploaded)<(0.4*batchSize))&&(uploadQueue.length>=batchSize)&&!addingBatch) {
            //     addBatch()
            // }
            // setFileCount(count)
            // limitConnections(()=>upload(path,entry).then(()=>{completeCount+=1; setCompleteState(completeCount)}))
        }
    }
    // console.log(path,count)
    return filecount
}

// async function listFolderNames(dirHandle,path){
//     for await (const entry of dirHandle.values()) {
//         if (entry.kind=='directory'){
//             await listFolderNames(entry,path+'/'+entry.name)
//             folders.push(path+'/'+entry.name)
//             updatePathDisplay(folders)
//         } else {
//             filecount += 1
//         }
//     }
//     return folders
// }

function initUpload(edit=false) {
    uploadStart = Date.now()
    filesUploaded = 0
    filesActuallyUploaded = 0
    // filesQueued = 0
    // uploadQueue = []

    //Disable edit/delete buttons
    // addImagesBtn = document.getElementById('addImagesBtn'+uploadID.toString())
    // addImagesBtn.disabled = true
    // addTaskBtn = document.getElementById('addTaskBtn'+uploadID.toString())
    // addTaskBtn.disabled = true
    deleteSurveyBtn = document.getElementById('deleteSurveyBtn'+uploadID.toString())
    deleteSurveyBtn.disabled = true

    if (!edit) { 
        surveyName = document.getElementById('newSurveyName').value
    }

    taskDiv = document.getElementById('taskDiv-'+surveyName)
    while(taskDiv.firstChild){
        taskDiv.removeChild(taskDiv.firstChild);
    }
    
    row = document.createElement('div')
    row.classList.add('row')
    taskDiv.appendChild(row)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-9')
    row.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    row.appendChild(col2)

    btnPause = document.createElement('button')
    btnPause.setAttribute("class","btn btn-primary btn-sm")
    btnPause.setAttribute('style','margin-right:4px')
    btnPause.setAttribute('onclick','pauseUpload()')
    btnPause.setAttribute('id','btnPause')
    btnPause.innerHTML = 'Pause'
    col2.appendChild(btnPause)

    // col3 = document.createElement('div')
    // col3.classList.add('col-lg-1')
    // row.appendChild(col3)

    btnStop = document.createElement('button')
    btnStop.setAttribute("class","btn btn-danger btn-sm")
    btnStop.setAttribute('onclick','stopUpload()')
    btnStop.innerHTML = 'Stop'
    col2.appendChild(btnStop)

    // ProgBarDiv = document.getElementById('uploadProgBarDiv')

    // while(ProgBarDiv.firstChild){
    //     ProgBarDiv.removeChild(ProgBarDiv.firstChild);
    // }

    uploadStatus = document.createElement('div')
    uploadStatus.setAttribute('id','uploadStatus')
    col1.appendChild(uploadStatus);

    var newProg = document.createElement('div');
    newProg.classList.add('progress');

    var newProgInner = document.createElement('div');
    newProgInner.classList.add('progress-bar');
    newProgInner.classList.add('progress-bar-striped');
    newProgInner.classList.add('active');
    newProgInner.setAttribute("role", "progressbar");
    newProgInner.setAttribute("id", "uploadProgBar");
    newProgInner.setAttribute("aria-valuenow", "0");
    newProgInner.setAttribute("aria-valuemin", "0");
    newProgInner.setAttribute("aria-valuemax", "0");
    newProgInner.setAttribute("style", "width:0%");

    newProg.appendChild(newProgInner);
    col1.appendChild(newProg);

    timeRemDiv = document.createElement('div')
    timeRemDiv.setAttribute('id','uploadTimeRemDiv')
    col1.appendChild(timeRemDiv);
    
    if (modalNewSurvey.is(':visible')) {
        modalNewSurvey.modal('hide')
    } else {
        modalAddImages.modal('hide')
    }
    // modalUploadProgress.modal({backdrop: 'static', keyboard: false});
}

function updatePathDisplay(folders) {
    pathDisplay = document.getElementById('pathDisplay')

    if (pathDisplay) {
        while(pathDisplay.firstChild){
            pathDisplay.removeChild(pathDisplay.firstChild);
        }

        // add folder count
        let fileCountOption = document.createElement('option');
        fileCountOption.text = 'Files detected: '+filecount.toString();
        fileCountOption.value = 0;
        pathDisplay.add(fileCountOption);

        // add folder count
        let folderDisplay = document.createElement('option');
        folderDisplay.text = 'Paths found:';
        folderDisplay.value = 1;
        pathDisplay.add(folderDisplay)

        //add paths
        for (let idx = 2; idx < folders.length; idx++){
            let option = document.createElement('option');
            option.text = folders[idx];
            option.value = idx;
            pathDisplay.add(option);
        }
    }
}

async function selectFiles(resuming=false) {
    globalDirHandle = await window.showDirectoryPicker();
    folders = []
    filesQueued = 0
    uploadQueue = []
    await listFolder2(globalDirHandle,globalDirHandle.name)
    folders.push(globalDirHandle.name)
    if (resuming) {
        uploadFiles(true)
    } else {
        updatePathDisplay(folders)
        checkTrapgroupCode()
    }
}

async function uploadFiles(edit=false) {
    finishedQueueing = false
    initUpload(edit)
    // await listFolder2(globalDirHandle,globalDirHandle.name)
    addBatch()
    finishedQueueing = true
}

var uppy = new Uppy.Uppy({
    autoProceed: true
    // debug: true,
    // logger: debugLogger
})
// uppy.use(Uppy.DragDrop, { target: document.getElementById('dragArea') })
// uppy.use(Uppy.Tus, { endpoint: 'https://tusd.tusdemo.net/files/' })
// uppy.use(Uppy.AwsS3, {
//     limit: 2,
//     timeout: Uppy.ms('1 minute'),
//     companionUrl: 'https://uppy-companion.myapp.com/',
// })
uppy.use(Uppy.AwsS3, {
    getUploadParameters (file) {
        return fetch('/get_presigned_url', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
            }),
        }).then((response) => {
            return response.text()
        }).then((url) => {
            return {
                method: 'PUT',
                url: url,
                fields: {},
                headers: {
                    'Content-Type': file.type,
                }
            }
        })
    },
})
// uppy.on('files-added', (files) => {
//     fileNames = []
//     for (fc=0;fc<files.length;fc++) {
//         fileNames.push(files[fc].meta.relativePath)
//     }
//     fetch('/check_upload_files', {
//         method: 'post',
//         // Send and receive JSON.
//         headers: {
//             accept: 'application/json',
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             filenames: fileNames
//         })
//     }).then((response) => response.json()
//     ).then((data) => {
//         uppy.cancelAll();
//         //files.forEach((file)=>{uppy.removeFile(file.id)})
//         const allFiles= data['wanted'].concat(data['completed']);
//         // allFiles.forEach((index)=>{
//         //   files[index].source='myplugin';
//         //   uppy.addFile(files[index])
//         // })
//         uppy.addFiles(allFiles.map((index)=>{ let file=files[index];file.source = 'myplugin';return file}))
//         data['completed'].forEach((index)=>{
//         uppy.setFileState(files[index].id, {progress: { percentage:100, uploadComplete: true, uploadStarted: true }})
//         })
//     })
// })
uppy.on('upload-success', (file, response) => {
    console.log(file.name+' uploaded successfully!')
    uppy.removeFile(file)
    filesUploaded += 1
    filesActuallyUploaded += 1
    updateUploadProgress(filesUploaded,filecount)

    if (((filesQueued-filesUploaded)<(0.4*batchSize))&&!addingBatch&&(uploadQueue.length!=0)) {
        addBatch()
    }

    checkFinishedUpload()
})

function checkFinishedUpload() {
    if ((filesUploaded==filesQueued)&&(uploadQueue.length==0)&&(finishedQueueing)) {
        if (filesActuallyUploaded==0) {
            //completely done
            uploading = false
            uploadCheck = false
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", '/updateSurveyStatus/'+surveyName+'/Ready');
            xhttp.onreadystatechange =
            function(){
                if (this.readyState == 4 && this.status == 200) {
                    updatePage(current_page)
                }
            }
            xhttp.send();
            // modalUploadProgress.modal('hide')
            // document.getElementById('modalAlertHeader').innerHTML = 'Success'
            // document.getElementById('modalAlertBody').innerHTML = 'All images uploaded successfully.'
            // modalAlert.modal({keyboard: true});
            console.log('Upload Complete')
        } else {
            //check upload - restart upload
            uploadCheck = true
            filesQueued = 0
            filecount = 0
            listFolder2(globalDirHandle,globalDirHandle.name)
            uploadFiles(true)
        }
    }
}

function pauseUpload() {
    btnPause = document.getElementById('btnPause')
    if (uploadPaused) {
        uppy.resumeAll()
        uploadPaused = false
        btnPause.innerHTML = 'Pause'
        btnPause.setAttribute("class","btn btn-primary btn-sm")
    } else {
        uppy.pauseAll()
        uploadPaused = true
        btnPause.innerHTML = 'Resume'
        btnPause.setAttribute("class","btn btn-success btn-sm")
    }
}

function stopUpload() {
    uppy.cancelAll()
    updatePage(current_page)
}

function updateUploadProgress(value,total) {
    progBar = document.getElementById('uploadProgBar')
    perc=(value/total)*100

    progBar.setAttribute('aria-valuenow',value)
    progBar.setAttribute('style',"width:"+perc+"%")
    progBar.innerHTML = value.toString() + '/' + total.toString() + " images uploaded."

    if (uploadCheck) {
        document.getElementById('uploadStatus').innerHTML = 'Checking...'
    } else if (uploadPaused) {
        document.getElementById('uploadStatus').innerHTML = 'Paused'
    } else {
        document.getElementById('uploadStatus').innerHTML = 'Uploading...'
    }

    timeElapsed = Date.now() - uploadStart
    if ((value!=0) && (value<=total)) {
        rate = timeElapsed/value
        timeRemaining = new Date((rate*(total-value)) * 1000).toISOString().substr(11, 8)
        document.getElementById('uploadTimeRemDiv').innerHTML = 'Time Remaining: ' + timeRemaining
    }
}