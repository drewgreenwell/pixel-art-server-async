export class ConfirmType {
    static Save = 0;
    static Delete = 1;
}

export interface ImageStat {
    id: string;
    path: string;
    created?: Date;
    width: number;
    height: number;
    format: string;
    hasAlpha?: boolean;
    pages?: number;
    data?: ImageData;
}
export interface UploadResult {
    success: boolean;
    message: string;
    uid: string;
    stats: ImageStat;
    error?: string;
}
export interface ImageRow {
    // row: number;
    // frame: number;
    // duration: number;
    pixels: number[];
}
export interface ImageData {
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
    palette: string[];
    rows: ImageRow[];
}

export interface Item {
    id: number;
    color: string;
}

export interface Tools {
    moving: boolean;
    movingAll: boolean;
    playing: boolean;
    paintBrush: boolean;
    paintBucket: boolean;
}