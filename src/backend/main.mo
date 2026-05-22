# Corrected Production-Ready Motoko Backend

```motoko
import Time "mo:core/Time";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

import MixinAuthorization "authorization/MixinAuthorization/lib";
import AccessControl "authorization/access-control/lib";

actor {

  ///////////////////////////////
  // TYPES
  ///////////////////////////////

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
  // STABLE STORAGE
  ///////////////////////////////

  stable var patientsEntries : [(Nat, Patient)] = [];
  stable var visitsEntries : [(Nat, Visit)] = [];
  stable var prescriptionEntries : [(Nat, Prescription)] = [];
  stable var syncEntries : [(Nat, SyncAction)] = [];

  stable var stablePatientIdCounter : Nat = 1;
  stable var stableVisitIdCounter : Nat = 1;
  stable var stablePrescriptionIdCounter : Nat = 1;
  stable var stableSyncIdCounter : Nat = 1;

  ///////////////////////////////
  // RUNTIME STORAGE
  ///////////////////////////////

  var patients = Map.empty<Nat, Patient>();
  var visits = Map.empty<Nat, Visit>();
  var prescriptions = Map.empty<Nat, Prescription>();
  var syncQueue = Map.empty<Nat, SyncAction>();

  var patientIdCounter : Nat = stablePatientIdCounter;
  var visitIdCounter : Nat = stableVisitIdCounter;
  var prescriptionIdCounter : Nat = stablePrescriptionIdCounter;
  var syncIdCounter : Nat = stableSyncIdCounter;

  ///////////////////////////////
  // AUTHORIZATION
  ///////////////////////////////

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  ///////////////////////////////
  // SYSTEM HOOKS
  ///////////////////////////////

  system func preupgrade() {

    patientsEntries := Iter.toArray(
      Map.entries(patients)
    );

    visitsEntries := Iter.toArray(
      Map.entries(visits)
    );

    prescriptionEntries := Iter.toArray(
      Map.entries(prescriptions)
    );

    syncEntries := Iter.toArray(
      Map.entries(syncQueue)
    );

    stablePatientIdCounter := patientIdCounter;
    stableVisitIdCounter := visitIdCounter;
    stablePrescriptionIdCounter := prescriptionIdCounter;
    stableSyncIdCounter := syncIdCounter;
  };

  system func postupgrade() {

    patients := Map.fromIter(
      patientsEntries.vals(),
      Nat.compare
    );

    visits := Map.fromIter(
      visitsEntries.vals(),
      Nat.compare
    );

    prescriptions := Map.fromIter(
      prescriptionEntries.vals(),
      Nat.compare
    );

    syncQueue := Map.fromIter(
      syncEntries.vals(),
      Nat.compare
    );

    patientIdCounter := stablePatientIdCounter;
    visitIdCounter := stableVisitIdCounter;
    prescriptionIdCounter := stablePrescriptionIdCounter;
    syncIdCounter := stableSyncIdCounter;
  };

  ///////////////////////////////
  // HEALTH
  ///////////////////////////////

  public query func health() : async Text {
    "ok";
  };

  public shared ({ caller }) func whoami() : async Principal {
    caller;
  };

  ///////////////////////////////
  // PATIENTS
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

    patients := Map.add(
      patients,
      Nat.compare,
      patientIdCounter,
      patient
    );

    syncQueue := Map.add(
      syncQueue,
      Nat.compare,
      syncIdCounter,
      {
        id = syncIdCounter;
        entityType = "patient";
        entityId = patient.id;
        action = "create";
        payload = ?"";
        createdAt = Time.now();
        synced = false;
        retryCount = 0;
      }
    );

    patientIdCounter += 1;
    syncIdCounter += 1;

    patient;
  };

  public query func getPatient(id : Nat) : async ?Patient {
    Map.get(
      patients,
      Nat.compare,
      id
    );
  };

  public query func getAllPatients() : async [Patient] {
    Iter.toArray(
      Map.vals(patients)
    );
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

    visits := Map.add(
      visits,
      Nat.compare,
      visitIdCounter,
      visit
    );

    syncQueue := Map.add(
      syncQueue,
      Nat.compare,
      syncIdCounter,
      {
        id = syncIdCounter;
        entityType = "visit";
        entityId = visit.id;
        action = "create";
        payload = ?"";
        createdAt = Time.now();
        synced = false;
        retryCount = 0;
      }
    );

    visitIdCounter += 1;
    syncIdCounter += 1;

    visit;
  };

  public query func getAllVisits() : async [Visit] {
    Iter.toArray(
      Map.vals(visits)
    );
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

    prescriptions := Map.add(
      prescriptions,
      Nat.compare,
      prescriptionIdCounter,
      p
    );

    syncQueue := Map.add(
      syncQueue,
      Nat.compare,
      syncIdCounter,
      {
        id = syncIdCounter;
        entityType = "prescription";
        entityId = p.id;
        action = "create";
        payload = ?"";
        createdAt = Time.now();
        synced = false;
        retryCount = 0;
      }
    );

    prescriptionIdCounter += 1;
    syncIdCounter += 1;

    p;
  };

  public query func getAllPrescriptions() : async [Prescription] {
    Iter.toArray(
      Map.vals(prescriptions)
    );
  };

  ///////////////////////////////
  // SYNC ENGINE
  ///////////////////////////////

  public query func getSyncQueue() : async [SyncAction] {
    Iter.toArray(
      Map.vals(syncQueue)
    );
  };

  public query func getPendingSync() : async [SyncAction] {

    let all = Iter.toArray(
      Map.vals(syncQueue)
    );

    Array.filter<SyncAction>(
      all,
      func(x) {
        x.synced == false;
      }
    );
  };

  public shared func markSynced(id : Nat) : async Bool {

    switch (
      Map.get(syncQueue, Nat.compare, id)
    ) {

      case (?item) {

        syncQueue := Map.add(
          syncQueue,
          Nat.compare,
          id,
          {
            item with
            synced = true;
          }
        );

        true;
      };

      case null {
        false;
      };
    };
  };

  ///////////////////////////////
  // STATS
  ///////////////////////////////

  public query func getStats() : async {
    totalPatients : Nat;
    totalVisits : Nat;
    totalPrescriptions : Nat;
    pendingSync : Nat;
  } {

    let pending = Array.filter<SyncAction>(
      Iter.toArray(Map.vals(syncQueue)),
      func(x) {
        x.synced == false;
      }
    );

    {
      totalPatients = Map.size(patients);
      totalVisits = Map.size(visits);
      totalPrescriptions = Map.size(prescriptions);
      pendingSync = pending.size();
    };
  };

};
```

# Additional Required Import

Add this import if Array.filter gives errors:

```motoko
import Array "mo:base/Array";
```

# Frontend Environment Variables

```env
VITE_CANISTER_ID_BACKEND=xxxxx
VITE_DFX_NETWORK=local
VITE_NHOST_SUBDOMAIN=xxxx
VITE_NHOST_REGION=ap-south-1
```

# Frontend Actor Fix

```ts
const canisterId =
  import.meta.env.VITE_CANISTER_ID_BACKEND;

if (!canisterId) {
  throw new Error(
    "Missing backend canister ID"
  );
}
```

# Install Nhost

```bash
pnpm add @nhost/nhost-js @nhost/react
```

# Nhost Client

```ts
import { NhostClient } from '@nhost/nhost-js'

export const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN,
  region: import.meta.env.VITE_NHOST_REGION,
})
```

# React Provider

```tsx
import { NhostProvider } from '@nhost/react'
import { nhost } from './lib/nhost'

<NhostProvider nhost={nhost}>
  <App />
</NhostProvider>
```
