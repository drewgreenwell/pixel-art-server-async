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
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    hollow = false,
): { row: number; col: number }[] {
    const pixels: { row: number; col: number }[] = [];
    if (!image) return pixels;
    const h = image.meta.height;
    const w = image.meta.width;
    const clampedMinX = Math.max(0, Math.min(minX, maxX));
    const clampedMaxX = Math.min(w - 1, Math.max(minX, maxX));
    const clampedMinY = Math.max(0, Math.min(minY, maxY));
    const clampedMaxY = Math.min(h - 1, Math.max(minY, maxY));
    const radiusX = Math.max(0.5, (clampedMaxX - clampedMinX + 1) / 2);
    const radiusY = Math.max(0.5, (clampedMaxY - clampedMinY + 1) / 2);
    const centerX = clampedMinX + radiusX;
    const centerY = clampedMinY + radiusY;

    const filled = new Set<string>();

    // Build a filled ellipse first using pixel-center sampling.
    for (let y = clampedMinY; y <= clampedMaxY; y++) {
        for (let x = clampedMinX; x <= clampedMaxX; x++) {
            const dx = (x + 0.5) - centerX;
            const dy = (y + 0.5) - centerY;
            const normalized =
                (dx * dx) / (radiusX * radiusX) +
                (dy * dy) / (radiusY * radiusY);

            if (normalized <= 1) {
                filled.add(`${x},${y}`);
            }
        }
    }

    if (!hollow) {
        for (const key of filled) {
            const [x, y] = key.split(',').map(Number);
            pixels.push({ row: y, col: x });
        }
        return pixels;
    }

    // For outline mode, keep only boundary pixels (4-neighbor check).
    for (const key of filled) {
        const [x, y] = key.split(',').map(Number);
        const neighbors = [
            `${x - 1},${y}`,
            `${x + 1},${y}`,
            `${x},${y - 1}`,
            `${x},${y + 1}`,
        ];
        const isBoundary = neighbors.some((n) => !filled.has(n));
        if (isBoundary) {
            pixels.push({ row: y, col: x });
        }
    }

    return pixels;
}

export function getPixelSquare(
    image: ImageData,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    hollow: boolean = false,
): { row: number; col: number }[] {
    const pixels: { row: number; col: number }[] = [];
    if (!image) return pixels;
    const h = image.meta.height;
    const w = image.meta.width;
    const clampedMinX = Math.max(0, Math.min(minX, maxX));
    const clampedMaxX = Math.min(w - 1, Math.max(minX, maxX));
    const clampedMinY = Math.max(0, Math.min(minY, maxY));
    const clampedMaxY = Math.min(h - 1, Math.max(minY, maxY));
    for (let y = clampedMinY; y <= clampedMaxY; y++) {
        for (let x = clampedMinX; x <= clampedMaxX; x++) {
            if (!hollow) {
                pixels.push({ row: y, col: x });
            } else {
                const isBorder = x == clampedMinX || x == clampedMaxX || y == clampedMinY || y == clampedMaxY;
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