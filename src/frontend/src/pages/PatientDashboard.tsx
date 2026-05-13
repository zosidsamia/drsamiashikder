/**
 * PatientDashboard page — route-level wrapper.
 * Handles data fetching, modals (visit form, prescription EMR),
 * and renders the inner PatientDashboardInner component.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  ChevronRight,
  Droplets,
  LogOut,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import AdmitPatientDialog from "../components/AdmitPatientDialog";
import PatientDashboardInner from "../components/PatientDashboard";
import PatientForm from "../components/PatientForm";
import PrescriptionPadPreview from "../components/PrescriptionPadPreview";
import UpgradedPrescriptionEMR from "../components/UpgradedPrescriptionEMR";
import type { PatientAccount } from "../hooks/useEmailAuth";
import { useEmailAuth } from "../hooks/useEmailAuth";
import {
  getDoctorEmail,
  getVisitFormData,
  useCreatePrescription,
  useCreateVisit,
  useDeletePatient,
  useDischargePatient,
  useGetPatient,
  useGetPrescriptionsByPatient,
  useGetVisitsByPatient,
  useUpdatePatient,
} from "../hooks/useQueries";
import { getPermissionsForRole } from "../hooks/useRolePermissions";
import { useRolePermissions } from "../hooks/useRolePermissions";
import type { Prescription, Visit } from "../types";
import type { StaffRole } from "../types";

function getAge(dateOfBirth?: bigint): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(Number(dateOfBirth / 1000000n));
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function formatTime(time: bigint): string {
  return format(new Date(Number(time / 1000000n)), "MMM d, yyyy");
}

function formatDateTime(time: bigint): string {
  return format(new Date(Number(time / 1000000n)), "MMM d, yyyy 'at' h:mm a");
}

interface Props {
  patientId?: bigint | null;
  currentRole: "admin" | "doctor" | "staff" | "patient";
  /** Granular 6-tier role — used for permission-gated clinical actions */
  viewerRole?: StaffRole;
  currentPatient?: PatientAccount | null;
  onBack?: () => void;
}

