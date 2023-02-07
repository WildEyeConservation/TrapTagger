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

btnCompare.addEventListener('click', ()=>{
    /** Listener on the compare button that opens the associated modal. */
    modalResults.modal('hide')
    modalCompare.modal({keyboard: true})
});

CompClose.addEventListener('click', ()=>{
    /** Returns the user to the results modal when they close the comparison modal. */
    modalResults.modal({keyboard: true});
});

btnSubmitCompare.addEventListener('click', ()=>{
    /** Submits the requested comparison to the server if it the request is legal. */
    
    categoryNames = document.querySelectorAll('[id^=categoryName-]');
    leftGT = document.getElementById('leftGT')
    rightGT = document.getElementById('rightGT')
    comparisonErrors = document.getElementById('comparisonErrors')

    while(comparisonErrors.firstChild){
        comparisonErrors.removeChild(comparisonErrors.firstChild);
    }

    // Check if ready to submit
    legalTask = true
    ComparisonSelector = document.getElementById('ComparisonSelector')
    selectedCompTask = ComparisonSelector.options[ComparisonSelector.selectedIndex].value
    if (selectedCompTask=='0') {
        legalTask=false
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'A task must be selected for comparison purposes.'
        comparisonErrors.appendChild(newdiv)
    }

    legalTranslations = true
    for (let i=0;i<categoryNames.length;i++) {
        if (categoryNames[i].value.length==0) {
            legalTranslations = false
            newdiv = document.createElement('div')
            newdiv.innerHTML = 'You cannot have an empty category name.'
            comparisonErrors.appendChild(newdiv)
        }
    }
    if ((globalUnusedTextsLeft.length!=0)||(globalUnusedTextsRight.length!=0)) {
        legalTranslations = false
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'There are unallocated labels:'
        comparisonErrors.appendChild(newdiv)
        if (globalUnusedTextsLeft.length!=0) {
            newdiv = document.createElement('div')
            newdiv.innerHTML = globalUnusedTextsLeft
            comparisonErrors.appendChild(newdiv)
        }
        if (globalUnusedTextsRight.length!=0) {
            newdiv = document.createElement('div')
            newdiv.innerHTML = globalUnusedTextsRight
            comparisonErrors.appendChild(newdiv)
        }
    }
    for (let i=0;i<categoryNames.length;i++) {
        IDNum = categoryNames[i].id.split('-')[categoryNames[i].id.split('-').length-1]
        leftSelectors = document.querySelectorAll('[id^=leftComp-'+IDNum+']');        
        rightSelectors = document.querySelectorAll('[id^=rightComp-'+IDNum+']');
        if ((leftSelectors.length==0)||(rightSelectors.length==0)) {
            legalTranslations = false
            newdiv = document.createElement('div')
            newdiv.innerHTML = 'You cannot have a category with no allocated labels.'
            comparisonErrors.appendChild(newdiv)
        }
    }
    checkForDuplicates()
    if (duplicateLabels==true) {
        legalTranslations = false
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'You cannot have a duplicate labels.'
        comparisonErrors.appendChild(newdiv)
    }

    legalGTs = true
    if ((!leftGT.checked)&&(!rightGT.checked)) {
        legalGTs = false
        newdiv = document.createElement('div')
        newdiv.innerHTML = 'Please select a ground truth.'
        comparisonErrors.appendChild(newdiv)
    }

    if (legalTranslations&&legalGTs&&legalTask) {
        // Build dictionary
        translations = {}
        for (let i=0;i<categoryNames.length;i++) {
            catName = categoryNames[i].value.replace(/\//g, '*****')
            translations[catName] = {}
            translations[catName][selectedTask] = []
            translations[catName][selectedCompTask] = []

            IDNum = categoryNames[i].id.split('-')[categoryNames[i].id.split('-').length-1]

            leftSelectors = document.querySelectorAll('[id^=leftComp-'+IDNum+']');
            for (let n=0;n<leftSelectors.length;n++) {
                translations[catName][selectedTask].push(leftSelectors[n].options[leftSelectors[n].selectedIndex].value)
            }
            
            rightSelectors = document.querySelectorAll('[id^=rightComp-'+IDNum+']');
            for (let n=0;n<rightSelectors.length;n++) {
                translations[catName][selectedCompTask].push(rightSelectors[n].options[rightSelectors[n].selectedIndex].value)
            }
        }

        if (leftGT.checked) {
            groundTruth = selectedTask
        } else {
            groundTruth = selectedCompTask
        }

        var formData = new FormData()
        formData.append("translations", JSON.stringify(translations))

        // Submit
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                reply = JSON.parse(this.responseText);

                if (reply == 'success') {
                    window.location.href = '/comparison'
                }
            }
        }
        xhttp.open("POST", '/submitComparison/'+groundTruth+'/'+selectedTask+'/'+selectedCompTask);
        xhttp.send(formData);

        modalCompare.modal('hide')
        document.getElementById('modalAlertHeader').innerHTML = 'Success'
        document.getElementById('modalAlertBody').innerHTML = 'The comparison is being prepared. You will be redirected when it is ready. Please note that this may take a while for larger surveys.'
        modalAlert.modal({keyboard: true});
    }
});

