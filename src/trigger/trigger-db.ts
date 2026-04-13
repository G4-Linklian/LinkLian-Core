import { DataSource, DataSourceOptions } from 'typeorm';

export const triggerDataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    ssl: true,
    extra: {
        ssl: {
            rejectUnauthorized: false,
        },
    },
};
