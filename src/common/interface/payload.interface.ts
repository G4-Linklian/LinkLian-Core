import { AccessControl } from './access.interface';

// Define the structure of the JWT payload for user authentication
export interface UserJwtPayload {
  type: 'user';

  user_id: string;
  username: string;
  role_id: string;
  inst_id: string;
  role_name: string;

  access: AccessControl;

  otp_verified: boolean;

  iat: number;
  exp: number;
}

// Define the structure of the JWT payload for institution authentication
export interface InstitutionInfo {
  inst_id: number;
  inst_email: string;
  inst_name_th: string;
  inst_name_en: string;
  inst_abbr_th: string;
  inst_abbr_en: string;
  inst_type: string;
  inst_phone: string;
  website: string;
  address: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  logo_url: string;
  docs_url: string;
  approve_status: string;
  flag_valid: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstitutionJwtPayload {
  institution: InstitutionInfo;
  iat: number;
  exp: number;
}

// Union type for the JWT payload, which can be either for a user or an institution
export type JwtPayload = UserJwtPayload | InstitutionJwtPayload;
