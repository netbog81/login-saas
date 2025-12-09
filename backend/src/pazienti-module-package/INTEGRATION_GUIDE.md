# INTEGRATION GUIDE - Pazienti Module Package

**Package Version**: 1.0.0
**Target Project**: agendatest (NestJS + GraphQL)
**Purpose**: Add comprehensive patient management with GDPR compliance to existing GraphQL application

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Package Structure](#package-structure)
4. [Step-by-Step Integration](#step-by-step-integration)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)

---

## 🎯 OVERVIEW

This package provides a **production-ready patient management module** with:

- ✅ **39 patient fields** with complete medical, fiscal, and privacy data
- ✅ **GraphQL API** (code-first approach) with 20+ queries and 10+ mutations
- ✅ **GDPR compliance** with consent management and anonymization
- ✅ **Multi-state workflow** (BOZZA → PARZIALE → COMPLETA → DA_VERIFICARE)
- ✅ **Privacy tracking** (NON_ACQUISITA → CARTACEA → DIGITALE → MISTA)
- ✅ **Integration with existing entities** (Appointment, AvailabilityAppointment)
- ✅ **JSONB tracking fields** (cancellationsByYear, noShowsByYear)

### What Changed from Original medical-system

| Aspect | Original (medical-system) | Adapted (this package) |
|--------|---------------------------|------------------------|
| **API Type** | REST | GraphQL |
| **Naming** | Italian (nome, cognome) | English (name, surname) |
| **Table Name** | `pazienti` | `patients` |
| **Additional Fields** | None | cancellationsByYear, noShowsByYear |
| **Relations** | Only persone_riferimento | + appointments, availabilityAppointments |
| **Module Style** | NestJS REST | NestJS GraphQL code-first |

---

## ✅ PREREQUISITES

### Required Dependencies (Already in your project)

```json
{
  "@nestjs/common": "^11.x",
  "@nestjs/core": "^11.x",
  "@nestjs/graphql": "^12.x",
  "@nestjs/typeorm": "^10.x",
  "@apollo/server": "^4.x",
  "typeorm": "^0.3.x",
  "graphql": "^16.x",
  "graphql-type-json": "^0.3.x",
  "class-validator": "^0.14.x",
  "class-transformer": "^0.5.x"
}
```

### Database

- **PostgreSQL 14+** (your existing database)
- **JSONB support** (for cancellationsByYear, noShowsByYear)

---

## 📦 PACKAGE STRUCTURE

```
pazienti-module-package/
├── pazienti/                          # Main module directory
│   ├── entities/                      # TypeORM entities
│   │   ├── paziente.entity.ts         # Main patient entity (39 fields)
│   │   ├── persona-riferimento.entity.ts  # Reference persons
│   │   └── paziente-persona-relazione.entity.ts  # Relations
│   ├── enums/                         # Business enums (13 enums)
│   │   └── pazienti-enums.ts
│   ├── models/                        # GraphQL ObjectTypes
│   │   ├── graphql-enums.ts           # GraphQL enum registration
│   │   └── patient.model.ts           # Patient GraphQL model
│   ├── inputs/                        # GraphQL InputTypes
│   │   ├── create-patient.input.ts    # Create patient input
│   │   ├── update-patient.input.ts    # Update patient input
│   │   ├── search-patient.input.ts    # Search/filter input
│   │   └── index.ts
│   ├── resolvers/                     # GraphQL resolvers
│   │   └── patients.resolver.ts       # Complete resolver (20+ queries, 10+ mutations)
│   ├── services/                      # Business logic
│   │   ├── pazienti.service.ts        # Main service (829 lines)
│   │   └── pazienti-relazioni.service.ts  # Relations service
│   └── pazienti.module.ts             # Module configuration
├── migrations/                        # Database migrations
│   └── 1760800000000-CreatePazientiTables.ts
├── docs/                              # Documentation
│   ├── INTEGRATION_GUIDE.md           # This file
│   ├── LLM_PROMPT.txt                 # Ready-to-use LLM prompt
│   ├── TESTING_CHECKLIST.md           # Testing checklist
│   ├── FIELDS_COMPARISON.md           # Field mapping reference
│   └── EXAMPLE_QUERIES.graphql        # Sample GraphQL queries
└── README.md                          # Package overview
```

---

## 🚀 STEP-BY-STEP INTEGRATION

### STEP 1: Copy Package to Project

```bash
# Copy the entire pazienti directory to your backend source
cp -r pazienti /path/to/agendatest/backend/src/

# Verify the copy
ls -la /path/to/agendatest/backend/src/pazienti
```

### STEP 2: Install Missing Dependencies (if any)

```bash
cd /path/to/agendatest/backend

# Check if graphql-type-json is installed (required for JSONB GraphQL support)
npm list graphql-type-json

# If not installed:
npm install graphql-type-json
```

### STEP 3: Register Module in app.module.ts

**Location**: `/path/to/agendatest/backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';

// ✅ ADD THIS IMPORT
import { PazientiModule } from './pazienti/pazienti.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // Your existing TypeORM config
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true, // or path to schema.gql
      playground: true,
      // ✅ IMPORTANT: Add JSON scalar support
      resolvers: { JSON: GraphQLJSONObject },
    }),

    // ✅ ADD THIS MODULE
    PazientiModule,

    // Your other modules...
  ],
})
export class AppModule {}
```

### STEP 4: Run Database Migration

```bash
# Generate the migration (it's already provided in migrations/ folder)
# Copy migration file to your project migrations folder
cp migrations/1760800000000-CreatePazientiTables.ts /path/to/agendatest/backend/src/migrations/

# Run the migration
npm run migration:run

# Verify tables created
psql -d your_database -c "\dt patients"
```

### STEP 5: Update Existing Patient Entity (OPTIONAL - if you want to keep your existing table)

**Option A**: Replace your existing Patient entity entirely
- Remove `backend/src/entities/patient.entity.ts`
- Use `pazienti/entities/paziente.entity.ts` from this package

**Option B**: Keep both entities (rename the new one to avoid conflicts)
- Rename `Paziente` class to `PazienteDettagliato` in `paziente.entity.ts`
- Rename table to `patients_dettagliato` in entity decorator
- Keep your existing simple Patient entity for backward compatibility

**Option C**: Migrate data from old to new (RECOMMENDED)
```sql
-- Example data migration script
INSERT INTO patients (
  id, name, surname, phone, email, notes,
  cancellationsByYear, noShowsByYear, created_at, updated_at
)
SELECT
  id, name, surname, phone, email, notes,
  cancellationsByYear, noShowsByYear, "createdAt", "updatedAt"
FROM your_old_patient_table;
```

### STEP 6: Update Appointment Relations

**Location**: `/path/to/agendatest/backend/src/entities/appointment.entity.ts`

```typescript
import { Paziente } from '../pazienti/entities/paziente.entity';

@Entity('appointments')
export class Appointment {
  // ... existing fields ...

  // ✅ UPDATE THIS RELATION (if it exists)
  @ManyToOne(() => Paziente, (patient) => patient.appointments, {
    eager: false,
    lazy: true,
  })
  @JoinColumn({ name: 'patient_id' })
  patient: Promise<Paziente>;

  // OR if you want to keep backward compatibility:
  @Column({ name: 'patient_id' })
  patientId: number;
}
```

### STEP 7: Test GraphQL Schema Generation

```bash
# Start your development server
npm run start:dev

# Check that the GraphQL schema includes new types
# Visit http://localhost:3000/graphql (or your playground URL)

# You should see:
# - Type: PatientModel
# - Input: CreatePatientInput, UpdatePatientInput, SearchPatientInput
# - Queries: patients, patient, searchPatients, patientByCodiceFiscale, etc.
# - Mutations: createPatient, updatePatient, deletePatient, etc.
```

### STEP 8: Test with Sample Query

Open GraphQL Playground and try:

```graphql
query GetAllPatients {
  patients(limit: 10, offset: 0) {
    id
    name
    surname
    fullName
    phone
    email
    statoAnagrafica
    statoPrivacy
    age
    isAnagraficaMinima
    canCreateAppuntamento
    cancellationsByYear
    noShowsByYear
  }
}
```

---

## ⚙️ CONFIGURATION

### TypeORM Configuration

Ensure your `ormconfig.ts` or `data-source.ts` includes:

```typescript
export const dataSource = new DataSource({
  type: 'postgres',
  // ... your connection config ...
  entities: [
    'dist/**/*.entity{.ts,.js}',
    // This will auto-discover pazienti entities
  ],
  migrations: [
    'dist/migrations/*{.ts,.js}'
  ],
});
```

### GraphQL Configuration

**For JSON Scalar Support** (required for cancellationsByYear, noShowsByYear):

```typescript
// In app.module.ts
import { GraphQLJSONObject } from 'graphql-type-json';

GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  resolvers: {
    JSON: GraphQLJSONObject // ✅ Add this
  },
})
```

### Environment Variables

No additional environment variables required. The module uses your existing database connection.

---

## 🧪 TESTING

### Manual Testing Checklist

See [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) for a complete checklist.

**Quick Tests**:

1. **Create Patient**
```graphql
mutation CreatePatient {
  createPatient(createPatientInput: {
    name: "Mario"
    surname: "Rossi"
    genere: MASCHIO
    phone: "+39 123 456 7890"
    email: "mario.rossi@example.com"
  }) {
    id
    fullName
    statoAnagrafica
  }
}
```

2. **Search Patients**
```graphql
query SearchPatients {
  searchPatients(searchInput: {
    surname: "Rossi"
    limit: 10
  }) {
    id
    fullName
    phone
  }
}
```

3. **Update Patient Status**
```graphql
mutation UpdateStatus {
  updatePatientStatus(id: 1, status: "completa") {
    id
    statoAnagrafica
  }
}
```

### Automated Testing

```typescript
// Example E2E test
describe('Patients GraphQL API', () => {
  it('should create a patient', async () => {
    const query = `
      mutation {
        createPatient(createPatientInput: {
          name: "Test"
          surname: "User"
          genere: MASCHIO
        }) {
          id
          fullName
        }
      }
    `;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query });

    expect(response.body.data.createPatient).toBeDefined();
  });
});
```

---

## 🔧 TROUBLESHOOTING

### Issue 1: "Cannot resolve signature of Decorator"

**Cause**: Missing TypeORM or NestJS dependencies
**Solution**:
```bash
npm install @nestjs/typeorm typeorm reflect-metadata
```

### Issue 2: "GraphQL type JSON is not defined"

**Cause**: Missing graphql-type-json package
**Solution**:
```bash
npm install graphql-type-json

# Then in app.module.ts:
import { GraphQLJSONObject } from 'graphql-type-json';
```

### Issue 3: Migration fails with "table already exists"

**Cause**: Existing patient table
**Solution**:
- Option A: Drop existing table first (⚠️ data loss)
- Option B: Modify migration to ADD columns instead of CREATE table
- Option C: Use different table name (`patients_v2`)

### Issue 4: Circular dependency error

**Cause**: Appointment and Patient entities reference each other
**Solution**: Use lazy loading (already implemented)
```typescript
@OneToMany('Appointment', 'patient', { lazy: true })
appointments: Promise<Appointment[]>;
```

### Issue 5: Service methods not found

**Cause**: Service not implementing all expected methods
**Solution**: Check `pazienti.service.ts` - may need to add missing methods based on your resolver usage

---

## 🚀 ADVANCED USAGE

### Custom Business Logic

You can extend the `PazientiService` to add custom methods:

```typescript
// In your own custom service
@Injectable()
export class CustomPatientsService extends PazientiService {
  async findHighRiskPatients(): Promise<Paziente[]> {
    // Your custom logic
    return this.pazientiRepository.find({
      where: {
        patologieCroniche: Not(IsNull()),
      },
    });
  }
}
```

### Adding Field Resolvers

Add custom computed fields in `patients.resolver.ts`:

```typescript
@ResolveField('riskScore', () => Int)
resolveRiskScore(@Parent() patient: Paziente): number {
  // Calculate risk based on age, pathologies, etc.
  let score = 0;
  if (patient.age > 65) score += 20;
  if (patient.patologieCroniche) score += 30;
  return score;
}
```

### Integration with Existing Services

```typescript
// In your AppointmentService
constructor(
  private readonly pazientiService: PazientiService,
) {}

async createAppointmentWithValidation(appointmentData) {
  const patient = await this.pazientiService.findOne(appointmentData.patientId);

  if (!patient.canCreateAppuntamento) {
    throw new BadRequestException('Patient record incomplete');
  }

  // Create appointment...
}
```

### GDPR Compliance Features

```typescript
// Anonymize patient after 10 years
await pazientiService.anonymize(patientId);

// Request deletion (marks for deletion, doesn't delete immediately)
await pazientiService.requestDeletion(patientId);

// Update consent
await pazientiService.updateConsents(patientId, {
  consensoGdpr: true,
  consensoMarketing: false,
});
```

---

## 📚 ADDITIONAL RESOURCES

- **[LLM_PROMPT.txt](./LLM_PROMPT.txt)** - Copy-paste prompt for AI assistance
- **[TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)** - Complete testing guide
- **[FIELDS_COMPARISON.md](./FIELDS_COMPARISON.md)** - Old vs new field mapping
- **[EXAMPLE_QUERIES.graphql](./EXAMPLE_QUERIES.graphql)** - Sample GraphQL queries

---

## ✅ INTEGRATION COMPLETE

Once all steps are complete, you should have:

✅ `patients` table in your database
✅ GraphQL schema with Patient types
✅ 20+ queries and 10+ mutations available
✅ Full GDPR compliance features
✅ Integration with your existing Appointment system

**Next Steps**:
1. Test all GraphQL operations
2. Update frontend to use new GraphQL queries
3. Migrate existing patient data (if any)
4. Configure GDPR retention policies
5. Set up automated tests

---

**Package Version**: 1.0.0
**Last Updated**: 2025-12-09
**Maintainer**: Adapted from medical-system for agendatest project
