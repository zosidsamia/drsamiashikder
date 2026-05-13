import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Principal } from "@icp-sdk/core/principal";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bell,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  Edit,
  FileText,
  FlaskConical,
  Heart,
  Home,
  LayoutDashboard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  PlusCircle,
  Printer,
  Scissors,
  Search,
  Settings,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wind,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import AIAssistantPanel from "../components/AIAssistantPanel";
import HistoryFeaturesPanel from "../components/HistoryFeatures";
import NewPrescriptionMode from "../components/NewPrescriptionMode";
import PatientForm from "../components/PatientForm";
import {
  AccountTab,
  AdviceTab,
  AppointmentsTab,
  ChatTab,
  ComplaintsTab,
  HandoverTab,
  InvPaymentTab,
  PendingTab,
  ProceduresTab,
  ReferralsTab,
  SOAPNotesTab,
  TimelineTab,
} from "../components/PatientTabs";
import {
  CurrentMedicationList,
  FirstPrescriptionLabel,
  PrescriptionDiffRow,
  ViewedByPatientBadge,
} from "../components/PrescriptionEnhancements";
import PrescriptionForm from "../components/PrescriptionForm";
import PrescriptionPad from "../components/PrescriptionPad";
import UpgradedPrescriptionEMR from "../components/UpgradedPrescriptionEMR";
import VisitForm from "../components/VisitForm";
import { loadFamilyHistoryRisk } from "../components/patientDashboardTypes";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { loadRegistry } from "../hooks/useEmailAuth";
import {
  getDoctorEmail,
  getVisitFormData,
  useAcknowledgeAlert,
  useCreateObservation,
  useCreatePrescription,
  useCreateVisit,
  useGetAlertsByPatient,
  useGetAuditTrail,
  useGetClinicalNotesByPatient,
  useGetEncountersByPatient,
  useGetObservationsByPatient,
  useGetPatient,
  useGetPrescriptionsByPatient,
  useGetVisitsByPatient,
  useReassignConsultant,
  useUpdatePatient,
} from "../hooks/useQueries";
import { useRolePermissions } from "../hooks/useRolePermissions";
import {
  analyzeVitalTrends,
  checkVitalAlerts,
} from "../lib/clinicalIntelligence";
import type { Patient, Prescription, StaffRole, Visit } from "../types";

const RX_SKELETON_KEYS = ["rsk1", "rsk2", "rsk3"];
// ── On-Duty Staff Card ──────────────────────────────────────────────────────────────

function getCurrentShiftType(): "morning" | "evening" | "night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "morning";
  if (h >= 14 && h < 22) return "evening";
  return "night";
}

