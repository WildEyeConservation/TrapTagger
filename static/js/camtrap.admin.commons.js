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

function fillSelect(selectElement, optionTexts, optionValues, optionColours=null){
    /** Fills the given selector with the supplied options & colours.
     * @param {select} selectElement The element to populate
     * @param {arr} optionTexts The text values of the options
     * @param {arr} optionValues The numerical values of the options
     * @param {arr} optionColours The colours of the options
     */

    optionTexts.forEach((text, index) => {
        option = document.createElement('option');
        option.text = text;
        option.value = optionValues[index];
        if (optionColours != null) {
            option.style.color = optionColours[index];
        }
        selectElement.add(option);
    });
}
  
function clearSelect(selectElement){
    /** Clears the supplied select element. */
    for (let idx = selectElement.options.length - 1; idx >= 0; idx--){
        selectElement.remove(idx);
    }
}

function getIdNumforNext(text) {
    /** Returns the ID number for the next element of the specified ID type. */
    
    mcInputs = document.querySelectorAll('[id^='+text+']');
    if (mcInputs.length > 0) {
        maxNum = 0;
        for (let idx = 0; idx < mcInputs.length; idx++){
            // idNum = parseInt(mcInputs[idx].id.replace(/.*-(\d{1,4}).*/m, '$1'));
            idNum = mcInputs[idx].id.split("-")[mcInputs[idx].id.split("-").length-1]
            if (idNum.includes('s')) {
                idNum = idNum.split("s")[idNum.split("s").length-1]
            } else if (idNum.includes('_')) {
                idNum = idNum.split("_")[idNum.split(":").length-1]
            }
            idNum = parseInt(idNum)
            if (idNum > maxNum){
                maxNum = idNum;
            }
        }
        result  = maxNum+1
    } else {
        result = 0
    }

    return result.toString()
}