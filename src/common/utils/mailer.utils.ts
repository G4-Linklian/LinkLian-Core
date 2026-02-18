// mailer.utils.ts
import * as nodemailer from 'nodemailer';
import { AppLogger } from 'src/common/logger/app-logger.service';

const logger = new AppLogger();

/**
 * Send initial password email to new user
 */
export async function sendInitialPasswordEmail(email: string, password: string): Promise<void> {
  logger.debug('Starting sendInitialPasswordEmail...', 'MAILER', {
    email: email,
  });
  logger.debug('SMTP Config:', 'MAILER', {
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

  logger.debug('Transporter created', 'MAILER');

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

  logger.debug('Mail options prepared', 'MAILER');

  try {
    logger.debug('Sending email...', 'MAILER');
    const info = await transporter.sendMail(mailOptions);
    logger.debug('Email sent successfully', 'MAILER', {
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error : any) {
    logger.error('Error sending email:', 'MAILER', error);
    logger.error('Error details:', 'MAILER', {
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
  logger.debug('Starting sendOTPEmail...', 'MAILER');
  logger.debug('SMTP Config:', 'MAILER', {
    email: email,
    otp: otp,
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

  logger.debug('Transporter created for OTP', 'MAILER');

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

  logger.debug('Mail options prepared for OTP', 'MAILER');

  try {
    logger.debug('Sending OTP email...', 'MAILER');
    const info = await transporter.sendMail(mailOptions);
    logger.debug('OTP email sent successfully', 'MAILER', {
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error : any) {
    logger.error('Error sending OTP email:', 'MAILER', error);
    logger.error('Error details:', 'MAILER', {
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
  logger.debug('Starting sendTempPasswordEmail...', 'MAILER');
  logger.debug('SMTP Config:', 'MAILER', {
    email: email,
    tempPassword: tempPassword,
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

  logger.debug('Transporter created for temp password', 'MAILER');

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

  logger.debug('Mail options prepared for temp password', 'MAILER');

  try {
    logger.debug('Sending temp password email...', 'MAILER');
    const info = await transporter.sendMail(mailOptions);
    logger.debug('Temp password email sent successfully', 'MAILER', {
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error : any) {
    logger.error('Error sending temp password email:', 'MAILER', error);
    logger.error('Error details:', 'MAILER', {
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
  logger.debug('Starting sendPasswordResetEmail...', 'MAILER');
  logger.debug('Target email:', 'MAILER', email);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  logger.debug('Transporter created for password reset', 'MAILER');

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

  logger.debug('Mail options prepared for password reset', 'MAILER');

  try {
    logger.debug('Sending password reset email...', 'MAILER');
    const info = await transporter.sendMail(mailOptions);
    logger.debug('Password reset email sent successfully', 'MAILER', {
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error : any) {
    logger.error('Error sending password reset email:', 'MAILER', error);
    logger.error('Error details:', 'MAILER', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    throw error;
  }
}
