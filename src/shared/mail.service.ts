import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  bcc?: string | string[];
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  htmlBody,
  bcc,
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_LOG,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transport.verify();

    const mailOptions: nodemailer.SendMailOptions = {
      from: `The Blue Innovation <${process.env.EMAIL_LOG}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html: htmlBody,
    };

    if (bcc && (Array.isArray(bcc) ? bcc.length > 0 : true)) {
      mailOptions.bcc = Array.isArray(bcc) ? bcc.join(',') : bcc;
    }

    await transport.sendMail(mailOptions);
    transport.close();

    return { success: true };
  } catch (error) {
    console.error('SMTP Error:', error);
    return {
      success: false,
      error: (error as Error).message ?? 'Internal server error',
    };
  }
}
