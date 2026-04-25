import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';

export interface CreateInstructionDto {
  instruction: string;
}

export interface UpdateInstructionDto {
  instruction?: string;
}

export async function createInstruction(
  prisma: PrismaClient,
  clientId: string,
  dto: CreateInstructionDto,
) {
  return (prisma as any).instruction.create({
    data: {
      id: uuidv4(),
      instruction: dto.instruction,
      clientId,
    },
  });
}

export async function getInstructions(prisma: PrismaClient, clientId: string) {
  return (prisma as any).instruction.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInstructionById(
  prisma: PrismaClient,
  clientId: string,
  id: string,
) {
  const record = await (prisma as any).instruction.findFirst({
    where: { id, clientId },
  });
  if (!record) {
    const err: any = new Error('instruction-not-found');
    err.status = 404;
    throw err;
  }
  return record;
}

export async function updateInstruction(
  prisma: PrismaClient,
  clientId: string,
  id: string,
  dto: UpdateInstructionDto,
) {
  const existing = await (prisma as any).instruction.findFirst({
    where: { id, clientId },
  });
  if (!existing) {
    const err: any = new Error('instruction-not-found');
    err.status = 404;
    throw err;
  }

  const data: any = {};
  if (dto.instruction !== undefined) data.instruction = dto.instruction;

  return (prisma as any).instruction.update({
    where: { id },
    data,
  });
}

export async function deleteInstruction(
  prisma: PrismaClient,
  clientId: string,
  id: string,
) {
  const existing = await (prisma as any).instruction.findFirst({
    where: { id, clientId },
  });
  if (!existing) {
    const err: any = new Error('instruction-not-found');
    err.status = 404;
    throw err;
  }
  await (prisma as any).instruction.delete({ where: { id } });
  return { message: 'instruction-deleted' };
}
