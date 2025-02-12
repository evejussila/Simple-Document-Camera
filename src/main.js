// Development tools
let debugMode = false;                                                                        // Sets default level of console output
let debugModeVisual = false;                                                                  // Enables visual debug tools
const version = ("2025-02-11-alpha");
console.log("Version: " + version);
console.log("To activate debug mode, append parameter ' debug ' to URL (using ?/&) or type to console: ' debug() '");

// Fetch core HTML elements
const videoElement          = document.getElementById('cameraFeed');                 // Camera feed
const canvasElement         = document.getElementById('canvasMain');                 // Main canvas
const selector              = document.querySelector('select#selectorDevice');        // Camera feed selector // TODO: Why not get element by id?
const island                = document.getElementById('island_controlBar');          // Floating island control bar
const videoContainer        = document.getElementById('videoContainer');             // Video container
const controlBar            = document.getElementById('controlBar');                 // Fixed control bar

// Video feed state
let rotation = 0;                                                                          // Store rotation state
let currentZoom = 1;                                                                       // Current zoom level
let flip = 1;                                                                              // State of image mirroring, 1 = no flip, -1 = horizontal flip
let isFreeze = false;                                                                      // Video freeze on or off

// UI state
let isIslandDragging = false                                                               // Dragging island control bar
let isControlCollapsed = false;                                                            // Are control bar and island in hidden mode or not
let islandX, islandY;                                                                      // Initial position of the control island
let mouseX;                                                                                // Initial position of the mouse
let mouseY;

// Other
let createdElements;                                                                       // Handles created elements


// Initialization

document.addEventListener('DOMContentLoaded', start);                                 // Start running scripts only after HTML has been loaded and elements are available

function start() {

    // Instantiate class for created elements
    createdElements = new CreatedElements();

    // Add core listeners for interface elements
    addCoreListeners();

    // Handle privacy notices and data storage
    const tosAgreed = handlePrivacy();                                                       // Determines if user may continue using the service

    // Start video feed
    if (tosAgreed) {                                                                         // TODO: If no video, prompts will overlap (need positioning or await)
        videoStart().then(() => {   } );
    }

    // Update video input list periodically
    setInterval(backgroundUpdateInputList, 10000);                                    // Runs background update periodically

    // Development
    const urlParameters = new URLSearchParams(window.location.search);                       // Get URL parameters
    if (urlParameters.has("debug")) {                                                  // Check for debug/developer parameter
        debugMode = true;
        print("start(): Found URL parameter for debug");
    }
    if (debugMode) debug();                                                                  // Activate developer features

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
    listenerToElement('island_controlBar', 'mousedown', islandDragStart);                                // Draggable island bar
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
        setVideoInput(e.target.value).then( () => {} );                                                                // TODO: Add catch for error
    })

    // Add event listener to trigger input list update when new media device is plugged in
    navigator.mediaDevices.addEventListener('devicechange', () => {
        backgroundUpdateInputList().then( () => {} );
    });
}


/**
 * Handles privacy-related prompting, parameters, data storage and logical coordination
 *
 * @returns {boolean} True if the service can be used
 */
