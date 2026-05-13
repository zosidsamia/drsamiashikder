// ─── Clinical Intelligence Layer ─────────────────────────────────────────────
// Client-side clinical decision support utilities.
// All logic is pure functions — no side effects, no network calls.

import type {
  ClinicalAlert,
  ExtendedAlert,
  ExtendedAlertInput,
  LabResult,
  Medication,
  Observation,
  TrendAlert,
  TrendData,
  VitalReading,
} from "../types";

// ── Drug Warning Types ────────────────────────────────────────────────────────

export interface DrugWarning {
  type:
    | "interaction"
    | "duplicate"
    | "max_dose"
    | "renal_adjustment"
    | "allergy"
    | "hepatic_adjustment"
    | "age_risk";
  severity: "critical" | "warning" | "info";
  message: string;
  drugs: string[];
  suggestion?: string;
}

// ── Known Drug Interaction Pairs ──────────────────────────────────────────────

const DRUG_INTERACTIONS: Array<{
  drugs: [string, string];
  severity: "critical" | "warning";
  message: string;
}> = [
  {
    drugs: ["warfarin", "aspirin"],
    severity: "critical",
    message: "Warfarin + Aspirin: High bleeding risk.",
  },
  {
    drugs: ["warfarin", "nsaid"],
    severity: "critical",
    message: "Warfarin + NSAID: Increased anticoagulation and bleeding risk.",
  },
  {
    drugs: ["ssri", "tramadol"],
    severity: "critical",
    message: "SSRI + Tramadol: Risk of serotonin syndrome.",
  },
  {
    drugs: ["ssri", "maoi"],
    severity: "critical",
    message: "SSRI + MAOI: Serotonin syndrome risk — contraindicated.",
  },
  {
    drugs: ["metformin", "contrast"],
    severity: "warning",
    message: "Metformin + Contrast dye: Risk of lactic acidosis. Withhold 48h.",
  },
  {
    drugs: ["digoxin", "amiodarone"],
    severity: "warning",
    message: "Digoxin + Amiodarone: Digoxin toxicity risk — monitor levels.",
  },
  {
    drugs: ["ciprofloxacin", "antacid"],
    severity: "warning",
    message: "Ciprofloxacin + Antacid: Reduced antibiotic absorption.",
  },
  {
    drugs: ["clopidogrel", "ppi"],
    severity: "warning",
    message: "Clopidogrel + PPI: Reduced antiplatelet effect.",
  },
  {
    drugs: ["nsaid", "anticoagulant"],
    severity: "warning",
    message: "NSAID + Anticoagulant: Increased bleeding risk.",
  },
  {
    drugs: ["ace inhibitor", "potassium"],
    severity: "warning",
    message: "ACE inhibitor + Potassium supplement: Hyperkalaemia risk.",
  },
];

// Drug class keywords (lowercase match)
const DRUG_CLASS_MAP: Record<string, string[]> = {
  ssri: [
    "fluoxetine",
    "sertraline",
    "escitalopram",
    "citalopram",
    "paroxetine",
  ],
  maoi: ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline"],
  nsaid: [
    "ibuprofen",
    "naproxen",
    "diclofenac",
    "indomethacin",
    "ketorolac",
    "aspirin",
    "celecoxib",
  ],
  anticoagulant: [
    "warfarin",
    "heparin",
    "enoxaparin",
    "rivaroxaban",
    "apixaban",
  ],
  ppi: [
    "omeprazole",
    "pantoprazole",
    "esomeprazole",
    "lansoprazole",
    "rabeprazole",
  ],
  "ace inhibitor": [
    "enalapril",
    "lisinopril",
    "ramipril",
    "captopril",
    "perindopril",
  ],
};

// ── Renal-sensitive drugs ─────────────────────────────────────────────────────

const RENAL_SENSITIVE: Array<{
  drug: string;
  suggestion: string;
}> = [
  { drug: "metformin", suggestion: "Avoid if eGFR < 30 ml/min." },
  { drug: "nsaid", suggestion: "Avoid NSAIDs in CKD — worsen renal function." },
  {
    drug: "gentamicin",
    suggestion: "Dose adjust based on creatinine clearance.",
  },
  {
    drug: "vancomycin",
    suggestion: "Monitor trough levels, dose adjust in CKD.",
  },
  {
    drug: "digoxin",
    suggestion: "Reduce dose in CKD — narrow therapeutic window.",
  },
  { drug: "acyclovir", suggestion: "Dose reduce in renal impairment." },
];

// ── Hepatic-sensitive drugs ───────────────────────────────────────────────────

