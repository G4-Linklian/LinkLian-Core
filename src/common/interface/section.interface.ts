export interface sectionFields {
  section_id?: number;
  subject_id?: number;
  semester_id?: number;
  section_name?: string;
  flag_valid?: boolean;

  schedule_id?: number;
  day_of_week?: number | string;
  start_time?: Date;
  end_time?: Date;
  room_location_id?: number;
  room_number?: string;
  floor?: string;

  building_id?: number | string;
  building_name?: string;
  building_no?: string;
  room_format?: string;

  learning_area_name?: string;
  subject_code?: string;
  name_th?: string;
  name_en?: string;
  credit?: number;
  semester?: string;
  hour_per_week?: number;

  inst_id?: number;

  user_sys_id?: number;

  role_id?: number;
  role_name?: string;
  role_type?: string;

  position?: string;

  total_count?: number;
  keyword?: string;
  program_id?: number;

  learning_area_id?: number;

  offset?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';

  count_student?: boolean;

  email?: string;
  password?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  user_status?: string;
  code?: string;
  level_name?: string;
  edu_lev_id?: number;
}
