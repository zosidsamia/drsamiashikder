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
  const prevPendingRef = useRef(0);

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

    // Poll every 15s (not 3s — 3s is too aggressive and causes rate limiting)
    updateState();
    const iv = setInterval(updateState, 15_000);

    // Listen for online/offline events
    window.addEventListener("online", updateState);
    window.addEventListener("offline", updateState);

    // Listen for syncComplete custom event from flushSyncQueue
    const handleSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ flushed: number }>).detail;
      // Re-read the actual queue rather than blindly setting to 0,
      // in case some items failed and remain in the queue.
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
    window.addEventListener("syncComplete", handleSyncComplete);

    return () => {
      clearInterval(iv);
      window.removeEventListener("online", updateState);
      window.removeEventListener("offline", updateState);
      window.removeEventListener("syncComplete", handleSyncComplete);
    };
  }, []);

  // Show toast when items are queued (transition from 0 pending to > 0)
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
    );
  }

  return (
    <div
      className="flex items-center gap-1 text-xs text-emerald-600 font-medium"
      title="All changes synced"
      data-ocid="sync.success_state"
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Synced</span>
    </div>
  );
}
