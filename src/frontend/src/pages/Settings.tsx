import { ClassroomSettings } from "@/components/ClassroomSettings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Hospital,
  Link,
  LogOut,
  MapPin,
  MonitorPlay,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Settings2,
  Shield,
  Stethoscope,
  TestTube,
  Trash2,
  Upload,
  User,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadInvestigationRates } from "../components/InvestigationPayment";
import { useAdminAuth } from "../hooks/useAdminAuth";
import {
  type DoctorAccount,
  type PatientAccount,
  getAuditLog,
  loadPatientRegistry,
  loadRegistry,
  savePatientRegistry,
  saveRegistry,
  useEmailAuth,
} from "../hooks/useEmailAuth";
import type { InvestigationRate } from "../types";
import { STAFF_ROLE_LABELS, type StaffRole } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DESIGNATIONS = ["Dr.", "Prof.", "Assoc. Prof.", "Mr.", "Ms.", "Mrs."];

function getStoredPassword(id: string): string {
  try {
    const registry = loadRegistry();
    const doc = registry.find((d) => d.id === id);
    if (doc?.passwordHash) {
      const decoded = atob(doc.passwordHash);
      return decoded.split("::")[1] || "••••••";
    }
  } catch {}
  return "••••••";
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PhotoUploader({
  storageKey,
  label,
  ocidPrefix,
}: {
  storageKey: string;
  label: string;
  ocidPrefix: string;
}) {
  const [photo, setPhoto] = useState<string | null>(() =>
    localStorage.getItem(storageKey),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = label
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Photo must be under 3 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      localStorage.setItem(storageKey, dataUrl);
      setPhoto(dataUrl);
      toast.success("Photo updated");
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="relative group cursor-pointer"
        onClick={() => fileRef.current?.click()}
        aria-label={`Upload photo for ${label}`}
      >
        {photo ? (
          <img
            src={photo}
            alt={label}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-border"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="w-5 h-5 text-white" />
        </div>
      </button>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <button
          type="button"
          className="text-xs text-primary hover:underline mt-0.5"
          onClick={() => fileRef.current?.click()}
          data-ocid={`${ocidPrefix}.upload_button`}
        >
          {photo ? "Change photo" : "Upload photo"}
        </button>
        {photo && (
          <button
            type="button"
            className="text-xs text-destructive hover:underline ml-3"
            onClick={() => {
              localStorage.removeItem(storageKey);
              setPhoto(null);
              toast.success("Photo removed");
            }}
            data-ocid={`${ocidPrefix}.delete_button`}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

function PdfUploader({
  storageKey,
  label,
  ocidPrefix,
}: {
  storageKey: string;
  label: string;
  ocidPrefix: string;
}) {
  const [fileName, setFileName] = useState<string | null>(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw).name || "Uploaded";
    } catch {
      return "Uploaded";
    }
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF must be under 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      localStorage.setItem(
        storageKey,
        JSON.stringify({ name: file.name, data: dataUrl }),
      );
      setFileName(file.name);
      toast.success(`${label} updated`);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
      <FileText className="w-8 h-8 text-primary/60 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {fileName ? (
          <p className="text-xs text-muted-foreground truncate">{fileName}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No file uploaded</p>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs"
          onClick={() => fileRef.current?.click()}
          data-ocid={`${ocidPrefix}.upload_button`}
        >
          <Upload className="w-3 h-3" />
          Upload
        </Button>
        {fileName && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => {
              localStorage.removeItem(storageKey);
              setFileName(null);
              toast.success("Removed");
            }}
            data-ocid={`${ocidPrefix}.delete_button`}
          >
            <XCircle className="w-3 h-3" />
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ── ADMIN PANELS ──────────────────────────────────────────────────────────────

function AdminUserManagement() {
  const [staffList, setStaffList] = useState<DoctorAccount[]>([]);
  const [patientList, setPatientList] = useState<PatientAccount[]>([]);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, StaffRole>>(
    {},
  );
  const [reassignMap, setReassignMap] = useState<Record<string, StaffRole>>({});

  const refresh = useCallback(() => {
    setStaffList(loadRegistry().filter((d) => d.status === "pending"));
    setPatientList(loadPatientRegistry().filter((p) => p.status === "pending"));
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  const approveStaff = (acc: DoctorAccount) => {
    const role = approvalRoles[acc.id] ?? acc.role ?? "doctor";
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === acc.id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "approved", role };
      saveRegistry(reg);
      refresh();
      toast.success(
        `Approved as ${STAFF_ROLE_LABELS[role as Exclude<StaffRole, "admin" | "patient">]}`,
      );
    }
  };
  const rejectStaff = (id: string) => {
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "rejected" };
      saveRegistry(reg);
      refresh();
      toast.success("Account rejected");
    }
  };
  const approvePatient = (id: string) => {
    const reg = loadPatientRegistry();
    const idx = reg.findIndex((p) => p.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "approved" };
      savePatientRegistry(reg);
      refresh();
      toast.success("Patient account approved");
    }
  };
  const rejectPatient = (id: string) => {
    const reg = loadPatientRegistry();
    const idx = reg.findIndex((p) => p.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], status: "rejected" };
      savePatientRegistry(reg);
      refresh();
      toast.success("Patient account rejected");
    }
  };
  const doReassign = (id: string) => {
    const role = reassignMap[id];
    if (!role) return;
    const reg = loadRegistry();
    const idx = reg.findIndex((d) => d.id === id);
    if (idx >= 0) {
      reg[idx] = { ...reg[idx], role };
      saveRegistry(reg);
      refresh();
      toast.success(
        `Role updated to ${STAFF_ROLE_LABELS[role as Exclude<StaffRole, "admin" | "patient">]}`,
      );
    }
  };

  const approvedStaff = loadRegistry().filter((d) => d.status === "approved");
  const staffRoleOptions = Object.keys(STAFF_ROLE_LABELS) as Exclude<
    StaffRole,
    "admin" | "patient"
  >[];

  return (
    <div className="space-y-6">
      {/* Pending Staff */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-4 h-4 text-amber-600" />
            Pending Staff Approvals
            {staffList.length > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                {staffList.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffList.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-ocid="admin.staff_pending.empty_state"
            >
              No pending staff registrations.
            </p>
          ) : (
            <div className="space-y-3">
              {staffList.map((acc, i) => (
                <div
                  key={acc.id}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3"
                  data-ocid={`admin.staff_pending.item.${i + 1}`}
                >
                  <div>
                    <p className="font-semibold text-foreground">{acc.name}</p>
                    <p className="text-sm text-muted-foreground">{acc.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="text-xs border-blue-200 text-blue-700"
                      >
                        {STAFF_ROLE_LABELS[
                          acc.role as Exclude<StaffRole, "admin" | "patient">
                        ] ?? acc.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(acc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Approve as:</Label>
                    <Select
                      value={approvalRoles[acc.id] ?? acc.role ?? "doctor"}
                      onValueChange={(v) =>
                        setApprovalRoles((p) => ({
                          ...p,
                          [acc.id]: v as StaffRole,
                        }))
                      }
                    >
                      <SelectTrigger
                        className="h-8 text-xs flex-1"
                        data-ocid="admin.staff_role.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {staffRoleOptions.map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">
                            {STAFF_ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                      onClick={() => approveStaff(acc)}
                      data-ocid="admin.staff.approve_button"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-700 border-red-300 hover:bg-red-50 gap-1.5"
                      onClick={() => rejectStaff(acc.id)}
                      data-ocid="admin.staff.reject_button"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Patients */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-teal-600" />
            Pending Patient Approvals
            {patientList.length > 0 && (
              <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
                {patientList.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientList.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-ocid="admin.patient_pending.empty_state"
            >
              No pending patient accounts.
            </p>
          ) : (
            <div className="space-y-3">
              {patientList.map((acc, i) => (
                <div
                  key={acc.id}
                  className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between gap-3"
                  data-ocid={`admin.patient_pending.item.${i + 1}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{acc.name}</p>
                    <p className="text-sm text-muted-foreground">{acc.phone}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="text-xs border-teal-200 text-teal-700"
                      >
                        patient
                      </Badge>
                      {acc.registerNumber && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {acc.registerNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                      onClick={() => approvePatient(acc.id)}
                      data-ocid="admin.patient.approve_button"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-300 hover:bg-red-50 gap-1.5"
                      onClick={() => rejectPatient(acc.id)}
                      data-ocid="admin.patient.reject_button"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reassign Roles */}
      {approvedStaff.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="w-4 h-4 text-purple-600" />
              Reassign Staff Roles ({approvedStaff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {approvedStaff.map((acc, i) => (
                <div
                  key={acc.id}
                  className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2"
                  data-ocid={`admin.staff_roles.item.${i + 1}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {acc.email}
                    </p>
                  </div>
                  <Select
                    value={reassignMap[acc.id] ?? acc.role}
                    onValueChange={(v) =>
                      setReassignMap((p) => ({
                        ...p,
                        [acc.id]: v as StaffRole,
                      }))
                    }
                  >
                    <SelectTrigger
                      className="h-7 text-xs w-40"
                      data-ocid="admin.reassign.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {staffRoleOptions.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {STAFF_ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={() => doReassign(acc.id)}
                    disabled={
                      !reassignMap[acc.id] || reassignMap[acc.id] === acc.role
                    }
                    data-ocid="admin.reassign.save_button"
                  >
                    Save
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdminContentManagement() {
  // Doctor CV & Photos
  const doctors = loadRegistry().filter(
    (d) =>
      d.status === "approved" &&
      (d.role === "consultant_doctor" || d.role === "doctor"),
  );
  const armanKey = "medicare_doctor_photo_arman";
  const samiaKey = "medicare_doctor_photo_samia";

  return (
    <div className="space-y-6">
      {/* Doctor Photos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="w-4 h-4 text-blue-600" />
            Doctor Profile Photos
          </CardTitle>
          <CardDescription>
            Photos displayed on the public portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PhotoUploader
            storageKey={armanKey}
            label="Dr. Arman Kabir"
            ocidPrefix="admin.photo.arman"
          />
          <PhotoUploader
            storageKey={samiaKey}
            label="Dr. Samia Shikder"
            ocidPrefix="admin.photo.samia"
          />
          {doctors
            .filter(
              (d) =>
                d.email !== "dr.armankabir011@gmail.com" &&
                d.email !== "samiashikder33@gmail.com",
            )
            .map((d) => (
              <PhotoUploader
                key={d.id}
                storageKey={`medicare_doctor_photo_${d.id}`}
                label={`${d.designation ?? ""} ${d.name}`.trim()}
                ocidPrefix={`admin.photo.${d.id}`}
              />
            ))}
        </CardContent>
      </Card>

      {/* CV PDFs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-purple-600" />
            Doctor CV PDFs
          </CardTitle>
          <CardDescription>
            Downloadable CVs shown on the public portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PdfUploader
            storageKey="doctorCVs_arman"
            label="Dr. Arman Kabir — CV PDF"
            ocidPrefix="admin.cv.arman"
          />
          <PdfUploader
            storageKey="doctorCVs_samia"
            label="Dr. Samia Shikder — CV PDF"
            ocidPrefix="admin.cv.samia"
          />
          {doctors
            .filter(
              (d) =>
                d.email !== "dr.armankabir011@gmail.com" &&
                d.email !== "samiashikder33@gmail.com",
            )
            .map((d) => (
              <PdfUploader
                key={d.id}
                storageKey={`doctorCVs_${d.id}`}
                label={`${(`${d.designation ?? ""} ${d.name}`).trim()} — CV PDF`}
                ocidPrefix={`admin.cv.${d.id}`}
              />
            ))}
        </CardContent>
      </Card>

      {/* Advice Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4 text-orange-600" />
            Advice Templates (Bengali)
          </CardTitle>
          <CardDescription>
            Numbered Bengali advice templates used in prescriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PdfUploader
            storageKey="adviceTemplates_main"
            label="Advice Templates PDF"
            ocidPrefix="admin.advice_template"
          />
        </CardContent>
      </Card>

      {/* Prescription Headers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hospital className="w-4 h-4 text-teal-600" />
            Prescription Headers
          </CardTitle>
          <CardDescription>
            Headers used on printed prescriptions — OPD (chamber) and hospital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PdfUploader
            storageKey="prescriptionHeaders_chamber"
            label="Chamber / OPD Header (image or PDF)"
            ocidPrefix="admin.rx_header.chamber"
          />
          <PdfUploader
            storageKey="prescriptionHeaders_hospital"
            label="Hospital Header (image or PDF)"
            ocidPrefix="admin.rx_header.hospital"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AdminPublicContent() {
  const [classroomArman, setClassroomArman] = useState(
    () => localStorage.getItem("classroom_arman") ?? "",
  );
  const [classroomSamia, setClassroomSamia] = useState(
    () => localStorage.getItem("classroom_samia") ?? "",
  );
  const [chamberArman, setChamberArman] = useState(
    () => localStorage.getItem("chamber_arman") ?? "",
  );
  const [chamberSamia, setChamberSamia] = useState(
    () => localStorage.getItem("chamber_samia") ?? "",
  );
  const [profileArman, setProfileArman] = useState(
    () => localStorage.getItem("profile_arman") ?? "",
  );
  const [profileSamia, setProfileSamia] = useState(
    () => localStorage.getItem("profile_samia") ?? "",
  );

  const saveSection = (key: string, value: string, label: string) => {
    localStorage.setItem(key, value);
    toast.success(`${label} saved`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Classroom Content
          </CardTitle>
          <CardDescription>
            Lecture notes, video links, schedules, announcements per doctor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Dr. Arman Kabir — Classroom (JSON or text)
            </Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={classroomArman}
              onChange={(e) => setClassroomArman(e.target.value)}
              placeholder='{"lectures": [], "videos": [], "announcements": []}'
              data-ocid="admin.classroom.arman.textarea"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                saveSection(
                  "classroom_arman",
                  classroomArman,
                  "Classroom (Arman)",
                )
              }
              data-ocid="admin.classroom.arman.save_button"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Dr. Samia Shikder — Classroom (JSON or text)
            </Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={classroomSamia}
              onChange={(e) => setClassroomSamia(e.target.value)}
              placeholder='{"lectures": [], "videos": [], "announcements": []}'
              data-ocid="admin.classroom.samia.textarea"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                saveSection(
                  "classroom_samia",
                  classroomSamia,
                  "Classroom (Samia)",
                )
              }
              data-ocid="admin.classroom.samia.save_button"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4 text-rose-600" />
            Chamber Addresses
          </CardTitle>
          <CardDescription>
            Multiple chambers per doctor — location, visiting hours, phone,
            email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Dr. Arman Kabir — Chambers (JSON)
            </Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={chamberArman}
              onChange={(e) => setChamberArman(e.target.value)}
              placeholder='[{"name": "Chamber 1", "location": "", "hours": "", "phone": "", "email": ""}]'
              data-ocid="admin.chamber.arman.textarea"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                saveSection("chamber_arman", chamberArman, "Chambers (Arman)")
              }
              data-ocid="admin.chamber.arman.save_button"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Dr. Samia Shikder — Chambers (JSON)
            </Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={chamberSamia}
              onChange={(e) => setChamberSamia(e.target.value)}
              placeholder='[{"name": "Chamber 1", "location": "", "hours": "", "phone": "", "email": ""}]'
              data-ocid="admin.chamber.samia.textarea"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                saveSection("chamber_samia", chamberSamia, "Chambers (Samia)")
              }
              data-ocid="admin.chamber.samia.save_button"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="w-4 h-4 text-cyan-600" />
            Doctor Profile Text
          </CardTitle>
          <CardDescription>
            Specialty, designation, posts shown on the public portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Dr. Arman Kabir — Profile
            </Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={profileArman}
              onChange={(e) => setProfileArman(e.target.value)}
              placeholder="Specialty, designation, posts (one per line or JSON)"
              data-ocid="admin.profile.arman.textarea"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                saveSection("profile_arman", profileArman, "Profile (Arman)")
              }
              data-ocid="admin.profile.arman.save_button"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Dr. Samia Shikder — Profile
            </Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={profileSamia}
              onChange={(e) => setProfileSamia(e.target.value)}
              placeholder="Specialty, designation, posts (one per line or JSON)"
              data-ocid="admin.profile.samia.textarea"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                saveSection("profile_samia", profileSamia, "Profile (Samia)")
              }
              data-ocid="admin.profile.samia.save_button"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── ADMIN INVESTIGATION RATES ─────────────────────────────────────────────────

const RATES_KEY = "investigation_rates";

function saveRates(rates: InvestigationRate[]) {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates));
}

function AdminInvestigationRates() {
  const [rates, setRates] = useState<InvestigationRate[]>(() =>
    loadInvestigationRates(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function persistRates(updated: InvestigationRate[]) {
    setRates(updated);
    saveRates(updated);
  }

  function handleDelete(id: string) {
    persistRates(rates.filter((r) => r.id !== id));
    toast.success("Deleted");
  }

  function startEdit(r: InvestigationRate) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditRate(String(r.rate));
    setEditDiscount(String(r.discountRate ?? 0));
  }

  function saveEdit(id: string) {
    const rateNum = Number(editRate);
    if (!editName.trim() || Number.isNaN(rateNum) || rateNum < 0) {
      toast.error("Name and valid rate required");
      return;
    }
    persistRates(
      rates.map((r) =>
        r.id === id
          ? {
              ...r,
              name: editName.trim(),
              rate: rateNum,
              discountRate: Number(editDiscount) || 0,
            }
          : r,
      ),
    );
    setEditingId(null);
    toast.success("Saved");
  }

  function handleAddManual() {
    const rateNum = Number(newRate);
    if (!newName.trim() || Number.isNaN(rateNum) || rateNum < 0) {
      toast.error("Enter investigation name and rate");
      return;
    }
    const entry: InvestigationRate = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: newName.trim(),
      rate: rateNum,
      discountRate: Number(newDiscount) || 0,
    };
    persistRates([...rates, entry]);
    setNewName("");
    setNewRate("");
    setNewDiscount("");
    toast.success("Investigation added");
  }

  function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = ev.target?.result;
        // Try SheetJS first, fall back to CSV parsing
        let parsed: { name: string; rate: number }[] = [];

        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          // Excel files cannot be parsed without the xlsx package (not installed).
          // Instruct the user to save as CSV instead.
          toast.error(
            "Excel (.xlsx/.xls) cannot be parsed directly. Please save the file as CSV first (File → Save As → CSV), then upload again.",
          );
          setUploading(false);
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
        // CSV / TSV plain-text fallback
        const text =
          typeof data === "string"
            ? data
            : new TextDecoder().decode(data as ArrayBuffer);
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const parts = line.split(/[,\t]/);
          const name = (parts[0] ?? "").trim();
          const rate = Number((parts[1] ?? "").trim());
          if (!name || Number.isNaN(rate) || rate < 0) continue;
          parsed.push({ name, rate });
        }

        if (parsed.length === 0) {
          toast.error(
            "No valid rows found. Ensure Column A = Name, Column B = Rate.",
          );
          setUploading(false);
          return;
        }

        const newRates: InvestigationRate[] = parsed.map((p) => ({
          id:
            Date.now().toString(36) +
            Math.random().toString(36).slice(2) +
            Math.random().toString(36).slice(2),
          name: p.name,
          rate: p.rate,
          discountRate: 0,
        }));

        // Merge: preserve existing entries, add new ones (skip duplicates by name)
        const existingNames = new Set(rates.map((r) => r.name.toLowerCase()));
        const toAdd = newRates.filter(
          (r) => !existingNames.has(r.name.toLowerCase()),
        );
        const merged = [...rates, ...toAdd];
        persistRates(merged);
        toast.success(
          `${toAdd.length} new investigation${toAdd.length !== 1 ? "s" : ""} loaded (${parsed.length - toAdd.length} skipped as duplicates)`,
        );
      } catch {
        toast.error("Failed to parse file");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };

    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      {/* Upload card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="w-4 h-4 text-purple-600" />
            Investigation Rate List
          </CardTitle>
          <CardDescription>
            Upload a CSV file (Column A = Investigation Name, Column B = Rate).
            Existing entries are preserved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              data-ocid="admin.inv_rates.upload_button"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Parsing…" : "Upload CSV File"}
            </Button>
            <span className="text-xs text-muted-foreground">
              .csv or .tsv — Column A: Name, Column B: Rate
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleExcelUpload}
            />
          </div>

          {/* Manual add row */}
          <div className="flex gap-2 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">Investigation Name</Label>
              <Input
                placeholder="e.g. CBC"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
                data-ocid="admin.inv_rates.name.input"
              />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">Rate (৳)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="h-8 text-sm"
                data-ocid="admin.inv_rates.rate.input"
              />
            </div>
            <div className="space-y-1 w-24">
              <Label className="text-xs">Discount (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
                className="h-8 text-sm"
                data-ocid="admin.inv_rates.discount.input"
              />
            </div>
            <Button
              size="sm"
              className="gap-1.5 h-8 shrink-0"
              onClick={handleAddManual}
              data-ocid="admin.inv_rates.add_button"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rates table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4 text-teal-600" />
            Rate List
            {rates.length > 0 && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs ml-1">
                {rates.length} total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rates.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-8"
              data-ocid="admin.inv_rates.empty_state"
            >
              No rates configured yet. Upload an Excel file or add manually.
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      Investigation Name
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      Rate (৳)
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs hidden sm:table-cell">
                      Discount (%)
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r, idx) => (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      data-ocid={`admin.inv_rates.item.${idx + 1}`}
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      {editingId === r.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-sm"
                              data-ocid={`admin.inv_rates.edit_name.${idx + 1}`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={editRate}
                              onChange={(e) => setEditRate(e.target.value)}
                              className="h-7 text-sm text-right w-24 ml-auto"
                              data-ocid={`admin.inv_rates.edit_rate.${idx + 1}`}
                            />
                          </td>
                          <td className="px-4 py-2 hidden sm:table-cell">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={editDiscount}
                              onChange={(e) => setEditDiscount(e.target.value)}
                              className="h-7 text-sm text-right w-20 ml-auto"
                              data-ocid={`admin.inv_rates.edit_discount.${idx + 1}`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => saveEdit(r.id)}
                                data-ocid={`admin.inv_rates.save_button.${idx + 1}`}
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setEditingId(null)}
                                data-ocid={`admin.inv_rates.cancel_button.${idx + 1}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {r.name}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                            ৳ {r.rate.toLocaleString("en-BD")}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                            {r.discountRate ? `${r.discountRate}%` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => startEdit(r)}
                                data-ocid={`admin.inv_rates.edit_button.${idx + 1}`}
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(r.id)}
                                data-ocid={`admin.inv_rates.delete_button.${idx + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminSystemSettings({ onLogout }: { onLogout: () => void }) {
  const auditLog = getAuditLog().slice().reverse().slice(0, 50);

  const exportAllData = () => {
    const snapshot: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      try {
        snapshot[k] = JSON.parse(localStorage.getItem(k) ?? "null");
      } catch {
        snapshot[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arman_care_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Full data backup exported");
  };

  const exportPatients = () => {
    const allPatients: Array<Record<string, unknown>> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("patients_")) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(k) ?? "[]") as Array<
          Record<string, unknown>
        >;
        allPatients.push(...arr);
      } catch {}
    }
    const header =
      "Name,Reg No,Gender,Blood Group,Phone,Address,Patient Type\n";
    const rows = allPatients
      .map((p) =>
        [
          `"${(p.fullName as string) ?? ""}"`,
          (p.registerNumber as string) ?? "",
          (p.gender as string) ?? "",
          (p.bloodGroup as string) ?? "",
          (p.phone as string) ?? "",
          `"${(p.address as string) ?? ""}"`,
          (p.patientType as string) ?? "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Patient records exported");
  };

  return (
    <div className="space-y-6">
      {/* Audit Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-slate-600" />
            Audit Log (Last 50 entries)
          </CardTitle>
          <CardDescription>
            All login and edit events — visible to Admin only
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-ocid="admin.audit_log.empty_state"
            >
              No audit entries yet.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {auditLog.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 text-xs py-1.5 border-b border-border last:border-0"
                  data-ocid={`admin.audit_log.item.${i + 1}`}
                >
                  <span className="text-muted-foreground shrink-0 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="shrink-0 font-medium text-primary">
                    {entry.userName}
                  </span>
                  <span className="text-muted-foreground">
                    ({entry.userRole})
                  </span>
                  <span className="text-foreground">{entry.action}</span>
                  {entry.target !== "System" && (
                    <span className="text-muted-foreground">
                      → {entry.target}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="w-4 h-4 text-purple-600" />
            Data Export
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportPatients}
            data-ocid="admin.export_patients.button"
          >
            <Download className="w-4 h-4" />
            Export Patients (CSV)
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportAllData}
            data-ocid="admin.export_all.button"
          >
            <Database className="w-4 h-4" />
            Full Backup (JSON)
          </Button>
        </CardContent>
      </Card>

      {/* Lab Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4 text-blue-600" />
            Lab Integration
          </CardTitle>
          <CardDescription>
            Connect an external lab system to auto-import results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Lab System Name</Label>
            <Input
              placeholder="e.g. Hospital Lab System"
              defaultValue={localStorage.getItem("lab_system_name") ?? ""}
              onBlur={(e) =>
                localStorage.setItem("lab_system_name", e.target.value)
              }
              data-ocid="admin.lab_system_name.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Endpoint URL</Label>
            <Input
              placeholder="https://lab.hospital.com/api/results"
              defaultValue={localStorage.getItem("lab_api_endpoint") ?? ""}
              onBlur={(e) =>
                localStorage.setItem("lab_api_endpoint", e.target.value)
              }
              data-ocid="admin.lab_api.input"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() =>
                toast.success("Test result received: Hb 12.0 g/dL (simulated)")
              }
              data-ocid="admin.lab_test.button"
            >
              <TestTube className="w-4 h-4" />
              Test Connection
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                navigator.clipboard
                  .writeText(`${window.location.origin}/api/lab-import`)
                  .then(() => toast.success("Integration URL copied"));
              }}
              data-ocid="admin.lab_copy_url.button"
            >
              <Link className="w-4 h-4" />
              Copy URL
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card className="border-destructive/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Admin Sign Out
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={onLogout}
            className="gap-2"
            data-ocid="admin.signout.button"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── DOCTOR / STAFF PANELS ──────────────────────────────────────────────────────

function NotificationPrefs({ storageKey }: { storageKey: string }) {
  type PrefsShape = Record<string, boolean>;
  const [prefs, setPrefs] = useState<PrefsShape>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as PrefsShape;
    } catch {
      return {};
    }
  });

  const toggle = (key: string, defaultVal: boolean) => {
    const updated = { ...prefs, [key]: !(prefs[key] ?? defaultVal) };
    setPrefs(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success("Preference saved");
  };

  const items: Array<{
    key: string;
    label: string;
    default: boolean;
    icon: React.ReactNode;
  }> = [
    {
      key: "drugReminders",
      label: "Drug reminder alerts",
      default: true,
      icon: <Bell className="w-4 h-4 text-amber-500" />,
    },
    {
      key: "appointmentAlerts",
      label: "Appointment alerts",
      default: true,
      icon: <Bell className="w-4 h-4 text-blue-500" />,
    },
    {
      key: "clinicalAlerts",
      label: "Critical clinical alerts (Sepsis / AKI)",
      default: true,
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    },
    {
      key: "newPatientApprovals",
      label: "New patient approval notifications",
      default: true,
      icon: <UserCheck className="w-4 h-4 text-teal-500" />,
    },
    {
      key: "handoverReminders",
      label: "Handover reminders",
      default: true,
      icon: <ClipboardList className="w-4 h-4 text-purple-500" />,
    },
    {
      key: "medDueAlerts",
      label: "Medication due alerts",
      default: true,
      icon: <Bell className="w-4 h-4 text-pink-500" />,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-amber-500" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Choose which alerts you receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 py-1"
            data-ocid={`settings.notif.${item.key}.toggle`}
          >
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
            <Switch
              checked={prefs[item.key] ?? item.default}
              onCheckedChange={() => toggle(item.key, item.default)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrescriptionHeaderSelector({ doctorEmail }: { doctorEmail: string }) {
  const prefKey = `prescriptionHeaderPref_${doctorEmail}`;
  const [headerType, setHeaderType] = useState<"chamber" | "hospital">(() => {
    const raw = localStorage.getItem(prefKey);
    return (raw as "chamber" | "hospital") ?? "chamber";
  });

  const save = () => {
    localStorage.setItem(prefKey, headerType);
    toast.success("Prescription header preference saved");
  };

  const chamberHeader = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("prescriptionHeaders_chamber") ?? "null",
      );
    } catch {
      return null;
    }
  })();
  const hospitalHeader = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("prescriptionHeaders_hospital") ?? "null",
      );
    } catch {
      return null;
    }
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="w-4 h-4 text-teal-600" />
          Prescription Header
        </CardTitle>
        <CardDescription>
          Select which header to use on your prescriptions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setHeaderType("chamber")}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${headerType === "chamber" ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"}`}
            data-ocid="settings.rx_header.chamber.toggle"
          >
            <p className="font-semibold text-sm text-foreground">
              Chamber / OPD
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Doctor name + chamber address
            </p>
            {chamberHeader && (
              <p className="text-xs text-primary mt-1 truncate">
                {chamberHeader.name}
              </p>
            )}
          </button>
          <button
            type="button"
            onClick={() => setHeaderType("hospital")}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${headerType === "hospital" ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"}`}
            data-ocid="settings.rx_header.hospital.toggle"
          >
            <p className="font-semibold text-sm text-foreground">Hospital</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hospital name only
            </p>
            {hospitalHeader && (
              <p className="text-xs text-primary mt-1 truncate">
                {hospitalHeader.name}
              </p>
            )}
          </button>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={save}
          data-ocid="settings.rx_header.save_button"
        >
          <Save className="w-3.5 h-3.5" />
          Save Preference
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Serial Display Video Settings ────────────────────────────────────────────

/** Convert a plain YouTube or Vimeo watch URL to an embed URL. */
function toEmbedUrl(raw: string): string {
  const url = raw.trim();
  // YouTube: https://www.youtube.com/watch?v=VIDEO_ID
  const ytWatch = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytWatch) {
    return `https://www.youtube.com/embed/${ytWatch[1]}?autoplay=1&mute=1&loop=1&controls=1&rel=0&modestbranding=1`;
  }
  // YouTube playlist: already an embed or videoseries URL — pass through
  if (url.includes("youtube.com/embed")) return url;
  // Vimeo: https://vimeo.com/VIDEO_ID
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1`;
  }
  // Vimeo player embed — pass through
  if (url.includes("player.vimeo.com")) return url;
  // Direct embed or other URL — use as-is
  return url;
}

function SerialDisplayVideoSettings({ doctorEmail }: { doctorEmail: string }) {
  const storageKey = `serialDisplayVideoUrl_${doctorEmail}`;
  const [inputUrl, setInputUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(() =>
    localStorage.getItem(storageKey),
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    const v = localStorage.getItem(storageKey);
    return v ? toEmbedUrl(v) : null;
  });
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = () => {
    if (!inputUrl.trim()) {
      toast.error("Please enter a video URL");
      return;
    }
    const embed = toEmbedUrl(inputUrl.trim());
    localStorage.setItem(storageKey, inputUrl.trim());
    // Broadcast change to other tabs (including SerialDisplay)
    try {
      const bc = new BroadcastChannel("serial_display_video_sync");
      bc.postMessage({ videoUrl: inputUrl.trim() });
      bc.close();
    } catch {}
    setSavedUrl(inputUrl.trim());
    setPreviewUrl(embed);
    setShowPreview(true);
    setInputUrl("");
    toast.success("Serial display video URL saved");
  };

  const handleClear = () => {
    localStorage.removeItem(storageKey);
    try {
      const bc = new BroadcastChannel("serial_display_video_sync");
      bc.postMessage({ videoUrl: null });
      bc.close();
    } catch {}
    setSavedUrl(null);
    setPreviewUrl(null);
    setShowPreview(false);
    toast.success("Serial display video cleared — default playlist restored");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorPlay className="w-4 h-4 text-blue-600" />
          Serial Display Video
        </CardTitle>
        <CardDescription>
          Set a custom health education video for the waiting room display
          screen (
          <code className="text-xs bg-muted px-1 rounded">/serial-display</code>
          ). Supports YouTube, Vimeo, or any direct embed URL. Leave blank to
          use the default playlist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="https://www.youtube.com/watch?v=... or Vimeo URL"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="flex-1"
            data-ocid="settings.serial_video.input"
          />
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={handleSave}
            data-ocid="settings.serial_video.save_button"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </div>

        {savedUrl && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800 mb-0.5">
                  Current video URL
                </p>
                <p className="text-xs text-blue-700 break-all font-mono leading-snug">
                  {savedUrl}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={() => setShowPreview((v) => !v)}
                  data-ocid="settings.serial_video.preview_toggle"
                >
                  <Eye className="w-3 h-3" />
                  {showPreview ? "Hide" : "Preview"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  onClick={handleClear}
                  data-ocid="settings.serial_video.delete_button"
                >
                  <XCircle className="w-3 h-3" />
                  Clear
                </Button>
              </div>
            </div>

            {showPreview && previewUrl && (
              <div className="rounded-lg overflow-hidden border border-blue-200 aspect-video bg-black">
                <iframe
                  src={previewUrl}
                  title="Video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        {!savedUrl && (
          <p
            className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border"
            data-ocid="settings.serial_video.empty_state"
          >
            No custom video set. The serial display will use the default health
            education playlist.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── PATIENT PANELS ──────────────────────────────────────────────────────────────

function PatientProfileView() {
  const { currentPatient } = useEmailAuth();
  if (!currentPatient) return null;

  // Load clinical patient record for more details
  const clinicalRecord = (() => {
    if (!currentPatient.registerNumber) return null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("patients_")) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(k) ?? "[]") as Array<
          Record<string, unknown>
        >;
        for (const p of arr) {
          if (p.registerNumber === currentPatient.registerNumber) return p;
        }
      } catch {}
    }
    return null;
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="w-4 h-4 text-teal-600" />
          My Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <p className="text-sm font-medium text-foreground">
              {currentPatient.name || "—"}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Register Number
            </Label>
            <p className="text-sm font-mono font-medium text-primary">
              {currentPatient.registerNumber || "—"}
            </p>
          </div>
          {currentPatient.age && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Age</Label>
              <p className="text-sm font-medium text-foreground">
                {currentPatient.age} years
              </p>
            </div>
          )}
          {currentPatient.gender && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gender</Label>
              <p className="text-sm font-medium text-foreground capitalize">
                {currentPatient.gender}
              </p>
            </div>
          )}
          {typeof clinicalRecord?.bloodGroup === "string" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Blood Group
              </Label>
              <p className="text-sm font-medium text-foreground">
                {clinicalRecord.bloodGroup}
              </p>
            </div>
          )}
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            To update your profile information, submit a request below. A doctor
            will review and apply changes.
          </p>
          <ProfileUpdateRequest
            registerNumber={currentPatient.registerNumber ?? ""}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileUpdateRequest({ registerNumber }: { registerNumber: string }) {
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (!phone && !address) {
      toast.error("Please fill in at least one field to update.");
      return;
    }
    setSubmitting(true);
    const key = `pendingProfileUpdates_${registerNumber}`;
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "[]") as Array<
          Record<string, unknown>
        >;
      } catch {
        return [];
      }
    })();
    existing.push({
      phone: phone || undefined,
      address: address || undefined,
      submittedAt: new Date().toISOString(),
      status: "pending",
    });
    localStorage.setItem(key, JSON.stringify(existing));
    setPhone("");
    setAddress("");
    setSubmitting(false);
    toast.success("Update request submitted. Doctor will review shortly.");
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-foreground">
        Submit Profile Update Request
      </p>
      <Input
        placeholder="New phone number (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        data-ocid="patient.profile_update.phone.input"
      />
      <Input
        placeholder="New address (optional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        data-ocid="patient.profile_update.address.input"
      />
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={submit}
        disabled={submitting}
        data-ocid="patient.profile_update.submit_button"
      >
        <Save className="w-3 h-3" />
        Submit Request
      </Button>
    </div>
  );
}

function PatientNotifPrefs({ phone }: { phone: string }) {
  const storageKey = `notifPrefs_patient_${phone}`;
  type PrefsShape = Record<string, boolean>;
  const [prefs, setPrefs] = useState<PrefsShape>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as PrefsShape;
    } catch {
      return {};
    }
  });

  const toggle = (key: string, defaultVal: boolean) => {
    const updated = { ...prefs, [key]: !(prefs[key] ?? defaultVal) };
    setPrefs(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success("Preference saved");
  };

  const items = [
    {
      key: "drugReminders",
      label: "Drug reminder alerts (ওষুধের রিমাইন্ডার)",
      default: true,
    },
    {
      key: "appointmentAlerts",
      label: "Appointment reminders (অ্যাপয়েন্টমেন্ট রিমাইন্ডার)",
      default: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-amber-500" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3"
            data-ocid={`patient.notif.${item.key}.toggle`}
          >
            <span className="text-sm text-foreground">{item.label}</span>
            <Switch
              checked={prefs[item.key] ?? item.default}
              onCheckedChange={() => toggle(item.key, item.default)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PatientAccountSettings() {
  const { currentPatient, updatePatientCredentials, patientSignOut } =
    useEmailAuth();
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  if (!currentPatient) return null;

  const maskedPhone = currentPatient.phone.replace(
    /(\d{2})\d{5}(\d{4})/,
    "$1•••••$2",
  );

  const saveCredentials = () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    updatePatientCredentials(
      currentPatient.registerNumber ?? "",
      newPhone || undefined,
      newPassword || undefined,
    );
    setNewPhone("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Credentials updated");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="w-4 h-4 text-blue-600" />
          Account Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Current Mobile Number
          </Label>
          <p className="text-sm font-mono font-medium text-foreground">
            {maskedPhone}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patient-new-phone">
            New Mobile Number (leave blank to keep)
          </Label>
          <Input
            id="patient-new-phone"
            type="tel"
            placeholder="01XXXXXXXXX"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            data-ocid="patient.account.phone.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patient-new-password">
            New Password (leave blank to keep)
          </Label>
          <div className="relative">
            <Input
              id="patient-new-password"
              type={showPass ? "text" : "password"}
              placeholder="Min. 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
              data-ocid="patient.account.password.input"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Hide password" : "Show password"}
              data-ocid="patient.account.password.toggle"
            >
              {showPass ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patient-confirm-password">Confirm New Password</Label>
          <Input
            id="patient-confirm-password"
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            data-ocid="patient.account.confirm_password.input"
          />
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={saveCredentials}
          data-ocid="patient.account.save_button"
        >
          <Save className="w-3.5 h-3.5" />
          Save Changes
        </Button>
        <div className="pt-3 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={patientSignOut}
            data-ocid="patient.signout.button"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── MAIN SETTINGS PAGE ──────────────────────────────────────────────────────────

export default function Settings() {
  const { isAdmin, adminLogout } = useAdminAuth();
  const { currentDoctor, currentPatient, signOut, updateProfile } =
    useEmailAuth();

  // Derive role
  const role = currentDoctor?.role ?? null;
  const isConsultant = role === "consultant_doctor" || role === "doctor";
  const isPatientView = !isAdmin && !currentDoctor && !!currentPatient;

  // Doctor profile state (guarded — only used when currentDoctor != null)
  const [name, setName] = useState(currentDoctor?.name ?? "");
  const [designation, setDesignation] = useState(
    currentDoctor?.designation ?? "Dr.",
  );
  const [degree, setDegree] = useState(currentDoctor?.degree ?? "");
  const [specialization, setSpecialization] = useState(
    currentDoctor?.specialization ?? "",
  );
  const [hospital, setHospital] = useState(currentDoctor?.hospital ?? "");
  const [phone, setPhone] = useState(currentDoctor?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const storedPassword = currentDoctor
    ? getStoredPassword(currentDoctor.id)
    : "••••••";
  const doctorPhotoKey =
    currentDoctor?.email === "samiashikder33@gmail.com"
      ? "medicare_doctor_photo_samia"
      : "medicare_doctor_photo_arman";
  const notifKey = currentDoctor ? `notifPrefs_${currentDoctor.email}` : "";

  const handleSaveProfile = () => {
    if (!currentDoctor) return;
    setSaving(true);
    try {
      updateProfile({
        name,
        designation,
        degree,
        specialization,
        hospital,
        phone,
      });
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // ── Unauthenticated state ────────────────────────────────────────────────────
  if (!isAdmin && !currentDoctor && !currentPatient) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="font-semibold text-foreground">Not signed in</p>
            <p className="text-sm text-muted-foreground">
              Please sign in to access settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ADMIN VIEW ───────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div
        className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4"
        data-ocid="settings.page"
      >
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Admin Settings
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Full system management panel
          </p>
        </div>
        <Tabs defaultValue="users" data-ocid="settings.admin.tab">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1 mb-4">
            <TabsTrigger
              value="users"
              className="gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.admin.users.tab"
            >
              <Users className="w-3.5 h-3.5" />
              User Management
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.admin.content.tab"
            >
              <Upload className="w-3.5 h-3.5" />
              Content & Files
            </TabsTrigger>
            <TabsTrigger
              value="portal"
              className="gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.admin.portal.tab"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Public Portal
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className="gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.admin.system.tab"
            >
              <Database className="w-3.5 h-3.5" />
              System & Audit
            </TabsTrigger>
            <TabsTrigger
              value="inv_rates"
              className="gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.admin.inv_rates.tab"
            >
              <ReceiptText className="w-3.5 h-3.5" />
              Investigation Rates
            </TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>
          <TabsContent value="content">
            <AdminContentManagement />
          </TabsContent>
          <TabsContent value="portal">
            <AdminPublicContent />
          </TabsContent>
          <TabsContent value="system">
            <AdminSystemSettings onLogout={adminLogout} />
          </TabsContent>
          <TabsContent value="inv_rates">
            <AdminInvestigationRates />
          </TabsContent>
        </Tabs>
        <Footer />
      </div>
    );
  }

  // ── PATIENT VIEW ────────────────────────────────────────────────────────────
  if (isPatientView) {
    return (
      <div
        className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4"
        data-ocid="settings.patient.page"
      >
        <div className="mb-4">
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Profile, notifications &amp; account
          </p>
        </div>
        <Tabs defaultValue="profile">
          <TabsList className="w-full mb-4">
            <TabsTrigger
              value="profile"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.patient.profile.tab"
            >
              <User className="w-3.5 h-3.5" />
              My Profile
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.patient.notifications.tab"
            >
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.patient.account.tab"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Account
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <PatientProfileView />
          </TabsContent>
          <TabsContent value="notifications">
            <PatientNotifPrefs phone={currentPatient?.phone ?? ""} />
          </TabsContent>
          <TabsContent value="account">
            <PatientAccountSettings />
          </TabsContent>
        </Tabs>
        <Footer />
      </div>
    );
  }

  // ── CONSULTANT DOCTOR VIEW ───────────────────────────────────────────────────
  if (isConsultant) {
    return (
      <div
        className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4"
        data-ocid="settings.doctor.page"
      >
        <div className="mb-4">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Profile, prescriptions &amp; account
          </p>
        </div>
        <Tabs defaultValue="profile">
          <TabsList className="w-full mb-4 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger
              value="profile"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.doctor.profile.tab"
            >
              <User className="w-3.5 h-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="rx"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.doctor.rx.tab"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Prescription
            </TabsTrigger>
            <TabsTrigger
              value="display"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.doctor.display.tab"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              Display
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.doctor.notifications.tab"
            >
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </TabsTrigger>
            <TabsTrigger
              value="classroom"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.doctor.classroom.tab"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Classroom
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="settings.doctor.account.tab"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Account
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Camera className="w-4 h-4" />
                    Profile Photo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PhotoUploader
                    storageKey={doctorPhotoKey}
                    label={`${designation} ${name}`.trim() || "Doctor"}
                    ocidPrefix="settings.photo"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="w-4 h-4" />
                    Doctor Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Designation</Label>
                      <Select
                        value={designation}
                        onValueChange={setDesignation}
                      >
                        <SelectTrigger data-ocid="settings.designation.select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DESIGNATIONS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="settings-name">Full Name</Label>
                      <Input
                        id="settings-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        data-ocid="settings.doctor_name.input"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email (read-only)</Label>
                    <Input
                      value={currentDoctor?.email ?? ""}
                      readOnly
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-degree">
                      Degree / Qualifications
                    </Label>
                    <Input
                      id="settings-degree"
                      placeholder="MBBS, MD, FCPS"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      data-ocid="settings.doctor_degree.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-spec">Specialization</Label>
                    <Input
                      id="settings-spec"
                      placeholder="e.g. Pulmonology"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      data-ocid="settings.specialization.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-hospital">Hospital / Clinic</Label>
                    <Input
                      id="settings-hospital"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      data-ocid="settings.hospital.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-phone">Phone</Label>
                    <Input
                      id="settings-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      data-ocid="settings.phone.input"
                    />
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="gap-2"
                    data-ocid="settings.doctor_profile.save_button"
                  >
                    <Save className="w-4 h-4" />
                    Save Profile
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="rx">
            <PrescriptionHeaderSelector
              doctorEmail={currentDoctor?.email ?? ""}
            />
          </TabsContent>
          <TabsContent value="display">
            <SerialDisplayVideoSettings
              doctorEmail={currentDoctor?.email ?? ""}
            />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationPrefs storageKey={notifKey} />
          </TabsContent>
          <TabsContent value="classroom">
            <ClassroomSettings doctorEmail={currentDoctor?.email ?? ""} />
          </TabsContent>
          <TabsContent value="account">
            <AccountPanel
              storedPassword={storedPassword}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
              email={currentDoctor?.email ?? ""}
              onSignOut={signOut}
            />
          </TabsContent>
        </Tabs>
        <Footer />
      </div>
    );
  }

  // ── STAFF VIEW (MO / Intern / Nurse / Reception) ────────────────────────────
  return (
    <div
      className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4"
      data-ocid="settings.staff.page"
    >
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Profile &amp; notifications
        </p>
      </div>
      <Tabs defaultValue="profile">
        <TabsList className="w-full mb-4">
          <TabsTrigger
            value="profile"
            className="flex-1 gap-1.5 text-xs sm:text-sm"
            data-ocid="settings.staff.profile.tab"
          >
            <User className="w-3.5 h-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex-1 gap-1.5 text-xs sm:text-sm"
            data-ocid="settings.staff.notifications.tab"
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="flex-1 gap-1.5 text-xs sm:text-sm"
            data-ocid="settings.staff.account.tab"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Account
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email (read-only)</Label>
                <Input
                  value={currentDoctor?.email ?? ""}
                  readOnly
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Full Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-ocid="settings.staff_name.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-ocid="settings.staff_phone.input"
                />
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="gap-2"
                data-ocid="settings.staff_profile.save_button"
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationPrefs storageKey={notifKey} />
        </TabsContent>
        <TabsContent value="account">
          <AccountPanel
            storedPassword={storedPassword}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
            email={currentDoctor?.email ?? ""}
            onSignOut={signOut}
          />
        </TabsContent>
      </Tabs>
      <Footer />
    </div>
  );
}

// ── Shared sub-panels ─────────────────────────────────────────────────────────

function AccountPanel({
  storedPassword,
  showPassword,
  onTogglePassword,
  email,
  onSignOut,
}: {
  storedPassword: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  email: string;
  onSignOut: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4" />
            Sign-in Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              value={email}
              readOnly
              className="bg-muted text-muted-foreground cursor-not-allowed font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={storedPassword}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed font-mono text-sm pr-10"
                data-ocid="settings.password.input"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={onTogglePassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                data-ocid="settings.password.toggle"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              To change your password, contact the admin.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-destructive/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Sign Out
          </CardTitle>
          <CardDescription>
            You will need to sign in again to access the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={onSignOut}
            className="gap-2"
            data-ocid="settings.signout.button"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Footer() {
  return (
    <p className="text-xs text-muted-foreground text-center mt-8">
      © {new Date().getFullYear()}. Built with ❤ using{" "}
      <a
        href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary transition-colors"
      >
        caffeine.ai
      </a>
    </p>
  );
}
