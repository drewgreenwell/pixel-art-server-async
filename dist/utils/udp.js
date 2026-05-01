import { UDP } from '@blade86/capacitor-udp';
/**
 * Start a UDP server and
 * return the udp server object of type IUDP
 */
export const startUDP = async ({ port = 21324, bufferSize = 4096 }) => {
    let u = null;
    try {
        u = await UDP.create({ properties: { name: 'yz', bufferSize: bufferSize } });
        if (u && typeof u.socketId === 'number') {
            await UDP.bind({ socketId: u.socketId, address: '0.0.0.0', port });
            return u;
        }
    }
    catch (error) {
        console.error('Error with UDP:', error);
    }
};
/**
 * Stop a UDP server,
 * needs the udp server object of type IUDP which is returned from startUDP
 */
export const stopUDP = async ({ u }) => {
    try {
        if (u && typeof u.socketId === 'number')
            await UDP.close({ socketId: u.socketId });
    }
    catch (error) {
        console.error('Error closing UDP:', error);
    }
};
/**
 * Send a UDP packet to a device,
 * needs the udp server object of type IUDP which is returned from startUDP
 */
export const sendUdp = async ({ data, ip, port = 21324, u }) => {
    if (u && typeof u.socketId === 'number') {
        try {
            await UDP.send({ socketId: u.socketId, address: ip, port, buffer: data });
        }
        catch (error) {
            console.error('Error with UDP:', error);
        }
    }
};
//# sourceMappingURL=udp.js.map