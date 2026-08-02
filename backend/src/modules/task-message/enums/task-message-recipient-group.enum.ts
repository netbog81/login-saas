import { registerEnumType } from '@nestjs/graphql';

/**
 * Gruppi destinatario per i messaggi task. I valori coincidono con
 * AppUserType: l'appartenenza al gruppo è determinata da app_users.user_type.
 */
export enum TaskMessageRecipientGroup {
  SECRETARY = 'secretary',
}

registerEnumType(TaskMessageRecipientGroup, {
  name: 'TaskMessageRecipientGroup',
  description: 'Gruppo destinatario di un task message (membri = utenti attivi con quel user_type)',
});
