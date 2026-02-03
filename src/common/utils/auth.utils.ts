// auth.utils.ts
import * as bcrypt from 'bcrypt';

/**
 * Generate random initial password
 * Format: LINKLIAN + 8 random characters (uppercase, lowercase, numbers)
 * Example: LINKLIANBs4Uds12
 */
export function generateInitialPassword(): string {
  const prefix = 'LINKLIAN';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let randomPart = '';
  
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const password = prefix + randomPart;
  console.log('🔑 [AUTH UTILS] Generated initial password:', password);
  
  return password;
}

/**
 * Hash password with bcrypt + custom salt from env
 * Flow: password + SALTNUMBER → bcrypt.hash()
 */
export async function hashPasswordWithSalt(password: string): Promise<string> {
  const customSalt = process.env.SALTNUMBER || '';
  const saltedPassword = password + customSalt;
  const bcryptRounds = 10;
  
  console.log('🔐 [AUTH UTILS] hashPasswordWithSalt');
  console.log('🔐 Custom salt from env:', customSalt ? `"${customSalt}"` : '(empty)');
  
  const hash = await bcrypt.hash(saltedPassword, bcryptRounds);
  
  console.log('✅ [AUTH UTILS] Password hashed with custom salt');
  
  return hash;
}

/**
 * Compare password with hash
 * Flow: password + SALTNUMBER → bcrypt.compare()
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const customSalt = process.env.SALTNUMBER || '';
  const saltedPassword = password + customSalt;
  
  console.log('🔍 [AUTH UTILS] comparePassword');
  console.log('🔍 Custom salt from env:', customSalt ? `"${customSalt}"` : '(empty)');
  
  const isValid = await bcrypt.compare(saltedPassword, hash);
  
  console.log('🔍 [AUTH UTILS] Compare result:', isValid ? '✅ MATCH' : '❌ NOT MATCH');
  
  return isValid;
}
