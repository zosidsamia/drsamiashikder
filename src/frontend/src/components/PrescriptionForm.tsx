import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Medication } from "../types";
import { type DimsEntry, getDimsByDiagnosis, searchDims } from "./DimsData";

interface InitialRxData {
  prescriptionDate: bigint;
  diagnosis: string | null;
  medications: Medication[];
  notes: string | null;
}

interface PrescriptionFormProps {
  patientId: bigint;
  visitId?: bigint;
  patientName?: string;
  initialDiagnosis?: string;
  initialData?: InitialRxData;
  onSubmit: (data: {
    patientId: bigint;
    visitId: bigint | null;
    prescriptionDate: bigint;
    diagnosis: string | null;
    medications: Medication[];
    notes: string | null;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface MedEntry {
  _uid: number;
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  fromDims: boolean;
  originalDims?: {
    name: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions: string;
  };
}

let _counter = 0;
function nextUid() {
  _counter += 1;
  return _counter;
}

function emptyMed(): MedEntry {
  return {
    _uid: nextUid(),
    name: "",
    dose: "",
    frequency: "",
    duration: "",
    instructions: "",
    fromDims: false,
  };
}

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function medIsEdited(med: MedEntry): boolean {
  if (!med.fromDims || !med.originalDims) return false;
  return (
    med.name !== med.originalDims.name ||
    med.dose !== med.originalDims.dose ||
    med.frequency !== med.originalDims.frequency ||
    med.duration !== med.originalDims.duration ||
    med.instructions !== med.originalDims.instructions
  );
}

function dimsEntryToMeds(entry: DimsEntry): MedEntry[] {
  return entry.medications.map((m) => ({
    _uid: nextUid(),
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    duration: m.duration,
    instructions: m.instructions,
    fromDims: true,
    originalDims: { ...m },
  }));
}

export default function PrescriptionForm({
  patientId,
  visitId,
  patientName,
  initialDiagnosis,
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: PrescriptionFormProps) {
  const initEntry = initialDiagnosis
    ? getDimsByDiagnosis(initialDiagnosis)
    : undefined;

  const initDateString = initialData
    ? new Date(Number(initialData.prescriptionDate / 1000000n))
        .toISOString()
        .split("T")[0]
    : todayDateString();

  const [prescriptionDate, setPrescriptionDate] = useState(initDateString);
  const [diagnosis, setDiagnosis] = useState(
    initialData?.diagnosis ?? initialDiagnosis ?? "",
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [medications, setMedications] = useState<MedEntry[]>(
    initialData
      ? initialData.medications.map((m) => ({
          _uid: nextUid(),
          name: m.name,
          dose: m.dose,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions ?? "",
          fromDims: false,
        }))
      : initEntry
        ? dimsEntryToMeds(initEntry)
        : [emptyMed()],
  );
  const [dimsAutoFilled, setDimsAutoFilled] = useState(
    !!initEntry && !initialData,
  );
  const [dimsNotes, setDimsNotes] = useState<string | undefined>(
    initEntry?.notes,
  );

  const [suggestions, setSuggestions] = useState<DimsEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const diagnosisRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        diagnosisRef.current &&
        !diagnosisRef.current.contains(e.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDiagnosisChange = (val: string) => {
    setDiagnosis(val);
    if (val.length >= 2) {
      const results = searchDims(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const applyDimsEntry = (entry: DimsEntry) => {
    setDiagnosis(entry.diagnosis);
    setMedications(dimsEntryToMeds(entry));
    setDimsAutoFilled(true);
    setDimsNotes(entry.notes);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const resetToDims = () => {
    const entry = getDimsByDiagnosis(diagnosis);
    if (entry) {
      setMedications(dimsEntryToMeds(entry));
      setDimsNotes(entry.notes);
    }
  };

  const searchDimsForCurrent = () => {
    const results = searchDims(diagnosis);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
  };

  const addMed = () => setMedications((prev) => [...prev, emptyMed()]);

  const removeMed = (uid: number) =>
    setMedications((prev) => prev.filter((m) => m._uid !== uid));

  const updateMed = (
    uid: number,
    field: keyof Omit<MedEntry, "_uid" | "fromDims" | "originalDims">,
    value: string,
  ) =>
    setMedications((prev) =>
      prev.map((m) => (m._uid === uid ? { ...m, [field]: value } : m)),
    );

  const resetMedToDims = (uid: number) =>
    setMedications((prev) =>
      prev.map((m) =>
        m._uid === uid && m.originalDims ? { ...m, ...m.originalDims } : m,
      ),
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validMeds: Medication[] = medications
      .filter((m) => m.name.trim())
      .map(({ name, dose, frequency, duration, instructions }) => ({
        name: name.trim(),
        dose: dose.trim(),
        frequency: frequency.trim(),
        duration: duration.trim(),
        instructions: instructions.trim(),
      }));
    const date = BigInt(new Date(prescriptionDate).getTime()) * 1000000n;
    onSubmit({
      patientId,
      visitId: visitId ?? null,
      prescriptionDate: date,
      diagnosis: diagnosis.trim() || null,
      medications: validMeds,
      notes: notes.trim() || null,
    });
  };

  const handlePrint = () => {
    const doctorProfile = (() => {
      try {
        return JSON.parse(localStorage.getItem("doctorProfile") || "{}");
      } catch {
        return {};
      }
    })();
    const doctorName = doctorProfile.name || doctorProfile.fullName || "Dr.";
    const doctorDegree =
      doctorProfile.degree || doctorProfile.designation || "";
    const doctorSpec = doctorProfile.specialization || "";
    const doctorHosp = doctorProfile.hospital || "";
    const dateStr = new Date(prescriptionDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const medsHtml = medications
      .filter((m) => m.name.trim())
      .map(
        (m, i) =>
          `<div class="rx-med">
            <p class="rx-med-num">${i + 1}.</p>
            <div class="rx-med-detail">
              <p class="rx-med-name">${m.name}${m.dose ? ` &mdash; ${m.dose}` : ""}</p>
              ${m.frequency ? `<p class="rx-meta">Frequency: ${m.frequency}</p>` : ""}
              ${m.duration ? `<p class="rx-meta">Duration: ${m.duration}</p>` : ""}
              ${m.instructions ? `<p class="rx-meta rx-instr">${m.instructions}</p>` : ""}
            </div>
          </div>`,
      )
      .join("");

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Prescription</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; font-size: 13px; color: #111; background: #fff; }
    .page { max-width: 720px; margin: 0 auto; padding: 32px 40px; }
    .header { border-bottom: 2px solid #0d7a6e; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .doctor-info h1 { font-size: 20px; font-weight: 700; color: #0d7a6e; }
    .doctor-info p { font-size: 12px; color: #444; margin-top: 2px; }
    .date-info { text-align: right; font-size: 12px; color: #555; }
    .patient-row { background: #f0faf8; border: 1px solid #b2dfdb; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; }
    .patient-row span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #0d7a6e; display: block; margin-bottom: 2px; }
    .patient-row p { font-size: 13px; font-weight: 600; }
    .dx-row { margin-bottom: 16px; }
    .dx-row .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
    .dx-row p { font-size: 14px; font-weight: 700; color: #0d4d46; margin-top: 2px; }
    .rx-title { font-size: 32px; font-style: italic; color: #0d7a6e; margin-bottom: 10px; font-family: 'Times New Roman', serif; }
    .rx-med { display: flex; gap: 10px; margin-bottom: 12px; padding: 8px 0; border-bottom: 1px dotted #ddd; }
    .rx-med-num { font-size: 13px; font-weight: 700; color: #0d7a6e; min-width: 20px; }
    .rx-med-name { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
    .rx-meta { font-size: 12px; color: #444; margin-top: 1px; }
    .rx-instr { font-style: italic; color: #0d4d46; }
    .notes-box { margin-top: 16px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 10px 14px; }
    .notes-box p { font-size: 12px; }
    .footer { margin-top: 40px; display: flex; justify-content: flex-end; }
    .sig-line { text-align: center; }
    .sig-line .line { border-top: 1px solid #333; width: 160px; margin-bottom: 4px; }
    .sig-line p { font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="doctor-info">
        <h1>${doctorName}${doctorDegree ? `, ${doctorDegree}` : ""}</h1>
        ${doctorSpec ? `<p>${doctorSpec}</p>` : ""}
        ${doctorHosp ? `<p>${doctorHosp}</p>` : ""}
      </div>
      <div class="date-info"><p>Date: ${dateStr}</p></div>
    </div>
    <div class="patient-row">
      <span>Patient</span>
      <p>${patientName ?? "—"}</p>
    </div>
    ${diagnosis ? `<div class="dx-row"><p class="label">Diagnosis</p><p>${diagnosis}</p></div>` : ""}
    <div class="rx-title">&#8478;</div>
    ${medsHtml}
    ${notes ? `<div class="notes-box"><p><strong>Notes:</strong> ${notes}</p></div>` : ""}
    <div class="footer">
      <div class="sig-line">
        <div class="line"></div>
        <p>${doctorName}</p>
        ${doctorDegree ? `<p>${doctorDegree}</p>` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=800,height=900");
    if (win) {
      win.document.write(printHtml);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const anyEdited = medications.some(medIsEdited);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Edit copy banner */}
      {initialData && (
        <Alert className="border-amber-300 bg-amber-50 py-2.5">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            Editing a copy of this prescription. Saving will create a new
            separate prescription.
          </AlertDescription>
        </Alert>
      )}
      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="rxDate">Prescription Date</Label>
        <Input
          id="rxDate"
          type="date"
          value={prescriptionDate}
          onChange={(e) => setPrescriptionDate(e.target.value)}
          data-ocid="prescription_form.input"
          className="max-w-xs"
        />
      </div>

      {/* Diagnosis with DIMS autocomplete */}
      <div className="space-y-1.5">
        <Label htmlFor="rxDx">Diagnosis</Label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="rxDx"
              ref={diagnosisRef}
              value={diagnosis}
              onChange={(e) => handleDiagnosisChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Type diagnosis to search DIMS database..."
              className="pl-9"
              data-ocid="prescription_form.input"
              autoComplete="off"
            />
            {diagnosis && (
              <button
                type="button"
                onClick={() => {
                  setDiagnosis("");
                  setDimsAutoFilled(false);
                  setDimsNotes(undefined);
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
            >
              <ScrollArea className="max-h-52">
                <div className="p-1">
                  {suggestions.map((entry) => (
                    <button
                      key={entry.diagnosis}
                      type="button"
                      onClick={() => applyDimsEntry(entry)}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {entry.diagnosis}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.category} &middot; {entry.medications.length}{" "}
                          medications
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 border-teal-300 text-teal-700 bg-teal-50"
                      >
                        DIMS
                      </Badge>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {diagnosis.length >= 3 && !dimsAutoFilled && !showSuggestions && (
          <button
            type="button"
            onClick={searchDimsForCurrent}
            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 transition-colors mt-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Search DIMS for suggestions
          </button>
        )}
      </div>

      {/* DIMS auto-fill indicator */}
      {dimsAutoFilled && (
        <Alert className="border-teal-300 bg-teal-50 text-teal-800 py-2.5">
          <Sparkles className="h-4 w-4 text-teal-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              Medications auto-filled from DIMS
              {anyEdited ? " · Some fields have been edited" : ""}
            </span>
            {anyEdited && (
              <button
                type="button"
                onClick={resetToDims}
                className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 ml-3"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to DIMS
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* DIMS clinical notes */}
      {dimsNotes && (
        <Alert className="border-blue-200 bg-blue-50 py-2.5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-blue-800">
            <span className="font-semibold">Clinical note: </span>
            {dimsNotes}
          </AlertDescription>
        </Alert>
      )}

      {/* Medications */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Medications</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMed}
            className="h-7 px-2 text-xs gap-1"
            data-ocid="prescription_form.secondary_button"
          >
            <Plus className="w-3 h-3" />
            Add Medication
          </Button>
        </div>

        <div className="space-y-3">
          {medications.map((med, idx) => {
            const edited = medIsEdited(med);
            return (
              <div
                key={med._uid}
                className={`rounded-xl p-3 space-y-2 relative border ${
                  med.fromDims
                    ? "border-l-[3px] border-l-teal-400 border-teal-100 bg-teal-50/40"
                    : "border-border bg-muted/40"
                }`}
              >
                {med.fromDims && (
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 border-teal-300 text-teal-700 bg-teal-50"
                    >
                      DIMS
                    </Badge>
                    {edited && (
                      <>
                        <span className="text-[10px] text-amber-600">
                          Edited
                        </span>
                        <button
                          type="button"
                          onClick={() => resetMedToDims(med._uid)}
                          className="text-[10px] text-teal-600 flex items-center gap-0.5 hover:text-teal-800"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                )}

                {medications.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => removeMed(med._uid)}
                    data-ocid={`prescription_form.delete_button.${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Drug Name *</Label>
                    <Input
                      value={med.name}
                      onChange={(e) =>
                        updateMed(med._uid, "name", e.target.value)
                      }
                      placeholder="e.g. Amoxicillin"
                      className="h-8 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://medex.com.bd/brands${med.name ? `?search=${encodeURIComponent(med.name)}` : ""}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-800 hover:underline mt-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Search on Medex
                    </button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dose</Label>
                    <Input
                      value={med.dose}
                      onChange={(e) =>
                        updateMed(med._uid, "dose", e.target.value)
                      }
                      placeholder="e.g. 500 mg"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Frequency</Label>
                    <Input
                      value={med.frequency}
                      onChange={(e) =>
                        updateMed(med._uid, "frequency", e.target.value)
                      }
                      placeholder="e.g. Twice daily"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration</Label>
                    <Input
                      value={med.duration}
                      onChange={(e) =>
                        updateMed(med._uid, "duration", e.target.value)
                      }
                      placeholder="e.g. 7 days"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Instructions</Label>
                    <Input
                      value={med.instructions}
                      onChange={(e) =>
                        updateMed(med._uid, "instructions", e.target.value)
                      }
                      placeholder="e.g. Take after meals"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="rxNotes">Notes</Label>
        <Textarea
          id="rxNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Additional instructions…"
        />
      </div>

      <div className="flex flex-wrap justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrint}
          className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
          data-ocid="prescription_form.secondary_button"
        >
          <Printer className="w-4 h-4" />
          Print / Preview
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-ocid="prescription_form.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
            data-ocid="prescription_form.submit_button"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Prescription
          </Button>
        </div>
      </div>
    </form>
  );
}
