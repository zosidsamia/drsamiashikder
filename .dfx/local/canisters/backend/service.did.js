export const idlFactory = ({ IDL }) => {
  const UserRole = IDL.Variant({
    'admin' : IDL.Null,
    'user' : IDL.Null,
    'guest' : IDL.Null,
  });
  const Gender = IDL.Variant({
    'other' : IDL.Null,
    'female' : IDL.Null,
    'male' : IDL.Null,
  });
  const PatientType = IDL.Variant({
    'admitted' : IDL.Null,
    'outdoor' : IDL.Null,
  });
  const Time = IDL.Int;
  const Patient = IDL.Record({
    'id' : IDL.Nat,
    'weight' : IDL.Opt(IDL.Float64),
    'height' : IDL.Opt(IDL.Float64),
    'consultantEmail' : IDL.Opt(IDL.Text),
    'nameBn' : IDL.Opt(IDL.Text),
    'consultantName' : IDL.Opt(IDL.Text),
    'owner' : IDL.Principal,
    'dateOfBirth' : IDL.Opt(Time),
    'createdAt' : Time,
    'fullName' : IDL.Text,
    'email' : IDL.Opt(IDL.Text),
    'updatedAt' : Time,
    'pastSurgicalHistory' : IDL.Opt(IDL.Text),
    'bloodGroup' : IDL.Opt(IDL.Text),
    'address' : IDL.Opt(IDL.Text),
    'gender' : Gender,
    'patientType' : PatientType,
    'chronicConditions' : IDL.Vec(IDL.Text),
    'phone' : IDL.Opt(IDL.Text),
    'allergies' : IDL.Vec(IDL.Text),
  });
  return IDL.Service({
    '_initializeAccessControlWithSecret' : IDL.Func([IDL.Text], [], []),
    'assignCallerUserRole' : IDL.Func([IDL.Principal, UserRole], [], []),
    'createPatient' : IDL.Func([IDL.Text, Gender, PatientType], [Patient], []),
    'getAllPatients' : IDL.Func([], [IDL.Vec(Patient)], ['query']),
    'getCallerUserRole' : IDL.Func([], [UserRole], ['query']),
    'getPatient' : IDL.Func([IDL.Nat], [IDL.Opt(Patient)], ['query']),
    'health' : IDL.Func([], [IDL.Text], ['query']),
    'isCallerAdmin' : IDL.Func([], [IDL.Bool], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
