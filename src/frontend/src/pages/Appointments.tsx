import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  BedDouble,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit2,
  Hospital,
  Inbox,
  ListOrdered,
  Loader2,
  MessageCircle,
  Monitor,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Stethoscope,
  Trash2,
  UserPlus,
  UserSearch,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import MoneyReceipt, { ReceiptsHistoryList } from "../components/MoneyReceipt";
import PatientForm, { type PatientFormData } from "../components/PatientForm";
import { useEmailAuth } from "../hooks/useEmailAuth";
import {
  _canisterActorRef,
  useCreatePatient,
  useGetAllPatients,
} from "../hooks/useQueries";
import { enqueueSync } from "../lib/hybridStorage";
import { buildFollowUpMessage } from "../lib/whatsappTemplates";

// ─── Types ──────────────────────────────────────────────────────────────────

type SerialStatus = "waiting" | "in-progress" | "done";
type AppointmentStatus = "scheduled" | "confirmed" | "cancelled";
type AppointmentType = "chamber" | "admitted";

/** Slot availability result for the conflict check */
type SlotAvailability = "available" | "conflict" | "unknown";

interface ConflictInfo {
  conflictingTime: string;
  conflictingPatient: string;
  doctorName: string;
}

interface SerialEntry {
  id: string;
  serial: number;
  patientName: string;
  phone: string;
  arrivalTime: string;
  status: SerialStatus;
}

interface AppointmentEntry {
  id: string;
  patientName: string;
  phone: string;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
  doctor?: string;
  chamber?: string;
  registerNumber?: string;
  appointmentType: AppointmentType;
  // admitted-only
  hospitalName?: string;
  bedWardNumber?: string;
  admissionReason?: string;
  referringDoctor?: string;
  // serial
  serialNumber?: number;
  serialDate?: string;
  // doctor-set visit time (admitted)
  visitTime?: string;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

function todayKey() {
  return `clinic_serials_${new Date().toISOString().slice(0, 10)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadSerials(): SerialEntry[] {
  try {
    return JSON.parse(localStorage.getItem(todayKey()) || "[]");
  } catch {
    return [];
  }
}

function saveSerials(data: SerialEntry[]) {
  localStorage.setItem(todayKey(), JSON.stringify(data));
}

// ─── Canister sync helpers ────────────────────────────────────────────────────

/** Push appointment changes to the canister — fire-and-forget, never throws */
async function syncAppointmentToCanister(
  op: "create" | "update" | "delete",
  entry: AppointmentEntry,
): Promise<void> {
  const actor = _canisterActorRef();
  if (!actor || !navigator.onLine) {
    enqueueSync({
      timestamp: Date.now(),
      operation: op,
      entityType: "appointment",
      entityId: entry.id,
      data: entry,
    });
    return;
  }
  try {
    if (op === "delete") {
      await actor.deleteAppointment(entry.id);
    } else {
      await actor.bulkUpsertAppointments([entry]);
    }
  } catch (e) {
    console.warn("Canister appointment sync failed, queuing:", e);
    enqueueSync({
      timestamp: Date.now(),
      operation: op,
      entityType: "appointment",
      entityId: entry.id,
      data: entry,
    });
  }
}

/** Push queue-entry changes to the canister — fire-and-forget, never throws */
async function syncQueueEntryToCanister(
  op: "create" | "update" | "delete",
  entry: SerialEntry,
): Promise<void> {
  const actor = _canisterActorRef();
  const enriched = { ...entry, queueDate: todayStr() };
  if (!actor || !navigator.onLine) {
    enqueueSync({
      timestamp: Date.now(),
      operation: op,
      entityType: "queueEntry",
      entityId: entry.id,
      data: enriched,
    });
    return;
  }
  try {
    if (op === "delete") {
      await actor.deleteQueueEntry(entry.id);
    } else {
      await actor.bulkUpsertQueueEntries([enriched]);
    }
  } catch (e) {
    console.warn("Canister queue-entry sync failed, queuing:", e);
    enqueueSync({
      timestamp: Date.now(),
      operation: op,
      entityType: "queueEntry",
      entityId: entry.id,
      data: enriched,
    });
  }
}

function loadAppointments(): AppointmentEntry[] {
  try {
    const a = JSON.parse(
      localStorage.getItem("clinic_appointments") || "[]",
    ) as AppointmentEntry[];
    const b = JSON.parse(
      localStorage.getItem("public_appointment_requests") || "[]",
    );
    // Merge: public requests that have preferredDate → convert to AppointmentEntry
    const converted = b
      .filter((x: Record<string, unknown>) => x.preferredDate || x.date)
      .map((x: Record<string, unknown>) => ({
        id: x.id || x.patientName,
        patientName: (x.patientName || x.name || "") as string,
        phone: (x.phone || "") as string,
        date: (x.preferredDate || x.date || "") as string,
        time: (x.preferredTime || x.time || "") as string,
        reason: (x.reason || x.notes || "") as string,
        status:
          (x.status as AppointmentStatus) === "confirmed"
            ? "confirmed"
            : (x.status as AppointmentStatus) === "cancelled"
              ? "cancelled"
              : "scheduled",
        doctor: (x.preferredDoctor || x.doctor || "") as string,
        chamber: (x.preferredChamber || x.chamber || "") as string,
        registerNumber: (x.registerNumber || "") as string,
        appointmentType: ((x.appointmentType as AppointmentType) ||
          "chamber") as AppointmentType,
        hospitalName: (x.hospitalName || "") as string,
        bedWardNumber: (x.bedWardNumber || "") as string,
        admissionReason: (x.admissionReason || "") as string,
        referringDoctor: (x.referringDoctor || "") as string,
        serialNumber: x.serialNumber as number | undefined,
        serialDate: (x.serialDate || "") as string,
        visitTime: (x.visitTime || "") as string,
        _isPublic: true,
      }));
    // Deduplicate by id
    const combined: AppointmentEntry[] = [...a];
    for (const c of converted) {
      if (!combined.find((x) => x.id === c.id)) combined.push(c);
    }
    return combined;
  } catch {
    return [];
  }
}

function saveAppointments(data: AppointmentEntry[]) {
  localStorage.setItem(
    "clinic_appointments",
    JSON.stringify(
      data.filter((d) => !(d as unknown as Record<string, unknown>)._isPublic),
    ),
  );
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

// ─── Conflict check ──────────────────────────────────────────────────────────

/**
 * Check if a doctor already has an appointment within 15 minutes of the
 * requested date+time combination. Returns null if no conflict.
 */
function checkSlotConflict(
  appointments: AppointmentEntry[],
  date: string,
  time: string,
  doctor: string,
  excludeId?: string,
): ConflictInfo | null {
  if (!date || !time || !doctor) return null;
  const [hh, mm] = time.split(":").map(Number);
  const requestedMinutes = hh * 60 + mm;

  for (const appt of appointments) {
    if (appt.id === excludeId) continue;
    if (appt.appointmentType !== "chamber") continue;
    if (appt.status === "cancelled") continue;
    if (appt.date !== date) continue;
    if (appt.doctor !== doctor) continue;
    if (!appt.time) continue;

    const [ah, am] = appt.time.split(":").map(Number);
    const apptMinutes = ah * 60 + am;
    if (Math.abs(apptMinutes - requestedMinutes) < 15) {
      return {
        conflictingTime: appt.time,
        conflictingPatient: appt.patientName,
        doctorName: doctor,
      };
    }
  }
  return null;
}

// ─── Patient register number lookup ─────────────────────────────────────────

function normalizeRegNo(rn: string): string {
  const parts = rn.trim().split("/");
  if (parts.length === 2) {
    const num = Number.parseInt(parts[0].trim(), 10);
    return `${Number.isNaN(num) ? parts[0].trim() : num}/${parts[1].trim()}`;
  }
  return rn.trim().toLowerCase();
}

interface PatientLookup {
  fullName?: string;
  phone?: string;
  registerNumber?: string;
  age?: string;
  gender?: string;
  dateOfBirth?: unknown;
  [key: string]: unknown;
}

function lookupPatientByRegOrPhone(query: string): PatientLookup | null {
  if (!query.trim()) return null;
  const norm = normalizeRegNo(query);
  const isPhone =
    /^[0-9+\-() ]{7,}$/.test(query.trim()) && !query.includes("/");

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("patients_")) continue;
    try {
      const arr = JSON.parse(
        localStorage.getItem(key) || "[]",
      ) as PatientLookup[];
      let found: PatientLookup | undefined;
      if (isPhone) {
        found = arr.find((p) =>
          p.phone?.replace(/\D/g, "").includes(query.replace(/\D/g, "")),
        );
      } else {
        found = arr.find(
          (p) =>
            p.registerNumber &&
            normalizeRegNo(String(p.registerNumber)) === norm,
        );
      }
      if (found) return found;
    } catch {}
  }
  return null;
}

/** Get or assign a serial for patient+date (1 per patient per day) */
function getOrAssignSerial(
  appointments: AppointmentEntry[],
  patientName: string,
  date: string,
): number {
  const existing = appointments.find(
    (a) =>
      a.patientName.trim().toLowerCase() === patientName.trim().toLowerCase() &&
      a.serialDate === date &&
      a.serialNumber,
  );
  if (existing?.serialNumber) return existing.serialNumber;

  // Find the max serial for the day
  const serialsForDay = appointments
    .filter((a) => a.serialDate === date && a.serialNumber)
    .map((a) => a.serialNumber as number);
  return serialsForDay.length > 0 ? Math.max(...serialsForDay) + 1 : 1;
}

// ─── Patient Search Dropdown ─────────────────────────────────────────────────

interface PatientSearchProps {
  value: string;
  onSelect: (name: string, phone: string) => void;
  onChange: (v: string) => void;
}

function PatientSearch({ value, onSelect, onChange }: PatientSearchProps) {
  const { data: patients = [], isLoading } = useGetAllPatients();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? patients.filter((p) =>
        p.fullName.toLowerCase().includes(value.toLowerCase()),
      )
    : [];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search or type patient name…"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          data-ocid="appointments.search_input"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id.toString()}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2"
              onClick={() => {
                onSelect(p.fullName, p.phone || "");
                setOpen(false);
              }}
            >
              <span className="font-medium text-foreground">{p.fullName}</span>
              {p.phone && (
                <span className="text-muted-foreground text-xs">{p.phone}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status Badges ────────────────────────────────────────────────────────────

const serialStatusConfig: Record<
  SerialStatus,
  { label: string; className: string }
> = {
  waiting: {
    label: "Waiting",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  done: {
    label: "Done",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

const apptStatusConfig: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

// ─── Doctor Serial Tab ────────────────────────────────────────────────────────

function DoctorSerialTab() {
  const [serials, setSerials] = useState<SerialEntry[]>(loadSerials);
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const { currentDoctor } = useEmailAuth();
  const isDoctor = !currentDoctor || currentDoctor.role === "doctor";

  const persist = (data: SerialEntry[]) => {
    setSerials(data);
    saveSerials(data);
    const nowServing = data.find((s) => s.status === "in-progress") || null;
    const queue = data.filter((s) => s.status === "waiting");
    localStorage.setItem(
      "medicare_serial_queue",
      JSON.stringify({ nowServing, queue }),
    );
  };

  function addSerial() {
    if (!form.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    const next =
      serials.length > 0 ? Math.max(...serials.map((s) => s.serial)) + 1 : 1;
    const entry: SerialEntry = {
      id: uid(),
      serial: next,
      patientName: form.name.trim(),
      phone: form.phone.trim(),
      arrivalTime: nowTime(),
      status: "waiting",
    };
    persist([...serials, entry]);
    setForm({ name: "", phone: "" });
    setAddOpen(false);
    toast.success(`Serial #${next} added for ${entry.patientName}`);
    syncQueueEntryToCanister("create", entry);
  }

