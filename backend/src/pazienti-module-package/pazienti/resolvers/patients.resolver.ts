// GraphQL Resolver for Patient (Paziente)
// Handles all GraphQL queries, mutations, and field resolvers

import { Resolver, Query, Mutation, Args, ID, Int, ResolveField, Parent } from '@nestjs/graphql';
import { ParseIntPipe } from '@nestjs/common';
import { PatientModel } from '../models/patient.model';
import {
  CreatePatientInput,
  UpdatePatientInput,
  SearchPatientInput,
  PaginationInfo,
} from '../inputs';
import { PazientiService } from '../services/pazienti.service';
import { Paziente } from '../entities/paziente.entity';

// Response type for paginated search results
@Resolver()
export class PaginatedPatientsResponse {
  patients: PatientModel[];
  pagination: PaginationInfo;
}

@Resolver(() => PatientModel)
export class PatientsResolver {
  constructor(private readonly pazientiService: PazientiService) {}

  // ==================== QUERIES ====================

  /**
   * Get all patients (paginated)
   */
  @Query(() => [PatientModel], {
    name: 'patients',
    description: 'Get all patients with optional pagination',
  })
  async getPatients(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset?: number,
  ): Promise<Paziente[]> {
    return this.pazientiService.findAll({ limit, offset });
  }

  /**
   * Get a single patient by ID
   */
  @Query(() => PatientModel, {
    name: 'patient',
    description: 'Get a single patient by ID',
    nullable: true,
  })
  async getPatient(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
  ): Promise<Paziente | null> {
    return this.pazientiService.findOne(id);
  }

  /**
   * Search patients with filters
   */
  @Query(() => [PatientModel], {
    name: 'searchPatients',
    description: 'Search patients with various filters and pagination',
  })
  async searchPatients(
    @Args('searchInput', { type: () => SearchPatientInput }) searchInput: SearchPatientInput,
  ): Promise<Paziente[]> {
    return this.pazientiService.search(searchInput);
  }

  /**
   * Get patient by Codice Fiscale
   */
  @Query(() => PatientModel, {
    name: 'patientByCodiceFiscale',
    description: 'Find patient by Italian tax code (Codice Fiscale)',
    nullable: true,
  })
  async getPatientByCodiceFiscale(
    @Args('codiceFiscale', { type: () => String }) codiceFiscale: string,
  ): Promise<Paziente | null> {
    return this.pazientiService.findByCodiceFiscale(codiceFiscale);
  }

  /**
   * Get patient by email
   */
  @Query(() => PatientModel, {
    name: 'patientByEmail',
    description: 'Find patient by email address',
    nullable: true,
  })
  async getPatientByEmail(
    @Args('email', { type: () => String }) email: string,
  ): Promise<Paziente | null> {
    return this.pazientiService.findByEmail(email);
  }

  /**
   * Get patients by phone number
   */
  @Query(() => [PatientModel], {
    name: 'patientsByPhone',
    description: 'Find patients by phone number (partial match)',
  })
  async getPatientsByPhone(
    @Args('phone', { type: () => String }) phone: string,
  ): Promise<Paziente[]> {
    return this.pazientiService.findByPhone(phone);
  }

  /**
   * Get patients requiring privacy document update
   */
  @Query(() => [PatientModel], {
    name: 'patientsRequiringPrivacyUpdate',
    description: 'Get patients with incomplete privacy documentation',
  })
  async getPatientsRequiringPrivacyUpdate(): Promise<Paziente[]> {
    return this.pazientiService.findByStatoPrivacy('NON_ACQUISITA');
  }

  /**
   * Get patients by status
   */
  @Query(() => [PatientModel], {
    name: 'patientsByStatus',
    description: 'Get patients filtered by anagrafica status',
  })
  async getPatientsByStatus(
    @Args('status', { type: () => String }) status: string,
  ): Promise<Paziente[]> {
    return this.pazientiService.findByStatoAnagrafica(status);
  }

  /**
   * Count patients by various criteria
   */
  @Query(() => Int, {
    name: 'patientsCount',
    description: 'Get total count of patients',
  })
  async getPatientsCount(): Promise<number> {
    return this.pazientiService.count();
  }

  // ==================== MUTATIONS ====================

  /**
   * Create a new patient
   */
  @Mutation(() => PatientModel, {
    description: 'Create a new patient record',
  })
  async createPatient(
    @Args('createPatientInput', { type: () => CreatePatientInput })
    createPatientInput: CreatePatientInput,
  ): Promise<Paziente> {
    return this.pazientiService.create(createPatientInput);
  }

  /**
   * Update an existing patient
   */
  @Mutation(() => PatientModel, {
    description: 'Update an existing patient record',
  })
  async updatePatient(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
    @Args('updatePatientInput', { type: () => UpdatePatientInput })
    updatePatientInput: UpdatePatientInput,
  ): Promise<Paziente> {
    return this.pazientiService.update(id, updatePatientInput);
  }

  /**
   * Delete a patient (soft delete - anonymization)
   */
  @Mutation(() => Boolean, {
    description: 'Delete patient (performs GDPR-compliant anonymization)',
  })
  async deletePatient(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
  ): Promise<boolean> {
    await this.pazientiService.delete(id);
    return true;
  }

  /**
   * Update patient status
   */
  @Mutation(() => PatientModel, {
    description: 'Update patient record status (workflow state)',
  })
  async updatePatientStatus(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
    @Args('status', { type: () => String }) status: string,
  ): Promise<Paziente> {
    return this.pazientiService.updateStatoAnagrafica(id, status);
  }

