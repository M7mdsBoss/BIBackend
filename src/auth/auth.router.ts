import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../../prisma/generated/client';
import { register, confirmRegister, login, generateUniqueToken } from './auth.service';
import { confirmMember } from '../member/member.service';
import { validate } from '../middleware/validate';
import { registerSchema, confirmRegisterSchema, loginSchema, confirmMemberSchema } from './auth.schemas';
import { sendEmail } from '../shared/mail.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TRAILER_BCC = [
  'Motaz@theblueinnovation.com',
  'Mohammed@theblueinnovation.com',
  'Fahad@theblueinnovation.com',
];

export function createAuthRouter(prisma: PrismaClient) {
  const router = Router();

  router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await register(prisma, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/confirm-register', validate(confirmRegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await confirmRegister(prisma, req.body.token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/confirm-member', validate(confirmMemberSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await confirmMember(prisma, req.body.token, req.body.password);
      res.json(result);
    } catch (err) {
      console.log(err)
      next(err);
    }
  });

  router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await login(prisma, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/trailer', async (req: Request, res: Response) => {
    const {
      name,
      campany,
      industry,
      city,
      country,
      campanySize,
      chatVolume,
      aiConnect,
      aiIntegration,
      email,
      phone,
      plan,
      whatsapp,
      website,
      password,
    } = req.body as Record<string, string>;

    if (!name || !email || !phone || !password || !plan) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser?.confirmed) {
      res.status(400).json({ error: 'already-registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const generatedToken = await generateUniqueToken(prisma);

    let userId: string;
    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          id: uuidv4(),
          name,
          campany,
          industry,
          city,
          country,
          campanySize,
          chatVolume,
          aiConnect,
          aiIntegration,
          email,
          phone,
          whatsapp,
          website,
          plan,
          password: hashedPassword,
          generatedToken,
          isTrial: true,
          confirmed: false,
        },
      });
      userId = user.id;
    } else {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          campany,
          industry,
          city,
          country,
          campanySize,
          chatVolume,
          aiConnect,
          aiIntegration,
          phone,
          whatsapp,
          website,
          plan,
          password: hashedPassword,
          generatedToken,
          isTrial: true,
          confirmed: false,
        },
      });
      userId = existingUser.id;
    }

    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '60m' });
    const confirmationLink = `${process.env.PUBLIC_URL}/activation/${token}?plan=${plan}`;

    const result = await sendEmail({
      to: email,
      subject: `Confirm Your Subscription to Blue Innovation`,
      bcc: TRAILER_BCC,
      htmlBody: buildTrailerConfirmationEmail({
        name, email, phone, city, country, whatsapp, campany,
        industry, campanySize, chatVolume, website, plan,
        aiConnect, aiIntegration, confirmationLink,
      }),
    });

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Internal server error' });
      return;
    }

    res.json({ message: 'confirmation-sent' });
  });

  return router;
}

interface TrailerEmailData {
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  whatsapp: string;
  campany: string;
  industry: string;
  campanySize: string;
  chatVolume: string;
  website: string;
  plan: string;
  aiConnect: string;
  aiIntegration: string;
  confirmationLink: string;
}

function buildTrailerConfirmationEmail(d: TrailerEmailData): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <img src="https://res.cloudinary.com/dcsjywfui/image/upload/v1771925146/bi_bctaie.png" alt="Company Logo" style="max-height: 60px; margin-bottom: 20px;" />

          <h2>Hi ${d.name || 'there'},</h2>
          <p>Thank you for requesting a ${d.plan} plan subscription. Please confirm your email to complete your request.</p>
          <p>Once confirmed, our team will review your information and get in touch to schedule your onboarding.</p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${d.confirmationLink}" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Confirm Your ${d.plan} Plan Subscription Request
            </a>
            <p style="text-align: center; margin: 5px 0;">This link is valid only for 60 minutes</p>
          </p>

          <h3>Here's a copy of the information you submitted:</h3>
          <ul>
            <li><strong>Name:</strong> ${d.name}</li>
            <li><strong>Email:</strong> ${d.email}</li>
            <li><strong>Phone:</strong> ${d.phone}</li>
            <li><strong>Address:</strong> ${d.city} - ${d.country}</li>
            <li><strong>Whatsapp:</strong> ${d.whatsapp}</li>
            <li><strong>Business Name:</strong> ${d.campany}</li>
            <li><strong>Industry:</strong> ${d.industry}</li>
            <li><strong>Company Size:</strong> ${d.campanySize || 'N/A'}</li>
            <li><strong>Daily Chats:</strong> ${d.chatVolume || 'N/A'}</li>
            <li><strong>Website:</strong> ${d.website || 'N/A'}</li>
            <li><strong>Selected Plan:</strong> ${d.plan}</li>
            <li><strong>Departments or services should the AI connect to:</strong> ${d.aiConnect}</li>
            <li><strong>System integration during the trial:</strong> ${d.aiIntegration}</li>
          </ul>

          <p>After your approval, you will receive a follow-up within 24–48 hours to discuss your needs and next steps.</p>
          <p>We look forward to working with you!</p>

          <hr />
          <p style="font-size: 0.9em;">The Blue Innovation Team<br/>www.theblueinnovation.com</p>
        </div>
      </body>
    </html>
  `;
}
