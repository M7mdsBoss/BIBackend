import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, guard } from '../middleware/auth.middleware';
import {
  getSrsByCategory,
  GetSrsByCompound,
  GetSrsByUnit,
  getSrsStatus,
  listSrsRequests,
  listSrsUnitsAnalytics,
  resolveSrsCompoundBaseline,
  resolveSrsWhere,
} from './analytics.service';
 
const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(10),
  status:   z.enum(['Open', 'Closed', 'Work Completed', 'Cancelled']).optional(),
  category: z.string().min(1).optional(),
});

const unitsQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  sort:   z.enum(['asc', 'desc']).default('desc'),
  period: z.enum(['all', 'last7days', 'today']).default('all'),
  search: z.string().trim().min(1).optional(),
});

export function createAnalyticsRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(guard('CLIENT', 'OPERATION', 'MANAGER'));

  // GET /analytics/requests/by-agent
  router.get('/requests/by-agent', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const caller = { id: req.user!.id, role: req.user!.role, clientId: req.user!.clientId };
      const [scopedWhere, compoundLabelBySlug] = await Promise.all([
        resolveSrsWhere(prisma, caller.id, caller.role, caller.clientId),
        resolveSrsCompoundBaseline(prisma, caller),
      ]);
      const [byCategory, byCompound, byUnit] = await Promise.all([
        getSrsByCategory(prisma, scopedWhere),
        GetSrsByCompound(prisma, scopedWhere, compoundLabelBySlug),
        GetSrsByUnit(prisma, scopedWhere),
      ]);
      res.json({ byCategory, byCompound, byUnit });
    } catch (err) {
      next(err);
    }
  });

  // GET /analytics/requests/status
  router.get('/requests/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const scopedWhere = await resolveSrsWhere(prisma, req.user!.id, req.user!.role, req.user!.clientId);
      res.json(await getSrsStatus(prisma, scopedWhere));
    } catch (err) {
      next(err);
    }
  });

  // GET /analytics/requests/units?page=1&limit=10&sort=desc&search=tower
  router.get('/requests/units', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = unitsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      const caller = { id: req.user!.id, role: req.user!.role, clientId: req.user!.clientId };
      res.json(await listSrsUnitsAnalytics(prisma, caller, parsed.data));
    } catch (err) {
      next(err);
    }
  });

  // GET /analytics/requests/list?page=1&limit=10&status=Open&category=Plumbing
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
      const scopedWhere = await resolveSrsWhere(prisma, req.user!.id, req.user!.role, req.user!.clientId);
      res.json(await listSrsRequests(prisma, parsed.data, scopedWhere));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
