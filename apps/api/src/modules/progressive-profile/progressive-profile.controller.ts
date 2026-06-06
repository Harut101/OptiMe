import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnswerProgressivePromptDto } from './dto/answer-progressive-prompt.dto';
import { ProgressiveProfileService } from './progressive-profile.service';

@UseGuards(JwtAuthGuard)
@Controller('progressive-profile')
export class ProgressiveProfileController {
  constructor(private readonly progressiveProfileService: ProgressiveProfileService) {}

  @Get('next-prompt')
  getNextPrompt(@CurrentUser() user: AuthenticatedUser) {
    return this.progressiveProfileService.getNextPrompt(user.userId);
  }

  @Post('prompts/:key/answer')
  answerPrompt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: AnswerProgressivePromptDto
  ) {
    return this.progressiveProfileService.answerPrompt(user.userId, key, dto.value);
  }

  @Post('prompts/:key/skip')
  skipPrompt(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.progressiveProfileService.skipPrompt(user.userId, key);
  }
}
