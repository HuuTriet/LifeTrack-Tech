import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePrescriptionDto } from './create-prescription.dto';

export class UpdatePrescriptionDto extends PartialType(
  OmitType(CreatePrescriptionDto, ['elderlyId'] as const),
) {}
