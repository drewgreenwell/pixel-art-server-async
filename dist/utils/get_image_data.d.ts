import { PixelArtClient, ImageDataResponse } from './data.js';
export declare function getImageData(client: PixelArtClient, paletteLength?: number, useHexPalette?: boolean, image_path?: string | null, imgData?: Buffer | null): Promise<ImageDataResponse>;
