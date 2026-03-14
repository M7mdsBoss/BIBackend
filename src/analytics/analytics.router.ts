import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, requireAdmin } from '../middleware/auth.middleware';
import { getRequestsByAgent, getRequestsStatus, listRequests } from './analytics.service';

const listQuerySchema = z.object({
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(10),
  status:      z.enum(['new', 'in_progress', 'completed', 'canceled']).optional(),
  assigned_to: z.string().min(1).optional(),
});

export function createAnalyticsRouter(prisma: PrismaClient) {
  const router = Router();

  // All analytics routes require Admin role
  router.use(requireAdmin);

  // GET /analytics/requests/by-agent
  router.get('/requests/by-agent', async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getRequestsByAgent(prisma));
    } catch (err) {
      next(err);
    }
  });

  // GET /analytics/requests/status
  router.get('/requests/status', async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getRequestsStatus(prisma));
    } catch (err) {
      next(err);
    }
  });

  // GET /analytics/requests/list?page=1&limit=10&status=new&assigned_to=Alice
  router.get('/requests/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      res.json(await listRequests(prisma, parsed.data));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
