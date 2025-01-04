// Development tools
let debugMode = false;                                                                     // Sets default level of console output
let debugModeVisual = false;                                                               // Enables visual debug tools
const version = ("2025-01-03-beta");
console.log("Version: " + version);
console.log("To activate debug mode, type to console: debug()");

// Fetch core HTML elements
const videoElement      = document.getElementById('cameraFeed');             // Camera feed
const canvasElement     = document.getElementById('canvasMain');             // Main canvas
const selector              = document.querySelector('select#selectorDevice');    // Camera feed selector
const island            = document.getElementById('island_controlBar');      // Floating island control bar
const videoContainer    = document.getElementById('videoContainer');         // Video container
const controlBar        = document.getElementById('controlBar');             // Fixed control bar

// Video feed state
let rotation = 0;                                                                          // Store rotation state
let currentZoom = 1;                                                                       // Current zoom level
let flip = 1;                                                                              // State of image mirroring, 1 = no flip, -1 = horizontal flip
let isFreeze = false;                                                                      // Video freeze on or off

// UI state
let isIslandDragging = false                                                               // Shows if dragging of an island control bar is allowed
let isControlCollapsed = false;                                                            // Are control bar and island in hidden mode or not
let islandX, islandY;                                                                              // Initial position of the control island

// Other
let mouseX;                                                                                        // Initial position of the mouse
let mouseY;
let createdElements;                                                                               // Handles created elements


// Initialization

document.addEventListener('DOMContentLoaded', start);                                         // Start running scripts only after HTML has been loaded and elements are available

function start() {

    // Instantiate class for created elements
    createdElements = new CreatedElements();                                                       // Handles created elements

    // Add core listeners for interface elements
    addCoreListeners();

    // Find video devices first, then start a video feed (required due to asynchronous functions)
    findMediaDevices().then(() => {
        videoStart().then(() => {});
    });

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

    // Make control island draggable.
    island.addEventListener('mousedown', (e) => dragIsland(e));

    // Add event lister to video element for zooming with mouse scroll.
    const zoomIncrement = 0.1;
    videoElement.addEventListener('wheel', (event) => {
        if (event.deltaY < 0) {
            adjustZoom(zoomIncrement);                // Scroll up, zoom in
        } else {
            adjustZoom(-zoomIncrement);               // Scroll down, zoom out
        }
        event.preventDefault();                      // Remove the page's default scrolling over the image
    });

    // Add event listener to camera feed selector. Change camera feed to the selected one.
    selector.addEventListener('change', () => {
        videoStart();                                   // Can also forward camera deviceId: changeCamera(event.target.value);
    })
}


// Camera control functions

/**
 * Finds all video media devices and lists them to feed selector dropdown.
 * @returns {Promise<void>}
 */
async function findMediaDevices() {
    const retryAttempts =3;

    let failedCount = 0;
    while (true) {                                                                                      // Run until a device is found
        selector.innerHTML = '';                                                                        // Clear dropdown first
        let foundVideoInputs = 0;
        await navigator.mediaDevices.enumerateDevices().then(devices => {               // Find all media sources
            for (let i = 0; i < devices.length; i++) {
                if (devices[i].kind === 'videoinput') {                                                 // Only use video sources
                    print("findMediaDevices(): Added video input device to menu: " + devices[i].label + " " + devices[i].deviceId);
                    foundVideoInputs++;
                    let option = document.createElement('option');            // Create new option for dropdown
                    option.value = devices[i].deviceId;
                    option.text = devices[i].label;
                    selector.appendChild(option);                                                       // Add new option to dropdown
                }
            }
        })
        if (foundVideoInputs > 0) {
            // Success
            selector.selectedIndex = 0;                                                                // Select an initial camera in dropdown to prevent mismatch between choice and used feed
            print("findMediaDevices(): Selecting initial video source: " + selector.value)
            if (selector.value === "" || selector.value === undefined || selector.value === null) {
                console.error("findMediaDevices(): Failed to select initial video source")
            }
            break;
        }

        // Failure
        if (failedCount > retryAttempts) {
            console.error("findMediaDevices(): No video sources found, retries: " + failedCount)
            // throw Error("No video inputs");
        }
        failedCount++;
    }

    // TODO: Function needs a logic for persistent failure
    // TODO: Ensure the check is run periodically to update device list without need to refresh page, but note that mismatch between choice and current feed must be prevented
}

/**
 * Assigns currently selected camera to HTML element for camera feed.
 * Requests media device access.
 * @returns {Promise<void>}
 */
