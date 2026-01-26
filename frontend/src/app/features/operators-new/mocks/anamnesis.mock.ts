/**
 * Anamnesis Mock Data
 * Dati di test per lo sviluppo del mock UI
 */

import { AnamnesisComplete } from '../models/anamnesis.model';

/**
 * Mock di un'anamnesi completa per testing
 */
export const MOCK_ANAMNESIS_COMPLETE: AnamnesisComplete = {
  id: 'anamnesis-mock-001',
  pathId: 'path-mock-001',

  // Sezione 1: Informazioni Generali
  generalInfo: {
    nome: 'Mario',
    cognome: 'Rossi',
    eta: 45,
    sesso: 'MASCHIO',
    professione: 'Impiegato bancario',
    sportPraticati: ['Calcio amatoriale', 'Nuoto', 'Ciclismo'],
    bmi: 24.5
  },

  // Sezione 2: Immagine Corporea
  bodyMap: {
    markers: [
      { id: 'marker-1', x: 0.48, y: 0.28, note: 'Dolore spalla destra' },
      { id: 'marker-2', x: 0.50, y: 0.52, note: 'Lombalgia cronica' },
      { id: 'marker-3', x: 0.35, y: 0.70, note: 'Dolore ginocchio sinistro' }
    ]
  },

  // Sezione 3: Anamnesi Patologica Remota
  remoteHistory: {
    patologiePregresse: 'Ipertensione arteriosa in trattamento farmacologico dal 2018. Diabete mellito tipo 2 diagnosticato nel 2020, attualmente ben controllato con dieta.',
    interventiChirurgici: 'Appendicectomia laparoscopica (2010). Artroscopia ginocchio destro per meniscectomia parziale (2015).',
    traumi: 'Frattura clavicola sinistra da incidente sportivo (2008). Distorsione caviglia destra grado II (2019).',
    terapiaFarmacologica: ['Ramipril 5mg (1 cp/die)', 'Cardioaspirina 100mg', 'Metformina 500mg (2 cp/die)']
  },

  // Sezione 4: Anamnesi Patologica Prossima
  recentHistory: {
    motivoConsulto: 'Dolore lombare persistente con irradiazione alla gamba sinistra, presente da circa 3 mesi. Il paziente riferisce difficoltà nel mantenere la posizione seduta prolungata e nel sollevare pesi.',
    esordioSintomi: 'Circa 3 mesi fa, dopo aver sollevato un peso in modo scorretto durante trasloco',
    statoAttualeSintomi: 'Dolore costante di intensità moderata (VAS 6/10) con episodi di esacerbazione (VAS 8/10). Presente parestesia L5-S1 sinistra.',
    fattoriAllevianti: ['Riposo in posizione supina', 'Applicazione di calore locale', 'Ibuprofene al bisogno', 'Stretching leggero'],
    fattoriAggravanti: ['Flessione del tronco', 'Stazione eretta prolungata', 'Guida auto', 'Tosse e starnuti', 'Sollevamento pesi'],
    andamentoDolore: 'Peggioramento nelle ore serali e dopo attività lavorativa. Miglioramento relativo dopo riposo notturno.'
  },

  // Sezione 5: Esame Obiettivo
  objectiveExam: {
    osservazione: 'Iperlordosi lombare con rettilineizzazione del tratto dorsale. Spalle anteposte, scapole alate. Leggera asimmetria del bacino con inclinazione a sinistra.',
    palpazione: 'Contrattura paravertebrale bilaterale a livello L3-L5, più accentuata a sinistra. Trigger point attivo sul muscolo piriforme sinistro. Dolorabilità alla palpazione dei processi spinosi L4-L5.',
    movimentoPassivo: 'Limitazione della flessione lombare di circa 30%. Estensione lombare dolorosa agli ultimi gradi. Rotazione conservata bilateralmente.',
    movimentoAttivo: 'ROM ridotto in flessione (paziente raggiunge le ginocchia). Estensione limitata e dolorosa. Latero-flessione limitata a sinistra.',
    forzaMuscolare: 'Deficit del gluteo medio sinistro (4/5). Debolezza del quadricipite sinistro (4+/5). Resto nella norma.',
    equilibrio: 'Romberg negativo. Lieve instabilità in appoggio monopodalico sinistro.',
    testSpecifici: [
      { id: 'test-1', nome: 'Test di Lasègue', risultato: 'Positivo a sinistra a 50°, negativo a destra', data: null, superato: false },
      { id: 'test-2', nome: 'Test FABER', risultato: 'Positivo a sinistra', data: null, superato: false },
      { id: 'test-3', nome: 'Test di Slump', risultato: 'Positivo per componente neurale', data: null, superato: false },
      { id: 'test-4', nome: 'Test di Thomas', risultato: 'Negativo bilateralmente', data: null, superato: true },
      { id: 'test-5', nome: 'Test di Ober', risultato: 'Lieve positività a sinistra', data: null, superato: false }
    ],
    esameNeurologico: 'ROT normoelicitabili e simmetrici. Sensibilità conservata ai territori L4-L5-S1. Forza muscolare miotomerica nella norma eccetto deficit citati.',
    limitazioniAttivita: 'Difficoltà nel sollevare pesi superiori a 5 kg. Impossibilità di stare seduto per più di 30 minuti. Limitazione nella pratica sportiva. Difficoltà nel guidare per tragitti superiori a 20 minuti.',
    fattoriPrognosticiPositivi: 'Paziente motivato e collaborante. Buona compliance attesa. Assenza di red flags. Supporto familiare presente. Possibilità di modificare temporaneamente le mansioni lavorative.',
    fattoriPrognosticiNegativi: 'Lavoro sedentario con postura prolungata. Leggero sovrappeso (BMI 24.5). Storia di precedente trauma lombare. Componente ansiosa riferita.',
    strategieCoping: 'Il paziente tende ad evitare le attività che provocano dolore (fear-avoidance). Riferisce frustrazione per la limitazione funzionale. Utilizza farmaci antinfiammatori al bisogno.',
    diagnosiFisioterapica: 'Lombalgia meccanica aspecifica con componente radicolare L5-S1 sinistra. Sindrome miofasciale dei muscoli paravertebrali e piriforme. Deficit di stabilità del core e controllo motorio lombo-pelvico.'
  },

  // Sezione 6: Esami Diagnostici
  diagnosticExams: [
    {
      id: 'exam-1',
      nomeEsame: 'RX Rachide Lombosacrale',
      data: new Date('2024-01-15'),
      note: 'Riduzione dello spazio discale L4-L5 e L5-S1. Osteofitosi marginale. Lieve scoliosi con convessità destra.'
    },
    {
      id: 'exam-2',
      nomeEsame: 'RMN Rachide Lombare',
      data: new Date('2024-02-01'),
      note: 'Protrusione discale postero-laterale sinistra L4-L5 con impronta sulla radice L5. Protrusione discale mediana L5-S1. Degenerazione discale a livelli multipli.'
    },
    {
      id: 'exam-3',
      nomeEsame: 'EMG arti inferiori',
      data: new Date('2024-02-10'),
      note: 'Segni di sofferenza radicolare L5 sinistra di grado lieve-moderato. Non segni di denervazione attiva.'
    }
  ],

  // Sezione 7: Pianificazione Trattamento
  treatmentPlan: {
    obiettiviBreveTermine: [
      { id: 'obj-bt-1', descrizione: 'Riduzione del dolore a riposo (VAS < 4/10)', raggiunto: false, dataRaggiungimento: null },
      { id: 'obj-bt-2', descrizione: 'Miglioramento della mobilità lombare in flessione', raggiunto: false, dataRaggiungimento: null },
      { id: 'obj-bt-3', descrizione: 'Riduzione della contrattura muscolare paravertebrale', raggiunto: false, dataRaggiungimento: null }
    ],
    obiettiviMedioTermine: [
      { id: 'obj-mt-1', descrizione: 'Ripresa della posizione seduta prolungata (> 1 ora)', raggiunto: false, dataRaggiungimento: null },
      { id: 'obj-mt-2', descrizione: 'Miglioramento della stabilità del core (passaggio a esercizi dinamici)', raggiunto: false, dataRaggiungimento: null },
      { id: 'obj-mt-3', descrizione: 'Ripresa attività lavorativa senza limitazioni', raggiunto: false, dataRaggiungimento: null }
    ],
    obiettiviLungoTermine: [
      { id: 'obj-lt-1', descrizione: 'Prevenzione delle recidive attraverso programma di esercizi domiciliari', raggiunto: false, dataRaggiungimento: null },
      { id: 'obj-lt-2', descrizione: 'Ritorno graduale all\'attività sportiva (nuoto, ciclismo)', raggiunto: false, dataRaggiungimento: null },
      { id: 'obj-lt-3', descrizione: 'Autogestione del problema attraverso strategie di self-management', raggiunto: false, dataRaggiungimento: null }
    ],
    interventiProposti: [
      'Terapia manuale (mobilizzazione articolare, tecniche miofasciali)',
      'Esercizio terapeutico (core stability, stretching, rinforzo)',
      'Educazione posturale e ergonomia',
      'Tecniche di neurodinamica',
      'Terapia fisica strumentale (TENS, ultrasuoni)',
      'Programma di esercizi domiciliari progressivo'
    ],
    frequenzaSedute: '2 sedute/settimana per le prime 4 settimane, poi 1 seduta/settimana per altre 4 settimane'
  },

  // Sezione 8: Monitoraggio e Rivalutazione
  monitoring: {
    testSpecifici: [
      { id: 'mon-test-1', nome: 'Oswestry Disability Index (ODI)', risultato: '42% (disabilità moderata)', data: new Date('2024-02-10'), superato: null },
      { id: 'mon-test-2', nome: 'Roland-Morris Questionnaire', risultato: '14/24', data: new Date('2024-02-10'), superato: null },
      { id: 'mon-test-3', nome: 'VAS dolore a riposo', risultato: '6/10', data: new Date('2024-02-10'), superato: null },
      { id: 'mon-test-4', nome: 'VAS dolore in movimento', risultato: '8/10', data: new Date('2024-02-10'), superato: null }
    ],
    outcome: 'Da rivalutare dopo 8 sedute (4 settimane). Outcome primario: riduzione ODI del 30%. Outcome secondario: VAS < 4, ripresa posizione seduta > 1h.',
    criticita: [
      'Compliance agli esercizi domiciliari da monitorare',
      'Gestione dello stress lavorativo',
      'Tendenza al fear-avoidance da affrontare con educazione',
      'Necessità di perdita di peso per ottimizzare i risultati'
    ]
  },

  // Metadata
  createdAt: new Date('2024-02-10T10:30:00'),
  updatedAt: new Date('2024-02-10T10:30:00'),
  createdBy: 'operator-001'
};

