import { Request, Response } from "express";
export declare function uploadJson(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
