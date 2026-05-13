// ─── Migration & Sync Hook ────────────────────────────────────────────────────
// Handles one-time transparent migration from localStorage → canister.
// Also drives the 15-second polling loop that keeps all devices in sync:
//   1. On first actor load: bootstrap full hydration from canister
//   2. Every 15s: flush pending writes → pull incremental updates
//   3. On tab focus / online: immediate sync cycle

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bootstrapFromCanister,
  doSyncCycle,
  flushSyncQueue,
  getPendingChangesCount,
  getSyncStatus,
  isMigrationDone,
  isNetworkOnline,
  markMigrationDone,
  recordSyncHeartbeat,
  runMigration,
} from "../lib/hybridStorage";
import type { MigrationProgress, SyncStatus } from "../lib/hybridStorage";

export type MigrationStatus = "idle" | "running" | "complete" | "failed";

export interface MigrationState {
  migrationStatus: MigrationStatus;
  migrationProgress: MigrationProgress;
  runManualMigration: () => void;
}

const DEFAULT_PROGRESS: MigrationProgress = {
  total: 0,
  migrated: 0,
  message: "",
};

// How many ms since last sync to consider it "stale" and run a full bootstrap
const BOOTSTRAP_STALE_MS = 5 * 60 * 1000; // 5 minutes

