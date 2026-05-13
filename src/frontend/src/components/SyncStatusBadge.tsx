/**
 * SyncStatusBadge — shows real-time sync state in the app header.
 * - Green checkmark: all data synced
 * - Yellow spinner: sync in progress
 * - Red dot with count: pending writes queued (offline or failed)
 */
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPendingChangesCount, isNetworkOnline } from "../lib/hybridStorage";

type SyncState = "synced" | "syncing" | "pending";

export default function SyncStatusBadge() {
  const [state, setState] = useState<SyncState>("synced");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [displayAgo, setDisplayAgo] = useState("");
  const prevPendingRef = useRef(0);

  // Compute "X mins ago" label
  function computeAgo(ts: number | null): string {
    if (!ts) return "";
    const diffMs = Date.now() - ts;
    if (diffMs < 60_000) return "just now";
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} hr${hrs !== 1 ? "s" : ""} ago`;
  }

  useEffect(() => {
    // Restore last sync time from localStorage on mount
    const raw = localStorage.getItem("medicare_last_sync_at");
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) setLastSyncTime(d.getTime());
    }
  }, []);

  // Update "X ago" label every 30s
  // biome-ignore lint/correctness/useExhaustiveDependencies: computeAgo is stable
  useEffect(() => {
    setDisplayAgo(computeAgo(lastSyncTime));
    const iv = setInterval(
      () => setDisplayAgo(computeAgo(lastSyncTime)),
      30_000,
    );
    return () => clearInterval(iv);
  }, [lastSyncTime]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: computeAgo is stable
  useEffect(() => {
    function updateState() {
      const count = getPendingChangesCount();
      const online = isNetworkOnline();
      setPendingCount(count);
      if (!online || count > 0) {
        setState("pending");
      } else {
        setState("synced");
      }
    }

    updateState();
    const iv = setInterval(updateState, 15_000);

    window.addEventListener("online", updateState);
    window.addEventListener("offline", updateState);

    const handleSyncComplete = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          flushed: number;
          lastSyncTime?: number;
          pendingCount?: number;
        }>
      ).detail;
      const now = detail.lastSyncTime ?? Date.now();
      setLastSyncTime(now);
      setDisplayAgo(computeAgo(now));
      setFailedCount(0);
      const remaining = getPendingChangesCount();
      setPendingCount(remaining);
      if (remaining === 0) {
        setState("synced");
        prevPendingRef.current = 0;
      } else {
        setState("pending");
      }
      if (detail.flushed > 0) {
        toast.success("All changes synced", {
          id: "sync-complete",
          duration: 3000,
        });
      }
    };

    const handleSyncFailed = (e: Event) => {
      const detail = (
        e as CustomEvent<{ failedCount: number; pendingCount: number }>
      ).detail;
      setFailedCount(detail.failedCount);
      setPendingCount(detail.pendingCount);
      setState("pending");
    };

    window.addEventListener("syncComplete", handleSyncComplete);
    window.addEventListener("syncFailed", handleSyncFailed);

    return () => {
      clearInterval(iv);
      window.removeEventListener("online", updateState);
      window.removeEventListener("offline", updateState);
      window.removeEventListener("syncComplete", handleSyncComplete);
      window.removeEventListener("syncFailed", handleSyncFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show toast when items newly queued
  useEffect(() => {
    const prev = prevPendingRef.current;
    if (pendingCount > 0 && prev === 0) {
      toast.info("Saved locally \u2014 will sync when connection is restored", {
        id: "sync-queued",
        duration: 4000,
      });
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount]);

  if (state === "syncing") {
    return (
      <div
        className="flex items-center gap-1 text-xs text-yellow-600 font-medium"
        title="Syncing..."
        data-ocid="sync.loading_state"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Syncing</span>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div
          className="flex items-center gap-1 text-xs text-red-600 font-medium"
          title={`${pendingCount} change${pendingCount !== 1 ? "s" : ""} pending sync`}
          data-ocid="sync.error_state"
        >
          <WifiOff className="w-3.5 h-3.5" />
          {pendingCount > 0 && (
            <span className="bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </div>
        {failedCount > 0 && (
          <span className="text-[9px] text-amber-600 font-medium leading-none">
            {failedCount} failed — retrying
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div
        className="flex items-center gap-1 text-xs text-emerald-600 font-medium"
        title={
          lastSyncTime
            ? `Last synced: ${computeAgo(lastSyncTime)}`
            : "All changes synced"
        }
        data-ocid="sync.success_state"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Synced</span>
      </div>
      {displayAgo && (
        <span className="text-[9px] text-muted-foreground leading-none hidden sm:block">
          {displayAgo}
        </span>
      )}
    </div>
  );
}
