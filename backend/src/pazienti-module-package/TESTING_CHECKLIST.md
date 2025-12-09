# TESTING CHECKLIST - Pazienti Module

Complete checklist for testing the integrated patient management module.

---

## 📋 PRE-INTEGRATION CHECKS

- [ ] Target project uses NestJS 11+
- [ ] Target project uses TypeORM 0.3+
- [ ] Target project uses GraphQL (code-first approach)
- [ ] PostgreSQL database available and accessible
- [ ] Existing `appointments` table present (for relation testing)
- [ ] All dependencies installed (`npm install` completed)

---

## 🔧 INTEGRATION CHECKS

### Module Registration

- [ ] `PazientiModule` imported in `app.module.ts`
- [ ] `GraphQLJSONObject` imported from `graphql-type-json`
- [ ] JSON scalar registered in GraphQL config (`resolvers: { JSON: GraphQLJSONObject }`)
- [ ] No compilation errors when building project
- [ ] Application starts successfully (`npm run start:dev`)

### Database Migration

- [ ] Migration file copied to project's migrations folder
- [ ] Migration runs without errors (`npm run migration:run`)
- [ ] `patients` table created in database
- [ ] All expected columns present in `patients` table
- [ ] Indexes created correctly (codice_fiscale, email, phone, data_nascita, etc.)
- [ ] JSONB columns created (cancellationsByYear, noShowsByYear)

**Verification SQL**:
```sql
-- Check table exists
\d patients

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'patients';
```

### GraphQL Schema Generation

