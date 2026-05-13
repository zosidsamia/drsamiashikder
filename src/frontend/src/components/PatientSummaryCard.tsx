/**
 * PatientSummaryCard — One-page printable summary card for any patient.
 * Header, allergies, diagnoses, medications, investigations, QR code, footer.
 */
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { AlertTriangle, Printer, User } from "lucide-react";
import { useRef, useState } from "react";
import type { Patient, Prescription, Visit } from "../types";

// QR display: show URL in a bordered box with instructions

interface PatientSummaryCardProps {
  patientId: bigint;
  patient: Patient;
  visits: Visit[];
  prescriptions: Prescription[];
  observations?: Record<string, unknown>[];
}

function getAge(dob?: bigint): string {
  if (!dob) return "—";
  const years = Math.floor(
    (Date.now() - Number(dob / 1_000_000n)) / (365.25 * 24 * 3600 * 1000),
  );
  return `${years} yrs`;
}

function getActiveDiagnoses(visits: Visit[]): string[] {
  const diagnoses: string[] = [];
  for (const v of visits) {
    const dx = v.diagnosis;
    if (dx && !diagnoses.includes(dx)) diagnoses.push(dx);
  }
  return diagnoses.slice(0, 8);
}

interface ActiveMedication {
  name: string;
  dose: string;
  frequency: string;
  prescribedOn: string;
}

function getActiveMedications(
  prescriptions: Prescription[],
): ActiveMedication[] {
  const now = Date.now();
  const meds: ActiveMedication[] = [];
  const seen = new Set<string>();

  for (const rx of prescriptions) {
    const rxDate = new Date(Number(rx.prescriptionDate / 1_000_000n));

    // Check validUntil field
    const validUntil = (rx as Record<string, unknown>).validUntil as
      | string
      | undefined;
    if (validUntil && new Date(validUntil).getTime() < now) continue;

    for (const med of rx.medications ?? []) {
      const medName = [med.drugForm ?? med.form, med.drugName ?? med.name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!medName || seen.has(medName)) continue;
      seen.add(medName);
      meds.push({
        name: medName,
        dose: med.dose ?? "",
        frequency: med.frequency ?? "",
        prescribedOn: format(rxDate, "dd MMM yyyy"),
      });
    }
  }
  return meds.slice(0, 10);
}

interface InvResult {
  name: string;
  result: string;
  unit?: string;
  date: string;
  flagged?: boolean;
}

function getRecentInvestigations(visits: Visit[]): InvResult[] {
  const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const rows: InvResult[] = [];

  for (const v of visits) {
    const extData = (() => {
      try {
        const key = `visit_form_data_${v.id}`;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(key)) {
            const raw = localStorage.getItem(k);
            if (raw) return JSON.parse(raw) as Record<string, unknown>;
          }
        }
      } catch {}
      return null;
    })();

    if (!extData) continue;

    const invRows = extData.previous_investigation_rows as
      | Array<{ name: string; result: string; unit?: string; date?: string }>
      | undefined;
    if (!invRows) continue;

    for (const row of invRows) {
      if (!row.date) continue;
      const rowDate = new Date(row.date).getTime();
      if (rowDate < threeMonthsAgo) continue;
      rows.push({
        name: row.name,
        result: row.result,
        unit: row.unit,
        date: row.date,
        flagged:
          (extData.flaggedInvestigations as string[])?.includes(row.name) ??
          false,
      });
    }
  }

  return rows.slice(0, 12);
}

function QRFallback({ url }: { url: string }) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center w-32">
      <p className="text-[9px] text-gray-500 mb-1 font-semibold">PROFILE URL</p>
      <p className="text-[8px] text-gray-400 break-all font-mono">{url}</p>
      <p className="text-[8px] text-gray-400 mt-1">Scan QR or visit URL</p>
    </div>
  );
}

