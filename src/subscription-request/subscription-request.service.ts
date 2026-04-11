import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';

export interface CreateSubscriptionRequestDto {
  name: string;
  email: string;
  password: string;
  campanyRole: string;
  plan: string;
  campany?: string;
  industry?: string;
  city?: string;
  country?: string;
  totalBranches?: string;
  chatVolume?: string;
  aiIntegration?: string;
  campanySize?: string;
  website?: string;
  phone?: string;
  whatsapp?: string;
  acceptedAuthorize?: boolean;
  acceptedTerms?: boolean;
}

async function generateUniqueToken(prisma: PrismaClient): Promise<string> {
  let token = '';
  let exists = true;
  while (exists) {
    token = uuidv4().replace(/-/g, '').slice(0, 12);
    const existing = await prisma.subscriptionRequest.findUnique({
      where: { generatedToken: token },
    });
    if (!existing) exists = false;
  }
  return token;
}

export async function createSubscriptionRequest(
  prisma: PrismaClient,
  dto: CreateSubscriptionRequestDto,
) {
  const existing = await prisma.subscriptionRequest.findUnique({
    where: { email: dto.email },
  });

  if (existing) {
    const err: any = new Error('email-already-submitted');
    err.status = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(dto.password, 10);
  const generatedToken = await generateUniqueToken(prisma);

  const record = await prisma.subscriptionRequest.create({
    data: {
      id: uuidv4(),
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      campanyRole: dto.campanyRole,
      plan: dto.plan,
      campany: dto.campany,
      industry: dto.industry,
      city: dto.city,
      country: dto.country,
      totalBranches: dto.totalBranches,
      chatVolume: dto.chatVolume,
      aiIntegration: dto.aiIntegration,
      campanySize: dto.campanySize,
      website: dto.website,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      acceptedAuthorize: dto.acceptedAuthorize ?? false,
      acceptedTerms: dto.acceptedTerms ?? false,
      generatedToken,
      confirmed: false,
    },
  });

  const { password, ...rest } = record;
  return rest;
}
