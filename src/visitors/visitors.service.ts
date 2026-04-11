import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { generateVisitPDF } from '../qr-code/pdf.service';

export interface CreateVisitDto {
  residentFullName: string;
  residentUnit: string;
  residentPhone: string;
  visitorFullName: string;
  visitorCarType: string;
  visitorLicensePlate: string;
  visitDate: Date;
  visitTime: string;
  compound: string;
  userToken: string;
  pdfUrl?: string;
  qrCode?: string;
}

export interface CallerContext {
  id: string;
  role: string;
}

// ── Scoped where clause ───────────────────────────────────────────────────────
// OWNER  → visits whose userToken matches their generatedToken
// GUARD  → visits whose compound is in their assigned compounds
// ADMIN/OPERATION → no filter (sees all)
export async function resolveVisitWhere(
  prisma: PrismaClient,
  caller: CallerContext,
): Promise<Record<string, any>> {
  if (caller.role === 'OWNER') {
    const user = await prisma.user.findUnique({
      where: { id: caller.id },
      select: { generatedToken: true },
    });
    return { userToken: user?.generatedToken };
  }

  if (caller.role === 'GUARD') {
    const assignments = await (prisma.assignedCompound as any).findMany({
      where: { guardId: caller.id },
      include: { compound: { select: { slug: true } } },
    });
    const slugs: string[] = assignments.map((a: any) => a.compound.slug);
    return { compound: { in: slugs } };
  }

  return {};
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createVisit(
  prisma: PrismaClient,
  dto: CreateVisitDto,
) {
  const unit = await (prisma.unit as any).findUnique({ where: { slug: dto.residentUnit } });
  if (!unit) {
    const err: any = new Error('unit-not-found');
    err.status = 404;
    throw err;
  }

  const compound = await (prisma.compound as any).findUnique({ where: { slug: dto.compound } });
  if (!compound) {
    const err: any = new Error('compound-not-found');
    err.status = 404;
    throw err;
  }

  const now = new Date();

  const visit = await prisma.visit.create({
    data: {
      id: uuidv4(),
      residentFullName: dto.residentFullName,
      residentUnit: dto.residentUnit,
      residentPhone: dto.residentPhone,
      visitorFullName: dto.visitorFullName,
      visitorCarType: dto.visitorCarType,
      visitorLicensePlate: dto.visitorLicensePlate,
      visitDate: dto.visitDate,
      visitTime: dto.visitTime,
      compound: dto.compound,
      pdfUrl: dto.pdfUrl,
      qrCode: dto.qrCode,
      userToken: dto.userToken,
      isExpired: false,
      createdAt: now,
      updatedAt: now,
    },
  });

  await generateVisitPDF(visit);

  const pdfUrl = `${process.env.BASE_URL}/pdf/${visit.id}`;
  const qrCode = `${process.env.PUBLIC_URL}/qr-code/${visit.id}`;

  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: { pdfUrl, qrCode, updatedAt: new Date() },
  });

  const [compoundRef, residentUnitRef] = await Promise.all([
    (prisma.compound as any).findUnique({ where: { slug: dto.compound }, select: { id: true, name: true, slug: true } }),
    (prisma.unit as any).findUnique({ where: { slug: dto.residentUnit }, select: { id: true, name: true, slug: true } }),
  ]);

  return { ...updated, compoundRef, residentUnitRef };
}

// ── List ──────────────────────────────────────────────────────────────────────
export interface ListVisitsQuery {
  page: number;
  limit: number;
  unit?: string;
}

export async function listVisits(
  prisma: PrismaClient,
  query: ListVisitsQuery,
  caller: CallerContext,
) {
  const { page, limit, unit } = query;
  const skip = (page - 1) * limit;

  const scopedWhere = await resolveVisitWhere(prisma, caller);

  const where: any = { ...scopedWhere };
  if (unit) where.residentUnit = { contains: unit, mode: 'insensitive' as const };

  const [data, total] = await Promise.all([
    prisma.visit.findMany({ where, skip, take: limit, orderBy: { visitDate: 'desc' } }),
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

  const allTime   = { ...scopedWhere };
  const last7     = { ...scopedWhere, visitDate: { gte: weekStart } };
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
