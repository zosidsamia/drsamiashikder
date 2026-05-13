/**
 * ConsentForm — digital consent with canvas signature and print/download
 * Supports 4 clinical templates + locked snapshot on signing.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { CheckCircle2, Printer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEmailAuth } from "../hooks/useEmailAuth";
import type { Patient } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConsentTemplateType =
  | "admission"
  | "surgical"
  | "transfusion"
  | "procedure";

export interface ConsentRecord {
  id: string;
  patientId: string;
  templateType: ConsentTemplateType;
  procedureName?: string;
  formText: string;
  signatureDataUrl: string;
  signedAt: string;
  witnessName: string;
  lockedAt: string;
}

// ── Template generators ───────────────────────────────────────────────────────

function getTemplateText(
  type: ConsentTemplateType,
  patient: Patient,
  procedureName?: string,
): string {
  const name = patient.fullName;
  const regNo = patient.registerNumber ?? "—";
  const date = format(new Date(), "dd MMMM yyyy");

  switch (type) {
    case "admission":
      return `GENERAL ADMISSION CONSENT FORM

Patient Name: ${name}
Register Number: ${regNo}
Date: ${date}

I, ${name}, hereby consent to admission at this healthcare facility and authorize the medical team to provide necessary medical and nursing care as deemed appropriate.

I understand and agree to the following:

1. RIGHT TO TREATMENT
   I voluntarily consent to examination, investigation, and treatment by authorized medical staff of this facility. I understand that the nature of the treatment may change as my condition evolves.

2. HOSPITAL RULES AND REGULATIONS
   I agree to comply with all hospital rules, regulations, and policies during my stay. I understand that failure to comply may result in discharge.

3. PERSONAL VALUABLES
   I understand that the hospital does not accept responsibility for loss or damage to personal items, money, or valuables brought to the facility.

4. DATA USAGE AND CONFIDENTIALITY
   I consent to the collection, storage, and use of my personal and medical data for the purposes of treatment, medical audit, and quality improvement. I understand my data will be kept confidential in accordance with applicable privacy laws.

5. TEACHING AND TRAINING
   I consent to the presence of medical students, nursing students, and other trainees during my care, under supervision of qualified staff. I may withdraw this consent at any time.

6. PHOTOGRAPHY / CLINICAL RECORDS
   I consent to clinical photography or recording for medical documentation purposes. Such records will remain confidential and used only for clinical and educational purposes.

7. BLOOD PRODUCTS
   I understand that if I require blood or blood products during my treatment, a separate consent will be sought unless an emergency makes this impossible.

I confirm that I have had the opportunity to ask questions and have received satisfactory answers. I sign this form voluntarily and of my own free will.`;

    case "surgical":
      return `SURGICAL PROCEDURE CONSENT FORM

Patient Name: ${name}
Register Number: ${regNo}
Procedure: ${procedureName ?? "[Procedure Name]"}
Date: ${date}

I, ${name}, hereby consent to the following surgical/interventional procedure:

PROCEDURE: ${procedureName ?? "[Describe procedure here]"}

DESCRIPTION OF PROCEDURE:
[The surgeon will describe the nature of this procedure, the steps involved, and the expected outcomes.]

INTENDED BENEFITS:
[Detail the expected benefits of the procedure as discussed with the patient.]

MATERIAL RISKS AND POSSIBLE COMPLICATIONS:
- General anaesthetic risks (nausea, sore throat, dental damage, allergic reactions, nerve injury, death — rare)
- Bleeding requiring transfusion
- Infection at the surgical site
- Deep vein thrombosis (blood clots) and pulmonary embolism
- Damage to surrounding structures including blood vessels, nerves, or organs
- Scarring and wound healing complications
- Failure to achieve the intended purpose requiring further surgery
- Anaesthesia awareness (rare)
- Procedure-specific risks as discussed

ANAESTHESIA:
I consent to the administration of local, regional, or general anaesthesia as deemed necessary by the anaesthetist.

ALTERNATIVE TREATMENTS:
I have been informed of alternative treatments including [non-surgical management, other surgical approaches] and I understand the risks of declining this procedure.

BLOOD PRODUCTS:
I consent/do not consent to the use of blood or blood products during this procedure if deemed medically necessary.

UNFORESEEN CIRCUMSTANCES:
I authorize the surgeon to perform any additional procedures during the operation that become necessary or advisable in the surgeon's professional judgement.

I confirm that the nature, purpose, risks, and benefits of the procedure have been explained to me. I have had the opportunity to ask questions and I sign this voluntarily.`;

    case "transfusion":
      return `BLOOD TRANSFUSION CONSENT FORM

Patient Name: ${name}
Register Number: ${regNo}
Date: ${date}

I, ${name}, hereby consent to the administration of blood or blood products as deemed medically necessary by my treating physician.

REASON FOR TRANSFUSION:
[The doctor will document the clinical indication for transfusion here — e.g., severe anaemia, haemorrhage, clotting disorder, etc.]

BLOOD PRODUCTS THAT MAY BE ADMINISTERED:
- Packed Red Blood Cells (PRBC)
- Fresh Frozen Plasma (FFP)
- Platelets
- Cryoprecipitate
- Whole Blood
- Albumin / immunoglobulins

BENEFITS:
Blood transfusion may improve oxygen delivery, control bleeding, or correct clotting deficiencies and may be life-saving in certain circumstances.

KNOWN RISKS:
1. Transfusion Reactions — Fever, chills, rash, or urticaria (mild reactions are common; severe anaphylactic reactions are rare)
2. Haemolytic Reaction — Incompatible blood causing destruction of red blood cells (rare but serious)
3. Transfusion-Associated Circulatory Overload (TACO) — fluid overload, especially in cardiac or elderly patients
4. Transfusion-Related Acute Lung Injury (TRALI) — rare, potentially serious
5. Infection Transmission — Hepatitis B, Hepatitis C, HIV, CMV (extremely rare with modern screening)
6. Iron Overload — risk with repeated transfusions
7. Alloimmunisation — development of antibodies complicating future transfusions

ALTERNATIVES:
I have been informed of alternatives including: iron replacement therapy, erythropoietin stimulating agents, autologous blood transfusion, or accepting the risks of anaemia without transfusion.

REFUSAL:
I understand that refusal of blood transfusion may have serious or life-threatening consequences and I accept full responsibility for such outcomes.

I confirm I have been counselled about this procedure and have had the opportunity to ask questions.`;

    case "procedure":
      return `INVESTIGATIVE / DIAGNOSTIC PROCEDURE CONSENT FORM

Patient Name: ${name}
Register Number: ${regNo}
Procedure: ${procedureName ?? "[Procedure Name]"}
Date: ${date}

I, ${name}, hereby consent to the following diagnostic/investigative procedure:

PROCEDURE: ${procedureName ?? "[Describe the diagnostic procedure here]"}

PURPOSE:
This procedure is being performed to [describe clinical indication, e.g., diagnose a suspected condition, assess treatment response, obtain tissue for examination].

PROCEDURE DETAILS:
[The clinician will describe exactly how the procedure will be performed, including preparation, technique, and recovery.]

RADIATION / CONTRAST RISKS (if applicable):
- Ionising Radiation: This procedure involves exposure to X-rays / CT radiation. The dose is within accepted safety limits. Cumulative radiation exposure carries a small theoretical increased risk of malignancy.
- Contrast Media: If contrast dye is used, there is a small risk of allergic reaction (mild: rash, urticaria; severe: anaphylaxis — very rare). Contrast nephropathy is a risk in patients with impaired kidney function.
- MRI: Metallic implants, pacemakers, or cochlear implants may be contraindicated. Claustrophobia is managed with sedation if needed.

PROCEDURE-SPECIFIC RISKS:
- Pain or discomfort during the procedure
- Bruising, bleeding, or infection at the puncture site
- Vasovagal reactions (fainting)
- Failure to obtain adequate sample requiring repeat procedure
- Incidental findings requiring further investigation

ALTERNATIVES:
I have been informed of alternative diagnostic approaches. I understand the risks of not proceeding with this investigation.

AFTER THE PROCEDURE:
I understand post-procedure instructions will be provided and I agree to follow them.

I confirm that the nature, purpose, risks, and benefits of this procedure have been explained to me satisfactorily.`;
  }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export function loadConsentForms(patientId: bigint): ConsentRecord[] {
  try {
    const raw = localStorage.getItem(`consentForms_${patientId}`);
    return raw ? (JSON.parse(raw) as ConsentRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveConsentForms(
  patientId: bigint,
  records: ConsentRecord[],
): void {
  localStorage.setItem(`consentForms_${patientId}`, JSON.stringify(records));
}

// ── Canvas signature hook ─────────────────────────────────────────────────────

function useSignatureCanvas(disabled: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const getPos = useCallback(
    (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.clientX;
      const clientY = e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const onMouseDown = (e: MouseEvent) => {
      if (disabled) return;
      isDrawing.current = true;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawing.current || disabled) return;
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };
    const onMouseUp = () => {
      isDrawing.current = false;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e.touches[0], canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDrawing.current || disabled) return;
      e.preventDefault();
      const pos = getPos(e.touches[0], canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };
    const onTouchEnd = () => {
      isDrawing.current = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, getPos]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const isEmpty = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return !data.some((v) => v !== 0);
  }, []);

  const toDataUrl = useCallback(() => {
    return canvasRef.current?.toDataURL("image/png") ?? "";
  }, []);

  return { canvasRef, clear, isEmpty, toDataUrl };
}

// ── Template label helpers ────────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<ConsentTemplateType, string> = {
  admission: "General Admission Consent",
  surgical: "Surgical Procedure Consent",
  transfusion: "Blood Transfusion Consent",
  procedure: "Investigative Procedure Consent",
};

const TEMPLATE_COLORS: Record<ConsentTemplateType, string> = {
  admission: "bg-blue-100 text-blue-800 border-blue-200",
  surgical: "bg-purple-100 text-purple-800 border-purple-200",
  transfusion: "bg-red-100 text-red-800 border-red-200",
  procedure: "bg-amber-100 text-amber-800 border-amber-200",
};

// ── Main component ────────────────────────────────────────────────────────────

interface ConsentFormProps {
  patientId: bigint;
  patient: Patient;
  procedureName?: string;
  templateType: ConsentTemplateType;
  onSigned: (record: ConsentRecord) => void;
  onClose: () => void;
}

export default function ConsentForm({
  patientId,
  patient,
  procedureName,
  templateType,
  onSigned,
  onClose,
}: ConsentFormProps) {
  const { currentDoctor } = useEmailAuth();
  const [formText, setFormText] = useState(() =>
    getTemplateText(templateType, patient, procedureName),
  );
  const [locked, setLocked] = useState(false);
  const [signedRecord, setSignedRecord] = useState<ConsentRecord | null>(null);

  const { canvasRef, clear, isEmpty, toDataUrl } = useSignatureCanvas(locked);

  function handleSign() {
    if (isEmpty()) {
      toast.error("Please draw a signature before signing.");
      return;
    }
    const now = new Date().toISOString();
    const record: ConsentRecord = {
      id: `consent_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      patientId: String(patientId),
      templateType,
      procedureName,
      formText,
      signatureDataUrl: toDataUrl(),
      signedAt: now,
      witnessName: currentDoctor?.name ?? "Unknown",
      lockedAt: now,
    };

    // Persist
    const existing = loadConsentForms(patientId);
    saveConsentForms(patientId, [...existing, record]);

    setSignedRecord(record);
    setLocked(true);
    toast.success("Consent form signed and locked.");
    onSigned(record);
  }

  function handlePrint() {
    if (!signedRecord) return;
    const html = buildPrintHtml(signedRecord, patient);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-ocid="consent_form.dialog"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-blue-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-label="Consent form icon"
              >
                <title>Consent form</title>
                <path d="M9 12l2 2 4-4M7 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2" />
                <path d="M9 4h6v4H9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {TEMPLATE_LABELS[templateType]}
              </h2>
              <p className="text-xs text-muted-foreground">
                {patient.fullName} · {patient.registerNumber ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={`text-xs border ${TEMPLATE_COLORS[templateType]}`}
            >
              {TEMPLATE_LABELS[templateType]}
            </Badge>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-ocid="consent_form.close_button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Form text — editable before signing */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Consent Form Text
              {!locked && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (editable — review and modify before presenting to patient)
                </span>
              )}
            </Label>
            <Textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              disabled={locked}
              className="font-mono text-xs leading-relaxed min-h-[340px] resize-none"
              data-ocid="consent_form.editor"
            />
          </div>

          {/* Signature area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">
                Patient Signature
              </Label>
              {!locked && (
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors underline"
                  data-ocid="consent_form.clear_signature"
                >
                  Clear Signature
                </button>
              )}
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={680}
                height={140}
                className={`w-full border-2 rounded-xl bg-background touch-none ${
                  locked
                    ? "border-border opacity-60 cursor-not-allowed"
                    : "border-dashed border-primary/50 cursor-crosshair hover:border-primary"
                }`}
                style={{ touchAction: "none" }}
                data-ocid="consent_form.canvas_target"
              />
              {!locked && (
                <p className="absolute bottom-2 right-3 text-[10px] text-muted-foreground pointer-events-none">
                  Draw signature here
                </p>
              )}
              {locked && signedRecord && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-4 border-green-500 rounded-xl px-6 py-2 rotate-[-8deg] opacity-80">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-xl font-bold tracking-widest">
                        SIGNED
                      </span>
                    </div>
                    <p className="text-xs text-green-700 text-center mt-0.5">
                      {format(
                        new Date(signedRecord.signedAt),
                        "dd MMM yyyy HH:mm",
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!locked && (
              <p className="text-xs text-muted-foreground">
                Witness / Doctor:{" "}
                <strong>{currentDoctor?.name ?? "Unknown"}</strong>
              </p>
            )}
            {locked && signedRecord && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold">
                    Consent signed and locked at{" "}
                    {format(
                      new Date(signedRecord.lockedAt),
                      "HH:mm, dd MMM yyyy",
                    )}
                  </p>
                  <p className="text-xs mt-0.5">
                    Witnessed by {signedRecord.witnessName} · This record is
                    immutable.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="consent_form.cancel_button"
          >
            {locked ? "Close" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            {locked && (
              <Button
                variant="outline"
                onClick={handlePrint}
                className="gap-2"
                data-ocid="consent_form.print_button"
              >
                <Printer className="w-4 h-4" />
                Print / Download
              </Button>
            )}
            {!locked && (
              <Button
                onClick={handleSign}
                className="gap-2 bg-primary hover:bg-primary/90"
                data-ocid="consent_form.submit_button"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sign & Lock
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Print HTML builder ────────────────────────────────────────────────────────

function buildPrintHtml(record: ConsentRecord, patient: Patient): string {
  const signedAt = format(new Date(record.signedAt), "dd MMMM yyyy, HH:mm");
  const escapedText = record.formText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${TEMPLATE_LABELS[record.templateType]} — ${patient.fullName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #111; max-width: 750px; }
  h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .subtitle { color: #555; font-size: 11px; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 10px; }
  .form-text { font-size: 11px; line-height: 1.7; margin: 20px 0; white-space: pre-wrap; }
  .signature-section { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 16px; }
  .sig-img { max-width: 300px; border: 1px solid #ccc; border-radius: 6px; }
  .sig-meta { font-size: 10px; color: #555; margin-top: 6px; }
  .legal-footer { margin-top: 30px; padding: 10px 16px; border: 2px solid #111; font-size: 10px; text-align: center; font-weight: bold; }
  @page { margin: 2cm; }
</style>
</head>
<body>
<h1>Dr. Arman Kabir's Care</h1>
<div class="subtitle">
  ${TEMPLATE_LABELS[record.templateType].toUpperCase()} &nbsp;·&nbsp;
  Patient: ${patient.fullName} (Reg. ${patient.registerNumber ?? "—"}) &nbsp;·&nbsp;
  Date: ${signedAt}
  ${record.procedureName ? `&nbsp;·&nbsp; Procedure: ${record.procedureName}` : ""}
</div>
<div class="form-text">${escapedText}</div>
<div class="signature-section">
  <p style="font-size:11px; font-weight:bold; margin-bottom:8px;">Patient Signature:</p>
  <img src="${record.signatureDataUrl}" class="sig-img" alt="Signature"/>
  <div class="sig-meta">
    Signed at: ${signedAt}<br/>
    Witnessed by: ${record.witnessName} (Doctor / Clinical Staff)<br/>
    Consent ID: ${record.id}
  </div>
</div>
<div class="legal-footer">
  This document is legally binding. Signed consent has been recorded in the patient's medical record.
  Unauthorized alteration of this document is prohibited.
</div>
</body>
</html>`;
}

// ── ConsentFormSelector — inline trigger button with template picker ──────────

interface ConsentFormSelectorProps {
  patientId: bigint;
  patient: Patient;
  procedureName?: string;
}

export function ConsentFormSelector({
  patientId,
  patient,
  procedureName,
}: ConsentFormSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] =
    useState<ConsentTemplateType>("admission");
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <ConsentForm
        patientId={patientId}
        patient={patient}
        procedureName={procedureName}
        templateType={selectedType}
        onSigned={() => setShowForm(false)}
        onClose={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((p) => !p)}
        className="gap-2 text-xs"
        data-ocid="consent_form.open_modal_button"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-label="Consent"
        >
          <title>Consent</title>
          <path d="M9 12l2 2 4-4M7 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2" />
          <path d="M9 4h6v4H9z" />
        </svg>
        Add Consent Form
      </Button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-30 p-3 min-w-56">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Select template
          </p>
          {(
            [
              "admission",
              "surgical",
              "transfusion",
              "procedure",
            ] as ConsentTemplateType[]
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedType(t);
                setOpen(false);
                setShowForm(true);
              }}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors block"
            >
              {TEMPLATE_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
