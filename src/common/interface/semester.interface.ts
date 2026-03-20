export interface semesterFields {
  semester_id?: number;
  inst_id?: number;
  semester?: string;
  start_date?: Date | string;
  end_date?: Date | string;
  flag_valid?: boolean;
  status?: string;
  offset?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  total_count?: number;

  subject_id?: number;

  year_numeric?: number;
  term_numeric?: number;
}
