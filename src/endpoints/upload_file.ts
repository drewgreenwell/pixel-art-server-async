import { Request, Response } from "express";
import { ensureDirSync } from "fs-extra";
import { resolve } from "path";
import { Data, ImageFile } from "../utils/data.js";
import { addAnImagePath, addAnImageStat, returnAnImageStat, returnAnImageStatFromBuffer } from "../utils/get_image_stat.js";
import { UploadedFile } from "express-fileupload";
import { getImageData } from "../utils/get_image_data.js";

export async function uploadFile(req: Request, res: Response) {
  //console.log(req.files);

  if (!req.files || Object.keys(req.files).length === 0) {
    return res
      .status(400)
      .send({ success: false, error: "No files were uploaded." });
  }
  let uploadedFile: UploadedFile = <UploadedFile>req.files.file;
  if (!uploadedFile.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return res
      .status(400)
      .send({ success: false, error: "Must have an image extension!" });
  }
  if (!uploadedFile.mimetype.startsWith('image/')) {
    return res
      .status(400)
      .send({ success: false, error: "Must be an image!" });
  }

  const extIdx = uploadedFile.name.lastIndexOf('.');
  const ext = uploadedFile.name.substring(extIdx + 1).toLowerCase();
  const newName = uploadedFile.name.substring(0, extIdx + 1) + ext;
  const subdir = req.body.subdir;
  ensureDirSync(resolve(Data.basePath, `${Data.imageDirectoryPath}/${subdir ? subdir + "/" : ""}`));
  const shortPath = `${subdir ? subdir + "/" : ""}${newName}`;
  const newPath = resolve(Data.basePath, `${Data.imageDirectoryPath}/${shortPath}`);

  uploadedFile.mv(newPath, function (err) {
    if (err) return res.status(500).send(err);
    let imageFile: ImageFile = { path: shortPath, created: 0 };
    returnAnImageStat(imageFile).then((result) => {
      addAnImageStat(result);
      imageFile.created = result.created;
      addAnImagePath(imageFile);
      res.send({
        success: true,
        message: "File uploaded!",
        uid: newName,
        stats: result,
      });
    });
  });
}