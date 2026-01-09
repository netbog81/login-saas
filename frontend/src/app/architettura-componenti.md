PROMPT PER AGENTE LLM - Architettura Angular a 5 Strati con Gestione Foreign Keys

Ciao agente, ho bisogno del tuo aiuto per implementare nuove feature nella mia app Angular con GraphQL seguendo un'architettura professionale a 5 strati. Queste sono REGOLE VINCOLANTI per tutto lo sviluppo frontend del progetto.

📋 REGOLE PROGETTO - DA SEGUIRE SEMPRE
Regola 1: Architettura a 5 Strati OBBLIGATORIA
Tutti i nuovi componenti DEVONO seguire questa struttura:

text
1. UI Components (Dumb) ← Solo template/eventi
2. Containers (Smart) ← Gestione stato UI
3. Services ← Business logic + GraphQL
4. ApolloZoneService ← NgZone wrapper
5. Apollo Client ← Configurazione
Regola 2: Separation of Concerns STRETTA
❌ MAI chiamate GraphQL dirette nei componenti

❌ MAI logica business nei componenti UI

✅ SOLO Input/Output nei dumb components

✅ SOLO UI state nei containers

✅ SOLO business logic nei services

Regola 3: NgZone Integration OBBLIGATORIA
Tutte le query/mutation DEVONO usare BaseGraphQLService

Event handler nei containers DEVONO usare ngZone.run() se necessario

Mai usare apollo.query() direttamente

🗂️ STRUTTURA FILE STANDARD
Ogni nuova feature deve avere questa struttura:

text
src/app/features/[feature-name]/
├── components/                    # Layer 1 - Dumb components
│   ├── [feature]-list/           # Componente lista
│   ├── [feature]-form/           # Componente form
│   ├── [feature]-details/        # Componente dettagli
│   └── [feature]-section/        # Sezioni (se complesso)
├── containers/                    # Layer 2 - Smart components
│   ├── [feature]-container.component.ts      # Container principale
│   ├── [feature]-dialog.container.ts         # Container per dialog
│   └── [feature]-wizard.container.ts         # Container per wizard multi-step
├── services/                      # Layer 3 - Business logic
│   ├── [feature].service.ts                   # Service principale
│   └── [feature]-[relation].service.ts       # Services per relazioni
├── models/                        # TypeScript interfaces
│   ├── [feature].model.ts                     # Interfaccia principale
│   ├── [feature]-input.model.ts              # Input per mutations
│   ├── [feature]-update.model.ts             # Update partial
│   └── [feature]-with-relations.model.ts     # Entità con relazioni
└── [feature].module.ts           # Feature module
🔗 GESTIONE FOREIGN KEYS - REGOLE E APPROCCI
⚠️ PROBLEMA COMUNE CON FOREIGN KEYS
Quando un'entità ha relazioni (patient_id, operator_id, service_id):

Lettura: Devi caricare dati collegati per mostrarli in UI

Scrittura: Devi salvare solo gli ID, non oggetti interi

Update: Se cambi una foreign key, devi aggiornare la relazione

APPROCCIO 1: GraphQL Fragments (RACCOMANDATO - DEFAULT)
USA QUANDO: Backend supporta GraphQL con resolvers per relazioni

graphql
# Query con JOIN automatico
query GetTreatmentWithRelations {
  treatment(id: "123") {
    id
    name
    description
    # Foreign keys risolte dal backend
    patient {
      id
      name
      email
    }
    operator {
      id
      name
      specialization
    }
    services {
      id
      name
      duration
      price
    }
  }
}
VANTAGGI:

✅ Single query, single response

✅ Backend gestisce JOIN e performance

✅ Dati sempre consistenti

✅ Meno chiamate HTTP

IMPLEMENTAZIONE:

