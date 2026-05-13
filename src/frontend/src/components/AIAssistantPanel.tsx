/**
 * AIAssistantPanel — floating AI helper for the PatientProfile page.
 * Provides: (a) Summarize Patient, (b) Suggest Diagnosis, (c) Auto-draft SOAP,
 *           (d) Analyze Lab Report (PDF/image upload + value parsing + alerts).
 * All outputs are clearly labeled "AI-Suggested — Requires Doctor Review".
 * Confidence indicators added for all suggestions.
 * Accepted AI suggestions are logged to the audit trail.
 */
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bot,
  Brain,
  Check,
  ClipboardList,
  Copy,
  FileText,
  FlaskConical,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { appendAuditLog } from "../hooks/useEmailAuth";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { checkExtendedClinicalAlerts } from "../lib/clinicalIntelligence";
import type { ExtendedAlertInput } from "../types";
import type { Patient, Prescription, Visit } from "../types";

interface Props {
  patient: Patient;
  visits: Visit[];
  prescriptions: Prescription[];
  latestVitals: Record<string, string> | null;
  onClose: () => void;
  /** Called with treatment protocol text to populate the active prescription form */
  onApplyTreatment?: (text: string) => void;
}

// ── Confidence helpers ─────────────────────────────────────────────────────────

interface ConfidenceBadgeProps {
  confidence: number | null;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence === null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
        Confidence: N/A
      </span>
    );
  }
  if (confidence > 80) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 border border-green-300">
        ✓ High Confidence ({confidence}%)
      </span>
    );
  }
  if (confidence >= 60) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
        ~ Medium Confidence ({confidence}%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-300">
      ⚠ Low Confidence ({confidence}%)
    </span>
  );
}

function LowConfidenceWarning({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence >= 60) return null;
  return (
    <div className="flex items-start gap-1.5 rounded-lg bg-yellow-50 border border-yellow-300 px-3 py-2 mt-1">
      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 shrink-0" />
      <p className="text-[11px] text-yellow-700 font-medium leading-snug">
        Low confidence — verify with clinical examination before acting on this
        suggestion
      </p>
    </div>
  );
}

// ── Internal pattern matching for diagnosis suggestions ───────────────────────

const SYMPTOM_DIAGNOSIS_MAP: Array<{
  keywords: string[];
  diagnoses: string[];
}> = [
  {
    keywords: ["fever", "headache", "nausea", "rash"],
    diagnoses: ["Dengue Fever", "Typhoid Fever", "Viral Fever NOS"],
  },
  {
    keywords: ["chest pain", "dyspnoea", "palpitation"],
    diagnoses: [
      "Acute Coronary Syndrome",
      "Pneumothorax",
      "Pulmonary Embolism",
      "Heart Failure",
    ],
  },
  {
    keywords: ["cough", "breathlessness", "sputum"],
    diagnoses: [
      "Community-Acquired Pneumonia",
      "COPD Exacerbation",
      "Bronchial Asthma",
    ],
  },
  {
    keywords: ["vomiting", "diarrhoea", "abdominal pain"],
    diagnoses: [
      "Acute Gastroenteritis",
      "Typhoid Fever",
      "Appendicitis",
      "IBD Flare",
    ],
  },
  {
    keywords: ["polyuria", "polydipsia", "weight loss"],
    diagnoses: [
      "Diabetes Mellitus (new onset)",
      "Hyperthyroidism",
      "Diabetes Insipidus",
    ],
  },
  {
    keywords: ["hypertension", "high bp", "headache", "blurred vision"],
    diagnoses: [
      "Hypertensive Urgency",
      "Secondary Hypertension",
      "Essential Hypertension",
    ],
  },
  {
    keywords: ["jaundice", "dark urine", "pale stool"],
    diagnoses: [
      "Viral Hepatitis",
      "Obstructive Jaundice",
      "Haemolytic Anaemia",
    ],
  },
  {
    keywords: ["decreased urine", "oedema", "creatinine"],
    diagnoses: [
      "Acute Kidney Injury (AKI)",
      "Chronic Kidney Disease",
      "Nephrotic Syndrome",
    ],
  },
];

