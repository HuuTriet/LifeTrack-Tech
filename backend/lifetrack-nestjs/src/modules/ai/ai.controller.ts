import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class AiChatDto {
  @IsArray()
  messages: ChatMessageDto[];

  @IsString()
  @IsOptional()
  elderlyContext?: string;
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto.messages, dto.elderlyContext);
  }
}
