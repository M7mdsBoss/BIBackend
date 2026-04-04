import "dotenv/config";
import { PrismaClient } from "../prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { createAuthRouter } from "./auth/auth.router";
import { createQrCodeRouter } from "./qr-code/qr-code.router";
import { createAnalyticsRouter } from "./analytics/analytics.router";
import { createUserRouter } from "./user/user.router";
import { createContactRouter } from "./contact/contact.router";
import { createPdfRouter } from "./pdf/pdf.router";
import { createVisitorsRouter } from "./visitors/visitors.router";
import { startVisitCleanupCron } from "./qr-code/visit-cleanup.service";
import { errorHandler } from "./middleware/error-handler";
import { swaggerSpec } from "./swagger";

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

const app = express();

app.set("trust proxy", 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(hpp());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth requests, please try again later." },
});

// ── Documentation ─────────────────────────────────────────────────────────────
app.use(
  "/documentation",
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/v1/check-email", async (req, res) => {
  const email = (req.query.email as string)?.trim().toLowerCase();
  if (!email) {
    res.status(400).json({ message: "email query parameter is required" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  res.json({ available: !user });
});

app.use("/api/v1/auth", authLimiter, createAuthRouter(prisma));
app.use("/api/v1/qr-code", createQrCodeRouter(prisma));
app.use("/pdf", createPdfRouter());
app.use("/api/v1/analytics", createAnalyticsRouter(prisma));
app.use("/api/v1/user", createUserRouter(prisma));
app.use("/api/v1/contact", createContactRouter());
app.use("/api/v1/visitors", createVisitorsRouter(prisma));

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

// ── Cron jobs ─────────────────────────────────────────────────────────────────
startVisitCleanupCron(prisma);

app.listen(3003, () =>
  console.log(`
🚀 Server ready at: http://localhost:3003
`),
);
