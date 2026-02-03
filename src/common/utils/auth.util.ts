// common/utils/auth.util.ts
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';

/**
 * Hash password with bcrypt + custom salt from env
 * Flow: password + SALTNUMBER → bcrypt.hash()
 */
export async function hashPassword(password: string): Promise<string> {
  const customSalt = process.env.SALTNUMBER || '';
  const saltedPassword = password + customSalt; // ✅ เพิ่ม custom salt ก่อน hash
  const bcryptRounds = 10; // bcrypt rounds (ไม่ใช่ custom salt)
  
  console.log('═══════════════════════════════════════════════');
  console.log('🔐 [AUTH UTIL] hashPassword');
  console.log('═══════════════════════════════════════════════');
  console.log('🔐 Input password length:', password.length);
  console.log('🔐 Custom salt from env:', customSalt ? `"${customSalt}"` : '(empty)');
  console.log('🔐 Salted password length:', saltedPassword.length);
  console.log('🔐 Bcrypt rounds:', bcryptRounds);
  
  const hash = await bcrypt.hash(saltedPassword, bcryptRounds);
  
  console.log('🔐 Hash generated:', hash.substring(0, 29) + '...');
  console.log('🔐 Hash length:', hash.length);
  console.log('✅ Password hashed with custom salt successfully');
  console.log('═══════════════════════════════════════════════');
  
  return hash;
}

/**
 * Verify password against hashed password
 * Flow: password + SALTNUMBER → bcrypt.compare()
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const customSalt = process.env.SALTNUMBER || '';
  const saltedPassword = password + customSalt; // ✅ เพิ่ม custom salt ก่อน compare
  
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 [AUTH UTIL] verifyPassword');
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 Input password length:', password.length);
  console.log('🔍 Custom salt from env:', customSalt ? `"${customSalt}"` : '(empty)');
  console.log('🔍 Salted password length:', saltedPassword.length);
  console.log('🔍 Stored hash:', hashedPassword.substring(0, 29) + '...');
  
  const isValid = await bcrypt.compare(saltedPassword, hashedPassword);
  
  console.log('🔍 Verification result:', isValid ? '✅ MATCH' : '❌ NO MATCH');
  console.log('═══════════════════════════════════════════════');
  
  return isValid;
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