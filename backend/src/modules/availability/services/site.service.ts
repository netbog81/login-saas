import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityManager } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../../clinical-events/clinical-event-buffer.helpers';
import { Site } from '../entities/site.entity';

export interface UpdateSiteInput {
  name?: string;
  address?: string | null;
  isActive?: boolean;
}

/**
 * Sedi operative del tenant. Il clinico è il MASTER: accounting ne tiene una
 * replica con lo stesso UUID, allineata dall'evento `site.upserted`.
 *
 * Perché il master sta qui e non in accounting: la sede è un concetto
 * operativo prima che contabile — è la sede che compare negli eventi delle
 * prestazioni, ed è a lei che sono legati disponibilità, template orari e
 * studi/poltrone. Accounting la riceve e la usa come sotto-ambito
 * (numerazione, reportistica); l'identità fiscale è l'ORGANIZZAZIONE, che è
 * un'altra cosa e vive in Keycloak.
 *
 * Sede predefinita: esattamente una, garantita dall'indice parziale
 * `UQ_sites_single_default` e mantenuta viva dall'autoguarigione qui sotto
 * (se nessuna è predefinita, la più anziana attiva viene eletta). Lato
 * contabile è la sede che usa la numerazione GENERALE.
 */
@Injectable()
export class SiteService {
  private readonly logger = new Logger(SiteService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get siteRepo() {
    return this.dataSource.getRepository(Site);
  }

  /**
   * Elenco sedi. Prima la predefinita, poi in ordine alfabetico: è l'ordine
   * in cui ha senso leggerle in una pagina di configurazione.
   */
  async findAll(onlyActive = false): Promise<Site[]> {
    await this.ensureDefaultExists();
    const qb = this.siteRepo
      .createQueryBuilder('s')
      .orderBy('s.isDefault', 'DESC')
      .addOrderBy('s.name', 'ASC');
    if (onlyActive) qb.where('s.isActive = true');
    return qb.getMany();
  }

  async findOne(id: string): Promise<Site> {
    const site = await this.siteRepo.findOne({ where: { id } });
    if (!site) throw new NotFoundException(`Sede ${id} non trovata`);
    return site;
  }

  async create(input: { name: string; address?: string | null }): Promise<Site> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Il nome della sede è obbligatorio.');

    // La prima sede in assoluto nasce predefinita: un tenant senza sede
    // predefinita non deve poter esistere.
    const existing = await this.siteRepo.count();
    const saved = await this.siteRepo.save(
      this.siteRepo.create({
        name,
        address: input.address ?? undefined,
        isActive: true,
        isDefault: existing === 0,
      }),
    );
    await this.publishUpserted(saved);
    return saved;
  }

  async update(id: string, input: UpdateSiteInput): Promise<Site> {
    const site = await this.findOne(id);

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Il nome della sede è obbligatorio.');
      site.name = name;
    }
    if (input.address !== undefined) site.address = input.address ?? undefined;
    if (input.isActive !== undefined) {
      // Disattivare la sede predefinita lascerebbe il tenant senza
      // riferimento: prima si sposta la predefinita altrove.
      if (!input.isActive && site.isDefault) {
        throw new BadRequestException(
          'La sede predefinita non può essere disattivata: designane prima un\'altra.',
        );
      }
      site.isActive = input.isActive;
    }

    const saved = await this.siteRepo.save(site);
    await this.publishUpserted(saved);
    return saved;
  }

  /**
   * Sposta la designazione di sede predefinita. Transazionale: l'indice
   * parziale ammette una sola riga con `isDefault = true`, quindi la vecchia
   * va spenta prima di accendere la nuova.
   */
  async setDefault(id: string): Promise<Site[]> {
    const site = await this.findOne(id);
    if (!site.isActive) {
      throw new BadRequestException(
        'Una sede disattivata non può essere designata come predefinita.',
      );
    }
    if (site.isDefault) return this.findAll();

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.update(Site, { isDefault: true }, { isDefault: false });
      await manager.update(Site, { id }, { isDefault: true });
    });

    // Entrambe cambiano stato: accounting deve vedere anche la retrocessione.
    for (const s of await this.siteRepo.find()) await this.publishUpserted(s);
    return this.findAll();
  }

  /**
   * Ripubblica tutte le sedi verso accounting (bootstrap della replica o
   * riallineamento dopo un buco di eventi). Stesso modello del resync degli
   * operatori.
   */
  async resyncToAccounting(): Promise<number> {
    const sites = await this.siteRepo.find();
    for (const s of sites) await this.publishUpserted(s);
    this.logger.log(`Resync sedi → accounting: ${sites.length} pubblicate.`);
    return sites.length;
  }

  /**
   * Autoguarigione: se nessuna sede è predefinita (tenant vecchio, o la
   * predefinita è stata disattivata a mano nel DB), elegge la più anziana
   * fra le attive. Silenziosa e idempotente.
   */
  private async ensureDefaultExists(): Promise<void> {
    const current = await this.siteRepo.count({ where: { isDefault: true } });
    if (current > 0) return;

    const candidate = await this.siteRepo.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (!candidate) return;

    candidate.isDefault = true;
    await this.siteRepo.save(candidate);
    this.logger.warn(
      `Nessuna sede predefinita: eletta "${candidate.name}" (${candidate.id}), la più anziana attiva.`,
    );
    await this.publishUpserted(candidate);
  }

  /**
   * Pubblica `site.upserted` verso accounting. Best-effort come per gli
   * operatori: un problema di pubblicazione non deve far fallire il
   * salvataggio: il resync ricuce.
   */
  private async publishUpserted(site: Site): Promise<void> {
    try {
      const tenantAlias = this.tenantContext.getTenantAlias();
      if (!tenantAlias) return;
      this.eventBuffer.add({
        eventType: 'site.upserted',
        payload: {
          siteId: site.id,
          name: site.name,
          address: site.address ?? null,
          isActive: site.isActive,
          isDefault: site.isDefault,
        },
        tenantAlias,
        correlationId: this.tenantContext.getContext()?.requestId,
      });
      flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    } catch (err) {
      this.logger.error(
        `publish site.upserted fallito per sede ${site.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
