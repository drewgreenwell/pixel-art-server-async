import { sendUdp } from './udp.js';
/**
 * Convert an array of numbers to a base64 string
 */
export function arrayToBase64String(a) {
    return btoa(String.fromCharCode(...a));
}
/**
 * A class to send DDP packets to a WLED device
 */
export class WledDdpDevice {
    static HEADER_LEN = 10;
    static MAX_PIXELS = 480;
    static MAX_DATALEN = WledDdpDevice.MAX_PIXELS * 3;
    static VER1 = 0x40;
    static PUSH = 0x01;
    static DATATYPE = 0x01;
    static SOURCE = 0x01;
    frameCount = 0;
    destination;
    port;
    u;
    constructor(destination, port, u) {
        this.destination = destination;
        this.port = port;
        this.u = u;
    }
    async flush(pixels) {
        this.frameCount += 1;
        const sequence = (this.frameCount % 15) + 1;
        const byteData = new Uint8Array(pixels);
        const packets = Math.ceil(byteData.length / WledDdpDevice.MAX_DATALEN);
        for (let i = 0; i < packets; i++) {
            const dataStart = i * WledDdpDevice.MAX_DATALEN;
            const dataEnd = dataStart + WledDdpDevice.MAX_DATALEN;
            await this.sendPacket(sequence, i, byteData.slice(dataStart, dataEnd));
        }
    }
    async sendPacket(sequence, packetCount, data) {
        const bytesLength = data.length;
        const header = new Uint8Array(WledDdpDevice.HEADER_LEN);
        header[0] = WledDdpDevice.VER1 | (bytesLength === WledDdpDevice.MAX_DATALEN ? WledDdpDevice.VER1 : WledDdpDevice.PUSH);
        header[1] = sequence;
        header[2] = WledDdpDevice.DATATYPE;
        header[3] = WledDdpDevice.SOURCE;
        new DataView(header.buffer).setUint32(4, packetCount * WledDdpDevice.MAX_DATALEN, false); // Big endian
        new DataView(header.buffer).setUint16(8, bytesLength, false); // Big endian
        const udpData = new Uint8Array([...header, ...data]);
        const pixels = Array.from(udpData);
        const props = {
            data: arrayToBase64String(pixels),
            ip: this.destination,
            port: this.port,
            u: this.u
        };
        await sendUdp(props);
    }
}
/**
 * Send a DDP packet to a wled device
 */
export async function sendWledDdp(props) {
    const ddpDevice = new WledDdpDevice(props.ip, props.port || 4048, props.u);
    if (props.pixels)
        await ddpDevice.flush(props.pixels);
}
/**
 * Send a UDP packet to a wled device
 */
export const sendWledUdp = async ({ mode = 2, timeout = 1, pixels = Array(297).fill([255, 0, 0]).flat(), ip, port = 21324, u }) => {
    const ledDataPrefix = [mode, timeout];
    const data = arrayToBase64String([...ledDataPrefix, ...pixels]);
    if (u && typeof u.socketId === 'number') {
        try {
            const props = {
                data,
                ip,
                port,
                u
            };
            await sendUdp(props);
        }
        catch (error) {
            console.error('Error with UDP:', error);
        }
    }
};
//# sourceMappingURL=wled.js.map