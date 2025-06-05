// Development tools
let debugMode = false;                                                                        // Sets default level of console output
const version = ("2025-06-02-alpha");
console.log("Version: " + version);

// Localization
const defaultLocale = "en";                                         // Default locale is english
const allowedLocales = ["en", "fi"];                                // Only these locales are allowed TODO: DEV: Get based on available localisation files
let currentLocale;                                                  // The active locale
let currentTranslations = {};                                       // Stores translations for the active locale

// Fetch core HTML elements
const videoElement          = document.getElementById('cameraFeed');                 // Camera feed
const canvasElement         = document.getElementById('canvasMain');                 // Main canvas
const videoContainer        = document.getElementById('videoContainer');             // Video container
const controlBar            = document.getElementById('controlBar');                 // Fixed control bar

// Video feed state
let rotation = 0;                                                                          // Store rotation state
let currentZoom = 1;                                                                       // Current zoom level
let flip = 1;                                                                              // State of image mirroring, 1 = no flip, -1 = horizontal flip
let isFreeze = false;                                                                      // Video freeze on or off

// UI state
let mouseX;                                                                                // Initial position of the mouse
let mouseY;

// Other
let selector;                                                                              // Camera feed selector
let createdElements;                                                                       // Handles created elements


// Initialization
document.addEventListener('DOMContentLoaded', start);                                 // Continue running script only after HTML has been loaded and elements are available

function start() {

    // Instantiate class for created elements
    createdElements = new CreatedElements();

    // Create interface elements
    createMenus();
    showElement(controlBar);

    // Add core listeners for interface elements
    addCoreListeners();

    // Add localization and wait for it to complete
    addLocalization().then(() => {
        
        // Handle notices, consent and data storage
        handlePrivacy();

        // Start video feed
        videoStart().then(() => {});
        showElement(videoElement);

        // Onboarding
        handleOnboarding();
        
    });

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
    listenerToElement('buttonSmallerFont', 'click', () => createdElements.changeFontSize(-5));     // Font size decrease button
    listenerToElement('buttonBiggerFont', 'click', () => createdElements.changeFontSize(5));       // Font size increase button
    listenerToElement('zoomSlider', 'input', (event) => setZoomLevel(event.target.value));   // Zoom slider                                                             //
    listenerToElement('buttonZoomIn', 'click', () => adjustZoom(0.1));              // Zoom in button
    listenerToElement('buttonZoomOut', 'click', () => adjustZoom(-0.1));            // Zoom out button

    // Fetch HTML element for full screen button and its icon. Attach event listener to full screen button.
    const fullScreenIcon = document.getElementById("iconFullScreen");
    const fullScreenButton = document.getElementById("buttonFullScreen");
    fullScreenButton.addEventListener('click', () => switchToFullscreen(fullScreenIcon, fullScreenButton));

    // Fetch HTML element for freeze button and its icon. Attach event listener to freeze button.
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

    // Add event listener to trigger input list update and hint when new media device is plugged in
    navigator.mediaDevices.addEventListener('devicechange', () => {
        backgroundUpdateInputList().then( () => {
            print("listener(): Device change registered");
            blinkVideoSelector();
        } );
    });

    // Update video input list periodically
    setInterval(backgroundUpdateInputList, 10000); // Runs background update periodically (redundancy for edge cases)
    
}

/**
 * Sets the language to default and initializes language selector.
 *
 */
async function addLocalization() {
    await setLocale(defaultLocale);
    bindLocaleSelector(defaultLocale, "[data-locale-selector]");
}

/**
 * Sets up the language selector and binds event listeners to detect language changes.
 * @param {string} initialLocale - The initial locale to set.
 * @param selector Selector to bind.
 */
function bindLocaleSelector(initialLocale, selector) {
    const localeSelector = document.querySelector(selector);
    localeSelector.value = initialLocale;
    localeSelector.onchange = (e) => {
        // Set the language based on the selected value
        setLocale(e.target.value);
    };
}

/**
 * Loads translations and applies them to the page.
 * Ensures the requested locale is allowed and translations are properly loaded.
 * @param {string} newLocale - The locale to set.
 */
async function setLocale(newLocale) {
    // Checks if new locale is in the list of allowed locales
    if (!allowedLocales.includes(newLocale)) {
        console.error(`setLocale(): Attempted to load unsupported locale: ${newLocale}`);
        return;
    }

    if (newLocale === currentLocale) return;

    const newTranslations = await fetchJSON(newLocale);
    if (!newTranslations) {
        console.error("setLocale(): Invalid translations received for locale:", newLocale);
        return;
    }

    currentLocale = newLocale;
    currentTranslations = newTranslations;
    applyTranslations();
}

/**
 * Fetches JSON from .json file
 * Assumes file path ./locales/
 * @param file File to fetch JSON from
 * @returns {Promise<any>} JSON output or boolean false for failure
 */
async function fetchJSON(file) {
    const path = `${window.location.pathname}locales/${file}.json`;
    print("fetchJSON(): Fetching: " + path);

    try {
        const response = await fetch(path);

        // Checks for HTTP response status
        if (!response.ok) {
            console.error(`fetchJSON(): HTTP error! Status: ${response.status}`);
            return false;
        }

        return await response.json();

    } catch (e) {
        console.error("fetchJSON(): Failed to fetch or parse JSON:", e);
        return false;
    }
}

/**
 * Applies translations to all elements that have a data-locale-key attribute.
 * This function iterates over the DOM and updates elements based on their translation keys.
 */
function applyTranslations() {
    document.querySelectorAll("[data-locale-key]").forEach(translateElement);
}

/**
 * Updates the text content or attributes of an element based on its data-locale-key attribute.
 * @param {HTMLElement} element - The element to translate.
 */
function translateElement(element) {
    const key = element.getAttribute("data-locale-key");
    const translation = currentTranslations[key];

    // Skip if no translation is available
    if (!translation) return;

    // If element has title attribute, it gets translated.
    if (element.hasAttribute("title")) {
        element.setAttribute("title", translation);
    }
    // Else if element has placeholder attribute, it gets translated.
    else if (element.hasAttribute("placeholder")) {
        element.setAttribute("placeholder", translation);
    }
    // Check if the element has non-empty text content. If it does, update it with the translated text.
    else if (element.textContent.trim().length > 0) {
        element.textContent = translation;
    }
}

/**
 * Handles privacy-related prompting, parameters, data storage and logical coordination
 * @returns {boolean} True if the service can be used
 */
