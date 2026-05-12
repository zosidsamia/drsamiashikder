// ─── Domain types for Dr. Arman Kabir's Care ─────────────────────────────────
// These types were previously imported from backend.d which is a protected stub.
// All domain types live here.

import type { Principal } from "@icp-sdk/core/principal";

// ── Staff Role System ─────────────────────────────────────────────────────────
export type StaffRole =
  | "admin"
  | "consultant_doctor"
  | "medical_officer"
  | "intern_doctor"
  | "nurse"
  | "staff"
  | "doctor"
  | "patient"
  | "assistant_registrar"
  | "registrar"
  | "assistant_professor"
  | "associate_professor"
  | "professor";

/** Returns true for all consultant-type roles that can finalize, approve, admit */
export function isConsultantType(role: StaffRole): boolean {
  return (
    role === "consultant_doctor" ||
    role === "doctor" ||
    role === "assistant_professor" ||
    role === "associate_professor" ||
    role === "professor"
  );
}

/** Returns true for roles that can verify vitals (MO level and above) */
export function canVerifyVitals(role: StaffRole): boolean {
  return (
    role === "medical_officer" ||
    role === "assistant_registrar" ||
    role === "registrar" ||
    isConsultantType(role) ||
    role === "admin"
  );
}

export const STAFF_ROLE_LABELS: Record<
  Exclude<StaffRole, "admin" | "patient" | "doctor">,
  string
> = {
  consultant_doctor: "Consultant Doctor",
  medical_officer: "Medical Officer",
  intern_doctor: "Intern Doctor",
  nurse: "Nurse",
  staff: "Staff / Reception",
  assistant_registrar: "Assistant Registrar",
  registrar: "Registrar",
  assistant_professor: "Assistant Professor",
  associate_professor: "Associate Professor",
  professor: "Professor",
};

/** Ordered hierarchy for display (lowest → highest) */
export const ROLE_HIERARCHY_ORDER: Exclude<StaffRole, "admin" | "patient">[] = [
  "nurse",
  "intern_doctor",
  "medical_officer",
  "assistant_registrar",
  "registrar",
  "consultant_doctor",
  "assistant_professor",
  "associate_professor",
  "professor",
  "staff",
];

export const STAFF_ROLE_COLORS: Record<
  Exclude<StaffRole, "admin" | "patient">,
  string
> = {
  consultant_doctor: "bg-blue-700 text-white border-blue-700",
  medical_officer: "bg-teal-600 text-white border-teal-600",
  intern_doctor: "bg-violet-600 text-white border-violet-600",
  nurse: "bg-rose-600 text-white border-rose-600",
  staff: "bg-amber-600 text-white border-amber-600",
  doctor: "bg-emerald-600 text-white border-emerald-600",
  assistant_registrar: "bg-emerald-500 text-white border-emerald-500",
  registrar: "bg-green-700 text-white border-green-700",
  assistant_professor: "bg-sky-600 text-white border-sky-600",
  associate_professor: "bg-indigo-600 text-white border-indigo-600",
  professor: "bg-purple-700 text-white border-purple-700",
};

/** Active sidebar background tint per role */
export const STAFF_ROLE_ACTIVE_BG: Record<
  Exclude<StaffRole, "patient">,
  string
> = {
  admin: "bg-slate-50",
  consultant_doctor: "bg-blue-50",
  medical_officer: "bg-teal-50",
  intern_doctor: "bg-violet-50",
  nurse: "bg-rose-50",
  staff: "bg-amber-50",
  doctor: "bg-emerald-50",
  assistant_registrar: "bg-emerald-50",
  registrar: "bg-green-50",
  assistant_professor: "bg-sky-50",
  associate_professor: "bg-indigo-50",
  professor: "bg-purple-50",
};

/** Active sidebar border-color per role (as inline CSS hex for dynamic border) */
export const STAFF_ROLE_BORDER_COLOR: Record<
  Exclude<StaffRole, "patient">,
  string
