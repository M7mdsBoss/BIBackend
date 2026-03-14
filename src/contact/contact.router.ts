import { Router, Request, Response } from 'express';
import { sendEmail } from '../shared/mail.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BCC = [
  'Motaz@theblueinnovation.com',
  'Mohammed@theblueinnovation.com',
  'Fahad@theblueinnovation.com',
];

export function createContactRouter() {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const { name, email, phone, website, volume } = req.body as Record<string, string>;

    if (!name || !email || !phone || !volume) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address' });
      return;
    }

    const result = await sendEmail({
      to: process.env.CONTACT_MAIL!,
      subject: 'Blue innovation - Conversation',
      bcc: BCC,
      htmlBody: `
        <html>
          <body>
            <div style="font-family: Arial, sans-serif;">
              <h4>Full: ${name}</h4>
              <h4>Email: ${email}</h4>
              <h4>Phone: ${phone}</h4>
              <h4>Website: ${website}</h4>
              <h4>Daily Whatsapp Chat Volume: ${volume}</h4>
            </div>
          </body>
        </html>
      `,
    });

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Internal server error' });
      return;
    }

    res.json({ message: 'Message sent successfully' });
  });

  return router;
}
