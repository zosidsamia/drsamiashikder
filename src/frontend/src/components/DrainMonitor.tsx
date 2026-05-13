/**
 * DrainMonitor — Drain monitoring panel for admitted patients
 * Tracks JP / Hemovac / T-tube drains with color, daily trend, and spike alerts.
 * Storage key: drain_monitoring_${doctorEmail}_${patientId}
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { AlertTriangle, FlaskConical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
export type DrainType = "JP" | "Hemovac" | "T-tube" | "Other";
export type DrainColor = "Serous" | "Bloody" | "Bilious" | "Purulent";

export interface DrainEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  drainType: DrainType;
  amount: number;
  color: DrainColor;
  notes?: string;
  recordedAt: string;
}

const DRAIN_COLOR_STYLES: Record<DrainColor, string> = {
  Serous: "bg-yellow-50 text-yellow-800 border-yellow-300",
  Bloody: "bg-red-50 text-red-800 border-red-300",
  Bilious: "bg-lime-50 text-lime-800 border-lime-300",
  Purulent: "bg-orange-50 text-orange-800 border-orange-300",
};

function storageKey(doctorEmail: string, patientId: string) {
  return `drain_monitoring_${doctorEmail}_${patientId}`;
}

function loadDrainEntries(
  doctorEmail: string,
  patientId: string,
): DrainEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(doctorEmail, patientId));
    return raw ? (JSON.parse(raw) as DrainEntry[]) : [];
  } catch {
    return [];
  }
}

function saveDrainEntries(
  doctorEmail: string,
  patientId: string,
  entries: DrainEntry[],
) {
  localStorage.setItem(
    storageKey(doctorEmail, patientId),
    JSON.stringify(entries),
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface DrainMonitorProps {
  patientId: string;
  doctorEmail: string;
  canEdit: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DrainMonitor({
  patientId,
  doctorEmail,
  canEdit,
}: DrainMonitorProps) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [entries, setEntries] = useState<DrainEntry[]>(() =>
    loadDrainEntries(doctorEmail, patientId),
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{
    drainType: DrainType;
    amount: number;
    color: DrainColor;
    notes: string;
    time: string;
  }>({
    drainType: "JP",
    amount: 0,
    color: "Serous",
    notes: "",
    time: format(new Date(), "HH:mm"),
  });

  function setField<K extends keyof typeof form>(
    key: K,
    val: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function saveEntry() {
    if (form.amount <= 0) {
      toast.error("Enter a valid amount > 0");
      return;
    }
    const entry: DrainEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      date: today,
      time: form.time,
      drainType: form.drainType,
      amount: form.amount,
      color: form.color,
      notes: form.notes.trim() || undefined,
      recordedAt: new Date().toISOString(),
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveDrainEntries(doctorEmail, patientId, updated);
    toast.success(`${form.drainType} drain entry saved`);
    setForm({
      drainType: "JP",
      amount: 0,
      color: "Serous",
      notes: "",
      time: format(new Date(), "HH:mm"),
    });
    setShowForm(false);
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveDrainEntries(doctorEmail, patientId, updated);
    toast.success("Drain entry removed");
  }

  // ── Grouped by drain type ─────────────────────────────────────────────────
  const drainTypes = useMemo(() => {
    const types = new Set(entries.map((e) => e.drainType));
    return Array.from(types);
  }, [entries]);

  // ── Spike detection per drain type ────────────────────────────────────────
  const spikeAlerts = useMemo(() => {
    const alerts: Array<{ drainType: string; diff: number }> = [];
    for (const dt of drainTypes) {
      const typeEntries = entries.filter((e) => e.drainType === dt);
      const todayTotal = typeEntries
        .filter((e) => e.date === today)
        .reduce((s, e) => s + e.amount, 0);
      const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
      const yesterdayTotal = typeEntries
        .filter((e) => e.date === yesterday)
        .reduce((s, e) => s + e.amount, 0);
      if (yesterdayTotal > 0 && todayTotal - yesterdayTotal > 50) {
        alerts.push({ drainType: dt, diff: todayTotal - yesterdayTotal });
      }
    }
    return alerts;
  }, [entries, drainTypes, today]);

  // ── 7-day chart data per drain type ──────────────────────────────────────
  function getDrainTrendData(drainType: DrainType) {
    const days: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = format(new Date(Date.now() - i * 86400000), "yyyy-MM-dd");
      const total = entries
        .filter((e) => e.drainType === drainType && e.date === d)
        .reduce((s, e) => s + e.amount, 0);
      days.push({ date: d.slice(5), amount: total }); // MM-DD display
    }
    return days;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-orange-800 flex items-center gap-2 text-base">
            <FlaskConical className="w-5 h-5" />
            Drain Monitoring
          </h3>
          {canEdit && (
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1"
              onClick={() => setShowForm(!showForm)}
              data-ocid="drain_monitor.add_entry_button"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Drain Entry
            </Button>
          )}
        </div>

        {/* Spike Alerts */}
        {spikeAlerts.map(({ drainType, diff }) => (
          <div
            key={drainType}
            className="mb-2 bg-amber-100 border border-amber-300 rounded-xl p-3 flex items-start gap-2"
            data-ocid="drain_monitor.spike_alert"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              ⚠️ Sudden Drain Increase: <strong>{drainType}</strong> increased by{" "}
              <strong>+{diff} ml</strong> compared to yesterday.
            </p>
          </div>
        ))}

        {/* Today's Summary per drain */}
        {drainTypes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {drainTypes.map((dt) => {
              const todayEntries = entries.filter(
                (e) => e.drainType === dt && e.date === today,
              );
              const todayTotal = todayEntries.reduce((s, e) => s + e.amount, 0);
              const latestEntry = todayEntries[0];
              return (
                <div
                  key={dt}
                  className="bg-white rounded-xl border border-orange-200 p-3"
                  data-ocid="drain_monitor.summary_card"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm text-orange-800">
                      {dt} Drain
                    </p>
                    <span className="font-bold text-orange-700">
                      {todayTotal} ml
                    </span>
                  </div>
                  {latestEntry && (
                    <span
                      className={`text-xs border rounded-full px-2 py-0.5 font-medium ${DRAIN_COLOR_STYLES[latestEntry.color]}`}
                    >
                      {latestEntry.color}
                    </span>
                  )}
                  {todayEntries.length === 0 && (
                    <p className="text-xs text-gray-400">No entries today</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Drain Form */}
      {showForm && canEdit && (
        <div className="bg-white rounded-xl border border-orange-200 p-5 space-y-4">
          <h4 className="font-semibold text-orange-800 text-sm">
            New Drain Entry
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Drain Type</Label>
              <select
                value={form.drainType}
                onChange={(e) =>
                  setField("drainType", e.target.value as DrainType)
                }
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                data-ocid="drain_monitor.type_select"
              >
                {(["JP", "Hemovac", "T-tube", "Other"] as DrainType[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Color</Label>
              <select
                value={form.color}
                onChange={(e) =>
                  setField("color", e.target.value as DrainColor)
                }
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                data-ocid="drain_monitor.color_select"
              >
                {(
                  ["Serous", "Bloody", "Bilious", "Purulent"] as DrainColor[]
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Amount (ml)</Label>
              <Input
                type="number"
                min={0}
                value={form.amount === 0 ? "" : form.amount}
                onChange={(e) =>
                  setField(
                    "amount",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                placeholder="ml"
                className="mt-1"
                data-ocid="drain_monitor.amount_input"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Time</Label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setField("time", e.target.value)}
                className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 font-mono"
                data-ocid="drain_monitor.time_input"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Any additional observations..."
              className="mt-1"
              data-ocid="drain_monitor.notes_input"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveEntry}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              data-ocid="drain_monitor.save_button"
            >
              Save Entry
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-orange-600" />
            Recent Entries
          </h4>
          {entries.slice(0, 20).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3"
              data-ocid="drain_monitor.entry_row"
            >
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[44px]">
                  <p className="text-xs font-bold text-orange-700">
                    {e.drainType}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">{e.time}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    {e.amount}{" "}
                    <span className="text-xs font-bold text-gray-500">ml</span>
                  </p>
                  <p className="text-xs text-gray-400">{e.date}</p>
                </div>
                <span
                  className={`text-xs border rounded-full px-2 py-0.5 font-medium ${DRAIN_COLOR_STYLES[e.color]}`}
                >
                  {e.color}
                </span>
                {e.notes && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {e.notes}
                  </span>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteEntry(e.id)}
                  className="text-red-400 hover:text-red-600"
                  data-ocid="drain_monitor.delete_button"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="text-center py-8 bg-white rounded-xl border border-gray-200"
          data-ocid="drain_monitor.empty_state"
        >
          <FlaskConical className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No drain entries yet.</p>
        </div>
      )}

      {/* 7-day trend charts per drain type */}
      {drainTypes.length > 0 && (
        <div className="space-y-4">
          {drainTypes.map((dt) => {
            const data = getDrainTrendData(dt as DrainType);
            const hasData = data.some((d) => d.amount > 0);
            return (
              <div
                key={dt}
                className="bg-white rounded-xl border border-orange-200 shadow-sm p-4"
              >
                <h4 className="font-semibold text-orange-800 mb-3 text-sm">
                  {dt} Drain — 7-Day Trend
                  <span className="text-xs font-normal ml-1 opacity-60">
                    (ml/day)
                  </span>
                </h4>
                {hasData ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        label={{
                          value: "ml",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontWeight: "bold", fontSize: 10 },
                        }}
                      />
                      <Tooltip formatter={(v: number) => [`${v} ml`, dt]} />
                      <Bar
                        dataKey="amount"
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    No data for the past 7 days
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