function getLastSyncAgeMs(): number {
  try {
    const raw = localStorage.getItem("medicare_last_sync_at");
    if (!raw) return Number.POSITIVE_INFINITY;
    return Date.now() - new Date(raw).getTime();
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMigration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any | null,
  /** Optional: pass queryClient.invalidateQueries so the sync loop triggers UI refresh */
  invalidateAll?: () => void,
): MigrationState {
  const [status, setStatus] = useState<MigrationStatus>("idle");
  const [progress, setProgress] = useState<MigrationProgress>(DEFAULT_PROGRESS);
  const hasRunMigrationRef = useRef(false);
  const hasBootstrappedRef = useRef(false);
  const bootstrapRetryCountRef = useRef(0);
  const MAX_BOOTSTRAP_RETRIES = 5;
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── One-time migration: localStorage → canister ──────────────────────────
  const doMigration = useCallback(async () => {
    if (!actor || hasRunMigrationRef.current) return;
    if (isMigrationDone()) {
      await recordSyncHeartbeat(actor);
      return;
    }

    if (!isNetworkOnline()) return;

    hasRunMigrationRef.current = true;
    setStatus("running");
    setProgress({ total: 0, migrated: 0, message: "Preparing sync…" });

    await new Promise((r) => setTimeout(r, 500));

    try {
      const result = await runMigration(actor, (p) => setProgress(p));
      if (result.migrated > 0) {
        setProgress({
          total: result.migrated,
          migrated: result.migrated,
          message: `${result.migrated} records synced to cloud`,
        });
      }
      setStatus("complete");
    } catch (err) {
      console.warn("[sync] Migration failed:", err);
      setStatus("failed");
      hasRunMigrationRef.current = false;
    }
  }, [actor]);

  // ── Bootstrap: full canister hydration on first actor load ───────────────
  const doBootstrap = useCallback(async () => {
    if (!actor || hasBootstrappedRef.current || !isNetworkOnline()) return;
    if (bootstrapRetryCountRef.current >= MAX_BOOTSTRAP_RETRIES) {
      console.error(
        `[sync] Bootstrap abandoned after ${MAX_BOOTSTRAP_RETRIES} attempts. Will retry on next online/focus event.`,
      );
      return;
    }
    hasBootstrappedRef.current = true;
    try {
      await bootstrapFromCanister(actor);
      bootstrapRetryCountRef.current = 0; // reset on success
      if (invalidateAll) invalidateAll();
    } catch (err) {
      bootstrapRetryCountRef.current += 1;
      const attempt = bootstrapRetryCountRef.current;
      console.error(
        `[sync] Bootstrap attempt ${attempt}/${MAX_BOOTSTRAP_RETRIES} failed:`,
        err,
      );
      hasBootstrappedRef.current = false; // allow retry
      if (attempt < MAX_BOOTSTRAP_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s, 16s, 30s cap
        const backoffMs = Math.min(1000 * 2 ** attempt, 30_000);
        setTimeout(() => void doBootstrap(), backoffMs);
      }
    }
  }, [actor, invalidateAll]);

  // ── Sync cycle wrapper — hardened against errors ─────────────────────────
  const safeSyncCycle = useCallback(
    async (reason?: string) => {
      if (!actor) return;
      if (reason) {
        console.debug(`[sync] cycle triggered: ${reason}`);
      }
      try {
        await doSyncCycle(actor, invalidateAll);
      } catch (err) {
        console.error(
          `[sync] safeSyncCycle error at ${new Date().toISOString()}:`,
          err,
        );
        // Reset interval on error to recover from broken state
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = setInterval(
            () => void safeSyncCycle("interval-reset"),
            15_000,
          );
        }
      }
    },
    [actor, invalidateAll],
  );

  // ── Auto-run migration then bootstrap on first actor availability ─────────
  useEffect(() => {
    if (!actor) return;
    void doMigration();
  }, [actor, doMigration]);

  // ── Bootstrap runs once after migration is settled ───────────────────────
  useEffect(() => {
    if (!actor) return;
    // Small delay to let migration check settle first
    const t = setTimeout(() => void doBootstrap(), 800);
    return () => clearTimeout(t);
  }, [actor, doBootstrap]);

  // ── Immediate flush on actor ready: drain any pre-existing queue immediately ─
  // This ensures items queued while offline are sent as soon as the actor is
  // ready, without waiting for the first sync cycle timer to fire.
  useEffect(() => {
    if (!actor) return;
    const pending = getPendingChangesCount();
    if (pending > 0) {
      console.info(
        `[sync] Actor ready — flushing ${pending} pending items immediately.`,
      );
      void flushSyncQueue(actor).then((result) => {
        if (result.success > 0 && invalidateAll) invalidateAll();
      });
    }
    // Run when actor or invalidateAll changes so the flush uses the latest invalidate callback.
  }, [actor, invalidateAll]);
  // ── Polling loop: runs every 15s ─────────────────────────────────────────
  useEffect(() => {
    if (!actor) return;

    // Run once after bootstrap (staggered so bootstrap has time to complete)
    const initialTimer = setTimeout(() => void safeSyncCycle("initial"), 3000);

    // Register interval
    syncIntervalRef.current = setInterval(
      () => void safeSyncCycle("interval"),
      15_000,
    );

    return () => {
      clearTimeout(initialTimer);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [actor, safeSyncCycle]);

  // ── On online event: bootstrap if stale, else sync cycle ────────────────
  useEffect(() => {
    if (!actor) return;
    const handleOnline = () => {
      // Retry migration if not done
      if (!isMigrationDone() && !hasRunMigrationRef.current) {
        void doMigration();
      }
      // On coming back online, clear the retry limit so bootstrap can attempt again
      if (bootstrapRetryCountRef.current >= MAX_BOOTSTRAP_RETRIES) {
        bootstrapRetryCountRef.current = 0;
      }
      // Bootstrap if last sync is stale (> 5 min)
      if (getLastSyncAgeMs() > BOOTSTRAP_STALE_MS) {
        hasBootstrappedRef.current = false;
        void doBootstrap();
      } else {
        void safeSyncCycle("online-event");
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [actor, doMigration, doBootstrap, safeSyncCycle]);

  // ── On tab focus / visibility: immediate sync cycle ──────────────────────
  useEffect(() => {
    const handleFocus = () => {
      if (actor) void safeSyncCycle("focus");
    };
    const handleVisibility = () => {
      if (!document.hidden && actor) void safeSyncCycle("visibility");
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [actor, safeSyncCycle]);

  const runManualMigration = useCallback(() => {
    if (status === "running") return;
    hasRunMigrationRef.current = false;
    void doMigration();
  }, [status, doMigration]);

  return {
    migrationStatus: status,
    migrationProgress: progress,
    runManualMigration,
  };
}

// ── Offline queue size hook ───────────────────────────────────────────────────

export function useSyncStatus(): SyncStatus {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    const update = () => setSyncStatus(getSyncStatus());
    const iv = setInterval(update, 15_000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(iv);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return syncStatus;
}

export { getPendingChangesCount, markMigrationDone, isMigrationDone };
