import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Download, Edit2, Eye, Printer, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  getDoctorEmail,
  getPrescriptionHeaderImage,
} from "../hooks/useQueries";
import type { Prescription } from "../types";
import { getPrescriptionHeaderText } from "./PrescriptionHeaderPanel";
import {
  clearDoctorSignature,
  getDoctorSignature,
  getPrescriptionHeaderHtml,
  getSignatureHtml,
  numberAdviceLines,
  setDoctorSignature,
} from "./PrescriptionHelpers";

interface RxDrug {
  id?: string;
  drugForm?: string;
  route?: string;
  routeBn?: string;
  drugName?: string;
  brandName?: string;
  nameType?: "brand" | "generic";
  dose?: string;
  duration?: string;
  durationBn?: string;
  instructions?: string;
  instructionBn?: string;
  frequency?: string;
  frequencyBn?: string;
  specialInstruction?: string;
  specialInstructionBn?: string;
  name?: string;
  form?: string;
  isPrn?: boolean;
  prnCondition?: string;
}

interface ClinicalSummary {
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
  diagnosis?: string;
  bloodGroup?: string;
  address?: string;
  sex?: string;
}

interface Props {
  prescription: Prescription | null;
  patientName?: string;
  patientAge?: number;
  patientWeight?: string;
  registerNumber?: string;
  patientId?: bigint;
  bloodGroup?: string;
  address?: string;
  sex?: string;
  onClose?: () => void;
  /** "hospital" for admitted, "chamber" for outpatient */
  headerType?: "hospital" | "chamber";
  isAdmitted?: boolean;
}

function extractClinicalSummary(notes?: string): ClinicalSummary {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed as ClinicalSummary;
  } catch {
    return { adviceText: notes };
  }
}

// normalization helper — accepts unknown prescription shape from storage
function normalizeDrug(m: any): RxDrug {
  return {
    id: m.id || String(Math.random()),
    drugForm: m.drugForm || m.form || "",
    route: m.route || "",
    routeBn: m.routeBn || "",
    drugName: m.drugName || m.name || "",
    brandName: m.brandName || "",
    nameType: m.nameType || "generic",
    dose: m.dose || "",
    duration: m.duration || "",
    durationBn: m.durationBn || "",
    instructions: m.instructions || "",
    instructionBn: m.instructionBn || "",
    frequency: m.frequency || "",
    frequencyBn: m.frequencyBn || "",
    specialInstruction: m.specialInstruction || "",
    specialInstructionBn: m.specialInstructionBn || "",
  };
}

