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
  JSONObject: { input: any; output: any; }
};

export type AnamnesisExam = {
  __typename?: 'AnamnesisExam';
  anamnesisId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Data dell'esame */
  data?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  /** Nome dell'esame diagnostico */
  nomeEsame: Scalars['String']['output'];
  /** Note/risultati dell'esame */
  note?: Maybe<Scalars['String']['output']>;
  /** Ordine di visualizzazione */
  orderIndex: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type AnamnesisExamInput = {
  data?: InputMaybe<Scalars['String']['input']>;
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  nomeEsame: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  orderIndex?: InputMaybe<Scalars['Int']['input']>;
};

export type AnamnesisObjective = {
  __typename?: 'AnamnesisObjective';
  anamnesisId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Data in cui l'obiettivo è stato raggiunto */
  dataRaggiungimento?: Maybe<Scalars['DateTime']['output']>;
  /** Descrizione dell'obiettivo */
  descrizione: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Ordine di visualizzazione */
  orderIndex: Scalars['Int']['output'];
  /** Obiettivo raggiunto */
  raggiunto: Scalars['Boolean']['output'];
  /** Tipo di obiettivo (breve, medio, lungo termine) */
  tipo: ObjectiveType;
  updatedAt: Scalars['DateTime']['output'];
};

export type AnamnesisObjectiveInput = {
  dataRaggiungimento?: InputMaybe<Scalars['String']['input']>;
  descrizione: Scalars['String']['input'];
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  orderIndex?: InputMaybe<Scalars['Int']['input']>;
  raggiunto?: InputMaybe<Scalars['Boolean']['input']>;
  tipo: ObjectiveType;
};

export type AnamnesisTest = {
  __typename?: 'AnamnesisTest';
  anamnesisId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Data di esecuzione del test */
  dataEsecuzione?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  /** Nome del test */
  nome: Scalars['String']['output'];
  /** Ordine di visualizzazione */
  orderIndex: Scalars['Int']['output'];
  /** Risultato del test */
  risultato?: Maybe<Scalars['String']['output']>;
  /** Sezione dell'anamnesi (esame obiettivo o monitoraggio) */
  sezione: TestSection;
  /** Test superato (null = non ancora valutato) */
  superato?: Maybe<Scalars['Boolean']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type AnamnesisTestInput = {
  dataEsecuzione?: InputMaybe<Scalars['String']['input']>;
  /** ID per update, null per create */
  id?: InputMaybe<Scalars['String']['input']>;
  nome: Scalars['String']['input'];
  orderIndex?: InputMaybe<Scalars['Int']['input']>;
  risultato?: InputMaybe<Scalars['String']['input']>;
  sezione: TestSection;
  superato?: InputMaybe<Scalars['Boolean']['input']>;
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

export type AssignTemplateToOperatorInput = {
  operatorId: Scalars['ID']['input'];
  patternGroupId: Scalars['ID']['input'];
  patternStartDate: Scalars['String']['input'];
  validFrom: Scalars['String']['input'];
  validUntil?: InputMaybe<Scalars['String']['input']>;
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
  endTime: Scalars['String']['output'];
  gymRoom?: Maybe<GymRoom>;
  gymRoomId?: Maybe<Scalars['ID']['output']>;
  hasConflict: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  instrumentOrderMatters: Scalars['Boolean']['output'];
  instruments?: Maybe<Array<AppointmentInstrument>>;
  isRecurring: Scalars['Boolean']['output'];
  isSubstitution: Scalars['Boolean']['output'];
  maxParticipants?: Maybe<Scalars['Int']['output']>;
  nonRetribuito: Scalars['Boolean']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  operatorNotes?: Maybe<Scalars['String']['output']>;
  originalOperator?: Maybe<Operator>;
  originalOperatorId?: Maybe<Scalars['ID']['output']>;
  participantCount: Scalars['Int']['output'];
  patientId?: Maybe<Scalars['Int']['output']>;
  recurringGroupId?: Maybe<Scalars['ID']['output']>;
  repeatConfig?: Maybe<Scalars['JSON']['output']>;
  service?: Maybe<Service>;
  /** @deprecated Usa appointmentServices invece */
  serviceId?: Maybe<Scalars['ID']['output']>;
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
  id: Scalars['String']['input'];
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
  defaultView: Scalars['String']['output'];
  endHour: Scalars['Int']['output'];
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
  TemplateChange = 'TEMPLATE_CHANGE'
}

/** Action to resolve appointment conflict */
export enum ConflictResolutionAction {
  Cancel = 'CANCEL',
  Keep = 'KEEP',
  Reschedule = 'RESCHEDULE'
}

export type ConflictStatsOutput = {
  __typename?: 'ConflictStatsOutput';
  byOperator: Array<OperatorConflictCount>;
  byReason: Scalars['JSONObject']['output'];
  totalConflicts: Scalars['Int']['output'];
};

export type CreateAnamnesisInput = {
  andamentoDolore?: InputMaybe<Scalars['String']['input']>;
  bmi?: InputMaybe<Scalars['Float']['input']>;
  bodyMapMarkers?: InputMaybe<Array<BodyMapMarkerInput>>;
  criticita?: InputMaybe<Array<Scalars['String']['input']>>;
  diagnosiFisioterapica?: InputMaybe<Scalars['String']['input']>;
  equilibrio?: InputMaybe<Scalars['String']['input']>;
  esameNeurologico?: InputMaybe<Scalars['String']['input']>;
  esordioSintomi?: InputMaybe<Scalars['String']['input']>;
  exams?: InputMaybe<Array<AnamnesisExamInput>>;
  fattoriAggravanti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriAllevianti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriPrognosticiNegativi?: InputMaybe<Scalars['String']['input']>;
  fattoriPrognosticiPositivi?: InputMaybe<Scalars['String']['input']>;
  forzaMuscolare?: InputMaybe<Scalars['String']['input']>;
  frequenzaSedute?: InputMaybe<Scalars['String']['input']>;
  interventiChirurgici?: InputMaybe<Scalars['String']['input']>;
  interventiProposti?: InputMaybe<Array<Scalars['String']['input']>>;
  limitazioniAttivita?: InputMaybe<Scalars['String']['input']>;
  motivoConsulto?: InputMaybe<Scalars['String']['input']>;
  movimentoAttivo?: InputMaybe<Scalars['String']['input']>;
  movimentoPassivo?: InputMaybe<Scalars['String']['input']>;
  objectives?: InputMaybe<Array<AnamnesisObjectiveInput>>;
  operatorId: Scalars['ID']['input'];
  osservazione?: InputMaybe<Scalars['String']['input']>;
  outcome?: InputMaybe<Scalars['String']['input']>;
  palpazione?: InputMaybe<Scalars['String']['input']>;
  patologiePregresse?: InputMaybe<Scalars['String']['input']>;
  professione?: InputMaybe<Scalars['String']['input']>;
  sportPraticati?: InputMaybe<Array<Scalars['String']['input']>>;
  statoAttualeSintomi?: InputMaybe<Scalars['String']['input']>;
  strategieCoping?: InputMaybe<Scalars['String']['input']>;
  terapiaFarmacologica?: InputMaybe<Array<Scalars['String']['input']>>;
  tests?: InputMaybe<Array<AnamnesisTestInput>>;
  therapeuticPathId: Scalars['ID']['input'];
  traumi?: InputMaybe<Scalars['String']['input']>;
};

export type CreateAvailabilityAppointmentInput = {
  appointmentDate: Scalars['String']['input'];
  clientEmail?: InputMaybe<Scalars['String']['input']>;
  clientName: Scalars['String']['input'];
  clientPhone?: InputMaybe<Scalars['String']['input']>;
  endTime: Scalars['String']['input'];
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  instruments?: InputMaybe<Array<AppointmentInstrumentInput>>;
  /** Appuntamento non retribuito (pausa pranzo, rappresentante, etc.) */
  nonRetribuito?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  patientId?: InputMaybe<Scalars['Int']['input']>;
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
  aggravatingFactors?: InputMaybe<Scalars['String']['input']>;
  chiefComplaint?: InputMaybe<Scalars['String']['input']>;
  conclusions?: InputMaybe<Scalars['String']['input']>;
  fieldValues?: InputMaybe<Scalars['JSON']['input']>;
  functionalAssessment?: InputMaybe<Scalars['String']['input']>;
  historyOfPresentIllness?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
  patientGoals?: InputMaybe<Scalars['String']['input']>;
  relievingFactors?: InputMaybe<Scalars['String']['input']>;
  templateId?: InputMaybe<Scalars['ID']['input']>;
  therapeuticPathId: Scalars['ID']['input'];
  therapistGoals?: InputMaybe<Scalars['String']['input']>;
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
  patientId?: InputMaybe<Scalars['Int']['input']>;
  repeatConfig?: InputMaybe<Scalars['JSON']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  /** Servizi da associare all'appuntamento */
  services?: InputMaybe<Array<ServiceInputItem>>;
  startTime: Scalars['String']['input'];
};

export type CreateGymExceptionInput = {
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionDate: Scalars['String']['input'];
  exceptionType: GymExceptionType;
  gymRoomId: Scalars['ID']['input'];
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  substituteOperatorId?: InputMaybe<Scalars['ID']['input']>;
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

export type CreateOperatorInput = {
  categoryId?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  legacyUserId?: InputMaybe<Scalars['Int']['input']>;
  macroCategory: OperatorMacroCategory;
  maxConcurrentAppointments?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  preferredDurations?: InputMaybe<Array<Scalars['Int']['input']>>;
  professionalRegistration?: InputMaybe<Scalars['String']['input']>;
  royaltyPercentage?: InputMaybe<Scalars['Float']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['Int']['input']>;
};

/** Input per creare un nuovo paziente */
export type CreatePatientInput = {
  /** Allergie */
  allergie?: InputMaybe<Scalars['String']['input']>;
  /** Paziente attivo */
  attivo?: InputMaybe<Scalars['Boolean']['input']>;
  /** Contatore disdette per anno. Formato: { "2025": 3 } */
  cancellationsByYear?: InputMaybe<Scalars['JSONObject']['input']>;
  /** CAP */
  cap?: InputMaybe<Scalars['String']['input']>;
  /** Cellulare */
  cellulare?: InputMaybe<Scalars['String']['input']>;
  /** Citta */
  citta?: InputMaybe<Scalars['String']['input']>;
  /** Codice Fiscale */
  codiceFiscale?: InputMaybe<Scalars['String']['input']>;
  /** Codice paziente interno */
  codicePaziente?: InputMaybe<Scalars['String']['input']>;
  /** Codice SDI per fatturazione elettronica */
  codiceSdi?: InputMaybe<Scalars['String']['input']>;
  /** Cognome (obbligatorio) */
  cognome: Scalars['String']['input'];
  /** Comune di nascita */
  comuneNascita?: InputMaybe<Scalars['String']['input']>;
  /** Consenso marketing */
  consensoMarketing?: InputMaybe<Scalars['Boolean']['input']>;
  /** Consenso privacy dato */
  consensoPrivacy?: InputMaybe<Scalars['Boolean']['input']>;
  /** Consenso ricerca medica */
  consensoRicercaMedica?: InputMaybe<Scalars['Boolean']['input']>;
  /** ID convenzione associata */
  convenzioneId?: InputMaybe<Scalars['Int']['input']>;
  /** Data consenso privacy */
  dataConsensoPrivacy?: InputMaybe<Scalars['DateTime']['input']>;
  /** Data di nascita */
  dataNascita?: InputMaybe<Scalars['DateTime']['input']>;
  /** Email */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Farmaci in uso */
  farmaciInUso?: InputMaybe<Scalars['String']['input']>;
  /** Fax */
  fax?: InputMaybe<Scalars['String']['input']>;
  /** Genere (obbligatorio) */
  genere: Genere;
  /** Gruppo sanguigno */
  gruppoSanguigno?: InputMaybe<Scalars['String']['input']>;
  /** Indirizzo */
  indirizzo?: InputMaybe<Scalars['String']['input']>;
  /** Luogo nascita estero */
  luogoNascitaEstero?: InputMaybe<Scalars['String']['input']>;
  /** Medico di base */
  medicoBase?: InputMaybe<Scalars['String']['input']>;
  /** Nazione di nascita (default: Italia) */
  nazioneNascita?: InputMaybe<Scalars['String']['input']>;
  /** Nazione residenza */
  nazioneResidenza?: InputMaybe<Scalars['String']['input']>;
  /** Contatore no-show per anno. Formato: { "2025": 2 } */
  noShowsByYear?: InputMaybe<Scalars['JSONObject']['input']>;
  /** Nome (obbligatorio) */
  nome: Scalars['String']['input'];
  /** Note amministrative */
  noteAmministrative?: InputMaybe<Scalars['String']['input']>;
  /** Note */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Patologie croniche */
  patologieCroniche?: InputMaybe<Scalars['String']['input']>;
  /** PEC */
  pec?: InputMaybe<Scalars['String']['input']>;
  /** Provincia */
  provincia?: InputMaybe<Scalars['String']['input']>;
  /** Stato anagrafica (default: BOZZA) */
  statoAnagrafica?: InputMaybe<StatoAnagrafica>;
  /** Stato civile */
  statoCivile?: InputMaybe<StatoCivile>;
  /** Stato privacy (default: NON_ACQUISITA) */
  statoPrivacy?: InputMaybe<StatoPrivacy>;
  /** Telefono fisso */
  telefono?: InputMaybe<Scalars['String']['input']>;
  /** Tipo paziente (obbligatorio) */
  tipoPaziente?: TipoPaziente;
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

export type CreateTherapeuticPathInput = {
  diagnosis?: InputMaybe<Scalars['String']['input']>;
  externalDoctorName?: InputMaybe<Scalars['String']['input']>;
  externalPrescriptionRef?: InputMaybe<Scalars['String']['input']>;
  icdCode?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  patientId: Scalars['Int']['input'];
  primaryOperatorId: Scalars['ID']['input'];
};

export type DailyAvailability = {
  __typename?: 'DailyAvailability';
  date: Scalars['String']['output'];
  hasAvailability: Scalars['Boolean']['output'];
  slots: Array<AvailabilitySlot>;
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

/** Genere del paziente */
export enum Genere {
  /** Altro */
  Altro = 'ALTRO',
  /** Femmina */
  Femmina = 'FEMMINA',
  /** Maschio */
  Maschio = 'MASCHIO',
  /** Non specificato */
  NonSpecificato = 'NON_SPECIFICATO'
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

export type GymException = {
  __typename?: 'GymException';
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  endTime?: Maybe<Scalars['String']['output']>;
  exceptionDate: Scalars['String']['output'];
  exceptionType: GymExceptionType;
  gymRoom: GymRoom;
  gymRoomId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  operator?: Maybe<Operator>;
  operatorId?: Maybe<Scalars['ID']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  startTime?: Maybe<Scalars['String']['output']>;
  substituteOperator?: Maybe<Operator>;
  substituteOperatorId?: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
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

export type GymSlotOperatorInfo = {
  __typename?: 'GymSlotOperatorInfo';
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

export type MarkObjectiveAchievedInput = {
  raggiunto: Scalars['Boolean']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  activateGymPatternGroup: GymPatternGroup;
  /** Anonymize patient data (irreversible GDPR compliance action) */
  anonymizePatient: PatientModel;
  assignServiceToOperator: OperatorService;
  assignTemplateToOperator: Array<TemplateAssignment>;
  cancelAppointmentWithNotice: AvailabilityAppointment;
  cancelAvailabilityAppointment: AvailabilityAppointment;
  closeTreatment: Treatment;
  completeTreatment: Treatment;
  confirmAvailabilityAppointment: AvailabilityAppointment;
  createAnamnesis: PatientAnamnesis;
  createAvailabilityAppointment: AvailabilityAppointment;
  createAvailabilityException: AvailabilityException;
  createAvailabilityTemplate: AvailabilityTemplate;
  createException: AvailabilityException;
  createGroupException: GroupException;
  createGymAppointment: AvailabilityAppointment;
  createGymException: GymException;
  createGymPatternGroup: GymPatternGroup;
  createGymRoom: GymRoom;
  createGymSchedule: GymSchedule;
  createInstrument: Instrument;
  createInstrumentCategory: InstrumentCategory;
  createOperator: Operator;
  createOperatorCategory: OperatorCategory;
  createPathDocument: PathDocument;
  /** Create a new patient record */
  createPatient: PatientModel;
  createPatientEvaluation: PatientEvaluation;
  createPatternGroup: PatternGroup;
  createRoom: Room;
  createService: Service;
  createServiceSubcategory: ServiceSubcategory;
  createSickLeave: Array<AvailabilityException>;
  createTemplatePattern: Array<TemplatePattern>;
  createTherapeuticPath: TherapeuticPath;
  createTreatment: Treatment;
  createVacation: Array<AvailabilityException>;
  deactivateAllTemplateAssignmentsForOperator: Scalars['Boolean']['output'];
  deactivateGymPatternGroup: GymPatternGroup;
  deactivateTemplateAssignment: TemplateAssignment;
  deleteAllTreatments: Scalars['Int']['output'];
  deleteAnamnesis: Scalars['Boolean']['output'];
  deleteAvailabilityAppointment: Scalars['Boolean']['output'];
  deleteAvailabilityTemplate: Scalars['Boolean']['output'];
  deleteException: Scalars['Boolean']['output'];
  deleteExceptionsByDateRange: Scalars['Int']['output'];
  deleteGeneralSetting: Scalars['Boolean']['output'];
  deleteGroupException: Scalars['Boolean']['output'];
  deleteGymException: Scalars['Boolean']['output'];
  deleteGymPatternGroup: Scalars['Boolean']['output'];
  deleteGymRoom: Scalars['Boolean']['output'];
  deleteGymSchedule: Scalars['Boolean']['output'];
  deleteHolidaysForYear: Scalars['Int']['output'];
  deleteInstrument: Scalars['Boolean']['output'];
  deleteInstrumentCategory: Scalars['Boolean']['output'];
  deleteOperator: Scalars['Boolean']['output'];
  deleteOperatorCategory: Scalars['Boolean']['output'];
  deletePathDocument: Scalars['Boolean']['output'];
  /** Delete patient (performs GDPR-compliant anonymization) */
  deletePatient: Scalars['Boolean']['output'];
  deletePatientEvaluation: Scalars['Boolean']['output'];
  deletePatternGroup: Scalars['Boolean']['output'];
  deleteRoom: Scalars['Boolean']['output'];
  deleteService: Scalars['Boolean']['output'];
  deleteServiceSubcategory: Scalars['Boolean']['output'];
  deleteTemplateAssignment: Scalars['Boolean']['output'];
  deleteTemplatePattern: Scalars['Boolean']['output'];
  deleteTherapeuticPath: Scalars['Boolean']['output'];
  deleteTreatment: Scalars['Boolean']['output'];
  duplicateGymPatternGroup: GymPatternGroup;
  generateHolidaysForOperator: Scalars['Int']['output'];
  generateHolidaysForYear: Scalars['Int']['output'];
  /** Update patient GDPR consent */
  grantGdprConsent: PatientModel;
  /** Increment appointment cancellations counter for current year */
  incrementCancellations: PatientModel;
  /** Increment no-show counter for current year */
  incrementNoShows: PatientModel;
  initializeDefaultSettings: Scalars['Boolean']['output'];
  markAppointmentAsNoShow: AvailabilityAppointment;
  markAppointmentAttended: AvailabilityAppointment;
  markAppointmentNoShow: AvailabilityAppointment;
  markObjectiveAchieved: AnamnesisObjective;
  markTreatmentInvoicedByOperator: Treatment;
  markTreatmentInvoicedToPatient: Treatment;
  rebuildAvailabilityCache: Scalars['Boolean']['output'];
  recordTreatmentPayment: Treatment;
  removeServiceFromOperator: Scalars['Boolean']['output'];
  reopenTreatment: Treatment;
  /** Request patient data deletion (GDPR Article 17 - Right to be Forgotten) */
  requestPatientDeletion: PatientModel;
  resolveAppointmentConflict: AvailabilityAppointment;
  resolveMultipleConflicts: Array<AvailabilityAppointment>;
  revertAppointmentAttended: AvailabilityAppointment;
  setInstrumentStatus: Instrument;
  setPatternGroupActive: PatternGroup;
  updateAnamnesis: PatientAnamnesis;
  updateAvailabilityAppointment: AvailabilityAppointment;
  updateAvailabilityTemplate: AvailabilityTemplate;
  updateException: AvailabilityException;
  updateGeneralSetting: GeneralSettings;
  updateGymException: GymException;
  updateGymPatternGroup: GymPatternGroup;
  updateGymRoom: GymRoom;
  updateGymSchedule: GymSchedule;
  updateInstrument: Instrument;
  updateInstrumentCategory: InstrumentCategory;
  updateOperator: Operator;
  updateOperatorCategory: OperatorCategory;
  updateOperatorService: OperatorService;
  /** Update an existing patient record */
  updatePatient: PatientModel;
  updatePatientEvaluation: PatientEvaluation;
  /** Update patient privacy documentation status */
  updatePatientPrivacyStatus: PatientModel;
  /** Update patient record status (workflow state) */
  updatePatientStatus: PatientModel;
  updatePatternGroup: PatternGroup;
  updatePatternGroupWithConflicts: PatternGroupUpdateOutput;
  updateRoom: Room;
  updateService: Service;
  updateServiceSubcategory: ServiceSubcategory;
  updateTemplateAssignment: TemplateAssignment;
  updateTemplatePattern: TemplatePattern;
  updateTestResult: AnamnesisTest;
  updateTherapeuticPath: TherapeuticPath;
  updateTreatment: Treatment;
  updateTreatmentInstruments: Treatment;
  upsertGeneralSetting: GeneralSettings;
};


export type MutationActivateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAnonymizePatientArgs = {
  id: Scalars['ID']['input'];
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


export type MutationCloseTreatmentArgs = {
  id: Scalars['ID']['input'];
  input: CloseTreatmentInput;
};


export type MutationCompleteTreatmentArgs = {
  id: Scalars['ID']['input'];
  input: CompleteTreatmentInput;
};


export type MutationConfirmAvailabilityAppointmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateAnamnesisArgs = {
  input: CreateAnamnesisInput;
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


export type MutationCreateOperatorArgs = {
  input: CreateOperatorInput;
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
  createPatientInput: CreatePatientInput;
};


export type MutationCreatePatientEvaluationArgs = {
  input: CreateEvaluationInput;
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
  discountFE?: InputMaybe<Scalars['Float']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  name: Scalars['String']['input'];
  preferredDuration?: InputMaybe<Scalars['Int']['input']>;
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


export type MutationCreateVacationArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};


export type MutationDeactivateAllTemplateAssignmentsForOperatorArgs = {
  operatorId: Scalars['ID']['input'];
};


export type MutationDeactivateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeactivateTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAnamnesisArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAvailabilityAppointmentArgs = {
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


export type MutationDeleteOperatorArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteOperatorCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePathDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePatientArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePatientEvaluationArgs = {
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


export type MutationDeleteServiceSubcategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplateAssignmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplatePatternArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTherapeuticPathArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTreatmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDuplicateGymPatternGroupArgs = {
  id: Scalars['ID']['input'];
  newName: Scalars['String']['input'];
};


export type MutationGenerateHolidaysForOperatorArgs = {
  operatorId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};


export type MutationGenerateHolidaysForYearArgs = {
  year: Scalars['Int']['input'];
};


export type MutationGrantGdprConsentArgs = {
  consensoGdpr: Scalars['Boolean']['input'];
  consensoMarketing?: InputMaybe<Scalars['Boolean']['input']>;
  consensoTerzi?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationIncrementCancellationsArgs = {
  id: Scalars['ID']['input'];
};


export type MutationIncrementNoShowsArgs = {
  id: Scalars['ID']['input'];
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


export type MutationMarkTreatmentInvoicedByOperatorArgs = {
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMarkTreatmentInvoicedToPatientArgs = {
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRebuildAvailabilityCacheArgs = {
  endDate: Scalars['String']['input'];
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
};


export type MutationRecordTreatmentPaymentArgs = {
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


export type MutationRequestPatientDeletionArgs = {
  id: Scalars['ID']['input'];
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


export type MutationRevertAppointmentAttendedArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSetInstrumentStatusArgs = {
  id: Scalars['ID']['input'];
  status: InstrumentStatus;
};


export type MutationSetPatternGroupActiveArgs = {
  id: Scalars['ID']['input'];
  isActive: Scalars['Boolean']['input'];
};


export type MutationUpdateAnamnesisArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAnamnesisInput;
};


export type MutationUpdateAvailabilityAppointmentArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAvailabilityAppointmentInput;
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


export type MutationUpdatePatientArgs = {
  id: Scalars['ID']['input'];
  updatePatientInput: UpdatePatientInput;
};


export type MutationUpdatePatientEvaluationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateEvaluationInput;
};


export type MutationUpdatePatientPrivacyStatusArgs = {
  id: Scalars['ID']['input'];
  status: Scalars['String']['input'];
};


export type MutationUpdatePatientStatusArgs = {
  id: Scalars['ID']['input'];
  status: Scalars['String']['input'];
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
  subcategoryId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateServiceSubcategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
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


export type MutationUpdateTreatmentInstrumentsArgs = {
  id: Scalars['ID']['input'];
  instruments: Array<TreatmentInstrumentInput>;
};


export type MutationUpsertGeneralSettingArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  value: Scalars['JSON']['input'];
  valueType?: InputMaybe<Scalars['String']['input']>;
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
  professionalRegistration?: Maybe<Scalars['String']['output']>;
  royaltyPercentage: Scalars['Float']['output'];
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

export type OperatorConflictCount = {
  __typename?: 'OperatorConflictCount';
  count: Scalars['Int']['output'];
  operatorId: Scalars['ID']['output'];
  operatorName: Scalars['String']['output'];
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

export type PatientAnamnesis = {
  __typename?: 'PatientAnamnesis';
  /** Andamento del dolore nel tempo */
  andamentoDolore?: Maybe<Scalars['String']['output']>;
  /** Body Mass Index */
  bmi?: Maybe<Scalars['Float']['output']>;
  /** Marker sulla mappa corporea */
  bodyMapMarkers?: Maybe<Array<BodyMapMarker>>;
  createdAt: Scalars['DateTime']['output'];
  /** Criticità identificate */
  criticita?: Maybe<Array<Scalars['String']['output']>>;
  /** Diagnosi fisioterapica */
  diagnosiFisioterapica?: Maybe<Scalars['String']['output']>;
  /** Valutazione equilibrio */
  equilibrio?: Maybe<Scalars['String']['output']>;
  /** Esame neurologico */
  esameNeurologico?: Maybe<Scalars['String']['output']>;
  /** Data/periodo esordio sintomi */
  esordioSintomi?: Maybe<Scalars['String']['output']>;
  exams?: Maybe<Array<AnamnesisExam>>;
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
  /** Interventi chirurgici precedenti */
  interventiChirurgici?: Maybe<Scalars['String']['output']>;
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
  objectives?: Maybe<Array<AnamnesisObjective>>;
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  /** Osservazione clinica */
  osservazione?: Maybe<Scalars['String']['output']>;
  /** Outcome atteso/pianificato */
  outcome?: Maybe<Scalars['String']['output']>;
  /** Palpazione */
  palpazione?: Maybe<Scalars['String']['output']>;
  /** Patologie pregresse */
  patologiePregresse?: Maybe<Scalars['String']['output']>;
  /** Professione del paziente */
  professione?: Maybe<Scalars['String']['output']>;
  /** Sport praticati dal paziente */
  sportPraticati?: Maybe<Array<Scalars['String']['output']>>;
  /** Stato attuale dei sintomi */
  statoAttualeSintomi?: Maybe<Scalars['String']['output']>;
  /** Strategie di coping del paziente */
  strategieCoping?: Maybe<Scalars['String']['output']>;
  /** Farmaci in uso */
  terapiaFarmacologica?: Maybe<Array<Scalars['String']['output']>>;
  tests?: Maybe<Array<AnamnesisTest>>;
  therapeuticPath: TherapeuticPath;
  therapeuticPathId: Scalars['ID']['output'];
  /** Traumi precedenti */
  traumi?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type PatientEvaluation = {
  __typename?: 'PatientEvaluation';
  /** Fattori aggravanti */
  aggravatingFactors?: Maybe<Scalars['String']['output']>;
  /** Motivo della visita */
  chiefComplaint?: Maybe<Scalars['String']['output']>;
  /** Conclusioni della valutazione */
  conclusions?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  /** Dynamic field values from template (JSON) */
  fieldValues?: Maybe<Scalars['JSON']['output']>;
  /** Valutazione funzionale */
  functionalAssessment?: Maybe<Scalars['String']['output']>;
  /** Storia della malattia attuale */
  historyOfPresentIllness?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  /** Obiettivi del paziente */
  patientGoals?: Maybe<Scalars['String']['output']>;
  /** Fattori allevianti */
  relievingFactors?: Maybe<Scalars['String']['output']>;
  /** Template ID for dynamic forms (future use) */
  templateId?: Maybe<Scalars['ID']['output']>;
  therapeuticPath: TherapeuticPath;
  therapeuticPathId: Scalars['ID']['output'];
  /** Obiettivi del terapista */
  therapistGoals?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

/** Anagrafica paziente completa */
export type PatientModel = {
  __typename?: 'PatientModel';
  /** Allergie */
  allergie?: Maybe<Scalars['String']['output']>;
  /** Paziente attivo */
  attivo: Scalars['Boolean']['output'];
  /** Can create appointments (based on status) */
  canCreateAppuntamento: Scalars['Boolean']['output'];
  /** Contatore disdette per anno. Formato: { "2025": 3, "2024": 1 } */
  cancellationsByYear?: Maybe<Scalars['JSONObject']['output']>;
  /** CAP */
  cap?: Maybe<Scalars['String']['output']>;
  /** Cellulare */
  cellulare?: Maybe<Scalars['String']['output']>;
  /** Citta */
  citta?: Maybe<Scalars['String']['output']>;
  /** Codice Fiscale */
  codiceFiscale?: Maybe<Scalars['String']['output']>;
  /** Codice paziente interno */
  codicePaziente?: Maybe<Scalars['String']['output']>;
  /** Codice SDI */
  codiceSdi?: Maybe<Scalars['String']['output']>;
  /** Cognome */
  cognome: Scalars['String']['output'];
  /** Comune di nascita */
  comuneNascita?: Maybe<Scalars['String']['output']>;
  /** Consenso marketing */
  consensoMarketing: Scalars['Boolean']['output'];
  /** Consenso privacy dato */
  consensoPrivacy: Scalars['Boolean']['output'];
  /** Consenso ricerca medica */
  consensoRicercaMedica: Scalars['Boolean']['output'];
  /** Conservazione dati fino a */
  conservazioneFino?: Maybe<Scalars['DateTime']['output']>;
  /** ID convenzione associata */
  convenzioneId?: Maybe<Scalars['Int']['output']>;
  /** Data creazione */
  createdAt: Scalars['DateTime']['output'];
  /** Data anonimizzazione */
  dataAnonimizzazione?: Maybe<Scalars['DateTime']['output']>;
  /** Data consenso privacy */
  dataConsensoPrivacy?: Maybe<Scalars['DateTime']['output']>;
  /** Data di nascita */
  dataNascita?: Maybe<Scalars['DateTime']['output']>;
  /** Data richiesta cancellazione */
  dataRichiestaCancellazione?: Maybe<Scalars['DateTime']['output']>;
  /** Data ultima modifica privacy */
  dataUltimaModificaPrivacy?: Maybe<Scalars['DateTime']['output']>;
  /** Email */
  email?: Maybe<Scalars['String']['output']>;
  /** Eta calcolata dalla data di nascita */
  eta?: Maybe<Scalars['Int']['output']>;
  /** Farmaci in uso */
  farmaciInUso?: Maybe<Scalars['String']['output']>;
  /** Fax */
  fax?: Maybe<Scalars['String']['output']>;
  /** Genere */
  genere: Genere;
  /** Gruppo sanguigno */
  gruppoSanguigno?: Maybe<Scalars['String']['output']>;
  /** All required GDPR consents given */
  hasAllConsensi: Scalars['Boolean']['output'];
  /** Has at least one contact method (phone/email) */
  hasContattoTelefonico: Scalars['Boolean']['output'];
  /** ID univoco paziente */
  id: Scalars['ID']['output'];
  /** Indirizzo */
  indirizzo?: Maybe<Scalars['String']['output']>;
  /** Has minimum required data for appointment creation */
  isAnagraficaMinima: Scalars['Boolean']['output'];
  /** Privacy documents complete */
  isPrivacyCompleta: Scalars['Boolean']['output'];
  /** Luogo nascita estero */
  luogoNascitaEstero?: Maybe<Scalars['String']['output']>;
  /** Medico di base */
  medicoBase?: Maybe<Scalars['String']['output']>;
  /** Nazione di nascita (default: Italia) */
  nazioneNascita?: Maybe<Scalars['String']['output']>;
  /** Nazione residenza */
  nazioneResidenza?: Maybe<Scalars['String']['output']>;
  /** Contatore no-show per anno. Formato: { "2025": 2, "2024": 0 } */
  noShowsByYear?: Maybe<Scalars['JSONObject']['output']>;
  /** Nome */
  nome: Scalars['String']['output'];
  /** Nome completo (nome + cognome) */
  nomeCompleto: Scalars['String']['output'];
  /** Note amministrative */
  noteAmministrative?: Maybe<Scalars['String']['output']>;
  /** Note */
  notes?: Maybe<Scalars['String']['output']>;
  /** Patologie croniche */
  patologieCroniche?: Maybe<Scalars['String']['output']>;
  /** PEC */
  pec?: Maybe<Scalars['String']['output']>;
  /** Provincia */
  provincia?: Maybe<Scalars['String']['output']>;
  /** Richiesta cancellazione GDPR */
  richiestaCancellazione: Scalars['Boolean']['output'];
  /** Stato anagrafica (BOZZA, PARZIALE, COMPLETA, DA_VERIFICARE) */
  statoAnagrafica: StatoAnagrafica;
  /** Stato civile */
  statoCivile?: Maybe<StatoCivile>;
  /** Stato privacy (NON_ACQUISITA, CARTACEA, DIGITALE, MISTA) */
  statoPrivacy: StatoPrivacy;
  /** Telefono fisso */
  telefono?: Maybe<Scalars['String']['output']>;
  /** Tipo paziente (adulto, minore, con tutore, etc.) */
  tipoPaziente: TipoPaziente;
  /** Data ultima modifica */
  updatedAt: Scalars['DateTime']['output'];
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
  activeTherapeuticPathsByPatient: Array<TherapeuticPath>;
  allOperatorServices: Array<OperatorService>;
  allTemplatePatterns: Array<TemplatePattern>;
  anamnesisByPath?: Maybe<PatientAnamnesis>;
  availabilityAppointment?: Maybe<AvailabilityAppointment>;
  availabilityAppointments: Array<AvailabilityAppointment>;
  availabilityAppointmentsByOperator: Array<AvailabilityAppointment>;
  availabilityException?: Maybe<AvailabilityException>;
  availabilityExceptions: Array<AvailabilityException>;
  availabilityTemplates: Array<AvailabilityTemplate>;
  availableInstrumentsByCategory: Array<Instrument>;
  availableSlots: Array<AvailabilitySlot>;
  calendarSettings: CalendarSettings;
  checkDuplicateOperator: Array<Operator>;
  checkSlotAvailability: Scalars['Boolean']['output'];
  conflictStats: ConflictStatsOutput;
  conflictedAppointments: Array<AvailabilityAppointment>;
  conflictedAppointmentsCount: Scalars['Int']['output'];
  currentGymPatternGroup?: Maybe<GymPatternGroup>;
  currentTemplateAssignments: Array<TemplateAssignment>;
  documentsByPath: Array<PathDocument>;
  documentsByPathAndCategory: Array<PathDocument>;
  evaluationsByPath: Array<PatientEvaluation>;
  examsByAnamnesis: Array<AnamnesisExam>;
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
  gymSchedule?: Maybe<GymSchedule>;
  gymSchedules: Array<GymSchedule>;
  gymSchedulesByRoomAndDay: Array<GymSchedule>;
  holidays: Array<HolidayInfo>;
  instrument?: Maybe<Instrument>;
  instrumentCategories: Array<InstrumentCategory>;
  instrumentCategory?: Maybe<InstrumentCategory>;
  instruments: Array<Instrument>;
  isHoliday: Scalars['Boolean']['output'];
  isInstrumentAvailable: Scalars['Boolean']['output'];
  objectivesByAnamnesis: Array<AnamnesisObjective>;
  objectivesProgress: ObjectivesProgress;
  operator?: Maybe<Operator>;
  operatorAvailability: Array<DailyAvailability>;
  operatorCategories: Array<OperatorCategory>;
  operatorCategory?: Maybe<OperatorCategory>;
  operatorExceptions: Array<AvailabilityException>;
  operatorServices: Array<OperatorService>;
  operators: Array<Operator>;
  pathDocument?: Maybe<PathDocument>;
  /** Get a single patient by ID */
  patient?: Maybe<PatientModel>;
  patientAnamnesis?: Maybe<PatientAnamnesis>;
  /** Find patient by Italian tax code (Codice Fiscale) */
  patientByCodiceFiscale?: Maybe<PatientModel>;
  /** Find patient by email address */
  patientByEmail?: Maybe<PatientModel>;
  patientEvaluation?: Maybe<PatientEvaluation>;
  /** Get all patients with optional pagination */
  patients: Array<PatientModel>;
  /** Find patients by phone number (partial match) */
  patientsByPhone: Array<PatientModel>;
  /** Get patients filtered by anagrafica status */
  patientsByStatus: Array<PatientModel>;
  /** Get total count of patients */
  patientsCount: Scalars['Int']['output'];
  /** Get patients with incomplete privacy documentation */
  patientsRequiringPrivacyUpdate: Array<PatientModel>;
  patternGroup?: Maybe<PatternGroup>;
  patternGroups: Array<PatternGroup>;
  physiotherapistAvailableSlots: Array<PhysiotherapistSlotOutput>;
  room?: Maybe<Room>;
  rooms: Array<Room>;
  /** Search patients with various filters and pagination */
  searchPatients: Array<PatientModel>;
  service?: Maybe<Service>;
  serviceOperators: Array<OperatorService>;
  serviceSubcategories: Array<ServiceSubcategory>;
  serviceSubcategory?: Maybe<ServiceSubcategory>;
  services: Array<Service>;
  templateAssignment?: Maybe<TemplateAssignment>;
  templateAssignments: Array<TemplateAssignment>;
  templateAssignmentsByOperator: Array<TemplateAssignment>;
  testsByAnamnesis: Array<AnamnesisTest>;
  testsProgress: TestsProgress;
  therapeuticPath?: Maybe<TherapeuticPath>;
  therapeuticPathsByOperator: Array<TherapeuticPath>;
  therapeuticPathsByPatient: Array<TherapeuticPath>;
  treatment?: Maybe<Treatment>;
  treatmentByAppointment?: Maybe<Treatment>;
  treatmentsByOperator: Array<Treatment>;
  treatmentsByPatient: Array<Treatment>;
  treatmentsByTherapeuticPath: Array<Treatment>;
  treatmentsNotInvoicedByOperator: Array<Treatment>;
  treatmentsNotInvoicedToPatient: Array<Treatment>;
  treatmentsPendingClosure: Array<Treatment>;
};


export type QueryActiveTherapeuticPathsByPatientArgs = {
  patientId: Scalars['Int']['input'];
};


export type QueryAnamnesisByPathArgs = {
  pathId: Scalars['ID']['input'];
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


export type QueryEvaluationsByPathArgs = {
  pathId: Scalars['ID']['input'];
};


export type QueryExamsByAnamnesisArgs = {
  anamnesisId: Scalars['ID']['input'];
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


export type QueryIsInstrumentAvailableArgs = {
  appointmentDate: Scalars['String']['input'];
  endOffsetMinutes: Scalars['Float']['input'];
  excludeAppointmentId?: InputMaybe<Scalars['ID']['input']>;
  instrumentId: Scalars['ID']['input'];
  startOffsetMinutes: Scalars['Float']['input'];
  startTime: Scalars['String']['input'];
};


export type QueryObjectivesByAnamnesisArgs = {
  anamnesisId: Scalars['ID']['input'];
};


export type QueryObjectivesProgressArgs = {
  anamnesisId: Scalars['ID']['input'];
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


export type QueryPathDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientAnamnesisArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientByCodiceFiscaleArgs = {
  codiceFiscale: Scalars['String']['input'];
};


export type QueryPatientByEmailArgs = {
  email: Scalars['String']['input'];
};


export type QueryPatientEvaluationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPatientsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPatientsByPhoneArgs = {
  phone: Scalars['String']['input'];
};


export type QueryPatientsByStatusArgs = {
  status: Scalars['String']['input'];
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


export type QuerySearchPatientsArgs = {
  searchInput: SearchPatientInput;
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


export type QueryTestsByAnamnesisArgs = {
  anamnesisId: Scalars['ID']['input'];
};


export type QueryTestsProgressArgs = {
  anamnesisId: Scalars['ID']['input'];
};


export type QueryTherapeuticPathArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTherapeuticPathsByOperatorArgs = {
  operatorId: Scalars['ID']['input'];
};


export type QueryTherapeuticPathsByPatientArgs = {
  patientId: Scalars['Int']['input'];
};


export type QueryTreatmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTreatmentByAppointmentArgs = {
  appointmentId: Scalars['ID']['input'];
};


export type QueryTreatmentsByOperatorArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  operatorId: Scalars['ID']['input'];
};


export type QueryTreatmentsByPatientArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  patientId: Scalars['Int']['input'];
};


export type QueryTreatmentsByTherapeuticPathArgs = {
  therapeuticPathId: Scalars['ID']['input'];
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

export type RecordPaymentInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  collectedBy: Scalars['ID']['input'];
  paymentMethod: PaymentMethod;
};

/** Modalità di fine ricorrenza */
export enum RecurringEndType {
  After = 'AFTER',
  Never = 'NEVER',
  Until = 'UNTIL'
}

/** Tipo di ricorrenza per appuntamenti */
export enum RecurringType {
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

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

/** Input per ricerca/filtro pazienti */
export type SearchPatientInput = {
  /** Ricerca per codice fiscale (match esatto) */
  codiceFiscale?: InputMaybe<Scalars['String']['input']>;
  /** Ricerca per cognome (match parziale) */
  cognome?: InputMaybe<Scalars['String']['input']>;
  /** Filtra per consenso marketing */
  consensoMarketing?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filtra per consenso privacy */
  consensoPrivacy?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filtra per data nascita massima */
  dataNascitaMax?: InputMaybe<Scalars['DateTime']['input']>;
  /** Filtra per data nascita minima */
  dataNascitaMin?: InputMaybe<Scalars['DateTime']['input']>;
  /** Ricerca per email (match parziale) */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Filtra per genere */
  genere?: InputMaybe<Genere>;
  /** Numero elementi per pagina (default: 20, max: 100) */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filtra per età massima */
  maxAge?: InputMaybe<Scalars['Float']['input']>;
  /** Filtra per età minima */
  minAge?: InputMaybe<Scalars['Float']['input']>;
  /** Ricerca per nome (match parziale) */
  nome?: InputMaybe<Scalars['String']['input']>;
  /** Ricerca per nome completo (match parziale) */
  nomeCompleto?: InputMaybe<Scalars['String']['input']>;
  /** Offset pagina (default: 0) */
  offset?: InputMaybe<Scalars['Int']['input']>;
  /** Filtra pazienti con richiesta cancellazione */
  richiestaCancellazione?: InputMaybe<Scalars['Boolean']['input']>;
  /** Campo ordinamento (cognome, nome, dataNascita, createdAt) */
  sortBy?: InputMaybe<Scalars['String']['input']>;
  /** Direzione ordinamento (ASC o DESC) */
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  /** Filtra per stato anagrafica */
  statoAnagrafica?: InputMaybe<StatoAnagrafica>;
  /** Filtra per stato privacy */
  statoPrivacy?: InputMaybe<StatoPrivacy>;
  /** Ricerca per telefono (match parziale) */
  telefono?: InputMaybe<Scalars['String']['input']>;
  /** Filtra per tipo paziente */
  tipoPaziente?: InputMaybe<TipoPaziente>;
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
  subcategory?: Maybe<ServiceSubcategory>;
  subcategoryId?: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type ServiceInputItem = {
  /** Durata personalizzata in minuti (override del default) */
  customDuration?: InputMaybe<Scalars['Int']['input']>;
  /** Prezzo personalizzato (override del default) */
  customPrice?: InputMaybe<Scalars['Float']['input']>;
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

/** Stato di completamento anagrafica paziente */
export enum StatoAnagrafica {
  /** Bozza - Solo dati minimi da telefono */
  Bozza = 'BOZZA',
  /** Completa - Anagrafica + privacy + fatturazione */
  Completa = 'COMPLETA',
  /** Da verificare - Necessita controllo dati */
  DaVerificare = 'DA_VERIFICARE',
  /** Parziale - Anagrafica completa ma manca privacy */
  Parziale = 'PARZIALE'
}

/** Stato civile del paziente */
export enum StatoCivile {
  /** Celibe/Nubile */
  CelibeNubile = 'CELIBE_NUBILE',
  /** Coniugato/a */
  Coniugato = 'CONIUGATO',
  /** Divorziato/a */
  Divorziato = 'DIVORZIATO',
  /** Separato/a */
  Separato = 'SEPARATO',
  /** Unione civile */
  UnioneCivile = 'UNIONE_CIVILE',
  /** Vedovo/a */
  Vedovo = 'VEDOVO'
}

/** Stato acquisizione documenti privacy */
export enum StatoPrivacy {
  /** Cartacea - Documenti fisici archiviati */
  Cartacea = 'CARTACEA',
  /** Digitale - Documenti digitali firmati */
  Digitale = 'DIGITALE',
  /** Mista - Alcuni cartacei, alcuni digitali */
  Mista = 'MISTA',
  /** Non acquisita - Nessun documento firmato */
  NonAcquisita = 'NON_ACQUISITA'
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

/** Sezione dell'anamnesi in cui si trova il test */
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
  diagnosis?: Maybe<Scalars['String']['output']>;
  documents?: Maybe<Array<PathDocument>>;
  evaluations?: Maybe<Array<PatientEvaluation>>;
  externalDoctorName?: Maybe<Scalars['String']['output']>;
  externalPrescriptionRef?: Maybe<Scalars['String']['output']>;
  icdCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  patient: PatientModel;
  patientId: Scalars['Int']['output'];
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

/** Tipo di paziente per gestione consensi */
export enum TipoPaziente {
  /** Adulto autonomo - può fornire consenso in autonomia */
  AdultoAutonomo = 'ADULTO_AUTONOMO',
  /** Anziano con tutore/amministratore di sostegno */
  AnzianoConTutore = 'ANZIANO_CON_TUTORE',
  /** Disabile con tutore legale nominato */
  DisabileConTutore = 'DISABILE_CON_TUTORE',
  /** Minorenne - richiede consenso genitori/tutore */
  Minorenne = 'MINORENNE'
}

export type Treatment = {
  __typename?: 'Treatment';
  appointment: AvailabilityAppointment;
  appointmentId: Scalars['ID']['output'];
  clinicalNotes?: Maybe<Scalars['String']['output']>;
  closedAt?: Maybe<Scalars['DateTime']['output']>;
  collectedBy?: Maybe<Scalars['ID']['output']>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  instruments?: Maybe<Array<TreatmentInstrument>>;
  invoicedByOperatorAt?: Maybe<Scalars['DateTime']['output']>;
  invoicedToPatientAt?: Maybe<Scalars['DateTime']['output']>;
  isInvoicedByOperator: Scalars['Boolean']['output'];
  isInvoicedToPatient: Scalars['Boolean']['output'];
  isPaid: Scalars['Boolean']['output'];
  isTest: Scalars['Boolean']['output'];
  operator: Operator;
  operatorId: Scalars['ID']['output'];
  operatorInvoiceNumber?: Maybe<Scalars['String']['output']>;
  operatorNotes?: Maybe<Scalars['String']['output']>;
  paidAt?: Maybe<Scalars['DateTime']['output']>;
  painAfter?: Maybe<Scalars['Int']['output']>;
  painBefore?: Maybe<Scalars['Int']['output']>;
  painLevel?: Maybe<Scalars['Int']['output']>;
  patient?: Maybe<PatientModel>;
  patientId?: Maybe<Scalars['Int']['output']>;
  patientInvoiceNumber?: Maybe<Scalars['String']['output']>;
  patientNotes?: Maybe<Scalars['String']['output']>;
  paymentMethod?: Maybe<PaymentMethod>;
  price: Scalars['Float']['output'];
  rescheduleRequested?: Maybe<Scalars['Boolean']['output']>;
  reschedulingNotes?: Maybe<Scalars['String']['output']>;
  reschedulingType?: Maybe<Scalars['String']['output']>;
  scontoFE: Scalars['Boolean']['output'];
  secretaryNotes?: Maybe<Scalars['String']['output']>;
  service?: Maybe<Service>;
  /** @deprecated Usa treatmentServices invece */
  serviceId?: Maybe<Scalars['ID']['output']>;
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

export type TreatmentInstrument = {
  __typename?: 'TreatmentInstrument';
  categoryName?: Maybe<Scalars['String']['output']>;
  endOffsetMinutes: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  instrument?: Maybe<Instrument>;
  instrumentCategory?: Maybe<InstrumentCategory>;
  instrumentCategoryId?: Maybe<Scalars['ID']['output']>;
  instrumentId: Scalars['ID']['output'];
  instrumentName?: Maybe<Scalars['String']['output']>;
  orderPosition?: Maybe<Scalars['Int']['output']>;
  startOffsetMinutes: Scalars['Int']['output'];
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

export type TreatmentService = {
  __typename?: 'TreatmentService';
  createdAt: Scalars['DateTime']['output'];
  duration?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
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

export type UpdateAnamnesisInput = {
  andamentoDolore?: InputMaybe<Scalars['String']['input']>;
  bmi?: InputMaybe<Scalars['Float']['input']>;
  bodyMapMarkers?: InputMaybe<Array<BodyMapMarkerInput>>;
  criticita?: InputMaybe<Array<Scalars['String']['input']>>;
  diagnosiFisioterapica?: InputMaybe<Scalars['String']['input']>;
  equilibrio?: InputMaybe<Scalars['String']['input']>;
  esameNeurologico?: InputMaybe<Scalars['String']['input']>;
  esordioSintomi?: InputMaybe<Scalars['String']['input']>;
  exams?: InputMaybe<Array<AnamnesisExamInput>>;
  fattoriAggravanti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriAllevianti?: InputMaybe<Array<Scalars['String']['input']>>;
  fattoriPrognosticiNegativi?: InputMaybe<Scalars['String']['input']>;
  fattoriPrognosticiPositivi?: InputMaybe<Scalars['String']['input']>;
  forzaMuscolare?: InputMaybe<Scalars['String']['input']>;
  frequenzaSedute?: InputMaybe<Scalars['String']['input']>;
  interventiChirurgici?: InputMaybe<Scalars['String']['input']>;
  interventiProposti?: InputMaybe<Array<Scalars['String']['input']>>;
  limitazioniAttivita?: InputMaybe<Scalars['String']['input']>;
  motivoConsulto?: InputMaybe<Scalars['String']['input']>;
  movimentoAttivo?: InputMaybe<Scalars['String']['input']>;
  movimentoPassivo?: InputMaybe<Scalars['String']['input']>;
  objectives?: InputMaybe<Array<AnamnesisObjectiveInput>>;
  osservazione?: InputMaybe<Scalars['String']['input']>;
  outcome?: InputMaybe<Scalars['String']['input']>;
  palpazione?: InputMaybe<Scalars['String']['input']>;
  patologiePregresse?: InputMaybe<Scalars['String']['input']>;
  professione?: InputMaybe<Scalars['String']['input']>;
  sportPraticati?: InputMaybe<Array<Scalars['String']['input']>>;
  statoAttualeSintomi?: InputMaybe<Scalars['String']['input']>;
  strategieCoping?: InputMaybe<Scalars['String']['input']>;
  terapiaFarmacologica?: InputMaybe<Array<Scalars['String']['input']>>;
  tests?: InputMaybe<Array<AnamnesisTestInput>>;
  traumi?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAvailabilityAppointmentInput = {
  appointmentDate?: InputMaybe<Scalars['String']['input']>;
  bookingStatus?: InputMaybe<BookingStatus>;
  cancellationReason?: InputMaybe<Scalars['String']['input']>;
  clientEmail?: InputMaybe<Scalars['String']['input']>;
  clientName?: InputMaybe<Scalars['String']['input']>;
  clientPhone?: InputMaybe<Scalars['String']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  instrumentOrderMatters?: InputMaybe<Scalars['Boolean']['input']>;
  instruments?: InputMaybe<Array<AppointmentInstrumentInput>>;
  /** Appuntamento non retribuito (pausa pranzo, rappresentante, etc.) */
  nonRetribuito?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  operatorNotes?: InputMaybe<Scalars['String']['input']>;
  patientId?: InputMaybe<Scalars['Int']['input']>;
  serviceId?: InputMaybe<Scalars['ID']['input']>;
  /** Servizi da associare all'appuntamento */
  services?: InputMaybe<Array<ServiceInputItem>>;
  startTime?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateEvaluationInput = {
  aggravatingFactors?: InputMaybe<Scalars['String']['input']>;
  chiefComplaint?: InputMaybe<Scalars['String']['input']>;
  conclusions?: InputMaybe<Scalars['String']['input']>;
  fieldValues?: InputMaybe<Scalars['JSON']['input']>;
  functionalAssessment?: InputMaybe<Scalars['String']['input']>;
  historyOfPresentIllness?: InputMaybe<Scalars['String']['input']>;
  patientGoals?: InputMaybe<Scalars['String']['input']>;
  relievingFactors?: InputMaybe<Scalars['String']['input']>;
  therapistGoals?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateGymExceptionInput = {
  endTime?: InputMaybe<Scalars['String']['input']>;
  exceptionDate?: InputMaybe<Scalars['String']['input']>;
  exceptionType?: InputMaybe<GymExceptionType>;
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  substituteOperatorId?: InputMaybe<Scalars['ID']['input']>;
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
  professionalRegistration?: InputMaybe<Scalars['String']['input']>;
  royaltyPercentage?: InputMaybe<Scalars['Float']['input']>;
  surname?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['Int']['input']>;
};

/** Input for updating an existing patient (all fields optional) */
export type UpdatePatientInput = {
  /** Allergie */
  allergie?: InputMaybe<Scalars['String']['input']>;
  /** Paziente attivo */
  attivo?: InputMaybe<Scalars['Boolean']['input']>;
  /** Contatore disdette per anno. Formato: { "2025": 3 } */
  cancellationsByYear?: InputMaybe<Scalars['JSONObject']['input']>;
  /** CAP */
  cap?: InputMaybe<Scalars['String']['input']>;
  /** Cellulare */
  cellulare?: InputMaybe<Scalars['String']['input']>;
  /** Citta */
  citta?: InputMaybe<Scalars['String']['input']>;
  /** Codice Fiscale */
  codiceFiscale?: InputMaybe<Scalars['String']['input']>;
  /** Codice paziente interno */
  codicePaziente?: InputMaybe<Scalars['String']['input']>;
  /** Codice SDI per fatturazione elettronica */
  codiceSdi?: InputMaybe<Scalars['String']['input']>;
  /** Cognome (obbligatorio) */
  cognome?: InputMaybe<Scalars['String']['input']>;
  /** Comune di nascita */
  comuneNascita?: InputMaybe<Scalars['String']['input']>;
  /** Consenso marketing */
  consensoMarketing?: InputMaybe<Scalars['Boolean']['input']>;
  /** Consenso privacy dato */
  consensoPrivacy?: InputMaybe<Scalars['Boolean']['input']>;
  /** Consenso ricerca medica */
  consensoRicercaMedica?: InputMaybe<Scalars['Boolean']['input']>;
  /** ID convenzione associata */
  convenzioneId?: InputMaybe<Scalars['Int']['input']>;
  /** Data consenso privacy */
  dataConsensoPrivacy?: InputMaybe<Scalars['DateTime']['input']>;
  /** Data di nascita */
  dataNascita?: InputMaybe<Scalars['DateTime']['input']>;
  /** Email */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Farmaci in uso */
  farmaciInUso?: InputMaybe<Scalars['String']['input']>;
  /** Fax */
  fax?: InputMaybe<Scalars['String']['input']>;
  /** Genere (obbligatorio) */
  genere?: InputMaybe<Genere>;
  /** Gruppo sanguigno */
  gruppoSanguigno?: InputMaybe<Scalars['String']['input']>;
  /** Indirizzo */
  indirizzo?: InputMaybe<Scalars['String']['input']>;
  /** Luogo nascita estero */
  luogoNascitaEstero?: InputMaybe<Scalars['String']['input']>;
  /** Medico di base */
  medicoBase?: InputMaybe<Scalars['String']['input']>;
  /** Nazione di nascita (default: Italia) */
  nazioneNascita?: InputMaybe<Scalars['String']['input']>;
  /** Nazione residenza */
  nazioneResidenza?: InputMaybe<Scalars['String']['input']>;
  /** Contatore no-show per anno. Formato: { "2025": 2 } */
  noShowsByYear?: InputMaybe<Scalars['JSONObject']['input']>;
  /** Nome (obbligatorio) */
  nome?: InputMaybe<Scalars['String']['input']>;
  /** Note amministrative */
  noteAmministrative?: InputMaybe<Scalars['String']['input']>;
  /** Note */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Patologie croniche */
  patologieCroniche?: InputMaybe<Scalars['String']['input']>;
  /** PEC */
  pec?: InputMaybe<Scalars['String']['input']>;
  /** Provincia */
  provincia?: InputMaybe<Scalars['String']['input']>;
  /** Stato anagrafica (default: BOZZA) */
  statoAnagrafica?: InputMaybe<StatoAnagrafica>;
  /** Stato civile */
  statoCivile?: InputMaybe<StatoCivile>;
  /** Stato privacy (default: NON_ACQUISITA) */
  statoPrivacy?: InputMaybe<StatoPrivacy>;
  /** Telefono fisso */
  telefono?: InputMaybe<Scalars['String']['input']>;
  /** Tipo paziente (obbligatorio) */
  tipoPaziente?: InputMaybe<TipoPaziente>;
};

export type UpdatePatternGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  patternDuration?: InputMaybe<Scalars['Float']['input']>;
  patterns?: InputMaybe<Array<PatternInput>>;
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

export type CreateAvailabilityAppointmentMutationVariables = Exact<{
  input: CreateAvailabilityAppointmentInput;
}>;


export type CreateAvailabilityAppointmentMutation = { __typename?: 'Mutation', createAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type UpdateAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAvailabilityAppointmentInput;
}>;


export type UpdateAvailabilityAppointmentMutation = { __typename?: 'Mutation', updateAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type CancelAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  cancellationReason?: InputMaybe<Scalars['String']['input']>;
}>;


export type CancelAvailabilityAppointmentMutation = { __typename?: 'Mutation', cancelAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type DeleteAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAvailabilityAppointmentMutation = { __typename?: 'Mutation', deleteAvailabilityAppointment: boolean };

export type ConfirmAvailabilityAppointmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ConfirmAvailabilityAppointmentMutation = { __typename?: 'Mutation', confirmAvailabilityAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type MarkAppointmentAsNoShowMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkAppointmentAsNoShowMutation = { __typename?: 'Mutation', markAppointmentAsNoShow: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type CancelAppointmentWithNoticeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
  cancelledBy: Scalars['ID']['input'];
}>;


export type CancelAppointmentWithNoticeMutation = { __typename?: 'Mutation', cancelAppointmentWithNotice: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type MarkAppointmentAttendedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkAppointmentAttendedMutation = { __typename?: 'Mutation', markAppointmentAttended: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type RevertAppointmentAttendedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RevertAppointmentAttendedMutation = { __typename?: 'Mutation', revertAppointmentAttended: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type AvailabilityAppointmentFieldsFragment = { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null };

export type GetAvailabilityAppointmentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetAvailabilityAppointmentQuery = { __typename?: 'Query', availabilityAppointment?: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } | null };

export type GetAvailabilityAppointmentsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetAvailabilityAppointmentsByOperatorQuery = { __typename?: 'Query', availabilityAppointmentsByOperator: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetAvailabilityAppointmentsQueryVariables = Exact<{
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
  operatorIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
}>;


export type GetAvailabilityAppointmentsQuery = { __typename?: 'Query', availabilityAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, hasConflict: boolean, conflictReason?: ConflictReason | null, notes?: string | null, cancellationReason?: string | null, cancelledAt?: any | null, cancelledBy?: string | null, cancellationHoursNotice?: number | null, operatorNotes?: string | null, instrumentOrderMatters: boolean, nonRetribuito: boolean, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string } | null, instruments?: Array<{ __typename?: 'AppointmentInstrument', id: string, instrumentId: string, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null, instrument: { __typename?: 'Instrument', id: string, name: string, color?: string | null, category: { __typename?: 'InstrumentCategory', id: string, name: string } } }> | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

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

export type GymAppointmentFieldsFragment = { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null };

export type GymSlotInfoFieldsFragment = { __typename?: 'GymSlotInfo', startTime: string, endTime: string, currentCount: number, maxCapacity: number, isAvailable: boolean, isClosed: boolean, operator?: { __typename?: 'GymSlotOperatorInfo', id: string, name: string, surname?: string | null } | null };

export type GetGymRoomAppointmentsQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetGymRoomAppointmentsQuery = { __typename?: 'Query', gymRoomAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetGymRoomsAppointmentsQueryVariables = Exact<{
  gymRoomIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetGymRoomsAppointmentsQuery = { __typename?: 'Query', gymRoomsAppointments: Array<{ __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null }> };

export type GetGymRoomAvailableSlotsQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetGymRoomAvailableSlotsQuery = { __typename?: 'Query', gymRoomAvailableSlots: Array<{ __typename?: 'GymSlotInfo', startTime: string, endTime: string, currentCount: number, maxCapacity: number, isAvailable: boolean, isClosed: boolean, operator?: { __typename?: 'GymSlotOperatorInfo', id: string, name: string, surname?: string | null } | null }> };

export type CreateGymAppointmentMutationVariables = Exact<{
  input: CreateGymAppointmentInput;
}>;


export type CreateGymAppointmentMutation = { __typename?: 'Mutation', createGymAppointment: { __typename?: 'AvailabilityAppointment', id: string, operatorId?: string | null, gymRoomId?: string | null, serviceId?: string | null, clientName: string, clientEmail?: string | null, clientPhone?: string | null, patientId?: number | null, appointmentDate: string, startTime: string, endTime: string, bookingStatus: BookingStatus, treatmentStatus?: TreatmentStatus | null, notes?: string | null, participantCount: number, maxParticipants?: number | null, isRecurring: boolean, recurringGroupId?: string | null, createdAt: any, updatedAt: any, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, gymRoom?: { __typename?: 'GymRoom', id: string, name: string, color?: string | null, maxCapacity: number } | null, service?: { __typename?: 'Service', id: string, name: string } | null, appointmentServices?: Array<{ __typename?: 'AppointmentService', id: string, serviceId: string, customDuration?: number | null, customPrice?: number | null, orderPosition: number, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null } };

export type CreateGymExceptionMutationVariables = Exact<{
  input: CreateGymExceptionInput;
}>;


export type CreateGymExceptionMutation = { __typename?: 'Mutation', createGymException: { __typename?: 'GymException', id: string, gymRoomId: string, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null } };

export type UpdateGymExceptionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateGymExceptionInput;
}>;


export type UpdateGymExceptionMutation = { __typename?: 'Mutation', updateGymException: { __typename?: 'GymException', id: string, gymRoomId: string, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null } };

export type DeleteGymExceptionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteGymExceptionMutation = { __typename?: 'Mutation', deleteGymException: boolean };

export type GymExceptionFieldsFragment = { __typename?: 'GymException', id: string, gymRoomId: string, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null };

export type GetGymExceptionsQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetGymExceptionsQuery = { __typename?: 'Query', gymExceptions: Array<{ __typename?: 'GymException', id: string, gymRoomId: string, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> };

export type GetGymExceptionsByDateQueryVariables = Exact<{
  gymRoomId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
}>;


export type GetGymExceptionsByDateQuery = { __typename?: 'Query', gymExceptionsByDate: Array<{ __typename?: 'GymException', id: string, gymRoomId: string, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null }> };

export type GetGymExceptionQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetGymExceptionQuery = { __typename?: 'Query', gymException?: { __typename?: 'GymException', id: string, gymRoomId: string, operatorId?: string | null, exceptionDate: string, startTime?: string | null, endTime?: string | null, exceptionType: GymExceptionType, substituteOperatorId?: string | null, reason?: string | null, createdBy?: string | null, createdAt: any, updatedAt: any, gymRoom: { __typename?: 'GymRoom', id: string, name: string }, operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null, substituteOperator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, color?: string | null } | null } | null };

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


export type CreateOperatorMutation = { __typename?: 'Mutation', createOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, userId?: number | null, legacyUserId?: number | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null } };

export type UpdateOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateOperatorInput;
}>;


export type UpdateOperatorMutation = { __typename?: 'Mutation', updateOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, userId?: number | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory } | null } };

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


export type GetOperatorsQuery = { __typename?: 'Query', operators: Array<{ __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: number | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null, templateAssignments?: Array<{ __typename?: 'TemplateAssignment', id: string, isCurrent: boolean }> | null }> };

export type GetOperatorQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetOperatorQuery = { __typename?: 'Query', operator?: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, phone?: string | null, color?: string | null, macroCategory: OperatorMacroCategory, categoryId?: string | null, preferredDurations?: Array<number> | null, legacyUserId?: number | null, maxConcurrentAppointments: number, isActive: boolean, royaltyPercentage: number, professionalRegistration?: string | null, createdAt: any, updatedAt: any, category?: { __typename?: 'OperatorCategory', id: string, name: string, macroCategory: OperatorMacroCategory, description?: string | null } | null, availabilityTemplates?: Array<{ __typename?: 'AvailabilityTemplate', id: string, name?: string | null, description?: string | null, dayInPattern: number, patternDuration: number, startTime: string, endTime: string, isCurrent: boolean, validFrom: any, validUntil?: any | null }> | null, availabilityExceptions?: Array<{ __typename?: 'AvailabilityException', id: string, exceptionDate: any, exceptionType: ExceptionType, startTime?: string | null, endTime?: string | null, reason?: string | null }> | null } | null };

export type GetOperatorAvailabilityQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  startDate: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
}>;


export type GetOperatorAvailabilityQuery = { __typename?: 'Query', operatorAvailability: Array<{ __typename?: 'DailyAvailability', date: string, hasAvailability: boolean, slots: Array<{ __typename?: 'AvailabilitySlot', operatorId: string, date: string, startTime: string, endTime: string, totalCapacity: number, bookedCapacity: number, availableCapacity: number, isAvailable: boolean, source?: string | null, sourceId?: string | null }> }> };

export type CreateAnamnesisMutationVariables = Exact<{
  input: CreateAnamnesisInput;
}>;


export type CreateAnamnesisMutation = { __typename?: 'Mutation', createAnamnesis: { __typename?: 'PatientAnamnesis', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, exams?: Array<{ __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type UpdateAnamnesisMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAnamnesisInput;
}>;


export type UpdateAnamnesisMutation = { __typename?: 'Mutation', updateAnamnesis: { __typename?: 'PatientAnamnesis', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, exams?: Array<{ __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type DeleteAnamnesisMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAnamnesisMutation = { __typename?: 'Mutation', deleteAnamnesis: boolean };

export type MarkObjectiveAchievedMutationVariables = Exact<{
  objectiveId: Scalars['ID']['input'];
  input: MarkObjectiveAchievedInput;
}>;


export type MarkObjectiveAchievedMutation = { __typename?: 'Mutation', markObjectiveAchieved: { __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any } };

export type UpdateTestResultMutationVariables = Exact<{
  testId: Scalars['ID']['input'];
  input: UpdateTestResultInput;
}>;


export type UpdateTestResultMutation = { __typename?: 'Mutation', updateTestResult: { __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any } };

export type AnamnesisObjectiveFieldsFragment = { __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any };

export type AnamnesisTestFieldsFragment = { __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any };

export type AnamnesisExamFieldsFragment = { __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any };

export type PatientAnamnesisFieldsFragment = { __typename?: 'PatientAnamnesis', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } };

export type PatientAnamnesisWithRelationsFieldsFragment = { __typename?: 'PatientAnamnesis', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, exams?: Array<{ __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } };

export type GetPatientAnamnesisQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientAnamnesisQuery = { __typename?: 'Query', patientAnamnesis?: { __typename?: 'PatientAnamnesis', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, exams?: Array<{ __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetAnamnesisByPathQueryVariables = Exact<{
  pathId: Scalars['ID']['input'];
}>;


export type GetAnamnesisByPathQuery = { __typename?: 'Query', anamnesisByPath?: { __typename?: 'PatientAnamnesis', id: string, therapeuticPathId: string, operatorId: string, professione?: string | null, sportPraticati?: Array<string> | null, bmi?: number | null, patologiePregresse?: string | null, interventiChirurgici?: string | null, traumi?: string | null, terapiaFarmacologica?: Array<string> | null, motivoConsulto?: string | null, esordioSintomi?: string | null, statoAttualeSintomi?: string | null, fattoriAllevianti?: Array<string> | null, fattoriAggravanti?: Array<string> | null, andamentoDolore?: string | null, osservazione?: string | null, palpazione?: string | null, movimentoPassivo?: string | null, movimentoAttivo?: string | null, forzaMuscolare?: string | null, equilibrio?: string | null, esameNeurologico?: string | null, limitazioniAttivita?: string | null, fattoriPrognosticiPositivi?: string | null, fattoriPrognosticiNegativi?: string | null, strategieCoping?: string | null, diagnosiFisioterapica?: string | null, interventiProposti?: Array<string> | null, frequenzaSedute?: string | null, outcome?: string | null, criticita?: Array<string> | null, createdAt: any, updatedAt: any, objectives?: Array<{ __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, tests?: Array<{ __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, exams?: Array<{ __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> | null, bodyMapMarkers?: Array<{ __typename?: 'BodyMapMarker', id: string, x: number, y: number, note?: string | null }> | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetObjectivesByAnamnesisQueryVariables = Exact<{
  anamnesisId: Scalars['ID']['input'];
}>;


export type GetObjectivesByAnamnesisQuery = { __typename?: 'Query', objectivesByAnamnesis: Array<{ __typename?: 'AnamnesisObjective', id: string, anamnesisId: string, tipo: ObjectiveType, descrizione: string, raggiunto: boolean, dataRaggiungimento?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> };

export type GetObjectivesProgressQueryVariables = Exact<{
  anamnesisId: Scalars['ID']['input'];
}>;


export type GetObjectivesProgressQuery = { __typename?: 'Query', objectivesProgress: { __typename?: 'ObjectivesProgress', total: number, achieved: number, percentage: number } };

export type GetTestsByAnamnesisQueryVariables = Exact<{
  anamnesisId: Scalars['ID']['input'];
}>;


export type GetTestsByAnamnesisQuery = { __typename?: 'Query', testsByAnamnesis: Array<{ __typename?: 'AnamnesisTest', id: string, anamnesisId: string, sezione: TestSection, nome: string, risultato?: string | null, superato?: boolean | null, dataEsecuzione?: any | null, orderIndex: number, createdAt: any, updatedAt: any }> };

export type GetTestsProgressQueryVariables = Exact<{
  anamnesisId: Scalars['ID']['input'];
}>;


export type GetTestsProgressQuery = { __typename?: 'Query', testsProgress: { __typename?: 'TestsProgress', total: number, passed: number, failed: number, pending: number, percentage: number } };

export type GetExamsByAnamnesisQueryVariables = Exact<{
  anamnesisId: Scalars['ID']['input'];
}>;


export type GetExamsByAnamnesisQuery = { __typename?: 'Query', examsByAnamnesis: Array<{ __typename?: 'AnamnesisExam', id: string, anamnesisId: string, nomeEsame: string, data?: any | null, note?: string | null, orderIndex: number, createdAt: any, updatedAt: any }> };

export type CreatePatientMutationVariables = Exact<{
  createPatientInput: CreatePatientInput;
}>;


export type CreatePatientMutation = { __typename?: 'Mutation', createPatient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, cellulare?: string | null, email?: string | null, nomeCompleto: string } };

export type UpdatePatientMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  updatePatientInput: UpdatePatientInput;
}>;


export type UpdatePatientMutation = { __typename?: 'Mutation', updatePatient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, cellulare?: string | null, email?: string | null, nomeCompleto: string } };

export type GetPatientsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetPatientsQuery = { __typename?: 'Query', patients: Array<{ __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, cellulare?: string | null, email?: string | null, dataNascita?: any | null, genere: Genere, indirizzo?: string | null, citta?: string | null, cap?: string | null, notes?: string | null, nomeCompleto: string, hasContattoTelefonico: boolean, statoAnagrafica: StatoAnagrafica, statoPrivacy: StatoPrivacy, consensoPrivacy: boolean, consensoMarketing: boolean, createdAt: any, updatedAt: any }> };

export type GetPatientQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientQuery = { __typename?: 'Query', patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, cellulare?: string | null, email?: string | null, dataNascita?: any | null, genere: Genere, indirizzo?: string | null, citta?: string | null, cap?: string | null, notes?: string | null, nomeCompleto: string, hasContattoTelefonico: boolean } | null };

export type SearchPatientsQueryVariables = Exact<{
  searchInput: SearchPatientInput;
}>;


export type SearchPatientsQuery = { __typename?: 'Query', searchPatients: Array<{ __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, cellulare?: string | null, email?: string | null, nomeCompleto: string }> };

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
}>;


export type CreateServiceMutation = { __typename?: 'Mutation', createService: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null } };

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
  macroCategory?: InputMaybe<OperatorMacroCategory>;
  subcategoryId?: InputMaybe<Scalars['ID']['input']>;
  discountFE?: InputMaybe<Scalars['Float']['input']>;
}>;


export type UpdateServiceMutation = { __typename?: 'Mutation', updateService: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null } };

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


export type GetServicesQuery = { __typename?: 'Query', services: Array<{ __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null }> };

export type GetServiceQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetServiceQuery = { __typename?: 'Query', service?: { __typename?: 'Service', id: string, name: string, description?: string | null, defaultDuration: number, defaultPrice: number, bufferTimeBefore: number, bufferTimeAfter: number, color?: string | null, isActive: boolean, macroCategory?: OperatorMacroCategory | null, discountFE?: number | null, subcategoryId?: string | null, createdAt: any, updatedAt: any, subcategory?: { __typename?: 'ServiceSubcategory', id: string, name: string } | null, operators?: Array<{ __typename?: 'OperatorService', operatorId: string, serviceId: string, customDuration?: number | null, customBufferTime?: number | null, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null } | null };

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

export type CreateTherapeuticPathMutationVariables = Exact<{
  input: CreateTherapeuticPathInput;
}>;


export type CreateTherapeuticPathMutation = { __typename?: 'Mutation', createTherapeuticPath: { __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } } };

export type UpdateTherapeuticPathMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTherapeuticPathInput;
}>;


export type UpdateTherapeuticPathMutation = { __typename?: 'Mutation', updateTherapeuticPath: { __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } } };

export type DeleteTherapeuticPathMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTherapeuticPathMutation = { __typename?: 'Mutation', deleteTherapeuticPath: boolean };

export type CreatePatientEvaluationMutationVariables = Exact<{
  input: CreateEvaluationInput;
}>;


export type CreatePatientEvaluationMutation = { __typename?: 'Mutation', createPatientEvaluation: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type UpdatePatientEvaluationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateEvaluationInput;
}>;


export type UpdatePatientEvaluationMutation = { __typename?: 'Mutation', updatePatientEvaluation: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } };

export type DeletePatientEvaluationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePatientEvaluationMutation = { __typename?: 'Mutation', deletePatientEvaluation: boolean };

export type CreatePathDocumentMutationVariables = Exact<{
  input: CreateDocumentInput;
}>;


export type CreatePathDocumentMutation = { __typename?: 'Mutation', createPathDocument: { __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any } };

export type DeletePathDocumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePathDocumentMutation = { __typename?: 'Mutation', deletePathDocument: boolean };

export type PatientEvaluationFieldsFragment = { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } };

export type PathDocumentFieldsFragment = { __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any };

export type TherapeuticPathFieldsFragment = { __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } };

export type TherapeuticPathWithRelationsFieldsFragment = { __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } };

export type GetTherapeuticPathQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetTherapeuticPathQuery = { __typename?: 'Query', therapeuticPath?: { __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } } | null };

export type GetTherapeuticPathsByPatientQueryVariables = Exact<{
  patientId: Scalars['Int']['input'];
}>;


export type GetTherapeuticPathsByPatientQuery = { __typename?: 'Query', therapeuticPathsByPatient: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } }> };

export type GetActiveTherapeuticPathsByPatientQueryVariables = Exact<{
  patientId: Scalars['Int']['input'];
}>;


export type GetActiveTherapeuticPathsByPatientQuery = { __typename?: 'Query', activeTherapeuticPathsByPatient: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } }> };

export type GetTherapeuticPathsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
}>;


export type GetTherapeuticPathsByOperatorQuery = { __typename?: 'Query', therapeuticPathsByOperator: Array<{ __typename?: 'TherapeuticPath', id: string, patientId: number, primaryOperatorId: string, name: string, diagnosis?: string | null, icdCode?: string | null, status: TherapeuticPathStatus, externalDoctorName?: string | null, externalPrescriptionRef?: string | null, notes?: string | null, createdAt: any, updatedAt: any, closedAt?: any | null, evaluations?: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> | null, documents?: Array<{ __typename?: 'PathDocument', id: string, therapeuticPathId: string, type: DocumentType, category: DocumentCategory, fileName: string, originalFileName?: string | null, mimeType: string, fileSize: number, storagePath: string, thumbnailPath?: string | null, externalDoctorName?: string | null, notes?: string | null, description?: string | null, uploadedBy?: string | null, uploadedAt: any }> | null, primaryOperator: { __typename?: 'Operator', id: string, name: string, surname?: string | null }, patient: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } }> };

export type GetPatientEvaluationQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPatientEvaluationQuery = { __typename?: 'Query', patientEvaluation?: { __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } } | null };

export type GetEvaluationsByPathQueryVariables = Exact<{
  pathId: Scalars['ID']['input'];
}>;


export type GetEvaluationsByPathQuery = { __typename?: 'Query', evaluationsByPath: Array<{ __typename?: 'PatientEvaluation', id: string, therapeuticPathId: string, operatorId: string, templateId?: string | null, chiefComplaint?: string | null, historyOfPresentIllness?: string | null, aggravatingFactors?: string | null, relievingFactors?: string | null, patientGoals?: string | null, therapistGoals?: string | null, functionalAssessment?: string | null, conclusions?: string | null, fieldValues?: any | null, createdAt: any, updatedAt: any, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null } }> };

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


export type CreateTreatmentMutation = { __typename?: 'Mutation', createTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type CompleteTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CompleteTreatmentInput;
}>;


export type CompleteTreatmentMutation = { __typename?: 'Mutation', completeTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type CloseTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: CloseTreatmentInput;
}>;


export type CloseTreatmentMutation = { __typename?: 'Mutation', closeTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type ReopenTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ReopenTreatmentMutation = { __typename?: 'Mutation', reopenTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type RecordTreatmentPaymentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: RecordPaymentInput;
}>;


export type RecordTreatmentPaymentMutation = { __typename?: 'Mutation', recordTreatmentPayment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type MarkTreatmentInvoicedToPatientMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
}>;


export type MarkTreatmentInvoicedToPatientMutation = { __typename?: 'Mutation', markTreatmentInvoicedToPatient: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type MarkTreatmentInvoicedByOperatorMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  invoiceNumber?: InputMaybe<Scalars['String']['input']>;
}>;


export type MarkTreatmentInvoicedByOperatorMutation = { __typename?: 'Mutation', markTreatmentInvoicedByOperator: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type UpdateTreatmentInstrumentsMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  instruments: Array<TreatmentInstrumentInput> | TreatmentInstrumentInput;
}>;


export type UpdateTreatmentInstrumentsMutation = { __typename?: 'Mutation', updateTreatmentInstruments: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type UpdateTreatmentMutationVariables = Exact<{
  input: UpdateTreatmentInput;
}>;


export type UpdateTreatmentMutation = { __typename?: 'Mutation', updateTreatment: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } };

export type DeleteTreatmentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTreatmentMutation = { __typename?: 'Mutation', deleteTreatment: boolean };

export type TreatmentFieldsFragment = { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any };

export type TreatmentWithRelationsFieldsFragment = { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } };

export type GetTreatmentQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetTreatmentQuery = { __typename?: 'Query', treatment?: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } | null };

export type GetTreatmentByAppointmentQueryVariables = Exact<{
  appointmentId: Scalars['ID']['input'];
}>;


export type GetTreatmentByAppointmentQuery = { __typename?: 'Query', treatmentByAppointment?: { __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } } | null };

export type GetTreatmentsByOperatorQueryVariables = Exact<{
  operatorId: Scalars['ID']['input'];
  date?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsByOperatorQuery = { __typename?: 'Query', treatmentsByOperator: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsPendingClosureQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTreatmentsPendingClosureQuery = { __typename?: 'Query', treatmentsPendingClosure: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsByPatientQueryVariables = Exact<{
  patientId: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetTreatmentsByPatientQuery = { __typename?: 'Query', treatmentsByPatient: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsNotInvoicedToPatientQueryVariables = Exact<{
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsNotInvoicedToPatientQuery = { __typename?: 'Query', treatmentsNotInvoicedToPatient: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsNotInvoicedByOperatorQueryVariables = Exact<{
  operatorId?: InputMaybe<Scalars['ID']['input']>;
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTreatmentsNotInvoicedByOperatorQuery = { __typename?: 'Query', treatmentsNotInvoicedByOperator: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };

export type GetTreatmentsByTherapeuticPathQueryVariables = Exact<{
  therapeuticPathId: Scalars['ID']['input'];
}>;


export type GetTreatmentsByTherapeuticPathQuery = { __typename?: 'Query', treatmentsByTherapeuticPath: Array<{ __typename?: 'Treatment', id: string, appointmentId: string, operatorId: string, patientId?: number | null, serviceId?: string | null, therapeuticPathId: string, scontoFE: boolean, status: TreatmentStatus, isTest: boolean, startedAt: any, completedAt?: any | null, closedAt?: any | null, clinicalNotes?: string | null, secretaryNotes?: string | null, operatorNotes?: string | null, patientNotes?: string | null, painLevel?: number | null, painBefore?: number | null, painAfter?: number | null, rescheduleRequested?: boolean | null, reschedulingType?: string | null, suggestInDays?: number | null, suggestDateRangeStart?: string | null, suggestDateRangeEnd?: string | null, reschedulingNotes?: string | null, price: number, isPaid: boolean, paymentMethod?: PaymentMethod | null, paidAt?: any | null, collectedBy?: string | null, isInvoicedToPatient: boolean, invoicedToPatientAt?: any | null, patientInvoiceNumber?: string | null, isInvoicedByOperator: boolean, invoicedByOperatorAt?: any | null, operatorInvoiceNumber?: string | null, createdAt: any, updatedAt: any, appointment: { __typename?: 'AvailabilityAppointment', id: string, startTime: string, endTime: string, bookingStatus: BookingStatus }, operator: { __typename?: 'Operator', id: string, name: string, surname?: string | null, email?: string | null, royaltyPercentage: number }, patient?: { __typename?: 'PatientModel', id: string, nome: string, cognome: string, codiceFiscale?: string | null, telefono?: string | null, email?: string | null } | null, service?: { __typename?: 'Service', id: string, name: string, defaultDuration: number, defaultPrice: number } | null, treatmentServices?: Array<{ __typename?: 'TreatmentService', id: string, serviceId: string, price?: number | null, duration?: number | null, orderPosition: number, isCustomPrice: boolean, service: { __typename?: 'Service', id: string, name: string, defaultPrice: number, discountFE?: number | null, defaultDuration: number } }> | null, instruments?: Array<{ __typename?: 'TreatmentInstrument', id: string, instrumentId: string, instrumentCategoryId?: string | null, wasUsed: boolean, startOffsetMinutes: number, endOffsetMinutes: number, orderPosition?: number | null }> | null, therapeuticPath: { __typename?: 'TherapeuticPath', id: string, name: string, status: TherapeuticPathStatus, diagnosis?: string | null } }> };