typescript
// treatment.service.ts
getTreatmentWithDetails(id: string): Observable<TreatmentWithDetails> {
  return this.query<{ treatment: TreatmentWithDetails }>({
    query: GET_TREATMENT_WITH_DETAILS, // Query con fragments
    variables: { id },
    fetchPolicy: 'network-only'
  }).pipe(
    map(result => result.treatment)
  );
}
APPROCCIO 2: Service Composition (QUANDO Backend limitato)
USA QUANDO: Backend REST o GraphQL senza resolvers per relazioni

typescript
// treatment.service.ts
getTreatmentEnriched(treatmentId: string): Observable<TreatmentEnriched> {
  return forkJoin({
    treatment: this.getTreatment(treatmentId),
    patient: this.patientService.getById(treatment.patientId),
    operator: this.operatorService.getById(treatment.operatorId),
    services: this.getServicesForTreatment(treatmentId)
  }).pipe(
    map(({treatment, patient, operator, services}) => ({
      ...treatment,
      patient,        // Oggetto completo
      operator,       // Oggetto completo  
      services        // Array di oggetti
    }))
  );
}
VANTAGGI:

✅ Lavora con qualsiasi backend

✅ Controllo totale sul frontend

✅ Cache indipendente per ogni entità

SVANTAGGI:

❌ N+1 query problem

❌ Performance peggiore

❌ Complessità maggiore

APPROCCIO 3: Cached Lookup (PER Dati di riferimento)
USA QUANDO: Dati di riferimento piccoli (operatori, servizi, status)

typescript
// reference-data.service.ts
@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private operatorsCache = new BehaviorSubject<Operator[]>([]);
  private servicesCache = new BehaviorSubject<Service[]>([]);
  
  constructor(private apolloZone: ApolloZoneService) {
    // Precaching all'avvio
    this.loadAllReferenceData();
  }
  
  getOperatorById(id: string): Operator | undefined {
    return this.operatorsCache.value.find(op => op.id === id);
  }
  
  getServiceById(id: string): Service | undefined {
    return this.servicesCache.value.find(s => s.id === id);
  }
}

// treatment.service.ts - uso nel mapping
private enrichTreatmentWithCache(treatment: Treatment): TreatmentEnriched {
  return {
    ...treatment,
    patient: this.referenceData.getPatientById(treatment.patientId),
    operator: this.referenceData.getOperatorById(treatment.operatorId),
    services: treatment.serviceIds.map(id => 
      this.referenceData.getServiceById(id)
    ).filter(Boolean) as Service[]
  };
}
📋 DECISION MATRIX - QUALE APPROCCIO USARE
Scenario	Approccio Consigliato	Perché
Backend GraphQL con resolvers	1. GraphQL Fragments	Performante, semplice
Backend REST o GraphQL base	2. Service Composition	Necessario per mancanza JOIN
Dati di riferimento (liste)	3. Cached Lookup	Performance ottima
Dati real-time (appuntamenti)	1 o 2	Dipende da backend
Relazioni 1:1 o 1:many	1 se possibile	Meno chiamate
Relazioni many:many	1 con limit/offset	Gestire paginazione
⚠️ ATTENZIONE: UPDATE CON FOREIGN KEYS
PROBLEMA: Quando salvi un'entità con foreign keys, devi inviare solo ID, non oggetti:

typescript
// ❌ SBAGLIATO - Invii oggetto completo
updateTreatment(treatment: TreatmentWithDetails) {
  return this.mutate({
    mutation: UPDATE_TREATMENT,
    variables: {
      input: {
        id: treatment.id,
        name: treatment.name,
        patient: treatment.patient, // ❌ Oggetto, non ID!
        operatorId: treatment.operator.id // ✅ Corretto
      }
    }
  });
}

// ✅ CORRETTO - Invii solo ID
updateTreatment(input: TreatmentUpdateInput) {
  return this.mutate({
    mutation: UPDATE_TREATMENT,
    variables: {
      input: {
        id: input.id,
        name: input.name,
        patientId: input.patientId, // ✅ Solo ID
        operatorId: input.operatorId, // ✅ Solo ID
        serviceIds: input.serviceIds // ✅ Array di ID
      }
    }
  });
}
REGOLE UPDATE FOREIGN KEYS:

