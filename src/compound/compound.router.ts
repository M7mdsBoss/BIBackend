import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { guard, AuthRequest } from '../middleware/auth.middleware';
import { createCompound, getCompounds, getCompoundById, updateCompound, getMyCompounds } from './compound.service';

const createSchema = z.object({
  name: z.string().min(1),
  ownerId: z.uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  ownerId: z.uuid().optional(),
});

export function createCompoundRouter(prisma: PrismaClient) {
  const router = Router();

  // GET /api/v1/compound/my  — OWNER only
  router.get('/my', guard('OWNER'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getMyCompounds(prisma, req.user!.id));
    } catch (err) {
      next(err);
    }
  });

  router.use(guard('ADMIN'));

  // POST /api/v1/compound
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
      const result = await createCompound(prisma, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/compound
  router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getCompounds(prisma);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/compound/:id
  router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getCompoundById(prisma, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/compound/:id
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
      const result = await updateCompound(prisma, req.params.id as string, parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