> = {
  admin: "#475569",
  consultant_doctor: "#1d4ed8",
  medical_officer: "#0d9488",
  intern_doctor: "#7c3aed",
  nurse: "#e11d48",
  staff: "#d97706",
  doctor: "#059669",
  assistant_registrar: "#10b981",
  registrar: "#15803d",
  assistant_professor: "#0284c7",
  associate_professor: "#4338ca",
  professor: "#7e22ce",
};

/** Active text color class per role */
export const STAFF_ROLE_TEXT_COLOR: Record<
  Exclude<StaffRole, "patient">,
  string
> = {
  admin: "text-slate-700",
  consultant_doctor: "text-blue-700",
  medical_officer: "text-teal-700",
  intern_doctor: "text-violet-700",
  nurse: "text-rose-700",
  staff: "text-amber-700",
  doctor: "text-emerald-700",
  assistant_registrar: "text-emerald-700",
  registrar: "text-green-700",
  assistant_professor: "text-sky-700",
  associate_professor: "text-indigo-700",
  professor: "text-purple-700",
};

/** VitalVerificationStatus for the vital review workflow */
export type VitalVerificationStatus =
  | "drafted"
  | "pendingMOReview"
  | "verifiedByMO"
  | "finalized"
  | "rejected";

export type Gender = "male" | "female" | "other";

export interface VitalSigns {
  bloodPressure?: string;
  pulse?: string;
  temperature?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  weight?: string;
  height?: string;
  [key: string]: string | undefined;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
  drugForm?: string;
  drugName?: string;
  route?: string;
  routeBn?: string;
  frequencyBn?: string;
  durationBn?: string;
  instructionsBn?: string;
  specialInstruction?: string;
  specialInstructionBn?: string;
  /** PRN (as-needed) drug — bypasses scheduled reminders */
  isPrn?: string; // "true" | "false" stored as string for index signature compat
  /** Condition for PRN drug, e.g. "if fever > 38°C" */
  prnCondition?: string;
  /** IV/IM dose format: 'single' | 'loading-maintenance' | 'infusion' */
  ivImDoseFormat?: string;
  /** Loading dose for IV/IM (e.g. "500mg IV") */
  loadingDose?: string;
  /** Maintenance dose (e.g. "250mg/6hrs") */
  maintenanceDose?: string;
  /** Infusion rate (e.g. "5") */
  infusionRate?: string;
  /** Infusion unit: 'mcg/kg/min' | 'mg/hr' */
  infusionUnit?: string;
  /** Whether this drug came from an emergency prescription auto-linked to inpatient */
  fromEmergencyRx?: string;
  /** Timestamp when auto-linked from emergency Rx */
  emergencyRxLinkedAt?: string;
  [key: string]: string | undefined;
}

export interface ConsultantAssignment {
  email: string;
  name: string;
  assignedAt: string; // ISO date
  assignedBy: string; // email of who assigned
}

export interface Patient {
  id: bigint;
  fullName: string;
  nameBn?: string;
  dateOfBirth?: bigint;
  gender: Gender;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  weight?: number;
  height?: number;
  allergies: string[];
  chronicConditions: string[];
  pastSurgicalHistory?: string;
  patientType: "outdoor" | "indoor" | "emergency" | "admitted";
  createdAt: bigint;
  registerNumber?: string;
  photo?: string;
  // Extended fields
  department?: string;
  bedNumber?: string;
  ward?: string;
  hospitalName?: string;
  admittedOn?: string; // ISO string of admission date
  admissionDate?: string;
  dischargeDate?: string;
  isAdmitted?: boolean;
  status?: "Admitted" | "Discharged" | "Active";
  signUpEnabled?: boolean;
  edd?: string; // Expected delivery date
  lmpDate?: string; // Last menstrual period
  consultantAssignment?: ConsultantAssignment;
  /** Whether patient has completed full registration (false for emergency quick-reg patients) */
  registrationComplete?: boolean;
  [key: string]: unknown;
}

