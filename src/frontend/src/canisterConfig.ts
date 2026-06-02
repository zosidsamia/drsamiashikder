// Auto-generated at build time by vite.config.js — do not edit manually
// Generated: 2026-06-02T12:48:25.965Z

export const CANISTER_IDS = {
  patientData:     "",
  clinicalData:    "",
  admissionData:   "",
  appointmentData: "",
  queueData:       "",
  alertData:       "",
  authRoles:       "",
  syncDevice:      "",
} as const;

export type CanisterName = keyof typeof CANISTER_IDS;

// Legacy single-ID export — kept for backward compatibility with existing code
export const BUILD_TIME_CANISTER_ID: string = "";
// Alias used by older imports
export const CANISTER_ID_BACKEND: string = "";
export const CANISTER_HOST: string = "https://icp0.io";
