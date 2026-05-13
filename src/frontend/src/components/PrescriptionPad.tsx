import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Download,
  Edit2,
  Hospital,
  Printer,
  Save,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPrescriptionHeaderImage } from "../hooks/useQueries";
import type { Prescription } from "../types";
import type { PrescriptionHeaderType } from "../types";
import { getPrescriptionHeaderText } from "./PrescriptionHeaderPanel";
import {
  clearDoctorSignature,
  getDoctorSignature,
  numberAdviceLines,
  setDoctorSignature,
} from "./PrescriptionHelpers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrescriptionPadProps {
  prescription?: Prescription | null;
  patientName?: string;
  patientAge?: number | null;
  patientWeight?: string;
  patientHeight?: number | null;
  registerNumber?: string;
  bloodGroup?: string;
  address?: string;
  sex?: string;
  linkedVisitId?: string;
  patientId?: bigint | null;
  isAdmitted?: boolean;
  snapshotHeaderType?: PrescriptionHeaderType;
}

interface RxDrug {
  drugForm?: string;
  drugName?: string;
  brandName?: string;
  dose?: string;
  frequency?: string;
  frequencyBn?: string;
  duration?: string;
  durationBn?: string;
  instructions?: string;
  instructionBn?: string;
  specialInstruction?: string;
  specialInstructionBn?: string;
  routeBn?: string;
  route?: string;
  name?: string;
  isPrn?: boolean;
  prnCondition?: string;
}

interface ClinicalSnapshot {
  cc?: string;
  pmh?: string;
  dh?: string;
  oe?: string;
  historyPersonal?: string;
  historyFamily?: string;
  historyImmunization?: string;
  historyAllergy?: string;
  historyOthers?: string;
  investigation?: string;
  adviceNewInv?: string;
  adviceText?: string;
  bloodGroup?: string;
  address?: string;
  sex?: string;
}

function extractSnapshot(notes?: string): ClinicalSnapshot {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as ClinicalSnapshot;
  } catch {
    return { adviceText: notes };
  }
}

// normalization helper — accepts unknown prescription shape from storage
function normalizeDrug(m: any): RxDrug {
  return {
    drugForm: m.drugForm || m.form || "",
    drugName: m.drugName || m.name || "",
    brandName: m.brandName || "",
    dose: m.dose || "",
    frequency: m.frequency || "",
    frequencyBn: m.frequencyBn || "",
    duration: m.duration || "",
    durationBn: m.durationBn || "",
    instructions: m.instructions || "",
    instructionBn: m.instructionBn || "",
    specialInstruction: m.specialInstruction || "",
    specialInstructionBn: m.specialInstructionBn || "",
    routeBn: m.routeBn || "",
    route: m.route || "",
  };
}

