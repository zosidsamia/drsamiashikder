import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { saveClinicalEntitiesWithSync } from "../lib/hybridStorage";
import type {
  AdmissionHistory,
  AuditEntry,
  BedRecord,
  ClinicalAlert,
  ClinicalNote,
  ClinicalOrder,
  DiagnosisTemplate,
  DrugReminder,
  Encounter,
  Medication,
  Observation,
  Patient,
  Prescription,
  PrescriptionHeaderType,
  PrescriptionLabel,
  PrescriptionRecord,
  PrescriptionStatus,
  StaffRole,
  UserProfile,
  Visit,
  VitalSigns,
} from "../types";

// ─── Canister actor singleton ────────────────────────────────────────────────
// App.tsx calls setCanisterActor(actor) once after it creates the actor.
// Query functions call getCanisterActor() to read from canister when online.
// This avoids prop-drilling the actor through every component.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _canisterActor: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setCanisterActor(actor: any): void {
  _canisterActor = actor;
}

/** Get the current canister actor — used by non-hook code that needs direct access */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCanisterActor(): any | null {
  return _canisterActor;
}

/** Exported ref getter for modules that import dynamically */
export const _canisterActorRef = () => _canisterActor;

function canUseCanister(): boolean {
  return _canisterActor !== null && navigator.onLine;
}

// ─── BigInt serialization helpers ───────────────────────────────────────────

function serializeBigInt(value: unknown): unknown {
  if (typeof value === "bigint") {
    return `__bigint__${value.toString()}`;
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeBigInt(v);
    }
    return result;
  }
  return value;
}

function deserializeBigInt(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("__bigint__")) {
    return BigInt(value.slice(10));
  }
  if (Array.isArray(value)) {
    return value.map(deserializeBigInt);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deserializeBigInt(v);
    }
    return result;
  }
  return value;
}

export function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(serializeBigInt(data)));
  } catch (err) {
    console.error("saveToStorage error:", key, err);
    throw err;
  }
}

export function loadFromStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return deserializeBigInt(JSON.parse(raw)) as T[];
  } catch {
    return [];
  }
}

