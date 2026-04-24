import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceInvoicePrefix } from '../entities/service-invoice-prefix.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

/**
 * Service per i prefissi fattura per categoria operatore.
 *
 * Espone CRUD semplice e una helper per comporre la descrizione auto-generata
 * della riga fattura di un TreatmentService.
 */
@Injectable()
export class ServiceInvoicePrefixService {
  private readonly DEFAULT_BY_CATEGORY: Record<OperatorMacroCategory, string> = {
    [OperatorMacroCategory.DOCTOR]: 'Visita medica del',
    [OperatorMacroCategory.PHYSIOTHERAPIST]: 'Seduta fisioterapica del',
    [OperatorMacroCategory.GYM_INSTRUCTOR]: 'Lezione palestra del',
    [OperatorMacroCategory.OTHER]: 'Prestazione del',
  };

  constructor(
    @InjectRepository(ServiceInvoicePrefix)
    private readonly repo: Repository<ServiceInvoicePrefix>,
  ) {}

  findAll(): Promise<ServiceInvoicePrefix[]> {
    return this.repo.find({ order: { macroCategory: 'ASC' } });
  }

  findByCategory(category: OperatorMacroCategory): Promise<ServiceInvoicePrefix | null> {
    return this.repo.findOne({ where: { macroCategory: category } });
  }

  async upsert(category: OperatorMacroCategory, prefix: string): Promise<ServiceInvoicePrefix> {
    const existing = await this.findByCategory(category);
    if (existing) {
      existing.prefix = prefix;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ macroCategory: category, prefix }));
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
    const dateLabel = this.formatDateItalian(params.appointmentDate);
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

  private formatDateItalian(iso: string | null | undefined): string {
    if (!iso) return '';
    // iso può essere 'YYYY-MM-DD' o una Date
    const str = typeof iso === 'string' ? iso : (iso as any).toString();
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
}
