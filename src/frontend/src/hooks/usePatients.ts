import { useCallback, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O';
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bloodGroup?: string;
  allergies?: string[];
  medicalHistory?: string[];
}

export const usePatients = (token?: string | null) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  });

  const fetchPatients = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/patients`, {
        headers: getAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch patients');
      const data = await response.json();
      setPatients(data);
      return data;
    } catch (err: any) {
      const message = err.message || 'Error fetching patients';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const getPatient = useCallback(
    async (id: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/patients/${id}`, {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch patient');
        return await response.json();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createPatient = useCallback(
    async (patientData: Omit<Patient, 'id'>) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/patients`, {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify(patientData),
        });
        if (!response.ok) throw new Error('Failed to create patient');
        const newPatient = await response.json();
        setPatients([...patients, newPatient]);
        return newPatient;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token, patients]
  );

  const updatePatient = useCallback(
    async (id: string, patientData: Partial<Patient>) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/patients/${id}`, {
          method: 'PUT',
          headers: getAuthHeader(),
          body: JSON.stringify(patientData),
        });
        if (!response.ok) throw new Error('Failed to update patient');
        const updated = await response.json();
        setPatients(patients.map(p => (p.id === id ? updated : p)));
        return updated;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token, patients]
  );

  return {
    patients,
    loading,
    error,
    fetchPatients,
    getPatient,
    createPatient,
    updatePatient,
  };
};
