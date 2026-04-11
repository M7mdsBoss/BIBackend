import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { guard, AuthRequest } from '../middleware/auth.middleware';
import {
  MEMBER_ROLES,
  createMember,
  getMembers,
  getMemberById,
  updateMember,
  deleteMember,
} from './member.service';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
  phone: z.string().optional(),
  compoundIds: z.array(z.uuid()).min(1).optional(),
});

const assignSchema = z.object({
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
  compoundIds: z.array(z.uuid()).min(1).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(MEMBER_ROLES).optional(),
  compoundIds: z.array(z.uuid()).optional(),
});

export function createMemberRouter(prisma: PrismaClient) {
  const router = Router();

  // All member routes require OWNER role
  router.use(guard('OWNER'));

  // POST /api/v1/member
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

      const result = await createMember(prisma, req.user!.id, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/member
  router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const members = await getMembers(prisma, req.user!.id);
      res.json(members);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/member/:id
  router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const member = await getMemberById(prisma, req.user!.id, req.params.id as string);
      res.json(member);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/member/:id
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

      const result = await updateMember(prisma, req.user!.id, req.params.id as string, parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/member/:id
  router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await deleteMember(prisma, req.user!.id, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