  /**
   * Update patient privacy status
   */
  @Mutation(() => PatientModel, {
    description: 'Update patient privacy documentation status',
  })
  async updatePatientPrivacyStatus(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
    @Args('status', { type: () => String }) status: string,
  ): Promise<Paziente> {
    return this.pazientiService.updateStatoPrivacy(id, status);
  }

  /**
   * Grant GDPR consent
   */
  @Mutation(() => PatientModel, {
    description: 'Update patient GDPR consent',
  })
  async grantGdprConsent(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
    @Args('consensoGdpr', { type: () => Boolean }) consensoGdpr: boolean,
    @Args('consensoMarketing', { type: () => Boolean, nullable: true }) consensoMarketing?: boolean,
    @Args('consensoTerzi', { type: () => Boolean, nullable: true }) consensoTerzi?: boolean,
  ): Promise<Paziente> {
    return this.pazientiService.updateConsents(id, {
      consensoGdpr,
      consensoMarketing,
      consensoComunicazioneTerzi: consensoTerzi,
    });
  }

  /**
   * Request patient data deletion (GDPR Right to be Forgotten)
   */
  @Mutation(() => PatientModel, {
    description: 'Request patient data deletion (GDPR Article 17 - Right to be Forgotten)',
  })
  async requestPatientDeletion(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
  ): Promise<Paziente> {
    return this.pazientiService.requestDeletion(id);
  }

  /**
   * Anonymize patient data
   */
  @Mutation(() => PatientModel, {
    description: 'Anonymize patient data (irreversible GDPR compliance action)',
  })
  async anonymizePatient(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
  ): Promise<Paziente> {
    return this.pazientiService.anonymize(id);
  }

  /**
   * Increment cancellations counter
   */
  @Mutation(() => PatientModel, {
    description: 'Increment appointment cancellations counter for current year',
  })
  async incrementCancellations(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
  ): Promise<Paziente> {
    const currentYear = new Date().getFullYear().toString();
    return this.pazientiService.incrementCounter(id, 'cancellationsByYear', currentYear);
  }

  /**
   * Increment no-shows counter
   */
  @Mutation(() => PatientModel, {
    description: 'Increment no-show counter for current year',
  })
  async incrementNoShows(
    @Args('id', { type: () => ID }, ParseIntPipe) id: number,
  ): Promise<Paziente> {
    const currentYear = new Date().getFullYear().toString();
    return this.pazientiService.incrementCounter(id, 'noShowsByYear', currentYear);
  }

  // ==================== FIELD RESOLVERS (Computed Fields) ====================

  /**
   * Resolve fullName computed field
   */
  @ResolveField('fullName', () => String, {
    description: 'Full name (name + surname)',
  })
  resolveFullName(@Parent() patient: Paziente): string {
    return patient.fullName;
  }

  /**
   * Resolve age computed field
   */
  @ResolveField('age', () => Int, {
    nullable: true,
    description: 'Age calculated from date of birth',
  })
  resolveAge(@Parent() patient: Paziente): number | null {
    return patient.age;
  }

  /**
   * Resolve hasContattoTelefonico
   */
  @ResolveField('hasContattoTelefonico', () => Boolean, {
    description: 'Has at least one contact method (phone/email)',
  })
  resolveHasContattoTelefonico(@Parent() patient: Paziente): boolean {
    return patient.hasContattoTelefonico;
  }

  /**
   * Resolve isAnagraficaMinima
   */
  @ResolveField('isAnagraficaMinima', () => Boolean, {
    description: 'Has minimum required data for appointment creation',
  })
  resolveIsAnagraficaMinima(@Parent() patient: Paziente): boolean {
    return patient.isAnagraficaMinima;
  }

  /**
   * Resolve canCreateAppuntamento
   */
  @ResolveField('canCreateAppuntamento', () => Boolean, {
    description: 'Can create appointments (based on status)',
  })
  resolveCanCreateAppuntamento(@Parent() patient: Paziente): boolean {
    return patient.canCreateAppuntamento;
  }

  /**
   * Resolve isPrivacyCompleta
   */
  @ResolveField('isPrivacyCompleta', () => Boolean, {
    description: 'Privacy documents complete',
  })
  resolveIsPrivacyCompleta(@Parent() patient: Paziente): boolean {
    return patient.isPrivacyCompleta;
  }

  /**
   * Resolve hasAllConsensi
   */
  @ResolveField('hasAllConsensi', () => Boolean, {
    description: 'All required GDPR consents given',
  })
  resolveHasAllConsensi(@Parent() patient: Paziente): boolean {
    return patient.hasAllConsensi;
  }

  // ==================== RELATION RESOLVERS ====================
  // Note: Uncomment and adapt these when integrating with Appointment entities

  /*
  @ResolveField('appointments', () => [Appointment], {
    description: 'Patient appointments',
    nullable: 'itemsAndList',
  })
  async resolveAppointments(@Parent() patient: Paziente): Promise<Appointment[]> {
    // Lazy load appointments relation
    return await patient.appointments;
  }

  @ResolveField('availabilityAppointments', () => [AvailabilityAppointment], {
    description: 'Patient availability appointments',
    nullable: 'itemsAndList',
  })
  async resolveAvailabilityAppointments(@Parent() patient: Paziente): Promise<AvailabilityAppointment[]> {
    // Lazy load availabilityAppointments relation
    return await patient.availabilityAppointments;
  }
  */
}
