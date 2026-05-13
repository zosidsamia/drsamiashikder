/**
 * Shared helpers for prescription rendering:
 * - Auto-number advice items (computed, not stored)
 * - Doctor signature management (upload / read from localStorage)
 * - Prescription header rendering helper
 */
import {
  getDoctorEmail,
  getPrescriptionHeaderImage,
} from "../hooks/useQueries";
import type { PrescriptionHeaderType } from "../types";
import { getPrescriptionHeaderText } from "./PrescriptionHeaderPanel";

// ── Advice numbering ─────────────────────────────────────────────────────────

/**
 * Converts raw advice text into a numbered list.
 * Each non-empty line gets a serial number.
 * Lines that already start with a number (1., 2.) are re-numbered to ensure
 * consistent sequence.
 */
export function numberAdviceLines(raw: string): string {
  if (!raw.trim()) return raw;
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines
    .map((line, i) => {
      // Strip any existing leading number like "1. " or "১. "
      const stripped = line.replace(/^[\d।]+\.\s*/, "").trim();
      return `${i + 1}. ${stripped}`;
    })
    .join("\n");
}

// ── Doctor Signature ──────────────────────────────────────────────────────────

const SIG_KEY_PREFIX = "doctorSignature_";

export function getDoctorSignature(doctorEmail?: string): string | null {
  const email = doctorEmail ?? getDoctorEmail();
  return localStorage.getItem(`${SIG_KEY_PREFIX}${email}`);
}

export function setDoctorSignature(
  dataUrl: string,
  doctorEmail?: string,
): void {
  const email = doctorEmail ?? getDoctorEmail();
  localStorage.setItem(`${SIG_KEY_PREFIX}${email}`, dataUrl);
}

export function clearDoctorSignature(doctorEmail?: string): void {
  const email = doctorEmail ?? getDoctorEmail();
  localStorage.removeItem(`${SIG_KEY_PREFIX}${email}`);
}

// ── Header renderer (returns HTML string for print windows) ──────────────────

export function getPrescriptionHeaderHtml(
  type: PrescriptionHeaderType,
  fallbackDoctorInfo: Record<string, string> | null,
): string {
  const img = getPrescriptionHeaderImage(type);
  if (img) {
    return `<div style="border-bottom:1px solid #d1d5db;padding-bottom:8px;margin-bottom:12px;text-align:center;">
      <img src="${img}" style="max-width:100%;max-height:100px;object-fit:contain;" alt="Header" />
    </div>`;
  }

  const textData = getPrescriptionHeaderText(type);
  if (textData) {
    if (type === "hospital") {
      return `<div style="border-bottom:1px solid #d1d5db;padding-bottom:8px;margin-bottom:12px;text-align:center;">
        <h2 style="font-weight:700;font-size:1.1rem;margin:0;">${textData.hospitalName}</h2>
        ${textData.tagline ? `<p style="font-size:0.875rem;color:#4b5563;margin:2px 0;">${textData.tagline}</p>` : ""}
      </div>`;
    }
    return `<div style="border-bottom:1px solid #d1d5db;padding-bottom:8px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 style="font-weight:700;font-size:1rem;margin:0;">${textData.doctorName}</h2>
          ${textData.degrees ? `<p style="font-size:0.875rem;color:#4b5563;margin:2px 0;">${textData.degrees}</p>` : ""}
          ${textData.chamberAddress ? `<p style="font-size:0.875rem;color:#4b5563;margin:2px 0;">${textData.chamberAddress}</p>` : ""}
        </div>
        ${textData.phone ? `<div style="text-align:right;font-size:0.875rem;color:#4b5563;">Mob: ${textData.phone}</div>` : ""}
      </div>
    </div>`;
  }

  // Fallback: use doctor info from session
  if (fallbackDoctorInfo) {
    if (type === "hospital") {
      return `<div style="border-bottom:1px solid #d1d5db;padding-bottom:8px;margin-bottom:12px;text-align:center;">
        <h2 style="font-weight:700;font-size:1.1rem;margin:0;">${fallbackDoctorInfo.hospitalName ?? "Dr. Sirajul Islam Medical College Hospital"}</h2>
        <p style="font-size:0.875rem;color:#4b5563;margin:2px 0;">Dept. of General Surgery</p>
      </div>`;
    }
    return `<div style="border-bottom:1px solid #d1d5db;padding-bottom:8px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 style="font-weight:700;font-size:1rem;margin:0;">${fallbackDoctorInfo.name ?? "Dr. Arman Kabir (ZOSID)"}</h2>
          <p style="font-size:0.875rem;color:#4b5563;margin:2px 0;">${fallbackDoctorInfo.degrees ?? "MBBS (D.U.) | Emergency Medical Officer"}</p>
          <p style="font-size:0.875rem;color:#4b5563;margin:2px 0;">${fallbackDoctorInfo.chamber ?? "সেন্চুরি আর্কেড মার্কেট, মগবাজার, ঢাকা"}</p>
        </div>
        <div style="text-align:right;font-size:0.875rem;color:#4b5563;">
          <p>Reg. no. A-105224</p>
          <p>Mob: 01751959262</p>
        </div>
      </div>
    </div>`;
  }

  // Hard fallback
  return `<div style="border-bottom:1px solid #d1d5db;padding-bottom:8px;margin-bottom:12px;">
    <h2 style="font-weight:700;font-size:1rem;margin:0;">Dr. Arman Kabir (ZOSID)</h2>
    <p style="font-size:0.875rem;color:#4b5563;">MBBS (D.U.) | Emergency Medical Officer</p>
  </div>`;
}

// ── Signature HTML for print ──────────────────────────────────────────────────

export function getSignatureHtml(
  doctorName: string,
  signatureDataUrl: string | null,
): string {
  const imgPart = signatureDataUrl
    ? `<img src="${signatureDataUrl}" style="height:48px;object-fit:contain;display:block;margin:0 auto 4px;" alt="Signature" />`
    : "";
  return `<div style="margin-top:2rem;text-align:right;">
    <div style="display:inline-block;text-align:center;min-width:140px;">
      ${imgPart}
      <div style="border-top:1px solid #555;padding-top:4px;">
        <p style="font-size:0.75rem;font-weight:600;color:#374151;margin:0;">Doctor's Signature</p>
        <p style="font-size:0.75rem;color:#6b7280;margin:0;">${doctorName}</p>
      </div>
    </div>
  </div>`;
}
