import { Module } from '@nestjs/common';

import { Product } from '../availability/entities/product.entity';
import { Site } from '../availability/entities/site.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { AppUsersModule } from '../users/app-users.module';

import { SaleService } from './sale.service';
import { SaleResolver } from './sale.resolver';

/**
 * Modulo "vendita rapida prodotto" — pubblica `sale.completed.<tenant>`
 * verso accounting. Niente entità Sale persistita lato clinico (storico
 * authoritative su accounting come BillableEvent + SalesDocument).
 *
 * ClinicalEventBuffer + ClinicalEventPublisher sono provider del
 * `ClinicalEventsModule` (@Global), iniettati direttamente nel SaleService.
 */
@Module({
  imports: [
    AppUsersModule],
  providers: [SaleService, SaleResolver],
  exports: [SaleService],
})
export class SalesModule {}
