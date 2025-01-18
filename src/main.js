// Development tools
let debugMode = true;                                                                    // Sets default level of console output
let debugModeVisual = false;                                                              // Enables visual debug tools
const version = ("2025-01-05-alpha-beta");
console.log("Version: " + version);
console.log("To activate debug mode, type to console: debug()");

// Fetch core HTML elements
const videoElement          = document.getElementById('cameraFeed');             // Camera feed
const canvasElement         = document.getElementById('canvasMain');             // Main canvas
const selector              = document.querySelector('select#selectorDevice');    // Camera feed selector
const island                = document.getElementById('island_controlBar');      // Floating island control bar
const videoContainer        = document.getElementById('videoContainer');         // Video container
const controlBar            = document.getElementById('controlBar');             // Fixed control bar

// Video feed state
let rotation = 0;                                                                          // Store rotation state
let currentZoom = 1;                                                                       // Current zoom level
let flip = 1;                                                                              // State of image mirroring, 1 = no flip, -1 = horizontal flip
let isFreeze = false;                                                                      // Video freeze on or off

// UI state
let isIslandDragging = false                                                               // Shows if dragging of an island control bar is allowed
let isControlCollapsed = false;                                                            // Are control bar and island in hidden mode or not
let islandX, islandY;                                                                      // Initial position of the control island

// Other
let mouseX;                                                                                // Initial position of the mouse
let mouseY;
let createdElements;                                                                       // Handles created elements


// Initialization

document.addEventListener('DOMContentLoaded', start);                                 // Start running scripts only after HTML has been loaded and elements are available

function start() {

    // Instantiate class for created elements
    createdElements = new CreatedElements();                                                // Handles created elements

    // Add core listeners for interface elements
    addCoreListeners();

    videoStart();
    // TODO: Ensure INITIAL retry, alert and user options are handled especially well
    // TODO: Set up periodic update

    // Handle URL parameters
    const urlParameters = new URLSearchParams(window.location.search);
    if (urlParameters.has('debug')) {
        debugMode = true;
        print("start(): Found URL parameter for debug");
    }
    if (urlParameters.has('privacyAgree')) {
        print("start(): Found URL parameter for agreement to privacy notice");
    }
    if (urlParameters.has('cookieAgree')) {
        print("start(): Found URL parameter for agreement to cookie use");
    }

    // Development
    if (debugMode) debug();

}

/**
 * Adds critical listeners for interface elements
 */
function addCoreListeners() {

    // Fetch HTML elements for buttons and attach event listeners to them
    listenerToElement('buttonRotate', 'click', videoRotate);                                             // Rotate button
    listenerToElement('buttonFlip', 'click', videoFlip);                                                 // Flip button
    listenerToElement('buttonSaveImage', 'click', saveImage);                                            // Save image button
    listenerToElement('buttonOverlay', 'click', addOverlay);                                             // Overlay button
    listenerToElement('buttonAddText', 'click', addText);                                                // Text button
    listenerToElement('buttonSmallerFont', 'click', () => changeFontSize(-5));          // Font size decrease button
    listenerToElement('buttonBiggerFont', 'click', () => changeFontSize(5));            // Font size increase button
    listenerToElement('zoomSlider', 'input', (event) => setZoomLevel(event.target.value));   // Zoom slider                                                             //
    listenerToElement('zoomInButton', 'click', () => adjustZoom(0.1));              // Zoom in button
    listenerToElement('zoomOutButton', 'click', () => adjustZoom(-0.1));            // Zoom out button

    // Make control island draggable.
    island.addEventListener('mousedown', (e) => dragIsland(e));

    // Fetch HTML element for full screen button and it's icon. Attach event listener to full screen button.
    const fullScreenIcon = document.getElementById("iconFullScreen");
    const fullScreenButton = document.getElementById('buttonFullScreen');
    fullScreenButton.addEventListener('click', () => switchToFullscreen(fullScreenIcon));

    // Fetch HTML element for collapse button and its icon. Attach event listener to collapse button.
    const collapseIcon = document.getElementById("iconCollapse");
    const collapseButton = document.getElementById('buttonCollapse');
    collapseButton.addEventListener('click', ()=> toggleControlCollapse(collapseIcon));

    // Fetch HTML element for freeze button and it's icon. Attach event listener to freeze button.
    const freezeIcon = document.getElementById("iconFreeze");
    const freezeButton = document.getElementById('buttonFreeze');
    freezeButton.addEventListener('click', () => videoFreeze(freezeIcon));

    // Add event lister to video element for zooming with mouse scroll.
    const zoomIncrement = 0.1;
    videoElement.addEventListener('wheel', (event) => {
        if (event.deltaY < 0) {
            adjustZoom(zoomIncrement);                // Scroll up, zoom in
        } else {
            adjustZoom(-zoomIncrement);               // Scroll down, zoom out
        }
        event.preventDefault();                       // Remove the page's default scrolling over the image
    });

    // Add event listener to camera feed selector. Change camera feed to the selected one.
    selector.addEventListener('change', (e) => {
        setVideoInput(e.target.value).then(() => {});
    })
}


// Camera control functions

async function getMediaPermission() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });                 // Ask for video device permission (return/promise ignored)
        print("getMediaPermission(): Media permission granted");
        return true;
    } catch (e) {
        print("getMediaPermission(): Media permission denied: " + e.name + " : " + e.message);
        return false;
    }
}

