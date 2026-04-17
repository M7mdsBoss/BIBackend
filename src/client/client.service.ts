import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';

export interface CreateClientDto {
  clientName: string;
  address?: string;
  crNb?: string;
  contact?: string;
  domainName?: string;
  website?: string;
  note?: string;
}

export interface UpdateClientDto {
  clientName?: string;
}


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
      note: dto.note,
    },
  });

  return { client };
}

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
