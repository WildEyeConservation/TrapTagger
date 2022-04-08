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

    if (input == "]" || input == "[" ||
        input == ";" || input == "'" ||
        input == "," || input == "." ||
        input == "/") {
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
            instruction.innerHTML = "Tag the cluster as lion by clicking on the 'Lion (1)' button or pressing the keyboard shortcut key '1'";
            break;
        case "selectWildDog":
            instruction.innerHTML = "This cluster consists of 5 images captured within a short timeframe. Save time by tagging the first image in the cluster if the animal is identifiable. There is therefore no need to view the next image in this case. Tag the cluster as wild dog by clicking on the 'Wild Dog (3)' button or pressing the keyboard shortcut key '3'";
            break;
        case "selectNWildDog":
            instruction.innerHTML = "Tag the cluster as wild dog by clicking on the 'Wild Dog (3)' button or pressing the keyboard shortcut key '3'";
            break;
        case "selectPrimate":
            instruction.innerHTML = "Tag the cluster as primate by clicking on the 'Primate (P)' button or pressing the keyboard shortcut key 'P'";
            break;
        case "nextImage":
        case "nothing1":
        case "nothing2":
        case "nothing3":
        case "unknown1":
        case "unknown2":
            instruction.innerHTML = "Click on the 'Next Image' button or pressing the keyboard right arrow key to view the next image in a cluster when the image is unclear or empty";
            break;
        case "prevCluster":
            instruction.innerHTML = "Click on the 'Previous Cluster / Undo' button or pressing the keyboard tilde '~' key to review a previous cluster";
            break;
        case "selectMultiple":
            instruction.innerHTML = "Click on the 'Multiple Species (Ctrl)' button or pressing the keyboard control 'Ctrl' key to select multiple species";
            break;
        case "selectMultipleA":
            instruction.innerHTML = "Add antelope to the cluster by clicking on the 'Antelope (A)' button or pressing the keyboard shortcut key 'A'";
            break;
        case "selectMultipleDone":
            instruction.innerHTML = "Click on the 'Done (Ctrl)' button or pressing the keyboard control 'Ctrl' key to end multiple species";
            break;
        case "selectNothing":
            instruction.innerHTML = "Tag the cluster as nothing if none of the images has an animal by clicking on the 'Nothing (N)' button or pressing the keyboard shortcut key 'N'";
            break;
        case "selectHyeana":
        case "selectHyeanaNote":
            instruction.innerHTML = "Tag the cluster as hyeana by clicking on the 'Hyeana (7)' button or pressing the keyboard shortcut key '7'";
            break;
        case "selectUnknown":
            instruction.innerHTML = "Tag the cluster as unknown by clicking on the 'Unknown (U)' button or pressing the keyboard shortcut key 'U'";
            break;
        case "addNote":
            instruction.innerHTML = "Add a note by pressing the keyboard 'enter' key";
            break;
        case "submitNote":
            instruction.innerHTML = "Submit your note";
            break;
        case "selectZebra":
            instruction.innerHTML = "Use the following keyboard shortcut keys to play with the image brightness, contrast, saturation and zoom to identify and tag the animal";
            help.innerHTML = "Increase brightness: ( ] ), decrease brightness: ( [ ), increase contrast: ( ; ), decrease contrast: ( ' ),<br />increase saturation: ( < ), decrease saturation: ( > ) and reset the image settings: ( / )<br />Zoom in or out with your computer mouse wheel";
            break;
        case "knockedDown":
            instruction.innerHTML = "If the camera is taking images of the ground, please tag the cluster as knocked down by clicking on the 'Knocked Down (Q)' button or pressing the keyboard shortcut key 'Q'";
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