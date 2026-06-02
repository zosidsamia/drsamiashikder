import { supabase } from "../lib/supabaseClient";

export const PatientService = {
  // Supabase handles data
  async getPatients() {
    return await supabase.from("patients").select("*");
  },

  async createPatient(data: any) {
    return await supabase.from("patients").insert(data);
  },
};