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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Building2,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Hospital,
  Moon,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useEmailAuth } from "../hooks/useEmailAuth";
import {
  autoPopulateDrugReminders,
  getDoctorEmail,
  getPrescriptionHeaderImage,
  loadPrescriptionRecords,
  savePrescriptionRecords,
  setPrescriptionHeaderImage,
} from "../hooks/useQueries";
import type {
  AllergyOverrideRecord,
  FamilyHistoryRisk,
  Medication,
} from "../types";
import type { PrescriptionHeaderType } from "../types";
import {
  type AdviceTemplate,
  deleteCustomTemplate,
  getAllTemplates,
  saveCustomTemplate,
} from "./AdviceTemplates";
import { getDimsByDiagnosis, searchDims } from "./DimsData";
import { loadTrackedInvestigations } from "./InvestigationTracker";
import {
  DiscontinuationDialog,
  type DiscontinuationReason,
} from "./PrescriptionEnhancements";
import PrescriptionHeaderPanel from "./PrescriptionHeaderPanel";
import {
  clearDoctorSignature,
  getDoctorSignature,
  getPrescriptionHeaderHtml,
  getSignatureHtml,
  numberAdviceLines,
  setDoctorSignature,
} from "./PrescriptionHelpers";
import {
  TREATMENT_TEMPLATES,
  type TreatmentDrug,
  type TreatmentTemplate,
  searchTreatmentTemplates,
} from "./TreatmentTemplates";
import {
  loadAllergyOverrides,
  loadFamilyHistoryRisk,
  saveAllergyOverrides,
} from "./patientDashboardTypes";
// ─── Error Boundary ────────────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}
class PrescriptionErrorBoundary extends Component<
  { children: ReactNode; onCancel: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onCancel: () => void }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md w-full bg-white rounded-xl border border-red-200 p-6 shadow-lg text-center space-y-4">
            <p className="text-red-600 font-semibold text-lg">
              Prescription & EMR failed to load
            </p>
            <p className="text-sm text-gray-600 bg-red-50 rounded p-3 text-left font-mono break-all">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.props.onCancel}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface UpgradedPrescriptionEMRProps {
  patientId: bigint;
  visitId?: bigint;
  patientName?: string;
  patientAge?: number | null;
  patientGender?: string;
  patientWeight?: string;
  patientHeight?: number | null;
  patientAddress?: string;
  patientBloodGroup?: string;
  registerNumber?: string;
  initialDiagnosis?: string;
  visitExtendedData?: Record<string, unknown>;
  patientRegisterNumber?: string;
  forceVisitData?: boolean;
  /** Known patient allergies from Patient.allergies */
  patientAllergies?: string[];
  /** Whether this patient is currently admitted (inpatient) */
  isAdmitted?: boolean;
  /** Hospital name for admitted patients */
  hospitalName?: string;
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

interface RxDrug {
  id: string;
  drugForm: string;
  route: string;
  routeBn: string;
  drugName: string;
  brandName: string;
  nameType: "brand" | "generic";
  dose: string;
  duration: string;
  durationBn: string;
  instructions: string;
  instructionBn: string;
  frequency: string;
  frequencyBn: string;
  specialInstruction: string;
  specialInstructionBn: string;
  /** PRN (as-needed) — skips scheduled reminders */
  isPrn?: boolean;
  /** Condition for PRN: e.g. "if fever > 38°C" */
  prnCondition?: string;
  /** How drug was dispensed: brand / generic / substituted */
  dispensedAs?: "brand" | "generic" | "substituted";
  /** Substituted brand name (when dispensedAs = 'substituted') */
  substitutedBrand?: string;
  /** Discontinuation reason (set when drug is removed from active prescription) */
  discontinuationReason?: string;
  /** Unix timestamp when drug was discontinued */
  /** Unix timestamp when drug was discontinued */
  discontinuedAt?: number;
  /** Controlled/narcotic drug flag — triggers legal justification requirement */
  isControlled?: boolean;
}

// ─── Drug interaction pairs (module-level for component access) ──────────────
const DRUG_INTERACTION_PAIRS: Array<{ drugs: string[]; message: string }> = [
  {
    drugs: ["warfarin", "aspirin"],
    message:
      "Warfarin + Aspirin: Increased bleeding risk. Monitor INR closely.",
  },
  {
    drugs: ["metformin", "contrast", "iodine"],
    message:
      "Metformin + Contrast/Iodine: Risk of contrast-induced nephropathy and lactic acidosis. Hold Metformin.",
  },
  {
    drugs: [
      "ace",
      "ramipril",
      "lisinopril",
      "enalapril",
      "spironolactone",
      "eplerenone",
    ],
    message:
      "ACE Inhibitor + K+ sparing diuretic: Risk of hyperkalemia. Monitor potassium levels.",
  },
  {
    drugs: ["ciprofloxacin", "antacid", "aluminium", "magnesium"],
    message:
      "Ciprofloxacin + Antacids: Antacids reduce ciprofloxacin absorption. Give 2 hours apart.",
  },
  {
    drugs: ["ssri", "fluoxetine", "sertraline", "tramadol"],
    message:
      "SSRI + Tramadol: Risk of serotonin syndrome. Monitor for agitation, tremor, tachycardia.",
  },
  {
    drugs: [
      "nsaid",
      "ibuprofen",
      "naproxen",
      "diclofenac",
      "warfarin",
      "heparin",
      "anticoagulant",
    ],
    message: "NSAID + Anticoagulant: Significantly increased bleeding risk.",
  },
];

const DRUG_FORMS = ["Tab.", "Cap.", "Syp.", "Inj.", "Inf.", "Supp.", ""];

const ROUTES_BN: Array<{ en: string; bn: string }> = [
  { en: "PO", bn: "মুখে" },
  { en: "IV", bn: "শিরায়" },
  { en: "IM", bn: "মাংসপেশিতে" },
  { en: "SC", bn: "চামড়ার নিচে" },
  { en: "Topical", bn: "স্থানীয়" },
  { en: "Rectal", bn: "মলদ্বারে" },
  { en: "SL", bn: "জিহ্বার নিচে" },
  { en: "Inhalation", bn: "শ্বাসের মাধ্যমে" },
];

const FREQUENCY_PRESETS: Array<{ en: string; bn: string }> = [
  { en: "Once daily", bn: "দিনে ১ বার" },
  { en: "BD 1+0+1", bn: "সকাল-রাত ১+০+১" },
  { en: "TDS 1+1+1", bn: "সকাল-দুপুর-রাত ১+১+১" },
  { en: "QDS 1+1+1+1", bn: "৬ ঘণ্টা পর পর" },
  { en: "8 hourly", bn: "৮ ঘণ্টা পর পর" },
  { en: "12 hourly", bn: "১২ ঘণ্টা পর পর" },
  { en: "At night", bn: "রাতে ঘুমানোর আগে" },
  { en: "SOS", bn: "প্রয়োজনে" },
];

const DURATION_PRESETS: Array<{ en: string; bn: string }> = [
  { en: "3 days", bn: "৩ দিন" },
  { en: "5 days", bn: "৫ দিন" },
  { en: "7 days", bn: "৭ দিন" },
  { en: "10 days", bn: "১০ দিন" },
  { en: "14 days", bn: "১৪ দিন" },
  { en: "1 month", bn: "১ মাস" },
  { en: "Continue", bn: "চলমান" },
];

const INSTRUCTION_PRESETS: Array<{ en: string; bn: string }> = [
  { en: "After meal", bn: "খাবার পরে" },
  { en: "Before meal", bn: "খাবার আগে" },
  { en: "Empty stomach", bn: "খালি পেটে" },
  { en: "With water", bn: "পানির সাথে" },
  { en: "With milk", bn: "দুধের সাথে" },
];

const ADVICE_CATEGORIES = [
  "সব",
  "বিশ্রাম",
  "ওষুধ",
  "খাদ্য ও পানীয়",
  "জীবনযাত্রা",
  "ফলো-আপ",
  "সতর্কতা",
  "Custom",
];

function drugFromTreatmentDrug(td: TreatmentDrug): RxDrug {
  return {
    id: Math.random().toString(36).slice(2),
    drugForm: "Tab.",
    route: td.route,
    routeBn: ROUTES_BN.find((r) => r.en === td.route)?.bn || "মুখে",
    drugName: td.name,
    brandName: "",
    nameType: td.nameType,
    dose: td.dose,
    duration: td.duration,
    durationBn: "",
    instructions: td.instructions,
    instructionBn: "",
    frequency: "",
    frequencyBn: "",
    specialInstruction: "",
    specialInstructionBn: "",
  };
}

// ─── Allergy helper ───────────────────────────────────────────────────────────

/** Merge allergies from Patient.allergies and visit historyAllergy/allergyHistory fields */
export function getAllergiesForPatient(
  patientAllergies: string[],
  visitExtendedData?: Record<string, unknown>,
): string[] {
  const set = new Set<string>();
  for (const a of patientAllergies) {
    if (a.trim()) set.add(a.trim().toLowerCase());
  }
  if (visitExtendedData) {
    const hist = visitExtendedData.historyAllergy as string | undefined;
    const histArr = visitExtendedData.allergyHistory as string[] | undefined;
    if (hist) {
      for (const s of hist
        .split(/[,;/\n]/)
        .map((x) => x.trim())
        .filter(Boolean)) {
        set.add(s.toLowerCase());
      }
    }
    if (Array.isArray(histArr)) {
      for (const s of histArr.filter(Boolean)) {
        set.add(s.trim().toLowerCase());
      }
    }
  }
  return Array.from(set);
}

/** Check if a drug name matches any known allergy — returns the matched allergen or null */
export function checkDrugAllergyMatch(
  drugName: string,
  allergies: string[],
): string | null {
  if (!drugName || allergies.length === 0) return null;
  const normalized = drugName.trim().toLowerCase();
  for (const allergy of allergies) {
    if (!allergy) continue;
    if (normalized.includes(allergy) || allergy.includes(normalized)) {
      return allergy;
    }
  }
  return null;
}

// ─── Visit data helpers ────────────────────────────────────────────────────────

function populateFromVisitData(
  vd: Record<string, unknown>,
  patientWeight?: string,
) {
  // C/C — Chief Complaints
  const ccLines: string[] = [];
  const chiefComplaints = vd.chiefComplaints as string[] | undefined;
  // complaintAnswers is Record<complaintName, Record<questionLabel, answerValue>>
  const complaintAnswers = vd.complaintAnswers as
    | Record<string, Record<string, string> | string | string[]>
    | undefined;
  if (chiefComplaints) {
    chiefComplaints.forEach((complaint, i) => {
      const rawAnswers = complaintAnswers?.[complaint];
      let answers: string[] = [];
      if (
        rawAnswers &&
        typeof rawAnswers === "object" &&
        !Array.isArray(rawAnswers)
      ) {
        // Object: { "Duration": "10 days", "Character": "productive" } — extract VALUES only
        answers = Object.values(rawAnswers as Record<string, string>).filter(
          (v) => v && v !== "-" && v !== "No" && v !== "None",
        );
      } else if (Array.isArray(rawAnswers)) {
        answers = (rawAnswers as string[]).filter(Boolean);
      } else if (typeof rawAnswers === "string" && rawAnswers) {
        answers = [rawAnswers];
      }
      if (answers.length > 0) {
        ccLines.push(`${i + 1}. ${complaint} — ${answers.join(", ")}.`);
      } else {
        ccLines.push(`${i + 1}. ${complaint}.`);
      }
    });
  }

  // System Review — append as "He/she also complains of X: Y" lines
  const sra = vd.systemReviewAnswers as Record<string, string> | undefined;
  if (sra) {
    const NEGATIVE = new Set(["Normal", "None", "No", "Absent", "-", ""]);
    const positive = Object.entries(sra).filter(
      ([, v]) => v && !NEGATIVE.has(v),
    );
    for (const [k, v] of positive) {
      ccLines.push(`• He/she also complains of ${k}: ${v}`);
    }
  }

  // P/M/H
  const pmhLines: string[] = [];
  const pmhAll = vd.pastMedicalHistoryAll as Record<string, string> | undefined;
  const pmh = vd.pastMedicalHistory as string[] | string | undefined;
  const surgical = vd.surgicalHistory as string[] | undefined;
  const pastSurgical = vd.pastSurgicalHistory as string | undefined;
  if (pmhAll) {
    const pos = Object.entries(pmhAll)
      .map(([k, v]) => `${k}${v === "+" ? "+" : v === "-" ? "-" : ""}`)
      .join(", ");
    if (pos) pmhLines.push(pos);
  } else if (Array.isArray(pmh) && pmh.length > 0) {
    pmhLines.push(pmh.join(", "));
  } else if (typeof pmh === "string" && pmh) {
    pmhLines.push(pmh);
  }
  if (surgical && surgical.length > 0) {
    pmhLines.push(`Surgical: ${surgical.join(", ")}`);
  } else if (pastSurgical) {
    pmhLines.push(`Surgical: ${pastSurgical}`);
  }

  // History tabs
  const histPersonal =
    (vd.historyPersonal as string) ||
    ((vd.personalHistory as string[])?.filter(Boolean).join(", ") ?? "");
  const histFamily =
    (vd.historyFamily as string) ||
    ((vd.familyHistory as string[])?.filter(Boolean).join(", ") ?? "");

  // Immunization: EPI schedule first, then individual items
  let histImmunization = (vd.historyImmunization as string) || "";
  if (!histImmunization) {
    const immunParts: string[] = [];
    if ((vd.epiSchedule as string) === "yes") {
      immunParts.push("Immunised as per EPI schedule.");
    }
    const immunArr = vd.immunizationHistory as string[] | undefined;
    if (immunArr) {
      immunParts.push(...immunArr.filter(Boolean));
    }
    histImmunization = immunParts.join(" ");
  }

  // Allergy: join array into readable text
  const histAllergy =
    (vd.historyAllergy as string) ||
    ((vd.allergyHistory as string[])?.filter(Boolean).join(", ") ?? "");

  // Others: obstetric + gynaecological
  const histObstetricArr = vd.obstetricHistory as string[] | undefined;
  const histGynaeArr = vd.gynaecologicalHistory as string[] | undefined;
  const histObstetric =
    (vd.historyObstetric as string) ||
    (histObstetricArr?.filter(Boolean).join(", ") ?? "");
  const histGynae =
    (vd.historyGynaecological as string) ||
    (histGynaeArr?.filter(Boolean).join(", ") ?? "");
  let histOthers = "";
  if (histObstetric) histOthers += `Obstetric: ${histObstetric}\n`;
  if (histGynae) histOthers += `Gynaecological: ${histGynae}\n`;

  // D/H — Drug History: no type prefix since VisitForm has no type field
  const dhDrugs = vd.drugHistory as
    | Array<{
        name: string;
        dose?: string;
        frequency?: string;
        duration?: string;
        type?: string;
      }>
    | undefined;
  const dhParts: string[] = [];
  if (dhDrugs && dhDrugs.length > 0) {
    for (const d of dhDrugs) {
      if (d.name) {
        // If type exists use it, otherwise omit prefix
        const parts = [d.type || "", d.name, d.dose, d.duration || d.frequency]
          .filter(Boolean)
          .join(" ");
        dhParts.push(parts.trim());
      }
    }
  }

  // O/E — Vitals first, then Heart/Lung baseline, then exam findings
  const oeLines: string[] = [];
  const vs = vd.vitalSigns as
    | {
        bloodPressure?: string;
        pulse?: string;
        temperature?: string;
        oxygenSaturation?: string;
        respiratoryRate?: string;
      }
    | undefined;

  let hasAnyFindings = false;

  if (vs) {
    const vsParts: string[] = [];
    if (vs.bloodPressure) {
      // Calculate MAP if systolic/diastolic available
      const bpMatch = vs.bloodPressure.match(/(\d+)\/(\d+)/);
      if (bpMatch) {
        const sbp = Number(bpMatch[1]);
        const dbp = Number(bpMatch[2]);
        const map = Math.round(dbp + (sbp - dbp) / 3);
        vsParts.push(`BP: ${vs.bloodPressure} mmHg (MAP: ${map} mmHg)`);
      } else {
        vsParts.push(`BP: ${vs.bloodPressure} mmHg`);
      }
    }
    if (vs.pulse) vsParts.push(`Pulse: ${vs.pulse} /min`);
    if (vs.temperature) vsParts.push(`Temp: ${vs.temperature}°F`);
    if (vs.oxygenSaturation) vsParts.push(`SpO₂: ${vs.oxygenSaturation}%`);
    if (vs.respiratoryRate) vsParts.push(`RR: ${vs.respiratoryRate} /min`);
    if (patientWeight) vsParts.push(`Wt: ${patientWeight} kg`);
    if (vsParts.length > 0) {
      oeLines.push(vsParts.join(", "));
      hasAnyFindings = true;
    }
  } else if (patientWeight) {
    oeLines.push(`Wt: ${patientWeight} kg`);
    hasAnyFindings = true;
  }

  // Always add baseline Heart/Lung line if we have any vitals or exam data
  // (fallback will handle the case when nothing at all)
  let heartLungAdded = false;

  // General examination
  const genExam = vd.generalExamFindings as Record<string, string> | undefined;
  if (genExam) {
    const pos = Object.entries(genExam)
      .filter(
        ([, v]) =>
          v &&
          v !== "Normal" &&
          v !== "None" &&
          v !== "No" &&
          v !== "Absent" &&
          v !== "-",
      )
      .map(([k, v]) => `${k}: ${v}`);
    if (pos.length > 0) {
      // Insert Heart/Lung before general findings if not already added
      if (!heartLungAdded) {
        oeLines.push("Heart: S1+S2+0, Lung: Clear");
        heartLungAdded = true;
      }
      oeLines.push(`General: ${pos.join("; ")}`);
      hasAnyFindings = true;
    }
  }

  // Systemic exam findings
  const sysExam = vd.systemicExamFindings as Record<string, string> | undefined;
  if (sysExam) {
    const pos = Object.entries(sysExam)
      .filter(([, v]) => v && v !== "Normal" && v !== "None" && v !== "-")
      .map(([k, v]) => `${k}: ${v}`);
    if (pos.length > 0) {
      if (!heartLungAdded) {
        oeLines.push("Heart: S1+S2+0, Lung: Clear");
        heartLungAdded = true;
      }
      oeLines.push(`Systemic: ${pos.join("; ")}`);
      hasAnyFindings = true;
    }
  }

  // Specialty exam modules
  const specialtyExams: Array<{ key: string; label: string }> = [
    { key: "respiratoryExam", label: "Respiratory" },
    { key: "cardiovascularExam", label: "CVS" },
    { key: "neurologicalExam", label: "Neurological" },
    { key: "gastrointestinalExam", label: "GI" },
    { key: "musculoskeletalExam", label: "MSK" },
  ];
  for (const { key, label } of specialtyExams) {
    const examData = vd[key] as Record<string, string> | undefined;
    if (examData) {
      const findings = Object.entries(examData)
        .filter(([, v]) => v && v !== "Normal" && v !== "None" && v !== "-")
        .map(([k, v]) => `${k}: ${v}`);
      if (findings.length > 0) {
        if (!heartLungAdded) {
          oeLines.push("Heart: S1+S2+0, Lung: Clear");
          heartLungAdded = true;
        }
        oeLines.push(`${label}: ${findings.join("; ")}`);
        hasAnyFindings = true;
      }
    }
  }

  // Add Heart/Lung baseline if we have vitals but no exam findings yet
  if (oeLines.length > 0 && !heartLungAdded) {
    oeLines.push("Heart: S1+S2+0, Lung: Clear");
    heartLungAdded = true;
  }

  // Fallback: no vitals and no exam data at all
  if (!hasAnyFindings && oeLines.length === 0) {
    oeLines.push("Heart: S1+S2+0, Lung: Clear, P/A: NAD");
  }

  // Investigation — support both camelCase and snake_case keys
  const invRows = (vd.previousInvestigationRows ||
    vd.previous_investigation_rows) as
    | Array<{
        date: string;
        name: string;
        result: string;
        unit?: string;
        interpretation?: string;
      }>
    | undefined;
  let invText = "";
  if (invRows && invRows.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const r of invRows) {
      if (!r.name || !r.result) continue;
      const d = r.date || "Unknown";
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(`${r.name} - ${r.result}${r.unit ? r.unit : ""}`);
    }
    const sorted = Object.entries(grouped).sort(([a], [b]) =>
      b.localeCompare(a),
    );
    invText = sorted
      .map(([date, items]) => `${date}: ${items.join(", ")}`)
      .join("\n");
  }

  return {
    cc: ccLines.join("\n"),
    pmh: pmhLines.join("\n"),
    histPersonal,
    histFamily,
    histImmunization,
    histAllergy,
    histOthers: histOthers.trim(),
    dh: dhParts.join(", "),
    oe: oeLines.join("\n"),
    investigation: invText,
    adviceNewInv: (vd.investigationAdvice as string) || "",
  };
}

