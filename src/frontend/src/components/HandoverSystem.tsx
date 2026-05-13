/**
 * HandoverSystem — Robust shift handover document system.
 *
 * Sections per handover document:
 *   1. Header (hospital, date/time, shift, given-by / taken-by)
 *   2. Patient Identification (blue)
 *   3. Diagnosis & Day of Stay (green)
 *   4. Current Consultant/Team (purple)
 *   5. Clinical Summary & Vital Signs (rose)
 *   6. Actionable Items (amber)
 *   7. Tasks Pending (teal)
 *   8. Consultant Comments (indigo) — alarm notification on new comment
 *
 * Nurse flow: Start → fill → Submit (locked). Incoming nurse can Accept & Take Over.
 * MO flow: Make Handover → auto-generate → edit → Submit.
 * Consultant: can add comments to any submitted handover → nurse/MO get alarm.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { differenceInDays, format } from "date-fns";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Lock,
  MessageSquare,
  Plus,
  Printer,
  Stethoscope,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type DoctorAccount, loadRegistry } from "../hooks/useEmailAuth";
import type { StaffRole } from "../types";
import { STAFF_ROLE_LABELS } from "../types";
import type { TrackedInvestigation } from "./InvestigationTracker";
import { loadTrackedInvestigations } from "./InvestigationTracker";

// ── Local Types ────────────────────────────────────────────────────────────────

export type HandoverShift = "Morning" | "Evening" | "Night";
export type HandoverType = "nurse" | "mo";
export type HandoverStatus = "draft" | "submitted";
export type ActionPriority = "Urgent" | "Routine";

export interface ActionItem {
  id: string;
  description: string;
  priority: ActionPriority;
  dueTime: string;
  assignedRole: string;
  done: boolean;
}

export interface PendingTask {
  id: string;
  taskName: string;
  taskType: "investigation" | "procedure" | "medication" | "missed_dose";
  orderedBy: string;
  dateOrdered: string;
  status: string;
  /** Set when a task is carried over from a previous shift */
  carriedOver?: boolean;
  originalShift?: string;
  originalDate?: string;
}

export interface ConsultantComment {
  id: string;
  comment: string;
  commentBy: string;
  commentByRole: StaffRole;
  commentAt: string;
}

export interface HandoverGivenBy {
  name: string;
  role: string;
  time: string;
}

export interface HandoverTakenBy {
  name: string;
  role: string;
  email: string;
  time: string;
  /** Acknowledgment fields — filled when the receiving staff clicks "I Have Received This Handover" */
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedRole?: string;
}

export interface HandoverVitals {
  bp: string;
  pulse: string;
  temp: string;
  spo2: string;
  rr: string;
  weight: string;
  gcs: string;
  map: string; // auto-calculated
  ioBalance: string; // 24h I/O balance summary
  hb: string;
  wbc: string;
  creatinine: string;
  sodium: string;
  potassium: string;
  glucose: string;
}

export interface HandoverDocument {
  id: string;
  patientId: string;
  type: HandoverType;
  status: HandoverStatus;
  // Section 1 – Header
  hospitalName: string;
  shiftLabel: HandoverShift;
  shiftStart: string; // HH:MM
  shiftEnd: string; // HH:MM
  createdAt: string;
  submittedAt?: string;
  givenBy: HandoverGivenBy;
  takenBy?: HandoverTakenBy;
  // Section 2 – Patient ID (blue)
  patientName: string;
  registerNumber: string;
  ageSex: string;
  bedNumber: string;
  wardName: string;
  department: string;
  admissionDate: string;
  // Section 3 – Diagnosis (green)
  primaryDiagnosis: string;
  secondaryDiagnoses: string;
  comorbidities: string;
  dayOfStay: number;
  postOpDay?: number;
  // Section 4 – Consultant/Team (purple)
  assignedConsultant: string;
  medicalOfficer: string;
  internAssigned: string;
  treatingTeamNotes: string;
  // Section 5 – Vitals (rose)
  vitals: HandoverVitals;
  // Section 6 – Actionable Items (amber)
  actionItems: ActionItem[];
  // Section 7 – Pending Tasks (teal)
  pendingTasks: PendingTask[];
  // Section 8 – Consultant Comments (indigo)
  consultantComments: ConsultantComment[];
  // Appended sections from subsequent nurses taking over
  appendedEntries: AppendedEntry[];
}

export interface AppendedEntry {
  id: string;
  takenBy: HandoverTakenBy;
  additionalWork: string;
  actionItems: ActionItem[];
  createdAt: string;
}

// ── Audio Alarm ────────────────────────────────────────────────────────────────

function playAlarmTone() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // AudioContext not available in this environment
  }
}

// ── Unread Comment Tracking ────────────────────────────────────────────────────

const UNREAD_KEY = (email: string) => `handover_unread_comments_${email}`;

function getUnreadCommentIds(email: string): string[] {
  try {
    const raw = localStorage.getItem(UNREAD_KEY(email));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addUnreadCommentId(email: string, commentId: string) {
  const existing = getUnreadCommentIds(email);
  if (!existing.includes(commentId)) {
    existing.push(commentId);
    localStorage.setItem(UNREAD_KEY(email), JSON.stringify(existing));
  }
}

function markCommentRead(email: string, commentId: string) {
  const existing = getUnreadCommentIds(email).filter((id) => id !== commentId);
  localStorage.setItem(UNREAD_KEY(email), JSON.stringify(existing));
}

// ── Storage ────────────────────────────────────────────────────────────────────

const DOCS_KEY = (patientId: string) => `handover_docs_${patientId}`;

function loadDocs(patientId: string): HandoverDocument[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY(patientId));
    return raw ? (JSON.parse(raw) as HandoverDocument[]) : [];
  } catch {
    return [];
  }
}

function saveDocs(patientId: string, docs: HandoverDocument[]) {
  try {
    localStorage.setItem(DOCS_KEY(patientId), JSON.stringify(docs));
  } catch {}
}

// ── Shift Helpers ──────────────────────────────────────────────────────────────

function detectShift(): HandoverShift {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Evening";
  return "Night";
}

function shiftDefaults(shift: HandoverShift): { start: string; end: string } {
  if (shift === "Morning") return { start: "06:00", end: "14:00" };
  if (shift === "Evening") return { start: "14:00", end: "22:00" };
  return { start: "22:00", end: "06:00" };
}

function shiftEmoji(shift: HandoverShift) {
  return shift === "Morning" ? "🌅" : shift === "Evening" ? "🌆" : "🌙";
}

