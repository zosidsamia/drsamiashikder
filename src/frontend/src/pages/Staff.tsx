/**
 * Staff — Staff management page for admin and consultant doctor roles.
 * Tabs: Registration/Approval | Schedule | Attendance | Directory
 * Admin can approve/reject pending accounts, reassign roles, manage shifts,
 * view attendance, and see the full staff contact directory.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Mail,
  Moon,
  Phone,
  Plus,
  Search,
  Sun,
  Sunset,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { useAdminAuth } from "../hooks/useAdminAuth";
import {
  appendAuditLog,
  loadRegistry,
  saveRegistry,
  useEmailAuth,
} from "../hooks/useEmailAuth";
import type { DoctorAccount } from "../hooks/useEmailAuth";
import { STAFF_ROLE_COLORS, STAFF_ROLE_LABELS } from "../types";
import type { StaffRole } from "../types";

// ── Storage Keys ──────────────────────────────────────────────────────────────
const SHIFTS_KEY = "staff_shifts";
const ATTENDANCE_KEY = "staff_attendance";
const LEAVE_REQUESTS_KEY = "leave_requests";

// ── Local Types ───────────────────────────────────────────────────────────────
type StatusFilter = "all" | "approved" | "pending" | "rejected";
type MainTab =
  | "registration"
  | "schedule"
  | "attendance"
  | "directory"
  | "performance"
  | "leave";

type LeaveType = "Annual Leave" | "Sick Leave" | "Emergency Leave" | "Training";
type LeaveStatus = "pending" | "approved" | "rejected";

interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  reason: string;
  status: LeaveStatus;
  adminNote: string;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

type ShiftType = "morning" | "evening" | "night";

interface StaffShift {
  id: string;
  staffId: string;
  staffName: string;
  shiftType: ShiftType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  ward: string;
  createdBy: string;
}

interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  loginTime: string; // HH:MM
  logoutTime?: string; // HH:MM
  shiftStatus: "present" | "late" | "absent";
  manualOverride?: boolean;
  overrideNote?: string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function loadShifts(): StaffShift[] {
  try {
    const raw = localStorage.getItem(SHIFTS_KEY);
    return raw ? (JSON.parse(raw) as StaffShift[]) : [];
  } catch {
    return [];
  }
}

function saveShifts(shifts: StaffShift[]) {
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));
}

function loadAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    return raw ? (JSON.parse(raw) as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAttendance(records: AttendanceRecord[]) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

function loadLeaveRequests(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem(LEAVE_REQUESTS_KEY);
    return raw ? (JSON.parse(raw) as LeaveRequest[]) : [];
  } catch {
    return [];
  }
}

function saveLeaveRequests(requests: LeaveRequest[]) {
  localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));
}

// ── Helper: log attendance on login ──────────────────────────────────────────
export function logStaffLogin(
  staffId: string,
  staffName: string,
  role: StaffRole,
) {
  if (role === "patient" || role === "admin") return;
  const records = loadAttendance();
  const today = new Date().toISOString().split("T")[0];
  const loginTime = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Don't duplicate a login entry for the same day
  const existing = records.find(
    (r) => r.staffId === staffId && r.date === today,
  );
  if (existing) return;

  // Determine if late based on shift schedule
  const shifts = loadShifts();
  const todayShift = shifts.find(
    (s) => s.staffId === staffId && today >= s.startDate && today <= s.endDate,
  );

  let shiftStatus: AttendanceRecord["shiftStatus"] = "present";
  if (todayShift) {
    const shiftStart =
      todayShift.shiftType === "morning"
        ? "06:00"
        : todayShift.shiftType === "evening"
          ? "14:00"
          : "22:00";
    const [sh, sm] = shiftStart.split(":").map(Number);
    const [lh, lm] = loginTime.split(":").map(Number);
    const shiftStartMin = sh * 60 + sm;
    const loginMin = lh * 60 + lm;
    if (loginMin > shiftStartMin + 15) shiftStatus = "late";
  }

  const newRecord: AttendanceRecord = {
    id: Date.now().toString(36),
    staffId,
    staffName,
    date: today,
    loginTime,
    shiftStatus,
  };
  records.push(newRecord);
  saveAttendance(records);
}

// ── Shift icons ───────────────────────────────────────────────────────────────
const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: "Morning (6AM–2PM)",
  evening: "Evening (2PM–10PM)",
  night: "Night (10PM–6AM)",
};

const SHIFT_COLORS: Record<ShiftType, string> = {
  morning: "bg-amber-100 text-amber-800 border-amber-200",
  evening: "bg-orange-100 text-orange-800 border-orange-200",
  night: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

function ShiftIcon({ type }: { type: ShiftType }) {
  if (type === "morning") return <Sun className="w-3.5 h-3.5" />;
  if (type === "evening") return <Sunset className="w-3.5 h-3.5" />;
  return <Moon className="w-3.5 h-3.5" />;
}

// ── Initials avatar ───────────────────────────────────────────────────────────
const AVATAR_BG: Record<string, string> = {
  consultant_doctor: "bg-purple-100 text-purple-700",
  medical_officer: "bg-blue-100 text-blue-700",
  intern_doctor: "bg-sky-100 text-sky-700",
  nurse: "bg-pink-100 text-pink-700",
  staff: "bg-amber-100 text-amber-700",
  doctor: "bg-emerald-100 text-emerald-700",
};

function StaffAvatar({
  acc,
  size = "md",
}: {
  acc: DoctorAccount & { photo?: string };
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-lg"
        : "w-10 h-10 text-sm";
  const initials = acc.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bgColor = AVATAR_BG[acc.role] ?? "bg-muted text-muted-foreground";

  if (acc.photo) {
    return (
      <img
        src={acc.photo}
        alt={acc.name}
        className={`${dim} rounded-full object-cover shrink-0 border border-border`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center shrink-0 font-bold ${bgColor}`}
    >
      {initials}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Staff() {
  const { currentDoctor } = useEmailAuth();
  const { isAdmin } = useAdminAuth();

  const [staff, setStaff] = useState<(DoctorAccount & { photo?: string })[]>(
    [],
  );
  const [mainTab, setMainTab] = useState<MainTab>("registration");

  // Registration tab state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [approvalRoles, setApprovalRoles] = useState<Record<string, StaffRole>>(
    {},
  );
  const [reassignRoles, setReassignRoles] = useState<Record<string, StaffRole>>(
    {},
  );
  const [_editingPhoto, setEditingPhoto] = useState<string | null>(null);

  // Shift schedule state
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    staffId: "",
    shiftType: "morning" as ShiftType,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    ward: "",
  });
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Attendance state
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceStaff, setAttendanceStaff] = useState<string>("all");
  const [attendanceOverride, setAttendanceOverride] = useState<
    Record<string, string>
  >({});
  const [attendanceNote, setAttendanceNote] = useState<Record<string, string>>(
    {},
  );

  // Directory state
  const [dirSearch, setDirSearch] = useState("");
  const [dirRole, setDirRole] = useState<StaffRole | "all">("all");
  const [dirShift, setDirShift] = useState<ShiftType | "all">("all");

  const canManage =
    isAdmin ||
    currentDoctor?.role === "admin" ||
    currentDoctor?.role === "consultant_doctor";

  // Leave requests state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    leaveType: "Annual Leave" as LeaveType,
    reason: "",
  });

  // Performance state
  const [perfMonth, setPerfMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );

  const refresh = useCallback(() => {
    const reg = loadRegistry() as (DoctorAccount & { photo?: string })[];
    setStaff(reg);
    setShifts(loadShifts());
    setAttendance(loadAttendance());
    setLeaveRequests(loadLeaveRequests());
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  // ── Registration actions ────────────────────────────────────────────────────
  const approveStaff = (acc: DoctorAccount) => {
    const role = approvalRoles[acc.id] ?? acc.role ?? "doctor";
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === acc.id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "approved", role };
      saveRegistry(reg);
      refresh();
      toast.success(
        `${acc.name} approved as ${STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS] ?? role}`,
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
      toast.success("Account rejected");
    }
  };

  const reassignRole = (id: string) => {
    const role = reassignRoles[id];
    if (!role) return;
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === id);
    if (idx >= 0) {
      const oldRole = reg[idx].role;
      reg[idx] = { ...reg[idx], role };
      saveRegistry(reg);
      refresh();
      // Audit trail for role change
      appendAuditLog({
        timestamp: new Date().toISOString(),
        userRole: currentDoctor?.role ?? "admin",
        userName: currentDoctor?.name ?? "Admin",
        action: `STAFF_ROLE_CHANGED: ${reg[idx].name} — ${oldRole} → ${role}`,
        target: `staff:${id}`,
      });
      toast.success(
        `Role updated to ${STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS] ?? role}`,
      );
    }
  };

  const handlePhotoUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const reg = loadRegistry() as (DoctorAccount & { photo?: string })[];
      const idx = reg.findIndex((d) => d.id === id);
      if (idx >= 0) {
        (reg[idx] as DoctorAccount & { photo?: string }).photo = base64;
        saveRegistry(reg as DoctorAccount[]);
        refresh();
        toast.success("Profile photo updated");
        setEditingPhoto(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Shift schedule actions ──────────────────────────────────────────────────
  const saveShift = () => {
    if (
      !shiftForm.staffId ||
      !shiftForm.ward ||
      !shiftForm.startDate ||
      !shiftForm.endDate
    ) {
      toast.error("Please fill in all shift fields.");
      return;
    }
    const staffMember = staff.find((s) => s.id === shiftForm.staffId);
    const list = loadShifts();
    if (editingShiftId) {
      const idx = list.findIndex((s) => s.id === editingShiftId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...shiftForm,
          staffName: staffMember?.name ?? shiftForm.staffId,
        };
      }
    } else {
      list.push({
        id: Date.now().toString(36),
        ...shiftForm,
        staffName: staffMember?.name ?? shiftForm.staffId,
        createdBy: currentDoctor?.name ?? "Admin",
      });
    }
    saveShifts(list);
    refresh();
    setShowAddShift(false);
    setEditingShiftId(null);
    setShiftForm({
      staffId: "",
      shiftType: "morning",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      ward: "",
    });
    toast.success(editingShiftId ? "Shift updated" : "Shift assigned");
  };

  const deleteShift = (id: string) => {
    const list = loadShifts().filter((s) => s.id !== id);
    saveShifts(list);
    refresh();
    toast.success("Shift removed");
  };

  const startEditShift = (shift: StaffShift) => {
    setShiftForm({
      staffId: shift.staffId,
      shiftType: shift.shiftType,
      startDate: shift.startDate,
      endDate: shift.endDate,
      ward: shift.ward,
    });
    setEditingShiftId(shift.id);
    setShowAddShift(true);
  };

  const weekDays = useMemo(() => {
    const days: string[] = [];
    const todayDate = new Date();
    const monday = new Date(todayDate);
    monday.setDate(
      todayDate.getDate() - todayDate.getDay() + 1 + weekOffset * 7,
    );
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  }, [weekOffset]);

  const getShiftForDay = (staffId: string, date: string) =>
    shifts.find(
      (s) => s.staffId === staffId && date >= s.startDate && date <= s.endDate,
    );

  // ── Attendance actions ──────────────────────────────────────────────────────
  const overrideAttendance = (id: string) => {
    const status = attendanceOverride[id] as AttendanceRecord["shiftStatus"];
    if (!status) return;
    const list = loadAttendance();
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        shiftStatus: status,
        manualOverride: true,
        overrideNote: attendanceNote[id] ?? "",
      };
      saveAttendance(list);
      refresh();
      toast.success("Attendance updated");
    }
  };

  const filteredAttendance = useMemo(() => {
    if (attendanceStaff === "all") return attendance;
    return attendance.filter((r) => r.staffId === attendanceStaff);
  }, [attendance, attendanceStaff]);

  const attendanceSummary = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRecords = attendance.filter((r) => r.date.startsWith(thisMonth));
    const byStaff: Record<
      string,
      { present: number; late: number; absent: number }
    > = {};
    for (const r of monthRecords) {
      if (!byStaff[r.staffId])
        byStaff[r.staffId] = { present: 0, late: 0, absent: 0 };
      if (r.shiftStatus === "present") byStaff[r.staffId].present++;
      else if (r.shiftStatus === "late") byStaff[r.staffId].late++;
      else byStaff[r.staffId].absent++;
    }
    return byStaff;
  }, [attendance]);

  // ── Directory helpers ───────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const getCurrentShift = (staffId: string): ShiftType | null => {
    const shift = shifts.find(
      (s) =>
        s.staffId === staffId && today >= s.startDate && today <= s.endDate,
    );
    return shift?.shiftType ?? null;
  };

  const approvedStaff = staff.filter((s) => s.status === "approved");
  const directoryStaff = approvedStaff.filter((s) => {
    const matchSearch =
      !dirSearch ||
      s.name.toLowerCase().includes(dirSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(dirSearch.toLowerCase()) ||
      (s.specialization || "")
        .toLowerCase()
        .includes(dirSearch.toLowerCase()) ||
      (s.phone || "").includes(dirSearch);
    const matchRole = dirRole === "all" || s.role === dirRole;
    const curShift = getCurrentShift(s.id);
    const matchShift = dirShift === "all" ? true : dirShift === curShift;
    return matchSearch && matchRole && matchShift;
  });

  // ── Leave request actions ───────────────────────────────────────────────────
  const submitLeaveRequest = () => {
    if (!currentDoctor) return;
    if (!leaveForm.startDate || !leaveForm.endDate) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const requests = loadLeaveRequests();
    requests.push({
      id: Date.now().toString(36),
      staffId: currentDoctor.id,
      staffName: currentDoctor.name,
      staffRole: currentDoctor.role,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      leaveType: leaveForm.leaveType,
      reason: leaveForm.reason,
      status: "pending",
      adminNote: "",
      requestedAt: new Date().toISOString(),
    });
    saveLeaveRequests(requests);
    refresh();
    setShowLeaveForm(false);
    setLeaveForm({
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      leaveType: "Annual Leave",
      reason: "",
    });
    toast.success("Leave request submitted");
  };

  const reviewLeave = (id: string, status: LeaveStatus, note: string) => {
    const requests = loadLeaveRequests();
    const idx = requests.findIndex((r) => r.id === id);
    if (idx >= 0) {
      requests[idx] = {
        ...requests[idx],
        status,
        adminNote: note,
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentDoctor?.name ?? "Admin",
      };
      saveLeaveRequests(requests);
      refresh();
      toast.success(`Leave request ${status}`);
    }
  };

  // ── Performance helpers ─────────────────────────────────────────────────────
  const perfData = useMemo(() => {
    const prescriptions: Array<{ createdBy?: string; createdAt?: string }> =
      (() => {
        try {
          const raw = localStorage.getItem("clinic_prescriptions");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();
    const procedures: Array<{
      doctorName?: string;
      createdAt?: string;
      date?: string;
    }> = (() => {
      try {
        const raw = localStorage.getItem("procedurePayments");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();
    const appts: Array<{
      assignedTo?: string;
      doctorName?: string;
      createdAt?: string;
      date?: string;
    }> = (() => {
      try {
        const raw = localStorage.getItem("appointments");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();

    return approvedStaff.map((s) => {
      const monthAttendance = attendance.filter(
        (r) =>
          r.staffId === s.id &&
          r.date.startsWith(perfMonth) &&
          r.shiftStatus === "present",
      );
      const totalShiftsMonth = attendance.filter(
        (r) => r.staffId === s.id && r.date.startsWith(perfMonth),
      );
      const rxCount = prescriptions.filter(
        (p) =>
          p.createdBy === s.email && (p.createdAt ?? "").startsWith(perfMonth),
      ).length;
      const procCount = procedures.filter(
        (p) =>
          p.doctorName === s.name &&
          (p.createdAt ?? p.date ?? "").startsWith(perfMonth),
      ).length;
      const patientsCount = appts.filter(
        (a) =>
          (a.assignedTo === s.email || a.doctorName === s.name) &&
          (a.createdAt ?? a.date ?? "").startsWith(perfMonth),
      ).length;
      const adherencePct =
        totalShiftsMonth.length > 0
          ? Math.round((monthAttendance.length / totalShiftsMonth.length) * 100)
          : 0;
      return {
        staff: s,
        shiftsCompleted: monthAttendance.length,
        totalShifts: totalShiftsMonth.length,
        adherencePct,
        rxCount,
        procCount,
        patientsCount,
      };
    });
  }, [approvedStaff, attendance, perfMonth]);

  const exportPerformance = () => {
    const lines = [
      "Name,Role,Patients Attended,Prescriptions Written,Procedures Logged,Shifts Completed,Shift Adherence %",
      ...perfData.map(
        (p) =>
          `"${p.staff.name}","${STAFF_ROLE_LABELS[p.staff.role as keyof typeof STAFF_ROLE_LABELS] ?? p.staff.role}",${p.patientsCount},${p.rxCount},${p.procCount},${p.shiftsCompleted},${p.adherencePct}%`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-performance-${perfMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Performance report exported");
  };

  const exportDirectory = () => {
    const lines = [
      "Name,Role,Phone,Email,Current Shift,Ward",
      ...directoryStaff.map((s) => {
        const shift = getCurrentShift(s.id);
        const ward = shift
          ? (shifts.find(
              (sh) =>
                sh.staffId === s.id &&
                today >= sh.startDate &&
                today <= sh.endDate,
            )?.ward ?? "")
          : "";
        return `"${s.name}","${STAFF_ROLE_LABELS[s.role as keyof typeof STAFF_ROLE_LABELS] ?? s.role}","${s.phone ?? ""}","${s.email}","${shift ? SHIFT_LABELS[shift] : "Off Duty"}","${ward}"`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-directory-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Directory exported as CSV");
  };

  // ── Filtered staff for registration tab ────────────────────────────────────
  const filtered = staff.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.specialization || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchStatus && matchRole;
  });

  const counts = {
    all: staff.length,
    approved: staff.filter((s) => s.status === "approved").length,
    pending: staff.filter((s) => s.status === "pending").length,
    rejected: staff.filter((s) => s.status === "rejected").length,
  };

  const statusBadgeClass: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div
      className="max-w-6xl mx-auto px-4 py-6 space-y-6"
      data-ocid="staff.page"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-foreground">
              Staff Management
            </h1>
            <p className="text-sm text-muted-foreground">
              {counts.all} total · {counts.approved} active · {counts.pending}{" "}
              pending
            </p>
          </div>
        </div>
        {counts.pending > 0 && (
          <Badge
            variant="outline"
            className="gap-1.5 bg-amber-50 border-amber-300 text-amber-700 px-3 py-1.5 text-sm animate-pulse"
            data-ocid="staff.pending_badge"
          >
            <Clock className="w-3.5 h-3.5" />
            {counts.pending} awaiting approval
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <div
        className="flex gap-1 flex-wrap border-b border-border pb-0"
        data-ocid="staff.main.tab"
      >
        {(
          [
            {
              key: "registration",
              label: "Registration & Approval",
              icon: UserCheck,
            },
            { key: "schedule", label: "Shift Schedule", icon: Calendar },
            { key: "attendance", label: "Attendance", icon: BookOpen },
            { key: "directory", label: "Directory", icon: Users },
            ...(canManage
              ? [
                  {
                    key: "performance" as MainTab,
                    label: "Performance",
                    icon: BarChart3,
                  },
                ]
              : []),
            ...(isAdmin || currentDoctor?.role === "admin"
              ? [
                  {
                    key: "leave" as MainTab,
                    label: "Leave Requests",
                    icon: Calendar,
                  },
                ]
              : []),
          ] as { key: MainTab; label: string; icon: React.ElementType }[]
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMainTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              mainTab === key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            data-ocid={`staff.tab.${key}`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === "registration" && counts.pending > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {counts.pending}
              </span>
            )}
            {key === "leave" &&
              leaveRequests.filter((r) => r.status === "pending").length >
                0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {leaveRequests.filter((r) => r.status === "pending").length}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* My Leave Request button for non-admin staff */}
      {!canManage && currentDoctor && currentDoctor.role !== "patient" && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Your leave requests</p>
          <Button
            size="sm"
            onClick={() => setShowLeaveForm(true)}
            className="gap-1.5"
            data-ocid="staff.leave.open_modal_button"
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </Button>
        </div>
      )}

      {/* Leave Request Form Modal for non-admin staff */}
      {showLeaveForm && !canManage && (
        <div
          className="bg-card border border-border rounded-xl p-4 space-y-4"
          data-ocid="staff.leave.dialog"
        >
          <h3 className="font-semibold text-foreground">
            Submit Leave Request
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Leave Type *</Label>
              <select
                value={leaveForm.leaveType}
                onChange={(e) =>
                  setLeaveForm((f) => ({
                    ...f,
                    leaveType: e.target.value as LeaveType,
                  }))
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-ocid="staff.leave.select"
              >
                {(
                  [
                    "Annual Leave",
                    "Sick Leave",
                    "Emergency Leave",
                    "Training",
                  ] as LeaveType[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Input
                placeholder="Brief reason..."
                value={leaveForm.reason}
                onChange={(e) =>
                  setLeaveForm((f) => ({ ...f, reason: e.target.value }))
                }
                data-ocid="staff.leave.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date *</Label>
              <Input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm((f) => ({ ...f, startDate: e.target.value }))
                }
                data-ocid="staff.leave.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date *</Label>
              <Input
                type="date"
                value={leaveForm.endDate}
                min={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm((f) => ({ ...f, endDate: e.target.value }))
                }
                data-ocid="staff.leave.input"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLeaveForm(false)}
              data-ocid="staff.leave.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitLeaveRequest}
              data-ocid="staff.leave.submit_button"
            >
              Submit Request
            </Button>
          </div>
        </div>
      )}

      {/* ── Tab: Registration & Approval ───────────────────────────────────── */}
      {mainTab === "registration" && (
        <div className="space-y-4">
          {/* Status filter buttons */}
          <div className="flex gap-2 flex-wrap" data-ocid="staff.status.tab">
            {(["all", "approved", "pending", "rejected"] as StatusFilter[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                  data-ocid={`staff.filter.${s}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className="ml-1.5 text-xs opacity-70">
                    ({counts[s]})
                  </span>
                </button>
              ),
            )}
          </div>

          {/* Search & role filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, specialization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-ocid="staff.search_input"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => setRoleFilter(v as StaffRole | "all")}
            >
              <SelectTrigger className="w-48" data-ocid="staff.role.select">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {(
                  Object.keys(STAFF_ROLE_LABELS) as Array<
                    keyof typeof STAFF_ROLE_LABELS
                  >
                ).map((r) => (
                  <SelectItem key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff list */}
          {filtered.length === 0 ? (
            <div
              className="bg-card border border-border rounded-2xl p-12 text-center"
              data-ocid="staff.empty_state"
            >
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground mb-1">
                No staff found
              </p>
              <p className="text-sm text-muted-foreground">
                {search || statusFilter !== "all" || roleFilter !== "all"
                  ? "Try adjusting your filters."
                  : "No staff accounts registered yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-ocid="staff.list">
              {filtered.map((acc, idx) => {
                const roleLabel =
                  STAFF_ROLE_LABELS[
                    acc.role as keyof typeof STAFF_ROLE_LABELS
                  ] ?? acc.role;
                const roleColor =
                  STAFF_ROLE_COLORS[
                    acc.role as keyof typeof STAFF_ROLE_COLORS
                  ] ?? "bg-muted text-muted-foreground border-border";
                const isPending = acc.status === "pending";
                const isApproved = acc.status === "approved";

                return (
                  <div
                    key={acc.id}
                    className={`bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
                      isPending
                        ? "border-amber-200"
                        : acc.status === "rejected"
                          ? "border-red-200 opacity-60"
                          : "border-border"
                    }`}
                    data-ocid={`staff.item.${idx + 1}`}
                  >
                    {/* Avatar + photo upload */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative group">
                        <StaffAvatar acc={acc} />
                        {canManage && (
                          <label
                            className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                            title="Upload photo"
                          >
                            <Edit2 className="w-3 h-3 text-white" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(acc.id, file);
                              }}
                              data-ocid="staff.upload_button"
                            />
                          </label>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground truncate">
                            {acc.designation ? `${acc.designation} ` : ""}
                            {acc.name}
                          </p>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleColor}`}
                          >
                            {roleLabel}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusBadgeClass[acc.status] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {acc.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {acc.email}
                        </p>
                        {(acc.degree || acc.specialization || acc.hospital) && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {[acc.degree, acc.specialization, acc.hospital]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {acc.createdAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Registered:{" "}
                            {new Date(acc.createdAt).toLocaleDateString(
                              "en-BD",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {isPending && (
                          <>
                            <Select
                              value={
                                approvalRoles[acc.id] ?? acc.role ?? "doctor"
                              }
                              onValueChange={(v) =>
                                setApprovalRoles((prev) => ({
                                  ...prev,
                                  [acc.id]: v as StaffRole,
                                }))
                              }
                            >
                              <SelectTrigger
                                className="h-8 text-xs w-36"
                                data-ocid="staff.approve.select"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  Object.keys(STAFF_ROLE_LABELS) as Array<
                                    keyof typeof STAFF_ROLE_LABELS
                                  >
                                ).map((r) => (
                                  <SelectItem
                                    key={r}
                                    value={r}
                                    className="text-xs"
                                  >
                                    {STAFF_ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                              onClick={() => approveStaff(acc)}
                              data-ocid="staff.approve.button"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-red-700 border-red-300 hover:bg-red-50 gap-1"
                              onClick={() => rejectStaff(acc.id)}
                              data-ocid="staff.reject.button"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </>
                        )}

                        {isApproved && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={reassignRoles[acc.id] ?? acc.role}
                              onValueChange={(v) =>
                                setReassignRoles((prev) => ({
                                  ...prev,
                                  [acc.id]: v as StaffRole,
                                }))
                              }
                            >
                              <SelectTrigger
                                className="h-8 text-xs w-36"
                                data-ocid="staff.reassign.select"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  Object.keys(STAFF_ROLE_LABELS) as Array<
                                    keyof typeof STAFF_ROLE_LABELS
                                  >
                                ).map((r) => (
                                  <SelectItem
                                    key={r}
                                    value={r}
                                    className="text-xs"
                                  >
                                    {STAFF_ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={() => reassignRole(acc.id)}
                              disabled={
                                !reassignRoles[acc.id] ||
                                reassignRoles[acc.id] === acc.role
                              }
                              data-ocid="staff.save_button"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Update Role
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                              onClick={() => rejectStaff(acc.id)}
                              data-ocid="staff.delete_button"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Revoke
                            </Button>
                          </div>
                        )}

                        {acc.status === "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                            onClick={() => approveStaff(acc)}
                            data-ocid="staff.approve.button"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Re-approve
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Shift Schedule ─────────────────────────────────────────────── */}
      {mainTab === "schedule" && (
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                data-ocid="staff.schedule.pagination_prev"
              >
                ← Prev
              </button>
              <span className="text-sm text-muted-foreground font-medium">
                {weekDays[0]} → {weekDays[6]}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                data-ocid="staff.schedule.pagination_next"
              >
                Next →
              </button>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="px-2 py-1 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  This Week
                </button>
              )}
            </div>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingShiftId(null);
                  setShiftForm({
                    staffId: "",
                    shiftType: "morning",
                    startDate: new Date().toISOString().split("T")[0],
                    endDate: new Date().toISOString().split("T")[0],
                    ward: "",
                  });
                  setShowAddShift(true);
                }}
                className="gap-1.5"
                data-ocid="staff.schedule.open_modal_button"
              >
                <Plus className="w-4 h-4" />
                Assign Shift
              </Button>
            )}
          </div>

          {/* Add/Edit shift form */}
          {showAddShift && canManage && (
            <div
              className="bg-card border border-border rounded-xl p-4 space-y-4"
              data-ocid="staff.shift.dialog"
            >
              <h3 className="font-semibold text-foreground">
                {editingShiftId ? "Edit Shift Assignment" : "Assign New Shift"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Staff Member *</Label>
                  <Select
                    value={shiftForm.staffId}
                    onValueChange={(v) =>
                      setShiftForm((f) => ({ ...f, staffId: v }))
                    }
                  >
                    <SelectTrigger data-ocid="staff.shift.select">
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} —{" "}
                          {STAFF_ROLE_LABELS[
                            s.role as keyof typeof STAFF_ROLE_LABELS
                          ] ?? s.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Shift Type *</Label>
                  <Select
                    value={shiftForm.shiftType}
                    onValueChange={(v) =>
                      setShiftForm((f) => ({ ...f, shiftType: v as ShiftType }))
                    }
                  >
                    <SelectTrigger data-ocid="staff.shift.select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SHIFT_LABELS) as ShiftType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {SHIFT_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ward / Unit *</Label>
                  <Input
                    placeholder="e.g. Medical Ward, ICU"
                    value={shiftForm.ward}
                    onChange={(e) =>
                      setShiftForm((f) => ({ ...f, ward: e.target.value }))
                    }
                    data-ocid="staff.shift.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date *</Label>
                  <Input
                    type="date"
                    value={shiftForm.startDate}
                    onChange={(e) =>
                      setShiftForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    data-ocid="staff.shift.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date *</Label>
                  <Input
                    type="date"
                    value={shiftForm.endDate}
                    min={shiftForm.startDate}
                    onChange={(e) =>
                      setShiftForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    data-ocid="staff.shift.input"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddShift(false);
                    setEditingShiftId(null);
                  }}
                  data-ocid="staff.shift.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveShift}
                  data-ocid="staff.shift.save_button"
                >
                  {editingShiftId ? "Update Shift" : "Assign Shift"}
                </Button>
              </div>
            </div>
          )}

          {/* Weekly Calendar Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Header row */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="text-xs text-muted-foreground font-medium px-2 py-1">
                  Staff
                </div>
                {weekDays.map((date, i) => {
                  const isToday = date === today;
                  return (
                    <div
                      key={date}
                      className={`text-xs font-medium text-center px-1 py-1.5 rounded-lg ${
                        isToday
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-[10px]">{date.slice(5)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Staff rows */}
              {approvedStaff.length === 0 ? (
                <div
                  className="text-center py-8 text-muted-foreground text-sm"
                  data-ocid="staff.schedule.empty_state"
                >
                  No approved staff to show in schedule.
                </div>
              ) : (
                approvedStaff.map((s) => (
                  <div key={s.id} className="grid grid-cols-8 gap-1 mb-1">
                    <div className="flex items-center gap-2 px-2 py-2 bg-card border border-border rounded-lg">
                      <StaffAvatar acc={s} size="sm" />
                      <span className="text-xs font-medium text-foreground truncate">
                        {s.name}
                      </span>
                    </div>
                    {weekDays.map((date) => {
                      const shift = getShiftForDay(s.id, date);
                      return (
                        <div
                          key={date}
                          className={`text-[10px] text-center px-1 py-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 min-h-[48px] ${
                            shift
                              ? SHIFT_COLORS[shift.shiftType]
                              : "bg-background border-border text-muted-foreground/40"
                          }`}
                        >
                          {shift ? (
                            <>
                              <ShiftIcon type={shift.shiftType} />
                              <span className="font-medium capitalize">
                                {shift.shiftType}
                              </span>
                              <span className="text-[9px] truncate max-w-full px-1">
                                {shift.ward}
                              </span>
                            </>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Shift list */}
          {shifts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                All Shift Assignments
              </h3>
              <div className="space-y-2">
                {shifts.map((shift, i) => (
                  <div
                    key={shift.id}
                    className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap"
                    data-ocid={`staff.shift.item.${i + 1}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${SHIFT_COLORS[shift.shiftType]}`}
                    >
                      <ShiftIcon type={shift.shiftType} />
                      {SHIFT_LABELS[shift.shiftType]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {shift.staffName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shift.ward} · {shift.startDate} → {shift.endDate}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => startEditShift(shift)}
                          data-ocid="staff.shift.edit_button"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => deleteShift(shift.id)}
                          data-ocid="staff.shift.delete_button"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Attendance ─────────────────────────────────────────────────── */}
      {mainTab === "attendance" && (
        <div className="space-y-5">
          {/* Filter */}
          <div className="flex gap-3 flex-wrap items-center">
            <Select value={attendanceStaff} onValueChange={setAttendanceStaff}>
              <SelectTrigger
                className="w-56"
                data-ocid="staff.attendance.select"
              >
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {approvedStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredAttendance.length} record(s)
            </span>
          </div>

          {/* Monthly summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {approvedStaff
              .filter(
                (s) => attendanceStaff === "all" || s.id === attendanceStaff,
              )
              .map((s) => {
                const summary = attendanceSummary[s.id] ?? {
                  present: 0,
                  late: 0,
                  absent: 0,
                };
                const total = summary.present + summary.late + summary.absent;
                const pct =
                  total > 0
                    ? Math.round(
                        ((summary.present + summary.late) / total) * 100,
                      )
                    : 0;
                return (
                  <div
                    key={s.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
                  >
                    <StaffAvatar acc={s} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This month: {summary.present + summary.late}/{total}{" "}
                        shifts
                      </p>
                      <div className="flex gap-2 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                          Present: {summary.present}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          Late: {summary.late}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                          Absent: {summary.absent}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-lg font-bold ${pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-red-600"}`}
                      >
                        {pct}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        attendance
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Attendance table */}
          {filteredAttendance.length === 0 ? (
            <div
              className="bg-card border border-border rounded-xl p-10 text-center"
              data-ocid="staff.attendance.empty_state"
            >
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No attendance records yet. Records are auto-logged when staff
                log in.
              </p>
            </div>
          ) : (
            <div
              className="bg-card border border-border rounded-xl overflow-hidden"
              data-ocid="staff.attendance.table"
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Staff
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Login
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Logout
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    {canManage && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Override
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...filteredAttendance].reverse().map((rec, i) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`staff.attendance.row.${i + 1}`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {rec.staffName}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {rec.date}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-foreground">
                        {rec.loginTime}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {rec.logoutTime ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              rec.shiftStatus === "present"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : rec.shiftStatus === "late"
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                            }`}
                          >
                            {rec.shiftStatus.charAt(0).toUpperCase() +
                              rec.shiftStatus.slice(1)}
                          </span>
                          {rec.manualOverride && (
                            <span className="text-[10px] text-muted-foreground">
                              (manual)
                            </span>
                          )}
                        </div>
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={
                                attendanceOverride[rec.id] ?? rec.shiftStatus
                              }
                              onValueChange={(v) =>
                                setAttendanceOverride((prev) => ({
                                  ...prev,
                                  [rec.id]: v,
                                }))
                              }
                            >
                              <SelectTrigger
                                className="h-7 text-xs w-28"
                                data-ocid="staff.attendance.select"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="late">Late</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Note"
                              value={attendanceNote[rec.id] ?? ""}
                              onChange={(e) =>
                                setAttendanceNote((prev) => ({
                                  ...prev,
                                  [rec.id]: e.target.value,
                                }))
                              }
                              className="h-7 text-xs w-24"
                              data-ocid="staff.attendance.input"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => overrideAttendance(rec.id)}
                              data-ocid="staff.attendance.save_button"
                            >
                              Save
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Performance ────────────────────────────────────────────────── */}
      {mainTab === "performance" && canManage && (
        <div className="space-y-5" data-ocid="staff.performance.section">
          {/* Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Month:</Label>
              <Input
                type="month"
                value={perfMonth}
                onChange={(e) => setPerfMonth(e.target.value)}
                className="w-44"
                data-ocid="staff.performance.input"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportPerformance}
              className="gap-1.5"
              data-ocid="staff.performance.button"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Total Patients",
                value: perfData.reduce((s, p) => s + p.patientsCount, 0),
                color: "bg-blue-50 border-blue-200 text-blue-700",
              },
              {
                label: "Total Prescriptions",
                value: perfData.reduce((s, p) => s + p.rxCount, 0),
                color: "bg-teal-50 border-teal-200 text-teal-700",
              },
              {
                label: "Total Procedures",
                value: perfData.reduce((s, p) => s + p.procCount, 0),
                color: "bg-purple-50 border-purple-200 text-purple-700",
              },
              {
                label: "Avg Shift Adherence",
                value:
                  perfData.length > 0
                    ? `${Math.round(perfData.reduce((s, p) => s + p.adherencePct, 0) / perfData.length)}%`
                    : "0%",
                color: "bg-emerald-50 border-emerald-200 text-emerald-700",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className={`border rounded-xl p-4 ${color}`}>
                <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          {/* Performance table */}
          {perfData.length === 0 ? (
            <div
              className="bg-card border border-border rounded-xl p-12 text-center"
              data-ocid="staff.performance.empty_state"
            >
              <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground">
                No approved staff yet
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Staff
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Patients
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Rx Written
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Procedures
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Shifts Done
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Adherence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {perfData.map((p, i) => (
                    <tr
                      key={p.staff.id}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`staff.performance.row.${i + 1}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <StaffAvatar acc={p.staff} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {p.staff.name}
                            </p>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STAFF_ROLE_COLORS[p.staff.role as keyof typeof STAFF_ROLE_COLORS] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {STAFF_ROLE_LABELS[
                                p.staff.role as keyof typeof STAFF_ROLE_LABELS
                              ] ?? p.staff.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {p.patientsCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-700">
                        {p.rxCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-purple-700">
                        {p.procCount}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {p.shiftsCompleted}/{p.totalShifts}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-bold ${
                            p.adherencePct >= 90
                              ? "text-emerald-600"
                              : p.adherencePct >= 75
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        >
                          {p.adherencePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Leave Requests ─────────────────────────────────────────────── */}
      {mainTab === "leave" && (isAdmin || currentDoctor?.role === "admin") && (
        <div className="space-y-4" data-ocid="staff.leave.section">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Leave Requests
              {leaveRequests.filter((r) => r.status === "pending").length >
                0 && (
                <span className="text-xs bg-rose-100 text-rose-700 border border-rose-200 rounded-full px-2 py-0.5">
                  {leaveRequests.filter((r) => r.status === "pending").length}{" "}
                  pending
                </span>
              )}
            </h3>
          </div>

          {leaveRequests.length === 0 ? (
            <div
              className="bg-card border border-border rounded-xl p-12 text-center"
              data-ocid="staff.leave.empty_state"
            >
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground mb-1">
                No leave requests
              </p>
              <p className="text-sm text-muted-foreground">
                Staff leave requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-ocid="staff.leave.list">
              {[...leaveRequests].reverse().map((req, i) => {
                const statusColors: Record<LeaveStatus, string> = {
                  pending: "bg-amber-100 text-amber-700 border-amber-200",
                  approved:
                    "bg-emerald-100 text-emerald-700 border-emerald-200",
                  rejected: "bg-red-100 text-red-700 border-red-200",
                };
                return (
                  <div
                    key={req.id}
                    className="bg-card border border-border rounded-xl p-4"
                    data-ocid={`staff.leave.item.${i + 1}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-foreground">
                            {req.staffName}
                          </p>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              STAFF_ROLE_COLORS[
                                req.staffRole as keyof typeof STAFF_ROLE_COLORS
                              ] ??
                              "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {STAFF_ROLE_LABELS[
                              req.staffRole as keyof typeof STAFF_ROLE_LABELS
                            ] ?? req.staffRole}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[req.status]}`}
                          >
                            {req.status.charAt(0).toUpperCase() +
                              req.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{req.leaveType}</span> ·{" "}
                          {req.startDate} → {req.endDate}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {req.reason}
                          </p>
                        )}
                        {req.adminNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Admin note: {req.adminNote}
                          </p>
                        )}
                        {req.reviewedBy && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Reviewed by {req.reviewedBy} ·{" "}
                            {req.reviewedAt
                              ? new Date(req.reviewedAt).toLocaleDateString()
                              : ""}
                          </p>
                        )}
                      </div>
                      {req.status === "pending" && canManage && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                            onClick={() => reviewLeave(req.id, "approved", "")}
                            data-ocid="staff.leave.confirm_button"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-red-700 border-red-300 hover:bg-red-50 gap-1"
                            onClick={() => reviewLeave(req.id, "rejected", "")}
                            data-ocid="staff.leave.delete_button"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TrendingUp placeholder to avoid unused import lint warning */}
          <span className="hidden">
            <TrendingUp className="w-0 h-0" />
          </span>
        </div>
      )}

      {/* ── Tab: Staff Directory ────────────────────────────────────────────── */}
      {mainTab === "directory" && (
        <div className="space-y-4">
          {/* Search + Filters + Export */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, role, phone, ward..."
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                className="pl-9"
                data-ocid="staff.directory.search_input"
              />
            </div>
            <Select
              value={dirRole}
              onValueChange={(v) => setDirRole(v as StaffRole | "all")}
            >
              <SelectTrigger
                className="w-44"
                data-ocid="staff.directory.select"
              >
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {(
                  Object.keys(STAFF_ROLE_LABELS) as Array<
                    keyof typeof STAFF_ROLE_LABELS
                  >
                ).map((r) => (
                  <SelectItem key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={dirShift}
              onValueChange={(v) => setDirShift(v as ShiftType | "all")}
            >
              <SelectTrigger
                className="w-40"
                data-ocid="staff.directory.select"
              >
                <SelectValue placeholder="Any shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Shift</SelectItem>
                {(Object.keys(SHIFT_LABELS) as ShiftType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {SHIFT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={exportDirectory}
              className="gap-1.5"
              data-ocid="staff.directory.button"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>

          {directoryStaff.length === 0 ? (
            <div
              className="bg-card border border-border rounded-xl p-12 text-center"
              data-ocid="staff.directory.empty_state"
            >
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground mb-1">
                No staff found
              </p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              data-ocid="staff.directory.list"
            >
              {directoryStaff.map((s, i) => {
                const curShift = getCurrentShift(s.id);
                const curShiftRecord = curShift
                  ? shifts.find(
                      (sh) =>
                        sh.staffId === s.id &&
                        today >= sh.startDate &&
                        today <= sh.endDate,
                    )
                  : null;
                const roleLabel =
                  STAFF_ROLE_LABELS[s.role as keyof typeof STAFF_ROLE_LABELS] ??
                  s.role;
                const roleColor =
                  STAFF_ROLE_COLORS[s.role as keyof typeof STAFF_ROLE_COLORS] ??
                  "bg-muted text-muted-foreground border-border";

                return (
                  <div
                    key={s.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                    data-ocid={`staff.directory.item.${i + 1}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <StaffAvatar acc={s} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {s.designation ? `${s.designation} ` : ""}
                          {s.name}
                        </p>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleColor}`}
                        >
                          {roleLabel}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {s.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground font-mono">
                            {s.phone}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate text-xs">
                          {s.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {curShift ? (
                          <span
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${SHIFT_COLORS[curShift]}`}
                          >
                            <ShiftIcon type={curShift} />
                            {SHIFT_LABELS[curShift].split(" ")[0]}
                            {curShiftRecord?.ward
                              ? ` · ${curShiftRecord.ward}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                            Off Duty
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
