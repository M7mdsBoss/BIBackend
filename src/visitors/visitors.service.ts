import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { generateVisitPDF } from '../qr-code/pdf.service';
import { PUBLIC_URL } from '../helper/const/base';

export interface CreateVisitDto {
  residentFullName: string;
  residentUnit: string;
  residentPhone: string;
  visitorFullName: string;
  visitorCarType?: string;
  visitorLicensePlate?: string;
  visitDate: Date;
  visitTime: string;
  compound: string;
  pdfUrl?: string;
  qrCode?: string;
}

export interface CallerContext {
  id: string;
  role: string;
  clientId?: string | null;
}

// ── Scoped where clause ───────────────────────────────────────────────────────
// CLIENT → visits whose clientId matches their Client entity
// GUARD/MANAGER → visits whose compound is in their assigned compounds
// ADMIN/OPERATION → no filter (sees all)
export async function resolveVisitWhere(
  prisma: PrismaClient,
  caller: CallerContext,
): Promise<Record<string, any>> {
  if (caller.role === 'CLIENT' && caller.clientId) {
    return { clientId: caller.clientId };
  }

  if (caller.role === 'GUARD' || caller.role === 'MANAGER') {
    const assignments = await (prisma.assignedCompound as any).findMany({
      where: { guardId: caller.id },
      include: { compound: { select: { slug: true } } },
    });
    const slugs: string[] = assignments.map((a: any) => a.compound.slug);
    return { compound: { in: slugs } };
  }

  return {};
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildVisitCode(compoundName: string, sequence: number): string {
  const prefix = compoundName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const seq = String(sequence).padStart(6, '0');
  return `${prefix}_${seq}`;
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createVisit(
  prisma: PrismaClient,
  dto: CreateVisitDto,
) {
  const compound = await prisma.compound.findUnique({ where: { slug: dto.compound } });
  if (!compound) {
    const err: any = new Error('compound-not-found');
    err.status = 404;
    throw err;
  }

  console.log("compount response",compound)

  const unit = await prisma.unit.findUnique({ where: { slug: dto.residentUnit } });
  if (!unit) {
    const err: any = new Error('unit-not-found');
    err.status = 404;
    throw err;
  }

  console.log("unit response",unit)

  if (unit.compoundId !== compound.id) {
    const err: any = new Error('unit-not-in-compound');
    err.status = 400;
    throw err;
  }

  // Derive clientId from the compound — data belongs to the Client, not a User
  const clientId: string = compound.clientId;

  const now = new Date();

  const visit = await prisma.$transaction(async (tx) => {
    const count = await tx.visit.count({ where: { compound: dto.compound } });
    let seq = count + 1;
    let visitCode: string;
    while (true) {
      visitCode = buildVisitCode(compound.name, seq);
      const taken = await tx.visit.findUnique({ where: { visitCode } });
      if (!taken) break;
      seq++;
    }

    return (tx.visit as any).create({
      data: {
        id: uuidv4(),
        visitCode: visitCode!,
        residentFullName: dto.residentFullName,
        residentUnit: dto.residentUnit,
        residentPhone: dto.residentPhone,
        visitorFullName: dto.visitorFullName,
        visitorCarType: dto.visitorCarType,
        visitorLicensePlate: dto.visitorLicensePlate,
        visitDate: dto.visitDate,
        visitTime: dto.visitTime,
        compound: dto.compound,
        clientId,
        pdfUrl: dto.pdfUrl,
        qrCode: dto.qrCode,
        isExpired: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  await generateVisitPDF(visit);

  const pdfUrl = `${process.env.BASE_URL}/pdf/${visit.id}`;
  const qrCode = `${PUBLIC_URL}/scan/qr-code/${visit.id}`;

  const updated = await (prisma.visit as any).update({
    where: { id: visit.id },
    data: { pdfUrl, qrCode, updatedAt: new Date() },
  });

  const [compoundRef, residentUnitRef] = await Promise.all([
    prisma.compound.findUnique({ where: { slug: dto.compound }, select: { id: true, name: true, slug: true } }),
    prisma.unit.findUnique({ where: { slug: dto.residentUnit }, select: { id: true, name: true, slug: true } }),
  ]);

  return { ...updated, compoundRef, residentUnitRef };
}

// ── List ──────────────────────────────────────────────────────────────────────
export interface ListVisitsQuery {
  page: number;
  limit: number;
  unit?: string;
  sort: 'asc' | 'desc';
}

export async function listVisits(
  prisma: PrismaClient,
  query: ListVisitsQuery,
  caller: CallerContext,
) {
  const { page, limit, unit, sort } = query;
  const skip = (page - 1) * limit;

  const scopedWhere = await resolveVisitWhere(prisma, caller);

  const where: any = { ...scopedWhere };
  if (unit) where.residentUnit = { contains: unit, mode: 'insensitive' as const };

  const [data, total] = await Promise.all([
    prisma.visit.findMany({ where, skip, take: limit, orderBy: { createdAt: sort } }),
    prisma.visit.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getVisitById(prisma: PrismaClient, id: string) {
  const visit = await prisma.visit.findUnique({ where: { id } });

  if (!visit) {
    const err: any = new Error('Visit not found.');
    err.status = 404;
    throw err;
  }

  return visit;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrow(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

function sevenDaysAgo(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return d;
}

export async function getVisitorStats(prisma: PrismaClient, caller: CallerContext) {
  const todayStart  = startOfToday();
  const todayEnd    = startOfTomorrow();
  const weekStart   = sevenDaysAgo();

  const scopedWhere = await resolveVisitWhere(prisma, caller);

  const allTime    = { ...scopedWhere };
  const last7      = { ...scopedWhere, visitDate: { gte: weekStart } };
  const todayWhere = { ...scopedWhere, visitDate: { gte: todayStart, lt: todayEnd } };

  const [
    total,
    perCompound,
    perUnit,
    last7DaysTotal,
    last7DaysPerCompound,
    last7DaysPerUnit,
    todayTotal,
    todayPerCompound,
    todayPerUnit,
  ] = await Promise.all([
    prisma.visit.count({ where: allTime }),
    prisma.visit.groupBy({ by: ['compound'], _count: { _all: true }, where: allTime,  orderBy: { _count: { compound: 'desc' } } }),
    prisma.visit.groupBy({ by: ['residentUnit'], _count: { _all: true }, where: allTime,  orderBy: { _count: { residentUnit: 'desc' } } }),
    prisma.visit.count({ where: last7 }),
    prisma.visit.groupBy({ by: ['compound'], _count: { _all: true }, where: last7,  orderBy: { _count: { compound: 'desc' } } }),
    prisma.visit.groupBy({ by: ['residentUnit'], _count: { _all: true }, where: last7,  orderBy: { _count: { residentUnit: 'desc' } } }),
    prisma.visit.count({ where: todayWhere }),
    prisma.visit.groupBy({ by: ['compound'], _count: { _all: true }, where: todayWhere, orderBy: { _count: { compound: 'desc' } } }),
    prisma.visit.groupBy({ by: ['residentUnit'], _count: { _all: true }, where: todayWhere, orderBy: { _count: { residentUnit: 'desc' } } }),
  ]);

  return {
    total,
    perCompound:  perCompound.map((r) => ({ compound: r.compound, count: r._count._all })),
    perUnit:      perUnit.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    last7Days: {
      total: last7DaysTotal,
      perCompound: last7DaysPerCompound.map((r) => ({ compound: r.compound, count: r._count._all })),
      perUnit:     last7DaysPerUnit.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    },
    today: {
      total: todayTotal,
      perCompound: todayPerCompound.map((r) => ({ compound: r.compound, count: r._count._all })),
      perUnit:     todayPerUnit.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    },
  };
}