  function updateStatus(id: string, status: SerialStatus) {
    const updated = serials.map((s) => (s.id === id ? { ...s, status } : s));
    persist(updated);
    const entry = updated.find((s) => s.id === id);
    if (entry) syncQueueEntryToCanister("update", entry);
  }

  function deleteSerial(id: string) {
    const entry = serials.find((s) => s.id === id);
    persist(serials.filter((s) => s.id !== id));
    toast.success("Serial removed");
    if (entry) syncQueueEntryToCanister("delete", entry);
  }

  function resetQueue() {
    // Delete all current entries from canister before clearing
    for (const entry of serials) {
      syncQueueEntryToCanister("delete", entry);
    }
    persist([]);
    setResetOpen(false);
    toast.success("Queue reset for today");
  }

  const counts = {
    waiting: serials.filter((s) => s.status === "waiting").length,
    inProgress: serials.filter((s) => s.status === "in-progress").length,
    done: serials.filter((s) => s.status === "done").length,
  };

  const todayLabel = new Date().toLocaleDateString("en-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Today
          </p>
          <p className="text-lg font-semibold text-foreground">{todayLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open("/serial-display", "_blank", "noopener,noreferrer")
            }
            className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50"
            data-ocid="serial.display_button"
          >
            <Monitor className="w-3.5 h-3.5" />
            Display Screen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            data-ocid="serial.reset_button"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Reset Queue
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAddOpen(true)}
            data-ocid="serial.open_modal_button"
          >
            <Plus className="w-4 h-4" />
            Add Serial
          </Button>
        </div>
      </div>

