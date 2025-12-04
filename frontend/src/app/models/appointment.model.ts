import { User } from './user.model';
import { Patient } from './patient.model';
import { Operator } from '../graphql/generated/types';

export interface RepeatConfig {
  enabled: boolean;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  selectedDays: number[];
  endType: 'never' | 'after' | 'until';
  occurrences: number;
  untilDate: string;
}

export interface Appointment {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  operatorId: string;
  operator?: Operator;
  patientId?: number;
  patient?: Patient;
  notes?: string;
  repeat?: RepeatConfig;
  recurringGroupId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
