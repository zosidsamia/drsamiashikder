/**
 * DischargeSummaryTab — Auto-generated discharge summary for admitted patients.
 * Enhanced: "Generate Discharge Summary" button pulls all localStorage data.
 * Finalize & Print locks the summary; Download PDF uses window.print().
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  CheckSquare,
  ClipboardCheck,
  Download,
  FileText,
  Lock,
  Printer,
  RefreshCw,
  Square,
  Unlock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  ClinicalNote,
  Encounter,
  Patient,
  Prescription,
  Visit,
} from "../types";

interface Props {
  patient: Patient;
  visits: Visit[];
  prescriptions: Prescription[];
  encounters: Encounter[];
  clinicalNotes: ClinicalNote[];
  canApproveDischarge: boolean;
  onApproveDischarge?: () => void;
}

interface ChecklistItem {
  label: string;
  key: string;
}

interface SavedDischargeSummary {
  diagnosisSummary: string;
  admittingDiagnosis: string;
  finalDiagnosis: string;
  proceduresText: string;
  hospitalCourse: string;
  adviceText: string;
  followUpDate: string;
  dischargeDate: string;
  admissionDate: string;
  losText: string;
  finalizedAt: string;
  finalizedBy: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { label: "Medications written", key: "meds" },
  { label: "Advice given", key: "advice" },
  { label: "Follow-up appointment booked", key: "followup" },
  { label: "Patient educated", key: "educated" },
];

function formatDate(ts: bigint) {
  return format(new Date(Number(ts / 1_000_000n)), "d MMM yyyy");
}

function getDoctorEmail(): string {
  try {
    const raw = localStorage.getItem("staff_auth");
    if (raw) return (JSON.parse(raw) as { email?: string }).email ?? "default";
  } catch {}
  return "default";
}

function loadAdmissionDate(patientId: string): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("admissionHistory_")) continue;
      const arr = JSON.parse(localStorage.getItem(k) ?? "[]") as Array<{
        patientId?: string;
        admittedOn?: string;
        status?: string;
      }>;
      const active = arr.find(
        (a) => String(a.patientId) === patientId && a.status === "active",
      );
      if (active?.admittedOn) return active.admittedOn;
    }
  } catch {}
  return null;
}

function loadProcedureLogs(patientId: string): string {
  try {
    const raw = localStorage.getItem(`procedureLogs_${patientId}`);
    if (!raw) return "No major procedures documented.";
    const logs = JSON.parse(raw) as Array<{
      name?: string;
      date?: string;
      outcome?: string;
    }>;
    if (!logs.length) return "No major procedures documented.";
    return logs
      .map(
        (l) =>
          `${l.name ?? "Procedure"}${l.date ? ` (${l.date})` : ""}${l.outcome ? ` — ${l.outcome}` : ""}`,
      )
      .join("; ");
  } catch {
    return "No major procedures documented.";
  }
}

function loadSOAPSummary(patientId: string, notes: ClinicalNote[]): string {
  // Try from clinicalNotes prop first
  const soap = notes
    .filter((n) => n.noteType === "SOAP" || n.noteType === "DailyProgress")
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(0, 3);
  if (soap.length > 0) {
    return soap
      .map((n) => {
        try {
          const parsed = JSON.parse(n.content) as {
            plan?: string;
            assessment?: string;
            subjective?: string;
          };
          const dateStr = format(
            new Date(Number(n.createdAt / 1_000_000n)),
            "d MMM",
          );
          return `${dateStr}: ${parsed.plan ?? parsed.assessment ?? n.content.slice(0, 100)}`;
        } catch {
          return n.content.slice(0, 100);
        }
      })
      .join(". ");
  }
  // Fallback: scan localStorage for SOAP notes
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.includes("soapNote") && !k?.includes("daily_progress")) continue;
      const arr = JSON.parse(localStorage.getItem(k) ?? "[]") as Array<{
        patientId?: string;
        plan?: string;
        date?: string;
      }>;
      const relevant = arr
        .filter((n) => String(n.patientId) === patientId)
        .slice(-3);
      if (relevant.length > 0)
        return relevant
          .map((n) => `${n.date ?? ""}: ${n.plan ?? ""}`)
          .join(". ");
    }
  } catch {}
  return "Clinical course under review.";
}

export default function DischargeSummaryTab({
  patient,
  visits,
  prescriptions,
  encounters,
  clinicalNotes,
  canApproveDischarge,
  onApproveDischarge,
}: Props) {
  const sortedVisits = [...visits].sort((a, b) =>
    Number(b.visitDate - a.visitDate),
  );
  const latestVisit = sortedVisits[0] ?? null;
  const latestRx = prescriptions.length
    ? [...prescriptions].sort((a, b) =>
        Number(b.prescriptionDate - a.prescriptionDate),
      )[0]
    : null;

  const activeEncounter =
    encounters.find((e) => e.status === "InProgress") ?? encounters[0];

  const age = patient.dateOfBirth
    ? Math.floor(
        (Date.now() - Number(patient.dateOfBirth / 1_000_000n)) /
          (365.25 * 24 * 3600 * 1000),
      )
    : null;

  const patientId = String(patient.id);

  // ── Check for saved/finalized summary ────────────────────────────────────
  const doctorEmail = getDoctorEmail();
  const savedKey = `dischargeSummaries_${doctorEmail}_${patientId}`;
  const existingSaved = (() => {
    try {
      const raw = localStorage.getItem(savedKey);
      return raw ? (JSON.parse(raw) as SavedDischargeSummary) : null;
    } catch {
      return null;
    }
  })();

  // ── State ─────────────────────────────────────────────────────────────────
  const [generated, setGenerated] = useState(!!existingSaved);
  const [finalized, setFinalized] = useState(!!existingSaved?.finalizedAt);

  const [admissionDate, setAdmissionDate] = useState(
    existingSaved?.admissionDate ??
      loadAdmissionDate(patientId) ??
      (activeEncounter ? formatDate(activeEncounter.startDate) : ""),
  );
  const [dischargeDate, setDischargeDate] = useState(
    existingSaved?.dischargeDate ?? new Date().toISOString().split("T")[0],
  );
  const [admittingDiagnosis, setAdmittingDiagnosis] = useState(
    existingSaved?.admittingDiagnosis ??
      (sortedVisits.length > 1
        ? (sortedVisits[sortedVisits.length - 1]?.diagnosis ?? "—")
        : (latestVisit?.diagnosis ?? "—")),
  );
  const [finalDiagnosis, setFinalDiagnosis] = useState(
    existingSaved?.finalDiagnosis ?? latestVisit?.diagnosis ?? "—",
  );
  const [proceduresText, setProceduresText] = useState(
    existingSaved?.proceduresText ?? loadProcedureLogs(patientId),
  );
  const [hospitalCourse, setHospitalCourse] = useState(
    existingSaved?.hospitalCourse ?? loadSOAPSummary(patientId, clinicalNotes),
  );
  const [followUpDate, setFollowUpDate] = useState(
    existingSaved?.followUpDate ?? "",
  );
  const [adviceText, setAdviceText] = useState(
    existingSaved?.adviceText ??
      latestRx?.notes ??
      "Continue prescribed medications. Maintain follow-up schedule.",
  );
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    meds: !!latestRx?.medications.length,
    advice: true,
    followup: false,
    educated: true,
  });

  // ── Calculations ──────────────────────────────────────────────────────────
  const losText = (() => {
    try {
      if (admissionDate && dischargeDate) {
        const start = new Date(admissionDate).getTime();
        const end = new Date(dischargeDate).getTime();
        const days = Math.round((end - start) / 86_400_000);
        return `${days} day${days !== 1 ? "s" : ""}`;
      }
    } catch {}
    return "—";
  })();

  // ── Investigation rows ────────────────────────────────────────────────────
  function getInvRows(): Array<{
    date: string;
    name: string;
    result: string;
    unit?: string;
  }> {
    const rows: Array<{
      date: string;
      name: string;
      result: string;
      unit?: string;
    }> = [];
    for (const v of sortedVisits) {
      try {
        const raw = localStorage.getItem(
          `visit_form_data_${v.id}_${doctorEmail}`,
        );
        if (!raw) continue;
        const data = JSON.parse(raw) as {
          previous_investigation_rows?: typeof rows;
        };
        if (Array.isArray(data.previous_investigation_rows)) {
          rows.push(...data.previous_investigation_rows.slice(0, 3));
        }
      } catch {}
    }
    return rows.slice(0, 6);
  }
  const invRows = getInvRows();

  const toggleCheck = (key: string) =>
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Generate ──────────────────────────────────────────────────────────────
  function handleGenerate() {
    // Re-pull from localStorage in case data was updated
    const admDate = loadAdmissionDate(patientId);
    if (admDate) setAdmissionDate(admDate);
    const soapSummary = loadSOAPSummary(patientId, clinicalNotes);
    setHospitalCourse(soapSummary);
    setProceduresText(loadProcedureLogs(patientId));
    setGenerated(true);
    toast.success("Discharge summary generated from patient data");
  }

  // ── Finalize ──────────────────────────────────────────────────────────────
  function handleFinalize() {
    const summary: SavedDischargeSummary = {
      diagnosisSummary: finalDiagnosis,
      admittingDiagnosis,
      finalDiagnosis,
      proceduresText,
      hospitalCourse,
      adviceText,
      followUpDate,
      dischargeDate,
      admissionDate,
      losText,
      finalizedAt: new Date().toISOString(),
      finalizedBy: doctorEmail,
    };
    try {
      localStorage.setItem(savedKey, JSON.stringify(summary));
    } catch {}
    setFinalized(true);
    toast.success("Discharge summary finalized and saved");
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  function printSummary() {
    const meds = latestRx?.medications.length
      ? latestRx.medications
          .map((m, i) => {
            const form =
              ((m as Record<string, unknown>).drugForm as string) ?? "";
            const name =
              ((m as Record<string, unknown>).drugName as string) || m.name;
            const line1 = `${i + 1}. ${form} ${name} ${m.dose}`.trim();
            const line2 = `&nbsp;&nbsp;${m.frequency} – ${m.duration}${m.instructions ? ` – ${m.instructions}` : ""}`;
            return `<p style="margin:2px 0 6px 12px">${line1}<br/><small style="color:#555">${line2}</small></p>`;
          })
          .join("")
      : "<p>No medications</p>";

    const invTable = invRows.length
      ? `<table border="1" cellpadding="5" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#f0f9ff"><th>Date</th><th>Investigation</th><th>Result</th><th>Unit</th></tr></thead>
          <tbody>${invRows.map((r) => `<tr><td>${r.date}</td><td>${r.name}</td><td>${r.result}</td><td>${r.unit ?? "—"}</td></tr>`).join("")}</tbody>
        </table>`
      : "<p>No investigations recorded</p>";

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocked");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Discharge Summary - ${patient.fullName}</title>
      <style>
        body{font-family:Georgia,serif;font-size:11pt;padding:24px;max-width:800px;margin:0 auto}
        h1{font-size:16pt;color:#0f766e;margin-bottom:4px}
        h2{font-size:12pt;color:#374151;margin:16px 0 6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
        p{margin:4px 0;line-height:1.5}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f9f9f9}
        .locked{color:#065f46;font-size:9pt}
        @media print{@page{margin:1.5cm}}
      </style></head>
      <body>
        <h1>Discharge Summary${finalized ? ' <span class="locked">✓ FINALIZED</span>' : ""}</h1>
        <p><strong>Patient:</strong> ${patient.fullName} | <strong>Reg No:</strong> ${((patient as Record<string, unknown>).registerNumber as string) ?? "—"} | <strong>Age/Sex:</strong> ${age ?? "—"} yrs / ${patient.gender}</p>
        <p><strong>Admission Date:</strong> ${admissionDate || "—"} | <strong>Discharge Date:</strong> ${dischargeDate} | <strong>Length of Stay:</strong> ${losText}</p>
        <h2>1. Diagnosis</h2>
        <p><strong>Admitting Diagnosis:</strong> ${admittingDiagnosis}</p>
        <p><strong>Final Diagnosis:</strong> ${finalDiagnosis}</p>
        <h2>2. Procedures Performed</h2><p>${proceduresText}</p>
        <h2>3. Hospital Course</h2><p>${hospitalCourse}</p>
        <h2>4. Discharge Medications</h2>${meds}
        <h2>5. Key Investigations</h2>${invTable}
        <h2>6. Follow-up Plan</h2><p>${followUpDate ? `Follow-up date: ${format(new Date(followUpDate), "d MMMM yyyy")}` : "Follow-up date to be arranged."}</p>
        <h2>7. Advice</h2><p>${adviceText}</p>
        <div style="margin-top:40px;display:flex;justify-content:space-between">
          <div><p>_____________________</p><p>Doctor's Signature &amp; Stamp</p></div>
          <div><p>_____________________</p><p>Date</p></div>
        </div>
        ${finalized ? `<p style="margin-top:16px;font-size:9pt;color:#6b7280">Finalized on ${new Date(existingSaved?.finalizedAt ?? "").toLocaleDateString()} by ${existingSaved?.finalizedBy ?? doctorEmail}</p>` : ""}
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
    toast.success("Discharge summary sent to print");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4" data-ocid="discharge_summary.panel">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-teal-600" />
            Discharge Summary
            {finalized && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] ml-1">
                <Lock className="w-3 h-3 mr-0.5" /> Finalized
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {finalized
              ? "Locked — print or download below"
              : "Auto-generated — edit before finalizing"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!generated && canApproveDischarge && (
            <Button
              size="sm"
              className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleGenerate}
              data-ocid="discharge_summary.generate_button"
            >
              <FileText className="w-3.5 h-3.5" />
              Generate Summary
            </Button>
          )}
          {generated && !finalized && canApproveDischarge && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleGenerate}
                data-ocid="discharge_summary.regenerate_button"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-generate
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleFinalize}
                data-ocid="discharge_summary.finalize_button"
              >
                <Lock className="w-3.5 h-3.5" /> Finalize
              </Button>
            </>
          )}
          {finalized && canApproveDischarge && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setFinalized(false);
                toast.info("Summary unlocked for editing");
              }}
              data-ocid="discharge_summary.unlock_button"
            >
              <Unlock className="w-3.5 h-3.5" /> Unlock
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={printSummary}
            data-ocid="discharge_summary.print_button"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={printSummary}
            data-ocid="discharge_summary.download_button"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          {canApproveDischarge && onApproveDischarge && (
            <Button
              size="sm"
              className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={onApproveDischarge}
              data-ocid="discharge_summary.approve_button"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> Approve Discharge
            </Button>
          )}
        </div>
      </div>

      {/* Patient info row */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Patient:</span>{" "}
          <span className="font-semibold">{patient.fullName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Age/Sex:</span>{" "}
          <span className="font-semibold">
            {age ?? "—"} yrs / {patient.gender}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Reg No:</span>{" "}
          <span className="font-mono font-semibold">
            {((patient as Record<string, unknown>).registerNumber as string) ??
              "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">LOS:</span>{" "}
          <span className="font-semibold">{losText}</span>
        </div>
      </div>

      {/* Admission / Discharge dates */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border-l-4 border-l-blue-400 pl-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
            Admission Date
          </p>
          <input
            type="text"
            disabled={finalized}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background disabled:opacity-70"
            value={admissionDate}
            onChange={(e) => setAdmissionDate(e.target.value)}
            data-ocid="discharge_summary.admission_date.input"
          />
        </div>
        <div className="border-l-4 border-l-teal-400 pl-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
            Discharge Date
          </p>
          <input
            type="date"
            disabled={finalized}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background disabled:opacity-70"
            value={dischargeDate}
            onChange={(e) => setDischargeDate(e.target.value)}
            data-ocid="discharge_summary.discharge_date.input"
          />
        </div>
      </div>

      {/* Diagnosis sections */}
      {[
        {
          label: "1. Admitting Diagnosis",
          value: admittingDiagnosis,
          setter: setAdmittingDiagnosis,
          color: "border-l-indigo-400",
          key: "admitting_diagnosis",
        },
        {
          label: "2. Final Diagnosis",
          value: finalDiagnosis,
          setter: setFinalDiagnosis,
          color: "border-l-blue-400",
          key: "final_diagnosis",
        },
        {
          label: "3. Procedures Performed",
          value: proceduresText,
          setter: setProceduresText,
          color: "border-l-purple-400",
          key: "procedures",
        },
      ].map((s) => (
        <div key={s.key} className={`border-l-4 pl-3 ${s.color}`}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
            {s.label}
          </p>
          <input
            disabled={finalized}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background disabled:opacity-70"
            value={s.value}
            onChange={(e) => s.setter(e.target.value)}
            data-ocid={`discharge_summary.${s.key}.input`}
          />
        </div>
      ))}

      {/* Hospital Course */}
      <div className="border-l-4 border-l-amber-400 pl-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
          4. Hospital Course (from SOAP notes)
        </p>
        <textarea
          disabled={finalized}
          className="w-full text-sm border border-input rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background disabled:opacity-70"
          rows={3}
          value={hospitalCourse}
          onChange={(e) => setHospitalCourse(e.target.value)}
          data-ocid="discharge_summary.course.input"
        />
      </div>

      {/* Discharge Medications */}
      <div className="border-l-4 border-l-teal-400 pl-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
          5. Discharge Medications
        </p>
        {latestRx?.medications.length ? (
          <div className="space-y-1.5">
            {latestRx.medications.map((m, i) => (
              <div
                key={`${m.name}-${i}`}
                className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  {i + 1}.{" "}
                  {((m as Record<string, unknown>).drugForm as string) ?? ""}{" "}
                  {((m as Record<string, unknown>).drugName as string) ||
                    m.name}{" "}
                  {m.dose}
                </span>
                <span className="text-muted-foreground ml-2">
                  — {m.frequency} × {m.duration}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No active medications.
          </p>
        )}
      </div>

      {/* Key Investigations */}
      {invRows.length > 0 && (
        <div className="border-l-4 border-l-amber-400 pl-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            6. Key Investigations
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50">
                  {["Date", "Investigation", "Result", "Unit"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-1.5 px-2 text-amber-700 font-semibold border border-amber-100"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invRows.map((r, i) => (
                  <tr
                    key={`${r.name}-${i}`}
                    className={i % 2 === 0 ? "bg-background" : "bg-amber-50/30"}
                  >
                    <td className="py-1 px-2 border border-amber-100">
                      {r.date || "—"}
                    </td>
                    <td className="py-1 px-2 border border-amber-100 font-medium">
                      {r.name}
                    </td>
                    <td className="py-1 px-2 border border-amber-100">
                      {r.result}
                    </td>
                    <td className="py-1 px-2 border border-amber-100">
                      {r.unit ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Follow-up Plan */}
      <div className="border-l-4 border-l-indigo-400 pl-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
          7. Follow-up Plan
        </p>
        <input
          type="date"
          disabled={finalized}
          className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background disabled:opacity-70"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          data-ocid="discharge_summary.followup.input"
        />
        {followUpDate && (
          <p className="text-xs text-teal-700 mt-1 font-medium">
            Follow-up on {format(new Date(followUpDate), "d MMMM yyyy")}
          </p>
        )}
      </div>

      {/* Advice */}
      <div className="border-l-4 border-l-emerald-400 pl-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
          8. Discharge Advice
        </p>
        <textarea
          disabled={finalized}
          className="w-full text-sm border border-input rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background disabled:opacity-70"
          rows={2}
          value={adviceText}
          onChange={(e) => setAdviceText(e.target.value)}
          data-ocid="discharge_summary.advice.input"
        />
      </div>

      {/* Checklist */}
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
          Discharge Checklist
        </p>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="flex items-center gap-2.5 w-full text-left"
              onClick={() => !finalized && toggleCheck(item.key)}
              data-ocid={`discharge_summary.checklist.${item.key}`}
            >
              {checklist[item.key] ? (
                <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span
                className={`text-sm ${checklist[item.key] ? "text-teal-700 line-through opacity-70" : "text-foreground"}`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Badge
            className={`${Object.values(checklist).every(Boolean) ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"} border-0 text-xs`}
          >
            {Object.values(checklist).filter(Boolean).length}/
            {CHECKLIST_ITEMS.length} complete
          </Badge>
        </div>
      </div>
    </div>
  );
}
