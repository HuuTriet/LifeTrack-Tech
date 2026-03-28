import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MedicationController } from './medication.controller';
import { MedicationService } from './medication.service';
import { MedicationRepository } from './medication.repository';
import { MedicationLogService } from './medication-log.service';

import { Prescription } from '../../entities/medication/prescription.entity';
import { PrescriptionItem } from '../../entities/medication/prescription-item.entity';
import { Drug } from '../../entities/medication/drug.entity';
import { InteractionLog } from '../../entities/medication/interaction-log.entity';
import { Reminder } from '../../entities/utilities/reminder.entity';
import { MedicationLog } from '../../entities/medication/medication-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionItem,
      Drug,
      InteractionLog,
      Reminder,
      MedicationLog,
    ]),
  ],
  controllers: [MedicationController],
  providers: [MedicationService, MedicationRepository, MedicationLogService],
  exports: [MedicationService, MedicationLogService],
})
export class MedicationModule {}
