// Development tools
let debugMode = false;                                                                        // Sets default level of console output
let debugModeVisual = false;                                                                  // Enables visual debug tools
const version = ("2025-01-24-alpha-beta");
console.log("Version: " + version);
console.log("To activate debug mode, append ?debug to URL or type to console: debug()");

// Fetch core HTML elements
const videoElement          = document.getElementById('cameraFeed');                 // Camera feed
const canvasElement         = document.getElementById('canvasMain');                 // Main canvas
const selector              = document.querySelector('select#selectorDevice');        // Camera feed selector
const island                = document.getElementById('island_controlBar');          // Floating island control bar
const videoContainer        = document.getElementById('videoContainer');             // Video container
const controlBar            = document.getElementById('controlBar');                 // Fixed control bar

// Video feed state
let rotation = 0;                                                                          // Store rotation state
let currentZoom = 1;                                                                       // Current zoom level
let flip = 1;                                                                              // State of image mirroring, 1 = no flip, -1 = horizontal flip
let isFreeze = false;                                                                      // Video freeze on or off

// UI state
let isIslandDragging = false                                                               // Shows if dragging of an island control bar is allowed
let isControlCollapsed = false;                                                            // Are control bar and island in hidden mode or not
let islandX, islandY;                                                                      // Initial position of the control island
let mouseX;                                                                                // Initial position of the mouse
let mouseY;

// Other
let createdElements;                                                                       // Handles created elements


// Initialization

document.addEventListener('DOMContentLoaded', start);                                  // Start running scripts only after HTML has been loaded and elements are available

function start() {

    // Instantiate class for created elements
    createdElements = new CreatedElements();

    // Add core listeners for interface elements
    addCoreListeners();

    // Start video feed
    videoStart().then( () => {} );

    // Update video input list periodically
    setInterval(backgroundInputListUpdate, 10000);

    // Handle URL parameters
    const urlParameters = new URLSearchParams(window.location.search);                       // Get URL parameters

    // if (urlParameters.has('privacyAgree')) {                                              // Check for privacy parameter
    //     print("start(): Found URL parameter for agreement to privacy notice");
    // } else { privacyNotice(); }                                                           // Display privacy notice if needed

    if (urlParameters.has('cookieAgree')) {                                            // Check for cookie agree parameter
        print("start(): Found URL parameter for agreement to cookie use");
    }

    // Check if cookie exists
    // TODO: Check cookie

    // Development
    if (urlParameters.has('debug')) {                                                   // Check for debug/developer parameter
        debugMode = true;
        print("start(): Found URL parameter for debug");
    }
    if (debugMode) debug();                                                                   // Activate developer features

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
    island.addEventListener('mousedown', (e) => dragIsland(e));                                           // TODO: Listener is very broad compared to others

    // Fetch HTML element for full screen button and it's icon. Attach event listener to full screen button.
    const fullScreenIcon = document.getElementById("iconFullScreen");
    const fullScreenButton = document.getElementById('buttonFullScreen');
    fullScreenButton.addEventListener('click', () => switchToFullscreen(fullScreenIcon));

    // Fetch HTML element for collapse button and its icon. Attach event listener to collapse button.
    const collapseIcon = document.getElementById("iconCollapse");
    const collapseButton = document.getElementById('buttonCollapse');
    collapseButton.addEventListener('click', () => toggleControlCollapse(collapseIcon));

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
        setVideoInput(e.target.value).then( () => {} );
    })

    // Add event listener to trigger input list update when new media device is plugged in
    navigator.mediaDevices.addEventListener('devicechange', () => {
        backgroundInputListUpdate().then( () => {} );
    });
}

/**
 * Displays a privacy notice.
 *
 */
function privacyNotice() {
    prompt("Privacy notice", "This service...", [                       // Display prompt
        [   "Agree to terms"                , () => {  }                     ],          // Prompt options
        [   "Agree to terms and cookie"     , () => { handleCookie(); }      ],
        [   "Disagree to all"               , () => {  }                     ]
    ]);
}

/**
 * Creates or reads a cookie.
 * Performs related actions to apply settings.
 */
function handleCookie() {
    // TODO: Create cookie if does not exist, read settings if does exist
}


// Camera control functions

/**
 * Performs all necessary steps to start video feed.
 * Handles prompt and retry logics.
 *
 * @returns {Promise<void>}
 */
async function videoStart() {

    // Error prompt default content
    let genericPromptTitle = "No valid cameras could be accessed";
    let genericPromptText =
        "Make sure your devices are connected and not being used by other software. " +
        "Ensure you do not have SDC open on other tabs. " +
        "Check you have allowed camera access in your browser. " +
        "You may also try a hard reload by pressing Ctrl + F5 ";
    let genericPromptActions = [
        ["Retry",       () =>       { videoStart(); } ],
        ["Dismiss",     () =>       {               } ]
    ];

    getMediaPermission().then( ()       =>    {                                                     // Get permission
        getVideoInputs().then( inputs   =>    {                                                     // Get inputs
            let input = updateInputList(inputs);                                                    // Update selector list, select some input
            setVideoInput(input);                                                                   // Use the selected input
            resetVideoState();                                                                      // Reset video view

            // TODO: Errors in this block are unlikely but are not caught

        }).catch(e => {                                                                             // Catch errors from getVideoInputs()
            prompt(genericPromptTitle, genericPromptText, genericPromptActions);                    // Prompt user
            console.error("videoStart(): No valid inputs could be accessed: " + e.name + " : " + e.message);
        });                                                                                         // End catch for getVideoInputs()

    }).catch(e => {                                                                                  // Catch errors from getMediaPermission()
        prompt(genericPromptTitle, genericPromptText, genericPromptActions);                         // Prompt user
        console.error("videoStart(): No media permission or access: " + e.name + " : " + e.message);
    });                                                                                              // End catch for getMediaPermission()
}

