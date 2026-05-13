/**
 * PatientTimeline — Full chronological timeline of all events for a patient.
 * Aggregates from localStorage: visits, prescriptions, vitals, SOAP notes,
 * discharge, teleconsults, referrals, procedures, and registration event.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Filter,
  Pill,
  Stethoscope,
  UserCheck,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getDoctorEmail } from "../hooks/useQueries";
import type { Patient } from "../types";

// ── Event type definitions ────────────────────────────────────────────────────

type EventType =
  | "registration"
  | "visit"
  | "prescription"
  | "vitals"
  | "soap"
  | "discharge"
  | "teleconsult"
  | "referral"
  | "procedure";

interface TimelineEvent {
  id: string;
  type: EventType;
  date: Date;
  title: string;
  description: string;
  details?: Record<string, unknown>;
  badge?: string;
  subtype?: string;
}

const EVENT_CONFIG: Record<
  EventType,
  {
    color: string;
    bgColor: string;
    icon: React.ElementType;
    label: string;
    dotColor: string;
  }
> = {
  registration: {
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    icon: UserCheck,
    label: "Registration",
    dotColor: "bg-blue-500",
  },
  visit: {
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    icon: Stethoscope,
    label: "Visit",
    dotColor: "bg-green-500",
  },
  prescription: {
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    icon: Pill,
    label: "Prescription",
    dotColor: "bg-purple-500",
  },
  vitals: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: Activity,
    label: "Vitals",
    dotColor: "bg-yellow-500",
  },
  soap: {
    color: "text-indigo-700",
    bgColor: "bg-indigo-50 border-indigo-200",
    icon: FileText,
    label: "SOAP Note",
    dotColor: "bg-indigo-500",
  },
  discharge: {
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
    icon: AlertCircle,
    label: "Discharge",
    dotColor: "bg-gray-400",
  },
  teleconsult: {
    color: "text-cyan-700",
    bgColor: "bg-cyan-50 border-cyan-200",
    icon: Video,
    label: "Teleconsult",
    dotColor: "bg-cyan-500",
  },
  referral: {
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    icon: Calendar,
    label: "Referral",
    dotColor: "bg-orange-500",
  },
  procedure: {
    color: "text-pink-700",
    bgColor: "bg-pink-50 border-pink-200",
    icon: Clock,
    label: "Procedure",
    dotColor: "bg-pink-500",
  },
};

// ── Event loaders ─────────────────────────────────────────────────────────────

function loadAllEvents(patientId: bigint, patient: Patient): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const patStr = String(patientId);
  const email = getDoctorEmail() || "default";

  // 1. Registration event
  events.push({
    id: `reg-${patStr}`,
    type: "registration",
    date: new Date(Number(patient.createdAt / 1_000_000n)),
    title: "Patient Registered",
    description: `${patient.fullName} registered — Reg. No. ${patient.registerNumber ?? "N/A"}`,
    details: {
      name: patient.fullName,
      gender: patient.gender,
      blood_group: patient.bloodGroup,
    },
  });

  // 2. Visits
  try {
    const raw = localStorage.getItem(`visits_${email}`);
    const allVisits: Array<Record<string, unknown>> = raw
      ? JSON.parse(raw)
      : [];
    const patVisits = allVisits.filter((v) => String(v.patientId) === patStr);
    for (const v of patVisits) {
      const dateVal =
        typeof v.visitDate === "bigint"
          ? Number((v.visitDate as bigint) / 1_000_000n)
          : Number(v.visitDate ?? v.createdAt ?? Date.now());
      const isAdmitted =
        v.visitType === "admitted" || v.visitType === "inpatient";
      events.push({
        id: `visit-${String(v.id)}`,
        type: "visit",
        date: new Date(dateVal),
        title: isAdmitted ? "Inpatient Admission" : "OPD Visit",
        description:
          (v.diagnosis as string) || (v.chiefComplaint as string) || "Visit",
        subtype: isAdmitted ? "admitted" : "opd",
        details: v,
        badge: v.visitType as string,
      });
    }
  } catch {}

  // 3. Prescriptions
  try {
    const raw = localStorage.getItem(`prescriptions_${email}`);
    const allRx: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    const patRx = allRx.filter((r) => String(r.patientId) === patStr);
    for (const rx of patRx) {
      const dateVal =
        typeof rx.prescriptionDate === "bigint"
          ? Number((rx.prescriptionDate as bigint) / 1_000_000n)
          : Number(rx.prescriptionDate ?? rx.createdAt ?? Date.now());
      const meds = (rx.medications as Array<Record<string, unknown>>) ?? [];
      events.push({
        id: `rx-${String(rx.id)}`,
        type: "prescription",
        date: new Date(dateVal),
        title: "Prescription",
        description: [
          String(meds.length),
          "drug",
          meds.length !== 1 ? "s" : "",
          " prescribed",
          rx.diagnosis ? ` — ${String(rx.diagnosis)}` : "",
        ].join(""),
        details: rx,
        badge: (rx as Record<string, unknown>).isEmergency
          ? "EMERGENCY"
          : undefined,
      });
    }
  } catch {}

  // 4. Vitals (from observation-style records)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        !key?.includes(`vitals_${patStr}`) &&
        !key?.includes(`vital_record_${patStr}`)
      )
        continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed: Array<Record<string, unknown>> = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const entry of parsed) {
          const dateStr = (entry.date ?? entry.recordedAt ?? entry.timestamp) as
            | string
            | undefined;
          if (!dateStr) continue;
          events.push({
            id: `vitals-${String(entry.id ?? dateStr)}`,
            type: "vitals",
            date: new Date(dateStr),
            title: "Vitals Recorded",
            description:
              [
                entry.bloodPressure
                  ? `BP: ${String(entry.bloodPressure)}`
                  : null,
                entry.pulse ? `Pulse: ${String(entry.pulse)}` : null,
                entry.oxygenSaturation
                  ? `SpO₂: ${String(entry.oxygenSaturation)}%`
                  : null,
              ]
                .filter(Boolean)
                .join(" • ") || "Vitals recorded",
            details: entry,
          });
        }
      } catch {}
    }
  } catch {}

  // 5. Daily Progress Notes (SOAP)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        !key?.includes("dailyNotes") &&
        !key?.includes(`soap_notes_${patStr}`)
      )
        continue;
      if (!key?.includes(patStr)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed: Array<Record<string, unknown>> = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const note of parsed) {
          const dateStr = (note.date ?? note.createdAt ?? note.timestamp) as
            | string
            | undefined;
          if (!dateStr) continue;
          let content: Record<string, unknown> = {};
          if (note.content && typeof note.content === "string") {
            try {
              content = JSON.parse(note.content);
            } catch {}
          } else if (note.content && typeof note.content === "object") {
            content = note.content as Record<string, unknown>;
          }
          events.push({
            id: `soap-${String(note.id ?? dateStr)}`,
            type: "soap",
            date: new Date(dateStr),
            title:
              note.noteSubtype === "quick_review"
                ? "Quick Review"
                : "SOAP Note",
            description:
              (content.assessment as string) ||
              (content.subjective as string) ||
              "Progress note",
            details: content,
          });
        }
      } catch {}
    }
  } catch {}

  // 6. Discharge records
  try {
    const raw = localStorage.getItem(`admissionHistory_${patStr}`);
    const records: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    for (const rec of records) {
      if (rec.dischargedOn) {
        events.push({
          id: `discharge-${String(rec.id)}`,
          type: "discharge",
          date: new Date(String(rec.dischargedOn)),
          title: "Discharged",
          description: `Discharged from ${String(rec.hospitalName ?? "hospital")}${rec.ward ? ` — Ward ${String(rec.ward)}` : ""}`,
          details: rec,
        });
      }
    }
  } catch {}

  // 7. Teleconsults
  try {
    const raw = localStorage.getItem(`teleconsults_${patStr}`);
    const tcList: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    for (const tc of tcList) {
      events.push({
        id: `tc-${String(tc.id ?? tc.date)}`,
        type: "teleconsult",
        date: new Date(String(tc.date ?? tc.createdAt ?? Date.now())),
        title: "Teleconsult",
        description:
          (tc.chiefComplaint as string) ||
          (tc.notes as string) ||
          "Teleconsultation",
        details: tc,
      });
    }
  } catch {}

  // 8. Referrals
  try {
    const raw = localStorage.getItem(`referrals_${email}_${patStr}`);
    const refList: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    for (const ref of refList) {
      events.push({
        id: `ref-${String(ref.id ?? ref.date)}`,
        type: "referral",
        date: new Date(String(ref.date ?? ref.createdAt ?? Date.now())),
        title: "Referral",
        description: `Referred to ${String(ref.specialist ?? ref.specialistName ?? "specialist")}${ref.hospital ? ` — ${String(ref.hospital)}` : ""}`,
        details: ref,
        badge: ref.urgency as string | undefined,
      });
    }
  } catch {}

  // 9. Procedures
  try {
    const raw = localStorage.getItem(`procedureLogs_${patStr}`);
    const procList: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    for (const proc of procList) {
      events.push({
        id: `proc-${String(proc.id ?? proc.date)}`,
        type: "procedure",
        date: new Date(String(proc.date ?? proc.createdAt ?? Date.now())),
        title: "Procedure",
        description: `${String(proc.procedureName ?? proc.name ?? "Procedure")} — ${String(proc.outcome ?? proc.status ?? "")}`,
        details: proc,
      });
    }
  } catch {}

  return events;
}

// ── Timeline item ─────────────────────────────────────────────────────────────

function TimelineItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <div
      className="flex gap-3"
      data-ocid={`patient_timeline.event.${event.type}`}
    >
      {/* Dot + line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-8 h-8 rounded-full ${cfg.dotColor} flex items-center justify-center shadow-sm`}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className={`flex-1 border rounded-xl px-4 py-3 mb-3 ${cfg.bgColor}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm ${cfg.color}`}>
                {event.title}
              </span>
              <Badge
                className={`text-[10px] border-0 px-1.5 py-0 ${cfg.bgColor} ${cfg.color}`}
              >
                {cfg.label}
              </Badge>
              {event.badge && (
                <Badge className="text-[10px] border-0 px-1.5 py-0 bg-red-100 text-red-700">
                  {event.badge}
                </Badge>
              )}
              {event.type === "visit" && event.subtype === "admitted" && (
                <Badge className="text-[10px] border-0 px-1.5 py-0 bg-teal-100 text-teal-700">
                  Admitted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {event.description}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(event.date, "dd MMM yyyy, HH:mm")}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`${cfg.color} hover:opacity-70`}
              aria-label={expanded ? "Collapse" : "Expand"}
              data-ocid="patient_timeline.event.toggle"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && event.details && (
          <div className="mt-3 pt-3 border-t border-current/10 space-y-1">
            {Object.entries(event.details)
              .filter(
                ([k, v]) =>
                  v !== null &&
                  v !== undefined &&
                  String(v).trim() !== "" &&
                  !["id", "patientId", "visitId", "rxId"].includes(k),
              )
              .slice(0, 12)
              .map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span
                    className={`font-semibold capitalize ${cfg.color} shrink-0`}
                  >
                    {k.replace(/([A-Z])/g, " $1").trim()}:
                  </span>
                  <span className="text-muted-foreground break-words">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface PatientTimelineProps {
  patientId: bigint;
  patient: Patient;
}

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG) as EventType[];

export default function PatientTimeline({
  patientId,
  patient,
}: PatientTimelineProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<EventType>>(
    new Set(ALL_EVENT_TYPES),
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showFilters, setShowFilters] = useState(false);

  const allEvents = useMemo(
    () => loadAllEvents(patientId, patient),
    [patientId, patient],
  );

  const filteredEvents = useMemo(() => {
    let events = allEvents.filter((e) => selectedTypes.has(e.type));

    if (dateFrom) {
      const from = new Date(dateFrom);
      events = events.filter((e) => e.date >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      events = events.filter((e) => e.date <= to);
    }

    return [...events].sort((a, b) =>
      sortOrder === "newest"
        ? b.date.getTime() - a.date.getTime()
        : a.date.getTime() - b.date.getTime(),
    );
  }, [allEvents, selectedTypes, dateFrom, dateTo, sortOrder]);

  const toggleType = (type: EventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedTypes(new Set(ALL_EVENT_TYPES));
  };

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">
            Patient Timeline
          </span>
          <Badge className="text-xs border-0 bg-muted text-muted-foreground">
            {filteredEvents.length} events
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              setSortOrder((p) => (p === "newest" ? "oldest" : "newest"))
            }
            className="text-xs bg-muted/60 hover:bg-muted text-foreground px-2.5 py-1 rounded-full border border-border transition-colors"
            data-ocid="patient_timeline.sort_toggle"
          >
            {sortOrder === "newest" ? "⬇️ Newest First" : "⬆️ Oldest First"}
          </button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setShowFilters(!showFilters)}
            data-ocid="patient_timeline.filter.toggle"
          >
            <Filter className="w-3 h-3" />
            Filters
            {(dateFrom ||
              dateTo ||
              selectedTypes.size < ALL_EVENT_TYPES.length) && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            )}
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full mt-1 border border-input rounded-lg px-3 py-1.5 text-sm bg-background"
                data-ocid="patient_timeline.filter.date_from.input"
              />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full mt-1 border border-input rounded-lg px-3 py-1.5 text-sm bg-background"
                data-ocid="patient_timeline.filter.date_to.input"
              />
            </div>
          </div>

          {/* Event types */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Event Types
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENT_TYPES.map((type) => {
                const cfg = EVENT_CONFIG[type];
                return (
                  <div
                    key={type}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <Checkbox
                      id={`timeline-filter-${type}`}
                      checked={selectedTypes.has(type)}
                      onCheckedChange={() => toggleType(type)}
                      data-ocid={`patient_timeline.filter.type.${type}`}
                    />
                    <Label
                      htmlFor={`timeline-filter-${type}`}
                      className={`text-xs font-medium cursor-pointer ${cfg.color}`}
                    >
                      {cfg.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={resetFilters}
              className="text-xs gap-1.5"
              data-ocid="patient_timeline.filter.reset_button"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </Button>
          </div>
        </div>
      )}

      {/* Timeline list */}
      {filteredEvents.length === 0 ? (
        <div
          className="text-center py-12 bg-card border border-border rounded-xl"
          data-ocid="patient_timeline.empty_state"
        >
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">
            No events found
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Try adjusting the date range or event type filters
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={resetFilters}
            className="mt-3 text-xs"
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="pl-0">
          {filteredEvents.map((event, index) => (
            <TimelineItem
              key={event.id}
              event={event}
              isLast={index === filteredEvents.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
