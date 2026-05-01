export interface IUDP {
    socketId?: number;
    ipv4?: string;
    ipv6?: string;
}
export interface StartUDPProps {
    /**
     * The port to bind to
     */
    port?: number;
    /**
     * The size of the buffer
     */
    bufferSize?: number;
}
export interface StopUDPProps {
    u: IUDP;
}
export interface SendUdpProps {
    /**
     * The data to send
     */
    data: string;
    /**
     * The IP address of the target device
     */
    ip: string;
    /**
     * The port of the target device
     */
    port?: number;
    /**
     * udp server object
     */
    u: IUDP;
}
/**
 * Start a UDP server and
 * return the udp server object of type IUDP
 */
export declare const startUDP: ({ port, bufferSize }: StartUDPProps) => Promise<IUDP | undefined>;
/**
 * Stop a UDP server,
 * needs the udp server object of type IUDP which is returned from startUDP
 */
export declare const stopUDP: ({ u }: StopUDPProps) => Promise<void>;
/**
 * Send a UDP packet to a device,
 * needs the udp server object of type IUDP which is returned from startUDP
 */
export declare const sendUdp: ({ data, ip, port, u }: SendUdpProps) => Promise<void>;
