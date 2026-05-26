import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export type Gender = { 'other' : null } |
  { 'female' : null } |
  { 'male' : null };
export interface Patient {
  'id' : bigint,
  'weight' : [] | [number],
  'height' : [] | [number],
  'consultantEmail' : [] | [string],
  'nameBn' : [] | [string],
  'consultantName' : [] | [string],
  'owner' : Principal,
  'dateOfBirth' : [] | [Time],
  'createdAt' : Time,
  'fullName' : string,
  'email' : [] | [string],
  'updatedAt' : Time,
  'pastSurgicalHistory' : [] | [string],
  'bloodGroup' : [] | [string],
  'address' : [] | [string],
  'gender' : Gender,
  'patientType' : PatientType,
  'chronicConditions' : Array<string>,
  'phone' : [] | [string],
  'allergies' : Array<string>,
}
export type PatientType = { 'admitted' : null } |
  { 'outdoor' : null };
export type Time = bigint;
export type UserRole = { 'admin' : null } |
  { 'user' : null } |
  { 'guest' : null };
export interface _SERVICE {
  '_initializeAccessControlWithSecret' : ActorMethod<[string], undefined>,
  'assignCallerUserRole' : ActorMethod<[Principal, UserRole], undefined>,
  'createPatient' : ActorMethod<[string, Gender, PatientType], Patient>,
  'getAllPatients' : ActorMethod<[], Array<Patient>>,
  'getCallerUserRole' : ActorMethod<[], UserRole>,
  'getPatient' : ActorMethod<[bigint], [] | [Patient]>,
  'health' : ActorMethod<[], string>,
  'isCallerAdmin' : ActorMethod<[], boolean>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
