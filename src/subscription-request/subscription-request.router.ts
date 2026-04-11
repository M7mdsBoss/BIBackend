import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { requireAdmin } from '../middleware/auth.middleware';
import { createSubscriptionRequest } from './subscription-request.service';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  campanyRole: z.string().min(1),
  plan: z.string().min(1),
  campany: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  totalBranches: z.string().optional(),
  chatVolume: z.string().optional(),
  aiIntegration: z.string().optional(),
  campanySize: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  acceptedAuthorize: z.boolean().optional(),
  acceptedTerms: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function createSubscriptionRequestRouter(prisma: PrismaClient) {
  const router = Router();

  // POST /api/v1/subscription-request
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const result = await createSubscriptionRequest(prisma, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/subscription-request
  router.get('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const { page, limit } = parsed.data;
      const skip = (page - 1) * limit;

      const [rawRecords, total] = await Promise.all([
        prisma.subscriptionRequest.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.subscriptionRequest.count(),
      ]);

      const data = rawRecords.map(({ password, ...rest }) => rest);
      res.json({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/subscription-request/:id
  router.get('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await prisma.subscriptionRequest.findUnique({
        where: { id: req.params.id as string },
      });

      if (!record) {
        res.status(404).json({ message: 'Subscription request not found' });
        return;
      }

      const { password, ...rest } = record;
      res.json(rest);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
