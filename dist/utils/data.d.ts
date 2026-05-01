import { OutputInfo } from 'sharp';
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
    width: number;
    height: number;
    format: string;
    hasAlpha: boolean;
    pages: number;
    delay: number[];
}
export interface PixelArtClient {
    id: string;
    pixels: number;
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
    msg: string;
    success: boolean;
    data?: PixelImageData;
}
export declare class Data {
    static staticImageBaseURL: string;
    static clients: PixelArtClient[];
    static playlists: Playlist[];
    static imageDirectoryPath: string;
    static playlistFilePath: string;
    static clientsFilePath: string;
    static basePath: string;
    /**
     * Default configuration loaded from environment variables
     */
    static wledConfig: WledAppConfig;
    constructor(baseURL: string);
}
export interface ImagePalettes {
    hex: string[];
    rgb: {
        key: string;
        color: number[];
    }[];
    colorMap?: quantize.ColorMap | false;
}
