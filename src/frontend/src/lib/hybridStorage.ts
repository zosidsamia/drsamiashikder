// ─── Hybrid Storage Layer ─────────────────────────────────────────────────────
// Wraps localStorage (offline-first ground truth) + canister backend (cloud sync).
// Strategy:
//   READ  → localStorage (always fresh after sync cycle)
//   WRITE → localStorage immediately, then canister directly or enqueue
//   SYNC  → bootstrap on first load, then incremental pull every 15s

import {
  getDoctorEmail,
  loadFromStorage,
  saveToStorage,
  storageKey,
} from "../hooks/useQueries";

// ─── Queue item types ──────────────────────────────────────────────────────────

export type SyncQueueItemType =
  | "upsertPatient"
  | "upsertVisit"
  | "upsertPrescription"
  | "upsertAppointment"
  | "upsertQueueEntry"
  | "upsertObservation"
  | "upsertBed"
  | "upsertDailyProgressNote"
  | "upsertHandover"
  | "upsertMedicationAdministration"
  | "upsertFrontPageContent";

export interface SyncQueueItem {
  id: string;
  timestamp: number;
  /** New typed field — used for new writes; optional for backward compat */
  type?: SyncQueueItemType;
  /** Legacy compat — used by old enqueueSync callers */
  operation?: "create" | "update" | "delete";
  /** Legacy compat */
  entityType?: string;
  entityId?: string;
  data: unknown;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingChanges: number;
  lastSyncAt?: Date;
}

export interface SyncConflict {
  entityType: string;
  entityId: string;
  localVersion: unknown;
  serverVersion: unknown;
  localUpdatedAt?: number;
  serverUpdatedAt?: number;
  detectedAt: number;
}

