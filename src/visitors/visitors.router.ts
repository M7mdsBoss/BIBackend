import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, guard } from '../middleware/auth.middleware';
import {
  createVisit,
  getVisitById,
  getVisitorStats,
  listVisits,
  listVisitsByUnit,
} from './visitors.service';

const createVisitSchema = z.object({
  residentFullName:    z.string().min(1),
  residentUnit:        z.string().min(1),   // Unit.slug  → UNIT_*
  residentPhone:       z.string().min(1),
  visitorFullName:     z.string().min(1),
  visitorId:           z.string().min(1),
  visitDate:           z.coerce.date(),
  visitTime:           z.string().min(1),
  compound:            z.string().min(1),   // Compound.slug → COMP_*
  pdfUrl:              z.url().optional(),
  qrCode:              z.string().optional(),
});

const listQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  unit:  z.string().min(1).optional(),
  sort:  z.enum(['asc', 'desc']).default('desc'),
});

const unitsQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  sort:   z.enum(['asc', 'desc']).default('desc'),
  period: z.enum(['all', 'last7days', 'today']).default('all'),
  search: z.string().trim().min(1).optional(),
});


export function createVisitorsRouter(prisma: PrismaClient) {
  const router = Router();

  // POST /api/v1/visitors  (public — clientId derived from compound)
  router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = createVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      const result = await createVisit(prisma, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/visitors/stats
  router.get('/stats', guard('CLIENT', 'SECURITY', 'MANAGER'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await getVisitorStats(prisma, {
        id: req.user!.id,
        role: req.user!.role,
        clientId: req.user!.clientId,
      }));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/visitors/units?page=1&limit=10&sort=desc&period=all&search=tower
  // Must be registered BEFORE /:id so the dynamic param doesn't capture it.
  router.get('/units', guard('CLIENT', 'SECURITY', 'MANAGER'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = unitsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      res.json(await listVisitsByUnit(prisma, {
        id: req.user!.id,
        role: req.user!.role,
        clientId: req.user!.clientId,
      }, parsed.data));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/visitors/:id
  router.get('/:id', guard('CLIENT', 'SECURITY', 'MANAGER'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const visitId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json(await getVisitById(prisma, visitId));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/visitors?page=1&limit=10&unit=UNIT_*
  // CLIENT → their client's visits | SECURITY/MANAGER → visits for their assigned compounds
  router.get('/', guard('CLIENT', 'SECURITY', 'MANAGER'), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      res.json(await listVisits(prisma, parsed.data, {
        id: req.user!.id,
        role: req.user!.role,
        clientId: req.user!.clientId,
      }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