export interface Visit {
  id: bigint;
  patientId: bigint;
  visitDate: bigint;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  vitalSigns: VitalSigns;
  physicalExamination?: string;
  diagnosis?: string;
  notes?: string;
  visitType:
    | "outpatient"
    | "inpatient"
    | "emergency"
    | "follow-up"
    | "admitted";
  createdAt: bigint;
  [key: string]: unknown;
}

export interface Prescription {
  id: bigint;
  patientId: bigint;
  visitId?: bigint;
  prescriptionDate: bigint;
  diagnosis?: string;
  medications: Medication[];
  notes?: string;
  createdAt: bigint;
  [key: string]: unknown;
}

export interface UserProfile {
  name: string;
  specialization?: string;
  phone?: string;
  email?: string;
  address?: string;
  photo?: string;
  [key: string]: unknown;
}

// Appointment type
export interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  phone: string;
  registerNumber?: string;
  age?: string;
  gender?: string;
  preferredDoctor: string;
  preferredChamber?: string;
  preferredDate: string;
  preferredTime: string;
  reason?: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  createdBy?: string;
  notes?: string;
  /** 'chamber' = outpatient | 'admitted' = inpatient */
  appointmentType: "chamber" | "admitted";
  /** Admitted-only fields */
  hospitalName?: string;
  bedWardNumber?: string;
  admissionReason?: string;
  referringDoctor?: string;
  /** Serial number assigned for the day */
  serialNumber?: number;
  /** Date the serial was assigned (YYYY-MM-DD) */
  serialDate?: string;
  /** Time set by doctor (admitted patients only) */
  visitTime?: string;
}

// Serial Queue
export interface SerialEntry {
  id: string;
  serialNumber: number;
  patientName: string;
  phone?: string;
  status: "waiting" | "current" | "done" | "skipped";
  addedAt: string;
  calledAt?: string;
}

// ── Clinical Data Engine Types ─────────────────────────────────────────────────

export interface VersionedRecord {
  version: number;
  createdAt: bigint;
  createdBy: Principal;
  createdByName: string;
  createdByRole: StaffRole;
  changeReason?: string;
}

export interface Encounter {
  id: bigint;
  patientId: bigint;
  encounterId: string;
  encounterType: "OPD" | "IPD" | "Emergency" | "FollowUp";
  status: "Planned" | "InProgress" | "Completed" | "Cancelled";
  startDate: bigint;
  endDate?: bigint;
  providerId: Principal;
  providerName: string;
  locationNotes?: string;
  versionInfo: VersionedRecord;
  previousVersions: VersionedRecord[];
}

export interface Observation {
  id: bigint;
  patientId: bigint;
  encounterId?: bigint;
  observationType:
    | "Vital"
    | "Lab"
    | "ExamFinding"
    | "IntakeOutput"
    | "DrainMonitoring";
  code: string;
  value: string;
  numericValue?: number;
  unit: string;
  interpretation?: string;
  normalRange?: string;
  status: "Preliminary" | "Final" | "Corrected";
  observationDate: bigint;
  recordedBy: Principal;
  recordedByName: string;
  recordedByRole: StaffRole;
  versionInfo: VersionedRecord;
  isDeleted: boolean;
}

export interface ClinicalOrder {
  id: bigint;
  patientId: bigint;
  encounterId?: bigint;
  orderType: "Medication" | "LabTest" | "Procedure" | "Investigation";
  code: string;
  description: string;
  status: "Requested" | "Pending" | "InProgress" | "Completed" | "Cancelled";
  orderedAt: bigint;
  orderedBy: Principal;
  orderedByName: string;
  orderedByRole: StaffRole;
  completedAt?: bigint;
  result?: string;
  notes?: string;
  versionInfo: VersionedRecord;
}

export interface ClinicalNote {
  id: bigint;
  patientId: bigint;
  encounterId?: bigint;
  noteType:
    | "SOAP"
    | "DailyProgress"
    | "Discharge"
    | "Nursing"
    | "Handover"
    | "General";
  noteSubtype?: string;
  authorId: Principal;
  authorName: string;
  authorRole: StaffRole;
  content: string; // JSON string for structured SOAP content
  isDraft: boolean;
  createdAt: bigint;
  versionInfo: VersionedRecord;
  previousVersionIds: bigint[];
  isDeleted: boolean;
}

