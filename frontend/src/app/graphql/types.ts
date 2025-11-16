// Enums
export enum OperatorType {
  STANDARD = 'STANDARD',
  GYM = 'GYM',
  RESOURCE = 'RESOURCE',
}

export enum ExceptionType {
  UNAVAILABLE = 'unavailable',
  MODIFIED = 'modified',
  HOLIDAY = 'holiday',
  SICK = 'sick',
  VACATION = 'vacation',
}

// Entity Types
export interface Operator {
  id: string;
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  color?: string;
  type: OperatorType;
  maxConcurrentAppointments: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  availabilityTemplates?: AvailabilityTemplate[];
  availabilityExceptions?: AvailabilityException[];
  operatorServices?: OperatorService[];
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  defaultDuration: number; // in minutes
  defaultPrice: number;
  bufferTimeBefore: number; // in minutes
  bufferTimeAfter: number; // in minutes
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  operatorServices?: OperatorService[];
}

export interface OperatorService {
  operatorId: string;
  serviceId: string;
  operator?: Operator;
  service?: Service;
  customDuration?: number;
  customBufferTime?: number;
}

export interface AvailabilityTemplate {
  id: string;
  operatorId: string;
  operator?: Operator;
  name?: string;
  description?: string;
  dayInPattern: number;
  patternDuration: number;
  patternStartDate: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  version: number;
  isCurrent: boolean;
  validFrom: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailabilityException {
  id: string;
  operatorId: string;
  operator?: Operator;
  exceptionDate: Date;
  exceptionType: ExceptionType;
  startTime?: string; // HH:mm format for modified type
  endTime?: string;   // HH:mm format for modified type
  groupExceptionId?: string;
  groupException?: GroupException;
  reason?: string;
  createdAt: Date;
}

export interface GroupException {
  id: string;
  name: string;
  exceptionDate: Date;
  exceptionType: string;
  appliesToAll: boolean;
  reason?: string;
  exceptions?: AvailabilityException[];
  operators?: Operator[];
  createdAt: Date;
}

export interface AvailabilityCache {
  id: string;
  operatorId: string;
  operator?: Operator;
  availableDate: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  totalCapacity: number;
  bookedCapacity: number;
  source?: string;
  sourceId?: string;
  lastUpdated: Date;
}

export interface AvailabilityAppointment {
  id: string;
  operatorId: string;
  operator?: Operator;
  serviceId?: string;
  service?: Service;
  appointmentDate: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  status: string;
  participantCount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// DTOs
export interface AvailabilitySlot {
  operatorId: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  totalCapacity: number;
  bookedCapacity: number;
  availableCapacity: number;
  isAvailable: boolean;
  source: string;
  sourceId?: string;
}

export interface DailyAvailability {
  date: string; // YYYY-MM-DD format
  hasAvailability: boolean;
  slots: AvailabilitySlot[];
}

// Input Types
export interface CreateOperatorInput {
  name: string;
  surname?: string;
  email: string;
  phone?: string;
  color?: string;
  type?: OperatorType;
  maxConcurrentAppointments?: number;
  isActive?: boolean;
}

export interface UpdateOperatorInput {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  color?: string;
  type?: OperatorType;
  isActive?: boolean;
  maxConcurrentAppointments?: number;
}

export interface CreateServiceInput {
  name: string;
  description?: string;
  defaultDuration: number;
  defaultPrice?: number;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  color?: string;
  isActive?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  defaultDuration?: number;
  defaultPrice?: number;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  color?: string;
  isActive?: boolean;
}

export interface AssignServiceToOperatorInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
}

export interface UpdateOperatorServiceInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
}

export interface CreateAvailabilityTemplateInput {
  operatorId: string;
  name?: string;
  description?: string;
  dayInPattern: number;
  patternDuration: number;
  patternStartDate: string; // YYYY-MM-DD format
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  validFrom: string; // YYYY-MM-DD format
  validUntil?: string; // YYYY-MM-DD format
}

export interface UpdateAvailabilityTemplateInput extends CreateAvailabilityTemplateInput {
}

export interface CreateAvailabilityExceptionInput {
  operatorId: string;
  date: string; // YYYY-MM-DD format
  type: string;
  startTime?: string; // HH:mm format
  endTime?: string;   // HH:mm format
  reason?: string;
}

export interface CreateGroupExceptionInput {
  name: string;
  exceptionDate: string; // YYYY-MM-DD format
  exceptionType: string;
  appliesToAll?: boolean;
  operatorIds?: string[];
  reason?: string;
}

export interface AssignServiceToOperatorInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
  customBufferTime?: number;
}

export interface UpdateOperatorServiceInput {
  operatorId: string;
  serviceId: string;
  customDuration?: number;
  customBufferTime?: number;
}