/**
 * WalkInReceiptModal — Modal to view, print, download, and share
 * the investigation receipt generated from the walk-in form.
 * Receipt has a prominent clinic header.
 */
import { Button } from "@/components/ui/button";
import {
  Download,
  MessageCircle,
  Printer,
  Receipt,
  RotateCcw,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { MoneyReceiptData, PaymentMethod, RefundRecord } from "../types";
import {
  InvoiceStateBadge,
  RefundDialog,
  saveReceiptToStore,
  sendReceiptWhatsApp,
} from "./MoneyReceipt";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PM_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
};

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Receipt document (printable) ──────────────────────────────────────────────

function WalkInReceiptDoc({
  receipt,
  printRef,
}: {
  receipt: MoneyReceiptData;
  printRef: React.RefObject<HTMLDivElement>;
}) {
  const items = receipt.investigations ?? [];
  const subtotal = items.reduce((s, r) => s + r.amount, 0);
  const discountAmt = subtotal * ((receipt.discountRate ?? 0) / 100);
  const finalTotal = receipt.finalAmount ?? subtotal - discountAmt;
  const isPartial = receipt.invoiceState === "partial";
  const isRefunded =
    receipt.invoiceState === "refunded" ||
    receipt.invoiceState === "partial_refunded";

  return (
    <div
      ref={printRef}
      className="bg-white rounded-xl overflow-hidden relative"
      style={{
        fontFamily: "serif",
        minWidth: 400,
        border: "2px solid #e5e7eb",
      }}
    >
      {/* Watermark */}
      {receipt.paid && !isRefunded && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <span
            className="font-black select-none"
            style={{
              fontSize: 96,
              transform: "rotate(-35deg)",
              opacity: 0.07,
              color: "#16a34a",
            }}
          >
            PAID
          </span>
        </div>
      )}
      {isRefunded && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <span
            className="font-black select-none"
            style={{
              fontSize: 80,
              transform: "rotate(-35deg)",
              opacity: 0.1,
              color: "#e11d48",
            }}
          >
            REFUNDED
          </span>
        </div>
      )}

      {/* ====== PROMINENT RECEIPT HEADER ====== */}
      <div
        style={{
          background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
          padding: "20px 24px 16px",
        }}
      >
        {/* Clinic branding */}
        <div className="flex items-center gap-3 mb-3">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 22,
              color: "white",
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div>
            <p
              style={{
                color: "white",
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Dr. Arman Kabir’s Care
            </p>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
              Patient Management &amp; Clinical Portal
            </p>
          </div>
        </div>

        {/* Receipt type + number */}
        <div
          style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Investigation Receipt / তদন্ত রসিদ
            </p>
            <p
              style={{
                color: "white",
                fontWeight: 900,
                fontSize: 20,
                fontFamily: "monospace",
                letterSpacing: "0.05em",
              }}
            >
              {receipt.receiptNumber}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Date
            </p>
            <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
              {fmtDate(receipt.investigationDate ?? receipt.date)}
            </p>
          </div>
        </div>
      </div>

      {/* ====== BODY ====== */}
      <div style={{ padding: "20px 24px" }}>
        {/* Patient details */}
        <table
          style={{
            width: "100%",
            fontSize: 13,
            marginBottom: 16,
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  paddingBottom: 6,
                  color: "#6b7280",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  width: "40%",
                }}
              >
                Patient / রোগী
              </td>
              <td
                style={{
                  paddingBottom: 6,
                  color: "#6b7280",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Age / Sex
              </td>
            </tr>
            <tr>
              <td
                style={{
                  fontWeight: 700,
                  color: "#111827",
                  fontSize: 15,
                  paddingBottom: 12,
                }}
              >
                {receipt.patientName}
              </td>
              <td
                style={{
                  fontWeight: 600,
                  color: "#374151",
                  fontSize: 14,
                  paddingBottom: 12,
                }}
              >
                {receipt.patientAge != null ? `${receipt.patientAge} yrs` : "—"}{" "}
                &nbsp;·&nbsp; {receipt.patientSex ?? "—"}
              </td>
            </tr>
            {receipt.investigationDate && (
              <>
                <tr>
                  <td
                    style={{
                      color: "#6b7280",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      paddingBottom: 4,
                    }}
                  >
                    Investigation Date
                  </td>
                  <td
                    style={{
                      color: "#6b7280",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      paddingBottom: 4,
                    }}
                  >
                    Report Delivery Date
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontWeight: 600,
                      color: "#374151",
                      fontSize: 13,
                      paddingBottom: 12,
                    }}
                  >
                    {fmtDate(receipt.investigationDate)}
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: "#7c3aed",
                      fontSize: 13,
                      paddingBottom: 12,
                    }}
                  >
                    {fmtDate(receipt.reportDeliveryDate)}
                  </td>
                </tr>
              </>
            )}
            {receipt.doctorName && (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    paddingBottom: 10,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Referred by: </span>
                  {receipt.doctorName}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "#e5e7eb",
            marginBottom: 14,
          }}
        />

        {/* Investigations table */}
        <table
          style={{
            width: "100%",
            fontSize: 12,
            borderCollapse: "collapse",
            marginBottom: 14,
          }}
        >
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 700,
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Investigation
              </th>
              <th
                style={{
                  textAlign: "center",
                  padding: "8px 6px",
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 700,
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Qty
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 700,
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Rate (৳)
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 700,
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Amount (৳)
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={`${item.name}-${i}`}
                style={{ borderBottom: "1px solid #f3f4f6" }}
              >
                <td style={{ padding: "8px 10px", color: "#1f2937" }}>
                  {item.name}
                </td>
                <td
                  style={{
                    padding: "8px 6px",
                    textAlign: "center",
                    color: "#374151",
                  }}
                >
                  {item.qty}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    color: "#374151",
                  }}
                >
                  {item.unitRate.toLocaleString("en-BD")}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1f2937",
                  }}
                >
                  {item.amount.toLocaleString("en-BD")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div
          style={{
            marginLeft: "auto",
            width: 220,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span style={{ color: "#6b7280" }}>Subtotal / মোট</span>
            <span style={{ fontWeight: 600 }}>
              ৳ {subtotal.toLocaleString("en-BD")}
            </span>
          </div>
          {(receipt.discountRate ?? 0) > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                color: "#059669",
              }}
            >
              <span>Discount ({receipt.discountRate}%)</span>
              <span>− ৳ {discountAmt.toLocaleString("en-BD")}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "2px solid #374151",
              paddingTop: 6,
              fontWeight: 900,
              fontSize: 16,
              color: "#111827",
            }}
          >
            <span>Final Total</span>
            <span>৳ {finalTotal.toLocaleString("en-BD")}</span>
          </div>
          {isPartial && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                  color: "#059669",
                  fontWeight: 600,
                }}
              >
                <span>Paid</span>
                <span>
                  ৳ {(receipt.amountPaid ?? 0).toLocaleString("en-BD")}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                  color: "#d97706",
                  fontWeight: 700,
                }}
              >
                <span>Balance Due</span>
                <span>
                  ৳ {(receipt.dueAmount ?? 0).toLocaleString("en-BD")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Payment status */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          {receipt.paymentMethod && (
            <span
              style={{
                display: "inline-block",
                background: "#f3f4f6",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 12,
                color: "#374151",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              💳 {PM_LABELS[receipt.paymentMethod]}
            </span>
          )}
          <div>
            <InvoiceStateBadge state={receipt.invoiceState} />
          </div>
        </div>

        {/* Refund info */}
        {receipt.refund && (
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              color: "#be123c",
              marginBottom: 14,
            }}
          >
            <p style={{ fontWeight: 700 }}>
              Refund: ৳{receipt.refund.amount.toLocaleString("en-BD")}
            </p>
            <p>Reason: {receipt.refund.reason.replace("_", " ")}</p>
          </div>
        )}

        {/* Signatures */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #d1d5db",
            paddingTop: 16,
            marginTop: 8,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                borderBottom: "1px solid #9ca3af",
                width: 120,
                marginBottom: 4,
              }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af" }}>Patient Signature</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                borderBottom: "1px solid #9ca3af",
                width: 120,
                marginBottom: 4,
              }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af" }}>
              Authorized Signature
            </p>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#9ca3af",
            marginTop: 12,
          }}
        >
          Computer-generated receipt — Dr. Arman Kabir’s Care
        </p>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function WalkInReceiptModal({
  receipt: initialReceipt,
  onClose,
}: {
  receipt: MoneyReceiptData;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState(initialReceipt);
  const printRef = useRef<HTMLDivElement>(null!);
  const [saving, setSaving] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  function handleSave() {
    saveReceiptToStore(receipt);
    toast.success(`Receipt ${receipt.receiptNumber} saved`);
  }

  function handlePrint() {
    handleSave();
    window.print();
  }

  async function handleDownload() {
    if (!printRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `receipt-${receipt.receiptNumber}.png`;
      link.click();
      handleSave();
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Could not generate download. Use Print instead.");
    } finally {
      setSaving(false);
    }
  }

  function handleRefund(refund: RefundRecord) {
    const totalAmount = receipt.finalAmount ?? receipt.amount ?? 0;
    const isFullRefund = refund.amount >= totalAmount;
    const updated: MoneyReceiptData = {
      ...receipt,
      paid: false,
      invoiceState: isFullRefund ? "refunded" : "partial_refunded",
      refund,
    };
    setReceipt(updated);
    saveReceiptToStore(updated);
    setShowRefund(false);
    toast.success(
      `Refund of ৳${refund.amount.toLocaleString("en-BD")} recorded`,
    );
  }

  const totalAmount = receipt.finalAmount ?? receipt.amount ?? 0;
  const isRefunded =
    receipt.invoiceState === "refunded" ||
    receipt.invoiceState === "partial_refunded";

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#walkin-receipt-print-root) { display: none !important; }
          #walkin-receipt-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; }
          .walkin-no-print { display: none !important; }
        }
      `}</style>

      {showRefund && (
        <RefundDialog
          maxAmount={receipt.amountPaid ?? totalAmount}
          onConfirm={handleRefund}
          onCancel={() => setShowRefund(false)}
        />
      )}

      <dialog
        open
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 walkin-no-print border-0 max-w-none w-full h-full m-0"
        aria-label="Investigation Receipt"
      >
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border walkin-no-print">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              Investigation Receipt
              <span className="font-mono text-sm text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                {receipt.receiptNumber}
              </span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              data-ocid="walkin_receipt.close_button"
              aria-label="Close receipt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Paid / Unpaid toggle */}
          <div className="flex gap-2 px-5 pt-3 walkin-no-print">
            <button
              type="button"
              onClick={() =>
                setReceipt((r) => ({ ...r, paid: true, invoiceState: "paid" }))
              }
              className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                receipt.paid && receipt.invoiceState !== "partial"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-card text-muted-foreground border-border"
              }`}
              data-ocid="walkin_receipt.paid_toggle"
            >
              ✓ Paid
            </button>
            <button
              type="button"
              onClick={() =>
                setReceipt((r) => ({
                  ...r,
                  paid: false,
                  invoiceState: "invoice",
                }))
              }
              className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                !receipt.paid && receipt.invoiceState !== "partial"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-card text-muted-foreground border-border"
              }`}
              data-ocid="walkin_receipt.unpaid_toggle"
            >
              ⏳ Unpaid
            </button>
          </div>

          {/* Receipt body */}
          <div className="overflow-y-auto flex-1 p-5">
            <div id="walkin-receipt-print-root">
              <WalkInReceiptDoc receipt={receipt} printRef={printRef} />
            </div>
          </div>

          {/* Actions footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border walkin-no-print">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-ocid="walkin_receipt.cancel_button"
              >
                Close
              </Button>
              {receipt.phone && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => sendReceiptWhatsApp(receipt)}
                  data-ocid="walkin_receipt.whatsapp_button"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
              )}
              {(receipt.paid || receipt.invoiceState === "partial") &&
                !isRefunded && (
                  <Button
                    variant="outline"
                    className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50"
                    onClick={() => setShowRefund(true)}
                    data-ocid="walkin_receipt.refund_button"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Refund
                  </Button>
                )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleDownload}
                disabled={saving}
                data-ocid="walkin_receipt.download_button"
              >
                <Download className="w-4 h-4" />
                {saving ? "Generating…" : "Download"}
              </Button>
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90"
                onClick={handlePrint}
                data-ocid="walkin_receipt.print_button"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
