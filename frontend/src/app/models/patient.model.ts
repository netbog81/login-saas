export interface Patient {
  id: number;
  name: string;
  surname: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt?: Date;
}
