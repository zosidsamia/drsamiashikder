import { useCallback, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Vitals {
  id: string;
  patientId: string;
  bloodPressure: string;
  pulse: number;
  temperature: number;
  respiratoryRate: number;
  spO2: number;
  bloodGlucose?: number;
  gcs?: number;
  recordedAt: string;
  recordedBy: string;
  status: 'drafted' | 'pending_review' | 'verified' | 'rejected';
}

export const useVitals = (token?: string | null) => {
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  });

  const fetchVitals = useCallback(
    async (patientId: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/vitals/patient/${patientId}`, {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch vitals');
        const data = await response.json();
        setVitals(data);
        return data;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const recordVitals = useCallback(
    async (patientId: string, vitalsData: Omit<Vitals, 'id' | 'recordedAt' | 'recordedBy' | 'status'>) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/vitals`, {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify(vitalsData),
        });
        if (!response.ok) throw new Error('Failed to record vitals');
        const newVitals = await response.json();
        setVitals([newVitals, ...vitals]);
        return newVitals;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token, vitals]
  );

  const verifyVitals = useCallback(
    async (vitalsId: string, status: 'pending_review' | 'verified' | 'rejected') => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/vitals/${vitalsId}/verify`, {
          method: 'PATCH',
          headers: getAuthHeader(),
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error('Failed to verify vitals');
        const updated = await response.json();
        setVitals(vitals.map(v => (v.id === vitalsId ? updated : v)));
        return updated;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token, vitals]
  );

  return {
    vitals,
    loading,
    error,
    fetchVitals,
    recordVitals,
    verifyVitals,
  };
};
