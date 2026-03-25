import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { MedicationController } from './medication.controller';
import { MedicationService } from './medication.service';
import { MedicationRepository } from './medication.repository';

import { Prescription } from '../../entities/medication/prescription.entity';
import { PrescriptionItem } from '../../entities/medication/prescription-item.entity';
import { Drug } from '../../entities/medication/drug.entity';
import { InteractionLog } from '../../entities/medication/interaction-log.entity';
import { Reminder } from '../../entities/utilities/reminder.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionItem,
      Drug,
      InteractionLog,
      Reminder,
    ]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [MedicationController],
  providers: [MedicationService, MedicationRepository],
  exports: [MedicationService],
})
export class MedicationModule {}