/**
 * Accesses browser media interface to request generic permission for camera use.
 *
 * @returns {Promise<void>}
 */
async function getMediaPermission() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });                 // Ask for video device permission (return/promise ignored)
        print("getMediaPermission(): Media permission granted");
    } catch (e) {                                                                             // Handle errors

        // Detect and handle known, expected exceptions
        // General descriptions from https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
        let errorExpected = "expected";
        switch (e.name) {
            case "NotAllowedError":
                // Thrown if one or more of the requested source devices cannot be used at this time.
                // This will happen if the browsing context is insecure (that is, the page was loaded using
                // HTTP rather than HTTPS). It also happens if the user has specified that the current browsing
                // instance is not permitted access to the device, the user has denied access for the current
                // session, or the user has denied all access to user media devices globally. On browsers that
                // support managing media permissions with Permissions Policy, this error is returned if
                // Permissions Policy is not configured to allow access to the input source(s).

                if ( e.message === "Permission denied") {
                    // This error is typically encountered on Chrome (2025).
                    // Encountered when camera permissions have been denied by user now or by persistent setting.
                }
                if ( e.message === "The request is not allowed by the user agent or the platform in the current context.") {
                    // This error is typically encountered on Firefox (2025).
                    // Encountered when camera permissions have been denied by user now or by persistent setting.
                }

                break;
            case "AbortError":
                // Although the user and operating system both granted access to the hardware device,
                // and no hardware issues occurred that would cause a NotReadableError DOMException,
                // thrown if some problem occurred which prevented the device from being used.

                if ( e.message === "Starting videoinput failed") {
                    // This error is typically encountered on Firefox (2025).
                    // Encountered when the specific video input is already in use elsewhere through mediaDevices or W10 WMF (used by Zoom).
                }

                break;
            case "NotReadableError":
                // Thrown if, although the user granted permission to use the matching devices,
                // a hardware error occurred at the operating system, browser, or Web page
                // level which prevented access to the device.

                if ( e.message === "Device in use") {
                    // This error is typically encountered on Chrome (2025).
                    // Encountered when the specific video input is already in use elsewhere through mediaDevices or W10 WMF (used by Zoom).
                }

                break;
            default:
                errorExpected = "unexpected";
        }

        print("getMediaPermission(): Failure, " + errorExpected + " error: " + e.name + " : " + e.message);

        throw new Error("getMediaPermission(): Failure");
    }
}

/**
 * Enumerates available video input devices.
 *
 * @returns {Promise<*[]>} Array of video inputs with their device id and label
 */
async function getVideoInputs() {

    // Reliable and complete input enumeration requires already existing media permissions:
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
    // The returned list will omit any devices that are blocked by the document Permission Policy:
    // microphone, camera, speaker-selection (for output devices), and so on.
    // Access to particular non-default devices is also gated by the Permissions API,
    // and the list will omit devices for which the user has not granted explicit permission.

    let videoInputs = [];

    const retryAttempts = 3;                                                                          // Number of retries before throwing error TODO: Retries in function possibly redundant, though enumeration is not completely reliable
    let failedCount = 0;

    while (true) {                                                                                    // Retry until a device is found

        let devices = await navigator.mediaDevices.enumerateDevices();                                // Find all media sources

        devices.forEach(device => {
            if (device.kind === 'videoinput') {                                                       // Only accept video sources
                if (device.deviceId === "") {                                                         // Detect and filter invalid values
                    // In some cases (like missing permissions) empty values may be returned.
                    // These values will be objects of the right kind but do not have device Ids and can not be used.
                    console.error("getVideoInputs(): Encountered invalid video input device: " + device.deviceId + " : " + device.label + device.toJSON() + " " + device.toString());
                } else {
                    // print("getVideoInputs(): Found video input device: " + shorten(device.deviceId) + " : " + device.label);
                    videoInputs.push([device.deviceId, device.label]);                                  // Assign device id to index 0 of inner array, label to index 1 of inner array, push inner array to outer array as one row
                    }
                }
        });

        if (videoInputs.length > 0) {                                                                    // Success
            // print("getVideoInputs(): Found video input device(s): " + (videoInputs.length));
            return videoInputs;
        }

        if (failedCount >= retryAttempts) {                                                              // Check if too many retries
            console.error("getVideoInputs(): No video sources found, retries: " + failedCount)
            throw new Error("getVideoInputs(): No valid video inputs");
        }
        failedCount++;                                                                                   // Failure(s), will retry
    }
}

