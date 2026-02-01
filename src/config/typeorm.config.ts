import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserSys } from '../modules/users/entities/user-sys.entity';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  entities: [UserSys],
  synchronize: false, // ⚠️ Don't auto-sync in production
  logging: process.env.NODE_ENV === 'development',
};
