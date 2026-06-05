import { useCallback, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  duration: number;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

export const useAppointments = (token?: string | null) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  });

  const fetchAppointments = useCallback(
    async (patientId: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/appointments/patient/${patientId}`, {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch appointments');
        const data = await response.json();
        setAppointments(data);
        return data;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createAppointment = useCallback(
    async (appointmentData: Omit<Appointment, 'id'>) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/appointments`, {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify(appointmentData),
        });
        if (!response.ok) throw new Error('Failed to create appointment');
        const newAppointment = await response.json();
        setAppointments([...appointments, newAppointment]);
        return newAppointment;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token, appointments]
  );

  const updateAppointmentStatus = useCallback(
    async (id: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no_show') => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/appointments/${id}/status`, {
          method: 'PATCH',
          headers: getAuthHeader(),
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error('Failed to update appointment');
        const updated = await response.json();
        setAppointments(appointments.map(a => (a.id === id ? updated : a)));
        return updated;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token, appointments]
  );

  return {
    appointments,
    loading,
    error,
    fetchAppointments,
    createAppointment,
    updateAppointmentStatus,
  };
};
