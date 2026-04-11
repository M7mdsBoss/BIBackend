import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { guard, AuthRequest } from '../middleware/auth.middleware';
import { createUnit, getUnits, getUnitById, updateUnit } from './unit.service';

const createSchema = z.object({
  name: z.string().min(1),
  compoundId: z.string().min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
});

export function createUnitRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(guard('ADMIN'));

  // POST /api/v1/unit
  router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      const result = await createUnit(prisma, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/unit?compoundId=...
  router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const compoundId = req.query.compoundId as string;
      if (!compoundId) {
        res.status(400).json({ message: 'compoundId query parameter is required' });
        return;
      }
      const result = await getUnits(prisma, compoundId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/unit/:id
  router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getUnitById(prisma, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/unit/:id
  router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      const result = await updateUnit(prisma, req.params.id as string, parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