async function getVideoInputs() {

    // A reliably complete input enumeration requires already existing media permissions:
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
    // " The returned list will omit any devices that are blocked by the document Permission Policy:
    // microphone, camera, speaker-selection (for output devices), and so on.
    // Access to particular non-default devices is also gated by the Permissions API,
    // and the list will omit devices for which the user has not granted explicit permission. "

    let videoInputs = [];

    const retryAttempts = 3;                                                                      // Amount of retries before throwing error TODO: Retries in function possibly redundant, though enumeration is not completely reliable
    let failedCount = 0;

    while (true) {                                                                                        // Retry until a device is found

        let devices = await navigator.mediaDevices.enumerateDevices();                                    // Find all media sources

        devices.forEach(device => {
            if (device.kind === 'videoinput') {                                                       // Only accept video sources
                if (device.deviceId === "") {                                                         // Detect and filter invalid values
                    // In some cases (like missing permissions) empty values may be returned.
                    // These values will be objects of the right kind but do not have device Ids and can not be used.
                    console.error("getVideoInputs(): Encountered invalid video input device: " + device.deviceId + " : " + device.label + device.toJSON() + " " + device.toString());
                } else {
                    print("getVideoInputs(): Found video input device: " + shorten(device.deviceId) + " : " + device.label);
                    videoInputs.push([device.deviceId, device.label]);
                    }
                }
        });

        if (videoInputs.length > 0) {                                                                     // Success
            print("getVideoInputs(): Found video input device(s): " + (videoInputs.length - 1));
            return videoInputs;
        }

        if (failedCount >= retryAttempts) {
            console.error("getVideoInputs(): No video sources found, retries: " + failedCount)
            throw Error("No video inputs");
        }
        failedCount++;                                                                                  // Failure(s)
    }
}

function updateInputList(inputs) {

    // TODO: Mismatch prevention: of original selection device no longer exists, should use some empty value in dropdown. If it does exist, must select the original one after list update! Current feed and selected feed must always match! Also handle case where nothing selected.
    let originalSelection = selector.value;

    // Clear and populate list
    selector.innerHTML = '';                                                                        // Clear dropdown first
    for (let i = 0; i < inputs.length; i++) {
        let option = document.createElement('option');                    // Create new option for dropdown
        option.value    = inputs[i][0];
        option.text     = inputs[i][1];
        selector.appendChild(option);                                                               // Add new option to dropdown
        print(i + " = " + inputs[i][0] + " : " + inputs[i][1])
    }

    // Handle selection
    selector.selectedIndex = 0;                                                                     // Select a camera in dropdown
    print("updateInputList(): Selecting a video source: " + shorten(selector.value))

    // Check selection is valid
    let errorValue = "valid";
    if (selector.value === "") errorValue = "empty";
    if (selector.value === undefined) errorValue = "undefined";
    if (selector.value === null) errorValue = "null";
    if (selector.value === "undefined") errorValue = "undefined (string)";                          // Typical for option value set of undefined array values
    if (errorValue !== "valid") {
        console.error("updateInputList(): Failed to select valid initial video source, selection: " + errorValue + " value: " + selector.value);
    } else {
        // Fine
    }

    return selector.value;
}

async function setVideoInput(input = selector.value) {
    const retryAttempts = 3;                                                                     // Amount of retries before giving up
    let failedCount = 0;

    while (true) {
        try {
            print("videoStart(): Accessing a camera feed: " + shorten(input));
            const stream = await navigator.mediaDevices.getUserMedia({                 // Change to the specified camera
                video: {
                    deviceId: {exact: input},
                    facingMode: {ideal: 'environment'},                                          // Request a camera that is facing away from the user. Can also just use video: {facingMode: 'environment'}
                    width: {ideal: 1920},                                                        // These are useless unless there are multiple tracks with the same deviceId
                    height: {ideal: 1080},                                                       // Ideal values are not constraints
                    frameRate: {ideal: 60}
                }
            });
            videoElement.srcObject = stream;

            // TODO: Debug low video quality
            printStreamInformation(stream);

            break;
        } catch (error) {                                                                          // Failure
            console.error("videoStart(): Camera could not be accessed (retry " + failedCount + "): " + error);
            if (failedCount >= retryAttempts) {
                // alert(`'Camera could not be accessed. Make sure the camera is not being used by other software. Try choosing another camera.`); // Alert too intrusive and triggers browser safeguards if repetitive
                console.error("videoStart(): Could not select camera, retries: " + failedCount);
                throw Error("videoStart(): Could not select camera");
                // TODO: Need to deal with persistent failure. Custom prompt with retry options?
            }
            failedCount++;
        }
    }

    return "stream";

}

async function videoStart() {
    getMediaPermission().then(permission => {if (permission) {
        getVideoInputs().then (inputs => {
            let input = updateInputList(inputs);
            let promise = setVideoInput(input);
            resetVideoState();
            return promise;
        }).catch(e => {
            prompt("Error", "No valid cameras could be accessed. Make sure your devices are connected and not used by other software. Check you have allowed camera access in your browser. You may also try a hard reload by pressing Ctrl + F5", [["Retry", () => { videoStart(); } ], ["Dismiss", () => {}]]);
            console.error("videoStart(): No valid inputs: " + e.name + " : " + e.message);
        });
    } else {
        prompt("Error", "No permission to use camera. Check you have allowed camera access in your browser. You may also try a hard reload by pressing Ctrl + F5", [["Retry", () => { videoStart(); } ], ["Dismiss", () => {}]]);
        console.error("videoStart(): No media permission");
        // TODO: Handle generic retry, alert and user options
    }});
}

/**
 * Reset video feed back to its default state.
 */
function resetVideoState() {
    // TODO: Reset video feed back to its default state (transforms, rotation, zoom, etc. but not input selection)
}


// UI functions

/**
 * Drag floating island control bar with mouse. Add event listeners for mousemove and mouseup events.
 * @param e Mouse event 'mousedown'
 */
function dragIsland (e) {

    isIslandDragging = true;

    // Get current coordinates
    mouseX = e.clientX;
    mouseY = e.clientY;
    islandX = parseInt(island.style.left, 10) || 0;  // Parses island's position to decimal number. Number is set to 0 if NaN.
    islandY = parseInt(island.style.top, 10) || 0;

    document.addEventListener('mousemove', (e) => startIslandDrag(e));
    document.addEventListener('mouseup', stopIslandDrag);
}

/**
 * Calculate new position for island control bar. Update island style according new position.
 * @param e Mouse event 'mousemove'
 */
function startIslandDrag(e) {
    if (isIslandDragging) {
        // Calculates new position
        let pos1 = mouseX - e.clientX;
        let pos2 = mouseY - e.clientY;
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Updates the dragged island's position
        island.style.top = (island.offsetTop - pos2) + "px";
        island.style.left = (island.offsetLeft - pos1) + "px";
    }
}

