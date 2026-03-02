export const IMPORT_BATCH_SIZE = 50;
export const IMPORT_MAX_CONCURRENT_BATCHES = 5;

// Token settings
export const VALIDATION_TOKEN_EXPIRY = '30m';

// Status mapping สำหรับ user
export const USER_STATUS_MAP: Record<string, string> = {
  ใช้งาน: 'Active',
  ไม่ใช้งาน: 'Inactive',
  ลาออก: 'Resigned',
  สำเร็จการศึกษา: 'Graduated',
  เกษียณ: 'Retired',
};
