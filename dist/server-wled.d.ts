import { WledAppConfig } from './utils/data_wled.js';
import { PixelArtClient } from './utils/data.js';
import { PixelImageData } from './utils/data.js';
/**
 * Main application class for controlling LED animations
 */
export declare class LedAnimationApp {
    private readonly clients;
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
     * Adds a new WLED client and starts tracking its connection
     * @param client - The pixel art client configuration
     * @param host - The hostname of the WLED device
     * @param port - The port for DDP communication
     */
    addClient(client: PixelArtClient, host: string, port: number): Promise<void>;
    /**
     * Removes a WLED client and its connection
     * @param clientId - The ID of the client to remove
     */
    removeClient(clientId: string): void;
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
    setBrightness(brightness: number, targetIds?: string[]): Promise<{
        updated: string[];
        failed: {
            id: string;
            error: string;
        }[];
    }>;
    loadImage(path: string): Promise<boolean>;
    loadImageData(imgData: PixelImageData): void;
}
