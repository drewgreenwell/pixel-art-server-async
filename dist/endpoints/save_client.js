import fsextra from 'fs-extra';
import _ from 'underscore';
const { writeJSONSync } = fsextra;
import { Data } from '../utils/data.js';
export function saveClient(clientData, overWriteFlag) {
    const existingClient = _.findWhere(Data.clients, { id: clientData.id });
    let updateToDisk = false;
    if (existingClient && overWriteFlag) {
        const mergedClient = {
            ...existingClient,
            ...clientData,
            pixels: clientData.width * clientData.height,
        };
        const pos = Data.clients.indexOf(existingClient);
        Data.clients.splice(pos, 1, mergedClient);
        console.log({ 'server clients': Data.clients });
        updateToDisk = true;
    }
    else if (!existingClient) {
        clientData.pixels = clientData.width * clientData.height;
        Data.clients.push(clientData);
        updateToDisk = true;
    }
    if (updateToDisk)
        writeJSONSync(Data.clientsFilePath, Data.clients, { spaces: 2 });
}
//# sourceMappingURL=save_client.js.map