// Scan ALL keys with prefix (e.g., patients_*) regardless of doctor email
export function loadFromAllDoctorKeys<T>(prefix: string): T[] {
  try {
    const results: T[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${prefix}_`)) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const items = deserializeBigInt(JSON.parse(raw)) as T[];
          if (Array.isArray(items)) results.push(...items);
        } catch {}
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Doctor email helper ─────────────────────────────────────────────────────

const CANONICAL_EMAIL_KEY = "app_current_user_email";

/**
 * Returns the canonical email for the currently logged-in user.
 * Checks the canonical key first (most reliable across sessions/devices),
 * then falls back to legacy keys and writes the result back to the canonical
 * key so the next call is instant.
 */
export function getDoctorEmail(): string {
  try {
    // 1. Canonical key — written on every successful login
    const canonical = localStorage.getItem(CANONICAL_EMAIL_KEY);
    if (canonical) return canonical;

    // 2. Legacy staff_auth key
    const raw = localStorage.getItem("staff_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email) {
        localStorage.setItem(CANONICAL_EMAIL_KEY, parsed.email);
        return parsed.email;
      }
    }

    // 3. Doctor session lookup
    const sessionId = localStorage.getItem("medicare_current_doctor");
    if (sessionId) {
      const registry = JSON.parse(
        localStorage.getItem("medicare_doctors_registry") || "[]",
      ) as Array<{ id: string; email: string }>;
      const doctor = registry.find((d) => d.id === sessionId);
      if (doctor?.email) {
        localStorage.setItem(CANONICAL_EMAIL_KEY, doctor.email);
        return doctor.email;
      }
    }
    return "default";
  } catch {
    return "default";
  }
}

/**
 * Call this immediately after a successful login to fix the canonical email
 * key for all subsequent storage operations on this device.
 */
export function setCanonicalUserEmail(email: string): void {
  if (email) localStorage.setItem(CANONICAL_EMAIL_KEY, email);
}

/**
 * Call this on logout to clear the canonical email key.
 */
export function clearCanonicalUserEmail(): void {
  localStorage.removeItem(CANONICAL_EMAIL_KEY);
}

export function storageKey(prefix: string): string {
  return `${prefix}_${getDoctorEmail()}`;
}

// Helper to get visit form data, scanning all doctor emails as fallback
export function getVisitFormData(
  visitId: string | bigint | null,
): Record<string, any> | null {
  if (!visitId) return null;
  const id = String(visitId);
  const email = getDoctorEmail();
  try {
    const raw = localStorage.getItem(`visit_form_data_${id}_${email}`);
    if (raw) return JSON.parse(raw) as Record<string, unknown>;
  } catch {}
  // Scan all matching keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`visit_form_data_${id}_`)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as Record<string, unknown>;
      } catch {}
    }
  }
  return null;
}

function nextId<T extends { id: bigint }>(items: T[]): bigint {
  if (items.length === 0) return 1n;
  return items.reduce((max, item) => (item.id > max ? item.id : max), 0n) + 1n;
}

/**
 * Merge two arrays by id.
 * Last-writer-wins: the record with the higher `updatedAt` (bigint nanoseconds) wins.
 * Falls back to preferring remote if neither has updatedAt.
 */
function mergeArraysById<T extends { id: unknown; updatedAt?: unknown }>(
  local: T[],
  remote: T[],
): T[] {
  const resultMap = new Map<string, T>();
  for (const item of local) {
    resultMap.set(String(item.id), item);
  }
  for (const remoteItem of remote) {
    const key = String(remoteItem.id);
    const localItem = resultMap.get(key);
    if (!localItem) {
      resultMap.set(key, remoteItem);
    } else {
      // Higher updatedAt wins
      const remoteTs = BigInt(String(remoteItem.updatedAt ?? 0));
      const localTs = BigInt(String(localItem.updatedAt ?? 0));
      if (remoteTs >= localTs) {
        resultMap.set(key, remoteItem);
      }
    }
  }
  return Array.from(resultMap.values());
}

// ─── Register number generator ───────────────────────────────────────────────

export function generateRegisterNumber(): string {
  const counter =
    Number.parseInt(localStorage.getItem("medicare_register_counter") || "0") +
    1;
  localStorage.setItem("medicare_register_counter", String(counter));
  const year = new Date().getFullYear().toString().slice(-2);
  return `${String(counter).padStart(4, "0")}/${year}`;
}

// ─── Direct patient creation (used by appointment confirmation) ───────────────

export function createPatientInStorage(data: {
  fullName: string;
  phone?: string | null;
  gender?: string;
  dateOfBirth?: bigint | null;
  patientType?: string;
  allergies?: string[];
  chronicConditions?: string[];
}): Patient {
  const key = storageKey("patients");
  const patients = loadFromStorage<Patient>(key);
  // Avoid duplicates (same name + phone)
  const exists = patients.find(
    (p) =>
      p.fullName.toLowerCase() === data.fullName.toLowerCase() &&
      (data.phone ? p.phone === data.phone : true),
  );
  if (exists) return exists;

  const registerNumber = generateRegisterNumber();
  const newPatient = {
    id: nextId(patients),
    fullName: data.fullName,
    phone: data.phone ?? undefined,
    gender: (data.gender ?? "male") as Patient["gender"],
    dateOfBirth: data.dateOfBirth ?? undefined,
    patientType: (data.patientType ?? "outdoor") as Patient["patientType"],
    allergies: data.allergies ?? [],
    chronicConditions: data.chronicConditions ?? [],
    createdAt: BigInt(Date.now()) * 1000000n,
    registerNumber,
  } as Patient;
  saveToStorage(key, [...patients, newPatient]);
  return newPatient;
}

// ─── Patients ────────────────────────────────────────────────────────────────

export function useGetAllPatients() {
  return useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: async () => {
      // When online: fetch from canister (single source of truth for all devices),
      // update localStorage as offline cache, then return merged list.
      if (canUseCanister()) {
        try {
          const remote = (await _canisterActor.getAllPatients()) as Patient[];
          if (Array.isArray(remote) && remote.length > 0) {
            const key = storageKey("patients");
            const local = loadFromStorage<Patient>(key);
            const merged = mergeArraysById(local, remote);
            saveToStorage(key, merged);
            return merged;
          }
        } catch {
          // Silently fall through to localStorage
        }
      }
      return loadFromStorage<Patient>(storageKey("patients"));
    },
    refetchInterval: 15_000,
  });
}

export function useGetPatient(id: bigint | null) {
  return useQuery<Patient | null>({
    queryKey: ["patient", id?.toString()],
    queryFn: async () => {
      if (!id) return null;
      // When online: fetch fresh from canister
      if (canUseCanister()) {
        try {
          const remote = (await _canisterActor.getPatient(
            id,
          )) as Patient | null;
          if (remote) {
            // Update localStorage cache
            const key = storageKey("patients");
            const local = loadFromStorage<Patient>(key);
            const updated = local.some((p) => p.id === id)
              ? local.map((p) => (p.id === id ? remote : p))
              : [...local, remote];
            saveToStorage(key, updated);
            return remote;
          }
        } catch {
          // Fall through to localStorage
        }
      }
      const primary = loadFromStorage<Patient>(storageKey("patients"));
      const found = primary.find((p) => p.id === id);
      if (found) return found;
      const all = loadFromAllDoctorKeys<Patient>("patients");
      return all.find((p) => p.id === id) ?? null;
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      fullName: string;
      nameBn: string | null;
      dateOfBirth: bigint | null;
      gender: string;
      phone: string | null;
      email: string | null;
      address: string | null;
      bloodGroup: string | null;
      weight: number | null;
      height: number | null;
      allergies: string[];
      chronicConditions: string[];
      pastSurgicalHistory: string | null;
      patientType: string;
      photo?: string | null;
    }) => {
      try {
        const key = storageKey("patients");
        const patients = loadFromStorage<Patient>(key);
        const registerNumber = generateRegisterNumber();
        const now = BigInt(Date.now()) * 1_000_000n;
        const newPatient: Patient = {
          id: nextId(patients),
          fullName: data.fullName,
          nameBn: data.nameBn ?? undefined,
          dateOfBirth: data.dateOfBirth ?? undefined,
          gender: data.gender as Patient["gender"],
          phone: data.phone ?? undefined,
          email: data.email ?? undefined,
          address: data.address ?? undefined,
          bloodGroup: data.bloodGroup ?? undefined,
          weight: data.weight ?? undefined,
          height: data.height ?? undefined,
          allergies: data.allergies,
          chronicConditions: data.chronicConditions,
          pastSurgicalHistory: data.pastSurgicalHistory ?? undefined,
          patientType: data.patientType as Patient["patientType"],
          createdAt: now,
          updatedAt: now,
          registerNumber,
        } as Patient;
        if (data.photo !== undefined) {
          (newPatient as Record<string, unknown>).photo = data.photo;
        }
        // 1. Always write to localStorage first (offline-first) — toast can fire after this
        saveToStorage(key, [...patients, newPatient]);

        const patientId = String(newPatient.id);

        // 2. Push to canister if online (using upsertPatient — idempotent)
        if (canUseCanister()) {
          try {
            await _canisterActor.upsertPatient(newPatient);
            // Remove any stale pending queue items for this patient
            const { removeFromQueue } = await import("../lib/hybridStorage");
            removeFromQueue("upsertPatient", new Set([patientId]));
          } catch (e) {
            console.warn(
              "Canister upsertPatient failed, queuing for retry:",
              e,
            );
            const { enqueueSync } = await import("../lib/hybridStorage");
            enqueueSync({
              timestamp: Date.now(),
              type: "upsertPatient",
              entityId: patientId,
              data: newPatient,
            });
          }
        } else {
          const { enqueueSync } = await import("../lib/hybridStorage");
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertPatient",
            entityId: patientId,
            data: newPatient,
          });
        }

        return newPatient;
      } catch (err) {
        console.error("useCreatePatient error:", err);
        throw new Error("Failed to save patient. Please try again.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      fullName: string;
      nameBn: string | null;
      dateOfBirth: bigint | null;
      gender: string;
      phone: string | null;
      email: string | null;
      address: string | null;
      bloodGroup: string | null;
      weight: number | null;
      height: number | null;
      allergies: string[];
      chronicConditions: string[];
      pastSurgicalHistory: string | null;
      patientType: string;
      photo?: string | null;
    }) => {
      try {
        const key = storageKey("patients");
        const patients = loadFromStorage<Patient>(key);
        const now = BigInt(Date.now()) * 1_000_000n;
        const updatedPatient = {
          ...patients.find((p) => p.id === data.id),
          fullName: data.fullName,
          nameBn: data.nameBn ?? undefined,
          dateOfBirth: data.dateOfBirth ?? undefined,
          gender: data.gender as Patient["gender"],
          phone: data.phone ?? undefined,
          email: data.email ?? undefined,
          address: data.address ?? undefined,
          bloodGroup: data.bloodGroup ?? undefined,
          weight: data.weight ?? undefined,
          height: data.height ?? undefined,
          allergies: data.allergies,
          chronicConditions: data.chronicConditions,
          pastSurgicalHistory: data.pastSurgicalHistory ?? undefined,
          patientType: data.patientType as Patient["patientType"],
          updatedAt: now,
          ...(data.photo !== undefined ? { photo: data.photo } : {}),
        } as Patient;
        const updated = patients.map((p) =>
          p.id === data.id ? updatedPatient : p,
        );
        // 1. Always write to localStorage first (offline-first)
        saveToStorage(key, updated);

        const patientId = String(data.id);

        // 2. Push to canister if online (using upsertPatient — idempotent)
        if (canUseCanister()) {
          try {
            await _canisterActor.upsertPatient(updatedPatient);
            // Remove any stale pending queue items for this patient
            const { removeFromQueue } = await import("../lib/hybridStorage");
            removeFromQueue("upsertPatient", new Set([patientId]));
          } catch (e) {
            console.warn(
              "Canister upsertPatient failed, queuing for retry:",
              e,
            );
            const { enqueueSync } = await import("../lib/hybridStorage");
            enqueueSync({
              timestamp: Date.now(),
              type: "upsertPatient",
              entityId: patientId,
              data: updatedPatient,
            });
          }
        } else {
          const { enqueueSync } = await import("../lib/hybridStorage");
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertPatient",
            entityId: patientId,
            data: updatedPatient,
          });
        }

        return updatedPatient;
      } catch (err) {
        console.error("useUpdatePatient error:", err);
        throw new Error("Failed to update patient. Please try again.");
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", vars.id.toString()] });
    },
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      const key = storageKey("patients");
      const patients = loadFromStorage<Patient>(key);
      saveToStorage(
        key,
        patients.filter((p) => p.id !== id),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
}

// ─── Visits ──────────────────────────────────────────────────────────────────

export function useGetVisitsByPatient(patientId: bigint | null) {
  return useQuery<Visit[]>({
    queryKey: ["visits", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      // When online: fetch from canister
      if (canUseCanister()) {
        try {
          const remote = (await _canisterActor.getVisitsByPatientId(
            patientId,
          )) as Visit[];
          if (Array.isArray(remote)) {
            const key = storageKey("visits");
            const local = loadFromStorage<Visit>(key);
            const merged = mergeArraysById(local, remote);
            saveToStorage(key, merged);
            return merged.filter((v) => v.patientId === patientId);
          }
        } catch {
          // Fall through to localStorage
        }
      }
      const primary = loadFromStorage<Visit>(storageKey("visits"));
      const found = primary.filter((v) => v.patientId === patientId);
      if (found.length > 0) return found;
      const all = loadFromAllDoctorKeys<Visit>("visits");
      return all.filter((v) => v.patientId === patientId);
    },
    enabled: !!patientId,
    refetchInterval: 15_000,
  });
}

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      visitDate: bigint;
      chiefComplaint: string;
      historyOfPresentIllness: string | null;
      vitalSigns: VitalSigns;
      physicalExamination: string | null;
      diagnosis: string | null;
      notes: string | null;
      visitType: string;
    }) => {
      const key = storageKey("visits");
      const visits = loadFromStorage<Visit>(key);
      const now = BigInt(Date.now()) * 1_000_000n;
      const newVisit: Visit = {
        id: nextId(visits),
        patientId: data.patientId,
        visitDate: data.visitDate,
        chiefComplaint: data.chiefComplaint,
        historyOfPresentIllness: data.historyOfPresentIllness ?? undefined,
        vitalSigns: data.vitalSigns,
        physicalExamination: data.physicalExamination ?? undefined,
        diagnosis: data.diagnosis ?? undefined,
        notes: data.notes ?? undefined,
        visitType: data.visitType as Visit["visitType"],
        createdAt: now,
        updatedAt: now,
      };
      // 1. Always write to localStorage first (offline-first)
      saveToStorage(key, [...visits, newVisit]);

      const visitId = String(newVisit.id);

      // 2. Push to canister if online (using upsertVisit — idempotent)
      if (canUseCanister()) {
        try {
          await _canisterActor.upsertVisit(newVisit);
          const { removeFromQueue } = await import("../lib/hybridStorage");
          removeFromQueue("upsertVisit", new Set([visitId]));
        } catch (e) {
          console.warn("Canister upsertVisit failed, queuing for retry:", e);
          const { enqueueSync } = await import("../lib/hybridStorage");
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertVisit",
            entityId: visitId,
            data: newVisit,
          });
        }
      } else {
        const { enqueueSync } = await import("../lib/hybridStorage");
        enqueueSync({
          timestamp: Date.now(),
          type: "upsertVisit",
          entityId: visitId,
          data: newVisit,
        });
      }

      return newVisit;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["visits", vars.patientId.toString()] }),
  });
}

export function useDeleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patientId: _patientId,
    }: { id: bigint; patientId: bigint }) => {
      const key = storageKey("visits");
      const visits = loadFromStorage<Visit>(key);
      saveToStorage(
        key,
        visits.filter((v) => v.id !== id),
      );
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["visits", vars.patientId.toString()] }),
  });
}

export function useUpdateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      patientId: bigint;
      visitDate: bigint;
      chiefComplaint: string;
      historyOfPresentIllness: string | null;
      vitalSigns: VitalSigns;
      physicalExamination: string | null;
      diagnosis: string | null;
      notes: string | null;
      visitType: string;
    }) => {
      const key = storageKey("visits");
      const visits = loadFromStorage<Visit>(key);
      const now = BigInt(Date.now()) * 1_000_000n;
      const updatedVisit = {
        ...visits.find((v) => v.id === data.id),
        patientId: data.patientId,
        visitDate: data.visitDate,
        chiefComplaint: data.chiefComplaint,
        historyOfPresentIllness: data.historyOfPresentIllness ?? undefined,
        vitalSigns: data.vitalSigns,
        physicalExamination: data.physicalExamination ?? undefined,
        diagnosis: data.diagnosis ?? undefined,
        notes: data.notes ?? undefined,
        visitType: data.visitType as Visit["visitType"],
        updatedAt: now,
      } as Visit;
      const updated = visits.map((v) => (v.id === data.id ? updatedVisit : v));
      // 1. Always write to localStorage first (offline-first)
      saveToStorage(key, updated);

      const visitId = String(data.id);

      // 2. Push to canister if online (using upsertVisit — idempotent)
      if (canUseCanister()) {
        try {
          await _canisterActor.upsertVisit(updatedVisit);
          const { removeFromQueue } = await import("../lib/hybridStorage");
          removeFromQueue("upsertVisit", new Set([visitId]));
        } catch (e) {
          console.warn("Canister upsertVisit failed, queuing for retry:", e);
          const { enqueueSync } = await import("../lib/hybridStorage");
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertVisit",
            entityId: visitId,
            data: updatedVisit,
          });
        }
      } else {
        const { enqueueSync } = await import("../lib/hybridStorage");
        enqueueSync({
          timestamp: Date.now(),
          type: "upsertVisit",
          entityId: visitId,
          data: updatedVisit,
        });
      }

      return updatedVisit;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["visits", vars.patientId.toString()] }),
  });
}

// ─── Prescriptions ───────────────────────────────────────────────────────────

export function useGetPrescriptionsByPatient(patientId: bigint | null) {
  return useQuery<Prescription[]>({
    queryKey: ["prescriptions", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      // When online: fetch from canister
      if (canUseCanister()) {
        try {
          const remote = (await _canisterActor.getPrescriptionsByPatientId(
            patientId,
          )) as Prescription[];
          if (Array.isArray(remote)) {
            const key = storageKey("prescriptions");
            const local = loadFromStorage<Prescription>(key);
            const merged = mergeArraysById(local, remote);
            saveToStorage(key, merged);
            return merged.filter((p) => p.patientId === patientId);
          }
        } catch {
          // Fall through to localStorage
        }
      }
      const primary = loadFromStorage<Prescription>(
        storageKey("prescriptions"),
      );
      const found = primary.filter((p) => p.patientId === patientId);
      if (found.length > 0) return found;
      const all = loadFromAllDoctorKeys<Prescription>("prescriptions");
      return all.filter((p) => p.patientId === patientId);
    },
    enabled: !!patientId,
    refetchInterval: 15_000,
  });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      visitId: bigint | null;
      prescriptionDate: bigint;
      diagnosis: string | null;
      medications: Medication[];
      notes: string | null;
    }) => {
      const key = storageKey("prescriptions");
      const prescriptions = loadFromStorage<Prescription>(key);
      const now = BigInt(Date.now()) * 1_000_000n;
      const newPrescription: Prescription = {
        id: nextId(prescriptions),
        patientId: data.patientId,
        visitId: data.visitId ?? undefined,
        prescriptionDate: data.prescriptionDate,
        diagnosis: data.diagnosis ?? undefined,
        medications: data.medications,
        notes: data.notes ?? undefined,
        createdAt: now,
        updatedAt: now,
      };
      // 1. Always write to localStorage first (offline-first)
      saveToStorage(key, [...prescriptions, newPrescription]);

      const prescriptionId = String(newPrescription.id);

      // 2. Push to canister if online (using upsertPrescription — idempotent)
      if (canUseCanister()) {
        try {
          await _canisterActor.upsertPrescription(newPrescription);
          const { removeFromQueue } = await import("../lib/hybridStorage");
          removeFromQueue("upsertPrescription", new Set([prescriptionId]));
        } catch (e) {
          console.warn(
            "Canister upsertPrescription failed, queuing for retry:",
            e,
          );
          const { enqueueSync } = await import("../lib/hybridStorage");
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertPrescription",
            entityId: prescriptionId,
            data: newPrescription,
          });
        }
      } else {
        const { enqueueSync } = await import("../lib/hybridStorage");
        enqueueSync({
          timestamp: Date.now(),
          type: "upsertPrescription",
          entityId: prescriptionId,
          data: newPrescription,
        });
      }

      return newPrescription;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({
        queryKey: ["prescriptions", vars.patientId.toString()],
      }),
  });
}

export function useDeletePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patientId: _patientId,
    }: {
      id: bigint;
      patientId: bigint;
    }) => {
      const key = storageKey("prescriptions");
      const prescriptions = loadFromStorage<Prescription>(key);
      saveToStorage(
        key,
        prescriptions.filter((p) => p.id !== id),
      );
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({
        queryKey: ["prescriptions", vars.patientId.toString()],
      }),
  });
}

export function useUpdatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      patientId: bigint;
      visitId: bigint | null;
      prescriptionDate: bigint;
      diagnosis: string | null;
      medications: Medication[];
      notes: string | null;
    }) => {
      const key = storageKey("prescriptions");
      const prescriptions = loadFromStorage<Prescription>(key);
      const now = BigInt(Date.now()) * 1_000_000n;
      const updatedPrescription = {
        ...prescriptions.find((p) => p.id === data.id),
        visitId: data.visitId ?? undefined,
        prescriptionDate: data.prescriptionDate,
        diagnosis: data.diagnosis ?? undefined,
        medications: data.medications,
        notes: data.notes ?? undefined,
        updatedAt: now,
      } as Prescription;
      const updated = prescriptions.map((p) =>
        p.id === data.id ? updatedPrescription : p,
      );
      // 1. Always write to localStorage first (offline-first)
      saveToStorage(key, updated);

      const prescriptionId = String(data.id);

      // 2. Push to canister if online (using upsertPrescription — idempotent)
      if (canUseCanister()) {
        try {
          await _canisterActor.upsertPrescription(updatedPrescription);
          const { removeFromQueue } = await import("../lib/hybridStorage");
          removeFromQueue("upsertPrescription", new Set([prescriptionId]));
        } catch (e) {
          console.warn(
            "Canister upsertPrescription failed, queuing for retry:",
            e,
          );
          const { enqueueSync } = await import("../lib/hybridStorage");
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertPrescription",
            entityId: prescriptionId,
            data: updatedPrescription,
          });
        }
      } else {
        const { enqueueSync } = await import("../lib/hybridStorage");
        enqueueSync({
          timestamp: Date.now(),
          type: "upsertPrescription",
          entityId: prescriptionId,
          data: updatedPrescription,
        });
      }

      return updatedPrescription;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({
        queryKey: ["prescriptions", vars.patientId.toString()],
      }),
  });
}

// ─── User profile ────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const email = getDoctorEmail();
      const raw = localStorage.getItem(`doctor_profile_${email}`);
      if (!raw) return { name: "" };
      try {
        return JSON.parse(raw) as UserProfile;
      } catch {
        return { name: "" };
      }
    },
  });
}

export function useGetCallerUserRole() {
  return useQuery<string>({
    queryKey: ["userRole"],
    queryFn: async () => {
      return "user";
    },
  });
}

export function useSaveCallerUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      const email = getDoctorEmail();
      localStorage.setItem(`doctor_profile_${email}`, JSON.stringify(profile));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userProfile"] }),
  });
}

// ─── Clinical Data Engine Hooks (localStorage-backed, canister-ready) ─────────
// These hooks store data in localStorage with unique keys per entity type.
// When the hybrid backend is connected, the same data will flow through the canister.

const CLINICAL_STORAGE_KEY = "medicare_clinical_data";

function getClinicalStore(): Record<string, unknown[]> {
  try {
    const raw = localStorage.getItem(CLINICAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown[]>;
  } catch {
    return {};
  }
}

function getClinicalEntities<T>(entityType: string): T[] {
  const store = getClinicalStore();
  return (store[entityType] ?? []) as T[];
}

function saveClinicalEntities<T extends { id: unknown; updatedAt?: unknown }>(
  entityType: string,
  items: T[],
): void {
  // Sync-aware write: writes locally AND enqueues/pushes to canister for all syncable entity types
  saveClinicalEntitiesWithSync(entityType, items, _canisterActor);
}

function nextClinicalId<T extends { id: unknown }>(items: T[]): bigint {
  if (items.length === 0) return 1n;
  return (
    items.reduce((max, item) => {
      const v = BigInt(String(item.id ?? 0));
      return v > max ? v : max;
    }, 0n) + 1n
  );
}

// ── Encounters ────────────────────────────────────────────────────────────────

export function useGetEncountersByPatient(patientId: bigint | null) {
  return useQuery<Encounter[]>({
    queryKey: ["encounters", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<Encounter>("encounters");
      return all.filter((e) => e.patientId === patientId);
    },
    enabled: !!patientId,
  });
}

// ── Observations ─────────────────────────────────────────────────────────────

export function useGetObservationsByPatient(patientId: bigint | null) {
  return useQuery<Observation[]>({
    queryKey: ["observations", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<Observation>("observations");
      return all.filter((o) => o.patientId === patientId && !o.isDeleted);
    },
    enabled: !!patientId,
  });
}

export function useGetObservationsByType(
  patientId: bigint | null,
  type: Observation["observationType"] | null,
) {
  return useQuery<Observation[]>({
    queryKey: ["observations", patientId?.toString(), type],
    queryFn: async () => {
      if (!patientId || !type) return [];
      const all = getClinicalEntities<Observation>("observations");
      return all.filter(
        (o) =>
          o.patientId === patientId &&
          o.observationType === type &&
          !o.isDeleted,
      );
    },
    enabled: !!patientId && !!type,
  });
}

export function useCreateObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<Observation, "id" | "versionInfo" | "status" | "isDeleted">,
    ) => {
      const all = getClinicalEntities<Observation>("observations");
      const newObs: Observation = {
        ...data,
        id: nextClinicalId(all),
        status: "Preliminary",
        isDeleted: false,
        versionInfo: {
          version: 1,
          createdAt: BigInt(Date.now()) * 1_000_000n,
          createdBy: { toString: () => "local" } as unknown as Principal,
          createdByName: data.recordedByName,
          createdByRole: data.recordedByRole,
        },
      };
      saveClinicalEntities("observations", [...all, newObs]);
      return newObs;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["observations", vars.patientId.toString()],
      });
    },
  });
}

// ── Clinical Orders ───────────────────────────────────────────────────────────

export function useGetOrdersByPatient(patientId: bigint | null) {
  return useQuery<ClinicalOrder[]>({
    queryKey: ["orders", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<ClinicalOrder>("orders");
      return all.filter((o) => o.patientId === patientId);
    },
    enabled: !!patientId,
  });
}

export function useGetActiveOrdersByPatient(patientId: bigint | null) {
  return useQuery<ClinicalOrder[]>({
    queryKey: ["orders", "active", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<ClinicalOrder>("orders");
      const activeStatuses: ClinicalOrder["status"][] = [
        "Requested",
        "Pending",
        "InProgress",
      ];
      return all.filter(
        (o) => o.patientId === patientId && activeStatuses.includes(o.status),
      );
    },
    enabled: !!patientId,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<ClinicalOrder, "id" | "versionInfo" | "status">,
    ) => {
      const all = getClinicalEntities<ClinicalOrder>("orders");
      const newOrder: ClinicalOrder = {
        ...data,
        id: nextClinicalId(all),
        status: "Requested",
        versionInfo: {
          version: 1,
          createdAt: BigInt(Date.now()) * 1_000_000n,
          createdBy: { toString: () => "local" } as unknown as Principal,
          createdByName: data.orderedByName,
          createdByRole: data.orderedByRole,
        },
      };
      saveClinicalEntities("orders", [...all, newOrder]);
      return newOrder;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", vars.patientId.toString()] });
      qc.invalidateQueries({
        queryKey: ["orders", "active", vars.patientId.toString()],
      });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      patientId: bigint;
      status: ClinicalOrder["status"];
      result?: string;
    }) => {
      const all = getClinicalEntities<ClinicalOrder>("orders");
      const updated = all.map((o) =>
        o.id === data.id
          ? {
              ...o,
              status: data.status,
              result: data.result ?? o.result,
              completedAt:
                data.status === "Completed"
                  ? BigInt(Date.now()) * 1_000_000n
                  : o.completedAt,
            }
          : o,
      );
      saveClinicalEntities("orders", updated);
      return updated.find((o) => o.id === data.id) as ClinicalOrder;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", vars.patientId.toString()] });
      qc.invalidateQueries({
        queryKey: ["orders", "active", vars.patientId.toString()],
      });
    },
  });
}

// ── Clinical Notes ────────────────────────────────────────────────────────────

export function useGetClinicalNotesByPatient(patientId: bigint | null) {
  return useQuery<ClinicalNote[]>({
    queryKey: ["clinicalNotes", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<ClinicalNote>("clinicalNotes");
      return all
        .filter((n) => n.patientId === patientId && !n.isDeleted)
        .sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    enabled: !!patientId,
  });
}

export function useCreateClinicalNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<
        ClinicalNote,
        "id" | "versionInfo" | "previousVersionIds" | "isDeleted"
      >,
    ) => {
      const all = getClinicalEntities<ClinicalNote>("clinicalNotes");
      const newNote: ClinicalNote = {
        ...data,
        id: nextClinicalId(all),
        isDeleted: false,
        previousVersionIds: [],
        versionInfo: {
          version: 1,
          createdAt: data.createdAt,
          createdBy: { toString: () => "local" } as unknown as Principal,
          createdByName: data.authorName,
          createdByRole: data.authorRole,
        },
      };
      saveClinicalEntities("clinicalNotes", [...all, newNote]);
      return newNote;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["clinicalNotes", vars.patientId.toString()],
      });
    },
  });
}

export function useUpdateClinicalNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      patientId: bigint;
      content: string;
      isDraft: boolean;
      changeReason?: string;
    }) => {
      const all = getClinicalEntities<ClinicalNote>("clinicalNotes");
      const original = all.find((n) => n.id === data.id);
      if (!original) throw new Error("Note not found");

      // Create versioned update — never overwrite, always append new version
      const updatedNote: ClinicalNote = {
        ...original,
        content: data.content,
        isDraft: data.isDraft,
        previousVersionIds: [...original.previousVersionIds, original.id],
        versionInfo: {
          ...original.versionInfo,
          version: original.versionInfo.version + 1,
          changeReason: data.changeReason,
          createdAt: BigInt(Date.now()) * 1_000_000n,
        },
      };
      saveClinicalEntities(
        "clinicalNotes",
        all.map((n) => (n.id === data.id ? updatedNote : n)),
      );
      return updatedNote;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["clinicalNotes", vars.patientId.toString()],
      });
    },
  });
}

// ── Clinical Alerts ───────────────────────────────────────────────────────────

export function useGetAlertsByPatient(patientId: bigint | null) {
  return useQuery<ClinicalAlert[]>({
    queryKey: ["alerts", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<ClinicalAlert>("alerts");
      return all
        .filter((a) => a.patientId === patientId && !a.isResolved)
        .sort((a, b) => Number(b.triggeredAt - a.triggeredAt));
    },
    enabled: !!patientId,
  });
}

export function useGetUnacknowledgedAlerts() {
  return useQuery<ClinicalAlert[]>({
    queryKey: ["alerts", "unacknowledged"],
    queryFn: async () => {
      const all = getClinicalEntities<ClinicalAlert>("alerts");
      return all.filter((a) => !a.isAcknowledged && !a.isResolved);
    },
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      const all = getClinicalEntities<ClinicalAlert>("alerts");
      const updated = all.map((a) =>
        a.id === id
          ? {
              ...a,
              isAcknowledged: true,
              acknowledgedAt: BigInt(Date.now()) * 1_000_000n,
            }
          : a,
      );
      saveClinicalEntities("alerts", updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

// ── Beds ──────────────────────────────────────────────────────────────────────

export function useGetAllBeds() {
  return useQuery<BedRecord[]>({
    queryKey: ["beds"],
    queryFn: async () => {
      const raw = getClinicalEntities<BedRecord>("beds");
      // Normalise id and BigInt timestamp fields that may have been stored as
      // plain numbers by JSON.parse (no BigInt reviver in getClinicalStore).
      return raw.map((b) => ({
        ...b,
        id: BigInt(String(b.id ?? 0)),
        patientId:
          b.patientId !== undefined ? BigInt(String(b.patientId)) : undefined,
        admissionDate:
          b.admissionDate !== undefined
            ? BigInt(String(b.admissionDate))
            : undefined,
        dischargeDate:
          b.dischargeDate !== undefined
            ? BigInt(String(b.dischargeDate))
            : undefined,
        transferHistory: (b.transferHistory ?? []).map((t) => ({
          ...t,
          date:
            t.date !== undefined
              ? BigInt(String(t.date))
              : (undefined as never),
        })),
      }));
    },
    refetchInterval: 15_000,
  });
}

export function useCreateBedRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      bedNumber: string;
      ward: string;
      hospitalName?: string;
      floor?: string;
      bedType?: string;
    }) => {
      const all = getClinicalEntities<BedRecord>("beds");
      const newBed: BedRecord = {
        id: nextClinicalId(all),
        bedNumber: data.bedNumber,
        ward: data.ward,
        hospitalName: data.hospitalName ?? "",
        floor: data.floor,
        bedType: (data.bedType as BedRecord["bedType"]) ?? "General",
        status: "Empty",
        transferHistory: [],
      };
      saveClinicalEntities("beds", [...all, newBed]);
      return newBed;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beds"] }),
  });
}

export function useAssignBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      bedId: bigint;
      patientId: bigint;
      patientName: string;
    }) => {
      const all = getClinicalEntities<BedRecord>("beds");
      // Normalise stored ids to BigInt before comparing to avoid mixed-type errors
      const updated = all.map((b) => {
        const bId = BigInt(String(b.id ?? 0));
        return bId === data.bedId
          ? {
              ...b,
              id: bId,
              status: "Occupied" as BedRecord["status"],
              patientId: data.patientId,
              patientName: data.patientName,
              admissionDate: BigInt(Date.now()) * 1_000_000n,
            }
          : { ...b, id: bId };
      });
      saveClinicalEntities("beds", updated);
      return updated.find((b) => b.id === data.bedId) as BedRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beds"] }),
  });
}

// ── Diagnosis Templates ───────────────────────────────────────────────────────

export function useGetDiagnosisTemplates() {
  return useQuery<DiagnosisTemplate[]>({
    queryKey: ["diagnosisTemplates"],
    queryFn: async () => {
      return getClinicalEntities<DiagnosisTemplate>(
        "diagnosisTemplates",
      ).filter((t) => t.isActive);
    },
  });
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

export function useGetAuditTrail(patientId: bigint | null) {
  return useQuery<AuditEntry[]>({
    queryKey: ["auditTrail", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      const all = getClinicalEntities<AuditEntry>("auditTrail");
      return all
        .filter((e) => e.entityId === patientId)
        .sort((a, b) => Number(b.changedAt - a.changedAt));
    },
    enabled: !!patientId,
  });
}

// ── Admission History ─────────────────────────────────────────────────────────

// ── Ward Round Note State (for sidebar badge count) ─────────────────────────

export function useGetUnfinalizedNoteCount(): number {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("note_state_") && key.endsWith(`_${today}`)) {
        const val = localStorage.getItem(key) ?? "none";
        if (val !== "finalized" && val !== "quick_review") count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

export function admissionHistoryKey(patientId: bigint | string): string {
  return `admissionHistory_${patientId}`;
}

export function loadAdmissionHistory(
  patientId: bigint | string,
): AdmissionHistory[] {
  try {
    const raw = localStorage.getItem(admissionHistoryKey(patientId));
    if (!raw) return [];
    return JSON.parse(raw) as AdmissionHistory[];
  } catch {
    return [];
  }
}

export function saveAdmissionHistory(
  patientId: bigint | string,
  records: AdmissionHistory[],
): void {
  try {
    localStorage.setItem(
      admissionHistoryKey(patientId),
      JSON.stringify(records),
    );
  } catch {}
}

export function useGetAdmissionHistory(patientId: bigint | null) {
  return useQuery<AdmissionHistory[]>({
    queryKey: ["admissionHistory", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      return loadAdmissionHistory(patientId);
    },
    enabled: !!patientId,
  });
}

export function useAdmitPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      hospitalName: string;
      ward: string;
      bed: string;
      admittedOn: string;
      admittedBy: string;
      admittedByRole: string;
      reasonForAdmission: string;
      carriedOverComplaints: string[];
      carriedOverDiagnosis: string[];
      carriedOverDrugHistory: string[];
      carriedOverPrescriptions: string[];
      isIntern: boolean;
      consultantAssignment?: {
        email: string;
        name: string;
        assignedAt: string;
        assignedBy: string;
      };
    }) => {
      // 1. Update patient record
      const key = storageKey("patients");
      const patients = loadFromStorage<Patient>(key);
      const updated = patients.map((p) =>
        p.id === data.patientId
          ? {
              ...p,
              status: "Admitted" as const,
              bedNumber: data.bed,
              ward: data.ward,
              hospitalName: data.hospitalName,
              admittedOn: data.admittedOn,
              isAdmitted: true,
              patientType: "admitted" as Patient["patientType"],
              ...(data.consultantAssignment
                ? { consultantAssignment: data.consultantAssignment }
                : {}),
            }
          : p,
      );
      saveToStorage(key, updated);

      // 2. Create admission history record
      const newRecord: AdmissionHistory = {
        id: `adm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        patientId: data.patientId.toString(),
        admittedOn: data.admittedOn,
        admittedBy: data.admittedBy,
        admittedByRole: data.admittedByRole,
        hospitalName: data.hospitalName,
        ward: data.ward,
        bed: data.bed,
        reasonForAdmission: data.reasonForAdmission,
        carriedOverComplaints: data.carriedOverComplaints,
        carriedOverDiagnosis: data.carriedOverDiagnosis,
        carriedOverDrugHistory: data.carriedOverDrugHistory,
        carriedOverPrescriptions: data.carriedOverPrescriptions,
        admissionHistoryStatus: data.isIntern
          ? "draft_awaiting_approval"
          : "complete",
        dailyProgressNotes: [],
        dischargedOn: null,
        status: "active",
        createdAt: new Date().toISOString(),
        ...(data.consultantAssignment
          ? { consultantAssignment: data.consultantAssignment }
          : {}),
      };
      const existing = loadAdmissionHistory(data.patientId);
      saveAdmissionHistory(data.patientId, [...existing, newRecord]);

      // 3. Log to audit trail
      const auditAll = getClinicalEntities<AuditEntry>("auditTrail");
      const newAuditEntry: AuditEntry = {
        id: nextClinicalId(auditAll),
        entityType: "Patient",
        entityId: data.patientId,
        fieldName: "status",
        beforeValue: "Active",
        afterValue: "Admitted",
        changedBy: { toString: () => "local" } as unknown as Principal,
        changedByName: data.admittedBy,
        changedByRole: data.admittedByRole as import("../types").StaffRole,
        changedAt: BigInt(Date.now()) * 1_000_000n,
        reason: `Admitted to ${data.hospitalName} — ${data.ward}, Bed ${data.bed}${data.consultantAssignment ? `. Assigned to Dr. ${data.consultantAssignment.name}` : ""}`,
      };
      saveClinicalEntities("auditTrail", [...auditAll, newAuditEntry]);

      return newRecord;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({
        queryKey: ["patient", vars.patientId.toString()],
      });
      qc.invalidateQueries({
        queryKey: ["admissionHistory", vars.patientId.toString()],
      });
    },
  });
}

