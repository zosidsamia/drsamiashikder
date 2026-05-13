// RegistrarDashboard — All Admitted Patients view for Registrar role
// Accessible only to roles with canViewAllAdmittedPatients = true (Registrar + Admin)

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
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Bed,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  Edit2,
  Plus,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import VitalVerification, {
  getPendingVitalsCount,
} from "../components/VitalVerification";
import { useEmailAuth } from "../hooks/useEmailAuth";
import {
  getDoctorEmail,
  loadFromAllDoctorKeys,
  loadFromStorage,
  saveToStorage,
} from "../hooks/useQueries";
import { useRolePermissions } from "../hooks/useRolePermissions";
import type { BedRecord, Patient } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAge(dob?: bigint): number | null {
  if (!dob) return null;
  return Math.floor(
    (Date.now() - Number(dob / 1_000_000n)) / (365.25 * 24 * 3600 * 1000),
  );
}

function daysSince(ts?: bigint | string): number {
  if (!ts) return 0;
  const ms =
    typeof ts === "bigint"
      ? Number(ts / 1_000_000n)
      : new Date(ts as string).getTime();
  return Math.max(1, Math.floor((Date.now() - ms) / (1000 * 3600 * 24)));
}

type AdmissionStatus = "Admitted" | "Pending" | "Discharging" | "Discharged";

const STATUS_CONFIG: Record<AdmissionStatus, { label: string; cls: string }> = {
  Admitted: {
    label: "Admitted",
    cls: "bg-orange-100 text-orange-700 border-orange-300",
  },
  Pending: {
    label: "Pending",
    cls: "bg-yellow-100 text-yellow-700 border-yellow-300",
  },
  Discharging: {
    label: "Discharging",
    cls: "bg-blue-100 text-blue-700 border-blue-300",
  },
  Discharged: {
    label: "Discharged",
    cls: "bg-green-100 text-green-700 border-green-300",
  },
};

// ── Discharge Checklist Modal ──────────────────────────────────────────────────

