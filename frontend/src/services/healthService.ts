import api from './api';
import type { HealthMetric, VitalSigns } from '../types';

// ── Types matching the NestJS HealthModule backend DTOs ──────────────────────

export interface RecordVitalsPayload {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  spo2?: number;
  bloodSugar?: number;
  steps?: number;
  moodScore?: number;
  notes?: string;
}

export type VitalStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface RecordVitalsResponse {
  id: string;
  elderlyId: string;
  status: VitalStatus;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  spo2?: number;
  bloodSugar?: number;
  steps?: number;
  moodScore?: number;
  notes?: string;
  recordedAt: string;
}

export interface TrendPoint {
  date: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  spo2?: number;
  temperature?: number;
  bloodSugar?: number;
  status?: VitalStatus;
}

export interface TrendAnomaly {
  date: string;
  field: string;
  value: number;
  mean: number;
  deviation: number;
}

export interface TrendSummary {
  totalReadings: number;
  criticalCount: number;
  warningCount: number;
  normalCount: number;
  averageHeartRate: number | null;
}

export interface HealthTrendsResponse {
  range: { from: string; to: string };
  trendData: TrendPoint[];
  anomalies: TrendAnomaly[];
  summary: TrendSummary;
}

export type TrendRange = '7d' | '30d' | '90d' | '1y';

// ── Health Service ────────────────────────────────────────────────────────────

export const healthService = {
  /**
   * Record new vital signs for an elderly patient.
   * Backend: POST /health/elderly/:elderlyId/vitals
   *
   * The backend automatically classifies the reading as NORMAL / WARNING / CRITICAL
   * and fires health alert events if thresholds are exceeded.
   */
  recordVitals: async (
    elderlyId: string,
    data: RecordVitalsPayload,
  ): Promise<RecordVitalsResponse> => {
    const res = await api.post(`/health/elderly/${elderlyId}/vitals`, data);
    return res.data;
  },

  /**
   * Get health trend data for an elderly patient over a date range.
   * Backend: GET /health/elderly/:elderlyId/trends?range=30d
   *
   * Includes trendData points, AI-detected anomalies, and a summary.
   */
  getTrends: async (
    elderlyId: string,
    range: TrendRange = '30d',
  ): Promise<HealthTrendsResponse> => {
    const res = await api.get(`/health/elderly/${elderlyId}/trends`, {
      params: { range },
    });
    return res.data;
  },

  /**
   * Get the latest recorded vital signs for an elderly patient.
   * Backend: GET /health/elderly/:elderlyId/latest
   */
  getLatest: async (elderlyId: string): Promise<VitalSigns | null> => {
    try {
      const res = await api.get(`/health/elderly/${elderlyId}/latest`);
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Get health metric history for the last N days.
   * Backend: GET /health/elderly/:elderlyId/metrics?days=7
   */
  getHistory: async (elderlyId: string, days = 7): Promise<HealthMetric[]> => {
    const res = await api.get(`/health/elderly/${elderlyId}/metrics`, {
      params: { days },
    });
    return res.data;
  },

  /**
   * Get the health dashboard summary for a caregiver view.
   * Backend: GET /health/elderly/:elderlyId/dashboard
   */
  getDashboard: async (elderlyId: string) => {
    const res = await api.get(`/health/elderly/${elderlyId}/dashboard`);
    return res.data;
  },

  // Legacy alias kept for HealthTrackingPage backward compatibility
  record: async (
    elderlyId: string,
    data: RecordVitalsPayload,
  ): Promise<RecordVitalsResponse> => {
    return healthService.recordVitals(elderlyId, data);
  },
};
