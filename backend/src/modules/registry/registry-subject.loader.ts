import DataLoader from 'dataloader';
import { Logger } from '@nestjs/common';

import { RegistryClient } from './registry.client';
import { RegistryRequestContext, RegistrySubjectResponse } from './registry.types';
import { RegistrySubjectModel } from './models/registry-subject.model';
import { subjectResponseToModel } from './utils/subject-to-model.mapper';

const logger = new Logger('RegistrySubjectLoader');

const MAX_BATCH = 200;

/**
 * Crea un DataLoader per-request che batcha lookup di subject via
 * POST /subjects/bulk. Cache in-request (default), resetta quando finisce
 * la richiesta GraphQL.
 *
 * Il caller costruisce il loader nel context factory di Apollo passando
 * RegistryClient + RegistryRequestContext (estratto dal req).
 */
export function createSubjectLoader(
  client: RegistryClient,
  ctx: RegistryRequestContext,
): DataLoader<string, RegistrySubjectModel | null> {
  return new DataLoader<string, RegistrySubjectModel | null>(
    async (ids) => {
      const idList = [...new Set(ids)];
      logger.debug(`Bulk loading ${idList.length} subjects (tenant=${ctx.tenantAlias})`);

      try {
        // Il client gestisce internamente il limite di 200; se più grande, splittiamo
        const chunks = chunk(idList, MAX_BATCH);
        const results = await Promise.all(
          chunks.map((c) => client.bulkSubjects(c, ctx)),
        );
        const merged = results.flat();
        const byId = new Map<string, RegistrySubjectResponse>();
        let i = 0;
        for (const c of chunks) {
          for (const id of c) {
            const item = merged[i++];
            if (item) byId.set(id, item);
          }
        }

        // DataLoader contract: l'output deve essere nello stesso ordine degli ids in input
        return ids.map((id) => {
          const found = byId.get(id);
          return found ? subjectResponseToModel(found) : null;
        });
      } catch (err) {
        logger.error(`bulkSubjects failed: ${(err as Error).message}`);
        // DataLoader contract: in caso di errore, ritorniamo un array di Error
        // (uno per id), così il singolo .load() throwa.
        return ids.map(() => err as Error);
      }
    },
    { maxBatchSize: MAX_BATCH, cache: true },
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export type RegistrySubjectLoader = ReturnType<typeof createSubjectLoader>;
