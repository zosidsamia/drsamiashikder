import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "@tanstack/react-router";
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import PatientForm from "../../components/PatientForm";
import type { PatientFormData } from "../../components/PatientForm";
import { useEmailAuth } from "../../hooks/useEmailAuth";
import { useCreatePatient } from "../../hooks/useQueries";
import type { Patient } from "../../types";

interface LocalPatient extends Patient {
  bedNumber?: string;
  ward?: string;
  isAdmitted?: boolean;
  registerNumber?: string;
}

interface AppointmentRecord {
  id: string;
  patientName: string;
  preferredDate: string;
  preferredTime: string;
  preferredChamber?: string;
  hospitalName?: string;
  status: string;
  appointmentType: string;
  phone?: string;
  createdAt: string;
}

interface MoneyReceipt {
  id: string;
  patientName: string;
  paymentStatus: string;
  invoiceType?: string;
  totalAmount?: number;
  finalAmount?: number;
}

function loadBedSummary() {
  const beds: {
    number: string;
    ward: string;
    patientName: string;
    status: "occupied" | "available";
  }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as LocalPatient[];
      for (const p of arr) {
        if (
          p.isAdmitted ||
          p.patientType === "admitted" ||
          p.status === "Admitted"
        ) {
          beds.push({
            number: String((p as Record<string, unknown>).bedNumber || "—"),
            ward: String((p as Record<string, unknown>).ward || "General"),
            patientName: p.fullName,
            status: "occupied",
          });
        }
      }
    } catch {}
  }
  return beds;
}

function loadTodayAppointments(): AppointmentRecord[] {
  const today = new Date().toISOString().split("T")[0];
  try {
    const all = JSON.parse(
      localStorage.getItem("medicare_appointments") || "[]",
    ) as AppointmentRecord[];
    return all.filter(
      (a) => a.preferredDate === today || a.createdAt?.startsWith(today),
    );
  } catch {
    return [];
  }
}

function getTotalPatients(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as unknown[];
      count += arr.length;
    } catch {}
  }
  return count;
}

function loadUnpaidInvoices(): MoneyReceipt[] {
  try {
    const all = JSON.parse(
      localStorage.getItem("moneyReceipts") || "[]",
    ) as MoneyReceipt[];
    return all.filter((r) => r.paymentStatus !== "paid").slice(0, 10);
  } catch {
    return [];
  }
}

function loadPendingPatients(): LocalPatient[] {
  const results: LocalPatient[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as LocalPatient[];
      for (const p of arr) {
        const st = String((p as Record<string, unknown>).status ?? "");
        if (st === "pending_approval" || st === "pending") {
          results.push(p);
        }
      }
    } catch {}
  }
  return results;
}

function updatePatientStatus(
  patientId: string | number | bigint,
  newStatus: string,
) {
  const idStr = String(patientId);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as LocalPatient[];
      const idx = arr.findIndex((p) => String(p.id) === idStr);
      if (idx >= 0) {
        (arr[idx] as Record<string, unknown>).status = newStatus;
        localStorage.setItem(k, JSON.stringify(arr));
        return true;
      }
    } catch {}
  }
  return false;
}

