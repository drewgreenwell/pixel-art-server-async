import { PixelArtClient } from './data.js';
/**
 * Represents an RGB color value for an LED
 * [red, green, blue] where each value is 0-255
 */
export type Led = readonly [number, number, number];
/**
 * Configuration options for WLEDDdp client
 */
export interface WLEDDdpOptions {
    /** The hostname or IP address of the WLED device */
    readonly host: string;
    /** The port number for DDP communication (default is 4048) */
    readonly port: number;
    /** Whether to automatically turn on LEDs if they're off initially */
    readonly autoTurnOn?: boolean;
    /** Number of LEDs in the strip */
    readonly ledCount?: number;
}
/**
 * Configuration for the LED application
 */
export interface WledAppConfig {
    /** The port number for DDP communication */
    readonly port: number;
    /** Animation update interval in milliseconds */
    readonly updateInterval: number;
    /** Amount of tie in ms between image swaps */
    readonly newImageInterval: number;
    /** The hostname or IP address of the WLED device */
    host: string;
    client: PixelArtClient;
}
