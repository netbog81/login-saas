import { User } from './user.model';
import { Operator } from '../graphql/generated/types';

export interface Availability {
  id: number;
  operatorId: string;
  operator?: Operator;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  createdAt?: Date;
}