async function handlePrivacy() {

    // Fast exit: Check browser local storage for permissive privacy setting
    const privacyKey = localStorage.getItem('privacy');                     // Get expected privacy key value from local storage
    switch (privacyKey) {
        case "agreeAll":                                                         // User agrees to ToS and local storage -> No prompt, read/create local storage
            handleLocalStorage();
            return true;                                                         // Fast exit
        default:
            print("handlePrivacy(): No fast exit (local storage)");
    }

    // Fast exit: Check URL privacy parameter for permissive privacy setting
    const privacyParameter = new URLSearchParams(window.location.search).get("privacy");  // Get expected privacy parameter value from URL
    print("handlePrivacy(): URL privacy parameters: " + privacyParameter);
    switch (privacyParameter) {
        case "agreeAll":                                                                  // User agrees to ToS and local storage -> No prompt, create local storage
            handleLocalStorage();
            return true;
        case "agreeTosExclusive":                                                         // User agrees to ToS, has forbidden local storage -> No prompt, no action
            return true;                                                                  // Fast exit
        default:
            print("handlePrivacy(): No fast exit (URL parameter)");
    }

    // Load short texts if they exist
    let texts = [                                       // Define texts and property storage
        {                                               // texts[0] is for privacy notice
            file: currentLocale + "_privacy_short",
            content: null,
            textExists: false,
        },
        {                                               // texts[1] is for terms of service notice
            file: currentLocale + "_tos_short",
            content: null,
            textExists: false,
        }
    ];

    for (const text of texts) {                         // Iterate through texts
        const content = await fetchJSON(text.file);    // Get JSON
        if (content) {                                  // If JSON accessible
            text.textExists = true;                     // Set boolean for conditional logics
            text.content = content;
            print("handlePrivacy(): Found text: " + text.file + " with title: " + content.title);
        } else {
            console.warn("handlePrivacy(): Did not find text: " + text.file);
        }
    }
    print("handlePrivacy(): Privacy files: privacy text exists = " + texts[0].textExists + " & tos text exists = " + texts[1].textExists);

    // Fast exit: Check if no texts exist
    if (!texts[0].textExists && !texts[1].textExists) {  // No texts exist -> assume local storage can be used
        handleLocalStorage();                            // Create local storage
        return true;
    } else {
        print("handlePrivacy(): No fast exit (texts exist)");
    }

    // Set button styles
    const colorAccept = "optionDefault";
    const colorMinimum = "optionNeutral";
    const colorReject = "optionNegative";

    // Interpret course of action

    // Table of actions
    // Format:
    // Text states (does text exist)   Privacy parameters
    // Privacy text    Tos text        Parameter
    // ---------------------------------------------------------------------------------------------------
    // Boolean         Boolean         Action (output)

    // Table of actions
    // Table:
    // Privacy text    Tos text        agreeTosInclusive        null                  (agreeAll)            (malformed)
    // ------------------------------------------------------------------------------------------------------------------------
    // true            -               privacyPrompt                                  handleLocalStorage
    // false           -               handleLocalStorage                             handleLocalStorage
    // true            true                                     fullPrompt            handleLocalStorage    fullPrompt
    // false           true                                     tosPrompt             handleLocalStorage    tosPrompt
    // true            false                                    privacyPrompt         handleLocalStorage    privacyPrompt
    // false           false                                    handleLocalStorage    handleLocalStorage    handleLocalStorage

    // TODO: Minimize table, compact logic

    switch (privacyParameter) {
        case "agreeTosInclusive":                                                // User already agrees to ToS, has not agreed to local storage
            if (texts[0].textExists) {                                           // Privacy text exists
                print("handlePrivacy(): ToS agree, privacy unknown, displaying privacy prompt");
                privacyPrompt();                                                 // Privacy prompt
            } else {                                                             // Privacy text does not exist
                print("handlePrivacy(): ToS agree, privacy unknown, no privacy notice text, creating local storage without prompt");
                handleLocalStorage();                                            // Create local storage (assume local storage can be used if privacy notice text is not provided)
            }
            break;
        case null:                                                               // No URL privacy parameter set
            print("handlePrivacy(): ToS unknown, privacy unknown, displaying prompts for which texts exist");
            if (texts[1].textExists) {                                           // ToS text exists
                print("handlePrivacy(): ... ToS text exists");
                if (texts[0].textExists) {                                       // Privacy text exists
                    print("handlePrivacy(): ... privacy text exists");
                    fullPrompt();                                                // Full prompt
                } else {                                                         // Privacy text does not exist
                    print("handlePrivacy(): ... privacy text does not exist");
                    tosPrompt();                                                 // ToS prompt
                }
            } else {                                                             // ToS text does not exist
                print("handlePrivacy(): ... ToS text does not exist");
                if (texts[0].textExists) {                                       // Privacy text does exist
                    print("handlePrivacy(): ... privacy text exists");
                    privacyPrompt();                                             // Privacy prompt
                }
            }

            break;
        default:                                                                 // Privacy agreement state value unexpected
            console.warn("handlePrivacy(): URL privacy parameter has unexpected value: " + privacyParameter);
            if (texts[0].textExists && texts[1].textExists) {
                fullPrompt();                                                    // Full prompt
            } // TODO: Not handling case where param is malformed but only one text exists. This section behaves exactly the same as null, should combine.
    }

    // Nested functions for prompts

    /**
     * Displays a privacy notice.
     */
    function privacyPrompt() {
        console.log("privacyPrompt(): Displaying a notice: " + texts[0].content.title);

        // noinspection JSUnresolvedReference                                   // Object is dynamic
        customPrompt(texts[0].content.title, texts[0].content.text, [
            [   texts[0].content.rejectStorage , () => { updateUrlParam("privacy", "agreeTosExclusive"); } , colorReject  ],
            [   texts[0].content.notNow        , () => { /* Only implicit rejection, ask again later */ }                       , colorMinimum ],
            [   texts[0].content.agreeStorage  , () => { handleLocalStorage(); }                                                , colorAccept  ]
        ], "50%", "350px");
    }

    /**
     * Displays a full privacy and ToS (terms of service) notice.
     */
    function fullPrompt() {
        console.log("fullPrompt(): Displaying a notice: " + texts[0].content.title + " & " + texts[1].content.title);

        // noinspection JSUnresolvedReference                                   // Object is dynamic
        customPrompt(texts[0].content.title + " & " + texts[1].content.title, texts[0].content.text + "<br>" + texts[1].content.text, [
            [   texts[1].content.rejectTos    , () => { haltService(); }                                                       , colorReject  ],
            [   texts[1].content.agreeToTos   , () => { updateUrlParam("privacy", "agreeTosInclusive"); } , colorMinimum ],
            [   texts[1].content.agreeToAll   , () => { handleLocalStorage(); }                                                , colorAccept  ]
        ], "50%", "350px");
    }

    /**
     * Displays a ToS (terms of service) notice.
     */
    function tosPrompt() {
        console.log("tosPrompt(): Displaying a notice: " + texts[1].content.title);

        // noinspection JSUnresolvedReference                                   // Object is dynamic
        customPrompt(texts[1].content.title, texts[1].content.text, [
            [   texts[1].content.rejectTos    , () => { haltService(); }                                                       , colorReject  ],
            [   texts[1].content.agreeToTos   , () => { updateUrlParam("privacy", "agreeTosInclusive"); } , colorAccept  ]
        ], "50%", "350px");

    }

    function haltService() {
        console.error("handlePrivacy(): Terms rejected, call to halt service");
        // TODO: Trigger video freeze event or other halt
    }

    return true; // TODO: For return value to have a relevant effect, function would need to await prompt responses
}

/**
 * Modifies and updates a single parameter in the URL query string.
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
 */
function handleLocalStorage() {
    console.log("handleLocalStorage(): Using browser local storage");

    // Write privacy switch to local storage
    localStorage.setItem("privacy", "agreeAll");

    // Update URL parameter
    updateUrlParam("privacy", "agreeAll");

    // Handle settings
    handleSettingStorage();
}

/**
 * Writes or reads persistent settings.
 *
 */
function handleSettingStorage() {
    // TODO: Setting loads and saves (saves should only be committed if user has agreed to storage)
}

