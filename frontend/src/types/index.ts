// ============================================================
// CORE TYPES
// ============================================================

export type UserRole = 'elderly' | 'caregiver' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  avatarInitials?: string;
}

// ============================================================
// MEDICATION TYPES
// ============================================================

export type DrugInteractionRisk = 'none' | 'low' | 'moderate' | 'high';
export type MedicationStatus = 'taken' | 'pending' | 'missed' | 'skipped';

export interface Drug {
  id: string;
  name: string;
  genericName?: string;
}

export interface DrugInteractionResult {
  risk: DrugInteractionRisk;
  message: string;
  conflictingDrugs: string[];
}

export interface PrescriptionItem {
  id: string;
  drugName: string;
  dosage?: string;
  frequency: string;
  time: string;
  notes?: string;
  status: MedicationStatus;
  interactionRisk?: DrugInteractionRisk;
}

export interface Prescription {
  id: string;
  elderlyId: string;
  items: PrescriptionItem[];
  createdAt: string;
  updatedAt: string;
}

// OCR result from backend
export interface OcrResult {
  drugName?: string;
  dosage?: string;
  frequency?: string;
  confidence: number;
  rawText: string;
}

// Add Medication Form data
export interface AddMedicationFormData {
  drugName: string;
  dosage: string;
  frequency: string;
  time: string;
  notes?: string;
  isUnknownDosage: boolean;
  isGenericReminder: boolean;
  reminderImageUrl?: string;
}

// ============================================================
// HEALTH TYPES
// ============================================================

export interface VitalSigns {
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  spo2: number;
  steps: number;
  recordedAt: string;
}

export interface HealthMetric {
  id: string;
  elderlyId: string;
  date: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  spo2: number;
  steps: number;
  mentalScore?: number;
}

// ============================================================
// NOTIFICATION / ALERT TYPES
// ============================================================

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}
