import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../prisma/generated/client";
import { getVisitById } from "./qr-code.service";
import { optionalAuth } from "../middleware/auth.middleware";

export function createQrCodeRouter(prisma: PrismaClient) {
  const router = Router();

  router.get(
    "/:id",
    optionalAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const visitId = Array.isArray(req.params.id)
          ? req.params.id[0]
          : req.params.id;
        const user = (req as any).user;
        const visit = await getVisitById(prisma, visitId, user);

        res.json(visit);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
