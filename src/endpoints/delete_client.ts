import fsextra from 'fs-extra';
const { writeJSONSync } = fsextra;
import { Request, Response } from "express";
import { Data } from "../utils/data.js";

export function deleteClient(req: Request, res: Response) {
  const id = req.params.id;
  const idx = Data.clients.findIndex((c) => c.id === id);
  if (idx === -1) {
    return res.status(404).send({ success: false, error: "client not found" });
  }
  Data.clients.splice(idx, 1);
  writeJSONSync(Data.clientsFilePath, Data.clients, { spaces: 2 });
  return res.send({ success: true });
}
