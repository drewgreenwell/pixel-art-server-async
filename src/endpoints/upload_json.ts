import { Request, Response } from "express";
import sharp, { CreateRaw } from "sharp";
import { ensureDirSync } from "fs-extra";
import { resolve } from "path";
import { Data, ImageFile, ImageRow, ImageStat, PixelImageData } from "../utils/data.js";
import { addAnImagePath, addAnImageStat, returnAnImageStat } from "../utils/get_image_stat.js";
import { Jimp } from "jimp";
import { GifUtil, GifFrame, Gif } from "gifwrap";

// { newname: '', subdir:'', data: PixelImageData }
export async function uploadJson(req: Request, res: Response) {

  // validate 
  let { newname, subdir, data: d } = req.body;
  let data = <PixelImageData>d;
  // console.log({ newname, subdir, data });
  if (newname == null || !newname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return res
      .status(400)
      .send({ success: false, newname, error: "newname must have an image extension!" });
  }

  if (!data || !data.meta || !data.palette || !Array.isArray(data.palette) || !data.rows || !Array.isArray(data.rows)) {
    return res
      .status(400)
      .send({ success: false, error: "data is not formatted correctly, see api/image/pixels" });
  }

  // create image
  const frames = data.meta.frames;
  const width = data.meta.width;
  const height = data.meta.height;
  const pxlHeight = data.meta.height * frames;
  const channels = 4; // RGBA for transparency support
  const background = { r: 0, g: 0, b: 0, alpha: 1 }; // black background
  const animated = frames > 1;
  const delays = data.meta.durations;
  // if (animated) {
  //   for (let i = 0; i < frames; i++) {
  //     delays.push(+data.rows[i * height].duration);
  //   }
  // }
  let ogFormat = newname.substring(newname.lastIndexOf('.') + 1);
  let imageFormat = ogFormat.toLowerCase();
  if (frames > 1) {
    imageFormat = "gif";
    // avoid duplicating files added directly to filesystem
    // todo: webp / jxl / apng should all be fine, probably best to settle on jxl or webp for size
    const nameFormat = (ogFormat == 'GIF' ? 'GIF' : 'gif');
    newname = newname.substring(0, newname.lastIndexOf('.') + 1) + nameFormat;
    console.log('updatd name to: ' + newname);
  } else if (imageFormat == "jpg") {
    imageFormat = "jpeg";
  }
  const pixels = new Uint8Array(data.rows.map((r: ImageRow) => {
    return r.pixels.map((p) => {
      let hex = (<string[]>data.palette)[p];
      let rgb = hexToRgb(hex);
      // console.log(rgb)
      let a = rgb.r + rgb.g + rgb.b == 0 ? 0 : 255;
      return [rgb.r, rgb.g, rgb.b, 255];
    }).flat()
  }).flat());
  console.log({ pl: pixels.length, bl: height * width * channels });
  // save
  const imageFolder = resolve(Data.basePath, `${Data.imageDirectoryPath}/${subdir ? subdir + "/" : ""}`);
  ensureDirSync(imageFolder);
  const shortPath = `${subdir ? subdir + "/" : ""}${newname}`;
  const newPath = resolve(Data.basePath, `${Data.imageDirectoryPath}/${shortPath}`);



  let updatedImage = sharp(pixels, { // pixels.length == 8192
    pages: frames,  // 2
    animated: animated,  // true
    raw: <CreateRaw>{
      width: width, // 32
      height: pxlHeight, // height * frames
      channels: channels, // 4
      background: background,
      pageHeight: height // 32
    }
  })
    .toFormat(animated ? "gif" : imageFormat, {
      delay: animated ? delays : 0,
      loop: 0
    });
  await updatedImage.toFile(newPath, (err => {
    if (err) {
      console.error("toFile failed!", err);
      return res.status(500).send(err);
    }
    let imageFile: ImageFile = { path: shortPath, created: 0 };
    returnAnImageStat(imageFile).then((result) => {
      addAnImageStat(result);
      imageFile.created = result.created;
      addAnImagePath(imageFile);
      res.send({
        success: true,
        message: "JSON uploaded!",
        uid: newname,
        stat: result,
      })
    });
  }))
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  // console.log({ hex, result })
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}