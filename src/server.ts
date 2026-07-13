import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

import _ from 'underscore';
import { saveAllPlaylists } from './endpoints/save_all_playlists.js';
import { saveClient } from './endpoints/save_client.js';
import { replaceImageSet } from './endpoints/save_image_set.js';
import { uploadFile } from './endpoints/upload_file.js';
import { uploadJson } from './endpoints/upload_json.js';
import { getClients } from './endpoints/get_clients.js';
import { getImage } from './endpoints/get_image.js';
import { deletePlaylist } from './endpoints/delete_playlist.js';

import { getAllImageStats } from './utils/get_image_stat.js';
import { Data, PixelArtClient, PixelImageData } from './utils/data.js';
import { WledAppConfig } from './utils/data_wled.js';
import { LedAnimationApp } from './server-wled.js';
import dotenv from 'dotenv';
import { editFile } from './endpoints/edit_file.js';
import { deleteImage } from './endpoints/delete_image.js';
import { deleteClient } from './endpoints/delete_client.js';
// Load environment variables
dotenv.config();

const { json, urlencoded } = express;

const optionDefinitions = [
  {
    name: 'port',
    type: Number,
    multiple: false,
    typeLabel: '<port number>',
    description: 'server port - defaults to 80',
  },
  {
    name: 'env',
    alias: 'e',
    type: String,
    description: 'environment - dev starts server on dev port (3001)',
  },
  { name: 'help', type: Boolean },
];