function createMenus() {

    // Get container elements of control bar
    const menuContainerTop           = document.getElementById('controlBarTopContainer');
    const menuContainerMiddle        = document.getElementById('controlBarMiddleContainer');
    const menuContainerBottom        = document.getElementById('controlBarBottomContainer');

    // Create menu buttons (top)
    const buttonDraw = Menu.createButton("draw.png", "buttonDraw", "iconDraw", "Draw", menuContainerTop);

    // Create menu buttons (middle)
    const buttonSettings = Menu.createButton("settings.png", "buttonSettings", "iconSettings", "Settings", menuContainerMiddle);

    // Create menu buttons (bottom)
    const buttonInfo = Menu.createButton("info.png", "buttonInfo", "iconInfo", "About", menuContainerBottom);
    const buttonZoom = Menu.createButton("zoom.png", "buttonZoom", "iconZoom", "Zoom", menuContainerBottom);
    const buttonVideoSelect = Menu.createButton("switchCamera.png", "buttonVideoSelect", "iconVideoSelect", "Select video source", menuContainerBottom);


    // Draw menu creation
    {                                   // Code block for collapsing
        let menuDraw = [];

        // Create color options

        const colorOptions = [
            { colorCode: '#000000', colorName: 'Black' , action: () => { setDrawColor('#000000') } },
            { colorCode: '#FFFFFF', colorName: 'White' , action: () => { setDrawColor('#FFFFFF') } },
            { colorCode: '#FFDE21', colorName: 'Yellow', action: () => { setDrawColor('#FFDE21') } },
            { colorCode: '#90D5FF', colorName: 'Blue'  , action: () => { setDrawColor('#90D5FF') } },
            { colorCode: '#FC6C85', colorName: 'Red'   , action: () => { setDrawColor('#FC6C85') } }
        ];

        colorOptions.forEach(opt => {
            menuDraw.push({
                id: `buttonColor${opt.colorName}`,
                text: opt.colorName,
                customHTML: createColorBox(opt.colorCode)
            });
        });

        /**
         * Nested function to create button boxes for color selection
         *
         * @param color
         * @returns {HTMLDivElement}
         */
        function createColorBox(color) {
            const box = document.createElement('div');
            box.style.width = '24px';
            box.style.height = '24px';
            box.style.background = color;
            box.style.margin = "0 2px";
            box.style.outline = "1px solid #FFFFFF";
            box.style.outlineOffset = "2px";
            return box;
        }

        /**
         * Changes active drawing color.
         *
         * @param color Color to use
         */
        function setDrawColor(color) {
            // Colors from parameter are strings of this type: '#000000' '#FFFFFF' '#FC6C85' etc
            // Example call of this function: setDrawColor('#FFDE21')
            print("setDrawColor(): Changing color to " + color, "green");
        }

        // Create separator
        const separator = document.createElement('div');
        separator.style.width = '1px';
        separator.style.height = '38px';
        separator.style.background = "#727277";
        menuDraw.push( {id: "separator", text: "Separator", customHTML: separator} );

        const thicknessOptions = [
            { thickness: 2, thicknessName: 'Thin',    action: () => { setDrawThickness(2);  } },
            { thickness: 4, thicknessName: 'Light',   action: () => { setDrawThickness(4);  } },
            { thickness: 8, thicknessName: 'Medium',  action: () => { setDrawThickness(8);  } },
            { thickness: 12, thicknessName: 'Thick',  action: () => { setDrawThickness(12); } },
            { thickness: 18, thicknessName: 'Heavy',  action: () => { setDrawThickness(18); } }
        ];

        thicknessOptions.forEach(opt => {
            menuDraw.push({
                id: `buttonLine${opt.thickness}`,
                text: opt.thicknessName,
                customHTML: createCircleBox(opt.thickness)
            });
        });

        /**
         * Nested function to create button boxes for line thickness
         *
         * @param diameter
         * @returns {HTMLDivElement}
         */
        function createCircleBox(diameter) {
            const box = document.createElement('div');
            box.style.width = '24px';
            box.style.height = '24px';
            box.style.position = 'relative';
            box.style.background = "#F7F7F8";
            box.style.margin = "0 2px"
            box.style.outline = "1px solid #FFFFFF";
            box.style.outlineOffset = "2px";

            const circle = document.createElement('div');
            circle.style.width = `${diameter}px`;
            circle.style.height = `${diameter}px`;
            circle.style.borderRadius = '50%';
            circle.style.background = '#000';
            circle.style.position = 'absolute';
            circle.style.top = `${(24 - diameter) / 2}px`;
            circle.style.left = `${(24 - diameter) / 2}px`;

            box.appendChild(circle);
            return box;
        }

        /**
         * Changes active drawing thickness.
         *
         * @param thickness Thickness to use
         */
        function setDrawThickness(thickness) {
            // Thickness values from parameter are numbers of this type: 2 4 8 etc
            // Example call of this function: setDrawThickness(12)
            // Thickness values are diameters
            print("setDrawThickness(): Changing thickness to " + thickness, "green");
        }

        // Create menu
        createdElements.createMenu(menuDraw, buttonDraw, "leftToRight");
    }

    // Settings menu creation
    {                                   // Code block for collapsing
        let menuSettings = [];

        // Create settings menu subsection: language selection
        const selectLanguageContainer = document.createElement("div");
        selectLanguageContainer.style.display = "flex";
        selectLanguageContainer.style.flexDirection = "row";
        selectLanguageContainer.style.alignItems = "center";
        selectLanguageContainer.style.gap = "7px"; // DEV: CSS inheritance not working, inline used
        selectLanguageContainer.style.padding = "0 7px"; // DEV: CSS inheritance not working, inline used

        const languageImg = document.createElement("img");
        languageImg.src = "./images/language.png";
        languageImg.style.display = "block";
        languageImg.style.width = "22px";
        languageImg.style.height = "22px";
        languageImg.classList.add("icon");
        selectLanguageContainer.appendChild(languageImg);

        const languagesDiv = document.createElement("div");
        languagesDiv.id = "languages";

        const select = document.createElement("select");
        select.setAttribute("data-locale-selector", "");
        select.className = "locale-switcher";
        select.title = "Change Language";
        select.style.width = "80px";
        select.setAttribute("data-locale-key", "language");

        // Language options TODO: DEV: Load based on available locales instead of explicitly creating option for each language

        const optionEn = document.createElement("option");
        optionEn.value = "en";
        optionEn.setAttribute("data-locale-key", "english");
        optionEn.textContent = "English";
        select.appendChild(optionEn);

        const optionFi = document.createElement("option");
        optionFi.value = "fi";
        optionFi.setAttribute("data-locale-key", "finnish");
        optionFi.textContent = "Finnish";
        select.appendChild(optionFi);

        languagesDiv.appendChild(select);
        selectLanguageContainer.appendChild(languagesDiv);

        menuSettings.push({ id: "languageSelector", text: "Language", customHTML: selectLanguageContainer });

        // Create settings menu subsection: theme selection

        const switchThemeContainer = document.createElement("div");
        switchThemeContainer.style.display = "flex";
        switchThemeContainer.style.flexDirection = "column";
        switchThemeContainer.style.gap = "7px"; // DEV: CSS inheritance not working, inline used
        switchThemeContainer.style.padding = "0 7px"; // DEV: CSS inheritance not working, inline used

        const switchThemeLabel = document.createElement("div");
        switchThemeLabel.textContent = "Light Theme";
        switchThemeLabel.style.textAlign = "center";

        const switchTheme = document.createElement("input");
        switchTheme.type = "checkbox";

        switchTheme.addEventListener("change", () => {
            document.documentElement.classList.toggle("lightMode");
        });

        switchThemeContainer.appendChild(switchThemeLabel);
        switchThemeContainer.appendChild(switchTheme);

        menuSettings.push({ id: "themeSwitch", text: "Theme", customHTML: switchThemeContainer });

        // Create settings menu
        createdElements.createMenu(menuSettings, buttonSettings, "leftToRight");
    }

    // Info menu creation
    {                                   // Code block for collapsing
        let menuInfo = [
            {
                id: "buttonLegalInfoPrompt", text: "Show legal information", img: "terms.png", action: () => {
                    showLegalInfo();
                }
            }
        ];

        /**
         * Nested function to show info prompt
         */
        function showLegalInfo() {
            showContentBox('en_tos_long', true, true); // TODO: Display proper information in correct language
        }

        // Create info menu
        createdElements.createMenu(menuInfo, buttonInfo, "leftToRight");
    }

    // Zoom menu creation
    {                                   // Code block for collapsing
        let menuZoom = [];

        // Creating custom HTML in menu
        const zoomContainer = document.createElement('div');                // Create container
        zoomContainer.id = "zoomControls";

        const zoomFit = Menu.createButton("fit.png", "buttonZoomFit", "iconZoomFit", "Fit to window", zoomContainer);

        const zoomOut = document.createElement("button");
        zoomOut.dataset.localeKey = "zoomOut";
        zoomOut.id = "buttonZoomOut";
        zoomOut.title = "Zoom Out";
        zoomOut.className = "buttonSmall";
        zoomOut.textContent = "-";
        zoomContainer.appendChild(zoomOut);

        const zoomSlider = document.createElement("input");
        zoomSlider.dataset.localeKey = "zoom";
        zoomSlider.title = "Zoom";
        zoomSlider.type = "range";
        zoomSlider.id = "zoomSlider";
        zoomSlider.min = "100";
        zoomSlider.max = "200";
        zoomSlider.step = "1";
        zoomSlider.value = "100";
        zoomContainer.appendChild(zoomSlider);

        const zoomIn = document.createElement("button");
        zoomIn.dataset.localeKey = "zoomIn";
        zoomIn.id = "buttonZoomIn";
        zoomIn.title = "Zoom In";
        zoomIn.className = "buttonSmall";
        zoomIn.textContent = "+";
        zoomContainer.appendChild(zoomIn);

        const zoomFill = Menu.createButton("fill.png", "buttonZoomFill", "iconZoomFill", "Fill window", zoomContainer);

        const zoomLabel = document.createElement("span");
        zoomLabel.id = "zoomPercentageLabel";
        zoomLabel.textContent = "100%";
        zoomContainer.appendChild(zoomLabel);

        menuZoom.push( { id: "zoomControls", text: "Zoom", customHTML: zoomContainer } ); // Can push object to array or define directly in array

        // Create menu
        createdElements.createMenu(menuZoom, buttonZoom, "leftToRight");
    }

    // Video selection menu creation
    {                                   // Code block for collapsing
        let menuVideoSelect = [];

        // Creating custom HTML in menu
        const videoSelectContainer = document.createElement('div');                // Create container
        const videoSelector = document.createElement("select");
        selector = videoSelector;
        selector.callerElement = buttonVideoSelect;                                        // Store reference to button for future use in onboarding
        videoSelector.id = "selectorDevice";
        videoSelector.title = "Select Camera";
        videoSelector.setAttribute("data-locale-key", "selectCamera");

        videoSelectContainer.appendChild(videoSelector);
        menuVideoSelect.push({id: "videoSelector", text: "Camera selector", customHTML: videoSelectContainer}); // Can push object to array or define directly in array

        // Create menu
        createdElements.createMenu(menuVideoSelect, buttonVideoSelect, "leftToRight");
    }

}

function handleOnboarding() {
    // Blink video selector button (hint)
    blinkVideoSelector(300, 3);
}

function blinkVideoSelector(length = 300, repeats = 0) {
    let count = 0;
    const blink = () => {                           // Creates a series of async events that should fire sequentially
        selector.callerElement.classList.add("buttonHighlight");
        setTimeout(() => {
            selector.callerElement.classList.remove("buttonHighlight");
            count++;
            if (count < repeats) setTimeout(blink, 200);
        }, length);
    };
    blink();
}

// Camera control functions

/**
 * Performs all necessary steps to start video feed.
 * Handles prompt and retry logics.
 *
 * @returns {Promise<void>}
 */
async function videoStart() {

    // Get error prompt text
    // noinspection JSUnresolvedReference                                   // Object is dynamic
    let genericPromptTitle = currentTranslations.videoProblemPromptTitle;
    // noinspection JSUnresolvedReference                                   // Object is dynamic
    let genericPromptText = currentTranslations.videoProblemPromptText;
    // noinspection JSUnresolvedReference                                   // Object is dynamic
    let genericPromptActions = [
        [currentTranslations.retry,        () =>       { videoStart(); } ],
        [currentTranslations.dismiss,      () =>       {               } ]
    ];

    // Get permission and inputs
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
        } catch (e) {
            // TODO: Catch not reliable enough
            error = true;                                                                                 // Flag error
            errorDescription = "Error while attempting to use video input(s)"                             // Give specific readable error description
            console.error("videoStart(): " + errorDescription + " : " + e.name + " : " + e.message);      // Log error
        }
    }

    if (error) { customPrompt(genericPromptTitle, genericPromptText, genericPromptActions, "108px", "180px"); }                   // Prompt user
    // TODO: Provide readable error description and conditional solutions (need to forward errors properly)

}

/**
 * Accesses browser media interface to request generic permission for camera use.
 *
 * @returns {Promise<void>}
 */
