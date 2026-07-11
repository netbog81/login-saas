import { Injectable } from '@nestjs/common';
import { ServiceInvoicePrefix } from '../entities/service-invoice-prefix.entity';
import { InvoiceLineSettings } from '../entities/invoice-line-settings.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { TenantContextService } from '@curandis/tenant-datasource';

/**
 * Valori risolti per i segnaposto del template descrizione riga fattura.
 * Tutti stringhe già formattate; vuoto = segnaposto assente (viene rimosso
 * con pulizia dei separatori orfani).
 */
export interface InvoiceLineDescriptionValues {
  prefisso: string;
  /** dd/MM/yyyy */
  data: string;
  codiceServizio: string;
  nomeServizio: string;
  descrizioneServizio: string;
  descrizioneFatturaSottocategoria: string;
  operatore: string;
  albo: string;
  descrizioneFatturaCategoria: string;
  /** nomi strumenti già joinati con ", " */
  strumenti: string;
}

/**
 * Service per prefissi e template della descrizione riga fattura per
 * macro-categoria (servizi ↔ operatori: stesso enum).
 *
 * Espone CRUD semplice e gli helper STATICI di composizione: statici perché
 * usati anche dal TreatmentEventMapper (modulo clinical-events) senza
 * dipendenze DI — il mapper carica i record col proprio EntityManager.
 */
@Injectable()
export class ServiceInvoicePrefixService {
  static readonly DEFAULT_BY_CATEGORY: Record<OperatorMacroCategory, string> = {
    [OperatorMacroCategory.DOCTOR]: 'Visita medica del',
    [OperatorMacroCategory.PHYSIOTHERAPIST]: 'Seduta fisioterapica del',
    [OperatorMacroCategory.GYM_INSTRUCTOR]: 'Lezione palestra del',
    [OperatorMacroCategory.OTHER]: 'Prestazione del',
  };
  private readonly DEFAULT_BY_CATEGORY = ServiceInvoicePrefixService.DEFAULT_BY_CATEGORY;

  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get repo() { return this.dataSource.getRepository(ServiceInvoicePrefix); }

  private get settingsRepo() { return this.dataSource.getRepository(InvoiceLineSettings); }

  /**
   * Impostazioni globali descrizione righe (una riga per tenant).
   * Se la riga non esiste ancora viene creata col default (toggle off).
   */
  async getSettings(): Promise<InvoiceLineSettings> {
    const existing = await this.settingsRepo.find({ take: 1 });
    if (existing.length > 0) return existing[0];
    return this.settingsRepo.save(this.settingsRepo.create({ useOperatorCategories: false }));
  }

  async setUseOperatorCategories(value: boolean): Promise<InvoiceLineSettings> {
    const settings = await this.getSettings();
    settings.useOperatorCategories = value;
    return this.settingsRepo.save(settings);
  }

  findAll(): Promise<ServiceInvoicePrefix[]> {
    return this.repo.find({ order: { macroCategory: 'ASC' } });
  }

  findByCategory(category: OperatorMacroCategory): Promise<ServiceInvoicePrefix | null> {
    return this.repo.findOne({ where: { macroCategory: category } });
  }

  async upsert(
    category: OperatorMacroCategory,
    prefix: string,
    template?: string | null,
  ): Promise<ServiceInvoicePrefix> {
    const existing = await this.findByCategory(category);
    if (existing) {
      existing.prefix = prefix;
      if (template !== undefined) {
        existing.template = template?.trim() ? template : null;
      }
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({
      macroCategory: category,
      prefix,
      template: template?.trim() ? template : null,
    }));
  }

  /**
   * Se non c'è un record salvato, ritorna il default hardcoded per categoria.
   * Utile quando la migration non è stata applicata o un record è stato cancellato.
   */
  async getPrefixOrDefault(category: OperatorMacroCategory): Promise<string> {
    const saved = await this.findByCategory(category);
    return saved?.prefix || this.DEFAULT_BY_CATEGORY[category] || 'Prestazione del';
  }

  /**
   * Compone la descrizione auto-generata per una riga fattura.
   *
   * Formato: "{prefix} {dd/MM/yyyy} — {service name}[ ({instruments})] — {operator name}[, {professional registration}]"
   *
   * @param params.prefix - prefisso della categoria operatore
   * @param params.appointmentDate - ISO date YYYY-MM-DD
   * @param params.serviceName - nome del servizio erogato
   * @param params.instrumentNames - strumenti effettivamente usati (opzionali)
   * @param params.operatorFullName - nome+cognome operatore
   * @param params.professionalRegistration - iscrizione albo (opzionale)
   */
  composeDescription(params: {
    prefix: string;
    appointmentDate: string | null | undefined;
    serviceName: string;
    instrumentNames: string[];
    operatorFullName: string;
    professionalRegistration?: string | null;
  }): string {
    return ServiceInvoicePrefixService.composeLegacy(params);
  }

  // ==================== HELPER STATICI (usati anche dal mapper) ====================

