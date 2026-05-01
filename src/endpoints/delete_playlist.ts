import _ from 'underscore';
import { Request, Response } from 'express';
import { saveAllPlaylists } from './save_all_playlists.js';
import { Data, Playlist } from '../utils/data.js';

export function deletePlaylist(req: Request, res: Response) {
  console.log("Got a DELETE request at /imageset");
  const uid = req.body.uid;
  Data.playlists = _.reject(Data.playlists, (imageset) => imageset.id == uid);
  saveAllPlaylists(Data.playlists);
  res.send({ success: true, message: "imageset removed" });
}
