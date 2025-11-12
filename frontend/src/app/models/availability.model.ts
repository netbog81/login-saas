import { User } from './user.model';

export interface Availability {
  id: number;
  userId: number;
  user?: User;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  createdAt?: Date;
}