export interface AuditEntry {
  id: bigint;
  entityType: string;
  entityId: bigint;
  fieldName: string;
  beforeValue?: string;
  afterValue: string;
  changedBy: Principal;
  changedByName: string;
  changedByRole: StaffRole;
  changedAt: bigint;
  reason?: string;
  ipAddress?: string;
}

export interface ClinicalAlert {
  id: bigint;
  patientId: bigint;
  alertType:
    | "Sepsis"
    | "AKI"
    | "Hypotension"
    | "Hypoxia"
    | "DrugInteraction"
    | "AllergyContraindication"
    | "CriticalLab"
    // Extended alert types
    | "SepticShock"
    | "ShockIndex"
    | "RespiratoryFailure"
    | "CardiacArrestRisk"
    | "Hyperkalemia"
    | "Hypokalemia"
    | "Hyponatremia"
    | "Hypernatremia"
    | "MetabolicAcidosis"
    | "HighAnionGap"
    | "QTProlongation"
    | "DrugContraindication"
    | "HypertensiveCrisis"
    | "Bradycardia"
    | "Tachycardia"
    | "HeartFailure"
    | "AsthmaExacerbation"
    | "COPDExacerbation"
    | "PERisk"
    | "Hypoglycemia"
    | "SevereHypoglycemia"
    | "Hyperglycemia"
    | "DKARisk"
    | "ThyroidStorm"
    | "MyxedemaComa"
    | "LowGCS"
    | "SeizureRisk"
    | "NeutropenicSepsis"
    | "AntibioticMismatch"
    | "MissedDose"
    | "OverdueInvestigation"
    | "DischargeRisk";
  severity: "Critical" | "Warning" | "Info";
  message: string;
  details?: string;
  triggeredAt: bigint;
  triggeredBy: string;
  isAcknowledged: boolean;
  acknowledgedBy?: Principal;
  acknowledgedAt?: bigint;
  isResolved: boolean;
  resolvedAt?: bigint;
}

// ── Extended Clinical Intelligence Types ──────────────────────────────────────

export interface ExtendedAlert {
  id: string;
  category:
    | "critical_emergency"
    | "renal_electrolyte"
    | "medication_safety"
    | "cardiovascular"
    | "respiratory"
    | "endocrine"
    | "neurology"
    | "infection_control"
    | "hospital_workflow";
  alertType: ClinicalAlert["alertType"];
  severity: "critical" | "warning" | "info";
  message: string;
  details: string;
  aiSuggestion?: string;
  triggeredAt: string;
}

export interface TrendAlert {
  id: string;
  metric: string;
  severity: "warning" | "info";
  message: string;
  details: string;
  trend: "rising" | "falling" | "stable";
}

export interface VitalReading {
  timestamp: string;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  spo2?: number;
  urineOutputMlKgHr?: number;
  gcs?: number;
}

export interface LabResult {
  timestamp: string;
  creatinine?: number;
  potassium?: number;
  sodium?: number;
  chloride?: number;
  bicarbonate?: number;
  ph?: number;
  glucose?: number;
  hemoglobin?: number;
  wbc?: number;
  neutrophils?: number;
  bnp?: number;
  lactate?: number;
  paco2?: number;
  anc?: number; // Absolute neutrophil count
}

export interface WorkflowData {
  medicationAdministrations?: Array<{
    drugName: string;
    scheduledTimes: string[];
    administeredTimes: string[];
    status: "given" | "not_given" | "delayed";
  }>;
  investigations?: Array<{
    name: string;
    orderedAt: string;
    status: "ordered" | "sample_collected" | "report_collected" | "completed";
  }>;
  isScheduledForDischarge?: boolean;
  hasActiveCriticalAlert?: boolean;
}

