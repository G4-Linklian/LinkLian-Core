// common/utils/auth.util.ts
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = process.env.SALTNUMBER ? process.env.SALTNUMBER : "10";
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hashed password
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const saltRounds = process.env.SALTNUMBER ? process.env.SALTNUMBER : "10";
  return bcrypt.compare(password+saltRounds, hashedPassword);
}

/**
 * Generate JWT Token
 */
export function generateJwtToken(payload: object, expiresIn: string | number = '24h'): string {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const options: SignOptions = { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, options);
}

/**
 * Verify JWT Token
 */
export function verifyJwtToken(token: string): any {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.verify(token, secret);
}