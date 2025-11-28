import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatternGroup } from '../entities/pattern-group.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { CreatePatternGroupInput } from '../dto/create-pattern-group.input';
import { UpdatePatternGroupInput } from '../dto/update-pattern-group.input';

@Injectable()
export class PatternGroupService {
  constructor(
    @InjectRepository(PatternGroup)
    private patternGroupRepo: Repository<PatternGroup>,
    @InjectRepository(TemplatePattern)
    private patternRepo: Repository<TemplatePattern>,
    @InjectRepository(TemplateAssignment)
    private assignmentRepo: Repository<TemplateAssignment>,
  ) {}

  async findAll(): Promise<PatternGroup[]> {
    return this.patternGroupRepo.find({
      relations: ['patterns'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<PatternGroup> {
    const group = await this.patternGroupRepo.findOne({
      where: { id },
      relations: ['patterns'],
    });

    if (!group) {
      throw new NotFoundException(`Pattern group with ID ${id} not found`);
    }

    return group;
  }

  async create(input: CreatePatternGroupInput): Promise<PatternGroup> {
    // Validate pattern duration consistency
    for (const pattern of input.patterns) {
      if (pattern.dayInPattern < 0 || pattern.dayInPattern >= input.patternDuration) {
        throw new BadRequestException(
          `dayInPattern must be between 0 and ${input.patternDuration - 1}`
        );
      }
    }

    // Create pattern group
    const group = this.patternGroupRepo.create({
      name: input.name,
      description: input.description,
      patternDuration: input.patternDuration,
      isActive: true,
    });

    const savedGroup = await this.patternGroupRepo.save(group);

    // Create associated patterns
    const patterns = input.patterns.map(p =>
      this.patternRepo.create({
        ...p,
        patternGroupId: savedGroup.id,
        patternDuration: input.patternDuration,
      })
    );

    await this.patternRepo.save(patterns);

    // Reload with relations
    return this.findOne(savedGroup.id);
  }

  async update(
    id: string,
    input: UpdatePatternGroupInput
  ): Promise<PatternGroup> {
    const group = await this.findOne(id);

    if (input.name !== undefined) group.name = input.name;
    if (input.description !== undefined) group.description = input.description;
    if (input.patternDuration !== undefined) {
      group.patternDuration = input.patternDuration;
    }

    await this.patternGroupRepo.save(group);

    // If patterns are provided, replace existing patterns
    if (input.patterns) {
      // Validate pattern duration consistency
      for (const pattern of input.patterns) {
        if (
          pattern.dayInPattern < 0 ||
          pattern.dayInPattern >= group.patternDuration
        ) {
          throw new BadRequestException(
            `dayInPattern must be between 0 and ${group.patternDuration - 1}`
          );
        }
      }

      // Delete existing patterns
      await this.patternRepo.delete({ patternGroupId: id });

      // Create new patterns
      const patterns = input.patterns.map(p =>
        this.patternRepo.create({
          ...p,
          patternGroupId: id,
          patternDuration: group.patternDuration,
        })
      );

      await this.patternRepo.save(patterns);
    }

    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    // Check if pattern group exists
    const group = await this.patternGroupRepo.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Pattern group with ID ${id} not found`);
    }

    // Check if pattern group has active assignments
    const assignmentCount = await this.assignmentRepo.count({
      where: { patternGroupId: id, isCurrent: true }
    });

    if (assignmentCount > 0) {
      throw new ConflictException(
        `Cannot delete pattern group: it is currently assigned to ${assignmentCount} operator(s). ` +
        `Please remove the assignments first.`
      );
    }

    const result = await this.patternGroupRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async setActive(id: string, isActive: boolean): Promise<PatternGroup> {
    const group = await this.findOne(id);
    group.isActive = isActive;
    await this.patternGroupRepo.save(group);
    return this.findOne(id);
  }
}
