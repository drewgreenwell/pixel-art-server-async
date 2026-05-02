# Pixel Art Server
This is simple server to supply images to [a matching WLED usermod](https://github.com/drewgreenwell/wled-async-pixel-art-client) to display on matrices of different sizes.

![screen](/screenshots/screen-large.gif)
![admin interface](/screenshots/admin.png)

## Project status
This project is currently a work in progress to improve and add features to the original project by [hughc](https://github.com/hughc/pixel-art-server). It is in active use and working well but some features are still being planned and developed.

Current progress (May 2026):
- TypeScript server is in place with build/start scripts (`npm run build`, `npm run start`).
- Core image and playlist endpoints are implemented under `src/endpoints`.
- Pixel/image processing utilities are implemented under `src/utils`.
- A Svelte-based UI exists in `ui/` and is actively being iterated.
- Docker-related files are present for containerized deployment (`Dockerfile`, `docker-compose.yaml`).

## Differences from the original project
This fork is focused on running the server as both a playlist/image source and a more direct WLED tooling workflow.

- Direct WLED DDP output support has been added, so images can be pushed straight to a configured WLED device instead of only being served for client polling.
- The server now includes WLED-specific runtime configuration for host, port, LED count, and update interval using environment variables.
- The UI includes WLED-oriented actions such as showing the active image on a WLED target and importing WLED JSON directly into the editor.
- The codebase has been migrated into a TypeScript-first server under `src/` with compiled output in `dist/`.
- A separate Svelte UI project lives under `ui/`, making the admin interface easier to iterate on than the original bundled approach.
- Docker support has been added for easier local deployment and testing.

Repository media policy:
- All images in `img/` are intentionally ignored by default.
- Only `img/sample.gif` is allowed to be included in git for sample/demo use.


## Hardware requirements
The hardware consists of 3 parts:

 - an LED matrix, either off-the-shelf or handmade using LED strips joined together to form a grid (WS2812, WS2815 etc)
 - a wifi enabled microcontroller to run WLED (an ESP32 is recommended)
 - a server, either on your LAN or accessible over the internet. This does not have to be powerful- a Raspberry Pi Zero W will do.

Other optional components include a push button wired to the microcontroller to trigger a configuration portal, and a buck transformer to run the microcontroller if the strip runs at 12V (the ESP8266 runs at 5V).

To generate a clean matrix with square pixels, you need a diffuser screen. [This design](https://www.thingiverse.com/thing:4973163) can be used to 3D print arbitrary sized diffusers. 

## Server
 This is a node.js / express server that responds to requests for images from WLED clients, decoding images (jpg, gif, png) to raw pixel values and sending them to the client as JSON. It includes an admin interface that allows for uploading images and curating playlists of images, including setting background colours for transparent images.  It keeps track of each clients' progress through assigned playlists. It understands multi-frame gif images, but the clients' ability to decode multiframe gifs is limited by the memory of the device - an ESP32 is recommended for the extra memory provided.

 Images are stored in the `img` directory under the server. A given image's unique ID is its path relative to the `img` dir. You do not have to use the provided upload mechanism to add images, you can instead just place images in the directory in question an restart the server, to trigger a rescan of the contents. 

 Clients make only 2 calls to the server:
  -  On boot, they attempt a connection to `/checkin`, passing the `id` stored in their firmware. This registers a new client allowing it to be configured in the administration interface.  
  example: `http://192.168.0.xx/checkin?id=my-grid-id`

  - after this, the client repeatedly calls the `/image` endpoint to request images for display, including its `id` to identify which playlist to load the next image from. It also supplies a width and height, to indicate to the server the data required. 
  
  The timing of these calls (ie the display time per image) is determined by the metadata returned from the server (an attribute of the playlist).  
  example: `http://192.168.0.xx/image?id=my-grid-id&width=16&height=16` 

## setup
 - install [node.js](https://nodejs.org/)
 - install `yarn` with `npm install -g yarn`
 - copy `.env.example` to `.env` and update values for your environment
 - with nodejs installed, run `yarn` from within the server directory to install all dependencies
 - from within the same dir run `node ./server.js` to start the server. Use the `--port xxxx` switch to choose a port to run it on. The admin interface should be available at this url. 
 - if you wish to run the server at system startup, I recommend installing [pm2](https://github.com/Unitech/pm2), the node process manager. You can then add the server process to pm2 with the command `pm2 start server.js -- --port xxxx"` and `pm2 save` to save the config. YOu then just need pm2 to [run on startup](https://pm2.keymetrics.io/docs/usage/startup/)

