import { PartialType } from '@nestjs/mapped-types';

import { CreateTrainingScheduleItemDto } from './create-training-schedule-item.dto';

export class UpdateTrainingScheduleItemDto extends PartialType(CreateTrainingScheduleItemDto) {}
