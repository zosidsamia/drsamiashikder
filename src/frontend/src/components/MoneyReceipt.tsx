/**
 * MoneyReceipt — Reusable printable/downloadable money receipt component.
 * Print: window.print() with CSS @media print
 * PDF: html2canvas → canvas.toDataURL() → download as image
 *
 * v2 additions:
 * - Payment method field (Cash / bKash / Nagad / Card)
 * - Invoice step (enter charges → invoice → mark paid → receipt)
 * - Partial payment with Balance Due display
 * - Refund action on paid receipts
 * - Per-type sequential receipt numbers (APT / INV / PRO / OTH)
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  MessageCircle,
  Printer,
  RotateCcw,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type {
  InvoiceState,
  MoneyReceiptData,
  PaymentMethod,
  RefundRecord,
} from "../types";

// ── Storage helpers ───────────────────────────────────────────────────────────

const RECEIPTS_KEY = "clinic_receipts";

export function loadReceipts(): MoneyReceiptData[] {
  try {
    return JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveReceiptToStore(receipt: MoneyReceiptData) {
  const all = loadReceipts();
  const exists = all.findIndex((r) => r.id === receipt.id);
  if (exists >= 0) {
    all[exists] = receipt;
  } else {
    all.unshift(receipt);
  }
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(all));
}

// ── Per-type sequential receipt number generators ─────────────────────────────

type ReceiptPrefix = "APT" | "INV" | "PRO" | "OTH" | "REC";

function getCounterKey(prefix: ReceiptPrefix): string {
  return `receipt_counter_${prefix.toLowerCase()}`;
}

function getYearKey(prefix: ReceiptPrefix): string {
  return `receipt_year_${prefix.toLowerCase()}`;
}

export function generateTypedReceiptNumber(prefix: ReceiptPrefix): string {
  const year = new Date().getFullYear();
  const yearKey = getYearKey(prefix);
  const counterKey = getCounterKey(prefix);

  const storedYear = Number.parseInt(localStorage.getItem(yearKey) || "0", 10);
  let count = 1;
  if (storedYear === year) {
    count = Number.parseInt(localStorage.getItem(counterKey) || "0", 10) + 1;
  }

  localStorage.setItem(yearKey, String(year));
  localStorage.setItem(counterKey, String(count));
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

/** Legacy fallback — generates REC-YYYY-NNNN using master receipts store */
export function generateReceiptNumber(): string {
  return generateTypedReceiptNumber("REC");
}

// ── WhatsApp helper ────────────────────────────────────────────────────────────
// ── Print-based PDF download helper ──────────────────────────────────────────

export interface DownloadReceiptOptions {
  /** HTML string of the receipt body (without header) */
  bodyHtml: string;
  /** Full clinic header HTML — included when withHeader=true */
  headerHtml: string;
  withHeader: boolean;
  paperSize: "A4" | "A5" | "A3";
  filename: string;
}

/**
 * Opens a hidden iframe, injects the receipt HTML, and calls print().
 * The browser's "Save as PDF" destination handles the actual PDF creation.
 * This avoids html2canvas entirely and produces a properly scaled receipt.
 */
