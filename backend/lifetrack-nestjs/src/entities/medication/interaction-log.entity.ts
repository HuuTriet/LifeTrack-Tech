import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';
import { Drug } from './drug.entity';

export enum InteractionSeverity {
  HIGH = 'HIGH',       // Contraindicated – must block
  MODERATE = 'MODERATE', // Use with caution – warn
  LOW = 'LOW',         // Minor – informational
  NONE = 'NONE',       // No interaction found
}

export enum InteractionCheckStatus {
  BLOCKED = 'BLOCKED',   // High risk – prescription was rejected
  WARNED = 'WARNED',     // Moderate risk – user was warned
  PASSED = 'PASSED',     // No interaction found
  BYPASSED = 'BYPASSED', // isGenericReminder = true
  ERROR = 'ERROR',       // Drug Interaction API failed
}

@Entity('interaction_logs')
@Index(['elderlyId', 'checkedAt'])
export class InteractionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'elderly_id' })
  elderlyId: string;

  @ManyToOne(() => Elderly, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  /** The new drug being checked */
  @Column({ name: 'new_drug_id', nullable: true })
  newDrugId: string;

  @ManyToOne(() => Drug, { nullable: true })
  @JoinColumn({ name: 'new_drug_id' })
  newDrug: Drug;

  @Column({ name: 'new_drug_name', length: 255, nullable: true })
  newDrugName: string;

  /** The existing drug it was checked against */
  @Column({ name: 'existing_drug_id', nullable: true })
  existingDrugId: string;

  @Column({ name: 'existing_drug_name', length: 255, nullable: true })
  existingDrugName: string;

  @Column({ type: 'nvarchar', length: 20, default: InteractionSeverity.NONE })
  severity: InteractionSeverity;

  @Column({ type: 'nvarchar', length: 20, default: InteractionCheckStatus.PASSED, name: 'check_status' })
  checkStatus: InteractionCheckStatus;

  @Column({ type: 'text', name: 'interaction_description', nullable: true })
  interactionDescription: string;

  @Column({ type: 'text', name: 'clinical_effects', nullable: true })
  clinicalEffects: string;

  /** Raw JSON response from the Drug Interaction API */
  @Column({ type: 'simple-json', name: 'api_raw_response', nullable: true })
  apiRawResponse: Record<string, any>;

  @Column({ name: 'api_source', length: 100, nullable: true })
  apiSource: string; // e.g. "RxNorm", "OpenFDA", "DrugBank"

  @Column({ name: 'checked_by', nullable: true })
  checkedBy: string; // userId who triggered the check

  @Column({ name: 'checked_at', type: 'datetime' })
  checkedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
