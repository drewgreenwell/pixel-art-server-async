import { Request, Response } from "express";
export declare function uploadFile(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