export function useDischargePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      dischargedBy: string;
      dischargedByRole: string;
    }) => {
      // Update patient record
      const key = storageKey("patients");
      const patients = loadFromStorage<Patient>(key);
      const updated = patients.map((p) =>
        p.id === data.patientId
          ? {
              ...p,
              status: "Discharged" as const,
              isAdmitted: false,
              patientType: "outdoor" as Patient["patientType"],
              dischargeDate: new Date().toISOString(),
            }
          : p,
      );
      saveToStorage(key, updated);

      // Mark active admission as discharged
      const admissions = loadAdmissionHistory(data.patientId);
      const updatedAdmissions = admissions.map((a) =>
        a.status === "active"
          ? {
              ...a,
              status: "discharged" as const,
              dischargedOn: new Date().toISOString(),
            }
          : a,
      );
      saveAdmissionHistory(data.patientId, updatedAdmissions);

      // Audit log
      const auditAll = getClinicalEntities<AuditEntry>("auditTrail");
      const entry: AuditEntry = {
        id: nextClinicalId(auditAll),
        entityType: "Patient",
        entityId: data.patientId,
        fieldName: "status",
        beforeValue: "Admitted",
        afterValue: "Discharged",
        changedBy: { toString: () => "local" } as unknown as Principal,
        changedByName: data.dischargedBy,
        changedByRole: data.dischargedByRole as import("../types").StaffRole,
        changedAt: BigInt(Date.now()) * 1_000_000n,
        reason: "Patient discharged",
      };
      saveClinicalEntities("auditTrail", [...auditAll, entry]);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({
        queryKey: ["patient", vars.patientId.toString()],
      });
      qc.invalidateQueries({
        queryKey: ["admissionHistory", vars.patientId.toString()],
      });
    },
  });
}

