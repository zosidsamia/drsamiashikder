import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Bed,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  FlaskConical,
  Hospital,
  LayoutDashboard,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  Siren,
  Stethoscope,
  UserCircle,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import SyncConflictDialog from "./components/SyncConflictDialog";
import {
  type EmergencyNotification,
  acknowledgeEmergencyNotification,
  getUnacknowledgedEmergencyNotifications,
} from "./components/patientDashboardTypes";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useEmailAuth } from "./hooks/useEmailAuth";
import { useSyncStatus } from "./hooks/useMigration";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { getPermissionsForRole } from "./hooks/useRolePermissions";
import { getConflictsCount } from "./lib/hybridStorage";
import {
  STAFF_ROLE_ACTIVE_BG,
  STAFF_ROLE_BORDER_COLOR,
  STAFF_ROLE_COLORS,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_TEXT_COLOR,
} from "./types";
import type { StaffRole } from "./types";

// Roles
const MED_ALERT_ROLES: StaffRole[] = ["nurse", "intern_doctor"];
const EMERGENCY_RX_ROLES: StaffRole[] = [
  "consultant_doctor",
  "medical_officer",
  "doctor",
  "admin",
  "assistant_professor",
  "associate_professor",
  "professor",
  "registrar",
  "assistant_registrar",
];
const WARD_ROUND_ROLES: StaffRole[] = [
  "doctor",
  "consultant_doctor",
  "medical_officer",
  "intern_doctor",
  "nurse",
  "admin",
  "assistant_professor",
  "associate_professor",
  "professor",
  "registrar",
  "assistant_registrar",
];
const BED_ROLES: StaffRole[] = [
  "admin",
  "doctor",
  "consultant_doctor",
  "medical_officer",
  "staff",
  "registrar",
  "assistant_registrar",
];
const STAFF_MGMT_ROLES: StaffRole[] = ["admin", "consultant_doctor"];

interface LayoutProps {
  children: React.ReactNode;
  currentPageName: string;
}

// ── Storage helpers ────────────────────────────────────────────────────────────
function loadBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    return v === "true";
  } catch {
    return def;
  }
}
function saveBool(key: string, val: boolean) {
  try {
    localStorage.setItem(key, String(val));
  } catch {}
}

// ── Badge helpers ──────────────────────────────────────────────────────────────
function getPendingApprovalCount(): number {
  try {
    const registry = JSON.parse(
      localStorage.getItem("registry") ?? "[]",
    ) as Array<{ approvalStatus?: string; status?: string }>;
    const patientRegistry = JSON.parse(
      localStorage.getItem("patient_registry") ?? "[]",
    ) as Array<{ approvalStatus?: string; status?: string }>;
    const staffPending = registry.filter(
      (a) => a.approvalStatus === "pending" || a.status === "pending",
    ).length;
    const patientPending = patientRegistry.filter(
      (a) => a.approvalStatus === "pending" || a.status === "pending",
    ).length;
    return staffPending + patientPending;
  } catch {
    return 0;
  }
}

function getUnpaidInvoicesCount(): number {
  try {
    const keys = [
      "appointment_payments",
      "investigation_payments",
      "procedure_payments",
      "other_payments",
    ];
    let total = 0;
    for (const key of keys) {
      const items = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
        status?: string;
      }>;
      total += items.filter(
        (i) => i.status === "unpaid" || i.status === "pending",
      ).length;
    }
    return total;
  } catch {
    return 0;
  }
}

function getPendingHandoverCount(): number {
  try {
    const handovers = JSON.parse(
      localStorage.getItem("handovers") ?? "[]",
    ) as Array<{ acknowledged?: boolean; acknowledgmentStatus?: string }>;
    return handovers.filter(
      (h) => h.acknowledged === false || h.acknowledgmentStatus === "pending",
    ).length;
  } catch {
    return 0;
  }
}

function getAdmittedPatientCount(): number {
  try {
    // Try direct patients key first
    const direct = JSON.parse(
      localStorage.getItem("patients") ?? "[]",
    ) as Array<{ isAdmitted?: boolean; patientType?: string; status?: string }>;
    if (direct.length > 0) {
      return direct.filter(
        (p) =>
          p.isAdmitted === true ||
          p.patientType === "admitted" ||
          p.status === "Admitted",
      ).length;
    }
    // Fallback: scan patients_* keys
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("patients_")) continue;
      const arr = JSON.parse(localStorage.getItem(k) ?? "[]") as Array<{
        isAdmitted?: boolean;
        patientType?: string;
        status?: string;
      }>;
      count += arr.filter(
        (p) =>
          p.isAdmitted === true ||
          p.patientType === "admitted" ||
          p.status === "Admitted",
      ).length;
    }
    return count;
  } catch {
    return 0;
  }
}