export default function PatientSummaryCard({
  patientId,
  patient,
  visits,
  prescriptions,
}: PatientSummaryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showCard, setShowCard] = useState(false);

  const activeDiagnoses = getActiveDiagnoses(visits);
  const activeMeds = getActiveMedications(prescriptions);
  const recentInv = getRecentInvestigations(visits);
  const profileUrl = `${window.location.origin}/patient/${patientId}/dashboard`;
  const today = format(new Date(), "dd MMMM yyyy");

  const handlePrint = () => {
    setShowCard(true);
    setTimeout(() => window.print(), 300);
  };

  const emergencyContact = (patient as Record<string, unknown>)
    .emergencyContactName as string | undefined;
  const emergencyPhone = (patient as Record<string, unknown>)
    .emergencyContactPhone as string | undefined;

  return (
    <>
      {/* Print trigger button — only shown in non-print view */}
      <div className="no-print">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
          onClick={handlePrint}
          data-ocid="patient_summary_card.print_button"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Summary Card
        </Button>
      </div>

      {/* The actual card — visible in print, conditionally in screen */}
      <div
        ref={cardRef}
        className={`patient-summary-card-print ${showCard ? "block" : "hidden"} print:!block`}
      >
        {/* ── Card Content ── */}
        <div className="summary-card bg-white p-6 border border-gray-300 rounded-xl max-w-[800px] mx-auto text-sm font-sans">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-teal-600 pb-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-teal-100 border-2 border-teal-300 flex items-center justify-center shrink-0">
                {patient.photo ? (
                  <img
                    src={patient.photo}
                    alt="Patient"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <User className="w-7 h-7 text-teal-600" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {patient.fullName}
                </h1>
                {patient.nameBn && (
                  <p className="text-base text-gray-600">{patient.nameBn}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {patient.registerNumber && (
                    <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-0.5 rounded-full border border-teal-200">
                      Reg: {patient.registerNumber}
                    </span>
                  )}
                  <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full border border-gray-200">
                    {getAge(patient.dateOfBirth)}
                  </span>
                  <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full border border-gray-200 capitalize">
                    {patient.gender}
                  </span>
                  {patient.bloodGroup && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                      {patient.bloodGroup}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500 shrink-0 ml-4">
              <p className="font-bold text-gray-700 text-sm">
                Dr. Arman Kabir's Care
              </p>
              <p>Patient Summary Card</p>
              <p>{today}</p>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {/* Emergency Contact */}
              {(emergencyContact || emergencyPhone) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-orange-700 mb-1.5 uppercase tracking-wide">
                    🆘 Emergency Contact
                  </p>
                  {emergencyContact && (
                    <p className="text-sm font-semibold text-orange-800">
                      {emergencyContact}
                    </p>
                  )}
                  {emergencyPhone && (
                    <p className="text-sm font-mono text-orange-700">
                      {emergencyPhone}
                    </p>
                  )}
                </div>
              )}

              {/* Active Allergies */}
              <div className="border-2 border-red-300 rounded-lg p-3 bg-red-50">
                <p className="text-xs font-bold text-red-700 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Active Allergies
                </p>
                {patient.allergies.length > 0 ? (
                  <ul className="space-y-0.5">
                    {patient.allergies.map((a) => (
                      <li key={a} className="text-sm text-red-800 font-medium">
                        • {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-700 font-medium">
                    ✓ No known allergies
                  </p>
                )}
              </div>

              {/* Active Diagnoses */}
              <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                <p className="text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">
                  📋 Active Diagnoses
                </p>
                {activeDiagnoses.length > 0 ? (
                  <ul className="space-y-0.5">
                    {activeDiagnoses.map((d, i) => (
                      <li
                        key={`dx-${String(i)}`}
                        className="text-sm text-amber-800"
                      >
                        • {d}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">No diagnoses recorded</p>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Current Medications */}
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                <p className="text-xs font-bold text-blue-700 mb-1.5 uppercase tracking-wide">
                  💊 Current Medications
                </p>
                {activeMeds.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-blue-600 border-b border-blue-200">
                        <th className="text-left pb-1 font-semibold">Drug</th>
                        <th className="text-left pb-1 font-semibold">Dose</th>
                        <th className="text-left pb-1 font-semibold">Freq.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMeds.map((m, i) => (
                        <tr
                          key={`med-${String(i)}`}
                          className="border-b border-blue-100"
                        >
                          <td className="py-0.5 text-blue-900 font-medium">
                            {m.name}
                          </td>
                          <td className="py-0.5 text-blue-700">{m.dose}</td>
                          <td className="py-0.5 text-blue-700">
                            {m.frequency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">No active medications</p>
                )}
              </div>

              {/* Key Investigation Results */}
              {recentInv.length > 0 && (
                <div className="border border-teal-200 rounded-lg p-3 bg-teal-50">
                  <p className="text-xs font-bold text-teal-700 mb-1.5 uppercase tracking-wide">
                    🧪 Key Results (Last 3 Months)
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-teal-600 border-b border-teal-200">
                        <th className="text-left pb-1 font-semibold">Test</th>
                        <th className="text-left pb-1 font-semibold">Result</th>
                        <th className="text-left pb-1 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInv.map((r, i) => (
                        <tr
                          key={`inv-${String(i)}`}
                          className="border-b border-teal-100"
                        >
                          <td className="py-0.5 text-teal-800">{r.name}</td>
                          <td
                            className={`py-0.5 font-mono font-medium ${r.flagged ? "text-red-600" : "text-teal-700"}`}
                          >
                            {r.result} {r.unit || ""}
                            {r.flagged && " ⚠️"}
                          </td>
                          <td className="py-0.5 text-teal-500">{r.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer with QR */}
          <div className="mt-4 pt-3 border-t border-gray-200 flex items-end justify-between">
            <div className="text-xs text-gray-400">
              <p>Generated by Dr. Arman Kabir's Care • {today}</p>
              <p className="mt-0.5">
                For medical emergencies, contact clinic: +8801751959262
              </p>
            </div>
            <div className="shrink-0">
              <QRFallback url={profileUrl} />
            </div>
          </div>
        </div>

        {/* Close card button (screen only) */}
        <div className="no-print mt-3 text-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCard(false)}
            data-ocid="patient_summary_card.close_button"
          >
            Close Preview
          </Button>
        </div>
      </div>

      {/* Print-specific CSS injected via style tag */}
      <style>{`
        @media print {
          body > *:not(.patient-summary-card-print) {
            display: none !important;
          }
          .patient-summary-card-print {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          .summary-card {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
        }
      `}</style>
    </>
  );
}
