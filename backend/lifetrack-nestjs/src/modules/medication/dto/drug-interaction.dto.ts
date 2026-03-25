import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionSeverity } from '../../../entities/medication/interaction-log.entity';

export class DrugInteractionResult {
  @ApiProperty({ enum: InteractionSeverity })
  severity: InteractionSeverity;

  @ApiProperty()
  drugA: string;

  @ApiProperty()
  drugB: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  clinicalEffects?: string;

  @ApiPropertyOptional()
  source?: string;

  @ApiPropertyOptional({ type: Object })
  rawResponse?: Record<string, any>;
}

export class DrugInteractionCheckResponse {
  @ApiProperty({ description: 'True if any HIGH risk interactions were found' })
  hasHighRisk: boolean;

  @ApiProperty({ description: 'True if any MODERATE risk interactions were found' })
  hasModerateRisk: boolean;

  @ApiProperty({ type: [DrugInteractionResult] })
  interactions: DrugInteractionResult[];

  @ApiProperty({ description: 'Highest severity level among all interactions' })
  maxSeverity: InteractionSeverity;
}
