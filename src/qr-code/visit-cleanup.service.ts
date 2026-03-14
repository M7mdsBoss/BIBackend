import * as cron from 'node-cron';
import * as fs from 'fs';
import { PrismaClient } from '../../prisma/generated/client';
import { getPdfPath } from './pdf.service';

function deleteFileSafely(visitId: string): void {
  const filePath = getPdfPath(visitId);
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw err;
    }
    console.warn(`[VisitCleanup] PDF not found for visit ${visitId}, skipping deletion.`);
  }
}

async function expireOldVisits(prisma: PrismaClient): Promise<void> {
  console.log('[VisitCleanup] Running visit expiration job...');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);

  const visits = await prisma.visit.findMany({
    where: {
      isExpired: false,
      visitDate: { lt: cutoff },
    },
    select: { id: true },
  });

  if (visits.length === 0) {
    console.log('[VisitCleanup] No expired visits found.');
    return;
  }

  console.log(`[VisitCleanup] Found ${visits.length} visit(s) to expire.`);

  let processed = 0;
  let failed = 0;

  for (const visit of visits) {
    try {
      deleteFileSafely(visit.id);

      await prisma.visit.update({
        where: { id: visit.id },
        data: { isExpired: true, updatedAt: new Date() },
      });

      processed++;
    } catch (err) {
      failed++;
      console.error(`[VisitCleanup] Failed to expire visit ${visit.id}: ${(err as Error).message}`);
    }
  }

  console.log(`[VisitCleanup] Job complete — processed: ${processed}, failed: ${failed}.`);
}

export function startVisitCleanupCron(prisma: PrismaClient): void {
  // Runs at midnight (00:00:00) Asia/Riyadh time
  cron.schedule('0 0 0 * * *', () => {
    expireOldVisits(prisma).catch((err) =>
      console.error('[VisitCleanup] Unhandled error in expiration job:', err),
    );
  }, { timezone: 'Asia/Riyadh' });

  console.log('[VisitCleanup] Visit expiration cron scheduled (daily midnight Asia/Riyadh).');
}
