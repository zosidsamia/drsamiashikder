/**
 * AppointmentPayment — Full-page appointment billing management.
 * Green theme. Fee settings per doctor + appointment type, receipt generation,
 * date/doctor/status filters with payment method tracking.
 */
import { Badge } from "@/components/ui/badge";
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
  BanknoteIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Filter,
  MessageCircle,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  InvoiceStateBadge,
  PartialPaymentFields,
  RefundDialog,
  generateTypedReceiptNumber,
  saveReceiptToStore,
  sendReceiptWhatsApp,
} from "../components/MoneyReceipt";
import type {
  InvoiceState,
  MoneyReceiptData,
  PaymentMethod,
  RefundRecord,
} from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const APT_PAYMENTS_KEY = "appointmentPayments";
const APT_RATES_KEY = "appointment_rates";

export const APPOINTMENT_TYPES = [
  "New Patient",
  "Follow-up",
  "Urgent",
  "Emergency",
  "Teleconsult",
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: "Cash", value: "cash" },
  { label: "bKash", value: "bkash" },
  { label: "Nagad", value: "nagad" },
  { label: "Card", value: "card" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppointmentRate {
  id: string;
  doctorName: string;
  doctorId?: string;
  appointmentType: AppointmentType;
  fee: number;
}

interface AppointmentPaymentRecord {
  id: string;
  patientName: string;
  registerNumber: string;
  date: string;
  doctor: string;
  appointmentType: AppointmentType;
  chamber: string;
  fee: number;
  paymentMethod?: PaymentMethod;
  status: "paid" | "unpaid" | "partial";
  receiptId?: string;
  partialAmount?: number;
}

// ── Storage helpers ────────────────────────────────────────────────────────────

function loadPayments(): AppointmentPaymentRecord[] {
  try {
    return JSON.parse(localStorage.getItem(APT_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePayments(data: AppointmentPaymentRecord[]) {
  localStorage.setItem(APT_PAYMENTS_KEY, JSON.stringify(data));
}

function loadRates(): AppointmentRate[] {
  try {
    return JSON.parse(localStorage.getItem(APT_RATES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRates(data: AppointmentRate[]) {
  localStorage.setItem(APT_RATES_KEY, JSON.stringify(data));
}

function findRate(
  rates: AppointmentRate[],
  doctor: string,
  apptType: AppointmentType,
): number | null {
  const match = rates.find(
    (r) =>
      r.doctorName.toLowerCase() === doctor.toLowerCase() &&
      r.appointmentType === apptType,
  );
  return match ? match.fee : null;
}

// Default sample payments
const DEFAULT_PAYMENTS: AppointmentPaymentRecord[] = [
  {
    id: "apt-001",
    patientName: "Rahima Begum",
    registerNumber: "0012/26",
    date: new Date().toISOString().split("T")[0],
    doctor: "Dr. Arman Kabir",
    appointmentType: "New Patient",
    chamber: "University Dental College, Dhaka",
    fee: 800,
    paymentMethod: "cash",
    status: "paid",
  },
  {
    id: "apt-002",
    patientName: "Karim Uddin",
    registerNumber: "0021/26",
    date: new Date().toISOString().split("T")[0],
    doctor: "Dr. Samia Shikder",
    appointmentType: "Follow-up",
    chamber: "Moghbazar Chamber",
    fee: 500,
    paymentMethod: "bkash",
    status: "unpaid",
  },
  {
    id: "apt-003",
    patientName: "Nasreen Akter",
    registerNumber: "0035/26",
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    doctor: "Dr. Arman Kabir",
    appointmentType: "Urgent",
    chamber: "University Dental College, Dhaka",
    fee: 1000,
    paymentMethod: "nagad",
    status: "partial",
    partialAmount: 500,
  },
];

// ── Receipt Print Doc ──────────────────────────────────────────────────────────

function AppointmentReceiptDoc({
  receipt,
  printRef,
}: {
  receipt: ExtendedReceipt;
  printRef: React.RefObject<HTMLDivElement>;
}) {
  const formatted = new Date(receipt.date).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
            }}
          >
            PAID
          </span>
        </div>
      )}
      <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center text-white font-black text-lg">
            A
          </div>
          <div>
            <h1 className="font-black text-xl text-gray-900">
              Dr. Arman Kabir's Care
            </h1>
            <p className="text-xs text-gray-600">
              Patient Management & Clinical Portal
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          University Dental College & Hospital, Moghbazar, Dhaka
        </p>
      </div>
      <div className="text-center mb-5">
        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-widest">
          Appointment Receipt
        </h2>
        <p className="text-sm text-gray-500">অ্যাপয়েন্টমেন্ট রসিদ</p>
      </div>
      <div className="flex justify-between text-xs text-gray-600 mb-5">
        <div>
          <span className="font-semibold">Receipt No: </span>
          <span className="font-mono">{receipt.receiptNumber}</span>
        </div>
        <div className="text-right">
          <span className="font-semibold">Date: </span>
          <span>{formatted}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
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
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Doctor / ডাক্তার</p>
          <p className="font-semibold text-gray-800">
            {receipt.doctorName || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Type / ধরন</p>
          <p className="font-semibold text-gray-800">
            {receipt.appointmentType ?? receipt.service}
          </p>
        </div>
        {receipt.paymentMethod && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Payment / পেমেন্ট</p>
            <p className="font-semibold text-gray-800">
              {PAYMENT_METHODS.find((m) => m.value === receipt.paymentMethod)
                ?.label ?? receipt.paymentMethod}
            </p>
          </div>
        )}
      </div>
      <div className="border-2 border-gray-800 rounded-lg p-4 mb-5">
        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 text-center">
          Consultation Fee / পরামর্শ ফি
        </p>
        {receipt.invoiceState === "partial" && receipt.dueAmount != null ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Billed</span>
              <span className="font-semibold">
                ৳{receipt.amount.toLocaleString("en-BD")}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Amount Paid</span>
              <span className="font-bold">
                ৳{(receipt.amountPaid ?? 0).toLocaleString("en-BD")}
              </span>
            </div>
            <div className="flex justify-between text-amber-700 font-bold border-t border-gray-300 pt-1">
              <span>Balance Due</span>
              <span>৳{receipt.dueAmount.toLocaleString("en-BD")}</span>
            </div>
          </div>
        ) : (
          <p className="text-3xl font-black text-gray-900 text-center">
            ৳ {receipt.amount.toLocaleString("en-BD")}
          </p>
        )}
        <div className="mt-3 text-center">
          <InvoiceStateBadge state={receipt.invoiceState} />
        </div>
      </div>
      {receipt.refund && (
        <div className="bg-rose-50 border border-rose-200 rounded p-2 mb-4 text-xs text-rose-700">
          <p className="font-semibold">
            Refund: ৳{receipt.refund.amount.toLocaleString("en-BD")}
          </p>
          <p>Reason: {receipt.refund.reason.replace("_", " ")}</p>
        </div>
      )}
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
        Computer-generated receipt — Dr. Arman Kabir's Care
      </p>
    </div>
  );
}

// ── Receipt Modal ──────────────────────────────────────────────────────────────

type ExtendedReceipt = MoneyReceiptData & {
  appointmentType?: string;
  invoiceState?: InvoiceState;
};

function ReceiptModal({
  receipt: initial,
  onClose,
}: {
  receipt: ExtendedReceipt;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState(initial);
  const printRef = useRef<HTMLDivElement>(null!);
  const [saving, setSaving] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [isPartial, setIsPartial] = useState(
    initial.invoiceState === "partial",
  );
  const [amountPaid, setAmountPaid] = useState(
    initial.amountPaid ?? initial.amount ?? 0,
  );

  const totalAmount = receipt.finalAmount ?? receipt.amount ?? 0;
  const isInvoiceStep = receipt.invoiceState === "invoice";
  const isRefunded =
    receipt.invoiceState === "refunded" ||
    receipt.invoiceState === "partial_refunded";

  function handleMarkPaid() {
    if (!receipt.paymentMethod) {
      toast.error("Payment method required");
      return;
    }
    const paid = !isPartial;
    const paidAmt = isPartial ? amountPaid : totalAmount;
    const dueAmt = isPartial ? totalAmount - amountPaid : 0;
    const updated: ExtendedReceipt = {
      ...receipt,
      paid,
      amountPaid: paidAmt,
      dueAmount: dueAmt,
      invoiceState: isPartial ? "partial" : "paid",
    };
    setReceipt(updated);
    saveReceiptToStore(updated);
    toast.success(`Receipt saved — ${updated.receiptNumber}`);
  }

  function handleRefund(refund: RefundRecord) {
    const isFullRefund = refund.amount >= totalAmount;
    const updated: ExtendedReceipt = {
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

  function handlePrint() {
    saveReceiptToStore(receipt);
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
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `apt-receipt-${receipt.receiptNumber}.png`;
      link.click();
      saveReceiptToStore(receipt);
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Could not generate download. Use Print instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>
        {
          "@media print { body > *:not(#apt-receipt-root){display:none!important} #apt-receipt-root{display:block!important;position:fixed;inset:0;z-index:9999;background:white} .apt-no-print{display:none!important} }"
        }
      </style>

      {showRefund && (
        <RefundDialog
          maxAmount={receipt.amountPaid ?? totalAmount}
          onConfirm={handleRefund}
          onCancel={() => setShowRefund(false)}
        />
      )}

      <dialog
        open
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 apt-no-print border-0 max-w-none w-full h-full m-0"
        aria-label="Appointment Receipt"
      >
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border apt-no-print">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-600" />
              {isInvoiceStep
                ? "Invoice — Pending Payment"
                : "Appointment Receipt"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              data-ocid="apt_receipt.close_button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {isInvoiceStep && (
              <div className="space-y-3 apt-no-print">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  📄 Review invoice then select payment method and click{" "}
                  <strong>Mark as Paid</strong>.
                </div>
                <PartialPaymentFields
                  total={totalAmount}
                  amountPaid={amountPaid}
                  onAmountPaidChange={setAmountPaid}
                  isPartial={isPartial}
                  onIsPartialChange={setIsPartial}
                  ocidPrefix="apt_receipt"
                />
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={handleMarkPaid}
                  data-ocid="apt_receipt.mark_paid.button"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Paid — Generate Receipt
                </Button>
              </div>
            )}
            <div id="apt-receipt-root">
              <AppointmentReceiptDoc receipt={receipt} printRef={printRef} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border apt-no-print">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-ocid="apt_receipt.cancel_button"
              >
                Close
              </Button>
              {receipt.phone && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => sendReceiptWhatsApp(receipt)}
                  data-ocid="apt_receipt.whatsapp_button"
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
                    data-ocid="apt_receipt.refund_button"
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
                data-ocid="apt_receipt.download_button"
              >
                <Download className="w-4 h-4" />
                {saving ? "Generating…" : "Download"}
              </Button>
              <Button
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={handlePrint}
                data-ocid="apt_receipt.print_button"
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

// ── Fee Settings Panel ─────────────────────────────────────────────────────────

function FeeSettingsPanel({
  rates,
  onChange,
}: {
  rates: AppointmentRate[];
  onChange: (r: AppointmentRate[]) => void;
}) {
  const [newDoctor, setNewDoctor] = useState("");
  const [newType, setNewType] = useState<AppointmentType>("New Patient");
  const [newFee, setNewFee] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editFee, setEditFee] = useState("");

  function addRate() {
    if (!newDoctor.trim() || !newFee) {
      toast.error("Doctor name and fee required");
      return;
    }
    const duplicate = rates.find(
      (r) =>
        r.doctorName.toLowerCase() === newDoctor.trim().toLowerCase() &&
        r.appointmentType === newType,
    );
    if (duplicate) {
      toast.error(
        `Rate for ${newDoctor} – ${newType} already exists. Delete it first.`,
      );
      return;
    }
    const updated: AppointmentRate[] = [
      ...rates,
      {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        doctorName: newDoctor.trim(),
        appointmentType: newType,
        fee: Number(newFee),
      },
    ];
    onChange(updated);
    saveRates(updated);
    setNewDoctor("");
    setNewFee("");
    toast.success("Fee rate added");
  }

  function deleteRate(id: string) {
    const updated = rates.filter((r) => r.id !== id);
    onChange(updated);
    saveRates(updated);
  }

  function saveEdit(id: string) {
    const updated = rates.map((r) =>
      r.id === id ? { ...r, fee: Number(editFee) } : r,
    );
    onChange(updated);
    saveRates(updated);
    setEditId(null);
    toast.success("Fee updated");
  }

  // Group by doctor
  const byDoctor = rates.reduce<Record<string, AppointmentRate[]>>((acc, r) => {
    if (!acc[r.doctorName]) acc[r.doctorName] = [];
    acc[r.doctorName].push(r);
    return acc;
  }, {});

  return (
    <div
      className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-4"
      data-ocid="apt_payment.fee_settings.panel"
    >
      <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
        <Settings2 className="w-4 h-4" /> Appointment Fee Settings
        <span className="text-xs font-normal text-green-700">
          — per Doctor per Appointment Type
        </span>
      </p>

      {/* Add new rate */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input
          placeholder="Doctor name"
          value={newDoctor}
          onChange={(e) => setNewDoctor(e.target.value)}
          className="h-8 text-sm"
          data-ocid="apt_payment.fee_doctor.input"
        />
        <Select
          value={newType}
          onValueChange={(v) => setNewType(v as AppointmentType)}
        >
          <SelectTrigger
            className="h-8 text-sm"
            data-ocid="apt_payment.fee_type.select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Fee (৳)"
            value={newFee}
            onChange={(e) => setNewFee(e.target.value)}
            className="flex-1 h-8 text-sm"
            data-ocid="apt_payment.fee_amount.input"
          />
          <Button
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700 text-white px-3 shrink-0"
            onClick={addRate}
            data-ocid="apt_payment.add_fee.button"
          >
            Add
          </Button>
        </div>
      </div>

      {/* Rate table grouped by doctor */}
      {Object.keys(byDoctor).length > 0 && (
        <div className="rounded-xl border border-green-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-green-100 border-b border-green-200">
                <th className="text-left px-3 py-2 font-semibold text-green-800">
                  Doctor
                </th>
                <th className="text-left px-3 py-2 font-semibold text-green-800">
                  Appointment Type
                </th>
                <th className="text-right px-3 py-2 font-semibold text-green-800">
                  Fee (৳)
                </th>
                <th className="text-right px-3 py-2 font-semibold text-green-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byDoctor).flatMap(([doctor, doctorRates], di) =>
                doctorRates.map((r, ri) => (
                  <tr
                    key={r.id}
                    className="border-b border-green-100 last:border-0 bg-card hover:bg-green-50/50"
                    data-ocid={`apt_payment.fee_item.${di * 10 + ri + 1}`}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {ri === 0 ? doctor : ""}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.appointmentType}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editId === r.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            type="number"
                            value={editFee}
                            onChange={(e) => setEditFee(e.target.value)}
                            className="w-20 h-6 text-xs"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="text-green-700 font-semibold text-xs hover:underline"
                            onClick={() => saveEdit(r.id)}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="font-bold text-green-700">
                          ৳ {r.fee.toLocaleString("en-BD")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(r.id);
                            setEditFee(String(r.fee));
                          }}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          aria-label="Edit fee"
                          data-ocid={`apt_payment.fee_edit.${di * 10 + ri + 1}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRate(r.id)}
                          className="text-destructive hover:bg-destructive/10 p-0.5 rounded"
                          aria-label="Delete fee"
                          data-ocid={`apt_payment.fee_delete.${di * 10 + ri + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {rates.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No fee rates yet. Add one above.
        </p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AppointmentPayment() {
  const [payments, setPayments] = useState<AppointmentPaymentRecord[]>(() => {
    const saved = loadPayments();
    if (saved.length === 0) {
      savePayments(DEFAULT_PAYMENTS);
      return DEFAULT_PAYMENTS;
    }
    return saved;
  });
  const [rates, setRates] = useState<AppointmentRate[]>(() => loadRates());
  const [showFeePanel, setShowFeePanel] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewingReceipt, setViewingReceipt] = useState<ExtendedReceipt | null>(
    null,
  );

  // Add payment dialog
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPatient, setNewPatient] = useState("");
  const [newRegNo, setNewRegNo] = useState("");
  const [newDoctor, setNewDoctor] = useState("");
  const [newChamber, setNewChamber] = useState("");
  const [newApptType, setNewApptType] =
    useState<AppointmentType>("New Patient");
  const [newFeeAmt, setNewFeeAmt] = useState("");
  const [newPayMethod, setNewPayMethod] = useState<PaymentMethod>("cash");
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Auto-fill fee when doctor or type changes
  function autoFillFee(doctor: string, apptType: AppointmentType) {
    const found = findRate(rates, doctor, apptType);
    if (found !== null) setNewFeeAmt(String(found));
  }

  function getStatusBadge(status: AppointmentPaymentRecord["status"]) {
    if (status === "paid")
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
          Paid
        </Badge>
      );
    if (status === "partial")
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
          Partial
        </Badge>
      );
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
        Unpaid
      </Badge>
    );
  }

  function handleGenerateReceipt(apt: AppointmentPaymentRecord) {
    const receipt: ExtendedReceipt = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      receiptNumber: generateTypedReceiptNumber("APT"),
      type: "appointment",
      patientName: apt.patientName,
      registerNumber: apt.registerNumber,
      doctorName: apt.doctor,
      service: apt.appointmentType,
      amount: apt.fee,
      finalAmount: apt.fee,
      paid: apt.status === "paid",
      invoiceState: apt.status === "paid" ? "paid" : "invoice",
      date: new Date(apt.date).toISOString(),
      paymentMethod: apt.paymentMethod,
      appointmentType: apt.appointmentType,
    };
    saveReceiptToStore(receipt);
    setViewingReceipt(receipt);
  }

  function addPaymentEntry() {
    if (!newPatient.trim() || !newDoctor.trim() || !newFeeAmt) {
      toast.error("Patient name, doctor, and fee are required.");
      return;
    }
    const autoFee = findRate(rates, newDoctor, newApptType);
    const entry: AppointmentPaymentRecord = {
      id: `apt-${Date.now()}`,
      patientName: newPatient.trim(),
      registerNumber: newRegNo.trim(),
      date: newDate,
      doctor: newDoctor.trim(),
      appointmentType: newApptType,
      chamber: newChamber.trim() || "—",
      fee: autoFee !== null ? autoFee : Number(newFeeAmt),
      paymentMethod: newPayMethod,
      status: "unpaid",
    };
    const updated = [entry, ...payments];
    savePayments(updated);
    setPayments(updated);
    setShowAddForm(false);
    setNewPatient("");
    setNewRegNo("");
    setNewDoctor("");
    setNewChamber("");
    setNewFeeAmt("");
    toast.success("Appointment entry added");
  }

  const doctors = [...new Set(payments.map((p) => p.doctor))];
  const today = new Date().toISOString().split("T")[0];

  const filtered = payments.filter((p) => {
    if (filterDate && !p.date.startsWith(filterDate)) return false;
    if (filterDoctor !== "all" && p.doctor !== filterDoctor) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  const todayPayments = payments.filter((p) => p.date.startsWith(today));
  const totalToday = todayPayments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.fee, 0);
  const pendingToday = todayPayments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.fee, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-green-50 border-b border-green-200 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-green-600 font-medium mb-0.5">
                Payment / পেমেন্ট
              </p>
              <h1 className="text-xl font-bold text-green-900 flex items-center gap-2">
                <BanknoteIcon className="w-5 h-5 text-green-600" /> Appointment
                Payment
              </h1>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100 text-sm h-8"
                onClick={() => setShowFeePanel((v) => !v)}
                data-ocid="apt_payment.fee_settings.toggle"
              >
                <Settings2 className="w-3.5 h-3.5" /> Fee Settings
                {showFeePanel ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-sm h-8"
                onClick={() => setShowAddForm((v) => !v)}
                data-ocid="apt_payment.add_entry.button"
              >
                + Add Entry
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl border border-green-200 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Collected
              Today
            </p>
            <p className="text-2xl font-black text-green-600">
              ৳ {totalToday.toLocaleString("en-BD")}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending Today
            </p>
            <p className="text-2xl font-black text-amber-500">
              ৳ {pendingToday.toLocaleString("en-BD")}
            </p>
          </div>
        </div>

        {/* Fee Settings panel */}
        {showFeePanel && <FeeSettingsPanel rates={rates} onChange={setRates} />}

        {/* Add Entry form */}
        {showAddForm && (
          <div className="bg-card rounded-xl border border-green-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              New Appointment Entry
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Patient Name *</Label>
                <Input
                  placeholder="Patient name"
                  value={newPatient}
                  onChange={(e) => setNewPatient(e.target.value)}
                  className="h-8 text-sm"
                  data-ocid="apt_payment.new_patient.input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Register No.</Label>
                <Input
                  placeholder="0001/26"
                  value={newRegNo}
                  onChange={(e) => setNewRegNo(e.target.value)}
                  className="h-8 text-sm font-mono"
                  data-ocid="apt_payment.new_regno.input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Doctor *</Label>
                <Input
                  placeholder="Dr. name"
                  value={newDoctor}
                  onChange={(e) => {
                    setNewDoctor(e.target.value);
                    autoFillFee(e.target.value, newApptType);
                  }}
                  className="h-8 text-sm"
                  data-ocid="apt_payment.new_doctor.input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Appointment Type *</Label>
                <Select
                  value={newApptType}
                  onValueChange={(v) => {
                    const t = v as AppointmentType;
                    setNewApptType(t);
                    autoFillFee(newDoctor, t);
                  }}
                >
                  <SelectTrigger
                    className="h-8 text-sm"
                    data-ocid="apt_payment.new_type.select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chamber</Label>
                <Input
                  placeholder="Chamber or Hospital"
                  value={newChamber}
                  onChange={(e) => setNewChamber(e.target.value)}
                  className="h-8 text-sm"
                  data-ocid="apt_payment.new_chamber.input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fee (৳) *</Label>
                <Input
                  type="number"
                  placeholder="Auto-fill from rate list"
                  value={newFeeAmt}
                  onChange={(e) => setNewFeeAmt(e.target.value)}
                  className="h-8 text-sm"
                  data-ocid="apt_payment.new_fee.input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={newPayMethod}
                  onValueChange={(v) => setNewPayMethod(v as PaymentMethod)}
                >
                  <SelectTrigger
                    className="h-8 text-sm"
                    data-ocid="apt_payment.new_method.select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 text-sm"
                  data-ocid="apt_payment.new_date.input"
                />
              </div>
            </div>
            {newDoctor &&
              newApptType &&
              findRate(rates, newDoctor, newApptType) !== null && (
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Fee auto-filled from rate list: ৳{" "}
                  {findRate(rates, newDoctor, newApptType)?.toLocaleString(
                    "en-BD",
                  )}
                </p>
              )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                data-ocid="apt_payment.add_entry_cancel.button"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={addPaymentEntry}
                data-ocid="apt_payment.add_entry_save.button"
              >
                Save Entry
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-8 text-sm w-36"
              data-ocid="apt_payment.filter_date.input"
            />
            <Select value={filterDoctor} onValueChange={setFilterDoctor}>
              <SelectTrigger
                className="h-8 text-sm w-48"
                data-ocid="apt_payment.filter_doctor.select"
              >
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className="h-8 text-sm w-36"
                data-ocid="apt_payment.filter_status.select"
              >
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            {(filterDate ||
              filterDoctor !== "all" ||
              filterStatus !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground gap-1"
                onClick={() => {
                  setFilterDate("");
                  setFilterDoctor("all");
                  setFilterStatus("all");
                }}
                data-ocid="apt_payment.clear_filters.button"
              >
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center"
            data-ocid="apt_payment.empty_state"
          >
            <BanknoteIcon className="w-10 h-10 opacity-30" />
            <p className="font-semibold">No appointments found</p>
            <p className="text-sm">Add an entry or adjust filters.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-green-50 px-4 py-2.5 border-b border-green-200">
              <p className="text-sm font-semibold text-green-900">
                {filtered.length} appointment{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Patient
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                      Date
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                      Doctor
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      Type
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      Method
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Fee (৳)
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((apt, idx) => (
                    <tr
                      key={apt.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      data-ocid={`apt_payment.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {apt.patientName}
                        </p>
                        {apt.registerNumber && (
                          <p className="text-xs font-mono text-muted-foreground">
                            {apt.registerNumber}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(apt.date).toLocaleDateString("en-BD", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground hidden md:table-cell">
                        {apt.doctor}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {apt.appointmentType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {apt.paymentMethod
                          ? (PAYMENT_METHODS.find(
                              (m) => m.value === apt.paymentMethod,
                            )?.label ?? apt.paymentMethod)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        ৳ {apt.fee.toLocaleString("en-BD")}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(apt.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handleGenerateReceipt(apt)}
                          data-ocid={`apt_payment.generate_receipt.${idx + 1}`}
                        >
                          <Receipt className="w-3 h-3" /> Receipt
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {viewingReceipt && (
        <ReceiptModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}
