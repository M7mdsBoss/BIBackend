import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../prisma/generated/client";
import { sendEmail } from "../shared/mail.service";
import { PUBLIC_URL } from "../helper/const/base";

const JWT_SECRET = process.env.JWT_SECRET!;

// Valid roles an OWNER can assign to their members
export const MEMBER_ROLES = ["GUARD", "OPERATION"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface CreateMemberDto {
  name: string;
  email: string;
  role: MemberRole;
  phone?: string;
  compoundIds?: string[];
}

export interface UpdateMemberDto {
  name?: string;
  phone?: string;
  role?: MemberRole;
  compoundIds?: string[];
}

function generateRandomPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

async function generateUniqueToken(prisma: PrismaClient): Promise<string> {
  let token = "";
  let exists = true;
  while (exists) {
    token = uuidv4().replace(/-/g, "").slice(0, 12);
    const existing = await prisma.user.findUnique({
      where: { generatedToken: token },
    });
    if (!existing) exists = false;
  }
  return token;
}

export async function createMember(
  prisma: PrismaClient,
  ownerId: string,
  dto: CreateMemberDto,
) {
  const existing = await prisma.user.findUnique({
    where: { email: dto.email },
  });
  if (existing) {
    const err: any = new Error("email-already-registered");
    err.status = 409;
    throw err;
  }

  const generatedToken = await generateUniqueToken(prisma);
  const rawPassword = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // Validate that all provided compoundIds belong to this owner
  if (dto.compoundIds?.length) {
    const owned = await (prisma.compound as any).count({
      where: { id: { in: dto.compoundIds }, ownerId },
    });
    if (owned !== dto.compoundIds.length) {
      const err: any = new Error("compound-not-found");
      err.status = 404;
      throw err;
    }
  }

  const memberId = uuidv4();

  const member = await (prisma.user as any).create({
    data: {
      id: memberId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      ownerId,
      generatedToken,
      password: hashedPassword,
      confirmed: false,
      acceptedAuthorize: false,
      acceptedTerms: false,
    },
  });

  if (dto.compoundIds?.length) {
    await (prisma.assignedCompound as any).createMany({
      data: dto.compoundIds.map((compoundId) => ({
        guardId: memberId,
        compoundId,
      })),
    });
  }

  const confirmToken = jwt.sign({ id: memberId }, JWT_SECRET, {
    expiresIn: "60m",
  });
  const confirmationLink = `${PUBLIC_URL}/confirm-member/${confirmToken}`;

  const emailResult = await sendEmail({
    to: dto.email,
    subject: "You've been invited – The Blue Innovation | تمت دعوتك",
    htmlBody: buildMemberInvitationEmail(
      dto.name,
      confirmationLink,
      rawPassword,
    ),
  });

  if (!emailResult.success) {
    // Roll back the created member if email fails
    await (prisma.user as any).delete({ where: { id: memberId } });
    const err: any = new Error(
      emailResult.error ?? "Failed to send invitation email",
    );
    err.status = 500;
    throw err;
  }

  const { password, ...rest } = member;
  return {
    ...rest,
    assignedCompounds: dto.compoundIds ?? [],
  };
}

export async function confirmMember(
  prisma: PrismaClient,
  token: string,
  password: string,
) {
  let payload: { id: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id: string };
  } catch {
    const err: any = new Error("tokenExpired");
    err.status = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) {
    const err: any = new Error("user-not-found");
    err.status = 400;
    throw err;
  }
  if (user.confirmed) {
    const err: any = new Error("already-confirmed");
    err.status = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: payload.id },
    data: { confirmed: true, password: hashedPassword },
  });

  const loginToken = jwt.sign(
    { id: user.id, role: user.role, ownerId: user.ownerId ?? null },
    JWT_SECRET,
  );
  return {
    token: loginToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function getMembers(prisma: PrismaClient, ownerId: string) {
  const members = await (prisma.user as any).findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      assignedCompounds: {
        include: { compound: true },
      },
    },
  });

  return members.map(({ password, ...rest }: any) => rest);
}

