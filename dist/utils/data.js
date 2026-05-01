import fsextra from 'fs-extra';
const { readJSONSync, existsSync } = fsextra;
import { resolve } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
export class Data {
    static staticImageBaseURL = "/image-preview";
    static clients = [];
    static playlists = [];
    static imageDirectoryPath;
    static playlistFilePath;
    static clientsFilePath;
    static basePath;
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
    static wledConfig = {
        host: '192.168.1.4',
        port: 4048,
        updateInterval: 100,
        newImageInterval: 10000,
        client: {
            id: 'DefaultClient',
            height: 32,
            width: 32,
            pixels: 1024
        }
    };
    constructor(baseURL) {
        Data.basePath = dirname(fileURLToPath(baseURL));
        Data.imageDirectoryPath = resolve(Data.basePath, 'img');
        Data.playlistFilePath = resolve(Data.basePath, 'data/playlists.json');
        Data.clientsFilePath = resolve(Data.basePath, "data/clients.json");
        if (existsSync(Data.playlistFilePath)) {
            Data.playlists = readJSONSync(Data.playlistFilePath);
        }
        if (existsSync(Data.clientsFilePath)) {
            Data.clients = readJSONSync(Data.clientsFilePath);
        }
        if (!Data.clients.length || !Array.isArray(Data.clients)) {
            Data.clients = [Data.wledConfig.client];
        }
    }
}
;
//# sourceMappingURL=data.js.map