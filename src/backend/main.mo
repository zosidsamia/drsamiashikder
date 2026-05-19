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

  public type UserProfile = {
    name : Text;
  };

  ///////////////////////////////
  // SYNC SYSTEM (ICP → NHOST)
  ///////////////////////////////

  public type SyncAction = {
    id : Nat;
    entity : Text;   // "patient", "visit", "prescription"
    action : Text;   // create | update | delete
    payload : Text;  // minimal JSON or string
    createdAt : Time.Time;
  };

  let syncQueue = Map.empty<Nat, SyncAction>();
  var syncCounter : Nat = 1;

  func pushSync(entity : Text, action : Text, payload : Text) {
    let item : SyncAction = {
      id = syncCounter;
      entity;
      action;
      payload;
      createdAt = Time.now();
    };

    syncQueue.add(syncCounter, item);
    syncCounter += 1;
  };

  public query func getSyncQueue() : async [SyncAction] {
    syncQueue.values().toArray();
  };

  ///////////////////////////////
  // DATA STORES
  ///////////////////////////////

  let patients = Map.empty<Nat, Patient>();
  let visits = Map.empty<Nat, Visit>();
  let prescriptions = Map.empty<Nat, Prescription>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  var patientIdCounter = 1;
  var visitIdCounter = 1;
  var prescriptionIdCounter = 1;

  ///////////////////////////////
  // AUTH
  ///////////////////////////////

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let clinicalEngineState = ClinicalDataEngineLib.initState();
  include ClinicalDataEngineMixin(clinicalEngineState, accessControlState);

  ///////////////////////////////
  // PATIENT FUNCTIONS
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

    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
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

    // 🔥 SYNC EVENT
    pushSync("patient", "create", Nat.toText(patient.id));

    patient;
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

    let existing = switch (patients.get(id)) {
      case (?p) p;
      case null Runtime.trap("Not found");
    };

    let updated : Patient = {
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
      createdAt = existing.createdAt;
      updatedAt = Time.now();
      consultantEmail;
      consultantName;
    };

    patients.add(id, updated);

    // 🔥 SYNC EVENT
    pushSync("patient", "update", Nat.toText(id));

    updated;
  };

  public shared ({ caller }) func deletePatient(id : Nat) : async () {

    patients.remove(id);

    // 🔥 SYNC EVENT
    pushSync("patient", "delete", Nat.toText(id));
  };

  ///////////////////////////////
  // SYNC ACCESS
  ///////////////////////////////

  public query func getAllPatients() : async [Patient] {
    patients.values().toArray();
  };

  public query func getSync() : async [SyncAction] {
    syncQueue.values().toArray();
  };

};
