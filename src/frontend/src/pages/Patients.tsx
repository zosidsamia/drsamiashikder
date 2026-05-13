import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  Droplets,
  Hash,
  Mail,
  Phone,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import NurseDueMeds from "../components/NurseDueMeds";
import PatientForm from "../components/PatientForm";
import { useEmailAuth } from "../hooks/useEmailAuth";
import {
  getDoctorEmail,
  useCreatePatient,
  useGetAllPatients,
} from "../hooks/useQueries";
import { useRolePermissions } from "../hooks/useRolePermissions";
import type { Patient } from "../types";

const SKELETON_KEYS = ["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"];

function getAge(dateOfBirth?: bigint): string {
  if (!dateOfBirth) return "\u2014";
  const dob = new Date(Number(dateOfBirth / 1000000n));
  const age = Math.floor(
    (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000),
  );
  return `${age}y`;
}

function isIncompleteRegistration(patientId: bigint | string): boolean {
  try {
    return (
      localStorage.getItem(`patient_reg_incomplete_${String(patientId)}`) ===
      "true"
    );
  } catch {
    return false;
  }
}

function PatientCard({
  patient,
  index,
  assignedToCurrentUser,
}: {
  patient: Patient;
  index: number;
  assignedToCurrentUser?: boolean;
}) {
  const navigate = useNavigate();
  const initial = patient.fullName.charAt(0).toUpperCase();
  const registerNumber = (patient as Record<string, unknown>).registerNumber as
    | string
    | undefined;
  const photo = (patient as Record<string, unknown>).photo as
    | string
    | undefined;
  const incomplete = isIncompleteRegistration(patient.id);

  const handleClick = () => {
    navigate({
      to: "/PatientProfile",
      search: { id: String(patient.id) },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      data-ocid={`patients.item.${index + 1}`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-elevated hover:border-primary/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-lg font-bold text-white shadow-sm overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.62 0.14 195), oklch(0.52 0.14 215))",
            }}
          >
            {photo ? (
              <img
                src={photo}
                alt={patient.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground truncate">
                  {patient.fullName}
                </p>
                {patient.nameBn && (
                  <p className="text-xs text-muted-foreground">
                    {patient.nameBn}
                  </p>
                )}
                {registerNumber && (
                  <p className="text-xs font-mono text-primary/80 flex items-center gap-1 mt-0.5">
                    <Hash className="w-3 h-3" />
                    {registerNumber}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {incomplete && (
                  <Badge className="text-xs bg-orange-100 text-orange-800 border border-orange-300 gap-1">
                    ⚠ Incomplete
                  </Badge>
                )}
                {assignedToCurrentUser && (
                  <Badge className="text-xs bg-purple-100 text-purple-800 border border-purple-300 gap-1">
                    <UserCheck className="w-2.5 h-2.5" />
                    Assigned to you
                  </Badge>
                )}
                {patient.bloodGroup && patient.bloodGroup !== "unknown" && (
                  <Badge
                    variant="outline"
                    className="text-xs border-red-200 text-red-600"
                  >
                    <Droplets className="w-2.5 h-2.5 mr-1" />
                    {patient.bloodGroup}
                  </Badge>
                )}
                {(patient as Record<string, unknown>).status === "Admitted" ||
                patient.isAdmitted ||
                patient.patientType === "admitted" ||
                patient.patientType === "indoor" ? (
                  <Badge className="text-xs bg-green-100 text-green-800 border border-green-300">
                    🏥 Admitted
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {patient.patientType}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
              {patient.dateOfBirth && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {getAge(patient.dateOfBirth)}
                </span>
              )}
              {patient.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {patient.phone}
                </span>
              )}
              {patient.email && (
                <span className="flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3" />
                  {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

export default function Patients() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const { data: patients = [], isLoading } = useGetAllPatients();
  const createMutation = useCreatePatient();
  const permissions = useRolePermissions();
  const { currentDoctor } = useEmailAuth();

  // Current user's email for consultant assignment check
  const currentUserEmail = currentDoctor?.email ?? getDoctorEmail();
  const isConsultant =
    currentDoctor?.role === "consultant_doctor" ||
    currentDoctor?.role === "doctor";

  const showDueMeds =
    currentDoctor?.role === "nurse" || currentDoctor?.role === "intern_doctor";

  const baseFiltered = patients.filter((p) => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (p.nameBn ?? "").includes(search) ||
      (p.phone ?? "").includes(search) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      ((p as Record<string, unknown>).registerNumber ?? "")
        .toString()
        .toLowerCase()
        .includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (showIncompleteOnly && !isIncompleteRegistration(p.id)) return false;
    return true;
  });

  const handleCreate = (data: Parameters<typeof createMutation.mutate>[0]) => {
    createMutation.mutate(data, {
      onSuccess: (patient) => {
        const regNum = (patient as Record<string, unknown>)?.registerNumber;
        toast.success(
          regNum ? `Patient registered \u2014 ${regNum}` : "Patient registered",
        );
        setShowForm(false);
      },
      onError: () => toast.error("Failed to register patient"),
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Patients
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {patients.length} registered
          </p>
        </div>
        {permissions.canRegisterPatients && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 w-full sm:w-auto"
            data-ocid="patients.open_modal_button"
          >
            <UserPlus className="w-4 h-4" />
            New Patient
          </Button>
        )}
      </div>

      {/* Due Meds Now — for Nurse and Intern Doctor */}
      {showDueMeds && (
        <div className="mb-4">
          <NurseDueMeds
            currentUserName={currentDoctor?.name ?? ""}
            currentUserRole={currentDoctor?.role ?? "nurse"}
          />
        </div>
      )}

      {/* Admitted-only notice removed — all clinical roles can now see all patients */}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, register no., phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-ocid="patients.search_input"
          />
        </div>
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap self-center"
          data-ocid="patients.incomplete_only.toggle"
        >
          <input
            type="checkbox"
            checked={showIncompleteOnly}
            onChange={(e) => setShowIncompleteOnly(e.target.checked)}
            className="rounded border-orange-400 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-xs font-medium text-orange-700">
            ⚠ Show Incomplete Only
          </span>
        </label>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3" data-ocid="patients.loading_state">
          {SKELETON_KEYS.map((k) => (
            <Skeleton key={k} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : baseFiltered.length === 0 ? (
        <div
          className="text-center py-16 space-y-3"
          data-ocid="patients.empty_state"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">
            {search ? "No patients found" : "No patients yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {search
              ? "Try a different search term or register number"
              : "Register your first patient to get started"}
          </p>
          {!search && permissions.canRegisterPatients && (
            <Button
              variant="outline"
              onClick={() => setShowForm(true)}
              className="mt-2"
              data-ocid="patients.secondary_button"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Register Patient
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {baseFiltered.map((patient, idx) => (
              <PatientCard
                key={patient.id.toString()}
                patient={patient}
                index={idx}
                assignedToCurrentUser={
                  isConsultant &&
                  !!patient.consultantAssignment &&
                  patient.consultantAssignment.email === currentUserEmail
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* New Patient Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          data-ocid="patients.dialog"
        >
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          <PatientForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
