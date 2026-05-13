// Ward Round Page — Patient List with role-based SOAP escalation
// Intern (S+O draft) → MO (full SOAP, submit to Consultant) → Consultant (finalize)

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Principal } from "@icp-sdk/core/principal";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Filter,
  Loader2,
  Printer,
  Search,
  Shield,
  Stethoscope,
  ThumbsUp,
  UserCheck,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DailyProgressNote from "../components/DailyProgressNote";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  getDoctorEmail,
  loadFromAllDoctorKeys,
  loadFromStorage,
  saveToStorage,
  storageKey,
  useCreateClinicalNote,
  useCreateObservation,
  useCreateOrder,
  useGetAlertsByPatient,
} from "../hooks/useQueries";
import { useRolePermissions } from "../hooks/useRolePermissions";
import {
  type VitalAlertResult,
  checkVitalAlerts,
} from "../lib/clinicalIntelligence";
import { isConsultantType } from "../types";
import type { ClinicalAlert, Patient, StaffRole } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAge(dob?: bigint): number | null {
  if (!dob) return null;
  return Math.floor(
    (Date.now() - Number(dob / 1_000_000n)) / (365.25 * 24 * 3600 * 1000),
  );
}

function daysSince(ts?: bigint | string): number {
  if (!ts) return 0;
  const ms =
    typeof ts === "bigint"
      ? Number(ts / 1_000_000n)
      : new Date(ts as string).getTime();
  return Math.floor((Date.now() - ms) / (1000 * 3600 * 24));
}

function getCurrentShift(): "morning" | "evening" | "night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "morning";
  if (h >= 14 && h < 22) return "evening";
  return "night";
}

// ── Note State Types ──────────────────────────────────────────────────────────

export type NoteState =
  | "none"
  | "intern_draft"
  | "mo_reviewed"
  | "finalized"
  | "quick_review";

const NOTE_STATE_KEY = (patientId: string, date: string) =>
  `note_state_${patientId}_${date}`;

function loadNoteState(patientId: string, date: string): NoteState {
  try {
    return (
      (localStorage.getItem(NOTE_STATE_KEY(patientId, date)) as NoteState) ??
      "none"
    );
  } catch {
    return "none";
  }
}

export function saveNoteState(
  patientId: string,
  date: string,
  state: NoteState,
) {
  try {
    localStorage.setItem(NOTE_STATE_KEY(patientId, date), state);
  } catch {}
}

// ── Completion Badge ──────────────────────────────────────────────────────────

