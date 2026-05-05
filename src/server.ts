import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

import _ from 'underscore';
import { saveAllPlaylists } from './endpoints/save_all_playlists.js';
import { saveClient } from './endpoints/save_client.js'
import { replaceImageSet } from './endpoints/save_image_set.js';
import { uploadFile } from './endpoints/upload_file.js';
import { uploadJson } from './endpoints/upload_json.js';
import { getClients } from './endpoints/get_clients.js';
import { getImage } from './endpoints/get_image.js';
import { deletePlaylist } from './endpoints/delete_playlist.js';

import { getAllImageStats } from './utils/get_image_stat.js';
import { Data, PixelArtClient, PixelImageData } from './utils/data.js';
import { WledAppConfig } from './utils/data_wled.js';
import { LedAnimationApp } from './server-wled.js'
import dotenv from 'dotenv';
import { editFile } from './endpoints/edit_file.js';
import { deleteImage } from './endpoints/delete_image.js';
import { deleteClient } from './endpoints/delete_client.js';
// Load environment variables
dotenv.config();

const { json, urlencoded } = express;

const optionDefinitions = [
  {
    name: "port",
    type: Number,
    multiple: false,
    typeLabel: "<port number>",
    description: "server port - defaults to 80",
  },
  {
    name: "env",
    alias: "e",
    type: String,
    description: "environment - dev starts server on dev port (3001)",
  },
  { name: "help", type: Boolean },
];

const sections = [
  {
    header: "Pixel art server",
    content: "serves rgb values to multiple LED matrices.",
  },
  {
    header: "Options",
    optionList: optionDefinitions,
  },
];

const isLocalNetwork = (origin: string) => {
  if (!origin) return false;

  // Extract hostname from the origin URL
  const hostname = new URL(origin).hostname;

  // Check for common local/private IP ranges
  // This is a basic example; for a production-grade solution, consider a dedicated library.
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.')
  ) {
    return true;
  }
  return false;
};

const usage = commandLineUsage(sections);
const options = commandLineArgs(optionDefinitions);

//if (options.help) return console.log(usage);
const port = options["port"] ? options.port : options.env == "dev" ? 3001 : 80;

// init the data sources (clients, playlists)
new Data(import.meta.url);

console.log({ plpath: Data.playlistFilePath, clientsFilePath: Data.clientsFilePath })