function populateCompSelectorsRight() {
    /** Populates the selectors for the right-hand task in the comparison modal. */

    selectors = document.querySelectorAll('[id^=rightComp-]');

    emptySelectors = []
    usedLabels = []
    for (let i=0;i<selectors.length;i++) {
        if (selectors[i].selectedIndex != -1) {
            usedLabels.push(parseInt(selectors[i].options[selectors[i].selectedIndex].value))
        } else {
            emptySelectors.push(selectors[i])
        }
    }

    unusedTexts = []
    unusedValues = []
    for (let i=0;i<allLabelsComp.two.length;i++) {
        if (!usedLabels.includes(allLabelsComp.two[i][0])) {
            unusedValues.push(allLabelsComp.two[i][0])
            unusedTexts.push(allLabelsComp.two[i][1])
        }
    }
    
    for (let i=0;i<emptySelectors.length;i++) {
        if (unusedValues.length > 0) {
            fillSelect(emptySelectors[i], [unusedTexts.shift()], [unusedValues.shift()])
        }
    }

    globalUnusedTextsRight = unusedTexts

    for (let i=0;i<selectors.length;i++) {
        optionTexts = unusedTexts.slice(0)
        optionValues = unusedValues.slice(0)
        if (selectors[i].selectedIndex != -1) {
            optionTexts.unshift(selectors[i].options[selectors[i].selectedIndex].text)
            optionValues.unshift(selectors[i].options[selectors[i].selectedIndex].value)
        }
        clearSelect(selectors[i])
        fillSelect(selectors[i], optionTexts, optionValues)
        selectors[i].selectedIndex=0
    }
}

function populateCompSelectorsLeft() {
    /** Populates the species selectors for the left-hand task in the comparison modal. */

    selectors = document.querySelectorAll('[id^=leftComp-]');

    emptySelectors = []
    usedLabels = []
    for (let i=0;i<selectors.length;i++) {
        if (selectors[i].selectedIndex != -1) {
            usedLabels.push(parseInt(selectors[i].options[selectors[i].selectedIndex].value))
        } else {
            emptySelectors.push(selectors[i])
        }
    }

    unusedTexts = []
    unusedValues = []
    for (let i=0;i<allLabelsComp.one.length;i++) {
        if (!usedLabels.includes(allLabelsComp.one[i][0])) {
            unusedValues.push(allLabelsComp.one[i][0])
            unusedTexts.push(allLabelsComp.one[i][1])
        }
    }

    for (let i=0;i<emptySelectors.length;i++) {
        if (unusedValues.length > 0) {
            fillSelect(emptySelectors[i], [unusedTexts.shift()], [unusedValues.shift()])
        }
    }

    globalUnusedTextsLeft = unusedTexts

    for (let i=0;i<selectors.length;i++) {
        optionTexts = unusedTexts.slice(0)
        optionValues = unusedValues.slice(0)
        if (selectors[i].selectedIndex != -1) {
            optionTexts.unshift(selectors[i].options[selectors[i].selectedIndex].text)
            optionValues.unshift(selectors[i].options[selectors[i].selectedIndex].value)
        }
        clearSelect(selectors[i])
        fillSelect(selectors[i], optionTexts, optionValues)
        selectors[i].selectedIndex=0
    }
}

