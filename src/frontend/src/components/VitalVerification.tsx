// VitalVerification — Vital status badge + Verify/Reject workflow
// Roles with canVerifyVitals see Verify and Reject buttons on pendingMOReview vitals.
// Nurse/Intern only see their own draft/pending badge.

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { useRolePermissions } from "../hooks/useRolePermissions";
import type { VitalVerificationStatus } from "../types";

export interface VerifiableVital {
  id: string;
  patientId: string;
  code: string;
  value: string;
  unit: string;
  recordedByName: string;
  recordedByRole: string;
  recordedAt: string; // ISO string
  verificationStatus: VitalVerificationStatus;
  rejectionReason?: string;
  verifiedByName?: string;
  verifiedAt?: string;
}

// ── Storage helpers ────────────────────────────────────────────────────────────

const VITALS_KEY = (patientId: string) => `vital_verifications_${patientId}`;

export function loadVerifiableVitals(patientId: string): VerifiableVital[] {
  try {
    const raw = localStorage.getItem(VITALS_KEY(patientId));
    return raw ? (JSON.parse(raw) as VerifiableVital[]) : [];
  } catch {
    return [];
  }
}

export function saveVerifiableVitals(
  patientId: string,
  vitals: VerifiableVital[],
) {
  try {
    localStorage.setItem(VITALS_KEY(patientId), JSON.stringify(vitals));
  } catch {}
}

