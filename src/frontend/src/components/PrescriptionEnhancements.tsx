/**
 * PrescriptionEnhancements — shared UI blocks for prescription tab enhancements.
 *
 * Exports:
 *   CurrentMedicationList  — collapsible card of active (non-expired) drugs
 *   PrescriptionDiffRow    — inline diff between consecutive prescriptions
 *   ViewedByPatientBadge   — "Viewed by patient" / "Not yet viewed" indicator
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Pill,
} from "lucide-react";
import { useState } from "react";
import type { MedicationWithMeta, Prescription } from "../types";
import {
  computePrescriptionDiff,
  getCurrentMedications,
} from "../utils/clinicalUtils";

// ─── Current Medication List ────────────────────────────────────────────────

interface CurrentMedicationListProps {
  prescriptions: Prescription[];
  loading?: boolean;
}

export function CurrentMedicationList({
  prescriptions,
  loading,
}: CurrentMedicationListProps) {
  const [expanded, setExpanded] = useState(true);

  const activeMeds: MedicationWithMeta[] = getCurrentMedications(prescriptions);

  if (loading) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 mb-3">
        <Skeleton className="h-5 w-40 mb-3" />
        {[1, 2].map((k) => (
          <Skeleton key={k} className="h-10 mb-2 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 mb-4 overflow-hidden"
      data-ocid="rx.current_medications.card"
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-100/50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
        data-ocid="rx.current_medications.toggle"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-200 flex items-center justify-center">
            <Pill className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <span className="text-sm font-semibold text-violet-800">
            Current Medications
          </span>
          <span className="px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 text-xs font-bold">
            {activeMeds.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-violet-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-violet-500" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4">
          {activeMeds.length === 0 ? (
            <p
              className="text-sm text-violet-500 italic py-2 text-center"
              data-ocid="rx.current_medications.empty_state"
            >
              No active medications recorded
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs"
                data-ocid="rx.current_medications.table"
              >
                <thead>
                  <tr className="border-b border-violet-200">
                    {[
                      "Drug Name",
                      "Dose",
                      "Frequency",
                      "Prescribed On",
                      "Prescribed By",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left py-1.5 px-2 font-semibold text-violet-600 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeMeds.map((med, i) => {
                    const rx = prescriptions.find((p) =>
                      p.medications?.some((m) => m.name === med.name),
                    );
                    const rxDate = rx?.prescriptionDate
                      ? format(
                          new Date(Number(rx.prescriptionDate) / 1_000_000),
                          "d MMM yyyy",
                        )
                      : "—";
                    const prescriber =
                      ((rx as Record<string, unknown>)?.createdBy as string) ||
                      "—";
                    return (
                      <tr
                        key={`${med.name}-${i}`}
                        className="border-b border-violet-100 hover:bg-violet-50/50"
                        data-ocid={`rx.current_medications.item.${i + 1}`}
                      >
                        <td className="py-1.5 px-2 font-medium text-gray-800">
                          <div className="flex items-center gap-1">
                            {med.drugForm && (
                              <span className="text-indigo-600 font-semibold">
                                {med.drugForm}
                              </span>
                            )}
                            {med.drugName || med.name}
                            {med.dispensedAs === "substituted" &&
                              med.substitutedBrand && (
                                <span className="text-amber-600 text-xs ml-1">
                                  (sub: {med.substitutedBrand})
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-gray-700">
                          {med.dose}
                        </td>
                        <td className="py-1.5 px-2 text-gray-600">
                          {med.frequencyBn || med.frequency}
                        </td>
                        <td className="py-1.5 px-2 text-gray-500">{rxDate}</td>
                        <td className="py-1.5 px-2 text-gray-500 truncate max-w-[120px]">
                          {prescriber}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Prescription Diff Row ────────────────────────────────────────────────────

interface PrescriptionDiffRowProps {
  /** newer prescription */
  curr: Prescription;
  /** older prescription (immediately previous) */
  prev: Prescription;
  index: number;
}

