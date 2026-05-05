import _, { map } from 'underscore';
import { Data, PixelArtClient, ImagePalettes, ImageRow, PixelImageData, ImageDataResponse } from './data.js';
import { getAllImageStats, returnAnImageStat, returnAnImageStatFromBuffer } from './get_image_stat.js';
import { getImgPixelsBuffer } from './get_pixel_buffer.js';
import quantize, { RgbPixel } from 'quantize';

let fallbackShuffleBag: string[] = [];
let fallbackShuffleSourceKey = '';
let fallbackLastPath: string | null = null;

function refillFallbackShuffleBag(imageIds: string[]): void {
    fallbackShuffleBag = _.shuffle(imageIds);
    if (fallbackLastPath && fallbackShuffleBag.length > 1 && fallbackShuffleBag[0] === fallbackLastPath) {
        const first = fallbackShuffleBag.shift();
        if (first) {
            fallbackShuffleBag.push(first);
        }
    }
}

function getNextFallbackImagePath(imageStats: { id: string }[]): string | null {
    const imageIds = imageStats.map((s) => s.id).filter((id) => !!id);
    if (!imageIds.length) {
        return null;
    }

    const sourceKey = imageIds.slice().sort().join('|');
    if (sourceKey !== fallbackShuffleSourceKey || fallbackShuffleBag.length === 0) {
        fallbackShuffleSourceKey = sourceKey;
        refillFallbackShuffleBag(imageIds);
    }

    let next = fallbackShuffleBag.shift() || null;
    if (!next) {
        refillFallbackShuffleBag(imageIds);
        next = fallbackShuffleBag.shift() || null;
    }

    if (next) {
        fallbackLastPath = next;
    }
    return next;
}


export async function getImageData(client: PixelArtClient, paletteLength: number = 512, useHexPalette: boolean = true, image_path: string | null = null, imgData: Buffer | null = null): Promise<ImageDataResponse> {
    let imageset = _.find(Data.playlists, (p) => p.id == client.imagesetId);
    if (!imageset) {
        console.warn(`imageset not found for id '${client.imagesetId}'`);
        imageset = Data.playlists[0] || {};
    }
    let { images, id: index, duration, brightness, backgroundColor, imageDurations } = imageset;
    var imageCount = images?.length;
    if (_.isUndefined(index))
        index = 0;
    if (index >= imageCount)
        index = 0;
    const imageStats = await getAllImageStats();
    let reqPath = null;
    if (image_path != null) {
        let s = imageStats.find((s, i) => {
            return s.id.toLowerCase() == ('' + image_path).toLowerCase();
        });
        if (s)
            reqPath = s.id;
    } else if (imgData) {
        path = 'temp.gif';
    }
    var path = reqPath || images?.[index] || getNextFallbackImagePath(imageStats);
    if (!path) {
        return { success: false, msg: JSON.stringify({ warning: 'no playlist and no backup image' }) };
    }

    imageset.id = index + 1;

    // console.log({ path });

    backgroundColor = backgroundColor || "#FFFFFF";
    const pixelBufferOp = getImgPixelsBuffer(path, imgData, client, backgroundColor);
    let metadata = imgData ? await returnAnImageStatFromBuffer(imgData, path)
        : _.findWhere(imageStats, { id: path });

    if (!metadata) {

        return { success: false, msg: JSON.stringify({ warning: `unable to find metadata for ${path}` }) };
    }

    let frames;//, info;

    // console.log({ delay: metadata.delay });

    return pixelBufferOp.then((result) => {
        if (result == null) {
            return { success: false, msg: JSON.stringify({ warning: `unable to get pixel buffer for ${path}` }) }
        }
        if (metadata.pages > 1) {
            frames = _.pluck(result, "data");
            //info = _.pluck(result, "info");
        } else {
            frames = [result[0].data];
            //info = [{}];
        }

        // console.log({ frames: frames.length, paletteLength });

        // console.log('----');
        // console.log({ theFrameData: JSON.stringify(frames[0]) });
        // console.log(`framedata pixel len: ${frames[0].length / 4}`);
        // const qpallete =_.uniq(
        const qpalette = []; //_.reduce(frames, (memo, frameData, frameIndex) =>{
        //const qpalette2 = [];
        for (let i = 0; i < frames.length; i++) {
            let frameData = frames[i];
            for (let j = 0; j < frameData.length - 3; j += 4) {
                let rgba = [
                    frameData[j],
                    frameData[j + 1],
                    frameData[j + 2],
                    // frameData[j + 3]
                ]
                qpalette.push(rgba);
                //qpalette2.push(rgba.slice(0, -1));
            }
        }

        let limit = 512;
        if (!isNaN(paletteLength) && paletteLength > 0) {
            limit = paletteLength;
        }
        console.log({ qpallete_len: qpalette.length });
        let palettes = getPalettes(qpalette, limit);
        let outPixels = qpalette;
        let outPalette = useHexPalette ? palettes.hex : palettes.rgb.map(c => c.color);
        let quantizePalette = false;
        // if (outPalette.length > limit && palettes.colorMap) {
        //      quantizePalette = true;
        //     let quantizedPalette = palettes.colorMap.palette();
        //     console.log('Using quantized Palette', { len: quantizedPalette.length })
        //     if (useHexPalette) {
        //         outPalette = <string[]>quantizedPalette.map((p: RgbPixel) => getHex(p));
        //     } else {
        //         outPalette = <number[][]>quantizedPalette;
        //     }
        // } else {
        //     console.log({ quantized: false, colorMap: palettes.colorMap })
        // }
        // console.log({ outPaletteLen: outPalette.length, outPixelLen: outPixels.length });
        let linearCount = 0;
        const rows = _.reduce(frames, (memo: ImageRow[], frameData, frameIndex) => {
            // default to 15 FPS
            const duration = metadata?.delay?.[frameIndex] || Math.round(1000 / 3);

            // console.log({ duration, quantizePalette });

            for (let rowIndex = 0; rowIndex < client.height; rowIndex++) {
                const pixels = [];
                for (let col = 0; col < client.width; col++) {
                    let rgb = outPixels[linearCount];
                    if (quantizePalette && palettes.colorMap) {
                        rgb = palettes.colorMap.map(<RgbPixel>rgb);
                    }
                    if (useHexPalette) {
                        let hex = getHex(rgb);//.substring(2);
                        let idx = (<string[]>outPalette).indexOf(hex);
                        if (idx == -1) {
                            idx = 0;
                        }
                        pixels.push(idx);
                    } else {
                        let k = JSON.stringify(rgb);
                        let idx = palettes.rgb.findIndex(c => c.key === k);
                        if (idx == -1) {
                            idx = 0;
                        }
                        pixels.push(idx);
                    }
                    //console.log('final count: ' + linearCount + ' val: ' + rgb[linearCount]);
                    linearCount++;
                }
                const row = <ImageRow>{ row: rowIndex, frame: frameIndex, duration, pixels };
                // const row = pixels;
                memo.push(row)
            }
            return memo;
        }, []);
        console.log(`>> server returns ${path} with ${rows.length} rows over ${frames.length} frames and ${outPalette.length} palette colors`);
        // apply per-image duration override if set
        const perImageDuration = imageDurations?.[index];
        if (perImageDuration != null && perImageDuration > 0) {
            duration = perImageDuration;
        }
        // add extra metadata
        duration = duration || 10;
        brightness = brightness || 25;
        // console.log(metadata.delay);
        // console.log({ collapsed: collapsePixels(rows) });
        let durations = Array.isArray(metadata?.delay) && metadata.delay.length === frames.length
            ? metadata.delay
            : frames.length == 1 ? [0] : new Array(frames.length).fill(Math.round(1000 / 3));
        const output = {
            success: true,
            msg: 'loaded',
            data: <PixelImageData>{
                meta: {
                    path,
                    duration,
                    brightness,
                    backgroundColor: backgroundColor.substring(1),
                    frames: frames.length,
                    durations,
                    width: client.width,
                    height: client.height,
                    paletteLength: outPalette.length ? outPalette.length : 0
                },
                palette: outPalette,
                rows
            }
        };
        return output;
    });
}
function getPalettes(pixels: number[][], limit: number): ImagePalettes {
    let result: ImagePalettes = { hex: [], rgb: [] };
    for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        let clr = getHex(p);
        if (result.hex.indexOf(clr) == -1) {
            // if (result.hex.length < limit) {
            result.hex.push(clr);
            //}
        }
        let k = JSON.stringify(p);
        if (result.rgb.findIndex(r => r.key == k) == -1) {
            // rgb is used for realtime stream, no need to limit palette
            //if (result.rgb.length < limit)
            result.rgb.push({ key: k, color: [p[0], p[1], p[2]] })
        }
    }
    result.colorMap = quantize(<quantize.RgbPixel[]>pixels, limit);
    return result;
}

