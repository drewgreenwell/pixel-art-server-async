import dgram from 'dgram';
import { WLEDClient } from 'wled-client';
import { Led, WLEDDdpOptions } from './data_wled.js';

/**
 * Client for controlling WLED devices using the DDP (Distributed Display Protocol)
 * Provides methods for sending color data and controlling LED settings
 */
export class WLEDDdp {
    private readonly _socket: dgram.Socket;
    private readonly _port: number;
    private readonly _host: string;
    private readonly _ledCount: number;
    private readonly _autoTurnOn: boolean;
    private initiallyOff = true;
    private frameCount: number = 0

    private readonly jsonClient: WLEDClient;

    // DDP Protocol constants
    private readonly MAX_DATA_LEN = 1407; // 1440
    //
    private readonly VERSION = 0x01; // Version 1, PUSH flag not set, other flags are 0
    private readonly DATA_TYPE = 0x01; // Data type RGB
    private readonly OUTPUT_ID = 0x01; // Default ID for output device
    //
    private readonly VER1 = 0x40
    private readonly PUSH = 0x01
    private readonly DATATYPE = 0x01
    private readonly SOURCE = 0x01

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
    constructor(hostOrOptions: string | WLEDDdpOptions, port?: number) {
        if (typeof hostOrOptions === 'string') {
            this._host = hostOrOptions;
            this._port = port ?? 4048;
            this._autoTurnOn = true;
            this._ledCount = 1024;
        } else {
            this._host = hostOrOptions.host;
            this._port = hostOrOptions.port;
            this._autoTurnOn = hostOrOptions.autoTurnOn ?? true;
            this._ledCount = hostOrOptions.ledCount ?? 1024;
        }

        this._socket = dgram.createSocket('udp4', (msg, rinfo) => {
            // console.log({ t: 'socket callback', msg, rinfo })
            console.log('udp4 callback')
        });
        this._socket.on('error', (err) => {
            console.log(`Socket error:\n${err?.stack}`, err);
            this._socket.close();
        });
        this.jsonClient = new WLEDClient({
            host: this._host,
            websocket: false,
        });

        this.initLeds().catch((error: Error) => {
            // eslint-disable-next-line no-console
            console.error('Error initializing LEDs:', error);
        });
    }

    /**
     * Initializes the LED connection and turns on the LEDs if they're off
     * @returns Promise that resolves when initialization is complete
     */
    public async initLeds(): Promise<void> {
        await this.jsonClient.init();
        // eslint-disable-next-line no-console
        console.log('LEDs initialized', this.jsonClient.info, this.jsonClient.state);
        this.initiallyOff = this.jsonClient.state.on === false;
        if (this.initiallyOff && this._autoTurnOn) {
            await this.jsonClient.turnOn();
        }
    }

    /**
     * Sets the overall brightness of the WLED device
     * @param brightness Brightness value (0-255)
     * @returns Promise that resolves when brightness has been set
     */
    public async setBrightness(brightness: number): Promise<void> {
        if (brightness < 0 || brightness > 255) {
            throw new Error('Brightness must be between 0 and 255');
        }
        await this.jsonClient.setBrightness(brightness);
    }

    /**
     * Creates an array of LED color values with the specified initial fill
     * @param initialFill Optional initial color for all LEDs, defaults to [0,0,0] (off)
     * @returns Array of LED color values
     */
    public getLeds(initialFill?: Led): readonly Led[] {
        const defaultColor: Led = [0, 0, 0];
        return new Array(this._ledCount).fill(initialFill ?? defaultColor) as Led[];
    }

    /**
     * Creates a DDP packet from an array of LED color values
     * @param leds Array of LED color values
     * @returns Buffer containing the DDP packet
     * @private
     */
    // private createPacket(leds: readonly Led[]): Buffer {
    //     const bytesLength = leds.length * 3;
    //     const header = Buffer.alloc(10); // DDP header is 10 bytes
    //     header[0] = this.VERSION | (bytesLength === WledDdpDevice.MAX_DATALEN ? WledDdpDevice.VER1 : WledDdpDevice.PUSH);
    //     header[1] = 0x00; // Reserved for future use, set to 0.
    //     header[2] = this.DATA_TYPE;
    //     header[3] = this.OUTPUT_ID;
    //     header.writeUInt32BE(0, 4); // Offset set to 0
    //     header.writeUInt16BE(leds.length * 3, 8); // Data length
    //     const data = Buffer.concat(
    //         leds.map(color => {
    //             return Buffer.from([color[0], color[1], color[2]]);
    //         })
    //     );
    //     console.log(data);
    //     return Buffer.concat([header, data]);
    // }

    // /**
    //  * Sends a DDP packet to the WLED device
    //  * @param packet Buffer containing the DDP packet
    //  * @private
    //  */
    // private sendPacket(packet: Buffer): void {
    //     this._socket.send(
    //         packet,
    //         0,
    //         packet.length,
    //         this._port,
    //         this._host,
    //         (error: Error | null, _bytes: number) => {
    //             console.log(`failed sending packet size(${packet.length}) bytes(${_bytes}) to: ${this._host}:${this._port}`, error);
    //             if (error !== null) {
    //                 // eslint-disable-next-line no-console
    //                 console.error('Error sending packet:', error);
    //             }
    //         }
    //     );
    // }

    /**
     * Sends color data to the WLED device
     * @param data Array of LED color values to send
     * @returns void
     */
    public async send(data: readonly Led[]): Promise<void> {
        await this.flush(data.flat())
    }

    public async sendEmpty(): Promise<void> {
        this.frameCount += 1
        const sequence = (this.frameCount % 15) + 1
        await this.sendPacket(sequence, 0, new Uint8Array())
    }


    private async flush(pixels: number[]): Promise<void> {
        this.frameCount += 1
        const sequence = (this.frameCount % 15) + 1
        const byteData = new Uint8Array(pixels)
        const packets = Math.ceil(byteData.length / this.MAX_DATA_LEN)

        for (let i = 0; i < packets; i++) {
            const dataStart = i * this.MAX_DATA_LEN
            const dataEnd = dataStart + this.MAX_DATA_LEN
            await this.sendPacket(sequence, i, byteData.slice(dataStart, dataEnd))
        }
    }

    private async sendPacket(sequence: number, packetCount: number, data: Uint8Array): Promise<void> {
        const bytesLength = data.length
        const header = new Uint8Array(10)
        header[0] = this.VER1 | (bytesLength === this.MAX_DATA_LEN ? this.VER1 : this.PUSH)
        header[1] = sequence
        header[2] = this.DATATYPE
        header[3] = this.SOURCE
        new DataView(header.buffer).setUint32(4, packetCount * this.MAX_DATA_LEN, false) // Big endian
        new DataView(header.buffer).setUint16(8, bytesLength, false) // Big endian

        const udpData = new Uint8Array([...header, ...data])
        const pixels = Array.from(udpData)
        this._socket.send(
            udpData,
            0,
            pixels.length,
            this._port,
            this._host,
            (error: Error | null, _bytes: number) => {
                if (error !== null) {
                    console.error('Error sending packet:', error);
                }
            }
        );
    }
}