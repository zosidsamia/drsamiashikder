/**
 * TotalIncome — Aggregated income dashboard from all payment sources.
 * Blue/indigo theme. Date, doctor, and payment-method filters. CSV + PDF export.
 * Includes refund tracking and net income calculation.
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
  BarChart2,
  Calendar,
  Download,
  FileText,
  TrendingUp,
  X,
} from "lucide-react";
import React from "react";
import { useMemo, useState } from "react";
import { loadReceipts } from "../components/MoneyReceipt";
import type { MoneyReceiptData } from "../types";

// ── Storage keys ───────────────────────────────────────────────────────────────

const PROC_PAYMENTS_KEY = "procedurePayments";
const APT_PAYMENTS_KEY = "appointmentPayments";
const OTHER_PAYMENTS_KEY = "otherPayments";
const REFUNDS_KEY = "paymentRefunds";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OtherPaymentRecord {
  id: string;
  patientName?: string;
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  paymentMethod?: string;
  doctorName?: string;
}

interface LocalRefundRecord {
  id: string;
  receiptId?: string;
  amount: number;
  date: string;
  reason?: string;
  patientName?: string;
  paymentType?: string;
}

type DateFilter = "today" | "week" | "month" | "custom";

interface DayTotals {
  date: string;
  appointment: number;
  investigation: number;
  procedure: number;
  other: number;
  total: number;
}

// ── Load helpers ───────────────────────────────────────────────────────────────

function loadProcedurePayments(): MoneyReceiptData[] {
  try {
    return JSON.parse(localStorage.getItem(PROC_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadAppointmentPayments(): Array<{
  id: string;
  amount?: number;
  fee?: number;
  date: string;
  status: string;
  doctor?: string;
  paymentMethod?: string;
}> {
  try {
    return JSON.parse(localStorage.getItem(APT_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadOtherPayments(): OtherPaymentRecord[] {
  try {
    return JSON.parse(localStorage.getItem(OTHER_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadRefunds(): LocalRefundRecord[] {
  try {
    return JSON.parse(localStorage.getItem(REFUNDS_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── Date range helpers ─────────────────────────────────────────────────────────

function getDateRange(
  filter: DateFilter,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const now = new Date();
  if (filter === "today") {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    const e = new Date(now);
    e.setHours(23, 59, 59, 999);
    return { from: s, to: e };
  }
  if (filter === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - 6);
    s.setHours(0, 0, 0, 0);
    const e = new Date(now);
    e.setHours(23, 59, 59, 999);
    return { from: s, to: e };
  }
  if (filter === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: (() => {
        const e = new Date(now);
        e.setHours(23, 59, 59, 999);
        return e;
      })(),
    };
  }
  return {
    from: customFrom
      ? new Date(customFrom)
      : new Date(now.getFullYear(), now.getMonth(), 1),
    to: customTo ? new Date(`${customTo}T23:59:59`) : new Date(now),
  };
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

// ── Doctor list helper ─────────────────────────────────────────────────────────

function getAllDoctors(
  aptPayments: Array<{ doctor?: string }>,
  allReceipts: MoneyReceiptData[],
): string[] {
  const set = new Set<string>();
  for (const p of aptPayments) if (p.doctor) set.add(p.doctor);
  for (const r of allReceipts) if (r.doctorName) set.add(r.doctorName);
  return [...set].sort();
}

// ── Monthly chart data helper ─────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function buildMonthlyData(
  aptPayments: ReturnType<typeof loadAppointmentPayments>,
  allReceipts: MoneyReceiptData[],
  procPayments: MoneyReceiptData[],
  otherPayments: OtherPaymentRecord[],
  filterDoctor: string,
  filterMethod: string,
) {
  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: MONTH_LABELS[i],
    appointment: 0,
    investigation: 0,
    procedure: 0,
    other: 0,
    total: 0,
  }));

  function addToMonth(
    dateStr: string,
    key: "appointment" | "investigation" | "procedure" | "other",
    amount: number,
  ) {
    const d = new Date(dateStr);
    if (d.getFullYear() !== year) return;
    const m = months[d.getMonth()];
    if (!m) return;
    m[key] += amount;
    m.total += amount;
  }

  for (const p of aptPayments) {
    if (p.status !== "paid") continue;
    if (filterDoctor !== "all" && p.doctor !== filterDoctor) continue;
    if (filterMethod !== "all" && p.paymentMethod !== filterMethod) continue;
    addToMonth(p.date, "appointment", p.fee ?? p.amount ?? 0);
  }
  for (const r of allReceipts) {
    if (!r.paid) continue;
    if (filterDoctor !== "all" && r.doctorName !== filterDoctor) continue;
    const amt = r.finalAmount ?? r.amount;
    if (r.type === "investigation") addToMonth(r.date, "investigation", amt);
    else if (r.type === "procedure") addToMonth(r.date, "procedure", amt);
    else if (r.type === "appointment") addToMonth(r.date, "appointment", amt);
  }
  for (const r of procPayments) {
    if (!r.paid) continue;
    if (filterDoctor !== "all" && r.doctorName !== filterDoctor) continue;
    if (allReceipts.find((m) => m.id === r.id)) continue;
    addToMonth(r.date, "procedure", r.finalAmount ?? r.amount);
  }
  for (const p of otherPayments) {
    if (filterDoctor !== "all" && p.doctorName !== filterDoctor) continue;
    if (filterMethod !== "all" && p.paymentMethod !== filterMethod) continue;
    addToMonth(p.date, "other", p.amount);
  }
  return months;
}

const CHART_CATS = [
  { key: "appointment" as const, color: "bg-green-500", label: "Appointment" },
  {
    key: "investigation" as const,
    color: "bg-blue-500",
    label: "Investigation",
  },
  { key: "procedure" as const, color: "bg-orange-500", label: "Procedure" },
  { key: "other" as const, color: "bg-purple-500", label: "Other" },
];

type MonthlyEntry = ReturnType<typeof buildMonthlyData>[number];

function MonthlyBarChart({ data }: { data: MonthlyEntry[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const [hovIdx, setHovIdx] = React.useState<number | null>(null);

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        {CHART_CATS.map((c) => (
          <div
            key={c.key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <div className={`w-3 h-3 rounded-sm ${c.color}`} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1 items-end" style={{ minWidth: 540 }}>
          {data.map((month, idx) => (
            <div
              key={month.label}
              className="flex flex-col items-center gap-1 flex-1"
            >
              <div
                className="w-full flex flex-col-reverse gap-px relative cursor-pointer"
                style={{ height: 120 }}
                onMouseEnter={() => setHovIdx(idx)}
                onMouseLeave={() => setHovIdx(null)}
              >
                {CHART_CATS.map((cat) => {
                  const val = month[cat.key];
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={cat.key}
                      className={`w-full rounded-sm ${cat.color} transition-opacity`}
                      style={{ height: `${pct}%` }}
                      title={`${cat.label}: ৳${val.toLocaleString("en-BD")}`}
                    />
                  ) : null;
                })}
                {hovIdx === idx && month.total > 0 && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded shadow-md z-10 whitespace-nowrap pointer-events-none">
                    ৳{month.total.toLocaleString("en-BD")}
                  </div>
                )}
              </div>
              <span
                className="text-xs text-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {month.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Components ─────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  labelBn,
  color,
  icon,
  negative,
}: {
  label: string;
  value: number;
  labelBn: string;
  color: string;
  icon: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xs text-muted-foreground/60 mb-1">{labelBn}</p>
        <p
          className={`text-xl font-black tabular-nums ${negative ? "text-red-600" : "text-foreground"}`}
        >
          {negative && value > 0 ? "−" : ""}৳ {value.toLocaleString("en-BD")}
        </p>
      </div>
    </div>
  );
}

function IncomeBarChart({ data }: { data: DayTotals[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const cats = [
    {
      key: "appointment" as const,
      color: "bg-green-500",
      label: "Appointment",
    },
    {
      key: "investigation" as const,
      color: "bg-blue-500",
      label: "Investigation",
    },
    { key: "procedure" as const, color: "bg-orange-500", label: "Procedure" },
    { key: "other" as const, color: "bg-purple-500", label: "Other" },
  ];

  return (
    <div>
      <div className="flex gap-3 mb-3 flex-wrap">
        {cats.map((c) => (
          <div
            key={c.key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <div className={`w-3 h-3 rounded-sm ${c.color}`} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div
          className="flex gap-2 items-end"
          style={{ minWidth: data.length * 56 }}
        >
          {data.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1 flex-1"
              style={{ minWidth: 44 }}
            >
              <div
                className="w-full flex flex-col-reverse gap-0.5"
                style={{ height: 120 }}
              >
                {cats.map((cat) => {
                  const val = day[cat.key];
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={cat.key}
                      className={`w-full rounded-sm ${cat.color} transition-all`}
                      style={{ height: `${pct}%` }}
                      title={`${cat.label}: ৳${val.toLocaleString("en-BD")}`}
                    />
                  ) : null;
                })}
              </div>
              <span
                className="text-xs text-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {new Date(day.date).toLocaleDateString("en-BD", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TotalIncome() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");

  const { from, to } = getDateRange(dateFilter, customFrom, customTo);

  // Load all payment data
  const allReceipts = useMemo(() => loadReceipts(), []);
  const procPayments = useMemo(() => loadProcedurePayments(), []);
  const aptPayments = useMemo(() => loadAppointmentPayments(), []);
  const otherPayments = useMemo(() => loadOtherPayments(), []);
  const refunds = useMemo(() => loadRefunds(), []);

  const doctors = useMemo(
    () => getAllDoctors(aptPayments, allReceipts),
    [aptPayments, allReceipts],
  );

  // Payment methods
  const paymentMethods: { label: string; value: string }[] = [
    { label: "Cash", value: "cash" },
    { label: "bKash", value: "bkash" },
    { label: "Nagad", value: "nagad" },
    { label: "Card", value: "card" },
  ];

  // Appointment total
  const aptTotal = useMemo(
    () =>
      aptPayments
        .filter(
          (p) =>
            p.status === "paid" &&
            inRange(p.date, from, to) &&
            (filterDoctor === "all" || p.doctor === filterDoctor) &&
            (filterMethod === "all" || p.paymentMethod === filterMethod),
        )
        .reduce((s, p) => s + (p.fee ?? p.amount ?? 0), 0),
    [aptPayments, from, to, filterDoctor, filterMethod],
  );

  // Investigation total
  const invTotal = useMemo(
    () =>
      allReceipts
        .filter(
          (r) =>
            r.type === "investigation" &&
            r.paid &&
            inRange(r.date, from, to) &&
            (filterDoctor === "all" || r.doctorName === filterDoctor),
        )
        .reduce((s, r) => s + (r.finalAmount ?? r.amount), 0),
    [allReceipts, from, to, filterDoctor],
  );

  // Procedure total
  const procTotal = useMemo(() => {
    const moneyReceipts = allReceipts.filter(
      (r) =>
        r.type === "procedure" &&
        r.paid &&
        inRange(r.date, from, to) &&
        (filterDoctor === "all" || r.doctorName === filterDoctor),
    );
    const procReceipts = procPayments.filter(
      (r) =>
        r.paid &&
        inRange(r.date, from, to) &&
        (filterDoctor === "all" || r.doctorName === filterDoctor),
    );
    const combined = [...procReceipts];
    for (const m of moneyReceipts) {
      if (!combined.find((r) => r.id === m.id)) combined.push(m);
    }
    return combined.reduce((s, r) => s + (r.finalAmount ?? r.amount), 0);
  }, [allReceipts, procPayments, from, to, filterDoctor]);

  // Other total
  const otherTotal = useMemo(
    () =>
      otherPayments
        .filter(
          (p) =>
            inRange(p.date, from, to) &&
            (filterDoctor === "all" || p.doctorName === filterDoctor) &&
            (filterMethod === "all" || p.paymentMethod === filterMethod),
        )
        .reduce((s, p) => s + p.amount, 0),
    [otherPayments, from, to, filterDoctor, filterMethod],
  );

  // Refunds total
  const refundsTotal = useMemo(
    () =>
      refunds
        .filter((r) => inRange(r.date, from, to))
        .reduce((s, r) => s + r.amount, 0),
    [refunds, from, to],
  );

  const grossTotal = aptTotal + invTotal + procTotal + otherTotal;
  const netTotal = grossTotal - refundsTotal;

  // Build breakdown by day
  const breakdown = useMemo((): DayTotals[] => {
    const map = new Map<string, DayTotals>();

    function getDay(dateStr: string) {
      const day = dateStr.split("T")[0];
      if (!map.has(day))
        map.set(day, {
          date: day,
          appointment: 0,
          investigation: 0,
          procedure: 0,
          other: 0,
          total: 0,
        });
      return map.get(day)!;
    }

    for (const p of aptPayments) {
      if (p.status !== "paid" || !inRange(p.date, from, to)) continue;
      if (filterDoctor !== "all" && p.doctor !== filterDoctor) continue;
      if (filterMethod !== "all" && p.paymentMethod !== filterMethod) continue;
      const d = getDay(p.date);
      const amt = p.fee ?? p.amount ?? 0;
      d.appointment += amt;
      d.total += amt;
    }
    for (const r of allReceipts) {
      if (!r.paid || !inRange(r.date, from, to)) continue;
      if (filterDoctor !== "all" && r.doctorName !== filterDoctor) continue;
      const amt = r.finalAmount ?? r.amount;
      const d = getDay(r.date);
      if (r.type === "investigation") {
        d.investigation += amt;
        d.total += amt;
      } else if (r.type === "procedure") {
        d.procedure += amt;
        d.total += amt;
      } else if (r.type === "appointment") {
        d.appointment += amt;
        d.total += amt;
      }
    }
    for (const r of procPayments) {
      if (!r.paid || !inRange(r.date, from, to)) continue;
      if (filterDoctor !== "all" && r.doctorName !== filterDoctor) continue;
      if (allReceipts.find((m) => m.id === r.id)) continue;
      const amt = r.finalAmount ?? r.amount;
      const d = getDay(r.date);
      d.procedure += amt;
      d.total += amt;
    }
    for (const p of otherPayments) {
      if (!inRange(p.date, from, to)) continue;
      if (filterDoctor !== "all" && p.doctorName !== filterDoctor) continue;
      if (filterMethod !== "all" && p.paymentMethod !== filterMethod) continue;
      const d = getDay(p.date);
      d.other += p.amount;
      d.total += p.amount;
    }

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [
    aptPayments,
    allReceipts,
    procPayments,
    otherPayments,
    from,
    to,
    filterDoctor,
    filterMethod,
  ]);

  // ── Export CSV ───────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = [
      "Date",
      "Appointment (৳)",
      "Investigation (৳)",
      "Procedure (৳)",
      "Other (৳)",
      "Total (৳)",
    ];
    const rows = breakdown.map((d) =>
      [
        d.date,
        d.appointment,
        d.investigation,
        d.procedure,
        d.other,
        d.total,
      ].join(","),
    );
    rows.push(
      [
        "GROSS TOTAL",
        aptTotal,
        invTotal,
        procTotal,
        otherTotal,
        grossTotal,
      ].join(","),
    );
    rows.push(["REFUNDS", "", "", "", "", `-${refundsTotal}`].join(","));
    rows.push(["NET INCOME", "", "", "", "", netTotal].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `income-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Export PDF (print-based) ─────────────────────────────────────────────────

  function exportPDF() {
    const dateLabel =
      dateFilter === "custom"
        ? `${customFrom || "—"} to ${customTo || "—"}`
        : dateFilter === "today"
          ? "Today"
          : dateFilter === "week"
            ? "This Week"
            : "This Month";

    const rows = breakdown
      .map(
        (d) =>
          `<tr>
            <td>${new Date(d.date).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}</td>
            <td style="text-align:right">${d.appointment > 0 ? `৳ ${d.appointment.toLocaleString("en-BD")}` : "—"}</td>
            <td style="text-align:right">${d.investigation > 0 ? `৳ ${d.investigation.toLocaleString("en-BD")}` : "—"}</td>
            <td style="text-align:right">${d.procedure > 0 ? `৳ ${d.procedure.toLocaleString("en-BD")}` : "—"}</td>
            <td style="text-align:right">${d.other > 0 ? `৳ ${d.other.toLocaleString("en-BD")}` : "—"}</td>
            <td style="text-align:right;font-weight:bold">৳ ${d.total.toLocaleString("en-BD")}</td>
          </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Income Report</title>
      <style>
        body{font-family:serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}
        h1{font-size:22px;margin-bottom:4px}
        .subtitle{font-size:13px;color:#555;margin-bottom:20px}
        .meta{display:flex;gap:24px;margin-bottom:20px;font-size:12px;color:#444}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{background:#e8eaf6;text-align:left;padding:8px 10px;font-size:11px;border-bottom:2px solid #3f51b5}
        td{padding:7px 10px;border-bottom:1px solid #e0e0e0}
        tr:last-child td{border-bottom:none}
        .totals-row td{background:#e8eaf6;font-weight:bold;border-top:2px solid #3f51b5}
        .net-row td{background:#c8e6c9;font-weight:bold;font-size:14px}
        .refund-row td{background:#fce4ec;color:#c62828}
        .summary{margin-top:24px;border:1px solid #ddd;border-radius:8px;padding:16px}
        .summary h2{font-size:14px;margin:0 0 12px}
        .summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .summary-item{font-size:12px;display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee}
        .summary-item span:last-child{font-weight:bold}
        @media print{body{margin:20px}}
      </style></head><body>
      <h1>Dr. Arman Kabir's Care — Income Report</h1>
      <div class="subtitle">মোট আয়ের প্রতিবেদন</div>
      <div class="meta">
        <span><strong>Period:</strong> ${dateLabel}</span>
        ${filterDoctor !== "all" ? `<span><strong>Doctor:</strong> ${filterDoctor}</span>` : ""}
        ${filterMethod !== "all" ? `<span><strong>Method:</strong> ${filterMethod}</span>` : ""}
        <span><strong>Generated:</strong> ${new Date().toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
      <table>
        <thead><tr>
          <th>Date</th>
          <th style="text-align:right">Appointment</th>
          <th style="text-align:right">Investigation</th>
          <th style="text-align:right">Procedure</th>
          <th style="text-align:right">Other</th>
          <th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="totals-row">
            <td>GROSS TOTAL</td>
            <td style="text-align:right">৳ ${aptTotal.toLocaleString("en-BD")}</td>
            <td style="text-align:right">৳ ${invTotal.toLocaleString("en-BD")}</td>
            <td style="text-align:right">৳ ${procTotal.toLocaleString("en-BD")}</td>
            <td style="text-align:right">৳ ${otherTotal.toLocaleString("en-BD")}</td>
            <td style="text-align:right">৳ ${grossTotal.toLocaleString("en-BD")}</td>
          </tr>
          ${
            refundsTotal > 0
              ? `<tr class="refund-row">
            <td>REFUNDS</td>
            <td></td><td></td><td></td><td></td>
            <td style="text-align:right">− ৳ ${refundsTotal.toLocaleString("en-BD")}</td>
          </tr>`
              : ""
          }
          <tr class="net-row">
            <td>NET INCOME</td>
            <td></td><td></td><td></td><td></td>
            <td style="text-align:right">৳ ${netTotal.toLocaleString("en-BD")}</td>
          </tr>
        </tbody>
      </table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  const filterBtns: { label: string; value: DateFilter }[] = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "This Month", value: "month" },
    { label: "Custom", value: "custom" },
  ];

  const hasActiveFilters = filterDoctor !== "all" || filterMethod !== "all";

  return (
    <div className="min-h-screen bg-background" data-ocid="total_income.page">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-indigo-200 text-xs mb-0.5">Finance</p>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <TrendingUp className="w-6 h-6" /> Total Income
              </h1>
              <p className="text-indigo-200 text-sm mt-0.5">
                মোট আয়ের সারসংক্ষেপ
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold gap-1.5"
                onClick={exportCSV}
                data-ocid="total_income.export_csv.button"
              >
                <Download className="w-4 h-4" /> Export CSV
              </Button>
              <Button
                size="sm"
                className="bg-indigo-500 hover:bg-indigo-400 text-white border border-indigo-300 font-semibold gap-1.5"
                onClick={exportPDF}
                data-ocid="total_income.export_pdf.button"
              >
                <FileText className="w-4 h-4" /> Export PDF
              </Button>
            </div>
          </div>

          {/* Grand totals row */}
          <div className="flex flex-wrap gap-4 mt-5">
            <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-indigo-100 text-xs mb-1">
                Gross Income / মোট আয়
              </p>
              <p className="text-white font-black text-3xl tabular-nums">
                ৳ {grossTotal.toLocaleString("en-BD")}
              </p>
            </div>
            {refundsTotal > 0 && (
              <div className="bg-red-500/30 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-red-100 text-xs mb-1">Refunds / ফেরত</p>
                <p className="text-red-100 font-black text-3xl tabular-nums">
                  − ৳ {refundsTotal.toLocaleString("en-BD")}
                </p>
              </div>
            )}
            <div className="bg-emerald-500/30 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-emerald-100 text-xs mb-1">
                Net Income / নিট আয়
              </p>
              <p className="text-white font-black text-3xl tabular-nums">
                ৳ {netTotal.toLocaleString("en-BD")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Filters */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
          {/* Date range buttons */}
          <div className="flex flex-wrap gap-2">
            {filterBtns.map((btn) => (
              <button
                key={btn.value}
                type="button"
                onClick={() => setDateFilter(btn.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  dateFilter === btn.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-card text-muted-foreground border-border hover:border-indigo-300"
                }`}
                data-ocid={`total_income.${btn.value}_filter.tab`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="flex gap-3 flex-wrap">
              <div className="space-y-1">
                <Label
                  htmlFor="income-date-from"
                  className="text-xs text-muted-foreground font-medium"
                >
                  From
                </Label>
                <Input
                  id="income-date-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 text-sm w-36"
                  data-ocid="total_income.date_from.input"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="income-date-to"
                  className="text-xs text-muted-foreground font-medium"
                >
                  To
                </Label>
                <Input
                  id="income-date-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 text-sm w-36"
                  data-ocid="total_income.date_to.input"
                />
              </div>
            </div>
          )}

          {/* Doctor + Payment Method filters */}
          <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              Filter by:
            </span>
            <Select value={filterDoctor} onValueChange={setFilterDoctor}>
              <SelectTrigger
                className="h-8 text-sm w-52"
                data-ocid="total_income.doctor_filter.select"
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
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger
                className="h-8 text-sm w-40"
                data-ocid="total_income.method_filter.select"
              >
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground gap-1"
                onClick={() => {
                  setFilterDoctor("all");
                  setFilterMethod("all");
                }}
                data-ocid="total_income.clear_filters.button"
              >
                <X className="w-3 h-3" /> Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Appointment"
            labelBn="অ্যাপয়েন্টমেন্ট"
            value={aptTotal}
            color="bg-green-100"
            icon={
              <span className="text-green-600 font-black text-sm">APT</span>
            }
          />
          <SummaryCard
            label="Investigation"
            labelBn="তদন্ত"
            value={invTotal}
            color="bg-blue-100"
            icon={<span className="text-blue-600 font-black text-sm">INV</span>}
          />
          <SummaryCard
            label="Procedure"
            labelBn="পদ্ধতি"
            value={procTotal}
            color="bg-orange-100"
            icon={
              <span className="text-orange-600 font-black text-sm">PRO</span>
            }
          />
          <SummaryCard
            label="Other Income"
            labelBn="অন্যান্য"
            value={otherTotal}
            color="bg-purple-100"
            icon={
              <span className="text-purple-600 font-black text-sm">OTH</span>
            }
          />
        </div>

        {/* Refund + Net Income summary row */}
        <div className="grid grid-cols-2 gap-4">
          <SummaryCard
            label="Total Refunds"
            labelBn="মোট ফেরত"
            value={refundsTotal}
            color="bg-red-100"
            icon={<span className="text-red-600 font-black text-xs">REF</span>}
            negative
          />
          <SummaryCard
            label="Net Income"
            labelBn="নিট আয়"
            value={netTotal}
            color="bg-emerald-100"
            icon={
              <span className="text-emerald-600 font-black text-xs">NET</span>
            }
          />
        </div>

        {/* Bar chart */}
        {breakdown.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600" /> Income by Day
            </h3>
            <IncomeBarChart data={breakdown} />
          </div>
        )}

        {/* Monthly Revenue Chart */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Monthly Revenue — {new Date().getFullYear()}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              বাৎসরিক আয়
            </span>
          </h3>
          <MonthlyBarChart
            data={buildMonthlyData(
              aptPayments,
              allReceipts,
              procPayments,
              otherPayments,
              filterDoctor,
              filterMethod,
            )}
          />
        </div>

        {/* Breakdown table */}
        <div
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
          data-ocid="total_income.breakdown.table"
        >
          <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-800">
              Daily Breakdown
            </h3>
            {hasActiveFilters && (
              <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                Filtered view
              </span>
            )}
          </div>
          {breakdown.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
              data-ocid="total_income.empty_state"
            >
              <TrendingUp className="w-10 h-10 opacity-30" />
              <p className="font-semibold">No income data for this period</p>
              <p className="text-sm">
                Try a different date range or remove filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      Date
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs text-green-700 hidden sm:table-cell">
                      Appt
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs text-blue-700 hidden sm:table-cell">
                      Invest.
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs text-orange-700 hidden md:table-cell">
                      Proc.
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs text-purple-700 hidden md:table-cell">
                      Other
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground text-xs">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((d, idx) => (
                    <tr
                      key={d.date}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      data-ocid={`total_income.row.${idx + 1}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {new Date(d.date).toLocaleDateString("en-BD", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-green-700 hidden sm:table-cell">
                        {d.appointment > 0
                          ? `৳ ${d.appointment.toLocaleString("en-BD")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-blue-700 hidden sm:table-cell">
                        {d.investigation > 0
                          ? `৳ ${d.investigation.toLocaleString("en-BD")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-orange-700 hidden md:table-cell">
                        {d.procedure > 0
                          ? `৳ ${d.procedure.toLocaleString("en-BD")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-purple-700 hidden md:table-cell">
                        {d.other > 0
                          ? `৳ ${d.other.toLocaleString("en-BD")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        ৳ {d.total.toLocaleString("en-BD")}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-bold">
                    <td className="px-4 py-3 text-sm text-indigo-800 font-black">
                      GROSS TOTAL
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-green-700 hidden sm:table-cell">
                      ৳ {aptTotal.toLocaleString("en-BD")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-blue-700 hidden sm:table-cell">
                      ৳ {invTotal.toLocaleString("en-BD")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-orange-700 hidden md:table-cell">
                      ৳ {procTotal.toLocaleString("en-BD")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-purple-700 hidden md:table-cell">
                      ৳ {otherTotal.toLocaleString("en-BD")}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-800 font-black">
                      ৳ {grossTotal.toLocaleString("en-BD")}
                    </td>
                  </tr>
                  {refundsTotal > 0 && (
                    <tr className="bg-red-50 border-t border-red-200">
                      <td
                        className="px-4 py-2.5 text-xs text-red-700 font-semibold"
                        colSpan={5}
                      >
                        Refunds
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-red-700 font-bold">
                        − ৳ {refundsTotal.toLocaleString("en-BD")}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-bold">
                    <td
                      className="px-4 py-3 text-sm text-emerald-800 font-black"
                      colSpan={5}
                    >
                      NET INCOME
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-800 font-black text-base">
                      ৳ {netTotal.toLocaleString("en-BD")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
