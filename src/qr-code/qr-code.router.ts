import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../prisma/generated/client';
import { createVisit, getVisitById } from './qr-code.service';
import { validate } from '../middleware/validate';
import { createVisitSchema } from './qr-code.schemas';

export function createQrCodeRouter(prisma: PrismaClient) {
  const router = Router();

  router.post('/', validate(createVisitSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createVisit(prisma, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const visitId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const visit = await getVisitById(prisma, visitId);
      res.json(visit);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
