import api from './api';

export interface Appointment {
  id: string;
  elderlyId: string;
  doctorName: string;
  specialty?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  appointmentDate: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  appointmentType: 'CLINIC' | 'TELEMEDICINE' | 'HOME_VISIT';
  reason?: string;
  notes?: string;
  doctorNotes?: string;
  reminderSent: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentPayload {
  elderlyId: string;
  doctorName: string;
  specialty?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  appointmentDate: string; // ISO datetime
  durationMinutes?: number;
  appointmentType?: 'CLINIC' | 'TELEMEDICINE' | 'HOME_VISIT';
  reason?: string;
  notes?: string;
}

export interface UpdateAppointmentPayload {
  doctorName?: string;
  specialty?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  appointmentDate?: string;
  durationMinutes?: number;
  appointmentType?: 'CLINIC' | 'TELEMEDICINE' | 'HOME_VISIT';
  reason?: string;
  notes?: string;
  status?: string;
}

export const appointmentService = {
  create: async (data: CreateAppointmentPayload): Promise<Appointment> => {
    const res = await api.post('/appointments', data);
    return res.data;
  },

  getByElderly: async (
    elderlyId: string,
    params?: { page?: number; limit?: number; status?: string; upcoming?: boolean },
  ): Promise<{ data: Appointment[]; total: number; page: number; limit: number }> => {
    const res = await api.get(`/appointments/elderly/${elderlyId}`, { params });
    return res.data;
  },

  getUpcoming: async (elderlyId: string, days = 7): Promise<Appointment[]> => {
    const res = await api.get(`/appointments/elderly/${elderlyId}/upcoming`, {
      params: { days },
    });
    return res.data;
  },

  getById: async (id: string): Promise<Appointment> => {
    const res = await api.get(`/appointments/${id}`);
    return res.data;
  },

  update: async (id: string, data: UpdateAppointmentPayload): Promise<Appointment> => {
    const res = await api.patch(`/appointments/${id}`, data);
    return res.data;
  },

  cancel: async (id: string): Promise<Appointment> => {
    const res = await api.patch(`/appointments/${id}/cancel`);
    return res.data;
  },

  complete: async (id: string, doctorNotes?: string): Promise<Appointment> => {
    const res = await api.patch(`/appointments/${id}/complete`, { doctorNotes });
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  },
};