function OnDutyStaffCard({
  ward,
  patientName,
  registerNumber,
}: {
  ward: string;
  patientName: string;
  registerNumber: string;
}) {
  if (!ward) return null;
  const today = new Date().toISOString().split("T")[0];
  const currentShift = getCurrentShiftType();

  const shifts: Array<{
    staffId: string;
    staffName: string;
    shiftType: string;
    startDate: string;
    endDate: string;
    ward: string;
  }> = (() => {
    try {
      const raw = localStorage.getItem("staff_shifts");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  const registry: Array<{
    id: string;
    name: string;
    role: string;
    phone?: string;
    status: string;
  }> = (() => {
    try {
      const raw = localStorage.getItem("registry");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  const wardShifts = shifts.filter(
    (s) =>
      s.ward.toLowerCase() === ward.toLowerCase() &&
      today >= s.startDate &&
      today <= s.endDate &&
      s.shiftType === currentShift,
  );

  const dutyStaff = wardShifts
    .map((s) => {
      const acc = registry.find(
        (r) => r.id === s.staffId && r.status === "approved",
      );
      if (!acc) return null;
      return {
        ...acc,
        shiftType: s.shiftType as "morning" | "evening" | "night",
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    role: string;
    phone?: string;
    shiftType: "morning" | "evening" | "night";
  }>;

  const moOnDuty = dutyStaff.find(
    (s) => s.role === "medical_officer" || s.role === "doctor",
  );
  const nurseOnDuty = dutyStaff.find((s) => s.role === "nurse");
  const shiftLabel: Record<string, string> = {
    morning: "Morning (6AM–2PM)",
    evening: "Evening (2PM–10PM)",
    night: "Night (10PM–6AM)",
  };
  const msgText = encodeURIComponent(
    `Regarding patient ${patientName} (${registerNumber}) in ${ward}`,
  );

  if (!moOnDuty && !nurseOnDuty) {
    return (
      <div
        className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 flex items-center gap-2"
        data-ocid="patient_profile.on_duty.empty_state"
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        No staff assigned to <strong className="mx-1">{ward}</strong> for
        current shift
      </div>
    );
  }

  return (
    <div
      className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 space-y-2"
      data-ocid="patient_profile.on_duty.card"
    >
      <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        On Duty — {ward} · {shiftLabel[currentShift]}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(
          [
            { label: "MO on Duty", person: moOnDuty },
            { label: "Nurse on Duty", person: nurseOnDuty },
          ] as const
        ).map(({ label, person }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-2 bg-white/60 rounded-lg px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground">
                {label}
              </p>
              {person ? (
                <p className="text-xs font-semibold text-foreground truncate">
                  {person.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Not assigned
                </p>
              )}
            </div>
            {person?.phone && (
              <a
                href={`https://wa.me/${person.phone.replace(/[^0-9]/g, "")}?text=${msgText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-[10px] font-semibold bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 transition-colors"
                data-ocid="patient_profile.on_duty.button"
              >
                WhatsApp
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reassign Consultant Modal ─────────────────────────────────────────────────

function ReassignConsultantModal({
  open,
  onClose,
  patientId,
  currentConsultantEmail,
  currentUserEmail,
  currentUserName,
  currentUserRole,
}: {
  open: boolean;
  onClose: () => void;
  patientId: bigint;
  currentConsultantEmail?: string;
  currentUserEmail: string;
  currentUserName: string;
  currentUserRole: import("../types").StaffRole;
}) {
  const [selectedEmail, setSelectedEmail] = useState(
    currentConsultantEmail ?? "",
  );
  const reassignMutation = useReassignConsultant();
  const consultants = loadRegistry().filter(
    (d) =>
      d.status === "approved" &&
      (d.role === "consultant_doctor" || d.role === "doctor"),
  );

  const handleSave = () => {
    const consultant = consultants.find((c) => c.email === selectedEmail);
    if (!consultant) {
      toast.error("Please select a consultant");
      return;
    }
    reassignMutation.mutate(
      {
        patientId,
        newConsultant: { email: consultant.email, name: consultant.name },
        assignedBy: currentUserEmail,
        assignedByName: currentUserName,
        assignedByRole: currentUserRole,
      },
      {
        onSuccess: () => {
          toast.success(`Consultant assigned to ${consultant.name}`);
          onClose();
        },
        onError: () => toast.error("Failed to reassign consultant"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-sm"
        data-ocid="patient_profile.reassign_consultant.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            Assign / Reassign Consultant
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {consultants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved Consultant Doctors found in the system.
            </p>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Consultant</Label>
              <select
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-ocid="patient_profile.reassign_consultant.select"
              >
                <option value="">— Select Consultant —</option>
                {consultants.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name}
                    {c.designation ? ` — ${c.designation}` : ""}
                    {c.email === currentConsultantEmail ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                reassignMutation.isPending ||
                !selectedEmail ||
                consultants.length === 0
              }
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-ocid="patient_profile.reassign_consultant.save_button"
            >
              {reassignMutation.isPending ? "Saving…" : "Save Assignment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getAge(dateOfBirth?: bigint): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(Number(dateOfBirth / 1000000n));
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function formatTime(time: bigint): string {
  return format(new Date(Number(time / 1000000n)), "MMM d, yyyy");
}

// ── Doctor Decision Dashboard Overview Tab ────────────────────────────────────

function OverviewTab({
  patientId,
  patient,
  visits,
  prescriptions,
  onTabChange,
}: {
  patientId: bigint;
  patient: {
    weight?: number;
    height?: number;
    admissionDate?: string | unknown;
    chronicConditions: string[];
  };
  visits: Visit[];
  prescriptions: Prescription[];
  onTabChange: (tab: string) => void;
}) {
  const { data: storedAlerts = [] } = useGetAlertsByPatient(patientId);
  const { data: observations = [] } = useGetObservationsByPatient(patientId);
  const acknowledgeAlert = useAcknowledgeAlert();

  const latestVisit =
    visits.length > 0
      ? [...visits].sort((a, b) => Number(b.visitDate - a.visitDate))[0]
      : null;

  const currentVitals = (() => {
    if (!latestVisit) return null;
    try {
      const email = getDoctorEmail();
      const raw = localStorage.getItem(
        `visit_form_data_${latestVisit.id}_${email}`,
      );
      if (raw)
        return (
          (JSON.parse(raw).vitalSigns as Record<string, string | undefined>) ??
          null
        );
    } catch {}
    return null;
  })();

  const vitalAlerts = currentVitals
    ? checkVitalAlerts({
        bloodPressure: currentVitals.bloodPressure,
        pulse: currentVitals.pulse,
        oxygenSaturation: currentVitals.oxygenSaturation,
        temperature: currentVitals.temperature,
        respiratoryRate: currentVitals.respiratoryRate,
      })
    : [];

  const activeAlerts = storedAlerts.filter(
    (a) => !a.isAcknowledged && !a.isResolved,
  );
  const totalAlerts = activeAlerts.length + vitalAlerts.length;
  const vitalTrends = analyzeVitalTrends(observations);

  const handleAcknowledgeAll = async () => {
    for (const alert of activeAlerts) {
      await acknowledgeAlert.mutateAsync(alert.id);
    }
    toast.success("All alerts acknowledged");
  };

  const weight = patient.weight;
  const height = patient.height;
  const bmi = weight && height ? weight / (height / 100) ** 2 : null;
  const bmiLabel = bmi
    ? bmi < 18.5
      ? "Underweight"
      : bmi < 25
        ? "Normal"
        : bmi < 30
          ? "Overweight"
          : "Obese"
    : null;
  const bmiColor = bmi
    ? bmi < 18.5
      ? "bg-blue-100 text-blue-700"
      : bmi < 25
        ? "bg-green-100 text-green-700"
        : bmi < 30
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700"
    : "";

  const mapValue = (() => {
    if (!currentVitals?.bloodPressure) return null;
    const parts = (currentVitals.bloodPressure as string)
      .split("/")
      .map(Number);
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    const [sys, dia] = parts;
    return Math.round(dia + (sys - dia) / 3);
  })();

  const daysAdmitted = patient.admissionDate
    ? Math.floor(
        (Date.now() - new Date(patient.admissionDate as string).getTime()) /
          (1000 * 3600 * 24),
      )
    : null;

  return (
    <div className="space-y-4" data-ocid="patient_profile.overview">
      {/* Critical Alerts */}
      <div
        className="bg-card border border-border rounded-xl p-4"
        data-ocid="patient_profile.alerts_section"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Clinical Alerts
          </h3>
          {totalAlerts > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAcknowledgeAll}
              className="h-7 text-xs gap-1"
              data-ocid="patient_profile.acknowledge_all.button"
            >
              <CheckCircle2 className="w-3 h-3" /> Acknowledge All
            </Button>
          )}
        </div>
        {totalAlerts === 0 ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              ✅ No Active Clinical Alerts
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {vitalAlerts.map((a, i) => (
              <div
                key={`vital-${a.field}-${i}`}
                className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${a.severity === "critical" ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}
                data-ocid={`patient_profile.alert.${i + 1}`}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  {a.severity === "critical" ? "🚨" : "⚠️"} {a.message}
                </p>
              </div>
            ))}
            {activeAlerts.map((a, i) => (
              <div
                key={a.id.toString()}
                className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800"
                data-ocid={`patient_profile.stored_alert.${i + 1}`}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.message}</p>
                  {a.details && (
                    <p className="text-xs opacity-80 mt-0.5 truncate">
                      {a.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Tasks */}
      <div
        className="bg-card border border-border rounded-xl p-4"
        data-ocid="patient_profile.pending_tasks_section"
      >
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-amber-500" />
          Pending Tasks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              label: "Prescriptions",
              count: prescriptions.length,
              tab: "prescriptions",
              color: "border-teal-200 text-teal-700",
            },
            {
              label: "Visits Recorded",
              count: visits.length,
              tab: "history",
              color: "border-purple-200 text-purple-700",
            },
            {
              label: "Pending Approvals",
              count: 0,
              tab: "approvals",
              color: "border-amber-200 text-amber-700",
            },
            {
              label: "Pending Lab Orders",
              count: 0,
              tab: "investigations",
              color: "border-blue-200 text-blue-700",
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onTabChange(item.tab)}
              className={`flex items-center justify-between bg-card border rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors ${item.color}`}
              data-ocid={`patient_profile.pending_task.${item.tab}`}
            >
              <span className="text-sm font-medium">{item.label}</span>
              <Badge
                variant="outline"
                className={`text-xs border ${item.color}`}
              >
                {item.count}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Stable Indicators */}
      <div
        className="bg-card border border-border rounded-xl p-4"
        data-ocid="patient_profile.stable_indicators_section"
      >
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Status Indicators
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {vitalAlerts.length === 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span className="text-xs text-green-700 font-medium">
                Vitals normal
              </span>
            </div>
          )}
          {daysAdmitted !== null && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-xs text-blue-700 font-medium">
                Day {daysAdmitted} admitted
              </span>
            </div>
          )}
          {bmi !== null && bmiLabel && (
            <div
              className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${bmiColor}`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-medium">
                BMI {bmi.toFixed(1)} — {bmiLabel}
              </span>
            </div>
          )}
          {mapValue !== null && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <Heart className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="text-xs text-rose-700 font-medium">
                MAP <strong>{mapValue}</strong> <strong>mmHg</strong>
              </span>
            </div>
          )}
          {totalAlerts === 0 && daysAdmitted !== null && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs text-emerald-700 font-medium">
                Discharge ready
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Vital Trends */}
      {vitalTrends.length > 0 && (
        <div
          className="bg-card border border-border rounded-xl p-4"
          data-ocid="patient_profile.trends_section"
        >
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            Vital Trends
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {vitalTrends.slice(0, 6).map((trend) => (
              <div
                key={trend.vital}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${trend.direction === "improving" ? "bg-green-50 border-green-200" : trend.direction === "worsening" ? "bg-red-50 border-red-200" : "bg-muted/40 border-border"}`}
                data-ocid={`patient_profile.trend.${trend.vital}`}
              >
                {trend.direction === "improving" ? (
                  <TrendingDown className="w-4 h-4 text-green-500" />
                ) : trend.direction === "worsening" ? (
                  <TrendingUp className="w-4 h-4 text-red-500" />
                ) : (
                  <Activity className="w-4 h-4 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {trend.vital}
                  </p>
                  <p
                    className={`text-xs truncate ${trend.direction === "improving" ? "text-green-700" : trend.direction === "worsening" ? "text-red-700" : "text-muted-foreground"}`}
                  >
                    {trend.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family History Risk Summary */}
      {(() => {
        const email = getDoctorEmail();
        const risk = loadFamilyHistoryRisk(email, patientId.toString());
        if (!risk) return null;
        const active: string[] = [];
        if (risk.diabetes) active.push("Diabetes");
        if (risk.hypertension) active.push("Hypertension");
        if (risk.ihd) active.push("IHD");
        if (risk.cancer) active.push("Cancer");
        if (risk.stroke) active.push("Stroke");
        if (active.length === 0) return null;
        return (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-4"
            data-ocid="patient_profile.family_risk_section"
          >
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2 text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Family History Risk
            </h3>
            <div className="flex flex-wrap gap-2">
              {active.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-2.5 py-1 text-xs font-semibold"
                >
                  🔴 {r}
                </span>
              ))}
            </div>
            {risk.additionalNotes && (
              <p className="text-xs text-amber-700 mt-2 italic">
                {risk.additionalNotes}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Audit Trail Tab ───────────────────────────────────────────────────────────

function AuditTab({ patientId }: { patientId: bigint }) {
  const { data: auditEntries = [] } = useGetAuditTrail(patientId);

  if (auditEntries.length === 0) {
    return (
      <div
        className="text-center py-12"
        data-ocid="patient_profile.audit.empty_state"
      >
        <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No audit entries for this patient yet.
        </p>
      </div>
    );
  }

  return (
    <div data-ocid="patient_profile.audit_tab">
      <p className="text-sm text-muted-foreground mb-3">
        {auditEntries.length} audit entries
      </p>
      <ScrollArea className="h-[55vh]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">Timestamp</TableHead>
              <TableHead className="text-xs">Changed By</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Field</TableHead>
              <TableHead className="text-xs text-amber-700">Before</TableHead>
              <TableHead className="text-xs text-green-700">After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditEntries.map((entry, idx) => {
              const changedAt = new Date(Number(entry.changedAt) / 1_000_000);
              return (
                <TableRow
                  key={entry.id.toString()}
                  data-ocid={`patient_profile.audit.item.${idx + 1}`}
                >
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(changedAt, "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {entry.changedByName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {entry.changedByRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{entry.fieldName}</TableCell>
                  <TableCell className="text-xs">
                    {entry.beforeValue ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-mono truncate block max-w-[100px]">
                        {entry.beforeValue}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 font-mono truncate block max-w-[100px]">
                      {entry.afterValue}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function formatDateTime(time: bigint): string {
  return format(new Date(Number(time / 1000000n)), "MMM d, yyyy 'at' h:mm a");
}

function PrescriptionCard({
  rx,
  index,
  onClick,
}: {
  rx: Prescription;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-card hover:border-primary/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-ocid={`patient_profile.prescriptions.item.${index + 1}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-secondary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {rx.diagnosis ?? "Prescription"}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(rx.prescriptionDate)}
            </span>
            <span>
              {rx.medications.length} medication
              {rx.medications.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PatientProfile() {
  const searchParams = useSearch({ strict: false }) as {
    id?: string;
    emergencyOnly?: boolean;
  };
  const navigate = useNavigate();
  const { currentDoctor } = useEmailAuth();
  const { isAdmin } = useAdminAuth();
  const permissions = useRolePermissions();
  const patientId = searchParams.id
    ? (() => {
        try {
          const s = String(searchParams.id);
          const raw = s.startsWith("__bigint__") ? s.slice(10) : s;
          const cleaned = raw.replace(/[^0-9]/g, "");
          return cleaned ? BigInt(cleaned) : null;
        } catch {
          return null;
        }
      })()
    : null;

  const [showEditForm, setShowEditForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [newVisitTemplate, setNewVisitTemplate] = useState<Visit | null>(null);
  const [showRxForm, setShowRxForm] = useState(false);
  const emergencyOnlyFilter =
    (searchParams as Record<string, unknown>).emergencyOnly === true;
  const setEmergencyOnlyFilter = (val: boolean) => {
    const url = new URL(window.location.href);
    if (val) {
      url.searchParams.set("emergencyOnly", "true");
    } else {
      url.searchParams.delete("emergencyOnly");
    }
    window.history.replaceState(null, "", url.toString());
    // Force a re-render by triggering a synthetic navigation
    void navigate({
      search: (prev: Record<string, unknown>) => prev,
    } as Parameters<typeof navigate>[0]);
  };
  const [rxInitialDiagnosis, setRxInitialDiagnosis] = useState<
    string | undefined
  >(undefined);
  const [rxVisitExtendedData, setRxVisitExtendedData] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [rxPatientRegisterNumber, setRxPatientRegisterNumber] = useState<
    string | undefined
  >(undefined);
  const [rxForceVisitData, setRxForceVisitData] = useState(false);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [editRx, setEditRx] = useState<Prescription | null>(null);
  const [invSearch, setInvSearch] = useState("");
  const [showPadPreview, setShowPadPreview] = useState(false);
  const [padPrescription, setPadPrescription] = useState<Prescription | null>(
    null,
  );
  const [showReassignConsultant, setShowReassignConsultant] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const role = (currentDoctor?.role ?? "staff") as StaffRole;
  const canViewAudit =
    isAdmin || role === "consultant_doctor" || permissions.canViewAuditTrail;
  const isDraftRole =
    role === "intern_doctor" && !permissions.canFinalizeClinicalNote;
  // Roles that can assign/reassign a consultant
  const canReassignConsultant =
    isAdmin ||
    role === "consultant_doctor" ||
    role === "doctor" ||
    role === "medical_officer";

  const { data: patient, isLoading: loadingPatient } = useGetPatient(patientId);
  const { data: visits = [], isLoading: _loadingVisits } =
    useGetVisitsByPatient(patientId);
  const { data: prescriptions = [], isLoading: loadingRx } =
    useGetPrescriptionsByPatient(patientId);
  const { data: observations = [] } = useGetObservationsByPatient(patientId);
  const { data: _encounters = [] } = useGetEncountersByPatient(patientId);
  const { data: _clinicalNotes = [] } = useGetClinicalNotesByPatient(patientId);

  const updateMutation = useUpdatePatient();
  const createVisitMutation = useCreateVisit();
  const createRxMutation = useCreatePrescription();
  const createObservation = useCreateObservation();

  // ── AI & Extra state ────────────────────────────────────────────────────────
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showLabImport, setShowLabImport] = useState(false);
  const [labImportName, setLabImportName] = useState("");
  const [labImportResult, setLabImportResult] = useState("");
  const [labImportUnit, setLabImportUnit] = useState("");
  const [labImportRefRange, setLabImportRefRange] = useState("");
  const [labImportDate, setLabImportDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [labImportSaving, setLabImportSaving] = useState(false);

  // ── Vital trend analysis ────────────────────────────────────────────────────
  const vitalTrends = useMemo(
    () => analyzeVitalTrends(observations),
    [observations],
  );

  const openRxForm = (diagnosis?: string, forVisitId?: bigint) => {
    setRxInitialDiagnosis(diagnosis);
    setRxForceVisitData(!!forVisitId);
    // Load visit extended data — try getVisitFormData first (uses broad key scan),
    // then fall back to direct localStorage key lookup.
    try {
      const targetVisitId =
        forVisitId ??
        (visits.length > 0
          ? [...visits].sort((a, b) => Number(b.visitDate - a.visitDate))[0]?.id
          : undefined);
      if (targetVisitId !== undefined) {
        // getVisitFormData does a multi-key scan and is more reliable
        const loaded = getVisitFormData(targetVisitId);
        if (loaded) {
          setRxVisitExtendedData(loaded as Record<string, unknown>);
        } else {
          // Fallback: scan localStorage directly
          const doctorEmail = getDoctorEmail();
          const keys = Object.keys(localStorage).filter(
            (k) =>
              k.startsWith(`visit_form_data_${targetVisitId}_`) ||
              k === `visit_form_data_${targetVisitId}_${doctorEmail}`,
          );
          if (keys.length > 0) {
            const raw = localStorage.getItem(keys[0]);
            if (raw) setRxVisitExtendedData(JSON.parse(raw));
          }
        }
      }
      // Load register number
      if (patientId) {
        const regRaw = localStorage.getItem(`patient_register_${patientId}`);
        if (regRaw) setRxPatientRegisterNumber(regRaw);
      }
    } catch {
      /* ignore */
    }
    setShowRxForm(true);
  };

  const closeRxForm = () => {
    setShowRxForm(false);
    setRxInitialDiagnosis(undefined);
    setRxForceVisitData(false);
  };

  const openPadPreview = (rx: Prescription) => {
    setPadPrescription(rx);
    setSelectedRx(null);
    setShowPadPreview(true);
  };

  if (loadingPatient) {
    return (
      <div
        className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4"
        data-ocid="patient_profile.loading_state"
      >
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div
          className="text-center py-20"
          data-ocid="patient_profile.error_state"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground mb-2">Patient not found</p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/Patients" })}
            className="mt-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  const age = getAge(patient.dateOfBirth);

  // Get doctor info from localStorage for sidebar
  function getDoctorSidebarInfo() {
    try {
      const data = localStorage.getItem("medicare_doctors_data");
      if (data) {
        const parsed = JSON.parse(data);
        const doc = parsed.drArman || Object.values(parsed)[0] || null;
        if (doc)
          return doc as {
            name?: string;
            specialty?: string;
            degree?: string;
            photo?: string;
          };
      }
    } catch {
      /* ignore */
    }
    const loggedIn = localStorage.getItem("medicare_logged_in_doctor");
    if (loggedIn) {
      try {
        return JSON.parse(loggedIn) as {
          name?: string;
          specialty?: string;
          degree?: string;
          photo?: string;
        };
      } catch {
        /* ignore */
      }
    }
    return null;
  }
  const doctorInfo = getDoctorSidebarInfo();

  // Get latest visit vitals
  const latestVisit =
    visits.length > 0
      ? [...visits].sort((a, b) => Number(b.visitDate - a.visitDate))[0]
      : null;

  function getLatestVitals() {
    if (!latestVisit) return null;
    try {
      const doctorEmail = getDoctorEmail();
      const key = `visit_form_data_${latestVisit.id}_${doctorEmail}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.vitalSigns as {
          bloodPressure?: string;
          pulse?: string;
          temperature?: string;
          oxygenSaturation?: string;
          weight?: string;
        } | null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  const vitals = getLatestVitals();

  // Get investigation rows
  function getInvestigationRows(): Array<{
    date: string;
    name: string;
    result: string;
    unit?: string;
    interpretation?: string;
  }> {
    if (!latestVisit) return [];
    try {
      const doctorEmail = getDoctorEmail();
      const key = `visit_form_data_${latestVisit.id}_${doctorEmail}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return (
          (parsed.previous_investigation_rows as Array<{
            date: string;
            name: string;
            result: string;
            unit?: string;
            interpretation?: string;
          }>) || []
        );
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  const DEFAULT_INVESTIGATIONS = [
    "Haemoglobin",
    "WBC Count",
    "Serum Creatinine",
    "Blood Glucose",
  ];
  const allInvRows = getInvestigationRows();
  const displayedRows = invSearch
    ? allInvRows.filter((r) =>
        r.name.toLowerCase().includes(invSearch.toLowerCase()),
      )
    : allInvRows.length > 0
      ? allInvRows
      : DEFAULT_INVESTIGATIONS.map((n) => ({
          date: "",
          name: n,
          result: "—",
          unit: "",
          interpretation: "",
        }));

  function vitalStatus(key: string, value: string): "normal" | "high" | "low" {
    if (!value || value === "—") return "normal";
    const num = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(num)) return "normal";
    if (key === "bloodPressure") {
      const systolic = Number.parseInt(value.split("/")[0] || "0");
      if (systolic > 140) return "high";
      if (systolic < 90) return "low";
    }
    if (key === "pulse") {
      if (num > 100) return "high";
      if (num < 60) return "low";
    }
    if (key === "temperature") {
      if (num > 37.5) return "high";
      if (num < 36) return "low";
    }
    if (key === "oxygenSaturation") {
      if (num < 95) return "low";
    }
    return "normal";
  }

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/Dashboard" },
    { label: "Patients", icon: Users, path: "/Patients" },
    { label: "Visits", icon: Stethoscope, path: "/Visits" },
    { label: "Prescriptions", icon: FileText, path: "/Prescriptions" },
    { label: "Appointments", icon: Calendar, path: "/Appointments" },
    { label: "Settings", icon: Settings, path: "/Settings" },
  ];

  return (
    <div
      className="flex min-h-screen bg-gray-50"
      data-ocid="patient_profile.page"
    >
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-200 sticky top-0 h-screen shadow-sm flex-shrink-0">
        {/* Doctor Profile */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {doctorInfo?.name ? doctorInfo.name.charAt(0).toUpperCase() : "D"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {doctorInfo?.name || "Dr. Arman Kabir"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {doctorInfo?.specialty || "General Medicine"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate({ to: item.path as "/" })}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                item.path === "/Patients"
                  ? "bg-teal-50 text-teal-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
              data-ocid="patient_profile.nav.link"
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-1.5 text-sm"
              data-ocid="patient_profile.panel"
            >
              <button
                type="button"
                onClick={() => navigate({ to: "/Patients" })}
                className="text-gray-500 hover:text-teal-600 transition-colors font-medium"
                data-ocid="patient_profile.link"
              >
                Patient
              </button>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                type="button"
                onClick={() => navigate({ to: "/Patients" })}
                className="text-gray-500 hover:text-teal-600 transition-colors"
              >
                Patient Details
              </button>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 font-semibold truncate max-w-[200px]">
                {patient.fullName}
              </span>
            </nav>
            {/* Header icons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                data-ocid="patient_profile.secondary_button"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                data-ocid="patient_profile.search_input"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* PAGE BODY */}
        <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* PATIENT PROFILE CARD */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6"
            data-ocid="patient_profile.card"
          >
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div
                className="w-18 h-18 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl font-bold text-white shadow"
                style={{
                  width: 72,
                  height: 72,
                  background: "linear-gradient(135deg, #0d9488, #0891b2)",
                }}
              >
                {patient.fullName.charAt(0).toUpperCase()}
              </div>

              {/* Name + email + button */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">
                      {patient.fullName}
                    </h1>
                    {patient.nameBn && (
                      <p className="text-sm text-gray-500">{patient.nameBn}</p>
                    )}
                    {patient.email && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3.5 h-3.5" /> {patient.email}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditForm(true)}
                    className="flex-shrink-0 gap-1.5 text-sm"
                    data-ocid="patient_profile.edit_button"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Profile
                  </Button>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                  {[
                    {
                      label: "Sex",
                      value: patient.gender || "—",
                      color: "bg-blue-50 text-blue-700",
                    },
                    {
                      label: "Age",
                      value: age !== null ? `${age} yrs` : "—",
                      color: "bg-emerald-50 text-emerald-700",
                    },
                    {
                      label: "Blood Group",
                      value:
                        patient.bloodGroup && patient.bloodGroup !== "unknown"
                          ? patient.bloodGroup
                          : "—",
                      color: "bg-red-50 text-red-700",
                    },
                    {
                      label: "Status",
                      value: patient.patientType || "OPD",
                      color: "bg-purple-50 text-purple-700",
                    },
                    {
                      label: "Department",
                      value: "General",
                      color: "bg-amber-50 text-amber-700",
                    },
                    {
                      label: "Registered",
                      value: patient.createdAt
                        ? format(
                            new Date(Number(patient.createdAt / 1000000n)),
                            "d MMM yyyy",
                          )
                        : "—",
                      color: "bg-gray-50 text-gray-600",
                    },
                    {
                      label: "Appointments",
                      value: String(visits.length),
                      color: "bg-teal-50 text-teal-700",
                    },
                    {
                      label: "Reg No",
                      value:
                        (patient as unknown as { registerNumber?: string })
                          .registerNumber || "—",
                      color: "bg-indigo-50 text-indigo-700",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className={`rounded-lg px-3 py-2 ${color}`}
                    >
                      <p className="text-xs font-medium opacity-70">{label}</p>
                      <p className="text-sm font-semibold mt-0.5 capitalize">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Alerts row */}
                {(patient.allergies.length > 0 ||
                  patient.chronicConditions.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {patient.allergies.length > 0 && (
                      <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-xs text-red-700 font-medium">
                          Allergies: {patient.allergies.join(", ")}
                        </span>
                      </div>
                    )}
                    {patient.chronicConditions.length > 0 && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1">
                        <Heart className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-amber-700 font-medium">
                          {patient.chronicConditions.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Consultant Assignment Row — shown for admitted patients */}
                {(patient.isAdmitted ||
                  patient.patientType === "admitted" ||
                  patient.patientType === "indoor") && (
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                        <Users className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        <span className="text-xs text-purple-800 font-medium truncate">
                          Consultant:{" "}
                          {patient.consultantAssignment?.name ?? (
                            <span className="italic font-normal text-purple-400">
                              Not assigned
                            </span>
                          )}
                        </span>
                      </div>
                      {canReassignConsultant && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowReassignConsultant(true)}
                          className="flex-shrink-0 gap-1 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 h-7 px-2"
                          data-ocid="patient_profile.reassign_consultant.button"
                        >
                          <Edit className="w-3 h-3" />
                          {patient.consultantAssignment ? "Reassign" : "Assign"}
                        </Button>
                      )}
                    </div>
                    <OnDutyStaffCard
                      ward={
                        (patient as unknown as { ward?: string }).ward ?? ""
                      }
                      patientName={patient.fullName}
                      registerNumber={
                        (patient as unknown as { registerNumber?: string })
                          .registerNumber ?? ""
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Patient Profile Tab Navigation */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm mb-4">
            <div className="overflow-x-auto">
              <div className="flex min-w-max px-2">
                {(
                  [
                    { id: "overview", label: "Overview" },
                    { id: "history", label: "\ud83d\udccb History" },
                    {
                      id: "prescriptions",
                      label: "\ud83d\udc8a Prescriptions",
                    },
                    {
                      id: "investigations",
                      label: "\ud83e\uddea Investigations",
                    },
                    { id: "procedures", label: "\ud83d\udd2c Procedures" },
                    { id: "vitals", label: "\u2764\ufe0f Vitals" },
                    { id: "complaints", label: "\ud83d\udcdd Complaints" },
                    { id: "advice", label: "\ud83d\udca1 Advice" },
                    { id: "timeline", label: "\ud83d\udd50 Timeline" },
                    { id: "chat", label: "\ud83d\udcac Chat" },
                    { id: "appointments", label: "\ud83d\udcc5 Appointments" },
                    { id: "pending", label: "\u23f3 Pending" },
                    { id: "handover", label: "\ud83e\udd1d Handover" },
                    { id: "referrals", label: "\ud83d\udce4 Referrals" },
                    { id: "soap-notes", label: "\ud83d\uddd2 SOAP Notes" },
                    { id: "account", label: "\u2699\ufe0f Account" },
                    { id: "inv-payment", label: "\ud83e\uddfe Inv. Payment" },
                  ] as Array<{ id: string; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600 bg-blue-50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* CURRENT VITALS */}
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              Current Vitals
              {latestVisit && (
                <span className="text-xs font-normal text-gray-400">
                  (from latest visit)
                </span>
              )}
            </h2>
            {/* Trend badges row */}
            {vitalTrends.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {vitalTrends.map((t) => (
                  <span
                    key={t.vital}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${
                      t.direction === "improving"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : t.direction === "worsening"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                    title={t.summary}
                  >
                    {t.direction === "improving" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : t.direction === "worsening" ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <span>→</span>
                    )}
                    {t.vital}: {t.direction}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                {
                  key: "bloodPressure",
                  label: "Blood Pressure",
                  value: vitals?.bloodPressure || "—",
                  unit: "mmHg",
                  icon: Heart,
                  color: "border-red-200",
                },
                {
                  key: "temperature",
                  label: "Temperature",
                  value: vitals?.temperature || "—",
                  unit: "°F",
                  icon: Thermometer,
                  color: "border-orange-200",
                },
                {
                  key: "pulse",
                  label: "Pulse Rate",
                  value: vitals?.pulse || "—",
                  unit: "/min",
                  icon: Activity,
                  color: "border-pink-200",
                },
                {
                  key: "oxygenSaturation",
                  label: "SpO₂",
                  value: vitals?.oxygenSaturation || "—",
                  unit: "%",
                  icon: Wind,
                  color: "border-blue-200",
                },
                {
                  key: "weight",
                  label: "Weight",
                  value:
                    vitals?.weight ||
                    (patient.weight ? String(patient.weight) : "—"),
                  unit: "kg",
                  icon: User,
                  color: "border-green-200",
                },
              ].map(({ key, label, value, unit, icon: Icon, color }) => {
                const status = vitalStatus(key, value);
                return (
                  <div
                    key={key}
                    className={`bg-white rounded-xl border-2 ${color} p-3 shadow-sm`}
                    data-ocid="patient_profile.card"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <Badge
                        className={`text-xs ${
                          status === "normal"
                            ? "bg-green-100 text-green-700 border-0"
                            : "bg-red-100 text-red-700 border-0"
                        }`}
                      >
                        {status === "normal"
                          ? "Normal"
                          : status === "high"
                            ? "High"
                            : "Low"}
                      </Badge>
                    </div>
                    <p className="text-xl font-bold text-gray-800">{value}</p>
                    <p className="text-xs text-gray-400">
                      {label} {value !== "—" ? unit : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DECISION DASHBOARD — Overview with Clinical Alerts, Pending Tasks, Stable Indicators */}
          {patientId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  Clinical Overview — Decision Dashboard
                </h2>
              </div>
              <OverviewTab
                patientId={patientId}
                patient={patient}
                visits={visits}
                prescriptions={prescriptions}
                onTabChange={() => {}}
              />
            </div>
          )}

          {/* Intern Draft Banner */}
          {isDraftRole && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                📝 Draft Mode — Your notes will be marked as drafts. Awaiting
                finalization by Doctor.
              </span>
            </div>
          )}

          {/* CURRENT INVESTIGATION PROFILE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                Current Investigation Profile
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => setShowLabImport(true)}
                  data-ocid="patient_profile.investigations.import_button"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Import Lab Report
                </Button>
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search investigation..."
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-ocid="patient_profile.search_input"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                data-ocid="patient_profile.table"
              >
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Investigation
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Result
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Unit
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Interpretation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-sm text-gray-400"
                        data-ocid="patient_profile.empty_state"
                      >
                        No investigation reports found
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, i) => (
                      <tr
                        key={`inv-${row.name}-${i}`}
                        className="border-b border-gray-50 hover:bg-gray-50"
                        data-ocid={`patient_profile.investigations.row.${i + 1}`}
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-800">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          {row.result}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">
                          {row.unit || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">
                          {row.date || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 max-w-[200px] truncate">
                          {row.interpretation || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PATIENT HISTORY - EXPANDABLE VISIT CARDS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                Patient History
              </h2>
              <Button
                size="sm"
                onClick={() => setShowVisitForm(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-sm"
                data-ocid="patient_profile.visits.open_modal_button"
              >
                <Plus className="w-3.5 h-3.5" /> New Visit
              </Button>
            </div>
            {visits.length === 0 ? (
              <div
                className="text-center py-8"
                data-ocid="patient_profile.visits.empty_state"
              >
                <Stethoscope className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No visit history yet</p>
              </div>
            ) : (
              <div
                className="space-y-3"
                data-ocid="patient_profile.visits.list"
              >
                {visits
                  .slice()
                  .sort((a, b) => Number(b.visitDate - a.visitDate))
                  .map((visit, idx) => {
                    const isRecent = idx === 0;
                    const visitIdStr = visit.id.toString();
                    const isExpanded =
                      expandedVisitId === visitIdStr ||
                      (idx === 0 && expandedVisitId === null);
                    const doctorEmail = getDoctorEmail();
                    // Load visit extended data from localStorage
                    let visitExt: Record<string, unknown> | null = null;
                    try {
                      const key = `visit_form_data_${visit.id}_${doctorEmail}`;
                      const raw = localStorage.getItem(key);
                      if (raw) visitExt = JSON.parse(raw);
                    } catch {}
                    // Compile salient features from visit data
                    const salientLines: string[] = [];
                    if (visitExt) {
                      const chiefComplaints = visitExt.chiefComplaints as
                        | string[]
                        | undefined;
                      const complaintAnswers = visitExt.complaintAnswers as
                        | Record<string, string | string[]>
                        | undefined;
                      if (chiefComplaints && chiefComplaints.length > 0) {
                        const ccParts = chiefComplaints.map((c, ci) => {
                          const raw = complaintAnswers?.[c];
                          let ans: string[] = [];
                          if (Array.isArray(raw)) ans = raw.filter(Boolean);
                          else if (typeof raw === "string" && raw) ans = [raw];
                          return ans.length > 0
                            ? `${ci + 1}. ${c} — ${ans.slice(0, 3).join(", ")}`
                            : `${ci + 1}. ${c}`;
                        });
                        salientLines.push(
                          `Chief complaints: ${ccParts.join("; ")}`,
                        );
                      }
                      const sra = visitExt.systemReviewAnswers as
                        | Record<string, string>
                        | undefined;
                      if (sra) {
                        const positive = Object.entries(sra)
                          .filter(
                            ([, v]) =>
                              v && v !== "Normal" && v !== "None" && v !== "No",
                          )
                          .map(([k, v]) => `${k}: ${v}`);
                        if (positive.length > 0)
                          salientLines.push(
                            `Positive system review: ${positive.join("; ")}`,
                          );
                      }
                      const vs = visitExt.vitalSigns as
                        | {
                            bloodPressure?: string;
                            pulse?: string;
                            temperature?: string;
                            oxygenSaturation?: string;
                            respiratoryRate?: string;
                          }
                        | undefined;
                      if (vs) {
                        const vsParts: string[] = [];
                        if (vs.bloodPressure)
                          vsParts.push(`BP: ${vs.bloodPressure}`);
                        if (vs.pulse) vsParts.push(`Pulse: ${vs.pulse}/min`);
                        if (vs.temperature)
                          vsParts.push(`Temp: ${vs.temperature}°F`);
                        if (vs.oxygenSaturation)
                          vsParts.push(`SpO2: ${vs.oxygenSaturation}%`);
                        if (vs.respiratoryRate)
                          vsParts.push(`RR: ${vs.respiratoryRate}/min`);
                        if (vsParts.length > 0)
                          salientLines.push(`Vitals: ${vsParts.join(", ")}`);
                      }
                      const genExam = visitExt.generalExamFindings as
                        | Record<string, string>
                        | undefined;
                      if (genExam) {
                        const pos = Object.entries(genExam)
                          .filter(
                            ([, v]) =>
                              v &&
                              v !== "Normal" &&
                              v !== "None" &&
                              v !== "No" &&
                              v !== "Absent",
                          )
                          .map(([k, v]) => `${k}: ${v}`);
                        if (pos.length > 0)
                          salientLines.push(`General exam: ${pos.join("; ")}`);
                      }
                      const sysExam = visitExt.systemicExamFindings as
                        | Record<string, string>
                        | undefined;
                      if (sysExam) {
                        const pos = Object.entries(sysExam)
                          .filter(
                            ([, v]) => v && v !== "Normal" && v !== "None",
                          )
                          .map(([k, v]) => `${k}: ${v}`);
                        if (pos.length > 0)
                          salientLines.push(`Systemic exam: ${pos.join("; ")}`);
                      }
                    }
                    // Investigation profile rows
                    const invRows = visitExt?.previous_investigation_rows as
                      | Array<{
                          date: string;
                          name: string;
                          result: string;
                          unit?: string;
                          interpretation?: string;
                        }>
                      | undefined;
                    // Ongoing treatment from prescriptions
                    const linkedRx = prescriptions.filter(
                      (rx) =>
                        rx.diagnosis &&
                        visit.diagnosis &&
                        rx.diagnosis
                          .toLowerCase()
                          .includes(
                            visit.diagnosis?.toLowerCase() ?? "__never__",
                          ),
                    );
                    const treatmentRx =
                      linkedRx.length > 0
                        ? linkedRx[0]
                        : prescriptions.length > 0
                          ? [...prescriptions].sort((a, b) =>
                              Number(b.prescriptionDate - a.prescriptionDate),
                            )[0]
                          : null;

                    return (
                      <div
                        key={visitIdStr}
                        className="border border-gray-200 rounded-xl overflow-hidden"
                        data-ocid={`patient_profile.visits.item.${idx + 1}`}
                      >
                        {/* Card Header */}
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          onClick={() =>
                            setExpandedVisitId(
                              isExpanded ? "__none__" : visitIdStr,
                            )
                          }
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ChevronRight
                              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            />
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                              {formatTime(visit.visitDate)}
                            </span>
                            <span className="text-sm text-gray-600 truncate max-w-[200px]">
                              {visit.diagnosis ||
                                visit.chiefComplaint ||
                                "Visit"}
                            </span>
                            <Badge
                              className={`text-xs border-0 flex-shrink-0 ${isRecent ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                            >
                              {isRecent ? "High" : "Low"}
                            </Badge>
                            <Badge
                              className={`text-xs border-0 flex-shrink-0 ${isRecent ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"}`}
                            >
                              {isRecent ? "Under Treatment" : "Cured"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVisit(visit);
                              }}
                              className="p-1.5 rounded text-teal-600 hover:bg-teal-50 transition-colors"
                              title="View full visit details"
                              data-ocid={`patient_profile.visits.edit_button.${idx + 1}`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRxForm(
                                  visit.diagnosis || undefined,
                                  visit.id,
                                );
                              }}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Open prescription"
                              data-ocid="patient_profile.prescriptions.open_modal_button"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </button>

                        {/* Expandable Body — 5-section clinical format */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-100 text-sm">
                            {/* 1. Particulars of the Patient */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                                <h4 className="text-xs font-bold uppercase tracking-wide text-blue-700">
                                  1. Particulars of the Patient
                                </h4>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-gray-700">
                                <div>
                                  <span className="text-gray-400 text-xs">
                                    Name:
                                  </span>{" "}
                                  {patient.fullName}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-xs">
                                    Age:
                                  </span>{" "}
                                  {age !== null ? `${age} yrs` : "—"}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-xs">
                                    Sex:
                                  </span>{" "}
                                  {patient.gender}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-xs">
                                    Reg No:
                                  </span>{" "}
                                  {(patient as any)?.registerNumber || "—"}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-xs">
                                    Visit Date:
                                  </span>{" "}
                                  {formatTime(visit.visitDate)}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-xs">
                                    Type:
                                  </span>{" "}
                                  {visit.visitType}
                                </div>
                              </div>
                            </div>

                            {/* 2. Clinical Diagnosis */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                                <h4 className="text-xs font-bold uppercase tracking-wide text-green-700">
                                  2. Clinical Diagnosis
                                </h4>
                              </div>
                              <p className="text-gray-800 font-medium">
                                {visit.diagnosis || "Not recorded"}
                              </p>
                            </div>

                            {/* 3. Salient Features */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="h-2 w-2 rounded-full bg-purple-500 flex-shrink-0" />
                                <h4 className="text-xs font-bold uppercase tracking-wide text-purple-700">
                                  3. Salient Features
                                </h4>
                              </div>
                              {salientLines.length > 0 ? (
                                <div className="space-y-1 text-gray-700">
                                  {salientLines.map((line) => (
                                    <p
                                      key={line.slice(0, 40)}
                                      className="leading-relaxed"
                                    >
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              ) : visit.chiefComplaint ? (
                                <p className="text-gray-700">
                                  Chief complaint: {visit.chiefComplaint}
                                  {visit.historyOfPresentIllness
                                    ? `. ${visit.historyOfPresentIllness}`
                                    : ""}
                                </p>
                              ) : (
                                <p className="text-gray-400 italic text-xs">
                                  No salient features recorded.
                                </p>
                              )}
                            </div>

                            {/* 4. Investigation Profile */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                                <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                  4. Investigation Profile
                                </h4>
                              </div>
                              {invRows && invRows.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-amber-50">
                                        <th className="text-left py-1.5 px-2 text-amber-700 font-semibold border border-amber-100">
                                          Date
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-amber-700 font-semibold border border-amber-100">
                                          Investigation
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-amber-700 font-semibold border border-amber-100">
                                          Result
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-amber-700 font-semibold border border-amber-100">
                                          Unit
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-amber-700 font-semibold border border-amber-100">
                                          Interpretation
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {invRows.map((row, ri) => (
                                        <tr
                                          key={`${row.date}-${row.name}-${row.result || ri}`}
                                          className={
                                            ri % 2 === 0
                                              ? "bg-white"
                                              : "bg-amber-50/30"
                                          }
                                        >
                                          <td className="py-1 px-2 border border-amber-100 text-gray-600">
                                            {row.date || "—"}
                                          </td>
                                          <td className="py-1 px-2 border border-amber-100 text-gray-800 font-medium">
                                            {row.name || "—"}
                                          </td>
                                          <td className="py-1 px-2 border border-amber-100 text-gray-700">
                                            {row.result || "—"}
                                          </td>
                                          <td className="py-1 px-2 border border-amber-100 text-gray-500">
                                            {row.unit || "—"}
                                          </td>
                                          <td className="py-1 px-2 border border-amber-100 text-gray-500">
                                            {row.interpretation || "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-gray-400 italic text-xs">
                                  No investigation data recorded.
                                </p>
                              )}
                            </div>

                            {/* 5. Ongoing Treatment */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0" />
                                <h4 className="text-xs font-bold uppercase tracking-wide text-teal-700">
                                  5. Ongoing Treatment
                                </h4>
                              </div>
                              {treatmentRx?.medications &&
                              treatmentRx.medications.length > 0 ? (
                                <div className="space-y-1">
                                  {treatmentRx.medications.map((med, mi) => (
                                    <p
                                      key={`${med.name}-${mi}`}
                                      className="text-gray-700"
                                    >
                                      <span className="font-medium">
                                        {mi + 1}. {med.name}
                                      </span>
                                      {med.dose ? ` ${med.dose}` : ""}
                                      {med.frequency
                                        ? ` — ${med.frequency}`
                                        : ""}
                                      {med.duration
                                        ? ` for ${med.duration}`
                                        : ""}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-400 italic text-xs">
                                  No medications recorded.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── HISTORY FEATURES: Problem List, Complaint Trend, Compare Visits, Vaccinations ── */}
          {patientId && (
            <HistoryFeaturesPanel
              visits={visits}
              patient={patient}
              isDoctor={
                !isAdmin
                  ? role === "consultant_doctor" ||
                    role === "doctor" ||
                    role === "medical_officer"
                  : true
              }
            />
          )}

          {/* PRESCRIPTIONS SECTION */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {/* Incomplete Registration Banner */}
            {(() => {
              const isIncomplete =
                (patient as Patient & { registrationComplete?: boolean })
                  .registrationComplete === false ||
                (patientId &&
                  localStorage.getItem(
                    `patient_reg_incomplete_${patientId}`,
                  ) === "true");
              if (!isIncomplete) return null;
              return (
                <div
                  className="mb-3 bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-yellow-800"
                  data-ocid="patient_profile.incomplete_registration.panel"
                >
                  <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold">
                      Registration incomplete
                    </span>{" "}
                    — this patient was added via emergency. Complete their full
                    registration.
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                    onClick={() => setShowEditForm(true)}
                    data-ocid="patient_profile.complete_registration.button"
                  >
                    Complete Registration
                  </Button>
                </div>
              );
            })()}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                Prescriptions ({prescriptions.length})
              </h2>
              <div className="flex items-center gap-2">
                {/* Emergency-Only Filter */}
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  data-ocid="patient_profile.prescriptions.emergency_filter.toggle"
                >
                  <input
                    type="checkbox"
                    checked={emergencyOnlyFilter}
                    onChange={(e) => setEmergencyOnlyFilter(e.target.checked)}
                    className="rounded border-red-400 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs font-medium text-red-700">
                    🚨 Emergency Only
                  </span>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => {
                    if (!patient) return;
                    const win = window.open("", "_blank");
                    if (!win) return;
                    const regNo =
                      ((patient as Record<string, unknown>)
                        .registerNumber as string) ?? "—";
                    const rxRows = [...prescriptions]
                      .sort((a, b) =>
                        Number(b.prescriptionDate - a.prescriptionDate),
                      )
                      .map((rx, i) => {
                        const meds = rx.medications
                          .map(
                            (m) =>
                              `${((m as Record<string, unknown>).drugForm as string) ?? ""} ${((m as Record<string, unknown>).drugName as string) || m.name} ${m.dose} — ${m.frequency} × ${m.duration}`,
                          )
                          .join("<br/>");
                        return `<tr><td>${i + 1}</td><td>${format(new Date(Number(rx.prescriptionDate / 1_000_000n)), "d MMM yyyy")}</td><td>${rx.diagnosis ?? "—"}</td><td>${meds}</td></tr>`;
                      })
                      .join("");
                    win.document.write(
                      `<html><head><title>Patient File - ${patient.fullName}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}th{background:#f0f0f0}h2{color:#0f766e}</style></head><body><h2>Patient File Export</h2><p><strong>Patient:</strong> ${patient.fullName} | <strong>Reg:</strong> ${regNo} | <strong>Generated:</strong> ${new Date().toLocaleDateString()}</p><h3>Prescriptions</h3><table><thead><tr><th>#</th><th>Date</th><th>Diagnosis</th><th>Medications</th></tr></thead><tbody>${rxRows}</tbody></table></body></html>`,
                    );
                    win.document.close();
                    win.print();
                  }}
                  data-ocid="patient_profile.prescriptions.export_button"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PDF
                </Button>
                <Button
                  size="sm"
                  onClick={() => openRxForm(undefined)}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-sm"
                  data-ocid="patient_profile.prescriptions.open_modal_button"
                >
                  <Plus className="w-3.5 h-3.5" /> New Prescription
                </Button>
              </div>
            </div>
            {loadingRx ? (
              <div
                className="space-y-3"
                data-ocid="patient_profile.prescriptions.loading_state"
              >
                {RX_SKELETON_KEYS.map((k) => (
                  <Skeleton key={k} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : prescriptions.length === 0 ? (
              <div
                className="text-center py-8"
                data-ocid="patient_profile.prescriptions.empty_state"
              >
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No prescriptions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Current Medication List */}
                <CurrentMedicationList prescriptions={prescriptions} />

                {prescriptions
                  .slice()
                  .sort((a, b) =>
                    Number(b.prescriptionDate - a.prescriptionDate),
                  )
                  .filter((rx) => {
                    if (!emergencyOnlyFilter) return true;
                    // Check if rx is emergency: look at medications prescriptionType or ext key
                    const extRaw = localStorage.getItem(
                      `prescription_ext_${rx.id}`,
                    );
                    if (extRaw) {
                      try {
                        const ext = JSON.parse(extRaw);
                        if (ext.prescriptionType === "emergency") return true;
                      } catch {}
                    }
                    return (
                      rx.medications?.some(
                        (m) => m.prescriptionType === "emergency",
                      ) ?? false
                    );
                  })
                  .map((rx, idx, arr) => {
                    const prev = arr[idx + 1];
                    const rxExt = rx as Prescription & {
                      viewedByPatientAt?: number;
                    };
                    // Check if emergency
                    let isEmergency = false;
                    try {
                      const extRaw = localStorage.getItem(
                        `prescription_ext_${rx.id}`,
                      );
                      if (extRaw) {
                        const ext = JSON.parse(extRaw);
                        isEmergency = ext.prescriptionType === "emergency";
                      }
                    } catch {}
                    return (
                      <div key={rx.id.toString()}>
                        {isEmergency && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-semibold">
                              🚨 EMERGENCY
                            </span>
                          </div>
                        )}
                        {idx === arr.length - 1 ? (
                          <FirstPrescriptionLabel />
                        ) : (
                          prev && (
                            <PrescriptionDiffRow
                              curr={rx}
                              prev={prev}
                              index={idx}
                            />
                          )
                        )}
                        <PrescriptionCard
                          rx={rx}
                          index={idx}
                          onClick={() => setSelectedRx(rx)}
                        />
                        <ViewedByPatientBadge
                          viewedAt={rxExt.viewedByPatientAt}
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* AUDIT TRAIL — visible only to Admin + Consultant Doctor */}
          {canViewAudit && patientId && (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
              data-ocid="patient_profile.audit_tab"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-700">
                    Patient Audit Trail
                  </h2>
                  <p className="text-xs text-gray-500">
                    All changes to this patient&apos;s records (Admin &amp;
                    Consultant Doctor only)
                  </p>
                </div>
              </div>
              <AuditTab patientId={patientId} />
            </div>
          )}
        </main>
      </div>

      {/* New Patient Profile Tabs */}
      {patientId !== null && activeTab === "procedures" && (
        <ProceduresTab
          patientId={patientId}
          canWrite={
            role === "consultant_doctor" ||
            role === "medical_officer" ||
            role === "admin"
          }
        />
      )}
      {patientId !== null && activeTab === "complaints" && (
        <ComplaintsTab
          patientId={patientId}
          patientName={patient.fullName}
          canWrite={
            role === "consultant_doctor" ||
            role === "medical_officer" ||
            role === "nurse" ||
            role === "admin"
          }
        />
      )}
      {patientId !== null && activeTab === "advice" && (
        <AdviceTab
          patientId={patientId}
          canWrite={
            role === "consultant_doctor" ||
            role === "medical_officer" ||
            role === "admin"
          }
        />
      )}
      {patientId !== null && activeTab === "timeline" && (
        <TimelineTab
          patientId={patientId}
          visits={visits || []}
          prescriptions={prescriptions || []}
          patient={patient}
        />
      )}
      {patientId !== null && activeTab === "chat" && (
        <ChatTab
          patientId={patientId}
          patientName={patient.fullName}
          currentUserName={currentDoctor?.name ?? "Doctor"}
        />
      )}
      {patientId !== null && activeTab === "appointments" && (
        <AppointmentsTab patientId={patientId} canWrite={role !== "patient"} />
      )}
      {patientId !== null && activeTab === "pending" && (
        <PendingTab patientId={patientId} prescriptions={prescriptions || []} />
      )}
      {patientId !== null && activeTab === "handover" && (
        <HandoverTab patientId={patientId} />
      )}
      {patientId !== null && activeTab === "referrals" && (
        <ReferralsTab
          patientId={patientId}
          canWrite={
            role === "consultant_doctor" ||
            role === "medical_officer" ||
            role === "admin"
          }
        />
      )}
      {patientId !== null && activeTab === "soap-notes" && (
        <SOAPNotesTab
          patientId={patientId}
          isAdmitted={patient?.patientType === "admitted"}
          canWrite={
            role === "consultant_doctor" ||
            role === "medical_officer" ||
            role === "intern_doctor" ||
            role === "admin"
          }
        />
      )}
      {patientId !== null && activeTab === "inv-payment" && (
        <InvPaymentTab patientId={patientId} patientName={patient.fullName} />
      )}
      {/* Edit Patient Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          data-ocid="patient_profile.dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          <PatientForm
            patient={patient}
            onSubmit={(data) => {
              if (!patientId) return;
              updateMutation.mutate(
                { id: patientId, ...data },
                {
                  onSuccess: () => {
                    toast.success("Patient updated");
                    setShowEditForm(false);
                  },
                  onError: () => toast.error("Failed to update patient"),
                },
              );
            }}
            onCancel={() => setShowEditForm(false)}
            isLoading={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* New Visit Dialog */}
      <Dialog open={showVisitForm} onOpenChange={setShowVisitForm}>
        <DialogContent
          className="!max-w-none !w-screen !h-screen !rounded-none !top-0 !left-0 ![transform:none] p-0 flex flex-col overflow-hidden"
          data-ocid="patient_profile.visits.dialog"
        >
          <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
              <DialogTitle>
                {newVisitTemplate
                  ? "Add New Visit / Investigation Update"
                  : "Record Visit"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {patientId && (
                <VisitForm
                  patientId={patientId}
                  patient={patient}
                  visit={
                    newVisitTemplate
                      ? {
                          visit_type: newVisitTemplate.visitType,
                          chief_complaint:
                            newVisitTemplate.chiefComplaint ?? "",
                          diagnosis: newVisitTemplate.diagnosis ?? "",
                        }
                      : undefined
                  }
                  onSubmit={(data) => {
                    createVisitMutation.mutate(data, {
                      onSuccess: () => {
                        toast.success(
                          newVisitTemplate
                            ? "New follow-up visit recorded"
                            : "Visit recorded",
                        );
                        setShowVisitForm(false);
                        setNewVisitTemplate(null);
                      },
                      onError: () => toast.error("Failed to record visit"),
                    });
                  }}
                  onCancel={() => {
                    setShowVisitForm(false);
                    setNewVisitTemplate(null);
                  }}
                  isLoading={createVisitMutation.isPending}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Prescription — rendered directly (NOT inside Dialog) because UpgradedPrescriptionEMR uses fixed inset-0 itself */}
      {showRxForm && patientId && (
        <UpgradedPrescriptionEMR
          patientId={patientId}
          patientName={patient.fullName ?? ""}
          initialDiagnosis={rxInitialDiagnosis}
          patientAge={age ?? undefined}
          patientGender={patient.gender ?? ""}
          patientWeight={patient.weight ? String(patient.weight) : undefined}
          patientAddress={patient.address ?? ""}
          patientBloodGroup={patient.bloodGroup ?? ""}
          registerNumber={
            (patient as unknown as { registerNumber?: string })
              .registerNumber ?? ""
          }
          visitExtendedData={rxVisitExtendedData}
          patientRegisterNumber={
            rxPatientRegisterNumber ||
            (patient as unknown as { registerNumber?: string })
              .registerNumber ||
            ""
          }
          forceVisitData={rxForceVisitData}
          onSubmit={(data) => {
            createRxMutation.mutate(data, {
              onSuccess: () => {
                toast.success("Prescription saved");
                closeRxForm();
              },
              onError: () => toast.error("Failed to save prescription"),
            });
          }}
          onCancel={closeRxForm}
          isLoading={createRxMutation.isPending}
        />
      )}

      {/* Visit Detail Dialog */}
      <Dialog
        open={!!selectedVisit}
        onOpenChange={(open) => !open && setSelectedVisit(null)}
      >
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="patient_profile.visits.panel"
        >
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
          </DialogHeader>
          {selectedVisit && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    selectedVisit.visitType === "admitted"
                      ? "default"
                      : "secondary"
                  }
                  className="capitalize"
                >
                  {selectedVisit.visitType}
                </Badge>
                <span className="text-muted-foreground">
                  {formatDateTime(selectedVisit.visitDate)}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Chief Complaint
                </p>
                <p className="font-medium">{selectedVisit.chiefComplaint}</p>
              </div>
              {selectedVisit.historyOfPresentIllness && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    History of Present Illness
                  </p>
                  <p>{selectedVisit.historyOfPresentIllness}</p>
                </div>
              )}
              {(selectedVisit.vitalSigns.bloodPressure ||
                selectedVisit.vitalSigns.pulse ||
                selectedVisit.vitalSigns.temperature ||
                selectedVisit.vitalSigns.respiratoryRate ||
                selectedVisit.vitalSigns.oxygenSaturation) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Vital Signs
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedVisit.vitalSigns.bloodPressure && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">BP</p>
                        <p className="font-medium">
                          {selectedVisit.vitalSigns.bloodPressure}
                        </p>
                      </div>
                    )}
                    {selectedVisit.vitalSigns.pulse && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">Pulse</p>
                        <p className="font-medium">
                          {selectedVisit.vitalSigns.pulse} bpm
                        </p>
                      </div>
                    )}
                    {selectedVisit.vitalSigns.temperature && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">Temp</p>
                        <p className="font-medium">
                          {selectedVisit.vitalSigns.temperature}°F
                        </p>
                      </div>
                    )}
                    {selectedVisit.vitalSigns.respiratoryRate && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">RR</p>
                        <p className="font-medium">
                          {selectedVisit.vitalSigns.respiratoryRate}/min
                        </p>
                      </div>
                    )}
                    {selectedVisit.vitalSigns.oxygenSaturation && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">SpO2</p>
                        <p className="font-medium">
                          {selectedVisit.vitalSigns.oxygenSaturation}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedVisit.physicalExamination && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Physical Examination
                  </p>
                  <p>{selectedVisit.physicalExamination}</p>
                </div>
              )}
              {selectedVisit.diagnosis && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Diagnosis
                  </p>
                  <p className="font-semibold text-primary">
                    {selectedVisit.diagnosis}
                  </p>
                </div>
              )}
              {selectedVisit.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                  <p>{selectedVisit.notes}</p>
                </div>
              )}
              <div className="pt-2">
                <Button
                  onClick={() => {
                    const dx = selectedVisit.diagnosis ?? undefined;
                    const vid = selectedVisit.id;
                    setSelectedVisit(null);
                    openRxForm(dx, vid);
                  }}
                  variant="outline"
                  className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
                  data-ocid="patient_profile.visits.secondary_button"
                >
                  <FileText className="w-4 h-4" />
                  Write Prescription
                  {selectedVisit.diagnosis && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-teal-300 text-teal-600 ml-1"
                    >
                      DIMS
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prescription Detail Dialog */}
      <Dialog
        open={!!selectedRx}
        onOpenChange={(open) => !open && setSelectedRx(null)}
      >
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="patient_profile.prescriptions.panel"
        >
          <DialogHeader>
            <DialogTitle>Prescription</DialogTitle>
          </DialogHeader>
          {selectedRx && (
            <div className="space-y-4 text-sm">
              {/* Snapshot lock indicator */}
              {(() => {
                const snap = (selectedRx as Record<string, unknown>)
                  .finalizedSnapshot as Record<string, unknown> | undefined;
                if (snap?.lockedAt) {
                  return (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      <span>🔒</span>
                      <span>
                        Clinical summary locked at{" "}
                        <strong>
                          {format(
                            new Date(snap.lockedAt as number),
                            "d MMM yyyy, HH:mm",
                          )}
                        </strong>{" "}
                        — cannot be changed retroactively
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatTime(selectedRx.prescriptionDate)}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditRx(selectedRx);
                      setSelectedRx(null);
                    }}
                    className="gap-2 h-8 border-amber-300 text-amber-700 hover:bg-amber-50"
                    data-ocid="patient_profile.prescriptions.edit_button"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPadPreview(selectedRx)}
                    className="gap-2 h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                    data-ocid="patient_profile.prescriptions.secondary_button"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Pad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="gap-2 h-8 border-teal-300 text-teal-700 hover:bg-teal-50"
                    data-ocid="patient_profile.prescriptions.secondary_button"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </Button>
                </div>
              </div>
              {selectedRx.diagnosis && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Diagnosis
                  </p>
                  <p className="font-semibold text-primary">
                    {selectedRx.diagnosis}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Medications
                </p>
                <div className="space-y-2">
                  {selectedRx.medications.map((med, i) => (
                    <div
                      key={`${med.name}-${i}`}
                      className="bg-muted/40 rounded-lg p-3"
                    >
                      <p className="font-semibold">{med.name}</p>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {med.dose && <p>Dose: {med.dose}</p>}
                        {med.frequency && <p>Frequency: {med.frequency}</p>}
                        {med.duration && <p>Duration: {med.duration}</p>}
                        {med.instructions && (
                          <p>Instructions: {med.instructions}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedRx.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                  <p>{selectedRx.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Prescription Dialog */}
      <Dialog
        open={!!editRx}
        onOpenChange={(open) => {
          if (!open) setEditRx(null);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="patient_profile.prescriptions.edit_modal"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Prescription
              <span className="text-xs font-normal text-muted-foreground">
                (saves as new copy)
              </span>
            </DialogTitle>
          </DialogHeader>
          {editRx && patientId && (
            <PrescriptionForm
              patientId={patientId}
              patientName={patient.fullName}
              initialData={{
                prescriptionDate: editRx.prescriptionDate,
                diagnosis: editRx.diagnosis ?? null,
                medications: editRx.medications,
                notes: editRx.notes ?? null,
              }}
              onSubmit={(data) => {
                createRxMutation.mutate(data, {
                  onSuccess: () => {
                    toast.success("Edited prescription saved as new copy");
                    setEditRx(null);
                  },
                  onError: () => toast.error("Failed to save prescription"),
                });
              }}
              onCancel={() => setEditRx(null)}
              isLoading={createRxMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Prescription Pad Preview Dialog */}
      <Dialog
        open={showPadPreview}
        onOpenChange={(open) => !open && setShowPadPreview(false)}
      >
        <DialogContent
          className="!max-w-none w-[95vw] max-h-[95vh] overflow-y-auto"
          data-ocid="patient_profile.prescriptions.modal"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-600" />
              Prescription Pad — Print Preview
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto pb-4">
            <PrescriptionPad
              prescription={padPrescription}
              patientName={patient.fullName}
              patientAge={age ?? undefined}
              patientWeight={
                patient?.weight ? String(patient.weight) : undefined
              }
              registerNumber={
                (patient as Record<string, unknown>).registerNumber as
                  | string
                  | undefined
              }
              linkedVisitId={
                padPrescription?.visitId !== undefined &&
                padPrescription?.visitId !== null
                  ? String(padPrescription.visitId)
                  : undefined
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Lab Import Dialog */}
      <Dialog open={showLabImport} onOpenChange={setShowLabImport}>
        <DialogContent
          className="max-w-sm"
          data-ocid="patient_profile.lab_import.dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-600" />
              Import Lab Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Test Name *</Label>
              <Input
                placeholder="e.g. Haemoglobin, Creatinine"
                value={labImportName}
                onChange={(e) => setLabImportName(e.target.value)}
                data-ocid="patient_profile.lab_import.name_input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Result *</Label>
                <Input
                  placeholder="e.g. 11.2"
                  value={labImportResult}
                  onChange={(e) => setLabImportResult(e.target.value)}
                  data-ocid="patient_profile.lab_import.result_input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input
                  placeholder="g/dL, mg/dL..."
                  value={labImportUnit}
                  onChange={(e) => setLabImportUnit(e.target.value)}
                  data-ocid="patient_profile.lab_import.unit_input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reference Range</Label>
              <Input
                placeholder="e.g. 11.5–16.5"
                value={labImportRefRange}
                onChange={(e) => setLabImportRefRange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={labImportDate}
                onChange={(e) => setLabImportDate(e.target.value)}
                data-ocid="patient_profile.lab_import.date_input"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowLabImport(false)}>
                Cancel
              </Button>
              <Button
                disabled={
                  !labImportName.trim() ||
                  !labImportResult.trim() ||
                  labImportSaving
                }
                onClick={async () => {
                  if (!patientId) return;
                  setLabImportSaving(true);
                  try {
                    await createObservation.mutateAsync({
                      patientId,
                      observationType: "Lab",
                      code: labImportName.trim(),
                      value: labImportResult.trim(),
                      numericValue:
                        Number.parseFloat(labImportResult) || undefined,
                      unit: labImportUnit.trim(),
                      normalRange: labImportRefRange.trim() || undefined,
                      interpretation: labImportRefRange ? undefined : undefined,
                      observationDate:
                        BigInt(new Date(labImportDate).getTime()) * 1_000_000n,
                      recordedBy: {
                        toString: () => "local",
                      } as unknown as Principal,
                      recordedByName: getDoctorEmail(),
                      recordedByRole: "doctor",
                    });
                    toast.success("Lab result imported");
                    setShowLabImport(false);
                    setLabImportName("");
                    setLabImportResult("");
                    setLabImportUnit("");
                    setLabImportRefRange("");
                  } catch {
                    toast.error("Failed to import lab result");
                  } finally {
                    setLabImportSaving(false);
                  }
                }}
                data-ocid="patient_profile.lab_import.submit_button"
              >
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Panel */}
      {showAIPanel && patientId && (
        <AIAssistantPanel
          patient={patient}
          visits={visits}
          prescriptions={prescriptions}
          latestVitals={vitals}
          onClose={() => setShowAIPanel(false)}
        />
      )}

      {/* AI floating button */}
      {!showAIPanel && (
        <button
          type="button"
          onClick={() => setShowAIPanel(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title="AI Assistant"
          data-ocid="patient_profile.ai_assistant_button"
        >
          <Bot className="w-5 h-5" />
        </button>
      )}

      {/* Reassign Consultant Modal */}
      {showReassignConsultant && patientId && (
        <ReassignConsultantModal
          open={showReassignConsultant}
          onClose={() => setShowReassignConsultant(false)}
          patientId={patientId}
          currentConsultantEmail={patient.consultantAssignment?.email}
          currentUserEmail={currentDoctor?.email ?? getDoctorEmail()}
          currentUserName={currentDoctor?.name ?? ""}
          currentUserRole={role}
        />
      )}
    </div>
  );
}
