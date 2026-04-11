import { PrismaClient } from '../../prisma/generated/client';

type SrsGroupField = 'category' | 'compound' | 'unit';

type SrsRow = {
  name: string;
  value: number;
  Open: number;
  Closed: number;
  'Work Completed': number;
  Cancelled: number;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Scoped SRS where clause ───────────────────────────────────────────────────
// OWNER     → all SRS whose userToken matches their generatedToken
// OPERATION → SRS scoped to their assigned compound slugs (via AssignedCompound)
// all other roles → blocked at router level (403)
export async function resolveSrsWhere(
  prisma: PrismaClient,
  callerId: string,
  callerRole: string,
): Promise<Record<string, any>> {

  if (callerRole === 'OWNER') {
    const user = await prisma.user.findUnique({
      where: { id: callerId },
      select: { generatedToken: true },
    });
    return { userToken: user?.generatedToken };
  }

  if (callerRole === 'OPERATION') {
    const assignments = await (prisma.assignedCompound as any).findMany({
      where: { guardId: callerId },
      include: { compound: { select: { slug: true } } },
    });
    const slugs: string[] = assignments.map((a: any) => a.compound.slug);
    return { compound: { in: slugs } };
  }

  // any other role — no SRS access
  return { id: -1 };
}

// ── Grouping ──────────────────────────────────────────────────────────────────
async function groupSrsByField(
  prisma: PrismaClient,
  field: SrsGroupField,
  scopedWhere: Record<string, any>,
  since?: Date,
): Promise<SrsRow[]> {
  const where: any = { ...scopedWhere };
  if (since) where.datetime = { gte: since };

  const rawResults = await prisma.srs.groupBy({
    by: [field, 'status'],
    _count: { _all: true },
    orderBy: { _count: { status: 'desc' } },
    where,
  });

  const map: Record<string, SrsRow> = {};
  for (const item of rawResults) {
    const key = (item[field] as string | null) ?? 'Unassigned';
    if (!map[key]) {
      map[key] = { name: key, value: 0, Open: 0, Closed: 0, 'Work Completed': 0, Cancelled: 0 };
    }
    const count = (item._count as { _all: number })._all;
    map[key].value += count;
    if (item.status === 'Closed') map[key].Closed += count;
    if (item.status === 'Open') map[key].Open += count;
    if (item.status === 'Work Completed') map[key]['Work Completed'] += count;
    if (item.status === 'Cancelled') map[key].Cancelled += count;
  }

  return Object.values(map);
}

async function getSrsByFieldWithRanges(
  prisma: PrismaClient,
  field: SrsGroupField,
  scopedWhere: Record<string, any>,
) {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [allTime, last7DaysData, todayData] = await Promise.all([
    groupSrsByField(prisma, field, scopedWhere),
    groupSrsByField(prisma, field, scopedWhere, last7Days),
    groupSrsByField(prisma, field, scopedWhere, startOfToday()),
  ]);
  return { allTime, last7Days: last7DaysData, today: todayData };
}

export async function getSrsByCategory(
  prisma: PrismaClient,
  scopedWhere: Record<string, any>,
) {
  return getSrsByFieldWithRanges(prisma, 'category', scopedWhere);
}

export async function GetSrsByCompound(
  prisma: PrismaClient,
  scopedWhere: Record<string, any>,
) {
  return getSrsByFieldWithRanges(prisma, 'compound', scopedWhere);
}

export async function GetSrsByUnit(
  prisma: PrismaClient,
  scopedWhere: Record<string, any>,
) {
  return getSrsByFieldWithRanges(prisma, 'unit', scopedWhere);
}

export async function getSrsStatus(
  prisma: PrismaClient,
  scopedWhere: Record<string, any>,
) {
  const lastWhere: any = {
    ...scopedWhere,
    updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  };

  const [statusCounts, lastStatusCount] = await Promise.all([
    prisma.srs.groupBy({ by: ['status'], _count: { status: true }, where: scopedWhere }),
    prisma.srs.groupBy({ by: ['status'], _count: { status: true }, where: lastWhere }),
  ]);

  const result: Record<string, number> = { Closed: 0, Open: 0, Cancelled: 0, 'Work Completed': 0 };
  for (const item of statusCounts) {
    if (item.status) result[item.status] = item._count.status;
  }

  const lastResult: Record<string, number> = { Closed: 0, Open: 0, Cancelled: 0, 'Work Completed': 0 };
  for (const item of lastStatusCount) {
    if (item.status) lastResult[item.status] = item._count.status;
  }

  return { status: result, lastStatus: lastResult };
}

export interface ListRequestsQuery {
  page: number;
  limit: number;
  status?: string;
  category?: string;
}

export async function listSrsRequests(
  prisma: PrismaClient,
  query: ListRequestsQuery,
  scopedWhere: Record<string, any>,
) {
  const { page, limit, status, category } = query;
  const skip = (page - 1) * limit;

  const where: any = { ...scopedWhere };
  if (status) where.status = status;
  if (category) where.category = category;

  const categoryWhere: any = { ...scopedWhere, category: { not: null } };

  const [categories, data, total] = await Promise.all([
    prisma.srs.findMany({
      select: { category: true },
      distinct: ['category'],
      where: categoryWhere,
    }),
    prisma.srs.findMany({
      select: { breifdescription: true, category: true, status: true, datetime: true, unit: true, compound: true },
      where,
      skip,
      take: limit,
      orderBy: { datetime: 'desc' },
    }),
    prisma.srs.count({ where }),
  ]);

  return {
    categories: categories.map((r) => r.category as string),
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── Whatsapp requests status (not compound-scoped) ────────────────────────────
export async function getRequestsStatus(prisma: PrismaClient) {
  const [statusCounts, lastStatusCount] = await Promise.all([
    prisma.requests.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.requests.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const result: Record<string, number> = { new: 0, in_progress: 0, completed: 0, canceled: 0 };
  for (const item of statusCounts) {
    if (item.status) result[item.status] = item._count.status;
  }

  const lastResult: Record<string, number> = { new: 0, in_progress: 0, completed: 0, canceled: 0 };
  for (const item of lastStatusCount) {
    if (item.status) lastResult[item.status] = item._count.status;
  }

  return { status: result, lastStatus: lastResult };
}
