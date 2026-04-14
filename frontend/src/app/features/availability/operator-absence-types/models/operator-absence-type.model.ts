/**
 * Tassonomia configurabile dei tipi di assenza operatore
 * (es. Ferie, Malattia, Permesso, ...)
 */
export interface OperatorAbsenceType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOperatorAbsenceTypeInput {
  name: string;
  description?: string;
}

export interface UpdateOperatorAbsenceTypeInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}