export interface MigrationProgress {
  total: number;
  migrated: number;
  message: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SYNC_QUEUE_KEY = "medicare_sync_queue";
const LAST_SYNC_KEY = "medicare_last_sync_at";
/** Stores the last canister sync timestamp as a bigint string (nanoseconds) */
const LAST_SYNC_TS_KEY = "medicare_last_sync_ts";
const MIGRATION_DONE_KEY = "medicare_migration_v1_done";
const DEVICE_ID_KEY = "medicare_device_id";
const CONFLICTS_KEY = "medicare_sync_conflicts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function loadSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncQueueItem[];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function getLastSyncTs(): bigint {
  try {
    const raw = localStorage.getItem(LAST_SYNC_TS_KEY);
    if (!raw || raw === "0") return 0n;
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function setLastSyncTs(ts: bigint): void {
  try {
    localStorage.setItem(LAST_SYNC_TS_KEY, ts.toString());
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

export function isMigrationDone(): boolean {
  return localStorage.getItem(MIGRATION_DONE_KEY) === "true";
}

export function markMigrationDone(): void {
  localStorage.setItem(MIGRATION_DONE_KEY, "true");
}

// ─── Conflict detection ───────────────────────────────────────────────────────

export function getConflicts(): SyncConflict[] {
  try {
    const raw = localStorage.getItem(CONFLICTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncConflict[];
  } catch {
    return [];
  }
}

function saveConflicts(conflicts: SyncConflict[]): void {
  try {
    localStorage.setItem(CONFLICTS_KEY, JSON.stringify(conflicts));
  } catch {}
}

/** Record a detected conflict — deduplicates by entityId */
export function addConflict(conflict: SyncConflict): void {
  const existing = getConflicts();
  const deduped = existing.filter((c) => c.entityId !== conflict.entityId);
  deduped.push(conflict);
  saveConflicts(deduped);
}

export function getConflictsCount(): number {
  return getConflicts().length;
}

/**
 * Resolve a conflict for the given entityId.
 * 'mine' → keep local version (do nothing, local is already in localStorage).
 * 'theirs' → overwrite local version with server version.
 */
export function resolveConflict(
  entityId: string,
  choice: "mine" | "theirs",
): void {
  const conflicts = getConflicts();
  const conflict = conflicts.find((c) => c.entityId === entityId);
  if (!conflict) return;

  if (choice === "theirs") {
    // Overwrite the local record with the server version
    try {
      const entityType = conflict.entityType;
      const serverData = conflict.serverVersion as Record<string, unknown>;

      if (entityType === "patient") {
        const key = storageKey("patients");
        const local = loadFromStorage<{ id: unknown }>(key);
        const updated = local.map((item) =>
          String(item.id) === entityId ? (serverData as typeof item) : item,
        );
        if (!updated.find((item) => String(item.id) === entityId)) {
          updated.push(serverData as { id: unknown });
        }
        saveToStorage(key, updated);
      } else if (entityType === "visit") {
        const key = storageKey("visits");
        const local = loadFromStorage<{ id: unknown }>(key);
        const updated = local.map((item) =>
          String(item.id) === entityId ? (serverData as typeof item) : item,
        );
        saveToStorage(key, updated);
      } else if (entityType === "prescription") {
        const key = storageKey("prescriptions");
        const local = loadFromStorage<{ id: unknown }>(key);
        const updated = local.map((item) =>
          String(item.id) === entityId ? (serverData as typeof item) : item,
        );
        saveToStorage(key, updated);
      } else if (entityType === "appointment") {
        const local = loadFromStorage<{ id: unknown }>("clinic_appointments");
        const updated = local.map((item) =>
          String(item.id) === entityId ? (serverData as typeof item) : item,
        );
        saveToStorage("clinic_appointments", updated);
      }
    } catch (e) {
      console.warn("[conflict] resolveConflict 'theirs' failed:", e);
    }
  }
  // For 'mine', local is already correct — just remove the conflict

  const remaining = conflicts.filter((c) => c.entityId !== entityId);
  saveConflicts(remaining);
}

// ─── Network probe ────────────────────────────────────────────────────────────

let _isOnlineCache = navigator.onLine;
window.addEventListener("online", () => {
  _isOnlineCache = true;
});
window.addEventListener("offline", () => {
  _isOnlineCache = false;
});

export function isNetworkOnline(): boolean {
  return _isOnlineCache;
}

// ─── Sync queue operations ────────────────────────────────────────────────────

export function enqueueSync(
  item: Omit<SyncQueueItem, "id" | "retryCount">,
): void {
  const queue = loadSyncQueue();
  // Deduplicate: if same type+entityId already queued, replace it (keep latest)
  const entityId =
    item.entityId ?? (item.data as Record<string, unknown>)?.id?.toString();
  let replaced = false;
  const newQueue = queue.map((q) => {
    if (
      q.type === item.type &&
      entityId &&
      (q.entityId === entityId ||
        String((q.data as Record<string, unknown>)?.id) === entityId)
    ) {
      replaced = true;
      return {
        ...item,
        id: q.id, // keep original id
        retryCount: 0,
      };
    }
    return q;
  });
  if (!replaced) {
    newQueue.push({
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      retryCount: 0,
    });
  }
  saveSyncQueue(newQueue);
}

export function getPendingChangesCount(): number {
  return loadSyncQueue().length;
}

export function getLastSyncAt(): Date | undefined {
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function getSyncStatus(): SyncStatus {
  return {
    isOnline: isNetworkOnline(),
    pendingChanges: getPendingChangesCount(),
    lastSyncAt: getLastSyncAt(),
  };
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

/**
 * Merge two arrays by id. If both have a record with the same id,
 * the one with the higher `updatedAt` wins (last-writer-wins).
 * Falls back to preferring remote if no updatedAt is present.
 * When a conflict is detected (both sides have changes), it is recorded.
 */
function mergeByIdLastWriterWins<
  T extends { id: unknown; updatedAt?: unknown },
>(local: T[], remote: T[], entityType?: string): T[] {
  const resultMap = new Map<string, T>();

  // Seed with local
  for (const item of local) {
    resultMap.set(String(item.id), item);
  }

  // Merge remote — last-writer-wins on updatedAt, conflict detection
  for (const remoteItem of remote) {
    const key = String(remoteItem.id);
    const localItem = resultMap.get(key);
    if (!localItem) {
      resultMap.set(key, remoteItem);
    } else {
      // Compare updatedAt — higher wins
      const remoteTs = BigInt(String(remoteItem.updatedAt ?? 0));
      const localTs = BigInt(String(localItem.updatedAt ?? 0));
      if (remoteTs > localTs) {
        // Server is newer — but local also has changes: conflict if both are non-zero
        if (localTs > 0n && entityType) {
          addConflict({
            entityType,
            entityId: key,
            localVersion: localItem,
            serverVersion: remoteItem,
            localUpdatedAt:
              localTs > 0n ? Number(localTs / 1_000_000n) : undefined,
            serverUpdatedAt:
              remoteTs > 0n ? Number(remoteTs / 1_000_000n) : undefined,
            detectedAt: Date.now(),
          });
        }
        resultMap.set(key, remoteItem);
      }
      // else keep local (it's newer or equal)
    }
  }

  return Array.from(resultMap.values());
}

/** Remove queue items matching a set of entity ids for a given type */
function removeFromQueue(type: SyncQueueItemType, ids: Set<string>): void {
  const queue = loadSyncQueue();
  const remaining = queue.filter((q) => {
    if (q.type !== type) return true;
    const itemId =
      q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
    return !ids.has(itemId);
  });
  saveSyncQueue(remaining);
}

// ─── Clinical entity sync helpers ───────────────────────────────────────────

/** Key used for the merged clinical entity store (observations, beds, etc.) */
const CLINICAL_STORE_KEY = "medicare_clinical_data";

function loadClinicalEntityStore(): Record<string, unknown[]> {
  try {
    const raw = localStorage.getItem(CLINICAL_STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown[]>;
  } catch {
    return {};
  }
}

function saveClinicalEntityStore(store: Record<string, unknown[]>): void {
  try {
    localStorage.setItem(CLINICAL_STORE_KEY, JSON.stringify(store));
  } catch {}
}

/**
 * Read entities of a given type from the shared clinical store.
 * Exported so saveClinicalEntitiesWithSync can be imported from useQueries.ts.
 */
export function readClinicalEntities<T>(entityType: string): T[] {
  const store = loadClinicalEntityStore();
  return (store[entityType] ?? []) as T[];
}

/**
 * Write entities of a given type to the shared clinical store,
 * then enqueue them for cloud sync based on the entity type.
 * This replaces the local-only saveClinicalEntities() in useQueries.ts.
 */
export function saveClinicalEntitiesWithSync<
  T extends { id: unknown; updatedAt?: unknown },
>(
  entityType: string,
  items: T[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor?: any | null,
): void {
  // 1. Always write locally first (offline-first)
  const store = loadClinicalEntityStore();
  store[entityType] = items as unknown[];
  saveClinicalEntityStore(store);

  // 2. Map entity type to sync queue type
  const syncTypeMap: Record<string, SyncQueueItemType | null> = {
    observations: "upsertObservation",
    beds: "upsertBed",
    dailyProgressNotes: "upsertDailyProgressNote",
    handovers: "upsertHandover",
    medicationAdministrations: "upsertMedicationAdministration",
    // TODO: diagnosisTemplates, auditTrail, orders, encounters — computed / high-frequency, local-only for now
    diagnosisTemplates: null,
    auditTrail: null,
    orders: null,
    encounters: null,
    alerts: null,
    clinicalNotes: null,
  };

  const syncType = syncTypeMap[entityType];
  if (!syncType) return; // local-only entity type

  // 3. If online and actor available, attempt direct canister write
  if (actor && isNetworkOnline()) {
    const bulkMethodMap: Record<string, string> = {
      upsertObservation: "bulkUpsertObservations",
      upsertBed: "bulkUpsertBeds",
      upsertDailyProgressNote: "bulkUpsertDailyProgressNotes",
      upsertHandover: "bulkUpsertHandovers",
      upsertMedicationAdministration: "bulkUpsertMedicationAdministrations",
    };
    const method = bulkMethodMap[syncType];
    if (method && typeof actor[method] === "function") {
      // Fire async write but do not await (function is synchronous).
      // On success: record last sync time. On failure: enqueue for retry.
      void (async () => {
        try {
          await (actor[method](items) as Promise<unknown>);
          // On success: record the last sync time
          localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        } catch (err: unknown) {
          console.warn(`[sync] Direct ${method} failed, queuing:`, err);
          // Enqueue each item on failure
          for (const item of items) {
            enqueueSync({
              timestamp: Date.now(),
              type: syncType,
              entityId: String((item as Record<string, unknown>).id ?? ""),
              data: item,
            });
          }
        }
      })();
      return;
    }
  }

  // 4. Offline or no actor — enqueue everything
  for (const item of items) {
    enqueueSync({
      timestamp: Date.now(),
      type: syncType,
      entityId: String((item as Record<string, unknown>).id ?? ""),
      data: item,
    });
  }
}

/**
 * Save front page content to localStorage and sync to canister.
 * Called from useSiteConfig and useDoctorContent after every admin edit.
 */
export function saveFrontPageContentWithSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor?: any | null,
): void {
  // Collect all front-page localStorage keys into a single blob
  const allContent: Record<string, unknown> = {};
  const fpKeys = ["siteConfig", "doctorContentOverrides"];
  for (const k of fpKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) allContent[k] = JSON.parse(raw);
    } catch {}
  }

  const serialized = JSON.stringify(allContent);

  if (
    actor &&
    isNetworkOnline() &&
    typeof actor.saveFrontPageContent === "function"
  ) {
    // Await the call so the enqueue happens synchronously on failure
    void (async () => {
      try {
        await (actor.saveFrontPageContent(serialized) as Promise<unknown>);
        // On success: record the last sync time
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      } catch (err: unknown) {
        console.warn("[sync] saveFrontPageContent failed, queuing:", err);
        enqueueSync({
          timestamp: Date.now(),
          type: "upsertFrontPageContent",
          entityId: "frontPageContent",
          data: serialized,
        });
      }
    })();
  } else {
    enqueueSync({
      timestamp: Date.now(),
      type: "upsertFrontPageContent",
      entityId: "frontPageContent",
      data: serialized,
    });
  }
}

// ─── Bootstrap: full hydration from canister on first load ───────────────────

/**
 * Full bootstrap sync from canister.
 * Fetches appointments + queue entries via getFullSyncData,
 * and patients/visits/prescriptions via their respective getAllXxxSince(0).
 * Merges all into localStorage. Sets LAST_SYNC_TS_KEY.
 * Safe to call multiple times — idempotent.
 */
export async function bootstrapFromCanister(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
): Promise<{ success: boolean; recordsLoaded: number }> {
  if (!isNetworkOnline() || !actor) {
    return { success: false, recordsLoaded: 0 };
  }

  let recordsLoaded = 0;

  try {
    // Pull patients, visits, prescriptions in parallel (since ts=0 = all records)
    const [remotePatients, remoteVisits, remotePrescriptions, syncDataResult] =
      await Promise.all([
        actor.getAllPatients() as Promise<unknown[]>,
        actor.getAllVisits() as Promise<unknown[]>,
        actor.getAllPrescriptions() as Promise<unknown[]>,
        actor.getFullSyncData(getDoctorEmail()),
      ]);

    // ── Patients ────────────────────────────────────────────────────────────
    if (Array.isArray(remotePatients) && remotePatients.length > 0) {
      const key = storageKey("patients");
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(key);
      const merged = mergeByIdLastWriterWins(
        local,
        remotePatients as typeof local,
        "patient",
      );
      saveToStorage(key, merged);
      recordsLoaded += remotePatients.length;
    }

    // ── Visits ──────────────────────────────────────────────────────────────
    if (Array.isArray(remoteVisits) && remoteVisits.length > 0) {
      const key = storageKey("visits");
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(key);
      const merged = mergeByIdLastWriterWins(
        local,
        remoteVisits as typeof local,
        "visit",
      );
      saveToStorage(key, merged);
      recordsLoaded += remoteVisits.length;
    }

    // ── Prescriptions ────────────────────────────────────────────────────────
    if (Array.isArray(remotePrescriptions) && remotePrescriptions.length > 0) {
      const key = storageKey("prescriptions");
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(key);
      const merged = mergeByIdLastWriterWins(
        local,
        remotePrescriptions as typeof local,
        "prescription",
      );
      saveToStorage(key, merged);
      recordsLoaded += remotePrescriptions.length;
    }

    // ── Appointments + Queue (from getFullSyncData) ──────────────────────────
    if (syncDataResult?.__kind__ === "ok") {
      const syncData = syncDataResult.ok as {
        appointments: unknown[];
        queueEntries: unknown[];
        timestamp: bigint;
      };

      if (
        Array.isArray(syncData.appointments) &&
        syncData.appointments.length > 0
      ) {
        const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(
          "clinic_appointments",
        );
        const merged = mergeByIdLastWriterWins(
          local,
          syncData.appointments as typeof local,
          "appointment",
        );
        saveToStorage("clinic_appointments", merged);
        recordsLoaded += syncData.appointments.length;
      }

      if (
        Array.isArray(syncData.queueEntries) &&
        syncData.queueEntries.length > 0
      ) {
        _mergeQueueEntries(
          syncData.queueEntries as Array<Record<string, unknown>>,
        );
        recordsLoaded += syncData.queueEntries.length;
      }
    }

    // ── Clinical entities: observations, beds, daily notes, handovers, MAR ───
    const bootstrapClinical = async () => {
      const store = loadClinicalEntityStore();

      try {
        if (typeof actor.getAllBeds === "function") {
          const remoteBeds = (await actor.getAllBeds()) as unknown[];
          if (Array.isArray(remoteBeds) && remoteBeds.length > 0) {
            const local = (store.beds ?? []) as Array<{
              id: unknown;
              updatedAt?: unknown;
            }>;
            store.beds = mergeByIdLastWriterWins(
              local,
              remoteBeds as typeof local,
              "bed",
            );
            recordsLoaded += remoteBeds.length;
          }
        }
      } catch {
        /* non-fatal */
      }

      try {
        if (typeof actor.getAllObservationsSince === "function") {
          const remoteObs = (await actor.getAllObservationsSince(
            0n,
          )) as unknown[];
          if (Array.isArray(remoteObs) && remoteObs.length > 0) {
            const local = (store.observations ?? []) as Array<{
              id: unknown;
              updatedAt?: unknown;
            }>;
            store.observations = mergeByIdLastWriterWins(
              local,
              remoteObs as typeof local,
              "observation",
            );
            recordsLoaded += remoteObs.length;
          }
        }
      } catch {
        /* non-fatal */
      }

      try {
        if (typeof actor.getDailyProgressNotesSince === "function") {
          const remoteNotes = (await actor.getDailyProgressNotesSince(
            0n,
          )) as unknown[];
          if (Array.isArray(remoteNotes) && remoteNotes.length > 0) {
            const local = (store.dailyProgressNotes ?? []) as Array<{
              id: unknown;
              updatedAt?: unknown;
            }>;
            store.dailyProgressNotes = mergeByIdLastWriterWins(
              local,
              remoteNotes as typeof local,
              "dailyProgressNote",
            );
            recordsLoaded += remoteNotes.length;
          }
        }
      } catch {
        /* non-fatal */
      }

      try {
        if (typeof actor.getAllHandoversSince === "function") {
          const remoteHandovers = (await actor.getAllHandoversSince(
            0n,
          )) as unknown[];
          if (Array.isArray(remoteHandovers) && remoteHandovers.length > 0) {
            const local = (store.handovers ?? []) as Array<{
              id: unknown;
              updatedAt?: unknown;
            }>;
            store.handovers = mergeByIdLastWriterWins(
              local,
              remoteHandovers as typeof local,
              "handover",
            );
            recordsLoaded += remoteHandovers.length;
          }
        }
      } catch {
        /* non-fatal */
      }

      try {
        if (typeof actor.getAllMedicationAdministrationsSince === "function") {
          const remoteMAR = (await actor.getAllMedicationAdministrationsSince(
            0n,
          )) as unknown[];
          if (Array.isArray(remoteMAR) && remoteMAR.length > 0) {
            const local = (store.medicationAdministrations ?? []) as Array<{
              id: unknown;
              updatedAt?: unknown;
            }>;
            store.medicationAdministrations = mergeByIdLastWriterWins(
              local,
              remoteMAR as typeof local,
              "mar",
            );
            recordsLoaded += remoteMAR.length;
          }
        }
      } catch {
        /* non-fatal */
      }

      saveClinicalEntityStore(store);
    };
    await bootstrapClinical();

    // ── Front page content ───────────────────────────────────────────────────
    try {
      if (typeof actor.getFrontPageContent === "function") {
        const maybeContent = await actor.getFrontPageContent();
        // Canister returns ?Text → [] or [text] in Motoko opt
        const raw: string | null =
          Array.isArray(maybeContent) && maybeContent.length > 0
            ? (maybeContent[0] as string)
            : typeof maybeContent === "string"
              ? maybeContent
              : null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (parsed.siteConfig) {
              localStorage.setItem(
                "siteConfig",
                JSON.stringify(parsed.siteConfig),
              );
            }
            if (parsed.doctorContentOverrides) {
              localStorage.setItem(
                "doctorContentOverrides",
                JSON.stringify(parsed.doctorContentOverrides),
              );
            }
          } catch {
            /* malformed content — skip */
          }
        }
      }
    } catch {
      /* non-fatal */
    }

    // ── Update timestamp ─────────────────────────────────────────────────
    try {
      // Fix: check if the method exists before calling it (previously this
      // awaited the function reference itself, which always returned the fn).
      const ts =
        typeof actor.getServerTimestamp === "function"
          ? await (actor.getServerTimestamp() as Promise<bigint>)
          : await (actor.getLastSyncTimestamp() as Promise<bigint>);
      setLastSyncTs(ts);
    } catch {
      setLastSyncTs(BigInt(Date.now()) * 1_000_000n);
    }

    return { success: true, recordsLoaded };
  } catch (err) {
    console.error(
      `[sync] bootstrapFromCanister error at ${new Date().toISOString()}:`,
      err,
    );
    return { success: false, recordsLoaded };
  }
}

// ─── Incremental pull ─────────────────────────────────────────────────────────

/**
 * Pull only records updated since the last sync timestamp.
 * Much cheaper than a full bootstrap after the initial load.
 */
export async function pollAndUpdateFromCanister(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
): Promise<{ success: boolean; updated: number }> {
  if (!isNetworkOnline() || !actor) {
    return { success: false, updated: 0 };
  }

  const lastTs = getLastSyncTs();
  let updated = 0;

  try {
    const doctorEmail = getDoctorEmail();

    // Fire all incremental pulls in parallel
    const [
      remotePatients,
      remoteVisits,
      remotePrescriptions,
      remoteApptsResult,
      remoteQueueResult,
    ] = await Promise.all([
      (actor.getAllPatientsSince(lastTs) as Promise<unknown[]>).catch(
        () => null,
      ),
      (actor.getAllVisitsSince(lastTs) as Promise<unknown[]>).catch(() => null),
      (actor.getAllPrescriptionsSince(lastTs) as Promise<unknown[]>).catch(
        () => null,
      ),
      (
        actor.getAppointmentsSince(doctorEmail, lastTs) as Promise<unknown>
      ).catch(() => null),
      (
        actor.getQueueEntriesSince(doctorEmail, lastTs) as Promise<unknown>
      ).catch(() => null),
    ]);

    // ── Patients ────────────────────────────────────────────────────────────
    if (Array.isArray(remotePatients) && remotePatients.length > 0) {
      const key = storageKey("patients");
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(key);
      const before = local.length;
      const merged = mergeByIdLastWriterWins(
        local,
        remotePatients as typeof local,
        "patient",
      );
      saveToStorage(key, merged);
      updated += Math.abs(merged.length - before) + remotePatients.length;
    }

    // ── Visits ──────────────────────────────────────────────────────────────
    if (Array.isArray(remoteVisits) && remoteVisits.length > 0) {
      const key = storageKey("visits");
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(key);
      const merged = mergeByIdLastWriterWins(
        local,
        remoteVisits as typeof local,
        "visit",
      );
      saveToStorage(key, merged);
      updated += remoteVisits.length;
    }

    // ── Prescriptions ────────────────────────────────────────────────────────
    if (Array.isArray(remotePrescriptions) && remotePrescriptions.length > 0) {
      const key = storageKey("prescriptions");
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(key);
      const merged = mergeByIdLastWriterWins(
        local,
        remotePrescriptions as typeof local,
        "prescription",
      );
      saveToStorage(key, merged);
      updated += remotePrescriptions.length;
    }

    // ── Appointments ─────────────────────────────────────────────────────────
    const remoteAppts =
      remoteApptsResult !== null &&
      typeof remoteApptsResult === "object" &&
      "__kind__" in (remoteApptsResult as object)
        ? (remoteApptsResult as { __kind__: string; ok?: unknown[] }).ok
        : Array.isArray(remoteApptsResult)
          ? remoteApptsResult
          : null;

    if (Array.isArray(remoteAppts) && remoteAppts.length > 0) {
      const local = loadFromStorage<{ id: unknown; updatedAt?: unknown }>(
        "clinic_appointments",
      );
      const merged = mergeByIdLastWriterWins(
        local,
        remoteAppts as typeof local,
        "appointment",
      );
      saveToStorage("clinic_appointments", merged);
      updated += remoteAppts.length;
    }

    // ── Queue entries ─────────────────────────────────────────────────────────
    const remoteQueue =
      remoteQueueResult !== null &&
      typeof remoteQueueResult === "object" &&
      "__kind__" in (remoteQueueResult as object)
        ? (remoteQueueResult as { __kind__: string; ok?: unknown[] }).ok
        : Array.isArray(remoteQueueResult)
          ? remoteQueueResult
          : null;

    if (Array.isArray(remoteQueue) && remoteQueue.length > 0) {
      _mergeQueueEntries(remoteQueue as Array<Record<string, unknown>>);
      updated += remoteQueue.length;
    }

    // ── Clinical entities: incremental pull ─────────────────────────────────
    // Each fetch is independent — error count tracked, timestamp only advanced
    // if ALL fetches succeed (prevents re-pulling on next cycle if partial).
    let clinicalErrorCount = 0;
    const store = loadClinicalEntityStore();

    try {
      if (typeof actor.getAllObservationsSince === "function") {
        const remoteObs = (await actor.getAllObservationsSince(
          lastTs,
        )) as unknown[];
        if (Array.isArray(remoteObs) && remoteObs.length > 0) {
          const local = (store.observations ?? []) as Array<{
            id: unknown;
            updatedAt?: unknown;
          }>;
          store.observations = mergeByIdLastWriterWins(
            local,
            remoteObs as typeof local,
            "observation",
          );
          updated += remoteObs.length;
        }
      }
    } catch {
      clinicalErrorCount++;
    }

    try {
      if (typeof actor.getAllBedsSince === "function") {
        const remoteBeds = (await actor.getAllBedsSince(lastTs)) as unknown[];
        if (Array.isArray(remoteBeds) && remoteBeds.length > 0) {
          const local = (store.beds ?? []) as Array<{
            id: unknown;
            updatedAt?: unknown;
          }>;
          store.beds = mergeByIdLastWriterWins(
            local,
            remoteBeds as typeof local,
            "bed",
          );
          updated += remoteBeds.length;
        }
      }
    } catch {
      clinicalErrorCount++;
    }

    try {
      if (typeof actor.getDailyProgressNotesSince === "function") {
        const remoteNotes = (await actor.getDailyProgressNotesSince(
          lastTs,
        )) as unknown[];
        if (Array.isArray(remoteNotes) && remoteNotes.length > 0) {
          const local = (store.dailyProgressNotes ?? []) as Array<{
            id: unknown;
            updatedAt?: unknown;
          }>;
          store.dailyProgressNotes = mergeByIdLastWriterWins(
            local,
            remoteNotes as typeof local,
            "dailyProgressNote",
          );
          updated += remoteNotes.length;
        }
      }
    } catch {
      clinicalErrorCount++;
    }

    try {
      if (typeof actor.getAllHandoversSince === "function") {
        const remoteHandovers = (await actor.getAllHandoversSince(
          lastTs,
        )) as unknown[];
        if (Array.isArray(remoteHandovers) && remoteHandovers.length > 0) {
          const local = (store.handovers ?? []) as Array<{
            id: unknown;
            updatedAt?: unknown;
          }>;
          store.handovers = mergeByIdLastWriterWins(
            local,
            remoteHandovers as typeof local,
            "handover",
          );
          updated += remoteHandovers.length;
        }
      }
    } catch {
      clinicalErrorCount++;
    }

    try {
      if (typeof actor.getAllMedicationAdministrationsSince === "function") {
        const remoteMAR = (await actor.getAllMedicationAdministrationsSince(
          lastTs,
        )) as unknown[];
        if (Array.isArray(remoteMAR) && remoteMAR.length > 0) {
          const local = (store.medicationAdministrations ?? []) as Array<{
            id: unknown;
            updatedAt?: unknown;
          }>;
          store.medicationAdministrations = mergeByIdLastWriterWins(
            local,
            remoteMAR as typeof local,
            "mar",
          );
          updated += remoteMAR.length;
        }
      }
    } catch {
      clinicalErrorCount++;
    }

    if (Object.keys(store).length > 0) saveClinicalEntityStore(store);

    // ── Update timestamp only if all fetches succeeded ───────────────────────
    // clinicalErrorCount > 0 means we keep the old timestamp so the next poll retries
    // Count fetch errors from the main parallel block (null means .catch returned null)
    const existingBaseErrorCount =
      (remotePatients === null ? 1 : 0) +
      (remoteVisits === null ? 1 : 0) +
      (remotePrescriptions === null ? 1 : 0);

    if (clinicalErrorCount === 0 && existingBaseErrorCount === 0) {
      try {
        const ts = (
          typeof actor.getServerTimestamp === "function"
            ? await actor.getServerTimestamp()
            : await actor.getLastSyncTimestamp()
        ) as bigint;
        setLastSyncTs(ts);
      } catch {
        // Use current time as fallback so next poll doesn't re-pull everything
        setLastSyncTs(BigInt(Date.now()) * 1_000_000n);
      }
    }
    // else: keep old timestamp — next poll will retry from the same point

    return { success: true, updated };
  } catch (err) {
    console.error(
      `[sync] pollAndUpdateFromCanister error at ${new Date().toISOString()}:`,
      err,
    );
    // Do NOT update LAST_SYNC_TS_KEY on failure — next poll will retry from same ts
    return { success: false, updated: 0 };
  }
}

/** Merge queue entries into their per-date localStorage keys */
function _mergeQueueEntries(entries: Array<Record<string, unknown>>): void {
  const todayDate = new Date().toISOString().slice(0, 10);
  const byDate = new Map<string, Array<Record<string, unknown>>>();
  for (const entry of entries) {
    const d =
      (entry.queueDate as string) ?? (entry.date as string) ?? todayDate;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(entry);
  }
  for (const [date, dateEntries] of byDate) {
    const localKey = `clinic_serials_${date}`;
    const local = (() => {
      try {
        return JSON.parse(localStorage.getItem(localKey) || "[]") as Array<{
          id: unknown;
          updatedAt?: unknown;
        }>;
      } catch {
        return [];
      }
    })();
    const merged = mergeByIdLastWriterWins(
      local,
      dateEntries as Array<{ id: unknown; updatedAt?: unknown }>,
    );
    localStorage.setItem(localKey, JSON.stringify(merged));
  }
}

// ─── Flush sync queue ─────────────────────────────────────────────────────────

/** Mutex flag — prevents concurrent flush calls from stomping each other */
let _isSyncing = false;

/** Maximum retry attempts per queue item before it is marked as permanently failed */
const MAX_ITEM_RETRY = 5;

/**
 * Flush all pending local writes to the canister using bulk upsert calls.
 * Groups items by type, sends bulk calls, and removes successfully synced items.
 * Items that have failed MAX_ITEM_RETRY times are removed from the queue to
 * prevent infinite loops; they are logged as errors.
 * A mutex (_isSyncing) prevents concurrent flush runs.
 */
export async function flushSyncQueue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
): Promise<{ success: number; failed: number; pending: number }> {
  if (!isNetworkOnline() || !actor) {
    return { success: 0, failed: 0, pending: getPendingChangesCount() };
  }

  // Mutex: skip if a flush is already running
  if (_isSyncing) {
    console.debug("[sync] flushSyncQueue skipped — already running");
    return { success: 0, failed: 0, pending: getPendingChangesCount() };
  }
  _isSyncing = true;

  try {
    return await _doFlush(actor);
  } finally {
    _isSyncing = false;
  }
}

async function _doFlush(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
): Promise<{ success: number; failed: number; pending: number }> {
  // Re-read queue inside the mutex so we have the freshest snapshot
  let queue = loadSyncQueue();
  if (queue.length === 0) return { success: 0, failed: 0, pending: 0 };

  // Expire items that have exceeded the retry ceiling
  const expiredIds = new Set<string>();
  const activeQueue = queue.filter((q) => {
    if ((q.retryCount ?? 0) >= MAX_ITEM_RETRY) {
      console.error(
        `[sync] Dropping queue item after ${MAX_ITEM_RETRY} retries. type=${q.type ?? q.entityType} id=${q.id}`,
        q.data,
      );
      expiredIds.add(q.id);
      return false;
    }
    return true;
  });
  if (expiredIds.size > 0) {
    saveSyncQueue(activeQueue);
    queue = activeQueue;
  }
  if (queue.length === 0) return { success: 0, failed: 0, pending: 0 };

  const patients = queue.filter(
    (q) => q.type === "upsertPatient" || q.entityType === "patient",
  );
  const visits = queue.filter(
    (q) => q.type === "upsertVisit" || q.entityType === "visit",
  );
  const prescriptions = queue.filter(
    (q) => q.type === "upsertPrescription" || q.entityType === "prescription",
  );
  const appointments = queue.filter(
    (q) => q.type === "upsertAppointment" || q.entityType === "appointment",
  );
  const queueEntries = queue.filter(
    (q) => q.type === "upsertQueueEntry" || q.entityType === "queueEntry",
  );

  let totalSuccess = 0;
  let totalFailed = 0;
  const successfulIds = new Set<string>();

  // ── Bulk upsert patients ──────────────────────────────────────────────────
  if (patients.length > 0) {
    try {
      const payloads = patients.map((q) => q.data);
      await actor.bulkUpsertPatients(payloads);
      for (const q of patients) {
        const id =
          q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
        successfulIds.add(`upsertPatient:${id}`);
      }
      totalSuccess += patients.length;
    } catch (err) {
      console.warn("[sync] bulkUpsertPatients failed, will retry:", err);
      totalFailed += patients.length;
    }
  }

  // ── Bulk upsert visits ────────────────────────────────────────────────────
  if (visits.length > 0) {
    try {
      const payloads = visits.map((q) => q.data);
      await actor.bulkUpsertVisits(payloads);
      for (const q of visits) {
        const id =
          q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
        successfulIds.add(`upsertVisit:${id}`);
      }
      totalSuccess += visits.length;
    } catch (err) {
      console.warn("[sync] bulkUpsertVisits failed, will retry:", err);
      totalFailed += visits.length;
    }
  }

  // ── Bulk upsert prescriptions ─────────────────────────────────────────────
  if (prescriptions.length > 0) {
    try {
      const payloads = prescriptions.map((q) => q.data);
      await actor.bulkUpsertPrescriptions(payloads);
      for (const q of prescriptions) {
        const id =
          q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
        successfulIds.add(`upsertPrescription:${id}`);
      }
      totalSuccess += prescriptions.length;
    } catch (err) {
      console.warn("[sync] bulkUpsertPrescriptions failed, will retry:", err);
      totalFailed += prescriptions.length;
    }
  }

  // ── Bulk upsert appointments ──────────────────────────────────────────────
  if (appointments.length > 0) {
    try {
      const payloads = appointments.map((q) => q.data);
      const result = await actor.bulkUpsertAppointments(payloads);
      if (!result || result.__kind__ !== "err") {
        for (const q of appointments) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertAppointment:${id}`);
        }
        totalSuccess += appointments.length;
      } else {
        console.warn(
          "[sync] bulkUpsertAppointments canister error:",
          result.err,
        );
        totalFailed += appointments.length;
      }
    } catch (err) {
      console.warn("[sync] bulkUpsertAppointments failed, will retry:", err);
      totalFailed += appointments.length;
    }
  }

  // ── Bulk upsert queue entries ─────────────────────────────────────────────
  if (queueEntries.length > 0) {
    try {
      const payloads = queueEntries.map((q) => q.data);
      const result = await actor.bulkUpsertQueueEntries(payloads);
      if (!result || result.__kind__ !== "err") {
        for (const q of queueEntries) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertQueueEntry:${id}`);
        }
        totalSuccess += queueEntries.length;
      } else {
        console.warn(
          "[sync] bulkUpsertQueueEntries canister error:",
          result.err,
        );
        totalFailed += queueEntries.length;
      }
    } catch (err) {
      console.warn("[sync] bulkUpsertQueueEntries failed, will retry:", err);
      totalFailed += queueEntries.length;
    }
  }

  // ── Bulk upsert observations ──────────────────────────────────────────────
  // IMPORTANT: successfulIds.add() is ONLY called after the canister call returns
  // success. If the method doesn't exist on the actor, items stay in the queue.
  const observations = queue.filter((q) => q.type === "upsertObservation");
  if (observations.length > 0) {
    if (typeof actor.bulkUpsertObservations !== "function") {
      console.warn(
        "[sync] bulkUpsertObservations not found on actor, skipping (will retry)",
      );
      totalFailed += observations.length;
    } else {
      try {
        const payloads = observations.map((q) => q.data);
        await actor.bulkUpsertObservations(payloads);
        // Only mark success AFTER confirmed write
        for (const q of observations) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertObservation:${id}`);
        }
        totalSuccess += observations.length;
      } catch (err) {
        console.warn("[sync] bulkUpsertObservations failed, will retry:", err);
        totalFailed += observations.length;
      }
    }
  }

  // ── Bulk upsert beds ──────────────────────────────────────────────────────
  const beds = queue.filter((q) => q.type === "upsertBed");
  if (beds.length > 0) {
    if (typeof actor.bulkUpsertBeds !== "function") {
      console.warn(
        "[sync] bulkUpsertBeds not found on actor, skipping (will retry)",
      );
      totalFailed += beds.length;
    } else {
      try {
        const payloads = beds.map((q) => q.data);
        await actor.bulkUpsertBeds(payloads);
        for (const q of beds) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertBed:${id}`);
        }
        totalSuccess += beds.length;
      } catch (err) {
        console.warn("[sync] bulkUpsertBeds failed, will retry:", err);
        totalFailed += beds.length;
      }
    }
  }

  // ── Bulk upsert daily progress notes ─────────────────────────────────────
  const dailyNotes = queue.filter((q) => q.type === "upsertDailyProgressNote");
  if (dailyNotes.length > 0) {
    if (typeof actor.bulkUpsertDailyProgressNotes !== "function") {
      console.warn(
        "[sync] bulkUpsertDailyProgressNotes not found on actor, skipping (will retry)",
      );
      totalFailed += dailyNotes.length;
    } else {
      try {
        const payloads = dailyNotes.map((q) => q.data);
        await actor.bulkUpsertDailyProgressNotes(payloads);
        for (const q of dailyNotes) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertDailyProgressNote:${id}`);
        }
        totalSuccess += dailyNotes.length;
      } catch (err) {
        console.warn(
          "[sync] bulkUpsertDailyProgressNotes failed, will retry:",
          err,
        );
        totalFailed += dailyNotes.length;
      }
    }
  }

  // ── Bulk upsert handovers ─────────────────────────────────────────────────
  const handovers = queue.filter((q) => q.type === "upsertHandover");
  if (handovers.length > 0) {
    if (typeof actor.bulkUpsertHandovers !== "function") {
      console.warn(
        "[sync] bulkUpsertHandovers not found on actor, skipping (will retry)",
      );
      totalFailed += handovers.length;
    } else {
      try {
        const payloads = handovers.map((q) => q.data);
        await actor.bulkUpsertHandovers(payloads);
        for (const q of handovers) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertHandover:${id}`);
        }
        totalSuccess += handovers.length;
      } catch (err) {
        console.warn("[sync] bulkUpsertHandovers failed, will retry:", err);
        totalFailed += handovers.length;
      }
    }
  }

  // ── Bulk upsert medication administrations (MAR) ──────────────────────────
  const marRecords = queue.filter(
    (q) => q.type === "upsertMedicationAdministration",
  );
  if (marRecords.length > 0) {
    if (typeof actor.bulkUpsertMedicationAdministrations !== "function") {
      console.warn(
        "[sync] bulkUpsertMedicationAdministrations not found on actor, skipping (will retry)",
      );
      totalFailed += marRecords.length;
    } else {
      try {
        const payloads = marRecords.map((q) => q.data);
        await actor.bulkUpsertMedicationAdministrations(payloads);
        for (const q of marRecords) {
          const id =
            q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
          successfulIds.add(`upsertMedicationAdministration:${id}`);
        }
        totalSuccess += marRecords.length;
      } catch (err) {
        console.warn(
          "[sync] bulkUpsertMedicationAdministrations failed, will retry:",
          err,
        );
        totalFailed += marRecords.length;
      }
    }
  }

  // ── Front page content ────────────────────────────────────────────────────
  const fpItems = queue.filter((q) => q.type === "upsertFrontPageContent");
  if (fpItems.length > 0) {
    // Only send the latest item (they're deduplicated by entityId = "frontPageContent")
    const latest = fpItems[fpItems.length - 1];
    if (typeof actor.saveFrontPageContent !== "function") {
      console.warn(
        "[sync] saveFrontPageContent not found on actor, skipping (will retry)",
      );
      totalFailed += fpItems.length;
    } else {
      try {
        await actor.saveFrontPageContent(latest.data as string);
        // Only mark success AFTER confirmed write
        for (const q of fpItems) {
          successfulIds.add(
            `upsertFrontPageContent:${q.entityId ?? "frontPageContent"}`,
          );
        }
        totalSuccess += fpItems.length;
      } catch (err) {
        console.warn("[sync] saveFrontPageContent failed, will retry:", err);
        totalFailed += fpItems.length;
      }
    }
  }

  // Remove successfully synced items from the queue; bump retryCount on failures.
  const successSet = successfulIds;
  const remaining = queue.filter((q) => {
    const type =
      q.type ??
      (q.entityType === "patient"
        ? "upsertPatient"
        : q.entityType === "visit"
          ? "upsertVisit"
          : q.entityType === "prescription"
            ? "upsertPrescription"
            : q.entityType === "appointment"
              ? "upsertAppointment"
              : "upsertQueueEntry");
    const id =
      q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
    return !successSet.has(`${type}:${id}`);
  });
  // Increment retryCount for items that failed this cycle
  const updatedRemaining = remaining.map((q) => {
    const type =
      q.type ??
      (q.entityType === "patient"
        ? "upsertPatient"
        : q.entityType === "visit"
          ? "upsertVisit"
          : q.entityType === "prescription"
            ? "upsertPrescription"
            : q.entityType === "appointment"
              ? "upsertAppointment"
              : "upsertQueueEntry");
    const id =
      q.entityId ?? String((q.data as Record<string, unknown>)?.id ?? "");
    // If this item was in the active queue (not new) and was NOT successful, it failed
    const wasActive = queue.some((orig) => orig.id === q.id);
    const wasSuccessful = successSet.has(`${type}:${id}`);
    if (wasActive && !wasSuccessful && totalFailed > 0) {
      return { ...q, retryCount: (q.retryCount ?? 0) + 1 };
    }
    return q;
  });
  saveSyncQueue(updatedRemaining);
  const pending = loadSyncQueue().length;

  if (totalSuccess > 0) {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    // Notify SyncStatusBadge of successful flush
    window.dispatchEvent(
      new CustomEvent("syncComplete", {
        detail: {
          flushed: totalSuccess,
          lastSyncTime: Date.now(),
          pendingCount: pending,
        },
      }),
    );
  }

  if (totalFailed > 0) {
    // Notify SyncStatusBadge of failed items so it can show "N failed — retrying"
    window.dispatchEvent(
      new CustomEvent("syncFailed", {
        detail: { failedCount: totalFailed, pendingCount: pending },
      }),
    );
  }

  return { success: totalSuccess, failed: totalFailed, pending };
}