/**
 * Updates input selector's list with an array of inputs.
 * Attempts to choose original option that was used.
 *
 * @param inputs Array of inputs with their device id and label
 * @returns {*} Device set as the selector choice
 */
function updateInputList(inputs) {

    let originalSelection = selector.value;

    // Renew list
    selector.innerHTML = '';                                                                        // Clear dropdown first
    for (let i = 0; i < inputs.length; i++) {
        let option = document.createElement('option');                                      // Create new option for dropdown
        option.value    = inputs[i][0];                                                             // Assign device id (at index 0 of inner array) as value
        option.text     = inputs[i][1];                                                             // Assign device label (at index 1 of inner array) as value
        selector.appendChild(option);                                                               // Add new option to dropdown
        // print(i + " = " + inputs[i][0] + " : " + inputs[i][1])
    }

    // Select a camera in dropdown
    if (inputs.some(input => input[0] === originalSelection)) {                                     // TODO: Should check selector, not array, if readily possible
        selector.value = originalSelection;                                                         // Select original value
        print("updateInputList(): Selected original video input: " + shorten(originalSelection) + " = " + shorten(selector.value));
    } else {                                                                                        // Original value invalid or not available
        selector.selectedIndex = 0;                                                                 // Select first option
        console.warn("updateInputList(): Original video input option not available: " + shorten(originalSelection) + " != " + shorten(selector.value));
        // TODO: At startup, this triggers once, could be handled differently
        // TODO: In some cases, first option is not usable but second is. Find a way to check for this case and try next option.
    }

    // Check selection is valid (debug)
    let errorValue = "valid";
    if (selector.value === "") errorValue = "empty";
    if (selector.value === undefined) errorValue = "undefined";
    if (selector.value === null) errorValue = "null";
    if (selector.value === "undefined") errorValue = "undefined (string)";                          // Typical for option value set of undefined array values
    if (errorValue !== "valid") {
        console.error("updateInputList(): Selected video input option is invalid, selection: " + errorValue + " value: " + selector.value);
        // TODO: Do something
    }

    return selector.value;
}

/**
 * Silently updates video input list.
 * Safe to call at any time.
 *
 * @returns {Promise<void>}
 */
async function backgroundInputListUpdate() {
    try {
        let inputs = await getVideoInputs();
        updateInputList(inputs);
    } catch (e) {
        print("backgroundInputListUpdate(): Background update failed: " + e);
    }

}

/**
 * Accesses a camera feed.
 *
 * @param input Identifier of video input to access
 * @returns {Promise<string>}
 */
async function setVideoInput(input = selector.value) {
    const retryAttempts = 3;                                                                     // Number of retries before giving up
    let failedCount = 0;

    while (true) {
        try {
            print("videoStart(): Accessing a camera feed: " + shorten(input));
            const stream = await navigator.mediaDevices.getUserMedia({                 // Change to the specified camera
                video: {
                    deviceId: {exact: input},
                    facingMode: {ideal: 'environment'},                                          // Request a camera that is facing away from the user.
                    width: {ideal: 1920},                                                        // These are useless unless there are multiple tracks with the same deviceId
                    height: {ideal: 1080},                                                       // Ideal values are not constraints
                    frameRate: {ideal: 60}
                }
            });
            videoElement.srcObject = stream;

            // TODO: Debug low video quality
            // printStreamInformation(stream);
            // bruteForceVideoStream(input);

            break;
        } catch (error) {                                                                          // Failure
            console.error("videoStart(): Camera could not be accessed (retry " + failedCount + "): " + error);
            if (failedCount >= retryAttempts) {
                console.error("videoStart(): Could not select camera, retries: " + failedCount);
                throw new Error("videoStart(): Could not select camera");
            }

            // Most likely error is OverconstrainedError, but should only occur if device with used deviceId is not available

            failedCount++;
        }
    }

    return "stream";                                                                            // TODO: Choose useful return value

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
    // TODO: Arrow function here above anonymizes, leading to persistent and duplicate function instances that are only invisible due to the variable check. Use of named function probably avoids this.

    document.addEventListener('mouseup', stopIslandDrag);
}

/**
 * Calculate new position for island control bar. Update island style according new position.
 * @param e Mouse event 'mousemove'
 */
function startIslandDrag(e) {

    // TODO: Make issue visible
    // print("Triggered island drag handler");

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
        collapseIcon.src = "./images/hideControls.png";                             // TODO: Use same image, transform Y -1 to flip
        showElement(controlBar, undefined, 'inline-flex');
        showElement(island, undefined, 'flex');
    }
}

/**
 * Creates a prompt with text and buttons.
 * Every button will dismiss prompt.
 *
 * @param title Title text for prompt
 * @param text Body text for prompt
 * @param options Array with text and code to run for buttons
 * @param position Position of prompt
 * @param size Size of prompt
 */
