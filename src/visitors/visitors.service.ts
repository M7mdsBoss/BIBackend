import { PrismaClient } from '../../prisma/generated/client';

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
  const todayEnd = startOfTomorrow();
  const weekStart = sevenDaysAgo();

  const [
    total,
    perCompound,
    perUnit,
    last7DaysTotal,
    last7DaysPerCompound,
    last7DaysPerUnit,
    todayTotal,
    todayPerCompound,
    todayPerUnit
  ] = await Promise.all([
    // 1. Total visitors
    prisma.visit.count(),

    // 2. Total per compound
    prisma.visit.groupBy({
      by: ['compound'],
      _count: { _all: true },
      orderBy: { _count: { compound: 'desc' } },
    }),

    // 3. Total per unit
    prisma.visit.groupBy({
      by: ['residentUnit'],
      _count: { _all: true },
      orderBy: { _count: { residentUnit: 'desc' } },
    }),

    // 4. Last 7 days total
    prisma.visit.count({
      where: { visitDate: { gte: weekStart } },
    }),

    // 5. Last 7 days per compound
    prisma.visit.groupBy({
      by: ['compound'],
      _count: { _all: true },
      where: { visitDate: { gte: weekStart } },
      orderBy: { _count: { compound: 'desc' } },
    }),

    // 6. Last 7 days per unit
    prisma.visit.groupBy({
      by: ['residentUnit'],
      _count: { _all: true },
      where: { visitDate: { gte: weekStart } },
      orderBy: { _count: { residentUnit: 'desc' } },
    }),

    // 7. Today total
    prisma.visit.count({
      where: { visitDate: { gte: todayStart, lt: todayEnd } },
    }),

    // 8. Today per compound
    prisma.visit.groupBy({
      by: ['compound'],
      _count: { _all: true },
      where: { visitDate: { gte: todayStart, lt: todayEnd } },
      orderBy: { _count: { compound: 'desc' } },
    }),

    // 9. Today per unit
    prisma.visit.groupBy({
      by: ['residentUnit'],
      _count: { _all: true },
      where: { visitDate: { gte: todayStart, lt: todayEnd } },
      orderBy: { _count: { residentUnit: 'desc' } },
    }),

  ]);

  return {
    total,
    perCompound: perCompound.map((r) => ({ compound: r.compound, count: r._count._all })),
    perUnit: perUnit.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    last7Days: {
      total: last7DaysTotal,
      perCompound: last7DaysPerCompound.map((r) => ({ compound: r.compound, count: r._count._all })),
      perUnit: last7DaysPerUnit.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    },
    today: {
      total: todayTotal,
      perCompound: todayPerCompound.map((r) => ({ compound: r.compound, count: r._count._all })),
      perUnit: todayPerUnit.map((r) => ({ unit: r.residentUnit, count: r._count._all })),
    },
  };
}
