/**
 * HistoryFeatures — Problem List, Complaint Trend, Compare Visits, Vaccination Table
 * Used in both PatientDashboard and PatientProfile history tabs.
 */
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  GitCompare,
  ListChecks,
  Plus,
  Shield,
  Syringe,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDoctorEmail } from "../hooks/useQueries";
import { getVisitFormData } from "../hooks/useQueries";
import type {
  ComplaintTrendEntry,
  Patient,
  VaccinationRecord,
  Visit,
} from "../types";
import {
  computeComplaintTrends,
  isVaccineOverdue,
} from "../utils/clinicalUtils";
import {
  loadVaccinationRecords,
  saveVaccinationRecords,
} from "./patientDashboardTypes";
import type { ProblemItem } from "./patientDashboardTypes";
import { loadProblemList, saveProblemList } from "./patientDashboardTypes";

// ── Bangladesh standard immunization schedule ──────────────────────────────────
const STANDARD_VACCINES: Omit<VaccinationRecord, "id" | "isOverdue">[] = [
  { vaccineName: "BCG", isCustom: false },
  { vaccineName: "Hepatitis B (Birth)", isCustom: false },
  { vaccineName: "DPT-1 / Pentavalent-1", isCustom: false },
  { vaccineName: "DPT-2 / Pentavalent-2", isCustom: false },
  { vaccineName: "DPT-3 / Pentavalent-3", isCustom: false },
  { vaccineName: "OPV / Polio-1", isCustom: false },
  { vaccineName: "OPV / Polio-2", isCustom: false },
  { vaccineName: "OPV / Polio-3", isCustom: false },
  { vaccineName: "Measles-1 (MR)", isCustom: false },
  { vaccineName: "Measles-2 (MMR)", isCustom: false },
  { vaccineName: "Hepatitis B-2", isCustom: false },
  { vaccineName: "Hepatitis B-3", isCustom: false },
];