/**
 * Stop Island dragging when mouse key is lifted. Remove event listeners.
 */
function stopIslandDrag() {
    isIslandDragging = false;
    document.removeEventListener('mousemove', startIslandDrag);
    document.removeEventListener('mouseup', stopIslandDrag);
}

/**
 * Updates zoom value and percentage level.
 * @param value Zoom value
 */
function setZoomLevel(value) {
    currentZoom = value / 100;                                                                      // Update zoom value
    updateVideoTransform();
    document.getElementById('zoomPercentageLabel').innerText = `${Math.round(value)}%`;    // Update zoom percentage label
}

/**
 * Adjusts the zoom according to value set by the user.
 * @param increment Zoom increment value
 */
function adjustZoom(increment) {
    let newZoom = currentZoom * 100 + increment * 100;                                      // Change back to percentages, increase or decrease 10%
    newZoom = Math.min(Math.max(newZoom, 100), 200);                                                // Limit zoom between 100% and 200%
    setZoomLevel(newZoom);                                                                          // Zoom in percent %
    document.getElementById('zoomSlider').value = newZoom;                                 // Set zoom slider to the correct position
}

/**
 * Switches the full screen mode on or off.
 * @param fullScreenIcon Full screen icon element
 */
function switchToFullscreen(fullScreenIcon) {

    if(!document.fullscreenElement) {                                   // Is fullscreen active?
        videoContainer.requestFullscreen().then(() => {
            print("switchToFullscreen(): Full screen mode active");
            fullScreenIcon.title = 'Close full screen';
            fullScreenIcon.src = "./images/closeFullScreen.png";
        }).catch(error => {
            alert(`Error attempting to switch to fullscreen mode: ${error.message}`);
        });
    } else {
        document.exitFullscreen().then(() => {                      // Exit full screen mode, if it's already active
            print("switchToFullscreen(): Full screen mode closed successfully");
            fullScreenIcon.title = 'Full screen';
            fullScreenIcon.src = "./images/fullscreen.png";
            island.style.top = '';                                       // UI island to starting position
            island.style.left = '';
        }).catch(error => {
            console.error(`switchToFullscreen(): Error attempting to exit full screen mode: ${error.message}`);
        });
    }
}

/**
 * Hides or shows control bar and island when collapseButton is clicked.
 * @param collapseIcon Icon for collapseButton
 */
function toggleControlCollapse(collapseIcon) {
    isControlCollapsed = !isControlCollapsed;

    if (isControlCollapsed) {
        collapseIcon.title = 'Show controls';
        collapseIcon.src = "./images/showControls.png";
        hideElement(controlBar);
        hideElement(island);
    }
    else {
        collapseIcon.title = 'Hide controls';
        collapseIcon.src = "./images/hideControls.png";
        showElement(controlBar, undefined, 'inline-flex');
        showElement(island, undefined, 'flex');
    }
}

/**
 * Creates a prompt with text and buttons.
 *
 * @param title Title text for prompt
 * @param text Body text for prompt
 * @param options Array with text and code to run for buttons
 * @param position
 */
function prompt(title= "Title", text = "Text", options = [["Dismiss", () => {  }]], position = null) {

    // TODO: Handle concurrent prompts

    // Create prompt element
    const prompt = document.createElement('div');
    prompt.id = '_randomName';                                          // TODO: Ideally would have random name to avoid any chance of id collision
    prompt.style.position = 'fixed';
    prompt.style.left = '50%';
    prompt.style.transform = 'translateX(-50%)';
    prompt.style.width = '200px';
    prompt.style.background = '#454545';
    prompt.style.borderRadius = '10px';
    prompt.style.padding = '10px';
    prompt.style.opacity = '0';
    prompt.style.transition = 'bottom 0.3s ease-out, opacity 0.3s ease-out';
    prompt.style.zIndex = '9999';
    prompt.style.bottom = `0px`;                                          // Initial position before animation

    // Create text
    const textTitle = document.createTextNode(title);
    prompt.appendChild(textTitle);
    const textBody = document.createTextNode(text);
    prompt.appendChild(textBody);

    // Create buttons
    options.forEach((buttonCore) => {
        const button = document.createElement('button');
        button.textContent = `${buttonCore[0]}`;
        button.style.width = '100%';
        button.style.margin = '5px 0';
        button.style.color = '#fff';
        button.style.background = '#555';
        button.style.border = 'none';
        button.style.padding = '10px';

        button.addEventListener('click', () => {
            dismiss();                                                                                              // Buttons should always dismiss prompt
            buttonCore[1]();
        });

        prompt.appendChild(button);
    });

    document.body.appendChild(prompt);

    // Animation: fade in
    requestAnimationFrame(() => {
        prompt.style.bottom = `${document.getElementById('controlBar').offsetHeight + 10}px`;               // Position after animation, above control bar
        prompt.style.opacity = '1';
    });

    // Dismiss prompt after timeout
    // setTimeout(() => {
    //     dismiss();
    // }, 1000);}

    // Nested function to dismiss prompt
    function dismiss() {
        // Animation: fade out
        prompt.style.transition = 'bottom 0.3s ease-in, opacity 0.3s ease-in';
        prompt.style.bottom = '-100px';
        prompt.style.opacity = '0';
        setTimeout(() => {
            prompt.style.display = 'none';
            prompt.remove();
        }, 300);

    }

}


// Functionality functions

/**
 * Saves the current view as a jpg file
 * Flattens videoElement and canvasElement to a temporary canvas and saves it
 */
