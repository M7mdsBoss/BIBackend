import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { uniqueCompoundSlug } from '../shared/slug';

export interface CreateCompoundDto {
  name: string;
  ownerId: string;
}

export interface UpdateCompoundDto {
  name?: string;
  ownerId?: string;
}

export async function createCompound(prisma: PrismaClient, dto: CreateCompoundDto) {
  const slug = await uniqueCompoundSlug(prisma, dto.name);

  return (prisma.compound as any).create({
    data: {
      id: uuidv4(),
      name: dto.name,
      slug,
      ownerId: dto.ownerId,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
}

export async function getCompounds(prisma: PrismaClient) {
  return (prisma.compound as any).findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { units: true, assignedMembers: true } },
    },
  });
}

export async function getCompoundById(prisma: PrismaClient, id: string) {
  const compound = await (prisma.compound as any).findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      units: true,
      assignedMembers: {
        include: { guard: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });

  if (!compound) {
    const err: any = new Error('compound-not-found');
    err.status = 404;
    throw err;
  }

  return compound;
}

export async function getMyCompounds(prisma: PrismaClient, ownerId: string) {
  return (prisma.compound as any).findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { units: true, assignedMembers: true } },
    },
  });
}

export async function updateCompound(
  prisma: PrismaClient,
  id: string,
  dto: UpdateCompoundDto,
) {
  const existing = await (prisma.compound as any).findUnique({ where: { id } });
  if (!existing) {
    const err: any = new Error('compound-not-found');
    err.status = 404;
    throw err;
  }

  const data: any = {};
  if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
  if (dto.name !== undefined) {
    data.name = dto.name;
    data.slug = await uniqueCompoundSlug(prisma, dto.name, id);
  }

  return (prisma.compound as any).update({
    where: { id },
    data,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
}