/** Returns diagnoses with their confidence scores (0–100) based on symptom matching */
function suggestDiagnosesByText(
  text: string,
): Array<{ dx: string; confidence: number }> {
  const lower = text.toLowerCase();
  const scores: Record<string, { score: number; totalKeywords: number }> = {};
  for (const entry of SYMPTOM_DIAGNOSIS_MAP) {
    const matched = entry.keywords.filter((kw) => lower.includes(kw));
    if (matched.length > 0) {
      for (const dx of entry.diagnoses) {
        if (!scores[dx]) {
          scores[dx] = { score: 0, totalKeywords: entry.keywords.length };
        }
        scores[dx].score += matched.length;
        scores[dx].totalKeywords = Math.max(
          scores[dx].totalKeywords,
          entry.keywords.length,
        );
      }
    }
  }
  return Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([dx, { score, totalKeywords }]) => ({
      dx,
      // confidence = (matching keywords / total keywords in entry) * 100, capped at 95
      confidence: Math.min(95, Math.round((score / totalKeywords) * 100)),
    }));
}

function generatePatientSummary(
  patient: Patient,
  visits: Visit[],
  prescriptions: Prescription[],
  latestVitals: Record<string, string> | null,
): string {
  const age = patient.dateOfBirth
    ? Math.floor(
        (Date.now() - Number(patient.dateOfBirth / 1_000_000n)) /
          (365.25 * 24 * 3600 * 1000),
      )
    : null;
  const latestVisit = visits.length
    ? [...visits].sort((a, b) => Number(b.visitDate - a.visitDate))[0]
    : null;
  const latestRx = prescriptions.length
    ? [...prescriptions].sort((a, b) =>
        Number(b.prescriptionDate - a.prescriptionDate),
      )[0]
    : null;
  const vitalsText = latestVitals
    ? [
        `BP ${latestVitals.bloodPressure || "—"} mmHg`,
        `Pulse ${latestVitals.pulse || "—"} beats/min`,
        `Temp ${latestVitals.temperature || "—"}°C`,
        `SpO₂ ${latestVitals.oxygenSaturation || "—"}%`,
      ]
        .join(", ")
        .concat(".")
    : "Vitals not recorded.";
  const dxText = latestVisit?.diagnosis ?? "not yet established";
  const complaintsText =
    latestVisit?.chiefComplaint ?? "no chief complaint recorded";
  const medsText = latestRx?.medications?.length
    ? latestRx.medications
        .slice(0, 3)
        .map(
          (m) =>
            `${((m as Record<string, unknown>).drugName as string) || m.name} ${m.dose}`,
        )
        .join(", ")
    : "no current medications on record";
  const allergyText = patient.allergies?.length
    ? `Known allergies: ${patient.allergies.join(", ")}.`
    : "No known drug allergies.";
  return [
    `${patient.fullName} is a${age ? ` ${age}-year-old` : "n"} ${patient.gender} patient (Reg: ${(patient as Record<string, unknown>).registerNumber || "—"}).`,
    `Presenting with ${complaintsText}. Diagnosis: ${dxText}.`,
    `Current vitals: ${vitalsText}`,
    `Active medications: ${medsText}.`,
    allergyText,
    visits.length
      ? `Total visits: ${visits.length}. Most recent: ${format(new Date(Number(latestVisit!.visitDate / 1_000_000n)), "d MMM yyyy")}.`
      : "No visit history.",
  ].join(" ");
}

function generateSOAPDraft(
  latestVitals: Record<string, string> | null,
  latestVisit: Visit | null,
): string {
  const vitalsText = latestVitals
    ? `BP: ${latestVitals.bloodPressure || "—"} mmHg | Pulse: ${latestVitals.pulse || "—"} beats/min | Temp: ${latestVitals.temperature || "—"}°C | SpO₂: ${latestVitals.oxygenSaturation || "—"}%`
    : "Vitals not available";
  return [
    `S (Subjective): ${latestVisit?.chiefComplaint ?? "Patient complaints not recorded today."}`,
    `O (Objective): ${vitalsText}. General examination pending.`,
    `A (Assessment): ${latestVisit?.diagnosis ?? "Diagnosis under review."}`,
    "P (Plan): Continue current medications. Review results. Follow up as needed.",
  ].join("\n\n");
}

