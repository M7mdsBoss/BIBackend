import { PrismaClient } from '../../prisma/generated/client';

type SrsGroupField = 'category' | 'compound' | 'unit';

type SrsRow = { name: string; value: number; Open: number; Closed: number; 'Work Completed': number; Cancelled: number };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function groupSrsByField(
  prisma: PrismaClient,
  field: SrsGroupField,
  since?: Date,
): Promise<SrsRow[]> {
  const rawResults = await prisma.srs.groupBy({
    by: [field, 'status'],
    _count: { _all: true },
    orderBy: { _count: { status: 'desc' } },
    where: since ? { datetime: { gte: since } } : undefined,
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

async function getSrsByFieldWithRanges(prisma: PrismaClient, field: SrsGroupField) {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [allTime, last7DaysData, todayData] = await Promise.all([
    groupSrsByField(prisma, field),
    groupSrsByField(prisma, field, last7Days),
    groupSrsByField(prisma, field, startOfToday()),
  ]);
  return { allTime, last7Days: last7DaysData, today: todayData };
}

// ── By-Category breakdown ─────────────────────────────────────────────────────────
export async function getSrsByCategory(prisma: PrismaClient) {
  return getSrsByFieldWithRanges(prisma, 'category');
}

// ── By-Compound breakdown ─────────────────────────────────────────────────────────
export async function GetSrsByCompound(prisma: PrismaClient) {
  return getSrsByFieldWithRanges(prisma, 'compound');
}

// ── By-Unit breakdown ─────────────────────────────────────────────────────────────
export async function GetSrsByUnit(prisma: PrismaClient) {
  return getSrsByFieldWithRanges(prisma, 'unit');
}

// ── Status summary (all-time + last 24 h) ─────────────────────────────────────
export async function getRequestsStatus(prisma: PrismaClient) {
  const statusCounts = await prisma.requests.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const result: Record<string, number> = { new: 0, in_progress: 0, completed: 0, canceled: 0 };
  for (const item of statusCounts) {
    if (item.status) result[item.status] = item._count.status;
  }

  const lastStatusCount = await prisma.requests.groupBy({
    by: ['status'],
    _count: { status: true },
    where: { updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const lastResult: Record<string, number> = { new: 0, in_progress: 0, completed: 0, canceled: 0 };
  for (const item of lastStatusCount) {
    if (item.status) lastResult[item.status] = item._count.status;
  }

  return { status: result, lastStatus: lastResult };
}

// ── Status SRS (all-time + last 24 h) ─────────────────────────────────────
export async function getSrsStatus(prisma: PrismaClient) {
  const statusCounts = await prisma.srs.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const result: Record<string, number> = { Closed: 0, Open: 0, Cancelled: 0, 'Work Completed': 0 };
  for (const item of statusCounts) {
    if (item.status) result[item.status] = item._count.status;
  }

  const lastStatusCount = await prisma.srs.groupBy({
    by: ['status'],
    _count: { status: true },
    where: { updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const lastResult: Record<string, number> = { Closed: 0, Open: 0, Cancelled: 0, 'Work Completed': 0 };
  for (const item of lastStatusCount) {
    if (item.status) lastResult[item.status] = item._count.status;
  }

  return { status: result, lastStatus: lastResult };
}

// ── Paginated requests list ────────────────────────────────────────────────────
export interface ListRequestsQuery {
  page: number;
  limit: number;
  status?: string;
  category?: string;
}

export async function listSrsRequests(prisma: PrismaClient, query: ListRequestsQuery) {
  const { page, limit, status, category } = query;
  const skip = (page - 1) * limit;

  const where: { status?: string; category?: string } = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const categories = await prisma.srs.findMany({
    select: { category: true },
    distinct: ['category'],
    where: { category: { not: null } },
  });

  const [data, total] = await Promise.all([
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
