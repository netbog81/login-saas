import { registerEnumType } from '@nestjs/graphql';

export enum RecurringSeriesScope {
  THIS_AND_FOLLOWING = 'this_and_following',
  ALL = 'all',
}

registerEnumType(RecurringSeriesScope, {
  name: 'RecurringSeriesScope',
  description: 'Scope delle operazioni bulk su serie ricorrenti',
});
