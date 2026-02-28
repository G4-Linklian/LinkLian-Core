import 'express';
import { JwtPayload } from 'src/common/interface/payload.interface';

declare module 'express' {
  interface Request {
    user?: JwtPayload;
    req_from?: 'user' | 'institution' | 'unknown';
  }
}