// ── Lab Report Parsing ────────────────────────────────────────────────────────

interface ParsedLabValue {
  label: string;
  value: number;
  raw: string;
  flag: "high" | "low" | "normal";
}

interface LabAnalysisResult {
  parsedValues: ParsedLabValue[];
  diagnosisSuggestion: string;
  differentialDiagnosis: string[];
  investigationPlan: string[];
  treatmentProtocol: string;
  /** Confidence for the primary diagnosis suggestion (0–100) */
  confidence: number;
}

const LAB_PATTERNS: Array<{
  regex: RegExp;
  key: string;
  label: string;
  normalMin: number;
  normalMax: number;
}> = [
  {
    regex: /hb[:\s]+([0-9.]+)|hemoglobin[:\s]+([0-9.]+)/i,
    key: "hemoglobin",
    label: "Hemoglobin (Hb)",
    normalMin: 11.5,
    normalMax: 17.5,
  },
  {
    regex:
      /wbc[:\s]+([0-9.]+)|tlc[:\s]+([0-9.]+)|white[- ]?blood[- ]?cell[s]?[:\s]+([0-9.]+)/i,
    key: "wbc",
    label: "WBC (TLC)",
    normalMin: 4,
    normalMax: 11,
  },
  {
    regex: /creatinine[:\s]+([0-9.]+)/i,
    key: "creatinine",
    label: "Creatinine",
    normalMin: 0.6,
    normalMax: 1.2,
  },
  {
    regex: /glucose[:\s]+([0-9.]+)|blood[- ]?sugar[:\s]+([0-9.]+)/i,
    key: "glucose",
    label: "Blood Glucose",
    normalMin: 70,
    normalMax: 140,
  },
  {
    regex: /k\+?\s*[:\s]+([0-9.]+)|potassium[:\s]+([0-9.]+)/i,
    key: "potassium",
    label: "Potassium (K⁺)",
    normalMin: 3.5,
    normalMax: 5.0,
  },
  {
    regex: /na\+?\s*[:\s]+([0-9.]+)|sodium[:\s]+([0-9.]+)/i,
    key: "sodium",
    label: "Sodium (Na⁺)",
    normalMin: 135,
    normalMax: 145,
  },
  {
    regex: /ph[:\s]+([0-9.]+)/i,
    key: "ph",
    label: "pH",
    normalMin: 7.35,
    normalMax: 7.45,
  },
  {
    regex: /bicarbonate[:\s]+([0-9.]+)|hco3[:\s]+([0-9.]+)/i,
    key: "bicarbonate",
    label: "Bicarbonate (HCO₃)",
    normalMin: 22,
    normalMax: 29,
  },
  {
    regex: /platelets?[:\s]+([0-9.]+)|plt[:\s]+([0-9.]+)/i,
    key: "platelets",
    label: "Platelet Count",
    normalMin: 150,
    normalMax: 400,
  },
];

function parseLabText(text: string): ParsedLabValue[] {
  const results: ParsedLabValue[] = [];
  for (const pattern of LAB_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const rawVal = match[1] ?? match[2] ?? match[3] ?? "";
      const value = Number.parseFloat(rawVal);
      if (Number.isNaN(value)) continue;
      const idx = match.index ?? 0;
      const context = text.slice(idx, idx + match[0].length + 5);
      let flag: ParsedLabValue["flag"] = "normal";
      if (value > pattern.normalMax || /[↑Hh]\b/.test(context)) flag = "high";
      else if (value < pattern.normalMin || /[↓Ll]\b/.test(context))
        flag = "low";
      results.push({
        label: pattern.label,
        key: pattern.key,
        value,
        raw: `${value}`,
        flag,
      } as ParsedLabValue & { key: string });
    }
  }
  return results;
}

