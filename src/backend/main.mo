import Time "mo:base/Time";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Array "mo:base/Array";

import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";

import MixinAuthorization "authorization/MixinAuthorization/lib";
import AccessControl "authorization/access-control/lib";

persistent actor {

  ////////////////////////////////////////
  // TYPES
  ////////////////////////////////////////

  public type Gender = {
    #male;
    #female;
    #other;
  };

  public type PatientType = {
    #admitted;
    #outdoor;
  };

  public type VisitType = {
    #admitted;
    #outdoor;
  };

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
    owner : Principal;
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
    consultantEmail : ?Text;
    consultantName : ?Text;
    createdAt : Time.Time;
    updatedAt : Time.Time;
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

  ////////////////////////////////////////
  // STABLE STORAGE
  ////////////////////////////////////////

  stable var patientEntries : [(Nat, Patient)] = [];
  stable var visitEntries : [(Nat, Visit)] = [];
  stable var prescriptionEntries : [(Nat, Prescription)] = [];

  stable var patientIdCounter : Nat = 1;
  stable var visitIdCounter : Nat = 1;
  stable var prescriptionIdCounter : Nat = 1;

  ////////////////////////////////////////
  // TRANSIENT RUNTIME STORAGE
  ////////////////////////////////////////

  transient var patients =
    HashMap.HashMap<Nat, Patient>(
      10,
      Nat.equal,
      Hash.hash
    );

  transient var visits =
    HashMap.HashMap<Nat, Visit>(
      10,
      Nat.equal,
      Hash.hash
    );

  transient var prescriptions =
    HashMap.HashMap<Nat, Prescription>(
      10,
      Nat.equal,
      Hash.hash
    );

  ////////////////////////////////////////
  // AUTHORIZATION
  ////////////////////////////////////////

  let accessControlState = AccessControl.initState();

  include MixinAuthorization(accessControlState);

  ////////////////////////////////////////
  // HELPERS
  ////////////////////////////////////////

  func assertAuthenticated(caller : Principal) {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Authentication required");
    };
  };

  ////////////////////////////////////////
  // UPGRADE HOOKS
  ////////////////////////////////////////

  system func preupgrade() {

    patientEntries := Iter.toArray(
      patients.entries()
    );

    visitEntries := Iter.toArray(
      visits.entries()
    );

    prescriptionEntries := Iter.toArray(
      prescriptions.entries()
    );
  };

  system func postupgrade() {

    patients := HashMap.fromIter<Nat, Patient>(
      patientEntries.vals(),
      patientEntries.size(),
      Nat.equal,
      Hash.hash
    );

    visits := HashMap.fromIter<Nat, Visit>(
      visitEntries.vals(),
      visitEntries.size(),
      Nat.equal,
      Hash.hash
    );

    prescriptions := HashMap.fromIter<Nat, Prescription>(
      prescriptionEntries.vals(),
      prescriptionEntries.size(),
      Nat.equal,
      Hash.hash
    );
  };

  ////////////////////////////////////////
  // HEALTH
  ////////////////////////////////////////

  public query func health() : async Text {
    "ok"
  };

  ////////////////////////////////////////
  // PATIENT APIs
  ////////////////////////////////////////

  public shared ({ caller }) func createPatient(
    fullName : Text,
    gender : Gender,
    patientType : PatientType
  ) : async Patient {

    assertAuthenticated(caller);

    let patient : Patient = {
      id = patientIdCounter;
      owner = caller;
      fullName = fullName;
      nameBn = null;
      dateOfBirth = null;
      gender = gender;
      phone = null;
      email = null;
      address = null;
      bloodGroup = null;
      weight = null;
      height = null;
      allergies = [];
      chronicConditions = [];
      pastSurgicalHistory = null;
      patientType = patientType;
      consultantEmail = null;
      consultantName = null;
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    patients.put(patientIdCounter, patient);

    patientIdCounter += 1;

    patient
  };

  public query func getPatient(
    id : Nat
  ) : async ?Patient {
    patients.get(id)
  };

  public query func getAllPatients()
    : async [Patient] {

    Iter.toArray(
      patients.vals()
    )
  };

}