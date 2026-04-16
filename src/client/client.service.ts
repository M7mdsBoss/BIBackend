import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';

export interface CreateClientDto {
  clientName: string;
  address?: string;
  crNb?: string;
  contact?: string;
  domainName?: string;
  website?: string;
}

export interface UpdateClientDto {
  clientName?: string;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createClient(prisma: PrismaClient, dto: CreateClientDto) {
  const client = await prisma.client.create({
    data: {
      id: uuidv4(),
      clientName: dto.clientName,
      address: dto.address,
      crNb: dto.crNb,
      contact: dto.contact,
      domainName: dto.domainName,
      website: dto.website,
    },
  });

  return { client };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getClients(
  prisma: PrismaClient,
  page: number = 1,
  limit: number = 10,
) {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.client.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.client.count(),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getClientById(prisma: PrismaClient, id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      admin: { select: { id: true, name: true, email: true } },
      members: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (!client) {
    const err: any = new Error('client-not-found');
    err.status = 404;
    throw err;
  }

  return client;
}

export async function getClientByAdminId(prisma: PrismaClient, adminId: string) {
  const client = await prisma.client.findUnique({
    where: { adminId },
    include: {
      admin: { select: { id: true, name: true, email: true } },
      members: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { compounds: true } },
    },
  });

  if (!client) {
    const err: any = new Error('client-not-found');
    err.status = 404;
    throw err;
  }

  return client;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateClient(prisma: PrismaClient, id: string, dto: UpdateClientDto) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    const err: any = new Error('client-not-found');
    err.status = 404;
    throw err;
  }

  return prisma.client.update({
    where: { id },
    data: dto,
    include: { admin: { select: { id: true, name: true, email: true } } },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteClient(prisma: PrismaClient, id: string) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    const err: any = new Error('client-not-found');
    err.status = 404;
    throw err;
  }

  await (prisma as any).client.delete({ where: { id } });
  return { message: 'client-deleted' };
}