async function getMediaPermission() {
    try {
        const testStream = await navigator.mediaDevices.getUserMedia({
            // video: true                                      // DEV: On Chrome this alone returns a low-quality stream, which adversely affects future requests if this is the first interface access (2025)
            video: {
                width: {ideal: 4096},                           // Request high-resolution stream (arbitrary width and height values)
                height: {ideal: 4096},
            }
        });                 // Ask for video device permission (return/promise ignored)
        print("getMediaPermission(): Media permission granted");
        print("getMediaPermission(): Test track information: " + getStreamInformation(testStream));
        releaseVideoStream(testStream);
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
        } else {
            console.error("getVideoInputs(): No video sources found")
            blinkVideoSelector();
            throw new Error("getVideoInputs(): No valid video inputs");
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
        // print("updateInputList(): Selected original video input: " + shorten(originalSelection) + " = " + shorten(selector.value));
    } else {                                                                                        // Original value invalid or not available
        selector.selectedIndex = 0;                                                                 // Select first option
        if (originalSelection) {                                                                    // Check for truthy value to prevent unneeded trigger at startup
            console.warn("updateInputList(): Original video input option not available: " + shorten(originalSelection) + " != " + shorten(selector.value));
            blinkVideoSelector();
        }

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
 * Accesses a camera for video input.
 *
 * @param input Identifier of video input to access
 * @param width Width to use as ideal value (optional)
 * @param height Height to use as ideal value (optional)
 * @returns {Promise<boolean>}
 */
async function setVideoInput(input = selector.value, width = null, height = null) {

    // Ensure clean state
    releaseVideoStream();

    let resolution;
    if (width !== null && height !==null) {
        resolution = {width: width, height : height};
    } else {
        resolution = await getMaxResolution();
    }

    try {
        print("setVideoInput(): Setting video input: " + shorten(input) + " at ideal " + resolution.width + " x " + resolution.height);

        // Get stream
        const stream = await getStreamFromInput(resolution.width, resolution.height, input);

        // Check track quality
        const trackQualityMatches = compareVideoQuality(resolution.width, resolution.height, stream);
        if (!trackQualityMatches) {
            console.warn("setVideoInput(): Video track does not match requested (ideal) constraints: " + resolution.width + " x " + resolution.height);
        }
        print("setVideoInput(): Track info: " + getStreamInformation(stream, true));

        // Assign stream to visible element
        videoElement.srcObject = stream;

    } catch (error) {                                                                          // Failure
        console.error("setVideoInput(): Camera could not be accessed: " + error);
        // DEV: Most likely error is OverconstrainedError, but given the use of ideal values, this should only occur if device with used deviceId is not available
        throw new Error("setVideoInput(): Could not select camera");                            // DEV: A simple synchronous error is hard to catch from an async function by caller like videoStart(), try/catch or ().catch not catching
        // return Promise.reject(new Error("setVideoInput(): Could not select camera"));        // DEV: Explicit promise rejection not adequate TODO: Unable to throw error that is caught within promise
    }

    return true;
}

async function getMaxResolution(input = selector.value) {
    try {
        print("getMaxResolution(): Determining max resolution for video input: " + shorten(input));

        // const stream = await getStreamFromInput(4096, 4096, input);                             // Will cause failure on some cameras: technically valid MediaStream with no content
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: {exact: input},
            }
        });

        let resolution = {width: 1920, height: 1080, description: "1080p"}; // Default value
        const track = stream.getTracks()[0];
        if (typeof track.getCapabilities === "function") {
            const capabilities = stream.getTracks()[0].getCapabilities();
            releaseVideoStream(stream);
            resolution = {width: capabilities.width.max, height: capabilities.height.max}; // Convert object values to integers with max
        } else {
            releaseVideoStream(stream);
            console.warn("getMaxResolution(): Browser does not support .getCapabilities(), calling slow fallback");
            try {
                resolution = await getMaxResolutionFallback();
            } catch (e) {
                console.error("getMaxResolution(): Fallback resolution test failed (using default resolution: " + resolution.description + ")");
            }
        }

        return {width: resolution.width, height: resolution.height};

    } catch (error) {                                                                          // Failure
        console.warn("getMaxResolution(): Camera resolution could not be set");
    }
}

async function getMaxResolutionFallback(input = selector.value) {

    print("getMaxResolutionFallback(): Starting fallback test for highest available resolution");

    // Resolutions to test
    const testResolutions = [                                               // Resolutions to test in decreasing order
        { width: 3840, height: 2160, description: "4K UHD"          },      // During test a boolean property "available" will be added to each
        { width: 2560, height: 1440, description: "1440p"           },      // Best available resolution is first array element with true value for "available"
        { width: 1920, height: 1200, description: "WUXGA"           },
        { width: 1920, height: 1080, description: "1080p"           },
        { width: 1600, height: 1200, description: "UXGA"            },
        { width: 1440, height: 1080, description: "1080p (4:3)"     },
        { width: 1366, height: 768,  description: "WXGA"            },
        { width: 1280, height: 1024, description: "SXGA"            },
        { width: 1280, height: 960,  description: "960p"            },
        { width: 1280, height: 800,  description: "WXGA"            },
        { width: 1280, height: 720,  description: "720p"            },
        { width: 1024, height: 768,  description: "XGA"             },
        { width: 800,  height: 600,  description: "SVGA"            },
        { width: 720,  height: 480,  description: "480p"            },
        { width: 640,  height: 480,  description: "VGA"             },
        { width: 640,  height: 360,  description: "360p"            },
        { width: 320,  height: 240,  description: "QVGA"            },
        { width: 160,  height: 120,  description: "QQVGA"           }
    ];

    // Loop test
    const maxResolutions = 3;
    let availableResolutions = 0;
    for (const res of testResolutions) {
        try {
            print(" ");
            const stream = await getStreamFromInput(res.width, res.height, input);
            res.available = await compareVideoQuality(res.width, res.height, stream);
            releaseVideoStream(stream);
            if (res.available === true) availableResolutions++;
            print("getMaxResolutionFallback(): Tested resolution for " + shorten(input) + " : " + res.description + " = " + res.width + " x " + res.height + " available: " + res.available + " (count of available: " + availableResolutions + "/" + maxResolutions + ")");

            if (availableResolutions >= maxResolutions) break; // Only get three available resolutions to save time
        } catch (e) {
            console.warn("getMaxResolutionFallback(): Failure to test resolution: " + res.description + " = " + res.width + " x " + res.height + " : " + e);
        }
    }

    // Check for total failure
    if (availableResolutions === 0) {
        console.error("getMaxResolutionFallback(): No available resolutions");
        return;
    }

    // Return the input(s)
    for (const res of testResolutions) {
        if (res.available === true) {
            return {width: res.width, height: res.height}; // TODO: Return multiple (3) resolutions as an object array in case highest available fails
        }
    }

}

/**
 * Gets a video stream from an input based on device id, and applies ideal constraints.
 * @param width Width constraint (ideal)
 * @param height Height constraint (ideal)
 * @param deviceId Device id constraint (exact)
 * @returns {Promise<MediaStream>} Video stream
 */
async function getStreamFromInput(width, height, deviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: {exact: deviceId},                                // Constrain to specific camera
            width: {ideal: width},                                      // Request width
            height: {ideal: height}                                     // Request height
            // frameRate: {ideal: 60}                                   // Request framerate
            // facingMode: {ideal: 'environment'},                      // Request a camera that is facing away from the user
        }
    });
    return stream;
}

/**
 * Stops all tracks of a stream to release it.
 * @param stream Stream to release, default is current active video source.
 */
function releaseVideoStream(stream = videoElement.srcObject) {

    print("releaseVideoStream(): Video release called");
    try {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    } catch (e) {
        print("releaseVideoStream(): Video release failed (safe): " + e.name);
        // Error if releasing when no video: TypeError: videoElement.srcObject is null
    }

}

/**
 * Compares specified constraints to those of a stream to check if they match.
 *
 * @param width
 * @param height
 * @param stream Stream to test for constraints, default is current active video source
 * @returns {Promise<boolean>} True if stream matches constraints.
 */
async function compareVideoQuality(width, height, stream = videoElement.srcObject) {

    // Get stream information
    const settings = stream.getTracks()[0].getSettings();

    // Return success or failure
    if (settings.width !== width || settings.height !== height) {
        print("compareVideoQuality(): Track != constraints: " + settings.width + " x " + settings.height + " != " + width + " x " + height, "yellow");
        return false;
    } else {
        print("compareVideoQuality(): Track == constraints: " + settings.width + " x " + settings.height + " == " + width + " x " + height, "green");
        return true;
    }

}

/**
 * Gets information on the tracks in a MediaStream.
 * Can print information.
 * Normally only [0] of returned array is defined and relevant.
 * @param stream MediaStream
 * @param printOut True if printout wanted
 * @returns {*[]} Array of results: [n][0] short track id [1] short device id [2] set width [3] possible width [4] set height [5] possible height [6] set framerate [7] possible framerate
 */
function getStreamInformation(stream, printOut = false) {

    // Test for issues
    if (!(stream instanceof MediaStream)) {
        console.error("getStreamInformation(): Invalid stream");
        return null;
    }

    let allResults = [];
    let tracks = stream.getVideoTracks();
    if (tracks.length === 0) {
        console.error("getStreamInformation(): No video tracks in stream");
        return null;
    }

    let supportsGetCapabilities = true;
    if (!(typeof tracks[0].getCapabilities === "function")) {
        console.error("getStreamInformation(): Browser does not support function .getCapabilities");
        supportsGetCapabilities = false;
    }

    // Iterate through tracks
    tracks.forEach(videoTrack => {

        // Get information
        const { deviceId, width: settingWidth, height: settingHeight, frameRate } = videoTrack.getSettings();
        let capabilityWidth, capabilityHeight, capabilityFrameRate;
        if (supportsGetCapabilities) {({ width: capabilityWidth, height: capabilityHeight, frameRate: capabilityFrameRate } = videoTrack.getCapabilities());}

        //             0                       1                  2             3                    4              5                     6          7
        let results = [shorten(videoTrack.id), shorten(deviceId), settingWidth, capabilityWidth.max, settingHeight, capabilityHeight.max, frameRate, capabilityFrameRate.max];
        // TODO: Limit decimals Number(value.toFixed(2))

        // Print
        if (printOut) {
            print(" ");

            // Basic
            print("getStreamInformation(): Track info: ");
            print("... Track is: " + results[0] + " from device ID: " + results[1]);

            // Visualize stream quality
            let scoreUsing = results[2] * results[4];
            let scoreCapable = results[3] * results[5];
            let scoreUsingMarks = '+'.repeat(Math.min(Math.floor(scoreUsing / 76800), 35));         // One score mark per 76800 (matches 320x240)
            let scoreCapableMarks = '+'.repeat(Math.min(Math.floor(scoreCapable / 76800), 35));
            scoreUsingMarks = scoreUsingMarks.padEnd(35, ' ');
            scoreCapableMarks = scoreCapableMarks.padEnd(35, ' ');
            print("... Current [ " + scoreUsingMarks   + " ]");
            print("... Capable [ " + scoreCapableMarks + " ]");

            // More
            print("... Track is set to use: " + results[2] + " x " + results[4] + " at " + results[6] + " fps");
            print("... Track is capable of: " + results[3] + " x " + results[5] + " at " + results[7] + " fps");

            // Full formatted output (long)
            // print("getStreamInformation(): Settings: " + JSON.stringify(videoTrack.getSettings(), null, 2));
            // print("getStreamInformation(): Capabilities: " + JSON.stringify(videoTrack.getCapabilities(), null, 2));

            print(" ");
        }

        allResults.push(results);
    });

    return allResults;
}


