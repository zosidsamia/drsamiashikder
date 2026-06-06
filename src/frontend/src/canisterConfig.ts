// Stub canister configuration file kept for build compatibility.
// No canister IDs are configured in Supabase-only mode.

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
