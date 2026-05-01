import _ from 'underscore';
import { Request, Response } from "express";
import { Data, PixelArtClient } from '../utils/data.js';
import { getImageData } from '../utils/get_image_data.js';
import { getImgPixelsBuffer } from '../utils/get_pixel_buffer.js';
// import quantize from 'quantize';
// import * as palette from 'image-palette';

export async function getImage(req: Request, res: Response) {
  let { client_id: id, width = 8, height = 8, paletteLength = 0, image_path = null } = req.query;
  width = parseInt('' + width);
  height = parseInt('' + height);
  paletteLength = parseInt('' + paletteLength);
  let client: PixelArtClient | null = _.find(Data.clients, (c) => c.id == id) ?? null;
  if (!client) {
    console.warn(`client '${id}' not found, using default client`);
    // res.send(JSON.stringify({warning: id ? 'client not found' : 'need client param'}));
    // return;
    client = structuredClone(Data.clients[0]);
  }
  client.width = parseInt('' + width);
  client.height = parseInt('' + height);
  paletteLength = parseInt('' + paletteLength);
  image_path = image_path != null && ('' + image_path).length ? '' + image_path : null;
  const imageData = await getImageData(client, paletteLength, /* useHexPalette */ true, image_path = image_path, null);
  if (!imageData.success) {
    res.send(imageData.msg);
  } else {
    res.removeHeader('transfer-encoding');
    res.contentType("application/json");
    res.send(JSON.stringify(imageData.data));
  }
};