function handlePrivacy() {

    // Check browser local storage for privacy setting
    const privacyKey = localStorage.getItem('privacy');

    switch (privacyKey) {
        case "agreeAll":                                                         // User agrees to ToS and local storage -> No prompt, read/create local storage
            handleLocalStorage();
            return true;
        default:
            print("handlePrivacy(): No fast exit (local storage)");
    }

    // Check URL privacy parameter
    const privacyParameter = new URLSearchParams(window.location.search).get("privacy");
    print("handlePrivacy(): URL privacy parameters: " + privacyParameter);

    switch (privacyParameter) {
        case "agreeAll":                                                         // User agrees to ToS and local storage -> No prompt, read/create local storage
            handleLocalStorage();
            return true;
        case "agreeTosExclusive":                                                // User agrees to ToS, has forbidden local storage -> No prompt, no action
            return true;
        default:
            print("handlePrivacy(): No fast exit (URL parameter)");
    }

    // Check if notice text files exist and load texts
    // TODO: Check FILES and load text from them to variables, use localization and file read implementation
    const tosTextExists = true;                                                  // Check if terms of service text exists
    const privacyTextExists = true;                                              // Check if privacy notice text exists
    print("handlePrivacy(): Privacy files: tosTextExists = " + tosTextExists + " & privacyTextExists = " + privacyTextExists);

    const privacyTextShort =
        "This is a local service. " +
        "Your video and data remain only on your own device. " +
        "<br><br>" +
        "<b>Your video or data are not sent anywhere.</b> " +
        "<br><br>" +
        "This service remembers your consent and settings by storing them locally in your browser. " +
        "Storing this information is optional. " +
        "<br><br>" +
        "If you agree to the storing of your consent and settings <b>locally</b>, you will not see this prompt on your device in the future. " +
        "<br><br>" +
        "<a href=\"javascript:void(0);\" onclick=\"console.warn('Onclick ok 1')\">Privacy Statement</a>" +
        "<br><br>";
    const tosTextShort =
        "This service is provided as is. " +
        "<br><br>" +
        "<a href=\"javascript:void(0);\" onclick=\"console.warn('Onclick ok 2')\">Terms of Service</a>" +
        "<br><br>";

    const privacyTextLong = "This service can store user settings with the user's permission to... " +
        "(long)";
    const tosTextLong = "The terms of service for this service... " +
        "(long)";


    // Set button styles
    const colorAccept = "rgba(70,136,255,0.5)";
    const colorReject = "rgba(255,139,139,0.5)";

    // Interpret course of action

    // Table of actions
    // Format:
    // Text states (does text exist)   Privacy parameters
    // Privacy text    Tos text        Parameter
    // ---------------------------------------------------------------------------------------------------
    // Boolean         Boolean         Action (output)

    // Table of actions
    // Table:
    // Privacy text    Tos text        agreeTosInclusive        null
    // ---------------------------------------------------------------------------------------------------
    // true            -               privacyPrompt
    // false           -               handleLocalStorage
    // true            true                                     fullPrompt
    // false           true                                     tosPrompt
    // true            false                                    privacyPrompt
    // false           false                                    handleLocalStorage

    // TODO: Minimize table, compact logic

    switch (privacyParameter) {
        case "agreeTosInclusive":                                                // User already agrees to ToS, has not agreed to local storage
            if (privacyTextExists) {                                             // Privacy text exists -> privacy prompt only
                print("handlePrivacy(): ToS agree, privacy unknown, displaying privacy prompt");

                privacyPrompt();                                                 // Privacy prompt
            } else {                                                             // Privacy text does not exist -> No prompt, create local storage
                print("handlePrivacy(): ToS agree, privacy unknown, no privacy notice text, creating local storage without prompt");
                handleLocalStorage();                                            // Create local storage (assume local storage can be used if notice text is not provided)
            }

            break;
        case null:                                                               // No URL privacy parameter set
            print("handlePrivacy(): ToS unknown, privacy unknown, displaying prompts for which texts exist");

            if (tosTextExists) {                                                 // ToS text exists
                print("handlePrivacy(): ... ToS text exists");

                if (privacyTextExists) {                                         // Privacy text exists
                    print("handlePrivacy(): ... privacy text exists");

                    fullPrompt();                                                // Full prompt
                } else {                                                         // Privacy text does not exist
                    print("handlePrivacy(): ... privacy text does not exist");

                    tosPrompt();                                                 // ToS prompt
                }
            } else {                                                             // ToS text does not exist
                if (privacyTextExists) {                                         // Privacy text does exist
                    print("handlePrivacy(): ... privacy text exists");

                    privacyPrompt();                                              // Privacy prompt
                } else {                                                          // No texts exist
                    print("handlePrivacy(): ... privacy text does not exist");

                    // TODO: Might want a switch here that completely disables persistence, if that is what the hosting party wants
                    handleLocalStorage();                                         // Create local storage (assume local storage can be used if notice text is not provided)
                }
            }

            break;
        default:                                                                 // Privacy agreement state unexpected
            console.error("handlePrivacy(): URL privacy parameter has unexpected value: " + privacyParameter);
            fullPrompt();                                                        // Full prompt
    }

    // Nested functions for prompts

    /**
     * Displays a privacy notice.
     */
    function privacyPrompt() {
        console.log("privacyPrompt(): Displaying a notice");

        customPrompt("Privacy notice", privacyTextShort, [                                                      // Display prompt
            [   "Accept"                          , () => { handleLocalStorage(); }                                                , colorAccept  ],  // Prompt options
            [   "Not now"                         , () => { /* Only implicit rejection, ask again later */ }                                      ],
            [   "Reject"                          , () => { updateUrlParam("privacy", "agreeTosExclusive"); } , colorReject  ]
        ], "50%", "350px");
    }

    /**
     * Displays a full privacy notice.
     */
    function fullPrompt() {
        console.log("fullPrompt(): Displaying a notice");

        customPrompt("Privacy notice", privacyTextShort + " " + tosTextShort, [                           // Display prompt
            [   "Agree to all"                   , () => { handleLocalStorage(); }                                          , colorAccept  ],  // Prompt options
            [   "Agree to terms of service"      , () => { updateUrlParam("privacy", "agreeTosInclusive"); }          ],
            [   "Reject terms"                   , () => { /* HALT SERVICE */ return false; }                               , colorReject  ]
        ], "50%", "350px");
    }

    /**
     * Displays a ToS (terms of service) notice.
     */
    function tosPrompt() {
        console.log("tosPrompt(): Displaying a notice");

        customPrompt("Privacy notice", tosTextShort, [                           // Display prompt
            [   "Agree to terms"                , () => { updateUrlParam("privacy", "agreeTosInclusive"); } , colorAccept  ],  // Prompt options
            [   "Reject terms"                  , () => { /* HALT SERVICE */ return false; }                                     , colorReject  ]
        ], "50%", "350px");
    }

    // TODO: Finalize prompt actions
    function option1() {
    }




    return true; // TODO: Needs an await unless only privacy prompt
}