function saveImage() {
    matchElementDimensions(videoElement, canvasElement);                                               // Ensure canvas matches video element (redundancy)

    const canvasToSave = document.createElement('canvas');                  // Create temporary canvas for flattening/combining video feed and canvas together
    const canvasContext = canvasToSave.getContext('2d');               // Get canvas context for drawing
    canvasToSave.style.display = 'none';                                                               // Make sure temporary canvas is never visible (redundancy)
    matchElementDimensions(videoElement, canvasToSave);                                                // Match new canvas with video element

    const videoElementTypecast = /** @type {HTMLVideoElement} */ (videoElement);                // TODO: Fixed type issue with  dirty JSDoc solution for typecast, only TypeScript allows for clear typecast syntax, implicit typecast (type coercion) not good enough
    canvasContext.drawImage(videoElementTypecast, 0, 0, canvasToSave.width, canvasToSave.height);        // Draw frame from video element      // TODO: Without typecast ERR: Type HTMLElement is not assignable to type VideoFrame
    const canvasElementTypecast = /** @type {HTMLCanvasElement} */ (canvasElement);             // TODO: Same JSDoc typecast
    canvasContext.drawImage(canvasElementTypecast, 0, 0, canvasToSave.width, canvasToSave.height);       // Draw content from canvas element  // TODO: Without typecast ERR: HTMLElement is not assignable to parameter type CanvasImageSource, Type HTMLElement is not assignable to type VideoFrame

    const dataURL = canvasToSave.toDataURL('image/jpeg');                   // Converts canvas element to image encoding string
    const downloadElement = document.createElement('a');      // Creates "clickable" element
    downloadElement.href = dataURL;                                                     // Points element to data URL
    downloadElement.download = `${getDateTime()}_SDC_Image.jpg`;                        // Names download
    downloadElement.click();                                                            // Initiates image download without dialog

    // DEV: Alternative to link.click(), may be necessary for some browsers
    // document.body.appendChild(downloadElement);                         // Appends a link to HTML body for saving as file on Firefox
    // downloadElement.dispatchEvent(new MouseEvent('click'));             //
    // document.body.removeChild(downloadElement);                         // Remove link from document

}

/**
 * Rotates video.
 * Calculates rotation in quarter increments: 0 -> 90 -> 180 -> 270 -> 0.
 */
function videoRotate() {
    rotation = (rotation + 90) % 360;
    updateVideoTransform();
}

/**
 * Flip video horizontally.
 * Toggle between 1 (no flip) and -1 (flip).
 */
function videoFlip() {
    flip *= -1;
    updateVideoTransform();
}

/**
 * Toggle between video feed and freeze image (still frame).
 * @param freezeIcon Icon for freeze button
 */
function videoFreeze(freezeIcon) {
    const stream = videoElement.srcObject;                                                     // Get the current video stream

    if (!isFreeze) {                                                                                // If video is not frozen, make it freeze
        if (stream) {
            canvasDrawCurrentFrame();                                                               // Draw frame to canvas overlay, avoiding black feed
            stream.getTracks().forEach(track => track.enabled = false);             // Disable all tracks to freeze the video
        }
        freezeIcon.src = "./images/showVideo.png";                                                  // Change icon image
        freezeIcon.title = "Show video";                                                            // Change tool tip text
        isFreeze = true;                                                                            // Freeze is on
    } else {
        videoStart();
        videoElement.style.display = 'block';
        canvasElement.style.display = 'none';
        freezeIcon.src = "./images/freeze.png";
        freezeIcon.title = "Freeze";
        isFreeze = false;                                                                           // Freeze is off
    }
}


// Utility functions

/**
 * Attaches an event listener to an element based on element id.
 * @param elementId Element id to attach listener to
 * @param eventType Even to listen to
 * @param action Action to trigger on event
 */
function listenerToElement(elementId, eventType, action) {
    const element = document.getElementById(elementId);
    element.addEventListener(eventType, action);
}

/**
 * Returns date and time.
 * @returns {string} Date and time in YYMMDD_hhmmss
 */