// UI functions

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
 * @param fullScreenButton Button for fullscreen mode
 */
function switchToFullscreen(fullScreenIcon, fullScreenButton) {

    if(!document.fullscreenElement) {                                   // True if fullscreen not active
        document.documentElement.requestFullscreen().then(() => {
            print("switchToFullscreen(): Fullscreen mode activated");
            fullScreenButton.setAttribute("data-locale-key", "fullscreenExit");
            fullScreenIcon.src = "./images/fullscreenClose.png";
            translateElement(fullScreenButton);
        }).catch(error => {
            alert(`Error attempting to switch to fullscreen mode: ${error.message}`);
        });
    } else {
        document.exitFullscreen().then(() => {                      // Exit full screen mode, if it's already active
            print("switchToFullscreen(): Full screen mode closed");
            fullScreenButton.setAttribute("data-locale-key", "fullscreen");
            fullScreenIcon.src = "./images/fullscreen.png";
            translateElement(fullScreenButton);
        }).catch(error => {
            console.error(`switchToFullscreen(): Error attempting to exit full screen mode: ${error.message}`);
        });
    }
}


/**
 * Creates a box with text or HTML from a file.
 * Can be used for showing terms, notices, tutorials and various content.
 * Assumes file path ./locales/
 * @param {string} file File to load text from
 * @param modal Should the prompt be modal
 * @param clickOut Should modal prompt exit when overlay is clicked
 */
async function showContentBox(file, modal = false, clickOut = true) {
    print("showContentBox(): Showing content from file: " + file);

    // Load text from file

    let title;
    let contentToShow;

    try {
        const text = await fetchJSON(file);
        title = text.title;
        contentToShow = text.text;
        print("showContentBox(): Found text: " + file + " with title: " + text.title);
    } catch (e) {
        console.warn("showContentBox(): Did not find text: " + file + " : " + e);
    }

    const modalOverlay = document.createElement("div");      // Create container element

    if (modal) {                                                     // Create modal overlay if requested
        modalOverlay.classList.add("modalOverlay");                  // Set basic CSS class for styling
        document.body.appendChild(modalOverlay);                     // Append
        showElement(modalOverlay);
        if (clickOut) {
            modalOverlay.addEventListener('click', removeModalPrompt);
        }
    }

    const customPromptStyle = {                         // Style overrides for prompt
        position: "fixed",
        top: "50%",                                     // Centering
        left: "50%",                                    // Centering
        transform: "translate(-50%, -50%)",             // Centering
        aspectRatio: "16 / 9",                          // Sizing
        bottom: "unset",                                // Remove default value that conflicts with purpose
        display: "flex",
        flexDirection: "column",
        zIndex: "1050",
    };

    const prompt = customPrompt(title, contentToShow, [
        ["Close", () => { removeModalPrompt() }]
    ], "50%", "500px", customPromptStyle);        // Apply custom definitions

    // Nested functions for options

    function removeModalPrompt() {
        removeElement(modalOverlay);
        removeElement(prompt);                                  // Remove prompt when not dismissed
    }

}

/**
 * Creates a prompt with text and buttons.
 * Executes actions based on button press.
 * Every button will dismiss prompt.
 *
 * @param title Title text for prompt
 * @param text Body text for prompt (can contain HTML)
 * @param options Array with text and code to run for buttons
 * @param positionX Position of prompt (string value for property style.left)
 * @param width Size of prompt
 * @param containerCSSOverrides Object with custom CSS style declarations, will override existing ones
 */
function customPrompt(title= "Title", text = "Text", options = [["Dismiss", () => {  }]], positionX = "-50%", width = null, containerCSSOverrides = null) {

    // Examples of use:

    // customPrompt("Title", "Text or HTML for body",                                                               [
    //     [   "Button"                , () => { console.log("Button pressed")                                  }   ],
    //     [   "Dismiss"               , () => {                                                                }   ]
    // ], "50%");

    // customPrompt("Title of test prompt", "String or a variable containing string, string can contain HTML code", [
    //     [   "Option 1"              , () => { function_name1()                                               }   ],
    //     [   "Option 2"              , () => { function_name2();                                              }   ],
    //     [   "Option 3 "             , () => { function_name2(); function_name3();                            }   ],
    //     [   "Text for button"       , () => { console.log("functions and code blocks supported")             }   ],
    //     [   "Text for button"       , () => { console.log("any command can be run here")                     }   ],
    //     [   "Text for button"       , () => { console.log("for complex actions, use nested functions")       }   ],
    //     [   "Dismiss"               , () => { let info = "all buttons will always dismiss prompt"            }   ]
    // ], "50%");

    // Buttons also support optional custom colors (note that only rgba colors with reduced transparency get hover effects)
    // Custom width (in px) and x-axis positioning (distance from left edge in % or px) are supported
    // For special uses, CSS style overrides can be passed as an object argument.
    // customPrompt("Title", "Text or HTML",                                                                          [
    //     [   "Green button"        , () => { console.log("Green button pressed")         }  , "Green"               ],
    //     [   "Blue button"         , () => { console.log("Blue button pressed")          }  , "#0067FFBC"           ],
    //     [   "Red button"          , () => { console.log("Red button pressed")           }  , "rgba(255,0,0,0.74)"  ]
    // ], "70%", "100px");

    // Create prompt container
    const prompt = document.createElement('div');                 // Create element
    prompt.id = String(Date.now());                                       // Assign a (pseudo) unique id

    // CSS block for prompt container
    {
        // Styling
        prompt.className = 'prompt';                                      // Set basic CSS class

        // Positioning
        // prompt.style.position = 'fixed';                                  // Mobility
        // prompt.style.left = positionX;                                    // Position

        // Sizing
        // if (width != null) prompt.style.width = width;                    // Sizing

        // Initial state for animation
        // prompt.style.opacity = '0';
        // prompt.style.bottom = `0px`;
        // prompt.style.transition = 'bottom 0.3s ease-out, opacity 0.3s ease-out';
    }

    // Potential CSS overrides
    if (containerCSSOverrides != null) {
        print("customPrompt(): Applying CSS overrides to prompt");
        Object.assign(prompt.style, containerCSSOverrides);                // Assigns CSS key-value pairs to element from argument for custom styles
    }

    // Create title text
    const textTitleElement = document.createElement('div');
    textTitleElement.style.height = "80px";
    const textTitle = document.createTextNode(title);

    // Styling
    textTitleElement.className = 'promptTitle';                           // Set basic CSS class

    // Append
    textTitleElement.appendChild(textTitle);
    prompt.appendChild(textTitleElement);

    // Create body text
    const textBody = document.createElement('div');

    // Handle potential custom HTML text
    if (/</.test(text) && />/.test(text)) {                              // Test for signs of HTML tags
        print("customPrompt(): Prompt text identified as HTML");
        textBody.innerHTML = text;                                       // HTML text to innerHTML of div
    } else {
        print("customPrompt(): Prompt text identified as plain string");
        textBody.textContent = text;                                     // Plain string text to text content of div
    }
    // TODO: Check input is valid (opened tags are closed or at least <> counts match), malformed can be fine and won't throw errors but should be noticed

    // Styling
    textBody.className = 'promptText';                                   // Set basic CSS class

    // Append
    prompt.appendChild(textBody);

    // Create button container
    const optionContainer = document.createElement('div');
    optionContainer.style.height = "80px";

    // Styling
    optionContainer.className = 'promptOptionContainer';                  // Set basic CSS class

    // Create buttons
    options.forEach((optionButton) => {
        // Create button
        const button = document.createElement('button');
        button.textContent = `${optionButton[0]}`;                        // Get text for button

        // Styling
        button.className = 'promptOption';                                // Set basic CSS class

        // Potential custom CSS class for button
        if (optionButton[2] != null) {
            button.classList.add(optionButton[2])
        }

        // Potential custom color
        // if (optionButton[2] != null) {                                    // Get potential color for button
        //     // print("customPrompt(): Custom color " + optionButton[2] + " requested for button: " + optionButton[0]);
        //     // Set base color
        //     button.style.backgroundColor = optionButton[2];               // Overrides CSS background color (including hover)
        //     // Custom hover
        //     let customHoverColor = optionButton[2];
        //     if (customHoverColor.startsWith('rgba')) {
        //         // print("customPrompt(): Color is rgba, hover enabled");
        //         // Change color alpha for hover color
        //         customHoverColor = customHoverColor.replace(/,\s*(\d\.\d*)\)$/, ", 0.8)");
        //         // Regex ,\s*(\d\.\d*)\)$ matches for example ,0.50) ,0.5) ,0.), decimal number is grouped (but group not used by replace)
        //         // print("customPrompt(): Hover color: " + customHoverColor);
        //     }
        //     button.addEventListener("mouseenter", () => button.style.backgroundColor = customHoverColor);
        //     button.addEventListener("mouseleave", () => button.style.backgroundColor = optionButton[2]);
        // }

        // Attach action listener
        button.addEventListener('click', () => {
            dismiss();                                                    // Buttons always dismiss prompt
            optionButton[1]();                                            // Run function or code block
        });

        // Append
        optionContainer.appendChild(button);
    });

    // Append
    prompt.appendChild(optionContainer);

    print("customPrompt(): Creating prompt " + prompt.id + " : " + title);
    document.body.appendChild(prompt);

    // Dismiss prompt after timeout
    // const timeout = 1000;
    // if (timeout >= 0) {
    //     setTimeout(() => {
    //         dismiss();
    //     }, 1000);}
    // }

    // TODO: Replace animations with show and hide, extend show and hide arguments or use CSS classes
    // Animation: fade in
    // requestAnimationFrame(() => {
    //     prompt.style.bottom = `${document.getElementById('controlBar').offsetHeight + 10}px`;               // Position after animation, above control bar
    //     prompt.style.opacity = '1';
    // });

    // Nested function to dismiss prompt
    function dismiss() {
        print("customPrompt(): Dismissing prompt " + prompt.id);
        hideElement(prompt, true)       // Animated hide, then remove

        // Animation: fade out
        // prompt.style.transition = 'bottom 0.3s ease-in, opacity 0.3s ease-in';
        // prompt.style.bottom = '-100px';
        // prompt.style.opacity = '0';
        // setTimeout(() => {
        //     prompt.style.display = 'none';
        //     prompt.remove();
        // }, 300);

    }

    return prompt;

}

