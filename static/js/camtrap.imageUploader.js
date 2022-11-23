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

surveyName = 'surveyName'
filesUploaded = 0
filesQueued = 0
queue = []

async function addBatch() {
    fileNames = []
    files = {}
    while ((fileNames.length<10)&&(queue.length>0)) {
        item = queue.pop()
        let file= await item[1].getFile()
        filename = surveyName + '/' + item[0] + '/' + file.name
        fileNames.push(filename)
        files[filename] = file
    }
    fetch('/check_upload_files', {
        method: 'post',
        // Send and receive JSON.
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
                    name: filename, // file name
                    type: file.type, // file type
                    data: file.slice(0, file.size, file.type), // file blob
                  })
                filesQueued += 1
            }
        }
        uppy.addFiles(filesToAdd)
    })
}

async function listFolder2(dirHandle,path){
    // let files=[]
    count = 0
    for await (const entry of dirHandle.values()) {
        if (entry.kind=='directory'){
            await listFolder2(entry,path+'/'+entry.name)
        } else {
            count+=1
            queue.push([path,entry])
            if ((filesQueued-filesUploaded)<10) {
                addBatch()
            }
            // setFileCount(count)
            // limitConnections(()=>upload(path,entry).then(()=>{completeCount+=1; setCompleteState(completeCount)}))
        }
    }
    // console.log(path,count)
    return (count)
}

async function selectFiles() {
    const dirHandle = await window.showDirectoryPicker();
    listFolder2(dirHandle,dirHandle.name)
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
    filesUploaded += 1
})