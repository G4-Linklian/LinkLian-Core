export interface ValidatedRow {
  row: number;
  data: any;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

export interface ValidationSummary {
  total: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  warningCount: number;
  willSaveCount: number;
}

export interface ValidationResponse {
  data: ValidatedRow[];
  summary: ValidationSummary;
  validationToken: string | null;
}

export interface SaveResponse {
  success: boolean;
  message: string;
  count: number;
  skippedCount: number;
  skippedReason: string | null;
}

export interface ImportValidationPayload {
  instId: number;
  semesterId?: number; // ใช้สำหรับ section-schedule
  sectionId?: number; // ใช้สำหรับ enrollment
  dataHash: string;
  validCount: number;
  duplicateCount: number;
  type:
    | 'student'
    | 'teacher'
    | 'subject'
    | 'program'
    | 'enrollment'
    | 'section-schedule';
  timestamp: number;
}