function checkForDuplicates() {
    /** Checks for duplicate labels in the comparison modal. */
    
    selectors = document.querySelectorAll('[id^=leftComp-]');
    usedLabels = []
    duplicateLabels = false
    for (let i=0;i<selectors.length;i++) {
        if (selectors[i].selectedIndex != -1) {
            selection = parseInt(selectors[i].options[selectors[i].selectedIndex].value)
            if (usedLabels.includes(selection)) {
                duplicateLabels = true
            } else {
                usedLabels.push(selection)
            }
        }
    }

    selectors = document.querySelectorAll('[id^=rightComp-]');
    usedLabels = []
    for (let i=0;i<selectors.length;i++) {
        if (selectors[i].selectedIndex != -1) {
            selection = parseInt(selectors[i].options[selectors[i].selectedIndex].value)
            if (usedLabels.includes(selection)) {
                duplicateLabels = true
            } else {
                usedLabels.push(selection)
            }
        }
    }
}

function buildCompSubRowLeft(IDNum) {
    /** Builds a label sub-row for the row with the specified ID number, for the left-hand task. */

    IDNum2 = getIdNumforNext('leftComp-'+IDNum)
    Col = document.getElementById('subRowLeft-'+IDNum)

    theRow = document.createElement('div')
    theRow.classList.add('row')
    Col.appendChild(theRow)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-9')
    theRow.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    theRow.appendChild(col2)

    labelSelector = document.createElement('select')
    labelSelector.classList.add('form-control')
    labelSelector.setAttribute('id','leftComp-'+IDNum+'_'+IDNum2)
    col1.appendChild(labelSelector)

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum+'_'+IDNum2;
    btnRemove.innerHTML = '&times;';
    col2.appendChild(btnRemove)

    $('#'+labelSelector.id).change( function() {
        populateCompSelectorsLeft()
    });

    btnRemove.addEventListener('click', (evt)=>{
        evt.target.parentNode.parentNode.remove();
        populateCompSelectorsLeft()
    });
    populateCompSelectorsLeft()
}

function buildCompSubRowRight(IDNum) {
    /** Builds a label sub-row for the row with the specified ID number, for the right-hand task. */

    IDNum2 = getIdNumforNext('rightComp-'+IDNum)
    Col = document.getElementById('subRowRight-'+IDNum)

    theRow = document.createElement('div')
    theRow.classList.add('row')
    Col.appendChild(theRow)

    col1 = document.createElement('div')
    col1.classList.add('col-lg-9')
    theRow.appendChild(col1)

    col2 = document.createElement('div')
    col2.classList.add('col-lg-3')
    theRow.appendChild(col2)

    labelSelector = document.createElement('select')
    labelSelector.classList.add('form-control')
    labelSelector.setAttribute('id','rightComp-'+IDNum+'_'+IDNum2)
    col1.appendChild(labelSelector)

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-default');
    btnRemove.id = 'btnRemove-'+IDNum+'_'+IDNum2;
    btnRemove.innerHTML = '&times;';
    col2.appendChild(btnRemove)

    $('#'+labelSelector.id).change( function() {
        populateCompSelectorsRight()
    });

    btnRemove.addEventListener('click', (evt)=>{
        evt.target.parentNode.parentNode.remove();
        populateCompSelectorsRight()
    });
    populateCompSelectorsRight()
}