Modello Input: Crea interfaccia TreatmentUpdateInput con solo ID

Transform nel Container: Converti TreatmentWithDetails → TreatmentUpdateInput

Validazione: Verifica che gli ID esistano prima di salvare

Optimistic Update: Aggiorna cache locale mentre salvi

🏗️ COMPONENTI COMPLESSI - ARCHITETTURA GERARCHICA
Caso: Cartella Clinica con Sezioni
STRUTTURA GERARCHICA:

text
features/medical-record/
├── containers/
│   └── medical-record.container.ts          # COORDINATORE PRINCIPALE
├── components/
│   ├── medical-record-layout/               # LAYOUT PRINCIPALE
│   │   ├── medical-record-header/           # Header (dumb)
│   │   ├── medical-record-tabs/             # Tabs navigazione (dumb)
│   │   └── medical-record-content/          # Content area (dumb)
│   │
│   ├── sections/                            # SEZIONI AUTONOME
│   │   ├── anamnesis-section/               # Sezione 1 (smart/dumb mix)
│   │   │   ├── anamnesis-form/              # Sotto-componente form
│   │   │   └── anamnesis-view/              # Sotto-componente view
│   │   │
│   │   ├── diagnosis-section/               # Sezione 2
│   │   ├── treatment-plan-section/          # Sezione 3
│   │   └── follow-up-section/               # Sezione 4
│   │
│   └── shared/
│       ├── clinical-notes/                  # Componente condiviso
│       └── vital-signs/                     # Componente condiviso
├── services/
│   ├── medical-record.service.ts            # SERVICE PRINCIPALE
│   ├── anamnesis.service.ts                 # Service sezione 1
│   ├── diagnosis.service.ts                 # Service sezione 2
│   └── ...                                 # Altri services sezioni
└── models/
    ├── medical-record.model.ts
    ├── section-data/                        # Modelli per sezioni
    │   ├── anamnesis.model.ts
    │   ├── diagnosis.model.ts
    │   └── ...
    └── medical-record-state.model.ts        # Stato globale
IMPLEMENTAZIONE - Component Composition Pattern
typescript
// medical-record.container.ts - COORDINATORE
@Component({
  template: `
    <!-- Layout principale -->
    <app-medical-record-layout
      [patient]="patient$ | async"
      [record]="record$ | async"
      [activeSection]="activeSection">
      
      <!-- Injection di sezioni dinamiche -->
      <ng-container [ngSwitch]="activeSection">
        
        <!-- Sezione Anamnesi -->
        <app-anamnesis-section *ngSwitchCase="'anamnesis'"
          [data]="record$?.anamnesis"
          [patient]="patient$ | async"
          (save)="saveSectionData('anamnesis', $event)"
          (cancel)="onSectionCancel()">
          
          <!-- Componenti interni alla sezione -->
          <app-clinical-notes [notes]="record$?.notes"></app-clinical-notes>
          <app-vital-signs [vitals]="record$?.vitals"></app-vital-signs>
          
        </app-anamnesis-section>
        
        <!-- Sezione Diagnosi -->
        <app-diagnosis-section *ngSwitchCase="'diagnosis'"
          [data]="record$?.diagnosis"
          (save)="saveSectionData('diagnosis', $event)">
        </app-diagnosis-section>
        
      </ng-container>
      
    </app-medical-record-layout>
  `
})
export class MedicalRecordContainer {
  // STATO GLOBALE
  activeSection = 'anamnesis';
  record$ = this.medicalRecordService.record$;
  patient$ = this.patientService.currentPatient$;
  
  constructor(
    private medicalRecordService: MedicalRecordService, // Service principale
    private anamnesisService: AnamnesisService,         // Service sezione
    private diagnosisService: DiagnosisService          // Service sezione
  ) {}
  
