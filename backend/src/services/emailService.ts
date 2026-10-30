import axios from 'axios';
import { config } from '../config.js';

if (config.brevoApiKey && config.brevoApiKey.trim() !== '') {
  console.log(`[EMAIL] Brevo HTTPS email service initialized for: ${config.emailUser}`);
} else {
  console.warn(
    '[EMAIL] BREVO_API_KEY is not configured. Reset links will be printed to backend console for local development.'
  );
}

export const emailService = {
  /**
   * Sends a password reset email using Brevo's HTTPS REST API.
   * Runs over Port 443 (HTTPS) - never blocked by Render, Vercel, or cloud firewalls.
   */
  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<boolean> {
    if (!config.brevoApiKey || config.brevoApiKey.trim() === '') {
      console.log('================================================================');
      console.log(`🔑 [DEV PASSWORD RESET] To: ${toEmail}`);
      console.log(`🔗 Reset Link: ${resetUrl}`);
      console.log('(Add BREVO_API_KEY to your environment to send real emails via Brevo)');
      console.log('================================================================');
      return true;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your LinkUp Password</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1117; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #161b22; border-radius: 12px; border: 1px solid #30363d; padding: 36px 32px; box-shadow: 0 12px 32px rgba(0,0,0,0.4);">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); width: 44px; height: 44px; border-radius: 10px; line-height: 44px; text-align: center; font-size: 20px; font-weight: bold; color: #ffffff;">
                      ⚡
                    </div>
                    <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 6px 0; letter-spacing: -0.3px;">LinkUp Workspace</h1>
                    <p style="color: #8b949e; font-size: 14px; margin: 0;">Intelligent Knowledge Management</p>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #21262d; padding-top: 24px;">
                    <h2 style="color: #f0f6fc; font-size: 18px; margin: 0 0 12px 0;">Password Reset Request</h2>
                    <p style="color: #c9d1d9; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                      We received a request to reset the password for your LinkUp account (<strong>${toEmail}</strong>).
                      Click the button below to choose a new password:
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="color: #8b949e; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                      Or copy and paste this link in your browser:<br>
                      <a href="${resetUrl}" style="color: #58a6ff; word-break: break-all; font-size: 12px;">${resetUrl}</a>
                    </p>
                    <p style="color: #8b949e; font-size: 12px; margin: 0 0 8px 0;">
                      ⏱️ <strong>This link is valid for 15 minutes.</strong> If you did not request a password reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #21262d; padding-top: 20px; text-align: center;">
                    <p style="color: #6e7681; font-size: 12px; margin: 0;">
                      &copy; ${new Date().getFullYear()} LinkUp. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: 'LinkUp Support',
            email: config.emailUser,
          },
          to: [
            {
              email: toEmail,
            },
          ],
          subject: 'Reset your LinkUp password',
          htmlContent: emailHtml,
        },
        {
          headers: {
            'api-key': config.brevoApiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log(`[EMAIL] Password reset email sent via Brevo HTTPS API to ${toEmail} (Message ID: ${response.data?.messageId})`);
      return true;
    } catch (err: any) {
      const errorDetail = err.response?.data?.message || err.message;
      console.error('[EMAIL] Failed to send email via Brevo API:', errorDetail);
      return false;
    }
  },
};
