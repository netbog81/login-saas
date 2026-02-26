import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.MIGRATOR_DB_USERNAME || 'migrator',
  password: process.env.MIGRATOR_DB_PASSWORD || 'migrator',
  database: process.env.DB_DATABASE || 'calendar_db',
  entities: [join(__dirname, '**/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
  logging: true,
});