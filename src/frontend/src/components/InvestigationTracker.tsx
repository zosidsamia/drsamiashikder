/**
 * InvestigationTracker — Status tracking, result entry, and AI interpretation
 * for ordered investigations. Used inside the Investigations tab of PatientDashboard.
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  FlaskConical,
  MessageSquare,
  Plus,
  TestTube,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { buildWhatsAppUrl, normalisePhone } from "../lib/whatsappTemplates";
import type { StaffRole } from "../types";

export type InvStatus = "ordered" | "sample_collected" | "report_collected";

export type InterpretationLabel =
  | "Normal"
  | "Abnormal High"
  | "Abnormal Low"
  | "Critical";

export interface InvResult {
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: InterpretationLabel;
  notes?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface TrackedInvestigation {
  id: string;
  name: string;
  orderedAt: string; // ISO string
  orderedBy: string;
  status: InvStatus;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
  result?: InvResult;
  visitId?: string;
  /** Linked to prescription clinical summary */
  linkedToPrescription?: boolean;
}

interface InvestigationTrackerProps {
  patientId: string;
  patientPhone?: string;
  viewerRole?: StaffRole;
  currentRole?: string;
}

// ── Storage helpers ────────────────────────────────────────────────────────────
const getTrackerKey = (patientId: string) => `inv_tracker_${patientId}`;

