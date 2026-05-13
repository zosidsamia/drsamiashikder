/**
 * AdmitPatientDialog — Modal for admitting an outpatient to hospital.
 * Shows admission details form + auto-carry checklist from outpatient record.
 */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { BedDouble, Building2, Stethoscope, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { loadRegistry } from "../hooks/useEmailAuth";
import {
  getDoctorEmail,
  getVisitFormData,
  useAdmitPatient,
} from "../hooks/useQueries";
import type { Patient, Prescription, Visit } from "../types";
import type { StaffRole } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  patientId: bigint;
  viewerRole?: StaffRole;
  doctorName: string;
  latestVisit: Visit | null;
  latestPrescription: Prescription | null;
}

function getDoctorSettings() {
  try {
    const email = getDoctorEmail();
    const raw = localStorage.getItem(`doctor_profile_${email}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

export default function AdmitPatientDialog({
  open,
  onClose,
  patient,
  patientId,
  viewerRole,
  doctorName,
  latestVisit,
  latestPrescription,
}: Props) {
  const settings = getDoctorSettings();

  const [hospitalName, setHospitalName] = useState(
    (settings?.hospitalName as string) || "",
  );
  const [ward, setWard] = useState("");
  const [bed, setBed] = useState(
    ((patient as Record<string, unknown>).bedNumber as string) || "",
  );
  const [admittedOn, setAdmittedOn] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [reason, setReason] = useState("");
  const [selectedConsultantEmail, setSelectedConsultantEmail] = useState("");

  // Carry-over checklist
  const [carryComplaints, setCarryComplaints] = useState(true);
  const [carryPMH, setCarryPMH] = useState(true);
  const [carryDrugHistory, setCarryDrugHistory] = useState(true);
  const [carryPrescriptions, setCarryPrescriptions] = useState(true);
  const [carryDiagnosis, setCarryDiagnosis] = useState(true);

  const admitMutation = useAdmitPatient();

  // Load approved consultants from the doctor registry
  const consultants = loadRegistry().filter(
    (d) =>
      d.status === "approved" &&
      (d.role === "consultant_doctor" || d.role === "doctor"),
  );

  // Extract data from latest visit form
  const visitData = latestVisit ? getVisitFormData(latestVisit.id) : null;

  const extractedComplaints: string[] = (() => {
    if (!visitData) return [];
    const cc = visitData.chiefComplaint as string | undefined;
    if (typeof cc === "string" && cc) return [cc];
    if (latestVisit?.chiefComplaint) return [latestVisit.chiefComplaint];
    return [];
  })();

  const extractedDiagnosis: string[] = (() => {
    const d =
      (visitData?.diagnosis as string) ||
      latestVisit?.diagnosis ||
      latestPrescription?.diagnosis ||
      "";
    return d ? [d] : [];
  })();

  const extractedDrugHistory: string[] = (() => {
    if (!visitData) return [];
    const dh = visitData.drugHistory as
      | Array<Record<string, string>>
      | undefined;
    if (Array.isArray(dh)) {
      return dh
        .map((d) => [d.name, d.dose, d.duration].filter(Boolean).join(" "))
        .filter(Boolean);
    }
    return [];
  })();

  const extractedPrescriptionIds: string[] = latestPrescription
    ? [latestPrescription.id.toString()]
    : [];

  // Auto-suggest reason from latest diagnosis
  const suggestedReason =
    extractedDiagnosis[0] ||
    (latestVisit?.chiefComplaint ? `For ${latestVisit.chiefComplaint}` : "");

  const handleAdmit = () => {
    if (!hospitalName.trim()) {
      toast.error("Please enter the hospital name");
      return;
    }
    if (!ward.trim()) {
      toast.error("Please enter the ward / unit");
      return;
    }
    if (!bed.trim()) {
      toast.error("Please enter the bed number");
      return;
    }

    const isIntern = viewerRole === "intern_doctor";
    const selectedConsultant = selectedConsultantEmail
      ? consultants.find((c) => c.email === selectedConsultantEmail)
      : null;

    admitMutation.mutate(
      {
        patientId,
        hospitalName: hospitalName.trim(),
        ward: ward.trim(),
        bed: bed.trim(),
        admittedOn: new Date(admittedOn).toISOString(),
        admittedBy: doctorName,
        admittedByRole: viewerRole ?? "consultant_doctor",
        reasonForAdmission: reason.trim() || suggestedReason,
        carriedOverComplaints: carryComplaints ? extractedComplaints : [],
        carriedOverDiagnosis: carryDiagnosis ? extractedDiagnosis : [],
        carriedOverDrugHistory: carryDrugHistory ? extractedDrugHistory : [],
        carriedOverPrescriptions: carryPrescriptions
          ? extractedPrescriptionIds
          : [],
        isIntern,
        ...(selectedConsultant
          ? {
              consultantAssignment: {
                email: selectedConsultant.email,
                name: selectedConsultant.name,
                assignedAt: new Date().toISOString(),
                assignedBy: getDoctorEmail(),
              },
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(
            isIntern
              ? "Admission created as draft — awaiting approval by Consultant or MO."
              : "Patient admitted successfully. Admission history created.",
          );
          onClose();
        },
        onError: () =>
          toast.error("Failed to admit patient. Please try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="admit_patient.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-800">
            <BedDouble className="w-5 h-5 text-blue-600" />
            Admit Patient — {patient.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Hospital details */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-blue-800 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Hospital Details
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-xs font-medium text-blue-700">
                  Hospital Name *
                </Label>
                <Input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. Dhaka Medical College Hospital"
                  className="mt-1"
                  data-ocid="admit_patient.hospital_input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-blue-700">
                    Ward / Unit *
                  </Label>
                  <Input
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="e.g. General Ward, ICU"
                    className="mt-1"
                    data-ocid="admit_patient.ward_input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-blue-700">
                    Bed Number *
                  </Label>
                  <Input
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    placeholder="e.g. B-12"
                    className="mt-1"
                    data-ocid="admit_patient.bed_input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-blue-700">
                    Admission Date
                  </Label>
                  <input
                    type="date"
                    value={admittedOn}
                    onChange={(e) => setAdmittedOn(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    data-ocid="admit_patient.date_input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-blue-700">
                    Admitting Doctor
                  </Label>
                  <Input
                    value={doctorName}
                    readOnly
                    className="mt-1 bg-gray-50 text-gray-500"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-blue-700">
                  Reason for Admission
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={suggestedReason || "Enter reason for admission"}
                  className="mt-1"
                  data-ocid="admit_patient.reason_input"
                />
              </div>
            </div>
          </div>

          {/* Assigned Consultant */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-purple-800 text-sm flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Assigned Consultant
              <span className="text-xs font-normal text-purple-500 ml-1">
                (optional)
              </span>
            </h4>
            {consultants.length === 0 ? (
              <p className="text-xs text-purple-500 italic">
                No approved Consultant Doctors found in the system.
              </p>
            ) : (
              <select
                value={selectedConsultantEmail}
                onChange={(e) => setSelectedConsultantEmail(e.target.value)}
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                data-ocid="admit_patient.consultant_select"
              >
                <option value="">— Select Consultant (optional) —</option>
                {consultants.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name}
                    {c.designation ? ` — ${c.designation}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Carry-over checklist */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-green-800 text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Auto-carry from Outpatient
              Record
            </h4>
            <p className="text-xs text-green-600">
              Checked items will be imported into the admission history.
            </p>
            <div className="space-y-2.5">
              {[
                {
                  id: "carry-complaints",
                  label: "Chief Complaints",
                  checked: carryComplaints,
                  onChange: setCarryComplaints,
                  detail: extractedComplaints[0] || "—",
                  enabled: extractedComplaints.length > 0,
                },
                {
                  id: "carry-pmh",
                  label: "Past Medical History",
                  checked: carryPMH,
                  onChange: setCarryPMH,
                  detail: "From latest visit",
                  enabled: !!latestVisit,
                },
                {
                  id: "carry-drug-history",
                  label: "Drug History",
                  checked: carryDrugHistory,
                  onChange: setCarryDrugHistory,
                  detail:
                    extractedDrugHistory.length > 0
                      ? `${extractedDrugHistory.length} drug(s) found`
                      : "—",
                  enabled: extractedDrugHistory.length > 0,
                },
                {
                  id: "carry-prescriptions",
                  label: "Previous Prescriptions (latest)",
                  checked: carryPrescriptions,
                  onChange: setCarryPrescriptions,
                  detail: latestPrescription
                    ? latestPrescription.diagnosis || "Latest prescription"
                    : "—",
                  enabled: !!latestPrescription,
                },
                {
                  id: "carry-diagnosis",
                  label: "Diagnosis",
                  checked: carryDiagnosis,
                  onChange: setCarryDiagnosis,
                  detail: extractedDiagnosis[0] || "—",
                  enabled: extractedDiagnosis.length > 0,
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg ${
                    item.enabled
                      ? "bg-white border border-green-100"
                      : "bg-gray-50 border border-gray-100 opacity-60"
                  }`}
                  data-ocid={`admit_patient.carry_over.${item.id}`}
                >
                  <Checkbox
                    id={item.id}
                    checked={item.checked && item.enabled}
                    onCheckedChange={(v) =>
                      item.enabled && item.onChange(v === true)
                    }
                    disabled={!item.enabled}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={item.id}
                    className="flex-1 cursor-pointer select-none"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {item.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {item.detail}
                    </p>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Intern warning */}
          {viewerRole === "intern_doctor" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              ⚠️ As an Intern, this admission will be saved as{" "}
              <strong>Draft – Awaiting Approval</strong> until a Consultant
              Doctor or Medical Officer reviews it.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              onClick={handleAdmit}
              disabled={admitMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
              data-ocid="admit_patient.confirm_button"
            >
              <BedDouble className="w-4 h-4" />
              {admitMutation.isPending ? "Admitting..." : "Admit Patient"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={admitMutation.isPending}
              data-ocid="admit_patient.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
