export interface eduLevelFields {
  edu_lev_id?: number;
  level_name?: string;
  edu_type?: string;
  flag_valid?: boolean;
  level_num?: number;

  program_id?: number;
  inst_id?: number;
  parent_id?: number;
  program_name?: string;
  remark?: string;

  offset?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';

  total_count?: number;
}