- [ ] GraphQL Playground accessible (http://localhost:3000/graphql or configured URL)
- [ ] `PatientModel` type visible in schema
- [ ] All enums registered (Genere, StatoCivile, TipoPaziente, StatoAnagrafica, StatoPrivacy, etc.)
- [ ] `CreatePatientInput` type present
- [ ] `UpdatePatientInput` type present
- [ ] `SearchPatientInput` type present
- [ ] All queries listed in schema (patients, patient, searchPatients, etc.)
- [ ] All mutations listed in schema (createPatient, updatePatient, deletePatient, etc.)

---

## 🧪 FUNCTIONAL TESTING

### 1. CREATE Operations

#### Test 1.1: Create minimal patient
```graphql
mutation CreateMinimalPatient {
  createPatient(createPatientInput: {
    name: "Mario"
    surname: "Rossi"
    genere: MASCHIO
  }) {
    id
    name
    surname
    fullName
    statoAnagrafica
    statoPrivacy
  }
}
```

**Expected**:
- [ ] Returns patient with ID
- [ ] `fullName` computed correctly ("Mario Rossi")
- [ ] `statoAnagrafica` defaults to `BOZZA`
- [ ] `statoPrivacy` defaults to `NON_ACQUISITA`

#### Test 1.2: Create complete patient
```graphql
mutation CreateCompletePatient {
  createPatient(createPatientInput: {
    name: "Giulia"
    surname: "Verdi"
    genere: FEMMINA
    codiceFiscale: "VRDGLI85M45F205Z"
    dataNascita: "1985-08-05"
    phone: "+39 333 123 4567"
    email: "giulia.verdi@example.com"
    comuneNascita: "Roma"
    indirizzoResidenza: "Via Roma 123"
    comuneResidenza: "Milano"
    provinciaResidenza: "MI"
    cap: "20100"
    consensoGdpr: true
    tipoPaziente: ADULTO_AUTONOMO
  }) {
    id
    fullName
    age
    hasContattoTelefonico
    isAnagraficaMinima
    canCreateAppuntamento
    statoAnagrafica
  }
}
```

**Expected**:
- [ ] All fields saved correctly
- [ ] `age` computed from `dataNascita` (should be 40 if run in 2025)
- [ ] `hasContattoTelefonico` = true (has phone and email)
- [ ] `isAnagraficaMinima` = true (has name, surname, phone)
- [ ] `canCreateAppuntamento` = true

#### Test 1.3: Create patient with JSONB tracking
```graphql
mutation CreatePatientWithTracking {
  createPatient(createPatientInput: {
    name: "Luca"
    surname: "Bianchi"
    genere: MASCHIO
    phone: "+39 345 678 9012"
    cancellationsByYear: { "2024": 2, "2025": 1 }
    noShowsByYear: { "2025": 1 }
  }) {
    id
    fullName
    cancellationsByYear
    noShowsByYear
  }
}
```

**Expected**:
- [ ] JSONB fields saved correctly
- [ ] Can query JSONB fields and get proper object structure

### 2. READ Operations

#### Test 2.1: Get all patients (paginated)
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
    createdAt
  }
}
```

**Expected**:
- [ ] Returns array of patients
- [ ] Maximum 10 items returned
- [ ] Ordered correctly (by surname, name)

#### Test 2.2: Get single patient by ID
```graphql
query GetPatient {
  patient(id: 1) {
    id
    fullName
    codiceFiscale
    dataNascita
    age
    phone
    email
    statoAnagrafica
    statoPrivacy
    cancellationsByYear
    noShowsByYear
  }
}
```

**Expected**:
- [ ] Returns patient if exists
- [ ] Returns null if ID doesn't exist
- [ ] All computed fields correct (age, fullName)

#### Test 2.3: Search patients
```graphql
query SearchPatients {
  searchPatients(searchInput: {
    surname: "Rossi"
    limit: 20
    sortBy: "surname"
    sortOrder: ASC
  }) {
    id
    fullName
    phone
    email
  }
}
```

**Expected**:
- [ ] Filters by surname correctly (partial match)
- [ ] Respects limit parameter
- [ ] Sorts correctly

#### Test 2.4: Find by Codice Fiscale
```graphql
query FindByCodiceFiscale {
  patientByCodiceFiscale(codiceFiscale: "VRDGLI85M45F205Z") {
    id
    fullName
    codiceFiscale
  }
}
```

**Expected**:
- [ ] Returns correct patient
- [ ] Returns null if not found

#### Test 2.5: Find by Email
```graphql
query FindByEmail {
  patientByEmail(email: "giulia.verdi@example.com") {
    id
    fullName
    email
  }
}
```

**Expected**:
- [ ] Returns correct patient
- [ ] Returns null if not found

#### Test 2.6: Find by Phone
```graphql
query FindByPhone {
  patientsByPhone(phone: "+39 333") {
    id
    fullName
    phone
  }
}
```

**Expected**:
- [ ] Returns patients with matching phone (partial match)
- [ ] Returns empty array if no matches

#### Test 2.7: Find by status
```graphql
query FindByStatus {
  patientsByStatus(status: "bozza") {
    id
    fullName
    statoAnagrafica
  }
}
```

**Expected**:
- [ ] Returns only patients with matching status

#### Test 2.8: Patients requiring privacy update
```graphql
query RequiringPrivacy {
  patientsRequiringPrivacyUpdate {
    id
    fullName
    statoPrivacy
  }
}
```

**Expected**:
- [ ] Returns patients with `statoPrivacy = NON_ACQUISITA`

#### Test 2.9: Patients count
```graphql
query CountPatients {
  patientsCount
}
```

**Expected**:
- [ ] Returns integer count of total patients

### 3. UPDATE Operations

#### Test 3.1: Update patient basic data
```graphql
mutation UpdatePatient {
  updatePatient(
    id: 1
    updatePatientInput: {
      phone: "+39 333 999 8888"
      email: "newemail@example.com"
    }
  ) {
    id
    phone
    email
  }
}
```

**Expected**:
- [ ] Fields updated correctly
- [ ] Other fields unchanged
- [ ] `updatedAt` timestamp updated

#### Test 3.2: Update patient status
```graphql
mutation UpdateStatus {
  updatePatientStatus(id: 1, status: "completa") {
    id
    statoAnagrafica
  }
}
```

**Expected**:
- [ ] Status changed to "completa"
- [ ] Validation enforces valid status values

#### Test 3.3: Update privacy status
```graphql
mutation UpdatePrivacyStatus {
  updatePatientPrivacyStatus(id: 1, status: "digitale") {
    id
    statoPrivacy
  }
}
```

**Expected**:
- [ ] Privacy status updated
- [ ] Validation enforces valid privacy status values

#### Test 3.4: Grant GDPR consent
```graphql
mutation GrantConsent {
  grantGdprConsent(
    id: 1
    consensoGdpr: true
    consensoMarketing: false
    consensoTerzi: false
  ) {
    id
    consensoGdpr
    consensoMarketing
    consensoComunicazioneTerzi
    dataConsensoGdpr
  }
}
```

**Expected**:
- [ ] Consent flags updated
- [ ] `dataConsensoGdpr` timestamp set automatically

#### Test 3.5: Increment cancellations counter
```graphql
mutation IncrementCancellations {
  incrementCancellations(id: 1) {
    id
    cancellationsByYear
  }
}
```

**Expected**:
- [ ] Current year counter incremented
- [ ] Previous years unchanged
- [ ] Creates year entry if doesn't exist

#### Test 3.6: Increment no-shows counter
```graphql
mutation IncrementNoShows {
  incrementNoShows(id: 1) {
    id
    noShowsByYear
  }
}
```

**Expected**:
- [ ] Current year counter incremented

### 4. DELETE Operations (GDPR Compliance)

#### Test 4.1: Request deletion
```graphql
mutation RequestDeletion {
  requestPatientDeletion(id: 1) {
    id
    richiestaCancellazione
    dataRichiestaCancellazione
  }
}
```

**Expected**:
- [ ] `richiestaCancellazione` set to true
- [ ] `dataRichiestaCancellazione` timestamp set
- [ ] Patient record NOT deleted yet (GDPR requires retention period)

#### Test 4.2: Anonymize patient
```graphql
mutation AnonymizePatient {
  anonymizePatient(id: 1) {
    id
    name
    surname
    codiceFiscale
    phone
    email
    dataAnonimizzazione
  }
}
```

**Expected**:
- [ ] Personal data replaced with "ANONIMO" or null
- [ ] `dataAnonimizzazione` timestamp set
- [ ] Record remains in database (for audit purposes)
- [ ] **IRREVERSIBLE** - cannot be undone

#### Test 4.3: Delete patient (soft delete)
```graphql
mutation DeletePatient {
  deletePatient(id: 1)
}
```

**Expected**:
- [ ] Returns true
- [ ] Performs anonymization under the hood
- [ ] Patient still exists in database but anonymized

---

## 🔗 RELATION TESTING

### Test with Appointments

**Prerequisites**: Create a patient and an appointment linked to that patient

```graphql
# Create patient
mutation CreatePatientForAppointment {
  createPatient(createPatientInput: {
    name: "Test"
    surname: "Relation"
    genere: MASCHIO
    phone: "+39 123 456 7890"
  }) {
    id
  }
}

