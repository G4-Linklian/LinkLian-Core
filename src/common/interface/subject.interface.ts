export interface subjectFields {
  subject_id?: number | string;
  learning_area_id?: number | string;
  learning_area_name?: string;
  subject_code?: string;
  name_th?: string;
  name_en?: string;
  credit?: number;
  hour_per_week?: number;
  flag_valid?: boolean;
  inst_id?: number;
  offset?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  total_count?: number;

  keyword?: string;
}
