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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SITE_CONFIG } from "@/hooks/useSiteConfig";
import { AlertTriangle, Phone, Search, Send } from "lucide-react";
import { useEffect, useState } from "react";

// Load emergency contacts from siteConfig localStorage
function loadEmergencyContacts() {
  try {
    const raw = localStorage.getItem("siteConfig");
    if (!raw) return DEFAULT_SITE_CONFIG.emergencyContacts;
    const cfg = JSON.parse(raw);
    if (cfg?.emergencyContacts?.length) return cfg.emergencyContacts;
    return DEFAULT_SITE_CONFIG.emergencyContacts;
  } catch {
    return DEFAULT_SITE_CONFIG.emergencyContacts;
  }
}

// Normalize register number: "0001/26" and "1/26" treated as equal
function normalizeRegNo(rn: string): string {
  const trimmed = rn.trim();
  const parts = trimmed.split("/");
  if (parts.length === 2) {
    const num = Number.parseInt(parts[0].trim(), 10);
    return `${Number.isNaN(num) ? parts[0].trim() : num}/${parts[1].trim()}`;
  }
  return trimmed.toLowerCase();
}

interface PatientRecord {
  fullName?: string;
  name?: string;
  dateOfBirth?: string | number;
  registerNumber?: string;
  phone?: string;
  id?: string | number;
  [key: string]: unknown;
}

function findPatientByRegNumber(regNum: string): PatientRecord | null {
  if (!regNum.trim()) return null;
  const norm = normalizeRegNo(regNum);
  try {
    // Scan all keys starting with patients_
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("patients_")) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) continue;
        const found = arr.find(
          (p: PatientRecord) =>
            p.registerNumber &&
            normalizeRegNo(String(p.registerNumber)) === norm,
        );
        if (found) return found as PatientRecord;
      } catch {}
    }
    // Also try the default medicare key
    const raw = localStorage.getItem("medicare_patients");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const found = arr.find(
          (p: PatientRecord) =>
            p.registerNumber &&
            normalizeRegNo(String(p.registerNumber)) === norm,
        );
        if (found) return found as PatientRecord;
      }
    }
  } catch {}
  return null;
}

function calcAge(dob: string | number | undefined): string {
  if (!dob) return "";
  try {
    let ms: number;
    if (typeof dob === "string" && dob.startsWith("__bigint__")) {
      ms = Number(BigInt(dob.slice(10)) / 1000000n);
    } else if (typeof dob === "number") {
      // nanoseconds or ms?
      ms = dob > 1e15 ? Math.floor(dob / 1e6) : dob;
    } else {
      ms = Number(dob);
    }
    if (!Number.isFinite(ms) || ms <= 0) return "";
    return String(Math.floor((Date.now() - ms) / (365.25 * 24 * 3600 * 1000)));
  } catch {
    return "";
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EmergencyConsultationModal({ open, onClose }: Props) {
  const [emergencyContacts, setEmergencyContacts] = useState(
    loadEmergencyContacts,
  );

  // Reload contacts from storage whenever the modal opens
  useEffect(() => {
    if (open) setEmergencyContacts(loadEmergencyContacts());
  }, [open]);

  const [registerNumber, setRegisterNumber] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [doctor, setDoctor] = useState("");
  const [error, setError] = useState("");
  const [regLookupMsg, setRegLookupMsg] = useState("");
  const [searching, setSearching] = useState(false);

  const handleRegLookup = (val: string) => {
    setRegisterNumber(val);
    if (!val.trim()) {
      setRegLookupMsg("");
      return;
    }
    setSearching(true);
    // small delay for UX
    setTimeout(() => {
      const patient = findPatientByRegNumber(val.trim());
      setSearching(false);
      if (patient) {
        const fullName = (patient.fullName || patient.name || "") as string;
        setName(fullName);
        const ageVal = calcAge(
          patient.dateOfBirth as string | number | undefined,
        );
        if (ageVal) setAge(ageVal);
        if (patient.phone) setPhone(String(patient.phone));
        setRegLookupMsg(
          `✓ Found: ${fullName}${ageVal ? `, ${ageVal} yrs` : ""}`,
        );
      } else {
        setRegLookupMsg("Patient not found with this register number.");
      }
    }, 300);
  };

  const handleSend = () => {
    if (!name.trim() || !age || !symptoms.trim() || !doctor) {
      setError("Please fill in all required fields before sending.");
      return;
    }
    setError("");
    const contact = emergencyContacts.find((c) => c.doctorName === doctor);
    const number = contact?.whatsappNumber || "";
    const regPart = registerNumber ? `\nReg. No.: ${registerNumber}` : "";
    const phonePart = phone ? `\nPhone: ${phone}` : "";
    const baseMessage =
      contact?.prefilledMessage ||
      `Emergency Consultation Request\n\nDoctor: ${doctor}`;
    const message = `🚨 ${baseMessage}\n\nName: ${name}${regPart}\nAge: ${age} years${phonePart}\nSymptoms: ${symptoms}\n\nSent from Dr. Arman Kabir's Care portal.`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    // reset
    setRegisterNumber("");
    setName("");
    setAge("");
    setPhone("");
    setSymptoms("");
    setDoctor("");
    setRegLookupMsg("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-ocid="emergency.dialog">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <DialogTitle className="text-destructive text-lg font-bold">
              Emergency Consultation
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Fill in your details and we will connect you with a doctor via
            WhatsApp immediately.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Register number lookup */}
          <div className="space-y-1.5">
            <Label htmlFor="em-regnum">
              Register Number{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (optional — auto-fills your details)
              </span>
            </Label>
            <div className="relative">
              <Input
                id="em-regnum"
                placeholder="e.g. 0001/26"
                value={registerNumber}
                onChange={(e) => handleRegLookup(e.target.value)}
                className="pr-8"
                data-ocid="emergency.input"
              />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            {searching && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Searching...
              </p>
            )}
            {regLookupMsg && !searching && (
              <p
                className={`text-xs font-medium ${
                  regLookupMsg.startsWith("✓")
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {regLookupMsg}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="em-name">Patient Name *</Label>
            <Input
              id="em-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-ocid="emergency.input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="em-age">Age *</Label>
              <Input
                id="em-age"
                type="number"
                placeholder="Age (years)"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={0}
                max={120}
                data-ocid="emergency.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-phone">Phone</Label>
              <Input
                id="em-phone"
                type="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-ocid="emergency.input"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Select Doctor *</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectTrigger data-ocid="emergency.select">
                <SelectValue placeholder="Choose a doctor" />
              </SelectTrigger>
              <SelectContent>
                {emergencyContacts.map((c) => (
                  <SelectItem key={c.doctorName} value={c.doctorName}>
                    {c.doctorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="em-symptoms">Symptoms / Complaint *</Label>
            <Textarea
              id="em-symptoms"
              placeholder="Describe your emergency symptoms briefly..."
              rows={3}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              data-ocid="emergency.textarea"
            />
          </div>

          {error && (
            <p
              className="text-sm text-destructive"
              data-ocid="emergency.error_state"
            >
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-ocid="emergency.cancel_button"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-destructive hover:bg-destructive/90 text-white gap-2"
              onClick={handleSend}
              data-ocid="emergency.submit_button"
            >
              <Send className="w-4 h-4" />
              Send via WhatsApp
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Phone className="w-3 h-3 shrink-0" />
            <span>
              This will open WhatsApp with a pre-filled message to the selected
              doctor&apos;s number.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
