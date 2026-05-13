/**
 * DailyProgress — Daily SOAP Progress Notes + Problem List
 * Used as the 10th tab in PatientDashboard.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Edit2,
  ListChecks,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { appendAuditLog } from "../hooks/useEmailAuth";
import type { Prescription } from "../types";
import { STAFF_ROLE_COLORS, STAFF_ROLE_LABELS, type StaffRole } from "../types";
import type { ProblemItem, SoapEntry } from "./patientDashboardTypes";
import {
  loadDailyProgress,
  loadProblemList,
  saveDailyProgress,
  saveProblemList,
} from "./patientDashboardTypes";

const SOAP_ENTRY_TYPES = [
  "Morning Round",
  "Evening Round",
  "Emergency Note",
  "Night Round",
  "Consultant Review",
  "Nursing Note",
] as const;

type EntryType = (typeof SOAP_ENTRY_TYPES)[number];
type AssessmentStatus = "Improving" | "Stable" | "Worsening";

interface DailyProgressProps {
  patientId: bigint;
  doctorEmail: string;
  currentRole: "admin" | "doctor" | "staff" | "patient";
  viewerRole: StaffRole;
  authorName: string;
  prescriptions: Prescription[];
  admissionDate?: string;
}

// ── Problem List Section ──────────────────────────────────────────────────────
function ProblemListSection({
  patientId,
  doctorEmail,
  prescriptions,
  canEdit,
}: {
  patientId: bigint;
  doctorEmail: string;
  prescriptions: Prescription[];
  canEdit: boolean;
}) {
  const [problems, setProblems] = useState<ProblemItem[]>(() =>
    loadProblemList(doctorEmail, String(patientId)),
  );
  const [newProblem, setNewProblem] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "resolved">("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Auto-sync diagnoses from prescriptions
  useEffect(() => {
    const diagnosisSet = new Set<string>();
    for (const rx of prescriptions) {
      if (rx.diagnosis) {
        for (const d of rx.diagnosis.split(/[,|;]/)) {
          const trimmed = d.trim();
          if (trimmed) diagnosisSet.add(trimmed);
        }
      }
    }

    setProblems((prev) => {
      const existing = new Set(prev.map((p) => p.name.toLowerCase()));
      const newItems: ProblemItem[] = [];
      for (const diag of diagnosisSet) {
        if (!existing.has(diag.toLowerCase())) {
          newItems.push({
            id: `auto_${Date.now().toString(36)}_${diag}`,
            name: diag,
            status: "active",
            source: "prescription",
          });
        }
      }
      if (newItems.length === 0) return prev;
      const merged = [...prev, ...newItems];
      saveProblemList(doctorEmail, String(patientId), merged);
      return merged;
    });
  }, [patientId, doctorEmail, prescriptions]);

  const linkedMedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of problems) {
      let count = 0;
      for (const rx of prescriptions) {
        if (rx.diagnosis?.toLowerCase().includes(p.name.toLowerCase())) {
          count += rx.medications?.length ?? 0;
        }
      }
      counts[p.id] = count;
    }
    return counts;
  }, [problems, prescriptions]);

  function addProblem() {
    if (!newProblem.trim()) return;
    const item: ProblemItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: newProblem.trim(),
      status: newStatus,
      source: "manual",
    };
    const updated = [...problems, item];
    setProblems(updated);
    saveProblemList(doctorEmail, String(patientId), updated);
    setNewProblem("");
    toast.success("Problem added");
  }

  function toggleStatus(id: string) {
    const updated = problems.map((p) =>
      p.id === id
        ? {
            ...p,
            status:
              p.status === "active"
                ? ("resolved" as const)
                : ("active" as const),
          }
        : p,
    );
    setProblems(updated);
    saveProblemList(doctorEmail, String(patientId), updated);
  }

  function removeProblem(id: string) {
    const updated = problems.filter((p) => p.id !== id);
    setProblems(updated);
    saveProblemList(doctorEmail, String(patientId), updated);
  }

  function saveEdit(id: string) {
    if (!editText.trim()) return;
    const updated = problems.map((p) =>
      p.id === id ? { ...p, name: editText.trim() } : p,
    );
    setProblems(updated);
    saveProblemList(doctorEmail, String(patientId), updated);
    setEditingId(null);
    setEditText("");
  }

  return (
    <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-5">
      <h3 className="font-semibold text-violet-800 mb-4 flex items-center gap-2 text-base">
        <ListChecks className="w-4 h-4" /> Active Problem List
        <span className="ml-auto text-xs font-normal text-gray-400">
          {problems.filter((p) => p.status === "active").length} active
        </span>
      </h3>

      {canEdit && (
        <div className="flex gap-2 mb-4">
          <Input
            value={newProblem}
            onChange={(e) => setNewProblem(e.target.value)}
            placeholder="Add problem (e.g. Typhoid Fever)"
            onKeyDown={(e) => e.key === "Enter" && addProblem()}
            className="flex-1"
            data-ocid="patient_dashboard.daily_progress.problem_input"
          />
          <select
            value={newStatus}
            onChange={(e) =>
              setNewStatus(e.target.value as "active" | "resolved")
            }
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button
            size="sm"
            onClick={addProblem}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-1"
            data-ocid="patient_dashboard.daily_progress.add_problem_button"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      )}

      {problems.length === 0 ? (
        <p
          className="text-sm text-gray-400 text-center py-4"
          data-ocid="patient_dashboard.daily_progress.problems_empty_state"
        >
          No problems recorded. They auto-fill from prescription diagnoses.
        </p>
      ) : (
        <div className="space-y-2">
          {problems.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                p.status === "active"
                  ? "bg-red-50 border-red-200"
                  : "bg-gray-50 border-gray-200"
              }`}
              data-ocid="patient_dashboard.daily_progress.problem_item"
            >
              {editingId === p.id ? (
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(p.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className={`flex-1 text-sm font-medium ${
                    p.status === "resolved"
                      ? "line-through text-gray-400"
                      : "text-gray-800"
                  }`}
                >
                  {p.name}
                </span>
              )}

              {linkedMedCount[p.id] > 0 && (
                <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                  {linkedMedCount[p.id]} med
                  {linkedMedCount[p.id] !== 1 ? "s" : ""}
                </span>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => toggleStatus(p.id)}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium cursor-pointer transition-colors ${
                    p.status === "active"
                      ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                  }`}
                  data-ocid="patient_dashboard.daily_progress.problem_toggle"
                >
                  {p.status === "active" ? "Active" : "Resolved"}
                </button>
              )}

              {canEdit && editingId !== p.id && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(p.id);
                    setEditText(p.name);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  data-ocid="patient_dashboard.daily_progress.problem_edit_button"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {editingId === p.id && (
                <>
                  <button
                    type="button"
                    onClick={() => saveEdit(p.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeProblem(p.id)}
                  className="text-red-400 hover:text-red-600"
                  data-ocid="patient_dashboard.daily_progress.problem_delete_button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SOAP Entry Card ───────────────────────────────────────────────────────────
function SoapCard({
  entry,
  canEdit,
  onEdit,
  onDelete,
}: {
  entry: SoapEntry;
  canEdit: boolean;
  onEdit: (e: SoapEntry) => void;
  onDelete: (id: string) => void;
}) {
  const roleLabel =
    STAFF_ROLE_LABELS[entry.authorRole as StaffRole] ?? entry.authorRole;
  const roleColor =
    STAFF_ROLE_COLORS[entry.authorRole as StaffRole] ??
    "bg-gray-100 text-gray-700 border-gray-200";
  const assessmentColor =
    entry.assessment === "Improving"
      ? "bg-green-100 text-green-700"
      : entry.assessment === "Worsening"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  return (
    <div
      className="border border-slate-200 rounded-xl overflow-hidden"
      data-ocid="patient_dashboard.daily_progress.soap_card"
    >
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
            {entry.entryType}
          </span>
          <Badge className={`text-xs border ${roleColor}`}>{roleLabel}</Badge>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${assessmentColor}`}
          >
            {entry.assessment}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">
            {format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a")}
          </span>
          <span className="text-xs text-gray-500 font-medium">
            {entry.authorName}
          </span>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="text-blue-400 hover:text-blue-700 transition-colors"
                aria-label="Edit entry"
                data-ocid="patient_dashboard.daily_progress.soap_edit_button"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="text-red-400 hover:text-red-700 transition-colors"
                aria-label="Delete entry"
                data-ocid="patient_dashboard.daily_progress.soap_delete_button"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          {
            label: "S — Subjective",
            value: entry.subjective,
            color: "bg-blue-50 border-blue-200 text-blue-800",
          },
          {
            label: "O — Objective",
            value: entry.objective,
            color: "bg-teal-50 border-teal-200 text-teal-800",
          },
          {
            label: "A — Assessment",
            value: entry.assessment,
            color: `border ${assessmentColor}`,
          },
          {
            label: "P — Plan",
            value: entry.plan,
            color: "bg-indigo-50 border-indigo-200 text-indigo-800",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-3 border ${color}`}>
            <p className="text-xs font-bold mb-1 opacity-70">{label}</p>
            <p className="text-sm whitespace-pre-line">{value || "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main DailyProgress Component ─────────────────────────────────────────────
export default function DailyProgress({
  patientId,
  doctorEmail,
  currentRole,
  viewerRole,
  authorName,
  prescriptions,
  admissionDate: _admissionDate,
}: DailyProgressProps) {
  const canEdit =
    currentRole === "admin" ||
    currentRole === "doctor" ||
    viewerRole === "consultant_doctor" ||
    viewerRole === "medical_officer" ||
    viewerRole === "intern_doctor" ||
    viewerRole === "nurse";

  const canWriteSOAP =
    viewerRole === "consultant_doctor" ||
    viewerRole === "medical_officer" ||
    viewerRole === "intern_doctor" ||
    viewerRole === "doctor" ||
    currentRole === "admin";

  const canDeleteOthers =
    currentRole === "admin" || viewerRole === "consultant_doctor";

  const [entries, setEntries] = useState<SoapEntry[]>(() =>
    loadDailyProgress(doctorEmail, String(patientId)),
  );

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SoapEntry | null>(null);
  const [form, setForm] = useState({
    entryType: "Morning Round" as EntryType,
    subjective: "",
    objective: "",
    assessment: "Stable" as AssessmentStatus,
    plan: "",
  });

  function resetForm() {
    setForm({
      entryType: "Morning Round",
      subjective: "",
      objective: "",
      assessment: "Stable",
      plan: "",
    });
    setEditingEntry(null);
    setShowForm(false);
  }

  function openEditForm(entry: SoapEntry) {
    setEditingEntry(entry);
    setForm({
      entryType: entry.entryType as EntryType,
      subjective: entry.subjective,
      objective: entry.objective,
      assessment: entry.assessment as AssessmentStatus,
      plan: entry.plan,
    });
    setShowForm(true);
  }

  function saveEntry() {
    if (
      !form.subjective.trim() &&
      !form.objective.trim() &&
      !form.plan.trim()
    ) {
      toast.error("Please fill in at least one SOAP field");
      return;
    }

    if (editingEntry) {
      const updated = entries.map((e) =>
        e.id === editingEntry.id
          ? { ...e, ...form, editedAt: new Date().toISOString() }
          : e,
      );
      setEntries(updated);
      saveDailyProgress(doctorEmail, String(patientId), updated);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: viewerRole,
        userName: authorName,
        action: "SOAP_ENTRY_EDITED",
        target: String(patientId),
      });
      toast.success("Entry updated");
    } else {
      const newEntry: SoapEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        patientId: String(patientId),
        ...form,
        authorName,
        authorRole: viewerRole,
        timestamp: new Date().toISOString(),
      };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      saveDailyProgress(doctorEmail, String(patientId), updated);
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: viewerRole,
        userName: authorName,
        action: "SOAP_ENTRY_ADDED",
        target: String(patientId),
      });
      toast.success("SOAP entry added");
    }
    resetForm();
  }

  function deleteEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    const isOwn = entry?.authorName === authorName;
    if (!isOwn && !canDeleteOthers) {
      toast.error("You can only delete your own entries");
      return;
    }
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveDailyProgress(doctorEmail, String(patientId), updated);
    appendAuditLog({
      timestamp: new Date().toISOString(),
      userRole: viewerRole,
      userName: authorName,
      action: "SOAP_ENTRY_DELETED",
      target: String(patientId),
    });
    toast.success("Entry deleted");
  }

  return (
    <div className="space-y-4">
      {/* Problem List */}
      <ProblemListSection
        patientId={patientId}
        doctorEmail={doctorEmail}
        prescriptions={prescriptions}
        canEdit={canEdit}
      />

      {/* SOAP entries header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Daily Progress Notes
          <span className="text-xs font-normal text-gray-400">
            {entries.length} entries
          </span>
        </h3>
        {canWriteSOAP && (
          <Button
            size="sm"
            className="bg-slate-700 hover:bg-slate-800 text-white gap-1.5"
            onClick={() => {
              setEditingEntry(null);
              setForm({
                entryType: "Morning Round",
                subjective: "",
                objective: "",
                assessment: "Stable",
                plan: "",
              });
              setShowForm(true);
            }}
            data-ocid="patient_dashboard.daily_progress.add_entry_button"
          >
            <Plus className="w-3.5 h-3.5" /> Add Entry
          </Button>
        )}
      </div>

      {/* SOAP Form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4" />
              {editingEntry ? "Edit SOAP Entry" : "New SOAP Entry"}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                Entry Type
              </Label>
              <select
                value={form.entryType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    entryType: e.target.value as EntryType,
                  }))
                }
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                data-ocid="patient_dashboard.daily_progress.entry_type_select"
              >
                {SOAP_ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                Assessment
              </Label>
              <select
                value={form.assessment}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    assessment: e.target.value as AssessmentStatus,
                  }))
                }
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                data-ocid="patient_dashboard.daily_progress.assessment_select"
              >
                <option value="Improving">Improving ✅</option>
                <option value="Stable">Stable ⚠️</option>
                <option value="Worsening">Worsening 🔴</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-blue-600">
              S — Subjective (patient complaints, pain, fever, breathing)
            </Label>
            <Textarea
              value={form.subjective}
              onChange={(e) =>
                setForm((f) => ({ ...f, subjective: e.target.value }))
              }
              placeholder="Patient reports: headache, fever for 2 days, breathing difficulty on exertion..."
              rows={3}
              className="mt-1 border-blue-200 focus-visible:ring-blue-300"
              data-ocid="patient_dashboard.daily_progress.soap_subjective"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-teal-600">
              O — Objective (vitals, urine output, labs)
            </Label>
            <Textarea
              value={form.objective}
              onChange={(e) =>
                setForm((f) => ({ ...f, objective: e.target.value }))
              }
              placeholder="BP: 120/80 mmHg, Pulse: 88 bpm, Temp: 37.2°C, SpO₂: 97%, Urine output: 50ml/hr..."
              rows={3}
              className="mt-1 border-teal-200 focus-visible:ring-teal-300"
              data-ocid="patient_dashboard.daily_progress.soap_objective"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-indigo-600">
              P — Plan (treatment changes, next steps)
            </Label>
            <Textarea
              value={form.plan}
              onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
              placeholder="Continue antibiotics, add IV fluids, repeat CBC tomorrow, consult nephrology if Cr rises..."
              rows={3}
              className="mt-1 border-indigo-200 focus-visible:ring-indigo-300"
              data-ocid="patient_dashboard.daily_progress.soap_plan"
            />
          </div>

          <div className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            Entry by <span className="font-semibold">{authorName}</span> (
            {STAFF_ROLE_LABELS[viewerRole] ?? viewerRole}) —{" "}
            {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={saveEntry}
              className="bg-slate-700 hover:bg-slate-800 text-white"
              data-ocid="patient_dashboard.daily_progress.save_entry_button"
            >
              {editingEntry ? "Update Entry" : "Save Entry"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <div
          className="text-center py-10 bg-white rounded-xl border border-slate-200"
          data-ocid="patient_dashboard.daily_progress.empty_state"
        >
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            No daily progress entries yet.
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Click + Add Entry to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isOwn = entry.authorName === authorName;
            const canEditThis = canEdit && (isOwn || canDeleteOthers);
            return (
              <SoapCard
                key={entry.id}
                entry={entry}
                canEdit={canEditThis}
                onEdit={openEditForm}
                onDelete={deleteEntry}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
