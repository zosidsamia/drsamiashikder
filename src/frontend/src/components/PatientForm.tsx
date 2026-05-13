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
  AlertTriangle,
  Camera,
  Eye,
  Loader2,
  User,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadFromStorage } from "../hooks/useQueries";
import type { Patient } from "../types";

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

export function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function feetInchesToCm(str: string): number | null {
  const match = str.match(/(\d+)['\s]*(?:ft)?['\s]*(\d*)["\s]*(?:in)?/i);
  if (!match) return null;
  const feet = Number.parseInt(match[1]) || 0;
  const inches = Number.parseInt(match[2]) || 0;
  const cm = feet * 30.48 + inches * 2.54;
  return cm > 0 ? Math.round(cm * 10) / 10 : null;
}

function dobToBigInt(dateStr: string): bigint | null {
  if (!dateStr) return null;
  try {
    const ms = new Date(dateStr).getTime();
    if (Number.isNaN(ms)) return null;
    return BigInt(ms) * 1000000n;
  } catch {
    return null;
  }
}

function ageToApproxDob(age: string): string {
  const n = Number.parseInt(age);
  if (Number.isNaN(n) || n < 0 || n > 130) return "";
  const year = new Date().getFullYear() - n;
  return `${year}-01-01`;
}

/** Scan all localStorage patient keys across all doctor emails */
function loadAllPatients(): Patient[] {
  const results: Patient[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("patients_")) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const items = JSON.parse(raw) as Patient[];
      if (Array.isArray(items)) results.push(...items);
    } catch {}
  }
  return results;
}

interface DuplicateMatch {
  patient: Patient;
  matchField: "phone" | "email";
}

export interface PatientFormData {
  fullName: string;
  nameBn: string | null;
  dateOfBirth: bigint | null;
  gender: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bloodGroup: string | null;
  weight: number | null;
  height: number | null;
  allergies: string[];
  chronicConditions: string[];
  pastSurgicalHistory: string | null;
  patientType: string;
  photo?: string | null;
}

interface PatientFormProps {
  patient?: Patient;
  prefill?: Partial<{
    fullName: string;
    phone: string;
    gender: string;
  }>;
  onSubmit: (data: PatientFormData) => void;
  onCancel: () => void;
  onViewExisting?: (patientId: bigint) => void;
  isLoading?: boolean;
}