/** Render a prescription header block inline (for on-screen preview) */
function HeaderBlock({
  headerType,
  fallbackDoctorInfo,
}: {
  headerType: "hospital" | "chamber";
  fallbackDoctorInfo: Record<string, string> | null;
}) {
  const img = getPrescriptionHeaderImage(headerType);
  if (img) {
    return (
      <div className="border-b pb-2 mb-3 text-center">
        <img
          src={img}
          alt="Header"
          className="max-h-24 object-contain mx-auto"
        />
      </div>
    );
  }

  const textData = getPrescriptionHeaderText(headerType);
  if (textData) {
    if (headerType === "hospital") {
      return (
        <div className="border-b pb-2 mb-3 text-center">
          <h2 className="font-bold text-base">{textData.hospitalName}</h2>
          {textData.tagline && (
            <p className="text-sm text-gray-600">{textData.tagline}</p>
          )}
        </div>
      );
    }
    return (
      <div className="border-b pb-3 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-base">{textData.doctorName}</h2>
            {textData.degrees && (
              <p className="text-sm text-gray-600 font-medium">
                {textData.degrees}
              </p>
            )}
            {textData.chamberAddress && (
              <p className="text-sm text-gray-600">{textData.chamberAddress}</p>
            )}
          </div>
          {textData.phone && (
            <div className="text-right text-sm text-gray-600">
              <p>Mob: {textData.phone}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dynamic fallback — read from localStorage doctor profile
  const getDoctorProfile = () => {
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
    return fallbackDoctorInfo;
  };
  const profile = getDoctorProfile();

  if (headerType === "hospital") {
    return (
      <div className="border-b pb-2 mb-3 text-center">
        <h2 className="font-bold text-base">
          {profile?.hospitalName ??
            fallbackDoctorInfo?.hospitalName ??
            "Dr. Sirajul Islam Medical College Hospital"}
        </h2>
        <p className="text-sm text-gray-600">Dept. of General Surgery</p>
      </div>
    );
  }
  return (
    <div className="border-b pb-3 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-base">
            {profile?.name ??
              fallbackDoctorInfo?.name ??
              "Dr. Arman Kabir (ZOSID)"}
          </h2>
          <p className="text-sm text-gray-600 font-medium">
            {profile?.degrees ??
              profile?.designation ??
              fallbackDoctorInfo?.degrees ??
              "MBBS (D.U.) | Emergency Medical Officer"}
          </p>
          {profile?.posts && (
            <p className="text-xs text-gray-500">{profile.posts}</p>
          )}
          <p className="text-sm text-gray-600">
            {profile?.chamber ??
              profile?.chamberAddress ??
              fallbackDoctorInfo?.chamber ??
              "Dr. Sirajul Islam Medical College Hospital"}
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          {profile?.regNo && <p>Reg. no. {profile.regNo}</p>}
          {!profile?.regNo && !fallbackDoctorInfo?.regNo && (
            <p>Reg. no. A-105224</p>
          )}
          <p>
            Mob:{" "}
            {profile?.phone ??
              fallbackDoctorInfo?.phone ??
              "01751959262 / 01984587802"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Signature block for on-screen display */
function SignatureBlock({
  doctorName,
  signatureUrl,
}: {
  doctorName: string;
  signatureUrl: string | null;
}) {
  return (
    <div className="mt-8 pt-4 text-right">
      <div className="inline-block text-center">
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
  );
}

export default function PrescriptionPadPreview({
  prescription,
  patientName,
  patientAge,
  patientWeight,
  registerNumber,
  bloodGroup,
  address,
  sex,
  onClose: _onClose,
  headerType: headerTypeProp,
  isAdmitted,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [withHeader, setWithHeader] = useState(true);

  // Determine header type: admitted → hospital, outpatient → chamber
  const effectiveHeaderType: "hospital" | "chamber" =
    headerTypeProp ?? (isAdmitted ? "hospital" : "chamber");

  const raw = extractClinicalSummary(prescription?.notes);

  const [name, setName] = useState(patientName || "");
  const [age, setAge] = useState(patientAge ? String(patientAge) : "");
  const [weight, setWeight] = useState(patientWeight || "");
  const [regNo, setRegNo] = useState(registerNumber || "");
  const [bg, setBg] = useState(bloodGroup || raw.bloodGroup || "");
  const [addr, setAddr] = useState(address || raw.address || "");
  const [sexVal, setSexVal] = useState(sex || raw.sex || "");
  const [rxDate, setRxDate] = useState(
    prescription?.prescriptionDate
      ? format(
          new Date(Number(prescription.prescriptionDate / 1000000n)),
          "MMM d, yyyy",
        )
      : format(new Date(), "MMM d, yyyy"),
  );
  const [diagnosis, setDiagnosis] = useState(
    raw.diagnosis || prescription?.diagnosis || "",
  );
  const [cc, setCc] = useState(raw.cc || "");
  const [pmh, setPmh] = useState(raw.pmh || "");
  const [dh, setDh] = useState(raw.dh || "");
  const [oe, setOe] = useState(raw.oe || "");
  const [historyPersonal, setHistoryPersonal] = useState(
    raw.historyPersonal || "",
  );
  const [historyFamily, setHistoryFamily] = useState(raw.historyFamily || "");
  const [historyImmunization, setHistoryImmunization] = useState(
    raw.historyImmunization || "",
  );
  const [historyAllergy, setHistoryAllergy] = useState(
    raw.historyAllergy || "",
  );
  const [historyOthers, setHistoryOthers] = useState(raw.historyOthers || "");
  const [investigation, setInvestigation] = useState(raw.investigation || "");
  const [adviceNewInv, setAdviceNewInv] = useState(raw.adviceNewInv || "");
  const [adviceText, setAdviceText] = useState(raw.adviceText || "");

  // Signature management
  const [signatureUrl, setSignatureUrl] = useState<string | null>(() =>
    getDoctorSignature(),
  );
  const sigFileRef = useRef<HTMLInputElement>(null);

  const [drugs, setDrugs] = useState<RxDrug[]>(
    (prescription?.medications || []).map(normalizeDrug),
  );

  const hasHistory =
    historyPersonal ||
    historyFamily ||
    historyImmunization ||
    historyAllergy ||
    historyOthers;

  // Get doctor name for signature
  function getDoctorDisplayName(): string {
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

  const doctorDisplayName = getDoctorDisplayName();

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 1024 * 1024) {
      alert("Signature image must be under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setDoctorSignature(dataUrl);
      setSignatureUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handlePrint(saveAsPdf = false) {
    const printId = "rx-pad-preview-print";
    const el = document.getElementById(printId);
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const headerHtml = withHeader
      ? getPrescriptionHeaderHtml(effectiveHeaderType, null)
      : "";
    const sigHtml = getSignatureHtml(doctorDisplayName, signatureUrl);
    win.document.write(`
      <html><head><title>Prescription</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Georgia, serif; font-size: 11pt; margin: 15mm; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .grid { display: grid !important; }
        .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        .col-span-2 { grid-column: span 2 / span 2 !important; }
        .col-span-3 { grid-column: span 3 / span 3 !important; }
        .gap-3 { gap: 0.75rem !important; }
        .flex { display: flex !important; }
        .flex-wrap { flex-wrap: wrap !important; }
        .items-start { align-items: flex-start !important; }
        .justify-between { justify-content: space-between !important; }
        .gap-x-4 { column-gap: 1rem !important; }
        .space-y-2 > * + * { margin-top: 0.5rem !important; }
        .space-y-1 > * + * { margin-top: 0.25rem !important; }
        .mb-1 { margin-bottom: 0.25rem !important; }
        .mb-2 { margin-bottom: 0.5rem !important; }
        .mb-3 { margin-bottom: 0.75rem !important; }
        .mt-3 { margin-top: 0.75rem !important; }
        .mt-8 { margin-top: 2rem !important; }
        .pb-2 { padding-bottom: 0.5rem !important; }
        .pt-2 { padding-top: 0.5rem !important; }
        .pl-4 { padding-left: 1rem !important; }
        .pr-2 { padding-right: 0.5rem !important; }
        .p-4 { padding: 1rem !important; }
        .border-b { border-bottom: 1px solid #d1d5db !important; }
        .border-t { border-top: 1px solid #d1d5db !important; }
        .border-r { border-right: 1px solid #d1d5db !important; }
        .border { border: 1px solid #d1d5db !important; }
        .font-serif { font-family: Georgia, serif !important; }
        .font-bold { font-weight: 700 !important; }
        .font-medium { font-weight: 500 !important; }
        .font-semibold { font-weight: 600 !important; }
        .text-base { font-size: 1rem !important; }
        .text-sm { font-size: 0.875rem !important; }
        .text-xs { font-size: 0.75rem !important; }
        .text-2xl { font-size: 1.5rem !important; }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }
        .uppercase { text-transform: uppercase !important; }
        .whitespace-pre-wrap { white-space: pre-wrap !important; }
        .leading-snug { line-height: 1.375 !important; }
        .text-gray-900 { color: #111827 !important; }
        .text-gray-800 { color: #1f2937 !important; }
        .text-gray-600 { color: #4b5563 !important; }
        .text-gray-500 { color: #6b7280 !important; }
        .text-indigo-600 { color: #4f46e5 !important; }
        .text-orange-600 { color: #ea580c !important; }
        .text-teal-600 { color: #0d9488 !important; }
        .rounded { border-radius: 0.25rem !important; }
        .max-w-2xl { max-width: 42rem !important; }
        .mx-auto { margin-left: auto !important; margin-right: auto !important; }
        .ml-1 { margin-left: 0.25rem !important; }
        strong { font-weight: 700 !important; }
        .signature-line { border-top: 1px solid #555; min-width: 120px; display: inline-block; }
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
      </style></head><body>
      ${headerHtml}
      ${el.innerHTML}
      ${sigHtml}
      </body></html>
    `);
    win.document.close();
    if (saveAsPdf) {
      win.onafterprint = () => win.close();
    }
    win.focus();
    win.print();
  }

  function updateDrug(index: number, field: keyof RxDrug, value: string) {
    setDrugs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  const numberedAdvice = numberAdviceLines(adviceText);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/40 border rounded-xl p-3">
        <Button
          size="sm"
          variant="outline"
          className={`gap-1.5 ${editMode ? "bg-amber-50 border-amber-300 text-amber-700" : "border-border"}`}
          onClick={() => setEditMode((v) => !v)}
          data-ocid="rx_pad.toggle"
        >
          {editMode ? (
            <>
              <Eye className="w-3.5 h-3.5" /> View Mode
            </>
          ) : (
            <>
              <Edit2 className="w-3.5 h-3.5" /> Edit Mode
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`gap-1.5 ${
            withHeader
              ? "bg-teal-50 border-teal-300 text-teal-700"
              : "border-border text-muted-foreground"
          }`}
          onClick={() => setWithHeader((v) => !v)}
          data-ocid="rx_pad.toggle"
        >
          {withHeader ? "With Header" : "Without Header"}
        </Button>
        {/* Signature upload */}
        <div className="flex items-center gap-1">
          <input
            ref={sigFileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleSignatureUpload}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => sigFileRef.current?.click()}
            className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
            data-ocid="rx_pad.upload_signature_button"
          >
            <Upload className="w-3 h-3" />
            {signatureUrl ? "Change Signature" : "Upload Signature"}
          </Button>
          {signatureUrl && (
            <button
              type="button"
              onClick={() => {
                clearDoctorSignature();
                setSignatureUrl(null);
              }}
              className="text-red-400 hover:text-red-600"
              title="Remove signature"
              aria-label="Remove signature"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {signatureUrl && (
          <img
            src={signatureUrl}
            alt="Signature preview"
            className="h-8 object-contain border rounded px-1"
          />
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
          onClick={() => handlePrint()}
          data-ocid="rx_pad.button"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          onClick={() => handlePrint(true)}
          data-ocid="rx_pad.button"
        >
          <Download className="w-3.5 h-3.5" /> Save PDF
        </Button>
      </div>

      {/* Patient Info Bar (edit mode) */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {[
              { label: "Name", val: name, set: setName },
              { label: "Age (yrs)", val: age, set: setAge },
              { label: "Sex", val: sexVal, set: setSexVal },
              { label: "Weight (kg)", val: weight, set: setWeight },
              { label: "Blood Group", val: bg, set: setBg },
              { label: "Reg No", val: regNo, set: setRegNo },
              { label: "Date", val: rxDate, set: setRxDate },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <Label className="text-xs text-blue-700 font-semibold">
                  {label}
                </Label>
                <Input
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="h-7 text-sm mt-0.5"
                />
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Label className="text-xs text-blue-700 font-semibold">
              Address
            </Label>
            <Input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              className="h-7 text-sm mt-0.5"
            />
          </div>
        </div>
      )}

      {/* Print target — header is injected by handlePrint, not rendered here */}
      <div
        id="rx-pad-preview-print"
        className="font-serif text-gray-900 border border-gray-200 p-4 rounded bg-white rx-print-container"
      >
        <div className="rx-print-top-accent" />
        {/* On-screen header */}
        {withHeader && (
          <HeaderBlock
            headerType={effectiveHeaderType}
            fallbackDoctorInfo={null}
          />
        )}

        {/* Patient info line */}
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
          {weight && (
            <span>
              <strong>Weight:</strong> {weight} <strong>kg</strong>
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

        {/* 2-column layout */}
        <div className="grid grid-cols-5 gap-3">
          {/* Left: clinical summary */}
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
                    placeholder="Chief Complaints..."
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
                    placeholder="Past Medical/Surgical History..."
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
                        "Personal",
                        "Family",
                        "Immunization",
                        "Allergy",
                        "Others",
                      ] as const
                    ).map((tab) => {
                      const vals: Record<string, string> = {
                        Personal: historyPersonal,
                        Family: historyFamily,
                        Immunization: historyImmunization,
                        Allergy: historyAllergy,
                        Others: historyOthers,
                      };
                      const setters: Record<string, (v: string) => void> = {
                        Personal: setHistoryPersonal,
                        Family: setHistoryFamily,
                        Immunization: setHistoryImmunization,
                        Allergy: setHistoryAllergy,
                        Others: setHistoryOthers,
                      };
                      return (
                        <div key={tab}>
                          <Label className="text-xs text-muted-foreground">
                            {tab}
                          </Label>
                          <Textarea
                            value={vals[tab]}
                            onChange={(e) => setters[tab](e.target.value)}
                            className="text-xs min-h-[35px] resize-none"
                          />
                        </div>
                      );
                    })}
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
                    placeholder="Drug History..."
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
                    placeholder="On Examination..."
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
                    placeholder="Investigation Reports..."
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
                    placeholder="Advice / New Investigation..."
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-xs">
                    {adviceNewInv}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Rx */}
          <div className="col-span-3">
            {(diagnosis || editMode) && (
              <div className="mb-2">
                <span className="font-bold text-sm">Dx: </span>
                {editMode ? (
                  <input
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="border-b border-gray-300 text-sm ml-1 outline-none flex-1 w-full mt-1"
                    placeholder="Diagnosis..."
                  />
                ) : (
                  <span className="text-sm">{diagnosis}</span>
                )}
              </div>
            )}
            <div className="text-2xl font-bold mb-2">&#8477;</div>

            {/* Drug table in edit mode */}
            {editMode && drugs.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {[
                        "#",
                        "Form",
                        "Drug Name",
                        "Dose",
                        "Freq.",
                        "Duration",
                        "Instructions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="border border-gray-200 px-1 py-1 text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map((d, i) => (
                      <tr key={d.id || i}>
                        <td className="border border-gray-200 px-1 py-1">
                          {i + 1}
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          <input
                            value={d.drugForm || ""}
                            onChange={(e) =>
                              updateDrug(i, "drugForm", e.target.value)
                            }
                            className="w-12 outline-none border-b border-gray-300"
                          />
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          <input
                            value={d.drugName || ""}
                            onChange={(e) =>
                              updateDrug(i, "drugName", e.target.value)
                            }
                            className="w-28 outline-none border-b border-gray-300"
                          />
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          <input
                            value={d.dose || ""}
                            onChange={(e) =>
                              updateDrug(i, "dose", e.target.value)
                            }
                            className="w-16 outline-none border-b border-gray-300"
                          />
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          <input
                            value={d.frequencyBn || d.frequency || ""}
                            onChange={(e) =>
                              updateDrug(i, "frequencyBn", e.target.value)
                            }
                            className="w-20 outline-none border-b border-gray-300"
                          />
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          <input
                            value={d.durationBn || d.duration || ""}
                            onChange={(e) =>
                              updateDrug(i, "durationBn", e.target.value)
                            }
                            className="w-16 outline-none border-b border-gray-300"
                          />
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          <input
                            value={d.instructionBn || d.instructions || ""}
                            onChange={(e) =>
                              updateDrug(i, "instructionBn", e.target.value)
                            }
                            className="w-24 outline-none border-b border-gray-300"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Drug list in view mode (2-line format) */}
            {!editMode &&
              (drugs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No medications added.
                </p>
              ) : (
                <div className="space-y-2">
                  {drugs.map((d, i) => (
                    <div key={d.id || i} className="leading-snug">
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
                        ) : d.nameType === "brand" ? (
                          <strong>{d.drugName}</strong>
                        ) : (
                          d.drugName
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
              ))}

            {/* Advice — numbered */}
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
                    placeholder="Advice in Bengali... (one item per line, auto-numbered)"
                  />
                ) : (
                  <div className="text-xs whitespace-pre-wrap">
                    {numberedAdvice}
                  </div>
                )}
              </div>
            )}

            {/* Doctor Signature */}
            <SignatureBlock
              doctorName={doctorDisplayName}
              signatureUrl={signatureUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