// ── Versioned Prescription Records ───────────────────────────────────────────

export function prescriptionRecordsKey(patientId: string | bigint): string {
  return `prescriptionRecords_${patientId}`;
}

export function loadPrescriptionRecords(
  patientId: string | bigint,
): PrescriptionRecord[] {
  try {
    const raw = localStorage.getItem(prescriptionRecordsKey(patientId));
    if (!raw) return [];
    return JSON.parse(raw) as PrescriptionRecord[];
  } catch {
    return [];
  }
}

export function savePrescriptionRecords(
  patientId: string | bigint,
  records: PrescriptionRecord[],
): void {
  try {
    localStorage.setItem(
      prescriptionRecordsKey(patientId),
      JSON.stringify(records),
    );
    // Enqueue finalized records for cloud sync so other devices see them
    const syncable = records.filter(
      (r) => r.status === "active" || r.status === "approved",
    );
    if (syncable.length > 0) {
      import("../lib/hybridStorage").then(({ enqueueSync }) => {
        for (const rec of syncable) {
          enqueueSync({
            timestamp: Date.now(),
            type: "upsertPrescription",
            entityId: rec.id,
            data: rec,
          });
        }
      });
    }
  } catch {}
}

export function useGetPrescriptionRecords(patientId: bigint | null) {
  return useQuery<PrescriptionRecord[]>({
    queryKey: ["prescriptionRecords", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      return loadPrescriptionRecords(patientId);
    },
    enabled: !!patientId,
  });
}

