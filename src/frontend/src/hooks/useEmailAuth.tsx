import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { StaffRole } from "../types";

const REGISTRY_KEY = "medicare_doctors_registry";
const SESSION_KEY = "medicare_current_doctor";
const PATIENT_REGISTRY_KEY = "medicare_patients_auth_registry";
const PATIENT_SESSION_KEY = "medicare_patient_session";
const AUDIT_LOG_KEY = "medicare_audit_log";
// Canonical cross-session email key — used by getDoctorEmail() in useQueries.ts
// to ensure every device resolves the same storage key prefix after login.
const CANONICAL_EMAIL_KEY = "app_current_user_email";
const PATIENT_SIGNUP_MAP_KEY = "medicare_patient_signup_map";

export interface DoctorAccount {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  designation: string;
  degree: string;
  specialization: string;
  hospital: string;
  phone: string;
  createdAt: string;
  role: StaffRole;
  status: "pending" | "approved" | "rejected";
}

export interface PatientAccount {
  id: string;
  phone: string;
  passwordHash: string;
  name: string;
  age?: string;
  gender?: string;
  registerNumber?: string;
  patientId?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userRole: StaffRole | "admin" | "patient";
  userName: string;
  action: string;
  target: string;
}

function hashPassword(key: string, password: string): string {
  return btoa(`${key.toLowerCase()}::${password}`);
}

const VALID_ROLES: StaffRole[] = [
  "consultant_doctor",
  "medical_officer",
  "intern_doctor",
  "nurse",
  "staff",
  "doctor",
];

export function loadRegistry(): DoctorAccount[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DoctorAccount[];
      return parsed.map((d) => ({
        ...d,
        role: VALID_ROLES.includes(d.role) ? d.role : "doctor",
        status: d.status ?? "approved",
      }));
    }
  } catch {}
  return [];
}

