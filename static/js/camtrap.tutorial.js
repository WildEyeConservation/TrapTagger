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

var state = "selectLion";

function tutProcessUserInput(input) {
    /** Processes the user input for the tutorial. */
    var status = document.getElementById("tutStatus");
    var correctUserInput = false;
    var allowableUserInput = false;

    switch (state) {
        case "selectLion":
            if (input == "1329") correctUserInput = true;
            break;
        case "selectWildDog":
        case "selectNWildDog":
            if (input == "1332") correctUserInput = true;
            break;
        case "selectPrimate":
            if (input == "1375") correctUserInput = true;
            break;
        case "prevCluster":
            if (input == "prevCluster") correctUserInput = true;
            break;
        case "selectMultiple":
            if (input == "multiple") correctUserInput = true;
            break;
        case "selectMultipleA":
            if (input == "1362") correctUserInput = true;
            break;
        case "selectMultipleDone":
            if (input == "multiple") correctUserInput = true;
            break;
        case "nextImage":
        case "nothing1":
        case "nothing2":
        case "nothing3":
        case "unknown1":
        case "unknown2":
            if (input == "nextImage") correctUserInput = true;
            break;
        case "selectNothing":
            if (input == "101") correctUserInput = true;
            break;
        case "selectHyeana":
        case "selectHyeanaNote":
            if (input == "1344") correctUserInput = true;
            break;
        case "selectUnknown":
            if (input == "102") correctUserInput = true;
            break;
        case "addNote":
            if (input == "enter") correctUserInput = true;
            break;
        case "submitNote":
            if (input == "sendNote") correctUserInput = true;
            break;
        case "selectZebra":
            if (input == "1337") correctUserInput = true;
            break;
        case "knockedDown":
            if (input == "104") correctUserInput = true;
            break;
        default:
            break;
    }



    if (['home','end','pageup','pagedown','insert','delete',"]","[",";","'",",",".","/"].includes(input) ||
        // ((input == "101") && (state=="selectNothing") && (!modalNothingKnock.is(':visible'))) ||
        ((input == "104") && (state=="knockedDown") && (!modalNothingKnock.is(':visible'))) ) {
        allowableUserInput = true;
    }

    if (allowableUserInput) {
        // do nothing
    } else if (!correctUserInput) {
        // incorrect user input
        status.innerHTML = "Please try again";
        return false;
    } else {
        // correct -> go to next state
        doNextState();
    }

    // correct -> clear status
    status.innerHTML = "";
    return true;
}

function displayStateInstructions() {
    /** Displays the sintructions for the tutorial. */
    var instruction = document.getElementById("tutInstructions");
    var help = document.getElementById("tutHelp");
    help.innerHTML = "";

    switch (state) {
        case "selectLion":
            instruction.innerHTML = "Annotate the cluster as containing lion by clicking on the 'Lion (1)' button or by pressing the keyboard shortcut key '1'";
            break;
        case "selectWildDog":
            instruction.innerHTML = "This cluster consists of 5 images captured within a short timeframe. Save time by only looking at the first image in the cluster where possible, such as in this case. Annotate the cluster as wild dog by pressing the keyboard shortcut key '3'";
            break;
        case "selectNWildDog":
            instruction.innerHTML = "Annotate the cluster as wild dog by pressing the keyboard shortcut key '3'";
            break;
        case "selectPrimate":
            instruction.innerHTML = "Annotate the cluster as primate by pressing the keyboard shortcut key 'P'";
            break;
        case "nextImage":
        case "nothing1":
        case "nothing2":
        case "nothing3":
        case "unknown1":
        case "unknown2":
            instruction.innerHTML = "Click on the 'Next Image' button or press the right arrow key to view the next image in a cluster when an image is unclear or empty";
            break;
        case "prevCluster":
            instruction.innerHTML = "Click on the 'Previous Cluster / Undo' button or press the tilde '~' key to go back to a previous cluster";
            break;
        case "selectMultiple":
            instruction.innerHTML = "Click on the 'Multiple Species (Ctrl)' button or press the control 'Ctrl' key to enter multiple species mode";
            break;
        case "selectMultipleA":
            instruction.innerHTML = "Add the antelope label to the cluster by pressing the keyboard shortcut key 'A'";
            break;
        case "selectMultipleDone":
            instruction.innerHTML = "Click on the 'Done (Ctrl)' button or press the control 'Ctrl' key to exit multiple species mode";
            break;
        case "selectNothing":
            instruction.innerHTML = "Annotate the cluster as containing nothing if none of the images contains an animal by pressing the keyboard shortcut key 'N'";
            break;
        case "selectHyeana":
        case "selectHyeanaNote":
            instruction.innerHTML = "Annotate the cluster as hyeana by pressing the keyboard shortcut key '7'";
            break;
        case "selectUnknown":
            instruction.innerHTML = "Annotate the cluster as unknown by pressing the keyboard shortcut key 'U'";
            break;
        case "addNote":
            instruction.innerHTML = "Add a note to the cluster by pressing the 'enter' key";
            break;
        case "submitNote":
            instruction.innerHTML = "Submit your note";
            break;
        case "selectZebra":
            instruction.innerHTML = "Use the following shortcut keys to play with the image brightness, contrast, and saturation to identify and annotate the animal";
            help.innerHTML = "Increase ( insert or ] ), decrease ( delete or [ ) brightness<br />increase ( home or ; ), decrease ( end or ' ) contrast<br />increase ( pageup or < ), decrease ( pagedown or > ) saturation<br />reset the image settings ( backspace or / )<br />zoom in or out with your mouse wheel";
            break;
        case "knockedDown":
            instruction.innerHTML = "If a camera has been knocked over, mark it as knocked down by pressing the keyboard shortcut key 'Q'";
            break;
        case "done":
            instruction.innerHTML = "Tutorial complete";
            var currentTask = localStorage.getItem("currentTask");
            if (currentTask != null) {
                window.location.replace('/dotask/'+currentTask);
            } else {
                window.location.replace("jobs");
            }
            break;
        default:
            break;
    }
}

function doNextState() {
    /** Goes to the next state. */
    switch (state) {
        case "selectLion": state = "selectWildDog";
            break;
        case "selectWildDog": state = "selectPrimate";
            break;
        case "selectPrimate": state = "prevCluster";
            break;
        case "prevCluster": state = "selectMultiple";
            break;
        case "selectMultiple": state = "selectMultipleA";
            break;
        case "selectMultipleA": state = "selectMultipleDone";
            break;
        case "selectMultipleDone": state = "nextImage";
            break;
        case "nextImage": state = "selectNWildDog";
            break;
        case "selectNWildDog": state = "nothing1";
            break;
        case "nothing1": state = "nothing2";
            break;
        case "nothing2": state = "nothing3";
            break;
        case "nothing3": state = "selectNothing";
            break;
        case "selectNothing": state = "unknown1";
            break;
        case "unknown1": state = "unknown2";
            break;
        case "unknown2": state = "selectHyeana";
            break;
        case "selectHyeana": state = "selectUnknown";
            break;
        case "selectUnknown": state = "addNote";
            break;
        case "addNote": state = "submitNote";
            break;
        case "submitNote": state = "selectHyeanaNote";
            break;
        case "selectHyeanaNote": state = "selectZebra";
            break;
        case "selectZebra": state = "knockedDown";
            break;
        case "knockedDown": state = "done";
            break;
        default:
            break;
    }

    displayStateInstructions();
}