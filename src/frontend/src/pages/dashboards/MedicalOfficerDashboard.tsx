import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Loader2,
  PlusCircle,
  TrendingDown,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useEmailAuth } from "../../hooks/useEmailAuth";
import type { Patient } from "../../types";

interface LocalPatient extends Patient {
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

interface OverdueNoteItem extends LocalPatient {
  hoursSinceNote: number;
}

interface DischargePendingItem {
  patientId: string;
  patientName: string;
  bedNumber: string;
  ward: string;
  dischargeInitiatedAt: string;
}

interface DeterioratingVitalItem {
  patientId: string;
  patientName: string;
  bedNumber: string;
  alerts: string[];
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

function isAdmitted(p: LocalPatient) {
  return (
    p.isAdmitted === true ||
    p.patientType === "admitted" ||
    p.patientType === "indoor" ||
    String((p as Record<string, unknown>).status ?? "")
      .toLowerCase()
      .includes("admit")
  );
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

function getRecentActivity() {
  const logs: Array<{
    timestamp: string;
    userName: string;
    action: string;
    target: string;
  }> = [];
  try {
    const raw = localStorage.getItem("medicare_audit_log");
    if (raw) {
      const all = JSON.parse(raw) as typeof logs;
      return all.slice(-8).reverse();
    }
  } catch {}
  return logs;
}

function loadOverdueNotes(patients: LocalPatient[]): OverdueNoteItem[] {
  const now = Date.now();
  return patients
    .filter(isAdmitted)
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
        const lastNote = new Date(
          sorted[0].createdAt ?? sorted[0].date ?? 0,
        ).getTime();
        const hours = Math.floor((now - lastNote) / 3600000);
        return { ...p, hoursSinceNote: hours };
      } catch {
        return { ...p, hoursSinceNote: 999 };
      }
    })
    .filter((p) => p.hoursSinceNote >= 24)
    .sort((a, b) => b.hoursSinceNote - a.hoursSinceNote);
}

function loadPendingDischarges(
  patients: LocalPatient[],
): DischargePendingItem[] {
  return patients
    .filter(isAdmitted)
    .filter((p) => {
      try {
        const ds = localStorage.getItem(`dischargeStatus_${String(p.id)}`);
        if (!ds) return false;
        const data = JSON.parse(ds) as {
          initiated?: boolean;
          finalized?: boolean;
        };
        return data.initiated === true && !data.finalized;
      } catch {
        return false;
      }
    })
    .map((p) => {
      let dischargeInitiatedAt = "";
      try {
        const ds = JSON.parse(
          localStorage.getItem(`dischargeStatus_${String(p.id)}`) || "{}",
        ) as { initiatedAt?: string };
        dischargeInitiatedAt = ds.initiatedAt ?? "";
      } catch {}
      return {
        patientId: String(p.id),
        patientName: p.fullName,
        bedNumber: p.bedNumber ?? "—",
        ward: p.ward ?? "General",
        dischargeInitiatedAt,
      };
    });
}

