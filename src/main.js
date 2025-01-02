// Development tools
let debugMode = true;                                                                     // Sets default level of console output
if (debugMode) debug();
const version = ("2025-01-01-a");
console.log(version);
console.log("To enable debug mode, type: debug()");

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

document.addEventListener('DOMContentLoaded', start);                                         // Start running scripts only after HTML has been loaded and elements are available

function start() {

    // Add core listeners for interface elements
    addCoreListeners();

    // Find video devices
    findDevices();
    // TODO: Ensure the method is run periodically (or when update button or option is clicked somewhere) to update device list without need to refresh page

    // Start video feed
    videoStart();

    // // Find all video devices first, then start the selected camera
    // findDevices().then(r => {
    //     videoStart();
    // });

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
    selector.addEventListener('change', (event) => {
        changeCamera(event.target.value);
    })
}

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
 * Finds all video media devices and lists them to feed selector dropdown.
 * @returns {Promise<void>}
 */
async function findDevices() {
    let failedCount = 0;
    while (true) {                                                                                      // Run until a device is found
        selector.innerHTML = '';                                                                        // Clear dropdown first
        let foundVideoInputs = 0;
        await navigator.mediaDevices.enumerateDevices().then(devices => {               // Find all media sources
            for (let i = 0; i < devices.length; i++) {
                if (devices[i].kind === 'videoinput') {                                                 // Only use video sources
                    print("Added video input device to menu: " + devices[i].label + " " + devices[i].deviceId);
                    foundVideoInputs++;
                    let option = document.createElement('option');            // Create new option for dropdown
                    option.value = devices[i].deviceId;
                    option.text = devices[i].label;
                    selector.appendChild(option);                                                       // Add new option to dropdown
                }
            }
        })
        if (foundVideoInputs > 0) {break;}
        if (failedCount > 10) {throw Error("No video inputs found")}
        failedCount++;
    }
}

/**
 * Requests media device access, assigns selected camera to HTML element for camera feed.
 * @returns {Promise<void>}
 */
async function videoStart() {
    if (selector.value === "") {                                                              // If selector is empty then get first video input
        videoElement.srcObject = await navigator.mediaDevices.getUserMedia({        // Request media device access, assign selected camera to HTML element
            video: {facingMode: 'environment'}                                                // DEV: Comment out to induce error ; facing mode request for camera facing away from the user
        });
    }
    else {
        try {
            videoElement.srcObject = await navigator.mediaDevices.getUserMedia({    // Request media device access, assign selected camera to HTML element
                video: {
                    deviceId: {
                        exact: selector.value                                                 // Select the camera that's selected on dropdown
                    }
                }
            });
        } catch (error) {
            // DEV: Comment out to induce error ; facing mode request for camera facing away from the user
            const message = 'The camera could not be accessed: ';
            console.error(message, error);                                                     // Output error to console
            alert(`${message} ${error}`);                                                      // Display alert to user
        }
    }
}

/**
 * Changes active camera to the selected one.
 * @param camera Selected camera
 * @returns {Promise<void>}
 */
async function changeCamera(camera) {
    videoElement.srcObject.getTracks().forEach(track => {                      // Stop current camera feed
        track.stop();
    })
    navigator.mediaDevices.getUserMedia({                                            // Change to that camera that is selected
        video: {
            deviceId: {
                exact: camera
            }
        }
    }).then(stream => {
        videoElement.srcObject = stream;
    })
    resetCamera();
}

/**
 * Reset camera back to its original state.
 */
