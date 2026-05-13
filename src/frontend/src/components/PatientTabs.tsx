import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageCircle,
  Phone,
  Plus,
  Receipt,
  Send,
  Shield,
  Stethoscope,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Patient, Prescription, Visit } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function _fmtDateTime(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
}

// ── Sample data helpers (localStorage-backed) ─────────────────────────────────

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Complaint {
  id: string;
  text: string;
  date: string;
  reportedBy: string;
  severity: number;
  status: "Active" | "Resolving" | "Resolved";
}

interface AdviceEntry {
  id: string;
  advice: string;
  date: string;
  givenBy: string;
  visitRef?: string;
  followUpInstruction?: string;
  followUpDate?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: "patient" | "doctor";
  senderName: string;
  timestamp: string;
  seen: boolean;
}

interface AppointmentEntry {
  id: string;
  date: string;
  time: string;
  doctor: string;
  chamber: string;
  type: string;
  serialNumber: string;
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  phone?: string;
}

interface HandoverEntry {
  id: string;
  shift: "Morning" | "Evening" | "Night";
  date: string;
  outgoingName: string;
  observations: string;
  medicationsGiven: string;
  pendingTasks: string;
  acknowledged: boolean;
}

interface ReferralEntry {
  id: string;
  referringDoctor: string;
  specialist: string;
  hospital: string;
  reason: string;
  urgency: "Urgent" | "Routine";
  date: string;
  status: "Sent" | "Accepted" | "Completed" | "Declined";
  letterText?: string;
}

interface SOAPNote {
  id: string;
  date: string;
  authorName: string;
  authorRole: "Intern" | "MO" | "Consultant";
  finalized: boolean;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  vitalsStrip?: string;
}

interface InvPaymentRecord {
  id: string;
  testName: string;
  date: string;
  rate: number;
  discount: number;
  finalAmount: number;
  paymentMethod: string;
  receiptNumber: string;
  paid: boolean;
}

interface ProcedureEntry {
  id: string;
  procedureName: string;
  date: string;
  performedBy: string;
  performedByRole: string;
  indication: string;
  outcome: string;
  complications: string;
  consentObtained: boolean;
  linkedReceipt?: string;
}

// ── Severity color helpers ─────────────────────────────────────────────────────

