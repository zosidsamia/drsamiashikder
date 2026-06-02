import { supabase } from "./supabase";

/**
 * SUPABASE DATABASE ADAPTER LAYER
 * (replaces ICP canister functions)
 */

export const db = {
  // ========================
  // PATIENTS
  // ========================
  async createPatient(data: any) {
    const { data: result, error } = await supabase
      .from("patients")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async getPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*");

    if (error) throw error;
    return data;
  },

  // ========================
  // APPOINTMENTS
  // ========================
  async createAppointment(data: any) {
    const { data: result, error } = await supabase
      .from("appointments")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async getAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select("*");

    if (error) throw error;
    return data;
  },

  // ========================
  // GENERIC HELPERS
  // ========================
  async insert(table: string, data: any) {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data);

    if (error) throw error;
    return result;
  },

  async select(table: string) {
    const { data, error } = await supabase
      .from(table)
      .select("*");

    if (error) throw error;
    return data;
  },
};