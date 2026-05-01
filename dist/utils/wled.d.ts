import type { IUDP } from './udp.js';
export interface SendWledUdpProps {
    /**
     * The mode of the UDP packet:
     *
     * 0 - WLED Notifier
     *
     * 1 - WARLS
     *
     * 2 - DRGB
     *
     * 3 - DRGBW
     *
     * 4 - DNRGB
     */
    mode?: 0 | 1 | 2 | 3 | 4;
    /**
     * The timeout of the UDP packet in seconds
     */
    timeout?: number;
    /**
     * The pixels to send
     *
     * see [docs](https://kno.wled.ge/interfaces/udp-realtime/) for the format
     */
    pixels?: number[];
    /**
     * The IP address of the target device
     */
    ip: string;
    /**
     * The port of the target device
     */
    port?: number;
    /**
     * The size of the buffer
     */
    u: IUDP;
}
/**
 * Convert an array of numbers to a base64 string
 */
export declare function arrayToBase64String(a: number[]): string;
/**
 * A class to send DDP packets to a WLED device
 */
export declare class WledDdpDevice {
    private static readonly HEADER_LEN;
    private static readonly MAX_PIXELS;
    private static readonly MAX_DATALEN;
    private static readonly VER1;
    private static readonly PUSH;
    private static readonly DATATYPE;
    private static readonly SOURCE;
    private frameCount;
    private destination;
    private port;
    private u;
    constructor(destination: string, port: number, u: IUDP);
    flush(pixels: number[]): Promise<void>;
    private sendPacket;
}
/**
 * Send a DDP packet to a wled device
 */
export declare function sendWledDdp(props: SendWledUdpProps): Promise<void>;
/**
 * Send a UDP packet to a wled device
 */
export declare const sendWledUdp: ({ mode, timeout, pixels, ip, port, u }: SendWledUdpProps) => Promise<void>;
