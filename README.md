# Pixel Art Server

This is simple server to supply images to [an optional matching WLED usermod](https://github.com/drewgreenwell/wled-async-pixel-art-client) to display on matrices of different sizes.

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
- The codebase has been migrated and refactored into a TypeScript-first server under `src/` with compiled output in `dist/`.
- A separate Svelte UI project that reimagines the interface and optimizes editing workflows for pixel art lives under `ui/`, making the admin interface easier to iterate on than the original bundled approach.
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

This is a node.js / express server that responds to requests for images from WLED clients, decoding images (jpg, gif, png, etc.) to raw pixel values and sending them to the client as JSON via DDP or a API. It includes an admin interface that allows for uploading/editing images and curating playlists of images, including setting background colours for transparent images. It keeps track of each clients' progress through assigned playlists. It understands multi-frame gif images and uses DDP to stream them efficientlu. **Note:** In Pull mode, the clients' ability to decode multiframe gifs is limited by the memory of the device - an ESP32 is recommended for the extra memory provided.

Images are stored in the `img` directory under the server. A given image's unique ID is its path relative to the `img` dir. You do not have to use the provided upload mechanism to add images, you can instead just place images in the directory in question an restart the server, to trigger a rescan of the contents.

Clients make only 2 calls to the server:

- On boot, clients attempt a connection to `/checkin`, passing the `id` stored in their firmware. This registers a new client or updates an existing client's IP Address. This process allows the client to be configured in the administration interface. _Note:_ Clients can also be added directly in the admin interface for server only streaming mode.
  example: `http://192.168.0.xx/checkin?id=my-grid-id`

- after this, the client repeatedly calls the `/image` endpoint to request images for display, including its `id` to identify which playlist to load the next image from. It also supplies a width and height, to indicate to the server the data required.

The timing of these calls (ie the display time per image) is determined by the client configuration or metadata returned from the server (an attribute of the playlist).  
 example: `http://192.168.0.xx/image?id=my-grid-id&width=32&height=32`

## Setup

- Prep
  - Images are saved to the ./img folder by default. You can update docker-compose.yaml to point to an existing directory.
- Configure default WLED host/IP (optional)
  - The server reads `WLED_HOST` and `WLED_PORT` from environment variables.
  - Copy `.env.example` to `.env`, then set your target device IP:

    ```bash
    cp .env.example .env
    # then edit .env
    WLED_HOST=192.168.1.50
    WLED_PORT=4048
    ```

  - If not set, the default host is `127.0.0.1`.
- Run
  - `docker compose up -d`
- Add a client
  - Option 1: Go to http://localhost:8080 and choose Clients -> Add Client.
  - Option 2: If you have the [WLED Async Pixel Art Client User Mod](https://github.com/drewgreenwell/wled-async-pixel-art-client) update the config settings to point to http://<your-ip>:8080
- Play
  - Choose play on the main screen or Select the Effect in the WLED interface to start streaming.

### Why is there a User Mod

The Async Pixel Art Server uses DDP (Distributed Display Protool) to stream content to WLED. This is highly performant. When receiving DDP packets the WLED interface loads a minimal UI and things like playlists and transitions are not available to the user.
The goal for the User Mod is to allow the pixel art server to play more friendly within the WLED interface.

- Push mode will send a trigger message to the server to tell it to start playing for X number of seconds (configurable). When the server stops streaming, the WLED UI resumes as normal.
- In Pull mode, the server will not use DDP at all to interact. The client loads images one by one as a GET request to the server. This mode is limited by the environment it is running on with how many image frames can be loaded at one time.
