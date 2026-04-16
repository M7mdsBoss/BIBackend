import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "../../prisma/generated/client";
import {
  requireAdmin,
  AuthRequest,
} from "../middleware/auth.middleware";
import {
  createClient,
  getClients,
  getClientById,
} from "./client.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const adminCreateSchema = z.object({
  clientName: z.string().min(1),
  address: z.string().optional(),
  crNb: z.string().optional(),
  contact: z.string().optional(),
  domainName: z.string().optional(),
  website: z.string().optional(),
  note: z.string().optional(),
});

const listQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function createClientRouter(prisma: PrismaClient) {
  const router = Router();

  router.post(
    "/",
    requireAdmin,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const parsed = adminCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
          return;
        }
        const result = await createClient(prisma, parsed.data);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/",
    requireAdmin,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          res.status(400).json({
            message: 'Validation failed',
            errors: parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
          });
          return;
        }
        res.json(await getClients(prisma, parsed.data.page, parsed.data.limit));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/:id",
    requireAdmin,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        res.json(await getClientById(prisma, req.params.id as string));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
