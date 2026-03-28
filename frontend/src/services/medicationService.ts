import api from './api';
import type {
  AddMedicationFormData,
  DrugInteractionResult,
  OcrResult,
  PrescriptionItem,
} from '../types';

// ── Types matching the NestJS backend DTOs ───────────────────────────────────

export interface CreatePrescriptionPayload {
  elderlyId: string;
  prescriptionNumber?: string;
  doctorName?: string;
  hospitalName?: string;
  prescribedDate?: string;      // YYYY-MM-DD
  startDate: string;            // YYYY-MM-DD
  endDate?: string;             // YYYY-MM-DD
  source?: 'MANUAL' | 'OCR' | 'DOCTOR_UPLOAD';
  diagnosis?: string;
  notes?: string;
  items: CreatePrescriptionItemPayload[];
}

export interface CreatePrescriptionItemPayload {
  drugId?: string;
  drugNameRaw?: string;
  dosage?: number;
  dosageUnit?: string;
  quantity?: number;
  frequency?: 'ONCE' | 'TWICE_DAILY' | 'THREE_TIMES_DAILY' | 'FOUR_TIMES_DAILY' | 'EVERY_X_HOURS' | 'WEEKLY' | 'AS_NEEDED' | 'DAILY';
  frequencyInterval?: number;
  scheduledTimes?: string[];    // ['08:00', '20:00']
  mealRelation?: 'BEFORE' | 'WITH' | 'AFTER' | 'INDEPENDENT';
  durationDays?: number;
  instructions?: string;
  unknownDosage?: boolean;
  isGenericReminder?: boolean;
  reminderImageUrl?: string;
}

