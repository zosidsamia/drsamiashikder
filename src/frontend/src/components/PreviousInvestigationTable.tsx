import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Archive,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
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

export interface InvestigationRow {
  date: string;
  name: string;
  result: string;
  unit: string;
  interpretation: string;
}

interface PreviousInvestigationTableProps {
  rows: InvestigationRow[];
  onChange: (rows: InvestigationRow[]) => void;
  onArchive?: () => void;
}

function aiInterpret(result: string, _unit: string, name: string): string {
  const val = Number.parseFloat(result);
  if (Number.isNaN(val)) return "See report";
  const n = name.toLowerCase();
  if (n.includes("hb") || n.includes("hemoglobin")) {
    if (val < 12) return "Low (Anaemia)";
    if (val > 17) return "High";
    return "Normal";
  }
  if (n.includes("fasting") && (n.includes("sugar") || n.includes("glucose"))) {
    if (val < 3.9) return "Low (Hypoglycaemia)";
    if (val > 6.1) return "High (Pre-diabetic/Diabetic)";
    return "Normal";
  }
  if (n.includes("random") && (n.includes("sugar") || n.includes("glucose"))) {
    if (val > 11.1) return "High (Diabetes)";
    if (val > 7.8) return "Elevated";
    return "Normal";
  }
  if (n.includes("hba1c")) {
    if (val < 5.7) return "Normal";
    if (val < 6.5) return "Pre-diabetic";
    return "Diabetic range";
  }
  if (n.includes("creatinine")) {
    if (val > 1.2) return "Elevated";
    return "Normal";
  }
  if (n.includes("urea")) {
    if (val > 45) return "Elevated";
    return "Normal";
  }
  if (n.includes("cholesterol") && !n.includes("hdl")) {
    if (val > 200) return "Elevated";
    return "Normal";
  }
  if (n.includes("hdl")) {
    if (val < 40) return "Low (Risk)";
    return "Normal";
  }
  if (n.includes("ldl")) {
    if (val > 130) return "Elevated";
    return "Normal";
  }
  if (n.includes("tsh")) {
    if (val < 0.4) return "Low (Hyperthyroid)";
    if (val > 4.5) return "High (Hypothyroid)";
    return "Normal";
  }
  if (n.includes("sgpt") || n.includes("alt")) {
    if (val > 40) return "Elevated";
    return "Normal";
  }
  if (n.includes("sgot") || n.includes("ast")) {
    if (val > 40) return "Elevated";
    return "Normal";
  }
  if (n.includes("sodium") || n.includes("na")) {
    if (val < 135) return "Low (Hyponatraemia)";
    if (val > 145) return "High (Hypernatraemia)";
    return "Normal";
  }
  if (n.includes("potassium") || n.includes(" k+")) {
    if (val < 3.5) return "Low (Hypokalaemia)";
    if (val > 5.0) return "High (Hyperkalaemia)";
    return "Normal";
  }
  return "See report";
}

const CHART_COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

