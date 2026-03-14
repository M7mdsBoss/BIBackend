import { PrismaClient } from '../../prisma/generated/client';

// ── By-agent breakdown ─────────────────────────────────────────────────────────
export async function getRequestsByAgent(prisma: PrismaClient) {
  const rawResults = await prisma.requests.groupBy({
    by: ['assigned_to', 'status'],
    _count: { _all: true },
  });

  const map: Record<string, {
    name: string;
    value: number;
    Completed: number;
    New: number;
    'In progress': number;
    Canceled: number;
  }> = {};

  for (const item of rawResults) {
    const assigned = item.assigned_to ?? 'Unassigned';
    if (!map[assigned]) {
      map[assigned] = { name: assigned, value: 0, Completed: 0, New: 0, 'In progress': 0, Canceled: 0 };
    }
    const count = item._count._all;
    map[assigned].value += count;
    if (item.status === 'completed')  map[assigned].Completed   += count;
    if (item.status === 'new')        map[assigned].New          += count;
    if (item.status === 'in_progress') map[assigned]['In progress'] += count;
    if (item.status === 'canceled')   map[assigned].Canceled    += count;
  }

  return { data: Object.values(map) };
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

// ── Paginated requests list ────────────────────────────────────────────────────
export interface ListRequestsQuery {
  page: number;
  limit: number;
  status?: string;
  assigned_to?: string;
}

export async function listRequests(prisma: PrismaClient, query: ListRequestsQuery) {
  const { page, limit, status, assigned_to } = query;
  const skip = (page - 1) * limit;

  const where: { status?: string; assigned_to?: string } = {};
  if (status)      where.status      = status;
  if (assigned_to) where.assigned_to = assigned_to;

  const departments = await prisma.requests.findMany({
    select: { assigned_to: true },
    distinct: ['assigned_to'],
    where: { assigned_to: { not: null } },
  });

  const [data, total] = await Promise.all([
    prisma.requests.findMany({
      select: { request_text: true, assigned_to: true, status: true, created_at: true, updated_at: true },
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.requests.count({ where }),
  ]);

  return {
    departments: departments.map((r) => r.assigned_to as string),
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
