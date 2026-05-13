/**
 * ProcedureLog — records clinical procedures for a patient.
 * Props: patientId, patient
 * Storage key: procedureLogs_${patientId}
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useEmailAuth } from "../hooks/useEmailAuth";
import type { MoneyReceiptData, Patient } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProcedureRecord {
  id: string;
  procedureName: string;
  dateTime: string; // ISO
  performedBy: string;
  indication: string;
  technique?: string;
  outcome: string;
  complications: boolean;
  complicationDetails?: string;
  consentObtained: boolean;
  linkedReceiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROCEDURE_SUGGESTIONS = [
  "Catheter insertion",
  "IV access",
  "Blood transfusion",
  "ECG",
  "Lumbar puncture",
  "Chest drain",
  "Intubation",
  "Central line",
  "FNAC",
  "Biopsy",
  "Minor surgery",
  "Suturing",
  "Wound debridement",
  "Nasogastric tube insertion",
  "Thoracocentesis",
  "Other",
];

const OUTCOME_OPTIONS = [
  "Successful",
  "Partially successful",
  "Unsuccessful",
  "Complication occurred",
];

const STORAGE_PREFIX = "procedureLogs_";

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadProcedureLogs(patientId: string): ProcedureRecord[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${patientId}`);
    return raw ? (JSON.parse(raw) as ProcedureRecord[]) : [];
  } catch {
    return [];
  }
}

function saveProcedureLogs(patientId: string, logs: ProcedureRecord[]) {
  localStorage.setItem(`${STORAGE_PREFIX}${patientId}`, JSON.stringify(logs));
}

// ── Procedure receipts helper ─────────────────────────────────────────────────

function getProcedureReceipts(patientId: string): MoneyReceiptData[] {
  try {
    const all: MoneyReceiptData[] = JSON.parse(
      localStorage.getItem("money_receipts") || "[]",
    );
    return all.filter(
      (r) => r.type === "procedure" && r.patientId === patientId,
    );
  } catch {
    return [];
  }
}

// ── Empty form state ──────────────────────────────────────────────────────────

function emptyForm(): Omit<ProcedureRecord, "id" | "createdAt" | "updatedAt"> {
  return {
    procedureName: "",
    dateTime: new Date().toISOString().slice(0, 16),
    performedBy: "",
    indication: "",
    technique: "",
    outcome: "Successful",
    complications: false,
    complicationDetails: "",
    consentObtained: false,
    linkedReceiptId: null,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProcedureLogProps {
  patientId: string;
  patient: Patient;
}

export default function ProcedureLog({
  patientId,
  patient,
}: ProcedureLogProps) {
  const { currentDoctor } = useEmailAuth();
  const doctorName = currentDoctor?.name ?? "";

  const [logs, setLogs] = useState<ProcedureRecord[]>(() =>
    loadProcedureLogs(patientId),
  );

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<
    Omit<ProcedureRecord, "id" | "createdAt" | "updatedAt">
  >(() => ({ ...emptyForm(), performedBy: doctorName }));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
    [logs],
  );

  const procedureReceipts = useMemo(
    () => getProcedureReceipts(patientId),
    [patientId],
  );

  // ── Field helpers ──────────────────────────────────────────────────────────
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── Open form for add / edit ───────────────────────────────────────────────
  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm(), performedBy: doctorName });
    setShowForm(true);
  }

  function openEdit(log: ProcedureRecord) {
    setEditId(log.id);
    setForm({
      procedureName: log.procedureName,
      dateTime: log.dateTime.slice(0, 16),
      performedBy: log.performedBy,
      indication: log.indication,
      technique: log.technique ?? "",
      outcome: log.outcome,
      complications: log.complications,
      complicationDetails: log.complicationDetails ?? "",
      consentObtained: log.consentObtained,
      linkedReceiptId: log.linkedReceiptId,
    });
    setShowForm(true);
  }

  // ── Validate & save ────────────────────────────────────────────────────────
  function handleSave() {
    if (!form.procedureName.trim()) {
      toast.error("Procedure name is required");
      return;
    }
    if (!form.consentObtained) {
      toast.error("Consent must be obtained before saving a procedure");
      return;
    }
    if (!form.indication.trim()) {
      toast.error("Please enter the clinical indication");
      return;
    }

    const now = new Date().toISOString();
    let updated: ProcedureRecord[];

    if (editId) {
      updated = logs.map((l) =>
        l.id === editId ? { ...l, ...form, updatedAt: now } : l,
      );
      toast.success("Procedure record updated");
    } else {
      const newRec: ProcedureRecord = {
        ...form,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        createdAt: now,
        updatedAt: now,
      };
      updated = [newRec, ...logs];
      toast.success("Procedure recorded");
    }

    setLogs(updated);
    saveProcedureLogs(patientId, updated);
    setShowForm(false);
    setEditId(null);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveProcedureLogs(patientId, updated);
    toast.success("Procedure record deleted");
  }

  // ── Cancel form ───────────────────────────────────────────────────────────
  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ ...emptyForm(), performedBy: doctorName });
  }

  return (
    <div className="space-y-4" data-ocid="procedure_log.panel">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          Procedure Log
          {logs.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({logs.length})
            </span>
          )}
        </h2>
        <Button
          size="sm"
          onClick={openAdd}
          className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          data-ocid="procedure_log.add_button"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Procedure
        </Button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-teal-800 text-sm">
            {editId ? "Edit Procedure Record" : "New Procedure Record"}
          </h3>

          {/* Procedure name */}
          <div className="relative">
            <Label className="text-xs font-semibold">Procedure Name *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={form.procedureName}
                onChange={(e) => set("procedureName", e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. IV access"
                className="flex-1 text-sm"
                data-ocid="procedure_log.procedure_name.input"
              />
            </div>
            {showSuggestions && (
              <div className="absolute top-[60px] left-0 right-0 z-20 bg-white border border-teal-200 rounded-xl shadow-lg py-1 max-h-44 overflow-y-auto">
                {PROCEDURE_SUGGESTIONS.filter((s) =>
                  s.toLowerCase().includes(form.procedureName.toLowerCase()),
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 text-gray-700"
                    onMouseDown={() => set("procedureName", s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* Chip suggestions */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {PROCEDURE_SUGGESTIONS.slice(0, 7).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("procedureName", s)}
                  className="text-[10px] bg-white border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full hover:bg-teal-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date / Time + Performed By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Date & Time *</Label>
              <input
                type="datetime-local"
                value={form.dateTime}
                onChange={(e) => set("dateTime", e.target.value)}
                className="w-full mt-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-teal-300"
                data-ocid="procedure_log.datetime.input"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Performed By *</Label>
              <Input
                value={form.performedBy}
                onChange={(e) => set("performedBy", e.target.value)}
                placeholder="Doctor / Nurse name"
                className="mt-1 text-sm"
                data-ocid="procedure_log.performed_by.input"
              />
            </div>
          </div>

          {/* Indication */}
          <div>
            <Label className="text-xs font-semibold">Indication *</Label>
            <Textarea
              value={form.indication}
              onChange={(e) => set("indication", e.target.value)}
              placeholder="Clinical reason for this procedure"
              rows={2}
              className="mt-1 text-sm"
              data-ocid="procedure_log.indication.textarea"
            />
          </div>

          {/* Technique (optional) */}
          <div>
            <Label className="text-xs font-semibold">
              Technique (optional)
            </Label>
            <Textarea
              value={form.technique}
              onChange={(e) => set("technique", e.target.value)}
              placeholder="Brief technique notes..."
              rows={2}
              className="mt-1 text-sm"
              data-ocid="procedure_log.technique.textarea"
            />
          </div>

          {/* Outcome */}
          <div>
            <Label className="text-xs font-semibold">Outcome *</Label>
            <Select
              value={form.outcome}
              onValueChange={(v) => set("outcome", v)}
            >
              <SelectTrigger
                className="mt-1 text-sm"
                data-ocid="procedure_log.outcome.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o} className="text-sm">
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Complications */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold">Complications?</Label>
              <div className="flex gap-2">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => set("complications", val)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      form.complications === val
                        ? val
                          ? "bg-red-100 text-red-800 border-red-400 ring-2 ring-red-300"
                          : "bg-green-100 text-green-800 border-green-400 ring-2 ring-green-300"
                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                    data-ocid={`procedure_log.complications_${val ? "yes" : "no"}.toggle`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
            {form.complications && (
              <div>
                <Label className="text-xs font-semibold text-red-700">
                  Complication Details *
                </Label>
                <Textarea
                  value={form.complicationDetails}
                  onChange={(e) => set("complicationDetails", e.target.value)}
                  placeholder="Describe what happened..."
                  rows={2}
                  className="mt-1 text-sm border-red-200 focus:ring-red-300"
                  data-ocid="procedure_log.complication_details.textarea"
                />
              </div>
            )}
          </div>

          {/* Consent */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold">Consent Obtained</Label>
              <button
                type="button"
                onClick={() => set("consentObtained", !form.consentObtained)}
                className={`w-10 h-5 rounded-full relative transition-colors ${
                  form.consentObtained ? "bg-teal-500" : "bg-gray-300"
                }`}
                data-ocid="procedure_log.consent.toggle"
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    form.consentObtained ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-teal-700">
                {form.consentObtained ? "Yes" : "No"}
              </span>
            </div>
            {!form.consentObtained && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium">
                  Procedure cannot be saved without confirming consent obtained
                </p>
              </div>
            )}
          </div>

          {/* Link to receipt */}
          {procedureReceipts.length > 0 && (
            <div>
              <Label className="text-xs font-semibold">
                Link to Procedure Receipt (optional)
              </Label>
              <Select
                value={form.linkedReceiptId ?? "none"}
                onValueChange={(v) =>
                  set("linkedReceiptId", v === "none" ? null : v)
                }
              >
                <SelectTrigger
                  className="mt-1 text-sm"
                  data-ocid="procedure_log.receipt.select"
                >
                  <SelectValue placeholder="Select receipt..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="none"
                    className="text-sm text-muted-foreground"
                  >
                    None
                  </SelectItem>
                  {procedureReceipts.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-sm">
                      {r.receiptNumber} — ৳{r.finalAmount ?? r.amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Form actions */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
              data-ocid="procedure_log.save_button"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {editId ? "Update Record" : "Save Procedure"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelForm}
              data-ocid="procedure_log.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {sortedLogs.length === 0 && !showForm ? (
        <div
          className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border"
          data-ocid="procedure_log.empty_state"
        >
          <Stethoscope className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No procedures recorded yet
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click "Add Procedure" to record a clinical procedure for{" "}
            {patient.fullName}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header — desktop only */}
          <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto_auto] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 pb-1 border-b border-border">
            <span>Procedure</span>
            <span>Date / Time</span>
            <span>Performed By</span>
            <span>Outcome</span>
            <span>Complic.</span>
            <span>Consent</span>
            <span>Actions</span>
          </div>

          {sortedLogs.map((log, idx) => (
            <ProcedureRow
              key={log.id}
              log={log}
              index={idx}
              expanded={expandedId === log.id}
              onToggle={() =>
                setExpandedId(expandedId === log.id ? null : log.id)
              }
              onEdit={() => openEdit(log)}
              onDelete={() => handleDelete(log.id)}
              receiptLabel={
                log.linkedReceiptId
                  ? procedureReceipts.find((r) => r.id === log.linkedReceiptId)
                      ?.receiptNumber
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Procedure Row ─────────────────────────────────────────────────────────────

function ProcedureRow({
  log,
  index,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  receiptLabel,
}: {
  log: ProcedureRecord;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  receiptLabel?: string;
}) {
  const isConsentMissing = !log.consentObtained && log.complications;

  return (
    <div
      className={`border rounded-xl overflow-hidden ${
        isConsentMissing ? "border-red-300" : "border-border"
      }`}
      data-ocid={`procedure_log.item.${index + 1}`}
    >
      {/* Main row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-1 md:gap-3 items-center">
          <p className="text-sm font-medium text-foreground truncate">
            {log.procedureName}
            {isConsentMissing && (
              <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 border border-red-300 rounded-full px-1.5 py-0.5 font-semibold">
                ⚠️ No Consent + Complication
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {log.dateTime
              ? format(new Date(log.dateTime), "dd MMM yyyy, HH:mm")
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{log.performedBy}</p>
          <p className="text-xs font-medium text-foreground">{log.outcome}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Complications badge */}
          {log.complications ? (
            <Badge className="text-[10px] border bg-red-100 text-red-700 border-red-200 px-1.5 py-0">
              Complic.
            </Badge>
          ) : (
            <Badge className="text-[10px] border bg-green-100 text-green-700 border-green-200 px-1.5 py-0">
              None
            </Badge>
          )}

          {/* Consent badge */}
          {log.consentObtained ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          )}

          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-border space-y-2">
          {log.indication && (
            <p className="text-xs text-muted-foreground">
              <strong>Indication:</strong> {log.indication}
            </p>
          )}
          {log.technique && (
            <p className="text-xs text-muted-foreground">
              <strong>Technique:</strong> {log.technique}
            </p>
          )}
          {log.complications && log.complicationDetails && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                <strong>Complication:</strong> {log.complicationDetails}
              </p>
            </div>
          )}
          {receiptLabel && (
            <p className="text-xs text-muted-foreground">
              <strong>Linked Receipt:</strong> {receiptLabel}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            <strong>Recorded:</strong>{" "}
            {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
            {log.updatedAt !== log.createdAt && (
              <span className="ml-2 text-amber-600">
                (Updated: {format(new Date(log.updatedAt), "HH:mm")})
              </span>
            )}
          </p>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="h-7 px-2 text-xs gap-1 border-amber-300 text-amber-700"
              data-ocid={`procedure_log.edit_button.${index + 1}`}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 border-red-300 text-red-700"
                  data-ocid={`procedure_log.delete_button.${index + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-ocid="procedure_log.dialog">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Procedure Record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the record for{" "}
                    <strong>{log.procedureName}</strong>. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-ocid="procedure_log.cancel_button">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-ocid="procedure_log.confirm_button"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