function CompletionBadge({ state }: { state: NoteState }) {
  const config = {
    none: {
      label: "No Note",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    intern_draft: {
      label: "Intern Draft",
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    mo_reviewed: {
      label: "MO Reviewed",
      cls: "bg-blue-100 text-blue-700 border-blue-200",
    },
    finalized: {
      label: "Finalized",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    quick_review: {
      label: "Quick Review ✓",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
  }[state];
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

// ── Vital Entry Form ──────────────────────────────────────────────────────────

export function VitalEntryForm({
  patientId,
  onSaved,
  onCancel,
}: { patientId: bigint; onSaved: () => void; onCancel: () => void }) {
  const { currentDoctor } = useEmailAuth();
  const createObs = useCreateObservation();
  const [bp, setBp] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [rr, setRr] = useState("");
  const [rbs, setRbs] = useState("");
  const bpRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    bpRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const now = BigInt(Date.now()) * 1_000_000n;
    const base = {
      patientId,
      observationType: "Vital" as const,
      observationDate: now,
      recordedBy: { toString: () => "local" } as unknown as Principal,
      recordedByName: currentDoctor?.name ?? "Unknown",
      recordedByRole: (currentDoctor?.role ?? "doctor") as StaffRole,
    };
    const entries = [
      { code: "BP", value: bp, unit: "mmHg" },
      { code: "Pulse", value: pulse, unit: "beats/min" },
      { code: "Temperature", value: temp, unit: "°C" },
      { code: "SpO2", value: spo2, unit: "%" },
      { code: "RR", value: rr, unit: "breaths/min" },
      { code: "RBS", value: rbs, unit: "mmol/L" },
    ].filter((e) => e.value.trim());
    for (const e of entries) {
      await createObs.mutateAsync({
        ...base,
        code: e.code,
        value: e.value,
        unit: e.unit,
        numericValue: Number.parseFloat(e.value) || undefined,
      });
    }
    toast.success("Vitals saved");
    onSaved();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: "BP (mmHg)",
            val: bp,
            set: setBp,
            ref: bpRef,
            placeholder: "120/80",
          },
          {
            label: "Pulse",
            val: pulse,
            set: setPulse,
            ref: null,
            placeholder: "72",
          },
          {
            label: "Temp (°C)",
            val: temp,
            set: setTemp,
            ref: null,
            placeholder: "37.0",
          },
          {
            label: "SpO₂ (%)",
            val: spo2,
            set: setSpo2,
            ref: null,
            placeholder: "98",
          },
          { label: "RR", val: rr, set: setRr, ref: null, placeholder: "16" },
          {
            label: "RBS (mmol/L)",
            val: rbs,
            set: setRbs,
            ref: null,
            placeholder: "5.5",
          },
        ].map(({ label, val, set, ref, placeholder }) => (
          <div key={label} className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <Input
              ref={ref as React.RefObject<HTMLInputElement>}
              inputMode="decimal"
              placeholder={placeholder}
              value={val}
              onChange={(e) => set(e.target.value)}
              className="h-9 text-sm font-mono"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={createObs.isPending}
          className="flex-1"
          data-ocid="ward_round.save_vitals.button"
        >
          {createObs.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : null}{" "}
          Save Vitals
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Add Drug Form ──────────────────────────────────────────────────────────────

export function AddDrugForm({
  patientId,
  onSaved,
  onCancel,
}: { patientId: bigint; onSaved: () => void; onCancel: () => void }) {
  const { currentDoctor } = useEmailAuth();
  const createOrder = useCreateOrder();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");

  const handleSave = async () => {
    if (!name.trim()) return;
    await createOrder.mutateAsync({
      patientId,
      orderType: "Medication",
      code: "DRUG",
      description: `${name.trim()} ${dose.trim()}`.trim(),
      orderedAt: BigInt(Date.now()) * 1_000_000n,
      orderedBy: { toString: () => "local" } as unknown as Principal,
      orderedByName: currentDoctor?.name ?? "Unknown",
      orderedByRole: (currentDoctor?.role ?? "doctor") as StaffRole,
    });
    toast.success(`${name} added`);
    onSaved();
  };

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        placeholder="Drug name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-sm"
      />
      <Input
        placeholder="Dose / Instructions"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={createOrder.isPending || !name.trim()}
          className="flex-1"
          data-ocid="ward_round.add_drug.button"
        >
          Add Drug
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Order Test Form ───────────────────────────────────────────────────────────

export function OrderTestForm({
  patientId,
  onSaved,
  onCancel,
}: { patientId: bigint; onSaved: () => void; onCancel: () => void }) {
  const { currentDoctor } = useEmailAuth();
  const createOrder = useCreateOrder();
  const COMMON = [
    "CBC",
    "Blood Glucose (RBS)",
    "Serum Creatinine",
    "Chest X-Ray",
    "ECG",
    "Urine R/E",
    "Blood Culture",
    "LFT",
  ];
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  const toggle = (t: string) =>
    setSelected((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const handleSave = async () => {
    const list = [
      ...selected,
      ...(custom.trim() ? custom.split(",").map((s) => s.trim()) : []),
    ];
    for (const test of list) {
      await createOrder.mutateAsync({
        patientId,
        orderType: "Investigation",
        code: "LAB",
        description: test,
        orderedAt: BigInt(Date.now()) * 1_000_000n,
        orderedBy: { toString: () => "local" } as unknown as Principal,
        orderedByName: currentDoctor?.name ?? "Unknown",
        orderedByRole: (currentDoctor?.role ?? "doctor") as StaffRole,
      });
    }
    toast.success(`${list.length} test(s) ordered`);
    onSaved();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {COMMON.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selected.includes(t)
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-card border-border hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <Input
        placeholder="Other tests (comma separated)"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={
            createOrder.isPending || (selected.length === 0 && !custom.trim())
          }
          className="flex-1"
          data-ocid="ward_round.order_test.button"
        >
          Order Tests
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Quick Review Modal ────────────────────────────────────────────────────────

function QuickReviewModal({
  patient,
  onSaved,
  onClose,
}: { patient: Patient; onSaved: () => void; onClose: () => void }) {
  const { currentDoctor } = useEmailAuth();
  const createNote = useCreateClinicalNote();
  const [note, setNote] = useState("Stable, continue current management");
  const [saving, setSaving] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const handleSave = async () => {
    if (!note.trim()) {
      toast.error("Note is required");
      return;
    }
    setSaving(true);
    try {
      await createNote.mutateAsync({
        patientId: patient.id,
        noteType: "SOAP",
        noteSubtype: "quick_review",
        authorId: { toString: () => "local" } as unknown as Principal,
        authorName: currentDoctor?.name ?? "Unknown",
        authorRole: (currentDoctor?.role ?? "consultant_doctor") as StaffRole,
        content: JSON.stringify({
          assessment: note.trim(),
          quickReview: true,
          patient: patient.fullName,
          timestamp: new Date().toISOString(),
        }),
        isDraft: false,
        createdAt: BigInt(Date.now()) * 1_000_000n,
      });
      saveNoteState(String(patient.id), today, "quick_review");
      toast.success("Quick review saved");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-away
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: inner stops propagation */}
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-foreground">Stable — No Change</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
            Patient: <span className="font-semibold">{patient.fullName}</span> —
            Bed {patient.bedNumber ?? "—"}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">
              Brief Note (required)
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Stable, continue current management"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-ocid="ward_round.quick_review.textarea"
              // biome-ignore lint/a11y/noAutofocus: intentional quick action
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !note.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-ocid="ward_round.quick_review.save_button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Log Review
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              data-ocid="ward_round.quick_review.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pre-Round Checklist ───────────────────────────────────────────────────────

interface ChecklistEntry {
  vitals: boolean;
  iv: boolean;
  investigations: boolean;
  comfortable: boolean;
}
type WardChecklist = Record<string, ChecklistEntry>;

function loadChecklist(date: string): WardChecklist {
  try {
    const raw = localStorage.getItem(`wardRoundChecklist_${date}`);
    return raw ? (JSON.parse(raw) as WardChecklist) : {};
  } catch {
    return {};
  }
}
function saveChecklist(date: string, data: WardChecklist) {
  try {
    localStorage.setItem(`wardRoundChecklist_${date}`, JSON.stringify(data));
  } catch {}
}

export function PreRoundChecklist({
  patients,
  onClose,
}: { patients: Patient[]; onClose: () => void }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [checklist, setChecklist] = useState<WardChecklist>(() =>
    loadChecklist(today),
  );
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const updateItem = (
    pid: string,
    field: keyof ChecklistEntry,
    value: boolean,
  ) => {
    setChecklist((prev) => {
      const entry = prev[pid] ?? {
        vitals: false,
        iv: false,
        investigations: false,
        comfortable: false,
      };
      const next = { ...prev, [pid]: { ...entry, [field]: value } };
      saveChecklist(today, next);
      return next;
    });
  };

  const shift = getCurrentShift();
  const shiftLabel =
    shift === "morning"
      ? "Morning (6AM–2PM)"
      : shift === "evening"
        ? "Evening (2PM–10PM)"
        : "Night (10PM–6AM)";
  const readyCount = patients.filter((p) => {
    const e = checklist[String(p.id)];
    return e?.vitals && e?.iv && e?.investigations && e?.comfortable;
  }).length;

  const LABELS: Array<{
    field: keyof ChecklistEntry;
    label: string;
    color: string;
  }> = [
    { field: "vitals", label: "Vitals done", color: "text-teal-700" },
    { field: "iv", label: "IV verified", color: "text-blue-700" },
    {
      field: "investigations",
      label: "Investigations tracked",
      color: "text-purple-700",
    },
    {
      field: "comfortable",
      label: "Patient comfortable",
      color: "text-green-700",
    },
  ];

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-ocid="ward_round.checklist.panel"
    >
      <div className="bg-primary/10 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">
            Pre-Round Checklist — {shiftLabel} —{" "}
            {format(new Date(), "dd MMM yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              readyCount === patients.length
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {readyCount}/{patients.length} ready
          </span>
          <button
            type="button"
            onClick={onClose}
            data-ocid="ward_round.checklist.close_button"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold">
                Patient
              </th>
              {LABELS.map((l) => (
                <th
                  key={l.field}
                  className={`text-center px-3 py-2.5 text-xs font-semibold ${l.color}`}
                >
                  {l.label}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const entry = checklist[String(p.id)] ?? {
                vitals: false,
                iv: false,
                investigations: false,
                comfortable: false,
              };
              const allDone =
                entry.vitals &&
                entry.iv &&
                entry.investigations &&
                entry.comfortable;
              return (
                <tr
                  key={String(p.id)}
                  className={`border-b border-border ${allDone ? "bg-green-50/40" : ""}`}
                  data-ocid="ward_round.checklist.row"
                >
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="font-medium text-sm">{p.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Bed {p.bedNumber ?? "—"} · {p.department ?? "General"}
                      </p>
                      {!entry.vitals && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPatient(
                              expandedPatient === String(p.id)
                                ? null
                                : String(p.id),
                            )
                          }
                          className="text-xs text-red-600 mt-1 flex items-center gap-1 hover:text-red-800"
                        >
                          <AlertTriangle className="w-3 h-3" /> Vitals missing —
                          Enter now
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                      {expandedPatient === String(p.id) && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                          <VitalEntryForm
                            patientId={p.id}
                            onSaved={() => {
                              updateItem(String(p.id), "vitals", true);
                              setExpandedPatient(null);
                            }}
                            onCancel={() => setExpandedPatient(null)}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  {LABELS.map((l) => (
                    <td key={l.field} className="text-center px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={entry[l.field]}
                        onChange={(e) =>
                          updateItem(String(p.id), l.field, e.target.checked)
                        }
                        className="w-4 h-4 accent-teal-600 cursor-pointer"
                        data-ocid={`ward_round.checklist.${l.field}`}
                        aria-label={`${l.label} for ${p.fullName}`}
                      />
                    </td>
                  ))}
                  <td className="text-center px-3 py-2.5">
                    {allDone ? (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        ✓ Ready
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Round Summary Modal ───────────────────────────────────────────────────────

export function RoundSummaryModal({
  patients,
  noteStates,
  doctorName,
  onClose,
}: {
  patients: Patient[];
  noteStates: Record<string, NoteState>;
  doctorName: string;
  onClose: () => void;
}) {
  const today = format(new Date(), "dd MMM yyyy, HH:mm");
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const checklist = loadChecklist(todayKey);
  const finalized = patients.filter((p) =>
    ["finalized", "quick_review"].includes(noteStates[String(p.id)] ?? "none"),
  );
  const inProgress = patients.filter((p) =>
    ["intern_draft", "mo_reviewed"].includes(
      noteStates[String(p.id)] ?? "none",
    ),
  );
  const pending = patients.filter(
    (p) => (noteStates[String(p.id)] ?? "none") === "none",
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      data-ocid="ward_round.round_summary.dialog"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" /> Ward Round
              Summary
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {today} — Dr. {doctorName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              data-ocid="ward_round.round_summary.print_button"
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              data-ocid="ward_round.round_summary.close_button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-border">
          {[
            {
              label: "Total",
              value: patients.length,
              cls: "bg-primary/5 text-primary",
            },
            {
              label: "Finalized",
              value: finalized.length,
              cls: "bg-green-50 text-green-700",
            },
            {
              label: "In Progress",
              value: inProgress.length,
              cls: "bg-blue-50 text-blue-700",
            },
            {
              label: "Pending",
              value: pending.length,
              cls: "bg-amber-50 text-amber-700",
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`text-center rounded-lg py-2 ${cls}`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 text-xs">
                {["Patient", "Bed", "Note Status", "Checklist"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 font-semibold border border-border"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => {
                const state = noteStates[String(p.id)] ?? "none";
                const cl = checklist[String(p.id)];
                const clScore = cl
                  ? [
                      cl.vitals,
                      cl.iv,
                      cl.investigations,
                      cl.comfortable,
                    ].filter(Boolean).length
                  : 0;
                return (
                  <tr
                    key={String(p.id)}
                    className={`border border-border ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                    data-ocid={`ward_round.round_summary.row.${i + 1}`}
                  >
                    <td className="px-3 py-2.5 border border-border">
                      <p className="font-semibold text-sm">{p.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.department ?? "General"}
                      </p>
                    </td>
                    <td className="text-center px-3 py-2.5 border border-border font-mono text-sm">
                      {p.bedNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 border border-border">
                      <CompletionBadge state={state} />
                    </td>
                    <td className="text-center px-3 py-2.5 border border-border">
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          clScore === 4
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {clScore}/4
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          Ward Round Summary · Dr. Arman Kabir's Care ·{" "}
          {format(new Date(), "dd MMM yyyy HH:mm")}
        </div>
      </div>
    </div>
  );
}

// ── Nurse Patient Card ────────────────────────────────────────────────────────

function NursePatientCard({
  patient,
  onVitalsSaved,
}: { patient: Patient; onVitalsSaved: () => void }) {
  const [showVitals, setShowVitals] = useState(false);
  const [nurseNote, setNurseNote] = useState({
    observation: "",
    intervention: "",
    response: "",
  });
  const age = getAge(patient.dateOfBirth);

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-ocid="ward_round.nurse_card"
    >
      <div className="bg-rose-50 border-b border-rose-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-foreground text-sm">
            {patient.fullName}
          </p>
          <p className="text-xs text-muted-foreground">
            Bed {patient.bedNumber ?? "—"} · {age !== null ? `${age}y` : ""} ·{" "}
            {patient.gender}
          </p>
        </div>
        {patient.allergies.length > 0 && (
          <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
            ⚠ Allergy
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Vitals Entry */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-teal-700">📊 Vitals</p>
            <button
              type="button"
              onClick={() => setShowVitals(!showVitals)}
              className="text-xs text-teal-600 hover:text-teal-800 underline"
            >
              {showVitals ? "Hide" : "Enter Vitals"}
            </button>
          </div>
          {showVitals && (
            <VitalEntryForm
              patientId={patient.id}
              onSaved={() => {
                setShowVitals(false);
                onVitalsSaved();
              }}
              onCancel={() => setShowVitals(false)}
            />
          )}
        </div>

        {/* Nursing Notes — structured O/I/R */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-rose-700">
            📋 Nursing Notes (O/I/R)
          </p>
          {[
            {
              key: "observation" as const,
              label: "Observation",
              placeholder: "What did you observe?",
            },
            {
              key: "intervention" as const,
              label: "Intervention",
              placeholder: "What action was taken?",
            },
            {
              key: "response" as const,
              label: "Response",
              placeholder: "Patient's response?",
            },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {label}
              </p>
              <textarea
                value={nurseNote[key]}
                onChange={(e) =>
                  setNurseNote((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={placeholder}
                rows={2}
                className="w-full border border-input rounded-lg px-2.5 py-1.5 text-xs bg-background resize-none focus:outline-none focus:ring-1 focus:ring-rose-300"
                data-ocid={`ward_round.nurse.${key}_input`}
              />
            </div>
          ))}
          <Button
            size="sm"
            className="w-full bg-rose-600 hover:bg-rose-700 text-xs"
            onClick={() => {
              if (!nurseNote.observation.trim()) {
                toast.error("Observation is required");
                return;
              }
              const key = `nursing_notes_${String(patient.id)}_${format(new Date(), "yyyy-MM-dd")}`;
              const existing = JSON.parse(
                localStorage.getItem(key) ?? "[]",
              ) as unknown[];
              localStorage.setItem(
                key,
                JSON.stringify([
                  ...existing,
                  { ...nurseNote, timestamp: new Date().toISOString() },
                ]),
              );
              setNurseNote({ observation: "", intervention: "", response: "" });
              toast.success("Nursing note saved");
            }}
            data-ocid="ward_round.nurse.save_note_button"
          >
            Save Nursing Note
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Inline SOAP Note Drawer ───────────────────────────────────────────────────

function SoapNoteDrawer({
  patient,
  role,
  doctorEmail,
  authorName,
  onNoteStateChange,
  onClose,
}: {
  patient: Patient;
  role: StaffRole;
  doctorEmail: string;
  authorName: string;
  onNoteStateChange: (state: NoteState) => void;
  onClose: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss
    <div
      className="fixed inset-0 z-40 bg-black/60 flex flex-col"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: inner stops propagation */}
      <div
        className="bg-background flex-1 overflow-y-auto mt-16 rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">
              SOAP Note — {patient.fullName}
            </span>
            <span className="text-xs text-muted-foreground">
              Bed {patient.bedNumber ?? "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-ocid="ward_round.soap_drawer.close_button"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4">
          <DailyProgressNote
            patientId={String(patient.id)}
            doctorEmail={doctorEmail}
            authorName={authorName}
            viewerRole={role}
            latestVitals={null}
            prescriptions={[]}
            admissionDate={patient.admittedOn ?? patient.admissionDate}
            onNoteStateChange={onNoteStateChange}
          />
        </div>
      </div>
    </div>
  );
}

// ── Patient Card (Ward Round List) ────────────────────────────────────────────

function WardPatientCard({
  patient,
  noteState,
  index,
  role,
  vitalAlerts,
  alerts,
  onViewNote,
  onQuickReview,
}: {
  patient: Patient;
  noteState: NoteState;
  index: number;
  role: StaffRole;
  vitalAlerts: VitalAlertResult[];
  alerts: ClinicalAlert[];
  onViewNote: () => void;
  onQuickReview: () => void;
}) {
  const age = getAge(patient.dateOfBirth);
  const dayCount = daysSince(
    patient.admittedOn ?? patient.admissionDate ?? patient.createdAt,
  );
  const hasCritical =
    vitalAlerts.some((a) => a.severity === "critical") ||
    alerts.some((a) => a.severity === "Critical" && !a.isAcknowledged);
  const isConsultant =
    isConsultantType(role) || role === "admin" || role === "registrar";

  // Load latest vitals from storage
  const vitals = useMemo(() => {
    const email = getDoctorEmail();
    let bp = "";
    let pulse = "";
    let spo2 = "";
    let temp = "";
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("visit_form_data_") && k.endsWith(`_${email}`)) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (String(parsed.patientId) !== String(patient.id)) continue;
          const vs = parsed.vitalSigns as Record<string, string> | undefined;
          if (vs) {
            bp = vs.bloodPressure ?? bp;
            pulse = vs.pulse ?? pulse;
            spo2 = vs.oxygenSaturation ?? spo2;
            temp = vs.temperature ?? temp;
          }
        } catch {}
      }
    }
    return { bp, pulse, spo2, temp };
  }, [patient.id]);

  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${
        hasCritical
          ? "border-red-400"
          : noteState === "finalized" || noteState === "quick_review"
            ? "border-green-300"
            : "border-border"
      }`}
      data-ocid={`ward_round.patient_card.item.${index + 1}`}
    >
      {/* Card header */}
      <div
        className={`px-4 py-3 flex items-start justify-between gap-2 ${
          hasCritical ? "bg-red-50" : "bg-muted/30"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground text-sm truncate">
              {patient.fullName}
            </span>
            {patient.nameBn && (
              <span className="text-xs text-muted-foreground">
                {patient.nameBn}
              </span>
            )}
            {hasCritical && (
              <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                🚨 CRITICAL
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <BedDouble className="w-3 h-3" /> Bed {patient.bedNumber ?? "—"}
            </span>
            <span>{patient.department ?? patient.ward ?? "General Ward"}</span>
            <span>Day {dayCount > 0 ? dayCount : 1} of admission</span>
            {age !== null && (
              <span>
                {age}y · {patient.gender}
              </span>
            )}
          </div>
        </div>
        <CompletionBadge state={noteState} />
      </div>

      {/* Vitals inline */}
      <div className="px-4 py-2 bg-card border-b border-border/50 flex gap-3 flex-wrap">
        {[
          {
            label: "BP",
            value: vitals.bp,
            alert: vitalAlerts.find((a) => a.field === "BP"),
          },
          {
            label: "Pulse",
            value: vitals.pulse,
            alert: vitalAlerts.find((a) => a.field === "Pulse"),
          },
          {
            label: "SpO₂",
            value: vitals.spo2,
            alert: vitalAlerts.find((a) => a.field === "SpO2"),
          },
          { label: "Temp", value: vitals.temp, alert: null },
        ].map(({ label, value, alert }) => (
          <div key={label} className="text-xs">
            <span className="text-muted-foreground">{label}:</span>{" "}
            <span
              className={`font-semibold ${alert ? "text-red-600" : "text-foreground"}`}
            >
              {value || "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Allergy + alerts row */}
      <div className="px-4 py-2 flex gap-2 flex-wrap">
        {patient.allergies.slice(0, 3).map((a) => (
          <span
            key={a}
            className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold"
          >
            ⚠ {a}
          </span>
        ))}
        {vitalAlerts.slice(0, 2).map((a) => (
          <span
            key={a.field}
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
              a.severity === "critical"
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-amber-100 text-amber-700 border-amber-200"
            }`}
          >
            {a.message}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={onViewNote}
          className="gap-1.5 flex-1 min-w-0"
          data-ocid={`ward_round.view_note.button.${index + 1}`}
        >
          <FileText className="w-3.5 h-3.5" /> View / Write Note
        </Button>
        {isConsultant &&
          (noteState === "none" || noteState === "mo_reviewed") && (
            <Button
              size="sm"
              variant="outline"
              onClick={onQuickReview}
              className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
              data-ocid={`ward_round.stable_button.${index + 1}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Stable
            </Button>
          )}
      </div>
    </div>
  );
}

// ── Main WardRound Page ───────────────────────────────────────────────────────

type FilterType = "all" | "pending" | "finalized" | "critical";

export default function WardRound() {
  const { currentDoctor } = useEmailAuth();
  const permissions = useRolePermissions();
  const isOnline = useOnlineStatus();
  const role = (currentDoctor?.role ?? "staff") as StaffRole;
  const doctorEmail = getDoctorEmail();
  const isNurse = role === "nurse";
  const today = format(new Date(), "yyyy-MM-dd");

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showChecklist, setShowChecklist] = useState(false);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [noteStates, setNoteStates] = useState<Record<string, NoteState>>({});
  const [openNotePatient, setOpenNotePatient] = useState<Patient | null>(null);
  const [quickReviewPatient, setQuickReviewPatient] = useState<Patient | null>(
    null,
  );

  // Load admitted patients
  const allPatients = useMemo(() => {
    const email = getDoctorEmail();
    const primary = loadFromStorage<Patient>(`patients_${email}`);
    const all =
      primary.length > 0 ? primary : loadFromAllDoctorKeys<Patient>("patients");
    return all.filter(
      (p) =>
        p.isAdmitted === true ||
        p.patientType === "admitted" ||
        p.patientType === "indoor",
    );
  }, []);

  // Load note states for today
  useEffect(() => {
    const states: Record<string, NoteState> = {};
    for (const p of allPatients) {
      states[String(p.id)] = loadNoteState(String(p.id), today);
    }
    setNoteStates(states);
  }, [allPatients, today]);

  // Get vital alerts for each patient
  const vitalAlertsMap = useMemo(() => {
    const map: Record<string, VitalAlertResult[]> = {};
    const email = getDoctorEmail();
    for (const p of allPatients) {
      let bp = "";
      let pulse = "";
      let spo2 = "";
      let temp = "";
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("visit_form_data_") && k.endsWith(`_${email}`)) {
          try {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (String(parsed.patientId) !== String(p.id)) continue;
            const vs = parsed.vitalSigns as Record<string, string> | undefined;
            if (vs) {
              bp = vs.bloodPressure ?? bp;
              pulse = vs.pulse ?? pulse;
              spo2 = vs.oxygenSaturation ?? spo2;
              temp = vs.temperature ?? temp;
            }
          } catch {}
        }
      }
      map[String(p.id)] = checkVitalAlerts({
        bloodPressure: bp,
        pulse,
        oxygenSaturation: spo2,
        temperature: temp,
      });
    }
    return map;
  }, [allPatients]);

  const filteredPatients = useMemo(() => {
    let list = allPatients;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          (p.bedNumber ?? "").toLowerCase().includes(q),
      );
    }
    switch (filter) {
      case "pending":
        return list.filter((p) => {
          const s = noteStates[String(p.id)] ?? "none";
          return s === "none" || s === "intern_draft" || s === "mo_reviewed";
        });
      case "finalized":
        return list.filter((p) => {
          const s = noteStates[String(p.id)] ?? "none";
          return s === "finalized" || s === "quick_review";
        });
      case "critical":
        return list.filter((p) =>
          (vitalAlertsMap[String(p.id)] ?? []).some(
            (a) => a.severity === "critical",
          ),
        );
      default:
        return list;
    }
  }, [allPatients, searchQuery, filter, noteStates, vitalAlertsMap]);

  const updateNoteState = useCallback(
    (patientId: string, state: NoteState) => {
      saveNoteState(patientId, today, state);
      setNoteStates((prev) => ({ ...prev, [patientId]: state }));
    },
    [today],
  );

  const pendingCount = allPatients.filter((p) => {
    const s = noteStates[String(p.id)] ?? "none";
    return s === "none" || s === "intern_draft" || s === "mo_reviewed";
  }).length;

  const FILTERS: Array<{ key: FilterType; label: string; color: string }> = [
    { key: "all", label: `All (${allPatients.length})`, color: "" },
    {
      key: "pending",
      label: `Pending Review (${pendingCount})`,
      color: "text-amber-700",
    },
    { key: "finalized", label: "Finalized", color: "text-green-700" },
    { key: "critical", label: "Critical Alert", color: "text-red-700" },
  ];

  // ── Empty State ──────────────────────────────────────────────────────────────
  if (allPatients.length === 0) {
    return (
      <div
        className="max-w-2xl mx-auto p-6 mt-12 text-center"
        data-ocid="ward_round.empty_state"
      >
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <BedDouble className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">No Admitted Patients</h2>
        <p className="text-muted-foreground text-sm">
          Ward Round shows admitted patients only. Mark patients as admitted in
          their profile.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-0 bg-background"
      data-ocid="ward_round.page"
    >
      {/* ── Header ── */}
      <div className="bg-card border-b border-border px-4 py-3 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            <div>
              <h1 className="font-bold text-foreground text-base leading-tight">
                Ward Round
              </h1>
              <p className="text-xs text-muted-foreground">
                {allPatients.length} admitted · {pendingCount} pending
                finalization · {format(new Date(), "EEEE, dd MMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                isOnline
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
              data-ocid="ward_round.sync_status"
            >
              {isOnline ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {isOnline ? "Online" : "Offline"}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs hidden sm:flex"
              onClick={() => setShowChecklist(!showChecklist)}
              data-ocid="ward_round.checklist.button"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> Checklist
            </Button>
            {(permissions.canFinalizeClinicalNote ||
              permissions.canApproveInternNotes) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs hidden sm:flex"
                onClick={() => setShowRoundSummary(true)}
                data-ocid="ward_round.end_round.button"
              >
                <ClipboardList className="w-3.5 h-3.5" /> End Round
              </Button>
            )}
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search patient or bed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
              data-ocid="ward_round.search_input"
            />
          </div>
          <div
            className="flex gap-1 flex-wrap"
            data-ocid="ward_round.filter.tab"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : `bg-card border-border hover:bg-muted ${f.color}`
                }`}
                data-ocid={`ward_round.filter.${f.key}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Checklist Panel ── */}
      {showChecklist && (
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <PreRoundChecklist
            patients={allPatients}
            onClose={() => setShowChecklist(false)}
          />
        </div>
      )}

      {/* ── Patient List ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Nurse View */}
        {isNurse ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <Shield className="w-4 h-4" /> Nurse View — Vitals & Nursing Notes
            </div>
            {filteredPatients.map((p) => (
              <NursePatientCard
                key={String(p.id)}
                patient={p}
                onVitalsSaved={() =>
                  updateNoteState(
                    String(p.id),
                    noteStates[String(p.id)] ?? "none",
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPatients.length === 0 ? (
              <div
                className="text-center py-12 text-muted-foreground"
                data-ocid="ward_round.filtered_empty_state"
              >
                No patients match the current filter.
              </div>
            ) : (
              filteredPatients.map((p, i) => (
                <WardPatientCard
                  key={String(p.id)}
                  patient={p}
                  noteState={noteStates[String(p.id)] ?? "none"}
                  index={i}
                  role={role}
                  vitalAlerts={vitalAlertsMap[String(p.id)] ?? []}
                  alerts={[]}
                  onViewNote={() => setOpenNotePatient(p)}
                  onQuickReview={() => setQuickReviewPatient(p)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── SOAP Note Drawer ── */}
      {openNotePatient && (
        <SoapNoteDrawer
          patient={openNotePatient}
          role={role}
          doctorEmail={doctorEmail}
          authorName={currentDoctor?.name ?? "Unknown"}
          onNoteStateChange={(state) =>
            updateNoteState(String(openNotePatient.id), state)
          }
          onClose={() => setOpenNotePatient(null)}
        />
      )}

      {/* ── Quick Review Modal ── */}
      {quickReviewPatient && (
        <QuickReviewModal
          patient={quickReviewPatient}
          onSaved={() => {
            updateNoteState(String(quickReviewPatient.id), "quick_review");
            setQuickReviewPatient(null);
          }}
          onClose={() => setQuickReviewPatient(null)}
        />
      )}

      {/* ── Round Summary Modal ── */}
      {showRoundSummary && (
        <RoundSummaryModal
          patients={allPatients}
          noteStates={noteStates}
          doctorName={currentDoctor?.name ?? "Unknown"}
          onClose={() => setShowRoundSummary(false)}
        />
      )}
    </div>
  );
}