export interface Prescription {
  id: string;
  elderlyId: string;
  prescriptionNumber?: string;
  doctorName?: string;
  hospitalName?: string;
  prescribedDate?: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'SUSPENDED';
  source: string;
  diagnosis?: string;
  notes?: string;
  items: BackendPrescriptionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendPrescriptionItem {
  id: string;
  prescriptionId: string;
  drugId?: string;
  drugNameRaw?: string;
  dosage?: number;
  dosageUnit?: string;
  quantity?: number;
  frequency?: string;
  scheduledTimes?: string[];
  mealRelation?: string;
  durationDays?: number;
  instructions?: string;
  unknownDosage: boolean;
  isGenericReminder: boolean;
  requireDisclaimer: boolean;
  reminderImageUrl?: string;
  isActive: boolean;
  drug?: { id: string; genericName: string; brandName?: string };
}

export interface MedicationLog {
  id: string;
  elderlyId: string;
  prescriptionItemId: string;
  drugName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED';
  takenAt?: string;
  notes?: string;
  recordedBy?: string;
}

export interface AdherenceStats {
  period: string;
  total: number;
  taken: number;
  skipped: number;
  pending: number;
  adherenceRate: number;
}

export interface DrugSearchResult {
  id: string;
  genericName: string;
  brandName?: string;
  form?: string;
  strength?: string;
}

// ── Medication Service ────────────────────────────────────────────────────────

export const medicationService = {
  // ── Prescription CRUD ──────────────────────────────────────────────────────

  /**
   * Create a new prescription for an elderly patient.
   * Backend: POST /medications/prescriptions
   * Returns HTTP 422 if dosage is missing and unknownDosage is not set.
   * Returns HTTP 400 if HIGH RISK drug interaction is detected.
   */
  createPrescription: async (payload: CreatePrescriptionPayload): Promise<Prescription> => {
    const res = await api.post('/medications/prescriptions', payload);
    return res.data;
  },

  /**
   * Get a single prescription by ID.
   * Backend: GET /medications/prescriptions/:id
   */
  getPrescriptionById: async (id: string): Promise<Prescription> => {
    const res = await api.get(`/medications/prescriptions/${id}`);
    return res.data;
  },

  /**
   * Get all prescriptions for an elderly patient (paginated).
   * Backend: GET /medications/prescriptions/elderly/:elderlyId
   */
  getPrescriptionsByElderly: async (
    elderlyId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Prescription[]; total: number; page: number; limit: number }> => {
    const res = await api.get(`/medications/prescriptions/elderly/${elderlyId}`, {
      params: { page, limit },
    });
    return res.data;
  },

  /**
   * Update an existing prescription.
   * Backend: PATCH /medications/prescriptions/:id
   */
  updatePrescription: async (
    id: string,
    payload: Partial<CreatePrescriptionPayload>,
  ): Promise<Prescription> => {
    const res = await api.patch(`/medications/prescriptions/${id}`, payload);
    return res.data;
  },

  /**
   * Soft-delete a prescription.
   * Backend: DELETE /medications/prescriptions/:id
   */
  deletePrescription: async (id: string): Promise<void> => {
    await api.delete(`/medications/prescriptions/${id}`);
  },

  // ── Drug Catalog ────────────────────────────────────────────────────────────

  /**
   * Search the drug catalog by name.
   * Backend: GET /medications/drugs/search?q=...
   * Results are cached server-side in Redis for 10 minutes.
   */
  searchDrugs: async (query: string, limit = 20): Promise<DrugSearchResult[]> => {
    const res = await api.get('/medications/drugs/search', {
      params: { q: query, limit },
    });
    return res.data;
  },

  // ── Medication Logs (UC-08: Mark Taken / Skipped) ──────────────────────────

  /**
   * Mark a prescription item as TAKEN for a specific scheduled slot.
   * Backend: POST /medications/items/:itemId/taken
   *
   * `elderlyId` must be passed so the backend can scope the log entry correctly.
   * For ELDERLY users, pass their own elderlyId.
   * For CAREGIVER/ADMIN, pass the selected patient's elderlyId.
   */
  markTaken: async (
    itemId: string,
    elderlyId: string,
    drugName: string,
    scheduledDate: string,
    scheduledTime: string,
    notes?: string,
  ): Promise<MedicationLog> => {
    const res = await api.post(`/medications/items/${itemId}/taken`, {
      elderlyId,
      drugName,
      scheduledDate,
      scheduledTime,
      notes,
    });
    return res.data;
  },

  /**
   * Mark a prescription item as SKIPPED for a specific scheduled slot.
   * Backend: POST /medications/items/:itemId/skipped
   */
  markSkipped: async (
    itemId: string,
    elderlyId: string,
    drugName: string,
    scheduledDate: string,
    scheduledTime: string,
    notes?: string,
  ): Promise<MedicationLog> => {
    const res = await api.post(`/medications/items/${itemId}/skipped`, {
      elderlyId,
      drugName,
      scheduledDate,
      scheduledTime,
      notes,
    });
    return res.data;
  },

  /**
   * Get all medication logs for an elderly patient on a specific date.
   * Backend: GET /medications/logs/elderly/:elderlyId?date=YYYY-MM-DD
   */
  getAdherenceByDate: async (elderlyId: string, date?: string): Promise<MedicationLog[]> => {
    const res = await api.get(`/medications/logs/elderly/${elderlyId}`, {
      params: date ? { date } : undefined,
    });
    return res.data;
  },

  /**
   * Get adherence statistics for an elderly patient over N days.
   * Backend: GET /medications/logs/elderly/:elderlyId/stats?days=30
   */
  getAdherenceStats: async (elderlyId: string, days = 30): Promise<AdherenceStats> => {
    const res = await api.get(`/medications/logs/elderly/${elderlyId}/stats`, {
      params: { days },
    });
    return res.data;
  },

  // ── OCR ─────────────────────────────────────────────────────────────────────

  /**
   * Upload a prescription image for OCR extraction.
   * Backend: POST /ocr/scan
   */
  scanOcr: async (file: File): Promise<OcrResult> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // ── Drug Interaction check (legacy single-call helper) ──────────────────────

  /**
   * Quick drug interaction check against a list of existing drug names.
   * This is a client-side convenience wrapper; the backend performs a full
   * interaction check automatically during prescription creation.
   *
   * NOTE: For the full safety flow use createPrescription — it checks
   * interactions server-side and blocks HIGH RISK (HTTP 400).
   */
  checkInteraction: async (
    drugName: string,
    existingDrugs: string[],
  ): Promise<DrugInteractionResult> => {
    const res = await api.post('/medications/check-interaction', {
      drugName,
      existingDrugs,
    });
    return res.data;
  },

  // ── AddMedicationFormData convenience wrapper ──────────────────────────────

  /**
   * Convert the frontend AddMedicationFormData to a full CreatePrescriptionPayload
   * and submit it to the backend.
   *
   * @param elderlyId - The elderly patient's profile ID
   * @param data      - Form values from AddMedicationForm
   */
  createFromFormData: async (
    elderlyId: string,
    data: AddMedicationFormData,
  ): Promise<Prescription> => {
    const today = new Date().toISOString().split('T')[0];

    const item: CreatePrescriptionItemPayload = {
      drugNameRaw: data.isGenericReminder ? undefined : data.drugName,
      dosage: data.isUnknownDosage || data.isGenericReminder
        ? undefined
        : data.dosage
        ? parseFloat(data.dosage)
        : undefined,
      dosageUnit: data.isUnknownDosage || data.isGenericReminder ? undefined : 'mg',
      scheduledTimes: data.time ? [data.time] : undefined,
      instructions: data.notes,
      unknownDosage: data.isUnknownDosage,
      isGenericReminder: data.isGenericReminder,
      reminderImageUrl: data.reminderImageUrl,
    };

    const payload: CreatePrescriptionPayload = {
      elderlyId,
      startDate: today,
      source: 'MANUAL',
      items: [item],
    };

    return medicationService.createPrescription(payload);
  },

  // Keep legacy get/create for backward compat with existing components
  getAll: async (elderlyId: string): Promise<PrescriptionItem[]> => {
    const res = await medicationService.getPrescriptionsByElderly(elderlyId);
    // Flatten prescriptions into items for legacy components
    return res.data.flatMap((p) =>
      p.items.map((item) => ({
        id: item.id,
        drugName: item.drug?.genericName || item.drugNameRaw || 'Unknown',
        dosage: item.dosage ? `${item.dosage} ${item.dosageUnit || 'mg'}` : undefined,
        frequency: item.frequency || '',
        time: item.scheduledTimes?.[0] || '',
        notes: item.instructions,
        status: 'pending' as const,
        interactionRisk: undefined,
      })),
    );
  },

  create: async (data: AddMedicationFormData): Promise<PrescriptionItem> => {
    // This legacy method requires elderlyId — use createFromFormData instead.
    throw new Error(
      'Use medicationService.createFromFormData(elderlyId, data) instead of medicationService.create(data)',
    );
  },
};
