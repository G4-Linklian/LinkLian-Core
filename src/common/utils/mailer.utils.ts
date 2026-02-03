// mailer.utils.ts
import * as nodemailer from 'nodemailer';

/**
 * Send initial password email to new user
 */
export async function sendInitialPasswordEmail(email: string, password: string): Promise<void> {
  console.log('📧 [MAILER] Starting sendInitialPasswordEmail...');
  console.log('📧 [MAILER] Target email:', email);
  console.log('📧 [MAILER] SMTP Config:', {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    hasPassword: !!process.env.SMTP_PASS,
  });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('📧 [MAILER] Transporter created');

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@smartgis.com',
    to: email,
    subject: 'Your Initial Password - LinkLian',
    html: `
      <h2>Welcome to LinkLian</h2>
      <p>Your account has been created successfully.</p>
      <p>Here is your initial password:</p>
      <p style="font-size: 24px; font-weight: bold; color: #333; background: #f5f5f5; padding: 10px; display: inline-block;">${password}</p>
      <p>Please change your password after your first login.</p>
      <br>
      <p>Best regards,</p>
      <p>LinkLian Team</p>
    `,
  };

  console.log('📧 [MAILER] Mail options prepared');

  try {
    console.log('📧 [MAILER] Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [MAILER] Email sent successfully!');
    console.log('✅ [MAILER] Message ID:', info.messageId);
    console.log('✅ [MAILER] Response:', info.response);
  } catch (error) {
    console.error('❌ [MAILER] Error sending email:', error);
    console.error('❌ [MAILER] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    throw error;
  }
}

/**
 * Send OTP email
 */
export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  console.log('📧 [MAILER] Starting sendOTPEmail...');
  console.log('📧 [MAILER] Target email:', email);
  console.log('📧 [MAILER] OTP:', otp);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('📧 [MAILER] Transporter created for OTP');

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'LinkLian.edu@gmail.com',
    to: email,
    subject: 'Your OTP Code - LinkLian',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">LinkLian - OTP Verification</h2>
        <p>Your OTP code is:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="color: #666;">This code will expire in 5 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        <br>
        <p>Best regards,</p>
        <p>LinkLian Team</p>
      </div>
    `,
  };

  console.log('📧 [MAILER] Mail options prepared for OTP');

  try {
    console.log('📧 [MAILER] Sending OTP email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [MAILER] OTP email sent successfully!');
    console.log('✅ [MAILER] Message ID:', info.messageId);
    console.log('✅ [MAILER] Response:', info.response);
  } catch (error) {
    console.error('❌ [MAILER] Error sending OTP email:', error);
    console.error('❌ [MAILER] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    throw error;
  }
}

/**
 * Send temporary password email (for forgot password)
 */
export async function sendTempPasswordEmail(email: string, tempPassword: string): Promise<void> {
  console.log('📧 [MAILER] Starting sendTempPasswordEmail...');
  console.log('📧 [MAILER] Target email:', email);
  console.log('📧 [MAILER] Temporary password:', tempPassword);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('📧 [MAILER] Transporter created for temp password');

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'LinkLian.edu@gmail.com',
    to: email,
    subject: 'Temporary Password - LinkLian',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">LinkLian - Password Reset</h2>
        <p>Your temporary password has been generated:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #dc3545;">${tempPassword}</span>
        </div>
        <p style="color: #666;">Please use this password to login, then change it immediately for security.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please contact support immediately.</p>
        <br>
        <p>Best regards,</p>
        <p>LinkLian Team</p>
      </div>
    `,
  };

  console.log('📧 [MAILER] Mail options prepared for temp password');

  try {
    console.log('📧 [MAILER] Sending temp password email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [MAILER] Temp password email sent successfully!');
    console.log('✅ [MAILER] Message ID:', info.messageId);
    console.log('✅ [MAILER] Response:', info.response);
  } catch (error) {
    console.error('❌ [MAILER] Error sending temp password email:', error);
    console.error('❌ [MAILER] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  console.log('📧 [MAILER] Starting sendPasswordResetEmail...');
  console.log('📧 [MAILER] Target email:', email);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('📧 [MAILER] Transporter created for password reset');

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'LinkLian.edu@gmail.com',
    to: email,
    subject: 'Password Reset - LinkLian',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <br>
      <p>Best regards,</p>
      <p>LinkLian Team</p>
    `,
  };

  console.log('📧 [MAILER] Mail options prepared for password reset');

  try {
    console.log('📧 [MAILER] Sending password reset email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [MAILER] Password reset email sent successfully!');
    console.log('✅ [MAILER] Message ID:', info.messageId);
    console.log('✅ [MAILER] Response:', info.response);
  } catch (error) {
    console.error('❌ [MAILER] Error sending password reset email:', error);
    console.error('❌ [MAILER] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    throw error;
  }
}
