import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../typeorm.config';

// This file is used by TypeORM CLI for migrations
export const AppDataSource = new DataSource(dataSourceOptions);