function getDateTime() {
    const now = new Date();
    const year = String(now.getFullYear()).slice(2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Draws the current frame of videoElement to canvasElement
 * Hides videoElement, shows canvasElement
 */
function canvasDrawCurrentFrame() {
    matchElementDimensions(videoElement, canvasElement);                                        // Update canvas to match video element
    const canvasContext = canvasElement.getContext("2d");                              // Get canvas context for drawing
    canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);                                                 // Draw frame from video element
    videoElement.style.display = 'none';                                                         // Disable video element visibility
    canvasElement.style.display = 'block';                                                       // Make canvas element visible
}

/**
 * Matches the width, height and transforms of two elements
 * @param elementMaster Element to use as model, will not be changed
 * @param elementSub Element to match, will change
 */
function matchElementDimensions(elementMaster, elementSub) {
    elementSub.width = elementMaster.videoWidth;                  // DEV: Note that element.width refers to CSS width, videoWidth to feed width, may not work with two canvas elements for example
    elementSub.height = elementMaster.videoHeight;

    elementSub.style.transform = elementMaster.style.transform; // Matches ALL transformations, including rotation

}

/**
 * Update style transformations (rotation, flipping, zoom etc.) to video feed and canvas.
 */
function updateVideoTransform() {
    videoElement.style.transform = `scaleX(${flip}) rotate(${rotation}deg) scale(${currentZoom})`;    // Updates video rotation, flipping and current zoom
    canvasElement.style.transform = videoElement.style.transform;                                     // Updates transformations to the canvas (still frame)
}

/**
 * Removes an element.
 * Applies a fade out.
 * @param element Element to remove
 * @param fadeTime Fade duration s (optional)
 */
function removeElement(element, fadeTime = 0.2) {
    element.style.transition = `opacity ${fadeTime}s`;                     // TODO: Use hideElement()
    element.style.opacity = '0';

    setTimeout(() => element.remove(), fadeTime*1000);      // Asynchronous

    print("removeElement(): Removed element: " + element.id);
}

/**
 * Hides an element.
 * Applies a fade out.
 * @param element Element to hide
 * @param fadeTime Fade duration s (optional)
 */
function hideElement(element, fadeTime = 0.3) {
    element.style.transition = `opacity ${fadeTime}s`;
    element.style.opacity = '0';
    // TODO: Add interaction prevention (no click)
    setTimeout(() => {
        element.style.display = 'none';
    }, fadeTime * 1000);
}

/**
 * Shows a hidden element.
 * Applies a fade in.
 * @param element Element to hide
 * @param fadeTime Fade duration in s (optional)
 * @param displayStyle Display style (optional)
 */
function showElement(element, fadeTime = 0.4, displayStyle = 'block') {
    element.style.opacity = '0';                                // Ensures not visible
    element.style.display = displayStyle;                       // Renders element display
    element.style.transition = `opacity ${fadeTime}s`;

    requestAnimationFrame(() => {                               // Runs code after display is rendered
        element.style.opacity = '1';
    });
}

/**
 * Gets the center coordinates of an HTML element.
 * @param {HTMLElement} element HTML element
 * @returns {{x: number, y: number}} Object with x, y coordinates
 */
function getElementCenter(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + window.scrollX + rect.width / 2; // Rounding with Math.round() should not be necessary
    const y = rect.top + window.scrollY + rect.height / 2;

    return { x, y };           // Example use to create two variables: let {x: centerX, y: centerY} = getElementCenter(element);

    // TODO: Must test if gives real coordinates for some objects (like very large video inputs) that have been resized improperly due to browser window resizing beyond expected bounds
}


// Simple caller methods

/**
 * Adds new overlay.
 */
function addOverlay() {
    new Overlay();
}

/**
 * Adds new text area.
 */
function addText() {
    new TextArea();
}

/**
 * Changes font size.
 * @param size
 */
function changeFontSize(size) {
    TextArea.changeFontSize(size);
}


// Classes for created elements

/**
 * Class for handling created elements.
 */
class CreatedElements {

    elements = [[["classReference"], ["type"], ["other"]]];                 // Contains information on all created elements

    constructor() {

    }

}

/**
 * Parent class for dynamically created movable elements.
 * Parent class should not be directly instantiated (use inheritors instead).
 */
class MovableElement {

    type;

    // Element references
    element;
    container;
    resizeHandle;

    listeners;

    constructor(type) {
        this.type = type;
    }

    // Setters

    setElement(element) {
        this.element = element;
    }

    // Getters

    getType() {
        return this.type;
    }

    getElement() {
        return this.element;                                                            // Returns main HTML element reference
    }

    getElementId() {
        return this.element.getAttribute('id');                                                    // Returns main HTML element id
    }

    // Styling
    hide() {
        hideElement(this.element);
    }

    show() {
        showElement(this.element);
    }

    // Management
    delete() {
        this.errorUnimplemented();
    }

    // Other

    /**
     * Creates new element and a remove button for it.
     * @param type Element type to add (tagName)
     * @param number Number of element (for avoiding identical ids)
     * @param idBase Identifier base for added element
     * @param elementCssStyle CSS style for added element
     * @param buttonCssStyle CSS style for remove button
     */
    createElement(type, number, idBase, elementCssStyle, buttonCssStyle) {

        // Create main element
        let newElement = document.createElement(type);
        newElement.id = number + idBase;            // TODO: Change method to take id from caller instead of forming an id here. Caller must make sure id is new and not taken.
        newElement.class = idBase;
        newElement.style.cssText = elementCssStyle // New elements style must be edited in js
        print("createElement(): Added element: " + newElement.id);

        // Create remove button
        let removeButton = document.createElement('button');
        removeButton.class = "removeButton";
        removeButton.id = number + "remove";
        removeButton.title = "Remove";
        removeButton.textContent = "X";
        removeButton.style.cssText = buttonCssStyle;
        removeButton.addEventListener('click', () => removeElement(newElement));
        print("createElement(): Added remove button " + removeButton.id + " for: " + newElement.id);

        // Remove buttons only visible when hovered over TODO: Add fast fade
        newElement.addEventListener('mouseover', () => (
            removeButton.style.display = "block"
        ));
        newElement.addEventListener('mouseout', () => (
            removeButton.style.display = "none"
        ));

        // Add element after island in HTML
        island.after(newElement);
        newElement.appendChild(removeButton);

        return newElement;
    }

    // Development
    errorUnimplemented() {
        throw new Error("Called unimplemented method in parent class MovableElement");
    }

}

/**
 * Class for dynamically created overlay elements.
 */
class Overlay extends MovableElement {

    // Styles
    static overlayStyle = "width:105%; height:105%; background: linear-gradient(to bottom, #e6e6e6, #222222); cursor:move; z-index:10; position:absolute; left:2%; top:2%;";
    static closeButtonStyle = "margin:auto;background:white;border-color:grey;width:5%;height:20px;margin-top:-10px;display:none;"

    // Class shared variables
    static overlayCount = 0;                                                                // Counter for overlays
    static isOverlayDragging = false;                                                       // Shows if dragging of an overlay element is allowed

    // Other
    overlayX;                                                                                       // Initial position of the overlay when starting drag
    overlayY;


    // Initialization

    /**
     * Instantiates class.
     * Relies on parent class.
     */
    constructor() {
        super('overlay');
        this.create();
    }

    /**
     * Creates new overlay on top of feed.
     * Draggable.
     */
    create() {
        // Create main element
        this.element = super.createElement("div", Overlay.overlayCount, "overlay", Overlay.overlayStyle, Overlay.closeButtonStyle);

        // Add listeners
        this.handleListeners();

        Overlay.overlayCount++;
    }

    /**
     * Adds listener for drag of overlay.
     */
    handleListeners() {
        // Add listener for drag
        print("handleListeners(): Adding drag listener for overlay: " +  Overlay.overlayCount + "overlay");
        let overlay = document.getElementById(Overlay.overlayCount + "overlay");
        overlay.addEventListener('mousedown', (e) => this.dragStart(e, overlay)); // Start overlay dragging
    }


    // Drag handling

    /**
     * Handles dragging overlay elements with mouse.
     * Starts drag.
     * @param e MouseEvent 'mousedown'
     * @param overlay Overlay element
     */
    dragStart(e, overlay) {
        print("dragStart(): Overlay drag initiated");

        overlay.style.zIndex = '10'
        Overlay.isOverlayDragging = true;

        // Stores the initial mouse and overlay positions
        mouseX = e.clientX;
        mouseY = e.clientY;
        this.overlayX = parseInt(overlay.style.left, 10) || overlay.offsetLeft || 0;  // Parses overlay's position to decimal number. Number is set to 0 if NaN.
        this.overlayY = parseInt(overlay.style.top, 10) || overlay.offsetTop || 0;

        // Stores references to the event handlers
        const mouseMoveHandler = (event) => this.dragUpdater(event, overlay);
        const mouseUpHandler = () => this.dragStop(overlay, mouseMoveHandler, mouseUpHandler);

        // Event listeners for mouse move and release
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    }

    /**
     * Calculates new position for overlay when dragged with mouse.
     * Runs while dragging.
     * @param e MouseEvent 'mousemove'
     * @param overlay Overlay element
     */
    dragUpdater(e, overlay) {
        if (Overlay.isOverlayDragging) {
            // Calculates new position
            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;

            // Updates the dragged overlay's position
            overlay.style.left = `${this.overlayX + deltaX}px`;
            overlay.style.top = `${this.overlayY + deltaY}px`;
        }
    }

    /**
     * Stops overlay dragging.
     * @param overlay Overlay element
     * @param mouseMoveHandler EventListener
     * @param mouseUpHandler EventListener
     */
    dragStop(overlay, mouseMoveHandler, mouseUpHandler) {
        print("dragStop(): Overlay drag stopped");

        overlay.style.zIndex = '10';
        Overlay.isOverlayDragging = false;

        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    }

}

/**
 * Class for dynamically created text area elements.
 */
class TextArea extends MovableElement {

    // Styles
    static textAreaStyle = "position:absolute;width:100%;height:100%;font-size:30px;resize:none;overflow:auto;cursor:move;font-size:30px;"
    static closeButtonStyle = "left:0;background:white;border-color:grey;width:20px;height:20px;margin-top:-18px;position:absolute;display:none;border-radius:10px;padding-bottom:10px;"
    static containerStyle = "position:absolute;left:300px;top:100px;min-width:150px;min-height:40px;z-index:7;"
    static resizeHandleStyle = "width:15px;height:15px;background-color:gray;position:absolute;right:0;bottom:0px;cursor:se-resize;z-index:8;clip-path:polygon(100% 0, 0 100%, 100% 100%);";

    // Class shared variables
    static textAreaCount = 0;                                                                // Counter for text areas
    static activeTextArea;                                                                           // Shows which text area is currently active TODO: Deprecate, if this object class instance is called by mouse event, currently active is always this.element

    // Other
    offsetXText;                                                                                      // Initial position of the text area when starting drag
    offsetYText;
    startWidth;                                                                                       // Initial size of the text area when starting resize
    startHeight;
    isMoving = false;                                                                        // Is text area moving
    isResizing = false;                                                                      // Textarea resizing


    // Initialization

    /**
     * Instantiates class.
     * Relies on parent class.
     */
    constructor() {
        super('textArea');
        this.create();
    }

    /**
     * Creates new text area on top of feed.
     * Draggable, resizable.
     */
    create() {
        // Create container
        this.container = super.createElement("div", TextArea.textAreaCount, "textAreaContainer", TextArea.containerStyle, TextArea.closeButtonStyle); // DEV: Avoid string-based gets: document.getElementById(TextArea.textAreaCount + "textAreaContainer");

        // Create main element
        this.element = document.createElement("textarea");
        this.element.id = TextArea.textAreaCount + "textArea";
        this.element.placeholder = "Text";
        this.element.style.cssText = TextArea.textAreaStyle;
        this.element.spellcheck = false;                                                                                               // Try to prevent spell checks by browsers
        this.container.appendChild(this.element);
        if (TextArea.activeTextArea === undefined) TextArea.activeTextArea = this.element;                                             // Makes font size buttons work even when text area was not clicked TODO: Deprecate, activeTextArea, only functional dependency is right here, related to the font size modifier, see changeFontSize()

        // Add resize handle
        this.resizeHandle = document.createElement("div");                                                                     // Option to resize the textArea box
        this.resizeHandle.id = TextArea.textAreaCount + "resizeHandle";
        this.resizeHandle.style.cssText = TextArea.resizeHandleStyle;
        this.container.appendChild(this.resizeHandle);

        // Add resize listeners
        this.handleListeners();

        TextArea.textAreaCount++;
    }

    /**
     * Adds listeners for drag and resize of text area.
     */
    handleListeners() {
        this.container.addEventListener("mousedown", (e) => this.dragStart(e));                                               // Handle mousedown action (for text area and resize handle)
        this.container.addEventListener("mousemove", (e) => this.dragUpdater(e));                                             // Handle mousemove action (for text area and resize handle)
        this.container.addEventListener("mouseup", () => this.dragStop());                                      // Stop moving or resizing when the mouse is released
        this.element.addEventListener('input', () => this.resizeToFitText(this.element, this.container));                     // Expand to fit text
    }


    // Drag and sizing handling

    /**
     * Activates the selected text area with mouse click and captures the mouse click position.
     * Attaches event listeners for `mousemove` and `mouseup`.
     * @param e MouseEvent 'mousedown'
     */
    dragStart(e) {
        TextArea.activeTextArea = this.element; // TODO: Deprecate, if this object class instance is called by mouse event, currently active is always this.element, see changeFontSize()
        this.container.style.zIndex = '7';

        if (e.target === this.element) {                           // Check is the mouse click event is on the text area
            this.isMoving = true;
            this.offsetXText = e.clientX - this.container.offsetLeft;
            this.offsetYText = e.clientY - this.container.offsetTop;
            this.container.style.cursor = "move";
        } else {                                                    // Mouse click was (likely) on resize handle: this.resizeHandle
            this.isResizing = true;
            this.startWidth = this.container.offsetWidth;
            this.startHeight = this.container.offsetHeight;
            this.offsetXText = e.clientX;
            this.offsetYText = e.clientY;
        }

        // Add temporary drag handlers

        // TODO: These are duplicates of existing event handlers. Without these, however, dragging and especially resize are sluggish, though they do work. These handlers have generic naming (risky when intended to be deleted) regardless of limited intended scope.

        const mouseMoveHandler = (e) => this.dragUpdater(e);
        document.addEventListener("mousemove", mouseMoveHandler);           // Handles mousemove event for text area. Starts text area drag or resizing text area.

        const mouseUpHandler = () => this.dragStop(mouseMoveHandler, mouseUpHandler);
        document.addEventListener("mouseup", mouseUpHandler);               // Handles mouseup event for text area. Stops text area drag.
    }

    /**
     * Moves or expands the text area according to mouse movement.
     * Sets new position for text area and its container.
     * @param e MouseEvent 'mousemove'
     */
    dragUpdater(e) {
        if (this.isMoving) {                                                                              // Move the textarea when the mouse moves
            const x = e.clientX - this.offsetXText;                                               // new position x for textarea container
            const y = e.clientY - this.offsetYText;                                               // new position y
            this.container.style.left = `${x}px`;
            this.container.style.top = `${y}px`;
        } else if (this.isResizing) {                                                                      // Expand the textarea when the mouse moves
            const newWidth = this.startWidth + (e.clientX - this.offsetXText);                             // New width for textarea container
            const newHeight = this.startHeight + (e.clientY - this.offsetYText);                           // New height
            this.container.style.width = `${newWidth}px`;
            this.container.style.height = `${newHeight}px`;

            this.element.style.width = `${newWidth}px`;
            this.element.style.height = `${newHeight}px`;
        }
    }

    /**
     * Stops text area dragging and removes event listeners mousemove and mouseup.
     * @param mouseMoveHandler handler for mousemove
     * @param mouseUpHandler handler for mouseup
     */
    dragStop(mouseMoveHandler, mouseUpHandler) {
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
        this.isMoving = false;
        this.isResizing = false;
        this.container.style.cursor = "default";
    }

    /**
     * Expands textarea if content exceeds current height.
     * @param textArea TextArea element
     * @param textAreaContainer TextAreaContainer element
     */
    resizeToFitText(textArea, textAreaContainer) {
        if (textArea.scrollHeight > textArea.offsetHeight) {
            textArea.style.height = `${textArea.scrollHeight}px`;
            textAreaContainer.style.height = textArea.style.height;
        }
        // TODO: Will not work if amount of text is very low (1-4 characters) or there are no spaces (impedes word wrap)
        // TODO: Should also be run when font + is pressed, see changeFontSize()
    }


    // Font size handling

    /**
     * Changes the active text area's font size
     * @param size Size value
     */
    static changeFontSize(size) {
        let fontSize = parseFloat(TextArea.activeTextArea.style.fontSize);                             // Get fontsize without "px"
        fontSize += size;                                                                                      // Make font size bigger or smaller
        TextArea.activeTextArea.style.fontSize = fontSize + "px";                                              // Change active text area's font size
        // TODO: Eliminate static function and add resize call for container based on text size: this.resizeToFitText(this.textAreaElement, this.element)
    }

}


// Developer functions

/**
 * Function to enable debug mode.
 */
function debug() {
    debugMode = true;
    if (debugMode) {
        print("Debug mode is enabled!");
        print("Happy developing ✨");
    }

    // Enable developer menu
    const developerButton = document.createElement('button');
    developerButton.id = 'buttonDev';
    developerButton.title = 'Developer';
    developerButton.textContent = 'Developer Options';
    developerButton.addEventListener('click', developerMenu);
    developerButton.style.zIndex = '9999';
    developerButton.style.border = '2px solid black';
    developerButton.style.height = '40px';
    // developerButton.style.height = document.getElementById("controlBar").style.height - 20;

    // const placement = document.getElementById('textControls');
    controlBar.appendChild(developerButton);

}

/**
 * Function to enable visual debug features.
 */
function debugVisual() {
    debugModeVisual = !debugModeVisual;
    if (debugModeVisual) {
        print("Visual debug enabled!");

        // Indicate element centers
        debugVisualDrawCenterTrackingIndicator(videoElement, 20, 'red', '0.8');
        debugVisualDrawCenterTrackingIndicator(videoContainer, 40, 'Turquoise', '0.5');
        debugVisualDrawCenterTrackingIndicator(canvasElement, 60, 'green', '0.4');
    } else {
        print("Visual debug disabled!");
    }
}

/**
 * Function to create and toggle developer options -menu.
 */
function developerMenu() {
    print("developerMenu(): Developer menu button pressed");

    prompt("Developer menu", "Options for developers", [
        ["Toggle visual debug", () => { debugVisual(); }],
        ["Test dark theme", () => { testThemeDark(); }],
        ["No function", () => { console.error("Button has no function yet"); }]
    ]);

}

/**
 * Outputs strings to console if debug is enabled.
 * Used in development.
 * @param string String to output
 */
function print(string) {
    if (!debugMode) return;
    console.log(string);
}

/**
 * Prints video track settings and capabilities for all tracks associated with a stream.
 * For development.
 * @param stream The stream from navigator.mediaDevices.getUserMedia()
 */
function printStreamInformation(stream) {
    // const videoTrack = stream.getVideoTracks()[0];

    print ("printStreamInformation(): Found " + stream.getVideoTracks().length + " video track(s) in stream");
    let count = 1;
    stream.getVideoTracks().forEach(videoTrack => {
        // Printing select information
        const { deviceId, width: settingWidth, height: settingHeight, frameRate } = videoTrack.getSettings();
        const { width: capabilityWidth, height: capabilityHeight, frameRate: capabilityFrameRate } = videoTrack.getCapabilities();

        print("printStreamInformation(): Video track " + count + " is: " + shorten(videoTrack.id) + " from device ID: " + shorten(deviceId));
        print("printStreamInformation(): Video track " + count + " is set to use: " + settingWidth + " x " + settingHeight + " at " + frameRate + " fps");
        print("printStreamInformation(): Video track " + count + " is capable of: " + capabilityWidth.max + " x " + capabilityHeight.max + " at " + capabilityFrameRate.max + " fps");

        // To print a full formatted output with all information:
        // print("printStreamInformation(): Settings: " + JSON.stringify(videoTrack.getSettings(), null, 2));
        // print("printStreamInformation(): Capabilities: " + JSON.stringify(videoTrack.getCapabilities(), null, 2));
    });

}

/**
 * Shortens a long string.
 * Used for long hex device ids.
 * @param id
 * @returns {string}
 */
function shorten(id) {
    return `${id.slice(0, 4)}:${id.slice(-4)}`;
}

/**
 * Creates center tracking indicator on HTML element.
 * @param element
 * @param size
 * @param color
 * @param opacity
 */
function debugVisualDrawCenterTrackingIndicator(element, size, color, opacity) {
    let interval = setInterval(() => {
        if (debugModeVisual === false) {clearInterval(interval);}
        const {ball: ball, label: label} = drawCenterIndicator(element, size, color, opacity);
        setTimeout(() => {
            ball.remove();
            label.remove();
        }, 300);
    }, 300);
}

/**
 * Creates an indicator for the center of an HTML element.
 * @param element
 * @param size
 * @param color
 * @param opacity
 * @param zindex
 * @returns {{ball: HTMLDivElement, label: HTMLDivElement}}
 */
function drawCenterIndicator(element, size, color = 'green', opacity = '1', zindex = '100') {
    let horizontalOffset = size / 2 * 1.05 + 10;
    let {x: centerX, y: centerY} = getElementCenter(element);
    let text = centerX + " " + centerX  + " " + " is center of: " + (element.getAttribute('id') || 'id_undefined') + " " + (element.getAttribute('class') || '');

    const ball = drawBall(centerX, centerY, size, color, opacity, zindex);
    const label = drawLabel(centerX + horizontalOffset, centerY, size, color, opacity, zindex, text);

    return { ball, label };
}

/**
 * Draws a ball (with its center) at the coordinates.
 * HTML/CSS implementation.
 *
 * @param coordinateX
 * @param coordinateY
 * @param diameter
 * @param color
 * @param opacity
 * @param zindex
 * @returns {HTMLDivElement}
 */
function drawBall(coordinateX, coordinateY, diameter, color = 'green', opacity = '1', zindex = '100') {
    // print("Drew " + color + " ball at X: " + coordinateX + " Y: " + coordinateY);

    const ball = document.createElement('div');
    ball.style.position = 'absolute';
    ball.style.left = `${coordinateX - diameter / 2}px`;
    ball.style.top = `${coordinateY - diameter / 2}px`;
    ball.style.width = `${diameter}px`;
    ball.style.height = `${diameter}px`;
    ball.style.backgroundColor = color;
    ball.style.borderRadius = '50%';
    ball.style.zIndex = zindex;
    ball.style.opacity = opacity;
    ball.style.pointerEvents = 'none';                    // Make not clickable

    document.body.appendChild(ball);

    return ball;
}

/**
 * Draws a label (with the middle of its left edge) at the coordinates
 * HTML/CSS implementation.
 *
 * @param coordinateX
 * @param coordinateY
 * @param height
 * @param backgroundColor
 * @param opacity
 * @param zindex
 * @param text
 * @returns {HTMLDivElement}
 */
function drawLabel(coordinateX, coordinateY, height, backgroundColor = 'green', opacity = '1', zindex = '100', text = "text") {
    // print("Drew " + backgroundColor + " label at X: " + coordinateX + " Y: " + coordinateY);

    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.left = `${coordinateX}px`;
    label.style.top = `${coordinateY - height / 2}px`;
    label.style.width = 'auto';
    label.style.height = `${height}px`;
    label.style.backgroundColor = backgroundColor;
    label.style.color = 'black';
    label.style.opacity = opacity;
    label.style.zIndex = zindex;
    label.style.pointerEvents = 'none';
    label.textContent = text;

    document.body.appendChild(label);

    return label;
}

/**
 * Calculates and visualizes how many times an action is run per second.
 * Used in assessment of listener performance.
 */
function debugShowRunSpeed() {

}

/**
 * Calculates the time between the current and last instance of running this function.
 * Used to determine latencies.
 */
function calculateRunTime() {

    // Store time for calculation in a non-displayed HTML element, not global variable
}

/**
 * Function to apply UI coloration.
 * Dark in testing phase, dark defaults.
 * @param colorBackground
 * @param colorIsland
 * @param colorBottomBar
 * @param colorFeedSelector
 * @param colorText
 * @param buttonStyleFilter
 */
function testThemeDark(colorBackground = '#2f2f2f', colorIsland = '#474747', colorBottomBar = '#212121', colorFeedSelector = '#171717', colorText = '#ffffff', buttonStyleFilter = 'invert(1) grayscale(100%)') {

    const dev = document.getElementById('buttonDev');
    const background = document.body;
    const island = document.getElementById('island_controlBar');
    const bottomBar = document.getElementById('controlBar');
    const selector = document.getElementById('selectorDevice');
    const zoomControls = document.getElementById('zoomControls');
    const textControls = document.getElementById('textControls');

    dev.style.backgroundColor = colorBackground;
    dev.style.color = colorText;

    background.style.backgroundColor = colorBackground;
    background.style.color = colorText;

    island.style.backgroundColor = colorIsland;
    island.style.color = colorText;

    bottomBar.style.backgroundColor = colorBottomBar;
    bottomBar.style.color = colorText;

    selector.style.backgroundColor = colorFeedSelector;
    selector.style.color = colorText;

    zoomControls.style.color = colorText;

    textControls.style.color = colorText;

    // Button color inversion
    document.getElementById('buttonRotate').style.filter        = buttonStyleFilter;
    document.getElementById('buttonFlip').style.filter          = buttonStyleFilter;
    document.getElementById('buttonFreeze').style.filter        = buttonStyleFilter;
    document.getElementById('buttonSaveImage').style.filter     = buttonStyleFilter;
    document.getElementById('buttonOverlay').style.filter       = buttonStyleFilter;
    document.getElementById('buttonAddText').style.filter       = buttonStyleFilter;
    document.getElementById('buttonFullScreen').style.filter    = buttonStyleFilter;
    document.getElementById('buttonCollapse').style.filter      = buttonStyleFilter;

    document.getElementById('zoomOutButton').style.color        = colorText;
    document.getElementById('zoomInButton').style.color         = colorText;
    document.getElementById('buttonSmallerFont').style.color    = colorText;
    document.getElementById('buttonBiggerFont').style.color     = colorText;

}