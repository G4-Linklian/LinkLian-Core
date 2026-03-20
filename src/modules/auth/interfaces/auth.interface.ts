/**
 * OTP Session storage interface
 */
export interface IOTPSession {
  otp: string;
  email: string;
  userId: number;
  expiresAt: number;
  used: boolean;
  rememberMe: boolean;
}

/**
 * Login response (can include OTP session or token)
 */
export interface ILoginResponse {
  success: boolean;
  message: string;
  access_token?: string;
  user_id?: number;
  role_name?: string;
  inst_id?: number;
  otp_session_id?: string;
  otp_expires_at?: string;
  _dev_otp?: string;
  require_reset_password?: boolean; // ✅ เพิ่มนี้
}

/**
 * Verify OTP response (always includes token)
 */
export interface IVerifyResponse {
  success: boolean;
  message: string;
  access_token: string;
  user_id: number;
  role_name: string;
  inst_id: number;
}

/**
 * JWT Token payload structure
 */
export interface ITokenPayload {
  user_id: string;
  username: string;
  role_id: string;
  inst_id: string;
  role_name: string;
  access: any;
  otp_verified: boolean;
}

/**
 * Generic success response
 */
export interface ISuccessResponse {
  success: boolean;
  message: string;
}

/**
 * Token verify response
 */
export interface ITokenVerifyResponse extends ISuccessResponse {
  data: {
    user_id: number;
    username: string;
    role_id: number;
    role_name: string;
    inst_id: number;
    otp_verified: boolean;
  };
}

/**
 * Forgot password response (development only)
 */
export interface IForgotPasswordResponse extends ISuccessResponse {
  _dev_password?: string;
}

export interface RoleQueryResult {
  role_name: string;
  access?: Record<string, unknown>;
}
