import type { StaffRole } from "../types";
import { isConsultantType } from "../types";
import { useEmailAuth } from "./useEmailAuth";

// ── Permission set for each role ──────────────────────────────────────────────

export interface RolePermissions {
  /** Can access outpatient/outdoor patients (false = admitted/inpatient only) */
  canAccessOutpatient: boolean;
  /** Can write and finalize a prescription */
  canPrescribe: boolean;
  /** Can write and confirm a diagnosis */
  canDiagnose: boolean;
  /** Can discharge a patient */
  canDischarge: boolean;
  /** Can approve/mark intern notes as reviewed */
  canApproveInternNotes: boolean;
  /** Can edit clinical data (visit form, prescriptions, diagnosis) */
  canEditClinical: boolean;
  /** Can administer and mark medications as "given" */
  canAdministerMeds: boolean;
  /** Can record vitals */
  canRecordVitals: boolean;
  /** Can register new patients and edit patient profiles */
  canRegisterPatients: boolean;
  /** Can access billing/admin panel */
  canManageBilling: boolean;
  /** Can view all patients (not just own) */
  canViewAllPatients: boolean;
  /** Can override or approve junior (intern) prescriptions */
  canOverrideJunior: boolean;
  /** Can write consultant-level notes */
  canWriteConsultantNotes: boolean;
  /** Can admit patients */
  canAdmitPatients: boolean;
  /** Can write nursing notes */
  canWriteNursingNotes: boolean;
  /** Can finalize (not just draft) a prescription */
  canFinalizePrescription: boolean;
  /** Is a clinical role (doctor/MO/intern/nurse) — hides admin-only tabs for staff */
  isClinical: boolean;
  // ── Feature-level permissions (granular) ────────────────────────────────────
  /** Can finalize clinical notes (SOAP, daily progress) */
  canFinalizeClinicalNote: boolean;
  /** Can view the full audit trail */
  canViewAuditTrail: boolean;
  /** Can manage beds (assign, transfer, discharge) */
  canManageBeds: boolean;
  /** Can mark an order as completed */
  canCompleteOrder: boolean;
  /** Can create new clinical orders */
  canCreateOrder: boolean;
  /** Can override another doctor's prescription */
  canOverridePrescription: boolean;
  /** Can approve the final discharge summary */
  canApproveDischarge: boolean;
  /** Can enter or update vital signs */
  canEnterVitals: boolean;
  /** Can verify vitals entered by nurses/interns */
  canVerifyVitals: boolean;
  /** Can create or edit clinical notes */
  canEditClinicalNotes: boolean;
  /** Can only create drafts — not finalize */
  canCreateDraftOnly: boolean;
  /** Can view all patients in the hospital (Registrar-level) */
  canViewAllAdmittedPatients: boolean;
  /** Can view patients in own department only (Assistant Registrar) */
  canViewDepartmentPatients: boolean;
  /** Can change bed assignment inline */
  canEditBedAssignment: boolean;
  /** Can manage admissions (full or partial) */
  canManageAdmissions: boolean | "partial";
}

// ── Role → Permissions Table ──────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<
  Exclude<StaffRole, "admin" | "patient">,
  RolePermissions
