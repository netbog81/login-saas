import { registerEnumType } from '@nestjs/graphql';

export enum OperatorMacroCategory {
  DOCTOR = 'doctor',
  PHYSIOTHERAPIST = 'physiotherapist',
  GYM_INSTRUCTOR = 'gym_instructor'
}

registerEnumType(OperatorMacroCategory, {
  name: 'OperatorMacroCategory',
  description: 'Macro category defining what an operator can do (use instruments, manage gym, etc.)',
});
