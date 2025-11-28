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
  JSON: { input: any; output: any; }
};

export type AppointmentInstrument = {
  __typename?: 'AppointmentInstrument';
  appointment: AvailabilityAppointment;
  appointmentId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  endOffsetMinutes: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  instrument: Instrument;
  instrumentId: Scalars['String']['output'];
  orderPosition?: Maybe<Scalars['Int']['output']>;
  startOffsetMinutes: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
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

/** Type of appointment (standard or gym) */
export enum AppointmentType {
  Gym = 'GYM',
  Standard = 'STANDARD'
}

export type AssignTemplateToOperatorInput = {
  operatorId: Scalars['ID']['input'];
  patternGroupId: Scalars['ID']['input'];
  patternStartDate: Scalars['String']['input'];
  validFrom: Scalars['String']['input'];
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type AvailabilityAppointment = {
  __typename?: 'AvailabilityAppointment';
  appointmentDate: Scalars['DateTime']['output'];
  appointmentType: AppointmentType;
  cancellationReason?: Maybe<Scalars['String']['output']>;
  clientEmail?: Maybe<Scalars['String']['output']>;
  clientName: Scalars['String']['output'];
  clientPhone?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  endTime: Scalars['String']['output'];
  gymRoom?: Maybe<GymRoom>;
  gymRoomId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  instrumentOrderMatters: Scalars['Boolean']['output'];
  instruments?: Maybe<Array<AppointmentInstrument>>;
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

export type CheckPhysiotherapistAvailabilityInput = {
  customInstrumentSlots?: InputMaybe<Array<InstrumentSlotInput>>;
  date: Scalars['String']['input'];
  durationMinutes?: InputMaybe<Scalars['Int']['input']>;
  operatorId: Scalars['ID']['input'];
  serviceId?: InputMaybe<Scalars['ID']['input']>;
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

export type CreateOperatorInput = {
  categoryId?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  legacyUserId?: InputMaybe<Scalars['Int']['input']>;
  macroCategory: OperatorMacroCategory;
  maxConcurrentAppointments?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  preferredDurations?: InputMaybe<Array<Scalars['Int']['input']>>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['Int']['input']>;
};

export type CreatePatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  patternDuration: Scalars['Int']['input'];
  patterns: Array<PatternInput>;
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
  PersonalLeave = 'PERSONAL_LEAVE',
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

export type GymRoom = {
  __typename?: 'GymRoom';
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  maxCapacity: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  schedules?: Maybe<Array<GymSchedule>>;
  slotDuration: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type GymSchedule = {
  __typename?: 'GymSchedule';
  createdAt: Scalars['DateTime']['output'];
  dayOfWeek: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  gymRoom: GymRoom;
  gymRoomId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isCurrent: Scalars['Boolean']['output'];
  operator: Operator;
  operatorId: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  validFrom?: Maybe<Scalars['DateTime']['output']>;
  validUntil?: Maybe<Scalars['DateTime']['output']>;
};

export type GymSlotOutput = {
  __typename?: 'GymSlotOutput';
  availableCapacity: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  operatorName?: Maybe<Scalars['String']['output']>;
  startTime: Scalars['String']['output'];
  totalCapacity: Scalars['Int']['output'];
};

export type HolidayInfo = {
  __typename?: 'HolidayInfo';
  date: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
};

export type Instrument = {
  __typename?: 'Instrument';
  appointmentInstruments?: Maybe<Array<AppointmentInstrument>>;
  brand?: Maybe<Scalars['String']['output']>;
  category: InstrumentCategory;
  categoryId: Scalars['String']['output'];
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  model?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  status: InstrumentStatus;
  technicalData?: Maybe<Scalars['JSON']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  verificationExpiry?: Maybe<Scalars['DateTime']['output']>;
};

export type InstrumentCategory = {
  __typename?: 'InstrumentCategory';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  instruments?: Maybe<Array<Instrument>>;
  isActive: Scalars['Boolean']['output'];
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type InstrumentSlotInput = {
  endOffsetMinutes: Scalars['Int']['input'];
  instrumentCategoryId: Scalars['ID']['input'];
  startOffsetMinutes: Scalars['Int']['input'];
};

export type InstrumentSlotOutput = {
  __typename?: 'InstrumentSlotOutput';
  categoryName: Scalars['String']['output'];
  endOffsetMinutes: Scalars['Int']['output'];
  instrumentCategoryId: Scalars['ID']['output'];
  instrumentId?: Maybe<Scalars['ID']['output']>;
  startOffsetMinutes: Scalars['Int']['output'];
};

/** Status of an instrument (active, unavailable, or in maintenance) */
export enum InstrumentStatus {
  Active = 'ACTIVE',
  Maintenance = 'MAINTENANCE',
  Unavailable = 'UNAVAILABLE'
}

export type Mutation = {
  __typename?: 'Mutation';
  assignServiceToOperator: OperatorService;
  assignTemplateToOperator: Array<TemplateAssignment>;
  createAvailabilityException: AvailabilityException;
  createAvailabilityTemplate: AvailabilityTemplate;
  createException: AvailabilityException;
  createGroupException: GroupException;
  createGymRoom: GymRoom;
  createGymSchedule: GymSchedule;
  createInstrument: Instrument;
  createInstrumentCategory: InstrumentCategory;
  createOperator: Operator;
  createOperatorCategory: OperatorCategory;
  createPatternGroup: PatternGroup;
  createRoom: Room;
  createService: Service;
  createSickLeave: Array<AvailabilityException>;
  createTemplatePattern: Array<TemplatePattern>;
  createVacation: Array<AvailabilityException>;
  deactivateAllTemplateAssignmentsForOperator: Scalars['Boolean']['output'];
  deactivateTemplateAssignment: TemplateAssignment;
  deleteAvailabilityTemplate: Scalars['Boolean']['output'];
  deleteException: Scalars['Boolean']['output'];
  deleteExceptionsByDateRange: Scalars['Int']['output'];
  deleteGroupException: Scalars['Boolean']['output'];
  deleteGymRoom: Scalars['Boolean']['output'];
  deleteGymSchedule: Scalars['Boolean']['output'];
  deleteHolidaysForYear: Scalars['Int']['output'];
  deleteInstrument: Scalars['Boolean']['output'];
  deleteInstrumentCategory: Scalars['Boolean']['output'];
  deleteOperator: Scalars['Boolean']['output'];
  deleteOperatorCategory: Scalars['Boolean']['output'];
  deletePatternGroup: Scalars['Boolean']['output'];
  deleteRoom: Scalars['Boolean']['output'];
  deleteService: Scalars['Boolean']['output'];
  deleteTemplateAssignment: Scalars['Boolean']['output'];
  deleteTemplatePattern: Scalars['Boolean']['output'];
  generateHolidaysForOperator: Scalars['Int']['output'];
  generateHolidaysForYear: Scalars['Int']['output'];
  rebuildAvailabilityCache: Scalars['Boolean']['output'];
  removeServiceFromOperator: Scalars['Boolean']['output'];
  setInstrumentStatus: Instrument;
  setPatternGroupActive: PatternGroup;
  updateAvailabilityTemplate: AvailabilityTemplate;
  updateException: AvailabilityException;
  updateGymRoom: GymRoom;
  updateGymSchedule: GymSchedule;
  updateInstrument: Instrument;
  updateInstrumentCategory: InstrumentCategory;
  updateOperator: Operator;
  updateOperatorCategory: OperatorCategory;
  updateOperatorService: OperatorService;
  updatePatternGroup: PatternGroup;
  updateRoom: Room;
  updateService: Service;
  updateTemplateAssignment: TemplateAssignment;
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


export type MutationCreateExceptionArgs = {
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionDate: Scalars['String']['input'];
  exceptionType: ExceptionType;
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateGroupExceptionArgs = {
  appliesToAll?: InputMaybe<Scalars['Boolean']['input']>;
  exceptionDate: Scalars['String']['input'];
  exceptionType: Scalars['String']['input'];
  name: Scalars['String']['input'];
  operatorIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  reason?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateGymRoomArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  maxCapacity?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  slotDuration?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationCreateGymScheduleArgs = {
  dayOfWeek: Scalars['Int']['input'];
  endTime: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
  operatorId: Scalars['ID']['input'];
  startTime: Scalars['String']['input'];
  validFrom?: InputMaybe<Scalars['DateTime']['input']>;
  validUntil?: InputMaybe<Scalars['DateTime']['input']>;
};


export type MutationCreateInstrumentArgs = {
  brand?: InputMaybe<Scalars['String']['input']>;
  categoryId: Scalars['ID']['input'];
  color?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  technicalData?: InputMaybe<Scalars['JSON']['input']>;
  verificationExpiry?: InputMaybe<Scalars['DateTime']['input']>;
};


export type MutationCreateInstrumentCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name: Scalars['String']['input'];
};


export type MutationCreateOperatorArgs = {
  input: CreateOperatorInput;
};


export type MutationCreateOperatorCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['input'];
};


export type MutationCreatePatternGroupArgs = {
  input: CreatePatternGroupInput;
};


export type MutationCreateRoomArgs = {
  capacity?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationCreateServiceArgs = {
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  defaultDuration: Scalars['Int']['input'];
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name: Scalars['String']['input'];
  preferredDuration?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationCreateSickLeaveArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};


export type MutationCreateTemplatePatternArgs = {
  input: CreateTemplatePatternInput;
};


export type MutationCreateVacationArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};


export type MutationDeactivateAllTemplateAssignmentsForOperatorArgs = {
  operatorId: Scalars['ID']['input'];
};


export type MutationDeactivateTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAvailabilityTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExceptionsByDateRangeArgs = {
  endDate: Scalars['String']['input'];
  exceptionType?: InputMaybe<ExceptionType>;
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type MutationDeleteGroupExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteGymRoomArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteGymScheduleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteHolidaysForYearArgs = {
  year: Scalars['Int']['input'];
};


export type MutationDeleteInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteInstrumentCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteOperatorCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRoomArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteServiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplatePatternArgs = {
  id: Scalars['ID']['input'];
};


export type MutationGenerateHolidaysForOperatorArgs = {
  operatorId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};


export type MutationGenerateHolidaysForYearArgs = {
  year: Scalars['Int']['input'];
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


export type MutationSetInstrumentStatusArgs = {
  id: Scalars['ID']['input'];
  status: InstrumentStatus;
};


export type MutationSetPatternGroupActiveArgs = {
  id: Scalars['ID']['input'];
  isActive: Scalars['Boolean']['input'];
};


export type MutationUpdateAvailabilityTemplateArgs = {
  id: Scalars['ID']['input'];
  input: CreateAvailabilityTemplateInput;
};


export type MutationUpdateExceptionArgs = {
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionType?: InputMaybe<ExceptionType>;
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateGymRoomArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  maxCapacity?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  slotDuration?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationUpdateGymScheduleArgs = {
  dayOfWeek?: InputMaybe<Scalars['Int']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  validFrom?: InputMaybe<Scalars['DateTime']['input']>;
  validUntil?: InputMaybe<Scalars['DateTime']['input']>;
};


export type MutationUpdateInstrumentArgs = {
  brand?: InputMaybe<Scalars['String']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<InstrumentStatus>;
  technicalData?: InputMaybe<Scalars['JSON']['input']>;
  verificationExpiry?: InputMaybe<Scalars['DateTime']['input']>;
};


export type MutationUpdateInstrumentCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateOperatorArgs = {
  id: Scalars['ID']['input'];
  input: UpdateOperatorInput;
};


export type MutationUpdateOperatorCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateOperatorServiceArgs = {
  customBufferTime?: InputMaybe<Scalars['Int']['input']>;
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
};


export type MutationUpdatePatternGroupArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePatternGroupInput;
};


export type MutationUpdateRoomArgs = {
  capacity?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateServiceArgs = {
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  defaultDuration?: InputMaybe<Scalars['Int']['input']>;
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name?: InputMaybe<Scalars['String']['input']>;
  preferredDuration?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationUpdateTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
  isCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  patternStartDate?: InputMaybe<Scalars['String']['input']>;
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
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
  category?: Maybe<OperatorCategory>;
  categoryId?: Maybe<Scalars['String']['output']>;
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email?: Maybe<Scalars['String']['output']>;
  gymSchedules?: Maybe<Array<GymSchedule>>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  legacyUserId?: Maybe<Scalars['Int']['output']>;
  macroCategory: OperatorMacroCategory;
  maxConcurrentAppointments: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  preferredDurations?: Maybe<Array<Scalars['Int']['output']>>;
  services?: Maybe<Array<OperatorService>>;
  surname?: Maybe<Scalars['String']['output']>;
  templateAssignments?: Maybe<Array<TemplateAssignment>>;
  updatedAt: Scalars['DateTime']['output'];
  userId?: Maybe<Scalars['Int']['output']>;
};

export type OperatorCategory = {
  __typename?: 'OperatorCategory';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['output'];
  operators?: Maybe<Array<Operator>>;
  updatedAt: Scalars['DateTime']['output'];
};

/** Macro category defining what an operator can do (use instruments, manage gym, etc.) */
export enum OperatorMacroCategory {
  Doctor = 'DOCTOR',
  GymInstructor = 'GYM_INSTRUCTOR',
  Physiotherapist = 'PHYSIOTHERAPIST'
}

export type OperatorService = {
  __typename?: 'OperatorService';
  customBufferTime?: Maybe<Scalars['Int']['output']>;
  customDuration?: Maybe<Scalars['Int']['output']>;
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  service: Service;
  serviceId: Scalars['ID']['output'];
};

export type PatternGroup = {
  __typename?: 'PatternGroup';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  patternDuration: Scalars['Int']['output'];
  patterns?: Maybe<Array<TemplatePattern>>;
  updatedAt: Scalars['DateTime']['output'];
};

export type PatternInput = {
  dayInPattern: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  name: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
};

export type PhysiotherapistSlotOutput = {
  __typename?: 'PhysiotherapistSlotOutput';
  available: Scalars['Boolean']['output'];
  endTime: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  startTime: Scalars['String']['output'];
  suggestedInstruments?: Maybe<Array<InstrumentSlotOutput>>;
};

export type Query = {
  __typename?: 'Query';
  allOperatorServices: Array<OperatorService>;
  allTemplatePatterns: Array<TemplatePattern>;
  availabilityException?: Maybe<AvailabilityException>;
  availabilityExceptions: Array<AvailabilityException>;
  availabilityTemplates: Array<AvailabilityTemplate>;
  availableInstrumentsByCategory: Array<Instrument>;
  availableSlots: Array<AvailabilitySlot>;
  checkDuplicateOperator: Array<Operator>;
  checkSlotAvailability: Scalars['Boolean']['output'];
  currentTemplateAssignments: Array<TemplateAssignment>;
  groupExceptions: Array<GroupException>;
  gymAvailableSlots: Array<GymSlotOutput>;
  gymOperatorAtTime?: Maybe<GymSchedule>;
  gymRoom?: Maybe<GymRoom>;
  gymRooms: Array<GymRoom>;
  gymSchedule?: Maybe<GymSchedule>;
  gymSchedules: Array<GymSchedule>;
  gymSchedulesByRoomAndDay: Array<GymSchedule>;
  holidays: Array<HolidayInfo>;
  instrument?: Maybe<Instrument>;
  instrumentCategories: Array<InstrumentCategory>;
  instrumentCategory?: Maybe<InstrumentCategory>;
  instruments: Array<Instrument>;
  isHoliday: Scalars['Boolean']['output'];
  operator?: Maybe<Operator>;
  operatorAvailability: Array<DailyAvailability>;
  operatorCategories: Array<OperatorCategory>;
  operatorCategory?: Maybe<OperatorCategory>;
  operatorExceptions: Array<AvailabilityException>;
  operatorServices: Array<OperatorService>;
  operators: Array<Operator>;
  patternGroup?: Maybe<PatternGroup>;
  patternGroups: Array<PatternGroup>;
  physiotherapistAvailableSlots: Array<PhysiotherapistSlotOutput>;
  room?: Maybe<Room>;
  rooms: Array<Room>;
  service?: Maybe<Service>;
  serviceOperators: Array<OperatorService>;
  services: Array<Service>;
  templateAssignment?: Maybe<TemplateAssignment>;
  templateAssignments: Array<TemplateAssignment>;
  templateAssignmentsByOperator: Array<TemplateAssignment>;
};


export type QueryAvailabilityExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAvailabilityExceptionsArgs = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  exceptionType?: InputMaybe<ExceptionType>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAvailabilityTemplatesArgs = {
  onlyCurrent?: Scalars['Boolean']['input'];
  operatorId: Scalars['ID']['input'];
};


export type QueryAvailableInstrumentsByCategoryArgs = {
  categoryId: Scalars['ID']['input'];
};


export type QueryAvailableSlotsArgs = {
  date: Scalars['String']['input'];
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryCheckDuplicateOperatorArgs = {
  name: Scalars['String']['input'];
  surname?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCheckSlotAvailabilityArgs = {
  date: Scalars['String']['input'];
  endTime: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startTime: Scalars['String']['input'];
};


export type QueryCurrentTemplateAssignmentsArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
};


export type QueryGymAvailableSlotsArgs = {
  date: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
};


export type QueryGymOperatorAtTimeArgs = {
  dayOfWeek: Scalars['Int']['input'];
  gymRoomId: Scalars['ID']['input'];
  time: Scalars['String']['input'];
};


export type QueryGymRoomArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGymRoomsArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryGymScheduleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGymSchedulesArgs = {
  gymRoomId?: InputMaybe<Scalars['ID']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGymSchedulesByRoomAndDayArgs = {
  dayOfWeek: Scalars['Int']['input'];
  gymRoomId: Scalars['ID']['input'];
};


export type QueryHolidaysArgs = {
  year: Scalars['Int']['input'];
};


export type QueryInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryInstrumentCategoriesArgs = {
  macroCategory?: InputMaybe<OperatorMacroCategory>;
};


export type QueryInstrumentCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryInstrumentsArgs = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<InstrumentStatus>;
};


export type QueryIsHolidayArgs = {
  date: Scalars['String']['input'];
};


export type QueryOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOperatorAvailabilityArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type QueryOperatorCategoriesArgs = {
  macroCategory?: InputMaybe<OperatorMacroCategory>;
};


export type QueryOperatorCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOperatorExceptionsArgs = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  startDate?: InputMaybe<Scalars['String']['input']>;
};


export type QueryOperatorServicesArgs = {
  operatorId: Scalars['ID']['input'];
};


export type QueryOperatorsArgs = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPhysiotherapistAvailableSlotsArgs = {
  input: CheckPhysiotherapistAvailabilityInput;
};


export type QueryRoomArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRoomsArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryServiceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryServiceOperatorsArgs = {
  serviceId: Scalars['ID']['input'];
};


export type QueryServicesArgs = {
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTemplateAssignmentsArgs = {
  onlyCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryTemplateAssignmentsByOperatorArgs = {
  onlyCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  operatorId: Scalars['ID']['input'];
};

export type Room = {
  __typename?: 'Room';
  capacity: Scalars['Int']['output'];
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Service = {
  __typename?: 'Service';
  appointments?: Maybe<Array<AvailabilityAppointment>>;
  bufferTimeAfter: Scalars['Int']['output'];
  bufferTimeBefore: Scalars['Int']['output'];
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  defaultDuration: Scalars['Int']['output'];
  defaultInstrumentSlotOffset?: Maybe<Scalars['Int']['output']>;
  defaultPrice: Scalars['Float']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  instrumentOrderMatters: Scalars['Boolean']['output'];
  isActive: Scalars['Boolean']['output'];
  macroCategory?: Maybe<OperatorMacroCategory>;
  name: Scalars['String']['output'];
  operators?: Maybe<Array<OperatorService>>;
  preferredDuration?: Maybe<Scalars['Int']['output']>;
  requiredInstruments?: Maybe<Array<ServiceInstrument>>;
  reverseInstrumentOrder?: Maybe<Scalars['Boolean']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type ServiceInstrument = {
  __typename?: 'ServiceInstrument';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  instrumentCategory: InstrumentCategory;
  instrumentCategoryId: Scalars['String']['output'];
  isRequired: Scalars['Boolean']['output'];
  orderPosition?: Maybe<Scalars['Int']['output']>;
  quantity: Scalars['Int']['output'];
  service: Service;
  serviceId: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TemplateAssignment = {
  __typename?: 'TemplateAssignment';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isCurrent: Scalars['Boolean']['output'];
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  patternGroup: PatternGroup;
  patternGroupId: Scalars['ID']['output'];
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
  patternGroup: PatternGroup;
  patternGroupId: Scalars['ID']['output'];
  startTime: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type UpdateOperatorInput = {
  categoryId?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  maxConcurrentAppointments?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  preferredDurations?: InputMaybe<Array<Scalars['Int']['input']>>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdatePatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  patternDuration?: InputMaybe<Scalars['Float']['input']>;
  patterns?: InputMaybe<Array<PatternInput>>;
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

export type CreateOperatorCategoryMutationVariables = Exact<{
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateOperatorCategoryMutation = { __typename?: 'Mutation', createOperatorCategory: { __typename?: 'OperatorCategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateOperatorCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateOperatorCategoryMutation = { __typename?: 'Mutation', updateOperatorCategory: { __typename?: 'OperatorCategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteOperatorCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteOperatorCategoryMutation = { __typename?: 'Mutation', deleteOperatorCategory: boolean };

export type GetOperatorCategoriesQueryVariables = Exact<{
  macroCategory?: InputMaybe<OperatorMacroCategory>;
}>;


export type GetOperatorCategoriesQuery = { __typename?: 'Query', operatorCategories: Array<{ __typename?: 'OperatorCategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any }> };

export type GetOperatorCategoryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorCategoryQuery = { __typename?: 'Query', operatorCategory?: { __typename?: 'OperatorCategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any, operators?: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, isActive: boolean }> | null } | null };

export type CreateOperatorMutationVariables = Exact<{
  input: CreateOperatorInput;
}>;


export type CreateOperatorMutation = { __typename?: 'Mutation', createOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, userId?: number | null, legacyUserId?: number | null, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null } };

export type UpdateOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateOperatorInput;
}>;


export type UpdateOperatorMutation = { __typename?: 'Mutation', updateOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, userId?: number | null, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null } };

export type DeleteOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteOperatorMutation = { __typename?: 'Mutation', deleteOperator: boolean };

export type CheckDuplicateOperatorQueryVariables = Exact<{
  name: Scalars['String']['input'];
  surname?: InputMaybe<Scalars['String']['input']>;
}>;


export type CheckDuplicateOperatorQuery = { __typename?: 'Query', checkDuplicateOperator: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, macroCategory: OperatorMacroCategory, category?: { __typename?: 'OperatorCategory', id: string, name: string } | null }> };

export type GetOperatorsQueryVariables = Exact<{
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetOperatorsQuery = { __typename?: 'Query', operators: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: number | null, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null }> };

export type GetOperatorQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorQuery = { __typename?: 'Query', operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: number | null, maxConcurrentAppointments: number, isActive: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null, availabilityTemplates?: Array<{ __typename?: 'AvailabilityTemplate', id: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, isCurrent: boolean, validFrom: any, validUntil?: any | null }> | null, availabilityExceptions?: Array<{ __typename?: 'AvailabilityException', id: string, exceptionDate: any, exceptionType: ExceptionType, startTime?: string | null, endTime?: string | null, reason?: string | null }> | null } | null };

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


export type GetServiceOperatorsQuery = { __typename?: 'Query', serviceOperators: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, macroCategory: OperatorMacroCategory } }> };

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

export type CreatePatternGroupMutationVariables = Exact<{
  input: CreatePatternGroupInput;
}>;


export type CreatePatternGroupMutation = { __typename?: 'Mutation', createPatternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, createdAt: any, updatedAt: any, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> | null } };

export type CreateTemplatePatternMutationVariables = Exact<{
  input: CreateTemplatePatternInput;
}>;


export type CreateTemplatePatternMutation = { __typename?: 'Mutation', createTemplatePattern: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> };

export type UpdatePatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePatternGroupInput;
}>;


export type UpdatePatternGroupMutation = { __typename?: 'Mutation', updatePatternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, createdAt: any, updatedAt: any, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> | null } };

export type UpdateTemplatePatternMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CreateTemplatePatternInput;
}>;


export type UpdateTemplatePatternMutation = { __typename?: 'Mutation', updateTemplatePattern: { __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any } };

export type DeletePatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePatternGroupMutation = { __typename?: 'Mutation', deletePatternGroup: boolean };

export type DeleteTemplatePatternMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTemplatePatternMutation = { __typename?: 'Mutation', deleteTemplatePattern: boolean };

export type AssignTemplateToOperatorMutationVariables = Exact<{
  input: AssignTemplateToOperatorInput;
}>;


export type AssignTemplateToOperatorMutation = { __typename?: 'Mutation', assignTemplateToOperator: Array<{ __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, dayInPattern: number, startTime: string, endTime: string }> | null } }> };

export type UpdateTemplateAssignmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
  patternStartDate?: InputMaybe<Scalars['String']['input']>;
  isCurrent?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateTemplateAssignmentMutation = { __typename?: 'Mutation', updateTemplateAssignment: { __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, dayInPattern: number, startTime: string, endTime: string }> | null } } };

export type DeactivateTemplateAssignmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeactivateTemplateAssignmentMutation = { __typename?: 'Mutation', deactivateTemplateAssignment: { __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any } };

export type DeleteTemplateAssignmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTemplateAssignmentMutation = { __typename?: 'Mutation', deleteTemplateAssignment: boolean };

export type DeactivateAllTemplateAssignmentsForOperatorMutationVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type DeactivateAllTemplateAssignmentsForOperatorMutation = { __typename?: 'Mutation', deactivateAllTemplateAssignmentsForOperator: boolean };

export type GetAvailabilityTemplatesQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  onlyCurrent?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetAvailabilityTemplatesQuery = { __typename?: 'Query', availabilityTemplates: Array<{ __typename?: 'AvailabilityTemplate', id: string, operatorId: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, patternStartDate: any, startTime: string, endTime: string, version: number, isCurrent: boolean, validFrom: any, validUntil?: any | null, createdAt: any, updatedAt: any }> };

export type GetAllTemplatesQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type GetAllTemplatesQuery = { __typename?: 'Query', availabilityTemplates: Array<{ __typename?: 'AvailabilityTemplate', id: string, operatorId: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, patternStartDate: any, startTime: string, endTime: string, version: number, isCurrent: boolean, validFrom: any, validUntil?: any | null, createdAt: any, updatedAt: any }> };

export type GetAllPatternGroupsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllPatternGroupsQuery = { __typename?: 'Query', patternGroups: Array<{ __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, createdAt: any, updatedAt: any, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> | null }> };

export type GetAllTemplatePatternsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllTemplatePatternsQuery = { __typename?: 'Query', allTemplatePatterns: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, createdAt: any, updatedAt: any }> };

export type GetTemplateAssignmentsQueryVariables = Exact<{
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  onlyCurrent?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetTemplateAssignmentsQuery = { __typename?: 'Query', templateAssignments: Array<{ __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, startTime: string, endTime: string }> | null } }> };

export type GetTemplateAssignmentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetTemplateAssignmentQuery = { __typename?: 'Query', templateAssignment?: { __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, startTime: string, endTime: string }> | null } } | null };

export type GetTemplateAssignmentsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  onlyCurrent?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetTemplateAssignmentsByOperatorQuery = { __typename?: 'Query', templateAssignmentsByOperator: Array<{ __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, startTime: string, endTime: string }> | null } }> };

export type GetCurrentTemplateAssignmentsQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  date?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetCurrentTemplateAssignmentsQuery = { __typename?: 'Query', currentTemplateAssignments: Array<{ __typename?: 'TemplateAssignment', id: string, operatorId: string, patternGroupId: string, patternStartDate: any, validFrom: any, validUntil?: any | null, version: number, isCurrent: boolean, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patternGroup: { __typename?: 'PatternGroup', id: string, name: string, description?: string | null, patternDuration: number, isActive: boolean, patterns?: Array<{ __typename?: 'TemplatePattern', id: string, name: string, description?: string | null, dayInPattern: number, startTime: string, endTime: string }> | null } }> };
