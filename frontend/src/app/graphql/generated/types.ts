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
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: any; output: any; }
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: { input: any; output: any; }
};

export type AbsenceTypeSnapshot = {
  __typename?: 'AbsenceTypeSnapshot';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type AddTestEvaluationInput = {
  /** Livello valutazione (0-5) */
  evaluationLevel: Scalars['Int']['input'];
  /** Note sulla valutazione */
  note?: InputMaybe<Scalars['String']['input']>;
};

export type AppUser = {
  __typename?: 'AppUser';
  attributes?: Maybe<Scalars['JSONObject']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  keycloakId?: Maybe<Scalars['String']['output']>;
  linkedAt?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  surname?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  userRoles?: Maybe<Array<UserRole>>;
  userType: AppUserType;
};

/** Tipologia di utente applicativo */
export enum AppUserType {
  ItManager = 'IT_MANAGER',
  Operator = 'OPERATOR',
  PrivacyOfficer = 'PRIVACY_OFFICER',
  Secretary = 'SECRETARY'
}

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

export type AppointmentInstrumentInput = {
  endOffsetMinutes: Scalars['Int']['input'];
  instrumentCategoryId: Scalars['String']['input'];
  orderPosition?: InputMaybe<Scalars['Int']['input']>;
  startOffsetMinutes: Scalars['Int']['input'];
};

export type AppointmentService = {
  __typename?: 'AppointmentService';
  appointmentId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  customDuration?: Maybe<Scalars['Int']['output']>;
  customPrice?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  orderPosition: Scalars['Int']['output'];
  service: Service;
  serviceId: Scalars['ID']['output'];
};

/** Status of the appointment (deprecated) */
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

export type AssignRoleInput = {
  appUserId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};

export type AssignTemplateToOperatorInput = {
  operatorId: Scalars['ID']['input'];
  patternGroupId: Scalars['ID']['input'];
  patternStartDate: Scalars['String']['input'];
  validFrom: Scalars['String']['input'];
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type AttendanceStats = {
  __typename?: 'AttendanceStats';
  /** Cancellazioni per anno solare. Formato: { "2026": 3, "2025": 1 } */
  cancellationsByYear: Scalars['JSON']['output'];
  /** No-show per anno solare. Formato: { "2026": 2, "2025": 0 } */
  noShowsByYear: Scalars['JSON']['output'];
  totalCancellations: Scalars['Int']['output'];
  totalNoShows: Scalars['Int']['output'];
};

export type AvailabilityAppointment = {
  __typename?: 'AvailabilityAppointment';
  /** Data appuntamento in formato YYYY-MM-DD */
  appointmentDate: Scalars['String']['output'];
  appointmentServices?: Maybe<Array<AppointmentService>>;
  appointmentType: AppointmentType;
  autoStatusChanged: Scalars['Boolean']['output'];
  bookingStatus: BookingStatus;
  cancellationHoursNotice?: Maybe<Scalars['Float']['output']>;
  cancellationReason?: Maybe<Scalars['String']['output']>;
  cancelledAt?: Maybe<Scalars['DateTime']['output']>;
  cancelledBy?: Maybe<Scalars['ID']['output']>;
  clientEmail?: Maybe<Scalars['String']['output']>;
  clientName: Scalars['String']['output'];
  clientPhone?: Maybe<Scalars['String']['output']>;
  closedAt?: Maybe<Scalars['DateTime']['output']>;
  conflictDetectedAt?: Maybe<Scalars['DateTime']['output']>;
  conflictReason?: Maybe<ConflictReason>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  endTime: Scalars['String']['output'];
  gymRoom?: Maybe<GymRoom>;
  gymRoomId?: Maybe<Scalars['ID']['output']>;
  hasConflict: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  instrumentOrderMatters: Scalars['Boolean']['output'];
  instruments?: Maybe<Array<AppointmentInstrument>>;
  isMaster: Scalars['Boolean']['output'];
  isRecurring: Scalars['Boolean']['output'];
  isSubstitution: Scalars['Boolean']['output'];
  masterAppointmentId?: Maybe<Scalars['ID']['output']>;
  maxParticipants?: Maybe<Scalars['Int']['output']>;
  nonRetribuito: Scalars['Boolean']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  operatorNotes?: Maybe<Scalars['String']['output']>;
  originalOperator?: Maybe<Operator>;
  originalOperatorId?: Maybe<Scalars['ID']['output']>;
  participantCount: Scalars['Int']['output'];
  patientId?: Maybe<Scalars['ID']['output']>;
  recurringGroupId?: Maybe<Scalars['ID']['output']>;
  repeatConfig?: Maybe<Scalars['JSON']['output']>;
  service?: Maybe<Service>;
  /** @deprecated Usa appointmentServices invece */
  serviceId?: Maybe<Scalars['ID']['output']>;
  site: Site;
  siteId: Scalars['ID']['output'];
  startTime: Scalars['String']['output'];
  /** @deprecated Use bookingStatus instead */
  status?: Maybe<AppointmentStatus>;
  substitutionReason?: Maybe<Scalars['String']['output']>;
  treatmentCompletedAt?: Maybe<Scalars['DateTime']['output']>;
  treatmentStartedAt?: Maybe<Scalars['DateTime']['output']>;
  treatmentStatus?: Maybe<TreatmentStatus>;
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

export type BodyMapMarker = {
  __typename?: 'BodyMapMarker';
  id: Scalars['String']['output'];
  /** Nota associata al punto */
  note?: Maybe<Scalars['String']['output']>;
  /** Coordinata X normalizzata (0-1) */
  x: Scalars['Float']['output'];
  /** Coordinata Y normalizzata (0-1) */
  y: Scalars['Float']['output'];
};

export type BodyMapMarkerInput = {
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
};

/** Booking status of the appointment */
export enum BookingStatus {
  Attended = 'ATTENDED',
  Cancelled = 'CANCELLED',
  CancelledEarly = 'CANCELLED_EARLY',
  CancelledLate = 'CANCELLED_LATE',
  Confirmed = 'CONFIRMED',
  NoShow = 'NO_SHOW',
  Scheduled = 'SCHEDULED'
}

export type CalendarSettings = {
  __typename?: 'CalendarSettings';
  blockAppointmentsOutsideAvailability: Scalars['Boolean']['output'];
  defaultOperatorCategory: Scalars['String']['output'];
  defaultView: Scalars['String']['output'];
  endHour: Scalars['Int']['output'];
  operatorsSelectedOnLoad: Scalars['Boolean']['output'];
  showGymInstructorsInOperators: Scalars['Boolean']['output'];
  showUnavailableCellsBackground: Scalars['Boolean']['output'];
  showWeekend: Scalars['Boolean']['output'];
  showWorkingHoursOnly: Scalars['Boolean']['output'];
  slotDuration: Scalars['Int']['output'];
  startHour: Scalars['Int']['output'];
};

export type CheckPhysiotherapistAvailabilityInput = {
  customInstrumentSlots?: InputMaybe<Array<InstrumentSlotInput>>;
  date: Scalars['String']['input'];
  durationMinutes?: InputMaybe<Scalars['Int']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  operatorId: Scalars['ID']['input'];
  serviceId?: InputMaybe<Scalars['ID']['input']>;
};

export type ClinicalRelationshipExtension = {
  __typename?: 'ClinicalRelationshipExtension';
  createdAt: Scalars['DateTime']['output'];
  isAuthorizedPickup: Scalars['Boolean']['output'];
  isCaregiverDuringVisits: Scalars['Boolean']['output'];
  isEmergencyContact: Scalars['Boolean']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  organizationId: Scalars['ID']['output'];
  registryRelationshipId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type CloseTreatmentInput = {
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
};

export type CompleteTreatmentInput = {
  clinicalNotes?: InputMaybe<Scalars['String']['input']>;
  isTest?: InputMaybe<Scalars['Boolean']['input']>;
  operatorNotes?: InputMaybe<Scalars['String']['input']>;
  price: Scalars['Float']['input'];
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
};

/** Reason for availability conflict */
export enum ConflictReason {
  OperatorSick = 'OPERATOR_SICK',
  OperatorUnavailable = 'OPERATOR_UNAVAILABLE',
  OperatorVacation = 'OPERATOR_VACATION',
  RecurringAppointment = 'RECURRING_APPOINTMENT',
  TemplateChange = 'TEMPLATE_CHANGE'
}

/** Action to resolve appointment conflict */
export enum ConflictResolutionAction {
  Cancel = 'CANCEL',
  Keep = 'KEEP',
  Reschedule = 'RESCHEDULE'
}

export type ConflictRevalidationResult = {
  __typename?: 'ConflictRevalidationResult';
  resolved: Scalars['Int']['output'];
  skipped: Scalars['Boolean']['output'];
};

export type ConflictStatsOutput = {
  __typename?: 'ConflictStatsOutput';
  byOperator: Array<OperatorConflictCount>;
  byReason: Scalars['JSONObject']['output'];
  totalConflicts: Scalars['Int']['output'];
};

export type CreateAppUserInput = {
  attributes?: InputMaybe<Scalars['JSONObject']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userType: AppUserType;
};

export type CreateAvailabilityAppointmentInput = {
  appointmentDate: Scalars['String']['input'];
  clientEmail?: InputMaybe<Scalars['String']['input']>;
  clientName: Scalars['String']['input'];
  clientPhone?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  /** Forza il salvataggio anche fuori dalla disponibilità dell'operatore (conferma esplicita dell'utente) */
  forceOutsideAvailability?: InputMaybe<Scalars['Boolean']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  instruments?: InputMaybe<Array<AppointmentInstrumentInput>>;
  /** Appuntamento non retribuito (pausa pranzo, rappresentante, etc.) */
  nonRetribuito?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  patientId?: InputMaybe<Scalars['ID']['input']>;
  /** Configurazione per appuntamenti ricorrenti */
  repeatConfig?: InputMaybe<RepeatConfigInput>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  /** Servizi da associare all'appuntamento */
  services?: InputMaybe<Array<ServiceInputItem>>;
  startTime: Scalars['String']['input'];
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

export type CreateDocumentInput = {
  category: DocumentCategory;
  description?: InputMaybe<Scalars['String']['input']>;
  externalDoctorName?: InputMaybe<Scalars['String']['input']>;
  fileName: Scalars['String']['input'];
  fileSize: Scalars['Int']['input'];
  mimeType: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  originalFileName?: InputMaybe<Scalars['String']['input']>;
  storagePath: Scalars['String']['input'];
  therapeuticPathId: Scalars['ID']['input'];
  thumbnailPath?: InputMaybe<Scalars['String']['input']>;
  type: DocumentType;
  uploadedBy?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateEvaluationInput = {
  andamentoDolore?: InputMaybe<Scalars['String']['input']>;
  bmi?: InputMaybe<Scalars['Float']['input']>;
  bodyMapMarkers?: InputMaybe<Array<BodyMapMarkerInput>>;
  criticita?: InputMaybe<Array<Scalars['String']['input']>>;
  diagnosiFisioterapica?: InputMaybe<Scalars['String']['input']>;
  equilibrio?: InputMaybe<Scalars['String']['input']>;
  esameNeurologico?: InputMaybe<Scalars['String']['input']>;
  esordioSintomi?: InputMaybe<Scalars['String']['input']>;
  exams?: InputMaybe<Array<EvaluationExamInput>>;
  fattoriAggravanti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriAllevianti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriPrognosticiNegativi?: InputMaybe<Scalars['String']['input']>;
  fattoriPrognosticiPositivi?: InputMaybe<Scalars['String']['input']>;
  forzaMuscolare?: InputMaybe<Scalars['String']['input']>;
  frequenzaSedute?: InputMaybe<Scalars['String']['input']>;
  interventiProposti?: InputMaybe<Array<Scalars['String']['input']>>;
  limitazioniAttivita?: InputMaybe<Scalars['String']['input']>;
  motivoConsulto?: InputMaybe<Scalars['String']['input']>;
  movimentoAttivo?: InputMaybe<Scalars['String']['input']>;
  movimentoPassivo?: InputMaybe<Scalars['String']['input']>;
  objectives?: InputMaybe<Array<EvaluationObjectiveInput>>;
  operatorId: Scalars['ID']['input'];
  osservazione?: InputMaybe<Scalars['String']['input']>;
  outcome?: InputMaybe<Scalars['String']['input']>;
  palpazione?: InputMaybe<Scalars['String']['input']>;
  professione?: InputMaybe<Scalars['String']['input']>;
  sportPraticati?: InputMaybe<Array<Scalars['String']['input']>>;
  statoAttualeSintomi?: InputMaybe<Scalars['String']['input']>;
  strategieCoping?: InputMaybe<Scalars['String']['input']>;
  tests?: InputMaybe<Array<EvaluationTestInput>>;
  therapeuticPathId: Scalars['ID']['input'];
};

export type CreateGymAppointmentInput = {
  appointmentDate: Scalars['String']['input'];
  clientEmail?: InputMaybe<Scalars['String']['input']>;
  clientName: Scalars['String']['input'];
  clientPhone?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  patientId?: InputMaybe<Scalars['ID']['input']>;
  repeatConfig?: InputMaybe<Scalars['JSON']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  /** Servizi da associare all'appuntamento */
  services?: InputMaybe<Array<ServiceInputItem>>;
  startTime: Scalars['String']['input'];
};

export type CreateGymExceptionInput = {
  absenceTypeId?: InputMaybe<Scalars['ID']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionDate: Scalars['String']['input'];
  exceptionType: GymExceptionType;
  gymRoomId?: InputMaybe<Scalars['ID']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  substituteOperatorId?: InputMaybe<Scalars['ID']['input']>;
  substitutes?: InputMaybe<Array<GymExceptionSubstituteInput>>;
};

export type CreateGymPatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  gymRoomId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  patternDuration?: InputMaybe<Scalars['Int']['input']>;
  patternStartDate: Scalars['String']['input'];
  patterns: Array<CreateGymTemplatePatternInput>;
  validFrom: Scalars['String']['input'];
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type CreateGymTemplatePatternInput = {
  dayInPattern: Scalars['Int']['input'];
  endTime: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startTime: Scalars['String']['input'];
};

export type CreateItManagerInput = {
  canManageIntegrations?: InputMaybe<Scalars['Boolean']['input']>;
  canManageTenant?: InputMaybe<Scalars['Boolean']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
};

export type CreateKeycloakUserInput = {
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  realmRole?: InputMaybe<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};

export type CreateOperatorAbsenceTypeInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type CreateOperatorInput = {
  canCollectPayment?: InputMaybe<Scalars['Boolean']['input']>;
  categoryId?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  legacyUserId?: InputMaybe<Scalars['ID']['input']>;
  macroCategory: OperatorMacroCategory;
  maxConcurrentAppointments?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  preferredDurations?: InputMaybe<Array<Scalars['Int']['input']>>;
  professionalRegistration?: InputMaybe<Scalars['String']['input']>;
  royaltyPercentage?: InputMaybe<Scalars['Float']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreatePatientAnamnesisInput = {
  /** Allergie note */
  allergie?: InputMaybe<Scalars['String']['input']>;
  /** Gruppo sanguigno */
  gruppoSanguigno?: InputMaybe<Scalars['String']['input']>;
  /** Interventi chirurgici subiti */
  interventiChirurgici?: InputMaybe<Scalars['String']['input']>;
  /** Medico di base / curante */
  medicoBase?: InputMaybe<Scalars['String']['input']>;
  /** Note generali */
  note?: InputMaybe<Scalars['String']['input']>;
  /** ID operatore che compila */
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  /** Patologie croniche attuali */
  patologieCroniche?: InputMaybe<Scalars['String']['input']>;
  /** Patologie pregresse */
  patologiePregresse?: InputMaybe<Scalars['String']['input']>;
  /** Storia familiare / Anamnesi familiare */
  storiaFamiliare?: InputMaybe<Scalars['String']['input']>;
  /** subjectId del paziente nel registry */
  subjectId: Scalars['ID']['input'];
  /** Terapia farmacologica in corso */
  terapiaFarmacologica?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Traumi significativi */
  traumi?: InputMaybe<Scalars['String']['input']>;
};

/** Input per creare un nuovo paziente */
export type CreatePatientInput = {
  /** Dati sanitari iniziali (opzionali) */
  anamnesis?: InputMaybe<UpdatePatientAnamnesisInput>;
  /** Anagrafica (PII), inviata al registry */
  registry: CreateRegistryIndividualInput;
};

export type CreatePatientRelationshipInput = {
  /** subjectId del paziente */
  fromSubjectId: Scalars['ID']['input'];
  /** Tipo di relazione (PARENT_OF, LEGAL_GUARDIAN_OF, SPOUSE_OF, ...) */
  relationshipType: Scalars['String']['input'];
  /** subjectId della persona di riferimento (genitore/tutore/...) */
  toSubjectId: Scalars['ID']['input'];
  /** ISO date */
  validFrom?: InputMaybe<Scalars['String']['input']>;
  /** ISO date */
  validTo?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  patternDuration: Scalars['Int']['input'];
  patterns: Array<PatternInput>;
};

export type CreatePrivacyOfficerInput = {
  certification?: InputMaybe<Scalars['String']['input']>;
  certificationExpiry?: InputMaybe<Scalars['DateTime']['input']>;
  dpoRegistrationNumber?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
};

export type CreateRegistryIndividualInput = {
  addresses?: InputMaybe<Array<RegistryAddressInput>>;
  /** ISO2 country code della nascita */
  birthCountry?: InputMaybe<Scalars['String']['input']>;
  /** Data nascita ISO (yyyy-mm-dd) */
  birthDate?: InputMaybe<Scalars['String']['input']>;
  birthPlace?: InputMaybe<Scalars['String']['input']>;
  contacts?: InputMaybe<Array<RegistryContactInput>>;
  firstName: Scalars['String']['input'];
  /** M | F | X */
  gender?: InputMaybe<Scalars['String']['input']>;
  lastName: Scalars['String']['input'];
  /** ADULT_AUTONOMOUS | MINOR_WITH_GUARDIAN | INCAPACITATED_WITH_GUARDIAN | ELDERLY_WITH_GUARDIAN */
  legalCapacity?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  taxCode?: InputMaybe<Scalars['String']['input']>;
  vatNumber?: InputMaybe<Scalars['String']['input']>;
};

export type CreateSecretaryInput = {
  canManageAppointments?: InputMaybe<Scalars['Boolean']['input']>;
  canManageBilling?: InputMaybe<Scalars['Boolean']['input']>;
  department?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTaskMessageInput = {
  availableFrom?: InputMaybe<Scalars['DateTime']['input']>;
  content: Scalars['String']['input'];
  recipientUserId: Scalars['String']['input'];
};

export type CreateTemplatePatternInput = {
  dayInPattern: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  name: Scalars['String']['input'];
  patternDuration: Scalars['Int']['input'];
  startTime: Scalars['String']['input'];
};

export type CreateTherapeuticPathInput = {
  diagnosis?: InputMaybe<Scalars['String']['input']>;
  externalDoctorName?: InputMaybe<Scalars['String']['input']>;
  externalPrescriptionRef?: InputMaybe<Scalars['String']['input']>;
  icdCode?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  patientId: Scalars['ID']['input'];
  primaryOperatorId: Scalars['ID']['input'];
};

export type CreateTreatmentInvoiceLineInput = {
  amount: Scalars['Float']['input'];
  description: Scalars['String']['input'];
  treatmentId: Scalars['ID']['input'];
};

export type CreateWaitingListEntryInput = {
  notes?: InputMaybe<Scalars['String']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  patientId?: InputMaybe<Scalars['ID']['input']>;
  patientName: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  priority?: Scalars['Int']['input'];
};

export type DailyAvailability = {
  __typename?: 'DailyAvailability';
  date: Scalars['String']['output'];
  hasAvailability: Scalars['Boolean']['output'];
  slots: Array<AvailabilitySlot>;
};

export type DayAvailabilityV3 = {
  __typename?: 'DayAvailabilityV3';
  /** Data (YYYY-MM-DD) */
  date: Scalars['String']['output'];
  /** Intervalli realmente liberi (template meno appuntamenti) */
  freeBlocks: Array<TimeBlockV3>;
};

export type DeleteOperatorResult = {
  __typename?: 'DeleteOperatorResult';
  archived: Scalars['Boolean']['output'];
  dependencies: OperatorDependencyCount;
  hardDeleted: Scalars['Boolean']['output'];
};

/** Stato di una singola coda DLQ monitorata. */
export type DlqQueueStatusGql = {
  __typename?: 'DlqQueueStatusGql';
  errorMessage?: Maybe<Scalars['String']['output']>;
  messageCount: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  reachable: Scalars['Boolean']['output'];
};

/** Snapshot stato delle DLQ accounting↔clinico per widget admin. healthy=true significa zero messaggi pending e tutte le code raggiungibili. */
export type DlqStatusGql = {
  __typename?: 'DlqStatusGql';
  checkedAt: Scalars['DateTime']['output'];
  healthy: Scalars['Boolean']['output'];
  queues: Array<DlqQueueStatusGql>;
  totalMessages: Scalars['Float']['output'];
};

/** Category of attached document */
export enum DocumentCategory {
  Consent = 'CONSENT',
  Other = 'OTHER',
  Prescription = 'PRESCRIPTION',
  Radiology = 'RADIOLOGY',
  Report = 'REPORT'
}

/** Type of attached document */
export enum DocumentType {
  Image = 'IMAGE',
  Other = 'OTHER',
  Pdf = 'PDF',
  Video = 'VIDEO'
}

export type EvaluationExam = {
  __typename?: 'EvaluationExam';
  createdAt: Scalars['DateTime']['output'];
  /** Data dell'esame */
  data?: Maybe<Scalars['DateTime']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  evaluationId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  /** Nome dell'esame diagnostico */
  nomeEsame: Scalars['String']['output'];
  /** Note/risultati dell'esame */
  note?: Maybe<Scalars['String']['output']>;
  /** Ordine di visualizzazione */
  orderIndex: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type EvaluationExamInput = {
  data?: InputMaybe<Scalars['String']['input']>;
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  nomeEsame: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  orderIndex?: InputMaybe<Scalars['Int']['input']>;
};

export type EvaluationObjective = {
  __typename?: 'EvaluationObjective';
  createdAt: Scalars['DateTime']['output'];
  /** Data in cui l'obiettivo è stato raggiunto */
  dataRaggiungimento?: Maybe<Scalars['DateTime']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  /** Descrizione dell'obiettivo */
  descrizione: Scalars['String']['output'];
  evaluationId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  /** Ordine di visualizzazione */
  orderIndex: Scalars['Int']['output'];
  /** Storico avanzamenti */
  progressHistory?: Maybe<Array<ObjectiveProgressHistory>>;
  /** Livello progresso 0-5 (0=non iniziato, 5=completato) */
  progressLevel: Scalars['Int']['output'];
  /** Obiettivo raggiunto */
  raggiunto: Scalars['Boolean']['output'];
  /** Tipo di obiettivo (breve, medio, lungo termine) */
  tipo: ObjectiveType;
  updatedAt: Scalars['DateTime']['output'];
};

export type EvaluationObjectiveInput = {
  dataRaggiungimento?: InputMaybe<Scalars['String']['input']>;
  descrizione: Scalars['String']['input'];
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  orderIndex?: InputMaybe<Scalars['Int']['input']>;
  raggiunto?: InputMaybe<Scalars['Boolean']['input']>;
  tipo: ObjectiveType;
};

export type EvaluationTest = {
  __typename?: 'EvaluationTest';
  createdAt: Scalars['DateTime']['output'];
  /** Data di esecuzione del test */
  dataEsecuzione?: Maybe<Scalars['DateTime']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  /** Storico valutazioni */
  evaluationHistory?: Maybe<Array<TestEvaluationHistory>>;
  evaluationId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  /** Nome del test */
  nome: Scalars['String']['output'];
  /** Ordine di visualizzazione */
  orderIndex: Scalars['Int']['output'];
  /** Risultato del test */
  risultato?: Maybe<Scalars['String']['output']>;
  /** Sezione della valutazione (esame obiettivo o monitoraggio) */
  sezione: TestSection;
  /** Test superato (null = non ancora valutato) */
  superato?: Maybe<Scalars['Boolean']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type EvaluationTestInput = {
  dataEsecuzione?: InputMaybe<Scalars['String']['input']>;
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  nome: Scalars['String']['input'];
  orderIndex?: InputMaybe<Scalars['Int']['input']>;
  risultato?: InputMaybe<Scalars['String']['input']>;
  sezione: TestSection;
  superato?: InputMaybe<Scalars['Boolean']['input']>;
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

export type GeneralSettings = {
  __typename?: 'GeneralSettings';
  category?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  value: Scalars['JSON']['output'];
  valueType: Scalars['String']['output'];
};

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

export type GymException = {
  __typename?: 'GymException';
  absenceTypeId?: Maybe<Scalars['ID']['output']>;
  absenceTypeSnapshot?: Maybe<AbsenceTypeSnapshot>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  endTime?: Maybe<Scalars['String']['output']>;
  exceptionDate: Scalars['String']['output'];
  exceptionType: GymExceptionType;
  gymRoom?: Maybe<GymRoom>;
  gymRoomId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  startTime?: Maybe<Scalars['String']['output']>;
  substituteOperator?: Maybe<Operator>;
  substituteOperatorId?: Maybe<Scalars['ID']['output']>;
  substitutes?: Maybe<Array<GymExceptionSubstitute>>;
  updatedAt: Scalars['DateTime']['output'];
};

export type GymExceptionSubstitute = {
  __typename?: 'GymExceptionSubstitute';
  createdAt: Scalars['DateTime']['output'];
  endTime: Scalars['String']['output'];
  gymExceptionId: Scalars['ID']['output'];
  gymRoom: GymRoom;
  gymRoomId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  isClosed: Scalars['Boolean']['output'];
  startTime: Scalars['String']['output'];
  substituteOperator?: Maybe<Operator>;
  substituteOperatorId?: Maybe<Scalars['ID']['output']>;
};

export type GymExceptionSubstituteInput = {
  endTime: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
  isClosed?: InputMaybe<Scalars['Boolean']['input']>;
  startTime: Scalars['String']['input'];
  substituteOperatorId?: InputMaybe<Scalars['ID']['input']>;
};

/** Tipo di eccezione per la palestra */
export enum GymExceptionType {
  Closed = 'CLOSED',
  ModifiedHours = 'MODIFIED_HOURS',
  OperatorAbsent = 'OPERATOR_ABSENT'
}

export type GymPatternGroup = {
  __typename?: 'GymPatternGroup';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  gymRoom: GymRoom;
  gymRoomId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isCurrent: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  patternDuration: Scalars['Int']['output'];
  patternStartDate: Scalars['String']['output'];
  patterns?: Maybe<Array<GymTemplatePattern>>;
  updatedAt: Scalars['DateTime']['output'];
  validFrom: Scalars['String']['output'];
  validUntil?: Maybe<Scalars['String']['output']>;
  version: Scalars['Int']['output'];
};

export type GymRoom = {
  __typename?: 'GymRoom';
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  defaultEndTime?: Maybe<Scalars['String']['output']>;
  defaultStartTime?: Maybe<Scalars['String']['output']>;
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

export type GymSlotInfo = {
  __typename?: 'GymSlotInfo';
  currentCount: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  isAvailable: Scalars['Boolean']['output'];
  isClosed: Scalars['Boolean']['output'];
  maxCapacity: Scalars['Int']['output'];
  operator?: Maybe<GymSlotOperatorInfo>;
  startTime: Scalars['String']['output'];
};

export type GymSlotInfoWithContext = {
  __typename?: 'GymSlotInfoWithContext';
  currentCount: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  gymRoomId: Scalars['ID']['output'];
  isAvailable: Scalars['Boolean']['output'];
  isClosed: Scalars['Boolean']['output'];
  maxCapacity: Scalars['Int']['output'];
  operator?: Maybe<GymSlotOperatorInfo>;
  startTime: Scalars['String']['output'];
};

export type GymSlotOperatorInfo = {
  __typename?: 'GymSlotOperatorInfo';
  color?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  surname?: Maybe<Scalars['String']['output']>;
};

export type GymSlotOutput = {
  __typename?: 'GymSlotOutput';
  availableCapacity: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  operatorName?: Maybe<Scalars['String']['output']>;
  startTime: Scalars['String']['output'];
  totalCapacity: Scalars['Int']['output'];
};

export type GymTemplatePattern = {
  __typename?: 'GymTemplatePattern';
  createdAt: Scalars['DateTime']['output'];
  dayInPattern: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  gymPatternGroupId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  patternGroup: GymPatternGroup;
  startTime: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
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
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
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
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
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

export type ItManager = {
  __typename?: 'ItManager';
  appUser: AppUser;
  appUserId: Scalars['ID']['output'];
  canManageIntegrations: Scalars['Boolean']['output'];
  canManageTenant: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type KeycloakOrgMember = {
  __typename?: 'KeycloakOrgMember';
  email?: Maybe<Scalars['String']['output']>;
  emailVerified: Scalars['Boolean']['output'];
  enabled: Scalars['Boolean']['output'];
  firstName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isLinked: Scalars['Boolean']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  linkedAppUserId?: Maybe<Scalars['String']['output']>;
  linkedAppUserName?: Maybe<Scalars['String']['output']>;
  realmRoles?: Maybe<Array<KeycloakRealmRoleType>>;
  username: Scalars['String']['output'];
};

export type KeycloakRealmRoleType = {
  __typename?: 'KeycloakRealmRoleType';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type LinkKeycloakUserInput = {
  appUserId: Scalars['ID']['input'];
  keycloakUserId: Scalars['String']['input'];
};

export type MarkObjectiveAchievedInput = {
  raggiunto: Scalars['Boolean']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  activateGymPatternGroup: GymPatternGroup;
  addTestEvaluation: EvaluationTest;
  anonymizeExpiredWhatsappLogs: WhatsappLogManagementResult;
  anonymizeWhatsappLogs: WhatsappLogManagementResult;
  assignKeycloakRealmRole: Scalars['Boolean']['output'];
  assignPermissionToRole: RolePermission;
  assignRole: UserRole;
  assignServiceToOperator: OperatorService;
  assignTemplateToOperator: Array<TemplateAssignment>;
  cancelAppointmentWithNotice: AvailabilityAppointment;
  cancelAvailabilityAppointment: AvailabilityAppointment;
  cancelRecurringSeries: Scalars['Int']['output'];
  cancelTreatment: Treatment;
  closeTreatment: Treatment;
  completeTaskMessage: Scalars['Boolean']['output'];
  completeTreatment: Treatment;
  confirmAvailabilityAppointment: AvailabilityAppointment;
  createAppUser: AppUser;
  createAvailabilityAppointment: AvailabilityAppointment;
  createAvailabilityException: AvailabilityException;
  createAvailabilityTemplate: AvailabilityTemplate;
  createEvaluation: PatientEvaluation;
  createException: AvailabilityException;
  createGroupException: GroupException;
  createGymAppointment: AvailabilityAppointment;
  createGymException: GymException;
  createGymPatternGroup: GymPatternGroup;
  createGymRoom: GymRoom;
  createGymSchedule: GymSchedule;
  createInstrument: Instrument;
  createInstrumentCategory: InstrumentCategory;
  createItManager: ItManager;
  createKeycloakUser: KeycloakOrgMember;
  createOperator: Operator;
  createOperatorAbsenceType: OperatorAbsenceType;
  createOperatorCategory: OperatorCategory;
  createPathDocument: PathDocument;
  createPatient: Patient;
  /** Crea nuova anamnesi paziente */
  createPatientAnamnesis: PatientAnamnesis;
  createPatientRelationship: Scalars['Boolean']['output'];
  createPatternGroup: PatternGroup;
  createPrivacyOfficer: PrivacyOfficer;
  createProduct: Product;
  createRole: Role;
  createRoom: Room;
  createSecretary: Secretary;
  createService: Service;
  createServiceSubcategory: ServiceSubcategory;
  createSickLeave: Array<AvailabilityException>;
  createTaskMessage: TaskMessageResult;
  createTemplatePattern: Array<TemplatePattern>;
  createTherapeuticPath: TherapeuticPath;
  createTreatment: Treatment;
  createTreatmentInvoiceLine: TreatmentInvoiceLine;
  createVacation: Array<AvailabilityException>;
  createWaitingListEntry: WaitingListEntry;
  deactivateAllTemplateAssignmentsForOperator: Scalars['Boolean']['output'];
  deactivateGymPatternGroup: GymPatternGroup;
  deactivatePatient: Scalars['Boolean']['output'];
  deactivateTemplateAssignment: TemplateAssignment;
  deleteAllTreatments: Scalars['Int']['output'];
  deleteAppUser: Scalars['Boolean']['output'];
  deleteAvailabilityAppointment: Scalars['Boolean']['output'];
  deleteAvailabilityTemplate: Scalars['Boolean']['output'];
  deleteEvaluation: Scalars['Boolean']['output'];
  deleteEvaluationTest: Scalars['Boolean']['output'];
  deleteException: Scalars['Boolean']['output'];
  deleteExceptionsByDateRange: Scalars['Int']['output'];
  deleteExpiredWhatsappLogs: WhatsappLogManagementResult;
  deleteGeneralSetting: Scalars['Boolean']['output'];
  deleteGroupException: Scalars['Boolean']['output'];
  deleteGymException: Scalars['Boolean']['output'];
  deleteGymPatternGroup: Scalars['Boolean']['output'];
  deleteGymRoom: Scalars['Boolean']['output'];
  deleteGymSchedule: Scalars['Boolean']['output'];
  deleteHolidaysForYear: Scalars['Int']['output'];
  deleteInstrument: Scalars['Boolean']['output'];
  deleteInstrumentCategory: Scalars['Boolean']['output'];
  deleteItManager: Scalars['Boolean']['output'];
  deleteKeycloakUser: Scalars['Boolean']['output'];
  deleteOperator: DeleteOperatorResult;
  deleteOperatorAbsenceType: Scalars['Boolean']['output'];
  deleteOperatorCategory: Scalars['Boolean']['output'];
  deletePathDocument: Scalars['Boolean']['output'];
  /** Elimina anamnesi paziente */
  deletePatientAnamnesis: Scalars['Boolean']['output'];
  deletePatientRelationship: Scalars['Boolean']['output'];
  deletePatternGroup: Scalars['Boolean']['output'];
  deletePrivacyOfficer: Scalars['Boolean']['output'];
  deleteProduct: Scalars['Boolean']['output'];
  deleteRecurringSeries: Scalars['Int']['output'];
  deleteRole: Scalars['Boolean']['output'];
  deleteRoom: Scalars['Boolean']['output'];
  deleteSecretary: Scalars['Boolean']['output'];
  deleteService: Scalars['Boolean']['output'];
  deleteServiceSubcategory: Scalars['Boolean']['output'];
  deleteTaskMessage: Scalars['Boolean']['output'];
  deleteTemplateAssignment: Scalars['Boolean']['output'];
  deleteTemplatePattern: Scalars['Boolean']['output'];
  deleteTestEvaluationEntry: Scalars['Boolean']['output'];
  deleteTherapeuticPath: Scalars['Boolean']['output'];
  deleteTreatment: Scalars['Boolean']['output'];
  deleteTreatmentInvoiceLine: Scalars['Boolean']['output'];
  deleteWaitingListEntry: Scalars['Boolean']['output'];
  deleteWhatsappLogs: WhatsappLogManagementResult;
  dismissBillingAlert: Treatment;
  dismissReturnFromAccountingBanner: Treatment;
  duplicateGymPatternGroup: GymPatternGroup;
  editTestEvaluation: EvaluationTest;
  editTestEvaluationEntry: TestEvaluationHistory;
  emptyRecycleBin: Scalars['Int']['output'];
  forceCloseTreatment: Treatment;
  generateHolidaysForOperator: Scalars['Int']['output'];
  generateHolidaysForYear: Scalars['Int']['output'];
  initializeDefaultSettings: Scalars['Boolean']['output'];
  linkKeycloakUser: AppUser;
  markAppointmentAsNoShow: AvailabilityAppointment;
  markAppointmentAttended: AvailabilityAppointment;
  markAppointmentNoShow: AvailabilityAppointment;
  markObjectiveAchieved: EvaluationObjective;
  markTaskMessageAsRead: Scalars['Boolean']['output'];
  markTreatmentInvoicedByOperator: Treatment;
  markTreatmentInvoicedToPatient: Treatment;
  provisionTenantSchema: TenantSchemaStatus;
  purgeFromRecycleBin: Scalars['Boolean']['output'];
  rebuildAvailabilityCache: Scalars['Boolean']['output'];
  recordPatientAttendance: Scalars['Boolean']['output'];
  recordProductSale: SaleCompletedResult;
  recordTreatmentPayment: Treatment;
  removeServiceFromOperator: Scalars['Boolean']['output'];
  /** @deprecated Usa reopenTreatmentByOperator o reopenTreatmentBySecretary */
  reopenTreatment: Treatment;
  reopenTreatmentByOperator: Treatment;
  reopenTreatmentBySecretary: Treatment;
  reorderWaitingList: Array<WaitingListEntry>;
  requestTreatmentRecall: Treatment;
  resendTreatmentToAccounting: Treatment;
  resetKeycloakPassword: Scalars['Boolean']['output'];
  resetTestEvaluation: EvaluationTest;
  resolveAppointmentConflict: AvailabilityAppointment;
  resolveMultipleConflicts: Array<AvailabilityAppointment>;
  restoreFromRecycleBin: Scalars['Boolean']['output'];
  restoreOperator: Operator;
  revertAppointmentAttended: AvailabilityAppointment;
  revokeKeycloakRealmRole: Scalars['Boolean']['output'];
  revokePermissionFromRole: Scalars['Boolean']['output'];
  revokeRole: Scalars['Boolean']['output'];
  sendAppointmentRecap: Scalars['Boolean']['output'];
  setInstrumentStatus: Instrument;
  setPatientPrivacyConsent: Patient;
  setPatternGroupActive: PatternGroup;
  setTreatmentsReadyForBilling: Array<Treatment>;
  testWhatsappConnection: Scalars['Boolean']['output'];
  testWhatsappDirect: WhatsappTestResult;
  testWhatsappFullFlow: WhatsappTestResult;
  testWhatsappRecap: WhatsappTestResult;
  unlinkKeycloakUser: AppUser;
  updateAppUser: AppUser;
  updateAvailabilityAppointment: AvailabilityAppointment;
  updateAvailabilityTemplate: AvailabilityTemplate;
  updateEvaluation: PatientEvaluation;
  updateException: AvailabilityException;
  updateGeneralSetting: GeneralSettings;
  updateGymException: GymException;
  updateGymPatternGroup: GymPatternGroup;
  updateGymRoom: GymRoom;
  updateGymSchedule: GymSchedule;
  updateInstrument: Instrument;
  updateInstrumentCategory: InstrumentCategory;
  updateKeycloakUser: Scalars['Boolean']['output'];
  updateObjectiveProgress: EvaluationObjective;
  updateOperator: Operator;
  updateOperatorAbsenceType: OperatorAbsenceType;
  updateOperatorCategory: OperatorCategory;
  updateOperatorService: OperatorService;
  /** Aggiorna anamnesi paziente */
  updatePatientAnamnesis: PatientAnamnesis;
  updatePatientRegistry: Patient;
  updatePatternGroup: PatternGroup;
  updatePatternGroupWithConflicts: PatternGroupUpdateOutput;
  updateProduct: Product;
  updateRecurringSeriesTime: RecurringSeriesOperationResult;
  updateRecycleBinSettings: RecycleBinSettings;
  updateRoom: Room;
  updateService: Service;
  updateServiceSubcategory: ServiceSubcategory;
  updateTaskMessage: Scalars['Boolean']['output'];
  updateTemplateAssignment: TemplateAssignment;
  updateTemplatePattern: TemplatePattern;
  updateTestResult: EvaluationTest;
  updateTherapeuticPath: TherapeuticPath;
  updateTreatment: Treatment;
  updateTreatmentBySecretary: Treatment;
  updateTreatmentInstruments: Treatment;
  updateTreatmentInvoiceLine: TreatmentInvoiceLine;
  updateTreatmentServiceInvoiceDescription: TreatmentService;
  updateWaitingListEntry: WaitingListEntry;
  upsertGeneralSetting: GeneralSettings;
  /** Crea o aggiorna anamnesi paziente */
  upsertPatientAnamnesis: PatientAnamnesis;
  upsertPatientRelationshipExtension: Scalars['Boolean']['output'];
  upsertServiceInvoicePrefix: ServiceInvoicePrefix;
  upsertWhatsappConfig: WhatsappTenantConfig;
  upsertWhatsappTemplate: WhatsappMessageTemplate;
  verifyKeycloakEmail: Scalars['Boolean']['output'];
};


export type MutationActivateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAddTestEvaluationArgs = {
  input: AddTestEvaluationInput;
  operatorId: Scalars['ID']['input'];
  pathId: Scalars['ID']['input'];
  testId: Scalars['ID']['input'];
};


export type MutationAnonymizeWhatsappLogsArgs = {
  input: WhatsappBulkLogIdsInput;
};


export type MutationAssignKeycloakRealmRoleArgs = {
  keycloakUserId: Scalars['ID']['input'];
  roleName: Scalars['String']['input'];
};


export type MutationAssignPermissionToRoleArgs = {
  permissionId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};


export type MutationAssignRoleArgs = {
  input: AssignRoleInput;
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


export type MutationCancelAppointmentWithNoticeArgs = {
  cancelledBy: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type MutationCancelAvailabilityAppointmentArgs = {
  cancellationReason?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationCancelRecurringSeriesArgs = {
  appointmentId: Scalars['ID']['input'];
  cancelledBy: Scalars['ID']['input'];
  fromDate: Scalars['String']['input'];
  reason: Scalars['String']['input'];
  scope: RecurringSeriesScope;
};


export type MutationCancelTreatmentArgs = {
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type MutationCloseTreatmentArgs = {
  id: Scalars['ID']['input'];
  input: CloseTreatmentInput;
};


export type MutationCompleteTaskMessageArgs = {
  messageId: Scalars['String']['input'];
};


export type MutationCompleteTreatmentArgs = {
  id: Scalars['ID']['input'];
  input: CompleteTreatmentInput;
};


export type MutationConfirmAvailabilityAppointmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateAppUserArgs = {
  input: CreateAppUserInput;
};


export type MutationCreateAvailabilityAppointmentArgs = {
  input: CreateAvailabilityAppointmentInput;
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


export type MutationCreateEvaluationArgs = {
  input: CreateEvaluationInput;
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


export type MutationCreateGymAppointmentArgs = {
  input: CreateGymAppointmentInput;
};


export type MutationCreateGymExceptionArgs = {
  input: CreateGymExceptionInput;
};


export type MutationCreateGymPatternGroupArgs = {
  input: CreateGymPatternGroupInput;
};


export type MutationCreateGymRoomArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  defaultEndTime?: InputMaybe<Scalars['String']['input']>;
  defaultStartTime?: InputMaybe<Scalars['String']['input']>;
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


export type MutationCreateItManagerArgs = {
  input: CreateItManagerInput;
};


export type MutationCreateKeycloakUserArgs = {
  input: CreateKeycloakUserInput;
};


export type MutationCreateOperatorArgs = {
  input: CreateOperatorInput;
};


export type MutationCreateOperatorAbsenceTypeArgs = {
  input: CreateOperatorAbsenceTypeInput;
};


export type MutationCreateOperatorCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['input'];
};


export type MutationCreatePathDocumentArgs = {
  input: CreateDocumentInput;
};


export type MutationCreatePatientArgs = {
  input: CreatePatientInput;
};


export type MutationCreatePatientAnamnesisArgs = {
  input: CreatePatientAnamnesisInput;
};


export type MutationCreatePatientRelationshipArgs = {
  input: CreatePatientRelationshipInput;
};


export type MutationCreatePatternGroupArgs = {
  input: CreatePatternGroupInput;
};


export type MutationCreatePrivacyOfficerArgs = {
  input: CreatePrivacyOfficerInput;
};


export type MutationCreateProductArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
  defaultPrice: Scalars['Float']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  productCode: Scalars['String']['input'];
};


export type MutationCreateRoleArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationCreateRoomArgs = {
  capacity?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationCreateSecretaryArgs = {
  input: CreateSecretaryInput;
};


export type MutationCreateServiceArgs = {
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  defaultDuration: Scalars['Int']['input'];
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  discountFE?: InputMaybe<Scalars['Float']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name: Scalars['String']['input'];
  preferredDuration?: InputMaybe<Scalars['Int']['input']>;
  serviceCode: Scalars['String']['input'];
  serviceFee?: InputMaybe<Scalars['Float']['input']>;
  serviceFeeFE?: InputMaybe<Scalars['Float']['input']>;
  studioExtra?: InputMaybe<Scalars['Float']['input']>;
  studioExtraFE?: InputMaybe<Scalars['Float']['input']>;
  subcategoryId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateServiceSubcategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['input'];
};


export type MutationCreateSickLeaveArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};


export type MutationCreateTaskMessageArgs = {
  input: CreateTaskMessageInput;
};


export type MutationCreateTemplatePatternArgs = {
  input: CreateTemplatePatternInput;
};


export type MutationCreateTherapeuticPathArgs = {
  input: CreateTherapeuticPathInput;
};


export type MutationCreateTreatmentArgs = {
  appointmentId: Scalars['ID']['input'];
  scontoFE?: InputMaybe<Scalars['Boolean']['input']>;
  therapeuticPathId: Scalars['ID']['input'];
};


export type MutationCreateTreatmentInvoiceLineArgs = {
  createdBy?: InputMaybe<Scalars['ID']['input']>;
  input: CreateTreatmentInvoiceLineInput;
};


export type MutationCreateVacationArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};


export type MutationCreateWaitingListEntryArgs = {
  input: CreateWaitingListEntryInput;
};


export type MutationDeactivateAllTemplateAssignmentsForOperatorArgs = {
  operatorId: Scalars['ID']['input'];
};


export type MutationDeactivateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeactivatePatientArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeactivateTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAppUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAvailabilityAppointmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAvailabilityTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteEvaluationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteEvaluationTestArgs = {
  evaluationId: Scalars['ID']['input'];
  testId: Scalars['ID']['input'];
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


export type MutationDeleteGeneralSettingArgs = {
  key: Scalars['String']['input'];
};


export type MutationDeleteGroupExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteGymExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteGymPatternGroupArgs = {
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


export type MutationDeleteItManagerArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteKeycloakUserArgs = {
  keycloakUserId: Scalars['ID']['input'];
};


export type MutationDeleteOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteOperatorAbsenceTypeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteOperatorCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePathDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePatientAnamnesisArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePatientRelationshipArgs = {
  relationshipId: Scalars['ID']['input'];
};


export type MutationDeletePatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePrivacyOfficerArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteProductArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRecurringSeriesArgs = {
  appointmentId: Scalars['ID']['input'];
  fromDate: Scalars['String']['input'];
  includeCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  rangeFrom?: InputMaybe<Scalars['String']['input']>;
  rangeTo?: InputMaybe<Scalars['String']['input']>;
  scope: RecurringSeriesScope;
};


export type MutationDeleteRoleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRoomArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSecretaryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteServiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteServiceSubcategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTaskMessageArgs = {
  messageId: Scalars['String']['input'];
};


export type MutationDeleteTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplatePatternArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTestEvaluationEntryArgs = {
  evaluationHistoryId: Scalars['ID']['input'];
};


export type MutationDeleteTherapeuticPathArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTreatmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTreatmentInvoiceLineArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteWaitingListEntryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteWhatsappLogsArgs = {
  input: WhatsappBulkLogIdsInput;
};


export type MutationDismissBillingAlertArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDismissReturnFromAccountingBannerArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDuplicateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
  newName: Scalars['String']['input'];
};


export type MutationEditTestEvaluationArgs = {
  newLevel: Scalars['Int']['input'];
  operatorId: Scalars['ID']['input'];
  testId: Scalars['ID']['input'];
};


export type MutationEditTestEvaluationEntryArgs = {
  evaluationHistoryId: Scalars['ID']['input'];
  evaluationLevel: Scalars['Int']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEmptyRecycleBinArgs = {
  force?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationForceCloseTreatmentArgs = {
  id: Scalars['ID']['input'];
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
};


export type MutationGenerateHolidaysForOperatorArgs = {
  operatorId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};


export type MutationGenerateHolidaysForYearArgs = {
  year: Scalars['Int']['input'];
};


export type MutationLinkKeycloakUserArgs = {
  input: LinkKeycloakUserInput;
};


export type MutationMarkAppointmentAsNoShowArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMarkAppointmentAttendedArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMarkAppointmentNoShowArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMarkObjectiveAchievedArgs = {
  input: MarkObjectiveAchievedInput;
  objectiveId: Scalars['ID']['input'];
};


export type MutationMarkTaskMessageAsReadArgs = {
  messageId: Scalars['String']['input'];
};


export type MutationMarkTreatmentInvoicedByOperatorArgs = {
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMarkTreatmentInvoicedToPatientArgs = {
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
};


export type MutationPurgeFromRecycleBinArgs = {
  entityType: RecycleBinEntityType;
  id: Scalars['ID']['input'];
};


export type MutationRebuildAvailabilityCacheArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type MutationRecordPatientAttendanceArgs = {
  appointmentId?: InputMaybe<Scalars['ID']['input']>;
  eventType: Scalars['String']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  subjectId: Scalars['ID']['input'];
};


export type MutationRecordProductSaleArgs = {
  input: RecordProductSaleInput;
};


export type MutationRecordTreatmentPaymentArgs = {
  callerRole?: InputMaybe<TreatmentCallerRole>;
  id: Scalars['ID']['input'];
  input: RecordPaymentInput;
};


export type MutationRemoveServiceFromOperatorArgs = {
  operatorId: Scalars['ID']['input'];
  serviceId: Scalars['ID']['input'];
};


export type MutationReopenTreatmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationReopenTreatmentByOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type MutationReopenTreatmentBySecretaryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationReorderWaitingListArgs = {
  input: ReorderWaitingListInput;
};


export type MutationRequestTreatmentRecallArgs = {
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};


export type MutationResendTreatmentToAccountingArgs = {
  id: Scalars['ID']['input'];
};


export type MutationResetKeycloakPasswordArgs = {
  input: ResetKeycloakPasswordInput;
};


export type MutationResetTestEvaluationArgs = {
  testId: Scalars['ID']['input'];
};


export type MutationResolveAppointmentConflictArgs = {
  action: ConflictResolutionAction;
  appointmentId: Scalars['ID']['input'];
  newDate?: InputMaybe<Scalars['String']['input']>;
  newEndTime?: InputMaybe<Scalars['String']['input']>;
  newStartTime?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  resolvedBy: Scalars['ID']['input'];
};


export type MutationResolveMultipleConflictsArgs = {
  action: ConflictResolutionAction;
  appointmentIds: Array<Scalars['ID']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  resolvedBy: Scalars['ID']['input'];
};


export type MutationRestoreFromRecycleBinArgs = {
  entityType: RecycleBinEntityType;
  id: Scalars['ID']['input'];
};


export type MutationRestoreOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRevertAppointmentAttendedArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRevokeKeycloakRealmRoleArgs = {
  keycloakUserId: Scalars['ID']['input'];
  roleName: Scalars['String']['input'];
};


export type MutationRevokePermissionFromRoleArgs = {
  permissionId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};


export type MutationRevokeRoleArgs = {
  input: AssignRoleInput;
};


export type MutationSendAppointmentRecapArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type MutationSetInstrumentStatusArgs = {
  id: Scalars['ID']['input'];
  status: InstrumentStatus;
};


export type MutationSetPatientPrivacyConsentArgs = {
  documentRef?: InputMaybe<Scalars['String']['input']>;
  given: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};


export type MutationSetPatternGroupActiveArgs = {
  id: Scalars['ID']['input'];
  isActive: Scalars['Boolean']['input'];
};


export type MutationSetTreatmentsReadyForBillingArgs = {
  ids: Array<Scalars['ID']['input']>;
  immediateInvoice?: InputMaybe<Scalars['Boolean']['input']>;
  ready: Scalars['Boolean']['input'];
};


export type MutationTestWhatsappDirectArgs = {
  message?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone: Scalars['String']['input'];
};


export type MutationTestWhatsappFullFlowArgs = {
  name: Scalars['String']['input'];
  phone: Scalars['String']['input'];
};


export type MutationTestWhatsappRecapArgs = {
  name: Scalars['String']['input'];
  phone: Scalars['String']['input'];
};


export type MutationUnlinkKeycloakUserArgs = {
  appUserId: Scalars['ID']['input'];
};


export type MutationUpdateAppUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAppUserInput;
};


export type MutationUpdateAvailabilityAppointmentArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAvailabilityAppointmentInput;
};


export type MutationUpdateAvailabilityTemplateArgs = {
  id: Scalars['ID']['input'];
  input: CreateAvailabilityTemplateInput;
};


export type MutationUpdateEvaluationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateEvaluationInput;
};


export type MutationUpdateExceptionArgs = {
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionType?: InputMaybe<ExceptionType>;
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateGeneralSettingArgs = {
  key: Scalars['String']['input'];
  value: Scalars['JSON']['input'];
};


export type MutationUpdateGymExceptionArgs = {
  id: Scalars['ID']['input'];
  input: UpdateGymExceptionInput;
};


export type MutationUpdateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
  input: UpdateGymPatternGroupInput;
};


export type MutationUpdateGymRoomArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  defaultEndTime?: InputMaybe<Scalars['String']['input']>;
  defaultStartTime?: InputMaybe<Scalars['String']['input']>;
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


export type MutationUpdateKeycloakUserArgs = {
  input: UpdateKeycloakUserInput;
};


export type MutationUpdateObjectiveProgressArgs = {
  input: UpdateObjectiveProgressInput;
  objectiveId: Scalars['ID']['input'];
  operatorId: Scalars['ID']['input'];
  pathId: Scalars['ID']['input'];
};


export type MutationUpdateOperatorArgs = {
  id: Scalars['ID']['input'];
  input: UpdateOperatorInput;
};


export type MutationUpdateOperatorAbsenceTypeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateOperatorAbsenceTypeInput;
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


export type MutationUpdatePatientAnamnesisArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePatientAnamnesisInput;
};


export type MutationUpdatePatientRegistryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRegistryIndividualInput;
};


export type MutationUpdatePatternGroupArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePatternGroupInput;
};


export type MutationUpdatePatternGroupWithConflictsArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePatternGroupInput;
  markConflicts?: Scalars['Boolean']['input'];
};


export type MutationUpdateProductArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  productCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateRecurringSeriesTimeArgs = {
  input: UpdateRecurringSeriesTimeInput;
};


export type MutationUpdateRecycleBinSettingsArgs = {
  retentionDays?: InputMaybe<Scalars['Int']['input']>;
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
  discountFE?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['ID']['input'];
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name?: InputMaybe<Scalars['String']['input']>;
  preferredDuration?: InputMaybe<Scalars['Int']['input']>;
  serviceCode?: InputMaybe<Scalars['String']['input']>;
  serviceFee?: InputMaybe<Scalars['Float']['input']>;
  serviceFeeFE?: InputMaybe<Scalars['Float']['input']>;
  studioExtra?: InputMaybe<Scalars['Float']['input']>;
  studioExtraFE?: InputMaybe<Scalars['Float']['input']>;
  subcategoryId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateServiceSubcategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateTaskMessageArgs = {
  input: UpdateTaskMessageInput;
  messageId: Scalars['String']['input'];
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


export type MutationUpdateTestResultArgs = {
  input: UpdateTestResultInput;
  testId: Scalars['ID']['input'];
};


export type MutationUpdateTherapeuticPathArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTherapeuticPathInput;
};


export type MutationUpdateTreatmentArgs = {
  input: UpdateTreatmentInput;
};


export type MutationUpdateTreatmentBySecretaryArgs = {
  input: UpdateTreatmentBySecretaryInput;
};


export type MutationUpdateTreatmentInstrumentsArgs = {
  id: Scalars['ID']['input'];
  instruments: Array<TreatmentInstrumentInput>;
};


export type MutationUpdateTreatmentInvoiceLineArgs = {
  input: UpdateTreatmentInvoiceLineInput;
};


export type MutationUpdateTreatmentServiceInvoiceDescriptionArgs = {
  input: UpdateTreatmentServiceInvoiceDescriptionInput;
};


export type MutationUpdateWaitingListEntryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateWaitingListEntryInput;
};


export type MutationUpsertGeneralSettingArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  value: Scalars['JSON']['input'];
  valueType?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpsertPatientAnamnesisArgs = {
  input: UpdatePatientAnamnesisInput;
  subjectId: Scalars['ID']['input'];
};


export type MutationUpsertPatientRelationshipExtensionArgs = {
  input: UpsertRelationshipExtensionInput;
};


export type MutationUpsertServiceInvoicePrefixArgs = {
  input: UpsertServiceInvoicePrefixInput;
};


export type MutationUpsertWhatsappConfigArgs = {
  input: WhatsappConfigInput;
};


export type MutationUpsertWhatsappTemplateArgs = {
  input: WhatsappTemplateInput;
};


export type MutationVerifyKeycloakEmailArgs = {
  keycloakUserId: Scalars['ID']['input'];
};

export type MyProfile = {
  __typename?: 'MyProfile';
  appUserId: Scalars['ID']['output'];
  operatorId?: Maybe<Scalars['ID']['output']>;
  permissions: Array<Scalars['String']['output']>;
  userType: AppUserType;
};

export type ObjectiveProgressHistory = {
  __typename?: 'ObjectiveProgressHistory';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** Nuovo livello (0-5) */
  newLevel: Scalars['Int']['output'];
  /** Note sull'aggiornamento */
  note?: Maybe<Scalars['String']['output']>;
  objectiveId: Scalars['ID']['output'];
  operator?: Maybe<Operator>;
  operatorId: Scalars['ID']['output'];
  /** Livello precedente (0-5) */
  previousLevel: Scalars['Int']['output'];
  /** Numero trattamenti dall'ultimo aggiornamento */
  treatmentsSinceLast: Scalars['Int']['output'];
};

/** Tipo di obiettivo terapeutico (breve, medio, lungo termine) */
export enum ObjectiveType {
  BreveTermine = 'BREVE_TERMINE',
  LungoTermine = 'LUNGO_TERMINE',
  MedioTermine = 'MEDIO_TERMINE'
}

export type ObjectivesProgress = {
  __typename?: 'ObjectivesProgress';
  achieved: Scalars['Int']['output'];
  percentage: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type Operator = {
  __typename?: 'Operator';
  appUser?: Maybe<AppUser>;
  appUserId?: Maybe<Scalars['String']['output']>;
  appointments?: Maybe<Array<AvailabilityAppointment>>;
  availabilityExceptions?: Maybe<Array<AvailabilityException>>;
  availabilityTemplates?: Maybe<Array<AvailabilityTemplate>>;
  canCollectPayment: Scalars['Boolean']['output'];
  category?: Maybe<OperatorCategory>;
  categoryId?: Maybe<Scalars['String']['output']>;
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  gymSchedules?: Maybe<Array<GymSchedule>>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  legacyUserId?: Maybe<Scalars['ID']['output']>;
  macroCategory: OperatorMacroCategory;
  maxConcurrentAppointments: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  preferredDurations?: Maybe<Array<Scalars['Int']['output']>>;
  professionalRegistration?: Maybe<Scalars['String']['output']>;
  royaltyPercentage: Scalars['Float']['output'];
  services?: Maybe<Array<OperatorService>>;
  surname?: Maybe<Scalars['String']['output']>;
  templateAssignments?: Maybe<Array<TemplateAssignment>>;
  updatedAt: Scalars['DateTime']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type OperatorAbsenceType = {
  __typename?: 'OperatorAbsenceType';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type OperatorAvailabilityResult = {
  __typename?: 'OperatorAvailabilityResult';
  availability: Array<DailyAvailability>;
  operatorId: Scalars['ID']['output'];
};

export type OperatorAvailabilityV3 = {
  __typename?: 'OperatorAvailabilityV3';
  days: Array<DayAvailabilityV3>;
  operatorId: Scalars['ID']['output'];
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

export type OperatorConflictCount = {
  __typename?: 'OperatorConflictCount';
  count: Scalars['Int']['output'];
  operatorId: Scalars['ID']['output'];
  operatorName: Scalars['String']['output'];
};

export type OperatorDependencyCount = {
  __typename?: 'OperatorDependencyCount';
  anamnesis: Scalars['Int']['output'];
  appointments: Scalars['Int']['output'];
  evaluations: Scalars['Int']['output'];
  gymSchedules: Scalars['Int']['output'];
  templateAssignments: Scalars['Int']['output'];
  therapeuticPaths: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  treatments: Scalars['Int']['output'];
  waitingList: Scalars['Int']['output'];
};

/** Macro category defining what an operator can do (use instruments, manage gym, etc.) */
export enum OperatorMacroCategory {
  Doctor = 'DOCTOR',
  GymInstructor = 'GYM_INSTRUCTOR',
  Other = 'OTHER',
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

export type OperatorSlotOnDate = {
  __typename?: 'OperatorSlotOnDate';
  endTime: Scalars['String']['output'];
  gymRoom: GymRoom;
  startTime: Scalars['String']['output'];
};

export type PaginatedPatients = {
  __typename?: 'PaginatedPatients';
  data: Array<Patient>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type PathDocument = {
  __typename?: 'PathDocument';
  category: DocumentCategory;
  description?: Maybe<Scalars['String']['output']>;
  /** Name of external doctor (for prescriptions/reports) */
  externalDoctorName?: Maybe<Scalars['String']['output']>;
  fileName: Scalars['String']['output'];
  fileSize: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  originalFileName?: Maybe<Scalars['String']['output']>;
  storagePath: Scalars['String']['output'];
  therapeuticPath: TherapeuticPath;
  therapeuticPathId: Scalars['ID']['output'];
  thumbnailPath?: Maybe<Scalars['String']['output']>;
  type: DocumentType;
  uploadedAt: Scalars['DateTime']['output'];
  uploadedBy?: Maybe<Scalars['ID']['output']>;
};

/** Façade clinica di un subject del registry */
export type Patient = {
  __typename?: 'Patient';
  anamnesis?: Maybe<PatientAnamnesis>;
  attendance: AttendanceStats;
  displayName?: Maybe<Scalars['String']['output']>;
  /** subjectId del paziente nel registry */
  id: Scalars['ID']['output'];
  isActive?: Maybe<Scalars['Boolean']['output']>;
  lastSyncedAt?: Maybe<Scalars['DateTime']['output']>;
  relationships: Array<PatientRelationship>;
  subject?: Maybe<RegistrySubject>;
};

export type PatientAnamnesis = {
  __typename?: 'PatientAnamnesis';
  /** Allergie note */
  allergie?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  /** Gruppo sanguigno (es. A+, 0-, ...) */
  gruppoSanguigno?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Interventi chirurgici subiti */
  interventiChirurgici?: Maybe<Scalars['String']['output']>;
  /** Medico di base / curante */
  medicoBase?: Maybe<Scalars['String']['output']>;
  /** Note generali */
  note?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  /** Patologie croniche attuali */
  patologieCroniche?: Maybe<Scalars['String']['output']>;
  /** Patologie pregresse (storia patologica remota) */
  patologiePregresse?: Maybe<Scalars['String']['output']>;
  /** Storia familiare / Anamnesi familiare */
  storiaFamiliare?: Maybe<Scalars['String']['output']>;
  subjectId: Scalars['ID']['output'];
  /** Terapia farmacologica in corso */
  terapiaFarmacologica?: Maybe<Array<Scalars['String']['output']>>;
  /** Traumi significativi */
  traumi?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type PatientEvaluation = {
  __typename?: 'PatientEvaluation';
  /** Andamento del dolore nel tempo */
  andamentoDolore?: Maybe<Scalars['String']['output']>;
  /** Body Mass Index */
  bmi?: Maybe<Scalars['Float']['output']>;
  /** Marker sulla mappa corporea */
  bodyMapMarkers?: Maybe<Array<BodyMapMarker>>;
  createdAt: Scalars['DateTime']['output'];
  /** Criticità identificate */
  criticita?: Maybe<Array<Scalars['String']['output']>>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  /** Diagnosi fisioterapica */
  diagnosiFisioterapica?: Maybe<Scalars['String']['output']>;
  /** Valutazione equilibrio */
  equilibrio?: Maybe<Scalars['String']['output']>;
  /** Esame neurologico */
  esameNeurologico?: Maybe<Scalars['String']['output']>;
  /** Data/periodo esordio sintomi */
  esordioSintomi?: Maybe<Scalars['String']['output']>;
  exams?: Maybe<Array<EvaluationExam>>;
  /** Fattori che aggravano i sintomi */
  fattoriAggravanti?: Maybe<Array<Scalars['String']['output']>>;
  /** Fattori che alleviano i sintomi */
  fattoriAllevianti?: Maybe<Array<Scalars['String']['output']>>;
  /** Fattori prognostici negativi */
  fattoriPrognosticiNegativi?: Maybe<Scalars['String']['output']>;
  /** Fattori prognostici positivi */
  fattoriPrognosticiPositivi?: Maybe<Scalars['String']['output']>;
  /** Valutazione forza muscolare */
  forzaMuscolare?: Maybe<Scalars['String']['output']>;
  /** Frequenza delle sedute proposta */
  frequenzaSedute?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Interventi terapeutici proposti */
  interventiProposti?: Maybe<Array<Scalars['String']['output']>>;
  /** Limitazioni nelle attività quotidiane */
  limitazioniAttivita?: Maybe<Scalars['String']['output']>;
  /** Motivo del consulto */
  motivoConsulto?: Maybe<Scalars['String']['output']>;
  /** Valutazione movimento attivo */
  movimentoAttivo?: Maybe<Scalars['String']['output']>;
  /** Valutazione movimento passivo */
  movimentoPassivo?: Maybe<Scalars['String']['output']>;
  objectives?: Maybe<Array<EvaluationObjective>>;
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  /** Osservazione clinica */
  osservazione?: Maybe<Scalars['String']['output']>;
  /** Outcome atteso/pianificato */
  outcome?: Maybe<Scalars['String']['output']>;
  /** Palpazione */
  palpazione?: Maybe<Scalars['String']['output']>;
  /** Professione del paziente */
  professione?: Maybe<Scalars['String']['output']>;
  /** Sport praticati dal paziente */
  sportPraticati?: Maybe<Array<Scalars['String']['output']>>;
  /** Stato attuale dei sintomi */
  statoAttualeSintomi?: Maybe<Scalars['String']['output']>;
  /** Strategie di coping del paziente */
  strategieCoping?: Maybe<Scalars['String']['output']>;
  tests?: Maybe<Array<EvaluationTest>>;
  therapeuticPath: TherapeuticPath;
  therapeuticPathId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type PatientRelationship = {
  __typename?: 'PatientRelationship';
  /** Flag operativi clinici (contatto emergenza, ritiro autorizzato, ...) */
  extension?: Maybe<ClinicalRelationshipExtension>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  registryRelationshipId: Scalars['ID']['output'];
  /** L'altro estremo della relazione (genitore/figlio/coniuge/...) */
  relatedSubject: RegistrySubject;
  relationshipType: Scalars['String']['output'];
  validFrom?: Maybe<Scalars['DateTime']['output']>;
  validTo?: Maybe<Scalars['DateTime']['output']>;
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

export type PatternGroupUpdateOutput = {
  __typename?: 'PatternGroupUpdateOutput';
  conflictedAppointments: Array<AvailabilityAppointment>;
  conflictsCount: Scalars['Int']['output'];
  hasConflicts: Scalars['Boolean']['output'];
  patternGroup: PatternGroup;
};

export type PatternInput = {
  dayInPattern: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  name: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
};

/** Payment method used */
export enum PaymentMethod {
  Card = 'CARD',
  Cash = 'CASH',
  Other = 'OTHER',
  Satispay = 'SATISPAY',
  Transfer = 'TRANSFER'
}

export type Permission = {
  __typename?: 'Permission';
  action?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  resourceType?: Maybe<Scalars['String']['output']>;
  rolePermissions?: Maybe<Array<RolePermission>>;
};

export type PhysiotherapistSlotBatchOutput = {
  __typename?: 'PhysiotherapistSlotBatchOutput';
  available: Scalars['Boolean']['output'];
  date: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  operatorId: Scalars['ID']['output'];
  startTime: Scalars['String']['output'];
  suggestedInstruments?: Maybe<Array<InstrumentSlotOutput>>;
};

export type PhysiotherapistSlotOutput = {
  __typename?: 'PhysiotherapistSlotOutput';
  available: Scalars['Boolean']['output'];
  endTime: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  startTime: Scalars['String']['output'];
  suggestedInstruments?: Maybe<Array<InstrumentSlotOutput>>;
};

export type PrivacyOfficer = {
  __typename?: 'PrivacyOfficer';
  appUser: AppUser;
  appUserId: Scalars['ID']['output'];
  certification?: Maybe<Scalars['String']['output']>;
  certificationExpiry?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dpoRegistrationNumber?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Product = {
  __typename?: 'Product';
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdByUserId?: Maybe<Scalars['ID']['output']>;
  defaultPrice: Scalars['Float']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  productCode: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Query = {
  __typename?: 'Query';
  activeTherapeuticPathsByPatient: Array<TherapeuticPath>;
  allOperatorServices: Array<OperatorService>;
  allTemplatePatterns: Array<TemplatePattern>;
  appUser?: Maybe<AppUser>;
  appUserByKeycloakId?: Maybe<AppUser>;
  appUserPermissions: Array<Scalars['String']['output']>;
  appUsers: Array<AppUser>;
  archivedOperators: Array<Operator>;
  availabilityAppointment?: Maybe<AvailabilityAppointment>;
  availabilityAppointments: Array<AvailabilityAppointment>;
  availabilityAppointmentsByOperator: Array<AvailabilityAppointment>;
  availabilityAppointmentsByPatient: Array<AvailabilityAppointment>;
  availabilityException?: Maybe<AvailabilityException>;
  availabilityExceptions: Array<AvailabilityException>;
  availabilityTemplates: Array<AvailabilityTemplate>;
  availableInstrumentsByCategory: Array<Instrument>;
  availableOperatorsForSlot: Array<Operator>;
  availableSlots: Array<AvailabilitySlot>;
  availableSlotsForRebooking: Array<RebookingSlot>;
  calendarSettings: CalendarSettings;
  checkDuplicateOperator: Array<Operator>;
  checkSlotAvailability: Scalars['Boolean']['output'];
  conflictStats: ConflictStatsOutput;
  conflictedAppointments: Array<AvailabilityAppointment>;
  conflictedAppointmentsCount: Scalars['Int']['output'];
  currentGymPatternGroup?: Maybe<GymPatternGroup>;
  currentTemplateAssignments: Array<TemplateAssignment>;
  dlqStatus: DlqStatusGql;
  documentsByPath: Array<PathDocument>;
  documentsByPathAndCategory: Array<PathDocument>;
  evaluationByPath?: Maybe<PatientEvaluation>;
  examsByEvaluation: Array<EvaluationExam>;
  generalSetting?: Maybe<GeneralSettings>;
  generalSettings: Array<GeneralSettings>;
  generalSettingsByCategory: Array<GeneralSettings>;
  getAllTreatments: Array<Treatment>;
  groupExceptions: Array<GroupException>;
  gymAvailableSlots: Array<GymSlotOutput>;
  gymException?: Maybe<GymException>;
  gymExceptions: Array<GymException>;
  gymExceptionsByDate: Array<GymException>;
  gymOperatorAtTime?: Maybe<GymSchedule>;
  gymPatternGroup?: Maybe<GymPatternGroup>;
  gymPatternGroups: Array<GymPatternGroup>;
  gymRoom?: Maybe<GymRoom>;
  gymRoomAppointments: Array<AvailabilityAppointment>;
  gymRoomAvailableSlots: Array<GymSlotInfo>;
  gymRooms: Array<GymRoom>;
  gymRoomsAppointments: Array<AvailabilityAppointment>;
  gymRoomsAvailableSlots: Array<GymSlotInfoWithContext>;
  gymSchedule?: Maybe<GymSchedule>;
  gymSchedules: Array<GymSchedule>;
  gymSchedulesByRoomAndDay: Array<GymSchedule>;
  /** Verifica se il paziente ha un'anamnesi */
  hasPatientAnamnesis: Scalars['Boolean']['output'];
  holidays: Array<HolidayInfo>;
  instrument?: Maybe<Instrument>;
  instrumentCategories: Array<InstrumentCategory>;
  instrumentCategory?: Maybe<InstrumentCategory>;
  instruments: Array<Instrument>;
  isHoliday: Scalars['Boolean']['output'];
  isInstrumentAvailable: Scalars['Boolean']['output'];
  itManager?: Maybe<ItManager>;
  itManagers: Array<ItManager>;
  keycloakOrgMembers: Array<KeycloakOrgMember>;
  keycloakRealmRoles: Array<KeycloakRealmRoleType>;
  myOperator?: Maybe<Operator>;
  myProfile?: Maybe<MyProfile>;
  objectiveProgressHistory: Array<ObjectiveProgressHistory>;
  objectivesByEvaluation: Array<EvaluationObjective>;
  objectivesProgress: ObjectivesProgress;
  objectivesWithHistory: Array<EvaluationObjective>;
  operator?: Maybe<Operator>;
  operatorAbsenceType?: Maybe<OperatorAbsenceType>;
  operatorAbsenceTypes: Array<OperatorAbsenceType>;
  operatorAvailability: Array<DailyAvailability>;
  operatorCategories: Array<OperatorCategory>;
  operatorCategory?: Maybe<OperatorCategory>;
  operatorDependencies: OperatorDependencyCount;
  operatorExceptions: Array<AvailabilityException>;
  operatorPatternsOnDate: Array<OperatorSlotOnDate>;
  operatorServices: Array<OperatorService>;
  operators: Array<Operator>;
  operatorsAvailability: Array<OperatorAvailabilityResult>;
  operatorsAvailabilityV3: Array<OperatorAvailabilityV3>;
  pathDocument?: Maybe<PathDocument>;
  patient?: Maybe<Patient>;
  /** Ottiene anamnesi per ID */
  patientAnamnesis?: Maybe<PatientAnamnesis>;
  /** Ottiene anamnesi per subjectId */
  patientAnamnesisBySubject?: Maybe<PatientAnamnesis>;
  patientEvaluation?: Maybe<PatientEvaluation>;
  patternGroup?: Maybe<PatternGroup>;
  patternGroups: Array<PatternGroup>;
  permissions: Array<Permission>;
  physiotherapistAvailableSlots: Array<PhysiotherapistSlotOutput>;
  physiotherapistAvailableSlotsBatch: Array<PhysiotherapistSlotBatchOutput>;
  privacyOfficer?: Maybe<PrivacyOfficer>;
  privacyOfficers: Array<PrivacyOfficer>;
  product?: Maybe<Product>;
  products: Array<Product>;
  recurringSeries: Array<AvailabilityAppointment>;
  recycleBin: Array<RecycleBinItem>;
  recycleBinSettings: RecycleBinSettings;
  revalidateConflictsIfNeeded: ConflictRevalidationResult;
  role?: Maybe<Role>;
  roles: Array<Role>;
  room?: Maybe<Room>;
  rooms: Array<Room>;
  searchPatients: PaginatedPatients;
  secretaries: Array<Secretary>;
  secretary?: Maybe<Secretary>;
  service?: Maybe<Service>;
  serviceInvoicePrefixes: Array<ServiceInvoicePrefix>;
  serviceOperators: Array<OperatorService>;
  serviceSubcategories: Array<ServiceSubcategory>;
  serviceSubcategory?: Maybe<ServiceSubcategory>;
  services: Array<Service>;
  taskMessage?: Maybe<TaskMessage>;
  taskMessageCompleted: TaskMessagePage;
  taskMessageInbox: TaskMessagePage;
  taskMessageMyAppUserId?: Maybe<Scalars['String']['output']>;
  taskMessageSent: TaskMessagePage;
  taskMessageUnreadCount: Scalars['Int']['output'];
  templateAssignment?: Maybe<TemplateAssignment>;
  templateAssignments: Array<TemplateAssignment>;
  templateAssignmentsByOperator: Array<TemplateAssignment>;
  tenantSchemaStatus: TenantSchemaStatus;
  testEvaluationHistory: Array<TestEvaluationHistory>;
  testsByEvaluation: Array<EvaluationTest>;
  testsProgress: TestsProgress;
  testsWithHistory: Array<EvaluationTest>;
  therapeuticPath?: Maybe<TherapeuticPath>;
  therapeuticPathsByOperator: Array<TherapeuticPath>;
  therapeuticPathsByPatient: Array<TherapeuticPath>;
  therapeuticPathsByPatients: Array<TherapeuticPath>;
  treatment?: Maybe<Treatment>;
  treatmentByAppointment?: Maybe<Treatment>;
  treatmentInvoiceLines: Array<TreatmentInvoiceLine>;
  treatmentsByAppointments: Array<Treatment>;
  treatmentsByOperator: Array<Treatment>;
  treatmentsByOperators: Array<Treatment>;
  treatmentsByPatient: Array<Treatment>;
  treatmentsByTherapeuticPath: Array<Treatment>;
  treatmentsForOperator: Array<Treatment>;
  treatmentsForSecretary: Array<Treatment>;
  treatmentsNotInvoicedByOperator: Array<Treatment>;
  treatmentsNotInvoicedToPatient: Array<Treatment>;
  treatmentsPendingClosure: Array<Treatment>;
  unlinkedAppUsers: Array<AppUser>;
  userRoles: Array<Role>;
  waitingListEntries: Array<WaitingListEntry>;
  waitingListEntry?: Maybe<WaitingListEntry>;
  whatsappConfig?: Maybe<WhatsappTenantConfig>;
  whatsappExpiredLogs: WhatsappMessageLogPage;
  whatsappMessageLog?: Maybe<WhatsappMessageLog>;
  whatsappMessageLogs: WhatsappMessageLogPage;
  whatsappMessageLogsByAppointment: Array<WhatsappMessageLog>;
  whatsappRetentionStats: WhatsappRetentionStats;
  whatsappTemplate?: Maybe<WhatsappMessageTemplate>;
  whatsappTemplates: Array<WhatsappMessageTemplate>;
};


export type QueryActiveTherapeuticPathsByPatientArgs = {
  patientId: Scalars['ID']['input'];
};


export type QueryAppUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAppUserByKeycloakIdArgs = {
  keycloakId: Scalars['String']['input'];
};


export type QueryAppUserPermissionsArgs = {
  appUserId: Scalars['ID']['input'];
};


export type QueryAppUsersArgs = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  userType?: InputMaybe<AppUserType>;
};


export type QueryAvailabilityAppointmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAvailabilityAppointmentsArgs = {
  endDate: Scalars['String']['input'];
  operatorIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  startDate: Scalars['String']['input'];
};


export type QueryAvailabilityAppointmentsByOperatorArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type QueryAvailabilityAppointmentsByPatientArgs = {
  patientId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
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


export type QueryAvailableOperatorsForSlotArgs = {
  date: Scalars['String']['input'];
  endTime: Scalars['String']['input'];
  excludeOperatorId: Scalars['ID']['input'];
  gymRoomId: Scalars['ID']['input'];
  startTime: Scalars['String']['input'];
};


export type QueryAvailableSlotsArgs = {
  date: Scalars['String']['input'];
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAvailableSlotsForRebookingArgs = {
  dates: Array<Scalars['String']['input']>;
  durationMinutes: Scalars['Int']['input'];
  operatorIds: Array<Scalars['ID']['input']>;
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


export type QueryConflictedAppointmentsArgs = {
  conflictReason?: InputMaybe<ConflictReason>;
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryCurrentGymPatternGroupArgs = {
  gymRoomId: Scalars['ID']['input'];
};


export type QueryCurrentTemplateAssignmentsArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
};


export type QueryDocumentsByPathArgs = {
  pathId: Scalars['ID']['input'];
};


export type QueryDocumentsByPathAndCategoryArgs = {
  category: DocumentCategory;
  pathId: Scalars['ID']['input'];
};


export type QueryEvaluationByPathArgs = {
  pathId: Scalars['ID']['input'];
};


export type QueryExamsByEvaluationArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryGeneralSettingArgs = {
  key: Scalars['String']['input'];
};


export type QueryGeneralSettingsByCategoryArgs = {
  category: Scalars['String']['input'];
};


export type QueryGymAvailableSlotsArgs = {
  date: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
};


export type QueryGymExceptionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGymExceptionsArgs = {
  endDate: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type QueryGymExceptionsByDateArgs = {
  date: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
};


export type QueryGymOperatorAtTimeArgs = {
  dayOfWeek: Scalars['Int']['input'];
  gymRoomId: Scalars['ID']['input'];
  time: Scalars['String']['input'];
};


export type QueryGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGymPatternGroupsArgs = {
  gymRoomId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGymRoomArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGymRoomAppointmentsArgs = {
  date: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
};


export type QueryGymRoomAvailableSlotsArgs = {
  date: Scalars['String']['input'];
  gymRoomId: Scalars['ID']['input'];
};


export type QueryGymRoomsArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryGymRoomsAppointmentsArgs = {
  endDate: Scalars['String']['input'];
  gymRoomIds: Array<Scalars['ID']['input']>;
  startDate: Scalars['String']['input'];
};


export type QueryGymRoomsAvailableSlotsArgs = {
  endDate: Scalars['String']['input'];
  gymRoomIds: Array<Scalars['ID']['input']>;
  startDate: Scalars['String']['input'];
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


export type QueryHasPatientAnamnesisArgs = {
  subjectId: Scalars['ID']['input'];
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


export type QueryIsInstrumentAvailableArgs = {
  appointmentDate: Scalars['String']['input'];
  endOffsetMinutes: Scalars['Float']['input'];
  excludeAppointmentId?: InputMaybe<Scalars['ID']['input']>;
  instrumentId: Scalars['ID']['input'];
  startOffsetMinutes: Scalars['Float']['input'];
  startTime: Scalars['String']['input'];
};


export type QueryItManagerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryObjectiveProgressHistoryArgs = {
  objectiveId: Scalars['ID']['input'];
};


export type QueryObjectivesByEvaluationArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryObjectivesProgressArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryObjectivesWithHistoryArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOperatorAbsenceTypeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOperatorAbsenceTypesArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
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


export type QueryOperatorDependenciesArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOperatorExceptionsArgs = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  startDate?: InputMaybe<Scalars['String']['input']>;
};


export type QueryOperatorPatternsOnDateArgs = {
  date: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
};


export type QueryOperatorServicesArgs = {
  operatorId: Scalars['ID']['input'];
};


export type QueryOperatorsArgs = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryOperatorsAvailabilityArgs = {
  endDate: Scalars['String']['input'];
  operatorIds: Array<Scalars['ID']['input']>;
  startDate: Scalars['String']['input'];
};


export type QueryOperatorsAvailabilityV3Args = {
  endDate: Scalars['String']['input'];
  operatorIds: Array<Scalars['ID']['input']>;
  startDate: Scalars['String']['input'];
};


export type QueryPathDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientAnamnesisArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientAnamnesisBySubjectArgs = {
  subjectId: Scalars['ID']['input'];
};


export type QueryPatientEvaluationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPhysiotherapistAvailableSlotsArgs = {
  input: CheckPhysiotherapistAvailabilityInput;
};


export type QueryPhysiotherapistAvailableSlotsBatchArgs = {
  customInstrumentSlots?: InputMaybe<Array<InstrumentSlotInput>>;
  dates: Array<Scalars['String']['input']>;
  durationMinutes: Scalars['Int']['input'];
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  operatorIds: Array<Scalars['ID']['input']>;
};


export type QueryPrivacyOfficerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProductArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProductsArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryRecurringSeriesArgs = {
  recurringGroupId: Scalars['ID']['input'];
};


export type QueryRecycleBinArgs = {
  filter?: InputMaybe<RecycleBinFilterInput>;
};


export type QueryRoleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRoomArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRoomsArgs = {
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QuerySearchPatientsArgs = {
  input: SearchPatientInput;
};


export type QuerySecretaryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryServiceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryServiceOperatorsArgs = {
  serviceId: Scalars['ID']['input'];
};


export type QueryServiceSubcategoriesArgs = {
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryServiceSubcategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryServicesArgs = {
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryTaskMessageArgs = {
  id: Scalars['String']['input'];
};


export type QueryTaskMessageCompletedArgs = {
  limit?: Scalars['Int']['input'];
  page?: Scalars['Int']['input'];
};


export type QueryTaskMessageInboxArgs = {
  limit?: Scalars['Int']['input'];
  page?: Scalars['Int']['input'];
};


export type QueryTaskMessageSentArgs = {
  limit?: Scalars['Int']['input'];
  page?: Scalars['Int']['input'];
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


export type QueryTestEvaluationHistoryArgs = {
  testId: Scalars['ID']['input'];
};


export type QueryTestsByEvaluationArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryTestsProgressArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryTestsWithHistoryArgs = {
  evaluationId: Scalars['ID']['input'];
};


export type QueryTherapeuticPathArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTherapeuticPathsByOperatorArgs = {
  operatorId: Scalars['ID']['input'];
};


export type QueryTherapeuticPathsByPatientArgs = {
  patientId: Scalars['ID']['input'];
};


export type QueryTherapeuticPathsByPatientsArgs = {
  patientIds: Array<Scalars['ID']['input']>;
};


export type QueryTreatmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTreatmentByAppointmentArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type QueryTreatmentInvoiceLinesArgs = {
  treatmentId: Scalars['ID']['input'];
};


export type QueryTreatmentsByAppointmentsArgs = {
  appointmentIds: Array<Scalars['ID']['input']>;
};


export type QueryTreatmentsByOperatorArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
};


export type QueryTreatmentsByOperatorsArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  operatorIds: Array<Scalars['ID']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTreatmentsByPatientArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  patientId: Scalars['ID']['input'];
};


export type QueryTreatmentsByTherapeuticPathArgs = {
  therapeuticPathId: Scalars['ID']['input'];
};


export type QueryTreatmentsForOperatorArgs = {
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  operatorId: Scalars['ID']['input'];
  statuses?: InputMaybe<Array<TreatmentStatus>>;
};


export type QueryTreatmentsForSecretaryArgs = {
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  isInvoicedToPatient?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  patientId?: InputMaybe<Scalars['ID']['input']>;
  readyForBilling?: InputMaybe<Scalars['Boolean']['input']>;
  scontoFE?: InputMaybe<Scalars['Boolean']['input']>;
  statuses?: InputMaybe<Array<TreatmentStatus>>;
};


export type QueryTreatmentsNotInvoicedByOperatorArgs = {
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryTreatmentsNotInvoicedToPatientArgs = {
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
};


export type QueryUnlinkedAppUsersArgs = {
  userType?: InputMaybe<AppUserType>;
};


export type QueryUserRolesArgs = {
  appUserId: Scalars['ID']['input'];
};


export type QueryWaitingListEntriesArgs = {
  status?: InputMaybe<WaitingListStatus>;
};


export type QueryWaitingListEntryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryWhatsappExpiredLogsArgs = {
  limit?: Scalars['Int']['input'];
  page?: Scalars['Int']['input'];
};


export type QueryWhatsappMessageLogArgs = {
  id: Scalars['ID']['input'];
};


export type QueryWhatsappMessageLogsArgs = {
  filters: WhatsappLogFilterInput;
};


export type QueryWhatsappMessageLogsByAppointmentArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type QueryWhatsappTemplateArgs = {
  type: WhatsappTemplateType;
};

export type RebookingSlot = {
  __typename?: 'RebookingSlot';
  /** Data dello slot (YYYY-MM-DD) */
  date: Scalars['String']['output'];
  /** Ora fine (HH:mm) */
  endTime: Scalars['String']['output'];
  operatorId: Scalars['ID']['output'];
  /** Ora inizio (HH:mm) */
  startTime: Scalars['String']['output'];
};

export type RecordPaymentInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  collectedBy: Scalars['ID']['input'];
  paymentMethod: PaymentMethod;
};

export type RecordProductSaleInput = {
  beneficiarySubjectId: Scalars['ID']['input'];
  isPaid: Scalars['Boolean']['input'];
  lines: Array<SaleProductLineInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  paymentMethod?: InputMaybe<PaymentMethod>;
  purchaserSubjectId: Scalars['ID']['input'];
  requestImmediateInvoice?: Scalars['Boolean']['input'];
  siteId?: InputMaybe<Scalars['ID']['input']>;
};

/** Modalità di fine ricorrenza */
export enum RecurringEndType {
  After = 'AFTER',
  Never = 'NEVER',
  Until = 'UNTIL'
}

export type RecurringOccurrenceConflict = {
  __typename?: 'RecurringOccurrenceConflict';
  appointmentId?: Maybe<Scalars['ID']['output']>;
  conflictingEndTime?: Maybe<Scalars['String']['output']>;
  conflictingStartTime?: Maybe<Scalars['String']['output']>;
  date: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type RecurringSeriesOperationResult = {
  __typename?: 'RecurringSeriesOperationResult';
  affectedCount: Scalars['Int']['output'];
  applied: Scalars['Boolean']['output'];
  conflicts: Array<RecurringOccurrenceConflict>;
};

/** Scope delle operazioni bulk su serie ricorrenti */
export enum RecurringSeriesScope {
  All = 'ALL',
  CurrentOnly = 'CURRENT_ONLY',
  DateRange = 'DATE_RANGE',
  ThisAndFollowing = 'THIS_AND_FOLLOWING'
}

/** Tipo di ricorrenza per appuntamenti */
export enum RecurringType {
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

/** Tipo di entità nel cestino */
export enum RecycleBinEntityType {
  PatientEvaluation = 'PATIENT_EVALUATION',
  TherapeuticPath = 'THERAPEUTIC_PATH',
  Treatment = 'TREATMENT'
}

export type RecycleBinFilterInput = {
  /** Tipi di entità da includere. Default: tutti. */
  entityTypes?: InputMaybe<Array<RecycleBinEntityType>>;
  /** Filtra per AppUser proprietario (admin only) */
  ownerUserId?: InputMaybe<Scalars['ID']['input']>;
  /** Stringa libera (matching su title/subtitle) */
  search?: InputMaybe<Scalars['String']['input']>;
};

export type RecycleBinItem = {
  __typename?: 'RecycleBinItem';
  /** Conteggio figli collegati (es. n trattamenti per un percorso). Solo informativo. */
  childrenCount?: Maybe<Scalars['Int']['output']>;
  deletedAt: Scalars['DateTime']['output'];
  /** Nome leggibile dell'AppUser che ha cancellato */
  deletedByName?: Maybe<Scalars['String']['output']>;
  /** AppUser che ha eseguito la cancellazione */
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  entityType: RecycleBinEntityType;
  /** Id dell'entità soft-deletata */
  id: Scalars['ID']['output'];
  /** Nome dell'operatore proprietario originale */
  ownerName?: Maybe<Scalars['String']['output']>;
  /** AppUser proprietario originale (per filtri in UI). Vuoto se l'operatore non è linkato a un AppUser. */
  ownerUserId?: Maybe<Scalars['ID']['output']>;
  /** Quando l'elemento sarà eliminato definitivamente dal cron (null = retention indefinita) */
  scheduledPurgeAt?: Maybe<Scalars['DateTime']['output']>;
  /** Sottotitolo opzionale (es. nome paziente, data trattamento) */
  subtitle?: Maybe<Scalars['String']['output']>;
  /** Titolo leggibile del record (nome percorso, info trattamento, ecc.) */
  title: Scalars['String']['output'];
};

export type RecycleBinSettings = {
  __typename?: 'RecycleBinSettings';
  id: Scalars['ID']['output'];
  /** Giorni di retention nel cestino prima dell'eliminazione definitiva. null = conservazione indefinita. Minimo 30 se impostato. */
  retentionDays?: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  updatedByUserId?: Maybe<Scalars['ID']['output']>;
};

export type RegistryAddress = {
  __typename?: 'RegistryAddress';
  addressType: Scalars['String']['output'];
  city?: Maybe<Scalars['String']['output']>;
  countryCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  province?: Maybe<Scalars['String']['output']>;
  street?: Maybe<Scalars['String']['output']>;
  zipCode?: Maybe<Scalars['String']['output']>;
};

export type RegistryAddressInput = {
  /** LEGAL | RESIDENCE | BILLING | SHIPPING | OTHER */
  addressType?: Scalars['String']['input'];
  city?: InputMaybe<Scalars['String']['input']>;
  /** ISO2 country code */
  countryCode?: Scalars['String']['input'];
  isPrimary?: Scalars['Boolean']['input'];
  province?: InputMaybe<Scalars['String']['input']>;
  street?: InputMaybe<Scalars['String']['input']>;
  zipCode?: InputMaybe<Scalars['String']['input']>;
};

export type RegistryContact = {
  __typename?: 'RegistryContact';
  contactType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  label?: Maybe<Scalars['String']['output']>;
  value: Scalars['String']['output'];
  verified: Scalars['Boolean']['output'];
};

export type RegistryContactInput = {
  /** EMAIL | PHONE | MOBILE | FAX | PEC */
  contactType: Scalars['String']['input'];
  isPrimary?: Scalars['Boolean']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['String']['input'];
};

export type RegistryPrivacyConsent = {
  __typename?: 'RegistryPrivacyConsent';
  documentRef?: Maybe<Scalars['String']['output']>;
  given: Scalars['Boolean']['output'];
  givenAt?: Maybe<Scalars['DateTime']['output']>;
  revokedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type RegistrySubject = {
  __typename?: 'RegistrySubject';
  addresses: Array<RegistryAddress>;
  birthCountry?: Maybe<Scalars['String']['output']>;
  birthDate?: Maybe<Scalars['String']['output']>;
  birthPlace?: Maybe<Scalars['String']['output']>;
  contacts: Array<RegistryContact>;
  createdAt: Scalars['DateTime']['output'];
  /** firstName + lastName, oppure legalName se ORGANIZATION */
  displayName?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  gender?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  incomingRelationships?: Maybe<Array<RegistrySubjectRelationshipRef>>;
  isActive: Scalars['Boolean']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  legalCapacity?: Maybe<Scalars['String']['output']>;
  legalName?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  organizationType?: Maybe<Scalars['String']['output']>;
  outgoingRelationships?: Maybe<Array<RegistrySubjectRelationshipRef>>;
  pecEmail?: Maybe<Scalars['String']['output']>;
  primaryAddress?: Maybe<RegistryAddress>;
  primaryEmail?: Maybe<Scalars['String']['output']>;
  primaryPhone?: Maybe<Scalars['String']['output']>;
  privacyGeneralConsent?: Maybe<RegistryPrivacyConsent>;
  roles: Array<RegistrySubjectRole>;
  sdiCode?: Maybe<Scalars['String']['output']>;
  subjectType: Scalars['String']['output'];
  taxCode?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  vatNumber?: Maybe<Scalars['String']['output']>;
};

export type RegistrySubjectRelationshipRef = {
  __typename?: 'RegistrySubjectRelationshipRef';
  id: Scalars['ID']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  otherSubjectId: Scalars['ID']['output'];
  relationshipType: Scalars['String']['output'];
  validFrom?: Maybe<Scalars['DateTime']['output']>;
  validTo?: Maybe<Scalars['DateTime']['output']>;
};

export type RegistrySubjectRole = {
  __typename?: 'RegistrySubjectRole';
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  roleType: Scalars['String']['output'];
};

export type ReorderEntryItem = {
  id: Scalars['ID']['input'];
  position: Scalars['Int']['input'];
};

export type ReorderWaitingListInput = {
  entries: Array<ReorderEntryItem>;
};

export type RepeatConfigInput = {
  endType: RecurringEndType;
  interval: Scalars['Int']['input'];
  /** Numero di occorrenze (se endType = AFTER) */
  occurrences?: InputMaybe<Scalars['Int']['input']>;
  /** Giorni della settimana (0=Dom, 1=Lun, ..., 6=Sab) per ricorrenza settimanale */
  selectedDays?: InputMaybe<Array<Scalars['Int']['input']>>;
  type: RecurringType;
  /** Data di fine (se endType = UNTIL) */
  untilDate?: InputMaybe<Scalars['String']['input']>;
};

export type ResetKeycloakPasswordInput = {
  keycloakUserId: Scalars['ID']['input'];
  newPassword: Scalars['String']['input'];
  temporary?: Scalars['Boolean']['input'];
};

export type Role = {
  __typename?: 'Role';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isSystem: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  rolePermissions?: Maybe<Array<RolePermission>>;
  userRoles?: Maybe<Array<UserRole>>;
};

export type RolePermission = {
  __typename?: 'RolePermission';
  assignedAt: Scalars['DateTime']['output'];
  permission: Permission;
  permissionId: Scalars['ID']['output'];
  role: Role;
  roleId: Scalars['ID']['output'];
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

export type SaleCompletedResult = {
  __typename?: 'SaleCompletedResult';
  publishedAt: Scalars['DateTime']['output'];
  saleId: Scalars['ID']['output'];
  totalAmount: Scalars['Float']['output'];
};

export type SaleProductLineInput = {
  productId: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  unitPriceOverride?: InputMaybe<Scalars['Float']['input']>;
};

/** Input per ricerca paziente (proxy a registry global-search) */
export type SearchPatientInput = {
  /** Solo soggetti attivi (default: true) */
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  /** Filtro consenso: given | not_given | revoked */
  privacyConsent?: InputMaybe<Scalars['String']['input']>;
  /** Testo libero (min 3 char) */
  query?: InputMaybe<Scalars['String']['input']>;
  /** INDIVIDUAL | ORGANIZATION (default: INDIVIDUAL) */
  subjectType?: InputMaybe<Scalars['String']['input']>;
};

export type Secretary = {
  __typename?: 'Secretary';
  appUser: AppUser;
  appUserId: Scalars['ID']['output'];
  canManageAppointments: Scalars['Boolean']['output'];
  canManageBilling: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  department?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
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
  discountFE?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  instrumentOrderMatters: Scalars['Boolean']['output'];
  isActive: Scalars['Boolean']['output'];
  macroCategory?: Maybe<OperatorMacroCategory>;
  name: Scalars['String']['output'];
  operators?: Maybe<Array<OperatorService>>;
  preferredDuration?: Maybe<Scalars['Int']['output']>;
  requiredInstruments?: Maybe<Array<ServiceInstrument>>;
  reverseInstrumentOrder?: Maybe<Scalars['Boolean']['output']>;
  serviceCode: Scalars['String']['output'];
  serviceFee?: Maybe<Scalars['Float']['output']>;
  serviceFeeFE?: Maybe<Scalars['Float']['output']>;
  studioExtra?: Maybe<Scalars['Float']['output']>;
  studioExtraFE?: Maybe<Scalars['Float']['output']>;
  subcategory?: Maybe<ServiceSubcategory>;
  subcategoryId?: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type ServiceInputItem = {
  /** Durata personalizzata in minuti (override del default) */
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  /** Prezzo personalizzato (override del default) */
  customPrice?: InputMaybe<Scalars['Float']['input']>;
  /** Posizione ordine del servizio nell'appuntamento */
  orderPosition?: InputMaybe<Scalars['Int']['input']>;
  serviceId: Scalars['ID']['input'];
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

export type ServiceInvoicePrefix = {
  __typename?: 'ServiceInvoicePrefix';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  macroCategory: OperatorMacroCategory;
  prefix: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type ServiceSubcategory = {
  __typename?: 'ServiceSubcategory';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Site = {
  __typename?: 'Site';
  address?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TaskMessage = {
  __typename?: 'TaskMessage';
  availableFrom?: Maybe<Scalars['DateTime']['output']>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  content: Scalars['String']['output'];
  correlationId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  gatewayMessageId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  readAt?: Maybe<Scalars['DateTime']['output']>;
  recipientUser?: Maybe<AppUser>;
  recipientUserId: Scalars['String']['output'];
  senderUser?: Maybe<AppUser>;
  senderUserId: Scalars['String']['output'];
  status: TaskMessageStatus;
  tenantId: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TaskMessagePage = {
  __typename?: 'TaskMessagePage';
  items: Array<TaskMessage>;
  total: Scalars['Int']['output'];
};

export type TaskMessageResult = {
  __typename?: 'TaskMessageResult';
  messageId: Scalars['String']['output'];
  status: TaskMessageStatus;
};

/** Stato del task message */
export enum TaskMessageStatus {
  Available = 'AVAILABLE',
  Completed = 'COMPLETED',
  Deleted = 'DELETED',
  Read = 'READ',
  Scheduled = 'SCHEDULED'
}

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

export type TenantSchemaStatus = {
  __typename?: 'TenantSchemaStatus';
  databaseHost?: Maybe<Scalars['String']['output']>;
  databaseName?: Maybe<Scalars['String']['output']>;
  existsInMainDb: Scalars['Boolean']['output'];
  isAligned: Scalars['Boolean']['output'];
  message?: Maybe<Scalars['String']['output']>;
  schemaName: Scalars['String']['output'];
  tenantStatus: Scalars['String']['output'];
};

export type TestEvaluationHistory = {
  __typename?: 'TestEvaluationHistory';
  createdAt: Scalars['DateTime']['output'];
  /** Livello valutazione (0-5) */
  evaluationLevel: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  /** Note sulla valutazione */
  note?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Operator>;
  operatorId: Scalars['ID']['output'];
  testId: Scalars['ID']['output'];
  /** Numero trattamenti dall'ultima valutazione */
  treatmentsSinceLast: Scalars['Int']['output'];
};

/** Sezione della valutazione in cui si trova il test */
export enum TestSection {
  EsameObiettivo = 'ESAME_OBIETTIVO',
  Monitoraggio = 'MONITORAGGIO'
}

export type TestsProgress = {
  __typename?: 'TestsProgress';
  failed: Scalars['Int']['output'];
  passed: Scalars['Int']['output'];
  pending: Scalars['Int']['output'];
  percentage: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type TherapeuticPath = {
  __typename?: 'TherapeuticPath';
  closedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  diagnosis?: Maybe<Scalars['String']['output']>;
  documents?: Maybe<Array<PathDocument>>;
  externalDoctorName?: Maybe<Scalars['String']['output']>;
  externalPrescriptionRef?: Maybe<Scalars['String']['output']>;
  icdCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  patient?: Maybe<Patient>;
  patientId: Scalars['ID']['output'];
  primaryOperator: Operator;
  primaryOperatorId: Scalars['ID']['output'];
  status: TherapeuticPathStatus;
  treatments?: Maybe<Array<Treatment>>;
  updatedAt: Scalars['DateTime']['output'];
};

/** Therapeutic path status */
export enum TherapeuticPathStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Completed = 'COMPLETED',
  Suspended = 'SUSPENDED'
}

export type TimeBlockV3 = {
  __typename?: 'TimeBlockV3';
  /** Fine blocco (HH:mm) */
  endTime: Scalars['String']['output'];
  /** Inizio blocco (HH:mm) */
  startTime: Scalars['String']['output'];
};

export type Treatment = {
  __typename?: 'Treatment';
  accountingBillableEventId?: Maybe<Scalars['ID']['output']>;
  accountingCreditNoteIssuedAt?: Maybe<Scalars['DateTime']['output']>;
  accountingCreditNoteNumber?: Maybe<Scalars['String']['output']>;
  accountingDocumentType?: Maybe<Scalars['String']['output']>;
  accountingInvoiceIssuedAt?: Maybe<Scalars['DateTime']['output']>;
  accountingInvoiceUrl?: Maybe<Scalars['String']['output']>;
  accountingRefundReason?: Maybe<Scalars['String']['output']>;
  amendmentRevision: Scalars['Int']['output'];
  appointment: AvailabilityAppointment;
  appointmentId: Scalars['ID']['output'];
  billingAlertAt?: Maybe<Scalars['DateTime']['output']>;
  billingAlertDismissedAt?: Maybe<Scalars['DateTime']['output']>;
  billingAlertMessage?: Maybe<Scalars['String']['output']>;
  billingStatus: TreatmentBillingStatus;
  cancellationReason?: Maybe<Scalars['String']['output']>;
  cancelledAt?: Maybe<Scalars['DateTime']['output']>;
  cancelledByUserId?: Maybe<Scalars['ID']['output']>;
  clinicalNotes?: Maybe<Scalars['String']['output']>;
  closedAt?: Maybe<Scalars['DateTime']['output']>;
  closedByUserId?: Maybe<Scalars['ID']['output']>;
  collectedBy?: Maybe<Scalars['ID']['output']>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  forcedClosure: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  instruments?: Maybe<Array<TreatmentInstrument>>;
  invoiceLines?: Maybe<Array<TreatmentInvoiceLine>>;
  invoicedByOperatorAt?: Maybe<Scalars['DateTime']['output']>;
  invoicedToPatientAt?: Maybe<Scalars['DateTime']['output']>;
  isInvoicedByOperator: Scalars['Boolean']['output'];
  isInvoicedToPatient: Scalars['Boolean']['output'];
  isPaid: Scalars['Boolean']['output'];
  isTest: Scalars['Boolean']['output'];
  lastRecallRejectionAt?: Maybe<Scalars['DateTime']['output']>;
  lastRecallRejectionMessage?: Maybe<Scalars['String']['output']>;
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  operatorInvoiceNumber?: Maybe<Scalars['String']['output']>;
  operatorNotes?: Maybe<Scalars['String']['output']>;
  paidAt?: Maybe<Scalars['DateTime']['output']>;
  painAfter?: Maybe<Scalars['Int']['output']>;
  painBefore?: Maybe<Scalars['Int']['output']>;
  painLevel?: Maybe<Scalars['Int']['output']>;
  patient?: Maybe<Patient>;
  patientId?: Maybe<Scalars['ID']['output']>;
  patientInvoiceNumber?: Maybe<Scalars['String']['output']>;
  patientNotes?: Maybe<Scalars['String']['output']>;
  paymentMethod?: Maybe<PaymentMethod>;
  price: Scalars['Float']['output'];
  readyForBilling: Scalars['Boolean']['output'];
  readyForBillingAt?: Maybe<Scalars['DateTime']['output']>;
  recallRequestId?: Maybe<Scalars['String']['output']>;
  recallRequestedAt?: Maybe<Scalars['DateTime']['output']>;
  rescheduleRequested?: Maybe<Scalars['Boolean']['output']>;
  reschedulingNotes?: Maybe<Scalars['String']['output']>;
  reschedulingType?: Maybe<Scalars['String']['output']>;
  returnedFromAccountingAt?: Maybe<Scalars['DateTime']['output']>;
  returnedFromAccountingByEmail?: Maybe<Scalars['String']['output']>;
  returnedFromAccountingDismissedAt?: Maybe<Scalars['DateTime']['output']>;
  returnedFromAccountingReason?: Maybe<Scalars['String']['output']>;
  scontoFE: Scalars['Boolean']['output'];
  secretaryNotes?: Maybe<Scalars['String']['output']>;
  service?: Maybe<Service>;
  /** @deprecated Usa treatmentServices invece */
  serviceId?: Maybe<Scalars['ID']['output']>;
  site: Site;
  siteId: Scalars['ID']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: TreatmentStatus;
  /** Data fine intervallo riprogrammazione (YYYY-MM-DD) */
  suggestDateRangeEnd?: Maybe<Scalars['String']['output']>;
  /** Data inizio intervallo riprogrammazione (YYYY-MM-DD) */
  suggestDateRangeStart?: Maybe<Scalars['String']['output']>;
  suggestInDays?: Maybe<Scalars['Int']['output']>;
  therapeuticPath: TherapeuticPath;
  therapeuticPathId: Scalars['ID']['output'];
  treatmentServices?: Maybe<Array<TreatmentService>>;
  updatedAt: Scalars['DateTime']['output'];
};

/** Stato del trattamento nel ciclo di fatturazione clinico ↔ accounting */
export enum TreatmentBillingStatus {
  Cancelled = 'CANCELLED',
  Invoiced = 'INVOICED',
  NotReady = 'NOT_READY',
  PartiallyRefunded = 'PARTIALLY_REFUNDED',
  Pending = 'PENDING',
  ReadyForBilling = 'READY_FOR_BILLING',
  Refunded = 'REFUNDED',
  Reissued = 'REISSUED',
  Sent = 'SENT'
}

export enum TreatmentCallerRole {
  Operator = 'OPERATOR',
  Secretary = 'SECRETARY'
}

export type TreatmentInstrument = {
  __typename?: 'TreatmentInstrument';
  brandSnapshot?: Maybe<Scalars['String']['output']>;
  categoryName?: Maybe<Scalars['String']['output']>;
  categoryNameSnapshot?: Maybe<Scalars['String']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedByUserId?: Maybe<Scalars['ID']['output']>;
  endOffsetMinutes: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  instrument?: Maybe<Instrument>;
  instrumentCategory?: Maybe<InstrumentCategory>;
  instrumentCategoryId?: Maybe<Scalars['ID']['output']>;
  instrumentId: Scalars['ID']['output'];
  instrumentName?: Maybe<Scalars['String']['output']>;
  instrumentNameSnapshot?: Maybe<Scalars['String']['output']>;
  modelSnapshot?: Maybe<Scalars['String']['output']>;
  orderPosition?: Maybe<Scalars['Int']['output']>;
  snapshotTakenAt?: Maybe<Scalars['DateTime']['output']>;
  startOffsetMinutes: Scalars['Int']['output'];
  technicalDataSnapshot?: Maybe<Scalars['JSON']['output']>;
  treatment: Treatment;
  treatmentId: Scalars['ID']['output'];
  wasUsed: Scalars['Boolean']['output'];
};

export type TreatmentInstrumentInput = {
  endOffsetMinutes: Scalars['Int']['input'];
  instrumentCategoryId?: InputMaybe<Scalars['ID']['input']>;
  instrumentId: Scalars['ID']['input'];
  orderPosition?: InputMaybe<Scalars['Int']['input']>;
  startOffsetMinutes: Scalars['Int']['input'];
  wasUsed: Scalars['Boolean']['input'];
};

export type TreatmentInvoiceLine = {
  __typename?: 'TreatmentInvoiceLine';
  amount: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  treatmentId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TreatmentService = {
  __typename?: 'TreatmentService';
  createdAt: Scalars['DateTime']['output'];
  duration?: Maybe<Scalars['Int']['output']>;
  executedByOperator?: Maybe<AppUser>;
  executedByOperatorId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  invoiceLineDescription?: Maybe<Scalars['String']['output']>;
  invoiceLineDescriptionAuto?: Maybe<Scalars['String']['output']>;
  isCustomPrice: Scalars['Boolean']['output'];
  orderPosition: Scalars['Int']['output'];
  price?: Maybe<Scalars['Float']['output']>;
  service: Service;
  serviceId: Scalars['ID']['output'];
  treatmentId: Scalars['ID']['output'];
};

export type TreatmentServiceInputItem = {
  /** Durata personalizzata in minuti */
  duration?: InputMaybe<Scalars['Int']['input']>;
  /** True se il prezzo è stato personalizzato manualmente */
  isCustomPrice?: InputMaybe<Scalars['Boolean']['input']>;
  /** Posizione ordinamento */
  orderPosition?: InputMaybe<Scalars['Int']['input']>;
  /** Prezzo personalizzato per questo servizio */
  price?: InputMaybe<Scalars['Float']['input']>;
  serviceId: Scalars['ID']['input'];
};

/** Treatment workflow status */
export enum TreatmentStatus {
  Closed = 'CLOSED',
  InProgress = 'IN_PROGRESS',
  OperatorCompleted = 'OPERATOR_COMPLETED',
  Waiting = 'WAITING'
}

export type UpdateAppUserInput = {
  attributes?: InputMaybe<Scalars['JSONObject']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAvailabilityAppointmentInput = {
  appointmentDate?: InputMaybe<Scalars['String']['input']>;
  bookingStatus?: InputMaybe<BookingStatus>;
  cancellationReason?: InputMaybe<Scalars['String']['input']>;
  clientEmail?: InputMaybe<Scalars['String']['input']>;
  clientName?: InputMaybe<Scalars['String']['input']>;
  clientPhone?: InputMaybe<Scalars['String']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  /** Forza il salvataggio anche fuori dalla disponibilità dell'operatore (conferma esplicita dell'utente) */
  forceOutsideAvailability?: InputMaybe<Scalars['Boolean']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  instruments?: InputMaybe<Array<AppointmentInstrumentInput>>;
  /** Appuntamento non retribuito (pausa pranzo, rappresentante, etc.) */
  nonRetribuito?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Riassegna l'appuntamento a un altro operatore */
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  operatorNotes?: InputMaybe<Scalars['String']['input']>;
  patientId?: InputMaybe<Scalars['ID']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  /** Servizi da associare all'appuntamento */
  services?: InputMaybe<Array<ServiceInputItem>>;
  startTime?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateEvaluationInput = {
  andamentoDolore?: InputMaybe<Scalars['String']['input']>;
  bmi?: InputMaybe<Scalars['Float']['input']>;
  bodyMapMarkers?: InputMaybe<Array<BodyMapMarkerInput>>;
  criticita?: InputMaybe<Array<Scalars['String']['input']>>;
  diagnosiFisioterapica?: InputMaybe<Scalars['String']['input']>;
  equilibrio?: InputMaybe<Scalars['String']['input']>;
  esameNeurologico?: InputMaybe<Scalars['String']['input']>;
  esordioSintomi?: InputMaybe<Scalars['String']['input']>;
  exams?: InputMaybe<Array<EvaluationExamInput>>;
  fattoriAggravanti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriAllevianti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriPrognosticiNegativi?: InputMaybe<Scalars['String']['input']>;
  fattoriPrognosticiPositivi?: InputMaybe<Scalars['String']['input']>;
  forzaMuscolare?: InputMaybe<Scalars['String']['input']>;
  frequenzaSedute?: InputMaybe<Scalars['String']['input']>;
  interventiProposti?: InputMaybe<Array<Scalars['String']['input']>>;
  limitazioniAttivita?: InputMaybe<Scalars['String']['input']>;
  motivoConsulto?: InputMaybe<Scalars['String']['input']>;
  movimentoAttivo?: InputMaybe<Scalars['String']['input']>;
  movimentoPassivo?: InputMaybe<Scalars['String']['input']>;
  objectives?: InputMaybe<Array<EvaluationObjectiveInput>>;
  osservazione?: InputMaybe<Scalars['String']['input']>;
  outcome?: InputMaybe<Scalars['String']['input']>;
  palpazione?: InputMaybe<Scalars['String']['input']>;
  professione?: InputMaybe<Scalars['String']['input']>;
  sportPraticati?: InputMaybe<Array<Scalars['String']['input']>>;
  statoAttualeSintomi?: InputMaybe<Scalars['String']['input']>;
  strategieCoping?: InputMaybe<Scalars['String']['input']>;
  tests?: InputMaybe<Array<EvaluationTestInput>>;
};

export type UpdateGymExceptionInput = {
  absenceTypeId?: InputMaybe<Scalars['ID']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionDate?: InputMaybe<Scalars['String']['input']>;
  exceptionType?: InputMaybe<GymExceptionType>;
  gymRoomId?: InputMaybe<Scalars['ID']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  substituteOperatorId?: InputMaybe<Scalars['ID']['input']>;
  substitutes?: InputMaybe<Array<GymExceptionSubstituteInput>>;
};

export type UpdateGymPatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  patternDuration?: InputMaybe<Scalars['Int']['input']>;
  patternStartDate?: InputMaybe<Scalars['String']['input']>;
  patterns?: InputMaybe<Array<CreateGymTemplatePatternInput>>;
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateKeycloakUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  keycloakUserId: Scalars['ID']['input'];
  lastName?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateObjectiveProgressInput = {
  /** Nuovo livello di progresso (0-5) */
  newLevel: Scalars['Int']['input'];
  /** Note sull'aggiornamento */
  note?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOperatorAbsenceTypeInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOperatorInput = {
  canCollectPayment?: InputMaybe<Scalars['Boolean']['input']>;
  categoryId?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  maxConcurrentAppointments?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  preferredDurations?: InputMaybe<Array<Scalars['Int']['input']>>;
  professionalRegistration?: InputMaybe<Scalars['String']['input']>;
  royaltyPercentage?: InputMaybe<Scalars['Float']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdatePatientAnamnesisInput = {
  /** Allergie note */
  allergie?: InputMaybe<Scalars['String']['input']>;
  /** Gruppo sanguigno */
  gruppoSanguigno?: InputMaybe<Scalars['String']['input']>;
  /** Interventi chirurgici subiti */
  interventiChirurgici?: InputMaybe<Scalars['String']['input']>;
  /** Medico di base / curante */
  medicoBase?: InputMaybe<Scalars['String']['input']>;
  /** Note generali */
  note?: InputMaybe<Scalars['String']['input']>;
  /** ID operatore che modifica */
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  /** Patologie croniche attuali */
  patologieCroniche?: InputMaybe<Scalars['String']['input']>;
  /** Patologie pregresse */
  patologiePregresse?: InputMaybe<Scalars['String']['input']>;
  /** Storia familiare / Anamnesi familiare */
  storiaFamiliare?: InputMaybe<Scalars['String']['input']>;
  /** Terapia farmacologica in corso */
  terapiaFarmacologica?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Traumi significativi */
  traumi?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  patternDuration?: InputMaybe<Scalars['Float']['input']>;
  patterns?: InputMaybe<Array<PatternInput>>;
};

export type UpdateRecurringSeriesTimeInput = {
  appointmentId: Scalars['ID']['input'];
  endTime: Scalars['String']['input'];
  includeCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  rangeFrom?: InputMaybe<Scalars['String']['input']>;
  rangeTo?: InputMaybe<Scalars['String']['input']>;
  scope: RecurringSeriesScope;
  startTime: Scalars['String']['input'];
};

export type UpdateRegistryIndividualInput = {
  addresses?: InputMaybe<Array<RegistryAddressInput>>;
  birthCountry?: InputMaybe<Scalars['String']['input']>;
  birthDate?: InputMaybe<Scalars['String']['input']>;
  birthPlace?: InputMaybe<Scalars['String']['input']>;
  contacts?: InputMaybe<Array<RegistryContactInput>>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  /** M | F | X */
  gender?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  legalCapacity?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  taxCode?: InputMaybe<Scalars['String']['input']>;
  vatNumber?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskMessageInput = {
  availableFrom?: InputMaybe<Scalars['DateTime']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTestResultInput = {
  dataEsecuzione?: InputMaybe<Scalars['String']['input']>;
  risultato?: InputMaybe<Scalars['String']['input']>;
  superato?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateTherapeuticPathInput = {
  diagnosis?: InputMaybe<Scalars['String']['input']>;
  externalDoctorName?: InputMaybe<Scalars['String']['input']>;
  externalPrescriptionRef?: InputMaybe<Scalars['String']['input']>;
  icdCode?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<TherapeuticPathStatus>;
};

export type UpdateTreatmentBySecretaryInput = {
  amendmentReason?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  price?: InputMaybe<Scalars['Float']['input']>;
  scontoFE?: InputMaybe<Scalars['Boolean']['input']>;
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
  /** Sostituisce i servizi eseguiti */
  treatmentServices?: InputMaybe<Array<TreatmentServiceInputItem>>;
};

export type UpdateTreatmentInput = {
  clinicalNotes?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  instruments?: InputMaybe<Array<UpdateTreatmentInstrumentInput>>;
  /** Se false, resetta lo stato di pagamento (paymentMethod, paidAt, collectedBy) */
  isPaid?: InputMaybe<Scalars['Boolean']['input']>;
  painAfter?: InputMaybe<Scalars['Int']['input']>;
  painBefore?: InputMaybe<Scalars['Int']['input']>;
  painLevel?: InputMaybe<Scalars['Int']['input']>;
  patientNotes?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  rescheduleRequested?: InputMaybe<Scalars['Boolean']['input']>;
  reschedulingNotes?: InputMaybe<Scalars['String']['input']>;
  reschedulingType?: InputMaybe<Scalars['String']['input']>;
  scontoFE?: InputMaybe<Scalars['Boolean']['input']>;
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  suggestDateRangeEnd?: InputMaybe<Scalars['String']['input']>;
  suggestDateRangeStart?: InputMaybe<Scalars['String']['input']>;
  suggestInDays?: InputMaybe<Scalars['Int']['input']>;
  therapeuticPathId?: InputMaybe<Scalars['ID']['input']>;
  /** Servizi eseguiti nel trattamento */
  treatmentServices?: InputMaybe<Array<TreatmentServiceInputItem>>;
};

export type UpdateTreatmentInstrumentInput = {
  endOffsetMinutes?: InputMaybe<Scalars['Int']['input']>;
  instrumentCategoryId?: InputMaybe<Scalars['ID']['input']>;
  instrumentId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  startOffsetMinutes?: InputMaybe<Scalars['Int']['input']>;
  wasUsed?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateTreatmentInvoiceLineInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};

export type UpdateTreatmentServiceInvoiceDescriptionInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  treatmentServiceId: Scalars['ID']['input'];
};

export type UpdateWaitingListEntryInput = {
  notes?: InputMaybe<Scalars['String']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  patientName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<WaitingListStatus>;
};

export type UpsertRelationshipExtensionInput = {
  isAuthorizedPickup?: InputMaybe<Scalars['Boolean']['input']>;
  isCaregiverDuringVisits?: InputMaybe<Scalars['Boolean']['input']>;
  isEmergencyContact?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  /** ID della relationship nel registry */
  registryRelationshipId: Scalars['ID']['input'];
};

export type UpsertServiceInvoicePrefixInput = {
  macroCategory: OperatorMacroCategory;
  prefix: Scalars['String']['input'];
};

export type UserRole = {
  __typename?: 'UserRole';
  appUser: AppUser;
  appUserId: Scalars['ID']['output'];
  assignedAt: Scalars['DateTime']['output'];
  role: Role;
  roleId: Scalars['ID']['output'];
};

export type WaitingListEntry = {
  __typename?: 'WaitingListEntry';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  patientId?: Maybe<Scalars['ID']['output']>;
  patientName: Scalars['String']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  position: Scalars['Int']['output'];
  priority: Scalars['Int']['output'];
  status: WaitingListStatus;
  updatedAt: Scalars['DateTime']['output'];
};

/** Status of a waiting list entry */
export enum WaitingListStatus {
  Contacted = 'CONTACTED',
  Removed = 'REMOVED',
  Scheduled = 'SCHEDULED',
  Waiting = 'WAITING'
}

export type WhatsappBulkLogIdsInput = {
  logIds: Array<Scalars['String']['input']>;
};

export type WhatsappConfigInput = {
  apiKey?: InputMaybe<Scalars['String']['input']>;
  gatewayUrl: Scalars['String']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  retentionDays?: InputMaybe<Scalars['Int']['input']>;
  sendCancelNotification?: InputMaybe<Scalars['Boolean']['input']>;
  tenantApiId: Scalars['String']['input'];
  webhookSecret?: InputMaybe<Scalars['String']['input']>;
};

export type WhatsappLogFilterInput = {
  dateFrom?: InputMaybe<Scalars['DateTime']['input']>;
  dateTo?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: Scalars['Int']['input'];
  messageType?: InputMaybe<WhatsappMessageType>;
  page?: Scalars['Int']['input'];
  patientName?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<WhatsappMessageStatus>;
};

export type WhatsappLogManagementResult = {
  __typename?: 'WhatsappLogManagementResult';
  affectedCount: Scalars['Int']['output'];
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type WhatsappMessageLog = {
  __typename?: 'WhatsappMessageLog';
  anonymizedAt?: Maybe<Scalars['DateTime']['output']>;
  appointmentId?: Maybe<Scalars['ID']['output']>;
  appointmentIds?: Maybe<Array<Scalars['String']['output']>>;
  correlationId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deliveredAt?: Maybe<Scalars['DateTime']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  evolutionMessageId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isAnonymized: Scalars['Boolean']['output'];
  messageBody?: Maybe<Scalars['String']['output']>;
  messageType: WhatsappMessageType;
  patientId?: Maybe<Scalars['ID']['output']>;
  patientName?: Maybe<Scalars['String']['output']>;
  phoneNumber: Scalars['String']['output'];
  readAt?: Maybe<Scalars['DateTime']['output']>;
  sentAt?: Maybe<Scalars['DateTime']['output']>;
  status: WhatsappMessageStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export type WhatsappMessageLogPage = {
  __typename?: 'WhatsappMessageLogPage';
  items: Array<WhatsappMessageLog>;
  total: Scalars['Int']['output'];
};

/** Status del messaggio WhatsApp */
export enum WhatsappMessageStatus {
  Cancelled = 'CANCELLED',
  Delivered = 'DELIVERED',
  Dispatched = 'DISPATCHED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Read = 'READ',
  Sent = 'SENT'
}

export type WhatsappMessageTemplate = {
  __typename?: 'WhatsappMessageTemplate';
  bodyTemplate: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  footerTemplate?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  templateType: WhatsappTemplateType;
  updatedAt: Scalars['DateTime']['output'];
};

/** Tipo di messaggio WhatsApp */
export enum WhatsappMessageType {
  Cancellation = 'CANCELLATION',
  RecapMulti = 'RECAP_MULTI',
  RecapSingle = 'RECAP_SINGLE',
  Reminder_24H = 'REMINDER_24H'
}

export type WhatsappRetentionStats = {
  __typename?: 'WhatsappRetentionStats';
  anonymizedLogs: Scalars['Int']['output'];
  expiredLogs: Scalars['Int']['output'];
  retentionCutoffDate: Scalars['DateTime']['output'];
  retentionDays: Scalars['Int']['output'];
  totalLogs: Scalars['Int']['output'];
};

export type WhatsappTemplateInput = {
  bodyTemplate: Scalars['String']['input'];
  footerTemplate?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  templateType: WhatsappTemplateType;
};

/** Tipo di template messaggio WhatsApp */
export enum WhatsappTemplateType {
  Cancellation = 'CANCELLATION',
  RecapMulti = 'RECAP_MULTI',
  RecapSingle = 'RECAP_SINGLE',
  Reminder_24H = 'REMINDER_24H'
}

export type WhatsappTenantConfig = {
  __typename?: 'WhatsappTenantConfig';
  createdAt: Scalars['DateTime']['output'];
  gatewayUrl: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  maskedApiKey?: Maybe<Scalars['String']['output']>;
  retentionDays: Scalars['Int']['output'];
  sendCancelNotification: Scalars['Boolean']['output'];
  tenantApiId: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type WhatsappTestResult = {
  __typename?: 'WhatsappTestResult';
  data?: Maybe<Scalars['JSON']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type MyAppointmentFieldsFragment = { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, notes?: string | null, patientId?: string | null, clientName: string, clientPhone?: string | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number } | null };

export type GetMyAppointmentsQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetMyAppointmentsQuery = { __typename?: 'Query', availabilityAppointmentsByOperator: Array<{ __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, notes?: string | null, patientId?: string | null, clientName: string, clientPhone?: string | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number } | null }> };

export type ProductFieldsFragment = { __typename?: 'Product', id: string, productCode: string, name: string, description?: string | null, defaultPrice: number, category?: string | null, isActive: boolean, createdByUserId?: string | null, createdAt: any, updatedAt: any };

export type GetProductsQueryVariables = Exact<{
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetProductsQuery = { __typename?: 'Query', products: Array<{ __typename?: 'Product', id: string, productCode: string, name: string, description?: string | null, defaultPrice: number, category?: string | null, isActive: boolean, createdByUserId?: string | null, createdAt: any, updatedAt: any }> };

export type GetProductQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetProductQuery = { __typename?: 'Query', product?: { __typename?: 'Product', id: string, productCode: string, name: string, description?: string | null, defaultPrice: number, category?: string | null, isActive: boolean, createdByUserId?: string | null, createdAt: any, updatedAt: any } | null };

export type CreateProductMutationVariables = Exact<{
  productCode: Scalars['String']['input'];
  name: Scalars['String']['input'];
  defaultPrice: Scalars['Float']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CreateProductMutation = { __typename?: 'Mutation', createProduct: { __typename?: 'Product', id: string, productCode: string, name: string, description?: string | null, defaultPrice: number, category?: string | null, isActive: boolean, createdByUserId?: string | null, createdAt: any, updatedAt: any } };

export type UpdateProductMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  productCode?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateProductMutation = { __typename?: 'Mutation', updateProduct: { __typename?: 'Product', id: string, productCode: string, name: string, description?: string | null, defaultPrice: number, category?: string | null, isActive: boolean, createdByUserId?: string | null, createdAt: any, updatedAt: any } };

export type DeleteProductMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteProductMutation = { __typename?: 'Mutation', deleteProduct: boolean };

export type RecordProductSaleMutationVariables = Exact<{
  input: RecordProductSaleInput;
}>;


export type RecordProductSaleMutation = { __typename?: 'Mutation', recordProductSale: { __typename?: 'SaleCompletedResult', saleId: string, publishedAt: any, totalAmount: number } };

export type TreatmentBillingFieldsFragment = { __typename?: 'Treatment', billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null };

export type TreatmentDetailsFragment = { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null };

export type TreatmentsForSecretaryQueryVariables = Exact<{
  patientId?: InputMaybe<Scalars['ID']['input']>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<Array<TreatmentStatus> | TreatmentStatus>;
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  readyForBilling?: InputMaybe<Scalars['Boolean']['input']>;
  isInvoicedToPatient?: InputMaybe<Scalars['Boolean']['input']>;
  scontoFE?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TreatmentsForSecretaryQuery = { __typename?: 'Query', treatmentsForSecretary: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null }> };

export type TreatmentsForOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  statuses?: InputMaybe<Array<TreatmentStatus> | TreatmentStatus>;
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TreatmentsForOperatorQuery = { __typename?: 'Query', treatmentsForOperator: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null }> };

export type UpdateTreatmentBySecretaryMutationVariables = Exact<{
  input: UpdateTreatmentBySecretaryInput;
}>;


export type UpdateTreatmentBySecretaryMutation = { __typename?: 'Mutation', updateTreatmentBySecretary: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type SetTreatmentsReadyForBillingMutationVariables = Exact<{
  ids: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  ready: Scalars['Boolean']['input'];
  immediateInvoice?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type SetTreatmentsReadyForBillingMutation = { __typename?: 'Mutation', setTreatmentsReadyForBilling: Array<{ __typename?: 'Treatment', id: string, readyForBilling: boolean, readyForBillingAt?: any | null }> };

export type TreatmentByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TreatmentByIdQuery = { __typename?: 'Query', treatment?: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } | null };

export type CancelTreatmentBillingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
}>;


export type CancelTreatmentBillingMutation = { __typename?: 'Mutation', cancelTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type DismissBillingAlertMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DismissBillingAlertMutation = { __typename?: 'Mutation', dismissBillingAlert: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type RequestTreatmentRecallMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
}>;


export type RequestTreatmentRecallMutation = { __typename?: 'Mutation', requestTreatmentRecall: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type ResendTreatmentToAccountingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ResendTreatmentToAccountingMutation = { __typename?: 'Mutation', resendTreatmentToAccounting: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type DismissReturnFromAccountingBannerMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DismissReturnFromAccountingBannerMutation = { __typename?: 'Mutation', dismissReturnFromAccountingBanner: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type UpdateTreatmentServiceInvoiceDescriptionMutationVariables = Exact<{
  input: UpdateTreatmentServiceInvoiceDescriptionInput;
}>;


export type UpdateTreatmentServiceInvoiceDescriptionMutation = { __typename?: 'Mutation', updateTreatmentServiceInvoiceDescription: { __typename?: 'TreatmentService', id: string, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null } };

export type CreateTreatmentInvoiceLineMutationVariables = Exact<{
  input: CreateTreatmentInvoiceLineInput;
  createdBy?: InputMaybe<Scalars['ID']['input']>;
}>;


export type CreateTreatmentInvoiceLineMutation = { __typename?: 'Mutation', createTreatmentInvoiceLine: { __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any } };

export type UpdateTreatmentInvoiceLineMutationVariables = Exact<{
  input: UpdateTreatmentInvoiceLineInput;
}>;


export type UpdateTreatmentInvoiceLineMutation = { __typename?: 'Mutation', updateTreatmentInvoiceLine: { __typename?: 'TreatmentInvoiceLine', id: string, description: string, amount: number, updatedAt: any } };

export type DeleteTreatmentInvoiceLineMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTreatmentInvoiceLineMutation = { __typename?: 'Mutation', deleteTreatmentInvoiceLine: boolean };

export type RecordTreatmentPaymentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: RecordPaymentInput;
  callerRole?: InputMaybe<TreatmentCallerRole>;
}>;


export type RecordTreatmentPaymentMutation = { __typename?: 'Mutation', recordTreatmentPayment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type CloseTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CloseTreatmentInput;
}>;


export type CloseTreatmentMutation = { __typename?: 'Mutation', closeTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type ReopenTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ReopenTreatmentMutation = { __typename?: 'Mutation', reopenTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type ForceCloseTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
}>;


export type ForceCloseTreatmentMutation = { __typename?: 'Mutation', forceCloseTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, status: TreatmentStatus, forcedClosure: boolean, scontoFE: boolean, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, readyForBilling: boolean, readyForBillingAt?: any | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, startedAt: any, completedAt?: any | null, closedAt?: any | null, createdAt: any, updatedAt: any, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, recallRequestId?: string | null, recallRequestedAt?: any | null, lastRecallRejectionMessage?: string | null, lastRecallRejectionAt?: any | null, returnedFromAccountingReason?: string | null, returnedFromAccountingAt?: any | null, returnedFromAccountingByEmail?: string | null, returnedFromAccountingDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, macroCategory: OperatorMacroCategory, professionalRegistration?: string | null, canCollectPayment: boolean, color?: string | null, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null } | null } | null, appointment: { __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string }, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, invoiceLineDescription?: string | null, invoiceLineDescriptionAuto?: string | null, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, wasUsed: boolean, instrument?: { __typename?: 'Instrument', id: string, name: string } | null }> | null, invoiceLines?: Array<{ __typename?: 'TreatmentInvoiceLine', id: string, treatmentId: string, description: string, amount: number, createdBy?: string | null, createdAt: any, updatedAt: any }> | null } };

export type CreateAvailabilityAppointmentMutationVariables = Exact<{
  input: CreateAvailabilityAppointmentInput;
}>;


export type CreateAvailabilityAppointmentMutation = { __typename?: 'Mutation', createAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type UpdateAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAvailabilityAppointmentInput;
}>;


export type UpdateAvailabilityAppointmentMutation = { __typename?: 'Mutation', updateAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type CancelAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  cancellationReason?: InputMaybe<Scalars['String']['input']>;
}>;


export type CancelAvailabilityAppointmentMutation = { __typename?: 'Mutation', cancelAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type DeleteAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAvailabilityAppointmentMutation = { __typename?: 'Mutation', deleteAvailabilityAppointment: boolean };

export type ConfirmAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ConfirmAvailabilityAppointmentMutation = { __typename?: 'Mutation', confirmAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type MarkAppointmentAsNoShowMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkAppointmentAsNoShowMutation = { __typename?: 'Mutation', markAppointmentAsNoShow: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type CancelAppointmentWithNoticeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
  cancelledBy: Scalars['ID']['input'];
}>;


export type CancelAppointmentWithNoticeMutation = { __typename?: 'Mutation', cancelAppointmentWithNotice: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type MarkAppointmentAttendedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkAppointmentAttendedMutation = { __typename?: 'Mutation', markAppointmentAttended: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type RevertAppointmentAttendedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RevertAppointmentAttendedMutation = { __typename?: 'Mutation', revertAppointmentAttended: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type SendAppointmentRecapMutationVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
}>;


export type SendAppointmentRecapMutation = { __typename?: 'Mutation', sendAppointmentRecap: boolean };

export type CancelRecurringSeriesMutationVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
  fromDate: Scalars['String']['input'];
  scope: RecurringSeriesScope;
  reason: Scalars['String']['input'];
  cancelledBy: Scalars['ID']['input'];
}>;


export type CancelRecurringSeriesMutation = { __typename?: 'Mutation', cancelRecurringSeries: number };

export type DeleteRecurringSeriesMutationVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
  fromDate: Scalars['String']['input'];
  scope: RecurringSeriesScope;
  rangeFrom?: InputMaybe<Scalars['String']['input']>;
  rangeTo?: InputMaybe<Scalars['String']['input']>;
  includeCurrent?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type DeleteRecurringSeriesMutation = { __typename?: 'Mutation', deleteRecurringSeries: number };

export type UpdateRecurringSeriesTimeMutationVariables = Exact<{
  input: UpdateRecurringSeriesTimeInput;
}>;


export type UpdateRecurringSeriesTimeMutation = { __typename?: 'Mutation', updateRecurringSeriesTime: { __typename?: 'RecurringSeriesOperationResult', applied: boolean, affectedCount: number, conflicts: Array<{ __typename?: 'RecurringOccurrenceConflict', appointmentId?: string | null, date: string, startTime: string, endTime: string, type: string, reason: string, conflictingStartTime?: string | null, conflictingEndTime?: string | null }> } };

export type AvailabilityAppointmentFieldsFragment = { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null };

export type GetAvailabilityAppointmentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetAvailabilityAppointmentQuery = { __typename?: 'Query', availabilityAppointment?: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } | null };

export type GetAvailabilityAppointmentsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetAvailabilityAppointmentsByOperatorQuery = { __typename?: 'Query', availabilityAppointmentsByOperator: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetAvailabilityAppointmentsQueryVariables = Exact<{
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
  operatorIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
}>;


export type GetAvailabilityAppointmentsQuery = { __typename?: 'Query', availabilityAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetAvailabilityAppointmentsByPatientQueryVariables = Exact<{
  patientId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
}>;


export type GetAvailabilityAppointmentsByPatientQuery = { __typename?: 'Query', availabilityAppointmentsByPatient: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetRecurringSeriesQueryVariables = Exact<{
  recurringGroupId: Scalars['ID']['input'];
}>;


export type GetRecurringSeriesQuery = { __typename?: 'Query', recurringSeries: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type IsInstrumentAvailableQueryVariables = Exact<{
  instrumentId: Scalars['ID']['input'];
  appointmentDate: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
  startOffsetMinutes: Scalars['Float']['input'];
  endOffsetMinutes: Scalars['Float']['input'];
  excludeAppointmentId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type IsInstrumentAvailableQuery = { __typename?: 'Query', isInstrumentAvailable: boolean };

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

export type GetPhysiotherapistAvailableSlotsQueryVariables = Exact<{
  input: CheckPhysiotherapistAvailabilityInput;
}>;


export type GetPhysiotherapistAvailableSlotsQuery = { __typename?: 'Query', physiotherapistAvailableSlots: Array<{ __typename?: 'PhysiotherapistSlotOutput', startTime: string, endTime: string, available: boolean, reason?: string | null, suggestedInstruments?: Array<{ __typename?: 'InstrumentSlotOutput', instrumentCategoryId: string, categoryName: string, instrumentId?: string | null, startOffsetMinutes: number, endOffsetMinutes: number }> | null }> };

export type GetPhysiotherapistAvailableSlotsBatchQueryVariables = Exact<{
  operatorIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  dates: Array<Scalars['String']['input']> | Scalars['String']['input'];
  durationMinutes: Scalars['Int']['input'];
  customInstrumentSlots?: InputMaybe<Array<InstrumentSlotInput> | InstrumentSlotInput>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetPhysiotherapistAvailableSlotsBatchQuery = { __typename?: 'Query', physiotherapistAvailableSlotsBatch: Array<{ __typename?: 'PhysiotherapistSlotBatchOutput', operatorId: string, date: string, startTime: string, endTime: string, available: boolean, suggestedInstruments?: Array<{ __typename?: 'InstrumentSlotOutput', instrumentCategoryId: string, categoryName: string, instrumentId?: string | null, startOffsetMinutes: number, endOffsetMinutes: number }> | null }> };

export type GetConflictedAppointmentsQueryVariables = Exact<{
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  conflictReason?: InputMaybe<ConflictReason>;
}>;


export type GetConflictedAppointmentsQuery = { __typename?: 'Query', conflictedAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, appointmentDate: string, startTime: string, endTime: string, clientName: string, clientPhone?: string | null, clientEmail?: string | null, bookingStatus: BookingStatus, hasConflict: boolean, conflictReason?: ConflictReason | null, conflictDetectedAt?: any | null, notes?: string | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number } | null }> };

export type GetConflictStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetConflictStatsQuery = { __typename?: 'Query', conflictStats: { __typename?: 'ConflictStatsOutput', totalConflicts: number, byReason: any, byOperator: Array<{ __typename?: 'OperatorConflictCount', operatorId: string, operatorName: string, count: number }> } };

export type GetConflictedAppointmentsCountQueryVariables = Exact<{ [key: string]: never; }>;


export type GetConflictedAppointmentsCountQuery = { __typename?: 'Query', conflictedAppointmentsCount: number };

export type ResolveAppointmentConflictMutationVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
  action: ConflictResolutionAction;
  resolvedBy: Scalars['ID']['input'];
  newDate?: InputMaybe<Scalars['String']['input']>;
  newStartTime?: InputMaybe<Scalars['String']['input']>;
  newEndTime?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
}>;


export type ResolveAppointmentConflictMutation = { __typename?: 'Mutation', resolveAppointmentConflict: { __typename?: 'AvailabilityAppointment', id: string, hasConflict: boolean, conflictReason?: ConflictReason | null, bookingStatus: BookingStatus, appointmentDate: string, startTime: string, endTime: string } };

export type ResolveMultipleConflictsMutationVariables = Exact<{
  appointmentIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  action: ConflictResolutionAction;
  resolvedBy: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
}>;


export type ResolveMultipleConflictsMutation = { __typename?: 'Mutation', resolveMultipleConflicts: Array<{ __typename?: 'AvailabilityAppointment', id: string, hasConflict: boolean, bookingStatus: BookingStatus }> };

export type RevalidateConflictsIfNeededQueryVariables = Exact<{ [key: string]: never; }>;


export type RevalidateConflictsIfNeededQuery = { __typename?: 'Query', revalidateConflictsIfNeeded: { __typename?: 'ConflictRevalidationResult', skipped: boolean, resolved: number } };

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

export type GymAppointmentFieldsFragment = { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null };

export type GymSlotInfoFieldsFragment = { __typename?: 'GymSlotInfo', startTime: string, endTime: string, currentCount: number, maxCapacity: number, isAvailable: boolean, isClosed: boolean, operator?: { __typename?: 'GymSlotOperatorInfo', id: string, name: string, surname?: string | null, color?: string | null } | null };

export type GetGymRoomAppointmentsQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetGymRoomAppointmentsQuery = { __typename?: 'Query', gymRoomAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetGymRoomsAppointmentsQueryVariables = Exact<{
  gymRoomIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetGymRoomsAppointmentsQuery = { __typename?: 'Query', gymRoomsAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetGymRoomAvailableSlotsQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetGymRoomAvailableSlotsQuery = { __typename?: 'Query', gymRoomAvailableSlots: Array<{ __typename?: 'GymSlotInfo', startTime: string, endTime: string, currentCount: number, maxCapacity: number, isAvailable: boolean, isClosed: boolean, operator?: { __typename?: 'GymSlotOperatorInfo', id: string, name: string, surname?: string | null, color?: string | null } | null }> };

export type GetGymRoomsAvailableSlotsQueryVariables = Exact<{
  gymRoomIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetGymRoomsAvailableSlotsQuery = { __typename?: 'Query', gymRoomsAvailableSlots: Array<{ __typename?: 'GymSlotInfoWithContext', gymRoomId: string, date: string, startTime: string, endTime: string, currentCount: number, maxCapacity: number, isAvailable: boolean, isClosed: boolean, operator?: { __typename?: 'GymSlotOperatorInfo', id: string, name: string, surname?: string | null, color?: string | null } | null }> };

export type CreateGymAppointmentMutationVariables = Exact<{
  input: CreateGymAppointmentInput;
}>;


export type CreateGymAppointmentMutation = { __typename?: 'Mutation', createGymAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type CreateGymExceptionMutationVariables = Exact<{
  input: CreateGymExceptionInput;
}>;


export type CreateGymExceptionMutation = { __typename?: 'Mutation', createGymException: { __typename?: 'GymException', id: string, gymRoomId?: string | null, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, absenceTypeId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, absenceTypeSnapshot?: { __typename?: 'AbsenceTypeSnapshot', id: string, name: string, description?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string } | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substitutes?: Array<{ __typename?: 'GymExceptionSubstitute', id: string, gymRoomId: string, startTime: string, endTime: string, substituteOperatorId?: string | null, isClosed: boolean, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> | null } };

export type UpdateGymExceptionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateGymExceptionInput;
}>;


export type UpdateGymExceptionMutation = { __typename?: 'Mutation', updateGymException: { __typename?: 'GymException', id: string, gymRoomId?: string | null, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, absenceTypeId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, absenceTypeSnapshot?: { __typename?: 'AbsenceTypeSnapshot', id: string, name: string, description?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string } | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substitutes?: Array<{ __typename?: 'GymExceptionSubstitute', id: string, gymRoomId: string, startTime: string, endTime: string, substituteOperatorId?: string | null, isClosed: boolean, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> | null } };

export type DeleteGymExceptionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteGymExceptionMutation = { __typename?: 'Mutation', deleteGymException: boolean };

export type GymExceptionFieldsFragment = { __typename?: 'GymException', id: string, gymRoomId?: string | null, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, absenceTypeId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, absenceTypeSnapshot?: { __typename?: 'AbsenceTypeSnapshot', id: string, name: string, description?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string } | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substitutes?: Array<{ __typename?: 'GymExceptionSubstitute', id: string, gymRoomId: string, startTime: string, endTime: string, substituteOperatorId?: string | null, isClosed: boolean, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> | null };

export type GetGymExceptionsQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetGymExceptionsQuery = { __typename?: 'Query', gymExceptions: Array<{ __typename?: 'GymException', id: string, gymRoomId?: string | null, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, absenceTypeId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, absenceTypeSnapshot?: { __typename?: 'AbsenceTypeSnapshot', id: string, name: string, description?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string } | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substitutes?: Array<{ __typename?: 'GymExceptionSubstitute', id: string, gymRoomId: string, startTime: string, endTime: string, substituteOperatorId?: string | null, isClosed: boolean, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> | null }> };

export type GetGymExceptionsByDateQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetGymExceptionsByDateQuery = { __typename?: 'Query', gymExceptionsByDate: Array<{ __typename?: 'GymException', id: string, gymRoomId?: string | null, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, absenceTypeId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, absenceTypeSnapshot?: { __typename?: 'AbsenceTypeSnapshot', id: string, name: string, description?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string } | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substitutes?: Array<{ __typename?: 'GymExceptionSubstitute', id: string, gymRoomId: string, startTime: string, endTime: string, substituteOperatorId?: string | null, isClosed: boolean, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> | null }> };

export type GetGymExceptionQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetGymExceptionQuery = { __typename?: 'Query', gymException?: { __typename?: 'GymException', id: string, gymRoomId?: string | null, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, absenceTypeId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, absenceTypeSnapshot?: { __typename?: 'AbsenceTypeSnapshot', id: string, name: string, description?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string } | null, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substitutes?: Array<{ __typename?: 'GymExceptionSubstitute', id: string, gymRoomId: string, startTime: string, endTime: string, substituteOperatorId?: string | null, isClosed: boolean, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> | null } | null };

export type GetOperatorPatternsOnDateQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetOperatorPatternsOnDateQuery = { __typename?: 'Query', operatorPatternsOnDate: Array<{ __typename?: 'OperatorSlotOnDate', startTime: string, endTime: string, gymRoom: { __typename?: 'GymRoom', id: string, name: string } }> };

export type GetAvailableOperatorsForSlotQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
  endTime: Scalars['String']['input'];
  excludeOperatorId: Scalars['ID']['input'];
}>;


export type GetAvailableOperatorsForSlotQuery = { __typename?: 'Query', availableOperatorsForSlot: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null }> };

export type CreateGymPatternGroupMutationVariables = Exact<{
  input: CreateGymPatternGroupInput;
}>;


export type CreateGymPatternGroupMutation = { __typename?: 'Mutation', createGymPatternGroup: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } };

export type UpdateGymPatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateGymPatternGroupInput;
}>;


export type UpdateGymPatternGroupMutation = { __typename?: 'Mutation', updateGymPatternGroup: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } };

export type DeleteGymPatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteGymPatternGroupMutation = { __typename?: 'Mutation', deleteGymPatternGroup: boolean };

export type ActivateGymPatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ActivateGymPatternGroupMutation = { __typename?: 'Mutation', activateGymPatternGroup: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } };

export type DeactivateGymPatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeactivateGymPatternGroupMutation = { __typename?: 'Mutation', deactivateGymPatternGroup: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } };

export type DuplicateGymPatternGroupMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  newName: Scalars['String']['input'];
}>;


export type DuplicateGymPatternGroupMutation = { __typename?: 'Mutation', duplicateGymPatternGroup: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } };

export type GymPatternGroupFieldsFragment = { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null };

export type GetGymPatternGroupsQueryVariables = Exact<{
  gymRoomId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetGymPatternGroupsQuery = { __typename?: 'Query', gymPatternGroups: Array<{ __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null }> };

export type GetGymPatternGroupQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetGymPatternGroupQuery = { __typename?: 'Query', gymPatternGroup?: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } | null };

export type GetCurrentGymPatternGroupQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
}>;


export type GetCurrentGymPatternGroupQuery = { __typename?: 'Query', currentGymPatternGroup?: { __typename?: 'GymPatternGroup', id: string, gymRoomId: string, name: string, description?: string | null, patternDuration: number, patternStartDate: string, isActive: boolean, isCurrent: boolean, version: number, validFrom: string, validUntil?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null }, patterns?: Array<{ __typename?: 'GymTemplatePattern', id: string, operatorId: string, dayInPattern: number, startTime: string, endTime: string, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } }> | null } | null };

export type CreateGymRoomMutationVariables = Exact<{
  name: Scalars['String']['input'];
  maxCapacity?: InputMaybe<Scalars['Int']['input']>;
  slotDuration?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  defaultStartTime?: InputMaybe<Scalars['String']['input']>;
  defaultEndTime?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateGymRoomMutation = { __typename?: 'Mutation', createGymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateGymRoomMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  maxCapacity?: InputMaybe<Scalars['Int']['input']>;
  slotDuration?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  defaultStartTime?: InputMaybe<Scalars['String']['input']>;
  defaultEndTime?: InputMaybe<Scalars['String']['input']>;
}>;


export type UpdateGymRoomMutation = { __typename?: 'Mutation', updateGymRoom: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteGymRoomMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteGymRoomMutation = { __typename?: 'Mutation', deleteGymRoom: boolean };

export type GymRoomFieldsFragment = { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null, isActive: boolean, createdAt: any, updatedAt: any };

export type GetGymRoomsQueryVariables = Exact<{
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetGymRoomsQuery = { __typename?: 'Query', gymRooms: Array<{ __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null, isActive: boolean, createdAt: any, updatedAt: any }> };

export type GetGymRoomQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetGymRoomQuery = { __typename?: 'Query', gymRoom?: { __typename?: 'GymRoom', id: string, name: string, maxCapacity: number, slotDuration: number, color?: string | null, defaultStartTime?: string | null, defaultEndTime?: string | null, isActive: boolean, createdAt: any, updatedAt: any } | null };

export type GetInstructorAppointmentsQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetInstructorAppointmentsQuery = { __typename?: 'Query', availabilityAppointmentsByOperator: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: string | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, isMaster: boolean, masterAppointmentId?: string | null, repeatConfig?: any | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type CreateInstrumentMutationVariables = Exact<{
  categoryId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  brand?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  verificationExpiry?: InputMaybe<Scalars['DateTime']['input']>;
  technicalData?: InputMaybe<Scalars['JSON']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateInstrumentMutation = { __typename?: 'Mutation', createInstrument: { __typename?: 'Instrument', id: string, name: string, categoryId: string, brand?: string | null, model?: string | null, status: InstrumentStatus, isActive: boolean, color?: string | null, verificationExpiry?: any | null, technicalData?: any | null, createdAt: any, updatedAt: any, category: { __typename?: 'InstrumentCategory', id: string, name: string, macroCategory: OperatorMacroCategory } } };

export type UpdateInstrumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  brand?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  verificationExpiry?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<InstrumentStatus>;
  technicalData?: InputMaybe<Scalars['JSON']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateInstrumentMutation = { __typename?: 'Mutation', updateInstrument: { __typename?: 'Instrument', id: string, name: string, categoryId: string, brand?: string | null, model?: string | null, status: InstrumentStatus, isActive: boolean, color?: string | null, verificationExpiry?: any | null, technicalData?: any | null, createdAt: any, updatedAt: any, category: { __typename?: 'InstrumentCategory', id: string, name: string, macroCategory: OperatorMacroCategory } } };

export type SetInstrumentStatusMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  status: InstrumentStatus;
}>;


export type SetInstrumentStatusMutation = { __typename?: 'Mutation', setInstrumentStatus: { __typename?: 'Instrument', id: string, name: string, status: InstrumentStatus, isActive: boolean } };

export type DeleteInstrumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteInstrumentMutation = { __typename?: 'Mutation', deleteInstrument: boolean };

export type CreateInstrumentCategoryMutationVariables = Exact<{
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
}>;


export type CreateInstrumentCategoryMutation = { __typename?: 'Mutation', createInstrumentCategory: { __typename?: 'InstrumentCategory', id: string, name: string, description?: string | null, macroCategory: OperatorMacroCategory, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateInstrumentCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateInstrumentCategoryMutation = { __typename?: 'Mutation', updateInstrumentCategory: { __typename?: 'InstrumentCategory', id: string, name: string, description?: string | null, macroCategory: OperatorMacroCategory, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteInstrumentCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteInstrumentCategoryMutation = { __typename?: 'Mutation', deleteInstrumentCategory: boolean };

export type GetInstrumentsQueryVariables = Exact<{
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<InstrumentStatus>;
}>;


export type GetInstrumentsQuery = { __typename?: 'Query', instruments: Array<{ __typename?: 'Instrument', id: string, name: string, categoryId: string, brand?: string | null, model?: string | null, status: InstrumentStatus, isActive: boolean, color?: string | null, verificationExpiry?: any | null, technicalData?: any | null, createdAt: any, updatedAt: any, category: { __typename?: 'InstrumentCategory', id: string, name: string, macroCategory: OperatorMacroCategory } }> };

export type GetInstrumentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetInstrumentQuery = { __typename?: 'Query', instrument?: { __typename?: 'Instrument', id: string, name: string, categoryId: string, brand?: string | null, model?: string | null, status: InstrumentStatus, isActive: boolean, color?: string | null, verificationExpiry?: any | null, technicalData?: any | null, createdAt: any, updatedAt: any, category: { __typename?: 'InstrumentCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } } | null };

export type GetInstrumentCategoriesQueryVariables = Exact<{
  macroCategory?: InputMaybe<OperatorMacroCategory>;
}>;


export type GetInstrumentCategoriesQuery = { __typename?: 'Query', instrumentCategories: Array<{ __typename?: 'InstrumentCategory', id: string, name: string, description?: string | null, macroCategory: OperatorMacroCategory, isActive: boolean, createdAt: any, updatedAt: any, instruments?: Array<{ __typename?: 'Instrument', id: string, name: string, status: InstrumentStatus, isActive: boolean }> | null }> };

export type GetInstrumentCategoryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetInstrumentCategoryQuery = { __typename?: 'Query', instrumentCategory?: { __typename?: 'InstrumentCategory', id: string, name: string, description?: string | null, macroCategory: OperatorMacroCategory, isActive: boolean, createdAt: any, updatedAt: any, instruments?: Array<{ __typename?: 'Instrument', id: string, name: string, brand?: string | null, model?: string | null, status: InstrumentStatus, isActive: boolean, color?: string | null }> | null } | null };

export type GetAvailableInstrumentsByCategoryQueryVariables = Exact<{
  categoryId: Scalars['ID']['input'];
}>;


export type GetAvailableInstrumentsByCategoryQuery = { __typename?: 'Query', availableInstrumentsByCategory: Array<{ __typename?: 'Instrument', id: string, name: string, brand?: string | null, model?: string | null, status: InstrumentStatus, color?: string | null }> };

export type MyProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type MyProfileQuery = { __typename?: 'Query', myProfile?: { __typename?: 'MyProfile', appUserId: string, userType: AppUserType, operatorId?: string | null, permissions: Array<string> } | null };

export type CreateOperatorAbsenceTypeMutationVariables = Exact<{
  input: CreateOperatorAbsenceTypeInput;
}>;


export type CreateOperatorAbsenceTypeMutation = { __typename?: 'Mutation', createOperatorAbsenceType: { __typename?: 'OperatorAbsenceType', id: string, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateOperatorAbsenceTypeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateOperatorAbsenceTypeInput;
}>;


export type UpdateOperatorAbsenceTypeMutation = { __typename?: 'Mutation', updateOperatorAbsenceType: { __typename?: 'OperatorAbsenceType', id: string, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteOperatorAbsenceTypeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteOperatorAbsenceTypeMutation = { __typename?: 'Mutation', deleteOperatorAbsenceType: boolean };

export type OperatorAbsenceTypeFieldsFragment = { __typename?: 'OperatorAbsenceType', id: string, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any };

export type GetOperatorAbsenceTypesQueryVariables = Exact<{
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetOperatorAbsenceTypesQuery = { __typename?: 'Query', operatorAbsenceTypes: Array<{ __typename?: 'OperatorAbsenceType', id: string, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any }> };

export type GetOperatorAbsenceTypeQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorAbsenceTypeQuery = { __typename?: 'Query', operatorAbsenceType?: { __typename?: 'OperatorAbsenceType', id: string, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } | null };

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


export type CreateOperatorMutation = { __typename?: 'Mutation', createOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, userId?: string | null, legacyUserId?: string | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, canCollectPayment: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null } };

export type UpdateOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateOperatorInput;
}>;


export type UpdateOperatorMutation = { __typename?: 'Mutation', updateOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, userId?: string | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, canCollectPayment: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null } };

export type DeleteOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteOperatorMutation = { __typename?: 'Mutation', deleteOperator: { __typename?: 'DeleteOperatorResult', archived: boolean, hardDeleted: boolean, dependencies: { __typename?: 'OperatorDependencyCount', total: number, treatments: number, therapeuticPaths: number, evaluations: number, anamnesis: number, appointments: number, gymSchedules: number, templateAssignments: number, waitingList: number } } };

export type RestoreOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RestoreOperatorMutation = { __typename?: 'Mutation', restoreOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, isActive: boolean, deletedAt?: any | null } };

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


export type GetOperatorsQuery = { __typename?: 'Query', operators: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: string | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, canCollectPayment: boolean, createdAt: any, updatedAt: any, deletedAt?: any | null, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null, templateAssignments?: Array<{ __typename?: 'TemplateAssignment', id: string, isCurrent: boolean }> | null }> };

export type GetOperatorQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorQuery = { __typename?: 'Query', operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: string | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, canCollectPayment: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null, availabilityTemplates?: Array<{ __typename?: 'AvailabilityTemplate', id: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, isCurrent: boolean, validFrom: any, validUntil?: any | null }> | null, availabilityExceptions?: Array<{ __typename?: 'AvailabilityException', id: string, exceptionDate: any, exceptionType: ExceptionType, startTime?: string | null, endTime?: string | null, reason?: string | null }> | null } | null };

export type MyOperatorQueryVariables = Exact<{ [key: string]: never; }>;


export type MyOperatorQuery = { __typename?: 'Query', myOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: string | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, canCollectPayment: boolean, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null, templateAssignments?: Array<{ __typename?: 'TemplateAssignment', id: string, isCurrent: boolean }> | null } | null };

export type GetOperatorAvailabilityQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetOperatorAvailabilityQuery = { __typename?: 'Query', operatorAvailability: Array<{ __typename?: 'DailyAvailability', date: string, hasAvailability: boolean, slots: Array<{ __typename?: 'AvailabilitySlot', operatorId: string, date: string, startTime: string, endTime: string, totalCapacity: number, bookedCapacity: number, availableCapacity: number, isAvailable: boolean, source?: string | null, sourceId?: string | null }> }> };

export type GetArchivedOperatorsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetArchivedOperatorsQuery = { __typename?: 'Query', archivedOperators: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, isActive: boolean, deletedAt?: any | null, deletedByUserId?: string | null, appUserId?: string | null, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null }> };

export type GetOperatorDependenciesQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorDependenciesQuery = { __typename?: 'Query', operatorDependencies: { __typename?: 'OperatorDependencyCount', total: number, treatments: number, therapeuticPaths: number, evaluations: number, anamnesis: number, appointments: number, gymSchedules: number, templateAssignments: number, waitingList: number } };

export type GetOperatorsAvailabilityQueryVariables = Exact<{
  operatorIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetOperatorsAvailabilityQuery = { __typename?: 'Query', operatorsAvailability: Array<{ __typename?: 'OperatorAvailabilityResult', operatorId: string, availability: Array<{ __typename?: 'DailyAvailability', date: string, hasAvailability: boolean, slots: Array<{ __typename?: 'AvailabilitySlot', operatorId: string, date: string, startTime: string, endTime: string, totalCapacity: number, bookedCapacity: number, availableCapacity: number, isAvailable: boolean, source?: string | null, sourceId?: string | null }> }> }> };

export type CreateEvaluationMutationVariables = Exact<{
  input: CreateEvaluationInput;
}>;


export type CreateEvaluationMutation = { __typename?: 'Mutation', createEvaluation: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null }> | null, exams?: Array<{ __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type UpdateEvaluationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateEvaluationInput;
}>;


export type UpdateEvaluationMutation = { __typename?: 'Mutation', updateEvaluation: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null }> | null, exams?: Array<{ __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type DeleteEvaluationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteEvaluationMutation = { __typename?: 'Mutation', deleteEvaluation: boolean };

export type MarkObjectiveAchievedMutationVariables = Exact<{
  objectiveId: Scalars['ID']['input'];
  input: MarkObjectiveAchievedInput;
}>;


export type MarkObjectiveAchievedMutation = { __typename?: 'Mutation', markObjectiveAchieved: { __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any } };

export type UpdateTestResultMutationVariables = Exact<{
  testId: Scalars['ID']['input'];
  input: UpdateTestResultInput;
}>;


export type UpdateTestResultMutation = { __typename?: 'Mutation', updateTestResult: { __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null } };

export type EvaluationObjectiveFieldsFragment = { __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any };

export type EvaluationTestFieldsFragment = { __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null };

export type EvaluationExamFieldsFragment = { __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any };

export type PatientEvaluationFieldsFragment = { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } };

export type PatientEvaluationWithRelationsFieldsFragment = { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null }> | null, exams?: Array<{ __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } };

export type GetPatientEvaluationQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientEvaluationQuery = { __typename?: 'Query', patientEvaluation?: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null }> | null, exams?: Array<{ __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetEvaluationByPathQueryVariables = Exact<{
  pathId: Scalars['ID']['input'];
}>;


export type GetEvaluationByPathQuery = { __typename?: 'Query', evaluationByPath?: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null }> | null, exams?: Array<{ __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetObjectivesByEvaluationQueryVariables = Exact<{
  evaluationId: Scalars['ID']['input'];
}>;


export type GetObjectivesByEvaluationQuery = { __typename?: 'Query', objectivesByEvaluation: Array<{ __typename?: 'EvaluationObjective', id: string, evaluationId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, progressLevel: number, orderIndex: number, createdAt: any, updatedAt: any }> };

export type GetObjectivesProgressQueryVariables = Exact<{
  evaluationId: Scalars['ID']['input'];
}>;


export type GetObjectivesProgressQuery = { __typename?: 'Query', objectivesProgress: { __typename?: 'ObjectivesProgress', total: number, achieved: number, percentage: number } };

export type GetTestsByEvaluationQueryVariables = Exact<{
  evaluationId: Scalars['ID']['input'];
}>;


export type GetTestsByEvaluationQuery = { __typename?: 'Query', testsByEvaluation: Array<{ __typename?: 'EvaluationTest', id: string, evaluationId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any, evaluationHistory?: Array<{ __typename?: 'TestEvaluationHistory', id: string, evaluationLevel: number, note?: string | null, treatmentsSinceLast: number, createdAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null }> | null }> };

export type GetTestsProgressQueryVariables = Exact<{
  evaluationId: Scalars['ID']['input'];
}>;


export type GetTestsProgressQuery = { __typename?: 'Query', testsProgress: { __typename?: 'TestsProgress', total: number, passed: number, failed: number, pending: number, percentage: number } };

export type GetExamsByEvaluationQueryVariables = Exact<{
  evaluationId: Scalars['ID']['input'];
}>;


export type GetExamsByEvaluationQuery = { __typename?: 'Query', examsByEvaluation: Array<{ __typename?: 'EvaluationExam', id: string, evaluationId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> };

export type CreatePatientMutationVariables = Exact<{
  input: CreatePatientInput;
}>;


export type CreatePatientMutation = { __typename?: 'Mutation', createPatient: { __typename?: 'Patient', id: string, displayName?: string | null, isActive?: boolean | null, lastSyncedAt?: any | null, subject?: { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null } | null, anamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any } | null, attendance: { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number } } };

export type UpdatePatientRegistryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateRegistryIndividualInput;
}>;


export type UpdatePatientRegistryMutation = { __typename?: 'Mutation', updatePatientRegistry: { __typename?: 'Patient', id: string, displayName?: string | null, isActive?: boolean | null, lastSyncedAt?: any | null, subject?: { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null } | null, anamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any } | null, attendance: { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number } } };

export type UpdatePatientAnamnesisMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePatientAnamnesisInput;
}>;


export type UpdatePatientAnamnesisMutation = { __typename?: 'Mutation', updatePatientAnamnesis: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, updatedAt: any } };

export type SetPatientPrivacyConsentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  given: Scalars['Boolean']['input'];
  documentRef?: InputMaybe<Scalars['String']['input']>;
}>;


export type SetPatientPrivacyConsentMutation = { __typename?: 'Mutation', setPatientPrivacyConsent: { __typename?: 'Patient', id: string, displayName?: string | null, isActive?: boolean | null, lastSyncedAt?: any | null, subject?: { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null } | null, anamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any } | null, attendance: { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number } } };

export type DeactivatePatientMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeactivatePatientMutation = { __typename?: 'Mutation', deactivatePatient: boolean };

export type RecordPatientAttendanceMutationVariables = Exact<{
  subjectId: Scalars['ID']['input'];
  eventType: Scalars['String']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  appointmentId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type RecordPatientAttendanceMutation = { __typename?: 'Mutation', recordPatientAttendance: boolean };

export type RegistrySubjectFieldsFragment = { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null };

export type PatientAnamnesisFieldsFragment = { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any };

export type AttendanceFieldsFragment = { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number };

export type PatientFieldsFragment = { __typename?: 'Patient', id: string, displayName?: string | null, isActive?: boolean | null, lastSyncedAt?: any | null, subject?: { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null } | null, anamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any } | null, attendance: { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number } };

export type GetPatientQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientQuery = { __typename?: 'Query', patient?: { __typename?: 'Patient', id: string, displayName?: string | null, isActive?: boolean | null, lastSyncedAt?: any | null, subject?: { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null } | null, anamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any } | null, attendance: { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number } } | null };

export type SearchPatientsQueryVariables = Exact<{
  input: SearchPatientInput;
}>;


export type SearchPatientsQuery = { __typename?: 'Query', searchPatients: { __typename?: 'PaginatedPatients', total: number, page: number, pageSize: number, totalPages: number, data: Array<{ __typename?: 'Patient', id: string, displayName?: string | null, isActive?: boolean | null, lastSyncedAt?: any | null, subject?: { __typename?: 'RegistrySubject', id: string, subjectType: string, isActive: boolean, firstName?: string | null, lastName?: string | null, taxCode?: string | null, birthDate?: string | null, birthPlace?: string | null, birthCountry?: string | null, gender?: string | null, legalCapacity?: string | null, vatNumber?: string | null, notes?: string | null, displayName?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, addresses: Array<{ __typename?: 'RegistryAddress', id: string, addressType: string, street?: string | null, city?: string | null, zipCode?: string | null, province?: string | null, countryCode: string, isPrimary: boolean }>, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, label?: string | null, isPrimary: boolean, verified: boolean }>, privacyGeneralConsent?: { __typename?: 'RegistryPrivacyConsent', given: boolean, givenAt?: any | null, revokedAt?: any | null, documentRef?: string | null } | null } | null, anamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, gruppoSanguigno?: string | null, medicoBase?: string | null, patologieCroniche?: string | null, allergie?: string | null, terapiaFarmacologica?: Array<string> | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any } | null, attendance: { __typename?: 'AttendanceStats', noShowsByYear: any, cancellationsByYear: any, totalNoShows: number, totalCancellations: number } }> } };

export type RecycleBinItemFieldsFragment = { __typename?: 'RecycleBinItem', id: string, entityType: RecycleBinEntityType, title: string, subtitle?: string | null, deletedAt: any, deletedByUserId?: string | null, deletedByName?: string | null, ownerUserId?: string | null, ownerName?: string | null, scheduledPurgeAt?: any | null, childrenCount?: number | null };

export type RecycleBinQueryVariables = Exact<{
  filter?: InputMaybe<RecycleBinFilterInput>;
}>;


export type RecycleBinQuery = { __typename?: 'Query', recycleBin: Array<{ __typename?: 'RecycleBinItem', id: string, entityType: RecycleBinEntityType, title: string, subtitle?: string | null, deletedAt: any, deletedByUserId?: string | null, deletedByName?: string | null, ownerUserId?: string | null, ownerName?: string | null, scheduledPurgeAt?: any | null, childrenCount?: number | null }> };

export type RecycleBinSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type RecycleBinSettingsQuery = { __typename?: 'Query', recycleBinSettings: { __typename?: 'RecycleBinSettings', id: string, retentionDays?: number | null, updatedAt: any, updatedByUserId?: string | null } };

export type RestoreFromRecycleBinMutationVariables = Exact<{
  entityType: RecycleBinEntityType;
  id: Scalars['ID']['input'];
}>;


export type RestoreFromRecycleBinMutation = { __typename?: 'Mutation', restoreFromRecycleBin: boolean };

export type PurgeFromRecycleBinMutationVariables = Exact<{
  entityType: RecycleBinEntityType;
  id: Scalars['ID']['input'];
}>;


export type PurgeFromRecycleBinMutation = { __typename?: 'Mutation', purgeFromRecycleBin: boolean };

export type EmptyRecycleBinMutationVariables = Exact<{
  force?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type EmptyRecycleBinMutation = { __typename?: 'Mutation', emptyRecycleBin: number };

export type UpdateRecycleBinSettingsMutationVariables = Exact<{
  retentionDays?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpdateRecycleBinSettingsMutation = { __typename?: 'Mutation', updateRecycleBinSettings: { __typename?: 'RecycleBinSettings', id: string, retentionDays?: number | null, updatedAt: any, updatedByUserId?: string | null } };

export type ServiceInvoicePrefixesQueryVariables = Exact<{ [key: string]: never; }>;


export type ServiceInvoicePrefixesQuery = { __typename?: 'Query', serviceInvoicePrefixes: Array<{ __typename?: 'ServiceInvoicePrefix', id: string, macroCategory: OperatorMacroCategory, prefix: string, createdAt: any, updatedAt: any }> };

export type UpsertServiceInvoicePrefixMutationVariables = Exact<{
  input: UpsertServiceInvoicePrefixInput;
}>;


export type UpsertServiceInvoicePrefixMutation = { __typename?: 'Mutation', upsertServiceInvoicePrefix: { __typename?: 'ServiceInvoicePrefix', id: string, macroCategory: OperatorMacroCategory, prefix: string, updatedAt: any } };

export type CreateServiceSubcategoryMutationVariables = Exact<{
  macroCategory: OperatorMacroCategory;
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateServiceSubcategoryMutation = { __typename?: 'Mutation', createServiceSubcategory: { __typename?: 'ServiceSubcategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type UpdateServiceSubcategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateServiceSubcategoryMutation = { __typename?: 'Mutation', updateServiceSubcategory: { __typename?: 'ServiceSubcategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } };

export type DeleteServiceSubcategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteServiceSubcategoryMutation = { __typename?: 'Mutation', deleteServiceSubcategory: boolean };

export type ServiceSubcategoryFieldsFragment = { __typename?: 'ServiceSubcategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any };

export type GetServiceSubcategoriesQueryVariables = Exact<{
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetServiceSubcategoriesQuery = { __typename?: 'Query', serviceSubcategories: Array<{ __typename?: 'ServiceSubcategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any }> };

export type GetServiceSubcategoryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetServiceSubcategoryQuery = { __typename?: 'Query', serviceSubcategory?: { __typename?: 'ServiceSubcategory', id: string, macroCategory: OperatorMacroCategory, name: string, description?: string | null, isActive: boolean, createdAt: any, updatedAt: any } | null };

export type CreateServiceMutationVariables = Exact<{
  name: Scalars['String']['input'];
  serviceCode: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  defaultDuration: Scalars['Int']['input'];
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  subcategoryId?: InputMaybe<Scalars['ID']['input']>;
  discountFE?: InputMaybe<Scalars['Float']['input']>;
  serviceFee?: InputMaybe<Scalars['Float']['input']>;
  studioExtra?: InputMaybe<Scalars['Float']['input']>;
  serviceFeeFE?: InputMaybe<Scalars['Float']['input']>;
  studioExtraFE?: InputMaybe<Scalars['Float']['input']>;
}>;


export type CreateServiceMutation = { __typename?: 'Mutation', createService: { __typename?: 'Service', id: string, name: string, serviceCode: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, serviceFee?: number | null, studioExtra?: number | null, serviceFeeFE?: number | null, studioExtraFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null } };

export type UpdateServiceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  serviceCode?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  defaultDuration?: InputMaybe<Scalars['Int']['input']>;
  defaultPrice?: InputMaybe<Scalars['Float']['input']>;
  bufferTimeBefore?: InputMaybe<Scalars['Int']['input']>;
  bufferTimeAfter?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  subcategoryId?: InputMaybe<Scalars['ID']['input']>;
  discountFE?: InputMaybe<Scalars['Float']['input']>;
  serviceFee?: InputMaybe<Scalars['Float']['input']>;
  studioExtra?: InputMaybe<Scalars['Float']['input']>;
  serviceFeeFE?: InputMaybe<Scalars['Float']['input']>;
  studioExtraFE?: InputMaybe<Scalars['Float']['input']>;
}>;


export type UpdateServiceMutation = { __typename?: 'Mutation', updateService: { __typename?: 'Service', id: string, name: string, serviceCode: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, serviceFee?: number | null, studioExtra?: number | null, serviceFeeFE?: number | null, studioExtraFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null } };

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


export type GetServicesQuery = { __typename?: 'Query', services: Array<{ __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, serviceFee?: number | null, studioExtra?: number | null, serviceFeeFE?: number | null, studioExtraFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null }> };

export type GetServiceQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetServiceQuery = { __typename?: 'Query', service?: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, serviceFee?: number | null, studioExtra?: number | null, serviceFeeFE?: number | null, studioExtraFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null, operators?: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null } | null };

export type GetOperatorServicesQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type GetOperatorServicesQuery = { __typename?: 'Query', operatorServices: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, service: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean } }> };

export type GetServiceOperatorsQueryVariables = Exact<{
  serviceId: Scalars['ID']['input'];
}>;


export type GetServiceOperatorsQuery = { __typename?: 'Query', serviceOperators: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, macroCategory: OperatorMacroCategory } }> };

export type CreatePatientAnamnesisMutationVariables = Exact<{
  input: CreatePatientAnamnesisInput;
}>;


export type CreatePatientAnamnesisMutation = { __typename?: 'Mutation', createPatientAnamnesis: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, allergie?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null } };

export type UpdateSimplePatientAnamnesisMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePatientAnamnesisInput;
}>;


export type UpdateSimplePatientAnamnesisMutation = { __typename?: 'Mutation', updatePatientAnamnesis: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, allergie?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null } };

export type UpsertPatientAnamnesisMutationVariables = Exact<{
  subjectId: Scalars['ID']['input'];
  input: UpdatePatientAnamnesisInput;
}>;


export type UpsertPatientAnamnesisMutation = { __typename?: 'Mutation', upsertPatientAnamnesis: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, allergie?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null } };

export type DeletePatientAnamnesisMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePatientAnamnesisMutation = { __typename?: 'Mutation', deletePatientAnamnesis: boolean };

export type SimplePatientAnamnesisFieldsFragment = { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, allergie?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null };

export type GetPatientAnamnesisQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientAnamnesisQuery = { __typename?: 'Query', patientAnamnesis?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, allergie?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null } | null };

export type GetPatientAnamnesisByPatientQueryVariables = Exact<{
  subjectId: Scalars['ID']['input'];
}>;


export type GetPatientAnamnesisByPatientQuery = { __typename?: 'Query', patientAnamnesisBySubject?: { __typename?: 'PatientAnamnesis', id: string, subjectId: string, operatorId?: string | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, allergie?: string | null, storiaFamiliare?: string | null, note?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null } | null } | null };

export type HasPatientAnamnesisQueryVariables = Exact<{
  subjectId: Scalars['ID']['input'];
}>;


export type HasPatientAnamnesisQuery = { __typename?: 'Query', hasPatientAnamnesis: boolean };

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

export type CreateTherapeuticPathMutationVariables = Exact<{
  input: CreateTherapeuticPathInput;
}>;


export type CreateTherapeuticPathMutation = { __typename?: 'Mutation', createTherapeuticPath: { __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } } };

export type UpdateTherapeuticPathMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTherapeuticPathInput;
}>;


export type UpdateTherapeuticPathMutation = { __typename?: 'Mutation', updateTherapeuticPath: { __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } } };

export type DeleteTherapeuticPathMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTherapeuticPathMutation = { __typename?: 'Mutation', deleteTherapeuticPath: boolean };

export type CreatePatientEvaluationMutationVariables = Exact<{
  input: CreateEvaluationInput;
}>;


export type CreatePatientEvaluationMutation = { __typename?: 'Mutation', createEvaluation: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type UpdatePatientEvaluationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateEvaluationInput;
}>;


export type UpdatePatientEvaluationMutation = { __typename?: 'Mutation', updateEvaluation: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type DeletePatientEvaluationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePatientEvaluationMutation = { __typename?: 'Mutation', deleteEvaluation: boolean };

export type CreatePathDocumentMutationVariables = Exact<{
  input: CreateDocumentInput;
}>;


export type CreatePathDocumentMutation = { __typename?: 'Mutation', createPathDocument: { __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any } };

export type DeletePathDocumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePathDocumentMutation = { __typename?: 'Mutation', deletePathDocument: boolean };

export type PathDocumentFieldsFragment = { __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any };

export type TherapeuticPathFieldsFragment = { __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } };

export type TherapeuticPathWithRelationsFieldsFragment = { __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } };

export type GetTherapeuticPathQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetTherapeuticPathQuery = { __typename?: 'Query', therapeuticPath?: { __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } } | null };

export type GetTherapeuticPathsByPatientQueryVariables = Exact<{
  patientId: Scalars['ID']['input'];
}>;


export type GetTherapeuticPathsByPatientQuery = { __typename?: 'Query', therapeuticPathsByPatient: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } }> };

export type GetActiveTherapeuticPathsByPatientQueryVariables = Exact<{
  patientId: Scalars['ID']['input'];
}>;


export type GetActiveTherapeuticPathsByPatientQuery = { __typename?: 'Query', activeTherapeuticPathsByPatient: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } }> };

export type GetTherapeuticPathsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type GetTherapeuticPathsByOperatorQuery = { __typename?: 'Query', therapeuticPathsByOperator: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } }> };

export type GetTherapeuticPathsByPatientsQueryVariables = Exact<{
  patientIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type GetTherapeuticPathsByPatientsQuery = { __typename?: 'Query', therapeuticPathsByPatients: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: string, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, appUserId?: string | null } }> };

export type GetPatientEvaluationForPathQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientEvaluationForPathQuery = { __typename?: 'Query', patientEvaluation?: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetEvaluationByPathScopeQueryVariables = Exact<{
  pathId: Scalars['ID']['input'];
}>;


export type GetEvaluationByPathScopeQuery = { __typename?: 'Query', evaluationByPath?: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetPathDocumentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPathDocumentQuery = { __typename?: 'Query', pathDocument?: { __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any } | null };

export type GetDocumentsByPathQueryVariables = Exact<{
  pathId: Scalars['ID']['input'];
}>;


export type GetDocumentsByPathQuery = { __typename?: 'Query', documentsByPath: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> };

export type GetDocumentsByPathAndCategoryQueryVariables = Exact<{
  pathId: Scalars['ID']['input'];
  category: DocumentCategory;
}>;


export type GetDocumentsByPathAndCategoryQuery = { __typename?: 'Query', documentsByPathAndCategory: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> };

export type CreateTreatmentMutationVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
  therapeuticPathId: Scalars['ID']['input'];
  scontoFE?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CreateTreatmentMutation = { __typename?: 'Mutation', createTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type CompleteTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CompleteTreatmentInput;
}>;


export type CompleteTreatmentMutation = { __typename?: 'Mutation', completeTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type CloseTreatmentLegacyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CloseTreatmentInput;
}>;


export type CloseTreatmentLegacyMutation = { __typename?: 'Mutation', closeTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type ReopenTreatmentLegacyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ReopenTreatmentLegacyMutation = { __typename?: 'Mutation', reopenTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type ReopenTreatmentByOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ReopenTreatmentByOperatorMutation = { __typename?: 'Mutation', reopenTreatmentByOperator: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type ReopenTreatmentBySecretaryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ReopenTreatmentBySecretaryMutation = { __typename?: 'Mutation', reopenTreatmentBySecretary: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type ForceCloseTreatmentLegacyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  secretaryNotes?: InputMaybe<Scalars['String']['input']>;
}>;


export type ForceCloseTreatmentLegacyMutation = { __typename?: 'Mutation', forceCloseTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type RecordTreatmentPaymentLegacyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: RecordPaymentInput;
}>;


export type RecordTreatmentPaymentLegacyMutation = { __typename?: 'Mutation', recordTreatmentPayment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type MarkTreatmentInvoicedToPatientMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
}>;


export type MarkTreatmentInvoicedToPatientMutation = { __typename?: 'Mutation', markTreatmentInvoicedToPatient: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type MarkTreatmentInvoicedByOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
}>;


export type MarkTreatmentInvoicedByOperatorMutation = { __typename?: 'Mutation', markTreatmentInvoicedByOperator: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type UpdateTreatmentInstrumentsMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  instruments: Array<TreatmentInstrumentInput> | TreatmentInstrumentInput;
}>;


export type UpdateTreatmentInstrumentsMutation = { __typename?: 'Mutation', updateTreatmentInstruments: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type UpdateTreatmentMutationVariables = Exact<{
  input: UpdateTreatmentInput;
}>;


export type UpdateTreatmentMutation = { __typename?: 'Mutation', updateTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type DeleteTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTreatmentMutation = { __typename?: 'Mutation', deleteTreatment: boolean };

export type TreatmentFieldsFragment = { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any };

export type TreatmentWithRelationsFieldsFragment = { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } };

export type GetTreatmentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetTreatmentQuery = { __typename?: 'Query', treatment?: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } | null };

export type GetTreatmentByAppointmentQueryVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
}>;


export type GetTreatmentByAppointmentQuery = { __typename?: 'Query', treatmentByAppointment?: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } | null };

export type GetTreatmentsByAppointmentsQueryVariables = Exact<{
  appointmentIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type GetTreatmentsByAppointmentsQuery = { __typename?: 'Query', treatmentsByAppointments: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  date?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsByOperatorQuery = { __typename?: 'Query', treatmentsByOperator: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsByOperatorsQueryVariables = Exact<{
  operatorIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  date?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsByOperatorsQuery = { __typename?: 'Query', treatmentsByOperators: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsPendingClosureQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTreatmentsPendingClosureQuery = { __typename?: 'Query', treatmentsPendingClosure: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsByPatientQueryVariables = Exact<{
  patientId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetTreatmentsByPatientQuery = { __typename?: 'Query', treatmentsByPatient: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsNotInvoicedToPatientQueryVariables = Exact<{
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsNotInvoicedToPatientQuery = { __typename?: 'Query', treatmentsNotInvoicedToPatient: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsNotInvoicedByOperatorQueryVariables = Exact<{
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsNotInvoicedByOperatorQuery = { __typename?: 'Query', treatmentsNotInvoicedByOperator: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsByTherapeuticPathQueryVariables = Exact<{
  therapeuticPathId: Scalars['ID']['input'];
}>;


export type GetTreatmentsByTherapeuticPathQuery = { __typename?: 'Query', treatmentsByTherapeuticPath: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: string | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, forcedClosure: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, billingStatus: TreatmentBillingStatus, amendmentRevision: number, accountingBillableEventId?: string | null, accountingInvoiceUrl?: string | null, accountingInvoiceIssuedAt?: any | null, accountingDocumentType?: string | null, accountingCreditNoteNumber?: string | null, accountingCreditNoteIssuedAt?: any | null, accountingRefundReason?: string | null, billingAlertMessage?: string | null, billingAlertAt?: any | null, billingAlertDismissedAt?: any | null, cancelledAt?: any | null, cancelledByUserId?: string | null, cancellationReason?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number, appUserId?: string | null }, patient?: { __typename?: 'Patient', id: string, displayName?: string | null, subject?: { __typename?: 'RegistrySubject', id: string, firstName?: string | null, lastName?: string | null, taxCode?: string | null, primaryEmail?: string | null, primaryPhone?: string | null, contacts: Array<{ __typename?: 'RegistryContact', id: string, contactType: string, value: string, isPrimary: boolean }> } | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type CreateWaitingListEntryMutationVariables = Exact<{
  input: CreateWaitingListEntryInput;
}>;


export type CreateWaitingListEntryMutation = { __typename?: 'Mutation', createWaitingListEntry: { __typename?: 'WaitingListEntry', id: string, patientId?: string | null, patientName: string, phone?: string | null, operatorId?: string | null, notes?: string | null, priority: number, position: number, status: WaitingListStatus, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null } };

export type UpdateWaitingListEntryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateWaitingListEntryInput;
}>;


export type UpdateWaitingListEntryMutation = { __typename?: 'Mutation', updateWaitingListEntry: { __typename?: 'WaitingListEntry', id: string, patientId?: string | null, patientName: string, phone?: string | null, operatorId?: string | null, notes?: string | null, priority: number, position: number, status: WaitingListStatus, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null } };

export type DeleteWaitingListEntryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteWaitingListEntryMutation = { __typename?: 'Mutation', deleteWaitingListEntry: boolean };

export type ReorderWaitingListMutationVariables = Exact<{
  input: ReorderWaitingListInput;
}>;


export type ReorderWaitingListMutation = { __typename?: 'Mutation', reorderWaitingList: Array<{ __typename?: 'WaitingListEntry', id: string, patientId?: string | null, patientName: string, phone?: string | null, operatorId?: string | null, notes?: string | null, priority: number, position: number, status: WaitingListStatus, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> };

export type WaitingListEntryFieldsFragment = { __typename?: 'WaitingListEntry', id: string, patientId?: string | null, patientName: string, phone?: string | null, operatorId?: string | null, notes?: string | null, priority: number, position: number, status: WaitingListStatus, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null };

export type GetWaitingListEntriesQueryVariables = Exact<{
  status?: InputMaybe<WaitingListStatus>;
}>;


export type GetWaitingListEntriesQuery = { __typename?: 'Query', waitingListEntries: Array<{ __typename?: 'WaitingListEntry', id: string, patientId?: string | null, patientName: string, phone?: string | null, operatorId?: string | null, notes?: string | null, priority: number, position: number, status: WaitingListStatus, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> };

export type GetWaitingListEntryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetWaitingListEntryQuery = { __typename?: 'Query', waitingListEntry?: { __typename?: 'WaitingListEntry', id: string, patientId?: string | null, patientName: string, phone?: string | null, operatorId?: string | null, notes?: string | null, priority: number, position: number, status: WaitingListStatus, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null } | null };
