# Simple Document Camera

Simple Document Camera (SDC) is an open-source browser-based application for use with document cameras.

Try it out here:
[Simple Document Camera](https://labs.opinsys.fi/sdc/)

SDC features flexible camera switching and no limitations on camera manufacturer or even type! Most USB cameras will work*, including most web cameras and many microscopes, endoscopes, virtual cameras (including OBS) or other specialty cameras. SDC is built to work, be free and respect the user.

SDC is being developed for use by educators and supports overlays for classroom use. Other currently available features include editable text areas, zoom, rotation, flip, freeze, full screen mode and saving images. Work is underway on basic drawing capabilities, more viewport controls (fit, fill, pan) and even a PWA implementation. 

SDC is in active development and open to feature requests and contributions!

*SDC supports [UVC ](https://www.usb.org/document-library/video-class-v15-document-set) cameras and any other video inputs that are exposed to the [MediaDevices](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)-interface.

# Team

Our original developers:  
AvaraFi  
evejussila  
Jonnnuli  
katsusah  

Special thanks to:  
**Opinsys Oy** for their initiative, continued sponsorship and guidance  
**University of Jyväskylä** for connecting us with local industry  
**Twoday Oy** for their expertise in UI/UX design  

# For testers

Use a debug-enabled URL:  
https://labs.opinsys.fi/sdc/?debug=

To bypass all waits use URL with skip flag:  
https://labs.opinsys.fi/sdc/?debug=&skipWait=

To reset app to default state:  

Open developer menu  
<img src="/images/developer.png" width="25" height="25">  

Press first three buttons in order from left to right  
<img src="/images/clean.png" width="25" height="25"><img src="/images/clean.png" width="25" height="25"><img src="/images/restart.png" width="25" height="25">

Info:

Practical use of the app necessitates storing states or settings. This is often done using cookies, but SDC uses the browser's secure local storage instead, with the user's permission. URL parameters are also used. This can complicate testing. 

Testing various prompts requires frequent clearing of the browser's local storage for this application. This is because SDC attempts to decide and remember, which prompts the user should be shown or has already seen. The clearing of local storage and URL parameters has been made easy from the UI, to expedite testing.

To reset the app to its default state, open the developer menu (middle button in the app's toolbar) and press the first three buttons in the menu, from the left to the right. The page will reload after the third button has been pressed.

With the developer mode active, console output is verbose. Developer mode can also be enabled from the console.