  // DELEGA AI SERVICES DELLE SEZIONI
  saveSectionData(section: string, data: any): void {
    switch(section) {
      case 'anamnesis':
        this.anamnesisService.save(data).subscribe(...);
        break;
      case 'diagnosis':
        this.diagnosisService.save(data).subscribe(...);
        break;
    }
  }
}
REGOLE PER COMPONENTI COMPLESSI:
1. Principio di Responsabilità Unica per Sezioni
Ogni sezione deve essere:

✅ Autonoma: Può essere sviluppata/testata separatamente

✅ Iniettabile: Può essere usata in diversi contesti

✅ Componibile: Può contenere sotto-componenti

2. Communication Pattern
text
Sezione → Container → Service → Backend
     ↑          ↓          ↑
     └─── Eventi ──────┘   └─── Dati ───┘
3. State Management Gerarchico
typescript
// Stato a 3 livelli:
interface MedicalRecordState {
  // 1. STATO GLOBALE (container)
  patientId: string;
  recordId: string;
  activeSection: string;
  
  // 2. STATO SEZIONE (section component)
  sections: {
    anamnesis: AnamnesisState;
    diagnosis: DiagnosisState;
    // ...
  };
  
  // 3. STATO UI (dumb components)
  ui: {
    loading: boolean;
    errors: string[];
    formDirty: boolean;
  };
}
4. Template per Sezione Complessa
typescript
// anamnesis-section.component.ts
@Component({
  selector: 'app-anamnesis-section',
  template: `
    <div class="section">
      <!-- Header sezione -->
      <app-section-header
        [title]="'Anamnesi'"
        [canEdit]="canEdit$ | async"
        (edit)="onEdit()">
      </app-section-header>
      
      <!-- Contenuto dinamico -->
      @if (editMode$ | async) {
        <!-- MODALITÀ EDIT -->
        <app-anamnesis-form
          [data]="data"
          [patient]="patient"
          (save)="onSave($event)"
          (cancel)="onCancel()">
          
          <!-- Sotto-sezioni -->
          <app-family-history></app-family-history>
          <app-allergies></app-allergies>
          <app-medications></app-medications>
          
        </app-anamnesis-form>
      } @else {
        <!-- MODALITÀ VIEW -->
        <app-anamnesis-view
          [data]="data"
          [patient]="patient">
        </app-anamnesis-view>
      }
      
      <!-- Actions -->
      <app-section-actions
        [editMode]="editMode$ | async"
        (save)="onSave($event)"
        (cancel)="onCancel()">
      </app-section-actions>
    </div>
  `
})
export class AnamnesisSectionComponent {
  @Input() data!: AnamnesisData;
  @Input() patient!: Patient;
  
  @Output() save = new EventEmitter<AnamnesisData>();
  @Output() cancel = new EventEmitter<void>();
  
  // Stato locale della sezione
  editMode$ = new BehaviorSubject<boolean>(false);
  
  onSave(data: AnamnesisData): void {
    this.save.emit(data);
    this.editMode$.next(false);
  }
}
🚀 TEMPLATE BASE PER NUOVE FEATURE
STEP 1: Quando chiedo una nuova feature, CHIEDIMMI:
Nome feature (es: "treatment-plan", "medical-record")

Entità principale e suoi campi

Relazioni con altre entità (foreign keys)

Operazioni CRUD necessarie

UI Requirements (lista, form, dettagli, sezioni)

STEP 2: Genera questa struttura BASE:
typescript
// 1. MODELS
export interface [FeaturePascal] {
  id: string;
  name: string;
  // Campi base
  createdAt: Date;
  updatedAt: Date;
  // Foreign keys (SOLO ID)
  patientId: string;
  operatorId: string;
  serviceIds: string[];
}

export interface [FeaturePascal]WithDetails extends [FeaturePascal] {
  // Relazioni popolate (oggetti, non ID)
  patient?: Patient;
  operator?: Operator;
  services?: Service[];
}

