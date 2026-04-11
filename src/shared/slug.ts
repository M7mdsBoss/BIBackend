import { PrismaClient } from '../../prisma/generated/client';

function baseSlug(name: string, prefix: 'COMP' | 'UNIT'): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${normalized}`;
}

export async function uniqueCompoundSlug(
  prisma: PrismaClient,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug(name, 'COMP');
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await (prisma.compound as any).findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    counter++;
    slug = `${base}_${counter}`;
  }

  return slug;
}

export async function uniqueUnitSlug(
  prisma: PrismaClient,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug(name, 'UNIT');
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await (prisma.unit as any).findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    counter++;
    slug = `${base}_${counter}`;
  }

  return slug;
}
