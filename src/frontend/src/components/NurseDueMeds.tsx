/**
 * NurseDueMeds — "Due Meds Now" dashboard card for Nurse and Intern Doctor roles.
 * Shows all admitted patients' medications due within the current hour.
 * Nurse/intern can mark each drug as Given / Not Given / Delayed.
 * When a drug is "Not Given" 2+ consecutive times → escalation to Consultant.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Pill, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface MedAdminRecord {
  id: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  patientId: string;
  patientName: string;
  scheduledTime: string;
  actualTime: string | null;
  status: "pending" | "given" | "not_given" | "delayed";
  recordedBy: string;
  recordedByRole: string;
  date: string; // YYYY-MM-DD
  reason?: string; // reason for not_given
}

export interface MissedDoseEscalation {
  type: "missed_dose_escalation";
  patientId: string;
  patientName: string;
  drugName: string;
  missedCount: number;
  timestamp: string;
  consultantEmail: string;
  acknowledged: boolean;
}

interface DueMedRow {
  patientId: string;
  patientName: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  scheduledTime: string;
  reminderId: string;
  existingRecord?: MedAdminRecord;
}

export const ESCALATION_KEY = "missed_dose_escalations";

export function loadEscalations(): MissedDoseEscalation[] {
  try {
    const raw = localStorage.getItem(ESCALATION_KEY);
    if (raw) return JSON.parse(raw) as MissedDoseEscalation[];
  } catch {}
  return [];
}

export function saveEscalation(esc: MissedDoseEscalation) {
  const all = loadEscalations();
  const idx = all.findIndex(
    (e) => e.patientId === esc.patientId && e.drugName === esc.drugName,
  );
  if (idx >= 0) {
    all[idx] = esc;
  } else {
    all.push(esc);
  }
  localStorage.setItem(ESCALATION_KEY, JSON.stringify(all));
}

export function acknowledgeEscalation(
  patientId: string,
  drugName: string,
): void {
  const all = loadEscalations();
  const idx = all.findIndex(
    (e) => e.patientId === patientId && e.drugName === drugName,
  );
  if (idx >= 0) {
    all[idx].acknowledged = true;
    localStorage.setItem(ESCALATION_KEY, JSON.stringify(all));
  }
}

export function getMedAdminKey(patientId: string, date: string) {
  return `medAdminRecord_${patientId}_${date}`;
}

export function loadMedAdminRecords(
  patientId: string,
  date: string,
): MedAdminRecord[] {
  try {
    const raw = localStorage.getItem(getMedAdminKey(patientId, date));
    if (raw) return JSON.parse(raw) as MedAdminRecord[];
  } catch {}
  return [];
}

export function saveMedAdminRecord(record: MedAdminRecord) {
  const key = getMedAdminKey(record.patientId, record.date);
  const existing = loadMedAdminRecords(record.patientId, record.date);
  const idx = existing.findIndex(
    (r) =>
      r.drugName === record.drugName &&
      r.scheduledTime === record.scheduledTime,
  );
  if (idx >= 0) {
    existing[idx] = record;
  } else {
    existing.push(record);
  }
  localStorage.setItem(key, JSON.stringify(existing));
}

/** Count consecutive "not_given" entries across all dates for a drug/patient */
function countConsecutiveNotGiven(patientId: string, drugName: string): number {
  const allRecords: MedAdminRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(`medAdminRecord_${patientId}_`)) continue;
    try {
      const arr = JSON.parse(
        localStorage.getItem(k) || "[]",
      ) as MedAdminRecord[];
      allRecords.push(...arr.filter((r) => r.drugName === drugName));
    } catch {}
  }
  // Sort by date + scheduledTime ascending
  allRecords.sort((a, b) => {
    const da = `${a.date} ${a.scheduledTime}`;
    const db = `${b.date} ${b.scheduledTime}`;
    return da.localeCompare(db);
  });
  // Count consecutive not_given from the end
  let count = 0;
  for (let i = allRecords.length - 1; i >= 0; i--) {
    if (allRecords[i].status === "not_given") {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/** Play an audible alarm tone */
function playAlarm() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  } catch {}
}