// ─── Full sync cycle ──────────────────────────────────────────────────────────

/**
 * One full sync cycle: flush writes → incremental pull.
 * Wrapped in try/catch so a single failure never breaks the polling loop.
 */
export async function doSyncCycle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
  invalidateAll?: () => void,
): Promise<void> {
  if (!isNetworkOnline() || !actor) return;

  try {
    // 1. Flush pending writes first
    const flushResult = await flushSyncQueue(actor);

    // 2. Pull remote updates
    const pullResult = await pollAndUpdateFromCanister(actor);

    // 3. If anything changed, invalidate React Query cache
    if (
      (flushResult.success > 0 ||
        pullResult.updated > 0 ||
        pullResult.success) &&
      invalidateAll
    ) {
      invalidateAll();
    }

    // 4. Record heartbeat (best-effort)
    try {
      const pending = BigInt(getPendingChangesCount());
      await actor.recordDeviceSync(getDeviceId(), pending);
    } catch {}
  } catch (err) {
    console.error(
      `[sync] doSyncCycle error at ${new Date().toISOString()}:`,
      err,
    );
    // Do NOT rethrow — caller's interval must continue
  }
}

// ─── Legacy: one-time migration helper ───────────────────────────────────────

/**
 * Run one-time migration from localStorage to the canister.
 * Kept for backward compat with existing migration flow.
 */
