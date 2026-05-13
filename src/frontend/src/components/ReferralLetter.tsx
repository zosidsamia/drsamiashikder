/**
 * ReferralLetter — generates a printable referral letter and tracks status.
 * Props: patientId, patient, lastVisit, onClose
 * Storage: localStorage key referrals_${email}_${patientId}
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Printer,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { getDoctorEmail } from "../hooks/useQueries";
import type { Patient, Prescription, Visit } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReferralUrgency = "Routine" | "Urgent" | "Emergency";
export type ReferralStatus = "Draft" | "Sent" | "Accepted" | "Completed";

export interface ReferralRecord {
  id: string;
  date: string; // ISO
  specialist: string;
  department: string;
  hospital: string;
  urgency: ReferralUrgency;
  reason: string;
  clinicalSummary: string;
  currentMedications: string;
  currentVitals: string;
  status: ReferralStatus;
  createdAt: string;
  createdBy: string; // doctor name
}

const SPECIALIST_SUGGESTIONS = [
  "Cardiology",
  "Nephrology",
  "Neurology",
  "Orthopedics",
  "Gastroenterology",
  "Oncology",
  "ENT",
  "Ophthalmology",
  "Psychiatry",
  "Surgery",
  "Dermatology",
  "Endocrinology",
  "Pulmonology",
  "Rheumatology",
  "Urology",
  "Other",
];

const STATUS_COLORS: Record<ReferralStatus, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-100 text-blue-700 border-blue-200",
  Accepted: "bg-amber-100 text-amber-700 border-amber-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
};

const URGENCY_COLORS: Record<ReferralUrgency, string> = {
  Routine: "bg-gray-100 text-gray-700 border-gray-300",
  Urgent: "bg-amber-100 text-amber-800 border-amber-400",
  Emergency: "bg-red-100 text-red-800 border-red-400",
};

// ── Persistence ───────────────────────────────────────────────────────────────

function storageKey(email: string, patientId: string): string {
  return `referrals_${email}_${patientId}`;
}

export function loadReferrals(
  email: string,
  patientId: string,
): ReferralRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(email, patientId));
    return raw ? (JSON.parse(raw) as ReferralRecord[]) : [];
  } catch {
    return [];
  }
}

function saveReferrals(
  email: string,
  patientId: string,
  records: ReferralRecord[],
) {
  localStorage.setItem(storageKey(email, patientId), JSON.stringify(records));
}

// ── Active medications helper ─────────────────────────────────────────────────

function getActiveMeds(patientId: string): string {
  const meds: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("prescriptions_")) continue;
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as Array<{
        patientId?: string | bigint;
        medications?: Array<{
          drugForm?: string;
          drugName?: string;
          name?: string;
          dose?: string;
          frequency?: string;
        }>;
      }>;
      for (const rx of arr) {
        if (String(rx.patientId) !== patientId) continue;
        for (const m of rx.medications ?? []) {
          const label = [
            m.drugForm || "",
            m.drugName || m.name || "",
            m.dose || "",
            m.frequency || "",
          ]
            .filter(Boolean)
            .join(" ")
            .trim();
          if (label && !meds.includes(label)) meds.push(label);
        }
      }
    }
  } catch {}
  return meds.slice(0, 15).join(", ");
}

// ── Print styles ──────────────────────────────────────────────────────────────

const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    #referral-print-area, #referral-print-area * { visibility: visible; }
    #referral-print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 32px; }
    .no-print { display: none !important; }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface ReferralLetterProps {
  patientId: string;
  patient: Patient;
  lastVisit: Visit | null;
  onClose: () => void;
}

export default function ReferralLetter({
  patientId,
  patient,
  lastVisit,
  onClose,
}: ReferralLetterProps) {
  const { currentDoctor } = useEmailAuth();
  const email = getDoctorEmail() ?? currentDoctor?.email ?? "default";
  const doctorName = currentDoctor?.name ?? "Dr.";
  const doctorDegree = currentDoctor?.degree ?? "";
  const doctorHospital = currentDoctor?.hospital ?? "";

  // ── Auto-fill helpers ──────────────────────────────────────────────────────
  const defaultClinicalSummary = useMemo(() => {
    const parts: string[] = [];
    if (lastVisit?.chiefComplaint)
      parts.push(`Chief Complaint: ${lastVisit.chiefComplaint}`);
    if (lastVisit?.diagnosis) parts.push(`Diagnosis: ${lastVisit.diagnosis}`);
    if (lastVisit?.physicalExamination)
      parts.push(`Examination: ${lastVisit.physicalExamination}`);
    return parts.join("\n");
  }, [lastVisit]);

  const defaultMeds = useMemo(() => getActiveMeds(patientId), [patientId]);

  const defaultVitals = useMemo(() => {
    const v = lastVisit?.vitalSigns;
    if (!v) return "";
    const parts: string[] = [];
    if (v.bloodPressure) parts.push(`BP: ${v.bloodPressure} mmHg`);
    if (v.pulse) parts.push(`Pulse: ${v.pulse} bpm`);
    if (v.oxygenSaturation) parts.push(`SpO₂: ${v.oxygenSaturation}%`);
    if (v.temperature) parts.push(`Temp: ${v.temperature}°C`);
    if (v.respiratoryRate) parts.push(`RR: ${v.respiratoryRate}/min`);
    return parts.join(", ");
  }, [lastVisit]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [specialist, setSpecialist] = useState("");
  const [department, setDepartment] = useState("");
  const [hospital, setHospital] = useState("");
  const [urgency, setUrgency] = useState<ReferralUrgency>("Routine");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState(
    defaultClinicalSummary,
  );
  const [meds, setMeds] = useState(defaultMeds);
  const [vitals, setVitals] = useState(defaultVitals);
  const [showLetter, setShowLetter] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Referral history ───────────────────────────────────────────────────────
  const [referrals, setReferrals] = useState<ReferralRecord[]>(() =>
    loadReferrals(email, patientId),
  );

  useEffect(() => {
    setReferrals(loadReferrals(email, patientId));
  }, [email, patientId]);

  // ── Age helper ─────────────────────────────────────────────────────────────
  const age = useMemo(() => {
    if (!patient.dateOfBirth) return "—";
    const ms = Number(patient.dateOfBirth / 1000000n);
    const years = Math.floor((Date.now() - ms) / (365.25 * 24 * 3600 * 1000));
    return `${years} years`;
  }, [patient.dateOfBirth]);

  // ── Generate letter ────────────────────────────────────────────────────────
  function handleGenerate() {
    if (!specialist.trim() || !reason.trim()) {
      toast.error("Please fill Specialist and Reason for Referral");
      return;
    }
    setShowLetter(true);
  }

  // ── Save & print ───────────────────────────────────────────────────────────
  function handleSaveAndPrint() {
    if (!specialist.trim() || !reason.trim()) {
      toast.error("Please fill Specialist and Reason for Referral");
      return;
    }
    const rec: ReferralRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      date: new Date().toISOString().split("T")[0],
      specialist: specialist.trim(),
      department: department.trim(),
      hospital: hospital.trim(),
      urgency,
      reason: reason.trim(),
      clinicalSummary: clinicalSummary.trim(),
      currentMedications: meds.trim(),
      currentVitals: vitals.trim(),
      status: "Sent",
      createdAt: new Date().toISOString(),
      createdBy: doctorName,
    };
    const updated = [rec, ...referrals];
    setReferrals(updated);
    saveReferrals(email, patientId, updated);
    setShowLetter(true);
    setTimeout(() => window.print(), 300);
    toast.success("Referral letter saved and sent to print");
  }

  // ── Update status ──────────────────────────────────────────────────────────
  function updateStatus(id: string, status: ReferralStatus) {
    const updated = referrals.map((r) => (r.id === id ? { ...r, status } : r));
    setReferrals(updated);
    saveReferrals(email, patientId, updated);
    toast.success(`Status updated to ${status}`);
  }

  const todayStr = format(new Date(), "dd MMMM yyyy");

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div className="space-y-5" data-ocid="referral.panel">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Referral Letter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            data-ocid="referral.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Referring Doctor (auto-filled) */}
            <div>
              <Label className="text-xs font-semibold">Referring Doctor</Label>
              <Input
                value={`${doctorName}${doctorDegree ? `, ${doctorDegree}` : ""}`}
                readOnly
                className="mt-1 bg-white/70 text-sm"
                data-ocid="referral.input"
              />
            </div>
            {/* Hospital */}
            <div>
              <Label className="text-xs font-semibold">
                Referring from Hospital
              </Label>
              <Input
                value={hospital || doctorHospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="Hospital / Clinic name"
                className="mt-1 text-sm"
                data-ocid="referral.hospital.input"
              />
            </div>
          </div>

          {/* Specialist */}
          <div className="relative">
            <Label className="text-xs font-semibold">
              Specialist / Department *
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={specialist}
                onChange={(e) => setSpecialist(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Cardiology"
                className="flex-1 text-sm"
                data-ocid="referral.specialist.input"
              />
              {showSuggestions && (
                <div className="absolute top-[60px] left-0 right-0 z-20 bg-white border border-blue-200 rounded-xl shadow-lg py-1 max-h-44 overflow-y-auto">
                  {SPECIALIST_SUGGESTIONS.filter((s) =>
                    s.toLowerCase().includes(specialist.toLowerCase()),
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700"
                      onMouseDown={() => {
                        setSpecialist(s);
                        setDepartment(s);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Chip quick-selects */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {SPECIALIST_SUGGESTIONS.slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSpecialist(s);
                    setDepartment(s);
                  }}
                  className="text-[10px] bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Referring to Hospital */}
          <div>
            <Label className="text-xs font-semibold">
              Refer To — Hospital / Facility
            </Label>
            <Input
              value={hospital === doctorHospital ? "" : hospital}
              onChange={(e) => setHospital(e.target.value)}
              placeholder="Name of referral hospital"
              className="mt-1 text-sm"
              data-ocid="referral.to_hospital.input"
            />
          </div>

          {/* Urgency */}
          <div>
            <Label className="text-xs font-semibold">Urgency</Label>
            <div
              className="flex gap-2 mt-1.5"
              data-ocid="referral.urgency.toggle"
            >
              {(["Routine", "Urgent", "Emergency"] as ReferralUrgency[]).map(
                (u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      urgency === u
                        ? `${URGENCY_COLORS[u]} ring-2 ring-offset-1 ring-current`
                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {u}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label className="text-xs font-semibold">
              Reason for Referral *
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the clinical indication for referral..."
              rows={2}
              className="mt-1 text-sm"
              data-ocid="referral.reason.textarea"
            />
          </div>

          {/* Clinical Summary */}
          <div>
            <Label className="text-xs font-semibold">Clinical Summary</Label>
            <Textarea
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="Chief complaints, diagnosis, examination findings..."
              rows={3}
              className="mt-1 text-sm"
              data-ocid="referral.summary.textarea"
            />
          </div>

          {/* Medications */}
          <div>
            <Label className="text-xs font-semibold">Current Medications</Label>
            <Textarea
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
              placeholder="Active medications..."
              rows={2}
              className="mt-1 text-sm"
              data-ocid="referral.meds.textarea"
            />
          </div>

          {/* Vitals */}
          <div>
            <Label className="text-xs font-semibold">Current Vital Signs</Label>
            <Input
              value={vitals}
              onChange={(e) => setVitals(e.target.value)}
              placeholder="BP, Pulse, SpO₂, Temp..."
              className="mt-1 text-sm"
              data-ocid="referral.vitals.input"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-1">
            <Button
              onClick={handleGenerate}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              data-ocid="referral.generate_button"
            >
              <FileText className="w-3.5 h-3.5" />
              Preview Letter
            </Button>
            <Button
              onClick={handleSaveAndPrint}
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              data-ocid="referral.save_button"
            >
              <Printer className="w-3.5 h-3.5" />
              Save & Print
            </Button>
          </div>
        </div>

        {/* Print area — rendered letter */}
        {showLetter && (
          <div
            id="referral-print-area"
            className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm space-y-4 text-sm leading-relaxed"
          >
            {/* Urgency banner */}
            {urgency !== "Routine" && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 border font-bold text-sm ${
                  urgency === "Emergency"
                    ? "bg-red-100 border-red-400 text-red-800"
                    : "bg-amber-100 border-amber-400 text-amber-800"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {urgency === "Emergency"
                  ? "⚠️ EMERGENCY REFERRAL"
                  : "⚠️ URGENT REFERRAL"}
              </div>
            )}

            {/* Header */}
            <div className="text-center border-b pb-4">
              <p className="font-bold text-lg">
                {doctorName}
                {doctorDegree ? `, ${doctorDegree}` : ""}
              </p>
              {doctorHospital && (
                <p className="text-gray-600">{doctorHospital}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Date: {todayStr}</p>
            </div>

            {/* To */}
            <div>
              <p className="font-semibold text-gray-800">To,</p>
              <p>
                The Specialist, {specialist}
                {department && department !== specialist
                  ? ` / ${department}`
                  : ""}
              </p>
              {hospital && hospital !== doctorHospital && (
                <p className="text-gray-600">{hospital}</p>
              )}
            </div>

            {/* Subject */}
            <p className="font-semibold">
              Subject: Referral of Patient —{" "}
              {urgency !== "Routine" && `[${urgency.toUpperCase()}] `}
              {patient.fullName}
            </p>

            {/* Patient details */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs">
              <p>
                <strong>Patient Name:</strong> {patient.fullName}
              </p>
              <p>
                <strong>Age / Sex:</strong> {age} /{" "}
                {patient.gender === "male"
                  ? "Male"
                  : patient.gender === "female"
                    ? "Female"
                    : "Other"}
              </p>
              {patient.registerNumber && (
                <p>
                  <strong>Register No.:</strong> {patient.registerNumber}
                </p>
              )}
              {patient.bloodGroup && (
                <p>
                  <strong>Blood Group:</strong> {patient.bloodGroup}
                </p>
              )}
            </div>

            {/* Clinical summary */}
            {clinicalSummary && (
              <div>
                <p className="font-semibold mb-1">Clinical Summary:</p>
                <p className="whitespace-pre-line text-gray-700">
                  {clinicalSummary}
                </p>
              </div>
            )}

            {/* Reason */}
            <div>
              <p className="font-semibold mb-1">Reason for Referral:</p>
              <p className="whitespace-pre-line text-gray-700">{reason}</p>
            </div>

            {/* Medications */}
            {meds && (
              <div>
                <p className="font-semibold mb-1">Current Medications:</p>
                <p className="text-gray-700">{meds}</p>
              </div>
            )}

            {/* Vitals */}
            {vitals && (
              <div>
                <p className="font-semibold mb-1">Current Vital Signs:</p>
                <p className="text-gray-700">{vitals}</p>
              </div>
            )}

            {/* Closing */}
            <p>
              Kindly see and manage this patient as appropriate. Please do not
              hesitate to contact me should you require further information.
            </p>
            <p>Thank you for your kind assistance.</p>

            {/* Signature */}
            <div className="pt-8 border-t mt-4">
              <p className="font-semibold">{doctorName}</p>
              {doctorDegree && (
                <p className="text-gray-600 text-xs">{doctorDegree}</p>
              )}
              {doctorHospital && (
                <p className="text-gray-600 text-xs">{doctorHospital}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">{todayStr}</p>
            </div>
          </div>
        )}

        {/* Print button if letter is showing */}
        {showLetter && (
          <div className="flex gap-2 no-print">
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              data-ocid="referral.print_button"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLetter(false)}
              data-ocid="referral.close_button"
            >
              Close Preview
            </Button>
          </div>
        )}

        {/* ── Referral History ── */}
        {referrals.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              Referral History ({referrals.length})
            </h3>
            {referrals.map((r, idx) => (
              <ReferralHistoryRow
                key={r.id}
                record={r}
                index={idx}
                onUpdateStatus={updateStatus}
              />
            ))}
          </div>
        )}

        {referrals.length === 0 && !showLetter && (
          <div
            className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border"
            data-ocid="referral.empty_state"
          >
            <ExternalLink className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No referrals recorded yet
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Referral History Row ───────────────────────────────────────────────────────

function ReferralHistoryRow({
  record,
  index,
  onUpdateStatus,
}: {
  record: ReferralRecord;
  index: number;
  onUpdateStatus: (id: string, status: ReferralStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-border rounded-xl overflow-hidden"
      data-ocid={`referral.item.${index + 1}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Badge
            className={`text-[10px] border px-1.5 py-0 ${STATUS_COLORS[record.status]}`}
          >
            {record.status}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {record.specialist}
            {record.department && record.department !== record.specialist
              ? ` / ${record.department}`
              : ""}
          </span>
          {record.urgency !== "Routine" && (
            <Badge
              className={`text-[10px] border px-1.5 py-0 ${URGENCY_COLORS[record.urgency]}`}
            >
              {record.urgency}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {record.date ? format(new Date(record.date), "dd MMM yyyy") : "—"}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-2 bg-white border-t border-border">
          {record.hospital && (
            <p className="text-xs text-muted-foreground">
              <strong>Hospital:</strong> {record.hospital}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            <strong>Reason:</strong> {record.reason}
          </p>
          {record.clinicalSummary && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              <strong>Summary:</strong> {record.clinicalSummary}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            <strong>By:</strong> {record.createdBy}
          </p>

          {/* Status update */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <span className="text-xs font-medium text-foreground">
              Update Status:
            </span>
            <Select
              value={record.status}
              onValueChange={(v) =>
                onUpdateStatus(record.id, v as ReferralStatus)
              }
            >
              <SelectTrigger
                className="h-7 text-xs w-32"
                data-ocid={`referral.status.select.${index + 1}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ["Draft", "Sent", "Accepted", "Completed"] as ReferralStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {record.status === "Completed" && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
