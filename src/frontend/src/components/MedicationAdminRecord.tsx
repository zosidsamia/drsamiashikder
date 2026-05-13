/**
 * MedicationAdminRecord (MAR) — Full shift-based medication administration record.
 * Per patient, per date, per shift. Nurses can record dose status inline.
 * Print-optimised output with shift summary.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Printer,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Prescription } from "../types";
import {
  frequencyToTimes,
  loadMedAdminRecords,
  saveMedAdminRecord,
} from "./NurseDueMeds";
import type { MedAdminRecord } from "./NurseDueMeds";

export type ShiftType = "morning" | "evening" | "night";

const SHIFT_HOURS: Record<ShiftType, [number, number]> = {
  morning: [6, 14],
  evening: [14, 22],
  night: [22, 6],
};

const STATUS_OPTIONS = [
  { value: "given", label: "✅ Given", color: "text-emerald-700" },
  { value: "held", label: "⏸ Held", color: "text-orange-700" },
  { value: "refused", label: "🚫 Refused", color: "text-red-700" },
  {
    value: "not_available",
    label: "❌ Not Available",
    color: "text-slate-600",
  },
] as const;

type MARStatus = "given" | "held" | "refused" | "not_available" | "pending";

interface DoseRow {
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  scheduledTime: string;
  status: MARStatus;
  nurseName?: string;
  timestamp?: string;
  reason?: string;
  recordId: string;
}

function isTimeInShift(timeStr: string, shift: ShiftType): boolean {
  const [hh] = timeStr.split(":").map(Number);
  const [start, end] = SHIFT_HOURS[shift];
  if (start < end) return hh >= start && hh < end;
  return hh >= start || hh < end;
}

function getMARKey(
  email: string,
  patientId: string,
  date: string,
  shift: ShiftType,
) {
  return `medAdmin_${email}_${patientId}_${date}_${shift}`;
}

function loadMARRecords(
  email: string,
  patientId: string,
  date: string,
  shift: ShiftType,
): Record<
  string,
  MARStatus & { nurseName?: string; timestamp?: string; reason?: string }
> {
  try {
    const raw = localStorage.getItem(getMARKey(email, patientId, date, shift));
    if (raw)
      return JSON.parse(raw) as Record<
        string,
        MARStatus & { nurseName?: string; timestamp?: string; reason?: string }
      >;
  } catch {}
  return {};
}

function saveMARRecord(
  email: string,
  patientId: string,
  date: string,
  shift: ShiftType,
  rowId: string,
  status: MARStatus,
  nurseName: string,
  reason?: string,
) {
  const all = loadMARRecords(email, patientId, date, shift);
  (all as Record<string, unknown>)[rowId] = {
    status,
    nurseName,
    timestamp: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    reason,
  };
  localStorage.setItem(
    getMARKey(email, patientId, date, shift),
    JSON.stringify(all),
  );

  // Also mirror to standard MedAdminRecord for NurseDueMeds compatibility
  const legacy: MedAdminRecord = {
    id: rowId,
    drugName: rowId.split("||")[0] ?? rowId,
    patientId,
    patientName: "",
    scheduledTime: rowId.split("||")[1] ?? "08:00",
    actualTime: status === "given" ? new Date().toLocaleTimeString() : null,
    status:
      status === "held" || status === "not_available"
        ? "not_given"
        : status === "refused"
          ? "not_given"
          : status === "pending"
            ? "pending"
            : (status as "given" | "not_given" | "delayed" | "pending"),
    recordedBy: nurseName,
    recordedByRole: "nurse",
    date,
    reason,
  };
  saveMedAdminRecord(legacy);
}

interface Props {
  patientId: string;
  patientName: string;
  currentShift: ShiftType;
  prescriptions: Prescription[];
  currentUserName: string;
  currentUserEmail: string;
}

export default function MedicationAdminRecord({
  patientId,
  patientName,
  currentShift,
  prescriptions,
  currentUserName,
  currentUserEmail,
}: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [marData, setMarData] = useState<Record<string, unknown>>({});
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<MARStatus>("given");
  const [pendingReason, setPendingReason] = useState("");

  // Load saved MAR data
  useEffect(() => {
    setMarData(
      loadMARRecords(currentUserEmail, patientId, today, currentShift),
    );
  }, [currentUserEmail, patientId, today, currentShift]);

  // Build dose rows from prescriptions
  const doseRows = useMemo<DoseRow[]>(() => {
    const rows: DoseRow[] = [];
    for (const rx of prescriptions) {
      for (const med of rx.medications) {
        const times = frequencyToTimes(med.frequency ?? "1+0+0");
        for (const t of times) {
          if (!isTimeInShift(t, currentShift)) continue;
          const rowId = `${med.name ?? med.drugName ?? "Drug"}||${t}`;
          const saved = (
            marData as Record<
              string,
              {
                status?: MARStatus;
                nurseName?: string;
                timestamp?: string;
                reason?: string;
              }
            >
          )[rowId];
          rows.push({
            drugName: med.drugName ?? med.name ?? "Unknown",
            dose: med.dose ?? "—",
            route: med.route ?? "Oral",
            frequency: med.frequency ?? "—",
            scheduledTime: t,
            status: saved?.status ?? "pending",
            nurseName: saved?.nurseName,
            timestamp: saved?.timestamp,
            reason: saved?.reason,
            recordId: rowId,
          });
        }
      }
    }
    return rows.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [prescriptions, currentShift, marData]);

  const given = doseRows.filter((r) => r.status === "given").length;
  const missed = doseRows.filter(
    (r) =>
      r.status === "held" ||
      r.status === "refused" ||
      r.status === "not_available",
  ).length;
  const pending = doseRows.filter((r) => r.status === "pending").length;

  function handleSaveStatus() {
    if (!editingRow) return;
    saveMARRecord(
      currentUserEmail,
      patientId,
      today,
      currentShift,
      editingRow,
      pendingStatus,
      currentUserName,
      pendingReason || undefined,
    );
    setMarData(
      loadMARRecords(currentUserEmail, patientId, today, currentShift),
    );
    setEditingRow(null);
    setPendingReason("");
    toast.success(`Recorded: ${pendingStatus.replace("_", " ")}`);
  }

  function printMAR() {
    const rows = doseRows
      .map(
        (r) => `
      <tr>
        <td>${r.drugName}</td>
        <td>${r.dose}</td>
        <td>${r.route}</td>
        <td>${r.frequency}</td>
        <td>${r.scheduledTime}</td>
        <td class="${r.status === "given" ? "status-given" : r.status === "pending" ? "status-pending" : "status-missed"}">${r.status.replace("_", " ")}</td>
        <td>${r.nurseName ?? "—"}</td>
        <td>${r.timestamp ?? "—"}</td>
        <td>${r.reason ?? "—"}</td>
      </tr>`,
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocked");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>MAR - ${patientName}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10pt;padding:16px}
        h1{font-size:14pt;margin:0}
        .header{margin-bottom:12px}
        table{width:100%;border-collapse:collapse;font-size:9pt}
        th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
        th{background:#f0fdf4;font-weight:600}
        tr{page-break-inside:avoid}
        .status-given{color:#065f46;font-weight:600}
        .status-missed{color:#991b1b;font-weight:600}
        .status-pending{color:#92400e}
        .summary{display:flex;gap:24px;margin-bottom:8px;font-size:10pt}
        .summary span{font-weight:600}
        @media print{@page{margin:1.5cm}}
      </style></head><body>
      <div class="header">
        <h1>Medication Administration Record</h1>
        <p><strong>Patient:</strong> ${patientName} &nbsp; <strong>Shift:</strong> ${currentShift.charAt(0).toUpperCase() + currentShift.slice(1)} &nbsp; <strong>Date:</strong> ${today}</p>
      </div>
      <div class="summary">
        <div>Given: <span style="color:#065f46">${given}</span></div>
        <div>Missed: <span style="color:#991b1b">${missed}</span></div>
        <div>Pending: <span style="color:#92400e">${pending}</span></div>
      </div>
      <table>
        <thead><tr><th>Drug</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Time</th><th>Status</th><th>Nurse</th><th>Given At</th><th>Reason</th></tr></thead>
        <tbody>${rows || "<tr><td colspan='9'>No medications for this shift</td></tr>"}</tbody>
      </table>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const shiftLabel =
    currentShift.charAt(0).toUpperCase() + currentShift.slice(1);
  const standardAdminRecords = loadMedAdminRecords(patientId, today);

  return (
    <div className="space-y-4" data-ocid="mar.panel">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {shiftLabel} Shift — Medication Administration Record
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{today}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={printMAR}
          className="gap-1.5"
          data-ocid="mar.print_button"
        >
          <Printer className="w-3.5 h-3.5" /> Print MAR
        </Button>
      </div>

      {/* Shift Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Given",
            count: given,
            color: "bg-emerald-50 border-emerald-200 text-emerald-800",
          },
          {
            label: "Missed/Held",
            count: missed,
            color: "bg-red-50 border-red-200 text-red-800",
          },
          {
            label: "Pending",
            count: pending,
            color: "bg-amber-50 border-amber-200 text-amber-800",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-4 py-3 text-center ${s.color}`}
            data-ocid={`mar.summary.${s.label.toLowerCase()}`}
          >
            <p className="text-2xl font-bold leading-none">{s.count}</p>
            <p className="text-xs mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Dose rows */}
      {doseRows.length === 0 ? (
        <div
          className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl"
          data-ocid="mar.empty_state"
        >
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            No medications scheduled for {shiftLabel.toLowerCase()} shift
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm" data-ocid="mar.table">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {[
                  "Drug / Dose",
                  "Route",
                  "Time",
                  "Status",
                  "Nurse / Time",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doseRows.map((row, idx) => (
                <tr
                  key={row.recordId}
                  className={cn(
                    "transition-colors",
                    row.status === "given" && "bg-emerald-50/40",
                    (row.status === "refused" ||
                      row.status === "held" ||
                      row.status === "not_available") &&
                      "bg-red-50/40",
                    row.status === "pending" && "hover:bg-muted/20",
                  )}
                  data-ocid={`mar.dose_row.${idx + 1}`}
                >
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">
                      {row.drugName}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.dose}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.route}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5">
                      {row.scheduledTime}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} reason={row.reason} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.nurseName ? (
                      <span>
                        {row.nurseName}
                        <br />
                        {row.timestamp}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRow(row.recordId);
                          setPendingStatus("given");
                          setPendingReason("");
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        data-ocid={`mar.record_button.${idx + 1}`}
                      >
                        Record <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline status editor */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-foreground text-sm">
                Record Administration
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drug: <strong>{editingRow.split("||")[0]}</strong> at{" "}
                <strong>{editingRow.split("||")[1]}</strong>
              </p>
            </div>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPendingStatus(opt.value)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                    pendingStatus === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30",
                    opt.color,
                  )}
                  data-ocid={`mar.status_option.${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(pendingStatus === "held" ||
              pendingStatus === "refused" ||
              pendingStatus === "not_available") && (
              <div>
                <label
                  htmlFor="mar-reason-input"
                  className="text-xs font-medium text-muted-foreground block mb-1"
                >
                  Reason (optional)
                </label>
                <input
                  id="mar-reason-input"
                  type="text"
                  placeholder="e.g. Patient refused, Drug unavailable..."
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  data-ocid="mar.reason_input"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditingRow(null)}
                data-ocid="mar.cancel_button"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSaveStatus}
                data-ocid="mar.save_button"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Previous records (from legacy NurseDueMeds) */}
      {standardAdminRecords.length > 0 && (
        <details className="border border-border rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted/20 select-none">
            Legacy Records from Due Meds ({standardAdminRecords.length})
          </summary>
          <div className="divide-y divide-border">
            {standardAdminRecords.map((r, i) => (
              <div
                key={r.id}
                className="px-4 py-2.5 flex items-center gap-3"
                data-ocid={`mar.legacy_row.${i + 1}`}
              >
                <div className="flex-1 text-sm">
                  <span className="font-medium">{r.drugName}</span>
                  <span className="text-muted-foreground ml-2">
                    @ {r.scheduledTime}
                  </span>
                </div>
                <StatusBadge status={r.status as MARStatus} />
                <span className="text-xs text-muted-foreground">
                  {r.recordedBy}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  reason,
}: { status: MARStatus; reason?: string }) {
  const configs: Record<
    MARStatus,
    { label: string; cls: string; icon: React.ElementType }
  > = {
    given: {
      label: "Given",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: CheckCircle2,
    },
    held: {
      label: "Held",
      cls: "bg-orange-100 text-orange-800 border-orange-200",
      icon: Clock,
    },
    refused: {
      label: "Refused",
      cls: "bg-red-100 text-red-800 border-red-200",
      icon: XCircle,
    },
    not_available: {
      label: "Not Available",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
      icon: XCircle,
    },
    pending: {
      label: "Pending",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
      icon: Clock,
    },
  };
  const cfg = configs[status] ?? configs.pending;
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className={cn("text-[10px] flex items-center gap-1 w-fit", cfg.cls)}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
      {reason && (
        <span className="text-[10px] text-muted-foreground">{reason}</span>
      )}
    </div>
  );
}
