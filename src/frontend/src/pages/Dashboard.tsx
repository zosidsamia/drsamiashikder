import { useAdminAuth } from "../hooks/useAdminAuth";
import { useEmailAuth } from "../hooks/useEmailAuth";
import type { StaffRole } from "../types";
import AdminDashboard from "./dashboards/AdminDashboard";
import ConsultantDashboard from "./dashboards/ConsultantDashboard";
import InternDashboard from "./dashboards/InternDashboard";
import MedicalOfficerDashboard from "./dashboards/MedicalOfficerDashboard";
import NurseDashboard from "./dashboards/NurseDashboard";
import StaffDashboard from "./dashboards/StaffDashboard";

/**
 * Role router — reads the current user's role and renders the appropriate dashboard.
 * Admin (via useAdminAuth) → AdminDashboard
 * Consultant / doctor    → ConsultantDashboard
 * Medical Officer        → MedicalOfficerDashboard
 * Intern Doctor          → InternDashboard
 * Nurse                  → NurseDashboard
 * Staff / Reception      → StaffDashboard
 */
export default function Dashboard() {
  const { currentDoctor } = useEmailAuth();
  const { isAdmin } = useAdminAuth();

  if (isAdmin) return <AdminDashboard />;

  const role = (currentDoctor?.role ?? "doctor") as StaffRole;

  switch (role) {
    case "consultant_doctor":
    case "doctor":
      return <ConsultantDashboard />;
    case "medical_officer":
      return <MedicalOfficerDashboard />;
    case "intern_doctor":
      return <InternDashboard />;
    case "nurse":
      return <NurseDashboard />;
    case "staff":
      return <StaffDashboard />;
    case "admin":
      return <AdminDashboard />;
    default:
      return <ConsultantDashboard />;
  }
}
