import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AuditEntry {
    id: bigint;
    changedByName: string;
    changedByRole: StaffRole;
    changedAt: bigint;
    changedBy: Principal;
    entityId: bigint;
    afterValue: string;
    beforeValue?: string;
    entityType: string;
    fieldName: string;
    ipAddress?: string;
    reason?: string;
}
export interface Encounter {
    id: bigint;
    status: EncounterStatus;
    encounterType: EncounterType;
    endDate?: bigint;
    patientId: bigint;
    previousVersions: Array<VersionedRecord>;
    providerName: string;
    providerId: Principal;
    versionInfo: VersionedRecord;
    encounterId: string;
    locationNotes?: string;
    startDate: bigint;
}
export interface AdmissionRecord {
    id: bigint;
    bed: string;
    status: AdmissionStatus;
    consultantEmail: string;
    admittedAt: bigint;
    admittedBy: Principal;
    patientId: bigint;
    ward: string;
    updatedAt: bigint;
    dischargedAt?: bigint;
    admittedByRole: StaffRole;
    department: string;
}
export interface MedicationAdministration {
    id: bigint;
    status: MedicationAdministrationStatus;
    medicationName: string;
    patientId: bigint;
    scheduledTime: bigint;
    dose: string;
    createdAt: bigint;
    recordedBy: string;
    updatedAt: bigint;
    recordedByRole: string;
    administeredAt?: bigint;
    missedReason?: string;
}
export interface ClinicalNote {
    id: bigint;
    isDeleted: boolean;
    content: string;
    patientId: bigint;
    authorId: Principal;
    createdAt: bigint;
    authorName: string;
    authorRole: StaffRole;
    noteType: NoteType;
    isDraft: boolean;
    previousVersionIds: Array<bigint>;
    versionInfo: VersionedRecord;
    encounterId?: bigint;
    noteSubtype?: string;
}
export interface Observation {
    id: bigint;
    status: ObservationStatus;
    enteredByRole?: StaffRole;
    isDeleted: boolean;
    numericValue?: number;
    vitalVerificationStatus?: VitalVerificationStatus;
    value: string;
    observationDate: bigint;
    patientId: bigint;
    observationType: ObservationType;
    code: string;
    unit: string;
    rejectionReason?: string;
    recordedBy: Principal;
    normalRange?: string;
    recordedByName: string;
    recordedByRole: StaffRole;
    interpretation?: string;
    versionInfo: VersionedRecord;
    encounterId?: bigint;
    verifiedAt?: bigint;
    verifiedBy?: Principal;
    enteredBy?: Principal;
}
export interface VitalsSummary {
    bp?: string;
    rr?: string;
    rbs?: string;
    spo2?: string;
    temp?: string;
    recordedAt: bigint;
    pulse?: string;
}
export interface BedRecord {
    id: bigint;
    status: BedStatus;
    patientId?: bigint;
    admissionDate?: bigint;
    transferHistory: Array<BedTransferEntry>;
    ward: string;
    bedNumber: string;
    updatedAt: bigint;
    patientName?: string;
    dischargeDate?: bigint;
}
export interface BedTransferEntry {
    toBed: string;
    date: bigint;
    fromBed: string;
    reason: string;
}
export interface WardRoundPatientStatus {
    admissionDay: bigint;
    patientId: string;
    todayNoteState?: string;
    assignedConsultant?: string;
    ward: string;
    bedNumber: string;
    activeAlerts: Array<string>;
    patientName: string;
    lastVitals?: VitalsSummary;
}
export interface DailyProgressNoteUpdate {
    moAssessment: string;
    drainMonitoring?: string;
    internObjective: string;
    consultantComments: string;
    consultantOverrides: string;
    objectiveVitals?: string;
    assessmentText: string;
    subjectiveComplaints: Array<string>;
    activeDiagnoses: Array<string>;
    internSubjective: string;
    activeComplaints: Array<string>;
    moPlan: string;
    planText: string;
    systemReview?: string;
    intakeOutput?: string;
    investigations: Array<string>;
}
export interface ClinicalAlert {
    id: bigint;
    alertType: AlertType;
    acknowledgedAt?: bigint;
    acknowledgedBy?: Principal;
    patientId: bigint;
    isAcknowledged: boolean;
    isResolved: boolean;
    triggeredAt: bigint;
    triggeredBy: string;
    message: string;
    details?: string;
    severity: AlertSeverity;
    resolvedAt?: bigint;
}
export interface Appointment {
    id: string;
    status: AppointmentStatus;
    patientId?: bigint;
    date: string;
    createdAt: bigint;
    chamberName?: string;
    registerNumber?: string;
    appointmentType: AppointmentType;
    updatedAt: bigint;
    serialNumber?: bigint;
    notes?: string;
    patientName: string;
    hospitalName?: string;
    phone?: string;
    doctorEmail: string;
    timeSlot?: string;
}
export interface SerialQueueEntry {
    id: string;
    status: QueueStatus;
    date: string;
    createdAt: bigint;
    registerNumber?: string;
    calledAt?: bigint;
    updatedAt: bigint;
    serialNumber: bigint;
    patientName: string;
    phone?: string;
    doctorEmail: string;
}
export interface UserProfile {
    name: string;
}
export type Time = bigint;
export interface Medication__1 {
    duration: string;
    dose: string;
    name: string;
    prnCondition?: string;
    instructions?: string;
    frequency: string;
    isPRN: boolean;
    route: string;
}
export interface RoleChangeEntry {
    id: bigint;
    principal: Principal;
    changedBy: Principal;
    timestamp: bigint;
    previousRole?: StaffRole;
    newRole: StaffRole;
}
export interface ClinicalOrder {
    id: bigint;
    status: OrderStatus;
    completedAt?: bigint;
    result?: string;
    patientId: bigint;
    code: string;
    description: string;
    orderType: OrderType;
    orderedAt: bigint;
    orderedBy: Principal;
    notes?: string;
    orderedByName: string;
    orderedByRole: StaffRole;
    versionInfo: VersionedRecord;
    encounterId?: bigint;
}
export interface Patient {
    id: bigint;
    weight?: number;
    height?: number;
    consultantEmail?: string;
    nameBn?: string;
    consultantName?: string;
    dateOfBirth?: Time;
    createdAt: Time;
    fullName: string;
    email?: string;
    updatedAt: Time;
    pastSurgicalHistory?: string;
    bloodGroup?: string;
    address?: string;
    gender: Gender;
    patientType: PatientType;
    chronicConditions: Array<string>;
    phone?: string;
    allergies: Array<string>;
}
export interface CurrentUser {
    principal: Principal;
    role: UserRole;
}
export interface VersionedRecord {
    createdAt: bigint;
    createdBy: Principal;
    version: bigint;
    createdByName: string;
    createdByRole: StaffRole;
    changeReason?: string;
}
export interface SyncRecord {
    id: bigint;
    lastEntityType?: string;
    userId: Principal;
    pendingChanges: bigint;
    deviceId: string;
    lastSyncAt: bigint;
    lastEntityId?: bigint;
}
export interface Prescription__1 {
    id: bigint;
    isDeleted: boolean;
    patientId: bigint;
    followUpCreatesAppointment: boolean;
    authorId: Principal;
    createdAt: bigint;
    authorName: string;
    authorRole: StaffRole;
    diagnoses: Array<string>;
    isDraft: boolean;
    isFinalized: boolean;
    updatedAt: bigint;
    medications: Array<Medication__1>;
    advice: Array<string>;
    versionInfo: VersionedRecord;
    encounterId?: bigint;
    followUpDate?: bigint;
}
export interface VitalSigns {
    respiratoryRate?: string;
    temperature?: string;
    bloodPressure?: string;
    oxygenSaturation?: string;
    pulse?: string;
}
export interface HandoverEntry {
    id: bigint;
    status: HandoverStatus;
    takenByName?: string;
    takenByRole?: StaffRole;
    clinicalSummary: string;
    currentConsultant?: string;
    consultantComment?: string;
    patientId: bigint;
    dayOfStay?: bigint;
    createdAt: bigint;
    ward?: string;
    pendingInvestigations: Array<string>;
    vitalsSummary?: string;
    bedNumber?: string;
    registerNumber?: string;
    diagnosis?: string;
    missedMedications: Array<string>;
    shift: HandoverShift;
    updatedAt: bigint;
    givenByPrincipal: Principal;
    givenByName: string;
    consultantCommentAt?: bigint;
    consultantCommentBy?: Principal;
    givenByRole: StaffRole;
    takenByPrincipal?: Principal;
    patientName: string;
    shiftEndTime: bigint;
    pendingProcedures: Array<string>;
    tasksPending: Array<string>;
    versionInfo: VersionedRecord;
    shiftStartTime: bigint;
    actionableItems: Array<string>;
}
export interface Visit {
    id: bigint;
    vitalSigns: VitalSigns;
    patientId: bigint;
    createdAt: Time;
    visitDate: Time;
    visitType: VisitType;
    diagnosis?: string;
    updatedAt: Time;
    historyOfPresentIllness?: string;
    notes?: string;
    physicalExamination?: string;
    chiefComplaint: string;
}
export interface DiagnosisTemplate {
    id: bigint;
    createdAt: bigint;
    createdBy: Principal;
    icdCode?: string;
    isActive: boolean;
    defaultDrugs: Array<string>;
    defaultAdvice: Array<string>;
    defaultInvestigations: Array<string>;
    diagnosisNameBn?: string;
    diagnosisName: string;
    defaultAdviceBn: Array<string>;
}
export interface SyncData {
    queueEntries: Array<SerialQueueEntry>;
    appointments: Array<Appointment>;
    timestamp: bigint;
}
export interface DailyProgressNote {
    id: bigint;
    moAssessment: string;
    isDeleted: boolean;
    drainMonitoring?: string;
    internObjective: string;
    patientId: bigint;
    authorId: Principal;
    consultantComments: string;
    submittedByRole?: StaffRole;
    consultantOverrides: string;
    createdAt: bigint;
    authorName: string;
    reviewedByMO?: string;
    authorRole: StaffRole;
    noteDate: string;
    rejectionReason?: string;
    objectiveVitals?: string;
    assessmentText: string;
    subjectiveComplaints: Array<string>;
    isDraft: boolean;
    updatedAt: bigint;
    activeDiagnoses: Array<string>;
    internSubjective: string;
    progressType: DailyProgressType;
    activeComplaints: Array<string>;
    moPlan: string;
    noteState: DailyNoteState;
    previousVersionIds: Array<bigint>;
    reviewedByConsultant?: string;
    versionChain: Array<string>;
    versionInfo: VersionedRecord;
    submitTimestamp?: bigint;
    encounterId?: bigint;
    planText: string;
    systemReview?: string;
    intakeOutput?: string;
    investigations: Array<string>;
}
export interface Prescription {
    id: bigint;
    patientId: bigint;
    createdAt: Time;
    diagnosis?: string;
    prescriptionDate: Time;
    updatedAt: Time;
    medications: Array<Medication>;
    notes?: string;
    visitId?: bigint;
}
export interface UpdatedData {
    queueEntries: Array<SerialQueueEntry>;
    appointments: Array<Appointment>;
    timestamp: bigint;
    patients: Array<bigint>;
}
export interface Medication {
    duration: string;
    dose: string;
    name: string;
    instructions: string;
    frequency: string;
}
export enum AdmissionStatus {
    discharged = "discharged",
    admitted = "admitted",
    transferred = "transferred"
}
export enum AlertSeverity {
    Info = "Info",
    Critical = "Critical",
    Warning = "Warning"
}
export enum AlertType {
    AKI = "AKI",
    Hypotension = "Hypotension",
    CriticalLab = "CriticalLab",
    Sepsis = "Sepsis",
    DrugInteraction = "DrugInteraction",
    Hypoxia = "Hypoxia",
    MissedDoseEscalation = "MissedDoseEscalation",
    AllergyContraindication = "AllergyContraindication"
}
export enum AppointmentStatus {
    cancelled = "cancelled",
    pending = "pending",
    completed = "completed",
    confirmed = "confirmed"
}
export enum AppointmentType {
    hospital = "hospital",
    chamber = "chamber"
}
export enum BedStatus {
    Empty = "Empty",
    Maintenance = "Maintenance",
    Occupied = "Occupied"
}
export enum DailyNoteState {
    submittedToMO = "submittedToMO",
    finalized = "finalized",
    rejected = "rejected",
    moReviewComplete = "moReviewComplete",
    draft = "draft"
}
export enum DailyProgressType {
    morning = "morning",
    evening = "evening",
    emergency = "emergency"
}
export enum EncounterStatus {
    Planned = "Planned",
    Cancelled = "Cancelled",
    InProgress = "InProgress",
    Completed = "Completed"
}
export enum EncounterType {
    IPD = "IPD",
    OPD = "OPD",
    FollowUp = "FollowUp",
    Emergency = "Emergency"
}
export enum Gender {
    other = "other",
    female = "female",
    male = "male"
}
export enum HandoverShift {
    morning = "morning",
    evening = "evening",
    night = "night"
}
export enum HandoverStatus {
    submitted = "submitted",
    draft = "draft"
}
export enum MedicationAdministrationStatus {
    Given = "Given",
    Delayed = "Delayed",
    NotGiven = "NotGiven"
}
export enum NoteType {
    SOAP = "SOAP",
    Nursing = "Nursing",
    DailyProgress = "DailyProgress",
    General = "General",
    Handover = "Handover",
    Discharge = "Discharge"
}
export enum ObservationStatus {
    Corrected = "Corrected",
    Final = "Final",
    Preliminary = "Preliminary"
}
export enum ObservationType {
    Lab = "Lab",
    ExamFinding = "ExamFinding",
    DrainMonitoring = "DrainMonitoring",
    IntakeOutput = "IntakeOutput",
    Vital = "Vital"
}
export enum OrderStatus {
    Requested = "Requested",
    Cancelled = "Cancelled",
    InProgress = "InProgress",
    Completed = "Completed",
    Pending = "Pending"
}
export enum OrderType {
    Medication = "Medication",
    Procedure = "Procedure",
    Investigation = "Investigation",
    LabTest = "LabTest"
}
export enum PatientType {
    admitted = "admitted",
    outdoor = "outdoor"
}
export enum QueueStatus {
    serving = "serving",
    skipped = "skipped",
    done = "done",
    waiting = "waiting"
}
export enum StaffRole {
    assistant_registrar = "assistant_registrar",
    professor = "professor",
    patient = "patient",
    admin = "admin",
    doctor = "doctor",
    medical_officer = "medical_officer",
    intern_doctor = "intern_doctor",
    associate_professor = "associate_professor",
    assistant_professor = "assistant_professor",
    consultant_doctor = "consultant_doctor",
    staff = "staff",
    nurse = "nurse",
    registrar = "registrar"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum VitalVerificationStatus {
    pendingMOReview = "pendingMOReview",
    verifiedByMO = "verifiedByMO",
    finalized = "finalized",
    rejected = "rejected",
    drafted = "drafted"
}
export interface backendInterface {
    acknowledgeAlert(id: bigint): Promise<{
        __kind__: "ok";
        ok: ClinicalAlert;
    } | {
        __kind__: "err";
        err: string;
    }>;
    acknowledgeHandover(id: bigint): Promise<{
        __kind__: "ok";
        ok: HandoverEntry;
    } | {
        __kind__: "err";
        err: string;
    }>;
    acknowledgeObservationCorrection(id: bigint, newValue: string, reason: string): Promise<{
        __kind__: "ok";
        ok: Observation;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addAuditEntry(entityType: string, entityId: bigint, fieldName: string, beforeValue: string | null, afterValue: string, reason: string | null): Promise<void>;
    addNoteAddendum(patientId: bigint, noteId: bigint, addendumText: string): Promise<{
        __kind__: "ok";
        ok: DailyProgressNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    approveDischarge(admissionId: bigint): Promise<{
        __kind__: "ok";
        ok: AdmissionRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignBed(bedId: bigint, patientId: bigint, patientName: string): Promise<{
        __kind__: "ok";
        ok: BedRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    assignConsultant(patientId: bigint, consultantEmail: string, consultantName: string): Promise<Patient>;
    bulkUpsertAppointments(appts: Array<Appointment>): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    bulkUpsertBeds(beds: Array<BedRecord>): Promise<Array<BedRecord>>;
    bulkUpsertDailyProgressNotes(notes: Array<DailyProgressNote>): Promise<Array<DailyProgressNote>>;
    bulkUpsertHandovers(handovers: Array<HandoverEntry>): Promise<Array<HandoverEntry>>;
    bulkUpsertMedicationAdministrations(records: Array<MedicationAdministration>): Promise<Array<MedicationAdministration>>;
    bulkUpsertObservations(obs: Array<Observation>): Promise<Array<Observation>>;
    bulkUpsertPatients(pats: Array<Patient>): Promise<Array<Patient>>;
    bulkUpsertPrescriptions(prescs: Array<Prescription>): Promise<Array<Prescription>>;
    bulkUpsertQueueEntries(entries: Array<SerialQueueEntry>): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    bulkUpsertVisits(vs: Array<Visit>): Promise<Array<Visit>>;
    clearQueueByDate(date: string, doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createAdmission(patientId: bigint, consultantEmail: string, bed: string, ward: string, department: string): Promise<{
        __kind__: "ok";
        ok: AdmissionRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createAppointment(id: string, patientId: bigint | null, patientName: string, registerNumber: string | null, phone: string | null, appointmentType: AppointmentType, chamberName: string | null, hospitalName: string | null, date: string, timeSlot: string | null, status: AppointmentStatus, doctorEmail: string, serialNumber: bigint | null, notes: string | null): Promise<{
        __kind__: "ok";
        ok: Appointment;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createBedRecord(bedNumber: string, ward: string): Promise<{
        __kind__: "ok";
        ok: BedRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createClinicalAlert(patientId: bigint, alertType: AlertType, severity: AlertSeverity, message: string, details: string | null): Promise<{
        __kind__: "ok";
        ok: ClinicalAlert;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createClinicalNote(patientId: bigint, encounterId: bigint | null, noteType: NoteType, noteSubtype: string | null, content: string, isDraft: boolean): Promise<{
        __kind__: "ok";
        ok: ClinicalNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createClinicalPrescription(patientId: bigint, encounterId: bigint | null, medications: Array<Medication__1>, diagnoses: Array<string>, advice: Array<string>, followUpDate: bigint | null, followUpCreatesAppointment: boolean, isDraft: boolean): Promise<{
        __kind__: "ok";
        ok: Prescription__1;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createDailyProgressNote(patientId: bigint, encounterId: bigint | null, progressType: DailyProgressType, noteDate: string, subjectiveComplaints: Array<string>, systemReview: string | null, objectiveVitals: string | null, intakeOutput: string | null, drainMonitoring: string | null, investigations: Array<string>, assessmentText: string, planText: string, activeComplaints: Array<string>, activeDiagnoses: Array<string>, isDraft: boolean): Promise<{
        __kind__: "ok";
        ok: DailyProgressNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createDiagnosisTemplate(diagnosisName: string, diagnosisNameBn: string | null, icdCode: string | null, defaultDrugs: Array<string>, defaultInvestigations: Array<string>, defaultAdvice: Array<string>, defaultAdviceBn: Array<string>): Promise<{
        __kind__: "ok";
        ok: DiagnosisTemplate;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createEncounter(patientId: bigint, encounterType: EncounterType, locationNotes: string | null): Promise<{
        __kind__: "ok";
        ok: Encounter;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createFollowUpAppointment(prescriptionId: bigint, followUpDate: bigint, patientId: bigint, patientName: string, doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: Appointment;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createHandover(patientId: bigint, shift: HandoverShift, shiftStartTime: bigint, shiftEndTime: bigint, patientName: string, registerNumber: string | null, ward: string | null, bedNumber: string | null, diagnosis: string | null, dayOfStay: bigint | null, currentConsultant: string | null, clinicalSummary: string, vitalsSummary: string | null, actionableItems: Array<string>, tasksPending: Array<string>, pendingInvestigations: Array<string>, pendingProcedures: Array<string>, missedMedications: Array<string>): Promise<{
        __kind__: "ok";
        ok: HandoverEntry;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createObservation(patientId: bigint, encounterId: bigint | null, observationType: ObservationType, code: string, value: string, numericValue: number | null, unit: string, interpretation: string | null, normalRange: string | null, observationDate: bigint): Promise<{
        __kind__: "ok";
        ok: Observation;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createOrder(patientId: bigint, encounterId: bigint | null, orderType: OrderType, code: string, description: string, notes: string | null): Promise<{
        __kind__: "ok";
        ok: ClinicalOrder;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createPatient(fullName: string, nameBn: string | null, dateOfBirth: Time | null, gender: Gender, phone: string | null, email: string | null, address: string | null, bloodGroup: string | null, weight: number | null, height: number | null, allergies: Array<string>, chronicConditions: Array<string>, pastSurgicalHistory: string | null, patientType: PatientType, consultantEmail: string | null, consultantName: string | null): Promise<Patient>;
    createPrescription(patientId: bigint, visitId: bigint | null, prescriptionDate: Time, diagnosis: string | null, medications: Array<Medication>, notes: string | null): Promise<Prescription>;
    createQueueEntry(id: string, date: string, serialNumber: bigint, patientName: string, registerNumber: string | null, phone: string | null, status: QueueStatus, calledAt: bigint | null, doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: SerialQueueEntry;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createVisit(patientId: bigint, visitDate: Time, chiefComplaint: string, historyOfPresentIllness: string | null, vitalSigns: VitalSigns, physicalExamination: string | null, diagnosis: string | null, notes: string | null, visitType: VisitType): Promise<Visit>;
    deleteAppointment(id: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deletePatient(id: bigint): Promise<void>;
    deletePrescription(id: bigint): Promise<void>;
    deleteQueueEntry(id: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteVisit(id: bigint): Promise<void>;
    dischargeBed(bedId: bigint): Promise<{
        __kind__: "ok";
        ok: BedRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    dismissAlert(id: bigint): Promise<{
        __kind__: "ok";
        ok: ClinicalAlert;
    } | {
        __kind__: "err";
        err: string;
    }>;
    finalizeClinicalPrescription(id: bigint): Promise<{
        __kind__: "ok";
        ok: Prescription__1;
    } | {
        __kind__: "err";
        err: string;
    }>;
    finalizeDailyNote(patientId: bigint, noteId: bigint, consultantEmail: string, consultantComments: string, finalSOAP: DailyProgressNoteUpdate): Promise<{
        __kind__: "ok";
        ok: DailyProgressNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    finalizeNote(id: bigint): Promise<{
        __kind__: "ok";
        ok: ClinicalNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getActiveAlerts(patientId: bigint): Promise<Array<ClinicalAlert>>;
    getActiveOrdersByPatient(patientId: bigint): Promise<Array<ClinicalOrder>>;
    getAlertsByPatient(patientId: bigint): Promise<Array<ClinicalAlert>>;
    getAllAdmittedPatients(consultantEmail: string | null, ward: string | null, bed: string | null, department: string | null, admissionStatus: string | null): Promise<{
        __kind__: "ok";
        ok: Array<AdmissionRecord>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllAppointmentsByDoctor(doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: Array<Appointment>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllAuditEntries(limit: bigint, offset: bigint): Promise<Array<AuditEntry>>;
    getAllBeds(): Promise<Array<BedRecord>>;
    getAllBedsSince(sinceTimestamp: bigint): Promise<Array<BedRecord>>;
    getAllDiagnosisTemplates(): Promise<Array<DiagnosisTemplate>>;
    getAllEncounters(): Promise<Array<Encounter>>;
    getAllHandoversSince(sinceTimestamp: bigint): Promise<Array<HandoverEntry>>;
    getAllMedicationAdministrationsSince(sinceTimestamp: bigint): Promise<Array<MedicationAdministration>>;
    getAllObservationsSince(sinceTimestamp: bigint): Promise<Array<Observation>>;
    getAllPatients(): Promise<Array<Patient>>;
    getAllPatientsSince(sinceTimestamp: bigint): Promise<Array<Patient>>;
    getAllPrescriptions(): Promise<Array<Prescription>>;
    getAllPrescriptionsSince(sinceTimestamp: bigint): Promise<Array<Prescription>>;
    getAllRoleChanges(): Promise<{
        __kind__: "ok";
        ok: Array<RoleChangeEntry>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllVisits(): Promise<Array<Visit>>;
    getAllVisitsSince(sinceTimestamp: bigint): Promise<Array<Visit>>;
    getAppointmentById(id: string): Promise<{
        __kind__: "ok";
        ok: Appointment | null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAppointmentsByDoctor(doctorEmail: string, date: string): Promise<{
        __kind__: "ok";
        ok: Array<Appointment>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAppointmentsSince(doctorEmail: string, sinceTimestamp: bigint): Promise<{
        __kind__: "ok";
        ok: Array<Appointment>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAuditLog(patientId: bigint, limit: bigint, offset: bigint): Promise<Array<AuditEntry>>;
    getAuditTrail(patientId: bigint, limit: bigint, offset: bigint): Promise<Array<AuditEntry>>;
    getAvailableBeds(): Promise<Array<BedRecord>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClinicalNotesByPatient(patientId: bigint): Promise<Array<ClinicalNote>>;
    getClinicalNotesByType(patientId: bigint, noteType: NoteType): Promise<Array<ClinicalNote>>;
    getClinicalPrescriptionsAwaitingApproval(): Promise<Array<Prescription__1>>;
    getClinicalPrescriptionsByPatient(patientId: bigint): Promise<Array<Prescription__1>>;
    getCurrentUser(): Promise<CurrentUser>;
    getDailyNotesByPatient(patientId: bigint, dateFilter: string | null): Promise<Array<DailyProgressNote>>;
    getDailyProgressNotesByPatientId(patientId: bigint): Promise<Array<DailyProgressNote>>;
    getDailyProgressNotesSince(sinceTimestamp: bigint): Promise<Array<DailyProgressNote>>;
    getDiagnosisTemplate(id: bigint): Promise<DiagnosisTemplate | null>;
    getEmailIndex(): Promise<{
        __kind__: "ok";
        ok: Array<[string, Principal]>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getEncountersByPatient(patientId: bigint): Promise<Array<Encounter>>;
    getFrontPageContent(): Promise<string | null>;
    getFullSyncData(doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: SyncData;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getHandover(id: bigint): Promise<HandoverEntry | null>;
    getHandoversByPatientId(patientId: bigint): Promise<Array<HandoverEntry>>;
    getLastSyncTime(deviceId: string): Promise<bigint | null>;
    getLastSyncTimestamp(): Promise<bigint>;
    getMedicationAdministrationsByPatient(patientId: bigint): Promise<Array<MedicationAdministration>>;
    getNotesAwaitingApproval(): Promise<Array<ClinicalNote>>;
    getObservationsByPatient(patientId: bigint): Promise<Array<Observation>>;
    getObservationsByType(patientId: bigint, observationType: ObservationType): Promise<Array<Observation>>;
    getOccupiedBeds(): Promise<Array<BedRecord>>;
    getOrdersByPatient(patientId: bigint): Promise<Array<ClinicalOrder>>;
    getPatient(id: bigint): Promise<Patient | null>;
    getPrescription(id: bigint): Promise<Prescription | null>;
    getPrescriptionsByPatientId(patientId: bigint): Promise<Array<Prescription>>;
    getPrescriptionsByVisitId(visitId: bigint): Promise<Array<Prescription>>;
    getQueueByDateAndDoctor(date: string, doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: Array<SerialQueueEntry>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getQueueEntriesSince(doctorEmail: string, sinceTimestamp: bigint): Promise<{
        __kind__: "ok";
        ok: Array<SerialQueueEntry>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getRoleChangeHistory(principal: Principal): Promise<Array<RoleChangeEntry>>;
    getServerTimestamp(): Promise<bigint>;
    getUnacknowledgedAlerts(): Promise<Array<ClinicalAlert>>;
    getUpdatedData(doctorEmail: string, sinceTimestamp: bigint): Promise<{
        __kind__: "ok";
        ok: UpdatedData;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVisit(id: bigint): Promise<Visit | null>;
    getVisitsByPatientId(patientId: bigint): Promise<Array<Visit>>;
    getVitalsForVerification(): Promise<Array<Observation>>;
    getWardRoundStatus(date: string): Promise<Array<WardRoundPatientStatus>>;
    isCallerAdmin(): Promise<boolean>;
    isEmailRegistered(email: string): Promise<boolean>;
    migrateFromLocalStorage(patientsJson: string, visitsJson: string, prescriptionsJson: string, appointmentsJson: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    recordAISuggestionAccepted(patientId: bigint, suggestionType: string, suggestionText: string, confidence: number): Promise<void>;
    recordDeviceSync(deviceId: string, pendingChanges: bigint): Promise<{
        __kind__: "ok";
        ok: SyncRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    recordMedicationAdministration(patientId: bigint, medicationName: string, dose: string, scheduledTime: bigint, administeredAt: bigint | null, status: MedicationAdministrationStatus, missedReason: string | null): Promise<{
        __kind__: "ok";
        ok: MedicationAdministration;
    } | {
        __kind__: "err";
        err: string;
    }>;
    registerEmail(email: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    rejectDraftNote(patientId: bigint, noteId: bigint, reviewerEmail: string, rejectionReason: string): Promise<{
        __kind__: "ok";
        ok: DailyProgressNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    rejectVital(observationId: bigint, reason: string): Promise<{
        __kind__: "ok";
        ok: Observation;
    } | {
        __kind__: "err";
        err: string;
    }>;
    resolveAlert(id: bigint): Promise<{
        __kind__: "ok";
        ok: ClinicalAlert;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveFrontPageContent(content: string): Promise<void>;
    submitDailyNoteForReview(patientId: bigint, noteId: bigint, noteContent: DailyProgressNoteUpdate): Promise<{
        __kind__: "ok";
        ok: DailyProgressNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    syncData(doctorEmail: string): Promise<{
        __kind__: "ok";
        ok: SyncData;
    } | {
        __kind__: "err";
        err: string;
    }>;
    transferBed(bedId: bigint, newBedId: bigint, reason: string): Promise<{
        __kind__: "ok";
        ok: BedRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateAdmissionStatus(admissionId: bigint, newStatus: AdmissionStatus): Promise<{
        __kind__: "ok";
        ok: AdmissionRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateAppointment(id: string, patientId: bigint | null, patientName: string, registerNumber: string | null, phone: string | null, appointmentType: AppointmentType, chamberName: string | null, hospitalName: string | null, date: string, timeSlot: string | null, status: AppointmentStatus, serialNumber: bigint | null, notes: string | null): Promise<{
        __kind__: "ok";
        ok: Appointment;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateClinicalNote(id: bigint, content: string, isDraft: boolean, changeReason: string | null): Promise<{
        __kind__: "ok";
        ok: ClinicalNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateDailyProgressNote(id: bigint, subjectiveComplaints: Array<string>, systemReview: string | null, objectiveVitals: string | null, intakeOutput: string | null, drainMonitoring: string | null, investigations: Array<string>, assessmentText: string, planText: string, activeComplaints: Array<string>, activeDiagnoses: Array<string>, isDraft: boolean, changeReason: string | null): Promise<{
        __kind__: "ok";
        ok: DailyProgressNote;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateDiagnosisTemplate(id: bigint, diagnosisName: string, diagnosisNameBn: string | null, icdCode: string | null, defaultDrugs: Array<string>, defaultInvestigations: Array<string>, defaultAdvice: Array<string>, defaultAdviceBn: Array<string>): Promise<{
        __kind__: "ok";
        ok: DiagnosisTemplate;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateEncounter(id: bigint, patientId: bigint, status: EncounterStatus, endDate: bigint | null, locationNotes: string | null): Promise<{
        __kind__: "ok";
        ok: Encounter;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateHandover(id: bigint, clinicalSummary: string, vitalsSummary: string | null, actionableItems: Array<string>, tasksPending: Array<string>, pendingInvestigations: Array<string>, pendingProcedures: Array<string>, missedMedications: Array<string>, takenByName: string | null, takenByRole: StaffRole | null, takenByPrincipal: Principal | null, consultantComment: string | null, status: HandoverStatus): Promise<{
        __kind__: "ok";
        ok: HandoverEntry;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateOrderStatus(id: bigint, status: OrderStatus, result: string | null, completedAt: bigint | null): Promise<{
        __kind__: "ok";
        ok: ClinicalOrder;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updatePatient(id: bigint, fullName: string, nameBn: string | null, dateOfBirth: Time | null, gender: Gender, phone: string | null, email: string | null, address: string | null, bloodGroup: string | null, weight: number | null, height: number | null, allergies: Array<string>, chronicConditions: Array<string>, pastSurgicalHistory: string | null, patientType: PatientType, consultantEmail: string | null, consultantName: string | null): Promise<Patient>;
    updatePatientBedAssignment(admissionId: bigint, newBed: string): Promise<{
        __kind__: "ok";
        ok: AdmissionRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updatePrescription(id: bigint, patientId: bigint, visitId: bigint | null, prescriptionDate: Time, diagnosis: string | null, medications: Array<Medication>, notes: string | null): Promise<Prescription>;
    updateQueueEntry(id: string, status: QueueStatus, calledAt: bigint | null): Promise<{
        __kind__: "ok";
        ok: SerialQueueEntry;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateVisit(id: bigint, patientId: bigint, visitDate: Time, chiefComplaint: string, historyOfPresentIllness: string | null, vitalSigns: VitalSigns, physicalExamination: string | null, diagnosis: string | null, notes: string | null, visitType: VisitType): Promise<Visit>;
    upsertPatient(patient: Patient): Promise<Patient>;
    upsertPrescription(prescription: Prescription): Promise<Prescription>;
    upsertVisit(visit: Visit): Promise<Visit>;
    verifyVital(observationId: bigint): Promise<{
        __kind__: "ok";
        ok: Observation;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
