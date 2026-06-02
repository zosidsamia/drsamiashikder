const BASE_URL = import.meta.env.VITE_BACKEND_API_URL;

export const PatientAPI = {
  // GET all patients
  async getAll() {
    const res = await fetch(`${BASE_URL}/api/patients`);
    if (!res.ok) throw new Error("Failed to fetch patients");
    return res.json();
  },

  // CREATE patient
  async create(patient: any) {
    const res = await fetch(`${BASE_URL}/api/patients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patient),
    });

    if (!res.ok) throw new Error("Failed to create patient");
    return res.json();
  },
};