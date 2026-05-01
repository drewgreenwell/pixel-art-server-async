import type { ImageData, ImageRow } from "./DataTypes";


export function insertFramesAt(index: number, image: ImageData, imagePalette: string[] | null, frameRows: ImageRow[], framePalette: string[]): ImageData {
    if (!image)
        return image;
    imagePalette = [...(imagePalette ?? image.palette)];
    frameRows = structuredClone(frameRows);
    let start = index;
    const frames = image.meta.frames;
    if (start < 0) {
        start = Math.max(0, frames + start);

    } else if (start > frames) {
        start = frames;
    }
    // add unique palette entries
    frameRows.flatMap(r => r.pixels.filter(onlyUnique)).filter(onlyUnique).forEach((p, i) => {
        let color = framePalette[p];
        let pIdx = imagePalette.indexOf(color);
        if (pIdx == -1) {
            imagePalette.push(color);
            // pIdx = imagePalette.length;
        }
    })
    // update pixels for new palette
    frameRows.forEach((r) => {
        for (let i = 0; i < r.pixels.length; i++) {
            const current = framePalette[r.pixels[i]];
            r.pixels[i] = imagePalette.indexOf(current)
        }
    });
    image.palette = imagePalette;
    image.rows.splice(start, 0, ...frameRows);
    let frame = 0;
    image.rows.forEach((r, i) => {
        r.row = i;
        r.frame = frame;
        if (i > 0 && i % image.meta.height == 0) {
            frame += 1;
        }
    })
    return image;
}

export function getPixelEllipse(
    image: ImageData,
    radiusX: number,
    radiusY: number,
    centerX: number,
    centerY: number,
    hollow = false,
): { row: number; col: number }[] {
    const pixels: { row: number; col: number }[] = [];
    if (!image) return pixels;
    const h = image.meta.height;
    const w = image.meta.height;

    const addPixel = (x: number, y: number) => {
        if (x >= 0 && x < w && y >= 0 && y < h) {
            if (!pixels.some((p) => p.row === y && p.col === x)) {
                pixels.push({ row: y, col: x });
            }
        }
    };

    if (!hollow) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const normalDist =
                    (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
                if (normalDist <= 1) {
                    pixels.push({ row: y, col: x });
                }
            }
        }
        return pixels;
    }

    let x = 0;
    let y = radiusY;
    const a2 = radiusX * radiusX;
    const b2 = radiusY * radiusY;

    // region 1
    let p1 = b2 - a2 * radiusY + 0.25 * a2;
    let dx = 2 * b2 * x;
    let dy = 2 * a2 * y;

    while (dx < dy) {
        addPixel(centerX + x, centerY + y);
        addPixel(centerX - x, centerY + y);
        addPixel(centerX + x, centerY - y);
        addPixel(centerX - x, centerY - y);
        if (p1 < 0) {
            x++;
            dx = dx + 2 * b2;
            p1 = p1 + dx + b2;
        } else {
            x++;
            y--;
            dx = dx + 2 * b2;
            dy = dy - 2 * a2;
            p1 = p1 + dx - dy + b2;
        }
    }

    // region 2
    let p2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2;
    while (y >= 0) {
        addPixel(centerX + x, centerY + y);
        addPixel(centerX - x, centerY + y);
        addPixel(centerX + x, centerY - y);
        addPixel(centerX - x, centerY - y);
        if (p2 > 0) {
            y--;
            dy = dy - 2 * a2;
            p2 = p2 + a2 - dy;
        } else {
            y--;
            x++;
            dx = dx + 2 * b2;
            dy = dy - 2 * a2;
            p2 = p2 + dx - dy + a2;
        }
    }

    return pixels;
}

export function getPixelSquare(
    image: ImageData,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    hollow: boolean = false,
): { row: number; col: number }[] {
    const pixels: { row: number; col: number }[] = [];
    if (!image) return pixels;
    const h = image.meta.height;
    const w = image.meta.height;
    const minX = Math.max(0, centerX - radiusX);
    const maxX = Math.min(w, centerX + radiusX);
    const minY = Math.max(0, centerY - radiusY);
    const maxY = Math.min(h, centerY + radiusY);
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (!hollow) {
                pixels.push({ row: y, col: x });
            } else {
                const isBorder = x == minX || x == maxX || y == minY || y == maxY;
                if (isBorder) {
                    pixels.push({ row: y, col: x });
                }
            }
        }
    }
    return pixels;
}

export function flipRegionVertical(
    pixels: number[][],
    offsetX: number,
    offsetY: number,
    size: number
) {
    let top = offsetY;
    let bottom = offsetY + size - 1;

    while (top < bottom) {
        for (let x = offsetX; x < offsetX + size; x++) {
            const tmp: number = pixels[top][x];
            pixels[top][x] = pixels[bottom][x];
            pixels[bottom][x] = tmp;
        }
        top++;
        bottom--;
    }
}

export function flipRegionHorizontal(
    pixels: any[],
    offsetX: number,
    offsetY: number,
    size: number
) {
    for (let y = offsetY; y < offsetY + size; y++) {
        let left = offsetX;
        let right = offsetX + size - 1;

        while (left < right) {
            const tmp = pixels[y][left];
            pixels[y][left] = pixels[y][right];
            pixels[y][right] = tmp;
            left++;
            right--;
        }
    }
}

function onlyUnique(value: number, index: number, array: number[]) {
    return array.indexOf(value) === index;
}