/**
 * DailyProgressNote — Role-gated SOAP note with Intern → MO → Consultant escalation.
 *
 * STATE MACHINE:
 *   Intern  : S + O tabs editable, A + P read-only. Submit = "intern_draft"
 *   MO      : All tabs editable; pre-fills intern S+O. Submit = "mo_reviewed"
 *   Consultant: All tabs editable, finalize = locked "finalized"
 *
 * Finalized notes are permanently read-only (every field shows a toast on click).
 * Auto-save to localStorage every 30s. Carries yesterday's data forward.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  BookTemplate,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  FlaskConical,
  History,
  Layers,
  Lock,
  MessageCircle,
  Pill,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Stethoscope,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRolePermissions } from "../hooks/useRolePermissions";
import type { NoteState } from "../pages/WardRound";
import { saveNoteState } from "../pages/WardRound";
import type { Prescription, StaffRole, VitalSigns } from "../types";
import { STAFF_ROLE_LABELS } from "../types";
import DrainMonitor from "./DrainMonitor";
import IOChart from "./IOChart";

// ── Types ───────────────────────────────────────────────────────────────────

type TrendIndicator = "↑ improving" | "↓ worsening" | "= same";
type DiagnosisClass = "Primary" | "Secondary" | "Comorbidity";
type AssessmentStatus = "Improving" | "Stable" | "Worsening";

interface ActiveComplaint {
  id: string;
  text: string;
  trend: TrendIndicator;
  resolved: boolean;
  durationValue?: string;
  durationUnit?: "hours" | "days" | "weeks" | "months";
}

interface ActiveDiagnosis {
  id: string;
  name: string;
  classification: DiagnosisClass;
  status: "active" | "resolved";
}

interface ROSSystem {
  name: string;
  reviewedNormal: boolean;
  findings: string;
}

interface ExamSystem {
  name: string;
  findings: string;
}

interface PlanItem {
  id: string;
  category: "drug" | "investigation" | "procedure" | "nursing";
  description: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  urgency?: "Routine" | "Urgent" | "STAT";
}

interface NoteVersion {
  version: number;
  authorName: string;
  authorRole: StaffRole;
  timestamp: string;
  state: NoteState;
  summary: string;
}

interface DailyNoteData {
  date: string;
  state: NoteState;
  rejectionReason?: string;
  consultantEditedFields?: string[];
  // Complaints
  activeComplaints: ActiveComplaint[];
  // Diagnoses
  activeDiagnoses: ActiveDiagnosis[];
  // Subjective
  chiefComplaintsToday: string;
  sameAsYesterday_S?: boolean;
  sleep: "Good" | "Fair" | "Poor" | "";
  appetite: "Normal" | "Reduced" | "Nil" | "";
  mobility: "Ambulant" | "Limited" | "Bedrest" | "";
  rosData: ROSSystem[];
  // Objective
  objectiveNotes: string;
  examSystems: ExamSystem[];
  sameAsYesterday_O?: boolean;
  // Assessment
  assessment: string;
  assessmentStatus: AssessmentStatus;
  clinicalTrend: "Improving" | "Stable" | "Deteriorating";
  // Plan
  planItems: PlanItem[];
  nursingInstructions: string[];
  targetDischargeDate?: string;
  dischargeCriteria: string[];
  referral: boolean;
  // Meta
  carryForwardDismissed: boolean;
  versions: NoteVersion[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROS_SYSTEMS = ["CVS", "Respiratory", "GI", "CNS", "GU"];
const EXAM_SYSTEMS = ["General", "CVS", "Respiratory", "Abdomen", "CNS"];
const COMPLAINT_CHIPS = [
  "Fever",
  "Pain",
  "Vomiting",
  "Cough",
  "SOB",
  "Dizziness",
  "Nausea",
  "Headache",
  "Weakness",
  "Diarrhea",
];

const NURSING_CHIPS = [
  "NPO",
  "IV access check",
  "Position change Q2h",
  "O₂ therapy",
  "Strict I&O",
  "Isolation precautions",
  "Monitor vitals Q4h",
  "Wound care",
];

const QUICK_TEMPLATES: Record<string, Partial<DailyNoteData>> = {
  "Pneumonia Day 1": {
    chiefComplaintsToday: "Fever, cough with sputum, SOB on exertion",
    assessmentStatus: "Stable",
    clinicalTrend: "Stable",
    assessment:
      "Pneumonia Day 1 — patient hemodynamically stable. Starting empirical antibiotics. Monitor SpO₂ closely.",
  },
  "Pneumonia Day 3": {
    chiefComplaintsToday: "Reducing fever, cough improving",
    assessmentStatus: "Improving",
    clinicalTrend: "Improving",
    assessment:
      "Pneumonia Day 3 — clinical improvement noted. Continue current antibiotics. Reassess in 48h.",
  },
  "Post-Op Day 1": {
    chiefComplaintsToday: "Pain at wound site, minimal nausea",
    assessmentStatus: "Stable",
    clinicalTrend: "Stable",
    assessment:
      "Post-operative Day 1. Wound intact, vitals stable. Continue IV antibiotics and analgesia.",
  },
  "Sepsis Protocol": {
    chiefComplaintsToday: "High fever, rigors, confusion",
    assessmentStatus: "Worsening",
    clinicalTrend: "Deteriorating",
    assessment:
      "Sepsis protocol initiated. Broad-spectrum antibiotics started. Aggressive fluid resuscitation. ICU consult requested.",
  },
  "Diabetic Ketoacidosis": {
    chiefComplaintsToday: "Vomiting, polyuria, altered consciousness",
    assessmentStatus: "Worsening",
    clinicalTrend: "Deteriorating",
    assessment:
      "Diabetic Ketoacidosis. Insulin infusion started. IV fluids and electrolyte monitoring ongoing.",
  },
  "Stable Continue": {
    chiefComplaintsToday: "No new complaints today",
    assessmentStatus: "Stable",
    clinicalTrend: "Stable",
    assessment:
      "Patient stable and improving. Continue current management plan.",
  },
};

// ── Storage helpers ─────────────────────────────────────────────────────────────────

function noteKey(doctorEmail: string, patientId: string, date: string) {
  return `daily_note_${doctorEmail}_${patientId}_${date}`;
}

function loadNote(
  doctorEmail: string,
  patientId: string,
  date: string,
): DailyNoteData | null {
  try {
    const raw = localStorage.getItem(noteKey(doctorEmail, patientId, date));
    return raw ? (JSON.parse(raw) as DailyNoteData) : null;
  } catch {
    return null;
  }
}

function saveNote(
  doctorEmail: string,
  patientId: string,
  date: string,
  data: DailyNoteData,
) {
  localStorage.setItem(
    noteKey(doctorEmail, patientId, date),
    JSON.stringify(data),
  );
}

function freshNote(date: string): DailyNoteData {
  return {
    date,
    state: "none",
    activeComplaints: [],
    activeDiagnoses: [],
    chiefComplaintsToday: "",
    sleep: "",
    appetite: "",
    mobility: "",
    rosData: ROS_SYSTEMS.map((name) => ({
      name,
      reviewedNormal: false,
      findings: "",
    })),
    objectiveNotes: "",
    examSystems: EXAM_SYSTEMS.map((name) => ({ name, findings: "" })),
    assessment: "",
    assessmentStatus: "Stable",
    clinicalTrend: "Stable",
    planItems: [],
    nursingInstructions: [],
    dischargeCriteria: [],
    referral: false,
    carryForwardDismissed: false,
    versions: [],
  };
}

// ── Props ───────────────────────────────────────────────────────────────────

interface DailyProgressNoteProps {
  patientId: string;
  doctorEmail: string;
  authorName: string;
  viewerRole: StaffRole;
  latestVitals: VitalSigns | null;
  patientWeightKg?: number;
  prescriptions?: Prescription[];
  latestVisit?: unknown;
  admissionDate?: string;
  onNoteStateChange?: (state: NoteState) => void;
}
function NoteStateBanner({
  state,
  rejectionReason,
}: { state: NoteState; rejectionReason?: string }) {
  if (state === "none") return null;
  const config = {
    intern_draft: {
      bg: "bg-yellow-50 border-yellow-300",
      text: "text-yellow-800",
      icon: <FileText className="w-4 h-4" />,
      label: "Draft — Awaiting MO Review",
    },
    mo_reviewed: {
      bg: "bg-blue-50 border-blue-300",
      text: "text-blue-800",
      icon: <UserCheck className="w-4 h-4" />,
      label: "MO Reviewed — Awaiting Consultant Finalization",
    },
    finalized: {
      bg: "bg-green-50 border-green-300",
      text: "text-green-800",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "FINALIZED — Note Locked",
    },
    quick_review: {
      bg: "bg-green-50 border-green-300",
      text: "text-green-800",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Quick Review — Finalized",
    },
    none: { bg: "", text: "", icon: null, label: "" },
  }[state];
  if (!config.label) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 ${config.bg} ${config.text}`}
    >
      {config.icon}
      <div className="flex-1">
        <p className="text-sm font-bold">{config.label}</p>
        {rejectionReason && (
          <p className="text-xs mt-0.5">
            🔙 Returned by Consultant:{" "}
            <span className="font-semibold">{rejectionReason}</span>
          </p>
        )}
      </div>
      {state === "finalized" || state === "quick_review" ? (
        <Lock className="w-4 h-4 opacity-60" />
      ) : null}
    </div>
  );
}

// ── Read-Only Overlay (for locked sections) ───────────────────────────────────

function ReadOnlyOverlay({ message }: { message: string }) {
  return (
    <div className="relative">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: informational overlay, no action */}
      <div
        className="absolute inset-0 z-10 rounded-lg bg-muted/50 flex items-center justify-center cursor-not-allowed"
        onClick={() => toast.info(message)}
      >
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Version History Modal ─────────────────────────────────────────────────────────