function prompt(title= "Title", text = "Text", options = [["Dismiss", () => {  }]], position = null, size = null) {

    // TODO: Handle concurrent prompts

    // TODO: Add support for setting position and size

    // Create prompt element
    const prompt = document.createElement('div');
    prompt.id = String(Date.now());                                      // Assign a (pseudo) unique id
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

    // Create title text
    const textTitleElement = document.createElement('div');
    const textTitle = document.createTextNode(title);
    textTitleElement.style.color = 'white';                                                 // Text color
    textTitleElement.style.fontSize = '20px';                                               // Text size
    textTitleElement.style.textAlign = 'center';                                            // Center text
    textTitleElement.style.marginBottom = '10px';                                           // Margin under title
    textTitleElement.appendChild(textTitle);
    prompt.appendChild(textTitleElement);

    // Create body text
    const textBodyElement = document.createElement('div');
    const textBody = document.createTextNode(text);
    textBodyElement.style.color = 'white';
    textBodyElement.style.textAlign = 'justify';                                              // Text fills element area fully horizontally
    textTitleElement.style.marginBottom = '10px';
    textBodyElement.appendChild(textBody);
    prompt.appendChild(textBodyElement);

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
        button.style.borderRadius = '5px';

        button.addEventListener('click', () => {
            dismiss();                                                                                              // Buttons should always dismiss prompt
            buttonCore[1]();
        });

        prompt.appendChild(button);
    });

    print("prompt(): Creating prompt " + prompt.id + " : " + title);
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
        print("prompt(): Dismissing prompt " + prompt.id);

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
    const stream = videoElement.srcObject;                                                        // Get the current video stream

    if (!isFreeze) {                                                                                // If video is not frozen, make it freeze
        if (stream) {
            canvasDrawCurrentFrame();                                                               // Draw frame to canvas overlay, avoiding black feed
            stream.getTracks().forEach(track => track.enabled = false);                            // Disable all tracks to freeze the video
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
    element.style.transition = `opacity ${fadeTime}s ease-in-out`;
    element.style.opacity = '0';
    // TODO: Add interaction prevention (no click during animations)
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
    element.style.opacity = '0';                                    // Ensures not visible
    element.style.display = displayStyle;                           // Renders element display
    element.style.transition = `opacity ${fadeTime}s ease-in-out`;

    requestAnimationFrame(() => {                           // Runs code after display is rendered
        element.style.opacity = '1';
    });

    // TODO: Animation not working on FF even when it works on Chrome

}

/**
 * Gets the center coordinates of an HTML element.
 * @param {HTMLElement} element HTML element
 * @returns {{x: number, y: number}} Object with x, y coordinates
 */
function getElementCenter(element) {
    // Value accuracy for abnormal (automatically resized with high overflow or extremely large) elements not tested

    const rect = element.getBoundingClientRect();
    const x = rect.left + window.scrollX + rect.width / 2; // Rounding with Math.round() should not be necessary
    const y = rect.top + window.scrollY + rect.height / 2;

    return { x, y };           // Example use to create two variables: let {x: centerX, y: centerY} = getElementCenter(element);
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
 * Class for managing created elements.
 */
class CreatedElements {

    elements = [];                                  // Contains information on all created elements: [[classReference, "type", "id"]]

    constructor() {

    }

    createOverlay() {
        const classReference = new Overlay();
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
    }

    createTextArea() {
        const classReference = new TextArea();
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
    }

    createMenu() {
        const classReference = new Menu();
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
    }

}

/**
 * Parent class for dynamically created movable elements.
 * This class should not be directly instantiated (use inheritors instead).
 */
class MovableElement {

    // Generic
    type;                                           // For fast identification of inheritor instance type

    // Element references
    element;                                        // Main element reference
    container;                                      // Container reference
    resizeHandle;                                   // Reference for resize handle

    // Potential listener references that are not deleted along with element via garbage collection
    // dragListeners = [];                          // Listeners for drag operation
    // removeListener;                              // Listener for the remove button
    // removeHoverListeners = [];                   // Listeners for the hover visibility of remove button
    // resizeHandleListeners = [];                  // Listeners for resize operation through handle
    // resizeHandleHoverListeners = [];             // Listeners for hover visibility of resize handle

    // Switches
    allowMove;                                      // Is drag ability enabled
    visible;                                        // Is element visible

    // Initialization

    /**
     * Instantiates class.
     * Relies on parent class.
     */
    constructor(type, allowMove = true) {
        this.type = type;
        this.allowMove = allowMove;
    }

    // Getters

    getElementId() {
        return this.element.getAttribute('id');               // Returns main HTML element id TODO: Use property instead, with pseudorandom id, and assign that to main element
    }

    getType() {
        return this.type;
    }

    // Styling

    hide() {
        hideElement(this.element);
        this.visible = false;
    }

    show() {
        showElement(this.element);
        this.visible = true;
    }

    // Management

    remove() {
        // TODO: Build and implement
        // Delete all associated elements, delete all references to listeners, orphan all associated objects for garbage collection
    }

    // Functionality

    // TODO: Generalized drag handlers here

    // TODO: Resize handle implementation here

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

        // Remove buttons only visible when hovered over
        newElement.addEventListener('mouseover', () => (
            removeButton.style.display = "block" // TODO: Use fade with showElement()
        ));
        newElement.addEventListener('mouseout', () => (
            removeButton.style.display = "none" // TODO: Use fade with hideElement()
        ));

        // Add element to DOM
        island.after(newElement);
        newElement.appendChild(removeButton);

        return newElement;
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
    overlayX;                                                                               // Initial position of the overlay when starting drag
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

/**
 * Class for creating a menu programmatically.
 * Used for multiple or custom menus.
 */
class Menu extends MovableElement {

    // Initialization

    /**
     * Instantiates class.
     * Relies on parent class.
     */
    constructor() {
        super('menu');
        this.create();
    }

    create() {

    }

    handleListeners() {

    }

    // Drag handling

    dragStart() {

    }

    dragUpdater() {

    }

    dragStop() {

    }

}


// Developer functions (safe to delete)

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
    developerButton.style.border = "2px solid darkgray";
    // developerButton.backgroundColor = "rgba(128, 128, 128, 0.7)";
    // developerButton.color = "red";
    developerButton.style.borderRadius = "5px";
    developerButton.style.height = '40px';
    // developerButton.style.height = document.getElementById("controlBar").style.height - 20;

    // const placement = document.getElementById('textControls');
    controlBar.appendChild(developerButton);

}

/**
 * Function to create and show developer options -menu.
 *
 */
function developerMenu() {
    print("developerMenu(): Developer menu button pressed");

    // ADD NEW BUTTONS HERE
    prompt("Developer menu", "Options for developers", [
        [   "Toggle visual debug"              , () => { debugVisual();                                      }],
        [   "Update video inputs"              , () => { backgroundInputListUpdate();                        }],
        [   "Release video stream"             , () => { releaseVideoStream();                               }],
        [   "Start video (reset)"              , () => { videoStart();                                       }],
        [   "Test dark theme"                  , () => { testThemeDark();                                    }],
        [   "Test another UI style"            , () => { testUserInterfaceVersion();                         }],
        [   "Brute test video input"           , () => { bruteForceBestVideoStream();                        }],
        // ADD NEW ROW ABOVE THIS ROW FOR EACH NEW BUTTON
        // Template:
        // [   "Text for button"               , () => { function_or_code_block();                           }],
        ["Dismiss"                             , () => {                                                     }]   // Preserve as final line
    ]);


}

/**
 * Stops all tracks of current video srcObject
 */
function releaseVideoStream() {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
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
 * @returns {*[]}
 */
function printStreamInformation(stream) {
    // const videoTrack = stream.getVideoTracks()[0];

    // Typical error: TypeError: videoTrack.getCapabilities is not a function
    // getCapabilities() may not be supported by all browsers, such as those based on FF ESR (Floorp, for example). FF supports function since 2024 v.132

    print("printStreamInformation(): Found " + stream.getVideoTracks().length + " video track(s) in stream");
    if (stream.getVideoTracks().length > 1) console.warn("printStreamInformation(): Unexpected amount of video tracks, document this instance!");

    let count = 1;
    let allResults = [];
    stream.getVideoTracks().forEach(videoTrack => {
        // Printing select information
        const { deviceId, width: settingWidth, height: settingHeight, frameRate } = videoTrack.getSettings();
        const { width: capabilityWidth, height: capabilityHeight, frameRate: capabilityFrameRate } = videoTrack.getCapabilities();

        //             0                       1                  2             3                    4              5                     6          7
        let results = [shorten(videoTrack.id), shorten(deviceId), settingWidth, capabilityWidth.max, settingHeight, capabilityHeight.max, frameRate, capabilityFrameRate.max];

        print("printStreamInformation(): Track " + count + " is: " + results[0] + " from device ID: " + results[1]);
        print("printStreamInformation(): Track " + count + " is set to use: " + results[2] + " x " + results[4] + " at " + results[6] + " fps");
        print("printStreamInformation(): Track " + count + " is capable of: " + results[3] + " x " + results[5] + " at " + results[7] + " fps");

        // To print a full formatted output with all information:
        // print("printStreamInformation(): Settings: " + JSON.stringify(videoTrack.getSettings(), null, 2));
        // print("printStreamInformation(): Capabilities: " + JSON.stringify(videoTrack.getCapabilities(), null, 2));

        allResults.push(results);
    });

    return allResults;

}

/**
 * Requests various video tracks from a stream and looks for the best settings.
 * Visualizes.
 * Providing video track, good or bad, is up to the browser.
 *
 */
async function bruteForceBestVideoStream(input = selector.value) {
    // Note that background activities may interfere.

    releaseVideoStream();

    // Create invisible temporary video element for stream
    const temporaryCameraFeed = document.createElement('video');
    temporaryCameraFeed.id = 'temporaryCameraFeed';
    temporaryCameraFeed.autoplay = true;
    temporaryCameraFeed.muted = true;
    temporaryCameraFeed.style.display = 'none';
    document.body.appendChild(temporaryCameraFeed);

    // Create dual layer arrays of various testable settings for video tracks
    let trackSettings = [
        [1920           ,      1080         ],
        [1280           ,       720         ],
        [640            ,       480         ],
        [320            ,       240         ],
    ];

    let moreSettings = [
        [30         ,        "environment"     ],
        [60         ,        "environment"     ],
        [30         ,        "user"            ],
        [60         ,        "user"            ],
    ];

    console.warn("bruteForceBestVideoStream(): Testing multiple (ideal value) setting combinations for " + shorten(input));

    // Loop through all permutations
    for (let [frameRate, facingMode] of moreSettings) {
        for (let [width, height] of trackSettings) {
            try {
                print(`Trying: ${width} x ${height} at ${frameRate} fps facing ${facingMode}`);
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: input },
                        facingMode: { ideal: facingMode },
                        width: { ideal: width },
                        height: { ideal: height },
                        frameRate: { ideal: frameRate }
                    }
                });

                temporaryCameraFeed.srcObject = stream;

                // Print and get stream information
                let results = printStreamInformation(stream);

                // Create and visualize scores
                let scoreUsing = results[0][2] * results[0][4]; // TODO: Only using one track at this point, could have multiple
                let scoreCapable = results[0][3] * results[0][5];
                // One score mark per 76800 (matches 320x240)
                let scoreUsingMarks = '+'.repeat(Math.min(Math.floor(scoreUsing / 76800), 35));
                let scoreCapableMarks = '+'.repeat(Math.min(Math.floor(scoreCapable / 76800), 35));
                scoreUsingMarks = scoreUsingMarks.padEnd(35, ' ');
                scoreCapableMarks = scoreCapableMarks.padEnd(35, ' ');
                print("Current [ " + scoreUsingMarks   + " ]");
                print("Capable [ " + scoreCapableMarks + " ]");

                // Discard stream
                stream.getTracks().forEach(track => track.stop());
            } catch (error) {
                console.error(`Failed: width=${width}, height=${height}, frameRate=${frameRate}, facingMode=${facingMode}`, error);
            }
        }
    }

    // Remove the temporary video element
    temporaryCameraFeed.remove();

    console.warn("bruteForceBestVideoStream(): Done");

    videoStart();
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
 * Function to enable visual debug features.
 */