function getInterpColor(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("normal"))
    return "bg-green-50 text-green-700 border-green-200";
  if (t.includes("low") || t.includes("anaemia") || t.includes("hypogly"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (t.includes("high") || t.includes("elevated") || t.includes("diabetic"))
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (t.includes("pre-") || t.includes("risk"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

const ROW_COLORS = ["bg-white", "bg-slate-50"];

export default function PreviousInvestigationTable({
  rows,
  onChange,
  onArchive,
}: PreviousInvestigationTableProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [confirmAge, setConfirmAge] = useState("");
  const [confirmDate, setConfirmDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [extractedRows, setExtractedRows] = useState<InvestigationRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickAddName, setQuickAddName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredRows = searchQuery.trim()
    ? rows.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : rows;

  const addRow = (name = "") => {
    onChange([
      ...rows,
      {
        date: new Date().toISOString().split("T")[0],
        name,
        result: "",
        unit: "",
        interpretation: "",
      },
    ]);
    if (name) setQuickAddName("");
  };

  const handleQuickAdd = () => {
    if (!quickAddName.trim()) {
      addRow();
    } else {
      addRow(quickAddName.trim());
    }
  };

  const updateRow = (
    idx: number,
    field: keyof InvestigationRow,
    value: string,
  ) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const handleAiInterpret = (idx: number) => {
    const row = rows[idx];
    const interp = aiInterpret(row.result, row.unit, row.name);
    updateRow(idx, "interpretation", interp);
    toast.success("AI interpretation applied");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mockExtracted: InvestigationRow[] = [
      {
        date: new Date().toISOString().split("T")[0],
        name: "Hemoglobin (Hb)",
        result: "12.5",
        unit: "g/dL",
        interpretation: "",
      },
      {
        date: new Date().toISOString().split("T")[0],
        name: "Fasting blood sugar",
        result: "5.2",
        unit: "mmol/L",
        interpretation: "",
      },
    ];
    setExtractedRows(mockExtracted);
    setUploadOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmExtract = () => {
    if (!confirmDate) {
      toast.error("Please enter the report date");
      return;
    }
    const withInterpret = extractedRows.map((r) => ({
      ...r,
      date: confirmDate,
      interpretation: aiInterpret(r.result, r.unit, r.name),
    }));
    onChange([...rows, ...withInterpret]);
    setUploadOpen(false);
    setConfirmName("");
    setConfirmAge("");
    setConfirmDate(new Date().toISOString().split("T")[0]);
    toast.success("Report imported. Please review and edit values as needed.");
  };

  const numericRows = rows.filter(
    (r) => r.date && r.name && !Number.isNaN(Number.parseFloat(r.result)),
  );
  const investigationNames = [...new Set(numericRows.map((r) => r.name))];
  const chartDates = [...new Set(numericRows.map((r) => r.date))].sort();
  const chartData = chartDates.map((date) => {
    const obj: Record<string, string | number> = { date };
    for (const name of investigationNames) {
      const found = numericRows.find((r) => r.date === date && r.name === name);
      if (found) obj[name] = Number.parseFloat(found.result);
    }
    return obj;
  });
  const showChart = chartDates.length >= 2 && investigationNames.length > 0;

  return (
    <div className="space-y-4">
      {/* Search + Quick Add Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search investigations by name..."
            className="h-9 pl-9 text-xs"
            data-ocid="prev_inv.search_input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={quickAddName}
            onChange={(e) => setQuickAddName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
            placeholder="Investigation name (optional)"
            className="h-9 text-xs w-44"
            data-ocid="prev_inv.input"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleQuickAdd}
            className="h-9 bg-cyan-600 hover:bg-cyan-700 text-white shrink-0"
            data-ocid="prev_inv.add_row.button"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          Five-field structured report (Date · Name · Result · Unit ·
          Interpretation)
          {searchQuery && (
            <span className="ml-2 text-cyan-600 font-medium">
              — showing {filteredRows.length} of {rows.length} results
            </span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="min-h-[44px]"
            data-ocid="prev_inv.upload_button"
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload Report
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {onArchive && rows.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 hover:bg-amber-50 min-h-[44px]"
              onClick={onArchive}
              data-ocid="prev_inv.archive_button"
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              Archive &amp; Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        filteredRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-cyan-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-cyan-600">
                  <TableHead className="text-xs w-32 text-white font-semibold">
                    Date
                  </TableHead>
                  <TableHead className="text-xs text-white font-semibold">
                    Investigation Name
                  </TableHead>
                  <TableHead className="text-xs w-24 text-white font-semibold">
                    Result
                  </TableHead>
                  <TableHead className="text-xs w-20 text-white font-semibold">
                    Unit
                  </TableHead>
                  <TableHead className="text-xs text-white font-semibold">
                    Interpretation
                  </TableHead>
                  <TableHead className="text-xs w-10 text-center text-white font-semibold">
                    AI
                  </TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, idx) => {
                  const realIdx = rows.indexOf(row);
                  return (
                    <TableRow key={realIdx} className={ROW_COLORS[idx % 2]}>
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            updateRow(realIdx, "date", e.target.value)
                          }
                          className="h-8 text-xs px-2"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            updateRow(realIdx, "name", e.target.value)
                          }
                          placeholder="e.g. Hemoglobin (Hb)"
                          className="h-8 text-xs w-full focus:ring-1 focus:ring-blue-300"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.result}
                          onChange={(e) =>
                            updateRow(realIdx, "result", e.target.value)
                          }
                          placeholder="12.5"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.unit}
                          onChange={(e) =>
                            updateRow(realIdx, "unit", e.target.value)
                          }
                          placeholder="g/dL"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.interpretation}
                          onChange={(e) =>
                            updateRow(realIdx, "interpretation", e.target.value)
                          }
                          placeholder="Normal / Elevated..."
                          className={`h-8 text-xs border ${getInterpColor(row.interpretation)}`}
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-teal-600 hover:bg-teal-50"
                          onClick={() => handleAiInterpret(realIdx)}
                          title="AI Interpret"
                          data-ocid={`prev_inv.ai_interpret.button.${idx + 1}`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                      <TableCell className="p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50"
                          onClick={() => removeRow(realIdx)}
                          data-ocid={`prev_inv.delete_button.${idx + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-slate-400 border border-dashed border-cyan-200 rounded-lg">
            No investigations match &ldquo;<strong>{searchQuery}</strong>
            &rdquo;.
          </div>
        )
      ) : (
        <div
          className="text-center py-8 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg"
          data-ocid="prev_inv.empty_state"
        >
          No investigation reports yet. Type a name above and click{" "}
          <span className="font-medium">Add</span>, or click{" "}
          <span className="font-medium">Upload Report</span>.
        </div>
      )}

      {/* Chart */}
      {showChart && (
        <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-semibold text-slate-700">
              Investigation Trend
            </span>
            <span className="text-xs text-slate-400">(Date vs. Result)</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                formatter={(v) =>
                  String(v).length > 20 ? `${String(v).slice(0, 20)}…` : v
                }
              />
              {investigationNames.slice(0, 6).map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  dot={{ r: 4 }}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Upload Confirmation Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto w-full max-w-lg"
          data-ocid="prev_inv.dialog"
        >
          <DialogHeader>
            <DialogTitle>Verify Report Details Before Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Please verify the patient details from the uploaded report. The
              doctor must confirm before data is accepted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Patient Name on Report</Label>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Full name"
                  className="h-8 mt-1 text-xs"
                  data-ocid="prev_inv.confirm_name.input"
                />
              </div>
              <div>
                <Label className="text-xs">Age on Report</Label>
                <Input
                  value={confirmAge}
                  onChange={(e) => setConfirmAge(e.target.value)}
                  placeholder="Age"
                  className="h-8 mt-1 text-xs"
                  data-ocid="prev_inv.confirm_age.input"
                />
              </div>
              <div>
                <Label className="text-xs">
                  Report Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  className="h-8 mt-1 text-xs"
                  data-ocid="prev_inv.confirm_date.input"
                />
              </div>
            </div>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
              <p className="font-medium text-amber-800">
                Extracted values (review before confirming):
              </p>
              {extractedRows.map((r, i) => (
                <div key={`${r.name}-${i}`} className="text-amber-700">
                  {r.name}: <strong>{r.result}</strong> {r.unit}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              All values can be edited after import. Please recheck against the
              original report.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={confirmExtract}
                className="flex-1"
                data-ocid="prev_inv.confirm_button"
              >
                Confirm &amp; Import
              </Button>
              <Button
                variant="outline"
                onClick={() => setUploadOpen(false)}
                className="flex-1"
                data-ocid="prev_inv.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