export default function PatientDashboard({
  patientId: propPatientId,
  currentRole,
  viewerRole,
  currentPatient: patientAccount,
  onBack,
}: Props) {
  const search = {
    id: new URLSearchParams(window.location.search).get("id") ?? undefined,
  };
  const patientId =
    propPatientId ??
    (search.id
      ? (() => {
          try {
            const s = String(search.id);
            const raw = s.startsWith("__bigint__") ? s.slice(10) : s;
            const cleaned = raw.replace(/[^0-9]/g, "");
            return cleaned ? BigInt(cleaned) : null;
          } catch {
            return null;
          }
        })()
      : null);

  const rolePermissions = useRolePermissions();

  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Visit form is a full-page route — no local modal state needed

  // Navigate to full-page visit form
  const openVisitPage = (pid: bigint) => {
    window.location.href = `/Visit?id=${pid}`;
  };
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxInitialDiagnosis, setRxInitialDiagnosis] = useState<
    string | undefined
  >();
  const [rxVisitExtendedData, setRxVisitExtendedData] = useState<
    Record<string, unknown> | undefined
  >();
  const [rxForceVisitData, setRxForceVisitData] = useState(false);
  const [rxPatientRegisterNumber, setRxPatientRegisterNumber] = useState<
    string | undefined
  >();
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [savedPads, setSavedPads] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const [editRx, setEditRx] = useState<Prescription | null>(null);
  const [showPadPreview, setShowPadPreview] = useState(false);
  const [padPrescription, setPadPrescription] = useState<Prescription | null>(
    null,
  );

  const loadSavedPads = () => {
    if (!patientId) return;
    try {
      const raw = localStorage.getItem(`savedPrescriptionPads_${patientId}`);
      if (raw) setSavedPads(JSON.parse(raw));
    } catch {}
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadSavedPads is stable
  useEffect(() => {
    loadSavedPads();
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: patient, isLoading: loadingPatient } = useGetPatient(
    patientId ?? 0n,
  );
  const { data: visits = [], isLoading: loadingVisits } = useGetVisitsByPatient(
    patientId ?? 0n,
  );
  const { data: prescriptions = [], isLoading: loadingRx } =
    useGetPrescriptionsByPatient(patientId ?? 0n);
  const updateMutation = useUpdatePatient();
  const _createVisitMutation = useCreateVisit();
  const createRxMutation = useCreatePrescription();
  const deleteMutation = useDeletePatient();
  const dischargeMutation = useDischargePatient();

  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => Number(b.visitDate - a.visitDate)),
    [visits],
  );
  const latestVisit = sortedVisits[0] ?? null;

  const latestVitals = useMemo(() => {
    if (!latestVisit) return null;
    try {
      const formData = getVisitFormData(latestVisit.id);
      if (formData) return formData.vitalSigns as Record<string, string> | null;
    } catch {}
    return null;
  }, [latestVisit]);

  const vitalsHistory = useMemo(() => {
    return sortedVisits
      .slice()
      .reverse()
      .map((v) => {
        // visit form data has dynamic shape
        let extra: any = {}; // visit form data has dynamic shape
        try {
          const formData = getVisitFormData(v.id);
          if (formData) extra = formData?.vitalSigns || {};
        } catch {}
        const bp = extra.bloodPressure || v.vitalSigns?.bloodPressure || "";
        const systolic = bp ? Number.parseInt(bp.split("/")[0] || "0") : null;
        const diastolic = bp ? Number.parseInt(bp.split("/")[1] || "0") : null;
        const map =
          systolic && diastolic
            ? Math.round(diastolic + (systolic - diastolic) / 3)
            : null;
        const wt =
          Number.parseFloat(extra.weight || String(patient?.weight || "")) ||
          null;
        const ht =
          Number.parseFloat(extra.height || String(patient?.height || "")) ||
          null;
        const bmi =
          wt && ht
            ? Math.round((wt / ((ht / 100) * (ht / 100))) * 10) / 10
            : null;
        return {
          date: format(new Date(Number(v.visitDate / 1000000n)), "MMM d"),
          BP: systolic || null,
          Diastolic: diastolic || null,
          MAP: map,
          Pulse:
            Number.parseFloat(extra.pulse || v.vitalSigns?.pulse || "") || null,
          Temp:
            Number.parseFloat(
              extra.temperature || v.vitalSigns?.temperature || "",
            ) || null,
          SpO2:
            Number.parseFloat(
              extra.oxygenSaturation || v.vitalSigns?.oxygenSaturation || "",
            ) || null,
          Weight: wt,
          RespRate:
            Number.parseFloat(
              extra.respiratoryRate || v.vitalSigns?.respiratoryRate || "",
            ) || null,
          BMI: bmi,
        };
      })
      .filter((r) => r.BP || r.Pulse || r.Temp || r.SpO2);
  }, [sortedVisits, patient]);

  const allInvestigations = useMemo(() => {
    const rows: Array<{
      date: string;
      name: string;
      result: string;
      unit?: string;
      interpretation?: string;
    }> = [];
    for (const v of sortedVisits) {
      try {
        const formData = getVisitFormData(v.id);
        if (formData) {
          const invRows = formData.previous_investigation_rows as typeof rows;
          if (Array.isArray(invRows)) rows.push(...invRows);
        }
      } catch {}
    }
    return rows;
  }, [sortedVisits]);

  const invByName = useMemo(() => {
    const map: Record<
      string,
      { data: Array<{ date: string; value: number }>; unit: string }
    > = {};
    for (const row of allInvestigations) {
      if (!row.name || !row.result) continue;
      const num = Number.parseFloat(row.result);
      if (Number.isNaN(num)) continue;
      if (!map[row.name]) map[row.name] = { data: [], unit: row.unit || "" };
      map[row.name].data.push({ date: row.date || "?", value: num });
    }
    return map;
  }, [allInvestigations]);

  // ── PDF download helpers ──────────────────────────────────────────────────────

  function downloadVisitHistoryPDF() {
    if (!patient) return;
    const shown = sortedVisits.filter((v) => {
      try {
        const d = getVisitFormData(v.id);
        if (d) return d.showToPatient !== false;
      } catch {}
      return true;
    });
    const rows = shown
      .map((v, i) => {
        let diag = "";
        try {
          const d = getVisitFormData(v.id);
          if (d) diag = (d.diagnosis as string) || "";
        } catch {}
        return `<tr><td>${i + 1}</td><td>${formatTime(v.visitDate)}</td><td>${v.visitType || "—"}</td><td>${diag || "—"}</td></tr>`;
      })
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Visit History - ${patient.fullName}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0;font-weight:bold}h2{color:#0f766e}</style></head><body><h2>Visit History — ${patient.fullName}</h2><p>Register No: ${((patient as Record<string, unknown>).registerNumber as string) || "—"} | Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Diagnosis</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
    );
    win.document.close();
    win.print();
  }

  function downloadSingleVisitPDF(visit: Visit) {
    if (!patient) return;
    let extData: any = {}; // visit form data has dynamic shape
    try {
      const fd = getVisitFormData(visit.id);
      if (fd) extData = fd;
    } catch {}
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Visit - ${patient.fullName}</title>
      <style>body{font-family:Georgia,serif;padding:20px;font-size:11pt}h2{color:#0f766e}h3{color:#374151;margin-top:12px}hr{border:1px solid #ccc;margin:10px 0}p{margin:4px 0}</style></head>
      <body>
        <h2>Visit Record</h2>
        <p><strong>Patient:</strong> ${patient.fullName}</p>
        <p><strong>Date:</strong> ${formatTime(visit.visitDate)}</p>
        <p><strong>Visit Type:</strong> ${visit.visitType || "—"}</p>
        <p><strong>Diagnosis:</strong> ${extData.diagnosis || visit.diagnosis || "—"}</p>
        <p><strong>Chief Complaint:</strong> ${visit.chiefComplaint || "—"}</p>
        ${extData.pastMedicalHistory ? `<p><strong>Past Medical History:</strong> ${extData.pastMedicalHistory}</p>` : ""}
        ${extData.vitalSigns ? `<h3>Vital Signs</h3><p>BP: ${extData.vitalSigns.bloodPressure || "—"} <strong>mmHg</strong> | Pulse: ${extData.vitalSigns.pulse || "—"} <strong>beats/min</strong> | Temp: ${extData.vitalSigns.temperature || "—"} <strong>°C</strong> | SpO₂: ${extData.vitalSigns.oxygenSaturation || "—"} <strong>%</strong></p>` : ""}
        ${extData.salientFeatures ? `<h3>Clinical Summary</h3><p>${extData.salientFeatures}</p>` : ""}
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  function downloadPrescriptionsPDF() {
    if (!patient) return;
    const rxs = [...prescriptions].sort((a, b) =>
      Number(b.prescriptionDate - a.prescriptionDate),
    );
    const rows = rxs
      .map((rx, i) => {
        const meds = rx.medications
          .map(
            (m) =>
              `${((m as Record<string, unknown>).drugForm as string) || ""} ${((m as Record<string, unknown>).drugName as string) || m.name || ""} ${m.dose || ""} — ${m.frequency || ""} × ${m.duration || ""}`,
          )
          .join("<br/>");
        return `<tr><td>${i + 1}</td><td>${formatTime(rx.prescriptionDate)}</td><td>${rx.diagnosis || "—"}</td><td>${meds || "—"}</td></tr>`;
      })
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Prescriptions - ${patient.fullName}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}th{background:#f0f0f0;font-weight:bold}h2{color:#0f766e}</style></head><body><h2>Prescriptions — ${patient.fullName}</h2><table><thead><tr><th>#</th><th>Date</th><th>Diagnosis</th><th>Medications</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
    );
    win.document.close();
    win.print();
  }

  /** Mark a prescription as viewed by patient — stores viewedByPatientAt in localStorage */
  function markPrescriptionViewed(rxId: bigint) {
    try {
      const key = `rx_viewed_by_patient_${String(rxId)}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, String(Date.now()));
      }
    } catch {
      /* ignore */
    }
  }

  function downloadSinglePrescriptionPDF(rx: Prescription) {
    if (!patient) return;
    // Mark as viewed by patient
    if (currentRole === "patient") {
      markPrescriptionViewed(rx.id);
    }
    const meds = rx.medications
      .map((m, i) => {
        const line1 =
          `${i + 1}. ${((m as Record<string, unknown>).drugForm as string) || ""} ${((m as Record<string, unknown>).drugName as string) || m.name || ""} ${m.dose || ""}`.trim();
        const line2 =
          `   ${m.frequency || ""} – ${m.duration || ""} ${m.instructions ? `– ${m.instructions}` : ""}`.trim();
        return `<p style="margin:2px 0 6px 16px">${line1}<br/><span style="color:#555">${line2}</span></p>`;
      })
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Prescription - ${patient.fullName}</title>
      <style>body{font-family:Georgia,serif;padding:20px;font-size:11pt}h2{color:#0f766e}hr{border:1px solid #ccc;margin:10px 0}</style></head>
      <body>
        <h2>Prescription</h2>
        <p><strong>Patient:</strong> ${patient.fullName}</p>
        <p><strong>Register No:</strong> ${((patient as Record<string, unknown>).registerNumber as string) || "—"}</p>
        <p><strong>Date:</strong> ${formatTime(rx.prescriptionDate)}</p>
        <p><strong>Diagnosis:</strong> ${rx.diagnosis || "—"}</p>
        <hr/>
        <p><strong>℞ Medications:</strong></p>
        ${meds || "<p>No medications</p>"}
        ${rx.notes ? `<hr/><p><strong>Notes/Advice:</strong> ${rx.notes}</p>` : ""}
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  function openRxForm(
    diagnosis?: string,
    forVisitId?: bigint,
    extendedData?: Record<string, unknown>,
    regNum?: string,
  ) {
    setRxInitialDiagnosis(diagnosis);
    setRxForceVisitData(!!forVisitId);
    try {
      if (forVisitId !== undefined) {
        const loaded = getVisitFormData(forVisitId);
        if (loaded) setRxVisitExtendedData(loaded as Record<string, unknown>);
        else if (extendedData) setRxVisitExtendedData(extendedData);
      } else if (extendedData) {
        setRxVisitExtendedData(extendedData);
      }
      if (patientId && !regNum) {
        const regRaw = localStorage.getItem(`patient_register_${patientId}`);
        if (regRaw) setRxPatientRegisterNumber(regRaw);
      } else if (regNum) {
        setRxPatientRegisterNumber(regNum);
      }
    } catch {}
    setShowRxForm(true);
  }

  function closeRxForm() {
    setShowRxForm(false);
    setRxInitialDiagnosis(undefined);
    setRxForceVisitData(false);
    setRxVisitExtendedData(undefined);
    setRxPatientRegisterNumber(undefined);
  }

  // ── Loading / not found states ─────────────────────────────────────────────

  if (loadingPatient) {
    return (
      <div
        className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4"
        data-ocid="patient_dashboard.loading_state"
      >
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="w-60 h-80 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    if (currentRole === "patient") {
      return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 mb-1">
                  Health records not yet linked
                </p>
                <p className="text-sm text-amber-700">
                  Your portal account is active, but your health records are not
                  yet linked. Please contact the clinic with your register
                  number.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div
          className="text-center py-20"
          data-ocid="patient_dashboard.error_state"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground mb-2">Patient not found</p>
          <Button
            variant="outline"
            onClick={() => {
              if (onBack) onBack();
              else window.location.href = "/Patients";
            }}
            className="mt-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  const age = getAge(patient.dateOfBirth);
  const initials = patient.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Determine if this patient is admitted/inpatient
  const isPatientAdmitted =
    patient.isAdmitted === true ||
    (patient as Record<string, unknown>).status === "Admitted" ||
    patient.patientType === "admitted" ||
    patient.patientType === "indoor";

  // Derive current doctor name from localStorage
  const doctorName = (() => {
    try {
      const email = getDoctorEmail();
      const raw = localStorage.getItem(`doctor_profile_${email}`);
      if (raw) {
        const profile = JSON.parse(raw) as Record<string, string>;
        return profile.name || profile.fullName || email;
      }
    } catch {}
    return "Dr. Unknown";
  })();

  // Latest prescription for carry-over
  const sortedPrescriptions = [...prescriptions].sort((a, b) =>
    Number(b.prescriptionDate - a.prescriptionDate),
  );
  const latestPrescription = sortedPrescriptions[0] ?? null;

  // Merge viewedByPatientAt from localStorage into each prescription
  const prescriptionsWithMeta = prescriptions.map((rx) => {
    try {
      const viewedAt = localStorage.getItem(
        `rx_viewed_by_patient_${String(rx.id)}`,
      );
      if (viewedAt) {
        return { ...rx, viewedByPatientAt: Number(viewedAt) };
      }
    } catch {
      /* ignore */
    }
    return rx;
  });

  // For MO / Intern / Nurse: clinical actions are restricted if patient is not admitted
  const clinicalRestricted =
    !rolePermissions.canAccessOutpatient && !isPatientAdmitted;

  return (
    <div
      className="flex min-h-screen bg-gray-50"
      data-ocid="patient_dashboard.page"
    >
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 sticky top-0 h-screen shadow-sm flex-shrink-0">
        <div className="p-5 border-b border-gray-100 flex flex-col items-center text-center gap-3">
          {(patient as Record<string, unknown>).photo ? (
            <img
              src={(patient as Record<string, unknown>).photo as string}
              alt={patient.fullName}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-2xl">
              {initials}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900 text-base">
              {patient.fullName}
            </p>
            {(patient as Record<string, unknown>).registerNumber ? (
              <p className="text-xs text-teal-700 font-mono bg-teal-50 px-2 py-0.5 rounded mt-1">
                {(patient as Record<string, unknown>).registerNumber as string}
              </p>
            ) : null}
            {isPatientAdmitted && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full">
                <BedDouble className="w-3 h-3" />
                Admitted
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2.5 text-sm">
            {patient.gender && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="capitalize">
                  {patient.gender} · {age ? `${age} yrs` : "Age N/A"}
                </span>
              </div>
            )}
            {patient.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>{patient.phone}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{patient.address}</span>
              </div>
            )}
            {patient.bloodGroup && (
              <div className="flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="font-semibold text-red-600">
                  {patient.bloodGroup}
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-gray-100 space-y-2">
          {(currentRole === "doctor" || currentRole === "admin") && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 text-sm"
              onClick={() => setShowEditForm(true)}
              data-ocid="patient_dashboard.edit_button"
            >
              <User className="w-3.5 h-3.5" /> Edit Profile
            </Button>
          )}
          {currentRole === "admin" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 text-sm text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
              data-ocid="patient_dashboard.delete_button"
            >
              Delete Patient
            </Button>
          )}
          {currentRole !== "patient" && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-2 text-sm text-gray-500"
              onClick={() => {
                if (onBack) onBack();
                else window.location.href = "/Patients";
              }}
              data-ocid="patient_dashboard.link"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Patients
            </Button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <nav className="flex items-center gap-1.5 text-sm">
              {currentRole !== "patient" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (onBack) onBack();
                      else window.location.href = "/Patients";
                    }}
                    className="text-gray-500 hover:text-teal-600 font-medium"
                    data-ocid="patient_dashboard.link"
                  >
                    Patients
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </>
              )}
              <span className="text-gray-800 font-semibold">
                {patient.fullName}
              </span>
            </nav>
            <div className="flex items-center gap-2">
              {/* Admit to Hospital button — visible to consultant_doctor, doctor, admin when patient is NOT admitted */}
              {!isPatientAdmitted &&
                (currentRole === "doctor" ||
                  currentRole === "admin" ||
                  viewerRole === "consultant_doctor") && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    onClick={() => setShowAdmitDialog(true)}
                    data-ocid="patient_dashboard.admit_button"
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    Admit to Hospital
                  </Button>
                )}
              {currentRole !== "patient" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden gap-1 text-xs"
                  onClick={() => {
                    if (onBack) onBack();
                    else window.location.href = "/Patients";
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Inner Dashboard with all tabs */}
        <main className="flex-1 p-4 sm:p-6">
          {/* Clinical restriction banner for MO / Intern / Nurse on non-admitted patients */}
          {clinicalRestricted && (
            <div
              className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800"
              data-ocid="patient_dashboard.clinical_restriction_banner"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">
                  This patient has not been admitted. Clinical actions are
                  restricted.
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You can view patient info, vitals, and investigations in
                  read-only mode. To perform clinical actions, the patient must
                  be admitted first.
                </p>
              </div>
            </div>
          )}
          <PatientDashboardInner
            patientId={patientId!}
            patient={patient}
            currentRole={currentRole}
            viewerRole={viewerRole}
            patientAccount={patientAccount}
            sortedVisits={sortedVisits}
            latestVisit={latestVisit}
            latestVitals={latestVitals}
            vitalsHistory={vitalsHistory}
            allInvestigations={allInvestigations}
            invByName={invByName}
            prescriptions={prescriptionsWithMeta as typeof prescriptions}
            loadingVisits={loadingVisits}
            loadingRx={loadingRx}
            setShowVisitForm={(v) => {
              if (!v) return;
              if (clinicalRestricted) {
                toast.warning(
                  "This patient must be admitted before clinical actions can be performed.",
                );
                return;
              }
              if (patientId) openVisitPage(patientId);
            }}
            setSelectedVisit={setSelectedVisit}
            setSelectedRx={setSelectedRx}
            setEditRx={(rx) => {
              if (clinicalRestricted) {
                toast.warning(
                  "Clinical editing is restricted to admitted patients.",
                );
                return;
              }
              setEditRx(rx);
            }}
            setPadPrescription={setPadPrescription}
            setShowPadPreview={setShowPadPreview}
            loadSavedPads={loadSavedPads}
            savedPads={savedPads}
            openRxForm={(...args) => {
              if (clinicalRestricted) {
                toast.warning(
                  "This patient must be admitted before writing a prescription.",
                );
                return;
              }
              openRxForm(...args);
            }}
            downloadVisitHistoryPDF={downloadVisitHistoryPDF}
            downloadSingleVisitPDF={downloadSingleVisitPDF}
            downloadPrescriptionsPDF={downloadPrescriptionsPDF}
            downloadSinglePrescriptionPDF={downloadSinglePrescriptionPDF}
            age={age}
            initials={initials}
            formatDateTime={formatDateTime}
          />
        </main>
      </div>

      {/* ── Edit Patient Dialog ── */}
      {showEditForm && (
        <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
          <DialogContent
            className="max-w-xl max-h-[90vh] overflow-y-auto"
            data-ocid="patient_dashboard.edit.dialog"
          >
            <DialogHeader>
              <DialogTitle>Edit Patient</DialogTitle>
            </DialogHeader>
            <PatientForm
              patient={patient}
              onSubmit={(data) => {
                if (!patientId) return;
                updateMutation.mutate(
                  { id: patientId, ...data },
                  {
                    onSuccess: () => {
                      toast.success("Patient updated");
                      setShowEditForm(false);
                    },
                    onError: () => toast.error("Failed to update patient"),
                  },
                );
              }}
              onCancel={() => setShowEditForm(false)}
              isLoading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirm Dialog ── */}
      {showDeleteConfirm && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent
            className="max-w-sm"
            data-ocid="patient_dashboard.delete.dialog"
          >
            <DialogHeader>
              <DialogTitle>Delete Patient</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong>{patient.fullName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!patientId) return;
                  deleteMutation.mutate(patientId, {
                    onSuccess: () => {
                      toast.success("Patient deleted");
                      setShowDeleteConfirm(false);
                      if (onBack) onBack();
                      else window.location.href = "/Patients";
                    },
                    onError: () => toast.error("Failed to delete patient"),
                  });
                }}
                data-ocid="patient_dashboard.delete.submit_button"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Visit Form: navigates to full-page /Visit route ── */}
      {/* Dialog removed — New Visit now opens /Visit?id=<patientId> */}

      {/* ── Prescription EMR ── rendered directly (NOT inside Dialog) because it uses fixed inset-0 itself */}
      {showRxForm && patientId && (
        <UpgradedPrescriptionEMR
          patientId={patientId}
          patientName={patient?.fullName ?? ""}
          patientAge={age ?? undefined}
          patientGender={patient?.gender ?? ""}
          patientWeight={
            patient?.weight != null ? String(patient.weight) : undefined
          }
          patientHeight={
            patient?.height != null ? Number(patient.height) : undefined
          }
          patientAddress={patient?.address ?? ""}
          patientBloodGroup={patient?.bloodGroup ?? ""}
          initialDiagnosis={rxInitialDiagnosis}
          forceVisitData={rxForceVisitData}
          visitExtendedData={rxVisitExtendedData}
          patientRegisterNumber={
            rxPatientRegisterNumber ||
            ((patient as Record<string, unknown>).registerNumber as string) ||
            ""
          }
          onSubmit={(data) => {
            createRxMutation.mutate(data, {
              onSuccess: () => {
                toast.success("Prescription saved");
                closeRxForm();
              },
              onError: () => toast.error("Failed to save prescription"),
            });
          }}
          onCancel={closeRxForm}
        />
      )}

      {/* ── Edit Rx (full EMR mode) — rendered directly (NOT inside Dialog) */}
      {editRx && patientId && (
        <UpgradedPrescriptionEMR
          patientId={patientId}
          patientName={patient?.fullName ?? ""}
          patientAge={age ?? undefined}
          patientGender={patient?.gender ?? ""}
          patientWeight={
            patient?.weight != null ? String(patient.weight) : undefined
          }
          patientHeight={
            patient?.height != null ? Number(patient.height) : undefined
          }
          patientAddress={patient?.address ?? ""}
          patientBloodGroup={patient?.bloodGroup ?? ""}
          initialDiagnosis={editRx.diagnosis ?? undefined}
          patientRegisterNumber={
            ((patient as Record<string, unknown>).registerNumber as string) ||
            ""
          }
          onSubmit={(data) => {
            createRxMutation.mutate(data, {
              onSuccess: () => {
                toast.success("Prescription updated");
                setEditRx(null);
              },
              onError: () => toast.error("Failed to update prescription"),
            });
          }}
          onCancel={() => setEditRx(null)}
        />
      )}

      {/* ── View Prescription ── */}
      {selectedRx && (
        <Dialog open={!!selectedRx} onOpenChange={() => setSelectedRx(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Prescription — {formatTime(selectedRx.prescriptionDate)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 p-2">
              <p className="text-sm text-gray-600">
                <strong>Diagnosis:</strong> {selectedRx.diagnosis || "—"}
              </p>
              <div>
                <p className="font-semibold text-sm mb-2">Medications</p>
                <div className="space-y-2">
                  {selectedRx.medications.map((m, i) => (
                    <div
                      key={`${m.name}-${i}`}
                      className="bg-gray-50 rounded-lg p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {i + 1}.{" "}
                        {((m as Record<string, unknown>).drugForm as string) ||
                          ""}{" "}
                        {((m as Record<string, unknown>).drugName as string) ||
                          m.name}{" "}
                        {m.dose}
                      </p>
                      <p className="text-gray-600">
                        {m.frequency} – {m.duration}{" "}
                        {m.instructions ? `– ${m.instructions}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {selectedRx.notes && (
                <p className="text-sm">
                  <strong>Notes:</strong> {selectedRx.notes}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => downloadSinglePrescriptionPDF(selectedRx)}
              >
                Download PDF
              </Button>
              <Button variant="outline" onClick={() => setSelectedRx(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Visit Details ── */}
      {selectedVisit && (
        <Dialog
          open={!!selectedVisit}
          onOpenChange={() => setSelectedVisit(null)}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Visit — {formatTime(selectedVisit.visitDate)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 p-2 text-sm">
              <p>
                <strong>Type:</strong> {selectedVisit.visitType}
              </p>
              <p>
                <strong>Chief Complaint:</strong> {selectedVisit.chiefComplaint}
              </p>
              {selectedVisit.diagnosis && (
                <p>
                  <strong>Diagnosis:</strong> {selectedVisit.diagnosis}
                </p>
              )}
              {selectedVisit.notes && (
                <p>
                  <strong>Notes:</strong> {selectedVisit.notes}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  openRxForm(selectedVisit.diagnosis, selectedVisit.id);
                  setSelectedVisit(null);
                }}
              >
                Write Prescription
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadSingleVisitPDF(selectedVisit)}
              >
                Download PDF
              </Button>
              <Button variant="outline" onClick={() => setSelectedVisit(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Prescription Pad Preview ── */}
      {showPadPreview && padPrescription && (
        <Dialog
          open={showPadPreview}
          onOpenChange={(open) => {
            if (!open) {
              setShowPadPreview(false);
              setPadPrescription(null);
            }
          }}
        >
          <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-y-auto p-0 w-full">
            <PrescriptionPadPreview
              prescription={padPrescription}
              patientName={patient?.fullName}
              patientId={patientId ?? undefined}
              sex={patient?.gender}
              onClose={() => {
                setShowPadPreview(false);
                setPadPrescription(null);
                loadSavedPads();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Admit Patient Dialog ── */}
      {showAdmitDialog && patientId && (
        <AdmitPatientDialog
          open={showAdmitDialog}
          onClose={() => setShowAdmitDialog(false)}
          patient={patient}
          patientId={patientId}
          viewerRole={viewerRole}
          doctorName={doctorName}
          latestVisit={latestVisit}
          latestPrescription={latestPrescription}
        />
      )}

      {/* ── Discharge Confirm Dialog ── */}
      {showDischargeConfirm && (
        <Dialog
          open={showDischargeConfirm}
          onOpenChange={setShowDischargeConfirm}
        >
          <DialogContent
            className="max-w-sm"
            data-ocid="patient_dashboard.discharge.dialog"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-700">
                <LogOut className="w-5 h-5" /> Discharge Patient
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to discharge{" "}
              <strong>{patient.fullName}</strong> from hospital? The admission
              record will be marked as discharged.
            </p>
            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDischargeConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => {
                  if (!patientId) return;
                  dischargeMutation.mutate(
                    {
                      patientId,
                      dischargedBy: doctorName,
                      dischargedByRole: viewerRole ?? "consultant_doctor",
                    },
                    {
                      onSuccess: () => {
                        toast.success(
                          `${patient.fullName} has been discharged.`,
                        );
                        setShowDischargeConfirm(false);
                      },
                      onError: () =>
                        toast.error("Failed to discharge patient."),
                    },
                  );
                }}
                disabled={dischargeMutation.isPending}
                data-ocid="patient_dashboard.discharge.confirm_button"
              >
                {dischargeMutation.isPending
                  ? "Discharging..."
                  : "Confirm Discharge"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
