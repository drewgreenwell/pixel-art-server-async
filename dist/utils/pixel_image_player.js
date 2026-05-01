export class PixelImagePlayer {
    currentFrame = 0;
    currentFrameTime = 0;
    currentPixels = [];
    lastDraw = new Date();
    image = null;
    timeoutId;
    height;
    width;
    defaultDelay;
    client;
    _pixels = [];
    constructor(client, defaultDelay = 10000) {
        this.client = client;
        this.height = client.height;
        this.width = client.width;
        this.defaultDelay = defaultDelay;
    }
    loadImage(pixelImage, start = true) {
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
    start() {
        this.update(false);
    }
    stop() {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }
    }
    initImage() {
        if (!this.image)
            return;
        let img = this.image;
        let durations = img.meta?.durations?.length ? img.meta.durations : [this.defaultDelay];
        this.currentFrameTime = durations[0];
        this._pixels = img.rows.flatMap((r) => r.pixels.map((p) => img.palette[p]));
        // console.log({ p: this._pixels });
    }
    update(incrementFrame = true) {
        if (!this.image)
            return;
        const frames = this.image.meta.frames;
        if (frames > 1) {
            let f = incrementFrame ? this.currentFrame + 1 : this.currentFrame;
            this.currentFrame = f > frames - 1 ? 0 : f;
            this.currentFrameTime = this.image.meta.durations[this.currentFrame] <= 0
                ? this.defaultDelay
                : this.image.meta.durations[this.currentFrame];
        }
        else {
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
    hexToRgbLed(hex) {
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
//# sourceMappingURL=pixel_image_player.js.map