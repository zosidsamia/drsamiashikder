/**
 * InvestigationPayment — Billing component for investigation payments.
 * v2: Invoice step, payment method, INV- sequential receipt numbers,
 *     partial payment, refund action, consistent with MoneyReceipt patterns.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  CreditCard,
  FileDown,
  FileText,
  MessageCircle,
  Receipt,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  InvestigationLineItem,
  InvestigationRate,
  MoneyReceiptData,
  PaymentMethod,
  RefundRecord,
} from "../types";
import {
  DownloadOptionsDialog,
  InvoiceStateBadge,
  PartialPaymentFields,
  PaymentMethodSelector,
  RefundDialog,
  generateTypedReceiptNumber,
  loadReceipts,
  saveReceiptToStore,
  sendReceiptWhatsApp,
  triggerReceiptPrint,
} from "./MoneyReceipt";

// ── Storage helpers ──────────────────────────────────────────────────────────

const RATES_KEY = "investigation_rates";

export function loadInvestigationRates(): InvestigationRate[] {
  try {
    return JSON.parse(localStorage.getItem(RATES_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

interface InvestigationPaymentProps {
  patientId: string;
  patientName: string;
  registerNumber?: string;
  phone?: string;
  doctorName?: string;
  /** Age in years — used on the investigation receipt */
  patientAge?: number;
  /** Biological sex — used on the investigation receipt */
  patientSex?: "Male" | "Female" | "Other";
}

// ── Receipt Doc (printable) ───────────────────────────────────────────────────

