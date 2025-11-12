import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { Appointment } from '../entities/appointment.entity';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string
  ): Promise<Appointment[]> {
    return this.appointmentsService.findByDateRange(
      startDate,
      endDate,
      userId ? +userId : undefined
    );
  }

  @Get('by-date')
  findByDate(
    @Query('date') date: string,
    @Query('userId') userId?: string
  ): Promise<Appointment[]> {
    return this.appointmentsService.findByDate(
      date,
      userId ? +userId : undefined
    );
  }

  @Get('check-availability')
  checkAvailability(
    @Query('userId') userId: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('excludeId') excludeId?: string
  ): Promise<boolean> {
    return this.appointmentsService.checkAvailability(
      +userId,
      date,
      startTime,
      endTime,
      excludeId ? +excludeId : undefined
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Appointment> {
    return this.appointmentsService.findOne(+id);
  }

  @Post()
  create(@Body() appointmentData: Partial<Appointment>): Promise<Appointment[]> {
    return this.appointmentsService.create(appointmentData);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() appointmentData: Partial<Appointment>
  ): Promise<Appointment> {
    return this.appointmentsService.update(+id, appointmentData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.appointmentsService.remove(+id);
  }

  @Delete('recurring-group/:groupId')
  removeRecurringGroup(@Param('groupId') groupId: string): Promise<void> {
    return this.appointmentsService.removeRecurringGroup(groupId);
  }
}
