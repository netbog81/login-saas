import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  findAll(@Query('search') search?: string): Promise<Patient[]> {
    if (search) {
      return this.patientsService.search(search);
    }
    return this.patientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Patient> {
    return this.patientsService.findOne(+id);
  }

  @Post()
  create(@Body() patientData: Partial<Patient>): Promise<Patient> {
    return this.patientsService.create(patientData);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() patientData: Partial<Patient>): Promise<Patient> {
    return this.patientsService.update(+id, patientData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.patientsService.remove(+id);
  }
}
