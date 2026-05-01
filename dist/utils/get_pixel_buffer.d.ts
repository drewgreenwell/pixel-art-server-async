import { PixelArtClient, PixelBuffer } from "./data.js";
export declare function getImgPixelsBuffer(img: string, imgData: (Buffer | null) | undefined, client: PixelArtClient, background: string): Promise<PixelBuffer[]>;