export function triggerReceiptPrint(opts: DownloadReceiptOptions) {
  const { bodyHtml, headerHtml, withHeader, paperSize, filename } = opts;
  const content = withHeader ? headerHtml + bodyHtml : bodyHtml;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>
    @page { size: ${paperSize}; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: serif; background: white; }
    table { border-collapse: collapse; }
  </style></head><body>${content}</body></html>`;

  // Use a hidden iframe so the rest of the app is not affected
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  // Wait for images/fonts to load then print
  iframe.contentWindow?.addEventListener("load", () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 3000);
    }
  });
  // Fallback if load already fired
  setTimeout(() => {
    if (iframe.contentWindow && document.body.contains(iframe)) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {}
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 3000);
    }
  }, 600);
}

// ── Shared Download Options Dialog ───────────────────────────────────────────

interface DownloadOptionsDialogProps {
  receiptNumber: string;
  onDownload: (withHeader: boolean, paperSize: "A4" | "A5" | "A3") => void;
  onClose: () => void;
}

export function DownloadOptionsDialog({
  receiptNumber,
  onDownload,
  onClose,
}: DownloadOptionsDialogProps) {
  const [withHeader, setWithHeader] = useState(true);
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "A3">("A4");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      data-ocid="download_options.dialog"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <FileDown className="w-4 h-4 text-teal-600" />
              Download Receipt
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {receiptNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            data-ocid="download_options.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header option */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Receipt Header
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWithHeader(true)}
              className={`h-20 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                withHeader
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-border bg-background text-muted-foreground hover:border-teal-300"
              }`}
              data-ocid="download_options.with_header.toggle"
            >
              <span className="text-xl">🏥</span>
              <span>With Header</span>
              <span className="text-[10px] font-normal opacity-70">
                Clinic branding
              </span>
            </button>
            <button
              type="button"
              onClick={() => setWithHeader(false)}
              className={`h-20 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                !withHeader
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-border bg-background text-muted-foreground hover:border-teal-300"
              }`}
              data-ocid="download_options.without_header.toggle"
            >
              <span className="text-xl">📄</span>
              <span>Without Header</span>
              <span className="text-[10px] font-normal opacity-70">
                Body only
              </span>
            </button>
          </div>
        </div>

        {/* Paper size */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paper Size
          </p>
          <div className="flex gap-2">
            {(["A4", "A5", "A3"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setPaperSize(sz)}
                className={`flex-1 h-9 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  paperSize === sz
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-background text-muted-foreground border-border hover:border-teal-400"
                }`}
                data-ocid={`download_options.paper_${sz.toLowerCase()}.toggle`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
            data-ocid="download_options.cancel_button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDownload(withHeader, paperSize)}
            className="flex-2 flex-grow h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            data-ocid="download_options.confirm_button"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function sendReceiptWhatsApp(r: {
  patientName?: string;
  phone?: string;
  receiptNumber?: string;
  date?: string;
  finalAmount?: number;
  amount?: number;
  amountPaid?: number;
  dueAmount?: number;
}) {
  if (!r.phone) return;
  const phone = r.phone.replace(/\D/g, "");
  const e164 = phone.startsWith("0") ? `880${phone.slice(1)}` : phone;
  const total = r.finalAmount ?? r.amount ?? 0;
  const paid = r.amountPaid ?? total;
  const due = r.dueAmount ?? 0;
  const msg = [
    `Hello ${r.patientName ?? "Patient"},`,
    `Your receipt from Dr. Arman Kabir's Clinic:`,
    `Receipt No: ${r.receiptNumber ?? "N/A"}`,
    `Date: ${r.date ? new Date(r.date).toLocaleDateString("en-BD") : "N/A"}`,
    `Amount: ৳${total.toLocaleString("en-BD")}`,
    `Paid: ৳${paid.toLocaleString("en-BD")}`,
    ...(due > 0 ? [`Balance Due: ৳${due.toLocaleString("en-BD")}`] : []),
    "For queries call: +8801751959262",
  ].join("\n");
  window.open(
    `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );
}

// ── Payment method label map ───────────────────────────────────────────────

const PM_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
};

// ── Status badge helper ───────────────────────────────────────────────────────

export function InvoiceStateBadge({ state }: { state?: InvoiceState }) {
  if (!state || state === "paid")
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 font-bold text-sm px-4 py-1 rounded-full border border-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5" />
        PAID / পরিশোধিত
      </span>
    );
  if (state === "invoice")
    return (
      <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 font-bold text-sm px-4 py-1 rounded-full border border-blue-300">
        📄 INVOICE / চালান
      </span>
    );
  if (state === "partial")
    return (
      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 font-bold text-sm px-4 py-1 rounded-full border border-amber-300">
        ⏳ PARTIAL / আংশিক
      </span>
    );
  if (state === "refunded")
    return (
      <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-700 font-bold text-sm px-4 py-1 rounded-full border border-rose-300">
        ↩ REFUNDED / ফেরত
      </span>
    );
  if (state === "partial_refunded")
    return (
      <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 font-bold text-sm px-4 py-1 rounded-full border border-orange-300">
        ↩ PARTIAL REFUND
      </span>
    );
  return null;
}

// ── Refund Dialog ─────────────────────────────────────────────────────────────

interface RefundDialogProps {
  maxAmount: number;
  onConfirm: (refund: RefundRecord) => void;
  onCancel: () => void;
}

export function RefundDialog({
  maxAmount,
  onConfirm,
  onCancel,
}: RefundDialogProps) {
  const [amount, setAmount] = useState(maxAmount);
  const [reason, setReason] = useState<RefundRecord["reason"]>("cancellation");

  function handleConfirm() {
    if (amount <= 0 || amount > maxAmount) {
      toast.error(`Refund amount must be between ৳1 and ৳${maxAmount}`);
      return;
    }
    onConfirm({
      refundId: `ref-${Date.now()}`,
      amount,
      reason,
      date: new Date().toISOString(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      data-ocid="refund.dialog"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            Process Refund
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            data-ocid="refund.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Maximum refundable:{" "}
          <strong>৳{maxAmount.toLocaleString("en-BD")}</strong>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Refund Amount (৳)</Label>
          <Input
            type="number"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="text-lg font-bold"
            data-ocid="refund.amount_input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Reason</Label>
          <Select
            value={reason}
            onValueChange={(v) => setReason(v as RefundRecord["reason"])}
          >
            <SelectTrigger data-ocid="refund.reason_select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wrong_charge">Wrong charge</SelectItem>
              <SelectItem value="cancellation">Cancellation</SelectItem>
              <SelectItem value="duplicate_payment">
                Duplicate payment
              </SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button
            variant="outline"
            onClick={onCancel}
            data-ocid="refund.cancel_button"
          >
            Cancel
          </Button>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            onClick={handleConfirm}
            data-ocid="refund.confirm_button"
          >
            <RotateCcw className="w-4 h-4" />
            Confirm Refund
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Method Selector (reusable) ────────────────────────────────────────

interface PaymentMethodSelectorProps {
  value: PaymentMethod | undefined;
  onChange: (v: PaymentMethod) => void;
  ocidPrefix?: string;
}

export function PaymentMethodSelector({
  value,
  onChange,
  ocidPrefix = "receipt",
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">
        Payment Method * / পেমেন্ট পদ্ধতি
      </Label>
      <Select
        value={value ?? ""}
        onValueChange={(v) => onChange(v as PaymentMethod)}
      >
        <SelectTrigger
          className="h-9"
          data-ocid={`${ocidPrefix}.payment_method.select`}
        >
          <SelectValue placeholder="Select method…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">💵 Cash</SelectItem>
          <SelectItem value="bkash">📱 bKash</SelectItem>
          <SelectItem value="nagad">📱 Nagad</SelectItem>
          <SelectItem value="card">💳 Card</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Partial Payment fields (reusable) ─────────────────────────────────────────

interface PartialPaymentFieldsProps {
  total: number;
  amountPaid: number;
  onAmountPaidChange: (n: number) => void;
  isPartial: boolean;
  onIsPartialChange: (v: boolean) => void;
  ocidPrefix?: string;
}

export function PartialPaymentFields({
  total,
  amountPaid,
  onAmountPaidChange,
  isPartial,
  onIsPartialChange,
  ocidPrefix = "receipt",
}: PartialPaymentFieldsProps) {
  const due = Math.max(0, total - amountPaid);
  return (
    <div className="space-y-3 bg-muted/30 rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onIsPartialChange(false)}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors ${
            !isPartial
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-card text-muted-foreground border-border"
          }`}
          data-ocid={`${ocidPrefix}.full_payment.toggle`}
        >
          ✓ Full Payment
        </button>
        <button
          type="button"
          onClick={() => onIsPartialChange(true)}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors ${
            isPartial
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-card text-muted-foreground border-border"
          }`}
          data-ocid={`${ocidPrefix}.partial_payment.toggle`}
        >
          ⏳ Partial Payment
        </button>
      </div>
      {isPartial && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Amount Paid (৳)</Label>
            <Input
              type="number"
              min={0}
              max={total}
              value={amountPaid || ""}
              onChange={(e) =>
                onAmountPaidChange(
                  Math.min(total, Math.max(0, Number(e.target.value))),
                )
              }
              className="font-bold"
              data-ocid={`${ocidPrefix}.amount_paid.input`}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Balance Due (৳)</Label>
            <div className="h-9 flex items-center px-3 rounded-md border border-amber-300 bg-amber-50 font-bold text-amber-700 tabular-nums">
              ৳{due.toLocaleString("en-BD")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Receipt Dialog ────────────────────────────────────────────────────────────

interface MoneyReceiptProps {
  initialData: Omit<MoneyReceiptData, "id" | "receiptNumber"> & {
    id?: string;
    receiptNumber?: string;
  };
  onClose: () => void;
}

export default function MoneyReceipt({
  initialData,
  onClose,
}: MoneyReceiptProps) {
  const [data, setData] = useState<MoneyReceiptData>(() => {
    const id =
      initialData.id ||
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    const receiptNumber =
      initialData.receiptNumber || generateTypedReceiptNumber("REC");
    return {
      ...initialData,
      id,
      receiptNumber,
      invoiceState: initialData.invoiceState ?? "paid",
    };
  });
  const printRef = useRef<HTMLDivElement>(null);
  const [showRefund, setShowRefund] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [isPartial, setIsPartial] = useState(
    (initialData.amountPaid ?? 0) > 0 &&
      (initialData.amountPaid ?? 0) <
        (initialData.finalAmount ?? initialData.amount ?? 0),
  );
  const [amountPaid, setAmountPaid] = useState(
    initialData.amountPaid ?? initialData.amount ?? 0,
  );

  const totalAmount = data.finalAmount ?? data.amount ?? 0;

  function handleSave() {
    const finalPaid = !isPartial;
    const finalAmountPaid = isPartial ? amountPaid : totalAmount;
    const due = isPartial ? totalAmount - amountPaid : 0;
    const updated: MoneyReceiptData = {
      ...data,
      paid: finalPaid,
      amountPaid: finalAmountPaid,
      dueAmount: due,
      invoiceState: isPartial ? "partial" : "paid",
    };
    setData(updated);
    saveReceiptToStore(updated);
    toast.success(`Receipt ${updated.receiptNumber} saved`);
  }

  function handlePrint() {
    handleSave();
    window.print();
  }

  function handleDownloadPDF() {
    setShowDownloadOptions(true);
  }

  function handleRefund(refund: RefundRecord) {
    const isFullRefund = refund.amount >= totalAmount;
    const updated: MoneyReceiptData = {
      ...data,
      paid: false,
      invoiceState: isFullRefund ? "refunded" : "partial_refunded",
      refund,
    };
    setData(updated);
    saveReceiptToStore(updated);
    setShowRefund(false);
    toast.success(
      `Refund of ৳${refund.amount.toLocaleString("en-BD")} recorded`,
    );
  }

  const isAppointment = data.type === "appointment";
  const titleEn = isAppointment ? "Appointment Receipt" : "Procedure Receipt";
  const titleBn = isAppointment ? "অ্যাপয়েন্টমেন্ট রসিদ" : "পদ্ধতি রসিদ";
  const serviceLabel = isAppointment ? "Service / সেবা" : "Procedure / পদ্ধতি";
  const formattedDate = new Date(data.date).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isRefunded =
    data.invoiceState === "refunded" ||
    data.invoiceState === "partial_refunded";

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#receipt-print-root) { display: none !important; }
          #receipt-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; }
          .receipt-no-print { display: none !important; }
        }
      `}</style>

      {showRefund && (
        <RefundDialog
          maxAmount={isPartial ? amountPaid : totalAmount}
          onConfirm={handleRefund}
          onCancel={() => setShowRefund(false)}
        />
      )}

      {showDownloadOptions && (
        <DownloadOptionsDialog
          receiptNumber={data.receiptNumber}
          onClose={() => setShowDownloadOptions(false)}
          onDownload={(withHeader, paperSize) => {
            setShowDownloadOptions(false);
            // Build header HTML
            const headerHtml = `<div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1f2937">
              <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px">
                <div style="width:40px;height:40px;background:#1d4ed8;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:18px;flex-shrink:0">A</div>
                <div>
                  <div style="font-weight:900;font-size:20px;color:#111827">Dr. Arman Kabir's Care</div>
                  <div style="font-size:12px;color:#6b7280">Patient Management &amp; Clinical Portal</div>
                </div>
              </div>
              <div style="font-size:12px;color:#9ca3af">University Dental College &amp; Hospital, Moghbazar, Dhaka</div>
            </div>`;
            const el = printRef.current;
            const bodyHtml = el ? el.innerHTML : "";
            triggerReceiptPrint({
              bodyHtml,
              headerHtml,
              withHeader,
              paperSize,
              filename: `receipt-${data.receiptNumber}`,
            });
            handleSave();
          }}
        />
      )}

      <dialog
        open
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 receipt-no-print border-0 max-w-none w-full h-full m-0"
        aria-label="Money Receipt"
      >
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border receipt-no-print">
            <h2 className="font-bold text-foreground text-base">{titleEn}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              aria-label="Close receipt"
              data-ocid="receipt.close_button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Amount + payment method */}
            <div className="grid grid-cols-2 gap-4 receipt-no-print">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount (৳)</Label>
                <Input
                  type="number"
                  min="0"
                  value={data.amount || ""}
                  onChange={(e) =>
                    setData((d) => ({ ...d, amount: Number(e.target.value) }))
                  }
                  className="text-lg font-bold"
                  data-ocid="receipt.amount_input"
                />
              </div>
              <div className="receipt-no-print">
                <PaymentMethodSelector
                  value={data.paymentMethod}
                  onChange={(v) => setData((d) => ({ ...d, paymentMethod: v }))}
                />
              </div>
            </div>

            {/* Partial payment */}
            <div className="receipt-no-print">
              <PartialPaymentFields
                total={totalAmount}
                amountPaid={amountPaid}
                onAmountPaidChange={setAmountPaid}
                isPartial={isPartial}
                onIsPartialChange={setIsPartial}
              />
            </div>

            {data.notes !== undefined && (
              <div className="space-y-1.5 receipt-no-print">
                <Label className="text-xs font-semibold">
                  Notes (optional)
                </Label>
                <Input
                  placeholder="Additional notes…"
                  value={data.notes || ""}
                  onChange={(e) =>
                    setData((d) => ({ ...d, notes: e.target.value }))
                  }
                  data-ocid="receipt.notes_input"
                />
              </div>
            )}

            {/* Printable receipt document */}
            <div id="receipt-print-root">
              <div
                ref={printRef}
                className="bg-white border-2 border-gray-200 rounded-xl p-8 relative overflow-hidden"
                style={{ fontFamily: "serif", minWidth: 420 }}
              >
                {/* Watermark */}
                {data.paid && !isRefunded && (
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
                        letterSpacing: 4,
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
                      style={{
                        fontSize: 80,
                        transform: "rotate(-35deg)",
                        opacity: 0.22,
                      }}
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

                {/* Receipt title */}
                <div className="text-center mb-5">
                  <h2 className="text-lg font-bold text-gray-800 uppercase tracking-widest">
                    {titleEn}
                  </h2>
                  <p className="text-sm text-gray-500">{titleBn}</p>
                </div>

                {/* Meta row */}
                <div className="flex justify-between items-start mb-5 text-xs text-gray-600">
                  <div>
                    <span className="font-semibold">Receipt No: </span>
                    <span className="font-mono text-gray-800">
                      {data.receiptNumber}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">Date: </span>
                    <span>{formattedDate}</span>
                  </div>
                </div>

                {/* Field grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
                  <ReceiptField
                    label="Patient Name / রোগীর নাম"
                    value={data.patientName}
                  />
                  <ReceiptField
                    label="Register No. / রেজিস্টার নং"
                    value={data.registerNumber || "—"}
                    mono
                  />
                  {data.phone && (
                    <ReceiptField label="Phone / ফোন" value={data.phone} />
                  )}
                  <ReceiptField
                    label="Doctor / ডাক্তার"
                    value={data.doctorName || "—"}
                  />
                  {isAppointment && data.serialNumber !== undefined && (
                    <ReceiptField
                      label="Serial No."
                      value={`#${data.serialNumber}`}
                    />
                  )}
                  <ReceiptField label={serviceLabel} value={data.service} />
                  {data.paymentMethod && (
                    <ReceiptField
                      label="Payment Method / পেমেন্ট"
                      value={PM_LABELS[data.paymentMethod]}
                    />
                  )}
                </div>

                {/* Amount box */}
                <div className="border-2 border-gray-800 rounded-lg p-4 mb-4">
                  {isPartial ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Total Billed</span>
                        <span className="font-semibold">
                          ৳{totalAmount.toLocaleString("en-BD")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-emerald-700">
                        <span>Amount Paid</span>
                        <span className="font-bold">
                          ৳{amountPaid.toLocaleString("en-BD")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-amber-700 border-t border-gray-300 pt-1 font-bold">
                        <span>Balance Due</span>
                        <span>
                          ৳
                          {Math.max(0, totalAmount - amountPaid).toLocaleString(
                            "en-BD",
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-xs uppercase font-semibold text-gray-500 mb-1">
                        Total Amount / মোট পরিমাণ
                      </p>
                      <p className="text-3xl font-black text-gray-900">
                        ৳{" "}
                        {(data.amount ?? 0) > 0
                          ? (data.amount ?? 0).toLocaleString("en-BD")
                          : "0"}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 text-center">
                    <InvoiceStateBadge
                      state={
                        isPartial
                          ? "partial"
                          : isRefunded
                            ? (data.invoiceState ?? "paid")
                            : "paid"
                      }
                    />
                  </div>
                </div>

                {/* Refund info */}
                {data.refund && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4 text-sm">
                    <p className="font-semibold text-rose-700 mb-1">
                      Refund Details
                    </p>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>
                        Amount: ৳{data.refund.amount.toLocaleString("en-BD")}
                      </p>
                      <p>Reason: {data.refund.reason.replace("_", " ")}</p>
                      <p>
                        Date:{" "}
                        {new Date(data.refund.date).toLocaleDateString("en-BD")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {data.notes && (
                  <p className="text-xs text-gray-600 italic mb-4 text-center">
                    Note: {data.notes}
                  </p>
                )}

                {/* Signature line */}
                <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-300">
                  <div className="text-center">
                    <div className="border-b border-gray-500 w-32 mb-1" />
                    <p className="text-xs text-gray-500">Patient Signature</p>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-gray-500 w-32 mb-1" />
                    <p className="text-xs text-gray-500">
                      Authorized Signature
                    </p>
                  </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-4">
                  Computer-generated receipt — Dr. Arman Kabir&apos;s Care
                </p>
              </div>
            </div>
          </div>

          {/* Modal footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border receipt-no-print">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-ocid="receipt.cancel_button"
              >
                Close
              </Button>
              {data.phone && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => sendReceiptWhatsApp(data)}
                  data-ocid="receipt.whatsapp_button"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
              )}
              {(data.paid || isPartial) && !isRefunded && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50"
                  onClick={() => setShowRefund(true)}
                  data-ocid="receipt.refund_button"
                >
                  <RotateCcw className="w-4 h-4" />
                  Refund
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={handleDownloadPDF}
                disabled={false}
                data-ocid="receipt.download_button"
              >
                <FileDown className="w-4 h-4" />
                Download
              </Button>
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90"
                onClick={handlePrint}
                data-ocid="receipt.print_button"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────
function ReceiptField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`font-semibold text-gray-800 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// ── Receipts History List ─────────────────────────────────────────────────────

export function ReceiptsHistoryList() {
  const [receipts, setReceipts] = useState<MoneyReceiptData[]>(() =>
    loadReceipts(),
  );
  const [viewing, setViewing] = useState<MoneyReceiptData | null>(null);

  function handleDelete(id: string) {
    const updated = receipts.filter((r) => r.id !== id);
    setReceipts(updated);
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated));
    toast.success("Receipt deleted");
  }

  if (receipts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
        data-ocid="receipts.empty_state"
      >
        <Download className="w-10 h-10 opacity-30" />
        <p className="font-medium">No receipts yet</p>
        <p className="text-sm">
          Generate a receipt from an appointment or procedure
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-ocid="receipts.list">
      <p className="text-sm text-muted-foreground">
        {receipts.length} receipt{receipts.length !== 1 ? "s" : ""} stored
        locally
      </p>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">
                Receipt #
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">
                Patient
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">
                Type
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">
                Amount
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">
                Status
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r, idx) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                data-ocid={`receipts.item.${idx + 1}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-primary font-semibold">
                    {r.receiptNumber}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {r.patientName}
                  {r.registerNumber && (
                    <p className="text-xs font-mono text-muted-foreground">
                      {r.registerNumber}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.type === "appointment"
                        ? "bg-blue-100 text-blue-700"
                        : r.type === "investigation"
                          ? "bg-purple-100 text-purple-700"
                          : r.type === "other"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-teal-100 text-teal-700"
                    }`}
                  >
                    {r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  ৳{(r.finalAmount ?? r.amount ?? 0).toLocaleString("en-BD")}
                  {(r.dueAmount ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 font-medium">
                      Due: ৳{r.dueAmount?.toLocaleString("en-BD")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {r.invoiceState === "refunded" ||
                  r.invoiceState === "partial_refunded" ? (
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Refunded
                    </span>
                  ) : r.invoiceState === "partial" ? (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Partial
                    </span>
                  ) : r.paid ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Paid
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Unpaid
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => setViewing(r)}
                      data-ocid={`receipts.view_button.${idx + 1}`}
                    >
                      <Printer className="w-3 h-3" />
                      Reprint
                    </Button>
                    {r.phone && (
                      <button
                        type="button"
                        onClick={() => sendReceiptWhatsApp(r)}
                        className="h-7 w-7 flex items-center justify-center rounded border border-green-200 hover:bg-green-50 transition-colors"
                        title="Send via WhatsApp"
                        data-ocid={`receipts.whatsapp_button.${idx + 1}`}
                        style={{ color: "#25D366" }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(r.id)}
                      data-ocid={`receipts.delete_button.${idx + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && (
        <MoneyReceipt initialData={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
