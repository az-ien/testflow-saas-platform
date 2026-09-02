import axios from 'axios';
import { logger } from '../config/logger';

export const sendEmail = async (input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> => {
  const key = process.env.SENDGRID_API_KEY || '';
  if (!key || key.startsWith('SG.xxxxx')) {
    logger.info('SendGrid not configured; skipping email send', { to: input.to, subject: input.subject });
    return false;
  }
  await axios.post(
    'https://api.sendgrid.com/v3/mail/send',
    {
      personalizations: [{ to: [{ email: input.to }] }],
      from: {
        email: process.env.EMAIL_FROM || 'noreply@testflow.io',
        name: process.env.EMAIL_FROM_NAME || 'TestFlow',
      },
      subject: input.subject,
      content: [
        { type: 'text/plain', value: input.text },
        ...(input.html ? [{ type: 'text/html', value: input.html }] : []),
      ],
    },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 15000 }
  );
  return true;
};

export const emailVerificationEnabled = (): boolean => process.env.FEATURE_EMAIL_VERIFICATION === 'true';
