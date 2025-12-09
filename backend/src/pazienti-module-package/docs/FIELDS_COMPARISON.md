# FIELDS COMPARISON - Old vs New Patient Entity

This document maps fields between the original medical-system `pazienti` entity and this adapted GraphQL package.

---

## 📊 NAMING CHANGES

### Basic Information

| Original (medical-system) | Adapted (this package) | Type | Notes |
|---------------------------|------------------------|------|-------|
| `nome` | `name` | string | First name |
| `cognome` | `surname` | string | Last name |
| `telefono` | `phone` | string | Primary phone |
| `note` | `notes` | text | Medical notes |
| `nomeCompleto()` | `fullName` | computed | Getter property |

**Reason**: Match existing agendatest project conventions (English naming)

---

## 🆕 NEW FIELDS (Not in medical-system)

| Field Name | Type | Source | Purpose |
|------------|------|--------|---------|
| `cancellationsByYear` | jsonb | agendatest | Track appointment cancellations per year |
| `noShowsByYear` | jsonb | agendatest | Track no-show incidents per year |
| `appointments` | relation | agendatest | Link to Appointment entities |
| `availabilityAppointments` | relation | agendatest | Link to AvailabilityAppointment entities |

**Reason**: Integration with existing appointment management system

---

## 📋 COMPLETE FIELD MAPPING

### 1. IDENTIFICAZIONE (Identification)

| Field | Type | Required | Default | Unique | Notes |
|-------|------|----------|---------|--------|-------|
| `id` | integer | ✅ | auto | ✅ | Primary key |
| `codiceFiscale` | varchar(16) | ❌ | - | ✅ | Italian Tax Code |

### 2. DATI ANAGRAFICI (Personal Data)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `name` | varchar(50) | ✅ | - | First name |
| `surname` | varchar(50) | ✅ | - | Last name |
| `dataNascita` | date | ❌ | - | Date of birth |
| `comuneNascita` | varchar(100) | ❌ | - | City of birth |
| `nazioneNascita` | varchar(50) | ❌ | 'Italia' | Country of birth |
| `luogoNascitaEstero` | varchar(100) | ❌ | - | Foreign birth place |
| `genere` | enum | ✅ | - | M, F, A, N |
| `statoCivile` | enum | ❌ | - | Marital status |
| `tipoPaziente` | enum | ✅ | 'adulto_autonomo' | Patient type |

### 3. CONTATTI (Contacts)

| Field | Type | Required | Default | Indexed | Notes |
|-------|------|----------|---------|---------|-------|
| `phone` | varchar(20) | ❌ | - | ✅ | Primary phone |
| `cellulare` | varchar(20) | ❌ | - | ❌ | Mobile phone |
| `email` | varchar(100) | ❌ | - | ✅ unique | Email address |
| `pec` | varchar(100) | ❌ | - | ❌ | Certified email |

### 4. RESIDENZA (Address)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `indirizzoResidenza` | varchar(200) | ❌ | Street address |
| `comuneResidenza` | varchar(100) | ❌ | City |
| `provinciaResidenza` | varchar(2) | ❌ | Province code |
| `cap` | varchar(5) | ❌ | Postal code |

### 5. DATI SANITARI (Medical Data)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tesseraSanitaria` | varchar(20) | ❌ | Italian health card number |
| `medicoCurante` | varchar(100) | ❌ | Primary doctor name |
| `notes` | text | ❌ | Medical notes |
| `allergie` | text | ❌ | Known allergies |
| `farmaci` | text | ❌ | Current medications |
| `patologieCroniche` | text | ❌ | Chronic conditions |

### 6. DATI FISCALI (Fiscal Data)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `nomeFatturazione` | varchar(100) | ❌ | Billing name |
| `indirizzoFatturazione` | varchar(200) | ❌ | Billing address |
| `partitaIva` | varchar(11) | ❌ | VAT number |
| `codiceFiscaleFatturazione` | varchar(16) | ❌ | Billing tax code |
| `codiceSdi` | varchar(7) | ❌ | Electronic invoicing code |
| `assicurazione` | varchar(100) | ❌ | Insurance company |
| `numeroPolizzaAssicurativa` | varchar(50) | ❌ | Insurance policy number |

