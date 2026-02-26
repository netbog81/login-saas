import { registerEnumType } from '@nestjs/graphql';

export enum AppUserType {
  OPERATOR = 'operator',
  SECRETARY = 'secretary',
  PRIVACY_OFFICER = 'privacy_officer',
  IT_MANAGER = 'it_manager',
}

registerEnumType(AppUserType, {
  name: 'AppUserType',
  description: 'Tipologia di utente applicativo',
});