export interface ExtendedAlertInput {
  vitals?: {
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    spo2?: number;
    urineOutputMlKgHr?: number;
    gcs?: number;
    lactate?: number;
    paco2?: number;
    hasEdema?: boolean;
  };
  labs?: {
    creatinine?: number;
    creatininePrev?: number; // 48h ago
    potassium?: number;
    sodium?: number;
    chloride?: number;
    bicarbonate?: number;
    ph?: number;
    glucose?: number;
    wbc?: number;
    bnp?: number;
    neutrophils?: number;
    anc?: number;
  };
  medications?: Medication[];
  diagnoses?: string[]; // active diagnosis names (lowercase)
  allergies?: string[];
  peRiskFactors?: boolean; // immobility, recent surgery, DVT history
  workflowData?: WorkflowData;
}

// ── Admission History ─────────────────────────────────────────────────────────

export interface AdmissionHistory {
  id: string;
  patientId: string;
  admittedOn: string; // ISO string
  admittedBy: string; // doctor name
  admittedByRole: string;
  hospitalName: string;
  ward: string;
  bed: string;
  reasonForAdmission: string;
  carriedOverComplaints: string[];
  carriedOverDiagnosis: string[];
  carriedOverDrugHistory: string[];
  carriedOverPrescriptions: string[]; // prescription IDs
  admissionHistoryStatus: "complete" | "draft_awaiting_approval";
  dailyProgressNotes: unknown[];
  dischargedOn: string | null;
  status: "active" | "discharged";
  createdAt: string;
  consultantAssignment?: ConsultantAssignment;
}

export interface BedTransferEntry {
  fromBed: string;
  toBed: string;
  date: bigint;
  reason: string;
}

export type BedType =
  | "General"
  | "ICU"
  | "HDU"
  | "Isolation"
  | "Private"
  | "Cabin";

export interface BedRecord {
  id: bigint;
  bedNumber: string;
  ward: string;
  hospitalName: string;
  /** Floor/level within the hospital, e.g. "Ground Floor", "Floor 1", "ICU Level" */
  floor?: string;
  status: "Empty" | "Occupied" | "Maintenance" | "Reserved" | "Cleaning";
  /** Bed category/type determining special equipment and purpose */
  bedType?: BedType;
  patientId?: bigint;
  patientName?: string;
  admissionDate?: bigint;
  dischargeDate?: bigint;
  /** ISO timestamp string for when a reservation expires (2h default) */
  reservationExpiry?: string | null;
  /** Name of the patient the bed is reserved for */
  reservedForPatient?: string | null;
  /** Whether the discharge checklist was completed */
  dischargeChecklistCompleted?: boolean;
  /** ISO timestamp when discharge checklist was signed off */
  dischargeCheckedAt?: string;
  transferHistory: BedTransferEntry[];
}

export interface DiagnosisTemplate {
  id: bigint;
  diagnosisName: string;
  diagnosisNameBn?: string;
  icdCode?: string;
  defaultDrugs: string[];
  defaultInvestigations: string[];
  defaultAdvice: string[];
  defaultAdviceBn: string[];
  createdBy: Principal;
  createdAt: bigint;
  isActive: boolean;
}

export interface TrendData {
  vital: string;
  direction: "improving" | "worsening" | "stable";
  summary: string;
  dataPoints: Array<{ date: Date; value: number }>;
}

export interface ClinicalIntelligence {
  alerts: ClinicalAlert[];
  trends: TrendData[];
  pendingTasks: number;
  stableIndicators: string[];
}

export interface SyncRecord {
  id: bigint;
  userId: Principal;
  deviceId: string;
  lastSyncAt: bigint;
  pendingChanges: bigint;
  lastEntityType?: string;
  lastEntityId?: bigint;
}

// ── Investigation tracking types ───────────────────────────────────────────────

export interface InvestigationLink {
  investigationId: string;
  prescriptionId: string;
  linkedAt: string;
}

export type InvestigationStatusType =
  | "ordered"
  | "sample_collected"
  | "report_collected";

// ── Prescription Record (versioned, admitted / chamber) ───────────────────────

export type PrescriptionLabel = "Order on Admission" | "Fresh Order" | null;

