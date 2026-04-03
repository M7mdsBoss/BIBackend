import { PrismaClient } from '../../prisma/generated/client';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sevenDaysAgo(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return d;
}

export interface ListVisitsQuery {
  page: number;
  limit: number;
  unit?: string;
}

export async function listVisits(prisma: PrismaClient, query: ListVisitsQuery) {
  const { page, limit, unit } = query;
  const skip = (page - 1) * limit;
  const where = unit ? { residentUnit: { contains: unit, mode: 'insensitive' as const } } : {};

  const [data, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      skip,
      take: limit,
      orderBy: { visitDate: 'desc' },
    }),
    prisma.visit.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getVisitorStats(prisma: PrismaClient) {
  const todayStart = startOfToday();
  const weekStart = sevenDaysAgo();

  const [
    total,
    perCompound,
    last7DaysTotal,
    last7DaysPerCompound,
    todayTotal,
    todayPerCompound,
  ] = await Promise.all([
    // 1. Total visitors
    prisma.visit.count(),

    // 2. Total per compound
    prisma.visit.groupBy({
      by: ['residentUnit'],
      _count: { _all: true },
      orderBy: { _count: { residentUnit: 'desc' } },
    }),

    // 3. Last 7 days total
    prisma.visit.count({
      where: { visitDate: { gte: weekStart } },
    }),

    // 4. Last 7 days per compound
    prisma.visit.groupBy({
      by: ['residentUnit'],
      _count: { _all: true },
      where: { visitDate: { gte: weekStart } },
      orderBy: { _count: { residentUnit: 'desc' } },
    }),

    // 5. Today total
    prisma.visit.count({
      where: { visitDate: { gte: todayStart } },
    }),

    // 6. Today per compound
    prisma.visit.groupBy({
      by: ['residentUnit'],
      _count: { _all: true },
      where: { visitDate: { gte: todayStart } },
      orderBy: { _count: { residentUnit: 'desc' } },
    }),
  ]);

  return {
    total,
    perCompound: perCompound.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    last7Days: {
      total: last7DaysTotal,
      perCompound: last7DaysPerCompound.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    },
    today: {
      total: todayTotal,
      perCompound: todayPerCompound.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    },
  };
}