/** Parse frequency string like "1+1+1", "1+0+1", "0+0+1", "1+0+0" into times */
export function frequencyToTimes(frequency: string): string[] {
  const SCHEDULES: Record<string, string[]> = {
    "1+0+0": ["08:00"],
    "0+1+0": ["14:00"],
    "0+0+1": ["20:00"],
    "1+1+0": ["08:00", "14:00"],
    "1+0+1": ["08:00", "20:00"],
    "0+1+1": ["14:00", "20:00"],
    "1+1+1": ["08:00", "14:00", "20:00"],
    "1+1+1+1": ["06:00", "12:00", "18:00", "22:00"],
  };
  if (SCHEDULES[frequency]) return SCHEDULES[frequency];
  const lower = frequency.toLowerCase();
  if (lower.includes("once") || lower.includes("od")) return ["08:00"];
  if (
    lower.includes("bd") ||
    lower.includes("twice") ||
    lower.includes("12 hourly")
  )
    return ["08:00", "20:00"];
  if (
    lower.includes("tds") ||
    lower.includes("three") ||
    lower.includes("8 hourly")
  )
    return ["08:00", "14:00", "20:00"];
  if (
    lower.includes("qds") ||
    lower.includes("four") ||
    lower.includes("6 hourly")
  )
    return ["06:00", "12:00", "18:00", "22:00"];
  if (lower.includes("night") || lower.includes("hs")) return ["22:00"];
  return ["08:00"];
}

interface AllPatientData {
  id: unknown;
  fullName?: string;
  name?: string;
  isAdmitted?: boolean;
  patientType?: string;
  status?: string;
}

function loadAdmittedPatients(): Array<{ id: string; fullName: string }> {
  const patients: Array<{ id: string; fullName: string }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(
        localStorage.getItem(k) || "[]",
      ) as AllPatientData[];
      for (const p of arr) {
        if (
          p.isAdmitted ||
          p.patientType === "admitted" ||
          p.status === "Admitted"
        ) {
          const rawId = p.id;
          const pid =
            typeof rawId === "string" && rawId.startsWith("__bigint__")
              ? rawId.slice(10)
              : String(rawId);
          patients.push({
            id: pid,
            fullName: p.fullName || p.name || `Patient ${pid}`,
          });
        }
      }
    } catch {}
  }
  return patients;
}

interface ReminderRecord {
  id: string;
  patientId: string;
  drugName: string;
  times?: string[];
  reminderTimes?: string[];
  enabled?: boolean;
  status?: string;
  dose?: string;
  frequency?: string;
}

function loadAllReminders(): ReminderRecord[] {
  const seen = new Set<string>();
  const all: ReminderRecord[] = [];

  // Format 1: medicare_drug_reminders (App.tsx format)
  try {
    const raw = localStorage.getItem("medicare_drug_reminders");
    if (raw) {
      const arr = JSON.parse(raw) as ReminderRecord[];
      for (const r of arr) {
        const key = `${r.patientId}::${r.drugName}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(r);
        }
      }
    }
  } catch {}

  // Format 2: drugReminders_[patientId] (useQueries.ts format)
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("drugReminders_")) continue;
    try {
      const arr = JSON.parse(
        localStorage.getItem(k) || "[]",
      ) as ReminderRecord[];
      for (const r of arr) {
        const key = `${r.patientId}::${r.drugName}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(r);
        }
      }
    } catch {}
  }

  return all;
}

/** Resolve the assigned consultant's email for a patient */
function getConsultantEmail(patientId: string): string {
  try {
    const key = `patient_consultant_${patientId}`;
    return localStorage.getItem(key) ?? "consultant@clinic";
  } catch {}
  return "consultant@clinic";
}

interface NurseDueMedsProps {
  currentUserName: string;
  currentUserRole: string;
}

