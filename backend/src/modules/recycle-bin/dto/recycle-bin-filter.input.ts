import { InputType, Field, ID } from '@nestjs/graphql';
import { RecycleBinEntityType } from './recycle-bin-item.type';

/**
 * Filtri per la query `recycleBin`.
 *
 * - `ownerUserId`: l'utente non-admin lo riceve auto-popolato lato server
 *   col proprio appUserId, e non può overridarlo. Admin con
 *   `recycle_bin_restore_any` può filtrare per qualunque proprietario o
 *   ometterlo per vedere tutto.
 */
@InputType()
export class RecycleBinFilterInput {
  @Field(() => [RecycleBinEntityType], {
    nullable: true,
    description: 'Tipi di entità da includere. Default: tutti.',
  })
  entityTypes?: RecycleBinEntityType[];

  @Field(() => ID, {
    nullable: true,
    description: 'Filtra per AppUser proprietario (admin only)',
  })
  ownerUserId?: string;

  @Field({ nullable: true, description: 'Stringa libera (matching su title/subtitle)' })
  search?: string;
}
