import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';
import { VoucherFe } from '../entities/voucher-fe.entity';
import { VoucherFeUsage } from '../entities/voucher-fe-usage.entity';

export interface IssueVoucherFeInput {
  patientId: string;
  initialAmount: number;
  expiryDate?: string;
  notes?: string;
}

/**
 * Service del Voucher FE (PARTE 4.3) — voucher prepagati 100% clinici, usati
 * come metodo di pagamento per i trattamenti con sconto FE. Nessuna
 * interazione con accounting.
 */
@Injectable()
export class VoucherFeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get repo() {
    return this.dataSource.getRepository(VoucherFe);
  }

  /** Voucher FE utilizzabili da un paziente: attivi, residuo > 0, non scaduti. */
  async findUsableForPatient(patientId: string): Promise<VoucherFe[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.repo
      .createQueryBuilder('v')
      .where('v.patientId = :patientId', { patientId })
      .andWhere('v.status = :status', { status: 'active' })
      .andWhere('CAST(v.residualAmount AS numeric) > 0')
      .andWhere('(v.expiryDate IS NULL OR v.expiryDate >= :today)', { today })
      .orderBy('v.expiryDate', 'ASC', 'NULLS LAST')
      .getMany();
  }

  findByPatient(patientId: string): Promise<VoucherFe[]> {
    return this.repo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Tutti i voucher FE del tenant, opzionalmente filtrati per data di
   * emissione (createdAt). `from`/`to` sono date YYYY-MM-DD inclusive.
   * Usato dalla pagina Statistiche.
   */
  findAll(from?: string, to?: string): Promise<VoucherFe[]> {
    const qb = this.repo.createQueryBuilder('v');
    if (from) qb.andWhere('v.createdAt >= :from', { from });
    if (to) qb.andWhere("v.createdAt < ((:to)::date + interval '1 day')", { to });
    return qb.orderBy('v.createdAt', 'DESC').getMany();
  }

  /**
   * Modifica l'importo di un voucher FE.
   * - Mai consumato (residuo = iniziale) → si modifica l'importo INIZIALE
   *   (il residuo lo segue).
   * - Parzialmente consumato → si modifica solo il RESIDUO; l'iniziale resta
   *   (ciò che è già stato usato non si riconteggia).
   * Registra un movimento `adjustment` per tracciabilità.
   */
  async updateAmount(
    voucherFeId: string,
    amount: number,
    createdByUserId?: string,
  ): Promise<VoucherFe> {
    const value = Math.round(amount * 100) / 100;
    return this.dataSource.transaction(async (manager) => {
      const voucher = await manager
        .createQueryBuilder(VoucherFe, 'v')
        .setLock('pessimistic_write')
        .where('v.id = :id', { id: voucherFeId })
        .getOne();
      if (!voucher) {
        throw new NotFoundException(`Voucher FE ${voucherFeId} non trovato.`);
      }
      if (voucher.status === 'cancelled') {
        throw new BadRequestException("Un voucher FE annullato non è modificabile.");
      }
      const initial = Number(voucher.initialAmount);
      const residual = Number(voucher.residualAmount);
      const consumed = Math.round((initial - residual) * 100) / 100;

      let newInitial = initial;
      let newResidual: number;
      if (consumed <= 0.005) {
        // Voucher intatto: si modifica l'importo iniziale.
        if (value <= 0) {
          throw new BadRequestException("L'importo del voucher FE deve essere positivo.");
        }
        newInitial = value;
        newResidual = value;
      } else {
        // Parzialmente consumato: si modifica solo il residuo.
        if (value < 0) {
          throw new BadRequestException('Il residuo non può essere negativo.');
        }
        newResidual = value;
      }

      // Ricalcolo stato (mantenendo la sospensione manuale 'inactive').
      let newStatus = voucher.status;
      if (voucher.status !== 'inactive') {
        newStatus = newResidual <= 0.005 ? 'depleted' : 'active';
      }

      await manager.update(VoucherFe, voucher.id, {
        initialAmount: newInitial,
        residualAmount: newResidual,
        status: newStatus,
      });
      await manager.save(
        manager.create(VoucherFeUsage, {
          voucherFeId: voucher.id,
          type: 'adjustment',
          amount: Math.abs(newResidual - residual),
          residualAfter: newResidual,
          createdByUserId,
        }),
      );
      return (await manager.findOneByOrFail(VoucherFe, { id: voucher.id }));
    });
  }

  /** Sospende (reversibile) un voucher FE: non più utilizzabile finché riattivato. */
  async suspend(voucherFeId: string): Promise<VoucherFe> {
    const voucher = await this.repo.findOneBy({ id: voucherFeId });
    if (!voucher) throw new NotFoundException(`Voucher FE ${voucherFeId} non trovato.`);
    if (voucher.status === 'cancelled') {
      throw new BadRequestException('Un voucher FE annullato non può essere sospeso.');
    }
    if (voucher.status === 'inactive') return voucher;
    await this.repo.update(voucher.id, { status: 'inactive' });
    return this.repo.findOneByOrFail({ id: voucher.id });
  }

  /** Riattiva un voucher FE precedentemente sospeso. */
  async reactivate(voucherFeId: string): Promise<VoucherFe> {
    const voucher = await this.repo.findOneBy({ id: voucherFeId });
    if (!voucher) throw new NotFoundException(`Voucher FE ${voucherFeId} non trovato.`);
    if (voucher.status === 'cancelled') {
      throw new BadRequestException('Un voucher FE annullato non può essere riattivato.');
    }
    if (voucher.status !== 'inactive') return voucher;
    const residual = Number(voucher.residualAmount);
    await this.repo.update(voucher.id, {
      status: residual <= 0.005 ? 'depleted' : 'active',
    });
    return this.repo.findOneByOrFail({ id: voucher.id });
  }

  /** Annulla definitivamente un voucher FE (stato terminale, non riattivabile). */
  async cancel(voucherFeId: string): Promise<VoucherFe> {
    const voucher = await this.repo.findOneBy({ id: voucherFeId });
    if (!voucher) throw new NotFoundException(`Voucher FE ${voucherFeId} non trovato.`);
    if (voucher.status === 'cancelled') return voucher;
    await this.repo.update(voucher.id, { status: 'cancelled' });
    return this.repo.findOneByOrFail({ id: voucher.id });
  }

  /** Emette un nuovo voucher FE per un paziente. */
  async issue(input: IssueVoucherFeInput, createdByUserId?: string): Promise<VoucherFe> {
    if (input.initialAmount <= 0) {
      throw new BadRequestException("L'importo del voucher FE deve essere positivo.");
    }
    return this.dataSource.transaction(async (manager) => {
      const code = await this.nextCode(manager);
      const voucher = manager.create(VoucherFe, {
        code,
        patientId: input.patientId,
        initialAmount: input.initialAmount,
        residualAmount: input.initialAmount,
        status: 'active',
        expiryDate: input.expiryDate,
        notes: input.notes,
        createdByUserId,
      });
      const saved = await manager.save(voucher);
      await manager.save(
        manager.create(VoucherFeUsage, {
          voucherFeId: saved.id,
          type: 'issue',
          amount: input.initialAmount,
          residualAfter: input.initialAmount,
          createdByUserId,
        }),
      );
      return saved;
    });
  }

  /**
   * Consuma un voucher FE per un trattamento sconto FE. Lock pessimistico +
   * verifica residuo. Tutto nella transazione del chiamante (riusabile da
   * recordPayment quando il pagamento sconto FE usa il voucher).
   */
  async consume(
    manager: EntityManager,
    params: {
      voucherFeId: string;
      amount: number;
      treatmentId?: string;
      createdByUserId?: string;
    },
  ): Promise<void> {
    const amount = Math.round(params.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Importo consumo voucher FE deve essere positivo.');
    }
    const voucher = await manager
      .createQueryBuilder(VoucherFe, 'v')
      .setLock('pessimistic_write')
      .where('v.id = :id', { id: params.voucherFeId })
      .getOne();
    if (!voucher) {
      throw new NotFoundException(`Voucher FE ${params.voucherFeId} non trovato.`);
    }
    if (voucher.status !== 'active') {
      throw new BadRequestException(
        `Voucher FE ${voucher.code} non utilizzabile (stato: ${voucher.status}).`,
      );
    }
    const today = new Date().toISOString().split('T')[0];
    if (voucher.expiryDate && voucher.expiryDate < today) {
      throw new BadRequestException(`Voucher FE ${voucher.code} scaduto il ${voucher.expiryDate}.`);
    }
    const residual = Number(voucher.residualAmount);
    if (amount > residual + 0.005) {
      throw new BadRequestException(
        `Residuo voucher FE insufficiente: disponibile € ${residual.toFixed(2)}, richiesto € ${amount.toFixed(2)}.`,
      );
    }
    const newResidual = Math.round((residual - amount) * 100) / 100;
    const newStatus = newResidual <= 0.005 ? 'depleted' : 'active';
    await manager.update(VoucherFe, voucher.id, {
      residualAmount: newResidual,
      status: newStatus,
    });
    await manager.save(
      manager.create(VoucherFeUsage, {
        voucherFeId: voucher.id,
        type: 'consumption',
        amount,
        residualAfter: newResidual,
        treatmentId: params.treatmentId,
        createdByUserId: params.createdByUserId,
      }),
    );
  }

  /**
   * Storna tutti i consumi voucher_fe collegati a un treatment (per la
   * correzione/sostituzione di un pagamento). Ripristina il residuo dei voucher
   * e registra movimenti `reversal`. Tutto nella transazione del chiamante.
   */
  async reverseConsumptionsForTreatment(
    manager: EntityManager,
    treatmentId: string,
    createdByUserId?: string,
  ): Promise<void> {
    const usages = await manager.find(VoucherFeUsage, {
      where: { treatmentId, type: 'consumption' },
    });
    for (const u of usages) {
      const voucher = await manager
        .createQueryBuilder(VoucherFe, 'v')
        .setLock('pessimistic_write')
        .where('v.id = :id', { id: u.voucherFeId })
        .getOne();
      if (!voucher) continue;
      const restored = Math.round((Number(voucher.residualAmount) + Number(u.amount)) * 100) / 100;
      const cappedRestored = Math.min(restored, Number(voucher.initialAmount));
      await manager.update(VoucherFe, voucher.id, {
        residualAmount: cappedRestored,
        status: 'active',
      });
      await manager.save(
        manager.create(VoucherFeUsage, {
          voucherFeId: voucher.id,
          type: 'reversal',
          amount: Number(u.amount),
          residualAfter: cappedRestored,
          treatmentId,
          createdByUserId,
        }),
      );
    }
    // Marca i consumi originali come stornati eliminandoli dallo storico
    // "attivo": li lasciamo come audit ma il reversal li compensa. (Non li
    // cancelliamo per tracciabilità.)
  }

  /** Genera il prossimo codice VFE-YYYY-NNNN per il tenant (schema). */
  private async nextCode(manager: EntityManager): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VFE-${year}-`;
    const last = await manager
      .createQueryBuilder(VoucherFe, 'v')
      .where('v.code LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('v.code', 'DESC')
      .getOne();
    let next = 1;
    if (last) {
      const n = parseInt(last.code.slice(prefix.length), 10);
      if (!Number.isNaN(n)) next = n + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}