function InvestigationReceiptDoc({
  receipt,
  printRef,
}: {
  receipt: MoneyReceiptData;
  printRef: React.RefObject<HTMLDivElement>;
}) {
  const formattedDate = new Date(receipt.date).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const items = receipt.investigations ?? [];
  const subtotal = items.reduce((s, r) => s + r.amount, 0);
  const discountAmt = subtotal * ((receipt.discountRate ?? 0) / 100);
  const finalTotal = receipt.finalAmount ?? subtotal - discountAmt;
  const isPartial = receipt.invoiceState === "partial";
  const isRefunded =
    receipt.invoiceState === "refunded" ||
    receipt.invoiceState === "partial_refunded";

  const PM_LABELS: Record<PaymentMethod, string> = {
    cash: "Cash",
    bkash: "bKash",
    nagad: "Nagad",
    card: "Card",
  };

  return (
    <div
      id="receipt-printable-inv"
      ref={printRef}
      className="bg-white border-2 border-gray-200 rounded-xl p-8 relative overflow-hidden"
      style={{ fontFamily: "serif", minWidth: 420 }}
    >
      {receipt.paid && !isRefunded && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span
            className="text-emerald-200 font-black select-none"
            style={{
              fontSize: 100,
              transform: "rotate(-35deg)",
              opacity: 0.18,
            }}
          >
            PAID
          </span>
        </div>
      )}
      {isRefunded && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span
            className="text-rose-300 font-black select-none"
            style={{ fontSize: 80, transform: "rotate(-35deg)", opacity: 0.22 }}
          >
            REFUNDED
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center text-white font-black text-lg">
            A
          </div>
          <div>
            <h1 className="font-black text-xl text-gray-900 tracking-tight">
              Dr. Arman Kabir&apos;s Care
            </h1>
            <p className="text-xs text-gray-600">
              Patient Management &amp; Clinical Portal
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          University Dental College &amp; Hospital, Moghbazar, Dhaka
        </p>
      </div>

      <div className="text-center mb-5">
        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-widest">
          Investigation Receipt
        </h2>
        <p className="text-sm text-gray-500">তদন্ত রসিদ</p>
      </div>

      {/* Meta */}
      <div className="flex justify-between items-start mb-5 text-xs text-gray-600">
        <div>
          <span className="font-semibold">Receipt No: </span>
          <span className="font-mono text-gray-800">
            {receipt.receiptNumber}
          </span>
        </div>
        <div className="text-right">
          <span className="font-semibold">Date: </span>
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Patient info */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Patient / রোগী</p>
          <p className="font-semibold text-gray-800">{receipt.patientName}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Register No.</p>
          <p className="font-semibold font-mono text-gray-800">
            {receipt.registerNumber || "—"}
          </p>
        </div>
        {(receipt.patientAge != null || receipt.patientSex) && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Age / Sex</p>
            <p className="font-semibold text-gray-800">
              {receipt.patientAge != null ? `${receipt.patientAge} yrs` : ""}
              {receipt.patientAge != null && receipt.patientSex ? " · " : ""}
              {receipt.patientSex ?? ""}
            </p>
          </div>
        )}
        {receipt.investigationDate && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Investigation Date</p>
            <p className="font-semibold text-gray-800">
              {new Date(receipt.investigationDate).toLocaleDateString("en-BD", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        )}
        {receipt.reportDeliveryDate && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Report Delivery</p>
            <p className="font-semibold text-purple-700">
              {new Date(receipt.reportDeliveryDate).toLocaleDateString(
                "en-BD",
                {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                },
              )}
            </p>
          </div>
        )}
        {receipt.doctorName && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Doctor / ডাক্তার</p>
            <p className="font-semibold text-gray-800">{receipt.doctorName}</p>
          </div>
        )}
        {receipt.paymentMethod && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Payment Method</p>
            <p className="font-semibold text-gray-800">
              {PM_LABELS[receipt.paymentMethod]}
            </p>
          </div>
        )}
      </div>

      {/* Investigation table */}
      <table className="w-full text-sm mb-4 border border-gray-300 rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold border-b border-gray-300">
              Investigation
            </th>
            <th className="text-center px-2 py-2 text-xs text-gray-600 font-semibold border-b border-gray-300">
              Qty
            </th>
            <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold border-b border-gray-300">
              Rate (৳)
            </th>
            <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold border-b border-gray-300">
              Amount (৳)
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={`${item.name}-${i}`}
              className="border-b border-gray-200 last:border-0"
            >
              <td className="px-3 py-2 text-gray-800">{item.name}</td>
              <td className="px-2 py-2 text-center text-gray-700">
                {item.qty}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {item.unitRate.toLocaleString("en-BD")}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-gray-800">
                {item.amount.toLocaleString("en-BD")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="ml-auto w-60 space-y-1.5 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal / মোট</span>
          <span className="font-semibold">
            ৳ {subtotal.toLocaleString("en-BD")}
          </span>
        </div>
        {(receipt.discountRate ?? 0) > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount ({receipt.discountRate}%)</span>
            <span>− ৳ {discountAmt.toLocaleString("en-BD")}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-400 pt-1.5 font-bold text-base text-gray-900">
          <span>Final Total</span>
          <span>৳ {finalTotal.toLocaleString("en-BD")}</span>
        </div>
        {isPartial && (
          <>
            <div className="flex justify-between text-emerald-700">
              <span>Paid</span>
              <span>৳ {(receipt.amountPaid ?? 0).toLocaleString("en-BD")}</span>
            </div>
            <div className="flex justify-between text-amber-700 font-bold">
              <span>Balance Due</span>
              <span>৳ {(receipt.dueAmount ?? 0).toLocaleString("en-BD")}</span>
            </div>
          </>
        )}
      </div>

      {/* Status */}
      <div className="text-center mb-5">
        <InvoiceStateBadge state={receipt.invoiceState} />
      </div>

      {/* Refund info */}
      {receipt.refund && (
        <div className="bg-rose-50 border border-rose-200 rounded p-2 mb-4 text-xs text-rose-700">
          <p className="font-semibold">
            Refund: ৳{receipt.refund.amount.toLocaleString("en-BD")}
          </p>
          <p>Reason: {receipt.refund.reason.replace("_", " ")}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-300">
        <div className="text-center">
          <div className="border-b border-gray-500 w-32 mb-1" />
          <p className="text-xs text-gray-500">Patient Signature</p>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-500 w-32 mb-1" />
          <p className="text-xs text-gray-500">Authorized Signature</p>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-4">
        Computer-generated receipt — Dr. Arman Kabir&apos;s Care
      </p>
    </div>
  );
}

// ── Receipt modal ─────────────────────────────────────────────────────────────

function ReceiptModal({
  receipt: initialReceipt,
  onClose,
}: {
  receipt: MoneyReceiptData;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState(initialReceipt);
  const printRef = useRef<HTMLDivElement>(null!);
  const [showRefund, setShowRefund] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  function handlePrint(paperSize: "A4" | "A5" | "A3" = "A4") {
    const old = document.getElementById("_inv_ps");
    if (old) old.remove();
    const s = document.createElement("style");
    s.id = "_inv_ps";
    s.textContent = `@media print{@page{size:${paperSize};margin:10mm}body *{visibility:hidden!important}#receipt-printable-inv,#receipt-printable-inv *{visibility:visible!important}#receipt-printable-inv{position:fixed;left:0;top:0;width:100%}.no-print{display:none!important}}`;
    document.head.appendChild(s);
    window.print();
    setTimeout(() => {
      document.getElementById("_inv_ps")?.remove();
    }, 2000);
  }

  function handleDownload(withHeader: boolean, paperSize: "A4" | "A5" | "A3") {
    const headerHtml = `<div style="background:linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%);padding:20px 24px 16px;margin-bottom:0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:white;flex-shrink:0">A</div>
        <div>
          <div style="color:white;font-weight:900;font-size:18px;letter-spacing:-0.02em;line-height:1.2">Dr. Arman Kabir's Care</div>
          <div style="color:rgba(255,255,255,0.75);font-size:11px">Patient Management &amp; Clinical Portal</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Investigation Receipt</div>
          <div style="color:white;font-weight:900;font-size:18px;font-family:monospace">${receipt.receiptNumber}</div>
        </div>
        <div style="text-align:right">
          <div style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Date</div>
          <div style="color:white;font-weight:700;font-size:13px">${new Date(receipt.date).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
      </div>
    </div>`;
    const bodyHtml = printRef.current ? printRef.current.innerHTML : "";
    triggerReceiptPrint({
      bodyHtml,
      headerHtml,
      withHeader,
      paperSize,
      filename: `receipt-${receipt.receiptNumber}`,
    });
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
          body > *:not(#inv-receipt-print-root) { display: none !important; }
          #inv-receipt-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; }
          .inv-receipt-no-print { display: none !important; }
        }
      `}</style>

      {showRefund && (
        <RefundDialog
          maxAmount={receipt.amountPaid ?? totalAmount}
          onConfirm={handleRefund}
          onCancel={() => setShowRefund(false)}
        />
      )}

      {showDownloadOptions && (
        <DownloadOptionsDialog
          receiptNumber={receipt.receiptNumber}
          onClose={() => setShowDownloadOptions(false)}
          onDownload={(withHeader, paperSize) => {
            setShowDownloadOptions(false);
            handleDownload(withHeader, paperSize);
          }}
        />
      )}

      <dialog
        open
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 inv-receipt-no-print border-0 max-w-none w-full h-full m-0"
        aria-label="Investigation Receipt"
      >
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border inv-receipt-no-print">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              Investigation Receipt
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              data-ocid="inv_receipt.close_button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div className="flex gap-2 inv-receipt-no-print">
              <button
                type="button"
                onClick={() =>
                  setReceipt((r) => ({
                    ...r,
                    paid: true,
                    invoiceState: "paid",
                  }))
                }
                className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                  receipt.paid && receipt.invoiceState !== "partial"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-card text-muted-foreground border-border"
                }`}
                data-ocid="inv_receipt.paid_toggle"
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
                data-ocid="inv_receipt.unpaid_toggle"
              >
                ⏳ Unpaid
              </button>
            </div>
            <div id="inv-receipt-print-root">
              <InvestigationReceiptDoc receipt={receipt} printRef={printRef} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border inv-receipt-no-print">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={onClose}
                data-ocid="inv_receipt.cancel_button"
              >
                Close
              </Button>
              {receipt.phone && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => sendReceiptWhatsApp(receipt)}
                  data-ocid="inv_receipt.whatsapp_button"
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
                    data-ocid="inv_receipt.refund_button"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Refund
                  </Button>
                )}
            </div>
            <div className="flex gap-2 no-print">
              <Button
                variant="outline"
                className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => handlePrint()}
                data-ocid="inv_receipt.print_button"
              >
                <Receipt className="w-4 h-4" /> Print
              </Button>
              <Button
                className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => setShowDownloadOptions(true)}
                data-ocid="inv_receipt.download_button"
              >
                <FileDown className="w-4 h-4" /> Download
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