function buildAnalysisFromParsedValues(
  values: ParsedLabValue[],
): LabAnalysisResult {
  const map: Record<string, number> = {};
  for (const v of values as Array<ParsedLabValue & { key: string }>) {
    map[v.key] = v.value;
  }

  const alertInput: ExtendedAlertInput = {
    labs: {
      creatinine: map.creatinine,
      potassium: map.potassium,
      sodium: map.sodium,
      glucose: map.glucose,
      bicarbonate: map.bicarbonate,
      ph: map.ph,
    },
  };
  const alerts = checkExtendedClinicalAlerts(alertInput);

  let diagnosisSuggestion = "Review values with clinical context";
  const differential: string[] = [];
  const investigations: string[] = [];
  let treatment = "Manage as per clinical findings. Consult treating doctor.";
  // Track how many abnormal values drove the suggestion for confidence
  let abnormalValueCount = 0;
  const totalValueCount = values.length;

  if (map.hemoglobin !== undefined) {
    if (map.hemoglobin < 7) {
      diagnosisSuggestion = `Severe Anemia (Hb: ${map.hemoglobin} g/dL) — urgent evaluation required`;
      differential.push(
        "Iron deficiency anemia",
        "Hemolytic anemia",
        "Aplastic anemia",
        "GI blood loss",
      );
      investigations.push(
        "Peripheral blood smear",
        "Ferritin",
        "TIBC",
        "Reticulocyte count",
        "LDH",
      );
      treatment =
        "IV iron or blood transfusion depending on severity; investigate underlying cause; recheck Hb in 2–4 weeks";
      abnormalValueCount++;
    } else if (map.hemoglobin < 11.5) {
      diagnosisSuggestion = `Anemia (Hb: ${map.hemoglobin} g/dL) — consider iron deficiency or chronic disease`;
      differential.push(
        "Iron deficiency anemia",
        "Anemia of chronic disease",
        "Thalassemia trait",
        "Vitamin B12/folate deficiency",
      );
      investigations.push(
        "Ferritin",
        "Peripheral blood smear",
        "Reticulocyte count",
        "Vitamin B12",
        "Folate",
      );
      treatment =
        "Iron supplementation 200mg elemental iron/day, dietary advice (leafy greens, red meat); recheck Hb in 4 weeks";
      abnormalValueCount++;
    }
  }

  if (map.creatinine !== undefined && map.creatinine > 1.5) {
    diagnosisSuggestion += `; Elevated Creatinine (${map.creatinine} mg/dL) — possible AKI or CKD`;
    differential.push(
      ...[
        "Acute Kidney Injury (AKI)",
        "Chronic Kidney Disease (CKD)",
        "Prerenal azotemia",
      ].filter((d) => !differential.includes(d)),
    );
    investigations.push(
      "Urine RE/ME",
      "Urine protein:creatinine ratio",
      "USG kidneys",
      "eGFR estimation",
    );
    treatment +=
      "; Hold nephrotoxins, IV fluids if prerenal; nephrology consult if severe";
    abnormalValueCount++;
  }

  if (map.glucose !== undefined) {
    if (map.glucose < 70) {
      diagnosisSuggestion += `; Hypoglycemia (${map.glucose} mg/dL) — immediate treatment required`;
      treatment =
        "Dextrose 50% 50ml IV bolus if unconscious, or oral glucose 15–20g if conscious; recheck in 15 min";
      abnormalValueCount++;
    } else if (map.glucose > 250) {
      diagnosisSuggestion += `; Hyperglycemia (${map.glucose} mg/dL) — review diabetes management`;
      investigations.push(
        "HbA1c",
        "Urine ketones",
        "Arterial blood gas if acidosis suspected",
      );
      treatment += "; Review insulin/OHA regimen; ensure adequate hydration";
      abnormalValueCount++;
    }
  }

  for (const alert of alerts.filter(
    (a) => a.severity === "critical" || a.severity === "warning",
  )) {
    if (alert.aiSuggestion && !treatment.includes(alert.aiSuggestion)) {
      treatment += `\n• ${alert.message}: ${alert.aiSuggestion}`;
    }
  }

  if (differential.length === 0)
    differential.push("Findings within normal limits — correlate clinically");
  if (investigations.length === 0)
    investigations.push(
      "Repeat basic metabolic panel in 48h if any borderline values",
    );

  // Confidence: based on how many values support the suggestion vs total provided
  const confidence =
    totalValueCount > 0
      ? Math.min(
          95,
          Math.round((abnormalValueCount / totalValueCount) * 100 + 40),
        )
      : 45;

  return {
    parsedValues: values,
    diagnosisSuggestion,
    differentialDiagnosis: differential,
    investigationPlan: investigations,
    treatmentProtocol: treatment,
    confidence,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIAssistantPanel({
  patient,
  visits,
  prescriptions,
  latestVitals,
  onClose,
  onApplyTreatment,
}: Props) {
  const { currentDoctor } = useEmailAuth();

  const [symptomText, setSymptomText] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ dx: string; confidence: number }>
  >([]);
  const [isThinking, setIsThinking] = useState(false);
  const [acceptedDx, setAcceptedDx] = useState<Set<string>>(new Set());

  // Lab report state
  const [labPreviewUrl, setLabPreviewUrl] = useState<string | null>(null);
  const [labPasteText, setLabPasteText] = useState("");
  const [labAnalysis, setLabAnalysis] = useState<LabAnalysisResult | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const latestVisit = visits.length
    ? [...visits].sort((a, b) => Number(b.visitDate - a.visitDate))[0]
    : null;

  const patientSummary = generatePatientSummary(
    patient,
    visits,
    prescriptions,
    latestVitals,
  );
  const soapDraft = generateSOAPDraft(latestVitals, latestVisit);

  // ── Audit helpers ──────────────────────────────────────────────────────────

  function logAISuggestionAccepted(
    fieldName: "diagnosis" | "plan" | "differential_diagnosis",
    suggestionText: string,
    confidence: number | null,
  ) {
    const userEmail = currentDoctor?.email ?? "unknown";
    const userRole = currentDoctor?.role ?? "doctor";
    appendAuditLog({
      timestamp: new Date().toISOString(),
      userRole: userRole as "admin",
      userName: currentDoctor?.name ?? userEmail,
      action: `AI suggestion accepted — ${fieldName} — confidence: ${confidence !== null ? `${confidence}%` : "N/A"} — "${suggestionText.slice(0, 80)}${suggestionText.length > 80 ? "…" : ""}"`,
      target: `Patient: ${patient.fullName} (ID: ${patient.id})`,
    });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSuggestDiagnosis() {
    if (!symptomText.trim()) return;
    setIsThinking(true);
    setAcceptedDx(new Set());
    setTimeout(() => {
      const results = suggestDiagnosesByText(symptomText);
      setSuggestions(
        results.length
          ? results
          : [
              {
                dx: "No pattern matched — enter more symptoms for better suggestions",
                confidence: 0,
              },
            ],
      );
      setIsThinking(false);
    }, 800);
  }

  function handleAcceptDiagnosis(dx: string, confidence: number) {
    if (acceptedDx.has(dx)) return;
    setAcceptedDx((prev) => new Set([...prev, dx]));
    logAISuggestionAccepted("diagnosis", dx, confidence);
    toast.success(`Diagnosis "${dx}" accepted and logged to audit trail`);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Copy failed"));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e?.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setLabPreviewUrl(url);
      toast.success("Image loaded — paste key values below for AI analysis");
    } else if (file.type === "application/pdf") {
      setLabPreviewUrl(null);
      toast.info(
        "PDF uploaded — please paste the key lab values below for AI analysis",
      );
    } else {
      toast.error("Please upload a PDF or image (JPG/PNG)");
    }
  }

  function handleAnalyzeLab() {
    if (!labPasteText.trim()) {
      toast.error("Please paste or type the key lab values first");
      return;
    }
    setIsAnalyzing(true);
    setTimeout(() => {
      const parsed = parseLabText(labPasteText);
      if (parsed.length === 0) {
        toast.error(
          "No recognized lab values found. Try format: 'Hb: 8.5' or 'Creatinine: 1.8'",
        );
        setIsAnalyzing(false);
        return;
      }
      const analysis = buildAnalysisFromParsedValues(parsed);
      setLabAnalysis(analysis);
      setIsAnalyzing(false);
    }, 1000);
  }

  function handleAcceptLabDiagnosis() {
    if (!labAnalysis) return;
    logAISuggestionAccepted(
      "diagnosis",
      labAnalysis.diagnosisSuggestion,
      labAnalysis.confidence,
    );
    toast.success("Lab diagnosis accepted and logged to audit trail");
  }

  function handleAcceptLabPlan() {
    if (!labAnalysis) return;
    logAISuggestionAccepted(
      "plan",
      labAnalysis.treatmentProtocol,
      labAnalysis.confidence,
    );
    if (onApplyTreatment) {
      onApplyTreatment(labAnalysis.treatmentProtocol);
      toast.success(
        "Treatment protocol applied to prescription & logged to audit trail",
      );
    } else {
      toast.success("Treatment plan accepted and logged to audit trail");
    }
  }

  const flagColor = (flag: ParsedLabValue["flag"]) => {
    if (flag === "high") return "text-red-700 bg-red-50 border-red-200";
    if (flag === "low") return "text-blue-700 bg-blue-50 border-blue-200";
    return "text-green-700 bg-green-50 border-green-200";
  };

  return (
    <div
      className="fixed right-4 bottom-24 z-50 w-[26rem] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ maxHeight: "82vh" }}
      data-ocid="ai_assistant.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold text-sm">AI Assistant</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors"
          data-ocid="ai_assistant.close_button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* AI disclaimer banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-shrink-0">
        <p className="text-[11px] text-amber-700 font-medium">
          ⚠️ AI-Suggested — All outputs require Doctor Review before acting
        </p>
      </div>

      <Tabs
        defaultValue="summary"
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="mx-3 mt-3 grid grid-cols-4 gap-0.5 h-auto flex-shrink-0">
          <TabsTrigger
            value="summary"
            className="gap-1 text-[11px] py-1.5 px-1"
          >
            <ClipboardList className="w-3 h-3" />
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="diagnosis"
            className="gap-1 text-[11px] py-1.5 px-1"
          >
            <Brain className="w-3 h-3" />
            Diagnose
          </TabsTrigger>
          <TabsTrigger value="soap" className="gap-1 text-[11px] py-1.5 px-1">
            <FileText className="w-3 h-3" />
            SOAP
          </TabsTrigger>
          <TabsTrigger value="lab" className="gap-1 text-[11px] py-1.5 px-1">
            <FlaskConical className="w-3 h-3" />
            Lab
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Summary Tab */}
          <TabsContent value="summary" className="p-4 space-y-3 mt-0">
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">
                AI Clinical Summary
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {patientSummary}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => copyText(patientSummary, "Summary")}
              data-ocid="ai_assistant.copy_summary_button"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Summary
            </Button>
          </TabsContent>

          {/* Diagnosis Tab */}
          <TabsContent value="diagnosis" className="p-4 space-y-3 mt-0">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Describe symptoms + current vitals:
              </p>
              <textarea
                className="w-full border border-input rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 bg-background"
                rows={3}
                placeholder="e.g. fever 5 days, headache, nausea, rash on body..."
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                data-ocid="ai_assistant.symptoms.input"
              />
              <Button
                size="sm"
                className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                onClick={handleSuggestDiagnosis}
                disabled={isThinking}
                data-ocid="ai_assistant.suggest_button"
              >
                {isThinking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Brain className="w-3.5 h-3.5" />
                )}
                {isThinking ? "Thinking..." : "Suggest Diagnoses"}
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Suggestions (Offline Analysis)
                </p>
                {suggestions.map((item, i) => (
                  <div key={item.dx} className="space-y-1">
                    <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-violet-500 w-5 mt-0.5 shrink-0">
                        {i + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug mb-1">
                          {item.dx}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <ConfidenceBadge confidence={item.confidence} />
                          {!acceptedDx.has(item.dx) && item.confidence > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAcceptDiagnosis(item.dx, item.confidence)
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                              data-ocid={`ai_assistant.accept_dx_button.${i + 1}`}
                            >
                              <Check className="w-2.5 h-2.5" />
                              Accept
                            </button>
                          )}
                          {acceptedDx.has(item.dx) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                              <Check className="w-2.5 h-2.5" />
                              Accepted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <LowConfidenceWarning confidence={item.confidence} />
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground italic">
                  Using offline pattern matching. Doctor must confirm all
                  diagnoses.
                </p>
              </div>
            )}
          </TabsContent>

          {/* SOAP Draft Tab */}
          <TabsContent value="soap" className="p-4 space-y-3 mt-0">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                  Auto-draft SOAP Note
                </p>
                <ConfidenceBadge confidence={null} />
              </div>
              <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                {soapDraft}
              </pre>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-yellow-700 font-medium leading-snug">
                Auto-generated text is a starting point only — review and
                confirm before saving to the patient record.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => copyText(soapDraft, "SOAP note")}
              data-ocid="ai_assistant.copy_soap_button"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy SOAP Note
            </Button>
          </TabsContent>

          {/* Lab Report Tab */}
          <TabsContent
            value="lab"
            className="p-4 space-y-3 mt-0"
            data-ocid="ai_assistant.lab.tab"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Analyze Lab Report
              </p>

              {/* Upload button */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-ocid="ai_assistant.lab.file_input"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  data-ocid="ai_assistant.lab.upload_button"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Lab Report (PDF/Image)
                </Button>
              </div>

              {/* Image preview */}
              {labPreviewUrl && (
                <div className="relative rounded-xl overflow-hidden border border-teal-200">
                  <img
                    src={labPreviewUrl}
                    alt="Lab report preview"
                    className="w-full object-contain max-h-48"
                  />
                  <button
                    type="button"
                    onClick={() => setLabPreviewUrl(null)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Paste area */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                  Paste key values from report for AI analysis:
                </p>
                <p className="text-[10px] text-muted-foreground mb-2 opacity-80">
                  Format: "Hb: 8.5" • "WBC: 12.3" • "Creatinine: 1.9" • "K+:
                  5.8" • "Glucose: 320"
                </p>
                <textarea
                  className="w-full border border-input rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-background min-h-[80px]"
                  rows={4}
                  placeholder={
                    "Hb: 8.5 g/dL (L)\nWBC: 14.2 (H)\nCreatinine: 1.9\nK+: 5.8\nGlucose: 280"
                  }
                  value={labPasteText}
                  onChange={(e) => setLabPasteText(e.target.value)}
                  data-ocid="ai_assistant.lab.paste_input"
                />
              </div>

              <Button
                size="sm"
                className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                onClick={handleAnalyzeLab}
                disabled={isAnalyzing}
                data-ocid="ai_assistant.lab.analyze_button"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="w-3.5 h-3.5" />
                )}
                {isAnalyzing ? "Analyzing report..." : "Analyze Lab Values"}
              </Button>

              {isAnalyzing && (
                <div className="flex items-center justify-center gap-2 py-3 text-teal-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Analyzing report...</span>
                </div>
              )}

              {/* Analysis Results */}
              {labAnalysis && !isAnalyzing && (
                <div className="space-y-3">
                  {/* Parsed Values */}
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">
                      Detected Values
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {labAnalysis.parsedValues.map((v) => (
                        <div
                          key={v.label}
                          className={`rounded-lg px-2 py-1.5 border text-xs ${flagColor(v.flag)}`}
                        >
                          <p className="font-semibold truncate">{v.label}</p>
                          <p className="font-mono font-bold">
                            {v.raw}{" "}
                            {v.flag !== "normal" &&
                              (v.flag === "high" ? "↑" : "↓")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Diagnosis Suggestion */}
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <p className="text-xs font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1">
                        <Brain className="w-3 h-3" /> Diagnosis Suggestion
                      </p>
                      <ConfidenceBadge confidence={labAnalysis.confidence} />
                    </div>
                    <p className="text-xs text-foreground leading-relaxed mb-2">
                      {labAnalysis.diagnosisSuggestion}
                    </p>
                    <LowConfidenceWarning confidence={labAnalysis.confidence} />
                    <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                      ⚠️ AI Suggested — Requires Doctor Review
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 gap-1.5 h-7 text-[11px] border-violet-300 text-violet-700 hover:bg-violet-50"
                      onClick={handleAcceptLabDiagnosis}
                      data-ocid="ai_assistant.lab.accept_diagnosis_button"
                    >
                      <Check className="w-3 h-3" />
                      Accept Diagnosis (logged to audit)
                    </Button>
                  </div>

                  {/* Differential Diagnosis */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1.5">
                      Differential Diagnosis
                    </p>
                    <ol className="space-y-1">
                      {labAnalysis.differentialDiagnosis
                        .slice(0, 5)
                        .map((dx, i) => (
                          <li
                            key={dx}
                            className="text-xs text-foreground flex items-start gap-1.5"
                          >
                            <span className="font-bold text-blue-500 shrink-0">
                              {i + 1}.
                            </span>
                            {dx}
                          </li>
                        ))}
                    </ol>
                    <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                      ⚠️ AI Suggested — Requires Doctor Review
                    </p>
                  </div>

                  {/* Investigation Plan */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" /> Investigation Plan
                    </p>
                    <ul className="space-y-1">
                      {labAnalysis.investigationPlan.map((inv) => (
                        <li
                          key={inv}
                          className="text-xs text-foreground flex items-start gap-1.5"
                        >
                          <span className="text-amber-400 mt-0.5">•</span>
                          {inv}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                      ⚠️ AI Suggested — Requires Doctor Review
                    </p>
                  </div>

                  {/* Treatment Protocol */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Treatment Protocol
                      </p>
                      <ConfidenceBadge confidence={labAnalysis.confidence} />
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-line mb-2">
                      {labAnalysis.treatmentProtocol}
                    </p>
                    <LowConfidenceWarning confidence={labAnalysis.confidence} />
                    <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                      ⚠️ AI Suggested — Requires Doctor Review
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 gap-2"
                      onClick={handleAcceptLabPlan}
                      data-ocid="ai_assistant.lab.apply_button"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {onApplyTreatment
                        ? "Apply to Prescription (logged to audit)"
                        : "Accept Plan (logged to audit)"}
                    </Button>
                  </div>

                  {/* Alerts from alert engine */}
                  {checkExtendedClinicalAlerts({
                    labs: {
                      creatinine: (
                        labAnalysis.parsedValues as Array<
                          ParsedLabValue & { key: string }
                        >
                      ).find((v) => v.key === "creatinine")?.value,
                      potassium: (
                        labAnalysis.parsedValues as Array<
                          ParsedLabValue & { key: string }
                        >
                      ).find((v) => v.key === "potassium")?.value,
                      sodium: (
                        labAnalysis.parsedValues as Array<
                          ParsedLabValue & { key: string }
                        >
                      ).find((v) => v.key === "sodium")?.value,
                      glucose: (
                        labAnalysis.parsedValues as Array<
                          ParsedLabValue & { key: string }
                        >
                      ).find((v) => v.key === "glucose")?.value,
                    },
                  }).filter(
                    (a) =>
                      a.severity === "critical" || a.severity === "warning",
                  ).length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Clinical Alert
                        Engine Flags
                      </p>
                      {checkExtendedClinicalAlerts({
                        labs: {
                          creatinine: (
                            labAnalysis.parsedValues as Array<
                              ParsedLabValue & { key: string }
                            >
                          ).find((v) => v.key === "creatinine")?.value,
                          potassium: (
                            labAnalysis.parsedValues as Array<
                              ParsedLabValue & { key: string }
                            >
                          ).find((v) => v.key === "potassium")?.value,
                          sodium: (
                            labAnalysis.parsedValues as Array<
                              ParsedLabValue & { key: string }
                            >
                          ).find((v) => v.key === "sodium")?.value,
                          glucose: (
                            labAnalysis.parsedValues as Array<
                              ParsedLabValue & { key: string }
                            >
                          ).find((v) => v.key === "glucose")?.value,
                        },
                      })
                        .filter(
                          (a) =>
                            a.severity === "critical" ||
                            a.severity === "warning",
                        )
                        .map((alert) => (
                          <div
                            key={alert.id}
                            className={`mb-1.5 rounded-lg px-2 py-1.5 text-xs border ${alert.severity === "critical" ? "bg-red-100 border-red-300 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}
                          >
                            <p className="font-semibold">{alert.message}</p>
                            {alert.aiSuggestion && (
                              <p className="mt-0.5 opacity-80">
                                {alert.aiSuggestion}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      const text = `DIAGNOSIS: ${labAnalysis.diagnosisSuggestion}\n\nDIFFERENTIAL:\n${labAnalysis.differentialDiagnosis.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\nINVESTIGATIONS:\n${labAnalysis.investigationPlan.join("\n")}\n\nTREATMENT:\n${labAnalysis.treatmentProtocol}`;
                      copyText(text, "Lab analysis");
                    }}
                    data-ocid="ai_assistant.lab.copy_button"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Full Analysis
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