// ── NavBadge component ─────────────────────────────────────────────────────────
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Layout({ children, currentPageName }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSyncPopover, setShowSyncPopover] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [dueMedCount, setDueMedCount] = useState(0);
  // Emergency Rx notifications for nurses
  const [emergencyNotifs, setEmergencyNotifs] = useState<
    EmergencyNotification[]
  >([]);
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);

  // Notification badge counts
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [unpaidInvoicesCount, setUnpaidInvoicesCount] = useState(0);
  const [pendingHandoverCount, setPendingHandoverCount] = useState(0);
  const [admittedPatientCount, setAdmittedPatientCount] = useState(0);

  // Hospital Management group — lazy init from localStorage
  const [hospitalGroupOpen, setHospitalGroupOpen] = useState(() =>
    loadBool("sidebar_hospital_group_open", true),
  );
  // Payment sub-group — lazy init from localStorage
  const [paymentGroupOpen, setPaymentGroupOpen] = useState(() =>
    loadBool("sidebar_payment_group_open", true),
  );

  // Mobile sidebar — icon-only by default, expand to full
  const [mobileSidebarExpanded, setMobileSidebarExpanded] = useState(() =>
    loadBool("mobile_sidebar_expanded", false),
  );

  const syncPopoverRef = useRef<HTMLDivElement>(null);
  const state = useRouterState();
  const pathname = state.location.pathname;
  const { currentDoctor } = useEmailAuth();
  const { isAdmin } = useAdminAuth();
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();

  const role = (currentDoctor?.role ?? "staff") as StaffRole;
  const rolePerms = getPermissionsForRole(role);
  const canWardRound = WARD_ROUND_ROLES.includes(role) || isAdmin;
  const canBedManagement = BED_ROLES.includes(role) || isAdmin;
  const canEmergencyRx = EMERGENCY_RX_ROLES.includes(role) || isAdmin;
  const canStaffMgmt = STAFF_MGMT_ROLES.includes(role) || isAdmin;
  const showMedAlertBell = MED_ALERT_ROLES.includes(role);
  const canRegistrarDashboard = rolePerms.canViewAllAdmittedPatients || isAdmin;

  const toggleHospitalGroup = () => {
    const next = !hospitalGroupOpen;
    setHospitalGroupOpen(next);
    saveBool("sidebar_hospital_group_open", next);
  };
  const togglePaymentGroup = () => {
    const next = !paymentGroupOpen;
    setPaymentGroupOpen(next);
    saveBool("sidebar_payment_group_open", next);
  };
  const toggleMobileSidebar = () => {
    const next = !mobileSidebarExpanded;
    setMobileSidebarExpanded(next);
    saveBool("mobile_sidebar_expanded", next);
  };

  // Refresh badge counts every 10s
  useEffect(() => {
    const refresh = () => {
      setPendingApprovalCount(getPendingApprovalCount());
      setUnpaidInvoicesCount(getUnpaidInvoicesCount());
      setPendingHandoverCount(getPendingHandoverCount());
      setAdmittedPatientCount(getAdmittedPatientCount());
    };
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also refresh on route change (pathname dep is intentional)
  useEffect(() => {
    const _p = pathname; // reference pathname to satisfy linter intent
    void _p;
    setPendingApprovalCount(getPendingApprovalCount());
    setUnpaidInvoicesCount(getUnpaidInvoicesCount());
    setPendingHandoverCount(getPendingHandoverCount());
    setAdmittedPatientCount(getAdmittedPatientCount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Poll conflict count every 5 seconds
  useEffect(() => {
    const refresh = () => setConflictCount(getConflictsCount());
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, []);

  // Poll emergency notifications for nurses every 15 seconds
  const isNurse = role === "nurse";
  useEffect(() => {
    if (!isNurse) return;
    const refresh = () => {
      const notifs = getUnacknowledgedEmergencyNotifications();
      setEmergencyNotifs(notifs);
      if (notifs.length > 0) setShowEmergencyAlert(true);
    };
    refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
  }, [isNurse]);

  // Count meds due in the next hour for nurse/intern
  useEffect(() => {
    if (!showMedAlertBell) return;
    const count = () => {
      try {
        const nowHour = new Date().getHours();
        const today = new Date().toISOString().split("T")[0];
        const allReminders: Array<{
          patientId: string;
          times: string[];
          enabled: boolean;
        }> = JSON.parse(
          localStorage.getItem("medicare_drug_reminders") || "[]",
        );
        const admittedIds = new Set<string>();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k?.startsWith("patients_")) continue;
          const arr = JSON.parse(localStorage.getItem(k) || "[]") as Array<{
            id: unknown;
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
            }
          }
        }
        let pending = 0;
        for (const r of allReminders) {
          if (!r.enabled || !admittedIds.has(r.patientId)) continue;
          for (const t of r.times) {
            const [hh] = t.split(":").map(Number);
            if (Math.abs(hh - nowHour) <= 1) {
              const records: Array<{
                scheduledTime?: string;
                status?: string;
              }> = (() => {
                try {
                  return JSON.parse(
                    localStorage.getItem(
                      `medAdminRecord_${r.patientId}_${today}`,
                    ) || "[]",
                  );
                } catch {
                  return [];
                }
              })();
              const alreadyDone = records.some(
                (rec) => rec.scheduledTime === t && rec.status === "given",
              );
              if (!alreadyDone) pending++;
            }
          }
        }
        setDueMedCount(pending);
      } catch {}
    };
    count();
    const iv = setInterval(count, 30000);
    return () => clearInterval(iv);
  }, [showMedAlertBell]);

  const displayName = currentDoctor
    ? `${currentDoctor.designation} ${currentDoctor.name}`.trim()
    : "Dr. Arman Kabir's Care";
  const displayDegree = currentDoctor?.degree || "Patient Management";
  const roleLabel = currentDoctor
    ? (STAFF_ROLE_LABELS[currentDoctor.role as StaffRole] ?? currentDoctor.role)
    : null;
  const roleColorClass = currentDoctor
    ? (STAFF_ROLE_COLORS[currentDoctor.role as StaffRole] ?? "")
    : "";

  // Role-aware active state helpers
  const roleBorderColor = STAFF_ROLE_BORDER_COLOR[role] ?? "#3b82f6";
  const roleActiveBg = STAFF_ROLE_ACTIVE_BG[role] ?? "bg-blue-50";
  const roleActiveText = STAFF_ROLE_TEXT_COLOR[role] ?? "text-blue-700";
  const activeNavClass = cn(
    "h-9 px-3 text-sm font-medium gap-2 border-b-2",
    roleActiveText,
  );
  const inactiveNavClass =
    "h-9 px-3 text-sm font-medium gap-2 text-muted-foreground hover:text-foreground";
  const isActive = (name: string) => {
    if (name === "Dashboard") {
      return (
        currentPageName === "Dashboard" ||
        pathname === "/" ||
        pathname === "/Dashboard"
      );
    }
    if (name === "Patients") {
      return (
        currentPageName === "Patients" ||
        currentPageName === "PatientProfile" ||
        currentPageName === "PatientDashboard" ||
        pathname === "/Patients"
      );
    }
    return currentPageName === name || pathname === `/${name}`;
  };

  // Is any Hospital Management child active?
  const isHospitalGroupActive =
    isActive("BedManagement") ||
    isActive("AppointmentPayment") ||
    isActive("InvestigationPayment") ||
    isActive("ProcedurePayment") ||
    isActive("TotalIncome") ||
    isActive("OtherPayment") ||
    isActive("OutstandingBalances") ||
    isActive("Staff");

  const lastSyncLabel = (() => {
    if (!syncStatus.lastSyncAt) return "Never synced";
    const diffMs = Date.now() - syncStatus.lastSyncAt.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin === 1) return "1 min ago";
    if (diffMin < 60) return `${diffMin} min ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  })();

  const lastSyncTime = (() => {
    if (!syncStatus.lastSyncAt) return "";
    return syncStatus.lastSyncAt.toLocaleTimeString("en-BD", {
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  const syncIndicator = (() => {
    if (!isOnline)
      return {
        color: "bg-amber-500",
        label: `Offline (${syncStatus.pendingChanges} pending)`,
        tooltip: `Offline — ${syncStatus.pendingChanges} item(s) pending sync.`,
        icon: <WifiOff className="w-3 h-3" />,
        badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
      };
    if (syncStatus.pendingChanges > 0)
      return {
        color: "bg-yellow-400 animate-pulse",
        label: `Syncing... (${syncStatus.pendingChanges} pending)`,
        tooltip: `${syncStatus.pendingChanges} item(s) pending sync — last synced at ${lastSyncTime || "unknown"}`,
        icon: <RefreshCw className="w-3 h-3 animate-spin" />,
        badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
      };
    return {
      color: "bg-green-500",
      label: "All synced",
      tooltip: `All data synced — last synced at ${lastSyncTime || lastSyncLabel}`,
      icon: <Wifi className="w-3 h-3" />,
      badgeClass: "bg-green-100 text-green-700 border-green-200",
    };
  })();

  // Close popover on outside click
  useEffect(() => {
    if (!showSyncPopover) return;
    const handler = (e: MouseEvent) => {
      if (
        syncPopoverRef.current &&
        !syncPopoverRef.current.contains(e.target as Node)
      ) {
        setShowSyncPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSyncPopover]);

  // Mobile bottom nav (4 most important)
  const mobileNavItems = [
    {
      name: "Dashboard",
      href: "/Dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
    },
    { name: "Patients", href: "/Patients", icon: Users, label: "Patient" },
    {
      name: "Appointments",
      href: "/Appointments",
      icon: CalendarDays,
      label: "Appointment",
    },
    ...(canEmergencyRx
      ? [
          {
            name: "EmergencyPrescription",
            href: "/EmergencyPrescription",
            icon: Siren,
            label: "Emergency Rx",
          },
        ]
      : [
          {
            name: "Settings",
            href: "/Settings",
            icon: UserCircle,
            label: "Settings",
          },
        ]),
  ].slice(0, 4);

  // Payment sub-items
  const paymentItems = [
    {
      name: "AppointmentPayment",
      href: "/AppointmentPayment",
      icon: CalendarDays,
      label: "Appointment Payment",
    },
    {
      name: "InvestigationPayment",
      href: "/InvestigationPayment",
      icon: FlaskConical,
      label: "Investigation Payment",
    },
    {
      name: "ProcedurePayment",
      href: "/ProcedurePayment",
      icon: ClipboardList,
      label: "Procedure Payment",
    },
    {
      name: "TotalIncome",
      href: "/TotalIncome",
      icon: BarChart3,
      label: "Total Income",
    },
    {
      name: "OutstandingBalances",
      href: "/OutstandingBalances",
      icon: BarChart3,
      label: "Outstanding Balances",
    },
    {
      name: "OtherPayment",
      href: "/OtherPayment",
      icon: PlusCircle,
      label: "Other Payment",
    },
  ];

  // Ward round disabled when no admitted patients
  const wardRoundDisabled = admittedPatientCount === 0;

  // Close mobile sidebar when navigating
  const closeMobileSidebar = () => {
    if (mobileSidebarExpanded) {
      setMobileSidebarExpanded(false);
      saveBool("mobile_sidebar_expanded", false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Emergency Rx Notification Banner for Nurses */}
      {isNurse && showEmergencyAlert && emergencyNotifs.length > 0 && (
        <div
          className="bg-red-600 text-white sticky top-0 z-[70] border-b-2 border-red-700"
          data-ocid="layout.emergency_notification.toast"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Siren className="w-4 h-4 animate-pulse shrink-0" />
              <span className="font-semibold text-sm">
                🚨 New Emergency Prescription
                {emergencyNotifs.length > 1
                  ? `s (${emergencyNotifs.length})`
                  : ""}{" "}
                — {emergencyNotifs[0].patientName} at{" "}
                {new Date(emergencyNotifs[0].time).toLocaleTimeString("en-BD", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/EmergencyPrescription"
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-medium border border-white/40 transition-colors"
                data-ocid="layout.emergency_notification.view_link"
              >
                View Prescription
              </a>
              <button
                type="button"
                onClick={() => {
                  const doctorEmail = currentDoctor?.email ?? "unknown";
                  for (const n of emergencyNotifs) {
                    acknowledgeEmergencyNotification(n.id, doctorEmail);
                  }
                  setEmergencyNotifs([]);
                  setShowEmergencyAlert(false);
                }}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-medium border border-white/40 transition-colors"
                data-ocid="layout.emergency_notification.acknowledge_button"
              >
                Acknowledge
              </button>
              <button
                type="button"
                onClick={() => setShowEmergencyAlert(false)}
                className="text-white/70 hover:text-white"
                data-ocid="layout.emergency_notification.close_button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2 sticky top-0 z-[60]">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            You are offline. All data is saved locally and will sync when
            reconnected.
          </span>
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-subtle">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/Patients"
              className="flex items-center gap-3 group"
              data-ocid="nav.patients_link"
            >
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm group-hover:bg-primary/90 transition-smooth">
                <Stethoscope className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <p className="font-display font-bold text-foreground text-base leading-none">
                  {displayName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground leading-none">
                    {displayDegree}
                  </p>
                  {roleLabel && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none",
                        roleColorClass,
                      )}
                    >
                      {roleLabel}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {/* Dashboard */}
              <Link to="/Dashboard" data-ocid="nav.dashboard_link">
                <Button
                  variant="ghost"
                  style={
                    isActive("Dashboard")
                      ? { borderBottomColor: roleBorderColor }
                      : {}
                  }
                  className={cn(
                    isActive("Dashboard") ? activeNavClass : inactiveNavClass,
                  )}
                >
                  <LayoutDashboard
                    className={cn(
                      "w-4 h-4",
                      isActive("Dashboard")
                        ? roleActiveText
                        : "text-indigo-500",
                    )}
                  />
                  Dashboard
                </Button>
              </Link>

              {/* Patient */}
              <Link to="/Patients" data-ocid="nav.patients_link">
                <Button
                  variant="ghost"
                  style={
                    isActive("Patients")
                      ? { borderBottomColor: roleBorderColor }
                      : {}
                  }
                  className={cn(
                    isActive("Patients") ? activeNavClass : inactiveNavClass,
                  )}
                >
                  <Users
                    className={cn(
                      "w-4 h-4",
                      isActive("Patients") ? roleActiveText : "text-blue-500",
                    )}
                  />
                  Patient
                  {pendingApprovalCount > 0 && (
                    <span className="min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
                    </span>
                  )}
                </Button>
              </Link>

              {/* Appointment */}
              <Link to="/Appointments" data-ocid="nav.appointments_link">
                <Button
                  variant="ghost"
                  style={
                    isActive("Appointments")
                      ? { borderBottomColor: roleBorderColor }
                      : {}
                  }
                  className={cn(
                    isActive("Appointments")
                      ? activeNavClass
                      : inactiveNavClass,
                  )}
                >
                  <CalendarDays
                    className={cn(
                      "w-4 h-4",
                      isActive("Appointments")
                        ? roleActiveText
                        : "text-cyan-500",
                    )}
                  />
                  Appointment
                </Button>
              </Link>

              {/* Hospital Management dropdown */}
              {canBedManagement && (
                <DesktopHospitalDropdown
                  isHospitalGroupActive={isHospitalGroupActive}
                  hospitalGroupOpen={hospitalGroupOpen}
                  toggleHospitalGroup={toggleHospitalGroup}
                  paymentGroupOpen={paymentGroupOpen}
                  togglePaymentGroup={togglePaymentGroup}
                  paymentItems={paymentItems}
                  canStaffMgmt={canStaffMgmt}
                  isActive={isActive}
                  unpaidInvoicesCount={unpaidInvoicesCount}
                />
              )}

              {/* Emergency Rx */}
              {canEmergencyRx && (
                <Link
                  to="/EmergencyPrescription"
                  data-ocid="nav.emergencyprescription_link"
                >
                  <Button
                    variant="ghost"
                    style={
                      isActive("EmergencyPrescription")
                        ? { borderBottomColor: roleBorderColor }
                        : {}
                    }
                    className={cn(
                      isActive("EmergencyPrescription")
                        ? activeNavClass
                        : inactiveNavClass,
                    )}
                  >
                    <Siren
                      className={cn(
                        "w-4 h-4",
                        isActive("EmergencyPrescription")
                          ? roleActiveText
                          : "text-red-500",
                      )}
                    />
                    Emergency Rx
                  </Button>
                </Link>
              )}

              {/* Ward Round */}
              {canWardRound &&
                (wardRoundDisabled ? (
                  <Button
                    variant="ghost"
                    disabled
                    title="No admitted patients currently"
                    className="h-9 px-3 text-sm font-medium gap-2 opacity-50 cursor-not-allowed"
                  >
                    <Stethoscope className="w-4 h-4" />
                    Ward Round
                    {pendingHandoverCount > 0 && (
                      <span className="min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                        {pendingHandoverCount > 99
                          ? "99+"
                          : pendingHandoverCount}
                      </span>
                    )}
                  </Button>
                ) : (
                  <Link to="/WardRound" data-ocid="nav.wardround_link">
                    <Button
                      variant="ghost"
                      style={
                        isActive("WardRound")
                          ? { borderBottomColor: roleBorderColor }
                          : {}
                      }
                      className={cn(
                        isActive("WardRound")
                          ? activeNavClass
                          : inactiveNavClass,
                      )}
                    >
                      <Stethoscope
                        className={cn(
                          "w-4 h-4",
                          isActive("WardRound")
                            ? roleActiveText
                            : "text-green-600",
                        )}
                      />
                      Ward Round
                      {pendingHandoverCount > 0 && (
                        <span className="min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                          {pendingHandoverCount > 99
                            ? "99+"
                            : pendingHandoverCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                ))}

              {/* All Admitted Patients — Registrar/Admin only */}
              {canRegistrarDashboard && (
                <Link
                  to="/RegistrarDashboard"
                  data-ocid="nav.registrar_dashboard_link"
                >
                  <Button
                    variant="ghost"
                    style={
                      isActive("RegistrarDashboard")
                        ? { borderBottomColor: roleBorderColor }
                        : {}
                    }
                    className={cn(
                      isActive("RegistrarDashboard")
                        ? activeNavClass
                        : inactiveNavClass,
                    )}
                  >
                    <Users
                      className={cn(
                        "w-4 h-4",
                        isActive("RegistrarDashboard")
                          ? roleActiveText
                          : "text-green-700",
                      )}
                    />
                    All Patients
                  </Button>
                </Link>
              )}

              {/* Settings */}
              <Link to="/Settings" data-ocid="nav.settings_link">
                <Button
                  variant="ghost"
                  style={
                    isActive("Settings")
                      ? { borderBottomColor: roleBorderColor }
                      : {}
                  }
                  className={cn(
                    isActive("Settings") ? activeNavClass : inactiveNavClass,
                  )}
                >
                  <UserCircle
                    className={cn(
                      "w-4 h-4",
                      isActive("Settings") ? roleActiveText : "text-slate-400",
                    )}
                  />
                  Settings
                </Button>
              </Link>

              {/* Audit Log (admin only) */}
              {isAdmin && (
                <Link to="/AuditLog" data-ocid="nav.auditlog_link">
                  <Button
                    variant="ghost"
                    style={
                      isActive("AuditLog")
                        ? { borderBottomColor: roleBorderColor }
                        : {}
                    }
                    className={cn(
                      isActive("AuditLog") ? activeNavClass : inactiveNavClass,
                    )}
                  >
                    <ShieldAlert
                      className={cn(
                        "w-4 h-4",
                        isActive("AuditLog")
                          ? roleActiveText
                          : "text-slate-400",
                      )}
                    />
                    Audit Log
                  </Button>
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-2">
              {/* Medication alert bell */}
              {showMedAlertBell && (
                <a
                  href="/Patients"
                  className="relative p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
                  title="Medications due now"
                  data-ocid="nav.med_alert_bell"
                >
                  <Pill className="w-5 h-5" />
                  {dueMedCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white text-[10px] font-bold px-1 flex items-center justify-center p-0">
                      {dueMedCount}
                    </Badge>
                  )}
                </a>
              )}

              {/* Sync conflict badge */}
              {conflictCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowConflictDialog(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border bg-red-100 text-red-700 border-red-200 hover:bg-red-200 transition-colors animate-pulse"
                  title={`${conflictCount} sync conflict${conflictCount > 1 ? "s" : ""}`}
                  data-ocid="nav.sync_conflict_badge"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    ⚠️ {conflictCount} sync conflict
                    {conflictCount > 1 ? "s" : ""}
                  </span>
                  <span className="sm:hidden">{conflictCount}</span>
                </button>
              )}

              {/* Sync status indicator */}
              <div className="relative" ref={syncPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowSyncPopover((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border transition-colors",
                    syncIndicator.badgeClass,
                  )}
                  title={syncIndicator.tooltip}
                  data-ocid="nav.sync_status"
                >
                  {syncIndicator.icon}
                  <span className="hidden sm:inline">
                    {syncIndicator.label}
                  </span>
                </button>
                {showSyncPopover && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-lg p-3 z-50 text-sm">
                    <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      {isOnline ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-amber-500" />
                      )}
                      {isOnline ? "Online" : "Offline Mode"}
                    </p>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Last synced:{" "}
                        <span className="font-medium text-foreground">
                          {lastSyncTime ? `at ${lastSyncTime}` : lastSyncLabel}
                        </span>
                      </div>
                      {syncStatus.pendingChanges > 0 ? (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {syncStatus.pendingChanges} item(s) pending sync
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          All data synced
                        </div>
                      )}
                      {conflictCount > 0 && (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-red-600 font-medium hover:underline w-full text-left"
                          onClick={() => {
                            setShowSyncPopover(false);
                            setShowConflictDialog(true);
                          }}
                          data-ocid="nav.sync_conflict_link"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {conflictCount} conflict{conflictCount > 1 ? "s" : ""}{" "}
                          need resolution
                        </button>
                      )}
                      {!isOnline && (
                        <p className="text-amber-600 font-medium">
                          All changes are saved locally and will sync
                          automatically when you&apos;re back online.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile hamburger (for overlay menu) */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden w-9 h-9"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile overlay menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card">
            <nav className="p-3 space-y-1 max-h-[80vh] overflow-y-auto">
              <MobileNavLink
                name="Dashboard"
                href="/Dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                isActive={isActive}
                onClose={() => setMobileMenuOpen(false)}
              />
              <MobileNavLink
                name="Patients"
                href="/Patients"
                icon={Users}
                label="Patient"
                isActive={isActive}
                onClose={() => setMobileMenuOpen(false)}
                badge={pendingApprovalCount}
              />
              <MobileNavLink
                name="Appointments"
                href="/Appointments"
                icon={CalendarDays}
                label="Appointment"
                isActive={isActive}
                onClose={() => setMobileMenuOpen(false)}
              />

              {/* Hospital Management group */}
              {canBedManagement && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={toggleHospitalGroup}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors border-l-4",
                      isHospitalGroupActive
                        ? cn(roleActiveBg, roleActiveText, "border-current")
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
                    )}
                    style={
                      isHospitalGroupActive
                        ? { borderLeftColor: roleBorderColor }
                        : {}
                    }
                    data-ocid="nav.hospital_management.toggle"
                  >
                    <Hospital
                      className={cn(
                        "w-4 h-4",
                        isHospitalGroupActive
                          ? roleActiveText
                          : "text-orange-500",
                      )}
                    />
                    <span className="flex-1 text-left">
                      Hospital Management
                    </span>
                    {unpaidInvoicesCount > 0 && (
                      <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unpaidInvoicesCount > 99 ? "99+" : unpaidInvoicesCount}
                      </span>
                    )}
                    {hospitalGroupOpen ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  {hospitalGroupOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
                      <MobileNavLink
                        name="BedManagement"
                        href="/BedManagement"
                        icon={Bed}
                        label="Bed Management"
                        isActive={isActive}
                        onClose={() => setMobileMenuOpen(false)}
                        indent
                      />

                      {/* Payment sub-group */}
                      <button
                        type="button"
                        onClick={togglePaymentGroup}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        data-ocid="nav.payment_group.toggle"
                      >
                        <DollarSign className="w-4 h-4 text-emerald-600/70" />
                        <span className="flex-1 text-left">Payment</span>
                        {paymentGroupOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {paymentGroupOpen && (
                        <div className="ml-3 space-y-1 border-l border-border pl-3">
                          {paymentItems.map((item) => (
                            <MobileNavLink
                              key={item.name}
                              name={item.name}
                              href={item.href}
                              icon={item.icon}
                              label={item.label}
                              isActive={isActive}
                              onClose={() => setMobileMenuOpen(false)}
                              indent
                            />
                          ))}
                        </div>
                      )}

                      {/* Staff inside Hospital Management */}
                      {canStaffMgmt && (
                        <MobileNavLink
                          name="Staff"
                          href="/Staff"
                          icon={Users}
                          label="Staff"
                          isActive={isActive}
                          onClose={() => setMobileMenuOpen(false)}
                          indent
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Emergency Rx */}
              {canEmergencyRx && (
                <MobileNavLink
                  name="EmergencyPrescription"
                  href="/EmergencyPrescription"
                  icon={Siren}
                  label="Emergency Rx"
                  isActive={isActive}
                  onClose={() => setMobileMenuOpen(false)}
                />
              )}

              {/* Ward Round */}
              {canWardRound && (
                <MobileNavLink
                  name="WardRound"
                  href="/WardRound"
                  icon={Stethoscope}
                  label="Ward Round"
                  isActive={isActive}
                  onClose={() => setMobileMenuOpen(false)}
                  disabled={wardRoundDisabled}
                  disabledTitle="No admitted patients currently"
                  badge={pendingHandoverCount}
                />
              )}

              {/* All Admitted Patients — Registrar only */}
              {canRegistrarDashboard && (
                <MobileNavLink
                  name="RegistrarDashboard"
                  href="/RegistrarDashboard"
                  icon={Users}
                  label="All Patients"
                  isActive={isActive}
                  onClose={() => setMobileMenuOpen(false)}
                />
              )}

              <MobileNavLink
                name="Settings"
                href="/Settings"
                icon={UserCircle}
                label="Settings"
                isActive={isActive}
                onClose={() => setMobileMenuOpen(false)}
              />
              {isAdmin && (
                <MobileNavLink
                  name="AuditLog"
                  href="/AuditLog"
                  icon={ShieldAlert}
                  label="Audit Log"
                  isActive={isActive}
                  onClose={() => setMobileMenuOpen(false)}
                />
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── Mobile Left Sidebar (icon-only default, expandable) ─────────────────── */}
      {/* Only visible on mobile (<md), fixed left panel */}
      <div
        className={cn(
          "md:hidden fixed left-0 top-[64px] bottom-[56px] z-40 flex flex-col bg-card border-r border-border transition-all duration-200 overflow-hidden",
          mobileSidebarExpanded ? "w-56" : "w-14",
        )}
      >
        {/* Toggle button */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="h-11 flex items-center justify-center border-b border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          title={mobileSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          data-ocid="nav.mobile_sidebar_toggle"
        >
          {mobileSidebarExpanded ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeftOpen className="w-5 h-5" />
          )}
        </button>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
          {/* Dashboard */}
          <SidebarIconItem
            name="Dashboard"
            href="/Dashboard"
            icon={LayoutDashboard}
            label="Dashboard"
            isActive={isActive}
            expanded={mobileSidebarExpanded}
            onNavigate={closeMobileSidebar}
          />

          {/* Patient */}
          <SidebarIconItem
            name="Patients"
            href="/Patients"
            icon={Users}
            label="Patient"
            isActive={isActive}
            expanded={mobileSidebarExpanded}
            onNavigate={closeMobileSidebar}
            badge={pendingApprovalCount}
          />

          {/* Appointments */}
          <SidebarIconItem
            name="Appointments"
            href="/Appointments"
            icon={CalendarDays}
            label="Appointment"
            isActive={isActive}
            expanded={mobileSidebarExpanded}
            onNavigate={closeMobileSidebar}
          />

          {/* Hospital Management group */}
          {canBedManagement && (
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!mobileSidebarExpanded) {
                    setMobileSidebarExpanded(true);
                    saveBool("mobile_sidebar_expanded", true);
                  }
                  toggleHospitalGroup();
                }}
                title="Hospital Management"
                data-ocid="nav.hospital_management.toggle"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors border-l-4",
                  isHospitalGroupActive
                    ? cn(roleActiveBg, roleActiveText, "border-current")
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
                )}
                style={
                  isHospitalGroupActive
                    ? { borderLeftColor: roleBorderColor }
                    : {}
                }
              >
                <Hospital
                  className={cn(
                    "w-5 h-5 shrink-0",
                    isHospitalGroupActive ? roleActiveText : "text-orange-500",
                  )}
                />
                {mobileSidebarExpanded && (
                  <>
                    <span className="flex-1 text-left truncate">
                      Hospital Mgmt
                    </span>
                    {unpaidInvoicesCount > 0 && (
                      <NavBadge count={unpaidInvoicesCount} />
                    )}
                    {hospitalGroupOpen ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </>
                )}
                {!mobileSidebarExpanded && unpaidInvoicesCount > 0 && (
                  <span className="absolute left-7 top-1 min-w-[14px] h-[14px] bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center px-0.5">
                    {unpaidInvoicesCount > 9 ? "9+" : unpaidInvoicesCount}
                  </span>
                )}
              </button>

              {mobileSidebarExpanded && hospitalGroupOpen && (
                <div className="ml-3 border-l border-border pl-2 space-y-0.5 mt-0.5">
                  <SidebarIconItem
                    name="BedManagement"
                    href="/BedManagement"
                    icon={Bed}
                    label="Bed Management"
                    isActive={isActive}
                    expanded={true}
                    onNavigate={closeMobileSidebar}
                    indent
                  />

                  {/* Payment sub-group */}
                  <button
                    type="button"
                    onClick={togglePaymentGroup}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    data-ocid="nav.payment_group.toggle"
                  >
                    <DollarSign className="w-4 h-4 text-emerald-600/70 shrink-0" />
                    <span className="flex-1 text-left">Payment</span>
                    {paymentGroupOpen ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {paymentGroupOpen && (
                    <div className="ml-3 border-l border-border pl-2 space-y-0.5">
                      {paymentItems.map((item) => (
                        <SidebarIconItem
                          key={item.name}
                          name={item.name}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          isActive={isActive}
                          expanded={true}
                          onNavigate={closeMobileSidebar}
                          indent
                        />
                      ))}
                    </div>
                  )}

                  {/* Staff inside Hospital Management */}
                  {canStaffMgmt && (
                    <SidebarIconItem
                      name="Staff"
                      href="/Staff"
                      icon={Users}
                      label="Staff"
                      isActive={isActive}
                      expanded={true}
                      onNavigate={closeMobileSidebar}
                      indent
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Emergency Rx */}
          {canEmergencyRx && (
            <SidebarIconItem
              name="EmergencyPrescription"
              href="/EmergencyPrescription"
              icon={Siren}
              label="Emergency Rx"
              isActive={isActive}
              expanded={mobileSidebarExpanded}
              onNavigate={closeMobileSidebar}
            />
          )}

          {/* Ward Round */}
          {canWardRound && (
            <SidebarIconItem
              name="WardRound"
              href="/WardRound"
              icon={Stethoscope}
              label="Ward Round"
              isActive={isActive}
              expanded={mobileSidebarExpanded}
              onNavigate={closeMobileSidebar}
              disabled={wardRoundDisabled}
              disabledTitle="No admitted patients currently"
              badge={pendingHandoverCount}
            />
          )}

          {/* All Admitted Patients — Registrar only */}
          {canRegistrarDashboard && (
            <SidebarIconItem
              name="RegistrarDashboard"
              href="/RegistrarDashboard"
              icon={Users}
              label="All Patients"
              isActive={isActive}
              expanded={mobileSidebarExpanded}
              onNavigate={closeMobileSidebar}
            />
          )}

          {/* Settings */}
          <SidebarIconItem
            name="Settings"
            href="/Settings"
            icon={UserCircle}
            label="Settings"
            isActive={isActive}
            expanded={mobileSidebarExpanded}
            onNavigate={closeMobileSidebar}
          />

          {/* Audit Log */}
          {isAdmin && (
            <SidebarIconItem
              name="AuditLog"
              href="/AuditLog"
              icon={ShieldAlert}
              label="Audit Log"
              isActive={isActive}
              expanded={mobileSidebarExpanded}
              onNavigate={closeMobileSidebar}
            />
          )}
        </nav>
      </div>

      {/* Main content — offset on mobile for sidebar */}
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-200",
          // On mobile: offset left by sidebar width, but don't do this on md+
          "md:ml-0",
          mobileSidebarExpanded ? "ml-56 md:ml-0" : "ml-14 md:ml-0",
        )}
      >
        <main className="flex-1 pb-16 md:pb-0">{children}</main>

        <footer className="hidden md:block border-t border-border bg-card">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()}. Built with ❤ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                caffeine.ai
              </a>
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-14">
          {mobileNavItems.map((item) => {
            return (
              <Link
                key={item.name}
                to={item.href as "/Patients"}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-smooth",
                  isActive(item.name)
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
                data-ocid={`nav.${item.name.toLowerCase()}_link`}
              >
                <item.icon className="w-5 h-5" />
                <span className="truncate max-w-[60px] text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Sync Conflict Dialog */}
      <SyncConflictDialog
        open={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        onAllResolved={() => setConflictCount(0)}
      />
    </div>
  );
}

// ── DesktopHospitalDropdown ───────────────────────────────────────────────────
function DesktopHospitalDropdown({
  isHospitalGroupActive,
  hospitalGroupOpen,
  toggleHospitalGroup,
  paymentGroupOpen,
  togglePaymentGroup,
  paymentItems,
  canStaffMgmt,
  isActive,
  unpaidInvoicesCount,
}: {
  isHospitalGroupActive: boolean;
  hospitalGroupOpen: boolean;
  toggleHospitalGroup: () => void;
  paymentGroupOpen: boolean;
  togglePaymentGroup: () => void;
  paymentItems: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }>;
  canStaffMgmt: boolean;
  isActive: (name: string) => boolean;
  unpaidInvoicesCount: number;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      className="relative"
      ref={dropdownRef}
      data-ocid="nav.hospital_management.desktop"
    >
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-9 px-3 text-sm font-medium gap-2",
          isHospitalGroupActive || open
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted-foreground hover:text-foreground",
        )}
        data-ocid="nav.hospital_management.toggle"
      >
        <Hospital className="w-4 h-4" />
        Hospital Mgmt
        {unpaidInvoicesCount > 0 && (
          <span className="min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unpaidInvoicesCount > 99 ? "99+" : unpaidInvoicesCount}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          {/* Bed Management */}
          <Link
            to="/BedManagement"
            onClick={() => setOpen(false)}
            data-ocid="nav.bedmanagement_link"
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors border-l-4",
              isActive("BedManagement")
                ? "bg-primary/10 text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Bed className="w-4 h-4 shrink-0" />
            Bed Management
          </Link>

          {/* Payment sub-group toggle */}
          <button
            type="button"
            onClick={togglePaymentGroup}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-l-4 border-transparent"
            data-ocid="nav.payment_group.toggle"
          >
            <DollarSign className="w-4 h-4 shrink-0 text-emerald-600/70" />
            <span className="flex-1 text-left">Payment</span>
            {paymentGroupOpen ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            )}
          </button>

          {/* Payment sub-items */}
          {paymentGroupOpen && (
            <div className="ml-4 border-l border-border pl-2 space-y-0">
              {paymentItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.href as "/Patients"}
                  onClick={() => setOpen(false)}
                  data-ocid={`nav.${item.name.toLowerCase()}_link`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm transition-colors border-l-4",
                    isActive(item.name)
                      ? "bg-primary/10 text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Hospital Management group separator */}
          <div className="my-1 border-t border-border" />

          {/* Staff */}
          {canStaffMgmt && (
            <Link
              to="/Staff"
              onClick={() => setOpen(false)}
              data-ocid="nav.staff_link"
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors border-l-4",
                isActive("Staff")
                  ? "bg-primary/10 text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
              )}
            >
              <Users className="w-4 h-4 shrink-0" />
              Staff
            </Link>
          )}

          {/* Hospital Management collapse toggle */}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={toggleHospitalGroup}
              className="w-full flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              data-ocid="nav.hospital_management.collapse_toggle"
            >
              {hospitalGroupOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {hospitalGroupOpen ? "Collapse group" : "Expand group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MobileNavLink ─────────────────────────────────────────────────────────────
function MobileNavLink({
  name,
  href,
  icon: Icon,
  label,
  isActive,
  onClose,
  indent = false,
  disabled = false,
  disabledTitle,
  badge = 0,
  roleBorderColor: rbc,
  roleActiveBg: rab,
  roleActiveText: rat,
}: {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  isActive: (name: string) => boolean;
  onClose: () => void;
  indent?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  badge?: number;
  roleBorderColor?: string;
  roleActiveBg?: string;
  roleActiveText?: string;
}) {
  const displayLabel = label || name;
  const active = isActive(name);
  if (disabled) {
    return (
      <div title={disabledTitle}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start h-10 gap-3 text-sm opacity-50 cursor-not-allowed border-l-4 border-transparent",
            indent && "pl-2",
          )}
          disabled
        >
          <Icon className="w-4 h-4 shrink-0" />
          {displayLabel}
        </Button>
      </div>
    );
  }
  return (
    <Link
      to={href as "/Patients"}
      onClick={onClose}
      data-ocid={`nav.${name.toLowerCase()}_link`}
    >
      <Button
        variant="ghost"
        style={active && rbc ? { borderLeftColor: rbc } : {}}
        className={cn(
          "w-full justify-start h-10 gap-3 text-sm transition-colors rounded-lg border-l-4",
          indent && "pl-2",
          active
            ? cn(
                "border-current",
                rab ?? "bg-primary/10",
                rat ?? "text-primary",
              )
            : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
        )}
      >
        <Icon
          className={cn("w-4 h-4 shrink-0", active && (rat ?? "text-primary"))}
        />
        <span className="flex-1 text-left">{displayLabel}</span>
        {badge > 0 && <NavBadge count={badge} />}
      </Button>
    </Link>
  );
}

// ── SidebarIconItem (mobile left sidebar) ─────────────────────────────────────
function SidebarIconItem({
  name,
  href,
  icon: Icon,
  label,
  isActive,
  expanded,
  onNavigate,
  indent = false,
  disabled = false,
  disabledTitle,
  badge = 0,
  roleBorderColor: rbc,
  roleActiveBg: rab,
  roleActiveText: rat,
}: {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  isActive: (name: string) => boolean;
  expanded: boolean;
  onNavigate: () => void;
  indent?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  badge?: number;
  roleBorderColor?: string;
  roleActiveBg?: string;
  roleActiveText?: string;
}) {
  const displayLabel = label || name;
  const active = isActive(name);

  if (disabled) {
    return (
      <div
        title={disabledTitle}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 text-sm opacity-50 cursor-not-allowed select-none border-l-4 border-transparent",
          indent && "px-2",
        )}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {expanded && <span className="truncate">{displayLabel}</span>}
      </div>
    );
  }

  return (
    <Link
      to={href as "/Patients"}
      onClick={onNavigate}
      data-ocid={`nav.${name.toLowerCase()}_link`}
      title={!expanded ? displayLabel : undefined}
      style={active && rbc ? { borderLeftColor: rbc } : {}}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-l-4",
        indent && "px-2",
        active
          ? cn(rab ?? "bg-primary/10", rat ?? "text-primary", "border-current")
          : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40",
      )}
    >
      <Icon
        className={cn("w-5 h-5 shrink-0", active && (rat ?? "text-primary"))}
      />
      {expanded && (
        <>
          <span className="flex-1 truncate">{displayLabel}</span>
          {badge > 0 && <NavBadge count={badge} />}
        </>
      )}
      {!expanded && badge > 0 && (
        <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center px-0.5 leading-none">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