/**
 * Moves an element to view if it is outside the viewport
 *
 */
async function moveElementToView(element) {
    const {x: elementX, y: elementY} = getElementCenter(element);                                             // Get center of element
    const { top: topEdge, right: rightEdge, bottom: bottomEdge, left: leftEdge } = getViewportEdges();      // Get viewport edges

    if (elementX < leftEdge || elementX > rightEdge || elementY > bottomEdge || elementY < topEdge) {           // Check if element is outside viewport (crude)
        console.warn("moveElementToView(): Element " + element.id + " outside viewport, x = " + elementX + " y = " + elementY + ", moving to view");
        element.classList.toggle("animate_move");

        // TODO: Add value for clearance from edges

        if (elementX < leftEdge) {
            // Element is to the left of viewport
            element.style.left = "0";
        }
        if (elementX > rightEdge) {
            // Element is to the right of viewport
            element.style.left = "100vw";
        }
        if (elementY > bottomEdge) {
            // Element is below viewport edge
            element.style.top = `${80}vh`;                     // TODO: Ideally would calculate a position on the top edge of bottom bar
        }
        if (elementY < topEdge) {
            // Element is above viewport edge
            element.style.top = "0";
        }

        setTimeout(() => {                              // Animate movement
            element.classList.toggle('animate_move');
        }, 1000);

        return true;
    }
    return false;

}


// Feature functions

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
    const stream = videoElement.srcObject;                                                          // Get current video stream

    if (!isFreeze) {                                                                                // If video is not frozen, freeze it
        if (stream) {
            canvasDrawCurrentFrame();                                                               // Draw frame to canvas overlay, avoiding black feed
            releaseVideoStream();                                                                   // Stop video TODO: Consider softer freeze with faster recovery, without relying on videoStart()
        }
        freezeIcon.src = "./images/showVideo.png";                                                  // Change icon image
        freezeIcon.title = "Show video";                                                            // Change tool tip text
        freezeIcon.setAttribute("data-locale-key", "play");
        translateElement(freezeIcon);
        isFreeze = true;                                                                            // Freeze is on
    } else {
        videoStart();
        videoElement.style.display = 'block';
        canvasElement.style.display = 'none';
        freezeIcon.src = "./images/freeze.png";
        freezeIcon.title = "Freeze";
        freezeIcon.setAttribute("data-locale-key", "freeze");
        translateElement(freezeIcon);
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
    elementSub.width = elementMaster.videoWidth;                  // DEV: Note that element.width refers to CSS width, videoWidth to feed width, may not work with two canvas elements for example, consider using calculated properties
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
 */
function removeElement(element) {
    hideElement(element, true)
    print("removeElement(): Remove issued for element: " + element.id);
}

/**
 * Hides an element.
 * Can be used to remove elements.
 * @param element Element to hide
 * @param removeAfter True if element should be deleted after hiding
 */
function hideElement(element, removeAfter = false) {
    element.setAttribute("data-return-display-state", window.getComputedStyle(element).display); // Store initial display state
    element.classList.add("hidden");                                                                         // Apply CSS class to hide element

    element.addEventListener("transitionend", function hideAfterTransition() {                               // Change display state after animation
        element.style.display = "none";                                                                      // Required as hidden class only applies 0 opacity (display to none cannot be animated) TODO: FIX: GLITCHES BUTTONS, GETS STUCK
        element.removeEventListener("transitionend", hideAfterTransition);
    });

    if (removeAfter) {
        setTimeout(() => {
            print("hideElement(): Removing element");
            element.remove();
        }, 100); // TODO: Arbitrary delay, only reliable found way to animate before deletion
    }

}

/**
 * Shows a hidden element.
 * @param element Element to hide
 * @param display Display state to set (use for newly created elements)
 */
function showElement(element, display = null) {
    let displayState; // TODO: No more needed?
    if (display != null) {                      // If element has been given a specific display state to use
        displayState = display
    } else {                                    // If element was hidden using hideElement()
        displayState = element.getAttribute("data-return-display-state");
        element.removeAttribute("data-return-display-state");
    } // TODO: If neither applies, just remove the hidden class without fail
    element.style.display = displayState;       // Set display state
    // TODO: Dev: replace block with ternary

    element.classList.remove("hidden");                                      // Remove applied CSS class to show element

    // DEV: Animation not rendering debug attempts:

    // requestAnimationFrame(() => {                                // Runs code after display is rendered, display property may take a while
    //     element.style.opacity = '1';
    // });

    // DEV: Testing alternative
    // setTimeout(() => {
    //     element.style.opacity = '1';
    // }, 10);

    // element.style.display = displayStyle;    // Where value default is "block"
    // element.style.transition = `opacity ${fadeTime}s ease-in-out`;
    //

}

/**
 * Gets the center coordinates of an HTML element.
 *
 * @param {HTMLElement} element HTML element
 * @returns {{x: number, y: number}} Object with x, y coordinates
 */
function getElementCenter(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + window.scrollX + rect.width / 2;  // Rounding with Math.round() should not be necessary
    const y = rect.top + window.scrollY + rect.height / 2;  // TODO: Reconsider scroll values

    return { x, y };                                        // Example use to create two variables: let {x: centerX, y: centerY} = getElementCenter(element);
}

/**
 * Gets the computed dimensions of an HTML element.
 *
 * @param {HTMLElement} element HTML element
 * @returns {{width: number, height: number}}
 */
function getElementDimensions(element) {
    const width = parseFloat(getComputedStyle(element).width);
    const height = parseFloat(getComputedStyle(element).height);
    return { width, height };
}

/**
 * Gets the dimensions of an HTML element's bounding rectangle.
 *
 * @param {HTMLElement} element HTML element
 * @returns {{width: number, height: number}}
 */
function getElementBoundingDimensions(element) {
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    return { width, height }; // Example use: let { width: elementWidth, height: elementHeight } = getElementBoundingDimensions(element);

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

    /*
    Coordinate system has inverted y axis:
                   y-
                    |
                    |
                    |
       x-   - - - - | - - - - -   x+
                    |  PAGE
                    |
                    |
                    y+
    */
}


// Simple caller methods

/**
 * Adds new overlay.
 */
function addOverlay() {
    createdElements.createOverlay();
}

/**
 * Adds new text area.
 */
function addText() {
    createdElements.createTextArea();
}


// Classes for created elements

/**
 * Class for managing created elements.
 */
class CreatedElements {

    // Generic
    elements = [];                                  // Contains information on all created elements: [[classReference, "type", "id"]]

    // Other
    activeTextArea;
    activeTextAreaObject;                           // TODO: Could replace with a find-function call


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
    createMenu(menuDefinitions, callerElement) {
        const classReference = new Menu(menuDefinitions, callerElement);
        this.elements.push([classReference, classReference.getType(), classReference.getElementId()]);
        print("createMenu(): Created and registered " + classReference.getType() + " : " + classReference.getElementId());
        return classReference;
    }


    // Setters

    setActiveTextArea(element, object) {
        this.activeTextArea = element;
        this.activeTextAreaObject = object;
    }


    // Getters

    getActiveTextArea() {
        return this.activeTextArea;
    }


    // Functionality

    changeFontSize(size) {
        this.activeTextAreaObject.changeFontSize(size);
    }

}

/**
 * Class for a dynamically created element.
 */
class CreatedElement {

}

/**
 * Parent class for dynamically created movable elements.
 * This class should not be directly instantiated (use inheritors instead).
 */
class MovableElement {

    // Generic
    type;                                           // For fast identification of inheritor instance type
    id;

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
        this.id = String(Date.now());
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
     * @param type Element type to add (HTML tagName)
     * @param className Class name for element (should correspond with a CSS class)
     * @param id Unique identifier for added element
     * @param elementStyle CSS style object for added element
     * @param removeButtonStyle CSS style object for remove button
     */
    createElement(type, className, id, elementStyle = {}, removeButtonStyle = {}) {

        // Create main element
        let newElement = document.createElement(type);
        newElement.id = this.id;
        newElement.className = className;                          // Assign basic class name to apply CSS styles
        Object.assign(newElement.style, elementStyle);
        newElement.style.opacity = "0";
        print("createElement(): Added " + newElement.className + " element: " + newElement.id);

        // Create remove button
        let removeButton = document.createElement('button');
        removeButton.className = className + "RemoveButton";      // Assign basic class name to apply CSS styles
        removeButton.id = id + "RemoveButton";                    // Forms id for remove button
        removeButton.title = "Remove";
        removeButton.setAttribute("data-locale-key", "remove");   // Assign translation key
        removeButton.textContent = "X";
        Object.assign(removeButton.style, removeButtonStyle);     // TODO: Only assign if anything defined (set default to null and add conditional for != null)
        removeButton.addEventListener('click', () => removeElement(newElement));
        print("createElement(): Added " + removeButton.className + " for: " + newElement.id);

        // Remove button only visible when hovered over
        newElement.addEventListener('mouseover', () => (          // TODO: Make sure fastest CSS animations apply
            removeButton.style.display = "block"
        ));
        newElement.addEventListener('mouseout', () => (
            removeButton.style.display = "none"
        ));

        // Add element to DOM
        newElement.appendChild(removeButton);
        translateElement(removeButton);
        // element.after(newElement);                              // DEV: Causes incorrect stacking for elements with equal z-index, due to inverted order in DOM
        videoContainer.appendChild(newElement);
        newElement.style.opacity = "1";                           // TODO: Apply fade to creation

        return newElement;
    }

}

/**
 * Class for dynamically created overlay elements.
 */
class Overlay extends MovableElement {

    // Class shared variables (TODO: Deprecate)
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
        this.element = super.createElement("div", "createdOverlay", this.id);

        // Add listeners
        this.handleListeners();
    }

    /**
     * Adds listener for drag of overlay.
     */
    handleListeners() {
        // Add listener for drag
        print("handleListeners(): Adding drag listener for overlay: " +  this.id);
        let overlay = document.getElementById(this.id);                              // TODO: Remove extra gets, use reference in variable
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

        // overlay.style.zIndex = "499"                                                       // Get on top
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

        // overlay.style.zIndex = "400";                                                       // Return z-index
        Overlay.isOverlayDragging = false;

        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    }

}

