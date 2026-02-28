export interface UserSysFields {
  user_sys_id?: number;
  email?: string;
  password?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  phone?: string | null;
  role_id?: number;
  role_name?: string;
  access?: any;
  code?: string | null;
  edu_lev_id?: number;
  inst_id?: number;
  flag_valid?: boolean;
  user_status?: string;
  profile_pic?: string | null;

  created_at?: string;
  updated_at?: string;
  remark?: string;

  program_name?: string;
  level_name?: string;
  learning_area_id?: number;
  learning_area_name?: string;
  total_count?: number;
  position?: string;

  program_id?: number;
  offset?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';

  keyword?: string;
}