export function saveRegistry(registry: DoctorAccount[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function loadPatientRegistry(): PatientAccount[] {
  try {
    const raw = localStorage.getItem(PATIENT_REGISTRY_KEY);
    if (raw) return JSON.parse(raw) as PatientAccount[];
  } catch {}
  return [];
}

export function savePatientRegistry(registry: PatientAccount[]) {
  localStorage.setItem(PATIENT_REGISTRY_KEY, JSON.stringify(registry));
}

export function appendAuditLog(entry: Omit<AuditLogEntry, "id">) {
  try {
    const logs = getAuditLog();
    logs.push({
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    });
    const trimmed = logs.slice(-1000);
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function getAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (raw) return JSON.parse(raw) as AuditLogEntry[];
  } catch {}
  return [];
}

// ── Sign-up map helpers ───────────────────────────────────────────────────────

export function loadSignUpMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PATIENT_SIGNUP_MAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {}
  return {};
}

export function saveSignUpMap(map: Record<string, boolean>) {
  localStorage.setItem(PATIENT_SIGNUP_MAP_KEY, JSON.stringify(map));
}

export function setSignUpEnabled(registerNumber: string, enabled: boolean) {
  const map = loadSignUpMap();
  if (enabled) {
    map[registerNumber] = true;
  } else {
    delete map[registerNumber];
  }
  saveSignUpMap(map);
}

export function isSignUpEnabled(registerNumber: string): boolean {
  const map = loadSignUpMap();
  return map[registerNumber] === true;
}

// Normalize register number: "0001/26" and "1/26" treated as equal
function normalizeRegNo(rn: string): string {
  const parts = rn.trim().split("/");
  if (parts.length === 2) {
    const num = Number.parseInt(parts[0].trim(), 10);
    return `${Number.isNaN(num) ? parts[0].trim() : num}/${parts[1].trim()}`;
  }
  return rn.trim().toLowerCase();
}

interface EmailAuthContextValue {
  currentDoctor: DoctorAccount | null;
  currentPatient: PatientAccount | null;
  isInitializing: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  signUp: (
    data: Omit<
      DoctorAccount,
      "id" | "passwordHash" | "createdAt" | "status"
    > & { password: string },
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (
    data: Partial<Omit<DoctorAccount, "id" | "passwordHash" | "createdAt">>,
  ) => void;
  getPendingAccounts: () => DoctorAccount[];
  approveAccount: (id: string) => void;
  approveAccountWithRole: (id: string, role: StaffRole) => void;
  rejectAccount: (id: string) => void;
  reassignRole: (id: string, role: StaffRole) => void;
  // Patient auth
  patientSignUp: (data: {
    registerNumber: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  patientSignIn: (phone: string, password: string) => Promise<void>;
  patientSignOut: () => void;
  getPendingPatients: () => PatientAccount[];
  approvePatient: (id: string) => void;
  rejectPatient: (id: string) => void;
  updatePatientCredentials: (
    registerNumber: string,
    newPhone?: string,
    newPassword?: string,
  ) => void;
}

const EmailAuthContext = createContext<EmailAuthContextValue | null>(null);

export function EmailAuthProvider({ children }: { children: React.ReactNode }) {
  const [currentDoctor, setCurrentDoctor] = useState<DoctorAccount | null>(
    null,
  );
  const [currentPatient, setCurrentPatient] = useState<PatientAccount | null>(
    null,
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const doctorId = localStorage.getItem(SESSION_KEY);
    if (doctorId) {
      const registry = loadRegistry();
      const doctor = registry.find((d) => d.id === doctorId) ?? null;
      setCurrentDoctor(doctor);
    }
    const patientId = localStorage.getItem(PATIENT_SESSION_KEY);
    if (patientId) {
      const registry = loadPatientRegistry();
      const patient = registry.find((p) => p.id === patientId) ?? null;
      setCurrentPatient(patient);
    }
    setIsInitializing(false);
  }, []);

  const signUp = useCallback(
    async (
      data: Omit<
        DoctorAccount,
        "id" | "passwordHash" | "createdAt" | "status"
      > & { password: string },
    ) => {
      setIsLoggingIn(true);
      setAuthError(null);
      try {
        const registry = loadRegistry();
        const patientRegistry = loadPatientRegistry();

        // Global cross-check: email must not exist in ANY registry
        const existingInPatients = patientRegistry.find(
          (p) =>
            (p as unknown as { email?: string }).email?.toLowerCase() ===
            data.email.toLowerCase(),
        );
        if (existingInPatients) {
          throw new Error("This email is already registered in the system.");
        }

        const existing = registry.find(
          (d) => d.email.toLowerCase() === data.email.toLowerCase(),
        );
        if (existing) {
          if (existing.status === "rejected") {
            const idx = registry.findIndex((d) => d.id === existing.id);
            const { password, ...rest } = data;
            registry[idx] = {
              ...rest,
              id: existing.id,
              passwordHash: hashPassword(data.email, password),
              createdAt: new Date().toISOString(),
              status: "pending",
            };
            saveRegistry(registry);
            throw new Error(
              "Your account has been re-submitted for approval. Please wait for admin approval.",
            );
          }
          throw new Error("This email is already registered in the system.");
        }
        const { password, ...rest } = data;
        const newDoctor: DoctorAccount = {
          ...rest,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          passwordHash: hashPassword(data.email, password),
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        registry.push(newDoctor);
        saveRegistry(registry);
        throw new Error(
          "Account created! Please wait for admin approval before logging in.",
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Sign up failed.";
        setAuthError(msg);
        throw e;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const registry = loadRegistry();
      const doctor = registry.find(
        (d) => d.email.toLowerCase() === email.toLowerCase(),
      );
      if (!doctor) throw new Error("No account found with this email.");
      if (doctor.passwordHash !== hashPassword(email, password))
        throw new Error("Incorrect password.");
      if (doctor.status === "pending")
        throw new Error("Your account is pending admin approval. Please wait.");
      if (doctor.status === "rejected")
        throw new Error(
          "Your account has been rejected. Please contact the admin or re-register.",
        );
      localStorage.setItem(SESSION_KEY, doctor.id);
      localStorage.setItem(CANONICAL_EMAIL_KEY, doctor.email);
      setCurrentDoctor(doctor);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: doctor.role,
        userName: doctor.name,
        action: "Logged in",
        target: "System",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed.";
      setAuthError(msg);
      throw e;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    if (currentDoctor) {
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: currentDoctor.role,
        userName: currentDoctor.name,
        action: "Logged out",
        target: "System",
      });
    }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CANONICAL_EMAIL_KEY);
    setCurrentDoctor(null);
    setAuthError(null);
  }, [currentDoctor]);

  const updateProfile = useCallback(
    (
      data: Partial<Omit<DoctorAccount, "id" | "passwordHash" | "createdAt">>,
    ) => {
      if (!currentDoctor) return;
      const registry = loadRegistry();
      const idx = registry.findIndex((d) => d.id === currentDoctor.id);
      if (idx < 0) return;
      const updated = { ...registry[idx], ...data };
      registry[idx] = updated;
      saveRegistry(registry);
      setCurrentDoctor(updated);
    },
    [currentDoctor],
  );

  const getPendingAccounts = useCallback((): DoctorAccount[] => {
    return loadRegistry().filter((d) => d.status === "pending");
  }, []);

  const approveAccount = useCallback((id: string) => {
    const registry = loadRegistry();
    const idx = registry.findIndex((d) => d.id === id);
    if (idx >= 0) {
      registry[idx] = { ...registry[idx], status: "approved" };
      saveRegistry(registry);
    }
  }, []);

  const approveAccountWithRole = useCallback((id: string, role: StaffRole) => {
    const registry = loadRegistry();
    const idx = registry.findIndex((d) => d.id === id);
    if (idx >= 0) {
      registry[idx] = { ...registry[idx], status: "approved", role };
      saveRegistry(registry);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "admin",
        userName: "Admin",
        action: `Approved account with role: ${role}`,
        target: registry[idx].name,
      });
    }
  }, []);

  const reassignRole = useCallback((id: string, role: StaffRole) => {
    const registry = loadRegistry();
    const idx = registry.findIndex((d) => d.id === id);
    if (idx >= 0) {
      registry[idx] = { ...registry[idx], role };
      saveRegistry(registry);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "admin",
        userName: "Admin",
        action: `Reassigned role to: ${role}`,
        target: registry[idx].name,
      });
    }
  }, []);

  const rejectAccount = useCallback((id: string) => {
    const registry = loadRegistry();
    const idx = registry.findIndex((d) => d.id === id);
    if (idx >= 0) {
      const before = JSON.stringify(registry[idx]);
      registry[idx] = { ...registry[idx], status: "rejected" };
      saveRegistry(registry);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "admin",
        userName: "Admin",
        action: "SOFT_DELETE — Account rejected",
        target: registry[idx].name,
      });
      // Detailed before/after for medico-legal trail
      const detailed = {
        timestamp: new Date().toISOString(),
        userRole: "admin" as const,
        userName: "Admin",
        action: "Account status changed to rejected (SOFT_DELETE)",
        target: `before: ${before} | after: status=rejected`,
      };
      appendAuditLog(detailed);
    }
  }, []);

  // ── Patient auth ──────────────────────────────────────────────────────────

  const patientSignUp = useCallback(
    async (data: {
      registerNumber: string;
      phone: string;
      password: string;
    }) => {
      setIsLoggingIn(true);
      setAuthError(null);
      try {
        const { registerNumber, phone, password } = data;

        if (!registerNumber?.trim()) {
          throw new Error(
            "Register number is required. Please contact the clinic to get your register number.",
          );
        }

        // Scan all patient storage keys for register number match
        const allPatients: Array<Record<string, unknown>> = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith("patients_") ||
              k.startsWith("medicare_patients_data") ||
              k === "medicare_patients")
          ) {
            try {
              const raw = localStorage.getItem(k);
              if (!raw) continue;
              const arr = JSON.parse(raw);
              if (Array.isArray(arr)) allPatients.push(...arr);
            } catch {}
          }
        }

        // Verify register number exists
        const matchedPatient = allPatients.find(
          (p) =>
            typeof p.registerNumber === "string" &&
            normalizeRegNo(p.registerNumber) === normalizeRegNo(registerNumber),
        );
        if (!matchedPatient) {
          throw new Error(
            "Register number not found. Please make sure you enter the exact register number given by the clinic (e.g. 0001/26). Contact the clinic if you need help.",
          );
        }

        // Auto-fill patient details from the record
        const patientName =
          (matchedPatient.fullName as string) ||
          (matchedPatient.name as string) ||
          "Patient";
        const patientAge = matchedPatient.dateOfBirth
          ? String(
              Math.floor(
                (Date.now() -
                  new Date(
                    Number(
                      typeof matchedPatient.dateOfBirth === "bigint"
                        ? (matchedPatient.dateOfBirth as bigint) / 1000000n
                        : (matchedPatient.dateOfBirth as number),
                    ),
                  ).getTime()) /
                  (365.25 * 24 * 3600 * 1000),
              ),
            )
          : ((matchedPatient.age as string) ?? "");
        const patientGender = (matchedPatient.gender as string) ?? "";

        // Resolve patient ID for linking
        const rawId = matchedPatient.id;
        const patientId =
          typeof rawId === "string" && rawId.startsWith("__bigint__")
            ? rawId.slice(10)
            : String(rawId);

        const registry = loadPatientRegistry();

        // Global cross-check: phone used as identifier, but also check doctor registry for email collision
        // (patients use phone as login key; check email field if present)

        // Check duplicate by phone
        const existingByPhone = registry.find((p) => p.phone === phone);
        if (existingByPhone) {
          if (existingByPhone.status === "rejected") {
            const idx = registry.findIndex((p) => p.id === existingByPhone.id);
            registry[idx] = {
              ...existingByPhone,
              name: patientName,
              age: patientAge,
              gender: patientGender,
              registerNumber: registerNumber.trim(),
              patientId,
              passwordHash: hashPassword(phone, password),
              createdAt: new Date().toISOString(),
              status: "pending",
            };
            savePatientRegistry(registry);
            throw new Error(
              "Your account has been re-submitted for approval. Please wait for doctor approval.",
            );
          }
          throw new Error("An account with this phone number already exists.");
        }

        // Check duplicate by register number
        const existingByRegNo = registry.find(
          (p) =>
            p.registerNumber &&
            normalizeRegNo(p.registerNumber) === normalizeRegNo(registerNumber),
        );
        if (existingByRegNo) {
          if (existingByRegNo.status === "rejected") {
            const idx = registry.findIndex((p) => p.id === existingByRegNo.id);
            registry[idx] = {
              ...existingByRegNo,
              phone,
              name: patientName,
              age: patientAge,
              gender: patientGender,
              patientId,
              passwordHash: hashPassword(phone, password),
              createdAt: new Date().toISOString(),
              status: "pending",
            };
            savePatientRegistry(registry);
            throw new Error(
              "Your account has been re-submitted for approval. Please wait for doctor approval.",
            );
          }
          throw new Error(
            "An account for this register number already exists. Please log in instead.",
          );
        }

        const newPatient: PatientAccount = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          phone,
          passwordHash: hashPassword(phone, password),
          name: patientName,
          age: patientAge,
          gender: patientGender,
          registerNumber: registerNumber.trim(),
          patientId,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        registry.push(newPatient);
        savePatientRegistry(registry);
        throw new Error(
          "Account created! Please wait for doctor approval before logging in.",
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Sign up failed.";
        setAuthError(msg);
        throw e;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [],
  );

  const patientSignIn = useCallback(async (phone: string, password: string) => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const registry = loadPatientRegistry();
      const patient = registry.find((p) => p.phone === phone);
      if (!patient) throw new Error("No account found with this phone number.");
      if (patient.passwordHash !== hashPassword(phone, password))
        throw new Error("Incorrect password.");
      if (patient.status === "pending")
        throw new Error(
          "Your account is pending doctor approval. Please wait.",
        );
      if (patient.status === "rejected")
        throw new Error(
          "Your account has been rejected. Please contact your doctor.",
        );
      localStorage.setItem(PATIENT_SESSION_KEY, patient.id);
      setCurrentPatient(patient);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "patient",
        userName: patient.name,
        action: "Logged in",
        target: "Patient Portal",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed.";
      setAuthError(msg);
      throw e;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const patientSignOut = useCallback(() => {
    if (currentPatient) {
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "patient",
        userName: currentPatient.name,
        action: "Logged out",
        target: "Patient Portal",
      });
    }
    localStorage.removeItem(PATIENT_SESSION_KEY);
    setCurrentPatient(null);
    setAuthError(null);
  }, [currentPatient]);

  const getPendingPatients = useCallback((): PatientAccount[] => {
    return loadPatientRegistry().filter((p) => p.status === "pending");
  }, []);

  const approvePatient = useCallback((id: string) => {
    const registry = loadPatientRegistry();
    const idx = registry.findIndex((p) => p.id === id);
    if (idx >= 0) {
      registry[idx] = { ...registry[idx], status: "approved" };
      savePatientRegistry(registry);
    }
  }, []);

  const rejectPatient = useCallback((id: string) => {
    const registry = loadPatientRegistry();
    const idx = registry.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const before = JSON.stringify(registry[idx]);
      registry[idx] = { ...registry[idx], status: "rejected" };
      savePatientRegistry(registry);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "admin",
        userName: "Admin",
        action: "SOFT_DELETE — Patient account rejected",
        target: `Patient: ${registry[idx].name} | before: ${before} | after: status=rejected`,
      });
    }
  }, []);

  const updatePatientCredentials = useCallback(
    (registerNumber: string, newPhone?: string, newPassword?: string) => {
      const registry = loadPatientRegistry();
      const idx = registry.findIndex(
        (p) =>
          p.registerNumber &&
          normalizeRegNo(p.registerNumber) === normalizeRegNo(registerNumber),
      );
      if (idx < 0) return;
      const patient = registry[idx];
      const updatedPhone = newPhone?.trim() || patient.phone;
      const updatedHash = newPassword?.trim()
        ? hashPassword(updatedPhone, newPassword.trim())
        : patient.passwordHash;
      registry[idx] = {
        ...patient,
        phone: updatedPhone,
        passwordHash: updatedHash,
      };
      savePatientRegistry(registry);
      setCurrentPatient((prev) => {
        if (
          prev?.registerNumber &&
          normalizeRegNo(prev.registerNumber) === normalizeRegNo(registerNumber)
        ) {
          return { ...prev, phone: updatedPhone, passwordHash: updatedHash };
        }
        return prev;
      });
    },
    [],
  );

  return (
    <EmailAuthContext.Provider
      value={{
        currentDoctor,
        currentPatient,
        isInitializing,
        isLoggingIn,
        authError,
        signUp,
        signIn,
        signOut,
        updateProfile,
        getPendingAccounts,
        approveAccount,
        approveAccountWithRole,
        rejectAccount,
        reassignRole,
        patientSignUp,
        patientSignIn,
        patientSignOut,
        getPendingPatients,
        approvePatient,
        rejectPatient,
        updatePatientCredentials,
      }}
    >
      {children}
    </EmailAuthContext.Provider>
  );
}

