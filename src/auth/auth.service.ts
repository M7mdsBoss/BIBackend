import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../prisma/generated/client";
import { sendEmail } from "../shared/mail.service";
import { PUBLIC_URL } from "../helper/const/base";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function generateUniqueToken(
  prisma: PrismaClient,
): Promise<string> {
  let token: string = "";
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

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  website?: string;
  chatVolume?: string;
  campany?: string;
  industry?: string;
  campanySize?: string;
  campanyRole?: string;
  acceptedTerms: boolean;
  acceptedAuthorize: boolean;
}

export async function register(prisma: PrismaClient, dto: RegisterDto) {
  const {
    name,
    email,
    password,
    phone,
    website,
    chatVolume,
    campany,
    industry,
    campanySize,
    campanyRole,
    acceptedAuthorize,
    acceptedTerms,
  } = dto;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.confirmed) {
    const err: any = new Error("already-registered");
    err.status = 400;
    throw err;
  }

  const generatedToken = await generateUniqueToken(prisma);
  const hashedPassword = await bcrypt.hash(password, 10);

  let userId: string;
  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        phone,
        website,
        chatVolume,
        campany,
        industry,
        campanySize,
        generatedToken,
        confirmed: false,
        campanyRole,
        acceptedAuthorize,
        acceptedTerms,
      },
    });
    userId = user.id;
  } else {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        password: hashedPassword,
        phone,
        website,
        chatVolume,
        campany,
        industry,
        campanySize,
        generatedToken,
        confirmed: false,
        campanyRole,
        acceptedAuthorize,
        acceptedTerms,
      },
    });
    userId = existingUser.id;
  }

  const confirmToken = jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: "60m",
  });
  const confirmationLink = `${PUBLIC_URL}/confirm-register/${confirmToken}`;

  const emailResult = await sendEmail({
    to: email,
    subject: "Confirm Your Registration – The Blue Innovation | تأكيد التسجيل",
    htmlBody: buildConfirmationEmail(name, confirmationLink),
  });

  if (!emailResult.success) {
    const err: any = new Error(emailResult.error ?? "Failed to send email");
    err.status = 500;
    throw err;
  }

  return { message: "confirmation-sent" };
}

export async function confirmRegister(prisma: PrismaClient, token: string) {
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
    const err: any = new Error("already-registered");
    err.status = 400;
    throw err;
  }

  await prisma.user.update({
    where: { id: payload.id },
    data: { confirmed: true },
  });

  sendEmail({
    to: user.email,
    subject:
      "Welcome to The Blue Innovation | مرحباً بك في The Blue Innovation",
    htmlBody: buildWelcomeEmail(user.name),
  }).catch((err) => console.error("Welcome email error:", err));

  const clientEntity = await (prisma as any).client.findUnique({
    where: { adminId: user.id },
    select: { id: true },
  });
  const loginToken = jwt.sign(
    { id: user.id, role: user.role, clientId: clientEntity?.id ?? null },
    JWT_SECRET,
  );
  return {
    token: loginToken,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function login(
  prisma: PrismaClient,
  dto: { email: string; password: string },
) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  if (!user || !user.password) {
    const err: any = new Error("Invalid-credentials");
    err.status = 401;
    throw err;
  }
  if (!user.confirmed) {
    const err: any = new Error("email-not-confirmed");
    err.status = 401;
    throw err;
  }

  if (!user.clientId && user.role != "ADMIN") {
    const err: any = new Error("not-onboard");
    err.status = 404;
    throw err;
  }

  const isValid = await bcrypt.compare(dto.password, user.password)
  if (!isValid) {
    const err: any = new Error("Invalid-credentials");
    err.status = 401;
    throw err;
  }

  // For CLIENT: look up the Client entity. For members: use their clientId field.
  let clientId: string | null = null;
  if (user.role === "CLIENT") {
    const clientEntity = await (prisma as any).client.findUnique({
      where: { adminId: user.id },
      select: { id: true },
    });
    clientId = clientEntity?.id ?? null;
  } else {
    clientId = (user as any).clientId ?? null;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, clientId },
    JWT_SECRET,
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

function buildConfirmationEmail(
  name: string,
  confirmationLink: string,
): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <img src="https://res.cloudinary.com/dcsjywfui/image/upload/v1771925146/bi_bctaie.png" alt="Company Logo" style="max-height: 60px; margin-bottom: 20px;" />
          <h2>Hi ${name || "there"},</h2>
          <p>Thank you for registering with <strong>The Blue Innovation</strong>. Please confirm your email address to activate your account.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${confirmationLink}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Confirm Your Email
            </a>
          </p>
          <p style="text-align: center; color: #888; font-size: 0.9em;">This link is valid for 60 minutes.</p>
          <hr style="margin: 30px 0;" />
          <div dir="rtl" style="text-align: right;">
            <h2>مرحباً ${name || ""}،</h2>
            <p>شكراً لتسجيلك في <strong>The Blue Innovation</strong>. يرجى تأكيد بريدك الإلكتروني لتفعيل حسابك.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${confirmationLink}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                تأكيد بريدك الإلكتروني
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

function buildWelcomeEmail(name: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <img src="https://res.cloudinary.com/dcsjywfui/image/upload/v1771925146/bi_bctaie.png" alt="Company Logo" style="max-height: 60px; margin-bottom: 20px;" />
          <h2>Welcome, ${name || "there"}!</h2>
          <p>Your email has been confirmed and your account is now active. You can log in to <strong>The Blue Innovation</strong> platform at any time.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${PUBLIC_URL}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Go to Platform
            </a>
          </p>
          <hr style="margin: 30px 0;" />
          <div dir="rtl" style="text-align: right;">
            <h2>مرحباً بك، ${name || ""}!</h2>
            <p>تم تأكيد بريدك الإلكتروني وأصبح حسابك نشطاً. يمكنك الآن تسجيل الدخول إلى منصة <strong>The Blue Innovation</strong> في أي وقت.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${PUBLIC_URL}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                الذهاب إلى المنصة
              </a>
            </p>
          </div>
          <hr style="margin: 30px 0;" />
          <p style="font-size: 0.9em;">The Blue Innovation Team<br/>www.theblueinnovation.com</p>
        </div>
      </body>
    </html>
  `;
}