var app = express();

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (isLocalNetwork(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS for non-local origin'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use("/", express.static("public"));
//var bodyParser = require("body-parser");

app.use(Data.staticImageBaseURL, express.static(Data.imageDirectoryPath));
// default options
app.use(fileUpload());
// Parse URL-encoded bodies (as sent by HTML forms)
app.use(urlencoded({ extended: true, limit: '40mb' }));
// Parse JSON bodies (as sent by API clients)
app.use(json({ type: "application/json", limit: '40mb' }));

// prime image cache - this returns a Promise
getAllImageStats();

app.post("/upload", uploadFile);

app.post("/edit-file", editFile);

app.post("/upload-json", uploadJson);

// app.post("/upload-wled", uploadWledJson);

app.get("/clients", getClients)

app.get("/imagesets", (req, res) => {
  res.send(Data.playlists);
});

// app.get("/drew", (req, res) => {
//   let d = { "drew": [] };
//   for (var i = 0; i < 5000; i++) {
//     d.drew.push(i);
//   }
//   res.send(d);
// });

// app.post("/drew", (req, res) => {
//   res.send({ d: 'drew', req: JSON.stringify(req.oi) })
// })

// sent by client on boot
app.get("/api/client/checkin", (req, res) => {
  const { width, height, clent_id, wled_host } = req.query;
  const h = parseInt('' + height);
  const w = parseInt('' + width);
  const pixelCount = w * h;
  const client: PixelArtClient = {
    id: '' + clent_id,
    pixels: parseInt('' + pixelCount),
    width: h,
    height: w
  };
  // only save if new     
  saveClient(client, false);
  // update config and restart if needed
  Data.wledConfig.client = client;
  const host = '' + wled_host;
  if (host && host != Data.wledConfig.host) {
    Data.wledConfig.host = '' + wled_host;
    const wledApp = getWledApp(false);
    if (wledApp?.started) {
      wledApp.stop();
      _wledApp = null;
      getWledApp(true)?.start();
    }
  }

  console.warn(`client '${clent_id}' checked in OK`);

  return res.send("ok");
});

app.post("/clients", function (req, res) {
  var clientData: PixelArtClient = _.pick(
    req.body,
    "id",
    "name",
    "width",
    "height",
    "pixels",
    "imagesetId"

  );
  if (!clientData.id) {
    return res.send({ success: false, error: "no client id supplied" });
  }
  clientData.pixels = clientData.width * clientData.height;
  saveClient(clientData, true);
  return res.send({ success: true });
});

app.delete("/clients/:id", deleteClient);

app.post("/imageset", replaceImageSet);

app.post("/imagesets", function (req, res) {
  saveAllPlaylists(req.body);
  res.send({ success: true });
});

app.delete("/delete-image", deleteImage);

app.delete("/imageset", deletePlaylist);

app.get("/api/image/pixels", getImage);

app.get("/images", async (req, res) => {
  res.send(await getAllImageStats());
});

/* Add WLED  */


let _wledApp: LedAnimationApp | null = null;

function getWledApp(init = true) {
  _wledApp = _wledApp || (init ? new LedAnimationApp(Data.wledConfig) : null);
  return _wledApp;
}

function startWledApp(autoPlay = true) {
  const wledApp = getWledApp();
  wledApp?.start(autoPlay);
}

function stopWledApp() {
  const wledApp = getWledApp(false);
  wledApp?.stop();
}

app.get("/wled/brightness", (req, res) => {
  let bri = clamp(+(req.query.brightness ?? 128), 0, 255);
  const wledApp = getWledApp(false);
  let result = false;
  if (wledApp) {
    wledApp?.setBrightness(bri);
    result = true;
  }
  res.send({ updated: result, brightness: bri });
});

/* 
/wled/start                   // forever
/wled/start?runFor=5          // 5 seconds
/wled/start?runForSeconds=-1  // forever
/wled/start?runForMs=5000     // 5 seconds
*/
app.get("/wled/start", async (req, res) => {
  const runForDef = parseInt('' + req.query.runFor);
  const runForSeconds = runForDef || parseInt('' + req.query.runForSeconds);
  const runForMs = parseInt('' + req.query.runForMs);
  let runFor = -1;
  if (!isNaN(runForSeconds) && runForSeconds > 0) {
    runFor = runForSeconds * 1000;
  }
  if (!isNaN(runForMs) && runForMs > 0) {
    runFor = runForMs;
  }
  if (runFor > 0) {
    startWledApp();
    setTimeout(() => {
      stopWledApp();
    }, runFor);
  } else {
    runFor = -1;
    startWledApp();
  }
  res.send({ started: true, runFor: runFor });
});

app.get("/wled/stop", async (req, res) => {
  stopWledApp();
  res.send({ started: false });
});


app.post("/wled/show-image", async (req, res) => {
  let imgData: PixelImageData = req.body;
  let result = false;
  if (!imgData || !imgData.meta || !imgData.rows) {
    return res.send({ loaded: false, error: 'invalid image data' });
  }
  stopWledApp();
  let wledApp = getWledApp(true);
  if (wledApp) {
    wledApp.loadImageData(imgData);
    result = true;
    startWledApp(false);
  }
  res.send({ loaded: result });
});

app.get("/wled/show-image", async (req, res) => {
  let path = '' + req.query.name;
  let result = false;
  stopWledApp();
  let wledApp = getWledApp(true);
  if (wledApp) {
    result = await wledApp.loadImage(path);
    if (result) {
      startWledApp(false);
    }
  }
  res.send({ loaded: result });
})

app.listen(port, () =>
  console.log(`server app listening at http://localhost:${port}`)
);

// wledApp.start();

process.on('SIGINT', () => {
  console.log('Shutting down...');
  stopWledApp();
  process.exit(0);
});


/**
 * Helper to parse environment variables with type safety
 * @param name - Environment variable name
 * @param defaultValue - Default value if environment variable is not set
 * @returns Parsed environment variable value
 */
function getEnvValue<T>(name: string, defaultValue: T): T {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }

  // Type conversion based on default value type
  if (typeof defaultValue === 'number') {
    return Number(value) as unknown as T;
  }

  return value as unknown as T;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}