export default function StaffDashboard() {
  const { currentDoctor } = useEmailAuth();
  const navigate = useNavigate();
  const [showRegForm, setShowRegForm] = useState(false);
  const createPatient = useCreatePatient();

  const occupiedBeds = useMemo(loadBedSummary, []);
  const todayAppointments = useMemo(loadTodayAppointments, []);
  const totalPatients = useMemo(getTotalPatients, []);
  const unpaidInvoices = useMemo(loadUnpaidInvoices, []);
  const [pendingPatients, setPendingPatients] = useState<LocalPatient[]>(() =>
    loadPendingPatients(),
  );

  const handleCreate = (data: PatientFormData) => {
    createPatient.mutate(data, {
      onSuccess: (patient) => {
        const regNum = (patient as Record<string, unknown>)?.registerNumber;
        toast.success(
          regNum ? `Patient registered — ${regNum}` : "Patient registered",
        );
        setShowRegForm(false);
      },
      onError: () => toast.error("Failed to register patient"),
    });
  };

  function handleApprove(patientId: string | number | bigint) {
    if (updatePatientStatus(patientId, "active")) {
      setPendingPatients((prev) =>
        prev.filter((p) => String(p.id) !== String(patientId)),
      );
      toast.success("Patient registration approved");
    }
  }

  function handleReject(patientId: string | number | bigint) {
    if (updatePatientStatus(patientId, "rejected")) {
      setPendingPatients((prev) =>
        prev.filter((p) => String(p.id) !== String(patientId)),
      );
      toast.success("Patient registration rejected");
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div
      className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6"
      data-ocid="staff.dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {currentDoctor?.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Reception / Staff Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowRegForm(true)}
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            data-ocid="staff.register_patient.button"
          >
            <UserPlus className="w-4 h-4" />
            Register Patient
          </Button>
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs px-3 py-1">
            Staff / Reception
          </Badge>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {totalPatients}
            </p>
            <Users className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Total Patients
            </p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {occupiedBeds.length}
            </p>
            <BedDouble className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Beds Occupied
            </p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {todayAppointments.length}
            </p>
            <CalendarDays className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Today's Appointments
            </p>
          </div>
        </div>
        <div className="rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-red-600 p-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-white leading-none">
              {todayAppointments.filter((a) => a.status === "pending").length}
            </p>
            <Clock className="w-6 h-6 text-white opacity-80" />
          </div>
          <div className="bg-card px-4 py-2.5 border border-t-0 border-border rounded-b-xl">
            <p className="text-xs font-medium text-muted-foreground">
              Pending Confirm
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Today's appointments */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Today's Appointments
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => navigate({ to: "/Appointments" })}
            >
              All
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {todayAppointments.length === 0 ? (
              <div
                className="text-center py-8 text-muted-foreground"
                data-ocid="staff.appointments.empty_state"
              >
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No appointments today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayAppointments.slice(0, 6).map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5"
                    data-ocid={`staff.appt_row.${appt.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {appt.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {appt.preferredTime} ·{" "}
                        {appt.preferredChamber || appt.hospitalName || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {appt.phone && (
                        <a
                          href={`https://wa.me/${appt.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700"
                          title="WhatsApp"
                          data-ocid="staff.whatsapp.button"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] border capitalize ${statusColors[appt.status] || statusColors.pending}`}
                      >
                        {appt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bed board */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Bed Assignment Board
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => navigate({ to: "/BedManagement" })}
            >
              Manage
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {occupiedBeds.length === 0 ? (
              <div
                className="text-center py-8 text-muted-foreground"
                data-ocid="staff.beds.empty_state"
              >
                <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No beds occupied</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {occupiedBeds.slice(0, 10).map((b, i) => (
                  <div
                    key={`${b.number}-${i}`}
                    className="border border-blue-200 bg-blue-50/50 rounded-lg px-3 py-2"
                    data-ocid={`staff.bed.${b.number}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-blue-700">
                        Bed {b.number}
                      </span>
                      <Badge className="bg-blue-600 text-white text-[9px] px-1">
                        Occupied
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-foreground truncate">
                      {b.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground">{b.ward}</p>
                  </div>
                ))}
                {/* Available placeholder */}
                <div className="border border-dashed border-border rounded-lg px-3 py-2 flex items-center justify-center">
                  <div className="text-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" />
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ACTION CENTER — Unpaid Invoices & Pending Registrations */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Unpaid Invoices */}
        <Card
          className="border-l-4 border-l-red-500"
          data-ocid="staff.unpaid_invoices.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Unpaid Invoices
              </h2>
              {unpaidInvoices.length > 0 && (
                <Badge className="ml-auto bg-red-500 text-white text-xs">
                  {unpaidInvoices.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {unpaidInvoices.length === 0 ? (
              <div
                className="flex items-center gap-2 text-emerald-600 py-3"
                data-ocid="staff.unpaid_invoices.empty_state"
              >
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm">No unpaid invoices — all cleared!</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {unpaidInvoices.map((inv, idx) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => navigate({ to: "/AppointmentPayment" })}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left"
                    data-ocid={`staff.unpaid_invoice.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {inv.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {inv.invoiceType || "Invoice"}
                      </p>
                    </div>
                    {(inv.finalAmount ?? inv.totalAmount) ? (
                      <span className="text-xs font-bold text-red-700 shrink-0">
                        ৳
                        {(inv.finalAmount ?? inv.totalAmount)?.toLocaleString()}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Patient Registrations */}
        <Card
          className="border-l-4 border-l-amber-500"
          data-ocid="staff.pending_reg.panel"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-foreground text-sm">
                Pending Patient Registrations
              </h2>
              {pendingPatients.length > 0 && (
                <Badge className="ml-auto bg-amber-500 text-white text-xs">
                  {pendingPatients.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {pendingPatients.length === 0 ? (
              <div
                className="flex items-center gap-2 text-emerald-600 py-3"
                data-ocid="staff.pending_reg.empty_state"
              >
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm">No pending registrations</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {pendingPatients.map((p, idx) => (
                  <div
                    key={String(p.id)}
                    className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5"
                    data-ocid={`staff.pending_reg.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.registerNumber && (
                          <span className="font-mono mr-2">
                            {p.registerNumber}
                          </span>
                        )}
                        {(p as Record<string, unknown>).createdAt
                          ? new Date(
                              String((p as Record<string, unknown>).createdAt),
                            ).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => handleApprove(p.id)}
                        data-ocid={`staff.pending_reg.approve.${idx + 1}`}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => handleReject(p.id)}
                        data-ocid={`staff.pending_reg.reject.${idx + 1}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Register patient dialog */}
      <Dialog open={showRegForm} onOpenChange={setShowRegForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600" />
              Register New Patient
            </DialogTitle>
          </DialogHeader>
          <PatientForm
            onSubmit={handleCreate}
            onCancel={() => setShowRegForm(false)}
            isLoading={createPatient.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
