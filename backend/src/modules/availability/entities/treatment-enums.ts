import { registerEnumType } from '@nestjs/graphql';

/**
 * TreatmentStatus - Stato del trattamento (workflow in clinica)
 */
export enum TreatmentStatus {
  WAITING = 'waiting',                   // In sala d'attesa (per compatibilità DB)
  IN_PROGRESS = 'in_progress',           // Trattamento in corso
  OPERATOR_COMPLETED = 'operator_completed', // Operatore ha finito
  CLOSED = 'closed'                      // Segreteria ha chiuso
}

/**
 * PaymentMethod - Metodo di pagamento
 */
export enum PaymentMethod {
  CASH = 'cash',           // Contanti
  CARD = 'card',           // Bancomat/Carta
  TRANSFER = 'transfer',   // Bonifico
  SATISPAY = 'satispay',
  OTHER = 'other'
}

// Register enums for GraphQL
registerEnumType(TreatmentStatus, {
  name: 'TreatmentStatus',
  description: 'Treatment workflow status',
});

registerEnumType(PaymentMethod, {
  name: 'PaymentMethod',
  description: 'Payment method used',
});
