import { registerEnumType } from '@nestjs/graphql';

/**
 * ObjectiveType - Tipo di obiettivo terapeutico
 */
export enum ObjectiveType {
  BREVE_TERMINE = 'breve_termine',     // Obiettivi a breve termine (1-4 settimane)
  MEDIO_TERMINE = 'medio_termine',     // Obiettivi a medio termine (1-3 mesi)
  LUNGO_TERMINE = 'lungo_termine'      // Obiettivi a lungo termine (3+ mesi)
}

/**
 * TestSection - Sezione dell'anamnesi in cui si trova il test
 */
export enum TestSection {
  ESAME_OBIETTIVO = 'esame_obiettivo',   // Test nella sezione 5 (Esame Obiettivo)
  MONITORAGGIO = 'monitoraggio'          // Test nella sezione 8 (Monitoraggio)
}

// Register enums for GraphQL
registerEnumType(ObjectiveType, {
  name: 'ObjectiveType',
  description: 'Tipo di obiettivo terapeutico (breve, medio, lungo termine)',
});

registerEnumType(TestSection, {
  name: 'TestSection',
  description: 'Sezione dell\'anamnesi in cui si trova il test',
});
