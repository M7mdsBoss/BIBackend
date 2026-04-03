import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, requireAdmin } from '../middleware/auth.middleware';
import { getVisitorStats, listVisits } from './visitors.service';

const listQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  unit:  z.string().min(1).optional(),
});

export function createVisitorsRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(requireAdmin);

  // GET /api/v1/visitors/stats
  router.get('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getVisitorStats(prisma));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/visitors?page=1&limit=10&unit=B-204
  router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      res.json(await listVisits(prisma, parsed.data));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
