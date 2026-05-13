/**
 * IOChart — Intake-Output Chart for admitted patients
 * Hourly intake/output tracking with auto-totals, urine alert, and trend graph.
 * Storage key: io_chart_${doctorEmail}_${patientId}_${date}
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { AlertTriangle, Droplets, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface IOEntry {
  id: string;
  time: string; // HH:MM
  // Intake
  oralIntake: number;
  ivFluidType: string;
  ivFluidAmount: number;
  ngFeed: number;
  // Output
  urineOutput: number;
  drainOutput: number;
  tTubeOutput: number;
  vomitus: number;
}

const EMPTY_ENTRY = (): Omit<IOEntry, "id" | "time"> => ({
  oralIntake: 0,
  ivFluidType: "",
  ivFluidAmount: 0,
  ngFeed: 0,
  urineOutput: 0,
  drainOutput: 0,
  tTubeOutput: 0,
  vomitus: 0,
});

function storageKey(doctorEmail: string, patientId: string, date: string) {
  return `io_chart_${doctorEmail}_${patientId}_${date}`;
}

function loadEntries(
  doctorEmail: string,
  patientId: string,
  date: string,
): IOEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(doctorEmail, patientId, date));
    return raw ? (JSON.parse(raw) as IOEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(
  doctorEmail: string,
  patientId: string,
  date: string,
  entries: IOEntry[],
) {
  localStorage.setItem(
    storageKey(doctorEmail, patientId, date),
    JSON.stringify(entries),
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface IOChartProps {
  patientId: string;
  doctorEmail: string;
  patientWeightKg?: number;
  canEdit: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IOChart({
  patientId,
  doctorEmail,
  patientWeightKg,
  canEdit,
}: IOChartProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<IOEntry[]>(() =>
    loadEntries(doctorEmail, patientId, today),
  );

  // ── Form state ────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<IOEntry, "id">>({
    time: format(new Date(), "HH:mm"),
    ...EMPTY_ENTRY(),
  });

  function loadForDate(date: string) {
    setSelectedDate(date);
    setEntries(loadEntries(doctorEmail, patientId, date));
  }

  function setField<K extends keyof typeof form>(
    key: K,
    val: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function resetForm() {
    setForm({ time: format(new Date(), "HH:mm"), ...EMPTY_ENTRY() });
    setEditingId(null);
    setShowForm(false);
  }

  function saveEntry() {
    let updated: IOEntry[];
    if (editingId) {
      updated = entries.map((e) =>
        e.id === editingId ? { ...form, id: editingId } : e,
      );
    } else {
      const newEntry: IOEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        ...form,
      };
      updated = [...entries, newEntry].sort((a, b) =>
        a.time.localeCompare(b.time),
      );
    }
    setEntries(updated);
    saveEntries(doctorEmail, patientId, selectedDate, updated);
    toast.success(editingId ? "Entry updated" : "I/O entry saved");
    resetForm();
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(doctorEmail, patientId, selectedDate, updated);
    toast.success("Entry removed");
  }

  function openEdit(e: IOEntry) {
    setEditingId(e.id);
    setForm({ ...e });
    setShowForm(true);
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const totalIntake = entries.reduce(
      (s, e) => s + e.oralIntake + e.ivFluidAmount + e.ngFeed,
      0,
    );
    const totalUrine = entries.reduce((s, e) => s + e.urineOutput, 0);
    const totalOutput = entries.reduce(
      (s, e) => s + e.urineOutput + e.drainOutput + e.tTubeOutput + e.vomitus,
      0,
    );
    const balance = totalIntake - totalOutput;

    // Urine output rate (ml/kg/hr)
    const hoursElapsed = (() => {
      if (entries.length < 2) return 1;
      const first = entries[0].time.split(":").map(Number);
      const last = entries[entries.length - 1].time.split(":").map(Number);
      const diff = (last[0] * 60 + last[1] - (first[0] * 60 + first[1])) / 60;
      return diff < 0.5 ? 1 : diff;
    })();
    const urineRate =
      patientWeightKg && patientWeightKg > 0
        ? totalUrine / (patientWeightKg * hoursElapsed)
        : null;

    return { totalIntake, totalUrine, totalOutput, balance, urineRate };
  }, [entries, patientWeightKg]);

  const urineAlertActive = totals.urineRate !== null && totals.urineRate < 0.5;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      entries.map((e) => ({
        time: e.time,
        "Urine (ml)": e.urineOutput,
        "IV Fluid (ml)": e.ivFluidAmount,
      })),
    [entries],
  );

  return (
    <div className="space-y-4">
      {/* Header + date picker */}
      <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-cyan-800 flex items-center gap-2 text-base">
            <Droplets className="w-5 h-5" />
            Intake–Output Chart
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => loadForDate(e.target.value)}
              className="border border-cyan-300 rounded-lg px-3 py-1.5 text-sm text-cyan-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            {canEdit && (
              <Button
                size="sm"
                className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1"
                onClick={() => {
                  setShowForm(!showForm);
                  setEditingId(null);
                  setForm({
                    time: format(new Date(), "HH:mm"),
                    ...EMPTY_ENTRY(),
                  });
                }}
                data-ocid="io_chart.add_entry_button"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Entry
              </Button>
            )}
          </div>
        </div>

        {/* Urine Output Alert */}
        {urineAlertActive && (
          <div
            className="mb-3 bg-red-100 border border-red-300 rounded-xl p-3 flex items-start gap-2"
            data-ocid="io_chart.urine_alert"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">
                🚨 Low Urine Output Alert
              </p>
              <p className="text-xs text-red-600">
                U/O = {totals.urineRate!.toFixed(2)} ml/kg/hr (Normal ≥ 0.5
                ml/kg/hr)
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Intake",
              value: `${totals.totalIntake} ml`,
              color: "bg-blue-50 border-blue-200 text-blue-800",
            },
            {
              label: "Total Output",
              value: `${totals.totalOutput} ml`,
              color: "bg-orange-50 border-orange-200 text-orange-800",
            },
            {
              label: "Urine Output",
              value: `${totals.totalUrine} ml`,
              color: urineAlertActive
                ? "bg-red-100 border-red-300 text-red-800"
                : "bg-teal-50 border-teal-200 text-teal-800",
            },
            {
              label: "Net Balance",
              value: `${totals.balance >= 0 ? "+" : ""}${totals.balance} ml`,
              color:
                totals.balance >= 0
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className={`rounded-xl border p-3 text-center ${color}`}
              data-ocid="io_chart.summary_card"
            >
              <p className="text-xs font-medium opacity-70">{label}</p>
              <p className="text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Entry Form */}
      {showForm && canEdit && (
        <div className="bg-white rounded-xl border border-cyan-200 p-5 space-y-4">
          <h4 className="font-semibold text-cyan-800 text-sm">
            {editingId ? "Edit I/O Entry" : "New I/O Entry"}
          </h4>
          <div className="flex items-center gap-3">
            <div>
              <Label className="text-xs font-semibold">Time</Label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setField("time", e.target.value)}
                className="block border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 font-mono"
                data-ocid="io_chart.time_input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Intake */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                Intake
              </p>
              <NumberField
                label="Oral Intake (ml)"
                value={form.oralIntake}
                onChange={(v) => setField("oralIntake", v)}
                ocid="io_chart.oral_input"
              />
              <div>
                <Label className="text-xs">IV Fluid Type</Label>
                <Input
                  value={form.ivFluidType}
                  onChange={(e) => setField("ivFluidType", e.target.value)}
                  placeholder="e.g. NS, D5W, RL"
                  className="mt-1 text-sm"
                  data-ocid="io_chart.iv_type_input"
                />
              </div>
              <NumberField
                label="IV Fluid Amount (ml)"
                value={form.ivFluidAmount}
                onChange={(v) => setField("ivFluidAmount", v)}
                ocid="io_chart.iv_amount_input"
              />
              <NumberField
                label="NG Feed (ml)"
                value={form.ngFeed}
                onChange={(v) => setField("ngFeed", v)}
                ocid="io_chart.ng_input"
              />
            </div>

            {/* Output */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">
                Output
              </p>
              <NumberField
                label="Urine Output (ml)"
                value={form.urineOutput}
                onChange={(v) => setField("urineOutput", v)}
                ocid="io_chart.urine_input"
              />
              <NumberField
                label="Drain Output (ml)"
                value={form.drainOutput}
                onChange={(v) => setField("drainOutput", v)}
                ocid="io_chart.drain_input"
              />
              <NumberField
                label="T-tube Output (ml)"
                value={form.tTubeOutput}
                onChange={(v) => setField("tTubeOutput", v)}
                ocid="io_chart.ttube_input"
              />
              <NumberField
                label="Vomitus (ml)"
                value={form.vomitus}
                onChange={(v) => setField("vomitus", v)}
                ocid="io_chart.vomitus_input"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={saveEntry}
              className="bg-cyan-700 hover:bg-cyan-800 text-white"
              data-ocid="io_chart.save_button"
            >
              {editingId ? "Update" : "Save"} Entry
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Time",
                    "Oral (ml)",
                    "IV (ml)",
                    "NG (ml)",
                    "Urine (ml)",
                    "Drain (ml)",
                    "T-tube (ml)",
                    "Vomitus (ml)",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                    data-ocid="io_chart.entry_row"
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-gray-700">
                      {e.time}
                    </td>
                    <td className="px-3 py-2 text-blue-700">
                      {e.oralIntake || "—"}
                    </td>
                    <td className="px-3 py-2 text-blue-700">
                      {e.ivFluidAmount
                        ? `${e.ivFluidAmount}${e.ivFluidType ? ` (${e.ivFluidType})` : ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-blue-700">
                      {e.ngFeed || "—"}
                    </td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        e.urineOutput === 0 ? "text-red-500" : "text-teal-700"
                      }`}
                    >
                      {e.urineOutput || "0"}
                    </td>
                    <td className="px-3 py-2 text-orange-700">
                      {e.drainOutput || "—"}
                    </td>
                    <td className="px-3 py-2 text-orange-700">
                      {e.tTubeOutput || "—"}
                    </td>
                    <td className="px-3 py-2 text-orange-700">
                      {e.vomitus || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            className="text-blue-400 hover:text-blue-700 text-xs px-1.5 py-0.5 rounded border border-blue-200 hover:border-blue-400"
                            data-ocid="io_chart.edit_button"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(e.id)}
                            className="text-red-400 hover:text-red-600"
                            data-ocid="io_chart.delete_button"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-3 py-2 font-bold text-gray-700 text-xs">
                    TOTAL
                  </td>
                  <td className="px-3 py-2 font-bold text-blue-800">
                    {entries.reduce((s, e) => s + e.oralIntake, 0)}
                  </td>
                  <td className="px-3 py-2 font-bold text-blue-800">
                    {entries.reduce((s, e) => s + e.ivFluidAmount, 0)}
                  </td>
                  <td className="px-3 py-2 font-bold text-blue-800">
                    {entries.reduce((s, e) => s + e.ngFeed, 0)}
                  </td>
                  <td className="px-3 py-2 font-bold text-teal-800">
                    {totals.totalUrine}
                  </td>
                  <td className="px-3 py-2 font-bold text-orange-800">
                    {entries.reduce((s, e) => s + e.drainOutput, 0)}
                  </td>
                  <td className="px-3 py-2 font-bold text-orange-800">
                    {entries.reduce((s, e) => s + e.tTubeOutput, 0)}
                  </td>
                  <td className="px-3 py-2 font-bold text-orange-800">
                    {entries.reduce((s, e) => s + e.vomitus, 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div
          className="text-center py-8 bg-white rounded-xl border border-gray-200"
          data-ocid="io_chart.empty_state"
        >
          <Droplets className="w-8 h-8 text-cyan-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            No I/O entries for {selectedDate}.
          </p>
          {canEdit && (
            <p className="text-xs text-gray-400 mt-1">
              Click "+ Add Entry" to start tracking.
            </p>
          )}
        </div>
      )}

      {/* Urine Trend Chart */}
      {chartData.length >= 2 && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-4">
          <h4 className="font-semibold text-teal-800 mb-3 text-sm flex items-center gap-2">
            <Droplets className="w-4 h-4" /> Urine Output Trend
            <span className="text-xs font-normal opacity-60 ml-1">(ml)</span>
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                label={{
                  value: "ml",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontWeight: "bold", fontSize: 10 },
                }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Urine (ml)"
                stroke="#0d9488"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="IV Fluid (ml)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Helper: NumberField ───────────────────────────────────────────────────────
function NumberField({
  label,
  value,
  onChange,
  ocid,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  ocid: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value === 0 ? "" : value}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
        placeholder="0"
        className="mt-1 text-sm"
        data-ocid={ocid}
      />
    </div>
  );
}
