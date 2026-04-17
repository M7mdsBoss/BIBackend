import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { uniqueCompoundSlug } from '../shared/slug';

export interface CreateCompoundDto {
  name: string;
  clientId: string;
}

export interface UpdateCompoundDto {
  name?: string;
  clientId?: string;
}

export async function createCompound(prisma: PrismaClient, dto: CreateCompoundDto) {
  const slug = await uniqueCompoundSlug(prisma, dto.name);

  return (prisma.compound as any).create({
    data: {
      id: uuidv4(),
      name: dto.name,
      slug,
      clientId: dto.clientId,
    },
    include: { client: { select: { id: true, clientName: true } } },
  });
}

export async function getCompounds(prisma: PrismaClient) {
  return (prisma.compound as any).findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, clientName: true } },
      _count: { select: { units: true, assignedMembers: true } },
    },
  });
}

export async function getCompoundById(prisma: PrismaClient, id: string) {
  const compound = await (prisma.compound as any).findUnique({
    where: { id },
    include: {
      client: { select: { id: true, clientName: true } },
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

export async function getMyCompounds(prisma: PrismaClient, clientId: string) {
  return (prisma.compound as any).findMany({
    where: { clientId },
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
  if (dto.clientId !== undefined) data.clientId = dto.clientId;
  if (dto.name !== undefined) {
    data.name = dto.name;
    data.slug = await uniqueCompoundSlug(prisma, dto.name, id);
  }

  return (prisma.compound as any).update({
    where: { id },
    data,
    include: { client: { select: { id: true, clientName: true } } },
  });
}
