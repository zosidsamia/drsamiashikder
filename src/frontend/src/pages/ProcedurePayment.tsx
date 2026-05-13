/**
 * ProcedurePayment — Mirrors InvestigationPayment but for procedures.
 * Orange theme. CSV upload, rate list management, multi-select, discount, receipt history.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  InvoiceStateBadge,
  PartialPaymentFields,
  PaymentMethodSelector,
  RefundDialog,
  generateTypedReceiptNumber,
  loadReceipts,
  saveReceiptToStore,
  sendReceiptWhatsApp,
} from "../components/MoneyReceipt";
import type {
  InvestigationLineItem,
  MoneyReceiptData,
  PaymentMethod,
  RefundRecord,
} from "../types";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProcedureRate {
  id: string;
  name: string;
  rate: number;
}

interface ProcedureReceiptRecord extends MoneyReceiptData {
  procedures?: InvestigationLineItem[];
  paymentMethod?: PaymentMethod;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const RATES_KEY = "procedureRates";
const PAYMENTS_KEY = "procedurePayments";

function loadProcedureRates(): ProcedureRate[] {
  try {
    return JSON.parse(localStorage.getItem(RATES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProcedureRates(rates: ProcedureRate[]) {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates));
}

function loadProcedureReceipts(): ProcedureReceiptRecord[] {
  try {
    const all: ProcedureReceiptRecord[] = JSON.parse(
      localStorage.getItem(PAYMENTS_KEY) || "[]",
    );
    return all;
  } catch {
    return [];
  }
}

function saveProcedureReceipt(r: ProcedureReceiptRecord) {
  const all = loadProcedureReceipts();
  const idx = all.findIndex((x) => x.id === r.id);
  if (idx >= 0) all[idx] = r;
  else all.unshift(r);
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(all));
  saveReceiptToStore(r);
}

// ── Receipt Doc (printable) ───────────────────────────────────────────────────

function ProcedureReceiptDoc({
  receipt,
  printRef,
}: {
  receipt: ProcedureReceiptRecord;
  printRef: React.RefObject<HTMLDivElement>;
}) {
  const formattedDate = new Date(receipt.date).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const items = receipt.procedures ?? receipt.investigations ?? [];
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const discountAmt = subtotal * ((receipt.discountRate ?? 0) / 100);
  const finalTotal = receipt.finalAmount ?? subtotal - discountAmt;

  return (
    <div
      ref={printRef}
      className="bg-white border-2 border-gray-200 rounded-xl p-8 relative overflow-hidden"
      style={{ fontFamily: "serif", minWidth: 420 }}
    >
      {receipt.paid && (
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
      <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-10 h-10 bg-orange-700 rounded-full flex items-center justify-center text-white font-black text-lg">
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
          Procedure Receipt
        </h2>
        <p className="text-sm text-gray-500">পদ্ধতি রসিদ</p>
      </div>
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
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
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
        {receipt.doctorName && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Doctor</p>
            <p className="font-semibold text-gray-800">{receipt.doctorName}</p>
          </div>
        )}
      </div>
      <table className="w-full text-sm mb-5 border border-gray-300 rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold border-b border-gray-300">
              Procedure
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
      <div className="ml-auto w-56 space-y-1.5 mb-5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
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
      </div>
      <div className="text-center mb-5">
        <InvoiceStateBadge
          state={receipt.invoiceState ?? (receipt.paid ? "paid" : "invoice")}
        />
      </div>
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

// ── Receipt Modal ─────────────────────────────────────────────────────────────

function ReceiptModal({
  receipt: initialReceipt,
  onClose,
}: { receipt: ProcedureReceiptRecord; onClose: () => void }) {
  const [receipt, setReceipt] = useState(initialReceipt);
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [isPartial, setIsPartial] = useState(
    initialReceipt.invoiceState === "partial",
  );
  const [amountPaid, setAmountPaid] = useState(
    initialReceipt.amountPaid ??
      initialReceipt.finalAmount ??
      initialReceipt.amount ??
      0,
  );

  const totalAmount = receipt.finalAmount ?? receipt.amount ?? 0;
  const isInvoiceStep = receipt.invoiceState === "invoice";
  const isRefunded =
    receipt.invoiceState === "refunded" ||
    receipt.invoiceState === "partial_refunded";

  function handleMarkPaid() {
    if (!receipt.paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    const paid = !isPartial;
    const paidAmt = isPartial ? amountPaid : totalAmount;
    const dueAmt = isPartial ? totalAmount - amountPaid : 0;
    const updated: ProcedureReceiptRecord = {
      ...receipt,
      paid,
      amountPaid: paidAmt,
      dueAmount: dueAmt,
      invoiceState: isPartial ? "partial" : "paid",
    };
    setReceipt(updated);
    saveProcedureReceipt(updated);
    toast.success(`Receipt saved — ${updated.receiptNumber}`);
  }

  function handleRefund(refund: RefundRecord) {
    const isFullRefund = refund.amount >= totalAmount;
    const updated: ProcedureReceiptRecord = {
      ...receipt,
      paid: false,
      invoiceState: isFullRefund ? "refunded" : "partial_refunded",
      refund,
    };
    setReceipt(updated);
    saveProcedureReceipt(updated);
    setShowRefund(false);
    toast.success(
      `Refund of ৳${refund.amount.toLocaleString("en-BD")} recorded`,
    );
  }

  function handleSave() {
    saveProcedureReceipt(receipt);
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
      link.download = `proc-receipt-${receipt.receiptNumber}.png`;
      link.click();
      handleSave();
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Could not generate download. Use Print instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#proc-receipt-print-root) { display: none !important; }
          #proc-receipt-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; }
          .proc-receipt-no-print { display: none !important; }
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 proc-receipt-no-print border-0 max-w-none w-full h-full m-0"
        aria-label="Procedure Receipt"
      >
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border proc-receipt-no-print">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-600" />
              {isInvoiceStep ? "Invoice" : "Procedure Receipt"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              data-ocid="proc_receipt.close_button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {isInvoiceStep && (
              <div className="space-y-3 proc-receipt-no-print">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                  📄 Review invoice then select payment method and click{" "}
                  <strong>Mark as Paid</strong>.
                </div>
                <PaymentMethodSelector
                  value={receipt.paymentMethod}
                  onChange={(v) =>
                    setReceipt((r) => ({ ...r, paymentMethod: v }))
                  }
                  ocidPrefix="proc_receipt"
                />
                <PartialPaymentFields
                  total={totalAmount}
                  amountPaid={amountPaid}
                  onAmountPaidChange={setAmountPaid}
                  isPartial={isPartial}
                  onIsPartialChange={setIsPartial}
                  ocidPrefix="proc_receipt"
                />
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
                  onClick={handleMarkPaid}
                  data-ocid="proc_receipt.mark_paid.button"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Paid — Generate Receipt
                </Button>
              </div>
            )}
            <div id="proc-receipt-print-root">
              <ProcedureReceiptDoc
                receipt={receipt}
                printRef={printRef as React.RefObject<HTMLDivElement>}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border proc-receipt-no-print">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-ocid="proc_receipt.cancel_button"
              >
                Close
              </Button>
              {receipt.phone && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => sendReceiptWhatsApp(receipt)}
                  data-ocid="proc_receipt.whatsapp_button"
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
                    data-ocid="proc_receipt.refund_button"
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
                data-ocid="proc_receipt.download_button"
              >
                <Download className="w-4 h-4" />
                {saving ? "Generating…" : "Download"}
              </Button>
              <Button
                className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                onClick={handlePrint}
                data-ocid="proc_receipt.print_button"
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

// ── Rate Management Panel ─────────────────────────────────────────────────────

function RateManagementPanel({
  rates,
  onUpdate,
}: {
  rates: ProcedureRate[];
  onUpdate: (rates: ProcedureRate[]) => void;
}) {
  const [localRates, setLocalRates] = useState(rates);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState<number>(500);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    if (!newName.trim()) {
      toast.error("Procedure name required");
      return;
    }
    const updated = [
      ...localRates,
      { id: Date.now().toString(36), name: newName.trim(), rate: newRate },
    ];
    setLocalRates(updated);
    saveProcedureRates(updated);
    onUpdate(updated);
    setNewName("");
    setNewRate(500);
    toast.success("Procedure added");
  }

  function handleRemove(id: string) {
    const updated = localRates.filter((r) => r.id !== id);
    setLocalRates(updated);
    saveProcedureRates(updated);
    onUpdate(updated);
  }

  function handleRateEdit(id: string, rate: number) {
    const updated = localRates.map((r) => (r.id === id ? { ...r, rate } : r));
    setLocalRates(updated);
    saveProcedureRates(updated);
    onUpdate(updated);
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const newRates: ProcedureRate[] = [];
      for (const line of lines) {
        const parts = line
          .split(",")
          .map((p) => p.trim().replace(/^"|"$/g, ""));
        if (parts.length < 2) continue;
        const name = parts[0];
        const rate = Number.parseFloat(parts[1]);
        if (!name || Number.isNaN(rate)) continue;
        newRates.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          name,
          rate,
        });
      }
      const merged = [...localRates];
      for (const nr of newRates) {
        const exists = merged.findIndex(
          (r) => r.name.toLowerCase() === nr.name.toLowerCase(),
        );
        if (exists >= 0) merged[exists].rate = nr.rate;
        else merged.push(nr);
      }
      setLocalRates(merged);
      saveProcedureRates(merged);
      onUpdate(merged);
      toast.success(`${newRates.length} procedures imported`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Procedure Rate List ({localRates.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
          onClick={() => fileRef.current?.click()}
          data-ocid="proc_payment.upload_csv.button"
        >
          <Upload className="w-3 h-3" />
          Import CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleCSVUpload}
        />
      </div>
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {localRates.length === 0 ? (
          <p
            className="text-center text-muted-foreground text-sm py-8"
            data-ocid="proc_payment.rates.empty_state"
          >
            No procedures yet. Add manually or import CSV.
          </p>
        ) : (
          localRates.map((r, idx) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-4 py-2.5"
              data-ocid={`proc_payment.rate.item.${idx + 1}`}
            >
              <span className="flex-1 text-sm text-foreground">{r.name}</span>
              <Input
                type="number"
                min={0}
                value={r.rate}
                onChange={(e) => handleRateEdit(r.id, Number(e.target.value))}
                className="w-24 h-7 text-xs text-right"
                data-ocid={`proc_payment.rate.input.${idx + 1}`}
              />
              <span className="text-xs text-muted-foreground">৳</span>
              <button
                type="button"
                onClick={() => handleRemove(r.id)}
                className="text-destructive hover:bg-destructive/10 p-1 rounded"
                data-ocid={`proc_payment.rate.delete.${idx + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border px-4 py-3 bg-muted/20 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Procedure name"
          className="flex-1 h-8 text-sm"
          data-ocid="proc_payment.new_name.input"
        />
        <Input
          type="number"
          min={0}
          value={newRate}
          onChange={(e) => setNewRate(Number(e.target.value))}
          className="w-28 h-8 text-sm"
          placeholder="Rate ৳"
          data-ocid="proc_payment.new_rate.input"
        />
        <Button
          size="sm"
          className="h-8 px-3 bg-orange-600 hover:bg-orange-700 text-white gap-1"
          onClick={handleAdd}
          data-ocid="proc_payment.add_rate.button"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/10 border-t border-border">
        CSV format: <span className="font-mono">Procedure Name, Rate</span> —
        one per line
      </p>
    </div>
  );
}

// ── New Payment View ──────────────────────────────────────────────────────────

function NewPaymentView({
  rates,
  onReceiptGenerated,
}: {
  rates: ProcedureRate[];
  onReceiptGenerated: (r: ProcedureReceiptRecord) => void;
}) {
  const [patientName, setPatientName] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [selected, setSelected] = useState<
    Record<string, { checked: boolean; qty: number }>
  >(() =>
    Object.fromEntries(rates.map((r) => [r.id, { checked: false, qty: 1 }])),
  );
  const [discountRate, setDiscountRate] = useState(0);
  const [finalOverride, setFinalOverride] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    undefined,
  );
  const [isPartial, setIsPartial] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  const [invoiceStep, setInvoiceStep] = useState<"form" | "invoice">("form");

  const checkedRates = rates.filter((r) => selected[r.id]?.checked);
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
  function handleDiscountChange(val: string) {
    setDiscountRate(Math.min(100, Math.max(0, Number(val) || 0)));
    setFinalOverride("");
  }
  function handleFinalChange(val: string) {
    setFinalOverride(val);
    const num = Number(val);
    if (subtotal > 0 && !Number.isNaN(num))
      setDiscountRate(
        Math.max(
          0,
          Math.min(100, Math.round((1 - num / subtotal) * 10000) / 100),
        ),
      );
  }

  function handleGenerateInvoice() {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return;
    }
    if (checkedRates.length === 0) {
      toast.error("Select at least one procedure");
      return;
    }
    setInvoiceStep("invoice");
  }

  function handleMarkPaid() {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    const procedures: InvestigationLineItem[] = checkedRates.map((r) => {
      const qty = selected[r.id]?.qty ?? 1;
      return { name: r.name, qty, unitRate: r.rate, amount: r.rate * qty };
    });
    const paid = !isPartial;
    const paidAmt = isPartial ? amountPaid : finalAmount;
    const dueAmt = isPartial ? finalAmount - amountPaid : 0;
    const receipt: ProcedureReceiptRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      receiptNumber: generateTypedReceiptNumber("PRO"),
      type: "procedure",
      patientName: patientName.trim(),
      registerNumber,
      doctorName,
      service: procedures.map((p) => p.name).join(", "),
      amount: finalAmount,
      finalAmount,
      discountRate: effectiveDiscount,
      paid,
      amountPaid: paidAmt,
      dueAmount: dueAmt,
      invoiceState: isPartial ? "partial" : "paid",
      paymentMethod,
      date: new Date().toISOString(),
      procedures,
    };
    saveProcedureReceipt(receipt);
    toast.success(`Receipt ${receipt.receiptNumber} generated`);
    onReceiptGenerated(receipt);
  }

  if (rates.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center"
        data-ocid="proc_payment.no_rates.empty_state"
      >
        <FileText className="w-10 h-10 opacity-30" />
        <p className="font-semibold">No procedure rates configured</p>
        <p className="text-sm">Add procedures to the rate list above first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Patient Name *</Label>
          <Input
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Full name"
            data-ocid="proc_payment.patient_name.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Register No.</Label>
          <Input
            value={registerNumber}
            onChange={(e) => setRegisterNumber(e.target.value)}
            placeholder="0001/26"
            data-ocid="proc_payment.register.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Doctor</Label>
          <Input
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Doctor name"
            data-ocid="proc_payment.doctor.input"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm font-semibold text-orange-800">
            Select Procedures
          </p>
          <p className="text-xs text-muted-foreground">
            {checkedRates.length} selected
          </p>
        </div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {rates.map((rate, idx) => {
            const s = selected[rate.id] ?? { checked: false, qty: 1 };
            const lineAmt = s.checked ? rate.rate * (s.qty || 1) : null;
            return (
              <div
                key={rate.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${s.checked ? "bg-orange-50" : "hover:bg-muted/20"}`}
                data-ocid={`proc_payment.item.${idx + 1}`}
              >
                <Checkbox
                  id={`proc-${rate.id}`}
                  checked={s.checked}
                  onCheckedChange={() => handleToggle(rate.id)}
                  data-ocid={`proc_payment.checkbox.${idx + 1}`}
                />
                <label
                  htmlFor={`proc-${rate.id}`}
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
                  className={`text-sm font-semibold tabular-nums ${s.checked ? "text-orange-700" : "text-muted-foreground"}`}
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

      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">
            ৳ {subtotal.toLocaleString("en-BD")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Label
            htmlFor="proc-discount"
            className="text-sm whitespace-nowrap shrink-0"
          >
            Discount Rate (%)
          </Label>
          <Input
            id="proc-discount"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={discountRate === 0 ? "" : discountRate}
            placeholder="0"
            onChange={(e) => handleDiscountChange(e.target.value)}
            className="w-24 h-8 text-sm"
            data-ocid="proc_payment.discount_rate.input"
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
            htmlFor="proc-final"
            className="text-sm whitespace-nowrap shrink-0"
          >
            Final Rate (৳)
          </Label>
          <Input
            id="proc-final"
            type="number"
            min={0}
            value={finalOverride !== "" ? finalOverride : autoFinal || ""}
            placeholder="0"
            onChange={(e) => handleFinalChange(e.target.value)}
            className="w-32 h-8 text-sm font-bold text-orange-700"
            data-ocid="proc_payment.final_rate.input"
          />
          {finalOverride !== "" && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFinalOverride("");
              }}
            >
              ↺ Reset
            </button>
          )}
        </div>
        <div className="bg-card border-2 border-orange-300 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-0.5 uppercase font-semibold tracking-wide">
            Final Total / মোট
          </p>
          <p className="text-3xl font-black text-orange-700 tabular-nums">
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

      {invoiceStep === "invoice" ? (
        <div className="space-y-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-orange-900 text-sm">
              📄 Invoice Preview
            </h3>
            <button
              type="button"
              onClick={() => setInvoiceStep("form")}
              className="text-orange-600 text-xs hover:underline"
            >
              ← Edit
            </button>
          </div>
          <div className="ml-auto w-48 space-y-1 text-sm">
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
            <div className="flex justify-between border-t border-orange-300 pt-1 font-bold text-orange-900 text-base">
              <span>Total Due</span>
              <span>৳{finalAmount.toLocaleString("en-BD")}</span>
            </div>
          </div>
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            ocidPrefix="proc_payment"
          />
          <PartialPaymentFields
            total={finalAmount}
            amountPaid={amountPaid}
            onAmountPaidChange={setAmountPaid}
            isPartial={isPartial}
            onIsPartialChange={setIsPartial}
            ocidPrefix="proc_payment"
          />
          <Button
            className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleMarkPaid}
            data-ocid="proc_payment.mark_paid.button"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as Paid — Generate Receipt
          </Button>
        </div>
      ) : (
        <Button
          className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
          disabled={checkedRates.length === 0 || !patientName.trim()}
          onClick={handleGenerateInvoice}
          data-ocid="proc_payment.generate_receipt.button"
        >
          <Receipt className="w-4 h-4" />
          Generate Invoice →
        </Button>
      )}
    </div>
  );
}

// ── History View ──────────────────────────────────────────────────────────────

function HistoryView() {
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ProcedureReceiptRecord | null>(null);
  const receipts = loadProcedureReceipts();
  const moneyReceipts = loadReceipts().filter((r) => r.type === "procedure");
  const allReceipts = [
    ...receipts,
    ...moneyReceipts.filter((m) => !receipts.find((r) => r.id === m.id)),
  ];
  const filtered = allReceipts.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.patientName.toLowerCase().includes(q) ||
      r.service.toLowerCase().includes(q) ||
      r.receiptNumber.toLowerCase().includes(q)
    );
  });

  if (allReceipts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center"
        data-ocid="proc_payment.history.empty_state"
      >
        <CreditCard className="w-10 h-10 opacity-30" />
        <p className="font-semibold">No procedure payments yet</p>
        <p className="text-sm">Generated receipts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by patient or procedure…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
          data-ocid="proc_payment.history.search_input"
        />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                Receipt #
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                Patient
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden sm:table-cell">
                Date
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
                data-ocid={`proc_payment.history.item.${idx + 1}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-orange-700 font-semibold">
                    {r.receiptNumber}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground text-sm">
                  {r.patientName}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                  {new Date(r.date).toLocaleDateString("en-BD", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  ৳ {(r.finalAmount ?? r.amount).toLocaleString("en-BD")}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {r.paid ? (
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
                    className="h-7 px-2 text-xs gap-1 text-orange-700 border-orange-200 hover:bg-orange-50"
                    onClick={() => setViewing(r as ProcedureReceiptRecord)}
                    data-ocid={`proc_payment.history.view_button.${idx + 1}`}
                  >
                    <Printer className="w-3 h-3" />
                    View
                  </Button>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProcedurePayment() {
  const [rates, setRates] = useState<ProcedureRate[]>(() =>
    loadProcedureRates(),
  );
  const [view, setView] = useState<"new" | "history">("new");
  const [previewReceipt, setPreviewReceipt] =
    useState<ProcedureReceiptRecord | null>(null);

  return (
    <div
      className="min-h-screen bg-background"
      data-ocid="procedure_payment.page"
    >
      {/* Header */}
      <div className="bg-orange-600 text-white px-4 sm:px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <p className="text-orange-100 text-xs mb-0.5">Billing</p>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            Procedure Payment
          </h1>
          <p className="text-orange-100 text-sm mt-0.5">পদ্ধতি পেমেন্ট ব্যবস্থাপনা</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <RateManagementPanel rates={rates} onUpdate={setRates} />

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex gap-1 bg-muted/40 p-1 border-b border-border">
            <button
              type="button"
              onClick={() => setView("new")}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${view === "new" ? "bg-orange-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-ocid="proc_payment.new_payment.tab"
            >
              <Receipt className="w-3.5 h-3.5" />
              New Payment
            </button>
            <button
              type="button"
              onClick={() => setView("history")}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${view === "history" ? "bg-orange-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-ocid="proc_payment.history.tab"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Payment History
            </button>
          </div>
          <div className="p-4">
            {view === "new" && (
              <NewPaymentView
                rates={rates}
                onReceiptGenerated={(r) => setPreviewReceipt(r)}
              />
            )}
            {view === "history" && <HistoryView />}
          </div>
        </div>
      </div>

      {previewReceipt && (
        <ReceiptModal
          receipt={previewReceipt}
          onClose={() => setPreviewReceipt(null)}
        />
      )}
    </div>
  );
}