export function PrescriptionDiffRow({
  curr,
  prev,
  index,
}: PrescriptionDiffRowProps) {
  const [open, setOpen] = useState(false);
  const diff = computePrescriptionDiff(prev, curr);

  const hasChanges =
    diff.addedDrugs.length > 0 ||
    diff.removedDrugs.length > 0 ||
    diff.doseChanges.length > 0;

  if (!hasChanges) return null;

  const totalChanges =
    diff.addedDrugs.length + diff.removedDrugs.length + diff.doseChanges.length;

  const DISCONTINUATION_LABELS: Record<string, string> = {
    course_complete: "Course complete",
    side_effect: "Side effect",
    patient_refused: "Patient refused",
    alternative_started: "Alternative started",
    other: "Other",
  };

  return (
    <div className="my-1 mx-1" data-ocid={`rx.diff_row.item.${index + 1}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-xs"
        data-ocid={`rx.diff_row.toggle.${index + 1}`}
      >
        <span className="text-amber-700 font-semibold">
          ↕ What changed? ({totalChanges})
        </span>
        <div className="flex items-center gap-1 flex-wrap ml-1">
          {diff.addedDrugs.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
              +{diff.addedDrugs.length} added
            </span>
          )}
          {diff.removedDrugs.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">
              -{diff.removedDrugs.length} removed
            </span>
          )}
          {diff.doseChanges.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-medium">
              {diff.doseChanges.length} dose changed
            </span>
          )}
        </div>
        <span className="ml-auto text-amber-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 py-2 bg-amber-50/60 border-x border-b border-amber-200 rounded-b-lg space-y-2 text-xs">
          {diff.addedDrugs.length > 0 && (
            <div>
              <span className="font-semibold text-emerald-700 mb-1 block">
                Added:
              </span>
              <div className="flex flex-wrap gap-1">
                {diff.addedDrugs.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium"
                  >
                    <Check className="w-3 h-3" />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {diff.removedDrugs.length > 0 && (
            <div>
              <span className="font-semibold text-red-700 mb-1 block">
                Removed:
              </span>
              <div className="flex flex-wrap gap-1">
                {diff.removedDrugs.map(({ name, reason }) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-medium line-through"
                  >
                    {name}
                    {reason && (
                      <span className="no-underline not-italic ml-1 text-red-500">
                        ({DISCONTINUATION_LABELS[reason] ?? reason})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          {diff.doseChanges.length > 0 && (
            <div>
              <span className="font-semibold text-amber-700 mb-1 block">
                Dose changed:
              </span>
              <div className="flex flex-wrap gap-1">
                {diff.doseChanges.map(({ name, oldDose, newDose }) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-medium"
                  >
                    {name}:{" "}
                    <span className="line-through text-red-500">{oldDose}</span>
                    {" → "}
                    <span className="text-emerald-600">{newDose}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Viewed By Patient Badge ─────────────────────────────────────────────────

interface ViewedByPatientBadgeProps {
  viewedAt?: number; // Unix ms
}

export function ViewedByPatientBadge({ viewedAt }: ViewedByPatientBadgeProps) {
  if (viewedAt) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-1">
        <Eye className="w-3.5 h-3.5" />
        <span>
          Viewed by patient:{" "}
          <span className="font-semibold">
            {format(new Date(viewedAt), "d MMM yyyy, HH:mm")}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
      <EyeOff className="w-3.5 h-3.5" />
      <span>Not yet viewed by patient</span>
    </div>
  );
}

// ─── First Prescription Label ─────────────────────────────────────────────────

export function FirstPrescriptionLabel() {
  return (
    <div className="mx-1 my-1 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700 font-medium flex items-center gap-1">
      <Clock className="w-3 h-3" />
      First prescription
    </div>
  );
}

// ─── Discontinuation Reason Dialog ───────────────────────────────────────────
// Inline use: rendered inside UpgradedPrescriptionEMR when a drug is deleted.

export type DiscontinuationReason =
  | "course_complete"
  | "side_effect"
  | "patient_refused"
  | "alternative_started"
  | "other";

interface DiscontinuationDialogProps {
  drugName: string;
  open: boolean;
  onConfirm: (reason: DiscontinuationReason, note: string) => void;
  onCancel: () => void;
}

const DISC_OPTIONS: { value: DiscontinuationReason; label: string }[] = [
  { value: "course_complete", label: "Course complete" },
  { value: "side_effect", label: "Side effect" },
  { value: "patient_refused", label: "Patient refused" },
  { value: "alternative_started", label: "Alternative started" },
  { value: "other", label: "Other" },
];

export function DiscontinuationDialog({
  drugName,
  open,
  onConfirm,
  onCancel,
}: DiscontinuationDialogProps) {
  const [selected, setSelected] = useState<DiscontinuationReason | "">("");
  const [note, setNote] = useState("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      data-ocid="rx.discontinuation.dialog"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-red-200 w-full max-w-sm mx-4 p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-1">
          Why is this drug being stopped?
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          <strong>{drugName}</strong> — please select a reason for
          discontinuation
        </p>
        <div className="space-y-1.5 mb-3">
          {DISC_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                selected === opt.value
                  ? "bg-red-50 border-red-400 text-red-800"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="disc_reason"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="accent-red-500"
                data-ocid={`rx.discontinuation.radio.${opt.value}`}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        {selected === "other" && (
          <input
            className="w-full border rounded px-2 py-1.5 text-sm mb-3 border-red-200 focus:outline-none focus:ring-1 focus:ring-red-300"
            placeholder="Describe reason..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-ocid="rx.discontinuation.note_input"
          />
        )}
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelected("");
              setNote("");
              onCancel();
            }}
            data-ocid="rx.discontinuation.cancel_button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onConfirm("other", "");
              setSelected("");
              setNote("");
            }}
            data-ocid="rx.discontinuation.skip_button"
          >
            Skip
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              const reason = (selected || "other") as DiscontinuationReason;
              onConfirm(reason, note);
              setSelected("");
              setNote("");
            }}
            data-ocid="rx.discontinuation.confirm_button"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