function severityColor(s: number) {
  if (s <= 3) return "bg-green-100 text-green-700 border-green-200";
  if (s <= 6) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function appointmentStatusColor(s: AppointmentEntry["status"]) {
  return {
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    Completed: "bg-green-100 text-green-700 border-green-200",
    Cancelled: "bg-red-100 text-red-700 border-red-200",
  }[s];
}

function referralStatusColor(s: ReferralEntry["status"]) {
  return {
    Sent: "bg-blue-100 text-blue-700 border-blue-200",
    Accepted: "bg-teal-100 text-teal-700 border-teal-200",
    Completed: "bg-green-100 text-green-700 border-green-200",
    Declined: "bg-red-100 text-red-700 border-red-200",
  }[s];
}

// ── Default seed data factories ────────────────────────────────────────────────

function seedComplaints(patientName: string): Complaint[] {
  return [
    {
      id: "c1",
      text: "Persistent headache",
      date: "2026-04-10",
      reportedBy: patientName,
      severity: 6,
      status: "Resolving",
    },
    {
      id: "c2",
      text: "Chest tightness on exertion",
      date: "2026-04-15",
      reportedBy: patientName,
      severity: 8,
      status: "Active",
    },
    {
      id: "c3",
      text: "Ankle swelling",
      date: "2026-03-28",
      reportedBy: patientName,
      severity: 4,
      status: "Resolved",
    },
  ];
}

function seedAdvice(): AdviceEntry[] {
  return [
    {
      id: "a1",
      advice:
        "Reduce salt intake to less than 2g/day. Avoid processed foods. Walk 30 minutes daily.",
      date: "2026-04-15",
      givenBy: "Dr. Arman Kabir",
      visitRef: "OPD Visit — 15 Apr 2026",
      followUpInstruction: "Return in 2 weeks for BP check",
      followUpDate: "2026-04-29",
    },
    {
      id: "a2",
      advice: "Take medications with food. Avoid smoking and alcohol.",
      date: "2026-03-20",
      givenBy: "Dr. Samia Shikder",
      visitRef: "OPD Visit — 20 Mar 2026",
      followUpInstruction: "Review blood work before next visit",
      followUpDate: "2026-04-20",
    },
  ];
}

function seedAppointments(): AppointmentEntry[] {
  return [
    {
      id: "ap1",
      date: "2026-05-20",
      time: "10:30 AM",
      doctor: "Dr. Arman Kabir",
      chamber: "Chamber 1 — Mirpur",
      type: "Follow-up",
      serialNumber: "#042",
      status: "Confirmed",
      phone: "+8801751959262",
    },
    {
      id: "ap2",
      date: "2026-04-15",
      time: "11:00 AM",
      doctor: "Dr. Arman Kabir",
      chamber: "Chamber 2 — Dhanmondi",
      type: "OPD",
      serialNumber: "#028",
      status: "Completed",
      phone: "+8801751959262",
    },
    {
      id: "ap3",
      date: "2026-03-02",
      time: "09:00 AM",
      doctor: "Dr. Samia Shikder",
      chamber: "Chamber 3 — Gulshan",
      type: "Consultation",
      serialNumber: "#017",
      status: "Completed",
    },
  ];
}

function seedHandovers(): HandoverEntry[] {
  return [
    {
      id: "h1",
      shift: "Morning",
      date: "2026-05-13",
      outgoingName: "Nurse Rahima",
      observations: "Patient stable. BP 130/80. Ate breakfast well.",
      medicationsGiven: "Amlodipine 5mg (8AM), Metformin 500mg (8AM)",
      pendingTasks: "Awaiting creatinine result",
      acknowledged: true,
    },
    {
      id: "h2",
      shift: "Night",
      date: "2026-05-12",
      outgoingName: "Nurse Karim",
      observations: "Restless around 2AM. BP slightly elevated 145/90.",
      medicationsGiven: "All scheduled medications given",
      pendingTasks: "Notify MO if BP remains high",
      acknowledged: false,
    },
  ];
}

function seedReferrals(): ReferralEntry[] {
  return [
    {
      id: "r1",
      referringDoctor: "Dr. Arman Kabir",
      specialist: "Cardiology",
      hospital: "National Heart Foundation",
      reason: "Chest tightness on exertion — rule out NSTEMI",
      urgency: "Urgent",
      date: "2026-05-10",
      status: "Accepted",
      letterText:
        "Dear Colleague,\n\nPlease review this patient with exertional chest tightness. Recent ECG showed ST-segment changes. Echo recommended.\n\nRegards,\nDr. Arman Kabir",
    },
    {
      id: "r2",
      referringDoctor: "Dr. Samia Shikder",
      specialist: "Nephrology",
      hospital: "BSMMU",
      reason: "Rising creatinine — CKD monitoring",
      urgency: "Routine",
      date: "2026-04-01",
      status: "Sent",
    },
  ];
}

function seedSOAPNotes(): SOAPNote[] {
  return [
    {
      id: "s1",
      date: "2026-05-13",
      authorName: "Dr. Arman Kabir",
      authorRole: "Consultant",
      finalized: true,
      subjective:
        "Patient reports feeling better. Chest tightness reduced. Sleeping well.",
      objective:
        "BP: 128/78. Pulse: 74/min. SpO2: 98%. Afebrile. JVP normal. Heart sounds regular.",
      assessment:
        "Hypertension — well controlled. Chest tightness — improving with medication.",
      plan: "Continue Amlodipine 5mg OD. Increase Metformin to 1g BD. Follow up in 2 weeks. Cardiology referral as arranged.",
      vitalsStrip: "BP 128/78 | HR 74 | SpO2 98% | Temp 36.8°C",
    },
    {
      id: "s2",
      date: "2026-05-12",
      authorName: "Dr. Mahmud (MO)",
      authorRole: "MO",
      finalized: true,
      subjective:
        "Patient reports mild headache. No chest pain overnight. Appetite fair.",
      objective: "BP: 138/86. Pulse: 80/min. SpO2: 97%. Mild peripheral edema.",
      assessment:
        "Hypertension — not fully controlled. Possible fluid overload.",
      plan: "Add Furosemide 20mg OD. Monitor urine output. Restrict fluids to 1.5L/day. Alert Consultant if BP > 160/100.",
    },
  ];
}

function seedInvPayments(): InvPaymentRecord[] {
  return [
    {
      id: "ip1",
      testName: "Complete Blood Count (CBC)",
      date: "2026-05-10",
      rate: 400,
      discount: 10,
      finalAmount: 360,
      paymentMethod: "bKash",
      receiptNumber: "INV-0042",
      paid: true,
    },
    {
      id: "ip2",
      testName: "Serum Creatinine",
      date: "2026-05-10",
      rate: 350,
      discount: 0,
      finalAmount: 350,
      paymentMethod: "Cash",
      receiptNumber: "INV-0043",
      paid: true,
    },
    {
      id: "ip3",
      testName: "HbA1c",
      date: "2026-05-12",
      rate: 800,
      discount: 5,
      finalAmount: 760,
      paymentMethod: "",
      receiptNumber: "INV-0044",
      paid: false,
    },
  ];
}

function seedProcedures(): ProcedureEntry[] {
  return [
    {
      id: "proc1",
      procedureName: "12-Lead ECG",
      date: "2026-05-10",
      performedBy: "Dr. Arman Kabir",
      performedByRole: "Consultant",
      indication: "Chest tightness, possible cardiac cause",
      outcome: "ST-segment changes in V4–V6",
      complications: "None",
      consentObtained: true,
      linkedReceipt: "PRO-0008",
    },
    {
      id: "proc2",
      procedureName: "IV Cannula Insertion",
      date: "2026-05-11",
      performedBy: "Nurse Rahima",
      performedByRole: "Nurse",
      indication: "IV fluid access for medication",
      outcome: "Successful — right forearm",
      complications: "None",
      consentObtained: true,
    },
  ];
}

// ── Procedures Tab ─────────────────────────────────────────────────────────────

export function ProceduresTab({
  patientId,
  canWrite,
}: {
  patientId: bigint;
  canWrite: boolean;
}) {
  const key = `patient_procedures_${patientId}`;
  const [procedures, setProcedures] = useState<ProcedureEntry[]>(() =>
    loadLS(key, seedProcedures()),
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<ProcedureEntry>>({
    consentObtained: true,
  });

  const save = () => {
    if (!form.procedureName?.trim()) {
      toast.error("Procedure name required");
      return;
    }
    const entry: ProcedureEntry = {
      id: `proc_${Date.now()}`,
      procedureName: form.procedureName,
      date: form.date || new Date().toISOString().split("T")[0],
      performedBy: form.performedBy || "Unknown",
      performedByRole: form.performedByRole || "Doctor",
      indication: form.indication || "",
      outcome: form.outcome || "",
      complications: form.complications || "None",
      consentObtained: form.consentObtained ?? true,
      linkedReceipt: form.linkedReceipt,
    };
    const updated = [entry, ...procedures];
    setProcedures(updated);
    saveLS(key, updated);
    setShowForm(false);
    setForm({ consentObtained: true });
    toast.success("Procedure logged");
  };

  return (
    <div className="space-y-4" data-ocid="patient_profile.procedures_tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {procedures.length} procedure{procedures.length !== 1 ? "s" : ""}{" "}
          recorded
        </p>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            data-ocid="patient_profile.procedures.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" /> Log Procedure
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-violet-800">
            Log Procedure
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Procedure Name *</Label>
              <Input
                placeholder="e.g. ECG, IV Cannula"
                value={form.procedureName || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, procedureName: e.target.value }))
                }
                data-ocid="patient_profile.procedures.name_input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date || new Date().toISOString().split("T")[0]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Performed By</Label>
              <Input
                placeholder="Doctor / Nurse name"
                value={form.performedBy || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, performedBy: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form.performedByRole || "Doctor"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, performedByRole: e.target.value }))
                }
              >
                <option>Consultant</option>
                <option>MO</option>
                <option>Intern</option>
                <option>Nurse</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Indication</Label>
              <Input
                placeholder="Why was this procedure done?"
                value={form.indication || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, indication: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outcome</Label>
              <Input
                placeholder="Result / findings"
                value={form.outcome || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, outcome: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Complications</Label>
              <Input
                placeholder="None / describe"
                value={form.complications || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, complications: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="consent"
                checked={form.consentObtained ?? true}
                onChange={(e) =>
                  setForm((p) => ({ ...p, consentObtained: e.target.checked }))
                }
                className="rounded"
              />
              <Label htmlFor="consent" className="text-xs cursor-pointer">
                Consent obtained
              </Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Linked Receipt #</Label>
              <Input
                placeholder="PRO-0001 (optional)"
                value={form.linkedReceipt || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, linkedReceipt: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              data-ocid="patient_profile.procedures.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-ocid="patient_profile.procedures.submit_button"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {procedures.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.procedures.empty_state"
        >
          <Stethoscope className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No procedures recorded
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {procedures.map((proc, i) => (
            <div
              key={proc.id}
              className="bg-card border border-border rounded-xl p-4"
              data-ocid={`patient_profile.procedures.item.${i + 1}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm text-foreground">
                  {proc.procedureName}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    className={`text-xs border ${proc.consentObtained ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
                  >
                    {proc.consentObtained ? "✓ Consent" : "No Consent"}
                  </Badge>
                  {proc.linkedReceipt && (
                    <Badge variant="outline" className="text-xs">
                      {proc.linkedReceipt}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {fmtDate(proc.date)}
                </div>
                <div>
                  <span className="font-medium">By:</span> {proc.performedBy}{" "}
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {proc.performedByRole}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Indication:</span>{" "}
                  {proc.indication || "—"}
                </div>
                <div>
                  <span className="font-medium">Outcome:</span>{" "}
                  {proc.outcome || "—"}
                </div>
                <div>
                  <span className="font-medium">Complications:</span>{" "}
                  {proc.complications || "None"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Complaints Tab ─────────────────────────────────────────────────────────────

export function ComplaintsTab({
  patientId,
  patientName,
  canWrite,
}: {
  patientId: bigint;
  patientName: string;
  canWrite: boolean;
}) {
  const key = `patient_complaints_${patientId}`;
  const [complaints, setComplaints] = useState<Complaint[]>(() =>
    loadLS(key, seedComplaints(patientName)),
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Complaint>>({
    severity: 5,
    status: "Active",
  });

  const save = () => {
    if (!form.text?.trim()) {
      toast.error("Complaint text required");
      return;
    }
    const entry: Complaint = {
      id: `c_${Date.now()}`,
      text: form.text,
      date: form.date || new Date().toISOString().split("T")[0],
      reportedBy: form.reportedBy || patientName,
      severity: form.severity ?? 5,
      status: form.status || "Active",
    };
    const updated = [entry, ...complaints];
    setComplaints(updated);
    saveLS(key, updated);
    setShowForm(false);
    setForm({ severity: 5, status: "Active" });
    toast.success("Complaint added");
  };

  const grouped = complaints.reduce<Record<string, Complaint[]>>((acc, c) => {
    acc[c.text] = acc[c.text] ? [...acc[c.text], c] : [c];
    return acc;
  }, {});

  return (
    <div className="space-y-4" data-ocid="patient_profile.complaints_tab">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {complaints.length} complaints
          </p>
          {complaints.filter((c) => c.status === "Active").length > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
              {complaints.filter((c) => c.status === "Active").length} Active
            </Badge>
          )}
        </div>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            data-ocid="patient_profile.complaints.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" /> Add Complaint
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-rose-800">New Complaint</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Complaint *</Label>
              <Input
                placeholder="Describe the complaint"
                value={form.text || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, text: e.target.value }))
                }
                data-ocid="patient_profile.complaints.input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Severity (1–10)</Label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.severity ?? 5}
                onChange={(e) =>
                  setForm((p) => ({ ...p, severity: Number(e.target.value) }))
                }
                className="w-full"
              />
              <p className="text-xs text-center">
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${severityColor(form.severity ?? 5)}`}
                >
                  {form.severity ?? 5} / 10
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form.status || "Active"}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value as Complaint["status"],
                  }))
                }
              >
                <option>Active</option>
                <option>Resolving</option>
                <option>Resolved</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              data-ocid="patient_profile.complaints.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              data-ocid="patient_profile.complaints.submit_button"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {complaints.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.complaints.empty_state"
        >
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No complaints recorded
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([name, entries]) => (
            <div
              key={name}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50 border-b border-rose-100">
                <span className="font-semibold text-sm text-rose-800">
                  {name}
                </span>
                <Badge
                  className={`text-xs border ${entries[0].status === "Active" ? "bg-red-100 text-red-700 border-red-200" : entries[0].status === "Resolving" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-green-100 text-green-700 border-green-200"}`}
                >
                  {entries[0].status}
                </Badge>
              </div>
              <div className="divide-y divide-border">
                {entries.map((c, i) => (
                  <div
                    key={c.id}
                    className="px-4 py-3 flex items-center gap-3"
                    data-ocid={`patient_profile.complaints.item.${i + 1}`}
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs font-bold ${severityColor(c.severity)}`}
                    >
                      {c.severity}/10
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(c.date)} · Reported by: {c.reportedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Advice Tab ─────────────────────────────────────────────────────────────────

export function AdviceTab({
  patientId,
  canWrite,
}: {
  patientId: bigint;
  canWrite: boolean;
}) {
  const key = `patient_advice_${patientId}`;
  const [entries, setEntries] = useState<AdviceEntry[]>(() =>
    loadLS(key, seedAdvice()),
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<AdviceEntry>>({});

  const save = () => {
    if (!form.advice?.trim()) {
      toast.error("Advice text required");
      return;
    }
    const entry: AdviceEntry = {
      id: `adv_${Date.now()}`,
      advice: form.advice,
      date: form.date || new Date().toISOString().split("T")[0],
      givenBy: form.givenBy || "Doctor",
      visitRef: form.visitRef,
      followUpInstruction: form.followUpInstruction,
      followUpDate: form.followUpDate,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveLS(key, updated);
    setShowForm(false);
    setForm({});
    toast.success("Advice recorded");
  };

  return (
    <div className="space-y-4" data-ocid="patient_profile.advice_tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} advice entries
        </p>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            data-ocid="patient_profile.advice.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" /> Add Advice
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-amber-800">
            Record Doctor Advice
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Advice *</Label>
              <Textarea
                placeholder="Lifestyle, medication, diet advice..."
                value={form.advice || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, advice: e.target.value }))
                }
                rows={3}
                data-ocid="patient_profile.advice.textarea"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Given By</Label>
              <Input
                placeholder="Doctor name"
                value={form.givenBy || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, givenBy: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Follow-up Instruction</Label>
              <Input
                placeholder="Return in X weeks..."
                value={form.followUpInstruction || ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    followUpInstruction: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Follow-up Date</Label>
              <Input
                type="date"
                value={form.followUpDate || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, followUpDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              data-ocid="patient_profile.advice.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-ocid="patient_profile.advice.submit_button"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.advice.empty_state"
        >
          <Lightbulb className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No advice entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div
              key={e.id}
              className="bg-card border border-amber-200 rounded-xl p-4"
              data-ocid={`patient_profile.advice.item.${i + 1}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">
                    {e.advice}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {e.givenBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {fmtDate(e.date)}
                    </span>
                    {e.visitRef && (
                      <span className="text-blue-600">{e.visitRef}</span>
                    )}
                  </div>
                  {(e.followUpInstruction || e.followUpDate) && (
                    <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-xs text-blue-700">
                      <span className="font-semibold">Follow-up: </span>
                      {e.followUpInstruction}
                      {e.followUpDate && (
                        <span className="ml-2 font-semibold">
                          {fmtDate(e.followUpDate)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline Tab ───────────────────────────────────────────────────────────────

export function TimelineTab({
  patientId: _patientId,
  visits,
  prescriptions,
  patient,
}: {
  patientId: bigint;
  visits: Visit[];
  prescriptions: Prescription[];
  patient: Patient;
}) {
  const [filter, setFilter] = useState<
    | "All"
    | "Visits"
    | "Prescriptions"
    | "Investigations"
    | "Vitals"
    | "Admissions"
  >("All");

  type TimelineItem = {
    id: string;
    date: Date;
    type:
      | "Registration"
      | "Visit"
      | "Prescription"
      | "Investigation"
      | "Vital"
      | "Admission"
      | "Discharge"
      | "Referral"
      | "Note";
    title: string;
    detail: string;
  };

  const typeConfig: Record<
    TimelineItem["type"],
    { emoji: string; color: string; bg: string; border: string }
  > = {
    Registration: {
      emoji: "🏥",
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    Visit: {
      emoji: "👨‍⚕️",
      color: "text-indigo-700",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
    },
    Prescription: {
      emoji: "💊",
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    Investigation: {
      emoji: "🧪",
      color: "text-cyan-700",
      bg: "bg-cyan-50",
      border: "border-cyan-200",
    },
    Vital: {
      emoji: "❤️",
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    Admission: {
      emoji: "🏨",
      color: "text-purple-700",
      bg: "bg-purple-50",
      border: "border-purple-200",
    },
    Discharge: {
      emoji: "🚑",
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    Referral: {
      emoji: "📤",
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    Note: {
      emoji: "📋",
      color: "text-violet-700",
      bg: "bg-violet-50",
      border: "border-violet-200",
    },
  };

  const items: TimelineItem[] = [
    patient.createdAt
      ? {
          id: "reg",
          date: new Date(Number(patient.createdAt / 1000000n)),
          type: "Registration" as const,
          title: "Patient Registered",
          detail: `Registered as ${patient.patientType === "admitted" ? "Inpatient" : "OPD"} patient`,
        }
      : null,
    ...visits.map((v) => ({
      id: `v_${v.id}`,
      date: new Date(Number(v.visitDate / 1000000n)),
      type: (v.visitType === "admitted"
        ? "Admission"
        : "Visit") as TimelineItem["type"],
      title: v.visitType === "admitted" ? "Admitted" : "OPD Visit",
      detail: v.diagnosis || v.chiefComplaint || "Visit recorded",
    })),
    ...prescriptions.map((rx) => ({
      id: `rx_${rx.id}`,
      date: new Date(Number(rx.prescriptionDate / 1000000n)),
      type: "Prescription" as const,
      title: "Prescription Written",
      detail: `${rx.medications.length} medication(s) — ${rx.diagnosis || "no diagnosis"}`,
    })),
  ].filter(Boolean) as TimelineItem[];

  const filterMap: Record<typeof filter, TimelineItem["type"][]> = {
    All: [
      "Registration",
      "Visit",
      "Prescription",
      "Investigation",
      "Vital",
      "Admission",
      "Discharge",
      "Referral",
      "Note",
    ],
    Visits: ["Visit", "Admission", "Discharge"],
    Prescriptions: ["Prescription"],
    Investigations: ["Investigation"],
    Vitals: ["Vital"],
    Admissions: ["Admission", "Discharge"],
  };

  const filtered = items
    .filter((it) => filterMap[filter].includes(it.type))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const filterOpts: Array<typeof filter> = [
    "All",
    "Visits",
    "Prescriptions",
    "Investigations",
    "Vitals",
    "Admissions",
  ];

  return (
    <div className="space-y-4" data-ocid="patient_profile.timeline_tab">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filterOpts.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filter === f
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-card border-border text-muted-foreground hover:bg-muted/50"
            }`}
            data-ocid={`patient_profile.timeline.filter.${f.toLowerCase()}`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.timeline.empty_state"
        >
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No events to show</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-3">
            {filtered.map((item, i) => {
              const cfg = typeConfig[item.type];
              return (
                <div
                  key={item.id}
                  className="flex gap-4 relative"
                  data-ocid={`patient_profile.timeline.item.${i + 1}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full border-2 ${cfg.border} ${cfg.bg} flex items-center justify-center shrink-0 text-base z-10`}
                  >
                    {cfg.emoji}
                  </div>
                  <div
                    className={`flex-1 border ${cfg.border} ${cfg.bg} rounded-xl p-3`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold text-sm ${cfg.color}`}>
                        {item.title}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(item.date, "d MMM yyyy")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat Tab ───────────────────────────────────────────────────────────────────

export function ChatTab({
  patientId,
  patientName,
  currentUserName,
}: {
  patientId: bigint;
  patientName: string;
  currentUserName: string;
}) {
  const key = `patient_chat_${patientId}`;
  const defaultMessages: ChatMessage[] = [
    {
      id: "msg1",
      text: "Doctor, I have been feeling dizzy since yesterday evening.",
      sender: "patient",
      senderName: patientName,
      timestamp: "2026-05-12T09:15:00",
      seen: true,
    },
    {
      id: "msg2",
      text: "Thank you for letting me know. Please check your BP and share the reading. Avoid sudden standing up.",
      sender: "doctor",
      senderName: "Dr. Arman Kabir",
      timestamp: "2026-05-12T10:02:00",
      seen: true,
    },
    {
      id: "msg3",
      text: "BP was 148/94. Should I take an extra dose?",
      sender: "patient",
      senderName: patientName,
      timestamp: "2026-05-12T11:30:00",
      seen: false,
    },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadLS(key, defaultMessages),
  );
  const [newText, setNewText] = useState("");

  const sendMessage = () => {
    if (!newText.trim()) return;
    const msg: ChatMessage = {
      id: `msg_${Date.now()}`,
      text: newText.trim(),
      sender: "doctor",
      senderName: currentUserName || "Doctor",
      timestamp: now(),
      seen: false,
    };
    const updated = [...messages, msg];
    setMessages(updated);
    saveLS(key, updated);
    setNewText("");
  };

  const grouped = messages.reduce<Record<string, ChatMessage[]>>((acc, m) => {
    const d = m.timestamp.split("T")[0];
    acc[d] = acc[d] ? [...acc[d], m] : [m];
    return acc;
  }, {});

  return (
    <div
      className="flex flex-col"
      style={{ height: "60vh" }}
      data-ocid="patient_profile.chat_tab"
    >
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-4 pb-2">
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-2 my-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2">
                  {fmtDate(date)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {msgs.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === "patient" ? "justify-end" : "justify-start"} mb-2`}
                  data-ocid={`patient_profile.chat.item.${i + 1}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.sender === "patient" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}
                  >
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${m.sender === "patient" ? "text-blue-200" : "text-muted-foreground"}`}
                    >
                      <span>{format(new Date(m.timestamp), "h:mm a")}</span>
                      {m.sender === "doctor" && (
                        <span>{m.seen ? "✓✓" : "✓"}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t border-border pt-3 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          className="flex-1"
          data-ocid="patient_profile.chat.input"
        />
        <Button
          type="button"
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          data-ocid="patient_profile.chat.submit_button"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Appointments Tab ───────────────────────────────────────────────────────────

export function AppointmentsTab({
  patientId,
  canWrite,
}: {
  patientId: bigint;
  canWrite: boolean;
}) {
  const key = `patient_appointments_${patientId}`;
  const [appointments, setAppointments] = useState<AppointmentEntry[]>(() =>
    loadLS(key, seedAppointments()),
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<AppointmentEntry>>({
    status: "Pending",
  });

  const save = () => {
    if (!form.date || !form.doctor) {
      toast.error("Date and doctor required");
      return;
    }
    const entry: AppointmentEntry = {
      id: `ap_${Date.now()}`,
      date: form.date,
      time: form.time || "—",
      doctor: form.doctor,
      chamber: form.chamber || "—",
      type: form.type || "OPD",
      serialNumber: `#${String(Math.floor(Math.random() * 900) + 100)}`,
      status: form.status || "Pending",
      phone: form.phone,
    };
    const updated = [entry, ...appointments];
    setAppointments(updated);
    saveLS(key, updated);
    setShowForm(false);
    setForm({ status: "Pending" });
    toast.success("Appointment booked");
  };

  return (
    <div className="space-y-4" data-ocid="patient_profile.appointments_tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {appointments.length} appointments
        </p>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            data-ocid="patient_profile.appointments.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" /> Book Appointment
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-blue-800">
            New Appointment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={form.date || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={form.time || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, time: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Doctor *</Label>
              <Input
                placeholder="Doctor name"
                value={form.doctor || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, doctor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chamber / Location</Label>
              <Input
                placeholder="Chamber name"
                value={form.chamber || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, chamber: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form.type || "OPD"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, type: e.target.value }))
                }
              >
                <option>OPD</option>
                <option>Follow-up</option>
                <option>Consultation</option>
                <option>Emergency</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp Phone</Label>
              <Input
                placeholder="+880..."
                value={form.phone || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              data-ocid="patient_profile.appointments.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-ocid="patient_profile.appointments.submit_button"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {appointments.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.appointments.empty_state"
        >
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No appointments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((ap, i) => (
            <div
              key={ap.id}
              className="bg-card border border-border rounded-xl p-4"
              data-ocid={`patient_profile.appointments.item.${i + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      className={`text-xs border ${appointmentStatusColor(ap.status)}`}
                    >
                      {ap.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ap.type}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {ap.serialNumber}
                    </span>
                  </div>
                  <p className="font-semibold text-sm">{ap.doctor}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {fmtDate(ap.date)} at {ap.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {ap.chamber}
                    </span>
                  </div>
                </div>
                {ap.phone && (
                  <a
                    href={`https://wa.me/${ap.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Appointment reminder for ${fmtDate(ap.date)} at ${ap.time}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg px-2.5 py-1.5 shrink-0 transition-colors"
                    data-ocid={`patient_profile.appointments.whatsapp.${i + 1}`}
                  >
                    <Phone className="w-3 h-3" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pending Tab ────────────────────────────────────────────────────────────────

export function PendingTab({
  patientId,
  prescriptions,
}: { patientId: bigint; prescriptions: Prescription[] }) {
  const now_ = new Date();

  type PendingItem = {
    id: string;
    label: string;
    assignedTo: string;
    since: string;
    overdue: boolean;
    category: "approval" | "investigation" | "task" | "handover";
  };

  const invKey = `patient_pending_inv_${patientId}`;
  const pendingInv = loadLS<Array<{ name: string; orderedDate: string }>>(
    invKey,
    [
      { name: "Serum Creatinine (ordered)", orderedDate: "2026-05-11" },
      { name: "Fasting Blood Sugar", orderedDate: "2026-05-12" },
    ],
  );

  const hoKey = `patient_handovers_${patientId}`;
  const handovers = loadLS<HandoverEntry[]>(hoKey, seedHandovers());
  const pendingHO = handovers.filter((h) => !h.acknowledged);

  const items: PendingItem[] = [
    ...prescriptions
      .filter(
        (rx) => (rx as unknown as Record<string, unknown>).status === "draft",
      )
      .map((rx) => ({
        id: `rx_${rx.id}`,
        label: `Draft Prescription — ${rx.diagnosis || "No diagnosis"}`,
        assignedTo: "Awaiting MO/Consultant approval",
        since: format(
          new Date(Number(rx.prescriptionDate / 1000000n)),
          "d MMM yyyy",
        ),
        overdue:
          now_.getTime() - Number(rx.prescriptionDate / 1000000n) > 86400000,
        category: "approval" as const,
      })),
    ...pendingInv.map((inv, i) => ({
      id: `inv_${i}`,
      label: inv.name,
      assignedTo: "Lab — result pending",
      since: fmtDate(inv.orderedDate),
      overdue:
        now_.getTime() - new Date(inv.orderedDate).getTime() > 86400000 * 2,
      category: "investigation" as const,
    })),
    ...pendingHO.map((h) => ({
      id: `ho_${h.id}`,
      label: `${h.shift} Shift Handover — ${fmtDate(h.date)}`,
      assignedTo: "Incoming nurse — acknowledgment required",
      since: fmtDate(h.date),
      overdue: now_.getTime() - new Date(h.date).getTime() > 86400000,
      category: "handover" as const,
    })),
  ];

  const categories = [
    {
      key: "approval",
      label: "Pending Approvals",
      icon: "📋",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
    },
    {
      key: "investigation",
      label: "Pending Investigations",
      icon: "🧪",
      bg: "bg-cyan-50",
      border: "border-cyan-200",
      badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
    },
    {
      key: "task",
      label: "Pending Tasks",
      icon: "✅",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      key: "handover",
      label: "Pending Handover Acknowledgments",
      icon: "🤝",
      bg: "bg-purple-50",
      border: "border-purple-200",
      badge: "bg-purple-100 text-purple-700 border-purple-200",
    },
  ] as const;

  return (
    <div className="space-y-5" data-ocid="patient_profile.pending_tab">
      {items.filter((i) => i.overdue).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{items.filter((i) => i.overdue).length}</strong> item(s)
            overdue by more than 24 hours
          </span>
        </div>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((it) => it.category === cat.key);
        return (
          <div
            key={cat.key}
            className={`rounded-xl border ${cat.border} overflow-hidden`}
          >
            <div
              className={`flex items-center justify-between px-4 py-2.5 ${cat.bg}`}
            >
              <h3 className="text-sm font-semibold">
                {cat.icon} {cat.label}
              </h3>
              <Badge className={`text-xs border ${cat.badge}`}>
                {catItems.length}
              </Badge>
            </div>
            {catItems.length === 0 ? (
              <div
                className="px-4 py-4 text-center text-xs text-muted-foreground"
                data-ocid={`patient_profile.pending.${cat.key}.empty_state`}
              >
                None pending
              </div>
            ) : (
              <div className="divide-y divide-border">
                {catItems.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-4 py-3"
                    data-ocid={`patient_profile.pending.item.${i + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.assignedTo}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        Since {item.since}
                      </span>
                      {item.overdue && (
                        <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Handover Tab ───────────────────────────────────────────────────────────────

export function HandoverTab({ patientId }: { patientId: bigint }) {
  const key = `patient_handovers_${patientId}`;
  const [handovers, setHandovers] = useState<HandoverEntry[]>(() =>
    loadLS(key, seedHandovers()),
  );

  const acknowledge = (id: string) => {
    const updated = handovers.map((h) =>
      h.id === id ? { ...h, acknowledged: true } : h,
    );
    setHandovers(updated);
    saveLS(key, updated);
    toast.success("Handover acknowledged");
  };

  const shiftColor = (s: HandoverEntry["shift"]) =>
    ({
      Morning: "bg-amber-100 text-amber-700 border-amber-200",
      Evening: "bg-blue-100 text-blue-700 border-blue-200",
      Night: "bg-indigo-100 text-indigo-700 border-indigo-200",
    })[s];

  return (
    <div className="space-y-3" data-ocid="patient_profile.handover_tab">
      <p className="text-sm text-muted-foreground">
        {handovers.length} handover entries
      </p>
      {handovers.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.handover.empty_state"
        >
          <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No handover entries</p>
        </div>
      ) : (
        handovers.map((h, i) => (
          <div
            key={h.id}
            className="bg-card border border-border rounded-xl p-4"
            data-ocid={`patient_profile.handover.item.${i + 1}`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border ${shiftColor(h.shift)}`}>
                  {h.shift} Shift
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(h.date)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-xs border ${h.acknowledged ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}
                >
                  {h.acknowledged ? "✓ Acknowledged" : "Pending"}
                </Badge>
                {!h.acknowledged && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => acknowledge(h.id)}
                    data-ocid={`patient_profile.handover.acknowledge_button.${i + 1}`}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Outgoing: {h.outgoingName}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="font-semibold text-foreground mb-1">
                  Observations
                </p>
                <p className="text-muted-foreground">{h.observations}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="font-semibold text-foreground mb-1">
                  Medications Given
                </p>
                <p className="text-muted-foreground">{h.medicationsGiven}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="font-semibold text-foreground mb-1">
                  Pending Tasks
                </p>
                <p className="text-muted-foreground">{h.pendingTasks}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Referrals Tab ──────────────────────────────────────────────────────────────

export function ReferralsTab({
  patientId,
  canWrite,
}: {
  patientId: bigint;
  canWrite: boolean;
}) {
  const key = `patient_referrals_${patientId}`;
  const [referrals, setReferrals] = useState<ReferralEntry[]>(() =>
    loadLS(key, seedReferrals()),
  );
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ReferralEntry>>({
    urgency: "Routine",
    status: "Sent",
  });

  const save = () => {
    if (!form.specialist || !form.reason) {
      toast.error("Specialist and reason required");
      return;
    }
    const entry: ReferralEntry = {
      id: `ref_${Date.now()}`,
      referringDoctor: form.referringDoctor || "Doctor",
      specialist: form.specialist,
      hospital: form.hospital || "—",
      reason: form.reason,
      urgency: form.urgency || "Routine",
      date: form.date || new Date().toISOString().split("T")[0],
      status: form.status || "Sent",
      letterText: form.letterText,
    };
    const updated = [entry, ...referrals];
    setReferrals(updated);
    saveLS(key, updated);
    setShowForm(false);
    setForm({ urgency: "Routine", status: "Sent" });
    toast.success("Referral letter generated");
  };

  return (
    <div className="space-y-4" data-ocid="patient_profile.referrals_tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {referrals.length} referrals
        </p>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
            data-ocid="patient_profile.referrals.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" /> Generate Referral
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-teal-800">
            Generate Referral Letter
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Referring Doctor</Label>
              <Input
                placeholder="Your name"
                value={form.referringDoctor || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, referringDoctor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Specialist / Department *</Label>
              <Input
                placeholder="Cardiology, Nephrology..."
                value={form.specialist || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, specialist: e.target.value }))
                }
                data-ocid="patient_profile.referrals.specialist_input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hospital / Clinic</Label>
              <Input
                placeholder="Destination hospital"
                value={form.hospital || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hospital: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Urgency</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form.urgency || "Routine"}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    urgency: e.target.value as ReferralEntry["urgency"],
                  }))
                }
              >
                <option>Urgent</option>
                <option>Routine</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Reason for Referral *</Label>
              <Input
                placeholder="Brief clinical reason"
                value={form.reason || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reason: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Letter Text (optional)</Label>
              <Textarea
                placeholder="Dear Colleague, ..."
                rows={4}
                value={form.letterText || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, letterText: e.target.value }))
                }
                data-ocid="patient_profile.referrals.letter_textarea"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              data-ocid="patient_profile.referrals.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              className="bg-teal-600 hover:bg-teal-700 text-white"
              data-ocid="patient_profile.referrals.submit_button"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {referrals.length === 0 ? (
        <div
          className="text-center py-10"
          data-ocid="patient_profile.referrals.empty_state"
        >
          <ExternalLink className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No referrals yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map((r, i) => (
            <div
              key={r.id}
              className="bg-card border border-border rounded-xl overflow-hidden"
              data-ocid={`patient_profile.referrals.item.${i + 1}`}
            >
              <div className="flex items-start justify-between gap-2 p-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      className={`text-xs border ${referralStatusColor(r.status)}`}
                    >
                      {r.status}
                    </Badge>
                    <Badge
                      className={`text-xs border ${r.urgency === "Urgent" ? "bg-red-100 text-red-700 border-red-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}
                    >
                      {r.urgency}
                    </Badge>
                  </div>
                  <p className="font-semibold text-sm">
                    {r.specialist} — {r.hospital}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.reason}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Referred by: {r.referringDoctor} · {fmtDate(r.date)}
                  </p>
                </div>
                {r.letterText && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs"
                    onClick={() =>
                      setExpandedId(expandedId === r.id ? null : r.id)
                    }
                    data-ocid={`patient_profile.referrals.view_button.${i + 1}`}
                  >
                    {expandedId === r.id ? "Hide" : "View Letter"}
                  </Button>
                )}
              </div>
              {expandedId === r.id && r.letterText && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {r.letterText}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SOAP Notes Tab ─────────────────────────────────────────────────────────────

export function SOAPNotesTab({
  patientId,
  isAdmitted,
  canWrite,
}: {
  patientId: bigint;
  isAdmitted: boolean;
  canWrite: boolean;
}) {
  const key = `patient_soap_${patientId}`;
  const [notes, setNotes] = useState<SOAPNote[]>(() =>
    loadLS(key, isAdmitted ? seedSOAPNotes() : []),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<SOAPNote>>({ authorRole: "MO" });

  const todayStr = new Date().toISOString().split("T")[0];
  const hasToday = notes.some((n) => n.date === todayStr);

  const save = () => {
    if (!form.subjective?.trim()) {
      toast.error("Subjective section required");
      return;
    }
    const entry: SOAPNote = {
      id: `soap_${Date.now()}`,
      date: todayStr,
      authorName: form.authorName || "Doctor",
      authorRole: form.authorRole || "MO",
      finalized: false,
      subjective: form.subjective,
      objective: form.objective || "",
      assessment: form.assessment || "",
      plan: form.plan || "",
    };
    const updated = [entry, ...notes];
    setNotes(updated);
    saveLS(key, updated);
    setShowNew(false);
    setForm({ authorRole: "MO" });
    toast.success("SOAP note saved");
  };

  if (!isAdmitted) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center"
        data-ocid="patient_profile.soap_notes.empty_state"
      >
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
          <FileText className="w-7 h-7 text-violet-600" />
        </div>
        <p className="font-semibold text-foreground">
          SOAP Notes — Admitted Patients Only
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          This patient is currently an outpatient. SOAP notes are created when
          the patient is admitted.
        </p>
      </div>
    );
  }

  const roleColor = (r: SOAPNote["authorRole"]) =>
    ({
      Intern: "bg-violet-100 text-violet-700 border-violet-200",
      MO: "bg-teal-100 text-teal-700 border-teal-200",
      Consultant: "bg-blue-100 text-blue-700 border-blue-200",
    })[r];

  return (
    <div className="space-y-4" data-ocid="patient_profile.soap_notes_tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {notes.length} SOAP notes
        </p>
        {canWrite && !hasToday && (
          <Button
            size="sm"
            onClick={() => setShowNew(true)}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            data-ocid="patient_profile.soap_notes.open_modal_button"
          >
            <Plus className="w-3.5 h-3.5" /> Today&apos;s Note
          </Button>
        )}
        {hasToday && (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
            ✓ Today&apos;s note done
          </Badge>
        )}
      </div>

      {showNew && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-violet-800">
            Today&apos;s SOAP Note
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Author Name</Label>
              <Input
                placeholder="Your name"
                value={form.authorName || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, authorName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form.authorRole || "MO"}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    authorRole: e.target.value as SOAPNote["authorRole"],
                  }))
                }
              >
                <option value="Intern">Intern</option>
                <option value="MO">MO</option>
                <option value="Consultant">Consultant</option>
              </select>
            </div>
            {(["subjective", "objective", "assessment", "plan"] as const).map(
              (field) => (
                <div key={field} className="space-y-1 sm:col-span-2">
                  <Label className="text-xs capitalize">
                    {field} {field === "subjective" ? "*" : ""}
                  </Label>
                  <Textarea
                    placeholder={
                      {
                        subjective: "What does the patient report today?",
                        objective:
                          "Vitals, examination findings, test results...",
                        assessment: "Working diagnosis, clinical status...",
                        plan: "Medications, investigations, instructions...",
                      }[field]
                    }
                    rows={2}
                    value={(form[field] as string) || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [field]: e.target.value }))
                    }
                    data-ocid={`patient_profile.soap_notes.${field}_textarea`}
                  />
                </div>
              ),
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNew(false)}
              data-ocid="patient_profile.soap_notes.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-ocid="patient_profile.soap_notes.submit_button"
            >
              Save Note
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div
          className="text-center py-8"
          data-ocid="patient_profile.soap_notes.list_empty"
        >
          <p className="text-sm text-muted-foreground">
            No SOAP notes recorded yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className="bg-card border border-border rounded-xl overflow-hidden"
              data-ocid={`patient_profile.soap_notes.item.${i + 1}`}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {fmtDate(note.date)}
                  </span>
                  <Badge
                    className={`text-xs border ${roleColor(note.authorRole)}`}
                  >
                    {note.authorRole}
                  </Badge>
                  {note.finalized && (
                    <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                      ✓ Finalized
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {note.authorName}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() =>
                      setExpandedId(expandedId === note.id ? null : note.id)
                    }
                    data-ocid={`patient_profile.soap_notes.expand_button.${i + 1}`}
                  >
                    {expandedId === note.id ? "Collapse" : "Expand"}
                  </Button>
                </div>
              </div>
              {note.vitalsStrip && (
                <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-mono">
                  {note.vitalsStrip}
                </div>
              )}
              {expandedId === note.id && (
                <div className="divide-y divide-border">
                  {(
                    ["subjective", "objective", "assessment", "plan"] as const
                  ).map((field) => (
                    <div key={field} className="px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                        {field === "subjective"
                          ? "S — Subjective"
                          : field === "objective"
                            ? "O — Objective"
                            : field === "assessment"
                              ? "A — Assessment"
                              : "P — Plan"}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {(note[field] as string) || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Account Tab ────────────────────────────────────────────────────────────────

export function AccountTab({
  patient,
  patientId,
  isAdmin,
  onEdit,
}: {
  patient: Patient;
  patientId: bigint;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const notifKey = `patient_notifs_${patientId}`;
  const [notifs, setNotifs] = useState(() =>
    loadLS(notifKey, {
      appointmentReminders: true,
      labResultAlerts: true,
      prescriptionExpiry: true,
      whatsappNotifications: false,
    }),
  );

  const toggleNotif = (k: keyof typeof notifs) => {
    const updated = { ...notifs, [k]: !notifs[k] };
    setNotifs(updated);
    saveLS(notifKey, updated);
    toast.success("Notification preference updated");
  };

  const registerNumber = (patient as unknown as { registerNumber?: string })
    .registerNumber;

  return (
    <div className="space-y-5" data-ocid="patient_profile.account_tab">
      {/* Profile Section */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" /> Profile
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={onEdit}
            data-ocid="patient_profile.account.edit_button"
          >
            Edit Profile
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: "Full Name", value: patient.fullName },
            {
              label: "Phone",
              value: (patient as unknown as { phone?: string }).phone || "—",
            },
            { label: "Email", value: patient.email || "—" },
            { label: "Address", value: patient.address || "—" },
            {
              label: "Emergency Contact",
              value:
                (patient as unknown as { emergencyContact?: string })
                  .emergencyContact || "—",
            },
            { label: "Blood Group", value: patient.bloodGroup || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium text-foreground truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-green-600" /> Security
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Last login:{" "}
            <span className="text-foreground font-medium">
              Today, {format(new Date(), "h:mm a")}
            </span>
          </p>
          <p>
            Active sessions:{" "}
            <span className="text-foreground font-medium">1 device</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-1.5 text-xs"
          data-ocid="patient_profile.account.change_password_button"
        >
          Change Password
        </Button>
      </div>

      {/* Notification Preferences */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">
          🔔 Notification Preferences
        </h3>
        <div className="space-y-3">
          {(
            [
              { key: "appointmentReminders", label: "Appointment Reminders" },
              { key: "labResultAlerts", label: "Lab Result Alerts" },
              {
                key: "prescriptionExpiry",
                label: "Prescription Expiry Reminders",
              },
              { key: "whatsappNotifications", label: "WhatsApp Notifications" },
            ] as const
          ).map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-sm text-foreground">{label}</span>
              <button
                type="button"
                onClick={() => toggleNotif(key)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 ${notifs[key] ? "bg-teal-600" : "bg-muted"}`}
                data-ocid={`patient_profile.account.notif_${key}.toggle`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${notifs[key] ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Registration Info */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">📋 Registration Info</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Register Number</p>
            <p className="font-mono font-semibold text-foreground">
              {registerNumber || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Registration Date</p>
            <p className="font-medium">
              {patient.createdAt
                ? format(
                    new Date(Number(patient.createdAt / 1000000n)),
                    "d MMM yyyy",
                  )
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Patient Type</p>
            <p className="font-medium capitalize">
              {patient.patientType || "OPD"}
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-red-700 mb-2">
            ⚠️ Danger Zone
          </h3>
          <p className="text-xs text-red-600 mb-3">
            These actions are irreversible. Proceed with extreme caution.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-red-400 text-red-700 hover:bg-red-100 gap-1.5 text-xs"
            data-ocid="patient_profile.account.deactivate_button"
          >
            Deactivate Account
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Inv. Payment Tab ───────────────────────────────────────────────────────────

export function InvPaymentTab({
  patientId,
  patientName,
}: {
  patientId: bigint;
  patientName: string;
}) {
  const key = `patient_inv_payments_${patientId}`;
  const [records, _setRecords] = useState<InvPaymentRecord[]>(() =>
    loadLS(key, seedInvPayments()),
  );
  const [dateFilter, setDateFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">(
    "all",
  );

  const filtered = records.filter((r) => {
    if (dateFilter && !r.date.startsWith(dateFilter)) return false;
    if (paidFilter === "paid" && !r.paid) return false;
    if (paidFilter === "unpaid" && r.paid) return false;
    return true;
  });

  const totalPaid = records
    .filter((r) => r.paid)
    .reduce((sum, r) => sum + r.finalAmount, 0);
  const totalUnpaid = records
    .filter((r) => !r.paid)
    .reduce((sum, r) => sum + r.finalAmount, 0);

  const printReceipt = (r: InvPaymentRecord) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Receipt ${r.receiptNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 20px auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0d9488, #0891b2); color: white; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 18px; }
            .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.85; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { text-align: left; padding: 6px 8px; font-size: 13px; border-bottom: 1px solid #eee; }
            th { font-weight: 600; color: #555; }
            .total { font-weight: bold; font-size: 16px; margin-top: 12px; text-align: right; color: #0d9488; }
            .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Dr. Arman Kabir's Care</h2>
            <p>Investigation Receipt — ${r.receiptNumber}</p>
          </div>
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Date:</strong> ${fmtDate(r.date)}</p>
          <table>
            <tr><th>Test</th><th>Rate</th><th>Discount</th><th>Final</th></tr>
            <tr><td>${r.testName}</td><td>৳${r.rate}</td><td>${r.discount}%</td><td>৳${r.finalAmount}</td></tr>
          </table>
          <p class="total">Total: ৳${r.finalAmount}</p>
          <p><strong>Payment:</strong> ${r.paymentMethod || "—"} | <strong>Status:</strong> ${r.paid ? "PAID" : "UNPAID"}</p>
          <div class="footer">Thank you for choosing Dr. Arman Kabir's Care</div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4" data-ocid="patient_profile.inv_payment_tab">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-700 font-medium">Total Paid</p>
          <p className="text-xl font-bold text-green-800">
            ৳{totalPaid.toLocaleString()}
          </p>
        </div>
        {totalUnpaid > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-700 font-medium">Outstanding Due</p>
            <p className="text-xl font-bold text-red-800">
              ৳{totalUnpaid.toLocaleString()}
            </p>
          </div>
        )}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs text-blue-700 font-medium">Total Records</p>
          <p className="text-xl font-bold text-blue-800">{records.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          type="month"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-36 h-8 text-xs"
          placeholder="Filter by month"
          data-ocid="patient_profile.inv_payment.date_filter"
        />
        {(["all", "paid", "unpaid"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setPaidFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
              paidFilter === f
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-card border-border text-muted-foreground hover:bg-muted/50"
            }`}
            data-ocid={`patient_profile.inv_payment.filter.${f}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-8"
          data-ocid="patient_profile.inv_payment.empty_state"
        >
          <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                {[
                  "Receipt",
                  "Test",
                  "Date",
                  "Rate",
                  "Discount",
                  "Final",
                  "Method",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-muted/20"
                  data-ocid={`patient_profile.inv_payment.item.${i + 1}`}
                >
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                    {r.receiptNumber}
                  </td>
                  <td className="py-2.5 px-3 font-medium max-w-[140px] truncate">
                    {r.testName}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(r.date)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    ৳{r.rate}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {r.discount}%
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                    ৳{r.finalAmount}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">
                    {r.paymentMethod || "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge
                      className={`text-xs border ${r.paid ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
                    >
                      {r.paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => printReceipt(r)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      data-ocid={`patient_profile.inv_payment.download_button.${i + 1}`}
                    >
                      <Download className="w-3.5 h-3.5" /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <p className="text-sm font-semibold">
          Total Paid:{" "}
          <span className="text-green-700">৳{totalPaid.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}
