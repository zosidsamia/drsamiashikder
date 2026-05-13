/**
 * OtherPayment — Miscellaneous payment receipts (admission fees, registration fees, etc.)
 * v2: Invoice step, payment method (mandatory), OTH-YYYY-NNNN sequential receipt numbers,
 *     partial payment, refund action.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Banknote,
  CheckCircle2,
  MessageCircle,
  Plus,
  PlusCircle,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
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
  saveReceiptToStore,
  sendReceiptWhatsApp,
} from "../components/MoneyReceipt";
import { useEmailAuth } from "../hooks/useEmailAuth";
import type { MoneyReceiptData, PaymentMethod, RefundRecord } from "../types";

const OTHER_PAYMENTS_KEY = "other_payments_index";
const ADV_PAYMENTS_KEY = "advance_payments";

interface AdvancePaymentRecord {
  id: string;
  patientName: string;
  registerNumber: string;
  phone: string;
  amount: number;
  date: string;
  paymentMethod?: PaymentMethod;
  notes: string;
  receiptNumber: string;
  appliedToReceipt?: string;
}

function loadAdvancePayments(): AdvancePaymentRecord[] {
  try {
    return JSON.parse(localStorage.getItem(ADV_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAdvancePayment(r: AdvancePaymentRecord) {
  const all = loadAdvancePayments();
  const idx = all.findIndex((x) => x.id === r.id);
  if (idx >= 0) all[idx] = r;
  else all.unshift(r);
  localStorage.setItem(ADV_PAYMENTS_KEY, JSON.stringify(all));
}

function getAdvCounter(): string {
  const year = new Date().getFullYear();
  const yearKey = "receipt_year_adv";
  const counterKey = "receipt_counter_adv";
  const storedYear = Number.parseInt(localStorage.getItem(yearKey) || "0", 10);
  let count = 1;
  if (storedYear === year) {
    count = Number.parseInt(localStorage.getItem(counterKey) || "0", 10) + 1;
  }
  localStorage.setItem(yearKey, String(year));
  localStorage.setItem(counterKey, String(count));
  return `ADV-${year}-${String(count).padStart(4, "0")}`;
}

interface OtherPaymentRecord {
  id: string;
  patientName: string;
  registerNumber: string;
  date: string;
  items: Array<{ description: string; amount: number }>;
  subtotal: number;
  discountPct: number;
  finalAmount: number;
  receiptNumber: string;
  notes: string;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  dueAmount?: number;
  invoiceState?:
    | "invoice"
    | "paid"
    | "partial"
    | "refunded"
    | "partial_refunded";
  refund?: RefundRecord;
}

function loadOtherPayments(): OtherPaymentRecord[] {
  try {
    return JSON.parse(localStorage.getItem(OTHER_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOtherPayment(r: OtherPaymentRecord) {
  const all = loadOtherPayments();
  const idx = all.findIndex((x) => x.id === r.id);
  if (idx >= 0) all[idx] = r;
  else all.unshift(r);
  localStorage.setItem(OTHER_PAYMENTS_KEY, JSON.stringify(all));
}

interface OtherLineItem {
  description: string;
  amount: number;
}

const QUICK_ITEMS = [
  { description: "Admission Fee", amount: 500 },
  { description: "Registration Fee", amount: 200 },
  { description: "Bed Charge (per day)", amount: 800 },
  { description: "Attendant Charge", amount: 300 },
  { description: "Medical Certificate", amount: 500 },
  { description: "Report Collection Fee", amount: 100 },
];

// ── Advance Payment View ──────────────────────────────────────────────────────────

function AdvancePaymentView() {
  const [patientName, setPatientName] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    undefined,
  );
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<AdvancePaymentRecord[]>(() =>
    loadAdvancePayments(),
  );
  const [view, setView] = useState<"new" | "history">("new");

  function handleSave() {
    if (!patientName.trim() || !amount || Number(amount) <= 0 || !paymentMethod)
      return;
    const rec: AdvancePaymentRecord = {
      id: `adv-${Date.now()}`,
      patientName: patientName.trim(),
      registerNumber: registerNumber.trim(),
      phone: phone.trim(),
      amount: Number(amount),
      date,
      paymentMethod,
      notes: notes.trim(),
      receiptNumber: getAdvCounter(),
    };
    saveAdvancePayment(rec);
    saveReceiptToStore({
      id: rec.id,
      receiptNumber: rec.receiptNumber,
      type: "other",
      patientName: rec.patientName,
      registerNumber: rec.registerNumber,
      phone: rec.phone,
      service: "Advance Deposit",
      amount: rec.amount,
      finalAmount: rec.amount,
      paid: true,
      amountPaid: rec.amount,
      dueAmount: 0,
      invoiceState: "paid",
      paymentMethod: rec.paymentMethod,
      date: rec.date,
      notes: rec.notes ? `Advance deposit. ${rec.notes}` : "Advance deposit",
    });
    setHistory(loadAdvancePayments());
    setPatientName("");
    setRegisterNumber("");
    setPhone("");
    setAmount("");
    setNotes("");
    setPaymentMethod(undefined);
    setView("history");
    import("sonner").then(({ toast }) =>
      toast.success(`Advance receipt ${rec.receiptNumber} generated`),
    );
  }

  const unusedCredit = history
    .filter((r) => !r.appliedToReceipt)
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4" data-ocid="advance_payment.panel">
      {unusedCredit > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Banknote className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              Total Unused Advance Credit
            </p>
            <p className="text-xl font-black text-green-700">
              ৳{unusedCredit.toLocaleString("en-BD")}
            </p>
          </div>
        </div>
      )}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border border-border">
        {(["new", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setView(t);
              if (t === "history") setHistory(loadAdvancePayments());
            }}
            className={`flex-1 h-8 rounded-lg text-sm font-semibold transition-colors ${
              view === t
                ? "bg-teal-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-ocid={`advance_payment.${t}.tab`}
          >
            {t === "new" ? "New Advance" : "History"}
          </button>
        ))}
      </div>
      {view === "new" && (
        <div className="bg-card border border-teal-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-teal-800 flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Record Advance Deposit / অগ্রিম জমা
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="advance_patient"
                className="text-xs font-semibold text-muted-foreground"
              >
                Patient Name *
              </label>
              <input
                id="advance_patient"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Full name"
                data-ocid="advance.patient.input"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="advance_register"
                className="text-xs font-semibold text-muted-foreground"
              >
                Register No.
              </label>
              <input
                id="advance_register"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
                placeholder="0001/26"
                data-ocid="advance.register.input"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="advance_phone"
                className="text-xs font-semibold text-muted-foreground"
              >
                Phone
              </label>
              <input
                id="advance_phone"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                data-ocid="advance.phone.input"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="advance_amount"
                className="text-xs font-semibold text-muted-foreground"
              >
                Advance Amount (৳) *
              </label>
              <input
                id="advance_amount"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-bold text-teal-700"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                data-ocid="advance.amount.input"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="advance_date"
                className="text-xs font-semibold text-muted-foreground"
              >
                Date
              </label>
              <input
                id="advance_date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-ocid="advance.date.input"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="advance_notes"
                className="text-xs font-semibold text-muted-foreground"
              >
                Notes (optional)
              </label>
              <input
                id="advance_notes"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Admission deposit"
                data-ocid="advance.notes.input"
              />
            </div>
          </div>
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            ocidPrefix="advance"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !patientName.trim() ||
              !amount ||
              Number(amount) <= 0 ||
              !paymentMethod
            }
            className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            data-ocid="advance.save.button"
          >
            <CheckCircle2 className="w-4 h-4" /> Generate Advance Receipt
            (ADV-XXXX)
          </button>
        </div>
      )}
      {view === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center"
              data-ocid="advance.empty_state"
            >
              <Banknote className="w-10 h-10 opacity-30" />
              <p className="font-semibold">No advance payments yet</p>
            </div>
          ) : (
            history.map((r, i) => (
              <div
                key={r.id}
                className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-3 ${
                  r.appliedToReceipt
                    ? "border-border opacity-70"
                    : "border-teal-200"
                }`}
                data-ocid={`advance.item.${i + 1}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    {r.patientName}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {r.registerNumber || "—"} · {r.receiptNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.date}
                    {r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                  </p>
                  {r.notes && (
                    <p className="text-xs italic text-muted-foreground mt-0.5">
                      {r.notes}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-black text-lg text-teal-700">
                    ৳{r.amount.toLocaleString("en-BD")}
                  </p>
                  {r.appliedToReceipt ? (
                    <span className="text-xs text-muted-foreground">
                      Applied
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-green-600">
                      Available credit
                    </span>
                  )}
                  {r.phone && (
                    <button
                      type="button"
                      onClick={() =>
                        sendReceiptWhatsApp({
                          patientName: r.patientName,
                          phone: r.phone,
                          receiptNumber: r.receiptNumber,
                          date: r.date,
                          finalAmount: r.amount,
                          amountPaid: r.amount,
                          dueAmount: 0,
                        })
                      }
                      className="flex items-center justify-center w-7 h-7 rounded border border-green-200 hover:bg-green-50 transition-colors"
                      title="Send via WhatsApp"
                      data-ocid={`advance.whatsapp_button.${i + 1}`}
                      style={{ color: "#25D366" }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OtherPayment() {
  const { currentDoctor } = useEmailAuth();
  const [tab, setTab] = useState<"new" | "history" | "advance">("new");
  const [patientName, setPatientName] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OtherLineItem[]>([]);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  // Invoice step
  const [invoiceStep, setInvoiceStep] = useState<"form" | "invoice">("form");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    undefined,
  );
  const [isPartial, setIsPartial] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  // Saved receipt
  const [savedReceipt, setSavedReceipt] = useState<OtherPaymentRecord | null>(
    null,
  );
  const printRef = useRef<HTMLDivElement>(null);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discountAmt = subtotal * (discountPct / 100);
  const finalAmount = subtotal - discountAmt;

  const addLine = (desc: string, amount: number) => {
    if (!desc.trim() || amount <= 0) return;
    setLines([...lines, { description: desc.trim(), amount }]);
    setNewDesc("");
    setNewAmount("");
  };

  const removeLine = (idx: number) =>
    setLines(lines.filter((_, i) => i !== idx));

  function handleGenerateInvoice() {
    if (!patientName.trim()) {
      toast.error("Enter patient name");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setInvoiceStep("invoice");
  }

  function handleMarkPaid() {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    const paid = !isPartial;
    const paidAmt = isPartial ? amountPaid : finalAmount;
    const dueAmt = isPartial ? finalAmount - amountPaid : 0;
    const rec: OtherPaymentRecord = {
      id: `other-${Date.now()}`,
      patientName: patientName.trim(),
      registerNumber: registerNumber.trim(),
      date,
      items: lines,
      subtotal,
      discountPct,
      finalAmount,
      receiptNumber: generateTypedReceiptNumber("OTH"),
      notes: notes.trim(),
      paymentMethod,
      amountPaid: paidAmt,
      dueAmount: dueAmt,
      invoiceState: isPartial ? "partial" : "paid",
    };
    saveOtherPayment(rec);
    const unified: MoneyReceiptData = {
      id: rec.id,
      receiptNumber: rec.receiptNumber,
      patientName: rec.patientName,
      registerNumber: rec.registerNumber,
      date: rec.date,
      type: "other",
      service: rec.items.map((i) => i.description).join(", "),
      amount: rec.finalAmount,
      discountRate: rec.discountPct,
      finalAmount: rec.finalAmount,
      paid,
      amountPaid: paidAmt,
      dueAmount: dueAmt,
      invoiceState: rec.invoiceState,
      paymentMethod,
      doctorName: currentDoctor
        ? `${currentDoctor.designation ?? ""} ${currentDoctor.name}`.trim()
        : "",
      notes: rec.notes,
    };
    saveReceiptToStore(unified);
    setSavedReceipt(rec);
    toast.success("Receipt generated");
  }

  function resetForm() {
    setPatientName("");
    setRegisterNumber("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setLines([]);
    setDiscountPct(0);
    setInvoiceStep("form");
    setPaymentMethod(undefined);
    setIsPartial(false);
    setAmountPaid(0);
    setSavedReceipt(null);
  }

  const [history, setHistory] = useState<OtherPaymentRecord[]>(() =>
    loadOtherPayments(),
  );
  const [showRefund, setShowRefund] = useState<string | null>(null);

  function handleRefund(recordId: string, refund: RefundRecord) {
    const all = loadOtherPayments();
    const idx = all.findIndex((r) => r.id === recordId);
    if (idx < 0) return;
    const rec = all[idx];
    const totalAmt = rec.finalAmount;
    const isFullRefund = refund.amount >= totalAmt;
    const updated: OtherPaymentRecord = {
      ...rec,
      invoiceState: isFullRefund ? "refunded" : "partial_refunded",
      refund,
    };
    all[idx] = updated;
    localStorage.setItem(OTHER_PAYMENTS_KEY, JSON.stringify(all));
    setHistory(all);
    setShowRefund(null);
    toast.success(
      `Refund of ৳${refund.amount.toLocaleString("en-BD")} recorded`,
    );
  }

  return (
    <div
      className="max-w-4xl mx-auto px-4 py-6 space-y-5"
      data-ocid="other_payment.page"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <PlusCircle className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Other Payment
          </h1>
          <p className="text-sm text-muted-foreground">
            Miscellaneous fees — admission, registration, bed charges, etc.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["new", "history", "advance"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              if (t === "new") resetForm();
              else if (t === "history") setHistory(loadOtherPayments());
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid={`other_payment.${t}.tab`}
          >
            {t === "new"
              ? "New Receipt"
              : t === "history"
                ? "History"
                : "Advance Deposit"}
          </button>
        ))}
      </div>

      {/* ── New receipt: form step ── */}
      {tab === "new" && !savedReceipt && invoiceStep === "form" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Patient Name *</Label>
              <Input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Full name"
                data-ocid="other_payment.patient.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Register No.</Label>
              <Input
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
                placeholder="0001/26"
                data-ocid="other_payment.reg.input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-ocid="other_payment.date.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                data-ocid="other_payment.notes.input"
              />
            </div>
          </div>

          {/* Quick add items */}
          <div>
            <Label className="mb-2 block">Quick Add</Label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_ITEMS.map((qi) => (
                <button
                  key={qi.description}
                  type="button"
                  onClick={() => addLine(qi.description, qi.amount)}
                  className="text-xs px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  data-ocid="other_payment.quick_item.button"
                >
                  + {qi.description} (৳{qi.amount})
                </button>
              ))}
            </div>
          </div>

          {/* Manual add */}
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-40 space-y-1.5">
              <Label>Description</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description of payment..."
                data-ocid="other_payment.desc.input"
              />
            </div>
            <div className="w-32 space-y-1.5">
              <Label>Amount (৳)</Label>
              <Input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
                data-ocid="other_payment.amount.input"
              />
            </div>
            <Button
              onClick={() =>
                addLine(newDesc, Number.parseFloat(newAmount) || 0)
              }
              className="gap-1.5"
              data-ocid="other_payment.add_button"
            >
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          {/* Line items */}
          {lines.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-32">
                      Amount (৳)
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr
                      key={`${l.description}-${i}`}
                      className="border-t border-border"
                      data-ocid={`other_payment.item.${i + 1}`}
                    >
                      <td className="px-3 py-2">{l.description}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {l.amount.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-red-400 hover:text-red-600"
                          data-ocid="other_payment.delete_button"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Discount + totals */}
          {lines.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) =>
                      setDiscountPct(Number.parseFloat(e.target.value) || 0)
                    }
                    className="w-24"
                    data-ocid="other_payment.discount.input"
                  />
                </div>
                <div className="space-y-0.5 text-sm">
                  <p className="text-muted-foreground">
                    Subtotal:{" "}
                    <span className="font-medium text-foreground">
                      ৳{subtotal.toLocaleString()}
                    </span>
                  </p>
                  {discountPct > 0 && (
                    <p className="text-red-600">
                      Discount ({discountPct}%): −৳
                      {discountAmt.toLocaleString()}
                    </p>
                  )}
                  <p className="text-lg font-bold text-foreground">
                    Final: ৳{finalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGenerateInvoice}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
                data-ocid="other_payment.submit_button"
              >
                <Receipt className="w-4 h-4" /> Generate Invoice →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── New receipt: invoice step ── */}
      {tab === "new" && !savedReceipt && invoiceStep === "invoice" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-amber-900 flex items-center gap-2">
                📄 Invoice Preview
              </h3>
              <button
                type="button"
                onClick={() => setInvoiceStep("form")}
                className="text-amber-600 text-xs hover:underline"
              >
                ← Edit
              </button>
            </div>
            <div className="text-sm text-amber-800 space-y-1 mb-3">
              <p>
                <strong>Patient:</strong> {patientName}
                {registerNumber && (
                  <span className="font-mono ml-2">({registerNumber})</span>
                )}
              </p>
            </div>
            <table className="w-full text-sm border border-amber-200 rounded overflow-hidden">
              <thead>
                <tr className="bg-amber-100 text-amber-800">
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-right px-3 py-2 w-32">Amount (৳)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr
                    key={`${l.description}-${i}`}
                    className="border-t border-amber-100"
                  >
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2 text-right">
                      {l.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50">
                  <td className="px-3 py-1.5 text-right text-gray-600">
                    Subtotal
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    ৳{subtotal.toLocaleString()}
                  </td>
                </tr>
                {discountPct > 0 && (
                  <tr className="text-red-600">
                    <td className="px-3 py-1.5 text-right">
                      Discount ({discountPct}%)
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      −৳{discountAmt.toLocaleString()}
                    </td>
                  </tr>
                )}
                <tr className="bg-amber-100 font-bold text-amber-900">
                  <td className="px-3 py-2 text-right">Total Due</td>
                  <td className="px-3 py-2 text-right">
                    ৳{finalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            ocidPrefix="other_payment"
          />
          <PartialPaymentFields
            total={finalAmount}
            amountPaid={amountPaid}
            onAmountPaidChange={setAmountPaid}
            isPartial={isPartial}
            onIsPartialChange={setIsPartial}
            ocidPrefix="other_payment"
          />
          <Button
            onClick={handleMarkPaid}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
            data-ocid="other_payment.mark_paid.button"
          >
            <CheckCircle2 className="w-4 h-4" /> Mark as Paid — Generate Receipt
          </Button>
        </div>
      )}

      {/* ── Receipt preview ── */}
      {tab === "new" && savedReceipt && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={resetForm}
              data-ocid="other_payment.cancel_button"
            >
              <X className="w-4 h-4" /> New Receipt
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.print()}
              data-ocid="other_payment.print_button"
            >
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
          <div
            ref={printRef}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 print:shadow-none"
          >
            <div className="text-center border-b border-gray-200 pb-3">
              <h2 className="font-black text-lg text-gray-900">
                Dr. Arman Kabir&apos;s Care
              </h2>
              <p className="text-xs text-gray-500">
                Miscellaneous Payment Receipt
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Patient:</span>{" "}
                <span className="font-medium">{savedReceipt.patientName}</span>
              </div>
              <div>
                <span className="text-gray-500">Reg No:</span>{" "}
                <span className="font-mono">
                  {savedReceipt.registerNumber || "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Date:</span> {savedReceipt.date}
              </div>
              <div>
                <span className="text-gray-500">Receipt:</span>{" "}
                <span className="font-mono">{savedReceipt.receiptNumber}</span>
              </div>
              {savedReceipt.paymentMethod && (
                <div>
                  <span className="text-gray-500">Payment:</span>{" "}
                  <span className="font-medium">
                    {
                      {
                        cash: "Cash",
                        bkash: "bKash",
                        nagad: "Nagad",
                        card: "Card",
                      }[savedReceipt.paymentMethod]
                    }
                  </span>
                </div>
              )}
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-amber-50">
                  <th className="border border-gray-200 px-3 py-1.5 text-left">
                    Description
                  </th>
                  <th className="border border-gray-200 px-3 py-1.5 text-right w-32">
                    Amount (৳)
                  </th>
                </tr>
              </thead>
              <tbody>
                {savedReceipt.items.map((item, i) => (
                  <tr
                    key={`${item.description}-${i}`}
                    className="border-t border-gray-100"
                  >
                    <td className="border border-gray-100 px-3 py-1.5">
                      {item.description}
                    </td>
                    <td className="border border-gray-100 px-3 py-1.5 text-right">
                      {item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-1.5 text-right font-medium">
                    Subtotal
                  </td>
                  <td className="border border-gray-200 px-3 py-1.5 text-right">
                    ৳{savedReceipt.subtotal.toLocaleString()}
                  </td>
                </tr>
                {savedReceipt.discountPct > 0 && (
                  <tr className="text-red-600">
                    <td className="border border-gray-200 px-3 py-1.5 text-right">
                      Discount ({savedReceipt.discountPct}%)
                    </td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right">
                      −৳
                      {(
                        (savedReceipt.subtotal * savedReceipt.discountPct) /
                        100
                      ).toLocaleString()}
                    </td>
                  </tr>
                )}
                {savedReceipt.invoiceState === "partial" && (
                  <>
                    <tr className="text-emerald-700">
                      <td className="border border-gray-200 px-3 py-1.5 text-right">
                        Amount Paid
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right">
                        ৳{(savedReceipt.amountPaid ?? 0).toLocaleString()}
                      </td>
                    </tr>
                    <tr className="text-amber-700 font-bold">
                      <td className="border border-gray-200 px-3 py-1.5 text-right">
                        Balance Due
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right">
                        ৳{(savedReceipt.dueAmount ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  </>
                )}
                <tr className="bg-amber-50 font-bold">
                  <td className="border border-gray-200 px-3 py-2 text-right">
                    Total
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right text-amber-800">
                    ৳{savedReceipt.finalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
            {savedReceipt.notes && (
              <p className="text-xs text-gray-500 italic">
                Notes: {savedReceipt.notes}
              </p>
            )}
            <div className="flex justify-center pt-2">
              <InvoiceStateBadge state={savedReceipt.invoiceState ?? "paid"} />
            </div>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div
              className="bg-card border border-border rounded-2xl p-10 text-center"
              data-ocid="other_payment.empty_state"
            >
              <Receipt className="w-9 h-9 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No receipts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a receipt from the New Receipt tab.
              </p>
            </div>
          ) : (
            history.map((r, i) => {
              const isRefunded =
                r.invoiceState === "refunded" ||
                r.invoiceState === "partial_refunded";
              const canRefund =
                !isRefunded &&
                (r.invoiceState === "paid" || r.invoiceState === "partial");
              return (
                <div
                  key={r.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4"
                  data-ocid={`other_payment.item.${i + 1}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {r.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.receiptNumber} · {r.date}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.items.length} item(s)
                      {r.paymentMethod && (
                        <span className="ml-2 capitalize">
                          · {r.paymentMethod}
                        </span>
                      )}
                    </p>
                    {r.dueAmount && r.dueAmount > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        Balance Due: ৳{r.dueAmount.toLocaleString()}
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        {r.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-lg text-foreground">
                      ৳{r.finalAmount.toLocaleString()}
                    </p>
                    <div className="mt-1">
                      {isRefunded ? (
                        <Badge
                          variant="outline"
                          className="bg-rose-50 text-rose-700 border-rose-200 text-xs"
                        >
                          Refunded
                        </Badge>
                      ) : r.invoiceState === "partial" ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                        >
                          Partial
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Paid
                        </Badge>
                      )}
                    </div>
                    {canRefund && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-7 px-2 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => setShowRefund(r.id)}
                        data-ocid={`other_payment.refund.${i + 1}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Refund
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Advance tab */}
      {tab === "advance" && <AdvancePaymentView />}

      {showRefund && (
        <RefundDialog
          maxAmount={
            history.find((r) => r.id === showRefund)?.amountPaid ??
            history.find((r) => r.id === showRefund)?.finalAmount ??
            0
          }
          onConfirm={(refund) => handleRefund(showRefund, refund)}
          onCancel={() => setShowRefund(null)}
        />
      )}
    </div>
  );
}
