/**
 * AdmissionTimeline — Hierarchical view of admission records + SOAP daily progress sub-entries.
 * Used inside the History tab of PatientDashboard.
 * Shows:
 *   - Each admission as a top-level expandable card
 *   - Under each admission: a timeline of daily progress note entries (from DailyProgressNote)
 *   - If multiple admissions exist, each gets its own group
 */
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Stethoscope,
  User,
} from "lucide-react";
import { useState } from "react";
import { STAFF_ROLE_LABELS } from "../types";
import type { StaffRole } from "../types";
import type { AdmissionHistoryRecord } from "./AdmissionHistory";
import { loadAdmissionHistory } from "./AdmissionHistory";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyNoteEntry {
  date: string;
  entryType: "Morning Round" | "Evening Round" | "Emergency";
  authorName: string;
  authorRole: StaffRole;
  assessment: string;
  assessmentStatus: string;
  chiefComplaintsToday: string;
  activeDiagnoses: string[];
  planItems: string[];
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadDailyNoteEntries(
  doctorEmail: string,
  patientId: string,
): DailyNoteEntry[] {
  const entries: DailyNoteEntry[] = [];
  try {
    // Scan all localStorage keys that match daily_note_{email}_{patientId}_{date}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const prefix = `daily_note_${doctorEmail}_${patientId}_`;
      if (!key.startsWith(prefix)) continue;
      const date = key.slice(prefix.length);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw) as {
          assessment?: string;
          assessmentStatus?: string;
          chiefComplaintsToday?: string;
          activeDiagnoses?: Array<{ name: string; status: string }>;
          planItems?: Array<{ description: string }>;
        };
        entries.push({
          date,
          entryType: "Morning Round",
          authorName: "Clinical Staff",
          authorRole: "doctor",
          assessment: data.assessment || "",
          assessmentStatus: data.assessmentStatus || "Stable",
          chiefComplaintsToday: data.chiefComplaintsToday || "",
          activeDiagnoses: (data.activeDiagnoses || [])
            .filter((d) => d.status === "active")
            .map((d) => d.name),
          planItems: (data.planItems || []).map((p) => p.description),
        });
      } catch {}
    }
    // Sort by date descending
    entries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  } catch {}
  return entries;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DailyProgressSubItem({
  entry,
}: {
  entry: DailyNoteEntry;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    {
      Improving: "bg-green-100 text-green-700",
      Worsening: "bg-red-100 text-red-700",
      Stable: "bg-amber-100 text-amber-700",
    }[entry.assessmentStatus] ?? "bg-gray-100 text-gray-600";

  return (
    <div
      className="border border-indigo-100 rounded-lg overflow-hidden"
      data-ocid="admission_timeline.progress_note_item"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50/60 hover:bg-indigo-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Activity className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-gray-800">
                {format(new Date(entry.date), "d MMM yyyy")}
              </p>
              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-0 px-1.5 py-0">
                {entry.entryType}
              </Badge>
              <Badge
                className={`text-[10px] border-0 px-1.5 py-0 ${statusColor}`}
              >
                {entry.assessmentStatus}
              </Badge>
            </div>
            {entry.activeDiagnoses.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {entry.activeDiagnoses.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 hidden sm:inline">
            <User className="w-3 h-3 inline mr-1" />
            {entry.authorName} ·{" "}
            {STAFF_ROLE_LABELS[entry.authorRole] ?? entry.authorRole}
          </span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 bg-white">
          {entry.chiefComplaintsToday && (
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">
                S — Subjective
              </p>
              <p className="text-sm text-gray-700">
                {entry.chiefComplaintsToday}
              </p>
            </div>
          )}
          {entry.assessment && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">
                A — Assessment
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {entry.assessment}
              </p>
            </div>
          )}
          {entry.planItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-indigo-700 mb-1">
                P — Plan
              </p>
              <ul className="space-y-0.5">
                {entry.planItems.map((item) => (
                  <li
                    key={item}
                    className="text-xs text-gray-600 flex items-start gap-1.5"
                  >
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admission Group Card ──────────────────────────────────────────────────────

function AdmissionGroupCard({
  record,
  progressNotes,
}: {
  record: AdmissionHistoryRecord;
  progressNotes: DailyNoteEntry[];
}) {
  const [expanded, setExpanded] = useState(true);

  const isLocked = record.status === "complete";

  return (
    <div
      className="border rounded-xl overflow-hidden shadow-sm"
      style={{ borderColor: isLocked ? "#d1d5db" : "#fcd34d" }}
      data-ocid="admission_timeline.admission_group"
    >
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
          isLocked
            ? "bg-gray-50 hover:bg-gray-100"
            : "bg-amber-50 hover:bg-amber-100"
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-800">
                Admission — {format(new Date(record.admittedOn), "d MMM yyyy")}
              </p>
              {isLocked ? (
                <Badge className="text-xs bg-gray-100 text-gray-600 border border-gray-300">
                  Locked
                </Badge>
              ) : (
                <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-300">
                  Draft
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <p className="text-xs text-gray-400">
                By {record.admittedBy} ·{" "}
                {STAFF_ROLE_LABELS[record.admittedByRole] ??
                  record.admittedByRole}
              </p>
              {record.hospitalName && (
                <p className="text-xs text-gray-400">
                  📍 {record.hospitalName}
                  {record.ward ? ` · Ward ${record.ward}` : ""}
                  {record.bed ? ` · Bed ${record.bed}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">
            <Clock className="w-3 h-3 inline mr-1" />
            {progressNotes.length} progress note
            {progressNotes.length !== 1 ? "s" : ""}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-5 space-y-4 bg-white">
          {/* Admission summary */}
          {record.provisionalDiagnosis && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-purple-800 uppercase mb-1">
                Provisional Diagnosis
              </p>
              <p className="text-sm text-gray-700">
                {record.provisionalDiagnosis}
              </p>
            </div>
          )}

          {record.chiefComplaints.some((c) => c.complaint) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-blue-800 uppercase mb-1">
                Chief Complaints
              </p>
              <div className="flex flex-wrap gap-1.5">
                {record.chiefComplaints
                  .filter((c) => c.complaint)
                  .map((c) => (
                    <span
                      key={`${c.complaint}-${c.duration}`}
                      className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5"
                    >
                      {c.complaint}
                      {c.duration ? ` (${c.duration})` : ""}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {record.initialPlan && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-indigo-800 uppercase mb-1">
                Initial Plan
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {record.initialPlan}
              </p>
            </div>
          )}

          {/* Daily progress sub-items */}
          {progressNotes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" />
                Daily Progress Notes ({progressNotes.length})
              </p>
              <div className="space-y-2 pl-4 border-l-2 border-indigo-100">
                {progressNotes.map((note) => (
                  <DailyProgressSubItem
                    key={`${note.date}-${note.entryType}`}
                    entry={note}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <FileText className="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">
                No daily progress notes recorded yet
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AdmissionTimelineProps {
  patientId: string;
  doctorEmail: string;
}

export default function AdmissionTimeline({
  patientId,
  doctorEmail,
}: AdmissionTimelineProps) {
  const admissions = loadAdmissionHistory(patientId);
  const progressNotes = loadDailyNoteEntries(doctorEmail, patientId);

  if (admissions.length === 0) {
    return (
      <div
        className="text-center py-8 bg-white rounded-xl border border-blue-100"
        data-ocid="admission_timeline.empty_state"
      >
        <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400 font-medium">
          No admissions on record
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Admission history is created when a patient is admitted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-ocid="admission_timeline.container">
      {admissions.map((record) => (
        <AdmissionGroupCard
          key={record.id}
          record={record}
          progressNotes={progressNotes}
        />
      ))}
    </div>
  );
}
