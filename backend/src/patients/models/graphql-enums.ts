// GraphQL Enum Registration
// This file registers TypeScript enums for use in GraphQL schema

import { registerEnumType } from '@nestjs/graphql';
import {
  Genere,
  StatoCivile,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
  TipoRiferimento,
  TipoPatriaPodesta,
  StatoRelazione,
  TipoConsensoRichiesto,
  TipoTrattamentoConsenso,
  StatoConsenso,
} from '../enums/pazienti-enums';

// ==================== GENERE ====================
registerEnumType(Genere, {
  name: 'Genere',
  description: 'Genere del paziente',
  valuesMap: {
    MASCHIO: {
      description: 'Maschio',
    },
    FEMMINA: {
      description: 'Femmina',
    },
    ALTRO: {
      description: 'Altro',
    },
    NON_SPECIFICATO: {
      description: 'Non specificato',
    },
  },
});

// ==================== STATO CIVILE ====================
registerEnumType(StatoCivile, {
  name: 'StatoCivile',
  description: 'Stato civile del paziente',
  valuesMap: {
    CELIBE_NUBILE: {
      description: 'Celibe/Nubile',
    },
    CONIUGATO: {
      description: 'Coniugato/a',
    },
    SEPARATO: {
      description: 'Separato/a',
    },
    DIVORZIATO: {
      description: 'Divorziato/a',
    },
    VEDOVO: {
      description: 'Vedovo/a',
    },
    UNIONE_CIVILE: {
      description: 'Unione civile',
    },
  },
});

// ==================== TIPO PAZIENTE ====================
registerEnumType(TipoPaziente, {
  name: 'TipoPaziente',
  description: 'Tipo di paziente per gestione consensi',
  valuesMap: {
    ADULTO_AUTONOMO: {
      description: 'Adulto autonomo - può fornire consenso in autonomia',
    },
    MINORENNE: {
      description: 'Minorenne - richiede consenso genitori/tutore',
    },
    DISABILE_CON_TUTORE: {
      description: 'Disabile con tutore legale nominato',
    },
    ANZIANO_CON_TUTORE: {
      description: 'Anziano con tutore/amministratore di sostegno',
    },
  },
});

// ==================== STATO ANAGRAFICA ====================
registerEnumType(StatoAnagrafica, {
  name: 'StatoAnagrafica',
  description: 'Stato di completamento anagrafica paziente',
  valuesMap: {
    BOZZA: {
      description: 'Bozza - Solo dati minimi da telefono',
    },
    PARZIALE: {
      description: 'Parziale - Anagrafica completa ma manca privacy',
    },
    COMPLETA: {
      description: 'Completa - Anagrafica + privacy + fatturazione',
    },
    DA_VERIFICARE: {
      description: 'Da verificare - Necessita controllo dati',
    },
  },
});

// ==================== STATO PRIVACY ====================
registerEnumType(StatoPrivacy, {
  name: 'StatoPrivacy',
  description: 'Stato acquisizione documenti privacy',
  valuesMap: {
    NON_ACQUISITA: {
      description: 'Non acquisita - Nessun documento firmato',
    },
    CARTACEA: {
      description: 'Cartacea - Documenti fisici archiviati',
    },
    DIGITALE: {
      description: 'Digitale - Documenti digitali firmati',
    },
    MISTA: {
      description: 'Mista - Alcuni cartacei, alcuni digitali',
    },
  },
});

// ==================== TIPO RIFERIMENTO ====================
registerEnumType(TipoRiferimento, {
  name: 'TipoRiferimento',
  description: 'Tipo di persona di riferimento per il paziente',
  valuesMap: {
    GENITORE: {
      description: 'Genitore',
    },
    TUTORE_LEGALE: {
      description: 'Tutore legale nominato dal tribunale',
    },
    ACCOMPAGNATORE: {
      description: 'Accompagnatore occasionale',
    },
    CONIUGE: {
      description: 'Coniuge',
    },
    FIGLIO_MAGGIORENNE: {
      description: 'Figlio maggiorenne',
    },
    ALTRO_FAMILIARE: {
      description: 'Altro familiare',
    },
    ASSISTENTE_SOCIALE: {
      description: 'Assistente sociale',
    },
    BADANTE: {
      description: 'Badante',
    },
  },
});

