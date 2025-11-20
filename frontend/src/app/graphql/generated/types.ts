export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
};

/** Status of the appointment */
export enum AppointmentStatus {
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Confirmed = 'CONFIRMED',
  InProgress = 'IN_PROGRESS',
  NoShow = 'NO_SHOW',
  Scheduled = 'SCHEDULED'
}

export type AssignTemplateToOperatorInput = {
  operatorId: Scalars['ID']['input'];
  patternStartDate: Scalars['String']['input'];
  templateName: Scalars['String']['input'];
  validFrom: Scalars['String']['input'];
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type AvailabilityAppointment = {
  __typename?: 'AvailabilityAppointment';
  appointmentDate: Scalars['DateTime']['output'];
  cancellationReason?: Maybe<Scalars['String']['output']>;
  clientEmail?: Maybe<Scalars['String']['output']>;
  clientName: Scalars['String']['output'];
  clientPhone?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  endTime: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  maxParticipants?: Maybe<Scalars['Int']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  participantCount: Scalars['Int']['output'];
  service?: Maybe<Service>;
  serviceId?: Maybe<Scalars['ID']['output']>;
  startTime: Scalars['String']['output'];
  status: AppointmentStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export type AvailabilityException = {
  __typename?: 'AvailabilityException';
  createdAt: Scalars['DateTime']['output'];
  endTime?: Maybe<Scalars['String']['output']>;
  exceptionDate: Scalars['DateTime']['output'];
  exceptionType: ExceptionType;
  groupException?: Maybe<GroupException>;
  groupExceptionId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  startTime?: Maybe<Scalars['String']['output']>;
};

export type AvailabilitySlot = {
  __typename?: 'AvailabilitySlot';
  availableCapacity: Scalars['Int']['output'];
  bookedCapacity: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  isAvailable: Scalars['Boolean']['output'];
  operatorId: Scalars['ID']['output'];
  source?: Maybe<Scalars['String']['output']>;
  sourceId?: Maybe<Scalars['ID']['output']>;
  startTime: Scalars['String']['output'];
  totalCapacity: Scalars['Int']['output'];
};

export type AvailabilityTemplate = {
  __typename?: 'AvailabilityTemplate';
  createdAt: Scalars['DateTime']['output'];
  dayInPattern: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  endTime: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isCurrent: Scalars['Boolean']['output'];
  name?: Maybe<Scalars['String']['output']>;
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  patternDuration: Scalars['Int']['output'];
  patternStartDate: Scalars['DateTime']['output'];
  startTime: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  validFrom: Scalars['DateTime']['output'];
  validUntil?: Maybe<Scalars['DateTime']['output']>;
  version: Scalars['Int']['output'];
};

export type CreateAvailabilityTemplateInput = {
  dayInPattern: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  patternDuration: Scalars['Int']['input'];
  patternStartDate: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
  validFrom: Scalars['String']['input'];
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTemplatePatternInput = {
  dayInPattern: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  name: Scalars['String']['input'];
  patternDuration: Scalars['Int']['input'];
  startTime: Scalars['String']['input'];
};

export type DailyAvailability = {
  __typename?: 'DailyAvailability';
  date: Scalars['String']['output'];
  hasAvailability: Scalars['Boolean']['output'];
  slots: Array<AvailabilitySlot>;
};

/** Type of availability exception */
export enum ExceptionType {
  Holiday = 'HOLIDAY',
  Modified = 'MODIFIED',
  Sick = 'SICK',
  Unavailable = 'UNAVAILABLE',
  Vacation = 'VACATION'
}

export type GroupException = {
  __typename?: 'GroupException';
  appliesToAll: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  exceptionDate: Scalars['DateTime']['output'];
  exceptionType: Scalars['String']['output'];
  exceptions?: Maybe<Array<AvailabilityException>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  operators?: Maybe<Array<Operator>>;
  reason?: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  assignServiceToOperator: OperatorService;
  assignTemplateToOperator: Array<TemplateAssignment>;
  createAvailabilityException: AvailabilityException;
  createAvailabilityTemplate: AvailabilityTemplate;
  createGroupException: GroupException;
  createOperator: Operator;
  createService: Service;
  createTemplatePattern: Array<TemplatePattern>;
  deleteAvailabilityTemplate: Scalars['Boolean']['output'];
  deleteGroupException: Scalars['Boolean']['output'];
  deleteOperator: Scalars['Boolean']['output'];
  deleteService: Scalars['Boolean']['output'];
  deleteTemplatePattern: Scalars['Boolean']['output'];
  rebuildAvailabilityCache: Scalars['Boolean']['output'];
  removeServiceFromOperator: Scalars['Boolean']['output'];
  updateAvailabilityTemplate: AvailabilityTemplate;
  updateOperator: Operator;
  updateOperatorService: OperatorService;
  updateService: Service;
  updateTemplatePattern: TemplatePattern;
};


export type MutationAssignServiceToOperatorArgs = {
  customBufferTime?: InputMaybe<Scalars['Int']['input']>;
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
};


export type MutationAssignTemplateToOperatorArgs = {
  input: AssignTemplateToOperatorInput;
};


export type MutationCreateAvailabilityExceptionArgs = {
  date: Scalars['String']['input'];
  endTime?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};


export type MutationCreateAvailabilityTemplateArgs = {
  input: CreateAvailabilityTemplateInput;
};


export type MutationCreateGroupExceptionArgs = {
  appliesToAll?: InputMaybe<Scalars['Boolean']['input']>;
  exceptionDate: Scalars['String']['input'];
  exceptionType: Scalars['String']['input'];
  name: Scalars['String']['input'];
  operatorIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  reason?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateOperatorArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  maxConcurrentAppointments?: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  operatorType?: OperatorType;
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateServiceArgs = {
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  defaultDuration: Scalars['Int']['input'];
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
};


export type MutationCreateTemplatePatternArgs = {
  input: CreateTemplatePatternInput;
};


export type MutationDeleteAvailabilityTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteGroupExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteServiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplatePatternArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRebuildAvailabilityCacheArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type MutationRemoveServiceFromOperatorArgs = {
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
};


export type MutationUpdateAvailabilityTemplateArgs = {
  id: Scalars['ID']['input'];
  input: CreateAvailabilityTemplateInput;
};


export type MutationUpdateOperatorArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  maxConcurrentAppointments?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  operatorType?: InputMaybe<OperatorType>;
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateOperatorServiceArgs = {
  customBufferTime?: InputMaybe<Scalars['Int']['input']>;
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
};


export type MutationUpdateServiceArgs = {
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  defaultDuration?: InputMaybe<Scalars['Int']['input']>;
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateTemplatePatternArgs = {
  id: Scalars['ID']['input'];
  input: CreateTemplatePatternInput;
};

export type Operator = {
  __typename?: 'Operator';
  appointments?: Maybe<Array<AvailabilityAppointment>>;
  availabilityExceptions?: Maybe<Array<AvailabilityException>>;
  availabilityTemplates?: Maybe<Array<AvailabilityTemplate>>;
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  maxConcurrentAppointments: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  operatorType: OperatorType;
  phone?: Maybe<Scalars['String']['output']>;
  services?: Maybe<Array<OperatorService>>;
  surname?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type OperatorService = {
  __typename?: 'OperatorService';
  customBufferTime?: Maybe<Scalars['Int']['output']>;
  customDuration?: Maybe<Scalars['Int']['output']>;
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  service: Service;
  serviceId: Scalars['ID']['output'];
};

/** Type of operator defining booking behavior */
export enum OperatorType {
  Gym = 'GYM',
  Resource = 'RESOURCE',
  Standard = 'STANDARD'
}

export type Query = {
  __typename?: 'Query';
  allOperatorServices: Array<OperatorService>;
  allTemplatePatterns: Array<TemplatePattern>;
  availabilityTemplates: Array<AvailabilityTemplate>;
  availableSlots: Array<AvailabilitySlot>;
  checkSlotAvailability: Scalars['Boolean']['output'];
  groupExceptions: Array<GroupException>;
  operator?: Maybe<Operator>;
  operatorAvailability: Array<DailyAvailability>;
  operatorServices: Array<OperatorService>;
  operators: Array<Operator>;
  service?: Maybe<Service>;
  serviceOperators: Array<OperatorService>;
  services: Array<Service>;
};


export type QueryAvailabilityTemplatesArgs = {
  onlyCurrent?: Scalars['Boolean']['input'];
  operatorId: Scalars['ID']['input'];
};


export type QueryAvailableSlotsArgs = {
  date: Scalars['String']['input'];
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryCheckSlotAvailabilityArgs = {
  date: Scalars['String']['input'];
  endTime: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startTime: Scalars['String']['input'];
};


export type QueryOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOperatorAvailabilityArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type QueryOperatorServicesArgs = {
  operatorId: Scalars['ID']['input'];
};


export type QueryServiceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryServiceOperatorsArgs = {
  serviceId: Scalars['ID']['input'];
};

export type Service = {
  __typename?: 'Service';
  appointments?: Maybe<Array<AvailabilityAppointment>>;
  bufferTimeAfter: Scalars['Int']['output'];
  bufferTimeBefore: Scalars['Int']['output'];
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  defaultDuration: Scalars['Int']['output'];
  defaultPrice: Scalars['Float']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  operators?: Maybe<Array<OperatorService>>;
  updatedAt: Scalars['DateTime']['output'];
};

export type TemplateAssignment = {
  __typename?: 'TemplateAssignment';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isCurrent: Scalars['Boolean']['output'];
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  pattern: TemplatePattern;
  patternId: Scalars['ID']['output'];
  patternStartDate: Scalars['DateTime']['output'];
  updatedAt: Scalars['DateTime']['output'];
  validFrom: Scalars['DateTime']['output'];
  validUntil?: Maybe<Scalars['DateTime']['output']>;
  version: Scalars['Int']['output'];
};

export type TemplatePattern = {
  __typename?: 'TemplatePattern';
  createdAt: Scalars['DateTime']['output'];
  dayInPattern: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  endTime: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  patternDuration: Scalars['Int']['output'];
  startTime: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type GetAvailableSlotsQueryVariables = Exact<{
  date: Scalars['String']['input'];
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetAvailableSlotsQuery = { __typename?: 'Query', availableSlots: Array<{ __typename?: 'AvailabilitySlot', operatorId: string, date: string, startTime: string, endTime: string, totalCapacity: number, bookedCapacity: number, availableCapacity: number, isAvailable: boolean, source?: string | null, sourceId?: string | null }> };

export type CheckSlotAvailabilityQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
  endTime: Scalars['String']['input'];
}>;


export type CheckSlotAvailabilityQuery = { __typename?: 'Query', checkSlotAvailability: boolean };

export type CreateAvailabilityExceptionMutationVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
  type: Scalars['String']['input'];
  startTime?: InputMaybe<Scalars['String']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateAvailabilityExceptionMutation = { __typename?: 'Mutation', createAvailabilityException: { __typename?: 'AvailabilityException', id: string, operatorId: string, exceptionDate: any, exceptionType: ExceptionType, startTime?: string | null, endTime?: string | null, groupExceptionId?: string | null, reason?: string | null, createdAt: any } };

export type CreateGroupExceptionMutationVariables = Exact<{
  name: Scalars['String']['input'];
  exceptionDate: Scalars['String']['input'];
  exceptionType: Scalars['String']['input'];
  appliesToAll?: InputMaybe<Scalars['Boolean']['input']>;
  operatorIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateGroupExceptionMutation = { __typename?: 'Mutation', createGroupException: { __typename?: 'GroupException', id: string, name: string, exceptionDate: any, exceptionType: string, appliesToAll: boolean, reason?: string | null, createdAt: any } };

export type DeleteGroupExceptionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteGroupExceptionMutation = { __typename?: 'Mutation', deleteGroupException: boolean };

export type GetGroupExceptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGroupExceptionsQuery = { __typename?: 'Query', groupExceptions: Array<{ __typename?: 'GroupException', id: string, name: string, exceptionDate: any, exceptionType: string, appliesToAll: boolean, reason?: string | null, createdAt: any, exceptions?: Array<{ __typename?: 'AvailabilityException', id: string, operatorId: string, exceptionDate: any, exceptionType: ExceptionType, startTime?: string | null, endTime?: string | null, reason?: string | null }> | null }> };

export type CreateOperatorMutationVariables = Exact<{
  name: Scalars['String']['input'];
  surname?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  operatorType?: InputMaybe<OperatorType>;
  maxConcurrentAppointments?: InputMaybe<Scalars['Float']['input']>;
}>;


export type CreateOperatorMutation = { __typename?: 'Mutation', createOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, operatorType: OperatorType, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  operatorType?: InputMaybe<OperatorType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  maxConcurrentAppointments?: InputMaybe<Scalars['Float']['input']>;
}>;


export type UpdateOperatorMutation = { __typename?: 'Mutation', updateOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, operatorType: OperatorType, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteOperatorMutation = { __typename?: 'Mutation', deleteOperator: boolean };

export type GetOperatorsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetOperatorsQuery = { __typename?: 'Query', operators: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, operatorType: OperatorType, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any }> };

export type GetOperatorQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorQuery = { __typename?: 'Query', operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, operatorType: OperatorType, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any, availabilityTemplates?: Array<{ __typename?: 'AvailabilityTemplate', id: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, isCurrent: boolean, validFrom: any, validUntil?: any | null }> | null, availabilityExceptions?: Array<{ __typename?: 'AvailabilityException', id: string, exceptionDate: any, exceptionType: ExceptionType, startTime?: string | null, endTime?: string | null, reason?: string | null }> | null } | null };

export type GetOperatorAvailabilityQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetOperatorAvailabilityQuery = { __typename?: 'Query', operatorAvailability: Array<{ __typename?: 'DailyAvailability', date: string, hasAvailability: boolean, slots: Array<{ __typename?: 'AvailabilitySlot', operatorId: string, date: string, startTime: string, endTime: string, totalCapacity: number, bookedCapacity: number, availableCapacity: number, isAvailable: boolean, source?: string | null, sourceId?: string | null }> }> };

export type CreateServiceMutationVariables = Exact<{
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  defaultDuration: Scalars['Int']['input'];
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CreateServiceMutation = { __typename?: 'Mutation', createService: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateServiceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  defaultDuration?: InputMaybe<Scalars['Int']['input']>;
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateServiceMutation = { __typename?: 'Mutation', updateService: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteServiceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteServiceMutation = { __typename?: 'Mutation', deleteService: boolean };

export type AssignServiceToOperatorMutationVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  customBufferTime?: InputMaybe<Scalars['Int']['input']>;
}>;


export type AssignServiceToOperatorMutation = { __typename?: 'Mutation', assignServiceToOperator: { __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null } };

export type UpdateOperatorServiceMutationVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  customBufferTime?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpdateOperatorServiceMutation = { __typename?: 'Mutation', updateOperatorService: { __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null } };

export type RemoveServiceFromOperatorMutationVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
}>;


export type RemoveServiceFromOperatorMutation = { __typename?: 'Mutation', removeServiceFromOperator: boolean };

export type GetServicesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetServicesQuery = { __typename?: 'Query', services: Array<{ __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, createdAt: any, updatedAt: any }> };

export type GetServiceQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetServiceQuery = { __typename?: 'Query', service?: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, createdAt: any, updatedAt: any, operators?: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null } | null };

export type GetOperatorServicesQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type GetOperatorServicesQuery = { __typename?: 'Query', operatorServices: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, service: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean } }> };

export type GetServiceOperatorsQueryVariables = Exact<{
  serviceId: Scalars['ID']['input'];
}>;


export type GetServiceOperatorsQuery = { __typename?: 'Query', serviceOperators: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, operatorType: OperatorType } }> };

export type CreateAvailabilityTemplateMutationVariables = Exact<{
  input: CreateAvailabilityTemplateInput;
}>;


export type CreateAvailabilityTemplateMutation = { __typename?: 'Mutation', createAvailabilityTemplate: { __typename?: 'AvailabilityTemplate', id: string, operatorId: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, patternStartDate: any, startTime: string, endTime: string, version: number, isCurrent: boolean, validFrom: any, validUntil?: any | null, createdAt: any, updatedAt: any } };

export type UpdateAvailabilityTemplateMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CreateAvailabilityTemplateInput;
}>;


export type UpdateAvailabilityTemplateMutation = { __typename?: 'Mutation', updateAvailabilityTemplate: { __typename?: 'AvailabilityTemplate', id: string, operatorId: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, patternStartDate: any, startTime: string, endTime: string, version: number, isCurrent: boolean, validFrom: any, validUntil?: any | null, createdAt: any, updatedAt: any } };

export type DeleteAvailabilityTemplateMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAvailabilityTemplateMutation = { __typename?: 'Mutation', deleteAvailabilityTemplate: boolean };

export type RebuildAvailabilityCacheMutationVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type RebuildAvailabilityCacheMutation = { __typename?: 'Mutation', rebuildAvailabilityCache: boolean };

export type CreateTemplatePatternMutationVariables = Exact<{
  input: CreateTemplatePatternInput;
}>;


export type CreateTemplatePatternMutation = { __typename?: 'Mutation', createTemplatePattern: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> };

export type UpdateTemplatePatternMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CreateTemplatePatternInput;
}>;


export type UpdateTemplatePatternMutation = { __typename?: 'Mutation', updateTemplatePattern: { __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any } };

export type DeleteTemplatePatternMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTemplatePatternMutation = { __typename?: 'Mutation', deleteTemplatePattern: boolean };

export type AssignTemplateToOperatorMutationVariables = Exact<{
  input: AssignTemplateToOperatorInput;
}>;


export type AssignTemplateToOperatorMutation = { __typename?: 'Mutation', assignTemplateToOperator: Array<{ __typename?: 'TemplateAssignment', id: string, operatorId: string, patternId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any }> };

export type GetAvailabilityTemplatesQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  onlyCurrent?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetAvailabilityTemplatesQuery = { __typename?: 'Query', availabilityTemplates: Array<{ __typename?: 'AvailabilityTemplate', id: string, operatorId: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, patternStartDate: any, startTime: string, endTime: string, version: number, isCurrent: boolean, validFrom: any, validUntil?: any | null, createdAt: any, updatedAt: any }> };

export type GetAllTemplatesQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type GetAllTemplatesQuery = { __typename?: 'Query', availabilityTemplates: Array<{ __typename?: 'AvailabilityTemplate', id: string, operatorId: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, patternStartDate: any, startTime: string, endTime: string, version: number, isCurrent: boolean, validFrom: any, validUntil?: any | null, createdAt: any, updatedAt: any }> };

export type GetAllTemplatePatternsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllTemplatePatternsQuery = { __typename?: 'Query', allTemplatePatterns: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> };
