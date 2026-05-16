import Time "mo:core/Time";
import Map "mo:core/Map";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Buffer "mo:core/Buffer";

import MixinAuthorization "authorization/MixinAuthorization/lib";
import AccessControl "authorization/access-control/lib";
import ClinicalDataEngineLib "lib/clinical-data-engine";
import ClinicalDataEngineMixin "mixins/clinical-data-engine-api";

actor {
  ///////////////////////////////
  // Configuration Constants    //
  ///////////////////////////////
  
  let MAX_CALLS_PER_WINDOW = 100;
  let RATE_LIMIT_WINDOW_SECONDS = 60;
  let MAX_AUDIT_LOGS = 10000;
  
  ///////////////////////////////
  // Custom Types and Modules  //
  ///////////////////////////////

  public type Gender = { #male; #female; #other };
  public type PatientType = { #admitted; #outdoor };
  public type VisitType = { #admitted; #outdoor };

  public type VitalSigns = {
    bloodPressure : ?Text;
    pulse : ?Text;
    temperature : ?Text;
    respiratoryRate : ?Text;
    oxygenSaturation : ?Text;
  };

  public type Medication = {
    name : Text;
    dose : Text;
    frequency : Text;
    duration : Text;
    instructions : Text;
  };

  public type Patient = {
    id : Nat;
    fullName : Text;
    nameBn : ?Text;
    dateOfBirth : ?Time.Time;
    gender : Gender;
    phone : ?Text;
    email : ?Text;
    address : ?Text;
    bloodGroup : ?Text;
    weight : ?Float;
    height : ?Float;
    allergies : [Text];
    chronicConditions : [Text];
    pastSurgicalHistory : ?Text;
    patientType : PatientType;
    createdAt : Time.Time;
    updatedAt : Time.Time;
    consultantEmail : ?Text;
    consultantName : ?Text;
  };

  module Patient {
    public func compare(p1 : Patient, p2 : Patient) : Order.Order {
      Nat.compare(p1.id, p2.id);
    };
  };

  public type Visit = {
    id : Nat;
    patientId : Nat;
    visitDate : Time.Time;
    chiefComplaint : Text;
    historyOfPresentIllness : ?Text;
    vitalSigns : VitalSigns;
    physicalExamination : ?Text;
    diagnosis : ?Text;
    notes : ?Text;
    visitType : VisitType;
    createdAt : Time.Time;
    updatedAt : Time.Time;
  };

  module Visit {
    public func compare(v1 : Visit, v2 : Visit) : Order.Order {
      Nat.compare(v1.id, v2.id);
    };
  };

  public type Prescription = {
    id : Nat;
    patientId : Nat;
    visitId : ?Nat;
    prescriptionDate : Time.Time;
    diagnosis : ?Text;
    medications : [Medication];
    notes : ?Text;
    createdAt : Time.Time;
    updatedAt : Time.Time;
  };

  module Prescription {
    public func compare(p1 : Prescription, p2 : Prescription) : Order.Order {
      Nat.compare(p1.id, p2.id);
    };
  };

  public type UserProfile = {
    name : Text;
  };

  // API Result Types
  public type ApiError = {
    #notFound : Text;
    #unauthorized : Text;
    #validationError : Text;
    #internalError : Text;
    #rateLimited : Text;
  };

  public type Result<T, E> = {
    #ok : T;
    #err : E;
  };

  public type AuditLog = {
    id : Nat;
    action : Text;
    actor : Principal;
    timestamp : Time.Time;
    details : Text;
    success : Bool;
  };

  public type PaginationParams = {
    limit : Nat;
    offset : Nat;
  };

  public type PaginatedResult<T> = {
    items : [T];
    total : Nat;
    limit : Nat;
    offset : Nat;
  };

  public type CanisterStatus = {
    memory_size : Nat;
    cycles_balance : Nat;
    total_patients : Nat;
    total_visits : Nat;
    total_prescriptions : Nat;
    total_audit_logs : Nat;
  };

  ////////////////////////////
  // Core Data Structures   //
  ////////////////////////////

  let patients = Map.empty<Nat, Patient>();
  let visits = Map.empty<Nat, Visit>();
  let prescriptions = Map.empty<Nat, Prescription>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let auditLogs = Map.empty<Nat, AuditLog>();
  let userCallCounts = Map.empty<Principal, Nat>();
  let callResetTime = Map.empty<Principal, Time.Time>();

  var patientIdCounter = 1;
  var visitIdCounter = 1;
  var prescriptionIdCounter = 1;
  var auditLogIdCounter = 1;

  ////////////////////////////
  // Stable Storage         //
  ////////////////////////////

  stable var stablePatients : [(Nat, Patient)] = [];
  stable var stableVisits : [(Nat, Visit)] = [];
  stable var stablePrescriptions : [(Nat, Prescription)] = [];
  stable var stableUserProfiles : [(Principal, UserProfile)] = [];
  stable var stableAuditLogs : [(Nat, AuditLog)] = [];
  stable var stablePatientIdCounter = 1;
  stable var stableVisitIdCounter = 1;
  stable var stablePrescriptionIdCounter = 1;
  stable var stableAuditLogIdCounter = 1;

  system func preupgrade() {
    stablePatients := patients.toArray();
    stableVisits := visits.toArray();
    stablePrescriptions := prescriptions.toArray();
    stableUserProfiles := userProfiles.toArray();
    stableAuditLogs := auditLogs.toArray();
    stablePatientIdCounter := patientIdCounter;
    stableVisitIdCounter := visitIdCounter;
    stablePrescriptionIdCounter := prescriptionIdCounter;
    stableAuditLogIdCounter := auditLogIdCounter;
  };

  system func postupgrade() {
    for ((id, patient) in stablePatients.vals()) {
      patients.add(id, patient);
    };
    for ((id, visit) in stableVisits.vals()) {
      visits.add(id, visit);
    };
    for ((id, prescription) in stablePrescriptions.vals()) {
      prescriptions.add(id, prescription);
    };
    for ((principal, profile) in stableUserProfiles.vals()) {
      userProfiles.add(principal, profile);
    };
    for ((id, log) in stableAuditLogs.vals()) {
      auditLogs.add(id, log);
    };
    patientIdCounter := stablePatientIdCounter;
    visitIdCounter := stableVisitIdCounter;
    prescriptionIdCounter := stablePrescriptionIdCounter;
    auditLogIdCounter := stableAuditLogIdCounter;
  };

  ////////////////////////////
  // Authorization         //
  ////////////////////////////
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  ////////////////////////////
  // Front Page Content     //
  ////////////////////////////

  var frontPageContent : ?Text = null;

  public type CurrentUser = {
    principal : Principal;
    role : AccessControl.UserRole;
  };

  ////////////////////////////
  // Validation Functions  //
  ////////////////////////////

  func isValidEmail(email : Text) : Bool {
    let emailPattern = "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}";
    let chars = email.chars();
    let hasAt = email.contains("@");
    let hasDot = email.contains(".");
    hasAt and hasDot and email.size() > 5;
  };

  func isValidPhone(phone : Text) : Bool {
    phone.size() >= 10 and phone.size() <= 20;
  };

  ////////////////////////////
  // Rate Limiting         //
  ////////////////////////////

  func checkRateLimit(caller : Principal) : Result<(), ApiError> {
    let now = Time.now();
    let resetTime = switch (callResetTime.get(caller)) {
      case (?t) { t };
      case (null) { now };
    };

    if (now - resetTime > (RATE_LIMIT_WINDOW_SECONDS * 1_000_000_000 : Int)) {
      userCallCounts.add(caller, 1);
      callResetTime.add(caller, now);
      return #ok();
    };

    let count = switch (userCallCounts.get(caller)) {
      case (?c) { c };
      case (null) { 0 };
    };

    if (count < MAX_CALLS_PER_WINDOW) {
      userCallCounts.add(caller, count + 1);
      return #ok();
    };

    #err(#rateLimited("Rate limit exceeded. Max 100 requests per 60 seconds."));
  };

  ////////////////////////////
  // Audit Logging         //
  ////////////////////////////

  func logAction(caller : Principal, action : Text, details : Text, success : Bool) {
    if (auditLogIdCounter > MAX_AUDIT_LOGS) {
      // Rotate: keep only recent logs
      let allLogs = auditLogs.toArray();
      let recentLogs = Array.drop<(Nat, AuditLog)>(allLogs, MAX_AUDIT_LOGS / 2);
      auditLogs.clear();
      for ((id, log) in recentLogs.vals()) {
        auditLogs.add(id, log);
      };
      auditLogIdCounter := MAX_AUDIT_LOGS / 2;
    };

    auditLogs.add(auditLogIdCounter, {
      id = auditLogIdCounter;
      action;
      actor = caller;
      timestamp = Time.now();
      details;
      success;
    });
    auditLogIdCounter += 1;
  };

  ////////////////////////////
  // System Functions      //
  ////////////////////////////

  public shared ({ caller }) func getCurrentUser() : async CurrentUser {
    let role = AccessControl.getUserRole(accessControlState, caller);
    { principal = caller; role };
  };

  public query func getCanisterStatus() : async CanisterStatus {
    {
      memory_size = Runtime.memory();
      cycles_balance = Runtime.cycles();
      total_patients = patients.size();
      total_visits = visits.size();
      total_prescriptions = prescriptions.size();
      total_audit_logs = auditLogs.size();
    };
  };

  ////////////////////////////
  // Clinical Data Engine   //
  ////////////////////////////
  let clinicalEngineState = ClinicalDataEngineLib.initState();
  include ClinicalDataEngineMixin(clinicalEngineState, accessControlState);

  ////////////////////////////
  // User Profile Functions //
  ////////////////////////////

  public query ({ caller }) func getCallerUserProfile() : async Result<?UserProfile, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can view profiles"));
    };
    #ok(userProfiles.get(caller));
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async Result<?UserProfile, ApiError> {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      return #err(#unauthorized("Can only view your own profile"));
    };
    #ok(userProfiles.get(user));
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async Result<(), ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "saveCallerUserProfile", "Unauthorized", false);
      return #err(#unauthorized("Only users can save profiles"));
    };
    userProfiles.add(caller, profile);
    logAction(caller, "saveCallerUserProfile", "Profile saved", true);
    #ok();
  };

  ////////////////////////////
  // Patient Functions      //
  ////////////////////////////

  public shared ({ caller }) func createPatient(
    fullName : Text,
    nameBn : ?Text,
    dateOfBirth : ?Time.Time,
    gender : Gender,
    phone : ?Text,
    email : ?Text,
    address : ?Text,
    bloodGroup : ?Text,
    weight : ?Float,
    height : ?Float,
    allergies : [Text],
    chronicConditions : [Text],
    pastSurgicalHistory : ?Text,
    patientType : PatientType,
    consultantEmail : ?Text,
    consultantName : ?Text
  ) : async Result<Patient, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "createPatient", "Unauthorized", false);
      return #err(#unauthorized("Only users can create patients"));
    };

    if (fullName == "") {
      return #err(#validationError("Full name cannot be empty"));
    };

    switch (email) {
      case (?e) {
        if (not isValidEmail(e)) {
          return #err(#validationError("Invalid email format"));
        };
      };
      case (null) {};
    };

    switch (phone) {
      case (?p) {
        if (not isValidPhone(p)) {
          return #err(#validationError("Invalid phone format"));
        };
      };
      case (null) {};
    };

    let patient : Patient = {
      id = patientIdCounter;
      fullName;
      nameBn;
      dateOfBirth;
      gender;
      phone;
      email;
      address;
      bloodGroup;
      weight;
      height;
      allergies;
      chronicConditions;
      pastSurgicalHistory;
      patientType;
      createdAt = Time.now();
      updatedAt = Time.now();
      consultantEmail;
      consultantName;
    };

    patients.add(patientIdCounter, patient);
    patientIdCounter += 1;
    logAction(caller, "createPatient", "Created patient: " # fullName, true);
    #ok(patient);
  };

  public query ({ caller }) func getPatient(id : Nat) : async Result<?Patient, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get patients"));
    };
    #ok(patients.get(id));
  };

  public query ({ caller }) func getAllPatients() : async Result<[Patient], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get patients"));
    };
    #ok(patients.values().toArray());
  };

  public query ({ caller }) func getPatientsPageinated(params : PaginationParams) : async Result<PaginatedResult<Patient>, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get patients"));
    };

    let all = patients.values().toArray();
    let total = all.size();
    let start = params.offset;
    let end = if (start + params.limit > total) { total } else { start + params.limit };
    let items = if (start >= total) { [] } else { 
      Array.subArray<Patient>(all, start, end - start)
    };

    #ok({
      items;
      total;
      limit = params.limit;
      offset = params.offset;
    });
  };

  public shared ({ caller }) func updatePatient(
    id : Nat,
    fullName : Text,
    nameBn : ?Text,
    dateOfBirth : ?Time.Time,
    gender : Gender,
    phone : ?Text,
    email : ?Text,
    address : ?Text,
    bloodGroup : ?Text,
    weight : ?Float,
    height : ?Float,
    allergies : [Text],
    chronicConditions : [Text],
    pastSurgicalHistory : ?Text,
    patientType : PatientType,
    consultantEmail : ?Text,
    consultantName : ?Text
  ) : async Result<Patient, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "updatePatient", "Unauthorized", false);
      return #err(#unauthorized("Only users can update patients"));
    };

    if (fullName == "") {
      return #err(#validationError("Full name cannot be empty"));
    };

    let existingPatient = switch (patients.get(id)) {
      case (null) { return #err(#notFound("Patient not found")) };
      case (?patient) { patient };
    };

    let updatedPatient : Patient = {
      id;
      fullName;
      nameBn;
      dateOfBirth;
      gender;
      phone;
      email;
      address;
      bloodGroup;
      weight;
      height;
      allergies;
      chronicConditions;
      pastSurgicalHistory;
      patientType;
      createdAt = existingPatient.createdAt;
      updatedAt = Time.now();
      consultantEmail;
      consultantName;
    };

    patients.add(id, updatedPatient);
    logAction(caller, "updatePatient", "Updated patient ID: " # Nat.toText(id), true);
    #ok(updatedPatient);
  };

  public shared ({ caller }) func deletePatient(id : Nat) : async Result<(), ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "deletePatient", "Unauthorized", false);
      return #err(#unauthorized("Only users can delete patients"));
    };

    let _ = patients.remove(id);
    logAction(caller, "deletePatient", "Deleted patient ID: " # Nat.toText(id), true);
    #ok();
  };

  ////////////////////////////
  // Visit Functions        //
  ////////////////////////////

  public shared ({ caller }) func createVisit(
    patientId : Nat,
    visitDate : Time.Time,
    chiefComplaint : Text,
    historyOfPresentIllness : ?Text,
    vitalSigns : VitalSigns,
    physicalExamination : ?Text,
    diagnosis : ?Text,
    notes : ?Text,
    visitType : VisitType
  ) : async Result<Visit, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "createVisit", "Unauthorized", false);
      return #err(#unauthorized("Only users can create visits"));
    };

    if (chiefComplaint == "") {
      return #err(#validationError("Chief complaint cannot be empty"));
    };

    let visit : Visit = {
      id = visitIdCounter;
      patientId;
      visitDate;
      chiefComplaint;
      historyOfPresentIllness;
      vitalSigns;
      physicalExamination;
      diagnosis;
      notes;
      visitType;
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    visits.add(visitIdCounter, visit);
    visitIdCounter += 1;
    logAction(caller, "createVisit", "Created visit for patient ID: " # Nat.toText(patientId), true);
    #ok(visit);
  };

  public query ({ caller }) func getVisit(id : Nat) : async Result<?Visit, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get visits"));
    };
    #ok(visits.get(id));
  };

  public query ({ caller }) func getAllVisits() : async Result<[Visit], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get visits"));
    };
    #ok(visits.values().toArray());
  };

  public query ({ caller }) func getVisitsPageinated(params : PaginationParams) : async Result<PaginatedResult<Visit>, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get visits"));
    };

    let all = visits.values().toArray();
    let total = all.size();
    let start = params.offset;
    let end = if (start + params.limit > total) { total } else { start + params.limit };
    let items = if (start >= total) { [] } else { 
      Array.subArray<Visit>(all, start, end - start)
    };

    #ok({
      items;
      total;
      limit = params.limit;
      offset = params.offset;
    });
  };

  public query ({ caller }) func getVisitsByPatientId(patientId : Nat) : async Result<[Visit], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get visits"));
    };
    let filtered = visits.values().toArray().filter(func(v) { v.patientId == patientId });
    #ok(filtered);
  };

  public shared ({ caller }) func updateVisit(
    id : Nat,
    patientId : Nat,
    visitDate : Time.Time,
    chiefComplaint : Text,
    historyOfPresentIllness : ?Text,
    vitalSigns : VitalSigns,
    physicalExamination : ?Text,
    diagnosis : ?Text,
    notes : ?Text,
    visitType : VisitType
  ) : async Result<Visit, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "updateVisit", "Unauthorized", false);
      return #err(#unauthorized("Only users can update visits"));
    };

    if (chiefComplaint == "") {
      return #err(#validationError("Chief complaint cannot be empty"));
    };

    let existingVisit = switch (visits.get(id)) {
      case (null) { return #err(#notFound("Visit not found")) };
      case (?visit) { visit };
    };

    let updatedVisit : Visit = {
      id;
      patientId;
      visitDate;
      chiefComplaint;
      historyOfPresentIllness;
      vitalSigns;
      physicalExamination;
      diagnosis;
      notes;
      visitType;
      createdAt = existingVisit.createdAt;
      updatedAt = Time.now();
    };

    visits.add(id, updatedVisit);
    logAction(caller, "updateVisit", "Updated visit ID: " # Nat.toText(id), true);
    #ok(updatedVisit);
  };

  public shared ({ caller }) func deleteVisit(id : Nat) : async Result<(), ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "deleteVisit", "Unauthorized", false);
      return #err(#unauthorized("Only users can delete visits"));
    };

    let _ = visits.remove(id);
    logAction(caller, "deleteVisit", "Deleted visit ID: " # Nat.toText(id), true);
    #ok();
  };

  ////////////////////////////
  // Prescription Functions //
  ////////////////////////////

  public shared ({ caller }) func createPrescription(
    patientId : Nat,
    visitId : ?Nat,
    prescriptionDate : Time.Time,
    diagnosis : ?Text,
    medications : [Medication],
    notes : ?Text
  ) : async Result<Prescription, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "createPrescription", "Unauthorized", false);
      return #err(#unauthorized("Only users can create prescriptions"));
    };

    if (medications.size() == 0) {
      return #err(#validationError("At least one medication is required"));
    };

    let prescription : Prescription = {
      id = prescriptionIdCounter;
      patientId;
      visitId;
      prescriptionDate;
      diagnosis;
      medications;
      notes;
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    prescriptions.add(prescriptionIdCounter, prescription);
    prescriptionIdCounter += 1;
    logAction(caller, "createPrescription", "Created prescription for patient ID: " # Nat.toText(patientId), true);
    #ok(prescription);
  };

  public query ({ caller }) func getPrescription(id : Nat) : async Result<?Prescription, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get prescriptions"));
    };
    #ok(prescriptions.get(id));
  };

  public query ({ caller }) func getAllPrescriptions() : async Result<[Prescription], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get prescriptions"));
    };
    #ok(prescriptions.values().toArray());
  };

  public query ({ caller }) func getPrescriptionsPageinated(params : PaginationParams) : async Result<PaginatedResult<Prescription>, ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get prescriptions"));
    };

    let all = prescriptions.values().toArray();
    let total = all.size();
    let start = params.offset;
    let end = if (start + params.limit > total) { total } else { start + params.limit };
    let items = if (start >= total) { [] } else { 
      Array.subArray<Prescription>(all, start, end - start)
    };

    #ok({
      items;
      total;
      limit = params.limit;
      offset = params.offset;
    });
  };

  public query ({ caller }) func getPrescriptionsByPatientId(patientId : Nat) : async Result<[Prescription], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get prescriptions"));
    };
    let filtered = prescriptions.values().toArray().filter(func(p) { p.patientId == patientId });
    #ok(filtered);
  };

  public query ({ caller }) func getPrescriptionsByVisitId(visitId : Nat) : async Result<[Prescription], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can get prescriptions"));
    };
    let filtered = prescriptions.values().toArray().filter(func(p) { 
      switch (p.visitId) { 
        case (?id) { id == visitId }; 
        case (null) { false } 
      } 
    });
    #ok(filtered);
  };

  public shared ({ caller }) func updatePrescription(
    id : Nat,
    patientId : Nat,
    visitId : ?Nat,
    prescriptionDate : Time.Time,
    diagnosis : ?Text,
    medications : [Medication],
    notes : ?Text
  ) : async Result<Prescription, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "updatePrescription", "Unauthorized", false);
      return #err(#unauthorized("Only users can update prescriptions"));
    };

    if (medications.size() == 0) {
      return #err(#validationError("At least one medication is required"));
    };

    let existingPrescription = switch (prescriptions.get(id)) {
      case (null) { return #err(#notFound("Prescription not found")) };
      case (?prescription) { prescription };
    };

    let updatedPrescription : Prescription = {
      id;
      patientId;
      visitId;
      prescriptionDate;
      diagnosis;
      medications;
      notes;
      createdAt = existingPrescription.createdAt;
      updatedAt = Time.now();
    };

    prescriptions.add(id, updatedPrescription);
    logAction(caller, "updatePrescription", "Updated prescription ID: " # Nat.toText(id), true);
    #ok(updatedPrescription);
  };

  public shared ({ caller }) func deletePrescription(id : Nat) : async Result<(), ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      logAction(caller, "deletePrescription", "Unauthorized", false);
      return #err(#unauthorized("Only users can delete prescriptions"));
    };

    let _ = prescriptions.remove(id);
    logAction(caller, "deletePrescription", "Deleted prescription ID: " # Nat.toText(id), true);
    #ok();
  };

  ////////////////////////////
  // Audit Log Functions    //
  ////////////////////////////

  public query ({ caller }) func getAuditLogs(params : PaginationParams) : async Result<PaginatedResult<AuditLog>, ApiError> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err(#unauthorized("Only admins can view audit logs"));
    };

    let all = auditLogs.values().toArray();
    let total = all.size();
    let start = params.offset;
    let end = if (start + params.limit > total) { total } else { start + params.limit };
    let items = if (start >= total) { [] } else { 
      Array.subArray<AuditLog>(all, start, end - start)
    };

    #ok({
      items;
      total;
      limit = params.limit;
      offset = params.offset;
    });
  };

  ////////////////////////////
  // Sync Methods           //
  ////////////////////////////

  public query ({ caller }) func getAllPatientsSince(sinceTimestamp : Int) : async Result<[Patient], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can sync patients"));
    };
    let filtered = patients.values().toArray().filter(func(p) { p.updatedAt >= sinceTimestamp });
    #ok(filtered);
  };

  public query ({ caller }) func getAllVisitsSince(sinceTimestamp : Int) : async Result<[Visit], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can sync visits"));
    };
    let filtered = visits.values().toArray().filter(func(v) { v.updatedAt >= sinceTimestamp });
    #ok(filtered);
  };

  public query ({ caller }) func getAllPrescriptionsSince(sinceTimestamp : Int) : async Result<[Prescription], ApiError> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can sync prescriptions"));
    };
    let filtered = prescriptions.values().toArray().filter(func(p) { p.updatedAt >= sinceTimestamp });
    #ok(filtered);
  };

  ////////////////////////////
  // Front Page Content     //
  ////////////////////////////

  public shared ({ caller }) func saveFrontPageContent(content : Text) : async Result<(), ApiError> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      logAction(caller, "saveFrontPageContent", "Unauthorized", false);
      return #err(#unauthorized("Only admin can save front page content"));
    };
    frontPageContent := ?content;
    logAction(caller, "saveFrontPageContent", "Updated front page content", true);
    #ok();
  };

  public query func getFrontPageContent() : async ?Text {
    frontPageContent;
  };

  ////////////////////////////
  // Upsert Methods         //
  ////////////////////////////

  public shared ({ caller }) func upsertPatient(patient : Patient) : async Result<Patient, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can upsert patients"));
    };

    switch (patients.get(patient.id)) {
      case (?existing) {
        if (patient.updatedAt > existing.updatedAt) {
          patients.add(patient.id, patient);
          logAction(caller, "upsertPatient", "Upserted patient ID: " # Nat.toText(patient.id), true);
          return #ok(patient);
        } else {
          return #ok(existing);
        };
      };
      case (null) {
        if (patient.id >= patientIdCounter) {
          patientIdCounter := patient.id + 1;
        };
        patients.add(patient.id, patient);
        logAction(caller, "upsertPatient", "Created patient ID: " # Nat.toText(patient.id), true);
        return #ok(patient);
      };
    };
  };

  public shared ({ caller }) func upsertVisit(visit : Visit) : async Result<Visit, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can upsert visits"));
    };

    switch (visits.get(visit.id)) {
      case (?existing) {
        if (visit.updatedAt > existing.updatedAt) {
          visits.add(visit.id, visit);
          logAction(caller, "upsertVisit", "Upserted visit ID: " # Nat.toText(visit.id), true);
          return #ok(visit);
        } else {
          return #ok(existing);
        };
      };
      case (null) {
        if (visit.id >= visitIdCounter) {
          visitIdCounter := visit.id + 1;
        };
        visits.add(visit.id, visit);
        logAction(caller, "upsertVisit", "Created visit ID: " # Nat.toText(visit.id), true);
        return #ok(visit);
      };
    };
  };

  public shared ({ caller }) func upsertPrescription(prescription : Prescription) : async Result<Prescription, ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can upsert prescriptions"));
    };

    switch (prescriptions.get(prescription.id)) {
      case (?existing) {
        if (prescription.updatedAt > existing.updatedAt) {
          prescriptions.add(prescription.id, prescription);
          logAction(caller, "upsertPrescription", "Upserted prescription ID: " # Nat.toText(prescription.id), true);
          return #ok(prescription);
        } else {
          return #ok(existing);
        };
      };
      case (null) {
        if (prescription.id >= prescriptionIdCounter) {
          prescriptionIdCounter := prescription.id + 1;
        };
        prescriptions.add(prescription.id, prescription);
        logAction(caller, "upsertPrescription", "Created prescription ID: " # Nat.toText(prescription.id), true);
        return #ok(prescription);
      };
    };
  };

  ////////////////////////////
  // Bulk Upsert Methods    //
  ////////////////////////////

  public shared ({ caller }) func bulkUpsertPatients(pats : [Patient]) : async Result<[Patient], ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can bulk upsert patients"));
    };

    let results = Buffer.Buffer<Patient>(pats.size());
    for (patient in pats.vals()) {
      switch (patients.get(patient.id)) {
        case (?existing) {
          if (patient.updatedAt > existing.updatedAt) {
            patients.add(patient.id, patient);
            results.add(patient);
          } else {
            results.add(existing);
          };
        };
        case (null) {
          if (patient.id >= patientIdCounter) {
            patientIdCounter := patient.id + 1;
          };
          patients.add(patient.id, patient);
          results.add(patient);
        };
      };
    };

    logAction(caller, "bulkUpsertPatients", "Bulk upserted " # Nat.toText(pats.size()) # " patients", true);
    #ok(results.toArray());
  };

  public shared ({ caller }) func bulkUpsertVisits(vs : [Visit]) : async Result<[Visit], ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can bulk upsert visits"));
    };

    let results = Buffer.Buffer<Visit>(vs.size());
    for (visit in vs.vals()) {
      switch (visits.get(visit.id)) {
        case (?existing) {
          if (visit.updatedAt > existing.updatedAt) {
            visits.add(visit.id, visit);
            results.add(visit);
          } else {
            results.add(existing);
          };
        };
        case (null) {
          if (visit.id >= visitIdCounter) {
            visitIdCounter := visit.id + 1;
          };
          visits.add(visit.id, visit);
          results.add(visit);
        };
      };
    };

    logAction(caller, "bulkUpsertVisits", "Bulk upserted " # Nat.toText(vs.size()) # " visits", true);
    #ok(results.toArray());
  };

  public shared ({ caller }) func bulkUpsertPrescriptions(prescs : [Prescription]) : async Result<[Prescription], ApiError> {
    switch (checkRateLimit(caller)) {
      case (#err(e)) { return #err(e) };
      case (#ok()) {};
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err(#unauthorized("Only users can bulk upsert prescriptions"));
    };

    let results = Buffer.Buffer<Prescription>(prescs.size());
    for (prescription in prescs.vals()) {
      switch (prescriptions.get(prescription.id)) {
        case (?existing) {
          if (prescription.updatedAt > existing.updatedAt) {
            prescriptions.add(prescription.id, prescription);
            results.add(prescription);
          } else {
            results.add(existing);
          };
        };
        case (null) {
          if (prescription.id >= prescriptionIdCounter) {
            prescriptionIdCounter := prescription.id + 1;
          };
          prescriptions.add(prescription.id, prescription);
          results.add(prescription);
        };
      };
    };

    logAction(caller, "bulkUpsertPrescriptions", "Bulk upserted " # Nat.toText(prescs.size()) # " prescriptions", true);
    #ok(results.toArray());
  };

};
