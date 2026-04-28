import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { generateVisitPDF } from '../qr-code/pdf.service';
import { PUBLIC_URL } from '../helper/const/base';

export interface CreateVisitDto {
  residentFullName: string;
  residentUnit: string;
  residentPhone: string;
  visitorFullName: string;
  visitorId: string;
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
// SECURITY/MANAGER → visits whose compound is in their assigned compounds
// ADMIN/OPERATION → no filter (sees all)
export async function resolveVisitWhere(
  prisma: PrismaClient,
  caller: CallerContext,
): Promise<Record<string, any>> {
  if (caller.role === 'CLIENT') {
    if (!caller.clientId) return { id: '__no_match__' }; // no client onboarded yet → match nothing
    return { clientId: caller.clientId };
  }

  if (caller.role === 'SECURITY' || caller.role === 'MANAGER') {
    const assignments = await (prisma.assignedCompound as any).findMany({
      where: { guardId: caller.id },
      include: { compound: { select: { slug: true } } },
    });
    const slugs: string[] = assignments.map((a: any) => a.compound.slug);
    if (slugs.length === 0) return { id: '__no_match__' }; // no assigned compounds → match nothing
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

  const unit = await prisma.unit.findUnique({ where: { slug: dto.residentUnit } });
  if (!unit) {
    const err: any = new Error('unit-not-found');
    err.status = 404;
    throw err;
  }


  // if (unit.compoundId !== compound.id) {
  //   const err: any = new Error('unit-not-in-compound');
  //   err.status = 400;
  //   throw err;
  // }

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
        visitorId: dto.visitorId,
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
    prisma.visit.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: sort },
      include: {
        compoundRef:     { select: { name: true, slug: true } },
        residentUnitRef: { select: { name: true, slug: true } },
      },
    }),
    prisma.visit.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getVisitById(prisma: PrismaClient, id: string) {
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      compoundRef:     { select: { name: true, slug: true } },
      residentUnitRef: { select: { name: true, slug: true } },
    },
  });

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

// Baseline: compounds the caller is allowed to see, regardless of whether
// they have visits yet. Used to seed compound stats with zero entries so
// newly-created compounds still appear on the dashboard.
async function resolveVisitCompoundBaseline(
  prisma: PrismaClient,
  caller: CallerContext,
): Promise<Map<string, string>> {
  let compoundWhere: any | null = null;

  if (caller.role === 'CLIENT') {
    if (!caller.clientId) return new Map();
    compoundWhere = { clientId: caller.clientId };
  } else if (caller.role === 'SECURITY' || caller.role === 'MANAGER') {
    const assignments = await (prisma.assignedCompound as any).findMany({
      where: { guardId: caller.id },
      select: { compoundId: true },
    });
    const ids: string[] = assignments.map((a: any) => a.compoundId);
    if (ids.length === 0) return new Map();
    compoundWhere = { id: { in: ids } };
  }
  // ADMIN / OPERATION → compoundWhere stays null (no filter, see all)

  const compounds = await prisma.compound.findMany({
    where: compoundWhere ?? undefined,
    select: { slug: true, name: true },
  });
  return new Map(compounds.map((c) => [c.slug, c.name]));
}

function buildPerCompound(
  groupRows: Array<{ compound: string | null; _count: { _all: number } }>,
  labelBySlug: Map<string, string>,
): Array<{ compound: string; count: number }> {
  const counts = new Map<string, number>();
  labelBySlug.forEach((_name, slug) => counts.set(slug, 0));
  let unassigned = 0;
  for (const r of groupRows) {
    const count = r._count._all;
    if (!r.compound) { unassigned += count; continue; }
    counts.set(r.compound, (counts.get(r.compound) ?? 0) + count);
  }
  const out = Array.from(counts, ([slug, count]) => ({
    compound: labelBySlug.get(slug) ?? slug,
    count,
  })).sort((a, b) => b.count - a.count);
  if (unassigned > 0) out.push({ compound: 'Unassigned', count: unassigned });
  return out;
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
    compoundLabelBySlug,
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
    resolveVisitCompoundBaseline(prisma, caller),
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

  // Unit labels: resolved only for units that actually appear in groupBy
  // results (no zero-seeding for units).
  const unitSlugs = new Set<string>();
  for (const r of [...perUnit, ...last7DaysPerUnit, ...todayPerUnit]) {
    if (r.residentUnit) unitSlugs.add(r.residentUnit);
  }
  const unitRows = unitSlugs.size
    ? await prisma.unit.findMany({
        where: { slug: { in: Array.from(unitSlugs) } },
        select: { slug: true, name: true, compound: { select: { name: true } } },
      })
    : [];
  const unitLabelBySlug = new Map(
    unitRows.map((u) => [u.slug, `${u.compound.name} - ${u.name}`]),
  );
  const unitLabel = (slug: string | null) =>
    (slug && unitLabelBySlug.get(slug)) || slug || 'Unassigned';

  return {
    total,
    perCompound: buildPerCompound(perCompound, compoundLabelBySlug),
    perUnit:     perUnit.map((r) => ({ unit: unitLabel(r.residentUnit), count: r._count._all })),
    last7Days: {
      total: last7DaysTotal,
      perCompound: buildPerCompound(last7DaysPerCompound, compoundLabelBySlug),
      perUnit:     last7DaysPerUnit.map((r) => ({ unit: unitLabel(r.residentUnit), count: r._count._all })),
    },
    today: {
      total: todayTotal,
      perCompound: buildPerCompound(todayPerCompound, compoundLabelBySlug),
      perUnit:     todayPerUnit.map((r) => ({ unit: unitLabel(r.residentUnit), count: r._count._all })),
    },
  };
}