function debugVisual() {
    debugModeVisual = !debugModeVisual;
    if (debugModeVisual) {
        print("Visual debug enabled!");

        // Indicate element centers
        debugVisualDrawElementTrackingIndicator(videoElement, 20, 'red', '0.9');
        debugVisualDrawElementTrackingIndicator(videoContainer, 40, 'Turquoise', '0.5');
        debugVisualDrawElementTrackingIndicator(canvasElement, 60, 'green', '0.2');
    } else {
        print("Visual debug disabled!");
    }
}

/**
 * Creates center tracking indicator on HTML element.
 * @param element
 * @param size
 * @param color
 * @param opacity
 */
function debugVisualDrawElementTrackingIndicator(element, size, color, opacity) {

    // TODO: Make this flow explicitly async

    let interval = setInterval(() => {
        if (debugModeVisual === false) {clearInterval(interval);}

        const {ball: ball, label: label} = drawCenterIndicator(element, size, color, opacity);
        const {canvas: cross, labelTopLeft: l1, labelTopRight: l2, labelBottomLeft: l3, labelBottomRight: l4} = drawCrossingLines(element, size/10, color, opacity);
        const {t:t, b:b, r:r, l:l} = drawViewPortEdges();

        setTimeout(() => {
            ball.remove();
            label.remove();
            cross.remove();
            l1.remove();
            l2.remove();
            l3.remove();
            l4.remove();
            t.remove();
            b.remove();
            r.remove();
            l.remove();
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
    let horizontalOffset = size / 2 * 1.05 + 10;                // Offset for label to place it next to indicator
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
 * Draws balls centered at each viewport edge.
 *
 * @param size
 * @param color
 * @param opacity
 * @param zindex
 * @returns {{b: HTMLDivElement, r: HTMLDivElement, t: HTMLDivElement, l: HTMLDivElement}}
 */
function drawViewPortEdges(size = 30, color = 'OrangeRed', opacity = '1', zindex = '150') {
    const {top: top, right: right, bottom: bottom, left: left} = getViewportEdges();

    const t = drawBall(right/2, top, size, color, opacity, zindex);
    const b = drawBall(right/2, bottom, size, color, opacity, zindex);

    const r = drawBall(right, bottom/2, size, color, opacity, zindex);
    const l = drawBall(left, bottom/2, size, color, opacity, zindex);

    return {t, b, r, l};

}

/**
 * Draws diagonal lines that cross from the edges of bounding rectangles.
 *
 * @param element
 * @param lineWidth
 * @param color
 * @param opacity
 * @param zindex
 * @returns {{labelTopLeft: HTMLDivElement, canvas: HTMLCanvasElement, labelBottomRight: HTMLDivElement, labelTopRight: HTMLDivElement, labelBottomLeft: HTMLDivElement}}
 */
function drawCrossingLines(element, lineWidth, color = 'red', opacity = '1', zindex = '100') {

    const canvas = document.createElement('canvas');
    let { width: elementWidth, height: elementHeight } = getElementDimensions(element);
    canvas.width = elementWidth;
    canvas.height = elementHeight;
    canvas.style.zIndex = zindex;
    canvas.style.opacity = opacity;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';                    // Make not clickable

    const rect = element.getBoundingClientRect();
    canvas.style.left = rect.left + 'px';
    canvas.style.top = rect.top + 'px';

    const context = canvas.getContext('2d');
    context.lineWidth = lineWidth;
    context.strokeStyle = color;
    let { bottomLeft: bottomLeft, topRight: topRight, topLeft: topLeft, bottomRight: bottomRight } = getElementCorners(element);
    drawLine(context, bottomLeft.x, bottomLeft.y, topRight.x, topRight.y);
    drawLine(context, topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);

    document.body.appendChild(canvas);



    // Draw labels at rect for troubleshooting coordinate mismatches between rect coordinates and actual view coordinates
    const rect1 = element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const horizontalOffset = 100;
    const verticalOffset = 100;
    const labelTopLeft =        drawLabel(rect1.left + horizontalOffset, rect1.top + verticalOffset, 35, color, opacity, zindex,           "TL Rect X: " +     rect1.left + " + " +     scrollX + " Y: " +  rect1.top + " + " +        scrollY);
    const labelBottomLeft =     drawLabel(rect1.left + horizontalOffset, rect1.bottom - verticalOffset*2, 35, color, opacity, zindex,      "BL Rect X: " +     rect1.left + " + " +     scrollX + " Y: " +  rect1.bottom + " + " +     scrollY);
    const labelTopRight =       drawLabel(rect1.right - horizontalOffset*3, rect1.top + verticalOffset, 35, color, opacity, zindex,        "TR Rect X: " +     rect1.right + " + " +    scrollX + " Y: " +  rect1.top + " + " +        scrollY);
    const labelBottomRight =    drawLabel(rect1.right - horizontalOffset*3, rect1.bottom - verticalOffset*2, 35, color, opacity, zindex,   "BR Rect X: " +     rect1.right + " + " +    scrollX + " Y: " +  rect1.bottom + " + " +     scrollY);

    return {canvas, labelTopLeft, labelTopRight, labelBottomLeft, labelBottomRight};
}

/**
 * Draws a line between two points.
 *
 * @param context Canvas 2d context to draw to
 * @param x1
 * @param y1
 * @param x2
 * @param y2
 */
function drawLine(context, x1, y1, x2, y2) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
}

/**
 * Gets coordinates of element bounding rectangle corners.
 *
 * @param element
 * @returns {{bottomLeft: {x: number, y: number}, bottomRight: {x: number, y: number}, topLeft: {x: number, y: number}, topRight: {x: number, y: number}}}
 */
function getElementCorners(element) {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    return {
        topLeft:        { x: rect.left + scrollX,   y: rect.top + scrollY       },
        topRight:       { x: rect.right + scrollX,  y: rect.top + scrollY       },
        bottomLeft:     { x: rect.left + scrollX,   y: rect.bottom + scrollY    },
        bottomRight:    { x: rect.right + scrollX,  y: rect.bottom + scrollY    }
    };

}

/**
 * Gets dimensions of an element based on bounding rectangle.
 *
 * @param element
 * @returns {{width: number, height: number}}
 */
function getElementDimensions(element) {
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    return { width, height }; // Example use: let { width: elementWidth, height: elementHeight } = getElementDimensions(element);

}

/**
 * Gets coordinates of viewport edges.
 *
 * @returns {{top: number, left: number, bottom: number, right: number}} Relevant coordinate for each edge
 */
function getViewportEdges() {
    const top = window.scrollY;
    const right = window.scrollX + window.innerWidth;
    const bottom = window.scrollY + window.innerHeight;
    const left = window.scrollX;

    return { top, right, bottom, left };
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
 * Applies another testing version of UI.
 * Dirty implementation!
 */
function testUserInterfaceVersion() {

    // Vision:
    // Bottom control bar visibility toggle button always visible, full screen mode has button always visible.
    // Main control island visibility is controlled from within bottom bar.
    // Every menu has a button on bottom bar. Only main control island is visible by default.
    // Menus have buttons that detach or reattach them to positions above their buttons on bottom control bar.

    // Remove standalone label
    // document.getElementById("textSizeLabel").style.display = "none";
    document.getElementById("textSizeLabel").remove();

    // Remove current collapse button
    let label = document.getElementById("buttonCollapse");
    label.style.display = "none";
    label.style.width = '0px';

    // Give fullscreen button a background
    let buttonFullscreen = document.getElementById("buttonFullScreen");

    let iconFullscreen = document.getElementById("iconFullScreen");

    buttonFullscreen.style.position = "absolute";
    buttonFullscreen.style.margin = "0";
    buttonFullscreen.style.padding = "0";
    buttonFullscreen.style.border = "none";
    buttonFullscreen.style.zIndex = "101";
    buttonFullscreen.style.bottom = "5px";
    buttonFullscreen.style.right = "13px";
    buttonFullscreen.style.width = "40px";
    buttonFullscreen.style.height = "40px";
    buttonFullscreen.style.backgroundSize = "40px 40px";
    buttonFullscreen.style.backgroundPosition = "center";
    buttonFullscreen.style.background = "rgba(128, 128, 128, 0.5)";
    buttonFullscreen.style.borderRadius = "5px";

    iconFullscreen.style.width = "30px";
    iconFullscreen.style.height = "30px";
    iconFullscreen.style.objectFit = "contain";

    // Create bar visibility button element and icon
    let buttonCollapseBar = document.createElement("button");
    buttonCollapseBar.id = "buttonCollapseBar";
    buttonCollapseBar.title = "Hide Control Bar";

    let iconCollapseBar = document.createElement("img");
    iconCollapseBar.id = "iconCollapseBar";
    iconCollapseBar.classList.add("icon");
    iconCollapseBar.src = "./images/hideControls.png";
    iconCollapseBar.alt = "Hide Controls";
    iconCollapseBar.style.transform = "rotate(-90deg)";

    buttonCollapseBar.appendChild(iconCollapseBar);

    buttonCollapseBar.style.position = "absolute";
    buttonCollapseBar.style.margin = "0";
    buttonCollapseBar.style.padding = "0";
    buttonCollapseBar.style.border = "none";
    buttonCollapseBar.style.zIndex = "101";
    buttonCollapseBar.style.bottom = "5px";
    buttonCollapseBar.style.right = "58px";                 // Manual position, 13px (border + margin) + 40 px (button size) + margin
    buttonCollapseBar.style.width = "40px";
    buttonCollapseBar.style.height = "40px";
    buttonCollapseBar.style.backgroundSize = "40px 40px";
    buttonCollapseBar.style.backgroundPosition = "center";
    buttonCollapseBar.style.background = "rgba(128, 128, 128, 0.5)";
    buttonCollapseBar.style.borderRadius = "5px";

    iconCollapseBar.style.width = "30px";
    iconCollapseBar.style.height = "30px";
    iconCollapseBar.style.objectFit = "contain";

    document.body.appendChild(buttonCollapseBar);

    // Handle control bar collapse and expand
    let controlBar = document.getElementById("controlBar");
    let isCollapsed = false;

    iconCollapseBar.style.transition = "transform 0.3s ease-in-out";  // Add transition for the icon flip

    buttonCollapseBar.addEventListener("click", () => {
        if (isCollapsed) {
            controlBar.style.transition = "transform 0.4s ease-in-out, opacity 0.5s ease-in-out";

            controlBar.style.transform = "translateX(0)";
            controlBar.style.opacity = "1";
            isCollapsed = false;

            // Force reflow
            controlBar.offsetHeight; // Accessing this forces a reflow

        } else {
            controlBar.style.transition = "transform 0.3s ease-in-out, opacity 0.2s ease-in-out";

            controlBar.style.transform = "translateX(100%)";
            controlBar.style.opacity = "0";
            isCollapsed = true;

            // Force reflow
            controlBar.offsetHeight; // Accessing this forces a reflow
        }
        iconCollapseBar.style.transform += " scaleY(-1)";
    });

    // Create menu buttons as examples (AUTOMATICALLY GENERATED FOR ILLUSTRATION EXAMPLES, modified)

    const buttonStyle = {
        width: "40px",
        height: "40px",
        backgroundColor: "rgba(128, 128, 128, 0.5)",
        borderRadius: "5px",
        border: "2px solid darkgray",
        // borderColor: "rgba(128, 128, 128, 0.7)", // If any border at all
        padding: "0",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        margin: "5px"
    };

    // Create menuButtons div
    const menuButtons = document.createElement("div");
    menuButtons.id = "menuButtons";
    menuButtons.style.position = "absolute";
    menuButtons.style.right = "180px";
    menuButtons.style.display = "flex";
    menuButtons.style.flexDirection = "row";
    menuButtons.style.justifyContent = "center";
    menuButtons.style.height = "100%";

    // Create buttons
    const createButton = (png = "draw.png") => {
        const button = document.createElement("button");
        Object.assign(button.style, buttonStyle);               // Need if assigning CSS from variable (assigning to CSSStyleDeclaration)

        button.id = "exampleButton";

        const icon = document.createElement("img");
        icon.src = "./images/" + png;
        icon.alt = "Draw";
        // icon.className = "icon";
        icon.classList.add("icon");

        // icon.style.filter = 'invert(1) grayscale(100%)'; // messes hover if inline here

        button.appendChild(icon);
        return button;
    };

    // Create and append buttons
    menuButtons.appendChild(createButton("draw.png"));
    menuButtons.appendChild(createButton("text.png"));
    menuButtons.appendChild(createButton("showVideo.png"));

    // Append menuButtons to controlBar
    controlBar.appendChild(menuButtons);


    testThemeDark();


}

/**
 * Function to apply UI coloration.
 * Default is dark.
 * Dirty implementation!
 *
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
    document.getElementById('buttonCollapseBar').style.filter   = buttonStyleFilter;

    // For example buttons
    // Very dirty, for all of same id
    document.querySelectorAll('#exampleButton').forEach(function(button) {
        button.style.filter = buttonStyleFilter;
    });

    document.getElementById('zoomOutButton').style.color        = colorText;
    document.getElementById('zoomInButton').style.color         = colorText;
    document.getElementById('buttonSmallerFont').style.color    = colorText;
    document.getElementById('buttonBiggerFont').style.color     = colorText;

}