# GraphQL Test Queries for Availability Management

## Test di base

Apri GraphQL Playground a: http://localhost:3000/graphql

## 1. Crea un operatore

```graphql
mutation CreateOperator {
  createOperator(input: {
    name: "Mario",
    surname: "Rossi",
    email: "mario.rossi@example.com",
    operatorType: STANDARD,
    maxConcurrentAppointments: 1,
    color: "#FF6B6B"
  }) {
    id
    name
    surname
    email
    operatorType
    maxConcurrentAppointments
  }
}
```

## 2. Crea un operatore palestra

```graphql
mutation CreateGymOperator {
  createOperator(input: {
    name: "Giovanni",
    surname: "Verdi",
    email: "giovanni.verdi@gym.com",
    operatorType: GYM,
    maxConcurrentAppointments: 10,
    color: "#45B7D1"
  }) {
    id
    name
    surname
    email
    operatorType
    maxConcurrentAppointments
  }
}
```

## 3. Crea un servizio

```graphql
mutation CreateService {
  createService(input: {
    name: "Taglio Capelli",
    duration: 30,
    bufferTime: 5,
    color: "#4ECDC4"
  }) {
    id
    name
    duration
    bufferTime
  }
}
```

## 4. Crea un template di disponibilità (settimanale)

```graphql
mutation CreateWeeklyTemplate {
  createAvailabilityTemplate(input: {
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    name: "Orario Standard",
    description: "Dal lunedì al venerdì",
    dayInPattern: 1,  # Lunedì
    patternDuration: 7,  # Ciclo settimanale
    patternStartDate: "2024-01-01",
    startTime: "09:00",
    endTime: "18:00",
    validFrom: "2024-01-01"
  }) {
    id
    name
    dayInPattern
    patternDuration
    startTime
    endTime
  }
}
```

## 5. Crea un template bi-settimanale (turni A/B)

```graphql
mutation CreateBiWeeklyTemplate {
  createAvailabilityTemplate(input: {
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    name: "Turno A",
    description: "Prima settimana del ciclo",
    dayInPattern: 2,  # Mercoledì della prima settimana
    patternDuration: 14,  # Ciclo bi-settimanale
    patternStartDate: "2024-01-01",
    startTime: "08:00",
    endTime: "16:00",
    validFrom: "2024-01-01"
  }) {
    id
    name
    dayInPattern
    patternDuration
  }
}
```

## 6. Query disponibilità operatore

```graphql
query GetOperatorAvailability {
  operatorAvailability(
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    startDate: "2024-01-01",
    endDate: "2024-01-31"
  ) {
    date
    hasAvailability
    slots {
      startTime
      endTime
      availableCapacity
      isAvailable
      source
    }
  }
}
```

## 7. Query slot disponibili per una data

```graphql
query GetAvailableSlots {
  availableSlots(
    date: "2024-01-15"
  ) {
    operatorId
    startTime
    endTime
    totalCapacity
    availableCapacity
    isAvailable
  }
}
```

## 8. Crea un'eccezione (ferie)

```graphql
mutation CreateHolidayException {
  createAvailabilityException(
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    date: "2024-01-20",
    type: "vacation",
    reason: "Ferie invernali"
  )
}
```

## 9. Crea un'eccezione con orario modificato

```graphql
mutation CreateModifiedException {
  createAvailabilityException(
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    date: "2024-01-15",
    type: "modified",
    startTime: "14:00",
    endTime: "20:00",
    reason: "Orario pomeridiano straordinario"
  )
}
```

## 10. Verifica disponibilità slot

```graphql
query CheckSlotAvailability {
  checkSlotAvailability(
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    date: "2024-01-15",
    startTime: "10:00",
    endTime: "11:00"
  )
}
```

## 11. Ricostruisci cache disponibilità

```graphql
mutation RebuildCache {
  rebuildAvailabilityCache(
    operatorId: "INSERISCI_ID_OPERATORE_QUI",
    startDate: "2024-01-01",
    endDate: "2024-01-31"
  )
}
```

## Nota importante

Sostituisci `INSERISCI_ID_OPERATORE_QUI` con l'ID UUID reale ottenuto dalla creazione dell'operatore.

## Test completo passo-passo:

1. Crea un operatore
2. Copia il suo ID
3. Crea un template di disponibilità usando quell'ID
4. Query la disponibilità per verificare che sia stata creata
5. Crea un'eccezione
6. Query di nuovo per vedere l'eccezione applicata