/** Build standard vaccine schedule with due dates based on DOB */
function buildDefaultVaccines(dobMs: number | null): VaccinationRecord[] {
  const schedule: number[] = [0, 0, 42, 70, 98, 42, 70, 98, 270, 450, 42, 98]; // days after birth
  return STANDARD_VACCINES.map((v, i) => {
    const dueDate =
      dobMs !== null
        ? new Date(dobMs + schedule[i] * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : undefined;
    return {
      id: `std_${i}`,
      vaccineName: v.vaccineName,
      isCustom: false,
      dueDate,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(isoOrMs: string | number | undefined): string {
  if (!isoOrMs) return "—";
  try {
    if (typeof isoOrMs === "number")
      return format(new Date(isoOrMs), "d MMM yyyy");
    return format(parseISO(isoOrMs), "d MMM yyyy");
  } catch {
    return String(isoOrMs);
  }
}

function severityColor(s: string): string {
  if (s === "mild") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (s === "moderate")
    return "bg-orange-100 text-orange-800 border-orange-200";
  if (s === "severe") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

// ── CollapsibleSection ────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  color,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border ${color} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
          <span className="font-semibold text-sm text-gray-800">{title}</span>
          {count !== undefined && (
            <Badge variant="outline" className="text-xs h-5 px-1.5 font-mono">
              {count}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="p-4 border-t border-current/10">{children}</div>}
    </div>
  );
}

// ── 1. Problem List ───────────────────────────────────────────────────────────

interface ProblemListProps {
  visits: Visit[];
  patientId: bigint;
  isDoctor: boolean;
}

export function ProblemList({ visits, patientId, isDoctor }: ProblemListProps) {
  const doctorEmail = getDoctorEmail() ?? "default";
  const patientIdStr = patientId.toString();

  // Collect diagnoses from visits
  const visitDiagnoses = useMemo(() => {
    const map = new Map<
      string,
      {
        firstDate: number;
        lastDate: number;
        firstVisitId: string;
        chiefComplaint: string;
      }
    >();

    const sorted = [...visits].sort(
      (a, b) => Number(a.visitDate) - Number(b.visitDate),
    );
    for (const v of sorted) {
      let diag = v.diagnosis || "";
      try {
        const fd = getVisitFormData(v.id);
        if (fd?.diagnosis) diag = String(fd.diagnosis);
      } catch {}
      const dateMs = Number(v.visitDate) / 1000;
      for (const d of diag
        .split(/[,;،\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        const key = d.toLowerCase();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            firstDate: dateMs,
            lastDate: dateMs,
            firstVisitId: v.id.toString(),
            chiefComplaint: v.chiefComplaint || "",
          });
        } else {
          existing.lastDate = dateMs;
        }
      }
    }
    return map;
  }, [visits]);

  // Stored problem list from localStorage
  const [items, setItems] = useState<ProblemItem[]>(() =>
    loadProblemList(doctorEmail, patientIdStr),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Merge visit diagnoses into problem list
  const mergedItems = useMemo<ProblemItem[]>(() => {
    const existing = new Map(items.map((it) => [it.name.toLowerCase(), it]));
    const result: ProblemItem[] = [...items];
    for (const key of visitDiagnoses.keys()) {
      if (!existing.has(key)) {
        result.push({
          id: `auto_${key}`,
          name: key,
          status: "active",
          source: "prescription",
        });
      }
    }
    return result;
  }, [items, visitDiagnoses]);

  const active = mergedItems.filter((i) => i.status === "active");
  const resolved = mergedItems.filter((i) => i.status === "resolved");

  function toggleStatus(id: string) {
    if (!isDoctor) return;
    const next = mergedItems.map((it) =>
      it.id === id
        ? ({
            ...it,
            status: it.status === "active" ? "resolved" : "active",
          } as ProblemItem)
        : it,
    );
    setItems(next);
    saveProblemList(doctorEmail, patientIdStr, next);
  }

  return (
    <CollapsibleSection
      title="Problem List"
      icon={ListChecks}
      color="border-indigo-200"
      count={mergedItems.length}
    >
      {mergedItems.length === 0 ? (
        <p
          className="text-sm text-gray-400 text-center py-4"
          data-ocid="history_features.problem_list.empty_state"
        >
          No diagnoses recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Active diagnoses */}
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1.5">
                Active
              </p>
              <div className="space-y-1.5">
                {active.map((item, idx) => {
                  const info = visitDiagnoses.get(item.name.toLowerCase());
                  const isExpanded = expandedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="border border-indigo-100 rounded-lg overflow-hidden"
                      data-ocid={`history_features.problem_list.item.${idx + 1}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                        className="w-full flex items-center gap-2.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-left transition-colors"
                      >
                        <Badge className="bg-indigo-600 text-white text-xs shrink-0">
                          Active
                        </Badge>
                        <span className="font-medium text-sm text-gray-800 flex-1 capitalize">
                          {item.name}
                        </span>
                        {info && (
                          <span className="text-xs text-gray-400 shrink-0">
                            {fmtDate(info.firstDate)}
                            {info.firstDate !== info.lastDate
                              ? ` → ${fmtDate(info.lastDate)}`
                              : ""}
                          </span>
                        )}
                        {isDoctor && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs text-gray-400 hover:text-gray-700 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(item.id);
                              toast.success(`Marked as resolved: ${item.name}`);
                            }}
                            data-ocid={`history_features.problem_list.toggle.${idx + 1}`}
                          >
                            Resolve
                          </Button>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}
                      </button>
                      {isExpanded && info && (
                        <div className="px-4 py-3 bg-white text-sm space-y-1">
                          <p>
                            <span className="font-medium text-gray-600">
                              First appeared:
                            </span>{" "}
                            {fmtDate(info.firstDate)}
                          </p>
                          {info.firstDate !== info.lastDate && (
                            <p>
                              <span className="font-medium text-gray-600">
                                Most recent:
                              </span>{" "}
                              {fmtDate(info.lastDate)}
                            </p>
                          )}
                          {info.chiefComplaint && (
                            <p>
                              <span className="font-medium text-gray-600">
                                Chief Complaint:
                              </span>{" "}
                              {info.chiefComplaint}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolved diagnoses */}
          {resolved.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Resolved
              </p>
              <div className="space-y-1">
                {resolved.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                    data-ocid={`history_features.problem_list.resolved.${idx + 1}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-500 flex-1 capitalize line-through">
                      {item.name}
                    </span>
                    <Badge variant="outline" className="text-xs text-gray-400">
                      Resolved
                    </Badge>
                    {isDoctor && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-xs text-gray-400 hover:text-indigo-600 shrink-0"
                        onClick={() => {
                          toggleStatus(item.id);
                          toast.success(`Reactivated: ${item.name}`);
                        }}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── 2. Complaint Trend Timeline ───────────────────────────────────────────────

interface ComplaintTrendProps {
  visits: Visit[];
}

export function ComplaintTrendTimeline({ visits }: ComplaintTrendProps) {
  const trends = useMemo(() => computeComplaintTrends(visits), [visits]);
  const [selectedTrend, setSelectedTrend] =
    useState<ComplaintTrendEntry | null>(null);

  return (
    <CollapsibleSection
      title="Complaint Trend"
      icon={TrendingUp}
      color="border-amber-200"
      count={trends.length}
    >
      {trends.length === 0 ? (
        <p
          className="text-sm text-gray-400 text-center py-4"
          data-ocid="history_features.complaint_trend.empty_state"
        >
          No complaints recorded.
        </p>
      ) : (
        <div className="space-y-2">
          {trends.map((t, idx) => {
            const lastEntry = t.severityHistory[t.severityHistory.length - 1];
            const lastSeverity = lastEntry?.severity ?? "mild";
            return (
              <button
                key={t.complaintName}
                type="button"
                onClick={() => setSelectedTrend(t)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
                data-ocid={`history_features.complaint_trend.item.${idx + 1}`}
              >
                {/* Status dot */}
                {t.currentStatus === "active" ? (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}

                {/* Name */}
                <span className="font-medium text-sm text-gray-800 flex-1 capitalize">
                  {t.complaintName}
                </span>

                {/* First appeared */}
                <span className="text-xs text-gray-400 shrink-0">
                  {fmtDate(t.firstAppeared)}
                </span>

                {/* Severity badge */}
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 capitalize ${severityColor(lastSeverity)}`}
                >
                  {lastSeverity}
                </Badge>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${t.currentStatus === "active" ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}
                >
                  {t.currentStatus === "active" ? "Active" : "Resolved"}
                </Badge>

                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Detail popover */}
      {selectedTrend && (
        <Dialog
          open={!!selectedTrend}
          onOpenChange={() => setSelectedTrend(null)}
        >
          <DialogContent
            className="max-w-sm"
            data-ocid="history_features.complaint_trend.dialog"
          >
            <DialogHeader>
              <DialogTitle className="capitalize flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                {selectedTrend.complaintName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                First appeared:{" "}
                <strong>{fmtDate(selectedTrend.firstAppeared)}</strong>
              </p>
              <div>
                <p className="font-semibold text-gray-700 mb-2">
                  Severity History
                </p>
                <div className="space-y-1.5">
                  {selectedTrend.severityHistory.map((h, i) => (
                    <div
                      key={`${h.visitId}-${i}`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-gray-400 w-20 shrink-0">
                        {fmtDate(h.date)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${severityColor(h.severity)}`}
                      >
                        {h.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTrend(null)}
                data-ocid="history_features.complaint_trend.close_button"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </CollapsibleSection>
  );
}

// ── 3. Compare Visits ─────────────────────────────────────────────────────────

interface CompareVisitsProps {
  visits: Visit[];
  isDoctor: boolean;
}

export function CompareVisits({ visits, isDoctor }: CompareVisitsProps) {
  const [open, setOpen] = useState(false);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  const sorted = useMemo(
    () => [...visits].sort((a, b) => Number(b.visitDate) - Number(a.visitDate)),
    [visits],
  );

  const leftVisit = sorted.find((v) => v.id.toString() === leftId) ?? null;
  const rightVisit = sorted.find((v) => v.id.toString() === rightId) ?? null;

  function getExtData(v: Visit): Record<string, unknown> {
    try {
      const fd = getVisitFormData(v.id);
      if (fd) return fd;
    } catch {}
    return {};
  }

  function diffLines(
    a: string,
    b: string,
  ): { text: string; state: "same" | "left" | "right" }[] {
    const aLines = a
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const bLines = b
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const all = new Set([...aLines, ...bLines]);
    return Array.from(all).map((text) => {
      const inA = aLines.some((l) => l.toLowerCase() === text.toLowerCase());
      const inB = bLines.some((l) => l.toLowerCase() === text.toLowerCase());
      if (inA && inB) return { text, state: "same" as const };
      if (inA) return { text, state: "left" as const };
      return { text, state: "right" as const };
    });
  }

  if (!isDoctor) return null;

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={() => setOpen(true)}
          data-ocid="history_features.compare_visits.open_modal_button"
        >
          <GitCompare className="w-3.5 h-3.5" />
          Compare Visits
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-4xl max-h-[85vh] overflow-y-auto"
          data-ocid="history_features.compare_visits.dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-blue-600" />
              Compare Two Visits
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-xs font-medium mb-1 block">
                Left Visit
              </Label>
              <select
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                data-ocid="history_features.compare_visits.select"
              >
                <option value="">— Select Visit —</option>
                {sorted.map((v) => (
                  <option key={v.id.toString()} value={v.id.toString()}>
                    {format(
                      new Date(Number(v.visitDate / 1000000n)),
                      "d MMM yyyy",
                    )}{" "}
                    — {v.visitType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">
                Right Visit
              </Label>
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                data-ocid="history_features.compare_visits.select"
              >
                <option value="">— Select Visit —</option>
                {sorted.map((v) => (
                  <option key={v.id.toString()} value={v.id.toString()}>
                    {format(
                      new Date(Number(v.visitDate / 1000000n)),
                      "d MMM yyyy",
                    )}{" "}
                    — {v.visitType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {leftVisit && rightVisit ? (
            <div className="space-y-4">
              {(
                [
                  {
                    label: "Chief Complaints",
                    left: leftVisit.chiefComplaint ?? "",
                    right: rightVisit.chiefComplaint ?? "",
                  },
                  {
                    label: "Examination Findings",
                    left:
                      (getExtData(leftVisit).examinationFindings as string) ??
                      leftVisit.physicalExamination ??
                      "",
                    right:
                      (getExtData(rightVisit).examinationFindings as string) ??
                      rightVisit.physicalExamination ??
                      "",
                  },
                  {
                    label: "Diagnosis",
                    left:
                      (getExtData(leftVisit).diagnosis as string) ??
                      leftVisit.diagnosis ??
                      "",
                    right:
                      (getExtData(rightVisit).diagnosis as string) ??
                      rightVisit.diagnosis ??
                      "",
                  },
                ] as const
              ).map(({ label, left, right }) => {
                const diff = diffLines(left, right);
                const hasChange = diff.some((d) => d.state !== "same");
                return (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700">
                        {label}
                      </p>
                      {!hasChange && (
                        <Badge
                          variant="outline"
                          className="text-xs text-gray-400 border-gray-200"
                        >
                          No change
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1 min-h-[60px]">
                        {diff.map((d, i) => (
                          <p
                            key={`${d.text}-${i}`}
                            className={`text-xs rounded px-1 ${d.state === "left" ? "bg-red-100 text-red-700 line-through" : d.state === "same" ? "text-gray-600" : "text-gray-300"}`}
                          >
                            {d.state !== "right" ? d.text : ""}
                          </p>
                        ))}
                        {!diff.some((d) => d.state !== "right") && (
                          <p className="text-xs text-gray-300 italic">—</p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1 min-h-[60px]">
                        {diff.map((d, i) => (
                          <p
                            key={`${d.text}-${i}`}
                            className={`text-xs rounded px-1 ${d.state === "right" ? "bg-green-100 text-green-700" : d.state === "same" ? "text-gray-600" : "text-gray-300"}`}
                          >
                            {d.state !== "left" ? d.text : ""}
                          </p>
                        ))}
                        {!diff.some((d) => d.state !== "left") && (
                          <p className="text-xs text-gray-300 italic">—</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <p className="text-xs text-gray-400 text-center">
                        {format(
                          new Date(Number(leftVisit.visitDate / 1000000n)),
                          "d MMM yyyy",
                        )}
                      </p>
                      <p className="text-xs text-gray-400 text-center">
                        {format(
                          new Date(Number(rightVisit.visitDate / 1000000n)),
                          "d MMM yyyy",
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              Select two visits above to compare them side by side.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              data-ocid="history_features.compare_visits.close_button"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 4. Vaccination Table ──────────────────────────────────────────────────────

interface VaccinationTableProps {
  patient: Pick<Patient, "id" | "dateOfBirth" | "gender">;
  isDoctor: boolean;
}

export function VaccinationTable({ patient, isDoctor }: VaccinationTableProps) {
  const doctorEmail = getDoctorEmail() ?? "default";
  const patientIdStr = patient.id.toString();

  const dobMs = patient.dateOfBirth
    ? Number(patient.dateOfBirth) / 1_000_000
    : null;

  const [records, setRecords] = useState<VaccinationRecord[]>(() => {
    const saved = loadVaccinationRecords(doctorEmail, patientIdStr);
    if (saved.length > 0) return saved;
    return buildDefaultVaccines(dobMs);
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVaccine, setNewVaccine] = useState<Partial<VaccinationRecord>>({
    vaccineName: "",
    isCustom: true,
  });

  useEffect(() => {
    saveVaccinationRecords(doctorEmail, patientIdStr, records);
  }, [records, doctorEmail, patientIdStr]);

  function updateRecord(id: string, patch: Partial<VaccinationRecord>) {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setEditId(null);
    toast.success("Vaccination record updated");
  }

  function deleteRecord(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast.success("Record deleted");
  }

  function addCustomVaccine() {
    if (!newVaccine.vaccineName?.trim()) {
      toast.error("Vaccine name required");
      return;
    }
    const record: VaccinationRecord = {
      id: `custom_${Date.now()}`,
      vaccineName: newVaccine.vaccineName,
      dateGiven: newVaccine.dateGiven,
      dueDate: newVaccine.dueDate,
      givenBy: newVaccine.givenBy,
      batchNo: newVaccine.batchNo,
      isCustom: true,
    };
    setRecords((prev) => [...prev, record]);
    setNewVaccine({ vaccineName: "", isCustom: true });
    setShowAddForm(false);
    toast.success("Vaccine added");
  }

  const overdueCount = records.filter((r) => isVaccineOverdue(r)).length;

  return (
    <CollapsibleSection
      title="Vaccination / Immunization"
      icon={Syringe}
      color="border-green-200"
      count={records.length}
    >
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">
            {overdueCount} vaccine{overdueCount !== 1 ? "s" : ""} overdue
          </p>
        </div>
      )}

      <div className="overflow-x-auto -mx-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-semibold">Vaccine</TableHead>
              <TableHead className="text-xs font-semibold">
                Date Given
              </TableHead>
              <TableHead className="text-xs font-semibold">Due Date</TableHead>
              <TableHead className="text-xs font-semibold">Given By</TableHead>
              <TableHead className="text-xs font-semibold">Batch No</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              {isDoctor && (
                <TableHead className="text-xs font-semibold w-20">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r, idx) => {
              const overdue = isVaccineOverdue(r);
              const given = !!r.dateGiven;
              const isEditing = editId === r.id;
              return (
                <TableRow
                  key={r.id}
                  className={overdue ? "bg-red-50/40" : ""}
                  data-ocid={`history_features.vaccination.item.${idx + 1}`}
                >
                  <TableCell className="text-sm font-medium py-2">
                    {isEditing ? (
                      <Input
                        className="h-7 text-xs"
                        defaultValue={r.vaccineName}
                        onBlur={(e) =>
                          updateRecord(r.id, { vaccineName: e.target.value })
                        }
                      />
                    ) : (
                      r.vaccineName
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    {isEditing ? (
                      <Input
                        type="date"
                        className="h-7 text-xs"
                        defaultValue={r.dateGiven ?? ""}
                        onBlur={(e) =>
                          updateRecord(r.id, {
                            dateGiven: e.target.value || undefined,
                          })
                        }
                      />
                    ) : (
                      fmtDate(r.dateGiven)
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    {isEditing ? (
                      <Input
                        type="date"
                        className="h-7 text-xs"
                        defaultValue={r.dueDate ?? ""}
                        onBlur={(e) =>
                          updateRecord(r.id, {
                            dueDate: e.target.value || undefined,
                          })
                        }
                      />
                    ) : (
                      fmtDate(r.dueDate)
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    {isEditing ? (
                      <Input
                        className="h-7 text-xs"
                        defaultValue={r.givenBy ?? ""}
                        onBlur={(e) =>
                          updateRecord(r.id, {
                            givenBy: e.target.value || undefined,
                          })
                        }
                      />
                    ) : (
                      (r.givenBy ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-2 font-mono">
                    {isEditing ? (
                      <Input
                        className="h-7 text-xs"
                        defaultValue={r.batchNo ?? ""}
                        onBlur={(e) =>
                          updateRecord(r.id, {
                            batchNo: e.target.value || undefined,
                          })
                        }
                      />
                    ) : (
                      (r.batchNo ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {given ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">
                        Given
                      </Badge>
                    ) : overdue ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">
                        Overdue
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-gray-400"
                      >
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  {isDoctor && (
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                          onClick={() => setEditId(isEditing ? null : r.id)}
                          data-ocid={`history_features.vaccination.edit_button.${idx + 1}`}
                        >
                          {isEditing ? (
                            <X className="w-3 h-3" />
                          ) : (
                            <BookOpen className="w-3 h-3" />
                          )}
                        </Button>
                        {r.isCustom && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                            onClick={() => deleteRecord(r.id)}
                            data-ocid={`history_features.vaccination.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {isDoctor && (
        <div className="mt-3">
          {showAddForm ? (
            <div className="border border-green-200 rounded-lg p-3 bg-green-50 space-y-3">
              <p className="text-xs font-semibold text-green-800">
                Add Custom Vaccine
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Vaccine Name *</Label>
                  <Input
                    className="h-7 text-xs mt-0.5"
                    placeholder="e.g. Typhoid"
                    value={newVaccine.vaccineName ?? ""}
                    onChange={(e) =>
                      setNewVaccine((v) => ({
                        ...v,
                        vaccineName: e.target.value,
                      }))
                    }
                    data-ocid="history_features.vaccination.input"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date Given</Label>
                  <Input
                    type="date"
                    className="h-7 text-xs mt-0.5"
                    value={newVaccine.dateGiven ?? ""}
                    onChange={(e) =>
                      setNewVaccine((v) => ({
                        ...v,
                        dateGiven: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input
                    type="date"
                    className="h-7 text-xs mt-0.5"
                    value={newVaccine.dueDate ?? ""}
                    onChange={(e) =>
                      setNewVaccine((v) => ({
                        ...v,
                        dueDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Given By</Label>
                  <Input
                    className="h-7 text-xs mt-0.5"
                    placeholder="Doctor / Nurse name"
                    value={newVaccine.givenBy ?? ""}
                    onChange={(e) =>
                      setNewVaccine((v) => ({
                        ...v,
                        givenBy: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Batch No</Label>
                  <Input
                    className="h-7 text-xs mt-0.5"
                    placeholder="e.g. BTH202601"
                    value={newVaccine.batchNo ?? ""}
                    onChange={(e) =>
                      setNewVaccine((v) => ({
                        ...v,
                        batchNo: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowAddForm(false)}
                  data-ocid="history_features.vaccination.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                  onClick={addCustomVaccine}
                  data-ocid="history_features.vaccination.submit_button"
                >
                  Add Vaccine
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50 mt-1"
              onClick={() => setShowAddForm(true)}
              data-ocid="history_features.vaccination.upload_button"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Vaccine
            </Button>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── HistoryFeaturesPanel — renders all 4 in a unified stack ──────────────────

interface HistoryFeaturesPanelProps {
  visits: Visit[];
  patient: Pick<Patient, "id" | "dateOfBirth" | "gender">;
  isDoctor: boolean;
}

export default function HistoryFeaturesPanel({
  visits,
  patient,
  isDoctor,
}: HistoryFeaturesPanelProps) {
  return (
    <div className="space-y-4 mt-4" data-ocid="history_features.panel">
      {/* Compare Visits button — top-right, doctor only */}
      {isDoctor && visits.length >= 2 && (
        <CompareVisits visits={visits} isDoctor={isDoctor} />
      )}

      {/* 1. Problem List */}
      <ProblemList visits={visits} patientId={patient.id} isDoctor={isDoctor} />

      {/* 2. Complaint Trend */}
      <ComplaintTrendTimeline visits={visits} />

      {/* 4. Vaccination Table */}
      <VaccinationTable patient={patient} isDoctor={isDoctor} />
    </div>
  );
}
