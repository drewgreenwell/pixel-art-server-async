import { Request, Response } from "express";
import fsextra from 'fs-extra';
const { writeJSONSync } = fsextra;
import { Data, Playlist } from "../utils/data.js";
import _ from "underscore";

export function replaceImageSet(req: Request, res: Response) {
  console.log('app.post("/imageset"', req.body);
  const imagesetData: Playlist = {
    id: parseInt('' + req.body.id),
    name: '' + req.body.name,
    duration: parseInt('' + req.body.duration),
    brightness: parseInt('' + req.body.brightness),
    images: req.body.images,
    backgroundColor: req.body.backgroundColor
  };
  _.pick(
    req.body,
    "id",
    "name",
    "duration",
    "brightness",
    "images"
  );
  if (!imagesetData.id) {
    res.send({ success: false, error: "no client id supplied" });
    return;
  }
  saveImageset(imagesetData, true);
  res.send({ success: true });
}

// saves to disk and updates cache in memory
function saveImageset(imagesetData: Playlist, overWriteFlag: boolean) {
  let existingImageset = _.findWhere(Data.playlists, { id: imagesetData.id });
  let updateToDisk = false;
  if (existingImageset && overWriteFlag) {
    const pos = Data.playlists.indexOf(existingImageset);
    Data.playlists.splice(pos, 1, imagesetData);
    console.log({ playlists: Data.playlists });
    updateToDisk = true;
  } else if (!existingImageset) {
    Data.playlists.push(imagesetData);
    updateToDisk = true;
  }
  if (updateToDisk) writeJSONSync(Data.playlistFilePath, Data.playlists, { spaces: 2 });
}