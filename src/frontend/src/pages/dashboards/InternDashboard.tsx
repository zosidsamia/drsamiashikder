import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BedDouble,
  ClipboardCheck,
  ClipboardList,
  FileText,
  InfoIcon,
  Loader2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useEmailAuth } from "../../hooks/useEmailAuth";
import type { Patient } from "../../types";

interface LocalPatient extends Patient {
  bedNumber?: string;
  ward?: string;
  isAdmitted?: boolean;
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

interface DraftItem {
  id: string;
  patientName: string;
  patientId: string;
  diagnosis: string;
  createdAt: string;
  type: "prescription" | "note";
}

function loadMyDrafts(doctorEmail: string): DraftItem[] {
  const results: DraftItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("prescriptions_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as Array<
        Record<string, unknown>
      >;
      for (const rx of arr) {
        if (
          rx.status === "draft_awaiting_approval" &&
          (rx.createdBy === doctorEmail || rx.createdByEmail === doctorEmail)
        ) {
          results.push({
            id: String(rx.id ?? ""),
            patientName: String(rx.patientName ?? "Unknown"),
            patientId: String(rx.patientId ?? ""),
            diagnosis: String(rx.diagnosis ?? "—"),
            createdAt: String(rx.createdAt ?? ""),
            type: "prescription",
          });
        }
      }
    } catch {}
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function InternDashboard() {
  const { currentDoctor } = useEmailAuth();
  const navigate = useNavigate();
  const [patientFilter, setPatientFilter] = useState<"all" | "admitted">("all");

  const allPatients = useMemo(loadAllPatients, []);
  const myDrafts = useMemo(
    () => loadMyDrafts(currentDoctor?.email ?? ""),
    [currentDoctor?.email],
  );

  const admittedPatients = allPatients.filter(isAdmitted);
  const opdPatients = allPatients.filter((p) => !isAdmitted(p));
  const displayedPatients =
    patientFilter === "admitted" ? admittedPatients : allPatients;

  // Pending tasks: admitted patients without a progress note today
  const today = new Date().toISOString().split("T")[0];
  const patientsNeedingHistory = admittedPatients.filter((p) => {
    try {
      const notes = JSON.parse(
        localStorage.getItem(`clinicalNotes_${String(p.id)}`) || "[]",
      ) as Array<{ createdAt: string }>;
      return !notes.some((n) => n.createdAt?.startsWith(today));
    } catch {
      return true;
    }
  });

  return (
    <div
      className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6"
      data-ocid="intern.dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {currentDoctor?.designation} {currentDoctor?.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Intern Doctor Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-xs px-3 py-1">
            Intern Doctor
          </Badge>
        </div>
      </div>

      {/* Blue info banner for own pending drafts */}
      {myDrafts.length > 0 && (
        <div
          className="flex items-center gap-3 bg-blue-50 border border-blue-300 rounded-xl px-4 py-3"
          data-ocid="intern.drafts_awaiting.banner"
        >
          <InfoIcon className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">
              {myDrafts.length} prescription
              {myDrafts.length > 1 ? "s" : ""} awaiting MO / Consultant review
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Your draft prescriptions are saved and visible to the supervising
              doctor. They will be activated after approval.
            </p>
          </div>
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold shrink-0"
            data-ocid="intern.drafts_awaiting.badge"
          >
            {myDrafts.length}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-4 flex items-center justify-between">
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
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-4 flex items-center justify-between">
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
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white leading-none">
                {myDrafts.length}
              </p>
              {myDrafts.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/30 text-white text-[10px] font-bold flex items-center justify-center">
                  !
                </span>
              )}
            </div>
            <Loader2 className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              My Drafts
            </p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-red-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {patientsNeedingHistory.length}
            </p>
            <ClipboardCheck className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Pending Tasks
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Patient list with filter tabs */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">Patients</h2>
            <div className="flex items-center gap-1">
              <div className="flex border border-border rounded-lg overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setPatientFilter("all")}
                  className={`px-2.5 py-1 font-medium transition-colors ${patientFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  data-ocid="intern.filter.all_tab"
                >
                  All ({allPatients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPatientFilter("admitted")}
                  className={`px-2.5 py-1 font-medium transition-colors border-l border-border ${patientFilter === "admitted" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  data-ocid="intern.filter.admitted_tab"
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
                data-ocid="intern.patients.empty_state"
              >
                <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {patientFilter === "admitted"
                    ? "No admitted patients"
                    : "No patients yet"}
                </p>
              </div>
            ) : (
              displayedPatients.slice(0, 8).map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/PatientProfile",
                      search: { id: String(p.id) },
                    })
                  }
                  className="w-full border border-border rounded-xl p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                  data-ocid={`intern.patient_card.${String(p.id)}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isAdmitted(p) ? "bg-sky-100" : "bg-blue-100"}`}
                  >
                    <span
                      className={`font-bold text-sm ${isAdmitted(p) ? "text-sky-700" : "text-blue-700"}`}
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
                        ? `Bed ${p.bedNumber || "—"} · ${((p as Record<string, unknown>).currentDiagnosis as string) || p.ward || "No diagnosis yet"}`
                        : "OPD Patient"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
            {patientFilter === "all" && opdPatients.length > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                {opdPatients.length} OPD · {admittedPatients.length} Admitted
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* My drafts */}
          <Card className="border-amber-200 bg-amber-50/20">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-foreground text-sm">
                  My Drafts — Awaiting Review
                </h2>
                {myDrafts.length > 0 && (
                  <span
                    className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold"
                    data-ocid="intern.my_drafts.badge"
                  >
                    {myDrafts.length}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {myDrafts.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground py-2"
                  data-ocid="intern.drafts.empty_state"
                >
                  No drafts waiting
                </p>
              ) : (
                <div className="space-y-2">
                  {myDrafts.map((d, idx) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/PatientProfile",
                          search: { id: d.patientId },
                        })
                      }
                      className="w-full bg-card border border-amber-200 rounded-lg px-3 py-2.5 text-left hover:bg-amber-50 transition-colors"
                      data-ocid={`intern.draft_item.${idx + 1}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {d.patientName}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-300 text-amber-700 shrink-0"
                        >
                          Draft
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.diagnosis}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.createdAt
                          ? new Date(d.createdAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending tasks */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-rose-600" />
                <h2 className="font-semibold text-foreground text-sm">
                  Pending Tasks Today
                </h2>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {patientsNeedingHistory.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground py-2"
                  data-ocid="intern.tasks.empty_state"
                >
                  All notes complete for today ✓
                </p>
              ) : (
                <div className="space-y-2">
                  {patientsNeedingHistory.slice(0, 5).map((p) => (
                    <button
                      key={String(p.id)}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/PatientProfile",
                          search: { id: String(p.id) },
                        })
                      }
                      className="w-full flex items-center gap-2 text-left bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 hover:bg-rose-100 transition-colors"
                      data-ocid={`intern.task_item.${String(p.id)}`}
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <p className="text-sm font-medium text-foreground flex-1 truncate">
                        {p.fullName}
                      </p>
                      <span className="text-xs text-rose-600 shrink-0">
                        Add note →
                      </span>
                    </button>
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
