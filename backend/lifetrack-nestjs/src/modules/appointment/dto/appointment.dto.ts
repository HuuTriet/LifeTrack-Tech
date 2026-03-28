import { IsString, IsOptional, IsDateString, IsNumber, IsIn, MinLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsString() elderlyId: string;
  @IsString() @MinLength(2) doctorName: string;
  @IsOptional() @IsString() specialty?: string;
  @IsOptional() @IsString() hospitalName?: string;
  @IsOptional() @IsString() hospitalAddress?: string;
  @IsDateString() appointmentDate: string;
  @IsOptional() @IsNumber() durationMinutes?: number;
  @IsOptional() @IsIn(['CLINIC', 'TELEMEDICINE', 'HOME_VISIT']) appointmentType?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsString() doctorName?: string;
  @IsOptional() @IsString() specialty?: string;
  @IsOptional() @IsString() hospitalName?: string;
  @IsOptional() @IsString() hospitalAddress?: string;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @IsNumber() durationMinutes?: number;
  @IsOptional() @IsIn(['CLINIC', 'TELEMEDICINE', 'HOME_VISIT']) appointmentType?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() doctorNotes?: string;
  @IsOptional() @IsIn(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) status?: string;
}