export default function NurseDueMeds({
  currentUserName,
  currentUserRole,
}: NurseDueMedsProps) {
  const [dueMeds, setDueMeds] = useState<DueMedRow[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  /** State for the "Not Given" reason dialog */
  const [notGivenRow, setNotGivenRow] = useState<DueMedRow | null>(null);
  const [notGivenReason, setNotGivenReason] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const nowHour = new Date().getHours();

  const loadDueMeds = useCallback(() => {
    const admittedPatients = loadAdmittedPatients();
    const allReminders = loadAllReminders();

    const patientMap: Record<string, string> = {};
    for (const p of admittedPatients) {
      patientMap[p.id] = p.fullName;
    }
    const admittedIds = new Set(admittedPatients.map((p) => p.id));

    const rows: DueMedRow[] = [];

    for (const reminder of allReminders) {
      const isEnabled =
        reminder.enabled !== false &&
        reminder.status !== "paused" &&
        reminder.status !== "completed";
      if (!isEnabled) continue;
      if (!admittedIds.has(reminder.patientId)) continue;

      let times: string[] = [];
      if (reminder.times?.length) {
        times = reminder.times;
      } else if (reminder.reminderTimes?.length) {
        times = reminder.reminderTimes;
      } else if (reminder.frequency) {
        times = frequencyToTimes(reminder.frequency);
      } else {
        times = ["08:00"];
      }

      for (const t of times) {
        const [hh] = t.split(":").map(Number);
        if (Math.abs(hh - nowHour) > 1) continue;

        const existingRecords = loadMedAdminRecords(reminder.patientId, today);
        const existingRecord = existingRecords.find(
          (r) => r.drugName === reminder.drugName && r.scheduledTime === t,
        );

        rows.push({
          patientId: reminder.patientId,
          patientName:
            patientMap[reminder.patientId] || `Patient ${reminder.patientId}`,
          drugName: reminder.drugName,
          dose: reminder.dose,
          frequency: reminder.frequency,
          scheduledTime: t,
          reminderId: `${reminder.id}-${t}`,
          existingRecord,
        });
      }
    }

    rows.sort((a, b) => {
      const aStatus = a.existingRecord?.status ?? "pending";
      const bStatus = b.existingRecord?.status ?? "pending";
      if (aStatus === "pending" && bStatus !== "pending") return -1;
      if (aStatus !== "pending" && bStatus === "pending") return 1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

    setDueMeds(rows);
    setLastRefresh(new Date());
  }, [nowHour, today]);

  useEffect(() => {
    loadDueMeds();
    const interval = setInterval(loadDueMeds, 30000);
    return () => clearInterval(interval);
  }, [loadDueMeds]);

  function recordStatus(
    row: DueMedRow,
    status: "given" | "not_given" | "delayed",
    reason?: string,
  ) {
    const record: MedAdminRecord = {
      id: `${row.patientId}-${row.drugName}-${row.scheduledTime}-${today}`,
      drugName: row.drugName,
      dose: row.dose,
      frequency: row.frequency,
      patientId: row.patientId,
      patientName: row.patientName,
      scheduledTime: row.scheduledTime,
      actualTime: status === "given" ? new Date().toLocaleTimeString() : null,
      status,
      recordedBy: currentUserName,
      recordedByRole: currentUserRole,
      date: today,
      ...(reason ? { reason } : {}),
    };
    saveMedAdminRecord(record);

    // Escalation check: if "not_given", count consecutive misses after saving
    if (status === "not_given") {
      const consecutive = countConsecutiveNotGiven(row.patientId, row.drugName);
      if (consecutive >= 2) {
        const consultantEmail = getConsultantEmail(row.patientId);
        const esc: MissedDoseEscalation = {
          type: "missed_dose_escalation",
          patientId: row.patientId,
          patientName: row.patientName,
          drugName: row.drugName,
          missedCount: consecutive,
          timestamp: new Date().toISOString(),
          consultantEmail,
          acknowledged: false,
        };
        saveEscalation(esc);
        playAlarm();
        toast.error(
          `⚠️ ESCALATION: ${row.drugName} missed ${consecutive}× for ${row.patientName} — Consultant notified`,
          {
            duration: 8000,
            id: `esc-${row.patientId}-${row.drugName}`,
          },
        );
      }
    }

    loadDueMeds();
  }

  const byPatient: Record<string, DueMedRow[]> = {};
  for (const row of dueMeds) {
    if (!byPatient[row.patientId]) byPatient[row.patientId] = [];
    byPatient[row.patientId].push(row);
  }

  const pendingCount = dueMeds.filter(
    (r) => !r.existingRecord || r.existingRecord.status === "pending",
  ).length;

  if (dueMeds.length === 0) {
    return (
      <div
        className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
        data-ocid="nurse_due_meds.empty_state"
      >
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">
            All medications administered
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No medications due within this hour.{" "}
            <button
              type="button"
              onClick={loadDueMeds}
              className="text-primary underline"
            >
              Refresh
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-ocid="nurse_due_meds.container"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-rose-50 border-b border-rose-200">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-rose-600" />
          <span className="font-semibold text-rose-800 text-sm">
            Due Medications
          </span>
          {pendingCount > 0 && (
            <Badge
              className="bg-rose-600 text-white text-xs ml-1"
              data-ocid="nurse_due_meds.badge"
            >
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={loadDueMeds}
          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
          data-ocid="nurse_due_meds.refresh_button"
        >
          <RefreshCw className="w-3 h-3" />
          {lastRefresh.toLocaleTimeString()}
        </button>
      </div>

      <div className="divide-y divide-border">
        {Object.entries(byPatient).map(([, rows]) => (
          <div key={rows[0].patientId} className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {rows[0].patientName}
            </p>
            <div className="space-y-2">
              {rows.map((row) => {
                const status = row.existingRecord?.status ?? "pending";
                return (
                  <div
                    key={row.reminderId}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 border",
                      status === "given" && "bg-green-50 border-green-200",
                      status === "not_given" && "bg-red-50 border-red-200",
                      status === "delayed" && "bg-orange-50 border-orange-200",
                      status === "pending" && "bg-muted/30 border-border",
                    )}
                    data-ocid={`nurse_due_meds.drug_row.${row.reminderId}`}
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {row.drugName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.scheduledTime}
                        {row.dose ? ` · ${row.dose}` : ""}
                        {row.frequency ? ` · ${row.frequency}` : ""}
                      </p>
                    </div>

                    {status === "given" ? (
                      <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Given
                      </span>
                    ) : status === "not_given" ? (
                      <span className="text-xs font-medium text-red-700 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Not Given
                      </span>
                    ) : status === "delayed" ? (
                      <span className="text-xs font-medium text-orange-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Delayed
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => recordStatus(row, "given")}
                          data-ocid={`nurse_due_meds.given_button.${row.reminderId}`}
                        >
                          ✅ Given
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => recordStatus(row, "delayed")}
                          data-ocid={`nurse_due_meds.delayed_button.${row.reminderId}`}
                        >
                          ⏱ Delayed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setNotGivenRow(row);
                            setNotGivenReason("");
                          }}
                          data-ocid={`nurse_due_meds.not_given_button.${row.reminderId}`}
                        >
                          ❌ Not Given
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Not Given Reason Dialog */}
      {notGivenRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-red-800 flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-600" />
              Reason for Not Giving —{" "}
              <span className="text-gray-700">{notGivenRow.drugName}</span>
            </h3>
            <select
              value={notGivenReason}
              onChange={(e) => setNotGivenReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
              data-ocid="nurse_due_meds.not_given_reason_select"
            >
              <option value="">— Select a reason —</option>
              <option value="Patient Refused">Patient Refused</option>
              <option value="Out for Imaging">Out for Imaging</option>
              <option value="Drug Unavailable">Drug Unavailable</option>
              <option value="Other">Other</option>
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setNotGivenRow(null);
                  setNotGivenReason("");
                }}
                data-ocid="nurse_due_meds.not_given_cancel_button"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={!notGivenReason}
                onClick={() => {
                  if (notGivenRow && notGivenReason) {
                    recordStatus(notGivenRow, "not_given", notGivenReason);
                    setNotGivenRow(null);
                    setNotGivenReason("");
                  }
                }}
                data-ocid="nurse_due_meds.not_given_confirm_button"
              >
                Confirm Not Given
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
