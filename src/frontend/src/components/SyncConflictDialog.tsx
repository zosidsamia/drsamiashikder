import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Monitor,
  Smartphone,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type SyncConflict,
  getConflicts,
  resolveConflict,
} from "../lib/hybridStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncConflictDialogProps {
  open: boolean;
  onClose: () => void;
  onAllResolved?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("en-BD", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function entityLabel(entityType: string): string {
  const map: Record<string, string> = {
    patient: "Patient record",
    visit: "Visit record",
    prescription: "Prescription",
    appointment: "Appointment",
    queueEntry: "Queue entry",
  };
  return map[entityType] ?? entityType;
}

// ─── Conflict Card ────────────────────────────────────────────────────────────

interface ConflictCardProps {
  conflict: SyncConflict;
  onResolve: (choice: "mine" | "theirs") => void;
}

function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  const localRecord = conflict.localVersion as Record<string, unknown>;
  const serverRecord = conflict.serverVersion as Record<string, unknown>;
  const patientName =
    (localRecord.fullName as string) ||
    (localRecord.patientName as string) ||
    (serverRecord.fullName as string) ||
    (serverRecord.patientName as string) ||
    null;

  const localUpdated = conflict.localUpdatedAt ?? 0;
  const serverUpdated = conflict.serverUpdatedAt ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25 }}
      className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 space-y-3"
      data-ocid="sync_conflict.card"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">
            {entityLabel(conflict.entityType)} conflict
          </p>
          {patientName && (
            <p className="text-xs text-muted-foreground truncate">
              Patient:{" "}
              <span className="font-medium text-foreground">{patientName}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Detected:{" "}
            <span className="font-medium">{formatTs(conflict.detectedAt)}</span>
          </p>
        </div>
      </div>

      {/* Version comparison */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-card border border-border rounded-lg p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Monitor className="w-3.5 h-3.5 text-blue-500" />
            My version
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {localUpdated ? formatTs(localUpdated) : "Unknown time"}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
            Server version
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {serverUpdated ? formatTs(serverUpdated) : "Unknown time"}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
          onClick={() => onResolve("mine")}
          data-ocid="sync_conflict.keep_mine_button"
        >
          <Monitor className="w-3.5 h-3.5" />
          Keep My Version
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5"
          onClick={() => onResolve("theirs")}
          data-ocid="sync_conflict.keep_server_button"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Keep Server Version
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export default function SyncConflictDialog({
  open,
  onClose,
  onAllResolved,
}: SyncConflictDialogProps) {
  function handleResolve(entityId: string, choice: "mine" | "theirs") {
    resolveConflict(entityId, choice);
    // If no more conflicts, auto-close
    if (getConflicts().length === 0) {
      onAllResolved?.();
      onClose();
    }
  }

  const remaining = getConflicts();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        data-ocid="sync_conflict.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Sync Conflicts ({remaining.length})
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            The same record was edited on multiple devices. Choose which version
            to keep for each conflict.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
          <AnimatePresence>
            {remaining.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
                data-ocid="sync_conflict.empty_state"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                <p className="font-semibold text-foreground">
                  All conflicts resolved!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your data is fully in sync.
                </p>
              </motion.div>
            ) : (
              remaining.map((conflict) => (
                <ConflictCard
                  key={conflict.entityId}
                  conflict={conflict}
                  onResolve={(choice) =>
                    handleResolve(conflict.entityId, choice)
                  }
                />
              ))
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="sync_conflict.close_button"
          >
            {remaining.length === 0 ? "Done" : "Resolve Later"}
          </Button>
          {remaining.length > 1 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-9"
              onClick={() => {
                // Keep server version for all remaining (safe default — server is authoritative)
                for (const c of getConflicts()) {
                  resolveConflict(c.entityId, "theirs");
                }
                onAllResolved?.();
                onClose();
              }}
              data-ocid="sync_conflict.resolve_all_button"
            >
              Keep All Server Versions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
