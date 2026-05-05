import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { RegistryAddressModel } from '../models/registry-address.model';
import { RegistrySubjectModel } from '../models/registry-subject.model';

@Resolver(() => RegistrySubjectModel)
export class RegistrySubjectFieldsResolver {
  @ResolveField('displayName', () => String, { nullable: true })
  displayName(@Parent() s: RegistrySubjectModel): string | undefined {
    if (s.subjectType === 'INDIVIDUAL') {
      const parts = [s.firstName, s.lastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : undefined;
    }
    return s.legalName;
  }

  @ResolveField('primaryAddress', () => RegistryAddressModel, { nullable: true })
  primaryAddress(@Parent() s: RegistrySubjectModel): RegistryAddressModel | undefined {
    const addrs = s.addresses || [];
    return (
      addrs.find((a) => a.isPrimary && a.addressType === 'RESIDENCE') ||
      addrs.find((a) => a.isPrimary) ||
      addrs.find((a) => a.addressType === 'RESIDENCE') ||
      addrs[0]
    );
  }

  @ResolveField('primaryEmail', () => String, { nullable: true })
  primaryEmail(@Parent() s: RegistrySubjectModel): string | undefined {
    const contacts = s.contacts || [];
    const primary = contacts.find((c) => c.isPrimary && c.contactType === 'EMAIL');
    return primary?.value || contacts.find((c) => c.contactType === 'EMAIL')?.value;
  }

  @ResolveField('primaryPhone', () => String, { nullable: true })
  primaryPhone(@Parent() s: RegistrySubjectModel): string | undefined {
    const contacts = s.contacts || [];
    const mobile = contacts.find(
      (c) => c.isPrimary && (c.contactType === 'MOBILE' || c.contactType === 'PHONE'),
    );
    if (mobile) return mobile.value;
    return (
      contacts.find((c) => c.contactType === 'MOBILE')?.value ||
      contacts.find((c) => c.contactType === 'PHONE')?.value
    );
  }
}