async function videoStart() {
    while (true) {
        try {
            print("videoStart(): Accessing a camera feed: " + selector.value);
            const stream = await navigator.mediaDevices.getUserMedia({                 // Change to the specified camera
                video: {
                    deviceId: {exact: selector.value},
                    facingMode: {ideal: 'environment'},                                          // Request a camera that is facing away from the user. Can also just use video: {facingMode: 'environment'}
                    width: {ideal: 1920},                                                        // These are useless unless there are multiple tracks with the same deviceId
                    height: {ideal: 1080},
                    frameRate: {ideal: 60}
                }
            });
            videoElement.srcObject = stream;

            // TODO: Debug low video quality
            printStreamInformation(stream);

            break;
        } catch (error) {
            console.error("videoStart(): Camera could not be accessed: " + error);
            alert(`'Camera could not be accessed. Make sure the camera is not being used by other software. Try choosing another camera.`);
            // TODO: User may get stuck here with alerts, if no camera works
        }
    }

    resetVideoState();
}

/**
 * Reset video feed back to its default state.
 */
function resetVideoState() {
    // TODO: Reset video feed back to its default state (rotation, zoom, etc.)
}


// UI functions

/**
 * Drag floating island control bar with mouse. Add event listeners for mousemove and mouseup events.
 * @param e Mouse event 'mousedown'
 */
function dragIsland (e) {

    isIslandDragging = true;

    //Get current coordinates
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
            print("switchToFullscreen(): Full screen mode successfully closed");
            fullScreenIcon.title = 'Full screen';
            fullScreenIcon.src = "./images/fullscreen.png";
            island.style.top = '';                                       // UI island to starting position
            island.style.left = '';
        }).catch(error => {
            console.error(`Error attempting to exit full screen mode: ${error.message}`);
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
    const canvasElementTypecast = /** @type {HTMLCanvasElement} */ (canvasElement);            // TODO: Same JSDoc typecast
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
 * Rotate video. Calculate rotation 0 -> 90 -> 180 -> 270 -> 0
 */
function videoRotate() {
    rotation = (rotation + 90) % 360;
    updateVideoTransform();
}

/**
 * Flip video horizontally. Toggle between 1 (no flip) and -1 (flip).
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
 * Attaches an event listener to an element
 * @param elementId
 * @param eventType
 * @param action
 */
function listenerToElement(elementId, eventType, action) {
    const element = document.getElementById(elementId);
    element.addEventListener(eventType, action);
}

/**
 * Returns date and time in format: YYMMDD_hhmmss
 * @returns {string} Date and time
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
 * @param element Element to remove
 * @param fadeTime Fade duration s (optional)
 */
function removeElement(element, fadeTime = 0.2) {
    element.style.transition = `opacity ${fadeTime}s`;
    element.style.opacity = '0';

    setTimeout(() => element.remove(), fadeTime*1000);      // Asynchronous

    print("removeElement(): Removed element: " + element.id);
}

/**
 * Hides an element
 * @param element Element to hide
 * @param fadeTime Fade duration s (optional)
 */
function hideElement(element, fadeTime = 0.3) {
    element.style.transition = `opacity ${fadeTime}s`;
    element.style.opacity = '0';
    setTimeout(() => {
        element.style.display = 'none';
    }, fadeTime * 1000);
}

/**
 * Shows a hidden element by fading in
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

    // TODO: May not give real coordinates for some objects (like very large video inputs) that have been resized due to browser window resizing

}


// Simple caller methods

/**
 * Adds new overlay
 */
function addOverlay() {
    new Overlay();
}

/**
 * Adds new text area
 */
function addText() {
    new TextArea();
}

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
        print("Added element:" + newElement.id);

        // Create remove button
        let removeButton = document.createElement('button');
        removeButton.class = "removeButton";
        removeButton.id = number + "remove";
        removeButton.title = "Remove";
        removeButton.textContent = "X";
        removeButton.style.cssText = buttonCssStyle;
        removeButton.addEventListener('click', () => removeElement(newElement));
        print("Added remove button " + removeButton.id + " for :" + newElement.id);

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
        print("Adding drag listener for overlay:" +  Overlay.overlayCount + "overlay");
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
        print("Overlay drag initiated");

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
        print("Overlay drag stopped");

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
 * Method to enable debug mode while using application.
 * Can be called from console with: debug();
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

    // const placement = document.getElementById('textControls');
    controlBar.appendChild(developerButton);

}

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

function developerMenu() {
    console.error("Developer button pressed, menu not finished yet!")
    debugVisual();
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

    stream.getVideoTracks().forEach(videoTrack => {
        print("printStreamInformation(): Video track: " + videoTrack.id);
        // print("printStreamInformation(): Settings:" + JSON.stringify(videoTrack.getSettings(), null, 2));
        // print("printStreamInformation(): Capabilities: " + JSON.stringify(videoTrack.getCapabilities(), null, 2));
    });

}

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