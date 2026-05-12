/**
 * WalkInInvestigationForm — Accepts investigation requests from ANY person.
 * No prior patient registration needed. Generates a full investigation receipt.
 */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  FlaskConical,
  MessageCircle,
  Receipt,
  Search,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  InvestigationLineItem,
  MoneyReceiptData,
  PaymentMethod,
} from "../types";
import { loadInvestigationRates } from "./InvestigationPayment";
import {
  PartialPaymentFields,
  PaymentMethodSelector,
  generateTypedReceiptNumber,
  saveReceiptToStore,
  sendReceiptWhatsApp,
} from "./MoneyReceipt";
import WalkInReceiptModal from "./WalkInReceiptModal";

// ── Today ISO ────────────────────────────────────────────────────────────────────
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  doctorName?: string;
}

// ── Component ────────────────────────────────────────────────────────────────────
export default function WalkInInvestigationForm({ doctorName }: Props) {
  const rates = loadInvestigationRates();

  // Patient fields
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState<"Male" | "Female" | "Other">(
    "Male",
  );
  const [investigationDate, setInvestigationDate] = useState(todayIso());
  const [reportDeliveryDate, setReportDeliveryDate] = useState("");
  const [phone, setPhone] = useState("");
  const [doctorField, setDoctorField] = useState(doctorName ?? "");
  const [testSearch, setTestSearch] = useState("");

  // Test selection
  const [selected, setSelected] = useState<
    Record<string, { checked: boolean; qty: number }>
  >(() =>
    Object.fromEntries(rates.map((r) => [r.id, { checked: false, qty: 1 }])),
  );

  // Pricing
  const [discountRate, setDiscountRate] = useState(0);
  const [finalOverride, setFinalOverride] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    undefined,
  );
  const [isPartial, setIsPartial] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);

  // Step & receipt
  const [step, setStep] = useState<"form" | "invoice" | "done">("form");
  const [receipt, setReceipt] = useState<MoneyReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const checkedRates = rates.filter((r) => selected[r.id]?.checked);
  const filteredRates = testSearch.trim()
    ? rates.filter((r) =>
        r.name.toLowerCase().includes(testSearch.toLowerCase()),
      )
    : rates;
  const subtotal = checkedRates.reduce(
    (sum, r) => sum + r.rate * (selected[r.id]?.qty ?? 1),
    0,
  );
  const autoFinal = Math.round(subtotal * (1 - discountRate / 100));
  const finalAmount = finalOverride !== "" ? Number(finalOverride) : autoFinal;

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

  function validateForm(): boolean {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return false;
    }
    if (!patientAge || Number(patientAge) <= 0) {
      toast.error("Valid age is required");
      return false;
    }
    if (!investigationDate) {
      toast.error("Investigation date is required");
      return false;
    }
    if (!reportDeliveryDate) {
      toast.error("Report delivery date is required");
      return false;
    }
    if (new Date(reportDeliveryDate) < new Date(investigationDate)) {
      toast.error(
        "Report delivery date must be on or after investigation date",
      );
      return false;
    }
    if (checkedRates.length === 0) {
      toast.error("Select at least one test");
      return false;
    }
    return true;
  }

  function handleProceedToInvoice() {
    if (!validateForm()) return;
    setStep("invoice");
  }

  function handleGenerateReceipt() {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    const investigations: InvestigationLineItem[] = checkedRates.map((r) => {
      const qty = selected[r.id]?.qty ?? 1;
      return { name: r.name, qty, unitRate: r.rate, amount: r.rate * qty };
    });
    const paid = !isPartial;
    const paidAmt = isPartial ? amountPaid : finalAmount;
    const dueAmt = isPartial ? finalAmount - amountPaid : 0;
    const r: MoneyReceiptData = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      receiptNumber: generateTypedReceiptNumber("INV"),
      type: "investigation",
      patientName: patientName.trim(),
      patientAge: Number(patientAge),
      patientSex,
      phone: phone.trim() || undefined,
      doctorName: doctorField.trim() || undefined,
      service: investigations.map((i) => i.name).join(", "),
      amount: finalAmount,
      finalAmount,
      discountRate,
      paid,
      amountPaid: paidAmt,
      dueAmount: dueAmt,
      invoiceState: isPartial ? "partial" : "paid",
      paymentMethod,
      date: new Date().toISOString(),
      investigationDate,
      reportDeliveryDate,
      investigations,
    };
    saveReceiptToStore(r);
    setReceipt(r);
    setStep("done");
    setShowReceiptModal(true);
    toast.success(`Receipt ${r.receiptNumber} generated`);
  }

  function handleReset() {
    setPatientName("");
    setPatientAge("");
    setPatientSex("Male");
    setInvestigationDate(todayIso());
    setReportDeliveryDate("");
    setPhone("");
    setDoctorField(doctorName ?? "");
    setSelected(
      Object.fromEntries(rates.map((r) => [r.id, { checked: false, qty: 1 }])),
    );
    setDiscountRate(0);
    setFinalOverride("");
    setPaymentMethod(undefined);
    setIsPartial(false);
    setAmountPaid(0);
    setStep("form");
    setReceipt(null);
    setShowReceiptModal(false);
    setTestSearch("");
  }

  if (rates.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 text-center bg-card border border-border rounded-2xl"
        data-ocid="walkin_inv.no_rates.empty_state"
      >
        <FlaskConical className="w-10 h-10 opacity-30" />
        <p className="font-semibold">No investigation rates configured</p>
        <p className="text-sm">
          Ask the admin to add rates in Settings → Investigation Rates.
        </p>
      </div>
    );
  }

  // ── Success step ──
  if (step === "done" && receipt) {
    return (
      <>
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3"
          data-ocid="walkin_inv.success.section"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <p className="font-bold text-emerald-800 text-lg">
            Receipt Generated!
          </p>
          <p className="text-sm text-emerald-700">
            {receipt.receiptNumber} · {receipt.patientName} ·{" "}
            {receipt.patientAge}y
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setShowReceiptModal(true)}
              data-ocid="walkin_inv.view_receipt.button"
            >
              <Receipt className="w-4 h-4" /> View &amp; Print Receipt
            </Button>
            {receipt.phone && (
              <Button
                variant="outline"
                className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => sendReceiptWhatsApp(receipt)}
                data-ocid="walkin_inv.whatsapp.button"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleReset}
              data-ocid="walkin_inv.new_request.button"
            >
              + New Request
            </Button>
          </div>
        </div>
        {showReceiptModal && (
          <WalkInReceiptModal
            receipt={receipt}
            onClose={() => setShowReceiptModal(false)}
          />
        )}
      </>
    );
  }

  // ── Invoice step ──
  if (step === "invoice") {
    return (
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden"
        data-ocid="walkin_inv.invoice.section"
      >
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Invoice Preview
          </h3>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="text-white/80 hover:text-white text-sm underline-offset-2 hover:underline"
          >
            ← Edit
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Patient summary */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-muted/30 rounded-xl p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Patient</p>
              <p className="font-semibold">{patientName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Age / Sex</p>
              <p className="font-semibold">
                {patientAge}y ·{" "}
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                    patientSex === "Male"
                      ? "bg-blue-100 text-blue-700"
                      : patientSex === "Female"
                        ? "bg-pink-100 text-pink-700"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {patientSex}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Investigation Date
              </p>
              <p className="font-semibold">
                {new Date(investigationDate).toLocaleDateString("en-BD", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Report Delivery
              </p>
              <p className="font-semibold text-purple-700">
                {new Date(reportDeliveryDate).toLocaleDateString("en-BD", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            {doctorField && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Referred by
                </p>
                <p className="font-semibold">{doctorField}</p>
              </div>
            )}
          </div>

          {/* Tests */}
          <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-purple-50 text-purple-700">
                <th className="text-left px-3 py-2.5 font-semibold">
                  Investigation
                </th>
                <th className="text-center px-2 py-2.5 font-semibold">Qty</th>
                <th className="text-right px-3 py-2.5 font-semibold">Rate</th>
                <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {checkedRates.map((r) => {
                const qty = selected[r.id]?.qty ?? 1;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">{r.name}</td>
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

          {/* Totals */}
          <div className="ml-auto w-52 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">
                ৳{subtotal.toLocaleString("en-BD")}
              </span>
            </div>
            {discountRate > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount ({discountRate}%)</span>
                <span>
                  −৳{(subtotal - finalAmount).toLocaleString("en-BD")}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 font-bold text-base text-purple-700">
              <span>Total Due</span>
              <span>৳{finalAmount.toLocaleString("en-BD")}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-3">
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
              ocidPrefix="walkin_inv"
            />
            <PartialPaymentFields
              total={finalAmount}
              amountPaid={amountPaid}
              onAmountPaidChange={setAmountPaid}
              isPartial={isPartial}
              onIsPartialChange={setIsPartial}
              ocidPrefix="walkin_inv"
            />
          </div>

          <Button
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleGenerateReceipt}
            data-ocid="walkin_inv.generate_receipt.button"
          >
            <Receipt className="w-4 h-4" />
            Generate Receipt
          </Button>
        </div>
      </div>
    );
  }

  // ── Main form step ──
  return (
    <div
      className="bg-card border border-border rounded-2xl overflow-hidden"
      data-ocid="walkin_inv.form.section"
    >
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4">
        <h2 className="font-bold text-white flex items-center gap-2">
          <FlaskConical className="w-4 h-4" />
          New Investigation Request
        </h2>
        <p className="text-white/70 text-xs mt-0.5">
          Fill in patient details and select tests — receipt generated instantly
        </p>
      </div>

      <div className="p-5 space-y-6">
        {/* Patient information */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Patient Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="wi-name" className="text-sm font-semibold">
                Patient Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="wi-name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Full name"
                className="mt-1"
                data-ocid="walkin_inv.patient_name.input"
              />
            </div>

            <div>
              <Label htmlFor="wi-age" className="text-sm font-semibold">
                Age (years) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="wi-age"
                type="number"
                min={0}
                max={150}
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="e.g. 35"
                className="mt-1"
                data-ocid="walkin_inv.patient_age.input"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold">
                Sex <span className="text-rose-500">*</span>
              </Label>
              <div className="flex gap-2 mt-1">
                {(["Male", "Female", "Other"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPatientSex(s)}
                    className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                      patientSex === s
                        ? s === "Male"
                          ? "bg-blue-600 text-white border-blue-600"
                          : s === "Female"
                            ? "bg-pink-500 text-white border-pink-500"
                            : "bg-muted text-foreground border-border"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40"
                    }`}
                    data-ocid={`walkin_inv.sex_${s.toLowerCase()}.toggle`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="wi-inv-date" className="text-sm font-semibold">
                Date of Investigation <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="wi-inv-date"
                type="date"
                value={investigationDate}
                onChange={(e) => setInvestigationDate(e.target.value)}
                className="mt-1"
                data-ocid="walkin_inv.investigation_date.input"
              />
            </div>

            <div>
              <Label htmlFor="wi-report-date" className="text-sm font-semibold">
                Report Delivery Date <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="wi-report-date"
                type="date"
                value={reportDeliveryDate}
                min={investigationDate}
                onChange={(e) => setReportDeliveryDate(e.target.value)}
                className="mt-1"
                data-ocid="walkin_inv.report_date.input"
              />
              {reportDeliveryDate &&
                investigationDate &&
                new Date(reportDeliveryDate) >= new Date(investigationDate) && (
                  <p className="text-xs text-emerald-600 mt-1">
                    ✓ Reports ready in{" "}
                    {Math.round(
                      (new Date(reportDeliveryDate).getTime() -
                        new Date(investigationDate).getTime()) /
                        86400000,
                    )}{" "}
                    day(s)
                  </p>
                )}
            </div>

            <div>
              <Label htmlFor="wi-doctor" className="text-sm font-semibold">
                Referred by Doctor{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="wi-doctor"
                value={doctorField}
                onChange={(e) => setDoctorField(e.target.value)}
                placeholder="Doctor name"
                className="mt-1"
                data-ocid="walkin_inv.doctor_name.input"
              />
            </div>

            <div>
              <Label htmlFor="wi-phone" className="text-sm font-semibold">
                Phone{" "}
                <span className="text-muted-foreground text-xs">
                  (for WhatsApp receipt)
                </span>
              </Label>
              <Input
                id="wi-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801XXXXXXXXX"
                className="mt-1"
                data-ocid="walkin_inv.phone.input"
              />
            </div>
          </div>
        </div>

        {/* Tests */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />
            Investigation Tests <span className="text-rose-500">*</span>
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tests…"
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="w-full pl-8 h-7 text-sm bg-background border border-border rounded-md px-3 outline-none focus:ring-1 focus:ring-primary/40"
                  data-ocid="walkin_inv.test_search.input"
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {checkedRates.length} selected
              </span>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {filteredRates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No tests match "{testSearch}"
                </p>
              ) : (
                filteredRates.map((rate, idx) => {
                  const s = selected[rate.id] ?? { checked: false, qty: 1 };
                  const lineAmt = s.checked ? rate.rate * (s.qty || 1) : null;
                  return (
                    <div
                      key={rate.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        s.checked ? "bg-purple-50" : "hover:bg-muted/20"
                      }`}
                      data-ocid={`walkin_inv.test.item.${idx + 1}`}
                    >
                      <Checkbox
                        id={`wi-${rate.id}`}
                        checked={s.checked}
                        onCheckedChange={() => handleToggle(rate.id)}
                        data-ocid={`walkin_inv.test.checkbox.${idx + 1}`}
                      />
                      <label
                        htmlFor={`wi-${rate.id}`}
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
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 h-7 text-xs text-center"
                          aria-label="Quantity"
                        />
                      )}
                      <span
                        className={`text-sm font-semibold tabular-nums min-w-[4rem] text-right ${
                          s.checked
                            ? "text-purple-700"
                            : "text-muted-foreground"
                        }`}
                      >
                        ৳{" "}
                        {s.checked && lineAmt != null
                          ? lineAmt.toLocaleString("en-BD")
                          : rate.rate.toLocaleString("en-BD")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Discount & total */}
        {checkedRates.length > 0 && (
          <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">
                ৳ {subtotal.toLocaleString("en-BD")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Label
                htmlFor="wi-discount"
                className="text-sm whitespace-nowrap shrink-0"
              >
                Discount (%)
              </Label>
              <Input
                id="wi-discount"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountRate === 0 ? "" : discountRate}
                placeholder="0"
                onChange={(e) => {
                  setDiscountRate(
                    Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  );
                  setFinalOverride("");
                }}
                className="w-24 h-8 text-sm"
                data-ocid="walkin_inv.discount_rate.input"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label
                htmlFor="wi-final"
                className="text-sm whitespace-nowrap shrink-0"
              >
                Final Rate (৳)
              </Label>
              <Input
                id="wi-final"
                type="number"
                min={0}
                value={finalOverride !== "" ? finalOverride : autoFinal || ""}
                placeholder="0"
                onChange={(e) => {
                  setFinalOverride(e.target.value);
                  const num = Number(e.target.value);
                  if (subtotal > 0 && !Number.isNaN(num)) {
                    setDiscountRate(
                      Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round((1 - num / subtotal) * 10000) / 100,
                        ),
                      ),
                    );
                  }
                }}
                className="w-32 h-8 text-sm font-bold text-purple-700"
                data-ocid="walkin_inv.final_rate.input"
              />
            </div>
            <div className="bg-card border-2 border-purple-300 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-0.5 uppercase font-semibold tracking-wide">
                Total / মোট
              </p>
              <p className="text-3xl font-black text-purple-700 tabular-nums">
                ৳ {finalAmount.toLocaleString("en-BD")}
              </p>
              {discountRate > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  {discountRate.toFixed(1)}% discount applied
                </p>
              )}
            </div>
          </div>
        )}

        <Button
          className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          disabled={
            checkedRates.length === 0 ||
            !patientName.trim() ||
            !patientAge ||
            !reportDeliveryDate
          }
          onClick={handleProceedToInvoice}
          data-ocid="walkin_inv.proceed_invoice.button"
        >
          <Receipt className="w-4 h-4" />
          Review Invoice &rarr;
        </Button>
      </div>
    </div>
  );
}