export type PrescriptionStatus =
  | "active"
  | "draft_awaiting_approval"
  | "approved"
  | "changes_requested";

export type PrescriptionHeaderType = "hospital" | "chamber";

export interface PrescriptionRecord {
  id: string;
  patientId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  createdByRole: StaffRole;
  label: PrescriptionLabel;
  labelTimestamp?: string;
  headerType: PrescriptionHeaderType;
  status: PrescriptionStatus;
  diagnosis?: string;
  drugs: unknown[];
  adviceText?: string;
  clinicalSummary?: Record<string, string>;
  approvalComment?: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Finalization timestamp for active (non-draft) prescriptions */
  finalizedAt?: string;
  /** Legacy prescription id link (from original Prescription.id) */
  linkedPrescriptionId?: string;
}

// ── Drug Reminder ──────────────────────────────────────────────────────────────

// ── Money Receipt ─────────────────────────────────────────────────────────────

export interface InvestigationRate {
  id: string;
  name: string;
  rate: number;
  discountRate?: number; // percentage, default 0
}

export interface InvestigationLineItem {
  name: string;
  qty: number;
  unitRate: number;
  amount: number;
}

export type PaymentMethod = "cash" | "bkash" | "nagad" | "card";

export type InvoiceState =
  | "invoice"
  | "paid"
  | "partial"
  | "refunded"
  | "partial_refunded";

export interface RefundRecord {
  refundId: string;
  amount: number;
  reason: "wrong_charge" | "cancellation" | "duplicate_payment" | "other";
  date: string; // ISO
  refundedBy?: string;
  notes?: string;
}

export interface MoneyReceiptData {
  id: string;
  receiptNumber: string;
  type: "appointment" | "procedure" | "investigation" | "other";
  patientName: string;
  registerNumber?: string;
  phone?: string;
  doctorName?: string;
  service: string;
  amount: number;
  paid: boolean;
  date: string; // ISO string
  notes?: string;
  serialNumber?: number;
  /** Investigation / procedure receipt fields */
  investigations?: InvestigationLineItem[];
  discountRate?: number; // percentage applied to subtotal
  finalAmount?: number; // amount after discount
  patientId?: string;
  /** Payment method — required on every receipt */
  paymentMethod?: PaymentMethod;
  /** Invoice/payment lifecycle state */
  invoiceState?: InvoiceState;
  /** Partial payment tracking */
  amountPaid?: number;
  dueAmount?: number;
  /** Refund details */
  refund?: RefundRecord;
  /** Walk-in / investigation-specific patient fields */
  patientAge?: number;
  patientSex?: "Male" | "Female" | "Other";
  investigationDate?: string; // ISO date string
  reportDeliveryDate?: string; // ISO date string
}

export interface DrugReminder {
  id: string;
  patientId: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  startDate: string;
  prescriptionId?: string;
  status: "active" | "paused" | "completed";
  reminderTimes: string[];
  lastModified: string;
}

// ── New Feature Types (History & Prescription) ────────────────────────────────

/**
 * Vaccination record for structured immunization history.
 * isOverdue is computed at runtime via isVaccineOverdue() in clinicalUtils.ts.
 */
export interface VaccinationRecord {
  id: string;
  vaccineName: string;
  dateGiven?: string; // ISO date string
  dueDate?: string; // ISO date string
  givenBy?: string;
  batchNo?: string;
  isCustom?: boolean;
  /** Stored as computed cache — recompute with isVaccineOverdue() for accuracy */
  isOverdue?: boolean;
}

/**
 * Structured family history risk flags for common hereditary conditions.
 * Generates a risk badge visible in patient overview and prescription header.
 */
export interface FamilyHistoryRisk {
  diabetes: boolean;
  hypertension: boolean;
  ihd: boolean;
  cancer: boolean;
  stroke: boolean;
  additionalNotes?: string;
}

/**
 * Immutable clinical summary snapshot locked at prescription finalization.
 * Stored separately so editing a visit does NOT retroactively alter the
 * finalized prescription's clinical context.
 */
