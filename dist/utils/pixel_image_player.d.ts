import { PixelArtClient, PixelImageData } from "./data.js";
import { Led } from "./data_wled.js";
export declare class PixelImagePlayer {
    currentFrame: number;
    currentFrameTime: number;
    currentPixels: Led[];
    lastDraw: Date;
    image: PixelImageData | null;
    timeoutId?: NodeJS.Timeout;
    readonly height: number;
    readonly width: number;
    readonly defaultDelay: number;
    readonly client: PixelArtClient;
    private _pixels;
    constructor(client: PixelArtClient, defaultDelay?: number);
    loadImage(pixelImage: PixelImageData | null, start?: boolean): void;
    start(): void;
    stop(): void;
    private initImage;
    private update;
    private hexToRgbLed;
}
