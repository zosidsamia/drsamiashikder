import Time "mo:core/Time";
import Map "mo:core/Map";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";


import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import ClinicalDataEngineLib "lib/clinical-data-engine";
import ClinicalDataEngineMixin "mixins/clinical-data-engine-api";















actor {
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

  ////////////////////////////
  // Core Data Structures   //
  ////////////////////////////

  let patients = Map.empty<Nat, Patient>();
  let visits = Map.empty<Nat, Visit>();
  let prescriptions = Map.empty<Nat, Prescription>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  var patientIdCounter = 1;
  var visitIdCounter = 1;
  var prescriptionIdCounter = 1;

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

  public shared ({ caller }) func getCurrentUser() : async CurrentUser {
    let role = AccessControl.getUserRole(accessControlState, caller);
    { principal = caller; role };
  };

  ////////////////////////////
  // Clinical Data Engine   //
  ////////////////////////////
  let clinicalEngineState = ClinicalDataEngineLib.initState();
  include ClinicalDataEngineMixin(clinicalEngineState, accessControlState);

  ////////////////////////////
  // User Profile Functions //
  ////////////////////////////

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
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
  ) : async Patient {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create patients");
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
    patient;
  };

  public query ({ caller }) func getPatient(id : Nat) : async ?Patient {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get patients");
    };
    patients.get(id);
  };

  public query ({ caller }) func getAllPatients() : async [Patient] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get patients");
    };
    patients.values().toArray().sort();
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
  ) : async Patient {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update patients");
    };

    let existingPatient = switch (patients.get(id)) {
      case (null) { Runtime.trap("Patient does not exist") };
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
    updatedPatient;
  };

  public shared ({ caller }) func assignConsultant(
    patientId : Nat,
    consultantEmail : Text,
    consultantName : Text
  ) : async Patient {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can assign consultants");
    };

    let existingPatient = switch (patients.get(patientId)) {
      case (null) { Runtime.trap("Patient does not exist") };
      case (?patient) { patient };
    };

    let updatedPatient : Patient = {
      existingPatient with
      consultantEmail = ?consultantEmail;
      consultantName = ?consultantName;
      updatedAt = Time.now();
    };

    patients.add(patientId, updatedPatient);
    updatedPatient;
  };

  public shared ({ caller }) func deletePatient(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete patients");
    };
    patients.remove(id);
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
  ) : async Visit {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create visits");
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
    visit;
  };

  public query ({ caller }) func getVisit(id : Nat) : async ?Visit {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get visits");
    };
    visits.get(id);
  };

  public query ({ caller }) func getAllVisits() : async [Visit] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get visits");
    };
    visits.values().toArray().sort();
  };

  public query ({ caller }) func getVisitsByPatientId(patientId : Nat) : async [Visit] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get visits");
    };
    visits.values().toArray().filter(func(v) { v.patientId == patientId });
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
  ) : async Visit {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update visits");
    };

    let existingVisit = switch (visits.get(id)) {
      case (null) { Runtime.trap("Visit does not exist") };
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
    updatedVisit;
  };

  public shared ({ caller }) func deleteVisit(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete visits");
    };
    visits.remove(id);
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
  ) : async Prescription {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create prescriptions");
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
    prescription;
  };

  public query ({ caller }) func getPrescription(id : Nat) : async ?Prescription {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get prescriptions");
    };
    prescriptions.get(id);
  };

  public query ({ caller }) func getAllPrescriptions() : async [Prescription] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get prescriptions");
    };
    prescriptions.values().toArray().sort();
  };

  public query ({ caller }) func getPrescriptionsByPatientId(patientId : Nat) : async [Prescription] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get prescriptions");
    };
    prescriptions.values().toArray().filter(func(p) { p.patientId == patientId });
  };

  public query ({ caller }) func getPrescriptionsByVisitId(visitId : Nat) : async [Prescription] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get prescriptions");
    };
    prescriptions.values().toArray().filter(func(p) { switch (p.visitId) { case (?id) { id == visitId }; case (null) { false } } });
  };

  public shared ({ caller }) func updatePrescription(
    id : Nat,
    patientId : Nat,
    visitId : ?Nat,
    prescriptionDate : Time.Time,
    diagnosis : ?Text,
    medications : [Medication],
    notes : ?Text
  ) : async Prescription {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update prescriptions");
    };

    let existingPrescription = switch (prescriptions.get(id)) {
      case (null) { Runtime.trap("Prescription does not exist") };
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
    updatedPrescription;
  };

  public shared ({ caller }) func deletePrescription(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete prescriptions");
    };
    prescriptions.remove(id);
  };

  ////////////////////////////
  // Sync Methods           //
  ////////////////////////////

  // Returns all patients modified at or after sinceTimestamp.
  public query ({ caller }) func getAllPatientsSince(sinceTimestamp : Int) : async [Patient] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can sync patients");
    };
    patients.values().toArray().filter(func(p) { p.updatedAt >= sinceTimestamp });
  };

  // Returns all visits modified at or after sinceTimestamp.
  public query ({ caller }) func getAllVisitsSince(sinceTimestamp : Int) : async [Visit] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can sync visits");
    };
    visits.values().toArray().filter(func(v) { v.updatedAt >= sinceTimestamp });
  };

  // Returns all prescriptions modified at or after sinceTimestamp.
  public query ({ caller }) func getAllPrescriptionsSince(sinceTimestamp : Int) : async [Prescription] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can sync prescriptions");
    };
    prescriptions.values().toArray().filter(func(p) { p.updatedAt >= sinceTimestamp });
  };

  public shared ({ caller }) func saveFrontPageContent(content : Text) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admin can save front page content");
    };
    frontPageContent := ?content;
  };

  public query func getFrontPageContent() : async ?Text {
    frontPageContent;
  };

  // getSerialQueue — convenience alias over getQueueByDateAndDoctor; provided by mixin.
  // getAppointments — convenience alias over getAllAppointmentsByDoctor; provided by mixin.
  // syncData, getUpdatedData, addAuditEntry, getAuditLog, getActiveAlerts, dismissAlert,
  // createHandover, getHandover, getHandoversByPatientId, updateHandover,
  // createDailyProgressNote, getDailyProgressNotesByPatientId, updateDailyProgressNote
  // — all exposed by ClinicalDataEngineMixin above.

  // Idempotent upsert: if record exists and incoming updatedAt is newer, update; else if absent, create.
  public shared ({ caller }) func upsertPatient(patient : Patient) : async Patient {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upsert patients");
    };
    switch (patients.get(patient.id)) {
      case (?existing) {
        if (patient.updatedAt > existing.updatedAt) {
          patients.add(patient.id, patient);
          patient;
        } else {
          existing;
        };
      };
      case (null) {
        // Ensure counter stays ahead of any imported id
        if (patient.id >= patientIdCounter) {
          patientIdCounter := patient.id + 1;
        };
        patients.add(patient.id, patient);
        patient;
      };
    };
  };

  public shared ({ caller }) func upsertVisit(visit : Visit) : async Visit {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upsert visits");
    };
    switch (visits.get(visit.id)) {
      case (?existing) {
        if (visit.updatedAt > existing.updatedAt) {
          visits.add(visit.id, visit);
          visit;
        } else {
          existing;
        };
      };
      case (null) {
        if (visit.id >= visitIdCounter) {
          visitIdCounter := visit.id + 1;
        };
        visits.add(visit.id, visit);
        visit;
      };
    };
  };

  public shared ({ caller }) func upsertPrescription(prescription : Prescription) : async Prescription {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upsert prescriptions");
    };
    switch (prescriptions.get(prescription.id)) {
      case (?existing) {
        if (prescription.updatedAt > existing.updatedAt) {
          prescriptions.add(prescription.id, prescription);
          prescription;
        } else {
          existing;
        };
      };
      case (null) {
        if (prescription.id >= prescriptionIdCounter) {
          prescriptionIdCounter := prescription.id + 1;
        };
        prescriptions.add(prescription.id, prescription);
        prescription;
      };
    };
  };

  // Batch upsert — efficient for sync queue flush.
  public shared ({ caller }) func bulkUpsertPatients(pats : [Patient]) : async [Patient] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can bulk upsert patients");
    };
    pats.map<Patient, Patient>(func(patient) {
      switch (patients.get(patient.id)) {
        case (?existing) {
          if (patient.updatedAt > existing.updatedAt) {
            patients.add(patient.id, patient);
            patient;
          } else {
            existing;
          };
        };
        case (null) {
          if (patient.id >= patientIdCounter) {
            patientIdCounter := patient.id + 1;
          };
          patients.add(patient.id, patient);
          patient;
        };
      };
    });
  };

  public shared ({ caller }) func bulkUpsertVisits(vs : [Visit]) : async [Visit] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can bulk upsert visits");
    };
    vs.map<Visit, Visit>(func(visit) {
      switch (visits.get(visit.id)) {
        case (?existing) {
          if (visit.updatedAt > existing.updatedAt) {
            visits.add(visit.id, visit);
            visit;
          } else {
            existing;
          };
        };
        case (null) {
          if (visit.id >= visitIdCounter) {
            visitIdCounter := visit.id + 1;
          };
          visits.add(visit.id, visit);
          visit;
        };
      };
    });
  };

  public shared ({ caller }) func bulkUpsertPrescriptions(prescs : [Prescription]) : async [Prescription] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can bulk upsert prescriptions");
    };
    prescs.map<Prescription, Prescription>(func(prescription) {
      switch (prescriptions.get(prescription.id)) {
        case (?existing) {
          if (prescription.updatedAt > existing.updatedAt) {
            prescriptions.add(prescription.id, prescription);
            prescription;
          } else {
            existing;
          };
        };
        case (null) {
          if (prescription.id >= prescriptionIdCounter) {
            prescriptionIdCounter := prescription.id + 1;
          };
          prescriptions.add(prescription.id, prescription);
          prescription;
        };
      };
    });
  };

};
