import { useEffect } from "react";
import { startSyncEngine } from "./lib/sync/startSync";
import { useEffect } from "react";
import { startSyncEngine } from "./lib/SyncEngine";

useEffect(() => {
  startSyncEngine();
}, []);

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "./Layout";
import { createActor } from "./backend";
import { useAdminAuth } from "./hooks/useAdminAuth";
import {
  EmailAuthProvider,
  appendAuditLog,
  loadPatientRegistry,
  loadRegistry,
  savePatientRegistry,
  saveRegistry,
  useEmailAuth,
  useInactivityTimer,
} from "./hooks/useEmailAuth";
import type { DoctorAccount, PatientAccount } from "./hooks/useEmailAuth";
import { useMigration } from "./hooks/useMigration";
import { getCanisterActor, setCanisterActor } from "./hooks/useQueries";
import AppointmentPayment from "./pages/AppointmentPayment";
import Appointments from "./pages/Appointments";
import AuditLog from "./pages/AuditLog";
import BedManagement from "./pages/BedManagement";
import Dashboard from "./pages/Dashboard";
import EmergencyPrescription from "./pages/EmergencyPrescription";
import InvestigationPaymentPage from "./pages/InvestigationPaymentPage";
import LandingPage from "./pages/LandingPage";
import OtherPayment from "./pages/OtherPayment";
import OutstandingBalances from "./pages/OutstandingBalances";
import PatientDashboard from "./pages/PatientDashboard";
import Patients from "./pages/Patients";
import ProcedurePayment from "./pages/ProcedurePayment";
import RegistrarDashboard from "./pages/RegistrarDashboard";
import SerialDisplay from "./pages/SerialDisplay";
import Settings from "./pages/Settings";
import Staff from "./pages/Staff";
import TotalIncome from "./pages/TotalIncome";
import VisitPage from "./pages/VisitPage";
import WardRound from "./pages/WardRound";
import {
  ROLE_HIERARCHY_ORDER,
  STAFF_ROLE_COLORS,
  STAFF_ROLE_LABELS,
} from "./types";
import type { StaffRole } from "./types";

// ── Route tree ────────────────────────────────────────────────────────────────

function RootLayoutComponent() {
  const state = useRouterState();
  const pathname = state.location.pathname;
  const currentPageName =
    pathname === "/" || pathname === "/Patients"
      ? "Patients"
      : pathname === "/Dashboard"
        ? "Dashboard"
        : pathname === "/Appointments"
          ? "Appointments"
          : pathname === "/AuditLog"
            ? "AuditLog"
            : pathname.replace(/^\//, "");
  return (
    <Layout currentPageName={currentPageName}>
      <Outlet />
    </Layout>
  );
}

const rootRoute = createRootRoute({ component: RootLayoutComponent });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/Dashboard",
  component: Dashboard,
});
const patientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/Patients",
  component: Patients,
});
const patientProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/PatientProfile",
  component: PatientProfileWrapper,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/Settings",
  component: Settings,
});
const appointmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/Appointments",
  component: Appointments,
});
const auditLogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/AuditLog",
  component: AuditLog,
});
const wardRoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/WardRound",
  component: WardRound,
});
const bedManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/BedManagement",
  component: BedManagement,
});
const visitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/Visit",
  component: VisitPage,
});
const emergencyPrescriptionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/EmergencyPrescription",
  component: EmergencyPrescription,
});
const staffRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/Staff",
  component: Staff,
});
const appointmentPaymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/AppointmentPayment",
  component: AppointmentPayment,
});
const investigationPaymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/InvestigationPayment",
  component: InvestigationPaymentPage,
});
const procedurePaymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ProcedurePayment",
  component: ProcedurePayment,
});
const totalIncomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/TotalIncome",
  component: TotalIncome,
});
const otherPaymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/OtherPayment",
  component: OtherPayment,
});
const registrarDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/RegistrarDashboard",
  component: RegistrarDashboard,
});
const outstandingBalancesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/OutstandingBalances",
  component: OutstandingBalances,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  patientsRoute,
  patientProfileRoute,
  settingsRoute,
  appointmentsRoute,
  auditLogRoute,
  wardRoundRoute,
  bedManagementRoute,
  visitRoute,
  emergencyPrescriptionRoute,
  staffRoute,
  appointmentPaymentRoute,
  investigationPaymentRoute,
  procedurePaymentRoute,
  totalIncomeRoute,
  otherPaymentRoute,
  outstandingBalancesRoute,
  registrarDashboardRoute,
]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// PatientProfile wrapper that decides the role
function PatientProfileWrapper() {
  const { currentDoctor } = useEmailAuth();
  const role = (currentDoctor?.role ?? "doctor") as StaffRole;
  // Map to the 4-bucket currentRole the dashboard understands, but pass the
  // granular StaffRole separately so permission-gated actions use the real role.
  const dashboardRole: "admin" | "doctor" | "staff" =
    role === "staff" ? "staff" : "doctor";
  return <PatientDashboard currentRole={dashboardRole} viewerRole={role} />;
}

// ── Auth Form Content ─────────────────────────────────────────────────────────

const DESIGNATIONS = ["Dr.", "Prof.", "Assoc. Prof.", "Mr.", "Ms.", "Mrs."];

