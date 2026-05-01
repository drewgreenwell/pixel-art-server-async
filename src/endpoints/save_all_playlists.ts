import fsextra from 'fs-extra';
const { writeJSONSync } = fsextra;
import { Data, Playlist } from "../utils/data.js";

export function saveAllPlaylists(playlists: Playlist[]) {
  console.log("saveAllPlaylists", playlists.length);
  writeJSONSync(Data.playlistFilePath, playlists, { spaces: 2 });
  Data.playlists = playlists;
}