export function createDraftVital(
  patientId: string,
  code: string,
  value: string,
  unit: string,
  recordedByName: string,
  recordedByRole: string,
): VerifiableVital {
  const vital: VerifiableVital = {
    id: `vital_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patientId,
    code,
    value,
    unit,
    recordedByName,
    recordedByRole,
    recordedAt: new Date().toISOString(),
    verificationStatus: "pendingMOReview",
  };
  const existing = loadVerifiableVitals(patientId);
  saveVerifiableVitals(patientId, [vital, ...existing]);
  return vital;
}

// ── Status Badge ───────────────────────────────────────────────────────────────

export function VitalStatusBadge({
  status,
  compact = false,
}: {
  status: VitalVerificationStatus;
  compact?: boolean;
}) {
  const config: Record<
    VitalVerificationStatus,
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    drafted: {
      label: "Drafted",
      cls: "bg-muted text-muted-foreground border-border",
      icon: <Clock className="w-3 h-3" />,
    },
    pendingMOReview: {
      label: "Pending Review",
      cls: "bg-yellow-100 text-yellow-700 border-yellow-300",
      icon: <Clock className="w-3 h-3" />,
    },
    verifiedByMO: {
      label: "Verified",
      cls: "bg-green-100 text-green-700 border-green-300",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    finalized: {
      label: "Finalized",
      cls: "bg-blue-100 text-blue-700 border-blue-300",
      icon: <Lock className="w-3 h-3" />,
    },
    rejected: {
      label: "Rejected",
      cls: "bg-red-100 text-red-700 border-red-300",
      icon: <X className="w-3 h-3" />,
    },
  };

  const c = config[status];
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${c.cls}`}
      >
        {c.icon}
        {c.label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Reject Vital Modal ─────────────────────────────────────────────────────────

function RejectVitalModal({
  vital,
  onConfirm,
  onClose,
}: {
  vital: VerifiableVital;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Reject Vital Entry
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
            <span className="font-semibold">{vital.code}</span>: {vital.value}{" "}
            {vital.unit} — recorded by{" "}
            <span className="font-medium">{vital.recordedByName}</span>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="reject-reason"
              className="text-sm font-semibold text-muted-foreground"
            >
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this vital entry is being rejected…"
              rows={3}
              data-ocid="vital_verification.reject_reason.textarea"
            />
            {reason.trim() === "" && (
              <p className="text-xs text-red-500">
                Reason is required before rejecting.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!reason.trim()}
              onClick={() => onConfirm(reason.trim())}
              data-ocid="vital_verification.confirm_reject.button"
            >
              Confirm Rejection
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              data-ocid="vital_verification.cancel_reject.button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Vital Verification List ────────────────────────────────────────────────────

export default function VitalVerification({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  onClose?: () => void;
}) {
  const { currentDoctor } = useEmailAuth();
  const permissions = useRolePermissions();
  const canVerify = permissions.canVerifyVitals;

  const [vitals, setVitals] = useState<VerifiableVital[]>(() =>
    loadVerifiableVitals(patientId),
  );
  const [rejectTarget, setRejectTarget] = useState<VerifiableVital | null>(
    null,
  );

  const _refresh = () => setVitals(loadVerifiableVitals(patientId));

  const verifyVital = (id: string) => {
    const updated = vitals.map((v) =>
      v.id === id
        ? {
            ...v,
            verificationStatus: "verifiedByMO" as VitalVerificationStatus,
            verifiedByName: currentDoctor?.name ?? "Unknown",
            verifiedAt: new Date().toISOString(),
          }
        : v,
    );
    saveVerifiableVitals(patientId, updated);
    setVitals(updated);
    toast.success("Vital verified");
  };

  const rejectVital = (id: string, reason: string) => {
    const updated = vitals.map((v) =>
      v.id === id
        ? {
            ...v,
            verificationStatus: "rejected" as VitalVerificationStatus,
            rejectionReason: reason,
            verifiedByName: currentDoctor?.name ?? "Unknown",
            verifiedAt: new Date().toISOString(),
          }
        : v,
    );
    saveVerifiableVitals(patientId, updated);
    setVitals(updated);
    setRejectTarget(null);
    toast.success("Vital rejected — reason recorded");
  };

  const pendingCount = vitals.filter(
    (v) => v.verificationStatus === "pendingMOReview",
  ).length;

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-ocid="vital_verification.panel"
    >
      <div className="bg-teal-50 border-b border-teal-200 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          <span className="font-semibold text-sm text-teal-900">
            Vital Verification — {patientName}
          </span>
          {pendingCount > 0 && (
            <span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            data-ocid="vital_verification.close_button"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {vitals.length === 0 ? (
        <div
          className="py-10 text-center text-muted-foreground text-sm"
          data-ocid="vital_verification.empty_state"
        >
          No vital entries recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {vitals.map((vital, idx) => (
            <div
              key={vital.id}
              className={`px-4 py-3 ${
                vital.verificationStatus === "rejected"
                  ? "bg-red-50/40"
                  : vital.verificationStatus === "verifiedByMO" ||
                      vital.verificationStatus === "finalized"
                    ? "bg-green-50/30"
                    : ""
              }`}
              data-ocid={`vital_verification.item.${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{vital.code}</span>
                    <span className="text-foreground font-mono text-sm">
                      {vital.value} {vital.unit}
                    </span>
                    <VitalStatusBadge
                      status={vital.verificationStatus}
                      compact
                    />
                    {(vital.verificationStatus === "verifiedByMO" ||
                      vital.verificationStatus === "finalized") && (
                      <Lock className="w-3 h-3 text-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    By {vital.recordedByName} ({vital.recordedByRole}) ·{" "}
                    {format(new Date(vital.recordedAt), "dd MMM HH:mm")}
                  </p>
                  {/* Rejection reason inline */}
                  {vital.verificationStatus === "rejected" &&
                    vital.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        ✗ Rejected: {vital.rejectionReason}
                      </p>
                    )}
                  {vital.verifiedByName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {vital.verificationStatus === "rejected"
                        ? "By"
                        : "Verified by"}{" "}
                      {vital.verifiedByName}{" "}
                      {vital.verifiedAt
                        ? `at ${format(new Date(vital.verifiedAt), "HH:mm")}`
                        : ""}
                    </p>
                  )}
                </div>

                {/* Verify / Reject buttons — only for roles that canVerifyVitals */}
                {canVerify &&
                  vital.verificationStatus === "pendingMOReview" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1"
                        onClick={() => verifyVital(vital.id)}
                        data-ocid={`vital_verification.verify.button.${idx + 1}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50 gap-1"
                        onClick={() => setRejectTarget(vital)}
                        data-ocid={`vital_verification.reject.button.${idx + 1}`}
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectVitalModal
          vital={rejectTarget}
          onConfirm={(reason) => rejectVital(rejectTarget.id, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}

/** Returns number of vitals pending review for a patient — used for ward round badge */
export function getPendingVitalsCount(patientId: string): number {
  try {
    const vitals = loadVerifiableVitals(patientId);
    return vitals.filter((v) => v.verificationStatus === "pendingMOReview")
      .length;
  } catch {
    return 0;
  }
}
