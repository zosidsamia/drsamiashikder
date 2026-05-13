/**
 * WhatsApp template message utilities for Dr. Arman Kabir's Care.
 *
 * All functions return a wa.me URL with a pre-filled message.
 * Phone numbers are normalised to international format (880 prefix).
 */

// ── Phone normalisation ────────────────────────────────────────────────────────

/**
 * Normalise a Bangladeshi phone number to international format without "+".
 * Examples:
 *   01751959262  → 8801751959262
 *   +8801751959262 → 8801751959262
 *   8801751959262 → 8801751959262
 */
export function normalisePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  if (digits.length === 10) return `880${digits}`;
  return digits;
}

/** Build a wa.me URL. Phone is normalised internally. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const num = normalisePhone(phone);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// ── Template builders ──────────────────────────────────────────────────────────

export interface PatientInfo {
  fullName: string;
  phone?: string;
}

export function buildReportReadyMessage(
  patient: PatientInfo,
  doctorName: string,
  clinicName: string,
  reportName: string,
): string {
  const phone =
    (patient as any).phone ||
    (patient as any).mobile ||
    (patient as any).contact ||
    "";
  const msg = `Hello ${patient.fullName}, your ${reportName} report is ready at ${clinicName}. Please contact us to collect or view your report. Dr. ${doctorName}, ${clinicName}.`;
  return buildWhatsAppUrl(phone, msg);
}

export function buildFollowUpMessage(
  patient: PatientInfo,
  doctorName: string,
  clinicName: string,
  appointmentDate: string,
  appointmentTime: string,
): string {
  const phone =
    (patient as any).phone ||
    (patient as any).mobile ||
    (patient as any).contact ||
    "";
  const msg = `Hello ${patient.fullName}, please attend your follow-up appointment on ${appointmentDate} at ${appointmentTime}. Location: ${clinicName}. Dr. ${doctorName}. For queries, please call us.`;
  return buildWhatsAppUrl(phone, msg);
}
