import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const status: number = err.status ?? err.statusCode ?? 500;
  const message: string = status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.path}`, err);
  }

  res.status(status).json({ message });
}