      {/* Count pills */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{counts.waiting}</p>
          <p className="text-xs text-amber-600 mt-0.5">Waiting</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {counts.inProgress}
          </p>
          <p className="text-xs text-blue-600 mt-0.5">In Progress</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{counts.done}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Done</p>
        </div>
      </div>

      {serials.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground"
          data-ocid="serial.empty_state"
        >
          <ListOrdered className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">No patients in queue</p>
          <p className="text-sm mt-1">Add the first serial for today</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm" data-ocid="serial.table">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-12">
                  #
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Patient
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  Phone
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Arrival
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {serials.map((s, idx) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    data-ocid={`serial.row.${idx + 1}`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {s.serial}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {s.patientName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {s.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {s.arrivalTime}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={serialStatusConfig[s.status].className}
                      >
                        {serialStatusConfig[s.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.status === "waiting" && isDoctor && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-blue-600 hover:bg-blue-50 text-xs"
                            onClick={() => updateStatus(s.id, "in-progress")}
                            data-ocid={`serial.secondary_button.${idx + 1}`}
                          >
                            Start
                          </Button>
                        )}
                        {s.status === "in-progress" && isDoctor && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 text-xs"
                            onClick={() => updateStatus(s.id, "done")}
                            data-ocid={`serial.primary_button.${idx + 1}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Done
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteSerial(s.id)}
                          data-ocid={`serial.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Add Serial Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" data-ocid="serial.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-primary" />
              Add Patient to Queue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Patient Name</Label>
              <PatientSearch
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                onSelect={(name, phone) => setForm({ name, phone })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                data-ocid="serial.input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              data-ocid="serial.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={addSerial} data-ocid="serial.submit_button">
              Add to Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirm Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm" data-ocid="serial.modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Reset Today&apos;s Queue?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will clear all {serials.length} serial entries for today.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              data-ocid="serial.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={resetQueue}
              data-ocid="serial.confirm_button"
            >
              Reset Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared WhatsApp sender ───────────────────────────────────────────────────

function sendWhatsApp(appt: AppointmentEntry) {
  const DOCTOR_NUMBERS: Record<string, string> = {
    "Dr. Arman Kabir": "8801751959262",
    "Dr. Samia Shikder": "8801957212210",
  };
  const docName = appt.doctor || "Dr. Arman Kabir";
  const docNum = DOCTOR_NUMBERS[docName] || "8801751959262";
  const dateStr = appt.date
    ? new Date(appt.date).toLocaleDateString("en-BD", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : appt.date;
  const typeLabel =
    appt.appointmentType === "admitted"
      ? "hospital admission"
      : "chamber appointment";
  const msg =
    appt.appointmentType === "admitted"
      ? `Dear ${appt.patientName}, your ${typeLabel} with ${docName} is scheduled for ${dateStr}${appt.visitTime ? ` at ${appt.visitTime}` : ""}${appt.hospitalName ? ` at ${appt.hospitalName}` : ""}${appt.serialNumber ? `. Your daily serial: #${appt.serialNumber}` : ""}. - Dr. Arman Kabir's Care`
      : `Dear ${appt.patientName}, your ${typeLabel} with ${docName} is confirmed on ${dateStr}${appt.time ? ` at ${appt.time}` : ""}${appt.chamber ? ` at ${appt.chamber}` : ""}${appt.serialNumber ? `. Your serial: #${appt.serialNumber}` : ""}. - Dr. Arman Kabir's Care`;
  window.open(
    `https://wa.me/${docNum}?text=${encodeURIComponent(`Appointment confirmed: ${msg}`)}`,
    "_blank",
  );
  const patientPhone = appt.phone?.replace(/[^0-9]/g, "");
  if (patientPhone && patientPhone.length >= 10) {
    setTimeout(
      () =>
        window.open(
          `https://wa.me/${patientPhone}?text=${encodeURIComponent(msg)}`,
          "_blank",
        ),
      800,
    );
  }
  toast.success("WhatsApp confirmation sent to patient & doctor");
}

// ─── Chamber Appointments Tab ─────────────────────────────────────────────────

type ApptFilter = "all" | "today" | "upcoming" | "cancelled";

const CHAMBERS_BY_DOCTOR: Record<string, string[]> = {
  "Dr. Arman Kabir": [
    "University Dental College & Hospital — Moghbazar, Dhaka",
  ],
  "Dr. Samia Shikder": [
    "Dhaka Medical College Hospital — Dept. of Gynae & Obs",
  ],
};

function ChamberAppointmentsTab() {
  const [appointments, setAppointments] =
    useState<AppointmentEntry[]>(loadAppointments);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppointmentEntry | null>(null);
  const [filter, setFilter] = useState<ApptFilter>("all");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [receiptTarget, setReceiptTarget] = useState<AppointmentEntry | null>(
    null,
  );
  // Conflict check state
  const [slotAvailability, setSlotAvailability] =
    useState<SlotAvailability>("unknown");
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const emptyForm = {
    name: "",
    phone: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    reason: "",
    status: "scheduled" as AppointmentStatus,
    doctor: "",
    chamber: "",
    registerNumber: "",
  };
  const [form, setForm] = useState(emptyForm);

  const persist = (data: AppointmentEntry[]) => {
    setAppointments(data);
    saveAppointments(data);
  };

  const handleLookup = (val: string) => {
    setLookupQuery(val);
    setForm((f) => ({ ...f, registerNumber: val }));
    if (!val.trim()) {
      setLookupMsg("");
      return;
    }
    const found = lookupPatientByRegOrPhone(val);
    if (found) {
      setForm((f) => ({
        ...f,
        name: (found.fullName as string) || f.name,
        phone: (found.phone as string) || f.phone,
        registerNumber: val,
      }));
      setLookupMsg(`✓ Found: ${found.fullName}`);
    } else {
      setLookupMsg("Patient not found");
    }
  };

  function openAdd() {
    setForm(emptyForm);
    setLookupQuery("");
    setLookupMsg("");
    setEditTarget(null);
    setSlotAvailability("unknown");
    setConflictInfo(null);
    setAddOpen(true);
  }

  function openEdit(appt: AppointmentEntry) {
    setForm({
      name: appt.patientName,
      phone: appt.phone,
      date: appt.date,
      time: appt.time,
      reason: appt.reason,
      status: appt.status,
      doctor: appt.doctor || "",
      chamber: appt.chamber || "",
      registerNumber: appt.registerNumber || "",
    });
    setLookupQuery(appt.registerNumber || "");
    setLookupMsg("");
    setEditTarget(appt);
    setSlotAvailability("unknown");
    setConflictInfo(null);
    setAddOpen(true);
  }

  /** Run slot conflict check whenever date, time, or doctor changes */
  function checkAndSetSlotAvailability(
    date: string,
    time: string,
    doctor: string,
  ) {
    if (!date || !time || !doctor) {
      setSlotAvailability("unknown");
      setConflictInfo(null);
      return;
    }
    const conflict = checkSlotConflict(
      appointments,
      date,
      time,
      doctor,
      editTarget?.id,
    );
    if (conflict) {
      setSlotAvailability("conflict");
      setConflictInfo(conflict);
    } else {
      setSlotAvailability("available");
      setConflictInfo(null);
    }
  }

  function saveAppointment() {
    if (!form.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    if (!form.date) {
      toast.error("Please select a date");
      return;
    }
    // If there's a conflict and user hasn't acknowledged it yet, show warning
    if (slotAvailability === "conflict" && conflictInfo && !pendingSave) {
      setShowConflictWarning(true);
      return;
    }
    _doSave();
    setPendingSave(false);
  }

  function _doSave() {
    const currentAll = loadAppointments();
    const serial = getOrAssignSerial(currentAll, form.name.trim(), form.date);

    if (editTarget) {
      const updatedEntry = {
        ...editTarget,
        patientName: form.name.trim(),
        phone: form.phone.trim(),
        date: form.date,
        time: form.time,
        reason: form.reason.trim(),
        status: form.status,
        doctor: form.doctor || undefined,
        chamber: form.chamber || undefined,
        registerNumber: form.registerNumber || undefined,
      };
      persist(
        appointments.map((a) => (a.id === editTarget.id ? updatedEntry : a)),
      );
      toast.success("Appointment updated");
      syncAppointmentToCanister("update", updatedEntry);
    } else {
      const entry: AppointmentEntry = {
        id: uid(),
        patientName: form.name.trim(),
        phone: form.phone.trim(),
        date: form.date,
        time: form.time,
        reason: form.reason.trim(),
        status: form.status,
        doctor: form.doctor || undefined,
        chamber: form.chamber || undefined,
        registerNumber: form.registerNumber || undefined,
        appointmentType: "chamber",
        serialNumber: serial,
        serialDate: form.date,
      };
      persist([...appointments, entry]);
      toast.success(
        `Appointment scheduled for ${entry.patientName} — Serial #${serial}`,
      );
      syncAppointmentToCanister("create", entry);
    }
    setAddOpen(false);
  }

  function deleteAppt(id: string) {
    const entry = appointments.find((a) => a.id === id);
    persist(appointments.filter((a) => a.id !== id));
    toast.success("Appointment deleted");
    if (entry) syncAppointmentToCanister("delete", entry);
  }

  const chamberOnly = appointments.filter(
    (a) => !a.appointmentType || a.appointmentType === "chamber",
  );
  const filtered = chamberOnly
    .filter((a) => {
      const today = todayStr();
      if (filter === "today") return a.date === today;
      if (filter === "upcoming")
        return a.date >= today && a.status !== "cancelled";
      if (filter === "cancelled") return a.status === "cancelled";
      return true;
    })
    .sort((a, b) => {
      const dt = (x: AppointmentEntry) => `${x.date}T${x.time || "00:00"}`;
      return dt(a).localeCompare(dt(b));
    });

  const filterLabels: Record<ApptFilter, string> = {
    all: "All",
    today: "Today",
    upcoming: "Upcoming",
    cancelled: "Cancelled",
  };

  const chamberOptions = form.doctor
    ? CHAMBERS_BY_DOCTOR[form.doctor] || []
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(filterLabels) as ApptFilter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilter(f)}
              data-ocid={`chamber_appt.${f}.tab`}
            >
              {filterLabels[f]}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={openAdd}
          data-ocid="chamber_appt.open_modal_button"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground"
          data-ocid="chamber_appt.empty_state"
        >
          <Stethoscope className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">No chamber appointments found</p>
          <p className="text-sm mt-1">
            Schedule a new chamber appointment to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {filtered.map((appt, idx) => (
              <motion.div
                key={appt.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
                data-ocid={`chamber_appt.item.${idx + 1}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {appt.patientName}
                      </span>
                      {appt.registerNumber && (
                        <span className="text-xs font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {appt.registerNumber}
                        </span>
                      )}
                      {appt.serialNumber && (
                        <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5">
                          Serial #{appt.serialNumber}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={apptStatusConfig[appt.status].className}
                      >
                        {apptStatusConfig[appt.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
                      {appt.doctor && (
                        <span className="text-primary font-medium text-xs">
                          {appt.doctor}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {new Date(appt.date).toLocaleDateString("en-BD", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {appt.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {appt.time}
                        </span>
                      )}
                      {appt.phone && <span>{appt.phone}</span>}
                    </div>
                    {appt.chamber && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        📍 {appt.chamber}
                      </p>
                    )}
                    {appt.reason && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                        {appt.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-violet-600 hover:bg-violet-50"
                      title="Generate Receipt"
                      onClick={() => setReceiptTarget(appt)}
                      data-ocid={`chamber_appt.receipt_button.${idx + 1}`}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                      title="Send WhatsApp confirmation"
                      onClick={() => sendWhatsApp(appt)}
                      data-ocid={`chamber_appt.whatsapp_button.${idx + 1}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                    {appt.phone && appt.status !== "cancelled" && (
                      <a
                        href={buildFollowUpMessage(
                          { fullName: appt.patientName, phone: appt.phone },
                          appt.doctor || "Dr. Arman Kabir",
                          appt.chamber || "The Clinic",
                          appt.date
                            ? new Date(appt.date).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : appt.date,
                          appt.time || "",
                        )}
                        target="_blank"
                        rel="noreferrer"
                        title="Send Follow-up Reminder on WhatsApp"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-green-700 hover:bg-green-50 transition-colors"
                        data-ocid={`chamber_appt.followup_reminder.${idx + 1}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 fill-green-600"
                          role="img"
                          aria-label="WhatsApp follow-up reminder"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(appt)}
                      data-ocid={`chamber_appt.edit_button.${idx + 1}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteAppt(appt.id)}
                      data-ocid={`chamber_appt.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Receipt Dialog */}
      {receiptTarget && (
        <MoneyReceipt
          initialData={{
            type: "appointment",
            patientName: receiptTarget.patientName,
            registerNumber: receiptTarget.registerNumber,
            phone: receiptTarget.phone,
            doctorName: receiptTarget.doctor,
            service: "Consultation / পরামর্শ",
            amount: 0,
            paid: false,
            date: receiptTarget.date || new Date().toISOString().slice(0, 10),
            serialNumber: receiptTarget.serialNumber,
          }}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* Conflict Warning Dialog */}
      <Dialog
        open={showConflictWarning}
        onOpenChange={(o) => {
          if (!o) setShowConflictWarning(false);
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          data-ocid="chamber_appt.conflict_dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" />
              Appointment Conflict
            </DialogTitle>
          </DialogHeader>
          {conflictInfo && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {conflictInfo.doctorName}
              </span>{" "}
              already has an appointment at{" "}
              <span className="font-semibold text-amber-700">
                {conflictInfo.conflictingTime}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {conflictInfo.conflictingPatient}
              </span>
              . This is within 15 minutes of your selected time.
            </p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConflictWarning(false)}
              data-ocid="chamber_appt.conflict_choose_time_button"
            >
              Choose Different Time
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setShowConflictWarning(false);
                setPendingSave(true);
                // Directly do the save since we already confirmed
                _doSave();
              }}
              data-ocid="chamber_appt.conflict_book_anyway_button"
            >
              Book Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg" data-ocid="chamber_appt.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              {editTarget
                ? "Edit Chamber Appointment"
                : "New Chamber Appointment"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Search Patient (Reg No. or Mobile)</Label>
              <div className="relative">
                <Input
                  placeholder="0001/26 or 01XXXXXXXXX — auto-fills details"
                  value={lookupQuery}
                  onChange={(e) => handleLookup(e.target.value)}
                  className="pr-8"
                  data-ocid="chamber_appt.lookup_input"
                />
                <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              </div>
              {lookupMsg && (
                <p
                  className={`text-xs font-medium ${lookupMsg.startsWith("✓") ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {lookupMsg}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Patient Name</Label>
              <PatientSearch
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                onSelect={(name, phone) =>
                  setForm((f) => ({ ...f, name, phone }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                data-ocid="chamber_appt.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preferred Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setForm((f) => ({ ...f, date: newDate }));
                    checkAndSetSlotAvailability(
                      newDate,
                      form.time,
                      form.doctor,
                    );
                  }}
                  data-ocid="chamber_appt.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Preferred Time
                  {/* Slot availability indicator */}
                  {form.time && form.doctor && (
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        slotAvailability === "available"
                          ? "bg-emerald-100 text-emerald-700"
                          : slotAvailability === "conflict"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {slotAvailability === "available"
                        ? "🟢 Available"
                        : slotAvailability === "conflict"
                          ? "🟡 Conflict"
                          : ""}
                    </span>
                  )}
                </Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => {
                    const newTime = e.target.value;
                    setForm((f) => ({ ...f, time: newTime }));
                    checkAndSetSlotAvailability(
                      form.date,
                      newTime,
                      form.doctor,
                    );
                  }}
                  onBlur={() =>
                    checkAndSetSlotAvailability(
                      form.date,
                      form.time,
                      form.doctor,
                    )
                  }
                  data-ocid="chamber_appt.input"
                />
                {slotAvailability === "conflict" && conflictInfo && (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {conflictInfo.doctorName} already has an appointment at{" "}
                    {conflictInfo.conflictingTime} for{" "}
                    {conflictInfo.conflictingPatient}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select
                value={form.doctor}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, doctor: v, chamber: "" }));
                  checkAndSetSlotAvailability(form.date, form.time, v);
                }}
              >
                <SelectTrigger data-ocid="chamber_appt.select">
                  <SelectValue placeholder="Select doctor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dr. Arman Kabir">
                    Dr. Arman Kabir
                  </SelectItem>
                  <SelectItem value="Dr. Samia Shikder">
                    Dr. Samia Shikder
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {chamberOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Preferred Chamber</Label>
                <Select
                  value={form.chamber}
                  onValueChange={(v) => setForm((f) => ({ ...f, chamber: v }))}
                >
                  <SelectTrigger data-ocid="chamber_appt.select">
                    <SelectValue placeholder="Select chamber" />
                  </SelectTrigger>
                  <SelectContent>
                    {chamberOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Reason / Notes</Label>
              <Textarea
                placeholder="Reason for visit or notes…"
                className="resize-none"
                rows={2}
                value={form.reason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reason: e.target.value }))
                }
                data-ocid="chamber_appt.textarea"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as AppointmentStatus }))
                }
              >
                <SelectTrigger data-ocid="chamber_appt.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              data-ocid="chamber_appt.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={saveAppointment}
              data-ocid="chamber_appt.submit_button"
            >
              {editTarget ? "Save Changes" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Admitted Patients Tab ────────────────────────────────────────────────────

function AdmittedPatientsTab() {
  const [appointments, setAppointments] =
    useState<AppointmentEntry[]>(loadAppointments);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppointmentEntry | null>(null);
  const [timePickerTarget, setTimePickerTarget] =
    useState<AppointmentEntry | null>(null);
  const [timePickerVal, setTimePickerVal] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [receiptTarget, setReceiptTarget] = useState<AppointmentEntry | null>(
    null,
  );
  // Conflict check state for admitted track
  const [admSlotAvailability, setAdmSlotAvailability] =
    useState<SlotAvailability>("unknown");
  const [admConflictInfo, setAdmConflictInfo] = useState<ConflictInfo | null>(
    null,
  );
  const [admShowConflictWarning, setAdmShowConflictWarning] = useState(false);
  const [admPendingSave, setAdmPendingSave] = useState(false);

  const { currentDoctor } = useEmailAuth();
  const isDoctor =
    !currentDoctor ||
    currentDoctor.role === "doctor" ||
    (currentDoctor as unknown as Record<string, string>).role ===
      "consultant_doctor" ||
    (currentDoctor as unknown as Record<string, string>).role ===
      "medical_officer";

  const emptyForm = {
    name: "",
    phone: "",
    admissionDate: new Date().toISOString().slice(0, 10),
    hospitalName: "",
    bedWardNumber: "",
    admissionReason: "",
    referringDoctor: "",
    doctor: "",
    registerNumber: "",
    status: "scheduled" as AppointmentStatus,
  };
  const [form, setForm] = useState(emptyForm);

  const persist = (data: AppointmentEntry[]) => {
    setAppointments(data);
    saveAppointments(data);
  };

  const handleLookup = (val: string) => {
    setLookupQuery(val);
    setForm((f) => ({ ...f, registerNumber: val }));
    if (!val.trim()) {
      setLookupMsg("");
      return;
    }
    const found = lookupPatientByRegOrPhone(val);
    if (found) {
      setForm((f) => ({
        ...f,
        name: (found.fullName as string) || f.name,
        phone: (found.phone as string) || f.phone,
        registerNumber: val,
      }));
      setLookupMsg(`✓ Found: ${found.fullName}`);
    } else {
      setLookupMsg("Patient not found");
    }
  };

  function openAdd() {
    setForm(emptyForm);
    setLookupQuery("");
    setLookupMsg("");
    setEditTarget(null);
    setAdmSlotAvailability("unknown");
    setAdmConflictInfo(null);
    setAddOpen(true);
  }

  function openEdit(appt: AppointmentEntry) {
    setForm({
      name: appt.patientName,
      phone: appt.phone,
      admissionDate: appt.date,
      hospitalName: appt.hospitalName || "",
      bedWardNumber: appt.bedWardNumber || "",
      admissionReason: appt.admissionReason || "",
      referringDoctor: appt.referringDoctor || "",
      doctor: appt.doctor || "",
      registerNumber: appt.registerNumber || "",
      status: appt.status,
    });
    setLookupQuery(appt.registerNumber || "");
    setLookupMsg("");
    setEditTarget(appt);
    setAdmSlotAvailability("unknown");
    setAdmConflictInfo(null);
    setAddOpen(true);
  }

  /** Check admitted slot conflict (uses visitTime field if present, date otherwise) */
  function checkAdmittedSlotConflict(date: string, doctor: string) {
    if (!date || !doctor) {
      setAdmSlotAvailability("unknown");
      setAdmConflictInfo(null);
      return;
    }
    // For admitted track — conflict is same doctor + same date (no time granularity needed unless visitTime set)
    const conflict = checkSlotConflict(
      appointments.filter((a) => a.appointmentType === "admitted"),
      date,
      "12:00", // default noon for date-only check
      doctor,
      editTarget?.id,
    );
    if (conflict) {
      setAdmSlotAvailability("conflict");
      setAdmConflictInfo(conflict);
    } else {
      setAdmSlotAvailability("available");
      setAdmConflictInfo(null);
    }
  }

  function saveAppointment() {
    if (!form.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    if (!form.admissionDate) {
      toast.error("Please select an admission date");
      return;
    }
    // Conflict check — show warning if conflict and not yet acknowledged
    if (
      admSlotAvailability === "conflict" &&
      admConflictInfo &&
      !admPendingSave
    ) {
      setAdmShowConflictWarning(true);
      return;
    }
    _doAdmSave();
    setAdmPendingSave(false);
  }

  function _doAdmSave() {
    const currentAll = loadAppointments();
    const serial = getOrAssignSerial(
      currentAll,
      form.name.trim(),
      form.admissionDate,
    );

    if (editTarget) {
      const updatedEntry = {
        ...editTarget,
        patientName: form.name.trim(),
        phone: form.phone.trim(),
        date: form.admissionDate,
        hospitalName: form.hospitalName,
        bedWardNumber: form.bedWardNumber,
        admissionReason: form.admissionReason,
        referringDoctor: form.referringDoctor,
        doctor: form.doctor || undefined,
        registerNumber: form.registerNumber || undefined,
        status: form.status,
      };
      persist(
        appointments.map((a) => (a.id === editTarget.id ? updatedEntry : a)),
      );
      toast.success("Admission appointment updated");
      syncAppointmentToCanister("update", updatedEntry);
    } else {
      const entry: AppointmentEntry = {
        id: uid(),
        patientName: form.name.trim(),
        phone: form.phone.trim(),
        date: form.admissionDate,
        time: "",
        reason: form.admissionReason,
        status: form.status,
        doctor: form.doctor || undefined,
        registerNumber: form.registerNumber || undefined,
        appointmentType: "admitted",
        hospitalName: form.hospitalName,
        bedWardNumber: form.bedWardNumber,
        admissionReason: form.admissionReason,
        referringDoctor: form.referringDoctor,
        serialNumber: serial,
        serialDate: form.admissionDate,
      };
      persist([...appointments, entry]);
      toast.success(
        `Admission scheduled for ${entry.patientName} — Daily Serial #${serial}`,
      );
      syncAppointmentToCanister("create", entry);
    }
    setAddOpen(false);
  }

  function saveVisitTime() {
    if (!timePickerTarget) return;
    const updated = appointments.map((a) =>
      a.id === timePickerTarget.id ? { ...a, visitTime: timePickerVal } : a,
    );
    persist(updated);
    const entry = updated.find((a) => a.id === timePickerTarget.id);
    setTimePickerTarget(null);
    toast.success(`Visit time set to ${timePickerVal}`);
    if (entry) syncAppointmentToCanister("update", entry);
  }

  // Auto-generate today's admission slot for admitted patients from visit form
  useEffect(() => {
    const today = todayStr();
    const admittedVisitKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith("visits_"),
    );
    const currentAll = loadAppointments();
    let needsPersist = false;
    const updated = [...currentAll];
    for (const key of admittedVisitKeys) {
      try {
        const visits = JSON.parse(localStorage.getItem(key) || "[]");
        for (const visit of visits) {
          if (visit.visitType !== "admitted" && visit.isAdmitted !== true)
            continue;
          // Find the patient
          const patKey = key.replace("visits_", "patients_");
          const patients = JSON.parse(localStorage.getItem(patKey) || "[]");
          const patient = patients.find(
            (p: PatientLookup) => String(p.id) === String(visit.patientId),
          );
          if (!patient) continue;
          // Check if today's admission slot exists
          const exists = updated.some(
            (a) =>
              a.appointmentType === "admitted" &&
              a.date === today &&
              a.patientName.trim().toLowerCase() ===
                (patient.fullName || "").trim().toLowerCase(),
          );
          if (!exists) {
            const serial = getOrAssignSerial(updated, patient.fullName, today);
            updated.push({
              id: uid(),
              patientName: patient.fullName,
              phone: patient.phone || "",
              date: today,
              time: "",
              reason: "Daily admitted patient round",
              status: "scheduled",
              doctor: "",
              registerNumber: patient.registerNumber,
              appointmentType: "admitted",
              hospitalName: "",
              serialNumber: serial,
              serialDate: today,
            });
            needsPersist = true;
          }
        }
      } catch {}
    }
    if (needsPersist) {
      setAppointments(updated);
      saveAppointments(updated);
    }
  }, []); // Run once on mount to auto-populate admitted slots

  const admittedOnly = appointments.filter(
    (a) => a.appointmentType === "admitted",
  );
  const todayAdmitted = admittedOnly.filter((a) => a.date === todayStr());
  const otherAdmitted = admittedOnly
    .filter((a) => a.date !== todayStr())
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Today&apos;s admitted patients receive daily appointment slots.
            Doctor sets the visit time.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          onClick={openAdd}
          data-ocid="admitted_appt.open_modal_button"
        >
          <Plus className="w-4 h-4" />
          Add Admission
        </Button>
      </div>

      {/* Today's slots */}
      {todayAdmitted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-primary" />
            Today —{" "}
            {new Date().toLocaleDateString("en-BD", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-rose-50/60">
                  <TableHead className="font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Patient</TableHead>
                  <TableHead className="font-semibold hidden sm:table-cell">
                    Register No.
                  </TableHead>
                  <TableHead className="font-semibold">Visit Time</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">
                    Hospital / Ward
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayAdmitted.map((appt, idx) => (
                  <TableRow
                    key={appt.id}
                    data-ocid={`admitted_appt.today.row.${idx + 1}`}
                  >
                    <TableCell>
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs">
                        {appt.serialNumber || idx + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {appt.patientName}
                      </p>
                      {appt.phone && (
                        <p className="text-xs text-muted-foreground">
                          {appt.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs font-mono text-muted-foreground">
                        {appt.registerNumber || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {appt.visitTime ? (
                        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {appt.visitTime}
                          {isDoctor && (
                            <button
                              type="button"
                              className="ml-1 p-0.5 hover:text-primary"
                              onClick={() => {
                                setTimePickerTarget(appt);
                                setTimePickerVal(appt.visitTime || "");
                              }}
                              aria-label="Change visit time"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ) : isDoctor ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => {
                            setTimePickerTarget(appt);
                            setTimePickerVal("");
                          }}
                          data-ocid={`admitted_appt.set_time_button.${idx + 1}`}
                        >
                          <Clock className="w-3 h-3" /> Set Time
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs text-muted-foreground">
                        {appt.hospitalName || "—"}
                      </p>
                      {appt.bedWardNumber && (
                        <p className="text-xs text-muted-foreground">
                          Ward: {appt.bedWardNumber}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={apptStatusConfig[appt.status].className}
                      >
                        {apptStatusConfig[appt.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-violet-600 hover:bg-violet-50"
                          title="Generate Receipt"
                          onClick={() => setReceiptTarget(appt)}
                          data-ocid={`admitted_appt.receipt_button.${idx + 1}`}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                          title="Send WhatsApp"
                          onClick={() => sendWhatsApp(appt)}
                          data-ocid={`admitted_appt.whatsapp_button.${idx + 1}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => openEdit(appt)}
                          data-ocid={`admitted_appt.edit_button.${idx + 1}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Other dates */}
      {otherAdmitted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            Other Admissions
          </h3>
          <div className="grid gap-3">
            {otherAdmitted.map((appt, idx) => (
              <motion.div
                key={appt.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
                data-ocid={`admitted_appt.other.item.${idx + 1}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {appt.patientName}
                      </span>
                      {appt.registerNumber && (
                        <span className="text-xs font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {appt.registerNumber}
                        </span>
                      )}
                      {appt.serialNumber && (
                        <span className="text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 rounded px-1.5 py-0.5">
                          Serial #{appt.serialNumber}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={apptStatusConfig[appt.status].className}
                      >
                        {apptStatusConfig[appt.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
                      {appt.doctor && (
                        <span className="text-primary font-medium text-xs">
                          {appt.doctor}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {new Date(appt.date).toLocaleDateString("en-BD", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {appt.hospitalName && (
                        <span className="flex items-center gap-1">
                          <Hospital className="w-3.5 h-3.5" />
                          {appt.hospitalName}
                        </span>
                      )}
                      {appt.bedWardNumber && (
                        <span className="flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5" />
                          Ward: {appt.bedWardNumber}
                        </span>
                      )}
                    </div>
                    {appt.admissionReason && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                        {appt.admissionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                      title="Send WhatsApp confirmation"
                      onClick={() => sendWhatsApp(appt)}
                      data-ocid={`admitted_appt.whatsapp_button.other.${idx + 1}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                    {appt.phone && appt.status !== "cancelled" && (
                      <a
                        href={buildFollowUpMessage(
                          { fullName: appt.patientName, phone: appt.phone },
                          appt.doctor || "Dr. Arman Kabir",
                          appt.hospitalName || "Hospital",
                          new Date(appt.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }),
                          appt.visitTime || appt.time || "",
                        )}
                        target="_blank"
                        rel="noreferrer"
                        title="Send Follow-up Reminder on WhatsApp"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-green-700 hover:bg-green-50 transition-colors"
                        data-ocid={`admitted_appt.followup_reminder.other.${idx + 1}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 fill-green-600"
                          role="img"
                          aria-label="WhatsApp follow-up reminder"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(appt)}
                      data-ocid={`admitted_appt.edit_button.other.${idx + 1}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {admittedOnly.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground"
          data-ocid="admitted_appt.empty_state"
        >
          <BedDouble className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">No admitted patients found</p>
          <p className="text-sm mt-1">
            Admitted patient slots appear here automatically from visit forms
          </p>
        </div>
      )}

      {/* Admitted Receipt Dialog */}
      {receiptTarget && (
        <MoneyReceipt
          initialData={{
            type: "appointment",
            patientName: receiptTarget.patientName,
            registerNumber: receiptTarget.registerNumber,
            phone: receiptTarget.phone,
            doctorName: receiptTarget.doctor,
            service: "Hospital Consultation / হাসপাতাল পরামর্শ",
            amount: 0,
            paid: false,
            date: receiptTarget.date || new Date().toISOString().slice(0, 10),
            serialNumber: receiptTarget.serialNumber,
            notes: receiptTarget.hospitalName
              ? `Hospital: ${receiptTarget.hospitalName}`
              : undefined,
          }}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* Time picker dialog (doctor-only) */}
      <Dialog
        open={!!timePickerTarget}
        onOpenChange={(o) => !o && setTimePickerTarget(null)}
      >
        <DialogContent
          className="sm:max-w-xs"
          data-ocid="admitted_appt.time_dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Set Visit Time
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set the visit time for{" "}
            <strong>{timePickerTarget?.patientName}</strong>
          </p>
          <Input
            type="time"
            value={timePickerVal}
            onChange={(e) => setTimePickerVal(e.target.value)}
            className="text-lg h-12"
            data-ocid="admitted_appt.time_input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimePickerTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveVisitTime}
              disabled={!timePickerVal}
              data-ocid="admitted_appt.time_save_button"
            >
              Set Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Admission Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg" data-ocid="admitted_appt.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-rose-600" />
              {editTarget ? "Edit Admission" : "New Hospital Admission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Search Patient (Reg No. or Mobile)</Label>
              <div className="relative">
                <Input
                  placeholder="0001/26 or 01XXXXXXXXX — auto-fills details"
                  value={lookupQuery}
                  onChange={(e) => handleLookup(e.target.value)}
                  className="pr-8"
                  data-ocid="admitted_appt.lookup_input"
                />
                <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              </div>
              {lookupMsg && (
                <p
                  className={`text-xs font-medium ${lookupMsg.startsWith("✓") ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {lookupMsg}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Patient Name</Label>
              <PatientSearch
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                onSelect={(name, phone) =>
                  setForm((f) => ({ ...f, name, phone }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                data-ocid="admitted_appt.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Admission Date</Label>
              <Input
                type="date"
                value={form.admissionDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setForm((f) => ({ ...f, admissionDate: newDate }));
                  checkAdmittedSlotConflict(newDate, form.doctor);
                }}
                data-ocid="admitted_appt.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hospital Name</Label>
                <Input
                  placeholder="e.g. DMCH"
                  value={form.hospitalName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hospitalName: e.target.value }))
                  }
                  data-ocid="admitted_appt.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bed / Ward (optional)</Label>
                <Input
                  placeholder="e.g. Ward 7, Bed 12"
                  value={form.bedWardNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bedWardNumber: e.target.value }))
                  }
                  data-ocid="admitted_appt.input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Referring Doctor (optional)</Label>
              <Input
                placeholder="Referring doctor name"
                value={form.referringDoctor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referringDoctor: e.target.value }))
                }
                data-ocid="admitted_appt.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select
                value={form.doctor}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, doctor: v }));
                  checkAdmittedSlotConflict(form.admissionDate, v);
                }}
              >
                <SelectTrigger data-ocid="admitted_appt.select">
                  <SelectValue placeholder="Select doctor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dr. Arman Kabir">
                    Dr. Arman Kabir
                  </SelectItem>
                  <SelectItem value="Dr. Samia Shikder">
                    Dr. Samia Shikder
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Admission Reason</Label>
              <Textarea
                placeholder="Reason for admission…"
                className="resize-none"
                rows={2}
                value={form.admissionReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, admissionReason: e.target.value }))
                }
                data-ocid="admitted_appt.textarea"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as AppointmentStatus }))
                }
              >
                <SelectTrigger data-ocid="admitted_appt.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              data-ocid="admitted_appt.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={saveAppointment}
              className="bg-rose-600 hover:bg-rose-700"
              data-ocid="admitted_appt.submit_button"
            >
              {editTarget ? "Save Changes" : "Add Admission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admitted Conflict Warning Dialog */}
      <Dialog
        open={admShowConflictWarning}
        onOpenChange={(o) => {
          if (!o) setAdmShowConflictWarning(false);
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          data-ocid="admitted_appt.conflict_dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" />
              Admission Scheduling Conflict
            </DialogTitle>
          </DialogHeader>
          {admConflictInfo && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {admConflictInfo.doctorName}
              </span>{" "}
              already has an admitted patient scheduled around{" "}
              <span className="font-semibold text-amber-700">
                {admConflictInfo.conflictingTime}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {admConflictInfo.conflictingPatient}
              </span>
              . Please choose a different date or proceed anyway.
            </p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setAdmShowConflictWarning(false)}
              data-ocid="admitted_appt.conflict_choose_time_button"
            >
              Choose Different Date
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setAdmShowConflictWarning(false);
                setAdmPendingSave(true);
                _doAdmSave();
              }}
              data-ocid="admitted_appt.conflict_book_anyway_button"
            >
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Public Booking Requests ─────────────────────────────────────────────────

interface PublicBooking {
  id: string;
  patientName: string;
  phone: string;
  doctor: string;
  date?: string;
  preferredDate?: string;
  preferredTime?: string;
  time?: string;
  reason?: string;
  submittedAt: string;
  status: "pending" | "confirmed" | "cancelled";
  registerNumber?: string;
  chamber?: string;
  preferredChamber?: string;
  appointmentType?: AppointmentType;
}

function loadPublicBookings(): PublicBooking[] {
  try {
    return JSON.parse(
      localStorage.getItem("public_appointment_requests") || "[]",
    );
  } catch {
    return [];
  }
}

function savePublicBookings(data: PublicBooking[]) {
  localStorage.setItem("public_appointment_requests", JSON.stringify(data));
}

function PublicBookingRequestsTab() {
  const [bookings, setBookings] = useState<PublicBooking[]>(loadPublicBookings);
  const [confirmingBooking, setConfirmingBooking] =
    useState<PublicBooking | null>(null);
  const createPatient = useCreatePatient();

  const persistBookings = (updated: PublicBooking[]) => {
    setBookings(updated);
    savePublicBookings(updated);
  };

  const markConfirmed = (id: string) => {
    persistBookings(
      bookings.map((b) => (b.id === id ? { ...b, status: "confirmed" } : b)),
    );
  };

  const cancelBooking = (id: string) => {
    persistBookings(
      bookings.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
    );
    toast.success("Booking cancelled.");
  };

  const handlePatientRegister = (data: PatientFormData) => {
    if (!confirmingBooking) return;
    createPatient.mutate(data, {
      onSuccess: () => {
        markConfirmed(confirmingBooking.id);
        toast.success(
          `Appointment confirmed and ${data.fullName} registered as a patient.`,
        );
        setConfirmingBooking(null);
      },
      onError: () => {
        toast.error("Failed to register patient. Please try again.");
      },
    });
  };

  const statusBadge = (status: PublicBooking["status"]) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <>
      {bookings.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
          data-ocid="public_bookings.empty_state"
        >
          <Inbox className="w-10 h-10 opacity-40" />
          <p className="text-sm">No public booking requests yet.</p>
        </div>
      ) : (
        <div className="space-y-4" data-ocid="public_bookings.table">
          <p className="text-sm text-muted-foreground">
            {bookings.length} request{bookings.length !== 1 ? "s" : ""} from the
            public booking form.
          </p>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b, idx) => (
                  <TableRow
                    key={b.id}
                    data-ocid={`public_bookings.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium">
                      <div>
                        {b.patientName}
                        {b.registerNumber && (
                          <p className="text-xs font-mono text-muted-foreground">
                            {b.registerNumber}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {b.phone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          b.appointmentType === "admitted"
                            ? "bg-rose-100 text-rose-700 border-rose-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }
                      >
                        {b.appointmentType === "admitted"
                          ? "Admitted"
                          : "Chamber"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{b.doctor}</TableCell>
                    <TableCell className="text-sm">
                      {b.preferredDate || b.date || "—"}
                      {(b.preferredTime || b.time) && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {b.preferredTime || b.time}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                      {b.preferredChamber || b.chamber || "—"}
                    </TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {b.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1"
                            onClick={() => setConfirmingBooking(b)}
                            data-ocid={`public_bookings.confirm_button.${idx + 1}`}
                          >
                            <UserPlus className="w-3 h-3" /> Confirm
                          </Button>
                        )}
                        {b.status === "confirmed" && (
                          <span className="text-xs text-green-700 font-medium">
                            Registered
                          </span>
                        )}
                        {b.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => cancelBooking(b.id)}
                            data-ocid={`public_bookings.delete_button.${idx + 1}`}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog
        open={!!confirmingBooking}
        onOpenChange={(open) => {
          if (!open) setConfirmingBooking(null);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="public_bookings.register_dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Register Patient &amp; Confirm Appointment
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Pre-filled from the booking request. Complete the details and save
              to confirm.
            </p>
          </DialogHeader>
          {confirmingBooking && (
            <PatientForm
              prefill={{
                fullName: confirmingBooking.patientName,
                phone: confirmingBooking.phone,
              }}
              onSubmit={handlePatientRegister}
              onCancel={() => setConfirmingBooking(null)}
              isLoading={createPatient.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Appointments() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Appointments
            </h1>
            <p className="text-sm text-muted-foreground">
              Doctor serial, chamber appointments, hospital admissions &amp;
              public requests
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="serial" className="space-y-5">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger
            value="serial"
            className="gap-2"
            data-ocid="appointments.serial.tab"
          >
            <ListOrdered className="w-4 h-4" />
            Doctor Serial
          </TabsTrigger>
          <TabsTrigger
            value="chamber"
            className="gap-2"
            data-ocid="appointments.chamber.tab"
          >
            <Stethoscope className="w-4 h-4" />
            Chamber Patients
          </TabsTrigger>
          <TabsTrigger
            value="admitted"
            className="gap-2"
            data-ocid="appointments.admitted.tab"
          >
            <BedDouble className="w-4 h-4" />
            Admitted Patients
          </TabsTrigger>
          <TabsTrigger
            value="public"
            className="gap-2"
            data-ocid="appointments.public.tab"
          >
            <Inbox className="w-4 h-4" />
            Public Requests
          </TabsTrigger>
          <TabsTrigger
            value="receipts"
            className="gap-2"
            data-ocid="appointments.receipts.tab"
          >
            <Receipt className="w-4 h-4" />
            Receipts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="serial" className="mt-0">
          <DoctorSerialTab />
        </TabsContent>

        <TabsContent value="chamber" className="mt-0">
          <ChamberAppointmentsTab />
        </TabsContent>

        <TabsContent value="admitted" className="mt-0">
          <AdmittedPatientsTab />
        </TabsContent>

        <TabsContent value="public" className="mt-0">
          <PublicBookingRequestsTab />
        </TabsContent>

        <TabsContent value="receipts" className="mt-0">
          <ReceiptsHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
