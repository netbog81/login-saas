import { DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

// Import all entities
import { Operator } from './src/modules/availability/entities/operator.entity';
import { Service } from './src/modules/availability/entities/service.entity';
import { OperatorService } from './src/modules/availability/entities/operator-service.entity';
import { AvailabilityTemplate } from './src/modules/availability/entities/availability-template.entity';
import { AvailabilityException } from './src/modules/availability/entities/availability-exception.entity';
import { GroupException } from './src/modules/availability/entities/group-exception.entity';
import { AvailabilityCache } from './src/modules/availability/entities/availability-cache.entity';
import { Appointment } from './src/modules/availability/entities/appointment.entity';

export const getTypeOrmConfig = (configService: ConfigService): DataSourceOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DB_PASSWORD', 'postgres'),
  database: configService.get('DB_NAME', 'agenda'),

  entities: [
    Operator,
    Service,
    OperatorService,
    AvailabilityTemplate,
    AvailabilityException,
    GroupException,
    AvailabilityCache,
    Appointment,
    // Add other existing entities here
  ],

  migrations: ['dist/migrations/*.js'],

  synchronize: configService.get('NODE_ENV', 'development') === 'development', // Only in dev
  logging: configService.get('NODE_ENV', 'development') === 'development',

  migrationsTableName: 'migrations',
  migrationsRun: true, // Auto-run migrations on startup

  // Connection pool settings for production
  extra: {
    max: configService.get('DB_POOL_SIZE', 10),
    connectionTimeoutMillis: configService.get('DB_TIMEOUT', 10000),
  },
});

// For TypeORM CLI migrations
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'agenda',

  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],

  synchronize: false, // Never sync in production
  migrationsTableName: 'migrations',
};