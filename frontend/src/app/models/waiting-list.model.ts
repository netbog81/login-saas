export type WaitingListStatus = 'WAITING' | 'CONTACTED' | 'SCHEDULED' | 'REMOVED';

export interface WaitingListEntry {
  id: string;
  patientId: string | null;
  patientName: string;
  phone: string | null;
  operatorId: string | null;
  notes: string | null;
  priority: number;
  position: number;
  status: WaitingListStatus;
  createdAt: string;
  updatedAt: string;
  operator?: {
    id: string;
    name: string;
    surname?: string;
    color?: string;
  };
}

export interface CreateWaitingListEntryInput {
  patientId?: string;
  patientName: string;
  phone?: string;
  operatorId?: string;
  notes?: string;
  priority: number;
}

export interface UpdateWaitingListEntryInput {
  patientName?: string;
  phone?: string;
  operatorId?: string | null;
  notes?: string;
  priority?: number;
  position?: number;
  status?: WaitingListStatus;
}
