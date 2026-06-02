import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { ExternalBlob, createActor } from "./backend";
import type { Backend } from "./backend";
import { CANISTER_HOST, CANISTER_ID_BACKEND } from "./canisterConfig";

import { supabase } from "./lib/supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CanisterActor = Backend;

const CANISTER_SLOT_KEYS = [
  "patient-data",
  "clinical-data",
  "admission-data",
  "appointment-data",
  "queue-data",
  "alert-data",
  "auth-roles",
  "sync-device",
] as const;

export type CanisterSlot = (typeof CANISTER_SLOT_KEYS)[number];

export interface CanisterActorsContextType {
  patientActor: CanisterActor | null;
  clinicalActor: CanisterActor | null;
  admissionActor: CanisterActor | null;
  appointmentActor: CanisterActor | null;
  queueActor: CanisterActor | null;
  alertActor: CanisterActor | null;
  authActor: CanisterActor | null;
  syncActor: CanisterActor | null;

  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "partial" | "disconnected";
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const CanisterActorsContext =
  createContext<CanisterActorsContextType | null>(null);

// ---------------------------------------------------------------------------
// Helpers (ICP)
// ---------------------------------------------------------------------------

function resolveCanisterId(slot: CanisterSlot): string {
  const ids =
    typeof (window as any).__CANISTER_IDS__ === "object"
      ? (window as any).__CANISTER_IDS__
      : {};

  const fromWindow = ids?.[slot];
  if (fromWindow) return fromWindow;

  const fromGlobal = (globalThis as any)?.__CANISTER_IDS__?.[slot];
  if (fromGlobal) return fromGlobal;

  return CANISTER_ID_BACKEND || "";
}

const noopUpload = async (_file: ExternalBlob): Promise<Uint8Array> =>
  new Uint8Array();

const noopDownload = async (_bytes: Uint8Array): Promise<ExternalBlob> =>
  ExternalBlob.fromBytes(new Uint8Array());

function buildActor(id: string): CanisterActor | null {
  if (!id) return null;
  try {
    return createActor(id, noopUpload, noopDownload, {
      agentOptions: { host: CANISTER_HOST },
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CanisterActorsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CanisterActorsContextType>({
    patientActor: null,
    clinicalActor: null,
    admissionActor: null,
    appointmentActor: null,
    queueActor: null,
    alertActor: null,
    authActor: null,
    syncActor: null,

    isConnected: false,
    connectionStatus: "connecting",
    retryCount: 0,
  });

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 40;
  const RETRY_INTERVAL_MS = 5000;

  const initActors = useCallback(() => {
    const ids: Record<CanisterSlot, string> = {
      "patient-data": resolveCanisterId("patient-data"),
      "clinical-data": resolveCanisterId("clinical-data"),
      "admission-data": resolveCanisterId("admission-data"),
      "appointment-data": resolveCanisterId("appointment-data"),
      "queue-data": resolveCanisterId("queue-data"),
      "alert-data": resolveCanisterId("alert-data"),
      "auth-roles": resolveCanisterId("auth-roles"),
      "sync-device": resolveCanisterId("sync-device"),
    };

    const patientActor = buildActor(ids["patient-data"]);
    const clinicalActor = buildActor(ids["clinical-data"]);
    const admissionActor = buildActor(ids["admission-data"]);
    const appointmentActor = buildActor(ids["appointment-data"]);
    const queueActor = buildActor(ids["queue-data"]);
    const alertActor = buildActor(ids["alert-data"]);
    const authActor = buildActor(ids["auth-roles"]);
    const syncActor = buildActor(ids["sync-device"]);

    const allIds = Object.values(ids);
    const nonEmptyCount = allIds.filter((id) => id !== "").length;

    const isConnected = nonEmptyCount === CANISTER_SLOT_KEYS.length;

    let connectionStatus: CanisterActorsContextType["connectionStatus"] =
      "connecting";

    if (nonEmptyCount === 0) connectionStatus = "disconnected";
    else if (nonEmptyCount === CANISTER_SLOT_KEYS.length)
      connectionStatus = "connected";
    else connectionStatus = "partial";

    setState((prev) => ({
      ...prev,
      patientActor,
      clinicalActor,
      admissionActor,
      appointmentActor,
      queueActor,
      alertActor,
      authActor,
      syncActor,
      isConnected,
      connectionStatus,
    }));

    return isConnected;
  }, []);

  useEffect(() => {
    const connected = initActors();
    if (connected) return;

    const interval = setInterval(() => {
      retryCountRef.current += 1;

      setState((prev) => ({
        ...prev,
        retryCount: retryCountRef.current,
      }));

      const success = initActors();

      if (success || retryCountRef.current >= MAX_RETRIES) {
        clearInterval(interval);

        if (!success) {
          setState((prev) => ({
            ...prev,
            connectionStatus: "disconnected",
          }));
        }
      }
    }, RETRY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [initActors]);

  return (
    <CanisterActorsContext.Provider value={state}>
      {children}
    </CanisterActorsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook (FIXED)
// ---------------------------------------------------------------------------

export function useCanisterActors(): CanisterActorsContextType {
  const ctx = useContext(CanisterActorsContext);

  if (!ctx) {
    throw new Error(
      "useCanisterActors must be used within CanisterActorsProvider"
    );
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// 🟢 HYBRID API LAYER (ICP + SUPABASE)
// ---------------------------------------------------------------------------

export const HybridAPI = {
  // -------------------------
  // SUPABASE DATA (MAIN DB)
  // -------------------------

  async getPatients() {
    const { data, error } = await supabase.from("patients").select("*");
    if (error) throw error;
    return data;
  },

  async createPatient(data: any) {
    const { data: result, error } = await supabase
      .from("patients")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // -------------------------
  // ICP IDENTITY (OPTIONAL)
  // -------------------------

  async getCurrentUser() {
    try {
      const actor = (window as any)?.__ICP_ACTOR__;
      return await actor?.getCurrentUser?.();
    } catch {
      return null;
    }
  },
};