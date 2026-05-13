/**
 * ClinicalAlertsPanel — Real-time patient clinical alerts for dashboards.
 * Runs checkExtendedClinicalAlerts + NEWS2 scoring.
 * Renders dismissible alert cards per patient with severity colours.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  calculateNEWS2,
  checkExtendedClinicalAlerts,
} from "../lib/clinicalIntelligence";
import type {
  ExtendedAlert,
  ExtendedAlertInput,
  Patient,
  VitalSigns,
} from "../types";

// ── NEWS2 risk band colours ───────────────────────────────────────────────────

const NEWS2_COLORS = {
  low: "bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800",
  medium: "bg-amber-50 border-l-4 border-amber-500 text-amber-800",
  high: "bg-red-50 border-l-4 border-red-600 text-red-800",
} as const;

const SEVERITY_STYLES = {
  critical: {
    banner: "bg-red-600 text-white w-full py-3 px-4 rounded-lg font-semibold",
    card: "bg-red-50/80 border-red-300",
    icon: "text-white",
    badge: "bg-white/20 text-white border border-white/40",
    label: "Critical",
  },
  warning: {
    banner:
      "bg-orange-500 text-white w-full py-3 px-4 rounded-lg font-semibold",
    card: "bg-amber-50/80 border-amber-300",
    icon: "text-white",
    badge: "bg-white/20 text-white border border-white/40",
    label: "Warning",
  },
  info: {
    banner:
      "bg-yellow-400 text-yellow-900 w-full py-3 px-4 rounded-lg font-semibold",
    card: "bg-blue-50/80 border-blue-200",
    icon: "text-white",
    badge: "bg-white/20 border border-yellow-600/40",
    label: "Info",
  },
} as const;

// ── Audit log helper ──────────────────────────────────────────────────────────

function appendAudit(patientId: string, alertId: string, message: string) {
  try {
    const key = `auditLog_${patientId}`;
    const arr = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    arr.push({
      alertId,
      message,
      timestamp: new Date().toISOString(),
      action: "acknowledged",
    });
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

// ── Build ExtendedAlertInput from VitalSigns ─────────────────────────────────

function vitalSignsToInput(vitals: VitalSigns): ExtendedAlertInput["vitals"] {
  const parseNum = (v?: string) => (v ? Number.parseFloat(v) : undefined);
  const bp = vitals.bloodPressure?.split("/").map(Number);
  return {
    systolicBP: bp?.[0],
    diastolicBP: bp?.[1],
    heartRate: parseNum(vitals.pulse),
    temperature: parseNum(vitals.temperature),
    respiratoryRate: parseNum(vitals.respiratoryRate),
    spo2: parseNum(vitals.oxygenSaturation),
  };
}

// ── Patient alert row ─────────────────────────────────────────────────────────

interface PatientAlertGroup {
  patient: Patient;
  alerts: ExtendedAlert[];
  news2: ReturnType<typeof calculateNEWS2> | null;
}

interface DismissedSet {
  [alertId: string]: boolean;
}

function loadDismissed(): DismissedSet {
  try {
    return JSON.parse(
      localStorage.getItem("clinicalAlerts_dismissed") ?? "{}",
    ) as DismissedSet;
  } catch {
    return {};
  }
}
function saveDismissed(d: DismissedSet) {
  try {
    localStorage.setItem("clinicalAlerts_dismissed", JSON.stringify(d));
  } catch {}
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  patients: Patient[];
  vitalsData: Record<string, VitalSigns[]>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClinicalAlertsPanel({ patients, vitalsData }: Props) {
  const [dismissed, setDismissed] = useState<DismissedSet>(loadDismissed);
  const [expanded, setExpanded] = useState(true);
  const [collapsedAlerts, setCollapsedAlerts] = useState<
    Record<string, boolean>
  >({});
  const prevCriticalIds = useRef<Set<string>>(new Set());

  // Build alert groups
  const alertGroups: PatientAlertGroup[] = patients
    .map((p) => {
      const pidStr = String(p.id);
      const vitalHistory = vitalsData[pidStr] ?? [];
      const latest = vitalHistory[vitalHistory.length - 1];
      const input: ExtendedAlertInput = latest
        ? { vitals: vitalSignsToInput(latest) }
        : {};
      const alerts = checkExtendedClinicalAlerts(input).filter(
        (a) => !dismissed[a.id],
      );
      const news2 = latest ? calculateNEWS2(latest) : null;
      return { patient: p, alerts, news2 };
    })
    .filter((g) => g.alerts.length > 0 || (g.news2 && g.news2.score >= 5));

  const totalCritical = alertGroups.reduce(
    (acc, g) => acc + g.alerts.filter((a) => a.severity === "critical").length,
    0,
  );

  // Fire toast for new critical alerts
  useEffect(() => {
    for (const g of alertGroups) {
      for (const alert of g.alerts) {
        if (alert.severity !== "critical") continue;
        if (!prevCriticalIds.current.has(alert.id)) {
          prevCriticalIds.current.add(alert.id);
          toast.error(`🚨 ${g.patient.fullName}: ${alert.message}`, {
            duration: 8000,
            id: alert.id,
          });
        }
      }
    }
  }, [alertGroups]);

  function toggleAlertCollapse(alertId: string) {
    setCollapsedAlerts((prev) => ({ ...prev, [alertId]: !prev[alertId] }));
  }

  function dismiss(alertId: string, patientId: string, message: string) {
    const next = { ...dismissed, [alertId]: true };
    setDismissed(next);
    saveDismissed(next);
    appendAudit(patientId, alertId, message);
    toast.success("Alert acknowledged");
  }

  if (alertGroups.length === 0) {
    return (
      <div
        className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3"
        data-ocid="clinical_alerts.empty_state"
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-800 font-medium">
          No active clinical alerts for admitted patients
        </p>
      </div>
    );
  }

  return (
    <div
      className="border border-border rounded-xl overflow-hidden"
      data-ocid="clinical_alerts.panel"
    >
      {/* Panel header */}
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border-b border-red-200 hover:bg-red-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        data-ocid="clinical_alerts.toggle"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-red-600" />
          <span className="font-semibold text-red-800 text-sm">
            Clinical Alerts
          </span>
          {totalCritical > 0 && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold"
              data-ocid="clinical_alerts.badge"
            >
              {totalCritical}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-red-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-500" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4 bg-background">
          {alertGroups.map((group) => (
            <div
              key={String(group.patient.id)}
              data-ocid={`clinical_alerts.patient_group.${String(group.patient.id)}`}
            >
              {/* Patient name row + NEWS2 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">
                    {group.patient.fullName.charAt(0)}
                  </span>
                </div>
                <span className="font-semibold text-sm text-foreground">
                  {group.patient.fullName}
                </span>
                {group.news2 && (
                  <NEWS2Badge
                    score={group.news2.score}
                    risk={group.news2.risk}
                  />
                )}
              </div>

              {/* Individual alerts — full-width banner treatment */}
              <div className="space-y-2 pl-9">
                {group.alerts.map((alert, i) => {
                  const s =
                    SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
                  const Icon =
                    alert.severity === "critical" ? XCircle : AlertTriangle;
                  const isCollapsed = collapsedAlerts[alert.id];
                  return (
                    <div
                      key={alert.id}
                      className={cn("rounded-xl overflow-hidden", s.banner)}
                      data-ocid={`clinical_alerts.alert.${String(group.patient.id)}.${i + 1}`}
                    >
                      {/* Banner header row */}
                      <div className="flex items-center gap-3">
                        <Icon className={cn("w-4 h-4 shrink-0", s.icon)} />
                        <p className="font-semibold text-sm flex-1">
                          {alert.message}
                        </p>
                        <button
                          type="button"
                          className="opacity-70 hover:opacity-100 transition-opacity p-0.5"
                          onClick={() => toggleAlertCollapse(alert.id)}
                          aria-label={
                            isCollapsed ? "Expand alert" : "Collapse alert"
                          }
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs shrink-0 hover:bg-white/20 text-inherit"
                          onClick={() =>
                            dismiss(
                              alert.id,
                              String(group.patient.id),
                              alert.message,
                            )
                          }
                          data-ocid={`clinical_alerts.acknowledge.${String(group.patient.id)}.${i + 1}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Ack
                        </Button>
                      </div>
                      {/* Collapsible details */}
                      {!isCollapsed && (
                        <div className="mt-2 pt-2 border-t border-white/20 text-sm space-y-1">
                          <p className="opacity-90">{alert.details}</p>
                          {alert.aiSuggestion && (
                            <p className="italic opacity-80">
                              💡 {alert.aiSuggestion}
                            </p>
                          )}
                          <p className="text-[11px] opacity-60">
                            {new Date(alert.triggeredAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NEWS2 Badge ───────────────────────────────────────────────────────────────

function NEWS2Badge({
  score,
  risk,
}: { score: number; risk: "low" | "medium" | "high" }) {
  const labels = {
    low: "NEWS2 Low",
    medium: "NEWS2 Medium ⚠",
    high: "NEWS2 High 🚨",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-semibold",
        NEWS2_COLORS[risk],
      )}
      title="National Early Warning Score 2"
      data-ocid="clinical_alerts.news2_badge"
    >
      <Activity className="w-3 h-3" />
      {score} — {labels[risk]}
    </div>
  );
}

// ── Export active alerts for external consumers ───────────────────────────────

export function getActiveAlerts(
  patients: Patient[],
  vitalsData: Record<string, VitalSigns[]>,
): ExtendedAlert[] {
  const dismissed = loadDismissed();
  return patients.flatMap((p) => {
    const pidStr = String(p.id);
    const vitalHistory = vitalsData[pidStr] ?? [];
    const latest = vitalHistory[vitalHistory.length - 1];
    if (!latest) return [];
    const input: ExtendedAlertInput = { vitals: vitalSignsToInput(latest) };
    return checkExtendedClinicalAlerts(input).filter((a) => !dismissed[a.id]);
  });
}