function StaffAuthContent() {
  const { signIn, signUp, isLoggingIn, authError } = useEmailAuth();

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siError, setSiError] = useState("");

  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suDesignation, setSuDesignation] = useState("Dr.");
  const [suDegree, setSuDegree] = useState("");
  const [suSpecialization, setSuSpecialization] = useState("");
  const [suHospital, setSuHospital] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suRole, setSuRole] = useState<StaffRole>("doctor");
  const [suErrors, setSuErrors] = useState<Record<string, string>>({});
  const [suSuccess, setSuSuccess] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiError("");
    if (!siEmail || !siPassword) {
      setSiError("Please enter email and password.");
      return;
    }
    try {
      await signIn(siEmail, siPassword);
    } catch (err: unknown) {
      setSiError(err instanceof Error ? err.message : "Sign in failed.");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!suName.trim()) errs.name = "Full name is required.";
    if (!suEmail.trim()) errs.email = "Email is required.";
    if (!suPassword) errs.password = "Password is required.";
    else if (suPassword.length < 6)
      errs.password = "Password must be at least 6 characters.";
    if (suPassword !== suConfirm) errs.confirm = "Passwords do not match.";
    if (Object.keys(errs).length > 0) {
      setSuErrors(errs);
      return;
    }
    setSuErrors({});
    setSuSuccess("");
    try {
      await signUp({
        name: suName.trim(),
        email: suEmail.trim(),
        password: suPassword,
        designation: suDesignation,
        degree: suDegree.trim(),
        specialization: suSpecialization.trim(),
        hospital: suHospital.trim(),
        phone: suPhone.trim(),
        role: suRole,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed.";
      if (
        msg.includes("approval") ||
        msg.includes("pending") ||
        msg.includes("re-submitted")
      )
        setSuSuccess(msg);
      else setSuErrors({ general: msg });
    }
  };

  return (
    <Tabs defaultValue="signin">
      <TabsList className="w-full mb-5">
        <TabsTrigger
          value="signin"
          className="flex-1"
          data-ocid="auth.signin.tab"
        >
          Sign In
        </TabsTrigger>
        <TabsTrigger
          value="signup"
          className="flex-1"
          data-ocid="auth.signup.tab"
        >
          Sign Up
        </TabsTrigger>
      </TabsList>
      <TabsContent value="signin">
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="si-email">Email</Label>
            <Input
              id="si-email"
              type="email"
              placeholder="doctor@hospital.com"
              value={siEmail}
              onChange={(e) => setSiEmail(e.target.value)}
              autoComplete="email"
              data-ocid="auth.signin.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="si-password">Password</Label>
            <Input
              id="si-password"
              type="password"
              placeholder="••••••"
              value={siPassword}
              onChange={(e) => setSiPassword(e.target.value)}
              autoComplete="current-password"
              data-ocid="auth.signin.input"
            />
          </div>
          {(siError || authError) && (
            <p
              className="text-sm text-destructive"
              data-ocid="auth.signin.error_state"
            >
              {siError || authError}
            </p>
          )}
          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-11 font-semibold"
            data-ocid="auth.signin.submit_button"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isLoggingIn ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="signup">
        <form onSubmit={handleSignUp} className="space-y-3">
          {suErrors.general && (
            <p
              className="text-sm text-destructive"
              data-ocid="auth.signup.error_state"
            >
              {suErrors.general}
            </p>
          )}
          {suSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <p className="text-sm text-emerald-700 font-medium">
                {suSuccess}
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Select value={suDesignation} onValueChange={setSuDesignation}>
                <SelectTrigger data-ocid="auth.signup.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGNATIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="su-name">Full Name *</Label>
              <Input
                id="su-name"
                placeholder="Arman Kabir"
                value={suName}
                onChange={(e) => setSuName(e.target.value)}
                data-ocid="auth.signup.input"
              />
              {suErrors.name && (
                <p className="text-xs text-destructive">{suErrors.name}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select
              value={suRole}
              onValueChange={(v) => setSuRole(v as StaffRole)}
            >
              <SelectTrigger data-ocid="auth.signup.select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_HIERARCHY_ORDER.map((r) => (
                  <SelectItem key={r} value={r}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${(STAFF_ROLE_COLORS[r] ?? "").split(" ")[0]}`}
                      />
                      {STAFF_ROLE_LABELS[r]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-email">Email *</Label>
            <Input
              id="su-email"
              type="email"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              autoComplete="email"
              data-ocid="auth.signup.input"
            />
            {suErrors.email && (
              <p className="text-xs text-destructive">{suErrors.email}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="su-password">Password *</Label>
              <Input
                id="su-password"
                type="password"
                placeholder="Min. 6 chars"
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                data-ocid="auth.signup.input"
              />
              {suErrors.password && (
                <p className="text-xs text-destructive">{suErrors.password}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-confirm">Confirm *</Label>
              <Input
                id="su-confirm"
                type="password"
                placeholder="Repeat"
                value={suConfirm}
                onChange={(e) => setSuConfirm(e.target.value)}
                data-ocid="auth.signup.input"
              />
              {suErrors.confirm && (
                <p className="text-xs text-destructive">{suErrors.confirm}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-degree">Degree / Qualifications</Label>
            <Input
              id="su-degree"
              placeholder="MBBS, MD, FCPS"
              value={suDegree}
              onChange={(e) => setSuDegree(e.target.value)}
              data-ocid="auth.signup.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-spec">Specialization</Label>
            <Input
              id="su-spec"
              value={suSpecialization}
              onChange={(e) => setSuSpecialization(e.target.value)}
              data-ocid="auth.signup.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-hospital">Hospital / Clinic</Label>
            <Input
              id="su-hospital"
              value={suHospital}
              onChange={(e) => setSuHospital(e.target.value)}
              data-ocid="auth.signup.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-phone">Phone Number</Label>
            <Input
              id="su-phone"
              type="tel"
              value={suPhone}
              onChange={(e) => setSuPhone(e.target.value)}
              data-ocid="auth.signup.input"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-11 font-semibold mt-1"
            data-ocid="auth.signup.submit_button"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isLoggingIn ? "Creating account..." : "Create Account"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            New accounts require admin approval before login.
          </p>
        </form>
      </TabsContent>
    </Tabs>
  );
}

// ── Patient Auth Content ──────────────────────────────────────────────────────

function PatientAuthContent() {
  const { patientSignIn, patientSignUp, isLoggingIn, authError } =
    useEmailAuth();

  const [tab, setTab] = useState("signin");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [suPhone, setSuPhone] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suRegNo, setSuRegNo] = useState("");
  const [suError, setSuError] = useState("");
  const [suSuccess, setSuSuccess] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone || !password) {
      setError("Please enter phone and password.");
      return;
    }
    try {
      await patientSignIn(phone, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuError("");
    setSuSuccess("");
    if (!suRegNo.trim()) {
      setSuError(
        "Register number is required. Contact the clinic to get your register number.",
      );
      return;
    }
    if (!suPhone.trim()) {
      setSuError("Phone number is required.");
      return;
    }
    if (!suPassword || suPassword.length < 6) {
      setSuError("Password must be at least 6 characters.");
      return;
    }
    if (suPassword !== suConfirm) {
      setSuError("Passwords do not match.");
      return;
    }
    try {
      await patientSignUp({
        registerNumber: suRegNo.trim(),
        phone: suPhone.trim(),
        password: suPassword,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed.";
      if (msg.includes("approval") || msg.includes("pending"))
        setSuSuccess(msg);
      else setSuError(msg);
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full mb-5">
        <TabsTrigger
          value="signin"
          className="flex-1"
          data-ocid="patient_auth.signin.tab"
        >
          Patient Login
        </TabsTrigger>
        <TabsTrigger
          value="signup"
          className="flex-1"
          data-ocid="patient_auth.signup.tab"
        >
          New Account
        </TabsTrigger>
      </TabsList>
      <TabsContent value="signin">
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Phone Number</Label>
            <Input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-ocid="patient_auth.signin.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-ocid="patient_auth.signin.input"
            />
          </div>
          {(error || authError) && (
            <p
              className="text-sm text-destructive"
              data-ocid="patient_auth.signin.error_state"
            >
              {error || authError}
            </p>
          )}
          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 shadow-md"
            data-ocid="patient_auth.signin.submit_button"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isLoggingIn ? "Signing in..." : "Login"}
          </Button>
          <p className="text-center text-sm text-muted-foreground pt-1">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="text-teal-600 underline font-medium"
              onClick={() => setTab("signup")}
              data-ocid="patient_auth.signup_link.button"
            >
              New Account →
            </button>
          </p>
        </form>
      </TabsContent>
      <TabsContent value="signup">
        <form onSubmit={handleSignUp} className="space-y-3">
          {suError && (
            <p
              className="text-sm text-destructive"
              data-ocid="patient_auth.signup.error_state"
            >
              {suError}
            </p>
          )}
          {suSuccess && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
              <p className="text-sm text-teal-700 font-medium">{suSuccess}</p>
            </div>
          )}
          <div
            className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800"
            data-ocid="patient_auth.download_hint"
          >
            <p className="font-semibold mb-0.5">📋 Register Number Required</p>
            <p className="text-xs leading-relaxed">
              Your register number was given when you first visited the clinic.
              Format: <strong>0001/26</strong>. Contact the clinic if you need
              help.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Register Number *</Label>
            <Input
              placeholder="0001/26"
              value={suRegNo}
              onChange={(e) => setSuRegNo(e.target.value)}
              data-ocid="patient_auth.signup.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile Number *</Label>
            <Input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={suPhone}
              onChange={(e) => setSuPhone(e.target.value)}
              data-ocid="patient_auth.signup.input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Min. 6 chars"
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                data-ocid="patient_auth.signup.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm *</Label>
              <Input
                type="password"
                placeholder="Repeat"
                value={suConfirm}
                onChange={(e) => setSuConfirm(e.target.value)}
                data-ocid="patient_auth.signup.input"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-11 font-semibold mt-1 bg-teal-600 hover:bg-teal-700"
            data-ocid="patient_auth.signup.submit_button"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isLoggingIn ? "Creating account..." : "Create Patient Account"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your name will be auto-filled from your clinic record. Accounts
            require doctor approval.
          </p>
        </form>
      </TabsContent>
    </Tabs>
  );
}

// ── Pending Approvals Panel ───────────────────────────────────────────────────

function PendingApprovalsPanel() {
  const [staffAccounts, setStaffAccounts] = useState<DoctorAccount[]>([]);
  const [patientAccounts, setPatientAccounts] = useState<PatientAccount[]>([]);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, StaffRole>>(
    {},
  );
  const [reassignMap, setReassignMap] = useState<Record<string, StaffRole>>({});

  const refresh = useCallback(() => {
    setStaffAccounts(loadRegistry().filter((d) => d.status === "pending"));
    setPatientAccounts(
      loadPatientRegistry().filter((p) => p.status === "pending"),
    );
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  const approveStaff = (acc: DoctorAccount) => {
    const role = approvalRoles[acc.id] ?? acc.role ?? "doctor";
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === acc.id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "approved", role };
      saveRegistry(reg);
      refresh();
      import("sonner").then(({ toast }) =>
        toast.success(`Account approved as ${STAFF_ROLE_LABELS[role]}`),
      );
    }
  };
  const rejectStaff = (id: string) => {
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "rejected" };
      saveRegistry(reg);
      refresh();
      import("sonner").then(({ toast }) => toast.success("Account rejected"));
    }
  };
  const approvePatient = (id: string) => {
    const reg = loadPatientRegistry();
    const idx = reg.findIndex((p) => p.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "approved" };
      savePatientRegistry(reg);
      refresh();
      import("sonner").then(({ toast }) =>
        toast.success("Patient account approved"),
      );
    }
  };
  const rejectPatient = (id: string) => {
    const reg = loadPatientRegistry();
    const idx = reg.findIndex((p) => p.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "rejected" };
      savePatientRegistry(reg);
      refresh();
      import("sonner").then(({ toast }) =>
        toast.success("Patient account rejected"),
      );
    }
  };

  const doReassign = (id: string) => {
    const newRole = reassignMap[id];
    if (!newRole) return;
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === id);
    if (idx >= 0) {
      const oldRole = reg[idx].role as StaffRole;
      const staffName = reg[idx].name;
      reg[idx] = { ...reg[idx], role: newRole };
      saveRegistry(reg);
      // Append audit log entry
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "admin",
        userName: "Admin",
        action: `Role changed from ${STAFF_ROLE_LABELS[oldRole] ?? oldRole} → ${STAFF_ROLE_LABELS[newRole]}`,
        target: staffName,
      });
      refresh();
      import("sonner").then(({ toast }) =>
        toast.success(
          `${staffName}: ${STAFF_ROLE_LABELS[oldRole] ?? oldRole} → ${STAFF_ROLE_LABELS[newRole]}`,
          { description: "Role change has been logged in the audit trail." },
        ),
      );
    }
  };

  // All approved staff for reassignment section
  const approvedStaff = loadRegistry().filter((d) => d.status === "approved");

  const hasAny = staffAccounts.length > 0 || patientAccounts.length > 0;

  return (
    <div className="space-y-6">
      {hasAny ? (
        <>
          {staffAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Staff / Doctor ({staffAccounts.length})
              </p>
              <div className="space-y-3">
                {staffAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-card border border-amber-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">
                          {acc.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {acc.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-xs border-blue-200 text-blue-700"
                          >
                            {STAFF_ROLE_LABELS[acc.role as StaffRole] ??
                              acc.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(acc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Role selection before approval */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs shrink-0">Approve as:</Label>
                      <Select
                        value={approvalRoles[acc.id] ?? acc.role ?? "doctor"}
                        onValueChange={(v) =>
                          setApprovalRoles((prev) => ({
                            ...prev,
                            [acc.id]: v as StaffRole,
                          }))
                        }
                      >
                        <SelectTrigger
                          className="h-8 text-xs flex-1"
                          data-ocid="admin.role.select"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_HIERARCHY_ORDER.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${(STAFF_ROLE_COLORS[r] ?? "").split(" ")[0]}`}
                                />
                                {STAFF_ROLE_LABELS[r]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                        onClick={() => approveStaff(acc)}
                        data-ocid="admin.approve.button"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-700 border-red-300 hover:bg-red-50 gap-1.5"
                        onClick={() => rejectStaff(acc.id)}
                        data-ocid="admin.reject.button"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {patientAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Patient Accounts ({patientAccounts.length})
              </p>
              <div className="space-y-3">
                {patientAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-card border border-teal-200 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">
                        {acc.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {acc.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className="text-xs border-teal-200 text-teal-700"
                        >
                          patient
                        </Badge>
                        {acc.registerNumber && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {acc.registerNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                        onClick={() => approvePatient(acc.id)}
                        data-ocid="admin.approve.button"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50 gap-1.5"
                        onClick={() => rejectPatient(acc.id)}
                        data-ocid="admin.reject.button"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm text-amber-700">
          No pending approvals.
        </div>
      )}

      {/* Role reassignment for existing approved staff */}
      {approvedStaff.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Reassign Roles — Active Staff ({approvedStaff.length})
          </p>
          <div className="space-y-2">
            {approvedStaff.map((acc) => (
              <div
                key={acc.id}
                className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {acc.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {acc.email}
                  </p>
                </div>
                <Select
                  value={reassignMap[acc.id] ?? acc.role}
                  onValueChange={(v) =>
                    setReassignMap((prev) => ({
                      ...prev,
                      [acc.id]: v as StaffRole,
                    }))
                  }
                >
                  <SelectTrigger
                    className="h-7 text-xs w-40"
                    data-ocid="admin.reassign.select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_HIERARCHY_ORDER.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${(STAFF_ROLE_COLORS[r] ?? "").split(" ")[0]}`}
                          />
                          {STAFF_ROLE_LABELS[r]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={() => doReassign(acc.id)}
                  disabled={
                    !reassignMap[acc.id] || reassignMap[acc.id] === acc.role
                  }
                  data-ocid="admin.reassign.button"
                >
                  Save
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inactivity Warning Overlay ────────────────────────────────────────────────

function InactivityWarningOverlay({
  secondsRemaining,
  onStayLoggedIn,
}: {
  secondsRemaining: number;
  onStayLoggedIn: () => void;
}) {
  const minutes = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr =
    minutes > 0 ? `${minutes}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
        data-ocid="inactivity.dialog"
      >
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Bell className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">
          Session Expiring Soon
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          You will be logged out due to inactivity in
        </p>
        <div
          className="text-4xl font-mono font-bold text-amber-600 mb-5"
          data-ocid="inactivity.countdown"
        >
          {timeStr}
        </div>
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={onStayLoggedIn}
          data-ocid="inactivity.confirm_button"
        >
          Stay Logged In
        </Button>
      </motion.div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

interface DrugReminder {
  id: string;
  patientId: string;
  drugName: string;
  times: string[];
  enabled: boolean;
  createdAt: string;
}

function AppInner() {
  const {
    currentDoctor,
    currentPatient,
    patientSignOut,
    signOut,
    isInitializing,
  } = useEmailAuth();
  const {
    adminLogin,
    isAdmin: isAdminState,
    adminLogout: adminLogoutFn,
  } = useAdminAuth();

  // Auto-logout on inactivity — active only when someone is logged in
  const isLoggedIn = !!(currentDoctor || currentPatient);
  const handleInactivityLogout = useCallback(() => {
    if (currentDoctor) {
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: currentDoctor.role,
        userName: currentDoctor.name,
        action: "Auto-logged out due to inactivity",
        target: "System",
      });
      signOut();
    } else if (currentPatient) {
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "patient",
        userName: currentPatient.name,
        action: "Auto-logged out due to inactivity",
        target: "Patient Portal",
      });
      patientSignOut();
    }
    import("sonner").then(({ toast }) =>
      toast.warning("You have been logged out due to inactivity."),
    );
  }, [currentDoctor, currentPatient, signOut, patientSignOut]);

  const { showWarning, secondsRemaining, resetTimer } = useInactivityTimer(
    isLoggedIn ? handleInactivityLogout : () => {},
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [authTab, setAuthTab] = useState("staff");

  // ── Canister actor + cross-device sync setup ─────────────────────────────────
  const queryClient = useQueryClient();

  // Create anonymous canister actor once on mount.
  // Anonymous reads work for all query methods (no auth required on canister).
  const canisterActorRef = useRef<ReturnType<typeof createActor> | null>(null);
  // Track actor in state so useMigration receives a non-null value after creation.
  // canisterActorRef is kept for synchronous access; canisterActorState drives re-renders.
  const [canisterActorState, setCanisterActorState] = useState<ReturnType<
    typeof createActor
  > | null>(null);

  const [backendDisconnected, setBackendDisconnected] = useState(false);

  useEffect(() => {
    // Guard: only create actor once
    if (canisterActorRef.current) return;

    function resolveCanisterId(): string {
      const w = window as unknown as Record<string, unknown>;
      const envRaw = (
        import.meta as unknown as Record<string, Record<string, string>>
      ).env;

      // Pattern 0: build-time injected by vite.config.js define block
      // (catches both Vercel VITE_ prefix and Caffeine platform prefix)
      const p0 = w.__RESOLVED_CANISTER_ID_BACKEND as string | undefined;
      if (p0 && p0 !== "undefined" && p0 !== "") return p0;

      // Pattern 1: VITE_ prefix — required for Vercel custom deployments
      // (Vercel only injects vars prefixed with VITE_ into the browser bundle)
      const p1v = envRaw?.VITE_CANISTER_ID_BACKEND;
      if (p1v && p1v !== "undefined" && p1v !== "") return p1v;

      // Pattern 2: plain CANISTER_ prefix — Caffeine platform injects this
      const p1c = envRaw?.CANISTER_ID_BACKEND;
      if (p1c && p1c !== "undefined" && p1c !== "") return p1c;

      // Pattern 3: direct window property
      const p3 = w.CANISTER_ID_BACKEND as string | undefined;
      if (p3 && p3 !== "undefined" && p3 !== "") return p3;

      // Pattern 4: underscore-prefixed window property
      const p4 = w.__CANISTER_ID_BACKEND as string | undefined;
      if (p4 && p4 !== "undefined" && p4 !== "") return p4;

      // Pattern 5: platform __ENV__ object
      const envObj = w.__ENV__ as Record<string, string> | undefined;
      const p5 = envObj?.CANISTER_ID_BACKEND;
      if (p5 && p5 !== "undefined" && p5 !== "") return p5;
      const p5v = envObj?.VITE_CANISTER_ID_BACKEND;
      if (p5v && p5v !== "undefined" && p5v !== "") return p5v;

      // Pattern 6: <meta name="canister-id-backend"> tag
      try {
        const metaVal = document
          .querySelector('meta[name="canister-id-backend"]')
          ?.getAttribute("content");
        if (metaVal && metaVal !== "undefined" && metaVal !== "")
          return metaVal;
      } catch {}

      // Pattern 7: scan all <script> tags for JSON containing CANISTER_ID_BACKEND
      try {
        const scripts = document.querySelectorAll("script");
        for (const script of Array.from(scripts)) {
          const text = script.textContent ?? "";
          if (!text.includes("CANISTER_ID_BACKEND")) continue;
          // Try to find it as window.CANISTER_ID_BACKEND = "..."
          const m1 = text.match(
            /CANISTER_ID_BACKEND\s*[=:]\s*["']([a-z0-9-]{5,})["']/,
          );
          if (m1?.[1] && m1[1] !== "undefined") return m1[1];
          // Try JSON object: { "CANISTER_ID_BACKEND": "..." }
          try {
            const jsonMatch = text.match(/\{[^}]*CANISTER_ID_BACKEND[^}]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
              if (
                parsed.CANISTER_ID_BACKEND &&
                parsed.CANISTER_ID_BACKEND !== "undefined"
              )
                return parsed.CANISTER_ID_BACKEND;
            }
          } catch {}
        }
      } catch {}

      // Pattern 8: __CANISTER_ID_BACKEND as a global var set by build injection
      try {
        const g8 = (globalThis as unknown as Record<string, unknown>)
          .__CANISTER_ID_BACKEND as string | undefined;
        if (g8 && g8 !== "undefined" && g8 !== "") return g8;
      } catch {}

      return "";
    }

    function tryCreateActor() {
      if (canisterActorRef.current) return true; // already created
      const canisterId = resolveCanisterId();
      if (!canisterId) return false;

      try {
        const actor = createActor(
          canisterId,
          async (file) => {
            const bytes = await file.getBytes();
            return new Uint8Array(bytes.buffer as ArrayBuffer);
          },
          async (bytes) => {
            const { ExternalBlob } = await import("./backend");
            return ExternalBlob.fromBytes(
              new Uint8Array(bytes.buffer as ArrayBuffer),
            );
          },
        );
        if (!actor) {
          console.error(
            "[sync] createActor() returned null/undefined — setCanisterActor not called. " +
              "Verify the canister ID is correct and the backend is reachable.",
          );
          return false;
        }
        canisterActorRef.current = actor;
        setCanisterActorState(actor);
        setCanisterActor(actor);
        setBackendDisconnected(false);
        console.info(
          `[sync] Canister actor initialized with ID: ${canisterId}`,
        );
        // Expose debug helper on window for troubleshooting
        (window as unknown as Record<string, unknown>).__debugSync = () =>
          console.log("canisterId:", canisterId, "actor:", getCanisterActor());
        return true;
      } catch (err) {
        console.error("[sync] Could not create canister actor:", err);
        return false;
      }
    }

    if (tryCreateActor()) {
      // Actor created on first try — fire canisterReady event
      window.dispatchEvent(new CustomEvent("canisterReady"));
      return;
    }

    // canisterId was empty on first attempt — log once, then keep retrying.
    // tryCreateActor re-resolves the canister ID on every call so a late injection
    // (e.g., a <script> tag appended by the platform after DOMContentLoaded) is picked up.
    console.warn(
      "[sync] CANISTER_ID_BACKEND not yet available — will retry every 5s (up to 40 attempts).\n" +
        "If this is a Vercel deployment: add VITE_CANISTER_ID_BACKEND to your Vercel project\n" +
        "Environment Variables and redeploy. The value is the canister ID from the Caffeine platform.",
    );
    setBackendDisconnected(true);

    let retries = 0;
    const MAX_RETRIES = 40; // 40 × 5s = 3 min 20s window for late injection
    const retryInterval = setInterval(() => {
      retries++;
      if (tryCreateActor()) {
        clearInterval(retryInterval);
        window.dispatchEvent(new CustomEvent("canisterReady"));
        return;
      }
      if (retries >= MAX_RETRIES) {
        clearInterval(retryInterval);
        console.error(
          `[sync] CANISTER_ID_BACKEND could not be resolved after ${MAX_RETRIES} attempts. Sync is disabled.\nFIX FOR VERCEL: Set VITE_CANISTER_ID_BACKEND in Vercel project Environment Variables.\nFIX FOR CAFFEINE: Ensure the backend canister is deployed and the platform has injected CANISTER_ID_BACKEND.\nTried: __RESOLVED_CANISTER_ID_BACKEND, VITE_CANISTER_ID_BACKEND (env), CANISTER_ID_BACKEND (env), window.CANISTER_ID_BACKEND, window.__CANISTER_ID_BACKEND, __ENV__.CANISTER_ID_BACKEND, <meta name="canister-id-backend">, <script> tag scan, globalThis.__CANISTER_ID_BACKEND`,
        );
      }
    }, 5_000);

    return () => clearInterval(retryInterval);
  }, []);

  // invalidateAll: called by useMigration after every successful poll cycle
  // so React Query re-fetches from the updated localStorage cache.
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patient"] });
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    queryClient.invalidateQueries({ queryKey: ["observations"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["clinicalNotes"] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["beds"] });
    queryClient.invalidateQueries({ queryKey: ["prescriptionRecords"] });
    queryClient.invalidateQueries({ queryKey: ["admissionHistory"] });
  }, [queryClient]);

  // ── Migration toast ──────────────────────────────────────────────────────────
  // Pass canisterActorState (not canisterActorRef.current) so useMigration
  // re-runs its effects when the actor becomes available after mount.
  const { migrationStatus } = useMigration(canisterActorState, invalidateAll);
  const migrationToastShownRef = useRef(false);
  useEffect(() => {
    if (migrationStatus === "running" && !migrationToastShownRef.current) {
      migrationToastShownRef.current = true;
      import("sonner").then(({ toast }) =>
        toast.loading(
          "Syncing your existing records to secure cloud storage...",
          {
            id: "migration-toast",
            duration: 30000,
          },
        ),
      );
    }
    if (migrationStatus === "complete") {
      import("sonner").then(({ toast }) =>
        toast.success("✅ All records synced. Your data is now backed up.", {
          id: "migration-toast",
        }),
      );
    }
    if (migrationStatus === "failed") {
      import("sonner").then(({ toast }) =>
        toast.warning(
          "⚠️ Sync partial. Your data is safe locally. Retry in Settings.",
          { id: "migration-toast" },
        ),
      );
    }
  }, [migrationStatus]);

  // ── Patient Portal Drug Reminder State ──────────────────────────────────────
  const REMINDERS_KEY = "medicare_drug_reminders";

  const [showNavReminderPanel, setShowNavReminderPanel] = useState(false);
  const [navReminders, setNavReminders] = useState<DrugReminder[]>([]);
  const [navReminderDrug, setNavReminderDrug] = useState("");
  const [navReminderTime, setNavReminderTime] = useState("08:00");
  const [navReminderTimes, setNavReminderTimes] = useState<string[]>([]);
  const navFiredTodayRef = useRef<Set<string>>(new Set());

  // ── Staff (Nurse/Intern) medication alert checker ─────────────────────────────
  const staffFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentDoctor) return;
    const role = currentDoctor.role;
    if (role !== "nurse" && role !== "intern_doctor") return;

    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const today = now.toISOString().split("T")[0];

      // Collect all admitted patient IDs
      const admittedIds = new Set<string>();
      const patientNames: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("patients_")) continue;
        try {
          const arr = JSON.parse(localStorage.getItem(k) || "[]") as Array<{
            id: unknown;
            fullName?: string;
            isAdmitted?: boolean;
            patientType?: string;
            status?: string;
          }>;
          for (const p of arr) {
            if (
              p.isAdmitted ||
              p.patientType === "admitted" ||
              p.status === "Admitted"
            ) {
              const rawId = p.id;
              const pid =
                typeof rawId === "string" && rawId.startsWith("__bigint__")
                  ? rawId.slice(10)
                  : String(rawId);
              admittedIds.add(pid);
              patientNames[pid] = p.fullName || pid;
            }
          }
        } catch {}
      }

      // Check reminders for admitted patients
      const checkReminders = (
        reminders: Array<{
          id: string;
          patientId: string;
          drugName: string;
          times?: string[];
          reminderTimes?: string[];
          enabled?: boolean;
          status?: string;
          dose?: string;
        }>,
      ) => {
        for (const r of reminders) {
          const isEnabled =
            r.enabled !== false &&
            r.status !== "paused" &&
            r.status !== "completed";
          if (!isEnabled || !admittedIds.has(r.patientId)) continue;
          const times = r.times?.length ? r.times : (r.reminderTimes ?? []);
          for (const t of times) {
            if (t !== hhmm) continue;
            const fireKey = `staff-${r.patientId}-${r.drugName}-${t}-${today}`;
            if (staffFiredRef.current.has(fireKey)) continue;
            staffFiredRef.current.add(fireKey);

            const patientName = patientNames[r.patientId] || "Patient";
            const drugLabel = r.drugName + (r.dose ? ` ${r.dose}` : "");

            import("sonner").then(({ toast }) => {
              const toastId = `staff-med-${fireKey}`;
              toast(`💊 Med Due: ${drugLabel} — ${patientName}`, {
                id: toastId,
                duration: 60000,
                action: {
                  label: "Taking",
                  onClick: () => {
                    import("./components/NurseDueMeds").then(
                      ({ saveMedAdminRecord }) => {
                        saveMedAdminRecord({
                          id: `${r.patientId}-${r.drugName}-${t}-${today}`,
                          drugName: r.drugName,
                          dose: r.dose,
                          patientId: r.patientId,
                          patientName,
                          scheduledTime: t,
                          actualTime: new Date().toLocaleTimeString(),
                          status: "given",
                          recordedBy: currentDoctor.name,
                          recordedByRole: currentDoctor.role,
                          date: today,
                        });
                      },
                    );
                    toast.dismiss(toastId);
                  },
                },
                cancel: {
                  label: "Remind 10 min",
                  onClick: () => {
                    setTimeout(
                      () => {
                        import("sonner").then(({ toast: t2 }) => {
                          t2(`⏰ Reminder: ${drugLabel} — ${patientName}`, {
                            duration: 30000,
                          });
                        });
                      },
                      10 * 60 * 1000,
                    );
                    toast.dismiss(toastId);
                  },
                },
              });
            });

            if (Notification.permission === "granted") {
              new Notification("💊 Medication Due", {
                body: `${drugLabel} for ${patientName}`,
              });
            }
          }
        }
      };

      // Check both reminder storage formats
      try {
        const legacy = JSON.parse(
          localStorage.getItem("medicare_drug_reminders") || "[]",
        );
        checkReminders(legacy);
      } catch {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("drugReminders_")) continue;
        try {
          const arr = JSON.parse(localStorage.getItem(k) || "[]");
          checkReminders(arr);
        } catch {}
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDoctor]);

  const loadNavReminders = useCallback(() => {
    if (!currentPatient) return;
    try {
      const allReminders: DrugReminder[] = JSON.parse(
        localStorage.getItem(REMINDERS_KEY) || "[]",
      );
      let patId = "";
      if (currentPatient.registerNumber) {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith("patients_"),
        );
        outer: for (const key of keys) {
          try {
            const arr = JSON.parse(localStorage.getItem(key) || "[]") as Array<
              Record<string, unknown>
            >;
            for (const p of arr) {
              if (p.registerNumber === currentPatient.registerNumber) {
                const rawId = p.id;
                patId =
                  typeof rawId === "string" && rawId.startsWith("__bigint__")
                    ? rawId.slice(10)
                    : String(rawId);
                break outer;
              }
            }
          } catch {}
        }
      }
      setNavReminders(
        patId ? allReminders.filter((r) => r.patientId === patId) : [],
      );
    } catch {}
  }, [currentPatient]);

  useEffect(() => {
    if (currentPatient && !currentDoctor) {
      loadNavReminders();
    }
  }, [currentPatient, currentDoctor, loadNavReminders]);

  // Background reminder checker
  useEffect(() => {
    if (!currentPatient || currentDoctor) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const today = now.toDateString();
      for (const r of navReminders) {
        if (!r.enabled) continue;
        for (const t of r.times) {
          const fireKey = `${r.id}-${t}-${today}`;
          if (t === hhmm && !navFiredTodayRef.current.has(fireKey)) {
            navFiredTodayRef.current.add(fireKey);
            import("sonner").then(({ toast }) =>
              toast(`💊 সময়মতো ওষুধ খান — ${r.drugName}`, { duration: 8000 }),
            );
            if (Notification.permission === "granted") {
              new Notification("💊 Time to take your medicine", {
                body: r.drugName,
              });
            }
          }
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [navReminders, currentPatient, currentDoctor]);

  const saveNavReminders = (updated: DrugReminder[], patientId: string) => {
    setNavReminders(updated);
    try {
      const all: DrugReminder[] = JSON.parse(
        localStorage.getItem(REMINDERS_KEY) || "[]",
      );
      const others = all.filter((r) => r.patientId !== patientId);
      localStorage.setItem(
        REMINDERS_KEY,
        JSON.stringify([...others, ...updated]),
      );
    } catch {}
  };

  // Count combined pending
  useEffect(() => {
    const count = () => {
      const staffPending = loadRegistry().filter(
        (d) => d.status === "pending",
      ).length;
      const patientPending = loadPatientRegistry().filter(
        (p) => p.status === "pending",
      ).length;
      setPendingCount(staffPending + patientPending);
    };
    count();
    const iv = setInterval(count, 5000);
    return () => clearInterval(iv);
  }, []);

  const getPortalPatientId = useMemo(() => {
    if (!currentPatient?.registerNumber) return "";
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith("patients_"),
      );
      for (const key of keys) {
        const arr = JSON.parse(localStorage.getItem(key) || "[]") as Array<
          Record<string, unknown>
        >;
        for (const p of arr) {
          if (p.registerNumber === currentPatient.registerNumber) {
            const rawId = p.id;
            return typeof rawId === "string" && rawId.startsWith("__bigint__")
              ? rawId.slice(10)
              : String(rawId);
          }
        }
      }
    } catch {}
    return "";
  }, [currentPatient]);

  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Auto-restore banner visibility if connection drops again after dismissal
  useEffect(() => {
    if (!backendDisconnected) setBannerDismissed(false);
  }, [backendDisconnected]);

  // Show Vercel-specific guidance after 10 retries (50s) if canister ID is still not resolved
  const [showVercelHint, setShowVercelHint] = useState(false);
  useEffect(() => {
    if (!backendDisconnected) {
      setShowVercelHint(false);
      return;
    }
    // After 50s of retrying with no actor, show the Vercel env var instruction
    const t = setTimeout(() => setShowVercelHint(true), 50_000);
    return () => clearTimeout(t);
  }, [backendDisconnected]);

  const isSerialDisplay =
    typeof window !== "undefined" &&
    window.location.pathname === "/serial-display";
  if (isSerialDisplay) return <SerialDisplay />;

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    const ok = adminLogin(adminUser, adminPass);
    if (ok) {
      setShowAdminModal(false);
      setAdminUser("");
      setAdminPass("");
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: "admin",
        userName: adminUser,
        action: "Logged in",
        target: "System",
      });
      import("sonner").then(({ toast }) => toast.success("Logged in as admin"));
    } else {
      setAdminError("Invalid admin credentials");
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Patient logged in — show their own profile
  if (currentPatient && !currentDoctor) {
    const activeReminderCount = navReminders.filter((r) => r.enabled).length;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Patient nav bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                <User className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {currentPatient.name}
                </p>
                <p className="text-xs text-teal-600">Patient Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Drug Reminder Bell */}
              <button
                type="button"
                onClick={() => {
                  loadNavReminders();
                  setShowNavReminderPanel(true);
                }}
                className="relative p-2 rounded-lg hover:bg-teal-50 text-gray-500 hover:text-teal-600 transition-colors"
                data-ocid="patient_nav.open_modal_button"
                title="Drug Reminders"
              >
                <Bell className="w-5 h-5" />
                {activeReminderCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                    {activeReminderCount}
                  </span>
                )}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={patientSignOut}
                className="gap-2 text-xs"
                data-ocid="patient.logout.button"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        <PatientPortalView currentPatient={currentPatient} />
        <Toaster position="top-right" richColors />

        {/* Drug Reminder Panel */}
        <Dialog
          open={showNavReminderPanel}
          onOpenChange={setShowNavReminderPanel}
        >
          <DialogContent className="max-w-md" data-ocid="patient_nav.dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600" />
                Drug Reminders
                {activeReminderCount > 0 && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {activeReminderCount} active
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {navReminders.length > 0 ? (
                <div className="space-y-2">
                  {navReminders.map((r, idx) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                      data-ocid={`patient_nav.item.${idx + 1}`}
                    >
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={() => {
                          const updated = navReminders.map((x) =>
                            x.id === r.id ? { ...x, enabled: !x.enabled } : x,
                          );
                          saveNavReminders(updated, getPortalPatientId);
                        }}
                        data-ocid="patient_nav.toggle"
                      />
                      <span
                        className={`font-medium text-sm flex-1 ${r.enabled ? "text-gray-800" : "text-gray-400 line-through"}`}
                      >
                        {r.drugName}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {r.times.map((t) => (
                          <span
                            key={t}
                            className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          saveNavReminders(
                            navReminders.filter((x) => x.id !== r.id),
                            getPortalPatientId,
                          )
                        }
                        className="text-red-400 hover:text-red-600"
                        data-ocid="patient_nav.delete_button"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="text-sm text-muted-foreground italic text-center py-4"
                  data-ocid="patient_nav.empty_state"
                >
                  No reminders yet.
                </p>
              )}
              <div className="border-t pt-3 space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Add New Reminder
                </Label>
                <Input
                  placeholder="Drug name (e.g. Tab. Napa 500mg)"
                  value={navReminderDrug}
                  onChange={(e) => setNavReminderDrug(e.target.value)}
                  className="text-sm"
                  data-ocid="patient_nav.input"
                />
                <div className="flex gap-2 items-center">
                  <input
                    type="time"
                    value={navReminderTime}
                    onChange={(e) => setNavReminderTime(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        navReminderTime &&
                        !navReminderTimes.includes(navReminderTime)
                      ) {
                        setNavReminderTimes([
                          ...navReminderTimes,
                          navReminderTime,
                        ]);
                      }
                    }}
                    data-ocid="patient_nav.secondary_button"
                  >
                    + Add Time
                  </Button>
                </div>
                {navReminderTimes.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {navReminderTimes.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() =>
                            setNavReminderTimes(
                              navReminderTimes.filter((x) => x !== t),
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    if (
                      !navReminderDrug.trim() ||
                      navReminderTimes.length === 0
                    ) {
                      import("sonner").then(({ toast }) =>
                        toast.error("Enter a drug name and at least one time"),
                      );
                      return;
                    }
                    const patId = getPortalPatientId;
                    if (Notification.permission === "default")
                      Notification.requestPermission();
                    const newR: DrugReminder = {
                      id: `${Date.now()}`,
                      patientId: patId,
                      drugName: navReminderDrug.trim(),
                      times: navReminderTimes,
                      enabled: true,
                      createdAt: new Date().toISOString(),
                    };
                    const updated = [...navReminders, newR];
                    saveNavReminders(updated, patId);
                    setNavReminderDrug("");
                    setNavReminderTimes([]);
                    setNavReminderTime("08:00");
                    import("sonner").then(({ toast }) =>
                      toast.success(`Reminder set for ${newR.drugName}`),
                    );
                  }}
                  data-ocid="patient_nav.save_button"
                >
                  Save Reminder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {showWarning && (
          <InactivityWarningOverlay
            secondsRemaining={secondsRemaining}
            onStayLoggedIn={resetTimer}
          />
        )}
      </div>
    );
  }

  const showBackendBanner = backendDisconnected && !bannerDismissed;

  if (!currentDoctor) {
    return (
      <>
        <LandingPage
          onLoginClick={() => setShowAuthModal(true)}
          onAdminLoginClick={() => setShowAdminModal(true)}
          isAdmin={isAdminState}
          adminLogout={adminLogoutFn}
        />

        {/* Staff/Patient Login Dialog */}
        <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Login</DialogTitle>
            </DialogHeader>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
                  <Stethoscope className="w-7 h-7 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground mb-1">
                  Dr. Arman Kabir&apos;s Care
                </h2>
                <p className="text-muted-foreground text-sm">
                  Patient Management System
                </p>
              </div>
              <Tabs value={authTab} onValueChange={setAuthTab}>
                <TabsList className="w-full mb-5">
                  <TabsTrigger
                    value="staff"
                    className="flex-1"
                    data-ocid="login.staff.tab"
                  >
                    Staff / Doctor
                  </TabsTrigger>
                  <TabsTrigger
                    value="patient"
                    className="flex-1"
                    data-ocid="login.patient.tab"
                  >
                    Patient
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="staff">
                  <StaffAuthContent />
                </TabsContent>
                <TabsContent value="patient">
                  <PatientAuthContent />
                </TabsContent>
              </Tabs>
            </motion.div>
          </DialogContent>
        </Dialog>

        {/* Admin Login Dialog */}
        <Dialog
          open={showAdminModal}
          onOpenChange={(v) => {
            setShowAdminModal(v);
            if (!v) setAdminError("");
          }}
        >
          <DialogContent className="max-w-sm" data-ocid="admin.login.dialog">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                </div>
                <DialogTitle className="text-amber-800">
                  Admin Login
                </DialogTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter admin credentials to manage public portal content.
              </p>
            </DialogHeader>
            <form onSubmit={handleAdminLogin} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-user">Username</Label>
                <Input
                  id="admin-user"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="admin email or username"
                  autoComplete="username"
                  data-ocid="admin.login.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">Password</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  data-ocid="admin.login.input"
                />
              </div>
              {adminError && (
                <p
                  className="text-sm text-destructive"
                  data-ocid="admin.login.error_state"
                >
                  {adminError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full h-11 font-semibold bg-amber-600 hover:bg-amber-700"
                data-ocid="admin.login.submit_button"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Login as Admin
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Pending approvals floating button */}
        {isAdminState && pendingCount > 0 && (
          <button
            type="button"
            onClick={() => setShowPendingPanel(true)}
            className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-full shadow-lg font-semibold text-sm transition-colors"
            data-ocid="admin.pending.button"
          >
            <UserCheck className="w-4 h-4" />
            {pendingCount} Pending Approval{pendingCount !== 1 ? "s" : ""}
          </button>
        )}

        {/* Pending Approvals Panel */}
        <Dialog open={showPendingPanel} onOpenChange={setShowPendingPanel}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                <DialogTitle>Pending Approvals</DialogTitle>
              </div>
            </DialogHeader>
            <PendingApprovalsPanel />
          </DialogContent>
        </Dialog>

        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <>
      {showBackendBanner && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] shadow-lg"
          data-ocid="sync.backend_disconnected_banner"
        >
          {/* Primary red banner */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm font-medium"
            style={{
              background: "linear-gradient(90deg, #b91c1c 0%, #ea580c 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              <span>
                Backend not connected — data will not sync between devices.
                Retrying...
              </span>
            </div>
            <button
              type="button"
              aria-label="Dismiss banner"
              onClick={() => setBannerDismissed(true)}
              className="ml-auto shrink-0 rounded p-0.5 hover:bg-white/20 transition-colors"
              data-ocid="sync.backend_banner.close_button"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {/* Vercel-specific hint shown after 50s of failed retries */}
          {showVercelHint && (
            <div
              className="flex items-start gap-3 px-4 py-2.5 text-amber-900 text-xs font-medium border-b border-amber-300"
              style={{ background: "#fef3c7" }}
              data-ocid="sync.vercel_hint_banner"
            >
              <span className="text-base shrink-0">⚠️</span>
              <span className="leading-snug">
                <strong>Vercel deployment detected:</strong> Cloud sync is
                unavailable because{" "}
                <code className="bg-amber-200 px-1 rounded font-mono">
                  VITE_CANISTER_ID_BACKEND
                </code>{" "}
                is not set. Go to your{" "}
                <strong>
                  Vercel project → Settings → Environment Variables
                </strong>
                , add{" "}
                <code className="bg-amber-200 px-1 rounded font-mono">
                  VITE_CANISTER_ID_BACKEND
                </code>{" "}
                with your canister ID value, then redeploy. Local data is safe
                until then.
              </span>
            </div>
          )}
        </div>
      )}
      <div style={showBackendBanner ? { paddingTop: "40px" } : undefined}>
        <RouterProvider router={router} />
      </div>
      <Toaster position="top-right" richColors />
      {showWarning && (
        <InactivityWarningOverlay
          secondsRemaining={secondsRemaining}
          onStayLoggedIn={resetTimer}
        />
      )}
    </>
  );
}

// Patient portal — looks up their patient record by register number
function PatientPortalView({
  currentPatient,
}: { currentPatient: PatientAccount }) {
  const patientId = useMemo(() => {
    if (currentPatient.registerNumber) {
      try {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith("patients_"),
        );
        for (const key of keys) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
          const found = arr.find(
            (p) => p.registerNumber === currentPatient.registerNumber,
          );
          if (found) {
            const rawId = found.id;
            try {
              const idStr =
                typeof rawId === "string" && rawId.startsWith("__bigint__")
                  ? rawId.slice(10)
                  : String(rawId);
              const cleaned = idStr.replace(/[^0-9]/g, "");
              if (cleaned) return BigInt(cleaned);
            } catch {}
          }
        }
      } catch {}
    }
    return null;
  }, [currentPatient.registerNumber]);

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-8 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <User className="w-12 h-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Welcome, {currentPatient.name}!
          </h2>
          {currentPatient.registerNumber ? (
            <div>
              <p className="text-gray-600 text-sm mb-2">
                Your register number is{" "}
                <strong className="font-mono text-teal-700">
                  {currentPatient.registerNumber}
                </strong>
                .
              </p>
              <p className="text-gray-500 text-sm">
                Your health records are being linked. Please contact the clinic
                to complete setup.
              </p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Your account is active. Please contact your doctor and provide
              your register number to link your health records.
            </p>
          )}
          {currentPatient.phone && (
            <p className="text-xs text-gray-400 mt-2">
              Phone: {currentPatient.phone}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <PatientDashboard
      patientId={patientId}
      currentRole="patient"
      currentPatient={currentPatient}
      onBack={() => {}}
    />
  );
}

export default function App() {
  return (
    <EmailAuthProvider>
      <AppInner />
    </EmailAuthProvider>
  );
}
