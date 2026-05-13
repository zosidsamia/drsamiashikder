import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  TrendingDown,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ClinicalAlertsPanel from "../../components/ClinicalAlertsPanel";
import {
  type MissedDoseEscalation,
  acknowledgeEscalation,
  loadEscalations,
} from "../../components/NurseDueMeds";
import { useEmailAuth } from "../../hooks/useEmailAuth";
import type { Patient, VitalSigns } from "../../types";

interface LocalPatient extends Patient {
  registerNumber?: string;
  bedNumber?: string;
  ward?: string;
  isAdmitted?: boolean;
}

interface DraftApprovalItem {
  id: string;
  patientName: string;
  patientId: string;
  internName: string;
  diagnosis: string;
  createdAt: string;
}

interface InvestigationResult {
  patientName: string;
  patientId: string;
  testName: string;
  result: string;
  unit?: string;
  isAbnormal?: boolean;
  receivedAt: string;
}

interface OpdQueueItem {
  id: string;
  patientName: string;
  serialNumber?: number;
  preferredTime?: string;
  status: string;
}

function loadAllPatients(): LocalPatient[] {
  const result: LocalPatient[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as LocalPatient[];
      result.push(...arr);
    } catch {}
  }
  return result;
}

function loadVitalsData(
  patients: LocalPatient[],
): Record<string, VitalSigns[]> {
  const result: Record<string, VitalSigns[]> = {};
  for (const p of patients) {
    const pidStr = String(p.id);
    try {
      const raw = localStorage.getItem(`vitals_${pidStr}`);
      if (raw) result[pidStr] = JSON.parse(raw) as VitalSigns[];
    } catch {}
  }
  return result;
}

function getAlertSeverity(
  patient: LocalPatient,
): "critical" | "warning" | "stable" {
  try {
    const alerts: Array<{ severity: string }> = JSON.parse(
      localStorage.getItem(`alerts_${String(patient.id)}`) || "[]",
    );
    if (
      alerts.some((a) => a.severity === "Critical" || a.severity === "critical")
    )
      return "critical";
    if (
      alerts.some((a) => a.severity === "Warning" || a.severity === "warning")
    )
      return "warning";
  } catch {}
  return "stable";
}

function loadPendingDrafts(): DraftApprovalItem[] {
  const results: DraftApprovalItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("prescriptions_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as Array<
        Record<string, unknown>
      >;
      for (const rx of arr) {
        if (
          rx.status === "draft_awaiting_approval" ||
          (rx.isDraft === true && rx.internRole === true)
        ) {
          results.push({
            id: String(rx.id ?? ""),
            patientName: String(rx.patientName ?? "Unknown"),
            patientId: String(rx.patientId ?? ""),
            internName: String(rx.createdByName ?? rx.authorName ?? "Intern"),
            diagnosis: String(rx.diagnosis ?? "—"),
            createdAt: String(rx.createdAt ?? ""),
          });
        }
      }
    } catch {}
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getRecentPrescriptions() {
  const results: Array<{
    id: string;
    patientName: string;
    diagnosis: string;
    createdAt: string;
    status: string;
  }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("prescriptions_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as Array<
        Record<string, unknown>
      >;
      for (const rx of arr) {
        results.push({
          id: String(rx.id ?? ""),
          patientName: String(rx.patientName ?? "Unknown"),
          diagnosis: String(rx.diagnosis ?? "—"),
          createdAt: String(rx.createdAt ?? ""),
          status: String(rx.status ?? "active"),
        });
      }
    } catch {}
  }
  return results
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
}

function loadTodayOpdQueue(): OpdQueueItem[] {
  const today = new Date().toISOString().split("T")[0];
  try {
    const all = JSON.parse(
      localStorage.getItem("medicare_appointments") || "[]",
    ) as Array<Record<string, unknown>>;
    return all
      .filter((a) => {
        const date = String(a.preferredDate ?? a.createdAt ?? "");
        return date.startsWith(today);
      })
      .map((a, idx) => ({
        id: String(a.id ?? idx),
        patientName: String(a.patientName ?? "Unknown"),
        serialNumber: idx + 1,
        preferredTime: String(a.preferredTime ?? ""),
        status: String(a.status ?? "pending"),
      }));
  } catch {
    return [];
  }
}