export function useCreatePrescriptionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      createdBy: string;
      createdByRole: StaffRole;
      headerType: PrescriptionHeaderType;
      status: PrescriptionStatus;
      diagnosis?: string;
      drugs: unknown[];
      adviceText?: string;
      clinicalSummary?: Record<string, string>;
      linkedPrescriptionId?: string;
    }) => {
      const existing = loadPrescriptionRecords(data.patientId);
      // Determine label
      const patientRecords = existing.filter(
        (r) => r.patientId === data.patientId.toString(),
      );
      let label: PrescriptionLabel = null;
      let labelTimestamp: string | undefined;
      if (
        data.headerType === "hospital" ||
        data.createdByRole === "intern_doctor"
      ) {
        if (patientRecords.length === 0) {
          label = "Order on Admission";
        } else {
          label = "Fresh Order";
          labelTimestamp = new Date().toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        }
      }
      const newRecord: PrescriptionRecord = {
        id: `rx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        patientId: data.patientId.toString(),
        version: patientRecords.length + 1,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy,
        createdByRole: data.createdByRole,
        label,
        labelTimestamp,
        headerType: data.headerType,
        status: data.status,
        diagnosis: data.diagnosis,
        drugs: data.drugs,
        adviceText: data.adviceText,
        clinicalSummary: data.clinicalSummary,
        linkedPrescriptionId: data.linkedPrescriptionId,
      };
      savePrescriptionRecords(data.patientId, [...existing, newRecord]);
      return newRecord;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["prescriptionRecords", vars.patientId.toString()],
      });
    },
  });
}

export function useApprovePrescriptionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      recordId: string;
      approvedBy: string;
      action: "approve" | "request_changes";
      comment?: string;
    }) => {
      const records = loadPrescriptionRecords(data.patientId);
      const updated = records.map((r) =>
        r.id === data.recordId
          ? {
              ...r,
              status: (data.action === "approve"
                ? "active"
                : "changes_requested") as PrescriptionStatus,
              approvalComment: data.comment,
              approvedBy: data.approvedBy,
              approvedAt: new Date().toISOString(),
            }
          : r,
      );
      savePrescriptionRecords(data.patientId, updated);
      return updated.find((r) => r.id === data.recordId) as PrescriptionRecord;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["prescriptionRecords", vars.patientId.toString()],
      });
    },
  });
}

// ── Drug Reminders ─────────────────────────────────────────────────────────────

export function drugRemindersKey(patientId: string | bigint): string {
  return `drugReminders_${patientId}`;
}

export function loadDrugReminders(patientId: string | bigint): DrugReminder[] {
  try {
    const raw = localStorage.getItem(drugRemindersKey(patientId));
    if (!raw) return [];
    return JSON.parse(raw) as DrugReminder[];
  } catch {
    return [];
  }
}

export function saveDrugReminders(
  patientId: string | bigint,
  reminders: DrugReminder[],
): void {
  try {
    localStorage.setItem(
      drugRemindersKey(patientId),
      JSON.stringify(reminders),
    );
  } catch {}
}

export function autoPopulateDrugReminders(
  patientId: bigint | string,
  medications: Medication[],
  prescriptionId?: string,
): void {
  const existing = loadDrugReminders(patientId);
  const updated = [...existing];
  for (const med of medications) {
    const drugName = med.name || med.drugName || "";
    if (!drugName) continue;
    const existingIdx = updated.findIndex(
      (r) => r.drugName.toLowerCase() === drugName.toLowerCase(),
    );
    if (existingIdx >= 0) {
      // Update the prescription link on the existing reminder
      updated[existingIdx] = {
        ...updated[existingIdx],
        prescriptionId: prescriptionId ?? updated[existingIdx].prescriptionId,
        dose: med.dose || updated[existingIdx].dose,
        frequency: med.frequency || updated[existingIdx].frequency,
        status: "active",
        lastModified: new Date().toISOString(),
      };
    } else {
      updated.push({
        id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        patientId: String(patientId),
        drugName,
        dose: med.dose,
        frequency: med.frequency,
        startDate: new Date().toISOString(),
        prescriptionId,
        status: "active",
        reminderTimes: [],
        lastModified: new Date().toISOString(),
      });
    }
  }
  saveDrugReminders(patientId, updated);
}

export function useGetDrugReminders(patientId: bigint | null) {
  return useQuery<DrugReminder[]>({
    queryKey: ["drugReminders", patientId?.toString()],
    queryFn: async () => {
      if (!patientId) return [];
      return loadDrugReminders(patientId);
    },
    enabled: !!patientId,
  });
}

export function useUpdateDrugReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      reminderId: string;
      reminderTimes: string[];
    }) => {
      const reminders = loadDrugReminders(data.patientId);
      const updated = reminders.map((r) =>
        r.id === data.reminderId
          ? {
              ...r,
              reminderTimes: data.reminderTimes,
              lastModified: new Date().toISOString(),
            }
          : r,
      );
      saveDrugReminders(data.patientId, updated);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["drugReminders", vars.patientId.toString()],
      });
    },
  });
}

// ── Prescription Header Images ────────────────────────────────────────────────

export function getPrescriptionHeaderImage(
  type: PrescriptionHeaderType,
  doctorEmail?: string,
): string | null {
  const email = doctorEmail ?? getDoctorEmail();
  const key = `prescriptionHeaders_${type}_${email}`;
  return localStorage.getItem(key);
}

export function setPrescriptionHeaderImage(
  type: PrescriptionHeaderType,
  imageDataUrl: string,
  doctorEmail?: string,
): void {
  const email = doctorEmail ?? getDoctorEmail();
  const key = `prescriptionHeaders_${type}_${email}`;
  localStorage.setItem(key, imageDataUrl);
}

// ── Appointment & Serial Queue Types ─────────────────────────────────────────

export interface Appointment {
  id: string;
  patientName: string;
  phone: string;
  date: string;
  time: string;
  reason: string;
  status: "scheduled" | "confirmed" | "cancelled";
  doctor?: string;
  chamber?: string;
  registerNumber?: string;
  appointmentType: "chamber" | "admitted";
  hospitalName?: string;
  bedWardNumber?: string;
  admissionReason?: string;
  referringDoctor?: string;
  serialNumber?: number;
  serialDate?: string;
  visitTime?: string;
  updatedAt?: string;
}

export interface SerialQueueEntry {
  id: string;
  serial: number;
  patientName: string;
  phone: string;
  arrivalTime: string;
  status: "waiting" | "in-progress" | "done";
  queueDate: string;
  updatedAt?: string;
}

// ── Appointment Queries ───────────────────────────────────────────────────────

export function useGetAppointmentsQuery() {
  return useQuery<Appointment[]>({
    queryKey: ["appointments"],
    queryFn: async () => {
      if (canUseCanister()) {
        try {
          const sinceMs =
            BigInt(Date.now() - 30 * 24 * 60 * 60 * 1000) * 1_000_000n;
          const remote = (await _canisterActor.getAppointmentsSince(
            sinceMs,
          )) as Appointment[];
          if (Array.isArray(remote) && remote.length > 0) {
            const local = (() => {
              try {
                return JSON.parse(
                  localStorage.getItem("clinic_appointments") || "[]",
                ) as Appointment[];
              } catch {
                return [] as Appointment[];
              }
            })();
            const merged = mergeArraysById(local, remote);
            localStorage.setItem("clinic_appointments", JSON.stringify(merged));
            return merged;
          }
        } catch {
          // Fall through to localStorage
        }
      }
      try {
        return JSON.parse(
          localStorage.getItem("clinic_appointments") || "[]",
        ) as Appointment[];
      } catch {
        return [];
      }
    },
    refetchInterval: 15_000,
  });
}

export function useGetQueueQuery(date?: string) {
  const queueDate = date ?? new Date().toISOString().slice(0, 10);
  return useQuery<SerialQueueEntry[]>({
    queryKey: ["serialQueue", queueDate],
    queryFn: async () => {
      if (canUseCanister()) {
        try {
          const sinceMs =
            BigInt(Date.now() - 2 * 24 * 60 * 60 * 1000) * 1_000_000n;
          const remote = (await _canisterActor.getQueueEntriesSince(
            sinceMs,
          )) as SerialQueueEntry[];
          if (Array.isArray(remote)) {
            const todayEntries = remote.filter(
              (e) => (e.queueDate ?? queueDate) === queueDate,
            );
            if (todayEntries.length > 0) {
              const localKey = `clinic_serials_${queueDate}`;
              const local = (() => {
                try {
                  return JSON.parse(
                    localStorage.getItem(localKey) || "[]",
                  ) as SerialQueueEntry[];
                } catch {
                  return [] as SerialQueueEntry[];
                }
              })();
              const merged = mergeArraysById(local, todayEntries);
              localStorage.setItem(localKey, JSON.stringify(merged));
              return merged;
            }
          }
        } catch {
          // Fall through to localStorage
        }
      }
      try {
        return JSON.parse(
          localStorage.getItem(`clinic_serials_${queueDate}`) || "[]",
        ) as SerialQueueEntry[];
      } catch {
        return [];
      }
    },
    refetchInterval: 15_000,
  });
}

// ── Consultant Reassignment ───────────────────────────────────────────────────

export function useReassignConsultant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: bigint;
      newConsultant: { email: string; name: string };
      assignedBy: string; // email of the person making the change
      assignedByName: string;
      assignedByRole: StaffRole;
    }) => {
      const assignment = {
        email: data.newConsultant.email,
        name: data.newConsultant.name,
        assignedAt: new Date().toISOString(),
        assignedBy: data.assignedBy,
      };

      // 1. Update patient record across all doctor storage keys
      let previousConsultantName: string | undefined;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("patients_")) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const patients = deserializeBigInt(JSON.parse(raw)) as Patient[];
            if (!Array.isArray(patients)) continue;
            const idx = patients.findIndex((p) => p.id === data.patientId);
            if (idx >= 0) {
              const prev = patients[idx].consultantAssignment;
              if (prev && !previousConsultantName)
                previousConsultantName = prev.name;
              patients[idx] = {
                ...patients[idx],
                consultantAssignment: assignment,
              };
              localStorage.setItem(
                key,
                JSON.stringify(serializeBigInt(patients)),
              );
            }
          } catch {}
        }
      }

      // 2. Update active admission history
      const admissions = loadAdmissionHistory(data.patientId);
      const updatedAdmissions = admissions.map((a) =>
        a.status === "active" ? { ...a, consultantAssignment: assignment } : a,
      );
      saveAdmissionHistory(data.patientId, updatedAdmissions);

      // 3. Write to audit trail
      const auditAll = getClinicalEntities<AuditEntry>("auditTrail");
      const entry: AuditEntry = {
        id: nextClinicalId(auditAll),
        entityType: "Patient",
        entityId: data.patientId,
        fieldName: "consultantAssignment",
        beforeValue: previousConsultantName ?? "None",
        afterValue: data.newConsultant.name,
        changedBy: { toString: () => "local" } as unknown as Principal,
        changedByName: data.assignedByName,
        changedByRole: data.assignedByRole,
        changedAt: BigInt(Date.now()) * 1_000_000n,
        reason: `Consultant reassigned from ${previousConsultantName ?? "None"} to ${data.newConsultant.name} by ${data.assignedByName}`,
      };
      saveClinicalEntities("auditTrail", [...auditAll, entry]);

      return assignment;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({
        queryKey: ["patient", vars.patientId.toString()],
      });
      qc.invalidateQueries({
        queryKey: ["admissionHistory", vars.patientId.toString()],
      });
      qc.invalidateQueries({
        queryKey: ["auditTrail", vars.patientId.toString()],
      });
    },
  });
}