function buildCompRow() {
    /** Builds a new label-grouping row for the comparison modal. */

    IDNum = getIdNumforNext('compRowDiv-')
    comparionDisplay = document.getElementById('comparionDisplay')

    compRowDiv = document.createElement('div')
    compRowDiv.setAttribute('id','compRowDiv-'+IDNum)
    comparionDisplay.appendChild(compRowDiv)

    //titlerow
    titlerow = document.createElement('div')
    titlerow.classList.add('row')
    compRowDiv.appendChild(titlerow)

    leftCol0 = document.createElement('div')
    leftCol0.classList.add('col-lg-6')
    titlerow.appendChild(leftCol0)

    rightCol0 = document.createElement('div')
    rightCol0.classList.add('col-lg-6')
    rightCol0.setAttribute('style',"border-left: thin solid #ffffff;")
    titlerow.appendChild(rightCol0)

    if (IDNum != '0') {
        leftCol0.appendChild(document.createElement('br'))
        rightCol0.appendChild(document.createElement('br'))
    }

    leftCol0.appendChild(document.createElement('br'))

    arow = document.createElement('div')
    arow.classList.add('row')
    leftCol0.appendChild(arow)
    acol0 = document.createElement('div')
    acol0.classList.add('col-lg-1')
    arow.appendChild(acol0)
    acol1 = document.createElement('div')
    acol1.classList.add('col-lg-2')
    arow.appendChild(acol1)
    acol2 = document.createElement('div')
    acol2.classList.add('col-lg-6')
    arow.appendChild(acol2)

    btnRemove = document.createElement('button');
    btnRemove.classList.add('btn');
    btnRemove.classList.add('btn-primary');
    btnRemove.setAttribute('style','margin-left: 1px')
    btnRemove.id = 'btnRemove-'+IDNum;
    btnRemove.innerHTML = '&times;';
    acol0.appendChild(btnRemove)

    btnRemove.addEventListener('click', (evt)=>{
        evt.target.parentNode.parentNode.parentNode.parentNode.parentNode.remove();
        populateCompSelectorsLeft()
        populateCompSelectorsRight()
    });
    
    catNameLab = document.createElement('h5')
    catNameLab.innerHTML = 'Label'
    catNameLab.setAttribute('style',"margin-top: 6px; margin-left:10px")
    acol1.appendChild(catNameLab)
    categoryName = document.createElement('input')
    categoryName.classList.add('form-control')
    categoryName.setAttribute('type','text')
    categoryName.setAttribute('id','categoryName-'+IDNum)
    acol2.appendChild(categoryName)

    //labelrow
    labelrow = document.createElement('div')
    labelrow.classList.add('row')
    compRowDiv.appendChild(labelrow)

    leftCol = document.createElement('div')
    leftCol.classList.add('col-lg-6')
    leftCol.setAttribute('id','leftCol-'+IDNum)
    labelrow.appendChild(leftCol)

    rightCol = document.createElement('div')
    rightCol.classList.add('col-lg-6')
    rightCol.setAttribute('id','rightCol-'+IDNum)
    rightCol.setAttribute('style',"border-left: thin solid #ffffff;")
    labelrow.appendChild(rightCol)

    subRowDivLeft = document.createElement('div')
    subRowDivLeft.setAttribute('id','subRowLeft-'+IDNum)
    leftCol.appendChild(subRowDivLeft)

    subRowDivRight = document.createElement('div')
    subRowDivRight.setAttribute('id','subRowRight-'+IDNum)
    rightCol.appendChild(subRowDivRight)

    // buildCompSubRow()
    buildCompSubRowLeft(IDNum)
    buildCompSubRowRight(IDNum)

    arow = document.createElement('div')
    arow.classList.add('row')
    leftCol.appendChild(arow)
    acol1 = document.createElement('div')
    acol1.classList.add('col-lg-9')
    arow.appendChild(acol1)
    acol2 = document.createElement('div')
    acol2.classList.add('col-lg-3')
    arow.appendChild(acol2)
    leftAdd = document.createElement('button')
    leftAdd.classList.add('btn');
    leftAdd.classList.add('btn-info');
    leftAdd.id = 'btnLeftAdd-'+IDNum;
    leftAdd.innerHTML = '+';
    acol2.appendChild(leftAdd)

    arow = document.createElement('div')
    arow.classList.add('row')
    rightCol.appendChild(arow)
    acol1 = document.createElement('div')
    acol1.classList.add('col-lg-9')
    arow.appendChild(acol1)
    acol2 = document.createElement('div')
    acol2.classList.add('col-lg-3')
    arow.appendChild(acol2)
    rightAdd = document.createElement('button')
    rightAdd.classList.add('btn');
    rightAdd.classList.add('btn-info');
    rightAdd.id = 'btnRightAdd-'+IDNum;
    rightAdd.innerHTML = '+';
    acol2.appendChild(rightAdd)

    leftAdd.addEventListener('click', function(wrapIDNum) {
        return function() {
            buildCompSubRowLeft(wrapIDNum)    
        }
    }(IDNum));

    rightAdd.addEventListener('click', function(wrapIDNum) {
        return function() {
            buildCompSubRowRight(wrapIDNum)    
        }
    }(IDNum));
}