### 7. STATI WORKFLOW (Workflow States)

| Field | Type | Required | Default | Indexed | Notes |
|-------|------|----------|---------|---------|-------|
| `statoAnagrafica` | enum | ✅ | 'bozza' | ✅ | Record status |
| `statoPrivacy` | enum | ✅ | 'non_acquisita' | ✅ | Privacy status |
| `origine` | varchar(20) | ❌ | - | ❌ | Registration source |

**Possible Values**:
- `statoAnagrafica`: BOZZA, PARZIALE, COMPLETA, DA_VERIFICARE
- `statoPrivacy`: NON_ACQUISITA, CARTACEA, DIGITALE, MISTA

### 8. PRIVACY & GDPR

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `consensoGdpr` | boolean | ✅ | false | General GDPR consent |
| `dataConsensoGdpr` | timestamp | ❌ | - | Consent date |
| `consensoMarketing` | boolean | ✅ | false | Marketing consent |
| `dataConsensoMarketing` | timestamp | ❌ | - | Consent date |
| `consensoComunicazioneTerzi` | boolean | ✅ | false | Third-party consent |
| `dataConsensoTerzi` | timestamp | ❌ | - | Consent date |
| `documentiPrivacy` | text | ❌ | - | Document IDs (encrypted) |
| `dataUltimaModificaPrivacy` | timestamp | ❌ | - | Last privacy update |
| `richiestaCancellazione` | boolean | ✅ | false | Deletion requested |
| `dataRichiestaCancellazione` | timestamp | ❌ | - | Request date |
| `dataAnonimizzazione` | timestamp | ❌ | - | Anonymization date |
| `conservazioneFino` | date | ❌ | - | Retention deadline |

### 9. TRACKING FIELDS (NEW - from agendatest)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `cancellationsByYear` | jsonb | ✅ | {} | Cancellations per year |
| `noShowsByYear` | jsonb | ✅ | {} | No-shows per year |

**JSON Structure Example**:
```json
{
  "cancellationsByYear": {
    "2024": 3,
    "2025": 1
  },
  "noShowsByYear": {
    "2025": 2
  }
}
```

### 10. RELAZIONI (Relations)

| Relation | Type | Target Entity | Lazy | Notes |
|----------|------|---------------|------|-------|
| `personeRiferimento` | OneToMany | PersonaRiferimento | ✅ | Reference persons |
| `relazioniComeConiuge` | OneToMany | PersonaRiferimento | ✅ | Spouse relations |
| `appointments` | OneToMany | Appointment | ✅ | Patient appointments (NEW) |
| `availabilityAppointments` | OneToMany | AvailabilityAppointment | ✅ | Availability slots (NEW) |

### 11. TIMESTAMP

| Field | Type | Auto | Notes |
|-------|------|------|-------|
| `createdAt` | timestamp | ✅ | Creation timestamp |
| `updatedAt` | timestamp | ✅ | Last update timestamp |

---

## 🧮 COMPUTED PROPERTIES (Getters)

These are NOT database columns, but computed at runtime:

| Property | Return Type | Logic | GraphQL Field |
|----------|-------------|-------|---------------|
| `fullName` | string | `name + ' ' + surname` | ✅ Yes |
| `age` | number \| null | Calculated from `dataNascita` | ✅ Yes |
| `hasContattoTelefonico` | boolean | `!!(phone \|\| cellulare \|\| email)` | ✅ Yes |
| `isAnagraficaMinima` | boolean | `!!(name && surname && hasContattoTelefonico)` | ✅ Yes |
| `canCreateAppuntamento` | boolean | `isAnagraficaMinima` | ✅ Yes |
| `isPrivacyCompleta` | boolean | `statoPrivacy !== 'NON_ACQUISITA'` | ✅ Yes |
| `hasAllConsensi` | boolean | `consensoGdpr && (other logic)` | ✅ Yes |

---

## 📊 INDEX COMPARISON

