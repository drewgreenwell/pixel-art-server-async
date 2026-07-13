import { WledAppConfig, WLEDDdpOptions, Led } from './utils/data_wled.js';
import { WLEDDdp } from './utils/wled_ddp.js';
import { PixelArtClient } from './utils/data.js';
import { ImageDataResponse, PixelImageData } from './utils/data.js';
import { getImageData } from './utils/get_image_data.js';
import { PixelImagePlayer } from './utils/pixel_image_player.js';

/**
 * Main application class for controlling LED animations
 */
export class LedAnimationApp {
  private readonly clients: Map<string, WLEDDdp> = new Map();
  private offset: number = 0;
  private lastPush: Date | null = null;
  private intervalId?: NodeJS.Timeout;
  private timeoutId?: NodeJS.Timeout;
  private readonly config: WledAppConfig;
  private currentImage: PixelImageData | null = null;
  private readonly pixelPlayer: PixelImagePlayer;

  public started: boolean = false;
  /**
   * Creates a new LED animation application
   * @param config - Application configuration
   */
  constructor(config: WledAppConfig) {
    this.config = config;
    this.pixelPlayer = new PixelImagePlayer(config.client, 10000);
    // Note: Individual client sockets are now added via addClient()
  }

  /**
   * Adds a new WLED client and starts tracking its connection
   * @param client - The pixel art client configuration
   * @param host - The hostname of the WLED device
   * @param port - The port for DDP communication
   */
  public async addClient(client: PixelArtClient, host: string, port: number): Promise<void> {
    const canvasWidth = this.config.client.width;
    const canvasHeight = this.config.client.height;
    if (client.width !== canvasWidth || client.height !== canvasHeight) {
      throw new Error(
        `Client '${client.id}' dimensions ${client.width}x${client.height} do not match canonical canvas ${canvasWidth}x${canvasHeight}`,
      );
    }

    if (this.clients.has(client.id)) {
      // Replace existing mapping when network target changes for a known client ID.
      const existing = this.clients.get(client.id);
      existing?.dispose();
      this.clients.delete(client.id);
    }
    const options: WLEDDdpOptions = {
      host: host,
      port: port,
      ledCount: client.pixels,
    };

    const socket = new WLEDDdp(options);
    this.clients.set(client.id, socket);
    await socket.initLeds();
  }

  /**
   * Removes a WLED client and its connection
   * @param clientId - The ID of the client to remove
   */
  public removeClient(clientId: string): void {
    const socket = this.clients.get(clientId);
    if (socket) {
      socket.dispose();
      this.clients.delete(clientId);
    }
  }

  /**
   * Animation update function called on each interval
   */
  private update(): void {
    let leds: Led[] = [];
    // make sure pixel data has really changed, no need to waste bandwidth
    if (this.lastPush != null && this.lastPush > this.pixelPlayer.lastDraw) {
      for (const socket of this.clients.values()) {
        socket.sendEmpty();
      }
      return;
    }
    if (this.pixelPlayer.image) {
      leds = this.pixelPlayer.currentPixels;
    } else {
      const maxLedCount = Math.max(
        this.config.client.pixels,
        ...Array.from(this.clients.values(), (socket) => socket.ledCount),
      );
      for (let i = 0; i < maxLedCount; i++) {
        leds.push([
          this.getRandomInt(0, 256),
          this.getRandomInt(0, 256),
          this.getRandomInt(0, 256),
        ]);
      }
    }

    for (const socket of this.clients.values()) {
      // Slice the LEDs array to the size required by this specific socket
      const socketLeds = leds.slice(0, socket.ledCount);
      socket.send(socketLeds);
    }
    this.lastPush = new Date();
  }

  // todo: output rgb palette as needed
  private hexToRgbLed(hex: string): Led {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    // console.log({ hex, result });
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  private getRandomInt(min: number, max: number): number {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (max - minCeiled) + minCeiled);
  }

  private async loadImageEvery(ms: number): Promise<void> {
    const image = await getImageData(
      this.config.client,
      512,
      /* useHexPalette */ false,
      /* imgPath */ null,
      /* imgData */ null,
    );
    if (image.success && image.data) {
      this.currentImage = image.data;
      this.pixelPlayer.loadImage(image.data, true);
    } else {
      console.log('Unable to load image!', image);
    }
    this.timeoutId = setTimeout(async () => await this.loadImageEvery(ms), ms);
  }

  /**
   * Starts the animation loop
   */
  public async start(autoPlay = true): Promise<void> {
    this.started = true;
    const init = () => {
      if (!this.intervalId) {
        // let interval = this.currentImage?.meta.duration ? this.currentImage.meta.duration : this.config.updateInterval;
        this.intervalId = setInterval(() => this.update(), this.config.updateInterval);
        console.log('Animation started');
      } else {
        console.log('Already started');
      }
    };
    if (autoPlay) {
      await this.loadImageEvery(this.config.newImageInterval);
    }
    init();
  }

  /**
   * Stops the animation loop
   */
  public stop(): void {
    this.started = false;
    for (const [clientId, socket] of this.clients.entries()) {
      socket.dispose();
      this.clients.delete(clientId);
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      clearTimeout(this.timeoutId);
      this.pixelPlayer.stop();
      this.intervalId = undefined;
      this.timeoutId = undefined;
      // eslint-disable-next-line no-console
      console.log('Animation stopped');
    }
  }

  public setBrightness(brightness: number, targetIds?: string[]): void {
    const targets = targetIds && targetIds.length > 0 ? targetIds : Array.from(this.clients.keys());
    for (const id of targets) {
      const socket = this.clients.get(id);
      if (socket) {
        socket.setBrightness(brightness);
      }
    }
  }

  public loadImage(path: string): Promise<boolean> {
    return getImageData(
      this.config.client,
      512,
      /* useHexPalette */ false,
      /* imgPath */ path,
      /* imgData */ null,
    )
      .then((image: ImageDataResponse) => {
        if (!image.data) return false;
        this.currentImage = image.data;
        this.pixelPlayer.loadImage(image.data, true);
        return true;
      })
      .catch((err) => {
        console.error(err);
        return false;
      });
  }

  public loadImageData(imgData: PixelImageData): void {
    this.currentImage = imgData;
    this.pixelPlayer.loadImage(imgData, true);
  }
}
