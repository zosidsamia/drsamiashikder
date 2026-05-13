import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getDoctorEmail } from "@/hooks/useQueries";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Medication } from "../types";
import { type DimsEntry, getDimsByDiagnosis, searchDims } from "./DimsData";

// ─── Types ────────────────────────────────────────────────────────────────────

type DrugType = "TAB." | "CAP." | "SYP." | "INJ." | "INF." | "SUPP." | "";
type NameType = "generic" | "brand";

interface MedEntry {
  _uid: number;
  drugType: DrugType;
  nameType: NameType;
  name: string;
  dose: string;
  frequency: string;
  frequencyOther: string;
  durationEn: string;
  durationBn: string;
  instructionEn: string;
  instructionBn: string;
  dosePattern: string;
  fromDims: boolean;
  originalDims?: Partial<MedEntry>;
}

interface NewPrescriptionModeProps {
  patientId: bigint;
  visitId?: bigint;
  patientName?: string;
  initialDiagnosis?: string;
  onSubmit: (data: {
    patientId: bigint;
    visitId: bigint | null;
    prescriptionDate: bigint;
    diagnosis: string | null;
    medications: Medication[];
    notes: string | null;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DRUG_TYPES: { label: DrugType; color: string }[] = [
  { label: "TAB.", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { label: "CAP.", color: "bg-green-100 text-green-700 border-green-300" },
  { label: "SYP.", color: "bg-green-100 text-green-800 border-green-300" },
  { label: "INJ.", color: "bg-red-100 text-red-800 border-red-300" },
  { label: "INF.", color: "bg-purple-100 text-purple-800 border-purple-300" },
  { label: "SUPP.", color: "bg-orange-100 text-orange-800 border-orange-300" },
];

const FREQ_OPTIONS = [
  { en: "BD", bn: "বিডি (দিনে ২ বার)" },
  { en: "TDS", bn: "টিডিএস (দিনে ৩ বার)" },
  { en: "QDS", bn: "কিউডিএস (দিনে ৪ বার)" },
  { en: "Once Daily", bn: "একবার দৈনিক" },
  { en: "12 Hourly", bn: "১২ ঘণ্টায় একবার" },
  { en: "8 Hourly", bn: "৮ ঘণ্টায় একবার" },
  { en: "6 Hourly", bn: "৬ ঘণ্টায় একবার" },
  { en: "Other", bn: "অন্যান্য" },
];

const DURATION_PRESETS = [
  { en: "3 days", bn: "৩ দিন" },
  { en: "5 days", bn: "৫ দিন" },
  { en: "7 days", bn: "৭ দিন" },
  { en: "10 days", bn: "১০ দিন" },
  { en: "14 days", bn: "১৪ দিন" },
  { en: "1 month", bn: "১ মাস" },
  { en: "Continue", bn: "চলতে থাকবে" },
];

const INSTRUCTION_PRESETS = [
  { en: "After meal", bn: "খাবারের পরে" },
  { en: "Before meal", bn: "খাবারের আগে" },
  { en: "Empty stomach", bn: "খালি পেটে" },
  { en: "At bedtime", bn: "ঘুমানোর আগে" },
  { en: "With water", bn: "পানি দিয়ে" },
  { en: "Chew & swallow", bn: "চিবিয়ে গিলতে হবে" },
  { en: "Dissolve in water", bn: "পানিতে মিশিয়ে খান" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

let _counter = 0;
function nextUid() {
  _counter += 1;
  return _counter;
}

function emptyMed(): MedEntry {
  return {
    _uid: nextUid(),
    drugType: "",
    nameType: "generic",
    name: "",
    dose: "",
    frequency: "",
    frequencyOther: "",
    durationEn: "",
    durationBn: "",
    instructionEn: "",
    instructionBn: "",
    dosePattern: "",
    fromDims: false,
  };
}

function dimsToMed(m: {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}): MedEntry {
  // Detect drug type prefix
  const name = m.name || "";
  let drugType: DrugType = "";
  let cleanName = name;
  for (const dt of [
    "TAB.",
    "CAP.",
    "SYP.",
    "INJ.",
    "INF.",
    "SUPP.",
  ] as DrugType[]) {
    if (name.toUpperCase().startsWith(dt)) {
      drugType = dt;
      cleanName = name.slice(dt.length).trim();
      break;
    }
  }
  // Map frequency
  const freqUpper = (m.frequency || "").toUpperCase();
  let freq = m.frequency || "";
  let freqOther = "";
  const known = FREQ_OPTIONS.map((f) => f.en.toUpperCase());
  if (!known.includes(freqUpper)) {
    freqOther = freq;
    freq = "Other";
  }
  return {
    _uid: nextUid(),
    drugType,
    nameType: "generic",
    name: cleanName,
    dose: m.dose || "",
    frequency: freq,
    frequencyOther: freqOther,
    durationEn: m.duration || "",
    durationBn:
      DURATION_PRESETS.find(
        (d) => d.en.toLowerCase() === (m.duration || "").toLowerCase(),
      )?.bn || "",
    instructionEn: m.instructions || "",
    instructionBn:
      INSTRUCTION_PRESETS.find(
        (p) => p.en.toLowerCase() === (m.instructions || "").toLowerCase(),
      )?.bn || "",
    dosePattern: "",
    fromDims: true,
    originalDims: undefined,
  };
}

function formatFreqDisplay(med: MedEntry): string {
  if (med.frequency === "Other") return med.frequencyOther || "";
  return med.frequency || "";
}

function formatDurationDisplay(med: MedEntry): string {
  const parts: string[] = [];
  if (med.durationEn) parts.push(med.durationEn);
  if (med.durationBn && med.durationBn !== med.durationEn)
    parts.push(`/ ${med.durationBn}`);
  return parts.join(" ");
}

function formatInstructionDisplay(med: MedEntry): string {
  const parts: string[] = [];
  if (med.instructionEn) parts.push(med.instructionEn);
  if (med.instructionBn && med.instructionBn !== med.instructionEn)
    parts.push(`/ ${med.instructionBn}`);
  return parts.join(" ");
}

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

// ─── Types for visit extended data ──────────────────────────────────────────

interface VisitExtendedData {
  chiefComplaints?: string[];
  complaintAnswers?: Record<string, Record<string, string>>;
  systemReviewAnswers?: Record<string, string>;
  pastMedicalHistory?: string[];
  pastMedicalHistoryAll?: Record<string, string>;
  drugHistory?: { name?: string; dose?: string; duration?: string }[];
  surgicalHistory?: string[];
  familyHistory?: string[];
  personalHistory?: string[];
  immunizationHistory?: string[];
  epiSchedule?: string;
  allergyHistory?: string[];
  obstetricHistory?: string[];
  gynaecologicalHistory?: string[];
  vitalSigns?: Record<string, string | undefined>;
  generalExamFindings?: Record<string, string>;
  respiratoryExam?: Record<string, unknown>;
  neurologicalExam?: Record<string, unknown>;
  gastrointestinalExam?: Record<string, unknown>;
  musculoskeletalExam?: Record<string, unknown>;
  cardiovascularExam?: Record<string, unknown>;
  previousInvestigationRows?: {
    date: string;
    name: string;
    result: string;
    unit: string;
    interpretation: string;
  }[];
  differentialDiagnosis?: string;
  investigationAdvice?: string;
}

function loadVisitData(visitId: bigint | undefined): VisitExtendedData | null {
  if (!visitId) return null;
  try {
    const doctorEmail = getDoctorEmail();
    const keys = Object.keys(localStorage).filter(
      (k) =>
        k.startsWith(`visit_form_data_${visitId}_`) ||
        k === `visit_form_data_${visitId}_${doctorEmail}`,
    );
    if (keys.length === 0) {
      // Try all keys that include the visitId
      const allKeys = Object.keys(localStorage).filter((k) =>
        k.includes(`visit_form_data_${visitId}`),
      );
      if (allKeys.length > 0) {
        const raw = localStorage.getItem(allKeys[0]);
        return raw ? JSON.parse(raw) : null;
      }
      return null;
    }
    const raw = localStorage.getItem(keys[0]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildClinicalSummary(vd: VisitExtendedData) {
  // C/C
  const ccLines: string[] = [];
  if (vd.chiefComplaints && vd.complaintAnswers) {
    vd.chiefComplaints.forEach((complaint, i) => {
      const answers = vd.complaintAnswers?.[complaint] || {};
      const parts = Object.values(answers).filter(Boolean).slice(0, 3);
      if (parts.length > 0) {
        ccLines.push(`${i + 1}. ${complaint} — ${parts.join(", ")}`);
      } else {
        ccLines.push(`${i + 1}. ${complaint}`);
      }
    });
  }
  // Positive system review
  if (vd.systemReviewAnswers) {
    const positive = Object.entries(vd.systemReviewAnswers)
      .filter(([, v]) => v && v !== "Normal" && v !== "None" && v !== "No")
      .map(([k, v]) => `${k}: ${v}`);
    if (positive.length > 0) {
      ccLines.push(`Positive system review: ${positive.join("; ")}`);
    }
  }

  // P/M/H
  const pmhLines: string[] = [];
  if (vd.pastMedicalHistoryAll) {
    const pos = Object.entries(vd.pastMedicalHistoryAll)
      .map(([k, v]) => `${k}${v === "+" ? "+" : v === "-" ? "-" : ""}`)
      .join(", ");
    if (pos) pmhLines.push(pos);
  } else if (vd.pastMedicalHistory && vd.pastMedicalHistory.length > 0) {
    pmhLines.push(`${vd.pastMedicalHistory.join(", ")} — positive`);
  }
  if (vd.surgicalHistory && vd.surgicalHistory.length > 0) {
    pmhLines.push(`Surgical: ${vd.surgicalHistory.join(", ")}`);
  }

  // History
  const histLines: string[] = [];
  if (vd.personalHistory?.some(Boolean)) {
    histLines.push(
      `Personal: ${vd.personalHistory.filter(Boolean).join(", ")}`,
    );
  }
  if (vd.familyHistory?.some(Boolean)) {
    histLines.push(`Family: ${vd.familyHistory.filter(Boolean).join(", ")}`);
  }
  if (vd.immunizationHistory?.some(Boolean)) {
    const epiNote = vd.epiSchedule
      ? ` (EPI Schedule: ${vd.epiSchedule.toUpperCase()})`
      : "";
    histLines.push(
      `Immunization: ${vd.immunizationHistory.filter(Boolean).join(", ")}${epiNote}`,
    );
  } else if (vd.epiSchedule) {
    histLines.push(`EPI Schedule: ${vd.epiSchedule.toUpperCase()}`);
  }
  if (vd.allergyHistory?.some(Boolean)) {
    histLines.push(`Allergy: ${vd.allergyHistory.filter(Boolean).join(", ")}`);
  }
  if (vd.obstetricHistory?.some(Boolean)) {
    histLines.push(
      `Obstetric: ${vd.obstetricHistory.filter(Boolean).join(", ")}`,
    );
  }
  if (vd.gynaecologicalHistory?.some(Boolean)) {
    histLines.push(
      `Gynae: ${vd.gynaecologicalHistory.filter(Boolean).join(", ")}`,
    );
  }

  // D/H
  const dhLines: string[] = [];
  if (vd.drugHistory && vd.drugHistory.length > 0) {
    vd.drugHistory.forEach((d, i) => {
      if (d.name) {
        const parts = [d.name, d.dose, d.duration].filter(Boolean);
        dhLines.push(`${i + 1}. ${parts.join(" — ")}`);
      }
    });
  }

  // O/E
  const oeLines: string[] = [];
  if (vd.vitalSigns) {
    const vs = vd.vitalSigns;
    const parts: string[] = [];
    if (vs.bloodPressure) parts.push(`BP: ${vs.bloodPressure}`);
    if (vs.pulse) parts.push(`Pulse: ${vs.pulse} bpm`);
    if (vs.temperature) parts.push(`Temp: ${vs.temperature}°F`);
    if (vs.respiratoryRate) parts.push(`RR: ${vs.respiratoryRate}/min`);
    if (vs.oxygenSaturation) parts.push(`SpO2: ${vs.oxygenSaturation}%`);
    if (parts.length > 0) oeLines.push(`Vitals: ${parts.join(", ")}`);
  }
  if (vd.generalExamFindings) {
    const pos = Object.entries(vd.generalExamFindings)
      .filter(
        ([, v]) =>
          v && v !== "Normal" && v !== "None" && v !== "No" && v !== "Absent",
      )
      .map(([k, v]) => `${k}: ${v}`);
    if (pos.length > 0) oeLines.push(`General: ${pos.join("; ")}`);
  }
  // Cardiovascular exam summary
  if (vd.cardiovascularExam) {
    const cvs = vd.cardiovascularExam as Record<string, unknown>;
    const parts: string[] = [];
    if (
      cvs.precordium &&
      Array.isArray(cvs.precordium) &&
      cvs.precordium.length > 0
    )
      parts.push(`Inspection: ${(cvs.precordium as string[]).join(", ")}`);
    if (cvs.apex_beat && cvs.apex_beat !== "Normal position (5th ICS MCL)")
      parts.push(`Apex: ${cvs.apex_beat}`);
    if (
      cvs.murmurs &&
      Array.isArray(cvs.murmurs) &&
      cvs.murmurs.length > 0 &&
      !(cvs.murmurs as string[]).includes("No murmur")
    )
      parts.push(`Murmur: ${(cvs.murmurs as string[]).join(", ")}`);
    if (
      cvs.heart_sounds &&
      Array.isArray(cvs.heart_sounds) &&
      cvs.heart_sounds.length > 0
    )
      parts.push(`Sounds: ${(cvs.heart_sounds as string[]).join(", ")}`);
    if (parts.length > 0) oeLines.push(`CVS: ${parts.join(". ")}`);
  }

  // Investigation
  const invLines: string[] = [];
  if (vd.previousInvestigationRows && vd.previousInvestigationRows.length > 0) {
    const rows = vd.previousInvestigationRows.filter((r) => r.name && r.result);
    if (rows.length > 0) {
      invLines.push(
        `Previous reports: ${rows
          .map((r) => `${r.name}: ${r.result}${r.unit ? ` ${r.unit}` : ""}`)
          .join("; ")}`,
      );
    }
  }
  if (vd.investigationAdvice) {
    invLines.push(`Advised: ${vd.investigationAdvice.slice(0, 200)}`);
  }

  return {
    cc: ccLines.join("\n"),
    pmh: pmhLines.join("\n"),
    history: histLines.join("\n"),
    dh: dhLines.join("\n"),
    oe: oeLines.join("\n"),
    investigation: invLines.join("\n"),
    investigationRows:
      vd.previousInvestigationRows?.filter((r) => r.name) || [],
    investigationAdvice: vd.investigationAdvice || "",
  };
}

// ─── ClinicalSummaryPanel ─────────────────────────────────────────────────────

function ClinicalSummaryPanel({ visitId }: { visitId?: bigint }) {
  const visitData = visitId ? loadVisitData(visitId) : null;
  const summary = visitData ? buildClinicalSummary(visitData) : null;

  const [cc, setCc] = useState(summary?.cc || "");
  const [pmh, setPmh] = useState(summary?.pmh || "");
  const [history, setHistory] = useState(summary?.history || "");
  const [dh, setDh] = useState(summary?.dh || "");
  const [oe, setOe] = useState(summary?.oe || "");
  type InvRow = {
    date: string;
    name: string;
    result: string;
    unit: string;
    interpretation: string;
  };
  const [invRows, setInvRows] = useState<InvRow[]>(
    summary?.investigationRows || [],
  );
  const [invAdvice, setInvAdvice] = useState(
    summary?.investigationAdvice || "",
  );
  const [collapsed, setCollapsed] = useState(false);

  const loadFromVisit = () => {
    const fresh = visitId ? loadVisitData(visitId) : null;
    if (!fresh) return;
    const freshSummary = buildClinicalSummary(fresh);
    setInvRows(freshSummary.investigationRows || []);
    setInvAdvice(freshSummary.investigationAdvice || "");
    setCc(freshSummary.cc);
    setPmh(freshSummary.pmh);
    setHistory(freshSummary.history);
    setDh(freshSummary.dh);
    setOe(freshSummary.oe);
  };

  const updateInvRow = (idx: number, field: keyof InvRow, value: string) => {
    setInvRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const addInvRow = () => {
    setInvRows((prev) => [
      ...prev,
      {
        date: new Date().toISOString().split("T")[0],
        name: "",
        result: "",
        unit: "",
        interpretation: "",
      },
    ]);
  };

  const removeInvRow = (idx: number) => {
    setInvRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const fieldStyle =
    "bg-white border border-gray-200 rounded text-xs p-2 w-full resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 font-mono";
  const labelStyle =
    "text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1";

  if (collapsed) {
    return (
      <div className="border-b border-gray-200 px-3 py-2 bg-gray-50">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Show Clinical Summary (C/C · P/M/H · History · D/H · O/E ·
          Investigation)
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">
            Clinical Summary
          </span>
          <button
            type="button"
            onClick={loadFromVisit}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[10px] rounded-md hover:bg-blue-700 transition-colors"
            data-ocid="rx.generate_clinical.button"
          >
            <Sparkles className="w-3 h-3" />
            Generate from Visit
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-gray-400 hover:text-gray-600"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2.5 max-h-[50vh] overflow-y-auto">
        {/* C/C */}
        <div>
          <p className={labelStyle}>C/C — Chief Complaints</p>
          <textarea
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            rows={3}
            placeholder="1. Cough for 5 days, dry, white sputum&#10;2. Fever for 3 days, high grade&#10;Positive system review: Dyspnoea on exertion"
            className={fieldStyle}
          />
        </div>
        {/* P/M/H */}
        <div>
          <p className={labelStyle}>P/M/H — Past Medical & Surgical History</p>
          <textarea
            value={pmh}
            onChange={(e) => setPmh(e.target.value)}
            rows={2}
            placeholder="DM+, HTN-, IHD-&#10;Surgical: Appendectomy 2015"
            className={fieldStyle}
          />
        </div>
        {/* History */}
        <div>
          <p className={labelStyle}>
            History — Personal / Family / Immunization / Allergy / Others
          </p>
          <textarea
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            rows={3}
            placeholder="Personal: Smoker 10 cigarettes/day&#10;Family: Father — DM&#10;Immunization: BCG — Yes (EPI: YES)&#10;Allergy: Penicillin"
            className={fieldStyle}
          />
        </div>
        {/* D/H */}
        <div>
          <p className={labelStyle}>D/H — Drug History</p>
          <textarea
            value={dh}
            onChange={(e) => setDh(e.target.value)}
            rows={2}
            placeholder="1. Metformin 500mg — BD&#10;2. Amlodipine 5mg — Once daily"
            className={fieldStyle}
          />
        </div>
        {/* O/E */}
        <div>
          <p className={labelStyle}>O/E — On Examination</p>
          <textarea
            value={oe}
            onChange={(e) => setOe(e.target.value)}
            rows={4}
            placeholder="Vitals: BP 130/80, Pulse 78 bpm, Temp 98.6°F, SpO2 98%&#10;Anaemia: Absent. Jaundice: Absent.&#10;General: Alert, cooperative&#10;CVS: On Inspection — no precordial bulge. Heart sounds S1 S2 normal."
            className={fieldStyle}
          />
        </div>
        {/* Investigation Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className={labelStyle}>Investigation Report</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={addInvRow}
                className="text-[10px] px-2 py-0.5 bg-gray-50 border border-gray-200 text-gray-600 rounded hover:bg-gray-100"
                data-ocid="rx.add_inv_row.button"
              >
                + Row
              </button>
            </div>
          </div>
          {invRows.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-cyan-600 text-white">
                    <th className="px-1.5 py-1 text-left font-semibold w-20">
                      Date
                    </th>
                    <th className="px-1.5 py-1 text-left font-semibold">
                      Name
                    </th>
                    <th className="px-1.5 py-1 text-left font-semibold w-14">
                      Result
                    </th>
                    <th className="px-1.5 py-1 text-left font-semibold w-12">
                      Unit
                    </th>
                    <th className="px-1.5 py-1 text-left font-semibold">
                      Interp.
                    </th>
                    <th className="w-5" />
                  </tr>
                </thead>
                <tbody>
                  {invRows.map((row, idx) => (
                    <tr
                      key={`inv-${row.name}-${row.date}-${idx}`}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="p-0.5">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            updateInvRow(idx, "date", e.target.value)
                          }
                          className="w-full text-[10px] px-1 py-0.5 border border-gray-200 rounded bg-white"
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          value={row.name}
                          onChange={(e) =>
                            updateInvRow(idx, "name", e.target.value)
                          }
                          placeholder="e.g. Hb"
                          className="w-full text-[10px] px-1 py-0.5 border border-gray-200 rounded bg-white"
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          value={row.result}
                          onChange={(e) =>
                            updateInvRow(idx, "result", e.target.value)
                          }
                          placeholder="12.5"
                          className="w-full text-[10px] px-1 py-0.5 border border-gray-200 rounded bg-white"
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          value={row.unit}
                          onChange={(e) =>
                            updateInvRow(idx, "unit", e.target.value)
                          }
                          placeholder="g/dL"
                          className="w-full text-[10px] px-1 py-0.5 border border-gray-200 rounded bg-white"
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          value={row.interpretation}
                          onChange={(e) =>
                            updateInvRow(idx, "interpretation", e.target.value)
                          }
                          placeholder="Normal"
                          className="w-full text-[10px] px-1 py-0.5 border border-gray-200 rounded bg-white"
                        />
                      </td>
                      <td className="p-0.5">
                        <button
                          type="button"
                          onClick={() => removeInvRow(idx)}
                          className="text-red-400 hover:text-red-600 px-0.5"
                          data-ocid={`rx.inv_row.delete_button.${idx + 1}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="text-center py-3 text-[10px] text-gray-400 border border-dashed border-gray-200 rounded"
              data-ocid="rx.inv_table.empty_state"
            >
              No investigation rows. Click &ldquo;Load from Visit&rdquo; or
              &ldquo;+ Row&rdquo;.
            </div>
          )}
        </div>
        {/* Investigation Advice */}
        <div>
          <p className={labelStyle}>Advice / New Investigation</p>
          <textarea
            value={invAdvice}
            onChange={(e) => setInvAdvice(e.target.value)}
            rows={2}
            placeholder="CBC, RFT, LFT, ECG, Chest X-Ray..."
            className={fieldStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ─── RxPreviewPanel ────────────────────────────────────────────────────────

function RxPreviewPanel({
  diagnosis,
  medications,
  advice,
  prescriptionDate,
  patientName,
}: {
  diagnosis: string;
  medications: MedEntry[];
  advice: string;
  prescriptionDate: string;
  patientName?: string;
}) {
  const dateStr = prescriptionDate
    ? new Date(prescriptionDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  const validMeds = medications.filter((m) => m.name.trim());

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <span className="font-bold text-base tracking-wide">
            ℞ Prescription Preview
          </span>
          <span className="text-xs text-teal-100">{dateStr}</span>
        </div>
        {patientName && (
          <p className="text-xs text-teal-100 mt-0.5">{patientName}</p>
        )}
      </div>

      {/* Diagnosis strip */}
      {diagnosis && (
        <div className="bg-teal-50 border-b border-teal-200 px-4 py-2">
          <span className="text-[10px] uppercase tracking-wider text-teal-600 font-semibold">
            Diagnosis / রোগ নির্ণয়
          </span>
          <p className="text-sm font-semibold text-teal-900 mt-0.5">
            {diagnosis}
          </p>
        </div>
      )}

      {/* Rx content */}
      <ScrollArea className="flex-1 bg-white">
        <div className="p-4">
          {/* Rx symbol */}
          <div className="text-4xl font-serif italic text-teal-700 mb-3 leading-none">
            ℞
          </div>

          {validMeds.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">Add medications to see preview</p>
              <p className="text-xs mt-1">ওষুধ যোগ করুন</p>
            </div>
          ) : (
            <div className="space-y-4">
              {validMeds.map((med, idx) => (
                <div
                  key={med._uid}
                  className="flex gap-3 pb-3 border-b border-dashed border-gray-200 last:border-0"
                >
                  <span className="text-sm font-bold text-teal-700 min-w-[20px]">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 space-y-0.5">
                    {/* Drug name line */}
                    <div className="flex flex-wrap items-baseline gap-1">
                      {med.drugType && (
                        <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {med.drugType}
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-900">
                        {med.name}
                      </span>
                      {med.nameType === "brand" && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
                          Brand
                        </span>
                      )}
                      {med.dose && (
                        <span className="text-sm text-gray-700">
                          &mdash; {med.dose}
                        </span>
                      )}
                    </div>
                    {/* Frequency */}
                    {formatFreqDisplay(med) && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Freq:</span>{" "}
                        {formatFreqDisplay(med)}
                        {med.dosePattern && (
                          <span className="font-semibold ml-1 text-gray-800">
                            ({med.dosePattern})
                          </span>
                        )}
                        {med.frequency !== "Other" &&
                          FREQ_OPTIONS.find((f) => f.en === med.frequency)
                            ?.bn && (
                            <span className="text-teal-600 ml-1">
                              (
                              {
                                FREQ_OPTIONS.find((f) => f.en === med.frequency)
                                  ?.bn
                              }
                              )
                            </span>
                          )}
                      </p>
                    )}
                    {/* Duration */}
                    {formatDurationDisplay(med) && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Duration:</span>{" "}
                        {formatDurationDisplay(med)}
                      </p>
                    )}
                    {/* Instruction */}
                    {formatInstructionDisplay(med) && (
                      <p className="text-xs italic text-teal-700">
                        {formatInstructionDisplay(med)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Advice */}
          {advice && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-1">
                Special Advice / বিশেষ পরামর্শ
              </p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                {advice}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── MedicationCard ────────────────────────────────────────────────────────

function MedicationCard({
  med,
  index,
  total,
  onChange,
  onRemove,
}: {
  med: MedEntry;
  index: number;
  total: number;
  onChange: (field: keyof MedEntry, value: string) => void;
  onRemove: () => void;
}) {
  const activeTypeStyle = (dt: string) =>
    med.drugType === dt
      ? "ring-2 ring-offset-1 ring-teal-500 font-bold scale-105"
      : "opacity-70 hover:opacity-100";

  return (
    <div className="border-2 border-teal-100 rounded-xl p-4 space-y-3 bg-white shadow-sm relative">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
          {index + 1}
        </span>
        {med.fromDims && (
          <Badge
            variant="outline"
            className="text-[10px] h-5 border-teal-300 text-teal-700 bg-teal-50"
          >
            DIMS
          </Badge>
        )}
        {total > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Drug type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Drug Type / ওষুধের ধরন</Label>
        <div className="flex flex-wrap gap-1.5">
          {DRUG_TYPES.map(({ label, color }) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                onChange("drugType", med.drugType === label ? "" : label)
              }
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${color} ${activeTypeStyle(label)}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Generic / Brand toggle + Name */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <Label className="text-xs text-gray-500">Name / নাম</Label>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
            <button
              type="button"
              onClick={() => onChange("nameType", "generic")}
              className={`px-2.5 py-1 transition-colors ${
                med.nameType === "generic"
                  ? "bg-teal-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Generic
            </button>
            <button
              type="button"
              onClick={() => onChange("nameType", "brand")}
              className={`px-2.5 py-1 border-l transition-colors ${
                med.nameType === "brand"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Brand
            </button>
          </div>
        </div>
        <Input
          value={med.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder={
            med.nameType === "generic" ? "Generic drug name" : "Brand name"
          }
          className="h-9 text-sm"
        />
      </div>

      {/* Dose */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Dose / মাত্রা</Label>
        <Input
          value={med.dose}
          onChange={(e) => onChange("dose", e.target.value)}
          placeholder="e.g. 500mg, 1 tab, 5ml"
          className="h-9 text-sm"
        />
      </div>

      {/* Frequency — editable combobox */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Frequency / বার</Label>
        {/* Free-text input with quick-select chips below */}
        <Input
          value={med.frequency}
          onChange={(e) => onChange("frequency", e.target.value)}
          placeholder="Type or select frequency..."
          className="h-9 text-sm"
          data-ocid="rx.frequency.input"
        />
        <div className="flex flex-wrap gap-1">
          {FREQ_OPTIONS.filter((f) => f.en !== "Other").map(({ en, bn }) => (
            <button
              key={en}
              type="button"
              onClick={() =>
                onChange("frequency", med.frequency === en ? "" : en)
              }
              className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                med.frequency === en
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-teal-50 hover:border-teal-300"
              }`}
            >
              <span className="font-bold">{en}</span>
              <span className="ml-0.5 opacity-60 text-[9px]">
                {bn.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
        {/* Dose Pattern */}
        <div className="mt-2">
          <Label className="text-xs text-gray-500">
            Dose Pattern / মাত্রার ধরন
          </Label>
          <Input
            value={med.dosePattern || ""}
            onChange={(e) => onChange("dosePattern", e.target.value)}
            placeholder="e.g. 1+0+1"
            className="h-9 text-sm mt-1"
          />
          <div className="flex flex-wrap gap-1 mt-1">
            {[
              ["BD", "1+0+1"],
              ["TDS", "1+1+1"],
              ["QDS", "1+1+1+1"],
              ["Once Daily", "1+0+0"],
              ["12 Hourly", "1+0+1"],
            ].map(([freq, pattern]) => (
              <button
                key={freq}
                type="button"
                onClick={() => onChange("dosePattern", pattern)}
                className="px-2 py-0.5 rounded text-[10px] border bg-gray-50 border-gray-200 text-gray-600 hover:bg-teal-50 hover:border-teal-300"
              >
                {freq}: {pattern}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">
          Duration / সময়কাল (EN + বাংলা)
        </Label>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {DURATION_PRESETS.map(({ en, bn }) => (
            <button
              key={en}
              type="button"
              onClick={() => {
                onChange("durationEn", med.durationEn === en ? "" : en);
                onChange("durationBn", med.durationBn === bn ? "" : bn);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                med.durationEn === en
                  ? "bg-teal-600 text-white border-teal-600"
                  : "hover:bg-teal-50"
              }`}
            >
              {en} / {bn}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={med.durationEn}
            onChange={(e) => onChange("durationEn", e.target.value)}
            placeholder="e.g. 7 days"
            className="h-9 text-sm"
          />
          <Input
            value={med.durationBn}
            onChange={(e) => onChange("durationBn", e.target.value)}
            placeholder="যেমন: ৭ দিন"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Instruction */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">
          Instruction / নির্দেশনা (Doctor chooses language)
        </Label>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {INSTRUCTION_PRESETS.map(({ en, bn }) => (
            <button
              key={en}
              type="button"
              onClick={() => {
                // Toggle instruction - if both match, clear. Otherwise set.
                const bothMatch =
                  med.instructionEn === en && med.instructionBn === bn;
                if (bothMatch) {
                  onChange("instructionEn", "");
                  onChange("instructionBn", "");
                } else {
                  onChange("instructionEn", en);
                  onChange("instructionBn", bn);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                med.instructionEn === en || med.instructionBn === bn
                  ? "bg-amber-500 text-white border-amber-500"
                  : "hover:bg-amber-50"
              }`}
            >
              {en} / {bn}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={med.instructionEn}
            onChange={(e) => onChange("instructionEn", e.target.value)}
            placeholder="English instruction"
            className="h-9 text-sm"
          />
          <Input
            value={med.instructionBn}
            onChange={(e) => onChange("instructionBn", e.target.value)}
            placeholder="বাংলা নির্দেশনা"
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function NewPrescriptionMode({
  patientId,
  visitId,
  patientName,
  initialDiagnosis,
  onSubmit,
  onCancel,
  isLoading,
}: NewPrescriptionModeProps) {
  const initEntry = initialDiagnosis
    ? getDimsByDiagnosis(initialDiagnosis)
    : undefined;

  const [prescriptionDate, setPrescriptionDate] = useState(todayDateString());
  const [diagnosis, setDiagnosis] = useState(initialDiagnosis ?? "");
  const [medications, setMedications] = useState<MedEntry[]>(
    initEntry ? initEntry.medications.map(dimsToMed) : [emptyMed()],
  );
  const [dimsAutoFilled, setDimsAutoFilled] = useState(!!initEntry);
  const [dimsNotes, setDimsNotes] = useState<string | undefined>(
    initEntry?.notes,
  );
  const [advice, setAdvice] = useState("");
  const [suggestions, setSuggestions] = useState<DimsEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const diagnosisRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        diagnosisRef.current &&
        !diagnosisRef.current.contains(e.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDiagnosisChange = (val: string) => {
    setDiagnosis(val);
    if (val.length >= 2) {
      const results = searchDims(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const applyDimsEntry = (entry: DimsEntry) => {
    setDiagnosis(entry.diagnosis);
    setMedications(entry.medications.map(dimsToMed));
    setDimsAutoFilled(true);
    setDimsNotes(entry.notes);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const resetToDims = () => {
    const entry = getDimsByDiagnosis(diagnosis);
    if (entry) {
      setMedications(entry.medications.map(dimsToMed));
      setDimsNotes(entry.notes);
    }
  };

  const addMed = () => setMedications((prev) => [...prev, emptyMed()]);

  const removeMed = (uid: number) =>
    setMedications((prev) => prev.filter((m) => m._uid !== uid));

  const updateMed = (uid: number, field: keyof MedEntry, value: string) =>
    setMedications((prev) =>
      prev.map((m) => (m._uid === uid ? { ...m, [field]: value } : m)),
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validMeds: Medication[] = medications
      .filter((m) => m.name.trim())
      .map((m) => {
        const prefix = m.drugType ? `${m.drugType} ` : "";
        const freq = m.frequency === "Other" ? m.frequencyOther : m.frequency;
        const dur = [m.durationEn, m.durationBn].filter(Boolean).join(" / ");
        const instr = [m.instructionEn, m.instructionBn]
          .filter(Boolean)
          .join(" / ");
        return {
          name: (prefix + m.name).trim(),
          dose: m.dose.trim(),
          frequency: freq.trim(),
          duration: dur.trim(),
          instructions: instr.trim(),
        };
      });
    const date = BigInt(new Date(prescriptionDate).getTime()) * 1000000n;
    onSubmit({
      patientId,
      visitId: visitId ?? null,
      prescriptionDate: date,
      diagnosis: diagnosis.trim() || null,
      medications: validMeds,
      notes: advice.trim() || null,
    });
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "80vh" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-teal-700 to-teal-600">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-base">
            New Prescription
          </span>
          {dimsAutoFilled && (
            <Badge className="bg-teal-100 text-teal-800 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              DIMS Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={prescriptionDate}
            onChange={(e) => setPrescriptionDate(e.target.value)}
            className="text-xs px-2 py-1 rounded border bg-white text-gray-700"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white hover:bg-teal-800 h-7 px-3"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
        {/* LEFT: Input panel */}
        <div className="flex-1 overflow-y-auto bg-gray-50 md:border-r">
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Diagnosis */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Diagnosis / রোগ নির্ণয়
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={diagnosisRef}
                  value={diagnosis}
                  onChange={(e) => handleDiagnosisChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Type diagnosis to search DIMS..."
                  className="pl-9 bg-white"
                  autoComplete="off"
                />
                {diagnosis && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiagnosis("");
                      setDimsAutoFilled(false);
                      setDimsNotes(undefined);
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden"
                  >
                    <ScrollArea className="max-h-48">
                      <div className="p-1">
                        {suggestions.map((entry) => (
                          <button
                            key={entry.diagnosis}
                            type="button"
                            onClick={() => applyDimsEntry(entry)}
                            className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {entry.diagnosis}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.category} &middot;{" "}
                                {entry.medications.length} medications
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs border-teal-300 text-teal-700 bg-teal-50"
                            >
                              DIMS
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
              {dimsAutoFilled && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-xs text-teal-700">
                    Auto-filled from DIMS
                  </span>
                  {localStorage.getItem("treatmentReferencePDF") && (
                    <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                      + {localStorage.getItem("treatmentReferencePDF")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={resetToDims}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 ml-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              )}
              {dimsNotes && (
                <Alert className="border-blue-200 bg-blue-50 py-2">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  <AlertDescription className="text-xs text-blue-800">
                    <span className="font-semibold">Clinical note: </span>
                    {dimsNotes}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Medications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">
                  Medications / ওষুধ
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMed}
                  className="h-7 px-2 text-xs gap-1 border-teal-300 text-teal-700 hover:bg-teal-50"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {medications.map((med, idx) => (
                  <MedicationCard
                    key={med._uid}
                    med={med}
                    index={idx}
                    total={medications.length}
                    onChange={(field, value) =>
                      updateMed(med._uid, field, value)
                    }
                    onRemove={() => removeMed(med._uid)}
                  />
                ))}
              </div>
            </div>

            {/* Advice */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Special Advice / বিশেষ পরামর্শ
              </Label>
              <Textarea
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="Write special advice for the patient here... / রোগীর জন্য বিশেষ পরামর্শ লিখুন..."
                rows={3}
                className="text-sm bg-white resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 pb-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {isLoading ? "Saving..." : "Save Prescription"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="px-4"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* RIGHT: Clinical Summary + Rx preview */}
        <div className="w-full md:w-[420px] flex-shrink-0 flex flex-col md:border-l border-t md:border-t-0 overflow-hidden">
          <Tabs defaultValue="clinical" className="flex flex-col h-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none border-b shrink-0">
              <TabsTrigger value="clinical" className="text-xs rounded-none">
                Clinical Summary
              </TabsTrigger>
              <TabsTrigger value="rx" className="text-xs rounded-none">
                ℞ Rx Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="clinical"
              className="flex-1 overflow-y-auto m-0 p-0"
            >
              <ClinicalSummaryPanel visitId={visitId} />
            </TabsContent>
            <TabsContent
              value="rx"
              className="flex-1 overflow-y-auto m-0 p-0 flex flex-col"
            >
              <RxPreviewPanel
                diagnosis={diagnosis}
                medications={medications}
                advice={advice}
                prescriptionDate={prescriptionDate}
                patientName={patientName}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
