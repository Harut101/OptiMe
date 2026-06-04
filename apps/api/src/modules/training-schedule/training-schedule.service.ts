import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { CreateTrainingScheduleItemDto } from './dto/create-training-schedule-item.dto';
import { UpdateTrainingScheduleItemDto } from './dto/update-training-schedule-item.dto';

@Injectable()
export class TrainingScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService
  ) {}

  listItems(userId: string) {
    return this.prisma.trainingScheduleItem.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { localTime: 'asc' }]
    });
  }

  createItem(userId: string, dto: CreateTrainingScheduleItemDto) {
    this.safetyService.validateTrainingScheduleItem(dto);

    return this.prisma.trainingScheduleItem.create({
      data: {
        userId,
        dayOfWeek: dto.dayOfWeek,
        localTime: dto.localTime,
        sportType: dto.sportType,
        durationMinutes: dto.durationMinutes,
        intensity: dto.intensity,
        description: dto.description
      }
    });
  }

  async updateItem(userId: string, itemId: string, dto: UpdateTrainingScheduleItemDto) {
    const existingItem = await this.ensureItemBelongsToUser(userId, itemId);
    this.safetyService.validateTrainingScheduleItem({
      durationMinutes: dto.durationMinutes ?? existingItem.durationMinutes,
      intensity: dto.intensity ?? existingItem.intensity,
      description: dto.description ?? existingItem.description
    });

    return this.prisma.trainingScheduleItem.update({
      where: { id: itemId },
      data: dto
    });
  }

  async deleteItem(userId: string, itemId: string) {
    await this.ensureItemBelongsToUser(userId, itemId);
    await this.prisma.trainingScheduleItem.delete({ where: { id: itemId } });

    return { deleted: true };
  }

  private async ensureItemBelongsToUser(userId: string, itemId: string) {
    const item = await this.prisma.trainingScheduleItem.findFirst({
      where: {
        id: itemId,
        userId
      }
    });

    if (!item) {
      throw new NotFoundException('Training schedule item not found.');
    }

    return item;
  }
}
