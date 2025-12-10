// src/pazienti/enums/pazienti-enums.ts
export enum Genere {
  MASCHIO = 'M',
  FEMMINA = 'F',
  ALTRO = 'A',
  NON_SPECIFICATO = 'N',
}

export enum StatoCivile {
  CELIBE_NUBILE = 'celibe_nubile',
  CONIUGATO = 'coniugato',
  SEPARATO = 'separato',
  DIVORZIATO = 'divorziato',
  VEDOVO = 'vedovo',
  UNIONE_CIVILE = 'unione_civile',
}

export enum TipoPaziente {
  ADULTO_AUTONOMO = 'adulto_autonomo',
  MINORENNE = 'minorenne',
  DISABILE_CON_TUTORE = 'disabile_con_tutore',
  ANZIANO_CON_TUTORE = 'anziano_con_tutore',
}

export enum StatoAnagrafica {
  BOZZA = 'bozza', // Solo dati minimi da telefono
  PARZIALE = 'parziale', // Anagrafica completa ma manca privacy
  COMPLETA = 'completa', // Anagrafica + privacy + fatturazione
  DA_VERIFICARE = 'da_verificare', // Necessita controllo dati
}

export enum StatoPrivacy {
  NON_ACQUISITA = 'non_acquisita', // Nessun documento firmato
  CARTACEA = 'cartacea', // Documenti fisici archiviati
  DIGITALE = 'digitale', // Documenti digitali firmati
  MISTA = 'mista', // Alcuni cartacei, alcuni digitali
}

export enum TipoRiferimento {
  GENITORE = 'genitore',
  TUTORE_LEGALE = 'tutore_legale',
  ACCOMPAGNATORE = 'accompagnatore',
  CONIUGE = 'coniuge',
  FIGLIO_MAGGIORENNE = 'figlio_maggiorenne',
  ALTRO_FAMILIARE = 'altro_familiare',
  ASSISTENTE_SOCIALE = 'assistente_sociale',
  BADANTE = 'badante',
}

export enum TipoPatriaPodesta {
  ENTRAMBI_GENITORI = 'entrambi_genitori', // Genitori sposati/conviventi
  GENITORE_SINGOLO = 'genitore_singolo', // Genitore single
  GENITORI_SEPARATI = 'genitori_separati', // Separati ma entrambi con patria podestà
  SOLO_PADRE = 'solo_padre', // Solo padre ha patria podestà
  SOLO_MADRE = 'solo_madre', // Solo madre ha patria podestà
  TUTORE_NOMINATO = 'tutore_nominato', // Tutore nominato dal tribunale
  AFFIDAMENTO_CONGIUNTO = 'affidamento_congiunto', // Affidamento condiviso
}

export enum StatoRelazione {
  ATTIVA = 'attiva', // Relazione corrente
  SOSPESA = 'sospesa', // Temporaneamente non valida
  SCADUTA = 'scaduta', // Non più valida (es. maggiorenne)
  REVOCATA = 'revocata', // Revocata per decisione legale/medica
}

export enum TipoConsensoRichiesto {
  SINGOLO_GENITORE = 'singolo_genitore', // Basta un genitore
  ENTRAMBI_GENITORI = 'entrambi_genitori', // Servono entrambi
  SOLO_TUTORE = 'solo_tutore', // Solo il tutore legale
  QUALSIASI_AUTORIZZATO = 'qualsiasi_autorizzato', // Chiunque sia autorizzato
}

export enum TipoTrattamentoConsenso {
  VISITA_GENERALE = 'visita_generale',
  ESAME_DIAGNOSTICO = 'esame_diagnostico',
  TRATTAMENTO_INVASIVO = 'trattamento_invasivo',
  CHIRURGIA_MINORE = 'chirurgia_minore',
  CHIRURGIA_MAGGIORE = 'chirurgia_maggiore',
  TRATTAMENTO_PSICOLOGICO = 'trattamento_psicologico',
  ANESTESIA = 'anestesia',
  SPERIMENTAZIONE = 'sperimentazione',
  EMERGENZA = 'emergenza',
}

export enum StatoConsenso {
  NON_RICHIESTO = 'non_richiesto',
  RICHIESTO = 'richiesto',
  PARZIALE = 'parziale', // Solo alcuni hanno dato consenso
  COMPLETO = 'completo', // Tutti i consensi necessari raccolti
  NEGATO = 'negato',
  SCADUTO = 'scaduto',
}
