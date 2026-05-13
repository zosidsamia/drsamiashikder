import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Order "mo:core/Order";

import Types "../types/clinical-data-engine";

module {

  // ─── State Shape (injected by main.mo) ─────────────────────────────────────

  public type EngineState = {
    encounters : Map.Map<Nat, Types.Encounter>;
    observations : Map.Map<Nat, Types.Observation>;
    orders : Map.Map<Nat, Types.ClinicalOrder>;
    notes : Map.Map<Nat, Types.ClinicalNote>;
    auditEntries : Map.Map<Nat, Types.AuditEntry>;
    alerts : Map.Map<Nat, Types.ClinicalAlert>;
    beds : Map.Map<Nat, Types.BedRecord>;
    diagnosisTemplates : Map.Map<Nat, Types.DiagnosisTemplate>;
    syncRecords : Map.Map<Text, Types.SyncRecord>;
    appointments : Map.Map<Text, Types.Appointment>;
    queueEntries : Map.Map<Text, Types.SerialQueueEntry>;
    handovers : Map.Map<Nat, Types.HandoverEntry>;
    dailyProgressNotes : Map.Map<Nat, Types.DailyProgressNote>;
    medicationAdministrations : Map.Map<Nat, Types.MedicationAdministration>;
    prescriptions : Map.Map<Nat, Types.Prescription>;
    admissions : Map.Map<Nat, Types.AdmissionRecord>;
    roleChangeLog : Map.Map<Nat, Types.RoleChangeEntry>;
    emailIndex : Map.Map<Text, Principal>;
    var encounterIdCounter : Nat;
    var observationIdCounter : Nat;
    var orderIdCounter : Nat;
    var noteIdCounter : Nat;
    var auditIdCounter : Nat;
    var alertIdCounter : Nat;
    var bedIdCounter : Nat;
    var diagnosisTemplateIdCounter : Nat;
    var syncRecordIdCounter : Nat;
    var handoverIdCounter : Nat;
    var dailyProgressNoteIdCounter : Nat;
    var medicationAdministrationIdCounter : Nat;
    var prescriptionIdCounter : Nat;
    var admissionIdCounter : Nat;
    var roleChangeIdCounter : Nat;
  };

  public func initState() : EngineState {
    {
      encounters = Map.empty<Nat, Types.Encounter>();
      observations = Map.empty<Nat, Types.Observation>();
      orders = Map.empty<Nat, Types.ClinicalOrder>();
      notes = Map.empty<Nat, Types.ClinicalNote>();
      auditEntries = Map.empty<Nat, Types.AuditEntry>();
      alerts = Map.empty<Nat, Types.ClinicalAlert>();
      beds = Map.empty<Nat, Types.BedRecord>();
      diagnosisTemplates = Map.empty<Nat, Types.DiagnosisTemplate>();
      syncRecords = Map.empty<Text, Types.SyncRecord>();
      appointments = Map.empty<Text, Types.Appointment>();
      queueEntries = Map.empty<Text, Types.SerialQueueEntry>();
      handovers = Map.empty<Nat, Types.HandoverEntry>();
      dailyProgressNotes = Map.empty<Nat, Types.DailyProgressNote>();
      medicationAdministrations = Map.empty<Nat, Types.MedicationAdministration>();
      prescriptions = Map.empty<Nat, Types.Prescription>();
      admissions = Map.empty<Nat, Types.AdmissionRecord>();
      roleChangeLog = Map.empty<Nat, Types.RoleChangeEntry>();
      emailIndex = Map.empty<Text, Principal>();
      var encounterIdCounter = 1;
      var observationIdCounter = 1;
      var orderIdCounter = 1;
      var noteIdCounter = 1;
      var auditIdCounter = 1;
      var alertIdCounter = 1;
      var bedIdCounter = 1;
      var diagnosisTemplateIdCounter = 1;
      var syncRecordIdCounter = 1;
      var handoverIdCounter = 1;
      var dailyProgressNoteIdCounter = 1;
      var medicationAdministrationIdCounter = 1;
      var prescriptionIdCounter = 1;
      var admissionIdCounter = 1;
      var roleChangeIdCounter = 1;
    };
  };

  // ─── Role Helpers ──────────────────────────────────────────────────────────

  // ─── Role Helpers ─────────────────────────────────────────────────────────────

  // Returns true for the four Consultant-level roles
  public func isConsultantType(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#consultant_doctor or #assistant_professor or #associate_professor or #professor) true;
      case (_) false;
    };
  };

  // Returns true for roles authorized to verify vitals
  public func canVerifyVitals(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#medical_officer or #assistant_registrar or #registrar) true;
      case (_) isConsultantType(role);
    };
  };

  // Returns true for roles that can manage all admissions
  public func canManageAllAdmissions(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#registrar) true;
      case (_) isConsultantType(role);
    };
  };

  // Returns true for registrar level (view all admitted patients with edit)
  public func isRegistrarLevel(role : Types.StaffRole) : Bool {
    role == #registrar;
  };

  public func isClinician(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#admin or #doctor or #consultant_doctor or #assistant_professor or #associate_professor or #professor
           or #medical_officer or #assistant_registrar or #registrar or #intern_doctor or #nurse) true;
      case (_) false;
    };
  };

  public func canFinalizeClinicalNote(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#admin or #doctor or #medical_officer) true;
      case (_) isConsultantType(role);
    };
  };

  public func canViewAuditTrail(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#admin) true;
      case (_) isConsultantType(role);
    };
  };

  public func canManageBeds(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#admin or #staff or #doctor or #medical_officer or #assistant_registrar or #registrar) true;
      case (_) isConsultantType(role);
    };
  };

  public func canCompleteOrder(role : Types.StaffRole) : Bool {
    switch (role) {
      case (#admin or #doctor or #medical_officer or #nurse) true;
      case (_) isConsultantType(role);
    };
  };

  // ─── Versioning Helpers ────────────────────────────────────────────────────

  public func makeVersionedRecord(
    version : Nat,
    _caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    changeReason : ?Text,
  ) : Types.VersionedRecord {
    {
      version;
      createdAt = Time.now();
      createdBy = _caller;
      createdByName = callerName;
      createdByRole = callerRole;
      changeReason;
    };
  };

  // ─── Audit Append (internal) ───────────────────────────────────────────────

  func addAudit(
    state : EngineState,
    entityType : Text,
    entityId : Nat,
    fieldName : Text,
    beforeValue : ?Text,
    afterValue : Text,
    changedBy : Principal,
    changedByName : Text,
    changedByRole : Types.StaffRole,
    reason : ?Text,
  ) {
    let id = state.auditIdCounter;
    state.auditIdCounter += 1;
    let entry : Types.AuditEntry = {
      id;
      entityType;
      entityId;
      fieldName;
      beforeValue;
      afterValue;
      changedBy;
      changedByName;
      changedByRole;
      changedAt = Time.now();
      reason;
      ipAddress = null;
    };
    state.auditEntries.add(id, entry);
  };

  // ─── Clinical Alert Auto-Detection ─────────────────────────────────────────

  func checkClinicalAlerts(
    state : EngineState,
    patientId : Nat,
    code : Text,
    numericValue : ?Float,
  ) {
    let now = Time.now();
    switch (numericValue) {
      case (null) {};
      case (?val) {
        // Hypotension: systolic BP < 90
        if (code == "BP_SYSTOLIC" and val < 90.0) {
          let alertId = state.alertIdCounter;
          state.alertIdCounter += 1;
          state.alerts.add(alertId, {
            id = alertId;
            patientId;
            alertType = #Hypotension;
            severity = #Critical;
            message = "Critical: Systolic BP < 90 mmHg (" # val.toText() # " mmHg)";
            details = ?"Immediate clinical review required";
            triggeredAt = now;
            triggeredBy = "Auto-detection: Vital observation";
            isAcknowledged = false;
            acknowledgedBy = null;
            acknowledgedAt = null;
            isResolved = false;
            resolvedAt = null;
          });
        };
        // Hypoxia: SpO2 < 90
        if (code == "SPO2" and val < 90.0) {
          let alertId = state.alertIdCounter;
          state.alertIdCounter += 1;
          state.alerts.add(alertId, {
            id = alertId;
            patientId;
            alertType = #Hypoxia;
            severity = #Critical;
            message = "Critical: SpO2 < 90% (" # val.toText() # "%)";
            details = ?"Oxygen supplementation may be required";
            triggeredAt = now;
            triggeredBy = "Auto-detection: Vital observation";
            isAcknowledged = false;
            acknowledgedBy = null;
            acknowledgedAt = null;
            isResolved = false;
            resolvedAt = null;
          });
        };

        // Sepsis screen: check if recent vitals meet criteria
        // We check Temp abnormality here; sepsis composite is checked in getObservationsByPatient context
        if (code == "TEMPERATURE" and (val > 38.5 or val < 36.0)) {
          // Gather recent pulse and RR to check sepsis combo
          let recentObs = state.observations.values().filter(func (o) {
            o.patientId == patientId and not o.isDeleted
          }).toArray();
          let latestPulse = recentObs.filterMap(func (o : Types.Observation) : ?Float {
            if (o.code == "PULSE") { o.numericValue } else { null }
          });
          let latestRR = recentObs.filterMap(func (o : Types.Observation) : ?Float {
            if (o.code == "RR") { o.numericValue } else { null }
          });
          let hasPulse = latestPulse.any(func (p) { p > 100.0 });
          let hasRR = latestRR.any(func (r) { r > 20.0 });
          if (hasPulse and hasRR) {
            let alertId = state.alertIdCounter;
            state.alertIdCounter += 1;
            state.alerts.add(alertId, {
              id = alertId;
              patientId;
              alertType = #Sepsis;
              severity = #Critical;
              message = "Possible Sepsis: Temp abnormal + HR > 100 + RR > 20";
              details = ?"SIRS criteria met — immediate clinical review required";
              triggeredAt = now;
              triggeredBy = "Auto-detection: Sepsis screen";
              isAcknowledged = false;
              acknowledgedBy = null;
              acknowledgedAt = null;
              isResolved = false;
              resolvedAt = null;
            });
          };
        };

        // AKI screen: creatinine trending up (simple threshold > 1.5 with downtrend U/O)
        if (code == "CREATININE" and val >= 1.5) {
          let recentUO = state.observations.values().filter(func (o) {
            o.patientId == patientId and o.code == "URINE_OUTPUT" and not o.isDeleted
          }).toArray();
          let lowUO = recentUO.any(func (o) {
            switch (o.numericValue) {
              case (?v) { v < 0.5 };
              case (null) { false };
            }
          });
          if (lowUO) {
            let alertId = state.alertIdCounter;
            state.alertIdCounter += 1;
            state.alerts.add(alertId, {
              id = alertId;
              patientId;
              alertType = #AKI;
              severity = #Critical;
              message = "Possible AKI: Creatinine " # val.toText() # " mg/dL + low urine output";
              details = ?"Creatinine elevated and urine output < 0.5 ml/kg/hr";
              triggeredAt = now;
              triggeredBy = "Auto-detection: AKI screen";
              isAcknowledged = false;
              acknowledgedBy = null;
              acknowledgedAt = null;
              isResolved = false;
              resolvedAt = null;
            });
          };
        };
      };
    };
  };

  // ─── Encounter Logic ───────────────────────────────────────────────────────

  public func createEncounter(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    encounterType : Types.EncounterType,
    locationNotes : ?Text,
  ) : Types.Encounter {
    let id = state.encounterIdCounter;
    state.encounterIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    let encounter : Types.Encounter = {
      id;
      patientId;
      encounterId = "ENC-" # id.toText();
      encounterType;
      status = #InProgress;
      startDate = Time.now();
      endDate = null;
      providerId = caller;
      providerName = callerName;
      locationNotes;
      versionInfo;
      previousVersions = [];
    };
    state.encounters.add(id, encounter);
    addAudit(state, "Encounter", id, "created", null, "ENC-" # id.toText(), caller, callerName, callerRole, null);
    encounter;
  };

  public func updateEncounter(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
    patientId : Nat,
    status : Types.EncounterStatus,
    endDate : ?Int,
    locationNotes : ?Text,
  ) : Types.Encounter {
    let existing = switch (state.encounters.get(id)) {
      case (null) { Runtime.trap("Encounter not found") };
      case (?e) { e };
    };
    let prevVersions = existing.previousVersions.concat([existing.versionInfo]);
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, null);
    let updated : Types.Encounter = {
      existing with
      patientId;
      status;
      endDate;
      locationNotes;
      versionInfo = newVersion;
      previousVersions = prevVersions;
    };
    state.encounters.add(id, updated);
    addAudit(state, "Encounter", id, "status", ?debug_show(existing.status), debug_show(status), caller, callerName, callerRole, null);
    updated;
  };

  public func getEncountersByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.Encounter] {
    state.encounters.values().filter(func (e) { e.patientId == patientId }).toArray();
  };

  public func getAllEncounters(state : EngineState) : [Types.Encounter] {
    state.encounters.values().toArray();
  };

  public func getAllObservationsSince(
    state : EngineState,
    sinceTimestamp : Int,
  ) : [Types.Observation] {
    // Observation uses versionInfo.createdAt as a proxy for updatedAt
    state.observations.values().filter(func (o) {
      o.versionInfo.createdAt >= sinceTimestamp and not o.isDeleted
    }).toArray();
  };

  public func bulkUpsertObservations(
    state : EngineState,
    obs : [Types.Observation],
  ) : [Types.Observation] {
    obs.map<Types.Observation, Types.Observation>(func (ob) {
      switch (state.observations.get(ob.id)) {
        case (?existing) {
          if (ob.versionInfo.createdAt > existing.versionInfo.createdAt) {
            state.observations.add(ob.id, ob);
            ob;
          } else { existing };
        };
        case (null) {
          if (ob.id >= state.observationIdCounter) {
            state.observationIdCounter := ob.id + 1;
          };
          state.observations.add(ob.id, ob);
          ob;
        };
      };
    });
  };

  // ─── Observation Logic ─────────────────────────────────────────────────────

  public func createObservation(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    encounterId : ?Nat,
    observationType : Types.ObservationType,
    code : Text,
    value : Text,
    numericValue : ?Float,
    unit : Text,
    interpretation : ?Text,
    normalRange : ?Text,
    observationDate : Int,
  ) : Types.Observation {
    let id = state.observationIdCounter;
    state.observationIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    // Vitals from Nurse/Intern go to pendingMOReview; MO/above are auto-finalized
    let vitalStatus : ?Types.VitalVerificationStatus = switch (observationType) {
      case (#Vital) {
        switch (callerRole) {
          case (#nurse or #intern_doctor) { ?#pendingMOReview };
          case (_) {
            if (canVerifyVitals(callerRole)) { ?#finalized } else { ?#pendingMOReview };
          };
        };
      };
      case (_) { null };
    };
    let obs : Types.Observation = {
      id;
      patientId;
      encounterId;
      observationType;
      code;
      value;
      numericValue;
      unit;
      interpretation;
      normalRange;
      status = #Final;
      vitalVerificationStatus = vitalStatus;
      enteredBy = ?caller;
      enteredByRole = ?callerRole;
      verifiedBy = null;
      verifiedAt = null;
      rejectionReason = null;
      observationDate;
      recordedBy = caller;
      recordedByName = callerName;
      recordedByRole = callerRole;
      versionInfo;
      isDeleted = false;
    };
    state.observations.add(id, obs);
    addAudit(state, "Observation", id, "created", null, code # "=" # value, caller, callerName, callerRole, null);
    // Auto-detect clinical alerts for vitals and labs
    switch (observationType) {
      case (#Vital or #Lab) {
        checkClinicalAlerts(state, patientId, code, numericValue);
      };
      case (_) {};
    };
    obs;
  };

  public func getObservationsByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.Observation] {
    state.observations.values().filter(func (o) {
      o.patientId == patientId and not o.isDeleted
    }).toArray();
  };

  public func getObservationsByType(
    state : EngineState,
    patientId : Nat,
    observationType : Types.ObservationType,
  ) : [Types.Observation] {
    state.observations.values().filter(func (o) {
      o.patientId == patientId and o.observationType == observationType and not o.isDeleted
    }).toArray();
  };

  public func acknowledgeObservationCorrection(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
    newValue : Text,
    reason : Text,
  ) : Types.Observation {
    let existing = switch (state.observations.get(id)) {
      case (null) { Runtime.trap("Observation not found") };
      case (?o) { o };
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?reason);
    let updated : Types.Observation = {
      existing with
      value = newValue;
      status = #Corrected;
      versionInfo = newVersion;
    };
    state.observations.add(id, updated);
    addAudit(state, "Observation", id, "value", ?existing.value, newValue, caller, callerName, callerRole, ?reason);
    updated;
  };

  // ─── Vital Verification Logic ────────────────────────────────────────────────

  public func verifyVital(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    observationId : Nat,
  ) : { #ok : Types.Observation; #err : Text } {
    if (not canVerifyVitals(callerRole)) {
      return #err("Unauthorized: role cannot verify vitals");
    };
    let existing = switch (state.observations.get(observationId)) {
      case (null) { return #err("Observation not found") };
      case (?o) { o };
    };
    switch (existing.vitalVerificationStatus) {
      case (?#pendingMOReview or ?#drafted) {};
      case (?#finalized) { return #err("Vital is already finalized") };
      case (?#rejected) { return #err("Vital is rejected; enterer must resubmit") };
      case (_) { return #err("Not a vital or not pending review") };
    };
    let now = Time.now();
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"verified");
    let updated : Types.Observation = {
      existing with
      vitalVerificationStatus = ?#finalized;
      verifiedBy = ?caller;
      verifiedAt = ?now;
      rejectionReason = null;
      versionInfo = newVersion;
    };
    state.observations.add(observationId, updated);
    addAudit(state, "Observation", observationId, "vitalVerification", ?"pendingMOReview", "finalized", caller, callerName, callerRole, null);
    #ok(updated);
  };

  public func rejectVital(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    observationId : Nat,
    reason : Text,
  ) : { #ok : Types.Observation; #err : Text } {
    if (not canVerifyVitals(callerRole)) {
      return #err("Unauthorized: role cannot reject vitals");
    };
    let existing = switch (state.observations.get(observationId)) {
      case (null) { return #err("Observation not found") };
      case (?o) { o };
    };
    switch (existing.vitalVerificationStatus) {
      case (?#pendingMOReview or ?#drafted) {};
      case (?#finalized) { return #err("Cannot reject a finalized vital") };
      case (_) { return #err("Not a vital entry pending review") };
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?reason);
    let updated : Types.Observation = {
      existing with
      vitalVerificationStatus = ?#rejected;
      rejectionReason = ?reason;
      versionInfo = newVersion;
    };
    state.observations.add(observationId, updated);
    addAudit(state, "Observation", observationId, "vitalVerification", ?"pendingMOReview", "rejected", caller, callerName, callerRole, ?reason);
    #ok(updated);
  };

  public func getVitalsForVerification(state : EngineState) : [Types.Observation] {
    state.observations.values().filter(func (o) {
      switch (o.vitalVerificationStatus) {
        case (?#pendingMOReview) { not o.isDeleted };
        case (_) { false };
      };
    }).toArray();
  };

  // ─── Registrar Patient Management ────────────────────────────────────────────────

  public func getAllAdmittedPatients(
    state : EngineState,
    callerRole : Types.StaffRole,
    consultantEmail : ?Text,
    ward : ?Text,
    bed : ?Text,
    department : ?Text,
    admissionStatus : ?Text,
  ) : { #ok : [Types.AdmissionRecord]; #err : Text } {
    if (not isRegistrarLevel(callerRole) and not isConsultantType(callerRole) and callerRole != #admin) {
      return #err("Unauthorized: only Registrar and above can view all admitted patients");
    };
    let results = state.admissions.values().filter(func (a) {
      let matchConsultant = switch (consultantEmail) {
        case (null) { true };
        case (?e) { a.consultantEmail == e };
      };
      let matchWard = switch (ward) {
        case (null) { true };
        case (?w) { a.ward == w };
      };
      let matchBed = switch (bed) {
        case (null) { true };
        case (?b) { a.bed == b };
      };
      let matchDept = switch (department) {
        case (null) { true };
        case (?d) { a.department == d };
      };
      let matchStatus = switch (admissionStatus) {
        case (null) { true };
        case (?s) { debug_show(a.status) == s };
      };
      matchConsultant and matchWard and matchBed and matchDept and matchStatus;
    }).toArray();
    #ok(results);
  };

  public func createAdmission(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    consultantEmail : Text,
    bed : Text,
    ward : Text,
    department : Text,
  ) : { #ok : Types.AdmissionRecord; #err : Text } {
    switch (callerRole) {
      case (#medical_officer or #assistant_registrar or #registrar or #admin) {};
      case (_) {
        if (not isConsultantType(callerRole)) {
          return #err("Unauthorized: cannot create admissions");
        };
      };
    };
    let id = state.admissionIdCounter;
    state.admissionIdCounter += 1;
    let now = Time.now();
    let record : Types.AdmissionRecord = {
      id;
      patientId;
      consultantEmail;
      bed;
      ward;
      department;
      status = #admitted;
      admittedAt = now;
      dischargedAt = null;
      admittedBy = caller;
      admittedByRole = callerRole;
      updatedAt = now;
    };
    state.admissions.add(id, record);
    addAudit(state, "Admission", id, "created", null, "patient=" # patientId.toText() # " bed=" # bed, caller, callerName, callerRole, null);
    #ok(record);
  };

  public func updatePatientBedAssignment(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    admissionId : Nat,
    newBed : Text,
  ) : { #ok : Types.AdmissionRecord; #err : Text } {
    switch (callerRole) {
      case (#medical_officer or #assistant_registrar or #registrar or #admin) {};
      case (_) { return #err("Unauthorized: cannot change bed assignment") };
    };
    let existing = switch (state.admissions.get(admissionId)) {
      case (null) { return #err("Admission not found") };
      case (?a) { a };
    };
    let updated : Types.AdmissionRecord = {
      existing with
      bed = newBed;
      updatedAt = Time.now();
    };
    state.admissions.add(admissionId, updated);
    addAudit(state, "Admission", admissionId, "bed", ?existing.bed, newBed, caller, callerName, callerRole, null);
    #ok(updated);
  };

  public func updateAdmissionStatus(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    admissionId : Nat,
    newStatus : Types.AdmissionStatus,
  ) : { #ok : Types.AdmissionRecord; #err : Text } {
    if (not isRegistrarLevel(callerRole) and not isConsultantType(callerRole) and callerRole != #admin) {
      return #err("Unauthorized: cannot change admission status");
    };
    let existing = switch (state.admissions.get(admissionId)) {
      case (null) { return #err("Admission not found") };
      case (?a) { a };
    };
    let dischargedAt : ?Int = switch (newStatus) {
      case (#discharged) { ?Time.now() };
      case (_) { existing.dischargedAt };
    };
    let updated : Types.AdmissionRecord = {
      existing with
      status = newStatus;
      dischargedAt;
      updatedAt = Time.now();
    };
    state.admissions.add(admissionId, updated);
    addAudit(state, "Admission", admissionId, "status", ?debug_show(existing.status), debug_show(newStatus), caller, callerName, callerRole, null);
    #ok(updated);
  };

  public func approveDischarge(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    admissionId : Nat,
  ) : { #ok : Types.AdmissionRecord; #err : Text } {
    if (not isRegistrarLevel(callerRole) and not isConsultantType(callerRole) and callerRole != #admin) {
      return #err("Unauthorized: only Registrar or Consultant can approve discharge");
    };
    let existing = switch (state.admissions.get(admissionId)) {
      case (null) { return #err("Admission not found") };
      case (?a) { a };
    };
    if (existing.status == #discharged) {
      return #err("Patient is already discharged");
    };
    let now = Time.now();
    let updated : Types.AdmissionRecord = {
      existing with
      status = #discharged;
      dischargedAt = ?now;
      updatedAt = now;
    };
    state.admissions.add(admissionId, updated);
    addAudit(state, "Admission", admissionId, "status", ?"admitted", "discharged", caller, callerName, callerRole, ?"discharge approved");
    #ok(updated);
  };

  // ─── Email Index (Unique Email Enforcement) ───────────────────────────────────────

  public func isEmailRegistered(state : EngineState, email : Text) : Bool {
    state.emailIndex.get(email) != null;
  };

  public func registerEmail(
    state : EngineState,
    email : Text,
    principal : Principal,
  ) : { #ok : (); #err : Text } {
    switch (state.emailIndex.get(email)) {
      case (?existing) {
        if (existing == principal) { #ok(()) }
        else { #err("Email already in use") };
      };
      case (null) {
        state.emailIndex.add(email, principal);
        #ok(());
      };
    };
  };

  public func getEmailIndex(
    state : EngineState,
    callerRole : Types.StaffRole,
  ) : { #ok : [(Text, Principal)]; #err : Text } {
    if (callerRole != #admin) {
      return #err("Unauthorized: only admin can view email index");
    };
    #ok(state.emailIndex.entries().toArray());
  };

  // ─── Role Change Audit ────────────────────────────────────────────────────────

  public func logRoleChange(
    state : EngineState,
    principal : Principal,
    previousRole : ?Types.StaffRole,
    newRole : Types.StaffRole,
    changedBy : Principal,
  ) {
    let id = state.roleChangeIdCounter;
    state.roleChangeIdCounter += 1;
    let entry : Types.RoleChangeEntry = {
      id;
      principal;
      previousRole;
      newRole;
      changedBy;
      timestamp = Time.now();
    };
    state.roleChangeLog.add(id, entry);
  };

  public func getRoleChangeHistory(
    state : EngineState,
    principal : Principal,
  ) : [Types.RoleChangeEntry] {
    state.roleChangeLog.values().filter(func (e) { e.principal == principal }).toArray();
  };

  public func getAllRoleChanges(
    state : EngineState,
    callerRole : Types.StaffRole,
  ) : { #ok : [Types.RoleChangeEntry]; #err : Text } {
    if (callerRole != #admin) {
      return #err("Unauthorized: only admin can view all role changes");
    };
    #ok(state.roleChangeLog.values().toArray());
  };

  // ─── Clinical Order Logic ──────────────────────────────────────────────────

  public func createOrder(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    encounterId : ?Nat,
    orderType : Types.OrderType,
    code : Text,
    description : Text,
    notes : ?Text,
  ) : Types.ClinicalOrder {
    let id = state.orderIdCounter;
    state.orderIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    let order : Types.ClinicalOrder = {
      id;
      patientId;
      encounterId;
      orderType;
      code;
      description;
      status = #Requested;
      orderedAt = Time.now();
      orderedBy = caller;
      orderedByName = callerName;
      orderedByRole = callerRole;
      completedAt = null;
      result = null;
      notes;
      versionInfo;
    };
    state.orders.add(id, order);
    addAudit(state, "ClinicalOrder", id, "created", null, code # ": " # description, caller, callerName, callerRole, null);
    order;
  };

  public func updateOrderStatus(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
    status : Types.OrderStatus,
    result : ?Text,
    completedAt : ?Int,
  ) : Types.ClinicalOrder {
    if (not canCompleteOrder(callerRole)) {
      Runtime.trap("Unauthorized: role cannot update order status");
    };
    let existing = switch (state.orders.get(id)) {
      case (null) { Runtime.trap("Order not found") };
      case (?o) { o };
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, null);
    let updated : Types.ClinicalOrder = {
      existing with
      status;
      result;
      completedAt;
      versionInfo = newVersion;
    };
    state.orders.add(id, updated);
    addAudit(state, "ClinicalOrder", id, "status", ?debug_show(existing.status), debug_show(status), caller, callerName, callerRole, null);
    updated;
  };

  public func getOrdersByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.ClinicalOrder] {
    state.orders.values().filter(func (o) { o.patientId == patientId }).toArray();
  };

  public func getActiveOrdersByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.ClinicalOrder] {
    state.orders.values().filter(func (o) {
      o.patientId == patientId and (o.status == #Requested or o.status == #Pending or o.status == #InProgress)
    }).toArray();
  };

  // ─── Clinical Note Logic ───────────────────────────────────────────────────

  public func createClinicalNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    encounterId : ?Nat,
    noteType : Types.NoteType,
    noteSubtype : ?Text,
    content : Text,
    isDraft : Bool,
  ) : Types.ClinicalNote {
    // Interns can only create draft notes
    if (callerRole == #intern_doctor and not isDraft) {
      Runtime.trap("Unauthorized: Intern doctors can only create draft notes");
    };
    // Finalized notes require clinician role
    if (not isDraft and not canFinalizeClinicalNote(callerRole)) {
      Runtime.trap("Unauthorized: role cannot finalize clinical notes");
    };
    let id = state.noteIdCounter;
    state.noteIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    let note : Types.ClinicalNote = {
      id;
      patientId;
      encounterId;
      noteType;
      noteSubtype;
      authorId = caller;
      authorName = callerName;
      authorRole = callerRole;
      content;
      isDraft;
      createdAt = Time.now();
      versionInfo;
      previousVersionIds = [];
      isDeleted = false;
    };
    state.notes.add(id, note);
    addAudit(state, "ClinicalNote", id, "created", null, debug_show(noteType), caller, callerName, callerRole, null);
    note;
  };

  public func updateClinicalNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
    content : Text,
    isDraft : Bool,
    changeReason : ?Text,
  ) : Types.ClinicalNote {
    let existing = switch (state.notes.get(id)) {
      case (null) { Runtime.trap("Clinical note not found") };
      case (?n) { n };
    };
    if (callerRole == #intern_doctor and not isDraft) {
      Runtime.trap("Unauthorized: Intern doctors can only save draft notes");
    };
    if (not isDraft and not canFinalizeClinicalNote(callerRole)) {
      Runtime.trap("Unauthorized: role cannot finalize clinical notes");
    };
    // Archive the existing note by saving it under a new ID (version history chain)
    let archiveId = state.noteIdCounter;
    state.noteIdCounter += 1;
    let archivedNote : Types.ClinicalNote = {
      existing with
      id = archiveId;
      isDeleted = true; // soft-deleted archive
    };
    state.notes.add(archiveId, archivedNote);
    addAudit(state, "ClinicalNote", archiveId, "archived", ?existing.content, "archived", caller, callerName, callerRole, changeReason);

    // Create the new version with chain link to previous
    let prevIds = existing.previousVersionIds.concat([archiveId]);
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, changeReason);
    let updated : Types.ClinicalNote = {
      existing with
      content;
      isDraft;
      versionInfo = newVersion;
      previousVersionIds = prevIds;
    };
    state.notes.add(id, updated);
    addAudit(state, "ClinicalNote", id, "content", ?existing.content, content, caller, callerName, callerRole, changeReason);
    updated;
  };

  public func getClinicalNotesByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.ClinicalNote] {
    state.notes.values().filter(func (n) {
      n.patientId == patientId and not n.isDeleted
    }).toArray();
  };

  public func getClinicalNotesByType(
    state : EngineState,
    patientId : Nat,
    noteType : Types.NoteType,
  ) : [Types.ClinicalNote] {
    state.notes.values().filter(func (n) {
      n.patientId == patientId and n.noteType == noteType and not n.isDeleted
    }).toArray();
  };

  // ─── Audit Logic ───────────────────────────────────────────────────────────

  public func appendAuditEntry(
    state : EngineState,
    entityType : Text,
    entityId : Nat,
    fieldName : Text,
    beforeValue : ?Text,
    afterValue : Text,
    changedBy : Principal,
    changedByName : Text,
    changedByRole : Types.StaffRole,
    reason : ?Text,
  ) {
    addAudit(state, entityType, entityId, fieldName, beforeValue, afterValue, changedBy, changedByName, changedByRole, reason);
  };

  public func getAuditTrail(
    state : EngineState,
    patientId : Nat,
    limit : Nat,
    offset : Nat,
  ) : [Types.AuditEntry] {
    let all = state.auditEntries.values().toArray();
    // Return all audit entries where the entity is directly tied to this patient
    // (Patient record changes use entityId = patientId; clinical entities tracked separately)
    let filtered = all.filter(func (e) { e.entityId == patientId });
    let sorted = filtered.sort(func (a, b) { Int.compare(b.changedAt, a.changedAt) });
    let total = sorted.size();
    if (offset >= total) { return [] };
    let end = Nat.min(offset + limit, total);
    sorted.sliceToArray(offset.toInt(), end.toInt());
  };

  public func getAllAuditEntries(
    state : EngineState,
    limit : Nat,
    offset : Nat,
  ) : [Types.AuditEntry] {
    let all = state.auditEntries.values().toArray();
    let sorted = all.sort(func (a, b) { Int.compare(b.changedAt, a.changedAt) });
    let total = sorted.size();
    if (offset >= total) { return [] };
    let end = Nat.min(offset + limit, total);
    sorted.sliceToArray(offset.toInt(), end.toInt());
  };

  // ─── Alert Logic ───────────────────────────────────────────────────────────

  public func createClinicalAlert(
    state : EngineState,
    patientId : Nat,
    alertType : Types.AlertType,
    severity : Types.AlertSeverity,
    message : Text,
    details : ?Text,
  ) : Types.ClinicalAlert {
    let id = state.alertIdCounter;
    state.alertIdCounter += 1;
    let alert : Types.ClinicalAlert = {
      id;
      patientId;
      alertType;
      severity;
      message;
      details;
      triggeredAt = Time.now();
      triggeredBy = "Manual";
      isAcknowledged = false;
      acknowledgedBy = null;
      acknowledgedAt = null;
      isResolved = false;
      resolvedAt = null;
    };
    state.alerts.add(id, alert);
    alert;
  };

  public func acknowledgeAlert(
    state : EngineState,
    caller : Principal,
    id : Nat,
  ) : Types.ClinicalAlert {
    let existing = switch (state.alerts.get(id)) {
      case (null) { Runtime.trap("Alert not found") };
      case (?a) { a };
    };
    let updated : Types.ClinicalAlert = {
      existing with
      isAcknowledged = true;
      acknowledgedBy = ?caller;
      acknowledgedAt = ?Time.now();
    };
    state.alerts.add(id, updated);
    updated;
  };

  public func resolveAlert(
    state : EngineState,
    caller : Principal,
    id : Nat,
  ) : Types.ClinicalAlert {
    let existing = switch (state.alerts.get(id)) {
      case (null) { Runtime.trap("Alert not found") };
      case (?a) { a };
    };
    let updated : Types.ClinicalAlert = {
      existing with
      isAcknowledged = true;
      acknowledgedBy = ?caller;
      acknowledgedAt = switch (existing.acknowledgedAt) {
        case (?t) { ?t };
        case (null) { ?Time.now() };
      };
      isResolved = true;
      resolvedAt = ?Time.now();
    };
    state.alerts.add(id, updated);
    updated;
  };

  public func getAlertsByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.ClinicalAlert] {
    state.alerts.values().filter(func (a) { a.patientId == patientId }).toArray();
  };

  public func getUnacknowledgedAlerts(state : EngineState) : [Types.ClinicalAlert] {
    state.alerts.values().filter(func (a) { not a.isAcknowledged }).toArray();
  };

  // ─── Bed Management Logic ──────────────────────────────────────────────────

  public func createBedRecord(
    state : EngineState,
    _caller : Principal,
    callerRole : Types.StaffRole,
    bedNumber : Text,
    ward : Text,
  ) : Types.BedRecord {
    if (not canManageBeds(callerRole)) {
      Runtime.trap("Unauthorized: role cannot manage beds");
    };
    let id = state.bedIdCounter;
    state.bedIdCounter += 1;
    let bed : Types.BedRecord = {
      id;
      bedNumber;
      ward;
      status = #Empty;
      patientId = null;
      patientName = null;
      admissionDate = null;
      dischargeDate = null;
      transferHistory = [];
      updatedAt = Time.now();
    };
    state.beds.add(id, bed);
    bed;
  };

  public func assignBed(
    state : EngineState,
    _caller : Principal,
    callerRole : Types.StaffRole,
    bedId : Nat,
    patientId : Nat,
    patientName : Text,
  ) : Types.BedRecord {
    if (not canManageBeds(callerRole)) {
      Runtime.trap("Unauthorized: role cannot manage beds");
    };
    let existing = switch (state.beds.get(bedId)) {
      case (null) { Runtime.trap("Bed not found") };
      case (?b) { b };
    };
    if (existing.status == #Occupied) {
      Runtime.trap("Bed is already occupied");
    };
    let updated : Types.BedRecord = {
      existing with
      status = #Occupied;
      patientId = ?patientId;
      patientName = ?patientName;
      admissionDate = ?Time.now();
      dischargeDate = null;
      updatedAt = Time.now();
    };
    state.beds.add(bedId, updated);
    updated;
  };

  public func transferBed(
    state : EngineState,
    _caller : Principal,
    callerRole : Types.StaffRole,
    bedId : Nat,
    newBedId : Nat,
    reason : Text,
  ) : Types.BedRecord {
    if (not canManageBeds(callerRole)) {
      Runtime.trap("Unauthorized: role cannot manage beds");
    };
    let sourceBed = switch (state.beds.get(bedId)) {
      case (null) { Runtime.trap("Source bed not found") };
      case (?b) { b };
    };
    let targetBed = switch (state.beds.get(newBedId)) {
      case (null) { Runtime.trap("Target bed not found") };
      case (?b) { b };
    };
    if (sourceBed.status != #Occupied) {
      Runtime.trap("Source bed is not occupied");
    };
    if (targetBed.status == #Occupied) {
      Runtime.trap("Target bed is already occupied");
    };
    let transferEntry : Types.BedTransferEntry = {
      fromBed = sourceBed.bedNumber;
      toBed = targetBed.bedNumber;
      date = Time.now();
      reason;
    };
    // Free source bed
    let freedSource : Types.BedRecord = {
      sourceBed with
      status = #Empty;
      patientId = null;
      patientName = null;
      dischargeDate = ?Time.now();
      updatedAt = Time.now();
    };
    state.beds.add(bedId, freedSource);
    // Occupy target bed
    let newHistory = targetBed.transferHistory.concat([transferEntry]);
    let occupiedTarget : Types.BedRecord = {
      targetBed with
      status = #Occupied;
      patientId = sourceBed.patientId;
      patientName = sourceBed.patientName;
      admissionDate = sourceBed.admissionDate;
      dischargeDate = null;
      transferHistory = newHistory;
      updatedAt = Time.now();
    };
    state.beds.add(newBedId, occupiedTarget);
    occupiedTarget;
  };

  public func dischargeBed(
    state : EngineState,
    _caller : Principal,
    callerRole : Types.StaffRole,
    bedId : Nat,
  ) : Types.BedRecord {
    if (not canManageBeds(callerRole)) {
      Runtime.trap("Unauthorized: role cannot manage beds");
    };
    let existing = switch (state.beds.get(bedId)) {
      case (null) { Runtime.trap("Bed not found") };
      case (?b) { b };
    };
    let updated : Types.BedRecord = {
      existing with
      status = #Empty;
      patientId = null;
      patientName = null;
      dischargeDate = ?Time.now();
      updatedAt = Time.now();
    };
    state.beds.add(bedId, updated);
    updated;
  };

  public func getAllBedsSince(
    state : EngineState,
    sinceTimestamp : Int,
  ) : [Types.BedRecord] {
    state.beds.values().filter(func (b) { b.updatedAt >= sinceTimestamp }).toArray();
  };

  public func bulkUpsertBeds(
    state : EngineState,
    beds : [Types.BedRecord],
  ) : [Types.BedRecord] {
    beds.map<Types.BedRecord, Types.BedRecord>(func (bed) {
      switch (state.beds.get(bed.id)) {
        case (?existing) {
          if (bed.updatedAt > existing.updatedAt) {
            state.beds.add(bed.id, bed);
            bed;
          } else { existing };
        };
        case (null) {
          if (bed.id >= state.bedIdCounter) {
            state.bedIdCounter := bed.id + 1;
          };
          state.beds.add(bed.id, bed);
          bed;
        };
      };
    });
  };

  public func getAllBeds(state : EngineState) : [Types.BedRecord] {
    state.beds.values().toArray();
  };

  public func getAvailableBeds(state : EngineState) : [Types.BedRecord] {
    state.beds.values().filter(func (b) { b.status == #Empty }).toArray();
  };

  public func getOccupiedBeds(state : EngineState) : [Types.BedRecord] {
    state.beds.values().filter(func (b) { b.status == #Occupied }).toArray();
  };

  // ─── Diagnosis Template Logic ──────────────────────────────────────────────

  public func createDiagnosisTemplate(
    state : EngineState,
    caller : Principal,
    _callerRole : Types.StaffRole,
    diagnosisName : Text,
    diagnosisNameBn : ?Text,
    icdCode : ?Text,
    defaultDrugs : [Text],
    defaultInvestigations : [Text],
    defaultAdvice : [Text],
    defaultAdviceBn : [Text],
  ) : Types.DiagnosisTemplate {
    let id = state.diagnosisTemplateIdCounter;
    state.diagnosisTemplateIdCounter += 1;
    let template : Types.DiagnosisTemplate = {
      id;
      diagnosisName;
      diagnosisNameBn;
      icdCode;
      defaultDrugs;
      defaultInvestigations;
      defaultAdvice;
      defaultAdviceBn;
      createdBy = caller;
      createdAt = Time.now();
      isActive = true;
    };
    state.diagnosisTemplates.add(id, template);
    template;
  };

  public func updateDiagnosisTemplate(
    state : EngineState,
    _caller : Principal,
    _callerRole : Types.StaffRole,
    id : Nat,
    diagnosisName : Text,
    diagnosisNameBn : ?Text,
    icdCode : ?Text,
    defaultDrugs : [Text],
    defaultInvestigations : [Text],
    defaultAdvice : [Text],
    defaultAdviceBn : [Text],
  ) : Types.DiagnosisTemplate {
    let existing = switch (state.diagnosisTemplates.get(id)) {
      case (null) { Runtime.trap("Diagnosis template not found") };
      case (?t) { t };
    };
    let updated : Types.DiagnosisTemplate = {
      existing with
      diagnosisName;
      diagnosisNameBn;
      icdCode;
      defaultDrugs;
      defaultInvestigations;
      defaultAdvice;
      defaultAdviceBn;
    };
    state.diagnosisTemplates.add(id, updated);
    updated;
  };

  public func getAllDiagnosisTemplates(state : EngineState) : [Types.DiagnosisTemplate] {
    state.diagnosisTemplates.values().filter(func (t) { t.isActive }).toArray();
  };

  public func getDiagnosisTemplate(
    state : EngineState,
    id : Nat,
  ) : ?Types.DiagnosisTemplate {
    state.diagnosisTemplates.get(id);
  };

  // ─── Sync Logic ────────────────────────────────────────────────────────────

  public func recordDeviceSync(
    state : EngineState,
    caller : Principal,
    deviceId : Text,
    pendingChanges : Nat,
  ) : Types.SyncRecord {
    let existing = state.syncRecords.get(deviceId);
    let id = switch (existing) {
      case (?r) { r.id };
      case (null) {
        let newId = state.syncRecordIdCounter;
        state.syncRecordIdCounter += 1;
        newId;
      };
    };
    let record : Types.SyncRecord = {
      id;
      deviceId;
      userId = caller;
      lastSyncAt = Time.now();
      pendingChanges;
      lastEntityType = null;
      lastEntityId = null;
    };
    state.syncRecords.add(deviceId, record);
    record;
  };

  public func getLastSyncTime(
    state : EngineState,
    deviceId : Text,
  ) : ?Int {
    switch (state.syncRecords.get(deviceId)) {
      case (null) { null };
      case (?r) { ?r.lastSyncAt };
    };
  };

  // ─── Migration Helper ──────────────────────────────────────────────────────
  // Accepts JSON strings from the frontend (localStorage export) and returns
  // a summary. The actual parsing of JSON is deferred to the frontend which
  // calls individual create* methods per entity. This method acts as an
  // idempotent acknowledgment endpoint — true migration happens entity by entity.

  public func migrateFromLocalStorage(
    patientsJson : Text,
    visitsJson : Text,
    prescriptionsJson : Text,
    appointmentsJson : Text,
  ) : Text {
    // Migration summary: we return a JSON-like summary so the frontend can
    // track what was received. Actual structured parsing requires the frontend
    // to call createPatient / createVisit / etc. per record since Motoko
    // has no JSON parser in mo:core. This is the coordination handshake.
    let summary = "{\"status\":\"received\","
      # "\"patientsJsonLen\":" # patientsJson.size().toText() # ","
      # "\"visitsJsonLen\":" # visitsJson.size().toText() # ","
      # "\"prescriptionsJsonLen\":" # prescriptionsJson.size().toText() # ","
      # "\"appointmentsJsonLen\":" # appointmentsJson.size().toText() # ","
      # "\"note\":\"Use createPatient/createVisit/createPrescription per entity for full migration\"}";
    summary;
  };

  // ─── Appointment Logic ─────────────────────────────────────────────────────

  public func createAppointment(
    state : EngineState,
    _caller : Principal,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
    patientId : ?Nat,
    patientName : Text,
    registerNumber : ?Text,
    phone : ?Text,
    appointmentType : Types.AppointmentType,
    chamberName : ?Text,
    hospitalName : ?Text,
    date : Text,
    timeSlot : ?Text,
    status : Types.AppointmentStatus,
    doctorEmail : Text,
    serialNumber : ?Nat,
    notes : ?Text,
  ) : { #ok : Types.Appointment; #err : Text } {
    // Only admin or the owning doctor can create appointments
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only create appointments for your own account");
    };
    let now = Time.now();
    let appt : Types.Appointment = {
      id;
      patientId;
      patientName;
      registerNumber;
      phone;
      appointmentType;
      chamberName;
      hospitalName;
      date;
      timeSlot;
      status;
      doctorEmail;
      serialNumber;
      notes;
      createdAt = now;
      updatedAt = now;
    };
    state.appointments.add(id, appt);
    #ok(appt);
  };

  public func updateAppointment(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
    patientId : ?Nat,
    patientName : Text,
    registerNumber : ?Text,
    phone : ?Text,
    appointmentType : Types.AppointmentType,
    chamberName : ?Text,
    hospitalName : ?Text,
    date : Text,
    timeSlot : ?Text,
    status : Types.AppointmentStatus,
    serialNumber : ?Nat,
    notes : ?Text,
  ) : { #ok : Types.Appointment; #err : Text } {
    let existing = switch (state.appointments.get(id)) {
      case (null) { return #err("Appointment not found") };
      case (?a) { a };
    };
    if (callerRole != #admin and callerEmail != existing.doctorEmail) {
      return #err("Unauthorized: can only update your own appointments");
    };
    let updated : Types.Appointment = {
      existing with
      patientId;
      patientName;
      registerNumber;
      phone;
      appointmentType;
      chamberName;
      hospitalName;
      date;
      timeSlot;
      status;
      serialNumber;
      notes;
      updatedAt = Time.now();
    };
    state.appointments.add(id, updated);
    #ok(updated);
  };

  public func deleteAppointment(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
  ) : { #ok : (); #err : Text } {
    switch (state.appointments.get(id)) {
      case (null) { return #err("Appointment not found") };
      case (?a) {
        if (callerRole != #admin and callerEmail != a.doctorEmail) {
          return #err("Unauthorized: can only delete your own appointments");
        };
      };
    };
    state.appointments.remove(id);
    #ok(());
  };

  public func getAppointmentById(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
  ) : { #ok : ?Types.Appointment; #err : Text } {
    switch (state.appointments.get(id)) {
      case (null) { #ok(null) };
      case (?a) {
        if (callerRole != #admin and callerEmail != a.doctorEmail) {
          return #err("Unauthorized: can only view your own appointments");
        };
        #ok(?a);
      };
    };
  };

  public func getAppointmentsByDoctor(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    doctorEmail : Text,
    date : Text,
  ) : { #ok : [Types.Appointment]; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only view your own appointments");
    };
    let results = state.appointments.values().filter(func (a) {
      a.doctorEmail == doctorEmail and a.date == date
    }).toArray();
    #ok(results);
  };

  public func getAllAppointmentsByDoctor(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    doctorEmail : Text,
  ) : { #ok : [Types.Appointment]; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only view your own appointments");
    };
    let results = state.appointments.values().filter(func (a) {
      a.doctorEmail == doctorEmail
    }).toArray();
    #ok(results);
  };

  public func getAppointmentsSince(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    doctorEmail : Text,
    sinceTimestamp : Int,
  ) : { #ok : [Types.Appointment]; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only sync your own appointments");
    };
    let results = state.appointments.values().filter(func (a) {
      a.doctorEmail == doctorEmail and a.updatedAt >= sinceTimestamp
    }).toArray();
    #ok(results);
  };

  public func bulkUpsertAppointments(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    appts : [Types.Appointment],
  ) : { #ok : Nat; #err : Text } {
    var count = 0;
    for (a in appts.values()) {
      if (callerRole != #admin and callerEmail != a.doctorEmail) {
        return #err("Unauthorized: can only upsert your own appointments");
      };
      // Idempotent: only overwrite if incoming updatedAt is newer
      switch (state.appointments.get(a.id)) {
        case (?existing) {
          if (a.updatedAt > existing.updatedAt) {
            state.appointments.add(a.id, a);
            count += 1;
          };
        };
        case (null) {
          state.appointments.add(a.id, a);
          count += 1;
        };
      };
    };
    #ok(count);
  };

  // ─── Serial Queue Logic ────────────────────────────────────────────────────

  public func createQueueEntry(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
    date : Text,
    serialNumber : Nat,
    patientName : Text,
    registerNumber : ?Text,
    phone : ?Text,
    status : Types.QueueStatus,
    calledAt : ?Int,
    doctorEmail : Text,
  ) : { #ok : Types.SerialQueueEntry; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only create queue entries for your own account");
    };
    let now = Time.now();
    let entry : Types.SerialQueueEntry = {
      id;
      date;
      serialNumber;
      patientName;
      registerNumber;
      phone;
      status;
      calledAt;
      doctorEmail;
      createdAt = now;
      updatedAt = now;
    };
    state.queueEntries.add(id, entry);
    #ok(entry);
  };

  public func updateQueueEntry(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
    status : Types.QueueStatus,
    calledAt : ?Int,
  ) : { #ok : Types.SerialQueueEntry; #err : Text } {
    let existing = switch (state.queueEntries.get(id)) {
      case (null) { return #err("Queue entry not found") };
      case (?e) { e };
    };
    if (callerRole != #admin and callerEmail != existing.doctorEmail) {
      return #err("Unauthorized: can only update your own queue entries");
    };
    let updated : Types.SerialQueueEntry = {
      existing with
      status;
      calledAt;
      updatedAt = Time.now();
    };
    state.queueEntries.add(id, updated);
    #ok(updated);
  };

  public func deleteQueueEntry(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    id : Text,
  ) : { #ok : (); #err : Text } {
    switch (state.queueEntries.get(id)) {
      case (null) { return #err("Queue entry not found") };
      case (?e) {
        if (callerRole != #admin and callerEmail != e.doctorEmail) {
          return #err("Unauthorized: can only delete your own queue entries");
        };
      };
    };
    state.queueEntries.remove(id);
    #ok(());
  };

  public func getQueueByDateAndDoctor(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    date : Text,
    doctorEmail : Text,
  ) : { #ok : [Types.SerialQueueEntry]; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only view your own queue");
    };
    let results = state.queueEntries.values().filter(func (e) {
      e.date == date and e.doctorEmail == doctorEmail
    }).toArray();
    #ok(results);
  };

  public func clearQueueByDate(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    date : Text,
    doctorEmail : Text,
  ) : { #ok : Nat; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only clear your own queue");
    };
    let toRemove = state.queueEntries.values().filter(func (e) {
      e.date == date and e.doctorEmail == doctorEmail
    }).toArray();
    for (e in toRemove.values()) {
      state.queueEntries.remove(e.id);
    };
    #ok(toRemove.size());
  };

  public func getQueueEntriesSince(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    doctorEmail : Text,
    sinceTimestamp : Int,
  ) : { #ok : [Types.SerialQueueEntry]; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only sync your own queue entries");
    };
    let results = state.queueEntries.values().filter(func (e) {
      e.doctorEmail == doctorEmail and e.updatedAt >= sinceTimestamp
    }).toArray();
    #ok(results);
  };

  public func bulkUpsertQueueEntries(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    entries : [Types.SerialQueueEntry],
  ) : { #ok : Nat; #err : Text } {
    var count = 0;
    for (e in entries.values()) {
      if (callerRole != #admin and callerEmail != e.doctorEmail) {
        return #err("Unauthorized: can only upsert your own queue entries");
      };
      // Idempotent: only overwrite if incoming updatedAt is newer
      switch (state.queueEntries.get(e.id)) {
        case (?existing) {
          if (e.updatedAt > existing.updatedAt) {
            state.queueEntries.add(e.id, e);
            count += 1;
          };
        };
        case (null) {
          state.queueEntries.add(e.id, e);
          count += 1;
        };
      };
    };
    #ok(count);
  };

  // ─── Full Sync Data ────────────────────────────────────────────────────────
  // Returns all appointments and queue entries in one call for device bootstrap.

  public func getFullSyncData(
    state : EngineState,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    doctorEmail : Text,
  ) : { #ok : Types.SyncData; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only sync your own data");
    };
    let appointments = state.appointments.values().filter(func (a) {
      a.doctorEmail == doctorEmail
    }).toArray();
    let queueEntries = state.queueEntries.values().filter(func (e) {
      e.doctorEmail == doctorEmail
    }).toArray();
    #ok({
      appointments;
      queueEntries;
      timestamp = Time.now();
    });
  };

  // ─── Canister Timestamp ────────────────────────────────────────────────────

  public func getLastSyncTimestamp() : Int {
    Time.now();
  };

  // ─── Handover Logic ────────────────────────────────────────────────────────

  public func createHandover(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    shift : Types.HandoverShift,
    shiftStartTime : Int,
    shiftEndTime : Int,
    patientName : Text,
    registerNumber : ?Text,
    ward : ?Text,
    bedNumber : ?Text,
    diagnosis : ?Text,
    dayOfStay : ?Nat,
    currentConsultant : ?Text,
    clinicalSummary : Text,
    vitalsSummary : ?Text,
    actionableItems : [Text],
    tasksPending : [Text],
    pendingInvestigations : [Text],
    pendingProcedures : [Text],
    missedMedications : [Text],
  ) : Types.HandoverEntry {
    let id = state.handoverIdCounter;
    state.handoverIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    let now = Time.now();
    let entry : Types.HandoverEntry = {
      id;
      patientId;
      shift;
      shiftStartTime;
      shiftEndTime;
      status = #draft;
      patientName;
      registerNumber;
      ward;
      bedNumber;
      diagnosis;
      dayOfStay;
      currentConsultant;
      clinicalSummary;
      vitalsSummary;
      actionableItems;
      tasksPending;
      pendingInvestigations;
      pendingProcedures;
      missedMedications;
      givenByName = callerName;
      givenByRole = callerRole;
      givenByPrincipal = caller;
      takenByName = null;
      takenByRole = null;
      takenByPrincipal = null;
      consultantComment = null;
      consultantCommentAt = null;
      consultantCommentBy = null;
      createdAt = now;
      updatedAt = now;
      versionInfo;
    };
    state.handovers.add(id, entry);
    addAudit(state, "Handover", id, "created", null, "Handover-" # id.toText(), caller, callerName, callerRole, null);
    entry;
  };

  public func getHandover(
    state : EngineState,
    id : Nat,
  ) : ?Types.HandoverEntry {
    state.handovers.get(id);
  };

  public func getHandoversByPatientId(
    state : EngineState,
    patientId : Nat,
  ) : [Types.HandoverEntry] {
    state.handovers.values().filter(func (h) { h.patientId == patientId }).toArray();
  };

  public func getAllHandoversSince(
    state : EngineState,
    sinceTimestamp : Int,
  ) : [Types.HandoverEntry] {
    state.handovers.values().filter(func (h) { h.updatedAt >= sinceTimestamp }).toArray();
  };

  public func bulkUpsertHandovers(
    state : EngineState,
    handovers : [Types.HandoverEntry],
  ) : [Types.HandoverEntry] {
    handovers.map<Types.HandoverEntry, Types.HandoverEntry>(func (h) {
      switch (state.handovers.get(h.id)) {
        case (?existing) {
          if (h.updatedAt > existing.updatedAt) {
            state.handovers.add(h.id, h);
            h;
          } else { existing };
        };
        case (null) {
          if (h.id >= state.handoverIdCounter) {
            state.handoverIdCounter := h.id + 1;
          };
          state.handovers.add(h.id, h);
          h;
        };
      };
    });
  };

  public func updateHandover(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
    clinicalSummary : Text,
    vitalsSummary : ?Text,
    actionableItems : [Text],
    tasksPending : [Text],
    pendingInvestigations : [Text],
    pendingProcedures : [Text],
    missedMedications : [Text],
    takenByName : ?Text,
    takenByRole : ?Types.StaffRole,
    takenByPrincipal : ?Principal,
    consultantComment : ?Text,
    status : Types.HandoverStatus,
  ) : Types.HandoverEntry {
    let existing = switch (state.handovers.get(id)) {
      case (null) { Runtime.trap("Handover not found") };
      case (?h) { h };
    };
    // Submitted handovers can only be commented on by consultant/registrar/admin
    let canEditSubmitted = callerRole == #admin or callerRole == #registrar or isConsultantType(callerRole);
    if (existing.status == #submitted and not canEditSubmitted) {
      Runtime.trap("Unauthorized: submitted handovers cannot be edited");
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, null);
    let updated : Types.HandoverEntry = {
      existing with
      clinicalSummary;
      vitalsSummary;
      actionableItems;
      tasksPending;
      pendingInvestigations;
      pendingProcedures;
      missedMedications;
      takenByName;
      takenByRole;
      takenByPrincipal;
      consultantComment;
      consultantCommentAt = switch (consultantComment) {
        case (?_) { ?Time.now() };
        case (null) { existing.consultantCommentAt };
      };
      consultantCommentBy = switch (consultantComment) {
        case (?_) { ?caller };
        case (null) { existing.consultantCommentBy };
      };
      status;
      updatedAt = Time.now();
      versionInfo = newVersion;
    };
    state.handovers.add(id, updated);
    addAudit(state, "Handover", id, "updated", null, debug_show(status), caller, callerName, callerRole, null);
    updated;
  };

  // ─── Daily Progress Note Logic ─────────────────────────────────────────────

  public func createDailyProgressNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    encounterId : ?Nat,
    progressType : Types.DailyProgressType,
    noteDate : Text,
    subjectiveComplaints : [Text],
    systemReview : ?Text,
    objectiveVitals : ?Text,
    intakeOutput : ?Text,
    drainMonitoring : ?Text,
    investigations : [Text],
    assessmentText : Text,
    planText : Text,
    activeComplaints : [Text],
    activeDiagnoses : [Text],
    isDraft : Bool,
  ) : Types.DailyProgressNote {
    // Interns can only create draft notes
    if (callerRole == #intern_doctor and not isDraft) {
      Runtime.trap("Unauthorized: Intern doctors can only create draft progress notes");
    };
    let id = state.dailyProgressNoteIdCounter;
    state.dailyProgressNoteIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    let now = Time.now();
    let note : Types.DailyProgressNote = {
      id;
      patientId;
      encounterId;
      progressType;
      noteDate;
      subjectiveComplaints;
      systemReview;
      objectiveVitals;
      intakeOutput;
      drainMonitoring;
      investigations;
      assessmentText;
      planText;
      activeComplaints;
      activeDiagnoses;
      noteState = #draft;
      submittedByRole = null;
      submitTimestamp = null;
      reviewedByMO = null;
      reviewedByConsultant = null;
      consultantComments = "";
      internSubjective = if (callerRole == #intern_doctor) assessmentText else "";
      internObjective = switch (if (callerRole == #intern_doctor) objectiveVitals else null) { case (?v) v; case (null) "" };
      moAssessment = "";
      moPlan = "";
      consultantOverrides = "";
      versionChain = [];
      rejectionReason = null;
      authorId = caller;
      authorName = callerName;
      authorRole = callerRole;
      isDraft;
      createdAt = now;
      updatedAt = now;
      versionInfo;
      previousVersionIds = [];
      isDeleted = false;
    };
    state.dailyProgressNotes.add(id, note);
    addAudit(state, "DailyProgressNote", id, "created", null, noteDate # "-" # debug_show(progressType), caller, callerName, callerRole, null);
    note;
  };

  public func getDailyProgressNotesByPatientId(
    state : EngineState,
    patientId : Nat,
  ) : [Types.DailyProgressNote] {
    state.dailyProgressNotes.values().filter(func (n) {
      n.patientId == patientId and not n.isDeleted
    }).toArray();
  };

  public func getDailyProgressNotesSince(
    state : EngineState,
    sinceTimestamp : Int,
  ) : [Types.DailyProgressNote] {
    state.dailyProgressNotes.values().filter(func (n) {
      n.updatedAt >= sinceTimestamp and not n.isDeleted
    }).toArray();
  };

  public func bulkUpsertDailyProgressNotes(
    state : EngineState,
    notes : [Types.DailyProgressNote],
  ) : [Types.DailyProgressNote] {
    notes.map<Types.DailyProgressNote, Types.DailyProgressNote>(func (note) {
      switch (state.dailyProgressNotes.get(note.id)) {
        case (?existing) {
          // Finalized notes are immutable — only accept addenda (higher version)
          if (existing.noteState == #finalized and note.noteState != #finalized) {
            existing;
          } else if (note.updatedAt > existing.updatedAt) {
            state.dailyProgressNotes.add(note.id, note);
            note;
          } else { existing };
        };
        case (null) {
          if (note.id >= state.dailyProgressNoteIdCounter) {
            state.dailyProgressNoteIdCounter := note.id + 1;
          };
          state.dailyProgressNotes.add(note.id, note);
          note;
        };
      };
    });
  };

  public func updateDailyProgressNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
    subjectiveComplaints : [Text],
    systemReview : ?Text,
    objectiveVitals : ?Text,
    intakeOutput : ?Text,
    drainMonitoring : ?Text,
    investigations : [Text],
    assessmentText : Text,
    planText : Text,
    activeComplaints : [Text],
    activeDiagnoses : [Text],
    isDraft : Bool,
    changeReason : ?Text,
  ) : Types.DailyProgressNote {
    let existing = switch (state.dailyProgressNotes.get(id)) {
      case (null) { Runtime.trap("Daily progress note not found") };
      case (?n) { n };
    };
    if (callerRole == #intern_doctor and not isDraft) {
      Runtime.trap("Unauthorized: Intern doctors can only save draft progress notes");
    };
    // Block edits to finalized notes
    if (existing.noteState == #finalized) {
      Runtime.trap("Unauthorized: finalized notes are immutable");
    };
    // Archive existing version
    let archiveId = state.dailyProgressNoteIdCounter;
    state.dailyProgressNoteIdCounter += 1;
    let archived : Types.DailyProgressNote = {
      existing with
      id = archiveId;
      isDeleted = true;
    };
    state.dailyProgressNotes.add(archiveId, archived);
    let prevIds = existing.previousVersionIds.concat([archiveId]);
    let newVersionChain = existing.versionChain.concat([archiveId.toText()]);
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, changeReason);
    // Role-based field updates
    let updatedInternSubjective = if (callerRole == #intern_doctor) assessmentText else existing.internSubjective;
    let updatedInternObjective = if (callerRole == #intern_doctor) {
      switch (objectiveVitals) { case (?v) v; case (null) existing.internObjective }
    } else { existing.internObjective };
    let updatedMoAssessment = if (callerRole == #medical_officer) assessmentText else existing.moAssessment;
    let updatedMoPlan = if (callerRole == #medical_officer) planText else existing.moPlan;
    let updated : Types.DailyProgressNote = {
      existing with
      subjectiveComplaints;
      systemReview;
      objectiveVitals;
      intakeOutput;
      drainMonitoring;
      investigations;
      assessmentText;
      planText;
      activeComplaints;
      activeDiagnoses;
      internSubjective = updatedInternSubjective;
      internObjective = updatedInternObjective;
      moAssessment = updatedMoAssessment;
      moPlan = updatedMoPlan;
      isDraft;
      updatedAt = Time.now();
      versionInfo = newVersion;
      previousVersionIds = prevIds;
      versionChain = newVersionChain;
    };
    state.dailyProgressNotes.add(id, updated);
    addAudit(state, "DailyProgressNote", id, "updated", null, assessmentText, caller, callerName, callerRole, changeReason);
    updated;
  };

  // ─── Ward Round: Submit Note for Review ────────────────────────────────────

  // Intern submits → #submittedToMO
  // MO submits   → #moReviewComplete
  public func submitDailyNoteForReview(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    noteId : Nat,
    noteContent : Types.DailyProgressNoteUpdate,
  ) : { #ok : Types.DailyProgressNote; #err : Text } {
    // Intern, MO, and any registrar/consultant-type can submit for review
    let canSubmit = switch (callerRole) {
      case (#intern_doctor or #medical_officer or #assistant_registrar or #registrar) { true };
      case (_) { isConsultantType(callerRole) or callerRole == #admin };
    };
    if (not canSubmit) {
      return #err("Unauthorized: only Intern, MO, or above can submit notes for review");
    };
    let existing = switch (state.dailyProgressNotes.get(noteId)) {
      case (null) { return #err("Daily progress note not found") };
      case (?n) { n };
    };
    if (existing.patientId != patientId) {
      return #err("Note does not belong to this patient");
    };
    if (existing.noteState == #finalized) {
      return #err("Cannot submit a finalized note");
    };
    let targetState : Types.DailyNoteState = switch (callerRole) {
      case (#intern_doctor) { #submittedToMO };
      case (_) { #moReviewComplete };
    };
    let now = Time.now();
    let archiveId = state.dailyProgressNoteIdCounter;
    state.dailyProgressNoteIdCounter += 1;
    let archived : Types.DailyProgressNote = { existing with id = archiveId; isDeleted = true };
    state.dailyProgressNotes.add(archiveId, archived);
    let prevIds = existing.previousVersionIds.concat([archiveId]);
    let newVersionChain = existing.versionChain.concat([archiveId.toText()]);
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"submitted for review");
    let updated : Types.DailyProgressNote = {
      existing with
      subjectiveComplaints = noteContent.subjectiveComplaints;
      systemReview = noteContent.systemReview;
      objectiveVitals = noteContent.objectiveVitals;
      intakeOutput = noteContent.intakeOutput;
      drainMonitoring = noteContent.drainMonitoring;
      investigations = noteContent.investigations;
      assessmentText = noteContent.assessmentText;
      planText = noteContent.planText;
      activeComplaints = noteContent.activeComplaints;
      activeDiagnoses = noteContent.activeDiagnoses;
      internSubjective = if (callerRole == #intern_doctor) noteContent.internSubjective else existing.internSubjective;
      internObjective = if (callerRole == #intern_doctor) noteContent.internObjective else existing.internObjective;
      moAssessment = if (callerRole == #medical_officer) noteContent.moAssessment else existing.moAssessment;
      moPlan = if (callerRole == #medical_officer) noteContent.moPlan else existing.moPlan;
      consultantOverrides = noteContent.consultantOverrides;
      consultantComments = noteContent.consultantComments;
      noteState = targetState;
      submittedByRole = ?callerRole;
      submitTimestamp = ?now;
      reviewedByMO = if (callerRole == #medical_officer) ?caller.toText() else existing.reviewedByMO;
      isDraft = false;
      rejectionReason = null;
      updatedAt = now;
      versionInfo = newVersion;
      previousVersionIds = prevIds;
      versionChain = newVersionChain;
    };
    state.dailyProgressNotes.add(noteId, updated);
    let prevStateText = debug_show(existing.noteState);
    let newStateText = debug_show(targetState);
    addAudit(state, "DailyProgressNote", noteId, "noteState", ?prevStateText, newStateText, caller, callerName, callerRole, ?"submitted for review");
    #ok(updated);
  };

  // ─── Ward Round: Finalize Note (Consultant locks) ──────────────────────────

  public func finalizeDailyNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    noteId : Nat,
    consultantEmail : Text,
    consultantComments : Text,
    finalSOAP : Types.DailyProgressNoteUpdate,
  ) : { #ok : Types.DailyProgressNote; #err : Text } {
    // Consultant-type roles, admin, MO, or Registrar can finalize
    let canFinalize = switch (callerRole) {
      case (#admin or #doctor or #medical_officer or #registrar) { true };
      case (_) { isConsultantType(callerRole) };
    };
    if (not canFinalize) {
      return #err("Unauthorized: only Consultant or MO can finalize a ward round note");
    };
    let existing = switch (state.dailyProgressNotes.get(noteId)) {
      case (null) { return #err("Daily progress note not found") };
      case (?n) { n };
    };
    if (existing.patientId != patientId) {
      return #err("Note does not belong to this patient");
    };
    if (existing.noteState == #finalized) {
      return #err("Note is already finalized");
    };
    let now = Time.now();
    let archiveId = state.dailyProgressNoteIdCounter;
    state.dailyProgressNoteIdCounter += 1;
    let archived : Types.DailyProgressNote = { existing with id = archiveId; isDeleted = true };
    state.dailyProgressNotes.add(archiveId, archived);
    let prevIds = existing.previousVersionIds.concat([archiveId]);
    let newVersionChain = existing.versionChain.concat([archiveId.toText()]);
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"finalized by consultant");
    let finalized : Types.DailyProgressNote = {
      existing with
      subjectiveComplaints = finalSOAP.subjectiveComplaints;
      systemReview = finalSOAP.systemReview;
      objectiveVitals = finalSOAP.objectiveVitals;
      intakeOutput = finalSOAP.intakeOutput;
      drainMonitoring = finalSOAP.drainMonitoring;
      investigations = finalSOAP.investigations;
      assessmentText = finalSOAP.assessmentText;
      planText = finalSOAP.planText;
      activeComplaints = finalSOAP.activeComplaints;
      activeDiagnoses = finalSOAP.activeDiagnoses;
      moAssessment = if (finalSOAP.moAssessment != "") finalSOAP.moAssessment else existing.moAssessment;
      moPlan = if (finalSOAP.moPlan != "") finalSOAP.moPlan else existing.moPlan;
      consultantOverrides = finalSOAP.consultantOverrides;
      consultantComments;
      noteState = #finalized;
      reviewedByConsultant = ?consultantEmail;
      isDraft = false;
      rejectionReason = null;
      updatedAt = now;
      versionInfo = newVersion;
      previousVersionIds = prevIds;
      versionChain = newVersionChain;
    };
    state.dailyProgressNotes.add(noteId, finalized);
    addAudit(state, "DailyProgressNote", noteId, "noteState", ?debug_show(existing.noteState), "finalized", caller, callerName, callerRole, ?consultantComments);
    #ok(finalized);
  };

  // ─── Ward Round: Reject Draft Note ────────────────────────────────────────────

  public func rejectDraftNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    noteId : Nat,
    reviewerEmail : Text,
    rejectionReason : Text,
  ) : { #ok : Types.DailyProgressNote; #err : Text } {
    let canReject = switch (callerRole) {
      case (#medical_officer or #admin or #doctor or #registrar or #assistant_registrar) { true };
      case (_) { isConsultantType(callerRole) };
    };
    if (not canReject) {
      return #err("Unauthorized: only MO or Consultant can reject notes");
    };
    let existing = switch (state.dailyProgressNotes.get(noteId)) {
      case (null) { return #err("Daily progress note not found") };
      case (?n) { n };
    };
    if (existing.patientId != patientId) {
      return #err("Note does not belong to this patient");
    };
    if (existing.noteState == #finalized) {
      return #err("Cannot reject a finalized note");
    };
    let now = Time.now();
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?rejectionReason);
    let rejected : Types.DailyProgressNote = {
      existing with
      noteState = #rejected;
      rejectionReason = ?rejectionReason;
      reviewedByMO = if (callerRole == #medical_officer) ?reviewerEmail else existing.reviewedByMO;
      isDraft = true;
      updatedAt = now;
      versionInfo = newVersion;
    };
    state.dailyProgressNotes.add(noteId, rejected);
    addAudit(state, "DailyProgressNote", noteId, "noteState", ?debug_show(existing.noteState), "rejected", caller, callerName, callerRole, ?rejectionReason);
    #ok(rejected);
  };

  // ─── Ward Round: Get Daily Notes by Patient (with date filter) ───────────────

  public func getDailyNotesByPatient(
    state : EngineState,
    patientId : Nat,
    dateFilter : ?Text,
  ) : [Types.DailyProgressNote] {
    state.dailyProgressNotes.values().filter(func (n) {
      n.patientId == patientId and not n.isDeleted and
      (switch (dateFilter) {
        case (null) { true };
        case (?d)   { n.noteDate == d };
      })
    }).toArray();
  };

  // ─── Ward Round: Status Overview (all admitted patients for a given date) ───────

  public func getWardRoundStatus(
    state : EngineState,
    date : Text,
  ) : [Types.WardRoundPatientStatus] {
    // Collect all occupied beds
    let occupiedBeds = state.beds.values()
      .filter(func (b) { b.status == #Occupied })
      .toArray();

    occupiedBeds.filterMap<Types.BedRecord, Types.WardRoundPatientStatus>(func (bed : Types.BedRecord) : ?Types.WardRoundPatientStatus {
      let patId = switch (bed.patientId) { case (?id) { id }; case (null) { return null } };
      // Find today's daily note (non-deleted) for this patient
      let todayNotes = state.dailyProgressNotes.values()
        .filter(func (n) { n.patientId == patId and n.noteDate == date and not n.isDeleted })
        .toArray();
      let todayNoteState : ?Text = switch (todayNotes.size()) {
        case (0) { null };
        case (_) {
          let latest = todayNotes.sort(func (a : Types.DailyProgressNote, b : Types.DailyProgressNote) : Order.Order { Int.compare(b.updatedAt, a.updatedAt) });
          ?debug_show(latest[0].noteState);
        };
      };
      // Most recent vitals for this patient
      let vitalsObs = state.observations.values()
        .filter(func (o) { o.patientId == patId and o.observationType == #Vital and not o.isDeleted })
        .toArray()
        .sort(func (a : Types.Observation, b : Types.Observation) : Order.Order { Int.compare(b.observationDate, a.observationDate) });
      let lastVitals : ?Types.VitalsSummary = if (vitalsObs.size() == 0) {
        null
      } else {
        let ts = vitalsObs[0].observationDate;
        let getVal = func(code : Text) : ?Text {
          switch (vitalsObs.find(func (o : Types.Observation) : Bool { o.code == code })) {
            case (?o) { ?o.value };
            case (null) { null };
          }
        };
        ?{
          bp  = getVal("BP_SYSTOLIC");
          pulse = getVal("PULSE");
          spo2  = getVal("SPO2");
          temp  = getVal("TEMPERATURE");
          rbs   = getVal("RBS");
          rr    = getVal("RR");
          recordedAt = ts;
        };
      };
      // Active unresolved alerts
      let activeAlerts = state.alerts.values()
        .filter(func (a : Types.ClinicalAlert) : Bool { a.patientId == patId and not a.isResolved })
        .toArray()
        .map(func (a) { a.message });
      // Admission day count
      let admissionDay : Nat = switch (bed.admissionDate) {
        case (null) { 0 };
        case (?admitTs) {
          let diffNs = Time.now() - admitTs;
          if (diffNs <= 0) { 1 } else {
            let days : Int = diffNs / 86_400_000_000_000;
            days.toNat() + 1;
          };
        };
      };
      // Assigned consultant via most recent in-progress encounter
      let activeEncounters = state.encounters.values()
        .filter(func (e) { e.patientId == patId and e.status == #InProgress })
        .toArray()
        .sort(func (a : Types.Encounter, b : Types.Encounter) : Order.Order { Int.compare(b.startDate, a.startDate) });
      let assignedConsultant : ?Text = if (activeEncounters.size() == 0) { null } else { ?activeEncounters[0].providerName };
      ?{
        patientId = patId.toText();
        patientName = switch (bed.patientName) { case (?n) n; case (null) "Unknown" };
        bedNumber = bed.bedNumber;
        ward = bed.ward;
        admissionDay;
        todayNoteState;
        lastVitals;
        activeAlerts;
        assignedConsultant;
      };
    });
  };

  // ─── Ward Round: Add Post-Finalization Addendum (Consultant only) ───────────

  public func addNoteAddendum(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    noteId : Nat,
    addendumText : Text,
  ) : { #ok : Types.DailyProgressNote; #err : Text } {
    let canAddendum = switch (callerRole) {
      case (#admin or #doctor) { true };
      case (_) { isConsultantType(callerRole) };
    };
    if (not canAddendum) {
      return #err("Unauthorized: only Consultant can add addenda to finalized notes");
    };
    let existing = switch (state.dailyProgressNotes.get(noteId)) {
      case (null) { return #err("Daily progress note not found") };
      case (?n) { n };
    };
    if (existing.patientId != patientId) {
      return #err("Note does not belong to this patient");
    };
    if (existing.noteState != #finalized) {
      return #err("Addenda can only be appended to finalized notes");
    };
    let now = Time.now();
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"addendum");
    let appendedComments = existing.consultantComments # "\n[ADDENDUM " # now.toText() # " by " # callerName # "]: " # addendumText;
    let updated : Types.DailyProgressNote = {
      existing with
      consultantComments = appendedComments;
      updatedAt = now;
      versionInfo = newVersion;
    };
    state.dailyProgressNotes.add(noteId, updated);
    addAudit(state, "DailyProgressNote", noteId, "addendum", null, addendumText, caller, callerName, callerRole, ?"post-finalization addendum");
    #ok(updated);
  };

  // ─── Medication Administration Logic ───────────────────────────────────────

  // Records a medication administration event (Given / NotGiven / Delayed).
  // When the same medication is marked NotGiven twice consecutively for a patient,
  // a #MissedDoseEscalation #Critical alert is automatically raised.

  public func recordMedicationAdministration(
    state : EngineState,
    patientId : Nat,
    medicationName : Text,
    dose : Text,
    scheduledTime : Int,
    administeredAt : ?Int,
    status : Types.MedicationAdministrationStatus,
    missedReason : ?Text,
    recordedBy : Text,
    recordedByRole : Text,
  ) : Types.MedicationAdministration {
    let id = state.medicationAdministrationIdCounter;
    state.medicationAdministrationIdCounter += 1;
    let now = Time.now();
    let record : Types.MedicationAdministration = {
      id;
      medicationName;
      patientId;
      dose;
      scheduledTime;
      administeredAt;
      status;
      missedReason;
      recordedBy;
      recordedByRole;
      createdAt = now;
      updatedAt = now;
    };
    state.medicationAdministrations.add(id, record);

    // Consecutive-miss escalation check (only for #NotGiven)
    switch (status) {
      case (#NotGiven) {
        // Count how many of the last N records for this patient+medication are NotGiven
        let recent = state.medicationAdministrations.values()
          .filter(func (r : Types.MedicationAdministration) : Bool {
            r.patientId == patientId and r.medicationName == medicationName
          })
          .toArray()
          .sort(func (a : Types.MedicationAdministration, b : Types.MedicationAdministration) : Order.Order {
            Int.compare(b.createdAt, a.createdAt)
          });
        // Check if the 2 most recent (including this one) are both NotGiven
        var consecutiveMisses = 0;
        var idx = 0;
        while (idx < recent.size() and consecutiveMisses < 2) {
          switch (recent[idx].status) {
            case (#NotGiven) { consecutiveMisses += 1 };
            case (_) { idx := recent.size() }; // break on non-miss
          };
          idx += 1;
        };
        if (consecutiveMisses >= 2) {
          let alertId = state.alertIdCounter;
          state.alertIdCounter += 1;
          state.alerts.add(alertId, {
            id = alertId;
            patientId;
            alertType = #MissedDoseEscalation;
            severity = #Critical;
            message = "MISSED DOSE ESCALATION: " # medicationName # " missed " # consecutiveMisses.toText() # " consecutive time(s) for patient ID " # patientId.toText() # " — immediate review required";
            details = ?("Recorded by: " # recordedBy # " (" # recordedByRole # ") at " # now.toText());
            triggeredAt = now;
            triggeredBy = "Auto-detection: Consecutive missed doses";
            isAcknowledged = false;
            acknowledgedBy = null;
            acknowledgedAt = null;
            isResolved = false;
            resolvedAt = null;
          });
        };
      };
      case (_) {};
    };

    record;
  };

  public func getMedicationAdministrationsByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.MedicationAdministration] {
    state.medicationAdministrations.values()
      .filter(func (r) { r.patientId == patientId })
      .toArray();
  };

  public func getAllMedicationAdministrationsSince(
    state : EngineState,
    sinceTimestamp : Int,
  ) : [Types.MedicationAdministration] {
    state.medicationAdministrations.values()
      .filter(func (r) { r.updatedAt >= sinceTimestamp })
      .toArray();
  };

  public func bulkUpsertMedicationAdministrations(
    state : EngineState,
    records : [Types.MedicationAdministration],
  ) : [Types.MedicationAdministration] {
    records.map<Types.MedicationAdministration, Types.MedicationAdministration>(func (rec) {
      switch (state.medicationAdministrations.get(rec.id)) {
        case (?existing) {
          if (rec.updatedAt > existing.updatedAt) {
            state.medicationAdministrations.add(rec.id, rec);
            rec;
          } else { existing };
        };
        case (null) {
          if (rec.id >= state.medicationAdministrationIdCounter) {
            state.medicationAdministrationIdCounter := rec.id + 1;
          };
          state.medicationAdministrations.add(rec.id, rec);
          rec;
        };
      };
    });
  };

  // ─── Prescription Logic ────────────────────────────────────────────────────

  public func createPrescription(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    patientId : Nat,
    encounterId : ?Nat,
    medications : [Types.Medication],
    diagnoses : [Text],
    advice : [Text],
    followUpDate : ?Int,
    followUpCreatesAppointment : Bool,
    isDraft : Bool,
  ) : Types.Prescription {
    // Interns can only save drafts
    if (callerRole == #intern_doctor and not isDraft) {
      Runtime.trap("Unauthorized: Intern doctors can only create draft prescriptions");
    };
    let id = state.prescriptionIdCounter;
    state.prescriptionIdCounter += 1;
    let versionInfo = makeVersionedRecord(1, caller, callerName, callerRole, null);
    let now = Time.now();
    let prescription : Types.Prescription = {
      id;
      patientId;
      encounterId;
      medications;
      diagnoses;
      advice;
      followUpDate;
      followUpCreatesAppointment;
      isDraft;
      isFinalized = not isDraft;
      authorId = caller;
      authorName = callerName;
      authorRole = callerRole;
      createdAt = now;
      updatedAt = now;
      versionInfo;
      isDeleted = false;
    };
    state.prescriptions.add(id, prescription);
    addAudit(state, "Prescription", id, "created", null, debug_show(isDraft), caller, callerName, callerRole, null);
    prescription;
  };

  public func finalizePrescription(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
  ) : Types.Prescription {
    if (not canFinalizeClinicalNote(callerRole)) {
      Runtime.trap("Unauthorized: role cannot finalize prescriptions");
    };
    let existing = switch (state.prescriptions.get(id)) {
      case (null) { Runtime.trap("Prescription not found") };
      case (?p) { p };
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"finalized");
    let updated : Types.Prescription = {
      existing with
      isDraft = false;
      isFinalized = true;
      updatedAt = Time.now();
      versionInfo = newVersion;
    };
    state.prescriptions.add(id, updated);
    addAudit(state, "Prescription", id, "finalized", ?"draft", "finalized", caller, callerName, callerRole, null);
    updated;
  };

  public func getPrescriptionsByPatient(
    state : EngineState,
    patientId : Nat,
  ) : [Types.Prescription] {
    state.prescriptions.values().filter(func (p) {
      p.patientId == patientId and not p.isDeleted
    }).toArray();
  };

  public func getPrescriptionsAwaitingApproval(state : EngineState) : [Types.Prescription] {
    state.prescriptions.values().filter(func (p) {
      p.isDraft and p.authorRole == #intern_doctor and not p.isDeleted
    }).toArray();
  };

  // Creates a follow-up appointment from a prescription follow-up date.
  // Returns the appointment record or an error.

  public func createFollowUpAppointment(
    state : EngineState,
    _caller : Principal,
    callerRole : Types.StaffRole,
    callerEmail : Text,
    prescriptionId : Nat,
    followUpDate : Int,
    patientId : Nat,
    patientName : Text,
    doctorEmail : Text,
  ) : { #ok : Types.Appointment; #err : Text } {
    if (callerRole != #admin and callerEmail != doctorEmail) {
      return #err("Unauthorized: can only create follow-up appointments for your own patients");
    };
    let apptId = "FOLLOWUP-" # prescriptionId.toText() # "-" # patientId.toText();
    let now = Time.now();
    let appt : Types.Appointment = {
      id = apptId;
      patientId = ?patientId;
      patientName;
      registerNumber = null;
      phone = null;
      appointmentType = #chamber;
      chamberName = null;
      hospitalName = null;
      date = "followup-" # followUpDate.toText();
      timeSlot = null;
      status = #pending;
      doctorEmail;
      serialNumber = null;
      notes = ?("Auto-created follow-up from prescription #" # prescriptionId.toText());
      createdAt = now;
      updatedAt = now;
    };
    state.appointments.add(apptId, appt);
    #ok(appt);
  };

  // ─── AI Suggestion Audit ───────────────────────────────────────────────────

  // Records an "Accepted AI suggestion" audit event so AI-assisted decisions
  // are traceable in the medico-legal audit trail.

  public func recordAISuggestionAccepted(
    state : EngineState,
    patientId : Nat,
    suggestionType : Text,
    suggestionText : Text,
    confidence : Float,
    doctorEmail : Text,
    doctorRole : Types.StaffRole,
    doctorPrincipal : Principal,
  ) {
    let afterValue = "{\"type\":\"" # suggestionType # "\",\"text\":\"" # suggestionText # "\",\"confidence\":" # confidence.toText() # "}";
    addAudit(
      state,
      "ai_suggestion",
      patientId,
      "AI_SUGGESTION_ACCEPTED",
      ?"",
      afterValue,
      doctorPrincipal,
      doctorEmail,
      doctorRole,
      ?("AI suggestion accepted — type: " # suggestionType),
    );
  };

  // ─── Notes Awaiting Approval (intern drafts) ───────────────────────────────

  public func getNotesAwaitingApproval(state : EngineState) : [Types.ClinicalNote] {
    state.notes.values().filter(func (n) {
      n.isDraft and n.authorRole == #intern_doctor and not n.isDeleted
    }).toArray();
  };

  // Flip isDraft=false on a note — requires MO/Consultant/Admin.
  public func finalizeNote(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
  ) : Types.ClinicalNote {
    if (not canFinalizeClinicalNote(callerRole)) {
      Runtime.trap("Unauthorized: role cannot finalize notes");
    };
    let existing = switch (state.notes.get(id)) {
      case (null) { Runtime.trap("Clinical note not found") };
      case (?n) { n };
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"approved");
    let updated : Types.ClinicalNote = {
      existing with
      isDraft = false;
      versionInfo = newVersion;
    };
    state.notes.add(id, updated);
    addAudit(state, "ClinicalNote", id, "isDraft", ?"true", "false", caller, callerName, callerRole, ?("Approved by " # callerName));
    updated;
  };

  // ─── Handover Acknowledgment ───────────────────────────────────────────────

  public func acknowledgeHandover(
    state : EngineState,
    caller : Principal,
    callerName : Text,
    callerRole : Types.StaffRole,
    id : Nat,
  ) : Types.HandoverEntry {
    let existing = switch (state.handovers.get(id)) {
      case (null) { Runtime.trap("Handover not found") };
      case (?h) { h };
    };
    let newVersion = makeVersionedRecord(existing.versionInfo.version + 1, caller, callerName, callerRole, ?"acknowledged");
    let updated : Types.HandoverEntry = {
      existing with
      takenByName = ?callerName;
      takenByRole = ?callerRole;
      takenByPrincipal = ?caller;
      updatedAt = Time.now();
      versionInfo = newVersion;
    };
    state.handovers.add(id, updated);
    addAudit(state, "Handover", id, "acknowledged", null, callerName, caller, callerName, callerRole, null);
    updated;
  };

};