/**
 * Modifies and updates a single parameter in the URL query string.
 *
 * @param paramName Parameter to modify
 * @param paramValue New value for parameter
 */
function updateUrlParam(paramName, paramValue) {
    let allParameters = new URLSearchParams(window.location.search);                                            // Get all parameters
    allParameters.set(paramName, paramValue);                                                                   // Change one parameter
    window.history.replaceState({}, '', `${window.location.pathname}?${allParameters}`);        // Replace url with same path and new parameters
}

/**
 * Writes to or reads from local storage.
 * Performs related actions to apply settings.
 *
 */
function handleLocalStorage() {

    console.log("handleLocalStorage(): Using browser local storage");

    // Write privacy switch to local storage
    localStorage.setItem("privacy", "agreeAll");

    // Update URL parameter
    updateUrlParam("privacy", "agreeAll");

    // Load expected local storage keys
    // TODO: Setting loads

}


/**
 * Loads saved settings from local storage
 */
function loadSavedSettings() {

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
        "Please make sure your devices are connected and not being used by other software. " +
        "<br><br>" +
        "Ensure that you do not have this page open on other tabs. " +
        "<br><br>" +
        "Check that you have allowed camera access in your browser. " +
        "<br><br>" +
        "You may also try a hard reload by pressing Ctrl + F5 ";
    let genericPromptActions = [
        ["Retry",       () =>       { videoStart(); } ],
        ["Dismiss",     () =>       {               } ]
    ];

    // Get permission and inputs                                                                                 // DEV: Functional code style with ().then chained is shorter, may be used again once logics are finished
    let error = false;
    let errorDescription = "unknown";                                                                            // Store specific error description
    let inputs;

    await getMediaPermission()                                                                                   // Get permission
        .catch(e => {                                                                                            // Catch errors from getMediaPermission()
            error = true;                                                                                        // Flag error
            errorDescription = "No media permission or access"                                                   // Give specific readable error description
            console.error("videoStart(): " + errorDescription + " : " + e.name + " : " + e.message);             // Log error
    });                                                                                                          // End catch for getMediaPermission()

    if (!error) {                                                                                                // Only run if no errors
        inputs = await getVideoInputs()                                                                          // Get inputs
            .catch(e => {                                                                                        // Catch errors from getVideoInputs()
                error = true;                                                                                    // Flag error
                errorDescription = "No valid inputs could be found"                                              // Give specific readable error description
                console.error("videoStart(): " + errorDescription + " : " + e.name + " : " + e.message);         // Log error
            });                                                                                                  // End catch for getVideoInputs()
    }

    // Use input(s)
    if (!error) {                                                                                // Only run if no errors
        try {
            let input = await updateInputList(inputs);                                           // Update selector list, selecting some input
            await setVideoInput(input);                                                          // Use the selected input
            resetVideoState();                                                                   // Reset video view
        } catch (e) {
            // TODO: Catch not reliable enough
            error = true;                                                                                 // Flag error
            errorDescription = "Error while attempting to use video input(s)"                             // Give specific readable error description
            console.error("videoStart(): " + errorDescription + " : " + e.name + " : " + e.message);      // Log error
        }
    }

    if (error) { customPrompt(genericPromptTitle, genericPromptText, genericPromptActions, "10%"); }                   // Prompt user
    // TODO: Provide readable error description and conditional solutions

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
        // TODO: Add error-specific handling, including a specific/helpful prompt
        // General descriptions from https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
        let errorExpected = "expected";
        let errorDescription = "unknown";
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

                errorDescription = "Missing camera permissions";

                break;
            case "AbortError":
                // Although the user and operating system both granted access to the hardware device,
                // and no hardware issues occurred that would cause a NotReadableError DOMException,
                // thrown if some problem occurred which prevented the device from being used.

                if ( e.message === "Starting videoinput failed") {
                    // This error is typically encountered on Firefox (2025).
                    // Encountered when the specific video input is already in use elsewhere through mediaDevices or W10 WMF (used by Zoom).
                }

                errorDescription = "Video input already in use (Firefox)";

                break;
            case "NotReadableError":
                // Thrown if, although the user granted permission to use the matching devices,
                // a hardware error occurred at the operating system, browser, or Web page
                // level which prevented access to the device.

                if ( e.message === "Device in use") {
                    // This error is typically encountered on Chrome (2025).
                    // Encountered when the specific video input is already in use elsewhere through mediaDevices or W10 WMF (used by Zoom).
                }

                errorDescription = "Video input already in use (Chrome)";

                break;
            default:
                errorExpected = "unexpected";
        }

        print("getMediaPermission(): Failure, " + errorExpected + " error: " + errorDescription + " : " + e.name + " : " + e.message);

        throw new Error("getMediaPermission(): Failure: " + errorDescription);
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

    // TODO: Retries in function may be redundant, though enumeration is not completely reliable
    const retryAttempts = 3;                                                                          // Number of retries before throwing error
    let failedCount = 0;

    while (true) {                                                                                    // Retry until a device is found or retry limit reached

        let devices = await navigator.mediaDevices.enumerateDevices();                                // Find all media sources

        devices.forEach(device => {
            if (device.kind === 'videoinput') {                                                       // Only accept video sources
                if (device.deviceId === "") {                                                         // Detect and filter invalid values
                    // DEV: In some cases (like missing permissions) empty values may be returned.
                    // DEV: These values will be objects of the right kind but do not have device Ids and can not be used.
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
    if (selector.value === "undefined") errorValue = "undefined (string)";                          // Typical for option value set of undefined array values (incorrect use of array)
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
async function backgroundUpdateInputList() {
    try {
        let inputs = await getVideoInputs();
        updateInputList(inputs);
    } catch (e) {
        print("backgroundUpdateInputList(): Background update failed: " + e);
    }

}

/**
 * Accesses a camera feed.
 *
 * @param input Identifier of video input to access
 * @returns {Promise<boolean>}
 */
async function setVideoInput(input = selector.value) {

    // TODO: Retries in function may be redundant, though input setting is not completely reliable
    const retryAttempts = 3;                                                                     // Number of retries before giving up
    let failedCount = 0;
    let failed = false;

    while (true) {                                                                               // Retry until success or retry limit reached
        try {
            print("setVideoInput(): Accessing a camera feed: " + shorten(input));
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
            // bruteForceVideoStream(input); // Accessible from developer menu, is intensive if used here

            break;
        } catch (error) {                                                                          // Failure
            console.warn("setVideoInput(): Camera could not be accessed (retry " + failedCount + "): " + error);
            if (failedCount >= retryAttempts) {                                                    // Break when too many retries
                console.error("setVideoInput(): Camera access failed, total retries: " + failedCount);
                failed = true;
                break;
            }

            // DEV: Most likely error is OverconstrainedError, but should only occur if device with used deviceId is not available

            failedCount++;
        }
    }

    if (failed) {                                                                               // TODO: Unable to throw error that is caught within promise
        throw new Error("setVideoInput(): Could not select camera");                            // DEV: A simple synchronous error is hard to catch from an async function by caller like videoStart(), try/catch or ().catch not catching
        // return Promise.reject(new Error("setVideoInput(): Could not select camera"));        // DEV: Explicit promise rejection not adequate
    }

    return !failed;
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
 * @param event Mouse event 'mousedown'
 */
function islandDragStart (event) {

    print("islandDragStart(): Island drag initiated" );

    isIslandDragging = true;

    // Get current coordinates
    mouseX = event.clientX;
    mouseY = event.clientY;
    islandX = parseInt(island.style.left, 10) || 0;  // Parses island's position to decimal number. Number is set to 0 if NaN.
    islandY = parseInt(island.style.top, 10) || 0;

    document.addEventListener('mousemove', islandDragUpdater);                          // Note that event object is passed automatically. Arrow function here would cause a major issue with duplicate function instances.
    document.addEventListener('mouseup', islandDragStop);

}

/**
 * Calculate new position for island control bar. Update island style according new position.
 * @param event Mouse event 'mousemove'
 */
function islandDragUpdater(event) {

    print("islandDragUpdater(): Mass event: Island drag in progress");

    if (isIslandDragging) {                                                // This conditional will MASK issues like drag handlers not being removed
        // Calculates new position
        let pos1 = mouseX - event.clientX;
        let pos2 = mouseY - event.clientY;
        mouseX = event.clientX;
        mouseY = event.clientY;

        // Updates the dragged island's position
        island.style.top = (island.offsetTop - pos2) + "px";
        island.style.left = (island.offsetLeft - pos1) + "px";
    }
}

/**
 * Stop Island dragging when mouse key is lifted. Remove event listeners.
 */
function islandDragStop() {
    isIslandDragging = false;
    document.removeEventListener('mousemove', islandDragUpdater);
    document.removeEventListener('mouseup', islandDragStop);

    print("islandDragStop(): Island drag stopped");
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
            print("switchToFullscreen(): Full screen mode activated");
            fullScreenIcon.title = 'Close full screen';
            fullScreenIcon.src = "./images/closeFullScreen.png";
        }).catch(error => {
            alert(`Error attempting to switch to fullscreen mode: ${error.message}`);
        });
    } else {
        document.exitFullscreen().then(() => {                      // Exit full screen mode, if it's already active
            print("switchToFullscreen(): Full screen mode closed");
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
 * Executes actions based on button press.
 * Every button will dismiss prompt.
 *
 * @param title Title text for prompt
 * @param text Body text for prompt (can contain HTML tags)
 * @param options Array with text and code to run for buttons
 * @param position Position of prompt (string value for property style.left)
 * @param size Size of prompt
 */
function customPrompt(title= "Title", text = "Text", options = [["Dismiss", () => {  }]], position = "50%", size = "200px") {

    // Examples of use:

    // customPrompt("Title", "Text or HTML",                                                                       [
    //     [   "Button"                , () => { console.log("Button pressed")                                  }  ],
    //     [   "Dismiss"               , () => {                                                                }  ]
    // ], "50%");

    // customPrompt("Title of test menu", "String or variable containing string, string can contain HTML code",    [
    //     [   "Option 1"              , () => { function_name1()                                               }  ],
    //     [   "Option 2"              , () => { function_name2();                                              }  ],
    //     [   "Option 3 "             , () => { function_name2(); function_name3();                            }  ],
    //     [   "Text for button"       , () => { console.log("functions and code blocks supported")             }  ],
    //     [   "Text for button"       , () => { console.log("any command can be run here")                     }  ],
    //     [   "Text for button"       , () => { console.log("for complex actions, use nested functions")       }  ],
    //     [   "Dismiss"               , () => { let info = "all buttons will always dismiss prompt"            }  ]
    // ], "50%");

    // Buttons also support optional custom colors (note that only rgba colors with transparency enable good hover effects)
    // Custom width and positioning (% of viewport from left) are supported
    // customPrompt("Title", "Text or HTML",                                                         [
    //     [   "Green button"        , () => { console.log("Green button pressed")         }  , "Green"               ],
    //     [   "Blue button"         , () => { console.log("Blue button pressed")          }  , "#0067FFBC"           ],
    //     [   "Red button"          , () => { console.log("Red button pressed")           }  , "rgba(255,0,0,0.74)"  ]
    // ], "70%", "100px");

    // Create prompt container
    const prompt = document.createElement('div');                // Create element
    prompt.id = String(Date.now());                                      // Assign a (pseudo) unique id

    // CSS block for prompt container
    {
        // Styling
        prompt.className = 'prompt';                                     // Set basic CSS class

        // Positioning
        prompt.style.position = 'fixed';                                 // Mobility
        prompt.style.left = position;                                    // Position
        // TODO: Automate prevention of overlap of concurrent prompts
        // TODO: Extend positioning arg support (pass definitions as object)

        // Sizing
        prompt.style.width = size;                                    // Sizing
        // TODO: Add support for sizing argument

        // Initial state for animation
        prompt.style.opacity = '0';
        prompt.style.bottom = `0px`;
        prompt.style.transition = 'bottom 0.3s ease-out, opacity 0.3s ease-out';
    }

    // Logo
    // TODO: Create container and getter logic for logo

    // Create title text
    const textTitleElement = document.createElement('div');
    const textTitle = document.createTextNode(title);

    // Styling
    textTitleElement.className = 'promptTitle';                       // Set basic CSS class

    // Append
    textTitleElement.appendChild(textTitle);
    prompt.appendChild(textTitleElement);

    // Create body text
    const textBody = document.createElement('div');

    // Handle HTML text
    if (/</.test(text) && />/.test(text)) {                             // Test for signs of HTML tags
        print("customPrompt(): Prompt text identified as HTML");
        textBody.innerHTML = text;                                      // HTML text to innerHTML of div
    } else {
        print("customPrompt(): Prompt text identified as plain string");
        textBody.textContent = text;                                    // Plain string text to text content of div
    }

    // TODO: Check input is valid (opened tags are closed or at least <> counts match), malformed should be fine and won't throw any errors but should be noticed

    // Styling
    textBody.className = 'promptText';                                     // Set basic CSS class

    // Append
    prompt.appendChild(textBody);

    // Create button container
    const buttonContainer = document.createElement('div');

    // Styling
    buttonContainer.className = 'promptButtonContainer';                   // Set basic CSS class

    // Create buttons
    options.forEach((optionButton) => {
        // Create button
        const button = document.createElement('button');
        button.textContent = `${optionButton[0]}`;

        // Styling
        button.className = 'promptButton';                                // Set basic CSS class

        // Custom color (optional)
        if (optionButton[2] != null) {
            // console.warn("customPrompt(): Custom color " + optionButton[2] + " requested for button: " + optionButton[0]);

            // DEV: TODO: Print won't trigger here because debug var not set yet

            // Set base color
            button.style.backgroundColor = optionButton[2];          // Overrides CSS background color (including hover) // DEV temp: `${optionButton[2]}`

            // Custom hover
            let customHoverColor = optionButton[2];
            if (customHoverColor.startsWith('rgba')) {
                // console.warn("customPrompt(): Color is rgba, hover enabled");

                // Change color alpha for hover color
                customHoverColor = customHoverColor.replace(/,\s*(\d\.\d*)\)$/, ", 1)");
                // Regex ,\s*(\d\.\d*)\)$ matches for example ,0.50) ,0.5) ,0.), decimal number is grouped (but group not used by replace)

                // console.warn("customPrompt(): Hover color: " + customHoverColor);
            }

            button.addEventListener("mouseenter", () => button.style.backgroundColor = customHoverColor);
            button.addEventListener("mouseleave", () => button.style.backgroundColor = optionButton[2]);
            // TODO: Make sure event listeners are orphaned completely for GC


        }

        // Attach action listener
        button.addEventListener('click', () => {
            dismiss();                                                    // Buttons always dismiss prompt
            optionButton[1]();                                            // Run function or code block
        });

        // Append
        buttonContainer.appendChild(button);
    });

    // Append
    prompt.appendChild(buttonContainer);

    print("customPrompt(): Creating prompt " + prompt.id + " : " + title);
    document.body.appendChild(prompt);

    // Dismiss prompt after timeout
    // const timeout = 1000;
    // if (timeout >= 0) {
    //     setTimeout(() => {
    //         dismiss();
    //     }, 1000);}
    // }

    // TODO: Replace animations with show and hide, extend show and hide arguments

    // Animation: fade in
    requestAnimationFrame(() => {
        prompt.style.bottom = `${document.getElementById('controlBar').offsetHeight + 10}px`;               // Position after animation, above control bar
        prompt.style.opacity = '1';
    });

    // Nested function to dismiss prompt
    function dismiss() {
        print("customPrompt(): Dismissing prompt " + prompt.id);

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
 * Changes font size.
 * @param size
 */
function changeFontSize(size) {
    TextArea.changeFontSize(size); // Using static method, should be deprecated
}

/**
 * Adds new overlay.
 */
function addOverlay() {
    createdElements.createOverlay();
    // new Overlay(); // Direct instantiation without management
}

/**
 * Adds new text area.
 */
function addText() {
    createdElements.createTextArea();
    // new TextArea(); // Direct instantiation without management
}


// Classes for created elements

/**
 * Class for managing created elements.
 */
class CreatedElements {

    // Generic
    elements = [];                                  // Contains information on all created elements: [[classReference, "type", "id"]]


    // Initialization
    constructor() {

    }


    // Creator methods

    /**
     * Creates an overlay and registers it to management.
     */
    createOverlay() {
        const classReference = new Overlay();
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
        print("createOverlay(): Created and registered " + classReference.getType() + ": " + classReference.getElementId());
        return classReference;
    }

    /**
     * Creates a text area and registers it to management.
     */
    createTextArea() {
        const classReference = new TextArea();
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
        print("createTextArea(): Created and registered " + classReference.getType() + ": " + classReference.getElementId());
        return classReference;
    }

    /**
     * Creates a menu and registers it to management.
     */
    createMenu() {
        const classReference = new Menu();
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
        print("createMenu(): Created and registered " + classReference.getType() + ": " + classReference.getElementId());
        return classReference;
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
        return this.element.getAttribute('id');               // Returns main HTML element id
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
        newElement.id = number + idBase;            // TODO: Change method to take id from caller instead of forming an id here. Caller must make sure id is new and not taken (pseudorandom: String(Date.now()); ).
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

    // Class shared variables (TODO: Deprecate)
    static overlayCount = 0;                                                                // Counter for overlays // TODO: Only used for unique id, is risky, use instead String(Date.now());
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


    // Drag handling (TODO: Replace with generic in MovableElement)

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
        print("dragUpdater(): Mass event: Overlay drag in progress");
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

    // Class shared variables (TODO: Deprecate)
    static textAreaCount = 0;                                                               // Counter for text areas TODO: Only used for unique id, is risky, use instead String(Date.now());
    static activeTextArea;                                                                  // Shows which text area is currently active TODO: Deprecate, if this object class _instance_ is called by mouse event, currently active is always this.element

    // Other
    offsetXText;                                                                             // Initial position of the text area when starting drag
    offsetYText;
    startWidth;                                                                              // Initial size of the text area when starting resize
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
        this.container.addEventListener("mousedown", (e) => this.dragStart(e));                                 // Handle mousedown action (for text area and resize handle)
        this.container.addEventListener("mousemove", (e) => this.dragUpdater(e));                               // Handle mousemove action (for text area and resize handle)
        this.container.addEventListener("mouseup", () => this.dragStop());                                      // Stop moving or resizing when the mouse is released
        // TODO: Revise listeners, duplicates, temporary listeners not being deleted, definite low-volume memory leak

        this.element.addEventListener('input', () => this.resizeToFitText(this.element, this.container));                     // Expand to fit text
    }


    // Drag handling (TODO: Replace with generic in MovableElement)

    /**
     * Activates the selected text area with mouse click and captures the mouse click position.
     * Attaches event listeners for `mousemove` and `mouseup`.
     * @param e MouseEvent 'mousedown'
     */
    dragStart(e) {
        print("dragStart(): Text area drag initiated");

        TextArea.activeTextArea = this.element;                         // When this object class instance is called by mouse event, currently active is always this.element, see changeFontSize()
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

        // TODO: These were and are duplicates of existing event handlers (see handleListeners() ). These are not and should not be needed. Without these, however, dragging and especially resize are more sluggish, though they do work.
        // TODO: Revise listeners, duplicates, temporary listeners not being deleted, definite low-volume memory leak

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
        print("dragUpdater(): Mass event: Text area drag in progress");

        if (this.isMoving) {                                                                      // Move the textarea when the mouse moves
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
        print("dragStop(): Text area drag stopped");

        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
        this.isMoving = false;
        this.isResizing = false;
        this.container.style.cursor = "default";
    }


    // Sizing handling

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
        // TODO: Will not work if amount of text is very low (1-4 characters) or there are no spaces (impedes word wrap), possibly browser-dependent issue
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
        // TODO: Eliminate static function and add resize call for container, based on text size: this.resizeToFitText(this.textAreaElement, this.element)
    }

}

/**
 * Class for creating a menu programmatically.
 * Used for multiple or custom menus.
 * Replaces static HTML definitions.
 */
class Menu extends MovableElement {

    // Generic
    menuDefinition = [];                    // Contains definitions for the menu contents in an array
    // Example
    // [
    // [ "id"             , "title"         , "imgSrc"                       , buttonActions     , toggleHandler         ]
    // [ "buttonRotate"   , "Rotate"        , "./images/rotate.png"          , videoRotate();    , null                  ]
    // ];


    // Initialization

    /**
     * Instantiates class.
     * Relies on parent class.
     */
    constructor() {
        super('menu');

        this.visible = false;

        this.element = this.create();
        this.testing();
    }

    /**
     * Testing function for illustration.
     * Temporary!
     * Serves as a basis for developing class functionality.
     */
    testing() {
        print("Testing menu construction (illustration)");

        // Definition
        this.menuDefinition = [
            [ "buttonRotateTest"      , "Test text"        , "./images/rotate.png"          , videoRotate                           , null           ],
            [ "buttonFlipTest"        , "Test text"        , "./images/flip.png"            , videoFlip                             , null           ],
            [ "buttonSaveImageTest"   , "Test text"        , "./images/downloadImage.png"   , saveImage                             , null           ],
            [ "buttonOverlayTest"     , "Test text"        , "./images/overlay.png"         , addOverlay                            , null           ],
            [ "buttonAddTextTest"     , "Test text"        , "./images/text.png"            , addText                               , null           ]
            // [ "buttonOverlayTest"     , "Test text"        , "./images/overlay.png"         , createdElements.createOverlay      , null           ], // TODO: Diagnose error from these
            // [ "buttonAddTextTest"     , "Test text"        , "./images/text.png"            , createdElements.createTextArea     , null           ]
        ];

        // Create core div element
        this.element = document.createElement('div');
        this.element.id = String(Date.now());                                      // Assign a (pseudo) unique id

        // Basic styling and positioning
        const menuStyle = {
            position: 'fixed',
            left: '85%',                                                           // TODO: Positioning must be programmatic or relative, should be above pressed button
            transform: 'translateX(-50%)',                                         // What was the logic?, also 'translate(-50%, -50%)'?
            width: '60px',
            background: '#454545',
            borderRadius: '5px',
            padding: '5px',
            zIndex: '9999'
        }
        Object.assign(this.element.style, menuStyle);
        this.element.style.bottom = '60px';                                                  // Initial position before animation, while in static/attached mode
        this.element.style.display = 'none';                                                 // Initial visibility
        this.element.style.opacity = '0';                                                    // Initial opacity before animation
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';
        this.element.style.alignItems = 'center';
        // this.menuDiv.style.transition = 'bottom 0.3s ease-out, opacity 0.3s ease-out';    // First animation style, obsolete
        // this.menuDiv.style.backgroundColor = 'rgba(186,20,20,0.5)';                       // backgroundColor vs. background
        // this.menuDiv.classList.add('island_controlBar');                                  // TODO: Create and apply generic shared style to CSS

        const buttonStyle = {                                                                // Base styling for buttons (deed object when assigning CSS from variable (assigning to CSSStyleDeclaration))
            width: "40px",
            height: "40px",
            backgroundColor: "rgba(128, 128, 128, 0.5)",
            borderRadius: "5px",
            // border: "2px solid darkgray",
            // borderColor: "rgba(128, 128, 128, 0.7)", // If any border at all
            padding: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "5px"
        };

        // Button creation function (nested)
        function createButton(id, text, img) {
            // Create element
            const button = document.createElement("button");
            button.id = id;


            // Apply base styling
            Object.assign(button.style, buttonStyle);

            // TODO: Add hover

            // Add icon
            const icon = document.createElement("img");
            // icon.src = "./images/" + png;
            icon.src = img;
            icon.alt = "Alt";
            icon.className = "icon";
            icon.classList.add("icon");
            // Dark theme application with dev function currently only works with button.id = "exampleButton";
            icon.style.filter = 'invert(1) grayscale(100%)'; // will mess hover if dev dark mode function used
            button.appendChild(icon);

            return button;
        }

        // Parse definition array, create buttons
        this.menuDefinition.forEach( ([id, text, img, action, toggleHandler]) => {
            const button = createButton(id, text, img);
            button.addEventListener('click', action); // usual is problematic: listenerToElement(id, 'click', action);
            this.element.appendChild(button);
        });

        // Append
        document.getElementById('videoContainer').appendChild(this.element);

    }

    create() {
        this.constructMenu();
        this.handleListeners();

        return null; // Return main element?
    }

    constructMenu() {
        // Parse array, create elements, append to DOM

        // Create and handle detach, reattach function
    }

    handleListeners() {
        // Use listenerToElement() to attach action to button
    }

    toggleHandler() {
        // Handle case where icon changes on button press
    }


    // Drag handling (TODO: Replace with generic in MovableElement)

    dragStart() {
        // Use generic from MovableElement!
    }

    dragUpdater() {
        // Use generic from MovableElement!
    }

    dragStop() {
        // Use generic from MovableElement!
    }


    // Other

    /**
     * Toggles visibility of menu.
     */
    toggleVisibility() {
        if (this.visible) {
            hideElement(this.element, 0.2);
        } else {
            showElement(this.element, 0.1, "flex");
        }
        this.visible = !this.visible;
    }

    /**
     * Detaches menu from static position, making it movable.
     */
    detach() {

    }

    /**
     * Attaches menu to its static position.
     */
    attach() {

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
    // developerButton.style.border = "2px solid darkgray";
    developerButton.style.border = "none";
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
    customPrompt("Developer menu", "Options for developers", [
        [   "Toggle visual debug"              , () => { debugVisual();                                                 }],
        [   "Update video inputs"              , () => { backgroundUpdateInputList();                                   }],
        [   "Release video stream"             , () => { releaseVideoStream();                } , "rgba(255,139,139,0.5)"],
        [   "Start video (reset)"              , () => { videoStart();                        } , "rgba(139,255,141,0.5)"],
        [   "Brute test video input"           , () => { bruteForceBestVideoStream();                                   }],
        [   "Switch theme"                     , () => { document.documentElement.classList.toggle("lightMode");  }],
    //  [   "Test another UI style"            , () => { testUserInterfaceVersion();                                    }],
        [   "Dump local storage"               , () => { dumpLocalStorage();                  } , "rgba(172,139,255,0.5)"],
        [   "Clear local storage"              , () => { localStorage.clear();                } , "rgba(255,139,139,0.5)"],
        // ADD NEW ROW ABOVE THIS ROW FOR EACH NEW BUTTON, USE TEMPLATE
        // Template:
    //  [   "Text for button"                  , () => { function_or_code_block();                                      }],
        [   "Dismiss"                          , () => {                                                                }]   // Preserve as final line
    ], "30%");

}

/**
 * Prints out all local storage key-value pairs to console
 * @returns {{}} Object containing all key-value pairs
 */
function dumpLocalStorage() {
    let localStorageDataPairs = {};                             // Object instead of array
    Object.keys(localStorage).forEach(key => {
        localStorageDataPairs[key] = localStorage.getItem(key);
    });
    console.log(JSON.stringify(localStorageDataPairs));         // Formatted output
    // console.log(localStorageDataPairs);
    return localStorageDataPairs;
}

/**
 * Deletes all cookies from the document
 */
function deleteAllCookies() {
    document.cookie.split(';').forEach(cookie => {
        document.cookie = cookie.split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    });
}

/**
 * Deletes a specific cookie from the document
 * @param cookieName
 */
function deleteSpecificCookie(cookieName) {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
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
    if (stream.getVideoTracks().length > 1) console.warn("printStreamInformation(): Unexpected amount of video tracks (more than 1), document this instance!");

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

        // To print a FULL formatted output with all information:
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
                // noinspection JSCheckFunctionSignatures
                const stream = await navigator.mediaDevices.getUserMedia({
                     video: {
                         deviceId: { exact: String(input) },
                         facingMode: { ideal: String(facingMode) },
                         width: { ideal: Number(width) },
                         height: { ideal: Number(height) },
                         frameRate: { ideal: Number(frameRate) }
                     }
                     // If this function is not producing expected results, try alternative below.
                     // Function will work with or without all types forced to correct ones.
                     // video: {
                     //     deviceId: { exact: input },
                     //     facingMode: { ideal: facingMode },
                     //     width: { ideal: width },
                     //     height: { ideal: height },
                     //     frameRate: { ideal: frameRate }
                     // }
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

    await videoStart();
}

/**
 * Shortens a long string.
 * Used for long hex device ids.
 * @param id
 * @returns {string}
 */
function shorten(id) {
    // Might want to remove {} from ends
    // id = id.replace(/^(\{|\})|(\\{|\})$/g, '');
    // id = id.replace(/^([{}])|(\\{|})$/g, '');
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

    // Create menu buttons as examples

    const buttonStyle = {
        width: "40px",
        height: "40px",
        backgroundColor: "rgba(128, 128, 128, 0.5)",
        borderRadius: "5px",
        // border: "2px solid darkgray",
        border: "none",
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

    const testDrawMenu = createdElements.createMenu();
    const testTextMenu = createdElements.createMenu();
    const testVideoMenu = createdElements.createMenu();

    let buttons = [
      ["draw.png"       , () => { testDrawMenu.toggleVisibility(); }],
      ["text.png"       , () => { testTextMenu.toggleVisibility(); }],
      ["showVideo.png"  , () => { testVideoMenu.toggleVisibility(); }]
    ];

    buttons.forEach( ([img, action]) => {
        const button = createButton(img);
        button.addEventListener('click', action);
        menuButtons.appendChild(button);

    });

    // Append menuButtons to controlBar
    controlBar.appendChild(menuButtons);

}