function PrescriptionHeader({
  headerType,
}: { headerType: PrescriptionHeaderType }) {
  const img = getPrescriptionHeaderImage(headerType);
  if (img) {
    return (
      <div className="border-b pb-2 mb-3 text-center">
        <img
          src={img}
          alt="Header"
          className="max-h-24 w-full object-contain"
        />
      </div>
    );
  }
  const td = getPrescriptionHeaderText(headerType);
  if (td) {
    if (headerType === "hospital") {
      return (
        <div className="border-b pb-2 mb-3 text-center">
          <h2 className="font-bold text-base">{td.hospitalName}</h2>
          {td.tagline && <p className="text-sm text-gray-600">{td.tagline}</p>}
        </div>
      );
    }
    return (
      <div className="border-b pb-2 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-base">{td.doctorName}</h2>
            {td.degrees && (
              <p className="text-sm text-gray-600">{td.degrees}</p>
            )}
            {td.chamberAddress && (
              <p className="text-sm text-gray-600">{td.chamberAddress}</p>
            )}
          </div>
          {td.phone && (
            <div className="text-right text-sm text-gray-600">
              Mob: {td.phone}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (headerType === "hospital") {
    return (
      <div className="border-b pb-2 mb-3 text-center">
        <h2 className="font-bold text-base">
          Dr. Sirajul Islam Medical College Hospital
        </h2>
        <p className="text-sm text-gray-600">Department of General Surgery</p>
      </div>
    );
  }
  // Chamber fallback — read full doctor profile from localStorage
  const getDoctorProfileFallback = () => {
    try {
      const sessionId = localStorage.getItem("medicare_current_doctor");
      if (sessionId) {
        const registry = JSON.parse(
          localStorage.getItem("medicare_doctors_registry") || "[]",
        ) as Array<{ id: string; email: string }>;
        const doc = registry.find((d) => d.id === sessionId);
        if (doc?.email) {
          const profile = JSON.parse(
            localStorage.getItem(`doctor_profile_${doc.email}`) || "null",
          );
          if (profile) return profile;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  };
  const profile = getDoctorProfileFallback();
  return (
    <div className="border-b pb-3 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-base">
            {profile?.name ?? "Dr. Arman Kabir (ZOSID)"}
          </h2>
          <p className="text-sm text-gray-600 font-medium">
            {profile?.degrees ??
              profile?.designation ??
              "MBBS (D.U.) | Emergency Medical Officer"}
          </p>
          {profile?.posts && (
            <p className="text-xs text-gray-500">{profile.posts}</p>
          )}
          <p className="text-sm text-gray-600">
            {profile?.chamber ??
              profile?.chamberAddress ??
              "Dr. Sirajul Islam Medical College Hospital"}
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          {profile?.regNo && <p>Reg. no. {profile.regNo}</p>}
          <p>Mob: {profile?.phone ?? "01751959262 / 01984587802"}</p>
        </div>
      </div>
    </div>
  );
}

function printContent(
  elementId: string,
  signatureUrl: string | null,
  _doctorName: string,
) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open("", "_blank");
  if (!win) return;
  const sigImg = signatureUrl
    ? `<img src="${signatureUrl}" style="height:48px;object-fit:contain;display:block;margin:0 auto 4px;" alt="Signature" />`
    : "";
  const html = el.innerHTML.replace("<!-- sig_placeholder -->", sigImg);
  win.document.write(`<!DOCTYPE html><html><head><title>Prescription</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 11pt; margin: 15mm; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .grid { display: grid !important; }
    .grid-cols-5 { grid-template-columns: repeat(5,minmax(0,1fr)) !important; }
    .col-span-2 { grid-column: span 2/span 2 !important; }
    .col-span-3 { grid-column: span 3/span 3 !important; }
    .gap-3 { gap: .75rem !important; }
    .flex { display: flex !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .justify-between { justify-content: space-between !important; }
    .items-start { align-items: flex-start !important; }
    .gap-x-3 { column-gap: .75rem !important; }
    .space-y-2>*+* { margin-top: .5rem !important; }
    .mb-1 { margin-bottom: .25rem !important; }
    .mb-2 { margin-bottom: .5rem !important; }
    .mb-3 { margin-bottom: .75rem !important; }
    .mt-3 { margin-top: .75rem !important; }
    .mt-8 { margin-top: 2rem !important; }
    .pb-2 { padding-bottom: .5rem !important; }
    .pt-1 { padding-top: .25rem !important; }
    .pt-2 { padding-top: .5rem !important; }
    .pl-4 { padding-left: 1rem !important; }
    .pr-2 { padding-right: .5rem !important; }
    .p-4 { padding: 1rem !important; }
    .border-b { border-bottom: 1px solid #d1d5db !important; }
    .border-t { border-top: 1px solid #d1d5db !important; }
    .border-r { border-right: 1px solid #d1d5db !important; }
    .font-bold { font-weight: 700 !important; }
    .font-semibold { font-weight: 600 !important; }
    .text-base { font-size: 1rem !important; }
    .text-sm { font-size: .875rem !important; }
    .text-xs { font-size: .75rem !important; }
    .text-2xl { font-size: 1.5rem !important; }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .uppercase { text-transform: uppercase !important; }
    .whitespace-pre-wrap { white-space: pre-wrap !important; }
    .leading-snug { line-height: 1.375 !important; }
    .text-gray-900 { color: #111827 !important; }
    .text-gray-600 { color: #4b5563 !important; }
    .text-gray-500 { color: #6b7280 !important; }
    .text-gray-400 { color: #9ca3af !important; }
    .text-indigo-600 { color: #4f46e5 !important; }
    .text-orange-600 { color: #ea580c !important; }
    .text-teal-600 { color: #0d9488 !important; }
    .text-blue-600 { color: #2563eb !important; }
    .text-green-600 { color: #16a34a !important; }
    .text-purple-600 { color: #9333ea !important; }
    .text-amber-600 { color: #d97706 !important; }
    .text-rose-600 { color: #e11d48 !important; }
    strong { font-weight: 700 !important; }
    .inline-block { display: inline-block !important; }
    /* Colored accent border for every printed page */
    .rx-print-container { border-left: 6px solid #1d4ed8 !important; padding-left: 12px !important; }
    .rx-print-top-accent { border-top: 4px solid #1d4ed8 !important; margin-bottom: 8px !important; }
    /* Drug row colors */
    .drug-row-controlled { background-color: #fee2e2 !important; border-left: 4px solid #dc2626 !important; }
    .drug-row-allergy { background-color: #fecaca !important; border-left: 4px solid #b91c1c !important; }
    .drug-row-interaction { background-color: #fef9c3 !important; border-left: 4px solid #d97706 !important; }
    @media print { 
      body { margin: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print, .print\:hidden { display: none !important; }
      .rx-print-container { border-left: 6px solid #1d4ed8 !important; padding-left: 12px !important; page-break-inside: auto; }
      .rx-print-top-accent { border-top: 4px solid #1d4ed8 !important; }
      .drug-row-controlled { background-color: #fee2e2 !important; border-left: 4px solid #dc2626 !important; }
      .drug-row-allergy { background-color: #fecaca !important; border-left: 4px solid #b91c1c !important; }
      .drug-row-interaction { background-color: #fef9c3 !important; border-left: 4px solid #d97706 !important; }
      tr { page-break-inside: avoid !important; }
    }
  </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function PrescriptionPad({
  prescription,
  patientName,
  patientAge,
  patientWeight,
  registerNumber,
  bloodGroup,
  address,
  sex,
  linkedVisitId,
  patientId,
  isAdmitted,
  snapshotHeaderType,
}: PrescriptionPadProps) {
  const [editMode, setEditMode] = useState(false);
  const [withHeader, setWithHeader] = useState(true);
  const [headerType, setHeaderType] = useState<PrescriptionHeaderType>(
    snapshotHeaderType ?? (isAdmitted ? "hospital" : "chamber"),
  );
  const [signatureUrl, setSignatureUrl] = useState<string | null>(() =>
    getDoctorSignature(),
  );
  const sigFileRef = useRef<HTMLInputElement>(null);

  const rxId =
    prescription?.id !== undefined ? String(prescription.id) : "blank";
  const padStorageKey = `rx_pad_preview_edits_${rxId}`;
  const snapshot = extractSnapshot(prescription?.notes);

  const [name, setName] = useState(patientName || "");
  const [age, setAge] = useState(patientAge != null ? String(patientAge) : "");
  const [weightVal, setWeightVal] = useState(patientWeight || "");
  const [regNo, setRegNo] = useState(registerNumber || "");
  const [bg, setBg] = useState(bloodGroup || snapshot.bloodGroup || "");
  const [addr, setAddr] = useState(address || snapshot.address || "");
  const [sexVal, setSexVal] = useState(sex || snapshot.sex || "");
  const [rxDate, setRxDate] = useState(
    prescription?.prescriptionDate
      ? new Date(
          Number(prescription.prescriptionDate / 1000000n),
        ).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
  );
  const [diagnosisVal, setDiagnosisVal] = useState(
    prescription?.diagnosis || "",
  );
  const [cc, setCc] = useState(snapshot.cc || "");
  const [pmh, setPmh] = useState(snapshot.pmh || "");
  const [dh, setDh] = useState(snapshot.dh || "");
  const [oe, setOe] = useState(snapshot.oe || "");
  const [historyPersonal, setHistoryPersonal] = useState(
    snapshot.historyPersonal || "",
  );
  const [historyFamily, setHistoryFamily] = useState(
    snapshot.historyFamily || "",
  );
  const [historyImmunization, setHistoryImmunization] = useState(
    snapshot.historyImmunization || "",
  );
  const [historyAllergy, setHistoryAllergy] = useState(
    snapshot.historyAllergy || "",
  );
  const [historyOthers, setHistoryOthers] = useState(
    snapshot.historyOthers || "",
  );
  const [investigation, setInvestigation] = useState(
    snapshot.investigation || "",
  );
  const [adviceNewInv, setAdviceNewInv] = useState(snapshot.adviceNewInv || "");
  const [adviceText, setAdviceText] = useState(snapshot.adviceText || "");
  const drugs: RxDrug[] = (prescription?.medications || []).map(normalizeDrug);
  const numberedAdvice = numberAdviceLines(adviceText);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(padStorageKey);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.cc !== undefined) setCc(d.cc);
        if (d.pmh !== undefined) setPmh(d.pmh);
        if (d.dh !== undefined) setDh(d.dh);
        if (d.oe !== undefined) setOe(d.oe);
        if (d.investigation !== undefined) setInvestigation(d.investigation);
        if (d.adviceText !== undefined) setAdviceText(d.adviceText);
        if (d.diagnosisVal !== undefined) setDiagnosisVal(d.diagnosisVal);
      }
    } catch {
      /* ignore */
    }
  }, [padStorageKey]);

  useEffect(() => {
    if (!linkedVisitId) return;
    const matchKey = Object.keys(localStorage).find((k) =>
      k.includes(`visit_form_data_${linkedVisitId}`),
    );
    if (!matchKey) return;
    try {
      // visit form data is dynamic
      const vd = JSON.parse(localStorage.getItem(matchKey) || "null") as Record<
        string,
        any
      > | null;
      if (!vd || cc) return;
      if (vd.chiefComplaints?.length) {
        const lines = (vd.chiefComplaints as string[]).map((c, i) => {
          const ans: Record<string, string> = vd.complaintAnswers?.[c] || {};
          const vals = Object.values(ans).filter(Boolean);
          return vals.length
            ? `${i + 1}. ${c} — ${vals.join(", ")}`
            : `${i + 1}. ${c}`;
        });
        setCc(lines.join("\n"));
      }
    } catch {
      /* ignore */
    }
  }, [linkedVisitId, cc]);

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 1024 * 1024) {
      toast.error("Signature must be under 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setDoctorSignature(dataUrl);
      setSignatureUrl(dataUrl);
      toast.success("Signature saved");
    };
    reader.readAsDataURL(file);
  }

  function getDoctorName(): string {
    try {
      const sessionId = localStorage.getItem("medicare_current_doctor");
      if (sessionId) {
        const registry = JSON.parse(
          localStorage.getItem("medicare_doctors_registry") || "[]",
        ) as Array<{ id: string; email: string }>;
        const doc = registry.find((d) => d.id === sessionId);
        if (doc?.email) {
          const profile = JSON.parse(
            localStorage.getItem(`doctor_profile_${doc.email}`) || "null",
          );
          if (profile?.name) return profile.name;
        }
      }
    } catch {
      /* ignore */
    }
    return "Dr. Arman Kabir (ZOSID)";
  }
  const doctorName = getDoctorName();

  const savePad = () => {
    try {
      localStorage.setItem(
        padStorageKey,
        JSON.stringify({
          cc,
          pmh,
          dh,
          oe,
          investigation,
          adviceText,
          diagnosisVal,
        }),
      );
      if (patientId) {
        const key = `savedPrescriptionPads_${patientId}`;
        const existing = (() => {
          try {
            return JSON.parse(localStorage.getItem(key) || "[]");
          } catch {
            return [];
          }
        })();
        existing.push({
          id: `pad_${Date.now()}`,
          patientId: String(patientId),
          prescriptionId: rxId,
          date: new Date().toLocaleDateString("en-GB"),
          timestamp: new Date().toISOString(),
          patientName: name,
          diagnosis: diagnosisVal,
          medications: prescription?.medications ?? [],
        });
        localStorage.setItem(key, JSON.stringify(existing));
      }
      toast.success("Prescription pad saved");
      setEditMode(false);
    } catch {
      toast.error("Failed to save");
    }
  };

  const hasHistory =
    historyPersonal ||
    historyFamily ||
    historyImmunization ||
    historyAllergy ||
    historyOthers;
  const printId = "rx-pad-2col-print";

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2 bg-muted/40 border rounded-xl p-3"
        data-ocid="prescription_pad.panel"
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditMode((v) => !v)}
          className={`gap-1.5 ${editMode ? "bg-amber-50 border-amber-300 text-amber-700" : "border-border"}`}
          data-ocid="prescription_pad.edit_button"
        >
          {editMode ? (
            <>
              <Save className="w-3.5 h-3.5" /> Save & View
            </>
          ) : (
            <>
              <Edit2 className="w-3.5 h-3.5" /> Edit Mode
            </>
          )}
        </Button>
        {editMode && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={savePad}
            className="gap-1.5 border-green-400 text-green-700 hover:bg-green-50"
            data-ocid="prescription_pad.save_button"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`gap-1.5 ${withHeader ? "bg-teal-50 border-teal-300 text-teal-700" : "border-border text-muted-foreground"}`}
          onClick={() => setWithHeader((v) => !v)}
          data-ocid="prescription_pad.toggle"
        >
          {withHeader ? "With Header" : "Without Header"}
        </Button>
        <div className="flex items-center border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setHeaderType("hospital")}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${headerType === "hospital" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            <Hospital className="w-3 h-3" /> Hospital
          </button>
          <button
            type="button"
            onClick={() => setHeaderType("chamber")}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${headerType === "chamber" ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            <Building2 className="w-3 h-3" /> Chamber
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={sigFileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleSignatureUpload}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => sigFileRef.current?.click()}
            className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
            data-ocid="prescription_pad.signature_button"
          >
            <Upload className="w-3 h-3" />{" "}
            {signatureUrl ? "Change Sig." : "Upload Sig."}
          </Button>
          {signatureUrl && (
            <button
              type="button"
              onClick={() => {
                clearDoctorSignature();
                setSignatureUrl(null);
              }}
              className="text-red-400 hover:text-red-600"
              aria-label="Remove signature"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {signatureUrl && (
          <img
            src={signatureUrl}
            alt="Sig preview"
            className="h-8 object-contain border rounded px-1"
          />
        )}
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => printContent(printId, signatureUrl, doctorName)}
          className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
          data-ocid="prescription_pad.primary_button"
        >
          <Printer className="w-4 h-4" /> Print
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => printContent(printId, signatureUrl, doctorName)}
          className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          data-ocid="prescription_pad.secondary_button"
        >
          <Download className="w-4 h-4" /> Save PDF
        </Button>
      </div>

      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(
            [
              ["Name", name, setName],
              ["Age (yrs)", age, setAge],
              ["Sex", sexVal, setSexVal],
              ["Weight (kg)", weightVal, setWeightVal],
              ["Blood Group", bg, setBg],
              ["Reg No", regNo, setRegNo],
              ["Date", rxDate, setRxDate],
            ] as [string, string, (v: string) => void][]
          ).map(([label, val, setter]) => (
            <div key={label}>
              <Label className="text-xs text-blue-700 font-semibold">
                {label}
              </Label>
              <input
                value={val}
                onChange={(e) => setter(e.target.value)}
                className="w-full border border-blue-200 rounded px-2 py-1 text-xs mt-0.5 bg-white"
              />
            </div>
          ))}
          <div className="col-span-2">
            <Label className="text-xs text-blue-700 font-semibold">
              Address
            </Label>
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              className="w-full border border-blue-200 rounded px-2 py-1 text-xs mt-0.5 bg-white"
            />
          </div>
        </div>
      )}

      <div
        id={printId}
        className="font-serif text-gray-900 border border-gray-200 p-4 rounded bg-white rx-print-container"
      >
        <div className="rx-print-top-accent" />
        {withHeader && <PrescriptionHeader headerType={headerType} />}

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm border-b pb-2 mb-3">
          {name && (
            <span>
              <strong>Name:</strong> {name}
            </span>
          )}
          {age && (
            <span>
              <strong>Age:</strong> {age} <strong>yrs</strong>
            </span>
          )}
          {sexVal && (
            <span>
              <strong>Sex:</strong> {sexVal}
            </span>
          )}
          {weightVal && (
            <span>
              <strong>Weight:</strong> {weightVal} <strong>kg</strong>
            </span>
          )}
          {bg && (
            <span>
              <strong>Blood Group:</strong> {bg}
            </span>
          )}
          {regNo && (
            <span>
              <strong>Reg:</strong> {regNo}
            </span>
          )}
          <span>
            <strong>Date:</strong> {rxDate}
          </span>
          {addr && (
            <span>
              <strong>Address:</strong> {addr}
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2 space-y-2 text-sm border-r pr-2">
            {(cc || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-blue-600 mb-0.5">
                  C/C
                </div>
                {editMode ? (
                  <Textarea
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">{cc}</div>
                )}
              </div>
            )}
            {(pmh || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-green-600 mb-0.5">
                  P/M/H
                </div>
                {editMode ? (
                  <Textarea
                    value={pmh}
                    onChange={(e) => setPmh(e.target.value)}
                    className="text-xs min-h-[50px] resize-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">{pmh}</div>
                )}
              </div>
            )}
            {(hasHistory || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-purple-600 mb-0.5">
                  History
                </div>
                {editMode ? (
                  <div className="space-y-1">
                    {(
                      [
                        ["Personal", historyPersonal, setHistoryPersonal],
                        ["Family", historyFamily, setHistoryFamily],
                        [
                          "Immunization",
                          historyImmunization,
                          setHistoryImmunization,
                        ],
                        ["Allergy", historyAllergy, setHistoryAllergy],
                        ["Others", historyOthers, setHistoryOthers],
                      ] as [string, string, (v: string) => void][]
                    ).map(([lbl, val, set]) => (
                      <div key={lbl}>
                        <Label className="text-xs text-muted-foreground">
                          {lbl}
                        </Label>
                        <Textarea
                          value={val}
                          onChange={(e) => set(e.target.value)}
                          className="text-xs min-h-[30px] resize-none"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs space-y-0.5">
                    {historyPersonal && (
                      <div>
                        <span className="font-semibold">Personal: </span>
                        {historyPersonal}
                      </div>
                    )}
                    {historyFamily && (
                      <div>
                        <span className="font-semibold">Family: </span>
                        {historyFamily}
                      </div>
                    )}
                    {historyImmunization && (
                      <div>
                        <span className="font-semibold">Immunization: </span>
                        {historyImmunization}
                      </div>
                    )}
                    {historyAllergy && (
                      <div>
                        <span className="font-semibold">Allergy: </span>
                        {historyAllergy}
                      </div>
                    )}
                    {historyOthers && (
                      <div>
                        <span className="font-semibold">Others: </span>
                        {historyOthers}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {(dh || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-amber-600 mb-0.5">
                  D/H
                </div>
                {editMode ? (
                  <Textarea
                    value={dh}
                    onChange={(e) => setDh(e.target.value)}
                    className="text-xs min-h-[50px] resize-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">{dh}</div>
                )}
              </div>
            )}
            {(oe || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-rose-600 mb-0.5">
                  O/E
                </div>
                {editMode ? (
                  <Textarea
                    value={oe}
                    onChange={(e) => setOe(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">{oe}</div>
                )}
              </div>
            )}
            {(investigation || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-teal-600 mb-0.5">
                  Investigation
                </div>
                {editMode ? (
                  <Textarea
                    value={investigation}
                    onChange={(e) => setInvestigation(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">
                    {investigation}
                  </div>
                )}
              </div>
            )}
            {(adviceNewInv || editMode) && (
              <div>
                <div className="font-bold text-xs uppercase text-orange-600 mb-0.5">
                  Advice / New Inv.
                </div>
                {editMode ? (
                  <Textarea
                    value={adviceNewInv}
                    onChange={(e) => setAdviceNewInv(e.target.value)}
                    className="text-xs min-h-[50px] resize-none"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">
                    {adviceNewInv}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-3">
            {(diagnosisVal || editMode) && (
              <div className="mb-2">
                <span className="font-bold text-sm">Dx: </span>
                {editMode ? (
                  <input
                    value={diagnosisVal}
                    onChange={(e) => setDiagnosisVal(e.target.value)}
                    className="border-b border-gray-300 text-sm ml-1 outline-none w-full mt-1"
                  />
                ) : (
                  <span className="text-sm">{diagnosisVal}</span>
                )}
              </div>
            )}
            <div className="text-2xl font-bold mb-2">&#8477;</div>

            {drugs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No medications added.
              </p>
            ) : (
              <div className="space-y-2">
                {drugs.map((d, i) => (
                  <div key={`drug-${d.drugName}-${i}`} className="leading-snug">
                    <div className="text-sm font-medium flex items-center gap-1 flex-wrap">
                      {i + 1}.{" "}
                      <span className="text-indigo-600">{d.drugForm}</span>{" "}
                      {d.brandName ? (
                        <>
                          <strong>{d.brandName}</strong>
                          {d.drugName && (
                            <span className="text-gray-400 text-xs ml-1">
                              ({d.drugName})
                            </span>
                          )}
                        </>
                      ) : (
                        d.drugName || d.name
                      )}{" "}
                      <span>{d.dose}</span>
                      {d.isPrn && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 font-semibold ml-1">
                          PRN
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 pl-4">
                      {d.isPrn ? (
                        <span className="italic text-purple-600">
                          PRN
                          {d.prnCondition
                            ? ` — ${d.prnCondition}`
                            : " (as needed)"}
                        </span>
                      ) : (
                        [
                          d.frequencyBn || d.frequency,
                          d.durationBn || d.duration
                            ? `– ${d.durationBn || d.duration}`
                            : "",
                          d.instructionBn || d.instructions,
                        ]
                          .filter(Boolean)
                          .join("  ")
                      )}
                      {(d.specialInstructionBn || d.specialInstruction) && (
                        <span className="text-orange-600 ml-1">
                          · {d.specialInstructionBn || d.specialInstruction}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(adviceText || editMode) && (
              <div className="mt-3 pt-2 border-t">
                <div className="font-bold text-xs uppercase text-gray-500 mb-1">
                  পরামর্শ
                </div>
                {editMode ? (
                  <Textarea
                    value={adviceText}
                    onChange={(e) => setAdviceText(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                    placeholder="Bengali advice (one per line, auto-numbered)..."
                  />
                ) : (
                  <div className="text-xs whitespace-pre-wrap">
                    {numberedAdvice}
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 pt-4 text-right">
              <div className="inline-block text-center">
                {/* sig_placeholder */}
                {signatureUrl && (
                  <img
                    src={signatureUrl}
                    alt="Doctor signature"
                    className="h-12 object-contain mx-auto mb-1"
                  />
                )}
                <div className="border-t border-gray-500 pt-1 min-w-[140px]">
                  <p className="text-xs text-gray-600 font-semibold">
                    Doctor's Signature
                  </p>
                  <p className="text-xs text-gray-500">{doctorName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
