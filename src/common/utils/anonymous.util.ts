/**
 * Generate anonymous display name based on user_sys_id and section_id
 * Same logic as LinkLian-API
 */
export function generateAnonymousName(
  userSysId: number,
  sectionId: number,
): string {
  // Create a simple hash from user_id + section_id
  const hash = (userSysId * 31 + sectionId * 17) % 10000;
  return `ผู้ใช้ไม่ระบุตัวตน ${hash.toString().padStart(4, '0')}`;
}