export interface PrescriptionSnapshot {
  lockedAt: number; // Unix timestamp (ms)
  lockedBy: string; // doctorEmail
  chiefComplaint: string;
  pastHistory: string;
  onExamination: string;
  diagnosis: string;
  investigations: string[];
}

/**
 * Reason a drug was discontinued — required field when removing a drug
 * from an active prescription to maintain a medico-legal trail.
 */
export type DrugDiscontinuationReason =
  | "course_complete"
  | "side_effect"
  | "patient_refused"
  | "alternative_started"
  | "other";

/**
 * Extended Medication that adds dispensing, discontinuation, and override
 * metadata on top of the base Medication type.
 *
 * Cannot use `extends Medication` directly because Medication has a
 * `[key: string]: string | undefined` index signature — numeric fields
 * would violate it. We compose instead: spread all Medication string fields
 * and add typed meta fields in a separate namespace.
 */
export interface MedicationWithMeta {
  // ── All Medication string fields (mirrored for type safety) ────────────────
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
  drugForm?: string;
  drugName?: string;
  route?: string;
  routeBn?: string;
  frequencyBn?: string;
  durationBn?: string;
  instructionsBn?: string;
  specialInstruction?: string;
  specialInstructionBn?: string;
  isPrn?: string;
  prnCondition?: string;
  [key: string]: unknown; // broader index signature to allow mixed types
  // ── Meta fields ────────────────────────────────────────────────────────────
  dispensedAs?: "brand" | "generic" | "substituted";
  substitutedBrand?: string;
  discontinuationReason?: DrugDiscontinuationReason;
  /** Unix timestamp (ms) when drug was discontinued */
  discontinuedAt?: number;
  /** Email of doctor who discontinued the drug */
  discontinuedBy?: string;
}

/**
 * Complaint trend entry — tracks how a chief complaint evolved across visits.
 */
export interface ComplaintTrendEntry {
  complaintName: string;
  firstAppeared: number; // Unix timestamp (ms)
  firstVisitId: string;
  severityHistory: {
    date: number; // Unix timestamp (ms)
    severity: "mild" | "moderate" | "severe" | "resolved";
    visitId: string;
  }[];
  currentStatus: "active" | "resolved";
}

/**
 * Diff between two consecutive prescriptions — highlights medication changes.
 */
export interface PrescriptionDiff {
  addedDrugs: string[];
  removedDrugs: { name: string; reason?: DrugDiscontinuationReason }[];
  doseChanges: { name: string; oldDose: string; newDose: string }[];
}

/**
 * Record of a clinician overriding an allergy alert to still prescribe the drug.
 * Stored in audit trail and surfaced to admin/consultant.
 */
export interface AllergyOverrideRecord {
  drugName: string;
  overriddenBy: string; // doctorEmail
  overriddenAt: number; // Unix timestamp (ms)
  justification: string;
  prescriptionId: string;
}

// ── Prescription type augmentation ───────────────────────────────────────────
// These fields extend the core Prescription interface via module augmentation.
// Re-declare the extended version as PrescriptionExtended for use in new components.

export interface PrescriptionExtended extends Prescription {
  /** Locked clinical context snapshot — set on finalization, never mutated */
  finalizedSnapshot?: PrescriptionSnapshot;
  /** Unix timestamp (ms) when patient first opened/downloaded this prescription */
  viewedByPatientAt?: number;
  /** Follow-up date — auto-creates an appointment when set */
  followUpDate?: number; // Unix timestamp (ms)
  /** Medications with full meta (dispensing, discontinuation) */
  medicationsWithMeta?: MedicationWithMeta[];
}

// ── Staff Management Types ─────────────────────────────────────────────────────

export type ShiftType = "morning" | "evening" | "night";

export interface StaffShift {
  id: string;
  staffId: string;
  staffName: string;
  shiftType: ShiftType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  ward: string;
  createdBy: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  loginTime: string; // HH:MM
  logoutTime?: string; // HH:MM
  shiftStatus: "present" | "late" | "absent";
  manualOverride?: boolean;
  overrideNote?: string;
}