const sections = [
  {
    header: 'Pixel art server',
    content: 'serves rgb values to multiple LED matrices.',
  },
  {
    header: 'Options',
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
const port = options['port'] ? options.port : options.env == 'dev' ? 3001 : 80;

// init the data sources (clients, playlists)
new Data(import.meta.url);

console.log({ plpath: Data.playlistFilePath, clientsFilePath: Data.clientsFilePath });

var app = express();

// Chrome's Private Network Access policy requires this header on preflight responses
// when the page origin (e.g. localhost:5173) requests a private IP (e.g. 192.168.x.x).
// Must be set BEFORE cors() runs, since cors() calls res.end() on OPTIONS preflights.
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (isLocalNetwork(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS for non-local origin'));
    }
  },
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use('/', express.static('ui-dist'));
//var bodyParser = require("body-parser");

app.use(Data.staticImageBaseURL, express.static(Data.imageDirectoryPath));
// default options
app.use(fileUpload());
// Parse URL-encoded bodies (as sent by HTML forms)
app.use(urlencoded({ extended: true, limit: '40mb' }));
// Parse JSON bodies (as sent by API clients)
app.use(json({ type: 'application/json', limit: '40mb' }));

// prime image cache - this returns a Promise
getAllImageStats();

app.post('/upload', uploadFile);

app.post('/edit-file', editFile);

app.post('/upload-json', uploadJson);

// app.post("/upload-wled", uploadWledJson);

app.get('/clients', getClients);

app.get('/imagesets', (req, res) => {
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

function parsePort(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function parseDimension(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function getClientSocketRegistrationError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (message.includes('do not match canonical canvas')) {
    return {
      status: 400,
      error: `client dimensions mismatch configured canvas: ${message}`,
    };
  }

  return { status: 500, error: 'failed to initialize client socket' };
}

async function registerClientSocket(client: PixelArtClient): Promise<void> {
  const wledApp = getWledApp(false);
  if (!wledApp) {
    return;
  }
  await wledApp.addClient(client, client.wledHost, client.wledPort);
}

async function registerAllClientSockets(wledApp: LedAnimationApp): Promise<void> {
  for (const client of Data.clients) {
    try {
      await wledApp.addClient(client, client.wledHost, client.wledPort);
    } catch (err) {
      console.error(`Failed to register client '${client.id}'`, err);
    }
  }
}

// sent by client on boot
app.get('/api/client/checkin', async (req, res) => {
  const clientId = asOptionalString(req.query.client_id ?? req.query.clent_id);
  const width = parseDimension(req.query.width);
  const height = parseDimension(req.query.height);

  if (!clientId) {
    return res.status(400).send({ success: false, error: 'client_id (or clent_id) is required' });
  }
  if (!width || !height) {
    return res.status(400).send({ success: false, error: 'width and height must be positive integers' });
  }

  const existingClient = Data.clients.find((c) => c.id === clientId);
  const checkinHost = asOptionalString(req.query.wled_host ?? req.query.wledHost);
  const checkinPort = parsePort(req.query.wled_port ?? req.query.wledPort);

  const resolvedHost = checkinHost ?? existingClient?.wledHost;
  const resolvedPort = checkinPort ?? existingClient?.wledPort;

  if (!resolvedHost || !resolvedPort) {
    return res.status(400).send({ success: false, error: 'wled_host and wled_port are required' });
  }

  const client: PixelArtClient = {
    id: clientId,
    name: existingClient?.name,
    pixels: width * height,
    width,
    height,
    wledHost: resolvedHost,
    wledPort: resolvedPort,
    imagesetId: existingClient?.imagesetId,
  };
  saveClient(client, true);
  Data.wledConfig.client = client;

  try {
    await registerClientSocket(client);
    const wledApp = getWledApp(false);
    if (wledApp && !wledApp.started) {
      await startWledApp();
    }
  } catch (err) {
    console.error(`Failed to add client '${client.id}'`, err);
    const registrationError = getClientSocketRegistrationError(err);
    return res.status(registrationError.status).send({ success: false, error: registrationError.error });
  }

  console.warn(`client '${clientId}' checked in OK`);

  return res.send('ok');
});

app.post('/clients', async function (req, res) {
  const postedClient = _.pick(
    req.body,
    'id',
    'name',
    'width',
    'height',
    'pixels',
    'imagesetId',
    'wledHost',
    'wledPort',
  );

  const id = asOptionalString(postedClient.id);
  const width = parseDimension(postedClient.width);
  const height = parseDimension(postedClient.height);
  const wledHost = asOptionalString(postedClient.wledHost);
  const wledPort = parsePort(postedClient.wledPort);
  const imagesetId =
    postedClient.imagesetId === undefined || postedClient.imagesetId === null || postedClient.imagesetId === ''
      ? undefined
      : Number(postedClient.imagesetId);

  if (!id) {
    return res.status(400).send({ success: false, error: 'no client id supplied' });
  }
  if (!width || !height) {
    return res.status(400).send({ success: false, error: 'width and height must be positive integers' });
  }
  if (!wledHost) {
    return res.status(400).send({ success: false, error: 'wledHost is required' });
  }
  if (!wledPort) {
    return res.status(400).send({ success: false, error: 'wledPort must be an integer between 1 and 65535' });
  }

  const clientData: PixelArtClient = {
    id,
    name: asOptionalString(postedClient.name),
    width,
    height,
    pixels: width * height,
    wledHost,
    wledPort,
    imagesetId: Number.isInteger(imagesetId) ? imagesetId : undefined,
  };

  saveClient(clientData, true);

  try {
    await registerClientSocket(clientData);
  } catch (err) {
    console.error(`Failed to add client '${clientData.id}'`, err);
    const registrationError = getClientSocketRegistrationError(err);
    return res.status(registrationError.status).send({ success: false, error: registrationError.error });
  }

  return res.send({ success: true });
});

app.delete('/clients/:id', (req, res) => {
  const { id } = req.params;
  const hadClient = Data.clients.some((c) => c.id === id);
  deleteClient(req, res);
  if (hadClient) {
    getWledApp(false)?.removeClient(id);
  }
});

app.post('/imageset', replaceImageSet);

app.post('/imagesets', function (req, res) {
  saveAllPlaylists(req.body);
  res.send({ success: true });
});

app.delete('/delete-image', deleteImage);

app.delete('/imageset', deletePlaylist);

app.get('/api/image/pixels', getImage);

app.get('/images', async (req, res) => {
  res.send(await getAllImageStats());
});

/* Add WLED  */

let _wledApp: LedAnimationApp | null = null;

function getWledApp(init = true) {
  _wledApp = _wledApp || (init ? new LedAnimationApp(Data.wledConfig) : null);
  return _wledApp;
}

async function startWledApp(autoPlay = true) {
  const wledApp = getWledApp();
  if (!wledApp) {
    return;
  }
  await registerAllClientSockets(wledApp);
  await wledApp.start(autoPlay);
}

function stopWledApp() {
  const wledApp = getWledApp(false);
  wledApp?.stop();
}

app.get('/wled/brightness', async (req, res) => {
  let bri = clamp(+(req.query.brightness ?? 128), 0, 255);
  let targetIds: string[] | undefined;
  if (req.query.targetId) {
    // Handle the case where targetId might be a string or array of strings
    if (Array.isArray(req.query.targetId)) {
      targetIds = req.query.targetId as string[];
    } else if (typeof req.query.targetId === 'string') {
      targetIds = req.query.targetId.split(',');
    }
  }
  const wledApp = getWledApp(false);
  let result = false;
  let failed: { id: string; error: string }[] = [];
  if (wledApp) {
    const brightnessResult = await wledApp.setBrightness(bri, targetIds);
    failed = brightnessResult.failed;
    result = true;
  }
  res.send({ updated: result, brightness: bri, failed });
});

/* 
/wled/start                   // forever
/wled/start?runFor=5          // 5 seconds
/wled/start?runForSeconds=-1  // forever
/wled/start?runForMs=5000     // 5 seconds
*/
app.get('/wled/start', async (req, res) => {
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
    await startWledApp();
    setTimeout(() => {
      stopWledApp();
    }, runFor);
  } else {
    runFor = -1;
    await startWledApp();
  }
  res.send({ started: true, runFor: runFor });
});

app.get('/wled/stop', async (req, res) => {
  stopWledApp();
  res.send({ started: false });
});

app.post('/wled/show-image', async (req, res) => {
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
    await startWledApp(false);
  }
  res.send({ loaded: result });
});

app.get('/wled/show-image', async (req, res) => {
  let path = '' + req.query.name;
  let result = false;
  stopWledApp();
  let wledApp = getWledApp(true);
  if (wledApp) {
    result = await wledApp.loadImage(path);
    if (result) {
      await startWledApp(false);
    }
  }
  res.send({ loaded: result });
});

app.listen(port, () => console.log(`server app listening at http://localhost:${port}`));

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