> = {
  consultant_doctor: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: true,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: true,
    canOverrideJunior: true,
    canWriteConsultantNotes: true,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: true,
    canManageBeds: true,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: true,
    canApproveDischarge: true,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: true,
    canManageAdmissions: true,
  },
  medical_officer: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: false,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: false,
    canWriteConsultantNotes: false,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: false,
    canManageBeds: false,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: false,
    canApproveDischarge: false,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: false,
    canManageAdmissions: "partial",
  },
  intern_doctor: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: false,
    canApproveInternNotes: false,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: false,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: false,
    canWriteConsultantNotes: false,
    canAdmitPatients: false,
    canWriteNursingNotes: false,
    canFinalizePrescription: false,
    isClinical: true,
    canFinalizeClinicalNote: false,
    canViewAuditTrail: false,
    canManageBeds: false,
    canCompleteOrder: false,
    canCreateOrder: false,
    canOverridePrescription: false,
    canApproveDischarge: false,
    canEnterVitals: true,
    canVerifyVitals: false,
    canEditClinicalNotes: true,
    canCreateDraftOnly: true,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: false,
    canManageAdmissions: false,
  },
  nurse: {
    canAccessOutpatient: true,
    canPrescribe: false,
    canDiagnose: false,
    canDischarge: false,
    canApproveInternNotes: false,
    canEditClinical: false,
    canAdministerMeds: true,
    canRecordVitals: true,
    canRegisterPatients: false,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: false,
    canWriteConsultantNotes: false,
    canAdmitPatients: false,
    canWriteNursingNotes: true,
    canFinalizePrescription: false,
    isClinical: true,
    canFinalizeClinicalNote: false,
    canViewAuditTrail: false,
    canManageBeds: false,
    canCompleteOrder: true,
    canCreateOrder: false,
    canOverridePrescription: false,
    canApproveDischarge: false,
    canEnterVitals: true,
    canVerifyVitals: false,
    canEditClinicalNotes: false,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: false,
    canManageAdmissions: false,
  },
  staff: {
    canAccessOutpatient: true,
    canPrescribe: false,
    canDiagnose: false,
    canDischarge: false,
    canApproveInternNotes: false,
    canEditClinical: false,
    canAdministerMeds: false,
    canRecordVitals: false,
    canRegisterPatients: true,
    canManageBilling: true,
    canViewAllPatients: true,
    canOverrideJunior: false,
    canWriteConsultantNotes: false,
    canAdmitPatients: false,
    canWriteNursingNotes: false,
    canFinalizePrescription: false,
    isClinical: false,
    canFinalizeClinicalNote: false,
    canViewAuditTrail: false,
    canManageBeds: true,
    canCompleteOrder: false,
    canCreateOrder: false,
    canOverridePrescription: false,
    canApproveDischarge: false,
    canEnterVitals: false,
    canVerifyVitals: false,
    canEditClinicalNotes: false,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: false,
    canManageAdmissions: false,
  },
  doctor: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: true,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: true,
    canOverrideJunior: true,
    canWriteConsultantNotes: true,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: false,
    canManageBeds: true,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: false,
    canApproveDischarge: true,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: true,
    canManageAdmissions: true,
  },
  // ── 5 new roles ──────────────────────────────────────────────────────────────
  assistant_registrar: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: false,
    canApproveInternNotes: false,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: false,
    canWriteConsultantNotes: false,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: false,
    canManageBeds: false,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: false,
    canApproveDischarge: false,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: true,
    canEditBedAssignment: false,
    canManageAdmissions: "partial",
  },
  registrar: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: true,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: true,
    canViewAllPatients: true,
    canOverrideJunior: true,
    canWriteConsultantNotes: true,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: true,
    canManageBeds: true,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: true,
    canApproveDischarge: true,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: true,
    canViewDepartmentPatients: true,
    canEditBedAssignment: true,
    canManageAdmissions: true,
  },
  assistant_professor: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: true,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: true,
    canWriteConsultantNotes: true,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: true,
    canManageBeds: true,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: true,
    canApproveDischarge: true,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: true,
    canManageAdmissions: true,
  },
  associate_professor: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: true,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: true,
    canWriteConsultantNotes: true,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: true,
    canManageBeds: true,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: true,
    canApproveDischarge: true,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: true,
    canManageAdmissions: true,
  },
  professor: {
    canAccessOutpatient: true,
    canPrescribe: true,
    canDiagnose: true,
    canDischarge: true,
    canApproveInternNotes: true,
    canEditClinical: true,
    canAdministerMeds: false,
    canRecordVitals: true,
    canRegisterPatients: true,
    canManageBilling: false,
    canViewAllPatients: false,
    canOverrideJunior: true,
    canWriteConsultantNotes: true,
    canAdmitPatients: true,
    canWriteNursingNotes: false,
    canFinalizePrescription: true,
    isClinical: true,
    canFinalizeClinicalNote: true,
    canViewAuditTrail: true,
    canManageBeds: true,
    canCompleteOrder: true,
    canCreateOrder: true,
    canOverridePrescription: true,
    canApproveDischarge: true,
    canEnterVitals: true,
    canVerifyVitals: true,
    canEditClinicalNotes: true,
    canCreateDraftOnly: false,
    canViewAllAdmittedPatients: false,
    canViewDepartmentPatients: false,
    canEditBedAssignment: true,
    canManageAdmissions: true,
  },
};