function getHex(p: number[]) {
    let r = p[0].toString(16);
    r = r.length == 2 ? r : '0' + r;
    let g = p[1].toString(16);
    g = g.length == 2 ? g : '0' + g;
    let b = p[2].toString(16);
    b = b.length == 2 ? b : '0' + b;
    //let a = pxl[3].toString(16);
    //a = a.length == 2 ? a : '0' + a;
    return r + g + b;// + a;
}
function getColorDistance(rgb1: number[], rgb2: number[]) {
    const dr = rgb1[0] - rgb2[0];
    const dg = rgb1[1] - rgb2[1];
    const db = rgb1[2] - rgb2[2];
    // Use the Pythagorean theorem to calculate distance
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function lin(c: number) { return linearToByte(srgbToLinear(c)); }
function srgbToLinear(c: number) {
    c /= 255;
    return c <= 0.04045
        ? c / 12.92
        : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToByte(c: number) {
    return Math.round(c * 255);
}

function collapsePixels(pixelRows: ImageRow[]) {
    let currentPalette = -257;
    let paletteStart = -1;
    let collapsed = [];
    let pixelId = 0;
    for (let y = 0; y < pixelRows.length; y++) {
        for (let x = 0; x < pixelRows[y].pixels.length; x++) {
            let pixelPalette = pixelRows[y].pixels[x];
            if (currentPalette != pixelPalette) {
                if (currentPalette != null) {
                    let stop = pixelId - 1;
                    if (stop <= paletteStart) {
                        collapsed.push(-currentPalette);
                    } else {
                        collapsed.push(paletteStart);
                        collapsed.push(pixelId - 1);
                        collapsed.push(-currentPalette);
                    }
                    paletteStart = -1;
                } else {
                    paletteStart = pixelId;
                }
                currentPalette = pixelPalette;
            }
            pixelId++;
        }
    }
    if (paletteStart != -1) {
        let end = (pixelRows.length * pixelRows[0].pixels.length) - 1;
        if (end === paletteStart) {
            collapsed.push(-currentPalette);
        } else {
            collapsed.push(paletteStart);
            collapsed.push(end);
            collapsed.push(-currentPalette);
        }
    }
    return collapsed;
}
