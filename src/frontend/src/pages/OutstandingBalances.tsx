/**
 * OutstandingBalances — Dedicated page for patients with outstanding due amounts.
 * Aggregates dueAmount from all payment stores, groups by registerNumber,
 * shows total billed, total paid, balance due, last payment date.
 * Color-coded: red if overdue (>30 days), amber if recent partial.
 * CSV + PDF export, sort by highest balance.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Download,
  FileText,
  MessageCircle,
  Search,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { loadReceipts } from "../components/MoneyReceipt";

// ── Storage helpers ────────────────────────────────────────────────────────────

const ADV_PAYMENTS_KEY = "advance_payments";

function loadAdvancePayments(): Array<{
  id: string;
  patientName: string;
  registerNumber: string;
  phone?: string;
  amount: number;
  date: string;
  appliedToReceipt?: string;
}> {
  try {
    return JSON.parse(localStorage.getItem(ADV_PAYMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadAppointmentPayments(): Array<{
  id: string;
  patientName: string;
  registerNumber: string;
  date: string;
  fee: number;
  status: string;
  partialAmount?: number;
  paymentMethod?: string;
}> {
  try {
    return JSON.parse(localStorage.getItem("appointmentPayments") || "[]");
  } catch {
    return [];
  }
}

function loadProcedureReceipts(): Array<{
  id: string;
  patientName: string;
  registerNumber?: string;
  phone?: string;
  date: string;
  finalAmount?: number;
  amount?: number;
  amountPaid?: number;
  dueAmount?: number;
  paid: boolean;
  invoiceState?: string;
}> {
  try {
    return JSON.parse(localStorage.getItem("procedurePayments") || "[]");
  } catch {
    return [];
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface BalanceRow {
  patientName: string;
  registerNumber: string;
  phone: string;
  totalBilled: number;
  totalPaid: number;
  advanceCredit: number;
  balanceDue: number;
  lastPaymentDate: string | null;
  overdue: boolean;
}

// ── Data aggregation ───────────────────────────────────────────────────────────

function buildBalanceRows(): BalanceRow[] {
  const map = new Map<
    string,
    {
      patientName: string;
      phone: string;
      totalBilled: number;
      totalPaid: number;
      dates: string[];
    }
  >();

  function getKey(registerNumber: string, patientName: string) {
    return registerNumber?.trim() || patientName?.trim().toLowerCase();
  }

  function ensureRow(key: string, patientName: string, phone = "") {
    if (!map.has(key)) {
      map.set(key, {
        patientName: patientName || key,
        phone,
        totalBilled: 0,
        totalPaid: 0,
        dates: [],
      });
    }
    return map.get(key)!;
  }

  // --- clinic_receipts (investigation, procedure, appointment, other)
  for (const r of loadReceipts()) {
    if (!r.dueAmount || r.dueAmount <= 0) continue;
    const key = getKey(r.registerNumber || "", r.patientName);
    const row = ensureRow(key, r.patientName, r.phone || "");
    const billed = r.finalAmount ?? r.amount ?? 0;
    const paid = r.amountPaid ?? (r.paid ? billed : 0);
    row.totalBilled += billed;
    row.totalPaid += paid;
    if (r.date) row.dates.push(r.date);
  }

  // --- appointmentPayments
  for (const a of loadAppointmentPayments()) {
    if (a.status === "paid") continue;
    const key = getKey(a.registerNumber, a.patientName);
    const row = ensureRow(key, a.patientName);
    const billed = a.fee;
    const paid = a.status === "partial" ? (a.partialAmount ?? 0) : 0;
    const due = billed - paid;
    if (due <= 0) continue;
    row.totalBilled += billed;
    row.totalPaid += paid;
    if (a.date) row.dates.push(a.date);
  }

  // --- procedurePayments (raw store)
  for (const p of loadProcedureReceipts()) {
    if (!p.dueAmount || p.dueAmount <= 0) continue;
    const key = getKey(p.registerNumber || "", p.patientName);
    const row = ensureRow(key, p.patientName, p.phone || "");
    const billed = p.finalAmount ?? p.amount ?? 0;
    const paid = p.amountPaid ?? 0;
    row.totalBilled += billed;
    row.totalPaid += paid;
    if (p.date) row.dates.push(p.date);
  }

  // --- advance credits (per patient key)
  const advMap = new Map<string, number>();
  for (const adv of loadAdvancePayments()) {
    if (!adv.appliedToReceipt) {
      const key = getKey(adv.registerNumber, adv.patientName);
      advMap.set(key, (advMap.get(key) ?? 0) + adv.amount);
    }
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rows: BalanceRow[] = [];
  for (const [key, row] of map.entries()) {
    const advCredit = advMap.get(key) ?? 0;
    const due = row.totalBilled - row.totalPaid - advCredit;
    if (due <= 0) continue;
    const sortedDates = row.dates.sort().reverse();
    const lastDate = sortedDates[0] ?? null;
    const overdue = lastDate ? new Date(lastDate) < thirtyDaysAgo : true;
    rows.push({
      patientName: row.patientName,
      registerNumber: key,
      phone: row.phone,
      totalBilled: row.totalBilled,
      totalPaid: row.totalPaid,
      advanceCredit: advCredit,
      balanceDue: due,
      lastPaymentDate: lastDate,
      overdue,
    });
  }

  return rows.sort((a, b) => b.balanceDue - a.balanceDue);
}

// ── WhatsApp helper ────────────────────────────────────────────────────────────

function openWhatsApp(row: BalanceRow) {
  if (!row.phone) return;
  const phone = row.phone.replace(/\D/g, "");
  const e164 = phone.startsWith("0") ? `880${phone.slice(1)}` : phone;
  const msg = `Hello ${row.patientName}, this is a reminder from Dr. Arman Kabir's Clinic. Your outstanding balance is ৳${row.balanceDue.toLocaleString("en-BD")}. Please contact us at your earliest convenience. For queries call: +8801751959262`;
  window.open(
    `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OutstandingBalances() {
  const [search, setSearch] = useState("");
  const [_refresh, setRefresh] = useState(0);

  const rows = useMemo(() => buildBalanceRows(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.registerNumber.toLowerCase().includes(q) ||
        r.phone.includes(q),
    );
  }, [rows, search]);

  const totalOutstanding = filtered.reduce((s, r) => s + r.balanceDue, 0);
  const overdueCount = filtered.filter((r) => r.overdue).length;

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = [
      "Patient Name",
      "Register No.",
      "Phone",
      "Total Billed (৳)",
      "Total Paid (৳)",
      "Advance Credit (৳)",
      "Balance Due (৳)",
      "Last Payment Date",
      "Status",
    ];
    const rows2 = filtered.map((r) =>
      [
        r.patientName,
        r.registerNumber,
        r.phone,
        r.totalBilled,
        r.totalPaid,
        r.advanceCredit,
        r.balanceDue,
        r.lastPaymentDate ?? "—",
        r.overdue ? "OVERDUE" : "Recent",
      ].join(","),
    );
    rows2.unshift(
      ["TOTAL OUTSTANDING:", "", "", "", "", "", totalOutstanding, "", ""].join(
        ",",
      ),
    );
    const csv = [headers.join(","), ...rows2].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outstanding-balances-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  function exportPDF() {
    const tableRows = filtered
      .map(
        (r, i) =>
          `<tr style="background:${r.overdue ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#f9fafb"}">
          <td>${r.patientName}</td>
          <td style="font-family:monospace">${r.registerNumber}</td>
          <td>${r.phone || "—"}</td>
          <td style="text-align:right">৳${r.totalBilled.toLocaleString("en-BD")}</td>
          <td style="text-align:right">৳${r.totalPaid.toLocaleString("en-BD")}</td>
          <td style="text-align:right;color:#16a34a">${r.advanceCredit > 0 ? `৳${r.advanceCredit.toLocaleString("en-BD")}` : "—"}</td>
          <td style="text-align:right;font-weight:bold;color:${r.overdue ? "#dc2626" : "#d97706"}">৳${r.balanceDue.toLocaleString("en-BD")}</td>
          <td>${r.lastPaymentDate ? new Date(r.lastPaymentDate).toLocaleDateString("en-BD") : "—"}</td>
          <td style="color:${r.overdue ? "#dc2626" : "#d97706"};font-weight:bold">${r.overdue ? "OVERDUE" : "Recent"}</td>
        </tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Outstanding Balances</title>
    <style>
      body{font-family:serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#111}
      h1{font-size:22px;margin-bottom:4px}
      .subtitle{font-size:13px;color:#555;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#fee2e2;text-align:left;padding:8px 10px;font-size:11px;border-bottom:2px solid #dc2626}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
      .total-row td{background:#fee2e2;font-weight:bold;border-top:2px solid #dc2626}
      @media print{body{margin:20px}}
    </style></head><body>
    <h1>Dr. Arman Kabir's Care — Outstanding Balances</h1>
    <div class="subtitle">বকেয়া পেমেন্ট রিপোর্ট · Generated: ${new Date().toLocaleDateString("en-BD")}</div>
    <table>
      <thead><tr>
        <th>Patient</th><th>Register No.</th><th>Phone</th>
        <th style="text-align:right">Total Billed</th>
        <th style="text-align:right">Total Paid</th>
        <th style="text-align:right">Advance Credit</th>
        <th style="text-align:right">Balance Due</th>
        <th>Last Payment</th><th>Status</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="6">TOTAL OUTSTANDING (${filtered.length} patients)</td>
        <td style="text-align:right">৳${totalOutstanding.toLocaleString("en-BD")}</td>
        <td></td><td></td>
      </tr></tfoot>
    </table>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  return (
    <div
      className="min-h-screen bg-background"
      data-ocid="outstanding_balances.page"
    >
      {/* Header */}
      <div className="bg-red-600 text-white px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-red-200 text-xs mb-0.5">Finance / বকেয়া</p>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Wallet className="w-6 h-6" /> Outstanding Balances
              </h1>
              <p className="text-red-200 text-sm mt-0.5">বকেয়া পেমেন্টের তালিকা</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                className="bg-white text-red-700 hover:bg-red-50 font-semibold gap-1.5"
                onClick={exportCSV}
                data-ocid="outstanding.export_csv.button"
              >
                <Download className="w-4 h-4" /> CSV
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-400 text-white border border-red-300 font-semibold gap-1.5"
                onClick={exportPDF}
                data-ocid="outstanding.export_pdf.button"
              >
                <FileText className="w-4 h-4" /> PDF
              </Button>
            </div>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap gap-4 mt-5">
            <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-red-100 text-xs mb-1">
                Total Outstanding / মোট বকেয়া
              </p>
              <p className="text-white font-black text-3xl tabular-nums">
                ৳ {totalOutstanding.toLocaleString("en-BD")}
              </p>
            </div>
            <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-red-100 text-xs mb-1">Patients / রোগী</p>
              <p className="text-white font-black text-3xl tabular-nums">
                {filtered.length}
              </p>
            </div>
            {overdueCount > 0 && (
              <div className="bg-red-800/40 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-red-200 text-xs mb-1">Overdue (&gt;30d)</p>
                <p className="text-red-100 font-black text-3xl tabular-nums">
                  {overdueCount}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Search + refresh */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, register no., or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-ocid="outstanding.search_input"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefresh((v) => v + 1)}
            className="gap-1.5"
            data-ocid="outstanding.refresh.button"
          >
            ↺ Refresh
          </Button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-200 border border-red-400" />
            Overdue — last payment over 30 days ago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
            Recent partial payment
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3"
            data-ocid="outstanding.empty_state"
          >
            <Wallet className="w-12 h-12 opacity-20" />
            <p className="font-semibold text-lg">
              {rows.length === 0
                ? "No outstanding balances! 🎉"
                : "No results for search"}
            </p>
            <p className="text-sm">
              {rows.length === 0
                ? "All patients have paid their bills."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div
            className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            data-ocid="outstanding.table"
          >
            <div className="bg-red-50 border-b border-red-100 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">
                {filtered.length} patient{filtered.length !== 1 ? "s" : ""} with
                outstanding balance
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      Patient
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden sm:table-cell">
                      Register No.
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden md:table-cell">
                      Phone
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden lg:table-cell">
                      Total Billed
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden lg:table-cell">
                      Total Paid
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-green-700 text-xs hidden lg:table-cell">
                      Advance Credit
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-red-700 text-xs">
                      Balance Due
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden sm:table-cell">
                      Last Payment
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr
                      key={`${row.registerNumber}-${idx}`}
                      className={`border-b border-border last:border-0 transition-colors ${
                        row.overdue
                          ? "bg-red-50/60 hover:bg-red-50"
                          : "hover:bg-amber-50/40"
                      }`}
                      data-ocid={`outstanding.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {row.patientName}
                        </p>
                        {row.overdue && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                        {row.registerNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {row.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        ৳{row.totalBilled.toLocaleString("en-BD")}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        ৳{row.totalPaid.toLocaleString("en-BD")}
                      </td>
                      <td className="px-4 py-3 text-right text-xs hidden lg:table-cell">
                        {row.advanceCredit > 0 ? (
                          <span className="text-green-600 font-medium">
                            ৳{row.advanceCredit.toLocaleString("en-BD")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-black tabular-nums text-base ${
                            row.overdue ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          ৳{row.balanceDue.toLocaleString("en-BD")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {row.lastPaymentDate
                          ? new Date(row.lastPaymentDate).toLocaleDateString(
                              "en-BD",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.phone && (
                            <button
                              type="button"
                              onClick={() => openWhatsApp(row)}
                              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors"
                              title="Send WhatsApp reminder"
                              aria-label="Send WhatsApp reminder"
                              data-ocid={`outstanding.whatsapp.${idx + 1}`}
                              style={{ color: "#25D366" }}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