  /**
   * Sceglie la config (prefisso+template) per la composizione della
   * descrizione riga fattura, applicando il toggle "sottocategorie operatori".
   *
   * Regole:
   *  - toggle OFF → config di macro-categoria (comportamento storico);
   *  - toggle ON e la categoria dell'operatore ha almeno uno tra
   *    invoicePrefix/invoiceTemplate configurati → config di categoria
   *    (prefisso mancante → si eredita quello di macro; template mancante
   *    → composizione legacy col prefisso scelto);
   *  - toggle ON ma operatore senza categoria o categoria non configurata
   *    → fallback completo alla config di macro-categoria.
   */
  static resolveConfig(params: {
    useOperatorCategories: boolean;
    operatorCategory?: { invoicePrefix?: string | null; invoiceTemplate?: string | null } | null;
    macroCategory: OperatorMacroCategory;
    macroSaved?: { prefix: string; template?: string | null } | null;
  }): { prefix: string; template: string | null } {
    const macroPrefix = params.macroSaved?.prefix
      || ServiceInvoicePrefixService.DEFAULT_BY_CATEGORY[params.macroCategory]
      || 'Prestazione del';

    const cat = params.operatorCategory;
    const catPrefix = cat?.invoicePrefix?.trim() || '';
    const catTemplate = cat?.invoiceTemplate?.trim() || '';
    if (params.useOperatorCategories && (catPrefix || catTemplate)) {
      return {
        prefix: catPrefix || macroPrefix,
        template: catTemplate || null,
      };
    }

    return { prefix: macroPrefix, template: params.macroSaved?.template ?? null };
  }

  /** Composizione legacy basata sul prefisso (usata quando template assente). */
  static composeLegacy(params: {
    prefix: string;
    appointmentDate: string | null | undefined;
    /** Data già formattata dd/MM/yyyy: se presente vince su appointmentDate. */
    dateLabelPreformatted?: string;
    serviceName: string;
    instrumentNames: string[];
    operatorFullName: string;
    professionalRegistration?: string | null;
  }): string {
    const dateLabel = params.dateLabelPreformatted
      || ServiceInvoicePrefixService.formatDateItalian(params.appointmentDate);
    const instrBlock = params.instrumentNames.length > 0
      ? ` (${params.instrumentNames.join(', ')})`
      : '';
    const albo = params.professionalRegistration
      ? `, ${params.professionalRegistration}`
      : '';

    const parts = [
      dateLabel ? `${params.prefix} ${dateLabel}` : params.prefix,
      `${params.serviceName}${instrBlock}`,
      `${params.operatorFullName}${albo}`,
    ];
    return parts.filter(Boolean).join(' — ');
  }

  /**
   * Compone la descrizione riga fattura: se la categoria ha un `template`
   * lo renderizza sostituendo i segnaposto, altrimenti usa la composizione
   * legacy col prefisso. I segnaposto senza valore vengono rimossi con
   * pulizia dei separatori orfani (— , parentesi vuote, spazi doppi).
   */
  static composeAuto(
    config: { prefix: string; template?: string | null },
    values: InvoiceLineDescriptionValues,
  ): string {
    if (config.template && config.template.trim().length > 0) {
      return ServiceInvoicePrefixService.renderTemplate(config.template, {
        ...values,
        prefisso: config.prefix,
      });
    }
    return ServiceInvoicePrefixService.composeLegacy({
      prefix: config.prefix,
      appointmentDate: null,
      dateLabelPreformatted: values.data,
      serviceName: values.nomeServizio,
      instrumentNames: values.strumenti ? [values.strumenti] : [],
      operatorFullName: values.operatore,
      professionalRegistration: values.albo || null,
    });
  }

  /** Sostituisce i segnaposto {nome} nel template e ripulisce i separatori orfani. */
  static renderTemplate(template: string, v: InvoiceLineDescriptionValues): string {
    const map: Record<string, string> = {
      prefisso: v.prefisso,
      data: v.data,
      codice_servizio: v.codiceServizio,
      nome_servizio: v.nomeServizio,
      descrizione_servizio: v.descrizioneServizio,
      descrizione_fattura_sottocategoria: v.descrizioneFatturaSottocategoria,
      operatore: v.operatore,
      albo: v.albo,
      descrizione_fattura_categoria: v.descrizioneFatturaCategoria,
      strumenti: v.strumenti,
    };
    let out = template.replace(/\{([a-z_]+)\}/g, (_m, key: string) => map[key] ?? '');
    // Pulizia: parentesi vuote, separatori — e virgole orfani, spazi multipli.
    out = out
      .replace(/\(\s*\)/g, '')
      .replace(/\s*—(\s*—)+\s*/g, ' — ')
      .replace(/,\s*(,\s*)+/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s—,]+/, '')
      .replace(/[\s—,]+$/, '')
      .trim();
    return out;
  }

  static formatDateItalian(iso: string | null | undefined): string {
    if (!iso) return '';
    // iso può essere 'YYYY-MM-DD' o una Date
    const str = typeof iso === 'string' ? iso : (iso as any).toString();
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  private formatDateItalian(iso: string | null | undefined): string {
    return ServiceInvoicePrefixService.formatDateItalian(iso);
  }
}