function resetCamera() {
    // Reset camera back to its original state
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
 * Update style transformations (rotation, flipping, zoom etc.) to video feed and canvas.
 */
function updateVideoTransform() {
    videoElement.style.transform = `scaleX(${flip}) rotate(${rotation}deg) scale(${currentZoom})`;    // Updates video rotation, flipping and current zoom
    canvasElement.style.transform = videoElement.style.transform;                                     // Updates transformations to the canvas (still frame)
}

/**
 * Toggle between video feed and freeze image (still frame).
 * @param freezeIcon Icon for freeze button
 */
function videoFreeze(freezeIcon) {
    const stream = videoElement.srcObject;                                                     // Get the current video stream
    // TODO: Consider not disabling stream, instead simply not showing it
    if (!isFreeze) {                                                                                // If video is not frozen, make it freeze
        if (stream) {
            canvasDrawCurrentFrame();                                                               // Draw frame to canvas overlay, avoiding black feed
            stream.getTracks().forEach(track => track.enabled = false);             // Disable all tracks to freeze the video
        }
        freezeIcon.src = "./images/showVideo.png";                                                  // Change icon image
        freezeIcon.title = "Show video";                                                            // Change tool tip text
        isFreeze = true;                                                                            // Freeze is on
    } else {
        videoStart().then(r => {console.log(r);});
        videoElement.style.display = 'block';
        canvasElement.style.display = 'none';
        freezeIcon.src = "./images/freeze.png";
        freezeIcon.title = "Freeze";
        isFreeze = false;                                                                           // Freeze is off
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
        controlBar.style.display = 'none';
        island.style.display = 'none';
    }
    else {
        collapseIcon.title = 'Hide controls';
        collapseIcon.src = "./images/hideControls.png";
        controlBar.style.display = 'inline-flex';
        island.style.display = 'flex';
    }
}

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
 * Remove an element
 * @param id Id of element to remove
 */
function removeElement(id) {
    document.getElementById(id).remove();
    print("Removed element: " + id);
}

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
            console.log('Full screen mode active');
            fullScreenIcon.title = 'Close full screen';
            fullScreenIcon.src = "./images/closeFullScreen.png";
        }).catch(error => {
            alert(`Error attempting to switch to fullscreen mode: ${error.message}`);
        });
    } else {
        document.exitFullscreen().then(() => {                      // Exit full screen mode, if it's already active
            console.log('Full screen mode successfully closed');
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
 * Changes the active text area's font size
 * @param size Size value
 */
function changeFontSize(size) {
    let fontSize = parseFloat(activeTextArea.style.fontSize);                             // Get fontsize without "px"
    fontSize += size;                                                                             // Make font size bigger or smaller
    activeTextArea.style.fontSize = fontSize + "px";                                              // Change active text area's font size
}

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





// Setup

let elementArray = [
    [[], [], []],
    [[], [], []],
    [[], [], []]
]; // ID, type, object reference, isMoving

function handleUserInterfaceElements() {
}

// Utility methods

function findElementReference() {
// Should return found element, however how is type communicated? Or just return index?
}

function deleteAllAddedElements() {
}

// Custom classes


/**
 * Parent class for dynamically created movable elements.
 * Parent class should not be directly instantiated.
 */
class MovableElement {

    // Do I need to initialize type and index and others used with this.variable?

    constructor(type) {
        this.type = type;
        this.index = elementArray.length; // Length is the index of the empty, append happens in updateArray
        this.id = null;

        this.updateArray();
    }

    // Methods implemented in parent class
    updateArray() {
        // Handling element array that keeps track of all created elements
    }

    hide() {
    }

    show() {
    }

    delete() {
        // Never change indices
    }

    resetPosition() {
    }


    do() {
        // Something
    }

// Methods to be implemented in subclasses
    handleListeners() {
        // Subclasses: Listeners for click
        this.errorUnimplemented();
    }

    setStyling() {
        // Subclasses:
        this.errorUnimplemented();
    }

    setVisibility() {
        // Subclasses:
        this.errorUnimplemented();
    }

    createControls() {
        // Subclasses:
        this.errorUnimplemented();
    }

    handleCanvas() {
        // Subclasses: Create canvas elements as needed
        this.errorUnimplemented();
    }
    errorUnimplemented() {
        throw new Error("Called unimplemented method in parent class MovableElement");
    }


    /**
     * Adds new element and remove button for it.
     * @param element Element type to add
     * @param amount Amount of elements
     * @param id Identifier for added element
     * @param elementCssStyle CSS style for added element
     * @param buttonCssStyle CSS style for remove button
     */
    addElements(element, amount, id, elementCssStyle, buttonCssStyle) {

        // Create main element
        let newElement = document.createElement(element);
        newElement.id = amount + id;
        newElement.class = id;
        newElement.style.cssText = elementCssStyle // New elements style must be edited in js
        print("Added element:" + newElement.id);

        // Create remove button
        let removeButton = document.createElement('button');
        removeButton.class = "removeButton";
        removeButton.id = amount + "remove";
        removeButton.title = "Remove";
        removeButton.textContent = "X";
        removeButton.style.cssText = buttonCssStyle;
        removeButton.addEventListener('click', () => removeElement(newElement.id));
        print("Added remove button " + removeButton.id + " for :" + newElement.id);

        // Remove buttons only visible when hovered over
        newElement.addEventListener('mouseover', () => (
            removeButton.style.display = "block"
        ));
        newElement.addEventListener('mouseout', () => (
            removeButton.style.display = "none"
        ));

        // Add element after island in HTML
        island.after(newElement);
        newElement.appendChild(removeButton);
    }


}


/**
 * Class for dynamically created overlay elements.
 */
class Overlay extends MovableElement {

    // Styles
    static overlayStyle = "width:105%; height:105%; background: linear-gradient(to bottom, #e6e6e6, #222222); cursor:move; z-index:10; position:absolute; left:2%; top:2%;";
    static overlayRemoveButtonStyle = "margin:auto;background:white;border-color:grey;width:5%;height:20px;margin-top:-10px;display:none;"

    static overlayCount = 0;                                                                // Counter for overlays

    static isOverlayDragging = false;                                                        // Shows if dragging of an overlay element is allowed

    overlayX;                                                                         // Initial position of the overlay
    overlayY;

    constructor() {
        super('overlay');

        this.create();
        this.handleListeners();

        // Update overlay count
        Overlay.overlayCount++;
    }

    /**
     * Adds new draggable overlay on top of feed.
     */
    create() {
        // Add elements
        super.addElements("div", Overlay.overlayCount, "overlay", Overlay.overlayStyle, Overlay.overlayRemoveButtonStyle);
    }


    /**
     * Adds listener for drag of overlay.
     */
    handleListeners() {
        print("Adding drag listener for overlay:" +  Overlay.overlayCount + "overlay");

        let overlay = document.getElementById(Overlay.overlayCount + "overlay");
        overlay.addEventListener('mousedown', (e) => this.dragStart(e, overlay)); // Start overlay dragging
    }


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
        const mouseMoveHandler = (event) => this.updateDrag(event, overlay);
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
    updateDrag(e, overlay) {
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
    static elementStyle = "position:absolute;left:300px;top:100px;min-width:150px;min-height:40px;z-index:7;"
    static buttonStyle = "left:0;background:white;border-color:grey;width:20px;height:20px;margin-top:-18px;position:absolute;display:none;border-radius:10px;padding-bottom:10px;"
    static resizeHandleStyle = "width:15px;height:15px;background-color:gray;position:absolute;right:0;bottom:0px;cursor:se-resize;z-index:8;clip-path:polygon(100% 0, 0 100%, 100% 100%);";

    static textAreaCount = -1;                                                              // Counter for text areas

    isMoving = false;                                                                        // Is text area moving
    static activeTextArea;                                                                           // Shows which text area is currently active
    isResizing = false;                                                              // Textarea resizing
    offsetXText;
    offsetYText;
    startWidth;
    startHeight;                                        // To change the size and position of the textarea

    constructor() {
        super('textarea');

        // Update text area count TODO: Remove negative
        TextArea.textAreaCount++;

        this.create();

        this.addText();
    }

    create() {
        // Add main elements
        super.addElements("div", TextArea.textAreaCount, "textAreaContainer", TextArea.elementStyle, TextArea.buttonStyle);

        // Add resize handle
    }

    /**
     * Adds new text area.
     * Sets the styles for the text area and its buttons.
     * Adds event listeners to mouse actions.
     */
    addText() {
        let currentTextAreaContainer = document.getElementById(TextArea.textAreaCount + "textAreaContainer");
        let textArea = document.createElement("textarea");
        textArea.id = TextArea.textAreaCount + "textArea";
        textArea.placeholder = "Text";
        textArea.style.cssText = TextArea.textAreaStyle;

        let resizeHandle = document.createElement("div");                                                   // Option to resize the textArea box
        resizeHandle.id = TextArea.textAreaCount + "resizeHandle";
        resizeHandle.style.cssText = TextArea.resizeHandleStyle;

        currentTextAreaContainer.appendChild(textArea);
        currentTextAreaContainer.appendChild(resizeHandle);

        currentTextAreaContainer.addEventListener("mousedown", (e) => this.handleTextArea(e, currentTextAreaContainer, resizeHandle, textArea)); // Handle mousedown action
        currentTextAreaContainer.addEventListener("mousemove", (e) => this.dragTextArea(e, currentTextAreaContainer, textArea)); //Handle mousemove action
        currentTextAreaContainer.addEventListener("mouseup", () => this.stopTextAreaDrag(currentTextAreaContainer));        // Stop moving or expanding when the mouse is released

        textArea.addEventListener('input', () => this.resizeTextAreaWithoutMouse(textArea, currentTextAreaContainer));
    }

    /**
     * Expands textarea automatically (without a mouse) if content exceeds current height.
     * @param textArea TextArea element
     * @param textAreaContainer TextAreaContainer element
     */
    resizeTextAreaWithoutMouse(textArea, textAreaContainer) {
        if (textArea.scrollHeight > textArea.offsetHeight) {
            textArea.style.height = `${textArea.scrollHeight}px`;
            textAreaContainer.style.height = textArea.style.height;
        }
    }

    /**
     * Moves or expands the text area according to mouse movement.
     * Sets new position for text area and text area container.
     * @param e MouseEvent 'mousemove'
     * @param textAreaContainer TextAreaContainer element
     * @param textArea TextArea element
     */
    dragTextArea(e, textAreaContainer, textArea) {
        if (this.isMoving) {                                                                             // Move the textarea when the mouse moves
            const x = e.clientX - this.offsetXText;                                              // new position x for textarea container
            const y = e.clientY - this.offsetYText;                                              // new position y
            textAreaContainer.style.left = `${x}px`;
            textAreaContainer.style.top = `${y}px`;
        } else if (this.isResizing) {                                                                      // Expand the textarea when the mouse moves
            const newWidth = this.startWidth + (e.clientX - this.offsetXText);                                  // new width for textarea container
            const newHeight = this.startHeight + (e.clientY - this.offsetYText);                                // new height
            textAreaContainer.style.width = `${newWidth}px`;
            textAreaContainer.style.height = `${newHeight}px`;

            textArea.style.width = `${newWidth}px`;                                                  // Update also the textarea size
            textArea.style.height = `${newHeight}px`;
        }
    }

    /**
     * Activates the selected text area with mouse click and captures the mouse click position.
     * Attaches event listeners for `mousemove` and `mouseup`.
     * @param e MouseEvent 'mousedown'
     * @param textAreaContainer TextAreaContainer element
     * @param resizeHandle ResizeHandle element
     * @param currentTextArea Currently active text area element
     */
    handleTextArea(e, textAreaContainer, resizeHandle, currentTextArea) {
        TextArea.activeTextArea = currentTextArea;
        textAreaContainer.style.zIndex = '7';

        /**
         * Handles mousemove event for text area. Starts text area drag or resizing text area.
         * @param event Mouse event 'mousemove'
         */
        const mouseMoveHandler = (event) => this.dragTextArea(event, textAreaContainer, currentTextArea);

        /**
         * Handles mouseup event for text area. Stops text area drag.
         */
        const mouseUpHandler = () => this.stopTextAreaDrag(mouseMoveHandler, mouseUpHandler);

        // Check is the mouse click on the text area or the resize handle
        if (e.target === resizeHandle) {
            this.isResizing = true;
            this.startWidth = textAreaContainer.offsetWidth;
            this.startHeight = textAreaContainer.offsetHeight;
            this.offsetXText = e.clientX;
            this.offsetYText = e.clientY;
        } else {
            this.isMoving = true;
            this.offsetXText = e.clientX - textAreaContainer.offsetLeft;
            this.offsetYText = e.clientY - textAreaContainer.offsetTop;
            textAreaContainer.style.cursor = "move";
        }

        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
    }

    /**
     * Stops text area dragging and removes event listeners mousemove and mouseup.
     * @param mouseMoveHandler handler for mousemove
     * @param mouseUpHandler handler for mouseup
     * @param textAreaContainer TextAreaContainer element
     */
    stopTextAreaDrag(mouseMoveHandler, mouseUpHandler, textAreaContainer) {
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
        this.isMoving = false;
        this.isResizing = false;
        // textAreaContainer.style.cursor = "default";
    }


}

/**
 * Class for dynamically created user interface elements.
 */
class UserInterface extends MovableElement {
    do() {
        // Something else else else
    }
}



function debug() {
    debugMode = true;
    print("Debug mode is enabled!");
    print("Happy developing ✨");
}

/**
 * Outputs strings to console if debug is enabled.
 * Used in development.
 * @param string String to output
 */
function print(string) {
    if (!debug) return;
    console.log(string);
}