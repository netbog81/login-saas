import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperatorService } from '../entities/operator-service.entity';
import { Operator } from '../entities/operator.entity';
import { Service } from '../entities/service.entity';

@Injectable()
export class OperatorServiceService {
  constructor(
    @InjectRepository(OperatorService)
    private operatorServiceRepo: Repository<OperatorService>,
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
  ) {}

  async assignServiceToOperator(
    operatorId: string,
    serviceId: string,
    customDuration?: number,
    customBufferTime?: number
  ): Promise<OperatorService> {
    // Validate operator exists
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${operatorId} not found`);
    }

    // Validate service exists
    const service = await this.serviceRepo.findOne({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    // Check if association already exists
    const existing = await this.operatorServiceRepo.findOne({
      where: { operatorId, serviceId }
    });

    if (existing) {
      throw new ConflictException(`Operator ${operator.name} is already assigned to service ${service.name}`);
    }

    // Create new association
    const operatorService = this.operatorServiceRepo.create({
      operatorId,
      serviceId,
      customDuration,
      customBufferTime
    });

    return this.operatorServiceRepo.save(operatorService);
  }

  async removeServiceFromOperator(
    operatorId: string,
    serviceId: string
  ): Promise<boolean> {
    const result = await this.operatorServiceRepo.delete({
      operatorId,
      serviceId
    });

    if (!result.affected || result.affected === 0) {
      throw new NotFoundException(`Association between operator ${operatorId} and service ${serviceId} not found`);
    }

    return true;
  }

  async updateOperatorService(
    operatorId: string,
    serviceId: string,
    customDuration?: number,
    customBufferTime?: number
  ): Promise<OperatorService> {
    // Verify association exists
    const existing = await this.operatorServiceRepo.findOne({
      where: { operatorId, serviceId },
      relations: ['operator', 'service']
    });

    if (!existing) {
      throw new NotFoundException(`Association between operator ${operatorId} and service ${serviceId} not found`);
    }

    // Update custom values
    existing.customDuration = customDuration;
    existing.customBufferTime = customBufferTime;

    return this.operatorServiceRepo.save(existing);
  }

  async getOperatorServices(operatorId: string): Promise<OperatorService[]> {
    // Validate operator exists
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${operatorId} not found`);
    }

    return this.operatorServiceRepo.find({
      where: { operatorId },
      relations: ['service']
    });
  }

  async getServiceOperators(serviceId: string): Promise<OperatorService[]> {
    // Validate service exists
    const service = await this.serviceRepo.findOne({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    return this.operatorServiceRepo.find({
      where: { serviceId },
      relations: ['operator']
    });
  }

  async getAllOperatorServices(): Promise<OperatorService[]> {
    return this.operatorServiceRepo.find({
      relations: ['operator', 'service']
    });
  }
}