export function loadTrackedInvestigations(
  patientId: string,
): TrackedInvestigation[] {
  try {
    const raw = localStorage.getItem(getTrackerKey(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTrackedInvestigations(
  patientId: string,
  items: TrackedInvestigation[],
) {
  try {
    localStorage.setItem(getTrackerKey(patientId), JSON.stringify(items));
  } catch {}
}

// ── Rule-based AI interpretation ───────────────────────────────────────────────
export function generateAIInterpretation(
  name: string,
  result: InvResult,
  allReadings: Array<{ value: string; recordedAt: string }>,
): string {
  const val = Number.parseFloat(result.value);
  const n = name.toLowerCase();
  const isNum = !Number.isNaN(val);

  // Trend analysis
  let trendText = "";
  if (allReadings.length >= 2 && isNum) {
    const sorted = [...allReadings]
      .filter((r) => !Number.isNaN(Number.parseFloat(r.value)))
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );
    if (sorted.length >= 2) {
      const prev = Number.parseFloat(sorted[sorted.length - 2].value);
      const curr = Number.parseFloat(sorted[sorted.length - 1].value);
      if (curr > prev * 1.1) trendText = " Trend: ↑ rising over last readings.";
      else if (curr < prev * 0.9)
        trendText = " Trend: ↓ falling over last readings.";
      else trendText = " Trend: → stable.";
    }
  }

  // Rule-based interpretation
  let suggestion = "";

  if (n.includes("hemoglobin") || n === "hb" || n.includes("hb%")) {
    if (!isNum) return "See report";
    if (val < 7)
      suggestion = `Severe anaemia (Hb ${val} g/dL). Urgent transfusion may be needed.`;
    else if (val < 10)
      suggestion = `Moderate anaemia (Hb ${val} g/dL). Check iron, B12, folate.`;
    else if (val < 12)
      suggestion = `Mild anaemia (Hb ${val} g/dL, normal 12–16 g/dL).${trendText}`;
    else
      suggestion = `Hemoglobin ${val} g/dL — within normal range.${trendText}`;
  } else if (n.includes("creatinine")) {
    if (!isNum) return "See report";
    if (val > 3.0)
      suggestion = `Creatinine ${val} mg/dL — severely elevated. AKI or CKD likely. Nephrology consult advised.${trendText}`;
    else if (val > 1.5)
      suggestion = `Creatinine ${val} mg/dL — elevated (normal <1.2 mg/dL). Possible renal impairment.${trendText} Consider nephrology review.`;
    else suggestion = `Creatinine ${val} mg/dL — normal range.${trendText}`;
  } else if (n.includes("potassium") || n.includes("k+")) {
    if (!isNum) return "See report";
    if (val >= 6.0)
      suggestion = `⚠️ CRITICAL: K⁺ ${val} mmol/L — severe hyperkalemia. Cardiac risk. Immediate management required.`;
    else if (val > 5.0)
      suggestion = `K⁺ ${val} mmol/L — hyperkalemia (normal 3.5–5.0 mmol/L). Review medications.${trendText}`;
    else if (val < 2.5)
      suggestion = `⚠️ K⁺ ${val} mmol/L — severe hypokalemia. Arrhythmia risk. Supplement urgently.`;
    else if (val < 3.5)
      suggestion = `K⁺ ${val} mmol/L — hypokalemia (normal 3.5–5.0). Oral/IV potassium supplement.${trendText}`;
    else suggestion = `K⁺ ${val} mmol/L — normal.${trendText}`;
  } else if (n.includes("sodium") || n.includes("na+")) {
    if (!isNum) return "See report";
    if (val < 120)
      suggestion = `⚠️ Na⁺ ${val} mmol/L — severe hyponatremia. Seizure risk. Urgent treatment needed.`;
    else if (val < 135)
      suggestion = `Na⁺ ${val} mmol/L — hyponatremia (normal 135–145). Review fluids.${trendText}`;
    else if (val > 155)
      suggestion = `⚠️ Na⁺ ${val} mmol/L — severe hypernatremia. Check hydration status urgently.`;
    else if (val > 145)
      suggestion = `Na⁺ ${val} mmol/L — hypernatremia. Increase free water.${trendText}`;
    else suggestion = `Na⁺ ${val} mmol/L — normal.${trendText}`;
  } else if (
    n.includes("glucose") ||
    n.includes("blood sugar") ||
    n.includes("rbs") ||
    n.includes("fbs")
  ) {
    if (!isNum) return "See report";
    if (val < 3.9)
      suggestion = `⚠️ Glucose ${val} mmol/L — hypoglycemia! Immediate glucose administration.`;
    else if (val < 5.5)
      suggestion = `Glucose ${val} mmol/L — normal fasting range.${trendText}`;
    else if (val < 7.0)
      suggestion = `Glucose ${val} mmol/L — borderline/pre-diabetic range. Lifestyle review.${trendText}`;
    else if (val < 11.1)
      suggestion = `Glucose ${val} mmol/L — elevated. Possible diabetes. Confirm with HbA1c.${trendText}`;
    else
      suggestion = `⚠️ Glucose ${val} mmol/L — significantly elevated. Hyperglycemic. Review insulin/OHA.${trendText}`;
  } else if (n.includes("hba1c")) {
    if (!isNum) return "See report";
    if (val < 5.7)
      suggestion = `HbA1c ${val}% — normal (well-controlled).${trendText}`;
    else if (val < 6.5)
      suggestion = `HbA1c ${val}% — pre-diabetic range (5.7–6.4%). Lifestyle modification advised.${trendText}`;
    else if (val < 8.0)
      suggestion = `HbA1c ${val}% — diabetic range, sub-optimal control. Review treatment.${trendText}`;
    else
      suggestion = `⚠️ HbA1c ${val}% — poor diabetic control. Intensify management.${trendText}`;
  } else if (
    n.includes("wbc") ||
    n.includes("total wbc") ||
    n.includes("leukocyte")
  ) {
    if (!isNum) return "See report";
    if (val > 12)
      suggestion = `WBC ${val} /cmm — leukocytosis. Suggests infection or inflammation.${trendText}`;
    else if (val < 4)
      suggestion = `WBC ${val} /cmm — leukopenia. Check for infection risk.${trendText} Consider hematology review.`;
    else suggestion = `WBC ${val} /cmm — normal range.${trendText}`;
  } else if (n.includes("sgpt") || n.includes("alt")) {
    if (!isNum) return "See report";
    if (val > 3 * 40)
      suggestion = `ALT/SGPT ${val} U/L — markedly elevated (3× ULN). Significant hepatic injury.${trendText}`;
    else if (val > 40)
      suggestion = `ALT/SGPT ${val} U/L — elevated (normal <40 U/L). Hepatic involvement.${trendText}`;
    else suggestion = `ALT/SGPT ${val} U/L — normal.${trendText}`;
  } else if (n.includes("tsh")) {
    if (!isNum) return "See report";
    if (val < 0.1)
      suggestion = `TSH ${val} mIU/L — suppressed (normal 0.4–4.5). Consider hyperthyroidism.${trendText}`;
    else if (val < 0.4)
      suggestion = `TSH ${val} mIU/L — low-normal. Monitor.${trendText}`;
    else if (val > 10)
      suggestion = `TSH ${val} mIU/L — significantly elevated. Hypothyroidism. Thyroid hormone replacement.${trendText}`;
    else if (val > 4.5)
      suggestion = `TSH ${val} mIU/L — elevated (normal 0.4–4.5). Subclinical/overt hypothyroidism.${trendText}`;
    else suggestion = `TSH ${val} mIU/L — normal.${trendText}`;
  } else {
    // Generic: use interpretation label
    const label = result.interpretation;
    if (label === "Normal")
      suggestion = `${name}: ${result.value} ${result.unit} — within normal range (${result.referenceRange}).`;
    else if (label === "Abnormal High")
      suggestion = `${name}: ${result.value} ${result.unit} — above normal range (${result.referenceRange}).${trendText} Clinical review recommended.`;
    else if (label === "Abnormal Low")
      suggestion = `${name}: ${result.value} ${result.unit} — below normal range (${result.referenceRange}).${trendText} Clinical review recommended.`;
    else
      suggestion = `⚠️ ${name}: ${result.value} ${result.unit} — critical value. Immediate clinical action required.`;
  }

  return suggestion;
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: InvStatus }) {
  if (status === "ordered")
    return (
      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Ordered
      </Badge>
    );
  if (status === "sample_collected")
    return (
      <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-xs">
        <TestTube className="w-3 h-3 mr-1" />
        Sample Collected
      </Badge>
    );
  return (
    <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Report Collected
    </Badge>
  );
}

// ── Overdue badge ──────────────────────────────────────────────────────────────
function isOverdue(inv: TrackedInvestigation): boolean {
  if (inv.status === "report_collected") return false;
  const orderedAt = new Date(inv.orderedAt).getTime();
  return Date.now() - orderedAt > 48 * 60 * 60 * 1000;
}

// ── Result entry inline form ───────────────────────────────────────────────────
function ResultEntryForm({
  invName,
  onSave,
  onCancel,
  currentUser,
}: {
  invName: string;
  onSave: (result: InvResult) => void;
  onCancel: () => void;
  currentUser: string;
}) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [refRange, setRefRange] = useState("");
  const [interp, setInterp] = useState<InterpretationLabel>("Normal");
  const [notes, setNotes] = useState("");

  function handleSave() {
    if (!value.trim()) {
      toast.error("Enter a result value");
      return;
    }
    onSave({
      value: value.trim(),
      unit: unit.trim(),
      referenceRange: refRange.trim(),
      interpretation: interp,
      notes: notes.trim() || undefined,
      recordedAt: new Date().toISOString(),
      recordedBy: currentUser,
    });
  }

  return (
    <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
      <h5 className="text-sm font-semibold text-teal-800">
        Add Result — {invName}
      </h5>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Result Value *</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 9.5"
            type="text"
            className="mt-1 h-8 text-sm"
            data-ocid="inv_tracker.result_value.input"
          />
        </div>
        <div>
          <Label className="text-xs">Unit</Label>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. g/dL"
            className="mt-1 h-8 text-sm"
            data-ocid="inv_tracker.result_unit.input"
          />
        </div>
        <div>
          <Label className="text-xs">Reference Range</Label>
          <Input
            value={refRange}
            onChange={(e) => setRefRange(e.target.value)}
            placeholder="e.g. 12-16 g/dL"
            className="mt-1 h-8 text-sm"
            data-ocid="inv_tracker.ref_range.input"
          />
        </div>
        <div>
          <Label className="text-xs">Interpretation</Label>
          <Select
            value={interp}
            onValueChange={(v) => setInterp(v as InterpretationLabel)}
          >
            <SelectTrigger
              className="mt-1 h-8 text-sm"
              data-ocid="inv_tracker.interpretation.select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "Normal",
                  "Abnormal High",
                  "Abnormal Low",
                  "Critical",
                ] as InterpretationLabel[]
              ).map((opt) => (
                <SelectItem key={opt} value={opt} className="text-sm">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any clinical notes..."
          rows={2}
          className="mt-1 text-sm"
          data-ocid="inv_tracker.result_notes.textarea"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          className="bg-teal-600 hover:bg-teal-700 text-white"
          data-ocid="inv_tracker.save_result.button"
        >
          Save Result
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── AI interpretation card ──────────────────────────────────────────────────────
function AIInterpretationCard({
  inv,
  allReadings,
}: {
  inv: TrackedInvestigation;
  allReadings: Array<{ value: string; recordedAt: string }>;
}) {
  if (!inv.result) return null;
  const interp = generateAIInterpretation(inv.name, inv.result, allReadings);

  const isWarning =
    interp.startsWith("⚠️") ||
    inv.result.interpretation === "Critical" ||
    inv.result.interpretation === "Abnormal High" ||
    inv.result.interpretation === "Abnormal Low";

  return (
    <div
      className={`mt-2 rounded-lg p-3 border text-xs ${
        isWarning
          ? "bg-amber-50 border-amber-200 text-amber-800"
          : "bg-green-50 border-green-200 text-green-800"
      }`}
      data-ocid="inv_tracker.ai_interpretation"
    >
      <div className="flex items-start gap-2">
        <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold mb-0.5">AI Interpretation</p>
          <p>{interp}</p>
          <p className="mt-1 opacity-60 italic">
            AI Suggested — Review with Doctor
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Add new investigation form ─────────────────────────────────────────────────
function AddInvestigationForm({
  onAdd,
  currentUser,
}: {
  onAdd: (inv: TrackedInvestigation) => void;
  currentUser: string;
}) {
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  function handleAdd() {
    if (!name.trim()) {
      toast.error("Enter an investigation name");
      return;
    }
    const newInv: TrackedInvestigation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name.trim(),
      orderedAt: new Date().toISOString(),
      orderedBy: currentUser,
      status: "ordered",
    };
    onAdd(newInv);
    setName("");
    setShowForm(false);
    toast.success(`${newInv.name} added to tracking`);
  }

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-1.5"
        onClick={() => setShowForm(!showForm)}
        data-ocid="inv_tracker.add_investigation.button"
      >
        <Plus className="w-3.5 h-3.5" />
        Track New Investigation
      </Button>
      {showForm && (
        <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl p-4 flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Investigation Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="e.g. CBC, S. Creatinine..."
              className="mt-1 h-8 text-sm"
              data-ocid="inv_tracker.new_investigation.input"
              autoFocus
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            data-ocid="inv_tracker.confirm_add.button"
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InvestigationTracker({
  patientId,
  patientPhone,
  viewerRole,
  currentRole,
}: InvestigationTrackerProps) {
  const [investigations, setInvestigations] = useState<TrackedInvestigation[]>(
    () => loadTrackedInvestigations(patientId),
  );
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // Role permission check
  const canChangeStatus =
    viewerRole === "consultant_doctor" ||
    viewerRole === "medical_officer" ||
    currentRole === "doctor" ||
    currentRole === "admin";

  const currentUser = viewerRole
    ? viewerRole.replace(/_/g, " ")
    : (currentRole ?? "Staff");

  function persist(updated: TrackedInvestigation[]) {
    setInvestigations(updated);
    saveTrackedInvestigations(patientId, updated);
  }

  function updateStatus(id: string, status: InvStatus) {
    const updated = investigations.map((inv) =>
      inv.id === id
        ? {
            ...inv,
            status,
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: currentUser,
          }
        : inv,
    );
    persist(updated);

    if (status === "report_collected") {
      toast.success(
        "Report linked to prescription. Result will appear in Clinical Summary.",
        {
          duration: 4000,
        },
      );
      // Mark as linked
      const linked = updated.map((inv) =>
        inv.id === id ? { ...inv, linkedToPrescription: true } : inv,
      );
      persist(linked);
      // Expand result entry
      setExpandedResultId(id);
    }
  }

  function saveResult(id: string, result: InvResult) {
    const updated = investigations.map((inv) =>
      inv.id === id ? { ...inv, result } : inv,
    );
    persist(updated);
    setExpandedResultId(null);
    toast.success("Result saved");
  }

  function addInvestigation(inv: TrackedInvestigation) {
    persist([...investigations, inv]);
  }

  function buildReportReadyLink(inv: TrackedInvestigation): string {
    const phone = patientPhone ?? "";
    const msg = `Dear Patient, your ${inv.name} report is ready. Please collect or contact the clinic for further instructions.`;
    return buildWhatsAppUrl(phone, msg);
  }

  function getReportReadyMessage(inv: TrackedInvestigation): string {
    return `Dear Patient, your ${inv.name} report is ready. Please collect or contact the clinic for further instructions.`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Message copied to clipboard");
      })
      .catch(() => {
        toast.error("Could not copy to clipboard");
      });
  }

  const overdueCount = investigations.filter(isOverdue).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-teal-600" />
            Investigation Tracking
          </h3>
          {overdueCount > 0 && (
            <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {overdueCount} Overdue
            </Badge>
          )}
        </div>
        {canChangeStatus && (
          <AddInvestigationForm
            onAdd={addInvestigation}
            currentUser={currentUser}
          />
        )}
      </div>

      {investigations.length === 0 ? (
        <div
          className="text-center py-10 border border-dashed border-teal-200 rounded-xl"
          data-ocid="inv_tracker.empty_state"
        >
          <FlaskConical className="w-8 h-8 text-teal-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No investigations tracked yet</p>
          {canChangeStatus && (
            <p className="text-xs text-gray-400 mt-1">
              Click "Track New Investigation" to start
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {investigations.map((inv, idx) => {
            const overdue = isOverdue(inv);
            const allReadings = investigations
              .filter((i) => i.name === inv.name && i.result)
              .map((i) => ({
                value: i.result!.value,
                recordedAt: i.result!.recordedAt,
              }));

            return (
              <div
                key={inv.id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${
                  overdue ? "border-orange-300" : "border-gray-200"
                }`}
                data-ocid={`inv_tracker.item.${idx + 1}`}
              >
                {/* Row header */}
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-800">
                        {inv.name}
                      </p>
                      <StatusBadge status={inv.status} />
                      {overdue && (
                        <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                      {inv.linkedToPrescription && (
                        <Badge className="bg-teal-100 text-teal-800 border border-teal-300 text-xs">
                          Linked to Rx
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Ordered:{" "}
                      {new Date(inv.orderedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      by {inv.orderedBy}
                    </p>
                    {inv.statusUpdatedAt && (
                      <p className="text-xs text-gray-400">
                        Status updated:{" "}
                        {new Date(inv.statusUpdatedAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}{" "}
                        by {inv.statusUpdatedBy}
                      </p>
                    )}
                    {/* Existing result summary */}
                    {inv.result && (
                      <p className="text-xs mt-1 text-teal-700 font-medium">
                        Result: {inv.result.value} {inv.result.unit}
                        {inv.result.referenceRange && (
                          <span className="text-gray-500 font-normal ml-1">
                            (Ref: {inv.result.referenceRange})
                          </span>
                        )}
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-xs font-semibold ${
                            inv.result.interpretation === "Normal"
                              ? "bg-green-100 text-green-700"
                              : inv.result.interpretation === "Critical"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {inv.result.interpretation}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  {canChangeStatus && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {inv.status === "ordered" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 border-blue-400 text-blue-700 hover:bg-blue-50"
                          onClick={() =>
                            updateStatus(inv.id, "sample_collected")
                          }
                          data-ocid={`inv_tracker.sample_collected.button.${idx + 1}`}
                        >
                          <TestTube className="w-3 h-3" />
                          Sample Collected
                        </Button>
                      )}
                      {inv.status === "sample_collected" && (
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() =>
                            updateStatus(inv.id, "report_collected")
                          }
                          data-ocid={`inv_tracker.report_collected.button.${idx + 1}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Report Collected
                        </Button>
                      )}
                      {inv.status === "report_collected" && !inv.result && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 border-teal-400 text-teal-700 hover:bg-teal-50"
                          onClick={() =>
                            setExpandedResultId(
                              expandedResultId === inv.id ? null : inv.id,
                            )
                          }
                          data-ocid={`inv_tracker.add_result.button.${idx + 1}`}
                        >
                          <Plus className="w-3 h-3" />
                          Add Result
                        </Button>
                      )}
                      {inv.status === "report_collected" && inv.result && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                          onClick={() =>
                            setExpandedResultId(
                              expandedResultId === inv.id ? null : inv.id,
                            )
                          }
                          data-ocid={`inv_tracker.edit_result.button.${idx + 1}`}
                        >
                          Edit Result
                        </Button>
                      )}
                      {inv.status === "report_collected" &&
                        patientPhone &&
                        normalisePhone(patientPhone) && (
                          <>
                            <a
                              href={buildReportReadyLink(inv)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 h-7 px-2.5 text-xs border border-green-400 text-green-700 bg-green-50 rounded-md hover:bg-green-100 font-medium"
                              data-ocid={`inv_tracker.whatsapp.button.${idx + 1}`}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="w-3 h-3 fill-green-600"
                                role="img"
                                aria-label="WhatsApp icon"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                              Report Ready
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                              title="Copy message for manual sending"
                              onClick={() =>
                                copyToClipboard(getReportReadyMessage(inv))
                              }
                              data-ocid={`inv_tracker.copy_message.button.${idx + 1}`}
                            >
                              <ClipboardCopy className="w-3 h-3" />
                              Copy
                            </Button>
                          </>
                        )}
                    </div>
                  )}
                </div>

                {/* Inline result entry form */}
                {expandedResultId === inv.id && (
                  <ResultEntryForm
                    invName={inv.name}
                    onSave={(result) => saveResult(inv.id, result)}
                    onCancel={() => setExpandedResultId(null)}
                    currentUser={currentUser}
                  />
                )}

                {/* AI interpretation */}
                {inv.result && expandedResultId !== inv.id && (
                  <AIInterpretationCard inv={inv} allReadings={allReadings} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
