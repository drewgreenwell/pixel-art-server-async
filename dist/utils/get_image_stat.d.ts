import { ImageStat, ImageFile } from "./data.js";
export declare function returnAnImageStat(imgObj: ImageFile): Promise<ImageStat>;
export declare function returnAnImageStatFromBuffer(imgObj: Buffer, name: string): Promise<ImageStat>;
export declare function addAnImageStat(theStat: ImageStat): void;
export declare function addAnImagePath(thePath: ImageFile): void;
export declare function removeAnImagePath(thePath: ImageFile): void;
export declare function getAllImageStats(): Promise<ImageStat[]>;
