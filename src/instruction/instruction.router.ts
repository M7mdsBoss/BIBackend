import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../../prisma/generated/client';
import { AuthRequest, guard } from '../middleware/auth.middleware';
import {
  createInstruction,
  deleteInstruction,
  getInstructionById,
  getInstructions,
  updateInstruction,
} from './instruction.service';

const createSchema = z.object({
  instruction: z.string().min(1),
});

const updateSchema = z.object({
  instruction: z.string().min(1).optional(),
}).refine((d) => d.instruction !== undefined, {
  message: 'At least one field must be provided',
});

function resolveClientId(req: AuthRequest, res: Response): string | null {
  const clientId = req.user!.clientId;
  if (!clientId) {
    res.status(403).json({ message: 'not-onboard' });
    return null;
  }
  return clientId;
}

export function createInstructionRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(guard('CLIENT'));

  // POST /api/v1/instruction
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
      const clientId = resolveClientId(req, res);
      if (!clientId) return;
      const result = await createInstruction(prisma, clientId, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/instruction
  router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const clientId = resolveClientId(req, res);
      if (!clientId) return;
      res.json(await getInstructions(prisma, clientId));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/instruction/:id
  router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const clientId = resolveClientId(req, res);
      if (!clientId) return;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json(await getInstructionById(prisma, clientId, id as string));
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/instruction/:id
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
      const clientId = resolveClientId(req, res);
      if (!clientId) return;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json(await updateInstruction(prisma, clientId, id as string, parsed.data));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/instruction/:id
  router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const clientId = resolveClientId(req, res);
      if (!clientId) return;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json(await deleteInstruction(prisma, clientId, id as string));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
