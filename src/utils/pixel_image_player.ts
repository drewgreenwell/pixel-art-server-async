import { PixelArtClient, PixelImageData } from "./data.js";
import { Led } from "./data_wled.js";

export class PixelImagePlayer {
    currentFrame: number = 0;
    currentFrameTime: number = 0;
    currentPixels: Led[] = [];
    lastDraw: Date = new Date();
    image: PixelImageData | null = null;
    timeoutId?: NodeJS.Timeout;
    readonly height: number;
    readonly width: number;
    readonly defaultDelay: number;
    readonly client: PixelArtClient;

    private _pixels: Led[] = [];

    constructor(client: PixelArtClient, defaultDelay: number = 10000) {
        this.client = client;
        this.height = client.height;
        this.width = client.width;
        this.defaultDelay = defaultDelay;
    }

    public loadImage(pixelImage: PixelImageData | null, start: boolean = true) {
        this.stop();
        this.currentFrame = 0;
        this._pixels = [];
        this.currentFrameTime = this.defaultDelay;
        this.image = pixelImage;
        if (this.image) {
            this.initImage();
            if (start)
                this.start();
        }
    }

    public start() {
        this.update(false);
    }

    public stop() {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }
    }

    private initImage() {
        if (!this.image) return;
        let img = this.image;
        let durations = img.meta?.durations?.length ? img.meta.durations : [this.defaultDelay];
        this.currentFrameTime = durations[0];
        this._pixels = img.rows.flatMap((r) => r.pixels.map((p) => (<Led[]>img.palette)[p]));
        // console.log({ p: this._pixels });
    }

    private update(incrementFrame: boolean = true) {
        if (!this.image) return;
        const frames = this.image.meta.frames;
        if (frames > 1) {
            let f = incrementFrame ? this.currentFrame + 1 : this.currentFrame;
            this.currentFrame = f > frames - 1 ? 0 : f;
            this.currentFrameTime = this.image.meta.durations[this.currentFrame] <= 0
                ? this.defaultDelay
                : this.image.meta.durations[this.currentFrame];
        } else {
            this.currentFrameTime = this.defaultDelay;
        }
        const len = this.height * this.width;
        const start = this.currentFrame * len;
        this.currentPixels = this._pixels.slice(start, start + len);
        // console.log({ s: 'update', start, len, ft: this.currentFrameTime, f: this.currentFrame })
        this.lastDraw = new Date();
        this.timeoutId = setTimeout(() => this.update(true), this.currentFrameTime);
    }

    // todo: output rgb palette as needed
    private hexToRgbLed(hex: string): Led {
        var c = parseInt(hex, 16);
        return isNaN(c) ? [0, 0, 0] : [
            ((c >> 24) & 0xFF),
            ((c >> 16) & 0xFF),
            ((c >> 8) & 0xFF),
        ];
        // var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        // // console.log({ hex, result });
        // return result ? [
        //     parseInt(result[1], 16),
        //     parseInt(result[2], 16),
        //     parseInt(result[3], 16)
        // ] : [0, 0, 0];
    }
}