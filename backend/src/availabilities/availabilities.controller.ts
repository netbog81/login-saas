import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AvailabilitiesService } from './availabilities.service';
import { Availability } from '../entities/availability.entity';

@Controller('availabilities')
export class AvailabilitiesController {
  constructor(private readonly availabilitiesService: AvailabilitiesService) {}

  @Get()
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string
  ): Promise<Availability[]> {
    return this.availabilitiesService.findByDateRange(
      startDate,
      endDate,
      userId || undefined
    );
  }

  @Get('by-date')
  findByDate(
    @Query('date') date: string,
    @Query('userId') userId?: string
  ): Promise<Availability[]> {
    return this.availabilitiesService.findByDate(
      date,
      userId || undefined
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Availability> {
    return this.availabilitiesService.findOne(id);
  }

  @Post()
  create(@Body() availabilityData: Partial<Availability>): Promise<Availability> {
    return this.availabilitiesService.create(availabilityData);
  }

  @Post('bulk')
  createBulk(@Body() availabilities: Partial<Availability>[]): Promise<Availability[]> {
    return this.availabilitiesService.createBulk(availabilities);
  }

  @Post('set-default')
  setDefaultAvailability(
    @Body() data: {
      userId: string;
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
    }
  ): Promise<Availability[]> {
    return this.availabilitiesService.setDefaultAvailability(
      data.userId,
      data.startDate,
      data.endDate,
      data.startTime,
      data.endTime
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() availabilityData: Partial<Availability>
  ): Promise<Availability> {
    return this.availabilitiesService.update(id, availabilityData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.availabilitiesService.remove(id);
  }
}
