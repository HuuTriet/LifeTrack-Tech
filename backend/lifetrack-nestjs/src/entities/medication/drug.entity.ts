import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PrescriptionItem } from './prescription-item.entity';

export enum DrugCategory {
  ANALGESIC = 'ANALGESIC',
  ANTIBIOTIC = 'ANTIBIOTIC',
  ANTIHYPERTENSIVE = 'ANTIHYPERTENSIVE',
  ANTICOAGULANT = 'ANTICOAGULANT',
  ANTIDIABETIC = 'ANTIDIABETIC',
  ANTIDEPRESSANT = 'ANTIDEPRESSANT',
  ANTIPSYCHOTIC = 'ANTIPSYCHOTIC',
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  DIURETIC = 'DIURETIC',
  SUPPLEMENT = 'SUPPLEMENT',
  NSAID = 'NSAID',
  SEDATIVE = 'SEDATIVE',
  OTHER = 'OTHER',
}

export enum DrugForm {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  LIQUID = 'LIQUID',
  INJECTION = 'INJECTION',
  PATCH = 'PATCH',
  INHALER = 'INHALER',
  TOPICAL = 'TOPICAL',
  SUPPOSITORY = 'SUPPOSITORY',
  DROPS = 'DROPS',
}

@Entity('drugs')
@Index(['genericName'])
@Index(['brandName'])
export class Drug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'generic_name', length: 255 })
  genericName: string;

  @Column({ name: 'brand_name', length: 255, nullable: true })
  brandName: string;

  @Column({ type: 'nvarchar', length: 30, default: DrugCategory.OTHER })
  category: DrugCategory;

  @Column({ type: 'nvarchar', length: 20, default: DrugForm.TABLET })
  form: DrugForm;

  @Column({ length: 100, nullable: true })
  strength: string; // e.g. "500mg", "10mg/5ml"

  @Column({ length: 100, nullable: true })
  manufacturer: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', name: 'side_effects', nullable: true })
  sideEffects: string;

  @Column({ type: 'text', name: 'contraindications', nullable: true })
  contraindications: string;

  @Column({ type: 'text', name: 'storage_instructions', nullable: true })
  storageInstructions: string;

  // RxNorm or ATC code for drug interaction API lookups
  @Column({ length: 50, name: 'rxnorm_code', nullable: true })
  rxnormCode: string;

  @Column({ length: 50, name: 'atc_code', nullable: true })
  atcCode: string;

  @Column({ name: 'requires_prescription', default: true })
  requiresPrescription: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

  @OneToMany(() => PrescriptionItem, (item) => item.drug)
  prescriptionItems: PrescriptionItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