// ── Paginated visits per unit ────────────────────────────────────────────────
// Group visits first, then resolve labels only for unit slugs that actually
// appear in the result set. Units with zero visits in the period are skipped —
// faster than hauling the whole unit table for every call. Search is
// case-insensitive on unit.name OR compound.name.
export type VisitsByUnitPeriod = 'all' | 'last7days' | 'today';

export interface ListVisitsByUnitQuery {
  page: number;
  limit: number;
  sort: 'asc' | 'desc';
  period: VisitsByUnitPeriod;
  search?: string;
}

type VisitsUnitRow = {
  name: string;
  slug: string;
  value: number;
};

function emptyVisitsUnitsResult(page: number, limit: number) {
  return {
    data: [] as VisitsUnitRow[],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };
}

function visitsPeriodRange(period: VisitsByUnitPeriod): { gte: Date; lt?: Date } | null {
  if (period === 'today') return { gte: startOfToday(), lt: startOfTomorrow() };
  if (period === 'last7days') return { gte: sevenDaysAgo() };
  return null;
}

export async function listVisitsByUnit(
  prisma: PrismaClient,
  caller: CallerContext,
  query: ListVisitsByUnitQuery,
) {
  const { page, limit, sort, period, search } = query;

  // 1. Scope visits by the caller's role (CLIENT → clientId,
  //    SECURITY/MANAGER → assigned compound slugs, others blocked at route).
  const scopedWhere = await resolveVisitWhere(prisma, caller);

  const range = visitsPeriodRange(period);
  const visitWhere: any = { ...scopedWhere };
  if (range) visitWhere.visitDate = range;

  // 2. Group first — only units with at least one visit in the period survive.
  const grouped = await prisma.visit.groupBy({
    by: ['residentUnit'],
    _count: { _all: true },
    where: visitWhere,
  });

  if (grouped.length === 0) return emptyVisitsUnitsResult(page, limit);

  // 3. Resolve labels only for slugs that appear, with the optional search
  //    filter pushed to the DB (slugs without a matching label are dropped —
  //    handles both orphaned slugs and search misses in one pass).
  const slugsWithData = Array.from(
    new Set(grouped.map((g) => g.residentUnit).filter((s): s is string => !!s)),
  );

  const labels = await prisma.unit.findMany({
    where: {
      slug: { in: slugsWithData },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { compound: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    select: { slug: true, name: true, compound: { select: { name: true } } },
  });

  if (labels.length === 0) return emptyVisitsUnitsResult(page, limit);

  // 4. Build rows from labels, then merge group counts in.
  const rowBySlug = new Map<string, VisitsUnitRow>();
  for (const u of labels) {
    rowBySlug.set(u.slug, {
      name: `${u.compound.name} - ${u.name}`,
      slug: u.slug,
      value: 0,
    });
  }

  for (const item of grouped) {
    if (!item.residentUnit) continue;
    const row = rowBySlug.get(item.residentUnit);
    if (!row) continue; // dropped by label filter
    row.value += (item._count as { _all: number })._all;
  }

  // 5. Sort by total then paginate.
  const sorted = Array.from(rowBySlug.values()).sort((a, b) =>
    sort === 'asc' ? a.value - b.value : b.value - a.value,
  );

  const total = sorted.length;
  const skip = (page - 1) * limit;
  const data = sorted.slice(skip, skip + limit);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
