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
import { ScrollArea } from "@/components/ui/scroll-area";
import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeftRight,
  Bed,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getCanisterActor,
  loadFromAllDoctorKeys,
  useAssignBed,
  useCreateBedRecord,
  useGetAllBeds,
} from "../hooks/useQueries";
import { getClinicalStore, saveClinicalStore } from "../lib/clinicalStore";
import { saveClinicalEntitiesWithSync } from "../lib/hybridStorage";
import type { BedRecord, BedType, Patient } from "../types";

// ── Bed Type config ──────────────────────────────────────────────────────────
const BED_TYPES: BedType[] = [
  "General",
  "ICU",
  "HDU",
  "Isolation",
  "Private",
  "Cabin",
];

const BED_TYPE_CONFIG: Record<
  BedType,
  { label: string; badge: string; dot: string }
> = {
  General: {
    label: "General",
    badge: "bg-slate-100 text-slate-600 border-slate-300",
    dot: "bg-slate-400",
  },
  ICU: {
    label: "ICU",
    badge: "bg-red-100 text-red-700 border-red-300",
    dot: "bg-red-500",
  },
  HDU: {
    label: "HDU",
    badge: "bg-orange-100 text-orange-700 border-orange-300",
    dot: "bg-orange-500",
  },
  Isolation: {
    label: "Isolation",
    badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
    dot: "bg-yellow-500",
  },
  Private: {
    label: "Private",
    badge: "bg-teal-100 text-teal-700 border-teal-300",
    dot: "bg-teal-500",
  },
  Cabin: {
    label: "Cabin",
    badge: "bg-purple-100 text-purple-700 border-purple-300",
    dot: "bg-purple-500",
  },
};

// ── Seed demo beds ───────────────────────────────────────────────────────────
function seedBedsIfEmpty() {
  const store = getClinicalStore();
  if ((store.beds as BedRecord[] | undefined)?.length) return;
  const seeds: BedRecord[] = [
    {
      id: 1n,
      bedNumber: "G-01",
      ward: "General",
      floor: "Ground Floor",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "General",
      status: "Empty",
      transferHistory: [],
    },
    {
      id: 2n,
      bedNumber: "G-02",
      ward: "General",
      floor: "Ground Floor",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "General",
      status: "Occupied",
      patientName: "Rahim Uddin",
      admissionDate: BigInt(Date.now() - 86400000 * 2) * 1_000_000n,
      transferHistory: [],
    },
    {
      id: 3n,
      bedNumber: "M-01",
      ward: "Medical",
      floor: "Floor 1",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "General",
      status: "Empty",
      transferHistory: [],
    },
    {
      id: 4n,
      bedNumber: "M-02",
      ward: "Medical",
      floor: "Floor 1",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "General",
      status: "Maintenance",
      transferHistory: [],
    },
    {
      id: 5n,
      bedNumber: "ICU-01",
      ward: "ICU",
      floor: "Floor 2",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "ICU",
      status: "Occupied",
      patientName: "Karim Hossain",
      admissionDate: BigInt(Date.now() - 86400000) * 1_000_000n,
      transferHistory: [],
    },
    {
      id: 6n,
      bedNumber: "ICU-02",
      ward: "ICU",
      floor: "Floor 2",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "ICU",
      status: "Cleaning",
      transferHistory: [],
    },
    {
      id: 7n,
      bedNumber: "ICU-03",
      ward: "ICU",
      floor: "Floor 2",
      hospitalName: "Dhaka Medical College Hospital",
      bedType: "HDU",
      status: "Reserved",
      reservedForPatient: "Nadia Islam",
      reservationExpiry: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
      transferHistory: [],
    },
    {
      id: 8n,
      bedNumber: "C-01",
      ward: "Chamber",
      floor: "Ground Floor",
      hospitalName: "Dr. Arman Kabir Chamber",
      bedType: "Private",
      status: "Empty",
      transferHistory: [],
    },
    {
      id: 9n,
      bedNumber: "C-02",
      ward: "Chamber",
      floor: "Ground Floor",
      hospitalName: "Dr. Arman Kabir Chamber",
      bedType: "Cabin",
      status: "Occupied",
      patientName: "Sumaiya Begum",
      admissionDate: BigInt(Date.now() - 3600000) * 1_000_000n,
      transferHistory: [],
    },
    {
      id: 10n,
      bedNumber: "OBS-01",
      ward: "Observation",
      floor: "Floor 1",
      hospitalName: "Dr. Arman Kabir Chamber",
      bedType: "Isolation",
      status: "Empty",
      transferHistory: [],
    },
  ];
  store.beds = seeds as unknown[];
  saveClinicalStore(store);
}

// ── Status helpers ───────────────────────────────────────────────────────────
type BedStatus = BedRecord["status"];

const STATUS_CONFIG: Record<
  BedStatus,
  { cell: string; label: string; dot: string; badge: string; card: string }
> = {
  Empty: {
    cell: "bg-green-500 border-green-600",
    label: "Available",
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700",
    card: "bg-green-50 border-green-300 text-green-900",
  },
  Occupied: {
    cell: "bg-red-600 border-red-700",
    label: "Occupied",
    dot: "bg-red-600",
    badge: "bg-red-100 text-red-700",
    card: "bg-red-50 border-red-300 text-red-900",
  },
  Maintenance: {
    cell: "bg-gray-400 border-gray-500",
    label: "Maintenance",
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-700",
    card: "bg-gray-50 border-gray-300 text-gray-900",
  },
  Reserved: {
    cell: "bg-amber-500 border-amber-600",
    label: "Reserved",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
    card: "bg-amber-50 border-amber-300 text-amber-900",
  },
  Cleaning: {
    cell: "bg-slate-500 border-slate-600",
    label: "Cleaning",
    dot: "bg-slate-500",
    badge: "bg-slate-200 text-slate-600",
    card: "bg-slate-100 border-slate-300 text-slate-700",
  },
};

