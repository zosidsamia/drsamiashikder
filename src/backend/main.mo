import Time "mo:core/Time";
import Map "mo:core/Map";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

import MixinAuthorization "authorization/MixinAuthorization/lib";
import AccessControl "authorization/access-control/lib";
import ClinicalDataEngineLib "lib/clinical-data-engine";
import ClinicalDataEngineMixin "mixins/clinical-data-engine-api";

actor {

  ///////////////////////////////
  // TYPES
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

  ///////////////////////////////
  // SYNC ENGINE TYPES
  ///////////////////////////////

  public type SyncAction = {
    id : Nat;
    entityType : Text;
    entityId : Nat;
    action : Text;
    payload : ?Text;
    createdAt : Time.Time;
    synced : Bool;
    retryCount : Nat;
  };

  ///////////////////////////////
  // STORAGE
  ///////////////////////////////

  let patients = Map.empty<Nat, Patient>();
  let visits = Map.empty<Nat, Visit>();
  let prescriptions = Map.empty<Nat, Prescription>();

  let syncQueue = Map.empty<Nat, SyncAction>();

  var patientIdCounter : Nat = 1;
  var visitIdCounter : Nat = 1;
  var prescriptionIdCounter : Nat = 1;
  var syncIdCounter : Nat = 1;

  ///////////////////////////////
  // AUTH
  ///////////////////////////////

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  ///////////////////////////////
  // CORE PATIENT LOGIC
  ///////////////////////////////

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

    // =========================
    // SYNC QUEUE (IMPORTANT)
    // =========================
    syncQueue.add(syncIdCounter, {
      id = syncIdCounter;
      entityType = "patient";
      entityId = patient.id;
      action = "create";
      payload = ?"";
      createdAt = Time.now();
      synced = false;
      retryCount = 0;
    });

    syncIdCounter += 1;

    return patient;
  };

  public query func getPatient(id : Nat) : async ?Patient {
    patients.get(id);
  };

  public query func getAllPatients() : async [Patient] {
    patients.values().toArray();
  };

  ///////////////////////////////
  // VISITS
  ///////////////////////////////

  public shared func createVisit(
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

    return visit;
  };

  public query func getAllVisits() : async [Visit] {
    visits.values().toArray();
  };

  ///////////////////////////////
  // PRESCRIPTIONS
  ///////////////////////////////

  public shared func createPrescription(
    patientId : Nat,
    visitId : ?Nat,
    prescriptionDate : Time.Time,
    diagnosis : ?Text,
    medications : [Medication],
    notes : ?Text
  ) : async Prescription {

    let p : Prescription = {
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

    prescriptions.add(prescriptionIdCounter, p);
    prescriptionIdCounter += 1;

    return p;
  };

  public query func getAllPrescriptions() : async [Prescription] {
    prescriptions.values().toArray();
  };

  ///////////////////////////////
  // SYNC ENGINE API
  ///////////////////////////////

  public query func getSyncQueue() : async [SyncAction] {
    syncQueue.values().toArray();
  };

  public shared func markSynced(id : Nat) : async () {
    switch (syncQueue.get(id)) {
      case (?item) {
        syncQueue.add(id, {
          item with synced = true;
        });
      };
      case null {};
    };
  };

  public query func getPendingSync() : async [SyncAction] {
    syncQueue.values()
    .toArray()
    .filter(func(x) { x.synced == false });
  };

}