function shiftBadgeCls(shift: HandoverShift) {
  if (shift === "Morning")
    return "bg-amber-100 text-amber-800 border-amber-300";
  if (shift === "Evening")
    return "bg-indigo-100 text-indigo-800 border-indigo-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

// ── MAP Calculator ─────────────────────────────────────────────────────────────

function calcMAP(bp: string): string {
  const m = bp.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return "";
  const sys = Number.parseInt(m[1], 10);
  const dia = Number.parseInt(m[2], 10);
  return String(Math.round(dia + (sys - dia) / 3));
}

// ── Vital Alert Check ──────────────────────────────────────────────────────────

function isVitalAbnormal(key: keyof HandoverVitals, value: string): boolean {
  if (!value) return false;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return false;
  switch (key) {
    case "spo2":
      return n < 90;
    case "pulse":
      return n > 100 || n < 60;
    case "rr":
      return n > 30;
    case "temp":
      return n > 38.5 || n < 36;
    case "map":
      return n < 65;
    default:
      if (key === "bp") {
        const m = value.match(/(\d+)/);
        if (m) return Number.parseInt(m[1], 10) < 90;
      }
      return false;
  }
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({
  color,
  title,
  icon,
}: { color: string; title: string; icon: React.ReactNode }) {
  return (
    <div
      className={`px-4 py-2 font-bold text-sm flex items-center gap-2 ${color}`}
    >
      {icon}
      {title}
    </div>
  );
}

// ── Shift Time Editor ──────────────────────────────────────────────────────────

interface ShiftEditorProps {
  shift: HandoverShift;
  shiftStart: string;
  shiftEnd: string;
  onChangeShift: (s: HandoverShift) => void;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
}

function ShiftEditor({
  shift,
  shiftStart,
  shiftEnd,
  onChangeShift,
  onChangeStart,
  onChangeEnd,
}: ShiftEditorProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${shiftBadgeCls(shift)}`}
      >
        {shiftEmoji(shift)} {shift} Shift · {shiftStart}–{shiftEnd}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="ml-1 hover:opacity-70 transition-opacity"
          title="Edit shift times"
          data-ocid="handover.shift_edit_button"
        >
          ✏️
        </button>
      </span>
      {editing && (
        <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2 flex-wrap">
          <div className="flex gap-1 items-center">
            {(["Morning", "Evening", "Night"] as HandoverShift[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChangeShift(s);
                  const d = shiftDefaults(s);
                  onChangeStart(d.start);
                  onChangeEnd(d.end);
                }}
                className={`px-2 py-1 rounded text-xs font-medium border transition-all ${shift === s ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"}`}
              >
                {shiftEmoji(s)} {s}
              </button>
            ))}
          </div>
          <input
            type="time"
            value={shiftStart}
            onChange={(e) => onChangeStart(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="time"
            value={shiftEnd}
            onChange={(e) => onChangeEnd(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-green-600 font-semibold hover:underline"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ── Actionable Items Editor ────────────────────────────────────────────────────

function ActionItemsEditor({
  items,
  onChange,
}: { items: ActionItem[]; onChange: (items: ActionItem[]) => void }) {
  function add() {
    onChange([
      ...items,
      {
        id: `ai_${Date.now()}`,
        description: "",
        priority: "Routine",
        dueTime: "",
        assignedRole: "nurse",
        done: false,
      },
    ]);
  }
  function update(idx: number, patch: Partial<ActionItem>) {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center bg-white border border-amber-100 rounded-lg px-3 py-2"
        >
          <Input
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Task description..."
            className="text-sm border-0 shadow-none p-0 h-auto focus-visible:ring-0"
            data-ocid={`handover.action_item.${i + 1}`}
          />
          <select
            value={item.priority}
            onChange={(e) =>
              update(i, { priority: e.target.value as ActionPriority })
            }
            className={`text-xs border rounded px-2 py-1 font-semibold ${item.priority === "Urgent" ? "border-red-300 text-red-700 bg-red-50" : "border-gray-200 text-gray-600 bg-white"}`}
            data-ocid={`handover.action_priority.${i + 1}`}
          >
            <option value="Urgent">🔴 Urgent</option>
            <option value="Routine">🟢 Routine</option>
          </select>
          <input
            type="time"
            value={item.dueTime}
            onChange={(e) => update(i, { dueTime: e.target.value })}
            className="text-xs border border-gray-200 rounded px-2 py-1"
          />
          <Input
            value={item.assignedRole}
            onChange={(e) => update(i, { assignedRole: e.target.value })}
            placeholder="Role"
            className="text-xs w-24"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-red-400 hover:text-red-600"
            data-ocid={`handover.action_item.delete.${i + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="gap-1 border-amber-300 text-amber-700 bg-white"
        onClick={add}
        data-ocid="handover.add_action_button"
      >
        <Plus className="w-3 h-3" /> Add Action Item
      </Button>
    </div>
  );
}

// ── Pending Tasks Editor ───────────────────────────────────────────────────────

function PendingTasksEditor({
  tasks,
  onChange,
}: { tasks: PendingTask[]; onChange: (t: PendingTask[]) => void }) {
  function add() {
    onChange([
      ...tasks,
      {
        id: `pt_${Date.now()}`,
        taskName: "",
        taskType: "investigation",
        orderedBy: "",
        dateOrdered: format(new Date(), "yyyy-MM-dd"),
        status: "Pending",
      },
    ]);
  }
  function update(idx: number, patch: Partial<PendingTask>) {
    const next = [...tasks];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(tasks.filter((_, i) => i !== idx));
  }

  const typeColors: Record<PendingTask["taskType"], string> = {
    investigation: "bg-amber-50 text-amber-700 border-amber-200",
    procedure: "bg-blue-50 text-blue-700 border-blue-200",
    medication: "bg-teal-50 text-teal-700 border-teal-200",
    missed_dose: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <div
          key={task.id}
          className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center rounded-lg border px-3 py-2 ${typeColors[task.taskType]} ${(task as PendingTask).carriedOver ? "border-l-4 border-l-orange-500" : ""}`}
        >
          {(task as PendingTask).carriedOver && (
            <div className="col-span-full flex items-center gap-1 text-[10px] font-bold text-orange-700 mb-1">
              <span>🔄 CARRIED OVER</span>
              {(task as PendingTask).originalShift && (
                <span className="font-normal text-orange-600">
                  from {(task as PendingTask).originalShift} shift
                </span>
              )}
            </div>
          )}
          <Input
            value={task.taskName}
            onChange={(e) => update(i, { taskName: e.target.value })}
            placeholder="Task name"
            className="text-sm border-0 shadow-none p-0 h-auto focus-visible:ring-0 bg-transparent"
            data-ocid={`handover.pending_task.${i + 1}`}
          />
          <select
            value={task.taskType}
            onChange={(e) =>
              update(i, { taskType: e.target.value as PendingTask["taskType"] })
            }
            className="text-xs border rounded px-2 py-1 bg-white"
          >
            <option value="investigation">Investigation</option>
            <option value="procedure">Procedure</option>
            <option value="medication">Medication</option>
            <option value="missed_dose">Missed Dose</option>
          </select>
          <Input
            value={task.orderedBy}
            onChange={(e) => update(i, { orderedBy: e.target.value })}
            placeholder="Ordered by"
            className="text-xs w-28 bg-white"
          />
          <input
            type="date"
            value={task.dateOrdered}
            onChange={(e) => update(i, { dateOrdered: e.target.value })}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-red-400 hover:text-red-600"
            data-ocid={`handover.pending_task.delete.${i + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="gap-1 border-teal-300 text-teal-700 bg-white"
        onClick={add}
        data-ocid="handover.add_pending_task_button"
      >
        <Plus className="w-3 h-3" /> Add Pending Task
      </Button>
    </div>
  );
}

// ── Vital Field ────────────────────────────────────────────────────────────────

function VitalField({
  label,
  unit,
  vkey,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  vkey: keyof HandoverVitals;
  value: string;
  onChange: (v: string) => void;
}) {
  const abnormal = isVitalAbnormal(vkey, value);
  return (
    <div>
      <Label className="text-xs text-gray-500">
        {label} <span className="font-bold text-gray-700">({unit})</span>
      </Label>
      <div className="relative mt-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className={`bg-white text-sm ${abnormal ? "border-red-400 bg-red-50 text-red-700 font-bold" : ""}`}
          data-ocid={`handover.vitals.${String(vkey)}`}
        />
        {abnormal && (
          <AlertTriangle className="absolute right-2 top-2 w-4 h-4 text-red-500" />
        )}
      </div>
    </div>
  );
}

// ── Handover Form (shared for Nurse + MO) ─────────────────────────────────────

interface HandoverFormProps {
  patientId: string;
  patientName: string;
  registerNumber: string;
  admissionDate: string;
  bedNumber: string;
  ward: string;
  department: string;
  primaryDiagnosis: string;
  secondaryDiagnoses: string[];
  comorbidities: string[];
  assignedConsultant: string;
  hospitalName?: string;
  type: HandoverType;
  currentUser: { name: string; role: string; email: string };
  viewerRole: StaffRole;
  latestVitals: Record<string, string> | null;
  activeMedications: Array<{
    drugName: string;
    dose: string;
    frequency: string;
  }>;
  trackedInvestigations: TrackedInvestigation[];
  activeDiagnoses: string[];
  latestPlan: string;
  existingDoc: HandoverDocument | null;
  onSaved: () => void;
  onCancel: () => void;
}

function HandoverForm({
  patientId,
  patientName,
  registerNumber,
  admissionDate,
  bedNumber,
  ward,
  department,
  primaryDiagnosis,
  secondaryDiagnoses,
  comorbidities,
  assignedConsultant,
  hospitalName,
  type,
  currentUser,
  latestVitals,
  activeMedications,
  trackedInvestigations,
  activeDiagnoses,
  latestPlan,
  existingDoc,
  onSaved,
  onCancel,
}: HandoverFormProps) {
  const isNurse = type === "nurse";
  const detectedShift = detectShift();
  const defaults = shiftDefaults(detectedShift);
  const admDate = admissionDate ? new Date(admissionDate) : null;
  const dayOfStay = admDate ? differenceInDays(new Date(), admDate) + 1 : 0;

  const pendingInvNames = trackedInvestigations
    .filter((i) => i.status === "ordered" || i.status === "sample_collected")
    .map(
      (i): PendingTask => ({
        id: `pi_${i.name}`,
        taskName: i.name,
        taskType: "investigation",
        orderedBy: "",
        dateOrdered: format(new Date(), "yyyy-MM-dd"),
        status:
          i.status === "sample_collected" ? "Sample Collected" : "Pending",
      }),
    );

  const medPendingTasks = activeMedications.map(
    (m, idx): PendingTask => ({
      id: `med_${idx}`,
      taskName: `${m.drugName} ${m.dose} ${m.frequency}`,
      taskType: "medication",
      orderedBy: "",
      dateOrdered: format(new Date(), "yyyy-MM-dd"),
      status: "Due",
    }),
  );

  // Section fields
  const [shiftLabel, setShiftLabel] = useState<HandoverShift>(
    existingDoc?.shiftLabel ?? detectedShift,
  );
  const [shiftStart, setShiftStart] = useState(
    existingDoc?.shiftStart ?? defaults.start,
  );
  const [shiftEnd, setShiftEnd] = useState(
    existingDoc?.shiftEnd ?? defaults.end,
  );

  const [givenByName, setGivenByName] = useState(
    existingDoc?.givenBy.name ?? currentUser.name,
  );
  const [givenByRole, setGivenByRole] = useState(
    existingDoc?.givenBy.role ?? currentUser.role,
  );

  const [bp, setBp] = useState(
    existingDoc?.vitals.bp ?? latestVitals?.bloodPressure ?? "",
  );
  const [pulse, setPulse] = useState(
    existingDoc?.vitals.pulse ?? latestVitals?.pulse ?? "",
  );
  const [temp, setTemp] = useState(
    existingDoc?.vitals.temp ?? latestVitals?.temperature ?? "",
  );
  const [spo2, setSpo2] = useState(
    existingDoc?.vitals.spo2 ?? latestVitals?.oxygenSaturation ?? "",
  );
  const [rr, setRr] = useState(
    existingDoc?.vitals.rr ?? latestVitals?.respiratoryRate ?? "",
  );
  const [weight, setWeight] = useState(
    existingDoc?.vitals.weight ?? latestVitals?.weight ?? "",
  );
  const [gcs, setGcs] = useState(existingDoc?.vitals.gcs ?? "");
  const [ioBalance, setIoBalance] = useState(
    existingDoc?.vitals.ioBalance ?? "",
  );
  const [hb, setHb] = useState(existingDoc?.vitals.hb ?? "");
  const [wbc, setWbc] = useState(existingDoc?.vitals.wbc ?? "");
  const [creatinine, setCreatinine] = useState(
    existingDoc?.vitals.creatinine ?? "",
  );
  const [sodium, setSodium] = useState(existingDoc?.vitals.sodium ?? "");
  const [potassium, setPotassium] = useState(
    existingDoc?.vitals.potassium ?? "",
  );
  const [glucose, setGlucose] = useState(existingDoc?.vitals.glucose ?? "");

  const mapValue = calcMAP(bp);

  const [moName, setMoName] = useState(existingDoc?.medicalOfficer ?? "");
  const [intern, setIntern] = useState(existingDoc?.internAssigned ?? "");
  const [teamNotes, setTeamNotes] = useState(
    existingDoc?.treatingTeamNotes ?? "",
  );

  const [diagPrimary, setDiagPrimary] = useState(
    existingDoc?.primaryDiagnosis ??
      primaryDiagnosis ??
      activeDiagnoses[0] ??
      "",
  );
  const [diagSecondary, setDiagSecondary] = useState(
    existingDoc?.secondaryDiagnoses ?? secondaryDiagnoses.join(", "),
  );
  const [diagComorb, setDiagComorb] = useState(
    existingDoc?.comorbidities ?? comorbidities.join(", "),
  );

  const [actionItems, setActionItems] = useState<ActionItem[]>(
    existingDoc?.actionItems ?? [],
  );
  // Carry over unfinished tasks from the most recent submitted handover
  const carriedOverTasks = useMemo((): PendingTask[] => {
    if (existingDoc) return []; // Don't carry over when editing an existing doc
    const allDocs = loadDocs(patientId);
    // Find the last submitted handover (most recent)
    const lastSubmitted = allDocs
      .filter((d) => d.status === "submitted")
      .sort(
        (a, b) =>
          new Date(b.submittedAt ?? b.createdAt).getTime() -
          new Date(a.submittedAt ?? a.createdAt).getTime(),
      )[0];
    if (!lastSubmitted) return [];
    const now = new Date();
    return lastSubmitted.pendingTasks
      .filter((t) => t.status !== "Completed" && t.status !== "Done")
      .map((t): PendingTask => {
        const originalDate =
          t.dateOrdered ??
          t.originalDate ??
          lastSubmitted.createdAt.split("T")[0];
        const ageMs = now.getTime() - new Date(originalDate).getTime();
        const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24));
        const ageLabel =
          ageDays === 0
            ? "today"
            : ageDays === 1
              ? "1 day ago"
              : `${ageDays} days ago`;
        return {
          ...t,
          id: `carried_${t.id}`,
          status: `Carried Over (from ${lastSubmitted.shiftLabel} shift, ${ageLabel})`,
          carriedOver: true,
          originalShift: lastSubmitted.shiftLabel,
          originalDate,
        };
      });
  }, [patientId, existingDoc]);

  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>(
    existingDoc?.pendingTasks ?? [
      ...carriedOverTasks,
      ...pendingInvNames,
      ...medPendingTasks,
    ],
  );

  const [handoverToName, setHandoverToName] = useState(
    existingDoc?.takenBy?.name ?? "",
  );
  const [handoverToEmail, setHandoverToEmail] = useState(
    existingDoc?.takenBy?.email ?? "",
  );
  const [handoverToRole, setHandoverToRole] = useState(
    existingDoc?.takenBy?.role ?? "",
  );

  const [moNotes, setMoNotes] = useState(
    existingDoc?.treatingTeamNotes ??
      (!isNurse
        ? [
            activeDiagnoses.length > 0
              ? `Diagnoses: ${activeDiagnoses.join(", ")}.`
              : "",
            latestPlan ? `Current plan: ${latestPlan}` : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        : ""),
  );

  function buildDoc(status: HandoverStatus): HandoverDocument {
    return {
      id: existingDoc?.id ?? `hov_${Date.now().toString(36)}`,
      patientId,
      type,
      status,
      hospitalName: hospitalName ?? "General Hospital",
      shiftLabel,
      shiftStart,
      shiftEnd,
      createdAt: existingDoc?.createdAt ?? new Date().toISOString(),
      submittedAt:
        status === "submitted" ? new Date().toISOString() : undefined,
      givenBy: {
        name: givenByName,
        role: givenByRole,
        time: format(new Date(), "HH:mm"),
      },
      takenBy: handoverToName
        ? {
            name: handoverToName,
            role: handoverToRole,
            email: handoverToEmail,
            time: "",
          }
        : existingDoc?.takenBy,
      patientName,
      registerNumber: registerNumber || "—",
      ageSex: "",
      bedNumber: bedNumber || "",
      wardName: ward || "",
      department: department || "",
      admissionDate: admissionDate || "",
      primaryDiagnosis: diagPrimary,
      secondaryDiagnoses: diagSecondary,
      comorbidities: diagComorb,
      dayOfStay,
      assignedConsultant: assignedConsultant || "",
      medicalOfficer: moName,
      internAssigned: intern,
      treatingTeamNotes: isNurse ? teamNotes : moNotes,
      vitals: {
        bp,
        pulse,
        temp,
        spo2,
        rr,
        weight,
        gcs,
        map: mapValue,
        ioBalance,
        hb,
        wbc,
        creatinine,
        sodium,
        potassium,
        glucose,
      },
      actionItems,
      pendingTasks,
      consultantComments: existingDoc?.consultantComments ?? [],
      appendedEntries: existingDoc?.appendedEntries ?? [],
    };
  }

  function save(submit: boolean) {
    const doc = buildDoc(submit ? "submitted" : "draft");
    const all = loadDocs(patientId);
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx >= 0) all[idx] = doc;
    else all.unshift(doc);
    saveDocs(patientId, all);
    toast.success(submit ? "Handover submitted and locked ✓" : "Draft saved");
    onSaved();
  }

  const accentBg = isNurse
    ? "bg-purple-50 border-purple-200"
    : "bg-blue-50 border-blue-200";
  const accentText = isNurse ? "text-purple-800" : "text-blue-800";
  const accentLabel = isNurse ? "text-purple-700" : "text-blue-700";
  const accentBtn = isNurse
    ? "bg-purple-600 hover:bg-purple-700"
    : "bg-blue-600 hover:bg-blue-700";
  const accentOutline = isNurse
    ? "border-purple-300 text-purple-700"
    : "border-blue-300 text-blue-700";

  return (
    <div
      className={`border rounded-none sm:rounded-xl overflow-hidden shadow-sm ${accentBg}`}
    >
      {/* Form header */}
      <div
        className={`px-5 py-4 border-b ${isNurse ? "border-purple-200 bg-purple-100" : "border-blue-200 bg-blue-100"}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3
            className={`font-bold text-base flex items-center gap-2 ${accentText}`}
          >
            {isNurse ? (
              <ClipboardList className="w-4 h-4" />
            ) : (
              <Stethoscope className="w-4 h-4" />
            )}
            {isNurse ? "Nurse Handover" : "Medical Officer Handover"} —{" "}
            {patientName}
          </h3>
          <ShiftEditor
            shift={shiftLabel}
            shiftStart={shiftStart}
            shiftEnd={shiftEnd}
            onChangeShift={setShiftLabel}
            onChangeStart={setShiftStart}
            onChangeEnd={setShiftEnd}
          />
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Section 1 – Header Info */}
        <div className="bg-gray-50 px-5 py-4 space-y-3">
          <SectionHeader
            color="bg-gray-100 text-gray-700 -mx-5 -mt-4 mb-3"
            title="Handover Header"
            icon={<Clock className="w-3.5 h-3.5" />}
          />
          {(() => {
            const CLINICAL_ROLES: StaffRole[] = [
              "consultant_doctor",
              "medical_officer",
              "intern_doctor",
              "nurse",
              "doctor",
            ];
            const allStaff: DoctorAccount[] = loadRegistry().filter(
              (s) => CLINICAL_ROLES.includes(s.role) && s.status === "approved",
            );
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className={`text-xs font-semibold ${accentLabel}`}>
                    HANDOVER GIVEN BY — Name
                  </Label>
                  <Input
                    value={givenByName}
                    onChange={(e) => setGivenByName(e.target.value)}
                    className="mt-1 bg-white"
                    data-ocid="handover.given_by_name"
                  />
                </div>
                <div>
                  <Label className={`text-xs font-semibold ${accentLabel}`}>
                    Role
                  </Label>
                  <Input
                    value={givenByRole}
                    onChange={(e) => setGivenByRole(e.target.value)}
                    className="mt-1 bg-white"
                    data-ocid="handover.given_by_role"
                  />
                </div>
                <div>
                  <Label className={`text-xs font-semibold ${accentLabel}`}>
                    HANDOVER TAKEN BY — Select Staff
                  </Label>
                  <select
                    value={handoverToEmail}
                    onChange={(e) => {
                      const email = e.target.value;
                      setHandoverToEmail(email);
                      if (!email) {
                        setHandoverToName("");
                        setHandoverToRole("");
                        return;
                      }
                      const staff = allStaff.find((s) => s.email === email);
                      if (staff) {
                        setHandoverToName(staff.name);
                        setHandoverToRole(
                          STAFF_ROLE_LABELS[staff.role] ?? staff.role,
                        );
                      }
                    }}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    data-ocid="handover.taken_by_select"
                  >
                    <option value="">— Select incoming staff —</option>
                    {allStaff.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.name} — {STAFF_ROLE_LABELS[s.role] ?? s.role}
                      </option>
                    ))}
                  </select>
                  {handoverToName && (
                    <p className="text-xs text-teal-600 mt-1 font-medium">
                      ✓ {handoverToName} ({handoverToRole})
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Section 2 – Patient ID (blue band) */}
        <div className="px-5 py-4 space-y-3 bg-blue-50/60">
          <SectionHeader
            color="bg-blue-600 text-white -mx-5 -mt-4 mb-3"
            title="Patient Identification"
            icon={<User className="w-3.5 h-3.5" />}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { label: "Patient Name", value: patientName },
              { label: "Register No.", value: registerNumber || "—" },
              {
                label: "Bed / Ward",
                value: `${bedNumber || "—"}${ward ? ` / ${ward}` : ""}`,
              },
              { label: "Department", value: department || "—" },
              {
                label: "Admission Date",
                value: admissionDate
                  ? format(new Date(admissionDate), "dd MMM yyyy")
                  : "—",
              },
              {
                label: "Day of Stay",
                value: dayOfStay > 0 ? `Day ${dayOfStay}` : "—",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-white rounded-lg border border-blue-100 px-3 py-2"
              >
                <p className="text-xs text-blue-500 font-medium">{label}</p>
                <p className="font-semibold text-gray-800 text-sm mt-0.5">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3 – Diagnosis (green band) */}
        <div className="px-5 py-4 space-y-3 bg-green-50/60">
          <SectionHeader
            color="bg-green-600 text-white -mx-5 -mt-4 mb-3"
            title="Diagnosis & Day of Stay"
            icon={<ClipboardList className="w-3.5 h-3.5" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-green-700">
                Primary Diagnosis
              </Label>
              <Input
                value={diagPrimary}
                onChange={(e) => setDiagPrimary(e.target.value)}
                className="mt-1 bg-white"
                data-ocid="handover.primary_diagnosis"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-green-700">
                Secondary Diagnoses
              </Label>
              <Input
                value={diagSecondary}
                onChange={(e) => setDiagSecondary(e.target.value)}
                placeholder="Comma separated"
                className="mt-1 bg-white"
                data-ocid="handover.secondary_diagnoses"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-green-700">
                Comorbidities
              </Label>
              <Input
                value={diagComorb}
                onChange={(e) => setDiagComorb(e.target.value)}
                placeholder="HTN, DM2, CKD..."
                className="mt-1 bg-white"
                data-ocid="handover.comorbidities"
              />
            </div>
          </div>
        </div>

        {/* Section 4 – Consultant/Team (purple band) */}
        <div className="px-5 py-4 space-y-3 bg-purple-50/60">
          <SectionHeader
            color="bg-purple-600 text-white -mx-5 -mt-4 mb-3"
            title="Current Consultant / Team"
            icon={<Stethoscope className="w-3.5 h-3.5" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-purple-700">
                Assigned Consultant
              </Label>
              <Input
                value={assignedConsultant || ""}
                readOnly
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-purple-700">
                Medical Officer on Duty
              </Label>
              <Input
                value={moName}
                onChange={(e) => setMoName(e.target.value)}
                className="mt-1 bg-white"
                data-ocid="handover.mo_name"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-purple-700">
                Intern Assigned
              </Label>
              <Input
                value={intern}
                onChange={(e) => setIntern(e.target.value)}
                className="mt-1 bg-white"
                data-ocid="handover.intern_name"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-purple-700">
                Treating Team Notes
              </Label>
              <Textarea
                value={isNurse ? teamNotes : moNotes}
                onChange={(e) =>
                  isNurse
                    ? setTeamNotes(e.target.value)
                    : setMoNotes(e.target.value)
                }
                rows={2}
                className="mt-1 bg-white border-purple-200"
                data-ocid="handover.team_notes"
              />
            </div>
          </div>
        </div>

        {/* Section 5 – Vitals (rose band) */}
        <div className="px-5 py-4 space-y-4 bg-rose-50/60">
          <SectionHeader
            color="bg-rose-600 text-white -mx-5 -mt-4 mb-3"
            title="Clinical Summary & Vital Signs"
            icon={<Bell className="w-3.5 h-3.5" />}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <VitalField
              label="BP"
              unit="mmHg"
              vkey="bp"
              value={bp}
              onChange={setBp}
            />
            <VitalField
              label="Pulse"
              unit="beats/min"
              vkey="pulse"
              value={pulse}
              onChange={setPulse}
            />
            <VitalField
              label="Temp"
              unit="°C"
              vkey="temp"
              value={temp}
              onChange={setTemp}
            />
            <VitalField
              label="SpO₂"
              unit="%"
              vkey="spo2"
              value={spo2}
              onChange={setSpo2}
            />
            <VitalField
              label="RR"
              unit="breaths/min"
              vkey="rr"
              value={rr}
              onChange={setRr}
            />
            <VitalField
              label="Weight"
              unit="kg"
              vkey="weight"
              value={weight}
              onChange={setWeight}
            />
            <VitalField
              label="GCS"
              unit="/15"
              vkey="gcs"
              value={gcs}
              onChange={setGcs}
            />
            <div>
              <Label className="text-xs text-gray-500">
                MAP <span className="font-bold text-gray-700">(mmHg)</span>
              </Label>
              <div
                className={`mt-1 border rounded-md px-3 py-2 text-sm font-bold ${mapValue && Number.parseInt(mapValue) < 65 ? "bg-red-50 border-red-400 text-red-700" : "bg-gray-50 border-gray-200 text-gray-700"}`}
              >
                {mapValue || "—"}{" "}
                {mapValue && Number.parseInt(mapValue) < 65 && (
                  <span className="text-red-500 text-xs">⚠ Low</span>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-rose-700">
              24h I/O Balance Summary
            </Label>
            <Input
              value={ioBalance}
              onChange={(e) => setIoBalance(e.target.value)}
              placeholder="e.g. Intake 2400ml / Output 1800ml / Balance +600ml"
              className="mt-1 bg-white"
              data-ocid="handover.io_balance"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-rose-700 mb-2 block">
              Key Lab Values
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Hb", unit: "g/dL", value: hb, set: setHb },
                { label: "WBC", unit: "×10³/µL", value: wbc, set: setWbc },
                {
                  label: "Creatinine",
                  unit: "mg/dL",
                  value: creatinine,
                  set: setCreatinine,
                },
                { label: "Na⁺", unit: "mEq/L", value: sodium, set: setSodium },
                {
                  label: "K⁺",
                  unit: "mEq/L",
                  value: potassium,
                  set: setPotassium,
                },
                {
                  label: "Glucose",
                  unit: "mmol/L",
                  value: glucose,
                  set: setGlucose,
                },
              ].map(({ label, unit, value, set }) => (
                <div key={label}>
                  <Label className="text-xs text-gray-500">
                    {label}{" "}
                    <span className="font-bold text-gray-600">({unit})</span>
                  </Label>
                  <Input
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={label}
                    className="mt-1 bg-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 6 – Actionable Items (amber band) */}
        <div className="px-5 py-4 space-y-3 bg-amber-50/60">
          <SectionHeader
            color="bg-amber-500 text-white -mx-5 -mt-4 mb-3"
            title="Actionable Items"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          />
          <ActionItemsEditor items={actionItems} onChange={setActionItems} />
        </div>

        {/* Section 7 – Tasks Pending (teal band) */}
        <div className="px-5 py-4 space-y-3 bg-teal-50/60">
          <SectionHeader
            color="bg-teal-600 text-white -mx-5 -mt-4 mb-3"
            title="Tasks Pending"
            icon={<ClipboardList className="w-3.5 h-3.5" />}
          />
          <PendingTasksEditor tasks={pendingTasks} onChange={setPendingTasks} />
        </div>
      </div>

      {/* Footer actions */}
      <div
        className={`px-5 py-4 flex gap-2 border-t ${isNurse ? "border-purple-200 bg-purple-50" : "border-blue-200 bg-blue-50"}`}
      >
        <Button
          size="sm"
          variant="outline"
          className={accentOutline}
          onClick={() => save(false)}
          data-ocid="handover.save_draft_button"
        >
          Save Draft
        </Button>
        <Button
          size="sm"
          className={`${accentBtn} text-white gap-1.5`}
          onClick={() => save(true)}
          data-ocid="handover.submit_button"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Submit Handover
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="ml-auto text-gray-500"
          data-ocid="handover.cancel_button"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Accept & Take Over Form ────────────────────────────────────────────────────

interface TakeOverFormProps {
  doc: HandoverDocument;
  currentUser: { name: string; role: string; email: string };
  onSaved: () => void;
  onCancel: () => void;
}

function TakeOverForm({
  doc,
  currentUser,
  onSaved,
  onCancel,
}: TakeOverFormProps) {
  const CLINICAL_ROLES: StaffRole[] = [
    "consultant_doctor",
    "medical_officer",
    "intern_doctor",
    "nurse",
    "doctor",
  ];
  const allStaff: DoctorAccount[] = loadRegistry().filter(
    (s) => CLINICAL_ROLES.includes(s.role) && s.status === "approved",
  );

  const [takenByEmail, setTakenByEmail] = useState(currentUser.email);
  const [takenByName, setTakenByName] = useState(currentUser.name);
  const [takenByRole, setTakenByRole] = useState(currentUser.role);
  const [additionalWork, setAdditionalWork] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  function save() {
    if (!takenByName.trim()) {
      toast.error("Please select the staff taking over");
      return;
    }
    const appended: AppendedEntry = {
      id: `app_${Date.now().toString(36)}`,
      takenBy: {
        name: takenByName,
        role: takenByRole,
        email: takenByEmail,
        time: format(new Date(), "HH:mm"),
      },
      additionalWork,
      actionItems,
      createdAt: new Date().toISOString(),
    };
    const all = loadDocs(doc.patientId);
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      all[idx].takenBy = {
        name: takenByName,
        role: takenByRole,
        email: takenByEmail,
        time: format(new Date(), "HH:mm"),
      };
      all[idx].appendedEntries = [
        ...(all[idx].appendedEntries ?? []),
        appended,
      ];
    }
    saveDocs(doc.patientId, all);
    toast.success("Handover accepted — your additions appended ✓");
    onSaved();
  }

  return (
    <div className="border rounded-xl bg-teal-50 border-teal-200 overflow-hidden">
      <div className="px-5 py-3 bg-teal-100 border-b border-teal-200">
        <h3 className="font-bold text-teal-800 flex items-center gap-2">
          <UserCheck className="w-4 h-4" /> Accept & Take Over Handover
        </h3>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div>
          <Label className="text-xs font-semibold text-teal-700">
            Select Staff Taking Over
          </Label>
          <select
            value={takenByEmail}
            onChange={(e) => {
              const email = e.target.value;
              setTakenByEmail(email);
              const staff = allStaff.find((s) => s.email === email);
              if (staff) {
                setTakenByName(staff.name);
                setTakenByRole(STAFF_ROLE_LABELS[staff.role] ?? staff.role);
              }
            }}
            className="mt-1 w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white"
            data-ocid="handover.takeover_select"
          >
            <option value="">— Select staff —</option>
            {allStaff.map((s) => (
              <option key={s.id} value={s.email}>
                {s.name} — {STAFF_ROLE_LABELS[s.role] ?? s.role}
              </option>
            ))}
          </select>
          {takenByName && (
            <p className="text-xs text-teal-600 mt-1 font-medium">
              ✓ {takenByName} ({takenByRole})
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs font-semibold text-teal-700 mb-1 block">
            New Work / Additional Notes for This Shift
          </Label>
          <Textarea
            value={additionalWork}
            onChange={(e) => setAdditionalWork(e.target.value)}
            rows={3}
            className="bg-white border-teal-200"
            placeholder="Any additional care instructions or new work for this shift..."
            data-ocid="handover.takeover_notes"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-teal-700 mb-2 block">
            New Action Items for This Shift
          </Label>
          <ActionItemsEditor items={actionItems} onChange={setActionItems} />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            onClick={save}
            data-ocid="handover.takeover_submit_button"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Add My Entries
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="text-gray-500"
            data-ocid="handover.takeover_cancel_button"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Handover Document View ─────────────────────────────────────────────────────

interface DocViewProps {
  doc: HandoverDocument;
  currentUser: { name: string; role: string; email: string };
  viewerRole: StaffRole;
  unreadCommentIds: string[];
  onMarkCommentRead: (cid: string) => void;
  onSaved: () => void;
}

function DocView({
  doc,
  currentUser,
  viewerRole,
  unreadCommentIds,
  onMarkCommentRead,
  onSaved,
}: DocViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTakeOver, setShowTakeOver] = useState(false);
  const [commentText, setCommentText] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const isConsultant =
    viewerRole === "consultant_doctor" || viewerRole === "doctor";
  const isNurse = viewerRole === "nurse";

  const unreadInThisDoc = doc.consultantComments.filter((c) =>
    unreadCommentIds.includes(c.id),
  );
  const hasUnread = unreadInThisDoc.length > 0;

  function submitComment() {
    if (!commentText.trim()) return;
    const newComment: ConsultantComment = {
      id: `cc_${Date.now().toString(36)}`,
      comment: commentText.trim(),
      commentBy: currentUser.name,
      commentByRole: viewerRole,
      commentAt: new Date().toISOString(),
    };
    const all = loadDocs(doc.patientId);
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      all[idx].consultantComments = [
        ...(all[idx].consultantComments ?? []),
        newComment,
      ];
      saveDocs(doc.patientId, all);

      // Notify all users via localStorage unread tracking
      // We store the comment as "unread" for all non-consultant users viewing this patient
      const globalKey = "handover_new_comments_global";
      try {
        const existing = JSON.parse(
          localStorage.getItem(globalKey) ?? "[]",
        ) as string[];
        existing.push(newComment.id);
        localStorage.setItem(globalKey, JSON.stringify(existing));
      } catch {}
    }
    toast.success("Comment saved — nurse/MO will be notified");
    setCommentText("");
    onSaved();
  }

  function handlePrint() {
    window.print();
  }

  function vitalDisplay(
    label: string,
    value: string,
    unit: string,
    vkey: keyof HandoverVitals,
  ) {
    const abnormal = isVitalAbnormal(vkey, value);
    return (
      <div
        key={label}
        className={`rounded-lg border p-2.5 text-center ${abnormal ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}
      >
        <p className="text-xs text-gray-400">{label}</p>
        <p
          className={`font-bold text-sm ${abnormal ? "text-red-700" : "text-gray-800"}`}
        >
          {value || "—"}{" "}
          {abnormal && (
            <AlertTriangle className="inline w-3 h-3 text-red-500" />
          )}
        </p>
        <p className="text-xs font-bold text-gray-500">{unit}</p>
      </div>
    );
  }

  const typeColor =
    doc.type === "nurse"
      ? "border-purple-200 bg-white"
      : "border-blue-200 bg-white";
  const headerColor = doc.type === "nurse" ? "bg-purple-50" : "bg-blue-50";

  return (
    <div
      className={`rounded-xl border shadow-sm overflow-hidden ${typeColor} print-handover`}
      data-ocid="handover.record_item"
      ref={printRef}
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && hasUnread) {
            for (const c of unreadInThisDoc) {
              onMarkCommentRead(c.id);
            }
          }
        }}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${headerColor} hover:opacity-90`}
        data-ocid="handover.record_toggle"
      >
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${doc.type === "nurse" ? "bg-purple-100 text-purple-800 border-purple-300" : "bg-blue-100 text-blue-800 border-blue-300"}`}
          >
            {doc.type === "nurse" ? "🩺 Nurse" : "👨‍⚕️ MO"}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${shiftBadgeCls(doc.shiftLabel)}`}
          >
            {shiftEmoji(doc.shiftLabel)} {doc.shiftLabel} · {doc.shiftStart}–
            {doc.shiftEnd}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {format(new Date(doc.createdAt), "dd MMM yyyy — HH:mm")}
          </span>
          <span className="text-xs text-gray-500">by {doc.givenBy.name}</span>
          {doc.takenBy?.name && (
            <span className="text-xs text-teal-600 font-medium">
              → Taken by {doc.takenBy.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasUnread && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 animate-pulse">
              <BellRing className="w-3 h-3" /> {unreadInThisDoc.length} New
              Comment{unreadInThisDoc.length > 1 ? "s" : ""}
            </span>
          )}
          {doc.status === "submitted" ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
              <Lock className="w-3 h-3" /> Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              <Clock className="w-3 h-3" /> Draft
            </span>
          )}
          {doc.consultantComments.length > 0 && (
            <Badge
              variant="outline"
              className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
            >
              {doc.consultantComments.length} comment
              {doc.consultantComments.length > 1 ? "s" : ""}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {/* Print + Take Over actions */}
          <div className="px-4 py-2 bg-gray-50 flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs border-gray-200"
              onClick={handlePrint}
              data-ocid="handover.print_button"
            >
              <Printer className="w-3 h-3" /> Print Handover
            </Button>
            {doc.status === "submitted" &&
              (isNurse || viewerRole === "medical_officer") &&
              !doc.takenBy?.name && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs border-teal-300 text-teal-700"
                  onClick={() => setShowTakeOver(!showTakeOver)}
                  data-ocid="handover.takeover_button"
                >
                  <UserCheck className="w-3 h-3" /> Accept & Take Over
                </Button>
              )}
          </div>

          {/* Take Over Form */}
          {showTakeOver && (
            <div className="p-4">
              <TakeOverForm
                doc={doc}
                currentUser={currentUser}
                onSaved={() => {
                  setShowTakeOver(false);
                  onSaved();
                }}
                onCancel={() => setShowTakeOver(false)}
              />
            </div>
          )}

          {/* Section 2 – Patient ID (blue) */}
          <div className="bg-blue-50/50">
            <SectionHeader
              color="bg-blue-600 text-white"
              title="Patient Identification"
              icon={<User className="w-3.5 h-3.5" />}
            />
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Patient Name", value: doc.patientName },
                { label: "Register No.", value: doc.registerNumber },
                {
                  label: "Bed / Ward",
                  value: `${doc.bedNumber}${doc.wardName ? ` / ${doc.wardName}` : ""}`,
                },
                { label: "Department", value: doc.department || "—" },
                {
                  label: "Admission Date",
                  value: doc.admissionDate
                    ? format(new Date(doc.admissionDate), "dd MMM yyyy")
                    : "—",
                },
                {
                  label: "Day of Stay",
                  value: doc.dayOfStay > 0 ? `Day ${doc.dayOfStay}` : "—",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-white rounded-lg border border-blue-100 px-3 py-2"
                >
                  <p className="text-xs text-blue-500 font-medium">{label}</p>
                  <p className="font-semibold text-sm text-gray-800">
                    {value || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 – Diagnosis (green) */}
          <div className="bg-green-50/50">
            <SectionHeader
              color="bg-green-600 text-white"
              title="Diagnosis & Day of Stay"
              icon={<ClipboardList className="w-3.5 h-3.5" />}
            />
            <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-lg border border-green-100 px-3 py-2">
                <p className="text-xs text-green-600 font-medium">
                  Primary Diagnosis
                </p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {doc.primaryDiagnosis || "—"}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-green-100 px-3 py-2">
                <p className="text-xs text-green-600 font-medium">
                  Secondary Diagnoses
                </p>
                <p className="text-gray-700 mt-0.5 text-sm">
                  {doc.secondaryDiagnoses || "—"}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-green-100 px-3 py-2">
                <p className="text-xs text-green-600 font-medium">
                  Comorbidities
                </p>
                <p className="text-gray-700 mt-0.5 text-sm">
                  {doc.comorbidities || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4 – Consultant/Team (purple) */}
          <div className="bg-purple-50/50">
            <SectionHeader
              color="bg-purple-600 text-white"
              title="Current Consultant / Team"
              icon={<Stethoscope className="w-3.5 h-3.5" />}
            />
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {[
                { label: "Assigned Consultant", value: doc.assignedConsultant },
                { label: "Medical Officer", value: doc.medicalOfficer },
                { label: "Intern Assigned", value: doc.internAssigned },
                { label: "Team Notes", value: doc.treatingTeamNotes },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-white rounded-lg border border-purple-100 px-3 py-2"
                >
                  <p className="text-xs text-purple-500 font-medium">{label}</p>
                  <p className="font-medium text-gray-800 text-sm mt-0.5 whitespace-pre-line">
                    {value || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5 – Vitals (rose) */}
          <div className="bg-rose-50/50">
            <SectionHeader
              color="bg-rose-600 text-white"
              title="Clinical Summary & Vital Signs"
              icon={<Bell className="w-3.5 h-3.5" />}
            />
            <div className="px-4 py-3 space-y-3">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {vitalDisplay("BP", doc.vitals.bp, "mmHg", "bp")}
                {vitalDisplay("Pulse", doc.vitals.pulse, "bpm", "pulse")}
                {vitalDisplay("Temp", doc.vitals.temp, "°C", "temp")}
                {vitalDisplay("SpO₂", doc.vitals.spo2, "%", "spo2")}
                {vitalDisplay("RR", doc.vitals.rr, "b/min", "rr")}
                {doc.vitals.weight &&
                  vitalDisplay("Weight", doc.vitals.weight, "kg", "weight")}
                {doc.vitals.gcs &&
                  vitalDisplay("GCS", doc.vitals.gcs, "/15", "gcs")}
                {doc.vitals.map && (
                  <div
                    className={`rounded-lg border p-2.5 text-center ${Number.parseInt(doc.vitals.map) < 65 ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}
                  >
                    <p className="text-xs text-gray-400">MAP</p>
                    <p
                      className={`font-bold text-sm ${Number.parseInt(doc.vitals.map) < 65 ? "text-red-700" : "text-gray-800"}`}
                    >
                      {doc.vitals.map}{" "}
                      <span className="font-normal text-xs text-gray-500">
                        mmHg
                      </span>
                    </p>
                    <p className="text-xs font-bold text-gray-500">auto</p>
                  </div>
                )}
              </div>
              {doc.vitals.ioBalance && (
                <div className="bg-white rounded-lg border border-rose-100 px-3 py-2 text-sm">
                  <span className="text-xs text-rose-500 font-medium">
                    24h I/O Balance:{" "}
                  </span>
                  <span className="text-gray-700">{doc.vitals.ioBalance}</span>
                </div>
              )}
              {(doc.vitals.hb ||
                doc.vitals.wbc ||
                doc.vitals.creatinine ||
                doc.vitals.sodium ||
                doc.vitals.potassium ||
                doc.vitals.glucose) && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: "Hb", value: doc.vitals.hb, unit: "g/dL" },
                    { label: "WBC", value: doc.vitals.wbc, unit: "×10³" },
                    {
                      label: "Cr",
                      value: doc.vitals.creatinine,
                      unit: "mg/dL",
                    },
                    { label: "Na⁺", value: doc.vitals.sodium, unit: "mEq/L" },
                    { label: "K⁺", value: doc.vitals.potassium, unit: "mEq/L" },
                    { label: "Glu", value: doc.vitals.glucose, unit: "mmol/L" },
                  ]
                    .filter((x) => x.value)
                    .map(({ label, value, unit }) => (
                      <div
                        key={label}
                        className="bg-white rounded-lg border border-rose-100 p-2 text-center"
                      >
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="font-bold text-sm text-gray-800">
                          {value}
                        </p>
                        <p className="text-xs text-gray-400">{unit}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 6 – Actionable Items (amber) */}
          {doc.actionItems.length > 0 && (
            <div className="bg-amber-50/50">
              <SectionHeader
                color="bg-amber-500 text-white"
                title="Actionable Items"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              />
              <div className="px-4 py-3 space-y-2">
                {doc.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${item.priority === "Urgent" ? "bg-red-50 border-red-200" : "bg-white border-amber-100"}`}
                  >
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded border mt-0.5 ${item.priority === "Urgent" ? "bg-red-100 text-red-700 border-red-300" : "bg-green-100 text-green-700 border-green-300"}`}
                    >
                      {item.priority === "Urgent" ? "🔴" : "🟢"} {item.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {item.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Due: {item.dueTime || "—"} · Assigned to:{" "}
                        {item.assignedRole || "—"}
                      </p>
                    </div>
                    {item.done && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 7 – Pending Tasks (teal) */}
          {doc.pendingTasks.length > 0 && (
            <div className="bg-teal-50/50">
              <SectionHeader
                color="bg-teal-600 text-white"
                title="Tasks Pending"
                icon={<ClipboardList className="w-3.5 h-3.5" />}
              />
              <div className="px-4 py-3 overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-teal-100">
                      <th className="text-left py-1.5 pr-3 font-semibold">
                        Task
                      </th>
                      <th className="text-left py-1.5 pr-3 font-semibold">
                        Type
                      </th>
                      <th className="text-left py-1.5 pr-3 font-semibold">
                        Ordered By
                      </th>
                      <th className="text-left py-1.5 pr-3 font-semibold">
                        Date
                      </th>
                      <th className="text-left py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {doc.pendingTasks.map((task, i) => {
                      const typeBadge: Record<PendingTask["taskType"], string> =
                        {
                          investigation:
                            "bg-amber-50 text-amber-700 border-amber-200",
                          procedure: "bg-blue-50 text-blue-700 border-blue-200",
                          medication:
                            "bg-teal-50 text-teal-700 border-teal-200",
                          missed_dose: "bg-red-50 text-red-700 border-red-200",
                        };
                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-teal-50/30"
                          data-ocid={`handover.pending_task_row.${i + 1}`}
                        >
                          <td className="py-2 pr-3 font-medium text-gray-800">
                            {task.taskName}
                            {task.carriedOver && (
                              <span className="ml-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1">
                                🔄 Carried Over
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded border ${typeBadge[task.taskType]}`}
                            >
                              {task.taskType.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-gray-500">
                            {task.orderedBy || "—"}
                          </td>
                          <td className="py-2 pr-3 text-gray-500">
                            {task.dateOrdered
                              ? format(new Date(task.dateOrdered), "dd MMM")
                              : "—"}
                          </td>
                          <td className="py-2 text-gray-600">{task.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Appended entries (incoming nurse additions) */}
          {doc.appendedEntries?.map((app) => (
            <div
              key={app.id}
              className="bg-teal-50/40 border-l-4 border-teal-400"
            >
              <div className="px-4 py-2 flex items-center gap-2 bg-teal-100">
                <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                <span className="text-xs font-bold text-teal-800">
                  Taken over by {app.takenBy.name} ({app.takenBy.role}) at{" "}
                  {app.takenBy.time} —{" "}
                  {format(new Date(app.createdAt), "dd MMM yyyy")}
                </span>
              </div>
              {app.additionalWork && (
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    New Work / Notes
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {app.additionalWork}
                  </p>
                </div>
              )}
              {app.actionItems.length > 0 && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Additional Action Items
                  </p>
                  {app.actionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${item.priority === "Urgent" ? "bg-red-50 border-red-200" : "bg-white border-teal-100"}`}
                    >
                      <span className="text-xs font-bold">
                        {item.priority === "Urgent" ? "🔴" : "🟢"}{" "}
                        {item.priority}
                      </span>
                      <p className="text-sm flex-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Section 8 – Consultant Comments (indigo) */}
          <div
            className={`${doc.consultantComments.length > 0 || isConsultant ? "bg-indigo-50/50" : ""}`}
          >
            {(doc.consultantComments.length > 0 || isConsultant) && (
              <SectionHeader
                color="bg-indigo-600 text-white"
                title="Consultant Comments"
                icon={<MessageSquare className="w-3.5 h-3.5" />}
              />
            )}
            <div className="px-4 py-3 space-y-3">
              {doc.consultantComments.map((c) => {
                const isUnread = unreadCommentIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-4 transition-all ${isUnread ? "bg-red-50 border-red-300 shadow-sm" : "bg-indigo-50 border-indigo-200"}`}
                    data-ocid="handover.consultant_comment"
                  >
                    {isUnread && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <BellRing className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-bold text-red-600 uppercase">
                          New Comment
                        </span>
                        <button
                          type="button"
                          onClick={() => onMarkCommentRead(c.id)}
                          className="ml-auto text-xs text-red-500 hover:underline"
                        >
                          Mark as read
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-800">
                        {c.commentBy}
                      </span>
                      <span className="text-xs text-gray-400">
                        (
                        {STAFF_ROLE_LABELS[
                          c.commentByRole as keyof typeof STAFF_ROLE_LABELS
                        ] ?? c.commentByRole}
                        )
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {format(new Date(c.commentAt), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {c.comment}
                    </p>
                  </div>
                );
              })}

              {isConsultant && doc.status === "submitted" && (
                <div className="flex gap-2 pt-1">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a consultant comment — nurse/MO will be notified with an alarm..."
                    rows={2}
                    className="flex-1 bg-white border-indigo-200 text-sm"
                    data-ocid="handover.add_comment_input"
                  />
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 self-end"
                    onClick={submitComment}
                    data-ocid="handover.add_comment_button"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comment
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Submission footer with Acknowledgment */}
          {doc.status === "submitted" && doc.submittedAt && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-400">
                ✅ Submitted at{" "}
                {format(new Date(doc.submittedAt), "dd MMM yyyy, HH:mm")} by{" "}
                {doc.givenBy.name}
                {doc.takenBy?.name &&
                  ` · Assigned to: ${doc.takenBy.name} (${doc.takenBy.role})`}
              </p>

              {/* Acknowledgment section */}
              {doc.takenBy?.name && (
                <div>
                  {doc.takenBy.acknowledgedAt ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-xs font-semibold text-green-700">
                        Acknowledged by{" "}
                        {doc.takenBy.acknowledgedByName ?? doc.takenBy.name} at{" "}
                        {format(
                          new Date(doc.takenBy.acknowledgedAt),
                          "dd MMM yyyy, HH:mm",
                        )}
                      </span>
                    </div>
                  ) : currentUser.email === doc.takenBy.email ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      onClick={() => {
                        const all = loadDocs(doc.patientId);
                        const idx = all.findIndex((d) => d.id === doc.id);
                        if (idx >= 0 && all[idx].takenBy) {
                          const acknowledgedAt = new Date().toISOString();
                          all[idx].takenBy = {
                            ...all[idx].takenBy!,
                            acknowledgedAt,
                            acknowledgedBy: currentUser.email,
                            acknowledgedByName: currentUser.name,
                            acknowledgedRole: currentUser.role,
                          };
                          saveDocs(doc.patientId, all);
                          // Write audit log entry
                          try {
                            const auditKey = "medicare_audit_log";
                            const auditLog = JSON.parse(
                              localStorage.getItem(auditKey) ?? "[]",
                            ) as Array<{
                              id: string;
                              action: string;
                              entityType: string;
                              entityId: string;
                              performedBy: string;
                              performedByRole: string;
                              timestamp: string;
                              details: string;
                            }>;
                            auditLog.unshift({
                              id: `audit_${Date.now().toString(36)}`,
                              action: "handover_acknowledged",
                              entityType: "handover",
                              entityId: doc.id,
                              performedBy: currentUser.name,
                              performedByRole: currentUser.role,
                              timestamp: acknowledgedAt,
                              details: `Handover received by ${currentUser.name} (${currentUser.role}) for patient ${doc.patientName} — Shift: ${doc.shiftLabel} ${doc.shiftStart}–${doc.shiftEnd}`,
                            });
                            localStorage.setItem(
                              auditKey,
                              JSON.stringify(auditLog.slice(0, 500)),
                            );
                          } catch {}
                          toast.success("Handover acknowledged ✓");
                          onSaved();
                        }
                      }}
                      data-ocid="handover.acknowledge_button"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />I Have Received
                      This Handover
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-700">
                        Awaiting acknowledgment from{" "}
                        <span className="font-semibold">
                          {doc.takenBy.name}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main HandoverSystem ────────────────────────────────────────────────────────

export interface HandoverSystemProps {
  patientId: string;
  patientName: string;
  admissionDate?: string;
  bedNumber?: string;
  ward?: string;
  department?: string;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  comorbidities?: string[];
  assignedConsultant?: string;
  currentUser: { name: string; role: string; email: string };
  vitals?: Record<string, string>;
  pendingInvestigations?: unknown[];
  pendingProcedures?: unknown[];
  pendingMeds?: unknown[];
  // Legacy props for compatibility
  bed?: string;
  viewerRole?: StaffRole;
  authorName?: string;
  latestVitals?: Record<string, string> | null;
  activeMedications?: Array<{
    drugName: string;
    dose: string;
    frequency: string;
  }>;
  activeDiagnoses?: string[];
  latestPlan?: string;
}

export default function HandoverSystem({
  patientId,
  patientName,
  admissionDate,
  bedNumber,
  ward,
  department,
  primaryDiagnosis,
  secondaryDiagnoses = [],
  comorbidities = [],
  assignedConsultant,
  currentUser,
  vitals,
  // Legacy compat
  bed,
  viewerRole: viewerRoleProp,
  authorName,
  latestVitals,
  activeMedications = [],
  activeDiagnoses = [],
  latestPlan = "",
}: HandoverSystemProps) {
  const effectiveBed = bedNumber ?? bed ?? "";
  const effectiveVitals = vitals ?? latestVitals ?? null;
  const effectiveViewerRole: StaffRole =
    viewerRoleProp ?? (currentUser.role as StaffRole) ?? "nurse";
  const effectiveAuthorName = authorName ?? currentUser.name;

  const [docs, setDocs] = useState<HandoverDocument[]>(() =>
    loadDocs(patientId),
  );
  const [showForm, setShowForm] = useState<"nurse" | "mo" | null>(null);
  const [unreadCommentIds, setUnreadCommentIds] = useState<string[]>(() =>
    getUnreadCommentIds(currentUser.email),
  );

  const trackedInvestigations = useMemo(
    () => loadTrackedInvestigations(patientId),
    [patientId],
  );

  const isNurse = effectiveViewerRole === "nurse";
  const isMO = effectiveViewerRole === "medical_officer";
  const isConsultant =
    effectiveViewerRole === "consultant_doctor" ||
    effectiveViewerRole === "doctor";
  const isIntern = effectiveViewerRole === "intern_doctor";
  const canSeeHandovers = isNurse || isMO || isConsultant || isIntern;

  // Existing drafts
  const existingNurseDraft = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return (
      docs.find(
        (d) =>
          d.type === "nurse" &&
          d.status === "draft" &&
          d.givenBy.name === effectiveAuthorName &&
          format(new Date(d.createdAt), "yyyy-MM-dd") === today,
      ) ?? null
    );
  }, [docs, effectiveAuthorName]);

  const existingMODraft = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return (
      docs.find(
        (d) =>
          d.type === "mo" &&
          d.status === "draft" &&
          d.givenBy.name === effectiveAuthorName &&
          format(new Date(d.createdAt), "yyyy-MM-dd") === today,
      ) ?? null
    );
  }, [docs, effectiveAuthorName]);

  // Poll for new consultant comments every 15s
  const checkForNewComments = useCallback(() => {
    if (isConsultant) return; // Consultants don't receive their own notifications
    const globalKey = "handover_new_comments_global";
    try {
      const newCommentIds = JSON.parse(
        localStorage.getItem(globalKey) ?? "[]",
      ) as string[];
      if (newCommentIds.length === 0) return;

      // Find which are for this patient's handovers
      const allDocs = loadDocs(patientId);
      let foundNew = false;
      for (const doc of allDocs) {
        for (const c of doc.consultantComments ?? []) {
          if (
            newCommentIds.includes(c.id) &&
            !unreadCommentIds.includes(c.id)
          ) {
            addUnreadCommentId(currentUser.email, c.id);
            foundNew = true;
          }
        }
      }

      if (foundNew) {
        const updated = getUnreadCommentIds(currentUser.email);
        setUnreadCommentIds(updated);
        playAlarmTone();
        toast.error("⚠️ New consultant comment — please review handover!", {
          duration: 8000,
        });
        // Clear the global list after processing
        localStorage.removeItem(globalKey);
      }
    } catch {}
  }, [patientId, currentUser.email, isConsultant, unreadCommentIds]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    checkForNewComments();
    pollRef.current = setInterval(checkForNewComments, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkForNewComments]);

  // Also check on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") checkForNewComments();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [checkForNewComments]);

  function refresh() {
    setDocs(loadDocs(patientId));
    setShowForm(null);
  }

  function handleMarkCommentRead(cid: string) {
    markCommentRead(currentUser.email, cid);
    setUnreadCommentIds(getUnreadCommentIds(currentUser.email));
  }

  const unreadCount = unreadCommentIds.length;

  if (!canSeeHandovers) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-violet-100">
        <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          Handover records are visible to clinical staff only.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(.print-handover) { display: none !important; }
          .print-handover { display: block !important; }
          button, [data-ocid*="button"], [data-ocid*="input"] { display: none !important; }
        }
      `}</style>

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-violet-600" />
              Handover System
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse ml-1">
                  <BellRing className="w-3 h-3" /> {unreadCount} Unread
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Submitted handovers are locked and immutable. Consultant comments
              trigger an alarm notification.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isNurse && (
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                onClick={() =>
                  setShowForm(showForm === "nurse" ? null : "nurse")
                }
                data-ocid="handover.new_nurse_button"
              >
                <Plus className="w-3.5 h-3.5" />
                {existingNurseDraft ? "Edit Draft" : "New Handover"}
              </Button>
            )}
            {isMO && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                onClick={() => setShowForm(showForm === "mo" ? null : "mo")}
                data-ocid="handover.make_handover_button"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                {existingMODraft ? "Edit Draft" : "Make Handover"}
              </Button>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <HandoverForm
            patientId={patientId}
            patientName={patientName}
            registerNumber=""
            admissionDate={admissionDate ?? ""}
            bedNumber={effectiveBed}
            ward={ward ?? ""}
            department={department ?? ""}
            primaryDiagnosis={primaryDiagnosis ?? ""}
            secondaryDiagnoses={secondaryDiagnoses}
            comorbidities={comorbidities}
            assignedConsultant={assignedConsultant ?? ""}
            type={showForm}
            currentUser={currentUser}
            viewerRole={effectiveViewerRole}
            latestVitals={effectiveVitals}
            activeMedications={activeMedications}
            trackedInvestigations={trackedInvestigations}
            activeDiagnoses={activeDiagnoses}
            latestPlan={latestPlan}
            existingDoc={
              showForm === "nurse" ? existingNurseDraft : existingMODraft
            }
            onSaved={refresh}
            onCancel={() => setShowForm(null)}
          />
        )}

        {/* Document list */}
        <div className="space-y-3">
          {docs.length === 0 ? (
            <div
              className="text-center py-10 bg-white rounded-xl border border-violet-100"
              data-ocid="handover.empty_state"
            >
              <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500 mb-1">
                No handovers yet
              </p>
              <p className="text-xs text-gray-400">
                {isNurse
                  ? 'Click "New Handover" to create the first handover for this shift.'
                  : isMO
                    ? 'Click "Make Handover" to auto-generate an MO handover.'
                    : "Handovers will appear here once submitted by nursing or medical staff."}
              </p>
            </div>
          ) : (
            docs.map((doc) => (
              <DocView
                key={doc.id}
                doc={doc}
                currentUser={currentUser}
                viewerRole={effectiveViewerRole}
                unreadCommentIds={unreadCommentIds}
                onMarkCommentRead={handleMarkCommentRead}
                onSaved={refresh}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