export function useEmailAuth(): EmailAuthContextValue {
  const ctx = useContext(EmailAuthContext);
  if (!ctx)
    throw new Error("useEmailAuth must be used inside EmailAuthProvider");
  return ctx;
}

// ── Inactivity Timer ──────────────────────────────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_WARNING_MS = 13 * 60 * 1000; // 13 minutes (2 min before logout)
const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "touchstart",
  "scroll",
] as const;

export interface InactivityTimerState {
  showWarning: boolean;
  secondsRemaining: number;
  resetTimer: () => void;
}

/**
 * useInactivityTimer — tracks user activity and triggers auto-logout.
 * Returns { showWarning, secondsRemaining, resetTimer }.
 * Must be called inside a component that has access to useEmailAuth.
 */
export function useInactivityTimer(onLogout: () => void): InactivityTimerState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    logoutTimerRef.current = null;
    warningTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsRemaining(120);

    // Warning at 13 minutes
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsRemaining(120);
      countdownRef.current = setInterval(() => {
        setSecondsRemaining((s) => {
          if (s <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, INACTIVITY_WARNING_MS);

    // Logout at 15 minutes
    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      onLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearAllTimers, onLogout]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    startTimers();
  }, [startTimers]);

  // Start on mount
  useEffect(() => {
    startTimers();
    return clearAllTimers;
  }, [startTimers, clearAllTimers]);

  // Attach activity listeners
  useEffect(() => {
    const handler = () => resetTimer();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, handler, { passive: true });
    }
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, handler);
      }
    };
  }, [resetTimer]);

  return { showWarning, secondsRemaining, resetTimer };
}