function statusCfg(status: BedStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.Empty;
}

function formatTs(ts?: bigint) {
  if (!ts) return "—";
  return format(new Date(Number(ts / 1_000_000n)), "d MMM yyyy");
}

function daysAdmitted(admissionDate?: bigint): number {
  if (!admissionDate) return 0;
  return differenceInDays(
    new Date(),
    new Date(Number(admissionDate / 1_000_000n)),
  );
}

function isCurrentMonth(ts?: bigint): boolean {
  if (!ts) return false;
  const d = new Date(Number(ts / 1_000_000n));
  const now = new Date();
  return (
    d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  );
}

const WARDS = [
  "General",
  "Medical",
  "Surgical",
  "ICU",
  "Pediatric",
  "Gynae",
  "Ortho",
  "Chamber",
  "Observation",
  "Other",
];

// ── Reservation Countdown ────────────────────────────────────────────────────
function useReservationCountdown(expiry: string | null | undefined) {
  const [remaining, setRemaining] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [isLow, setIsLow] = useState(false);

  useEffect(() => {
    if (!expiry) return;
    function tick() {
      const ms = new Date(expiry!).getTime() - Date.now();
      if (ms <= 0) {
        setIsExpired(true);
        setRemaining("Expired");
        return;
      }
      setIsExpired(false);
      const totalMin = Math.floor(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setRemaining(h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`);
      setIsLow(ms < 30 * 60 * 1000); // < 30 minutes
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiry]);

  return { remaining, isExpired, isLow };
}

// ── Stats Panel ──────────────────────────────────────────────────────────────
function StatsPanel({ beds }: { beds: BedRecord[] }) {
  const total = beds.length;
  const occupied = beds.filter((b) => b.status === "Occupied").length;
  const available = beds.filter((b) => b.status === "Empty").length;
  const cleaning = beds.filter((b) => b.status === "Cleaning").length;
  const reserved = beds.filter((b) => b.status === "Reserved").length;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const occupiedBeds = beds.filter((b) => b.status === "Occupied");
  const _avgDays =
    occupiedBeds.length > 0
      ? Math.round(
          occupiedBeds.reduce(
            (sum, b) => sum + daysAdmitted(b.admissionDate),
            0,
          ) / occupiedBeds.length,
        )
      : 0;
  const thisMonthAdmissions = beds.filter((b) =>
    isCurrentMonth(b.admissionDate),
  ).length;
  const occupancyColor =
    occupancyPct > 80
      ? "text-red-600"
      : occupancyPct >= 50
        ? "text-amber-600"
        : "text-green-600";

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      data-ocid="bed_management.stats.panel"
    >
      {[
        {
          value: `${occupancyPct}%`,
          label: "Occupancy",
          sub: `${occupied}/${total} beds`,
          color: occupancyColor,
        },
        {
          value: available,
          label: "Available",
          sub: "ready to assign",
          color: "text-green-600",
        },
        {
          value: occupied,
          label: "Occupied",
          sub: "active patients",
          color: "text-red-600",
        },
        {
          value: reserved,
          label: "Reserved",
          sub: "pre-assigned",
          color: "text-amber-600",
        },
        {
          value: cleaning,
          label: "Cleaning",
          sub: "needs ready mark",
          color: "text-slate-600",
        },
        {
          value: thisMonthAdmissions,
          label: "This Month",
          sub: "new admissions",
          color: "text-purple-600",
        },
      ].map(({ value, label, sub, color }) => (
        <div
          key={label}
          className="rounded-xl border px-3 py-3 bg-card border-border"
          data-ocid="bed_management.card"
        >
          <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
          <p className="text-xs font-semibold mt-0.5 text-foreground">
            {label}
          </p>
          <p className="text-[10px] opacity-60 mt-0.5 text-muted-foreground">
            {sub}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Status + BedType Legend ──────────────────────────────────────────────────
function StatusLegend() {
  const statusItems: { status: BedStatus; bg: string }[] = [
    { status: "Empty", bg: "bg-green-500" },
    { status: "Occupied", bg: "bg-red-600" },
    { status: "Reserved", bg: "bg-amber-500" },
    { status: "Cleaning", bg: "bg-slate-500" },
    { status: "Maintenance", bg: "bg-gray-400" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {statusItems.map(({ status, bg }) => (
        <span
          key={status}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white ${bg}`}
        >
          <span className="w-2 h-2 rounded-full bg-white/40" />
          {STATUS_CONFIG[status].label}
        </span>
      ))}
    </div>
  );
}

