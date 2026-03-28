import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Prescription } from './prescription.entity';
import { Drug } from './drug.entity';

export enum FrequencyUnit {
  DAILY = 'DAILY',           // once a day
  TWICE_DAILY = 'TWICE_DAILY',
  THREE_TIMES_DAILY = 'THREE_TIMES_DAILY',
  FOUR_TIMES_DAILY = 'FOUR_TIMES_DAILY',
  EVERY_X_HOURS = 'EVERY_X_HOURS',
  WEEKLY = 'WEEKLY',
  AS_NEEDED = 'AS_NEEDED',
}

export enum MealRelation {
  BEFORE_MEAL = 'BEFORE_MEAL',
  WITH_MEAL = 'WITH_MEAL',
  AFTER_MEAL = 'AFTER_MEAL',
  INDEPENDENT = 'INDEPENDENT',
}

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prescription_id' })
  prescriptionId: string;

  @ManyToOne(() => Prescription, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'drug_id', nullable: true })
  drugId: string;

  @ManyToOne(() => Drug, (drug) => drug.prescriptionItems, { nullable: true })
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  // For generic reminders (isGenericReminder = true), drug may be null
  @Column({ name: 'drug_name_raw', length: 255, nullable: true })
  drugNameRaw: string; // raw name from OCR or manual input

  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  dosage: number; // e.g. 500 (mg)

  @Column({ length: 20, name: 'dosage_unit', nullable: true })
  dosageUnit: string; // e.g. mg, ml, IU

  @Column({ type: 'int', nullable: true })
  quantity: number; // number of tablets/capsules per dose

  @Column({ type: 'nvarchar', length: 30, default: FrequencyUnit.DAILY })
  frequency: FrequencyUnit;

  @Column({ type: 'int', name: 'frequency_interval', nullable: true })
  frequencyInterval: number; // for EVERY_X_HOURS: e.g. 8

  @Column({ type: 'simple-json', name: 'scheduled_times', nullable: true })
  scheduledTimes: string[]; // e.g. ["08:00", "14:00", "20:00"]

  @Column({ type: 'nvarchar', length: 20, default: MealRelation.INDEPENDENT, name: 'meal_relation' })
  mealRelation: MealRelation;

  @Column({ type: 'int', name: 'duration_days', nullable: true })
  durationDays: number;

  @Column({ type: 'text', name: 'instructions', nullable: true })
  instructions: string;

  // =====================
  // CORE BUSINESS FLAGS
  // =====================

  /**
   * unknownDosage = true: OCR failed to parse dosage.
   * Bypass overdose warning, but STILL run Drug Interaction Check.
   */
  @Column({ name: 'unknown_dosage', default: false })
  unknownDosage: boolean;

  /**
   * isGenericReminder = true: User doesn't know the drug name,
   * only sets a visual/image-based reminder.
   * Bypass ALL safety checks. Flag requireDisclaimer = true.
   */
  @Column({ name: 'is_generic_reminder', default: false })
  isGenericReminder: boolean;

  /**
   * requireDisclaimer = true: Set when isGenericReminder = true.
   * Frontend must show a disclaimer before displaying this item.
   */
  @Column({ name: 'require_disclaimer', default: false })
  requireDisclaimer: boolean;

  @Column({ name: 'reminder_image_url', length: 500, nullable: true })
  reminderImageUrl: string; // for generic reminders

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
