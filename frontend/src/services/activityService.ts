import api from './api';

export interface Activity {
  id: string;
  elderlyId: string;
  activityType: string;
  durationMinutes: number;
  stepsCount?: number;
  distanceKm?: number;
  caloriesBurned?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  intensity: 'LOW' | 'MODERATE' | 'HIGH';
  notes?: string;
  performedAt: string;
  recordedBy?: string;
  createdAt: string;
}

export interface CreateActivityPayload {
  elderlyId: string;
  activityType: string;
  durationMinutes: number;
  stepsCount?: number;
  distanceKm?: number;
  caloriesBurned?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  intensity?: 'LOW' | 'MODERATE' | 'HIGH';
  notes?: string;
  performedAt?: string;
}

export interface ActivitySummary {
  days: number;
  totalActivities: number;
  totalMinutes: number;
  totalSteps: number;
  totalCalories: number;
  avgDuration: number;
  byType: Record<string, number>;
  byIntensity: Record<string, number>;
}

export const activityService = {
  create: async (data: CreateActivityPayload): Promise<Activity> => {
    const res = await api.post('/activities', data);
    return res.data;
  },

  getByElderly: async (
    elderlyId: string,
    params?: { page?: number; limit?: number; days?: number },
  ): Promise<{ data: Activity[]; total: number; page: number; limit: number }> => {
    const res = await api.get(`/activities/elderly/${elderlyId}`, { params });
    return res.data;
  },

  getSummary: async (elderlyId: string, days = 7): Promise<ActivitySummary> => {
    const res = await api.get(`/activities/elderly/${elderlyId}/summary`, {
      params: { days },
    });
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/activities/${id}`);
  },
};
