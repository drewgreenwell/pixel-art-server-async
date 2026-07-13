import dgram from 'dgram';
import { WLEDClient } from 'wled-client';
/**
 * Client for controlling WLED devices using the DDP (Distributed Display Protocol)
 * Provides methods for sending color data and controlling LED settings
 */
export class WLEDDdp {
    _socket;
    _port;
    _host;
    _autoTurnOn;
    _ledCount;
    jsonClient;
    initiallyOff = false;
    initialized = false;
    initPromise = null;
    disposed = false;
    frameCount = 0;
    MAX_DATA_LEN = 1460;
    PACKET_DATA_LEN = this.MAX_DATA_LEN - (this.MAX_DATA_LEN % 3);
    VER1 = 0x40;
    PUSH = 0x01;
    DATATYPE = 0x01;
    SOURCE = 0x01;
    /**
     * The number of LEDs in the strip
     */
    get ledCount() {
        return this._ledCount;
    }
    constructor(hostOrOptions, port) {
        if (typeof hostOrOptions === 'string') {
            this._host = hostOrOptions;
            this._port = port ?? 4048;
            this._autoTurnOn = true;
            this._ledCount = 1024;
        }
        else {
            this._host = hostOrOptions.host;
            this._port = hostOrOptions.port;
            this._autoTurnOn = hostOrOptions.autoTurnOn ?? true;
            this._ledCount = hostOrOptions.ledCount ?? 1024;
        }
        this._socket = dgram.createSocket('udp4');
        this._socket.on('error', (err) => {
            console.log(`Socket error:\n${err?.stack}`, err);
            this._socket.close();
        });
        this.jsonClient = new WLEDClient({
            host: this._host,
            websocket: false,
        });
    }
    /**
     * Initializes the LED connection and turns on the LEDs if they're off
     * @returns Promise that resolves when initialization is complete
     */
    async initLeds() {
        if (this.disposed) {
            throw new Error('Cannot initialize disposed WLEDDdp socket');
        }
        if (this.initialized) {
            return;
        }
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            await this.jsonClient.init();
            // eslint-disable-next-line no-console
            console.log('LEDs initialized', this.jsonClient.info, this.jsonClient.state);
            this.initiallyOff = this.jsonClient.state.on === false;
            if (this.initiallyOff && this._autoTurnOn) {
                await this.jsonClient.turnOn();
            }
            this.initialized = true;
        })().catch((error) => {
            this.initPromise = null;
            throw error;
        });
        return this.initPromise;
    }
    /**
     * Sets the overall brightness of the WLED device
     * @param brightness Brightness value (0-255)
     * @returns Promise that resolves when brightness has been set
     */
    async setBrightness(brightness) {
        if (this.disposed) {
            return;
        }
        if (brightness < 0 || brightness > 255) {
            throw new Error('Brightness must be between 0 and 255');
        }
        await this.jsonClient.setBrightness(brightness);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.initPromise = null;
        this.initialized = false;
        try {
            this._socket.close();
        }
        catch (error) {
            console.warn('Error closing UDP socket', error);
        }
    }
    /**
     * Creates an array of LED color values with the specified initial fill
     * @param initialFill Optional initial color for all LEDs, defaults to [0,0,0] (off)
     * @returns Array of LED color values
     */
    getLeds(initialFill) {
        const defaultColor = [0, 0, 0];
        return new Array(this._ledCount).fill(initialFill ?? defaultColor);
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
    async send(data) {
        if (this.disposed) {
            return;
        }
        await this.flush(data.flat());
    }
    async sendEmpty() {
        if (this.disposed) {
            return;
        }
        this.frameCount += 1;
        const sequence = (this.frameCount % 15) + 1;
        await this.sendPacket(sequence, 0, new Uint8Array());
    }
    async flush(pixels) {
        this.frameCount += 1;
        const sequence = (this.frameCount % 15) + 1;
        const byteData = new Uint8Array(pixels);
        const packets = Math.ceil(byteData.length / this.PACKET_DATA_LEN);
        for (let i = 0; i < packets; i++) {
            const dataStart = i * this.PACKET_DATA_LEN;
            const dataEnd = dataStart + this.PACKET_DATA_LEN;
            await this.sendPacket(sequence, i, byteData.slice(dataStart, dataEnd));
        }
    }
    async sendPacket(sequence, packetCount, data) {
        if (this.disposed) {
            return;
        }
        const bytesLength = data.length;
        const header = new Uint8Array(10);
        header[0] = this.VER1 | (bytesLength === this.PACKET_DATA_LEN ? this.VER1 : this.PUSH);
        header[1] = sequence;
        header[2] = this.DATATYPE;
        header[3] = this.SOURCE;
        new DataView(header.buffer).setUint32(4, packetCount * this.PACKET_DATA_LEN, false); // Big endian
        new DataView(header.buffer).setUint16(8, bytesLength, false); // Big endian
        const udpData = new Uint8Array([...header, ...data]);
        const pixels = Array.from(udpData);
        try {
            this._socket.send(udpData, 0, pixels.length, this._port, this._host, (error, _bytes) => {
                if (error !== null) {
                    console.error('Error sending packet:', error);
                }
            });
        }
        catch (error) {
            if (!this.disposed) {
                console.error('Error sending packet:', error);
            }
        }
    }
}
//# sourceMappingURL=wled_ddp.js.map