/**
 * Mock di un'anamnesi vuota/parziale per testing
 */
export const MOCK_ANAMNESIS_PARTIAL: AnamnesisComplete = {
  id: 'anamnesis-mock-002',
  pathId: 'path-mock-002',

  generalInfo: {
    nome: 'Anna',
    cognome: 'Bianchi',
    eta: 32,
    sesso: 'FEMMINA',
    professione: null,
    sportPraticati: [],
    bmi: null
  },

  bodyMap: {
    markers: []
  },

  remoteHistory: {
    patologiePregresse: null,
    interventiChirurgici: null,
    traumi: null,
    terapiaFarmacologica: []
  },

  recentHistory: {
    motivoConsulto: 'Cervicalgia con cefalea tensiva',
    esordioSintomi: 'Da circa 2 settimane',
    statoAttualeSintomi: null,
    fattoriAllevianti: [],
    fattoriAggravanti: ['Lavoro al computer'],
    andamentoDolore: null
  },

  objectiveExam: {
    osservazione: null,
    palpazione: null,
    movimentoPassivo: null,
    movimentoAttivo: null,
    forzaMuscolare: null,
    equilibrio: null,
    testSpecifici: [],
    esameNeurologico: null,
    limitazioniAttivita: null,
    fattoriPrognosticiPositivi: null,
    fattoriPrognosticiNegativi: null,
    strategieCoping: null,
    diagnosiFisioterapica: null
  },

  diagnosticExams: [],

  treatmentPlan: {
    obiettiviBreveTermine: [],
    obiettiviMedioTermine: [],
    obiettiviLungoTermine: [],
    interventiProposti: [],
    frequenzaSedute: null
  },

  monitoring: {
    testSpecifici: [],
    outcome: null,
    criticita: []
  },

  createdAt: new Date('2024-02-15T14:00:00'),
  updatedAt: new Date('2024-02-15T14:00:00'),
  createdBy: 'operator-002'
};

/**
 * Lista di mock per testing
 */
export const MOCK_ANAMNESIS_LIST: AnamnesisComplete[] = [
  MOCK_ANAMNESIS_COMPLETE,
  MOCK_ANAMNESIS_PARTIAL
];
