import Time "mo:core/Time";
import Principal "mo:core/Principal";

module {

  // ─── Staff Roles ───────────────────────────────────────────────────────────

  public type StaffRole = {
    #admin;
    #doctor;
    #consultant_doctor;
    #assistant_professor;
    #associate_professor;
    #professor;
    #medical_officer;
    #assistant_registrar;
    #registrar;
    #intern_doctor;
    #nurse;
    #staff;
    #patient;
  };

  // ─── Versioning / Audit Chain ──────────────────────────────────────────────

  public type VersionedRecord = {
    version : Nat;
    createdAt : Int;
    createdBy : Principal;
    createdByName : Text;
    createdByRole : StaffRole;
    changeReason : ?Text;
  };

  // ─── Encounter ─────────────────────────────────────────────────────────────

  public type EncounterType = { #OPD; #IPD; #Emergency; #FollowUp };
  public type EncounterStatus = { #Planned; #InProgress; #Completed; #Cancelled };

  public type Encounter = {
    id : Nat;
    patientId : Nat;
    encounterId : Text;
    encounterType : EncounterType;
    status : EncounterStatus;
    startDate : Int;
    endDate : ?Int;
    providerId : Principal;
    providerName : Text;
    locationNotes : ?Text;
    versionInfo : VersionedRecord;
    previousVersions : [VersionedRecord];
  };

  // ─── Observation ───────────────────────────────────────────────────────────

  public type ObservationType = {
    #Vital;
    #Lab;
    #ExamFinding;
    #IntakeOutput;
    #DrainMonitoring;
  };

  // ─── Vital Verification ───────────────────────────────────────────────────

  public type VitalVerificationStatus = {
    #drafted;          // just entered — not yet submitted for MO review
    #pendingMOReview;  // submitted by Nurse/Intern, awaiting MO verification
    #verifiedByMO;     // MO reviewed and accepted
    #finalized;        // locked in record
    #rejected;         // returned to enterer with reason
  };

  public type ObservationStatus = { #Preliminary; #Final; #Corrected };

  public type Observation = {
    id : Nat;
    patientId : Nat;
    encounterId : ?Nat;
    observationType : ObservationType;
    code : Text;
    value : Text;
    numericValue : ?Float;
    unit : Text;
    interpretation : ?Text;
    normalRange : ?Text;
    status : ObservationStatus;
    // Vital-specific verification workflow fields
    vitalVerificationStatus : ?VitalVerificationStatus;
    enteredBy : ?Principal;
    enteredByRole : ?StaffRole;
    verifiedBy : ?Principal;
    verifiedAt : ?Int;
    rejectionReason : ?Text;
    observationDate : Int;
    recordedBy : Principal;
    recordedByName : Text;
    recordedByRole : StaffRole;
    versionInfo : VersionedRecord;
    isDeleted : Bool;
  };

  // ─── Clinical Order ────────────────────────────────────────────────────────

  public type OrderType = { #Medication; #LabTest; #Procedure; #Investigation };
  public type OrderStatus = {
    #Requested;
    #Pending;
    #InProgress;
    #Completed;
    #Cancelled;
  };

  public type ClinicalOrder = {
    id : Nat;
    patientId : Nat;
    encounterId : ?Nat;
    orderType : OrderType;
    code : Text;
    description : Text;
    status : OrderStatus;
    orderedAt : Int;
    orderedBy : Principal;
    orderedByName : Text;
    orderedByRole : StaffRole;
    completedAt : ?Int;
    result : ?Text;
    notes : ?Text;
    versionInfo : VersionedRecord;
  };

  // ─── Clinical Note ─────────────────────────────────────────────────────────

  public type NoteType = {
    #SOAP;
    #DailyProgress;
    #Discharge;
    #Nursing;
    #Handover;
    #General;
  };

  public type ClinicalNote = {
    id : Nat;
    patientId : Nat;
    encounterId : ?Nat;
    noteType : NoteType;
    noteSubtype : ?Text;
    authorId : Principal;
    authorName : Text;
    authorRole : StaffRole;
    content : Text;
    isDraft : Bool;
    createdAt : Int;
    versionInfo : VersionedRecord;
    previousVersionIds : [Nat];
    isDeleted : Bool;
  };

  // ─── Audit Entry ───────────────────────────────────────────────────────────

  public type AuditEntry = {
    id : Nat;
    entityType : Text;
    entityId : Nat;
    fieldName : Text;
    beforeValue : ?Text;
    afterValue : Text;
    changedBy : Principal;
    changedByName : Text;
    changedByRole : StaffRole;
    changedAt : Int;
    reason : ?Text;
    ipAddress : ?Text;
  };

  // ─── Medication ────────────────────────────────────────────────────────────

  public type Medication = {
    name : Text;
    dose : Text;
    route : Text;
    frequency : Text;
    duration : Text;
    instructions : ?Text;
    isPRN : Bool;
    prnCondition : ?Text;   // e.g. "if fever > 38°C"
  };

  // ─── Medication Administration Record ──────────────────────────────────────

  public type MedicationAdministrationStatus = { #Given; #NotGiven; #Delayed };

  public type MedicationAdministration = {
    id : Nat;
    medicationName : Text;
    patientId : Nat;
    dose : Text;
    scheduledTime : Int;
    administeredAt : ?Int;
    status : MedicationAdministrationStatus;
    missedReason : ?Text;
    recordedBy : Text;
    recordedByRole : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  // ─── Prescription ───────────────────────────────────────────────────────────

  public type Prescription = {
    id : Nat;
    patientId : Nat;
    encounterId : ?Nat;
    medications : [Medication];
    diagnoses : [Text];
    advice : [Text];
    followUpDate : ?Int;
    followUpCreatesAppointment : Bool;
    isDraft : Bool;
    isFinalized : Bool;
    authorId : Principal;
    authorName : Text;
    authorRole : StaffRole;
    createdAt : Int;
    updatedAt : Int;
    versionInfo : VersionedRecord;
    isDeleted : Bool;
  };

  // ─── Clinical Alert ────────────────────────────────────────────────────────

  public type AlertType = {
    #Sepsis;
    #AKI;
    #Hypotension;
    #Hypoxia;
    #DrugInteraction;
    #AllergyContraindication;
    #CriticalLab;
    #MissedDoseEscalation;
  };

  public type AlertSeverity = { #Critical; #Warning; #Info };

  public type ClinicalAlert = {
    id : Nat;
    patientId : Nat;
    alertType : AlertType;
    severity : AlertSeverity;
    message : Text;
    details : ?Text;
    triggeredAt : Int;
    triggeredBy : Text;
    isAcknowledged : Bool;
    acknowledgedBy : ?Principal;
    acknowledgedAt : ?Int;
    isResolved : Bool;
    resolvedAt : ?Int;
  };

  // ─── Bed Record ────────────────────────────────────────────────────────────

  public type BedStatus = { #Empty; #Occupied; #Maintenance };

  public type BedTransferEntry = {
    fromBed : Text;
    toBed : Text;
    date : Int;
    reason : Text;
  };

  public type BedRecord = {
    id : Nat;
    bedNumber : Text;
    ward : Text;
    status : BedStatus;
    patientId : ?Nat;
    patientName : ?Text;
    admissionDate : ?Int;
    dischargeDate : ?Int;
    transferHistory : [BedTransferEntry];
    updatedAt : Int;
  };

  // ─── Diagnosis Template ────────────────────────────────────────────────────

  public type DiagnosisTemplate = {
    id : Nat;
    diagnosisName : Text;
    diagnosisNameBn : ?Text;
    icdCode : ?Text;
    defaultDrugs : [Text];
    defaultInvestigations : [Text];
    defaultAdvice : [Text];
    defaultAdviceBn : [Text];
    createdBy : Principal;
    createdAt : Int;
    isActive : Bool;
  };

  // ─── Sync Record ───────────────────────────────────────────────────────────

  public type SyncRecord = {
    id : Nat;
    deviceId : Text;
    userId : Principal;
    lastSyncAt : Int;
    pendingChanges : Nat;
    lastEntityType : ?Text;
    lastEntityId : ?Nat;
  };

  // ─── Appointment ───────────────────────────────────────────────────────────

  public type AppointmentType = { #chamber; #hospital };
  public type AppointmentStatus = { #pending; #confirmed; #cancelled; #completed };

  public type Appointment = {
    id : Text;
    patientId : ?Nat;
    patientName : Text;
    registerNumber : ?Text;
    phone : ?Text;
    appointmentType : AppointmentType;
    chamberName : ?Text;
    hospitalName : ?Text;
    date : Text;           // YYYY-MM-DD
    timeSlot : ?Text;
    status : AppointmentStatus;
    doctorEmail : Text;
    serialNumber : ?Nat;
    notes : ?Text;
    createdAt : Int;
    updatedAt : Int;
  };

  // ─── Serial Queue Entry ────────────────────────────────────────────────────

  public type QueueStatus = { #waiting; #serving; #done; #skipped };

  public type SerialQueueEntry = {
    id : Text;
    date : Text;           // YYYY-MM-DD
    serialNumber : Nat;
    patientName : Text;
    registerNumber : ?Text;
    phone : ?Text;
    status : QueueStatus;
    calledAt : ?Int;
    doctorEmail : Text;
    createdAt : Int;
    updatedAt : Int;       // stamped on every create/update for sync
  };

  // ─── Handover ──────────────────────────────────────────────────────────────

  public type HandoverShift = { #morning; #evening; #night };

  public type HandoverStatus = { #draft; #submitted };

  public type HandoverEntry = {
    id : Nat;
    patientId : Nat;
    shift : HandoverShift;
    shiftStartTime : Int;
    shiftEndTime : Int;
    status : HandoverStatus;
    // Patient info
    patientName : Text;
    registerNumber : ?Text;
    ward : ?Text;
    bedNumber : ?Text;
    diagnosis : ?Text;
    dayOfStay : ?Nat;
    currentConsultant : ?Text;
    // Clinical content
    clinicalSummary : Text;
    vitalsSummary : ?Text;
    actionableItems : [Text];
    tasksPending : [Text];
    pendingInvestigations : [Text];
    pendingProcedures : [Text];
    missedMedications : [Text];
    // Handover chain
    givenByName : Text;
    givenByRole : StaffRole;
    givenByPrincipal : Principal;
    takenByName : ?Text;
    takenByRole : ?StaffRole;
    takenByPrincipal : ?Principal;
    consultantComment : ?Text;
    consultantCommentAt : ?Int;
    consultantCommentBy : ?Principal;
    // Metadata
    createdAt : Int;
    updatedAt : Int;
    versionInfo : VersionedRecord;
  };

  // ─── Daily Progress Note ───────────────────────────────────────────────────

  public type DailyProgressType = { #morning; #evening; #emergency };

  // Three-doctor escalation states: intern→MO→consultant
  public type DailyNoteState = {
    #draft;             // being written by intern/MO
    #submittedToMO;     // intern submitted, awaiting MO review
    #moReviewComplete;  // MO reviewed and forwarded to consultant
    #finalized;         // consultant locked — immutable
    #rejected;          // returned to drafter with reason
  };

  public type VitalsSummary = {
    bp : ?Text;
    pulse : ?Text;
    spo2 : ?Text;
    temp : ?Text;
    rbs : ?Text;
    rr : ?Text;
    recordedAt : Int;
  };

  // Input payload for create/update/submit/finalize
  public type DailyProgressNoteUpdate = {
    subjectiveComplaints : [Text];
    systemReview : ?Text;
    objectiveVitals : ?Text;
    intakeOutput : ?Text;
    drainMonitoring : ?Text;
    investigations : [Text];
    assessmentText : Text;
    planText : Text;
    activeComplaints : [Text];
    activeDiagnoses : [Text];
    internSubjective : Text;
    internObjective : Text;
    moAssessment : Text;
    moPlan : Text;
    consultantOverrides : Text;
    consultantComments : Text;
  };

  public type DailyProgressNote = {
    id : Nat;
    patientId : Nat;
    encounterId : ?Nat;
    progressType : DailyProgressType;
    noteDate : Text;          // YYYY-MM-DD
    // SOAP sections (legacy flat fields — kept for backward compat)
    subjectiveComplaints : [Text];
    systemReview : ?Text;
    objectiveVitals : ?Text;
    intakeOutput : ?Text;
    drainMonitoring : ?Text;
    investigations : [Text];
    assessmentText : Text;
    planText : Text;
    // Active clinical state
    activeComplaints : [Text];
    activeDiagnoses : [Text];
    // Three-doctor rounding fields
    noteState : DailyNoteState;
    submittedByRole : ?StaffRole;
    submitTimestamp : ?Int;
    reviewedByMO : ?Text;          // email
    reviewedByConsultant : ?Text;  // email
    consultantComments : Text;
    internSubjective : Text;
    internObjective : Text;
    moAssessment : Text;
    moPlan : Text;
    consultantOverrides : Text;
    versionChain : [Text];         // IDs of previous versions as Text
    rejectionReason : ?Text;
    // Authoring metadata
    authorId : Principal;
    authorName : Text;
    authorRole : StaffRole;
    isDraft : Bool;
    // Versioning
    createdAt : Int;
    updatedAt : Int;
    versionInfo : VersionedRecord;
    previousVersionIds : [Nat];
    isDeleted : Bool;
  };

  // Ward round patient status — returned by getWardRoundStatus
  public type WardRoundPatientStatus = {
    patientId : Text;
    patientName : Text;
    bedNumber : Text;
    ward : Text;
    admissionDay : Nat;
    todayNoteState : ?Text;
    lastVitals : ?VitalsSummary;
    activeAlerts : [Text];
    assignedConsultant : ?Text;
  };

  // ─── Admission Record ──────────────────────────────────────────────────────

  public type AdmissionStatus = { #admitted; #discharged; #transferred };

  public type AdmissionRecord = {
    id : Nat;
    patientId : Nat;
    consultantEmail : Text;
    bed : Text;
    ward : Text;
    department : Text;
    status : AdmissionStatus;
    admittedAt : Int;
    dischargedAt : ?Int;
    admittedBy : Principal;
    admittedByRole : StaffRole;
    updatedAt : Int;
  };

  // ─── Role Change Audit ─────────────────────────────────────────────────────

  public type RoleChangeEntry = {
    id : Nat;
    principal : Principal;
    previousRole : ?StaffRole;
    newRole : StaffRole;
    changedBy : Principal;
    timestamp : Int;
  };

  // ─── Sync Bootstrap ────────────────────────────────────────────────────────

  public type SyncData = {
    appointments : [Appointment];
    queueEntries : [SerialQueueEntry];
    timestamp : Int;       // canister time at the moment the snapshot was taken
  };

  // ─── Updated Data (lightweight multi-entity sync response) ────────────────

  public type UpdatedData = {
    patients : [Nat];          // IDs of patient records updated since sinceTimestamp
    appointments : [Appointment];
    queueEntries : [SerialQueueEntry];
    timestamp : Int;
  };

};
