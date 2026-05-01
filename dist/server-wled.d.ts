import { WledAppConfig } from './utils/data_wled.js';
import { PixelImageData } from './utils/data.js';
/**
 * Main application class for controlling LED animations
 */
export declare class LedAnimationApp {
    private readonly socket;
    private offset;
    private lastPush;
    private intervalId?;
    private timeoutId?;
    private readonly config;
    private currentImage;
    private readonly pixelPlayer;
    started: boolean;
    /**
     * Creates a new LED animation application
     * @param config - Application configuration
     */
    constructor(config: WledAppConfig);
    /**
     * Animation update function called on each interval
     */
    private update;
    private hexToRgbLed;
    private getRandomInt;
    private loadImageEvery;
    /**
     * Starts the animation loop
     */
    start(autoPlay?: boolean): Promise<void>;
    /**
     * Stops the animation loop
     */
    stop(): void;
    setBrightness(brightness: number): void;
    loadImage(path: string): Promise<boolean>;
    loadImageData(imgData: PixelImageData): void;
}
