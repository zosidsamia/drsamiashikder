/**
 * EmergencyPrescription — Full-featured emergency prescription page.
 *
 * Layout mirrors UpgradedPrescriptionEMR:
 *   Left panel  — Clinical Summary (CC, HPI, PMH, Drug Hx, Exam, Allergies)
 *   Center panel — Rx drug table (same columns as UpgradedPrescriptionEMR)
 *   Right panel  — Advice, Patient Counselling, Follow-up, Valid Until
 *
 * New features vs old EmergencyPrescription:
 *   • Allergy alert banner (red) when drug matches known allergy + override
 *   • Drug interaction warnings
 *   • PRN drug toggle with condition field
 *   • Controlled drug flag with legal justification (audit logged)
 *   • Bilingual frequency / duration presets (English + Bangla)
 *   • Dispensed-as field (Brand / Generic / Substituted)
 *   • Titration schedule (Stage 1 + Stage 2) per drug
 *   • Prescription Valid Until field (default +30 days)
 *   • Patient Counselling notes (printed + visible in patient portal)
 *   • Same-day amendment: warns if prescription already exists today
 *   • Print/download with header image fallback + emergency stamp
 *   • "Save & Finalize" stamp with emergency badge after save
 *   • "New Patient" quick-registration modal (minimal fields, duplicate check)
 *   • After save: "View Prescription" + "New Emergency Rx" buttons
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Info,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  Trash2,
  User,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getPrescriptionHeaderHtml,
  numberAdviceLines,
} from "../components/PrescriptionHelpers";
import {
  checkDrugAllergyMatch,
  getAllergiesForPatient,
} from "../components/UpgradedPrescriptionEMR";
import { addEmergencyNotification } from "../components/patientDashboardTypes";
import { appendAuditLog, useEmailAuth } from "../hooks/useEmailAuth";
import {
  generateRegisterNumber,
  getDoctorEmail,
  getPrescriptionHeaderImage,
  loadFromStorage,
  storageKey,
  useCreatePatient,
  useCreatePrescription,
  useCreateVisit,
  useGetAllPatients,
} from "../hooks/useQueries";
import type { Medication, Patient, Prescription } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const DRUG_FORMS = [
  "Tab.",
  "Cap.",
  "Syp.",
  "Inj.",
  "Inf.",
  "Supp.",
  "Oint.",
  "Drop",
  "Cream",
  "Gel",
  "",
];

const ROUTES_BN: Array<{ en: string; bn: string }> = [
  { en: "PO", bn: "মুখে" },
  { en: "IV", bn: "শিরায়" },
  { en: "IM", bn: "মাংসপেশিতে" },
  { en: "SC", bn: "চামড়ার নিচে" },
  { en: "Topical", bn: "স্থানীয়" },
  { en: "Rectal", bn: "মলদ্বারে" },
  { en: "SL", bn: "জিহ্বার নিচে" },
  { en: "Inhalation", bn: "শ্বাসের মাধ্যমে" },
  { en: "Nasal", bn: "নাকে" },
];

const FREQUENCY_PRESETS: Array<{ en: string; bn: string }> = [
  { en: "Once daily", bn: "দিনে ১ বার" },
  { en: "BD 1+0+1", bn: "সকাল-রাত ১+০+১" },
  { en: "TDS 1+1+1", bn: "সকাল-দুপুর-রাত ১+১+১" },
  { en: "QDS 1+1+1+1", bn: "৬ ঘণ্টা পর পর" },
  { en: "8 hourly", bn: "৮ ঘণ্টা পর পর" },
  { en: "12 hourly", bn: "১২ ঘণ্টা পর পর" },
  { en: "STAT", bn: "এখনই" },
  { en: "At night", bn: "রাতে ঘুমানোর আগে" },
  { en: "SOS", bn: "প্রয়োজনে" },
];

const DURATION_PRESETS: Array<{ en: string; bn: string }> = [
  { en: "1 day", bn: "১ দিন" },
  { en: "3 days", bn: "৩ দিন" },
  { en: "5 days", bn: "৫ দিন" },
  { en: "7 days", bn: "৭ দিন" },
  { en: "14 days", bn: "১৪ দিন" },
  { en: "1 month", bn: "১ মাস" },
  { en: "Continue", bn: "চলমান" },
];

const INSTRUCTION_PRESETS: Array<{ en: string; bn: string }> = [
  { en: "After meal", bn: "খাবার পরে" },
  { en: "Before meal", bn: "খাবার আগে" },
  { en: "Empty stomach", bn: "খালি পেটে" },
  { en: "With water", bn: "পানির সাথে" },
];

const ADVICE_TEMPLATES = [
  "Rest and plenty of fluids.",
  "Avoid self-medication.",
  "Follow-up if not improved within 48 hours.",
  "Avoid spicy/oily food.",
  "Monitor blood pressure daily.",
  "Do not drive or operate heavy machinery.",
  "Take medicines after food.",
  "Return immediately if symptoms worsen.",
  "Complete the full course of antibiotics.",
  "Keep wounds clean and dry.",
];

// ── Emergency Drug Templates ──────────────────────────────────────────────────

interface EmergencyTemplate {
  label: string;
  drugs: Array<{
    drugForm: string;
    drugName: string;
    dose: string;
    route: string;
    frequency: string;
    isPrn?: boolean;
    prnCondition?: string;
    ivImDoseFormat?: "single" | "loading-maintenance" | "infusion";
    loadingDose?: string;
    maintenanceDose?: string;
  }>;
}

const EMERGENCY_TEMPLATES: Record<string, EmergencyTemplate> = {
  anaphylaxis: {
    label: "Anaphylaxis",
    drugs: [
      {
        drugForm: "Inj.",
        drugName: "Adrenaline (Epinephrine)",
        dose: "0.5mg",
        route: "IM",
        frequency: "STAT",
      },
      {
        drugForm: "Inj.",
        drugName: "Hydrocortisone",
        dose: "200mg",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "single",
      },
      {
        drugForm: "Inj.",
        drugName: "Chlorphenamine",
        dose: "10mg",
        route: "IV",
        frequency: "STAT",
      },
      {
        drugForm: "Inf.",
        drugName: "Normal Saline 0.9%",
        dose: "1000mL",
        route: "IV",
        frequency: "STAT (rapid infusion)",
      },
    ],
  },
  chest_pain: {
    label: "Acute Chest Pain",
    drugs: [
      {
        drugForm: "Tab.",
        drugName: "Aspirin",
        dose: "300mg",
        route: "PO",
        frequency: "STAT",
      },
      {
        drugForm: "Tab.",
        drugName: "GTN (Glyceryl Trinitrate)",
        dose: "0.5mg",
        route: "SL",
        frequency: "SOS",
        isPrn: true,
        prnCondition: "If chest pain persists",
      },
      {
        drugForm: "Inj.",
        drugName: "Morphine",
        dose: "2-5mg",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "single",
      },
      {
        drugForm: "Inj.",
        drugName: "Metoclopramide",
        dose: "10mg",
        route: "IV",
        frequency: "STAT",
      },
    ],
  },
  acute_asthma: {
    label: "Acute Asthma",
    drugs: [
      {
        drugForm: "Inj.",
        drugName: "Salbutamol nebuliser",
        dose: "2.5mg",
        route: "Inhalation",
        frequency: "Q20min x 3",
      },
      {
        drugForm: "Inj.",
        drugName: "Ipratropium nebuliser",
        dose: "0.5mg",
        route: "Inhalation",
        frequency: "STAT",
      },
      {
        drugForm: "Inj.",
        drugName: "Hydrocortisone",
        dose: "200mg",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "single",
      },
    ],
  },
  seizure: {
    label: "Seizure",
    drugs: [
      {
        drugForm: "Inj.",
        drugName: "Diazepam",
        dose: "10mg",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "single",
      },
      {
        drugForm: "Inj.",
        drugName: "Lorazepam",
        dose: "4mg",
        route: "IV",
        frequency: "STAT",
      },
      {
        drugForm: "Inj.",
        drugName: "Phenytoin",
        dose: "1000mg",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "loading-maintenance",
        loadingDose: "1000mg IV over 20 min",
        maintenanceDose: "100mg 8 hourly",
      },
    ],
  },
  hypertensive_crisis: {
    label: "Hypertensive Crisis",
    drugs: [
      {
        drugForm: "Inj.",
        drugName: "Labetalol",
        dose: "20mg",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "single",
      },
      {
        drugForm: "Cap.",
        drugName: "Nifedipine",
        dose: "10mg",
        route: "SL",
        frequency: "SOS",
        isPrn: true,
        prnCondition: "If BP > 180/120 mmHg",
      },
      {
        drugForm: "Inj.",
        drugName: "Frusemide",
        dose: "40mg",
        route: "IV",
        frequency: "STAT",
      },
    ],
  },
  hypoglycemia: {
    label: "Hypoglycemia",
    drugs: [
      {
        drugForm: "Inj.",
        drugName: "Dextrose 50%",
        dose: "50mL",
        route: "IV",
        frequency: "STAT",
        ivImDoseFormat: "single",
      },
      {
        drugForm: "Inj.",
        drugName: "Glucagon",
        dose: "1mg",
        route: "IM",
        frequency: "STAT",
      },
    ],
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface RxDrug {
  id: string;
  drugForm: string;
  route: string;
  routeBn: string;
  drugName: string;
  brandName: string;
  dose: string;
  duration: string;
  durationBn: string;
  instructions: string;
  instructionBn: string;
  frequency: string;
  frequencyBn: string;
  specialInstruction: string;
  specialInstructionBn: string;
  isPrn?: boolean;
  prnCondition?: string;
  isControlled?: boolean;
  controlledJustification?: string;
  dispensedAs?: "brand" | "generic" | "substituted";
  substitutedBrand?: string;
  // Titration
  titrationEnabled?: boolean;
  titrationStage1Dose?: string;
  titrationStage1Duration?: string;
  titrationStage2Dose?: string;
  titrationStage2Duration?: string;
  // IV/IM dose format
  ivImDoseFormat?: "single" | "loading-maintenance" | "infusion";
  loadingDose?: string;
  maintenanceDose?: string;
  infusionRate?: string;
  infusionUnit?: "mcg/kg/min" | "mg/hr";
}

interface NewPatientForm {
  fullName: string;
  ageStr: string;
  dobStr: string;
  gender: string;
  phone: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkId() {
  return `rx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyDrug(): RxDrug {
  return {
    id: mkId(),
    drugForm: "Tab.",
    route: "PO",
    routeBn: "মুখে",
    drugName: "",
    brandName: "",
    dose: "",
    duration: "",
    durationBn: "",
    instructions: "",
    instructionBn: "",
    frequency: "",
    frequencyBn: "",
    specialInstruction: "",
    specialInstructionBn: "",
  };
}

function getAge(dateOfBirth?: bigint): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(Number(dateOfBirth / 1_000_000n));
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function parseAgeToApproxDob(ageStr: string): bigint | null {
  const age = Number.parseInt(ageStr, 10);
  if (Number.isNaN(age) || age < 0 || age > 130) return null;
  const year = new Date().getFullYear() - age;
  return BigInt(new Date(`${year}-01-01`).getTime()) * 1_000_000n;
}

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ── Drug interaction check (lightweight) ──────────────────────────────────────

const KNOWN_INTERACTIONS: Array<[string, string, string]> = [
  ["warfarin", "aspirin", "Increased bleeding risk — use caution."],
  ["warfarin", "ibuprofen", "Increased bleeding risk — use caution."],
  [
    "metformin",
    "contrast",
    "Hold metformin 48h before/after iodinated contrast.",
  ],
  ["ssri", "tramadol", "Risk of serotonin syndrome — monitor closely."],
  ["digoxin", "amiodarone", "Digoxin toxicity risk — reduce digoxin dose."],
  [
    "clopidogrel",
    "omeprazole",
    "Reduced antiplatelet effect — prefer pantoprazole.",
  ],
  [
    "methotrexate",
    "nsaid",
    "Methotrexate toxicity risk — avoid concurrent use.",
  ],
  ["quinolone", "antacid", "Impaired quinolone absorption — separate by 2h."],
];

function checkDrugInteractions(drugs: RxDrug[]): string[] {
  const names = drugs.map((d) => `${d.drugName} ${d.brandName}`.toLowerCase());
  const warnings: string[] = [];
  for (const [a, b, msg] of KNOWN_INTERACTIONS) {
    const hasA = names.some((n) => n.includes(a));
    const hasB = names.some((n) => n.includes(b));
    if (hasA && hasB) warnings.push(msg);
  }
  return [...new Set(warnings)];
}

// ── Emergency Prescription Print ──────────────────────────────────────────────

function printEmergencyPrescription(opts: {
  patient: Patient;
  age: number | null;
  doctor: { name?: string; specialization?: string; phone?: string } | null;
  emergencyDateTime: Date;
  cc: string;
  hpi: string;
  pmh: string;
  dh: string;
  oe: string;
  diagnosis: string;
  drugs: RxDrug[];
  adviceText: string;
  counselling: string;
  followUpDate: string;
  validUntil: string;
  isNewPatient?: boolean;
}) {
  const {
    patient,
    age,
    doctor,
    emergencyDateTime,
    cc,
    hpi,
    pmh,
    dh,
    oe,
    diagnosis,
    drugs,
    adviceText,
    counselling,
    followUpDate,
    validUntil,
    isNewPatient,
  } = opts;

  const headerHtml = getPrescriptionHeaderHtml("chamber", {
    doctorName: doctor?.name ?? "Doctor",
    specialization: doctor?.specialization ?? "",
    phone: doctor?.phone ?? "",
  });

  const drugsHtml = drugs
    .filter((d) => d.drugName.trim())
    .map(
      (d, i) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:4px 6px;font-weight:600;color:#dc2626;">${i + 1}.</td>
      <td style="padding:4px 6px;">${d.drugForm} <strong>${d.drugName}</strong>${d.brandName ? ` (${d.brandName})` : ""}${d.isControlled ? ' <span style="color:#dc2626;font-weight:bold;">[CONTROLLED]</span>' : ""}${d.isPrn ? ' <em style="color:#6b7280;">[PRN]</em>' : ""}</td>
      <td style="padding:4px 6px;">${d.dose}</td>
      <td style="padding:4px 6px;">${d.route}${d.routeBn ? ` / ${d.routeBn}` : ""}</td>
      <td style="padding:4px 6px;">${d.isPrn ? `PRN${d.prnCondition ? ` — ${d.prnCondition}` : ""}` : `${d.frequency}${d.frequencyBn ? ` / ${d.frequencyBn}` : ""}`}</td>
      <td style="padding:4px 6px;">${d.isPrn ? "–" : `${d.duration}${d.durationBn ? ` / ${d.durationBn}` : ""}`}</td>
      <td style="padding:4px 6px;color:#6b7280;">${d.instructions}${d.instructionBn ? ` / ${d.instructionBn}` : ""}${d.specialInstruction ? `<br/><em>${d.specialInstruction}</em>` : ""}${d.titrationEnabled ? `<br/><strong>Titration:</strong> ${d.titrationStage1Dose || ""} × ${d.titrationStage1Duration || ""} → ${d.titrationStage2Dose || ""} × ${d.titrationStage2Duration || ""}` : ""}</td>
    </tr>`,
    )
    .join("");

  const adviceHtml = numberAdviceLines(adviceText)
    .split("\n")
    .filter(Boolean)
    .map((l) => `<li>${l}</li>`)
    .join("");

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>Emergency Prescription — ${patient.fullName}</title>
    <style>
      @media print { @page { margin: 12mm 15mm; } }
      body { font-family: 'Segoe UI', sans-serif; font-size: 12px; color: #111827; margin:0; }
      .emergency-stamp { background: linear-gradient(90deg,#dc2626,#ea580c); color:white; padding:6px 16px; border-radius:6px; font-weight:700; letter-spacing:1px; display:inline-block; margin-bottom:8px; }
      .section-title { font-weight:700; font-size:10px; text-transform:uppercase; color:#6b7280; border-bottom:1px solid #e5e7eb; padding-bottom:2px; margin-bottom:4px; margin-top:10px; }
      table.rx-table { width:100%; border-collapse:collapse; margin-top:6px; }
      table.rx-table th { background:#fef2f2; color:#991b1b; font-size:10px; padding:4px 6px; text-align:left; border-bottom:2px solid #fca5a5; }
      .valid-banner { border:1px solid #d97706; background:#fffbeb; padding:4px 10px; border-radius:4px; font-size:11px; }
    </style>
  </head><body>
    ${headerHtml}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <span class="emergency-stamp">🚨 EMERGENCY PRESCRIPTION</span>${isNewPatient ? ' <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">NEW PATIENT — Emergency Registration</span>' : ""}
        <div style="font-size:11px;color:#6b7280;margin-top:4px;">Date: ${format(emergencyDateTime, "dd MMM yyyy, HH:mm")} &nbsp;|&nbsp; Prescribing doctor: ${doctor?.name ?? "Doctor"}</div>
      </div>
    </div>

    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 12px;margin:10px 0;display:flex;gap:24px;flex-wrap:wrap;">
      <div><strong>${patient.fullName}</strong>${age !== null ? ` — ${age} yrs` : ""} ${patient.gender ? `/ ${patient.gender}` : ""}</div>
      ${patient.registerNumber ? `<div>Reg: <strong>${patient.registerNumber}</strong></div>` : ""}
      ${patient.phone ? `<div>Ph: ${patient.phone}</div>` : ""}
      ${patient.bloodGroup ? `<div style="color:#b91c1c;font-weight:600;">Blood: ${patient.bloodGroup}</div>` : ""}
      ${patient.allergies?.length > 0 ? `<div style="color:#b91c1c;"><strong>⚠️ Allergies:</strong> ${patient.allergies.join(", ")}</div>` : ""}
    </div>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;">
      <div>
        ${cc ? `<div class="section-title">Chief Complaint / C/C</div><p style="margin:0;">${cc.replace(/\n/g, "<br/>")}</p>` : ""}
        ${hpi ? `<div class="section-title">History of Present Illness</div><p style="margin:0;">${hpi.replace(/\n/g, "<br/>")}</p>` : ""}
        ${pmh ? `<div class="section-title">Past Medical History / P/M/H</div><p style="margin:0;">${pmh.replace(/\n/g, "<br/>")}</p>` : ""}
        ${dh ? `<div class="section-title">Drug History / D/H</div><p style="margin:0;">${dh.replace(/\n/g, "<br/>")}</p>` : ""}
        ${oe ? `<div class="section-title">On Examination / O/E</div><p style="margin:0;">${oe.replace(/\n/g, "<br/>")}</p>` : ""}
      </div>
      <div>
        <div class="section-title" style="color:#b91c1c;">Diagnosis</div>
        <p style="font-weight:700;margin:0 0 8px;">${diagnosis || "—"}</p>
        <div class="section-title" style="color:#b91c1c;font-size:14px;">℞ Medications</div>
        <table class="rx-table">
          <thead><tr>
            <th>#</th><th>Drug</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Instructions</th>
          </tr></thead>
          <tbody>${drugsHtml}</tbody>
        </table>
        ${adviceHtml ? `<div class="section-title">Advice</div><ol style="margin:0;padding-left:18px;">${adviceHtml}</ol>` : ""}
        ${counselling ? `<div class="section-title">Patient Counselling</div><p style="margin:0;">${counselling.replace(/\n/g, "<br/>")}</p>` : ""}
      </div>
    </div>

    <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:12px;">
      ${followUpDate ? `<div style="background:#f0fdf4;border:1px solid #86efac;padding:4px 12px;border-radius:4px;">Follow-up: <strong>${format(new Date(followUpDate), "dd MMM yyyy")}</strong></div>` : ""}
      ${validUntil ? `<div class="valid-banner">Valid until: <strong>${format(new Date(validUntil), "dd MMM yyyy")}</strong></div>` : ""}
    </div>

    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;">
      <div>
        <div style="font-size:10px;color:#6b7280;">Doctor's Signature</div>
        <div style="width:140px;border-bottom:1px solid #374151;margin-top:24px;"></div>
        <div style="font-size:10px;margin-top:2px;">${doctor?.name ?? ""}</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#fee2e2;border:2px solid #fca5a5;border-radius:6px;padding:4px 16px;">
          <div style="font-weight:700;color:#dc2626;font-size:11px;">🚨 EMERGENCY</div>
          <div style="font-size:9px;color:#b91c1c;">Auto-created visit record</div>
        </div>
      </div>
    </div>

    <script>setTimeout(()=>window.print(),400);</script>
  </body></html>`);
  win.document.close();
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmergencyPrescription() {
  const { currentDoctor } = useEmailAuth();

  // ── Patient search ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: allPatients = [], isLoading: loadingPatients } =
    useGetAllPatients();

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return (allPatients as Patient[])
      .filter(
        (p) =>
          p.fullName?.toLowerCase().includes(q) ||
          p.registerNumber?.toLowerCase().includes(q) ||
          p.phone?.includes(q),
      )
      .slice(0, 10);
  }, [allPatients, searchQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Emergency bar ─────────────────────────────────────────────────────────────
  const [visitId, setVisitId] = useState<string | null>(null);
  const [emergencyDateTime, setEmergencyDateTime] = useState<Date>(new Date());
  useEffect(() => {
    if (selectedPatient) setEmergencyDateTime(new Date());
  }, [selectedPatient]);

  const age = selectedPatient ? getAge(selectedPatient.dateOfBirth) : null;

  // ── Clinical summary (left panel) ────────────────────────────────────────────
  const [cc, setCc] = useState("");
  const [hpi, setHpi] = useState("");
  const [pmh, setPmh] = useState("");
  const [dh, setDh] = useState("");
  const [oe, setOe] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  // ── Rx drugs (center panel) ───────────────────────────────────────────────────
  const [drugs, setDrugs] = useState<RxDrug[]>([emptyDrug()]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Drug input form
  const [df, setDf] = useState("Tab.");
  const [dRoute, setDRoute] = useState("PO");
  const [dName, setDName] = useState("");
  const [dBrand, setDBrand] = useState("");
  const [dDose, setDDose] = useState("");
  const [dFreq, setDFreq] = useState("");
  const [dFreqBn, setDFreqBn] = useState("");
  const [dDur, setDDur] = useState("");
  const [dDurBn, setDDurBn] = useState("");
  const [dInstr, setDInstr] = useState("");
  const [dInstrBn, setDInstrBn] = useState("");
  const [dSpecial, setDSpecial] = useState("");
  const [dSpecialBn, setDSpecialBn] = useState("");
  const [dPrn, setDPrn] = useState(false);
  const [dPrnCond, setDPrnCond] = useState("");
  const [dControlled, setDControlled] = useState(false);
  const [dControlledJust, setDControlledJust] = useState("");
  const [dDispensedAs, setDDispensedAs] = useState<
    "" | "brand" | "generic" | "substituted"
  >("");
  const [dSubBrand, setDSubBrand] = useState("");
  const [dTitration, setDTitration] = useState(false);
  const [dTit1Dose, setDTit1Dose] = useState("");
  const [dTit1Dur, setDTit1Dur] = useState("");
  const [dTit2Dose, setDTit2Dose] = useState("");
  const [dTit2Dur, setDTit2Dur] = useState("");
  // IV/IM dose format fields
  const [dIvImDoseFormat, setDIvImDoseFormat] = useState<
    "single" | "loading-maintenance" | "infusion" | ""
  >("");
  const [dLoadingDose, setDLoadingDose] = useState("");
  const [dMaintenanceDose, setDMaintenanceDose] = useState("");
  const [dInfusionRate, setDInfusionRate] = useState("");
  const [dInfusionUnit, setDInfusionUnit] = useState<"mcg/kg/min" | "mg/hr">(
    "mg/hr",
  );

  // ── Emergency template state ──────────────────────────────────────────────────
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templateWarningShown, setTemplateWarningShown] = useState(false);

  // ── Quick Vitals Strip ────────────────────────────────────────────────────────
  const [showVitalsStrip, setShowVitalsStrip] = useState(true);
  const [vBpSys, setVBpSys] = useState("");
  const [vBpDia, setVBpDia] = useState("");
  const [vPulse, setVPulse] = useState("");
  const [vSpo2, setVSpo2] = useState("");
  const [vRbs, setVRbs] = useState("");
  const [vTemp, setVTemp] = useState("");
  const [vGcs, setVGcs] = useState("");
  const [vWeight, setVWeight] = useState("");

  // ── Next Action (post-finalize) ───────────────────────────────────────────────
  const [nextAction, setNextAction] = useState<
    "" | "admit" | "refer" | "discharge" | "observe"
  >("");
  const [nextActionCompleted, setNextActionCompleted] = useState(false);
  const [referSpecialist, setReferSpecialist] = useState("");
  const [referHospital, setReferHospital] = useState("");
  const [referReason, setReferReason] = useState("");
  const [dischargeInstructions, setDischargeInstructions] = useState("");

  // ── Time of Emergency (editable) ─────────────────────────────────────────────
  const [emergencyTimeOverride, setEmergencyTimeOverride] = useState("");

  // ── Allergy & interaction alerts ──────────────────────────────────────────────
  const unifiedAllergies = useMemo(
    () => getAllergiesForPatient(selectedPatient?.allergies ?? []),
    [selectedPatient],
  );
  const [allergyAlert, setAllergyAlert] = useState<{
    drugName: string;
    allergen: string;
  } | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideJust, setOverrideJust] = useState("");
  const interactionWarnings = useMemo(
    () => checkDrugInteractions(drugs),
    [drugs],
  );

  // ── Advice & bottom panel (right panel) ───────────────────────────────────────
  const [adviceText, setAdviceText] = useState("");
  const [counselling, setCounselling] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);

  // ── Save state ────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [_savedPrescriptionId, setSavedPrescriptionId] = useState<
    string | null
  >(null);

  const createVisitMutation = useCreateVisit();
  const createRxMutation = useCreatePrescription();

  // ── New patient modal ─────────────────────────────────────────────────────────
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [npForm, setNpForm] = useState<NewPatientForm>({
    fullName: "",
    ageStr: "",
    dobStr: "",
    gender: "male",
    phone: "",
    bloodGroup: "",
    allergies: "",
    chronicConditions: "",
  });
  const [npDupWarning, setNpDupWarning] = useState<string | null>(null);
  const [npSaving, setNpSaving] = useState(false);
  const createPatientMutation = useCreatePatient();

  // ── Draft autosave ────────────────────────────────────────────────────────────
  const draftKey = selectedPatient ? `emrx_draft_${selectedPatient.id}` : null;

  const saveDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          cc,
          hpi,
          pmh,
          dh,
          oe,
          diagnosis,
          drugs,
          adviceText,
          counselling,
          followUpDate,
          validUntil,
        }),
      );
    } catch {
      /* silent */
    }
  }, [
    draftKey,
    cc,
    hpi,
    pmh,
    dh,
    oe,
    diagnosis,
    drugs,
    adviceText,
    counselling,
    followUpDate,
    validUntil,
  ]);

  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(saveDraft, 1200);
  }, [saveDraft]);

  // Load draft when patient is selected
  const patientIdStr = selectedPatient ? String(selectedPatient.id) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only reload on patient change
  useEffect(() => {
    if (!selectedPatient || !draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.cc) setCc(d.cc);
      if (d.hpi) setHpi(d.hpi);
      if (d.pmh) setPmh(d.pmh);
      if (d.dh) setDh(d.dh);
      if (d.oe) setOe(d.oe);
      if (d.diagnosis) setDiagnosis(d.diagnosis);
      if (d.drugs && Array.isArray(d.drugs) && d.drugs.length > 0)
        setDrugs(d.drugs);
      if (d.adviceText) setAdviceText(d.adviceText);
      if (d.counselling) setCounselling(d.counselling);
      if (d.followUpDate) setFollowUpDate(d.followUpDate);
      if (d.validUntil) setValidUntil(d.validUntil);
    } catch {
      /* silent */
    }
  }, [patientIdStr, draftKey]);

  // ── Duration/follow-up mismatch ───────────────────────────────────────────────
  function parseDays(s: string): number {
    if (!s) return 0;
    const low = s.toLowerCase();
    if (low.includes("month")) return (Number.parseFloat(low) || 1) * 30;
    if (low.includes("week")) return (Number.parseFloat(low) || 1) * 7;
    const n = Number.parseFloat(low);
    return Number.isNaN(n) ? 0 : n;
  }

  const maxDrugDays = drugs
    .filter((d) => !d.isPrn)
    .reduce((m, d) => Math.max(m, parseDays(d.duration)), 0);
  const followUpGap = followUpDate
    ? Math.round((new Date(followUpDate).getTime() - Date.now()) / 86400000)
    : null;
  const mismatchWarning =
    followUpDate &&
    maxDrugDays > 0 &&
    followUpGap !== null &&
    followUpGap > maxDrugDays
      ? `Patient may run out of medication ${followUpGap - maxDrugDays} day(s) before follow-up.`
      : null;

  // ── Drug form actions ─────────────────────────────────────────────────────────
  function resetDrugForm() {
    setDf("Tab.");
    setDRoute("PO");
    setDName("");
    setDBrand("");
    setDDose("");
    setDFreq("");
    setDFreqBn("");
    setDDur("");
    setDDurBn("");
    setDInstr("");
    setDInstrBn("");
    setDSpecial("");
    setDSpecialBn("");
    setDPrn(false);
    setDPrnCond("");
    setDControlled(false);
    setDControlledJust("");
    setDDispensedAs("");
    setDSubBrand("");
    setDTitration(false);
    setDTit1Dose("");
    setDTit1Dur("");
    setDTit2Dose("");
    setDTit2Dur("");
    setDIvImDoseFormat("");
    setDLoadingDose("");
    setDMaintenanceDose("");
    setDInfusionRate("");
    setDInfusionUnit("mg/hr");
    setEditingId(null);
  }

  function loadDrugForEdit(drug: RxDrug) {
    setDf(drug.drugForm || "Tab.");
    setDRoute(drug.route || "PO");
    setDName(drug.drugName);
    setDBrand(drug.brandName || "");
    setDDose(drug.dose || "");
    setDFreq(drug.frequency || "");
    setDFreqBn(drug.frequencyBn || "");
    setDDur(drug.duration || "");
    setDDurBn(drug.durationBn || "");
    setDInstr(drug.instructions || "");
    setDInstrBn(drug.instructionBn || "");
    setDSpecial(drug.specialInstruction || "");
    setDSpecialBn(drug.specialInstructionBn || "");
    setDPrn(drug.isPrn ?? false);
    setDPrnCond(drug.prnCondition || "");
    setDControlled(drug.isControlled ?? false);
    setDControlledJust(drug.controlledJustification || "");
    setDDispensedAs(drug.dispensedAs ?? "");
    setDSubBrand(drug.substitutedBrand || "");
    setDTitration(drug.titrationEnabled ?? false);
    setDTit1Dose(drug.titrationStage1Dose || "");
    setDTit1Dur(drug.titrationStage1Duration || "");
    setDTit2Dose(drug.titrationStage2Dose || "");
    setDTit2Dur(drug.titrationStage2Duration || "");
    setDIvImDoseFormat(drug.ivImDoseFormat ?? "");
    setDLoadingDose(drug.loadingDose || "");
    setDMaintenanceDose(drug.maintenanceDose || "");
    setDInfusionRate(drug.infusionRate || "");
    setDInfusionUnit(drug.infusionUnit ?? "mg/hr");
    setEditingId(drug.id);
    setTimeout(() => {
      document
        .getElementById("emrx-drug-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function commitDrug() {
    if (!dName.trim()) {
      toast.error("Drug name is required.");
      return;
    }
    const matched = checkDrugAllergyMatch(dName.trim(), unifiedAllergies);
    const built: RxDrug = {
      id: editingId ?? mkId(),
      drugForm: df,
      route: dRoute,
      routeBn: ROUTES_BN.find((r) => r.en === dRoute)?.bn || "",
      drugName: dName.trim(),
      brandName: dBrand.trim(),
      dose: dDose,
      duration: dDur,
      durationBn: dDurBn,
      instructions: dInstr,
      instructionBn: dInstrBn,
      frequency: dFreq,
      frequencyBn: dFreqBn,
      specialInstruction: dSpecial,
      specialInstructionBn: dSpecialBn,
      isPrn: dPrn,
      prnCondition: dPrn ? dPrnCond : "",
      isControlled: dControlled,
      controlledJustification: dControlled ? dControlledJust : "",
      dispensedAs: dDispensedAs || undefined,
      substitutedBrand: dDispensedAs === "substituted" ? dSubBrand : undefined,
      titrationEnabled: dTitration,
      titrationStage1Dose: dTitration ? dTit1Dose : undefined,
      titrationStage1Duration: dTitration ? dTit1Dur : undefined,
      titrationStage2Dose: dTitration ? dTit2Dose : undefined,
      titrationStage2Duration: dTitration ? dTit2Dur : undefined,
      ivImDoseFormat:
        (dRoute === "IV" || dRoute === "IM") && dIvImDoseFormat
          ? dIvImDoseFormat
          : undefined,
      loadingDose:
        dIvImDoseFormat === "loading-maintenance" ? dLoadingDose : undefined,
      maintenanceDose:
        dIvImDoseFormat === "loading-maintenance"
          ? dMaintenanceDose
          : undefined,
      infusionRate: dIvImDoseFormat === "infusion" ? dInfusionRate : undefined,
      infusionUnit: dIvImDoseFormat === "infusion" ? dInfusionUnit : undefined,
    };
    if (editingId) {
      setDrugs((prev) => prev.map((d) => (d.id === editingId ? built : d)));
    } else {
      setDrugs((prev) => [...prev, built]);
    }
    if (matched) {
      setAllergyAlert({ drugName: dName.trim(), allergen: matched });
      setShowOverride(false);
    }
    resetDrugForm();
  }

  function removeDrug(id: string) {
    setDrugs((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) resetDrugForm();
  }

  // ── New patient modal actions ─────────────────────────────────────────────────
  function checkDuplicate() {
    if (!npForm.phone.trim()) return;
    const dup = (allPatients as Patient[]).find(
      (p) => p.phone === npForm.phone.trim(),
    );
    if (dup) {
      setNpDupWarning(
        `A patient with this phone (${dup.fullName}, ${dup.registerNumber ?? ""}) already exists. You may still proceed to create a new record, or select the existing patient.`,
      );
    } else {
      setNpDupWarning(null);
    }
  }

  async function handleNewPatientSave() {
    if (!npForm.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (!npForm.phone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (!npForm.gender) {
      toast.error("Gender is required.");
      return;
    }
    if (!npForm.ageStr && !npForm.dobStr) {
      toast.error("Age or date of birth is required.");
      return;
    }

    setNpSaving(true);
    try {
      let dob: bigint | null = null;
      if (npForm.dobStr) {
        dob = BigInt(new Date(npForm.dobStr).getTime()) * 1_000_000n;
      } else if (npForm.ageStr) {
        dob = parseAgeToApproxDob(npForm.ageStr);
      }

      const newPat = await createPatientMutation.mutateAsync({
        fullName: npForm.fullName.trim(),
        nameBn: null,
        dateOfBirth: dob,
        gender: npForm.gender,
        phone: npForm.phone.trim(),
        email: null,
        address: null,
        bloodGroup: npForm.bloodGroup.trim() || null,
        weight: null,
        height: null,
        allergies: npForm.allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        chronicConditions: npForm.chronicConditions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        pastSurgicalHistory: null,
        patientType: "emergency",
      });

      // Mark registration as incomplete for emergency patients
      try {
        localStorage.setItem(`patient_reg_incomplete_${newPat.id}`, "true");
      } catch {}

      setSelectedPatient(newPat);
      setIsNewPatient(true);
      setShowNewPatientModal(false);
      setNpForm({
        fullName: "",
        ageStr: "",
        dobStr: "",
        gender: "male",
        phone: "",
        bloodGroup: "",
        allergies: "",
        chronicConditions: "",
      });
      toast.success(
        `New patient registered: ${newPat.fullName} (${newPat.registerNumber})`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to register patient. Please try again.");
    } finally {
      setNpSaving(false);
    }
  }

  // ── Save & Finalize ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedPatient) {
      toast.error("Please select a patient first.");
      return;
    }
    if (!cc.trim() && !diagnosis.trim()) {
      toast.error("Chief complaint or diagnosis is required.");
      return;
    }
    const validDrugs = drugs.filter((d) => d.drugName.trim());
    if (validDrugs.length === 0) {
      toast.error("Add at least one medication.");
      return;
    }
    if (dControlled && !dControlledJust.trim()) {
      toast.error("Legal justification required for controlled drug.");
      return;
    }

    setSaving(true);
    try {
      const now = BigInt(Date.now()) * 1_000_000n;
      const visitNano = now;

      // 1. Create emergency visit
      const newVisit = await createVisitMutation.mutateAsync({
        patientId: selectedPatient.id,
        visitDate: visitNano,
        chiefComplaint: cc.trim() || diagnosis.trim(),
        historyOfPresentIllness: hpi.trim() || null,
        vitalSigns:
          vBpSys || vPulse || vSpo2
            ? {
                bloodPressure:
                  vBpSys && vBpDia
                    ? `${vBpSys}/${vBpDia}`
                    : vBpSys || undefined,
                pulse: vPulse || undefined,
                oxygenSaturation: vSpo2 || undefined,
                temperature: vTemp || undefined,
                weight: vWeight || undefined,
                gcs: vGcs || undefined,
                rbs: vRbs || undefined,
              }
            : {},
        physicalExamination: oe.trim() || null,
        diagnosis: diagnosis.trim() || null,
        notes: adviceText.trim() || null,
        visitType: "emergency",
      });
      setVisitId(newVisit.id.toString());

      // 2. Build medications
      const medications: Medication[] = validDrugs.map((d) => ({
        name: `${d.drugForm ? `${d.drugForm} ` : ""}${d.drugName}${d.brandName ? ` (${d.brandName})` : ""}`,
        dose: d.dose,
        frequency: d.isPrn
          ? `PRN${d.prnCondition ? ` — ${d.prnCondition}` : ""}`
          : d.frequencyBn
            ? `${d.frequency} / ${d.frequencyBn}`
            : d.frequency,
        duration: d.isPrn
          ? ""
          : d.durationBn
            ? `${d.duration} / ${d.durationBn}`
            : d.duration,
        instructions: d.instructionBn
          ? `${d.instructions} / ${d.instructionBn}`
          : d.instructions,
        drugForm: d.drugForm,
        drugName: d.drugName,
        route: d.route,
        routeBn: d.routeBn,
        frequencyBn: d.frequencyBn,
        durationBn: d.durationBn,
        specialInstruction: d.specialInstruction,
        specialInstructionBn: d.specialInstructionBn,
        isPrn: d.isPrn ? "true" : "false",
        prnCondition: d.prnCondition || "",
        // Extended fields stored as strings for index compat
        isControlled: d.isControlled ? "true" : "false",
        controlledJustification: d.controlledJustification || "",
        dispensedAs: d.dispensedAs || "",
        substitutedBrand: d.substitutedBrand || "",
        prescriptionType: "emergency",
      }));

      // 3. Build notes (advice + counselling)
      const noteParts: string[] = [];
      if (adviceText.trim()) noteParts.push(`ADVICE:\n${adviceText.trim()}`);
      if (counselling.trim())
        noteParts.push(`COUNSELLING:\n${counselling.trim()}`);

      // 4. Create prescription
      const newRx = await createRxMutation.mutateAsync({
        patientId: selectedPatient.id,
        visitId: newVisit.id,
        prescriptionDate: now,
        diagnosis: diagnosis.trim() || null,
        medications,
        notes: noteParts.join("\n\n") || null,
      });

      // 5. Persist extended fields (valid until, follow-up, counselling, snapshot, emergency flag)
      const extKey = `prescription_ext_${newRx.id}`;
      localStorage.setItem(
        extKey,
        JSON.stringify({
          prescriptionType: "emergency",
          isNewPatient,
          validUntil,
          followUpDate,
          counselling,
          finalizedAt: Date.now(),
          finalizedBy: getDoctorEmail(),
          chiefComplaintSnapshot: cc.trim(),
          diagnosisSnapshot: diagnosis.trim(),
        }),
      );

      // 6. Clear draft
      if (draftKey) localStorage.removeItem(draftKey);

      // 7. Create nurse notification for emergency Rx
      addEmergencyNotification({
        type: "EMERGENCY_RX",
        patientId: selectedPatient.id.toString(),
        patientName: selectedPatient.fullName,
        prescriptionId: newRx.id.toString(),
        time: new Date().toISOString(),
        acknowledged: false,
      });

      setSavedPrescriptionId(newRx.id.toString());
      setFinalized(true);
      toast.success("Emergency prescription saved & finalized!", {
        description: `Patient: ${selectedPatient.fullName} | ${format(new Date(), "dd MMM yyyy, HH:mm")}`,
        duration: 6000,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save prescription. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setSelectedPatient(null);
    setSearchQuery("");
    setVisitId(null);
    setIsNewPatient(false);
    setCc("");
    setHpi("");
    setPmh("");
    setDh("");
    setOe("");
    setDiagnosis("");
    setDrugs([emptyDrug()]);
    setAdviceText("");
    setCounselling("");
    setFollowUpDate("");
    setValidUntil(defaultValidUntil());
    setFinalized(false);
    setSavedPrescriptionId(null);
    setAllergyAlert(null);
    resetDrugForm();
    // Reset vitals
    setVBpSys("");
    setVBpDia("");
    setVPulse("");
    setVSpo2("");
    setVRbs("");
    setVTemp("");
    setVGcs("");
    setVWeight("");
    // Reset next action
    setNextAction("");
    setNextActionCompleted(false);
    setReferSpecialist("");
    setReferHospital("");
    setReferReason("");
    setDischargeInstructions("");
    setEmergencyTimeOverride("");
    setTemplateWarningShown(false);
  }

  // ── Apply emergency drug template ─────────────────────────────────────────
  function applyEmergencyTemplate(templateKey: string) {
    const tpl = EMERGENCY_TEMPLATES[templateKey];
    if (!tpl) return;
    const newDrugs: RxDrug[] = tpl.drugs.map((d) => ({
      id: mkId(),
      drugForm: d.drugForm,
      route: d.route,
      routeBn: ROUTES_BN.find((r) => r.en === d.route)?.bn || "",
      drugName: d.drugName,
      brandName: "",
      dose: d.dose,
      duration: "STAT",
      durationBn: "",
      instructions: "",
      instructionBn: "",
      frequency: d.frequency,
      frequencyBn: "",
      specialInstruction: "",
      specialInstructionBn: "",
      isPrn: d.isPrn ?? false,
      prnCondition: d.prnCondition || "",
      ivImDoseFormat: d.ivImDoseFormat,
      loadingDose: d.loadingDose || "",
      maintenanceDose: d.maintenanceDose || "",
    }));
    setDrugs(newDrugs);
    setShowTemplateDropdown(false);
    setTemplateWarningShown(true);
    toast.warning("Emergency template loaded — review doses before saving!", {
      description:
        "These are suggested protocols, not individual prescriptions.",
      duration: 7000,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Nav Bar ── */}
      <div className="bg-card border-b border-border sticky top-16 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                window.location.href = "/Dashboard";
              }}
              data-ocid="emergency_rx.back.button"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Siren className="w-4 h-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-foreground text-sm leading-none truncate">
                  Emergency Prescription
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                  Fast-track emergency clinical order entry
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedPatient && !finalized && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-muted-foreground h-8"
                  onClick={() =>
                    printEmergencyPrescription({
                      patient: selectedPatient,
                      age,
                      doctor: currentDoctor,
                      emergencyDateTime,
                      cc,
                      hpi,
                      pmh,
                      dh,
                      oe,
                      diagnosis,
                      drugs,
                      adviceText,
                      counselling,
                      followUpDate,
                      validUntil,
                      isNewPatient,
                    })
                  }
                  data-ocid="emergency_rx.print.button"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-muted-foreground h-8"
                  onClick={handleClear}
                  data-ocid="emergency_rx.clear.button"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm h-8"
                  onClick={handleSave}
                  disabled={saving}
                  data-ocid="emergency_rx.save.primary_button"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  {saving ? "Saving..." : "Save & Finalize"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* ── Patient Search ── */}
        {!selectedPatient && (
          <div
            className="bg-card border border-border rounded-2xl p-6 shadow-sm"
            data-ocid="emergency_rx.patient_search.panel"
          >
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-7 h-7 text-red-600" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Emergency Prescription
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Search for an existing patient, or register a new emergency
                  patient
                </p>
              </div>

              <div className="flex gap-2 mb-3">
                <div ref={searchRef} className="relative flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, register no., or phone..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowResults(true);
                      }}
                      onFocus={() => setShowResults(true)}
                      className="pl-9 h-11 text-base border-red-200 focus:border-red-400"
                      autoFocus
                      data-ocid="emergency_rx.patient_search.input"
                    />
                    {loadingPatients && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {showResults && filteredPatients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                      {filteredPatients.map((p) => {
                        const pAge = getAge(p.dateOfBirth);
                        return (
                          <button
                            key={p.id.toString()}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0"
                            onClick={() => {
                              setSelectedPatient(p);
                              setSearchQuery("");
                              setShowResults(false);
                              setIsNewPatient(false);
                            }}
                            data-ocid="emergency_rx.patient_result.button"
                          >
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm truncate">
                                {p.fullName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.registerNumber && (
                                  <span className="font-mono mr-2">
                                    {p.registerNumber}
                                  </span>
                                )}
                                {pAge != null && `${pAge}y`}
                                {p.gender && ` · ${p.gender}`}
                                {p.phone && ` · ${p.phone}`}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                            >
                              {p.patientType}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showResults &&
                    searchQuery.length >= 2 &&
                    filteredPatients.length === 0 &&
                    !loadingPatients && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 p-4 text-sm text-muted-foreground text-center">
                        No patients found for "{searchQuery}"
                      </div>
                    )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-4 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 shrink-0"
                  onClick={() => setShowNewPatientModal(true)}
                  data-ocid="emergency_rx.new_patient.button"
                >
                  <UserPlus className="w-4 h-4" />
                  New Patient
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Visible to Consultant Doctors and Medical Officers only. All
                prescriptions are tagged EMERGENCY.
              </p>
            </div>
          </div>
        )}

        {/* ── Emergency Bar ── */}
        {selectedPatient && (
          <div
            className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-md sticky top-[9.5rem] z-30"
            data-ocid="emergency_rx.emergency_bar"
          >
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Siren className="w-4 h-4 text-white animate-pulse" />
              </div>
              <Badge className="bg-white/25 text-white border-white/40 font-bold text-xs px-2 py-0.5 rounded-full">
                🚨 EMERGENCY
              </Badge>
              {isNewPatient && (
                <Badge className="bg-blue-500/80 text-white border-blue-300/40 text-xs px-2 py-0.5 rounded-full">
                  NEW PATIENT
                </Badge>
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 opacity-80" />
                <span className="font-bold text-sm">
                  {selectedPatient.fullName}
                </span>
                {age != null && (
                  <span className="text-xs opacity-80">({age}y)</span>
                )}
                {selectedPatient.gender && (
                  <span className="text-xs opacity-70">
                    / {selectedPatient.gender}
                  </span>
                )}
              </div>
              {selectedPatient.registerNumber && (
                <div className="flex items-center gap-1 text-xs opacity-90">
                  <FileText className="w-3 h-3" />
                  <span className="font-mono">
                    {selectedPatient.registerNumber}
                  </span>
                </div>
              )}
              {selectedPatient.allergies?.length > 0 && (
                <div className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3 text-yellow-200" />
                  <span>
                    Allergies:{" "}
                    {selectedPatient.allergies.slice(0, 2).join(", ")}
                    {selectedPatient.allergies.length > 2 ? "..." : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs opacity-80">
                <Calendar className="w-3 h-3" />
                <span>{format(emergencyDateTime, "dd MMM yyyy")}</span>
                <Clock className="w-3 h-3 ml-1" />
                <span>{format(emergencyDateTime, "HH:mm")}</span>
                {/* Editable time override */}
                <input
                  type="time"
                  value={
                    emergencyTimeOverride || format(emergencyDateTime, "HH:mm")
                  }
                  onChange={(e) => setEmergencyTimeOverride(e.target.value)}
                  className="ml-1 bg-white/20 border border-white/40 rounded px-1 text-xs text-white w-20"
                  title="Time of Emergency (editable)"
                  data-ocid="emergency_rx.emergency_time.input"
                />
              </div>
              {finalized && (
                <Badge className="bg-green-500 text-white border-green-400 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Finalized
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {visitId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs bg-white/20 border-white/40 text-white hover:bg-white/30 gap-1"
                  onClick={() => {
                    window.location.href = `/Visit?id=${selectedPatient.id}`;
                  }}
                  data-ocid="emergency_rx.view_visit.button"
                >
                  <Activity className="w-3 h-3" />
                  View Visit
                </Button>
              )}
              {!finalized && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs bg-white/20 border-white/40 text-white hover:bg-white/30 gap-1"
                  onClick={handleClear}
                  data-ocid="emergency_rx.change_patient.button"
                >
                  <X className="w-3 h-3" />
                  Change
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Allergy Alert Banner ── */}
        {allergyAlert && (
          <div
            className="bg-red-50 border-2 border-red-500 rounded-xl px-5 py-3 flex items-start gap-3"
            data-ocid="emergency_rx.allergy_alert.error_state"
          >
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800">
                ⚠️ Allergy Alert: {allergyAlert.drugName}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                This drug matches the patient's known allergy:{" "}
                <strong>{allergyAlert.allergen}</strong>. Clinical override
                required.
              </p>
              {showOverride ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Clinical justification for override..."
                    value={overrideJust}
                    onChange={(e) => setOverrideJust(e.target.value)}
                    className="h-8 text-xs border-red-300 flex-1"
                    data-ocid="emergency_rx.allergy_override.input"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-red-600 text-white"
                    onClick={() => {
                      if (!overrideJust.trim()) {
                        toast.error("Justification required.");
                        return;
                      }
                      appendAuditLog({
                        timestamp: new Date().toISOString(),
                        userRole: currentDoctor?.role ?? "staff",
                        userName: currentDoctor?.name ?? "Unknown",
                        action: "EMERGENCY_ALLERGY_OVERRIDE",
                        target: `patient:${String(selectedPatient?.id ?? "emergency")} drug:${allergyAlert?.drugName ?? ""} allergen:${allergyAlert?.allergen ?? ""} justification:${overrideJust.trim()}`,
                      });
                      setAllergyAlert(null);
                      setShowOverride(false);
                      setOverrideJust("");
                      toast.warning(
                        "Allergy override recorded in audit trail.",
                      );
                    }}
                    data-ocid="emergency_rx.allergy_override.confirm_button"
                  >
                    Override & Keep
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setShowOverride(false)}
                    data-ocid="emergency_rx.allergy_override.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-red-600 text-white"
                    onClick={() => setShowOverride(true)}
                    data-ocid="emergency_rx.allergy_override.open_modal_button"
                  >
                    Override with Justification
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-300 text-red-700"
                    onClick={() => {
                      setAllergyAlert(null);
                      setDrugs((prev) =>
                        prev.filter(
                          (d) =>
                            d.drugName.toLowerCase() !==
                            allergyAlert.drugName.toLowerCase(),
                        ),
                      );
                    }}
                    data-ocid="emergency_rx.allergy_remove.button"
                  >
                    Remove Drug
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Drug Interaction Warnings ── */}
        {interactionWarnings.length > 0 && (
          <div
            className="bg-amber-50 border border-amber-400 rounded-xl px-5 py-3 space-y-1"
            data-ocid="emergency_rx.interaction_warning.error_state"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="font-semibold text-amber-800 text-sm">
                Drug Interaction Warnings
              </p>
            </div>
            {interactionWarnings.map((w) => (
              <p key={w} className="text-xs text-amber-700 pl-6">
                • {w}
              </p>
            ))}
          </div>
        )}

        {/* ── Finalized Banner ── */}
        {finalized && (
          <div
            className="bg-green-50 border border-green-300 rounded-xl px-5 py-4 flex items-center gap-4"
            data-ocid="emergency_rx.success_state"
          >
            <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-green-800">
                Emergency Prescription Finalized
              </p>
              <p className="text-sm text-green-700 mt-0.5">
                Saved for <strong>{selectedPatient?.fullName}</strong> on{" "}
                {format(new Date(), "dd MMM yyyy, HH:mm")}. Visible in patient's
                prescription history with 🚨 EMERGENCY badge.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-green-300 text-green-700"
                onClick={() =>
                  printEmergencyPrescription({
                    patient: selectedPatient!,
                    age,
                    doctor: currentDoctor,
                    emergencyDateTime,
                    cc,
                    hpi,
                    pmh,
                    dh,
                    oe,
                    diagnosis,
                    drugs,
                    adviceText,
                    counselling,
                    followUpDate,
                    validUntil,
                    isNewPatient,
                  })
                }
                data-ocid="emergency_rx.print_final.button"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-green-300 text-green-700"
                onClick={handleClear}
                data-ocid="emergency_rx.new_prescription.button"
              >
                <Plus className="w-3.5 h-3.5" /> New Emergency Rx
              </Button>
            </div>
          </div>
        )}

        {/* ── Mismatch Warning ── */}
        {mismatchWarning && !finalized && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            {mismatchWarning}
          </div>
        )}

        {/* ── 3-Panel Layout ── */}
        {selectedPatient && !finalized && (
          <>
            {/* ── Quick Vitals Strip ── */}
            <div
              className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
              data-ocid="emergency_rx.vitals_strip.panel"
            >
              <button
                type="button"
                onClick={() => setShowVitalsStrip((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-teal-50 hover:bg-teal-100 transition-colors border-b border-teal-100"
                data-ocid="emergency_rx.vitals_strip.toggle"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-teal-800 text-sm">
                    Quick Vitals — Emergency Entry
                  </span>
                  {(vBpSys || vPulse || vSpo2) && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                      Recorded
                    </span>
                  )}
                </div>
                <span className="text-xs text-teal-600">
                  {showVitalsStrip ? "Collapse ▲" : "Expand ▼"}
                </span>
              </button>
              {showVitalsStrip && (
                <div className="px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {[
                      {
                        label: "BP Sys (mmHg)",
                        val: vBpSys,
                        set: setVBpSys,
                        placeholder: "120",
                        ocid: "bp_sys",
                      },
                      {
                        label: "BP Dia (mmHg)",
                        val: vBpDia,
                        set: setVBpDia,
                        placeholder: "80",
                        ocid: "bp_dia",
                      },
                      {
                        label: "Pulse (bpm)",
                        val: vPulse,
                        set: setVPulse,
                        placeholder: "72",
                        ocid: "pulse",
                      },
                      {
                        label: "SpO₂ (%)",
                        val: vSpo2,
                        set: setVSpo2,
                        placeholder: "98",
                        ocid: "spo2",
                      },
                      {
                        label: "RBS (mg/dL)",
                        val: vRbs,
                        set: setVRbs,
                        placeholder: "5.5",
                        ocid: "rbs",
                      },
                      {
                        label: "Temp (°C)",
                        val: vTemp,
                        set: setVTemp,
                        placeholder: "37.0",
                        ocid: "temp",
                      },
                      {
                        label: "GCS (3-15)",
                        val: vGcs,
                        set: setVGcs,
                        placeholder: "15",
                        ocid: "gcs",
                      },
                      {
                        label: "Weight (kg)",
                        val: vWeight,
                        set: setVWeight,
                        placeholder: "70",
                        ocid: "weight",
                      },
                    ].map(({ label, val, set, placeholder, ocid }) => (
                      <div key={ocid}>
                        <label
                          htmlFor={`vital-${ocid}`}
                          className="text-[10px] font-medium text-muted-foreground block mb-0.5"
                        >
                          {label}
                        </label>
                        <input
                          id={`vital-${ocid}`}
                          type="number"
                          value={val}
                          onChange={(e) => set(e.target.value)}
                          placeholder={placeholder}
                          className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background h-8"
                          data-ocid={`emergency_rx.vitals.${ocid}.input`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    These vitals attach to the emergency visit record when you
                    save the prescription.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* ── LEFT: Clinical Summary ── */}
              <div className="xl:col-span-3 space-y-3">
                <div
                  className="bg-card border border-red-200 rounded-xl overflow-hidden shadow-sm"
                  data-ocid="emergency_rx.clinical_summary.panel"
                >
                  <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <h3 className="font-semibold text-red-800 text-sm">
                      Clinical Summary
                    </h3>
                  </div>
                  <ScrollArea className="h-[calc(100vh-340px)] min-h-[400px]">
                    <div className="p-4 space-y-3">
                      {/* Patient Info Card */}
                      <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs space-y-0.5">
                        <p className="font-semibold text-foreground">
                          {selectedPatient.fullName}
                        </p>
                        {age != null && (
                          <p className="text-muted-foreground">
                            Age: {age}y · {selectedPatient.gender}
                          </p>
                        )}
                        {selectedPatient.registerNumber && (
                          <p className="text-muted-foreground font-mono">
                            {selectedPatient.registerNumber}
                          </p>
                        )}
                        {selectedPatient.phone && (
                          <p className="text-muted-foreground">
                            {selectedPatient.phone}
                          </p>
                        )}
                        {selectedPatient.bloodGroup && (
                          <p className="text-red-700 font-semibold">
                            Blood: {selectedPatient.bloodGroup}
                          </p>
                        )}
                        {selectedPatient.allergies?.length > 0 && (
                          <div className="bg-red-50 border border-red-100 rounded px-2 py-1 mt-1">
                            <p className="text-red-700 font-medium">
                              ⚠️ Allergies:{" "}
                              {selectedPatient.allergies.join(", ")}
                            </p>
                          </div>
                        )}
                        {isNewPatient && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs mt-1">
                            NEW PATIENT — Emergency Registration
                          </Badge>
                        )}
                      </div>

                      <Separator />

                      {/* C/C */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-red-700">
                          C/C — Chief Complaint *
                        </Label>
                        <Textarea
                          placeholder="e.g. Severe chest pain, 2h duration..."
                          value={cc}
                          onChange={(e) => setCc(e.target.value)}
                          className="text-xs min-h-[60px] border-red-200 focus:border-red-400 resize-none"
                          data-ocid="emergency_rx.chief_complaint.textarea"
                        />
                      </div>

                      {/* HPI */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          H/O — History of Present Illness
                        </Label>
                        <Textarea
                          placeholder="Onset, character, radiation, alleviating/aggravating factors..."
                          value={hpi}
                          onChange={(e) => setHpi(e.target.value)}
                          className="text-xs min-h-[60px] resize-none"
                          data-ocid="emergency_rx.hpi.textarea"
                        />
                      </div>

                      {/* PMH */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          P/M/H — Past Medical History
                        </Label>
                        <Textarea
                          placeholder="HTN, DM, IHD, CKD, previous surgeries..."
                          value={pmh}
                          onChange={(e) => setPmh(e.target.value)}
                          className="text-xs min-h-[50px] resize-none"
                          data-ocid="emergency_rx.pmh.textarea"
                        />
                      </div>

                      {/* Drug History */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          D/H — Drug History
                        </Label>
                        <Textarea
                          placeholder="Current medications, regular drugs..."
                          value={dh}
                          onChange={(e) => setDh(e.target.value)}
                          className="text-xs min-h-[50px] resize-none"
                          data-ocid="emergency_rx.drug_history.textarea"
                        />
                      </div>

                      {/* O/E */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          O/E — On Examination
                        </Label>
                        <Textarea
                          placeholder="BP, Pulse, Temp, SpO₂, Heart/Lung, Abdomen..."
                          value={oe}
                          onChange={(e) => setOe(e.target.value)}
                          className="text-xs min-h-[60px] resize-none"
                          data-ocid="emergency_rx.oe.textarea"
                        />
                      </div>

                      {/* Diagnosis */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-orange-700">
                          Diagnosis *
                        </Label>
                        <Textarea
                          placeholder="e.g. Acute STEMI, Anaphylactic shock, Sepsis..."
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          className="text-xs min-h-[60px] border-orange-200 focus:border-orange-400 resize-none"
                          data-ocid="emergency_rx.diagnosis.textarea"
                        />
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800 mb-0.5">
                          Emergency Protocol
                        </p>
                        <p className="text-xs text-amber-700">
                          Tagged EMERGENCY · Auto-creates visit · Logged in
                          audit trail · Appears in patient history with 🚨
                          badge.
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* ── CENTER: Rx Drug Table ── */}
              <div className="xl:col-span-6 space-y-3">
                <div
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                  data-ocid="emergency_rx.rx_table.panel"
                >
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-black text-xl leading-none">
                        ℞
                      </span>
                      <h3 className="font-semibold text-red-800 text-sm">
                        Emergency Medications
                      </h3>
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                        {drugs.filter((d) => d.drugName.trim()).length} drug
                        {drugs.filter((d) => d.drugName.trim()).length !== 1
                          ? "s"
                          : ""}
                      </Badge>
                    </div>
                    {/* Emergency Template Dropdown */}
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => setShowTemplateDropdown((v) => !v)}
                        data-ocid="emergency_rx.template.button"
                      >
                        <Zap className="w-3 h-3" />
                        Load Template
                      </Button>
                      {showTemplateDropdown && (
                        <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl w-52 py-1">
                          <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1 uppercase tracking-wide">
                            Emergency Protocols
                          </p>
                          {Object.entries(EMERGENCY_TEMPLATES).map(
                            ([key, tpl]) => (
                              <button
                                key={key}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-red-50 hover:text-red-800 transition-colors flex items-center gap-2"
                                onClick={() => applyEmergencyTemplate(key)}
                                data-ocid={`emergency_rx.template.${key}`}
                              >
                                <Siren className="w-3 h-3 text-red-400 shrink-0" />
                                {tpl.label}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Template warning */}
                  {templateWarningShown && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        <strong>Review doses before saving</strong> — these are
                        suggested protocols, not individual prescriptions.
                        Adjust for patient weight, age, and clinical context.
                      </span>
                      <button
                        type="button"
                        onClick={() => setTemplateWarningShown(false)}
                        className="ml-auto text-amber-400 hover:text-amber-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <ScrollArea className="max-h-[420px]">
                    <div className="p-3 space-y-2">
                      {drugs.map((row, idx) => (
                        <div
                          key={row.id}
                          className={`border rounded-xl p-3 space-y-2 transition-colors ${editingId === row.id ? "border-red-400 bg-red-50/40" : "border-border bg-muted/20 hover:bg-muted/40"}`}
                          data-ocid={`emergency_rx.drug_row.item.${idx + 1}`}
                        >
                          {/* Row header */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-red-600 w-5 shrink-0">
                              {idx + 1}.
                            </span>
                            {row.isControlled && (
                              <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                                CONTROLLED
                              </Badge>
                            )}
                            {row.isPrn && (
                              <Badge
                                variant="outline"
                                className="text-xs text-blue-700 border-blue-300"
                              >
                                PRN
                              </Badge>
                            )}
                            <div className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">
                              {row.drugName ? (
                                `${row.drugForm ? `${row.drugForm} ` : ""}${row.drugName}${row.brandName ? ` (${row.brandName})` : ""}`
                              ) : (
                                <span className="text-muted-foreground font-normal italic">
                                  New drug entry…
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => loadDrugForEdit(row)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                              aria-label="Edit drug"
                              data-ocid={`emergency_rx.edit_drug.edit_button.${idx + 1}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDrug(row.id)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                              aria-label="Remove drug"
                              data-ocid={`emergency_rx.remove_drug.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Row details */}
                          {row.drugName && (
                            <div className="pl-7 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {row.dose && (
                                <span className="bg-background border border-border rounded px-1.5 py-0.5">
                                  {row.dose}
                                </span>
                              )}
                              {row.route && (
                                <span className="bg-background border border-border rounded px-1.5 py-0.5">
                                  {row.route}
                                  {row.routeBn ? ` / ${row.routeBn}` : ""}
                                </span>
                              )}
                              {row.isPrn ? (
                                <span className="bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5">
                                  PRN
                                  {row.prnCondition
                                    ? `: ${row.prnCondition}`
                                    : ""}
                                </span>
                              ) : (
                                <>
                                  {row.frequency && (
                                    <span className="bg-background border border-border rounded px-1.5 py-0.5">
                                      {row.frequency}
                                      {row.frequencyBn
                                        ? ` / ${row.frequencyBn}`
                                        : ""}
                                    </span>
                                  )}
                                  {row.duration && (
                                    <span className="bg-background border border-border rounded px-1.5 py-0.5">
                                      {row.duration}
                                      {row.durationBn
                                        ? ` / ${row.durationBn}`
                                        : ""}
                                    </span>
                                  )}
                                </>
                              )}
                              {row.instructions && (
                                <span className="italic">
                                  {row.instructions}
                                  {row.instructionBn
                                    ? ` / ${row.instructionBn}`
                                    : ""}
                                </span>
                              )}
                              {row.specialInstruction && (
                                <span className="text-orange-700">
                                  {row.specialInstruction}
                                </span>
                              )}
                              {row.dispensedAs && (
                                <Badge variant="outline" className="text-xs">
                                  Dispensed: {row.dispensedAs}
                                  {row.substitutedBrand
                                    ? ` (${row.substitutedBrand})`
                                    : ""}
                                </Badge>
                              )}
                              {row.titrationEnabled && (
                                <span className="text-purple-700">
                                  Titration: {row.titrationStage1Dose} ×{" "}
                                  {row.titrationStage1Duration} →{" "}
                                  {row.titrationStage2Dose} ×{" "}
                                  {row.titrationStage2Duration}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* ── Drug Entry Form ── */}
                  <div
                    id="emrx-drug-form"
                    className="border-t border-border bg-muted/20 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-foreground">
                        {editingId ? "Edit Drug" : "Add Drug"}
                      </p>
                      {editingId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={resetDrugForm}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>

                    {/* Row 1: Form + Name */}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Form
                        </Label>
                        <select
                          className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background"
                          value={df}
                          onChange={(e) => setDf(e.target.value)}
                          data-ocid="emergency_rx.drug_form.select"
                        >
                          {DRUG_FORMS.map((f) => (
                            <option key={f || "none"} value={f}>
                              {f || "Other"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">
                          Drug Name / Generic *
                        </Label>
                        <Input
                          placeholder="e.g. Aspirin, Adrenaline..."
                          value={dName}
                          onChange={(e) => setDName(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.drug_name.input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Brand (opt.)
                        </Label>
                        <Input
                          placeholder="Brand"
                          value={dBrand}
                          onChange={(e) => setDBrand(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.brand_name.input"
                        />
                      </div>
                    </div>

                    {/* Row 2: Dose + Route */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Dose
                        </Label>
                        <Input
                          placeholder="e.g. 500mg"
                          value={dDose}
                          onChange={(e) => setDDose(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.dose.input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Route
                        </Label>
                        <select
                          className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background"
                          value={dRoute}
                          onChange={(e) => {
                            setDRoute(e.target.value);
                            if (
                              e.target.value !== "IV" &&
                              e.target.value !== "IM"
                            )
                              setDIvImDoseFormat("");
                          }}
                          data-ocid="emergency_rx.route.select"
                        >
                          {ROUTES_BN.map((r) => (
                            <option key={r.en} value={r.en}>
                              {r.en} / {r.bn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Frequency (EN)
                        </Label>
                        <select
                          className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background"
                          value={dFreq}
                          onChange={(e) => {
                            setDFreq(e.target.value);
                            const found = FREQUENCY_PRESETS.find(
                              (f) => f.en === e.target.value,
                            );
                            if (found) setDFreqBn(found.bn);
                          }}
                          data-ocid="emergency_rx.frequency.select"
                        >
                          <option value="">Select…</option>
                          {FREQUENCY_PRESETS.map((f) => (
                            <option key={f.en} value={f.en}>
                              {f.en}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* IV/IM Dose Format (only when IV or IM route selected) */}
                    {(dRoute === "IV" || dRoute === "IM") && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-800">
                            IV/IM Dose Format
                          </span>
                          <select
                            className="text-xs border border-blue-300 rounded-md px-2 py-1 bg-white"
                            value={dIvImDoseFormat}
                            onChange={(e) =>
                              setDIvImDoseFormat(
                                e.target.value as
                                  | "single"
                                  | "loading-maintenance"
                                  | "infusion"
                                  | "",
                              )
                            }
                            data-ocid="emergency_rx.ivim_dose_format.select"
                          >
                            <option value="">Standard dose</option>
                            <option value="single">Single Dose</option>
                            <option value="loading-maintenance">
                              Loading + Maintenance
                            </option>
                            <option value="infusion">Infusion Rate</option>
                          </select>
                        </div>
                        {dIvImDoseFormat === "loading-maintenance" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-blue-700 font-medium">
                                Loading Dose
                              </span>
                              <Input
                                placeholder="e.g. 1000mg IV over 20min"
                                value={dLoadingDose}
                                onChange={(e) =>
                                  setDLoadingDose(e.target.value)
                                }
                                className="h-7 text-xs mt-0.5"
                                data-ocid="emergency_rx.loading_dose.input"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-blue-700 font-medium">
                                Maintenance Dose
                              </span>
                              <Input
                                placeholder="e.g. 250mg/6hrs"
                                value={dMaintenanceDose}
                                onChange={(e) =>
                                  setDMaintenanceDose(e.target.value)
                                }
                                className="h-7 text-xs mt-0.5"
                                data-ocid="emergency_rx.maintenance_dose.input"
                              />
                            </div>
                          </div>
                        )}
                        {dIvImDoseFormat === "infusion" && (
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <span className="text-[10px] text-blue-700 font-medium">
                                Infusion Rate
                              </span>
                              <Input
                                placeholder="e.g. 5"
                                value={dInfusionRate}
                                onChange={(e) =>
                                  setDInfusionRate(e.target.value)
                                }
                                className="h-7 text-xs mt-0.5"
                                data-ocid="emergency_rx.infusion_rate.input"
                              />
                            </div>
                            <select
                              className="text-xs border border-blue-300 rounded-md px-2 py-1.5 bg-white"
                              value={dInfusionUnit}
                              onChange={(e) =>
                                setDInfusionUnit(
                                  e.target.value as "mcg/kg/min" | "mg/hr",
                                )
                              }
                              data-ocid="emergency_rx.infusion_unit.select"
                            >
                              <option value="mg/hr">mg/hr</option>
                              <option value="mcg/kg/min">mcg/kg/min</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 3: Frequency BN + Duration */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Frequency (BN)
                        </Label>
                        <Input
                          placeholder="বাংলা..."
                          value={dFreqBn}
                          onChange={(e) => setDFreqBn(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.frequency_bn.input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Duration (EN)
                        </Label>
                        <select
                          className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background"
                          value={dDur}
                          onChange={(e) => {
                            setDDur(e.target.value);
                            const found = DURATION_PRESETS.find(
                              (d) => d.en === e.target.value,
                            );
                            if (found) setDDurBn(found.bn);
                          }}
                          data-ocid="emergency_rx.duration.select"
                        >
                          <option value="">Select…</option>
                          {DURATION_PRESETS.map((d) => (
                            <option key={d.en} value={d.en}>
                              {d.en}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Duration (BN)
                        </Label>
                        <Input
                          placeholder="বাংলা..."
                          value={dDurBn}
                          onChange={(e) => setDDurBn(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.duration_bn.input"
                        />
                      </div>
                    </div>

                    {/* Row 4: Instructions */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Instructions (EN)
                        </Label>
                        <div className="flex gap-1">
                          <Input
                            placeholder="After meal..."
                            value={dInstr}
                            onChange={(e) => setDInstr(e.target.value)}
                            className="h-8 text-xs flex-1"
                            data-ocid="emergency_rx.instructions.input"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {INSTRUCTION_PRESETS.map((p) => (
                            <button
                              key={p.en}
                              type="button"
                              className="text-[9px] px-1.5 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                              onClick={() => {
                                setDInstr(p.en);
                                setDInstrBn(p.bn);
                              }}
                            >
                              {p.en}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Instructions (BN)
                        </Label>
                        <Input
                          placeholder="খাবার পরে..."
                          value={dInstrBn}
                          onChange={(e) => setDInstrBn(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.instructions_bn.input"
                        />
                      </div>
                    </div>

                    {/* Row 5: Special instruction */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Special Instruction (EN)
                        </Label>
                        <Input
                          placeholder="e.g. Monitor BP after dose..."
                          value={dSpecial}
                          onChange={(e) => setDSpecial(e.target.value)}
                          className="h-8 text-xs"
                          data-ocid="emergency_rx.special_instruction.input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Special Instruction (BN)
                        </Label>
                        <Input
                          placeholder="বিশেষ নির্দেশ..."
                          value={dSpecialBn}
                          onChange={(e) => setDSpecialBn(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Flags row */}
                    <div className="flex flex-wrap gap-3 pt-1">
                      {/* PRN toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={dPrn}
                          onChange={(e) => setDPrn(e.target.checked)}
                          className="rounded"
                          data-ocid="emergency_rx.prn.toggle"
                        />
                        <span className="text-xs font-medium text-blue-700">
                          PRN (as-needed)
                        </span>
                      </label>
                      {dPrn && (
                        <Input
                          placeholder="Condition (e.g. if fever > 38°C)"
                          value={dPrnCond}
                          onChange={(e) => setDPrnCond(e.target.value)}
                          className="h-7 text-xs w-52"
                          data-ocid="emergency_rx.prn_condition.input"
                        />
                      )}

                      {/* Controlled */}
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={dControlled}
                          onChange={(e) => setDControlled(e.target.checked)}
                          className="rounded"
                          data-ocid="emergency_rx.controlled.toggle"
                        />
                        <span className="text-xs font-medium text-red-700">
                          Controlled Drug
                        </span>
                      </label>
                      {dControlled && (
                        <Input
                          placeholder="Legal justification (required)..."
                          value={dControlledJust}
                          onChange={(e) => setDControlledJust(e.target.value)}
                          className="h-7 text-xs border-red-300 w-52"
                          data-ocid="emergency_rx.controlled_justification.input"
                        />
                      )}

                      {/* Titration */}
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={dTitration}
                          onChange={(e) => setDTitration(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-xs font-medium text-purple-700">
                          Titration
                        </span>
                      </label>
                    </div>

                    {/* Titration fields */}
                    {dTitration && (
                      <div className="grid grid-cols-4 gap-2 bg-purple-50 border border-purple-200 rounded-lg p-2">
                        <div>
                          <Label className="text-xs text-purple-700">
                            Stage 1 Dose
                          </Label>
                          <Input
                            placeholder="500mg"
                            value={dTit1Dose}
                            onChange={(e) => setDTit1Dose(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-purple-700">
                            Stage 1 Duration
                          </Label>
                          <Input
                            placeholder="2 weeks"
                            value={dTit1Dur}
                            onChange={(e) => setDTit1Dur(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-purple-700">
                            Stage 2 Dose
                          </Label>
                          <Input
                            placeholder="1000mg"
                            value={dTit2Dose}
                            onChange={(e) => setDTit2Dose(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-purple-700">
                            Stage 2 Duration
                          </Label>
                          <Input
                            placeholder="Ongoing"
                            value={dTit2Dur}
                            onChange={(e) => setDTit2Dur(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Dispensed As */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Dispensed As (opt.)
                        </Label>
                        <select
                          className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background"
                          value={dDispensedAs}
                          onChange={(e) =>
                            setDDispensedAs(
                              e.target.value as
                                | ""
                                | "brand"
                                | "generic"
                                | "substituted",
                            )
                          }
                          data-ocid="emergency_rx.dispensed_as.select"
                        >
                          <option value="">Not recorded</option>
                          <option value="brand">Brand</option>
                          <option value="generic">Generic</option>
                          <option value="substituted">Substituted</option>
                        </select>
                      </div>
                      {dDispensedAs === "substituted" && (
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">
                            Substituted Brand Name
                          </Label>
                          <Input
                            placeholder="Brand name used..."
                            value={dSubBrand}
                            onChange={(e) => setDSubBrand(e.target.value)}
                            className="h-8 text-xs"
                            data-ocid="emergency_rx.substituted_brand.input"
                          />
                        </div>
                      )}
                    </div>

                    {/* Commit button */}
                    <Button
                      className="w-full h-9 gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold"
                      onClick={commitDrug}
                      data-ocid="emergency_rx.add_drug.button"
                    >
                      <Plus className="w-4 h-4" />
                      {editingId ? "Update Drug" : "Add Drug to Prescription"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Advice + Counselling + Bottom Fields ── */}
              <div className="xl:col-span-3 space-y-3">
                {/* Advice */}
                <div
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                  data-ocid="emergency_rx.advice.panel"
                >
                  <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5">
                    <h3 className="font-semibold text-orange-800 text-sm">
                      Advice & Instructions
                    </h3>
                  </div>
                  <div className="p-3 space-y-2">
                    <Textarea
                      placeholder="Enter advice (one per line)..."
                      value={adviceText}
                      onChange={(e) => setAdviceText(e.target.value)}
                      className="text-xs min-h-[100px] resize-none"
                      data-ocid="emergency_rx.advice.textarea"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ADVICE_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl}
                          type="button"
                          className="text-[9px] px-2 py-1 rounded-full border border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors leading-none"
                          onClick={() => {
                            if (!adviceText.includes(tmpl)) {
                              setAdviceText((prev) =>
                                prev ? `${prev}\n${tmpl}` : tmpl,
                              );
                            }
                          }}
                          data-ocid="emergency_rx.advice_template.button"
                        >
                          {tmpl.length > 28 ? `${tmpl.slice(0, 28)}…` : tmpl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Patient Counselling */}
                <div
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                  data-ocid="emergency_rx.counselling.panel"
                >
                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
                    <h3 className="font-semibold text-blue-800 text-sm">
                      Patient Counselling
                    </h3>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Printed on prescription · Visible in patient portal
                    </p>
                  </div>
                  <div className="p-3">
                    <Textarea
                      placeholder="e.g. Advised low-salt diet, warned about dizziness with first dose..."
                      value={counselling}
                      onChange={(e) => setCounselling(e.target.value)}
                      className="text-xs min-h-[70px] resize-none"
                      data-ocid="emergency_rx.counselling.textarea"
                    />
                  </div>
                </div>

                {/* Follow-up + Valid Until */}
                <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div>
                    <Label className="text-xs font-medium text-foreground">
                      Follow-up Date
                    </Label>
                    <Input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="h-8 text-xs mt-1"
                      data-ocid="emergency_rx.followup_date.input"
                    />
                    {followUpDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(followUpDate), "dd MMM yyyy")} —{" "}
                        {Math.round(
                          (new Date(followUpDate).getTime() - Date.now()) /
                            86400000,
                        )}{" "}
                        days
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-foreground">
                      Valid Until
                    </Label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="h-8 text-xs mt-1"
                      data-ocid="emergency_rx.valid_until.input"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Shown prominently on printed prescription.
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  className="w-full h-11 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold shadow-md gap-2"
                  onClick={handleSave}
                  disabled={saving}
                  data-ocid="emergency_rx.finalize.submit_button"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  {saving ? "Saving..." : "Save & Finalize Emergency Rx"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Tagged EMERGENCY · Auto-creates visit record · Logged in audit
                  trail
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── Post-finalize read-only summary ── */}
        {finalized && selectedPatient && (
          <div className="bg-card border border-green-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-800">
                  Emergency Prescription Summary
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                  🚨 EMERGENCY
                </Badge>
                {isNewPatient && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                    NEW PATIENT
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Patient
                </p>
                <p className="font-semibold">{selectedPatient.fullName}</p>
                <p className="text-muted-foreground text-xs">
                  {selectedPatient.registerNumber} ·{" "}
                  {age != null ? `${age}y` : ""} · {selectedPatient.gender}
                </p>
              </div>
              {diagnosis && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    Diagnosis
                  </p>
                  <p className="font-semibold">{diagnosis}</p>
                </div>
              )}
              {cc && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    Chief Complaint
                  </p>
                  <p>{cc}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Finalized
                </p>
                <p>
                  {format(new Date(), "dd MMM yyyy, HH:mm")} by{" "}
                  {currentDoctor?.name ?? "Doctor"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">
                Medications ({drugs.filter((d) => d.drugName.trim()).length})
              </p>
              <div className="space-y-1.5">
                {drugs
                  .filter((d) => d.drugName.trim())
                  .map((r, i) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 text-sm"
                    >
                      <span className="text-xs font-bold text-red-600 w-5">
                        {i + 1}.
                      </span>
                      <span className="font-medium">
                        {r.drugForm} {r.drugName}
                        {r.brandName ? ` (${r.brandName})` : ""}
                      </span>
                      {r.isControlled && (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          CONTROLLED
                        </Badge>
                      )}
                      {r.isPrn && (
                        <Badge variant="outline" className="text-xs">
                          PRN
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs ml-auto">
                        {r.dose} ·{" "}
                        {r.isPrn
                          ? `PRN${r.prnCondition ? `: ${r.prnCondition}` : ""}`
                          : `${r.frequency} × ${r.duration}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {validUntil && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Calendar className="w-4 h-4" />
                <span>
                  Valid until:{" "}
                  <strong>{format(new Date(validUntil), "dd MMM yyyy")}</strong>
                </span>
                {followUpDate && (
                  <span className="ml-4">
                    Follow-up:{" "}
                    <strong>
                      {format(new Date(followUpDate), "dd MMM yyyy")}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Next Action Panel (post-finalize) ── */}
        {finalized && selectedPatient && !nextActionCompleted && (
          <div
            className="bg-card border border-blue-200 rounded-xl p-4 shadow-sm space-y-3"
            data-ocid="emergency_rx.next_action.panel"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">
                  Next Action
                </p>
                <p className="text-xs text-blue-600">
                  What happens to this patient after the emergency prescription?
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  key: "admit",
                  label: "🏥 Admit",
                  color: "border-purple-400 text-purple-700 hover:bg-purple-50",
                },
                {
                  key: "refer",
                  label: "↗️ Refer",
                  color: "border-orange-400 text-orange-700 hover:bg-orange-50",
                },
                {
                  key: "discharge",
                  label: "🏠 Discharge",
                  color: "border-green-400 text-green-700 hover:bg-green-50",
                },
                {
                  key: "observe",
                  label: "👁 Observe",
                  color: "border-blue-400 text-blue-700 hover:bg-blue-50",
                },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNextAction(key as typeof nextAction)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${nextAction === key ? "border-primary bg-primary/10 text-primary" : color}`}
                  data-ocid={`emergency_rx.next_action.${key}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {nextAction === "admit" && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-800">
                <p className="font-semibold mb-1">Admit Patient</p>
                <p className="text-xs">
                  Assign a bed via the Bed Management section. Emergency
                  prescription drugs will auto-populate the inpatient medication
                  chart.
                </p>
                <Button
                  size="sm"
                  className="mt-2 bg-purple-600 hover:bg-purple-700 text-white gap-1.5 text-xs h-7"
                  onClick={() => {
                    window.location.href = "/BedManagement";
                  }}
                  data-ocid="emergency_rx.next_action.admit_button"
                >
                  Open Bed Management →
                </Button>
              </div>
            )}

            {nextAction === "refer" && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-3 space-y-2">
                <p className="text-sm font-semibold text-orange-800">
                  Referral Details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-orange-700 font-medium">
                      Specialist Name
                    </span>
                    <Input
                      placeholder="Dr. / Specialist"
                      value={referSpecialist}
                      onChange={(e) => setReferSpecialist(e.target.value)}
                      className="h-8 text-xs mt-0.5"
                      data-ocid="emergency_rx.refer.specialist.input"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-orange-700 font-medium">
                      Hospital / Clinic
                    </span>
                    <Input
                      placeholder="Hospital name"
                      value={referHospital}
                      onChange={(e) => setReferHospital(e.target.value)}
                      className="h-8 text-xs mt-0.5"
                      data-ocid="emergency_rx.refer.hospital.input"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs text-orange-700 font-medium">
                    Reason for Referral
                  </span>
                  <Textarea
                    placeholder="Clinical reason..."
                    value={referReason}
                    onChange={(e) => setReferReason(e.target.value)}
                    className="text-xs min-h-[60px] resize-none mt-0.5"
                    data-ocid="emergency_rx.refer.reason.textarea"
                  />
                </div>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs h-7"
                  onClick={() => {
                    setNextActionCompleted(true);
                    toast.success("Referral recorded");
                  }}
                  data-ocid="emergency_rx.refer.save_button"
                >
                  Save Referral
                </Button>
              </div>
            )}

            {nextAction === "discharge" && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-3 space-y-2">
                <p className="text-sm font-semibold text-green-800">
                  Discharge Instructions
                </p>
                <Textarea
                  placeholder="Discharge instructions, follow-up advice, safety netting..."
                  value={dischargeInstructions}
                  onChange={(e) => setDischargeInstructions(e.target.value)}
                  className="text-xs min-h-[80px] resize-none"
                  data-ocid="emergency_rx.discharge.instructions.textarea"
                />
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs h-7"
                  onClick={() => {
                    setNextActionCompleted(true);
                    toast.success("Patient discharged — visit marked closed");
                  }}
                  data-ocid="emergency_rx.discharge.save_button"
                >
                  Mark Discharged
                </Button>
              </div>
            )}

            {nextAction === "observe" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-800">
                    <strong>Patient under observation</strong> — review due in
                    24 hours.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs h-7"
                  onClick={() => {
                    setNextActionCompleted(true);
                    toast.success(
                      "Observation noted — 24h review reminder set",
                    );
                  }}
                  data-ocid="emergency_rx.observe.save_button"
                >
                  Confirm Observation
                </Button>
              </div>
            )}
          </div>
        )}

        {nextActionCompleted && finalized && (
          <div
            className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-800"
            data-ocid="emergency_rx.next_action.success_state"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>Next action recorded — emergency encounter is complete.</span>
          </div>
        )}
      </div>

      {/* ── New Patient Modal ── */}
      <Dialog open={showNewPatientModal} onOpenChange={setShowNewPatientModal}>
        <DialogContent
          className="max-w-lg"
          data-ocid="emergency_rx.new_patient.dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-red-600" />
              Quick Patient Registration
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs ml-2">
                Emergency
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Minimal fields required. A register number is auto-generated. Full
              patient profile can be completed later.
            </p>

            {npDupWarning && (
              <div
                className="bg-amber-50 border border-amber-400 rounded-lg px-3 py-2 text-xs text-amber-800"
                data-ocid="emergency_rx.new_patient.error_state"
              >
                <strong>Duplicate Detected:</strong> {npDupWarning}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  placeholder="Patient full name"
                  value={npForm.fullName}
                  onChange={(e) =>
                    setNpForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                  className="h-9 text-sm mt-1"
                  autoFocus
                  data-ocid="emergency_rx.new_patient.fullname.input"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Age (years) *</Label>
                <Input
                  placeholder="e.g. 45"
                  value={npForm.ageStr}
                  onChange={(e) =>
                    setNpForm((p) => ({
                      ...p,
                      ageStr: e.target.value,
                      dobStr: "",
                    }))
                  }
                  className="h-9 text-sm mt-1"
                  data-ocid="emergency_rx.new_patient.age.input"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">
                  OR Date of Birth
                </Label>
                <Input
                  type="date"
                  value={npForm.dobStr}
                  onChange={(e) =>
                    setNpForm((p) => ({
                      ...p,
                      dobStr: e.target.value,
                      ageStr: "",
                    }))
                  }
                  className="h-9 text-sm mt-1"
                  data-ocid="emergency_rx.new_patient.dob.input"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Sex / Gender *</Label>
                <select
                  className="w-full text-sm border border-input rounded-md px-2 py-2 mt-1 bg-background"
                  value={npForm.gender}
                  onChange={(e) =>
                    setNpForm((p) => ({ ...p, gender: e.target.value }))
                  }
                  data-ocid="emergency_rx.new_patient.gender.select"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Phone Number *</Label>
                <Input
                  placeholder="+880..."
                  value={npForm.phone}
                  onChange={(e) =>
                    setNpForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  onBlur={checkDuplicate}
                  className="h-9 text-sm mt-1"
                  data-ocid="emergency_rx.new_patient.phone.input"
                />
              </div>
              <div>
                <Label className="text-xs">Blood Group (opt.)</Label>
                <select
                  className="w-full text-sm border border-input rounded-md px-2 py-2 mt-1 bg-background"
                  value={npForm.bloodGroup}
                  onChange={(e) =>
                    setNpForm((p) => ({ ...p, bloodGroup: e.target.value }))
                  }
                  data-ocid="emergency_rx.new_patient.blood_group.select"
                >
                  <option value="">Unknown</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">
                  Known Allergies (comma-separated, opt.)
                </Label>
                <Input
                  placeholder="e.g. Penicillin, Aspirin"
                  value={npForm.allergies}
                  onChange={(e) =>
                    setNpForm((p) => ({ ...p, allergies: e.target.value }))
                  }
                  className="h-9 text-sm mt-1"
                  data-ocid="emergency_rx.new_patient.allergies.input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Important for clinical intelligence — allergy alerts will fire
                  immediately when prescribing.
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">
                  Chronic Conditions (comma-separated, opt.)
                </Label>
                <Input
                  placeholder="e.g. Hypertension, Diabetes"
                  value={npForm.chronicConditions}
                  onChange={(e) =>
                    setNpForm((p) => ({
                      ...p,
                      chronicConditions: e.target.value,
                    }))
                  }
                  className="h-9 text-sm mt-1"
                  data-ocid="emergency_rx.new_patient.chronic.input"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
                onClick={handleNewPatientSave}
                disabled={npSaving}
                data-ocid="emergency_rx.new_patient.submit_button"
              >
                {npSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {npSaving ? "Registering..." : "Register & Open Prescription"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewPatientModal(false);
                  setNpDupWarning(null);
                }}
                data-ocid="emergency_rx.new_patient.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