export interface [FeaturePascal]Input {
  // Per create/update (SOLO ID per foreign keys)
  name: string;
  patientId: string;      // ✅ Solo ID
  operatorId: string;     // ✅ Solo ID
  serviceIds: string[];   // ✅ Array di ID
}

// 2. GRAPHQL QUERIES (con fragments per relazioni)
const GET_[FEATURE_UPPER]_WITH_DETAILS = gql`
  query Get[FeaturePascal]WithDetails($id: ID!) {
    [feature](id: $id) {
      id
      name
      patient {          # ← Fragment per relazione
        id
        name
      }
      operator {
        id
        name
      }
      services {
        id
        name
      }
    }
  }
`;

// 3. SERVICE con approccio GraphQL Fragments (DEFAULT)
@Injectable({ providedIn: 'root' })
export class [FeaturePascal]Service extends BaseGraphQLService {
  getWithDetails(id: string): Observable<[FeaturePascal]WithDetails> {
    return this.query<{ [feature]: [FeaturePascal]WithDetails }>({
      query: GET_[FEATURE_UPPER]_WITH_DETAILS,
      variables: { id }
    }).pipe(map(result => result.[feature]));
  }
  
  create(input: [FeaturePascal]Input): Observable<[FeaturePascal]> {
    // Input contiene solo ID per foreign keys
    return this.mutate(...);
  }
}

// 4. CONTAINER con gestione foreign keys
@Component(...)
export class [FeaturePascal]Container {
  // Per visualizzazione: oggetti popolati
  itemWithDetails$ = this.[feature]Service.getWithDetails(this.id);
  
  // Per salvataggio: solo ID
  onSave(itemDetails: [FeaturePascal]WithDetails): void {
    const input: [FeaturePascal]Input = {
      name: itemDetails.name,
      patientId: itemDetails.patient?.id,      // Estrai ID
      operatorId: itemDetails.operator?.id,    // Estrai ID
      serviceIds: itemDetails.services?.map(s => s.id) || []
    };
    
    this.[feature]Service.update(this.id, input).subscribe(...);
  }
}
STEP 3: Implementa seguendo REGOLE:
Layer separation stretta

Foreign keys: approccio GraphQL Fragments come default

Component composition per feature complesse

NgZone integration obbligatoria

Error handling completo

STEP 4: Documenta scelte architetturali
In ogni feature, aggiungi commenti:

typescript
// APPROACH: GraphQL Fragments per foreign keys
// REASON: Backend supporta resolvers, single query
// ALTERNATIVE: Service composition se backend cambia
📝 CHECKLIST FINALE PER OGNI FEATURE
Prima di considerare completa una feature, verifica:

✅ Architettura
5 layers separati chiaramente

Dumb components senza logica

Container con solo UI state

Service con business logic

BaseGraphQLService usato per tutte le query

✅ Foreign Keys
Approccio documentato (GraphQL Fragments/Service Composition/Cache)

Modelli: Entity, EntityWithDetails, EntityInput separati

Update: Solo ID nelle mutations

Read: Oggetti popolati per display

✅ NgZone
Mai apollo.query() diretto

Tutte le query via BaseGraphQLService

Event handler wrappati se necessario

UI si aggiorna automaticamente

✅ Componenti Complessi
Struttura gerarchica se necessario

Sezioni autonome e componibili

State management appropriato

Communication pattern chiaro

✅ Code Quality
ChangeDetection.OnPush

Error handling completo

Loading states gestiti

TypeScript strict mode

Nessun any type

🚨 RICORDA: QUESTE SONO REGOLE VINCOLANTI
Ogni nuovo componente, service o feature DEVE seguire queste regole. Se ci sono eccezioni, devono essere documentate e approvate.

Domande da farmi prima di iniziare qualsiasi implementazione:

Quale approccio per foreign keys in questo caso?

Serve architettura gerarchica o componente semplice?

Tutti i layers sono rispettati?

NgZone è gestito correttamente?

Quando sei pronto, chiedimi i dettagli della feature da implementare e procedi con questa architettura.