function DischargeChecklistModal({
  patient,
  onConfirm,
  onClose,
}: {
  patient: Patient;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ITEMS = [
    "IV line removed",
    "Medications stopped / handed over",
    "Discharge summary signed",
    "Patient belongings collected",
    "Outstanding payment settled",
  ];
  const [checked, setChecked] = useState<boolean[]>(ITEMS.map(() => false));
  const allDone = checked.every(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Discharge Checklist — {patient.fullName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirm all steps before marking as Discharged:
          </p>
          {ITEMS.map((item, i) => (
            <label
              key={item}
              className="flex items-center gap-2.5 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  setChecked(next);
                }}
                className="w-4 h-4 accent-green-600"
                data-ocid={`registrar.discharge_checklist.item.${i + 1}`}
              />
              <span
                className={
                  checked[i] ? "line-through text-muted-foreground" : ""
                }
              >
                {item}
              </span>
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!allDone}
              onClick={onConfirm}
              data-ocid="registrar.discharge.confirm_button"
            >
              Approve Discharge
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              data-ocid="registrar.discharge.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── New Admission Modal ──────────────────────────────────────────────────────────

function NewAdmissionModal({
  patients,
  beds,
  onSaved,
  onClose,
}: {
  patients: Patient[];
  beds: BedRecord[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { currentDoctor } = useEmailAuth();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [ward, setWard] = useState("");
  const [bed, setBed] = useState("");
  const [department, setDepartment] = useState("");
  const [consultant, setConsultant] = useState("");

  const filtered = search.trim()
    ? patients.filter(
        (p) =>
          p.fullName.toLowerCase().includes(search.toLowerCase()) ||
          (p.registerNumber ?? "").includes(search),
      )
    : patients.slice(0, 10);

  const availableBeds = beds.filter((b) => b.status === "Empty");
  const wards = [...new Set(beds.map((b) => b.ward).filter(Boolean))];

  const handleSave = () => {
    if (!selectedPatient) {
      toast.error("Select a patient");
      return;
    }
    if (!bed) {
      toast.error("Select a bed");
      return;
    }
    const email = getDoctorEmail();
    const allPatients = loadFromStorage<Patient>(`patients_${email}`);
    const idx = allPatients.findIndex(
      (p) => String(p.id) === String(selectedPatient.id),
    );
    if (idx >= 0) {
      allPatients[idx] = {
        ...allPatients[idx],
        isAdmitted: true,
        patientType: "admitted",
        bedNumber: bed,
        ward,
        department,
        admittedOn: new Date().toISOString(),
        consultantAssignment: {
          email: currentDoctor?.email ?? "",
          name: consultant || currentDoctor?.name || "",
          assignedAt: new Date().toISOString(),
          assignedBy: currentDoctor?.email ?? "",
        },
      };
      saveToStorage(`patients_${email}`, allPatients);
      toast.success(`${selectedPatient.fullName} admitted to Bed ${bed}`);
      onSaved();
    } else {
      toast.error("Patient not found in local records");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> New Admission
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Patient search */}
          <div className="space-y-1.5">
            <Label htmlFor="new-admission-search">Search Patient</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="new-admission-search"
                placeholder="Name or register number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm"
                data-ocid="registrar.new_admission.search_input"
              />
            </div>
            {!selectedPatient && search.trim() && (
              <div className="border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {filtered.map((p) => (
                  <button
                    key={String(p.id)}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0"
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearch(p.fullName);
                    }}
                  >
                    <span className="font-medium">{p.fullName}</span>
                    {p.registerNumber && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        #{p.registerNumber}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                <span className="font-medium">{selectedPatient.fullName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setSearch("");
                  }}
                >
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-admission-ward">Ward</Label>
              <Select value={ward} onValueChange={setWard}>
                <SelectTrigger
                  id="new-admission-ward"
                  data-ocid="registrar.new_admission.ward.select"
                >
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                  <SelectItem value="General Ward">General Ward</SelectItem>
                  <SelectItem value="ICU">ICU</SelectItem>
                  <SelectItem value="HDU">HDU</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admission-bed">Bed *</Label>
              <Select value={bed} onValueChange={setBed}>
                <SelectTrigger
                  id="new-admission-bed"
                  data-ocid="registrar.new_admission.bed.select"
                >
                  <SelectValue placeholder="Select bed" />
                </SelectTrigger>
                <SelectContent>
                  {availableBeds.map((b) => (
                    <SelectItem key={b.bedNumber} value={b.bedNumber}>
                      {b.bedNumber} — {b.ward}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admission-dept">Department</Label>
              <Input
                id="new-admission-dept"
                placeholder="Medicine, Surgery…"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                data-ocid="registrar.new_admission.department.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admission-consultant">Consultant</Label>
              <Input
                id="new-admission-consultant"
                placeholder="Consultant name"
                value={consultant}
                onChange={(e) => setConsultant(e.target.value)}
                data-ocid="registrar.new_admission.consultant.input"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSave}
              data-ocid="registrar.new_admission.submit_button"
            >
              Admit Patient
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              data-ocid="registrar.new_admission.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Patient Card ────────────────────────────────────────────────────────────────

function RegistrarPatientCard({
  patient,
  index,
  availableBeds,
  permissions,
  onStatusChange,
  onBedChange,
  onApproveDischarge,
  onVerifyVitals,
}: {
  patient: Patient;
  index: number;
  availableBeds: BedRecord[];
  permissions: ReturnType<typeof useRolePermissions>;
  onStatusChange: (p: Patient, status: AdmissionStatus) => void;
  onBedChange: (p: Patient, bed: string) => void;
  onApproveDischarge: (p: Patient) => void;
  onVerifyVitals: (p: Patient) => void;
}) {
  const age = getAge(patient.dateOfBirth);
  const dayCount = daysSince(
    patient.admittedOn ?? patient.admissionDate ?? patient.createdAt,
  );
  const consultantName = patient.consultantAssignment?.name ?? "—";
  const patientStatusStr = patient.status ?? "Active";
  const initialStatus: AdmissionStatus =
    patientStatusStr === "Discharged" ? "Discharged" : "Admitted";
  const [localStatus, setLocalStatus] =
    useState<AdmissionStatus>(initialStatus);
  const pendingVitals = getPendingVitalsCount(String(patient.id));
  const [editingBed, setEditingBed] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
      data-ocid={`registrar.patient_card.item.${index + 1}`}
    >
      <div className="bg-muted/30 px-4 py-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground text-sm truncate">
              {patient.fullName}
            </span>
            {patient.nameBn && (
              <span className="text-xs text-muted-foreground">
                {patient.nameBn}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              #{patient.registerNumber ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {age !== null && (
              <span>
                {age}y / {patient.gender}
              </span>
            )}
            <span className="flex items-center gap-1">
              <BedDouble className="w-3 h-3" /> Bed {patient.bedNumber ?? "—"}
            </span>
            <span>{patient.ward ?? patient.department ?? "General"}</span>
            <span>Day {dayCount}</span>
            {consultantName !== "—" && <span>Dr. {consultantName}</span>}
          </div>
        </div>
        {/* Status badge + inline change */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {editingStatus ? (
            <Select
              value={localStatus}
              onValueChange={(v) => {
                const newStatus = v as AdmissionStatus;
                setLocalStatus(newStatus);
                onStatusChange(patient, newStatus);
                setEditingStatus(false);
              }}
            >
              <SelectTrigger
                className="h-7 text-xs w-36"
                data-ocid={`registrar.status.select.${index + 1}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_CONFIG) as AdmissionStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              type="button"
              onClick={() => setEditingStatus(true)}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                STATUS_CONFIG[localStatus]?.cls ?? "bg-muted"
              }`}
              data-ocid={`registrar.status.badge.${index + 1}`}
            >
              {STATUS_CONFIG[localStatus]?.label ?? localStatus}
              <ChevronDown className="inline w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bed + vitals row */}
      <div className="px-4 py-2 flex items-center gap-4 flex-wrap border-b border-border/50">
        <div className="flex items-center gap-1.5 text-sm">
          <Bed className="w-3.5 h-3.5 text-muted-foreground" />
          {editingBed ? (
            <Select
              value={patient.bedNumber ?? ""}
              onValueChange={(v) => {
                onBedChange(patient, v);
                setEditingBed(false);
              }}
            >
              <SelectTrigger
                className="h-7 text-xs w-40"
                data-ocid={`registrar.bed.select.${index + 1}`}
              >
                <SelectValue placeholder="Select bed" />
              </SelectTrigger>
              <SelectContent>
                {availableBeds.map((b) => (
                  <SelectItem
                    key={b.bedNumber}
                    value={b.bedNumber}
                    className="text-xs"
                  >
                    {b.bedNumber} — {b.ward}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              type="button"
              className="text-xs font-mono text-foreground hover:text-primary flex items-center gap-1"
              onClick={() => setEditingBed(true)}
              data-ocid={`registrar.bed.edit.${index + 1}`}
            >
              {patient.bedNumber ?? "—"}
              {permissions.canEditBedAssignment && (
                <Edit2 className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
        {pendingVitals > 0 && (
          <span className="text-[10px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded-full">
            {pendingVitals} vitals pending review
          </span>
        )}
        {patient.allergies.length > 0 && (
          <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold">
            ⚠ Allergy
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="px-4 py-2.5 bg-muted/10 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => onVerifyVitals(patient)}
          data-ocid={`registrar.verify_vitals.button.${index + 1}`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Vitals
        </Button>
        {localStatus === "Discharging" && permissions.canApproveDischarge && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
            onClick={() => onApproveDischarge(patient)}
            data-ocid={`registrar.approve_discharge.button.${index + 1}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve Discharge
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Page Content (all hooks at top level) ─────────────────────────────────────

function RegistrarDashboardContent() {
  const permissions = useRolePermissions();
  const navigate = useNavigate();

  const email = getDoctorEmail();

  const [patients, setPatients] = useState<Patient[]>(() => {
    const primary = loadFromStorage<Patient>(`patients_${email}`);
    const all =
      primary.length > 0 ? primary : loadFromAllDoctorKeys<Patient>("patients");
    return all.filter(
      (p) =>
        p.isAdmitted === true ||
        p.patientType === "admitted" ||
        p.patientType === "indoor",
    );
  });

  const [beds] = useState<BedRecord[]>(() =>
    loadFromStorage<BedRecord>("beds"),
  );

  const [search, setSearch] = useState("");
  const [filterConsultant, setFilterConsultant] = useState("all");
  const [filterWard, setFilterWard] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [showNewAdmission, setShowNewAdmission] = useState(false);
  const [dischargeTarget, setDischargeTarget] = useState<Patient | null>(null);
  const [vitalPatient, setVitalPatient] = useState<Patient | null>(null);

  // Guard AFTER all hooks
  if (!permissions.canViewAllAdmittedPatients) {
    return (
      <div className="max-w-md mx-auto p-8 text-center mt-16">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground text-sm">
          This page is only available to Registrar and Admin.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => navigate({ to: "/Dashboard" })}
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  // Unique filter values
  const consultants = [
    ...new Set(
      patients
        .map((p) => p.consultantAssignment?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const wards = [
    ...new Set(
      patients.map((p) => p.ward ?? p.department ?? "").filter(Boolean),
    ),
  ];
  const departments = [
    ...new Set(patients.map((p) => p.department ?? "").filter(Boolean)),
  ];

  const allPatients = (() => {
    const primary = loadFromStorage<Patient>(`patients_${email}`);
    const all =
      primary.length > 0 ? primary : loadFromAllDoctorKeys<Patient>("patients");
    return all;
  })();

  const filteredPatients = (() => {
    let list = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          (p.registerNumber ?? "").includes(q) ||
          (p.bedNumber ?? "").toLowerCase().includes(q),
      );
    }
    if (filterConsultant !== "all")
      list = list.filter(
        (p) => p.consultantAssignment?.name === filterConsultant,
      );
    if (filterWard !== "all")
      list = list.filter((p) => (p.ward ?? p.department) === filterWard);
    if (filterDept !== "all")
      list = list.filter((p) => p.department === filterDept);
    if (filterStatus !== "all")
      list = list.filter((p) => (p.status ?? "Active") === filterStatus);
    return list;
  })();

  const availableBeds = beds.filter((b) => b.status === "Empty");

  const updatePatient = (updated: Patient) => {
    const primary = loadFromStorage<Patient>(`patients_${email}`);
    const idx = primary.findIndex((p) => String(p.id) === String(updated.id));
    if (idx >= 0) {
      primary[idx] = updated;
      saveToStorage(`patients_${email}`, primary);
    }
    setPatients((prev) =>
      prev.map((p) => (String(p.id) === String(updated.id) ? updated : p)),
    );
  };

  const handleStatusChange = (_patient: Patient, _status: AdmissionStatus) => {
    // Status is managed in local card state; just show a toast
    toast.success(`Status updated to ${_status}`);
  };

  const handleBedChange = (patient: Patient, bed: string) => {
    updatePatient({ ...patient, bedNumber: bed });
    toast.success(`Bed changed to ${bed}`);
  };

  const handleApproveDischarge = (patient: Patient) => {
    updatePatient({
      ...patient,
      status: "Discharged",
      isAdmitted: false,
      patientType: "outdoor",
      dischargeDate: new Date().toISOString(),
    });
    setDischargeTarget(null);
    toast.success(`${patient.fullName} discharged`);
  };

  return (
    <div
      className="flex flex-col min-h-0 bg-background"
      data-ocid="registrar.page"
    >
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-700" />
            <div>
              <h1 className="font-bold text-foreground text-base leading-tight">
                All Admitted Patients
              </h1>
              <p className="text-xs text-muted-foreground">
                {patients.length} admitted ·{" "}
                {format(new Date(), "EEEE, dd MMM yyyy")}
              </p>
            </div>
          </div>
          {permissions.canManageAdmissions !== false && (
            <Button
              className="gap-1.5 bg-green-700 hover:bg-green-800"
              size="sm"
              onClick={() => setShowNewAdmission(true)}
              data-ocid="registrar.new_admission.open_modal_button"
            >
              <Plus className="w-4 h-4" /> New Admission
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search patient, bed, register no.…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
              data-ocid="registrar.search_input"
            />
          </div>

          <Select value={filterConsultant} onValueChange={setFilterConsultant}>
            <SelectTrigger
              className="h-8 text-xs w-40"
              data-ocid="registrar.filter.consultant.select"
            >
              <SelectValue placeholder="Consultant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Consultants</SelectItem>
              {consultants.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterWard} onValueChange={setFilterWard}>
            <SelectTrigger
              className="h-8 text-xs w-32"
              data-ocid="registrar.filter.ward.select"
            >
              <SelectValue placeholder="Ward" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wards.map((w) => (
                <SelectItem key={w} value={w} className="text-xs">
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger
              className="h-8 text-xs w-36"
              data-ocid="registrar.filter.dept.select"
            >
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d} className="text-xs">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger
              className="h-8 text-xs w-36"
              data-ocid="registrar.filter.status.select"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {(Object.keys(STATUS_CONFIG) as AdmissionStatus[]).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="outline" className="text-xs h-8 px-2.5">
            {filteredPatients.length} shown
          </Badge>
        </div>
      </div>

      {/* Patient Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredPatients.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="registrar.empty_state"
          >
            <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">
              No admitted patients match the filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPatients.map((patient, idx) => (
              <RegistrarPatientCard
                key={String(patient.id)}
                patient={patient}
                index={idx}
                availableBeds={availableBeds}
                permissions={permissions}
                onStatusChange={handleStatusChange}
                onBedChange={handleBedChange}
                onApproveDischarge={(p) => setDischargeTarget(p)}
                onVerifyVitals={(p) => setVitalPatient(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Vital Verification Panel */}
      {vitalPatient && (
        <Dialog open onOpenChange={(open) => !open && setVitalPatient(null)}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto p-0">
            <VitalVerification
              patientId={String(vitalPatient.id)}
              patientName={vitalPatient.fullName}
              onClose={() => setVitalPatient(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Discharge Checklist Modal */}
      {dischargeTarget && (
        <DischargeChecklistModal
          patient={dischargeTarget}
          onConfirm={() => handleApproveDischarge(dischargeTarget)}
          onClose={() => setDischargeTarget(null)}
        />
      )}

      {/* New Admission Modal */}
      {showNewAdmission && (
        <NewAdmissionModal
          patients={allPatients}
          beds={beds}
          onSaved={() => {
            setShowNewAdmission(false);
            const updated = loadFromStorage<Patient>(`patients_${email}`);
            setPatients(
              updated.filter(
                (p) =>
                  p.isAdmitted === true ||
                  p.patientType === "admitted" ||
                  p.patientType === "indoor",
              ),
            );
          }}
          onClose={() => setShowNewAdmission(false)}
        />
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────────

export default function RegistrarDashboard() {
  return <RegistrarDashboardContent />;
}