function loadDeterioratingVitals(
  patients: LocalPatient[],
): DeterioratingVitalItem[] {
  const admitted = patients.filter(isAdmitted);
  const results: DeterioratingVitalItem[] = [];
  for (const p of admitted) {
    try {
      const vitals = JSON.parse(
        localStorage.getItem(`vitals_${String(p.id)}`) || "[]",
      ) as Array<{
        spo2?: number;
        pulse?: number;
        systolic?: number;
        diastolic?: number;
        date?: string;
        createdAt?: string;
      }>;
      if (vitals.length === 0) continue;
      const sorted = vitals.sort((a, b) => {
        const ta = new Date(a.createdAt ?? a.date ?? 0).getTime();
        const tb = new Date(b.createdAt ?? b.date ?? 0).getTime();
        return tb - ta;
      });
      const latest = sorted[0];
      const alerts: string[] = [];
      if (latest.spo2 !== undefined && latest.spo2 < 94)
        alerts.push(`SpO₂ ${latest.spo2}%`);
      if (latest.systolic !== undefined && latest.diastolic !== undefined) {
        if (latest.systolic > 180 || latest.diastolic > 120)
          alerts.push(`BP ${latest.systolic}/${latest.diastolic}`);
        if (latest.systolic < 90)
          alerts.push(`Low BP ${latest.systolic}/${latest.diastolic}`);
      }
      if (latest.pulse !== undefined) {
        if (latest.pulse > 100) alerts.push(`Tachycardia ${latest.pulse}`);
        if (latest.pulse < 50) alerts.push(`Bradycardia ${latest.pulse}`);
      }
      // Check pulse trend (rising)
      if (sorted.length >= 3) {
        const pulseValues = sorted
          .slice(0, 3)
          .map((v) => v.pulse ?? 0)
          .filter((v) => v > 0);
        if (
          pulseValues.length === 3 &&
          pulseValues[0] > pulseValues[1] &&
          pulseValues[1] > pulseValues[2] &&
          pulseValues[0] > 100
        ) {
          alerts.push("Rising pulse trend");
        }
      }
      if (alerts.length > 0) {
        results.push({
          patientId: String(p.id),
          patientName: p.fullName,
          bedNumber: p.bedNumber ?? "—",
          alerts,
        });
      }
    } catch {}
  }
  return results;
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

export default function MedicalOfficerDashboard() {
  const { currentDoctor } = useEmailAuth();
  const navigate = useNavigate();
  const [patientFilter, setPatientFilter] = useState<"all" | "admitted">("all");
  const [draftsExpanded, setDraftsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const allPatients = useMemo(loadAllPatients, []);
  const recentActivity = useMemo(getRecentActivity, []);

  const [pendingDrafts, setPendingDrafts] = useState<DraftApprovalItem[]>(() =>
    loadPendingDrafts(),
  );

  // Action center data
  const overdueNotes = useMemo(
    () => loadOverdueNotes(allPatients),
    [allPatients],
  );
  const pendingDischarges = useMemo(
    () => loadPendingDischarges(allPatients),
    [allPatients],
  );
  const deterioratingVitals = useMemo(
    () => loadDeterioratingVitals(allPatients),
    [allPatients],
  );

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

  const admittedPatients = allPatients.filter(isAdmitted);
  const opdPatients = allPatients.filter((p) => !isAdmitted(p));
  const displayedPatients =
    patientFilter === "admitted" ? admittedPatients : allPatients;

  return (
    <div
      className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6"
      data-ocid="mo.dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {currentDoctor?.designation} {currentDoctor?.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Medical Officer Dashboard
          </p>
        </div>
        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-3 py-1">
          Medical Officer
        </Badge>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {allPatients.length}
            </p>
            <Users className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              All Patients
            </p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {admittedPatients.length}
            </p>
            <BedDouble className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Admitted
            </p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-sky-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {opdPatients.length}
            </p>
            <Users className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">OPD</p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white leading-none">
                {pendingDrafts.length}
              </p>
              {pendingDrafts.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/30 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  !
                </span>
              )}
            </div>
            <FileText className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Pending Approvals
            </p>
          </div>
        </div>
      </div>

      {/* ── ACTION CENTER ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Overdue Daily Progress Notes */}
        <Card
          className="border-l-4 border-l-red-500"
          data-ocid="mo.overdue_notes.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Overdue SOAP Notes
              </h2>
              {overdueNotes.length > 0 && (
                <Badge className="ml-auto bg-red-500 text-white text-xs">
                  {overdueNotes.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <ActionSkeleton />
            ) : overdueNotes.length === 0 ? (
              <div
                className="flex flex-col items-center py-6 text-muted-foreground gap-2"
                data-ocid="mo.overdue_notes.empty_state"
              >
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                <p className="text-sm">
                  All notes up to date — you're all caught up!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {overdueNotes.slice(0, 6).map((p, idx) => (
                  <div
                    key={String(p.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border"
                    data-ocid={`mo.overdue_note.item.${idx + 1}`}
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
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${p.hoursSinceNote >= 48 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {p.hoursSinceNote >= 999
                        ? "No notes"
                        : `${p.hoursSinceNote}h`}
                    </span>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[10px] bg-primary text-primary-foreground gap-1 shrink-0"
                      onClick={() =>
                        navigate({
                          to: "/PatientProfile",
                          search: { id: String(p.id) },
                        })
                      }
                      data-ocid={`mo.write_note.button.${idx + 1}`}
                    >
                      Write
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Discharge Summaries */}
        <Card
          className="border-l-4 border-l-amber-500"
          data-ocid="mo.pending_discharge.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Pending Discharges
              </h2>
              {pendingDischarges.length > 0 && (
                <Badge className="ml-auto bg-amber-500 text-white text-xs">
                  {pendingDischarges.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <ActionSkeleton />
            ) : pendingDischarges.length === 0 ? (
              <div
                className="flex flex-col items-center py-6 text-muted-foreground gap-2"
                data-ocid="mo.pending_discharge.empty_state"
              >
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                <p className="text-sm">No pending discharge summaries</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {pendingDischarges.map((d, idx) => (
                  <button
                    key={d.patientId}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/PatientProfile",
                        search: { id: d.patientId },
                      })
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left"
                    data-ocid={`mo.pending_discharge.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {d.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bed {d.bedNumber} · {d.ward}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-300 text-amber-700 shrink-0"
                    >
                      Draft
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deteriorating Vitals */}
        <Card
          className="border-l-4 border-l-red-600"
          data-ocid="mo.deteriorating_vitals.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Deteriorating Vitals
              </h2>
              {deterioratingVitals.length > 0 && (
                <Badge className="ml-auto bg-red-600 text-white text-xs">
                  {deterioratingVitals.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <ActionSkeleton />
            ) : deterioratingVitals.length === 0 ? (
              <div
                className="flex flex-col items-center py-6 text-muted-foreground gap-2"
                data-ocid="mo.deteriorating_vitals.empty_state"
              >
                <Activity className="w-7 h-7 text-emerald-400" />
                <p className="text-sm">No deteriorating vitals — all stable</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {deterioratingVitals.map((d, idx) => (
                  <button
                    key={d.patientId}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/PatientProfile",
                        search: { id: d.patientId },
                      })
                    }
                    className="w-full flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left"
                    data-ocid={`mo.deteriorating_vital.item.${idx + 1}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {d.patientName}
                      </p>
                      <p className="text-xs text-red-600 truncate">
                        {d.alerts.join(" · ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Patient list with filter tabs */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground text-sm">
                Patients
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex border border-border rounded-lg overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setPatientFilter("all")}
                  className={`px-2.5 py-1 font-medium transition-colors ${patientFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  data-ocid="mo.filter.all_tab"
                >
                  All ({allPatients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPatientFilter("admitted")}
                  className={`px-2.5 py-1 font-medium transition-colors border-l border-border ${patientFilter === "admitted" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  data-ocid="mo.filter.admitted_tab"
                >
                  Admitted ({admittedPatients.length})
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 ml-1"
                onClick={() => navigate({ to: "/Patients" })}
              >
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {displayedPatients.length === 0 ? (
              <div
                className="text-center py-8 text-muted-foreground"
                data-ocid="mo.patients.empty_state"
              >
                <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {patientFilter === "admitted"
                    ? "No admitted patients"
                    : "No patients yet"}
                </p>
              </div>
            ) : (
              displayedPatients.slice(0, 6).map((p) => (
                <div
                  key={String(p.id)}
                  className="border border-border rounded-xl p-3 flex items-center gap-3"
                  data-ocid={`mo.patient_card.${String(p.id)}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isAdmitted(p) ? "bg-green-100" : "bg-sky-100"}`}
                  >
                    <span
                      className={`font-bold text-sm ${isAdmitted(p) ? "text-green-700" : "text-sky-700"}`}
                    >
                      {p.fullName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {p.fullName}
                      </p>
                      {isAdmitted(p) && (
                        <Badge className="text-[10px] bg-green-100 text-green-800 border border-green-300 shrink-0">
                          🏥 Admitted
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isAdmitted(p)
                        ? `Bed ${p.bedNumber || "—"} · ${p.ward || "General"}`
                        : "OPD Patient"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 gap-1 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() =>
                        navigate({
                          to: "/PatientProfile",
                          search: { id: String(p.id) },
                        })
                      }
                      data-ocid="mo.add_note.button"
                    >
                      <PlusCircle className="w-3 h-3" /> Note
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 gap-1"
                      onClick={() =>
                        navigate({
                          to: "/PatientProfile",
                          search: { id: String(p.id) },
                        })
                      }
                      data-ocid="mo.view_patient.button"
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Pending drafts — collapsible with badge */}
          <Card
            className={
              pendingDrafts.length > 0 ? "border-red-300" : "border-amber-200"
            }
          >
            <CardHeader className="pb-3 pt-4 px-5">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2"
                onClick={() => {
                  setDraftsExpanded((v) => !v);
                  if (!draftsExpanded) setPendingDrafts(loadPendingDrafts());
                }}
                data-ocid="mo.pending_approvals.toggle"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <h2 className="font-semibold text-foreground text-sm">
                    Prescriptions Awaiting Approval
                  </h2>
                  {pendingDrafts.length > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none"
                      data-ocid="mo.pending_approvals.badge"
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
                    data-ocid="mo.drafts.empty_state"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <p className="text-sm">All prescriptions approved</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingDrafts.slice(0, 5).map((d, idx) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 border border-red-200"
                        data-ocid={`mo.pending_approval.item.${idx + 1}`}
                      >
                        <Loader2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {d.patientName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            By {d.internName} ·{" "}
                            {d.createdAt
                              ? new Date(d.createdAt).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white gap-1 shrink-0"
                          onClick={() =>
                            navigate({
                              to: "/PatientProfile",
                              search: { id: d.patientId },
                            })
                          }
                          data-ocid={`mo.pending_approval.review.${idx + 1}`}
                        >
                          <Eye className="w-3 h-3" /> Review
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground text-sm">
                  Recent Activity
                </h2>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {recentActivity.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground py-2"
                  data-ocid="mo.activity.empty_state"
                >
                  No recent activity
                </p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.slice(0, 5).map((entry, i) => (
                    <div
                      key={`${entry.timestamp}-${i}`}
                      className="text-xs text-muted-foreground flex items-start gap-2 py-1 border-b border-border last:border-0"
                    >
                      <span className="font-medium text-foreground min-w-0 truncate">
                        {entry.userName}
                      </span>
                      <span className="shrink-0">{entry.action}</span>
                      <span className="ml-auto shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