export default function PatientForm({
  patient,
  prefill,
  onSubmit,
  onCancel,
  onViewExisting,
  isLoading,
}: PatientFormProps) {
  const dob = patient?.dateOfBirth
    ? new Date(Number(patient.dateOfBirth / 1000000n))
        .toISOString()
        .split("T")[0]
    : "";

  const existingPhoto =
    ((patient as Record<string, unknown>)?.photo as string | null) ?? null;
  const existingRegNum =
    ((patient as Record<string, unknown>)?.registerNumber as string | null) ??
    null;

  const [form, setForm] = useState({
    fullName: patient?.fullName ?? prefill?.fullName ?? "",
    nameBn: patient?.nameBn ?? "",
    dateOfBirth: dob,
    ageInput: "",
    gender: patient?.gender ?? prefill?.gender ?? "male",
    phone: patient?.phone ?? prefill?.phone ?? "",
    email: patient?.email ?? "",
    address: patient?.address ?? "",
    bloodGroup: patient?.bloodGroup ?? "unknown",
    weight: patient?.weight != null ? String(patient.weight) : "",
    height: patient?.height != null ? cmToFeetInches(patient.height) : "",
    patientType: patient?.patientType ?? "outdoor",
  });

  const [photo, setPhoto] = useState<string | null>(existingPhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Duplicate detection state ──────────────────────────────────────────────
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(
    null,
  );
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for duplicates when phone or email changes (debounced 500ms)
  // Only for new patient registration (no existing patient prop)
  useEffect(() => {
    if (patient) return; // editing existing — skip

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const phone = form.phone.trim();
      const email = form.email.trim().toLowerCase();

      if (!phone && !email) {
        setDuplicateMatch(null);
        return;
      }

      const allPatients = loadAllPatients();
      let match: DuplicateMatch | null = null;

      if (phone) {
        const found = allPatients.find((p) => p.phone?.trim() === phone);
        if (found) match = { patient: found, matchField: "phone" };
      }

      if (!match && email) {
        const found = allPatients.find(
          (p) => p.email?.trim().toLowerCase() === email,
        );
        if (found) match = { patient: found, matchField: "email" };
      }

      setDuplicateMatch(match);
      if (match) setProceedAnyway(false);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.phone, form.email, patient]);

  const set = (key: keyof typeof form, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;

    let dobBigInt: bigint | null = dobToBigInt(form.dateOfBirth);
    if (!dobBigInt && form.ageInput.trim()) {
      const approx = ageToApproxDob(form.ageInput.trim());
      dobBigInt = dobToBigInt(approx);
    }

    try {
      onSubmit({
        fullName: form.fullName.trim(),
        nameBn: form.nameBn.trim() || null,
        dateOfBirth: dobBigInt,
        gender: form.gender,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        bloodGroup:
          form.bloodGroup === "unknown" ? null : form.bloodGroup || null,
        weight: form.weight ? Number.parseFloat(form.weight) : null,
        height: form.height ? feetInchesToCm(form.height) : null,
        allergies: [],
        chronicConditions: [],
        pastSurgicalHistory: null,
        patientType: form.patientType,
        photo: photo ?? null,
      });
    } catch (err) {
      console.error("PatientForm submit error:", err);
    }
  };

  const getDuplicateRegNum = () => {
    const p = duplicateMatch?.patient;
    return (p as Record<string, unknown>)?.registerNumber as string | undefined;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Register number display (if already registered) */}
      {existingRegNum && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
          <span className="text-xs text-muted-foreground">Register No.:</span>
          <span className="font-bold text-primary tracking-wider">
            {existingRegNum}
          </span>
        </div>
      )}

      {/* Photo upload */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          title="Upload patient photo"
        >
          {photo ? (
            <img
              src={photo}
              alt="Patient"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-muted-foreground" />
          )}
        </button>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
            data-ocid="patient_form.upload_button"
          >
            <Camera className="w-3.5 h-3.5" />
            {photo ? "Change Photo" : "Add Photo"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">Optional</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>
      </div>

      {/* Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">
            Full Name (English only) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Patient full name"
            required
            data-ocid="patient_form.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameBn">Bangla Name</Label>
          <Input
            id="nameBn"
            value={form.nameBn}
            onChange={(e) => set("nameBn", e.target.value)}
            placeholder="বাংলা নাম (optional)"
          />
        </div>
      </div>

      {/* DOB + Age + Gender + Patient Type */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input
            id="dob"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => {
              set("dateOfBirth", e.target.value);
              if (e.target.value) set("ageInput", "");
            }}
          />
          {form.dateOfBirth && calculateAge(form.dateOfBirth) !== null && (
            <p className="text-xs text-teal-700 font-semibold mt-1">
              Age: {calculateAge(form.dateOfBirth)} years
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ageInput">
            Age (years){" "}
            <span className="text-muted-foreground font-normal text-xs">
              or DOB
            </span>
          </Label>
          <Input
            id="ageInput"
            type="number"
            min="0"
            max="130"
            value={form.ageInput}
            onChange={(e) => {
              set("ageInput", e.target.value);
              if (e.target.value) set("dateOfBirth", "");
            }}
            placeholder="e.g. 35"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger data-ocid="patient_form.select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Patient Type</Label>
          <Select
            value={form.patientType}
            onValueChange={(v) => set("patientType", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outdoor">Outdoor</SelectItem>
              <SelectItem value="admitted">Admitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+880…"
            type="tel"
            data-ocid="patient_form.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="patient@example.com"
            type="email"
            data-ocid="patient_form.input"
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street, City"
          />
        </div>
      </div>

      {/* Clinical */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Blood Group</Label>
          <Select
            value={form.bloodGroup}
            onValueChange={(v) => set("bloodGroup", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "A+",
                "A-",
                "B+",
                "B-",
                "O+",
                "O-",
                "AB+",
                "AB-",
                "unknown",
              ].map((bg) => (
                <SelectItem key={bg} value={bg}>
                  {bg === "unknown" ? "Unknown" : bg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input
            id="weight"
            value={form.weight}
            onChange={(e) => set("weight", e.target.value)}
            placeholder="65"
            type="number"
            step="0.1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="height">Height</Label>
          <Input
            id="height"
            value={form.height}
            onChange={(e) => set("height", e.target.value)}
            placeholder={"5'8\""}
            type="text"
          />
        </div>
      </div>

      {/* ── Duplicate Detection Warning ────────────────────────────────────── */}
      {!patient && duplicateMatch && !proceedAnyway && (
        <div
          className="flex flex-col gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3"
          data-ocid="patient_form.duplicate_warning"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                Possible duplicate patient
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                A patient with this{" "}
                <strong>
                  {duplicateMatch.matchField === "phone"
                    ? "phone number"
                    : "email address"}
                </strong>{" "}
                already exists:
              </p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-bold text-amber-900 text-sm">
                  {duplicateMatch.patient.fullName}
                </span>
                {getDuplicateRegNum() && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-400 text-amber-700 font-mono"
                  >
                    {getDuplicateRegNum()}
                  </Badge>
                )}
                {duplicateMatch.patient.gender && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-300 text-amber-600"
                  >
                    {duplicateMatch.patient.gender}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {onViewExisting && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-100"
                onClick={() => onViewExisting(duplicateMatch.patient.id)}
                data-ocid="patient_form.view_existing_button"
              >
                <Eye className="w-3.5 h-3.5" />
                View Existing Patient
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-100"
              onClick={() => setProceedAnyway(true)}
              data-ocid="patient_form.create_anyway_button"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Anyway
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-ocid="patient_form.cancel_button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isLoading ||
            !form.fullName.trim() ||
            (!patient && !!duplicateMatch && !proceedAnyway)
          }
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          data-ocid="patient_form.submit_button"
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {patient ? "Update Patient" : "Register Patient"}
        </Button>
      </div>
    </form>
  );
}
