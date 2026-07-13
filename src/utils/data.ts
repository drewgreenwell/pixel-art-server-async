import fsextra from 'fs-extra';
const { readJSONSync, existsSync } = fsextra;
import { resolve } from 'path';
import { OutputInfo } from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Led, WledAppConfig } from './data_wled.js';
import quantize from 'quantize';

export interface RawImage {
  data: Buffer;
  info: OutputInfo;
}

export interface PixelBuffer extends RawImage {
  metadata: ImageStat;
}

export interface ImageFile {
  path: string;
  created: number;
}

export interface ImageStat extends ImageFile {
  id: string;
  /* sharp metadata */
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  pages: number;
  delay: number[];
}

export interface PixelArtClient {
  id: string;
  name?: string;
  pixels: number;
  width: number;
  height: number;
  wledHost: string;
  wledPort: number;
  imagesetId?: number;
}

export interface Playlist {
  id: number;
  name: string;
  images: string[];
  duration: number;
  brightness: number;
  backgroundColor: string;
  imageDurations?: (number | null)[];
}

export interface ImageRow {
  row: number;
  frame: number;
  duration: number;
  pixels: number[];
}
export interface PixelImageData {
  meta: {
    path: string;
    duration: number;
    brightness: number;
    backgroundColor: string;
    frames: number;
    width: number;
    height: number;
    paletteLength: number;
    durations: number[];
  };
  palette: string[] | Led[];
  rows: ImageRow[];
}

export interface ImageDataResponse {
  msg: string;
  success: boolean;
  data?: PixelImageData;
}

function getEnvString(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length ? value.trim() : fallback;
}

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim().length) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export class Data {
  static staticImageBaseURL = '/image-preview';
  static clients: PixelArtClient[] = [];
  static playlists: Playlist[] = [];
  static imageDirectoryPath: string;
  static playlistFilePath: string;
  static clientsFilePath: string;
  static basePath: string;

  /**
   * Default configuration loaded from environment variables
   */
  // const wledConfig: WledAppConfig = {
  //   host: getEnvValue('WLED_HOST', '192.168.1.18'),
  //   port: getEnvValue('WLED_PORT', 4048),
  //   ledCount: getEnvValue('LED_COUNT', 1024),
  //   updateInterval: getEnvValue('UPDATE_INTERVAL', 100),
  //   updateInterval: getEnvValue('IMAGE_INTERVAL', 10000),
  // };
  static wledConfig: WledAppConfig = {
    host: getEnvString('WLED_HOST', '127.0.0.1'),
    port: getEnvInt('WLED_PORT', 4048),
    updateInterval: getEnvInt('UPDATE_INTERVAL', 100),
    newImageInterval: getEnvInt('IMAGE_INTERVAL', 10000),
    client: {
      id: 'DefaultClient',
      height: 32,
      width: 32,
      pixels: 1024,
      wledHost: getEnvString('WLED_HOST', '127.0.0.1'),
      wledPort: getEnvInt('WLED_PORT', 4048),
    },
  };

  constructor(baseURL: string) {
    Data.basePath = dirname(fileURLToPath(baseURL));
    Data.imageDirectoryPath = resolve(Data.basePath, 'img');
    Data.playlistFilePath = resolve(Data.basePath, 'data/playlists.json');
    Data.clientsFilePath = resolve(Data.basePath, 'data/clients.json');

    if (existsSync(Data.playlistFilePath)) {
      Data.playlists = readJSONSync(Data.playlistFilePath);
    }
    if (existsSync(Data.clientsFilePath)) {
      const rawClients = readJSONSync(Data.clientsFilePath) as unknown;
      if (Array.isArray(rawClients)) {
        Data.clients = rawClients
          .map((client) => normalizeClient(client))
          .filter((client): client is PixelArtClient => client !== null);
      }
    }
    if (!Data.clients.length || !Array.isArray(Data.clients)) {
      Data.clients = [Data.wledConfig.client];
    }
  }
}

function normalizeClient(client: unknown): PixelArtClient | null {
  if (!client || typeof client !== 'object') {
    return null;
  }

  const raw = client as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const width = Number(raw.width);
  const height = Number(raw.height);
  const pixels = Number(raw.pixels);
  const wledHost = typeof raw.wledHost === 'string' ? raw.wledHost.trim() : '';
  const wledPort = Number(raw.wledPort);
  const imagesetIdValue = raw.imagesetId;

  const isValidDimension = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0;
  const isValidPort = Number.isInteger(wledPort) && wledPort > 0 && wledPort <= 65535;

  if (!id || !isValidDimension || !wledHost || !isValidPort) {
    console.warn('Skipping invalid client record in clients.json', raw);
    return null;
  }

  const normalizedPixels = Number.isInteger(pixels) && pixels > 0 ? pixels : width * height;
  const imagesetId =
    imagesetIdValue === undefined || imagesetIdValue === null || imagesetIdValue === ''
      ? undefined
      : Number(imagesetIdValue);

  return {
    id,
    name: name || undefined,
    pixels: normalizedPixels,
    width,
    height,
    wledHost,
    wledPort,
    imagesetId: Number.isInteger(imagesetId) ? imagesetId : undefined,
  };
}

export interface ImagePalettes {
  hex: string[];
  rgb: { key: string; color: number[] }[];
  colorMap?: quantize.ColorMap | false;
}