function loadAdmittedNeedingReview(
  patients: LocalPatient[],
): Array<LocalPatient & { hoursSinceNote: number }> {
  const now = Date.now();
  return patients
    .filter(
      (p) =>
        p.isAdmitted || p.patientType === "admitted" || p.status === "Admitted",
    )
    .map((p) => {
      try {
        const notes = JSON.parse(
          localStorage.getItem(`soapNotes_${String(p.id)}`) || "[]",
        ) as Array<{ createdAt?: string; date?: string }>;
        if (notes.length === 0) return { ...p, hoursSinceNote: 999 };
        const sorted = notes.sort((a, b) => {
          const ta = new Date(a.createdAt ?? a.date ?? 0).getTime();
          const tb = new Date(b.createdAt ?? b.date ?? 0).getTime();
          return tb - ta;
        });
        const lastNoteTime = new Date(
          sorted[0].createdAt ?? sorted[0].date ?? 0,
        ).getTime();
        const hours = Math.floor((now - lastNoteTime) / 3600000);
        return { ...p, hoursSinceNote: hours };
      } catch {
        return { ...p, hoursSinceNote: 999 };
      }
    })
    .filter((p) => p.hoursSinceNote >= 24)
    .sort((a, b) => b.hoursSinceNote - a.hoursSinceNote);
}

