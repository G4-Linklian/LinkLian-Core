// auth.utils.ts
import * as bcrypt from 'bcrypt';

/**
 * Generate random initial password
 * Format: LINKLIIAN + 8 random characters (uppercase, lowercase, numbers)
 * Example: LINKLIIANBs4Uds
 */
export function generateInitialPassword(): string {
  const prefix = 'LINKLIAN';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let randomPart = '';
  
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return prefix + randomPart;
}

/**
 * Hash password with bcrypt salt
 */
export async function hashPasswordWithSalt(password: string): Promise<string> {
  const saltRounds = process.env.SALTNUMBER ? process.env.SALTNUMBER : "10";
  const combined = password + saltRounds;
  return bcrypt.hash(combined, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const saltRounds = process.env.SALTNUMBER ? process.env.SALTNUMBER : "10";
  const combined = password + saltRounds;
  return bcrypt.compare(combined, hash);
}
