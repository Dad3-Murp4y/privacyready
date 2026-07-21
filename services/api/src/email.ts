import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const REGION = process.env.AWS_REGION || 'eu-west-2';
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@privacyready.co.uk';

const ses = new SESClient({ region: REGION });

/**
 * Sends transactional email via SES.
 *
 * NOTE: a new AWS account's SES is in "sandbox mode" by default, which
 * only allows sending to individually-verified recipient addresses --
 * it will silently fail (MessageRejected) for arbitrary Gmail/etc
 * addresses until you request production access in the SES console
 * (Account dashboard -> Request production access). This can't be
 * done via Terraform; it's a manual AWS support request, usually
 * approved within a day.
 */
export async function sendEmail(to: string, subject: string, htmlBody: string, textBody: string) {
  const command = new SendEmailCommand({
    Source: `PrivacyReady <${FROM_EMAIL}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlBody, Charset: 'UTF-8' },
        Text: { Data: textBody, Charset: 'UTF-8' }
      }
    }
  });

  return ses.send(command);
}

export async function sendVerificationEmail(to: string, fullName: string, verifyUrl: string) {
  const subject = 'Verify your PrivacyReady account';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Welcome to PrivacyReady, ${escapeHtml(fullName)}</h2>
      <p>Confirm your email address to activate your account:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#19376D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Verify email</a></p>
      <p>Or paste this link into your browser: ${verifyUrl}</p>
      <p style="color:#888;font-size:13px;">This link expires in 24 hours. If you didn't create a PrivacyReady account, you can ignore this email.</p>
    </div>
  `;
  const text = `Welcome to PrivacyReady, ${fullName}\n\nConfirm your email address: ${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create a PrivacyReady account, you can ignore this email.`;
  return sendEmail(to, subject, html, text);
}

export async function sendTeamInviteEmail(to: string, fullName: string, orgName: string, tempPassword: string, verifyUrl: string) {
  const subject = `You've been added to ${orgName} on PrivacyReady`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Hi ${escapeHtml(fullName)},</h2>
      <p>You've been added to <strong>${escapeHtml(orgName)}</strong>'s PrivacyReady account.</p>
      <p>Your temporary password: <code style="background:#f0f0f0;padding:4px 8px;border-radius:4px;">${escapeHtml(tempPassword)}</code></p>
      <p>Verify your email and log in to get started:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#19376D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Verify email</a></p>
      <p style="color:#888;font-size:13px;">We'd recommend changing your password after your first login. This link expires in 24 hours.</p>
    </div>
  `;
  const text = `Hi ${fullName},\n\nYou've been added to ${orgName}'s PrivacyReady account.\n\nYour temporary password: ${tempPassword}\n\nVerify your email: ${verifyUrl}\n\nWe'd recommend changing your password after your first login. This link expires in 24 hours.`;
  return sendEmail(to, subject, html, text);
}

function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