export async function runMigration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
  onProgress?: (p: MigrationProgress) => void,
): Promise<{ migrated: number; skipped: number }> {
  if (isMigrationDone()) {
    return { migrated: 0, skipped: 0 };
  }

  onProgress?.({ total: 1, migrated: 0, message: "Gathering local records…" });

  const patients: unknown[] = [];
  const visits: unknown[] = [];
  const prescriptions: unknown[] = [];
  const appointments: unknown[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    try {
      if (key.startsWith("patients_")) {
        patients.push(...loadFromStorage<unknown>(key));
      } else if (key.startsWith("visits_")) {
        visits.push(...loadFromStorage<unknown>(key));
      } else if (key.startsWith("prescriptions_")) {
        prescriptions.push(...loadFromStorage<unknown>(key));
      } else if (
        key.startsWith("appointments_") ||
        key === "medicare_appointments"
      ) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) appointments.push(...parsed);
        }
      }
    } catch {}
  }

  const totalItems = patients.length + visits.length + prescriptions.length;

  if (totalItems === 0) {
    markMigrationDone();
    return { migrated: 0, skipped: 0 };
  }

  onProgress?.({
    total: totalItems,
    migrated: 0,
    message: `Syncing ${totalItems} records to cloud…`,
  });

  try {
    const result = await actor.migrateFromLocalStorage(
      JSON.stringify(patients),
      JSON.stringify(visits),
      JSON.stringify(prescriptions),
      JSON.stringify(appointments),
    );

    if (result.__kind__ === "ok") {
      markMigrationDone();
      setLastSyncTs(BigInt(Date.now()) * 1_000_000n);
      onProgress?.({
        total: totalItems,
        migrated: totalItems,
        message: "Sync complete!",
      });
      return { migrated: totalItems, skipped: 0 };
    }

    console.warn("[sync] Migration backend error:", result.err);
    return { migrated: 0, skipped: totalItems };
  } catch (err) {
    console.warn("[sync] Migration network error:", err);
    return { migrated: 0, skipped: totalItems };
  }
}

// ─── Legacy: recordSyncHeartbeat ──────────────────────────────────────────────
// Kept for backward compat with useMigration imports.

export async function recordSyncHeartbeat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
): Promise<void> {
  if (!isNetworkOnline() || !actor) return;
  try {
    const pending = BigInt(getPendingChangesCount());
    await actor.recordDeviceSync(getDeviceId(), pending);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

// Re-export removeFromQueue for use in useQueries.ts write path
export { removeFromQueue };
