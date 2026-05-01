import { Request, Response } from "express";
import { Data } from "../utils/data.js";


export function getClients(req: Request, res: Response) {
    res.send(Data.clients);
};