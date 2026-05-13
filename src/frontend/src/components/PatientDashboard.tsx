/**
 * PatientDashboard — inner tabbed dashboard component
 * Renders the 9 colored navigation tabs and their content.
 * Used by pages/PatientDashboard.tsx after patient data is loaded.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Baby,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Heart,
  HeartPulse,
  Lightbulb,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Thermometer,
  Trash2,
  User,
  Wind,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  isSignUpEnabled,
  loadPatientRegistry,
  setSignUpEnabled,
  useEmailAuth,
} from "../hooks/useEmailAuth";
import type { PatientAccount } from "../hooks/useEmailAuth";
import { getDoctorEmail, getVisitFormData } from "../hooks/useQueries";
import {
  useGetClinicalNotesByPatient,
  useGetEncountersByPatient,
} from "../hooks/useQueries";
import { getPermissionsForRole } from "../hooks/useRolePermissions";
import {
  checkExtendedClinicalAlerts,
  checkTrendAlerts,
} from "../lib/clinicalIntelligence";
import {
  buildFollowUpMessage,
  buildReportReadyMessage,
} from "../lib/whatsappTemplates";
import type {
  ExtendedAlert,
  ExtendedAlertInput,
  LabResult,
  TrendAlert,
  VitalReading,
} from "../types";
import type { Patient, Prescription, Visit } from "../types";
import type { StaffRole } from "../types";
import AdmissionHistory, { loadAdmissionHistory } from "./AdmissionHistory";
import type { AdmissionHistoryRecord } from "./AdmissionHistory";
import AdmissionTimeline from "./AdmissionTimeline";
import DailyProgress from "./DailyProgress";
import DailyProgressNote from "./DailyProgressNote";
import DischargeSummaryTab from "./DischargeSummaryTab";
import HandoverSystem from "./HandoverSystem";
import HistoryFeaturesPanel from "./HistoryFeatures";
import InvestigationPayment from "./InvestigationPayment";
import InvestigationTracker, {
  generateAIInterpretation,
  loadTrackedInvestigations,
  type InterpretationLabel,
} from "./InvestigationTracker";
import MissedDoseReport from "./MissedDoseReport";
import PatientChat from "./PatientChat";
import PatientSummaryCard from "./PatientSummaryCard";
import PatientTimeline from "./PatientTimeline";
import {
  CurrentMedicationList,
  FirstPrescriptionLabel,
  PrescriptionDiffRow,
  ViewedByPatientBadge,
} from "./PrescriptionEnhancements";
import ProcedureLog from "./ProcedureLog";
import ReferralLetter from "./ReferralLetter";
import type {
  AdviceEntry,
  ComplaintEntry,
  DrugReminder,
  PatientSubmission,
} from "./patientDashboardTypes";
import {
  loadAdviceEntries,
  loadComplaints,
  loadFamilyHistoryRisk,
  loadSubmissions,
  saveAdviceEntries,
  saveComplaints,
  saveSubmissions,
} from "./patientDashboardTypes";

function formatTime(time: bigint): string {
  return format(new Date(Number(time / 1000000n)), "MMM d, yyyy");
}

function calcMAP(bp: string): number | null {
  const parts = bp.split("/");
  if (parts.length !== 2) return null;
  const sbp = Number.parseInt(parts[0]);
  const dbp = Number.parseInt(parts[1]);
  if (Number.isNaN(sbp) || Number.isNaN(dbp)) return null;
  return Math.round(dbp + (sbp - dbp) / 3);
}

// ── Vital alert thresholds ─────────────────────────────────────────────────────
function vitalAlert(
  key: string,
  value: string,
): { status: "normal" | "critical"; message: string } {
  if (!value || value === "—") return { status: "normal", message: "" };
  const num = Number.parseFloat(value.replace(/[^0-9./-]/g, ""));
  if (key === "bloodPressure") {
    const systolic = Number.parseInt(value.split("/")[0] ?? "0", 10);
    if (Number.isNaN(systolic)) return { status: "normal", message: "" };
    if (systolic < 90)
      return {
        status: "critical",
        message: `BP systolic ${systolic} < 90 mmHg (hypotension)`,
      };
    return { status: "normal", message: "" };
  }
  if (Number.isNaN(num)) return { status: "normal", message: "" };
  if (key === "pulse") {
    if (num > 100)
      return {
        status: "critical",
        message: `Pulse ${num} > 100 bpm (tachycardia)`,
      };
    if (num < 60)
      return {
        status: "critical",
        message: `Pulse ${num} < 60 bpm (bradycardia)`,
      };
  }
  if (key === "temperature") {
    if (num > 38.5)
      return {
        status: "critical",
        message: `Temp ${num}°C > 38.5°C (fever)`,
      };
    if (num < 36)
      return {
        status: "critical",
        message: `Temp ${num}°C < 36°C (hypothermia)`,
      };
  }
  if (key === "oxygenSaturation") {
    if (num < 90)
      return {
        status: "critical",
        message: `SpO₂ ${num}% < 90% (hypoxia)`,
      };
  }
  if (key === "respiratoryRate") {
    if (num > 30)
      return {
        status: "critical",
        message: `RR ${num} > 30 breaths/min (tachypnoea)`,
      };
  }
  return { status: "normal", message: "" };
}

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

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5)
    return { label: "Underweight", color: "text-blue-600 bg-blue-100" };
  if (bmi < 25)
    return { label: "Normal", color: "text-green-700 bg-green-100" };
  if (bmi < 30)
    return { label: "Overweight", color: "text-amber-700 bg-amber-100" };
  if (bmi < 35)
    return { label: "Obese I", color: "text-orange-700 bg-orange-100" };
  return { label: "Obese II+", color: "text-red-700 bg-red-100" };
}

// ── AI Suggestion banners for specific alert types ────────────────────────────
const AI_SUGGESTION_BANNERS: Record<
  string,
  { color: string; icon: string; text: string }
> = {
  SepticShock: {
    color: "bg-amber-50 border-amber-300",
    icon: "💊",
    text: "Start sepsis bundle? → IV fluids 30ml/kg, blood cultures ×2, broad-spectrum antibiotics within 1hr",
  },
  AKI: {
    color: "bg-amber-50 border-amber-300",
    icon: "🧪",
    text: "AKI protocol? → Hold nephrotoxins, IV fluids, urgent electrolytes, nephrology consult",
  },
  Hyperkalemia: {
    color: "bg-amber-50 border-amber-300",
    icon: "🧪",
    text: "AKI/Hyperkalemia → Hold nephrotoxins, IV fluids, urgent electrolytes, nephrology consult",
  },
  SevereHypoglycemia: {
    color: "bg-red-50 border-red-300",
    icon: "⚡",
    text: "Immediate: Dextrose 50% 50ml IV bolus or oral glucose if conscious",
  },
  Hypoglycemia: {
    color: "bg-red-50 border-red-300",
    icon: "⚡",
    text: "Immediate: Oral glucose 15–20g if conscious; Dextrose 50% 50ml IV if unconscious",
  },
  RespiratoryFailure: {
    color: "bg-amber-50 border-amber-300",
    icon: "💨",
    text: "Oxygen supplementation? → Target SpO₂ ≥94%, consider non-rebreather mask or NIV",
  },
  AsthmaExacerbation: {
    color: "bg-amber-50 border-amber-300",
    icon: "💨",
    text: "Oxygen supplementation? → Target SpO₂ ≥94%, consider non-rebreather mask",
  },
};

// ── Red Flag Monitor ──────────────────────────────────────────────────────────
function RedFlagMonitor({
  patientId,
  latestVitals,
  allInvestigations,
  prescriptions,
  diagnoses,
}: {
  patientId: bigint;
  latestVitals: Record<string, string> | null;
  allInvestigations: Array<{
    name: string;
    result: string;
    unit?: string;
    date?: string;
  }>;
  prescriptions: Prescription[];
  diagnoses: string[];
}) {
  const [rfAlerts, setRfAlerts] = useState<ExtendedAlert[]>([]);
  const [rfTrendAlerts, setRfTrendAlerts] = useState<TrendAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(`dismissed_flags_${patientId}`);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const rfIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildAlertInput = useCallback((): ExtendedAlertInput => {
    const v = latestVitals ?? {};
    const bpParts = (v.bloodPressure ?? "").split("/");
    const sBP = bpParts[0] ? Number.parseInt(bpParts[0]) : undefined;
    const dBP = bpParts[1] ? Number.parseInt(bpParts[1]) : undefined;
    const hr = v.pulse ? Number.parseFloat(v.pulse) : undefined;
    const temp = v.temperature ? Number.parseFloat(v.temperature) : undefined;
    const rr = v.respiratoryRate
      ? Number.parseFloat(v.respiratoryRate)
      : undefined;
    const spo2 = v.oxygenSaturation
      ? Number.parseFloat(v.oxygenSaturation)
      : undefined;
    const getLabVal = (keys: string[]): number | undefined => {
      for (const key of keys) {
        const row = allInvestigations.find(
          (r) =>
            (r.name ?? "").toLowerCase().includes(key.toLowerCase()) &&
            r.result,
        );
        if (row) {
          const n = Number.parseFloat(row.result);
          if (!Number.isNaN(n)) return n;
        }
      }
      return undefined;
    };
    const creatRows = allInvestigations
      .filter(
        (r) => (r.name ?? "").toLowerCase().includes("creatinine") && r.result,
      )
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const creat = creatRows[0]
      ? Number.parseFloat(creatRows[0].result)
      : undefined;
    const creatPrev = creatRows[1]
      ? Number.parseFloat(creatRows[1].result)
      : undefined;
    const medications = prescriptions.flatMap((rx) => rx.medications ?? []);
    return {
      vitals: {
        systolicBP: !Number.isNaN(sBP ?? Number.NaN) ? sBP : undefined,
        diastolicBP: !Number.isNaN(dBP ?? Number.NaN) ? dBP : undefined,
        heartRate: !Number.isNaN(hr ?? Number.NaN) ? hr : undefined,
        temperature: !Number.isNaN(temp ?? Number.NaN) ? temp : undefined,
        respiratoryRate: !Number.isNaN(rr ?? Number.NaN) ? rr : undefined,
        spo2: !Number.isNaN(spo2 ?? Number.NaN) ? spo2 : undefined,
      },
      labs: {
        creatinine: !Number.isNaN(creat ?? Number.NaN) ? creat : undefined,
        creatininePrev: !Number.isNaN(creatPrev ?? Number.NaN)
          ? creatPrev
          : undefined,
        potassium: getLabVal(["potassium", "k+"]),
        sodium: getLabVal(["sodium", "na+"]),
        glucose: getLabVal(["glucose", "blood sugar", "rbs"]),
        wbc: getLabVal(["wbc", "tlc"]),
        ph: getLabVal(["ph"]),
        bicarbonate: getLabVal(["bicarbonate", "hco3"]),
      },
      medications,
      diagnoses,
    };
  }, [latestVitals, allInvestigations, prescriptions, diagnoses]);

  const runChecks = useCallback(() => {
    const input = buildAlertInput();
    setRfAlerts(checkExtendedClinicalAlerts(input));
    const labHistory: LabResult[] = allInvestigations.reduce<LabResult[]>(
      (acc, row) => {
        const val = Number.parseFloat(row.result ?? "");
        if (Number.isNaN(val)) return acc;
        const name = (row.name ?? "").toLowerCase();
        const entry: LabResult = {
          timestamp: row.date
            ? new Date(row.date).toISOString()
            : new Date().toISOString(),
        };
        if (name.includes("creatinine")) entry.creatinine = val;
        else if (name.includes("hemoglobin") || name === "hb")
          entry.hemoglobin = val;
        if (Object.keys(entry).length > 1) acc.push(entry);
        return acc;
      },
      [],
    );
    setRfTrendAlerts(checkTrendAlerts([], labHistory));
  }, [buildAlertInput, allInvestigations]);

  useEffect(() => {
    runChecks();
    rfIntervalRef.current = setInterval(runChecks, 5 * 60 * 1000);
    return () => {
      if (rfIntervalRef.current) clearInterval(rfIntervalRef.current);
    };
  }, [runChecks]);

  const dismissRfAlert = (id: string) => {
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    try {
      sessionStorage.setItem(
        `dismissed_flags_${patientId}`,
        JSON.stringify([...next]),
      );
    } catch {}
  };

  const visCrit = rfAlerts.filter(
    (a) => a.severity === "critical" && !dismissedIds.has(a.id),
  );
  const visWarn = rfAlerts.filter(
    (a) => a.severity === "warning" && !dismissedIds.has(a.id),
  );
  const visTrends = rfTrendAlerts.filter((t) => !dismissedIds.has(t.id));

  if (visCrit.length + visWarn.length + visTrends.length === 0) {
    return (
      <div
        className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5"
        data-ocid="red_flag_monitor.clear"
      >
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        <p className="text-sm text-green-700 font-medium flex-1">
          No active red flags detected
        </p>
        <button
          type="button"
          onClick={runChecks}
          className="text-xs text-green-600 hover:text-green-800 underline"
          data-ocid="red_flag_monitor.refresh_button"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-ocid="red_flag_monitor.panel">
      {visCrit.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl overflow-hidden">
          <div className="bg-red-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-bold text-sm">
                🚨 RED FLAGS DETECTED ({visCrit.length})
              </span>
            </div>
            <button
              type="button"
              onClick={runChecks}
              className="text-xs text-white/80 hover:text-white underline"
              data-ocid="red_flag_monitor.refresh_button"
            >
              ↻ Refresh
            </button>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="border-b border-red-200" />
            {visCrit.map((alert) => {
              const banner = AI_SUGGESTION_BANNERS[alert.alertType];
              return (
                <div
                  key={alert.id}
                  className="space-y-1.5"
                  data-ocid={`red_flag_monitor.critical.${alert.alertType}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800">
                        • {alert.message}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        {alert.details}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissRfAlert(alert.id)}
                      className="text-red-400 hover:text-red-600 shrink-0"
                      title="Dismiss for this session"
                      data-ocid="red_flag_monitor.dismiss_button"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  {banner && (
                    <div
                      className={`rounded-lg px-3 py-2 border text-xs flex items-start gap-1.5 ${banner.color}`}
                    >
                      <span className="shrink-0">{banner.icon}</span>
                      <span className="font-medium text-amber-800 flex-1">
                        {banner.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissRfAlert(`${alert.id}_banner`)}
                        className="ml-auto shrink-0 text-amber-500 hover:text-amber-700"
                        title="Dismiss for this session"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {visWarn.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
          <div className="bg-amber-400 px-4 py-2 flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-bold text-sm">
              ⚠️ WARNINGS ({visWarn.length})
            </span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {visWarn.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-2"
                data-ocid={`red_flag_monitor.warning.${alert.alertType}`}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    • {alert.message}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {alert.details}
                  </p>
                  {alert.aiSuggestion && (
                    <p className="text-xs text-amber-700 mt-1 italic">
                      💡 {alert.aiSuggestion}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissRfAlert(alert.id)}
                  className="text-amber-400 hover:text-amber-600 shrink-0"
                  title="Dismiss for this session"
                  data-ocid="red_flag_monitor.dismiss_button"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {visTrends.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Trend Alerts
          </p>
          {visTrends.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-2"
              data-ocid={`red_flag_monitor.trend.${t.metric}`}
            >
              <div>
                <p className="text-xs font-semibold text-blue-800">
                  • {t.message}
                </p>
                <p className="text-xs text-blue-600">{t.details}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissRfAlert(t.id)}
                className="text-blue-400 hover:text-blue-600 shrink-0"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VitalsBar ─────────────────────────────────────────────────────────────────
function VitalsBar({
  vitals,
  weight,
  height,
  showAlertBanner,
}: {
  vitals: Record<string, string> | null;
  weight?: number;
  height?: number;
  showAlertBanner?: boolean;
}) {
  const bp = vitals?.bloodPressure || "";
  const map = bp ? calcMAP(bp) : null;
  const wt = vitals?.weight ? Number.parseFloat(vitals.weight) : weight;
  const ht = vitals?.height ? Number.parseFloat(vitals.height) : height;
  const bmi =
    wt && ht ? Math.round((wt / ((ht / 100) * (ht / 100))) * 10) / 10 : null;
  const bmiCat = bmi ? getBMICategory(bmi) : null;

  const items = [
    {
      key: "bloodPressure",
      label: "BP",
      value: bp || "—",
      unit: "mmHg",
      extra: map ? ` | MAP: ${map}` : "",
    },
    {
      key: "pulse",
      label: "Pulse",
      value: vitals?.pulse || "—",
      unit: "beats/min",
    },
    {
      key: "oxygenSaturation",
      label: "SpO₂",
      value: vitals?.oxygenSaturation || "—",
      unit: "%",
    },
    {
      key: "temperature",
      label: "Temp",
      value: vitals?.temperature || "—",
      unit: "°C",
    },
    {
      key: "weight",
      label: "Weight",
      value: wt ? String(wt) : "—",
      unit: "kg",
    },
    {
      key: "respiratoryRate",
      label: "RR",
      value: vitals?.respiratoryRate || "—",
      unit: "breaths/min",
    },
  ];

  // Compute alerts for all items
  const alerts = items.map((item) =>
    item.value !== "—"
      ? vitalAlert(item.key, item.value)
      : { status: "normal" as const, message: "" },
  );
  const criticalAlerts = alerts.filter((a) => a.status === "critical");

  return (
    <div className="space-y-3">
      {/* Sticky alert banner */}
      {showAlertBanner && criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700 mb-1">
              ⚠️ Vital Alert — {criticalAlerts.length} abnormal value
              {criticalAlerts.length > 1 ? "s" : ""}
            </p>
            <ul className="space-y-0.5">
              {criticalAlerts.map((a) => (
                <li key={a.message} className="text-xs text-red-600">
                  • {a.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item, i) => {
          const status =
            item.value !== "—" ? vitalStatus(item.key, item.value) : "normal";
          const alert = alerts[i];
          const isCritical = alert.status === "critical";
          return (
            <div
              key={item.key}
              title={isCritical ? alert.message : undefined}
              className={`rounded-xl p-3 border relative ${
                isCritical
                  ? "bg-red-100 border-red-300"
                  : status === "high"
                    ? "bg-red-50 border-red-200"
                    : status === "low"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
              }`}
            >
              {isCritical && (
                <AlertTriangle className="absolute top-2 right-2 w-3.5 h-3.5 text-red-600" />
              )}
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p
                className={`font-bold text-lg ${
                  isCritical
                    ? "text-red-700"
                    : status === "high"
                      ? "text-red-700"
                      : status === "low"
                        ? "text-blue-700"
                        : "text-gray-800"
                }`}
              >
                {item.value}
              </p>
              <p className="text-xs font-bold text-gray-500">
                {item.unit}
                {item.extra && (
                  <span className="font-normal">{item.extra}</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
      {bmi && bmiCat && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div>
            <p className="text-xs text-gray-500">BMI</p>
            <p className="font-bold text-lg text-gray-800">{bmi}</p>
            <p className="text-xs font-bold text-gray-500">kg/m²</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${bmiCat.color}`}
          >
            {bmiCat.label}
          </span>
        </div>
      )}
    </div>
  );
}

// ── VitalGraph ────────────────────────────────────────────────────────────────
function VitalGraph({
  title,
  data,
  dataKey,
  unit,
  color,
  bgClass,
  borderClass,
  icon: Icon,
  outOfRangeCheck,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey: string | string[];
  unit: string;
  color: string | string[];
  bgClass: string;
  borderClass: string;
  icon: React.ElementType;
  outOfRangeCheck?: (key: string, value: number) => boolean;
}) {
  const keys = Array.isArray(dataKey) ? dataKey : [dataKey];
  const colors = Array.isArray(color) ? color : [color];
  const hasData = data.filter((r) => keys.some((k) => r[k])).length >= 2;

  // Custom dot renderer with glow for out-of-range values
  const makeCustomDot =
    (strokeColor: string, dKey: string) =>
    (props: {
      cx?: number;
      cy?: number;
      value?: number;
      payload?: Record<string, unknown>;
    }) => {
      const { cx, cy, value } = props;
      if (cx == null || cy == null || value == null) return <g />;
      const isOutOfRange = outOfRangeCheck
        ? outOfRangeCheck(dKey, value)
        : false;
      if (isOutOfRange) {
        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={7}
              fill="#DC2626"
              fillOpacity={0.2}
              stroke="#DC2626"
              strokeWidth={0}
            />
            <circle
              cx={cx}
              cy={cy}
              r={6}
              fill="#DC2626"
              stroke="white"
              strokeWidth={1.5}
              style={{ filter: "drop-shadow(0 0 4px #DC2626)" }}
            />
          </g>
        );
      }
      return (
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill={strokeColor}
          stroke="white"
          strokeWidth={1}
        />
      );
    };

  return (
    <div
      className={`${bgClass} rounded-xl border ${borderClass} shadow-sm overflow-hidden`}
    >
      {/* Colored card header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{
          background: Array.isArray(color)
            ? `linear-gradient(to right, ${colors[0]}22, ${colors[0]}11)`
            : `${color}18`,
        }}
      >
        <Icon className="w-4 h-4" style={{ color: colors[0] }} />
        <h4 className="font-semibold text-sm" style={{ color: colors[0] }}>
          {title}
        </h4>
        <span className="text-xs font-normal ml-1 opacity-60">({unit})</span>
      </div>
      <div className="p-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                label={{
                  value: unit,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontWeight: "bold", fontSize: 10 },
                }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {keys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={colors[i] || colors[0]}
                  strokeWidth={2.5}
                  dot={makeCustomDot(colors[i] || colors[0], k)}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                  name={k}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Activity className="w-6 h-6 mx-auto mb-1 opacity-40" />
            <p className="text-xs">Need 2+ visits for trend</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AppointmentsTab ───────────────────────────────────────────────────────────
const APPOINTMENTS_KEY = "medicare_appointments";

function AppointmentsTab({
  patientId,
  currentRole,
  patientName,
}: {
  patientId: bigint | null;
  currentRole: string;
  patientName: string;
}) {
  const allAppts = useMemo(() => {
    try {
      const raw = localStorage.getItem(APPOINTMENTS_KEY);
      if (!raw) return [];
      const all = JSON.parse(raw) as Array<{
        id: string;
        patientName: string;
        preferredDate: string;
        preferredTime: string;
        preferredDoctor: string;
        status: string;
        reason?: string;
        createdAt: string;
        patientId?: string;
      }>;
      if (!patientId) return all;
      return all.filter(
        (a) =>
          a.patientId === String(patientId) ||
          a.patientName?.toLowerCase() === patientName.toLowerCase(),
      );
    } catch {
      return [];
    }
  }, [patientId, patientName]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    preferredDate: "",
    preferredTime: "",
    preferredDoctor: "",
    reason: "",
  });

  const upcoming = allAppts.filter(
    (a) => a.status !== "cancelled" && new Date(a.preferredDate) >= new Date(),
  );
  const past = allAppts.filter(
    (a) => a.status === "cancelled" || new Date(a.preferredDate) < new Date(),
  );

  function createAppointment() {
    if (!form.preferredDate || !form.preferredTime) {
      toast.error("Please set date and time");
      return;
    }
    try {
      const raw = localStorage.getItem(APPOINTMENTS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      all.push({
        id: Date.now().toString(36),
        patientId: String(patientId),
        patientName,
        phone: "",
        preferredDoctor: form.preferredDoctor || "Dr. Arman Kabir",
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        reason: form.reason,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: currentRole,
      });
      localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(all));
      toast.success("Appointment created");
      setShowForm(false);
      setForm({
        preferredDate: "",
        preferredTime: "",
        preferredDoctor: "",
        reason: "",
      });
    } catch {
      toast.error("Failed to create appointment");
    }
  }

  return (
    <div className="space-y-4">
      {(currentRole === "doctor" ||
        currentRole === "admin" ||
        currentRole === "staff" ||
        currentRole === "patient") && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => setShowForm(!showForm)}
            data-ocid="patient_dashboard.appointments.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" />
            New Appointment
          </Button>
        </div>
      )}

      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-green-800 text-sm">
            Book Appointment
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Preferred Date *</Label>
              <input
                type="date"
                value={form.preferredDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferredDate: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                data-ocid="patient_dashboard.appointments.input"
              />
            </div>
            <div>
              <Label className="text-xs">Preferred Time *</Label>
              <input
                type="time"
                value={form.preferredTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferredTime: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                data-ocid="patient_dashboard.appointments.input"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Doctor</Label>
            <Input
              value={form.preferredDoctor}
              onChange={(e) =>
                setForm((f) => ({ ...f, preferredDoctor: e.target.value }))
              }
              placeholder="Dr. Arman Kabir"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={form.reason}
              onChange={(e) =>
                setForm((f) => ({ ...f, reason: e.target.value }))
              }
              placeholder="Follow-up, new complaint..."
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={createAppointment}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Save Appointment
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
          <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Upcoming Appointments
          </h3>
          <div className="space-y-2">
            {upcoming.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2.5 border border-green-100"
                data-ocid={`patient_dashboard.appointments.item.${i + 1}`}
              >
                <div>
                  <p className="font-medium text-sm text-green-800">
                    {a.preferredDate} — {a.preferredTime}
                  </p>
                  <p className="text-xs text-green-600">{a.preferredDoctor}</p>
                  {a.reason && (
                    <p className="text-xs text-gray-500">{a.reason}</p>
                  )}
                </div>
                <Badge
                  className={`text-xs border-0 ${a.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Past Appointments
          </h3>
          <div className="space-y-2">
            {past.slice(0, 5).map((a, i) => (
              <div
                key={a.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100"
                data-ocid={`patient_dashboard.appointments.item.${i + 1}`}
              >
                <div>
                  <p className="font-medium text-sm text-gray-700">
                    {a.preferredDate} — {a.preferredTime}
                  </p>
                  <p className="text-xs text-gray-500">{a.preferredDoctor}</p>
                </div>
                <Badge className="text-xs border-0 bg-gray-100 text-gray-600">
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {allAppts.length === 0 && (
        <div
          className="text-center py-10 bg-white rounded-xl border border-gray-200"
          data-ocid="patient_dashboard.appointments.empty_state"
        >
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No appointments yet</p>
        </div>
      )}
    </div>
  );
}

// ── AdmissionHistoryInlineSection ─────────────────────────────────────────────
function AdmissionHistoryInlineSection({
  records,
  viewerRole: _viewerRole,
  patient,
}: {
  records: AdmissionHistoryRecord[];
  viewerRole: StaffRole | "doctor";
  patient: Patient;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    records.length > 0 ? records[records.length - 1].id : null,
  );

  const FIELD_ROWS: Array<{
    label: string;
    key: keyof AdmissionHistoryRecord;
    color: string;
  }> = [
    {
      label: "Chief Complaints",
      key: "chiefComplaints",
      color: "text-blue-700",
    },
    {
      label: "History of Present Illness",
      key: "historyOfPresentIllness",
      color: "text-indigo-700",
    },
    {
      label: "Past Medical History",
      key: "pastMedicalHistory",
      color: "text-green-700",
    },
    {
      label: "Past Surgical History",
      key: "pastSurgicalHistory",
      color: "text-teal-700",
    },
    { label: "Drug History", key: "drugHistory", color: "text-amber-700" },
    { label: "Allergies", key: "allergies", color: "text-rose-700" },
    {
      label: "Physical / On Examination",
      key: "physicalExamination",
      color: "text-purple-700",
    },
    {
      label: "Provisional Diagnosis",
      key: "provisionalDiagnosis",
      color: "text-orange-700",
    },
    { label: "Initial Plan", key: "initialPlan", color: "text-cyan-700" },
  ];

  return (
    <div
      className="bg-white rounded-xl border-2 border-indigo-300 shadow-sm overflow-hidden"
      data-ocid="patient_dashboard.history.admission_hx_section"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-white" />
          <span className="font-semibold text-white text-sm">
            Admission History
          </span>
          <span className="text-indigo-200 text-xs">
            ({records.length} record{records.length > 1 ? "s" : ""})
          </span>
        </div>
        <span className="text-xs text-indigo-200 bg-indigo-700/40 px-2 py-0.5 rounded-full">
          {patient.fullName}
        </span>
      </div>

      {/* Records */}
      <div className="divide-y divide-indigo-100">
        {records.map((rec) => {
          const isExpanded = expandedId === rec.id;
          return (
            <div key={rec.id}>
              {/* Record header row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                className="w-full flex items-center justify-between px-5 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
                data-ocid="patient_dashboard.history.admission_hx_row"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center shrink-0">
                    <FileText className="w-3 h-3 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-800">
                      Admitted:{" "}
                      {rec.admittedOn
                        ? format(new Date(rec.admittedOn), "dd MMM yyyy")
                        : "—"}
                      {rec.hospitalName ? ` · ${rec.hospitalName}` : ""}
                      {rec.ward ? `, Ward ${rec.ward}` : ""}
                      {rec.bed ? `, Bed ${rec.bed}` : ""}
                    </p>
                    <p className="text-xs text-indigo-500">
                      By {rec.admittedBy} ({rec.admittedByRole}) ·{" "}
                      <span
                        className={`font-semibold ${rec.status === "complete" ? "text-green-600" : "text-amber-600"}`}
                      >
                        {rec.status === "complete"
                          ? "✓ Complete"
                          : "⏳ Awaiting Approval"}
                      </span>
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-indigo-400 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-5 py-4 space-y-3 bg-white">
                  {FIELD_ROWS.map(({ label, key, color }) => {
                    const value = rec[key];
                    if (!value) return null;

                    // Chief complaints is an array
                    if (key === "chiefComplaints" && Array.isArray(value)) {
                      const comps =
                        value as AdmissionHistoryRecord["chiefComplaints"];
                      if (comps.length === 0) return null;
                      return (
                        <div
                          key={key}
                          className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                        >
                          <p className="text-xs font-bold text-blue-700 mb-1.5">
                            Chief Complaints
                          </p>
                          <ul className="space-y-1">
                            {comps.map((c, ci) => (
                              <li
                                key={`cc-${String(ci)}`}
                                className="text-sm text-blue-800 flex items-start gap-1.5"
                              >
                                <span className="mt-0.5 shrink-0 text-blue-400">
                                  {ci + 1}.
                                </span>
                                <span>
                                  {c.complaint}
                                  {c.duration ? ` — ${c.duration}` : ""}
                                  {c.notes ? ` (${c.notes})` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }

                    // All other string fields
                    const strVal = String(value).trim();
                    if (!strVal) return null;
                    return (
                      <div
                        key={key}
                        className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3"
                      >
                        <p className={`text-xs font-bold mb-1 ${color}`}>
                          {label}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {strVal}
                        </p>
                      </div>
                    );
                  })}

                  {/* Change request notes */}
                  {rec.changeRequests.filter((cr) => !cr.resolved).length >
                    0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-amber-700 mb-1.5">
                        ⚠️ Pending Change Requests
                      </p>
                      {rec.changeRequests
                        .filter((cr) => !cr.resolved)
                        .map((cr) => (
                          <p
                            key={cr.id}
                            className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 mb-1"
                          >
                            "{cr.comment}" — {cr.requestedBy} at{" "}
                            {format(new Date(cr.requestedAt), "dd MMM HH:mm")}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HistoryTabContent ─────────────────────────────────────────────────────────
function HistoryTabContent({
  sortedVisits,
  currentRole,
  setSelectedVisit,
  downloadSingleVisitPDF,
  openRxForm,
}: {
  sortedVisits: Visit[];
  currentRole: string;
  setSelectedVisit: (v: Visit | null) => void;
  downloadSingleVisitPDF: (v: Visit) => void;
  openRxForm: (diagnosis?: string, visitId?: bigint) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sortedVisits.length === 0) {
    return (
      <p
        className="text-sm text-gray-400 text-center py-8"
        data-ocid="patient_dashboard.visits.empty_state"
      >
        No visit history yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sortedVisits.map((v, idx) => {
        const isExpanded = expandedId === v.id.toString();
        let extData: Record<string, unknown> = {};
        try {
          const fd = getVisitFormData(v.id);
          if (fd) extData = fd;
        } catch {}
        const showToPatient = extData.showToPatient !== false;
        const diagnosis = (extData.diagnosis as string) || v.diagnosis || "—";

        return (
          <div
            key={v.id.toString()}
            className="border border-gray-200 rounded-xl overflow-hidden"
            data-ocid={`patient_dashboard.visits.item.${idx + 1}`}
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : v.id.toString())}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {diagnosis}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatTime(v.visitDate)} · {v.visitType || "outpatient"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(currentRole === "doctor" || currentRole === "admin") && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 border-blue-300 text-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVisit(v);
                      }}
                      data-ocid={`patient_dashboard.visits.secondary_button.${idx + 1}`}
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 border-teal-300 text-teal-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRxForm(diagnosis, v.id);
                      }}
                      data-ocid={`patient_dashboard.visits.open_modal_button.${idx + 1}`}
                    >
                      <Pencil className="w-3 h-3" />
                      Rx
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 border-purple-300 text-purple-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSingleVisitPDF(v);
                      }}
                      data-ocid={`patient_dashboard.visits.button.${idx + 1}`}
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant={showToPatient ? "default" : "outline"}
                      className={`h-7 px-2 text-xs ${showToPatient ? "bg-green-600 text-white" : "border-gray-300 text-gray-600"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const stored = getVisitFormData(v.id) || {};
                        stored.showToPatient = !showToPatient;
                        localStorage.setItem(
                          `visit_form_data_${v.id}_${(localStorage.getItem("staff_auth") ? JSON.parse(localStorage.getItem("staff_auth") || "{}").email : null) || "default"}`,
                          JSON.stringify(stored),
                        );
                        toast.success(
                          showToPatient
                            ? "Hidden from patient"
                            : "Shown to patient",
                        );
                      }}
                    >
                      {showToPatient ? "Visible" : "Hidden"}
                    </Button>
                  </>
                )}
                {currentRole === "patient" && showToPatient && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1 border-purple-300 text-purple-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSingleVisitPDF(v);
                    }}
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </Button>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="p-4 space-y-3 bg-white">
                {/* 1. Patient Particulars */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-800 mb-2">
                    1. Particulars of the Patient
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    {v.chiefComplaint && (
                      <span>Chief Complaint: {v.chiefComplaint}</span>
                    )}
                    {v.visitType && <span>Visit Type: {v.visitType}</span>}
                    {formatTime(v.visitDate) && (
                      <span>Date: {formatTime(v.visitDate)}</span>
                    )}
                  </div>
                </div>
                {/* 2. Clinical Diagnosis */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-green-800 mb-1">
                    2. Clinical Diagnosis
                  </p>
                  <p className="text-sm text-green-700">{diagnosis}</p>
                  {extData.differentialDiagnosis ? (
                    <p className="text-xs text-green-600 mt-1">
                      DDx: {String(extData.differentialDiagnosis)}
                    </p>
                  ) : null}
                </div>
                {/* 3. Salient Features */}
                {extData.salientFeatures ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-purple-800 mb-1">
                      3. Salient Features
                    </p>
                    <p className="text-sm text-purple-700 whitespace-pre-line">
                      {String(extData.salientFeatures)}
                    </p>
                  </div>
                ) : null}
                {/* 4. Investigation Profile */}
                {Array.isArray(extData.previous_investigation_rows) &&
                  (
                    extData.previous_investigation_rows as Array<{
                      name: string;
                      result: string;
                      unit?: string;
                      date?: string;
                    }>
                  ).length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-amber-800 mb-2">
                        4. Investigation Profile
                      </p>
                      <div className="space-y-1">
                        {(
                          extData.previous_investigation_rows as Array<{
                            name: string;
                            result: string;
                            unit?: string;
                            date?: string;
                          }>
                        ).map((row) => (
                          <p
                            key={`${row.name}-${row.date}`}
                            className="text-xs text-amber-700"
                          >
                            {row.date && `${row.date}: `}
                            {row.name} — {row.result} {row.unit || ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                {/* 5. Ongoing Treatment */}
                {extData.ongoingTreatment ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-teal-800 mb-1">
                      5. Ongoing Treatment
                    </p>
                    <p className="text-sm text-teal-700 whitespace-pre-line">
                      {String(extData.ongoingTreatment)}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AccountSettingsTab ────────────────────────────────────────────────────────
function AccountSettingsTab({
  patientId,
  registerNo,
  currentRole,
  patientAccount,
  linkedAccount,
  reminders,
  prescriptionDrugChips,
  onSaveReminders,
}: {
  patientId: bigint | null;
  registerNo?: string;
  currentRole: string;
  patientAccount?: PatientAccount | null;
  linkedAccount?: PatientAccount;
  reminders: DrugReminder[];
  prescriptionDrugChips: string[];
  onSaveReminders: (updated: DrugReminder[]) => void;
}) {
  const { updatePatientCredentials } = useEmailAuth();
  const [acctNewPhone, setAcctNewPhone] = useState("");
  const [acctNewPassword, setAcctNewPassword] = useState("");
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [signUpEnabledState, setSignUpEnabledState] = useState<boolean | null>(
    null,
  );

  const signUpEnabled =
    signUpEnabledState !== null
      ? signUpEnabledState
      : registerNo
        ? isSignUpEnabled(registerNo)
        : false;

  const handleToggleSignUp = (checked: boolean) => {
    if (!registerNo) return;
    setSignUpEnabled(registerNo, checked);
    setSignUpEnabledState(checked);
    toast.success(
      checked
        ? "Sign-up enabled for this patient"
        : "Sign-up disabled for this patient",
    );
  };

  const handleSave = () => {
    if (!registerNo) return;
    if (!acctNewPhone && !acctNewPassword) {
      toast.error("Enter a new phone or password to save");
      return;
    }
    updatePatientCredentials(
      registerNo,
      acctNewPhone || undefined,
      acctNewPassword || undefined,
    );
    setAcctNewPhone("");
    setAcctNewPassword("");
    toast.success("Credentials updated");
  };

  const [newReminderDrug, setNewReminderDrug] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("08:00");
  const [newReminderTimes, setNewReminderTimes] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {/* Credentials section (admin/doctor can edit) */}
      {(currentRole === "admin" || currentRole === "doctor") && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
          <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4" /> Patient Login Credentials
          </h3>
          <div className="space-y-3">
            {linkedAccount && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                <p className="text-blue-800">
                  <span className="font-medium">Current mobile:</span>{" "}
                  <span className="font-mono">{linkedAccount.phone}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-800">Password:</span>
                  <span className="font-mono text-blue-700">
                    {showPasswordPlain
                      ? (() => {
                          try {
                            return (
                              atob(linkedAccount.passwordHash).split("::")[1] ??
                              "••••"
                            );
                          } catch {
                            return "••••";
                          }
                        })()
                      : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPasswordPlain(!showPasswordPlain)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {showPasswordPlain ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">New Mobile Number</Label>
              <Input
                value={acctNewPhone}
                onChange={(e) => setAcctNewPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                type="tel"
                className="mt-1"
                data-ocid="patient_dashboard.account.input"
              />
            </div>
            <div>
              <Label className="text-xs">New Password</Label>
              <Input
                value={acctNewPassword}
                onChange={(e) => setAcctNewPassword(e.target.value)}
                placeholder="Min. 6 chars"
                type="password"
                className="mt-1"
                data-ocid="patient_dashboard.account.input"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Update Credentials
            </Button>
          </div>

          {registerNo && (
            <div className="mt-4 pt-4 border-t border-blue-100 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-gray-700">
                  Allow Patient Sign-Up
                </p>
                <p className="text-xs text-gray-500">
                  Let this patient create a portal account
                </p>
              </div>
              <Switch
                checked={signUpEnabled}
                onCheckedChange={handleToggleSignUp}
                data-ocid="patient_dashboard.account.toggle"
              />
            </div>
          )}
        </div>
      )}

      {/* Patient own credentials */}
      {currentRole === "patient" && patientAccount && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-5">
          <h3 className="font-semibold text-teal-800 mb-4 flex items-center gap-2">
            🔑 My Login Details
          </h3>
          <div className="bg-teal-50 rounded-lg p-3 text-sm space-y-1 mb-3">
            <p className="text-teal-800">
              <span className="font-medium">Mobile:</span>{" "}
              <span className="font-mono">{patientAccount.phone}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="font-medium text-teal-800">Password:</span>
              <span className="font-mono text-teal-700">
                {showPasswordPlain
                  ? (() => {
                      try {
                        return (
                          atob(patientAccount.passwordHash).split("::")[1] ??
                          "••••"
                        );
                      } catch {
                        return "••••";
                      }
                    })()
                  : "••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowPasswordPlain(!showPasswordPlain)}
                className="text-teal-500 hover:text-teal-700"
              >
                {showPasswordPlain ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Contact the clinic to update your credentials.
          </p>
        </div>
      )}

      {/* Drug Reminders */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
        <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Drug Reminders
        </h3>

        {/* Auto-suggested drugs from prescriptions */}
        {prescriptionDrugChips.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1.5">
              Quick add from prescriptions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {prescriptionDrugChips.map((drug) => (
                <button
                  key={drug}
                  type="button"
                  onClick={() => setNewReminderDrug(drug)}
                  className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors"
                >
                  {drug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing reminders */}
        {reminders.length > 0 && (
          <div className="space-y-2 mb-4">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"
                data-ocid="patient_dashboard.account.reminder.item"
              >
                <Switch
                  checked={r.enabled}
                  onCheckedChange={() =>
                    onSaveReminders(
                      reminders.map((x) =>
                        x.id === r.id ? { ...x, enabled: !x.enabled } : x,
                      ),
                    )
                  }
                  data-ocid="patient_dashboard.account.toggle"
                />
                <span
                  className={`text-sm flex-1 ${r.enabled ? "text-gray-800" : "text-gray-400 line-through"}`}
                >
                  {r.drugName}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {r.times.map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSaveReminders(reminders.filter((x) => x.id !== r.id))
                  }
                  className="text-red-400 hover:text-red-600"
                  data-ocid="patient_dashboard.account.delete_button"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new reminder */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-semibold">Add New Reminder</Label>
          <Input
            placeholder="Drug name (e.g. Tab. Napa 500mg)"
            value={newReminderDrug}
            onChange={(e) => setNewReminderDrug(e.target.value)}
            data-ocid="patient_dashboard.account.input"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={newReminderTime}
              onChange={(e) => setNewReminderTime(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  newReminderTime &&
                  !newReminderTimes.includes(newReminderTime)
                ) {
                  setNewReminderTimes([...newReminderTimes, newReminderTime]);
                }
              }}
            >
              + Add Time
            </Button>
          </div>
          {newReminderTimes.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {newReminderTimes.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() =>
                      setNewReminderTimes(
                        newReminderTimes.filter((x) => x !== t),
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <Button
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => {
              if (!newReminderDrug.trim() || newReminderTimes.length === 0) {
                toast.error("Enter a drug name and at least one time");
                return;
              }
              if (Notification.permission === "default")
                Notification.requestPermission();
              const r: DrugReminder = {
                id: `${Date.now()}`,
                patientId: String(patientId),
                drugName: newReminderDrug.trim(),
                times: newReminderTimes,
                enabled: true,
                createdAt: new Date().toISOString(),
              };
              onSaveReminders([...reminders, r]);
              setNewReminderDrug("");
              setNewReminderTimes([]);
              setNewReminderTime("08:00");
              toast.success(`Reminder set for ${r.drugName}`);
            }}
            data-ocid="patient_dashboard.account.save_button"
          >
            <Bell className="w-4 h-4 mr-2" />
            Save Reminder
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main PatientDashboardInner ─────────────────────────────────────────────────
interface PatientDashboardInnerProps {
  patientId: bigint;
  patient: Patient;
  currentRole: "admin" | "doctor" | "staff" | "patient";
  /** Granular 6-tier role for permission-gated clinical actions */
  viewerRole?: StaffRole;
  patientAccount?: PatientAccount | null;
  sortedVisits: Visit[];
  latestVisit: Visit | null;
  latestVitals: Record<string, string> | null;
  vitalsHistory: Array<Record<string, unknown>>;
  allInvestigations: Array<{
    date: string;
    name: string;
    result: string;
    unit?: string;
    interpretation?: string;
  }>;
  invByName: Record<
    string,
    { data: Array<{ date: string; value: number }>; unit: string }
  >;
  prescriptions: Prescription[];
  loadingVisits: boolean;
  loadingRx: boolean;
  setShowVisitForm: (v: boolean) => void;
  setSelectedVisit: (v: Visit | null) => void;
  setSelectedRx: (rx: Prescription | null) => void;
  setEditRx: (rx: Prescription | null) => void;
  setPadPrescription: (rx: Prescription | null) => void;
  setShowPadPreview: (v: boolean) => void;
  loadSavedPads: () => void;
  savedPads: Array<Record<string, unknown>>;
  openRxForm: (diagnosis?: string, visitId?: bigint) => void;
  downloadVisitHistoryPDF: () => void;
  downloadSingleVisitPDF: (v: Visit) => void;
  downloadPrescriptionsPDF: () => void;
  downloadSinglePrescriptionPDF: (rx: Prescription) => void;
  age: number | null;
  initials: string;
  formatDateTime: (t: bigint) => string;
}

export default function PatientDashboardInner({
  patientId,
  patient,
  currentRole,
  viewerRole,
  patientAccount,
  sortedVisits,
  latestVisit,
  latestVitals,
  vitalsHistory,
  allInvestigations,
  invByName,
  prescriptions,
  loadingVisits,
  loadingRx,
  setShowVisitForm,
  setSelectedVisit,
  setSelectedRx,
  setEditRx,
  setPadPrescription,
  setShowPadPreview,
  loadSavedPads,
  savedPads,
  openRxForm,
  downloadVisitHistoryPDF,
  downloadSingleVisitPDF,
  downloadPrescriptionsPDF,
  downloadSinglePrescriptionPDF,
  age,
}: PatientDashboardInnerProps) {
  // ── Derive granular permissions from viewerRole ───────────────────────────────
  // Falls back to full doctor perms when no viewerRole is supplied (backward compat)
  const permissions = getPermissionsForRole(viewerRole ?? "doctor");

  const registerNo = (patient as Record<string, unknown>).registerNumber as
    | string
    | undefined;
  const linkedAccount = registerNo
    ? loadPatientRegistry().find(
        (p) => p.registerNumber?.toLowerCase() === registerNo.toLowerCase(),
      )
    : undefined;

  // ── Complaints ────────────────────────────────────────────────────────────────
  const [complaints, setComplaints] = useState<ComplaintEntry[]>(() =>
    loadComplaints(String(patientId)),
  );
  const [newComplaintText, setNewComplaintText] = useState("");

  // ── Referral modal state ──────────────────────────────────────────────────────
  const [showReferralModal, setShowReferralModal] = useState(false);

  // ── Advice ────────────────────────────────────────────────────────────────────
  const [adviceEntries, setAdviceEntries] = useState<AdviceEntry[]>(() =>
    loadAdviceEntries(String(patientId)),
  );
  const [newAdviceText, setNewAdviceText] = useState("");
  const [newAdviceDate, setNewAdviceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );

  // ── Submissions ────────────────────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState<PatientSubmission[]>(() =>
    loadSubmissions(),
  );
  const patientSubmissions = useMemo(
    () => submissions.filter((s) => s.patientId === String(patientId)),
    [submissions, patientId],
  );
  const pendingCount = patientSubmissions.filter(
    (s) => s.status === "pending",
  ).length;

  function approveSubmission(id: string) {
    const all = loadSubmissions();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status: "approved" };
      saveSubmissions(all);
      setSubmissions(loadSubmissions());
      toast.success("Submission approved");
    }
  }
  function rejectSubmission(id: string) {
    const all = loadSubmissions();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status: "rejected" };
      saveSubmissions(all);
      setSubmissions(loadSubmissions());
      toast.success("Submission rejected");
    }
  }

  // ── Drug Reminders ────────────────────────────────────────────────────────────
  const REMINDERS_KEY = "medicare_drug_reminders";
  const [reminders, setReminders] = useState<DrugReminder[]>(() => {
    try {
      const all: DrugReminder[] = JSON.parse(
        localStorage.getItem(REMINDERS_KEY) || "[]",
      );
      return all.filter((r) => r.patientId === patientId.toString());
    } catch {
      return [];
    }
  });

  const saveReminders = (updated: DrugReminder[]) => {
    setReminders(updated);
    const all: DrugReminder[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
      } catch {
        return [];
      }
    })();
    const others = all.filter((r) => r.patientId !== patientId.toString());
    localStorage.setItem(
      REMINDERS_KEY,
      JSON.stringify([...others, ...updated]),
    );
  };

  const prescriptionDrugChips = useMemo(() => {
    const drugs: string[] = [];
    for (const rx of prescriptions) {
      for (const m of rx.medications || []) {
        const name = [m.drugForm || m.form, m.drugName || m.name, m.dose]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (name && !drugs.includes(name)) drugs.push(name);
      }
    }
    return drugs.slice(0, 20);
  }, [prescriptions]);

  // ── Investigations search ──────────────────────────────────────────────────────
  const [invSearch, setInvSearch] = useState("");
  const filteredInvRows = useMemo(() => {
    if (!invSearch) return allInvestigations.slice(0, 50);
    return allInvestigations.filter((r) =>
      r.name.toLowerCase().includes(invSearch.toLowerCase()),
    );
  }, [allInvestigations, invSearch]);

  // ── Pregnancy ─────────────────────────────────────────────────────────────────
  const [pregnancyData, setPregnancyData] = useState<{
    lmp: string;
    gravida: string;
    para: string;
    active: boolean;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(`pregnancy_${patientId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [showPregnancyForm, setShowPregnancyForm] = useState(false);
  const [lmpInput, setLmpInput] = useState("");
  const [gravidaInput, setGravidaInput] = useState("");
  const [paraInput, setParaInput] = useState("");

  const savePregnancyData = () => {
    if (!lmpInput) return;
    const data = {
      lmp: lmpInput,
      gravida: gravidaInput,
      para: paraInput,
      active: true,
    };
    localStorage.setItem(`pregnancy_${patientId}`, JSON.stringify(data));
    setPregnancyData(data);
    setShowPregnancyForm(false);
  };
  const clearPregnancyData = () => {
    localStorage.removeItem(`pregnancy_${patientId}`);
    setPregnancyData(null);
  };
  const calcPregnancy = (lmp: string) => {
    const lmpDate = new Date(lmp);
    const diffDays = Math.floor(
      (Date.now() - lmpDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weeks = Math.floor(diffDays / 7);
    const months = (weeks / 4.33).toFixed(1);
    const edd = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
    return {
      weeks,
      months,
      edd: edd.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
  };

  // ── Patient Submit Data ───────────────────────────────────────────────────────
  const [submitTab, setSubmitTab] = useState("complaint");
  const [complaint, setComplaint] = useState("");
  const [vitalFields, setVitalFields] = useState({
    systolic: "",
    diastolic: "",
    pulse: "",
    temp: "",
    spo2: "",
    weight: "",
    height: "",
  });
  const [invFields, setInvFields] = useState({
    name: "",
    date: "",
    result: "",
    unit: "",
  });
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);

  function handleSubmitData() {
    let type: PatientSubmission["type"] = "complaint";
    let data: Record<string, string> = {};
    if (submitTab === "complaint") {
      if (!complaint.trim()) {
        toast.error("Please describe your symptoms");
        return;
      }
      type = "complaint";
      data = { complaint };
    } else if (submitTab === "vitals") {
      type = "vitals";
      data = { ...vitalFields };
    } else {
      if (!invFields.name || !invFields.result) {
        toast.error("Enter investigation name and result");
        return;
      }
      type = "investigation";
      data = { ...invFields };
    }
    const sub: PatientSubmission = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      patientId: String(patientId),
      type,
      data,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    const all = loadSubmissions();
    all.push(sub);
    saveSubmissions(all);
    setSubmissions(loadSubmissions());

    // Role-specific confirmation messages
    if (type === "vitals") {
      toast.success(
        "✓ Vitals submitted — your doctor will review this shortly",
        {
          duration: 5000,
        },
      );
    } else if (type === "complaint") {
      toast.success("✓ Submitted — your doctor will review this", {
        duration: 5000,
      });
    } else if (type === "investigation") {
      toast.success(
        "📋 Submitted for approval — your doctor will review before it appears in your record",
        { duration: 6000 },
      );
    } else {
      toast.success("Submitted! Awaiting doctor approval.");
    }

    setShowSubmitPanel(false);
    setComplaint("");
    setVitalFields({
      systolic: "",
      diastolic: "",
      pulse: "",
      temp: "",
      spo2: "",
      weight: "",
      height: "",
    });
    setInvFields({ name: "", date: "", result: "", unit: "" });
  }

  const bmi = (() => {
    const wt = latestVitals?.weight
      ? Number.parseFloat(latestVitals.weight)
      : patient.weight;
    const ht = latestVitals?.height
      ? Number.parseFloat(latestVitals.height)
      : patient.height;
    if (!wt || !ht) return null;
    return Math.round((wt / ((ht / 100) * (ht / 100))) * 10) / 10;
  })();
  const bmiCat = bmi ? getBMICategory(bmi) : null;

  // Check if most recent visit is admitted — show Daily Progress Note tab only for admitted patients + clinical roles
  const isAdmittedPatient =
    latestVisit?.visitType === "admitted" ||
    latestVisit?.visitType === "inpatient";
  const canViewDailyProgress =
    isAdmittedPatient &&
    (viewerRole === "consultant_doctor" ||
      viewerRole === "medical_officer" ||
      viewerRole === "intern_doctor" ||
      viewerRole === "nurse" ||
      currentRole === "doctor" ||
      currentRole === "admin");

  // ── Bilingual language toggle ───────────────────────────────────────────────
  const [lang, setLang] = useState<"en" | "bn">(() => {
    try {
      return (localStorage.getItem("patient_language") as "en" | "bn") ?? "en";
    } catch {
      return "en";
    }
  });
  const toggleLang = () => {
    const next = lang === "en" ? "bn" : "en";
    setLang(next);
    try {
      localStorage.setItem("patient_language", next);
    } catch {}
  };
  const t = (en: string, bn: string) => (lang === "bn" ? bn : en);

  // ── WhatsApp dropdown state ────────────────────────────────────────────────
  const [waDropdownOpen, setWaDropdownOpen] = useState(false);
  const [waModalType, setWaModalType] = useState<
    "report_ready" | "follow_up" | null
  >(null);
  const [waReportName, setWaReportName] = useState("");
  const [waFollowUpDate, setWaFollowUpDate] = useState("");
  const [waFollowUpTime, setWaFollowUpTime] = useState("");

  const patientPhone =
    ((patient as Record<string, unknown>).phone as string | undefined) ||
    ((patient as Record<string, unknown>).mobile as string | undefined);
  const doctorName = "Dr. Arman Kabir";
  const clinicName = "Dr. Arman Kabir's Care";

  function openWaReportModal() {
    setWaReportName("");
    setWaDropdownOpen(false);
    setWaModalType("report_ready");
  }
  function openWaFollowUpModal() {
    setWaFollowUpDate("");
    setWaFollowUpTime("");
    setWaDropdownOpen(false);
    setWaModalType("follow_up");
  }
  function sendWaMessage() {
    if (!patientPhone) {
      toast.error("No phone number on record for this patient");
      setWaModalType(null);
      return;
    }
    let url = "";
    if (waModalType === "report_ready") {
      if (!waReportName.trim()) {
        toast.error("Enter a report name");
        return;
      }
      url = buildReportReadyMessage(
        patient,
        doctorName,
        clinicName,
        waReportName.trim(),
      );
    } else if (waModalType === "follow_up") {
      if (!waFollowUpDate || !waFollowUpTime) {
        toast.error("Enter date and time");
        return;
      }
      const dateStr = new Date(waFollowUpDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      url = buildFollowUpMessage(
        patient,
        doctorName,
        clinicName,
        dateStr,
        waFollowUpTime,
      );
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setWaModalType(null);
  }

  // ── Encounters & clinical notes for Discharge tab ──────────────────────────
  const { data: encounters = [] } = useGetEncountersByPatient(patientId);
  const { data: clinicalNotes = [] } = useGetClinicalNotesByPatient(patientId);
  const canApproveDischarge =
    viewerRole === "consultant_doctor" || currentRole === "admin";

  const TAB_CONFIG = [
    {
      value: "overview",
      label: t("🏠 Overview", "🏠 ওভারভিউ"),
      activeClass: "data-[state=active]:bg-blue-500",
    },
    {
      value: "vitals",
      label: t("❤️ Vitals", "❤️ ভাইটালস"),
      activeClass: "data-[state=active]:bg-red-500",
    },
    {
      value: "investigations",
      label: t("🧪 Investigations", "🧪 পরীক্ষা-নিরীক্ষা"),
      activeClass: "data-[state=active]:bg-teal-600",
    },
    {
      value: "history",
      label: t("📋 History", "📋 ইতিহাস"),
      activeClass: "data-[state=active]:bg-purple-500",
    },
    {
      value: "timeline",
      label: t("🕐 Timeline", "🕐 টাইমলাইন"),
      activeClass: "data-[state=active]:bg-slate-500",
    },
    {
      value: "prescriptions",
      label: t("💊 Prescriptions", "💊 প্রেসক্রিপশন"),
      activeClass: "data-[state=active]:bg-indigo-500",
    },
    {
      value: "appointments",
      label: t("📅 Appointments", "📅 অ্যাপয়েন্টমেন্ট"),
      activeClass: "data-[state=active]:bg-green-600",
    },
    {
      value: "pending",
      label: t("⏳ Pending", "⏳ অনুমোদন বাকি"),
      activeClass: "data-[state=active]:bg-amber-500",
      badge: pendingCount,
    },
    {
      value: "complaints",
      label: t("📝 Complaints", "📝 অভিযোগ"),
      activeClass: "data-[state=active]:bg-pink-500",
      badge:
        currentRole === "doctor" || currentRole === "admin"
          ? complaints.filter((c) => c.status === "pending").length
          : 0,
    },
    {
      value: "advice",
      label: t("💡 Advice", "💡 পরামর্শ"),
      activeClass: "data-[state=active]:bg-emerald-600",
    },
    {
      value: "chat",
      label: t("💬 Chat", "💬 চ্যাট"),
      activeClass: "data-[state=active]:bg-cyan-600",
    },
    {
      value: "account",
      label: t("⚙️ Account", "⚙️ অ্যাকাউন্ট"),
      activeClass: "data-[state=active]:bg-slate-600",
    },
    {
      value: "daily_progress",
      label: t("📋 Daily Progress", "📋 দৈনিক অগ্রগতি"),
      activeClass: "data-[state=active]:bg-indigo-700",
      hidden: !canViewDailyProgress,
    },
    {
      value: "discharge",
      label: t("🏥 Discharge", "🏥 ছাড়পত্র"),
      activeClass: "data-[state=active]:bg-rose-700",
      hidden: !isAdmittedPatient,
    },
    {
      value: "soap_notes",
      label: t("🗒 SOAP Notes", "🗒 সোপ নোটস"),
      activeClass: "data-[state=active]:bg-slate-700",
    },
    {
      value: "handover",
      label: t("🤝 Handover", "🤝 হ্যান্ডওভার"),
      activeClass: "data-[state=active]:bg-violet-600",
      hidden:
        currentRole === "patient" ||
        (viewerRole !== "nurse" &&
          viewerRole !== "medical_officer" &&
          viewerRole !== "consultant_doctor" &&
          viewerRole !== "doctor" &&
          currentRole !== "doctor" &&
          currentRole !== "admin"),
    },
    {
      value: "inv_payment",
      label: t("🧾 Inv. Payment", "🧾 তদন্ত বিল"),
      activeClass: "data-[state=active]:bg-purple-600",
      hidden: currentRole === "patient",
    },
    {
      value: "procedures",
      label: t("🔬 Procedures", "🔬 পদ্ধতি"),
      activeClass: "data-[state=active]:bg-teal-700",
      hidden:
        currentRole === "patient" &&
        !patient.isAdmitted &&
        patient.patientType !== "admitted",
    },
    {
      value: "referrals",
      label: t("📤 Referrals", "📤 রেফারেল"),
      activeClass: "data-[state=active]:bg-blue-700",
      hidden:
        currentRole !== "doctor" &&
        currentRole !== "admin" &&
        viewerRole !== "consultant_doctor" &&
        viewerRole !== "medical_officer",
    },
  ];

  return (
    <>
      <Tabs defaultValue="overview" className="w-full">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* VERTICAL TAB NAV */}
          <div className="lg:w-52 shrink-0">
            {/* Bilingual toggle */}
            <div className="flex justify-end mb-1.5">
              <button
                type="button"
                onClick={toggleLang}
                className="text-xs px-2.5 py-1 rounded-full border border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold transition-colors"
                data-ocid="patient_dashboard.lang_toggle"
                title={lang === "en" ? "Switch to Bangla" : "Switch to English"}
              >
                {lang === "en" ? "EN | বাং" : "বাং | EN"}
              </button>
            </div>
            <TabsList className="flex flex-row lg:flex-col w-full h-auto p-1.5 gap-1 bg-gray-100 rounded-xl overflow-x-auto lg:overflow-x-visible">
              {TAB_CONFIG.filter(
                (tab) => !(tab as { hidden?: boolean }).hidden,
              ).map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={`w-full justify-start text-left shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium relative data-[state=active]:text-white data-[state=active]:shadow-md ${tab.activeClass}`}
                  data-ocid="patient_dashboard.tab"
                >
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 min-w-0">
            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-4">
              {/* Red Flag Monitor — visible to all clinical roles including consultant */}
              {(currentRole === "doctor" ||
                currentRole === "admin" ||
                viewerRole === "consultant_doctor" ||
                viewerRole === "medical_officer" ||
                viewerRole === "intern_doctor" ||
                viewerRole === "nurse") && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Red Flag Monitor
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      Auto-refresh every 5 min
                    </span>
                  </div>
                  <RedFlagMonitor
                    patientId={patientId}
                    latestVitals={latestVitals}
                    allInvestigations={allInvestigations}
                    prescriptions={prescriptions}
                    diagnoses={[
                      latestVisit?.diagnosis ?? "",
                      ...(patient.chronicConditions ?? []),
                    ].filter(Boolean)}
                  />
                </div>
              )}
              {/* Patient profile card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                {currentRole === "patient" && (
                  <div className="flex justify-end mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
                      onClick={() => setShowSubmitPanel(!showSubmitPanel)}
                      data-ocid="patient_dashboard.overview.open_modal_button"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Update My Health
                    </Button>
                  </div>
                )}

                {/* Doctor / admin WhatsApp quick-send + Refer Patient */}
                {(currentRole === "doctor" || currentRole === "admin") && (
                  <div className="flex justify-end gap-2 mb-3 relative flex-wrap">
                    {/* Print Summary Card button */}
                    <PatientSummaryCard
                      patientId={patientId}
                      patient={patient}
                      visits={sortedVisits}
                      prescriptions={prescriptions}
                    />
                    {/* Refer Patient button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setShowReferralModal(true)}
                      data-ocid="patient_dashboard.overview.refer_patient_button"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Refer Patient
                    </Button>
                    <div className="relative">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-green-600 hover:bg-green-700 text-white pr-2"
                        onClick={() => setWaDropdownOpen((o) => !o)}
                        data-ocid="patient_dashboard.whatsapp_dropdown.button"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 fill-white"
                          role="img"
                          aria-label="WhatsApp"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Send WhatsApp
                        <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                      {waDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-green-200 rounded-xl shadow-lg py-1 min-w-[200px]">
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 text-green-800 font-medium flex items-center gap-2"
                            onClick={openWaReportModal}
                            data-ocid="patient_dashboard.whatsapp.report_ready"
                          >
                            <FlaskConical className="w-4 h-4 text-green-600" />
                            Report Ready Notification
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 text-green-800 font-medium flex items-center gap-2"
                            onClick={openWaFollowUpModal}
                            data-ocid="patient_dashboard.whatsapp.follow_up"
                          >
                            <Calendar className="w-4 h-4 text-green-600" />
                            Follow-up Reminder
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* WhatsApp modals */}
                {waModalType === "report_ready" && (
                  <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2 text-sm">
                      <FlaskConical className="w-4 h-4" /> Send Report Ready
                      Notification
                    </h4>
                    <p className="text-xs text-green-600">
                      Patient:{" "}
                      <span className="font-semibold">{patient.fullName}</span>{" "}
                      · {patientPhone || "No phone"}
                    </p>
                    <div>
                      <label
                        htmlFor="wa-report-name"
                        className="text-xs font-medium text-gray-600"
                      >
                        Report Name *
                      </label>
                      <input
                        id="wa-report-name"
                        type="text"
                        value={waReportName}
                        onChange={(e) => setWaReportName(e.target.value)}
                        placeholder="e.g. CBC, S. Creatinine, Chest X-Ray"
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        data-ocid="patient_dashboard.whatsapp.report_name.input"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={sendWaMessage}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Open WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setWaModalType(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {waModalType === "follow_up" && (
                  <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4" /> Send Follow-up Reminder
                    </h4>
                    <p className="text-xs text-green-600">
                      Patient:{" "}
                      <span className="font-semibold">{patient.fullName}</span>{" "}
                      · {patientPhone || "No phone"}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="wa-followup-date"
                          className="text-xs font-medium text-gray-600"
                        >
                          Appointment Date *
                        </label>
                        <input
                          id="wa-followup-date"
                          type="date"
                          value={waFollowUpDate}
                          onChange={(e) => setWaFollowUpDate(e.target.value)}
                          className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          data-ocid="patient_dashboard.whatsapp.followup_date.input"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="wa-followup-time"
                          className="text-xs font-medium text-gray-600"
                        >
                          Appointment Time *
                        </label>
                        <input
                          id="wa-followup-time"
                          type="time"
                          value={waFollowUpTime}
                          onChange={(e) => setWaFollowUpTime(e.target.value)}
                          className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          data-ocid="patient_dashboard.whatsapp.followup_time.input"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={sendWaMessage}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Open WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setWaModalType(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[220px]">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-teal-600" /> Patient Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-2.5 text-sm">
                      {[
                        [
                          "Sex",
                          patient.gender
                            ? patient.gender === "male"
                              ? "Male"
                              : patient.gender === "female"
                                ? "Female"
                                : "Other"
                            : "N/A",
                        ],
                        ["Age", age ? `${age} years` : "N/A"],
                        ["Blood Group", patient.bloodGroup || "N/A"],
                        [
                          "Status",
                          (patient as Record<string, unknown>).status ===
                            "Admitted" ||
                          patient.isAdmitted ||
                          patient.patientType === "admitted" ||
                          patient.patientType === "indoor"
                            ? "🏥 Admitted"
                            : latestVisit
                              ? "Under Treatment"
                              : "Active",
                        ],
                        [
                          "Last Visit",
                          latestVisit
                            ? formatTime(latestVisit.visitDate)
                            : "No visits",
                        ],
                        ["Register No.", registerNo || "N/A"],
                        ...(((patient as Record<string, unknown>).status ===
                          "Admitted" ||
                          patient.isAdmitted ||
                          patient.patientType === "admitted" ||
                          patient.patientType === "indoor") &&
                        (patient as Record<string, unknown>).ward
                          ? [
                              [
                                "Ward / Bed",
                                `${(patient as Record<string, unknown>).ward as string}${(patient as Record<string, unknown>).bedNumber ? `, Bed ${(patient as Record<string, unknown>).bedNumber as string}` : ""}`,
                              ],
                            ]
                          : []),
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="bg-gray-50 rounded-lg p-2.5"
                        >
                          <p className="text-xs text-gray-400 mb-0.5">
                            {label}
                          </p>
                          <p className="font-semibold text-gray-800 text-sm">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {latestVisit && (
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" /> Latest
                        Visit
                      </h3>
                      <div className="bg-blue-50 rounded-xl p-3 text-sm space-y-2">
                        <p className="text-xs text-blue-500">
                          {formatTime(latestVisit.visitDate)}
                        </p>
                        {latestVisit.diagnosis && (
                          <p className="font-semibold text-blue-800">
                            {latestVisit.diagnosis}
                          </p>
                        )}
                        {latestVisit.chiefComplaint && (
                          <p className="text-blue-700 text-xs">
                            {latestVisit.chiefComplaint}
                          </p>
                        )}
                        <Badge className="text-xs border-0 bg-amber-100 text-amber-700">
                          Under Treatment
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
                {bmi && bmiCat && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-500">BMI</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {bmi}{" "}
                        <span className="text-sm font-normal text-gray-500">
                          kg/m²
                        </span>
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold ${bmiCat.color}`}
                    >
                      {bmiCat.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Latest vitals - blue gradient header */}
              <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-5 py-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-white" />
                  <h3 className="font-semibold text-white text-sm">
                    Latest Vitals
                  </h3>
                  {latestVisit && (
                    <span className="text-xs text-blue-200 ml-auto">
                      {formatTime(latestVisit.visitDate)}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <VitalsBar
                    vitals={latestVitals}
                    weight={patient.weight}
                    height={patient.height}
                  />
                </div>
              </div>

              {/* Family History Risk Card */}
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
                    className="rounded-xl overflow-hidden shadow-sm"
                    data-ocid="patient_dashboard.family_risk_section"
                  >
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 flex items-center gap-2">
                      <span className="text-white text-sm">🧬</span>
                      <h3 className="font-semibold text-white text-sm">
                        Family History Risk
                      </h3>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 border-t-0 px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {active.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-1 bg-orange-100 text-orange-900 border border-orange-300 rounded-full px-2.5 py-1 text-xs font-semibold"
                          >
                            🔴 {r}
                          </span>
                        ))}
                      </div>
                      {risk.additionalNotes && (
                        <p className="text-xs text-orange-700 mt-2 italic">
                          {risk.additionalNotes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Pregnancy Card */}
              {patient.gender === "female" &&
                (currentRole === "doctor" || currentRole === "admin") && (
                  <div className="bg-white rounded-xl border border-pink-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Baby className="w-4 h-4 text-pink-500" /> Pregnancy
                        Status
                      </h3>
                      <div className="flex gap-2">
                        {pregnancyData?.active && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-300 text-red-600"
                            onClick={clearPregnancyData}
                          >
                            Clear
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-pink-300 text-pink-600"
                          onClick={() =>
                            setShowPregnancyForm(!showPregnancyForm)
                          }
                        >
                          {pregnancyData?.active ? "Update" : "Set Pregnancy"}
                        </Button>
                      </div>
                    </div>
                    {showPregnancyForm && (
                      <div className="bg-pink-50 rounded-lg p-3 mb-3 space-y-2 border border-pink-100">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            {
                              id: "preg-lmp",
                              label: "LMP Date",
                              type: "date",
                              value: lmpInput,
                              onChange: setLmpInput,
                            },
                            {
                              id: "preg-gravida",
                              label: "Gravida",
                              type: "number",
                              value: gravidaInput,
                              onChange: setGravidaInput,
                            },
                            {
                              id: "preg-para",
                              label: "Para",
                              type: "number",
                              value: paraInput,
                              onChange: setParaInput,
                            },
                          ].map((field) => (
                            <div key={field.id}>
                              <label
                                htmlFor={field.id}
                                className="text-xs text-gray-500 mb-1 block"
                              >
                                {field.label}
                              </label>
                              <input
                                id={field.id}
                                type={field.type}
                                min="0"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                                data-ocid="patient_dashboard.pregnancy.input"
                              />
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={savePregnancyData}
                          className="bg-pink-600 hover:bg-pink-700 text-white"
                          data-ocid="patient_dashboard.pregnancy.save_button"
                        >
                          Save
                        </Button>
                      </div>
                    )}
                    {pregnancyData?.active && pregnancyData.lmp ? (
                      (() => {
                        const info = calcPregnancy(pregnancyData.lmp);
                        return (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-pink-50 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-pink-600">
                                  {info.weeks}
                                </p>
                                <p className="text-xs text-gray-500">Weeks</p>
                              </div>
                              <div className="bg-rose-50 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-rose-600">
                                  {info.months}
                                </p>
                                <p className="text-xs text-gray-500">Months</p>
                              </div>
                              <div className="bg-purple-50 rounded-lg p-3 text-center">
                                <p className="text-sm font-bold text-purple-600">
                                  {info.edd}
                                </p>
                                <p className="text-xs text-gray-500">EDD</p>
                              </div>
                            </div>
                            {pregnancyData.gravida && (
                              <p className="text-xs text-gray-500">
                                G{pregnancyData.gravida}P
                                {pregnancyData.para || 0}
                              </p>
                            )}
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                <HeartPulse className="w-3.5 h-3.5 text-pink-500" />{" "}
                                Pregnancy Advice
                              </p>
                              {[
                                "Take folic acid 400–800 mcg daily",
                                "Prenatal vitamins as prescribed",
                                "Avoid alcohol, tobacco, raw fish",
                                `Next scan at ${info.weeks < 20 ? "20" : "32"} weeks`,
                                "Monitor BP and blood sugar regularly",
                                "Emergency: severe headache, blurred vision, or bleeding → visit immediately",
                              ].map((adv) => (
                                <p
                                  key={adv}
                                  className="text-xs text-gray-600 flex items-start gap-1.5 bg-pink-50/60 rounded px-2 py-1"
                                >
                                  <span className="text-pink-400 mt-0.5">
                                    •
                                  </span>
                                  {adv}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <p
                        className="text-sm text-gray-400 text-center py-2"
                        data-ocid="patient_dashboard.pregnancy.empty_state"
                      >
                        No active pregnancy recorded
                      </p>
                    )}
                  </div>
                )}

              {/* Patient data submission panel */}
              {currentRole === "patient" && showSubmitPanel && (
                <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-5">
                  <h3 className="font-semibold text-teal-800 mb-3">
                    Submit Health Data
                  </h3>
                  <div className="flex gap-2 mb-4">
                    {["complaint", "vitals", "investigation"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSubmitTab(t)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${submitTab === t ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {submitTab === "complaint" && (
                    <Textarea
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      placeholder="Describe your symptoms..."
                      rows={3}
                      data-ocid="patient_dashboard.submit.textarea"
                    />
                  )}
                  {submitTab === "vitals" && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "systolic", label: "Systolic BP (mmHg)" },
                        { key: "diastolic", label: "Diastolic BP (mmHg)" },
                        { key: "pulse", label: "Pulse (beats/min)" },
                        { key: "temp", label: "Temperature (°C)" },
                        { key: "spo2", label: "SpO₂ (%)" },
                        { key: "weight", label: "Weight (kg)" },
                      ].map((f) => (
                        <div key={f.key}>
                          <Label className="text-xs">{f.label}</Label>
                          <Input
                            value={
                              vitalFields[f.key as keyof typeof vitalFields]
                            }
                            onChange={(e) =>
                              setVitalFields((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            placeholder="Value"
                            type="number"
                            className="mt-1"
                            data-ocid="patient_dashboard.submit.input"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {submitTab === "investigation" && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "name", label: "Test Name" },
                        { key: "result", label: "Result" },
                        { key: "unit", label: "Unit" },
                        { key: "date", label: "Date" },
                      ].map((f) => (
                        <div key={f.key}>
                          <Label className="text-xs">{f.label}</Label>
                          <Input
                            value={invFields[f.key as keyof typeof invFields]}
                            onChange={(e) =>
                              setInvFields((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            type={f.key === "date" ? "date" : "text"}
                            className="mt-1"
                            data-ocid="patient_dashboard.submit.input"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    className="mt-3 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={handleSubmitData}
                    data-ocid="patient_dashboard.submit.submit_button"
                  >
                    Submit for Doctor Review
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── VITALS ── */}
            <TabsContent value="vitals" className="space-y-4">
              <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-5 py-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-white" />
                  <h3 className="font-semibold text-white text-sm">
                    Vital Signs Summary
                  </h3>
                </div>
                <div className="p-5">
                  <VitalsBar
                    vitals={latestVitals}
                    weight={patient.weight}
                    height={patient.height}
                    showAlertBanner={true}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VitalGraph
                  title="Blood Pressure"
                  data={vitalsHistory}
                  dataKey={["BP", "Diastolic"]}
                  unit="mmHg"
                  color={["#DC2626", "#EF4444"]}
                  bgClass="bg-rose-50"
                  borderClass="border-rose-200"
                  icon={Heart}
                  outOfRangeCheck={(key, val) => {
                    if (key === "BP") return val < 90 || val > 140;
                    if (key === "Diastolic") return val < 60 || val > 90;
                    return false;
                  }}
                />
                <VitalGraph
                  title="Pulse Rate"
                  data={vitalsHistory}
                  dataKey="Pulse"
                  unit="beats/min"
                  color="#EA580C"
                  bgClass="bg-orange-50"
                  borderClass="border-orange-200"
                  icon={Activity}
                  outOfRangeCheck={(_key, val) => val < 60 || val > 100}
                />
                <VitalGraph
                  title="SpO₂"
                  data={vitalsHistory}
                  dataKey="SpO2"
                  unit="%"
                  color="#2563EB"
                  bgClass="bg-blue-50"
                  borderClass="border-blue-200"
                  icon={Wind}
                  outOfRangeCheck={(_key, val) => val < 94}
                />
                <VitalGraph
                  title="Temperature"
                  data={vitalsHistory}
                  dataKey="Temp"
                  unit="°C"
                  color="#CA8A04"
                  bgClass="bg-yellow-50"
                  borderClass="border-yellow-200"
                  icon={Thermometer}
                  outOfRangeCheck={(_key, val) => val < 36.0 || val > 37.5}
                />
                <VitalGraph
                  title="Blood Glucose (RBS)"
                  data={vitalsHistory}
                  dataKey="RBS"
                  unit="mmol/L"
                  color="#9333EA"
                  bgClass="bg-purple-50"
                  borderClass="border-purple-200"
                  icon={Activity}
                  outOfRangeCheck={(_key, val) => val < 4 || val > 11}
                />
                <VitalGraph
                  title="Weight"
                  data={vitalsHistory}
                  dataKey="Weight"
                  unit="kg"
                  color="#16A34A"
                  bgClass="bg-green-50"
                  borderClass="border-green-200"
                  icon={User}
                />
                <VitalGraph
                  title="Height"
                  data={vitalsHistory}
                  dataKey="Height"
                  unit="cm"
                  color="#0891B2"
                  bgClass="bg-cyan-50"
                  borderClass="border-cyan-200"
                  icon={User}
                />
                <VitalGraph
                  title="Respiratory Rate"
                  data={vitalsHistory}
                  dataKey="RespRate"
                  unit="breaths/min"
                  color="#0891b2"
                  bgClass="bg-cyan-50"
                  borderClass="border-cyan-200"
                  icon={Wind}
                />
                <VitalGraph
                  title="BMI Trend"
                  data={vitalsHistory}
                  dataKey="BMI"
                  unit="kg/m²"
                  color="#6366f1"
                  bgClass="bg-indigo-50"
                  borderClass="border-indigo-200"
                  icon={Activity}
                />
              </div>
            </TabsContent>

            {/* ── INVESTIGATIONS ── */}
            <TabsContent value="investigations" className="space-y-4">
              {/* Tracking panel at the top */}
              <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-5">
                <InvestigationTracker
                  patientId={String(patientId)}
                  patientPhone={patient.phone}
                  viewerRole={viewerRole}
                  currentRole={currentRole}
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" />{" "}
                    Investigation Reports
                  </h3>
                  <div className="relative w-52">
                    <Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search test..."
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-ocid="patient_dashboard.search_input"
                    />
                  </div>
                </div>
                {filteredInvRows.length === 0 ? (
                  <div
                    className="text-center py-8"
                    data-ocid="patient_dashboard.investigations.empty_state"
                  >
                    <FlaskConical className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      No investigation reports found
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {[
                            "Investigation",
                            "Result",
                            "Unit",
                            "Date",
                            "Interpretation",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvRows.map((row, i) => (
                          <tr
                            key={`inv-${row.name}-${row.date}-${i}`}
                            className="border-b border-gray-50 hover:bg-gray-50"
                            data-ocid={`patient_dashboard.investigations.row.${i + 1}`}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {Object.keys(invByName).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(invByName)
                    .slice(0, 12)
                    .map(([name, { data, unit }]) => {
                      // Build AI interpretation for latest tracked result of this test
                      const trackedInvs = loadTrackedInvestigations(
                        String(patientId),
                      );
                      const latestTracked = trackedInvs
                        .filter((t) => t.name === name && t.result)
                        .sort(
                          (a, b) =>
                            new Date(b.result!.recordedAt).getTime() -
                            new Date(a.result!.recordedAt).getTime(),
                        )[0];
                      const allReadings = trackedInvs
                        .filter((t) => t.name === name && t.result)
                        .map((t) => ({
                          value: t.result!.value,
                          recordedAt: t.result!.recordedAt,
                        }));
                      // Fallback: use most recent allInvestigations reading
                      const latestRow = allInvestigations
                        .filter(
                          (r) =>
                            r.name === name &&
                            r.result &&
                            !Number.isNaN(Number.parseFloat(r.result)),
                        )
                        .sort((a, b) => b.date.localeCompare(a.date))[0];
                      let aiText = "";
                      if (latestTracked?.result) {
                        aiText = generateAIInterpretation(
                          name,
                          latestTracked.result,
                          allReadings,
                        );
                      } else if (latestRow) {
                        aiText = generateAIInterpretation(
                          name,
                          {
                            value: latestRow.result,
                            unit: latestRow.unit ?? unit,
                            referenceRange: "",
                            interpretation: (latestRow.interpretation ??
                              "Normal") as InterpretationLabel,
                            recordedAt: new Date(latestRow.date).toISOString(),
                            recordedBy: "System",
                          },
                          [],
                        );
                      }

                      return (
                        <div
                          key={name}
                          className="bg-white rounded-xl border border-teal-200 shadow-sm p-4"
                        >
                          <h4 className="font-semibold text-teal-800 mb-1 text-sm">
                            {name} Trend
                          </h4>
                          {unit && (
                            <p className="text-xs mb-2">
                              Unit:{" "}
                              <span className="font-bold text-gray-700">
                                {unit}
                              </span>
                            </p>
                          )}
                          {data.length >= 2 ? (
                            <ResponsiveContainer width="100%" height={180}>
                              <LineChart data={data}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#f0f0f0"
                                />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis
                                  tick={{ fontSize: 10 }}
                                  label={
                                    unit
                                      ? {
                                          value: unit,
                                          angle: -90,
                                          position: "insideLeft",
                                          style: {
                                            fontWeight: "bold",
                                            fontSize: 10,
                                          },
                                        }
                                      : undefined
                                  }
                                />
                                <Tooltip
                                  formatter={(v: number) => [
                                    `${v} ${unit}`,
                                    name,
                                  ]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#0d9488"
                                  strokeWidth={2}
                                  dot={{ r: 4 }}
                                  name={name}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="text-center py-6 text-gray-400 text-xs">
                              Need 2+ data points for chart
                            </div>
                          )}
                          {/* AI Interpretation under each graph */}
                          {aiText && (
                            <div
                              className={`mt-3 rounded-lg p-3 border text-xs ${
                                aiText.startsWith("⚠️")
                                  ? "bg-amber-50 border-amber-200 text-amber-800"
                                  : "bg-teal-50 border-teal-200 text-teal-800"
                              }`}
                              data-ocid="patient_dashboard.inv.ai_interpretation"
                            >
                              <p className="font-semibold mb-0.5">
                                🤖 AI Interpretation
                              </p>
                              <p>{aiText}</p>
                              <p className="mt-1 opacity-60 italic">
                                AI Suggested — Review with Doctor
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>

            {/* ── HISTORY ── */}
            <TabsContent value="history" className="space-y-4">
              {/* ── Admission History section — admitted patients, clinical roles only ── */}
              {isAdmittedPatient &&
                currentRole !== "patient" &&
                (() => {
                  const admHxRecords = loadAdmissionHistory(String(patientId));
                  if (admHxRecords.length === 0) return null;
                  return (
                    <AdmissionHistoryInlineSection
                      records={admHxRecords}
                      viewerRole={viewerRole ?? "doctor"}
                      patient={patient}
                    />
                  );
                })()}

              {/* ── Admissions timeline section (admitted patients only) ── */}
              {isAdmittedPatient && (
                <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" /> Admissions
                    </h3>
                  </div>
                  <AdmissionTimeline
                    patientId={String(patientId)}
                    doctorEmail={(() => {
                      try {
                        const session = localStorage.getItem(
                          "medicare_current_doctor",
                        );
                        if (!session) return "default";
                        const registry: Array<{ id: string; email: string }> =
                          JSON.parse(
                            localStorage.getItem("medicare_doctors_registry") ||
                              "[]",
                          );
                        return (
                          registry.find((d) => d.id === session)?.email ??
                          "default"
                        );
                      } catch {
                        return "default";
                      }
                    })()}
                  />
                </div>
              )}

              {/* ── Visit History (outpatient) ── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" /> Visit History
                    {isAdmittedPatient && (
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        (Outpatient)
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-purple-700 border-purple-300 gap-1.5"
                      onClick={downloadVisitHistoryPDF}
                      data-ocid="patient_dashboard.visits.secondary_button"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </Button>
                    {(currentRole === "doctor" || currentRole === "admin") &&
                      permissions.canEditClinical && (
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                          onClick={() => setShowVisitForm(true)}
                          data-ocid="patient_dashboard.visits.open_modal_button"
                        >
                          <Plus className="w-3.5 h-3.5" /> New Visit
                        </Button>
                      )}
                  </div>
                </div>
                {loadingVisits ? (
                  <div
                    className="space-y-2"
                    data-ocid="patient_dashboard.visits.loading_state"
                  >
                    {[1, 2, 3].map((k) => (
                      <Skeleton key={k} className="h-12 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <HistoryTabContent
                    sortedVisits={sortedVisits}
                    currentRole={currentRole}
                    setSelectedVisit={setSelectedVisit}
                    downloadSingleVisitPDF={downloadSingleVisitPDF}
                    openRxForm={openRxForm}
                  />
                )}
              </div>

              {/* ── History Features: Problem List, Complaint Trend, Compare Visits, Vaccinations ── */}
              <HistoryFeaturesPanel
                visits={sortedVisits}
                patient={patient}
                isDoctor={currentRole === "doctor" || currentRole === "admin"}
              />
            </TabsContent>

            {/* ── TIMELINE ── */}
            <TabsContent value="timeline" className="space-y-4">
              <PatientTimeline patientId={patientId} patient={patient} />
            </TabsContent>

            {/* ── PRESCRIPTIONS ── */}
            <TabsContent value="prescriptions">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />{" "}
                    Prescriptions ({prescriptions.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-indigo-700 border-indigo-300 gap-1.5"
                      onClick={downloadPrescriptionsPDF}
                      data-ocid="patient_dashboard.prescriptions.secondary_button"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </Button>
                    {(currentRole === "doctor" || currentRole === "admin") &&
                      permissions.canPrescribe && (
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                          onClick={() => openRxForm()}
                          data-ocid="patient_dashboard.prescriptions.open_modal_button"
                        >
                          <Plus className="w-3.5 h-3.5" /> New Rx
                        </Button>
                      )}
                  </div>
                </div>
                {loadingRx ? (
                  <div
                    className="space-y-3"
                    data-ocid="patient_dashboard.prescriptions.loading_state"
                  >
                    {[1, 2, 3].map((k) => (
                      <Skeleton key={k} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : prescriptions.length === 0 ? (
                  <div
                    className="text-center py-8"
                    data-ocid="patient_dashboard.prescriptions.empty_state"
                  >
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      No prescriptions yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Current Medication List */}
                    <CurrentMedicationList prescriptions={prescriptions} />

                    {[...prescriptions]
                      .sort((a, b) =>
                        Number(b.prescriptionDate - a.prescriptionDate),
                      )
                      .map((rx, idx, arr) => {
                        const prev = arr[idx + 1];
                        const rxExt = rx as Prescription & {
                          viewedByPatientAt?: number;
                        };
                        return (
                          <div key={rx.id.toString()}>
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
                            <div
                              className={`bg-card border rounded-xl p-3 hover:shadow-sm transition-all ${
                                (
                                  rx as Prescription & {
                                    prescriptionType?: string;
                                  }
                                ).prescriptionType === "emergency"
                                  ? "border-l-4 border-l-red-500 border-red-200"
                                  : "border-border"
                              }`}
                              data-ocid={`patient_dashboard.prescriptions.item.${idx + 1}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(
                                      rx as Prescription & {
                                        prescriptionType?: string;
                                      }
                                    ).prescriptionType === "emergency" && (
                                      <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none">
                                        🚨 EMERGENCY
                                      </span>
                                    )}
                                    <p className="text-sm font-medium truncate">
                                      {rx.diagnosis ?? "Prescription"}
                                    </p>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(rx.prescriptionDate)}
                                    <span className="ml-2">
                                      {rx.medications.length} med
                                      {rx.medications.length !== 1 ? "s" : ""}
                                    </span>
                                  </p>
                                </div>
                                {(currentRole === "doctor" ||
                                  currentRole === "admin") && (
                                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                    {permissions.canEditClinical && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs gap-1 border-amber-300 text-amber-700"
                                        onClick={() => setEditRx(rx)}
                                        data-ocid={`patient_dashboard.prescriptions.edit_button.${idx + 1}`}
                                      >
                                        <Pencil className="w-3 h-3" />
                                        Edit
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs gap-1 border-blue-300 text-blue-700"
                                      onClick={() => setSelectedRx(rx)}
                                      data-ocid={`patient_dashboard.prescriptions.secondary_button.${idx + 1}`}
                                    >
                                      <FileText className="w-3 h-3" />
                                      View
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs gap-1 border-green-300 text-green-700"
                                      onClick={() => {
                                        setPadPrescription(rx);
                                        setShowPadPreview(true);
                                        loadSavedPads();
                                      }}
                                      data-ocid={`patient_dashboard.prescriptions.open_modal_button.${idx + 1}`}
                                    >
                                      <Printer className="w-3 h-3" />
                                      Pad
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs gap-1 border-purple-300 text-purple-700"
                                      onClick={() =>
                                        downloadSinglePrescriptionPDF(rx)
                                      }
                                      data-ocid={`patient_dashboard.prescriptions.button.${idx + 1}`}
                                    >
                                      <Download className="w-3 h-3" />
                                      PDF
                                    </Button>
                                  </div>
                                )}
                                {(currentRole === "patient" ||
                                  currentRole === "staff") && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs gap-1 border-blue-300 text-blue-700"
                                      onClick={() => setSelectedRx(rx)}
                                      data-ocid={`patient_dashboard.prescriptions.secondary_button.${idx + 1}`}
                                    >
                                      <FileText className="w-3 h-3" />
                                      View
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs gap-1 border-purple-300 text-purple-700"
                                      onClick={() =>
                                        downloadSinglePrescriptionPDF(rx)
                                      }
                                      data-ocid={`patient_dashboard.prescriptions.button.${idx + 1}`}
                                    >
                                      <Download className="w-3 h-3" />
                                      PDF
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {/* Doctor's view: show viewed-by-patient timestamp */}
                              {(currentRole === "doctor" ||
                                currentRole === "admin") && (
                                <ViewedByPatientBadge
                                  viewedAt={rxExt.viewedByPatientAt}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Saved Prescription Pads */}
              {savedPads.length > 0 && (
                <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5 mt-3">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-green-600" /> Saved
                    Prescription Pads
                  </h3>
                  <div className="space-y-2">
                    {savedPads.map((pad, idx) => (
                      <div
                        key={String(pad.id ?? `pad-${idx}`)}
                        className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 border border-green-100"
                        data-ocid={`patient_dashboard.prescriptions.item.${idx + 1}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            {String(pad.diagnosis || "Prescription Pad")}
                          </p>
                          <p className="text-xs text-green-600">
                            {String(pad.date || "")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-green-300 text-green-700 hover:bg-green-50 h-7 text-xs"
                          onClick={() => {
                            const win = window.open(
                              "",
                              "_blank",
                              "width=900,height=1100",
                            );
                            if (win) {
                              const meds = Array.isArray(pad.medications)
                                ? pad.medications
                                : [];
                              win.document.write(
                                `<!DOCTYPE html><html><head><title>Prescription Pad</title><style>body{font-family:Arial,sans-serif;padding:20px}</style></head><body><h2>Prescription — ${String(pad.patientName || "")}</h2><p>Date: ${String(pad.date || "")}</p><p>Diagnosis: ${String(pad.diagnosis || "N/A")}</p><h3>Medications:</h3><ul>${meds.map((m: Record<string, unknown>) => `<li><strong>${String(m.name || "")}</strong> — ${String(m.dose || "")} ${String(m.frequency || "")} ${String(m.duration || "")}</li>`).join("")}</ul></body></html>`,
                              );
                              win.document.close();
                              win.print();
                            }
                          }}
                          data-ocid={`patient_dashboard.prescriptions.secondary_button.${idx + 1}`}
                        >
                          <Download className="w-3 h-3" />
                          Print
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed Dose Report — visible to doctor, admin, medical_officer */}
              {(currentRole === "doctor" ||
                currentRole === "admin" ||
                viewerRole === "medical_officer" ||
                viewerRole === "consultant_doctor") &&
                patient.isAdmitted && (
                  <div className="mt-4">
                    <MissedDoseReport
                      patientId={patientId.toString()}
                      patientName={patient.fullName}
                      admissionDate={
                        patient.admittedOn || patient.admissionDate
                      }
                    />
                  </div>
                )}
            </TabsContent>

            {/* ── APPOINTMENTS ── */}
            <TabsContent value="appointments">
              <AppointmentsTab
                patientId={patientId}
                currentRole={currentRole}
                patientName={patient.fullName}
              />
            </TabsContent>

            {/* ── PENDING APPROVALS ── */}
            <TabsContent value="pending">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" /> Pending
                  Approvals
                  {pendingCount > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                      {pendingCount} pending
                    </Badge>
                  )}
                </h3>
                {patientSubmissions.length === 0 ? (
                  <div
                    className="text-center py-8"
                    data-ocid="patient_dashboard.pending.empty_state"
                  >
                    <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      No patient submissions yet
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {[
                            "Date / Time",
                            "Type",
                            "Submitted Data",
                            "Status",
                            "Actions",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {patientSubmissions.map((sub, idx) => (
                          <tr
                            key={sub.id}
                            className="border-b border-gray-50"
                            data-ocid={`patient_dashboard.pending.item.${idx + 1}`}
                          >
                            <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                              {format(new Date(sub.timestamp), "MMM d, HH:mm")}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                className={`text-xs border-0 ${sub.type === "vitals" ? "bg-rose-100 text-rose-700" : sub.type === "investigation" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                              >
                                {sub.type}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 max-w-[250px]">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(sub.data)
                                  .filter(([, v]) => v)
                                  .slice(0, 3)
                                  .map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="text-xs bg-gray-100 rounded px-1.5 py-0.5"
                                    >
                                      {k}: {v}
                                    </span>
                                  ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                className={`text-xs border-0 ${sub.status === "pending" ? "bg-amber-100 text-amber-700" : sub.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                              >
                                {sub.status === "pending"
                                  ? "✓ Submitted — Pending Review"
                                  : sub.status === "approved"
                                    ? "Approved"
                                    : "Rejected"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              {sub.status === "pending" &&
                                (currentRole === "doctor" ||
                                  currentRole === "admin") && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-emerald-700 border-emerald-300 gap-1 h-7 px-2 text-xs"
                                      onClick={() => approveSubmission(sub.id)}
                                      data-ocid="patient_dashboard.confirm_button"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-700 border-red-300 gap-1 h-7 px-2 text-xs"
                                      onClick={() => rejectSubmission(sub.id)}
                                      data-ocid="patient_dashboard.cancel_button"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Reject
                                    </Button>
                                  </div>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── COMPLAINTS ── */}
            <TabsContent value="complaints" className="space-y-4">
              {currentRole === "patient" && (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border-2 border-pink-300 shadow-sm p-5">
                  <h3 className="font-semibold text-pink-800 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Submit a Complaint
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      "Fever",
                      "Headache",
                      "Chest Pain",
                      "Cough",
                      "Nausea",
                      "Vomiting",
                      "Dizziness",
                      "Pain",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setNewComplaintText((prev) =>
                            prev ? `${prev}, ${chip}` : chip,
                          )
                        }
                        className="text-xs bg-pink-100 hover:bg-pink-200 border border-pink-300 text-pink-700 px-2.5 py-1 rounded-full font-medium transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Describe your symptoms or concerns..."
                    value={newComplaintText}
                    onChange={(e) => setNewComplaintText(e.target.value)}
                    rows={3}
                    className="mb-3 border-pink-200"
                    data-ocid="patient_dashboard.complaints.textarea"
                  />
                  <Button
                    onClick={() => {
                      if (!newComplaintText.trim()) return;
                      const entry: ComplaintEntry = {
                        id:
                          Date.now().toString(36) +
                          Math.random().toString(36).slice(2),
                        patientId: String(patientId),
                        text: newComplaintText.trim(),
                        timestamp: new Date().toISOString(),
                        status: "pending",
                      };
                      const updated = [entry, ...complaints];
                      setComplaints(updated);
                      saveComplaints(String(patientId), updated);
                      setNewComplaintText("");
                      toast.success("Complaint submitted");
                    }}
                    className="bg-pink-600 hover:bg-pink-700 w-full"
                    data-ocid="patient_dashboard.complaints.submit_button"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" /> Submit Complaint
                  </Button>
                </div>
              )}

              <div className="bg-white rounded-xl border border-pink-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-pink-600" /> Complaints Log
                  {complaints.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-gray-400">
                      {complaints.length} entries
                    </span>
                  )}
                </h3>
                {complaints.length === 0 ? (
                  <p
                    className="text-sm text-gray-400 text-center py-4"
                    data-ocid="patient_dashboard.complaints.empty_state"
                  >
                    No complaints submitted yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {complaints.map((c, idx) => (
                      <div
                        key={c.id}
                        className="border border-gray-200 rounded-xl p-4 space-y-2"
                        data-ocid={`patient_dashboard.complaints.item.${idx + 1}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">
                              {c.text}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {format(
                                new Date(c.timestamp),
                                "MMM d, yyyy 'at' h:mm a",
                              )}
                            </p>
                          </div>
                          <Badge
                            className={
                              c.status === "seen"
                                ? "bg-green-100 text-green-700 border-0 shrink-0"
                                : "bg-amber-100 text-amber-700 border-0 shrink-0"
                            }
                          >
                            {c.status === "seen" ? "Seen" : "Pending"}
                          </Badge>
                        </div>
                        {c.doctorNote && (
                          <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-800">
                            <span className="font-semibold">
                              Doctor's note:
                            </span>{" "}
                            {c.doctorNote}
                          </div>
                        )}
                        {(currentRole === "doctor" ||
                          currentRole === "admin") && (
                          <div className="pt-2 border-t border-gray-100 space-y-2">
                            <Input
                              placeholder="Add a note for the patient (optional)..."
                              defaultValue={c.doctorNote || ""}
                              onBlur={(e) => {
                                const note = e.target.value.trim();
                                if (note !== (c.doctorNote || "")) {
                                  const updated = complaints.map((x) =>
                                    x.id === c.id
                                      ? { ...x, doctorNote: note }
                                      : x,
                                  );
                                  setComplaints(updated);
                                  saveComplaints(String(patientId), updated);
                                }
                              }}
                              className="text-sm"
                              data-ocid="patient_dashboard.complaints.input"
                            />
                            {c.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => {
                                  const updated = complaints.map((x) =>
                                    x.id === c.id
                                      ? { ...x, status: "seen" as const }
                                      : x,
                                  );
                                  setComplaints(updated);
                                  saveComplaints(String(patientId), updated);
                                  toast.success("Marked as seen");
                                }}
                                data-ocid="patient_dashboard.complaints.confirm_button"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />{" "}
                                Mark as Seen
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── ADVICE ── */}
            <TabsContent value="advice" className="space-y-4">
              {(currentRole === "doctor" || currentRole === "admin") && (
                <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5">
                  <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Add Advice
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Date</Label>
                      <input
                        type="date"
                        value={newAdviceDate}
                        onChange={(e) => setNewAdviceDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        data-ocid="patient_dashboard.advice.input"
                      />
                    </div>
                    <Textarea
                      placeholder="Enter advice or instructions..."
                      value={newAdviceText}
                      onChange={(e) => setNewAdviceText(e.target.value)}
                      rows={3}
                      data-ocid="patient_dashboard.advice.textarea"
                    />
                    <Button
                      onClick={() => {
                        if (!newAdviceText.trim()) return;
                        const entry: AdviceEntry = {
                          id:
                            Date.now().toString(36) +
                            Math.random().toString(36).slice(2),
                          patientId: String(patientId),
                          text: newAdviceText.trim(),
                          date: newAdviceDate || new Date().toISOString(),
                          addedBy: currentRole,
                          source: "Doctor's Note",
                        };
                        const updated = [entry, ...adviceEntries];
                        setAdviceEntries(updated);
                        saveAdviceEntries(String(patientId), updated);
                        setNewAdviceText("");
                        toast.success("Advice added");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-ocid="patient_dashboard.advice.submit_button"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Advice
                    </Button>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-emerald-600" /> Advice &
                  Instructions
                </h3>
                {adviceEntries.length === 0 ? (
                  <p
                    className="text-sm text-gray-400 text-center py-6"
                    data-ocid="patient_dashboard.advice.empty_state"
                  >
                    No advice or instructions recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {adviceEntries.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="border border-emerald-100 rounded-xl p-4 bg-emerald-50"
                        data-ocid={`patient_dashboard.advice.item.${idx + 1}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-200 px-2 py-0.5 rounded-full">
                              {entry.source}
                            </span>
                            <span className="text-xs text-gray-400">
                              {entry.date
                                ? format(new Date(entry.date), "MMM d, yyyy")
                                : "—"}
                            </span>
                          </div>
                          {(currentRole === "doctor" ||
                            currentRole === "admin") && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = adviceEntries.filter(
                                  (e) => e.id !== entry.id,
                                );
                                setAdviceEntries(updated);
                                saveAdviceEntries(String(patientId), updated);
                              }}
                              className="text-red-400 hover:text-red-600"
                              data-ocid="patient_dashboard.advice.delete_button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {entry.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── CHAT ── */}
            <TabsContent value="chat">
              <PatientChat
                patientId={patientId}
                currentRole={currentRole}
                currentUserName={
                  currentRole === "patient" ? patient.fullName : "Doctor"
                }
              />
            </TabsContent>

            {/* ── ACCOUNT SETTINGS ── */}
            <TabsContent value="account">
              <AccountSettingsTab
                patientId={patientId}
                registerNo={registerNo}
                currentRole={currentRole}
                patientAccount={patientAccount}
                linkedAccount={linkedAccount}
                reminders={reminders}
                prescriptionDrugChips={prescriptionDrugChips}
                onSaveReminders={saveReminders}
              />
            </TabsContent>

            {/* ── DAILY PROGRESS NOTE (admitted patients — clinical roles) ── */}
            <TabsContent value="daily_progress">
              {canViewDailyProgress ? (
                <DailyProgressNote
                  patientId={String(patientId)}
                  doctorEmail={(() => {
                    try {
                      const session = localStorage.getItem(
                        "medicare_current_doctor",
                      );
                      if (!session) return "default";
                      const registry: Array<{ id: string; email: string }> =
                        JSON.parse(
                          localStorage.getItem("medicare_doctors_registry") ||
                            "[]",
                        );
                      return (
                        registry.find((d) => d.id === session)?.email ??
                        "default"
                      );
                    } catch {
                      return "default";
                    }
                  })()}
                  authorName={(() => {
                    try {
                      const session = localStorage.getItem(
                        "medicare_current_doctor",
                      );
                      if (!session)
                        return currentRole === "patient"
                          ? patient.fullName
                          : "Unknown";
                      const registry: Array<{ id: string; name: string }> =
                        JSON.parse(
                          localStorage.getItem("medicare_doctors_registry") ||
                            "[]",
                        );
                      return (
                        registry.find((d) => d.id === session)?.name ??
                        "Unknown"
                      );
                    } catch {
                      return "Unknown";
                    }
                  })()}
                  viewerRole={viewerRole ?? "doctor"}
                  latestVitals={latestVitals}
                  patientWeightKg={patient.weight}
                  prescriptions={prescriptions}
                  latestVisit={latestVisit}
                />
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-indigo-100">
                  <p className="text-sm text-gray-400">
                    Daily Progress Note is only available for admitted patients.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── SOAP NOTES (classic daily progress) ── */}
            <TabsContent value="soap_notes">
              <DailyProgress
                patientId={patientId}
                doctorEmail={(() => {
                  try {
                    const session = localStorage.getItem(
                      "medicare_current_doctor",
                    );
                    if (!session) return "default";
                    const registry: Array<{ id: string; email: string }> =
                      JSON.parse(
                        localStorage.getItem("medicare_doctors_registry") ||
                          "[]",
                      );
                    const doc = registry.find((d) => d.id === session);
                    return doc?.email ?? "default";
                  } catch {
                    return "default";
                  }
                })()}
                currentRole={currentRole}
                viewerRole={viewerRole ?? "doctor"}
                authorName={(() => {
                  try {
                    const session = localStorage.getItem(
                      "medicare_current_doctor",
                    );
                    if (!session)
                      return currentRole === "patient"
                        ? patient.fullName
                        : "Unknown";
                    const registry: Array<{ id: string; name: string }> =
                      JSON.parse(
                        localStorage.getItem("medicare_doctors_registry") ||
                          "[]",
                      );
                    const doc = registry.find((d) => d.id === session);
                    return doc?.name ?? "Unknown";
                  } catch {
                    return "Unknown";
                  }
                })()}
                prescriptions={prescriptions}
              />
            </TabsContent>

            {/* ── DISCHARGE SUMMARY (admitted patients only) ── */}
            <TabsContent value="discharge">
              {isAdmittedPatient ? (
                <DischargeSummaryTab
                  patient={patient}
                  visits={sortedVisits}
                  prescriptions={prescriptions}
                  encounters={encounters}
                  clinicalNotes={clinicalNotes}
                  canApproveDischarge={canApproveDischarge}
                />
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-rose-100">
                  <p className="text-sm text-gray-400">
                    Discharge Summary is only available for admitted patients.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── HANDOVER SYSTEM ── */}
            <TabsContent value="handover">
              <HandoverSystem
                patientId={String(patientId)}
                patientName={patient.fullName}
                bed={
                  ((patient as Record<string, unknown>).bedNumber as string) ??
                  ""
                }
                ward={
                  ((patient as Record<string, unknown>).ward as string) ?? ""
                }
                viewerRole={viewerRole ?? "doctor"}
                authorName={(() => {
                  try {
                    const session = localStorage.getItem(
                      "medicare_current_doctor",
                    );
                    if (!session)
                      return currentRole === "patient"
                        ? patient.fullName
                        : "Unknown";
                    const registry: Array<{ id: string; name: string }> =
                      JSON.parse(
                        localStorage.getItem("medicare_doctors_registry") ||
                          "[]",
                      );
                    return (
                      registry.find((d) => d.id === session)?.name ?? "Unknown"
                    );
                  } catch {
                    return "Unknown";
                  }
                })()}
                currentUser={{
                  name: (() => {
                    try {
                      const session = localStorage.getItem(
                        "medicare_current_doctor",
                      );
                      if (!session)
                        return currentRole === "patient"
                          ? patient.fullName
                          : "Unknown";
                      const registry: Array<{ id: string; name: string }> =
                        JSON.parse(
                          localStorage.getItem("medicare_doctors_registry") ||
                            "[]",
                        );
                      return (
                        registry.find((d) => d.id === session)?.name ??
                        "Unknown"
                      );
                    } catch {
                      return "Unknown";
                    }
                  })(),
                  role: viewerRole ?? "doctor",
                  email: (() => {
                    try {
                      const session = localStorage.getItem(
                        "medicare_current_doctor",
                      );
                      if (!session) return "";
                      const registry: Array<{ id: string; email?: string }> =
                        JSON.parse(
                          localStorage.getItem("medicare_doctors_registry") ||
                            "[]",
                        );
                      return (
                        (
                          registry.find((d) => d.id === session) as {
                            email?: string;
                          }
                        )?.email ?? session
                      );
                    } catch {
                      return "";
                    }
                  })(),
                }}
                admissionDate={
                  ((patient as Record<string, unknown>)
                    .admissionDate as string) ?? ""
                }
                bedNumber={
                  ((patient as Record<string, unknown>).bedNumber as string) ??
                  ""
                }
                department={
                  ((patient as Record<string, unknown>).department as string) ??
                  ""
                }
                primaryDiagnosis={
                  prescriptions.find((rx) => rx.diagnosis)?.diagnosis ?? ""
                }
                secondaryDiagnoses={[]}
                comorbidities={[]}
                assignedConsultant={
                  ((patient as Record<string, unknown>)
                    .assignedConsultantName as string) ?? ""
                }
                latestVitals={latestVitals}
                activeMedications={prescriptions
                  .flatMap((rx) =>
                    (rx.medications ?? []).map((m) => ({
                      drugName: [m.drugForm || "", m.drugName || m.name || ""]
                        .filter(Boolean)
                        .join(" ")
                        .trim(),
                      dose: m.dose ?? "",
                      frequency: m.frequency ?? "",
                    })),
                  )
                  .slice(0, 20)}
                activeDiagnoses={prescriptions
                  .map((rx) => rx.diagnosis)
                  .filter((d): d is string => !!d)
                  .slice(0, 5)}
                latestPlan=""
              />
            </TabsContent>

            {/* ── INVESTIGATION PAYMENT ── */}
            <TabsContent value="inv_payment" className="space-y-4">
              <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-700 text-base">🧾</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Investigation Payment
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Bill investigations, apply discount, generate receipt
                    </p>
                  </div>
                </div>
                <InvestigationPayment
                  patientId={String(patientId)}
                  patientName={patient.fullName}
                  registerNumber={
                    ((patient as Record<string, unknown>)
                      .registerNumber as string) ?? ""
                  }
                  phone={patient.phone ?? ""}
                  doctorName={doctorName}
                />
              </div>
            </TabsContent>

            {/* ── PROCEDURES ── */}
            <TabsContent value="procedures">
              <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                <ProcedureLog patientId={String(patientId)} patient={patient} />
              </div>
            </TabsContent>

            {/* ── REFERRALS ── */}
            <TabsContent value="referrals">
              <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                <ReferralLetter
                  patientId={String(patientId)}
                  patient={patient}
                  lastVisit={latestVisit}
                  onClose={() => {}}
                />
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* ── Referral Letter Modal (from Overview "Refer Patient" button) ── */}
      {showReferralModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
          data-ocid="referral.dialog"
        >
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl my-8 p-5">
            <ReferralLetter
              patientId={String(patientId)}
              patient={patient}
              lastVisit={latestVisit}
              onClose={() => setShowReferralModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