function VersionHistoryModal({
  versions,
  onClose,
}: { versions: NoteVersion[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h3 className="font-bold">Version History</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No version history yet.
            </p>
          ) : (
            versions.map((v) => (
              <div
                key={v.version}
                className="border border-border rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    v{v.version}
                  </span>
                  <span className="text-xs font-semibold">
                    {STAFF_ROLE_LABELS[
                      v.authorRole as Exclude<
                        typeof v.authorRole,
                        "admin" | "patient"
                      >
                    ] ?? v.authorRole}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — {v.authorName}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(v.timestamp), "dd MMM yyyy, HH:mm")}
                </p>
                <p className="text-xs mt-1">{v.summary}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab button helper ─────────────────────────────────────────────────────────────────

type SoapTab = "S" | "O" | "A" | "P" | "all";

const TAB_CONFIG: Array<{
  key: SoapTab;
  label: string;
  activeColor: string;
  locked: boolean;
  lockedFor: StaffRole[];
}> = [
  {
    key: "S",
    label: "📝 S — Subjective",
    activeColor: "bg-blue-600",
    locked: false,
    lockedFor: [],
  },
  {
    key: "O",
    label: "🔬 O — Objective",
    activeColor: "bg-teal-600",
    locked: false,
    lockedFor: [],
  },
  {
    key: "A",
    label: "📊 A — Assessment",
    activeColor: "bg-amber-600",
    locked: true,
    lockedFor: ["intern_doctor"],
  },
  {
    key: "P",
    label: "💊 P — Plan",
    activeColor: "bg-indigo-600",
    locked: true,
    lockedFor: ["intern_doctor"],
  },
  {
    key: "all",
    label: "🗂 All Findings",
    activeColor: "bg-slate-700",
    locked: false,
    lockedFor: [],
  },
];

// ── Main Component ─────────────────────────────────────────────────────────────────

export default function DailyProgressNote({
  patientId,
  doctorEmail,
  authorName,
  viewerRole,
  latestVitals,
  // prescriptions and admissionDate reserved for future use
  onNoteStateChange,
}: DailyProgressNoteProps) {
  useRolePermissions(); // keep hook call in component

  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  // Role flags
  const isIntern = viewerRole === "intern_doctor";
  const isMO = viewerRole === "medical_officer";
  const isConsultant =
    viewerRole === "consultant_doctor" ||
    viewerRole === "doctor" ||
    viewerRole === "admin";
  const canViewHistory = isConsultant;

  // Note state
  const [note, setNote] = useState<DailyNoteData>(() => {
    const existing = loadNote(doctorEmail, patientId, today);
    if (existing) return existing;
    return freshNote(today);
  });

  const isFinalized =
    note.state === "finalized" || note.state === "quick_review";

  // Carry-forward from yesterday
  const [carriedFrom, setCarriedFrom] = useState<string | null>(null);
  useEffect(() => {
    const existing = loadNote(doctorEmail, patientId, today);
    if (existing?.carryForwardDismissed) return;
    const prev = loadNote(doctorEmail, patientId, yesterday);
    if (!prev) return;
    if (
      existing &&
      (existing.activeComplaints.length > 0 ||
        existing.activeDiagnoses.length > 0)
    )
      return;
    const carried = existing ?? freshNote(today);
    carried.activeComplaints = prev.activeComplaints
      .filter((c) => !c.resolved)
      .map((c) => ({ ...c, id: `${Date.now().toString(36)}${c.id}` }));
    carried.activeDiagnoses = prev.activeDiagnoses.map((d) => ({ ...d }));
    setNote(carried);
    saveNote(doctorEmail, patientId, today, carried);
    setCarriedFrom(yesterday);
  }, [doctorEmail, patientId, today, yesterday]);

  // Auto-save every 30s
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteRef = useRef(note);
  noteRef.current = note;
  const lastAutoSave = useRef<string | null>(null);

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (!isFinalized) {
        saveNote(doctorEmail, patientId, today, noteRef.current);
        const t = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        lastAutoSave.current = t;
      }
    }, 30_000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [doctorEmail, patientId, today, isFinalized]);

  // Active tab
  const [activeTab, setActiveTab] = useState<SoapTab>("S");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
  const [newComplaintText, setNewComplaintText] = useState("");
  const [newDiagText, setNewDiagText] = useState("");
  const [newDiagClass, setNewDiagClass] = useState<DiagnosisClass>("Primary");
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({
    category: "drug" as PlanItem["category"],
    description: "",
    dose: "",
    frequency: "",
    duration: "",
    route: "",
    urgency: "Routine" as PlanItem["urgency"],
  });

  function updateNote(partial: Partial<DailyNoteData>) {
    if (isFinalized) {
      toast.info("This note is finalized and cannot be edited.");
      return;
    }
    const updated = { ...note, ...partial };
    setNote(updated);
    saveNote(doctorEmail, patientId, today, updated);
  }

  // ── Complaint helpers ────────────────────────────────────────────────────────

  function addComplaint(text?: string) {
    const t = (text ?? newComplaintText).trim();
    if (!t) return;
    updateNote({
      activeComplaints: [
        ...note.activeComplaints,
        {
          id: `${Date.now().toString(36)}`,
          text: t,
          trend: "= same",
          resolved: false,
        },
      ],
    });
    setNewComplaintText("");
  }

  function removeComplaint(id: string) {
    updateNote({
      activeComplaints: note.activeComplaints.filter((c) => c.id !== id),
    });
  }
  function updateComplaintTrend(id: string, trend: TrendIndicator) {
    updateNote({
      activeComplaints: note.activeComplaints.map((c) =>
        c.id === id ? { ...c, trend } : c,
      ),
    });
  }
  function toggleComplaintResolved(id: string) {
    updateNote({
      activeComplaints: note.activeComplaints.map((c) =>
        c.id === id ? { ...c, resolved: !c.resolved } : c,
      ),
    });
  }

  // ── Diagnosis helpers ─────────────────────────────────────────────────────

  function addDiagnosis() {
    if (!newDiagText.trim()) return;
    updateNote({
      activeDiagnoses: [
        ...note.activeDiagnoses,
        {
          id: `${Date.now().toString(36)}`,
          name: newDiagText.trim(),
          classification: newDiagClass,
          status: "active",
        },
      ],
    });
    setNewDiagText("");
  }
  function toggleDiagStatus(id: string) {
    updateNote({
      activeDiagnoses: note.activeDiagnoses.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "active" ? "resolved" : "active" }
          : d,
      ),
    });
  }

  // ── Assessment auto-generate ────────────────────────────────────────────────────

  function generateAssessment() {
    const primaryDx = note.activeDiagnoses.find(
      (d) => d.classification === "Primary" && d.status === "active",
    );
    const cc = note.activeComplaints
      .filter((c) => !c.resolved)
      .map((c) => c.text)
      .join(", ");
    const vitalsText = latestVitals
      ? [
          latestVitals.bloodPressure && `BP ${latestVitals.bloodPressure}`,
          latestVitals.pulse && `Pulse ${latestVitals.pulse}`,
          latestVitals.temperature && `Temp ${latestVitals.temperature}°C`,
          latestVitals.oxygenSaturation &&
            `SpO₂ ${latestVitals.oxygenSaturation}%`,
        ]
          .filter(Boolean)
          .join(", ")
      : "Vitals not available";
    const text = [
      `Patient is ${note.clinicalTrend.toLowerCase()}.`,
      cc ? `Active complaints: ${cc}.` : "No active complaints.",
      `Vitals: ${vitalsText}.`,
      primaryDx ? `Primary diagnosis: ${primaryDx.name}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    updateNote({ assessment: text });
    toast.success("Assessment generated — review before saving");
  }

  // ── Plan helpers ─────────────────────────────────────────────────────────────

  function addPlanItem() {
    if (!planForm.description.trim()) {
      toast.error("Enter a description");
      return;
    }
    const item: PlanItem = {
      id: Date.now().toString(36),
      category: planForm.category,
      description: planForm.description.trim(),
      dose: planForm.dose || undefined,
      frequency: planForm.frequency || undefined,
      duration: planForm.duration || undefined,
      route: planForm.route || undefined,
      urgency: planForm.urgency,
    };
    updateNote({ planItems: [...note.planItems, item] });
    setPlanForm({
      category: "drug",
      description: "",
      dose: "",
      frequency: "",
      duration: "",
      route: "",
      urgency: "Routine",
    });
    setShowPlanForm(false);
  }

  function removePlanItem(id: string) {
    updateNote({ planItems: note.planItems.filter((p) => p.id !== id) });
  }

  function toggleNursingInstruction(chip: string) {
    const existing = note.nursingInstructions.includes(chip);
    updateNote({
      nursingInstructions: existing
        ? note.nursingInstructions.filter((n) => n !== chip)
        : [...note.nursingInstructions, chip],
    });
  }

  // ── State transitions ───────────────────────────────────────────────────────────

  function pushVersion(newState: NoteState, summary: string) {
    const v: NoteVersion = {
      version: note.versions.length + 1,
      authorName,
      authorRole: viewerRole,
      timestamp: new Date().toISOString(),
      state: newState,
      summary,
    };
    return [...note.versions, v];
  }

  function handleInternSubmit() {
    if (
      !note.chiefComplaintsToday.trim() &&
      note.activeComplaints.length === 0
    ) {
      toast.error("Complete Subjective section before submitting");
      return;
    }
    const versions = pushVersion(
      "intern_draft",
      "Intern submitted draft (S+O sections)",
    );
    const updated = { ...note, state: "intern_draft" as NoteState, versions };
    setNote(updated);
    saveNote(doctorEmail, patientId, today, updated);
    saveNoteState(patientId, today, "intern_draft");
    onNoteStateChange?.("intern_draft");
    toast.success("✓ Draft submitted to MO for review");
  }

  function handleMOSubmit() {
    if (!note.assessment.trim()) {
      toast.error("Assessment is required before submitting to Consultant");
      return;
    }
    const versions = pushVersion(
      "mo_reviewed",
      "MO reviewed and completed full SOAP note",
    );
    const updated = { ...note, state: "mo_reviewed" as NoteState, versions };
    setNote(updated);
    saveNote(doctorEmail, patientId, today, updated);
    saveNoteState(patientId, today, "mo_reviewed");
    onNoteStateChange?.("mo_reviewed");
    toast.success("✓ Submitted to Consultant for finalization");
  }

  function handleConsultantFinalize() {
    const versions = pushVersion(
      "finalized",
      `Finalized by Consultant ${authorName}`,
    );
    const updated = { ...note, state: "finalized" as NoteState, versions };
    setNote(updated);
    saveNote(doctorEmail, patientId, today, updated);
    saveNoteState(patientId, today, "finalized");
    onNoteStateChange?.("finalized");
    toast.success("🔒 Note finalized and locked");
  }

  function handleReject() {
    if (!rejectionReason.trim()) {
      toast.error("Provide a reason");
      return;
    }
    const versions = pushVersion(
      "none",
      `Returned by Consultant: ${rejectionReason}`,
    );
    const updated = {
      ...note,
      state: "none" as NoteState,
      rejectionReason,
      versions,
    };
    setNote(updated);
    saveNote(doctorEmail, patientId, today, updated);
    saveNoteState(patientId, today, "none");
    onNoteStateChange?.("none");
    setShowRejectModal(false);
    setRejectionReason("");
    toast.warning("🔙 Note returned to MO");
  }

  function handleSave() {
    if (isFinalized) {
      toast.info("This note is finalized.");
      return;
    }
    saveNote(doctorEmail, patientId, today, note);
    const t = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setLastAutoSaveTime(t);
    toast.success("Note saved");
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* State banner */}
      <NoteStateBanner
        state={note.state}
        rejectionReason={note.rejectionReason}
      />

      {/* Carry-forward banner */}
      {carriedFrom && !note.carryForwardDismissed && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-800">
              📋 Carried forward from{" "}
              <span className="font-semibold">{carriedFrom}</span>. Review and
              update.
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateNote({ carryForwardDismissed: true })}
            className="text-blue-400 hover:text-blue-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-indigo-600" /> Daily Progress
            Note
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")} ·{" "}
            {STAFF_ROLE_LABELS[
              viewerRole as Exclude<StaffRole, "admin" | "patient">
            ] ?? viewerRole}{" "}
            — {authorName}
            {(lastAutoSaveTime ?? lastAutoSave.current) && !isFinalized && (
              <span className="ml-2 text-green-600">
                ✓ Draft saved {lastAutoSaveTime ?? lastAutoSave.current}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isFinalized && (
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-indigo-300 text-indigo-700"
                onClick={() => setShowTemplates(!showTemplates)}
                data-ocid="daily_note.template_button"
              >
                <BookTemplate className="w-3.5 h-3.5" /> Templates
              </Button>
              {showTemplates && (
                <div className="absolute right-0 top-8 z-50 bg-card rounded-xl border border-border shadow-xl w-52">
                  {Object.keys(QUICK_TEMPLATES).map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 hover:text-indigo-800 first:rounded-t-xl last:rounded-b-xl transition-colors"
                      onClick={() => {
                        const tpl = QUICK_TEMPLATES[name];
                        updateNote(tpl as Partial<DailyNoteData>);
                        setShowTemplates(false);
                        toast.success(`Template “${name}” applied`);
                      }}
                    >
                      <BookOpen className="w-3.5 h-3.5 inline mr-1.5 opacity-50" />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {canViewHistory && note.versions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowVersionHistory(true)}
              data-ocid="daily_note.version_history_button"
            >
              <History className="w-3.5 h-3.5" /> History
            </Button>
          )}
          {!isFinalized && (
            <Button
              size="sm"
              onClick={handleSave}
              className="gap-1.5"
              data-ocid="daily_note.save_button"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Save
            </Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TAB_CONFIG.map((tab) => {
          const tabLocked = tab.lockedFor.includes(viewerRole as StaffRole);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? `${tab.activeColor} text-white shadow-sm`
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
              data-ocid={`daily_note.tab.${tab.key}`}
            >
              {tab.label}
              {tabLocked && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </div>

      {/* ═ S — Subjective ═══════════════════════════════════════════════════════ */}
      {activeTab === "S" && (
        <div className="space-y-4">
          <div className="bg-card border border-blue-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Active Complaints
              </h3>
              <button
                type="button"
                onClick={() => updateNote({ sameAsYesterday_S: true })}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Same as yesterday
              </button>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMPLAINT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => addComplaint(chip)}
                  disabled={isFinalized}
                  className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                  data-ocid="daily_note.complaint_chip"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Free text add */}
            <div className="flex gap-2">
              <Input
                value={newComplaintText}
                onChange={(e) => setNewComplaintText(e.target.value)}
                placeholder="Custom complaint"
                onKeyDown={(e) => e.key === "Enter" && addComplaint()}
                className="flex-1 text-sm"
                disabled={isFinalized}
                data-ocid="daily_note.complaint_input"
              />
              <Button
                size="sm"
                onClick={() => addComplaint()}
                disabled={isFinalized || !newComplaintText.trim()}
                className="gap-1"
                data-ocid="daily_note.add_complaint_button"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Complaint list */}
            {note.activeComplaints.length === 0 ? (
              <p
                className="text-sm text-muted-foreground text-center py-3"
                data-ocid="daily_note.complaints_empty_state"
              >
                No complaints. Add above or use chips.
              </p>
            ) : (
              <div className="space-y-2">
                {note.activeComplaints.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                      c.resolved
                        ? "bg-muted/40 border-border opacity-60"
                        : "bg-blue-50 border-blue-200"
                    }`}
                    data-ocid="daily_note.complaint_item"
                  >
                    <span
                      className={`flex-1 text-sm ${c.resolved ? "line-through text-muted-foreground" : ""}`}
                    >
                      {c.text}
                    </span>
                    <select
                      value={c.trend}
                      onChange={(e) =>
                        updateComplaintTrend(
                          c.id,
                          e.target.value as TrendIndicator,
                        )
                      }
                      className="text-xs border border-input rounded px-1 py-0.5"
                      disabled={isFinalized}
                    >
                      <option value="↑ improving">↑ improving</option>
                      <option value="↓ worsening">↓ worsening</option>
                      <option value="= same">= same</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleComplaintResolved(c.id)}
                      disabled={isFinalized}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        c.resolved
                          ? "bg-muted text-muted-foreground"
                          : "bg-green-100 text-green-700 border-green-200"
                      }`}
                    >
                      {c.resolved ? "Resolved" : "Active"}
                    </button>
                    {!isFinalized && (
                      <button
                        type="button"
                        onClick={() => removeComplaint(c.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chief Complaints Today */}
          <div className="bg-card border border-blue-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-blue-800 text-sm">
              Patient-reported today
            </h3>
            <Textarea
              value={note.chiefComplaintsToday}
              onChange={(e) =>
                updateNote({ chiefComplaintsToday: e.target.value })
              }
              placeholder="Patient states: fever since morning, cough worse at night..."
              rows={3}
              className="border-blue-200 focus-visible:ring-blue-300 text-sm"
              disabled={isFinalized}
              data-ocid="daily_note.chief_complaints_textarea"
            />
            <div className="grid grid-cols-3 gap-2">
              {(["sleep", "appetite", "mobility"] as const).map((field) => (
                <div key={field}>
                  <Label className="text-xs capitalize text-muted-foreground">
                    {field}
                  </Label>
                  <select
                    value={note[field]}
                    onChange={(e) =>
                      updateNote({
                        [field]: e.target.value,
                      } as Partial<DailyNoteData>)
                    }
                    className="w-full mt-1 border border-input rounded-lg px-2 py-1.5 text-xs"
                    disabled={isFinalized}
                  >
                    <option value="">—</option>
                    {field === "sleep" && (
                      <>
                        <option>Good</option>
                        <option>Fair</option>
                        <option>Poor</option>
                      </>
                    )}
                    {field === "appetite" && (
                      <>
                        <option>Normal</option>
                        <option>Reduced</option>
                        <option>Nil</option>
                      </>
                    )}
                    {field === "mobility" && (
                      <>
                        <option>Ambulant</option>
                        <option>Limited</option>
                        <option>Bedrest</option>
                      </>
                    )}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* System Review */}
          <div className="bg-card border border-blue-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-blue-800 text-sm">
              System Review
            </h3>
            {note.rosData.map((sys, i) => (
              <div
                key={sys.name}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground w-24">
                    {sys.name}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sys.reviewedNormal}
                      onChange={(e) =>
                        updateNote({
                          rosData: note.rosData.map((s, idx) =>
                            idx === i
                              ? {
                                  ...s,
                                  reviewedNormal: e.target.checked,
                                  findings: e.target.checked ? "" : s.findings,
                                }
                              : s,
                          ),
                        })
                      }
                      className="accent-teal-600"
                      disabled={isFinalized}
                    />
                    Reviewed — Normal
                  </label>
                </div>
                {!sys.reviewedNormal && (
                  <Input
                    value={sys.findings}
                    onChange={(e) =>
                      updateNote({
                        rosData: note.rosData.map((s, idx) =>
                          idx === i ? { ...s, findings: e.target.value } : s,
                        ),
                      })
                    }
                    placeholder="Abnormal findings..."
                    className="text-xs h-8"
                    disabled={isFinalized}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═ O — Objective ═══════════════════════════════════════════════════════ */}
      {activeTab === "O" && (
        <div className="space-y-4">
          {/* Vitals strip — read-only for doctors, entered by nurses */}
          <div className="bg-card border border-teal-200 rounded-xl p-4">
            <h3 className="font-semibold text-teal-800 text-sm mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Vitals (entered by nurse)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "BP",
                  value: latestVitals?.bloodPressure,
                  unit: "mmHg",
                },
                { label: "Pulse", value: latestVitals?.pulse, unit: "bpm" },
                {
                  label: "SpO₂",
                  value: latestVitals?.oxygenSaturation,
                  unit: "%",
                },
                { label: "Temp", value: latestVitals?.temperature, unit: "°C" },
              ].map(({ label, value, unit }) => (
                <div
                  key={label}
                  className="bg-teal-50 rounded-lg px-3 py-2 text-center"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold text-foreground">
                    {value ?? "—"}{" "}
                    <span className="text-xs font-normal">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
            {!latestVitals && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠ No vitals recorded. Nurse should enter vitals.
              </p>
            )}
          </div>

          {/* I/O Chart */}
          <div className="bg-card border border-teal-200 rounded-xl p-4">
            <h3 className="font-semibold text-teal-800 text-sm mb-3">
              💧 Intake / Output Chart
            </h3>
            <IOChart
              patientId={patientId}
              doctorEmail={doctorEmail}
              canEdit={!isFinalized && !isIntern}
            />
          </div>

          {/* Drain Monitor */}
          <div className="bg-card border border-teal-200 rounded-xl p-4">
            <h3 className="font-semibold text-teal-800 text-sm mb-3">
              🩺 Drain Monitoring
            </h3>
            <DrainMonitor
              patientId={patientId}
              doctorEmail={doctorEmail}
              canEdit={!isFinalized && !isIntern}
            />
          </div>

          {/* Examination findings */}
          <div className="bg-card border border-teal-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-teal-800 text-sm">
                Examination Findings
              </h3>
              <button
                type="button"
                onClick={() => updateNote({ sameAsYesterday_O: true })}
                className="text-xs text-teal-600 hover:text-teal-800 underline"
              >
                Same as yesterday
              </button>
            </div>
            {note.examSystems.map((sys, i) => (
              <div key={sys.name} className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  {sys.name}
                </Label>
                <Textarea
                  value={sys.findings}
                  onChange={(e) =>
                    updateNote({
                      examSystems: note.examSystems.map((s, idx) =>
                        idx === i ? { ...s, findings: e.target.value } : s,
                      ),
                    })
                  }
                  placeholder={`${sys.name} findings...`}
                  rows={2}
                  className="text-xs border-teal-200 focus-visible:ring-teal-300"
                  disabled={isFinalized}
                  data-ocid={`daily_note.exam.${sys.name.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          {/* Objective notes */}
          <div className="bg-card border border-teal-200 rounded-xl p-4">
            <Label className="text-xs font-semibold text-teal-700">
              Additional Objective Notes
            </Label>
            <Textarea
              value={note.objectiveNotes}
              onChange={(e) => updateNote({ objectiveNotes: e.target.value })}
              placeholder="Any additional objective findings..."
              rows={3}
              className="mt-1 border-teal-200 focus-visible:ring-teal-300"
              disabled={isFinalized}
              data-ocid="daily_note.objective_notes"
            />
          </div>
        </div>
      )}

      {/* ═ A — Assessment ═════════════════════════════════════════════════════ */}
      {activeTab === "A" && (
        <div className="space-y-4">
          {isIntern && (
            <ReadOnlyOverlay message="Intern can view only — MO or Consultant must complete this section" />
          )}

          {/* Diagnoses */}
          <div className="bg-card border border-amber-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4" /> Active Diagnoses
            </h3>
            {!isIntern && (
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={newDiagText}
                  onChange={(e) => setNewDiagText(e.target.value)}
                  placeholder="Diagnosis name"
                  onKeyDown={(e) => e.key === "Enter" && addDiagnosis()}
                  className="flex-1 min-w-[160px] text-sm"
                  disabled={isFinalized}
                  data-ocid="daily_note.diagnosis_input"
                />
                <select
                  value={newDiagClass}
                  onChange={(e) =>
                    setNewDiagClass(e.target.value as DiagnosisClass)
                  }
                  className="border border-input rounded-lg px-2 py-2 text-sm"
                  disabled={isFinalized}
                >
                  <option>Primary</option>
                  <option>Secondary</option>
                  <option>Comorbidity</option>
                </select>
                <Button
                  size="sm"
                  onClick={addDiagnosis}
                  disabled={isFinalized || !newDiagText.trim()}
                  className="gap-1 bg-amber-600 hover:bg-amber-700"
                  data-ocid="daily_note.add_diagnosis_button"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            )}
            {note.activeDiagnoses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                No diagnoses added.
              </p>
            ) : (
              <div className="space-y-2">
                {note.activeDiagnoses.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      d.status === "active"
                        ? "bg-amber-50 border-amber-200"
                        : "bg-muted/40 border-border opacity-60"
                    }`}
                  >
                    <span
                      className={`flex-1 text-sm font-medium ${d.status === "resolved" ? "line-through text-muted-foreground" : ""}`}
                    >
                      {d.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        d.classification === "Primary"
                          ? "bg-red-100 text-red-700"
                          : d.classification === "Secondary"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.classification}
                    </span>
                    {!isFinalized && !isIntern && (
                      <button
                        type="button"
                        onClick={() => toggleDiagStatus(d.id)}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          d.status === "active"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {d.status === "active" ? "Active" : "Resolved"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clinical trend */}
          <div className="bg-card border border-amber-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-amber-800 text-sm">
              Clinical Trend
            </h3>
            <div className="flex gap-2 flex-wrap">
              {(["Improving", "Stable", "Deteriorating"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    !isFinalized &&
                    !isIntern &&
                    updateNote({
                      clinicalTrend: t,
                      assessmentStatus:
                        t === "Improving"
                          ? "Improving"
                          : t === "Deteriorating"
                            ? "Worsening"
                            : "Stable",
                    })
                  }
                  disabled={isFinalized || isIntern}
                  className={`text-sm px-4 py-2 rounded-lg font-semibold border transition-colors ${
                    note.clinicalTrend === t
                      ? t === "Improving"
                        ? "bg-green-600 text-white border-green-600"
                        : t === "Deteriorating"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-amber-600 text-white border-amber-600"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                >
                  {t === "Improving"
                    ? "✔ "
                    : t === "Deteriorating"
                      ? "⚠ "
                      : "≈ "}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Assessment text */}
          <div className="bg-card border border-amber-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-800 text-sm">
                Assessment Summary
              </h3>
              {!isFinalized && !isIntern && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-amber-300 text-amber-700"
                  onClick={generateAssessment}
                  data-ocid="daily_note.generate_assessment_button"
                >
                  <RefreshCw className="w-3 h-3" /> Auto-generate
                </Button>
              )}
            </div>
            <div className="relative">
              <Textarea
                value={note.assessment}
                onChange={(e) =>
                  !isFinalized &&
                  !isIntern &&
                  updateNote({ assessment: e.target.value })
                }
                placeholder="Clinical assessment narrative..."
                rows={4}
                className={`border-amber-200 focus-visible:ring-amber-300 text-sm ${isIntern ? "pointer-events-none opacity-60" : ""}`}
                disabled={isFinalized}
                data-ocid="daily_note.assessment_textarea"
              />
            </div>
          </div>
        </div>
      )}

      {/* ═ P — Plan ══════════════════════════════════════════════════════════ */}
      {activeTab === "P" && (
        <div className="space-y-4">
          {isIntern && (
            <ReadOnlyOverlay message="Intern can view only — MO or Consultant must complete this section" />
          )}

          {/* Plan items */}
          <div className="bg-card border border-indigo-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-indigo-800 text-sm flex items-center gap-2">
                <Pill className="w-4 h-4" /> Medication Changes & Orders
              </h3>
              {!isFinalized && !isIntern && (
                <Button
                  size="sm"
                  onClick={() => setShowPlanForm(!showPlanForm)}
                  className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-xs"
                  data-ocid="daily_note.add_plan_button"
                >
                  <Plus className="w-3 h-3" /> Add
                </Button>
              )}
            </div>

            {showPlanForm && !isIntern && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <select
                      value={planForm.category}
                      onChange={(e) =>
                        setPlanForm((f) => ({
                          ...f,
                          category: e.target.value as PlanItem["category"],
                        }))
                      }
                      className="w-full mt-1 border border-input rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="drug">Drug</option>
                      <option value="investigation">Investigation</option>
                      <option value="procedure">Procedure</option>
                      <option value="nursing">Nursing</option>
                    </select>
                  </div>
                  {planForm.category === "investigation" && (
                    <div>
                      <Label className="text-xs">Urgency</Label>
                      <select
                        value={planForm.urgency}
                        onChange={(e) =>
                          setPlanForm((f) => ({
                            ...f,
                            urgency: e.target.value as PlanItem["urgency"],
                          }))
                        }
                        className="w-full mt-1 border border-input rounded-lg px-2 py-1.5 text-sm"
                      >
                        <option>Routine</option>
                        <option>Urgent</option>
                        <option>STAT</option>
                      </select>
                    </div>
                  )}
                </div>
                <Input
                  placeholder="Description (drug name, test, procedure)"
                  value={planForm.description}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="text-sm"
                />
                {planForm.category === "drug" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Dose"
                      value={planForm.dose}
                      onChange={(e) =>
                        setPlanForm((f) => ({ ...f, dose: e.target.value }))
                      }
                      className="text-sm"
                    />
                    <Input
                      placeholder="Frequency"
                      value={planForm.frequency}
                      onChange={(e) =>
                        setPlanForm((f) => ({
                          ...f,
                          frequency: e.target.value,
                        }))
                      }
                      className="text-sm"
                    />
                    <Input
                      placeholder="Duration"
                      value={planForm.duration}
                      onChange={(e) =>
                        setPlanForm((f) => ({ ...f, duration: e.target.value }))
                      }
                      className="text-sm"
                    />
                    <Input
                      placeholder="Route (oral/IV/IM)"
                      value={planForm.route}
                      onChange={(e) =>
                        setPlanForm((f) => ({ ...f, route: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={addPlanItem}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add to Plan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPlanForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {note.planItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                No plan items added.
              </p>
            ) : (
              <div className="space-y-2">
                {note.planItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      item.category === "drug"
                        ? "bg-indigo-50 border-indigo-200"
                        : item.category === "investigation"
                          ? "bg-purple-50 border-purple-200"
                          : "bg-muted/40 border-border"
                    }`}
                    data-ocid="daily_note.plan_item"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.category === "drug"
                              ? "bg-indigo-100 text-indigo-700"
                              : item.category === "investigation"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.category.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {item.description}
                        </span>
                        {item.urgency && item.urgency !== "Routine" && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              item.urgency === "STAT"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {item.urgency}
                          </span>
                        )}
                      </div>
                      {item.dose && (
                        <p className="text-xs text-muted-foreground">
                          {item.dose} {item.frequency} · {item.duration}{" "}
                          {item.route ? `· ${item.route}` : ""}
                        </p>
                      )}
                    </div>
                    {!isFinalized && !isIntern && (
                      <button
                        type="button"
                        onClick={() => removePlanItem(item.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nursing instructions */}
          <div className="bg-card border border-indigo-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-indigo-800 text-sm">
              Nursing Instructions
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {NURSING_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => !isIntern && toggleNursingInstruction(chip)}
                  disabled={isFinalized || isIntern}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    note.nursingInstructions.includes(chip)
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-card border-border hover:bg-muted"
                  } disabled:opacity-50`}
                  data-ocid="daily_note.nursing_chip"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Discharge planning */}
          <div className="bg-card border border-indigo-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-indigo-800 text-sm">
                Discharge Planning
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Target Discharge Date</Label>
                <Input
                  type="date"
                  value={note.targetDischargeDate ?? ""}
                  onChange={(e) =>
                    !isIntern &&
                    updateNote({ targetDischargeDate: e.target.value })
                  }
                  className="mt-1"
                  disabled={isFinalized || isIntern}
                  data-ocid="daily_note.discharge_date"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═ All Findings ═══════════════════════════════════════════════════════ */}
      {activeTab === "all" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              label: "S — Subjective",
              content:
                note.chiefComplaintsToday ||
                note.activeComplaints
                  .filter((c) => !c.resolved)
                  .map((c) => c.text)
                  .join(", ") ||
                "—",
              color: "bg-blue-50 border-blue-200 text-blue-900",
            },
            {
              label: "O — Objective",
              content:
                note.objectiveNotes ||
                note.examSystems
                  .filter((s) => s.findings)
                  .map((s) => `${s.name}: ${s.findings}`)
                  .join("\n") ||
                "—",
              color: "bg-teal-50 border-teal-200 text-teal-900",
            },
            {
              label: "A — Assessment",
              content:
                note.assessment ||
                note.activeDiagnoses
                  .filter((d) => d.status === "active")
                  .map((d) => d.name)
                  .join(", ") ||
                "—",
              color: "bg-amber-50 border-amber-200 text-amber-900",
            },
            {
              label: "P — Plan",
              content:
                note.planItems
                  .map((p) => `${p.category.toUpperCase()}: ${p.description}`)
                  .join("\n") || "—",
              color: "bg-indigo-50 border-indigo-200 text-indigo-900",
            },
          ].map(({ label, content, color }) => (
            <div key={label} className={`rounded-xl border p-4 ${color}`}>
              <p className="text-xs font-bold mb-2 opacity-70">{label}</p>
              <p className="text-sm whitespace-pre-line">{content}</p>
            </div>
          ))}
          <div className="col-span-full bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-bold text-muted-foreground mb-2">
              Clinical Trend
            </p>
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${
                note.clinicalTrend === "Improving"
                  ? "bg-green-100 text-green-700"
                  : note.clinicalTrend === "Deteriorating"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {note.clinicalTrend}
            </span>
          </div>
        </div>
      )}

      {/* ── Submission Buttons (role-based) ── */}
      {!isFinalized && (
        <div className="pt-2 border-t border-border">
          <div className="flex flex-wrap gap-3">
            {/* Intern: submit draft to MO */}
            {isIntern && (
              <Button
                onClick={handleInternSubmit}
                className="bg-yellow-600 hover:bg-yellow-700 gap-2"
                data-ocid="daily_note.intern_submit_button"
              >
                <Send className="w-4 h-4" /> Submit Draft to MO
              </Button>
            )}

            {/* MO: can submit to consultant or edit freely */}
            {isMO && (
              <>
                <Button
                  onClick={handleMOSubmit}
                  className="bg-blue-700 hover:bg-blue-800 gap-2"
                  data-ocid="daily_note.mo_submit_button"
                >
                  <UserCheck className="w-4 h-4" /> Submit to Consultant
                </Button>
                <p className="self-center text-xs text-muted-foreground">
                  MO can write multiple entries per day
                  (morning/evening/emergency)
                </p>
              </>
            )}

            {/* Consultant: finalize or reject */}
            {isConsultant &&
              (note.state === "mo_reviewed" ||
                note.state === "none" ||
                note.state === "intern_draft") && (
                <>
                  <Button
                    onClick={handleConsultantFinalize}
                    className="bg-green-700 hover:bg-green-800 gap-2"
                    data-ocid="daily_note.consultant_finalize_button"
                  >
                    <Lock className="w-4 h-4" /> Finalize Note
                  </Button>
                  {note.state === "mo_reviewed" && (
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
                      onClick={() => setShowRejectModal(true)}
                      data-ocid="daily_note.reject_button"
                    >
                      <RotateCcw className="w-4 h-4" /> Return to MO
                    </Button>
                  )}
                </>
              )}
          </div>
        </div>
      )}

      {/* Finalized note controls */}
      {isFinalized && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.print()}
            data-ocid="daily_note.print_button"
          >
            <FileText className="w-3.5 h-3.5" /> Print Note
          </Button>
          {canViewHistory && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowVersionHistory(true)}
              data-ocid="daily_note.version_history_button"
            >
              <History className="w-3.5 h-3.5" /> View Version History
            </Button>
          )}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-red-500" /> Return Note to MO
            </h3>
            <div>
              <Label className="text-xs">Rejection Reason (required)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please revise the assessment and plan..."
                rows={3}
                className="mt-1"
                data-ocid="daily_note.reject_reason_textarea"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700"
                data-ocid="daily_note.confirm_reject_button"
              >
                Return Note
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(false)}
                data-ocid="daily_note.cancel_reject_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Version history modal */}
      {showVersionHistory && (
        <VersionHistoryModal
          versions={note.versions}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </div>
  );
}
