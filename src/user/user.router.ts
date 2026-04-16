import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, requireAdmin } from '../middleware/auth.middleware';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function createUserRouter(prisma: PrismaClient) {
  const router = Router();

  // GET /api/v1/user/search?q=...
  router.get('/search', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const query = (req.query.q as string)?.trim() || '';

      const where = query
        ? {
          role: 'CLIENT',
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { generatedToken: { contains: query, mode: 'insensitive' as const } },
          ],
        }
        : { role: 'CLIENT' };

      const rawUsers = await prisma.user.findMany({ where, take: 5 });
      const users = rawUsers.map(({ password, ...rest }) => rest);
      res.json(users);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      console.error('Search error:', error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/v1/user?page=1&limit=10
  router.get('/', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Invalid query parameters',
          errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      const { page, limit } = parsed.data;
      const skip = (page - 1) * limit;

      const [rawUsers, total] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'CLIENT' as any, confirmed: true },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where: { role: 'CLIENT' as any, confirmed: true } }),
      ]);

      const data = rawUsers.map(({ password, ...rest }) => rest);
      res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/user/:id
  router.get('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.id as string, role: 'CLIENT' as any },
      });
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      const { password, ...rest } = user;
      res.json(rest);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