// ── Admin fallback permissions ────────────────────────────────────────────────

const ADMIN_PERMISSIONS: RolePermissions = {
  canAccessOutpatient: true,
  canPrescribe: true,
  canDiagnose: true,
  canDischarge: true,
  canApproveInternNotes: true,
  canEditClinical: true,
  canAdministerMeds: true,
  canRecordVitals: true,
  canRegisterPatients: true,
  canManageBilling: true,
  canViewAllPatients: true,
  canOverrideJunior: true,
  canWriteConsultantNotes: true,
  canAdmitPatients: true,
  canWriteNursingNotes: true,
  canFinalizePrescription: true,
  isClinical: true,
  canFinalizeClinicalNote: true,
  canViewAuditTrail: true,
  canManageBeds: true,
  canCompleteOrder: true,
  canCreateOrder: true,
  canOverridePrescription: true,
  canApproveDischarge: true,
  canEnterVitals: true,
  canVerifyVitals: true,
  canEditClinicalNotes: true,
  canCreateDraftOnly: false,
  canViewAllAdmittedPatients: true,
  canViewDepartmentPatients: true,
  canEditBedAssignment: true,
  canManageAdmissions: true,
};

// Patient has NO clinical permissions
const PATIENT_PERMISSIONS: RolePermissions = {
  canAccessOutpatient: false,
  canPrescribe: false,
  canDiagnose: false,
  canDischarge: false,
  canApproveInternNotes: false,
  canEditClinical: false,
  canAdministerMeds: false,
  canRecordVitals: false,
  canRegisterPatients: false,
  canManageBilling: false,
  canViewAllPatients: false,
  canOverrideJunior: false,
  canWriteConsultantNotes: false,
  canAdmitPatients: false,
  canWriteNursingNotes: false,
  canFinalizePrescription: false,
  isClinical: false,
  canFinalizeClinicalNote: false,
  canViewAuditTrail: false,
  canManageBeds: false,
  canCompleteOrder: false,
  canCreateOrder: false,
  canOverridePrescription: false,
  canApproveDischarge: false,
  canEnterVitals: false,
  canVerifyVitals: false,
  canEditClinicalNotes: false,
  canCreateDraftOnly: false,
  canViewAllAdmittedPatients: false,
  canViewDepartmentPatients: false,
  canEditBedAssignment: false,
  canManageAdmissions: false,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the permission set for the currently logged-in staff/doctor.
 * Falls back to the most restrictive set (staff) when no role is matched.
 */
export function useRolePermissions(): RolePermissions {
  const { currentDoctor } = useEmailAuth();
  const role = (currentDoctor?.role ?? "staff") as StaffRole;
  return getPermissionsForRole(role);
}

/**
 * Returns permissions for a specific role without needing auth context.
 */
export function getPermissionsForRole(role: StaffRole): RolePermissions {
  if (role === "admin") return ADMIN_PERMISSIONS;
  if (role === "patient") return PATIENT_PERMISSIONS;
  return (
    ROLE_PERMISSIONS[role as Exclude<StaffRole, "admin" | "patient">] ??
    ROLE_PERMISSIONS.staff
  );
}

/** True when the role is a consultant-type (alias to the types helper for component use) */
export { isConsultantType } from "../types";
