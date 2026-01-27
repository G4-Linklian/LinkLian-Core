// mailer.utils.ts
import * as nodemailer from 'nodemailer';

/**
 * Send initial password email to new user
 */
export async function sendInitialPasswordEmail(email: string, password: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@smartgis.com',
    to: email,
    subject: 'Your Initial Password - SmartGIS',
    html: `
      <h2>Welcome to SmartGIS</h2>
      <p>Your account has been created successfully.</p>
      <p>Here is your initial password:</p>
      <p style="font-size: 24px; font-weight: bold; color: #333; background: #f5f5f5; padding: 10px; display: inline-block;">${password}</p>
      <p>Please change your password after your first login.</p>
      <br>
      <p>Best regards,</p>
      <p>SmartGIS Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Initial password email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@smartgis.com',
    to: email,
    subject: 'Password Reset - SmartGIS',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <br>
      <p>Best regards,</p>
      <p>SmartGIS Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
