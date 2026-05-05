import fsextra from 'fs-extra';
const { readJSONSync, existsSync } = fsextra;
import { resolve } from 'path'
import { OutputInfo } from 'sharp'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Led, WledAppConfig } from './data_wled.js';
import quantize from 'quantize';

export interface RawImage {
    data: Buffer;
    info: OutputInfo;
}

export interface PixelBuffer extends RawImage {
    metadata: ImageStat;
}



export interface ImageFile {
    path: string;
    created: number;
}

export interface ImageStat extends ImageFile {
    id: string;
    /* sharp metadata */
    width: number;
    height: number;
    format: string;
    hasAlpha: boolean;
    pages: number;
    delay: number[];
}

export interface PixelArtClient {
    id: string;
    pixels: number
    width: number;
    height: number;
    imagesetId?: number;
}

export interface Playlist {
    id: number;
    name: string;
    images: string[];
    duration: number;
    brightness: number;
    backgroundColor: string;
    imageDurations?: (number | null)[];
}


export interface ImageRow {
    row: number;
    frame: number;
    duration: number;
    pixels: number[];
}
export interface PixelImageData {
    meta: {
        path: string;
        duration: number;
        brightness: number;
        backgroundColor: string;
        frames: number;
        width: number;
        height: number;
        paletteLength: number;
        durations: number[];
    };
    palette: string[] | Led[];
    rows: ImageRow[];
}

export interface ImageDataResponse {
    msg: string,
    success: boolean,
    data?: PixelImageData;
}

export class Data {
    static staticImageBaseURL = "/image-preview";
    static clients: PixelArtClient[] = [];
    static playlists: Playlist[] = [];
    static imageDirectoryPath: string;
    static playlistFilePath: string;
    static clientsFilePath: string;
    static basePath: string;

    /**
     * Default configuration loaded from environment variables
     */
    // const wledConfig: WledAppConfig = {
    //   host: getEnvValue('WLED_HOST', '192.168.1.18'),
    //   port: getEnvValue('WLED_PORT', 4048),
    //   ledCount: getEnvValue('LED_COUNT', 1024),
    //   updateInterval: getEnvValue('UPDATE_INTERVAL', 100),
    //   updateInterval: getEnvValue('IMAGE_INTERVAL', 10000),
    // };
    static wledConfig: WledAppConfig = {
        host: '192.168.1.4',
        port: 4048,
        updateInterval: 100,
        newImageInterval: 10000,
        client: {
            id: 'DefaultClient',
            height: 32,
            width: 32,
            pixels: 1024
        }
    };

    constructor(baseURL: string) {
        Data.basePath = dirname(fileURLToPath(baseURL));
        Data.imageDirectoryPath = resolve(Data.basePath, 'img');
        Data.playlistFilePath = resolve(Data.basePath, 'data/playlists.json');
        Data.clientsFilePath = resolve(Data.basePath, "data/clients.json");


        if (existsSync(Data.playlistFilePath)) {
            Data.playlists = readJSONSync(Data.playlistFilePath);
        }
        if (existsSync(Data.clientsFilePath)) {
            Data.clients = readJSONSync(Data.clientsFilePath);
        }
        if (!Data.clients.length || !Array.isArray(Data.clients)) {
            Data.clients = [Data.wledConfig.client];
        }
    }
};

export interface ImagePalettes {
    hex: string[],
    rgb: { key: string, color: number[] }[],
    colorMap?: quantize.ColorMap | false
}