### Indexes Created by Migration

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| `IDX_patients_codice_fiscale` | codice_fiscale | unique | Fast lookup by CF |
| `IDX_patients_email` | email | unique | Fast lookup + uniqueness |
| `IDX_patients_phone` | phone | normal | Search by phone |
| `IDX_patients_data_nascita` | data_nascita | normal | Age-based queries |
| `IDX_patients_stato_anagrafica` | stato_anagrafica | normal | Status filtering |
| `IDX_patients_stato_privacy` | stato_privacy | normal | Privacy filtering |
| `IDX_patients_surname_name` | surname, name | normal | Alphabetical listing |

**Performance Impact**:
- Queries by `codiceFiscale`: O(log n) → ~10ms for 100k records
- Queries by `email`: O(log n) → ~10ms
- Search by `phone`: O(log n) → ~15ms
- List alphabetically: Uses surname_name index → ~50ms for 1000 records

---

## 🔄 DATA MIGRATION MAPPING

If migrating from old `patient` table to new `patients` table:

```sql
INSERT INTO patients (
  id,
  name,           -- was: name (no change)
  surname,        -- was: surname (no change)
  phone,          -- was: phone (no change)
  email,          -- was: email (no change)
  notes,          -- was: notes (no change)
  cancellationsByYear,  -- was: cancellationsByYear (no change)
  noShowsByYear,        -- was: noShowsByYear (no change)
  created_at,     -- was: createdAt (renamed)
  updated_at,     -- was: updatedAt (renamed)

  -- New fields with defaults:
  genere,         -- DEFAULT: 'N' (NON_SPECIFICATO)
  tipo_paziente,  -- DEFAULT: 'adulto_autonomo'
  stato_anagrafica,  -- DEFAULT: 'bozza'
  stato_privacy,     -- DEFAULT: 'non_acquisita'
  consenso_gdpr,     -- DEFAULT: false
  consenso_marketing, -- DEFAULT: false
  consenso_comunicazione_terzi,  -- DEFAULT: false
  richiesta_cancellazione  -- DEFAULT: false
)
SELECT
  id,
  name,
  surname,
  phone,
  email,
  notes,
  cancellationsByYear,
  noShowsByYear,
  "createdAt",
  "updatedAt",

  -- Set defaults for new required fields:
  'N' as genere,
  'adulto_autonomo' as tipo_paziente,
  'bozza' as stato_anagrafica,
  'non_acquisita' as stato_privacy,
  false as consenso_gdpr,
  false as consenso_marketing,
  false as consenso_comunicazione_terzi,
  false as richiesta_cancellazione
FROM old_patient_table;
```

---

## 📈 STORAGE REQUIREMENTS

**Approximate size per patient record**:
- Minimal record (name, surname, phone, genere): ~200 bytes
- Average record (with contacts, address, medical notes): ~1-2 KB
- Complete record (all fields filled): ~3-5 KB
- With JSONB tracking (10 years of data): +500 bytes

**Database sizing estimates**:
- 1,000 patients: ~2-5 MB
- 10,000 patients: ~20-50 MB
- 100,000 patients: ~200-500 MB

*Note: These are estimates for data only, not including indexes (~30% overhead)*

---

## ✅ VALIDATION RULES

### Required Fields

```typescript
{
  name: required, maxLength: 50,
  surname: required, maxLength: 50,
  genere: required, enum: [M, F, A, N],
  tipoPaziente: required, enum: [adulto_autonomo, minorenne, ...],
}
```

### Optional but Unique

```typescript
{
  codiceFiscale: unique, length: 16,
  email: unique, maxLength: 100,
}
```

### Validated Formats

```typescript
{
  phone: regex: /^\+?[0-9\s()-]+$/,
  email: format: email,
  cap: length: 5, numeric,
  partitaIva: length: 11, numeric,
  codiceSdi: length: 7, alphanumeric,
}
```

---

## 🎯 SUMMARY

### Total Fields: 50+
- **Naming changes**: 4 (nome→name, cognome→surname, telefono→phone, note→notes)
- **New fields**: 4 (cancellationsByYear, noShowsByYear, appointments, availabilityAppointments)
- **Unchanged**: All other 40+ fields maintain same names and types
- **Enums**: 13 total (Genere, StatoCivile, TipoPaziente, etc.)
- **Computed properties**: 7 (fullName, age, hasContattoTelefonico, etc.)
- **Relations**: 4 (personeRiferimento, relazioniComeConiuge, appointments, availabilityAppointments)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-09