function clearComparisonDisplay() {
    /** Clears the comparison modal. */

    ComparisonSelector = document.getElementById('ComparisonSelector')
    clearSelect(ComparisonSelector)

    comparionDisplay = document.getElementById('comparionDisplay')
    while(comparionDisplay.firstChild){
        comparionDisplay.removeChild(comparionDisplay.firstChild);
    }

    comparionDisplayBtn = document.getElementById('comparionDisplayBtn')
    while(comparionDisplayBtn.firstChild){
        comparionDisplayBtn.removeChild(comparionDisplayBtn.firstChild);
    }
}

function updateComparisonDisplay() {
    /** Updates and initialises the comparison modal. */

    ComparisonSelector = document.getElementById('ComparisonSelector')
    selectedCompTask = ComparisonSelector.options[ComparisonSelector.selectedIndex].value
    selectedCompTaskName = ComparisonSelector.options[ComparisonSelector.selectedIndex].text

    if (selectedCompTask!='0') {
        comparionDisplay = document.getElementById('comparionDisplay')
        while(comparionDisplay.firstChild){
            comparionDisplay.removeChild(comparionDisplay.firstChild);
        }

        comparionDisplayBtn = document.getElementById('comparionDisplayBtn')
        while(comparionDisplayBtn.firstChild){
            comparionDisplayBtn.removeChild(comparionDisplayBtn.firstChild);
        }

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange =
        function(){
            if (this.readyState == 4 && this.status == 200) {
                allLabelsComp = JSON.parse(this.responseText);

                h5 = document.createElement('h5')
                h5.setAttribute('style','margin-bottom: 2px')
                h5.innerHTML = 'Translation Matrix'
                comparionDisplay.appendChild(h5)
            
                divi = document.createElement('div')
                divi.setAttribute('style','font-size: 80%; margin-bottom: 2px')
                divi.innerHTML = '<i>Set up translations between the labels of the two annotation sets by combining them into new label categories. It is recommended that you keep the number of labels low to keep the resulting table readable. A good option is to combine and compare at your top-level label categories.</i>'
                comparionDisplay.appendChild(divi)
            
                comparionDisplay.appendChild(document.createElement('br'))
    
                topLevelDiv = document.createElement('div')
                topLevelDiv.classList.add('row')
        
                leftCol = document.createElement('div')
                leftCol.classList.add('col-lg-6')
                leftCol.setAttribute('id','leftCol')
                topLevelDiv.appendChild(leftCol)
        
                rightCol = document.createElement('div')
                rightCol.classList.add('col-lg-6')
                rightCol.setAttribute('id','rightCol')
                rightCol.setAttribute('style',"border-left: thin solid #ffffff;")
                topLevelDiv.appendChild(rightCol)
                comparionDisplay.appendChild(topLevelDiv)
        
                //Add names
                leftName = document.createElement('h5')
                leftName.innerHTML = selectedTaskName
                leftCol.appendChild(leftName)
        
                rightName = document.createElement('h5')
                rightName.innerHTML = selectedCompTaskName
                rightCol.appendChild(rightName)
                
                //Add ground truth checkboxes
                leftCheckDiv = document.createElement('div')
                leftCheckDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
                leftCol.appendChild(leftCheckDiv)

                leftCheckInput = document.createElement('input')
                leftCheckInput.setAttribute('type','radio')
                leftCheckInput.setAttribute('class','custom-control-input')
                leftCheckInput.setAttribute('id','leftGT')
                leftCheckInput.setAttribute('name','GTSelect')
                leftCheckInput.setAttribute('value','customEx')
                leftCheckDiv.appendChild(leftCheckInput)

                leftCheckLabel = document.createElement('label')
                leftCheckLabel.setAttribute('class','custom-control-label')
                leftCheckLabel.setAttribute('for','leftGT')
                leftCheckLabel.innerHTML = 'Ground Truth'
                leftCheckDiv.appendChild(leftCheckLabel)

                rightCheckDiv = document.createElement('div')
                rightCheckDiv.setAttribute('class','custom-control custom-radio custom-control-inline')
                rightCol.appendChild(rightCheckDiv)

                rightCheckInput = document.createElement('input')
                rightCheckInput.setAttribute('type','radio')
                rightCheckInput.setAttribute('class','custom-control-input')
                rightCheckInput.setAttribute('id','rightGT')
                rightCheckInput.setAttribute('name','GTSelect')
                rightCheckInput.setAttribute('value','customEx')
                rightCheckDiv.appendChild(rightCheckInput)

                rightCheckLabel = document.createElement('label')
                rightCheckLabel.setAttribute('class','custom-control-label')
                rightCheckLabel.setAttribute('for','rightGT')
                rightCheckLabel.innerHTML = 'Ground Truth'
                rightCheckDiv.appendChild(rightCheckLabel)

                leftCol.appendChild(document.createElement('br'))
                rightCol.appendChild(document.createElement('br'))
        
                //Add the input divs
                leftInputDiv = document.createElement('div')
                leftInputDiv.setAttribute('id','leftInputDiv')
                leftCol.appendChild(leftInputDiv)
        
                rightInputDiv = document.createElement('div')
                rightInputDiv.setAttribute('id','rightInputDiv')
                rightCol.appendChild(rightInputDiv)
        
                buildCompRow()
        
                arow = document.createElement('div')
                arow.classList.add('row')
                comparionDisplayBtn.appendChild(arow)
                acol1 = document.createElement('div')
                acol1.classList.add('col-lg-1')
                arow.appendChild(acol1)
                leftAdd = document.createElement('button')
                leftAdd.classList.add('btn');
                leftAdd.classList.add('btn-primary');
                leftAdd.id = 'btnLeftAdd-'+IDNum;
                leftAdd.innerHTML = 'Add Label';
                acol1.appendChild(leftAdd)
        
                leftAdd.addEventListener('click', function() {
                    buildCompRow()
                });
            }
        }
        xhttp.open("GET", '/getAllTaskLabels/'+selectedTask+'/'+selectedCompTask);
        xhttp.send();
    }
}

modalCompare.on('shown.bs.modal', function(){
    /** Intitialises the comparison modal when shown. */
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange =
    function(){
        if (this.readyState == 4 && this.status == 200) {
            reply = JSON.parse(this.responseText);

            optionTexts = ['']
            optionValues = ['0']
            for (let i=0;i<reply.length;i++) {
                if (reply[i][0] != selectedTask) {
                    optionTexts.push(reply[i][1])
                    optionValues.push(reply[i][0])
                } else {
                    selectedTaskName = reply[i][1]
                }
            }

            ComparisonSelector = document.getElementById('ComparisonSelector')
            clearSelect(ComparisonSelector)
            fillSelect(ComparisonSelector, optionTexts, optionValues)
        }
    }
    xhttp.open("GET", '/getOtherTasks/'+selectedTask);
    xhttp.send();
});

modalCompare.on('hidden.bs.modal', function(){
    /** Clears the comparison modal when closed. */
    if (!helpReturn) {
        clearComparisonDisplay()
    }
});

$('#ComparisonSelector').change( function() {
    /** Listens for changes in the task selected for comparison in the comparison modal, and updates the form. */
    updateComparisonDisplay()
});