// ── BedType Badge ────────────────────────────────────────────────────────────
function BedTypeBadge({ bedType }: { bedType?: BedType }) {
  const t = bedType ?? "General";
  const cfg = BED_TYPE_CONFIG[t];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Expected Admissions Panel ────────────────────────────────────────────────
interface Appointment {
  id?: string;
  patientName?: string;
  patientId?: string;
  time?: string;
  date?: string;
  type?: string;
  reason?: string;
  status?: string;
}

function ExpectedAdmissionsPanel({
  onPreAssign,
}: { onPreAssign: (apt: Appointment) => void }) {
  const [expanded, setExpanded] = useState(true);

  const todayAdmissions = useMemo(() => {
    try {
      const raw = localStorage.getItem("appointments");
      if (!raw) return [];
      const all: Appointment[] = JSON.parse(raw);
      const today = format(new Date(), "yyyy-MM-dd");
      return all.filter(
        (a) =>
          a.date === today &&
          (a.type === "admission" || a.type === "Admission") &&
          a.status !== "Cancelled",
      );
    } catch {
      return [];
    }
  }, []);

  return (
    <div
      className="rounded-xl border border-blue-200 bg-blue-50"
      data-ocid="bed_management.expected_admissions.panel"
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-100/60 transition-colors rounded-xl"
        onClick={() => setExpanded((e) => !e)}
        data-ocid="bed_management.expected_admissions.toggle"
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-blue-800 text-sm">
            Expected Admissions Today
          </span>
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
              todayAdmissions.length > 0
                ? "bg-blue-600 text-white"
                : "bg-blue-200 text-blue-600"
            }`}
          >
            {todayAdmissions.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-blue-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-600" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {todayAdmissions.length === 0 ? (
            <div
              className="text-center py-5"
              data-ocid="bed_management.expected_admissions.empty_state"
            >
              <CalendarClock className="w-7 h-7 text-blue-300 mx-auto mb-2" />
              <p className="text-sm text-blue-500">
                No admissions scheduled for today
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayAdmissions.map((apt, i) => (
                <div
                  key={apt.id ?? i}
                  className="flex items-center justify-between gap-3 bg-white rounded-lg border border-blue-100 px-3 py-2.5"
                  data-ocid={`bed_management.expected_admissions.item.${i + 1}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Bed className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {apt.patientName ?? "Unknown Patient"}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {apt.time && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {apt.time}
                          </span>
                        )}
                        {apt.reason && (
                          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {apt.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                    onClick={() => onPreAssign(apt)}
                    data-ocid={`bed_management.expected_admissions.pre_assign_button.${i + 1}`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Pre-Assign Bed
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reservation countdown cell overlay ──────────────────────────────────────
function ReservationTimer({
  bed,
  onExpire,
}: { bed: BedRecord; onExpire: (bed: BedRecord) => void }) {
  const { remaining, isExpired, isLow } = useReservationCountdown(
    bed.reservationExpiry,
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    if (isExpired && !expiredRef.current) {
      expiredRef.current = true;
      onExpire(bed);
    }
  }, [isExpired, bed, onExpire]);

  if (!bed.reservationExpiry) return null;
  return (
    <span
      className={`text-[9px] font-semibold flex items-center gap-0.5 mt-0.5 ${
        isExpired ? "text-red-200" : isLow ? "text-orange-200" : "text-white/70"
      }`}
    >
      <Timer className="w-2.5 h-2.5" />
      {remaining}
    </span>
  );
}

// ── Discharge Checklist Modal ────────────────────────────────────────────────
const DISCHARGE_CHECKLIST = [
  { id: "iv", label: "IV line removed" },
  { id: "meds", label: "Medications stopped" },
  { id: "summary", label: "Discharge summary signed" },
  { id: "belongs", label: "Patient belongings collected" },
];

function DischargeChecklistDialog({
  bed,
  open,
  onClose,
  onConfirm,
}: {
  bed: BedRecord | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (bed: BedRecord) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const allChecked = checked.size === DISCHARGE_CHECKLIST.length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleClose() {
    setChecked(new Set());
    onClose();
  }

  function handleConfirm() {
    if (!bed || !allChecked) return;
    setChecked(new Set());
    onConfirm(bed);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-sm"
        data-ocid="bed_management.discharge_checklist.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Discharge Checklist
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            All items must be confirmed before discharging
            {bed
              ? ` ${bed.patientName ? `${bed.patientName} from ` : ""}bed ${bed.bedNumber}`
              : ""}
            .
          </div>
          <div className="space-y-3">
            {DISCHARGE_CHECKLIST.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 border transition-colors ${
                  checked.has(item.id)
                    ? "bg-green-50 border-green-300 text-green-800"
                    : "bg-card border-border hover:bg-muted/40"
                }`}
                data-ocid={`bed_management.discharge_checklist.${item.id}`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-green-600"
                  checked={checked.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span className="text-sm font-medium">{item.label}</span>
                {checked.has(item.id) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                )}
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              data-ocid="bed_management.discharge_checklist.cancel_button"
            >
              Cancel
            </Button>
            <Button
              disabled={!allChecked}
              className={allChecked ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={handleConfirm}
              data-ocid="bed_management.discharge_checklist.confirm_button"
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Confirm Discharge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Reserve Dialog ───────────────────────────────────────────────────────────
function ReserveBedDialog({
  bed,
  open,
  onClose,
  onConfirm,
}: {
  bed: BedRecord | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (patientName: string, expiryHours: number) => void;
}) {
  const [name, setName] = useState("");
  const [hours, setHours] = useState(2);

  function handleClose() {
    setName("");
    setHours(2);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-sm"
        data-ocid="bed_management.reserve.dialog"
      >
        <DialogHeader>
          <DialogTitle>Reserve Bed {bed?.bedNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reserve for Patient (optional)</Label>
            <Input
              placeholder="Patient name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-ocid="bed_management.reserve.patient_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expiry Time</Label>
            <select
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              data-ocid="bed_management.reserve.expiry_select"
            >
              <option value={1}>1 hour</option>
              <option value={2}>2 hours (default)</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={24}>24 hours</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Bed auto-releases to Available when the timer expires.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              data-ocid="bed_management.reserve.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm(name.trim(), hours);
                handleClose();
              }}
              data-ocid="bed_management.reserve.confirm_button"
            >
              Reserve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function BedManagement() {
  seedBedsIfEmpty();

  const { data: beds = [], refetch } = useGetAllBeds();
  const assignBed = useAssignBed();
  const createBed = useCreateBedRecord();

  const [searchQ, setSearchQ] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<string>("All");
  const [selectedWard, setSelectedWard] = useState<string>("All");
  const [selectedFloor, setSelectedFloor] = useState<string>("All");
  const [selectedBedType, setSelectedBedType] = useState<"All" | BedType>(
    "All",
  );
  const [selectedBed, setSelectedBed] = useState<BedRecord | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAddBedDialog, setShowAddBedDialog] = useState(false);
  const [showDischargeChecklist, setShowDischargeChecklist] = useState(false);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [pendingDischarge, setPendingDischarge] = useState<BedRecord | null>(
    null,
  );
  const [assignSearch, setAssignSearch] = useState("");
  const [preAssignPatient, setPreAssignPatient] = useState<{
    name: string;
    id?: string;
  } | null>(null);
  const [transferBedId, setTransferBedId] = useState<string>("");
  const [transferReason, setTransferReason] = useState("");
  const [newBedNumber, setNewBedNumber] = useState("");
  const [newWard, setNewWard] = useState("General");
  const [newFloor, setNewFloor] = useState("");
  const [newHospitalName, setNewHospitalName] = useState("");
  const [newBedType, setNewBedType] = useState<BedType>("General");

  const allPatients = useMemo(
    () => loadFromAllDoctorKeys<Patient>("patients"),
    [],
  );

  // ── Auto-release expired reservations ──────────────────────────────────────
  function handleReservationExpired(bed: BedRecord) {
    const store = getClinicalStore();
    const all = (store.beds as BedRecord[] | undefined) ?? [];
    // Normalise ids to BigInt before comparing to avoid mixed-type errors
    const bedId = BigInt(String(bed.id ?? 0));
    const target = all.find((b) => BigInt(String(b.id ?? 0)) === bedId);
    if (!target || target.status !== "Reserved") return;
    store.beds = all.map((b) =>
      BigInt(String(b.id ?? 0)) === bedId
        ? {
            ...b,
            id: bedId,
            status: "Empty" as BedStatus,
            reservationExpiry: null,
            reservedForPatient: null,
          }
        : b,
    ) as unknown[];
    saveClinicalStore(store);
    // Sync expired reservation release to canister
    const updatedBeds = (store.beds as BedRecord[]) ?? [];
    saveClinicalEntitiesWithSync("beds", updatedBeds, getCanisterActor());
    refetch();
    toast.warning(
      `Bed ${bed.bedNumber} reservation expired and released — ${bed.reservedForPatient ?? "patient"} did not arrive`,
      { duration: 8000 },
    );
  }

  const hospitalNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of beds) if (b.hospitalName) names.add(b.hospitalName);
    return Array.from(names).sort();
  }, [beds]);

  const wardOptions = useMemo(() => {
    const src =
      selectedHospital === "All"
        ? beds
        : beds.filter((b) => b.hospitalName === selectedHospital);
    const wards = new Set<string>();
    for (const b of src) if (b.ward) wards.add(b.ward);
    return Array.from(wards).sort();
  }, [beds, selectedHospital]);

  const floorOptions = useMemo(() => {
    let src =
      selectedHospital === "All"
        ? beds
        : beds.filter((b) => b.hospitalName === selectedHospital);
    if (selectedWard !== "All")
      src = src.filter((b) => b.ward === selectedWard);
    const floors = new Set<string>();
    for (const b of src) if (b.floor) floors.add(b.floor);
    return Array.from(floors).sort();
  }, [beds, selectedHospital, selectedWard]);

  const filteredBeds = useMemo(() => {
    let result = beds;
    if (selectedHospital !== "All")
      result = result.filter((b) => b.hospitalName === selectedHospital);
    if (selectedWard !== "All")
      result = result.filter((b) => b.ward === selectedWard);
    if (selectedFloor !== "All")
      result = result.filter((b) => b.floor === selectedFloor);
    if (selectedBedType !== "All")
      result = result.filter(
        (b) => (b.bedType ?? "General") === selectedBedType,
      );
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(
        (b) =>
          b.bedNumber.toLowerCase().includes(q) ||
          b.ward.toLowerCase().includes(q) ||
          (b.hospitalName ?? "").toLowerCase().includes(q) ||
          (b.patientName ?? "").toLowerCase().includes(q) ||
          (b.floor ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [
    beds,
    selectedHospital,
    selectedWard,
    selectedFloor,
    selectedBedType,
    searchQ,
  ]);

  const grouped = useMemo(() => {
    const byHospital: Record<string, Record<string, BedRecord[]>> = {};
    for (const b of filteredBeds) {
      const hn = b.hospitalName || "Unknown Hospital";
      const w = b.ward || "Other";
      if (!byHospital[hn]) byHospital[hn] = {};
      if (!byHospital[hn][w]) byHospital[hn][w] = [];
      byHospital[hn][w].push(b);
    }
    return byHospital;
  }, [filteredBeds]);

  const transferableEmpty = useMemo(
    () => beds.filter((b) => b.status === "Empty" && b.id !== selectedBed?.id),
    [beds, selectedBed],
  );

  const matchedPatients = useMemo(() => {
    const base = preAssignPatient?.name
      ? allPatients.filter((p) =>
          p.fullName
            .toLowerCase()
            .includes(preAssignPatient.name.toLowerCase()),
        )
      : allPatients;
    if (!assignSearch.trim()) return base.slice(0, 8);
    const q = assignSearch.toLowerCase();
    return base
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          ((p.registerNumber as string) ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [assignSearch, allPatients, preAssignPatient]);

  // ── Actions ──────────────────────────────────────────────────────────────
  function updateBedInStore(updater: (b: BedRecord) => BedRecord) {
    const store = getClinicalStore();
    const all = (store.beds as BedRecord[] | undefined) ?? [];
    // Normalise ids to BigInt before passing to updater to prevent mixed-type errors
    const normalised = all.map((b) => ({
      ...b,
      id: BigInt(String(b.id ?? 0)),
    }));
    store.beds = normalised.map(updater) as unknown[];
    saveClinicalStore(store);
    // Sync beds to canister
    const updatedBeds = (store.beds as BedRecord[]) ?? [];
    saveClinicalEntitiesWithSync("beds", updatedBeds, getCanisterActor());
    refetch();
  }

  function initiateDischarge(bed: BedRecord) {
    setPendingDischarge(bed);
    setSelectedBed(null);
    setShowDischargeChecklist(true);
  }

  function confirmDischarge(bed: BedRecord) {
    updateBedInStore((b) =>
      b.id === bed.id
        ? {
            ...b,
            status: "Cleaning" as BedStatus,
            patientId: undefined,
            patientName: undefined,
            dischargeDate: BigInt(Date.now()) * 1_000_000n,
            dischargeChecklistCompleted: true,
            dischargeCheckedAt: new Date().toISOString(),
            transferHistory: [
              ...(b.transferHistory ?? []),
              {
                fromBed: b.bedNumber,
                toBed: b.bedNumber,
                date: BigInt(Date.now()) * 1_000_000n,
                reason: "Discharge checklist completed — all items verified",
              },
            ],
          }
        : b,
    );
    setPendingDischarge(null);
    setShowDischargeChecklist(false);
    toast.success(`Patient discharged — Bed ${bed.bedNumber} set to Cleaning`);
  }

  function markBedReady(bed: BedRecord) {
    updateBedInStore((b) =>
      b.id === bed.id ? { ...b, status: "Empty" as BedStatus } : b,
    );
    setSelectedBed(null);
    toast.success(`Bed ${bed.bedNumber} is now Available`);
  }

  function markBedMaintenance(bed: BedRecord) {
    updateBedInStore((b) =>
      b.id === bed.id ? { ...b, status: "Maintenance" as BedStatus } : b,
    );
    setSelectedBed(null);
    toast.success("Bed marked for maintenance");
  }

  function confirmReservation(
    bed: BedRecord,
    patientName: string,
    expiryHours: number,
  ) {
    const expiry = new Date(
      Date.now() + expiryHours * 60 * 60 * 1000,
    ).toISOString();
    updateBedInStore((b) =>
      b.id === bed.id
        ? {
            ...b,
            status: "Reserved" as BedStatus,
            reservedForPatient: patientName || null,
            reservationExpiry: expiry,
          }
        : b,
    );
    setSelectedBed(null);
    toast.success(
      `Bed ${bed.bedNumber} reserved${patientName ? ` for ${patientName}` : ""} — expires in ${expiryHours}h`,
    );
  }

  function extendReservation(bed: BedRecord) {
    const current = bed.reservationExpiry
      ? new Date(bed.reservationExpiry).getTime()
      : Date.now();
    const extended = new Date(
      Math.max(current, Date.now()) + 60 * 60 * 1000,
    ).toISOString(); // +1h
    updateBedInStore((b) =>
      b.id === bed.id ? { ...b, reservationExpiry: extended } : b,
    );
    setSelectedBed(null);
    toast.success("Reservation extended by 1 hour");
  }

  function transferPatient(
    fromBed: BedRecord,
    toBedId: bigint,
    reason: string,
  ) {
    const store = getClinicalStore();
    const all = (store.beds as BedRecord[] | undefined) ?? [];
    // Normalise ids to BigInt before comparing to avoid mixed-type errors
    const normalised = all.map((b) => ({
      ...b,
      id: BigInt(String(b.id ?? 0)),
    }));
    const toBed = normalised.find((b) => b.id === toBedId);
    if (!toBed || toBed.status !== "Empty") {
      toast.error("Target bed is not available");
      return;
    }
    const fromBedId = BigInt(String(fromBed.id ?? 0));
    const now = BigInt(Date.now()) * 1_000_000n;
    store.beds = normalised.map((b) => {
      if (b.id === fromBedId)
        return {
          ...b,
          status: "Cleaning" as BedStatus,
          patientId: undefined,
          patientName: undefined,
          dischargeDate: now,
        };
      if (b.id === toBedId)
        return {
          ...b,
          status: "Occupied" as BedStatus,
          patientId: fromBed.patientId,
          patientName: fromBed.patientName,
          admissionDate: fromBed.admissionDate,
          transferHistory: [
            ...(b.transferHistory ?? []),
            {
              fromBed: fromBed.bedNumber,
              toBed: b.bedNumber,
              date: now,
              reason: reason || "Transfer",
            },
          ],
        };
      return b;
    }) as unknown[];
    saveClinicalStore(store);
    // Sync transfer changes to canister
    const updatedBeds = (store.beds as BedRecord[]) ?? [];
    saveClinicalEntitiesWithSync("beds", updatedBeds, getCanisterActor());
    refetch();
    setShowTransferDialog(false);
    setTransferBedId("");
    setTransferReason("");
    setSelectedBed(null);
    toast.success(
      `Patient transferred to bed ${toBed.bedNumber}. Old bed set to Cleaning.`,
    );
  }

  function handleHospitalChange(hn: string) {
    setSelectedHospital(hn);
    setSelectedWard("All");
    setSelectedFloor("All");
  }

  function handleWardChange(w: string) {
    setSelectedWard(w);
    setSelectedFloor("All");
  }

  function handlePreAssign(apt: Appointment) {
    setPreAssignPatient({ name: apt.patientName ?? "", id: apt.patientId });
    setAssignSearch(apt.patientName ?? "");
    // open assign dialog — user must click an available bed first
    toast.info(
      `Select a bed to pre-assign for ${apt.patientName ?? "patient"}`,
    );
  }

  // ── render bed's extended reservation info in detail dialog ─────────────
  function isReservationLow(expiry?: string | null) {
    if (!expiry) return false;
    return new Date(expiry).getTime() - Date.now() < 30 * 60 * 1000;
  }

  return (
    <div
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5"
      data-ocid="bed_management.page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Bed className="w-6 h-6 text-teal-600" /> Bed Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time occupancy, patient assignment, and transfer by
            hospital/ward/floor
          </p>
        </div>
        <Button
          onClick={() => setShowAddBedDialog(true)}
          className="gap-2 bg-teal-600 hover:bg-teal-700"
          data-ocid="bed_management.open_modal_button"
        >
          <Plus className="w-4 h-4" /> Add Bed
        </Button>
      </div>

      {/* Stats */}
      <StatsPanel
        beds={
          selectedHospital === "All"
            ? beds
            : beds.filter((b) => b.hospitalName === selectedHospital)
        }
      />

      {/* Expected admissions */}
      <ExpectedAdmissionsPanel onPreAssign={handlePreAssign} />

      {/* Legend */}
      <StatusLegend />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Hospital filter */}
        <div
          className="flex flex-wrap gap-1.5"
          data-ocid="bed_management.hospital.tab"
        >
          {["All", ...hospitalNames].map((hn) => (
            <button
              key={hn}
              type="button"
              onClick={() => handleHospitalChange(hn)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedHospital === hn
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-card border-border text-muted-foreground hover:border-indigo-300 hover:text-indigo-700"
              }`}
              data-ocid={`bed_management.hospital_filter.${hn.toLowerCase().replace(/\s+/g, "_")}`}
            >
              {hn !== "All" && <Building2 className="w-3 h-3" />}
              {hn === "All" ? "All Hospitals" : hn}
            </button>
          ))}
        </div>

        {/* Ward filter */}
        {wardOptions.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5"
            data-ocid="bed_management.ward.tab"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground px-1">
              <Layers className="w-3 h-3" /> Ward:
            </span>
            {["All", ...wardOptions].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => handleWardChange(w)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedWard === w
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-card border-border text-muted-foreground hover:border-teal-300 hover:text-teal-700"
                }`}
                data-ocid={`bed_management.ward_filter.${w.toLowerCase().replace(/\s+/g, "_")}`}
              >
                {w === "All" ? "All Wards" : w}
              </button>
            ))}
          </div>
        )}

        {/* Floor filter */}
        {floorOptions.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5"
            data-ocid="bed_management.floor.tab"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground px-1">
              <Sparkles className="w-3 h-3" /> Floor:
            </span>
            {["All", ...floorOptions].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFloor(f)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedFloor === f
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-card border-border text-muted-foreground hover:border-purple-300 hover:text-purple-700"
                }`}
                data-ocid={`bed_management.floor_filter.${f.toLowerCase().replace(/\s+/g, "_")}`}
              >
                {f === "All" ? "All Floors" : f}
              </button>
            ))}
          </div>
        )}

        {/* BedType filter */}
        <div
          className="flex flex-wrap gap-1.5"
          data-ocid="bed_management.bedtype.tab"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground px-1">
            <Bed className="w-3 h-3" /> Type:
          </span>
          <button
            type="button"
            onClick={() => setSelectedBedType("All")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedBedType === "All"
                ? "bg-slate-600 text-white border-slate-600"
                : "bg-card border-border text-muted-foreground hover:border-slate-400 hover:text-slate-700"
            }`}
            data-ocid="bed_management.bedtype_filter.all"
          >
            All Types
          </button>
          {BED_TYPES.map((bt) => {
            const cfg = BED_TYPE_CONFIG[bt];
            return (
              <button
                key={bt}
                type="button"
                onClick={() => setSelectedBedType(bt)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedBedType === bt
                    ? `${cfg.dot.replace("bg-", "bg-")} text-white border-transparent`
                    : `bg-card border-border text-muted-foreground ${cfg.badge}`
                }`}
                style={selectedBedType === bt ? {} : {}}
                data-ocid={`bed_management.bedtype_filter.${bt.toLowerCase()}`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search bed, ward, floor, patient..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="pl-9"
          data-ocid="bed_management.search_input"
        />
      </div>

      {/* Bed grid */}
      {filteredBeds.length === 0 ? (
        <div
          className="text-center py-20"
          data-ocid="bed_management.empty_state"
        >
          <Bed className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No beds found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([hospitalName, wardMap]) => (
            <section
              key={hospitalName}
              data-ocid={`bed_management.hospital.${hospitalName.toLowerCase().replace(/\s+/g, "_")}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-base text-indigo-700">
                  {hospitalName}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({Object.values(wardMap).flat().length} bed
                  {Object.values(wardMap).flat().length !== 1 ? "s" : ""})
                </span>
                <div className="flex-1 h-px bg-indigo-100 ml-1" />
              </div>
              <div className="space-y-5">
                {Object.entries(wardMap).map(([wardName, wardBeds]) => (
                  <div
                    key={wardName}
                    className="pl-1"
                    data-ocid={`bed_management.ward.${wardName.toLowerCase().replace(/\s+/g, "_")}`}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-1 h-5 bg-teal-400 rounded-full" />
                      <span className="text-sm font-semibold text-teal-700">
                        {wardName}
                      </span>
                      {wardBeds[0]?.floor && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Layers className="w-3 h-3" /> {wardBeds[0].floor}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({wardBeds.length} bed{wardBeds.length !== 1 ? "s" : ""}
                        )
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {wardBeds.map((bed) => {
                        const cfg = statusCfg(bed.status);
                        return (
                          <button
                            key={bed.id.toString()}
                            type="button"
                            onClick={() => setSelectedBed(bed)}
                            className={`min-h-[88px] w-full flex flex-col items-center justify-center rounded-lg border-2 cursor-pointer hover:opacity-90 transition-opacity p-2 relative ${cfg.cell}`}
                            data-ocid={`bed_management.item.${bed.bedNumber}`}
                          >
                            <span className="text-lg font-bold text-white leading-tight">
                              {bed.bedNumber}
                            </span>
                            {bed.status === "Occupied" && bed.patientName ? (
                              <span className="text-xs font-bold text-white truncate max-w-full mt-1 px-1 text-center">
                                {bed.patientName}
                              </span>
                            ) : bed.status === "Reserved" &&
                              bed.reservedForPatient ? (
                              <span className="text-xs font-medium text-white truncate max-w-full mt-1 px-1 text-center">
                                {bed.reservedForPatient}
                              </span>
                            ) : (
                              <span className="text-xs text-white/80 mt-1">
                                {cfg.label}
                              </span>
                            )}
                            {/* BedType badge overlay */}
                            <span
                              className={`absolute top-1 right-1 px-1 py-0.5 rounded text-[8px] font-bold border ${
                                BED_TYPE_CONFIG[bed.bedType ?? "General"].badge
                              } opacity-90`}
                            >
                              {bed.bedType ?? "General"}
                            </span>
                            {/* Reservation countdown */}
                            {bed.status === "Reserved" &&
                              bed.reservationExpiry && (
                                <ReservationTimer
                                  bed={bed}
                                  onExpire={handleReservationExpired}
                                />
                              )}
                            {bed.status === "Occupied" && bed.admissionDate && (
                              <span className="text-[10px] text-white/60 mt-0.5">
                                {daysAdmitted(bed.admissionDate)}d
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Bed Detail Dialog ── */}
      <Dialog
        open={!!selectedBed}
        onOpenChange={(open) => !open && setSelectedBed(null)}
      >
        <DialogContent className="max-w-md" data-ocid="bed_management.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-teal-600" />
              Bed {selectedBed?.bedNumber} — {selectedBed?.ward}
              {selectedBed && <BedTypeBadge bedType={selectedBed.bedType} />}
            </DialogTitle>
          </DialogHeader>
          {selectedBed &&
            (() => {
              const cfg = statusCfg(selectedBed.status);
              const resLow = isReservationLow(selectedBed.reservationExpiry);
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedBed.hospitalName && (
                      <span className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {selectedBed.hospitalName}
                      </span>
                    )}
                    {selectedBed.floor && (
                      <span className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        {selectedBed.floor}
                      </span>
                    )}
                  </div>

                  <div className={`rounded-lg border px-4 py-3 ${cfg.card}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      <span className="font-semibold">{cfg.label}</span>
                    </div>
                    {selectedBed.patientName && (
                      <p className="font-bold text-sm">
                        {selectedBed.patientName}
                      </p>
                    )}
                    {selectedBed.reservedForPatient &&
                      selectedBed.status === "Reserved" && (
                        <p className="font-bold text-sm">
                          {selectedBed.reservedForPatient}
                        </p>
                      )}
                    {selectedBed.admissionDate && (
                      <p className="text-xs opacity-70 mt-0.5">
                        Admitted: {formatTs(selectedBed.admissionDate)}
                        {selectedBed.status === "Occupied" &&
                          ` (${daysAdmitted(selectedBed.admissionDate)} day${daysAdmitted(selectedBed.admissionDate) !== 1 ? "s" : ""})`}
                      </p>
                    )}
                    {/* Reservation countdown */}
                    {selectedBed.status === "Reserved" &&
                      selectedBed.reservationExpiry && (
                        <div
                          className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${
                            resLow ? "text-red-600" : "text-amber-700"
                          }`}
                        >
                          <Timer className="w-3.5 h-3.5" />
                          {formatDistanceToNow(
                            new Date(selectedBed.reservationExpiry),
                            { addSuffix: true },
                          )}
                          &nbsp;— expires{" "}
                          {format(
                            new Date(selectedBed.reservationExpiry),
                            "h:mm a",
                          )}
                        </div>
                      )}
                  </div>

                  {/* Extend reservation warning */}
                  {selectedBed.status === "Reserved" && resLow && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        Less than 30 minutes remaining. Extend the reservation
                        or it will auto-release.
                      </span>
                    </div>
                  )}

                  {selectedBed.status === "Cleaning" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-start gap-2">
                      <span className="mt-0.5">🧹</span>
                      <span>
                        Cleaning in progress. Mark Ready when complete to make
                        it Available again.
                      </span>
                      {selectedBed.dischargeCheckedAt && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Checklist:{" "}
                          {format(
                            new Date(selectedBed.dischargeCheckedAt),
                            "h:mm a",
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  {selectedBed.transferHistory?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Transfer / Discharge History
                      </p>
                      <ScrollArea className="h-28">
                        <div className="space-y-1.5">
                          {selectedBed.transferHistory.map((t, i) => (
                            <div
                              key={`${t.fromBed}-${t.toBed}-${i}`}
                              className="bg-muted/40 rounded px-2.5 py-1.5 text-xs"
                            >
                              <span className="font-medium">
                                {t.fromBed} → {t.toBed}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                on {formatTs(t.date)}
                              </span>
                              {t.reason && (
                                <p className="text-muted-foreground italic">
                                  {t.reason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedBed.status === "Empty" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-teal-600 hover:bg-teal-700"
                          onClick={() => setShowAssignDialog(true)}
                          data-ocid="bed_management.assign_button"
                        >
                          <Plus className="w-3.5 h-3.5" /> Assign Patient
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                          onClick={() => setShowReserveDialog(true)}
                          data-ocid="bed_management.reserve_button"
                        >
                          Reserve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => markBedMaintenance(selectedBed)}
                          data-ocid="bed_management.maintenance_button"
                        >
                          Maintenance
                        </Button>
                      </>
                    )}
                    {selectedBed.status === "Occupied" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => setShowTransferDialog(true)}
                          data-ocid="bed_management.transfer_button"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => initiateDischarge(selectedBed)}
                          data-ocid="bed_management.discharge_button"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Discharge
                        </Button>
                      </>
                    )}
                    {selectedBed.status === "Cleaning" && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => markBedReady(selectedBed)}
                        data-ocid="bed_management.mark_ready_button"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Ready
                        (Available)
                      </Button>
                    )}
                    {selectedBed.status === "Maintenance" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => markBedReady(selectedBed)}
                        data-ocid="bed_management.mark_available_button"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Available
                      </Button>
                    )}
                    {selectedBed.status === "Reserved" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-teal-600 hover:bg-teal-700"
                          onClick={() => setShowAssignDialog(true)}
                          data-ocid="bed_management.assign_button"
                        >
                          <Plus className="w-3.5 h-3.5" /> Assign Patient
                        </Button>
                        {resLow && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={() => extendReservation(selectedBed)}
                            data-ocid="bed_management.extend_reservation_button"
                          >
                            <Timer className="w-3.5 h-3.5" /> Extend +1h
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => markBedReady(selectedBed)}
                          data-ocid="bed_management.unreserve_button"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Unreserve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* ── Discharge Checklist ── */}
      <DischargeChecklistDialog
        bed={pendingDischarge}
        open={showDischargeChecklist}
        onClose={() => {
          setShowDischargeChecklist(false);
          setPendingDischarge(null);
        }}
        onConfirm={confirmDischarge}
      />

      {/* ── Reserve Dialog ── */}
      <ReserveBedDialog
        bed={selectedBed}
        open={showReserveDialog}
        onClose={() => setShowReserveDialog(false)}
        onConfirm={(name, hours) =>
          selectedBed && confirmReservation(selectedBed, name, hours)
        }
      />

      {/* ── Assign Patient Dialog ── */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent
          className="max-w-sm"
          data-ocid="bed_management.assign.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              Assign Patient to Bed {selectedBed?.bedNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {preAssignPatient?.name && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                Pre-filling from scheduled admission:{" "}
                <strong>{preAssignPatient.name}</strong>
              </div>
            )}
            <Input
              placeholder="Search patient by name or reg no..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              data-ocid="bed_management.assign.search_input"
            />
            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {matchedPatients.length === 0 && (
                  <p className="text-sm text-muted-foreground p-3 text-center">
                    No patients found
                  </p>
                )}
                {matchedPatients.map((p) => (
                  <button
                    key={p.id.toString()}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      if (!selectedBed) return;
                      assignBed.mutate(
                        {
                          bedId: selectedBed.id,
                          patientId: p.id,
                          patientName: p.fullName,
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              `Assigned ${p.fullName} to ${selectedBed.bedNumber}`,
                            );
                            setShowAssignDialog(false);
                            setAssignSearch("");
                            setSelectedBed(null);
                            setPreAssignPatient(null);
                          },
                        },
                      );
                    }}
                    data-ocid={`bed_management.assign.item.${p.registerNumber}`}
                  >
                    <p className="font-medium text-sm">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {(p.registerNumber as string) || String(p.id)}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Dialog ── */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent
          className="max-w-sm"
          data-ocid="bed_management.transfer.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              Transfer Patient from {selectedBed?.bedNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              After transfer, bed <strong>{selectedBed?.bedNumber}</strong> will
              be set to <strong>Cleaning</strong>.
            </div>
            <div className="space-y-1.5">
              <Label>Transfer to Bed</Label>
              <select
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={transferBedId}
                onChange={(e) => setTransferBedId(e.target.value)}
                data-ocid="bed_management.transfer.select"
              >
                <option value="">Select available bed...</option>
                {transferableEmpty.map((b) => (
                  <option key={b.id.toString()} value={b.id.toString()}>
                    {b.bedNumber} ({b.ward}
                    {b.floor ? `, ${b.floor}` : ""}) [{b.bedType ?? "General"}]
                    — {b.hospitalName}
                  </option>
                ))}
              </select>
              {transferableEmpty.length === 0 && (
                <p className="text-xs text-destructive">No available beds.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Reason for Transfer</Label>
              <Input
                placeholder="e.g. Transfer to ICU, bed maintenance"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                data-ocid="bed_management.transfer.input"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowTransferDialog(false)}
                data-ocid="bed_management.transfer.cancel_button"
              >
                Cancel
              </Button>
              <Button
                disabled={!transferBedId}
                onClick={() => {
                  if (!selectedBed || !transferBedId) return;
                  transferPatient(
                    selectedBed,
                    BigInt(transferBedId),
                    transferReason,
                  );
                }}
                data-ocid="bed_management.transfer.submit_button"
              >
                Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Bed Dialog ── */}
      <Dialog open={showAddBedDialog} onOpenChange={setShowAddBedDialog}>
        <DialogContent
          className="max-w-sm"
          data-ocid="bed_management.add.dialog"
        >
          <DialogHeader>
            <DialogTitle>Add New Bed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Hospital Name *</Label>
              <Input
                placeholder="e.g. Dhaka Medical College Hospital"
                value={newHospitalName}
                onChange={(e) => setNewHospitalName(e.target.value)}
                list="hospital-suggestions"
                data-ocid="bed_management.add.hospital_input"
              />
              <datalist id="hospital-suggestions">
                {hospitalNames.map((hn) => (
                  <option key={hn} value={hn} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Bed Number *</Label>
              <Input
                placeholder="e.g. A-01, ICU-03"
                value={newBedNumber}
                onChange={(e) => setNewBedNumber(e.target.value)}
                data-ocid="bed_management.add.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bed Type *</Label>
              <select
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={newBedType}
                onChange={(e) => setNewBedType(e.target.value as BedType)}
                data-ocid="bed_management.add.bedtype_select"
              >
                {BED_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {BED_TYPE_CONFIG[bt].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ward *</Label>
              <select
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={newWard}
                onChange={(e) => setNewWard(e.target.value)}
                data-ocid="bed_management.add.select"
              >
                {WARDS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Floor / Level</Label>
              <Input
                placeholder="e.g. Ground Floor, Floor 1"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                data-ocid="bed_management.add.floor_input"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddBedDialog(false);
                  setNewBedNumber("");
                  setNewWard("General");
                  setNewHospitalName("");
                  setNewFloor("");
                  setNewBedType("General");
                }}
                data-ocid="bed_management.add.cancel_button"
              >
                Cancel
              </Button>
              <Button
                disabled={!newBedNumber.trim() || !newHospitalName.trim()}
                onClick={() => {
                  createBed.mutate(
                    {
                      bedNumber: newBedNumber.trim(),
                      ward: newWard,
                      hospitalName: newHospitalName.trim(),
                      floor: newFloor.trim() || undefined,
                      bedType: newBedType,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Bed added");
                        setShowAddBedDialog(false);
                        setNewBedNumber("");
                        setNewWard("General");
                        setNewHospitalName("");
                        setNewFloor("");
                        setNewBedType("General");
                      },
                    },
                  );
                }}
                data-ocid="bed_management.add.submit_button"
              >
                Add Bed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