# Then create appointment (in your existing appointments system)
# using the returned patient ID

# Query patient with appointments relation
query PatientWithAppointments {
  patient(id: X) {
    id
    fullName
    # appointments {  # Uncomment if relation resolver enabled
    #   id
    #   date
    #   time
    # }
  }
}
```

**Expected**:
- [ ] Patient query works
- [ ] If appointments relation enabled, returns appointments array

---

## 🛡️ VALIDATION TESTING

### Test Invalid Inputs

#### Test: Invalid enum value
```graphql
mutation InvalidGender {
  createPatient(createPatientInput: {
    name: "Test"
    surname: "Invalid"
    genere: INVALID_VALUE  # Should fail
  }) {
    id
  }
}
```

**Expected**:
- [ ] GraphQL validation error
- [ ] Error message mentions invalid enum value

#### Test: Duplicate Codice Fiscale
```graphql
# Create first patient with CF
mutation CreateFirst {
  createPatient(createPatientInput: {
    name: "First"
    surname: "User"
    genere: MASCHIO
    codiceFiscale: "RSSMRA85M01H501Z"
  }) { id }
}

# Try to create second with same CF
mutation CreateDuplicate {
  createPatient(createPatientInput: {
    name: "Second"
    surname: "User"
    genere: FEMMINA
    codiceFiscale: "RSSMRA85M01H501Z"  # Duplicate
  }) { id }
}
```

**Expected**:
- [ ] Second mutation fails with unique constraint error
- [ ] First patient remains in database

#### Test: Duplicate Email
```graphql
# Similar to CF test above
```

**Expected**:
- [ ] Fails with unique constraint error

---

## 🔍 COMPUTED FIELDS TESTING

### Test Age Calculation
```graphql
query TestAgeCalculation {
  patient(id: X) {
    dataNascita
    age
  }
}
```

**Manual Verification**:
- [ ] `age` = current year - birth year
- [ ] Returns null if `dataNascita` is null

### Test fullName
```graphql
query TestFullName {
  patient(id: X) {
    name
    surname
    fullName
  }
}
```

**Expected**:
- [ ] `fullName` = "{name} {surname}"

### Test Workflow States
```graphql
query TestWorkflowFlags {
  patient(id: X) {
    name
    surname
    phone
    statoAnagrafica
    statoPrivacy
    hasContattoTelefonico
    isAnagraficaMinima
    canCreateAppuntamento
    isPrivacyCompleta
    hasAllConsensi
  }
}
```

**Verify Logic**:
- [ ] `hasContattoTelefonico` = true if phone OR cellulare OR email exists
- [ ] `isAnagraficaMinima` = true if name AND surname AND hasContattoTelefonico
- [ ] `canCreateAppuntamento` = isAnagraficaMinima (could have additional logic)
- [ ] `isPrivacyCompleta` = true if statoPrivacy != 'NON_ACQUISITA'
- [ ] `hasAllConsensi` = true if all required consents given

---

## 📊 PERFORMANCE TESTING

### Large Dataset Test

```bash
# Create 1000 test patients (use script or GraphQL loop)
# Then test query performance:
```

```graphql
query LargeDatasetTest {
  patients(limit: 100, offset: 0) {
    id
    fullName
  }
}
```

**Performance Benchmarks**:
- [ ] Query completes in < 500ms for 100 items
- [ ] Query completes in < 2s for 1000 items
- [ ] Search query completes in < 1s with indexes

### Index Verification

```sql
EXPLAIN ANALYZE
SELECT * FROM patients
WHERE codice_fiscale = 'RSSMRA85M01H501Z';
```

**Expected**:
- [ ] Uses index scan (not sequential scan)
- [ ] Execution time < 10ms

---

## 🐛 ERROR HANDLING TESTING

### Test: Non-existent patient ID
```graphql
query NonExistent {
  patient(id: 99999) {
    id
  }
}
```

**Expected**:
- [ ] Returns null (not an error)

### Test: Invalid search parameters
```graphql
query InvalidSearch {
  searchPatients(searchInput: {
    limit: -1  # Invalid
  }) {
    id
  }
}
```

**Expected**:
- [ ] Validation error with meaningful message

---

## ✅ POST-INTEGRATION VERIFICATION

- [ ] All queries return expected data
- [ ] All mutations work correctly
- [ ] GDPR compliance features functional
- [ ] No console errors when running queries
- [ ] GraphQL Playground documentation complete
- [ ] TypeScript compilation successful
- [ ] No eslint/prettier errors
- [ ] Application can restart without errors
- [ ] Database constraints enforced correctly
- [ ] Indexes improve query performance

---

## 📝 DOCUMENTATION VERIFICATION

- [ ] README.md updated with new module information
- [ ] API documentation generated (if using compodoc or similar)
- [ ] Environment variables documented (if any added)
- [ ] Migration documented in CHANGELOG
- [ ] Integration steps documented for team

---

## 🎉 INTEGRATION COMPLETE

Once all checkboxes are ticked, the integration is successful and ready for production use.

**Final Steps**:
1. Update frontend to use new GraphQL queries
2. Migrate existing patient data (if any)
3. Set up monitoring and logging
4. Configure backup strategy for new table
5. Train team on new features

---

**Testing Checklist Version**: 1.0.0
**Last Updated**: 2025-12-09