function loadNewInvestigationResults(): InvestigationResult[] {
  const lastLogin = Number(localStorage.getItem("medicare_last_login") || "0");
  const results: InvestigationResult[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("investigations_")) continue;
    const patientId = k.replace("investigations_", "");
    try {
      const inv = JSON.parse(localStorage.getItem(k) || "[]") as Array<
        Record<string, unknown>
      >;
      let patientName = "Unknown";
      for (let j = 0; j < localStorage.length; j++) {
        const pk = localStorage.key(j);
        if (!pk?.startsWith("patients_")) continue;
        try {
          const arr = JSON.parse(
            localStorage.getItem(pk) || "[]",
          ) as LocalPatient[];
          const pt = arr.find((p) => String(p.id) === patientId);
          if (pt) {
            patientName = pt.fullName;
            break;
          }
        } catch {}
      }
      for (const item of inv) {
        const status = String(item.status ?? "");
        const receivedAt = String(
          item.receivedAt ?? item.resultDate ?? item.updatedAt ?? "",
        );
        if ((status === "received" || status === "completed") && receivedAt) {
          const recTime = new Date(receivedAt).getTime();
          if (recTime > lastLogin) {
            results.push({
              patientName,
              patientId,
              testName: String(item.testName ?? item.name ?? "Investigation"),
              result: String(item.result ?? item.value ?? "—"),
              unit: String(item.unit ?? ""),
              isAbnormal: Boolean(item.isAbnormal ?? item.flagged ?? false),
              receivedAt,
            });
          }
        }
      }
    } catch {}
  }
  return results
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, 8);
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
}) {
  return (
    <div className="rounded-xl shadow-sm overflow-hidden">
      <div className={`${gradient} p-4 flex items-center justify-between`}>
        <p className="text-3xl font-bold text-white leading-none">{value}</p>
        <Icon className="w-6 h-6 text-white opacity-80" />
      </div>
      <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ActionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function ConsultantDashboard() {
  const { currentDoctor } = useEmailAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const allPatients = useMemo(loadAllPatients, []);
  const admittedPatients = allPatients.filter(
    (p) =>
      p.isAdmitted || p.patientType === "admitted" || p.status === "Admitted",
  );
  const vitalsData = useMemo(
    () => loadVitalsData(admittedPatients),
    [admittedPatients],
  );
  const opdPatients = allPatients.filter(
    (p) =>
      !p.isAdmitted && p.patientType !== "admitted" && p.status !== "Admitted",
  );
  const criticalPatients = admittedPatients.filter(
    (p) => getAlertSeverity(p) === "critical",
  );

  const today = new Date().toISOString().split("T")[0];
  const opdToday = opdPatients.filter((p) => {
    const created = String((p as Record<string, unknown>).createdAt ?? "");
    return created.startsWith(today);
  }).length;

  const [pendingDrafts, setPendingDrafts] = useState<DraftApprovalItem[]>(() =>
    loadPendingDrafts(),
  );
  const [draftsExpanded, setDraftsExpanded] = useState(false);

  const [escalations, setEscalations] = useState<MissedDoseEscalation[]>(() =>
    loadEscalations().filter((e) => !e.acknowledged),
  );

  // Action center state
  const [opdQueue] = useState<OpdQueueItem[]>(() => loadTodayOpdQueue());
  const [reviewNeeded] = useState(() =>
    loadAdmittedNeedingReview(admittedPatients),
  );
  const [newResults] = useState<InvestigationResult[]>(() =>
    loadNewInvestigationResults(),
  );

  const recentRx = useMemo(getRecentPrescriptions, []);
  const pendingRx = recentRx.filter(
    (r) => r.status === "draft_awaiting_approval",
  ).length;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(
      () => setPendingDrafts(loadPendingDrafts()),
      30_000,
    );
    return () => clearInterval(interval);
  }, []);

  function handleAcknowledge(patientId: string, drugName: string) {
    acknowledgeEscalation(patientId, drugName);
    setEscalations((prev) =>
      prev.filter(
        (e) => !(e.patientId === patientId && e.drugName === drugName),
      ),
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div
      className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6"
      data-ocid="consultant.dashboard"
    >
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {currentDoctor?.designation} {currentDoctor?.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Consultant Doctor Dashboard
          </p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs px-3 py-1">
          Consultant
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={BedDouble}
          label="Total Admitted"
          value={admittedPatients.length}
          gradient="bg-gradient-to-r from-blue-600 to-indigo-700"
        />
        <StatCard
          icon={Users}
          label="OPD Seen Today"
          value={opdToday}
          gradient="bg-gradient-to-r from-teal-500 to-green-600"
        />
        <StatCard
          icon={FileText}
          label="Pending Prescriptions"
          value={pendingRx}
          gradient="bg-gradient-to-r from-amber-500 to-orange-600"
        />
        <StatCard
          icon={Bell}
          label="Active Alerts"
          value={criticalPatients.length + escalations.length}
          gradient="bg-gradient-to-r from-rose-500 to-red-600"
        />
      </div>

      {/* Clinical Alerts Engine */}
      <ClinicalAlertsPanel
        patients={admittedPatients as Patient[]}
        vitalsData={vitalsData}
      />

      {/* ── Pending Intern Draft Approvals Panel ── */}
      <Card
        className={`${pendingDrafts.length > 0 ? "border-red-300 bg-red-50/30" : "border-border"}`}
        data-ocid="consultant.pending_approvals.panel"
      >
        <CardHeader className="pb-3 pt-4 px-5">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2"
            onClick={() => {
              setDraftsExpanded((v) => !v);
              if (!draftsExpanded) setPendingDrafts(loadPendingDrafts());
            }}
            data-ocid="consultant.pending_approvals.toggle"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Pending Approvals — Intern Drafts
              </h2>
              {pendingDrafts.length > 0 && (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none"
                  data-ocid="consultant.pending_approvals.badge"
                >
                  {pendingDrafts.length}
                </span>
              )}
            </div>
            {draftsExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </CardHeader>
        {draftsExpanded && (
          <CardContent className="px-5 pb-4">
            {pendingDrafts.length === 0 ? (
              <div
                className="flex items-center gap-2 text-emerald-600 py-2"
                data-ocid="consultant.pending_approvals.empty_state"
              >
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm">All prescriptions approved</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDrafts.map((d, idx) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 bg-card border border-red-200 rounded-xl px-4 py-3"
                    data-ocid={`consultant.pending_approval.item.${idx + 1}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {d.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        By {d.internName} · {d.diagnosis}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {d.createdAt
                          ? new Date(d.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white gap-1"
                        onClick={() =>
                          navigate({
                            to: "/PatientProfile",
                            search: { id: d.patientId },
                          })
                        }
                        data-ocid={`consultant.pending_approval.review.${idx + 1}`}
                      >
                        <Eye className="w-3 h-3" /> Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Critical Alerts */}
      {criticalPatients.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-red-800 text-sm">
                Critical Patients — Immediate Attention Required
              </h2>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {criticalPatients.slice(0, 4).map((p) => (
              <button
                key={String(p.id)}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/PatientProfile",
                    search: { id: String(p.id) },
                  })
                }
                className="w-full flex items-center gap-3 bg-card border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 transition-colors text-left"
                data-ocid={`consultant.critical_patient.${String(p.id)}`}
              >
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <span className="font-bold text-red-700 text-sm">
                    {p.fullName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {p.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bed {p.bedNumber || "—"} · {p.ward || "General"}
                  </p>
                </div>
                <Badge className="bg-red-600 text-white text-[10px] shrink-0">
                  CRITICAL
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Medication Alerts Panel */}
      {escalations.length > 0 && (
        <Card
          className="border-amber-300 bg-amber-50/60"
          data-ocid="consultant.medication_alerts.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-amber-700" />
              <h2 className="font-semibold text-amber-800 text-sm">
                ⚠️ Medication Alerts
              </h2>
              <Badge className="bg-amber-600 text-white text-xs ml-1">
                {escalations.length} unacknowledged
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="text-left py-2 px-3 font-semibold text-amber-800">
                      Patient
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-amber-800">
                      Drug
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-amber-800">
                      Times Missed
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-amber-800">
                      Last Missed At
                    </th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {escalations.map((esc, i) => (
                    <tr
                      key={`${esc.patientId}-${esc.drugName}`}
                      className="border-b border-amber-100 last:border-0"
                      data-ocid={`consultant.medication_alert.${i + 1}`}
                    >
                      <td className="py-2 px-3 font-medium">
                        {esc.patientName}
                      </td>
                      <td className="py-2 px-3">{esc.drugName}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-bold text-red-700">
                          {esc.missedCount}×
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(esc.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-amber-400 text-amber-800 hover:bg-amber-100 gap-1"
                          onClick={() =>
                            handleAcknowledge(esc.patientId, esc.drugName)
                          }
                          data-ocid={`consultant.medication_alert.acknowledge.${i + 1}`}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Acknowledge
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ACTION CENTER ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Today's OPD Queue */}
        <Card
          className="border-l-4 border-l-emerald-500"
          data-ocid="consultant.opd_queue.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Today's OPD Queue
              </h2>
              <Badge className="ml-auto bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                {opdQueue.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <ActionSkeleton />
            ) : opdQueue.length === 0 ? (
              <div
                className="flex flex-col items-center py-6 text-muted-foreground gap-2"
                data-ocid="consultant.opd_queue.empty_state"
              >
                <CalendarDays className="w-7 h-7 opacity-30" />
                <p className="text-sm">
                  No appointments — you're all caught up!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {opdQueue.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border"
                    data-ocid={`consultant.opd_queue.item.${idx + 1}`}
                  >
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {q.serialNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {q.patientName}
                      </p>
                      {q.preferredTime && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {q.preferredTime}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] border capitalize shrink-0 ${statusColors[q.status] ?? statusColors.pending}`}
                    >
                      {q.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admitted Patients Needing Review */}
        <Card
          className="border-l-4 border-l-amber-500"
          data-ocid="consultant.review_needed.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Review Needed
              </h2>
              {reviewNeeded.length > 0 && (
                <Badge className="ml-auto bg-amber-500 text-white text-xs">
                  {reviewNeeded.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <ActionSkeleton />
            ) : reviewNeeded.length === 0 ? (
              <div
                className="flex flex-col items-center py-6 text-muted-foreground gap-2"
                data-ocid="consultant.review_needed.empty_state"
              >
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                <p className="text-sm">
                  All patients reviewed — you're all caught up!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {reviewNeeded.slice(0, 6).map((p, idx) => (
                  <button
                    key={String(p.id)}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/PatientProfile",
                        search: { id: String(p.id) },
                      })
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left"
                    data-ocid={`consultant.review_needed.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bed {p.bedNumber || "—"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${p.hoursSinceNote >= 48 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {p.hoursSinceNote >= 999
                        ? "No notes"
                        : `${p.hoursSinceNote}h ago`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Investigation Results */}
        <Card
          className="border-l-4 border-l-blue-500"
          data-ocid="consultant.new_results.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-foreground text-sm">
                New Results
              </h2>
              {newResults.length > 0 && (
                <Badge className="ml-auto bg-blue-500 text-white text-xs">
                  {newResults.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <ActionSkeleton />
            ) : newResults.length === 0 ? (
              <div
                className="flex flex-col items-center py-6 text-muted-foreground gap-2"
                data-ocid="consultant.new_results.empty_state"
              >
                <FlaskConical className="w-7 h-7 opacity-30" />
                <p className="text-sm">No new results since last login</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {newResults.map((r, idx) => (
                  <button
                    key={`${r.patientId}-${r.testName}-${idx}`}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/PatientProfile",
                        search: { id: r.patientId },
                      })
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left"
                    data-ocid={`consultant.new_result.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.testName}: {r.result}
                        {r.unit ? ` ${r.unit}` : ""}
                      </p>
                    </div>
                    {r.isAbnormal && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 shrink-0">
                        <TrendingDown className="w-3 h-3" /> Abnormal
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient Tabs */}
      <Tabs defaultValue="ipd">
        <TabsList className="mb-4">
          <TabsTrigger value="ipd" data-ocid="consultant.tab.ipd">
            Admitted (IPD){" "}
            <span className="ml-1.5 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {admittedPatients.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="opd" data-ocid="consultant.tab.opd">
            Outpatient (OPD){" "}
            <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {opdPatients.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ipd">
          {admittedPatients.length === 0 ? (
            <div
              className="text-center py-12 text-muted-foreground"
              data-ocid="consultant.ipd.empty_state"
            >
              <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No admitted patients</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {admittedPatients.map((p) => {
                const severity = getAlertSeverity(p);
                const severityColors = {
                  critical: "border-red-300 bg-red-50/30",
                  warning: "border-amber-300 bg-amber-50/30",
                  stable: "border-border bg-card",
                };
                const badgeColors = {
                  critical: "bg-red-600 text-white",
                  warning: "bg-amber-500 text-white",
                  stable: "bg-emerald-500 text-white",
                };
                return (
                  <button
                    key={String(p.id)}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/PatientProfile",
                        search: { id: String(p.id) },
                      })
                    }
                    className={`border rounded-xl p-4 text-left hover:shadow-md transition-all ${severityColors[severity]}`}
                    data-ocid={`consultant.ipd_card.${String(p.id)}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="font-bold text-indigo-700">
                            {p.fullName.charAt(0)}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-foreground truncate">
                          {p.fullName}
                        </p>
                      </div>
                      <Badge
                        className={`text-[10px] shrink-0 capitalize ${badgeColors[severity]}`}
                      >
                        {severity}
                      </Badge>
                    </div>
                    <div className="space-y-0.5 pl-11">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <BedDouble className="w-3 h-3" /> Bed{" "}
                        {p.bedNumber || "—"} · {p.ward || "General Ward"}
                      </p>
                      {p.registerNumber && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {p.registerNumber}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center text-xs text-primary font-medium gap-1">
                      View Profile <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="opd">
          {opdPatients.length === 0 ? (
            <div
              className="text-center py-12 text-muted-foreground"
              data-ocid="consultant.opd.empty_state"
            >
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No outpatients found</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {opdPatients.slice(0, 12).map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/PatientProfile",
                      search: { id: String(p.id) },
                    })
                  }
                  className="border rounded-xl p-4 text-left hover:shadow-md transition-all bg-card"
                  data-ocid={`consultant.opd_card.${String(p.id)}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="font-bold text-emerald-700">
                        {p.fullName.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {p.fullName}
                      </p>
                      {p.registerNumber && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {p.registerNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Recent Prescriptions */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">
              Recent Prescriptions
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => navigate({ to: "/Patients" })}
          >
            View All <ArrowRight className="w-3 h-3" />
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {recentRx.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-ocid="consultant.recent_rx.empty_state"
            >
              No prescriptions yet
            </p>
          ) : (
            <div className="divide-y divide-border">
              {recentRx.map((rx) => (
                <div
                  key={rx.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {rx.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {rx.diagnosis}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {rx.status === "draft_awaiting_approval" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-700"
                      >
                        Draft
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {rx.createdAt
                        ? new Date(rx.createdAt).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
