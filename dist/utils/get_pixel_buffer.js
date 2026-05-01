import sharp from "sharp";
import _ from "underscore";
import { Data } from "./data.js";
import { returnAnImageStat, returnAnImageStatFromBuffer } from "./get_image_stat.js";
export async function getImgPixelsBuffer(img, imgData = null, client, background) {
    const size = client.width;
    //const background = client.background || "#000000";
    let promise = imgData ? returnAnImageStatFromBuffer(imgData, img) : returnAnImageStat({ path: img, created: 0 });
    return promise.then(async (metadata) => {
        if (metadata.pages > 1) {
            const operations = _.map(_.range(0, metadata.pages), async (page) => {
                const input = imgData ? imgData : `${Data.imageDirectoryPath}/${img}`;
                let image = sharp(input, { page: page, animated: true })
                    .keepMetadata()
                    //.withMetadata();
                    .toColourspace('srgb');
                if (metadata.width != client.width || metadata.height != client.height) {
                    image = image.resize(client.width, client.height, {
                        kernel: sharp.kernel.nearest
                        /*client.width < metadata.width
                          ? sharp.kernel.mks2021
                          : sharp.kernel.nearest,*/
                    });
                }
                image = image.ensureAlpha()
                    .gif({
                    colors: 64,
                    // interPaletteMaxError: 256,
                    //interFrameMaxError: 32,
                    dither: 0,
                    reuse: true,
                    progressive: true
                });
                //.flatten({ background });
                return await image.raw({ premultiplied: false })
                    .toBuffer({ resolveWithObject: true })
                    .then((result) => {
                    return { metadata, ...result };
                });
            });
            return await Promise.all(operations);
        }
        else {
            const input = imgData ? imgData : `${Data.imageDirectoryPath}/${img}`;
            let image = sharp(input)
                .keepMetadata()
                // .withMetadata()
                .toColourspace('srgb');
            if (metadata.width != client.width || metadata.height != client.height) {
                image = image.resize(client.width, client.height, {
                    kernel: sharp.kernel.nearest
                    /*client.width < metadata.width || client.height < metadata.height
                      ? sharp.kernel.lanczos3
                      : sharp.kernel.nearest,*/
                });
            }
            image = image.ensureAlpha()
                .toFormat(metadata.format, {
                colours: 64,
                // interPaletteMaxError: 256,
                dither: 0,
                palette: true,
                //interFrameMaxError
                quality: 80
            });
            // .flatten({ background: background })
            let result = await image.raw({ premultiplied: false })
                .toBuffer({ resolveWithObject: true })
                .then((r) => r);
            return [{ metadata, ...result }];
        }
    });
}
//# sourceMappingURL=get_pixel_buffer.js.map