export async function getMemberById(
  prisma: PrismaClient,
  ownerId: string,
  memberId: string,
) {
  const member = await (prisma.user as any).findFirst({
    where: { id: memberId, ownerId },
    include: {
      assignedCompounds: true,
    },
  });

  if (!member) {
    const err: any = new Error("member-not-found");
    err.status = 404;
    throw err;
  }

  const { password, ...rest } = member;
  return rest;
}

export async function updateMember(
  prisma: PrismaClient,
  ownerId: string,
  memberId: string,
  dto: UpdateMemberDto,
) {
  const member = await (prisma.user as any).findFirst({
    where: { id: memberId, ownerId },
  });

  if (!member) {
    const err: any = new Error("member-not-found");
    err.status = 404;
    throw err;
  }

  const data: any = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.phone !== undefined) data.phone = dto.phone;
  if (dto.role !== undefined) data.role = dto.role;

  const updated = await (prisma.user as any).update({
    where: { id: memberId },
    data,
  });

  if (dto.compoundIds !== undefined) {
    if (dto.compoundIds.length) {
      const owned = await (prisma.compound as any).count({
        where: { id: { in: dto.compoundIds }, ownerId },
      });
      if (owned !== dto.compoundIds.length) {
        const err: any = new Error("compound-not-found");
        err.status = 404;
        throw err;
      }
    }
    await (prisma.assignedCompound as any).deleteMany({
      where: { guardId: memberId },
    });
    if (dto.compoundIds.length) {
      await (prisma.assignedCompound as any).createMany({
        data: dto.compoundIds.map((compoundId) => ({
          guardId: memberId,
          compoundId,
        })),
      });
    }
  }

  const assignments = await (prisma.assignedCompound as any).findMany({
    where: { guardId: memberId },
    select: { compoundId: true },
  });

  const { password, ...rest } = updated;
  return {
    ...rest,
    assignedCompounds: assignments.map((a: any) => a.compoundId),
  };
}

export async function deleteMember(
  prisma: PrismaClient,
  ownerId: string,
  memberId: string,
) {
  const member = await (prisma.user as any).findFirst({
    where: { id: memberId, ownerId },
  });

  if (!member) {
    const err: any = new Error("member-not-found");
    err.status = 404;
    throw err;
  }

  await (prisma.user as any).delete({ where: { id: memberId } });
  return { message: "member-deleted" };
}

function buildMemberInvitationEmail(
  name: string,
  confirmationLink: string,
  password: string,
): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <img src="https://res.cloudinary.com/dcsjywfui/image/upload/v1771925146/bi_bctaie.png" alt="Company Logo" style="max-height: 60px; margin-bottom: 20px;" />
          <h2>Hi ${name || "there"},</h2>
          <p>You have been invited to join <strong>The Blue Innovation</strong> platform. Please confirm your email address to activate your account.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${confirmationLink}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Confirm Your Account
            </a>
          </p>
          <p style="text-align: center; color: #888; font-size: 0.9em;">This link is valid for 60 minutes.</p>
          <hr style="margin: 30px 0;" />
          <div dir="rtl" style="text-align: right;">
            <h2>مرحباً ${name || ""}،</h2>
            <p>تمت دعوتك للانضمام إلى منصة <strong>The Blue Innovation</strong>. يرجى تأكيد بريدك الإلكتروني لتفعيل حسابك.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${confirmationLink}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                تأكيد حسابك
              </a>
            </p>
            <p style="text-align: center; color: #888; font-size: 0.9em;">هذا الرابط صالح لمدة 60 دقيقة فقط.</p>
          </div>
          <hr style="margin: 30px 0;" />
          <p style="font-size: 0.9em;">The Blue Innovation Team<br/>www.theblueinnovation.com</p>
        </div>
      </body>
    </html>
  `;
}
