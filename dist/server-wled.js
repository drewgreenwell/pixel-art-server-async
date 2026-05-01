import { WLEDDdp } from './utils/wled_ddp.js';
import { getImageData } from './utils/get_image_data.js';
import { PixelImagePlayer } from './utils/pixel_image_player.js';
/**
 * Main application class for controlling LED animations
 */
export class LedAnimationApp {
    socket;
    offset = 0;
    lastPush = null;
    intervalId;
    timeoutId;
    config;
    currentImage = null;
    pixelPlayer;
    started = false;
    /**
     * Creates a new LED animation application
     * @param config - Application configuration
     */
    constructor(config) {
        this.config = config;
        this.pixelPlayer = new PixelImagePlayer(config.client, 10000);
        // Initialize WLED connection
        const options = {
            host: config.host,
            port: config.port,
            ledCount: config.client.pixels,
        };
        // eslint-disable-next-line no-console
        console.log('Initializing with config:', config);
        this.socket = new WLEDDdp(options);
    }
    /**
     * Animation update function called on each interval
     */
    update() {
        let leds = [];
        // make sure pixel data has changed, no need to waste bandwidth
        if (this.lastPush != null && this.lastPush > this.pixelPlayer.lastDraw) {
            this.socket.sendEmpty();
            return;
        }
        if (this.pixelPlayer.image) {
            leds = this.pixelPlayer.currentPixels;
        }
        else {
            for (let i = 0; i < 1024; i++) {
                leds.push([this.getRandomInt(0, 256), this.getRandomInt(0, 256), this.getRandomInt(0, 256)]);
            }
        }
        this.socket.send(leds);
        this.lastPush = new Date();
    }
    // todo: output rgb palette as needed
    hexToRgbLed(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        // console.log({ hex, result });
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    }
    getRandomInt(min, max) {
        const minCeiled = Math.ceil(min);
        const maxFloored = Math.floor(max);
        return Math.floor(Math.random() * (max - minCeiled) + minCeiled);
    }
    async loadImageEvery(ms) {
        const image = await getImageData(this.config.client, 512, /* useHexPalette */ false, /* imgPath */ null, /* imgData */ null);
        if (image.success && image.data) {
            this.currentImage = image.data;
            this.pixelPlayer.loadImage(image.data, true);
        }
        else {
            console.log('Unable to load image!', image);
        }
        this.timeoutId = setTimeout(async () => await this.loadImageEvery(ms), ms);
    }
    /**
     * Starts the animation loop
     */
    async start(autoPlay = true) {
        this.started = true;
        const init = () => {
            if (!this.intervalId) {
                // let interval = this.currentImage?.meta.duration ? this.currentImage.meta.duration : this.config.updateInterval;
                this.intervalId = setInterval(() => this.update(), this.config.updateInterval);
                console.log('Animation started');
            }
            else {
                console.log('Already started');
            }
        };
        if (autoPlay) {
            await this.loadImageEvery(this.config.newImageInterval);
        }
        init();
    }
    /**
     * Stops the animation loop
     */
    stop() {
        this.started = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            clearTimeout(this.timeoutId);
            this.pixelPlayer.stop();
            this.intervalId = undefined;
            this.timeoutId = undefined;
            // eslint-disable-next-line no-console
            console.log('Animation stopped');
        }
    }
    setBrightness(brightness) {
        if (!this.socket)
            return;
        this.socket.setBrightness(brightness);
    }
    loadImage(path) {
        return getImageData(this.config.client, 512, /* useHexPalette */ false, /* imgPath */ path, /* imgData */ null)
            .then((image) => {
            if (!image.data)
                return false;
            this.currentImage = image.data;
            this.pixelPlayer.loadImage(image.data, true);
            return true;
        }).catch((err) => {
            console.error(err);
            return false;
        });
    }
    loadImageData(imgData) {
        this.currentImage = imgData;
        this.pixelPlayer.loadImage(imgData, true);
    }
}
//# sourceMappingURL=server-wled.js.map