import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { uniqueUnitSlug } from '../shared/slug';

export interface CreateUnitDto {
  name: string;
  compoundId: string;
}

export interface UpdateUnitDto {
  name?: string;
}

export async function createUnit(prisma: PrismaClient, dto: CreateUnitDto) {
  const compoundExists = await (prisma.compound as any).findUnique({
    where: { id: dto.compoundId },
  });
  if (!compoundExists) {
    const err: any = new Error('compound-not-found');
    err.status = 404;
    throw err;
  }

  const slug = await uniqueUnitSlug(prisma, dto.name);

  return (prisma.unit as any).create({
    data: {
      id: uuidv4(),
      name: dto.name,
      slug,
      compoundId: dto.compoundId,
    },
    include: { compound: { select: { id: true, name: true, slug: true } } },
  });
}

export async function getUnits(prisma: PrismaClient, compoundId: string) {
  const compoundExists = await (prisma.compound as any).findUnique({
    where: { id: compoundId },
  });
  if (!compoundExists) {
    const err: any = new Error('compound-not-found');
    err.status = 404;
    throw err;
  }

  return (prisma.unit as any).findMany({
    where: { compoundId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUnitById(prisma: PrismaClient, id: string) {
  const unit = await (prisma.unit as any).findUnique({
    where: { id },
    include: { compound: { select: { id: true, name: true, slug: true } } },
  });

  if (!unit) {
    const err: any = new Error('unit-not-found');
    err.status = 404;
    throw err;
  }

  return unit;
}

export async function updateUnit(prisma: PrismaClient, id: string, dto: UpdateUnitDto) {
  const existing = await (prisma.unit as any).findUnique({ where: { id } });
  if (!existing) {
    const err: any = new Error('unit-not-found');
    err.status = 404;
    throw err;
  }

  const data: any = {};
  if (dto.name !== undefined) {
    data.name = dto.name;
    data.slug = await uniqueUnitSlug(prisma, dto.name, id);
  }

  return (prisma.unit as any).update({
    where: { id },
    data,
    include: { compound: { select: { id: true, name: true, slug: true } } },
  });
}