// ── New Payment view ──────────────────────────────────────────────────────────

function NewPaymentView({
  patientId,
  patientName,
  registerNumber,
  phone,
  doctorName,
  patientAge,
  patientSex,
  onReceiptGenerated,
}: InvestigationPaymentProps & {
  onReceiptGenerated: (r: MoneyReceiptData) => void;
}) {
  const rates = loadInvestigationRates();
  const [selected, setSelected] = useState<
    Record<string, { checked: boolean; qty: number }>
  >(() =>
    Object.fromEntries(rates.map((r) => [r.id, { checked: false, qty: 1 }])),
  );
  const [discountRate, setDiscountRate] = useState(0);
  const [finalOverride, setFinalOverride] = useState<string>("");
  const [isPartial, setIsPartial] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    undefined,
  );
  const [invoiceStep, setInvoiceStep] = useState<"form" | "invoice" | "paid">(
    "form",
  );
  const [csvRates, setCsvRates] = useState<{ name: string; rate: number }[]>(
    [],
  );
  useEffect(() => {
    fetch("/assets/investigation-rates.csv")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        const parsed = text
          .trim()
          .split(/\r?\n/)
          .slice(1)
          .map((line) => {
            const i = line.lastIndexOf(",");
            return {
              name: line.slice(0, i).replace(/^"|"$/g, "").trim(),
              rate: Number.parseFloat(line.slice(i + 1)) || 0,
            };
          })
          .filter((r) => r.name && r.rate > 0);
        setCsvRates(parsed);
      })
      .catch(() => {});
  }, []);

  // Merge CSV rates with localStorage rates (localStorage takes precedence)
  const localNames = new Set(rates.map((r) => r.name?.toLowerCase()));
  const mergedRates = [
    ...rates,
    ...csvRates
      .filter((r) => !localNames.has(r.name.toLowerCase()))
      .map((r) => ({
        id: `csv_${r.name}`,
        name: r.name,
        rate: r.rate,
        category: "Imported",
      })),
  ];

  const checkedRates = mergedRates.filter((r) => selected[r.id]?.checked);
  const subtotal = checkedRates.reduce(
    (sum, r) => sum + r.rate * (selected[r.id]?.qty ?? 1),
    0,
  );
  const autoFinal = Math.round(subtotal * (1 - discountRate / 100));
  const finalAmount = finalOverride !== "" ? Number(finalOverride) : autoFinal;
  const effectiveDiscount =
    finalOverride !== "" && subtotal > 0
      ? Math.round((1 - Number(finalOverride) / subtotal) * 10000) / 100
      : discountRate;

  function handleDiscountChange(val: string) {
    const n = Math.min(100, Math.max(0, Number(val) || 0));
    setDiscountRate(n);
    setFinalOverride("");
  }

  function handleFinalChange(val: string) {
    setFinalOverride(val);
    const num = Number(val);
    if (subtotal > 0 && !Number.isNaN(num)) {
      const d = Math.round((1 - num / subtotal) * 10000) / 100;
      setDiscountRate(Math.max(0, Math.min(100, d)));
    }
  }

  function handleToggle(id: string) {
    setSelected((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        checked: !prev[id]?.checked,
        qty: prev[id]?.qty ?? 1,
      },
    }));
  }

  function handleQty(id: string, qty: number) {
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], qty } }));
  }

  function handleGenerateInvoice() {
    if (checkedRates.length === 0) {
      toast.error("Select at least one investigation");
      return;
    }
    setInvoiceStep("invoice");
  }

  function handleMarkPaid() {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    const investigations: InvestigationLineItem[] = checkedRates.map((r) => {
      const qty = selected[r.id]?.qty ?? 1;
      return { name: r.name, qty, unitRate: r.rate, amount: r.rate * qty };
    });

    const paid = !isPartial;
    const paidAmount = isPartial ? amountPaid : finalAmount;
    const dueAmount = isPartial ? finalAmount - amountPaid : 0;

    const receipt: MoneyReceiptData = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      receiptNumber: generateTypedReceiptNumber("INV"),
      type: "investigation",
      patientName,
      registerNumber,
      phone,
      doctorName,
      patientAge,
      patientSex,
      service: investigations.map((i) => i.name).join(", "),
      amount: finalAmount,
      finalAmount,
      discountRate: effectiveDiscount,
      paid,
      amountPaid: paidAmount,
      dueAmount,
      invoiceState: isPartial ? "partial" : "paid",
      paymentMethod,
      date: new Date().toISOString(),
      investigationDate: new Date().toISOString().slice(0, 10),
      investigations,
      patientId,
    };

    saveReceiptToStore(receipt);
    toast.success(`Receipt ${receipt.receiptNumber} generated`);
    onReceiptGenerated(receipt);
  }

  if (rates.length === 0 && csvRates.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center"
        data-ocid="inv_payment.no_rates.empty_state"
      >
        <FileText className="w-10 h-10 opacity-30" />
        <p className="font-semibold">No investigation rates configured</p>
        <p className="text-sm">
          Ask the admin to upload investigation rates in Settings →
          Investigation Rates.
        </p>
      </div>
    );
  }

  // ── Invoice preview step ──
  if (invoiceStep === "invoice") {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-blue-900 flex items-center gap-2">
              📄 Invoice Preview
              <span className="text-xs font-normal text-blue-600">
                — Review before marking as paid
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setInvoiceStep("form")}
              className="text-blue-600 text-xs hover:underline"
            >
              ← Edit
            </button>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              <strong>Patient:</strong> {patientName}{" "}
              {registerNumber && (
                <span className="font-mono">({registerNumber})</span>
              )}
            </p>
            {doctorName && (
              <p>
                <strong>Doctor:</strong> {doctorName}
              </p>
            )}
          </div>
          <table className="w-full text-sm mt-3 border border-blue-200 rounded overflow-hidden">
            <thead>
              <tr className="bg-blue-100 text-blue-700">
                <th className="text-left px-3 py-2 font-semibold">
                  Investigation
                </th>
                <th className="text-center px-2 py-2 font-semibold">Qty</th>
                <th className="text-right px-3 py-2 font-semibold">Rate</th>
                <th className="text-right px-3 py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {checkedRates.map((r) => {
                const qty = selected[r.id]?.qty ?? 1;
                return (
                  <tr key={r.id} className="border-t border-blue-100">
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-2 py-2 text-center">{qty}</td>
                    <td className="px-3 py-2 text-right">
                      ৳{r.rate.toLocaleString("en-BD")}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      ৳{(r.rate * qty).toLocaleString("en-BD")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="ml-auto w-52 mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>৳{subtotal.toLocaleString("en-BD")}</span>
            </div>
            {effectiveDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount ({effectiveDiscount.toFixed(1)}%)</span>
                <span>
                  −৳{(subtotal - finalAmount).toLocaleString("en-BD")}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-blue-300 pt-1 font-bold text-blue-900 text-base">
              <span>Total Due</span>
              <span>৳{finalAmount.toLocaleString("en-BD")}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            ocidPrefix="inv_payment"
          />
          <PartialPaymentFields
            total={finalAmount}
            amountPaid={amountPaid}
            onAmountPaidChange={setAmountPaid}
            isPartial={isPartial}
            onIsPartialChange={setIsPartial}
            ocidPrefix="inv_payment"
          />
        </div>

        <Button
          className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleMarkPaid}
          data-ocid="inv_payment.mark_paid.button"
        >
          <CheckCircle2 className="w-4 h-4" />
          Mark as Paid — Generate Receipt
        </Button>
      </div>
    );
  }

  // ── Form step ──
  return (
    <div className="space-y-4">
      {/* Investigation checklist */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Select Investigations
          </p>
          <p className="text-xs text-muted-foreground">
            {checkedRates.length} selected
          </p>
        </div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {mergedRates.map((rate, idx) => {
            const s = selected[rate.id] ?? { checked: false, qty: 1 };
            const lineAmt = s.checked ? rate.rate * (s.qty || 1) : null;
            return (
              <div
                key={rate.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${s.checked ? "bg-purple-50" : "hover:bg-muted/20"}`}
                data-ocid={`inv_payment.item.${idx + 1}`}
              >
                <Checkbox
                  id={`inv-${rate.id}`}
                  checked={s.checked}
                  onCheckedChange={() => handleToggle(rate.id)}
                  data-ocid={`inv_payment.checkbox.${idx + 1}`}
                />
                <label
                  htmlFor={`inv-${rate.id}`}
                  className="flex-1 text-sm font-medium text-foreground cursor-pointer select-none"
                >
                  {rate.name}
                </label>
                {s.checked && (
                  <Input
                    type="number"
                    min={1}
                    value={s.qty}
                    onChange={(e) =>
                      handleQty(
                        rate.id,
                        Math.max(1, Number(e.target.value) || 1),
                      )
                    }
                    className="w-16 h-7 text-xs text-center"
                    aria-label="Quantity"
                  />
                )}
                <span
                  className={`text-sm font-semibold tabular-nums ${s.checked ? "text-purple-700" : "text-muted-foreground"}`}
                >
                  ৳{" "}
                  {s.checked && lineAmt != null
                    ? lineAmt.toLocaleString("en-BD")
                    : rate.rate.toLocaleString("en-BD")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals & discount */}
      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">
            ৳ {subtotal.toLocaleString("en-BD")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Label
            htmlFor="discount-rate"
            className="text-sm whitespace-nowrap shrink-0"
          >
            Discount Rate (%)
          </Label>
          <Input
            id="discount-rate"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={discountRate === 0 ? "" : discountRate}
            placeholder="0"
            onChange={(e) => handleDiscountChange(e.target.value)}
            className="w-24 h-8 text-sm"
            data-ocid="inv_payment.discount_rate.input"
          />
          {discountRate > 0 && subtotal > 0 && (
            <span className="text-xs text-emerald-700 font-semibold">
              − ৳{" "}
              {Math.round(subtotal * (discountRate / 100)).toLocaleString(
                "en-BD",
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Label
            htmlFor="final-rate"
            className="text-sm whitespace-nowrap shrink-0"
          >
            Final Rate (৳)
          </Label>
          <Input
            id="final-rate"
            type="number"
            min={0}
            value={finalOverride !== "" ? finalOverride : autoFinal || ""}
            placeholder="0"
            onChange={(e) => handleFinalChange(e.target.value)}
            className="w-32 h-8 text-sm font-bold text-purple-700"
            data-ocid="inv_payment.final_rate.input"
          />
          {finalOverride !== "" && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFinalOverride("");
              }}
              title="Reset to auto-calculated"
            >
              ↺ Reset
            </button>
          )}
        </div>
        <div className="bg-card border-2 border-purple-300 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-0.5 uppercase font-semibold tracking-wide">
            Final Total / মোট
          </p>
          <p className="text-3xl font-black text-purple-700 tabular-nums">
            ৳{" "}
            {(checkedRates.length > 0 ? finalAmount : 0).toLocaleString(
              "en-BD",
            )}
          </p>
          {effectiveDiscount > 0 && (
            <p className="text-xs text-emerald-600 mt-1">
              {effectiveDiscount.toFixed(1)}% discount applied
            </p>
          )}
        </div>
      </div>

      <Button
        className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
        disabled={checkedRates.length === 0}
        onClick={handleGenerateInvoice}
        data-ocid="inv_payment.generate_invoice.button"
      >
        <Receipt className="w-4 h-4" />
        Generate Invoice →
      </Button>
    </div>
  );
}

// ── Payment History view ──────────────────────────────────────────────────────

function PaymentHistoryView({ patientId }: { patientId: string }) {
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<MoneyReceiptData | null>(null);

  const receipts = loadReceipts().filter(
    (r) =>
      r.type === "investigation" &&
      (r.patientId === patientId || r.registerNumber),
  );

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.service.toLowerCase().includes(q) ||
      r.receiptNumber.toLowerCase().includes(q) ||
      r.date.includes(q)
    );
  });

  if (receipts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center"
        data-ocid="inv_payment.history.empty_state"
      >
        <CreditCard className="w-10 h-10 opacity-30" />
        <p className="font-semibold">No investigation payments yet</p>
        <p className="text-sm">Generated receipts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by investigation or date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
          data-ocid="inv_payment.history.search_input"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                Receipt #
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden sm:table-cell">
                Date
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                Investigations
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                Total
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden sm:table-cell">
                Status
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                data-ocid={`inv_payment.history.item.${idx + 1}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-purple-700 font-semibold">
                    {r.receiptNumber}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                  {new Date(r.date).toLocaleDateString("en-BD", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-xs text-foreground max-w-[160px]">
                  <span className="line-clamp-2">{r.service}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  ৳ {(r.finalAmount ?? r.amount).toLocaleString("en-BD")}
                  {(r.dueAmount ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 font-medium">
                      Due: ৳{r.dueAmount?.toLocaleString("en-BD")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {r.invoiceState === "refunded" ||
                  r.invoiceState === "partial_refunded" ? (
                    <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">
                      Refunded
                    </Badge>
                  ) : r.invoiceState === "partial" ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                      Partial
                    </Badge>
                  ) : r.paid ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      Paid
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                      Unpaid
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1 text-purple-700 border-purple-200 hover:bg-purple-50"
                    onClick={() => setViewing(r)}
                    data-ocid={`inv_payment.history.view_button.${idx + 1}`}
                  >
                    <FileText className="w-3 h-3" />
                    View
                  </Button>
                  {r.phone && (
                    <button
                      type="button"
                      onClick={() => sendReceiptWhatsApp(r)}
                      className="h-7 w-7 flex items-center justify-center rounded border border-green-200 hover:bg-green-50 transition-colors"
                      title="Send via WhatsApp"
                      data-ocid={`inv_payment.history.whatsapp_button.${idx + 1}`}
                      style={{ color: "#25D366" }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && (
        <ReceiptModal receipt={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestigationPayment({
  patientId,
  patientName,
  registerNumber,
  phone,
  doctorName,
  patientAge,
  patientSex,
}: InvestigationPaymentProps) {
  const [view, setView] = useState<"new" | "history">("new");
  const [previewReceipt, setPreviewReceipt] = useState<MoneyReceiptData | null>(
    null,
  );

  return (
    <div className="space-y-4" data-ocid="inv_payment.panel">
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border border-border">
        <button
          type="button"
          onClick={() => setView("new")}
          className={`flex-1 h-8 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            view === "new"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="inv_payment.new_payment.tab"
        >
          <Receipt className="w-3.5 h-3.5" />
          New Payment
        </button>
        <button
          type="button"
          onClick={() => setView("history")}
          className={`flex-1 h-8 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            view === "history"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="inv_payment.history.tab"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Payment History
        </button>
      </div>

      {view === "new" && (
        <NewPaymentView
          patientId={patientId}
          patientName={patientName}
          registerNumber={registerNumber}
          phone={phone}
          doctorName={doctorName}
          patientAge={patientAge}
          patientSex={patientSex}
          onReceiptGenerated={(r) => {
            setPreviewReceipt(r);
          }}
        />
      )}

      {view === "history" && <PaymentHistoryView patientId={patientId} />}

      {previewReceipt && (
        <ReceiptModal
          receipt={previewReceipt}
          onClose={() => setPreviewReceipt(null)}
        />
      )}
    </div>
  );
}
