import { Router, Response } from 'express';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, requireAdmin } from '../middleware/auth.middleware';

export function createUserRouter(prisma: PrismaClient) {
  const router = Router();

  router.get('/search', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const query = (req.query.q as string)?.trim() || '';

      const where = query
        ? {
            role: 'User',
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              { email: { contains: query, mode: 'insensitive' as const } },
              { generatedToken: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : { role: 'User' };

      const rawUsers = await prisma.user.findMany({ where, take: 5 });

      const users = rawUsers.map(({ password, ...rest }) => rest);

      res.json(users);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      console.error('Search error:', error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
