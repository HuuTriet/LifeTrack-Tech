import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OcrPrescriptionResponseDto {
  @ApiProperty({ description: 'True if OCR processing succeeded' })
  success: boolean;

  @ApiProperty({ description: 'Extracted raw text from image' })
  rawText: string;

  @ApiProperty({ description: 'OCR confidence score 0.0-1.0', example: 0.87 })
  confidenceScore: number;

  @ApiPropertyOptional({ description: 'Parsed drug name' })
  drugName?: string;

  @ApiPropertyOptional({ description: 'Parsed dosage value (null if OCR failed to extract)' })
  dosage?: number;

  @ApiPropertyOptional({ description: 'Parsed dosage unit (e.g. mg, ml)' })
  dosageUnit?: string;

  @ApiPropertyOptional({ description: 'Parsed frequency string' })
  frequency?: string;

  @ApiPropertyOptional({ description: 'Parsed doctor name' })
  doctorName?: string;

  @ApiPropertyOptional({ description: 'Parsed hospital name' })
  hospitalName?: string;

  @ApiPropertyOptional({ description: 'Parsed prescription date (ISO string)' })
  prescribedDate?: string;

  /**
   * If dosage could not be extracted from OCR → unknownDosage is set to true.
   * The frontend should use this flag to prompt the user for manual dosage input.
   * Backend will also enforce HTTP 422 if dosage is missing and this flag is false.
   */
  @ApiProperty({
    description:
      'True when OCR failed to parse dosage. Frontend MUST prompt user for manual entry.',
  })
  unknownDosage: boolean;

  @ApiPropertyOptional({ description: 'Error message if OCR failed' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Uploaded image URL (stored in object storage)' })
  imageUrl?: string;
}

export class OcrRequestDto {
  @ApiPropertyOptional({ description: 'Language hint for OCR (e.g. "vi", "en")' })
  @IsOptional()
  @IsString()
  language?: string;
}