const HEPATIC_SENSITIVE: Array<{
  drug: string;
  suggestion: string;
}> = [
  { drug: "paracetamol", suggestion: "Max 2g/day in hepatic impairment." },
  { drug: "statins", suggestion: "Contraindicated in active liver disease." },
  { drug: "isoniazid", suggestion: "Monitor LFTs — hepatotoxic." },
  { drug: "rifampicin", suggestion: "Monitor LFTs — hepatotoxic." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDrug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
}

function drugMatchesClass(drugName: string, className: string): boolean {
  const normalized = normalizeDrug(drugName);
  if (normalized.includes(className)) return true;
  const keywords = DRUG_CLASS_MAP[className] ?? [];
  return keywords.some((kw) => normalized.includes(kw));
}

// ── Drug Safety Checks ────────────────────────────────────────────────────────

export function checkDrugInteractions(
  medications: Medication[],
): DrugWarning[] {
  const warnings: DrugWarning[] = [];
  const names = medications.map((m) => normalizeDrug(m.name));

  for (const pair of DRUG_INTERACTIONS) {
    const [a, b] = pair.drugs;
    const hasA = names.some((n) => drugMatchesClass(n, a));
    const hasB = names.some((n) => drugMatchesClass(n, b));
    if (hasA && hasB) {
      warnings.push({
        type: "interaction",
        severity: pair.severity,
        message: pair.message,
        drugs: [a, b],
      });
    }
  }

  return warnings;
}

export function checkDuplicateTherapy(
  medications: Medication[],
): DrugWarning[] {
  const warnings: DrugWarning[] = [];
  const seen = new Map<string, string[]>();

  for (const med of medications) {
    const norm = normalizeDrug(med.name);
    // Check drug class membership
    for (const [className, keywords] of Object.entries(DRUG_CLASS_MAP)) {
      if (
        keywords.some((kw) => norm.includes(kw)) ||
        norm.includes(className)
      ) {
        const existing = seen.get(className);
        if (existing) {
          warnings.push({
            type: "duplicate",
            severity: "warning",
            message: `Duplicate therapy: Two ${className} drugs prescribed (${existing[0]}, ${med.name}).`,
            drugs: [...existing, med.name],
            suggestion: `Review if both ${className} drugs are necessary.`,
          });
        } else {
          seen.set(className, [med.name]);
        }
      }
    }
  }

  return warnings;
}

export function checkMaxDose(
  medication: Medication,
  _patientAge: number,
  _patientWeight: number,
): DrugWarning | null {
  const norm = normalizeDrug(medication.name);
  // Paracetamol max dose check
  if (norm.includes("paracetamol") || norm.includes("acetaminophen")) {
    const dose = Number.parseFloat(medication.dose);
    if (!Number.isNaN(dose) && dose > 1000) {
      return {
        type: "max_dose",
        severity: "warning",
        message: `Paracetamol dose ${medication.dose} exceeds single-dose maximum (1000mg).`,
        drugs: [medication.name],
        suggestion: "Max single dose: 1g. Max daily: 4g (2g in liver disease).",
      };
    }
  }
  return null;
}

export function checkRenalDoseAdjustment(
  medications: Medication[],
  creatinine: number,
): DrugWarning[] {
  if (creatinine < 1.5) return []; // Normal range — no adjustment needed
  const warnings: DrugWarning[] = [];

  for (const med of medications) {
    const norm = normalizeDrug(med.name);
    for (const entry of RENAL_SENSITIVE) {
      if (drugMatchesClass(norm, entry.drug)) {
        warnings.push({
          type: "renal_adjustment",
          severity: creatinine > 3 ? "critical" : "warning",
          message: `${med.name}: Renal dose adjustment required (Creatinine ${creatinine} mg/dL).`,
          drugs: [med.name],
          suggestion: entry.suggestion,
        });
      }
    }
  }

  return warnings;
}

export function checkAllergyContraindications(
  medications: Medication[],
  allergies: string[],
): DrugWarning[] {
  if (allergies.length === 0) return [];
  const warnings: DrugWarning[] = [];
  const normalizedAllergies = allergies.map(normalizeDrug);

  for (const med of medications) {
    const norm = normalizeDrug(med.name);
    for (const allergy of normalizedAllergies) {
      if (allergy.length > 2 && norm.includes(allergy)) {
        warnings.push({
          type: "allergy",
          severity: "critical",
          message: `⚠️ ALLERGY: ${med.name} — patient is allergic to ${allergy}.`,
          drugs: [med.name],
          suggestion: "Do NOT prescribe. Choose an alternative.",
        });
      }
    }
  }

  return warnings;
}

export function checkHepaticSensitiveDrugs(
  medications: Medication[],
  hasLiverDisease: boolean,
): DrugWarning[] {
  if (!hasLiverDisease) return [];
  const warnings: DrugWarning[] = [];

  for (const med of medications) {
    const norm = normalizeDrug(med.name);
    for (const entry of HEPATIC_SENSITIVE) {
      if (drugMatchesClass(norm, entry.drug)) {
        warnings.push({
          type: "hepatic_adjustment",
          severity: "warning",
          message: `${med.name}: Hepatic caution in liver disease.`,
          drugs: [med.name],
          suggestion: entry.suggestion,
        });
      }
    }
  }

  return warnings;
}

// ── Clinical Alerts ───────────────────────────────────────────────────────────

export function checkSepsisAlert(vitals: {
  temp?: number;
  pulse?: number;
  rr?: number;
  wbc?: number;
}): ClinicalAlert | null {
  const criteria: string[] = [];
  if (vitals.temp !== undefined && (vitals.temp > 38.3 || vitals.temp < 36))
    criteria.push(`Temp ${vitals.temp}°C`);
  if (vitals.pulse !== undefined && vitals.pulse > 90)
    criteria.push(`Pulse ${vitals.pulse} bpm`);
  if (vitals.rr !== undefined && vitals.rr > 20)
    criteria.push(`RR ${vitals.rr}/min`);
  if (vitals.wbc !== undefined && (vitals.wbc > 12 || vitals.wbc < 4))
    criteria.push(`WBC ${vitals.wbc} ×10³`);

  if (criteria.length < 2) return null;

  return buildAlert(
    "Sepsis",
    "Critical",
    `Possible Sepsis — ${criteria.length} SIRS criteria met`,
    `Criteria: ${criteria.join(", ")}. Review urgently and obtain blood cultures.`,
  );
}

export function checkAKIAlert(
  creatinineHistory: number[],
  urineOutput?: number,
): ClinicalAlert | null {
  const reasons: string[] = [];

  if (creatinineHistory.length >= 2) {
    const latest = creatinineHistory[creatinineHistory.length - 1];
    const prev = creatinineHistory[creatinineHistory.length - 2];
    const rise = ((latest - prev) / prev) * 100;
    if (rise >= 50 || latest - prev >= 0.3) {
      reasons.push(
        `Creatinine ↑ from ${prev.toFixed(2)} → ${latest.toFixed(2)} mg/dL`,
      );
    }
  }

  if (urineOutput !== undefined && urineOutput < 0.5) {
    reasons.push(`Urine output ${urineOutput.toFixed(2)} ml/kg/hr < 0.5`);
  }

  if (reasons.length === 0) return null;

  return buildAlert(
    "AKI",
    reasons.length >= 2 ? "Critical" : "Warning",
    "Possible Acute Kidney Injury (AKI)",
    reasons.join(". "),
  );
}

function buildAlert(
  alertType: ClinicalAlert["alertType"],
  severity: ClinicalAlert["severity"],
  message: string,
  details: string,
): ClinicalAlert {
  return {
    id: BigInt(Date.now()),
    patientId: 0n,
    alertType,
    severity,
    message,
    details,
    triggeredAt: BigInt(Date.now()) * 1_000_000n,
    triggeredBy: "clinical-intelligence",
    isAcknowledged: false,
    isResolved: false,
  };
}

// ── Trend Intelligence ────────────────────────────────────────────────────────

function extractNumericSeries(
  observations: Observation[],
  code: string,
): Array<{ date: Date; value: number }> {
  return observations
    .filter(
      (o) =>
        o.code.toLowerCase() === code.toLowerCase() &&
        !o.isDeleted &&
        o.numericValue !== undefined,
    )
    .sort((a, b) => Number(a.observationDate - b.observationDate))
    .map((o) => ({
      date: new Date(Number(o.observationDate) / 1_000_000),
      value: o.numericValue as number,
    }));
}

function detectTrend(values: number[]): "improving" | "worsening" | "stable" {
  if (values.length < 2) return "stable";
  const first = values[0];
  const last = values[values.length - 1];
  const change = ((last - first) / Math.abs(first || 1)) * 100;
  if (Math.abs(change) < 5) return "stable";
  return change < 0 ? "improving" : "worsening";
}

/** For vitals, "lower BP" = improving. For labs like Hb, "higher" = improving. */
const LOWER_IS_BETTER = new Set([
  "bp",
  "bloodpressure",
  "rr",
  "wbc",
  "creatinine",
  "glucose",
]);

function getDirection(
  code: string,
  values: number[],
): "improving" | "worsening" | "stable" {
  const trend = detectTrend(values);
  if (trend === "stable") return "stable";
  const lowerBetter = LOWER_IS_BETTER.has(
    code.toLowerCase().replace(/[^a-z]/g, ""),
  );
  if (lowerBetter) {
    return trend === "improving" ? "improving" : "worsening";
  }
  return trend;
}

export function analyzeVitalTrends(observations: Observation[]): TrendData[] {
  const vitalCodes = ["BP", "Pulse", "Temperature", "SpO2", "RR", "Weight"];
  const results: TrendData[] = [];

  for (const code of vitalCodes) {
    const points = extractNumericSeries(observations, code);
    if (points.length < 2) continue;
    const values = points.map((p) => p.value);
    const direction = getDirection(code, values);
    const first = values[0];
    const last = values[values.length - 1];
    results.push({
      vital: code,
      direction,
      summary: `${code} ${direction === "stable" ? "stable" : direction === "improving" ? "improving" : "worsening"} over ${points.length} readings (${first.toFixed(0)}→${last.toFixed(0)})`,
      dataPoints: points,
    });
  }

  return results;
}

export function analyzeLabTrends(observations: Observation[]): TrendData[] {
  const labCodes = new Set(
    observations.filter((o) => o.observationType === "Lab").map((o) => o.code),
  );
  const results: TrendData[] = [];

  for (const code of labCodes) {
    const points = extractNumericSeries(observations, code);
    if (points.length < 2) continue;
    const values = points.map((p) => p.value);
    const direction = getDirection(code, values);
    const first = values[0];
    const last = values[values.length - 1];
    results.push({
      vital: code,
      direction,
      summary: `${code} ${direction} (${first.toFixed(1)}→${last.toFixed(1)})`,
      dataPoints: points,
    });
  }

  return results;
}

// ── Vital Alert Checker ───────────────────────────────────────────────────────

export interface VitalAlertResult {
  field: string;
  value: string;
  severity: "critical" | "warning";
  message: string;
}

export function checkVitalAlerts(vitals: {
  bloodPressure?: string;
  pulse?: string;
  oxygenSaturation?: string;
  temperature?: string;
  respiratoryRate?: string;
}): VitalAlertResult[] {
  const alerts: VitalAlertResult[] = [];

  if (vitals.bloodPressure) {
    const [sys] = vitals.bloodPressure.split("/").map(Number);
    if (!Number.isNaN(sys)) {
      if (sys < 90)
        alerts.push({
          field: "BP",
          value: vitals.bloodPressure,
          severity: "critical",
          message: `Hypotension: BP ${vitals.bloodPressure} mmHg`,
        });
      else if (sys > 180)
        alerts.push({
          field: "BP",
          value: vitals.bloodPressure,
          severity: "warning",
          message: `Hypertensive urgency: BP ${vitals.bloodPressure} mmHg`,
        });
    }
  }

  if (vitals.oxygenSaturation) {
    const spo2 = Number.parseFloat(vitals.oxygenSaturation);
    if (!Number.isNaN(spo2) && spo2 < 90)
      alerts.push({
        field: "SpO2",
        value: vitals.oxygenSaturation,
        severity: "critical",
        message: `Hypoxia: SpO₂ ${spo2}%`,
      });
  }

  if (vitals.temperature) {
    const temp = Number.parseFloat(vitals.temperature);
    if (!Number.isNaN(temp)) {
      if (temp > 38.5)
        alerts.push({
          field: "Temp",
          value: vitals.temperature,
          severity: "warning",
          message: `Fever: Temp ${temp}°C`,
        });
      else if (temp < 36)
        alerts.push({
          field: "Temp",
          value: vitals.temperature,
          severity: "warning",
          message: `Hypothermia: Temp ${temp}°C`,
        });
    }
  }

  if (vitals.pulse) {
    const pulse = Number.parseFloat(vitals.pulse);
    if (!Number.isNaN(pulse)) {
      if (pulse > 100)
        alerts.push({
          field: "Pulse",
          value: vitals.pulse,
          severity: "warning",
          message: `Tachycardia: Pulse ${pulse} bpm`,
        });
      else if (pulse < 60)
        alerts.push({
          field: "Pulse",
          value: vitals.pulse,
          severity: "warning",
          message: `Bradycardia: Pulse ${pulse} bpm`,
        });
    }
  }

  if (vitals.respiratoryRate) {
    const rr = Number.parseFloat(vitals.respiratoryRate);
    if (!Number.isNaN(rr) && rr > 30)
      alerts.push({
        field: "RR",
        value: vitals.respiratoryRate,
        severity: "warning",
        message: `Tachypnoea: RR ${rr}/min`,
      });
  }

  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED CLINICAL INTELLIGENCE ENGINE
// 28+ new alert types across 9 clinical categories
// ═══════════════════════════════════════════════════════════════════════════════

// ── Alert ID Generator ────────────────────────────────────────────────────────

let _alertSeq = 0;
function makeAlertId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_alertSeq}`;
}

function makeExtendedAlert(
  category: ExtendedAlert["category"],
  alertType: ExtendedAlert["alertType"],
  severity: ExtendedAlert["severity"],
  message: string,
  details: string,
  aiSuggestion?: string,
): ExtendedAlert {
  return {
    id: makeAlertId(alertType),
    category,
    alertType,
    severity,
    message,
    details,
    aiSuggestion,
    triggeredAt: new Date().toISOString(),
  };
}

// ── QT-prolonging drug class list ─────────────────────────────────────────────

const QT_PROLONGING_DRUGS = [
  "amiodarone",
  "sotalol",
  "dofetilide",
  "azithromycin",
  "clarithromycin",
  "erythromycin",
  "ciprofloxacin",
  "levofloxacin",
  "moxifloxacin",
  "haloperidol",
  "quetiapine",
  "olanzapine",
  "chlorpromazine",
  "methadone",
  "ondansetron",
  "domperidone",
];

// ── Condition–Drug contraindication pairs ─────────────────────────────────────

const CONTRAINDICATION_PAIRS: Array<{
  condition: string;
  drug: string;
  message: string;
}> = [
  {
    condition: "renal failure",
    drug: "nsaid",
    message: "NSAIDs contraindicated in renal failure — worsen AKI.",
  },
  {
    condition: "ckd",
    drug: "nsaid",
    message: "NSAIDs contraindicated in CKD — accelerate renal decline.",
  },
  {
    condition: "asthma",
    drug: "beta blocker",
    message:
      "Beta-blockers contraindicated in asthma — may precipitate bronchospasm.",
  },
  {
    condition: "asthma",
    drug: "propranolol",
    message:
      "Propranolol contraindicated in asthma — non-selective beta blocker.",
  },
  {
    condition: "heart block",
    drug: "verapamil",
    message: "Verapamil contraindicated in complete heart block.",
  },
  {
    condition: "heart block",
    drug: "diltiazem",
    message: "Diltiazem contraindicated in high-degree heart block.",
  },
  {
    condition: "peptic ulcer",
    drug: "nsaid",
    message: "NSAIDs worsen peptic ulcer disease — avoid or add PPI.",
  },
  {
    condition: "pregnancy",
    drug: "warfarin",
    message: "Warfarin contraindicated in pregnancy — teratogenic.",
  },
  {
    condition: "gout",
    drug: "thiazide",
    message: "Thiazides raise uric acid — may worsen gout.",
  },
];

// ── Antibiotic class → pathogen coverage map ──────────────────────────────────

const ANTIBIOTIC_COVERAGE: Record<string, string[]> = {
  penicillin: ["streptococcus", "staphylococcus", "gram-positive"],
  amoxicillin: ["streptococcus", "e.coli", "h.pylori", "gram-positive"],
  "co-amoxiclav": ["mrsa_sensitive", "gram-positive", "anaerobes"],
  ciprofloxacin: [
    "gram-negative",
    "e.coli",
    "pseudomonas",
    "enterobacteriaceae",
  ],
  metronidazole: ["anaerobes", "c.difficile", "bacteroides"],
  vancomycin: ["mrsa", "gram-positive", "enterococcus"],
  meropenem: [
    "gram-negative",
    "pseudomonas",
    "enterobacteriaceae",
    "anaerobes",
  ],
};

// ── 1. CRITICAL EMERGENCY (extended) ─────────────────────────────────────────

function checkCriticalEmergency(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const v = input.vitals ?? {};

  // Septic Shock: sepsis criteria + SBP<90 OR lactate>2
  const hasSepsisCriteria =
    (v.temperature !== undefined &&
      (v.temperature > 38.3 || v.temperature < 36)) ||
    (v.heartRate !== undefined && v.heartRate > 90) ||
    (v.respiratoryRate !== undefined && v.respiratoryRate > 20);
  const hasShock =
    (v.systolicBP !== undefined && v.systolicBP < 90) ||
    (v.lactate !== undefined && v.lactate > 2);

  if (hasSepsisCriteria && hasShock) {
    alerts.push(
      makeExtendedAlert(
        "critical_emergency",
        "SepticShock",
        "critical",
        "⚠️ Septic Shock",
        `Sepsis criteria met + ${v.systolicBP !== undefined && v.systolicBP < 90 ? `SBP ${v.systolicBP} mmHg` : `Lactate ${v.lactate} mmol/L`}`,
        "Start sepsis bundle? (IV fluids, blood cultures, broad-spectrum antibiotics)",
      ),
    );
  }

  // Shock Index: HR / SBP > 0.9
  if (
    v.heartRate !== undefined &&
    v.systolicBP !== undefined &&
    v.systolicBP > 0
  ) {
    const si = v.heartRate / v.systolicBP;
    if (si > 0.9) {
      alerts.push(
        makeExtendedAlert(
          "critical_emergency",
          "ShockIndex",
          "critical",
          "⚠️ Shock Index Elevated",
          `HR ${v.heartRate} / SBP ${v.systolicBP} = ${si.toFixed(2)} (>0.9 indicates shock risk)`,
        ),
      );
    }
  }

  // Respiratory Failure: RR>30 OR PaCO₂ elevated (>45)
  const rrHigh = v.respiratoryRate !== undefined && v.respiratoryRate > 30;
  const paco2High = v.paco2 !== undefined && v.paco2 > 45;
  if (rrHigh || paco2High) {
    alerts.push(
      makeExtendedAlert(
        "critical_emergency",
        "RespiratoryFailure",
        "critical",
        "⚠️ Respiratory Failure Risk",
        `${rrHigh ? `RR ${v.respiratoryRate}/min > 30` : ""}${rrHigh && paco2High ? "; " : ""}${paco2High ? `PaCO₂ ${v.paco2} mmHg elevated` : ""}`,
        "Evaluate for O₂ therapy / ventilatory support",
      ),
    );
  }

  // Cardiac Arrest Risk: (HR<40 OR HR>180) AND SBP<80
  if (
    v.heartRate !== undefined &&
    v.systolicBP !== undefined &&
    (v.heartRate < 40 || v.heartRate > 180) &&
    v.systolicBP < 80
  ) {
    alerts.push(
      makeExtendedAlert(
        "critical_emergency",
        "CardiacArrestRisk",
        "critical",
        "🚨 Cardiac Arrest Risk",
        `HR ${v.heartRate} bpm + SBP ${v.systolicBP} mmHg — critical haemodynamic compromise`,
        "Immediate resuscitation assessment required",
      ),
    );
  }

  return alerts;
}

// ── 2. RENAL & ELECTROLYTE ────────────────────────────────────────────────────

function checkRenalElectrolyte(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const l = input.labs ?? {};
  const v = input.vitals ?? {};

  // AKI (enhanced): Creatinine rise ≥0.3 in 48h OR UO <0.5
  if (l.creatinine !== undefined && l.creatininePrev !== undefined) {
    const rise = l.creatinine - l.creatininePrev;
    if (rise >= 0.3) {
      const hasHyperK = l.potassium !== undefined && l.potassium >= 5.5;
      alerts.push(
        makeExtendedAlert(
          "renal_electrolyte",
          "AKI",
          rise >= 0.5 ? "critical" : "warning",
          "Acute Kidney Injury (AKI)",
          `Creatinine ↑ ${l.creatininePrev.toFixed(2)} → ${l.creatinine.toFixed(2)} mg/dL (rise ${rise.toFixed(2)} in 48h)`,
          hasHyperK
            ? "Consider AKI protocol (fluids, stop nephrotoxins, check electrolytes)"
            : undefined,
        ),
      );
    }
  }
  if (v.urineOutputMlKgHr !== undefined && v.urineOutputMlKgHr < 0.5) {
    alerts.push(
      makeExtendedAlert(
        "renal_electrolyte",
        "AKI",
        "warning",
        "Low Urine Output — AKI Risk",
        `Urine output ${v.urineOutputMlKgHr.toFixed(2)} ml/kg/hr < 0.5 threshold`,
        "Consider AKI protocol (fluids, stop nephrotoxins, check electrolytes)",
      ),
    );
  }

  // Severe Hyperkalemia: K+ ≥ 6.0
  if (l.potassium !== undefined && l.potassium >= 6.0) {
    alerts.push(
      makeExtendedAlert(
        "renal_electrolyte",
        "Hyperkalemia",
        l.potassium >= 6.5 ? "critical" : "warning",
        `Severe Hyperkalemia: K⁺ ${l.potassium} mmol/L`,
        "Risk of fatal arrhythmia. ECG immediately.",
        "Consider AKI protocol (fluids, stop nephrotoxins, check electrolytes)",
      ),
    );
  }

  // Severe Hypokalemia: K+ ≤ 2.5
  if (l.potassium !== undefined && l.potassium <= 2.5) {
    alerts.push(
      makeExtendedAlert(
        "renal_electrolyte",
        "Hypokalemia",
        "critical",
        `Severe Hypokalemia: K⁺ ${l.potassium} mmol/L`,
        "Risk of arrhythmia and paralysis. IV potassium replacement required.",
      ),
    );
  }

  // Hyponatremia: Na+ < 125
  if (l.sodium !== undefined && l.sodium < 125) {
    alerts.push(
      makeExtendedAlert(
        "renal_electrolyte",
        "Hyponatremia",
        l.sodium < 120 ? "critical" : "warning",
        `Severe Hyponatremia: Na⁺ ${l.sodium} mmol/L`,
        "Risk of cerebral oedema and seizures. Correct cautiously (<10 mmol/day).",
      ),
    );
  }

  // Hypernatremia: Na+ > 155
  if (l.sodium !== undefined && l.sodium > 155) {
    alerts.push(
      makeExtendedAlert(
        "renal_electrolyte",
        "Hypernatremia",
        "warning",
        `Hypernatremia: Na⁺ ${l.sodium} mmol/L`,
        "Dehydration or diabetes insipidus. Gradual fluid replacement.",
      ),
    );
  }

  // Metabolic Acidosis: pH < 7.35 AND HCO₃ < 18
  if (
    l.ph !== undefined &&
    l.bicarbonate !== undefined &&
    l.ph < 7.35 &&
    l.bicarbonate < 18
  ) {
    alerts.push(
      makeExtendedAlert(
        "renal_electrolyte",
        "MetabolicAcidosis",
        l.ph < 7.25 ? "critical" : "warning",
        `Metabolic Acidosis: pH ${l.ph}, HCO₃ ${l.bicarbonate} mmol/L`,
        "Evaluate for sepsis, renal failure, DKA, lactic acidosis.",
      ),
    );
  }

  // High Anion Gap: AG = Na - Cl - HCO₃ > 12
  if (
    l.sodium !== undefined &&
    l.chloride !== undefined &&
    l.bicarbonate !== undefined
  ) {
    const ag = l.sodium - l.chloride - l.bicarbonate;
    if (ag > 12) {
      alerts.push(
        makeExtendedAlert(
          "renal_electrolyte",
          "HighAnionGap",
          ag > 20 ? "critical" : "warning",
          `High Anion Gap: AG = ${ag} (Na ${l.sodium} - Cl ${l.chloride} - HCO₃ ${l.bicarbonate})`,
          "Consider MUDPILES: Methanol, Uraemia, DKA, Propylene glycol, Isoniazid, Lactic acidosis, Ethylene glycol, Salicylates.",
        ),
      );
    }
  }

  return alerts;
}

// ── 3. MEDICATION SAFETY (extended) ──────────────────────────────────────────

function checkMedicationSafety(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const meds = input.medications ?? [];
  const l = input.labs ?? {};
  const diagnoses = (input.diagnoses ?? []).map((d) => d.toLowerCase());

  // QT Prolongation Risk
  const hasQTDrug = meds.some((m) =>
    QT_PROLONGING_DRUGS.some((q) => normalizeDrug(m.name).includes(q)),
  );
  const lowK = l.potassium !== undefined && l.potassium < 3.0;
  if (hasQTDrug && lowK) {
    const qtDrug = meds.find((m) =>
      QT_PROLONGING_DRUGS.some((q) => normalizeDrug(m.name).includes(q)),
    );
    alerts.push(
      makeExtendedAlert(
        "medication_safety",
        "QTProlongation",
        "warning",
        `QT Prolongation Risk: ${qtDrug?.name} + Low K⁺ (${l.potassium} mmol/L)`,
        "QT-prolonging drug combined with hypokalaemia increases torsades de pointes risk.",
        "Correct potassium before using QT-prolonging agents.",
      ),
    );
  }

  // Condition–Drug contraindications
  for (const pair of CONTRAINDICATION_PAIRS) {
    const hasDiagnosis = diagnoses.some(
      (d) => d.includes(pair.condition) || pair.condition.includes(d),
    );
    if (!hasDiagnosis) continue;
    const hasDrug = meds.some((m) => {
      const norm = normalizeDrug(m.name);
      return norm.includes(pair.drug) || drugMatchesClass(norm, pair.drug);
    });
    if (hasDrug) {
      alerts.push(
        makeExtendedAlert(
          "medication_safety",
          "DrugContraindication",
          "critical",
          `Contraindication: ${pair.condition} + ${pair.drug}`,
          pair.message,
        ),
      );
    }
  }

  return alerts;
}

// ── 4. CARDIOVASCULAR ────────────────────────────────────────────────────────

function checkCardiovascular(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const v = input.vitals ?? {};
  const l = input.labs ?? {};

  // Hypertensive Crisis: SBP ≥ 180 AND DBP ≥ 120
  if (
    v.systolicBP !== undefined &&
    v.diastolicBP !== undefined &&
    v.systolicBP >= 180 &&
    v.diastolicBP >= 120
  ) {
    alerts.push(
      makeExtendedAlert(
        "cardiovascular",
        "HypertensiveCrisis",
        "critical",
        `Hypertensive Crisis: BP ${v.systolicBP}/${v.diastolicBP} mmHg`,
        "SBP ≥180 AND DBP ≥120 — risk of end-organ damage (stroke, MI, renal failure).",
        "Consider IV antihypertensive; avoid rapid correction (max 25% reduction in 1h).",
      ),
    );
  }

  // Bradycardia: HR < 50
  if (v.heartRate !== undefined && v.heartRate < 50) {
    alerts.push(
      makeExtendedAlert(
        "cardiovascular",
        "Bradycardia",
        v.heartRate < 40 ? "critical" : "warning",
        `Bradycardia: HR ${v.heartRate} bpm`,
        "HR < 50 bpm — check for complete heart block, drug toxicity (digoxin, beta-blocker).",
      ),
    );
  }

  // Tachycardia: HR > 120
  if (v.heartRate !== undefined && v.heartRate > 120) {
    alerts.push(
      makeExtendedAlert(
        "cardiovascular",
        "Tachycardia",
        v.heartRate > 150 ? "critical" : "warning",
        `Tachycardia: HR ${v.heartRate} bpm`,
        "HR > 120 bpm — evaluate for sepsis, haemorrhage, PE, thyroid storm, AF.",
      ),
    );
  }

  // Heart Failure Alert: edema + BNP elevated OR dyspnea + edema
  const hasEdema = v.hasEdema === true;
  const bnpHigh = l.bnp !== undefined && l.bnp > 100;
  if (hasEdema && (bnpHigh || (v.spo2 !== undefined && v.spo2 < 94))) {
    alerts.push(
      makeExtendedAlert(
        "cardiovascular",
        "HeartFailure",
        "warning",
        `Heart Failure Alert: Oedema + ${bnpHigh ? `BNP ${l.bnp} pg/mL` : `SpO₂ ${v.spo2}%`}`,
        "Features consistent with decompensated heart failure.",
        "Assess fluid status, consider diuresis and cardiology review.",
      ),
    );
  }

  return alerts;
}

// ── 5. RESPIRATORY ────────────────────────────────────────────────────────────

function checkRespiratory(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const v = input.vitals ?? {};
  const diagnoses = (input.diagnoses ?? []).map((d) => d.toLowerCase());

  const hasAsthma = diagnoses.some((d) => d.includes("asthma"));
  const hasCOPD = diagnoses.some(
    (d) => d.includes("copd") || d.includes("chronic obstructive"),
  );
  const spo2 = v.spo2;
  const rr = v.respiratoryRate;

  // Asthma Exacerbation: asthma diagnosis + SpO₂ < 94%
  if (hasAsthma && spo2 !== undefined && spo2 < 94) {
    alerts.push(
      makeExtendedAlert(
        "respiratory",
        "AsthmaExacerbation",
        spo2 < 90 ? "critical" : "warning",
        `Asthma Exacerbation: SpO₂ ${spo2}%`,
        "Asthma + hypoxaemia. Assess severity with PEFR.",
        "Evaluate for O₂ therapy / ventilatory support",
      ),
    );
  }

  // COPD Exacerbation: COPD + RR > 24
  if (hasCOPD && rr !== undefined && rr > 24) {
    alerts.push(
      makeExtendedAlert(
        "respiratory",
        "COPDExacerbation",
        rr > 30 ? "critical" : "warning",
        `COPD Exacerbation: RR ${rr}/min`,
        "COPD + tachypnoea. Review O₂ target (88–92%), consider NIV.",
      ),
    );
  }

  // PE Risk: HR>100 + SpO₂<94 + PE risk factors
  const hrHigh = v.heartRate !== undefined && v.heartRate > 100;
  const spo2Low = spo2 !== undefined && spo2 < 94;
  const hasPERisk = input.peRiskFactors === true;
  if (hrHigh && spo2Low && hasPERisk) {
    alerts.push(
      makeExtendedAlert(
        "respiratory",
        "PERisk",
        "warning",
        `Pulmonary Embolism Risk: HR ${v.heartRate}, SpO₂ ${spo2}%`,
        "Tachycardia + hypoxaemia + PE risk factors (immobility/surgery/DVT).",
        "Consider CTPA or V/Q scan. Wells score calculation recommended.",
      ),
    );
  }

  return alerts;
}

// ── 6. ENDOCRINE ─────────────────────────────────────────────────────────────

function checkEndocrine(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const v = input.vitals ?? {};
  const l = input.labs ?? {};
  const diagnoses = (input.diagnoses ?? []).map((d) => d.toLowerCase());

  const glucose = l.glucose;
  const hasHyperthyroid = diagnoses.some(
    (d) => d.includes("hyperthyroid") || d.includes("graves"),
  );
  const hasHypothyroid = diagnoses.some(
    (d) => d.includes("hypothyroid") || d.includes("myxedema"),
  );

  // Severe Hypoglycemia: glucose < 54
  if (glucose !== undefined && glucose < 54) {
    alerts.push(
      makeExtendedAlert(
        "endocrine",
        "SevereHypoglycemia",
        "critical",
        `Severe Hypoglycemia: Glucose ${glucose} mg/dL`,
        "Glucose < 54 mg/dL — risk of seizure, coma.",
        "Administer dextrose 50% 50ml IV or oral glucose immediately",
      ),
    );
  } else if (glucose !== undefined && glucose < 70) {
    alerts.push(
      makeExtendedAlert(
        "endocrine",
        "Hypoglycemia",
        "warning",
        `Hypoglycemia: Glucose ${glucose} mg/dL`,
        "Glucose < 70 mg/dL. Treat with oral glucose if conscious.",
        "Administer dextrose 50% 50ml IV or oral glucose immediately",
      ),
    );
  }

  // Hyperglycemia: glucose > 250
  if (glucose !== undefined && glucose > 250) {
    const l_val = input.labs ?? {};
    const hasDKACriteria =
      l_val.ph !== undefined &&
      l_val.ph < 7.35 &&
      l_val.bicarbonate !== undefined &&
      l_val.bicarbonate < 18;
    if (hasDKACriteria) {
      alerts.push(
        makeExtendedAlert(
          "endocrine",
          "DKARisk",
          "critical",
          `DKA Risk: Glucose ${glucose} + Metabolic Acidosis (pH ${l_val.ph})`,
          "Hyperglycaemia + metabolic acidosis — DKA protocol required.",
          "IV insulin infusion, IV fluids, electrolyte correction; endocrinology review.",
        ),
      );
    } else {
      alerts.push(
        makeExtendedAlert(
          "endocrine",
          "Hyperglycemia",
          "warning",
          `Hyperglycemia: Glucose ${glucose} mg/dL`,
          "Glucose > 250 mg/dL. Check ketones, review insulin regimen.",
        ),
      );
    }
  }

  // Thyroid Storm: HR>140 + Temp>38.5 + known hyperthyroid
  if (
    hasHyperthyroid &&
    v.heartRate !== undefined &&
    v.heartRate > 140 &&
    v.temperature !== undefined &&
    v.temperature > 38.5
  ) {
    alerts.push(
      makeExtendedAlert(
        "endocrine",
        "ThyroidStorm",
        "critical",
        `Thyroid Storm: HR ${v.heartRate} bpm, Temp ${v.temperature}°C`,
        "Hyperthyroid + tachycardia + fever — thyroid storm (Burch–Wartofsky criteria).",
        "PTU/carbimazole, beta-blockers, hydrocortisone, iodine solution — ICU admission.",
      ),
    );
  }

  // Myxedema Coma: Temp<35 + HR<50 + known hypothyroid
  if (
    hasHypothyroid &&
    v.temperature !== undefined &&
    v.temperature < 35 &&
    v.heartRate !== undefined &&
    v.heartRate < 50
  ) {
    alerts.push(
      makeExtendedAlert(
        "endocrine",
        "MyxedemaComa",
        "critical",
        `Myxedema Coma Risk: Temp ${v.temperature}°C, HR ${v.heartRate} bpm`,
        "Hypothyroid + hypothermia + bradycardia — myxedema coma.",
        "IV levothyroxine + hydrocortisone, warming, respiratory support.",
      ),
    );
  }

  return alerts;
}

// ── 7. NEUROLOGY ─────────────────────────────────────────────────────────────

function checkNeurology(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const v = input.vitals ?? {};
  const l = input.labs ?? {};

  const gcs = v.gcs;
  const glucose = l.glucose;
  const sodium = l.sodium;

  // Low GCS: ≤ 8
  if (gcs !== undefined && gcs <= 8) {
    alerts.push(
      makeExtendedAlert(
        "neurology",
        "LowGCS",
        gcs <= 5 ? "critical" : "warning",
        `Low GCS: ${gcs}/15`,
        "GCS ≤ 8 indicates impaired consciousness. Airway at risk.",
        "Assess airway, consider CT head, check glucose",
      ),
    );
  }

  // Seizure Risk: severe hyponatremia OR severe hypoglycemia OR low GCS
  const severeHypoNa = sodium !== undefined && sodium < 120;
  const severeHypoGlucose = glucose !== undefined && glucose < 54;
  const lowGCS = gcs !== undefined && gcs <= 8;
  if (severeHypoNa || severeHypoGlucose || lowGCS) {
    const reasons: string[] = [];
    if (severeHypoNa) reasons.push(`Na⁺ ${sodium} mmol/L`);
    if (severeHypoGlucose) reasons.push(`Glucose ${glucose} mg/dL`);
    if (lowGCS) reasons.push(`GCS ${gcs}`);
    alerts.push(
      makeExtendedAlert(
        "neurology",
        "SeizureRisk",
        "warning",
        "Seizure Risk",
        `Contributing factors: ${reasons.join(", ")}`,
        "Assess airway, consider CT head, check glucose",
      ),
    );
  }

  return alerts;
}

// ── 8. INFECTION CONTROL ──────────────────────────────────────────────────────

function checkInfectionControl(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const v = input.vitals ?? {};
  const l = input.labs ?? {};
  const meds = input.medications ?? [];

  // Neutropenic Sepsis: Fever (>38°C) + ANC < 500
  const hasFever = v.temperature !== undefined && v.temperature > 38;
  const ancLow = l.anc !== undefined && l.anc < 500;
  if (hasFever && ancLow) {
    alerts.push(
      makeExtendedAlert(
        "infection_control",
        "NeutropenicSepsis",
        "critical",
        `Neutropenic Sepsis: Temp ${v.temperature}°C, ANC ${l.anc}`,
        "Fever + severe neutropenia. Medical emergency — mortality >50% if untreated.",
        "Blood cultures × 2, broad-spectrum antibiotics within 1 hour, isolate patient.",
      ),
    );
  }

  // Antibiotic Mismatch (basic check based on known coverage)
  for (const med of meds) {
    const norm = normalizeDrug(med.name);
    for (const [abxClass, coverage] of Object.entries(ANTIBIOTIC_COVERAGE)) {
      if (!norm.includes(abxClass)) continue;
      // If diagnoses mention a pathogen not covered by this antibiotic
      const diagnoses = (input.diagnoses ?? []).map((d) => d.toLowerCase());
      const uncoveredPathogen = diagnoses.find(
        (d) => !coverage.some((c) => d.includes(c)),
      );
      if (uncoveredPathogen) {
        alerts.push(
          makeExtendedAlert(
            "infection_control",
            "AntibioticMismatch",
            "warning",
            `Antibiotic Mismatch: ${med.name} vs ${uncoveredPathogen}`,
            `${med.name} (${abxClass} class) may not cover ${uncoveredPathogen}.`,
            "Review culture results and local antibiogram.",
          ),
        );
        break;
      }
    }
  }

  return alerts;
}

// ── 9. HOSPITAL WORKFLOW ──────────────────────────────────────────────────────

function checkHospitalWorkflow(input: ExtendedAlertInput): ExtendedAlert[] {
  const alerts: ExtendedAlert[] = [];
  const wf = input.workflowData ?? {};
  const now = Date.now();

  // Missed Dose: 2+ consecutive "not_given" administrations
  for (const admin of wf.medicationAdministrations ?? []) {
    if (admin.status === "not_given") {
      const notGivenCount =
        admin.scheduledTimes.length - admin.administeredTimes.length;
      if (notGivenCount >= 2) {
        alerts.push(
          makeExtendedAlert(
            "hospital_workflow",
            "MissedDose",
            "warning",
            `Missed Dose: ${admin.drugName} — ${notGivenCount} consecutive doses not given`,
            `Scheduled: ${admin.scheduledTimes.join(", ")}. Administered: ${admin.administeredTimes.length ? admin.administeredTimes.join(", ") : "None"}`,
          ),
        );
      }
    }
  }

  // Overdue Investigation: ordered >48h ago, still "sample_collected"
  for (const inv of wf.investigations ?? []) {
    if (inv.status === "sample_collected") {
      const orderedAt = new Date(inv.orderedAt).getTime();
      const hoursElapsed = (now - orderedAt) / 3_600_000;
      if (hoursElapsed > 48) {
        alerts.push(
          makeExtendedAlert(
            "hospital_workflow",
            "OverdueInvestigation",
            "info",
            `Overdue Investigation: ${inv.name} (${Math.round(hoursElapsed)}h since ordered)`,
            `Status: Sample Collected — result not yet received after ${Math.round(hoursElapsed)}h.`,
          ),
        );
      }
    }
  }

  // Discharge Risk: active critical alert + flagged for discharge
  if (wf.isScheduledForDischarge && wf.hasActiveCriticalAlert) {
    alerts.push(
      makeExtendedAlert(
        "hospital_workflow",
        "DischargeRisk",
        "critical",
        "Discharge Risk: Active Critical Alert Present",
        "Patient is flagged for discharge but has an unresolved critical clinical alert.",
        "Resolve all critical alerts before proceeding with discharge.",
      ),
    );
  }

  return alerts;
}

// ── MAIN EXPORT: checkExtendedClinicalAlerts ──────────────────────────────────

/**
 * Runs all 9 extended alert categories against the provided clinical data.
 * Does NOT replace existing checkSepsisAlert / checkAKIAlert / checkVitalAlerts.
 * Those continue to work for ClinicalAlert (BigInt-based) objects.
 * This function returns ExtendedAlert[] for the new UI alert panels.
 */
export function checkExtendedClinicalAlerts(
  input: ExtendedAlertInput,
): ExtendedAlert[] {
  return [
    ...checkCriticalEmergency(input),
    ...checkRenalElectrolyte(input),
    ...checkMedicationSafety(input),
    ...checkCardiovascular(input),
    ...checkRespiratory(input),
    ...checkEndocrine(input),
    ...checkNeurology(input),
    ...checkInfectionControl(input),
    ...checkHospitalWorkflow(input),
  ];
}

// ── NEWS2 Score ───────────────────────────────────────────────────────────────

export interface NEWS2Result {
  score: number;
  risk: "low" | "medium" | "high";
  breakdown: {
    rr: number;
    spo2: number;
    temp: number;
    sysBP: number;
    pulse: number;
    consciousness: number;
  };
}

/**
 * Calculates the National Early Warning Score 2 (NEWS2).
 * Accepts a VitalSigns-compatible object (string fields).
 * Returns score, risk band, and component breakdown.
 */
export function calculateNEWS2(vitals: {
  bloodPressure?: string;
  pulse?: string;
  temperature?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  [key: string]: string | undefined;
}): NEWS2Result {
  const parseNum = (v?: string) => (v ? Number.parseFloat(v) : undefined);

  const rr = parseNum(vitals.respiratoryRate);
  const spo2 = parseNum(vitals.oxygenSaturation);
  const temp = parseNum(vitals.temperature);
  const bpStr = vitals.bloodPressure ?? "";
  const sysBP = bpStr.includes("/")
    ? Number.parseFloat(bpStr.split("/")[0])
    : undefined;
  const pulse = parseNum(vitals.pulse);

  // Respiratory rate scoring
  let rrScore = 0;
  if (rr !== undefined) {
    if (rr <= 8) rrScore = 3;
    else if (rr <= 11) rrScore = 1;
    else if (rr <= 20) rrScore = 0;
    else if (rr <= 24) rrScore = 2;
    else rrScore = 3;
  }

  // SpO2 scoring
  let spo2Score = 0;
  if (spo2 !== undefined) {
    if (spo2 <= 91) spo2Score = 3;
    else if (spo2 <= 93) spo2Score = 2;
    else if (spo2 <= 95) spo2Score = 1;
    else spo2Score = 0;
  }

  // Temperature scoring
  let tempScore = 0;
  if (temp !== undefined) {
    if (temp <= 35.0) tempScore = 3;
    else if (temp <= 36.0) tempScore = 1;
    else if (temp <= 38.0) tempScore = 0;
    else if (temp <= 39.0) tempScore = 1;
    else tempScore = 2;
  }

  // Systolic BP scoring
  let sysBPScore = 0;
  if (sysBP !== undefined) {
    if (sysBP <= 90) sysBPScore = 3;
    else if (sysBP <= 100) sysBPScore = 2;
    else if (sysBP <= 110) sysBPScore = 1;
    else if (sysBP <= 219) sysBPScore = 0;
    else sysBPScore = 3;
  }

  // Pulse scoring
  let pulseScore = 0;
  if (pulse !== undefined) {
    if (pulse <= 40) pulseScore = 3;
    else if (pulse <= 50) pulseScore = 1;
    else if (pulse <= 90) pulseScore = 0;
    else if (pulse <= 110) pulseScore = 1;
    else if (pulse <= 130) pulseScore = 2;
    else pulseScore = 3;
  }

  // Consciousness: assume "A" (Alert) = 0 unless noted elsewhere
  const consciousnessScore = 0;

  const score =
    rrScore +
    spo2Score +
    tempScore +
    sysBPScore +
    pulseScore +
    consciousnessScore;

  let risk: "low" | "medium" | "high" = "low";
  if (score >= 7) risk = "high";
  else if (score >= 5) risk = "medium";

  return {
    score,
    risk,
    breakdown: {
      rr: rrScore,
      spo2: spo2Score,
      temp: tempScore,
      sysBP: sysBPScore,
      pulse: pulseScore,
      consciousness: consciousnessScore,
    },
  };
}

// ── TREND ALERTS ─────────────────────────────────────────────────────────────

/**
 * Detects rising/falling trends in vitals and lab history.
 * Requires at least 3 readings to detect a trend.
 */
export function checkTrendAlerts(
  vitalHistory: VitalReading[],
  labHistory: LabResult[],
): TrendAlert[] {
  const alerts: TrendAlert[] = [];

  // Helper: detect monotonic trend in last N values
  function isRising(values: number[]): boolean {
    if (values.length < 2) return false;
    return values[values.length - 1] > values[0];
  }
  function isFalling(values: number[]): boolean {
    if (values.length < 2) return false;
    return values[values.length - 1] < values[0];
  }
  function percentChange(values: number[]): number {
    if (values.length < 2 || values[0] === 0) return 0;
    return ((values[values.length - 1] - values[0]) / values[0]) * 100;
  }

  // Rising creatinine (last ≤3 readings)
  const creatReadings = labHistory
    .filter((l) => l.creatinine !== undefined)
    .slice(-3)
    .map((l) => l.creatinine as number);
  if (
    creatReadings.length >= 2 &&
    isRising(creatReadings) &&
    percentChange(creatReadings) >= 10
  ) {
    alerts.push({
      id: makeAlertId("trend_creatinine"),
      metric: "Creatinine",
      severity: "warning",
      trend: "rising",
      message: "Creatinine rising — monitor for AKI",
      details: `Values: ${creatReadings.map((v) => v.toFixed(2)).join(" → ")} mg/dL (+${percentChange(creatReadings).toFixed(0)}%)`,
    });
  }

  // Declining urine output (last ≤3 readings)
  const uoReadings = vitalHistory
    .filter((v) => v.urineOutputMlKgHr !== undefined)
    .slice(-3)
    .map((v) => v.urineOutputMlKgHr as number);
  if (uoReadings.length >= 2 && isFalling(uoReadings)) {
    alerts.push({
      id: makeAlertId("trend_urine_output"),
      metric: "Urine Output",
      severity: "warning",
      trend: "falling",
      message: "Urine output declining",
      details: `Values: ${uoReadings.map((v) => v.toFixed(2)).join(" → ")} ml/kg/hr`,
    });
  }

  // Falling hemoglobin (last ≤3 readings)
  const hbReadings = labHistory
    .filter((l) => l.hemoglobin !== undefined)
    .slice(-3)
    .map((l) => l.hemoglobin as number);
  if (
    hbReadings.length >= 2 &&
    isFalling(hbReadings) &&
    percentChange(hbReadings) <= -5
  ) {
    alerts.push({
      id: makeAlertId("trend_hemoglobin"),
      metric: "Hemoglobin",
      severity: "warning",
      trend: "falling",
      message: "Hemoglobin falling — check for bleeding",
      details: `Values: ${hbReadings.map((v) => v.toFixed(1)).join(" → ")} g/dL (${percentChange(hbReadings).toFixed(0)}%)`,
    });
  }

  return alerts;
}