/**
 * Class for dynamically created text area elements.
 */
class TextArea extends MovableElement {

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
     * Creates new text area.
     * Draggable, resizable.
     */
    create() {
        // Create container
        this.container = super.createElement("div", "createdTextAreaContainer", this.id + "Container");

        // Create main element
        this.element = document.createElement("textarea");
        this.element.className = "createdTextArea";
        this.element.placeholder = "Text";
        this.element.setAttribute("data-locale-key", "text"); // Assign translation key
        this.element.id = this.id;
        this.element.spellcheck = false;                                                                                               // Try to prevent spell checks by browsers
        this.container.appendChild(this.element);
        createdElements.setActiveTextArea(this.element, this);                                                                               // TODO: Replace global variable use ; Makes font size buttons target latest created text area (overrides last clicked)

        // Apply translation
        translateElement(this.element);

        // Add resize handle
        this.resizeHandle = document.createElement("div");                                                                     // Option to resize the textArea box
        this.resizeHandle.className = "createdTextAreaResizeHandle";
        this.resizeHandle.id = this.id + "ResizeHandle";
        this.container.appendChild(this.resizeHandle);

        // Add resize listeners
        this.handleListeners();

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

        createdElements.setActiveTextArea(this.element, this);                         // TODO: Replace global variable use, climb instance ladder or ask super class etc.

        // this.container.style.zIndex = "399";                                           // Get on top

        if (e.target === this.element) {                                               // Check is the mouse click event is on the text area
            this.isMoving = true;
            this.offsetXText = e.clientX - this.container.offsetLeft;
            this.offsetYText = e.clientY - this.container.offsetTop;
            this.container.style.cursor = "move";
        } else {                                                                       // Mouse click was (likely) on resize handle: this.resizeHandle
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
    changeFontSize(size) {

        const element = createdElements.getActiveTextArea();                                   // TODO: Replace global variable use

        // Load computed font size to element property
        element.style.fontSize = window.getComputedStyle(element).fontSize                     // Initial font size set in CSS will not be set in the inline font size automatically

        print("changeFontSize(): Called font size " + element.style.fontSize + " = " + window.getComputedStyle(element).fontSize + " change by " + size + " for: " + element.id);

        let fontSize = parseFloat(element.style.fontSize);                                     // Get font size
        fontSize += size;                                                                                      // Make font size bigger or smaller
        element.style.fontSize = fontSize + "px";                                              // Change active text area's font size

    }

}

/**
 * Class for creating a menu programmatically.
 * Used for multiple or custom menus.
 */
class Menu extends MovableElement {

    // Generic
    menuDefinitions;                    // Contains definitions for the menu contents in an array

    // Examples
    // const buttonTest = Menu.createButton("settings.png", "buttonTest", "iconTest", "Test button", menuContainerTop);
    // const menuTest = [
    //     {id: "buttonRotateTest",     text: "Rotate",    img: "rotate.png",        action: videoRotate  },
    //     {id: "buttonFlipTest",       text: "Flip",      img: "flip.png",          action: videoFlip    },
    //     {id: "buttonFreezeTest" ,    text: "Freeze",    img: "freeze.png",        action: videoFreeze,  iconToggle: "showVideo.png"}, // TODO: Unfinished function for toggled icons
    //     {id: "buttonSaveImageTest",  text: "Save img",  img: "downloadImage.png", action: saveImage    },
    //     {id: "buttonOverlayTest",    text: "Overlay",   img: "overlay.png",       action: addOverlay   },
    //     {id: "buttonAddTextTest",    text: "Add text",  img: "text.png",          action: addText      }
    // ]
    // createdElements.createMenu(menuTest, buttonTest, "leftToRight");
    //
    // const menuTest = [
    //     {id: "languageSelector" ,    text: "Language"  , customHTML: selectLanguageContainer}, // Where customHTML refers to a variable referring to an HTML element
    //     {id: "themeSwitch"      ,    text: "Theme"     , customHTML: switchThemeContainer}     // All functionality (if any) for such custom elements must be created manually
    // ]
    //
    // Note that some functions need to be called through an anonymous function: action: () => { yourFunction(); }

    // Caller relations
    callerElement;                      // Element the menu is called from, e.g. a button

    // Positioning
    position = {x: null, y: null};      // Last set position for the menu
    relativeDirection = "leftToRight";

    // Initialization

    /**
     * Instantiates class.
     * Relies on parent class.
     */
    constructor(menuDefinitions, callerElement) {
        super('menu');

        this.menuDefinitions = menuDefinitions;
        this.callerElement = callerElement;

        this.create();
    }

    create() {

        // Create core container element
        this.element = document.createElement('div');
        this.element.id = this.id = String(Date.now());         // Assign a (pseudo) unique id

        // Styling
        this.element.classList.add("createdMenu");
        this.element.classList.add('hidden');                   // Initial state
        this.visible = false;

        // Create controls
        this.menuDefinitions.forEach( (control) => {           // Parse definitions
            if (!control.customHTML) {                         // No custom HTML (falsy parameter value)
                // noinspection JSUnresolvedReference          // Object is dynamic
                const button = createButton(control.id, control.text, control.img);
                button.addEventListener('click', control.action);
                this.element.appendChild(button);
            } else {                                           // Custom HTML
                const div = document.createElement("div");     // Contain custom menu element
                div.appendChild(control.customHTML);
                this.element.appendChild(div);
            }
        });

        // Positioning
        this.updatePosition(); // DEV: Using resize listener for this update is possible but excessive

        // Append
        document.getElementById('videoContainer').appendChild(this.element);

        // Attach listener for clicks on button
        this.callerElement.addEventListener('click', () => this.toggleVisibility() );

        // Attach listener for clicks outside menu
        document.addEventListener("click", (e) => this.handleClickOutside(e), true);

        // Nested functions
        function createButton(id, text, img) {
            // Create element
            const button = document.createElement("button");
            button.id = id;
            button.title = text;

            // Add icon
            const icon = document.createElement("img");
            icon.src = "./images/" + img;
            icon.alt = text;
            icon.classList.add("icon");
            button.appendChild(icon);

            return button; // TODO: Use static method below?
        }

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
    toggleVisibility(hide = false) {
        print("Menu: toggleVisibility(): Toggling: " + this.id + " from " + this.visible + ", override to hide: " + hide);
        if (hide || this.visible) {
            hideElement(this.element);
            this.visible = false;
        } else {
            this.updatePosition();
            showElement(this.element);
            this.visible = true;
        }

    }

    /**
     * Position menu based on caller element
     */
    updatePosition() {

        // Get position of caller element
        const buttonPosition = getElementCenter(this.callerElement);
        const buttonDimensions = getElementDimensions(this.callerElement);

        // Set position for menu ("leftToRight", to the right of caller element)
        const offsetX = buttonDimensions.width/2 + 1;                                  // Center + half of width + 1 px margin (in 2025 "twoday" design)
        const offsetY = buttonDimensions.height/2;
        this.element.style.left = this.position.x = `${buttonPosition.x + offsetX}px`; // Addition: offset to the right of button position
        this.element.style.top = this.position.y = `${buttonPosition.y - offsetY}px`;  // Subtraction: offset upwards from button position
        // TODO: Currently only handles 48px menu height, calculate y.
    }

    handleClickOutside(e) {
        if (!this.visible) {
            // Click detected but the menu related this instance's event listener is not visible, no action
            return;
        }

        if ( !e.target.closest(".createdMenu") && !e.target.closest(`#${this.callerElement.id}`) ) {
            // Click detected and the target was not any menu NOR the caller button for this instance's menu, hiding this menu
            // Note that visibility toggle from pressing menu button is handled by a separate listener, this arrangement prevents multiple menus from being opened simultaneously
            this.toggleVisibility(true);
        }
    }


    // Related

    /**
     * Creates, appends and returns a button.
     * This method should be used to create caller buttons for menus.
     *
     * @param img Image for icon
     * @param buttonId Id for button element
     * @param iconId Id for icon element (useful for icon dynamics)
     * @param text Text for title and alt text
     * @param appendTo Element to append button to
     * @returns {HTMLButtonElement} HTML element for button
     */
    static createButton(img, buttonId, iconId, text, appendTo) {
        const button = document.createElement("button");

        button.id = buttonId;
        button.title = text;

        // Add icon
        const icon = document.createElement("img");
        icon.src = "./images/" + img;
        icon.id = iconId;
        icon.alt = text;
        icon.classList.add("icon");
        button.appendChild(icon);

        if (appendTo) {                          // Check for truthy parameter value
            button.classList.add("hidden");
            appendTo.appendChild(button);
            icon.onload = () => {
                // button.classList.remove("hidden");
                showElement(button);
            };
            icon.onerror = (e) => {
                console.error("createButton(): Icon load failed: " + img + " : " + e?.message);
                // button.classList.remove("hidden");
                showElement(button);
            };
        }

        return button;
    }

}


// Developer functions (safe to delete)

let debugModeVisual = false;                                                                  // Enables visual debug tools
if (debugMode || (new URLSearchParams(window.location.search).has("debug"))) {debugMode = true; debug();} else {
    console.log("To activate debug mode, append parameter ' debug ' to URL (using ?/&) or type to console: ' debug() '");
}

/**
 * Function to enable debug mode.
 */
function debug() {
    debugMode = true;
    if (debugMode) {
        print("Debug mode is enabled!");
        print("Happy developing ✨");
    }

    // Get container element for menu button
    const menuContainerMiddle           = document.getElementById('controlBarMiddleContainer');

    // Create menu button
    const buttonDeveloper = Menu.createButton("developer.png", "buttonDeveloper", "iconDeveloper", "Developer Options", menuContainerMiddle);

    // Define menu options
    let menuDeveloper = [
        {id: "buttonVisualDebug",         text: "Toggle visual debug",       img: "inspect.png", action: debugVisual},
        {id: "buttonUpdateInputs",        text: "Update video inputs",       img: "restart.png", action: backgroundUpdateInputList},
        {id: "buttonReleaseStream",       text: "Release video stream",      img: "delete.png", action: () => { releaseVideoStream(); }},
        {id: "buttonStartVideo",          text: "Start video (reset)",       img: "showVideo.png", action: videoStart},
        {id: "buttonFallbackRes",         text: "Fallback resolution test",  img: "test.png", action: () => { getMaxResolutionFallback(); }},
        {id: "buttonDumpStorage",         text: "Dump local storage",        img: "list.png", action: dumpLocalStorage},
        {id: "buttonClearStorage",        text: "Clear local storage",       img: "clean.png", action: () => { localStorage.clear(); }},
    ]; // TODO: Buttons needs text support

    // Create menu
    new CreatedElements().createMenu(menuDeveloper, buttonDeveloper, "leftToRight");

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
        [   "Fallback resolution test"         , () => { getMaxResolutionFallback();                                     }],
        [   "Dump local storage"               , () => { dumpLocalStorage();                  } , "rgba(172,139,255,0.5)"],
        [   "Clear local storage"              , () => { localStorage.clear();                } , "rgba(255,139,139,0.5)"],
        // ADD NEW ROW ABOVE THIS ROW FOR EACH NEW BUTTON, USE TEMPLATE
        // Template:
    //  [   "Text for button"                  , () => { function_or_code_block();                                      }],
        [   "Dismiss"                          , () => {                                                                }]   // Preserve as final line
    ], "585px", "180px");

    // TODO: Create using Menu instead of prompt, use buttons with icons, add text support for buttons
    // const button = Menu.createButton("cameraSettings.png", "devCameraSettings", "cameraSettingsIcon", "Camera Quality Settings", document.getElementById('menuContainerTop'))


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
 * Outputs strings to console if debug is enabled.
 * Used in development.
 * @param string String to output
 * @param color Text color string (optional)
 * @param tracePrint True to include short stack trace (optional)
 */
function print(string, color = "gray", tracePrint = false) {
    if (!debugMode) return;

    let output;

    // Format if string starts with function identifier "():"
    const index = string.indexOf("():");
    if (index === -1 || index > 26) {
        output = string;
    } else {
        const prefix = string.slice(0, index + 3).padEnd(30, " ");
        output = prefix + string.slice(index + 3);
    }

    // Colorize output
    let css;
    switch(color) {     // Ensure valid color
        case "gray":    css = "color: gray";    break;
        case "red":     css = "color: red";     break;
        case "green":   css = "color: green";   break;
        case "blue":    css = "color: blue";    break;
        case "white":   css = "color: white";   break;
        case "black":   css = "color: black";   break;
        case "yellow":  css = "color: yellow";  break;
        case "orange":  css = "color: orange";  break;
        default:        css = "color: gray";    break;
    }
    console.log("%c" + output, css);

    if (tracePrint) {
        const stack = new Error().stack.split('\n');

        console.warn("print(): Trace: print <--- " + structureStackPrint(stack[1]) + " <--- " + structureStackPrint(stack[2]) + " <--- " + structureStackPrint(stack[3]));

        function structureStackPrint(input) {
            output = input.trim();
            let isAsync = " ";
            if (output.startsWith("async*")) {
                isAsync = " (async)";
                output = output.slice(6);
            }
            const [functionNameRaw, location] = output.split("@"); // Destructure to array
            let lineNumber = -1;
            let functionName = "?";
            if (location) {
                functionName = functionNameRaw.trim();
                const parts = location.split(":");
                lineNumber = parseInt(parts[parts.length - 2]); // TODO: Does this tolerate address port number or lack of?
            }

            // TODO: Fix: Function name may have "/<" at the end in some circumstances

            return functionName + " (" + lineNumber + ")" + isAsync;
        }
    }

}

/**
 * Shortens a long string.
 * Used for long hex device ids.
 * @param id
 * @returns {string}
 */
function shorten(id) {
    let shortenedId = id.trim();
    shortenedId = shortenedId.replace(/[{}]/g, '');
    shortenedId = `${shortenedId.slice(0, 4)}:${shortenedId.slice(-4)}`;
    return shortenedId;
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
function drawCenterIndicator(element, size, color = 'green', opacity = '1', zindex = '9001') {
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
function drawBall(coordinateX, coordinateY, diameter, color = 'green', opacity = '1', zindex = '9002') {
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
function drawViewPortEdges(size = 30, color = 'OrangeRed', opacity = '1', zindex = '9003') {
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
function drawCrossingLines(element, lineWidth, color = 'red', opacity = '1', zindex = '9004') {

    const canvas = document.createElement('canvas');
    let { width: elementWidth, height: elementHeight } = getElementBoundingDimensions(element);
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
function drawLabel(coordinateX, coordinateY, height, backgroundColor = 'green', opacity = '1', zindex = '9005', text = "text") {
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
 * Temporary container for obsolete island control bar functions.
 * Use while generalizing drag handler.
 */
class IslandControlBar {
    island                = document.getElementById('island_controlBar');                  // Floating island control bar
    isIslandDragging = false                                                               // Dragging island control bar
    islandX;                                                                               // Initial position of the control island
    islandY;

    setupAll() {
        showElement(this.island);
        listenerToElement('island_controlBar', 'mousedown', this.islandDragStart);                                // Draggable island bar

        // Keep control island visible
        setInterval(() => { moveElementToView(this.island) }, 5000); // Periodically ensures control island is visible

        showElement(this.island, 'flex');

    }



    /**
     * Drag floating island control bar with mouse. Add event listeners for mousemove and mouseup events.
     * @param event Mouse event 'mousedown'
     */
    islandDragStart (event) {

        print("islandDragStart(): Island drag initiated" );

        this.isIslandDragging = true;

        // Get current coordinates
        mouseX = event.clientX;
        mouseY = event.clientY;
        this.islandX = parseInt(this.island.style.left, 10) || 0;  // Parses island's position to decimal number. Number is set to 0 if NaN.
        this.islandY = parseInt(this.island.style.top, 10) || 0;

        document.addEventListener('mousemove', this.islandDragUpdater);                          // Note that event object is passed automatically. Arrow function here would cause a major issue with duplicate function instances.
        document.addEventListener('mouseup', this.islandDragStop);

    }

    /**
     * Calculate new position for island control bar. Update island style according new position.
     * @param event Mouse event 'mousemove'
     */
    islandDragUpdater(event) {

        print("islandDragUpdater(): Mass event: Island drag in progress");

        if (this.isIslandDragging) {                                                // This conditional will MASK issues like drag handlers not being removed
            // Calculates new position
            let pos1 = mouseX - event.clientX;
            let pos2 = mouseY - event.clientY;
            mouseX = event.clientX;
            mouseY = event.clientY;

            // Updates the dragged island's position
            this.island.style.top = (this.island.offsetTop - pos2) + "px";
            this.island.style.left = (this.island.offsetLeft - pos1) + "px";
        }
    }

    /**
     * Stop Island dragging when mouse key is lifted. Remove event listeners.
     */
    islandDragStop() {
        this.isIslandDragging = false;
        document.removeEventListener('mousemove', this.islandDragUpdater);
        document.removeEventListener('mouseup', this.islandDragStop);

        moveElementToView(this.island);

        print("islandDragStop(): Island drag stopped");
    }

}