// ==================== TIPO PATRIA PODESTA ====================
registerEnumType(TipoPatriaPodesta, {
  name: 'TipoPatriaPodesta',
  description: 'Tipo di patria podestà per minori',
  valuesMap: {
    ENTRAMBI_GENITORI: {
      description: 'Entrambi i genitori - sposati/conviventi',
    },
    GENITORE_SINGOLO: {
      description: 'Genitore singolo',
    },
    GENITORI_SEPARATI: {
      description: 'Genitori separati - entrambi con patria podestà',
    },
    SOLO_PADRE: {
      description: 'Solo il padre ha patria podestà',
    },
    SOLO_MADRE: {
      description: 'Solo la madre ha patria podestà',
    },
    TUTORE_NOMINATO: {
      description: 'Tutore nominato dal tribunale',
    },
    AFFIDAMENTO_CONGIUNTO: {
      description: 'Affidamento congiunto condiviso',
    },
  },
});

// ==================== STATO RELAZIONE ====================
registerEnumType(StatoRelazione, {
  name: 'StatoRelazione',
  description: 'Stato della relazione paziente-persona riferimento',
  valuesMap: {
    ATTIVA: {
      description: 'Attiva - Relazione corrente',
    },
    SOSPESA: {
      description: 'Sospesa - Temporaneamente non valida',
    },
    SCADUTA: {
      description: 'Scaduta - Non più valida (es. maggiorenne)',
    },
    REVOCATA: {
      description: 'Revocata - Revocata per decisione legale/medica',
    },
  },
});

// ==================== TIPO CONSENSO RICHIESTO ====================
registerEnumType(TipoConsensoRichiesto, {
  name: 'TipoConsensoRichiesto',
  description: 'Tipo di consenso richiesto per trattamenti',
  valuesMap: {
    SINGOLO_GENITORE: {
      description: 'Singolo genitore - Basta un genitore',
    },
    ENTRAMBI_GENITORI: {
      description: 'Entrambi i genitori richiesti',
    },
    SOLO_TUTORE: {
      description: 'Solo il tutore legale',
    },
    QUALSIASI_AUTORIZZATO: {
      description: 'Qualsiasi persona autorizzata',
    },
  },
});

// ==================== TIPO TRATTAMENTO CONSENSO ====================
registerEnumType(TipoTrattamentoConsenso, {
  name: 'TipoTrattamentoConsenso',
  description: 'Tipo di trattamento medico che richiede consenso',
  valuesMap: {
    VISITA_GENERALE: {
      description: 'Visita generale',
    },
    ESAME_DIAGNOSTICO: {
      description: 'Esame diagnostico',
    },
    TRATTAMENTO_INVASIVO: {
      description: 'Trattamento invasivo',
    },
    CHIRURGIA_MINORE: {
      description: 'Chirurgia minore',
    },
    CHIRURGIA_MAGGIORE: {
      description: 'Chirurgia maggiore',
    },
    TRATTAMENTO_PSICOLOGICO: {
      description: 'Trattamento psicologico',
    },
    ANESTESIA: {
      description: 'Anestesia',
    },
    SPERIMENTAZIONE: {
      description: 'Sperimentazione clinica',
    },
    EMERGENZA: {
      description: 'Emergenza',
    },
  },
});

// ==================== STATO CONSENSO ====================
registerEnumType(StatoConsenso, {
  name: 'StatoConsenso',
  description: 'Stato del consenso per trattamento',
  valuesMap: {
    NON_RICHIESTO: {
      description: 'Non richiesto',
    },
    RICHIESTO: {
      description: 'Richiesto ma non ancora fornito',
    },
    PARZIALE: {
      description: 'Parziale - Solo alcuni hanno dato consenso',
    },
    COMPLETO: {
      description: 'Completo - Tutti i consensi necessari raccolti',
    },
    NEGATO: {
      description: 'Negato',
    },
    SCADUTO: {
      description: 'Scaduto',
    },
  },
});
