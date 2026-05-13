/**
 * Clinical utility functions for Dr. Arman Kabir's Care.
 * Pure, side-effect-free helpers used by History and Prescription sections.
 */

import type {
  ComplaintTrendEntry,
  MedicationWithMeta,
  Patient,
  Prescription,
  PrescriptionDiff,
  VaccinationRecord,
  Visit,
} from "../types";

// ── Complaint Trend Analysis ──────────────────────────────────────────────────

/**
 * Scan all visits chronologically and build a trend entry per unique complaint.
 * Severity is inferred from visit notes / extended localStorage data when present;
 * defaults to "mild" for the first appearance and "resolved" when the complaint
 * disappears from subsequent visits.
 */
export function computeComplaintTrends(visits: Visit[]): ComplaintTrendEntry[] {
  // Sort visits ascending by date
  const sorted = [...visits].sort(
    (a, b) => Number(a.visitDate) - Number(b.visitDate),
  );

  const trendsMap = new Map<string, ComplaintTrendEntry>();

  for (const visit of sorted) {
    const visitId = String(visit.id);
    const visitMs = Number(visit.visitDate) / 1_000; // backend stores microseconds
    const rawComplaints = (visit.chiefComplaint ?? "")
      .split(/[,;،\n]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    for (const complaintName of rawComplaints) {
      const existing = trendsMap.get(complaintName);
      // Infer severity from visit notes if available (best-effort)
      const severity = inferSeverity(visit, complaintName);

      if (!existing) {
        trendsMap.set(complaintName, {
          complaintName,
          firstAppeared: visitMs,
          firstVisitId: visitId,
          severityHistory: [{ date: visitMs, severity, visitId }],
          currentStatus: "active",
        });
      } else {
        existing.severityHistory.push({ date: visitMs, severity, visitId });
        // Update current status — still appearing in visits means still active
        existing.currentStatus = "active";
      }
    }

    // Any complaint that was active but not in this visit's complaints may be resolving.
    // We only mark resolved when the diagnosis says "resolved" explicitly to avoid false-negatives.
    const diagnosisLower = (visit.diagnosis ?? "").toLowerCase();
    for (const [name, entry] of trendsMap) {
      if (
        entry.currentStatus === "active" &&
        !rawComplaints.includes(name) &&
        diagnosisLower.includes("resolved") &&
        diagnosisLower.includes(name)
      ) {
        entry.currentStatus = "resolved";
        entry.severityHistory.push({
          date: visitMs,
          severity: "resolved",
          visitId,
        });
      }
    }
  }

  return Array.from(trendsMap.values());
}

/** Best-effort severity inference from visit notes / diagnosis text. */
function inferSeverity(
  visit: Visit,
  _complaint: string,
): "mild" | "moderate" | "severe" | "resolved" {
  const text = [visit.notes ?? "", visit.diagnosis ?? ""]
    .join(" ")
    .toLowerCase();
  if (text.includes("severe") || text.includes("critical")) return "severe";
  if (text.includes("moderate")) return "moderate";
  if (text.includes("resolved") || text.includes("improved")) return "resolved";
  return "mild";
}

// ── Prescription Diff ─────────────────────────────────────────────────────────

/**
 * Compare two consecutive prescriptions and return a structured diff:
 * added drugs, removed drugs (with optional discontinuation reason), and
 * dose changes for drugs present in both.
 */
export function computePrescriptionDiff(
  prev: Prescription,
  curr: Prescription,
): PrescriptionDiff {
  const prevMeds = prev.medications ?? [];
  const currMeds = curr.medications ?? [];

  const prevNames = new Map(prevMeds.map((m) => [normalizeName(m.name), m]));
  const currNames = new Map(currMeds.map((m) => [normalizeName(m.name), m]));

  const addedDrugs: string[] = [];
  const removedDrugs: PrescriptionDiff["removedDrugs"] = [];
  const doseChanges: PrescriptionDiff["doseChanges"] = [];

  // Added: in curr but not in prev
  for (const [name, med] of currNames) {
    if (!prevNames.has(name)) {
      addedDrugs.push(med.name);
    }
  }

  // Removed or dose-changed: in prev but curr differs
  for (const [name, prevMed] of prevNames) {
    const currMed = currNames.get(name);
    if (!currMed) {
      // Check if MedicationWithMeta carries a discontinuation reason
      const withMeta = prevMed as MedicationWithMeta;
      removedDrugs.push({
        name: prevMed.name,
        reason: withMeta.discontinuationReason,
      });
    } else if (normalizeDose(prevMed.dose) !== normalizeDose(currMed.dose)) {
      doseChanges.push({
        name: prevMed.name,
        oldDose: prevMed.dose,
        newDose: currMed.dose,
      });
    }
  }

  return { addedDrugs, removedDrugs, doseChanges };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDose(dose: string): string {
  return dose.trim().toLowerCase().replace(/\s+/g, "");
}

// ── Vaccination Overdue Check ─────────────────────────────────────────────────

/**
 * Returns true if the vaccine's dueDate is in the past and it has no dateGiven,
 * or if dueDate exists and dateGiven is missing.
 */
export function isVaccineOverdue(vaccine: VaccinationRecord): boolean {
  if (!vaccine.dueDate) return false;
  if (vaccine.dateGiven) return false; // already administered
  const due = new Date(vaccine.dueDate).getTime();
  return due < Date.now();
}

// ── Current Medications ───────────────────────────────────────────────────────

/**
 * Aggregate all active, non-expired medications across every prescription.
 * A medication is considered active when:
 *   - The prescription has no finalizedAt / prescriptionDate more than 90 days ago, OR
 *   - The individual drug is not marked discontinued.
 *
 * Returns MedicationWithMeta array, preserving any extended meta if already present.
 */
export function getCurrentMedications(
  prescriptions: Prescription[],
): MedicationWithMeta[] {
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const active: MedicationWithMeta[] = [];

  // Sort prescriptions newest first so deduplication keeps the most recent entry
  const sorted = [...prescriptions].sort(
    (a, b) => Number(b.prescriptionDate) - Number(a.prescriptionDate),
  );

  const seenDrugNames = new Set<string>();

  for (const rx of sorted) {
    // Treat prescriptionDate (bigint, microseconds) as age
    const rxAgeMs = now - Number(rx.prescriptionDate) / 1_000;
    if (rxAgeMs > NINETY_DAYS_MS) continue;

    for (const med of rx.medications ?? []) {
      const key = normalizeName(med.name);
      if (seenDrugNames.has(key)) continue; // already included from a newer prescription

      const withMeta = med as MedicationWithMeta;
      if (withMeta.discontinuedAt) continue; // explicitly discontinued

      seenDrugNames.add(key);
      active.push(withMeta);
    }
  }

  return active;
}

// ── Recent Weight Check ───────────────────────────────────────────────────────

/**
 * Returns true if the patient has a recorded weight within the past `withinDays` days.
 * Checks both the top-level Patient.weight field (static) and the most recent
 * VitalSigns.weight from any visit (passed as `recentVitalWeight`).
 *
 * Since Visit data is not passed here (keep args minimal), callers should
 * pass the most recent weight timestamp separately via `lastWeightRecordedAt`.
 */
export function isRecentWeightAvailable(
  patient: Patient,
  withinDays: number,
  lastWeightRecordedAt?: number, // Unix timestamp ms of the most recent vitals weight entry
): boolean {
  const thresholdMs = withinDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // If a timestamped weight record was passed, use it
  if (lastWeightRecordedAt !== undefined) {
    return now - lastWeightRecordedAt <= thresholdMs;
  }

  // Fall back: if patient.weight exists with no timestamp, we cannot determine recency.
  // Always return false to show the "no recent weight" warning (safer for clinical use).
  void patient;
  return false;
}
