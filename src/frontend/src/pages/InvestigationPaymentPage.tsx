/**
 * InvestigationPaymentPage — Walk-in investigation request form.
 * ANY person can submit an investigation (no prior patient registration needed).
 * Existing registered patients can be fast-filled via search.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  CreditCard,
  FlaskConical,
  Search,
  UserSearch,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import InvestigationPaymentComponent from "../components/InvestigationPayment";
import WalkInInvestigationForm from "../components/WalkInInvestigationForm";
import { useEmailAuth } from "../hooks/useEmailAuth";

interface PatientEntry {
  id: unknown;
  fullName?: string;
  name?: string;
  registerNumber?: string;
  phone?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  sex?: string;
}

function loadAllPatients(): PatientEntry[] {
  const results: PatientEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("patients_")) continue;
      const arr: PatientEntry[] = JSON.parse(localStorage.getItem(k) || "[]");
      results.push(...arr);
    }
  } catch {}
  return results;
}

function getPatientIdStr(p: PatientEntry): string {
  const rawId = p.id;
  return typeof rawId === "string" && rawId.startsWith("__bigint__")
    ? rawId.slice(10)
    : String(rawId);
}

function calcAge(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age > 0 ? age : undefined;
}

type Mode = "walkin" | "registered";

export default function InvestigationPaymentPage() {
  const { currentDoctor } = useEmailAuth();
  const [mode, setMode] = useState<Mode>("walkin");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PatientEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const patients = loadAllPatients();
  const filtered = search.trim()
    ? patients.filter((p) => {
        const name = (p.fullName ?? p.name ?? "").toLowerCase();
        const reg = (p.registerNumber ?? "").toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || reg.includes(q);
      })
    : [];

  const doctorLabel = currentDoctor
    ? `${currentDoctor.designation ?? ""} ${currentDoctor.name}`.trim()
    : undefined;

  return (
    <div
      className="max-w-5xl mx-auto px-4 py-6 space-y-6"
      data-ocid="inv_payment.page"
    >
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-sm">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Investigation Payment
          </h1>
          <p className="text-sm text-muted-foreground">
            Walk-in requests welcome — no prior registration required
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div
        className="flex gap-1 bg-muted/40 rounded-xl p-1 border border-border"
        data-ocid="inv_payment.mode.toggle"
      >
        <button
          type="button"
          onClick={() => {
            setMode("walkin");
            setSelected(null);
            setSearch("");
          }}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            mode === "walkin"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="inv_payment.walkin.tab"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Walk-in / New Patient
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("registered");
            setSelected(null);
            setSearch("");
            setTimeout(() => searchRef.current?.focus(), 80);
          }}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            mode === "registered"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="inv_payment.registered.tab"
        >
          <UserSearch className="w-3.5 h-3.5" />
          Registered Patient
        </button>
      </div>

      {/* ── WALK-IN MODE ── */}
      {mode === "walkin" && (
        <WalkInInvestigationForm doctorName={doctorLabel} />
      )}

      {/* ── REGISTERED PATIENT MODE ── */}
      {mode === "registered" &&
        (!selected ? (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Search className="w-4 h-4 text-blue-600" />
              Search registered patient
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Patient name or register number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-ocid="inv_payment.search_input"
              />
            </div>

            {search.trim() && filtered.length === 0 && (
              <div
                className="text-sm text-muted-foreground text-center py-6 space-y-2"
                data-ocid="inv_payment.empty_state"
              >
                <UserSearch className="w-8 h-8 opacity-30 mx-auto" />
                <p>No registered patients found.</p>
                <button
                  type="button"
                  className="text-purple-600 hover:underline text-xs font-semibold"
                  onClick={() => {
                    setMode("walkin");
                    setSearch("");
                  }}
                >
                  Use Walk-in form instead →
                </button>
              </div>
            )}

            {filtered.length > 0 && (
              <div
                className="space-y-2 max-h-80 overflow-y-auto"
                data-ocid="inv_payment.list"
              >
                {filtered.map((p, idx) => {
                  const name = p.fullName ?? p.name ?? "Unknown";
                  const age = p.age ?? calcAge(p.dateOfBirth);
                  return (
                    <button
                      key={getPatientIdStr(p)}
                      type="button"
                      onClick={() => {
                        setSelected(p);
                        setSearch("");
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-left"
                      data-ocid={`inv_payment.item.${idx + 1}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                        {name
                          .split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {age ? `${age} yrs` : ""}
                          {p.registerNumber ? (
                            <span className="font-mono ml-1">
                              · {p.registerNumber}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 text-blue-700 border-blue-300"
                      >
                        Select
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}

            {!search.trim() && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <UserSearch className="w-8 h-8 opacity-30" />
                <p className="text-sm">
                  Type to search for a registered patient
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected patient banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-bold text-sm shrink-0">
                {(selected.fullName ?? selected.name ?? "?")
                  .split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-blue-900 truncate">
                  {selected.fullName ?? selected.name}
                </p>
                <p className="text-xs text-blue-700">
                  {(() => {
                    const age = selected.age ?? calcAge(selected.dateOfBirth);
                    return age ? `${age} yrs · ` : "";
                  })()}
                  {selected.registerNumber ? (
                    <span className="font-mono">{selected.registerNumber}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Registered
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={() => setSelected(null)}
                  data-ocid="inv_payment.close_button"
                >
                  <X className="w-3.5 h-3.5" />
                  Change
                </Button>
              </div>
            </div>

            {/* Investigation payment component for registered patient */}
            <InvestigationPaymentComponent
              patientId={getPatientIdStr(selected)}
              patientName={selected.fullName ?? selected.name ?? ""}
              registerNumber={selected.registerNumber}
              phone={selected.phone ?? selected.mobileNumber}
              doctorName={doctorLabel}
              patientAge={selected.age ?? calcAge(selected.dateOfBirth)}
              patientSex={
                (selected.sex ?? selected.gender) as
                  | "Male"
                  | "Female"
                  | "Other"
                  | undefined
              }
            />
          </div>
        ))}

      {/* Footer receipt history link */}
      {mode === "walkin" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMode("registered")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            data-ocid="inv_payment.switch_registered.button"
          >
            <CreditCard className="w-3.5 h-3.5" />
            View registered patient history
          </button>
        </div>
      )}
    </div>
  );
}
