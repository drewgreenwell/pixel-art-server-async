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
    /** The hostname or IP address of the WLED device */
    readonly host: string;
    /** The port number for DDP communication */
    readonly port: number;
    /** Number of LEDs in the strip */
    readonly ledCount: number;
    /** Animation update interval in milliseconds */
    readonly updateInterval: number;
}
/**
 * Client for controlling WLED devices using the DDP (Distributed Display Protocol)
 * Provides methods for sending color data and controlling LED settings
 */
export declare class WLEDDdp {
    private readonly _socket;
    private readonly _port;
    private readonly _host;
    private readonly _ledCount;
    private readonly _autoTurnOn;
    private initiallyOff;
    private frameCount;
    private readonly jsonClient;
    private readonly MAX_DATA_LEN;
    private readonly VERSION;
    private readonly DATA_TYPE;
    private readonly OUTPUT_ID;
    private readonly VER1;
    private readonly PUSH;
    private readonly DATATYPE;
    private readonly SOURCE;
    /**
     * Creates a new WLEDDdp client
     * @param options Configuration options for the client
     */
    constructor(options: WLEDDdpOptions);
    /**
     * Creates a new WLEDDdp client (legacy constructor)
     * @param host The hostname or IP address of the WLED device
     * @param port The port number for DDP communication
     * @deprecated Use the options object constructor instead
     */
    constructor(host: string, port: number);
    /**
     * Initializes the LED connection and turns on the LEDs if they're off
     * @returns Promise that resolves when initialization is complete
     */
    initLeds(): Promise<void>;
    /**
     * Sets the overall brightness of the WLED device
     * @param brightness Brightness value (0-255)
     * @returns Promise that resolves when brightness has been set
     */
    setBrightness(brightness: number): Promise<void>;
    /**
     * Creates an array of LED color values with the specified initial fill
     * @param initialFill Optional initial color for all LEDs, defaults to [0,0,0] (off)
     * @returns Array of LED color values
     */
    getLeds(initialFill?: Led): readonly Led[];
    /**
     * Creates a DDP packet from an array of LED color values
     * @param leds Array of LED color values
     * @returns Buffer containing the DDP packet
     * @private
     */
    /**
     * Sends color data to the WLED device
     * @param data Array of LED color values to send
     * @returns void
     */
    send(data: readonly Led[]): Promise<void>;
    private flush;
    private sendPacket;
}