export default function UpgradedPrescriptionEMR(
  props: UpgradedPrescriptionEMRProps,
) {
  return (
    <PrescriptionErrorBoundary onCancel={props.onCancel}>
      <UpgradedPrescriptionEMRInner {...props} />
    </PrescriptionErrorBoundary>
  );
}

function UpgradedPrescriptionEMRInner(props: UpgradedPrescriptionEMRProps) {
  const {
    patientId,
    visitId,
    patientName,
    patientAge,
    patientGender,
    patientWeight,
    patientHeight,
    patientAddress,
    patientBloodGroup,
    registerNumber,
    initialDiagnosis,
    visitExtendedData,
    patientRegisterNumber,
    forceVisitData,
    patientAllergies,
    isAdmitted: _isAdmitted,
    hospitalName: _hospitalName,
    onSubmit,
    onCancel,
    isLoading,
  } = props;

  const { currentDoctor } = useEmailAuth();
  const userRole = (currentDoctor?.role ?? "doctor") as string;
  const isIntern = userRole === "intern_doctor";
  const canEditHeader =
    userRole === "admin" ||
    userRole === "consultant_doctor" ||
    userRole === "doctor";

  const DRAFT_KEY = `medicare_rx_draft_${patientId}`;

  // ── Allergy alert state ──────────────────────────────────────────────────────
  const [allergyAlert, setAllergyAlert] = useState<{
    drugId: string;
    drugName: string;
    allergen: string;
  } | null>(null);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState("");

  // Computed unified allergy list
  const unifiedAllergies = getAllergiesForPatient(
    patientAllergies ?? [],
    visitExtendedData,
  );

  const [dark, setDark] = useState(false);
  // Header type: auto-select based on patient admission status
  const [headerType, setHeaderType] = useState<PrescriptionHeaderType>(
    _isAdmitted ? "hospital" : "chamber",
  );
  const [withHeader, setWithHeader] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Header image management
  const [showHeaderUpload, setShowHeaderUpload] = useState(false);
  const [hospitalHeaderImg, setHospitalHeaderImg] = useState<string | null>(
    () => getPrescriptionHeaderImage("hospital"),
  );
  const [chamberHeaderImg, setChamberHeaderImg] = useState<string | null>(() =>
    getPrescriptionHeaderImage("chamber"),
  );

  // Doctor signature
  const [signatureUrl, setSignatureUrl] = useState<string | null>(() =>
    getDoctorSignature(),
  );
  const sigFileRef = useRef<HTMLInputElement>(null);

  // Intern draft modal
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Approval dialog state (used in prescription list view for consultant/MO)
  const [_showApprovalDialog, _setShowApprovalDialog] = useState(false);
  const [_approvalComment, _setApprovalComment] = useState("");

  // Patient info
  const [name, setName] = useState(patientName ?? "");
  const [age, setAge] = useState(patientAge != null ? String(patientAge) : "");
  const [sex, setSex] = useState(patientGender ?? "");
  const [weight, setWeight] = useState(patientWeight ?? "");
  const [rxDate, setRxDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [regNo, setRegNo] = useState(
    patientRegisterNumber ?? registerNumber ?? "",
  );
  const [address, setAddress] = useState(patientAddress ?? "");
  const [bloodGroup, setBloodGroup] = useState(patientBloodGroup ?? "");

  // Left panel
  const [cc, setCc] = useState("");
  const [pmh, setPmh] = useState("");
  const [historyPersonal, setHistoryPersonal] = useState("");
  const [historyFamily, setHistoryFamily] = useState("");
  const [historyImmunization, setHistoryImmunization] = useState("");
  const [historyAllergy, setHistoryAllergy] = useState("");
  const [historyOthers, setHistoryOthers] = useState("");
  const [dh, setDh] = useState("");
  const [oe, setOe] = useState("");
  const [investigation, setInvestigation] = useState("");
  const [adviceNewInv, setAdviceNewInv] = useState("");

  // Center panel
  const [diagnoses, setDiagnoses] = useState<string[]>(
    initialDiagnosis ? [initialDiagnosis] : [],
  );
  const [diagnosis, setDiagnosis] = useState(initialDiagnosis ?? "");
  const [diagnosisQuery, setDiagnosisQuery] = useState("");
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<
    Array<{ label: string; type: "DIMS" | "Template"; item: unknown }>
  >([]);
  const [showDiagnosisDrop, setShowDiagnosisDrop] = useState(false);
  const [dimsActive, setDimsActive] = useState(false);

  const [rxDrugs, setRxDrugs] = useState<RxDrug[]>([]);
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);

  // Drug input form
  const [drugForm, setDrugForm] = useState("Tab.");
  const [drugRoute, setDrugRoute] = useState("PO");
  const [drugName, setDrugName] = useState("");
  const [drugBrandName, setDrugBrandName] = useState("");
  const [drugNameType] = useState<"brand" | "generic">("generic");
  const [drugDose, setDrugDose] = useState("");
  const [drugDuration, setDrugDuration] = useState("");
  const [drugDurationBn, setDrugDurationBn] = useState("");
  const [drugInstructions, setDrugInstructions] = useState("");
  const [drugInstructionBn, setDrugInstructionBn] = useState("");
  const [drugFrequency, setDrugFrequency] = useState("");
  const [drugFrequencyBn, setDrugFrequencyBn] = useState("");
  const [drugSpecialInstruction, setDrugSpecialInstruction] = useState("");
  const [drugSpecialInstructionBn, setDrugSpecialInstructionBn] = useState("");
  // PRN (as-needed) state
  const [drugIsPrn, setDrugIsPrn] = useState(false);
  const [drugPrnCondition, setDrugPrnCondition] = useState("");
  // Dispensed As
  const [drugDispensedAs, setDrugDispensedAs] = useState<
    "" | "brand" | "generic" | "substituted"
  >("");
  const [drugSubstitutedBrand, setDrugSubstitutedBrand] = useState("");
  // Discontinuation reason dialog
  const [discDialogDrugId, setDiscDialogDrugId] = useState<string | null>(null);
  const [discDialogDrugName, setDiscDialogDrugName] = useState("");

  // Treatment template
  const [treatmentQuery, setTreatmentQuery] = useState("");
  const [treatmentResults, setTreatmentResults] = useState<TreatmentTemplate[]>(
    [],
  );
  const [showTreatmentSection, setShowTreatmentSection] = useState(false);

  // Advice
  const [adviceText, setAdviceText] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [adviceQuery, setAdviceQuery] = useState("");
  const [adviceCategory, setAdviceCategory] = useState("সব");
  const [allTemplates, setAllTemplates] = useState<AdviceTemplate[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customCategory, setCustomCategory] = useState("Custom");

  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcTab, setCalcTab] = useState("dose-weight");
  // Dose by weight
  const [calcDosePerKg, setCalcDosePerKg] = useState("");
  const [calcWeightKg, setCalcWeightKg] = useState(patientWeight ?? "");
  // Dose by age (Young's rule)
  const [calcAdultDose, setCalcAdultDose] = useState("");
  const [calcAgeYears, setCalcAgeYears] = useState(
    patientAge != null ? String(patientAge) : "",
  );
  // CrCl
  const [calcCrClAge, setCalcCrClAge] = useState(
    patientAge != null ? String(patientAge) : "",
  );
  const [calcCrClWeight, setCalcCrClWeight] = useState(patientWeight ?? "");
  const [calcCrClSex, setCalcCrClSex] = useState("M");
  const [calcCrClCreat, setCalcCrClCreat] = useState("");
  // BMI
  const [calcBmiWeight, setCalcBmiWeight] = useState(patientWeight ?? "");
  const [calcBmiHeight, setCalcBmiHeight] = useState(
    patientHeight ? String(patientHeight) : "",
  );
  // BSA
  const [calcBsaWeight, setCalcBsaWeight] = useState(patientWeight ?? "");
  const [calcBsaHeight, setCalcBsaHeight] = useState("");
  // Pediatric fluid
  const [calcFluidWeight, setCalcFluidWeight] = useState(patientWeight ?? "");
  // MAP
  const [calcMapSbp, setCalcMapSbp] = useState("");
  const [calcMapDbp, setCalcMapDbp] = useState("");
  const [lastCalculatorResult, setLastCalculatorResult] = useState<string>("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Build extra investigation text from linked tracked investigations */
  function getLinkedInvestigationText(): string {
    const tracked = loadTrackedInvestigations(String(patientId));
    const linked = tracked.filter((t) => t.linkedToPrescription && t.result);
    if (linked.length === 0) return "";
    const lines = linked.map((t) => {
      const r = t.result!;
      const dateStr = new Date(r.recordedAt).toISOString().split("T")[0];
      return `${dateStr}: ${t.name} - ${r.value}${r.unit ? ` ${r.unit}` : ""}${r.interpretation !== "Normal" ? ` (${r.interpretation})` : ""}`;
    });
    return lines.join("\n");
  }

  function applyVisitData(vd: Record<string, unknown>) {
    const pop = populateFromVisitData(vd, patientWeight);
    if (pop.cc) setCc(pop.cc);
    if (pop.pmh) setPmh(pop.pmh);
    if (pop.histPersonal) setHistoryPersonal(pop.histPersonal);
    if (pop.histFamily) setHistoryFamily(pop.histFamily);
    if (pop.histImmunization) setHistoryImmunization(pop.histImmunization);
    if (pop.histAllergy) setHistoryAllergy(pop.histAllergy);
    if (pop.histOthers) setHistoryOthers(pop.histOthers);
    if (pop.dh) setDh(pop.dh);
    if (pop.oe) setOe(pop.oe);
    // Merge visit investigations with linked tracked results
    const linkedText = getLinkedInvestigationText();
    const combined = [pop.investigation, linkedText].filter(Boolean).join("\n");
    if (combined) setInvestigation(combined);
    if (pop.adviceNewInv) setAdviceNewInv(pop.adviceNewInv);
  }

  // Load draft or visit data
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    try {
      if (
        forceVisitData &&
        visitExtendedData &&
        typeof visitExtendedData === "object"
      ) {
        // Skip draft, load from this specific visit
        applyVisitData(visitExtendedData);
      } else {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          try {
            const d = JSON.parse(raw);
            if (d && typeof d === "object") {
              if (d.cc) setCc(d.cc);
              if (d.pmh) setPmh(d.pmh);
              if (d.dh) setDh(d.dh);
              if (d.oe) setOe(d.oe);
              // Merge draft investigation text with any newly linked tracked results
              const linkedText = getLinkedInvestigationText();
              const mergedInv = [d.investigation, linkedText]
                .filter(Boolean)
                .join("\n");
              if (mergedInv) setInvestigation(mergedInv);
              if (d.adviceNewInv) setAdviceNewInv(d.adviceNewInv);
              if (d.adviceText) setAdviceText(d.adviceText);
              if (d.followUpDate) setFollowUpDate(d.followUpDate);
              if (d.diagnoses) setDiagnoses(d.diagnoses);
              else if (d.diagnosis) setDiagnoses([d.diagnosis]);
              if (d.diagnosis) setDiagnosis(d.diagnosis);
              if (d.rxDrugs) setRxDrugs(d.rxDrugs);
            }
          } catch {
            /* ignore corrupt draft */
          }
        } else if (visitExtendedData && typeof visitExtendedData === "object") {
          applyVisitData(visitExtendedData);
        }
      }
    } catch {
      /* ignore */
    }
    try {
      setAllTemplates(getAllTemplates());
    } catch {
      /* ignore */
    }
  }, [DRAFT_KEY]);

  // Auto-save draft
  const saveDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          cc,
          pmh,
          dh,
          oe,
          investigation,
          adviceNewInv,
          adviceText,
          followUpDate,
          diagnoses,
          diagnosis,
          rxDrugs,
        }),
      );
    }, 800);
  }, [
    DRAFT_KEY,
    cc,
    pmh,
    dh,
    oe,
    investigation,
    adviceNewInv,
    adviceText,
    followUpDate,
    diagnoses,
    diagnosis,
    rxDrugs,
  ]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  // Diagnosis search
  useEffect(() => {
    if (diagnosisQuery.length < 2) {
      setDiagnosisSuggestions([]);
      setShowDiagnosisDrop(false);
      return;
    }
    const dimsResults = searchDims(diagnosisQuery).map((e) => ({
      label: e.diagnosis,
      type: "DIMS" as const,
      item: e,
    }));
    const tplResults = searchTreatmentTemplates(diagnosisQuery).map((t) => ({
      label: t.diagnosis,
      type: "Template" as const,
      item: t,
    }));
    setDiagnosisSuggestions([...dimsResults, ...tplResults].slice(0, 10));
    setShowDiagnosisDrop(true);
  }, [diagnosisQuery]);

  // Treatment search
  useEffect(() => {
    if (treatmentQuery.length < 2) {
      setTreatmentResults([]);
      return;
    }
    setTreatmentResults(searchTreatmentTemplates(treatmentQuery));
  }, [treatmentQuery]);

  function addDiagnosis(label: string) {
    if (!label.trim()) return;
    setDiagnoses((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setDiagnosis(label);
    setDiagnosisQuery("");
    setShowDiagnosisDrop(false);
  }

  function removeDiagnosis(label: string) {
    setDiagnoses((prev) => prev.filter((d) => d !== label));
  }

  function applyDiagnosisSuggestion(s: {
    label: string;
    type: "DIMS" | "Template";
    item: unknown;
  }) {
    addDiagnosis(s.label);
    if (s.type === "DIMS") {
      const entry = getDimsByDiagnosis(s.label);
      if (entry) {
        const drugs: RxDrug[] = entry.medications.map((m) => ({
          id: Math.random().toString(36).slice(2),
          drugForm: "Tab.",
          route: "PO",
          routeBn: "মুখে",
          drugName: m.name,
          brandName: "",
          nameType: "generic" as const,
          dose: m.dose,
          duration: m.duration,
          durationBn: "",
          instructions: m.instructions,
          instructionBn: "",
          frequency: m.frequency,
          frequencyBn: "",
          specialInstruction: "",
          specialInstructionBn: "",
        }));
        setRxDrugs((prev) => [...prev, ...drugs]);
        setDimsActive(true);
      }
    } else {
      const tpl = s.item as TreatmentTemplate;
      addDiagnosis(tpl.diagnosis);
      setRxDrugs((prev) => [...prev, ...tpl.drugs.map(drugFromTreatmentDrug)]);
      if (tpl.advice)
        setAdviceText((prev) =>
          prev ? `${prev}\n${tpl.advice!.join("\n")}` : tpl.advice!.join("\n"),
        );
      setDimsActive(false);
    }
  }

  function applyTreatmentTemplate(tpl: TreatmentTemplate) {
    addDiagnosis(tpl.diagnosis);
    setRxDrugs((prev) => [...prev, ...tpl.drugs.map(drugFromTreatmentDrug)]);
    if (tpl.advice)
      setAdviceText((prev) =>
        prev ? `${prev}\n${tpl.advice!.join("\n")}` : tpl.advice!.join("\n"),
      );
    setTreatmentQuery("");
    setTreatmentResults([]);
    setDimsActive(false);
  }

  function loadDrugForEditing(drug: RxDrug) {
    setDrugForm(drug.drugForm || "Tab.");
    setDrugRoute(drug.route || "PO");
    setDrugName(drug.drugName);
    setDrugBrandName(drug.brandName || "");
    setDrugDose(drug.dose || "");
    setDrugDuration(drug.duration || "");
    setDrugDurationBn(drug.durationBn || "");
    setDrugInstructions(drug.instructions || "");
    setDrugInstructionBn(drug.instructionBn || "");
    setDrugFrequency(drug.frequency || "");
    setDrugFrequencyBn(drug.frequencyBn || "");
    setDrugSpecialInstruction(drug.specialInstruction || "");
    setDrugSpecialInstructionBn(drug.specialInstructionBn || "");
    setDrugIsPrn(drug.isPrn ?? false);
    setDrugPrnCondition(drug.prnCondition || "");
    setEditingDrugId(drug.id);
    // Scroll to medication form
    setTimeout(() => {
      const el = document.getElementById("rx-med-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function addDrug() {
    if (!drugName.trim()) return;
    // Allergy check before adding
    const matchedAllergen = checkDrugAllergyMatch(
      drugName.trim(),
      unifiedAllergies,
    );

    // If editing existing drug, update it instead of adding new
    if (editingDrugId) {
      const updatedDrug = {
        drugForm,
        route: drugRoute,
        routeBn: ROUTES_BN.find((r) => r.en === drugRoute)?.bn || "মুখে",
        drugName: drugName.trim(),
        brandName: drugBrandName.trim(),
        dose: drugDose,
        duration: drugDuration,
        durationBn: drugDurationBn,
        instructions: drugInstructions,
        instructionBn: drugInstructionBn,
        frequency: drugFrequency,
        frequencyBn: drugFrequencyBn,
        specialInstruction: drugSpecialInstruction,
        specialInstructionBn: drugSpecialInstructionBn,
        isPrn: drugIsPrn,
        prnCondition: drugIsPrn ? drugPrnCondition : "",
      };
      if (matchedAllergen) {
        setAllergyAlert({
          drugId: editingDrugId,
          drugName: drugName.trim(),
          allergen: matchedAllergen,
        });
        setShowOverrideForm(false);
        setOverrideJustification("");
      }
      setRxDrugs((prev) =>
        prev.map((d) =>
          d.id === editingDrugId ? { ...d, ...updatedDrug } : d,
        ),
      );
      setEditingDrugId(null);
      setDrugName("");
      setDrugBrandName("");
      setDrugDose("");
      setDrugDuration("");
      setDrugDurationBn("");
      setDrugInstructions("");
      setDrugInstructionBn("");
      setDrugFrequency("");
      setDrugFrequencyBn("");
      setDrugSpecialInstruction("");
      setDrugSpecialInstructionBn("");
      setDrugIsPrn(false);
      setDrugPrnCondition("");
      return;
    }
    const newDrug: RxDrug = {
      id: Math.random().toString(36).slice(2),
      drugForm,
      route: drugRoute,
      routeBn: ROUTES_BN.find((r) => r.en === drugRoute)?.bn || "মুখে",
      drugName: drugName.trim(),
      brandName: drugBrandName.trim(),
      nameType: drugNameType,
      dose: drugDose,
      duration: drugDuration,
      durationBn: drugDurationBn,
      instructions: drugInstructions,
      instructionBn: drugInstructionBn,
      frequency: drugFrequency,
      frequencyBn: drugFrequencyBn,
      specialInstruction: drugSpecialInstruction,
      specialInstructionBn: drugSpecialInstructionBn,
      isPrn: drugIsPrn,
      prnCondition: drugIsPrn ? drugPrnCondition : "",
      dispensedAs: drugDispensedAs || undefined,
      substitutedBrand:
        drugDispensedAs === "substituted" ? drugSubstitutedBrand : undefined,
    };
    setRxDrugs((prev) => [...prev, newDrug]);
    // Show allergy alert after adding
    if (matchedAllergen) {
      setAllergyAlert({
        drugId: newDrug.id,
        drugName: newDrug.drugName,
        allergen: matchedAllergen,
      });
      setShowOverrideForm(false);
      setOverrideJustification("");
    }
    setDrugName("");
    setDrugBrandName("");
    setDrugDose("");
    setDrugDuration("");
    setDrugDurationBn("");
    setDrugInstructions("");
    setDrugInstructionBn("");
    setDrugFrequency("");
    setDrugFrequencyBn("");
    setDrugSpecialInstruction("");
    setDrugSpecialInstructionBn("");
    setDrugIsPrn(false);
    setDrugPrnCondition("");
  }

  function deleteDrug(id: string) {
    const drug = rxDrugs.find((d) => d.id === id);
    if (drug) {
      setDiscDialogDrugId(id);
      setDiscDialogDrugName(drug.brandName || drug.drugName || "this drug");
    } else {
      setRxDrugs((prev) => prev.filter((d) => d.id !== id));
    }
  }

  function confirmDeleteDrug(reason: DiscontinuationReason, _note: string) {
    if (!discDialogDrugId) return;
    setRxDrugs((prev) =>
      prev
        .map((d) =>
          d.id === discDialogDrugId
            ? {
                ...d,
                discontinuationReason: reason,
                discontinuedAt: Date.now(),
              }
            : d,
        )
        .filter((d) => d.id !== discDialogDrugId),
    );
    setDiscDialogDrugId(null);
    setDiscDialogDrugName("");
  }

  function updateDrug(
    id: string,
    field: keyof RxDrug,
    value: string | boolean,
  ) {
    const coerced: string | boolean =
      typeof value === "string" && (value === "true" || value === "false")
        ? value === "true"
        : value;
    setRxDrugs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: coerced } : d)),
    );
  }

  function appendAdvice(text: string) {
    setAdviceText((prev) => (prev ? `${prev}\n${text}` : text));
  }

  function addCustomTemplate() {
    if (!customText.trim()) return;
    const tpl: AdviceTemplate = {
      id: `custom_${Date.now()}`,
      text: customText.trim(),
      category: customCategory,
      isCustom: true,
    };
    saveCustomTemplate(tpl);
    setAllTemplates(getAllTemplates());
    setCustomText("");
    setShowCustomForm(false);
  }

  function removeCustomTemplate(id: string) {
    deleteCustomTemplate(id);
    setAllTemplates(getAllTemplates());
  }

  const filteredTemplates = allTemplates.filter((t) => {
    const matchCat =
      adviceCategory === "সব"
        ? true
        : adviceCategory === "Custom"
          ? t.isCustom
          : t.category === adviceCategory;
    const matchQ =
      adviceQuery.length < 1
        ? true
        : t.text.toLowerCase().includes(adviceQuery.toLowerCase());
    return matchCat && matchQ;
  });

  // ── Duration/follow-up mismatch helpers ──────────────────────────────────────
  function parseDurationDays(durationStr: string): number {
    if (!durationStr) return 0;
    const s = durationStr.toLowerCase().trim();
    if (s.includes("month")) {
      const n = Number.parseFloat(s) || 1;
      return n * 30;
    }
    if (s.includes("week")) {
      const n = Number.parseFloat(s) || 1;
      return n * 7;
    }
    const n = Number.parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
  }

  /** Max days any non-PRN drug's duration covers */
  const maxDrugDays = rxDrugs
    .filter((d) => !d.isPrn)
    .reduce(
      (max, d) =>
        Math.max(max, parseDurationDays(d.duration || d.durationBn || "")),
      0,
    );

  /** Days until follow-up */
  const followUpGapDays = followUpDate
    ? Math.round(
        (new Date(followUpDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const durationMismatchWarning =
    followUpDate &&
    maxDrugDays > 0 &&
    followUpGapDays !== null &&
    followUpGapDays > maxDrugDays
      ? `Patient may run out of medication ${followUpGapDays - maxDrugDays} day(s) before follow-up. Consider extending the prescription duration.`
      : null;

  // ── Weight warning ─────────────────────────────────────────────────────────
  const hasWeightWarning =
    !patientWeight ||
    Number.isNaN(Number.parseFloat(patientWeight)) ||
    Number.parseFloat(patientWeight) <= 0;

  function handleSave() {
    const medications: Medication[] = rxDrugs.map((d) => ({
      name: `${d.drugForm ? `${d.drugForm} ` : ""}${d.drugName}${d.brandName ? ` (${d.brandName})` : ""}`,
      dose: d.dose,
      frequency: d.isPrn
        ? `PRN${d.prnCondition ? ` — ${d.prnCondition}` : ""}`
        : d.frequencyBn || d.frequency || d.durationBn || d.duration,
      duration: d.isPrn ? "" : d.durationBn || d.duration,
      instructions:
        d.instructionBn ||
        d.instructions ||
        d.specialInstructionBn ||
        d.specialInstruction,
      drugName: d.drugName,
      drugForm: d.drugForm,
      brandName: d.brandName,
      route: d.route,
      routeBn: d.routeBn,
      frequencyBn: d.frequencyBn,
      durationBn: d.durationBn,
      instructionsBn: d.instructionBn,
      specialInstruction: d.specialInstruction,
      specialInstructionBn: d.specialInstructionBn,
      isPrn: d.isPrn ? "true" : "false",
      prnCondition: d.prnCondition || "",
    }));

    // Intern draft-lock: show modal instead of saving as active
    if (isIntern) {
      setShowDraftModal(true);
      _persistPrescription(medications, "draft_awaiting_approval");
      return;
    }

    _persistPrescription(medications, "active");
  }

  function _persistPrescription(
    medications: Medication[],
    status: "active" | "draft_awaiting_approval",
  ) {
    onSubmit({
      patientId,
      visitId: visitId ?? null,
      prescriptionDate: BigInt(Date.now()) * BigInt(1_000_000),
      diagnosis:
        diagnoses.length > 0 ? diagnoses.join(" + ") : diagnosis || null,
      medications,
      notes: adviceText || null,
    });

    // Determine label for admitted patients
    const existingRecords = loadPrescriptionRecords(patientId);
    const patientRecords = existingRecords.filter(
      (r) => r.patientId === patientId.toString(),
    );
    let label: import("../types").PrescriptionLabel = null;
    let labelTimestamp: string | undefined;
    if (headerType === "hospital") {
      if (patientRecords.length === 0) {
        label = "Order on Admission";
      } else {
        label = "Fresh Order";
        labelTimestamp = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    }

    // Save versioned prescription record
    const snapId = `${patientId}-${Date.now()}`;
    const newRecord: import("../types").PrescriptionRecord = {
      id: snapId,
      patientId: patientId.toString(),
      version: patientRecords.length + 1,
      createdAt: new Date().toISOString(),
      createdBy: currentDoctor?.name ?? getDoctorEmail(),
      createdByRole: userRole as import("../types").StaffRole,
      label,
      labelTimestamp,
      headerType,
      status,
      finalizedAt: status === "active" ? new Date().toISOString() : undefined,
      diagnosis:
        diagnoses.length > 0 ? diagnoses.join(" + ") : diagnosis || undefined,
      drugs: rxDrugs,
      adviceText: adviceText || undefined,
      clinicalSummary: {
        cc,
        pmh,
        dh,
        oe,
        historyPersonal,
        historyFamily,
        historyImmunization,
        historyAllergy,
        historyOthers,
        investigation,
        adviceNewInv,
      },
      // ── Clinical summary snapshot — locked at finalization time ──────────────
      ...(status === "active"
        ? {
            finalizedSnapshot: {
              lockedAt: Date.now(),
              lockedBy: currentDoctor?.email ?? getDoctorEmail(),
              chiefComplaint: cc,
              pastHistory: pmh,
              onExamination: oe,
              diagnosis:
                diagnoses.length > 0 ? diagnoses.join(" + ") : diagnosis || "",
              investigations: investigation
                ? investigation.split("\n").filter(Boolean)
                : [],
            },
          }
        : {}),
    };
    savePrescriptionRecords(patientId, [...existingRecords, newRecord]);

    // ── Drug History auto-update on finalization ──────────────────────────────
    if (status === "active") {
      try {
        const doctorEmail = getDoctorEmail();
        // Try to find the most recent visit's drug history key for this patient
        const visitKeys = Object.keys(localStorage).filter(
          (k) =>
            k.startsWith("visit_form_data_") && k.endsWith(`_${doctorEmail}`),
        );
        // Look through all visits for this patient
        const patientIdStr = patientId.toString();
        let latestVisitKey: string | null = null;
        let latestTs = 0;
        for (const key of visitKeys) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (
              String(parsed.patientId ?? "") === patientIdStr ||
              key.includes(patientIdStr)
            ) {
              // Use key ordering — latest numeric id is largest
              const parts = key.split("_");
              const idPart = Number(parts[3] ?? "0");
              if (!Number.isNaN(idPart) && idPart > latestTs) {
                latestTs = idPart;
                latestVisitKey = key;
              }
            }
          } catch {
            /* ignore */
          }
        }
        // Also check using visitId if provided
        if (visitId) {
          const directKey = `visit_form_data_${visitId}_${doctorEmail}`;
          if (localStorage.getItem(directKey)) latestVisitKey = directKey;
        }
        if (latestVisitKey) {
          const raw = localStorage.getItem(latestVisitKey);
          if (raw) {
            const visitData = JSON.parse(raw) as Record<string, unknown>;
            const currentDrugNames = new Set(
              rxDrugs.map((d) => d.drugName.trim().toLowerCase()),
            );
            // Mark old drugs as Previous if not in new prescription
            const existingDrugHistory =
              (visitData.drugHistory as Array<{
                name: string;
                dose?: string;
                duration?: string;
                status?: string;
                markedPreviousAt?: number;
                updatedAt?: number;
              }>) || [];
            const updated = existingDrugHistory.map((entry) => {
              if (!currentDrugNames.has((entry.name ?? "").toLowerCase())) {
                return {
                  ...entry,
                  status: "Previous",
                  markedPreviousAt: Date.now(),
                };
              }
              return entry;
            });
            // Add/update current prescription drugs
            for (const drug of rxDrugs) {
              const existing = updated.find(
                (e) => e.name.toLowerCase() === drug.drugName.toLowerCase(),
              );
              if (existing) {
                existing.status = "Current";
                existing.updatedAt = Date.now();
              } else {
                updated.push({
                  name: drug.drugName,
                  dose: drug.dose,
                  duration: drug.duration,
                  status: "Current",
                  updatedAt: Date.now(),
                });
              }
            }
            visitData.drugHistory = updated;
            localStorage.setItem(latestVisitKey, JSON.stringify(visitData));
          }
        }
      } catch {
        /* ignore drug history update errors */
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Save full snapshot for exact preview reconstruction
    const snapshotKey = "medicare_rx_snapshots";
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(snapshotKey) || "{}");
      } catch {
        return {};
      }
    })();
    existing[snapId] = {
      id: snapId,
      patientId: patientId.toString(),
      savedAt: new Date().toISOString(),
      headerType,
      withHeader,
      name,
      age,
      sex,
      weight,
      rxDate,
      regNo,
      address,
      bloodGroup,
      diagnoses: [...diagnoses],
      drugs: rxDrugs,
      adviceText,
      cc,
      pmh,
      oe,
      dh,
      historyPersonal,
      historyFamily,
      historyImmunization,
      historyAllergy,
      historyOthers,
      investigation,
      adviceNewInv,
      label,
      labelTimestamp,
      status,
    };
    localStorage.setItem(snapshotKey, JSON.stringify(existing));
    localStorage.removeItem(DRAFT_KEY);

    // Auto-populate drug reminders (only for active, non-PRN prescriptions)
    if (status === "active") {
      const nonPrnMeds = medications.filter((m) => m.isPrn !== "true");
      autoPopulateDrugReminders(patientId, nonPrnMeds, snapId);
    }

    // Auto-create follow-up appointment if follow-up date is set
    if (status === "active" && followUpDate) {
      try {
        const apptKey = "medicare_appointments";
        const existingAppts = (() => {
          try {
            return JSON.parse(localStorage.getItem(apptKey) ?? "[]") as Record<
              string,
              unknown
            >[];
          } catch {
            return [] as Record<string, unknown>[];
          }
        })();
        const appt: Record<string, unknown> = {
          id: `fu_${Date.now().toString(36)}`,
          patientId: patientId.toString(),
          patientName: name || "Patient",
          phone: "",
          registerNumber: regNo || undefined,
          preferredDoctor: currentDoctor?.name ?? getDoctorEmail(),
          preferredChamber: undefined,
          preferredDate: followUpDate,
          preferredTime: "10:00",
          reason: "Prescription follow-up",
          status: "confirmed",
          createdAt: new Date().toISOString(),
          createdBy: currentDoctor?.name ?? getDoctorEmail(),
          notes: "Auto-created from prescription follow-up date",
          appointmentType: "chamber",
        };
        localStorage.setItem(apptKey, JSON.stringify([appt, ...existingAppts]));
        const formattedDate = new Date(followUpDate).toLocaleDateString(
          "en-GB",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          },
        );
        toast.success(`Follow-up appointment created for ${formattedDate}`, {
          description: "Added to appointments list",
          style: { backgroundColor: "#f0fdf4", color: "#166534" },
        });
      } catch {
        /* ignore appointment creation errors */
      }
    }
  }

  function getDoctorInfo() {
    try {
      // Try per-doctor profile key first (matches useQueries.ts pattern)
      const sessionId = localStorage.getItem("medicare_current_doctor");
      if (sessionId) {
        const registry = JSON.parse(
          localStorage.getItem("medicare_doctors_registry") || "[]",
        ) as Array<{ id: string; email: string }>;
        const doctor = registry.find((d) => d.id === sessionId);
        if (doctor?.email) {
          const profileRaw = localStorage.getItem(
            `doctor_profile_${doctor.email}`,
          );
          if (profileRaw) {
            const profile = JSON.parse(profileRaw);
            if (profile) return profile;
          }
        }
      }
    } catch {
      /* ignore */
    }
    try {
      // Fallback: legacy key
      const data = localStorage.getItem("medicare_doctors_data");
      if (data) {
        const parsed = JSON.parse(data);
        const doc =
          parsed.drArman || (Array.isArray(parsed) ? parsed[0] : null) || null;
        if (doc) return doc;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  const doctorInfo = getDoctorInfo();

  const inp = `w-full border rounded px-2 py-1 text-xs ${dark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300"}`;
  const rootClass = `fixed inset-0 z-50 flex flex-col overflow-hidden ${
    dark ? "dark bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"
  }`;

  return (
    <div className={rootClass}>
      {/* INTERN DRAFT MODAL */}
      <Dialog open={showDraftModal} onOpenChange={setShowDraftModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              📋 Prescription Saved as Draft
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              Your prescription has been saved as a{" "}
              <strong>Draft – Awaiting Approval</strong>. A Consultant Doctor or
              Medical Officer will review and approve it before it becomes
              active.
            </div>
            <p className="text-sm text-muted-foreground">
              The prescription will not appear in the active medication chart or
              drug reminders until approved.
            </p>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setShowDraftModal(false);
                onCancel();
              }}
            >
              OK – Close Prescription
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* HEADER IMAGE UPLOAD DIALOG */}
      <Dialog open={showHeaderUpload} onOpenChange={setShowHeaderUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Prescription Header</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {(["hospital", "chamber"] as PrescriptionHeaderType[]).map(
                (type) => {
                  const img =
                    type === "hospital" ? hospitalHeaderImg : chamberHeaderImg;
                  return (
                    <div key={type} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-3 mb-3 py-2 px-3 rounded-lg border border-dashed border-purple-300 bg-purple-50/50">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={drugIsPrn}
                            onChange={(e) => setDrugIsPrn(e.target.checked)}
                            className="w-4 h-4 accent-purple-600"
                            data-ocid="rx.drug_prn.toggle"
                          />
                          <span className="text-sm font-semibold text-purple-700">
                            PRN (as-needed)
                          </span>
                        </label>
                        {drugIsPrn && (
                          <input
                            className={`flex-1 border rounded px-2 py-1 text-sm border-purple-300 ${dark ? "bg-gray-800 text-white" : "bg-white"}`}
                            value={drugPrnCondition}
                            onChange={(e) =>
                              setDrugPrnCondition(e.target.value)
                            }
                            placeholder="Condition: e.g. if fever > 38°C"
                            data-ocid="rx.drug_prn_condition.input"
                          />
                        )}
                        {drugIsPrn && (
                          <span className="text-xs text-purple-500 italic shrink-0">
                            No reminder bell
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {type === "hospital" ? (
                          <Hospital className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Building2 className="w-4 h-4 text-teal-600" />
                        )}
                        <span className="text-sm font-semibold capitalize">
                          {type} Header
                        </span>
                      </div>
                      {img && (
                        <img
                          src={img}
                          alt={`${type} header`}
                          className="max-h-16 object-contain border rounded"
                        />
                      )}
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-muted rounded border text-sm hover:bg-muted/80 transition-colors w-fit">
                        <Upload className="w-3.5 h-3.5" />
                        {img ? "Replace Image" : "Upload Image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              setPrescriptionHeaderImage(type, dataUrl);
                              if (type === "hospital")
                                setHospitalHeaderImg(dataUrl);
                              else setChamberHeaderImg(dataUrl);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {img && (
                        <button
                          type="button"
                          onClick={() => {
                            const email = getDoctorEmail();
                            localStorage.removeItem(
                              `prescriptionHeaders_${type}_${email}`,
                            );
                            if (type === "hospital") setHospitalHeaderImg(null);
                            else setChamberHeaderImg(null);
                          }}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                },
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => setShowHeaderUpload(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-3 py-2 bg-teal-700 text-white shadow z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">Prescription &amp; EMR</span>
          {isIntern && (
            <span className="px-2 py-0.5 bg-amber-400 text-amber-900 rounded text-xs font-semibold">
              Intern — Draft Mode
            </span>
          )}
          <Separator orientation="vertical" className="h-5 bg-teal-500" />

          {/* Header Type Toggle */}
          <div className="flex items-center gap-1 bg-teal-800 rounded p-0.5">
            <button
              type="button"
              onClick={() => setHeaderType("hospital")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                headerType === "hospital"
                  ? "bg-white text-teal-800"
                  : "text-teal-200 hover:text-white"
              }`}
              data-ocid="rx.header_hospital.toggle"
            >
              <Hospital className="w-3 h-3" /> Hospital
            </button>
            <button
              type="button"
              onClick={() => setHeaderType("chamber")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                headerType === "chamber"
                  ? "bg-white text-teal-800"
                  : "text-teal-200 hover:text-white"
              }`}
              data-ocid="rx.header_chamber.toggle"
            >
              <Building2 className="w-3 h-3" /> Chamber
            </button>
          </div>

          <Separator orientation="vertical" className="h-5 bg-teal-500" />
          <button
            type="button"
            onClick={() => setWithHeader(true)}
            className={`px-2 py-0.5 rounded text-sm font-medium border transition-colors ${
              withHeader
                ? "bg-white text-teal-800 border-white"
                : "border-teal-400 text-teal-100 hover:bg-teal-600"
            }`}
            data-ocid="rx.with_header.toggle"
          >
            With Header
          </button>
          <button
            type="button"
            onClick={() => setWithHeader(false)}
            className={`px-2 py-0.5 rounded text-sm font-medium border transition-colors ${
              !withHeader
                ? "bg-white text-teal-800 border-white"
                : "border-teal-400 text-teal-100 hover:bg-teal-600"
            }`}
            data-ocid="rx.without_header.toggle"
          >
            Without Header
          </button>
          {canEditHeader && (
            <button
              type="button"
              onClick={() => setShowHeaderUpload(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-teal-400 text-teal-100 hover:bg-teal-600 transition-colors"
              data-ocid="rx.edit_header.button"
            >
              <Upload className="w-3 h-3" /> Edit Header
            </button>
          )}
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="p-1 rounded hover:bg-teal-600 transition-colors"
            data-ocid="rx.dark_mode.toggle"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onCancel}
            className="h-7 text-sm"
            data-ocid="rx.cancel.button"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            className={`h-7 text-sm ${isIntern ? "bg-amber-400 text-amber-900 hover:bg-amber-300" : "bg-white text-teal-800 hover:bg-teal-50"}`}
            data-ocid="rx.save.button"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            {isLoading
              ? "Saving..."
              : isIntern
                ? "Save as Draft"
                : "Save Prescription"}
          </Button>
        </div>
      </div>

      {/* PATIENT INFO PANEL */}
      <div
        className={`flex-shrink-0 border-b px-3 py-2 ${
          dark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {[
            {
              label: "Name",
              value: name,
              set: setName,
              id: "rx.name.input",
            },
          ].map((f) => (
            <div key={f.label} className="col-span-2">
              <span className="text-muted-foreground text-sm block mb-0.5">
                {f.label}
              </span>
              <input
                className={inp}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                data-ocid={f.id}
              />
            </div>
          ))}
          <div>
            <span className="text-muted-foreground text-sm block mb-0.5">
              Age <span className="font-bold text-xs">(yrs)</span>
            </span>
            <input
              className={inp}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              data-ocid="rx.age.input"
            />
          </div>
          <div>
            <span className="text-muted-foreground text-sm block mb-0.5">
              Sex
            </span>
            <select
              className={`${inp}`}
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              data-ocid="rx.sex.select"
            >
              <option value="">--</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          {[
            {
              label: "Weight (kg)",
              value: weight,
              set: setWeight,
              id: "rx.weight.input",
            },
            {
              label: "Date",
              value: rxDate,
              set: setRxDate,
              id: "rx.date.input",
            },
            {
              label: "Reg No",
              value: regNo,
              set: setRegNo,
              id: "rx.reg_no.input",
            },
            {
              label: "Address",
              value: address,
              set: setAddress,
              id: "rx.address.input",
            },
          ].map((f) => (
            <div key={f.label}>
              <span className="text-muted-foreground text-sm block mb-0.5">
                {f.label}
              </span>
              <input
                className={inp}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                data-ocid={f.id}
              />
            </div>
          ))}
          <div>
            <span className="text-muted-foreground text-sm block mb-0.5">
              Blood Group
            </span>
            <select
              className={inp}
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              data-ocid="rx.blood_group.select"
            >
              <option value="">--</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* HEADER SETTINGS PANEL — collapsed by default */}
      <div
        className={`flex-shrink-0 px-3 py-2 ${dark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"} border-b`}
      >
        <PrescriptionHeaderPanel
          headerType={headerType}
          isAdmitted={_isAdmitted}
          canEdit={
            userRole === "admin" ||
            userRole === "consultant_doctor" ||
            userRole === "doctor"
          }
        />
        {/* Weight/Height warning */}
        {hasWeightWarning && (
          <div
            className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800"
            data-ocid="rx.weight_warning.panel"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>
              ⚠ No recent weight recorded — verify dose, especially for
              weight-based dosing
            </span>
          </div>
        )}
        {!hasWeightWarning && patientWeight && (
          <div className="mt-1.5 text-xs text-gray-500 px-1">
            Last recorded: Weight{" "}
            <span className="font-semibold text-gray-700">
              {patientWeight} kg
            </span>
            {patientHeight && (
              <>
                {" "}
                / Height{" "}
                <span className="font-semibold text-gray-700">
                  {patientHeight} cm
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Discontinuation reason dialog */}
      <DiscontinuationDialog
        drugName={discDialogDrugName}
        open={discDialogDrugId !== null}
        onConfirm={confirmDeleteDrug}
        onCancel={() => {
          setDiscDialogDrugId(null);
          setDiscDialogDrugName("");
        }}
      />

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Clinical Summary */}
        <ScrollArea
          className={`w-[30%] border-r flex-shrink-0 ${
            dark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          <div className="p-2 space-y-2">
            {/* Header + Load button */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide">
                Clinical Summary
              </h3>
              {visitExtendedData && (
                <button
                  type="button"
                  onClick={() => applyVisitData(visitExtendedData)}
                  className="flex items-center gap-1 text-sm px-2 py-0.5 bg-teal-100 text-teal-700 border border-teal-300 rounded hover:bg-teal-200 transition-colors"
                  data-ocid="rx.load_from_visit.button"
                >
                  <RefreshCw className="w-3 h-3" />
                  Load from Visit
                </button>
              )}
            </div>

            {/* C/C */}
            <div className="rounded-lg border-l-4 border-l-blue-400 border border-blue-200 bg-blue-50 p-2">
              <span className="text-sm font-bold text-blue-700 uppercase tracking-wide block mb-1">
                C/C — Chief Complaints
              </span>
              <Textarea
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                rows={4}
                className="text-sm resize-y bg-white border-blue-200 focus:ring-blue-300"
                placeholder="1. Cough — dry, 5 days&#10;2. Fever — high grade"
                data-ocid="rx.cc.textarea"
              />
            </div>

            {/* P/M/H */}
            <div className="rounded-lg border-l-4 border-l-green-500 border border-green-200 bg-green-50 p-2">
              <span className="text-sm font-bold text-green-700 uppercase tracking-wide block mb-1">
                P/M/H — Past Medical &amp; Surgical History
              </span>
              <Textarea
                value={pmh}
                onChange={(e) => setPmh(e.target.value)}
                rows={3}
                className="text-sm resize-y bg-white border-green-200"
                placeholder="DM+, HTN-&#10;Surgical: Appendectomy 2020"
                data-ocid="rx.pmh.textarea"
              />
            </div>

            {/* History */}
            <div className="rounded-lg border-l-4 border-l-purple-500 border border-purple-200 bg-purple-50 p-2">
              <span className="text-sm font-bold text-purple-700 uppercase tracking-wide block mb-1">
                History
              </span>
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="w-full h-7 text-sm bg-purple-100">
                  {[
                    ["personal", "Personal"],
                    ["family", "Family"],
                    ["immun", "Immun."],
                    ["allergy", "Allergy"],
                    ["others", "Others"],
                  ].map(([val, lbl]) => (
                    <TabsTrigger
                      key={val}
                      value={val}
                      className="text-sm px-1 flex-1"
                    >
                      {lbl}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="personal">
                  <Textarea
                    value={historyPersonal}
                    onChange={(e) => setHistoryPersonal(e.target.value)}
                    rows={3}
                    className="text-sm bg-white border-purple-200"
                    data-ocid="rx.history_personal.textarea"
                  />
                </TabsContent>
                <TabsContent value="family">
                  <Textarea
                    value={historyFamily}
                    onChange={(e) => setHistoryFamily(e.target.value)}
                    rows={3}
                    className="text-sm bg-white border-purple-200"
                    data-ocid="rx.history_family.textarea"
                  />
                </TabsContent>
                <TabsContent value="immun">
                  <Textarea
                    value={historyImmunization}
                    onChange={(e) => setHistoryImmunization(e.target.value)}
                    rows={3}
                    className="text-sm bg-white border-purple-200"
                    data-ocid="rx.history_immunization.textarea"
                  />
                </TabsContent>
                <TabsContent value="allergy">
                  <Textarea
                    value={historyAllergy}
                    onChange={(e) => setHistoryAllergy(e.target.value)}
                    rows={3}
                    className="text-sm bg-white border-purple-200"
                    data-ocid="rx.history_allergy.textarea"
                  />
                </TabsContent>
                <TabsContent value="others">
                  <Textarea
                    value={historyOthers}
                    onChange={(e) => setHistoryOthers(e.target.value)}
                    rows={3}
                    className="text-sm bg-white border-purple-200"
                    data-ocid="rx.history_others.textarea"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* D/H */}
            <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-200 bg-amber-50 p-2">
              <span className="text-sm font-bold text-amber-700 uppercase tracking-wide block mb-1">
                D/H — Drug History
              </span>
              <Textarea
                value={dh}
                onChange={(e) => setDh(e.target.value)}
                rows={3}
                className="text-sm resize-y bg-white border-amber-200"
                placeholder="Tab. Napa 500mg 1+1+1, Tab. Fexo 120mg once daily"
                data-ocid="rx.dh.textarea"
              />
            </div>

            {/* O/E */}
            <div className="rounded-lg border-l-4 border-l-rose-500 border border-rose-200 bg-rose-50 p-2">
              <span className="text-sm font-bold text-rose-700 uppercase tracking-wide block mb-1">
                O/E — On Examination
              </span>
              <Textarea
                value={oe}
                onChange={(e) => setOe(e.target.value)}
                rows={4}
                className="text-sm resize-y bg-white border-rose-200"
                placeholder="BP: 120/80, Pulse: 82/min&#10;Heart: S1+S2+0, Lung: Clear"
                data-ocid="rx.oe.textarea"
              />
            </div>

            {/* Investigation */}
            <div className="rounded-lg border-l-4 border-l-teal-500 border border-teal-200 bg-teal-50 p-2">
              <span className="text-sm font-bold text-teal-700 uppercase tracking-wide block mb-1">
                Investigation Report
              </span>
              <Textarea
                value={investigation}
                onChange={(e) => setInvestigation(e.target.value)}
                rows={4}
                className="text-sm resize-y bg-white border-teal-200"
                placeholder="13/03/2026: Hb% - 12.3g/dl, S.Creatinine - 1.12&#10;12/03/2026: Blood Glucose - 6.5mmol/L"
                data-ocid="rx.investigation.textarea"
              />
            </div>

            {/* Advice/New Investigation */}
            <div className="rounded-lg border-l-4 border-l-orange-500 border border-orange-200 bg-orange-50 p-2">
              <span className="text-sm font-bold text-orange-700 uppercase tracking-wide block mb-1">
                Advice / New Investigation
              </span>
              <Textarea
                value={adviceNewInv}
                onChange={(e) => setAdviceNewInv(e.target.value)}
                rows={3}
                className="text-sm resize-y bg-white border-orange-200"
                placeholder="CBC, RBS, ECG..."
                data-ocid="rx.advice_new_inv.textarea"
              />
            </div>
          </div>
        </ScrollArea>

        {/* CENTER PANEL */}
        <ScrollArea className={`flex-1 ${dark ? "bg-gray-950" : "bg-gray-50"}`}>
          <div className="p-3 space-y-4">
            {/* DIAGNOSIS */}
            <div
              className={`rounded-lg p-3 ${
                dark ? "bg-gray-900" : "bg-white"
              } shadow-sm`}
            >
              <span className="text-sm font-semibold text-teal-700 uppercase tracking-wide block mb-2">
                Diagnosis
              </span>
              {/* Multi-diagnosis chips */}
              {diagnoses.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {diagnoses.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 text-xs font-medium px-2 py-0.5 rounded-full border border-teal-300"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeDiagnosis(d)}
                        className="ml-0.5 hover:text-red-600 text-teal-500 font-bold"
                        aria-label={`Remove ${d}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <input
                  className={`flex-1 border rounded px-2 py-1.5 text-sm ${
                    dark
                      ? "bg-gray-800 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && diagnosis.trim()) {
                      addDiagnosis(diagnosis.trim());
                    }
                  }}
                  placeholder="Type diagnosis (Enter to add)..."
                  data-ocid="rx.diagnosis.input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (diagnosis.trim()) addDiagnosis(diagnosis.trim());
                  }}
                  className="px-2 py-1.5 bg-teal-500 text-white rounded text-sm font-bold hover:bg-teal-600"
                  title="Add diagnosis"
                  data-ocid="rx.diagnosis.primary_button"
                >
                  +
                </button>
              </div>
              <input
                className={`mt-1.5 w-full border rounded px-2 py-1 text-sm ${
                  dark
                    ? "bg-gray-800 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
                value={diagnosisQuery}
                onChange={(e) => setDiagnosisQuery(e.target.value)}
                onFocus={() =>
                  diagnosisQuery.length >= 2 && setShowDiagnosisDrop(true)
                }
                placeholder="🔍 Search DIMS/templates..."
                data-ocid="rx.diagnosis_search.input"
              />
              {showDiagnosisDrop && diagnosisSuggestions.length > 0 && (
                <div
                  className={`mt-1 border rounded shadow-lg max-h-40 overflow-y-auto z-20 ${
                    dark
                      ? "bg-gray-800 border-gray-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {diagnosisSuggestions.map((s, i) => (
                    <button
                      key={`suggestion-${s.label}-${i}`}
                      type="button"
                      onClick={() => applyDiagnosisSuggestion(s)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 flex items-center gap-2 ${
                        dark ? "hover:bg-teal-900" : ""
                      }`}
                      data-ocid={`rx.diagnosis_suggestion.item.${i + 1}`}
                    >
                      <Badge
                        variant="outline"
                        className={`text-sm ${
                          s.type === "DIMS"
                            ? "border-blue-400 text-blue-600"
                            : "border-teal-400 text-teal-600"
                        }`}
                      >
                        {s.type}
                      </Badge>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {dimsActive && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-blue-100 text-blue-700 text-sm">
                    <Sparkles className="w-3 h-3 mr-1" />
                    DIMS Active
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setRxDrugs([]);
                      setDimsActive(false);
                    }}
                    className="text-sm text-red-500 underline"
                    data-ocid="rx.dims_reset.button"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* RX TABLE */}
            <div
              className={`rounded-lg p-3 ${
                dark ? "bg-gray-900" : "bg-white"
              } shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-teal-700 uppercase tracking-wide">
                  ℝ Prescription
                </span>
                <span className="text-sm text-muted-foreground">
                  {rxDrugs.length} drug(s)
                </span>
              </div>
              {/* Duration mismatch warning */}
              {durationMismatchWarning && (
                <div
                  className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-300 text-xs text-yellow-800"
                  data-ocid="rx.duration_mismatch.panel"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <span>{durationMismatchWarning}</span>
                </div>
              )}

              {/* ALLERGY ALERT BANNER */}
              {allergyAlert && (
                <div
                  className="mb-3 rounded-lg border-2 border-red-400 bg-red-50 p-3"
                  data-ocid="rx.allergy_alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-red-800">
                        ⚠ Allergy Alert: {patientName || "Patient"} is allergic
                        to{" "}
                        <strong className="capitalize">
                          {allergyAlert.allergen}
                        </strong>
                        . Adding <strong>{allergyAlert.drugName}</strong> may
                        cause a reaction.
                      </p>
                      {showOverrideForm ? (
                        <div className="mt-2 space-y-2">
                          <Label className="text-xs font-semibold text-red-700">
                            Clinical Justification (required)
                          </Label>
                          <Textarea
                            value={overrideJustification}
                            onChange={(e) =>
                              setOverrideJustification(e.target.value)
                            }
                            rows={2}
                            placeholder="e.g. Previous cross-reactivity ruled out, benefit outweighs risk..."
                            className="text-sm border-red-300 focus:ring-red-400"
                            data-ocid="rx.allergy_override.textarea"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const aid = allergyAlert.drugId;
                                setAllergyAlert(null);
                                setShowOverrideForm(false);
                                setOverrideJustification("");
                                setRxDrugs((prev) =>
                                  prev.filter((d) => d.id !== aid),
                                );
                              }}
                              className="text-xs border-red-300 text-red-700"
                              data-ocid="rx.allergy_remove.button"
                            >
                              Remove Drug
                            </Button>
                            <Button
                              size="sm"
                              disabled={!overrideJustification.trim()}
                              onClick={() => {
                                if (!overrideJustification.trim()) return;
                                const doctorEmail = getDoctorEmail();
                                const snapId = `rx_override_${patientId}_${Date.now()}`;
                                const override: AllergyOverrideRecord = {
                                  drugName: allergyAlert.drugName,
                                  overriddenBy: doctorEmail,
                                  overriddenAt: Date.now(),
                                  justification: overrideJustification.trim(),
                                  prescriptionId: snapId,
                                };
                                const existing = loadAllergyOverrides(
                                  doctorEmail,
                                  patientId.toString(),
                                );
                                saveAllergyOverrides(
                                  doctorEmail,
                                  patientId.toString(),
                                  [...existing, override],
                                );
                                try {
                                  const auditKey = "medicare_audit_overrides";
                                  const audits = JSON.parse(
                                    localStorage.getItem(auditKey) || "[]",
                                  ) as unknown[];
                                  audits.push({
                                    type: "AllergyOverride",
                                    doctorName:
                                      currentDoctor?.name ?? doctorEmail,
                                    drugName: allergyAlert.drugName,
                                    patientName:
                                      patientName ?? patientId.toString(),
                                    allergen: allergyAlert.allergen,
                                    justification: overrideJustification.trim(),
                                    timestamp: new Date().toISOString(),
                                  });
                                  localStorage.setItem(
                                    auditKey,
                                    JSON.stringify(audits),
                                  );
                                } catch {
                                  /* ignore */
                                }
                                toast.warning(
                                  `Allergy override recorded for ${allergyAlert.drugName}`,
                                  {
                                    description:
                                      "Justification saved to audit log.",
                                  },
                                );
                                setAllergyAlert(null);
                                setShowOverrideForm(false);
                                setOverrideJustification("");
                              }}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white"
                              data-ocid="rx.allergy_override_confirm.button"
                            >
                              Override — I acknowledge this allergy
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const aid = allergyAlert.drugId;
                              setAllergyAlert(null);
                              setRxDrugs((prev) =>
                                prev.filter((d) => d.id !== aid),
                              );
                            }}
                            className="text-xs border-red-300 text-red-700"
                            data-ocid="rx.allergy_remove.button"
                          >
                            Remove Drug
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowOverrideForm(true)}
                            className="text-xs border-amber-400 text-amber-700"
                            data-ocid="rx.allergy_override.button"
                          >
                            Override — I acknowledge this allergy
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {rxDrugs.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground italic py-3 text-center"
                  data-ocid="rx.drugs.empty_state"
                >
                  No drugs added yet. Use the form below.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-ocid="rx.drugs.table">
                    <thead>
                      <tr
                        className={`border-b ${
                          dark ? "border-gray-700" : "border-gray-200"
                        }`}
                      >
                        {[
                          "#",
                          "Form",
                          "Drug Name",
                          "Dose",
                          "Route",
                          "Freq.",
                          "Duration",
                          "Instructions",
                          "Special Instr.",
                          "Dispensed As",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left py-1 px-1 font-semibold text-muted-foreground whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rxDrugs.map((drug, idx) => {
                        const allergyMatch = checkDrugAllergyMatch(
                          drug.drugName,
                          unifiedAllergies,
                        );
                        const hasInteraction = DRUG_INTERACTION_PAIRS.some(
                          (pair) => {
                            const allText = rxDrugs
                              .map((d) =>
                                `${d.drugName} ${d.brandName}`.toLowerCase(),
                              )
                              .join(" ");
                            const matched = pair.drugs.filter((d) =>
                              allText.includes(d),
                            );
                            if (matched.length < 2) return false;
                            const thisDrugText =
                              `${drug.drugName} ${drug.brandName}`.toLowerCase();
                            return pair.drugs.some((d) =>
                              thisDrugText.includes(d),
                            );
                          },
                        );
                        return (
                          <DrugRow
                            key={drug.id}
                            drug={drug}
                            index={idx}
                            dark={dark}
                            isEditing={editingDrugId === drug.id}
                            allergyMatch={allergyMatch}
                            hasInteraction={hasInteraction}
                            onEdit={() => {
                              if (editingDrugId === drug.id) {
                                setEditingDrugId(null);
                              } else {
                                loadDrugForEditing(drug);
                              }
                            }}
                            onDelete={() => deleteDrug(drug.id)}
                            onUpdate={(field, val) =>
                              updateDrug(drug.id, field, val)
                            }
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Color legend — hidden when printing */}
              {rxDrugs.length > 0 && (
                <div
                  className="mt-2 flex flex-wrap gap-2 text-xs print:hidden"
                  data-ocid="rx.drug_legend.panel"
                >
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border-l-2 border-red-600" />
                    <span className="text-muted-foreground">Allergy alert</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-50 border-l-2 border-red-500" />
                    <span className="text-muted-foreground">
                      Controlled drug
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border-l-2 border-amber-500" />
                    <span className="text-muted-foreground">
                      Interaction warning
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border-l-2 border-blue-300" />
                    <span className="text-muted-foreground">
                      PRN / as needed
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* CLINICAL INTELLIGENCE */}
            {rxDrugs.length > 0 && (
              <ClinicalIntelligencePanel
                rxDrugs={rxDrugs}
                allergies={[]}
                pmh={pmh}
                diagnosis={diagnosis}
                dark={dark}
              />
            )}

            {/* MEDICATION INPUT FORM */}
            <div
              id="rx-med-form"
              className={`rounded-lg p-3 ${
                dark ? "bg-gray-900" : "bg-white"
              } shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-teal-700 uppercase tracking-wide">
                  {editingDrugId ? "✏️ Edit Medication" : "Add Medication"}
                </span>
                {editingDrugId && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-300">
                    Editing row — save to update
                  </span>
                )}
              </div>

              {/* Form selector pills */}
              <div className="flex flex-wrap gap-1 mb-3">
                {DRUG_FORMS.filter(Boolean).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDrugForm(f)}
                    className={`px-2 py-0.5 rounded-full text-sm font-medium border transition-colors ${
                      drugForm === f
                        ? "bg-teal-600 text-white border-teal-600"
                        : dark
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    data-ocid="rx.drug_form.toggle"
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Drug name row */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Generic Name
                  </span>
                  <div className="flex gap-1">
                    <input
                      className={`flex-1 border rounded px-2 py-1 text-sm ${
                        dark
                          ? "bg-gray-800 border-gray-600 text-white"
                          : "bg-white border-gray-300"
                      }`}
                      value={drugName}
                      onChange={(e) => setDrugName(e.target.value)}
                      placeholder="Generic drug name..."
                      data-ocid="rx.drug_name.input"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        window.open("https://medex.com.bd/", "_blank")
                      }
                      className="px-1.5 py-1 rounded border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 text-sm flex items-center gap-0.5"
                      title="Search on Medex"
                      data-ocid="rx.medex_search.button"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground font-semibold">
                    Brand Name
                  </span>
                  <input
                    className={`w-full border rounded px-2 py-1 text-sm font-semibold ${
                      dark
                        ? "bg-gray-800 border-amber-600 text-white"
                        : "bg-amber-50 border-amber-300"
                    }`}
                    value={drugBrandName}
                    onChange={(e) => setDrugBrandName(e.target.value)}
                    placeholder="Brand (bold in table)"
                    data-ocid="rx.drug_brand_name.input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <div>
                  <span className="text-sm text-muted-foreground">Dose</span>
                  <input
                    className={`w-full border rounded px-2 py-1 text-sm ${
                      dark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                    value={drugDose}
                    onChange={(e) => setDrugDose(e.target.value)}
                    placeholder="500mg"
                    data-ocid="rx.drug_dose.input"
                  />
                  {/* Child dose calculator inline */}
                  {(Number(age) < 12 || weight) &&
                    drugName &&
                    drugDose &&
                    (() => {
                      const CHILD_DOSE_TABLE: Record<string, number> = {
                        paracetamol: 15,
                        acetaminophen: 15,
                        ibuprofen: 10,
                        naproxen: 10,
                        amoxicillin: 25,
                        amoxycillin: 25,
                        metronidazole: 7.5,
                        flagyl: 7.5,
                      };
                      const wt = Number.parseFloat(weight || "0");
                      if (!wt) return null;
                      const dNameLower = drugName.toLowerCase();
                      const mgPerKg =
                        Object.entries(CHILD_DOSE_TABLE).find(([key]) =>
                          dNameLower.includes(key),
                        )?.[1] ?? 10;
                      const maxSafe = wt * mgPerKg;
                      const enteredNum = Number.parseFloat(
                        drugDose.replace(/[^0-9.]/g, ""),
                      );
                      const isOver =
                        !Number.isNaN(enteredNum) && enteredNum > maxSafe;
                      return (
                        <div
                          className={`mt-1 px-2 py-1 rounded text-xs border ${isOver ? "bg-red-50 border-red-300 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
                        >
                          {isOver ? (
                            <span>
                              ⚠️ <strong>Dose may exceed safe limit</strong> —
                              Max safe: <strong>{maxSafe}mg</strong> ({mgPerKg}
                              mg/kg × {wt}kg)
                            </span>
                          ) : (
                            <span>
                              ✓ Max safe dose: <strong>{maxSafe}mg</strong> (
                              {mgPerKg}mg/kg × {wt}kg)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Route (Bangla)
                  </span>
                  <Select value={drugRoute} onValueChange={setDrugRoute}>
                    <SelectTrigger
                      className="h-7 text-sm"
                      data-ocid="rx.drug_route.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTES_BN.map((r) => (
                        <SelectItem key={r.en} value={r.en} className="text-sm">
                          {r.bn} ({r.en})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-muted-foreground">
                    Frequency (Bangla primary)
                  </span>
                  <input
                    className={`w-full border rounded px-2 py-1 text-sm ${
                      dark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                    value={drugFrequencyBn || drugFrequency}
                    onChange={(e) => {
                      setDrugFrequencyBn(e.target.value);
                      setDrugFrequency(e.target.value);
                    }}
                    placeholder="e.g. সকাল-রাত ১+০+১"
                    data-ocid="rx.drug_frequency.input"
                  />
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {FREQUENCY_PRESETS.map((p) => (
                      <button
                        key={p.en}
                        type="button"
                        onClick={() => {
                          setDrugFrequencyBn(p.bn);
                          setDrugFrequency(p.en);
                        }}
                        className="text-sm px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      >
                        {p.bn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Duration (Bangla)
                  </span>
                  <input
                    className={`w-full border rounded px-2 py-1 text-sm ${
                      dark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                    value={drugDurationBn || drugDuration}
                    onChange={(e) => {
                      setDrugDurationBn(e.target.value);
                      setDrugDuration(e.target.value);
                    }}
                    placeholder="৭ দিন"
                    data-ocid="rx.drug_duration.input"
                  />
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.en}
                        type="button"
                        onClick={() => {
                          setDrugDurationBn(p.bn);
                          setDrugDuration(p.en);
                        }}
                        className="text-sm px-1 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
                      >
                        {p.bn}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Instructions (Bangla)
                  </span>
                  <input
                    className={`w-full border rounded px-2 py-1 text-sm ${
                      dark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                    value={drugInstructionBn || drugInstructions}
                    onChange={(e) => {
                      setDrugInstructionBn(e.target.value);
                      setDrugInstructions(e.target.value);
                    }}
                    placeholder="খাবার পরে"
                    data-ocid="rx.drug_instructions.input"
                  />
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {INSTRUCTION_PRESETS.map((p) => (
                      <button
                        key={p.en}
                        type="button"
                        onClick={() => {
                          setDrugInstructionBn(p.bn);
                          setDrugInstructions(p.en);
                        }}
                        className="text-sm px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                      >
                        {p.bn}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Special Instruction (Bangla)
                  </span>
                  <input
                    className={`w-full border rounded px-2 py-1 text-sm ${
                      dark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                    value={drugSpecialInstructionBn || drugSpecialInstruction}
                    onChange={(e) => {
                      setDrugSpecialInstructionBn(e.target.value);
                      setDrugSpecialInstruction(e.target.value);
                    }}
                    placeholder="যেমন: পানি বেশি পান করুন"
                    data-ocid="rx.drug_special_instruction.input"
                  />
                </div>
              </div>

              {/* Dispensed As row */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Dispensed As
                  </span>
                  <select
                    className={`ml-2 border rounded px-2 py-1 text-sm ${dark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300"}`}
                    value={drugDispensedAs}
                    onChange={(e) =>
                      setDrugDispensedAs(
                        e.target.value as
                          | ""
                          | "brand"
                          | "generic"
                          | "substituted",
                      )
                    }
                    data-ocid="rx.drug_dispensed_as.select"
                  >
                    <option value="">-- Optional --</option>
                    <option value="brand">Brand</option>
                    <option value="generic">Generic</option>
                    <option value="substituted">Substituted</option>
                  </select>
                </div>
                {drugDispensedAs === "substituted" && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Substituted Brand
                    </span>
                    <input
                      className={`ml-2 border rounded px-2 py-1 text-sm ${dark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300"}`}
                      value={drugSubstitutedBrand}
                      onChange={(e) => setDrugSubstitutedBrand(e.target.value)}
                      placeholder="Brand name..."
                      data-ocid="rx.drug_substituted_brand.input"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={addDrug}
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                  data-ocid="rx.add_drug.button"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {editingDrugId ? "Update Drug" : "Add to Prescription"}
                </Button>
                {editingDrugId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDrugId(null);
                      setDrugName("");
                      setDrugBrandName("");
                      setDrugDose("");
                      setDrugDuration("");
                      setDrugDurationBn("");
                      setDrugInstructions("");
                      setDrugInstructionBn("");
                      setDrugFrequency("");
                      setDrugFrequencyBn("");
                      setDrugSpecialInstruction("");
                      setDrugSpecialInstructionBn("");
                    }}
                    className="text-gray-600"
                    data-ocid="rx.cancel_edit.button"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`gap-1 ${dark ? "border-gray-600 text-gray-300" : "border-teal-300 text-teal-700"}`}
                      data-ocid="rx.drug_template.open_modal_button"
                    >
                      ⚡ Templates
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72 p-2"
                    align="start"
                    data-ocid="rx.drug_template.popover"
                  >
                    <p className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">
                      Quick Drug Templates
                    </p>
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {TREATMENT_TEMPLATES.flatMap((tpl) =>
                        tpl.drugs.map((drug, di) => (
                          <button
                            key={`${tpl.id}-${di}`}
                            type="button"
                            onClick={() => {
                              const d = drugFromTreatmentDrug(drug);
                              setRxDrugs((prev) => [...prev, d]);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-teal-50 text-sm transition-colors flex items-center justify-between gap-2"
                            data-ocid={`rx.drug_template.item.${di + 1}`}
                          >
                            <span className="font-medium truncate">
                              {drug.name}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {drug.dose}
                            </span>
                          </button>
                        )),
                      ).slice(0, 30)}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* TREATMENT TEMPLATE */}
            <div
              className={`rounded-lg ${
                dark ? "bg-gray-900" : "bg-white"
              } shadow-sm overflow-hidden`}
            >
              <button
                type="button"
                onClick={() => setShowTreatmentSection((s) => !s)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 ${
                  dark ? "hover:bg-teal-900" : ""
                } transition-colors`}
                data-ocid="rx.treatment_template.toggle"
              >
                <span>⚡ Load Treatment Template</span>
                {showTreatmentSection ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {showTreatmentSection && (
                <div className="px-3 pb-3 space-y-2">
                  <input
                    className={`w-full border rounded px-2 py-1.5 text-sm ${
                      dark
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                    placeholder="Search condition / diagnosis..."
                    value={treatmentQuery}
                    onChange={(e) => setTreatmentQuery(e.target.value)}
                    data-ocid="rx.treatment_search.input"
                  />
                  {treatmentResults.map((tpl, i) => (
                    <div
                      key={tpl.id}
                      className={`flex items-center justify-between p-2 rounded border ${
                        dark
                          ? "border-gray-700 bg-gray-800"
                          : "border-gray-100 bg-gray-50"
                      }`}
                      data-ocid={`rx.treatment_template.item.${i + 1}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{tpl.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tpl.diagnosis} · {tpl.drugs.length} drugs
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyTreatmentTemplate(tpl)}
                        className="text-sm px-2 py-1 bg-teal-600 text-white rounded hover:bg-teal-700"
                        data-ocid={`rx.load_template.button.${i + 1}`}
                      >
                        Load
                      </button>
                    </div>
                  ))}
                  {treatmentQuery.length >= 2 &&
                    treatmentResults.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No templates found.
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* FOLLOW-UP DATE */}
            <div
              className={`rounded-lg p-3 ${dark ? "bg-gray-900" : "bg-white"} shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                  Follow-up Date
                </span>
                {followUpDate && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
                    Appointment will be auto-created
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={followUpDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className={`border rounded px-3 py-1.5 text-sm ${dark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-emerald-300 text-gray-800"}`}
                  data-ocid="rx.followup_date.input"
                />
                {followUpDate && (
                  <button
                    type="button"
                    onClick={() => setFollowUpDate("")}
                    className="text-xs text-red-400 hover:text-red-600 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {followUpDate && (
                <p className="text-xs text-emerald-600 mt-1.5">
                  📅 Follow-up on{" "}
                  <span className="font-semibold">
                    {new Date(followUpDate).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>{" "}
                  — appointment will be auto-created when prescription is saved.
                </p>
              )}
            </div>

            {/* ADVICE */}
            <div
              className={`rounded-lg p-3 ${
                dark ? "bg-gray-900" : "bg-white"
              } shadow-sm`}
            >
              <span className="text-sm font-semibold text-teal-700 uppercase tracking-wide block mb-2">
                পরামর্শ / Advice (Bengali)
              </span>
              <div className="flex flex-wrap gap-1 mb-2">
                {ADVICE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAdviceCategory(cat)}
                    className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${
                      adviceCategory === cat
                        ? "bg-teal-600 text-white border-teal-600"
                        : dark
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    data-ocid="rx.advice_category.tab"
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative mb-2">
                <input
                  className={`w-full border rounded px-2 py-1.5 text-sm pr-7 ${
                    dark
                      ? "bg-gray-800 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                  placeholder="Search advice templates..."
                  value={adviceQuery}
                  onChange={(e) => setAdviceQuery(e.target.value)}
                  data-ocid="rx.advice_search.input"
                />
                <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="flex flex-wrap gap-1 mb-3 max-h-28 overflow-y-auto">
                {filteredTemplates.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => appendAdvice(t.text)}
                      className={`text-sm px-2 py-0.5 rounded border transition-colors text-left ${
                        dark
                          ? "bg-gray-800 border-gray-600 text-gray-200 hover:bg-teal-900"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-teal-50"
                      }`}
                      data-ocid={`rx.advice_template.item.${i + 1}`}
                    >
                      {t.text}
                    </button>
                    {t.isCustom && (
                      <button
                        type="button"
                        onClick={() => removeCustomTemplate(t.id)}
                        className="text-red-400 hover:text-red-600"
                        data-ocid={`rx.advice_delete.button.${i + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Textarea
                value={adviceText}
                onChange={(e) => setAdviceText(e.target.value)}
                rows={5}
                placeholder="পরামর্শ এখানে লিখুন বা টেমপ্লেট থেকে যোগ করুন..."
                className={`text-sm mb-2 ${
                  dark ? "bg-gray-800 border-gray-600 text-white" : ""
                }`}
                data-ocid="rx.advice.textarea"
              />
              <button
                type="button"
                onClick={() => setShowCustomForm((s) => !s)}
                className="text-sm text-teal-600 hover:underline flex items-center gap-1"
                data-ocid="rx.add_custom_template.button"
              >
                <Plus className="w-3 h-3" /> Add Custom Template
              </button>
              {showCustomForm && (
                <div
                  className={`mt-2 p-2 rounded border ${
                    dark
                      ? "bg-gray-800 border-gray-700"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <Textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    rows={2}
                    placeholder="Custom advice text..."
                    className={`text-sm mb-1 ${
                      dark ? "bg-gray-700 border-gray-600" : ""
                    }`}
                    data-ocid="rx.custom_template.textarea"
                  />
                  <div className="flex gap-1">
                    <input
                      className={`flex-1 border rounded px-2 py-1 text-sm ${
                        dark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300"
                      }`}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Category"
                      data-ocid="rx.custom_category.input"
                    />
                    <button
                      type="button"
                      onClick={addCustomTemplate}
                      className="px-3 py-1 bg-teal-600 text-white text-sm rounded hover:bg-teal-700"
                      data-ocid="rx.save_custom_template.button"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(false)}
                      className="px-2 py-1 text-sm rounded border"
                      data-ocid="rx.cancel_custom.button"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SIGNATURE UPLOAD */}
            <div
              className={`rounded-lg p-3 ${
                dark ? "bg-gray-900" : "bg-white"
              } shadow-sm`}
            >
              <span className="text-sm font-semibold text-teal-700 uppercase tracking-wide block mb-2">
                Doctor's Signature
              </span>
              <input
                ref={sigFileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 1024) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result as string;
                    setDoctorSignature(dataUrl);
                    setSignatureUrl(dataUrl);
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sigFileRef.current?.click()}
                  className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
                  data-ocid="rx.upload_signature.button"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {signatureUrl ? "Change Signature" : "Upload Signature"}
                </Button>
                {signatureUrl && (
                  <>
                    <img
                      src={signatureUrl}
                      alt="Signature"
                      className="h-10 object-contain border rounded px-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        clearDoctorSignature();
                        setSignatureUrl(null);
                      }}
                      className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1"
                      aria-label="Remove signature"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                PNG/JPG, max 1MB. Transparent background recommended.
              </p>
            </div>

            {/* PREVIEW TOGGLE */}
            <div>
              <button
                type="button"
                onClick={() => setShowPreview((s) => !s)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-t border text-sm font-semibold text-teal-700 ${
                  dark
                    ? "bg-gray-900 border-gray-700"
                    : "bg-white border-gray-200"
                }`}
                data-ocid="rx.preview.toggle"
              >
                <span>
                  <Printer className="inline w-3.5 h-3.5 mr-1" />
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </span>
                {showPreview ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {showPreview && (
                <PrescriptionPreview
                  withHeader={withHeader}
                  headerType={headerType}
                  doctorInfo={doctorInfo}
                  hospitalHeaderImg={hospitalHeaderImg}
                  chamberHeaderImg={chamberHeaderImg}
                  signatureUrl={signatureUrl}
                  name={name}
                  age={age}
                  sex={sex}
                  weight={weight}
                  rxDate={rxDate}
                  regNo={regNo}
                  diagnosis={
                    diagnoses.length > 0 ? diagnoses.join(" + ") : diagnosis
                  }
                  drugs={rxDrugs}
                  adviceText={adviceText}
                  cc={cc}
                  pmh={pmh}
                  oe={oe}
                  dh={dh}
                  historyPersonal={historyPersonal}
                  historyFamily={historyFamily}
                  historyImmunization={historyImmunization}
                  historyAllergy={historyAllergy}
                  historyOthers={historyOthers}
                  investigation={investigation}
                  adviceNewInv={adviceNewInv}
                  followUpDate={followUpDate}
                  isInternDraft={isIntern}
                />
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ── FLOATING CALCULATOR BUTTON ── */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 shadow-xl flex items-center gap-2"
        onClick={() => setShowCalculator(true)}
        data-ocid="rx.calculator.open_modal_button"
      >
        <Calculator className="w-5 h-5" />
        <span className="text-sm font-medium pr-1">Calculator</span>
      </button>

      {/* ── MEDICAL CALCULATOR DIALOG ── */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <Calculator className="w-5 h-5" /> Medical Calculator
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-1 mb-4">
            {[
              { id: "dose-weight", label: "Dose/Weight" },
              { id: "dose-age", label: "Dose/Age" },
              { id: "crcl", label: "CrCl/GFR" },
              { id: "bmi", label: "BMI" },
              { id: "bsa", label: "BSA" },
              { id: "fluid", label: "Pediatric Fluid" },
              { id: "map", label: "MAP" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCalcTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${calcTab === tab.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dose by Weight */}
          {calcTab === "dose-weight" &&
            (() => {
              const total =
                calcDosePerKg && calcWeightKg
                  ? (
                      Number.parseFloat(calcDosePerKg) *
                      Number.parseFloat(calcWeightKg)
                    ).toFixed(2)
                  : null;
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Formula: (mg/kg) × weight = total dose
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Dose per kg (mg/kg)</Label>
                      <Input
                        value={calcDosePerKg}
                        onChange={(e) => setCalcDosePerKg(e.target.value)}
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Patient Weight (kg)</Label>
                      <Input
                        value={calcWeightKg}
                        onChange={(e) => setCalcWeightKg(e.target.value)}
                        placeholder="kg"
                      />
                    </div>
                  </div>
                  {total && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-green-700">
                        {total} <span className="text-lg">mg</span>
                      </p>
                      <p className="text-sm text-green-600 mt-1">Total Dose</p>
                      <button
                        type="button"
                        className="mt-2 text-xs px-3 py-1 bg-indigo-600 text-white rounded-full"
                        onClick={() => {
                          setDrugDose(total);
                          setLastCalculatorResult(total);
                          setShowCalculator(false);
                        }}
                      >
                        Copy to Dose Field
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Dose by Age (Young's Rule) */}
          {calcTab === "dose-age" &&
            (() => {
              const age = Number.parseFloat(calcAgeYears);
              const adult = Number.parseFloat(calcAdultDose);
              const result =
                !Number.isNaN(age) && !Number.isNaN(adult)
                  ? ((adult * age) / (age + 12)).toFixed(2)
                  : null;
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Young's Rule: adult dose × age / (age + 12)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Adult Dose (mg)</Label>
                      <Input
                        value={calcAdultDose}
                        onChange={(e) => setCalcAdultDose(e.target.value)}
                        placeholder="mg"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Patient Age (years)</Label>
                      <Input
                        value={calcAgeYears}
                        onChange={(e) => setCalcAgeYears(e.target.value)}
                        placeholder="years"
                      />
                    </div>
                  </div>
                  {result && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-green-700">
                        {result} <span className="text-lg">mg</span>
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        Pediatric Dose
                      </p>
                      <button
                        type="button"
                        className="mt-2 text-xs px-3 py-1 bg-indigo-600 text-white rounded-full"
                        onClick={() => {
                          setDrugDose(result);
                          setLastCalculatorResult(result);
                          setShowCalculator(false);
                        }}
                      >
                        Copy to Dose Field
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* CrCl / GFR */}
          {calcTab === "crcl" &&
            (() => {
              const age = Number.parseFloat(calcCrClAge);
              const wt = Number.parseFloat(calcCrClWeight);
              const cr = Number.parseFloat(calcCrClCreat);
              let result: number | null = null;
              if (
                !Number.isNaN(age) &&
                !Number.isNaN(wt) &&
                !Number.isNaN(cr) &&
                cr > 0
              ) {
                result = Math.round(
                  ((140 - age) * wt * (calcCrClSex === "F" ? 0.85 : 1)) /
                    (72 * cr),
                );
              }
              const interp =
                result === null
                  ? ""
                  : result >= 90
                    ? "Normal (≥90)"
                    : result >= 60
                      ? "Mild CKD (60-89)"
                      : result >= 30
                        ? "Moderate CKD (30-59)"
                        : result >= 15
                          ? "Severe CKD (15-29)"
                          : "Kidney Failure (<15)";
              const color =
                result === null
                  ? ""
                  : result >= 90
                    ? "bg-green-50 border-green-200 text-green-700"
                    : result >= 60
                      ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                      : "bg-red-50 border-red-200 text-red-700";
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Cockcroft-Gault: ((140-age) × weight × [0.85 if F]) / (72 ×
                    SCr)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Age (years)</Label>
                      <Input
                        value={calcCrClAge}
                        onChange={(e) => setCalcCrClAge(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input
                        value={calcCrClWeight}
                        onChange={(e) => setCalcCrClWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Sex</Label>
                      <select
                        value={calcCrClSex}
                        onChange={(e) => setCalcCrClSex(e.target.value)}
                        className="w-full border rounded-md px-2 py-1.5 text-sm"
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">
                        Serum Creatinine (mg/dL)
                      </Label>
                      <Input
                        value={calcCrClCreat}
                        onChange={(e) => setCalcCrClCreat(e.target.value)}
                        placeholder="mg/dL"
                      />
                    </div>
                  </div>
                  {result !== null && (
                    <div
                      className={`border rounded-xl p-4 text-center ${color}`}
                    >
                      <p className="text-3xl font-bold">
                        {result} <span className="text-lg">mL/min</span>
                      </p>
                      <p className="text-sm mt-1 font-semibold">{interp}</p>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* BMI */}
          {calcTab === "bmi" &&
            (() => {
              const wt = Number.parseFloat(calcBmiWeight);
              const ht = Number.parseFloat(calcBmiHeight) / 100;
              const bmi =
                !Number.isNaN(wt) && !Number.isNaN(ht) && ht > 0
                  ? (wt / (ht * ht)).toFixed(1)
                  : null;
              const bmiNum = bmi ? Number.parseFloat(bmi) : null;
              const getBmiCat = (b: number) =>
                b < 18.5
                  ? {
                      label: "Underweight",
                      color: "bg-blue-50 border-blue-200 text-blue-700",
                      row: "bg-blue-50",
                    }
                  : b < 25
                    ? {
                        label: "Normal weight ✓",
                        color: "bg-green-50 border-green-200 text-green-700",
                        row: "bg-green-50",
                      }
                    : b < 30
                      ? {
                          label: "Overweight",
                          color: "bg-amber-50 border-amber-200 text-amber-700",
                          row: "bg-amber-50",
                        }
                      : b < 35
                        ? {
                            label: "Obese Class I",
                            color:
                              "bg-orange-50 border-orange-200 text-orange-700",
                            row: "bg-orange-50",
                          }
                        : b < 40
                          ? {
                              label: "Obese Class II",
                              color: "bg-red-50 border-red-200 text-red-700",
                              row: "bg-red-50",
                            }
                          : {
                              label: "Obese Class III",
                              color: "bg-red-100 border-red-300 text-red-900",
                              row: "bg-red-100",
                            };
              const catInfo = bmiNum !== null ? getBmiCat(bmiNum) : null;
              const bmiTable = [
                {
                  range: "< 18.5",
                  label: "Underweight",
                  check: (b: number) => b < 18.5,
                },
                {
                  range: "18.5 – 24.9",
                  label: "Normal weight ✓",
                  check: (b: number) => b >= 18.5 && b < 25,
                },
                {
                  range: "25 – 29.9",
                  label: "Overweight",
                  check: (b: number) => b >= 25 && b < 30,
                },
                {
                  range: "30 – 34.9",
                  label: "Obese Class I",
                  check: (b: number) => b >= 30 && b < 35,
                },
                {
                  range: "35 – 39.9",
                  label: "Obese Class II",
                  check: (b: number) => b >= 35 && b < 40,
                },
                {
                  range: "≥ 40",
                  label: "Obese Class III",
                  check: (b: number) => b >= 40,
                },
              ];
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    BMI = weight (kg) / height (m)²
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input
                        value={calcBmiWeight}
                        onChange={(e) => setCalcBmiWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height (cm)</Label>
                      <Input
                        value={calcBmiHeight}
                        onChange={(e) => setCalcBmiHeight(e.target.value)}
                        placeholder="cm"
                      />
                    </div>
                  </div>
                  {bmi && catInfo && (
                    <div
                      className={`border rounded-xl p-4 text-center ${catInfo.color}`}
                    >
                      <p className="text-3xl font-bold">
                        {bmi} <span className="text-lg">kg/m²</span>
                      </p>
                      <p className="text-sm mt-1 font-bold">{catInfo.label}</p>
                      <button
                        type="button"
                        className="mt-2 text-xs px-3 py-1 bg-indigo-600 text-white rounded-full"
                        onClick={() => {
                          setLastCalculatorResult(bmi);
                          setShowCalculator(false);
                        }}
                      >
                        Copy Result
                      </button>
                    </div>
                  )}
                  {/* Interpretation Table */}
                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        BMI Classification
                      </p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">
                            BMI Range
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">
                            Category
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bmiTable.map((row) => {
                          const isActive = bmiNum !== null && row.check(bmiNum);
                          return (
                            <tr
                              key={row.range}
                              className={`border-b ${isActive ? (catInfo ? `${catInfo.row} font-bold` : "") : ""}`}
                            >
                              <td className="px-3 py-2">{row.range}</td>
                              <td className="px-3 py-2 flex items-center gap-1">
                                {row.label}
                                {isActive && (
                                  <span className="ml-1 text-indigo-600">
                                    ← Current
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          {/* BSA */}
          {calcTab === "bsa" &&
            (() => {
              const wt = Number.parseFloat(calcBsaWeight);
              const ht = Number.parseFloat(calcBsaHeight);
              const bsa =
                !Number.isNaN(wt) && !Number.isNaN(ht)
                  ? Math.sqrt((ht * wt) / 3600).toFixed(3)
                  : null;
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Mosteller: √(height cm × weight kg / 3600)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input
                        value={calcBsaWeight}
                        onChange={(e) => setCalcBsaWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height (cm)</Label>
                      <Input
                        value={calcBsaHeight}
                        onChange={(e) => setCalcBsaHeight(e.target.value)}
                        placeholder="cm"
                      />
                    </div>
                  </div>
                  {bsa && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-green-700">
                        {bsa} <span className="text-lg">m²</span>
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        Body Surface Area
                      </p>
                      <button
                        type="button"
                        className="mt-2 text-xs px-3 py-1 bg-indigo-600 text-white rounded-full"
                        onClick={() => {
                          setLastCalculatorResult(bsa);
                          setShowCalculator(false);
                        }}
                      >
                        Copy Result
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Pediatric Fluid */}
          {calcTab === "fluid" &&
            (() => {
              const wt = Number.parseFloat(calcFluidWeight);
              let daily = 0;
              if (!Number.isNaN(wt) && wt > 0) {
                if (wt <= 10) daily = wt * 100;
                else if (wt <= 20) daily = 1000 + (wt - 10) * 50;
                else daily = 1500 + (wt - 20) * 20;
              }
              const hourly = daily > 0 ? (daily / 24).toFixed(1) : null;
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Holliday-Segar: 100 mL/kg (≤10kg) + 50 mL/kg (10-20kg) + 20
                    mL/kg (&gt;20kg)
                  </p>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      value={calcFluidWeight}
                      onChange={(e) => setCalcFluidWeight(e.target.value)}
                    />
                  </div>
                  {hourly && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-blue-700">
                        {daily} <span className="text-lg">mL/day</span>
                      </p>
                      <p className="text-xl font-semibold text-blue-600 mt-1">
                        {hourly} mL/hour
                      </p>
                      <p className="text-sm text-blue-500 mt-1">
                        Daily Fluid Requirement
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* MAP */}
          {calcTab === "map" &&
            (() => {
              const sbp = Number.parseFloat(calcMapSbp);
              const dbp = Number.parseFloat(calcMapDbp);
              const mapVal =
                !Number.isNaN(sbp) && !Number.isNaN(dbp)
                  ? Math.round(dbp + (sbp - dbp) / 3)
                  : null;
              const interp =
                mapVal === null
                  ? ""
                  : mapVal < 70
                    ? "Low MAP (<70) — Hypoperfusion Risk"
                    : mapVal <= 100
                      ? "Normal MAP (70-100)"
                      : "High MAP (>100) — Hypertension";
              const color =
                mapVal === null
                  ? ""
                  : mapVal < 70
                    ? "bg-red-50 border-red-200 text-red-700"
                    : mapVal <= 100
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-amber-50 border-amber-200 text-amber-700";
              return (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    MAP = DBP + ⅓(SBP − DBP)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Systolic BP (mmHg)</Label>
                      <Input
                        value={calcMapSbp}
                        onChange={(e) => setCalcMapSbp(e.target.value)}
                        placeholder="mmHg"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Diastolic BP (mmHg)</Label>
                      <Input
                        value={calcMapDbp}
                        onChange={(e) => setCalcMapDbp(e.target.value)}
                        placeholder="mmHg"
                      />
                    </div>
                  </div>
                  {mapVal !== null && (
                    <div
                      className={`border rounded-xl p-4 text-center ${color}`}
                    >
                      <p className="text-3xl font-bold">
                        {mapVal} <span className="text-lg">mmHg</span>
                      </p>
                      <p className="text-sm mt-1 font-semibold">{interp}</p>
                    </div>
                  )}
                </div>
              );
            })()}

          {lastCalculatorResult && (
            <p className="text-xs text-gray-500 mt-3">
              Last result copied: <strong>{lastCalculatorResult}</strong>
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CKD_DOSE_DRUGS = [
  "metformin",
  "nsaid",
  "ibuprofen",
  "naproxen",
  "aminoglycoside",
  "gentamicin",
  "amikacin",
  "contrast",
];
const LIVER_DOSE_DRUGS = [
  "paracetamol",
  "methotrexate",
  "statins",
  "azathioprine",
  "nsaid",
  "ibuprofen",
];

interface ClinicalAlert {
  type: "interaction" | "allergy" | "dose";
  message: string;
  drugs: string[];
}

function ClinicalIntelligencePanel({
  rxDrugs,
  allergies,
  pmh,
  diagnosis,
  dark,
}: {
  rxDrugs: RxDrug[];
  allergies: string[];
  pmh: string;
  diagnosis: string;
  dark: boolean;
}) {
  const [open, setOpen] = useState(true);

  const drugNames = rxDrugs.map((d) =>
    `${d.drugName} ${d.brandName}`.toLowerCase(),
  );
  const allDrugText = drugNames.join(" ");
  const pmhLower = `${pmh} ${diagnosis}`.toLowerCase();

  const alerts: ClinicalAlert[] = [];

  // Drug interaction checks
  for (const pair of DRUG_INTERACTION_PAIRS) {
    const matched = pair.drugs.filter((d) => allDrugText.includes(d));
    if (matched.length >= 2) {
      alerts.push({
        type: "interaction",
        message: pair.message,
        drugs: matched,
      });
    }
  }

  // Allergy checks
  for (const drug of rxDrugs) {
    for (const allergen of allergies) {
      if (!allergen) continue;
      const a = allergen.toLowerCase();
      const dname = `${drug.drugName} ${drug.brandName}`.toLowerCase();
      if (dname.includes(a) || a.includes(dname.split(" ")[0])) {
        alerts.push({
          type: "allergy",
          message: `⚠️ Patient has documented allergy to "${allergen}". Drug "${drug.drugForm} ${drug.drugName}" may be contraindicated.`,
          drugs: [drug.drugName],
        });
      }
    }
  }

  // Dose adjustment (CKD/Liver)
  const hasCKD = /ckd|chronic kidney|renal failure|renal insufficiency/i.test(
    pmhLower,
  );
  const hasLiver = /liver disease|hepatic|hepatitis|cirrhosis/i.test(pmhLower);
  if (hasCKD) {
    for (const drug of rxDrugs) {
      const dname = `${drug.drugName}`.toLowerCase();
      if (CKD_DOSE_DRUGS.some((d) => dname.includes(d))) {
        alerts.push({
          type: "dose",
          message: `📉 CKD detected: Dose adjustment required for "${drug.drugForm} ${drug.drugName}". Consider renal dose or alternative.`,
          drugs: [drug.drugName],
        });
      }
    }
  }
  if (hasLiver) {
    for (const drug of rxDrugs) {
      const dname = `${drug.drugName}`.toLowerCase();
      if (LIVER_DOSE_DRUGS.some((d) => dname.includes(d))) {
        alerts.push({
          type: "dose",
          message: `📉 Liver disease detected: Caution with "${drug.drugForm} ${drug.drugName}". Dose adjustment or monitoring may be needed.`,
          drugs: [drug.drugName],
        });
      }
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div
      className={`rounded-lg shadow-sm overflow-hidden ${dark ? "bg-gray-900" : "bg-white"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-red-50 border-b border-red-200 hover:bg-red-100 transition-colors"
        data-ocid="rx.clinical_intelligence.toggle"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-red-700">
          🧠 Clinical Intelligence
          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-red-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-600" />
        )}
      </button>
      {open && (
        <div className="p-3 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={`ci-${alert.type}-${alert.message.slice(0, 20)}`}
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${
                alert.type === "interaction"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : alert.type === "allergy"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
              data-ocid={`rx.clinical_alert.item.${i + 1}`}
            >
              <span className="text-base flex-shrink-0">
                {alert.type === "interaction"
                  ? "🔴"
                  : alert.type === "allergy"
                    ? "⚠️"
                    : "📉"}
              </span>
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function DrugRow({
  drug,
  index,
  dark,
  isEditing,
  allergyMatch,
  hasInteraction,
  onEdit,
  onDelete,
  onUpdate,
}: {
  drug: RxDrug;
  index: number;
  dark: boolean;
  isEditing: boolean;
  allergyMatch: string | null;
  hasInteraction: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (field: keyof RxDrug, val: string | boolean) => void;
}) {
  // Row risk priority: allergy > controlled > interaction > PRN > normal
  const rowClass = allergyMatch
    ? "bg-red-100 border-l-4 border-red-600 drug-row-allergy"
    : drug.isControlled
      ? "bg-red-50 border-l-4 border-red-500 drug-row-controlled"
      : hasInteraction
        ? "bg-amber-50 border-l-4 border-amber-500 drug-row-interaction"
        : drug.isPrn
          ? "bg-blue-50 border-l-[3px] border-blue-300 drug-row-prn"
          : "";

  const cellCls = `px-1 py-1 align-top ${
    dark ? "border-gray-700" : "border-gray-100"
  } border-b`;
  const inp = `border rounded px-1 text-xs ${
    dark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
  }`;

  if (isEditing) {
    return (
      <tr className={rowClass} data-ocid={`rx.drug.row.${index + 1}`}>
        <td className={cellCls}>{index + 1}</td>
        <td className={cellCls}>
          <select
            className={`${inp} w-14`}
            value={drug.drugForm}
            onChange={(e) => onUpdate("drugForm", e.target.value)}
          >
            {DRUG_FORMS.filter(Boolean).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </td>
        <td className={cellCls}>
          <div className="flex flex-col gap-0.5">
            <input
              className={`${inp} w-28`}
              value={drug.drugName}
              onChange={(e) => onUpdate("drugName", e.target.value)}
              placeholder="Generic"
            />
            <input
              className={`${inp} w-28 font-semibold`}
              value={drug.brandName}
              onChange={(e) => onUpdate("brandName", e.target.value)}
              placeholder="Brand"
            />
            <label className="flex items-center gap-1 text-xs text-red-700 cursor-pointer mt-0.5">
              <input
                type="checkbox"
                checked={drug.isControlled ?? false}
                onChange={(e) => onUpdate("isControlled", e.target.checked)}
                className="accent-red-600"
              />
              Controlled drug
            </label>
          </div>
        </td>
        <td className={cellCls}>
          <input
            className={`${inp} w-16`}
            value={drug.dose}
            onChange={(e) => onUpdate("dose", e.target.value)}
          />
        </td>
        <td className={cellCls}>
          <input
            className={`${inp} w-20`}
            value={drug.routeBn || drug.route}
            onChange={(e) => onUpdate("routeBn", e.target.value)}
          />
        </td>
        <td className={cellCls}>
          <input
            className={`${inp} w-20`}
            value={drug.frequencyBn || drug.frequency}
            onChange={(e) => onUpdate("frequencyBn", e.target.value)}
          />
        </td>
        <td className={cellCls}>
          <input
            className={`${inp} w-16`}
            value={drug.durationBn || drug.duration}
            onChange={(e) => onUpdate("durationBn", e.target.value)}
          />
        </td>
        <td className={cellCls}>
          <input
            className={`${inp} w-24`}
            value={drug.instructionBn || drug.instructions}
            onChange={(e) => onUpdate("instructionBn", e.target.value)}
          />
        </td>
        <td className={cellCls}>
          <input
            className={`${inp} w-24`}
            value={drug.specialInstructionBn || drug.specialInstruction}
            onChange={(e) => onUpdate("specialInstructionBn", e.target.value)}
          />
        </td>
        <td className={cellCls}>
          <select
            className={`${inp} w-20`}
            value={drug.dispensedAs ?? ""}
            onChange={(e) => onUpdate("dispensedAs", e.target.value)}
          >
            <option value="">—</option>
            <option value="brand">Brand</option>
            <option value="generic">Generic</option>
            <option value="substituted">Substituted</option>
          </select>
        </td>
        <td className={cellCls}>
          <button type="button" onClick={onEdit} className="text-teal-600">
            <Check className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  }
  return (
    <tr className={rowClass} data-ocid={`rx.drug.row.${index + 1}`}>
      <td className={cellCls}>{index + 1}</td>
      <td className={cellCls}>
        <span className="text-sm font-medium text-indigo-700 bg-indigo-50 rounded px-1">
          {drug.drugForm}
        </span>
      </td>
      <td className={cellCls}>
        <div className="flex items-start gap-1 flex-col">
          <div className="flex items-center gap-1 flex-wrap">
            {drug.brandName ? (
              <div>
                <strong className="text-amber-700">{drug.brandName}</strong>
                <br />
                <span className="text-gray-500 text-sm">{drug.drugName}</span>
              </div>
            ) : drug.nameType === "brand" ? (
              <strong>{drug.drugName}</strong>
            ) : (
              <span>{drug.drugName}</span>
            )}
            {drug.isPrn && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 font-semibold whitespace-nowrap">
                PRN
              </span>
            )}
          </div>
          {/* Risk badges */}
          <div className="flex gap-1 flex-wrap">
            {drug.isControlled && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">
                <ShieldAlert className="w-2.5 h-2.5" /> CONTROLLED
              </span>
            )}
            {allergyMatch && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-400 font-semibold">
                <AlertTriangle className="w-2.5 h-2.5" /> ALLERGY:{" "}
                {allergyMatch}
              </span>
            )}
            {hasInteraction && !allergyMatch && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-400 font-semibold">
                <AlertTriangle className="w-2.5 h-2.5" /> INTERACTION
              </span>
            )}
          </div>
        </div>
      </td>
      <td className={cellCls}>{drug.dose}</td>
      <td className={cellCls}>
        <span className="text-teal-700">{drug.routeBn || drug.route}</span>
      </td>
      <td className={cellCls}>
        {drug.isPrn ? (
          <span className="italic text-purple-600 text-xs">
            PRN{drug.prnCondition ? ` — ${drug.prnCondition}` : ""}
          </span>
        ) : (
          drug.frequencyBn || drug.frequency
        )}
      </td>
      <td className={cellCls}>
        {drug.isPrn ? "—" : drug.durationBn || drug.duration}
      </td>
      <td className={cellCls}>{drug.instructionBn || drug.instructions}</td>
      <td className={cellCls}>
        {drug.specialInstructionBn || drug.specialInstruction}
      </td>
      <td className={cellCls}>
        {drug.dispensedAs ? (
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${drug.dispensedAs === "substituted" ? "bg-amber-100 text-amber-700" : "bg-teal-50 text-teal-700"}`}
          >
            {drug.dispensedAs === "substituted" && drug.substitutedBrand
              ? `Sub: ${drug.substitutedBrand}`
              : drug.dispensedAs}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
      <td className={`${cellCls} flex gap-1`}>
        <button
          type="button"
          onClick={onEdit}
          className="text-blue-500 hover:text-blue-700"
          data-ocid={`rx.drug_edit.button.${index + 1}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-red-500 hover:text-red-700"
          data-ocid={`rx.drug_delete.button.${index + 1}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function PrescriptionPreview({
  withHeader,
  headerType,
  doctorInfo,
  hospitalHeaderImg,
  chamberHeaderImg,
  signatureUrl,
  name,
  age,
  sex,
  weight,
  rxDate,
  regNo,
  diagnosis,
  drugs,
  adviceText,
  cc,
  pmh,
  oe,
  dh,
  historyPersonal,
  historyFamily,
  historyImmunization,
  historyAllergy,
  historyOthers,
  investigation,
  adviceNewInv,
  followUpDate,
  finalizedAt,
  isInternDraft,
}: {
  withHeader: boolean;
  headerType: PrescriptionHeaderType;
  doctorInfo: Record<string, string> | null;
  hospitalHeaderImg: string | null;
  chamberHeaderImg: string | null;
  signatureUrl: string | null;
  name: string;
  age: string;
  sex: string;
  weight: string;
  rxDate: string;
  regNo: string;
  diagnosis: string;
  drugs: RxDrug[];
  adviceText: string;
  cc: string;
  pmh: string;
  oe: string;
  dh: string;
  historyPersonal: string;
  historyFamily: string;
  historyImmunization: string;
  historyAllergy: string;
  historyOthers: string;
  investigation: string;
  adviceNewInv: string;
  followUpDate?: string;
  finalizedAt?: string;
  isInternDraft?: boolean;
}) {
  const printId = "rx-preview-print";

  const hasHistory =
    historyPersonal ||
    historyFamily ||
    historyImmunization ||
    historyAllergy ||
    historyOthers;

  const activeHeaderImg =
    headerType === "hospital" ? hospitalHeaderImg : chamberHeaderImg;

  const numberedAdvice = numberAdviceLines(adviceText);
  const sigHtml = getSignatureHtml(
    doctorInfo?.name ?? "Dr. Arman Kabir (ZOSID)",
    signatureUrl,
  );

  function handlePrint(saveAsPdf = false) {
    const el = document.getElementById(printId);
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Prescription</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Georgia, serif; font-size: 11pt; margin: 15mm; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Grid layout */
        .grid { display: grid !important; }
        .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        .col-span-2 { grid-column: span 2 / span 2 !important; }
        .col-span-3 { grid-column: span 3 / span 3 !important; }
        .gap-3 { gap: 0.75rem !important; }
        /* Flex */
        .flex { display: flex !important; }
        .flex-wrap { flex-wrap: wrap !important; }
        .flex-col { flex-direction: column !important; }
        .items-start { align-items: flex-start !important; }
        .justify-between { justify-content: space-between !important; }
        .gap-x-4 { column-gap: 1rem !important; }
        .gap-y-0 { row-gap: 0 !important; }
        /* Spacing */
        .space-y-2 > * + * { margin-top: 0.5rem !important; }
        .space-y-1 > * + * { margin-top: 0.25rem !important; }
        .mb-1 { margin-bottom: 0.25rem !important; }
        .mb-2 { margin-bottom: 0.5rem !important; }
        .mb-3 { margin-bottom: 0.75rem !important; }
        .mt-3 { margin-top: 0.75rem !important; }
        .pb-2 { padding-bottom: 0.5rem !important; }
        .pt-2 { padding-top: 0.5rem !important; }
        .pl-4 { padding-left: 1rem !important; }
        .pr-2 { padding-right: 0.5rem !important; }
        .p-4 { padding: 1rem !important; }
        /* Borders */
        .border-b { border-bottom: 1px solid #d1d5db !important; }
        .border-t { border-top: 1px solid #d1d5db !important; }
        .border-r { border-right: 1px solid #d1d5db !important; }
        .border { border: 1px solid #d1d5db !important; }
        .border-gray-200 { border-color: #e5e7eb !important; }
        /* Typography */
        .font-serif { font-family: Georgia, serif !important; }
        .font-bold { font-weight: 700 !important; }
        .font-medium { font-weight: 500 !important; }
        .font-semibold { font-weight: 600 !important; }
        .text-base { font-size: 1rem !important; }
        .text-sm { font-size: 0.875rem !important; }
        .text-xs { font-size: 0.75rem !important; }
        .text-2xl { font-size: 1.5rem !important; }
        .uppercase { text-transform: uppercase !important; }
        .whitespace-pre-wrap { white-space: pre-wrap !important; }
        .leading-snug { line-height: 1.375 !important; }
        /* Colors - force print */
        .text-gray-900 { color: #111827 !important; }
        .text-gray-800 { color: #1f2937 !important; }
        .text-gray-600 { color: #4b5563 !important; }
        .text-gray-500 { color: #6b7280 !important; }
        .text-gray-400 { color: #9ca3af !important; }
        .text-indigo-600 { color: #4f46e5 !important; }
        .text-orange-600 { color: #ea580c !important; }
        .text-teal-600 { color: #0d9488 !important; }
        .text-right { text-align: right !important; }
        /* Misc */
        .rounded { border-radius: 0.25rem !important; }
        .max-w-2xl { max-width: 42rem !important; }
        .mx-auto { margin-left: auto !important; margin-right: auto !important; }
        .ml-1 { margin-left: 0.25rem !important; }
        strong { font-weight: 700 !important; }
        @media print {
          body { margin: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style></head><body>
      ${el.innerHTML}
      ${sigHtml}
      </body></html>
    `);
    win.document.close();
    if (saveAsPdf) {
      win.onafterprint = () => win.close();
    }
    win.focus();
    win.print();
  }

  return (
    <div
      className="border border-t-0 border-gray-200 bg-white p-4 text-sm"
      data-ocid="rx.preview.panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {/* Finalization badge */}
        {finalizedAt && !isInternDraft && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-400 text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-bold text-sm">
                ✅ Saved &amp; Finalized
              </span>
              <span className="ml-2 text-xs text-emerald-600">
                {new Date(finalizedAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        )}
        {isInternDraft && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-400 text-amber-800">
            <span className="font-bold text-sm">
              📋 Draft – Awaiting Approval
            </span>
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="flex items-center gap-1 text-sm px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700"
            data-ocid="rx.print.button"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={() => handlePrint(true)}
            className="flex items-center gap-1 text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            data-ocid="rx.download.button"
          >
            <Download className="w-3.5 h-3.5" /> Save PDF
          </button>
        </div>
      </div>
      <div
        id={printId}
        className="font-serif text-gray-900 max-w-2xl mx-auto border border-gray-200 p-4 rounded"
      >
        {withHeader && (
          <div className="border-b pb-2 mb-3">
            {activeHeaderImg ? (
              <img
                src={activeHeaderImg}
                alt="Prescription Header"
                className="max-h-24 w-full object-contain"
              />
            ) : headerType === "hospital" ? (
              <div className="text-center">
                <h2 className="font-bold text-base">
                  {doctorInfo?.hospitalName ??
                    "Dr. Sirajul Islam Medical College Hospital"}
                </h2>
                <p className="text-sm text-gray-600">
                  Department of General Surgery
                </p>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold text-lg">
                    {doctorInfo?.name ?? "Dr. Arman Kabir (ZOSID)"}
                  </h2>
                  <p className="text-sm text-gray-600 font-medium">
                    {doctorInfo?.degrees ??
                      "MBBS (D.U.) | Emergency Medical Officer"}
                  </p>
                  {doctorInfo?.posts && (
                    <p className="text-xs text-gray-500">{doctorInfo.posts}</p>
                  )}
                  <p className="text-sm text-gray-600">
                    {doctorInfo?.chamber ?? "সেন্চুরি আর্কেড মার্কেট, মগবাজার, ঢাকা"}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-600">
                  {doctorInfo?.regNo && <p>Reg. no. {doctorInfo.regNo}</p>}
                  {!doctorInfo?.regNo && <p>Reg. no. A-105224</p>}
                  <p>Mob: {doctorInfo?.phone ?? "01751959262"}</p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Patient info */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm border-b pb-2 mb-3">
          {name && (
            <span>
              <strong>Name:</strong> {name}
            </span>
          )}
          {age && (
            <span>
              <strong>Age:</strong> {age} <strong>yrs</strong>
            </span>
          )}
          {sex && (
            <span>
              <strong>Sex:</strong> {sex}
            </span>
          )}
          {weight && (
            <span>
              <strong>Weight:</strong> {weight} <strong>kg</strong>
            </span>
          )}
          {regNo && (
            <span>
              <strong>Reg:</strong> {regNo}
            </span>
          )}
          <span>
            <strong>Date:</strong> {rxDate}
          </span>
        </div>

        {/* Two-column layout: clinical summary left, Rx right */}
        <div className="grid grid-cols-5 gap-3">
          {/* Left column: full clinical summary */}
          <div className="col-span-2 space-y-2 text-sm border-r pr-2">
            {cc && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  C/C
                </div>
                <div className="whitespace-pre-wrap text-xs">{cc}</div>
              </div>
            )}
            {pmh && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  P/M/H
                </div>
                <div className="whitespace-pre-wrap text-xs">{pmh}</div>
              </div>
            )}
            {hasHistory && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  History
                </div>
                <div className="text-xs space-y-0.5">
                  {historyPersonal && (
                    <div>
                      <span className="font-semibold">Personal: </span>
                      {historyPersonal}
                    </div>
                  )}
                  {historyFamily && (
                    <div>
                      <span className="font-semibold">Family: </span>
                      {historyFamily}
                    </div>
                  )}
                  {historyImmunization && (
                    <div>
                      <span className="font-semibold">Immunization: </span>
                      {historyImmunization}
                    </div>
                  )}
                  {historyAllergy && (
                    <div>
                      <span className="font-semibold">Allergy: </span>
                      {historyAllergy}
                    </div>
                  )}
                  {historyOthers && (
                    <div>
                      <span className="font-semibold">Others: </span>
                      {historyOthers}
                    </div>
                  )}
                </div>
              </div>
            )}
            {dh && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  D/H
                </div>
                <div className="whitespace-pre-wrap text-xs">{dh}</div>
              </div>
            )}
            {oe && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  O/E
                </div>
                <div className="whitespace-pre-wrap text-xs">{oe}</div>
              </div>
            )}
            {investigation && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  Investigation
                </div>
                <div className="whitespace-pre-wrap text-xs">
                  {investigation}
                </div>
              </div>
            )}
            {adviceNewInv && (
              <div>
                <div className="font-bold text-xs uppercase text-gray-500 mb-0.5">
                  Advice / New Inv.
                </div>
                <div className="whitespace-pre-wrap text-xs">
                  {adviceNewInv}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Rx */}
          <div className="col-span-3">
            {diagnosis && (
              <div className="mb-2">
                <span className="font-bold text-sm">Dx: </span>
                <span className="text-sm">{diagnosis}</span>
              </div>
            )}
            <div className="text-2xl font-bold mb-2">ℝ</div>
            {drugs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No medications added.
              </p>
            ) : (
              <div className="space-y-2">
                {drugs.map((d, i) => (
                  <div key={d.id} className="leading-snug">
                    {/* Line 1: number, form, drug name, dose */}
                    <div className="text-sm font-medium flex items-center gap-1 flex-wrap">
                      {i + 1}.{" "}
                      <span className="text-indigo-600">{d.drugForm}</span>{" "}
                      {d.brandName ? (
                        <>
                          <strong>{d.brandName}</strong>
                          {d.drugName && (
                            <span className="text-gray-400 text-xs ml-1">
                              ({d.drugName})
                            </span>
                          )}
                        </>
                      ) : d.nameType === "brand" ? (
                        <strong>{d.drugName}</strong>
                      ) : (
                        d.drugName
                      )}{" "}
                      <span>{d.dose}</span>
                      {d.isPrn && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 font-semibold ml-1">
                          PRN
                        </span>
                      )}
                    </div>
                    {/* Line 2: route, frequency/PRN condition, duration, instructions */}
                    <div className="text-xs text-gray-500 pl-4">
                      {d.isPrn ? (
                        <span className="italic text-purple-600">
                          PRN
                          {d.prnCondition
                            ? ` — ${d.prnCondition}`
                            : " (as needed)"}
                        </span>
                      ) : (
                        [
                          d.routeBn || d.route,
                          d.frequencyBn || d.frequency,
                          d.durationBn || d.duration
                            ? `–${d.durationBn || d.duration}`
                            : "",
                          d.instructionBn || d.instructions,
                        ]
                          .filter(Boolean)
                          .join("  ")
                      )}
                      {(d.specialInstructionBn || d.specialInstruction) && (
                        <span className="text-orange-600 ml-1">
                          · {d.specialInstructionBn || d.specialInstruction}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {adviceText && (
              <div className="mt-3 pt-2 border-t">
                <div className="font-bold text-xs uppercase text-gray-500 mb-1">
                  পরামর্শ
                </div>
                <div className="text-xs whitespace-pre-wrap">
                  {numberedAdvice}
                </div>
              </div>
            )}
            {followUpDate && (
              <div className="mt-3 pt-2 border-t">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Follow-up Date:{" "}
                  <span className="font-semibold">
                    {new Date(followUpDate).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            )}
            {/* Doctor Signature */}
            <div className="mt-8 pt-4 text-right">
              <div className="inline-block text-center">
                {signatureUrl && (
                  <img
                    src={signatureUrl}
                    alt="Doctor signature"
                    className="h-12 object-contain mx-auto mb-1"
                  />
                )}
                <div className="border-t border-gray-500 pt-1 min-w-[140px]">
                  <p className="text-xs text-gray-600 font-semibold">
                    Doctor's Signature
                  </p>
                  <p className="text-xs text-gray-500">
                    {doctorInfo?.name ?? "Dr. Arman Kabir (ZOSID)"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
