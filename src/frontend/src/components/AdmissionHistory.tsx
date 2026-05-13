/**
 * AdmissionHistory — One-time admission history form for admitted/inpatient patients.
 *
 * Rules:
 * - Intern saves → "draft_awaiting_approval" badge; locked until Consultant/MO approves
 * - Consultant/MO saves → "complete", immediately locked
 * - Once "complete": READ-ONLY. Consultant Doctor / Admin can "Unlock to Edit" (audit log)
 * - Approval workflow: Consultant/MO see Approve (green) + Request Changes (amber) buttons
 * - "Request Changes" opens a comment box visible to the intern
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
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  History,
  Lock,
  LockOpen,
  MessageSquare,
  Plus,
  Stethoscope,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Patient } from "../types";
import type { StaffRole } from "../types";
import { STAFF_ROLE_LABELS } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdmissionHistoryRecord {
  id: string;
  patientId: string;
  admittedOn: string; // ISO
  dischargedOn?: string; // ISO — set when patient is discharged
  admittedBy: string;
  admittedByRole: StaffRole;
  hospitalName: string;
  ward: string;
  bed: string;
  consultantAssigned?: string; // name of assigned consultant

  // Clinical fields
  chiefComplaints: Array<{
    complaint: string;
    duration: string;
    notes: string;
  }>;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  pastSurgicalHistory: string;
  drugHistory: string;
  allergies: string;
  physicalExamination: string;
  provisionalDiagnosis: string;
  initialPlan: string;

  // Workflow
  status: "complete" | "draft_awaiting_approval";
  approvedBy?: string;
  approvedByRole?: StaffRole;
  approvedAt?: string;
  changeRequests: Array<{
    id: string;
    comment: string;
    requestedBy: string;
    requestedByRole: StaffRole;
    requestedAt: string;
    resolved: boolean;
  }>;
  auditLog: Array<{
    action: string;
    by: string;
    byRole: StaffRole;
    at: string;
    reason?: string;
  }>;

  createdAt: string;
  updatedAt: string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const ADMISSION_HISTORY_PREFIX = "admissionHistory_";

export function loadAdmissionHistory(
  patientId: string,
): AdmissionHistoryRecord[] {
  try {
    const raw = localStorage.getItem(`${ADMISSION_HISTORY_PREFIX}${patientId}`);
    if (!raw) return [];
    return JSON.parse(raw) as AdmissionHistoryRecord[];
  } catch {
    return [];
  }
}

export function saveAdmissionHistory(
  patientId: string,
  records: AdmissionHistoryRecord[],
) {
  localStorage.setItem(
    `${ADMISSION_HISTORY_PREFIX}${patientId}`,
    JSON.stringify(records),
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: AdmissionHistoryRecord["status"]) {
  if (status === "complete") {
    return (
      <Badge className="bg-gray-100 text-gray-700 border border-gray-300 gap-1 text-xs">
        <Lock className="w-3 h-3" /> Locked
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border border-amber-300 gap-1 text-xs">
      <AlertTriangle className="w-3 h-3" /> Draft – Awaiting Approval
    </Badge>
  );
}

function canEditForm(
  record: AdmissionHistoryRecord | null,
  viewerRole: StaffRole,
): boolean {
  if (!record) return true; // New record — always editable
  if (record.status === "draft_awaiting_approval") {
    // Intern who created it can still edit; Consultant/MO can also edit
    return (
      viewerRole === "consultant_doctor" ||
      viewerRole === "medical_officer" ||
      viewerRole === "intern_doctor" ||
      viewerRole === "doctor"
    );
  }
  // "complete" → locked; only Consultant/Admin via explicit unlock
  return false;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ComplaintRow({
  complaint,
  onUpdate,
  onRemove,
  readOnly,
}: {
  complaint: AdmissionHistoryRecord["chiefComplaints"][number];
  onUpdate: (
    field: keyof AdmissionHistoryRecord["chiefComplaints"][number],
    val: string,
  ) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start bg-blue-50/60 rounded-lg p-2 border border-blue-100">
      <div className="col-span-5">
        <Input
          value={complaint.complaint}
          onChange={(e) => onUpdate("complaint", e.target.value)}
          placeholder="Complaint (e.g. Cough)"
          className="text-sm h-8"
          readOnly={readOnly}
        />
      </div>
      <div className="col-span-3">
        <Input
          value={complaint.duration}
          onChange={(e) => onUpdate("duration", e.target.value)}
          placeholder="Duration"
          className="text-sm h-8"
          readOnly={readOnly}
        />
      </div>
      <div className="col-span-3">
        <Input
          value={complaint.notes}
          onChange={(e) => onUpdate("notes", e.target.value)}
          placeholder="Notes"
          className="text-sm h-8"
          readOnly={readOnly}
        />
      </div>
      {!readOnly && (
        <div className="col-span-1 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 hover:text-red-600 mt-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AdmissionHistoryProps {
  patient: Patient;
  viewerRole: StaffRole;
  viewerName: string;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdmissionHistory({
  patient,
  viewerRole,
  viewerName,
}: AdmissionHistoryProps) {
  const patientId = String(patient.id);
  const [records, setRecords] = useState<AdmissionHistoryRecord[]>(() =>
    loadAdmissionHistory(patientId),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [changeComment, setChangeComment] = useState<Record<string, string>>(
    {},
  );
  const [showChangeInput, setShowChangeInput] = useState<
    Record<string, boolean>
  >({});
  const [prevAdmissionsExpanded, setPrevAdmissionsExpanded] = useState(false);

  // ── Previous admissions: records from all patients sharing same register number
  // or simply all records where status is complete AND patient is now OPD
  const previousAdmissions = records.filter(
    (r) => r.status === "complete" && !!r.dischargedOn,
  );

  // Determine if the viewer can create/see this
  const canCreate =
    viewerRole === "consultant_doctor" ||
    viewerRole === "medical_officer" ||
    viewerRole === "intern_doctor" ||
    viewerRole === "doctor" ||
    viewerRole === "admin";

  // ── Form state ────────────────────────────────────────────────────────────
  const emptyForm = (): Omit<
    AdmissionHistoryRecord,
    | "id"
    | "patientId"
    | "admittedBy"
    | "admittedByRole"
    | "status"
    | "changeRequests"
    | "auditLog"
    | "createdAt"
    | "updatedAt"
    | "approvedBy"
    | "approvedByRole"
    | "approvedAt"
  > => ({
    admittedOn: format(new Date(), "yyyy-MM-dd"),
    hospitalName: (patient.hospitalName as string) || "",
    ward: patient.ward || "",
    bed: patient.bedNumber || "",
    chiefComplaints: [{ complaint: "", duration: "", notes: "" }],
    historyOfPresentIllness: "",
    pastMedicalHistory: "",
    pastSurgicalHistory: patient.pastSurgicalHistory || "",
    drugHistory: "",
    allergies: (patient.allergies || []).join(", "),
    physicalExamination: "",
    provisionalDiagnosis: "",
    initialPlan: "",
  });

  const [form, setForm] = useState(emptyForm());

  function openNewForm() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(record: AdmissionHistoryRecord) {
    setForm({
      admittedOn: record.admittedOn,
      hospitalName: record.hospitalName,
      ward: record.ward,
      bed: record.bed,
      chiefComplaints:
        record.chiefComplaints.length > 0
          ? record.chiefComplaints
          : [{ complaint: "", duration: "", notes: "" }],
      historyOfPresentIllness: record.historyOfPresentIllness,
      pastMedicalHistory: record.pastMedicalHistory,
      pastSurgicalHistory: record.pastSurgicalHistory,
      drugHistory: record.drugHistory,
      allergies: record.allergies,
      physicalExamination: record.physicalExamination,
      provisionalDiagnosis: record.provisionalDiagnosis,
      initialPlan: record.initialPlan,
    });
    setEditingId(record.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.provisionalDiagnosis.trim()) {
      toast.error("Provisional Diagnosis is required");
      return;
    }

    const isIntern = viewerRole === "intern_doctor";
    const newStatus: AdmissionHistoryRecord["status"] = isIntern
      ? "draft_awaiting_approval"
      : "complete";

    const now = new Date().toISOString();

    if (editingId) {
      const updated = records.map((r) => {
        if (r.id !== editingId) return r;
        const auditEntry = {
          action: `Updated by ${STAFF_ROLE_LABELS[viewerRole] ?? viewerRole}`,
          by: viewerName,
          byRole: viewerRole,
          at: now,
        };
        return {
          ...r,
          ...form,
          status: newStatus,
          updatedAt: now,
          auditLog: [...r.auditLog, auditEntry],
        };
      });
      setRecords(updated);
      saveAdmissionHistory(patientId, updated);
      toast.success(
        isIntern
          ? "Saved as Draft – Awaiting Approval"
          : "Admission history saved",
      );
    } else {
      const newRecord: AdmissionHistoryRecord = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        patientId,
        admittedBy: viewerName,
        admittedByRole: viewerRole,
        status: newStatus,
        changeRequests: [],
        auditLog: [
          {
            action: `Created by ${STAFF_ROLE_LABELS[viewerRole] ?? viewerRole}`,
            by: viewerName,
            byRole: viewerRole,
            at: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
        ...form,
      };
      const updated = [...records, newRecord];
      setRecords(updated);
      saveAdmissionHistory(patientId, updated);
      toast.success(
        isIntern
          ? "Admission history saved as Draft – Awaiting Approval"
          : "Admission history saved and locked",
      );
    }

    setShowForm(false);
    setEditingId(null);
  }

  function handleApprove(recordId: string) {
    const now = new Date().toISOString();
    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      return {
        ...r,
        status: "complete" as const,
        approvedBy: viewerName,
        approvedByRole: viewerRole,
        approvedAt: now,
        updatedAt: now,
        auditLog: [
          ...r.auditLog,
          {
            action: `Approved by ${STAFF_ROLE_LABELS[viewerRole] ?? viewerRole}`,
            by: viewerName,
            byRole: viewerRole,
            at: now,
          },
        ],
      };
    });
    setRecords(updated);
    saveAdmissionHistory(patientId, updated);
    toast.success("Admission history approved and locked");
  }

  function handleRequestChanges(recordId: string) {
    const comment = changeComment[recordId]?.trim();
    if (!comment) {
      toast.error("Please enter a comment");
      return;
    }
    const now = new Date().toISOString();
    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      return {
        ...r,
        updatedAt: now,
        changeRequests: [
          ...r.changeRequests,
          {
            id: Date.now().toString(36),
            comment,
            requestedBy: viewerName,
            requestedByRole: viewerRole,
            requestedAt: now,
            resolved: false,
          },
        ],
        auditLog: [
          ...r.auditLog,
          {
            action: `Changes requested by ${STAFF_ROLE_LABELS[viewerRole] ?? viewerRole}`,
            by: viewerName,
            byRole: viewerRole,
            at: now,
          },
        ],
      };
    });
    setRecords(updated);
    saveAdmissionHistory(patientId, updated);
    setChangeComment((prev) => ({ ...prev, [recordId]: "" }));
    setShowChangeInput((prev) => ({ ...prev, [recordId]: false }));
    toast.success("Change request sent to intern");
  }

  function handleUnlock(recordId: string) {
    if (!unlockReason.trim()) {
      toast.error("Please provide a reason for unlocking");
      return;
    }
    const now = new Date().toISOString();
    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      return {
        ...r,
        status: "draft_awaiting_approval" as const,
        updatedAt: now,
        auditLog: [
          ...r.auditLog,
          {
            action: `Unlocked for editing by ${STAFF_ROLE_LABELS[viewerRole] ?? viewerRole}`,
            by: viewerName,
            byRole: viewerRole,
            at: now,
            reason: unlockReason,
          },
        ],
      };
    });
    setRecords(updated);
    saveAdmissionHistory(patientId, updated);
    setConfirmUnlock(null);
    setUnlockReason("");
    toast.success("Record unlocked — now in Draft mode");
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const _activeRecord = records.find(
    (r) => r.status !== "complete" || records.length === 1,
  );
  void _activeRecord;
  const hasComplete = records.some((r) => r.status === "complete");
  void hasComplete;

  const canApprove =
    viewerRole === "consultant_doctor" ||
    viewerRole === "medical_officer" ||
    viewerRole === "doctor" ||
    viewerRole === "admin";

  const canUnlock =
    viewerRole === "consultant_doctor" ||
    viewerRole === "doctor" ||
    viewerRole === "admin";

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Admission History
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {patient.fullName} ·{" "}
            {patient.isAdmitted ? "Currently Admitted" : "Admission Record"}
          </p>
        </div>
        {canCreate && !showForm && (
          <Button
            size="sm"
            onClick={openNewForm}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            data-ocid="admission_history.new_button"
          >
            <Plus className="w-3.5 h-3.5" />
            {records.length === 0
              ? "Create Admission History"
              : "New Admission Record"}
          </Button>
        )}
      </div>

      {/* ── Empty state ── */}
      {records.length === 0 && !showForm && (
        <div
          className="text-center py-10 bg-white rounded-xl border border-blue-100"
          data-ocid="admission_history.empty_state"
        >
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium mb-1">
            No admission history on record
          </p>
          <p className="text-xs text-gray-400">
            Create one to document this admission.
          </p>
        </div>
      )}

      {/* ── Previous Admissions (Reverse Flow: Discharged → OPD patients) ── */}
      {previousAdmissions.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPrevAdmissionsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-100 transition-colors"
            data-ocid="admission_history.previous_admissions.toggle"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" />
              <span className="font-semibold text-teal-800 text-sm">
                Previous Admissions
              </span>
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                {previousAdmissions.length} record
                {previousAdmissions.length !== 1 ? "s" : ""}
              </span>
            </div>
            {prevAdmissionsExpanded ? (
              <ChevronUp className="w-4 h-4 text-teal-500 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-teal-500 shrink-0" />
            )}
          </button>
          {prevAdmissionsExpanded && (
            <div className="px-4 pb-4 space-y-2 border-t border-teal-200">
              <p className="text-xs text-teal-600 mt-3">
                This patient was previously admitted. Their inpatient history is
                preserved below for clinical reference.
              </p>
              {previousAdmissions.map((r, idx) => (
                <div
                  key={r.id}
                  className="bg-white border border-teal-200 rounded-xl p-4 space-y-2"
                  data-ocid={`admission_history.prev_admission.${idx + 1}`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-teal-600" />
                        <span className="text-sm font-semibold text-gray-800">
                          Admitted:{" "}
                          {format(new Date(r.admittedOn), "d MMM yyyy")}
                        </span>
                        {r.dischargedOn && (
                          <>
                            <span className="text-gray-400">→</span>
                            <span className="text-sm font-semibold text-gray-800">
                              Discharged:{" "}
                              {format(new Date(r.dischargedOn), "d MMM yyyy")}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                        {r.hospitalName && <span>📍 {r.hospitalName}</span>}
                        {r.ward && <span>Ward: {r.ward}</span>}
                        {r.bed && <span>Bed: {r.bed}</span>}
                        {r.consultantAssigned && (
                          <span>Consultant: {r.consultantAssigned}</span>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-teal-100 text-teal-700 border border-teal-200 text-xs gap-1 shrink-0">
                      <Lock className="w-3 h-3" /> Archived
                    </Badge>
                  </div>
                  {r.provisionalDiagnosis && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-bold text-purple-700 mb-1">
                        Diagnosis
                      </p>
                      <p className="text-sm text-gray-700">
                        {r.provisionalDiagnosis}
                      </p>
                    </div>
                  )}
                  {r.approvedBy && (
                    <p className="text-xs text-gray-400">
                      ✅ Approved by {r.approvedBy} ·{" "}
                      {r.approvedAt
                        ? format(new Date(r.approvedAt), "d MMM yyyy")
                        : "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Inline Form ── */}
      {showForm && (
        <div
          className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 space-y-5"
          data-ocid="admission_history.form"
        >
          {/* Form header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              {editingId ? "Edit Admission History" : "New Admission History"}
              {viewerRole === "intern_doctor" && (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-xs">
                  Will be saved as Draft
                </Badge>
              )}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Header info */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <p className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wide">
              Admission Header — {patient.fullName} | Admitted:{" "}
              {form.admittedOn}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  { key: "admittedOn", label: "Admitted On", type: "date" },
                  { key: "hospitalName", label: "Hospital", type: "text" },
                  { key: "ward", label: "Ward", type: "text" },
                  { key: "bed", label: "Bed No.", type: "text" },
                ] as const
              ).map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type}
                    value={form[f.key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Chief Complaints */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-blue-800 uppercase">
                Chief Complaints at Admission
              </Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-blue-300 text-blue-700"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    chiefComplaints: [
                      ...prev.chiefComplaints,
                      { complaint: "", duration: "", notes: "" },
                    ],
                  }))
                }
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <div className="grid grid-cols-12 gap-2 px-2">
              <div className="col-span-5 text-xs text-gray-400 font-semibold">
                Complaint
              </div>
              <div className="col-span-3 text-xs text-gray-400 font-semibold">
                Duration
              </div>
              <div className="col-span-4 text-xs text-gray-400 font-semibold">
                Notes
              </div>
            </div>
            <div className="space-y-1.5">
              {form.chiefComplaints.map((cc, i) => (
                <ComplaintRow
                  key={`cc-${cc.complaint || i}`}
                  complaint={cc}
                  readOnly={false}
                  onUpdate={(field, val) =>
                    setForm((prev) => ({
                      ...prev,
                      chiefComplaints: prev.chiefComplaints.map((c, idx) =>
                        idx === i ? { ...c, [field]: val } : c,
                      ),
                    }))
                  }
                  onRemove={() =>
                    setForm((prev) => ({
                      ...prev,
                      chiefComplaints: prev.chiefComplaints.filter(
                        (_, idx) => idx !== i,
                      ),
                    }))
                  }
                />
              ))}
            </div>
          </div>

          {/* Clinical fields */}
          {(
            [
              {
                key: "historyOfPresentIllness",
                label: "History of Present Illness",
                color: "blue",
                rows: 3,
              },
              {
                key: "pastMedicalHistory",
                label: "Past Medical & Surgical History",
                color: "green",
                rows: 2,
              },
              {
                key: "drugHistory",
                label: "Drug History (On Admission)",
                color: "amber",
                rows: 2,
              },
              { key: "allergies", label: "Allergies", color: "red", rows: 1 },
              {
                key: "physicalExamination",
                label: "Physical Examination (Vitals + Systemic Summary)",
                color: "rose",
                rows: 3,
              },
              {
                key: "provisionalDiagnosis",
                label: "Provisional / Admission Diagnosis *",
                color: "purple",
                rows: 2,
              },
              {
                key: "initialPlan",
                label: "Initial Plan",
                color: "indigo",
                rows: 2,
              },
            ] as const
          ).map((f) => (
            <div key={f.key}>
              <Label
                className={`text-xs font-bold text-${f.color}-800 uppercase`}
              >
                {f.label}
              </Label>
              <Textarea
                value={form[f.key]}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [f.key]: e.target.value,
                  }))
                }
                rows={f.rows}
                className={`mt-1 border-${f.color}-200`}
                placeholder={`Enter ${f.label.toLowerCase()}...`}
                data-ocid={`admission_history.${f.key}_input`}
              />
            </div>
          ))}

          {/* Save controls */}
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              data-ocid="admission_history.save_button"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {viewerRole === "intern_doctor" ? "Save as Draft" : "Save & Lock"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Existing Records ── */}
      {records.map((record) => {
        const isLocked = record.status === "complete";
        const canEdit = canEditForm(record, viewerRole);
        const pendingChangeRequests = record.changeRequests.filter(
          (cr) => !cr.resolved,
        );

        return (
          <div
            key={record.id}
            className={`rounded-xl border shadow-sm overflow-hidden ${
              isLocked ? "border-gray-300" : "border-amber-300"
            }`}
            data-ocid="admission_history.record"
          >
            {/* Record header */}
            <div
              className={`flex items-center justify-between px-5 py-3 ${
                isLocked ? "bg-gray-50" : "bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-800">
                    Admission —{" "}
                    {format(new Date(record.admittedOn), "d MMM yyyy")}
                  </span>
                </div>
                {statusBadge(record.status)}
                <span className="text-xs text-gray-400">
                  By {record.admittedBy} ·{" "}
                  {STAFF_ROLE_LABELS[record.admittedByRole] ??
                    record.admittedByRole}
                </span>
                {record.hospitalName && (
                  <span className="text-xs text-gray-500">
                    📍 {record.hospitalName}
                    {record.ward ? ` · Ward: ${record.ward}` : ""}
                    {record.bed ? ` · Bed: ${record.bed}` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Approval buttons for Consultant/MO if draft */}
                {!isLocked && canApprove && (
                  <>
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      onClick={() => handleApprove(record.id)}
                      data-ocid="admission_history.approve_button"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs border-amber-400 text-amber-700 gap-1"
                      onClick={() =>
                        setShowChangeInput((prev) => ({
                          ...prev,
                          [record.id]: !prev[record.id],
                        }))
                      }
                      data-ocid="admission_history.request_changes_button"
                    >
                      <MessageSquare className="w-3 h-3" /> Request Changes
                    </Button>
                  </>
                )}
                {/* Edit button (only when editable) */}
                {!isLocked && canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs border-blue-300 text-blue-700 gap-1"
                    onClick={() => openEditForm(record)}
                    data-ocid="admission_history.edit_button"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                )}
                {/* Unlock button (Consultant/Admin only, when locked) */}
                {isLocked && canUnlock && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs border-gray-400 text-gray-600 gap-1"
                    onClick={() => setConfirmUnlock(record.id)}
                    data-ocid="admission_history.unlock_button"
                  >
                    <LockOpen className="w-3 h-3" /> Unlock to Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Change request comment box */}
            {showChangeInput[record.id] && (
              <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 flex gap-2">
                <Input
                  placeholder="Describe what needs to be changed..."
                  value={changeComment[record.id] || ""}
                  onChange={(e) =>
                    setChangeComment((prev) => ({
                      ...prev,
                      [record.id]: e.target.value,
                    }))
                  }
                  className="flex-1 text-sm"
                  data-ocid="admission_history.change_comment_input"
                />
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                  onClick={() => handleRequestChanges(record.id)}
                >
                  Send
                </Button>
              </div>
            )}

            {/* Pending change requests shown to intern */}
            {pendingChangeRequests.length > 0 && (
              <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700">
                  📌 Pending Change Requests:
                </p>
                {pendingChangeRequests.map((cr) => (
                  <div
                    key={cr.id}
                    className="text-xs text-amber-800 bg-amber-100 rounded-lg px-3 py-1.5"
                  >
                    <span className="font-semibold">{cr.requestedBy}</span> (
                    {STAFF_ROLE_LABELS[cr.requestedByRole] ??
                      cr.requestedByRole}
                    ): <span className="italic">{cr.comment}</span>
                    <span className="text-amber-600 ml-2">
                      {format(new Date(cr.requestedAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Unlock confirm panel */}
            {confirmUnlock === record.id && (
              <div className="px-5 py-3 bg-red-50 border-t border-red-200 space-y-2">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> This will create an
                  audit log entry. Continue?
                </p>
                <Input
                  placeholder="Reason for unlocking..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="text-sm"
                  data-ocid="admission_history.unlock_reason_input"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleUnlock(record.id)}
                    data-ocid="admission_history.confirm_unlock_button"
                  >
                    Confirm Unlock
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setConfirmUnlock(null);
                      setUnlockReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Record body — read-only view */}
            <div className="p-5 bg-white space-y-4">
              {/* Approval info */}
              {record.approvedBy && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                  ✅ Approved by <strong>{record.approvedBy}</strong> (
                  {record.approvedByRole &&
                    (STAFF_ROLE_LABELS[record.approvedByRole] ??
                      record.approvedByRole)}
                  ) on{" "}
                  {record.approvedAt
                    ? format(new Date(record.approvedAt), "d MMM yyyy, h:mm a")
                    : "—"}
                </div>
              )}

              {/* Chief Complaints */}
              {record.chiefComplaints.some((c) => c.complaint) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-800 mb-2 uppercase">
                    Chief Complaints at Admission
                  </p>
                  <div className="space-y-1">
                    {record.chiefComplaints
                      .filter((c) => c.complaint)
                      .map((c) => (
                        <p
                          key={`rcc-${c.complaint}-${c.duration}`}
                          className="text-sm text-blue-700"
                        >
                          • {c.complaint}
                          {c.duration ? ` — ${c.duration}` : ""}
                          {c.notes ? ` (${c.notes})` : ""}
                        </p>
                      ))}
                  </div>
                </div>
              )}

              {/* Clinical sections */}
              {(
                [
                  {
                    key: "historyOfPresentIllness",
                    label: "History of Present Illness",
                    color: "blue",
                  },
                  {
                    key: "pastMedicalHistory",
                    label: "Past Medical & Surgical History",
                    color: "green",
                  },
                  { key: "drugHistory", label: "Drug History", color: "amber" },
                  { key: "allergies", label: "Allergies", color: "red" },
                  {
                    key: "physicalExamination",
                    label: "Physical Examination",
                    color: "rose",
                  },
                  {
                    key: "provisionalDiagnosis",
                    label: "Provisional Diagnosis",
                    color: "purple",
                  },
                  {
                    key: "initialPlan",
                    label: "Initial Plan",
                    color: "indigo",
                  },
                ] as const
              )
                .filter(
                  (f) =>
                    record[f.key as keyof AdmissionHistoryRecord] &&
                    String(
                      record[f.key as keyof AdmissionHistoryRecord],
                    ).trim(),
                )
                .map((f) => (
                  <div
                    key={f.key}
                    className={`bg-${f.color}-50 border border-${f.color}-200 rounded-lg p-3`}
                  >
                    <p
                      className={`text-xs font-bold text-${f.color}-800 mb-1 uppercase`}
                    >
                      {f.label}
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {String(record[f.key as keyof AdmissionHistoryRecord])}
                    </p>
                  </div>
                ))}

              {/* Audit log (collapsed by default) */}
              {record.auditLog.length > 0 && canApprove && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer font-semibold text-gray-600 hover:text-gray-800">
                    🗒 Audit Log ({record.auditLog.length} entries)
                  </summary>
                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-200">
                    {record.auditLog.map((entry) => (
                      <p
                        key={`audit-${entry.at}-${entry.by}`}
                        className="text-xs text-gray-500"
                      >
                        <span className="font-medium text-gray-700">
                          {entry.action}
                        </span>{" "}
                        — {entry.by} ·{" "}
                        {format(new Date(entry.at), "MMM d, yyyy h:mm a")}
                        {entry.reason ? ` · Reason: ${entry.reason}` : ""}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
