export interface learningAreaFields {
  learning_area_id?: number;
  inst_id?: number;
  learning_area_name?: string;
  remark?: string;
  flag_valid?: boolean;
  offset?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  subject_count?: boolean;
  total_count?: number;
  keyword?: string;
  user_sys_id?: number;
}
