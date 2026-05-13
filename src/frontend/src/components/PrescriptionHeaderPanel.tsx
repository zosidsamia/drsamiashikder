/**
 * PrescriptionHeaderPanel — collapsible header settings for Prescription & EMR.
 * Lets Admin / Consultant Doctor upload a header image OR enter text header.
 * Auto-selects header type based on patient admission status.
 */
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
  Building2,
  ChevronDown,
  ChevronUp,
  Hospital,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  getDoctorEmail,
  getPrescriptionHeaderImage,
  setPrescriptionHeaderImage,
} from "../hooks/useQueries";
import type { PrescriptionHeaderType } from "../types";

interface PrescriptionHeaderPanelProps {
  headerType: PrescriptionHeaderType;
  isAdmitted?: boolean;
  canEdit?: boolean; // Admin or Consultant Doctor
}

export interface PrescriptionHeaderData {
  imageDataUrl: string | null;
  hospitalName: string;
  tagline: string;
  doctorName: string;
  degrees: string;
  chamberAddress: string;
  phone: string;
}

const HEADER_TEXT_KEY_PREFIX = "prescriptionHeaderText_";

export function getPrescriptionHeaderText(
  type: PrescriptionHeaderType,
): PrescriptionHeaderData | null {
  const email = getDoctorEmail();
  const key = `${HEADER_TEXT_KEY_PREFIX}${type}_${email}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PrescriptionHeaderData) : null;
  } catch {
    return null;
  }
}

function setPrescriptionHeaderText(
  type: PrescriptionHeaderType,
  data: PrescriptionHeaderData,
): void {
  const email = getDoctorEmail();
  const key = `${HEADER_TEXT_KEY_PREFIX}${type}_${email}`;
  localStorage.setItem(key, JSON.stringify(data));
}

export default function PrescriptionHeaderPanel({
  headerType,
  isAdmitted,
  canEdit = false,
}: PrescriptionHeaderPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(() =>
    getPrescriptionHeaderImage(headerType),
  );
  const [textData, setTextData] = useState<PrescriptionHeaderData>(
    () =>
      getPrescriptionHeaderText(headerType) ?? {
        imageDataUrl: null,
        hospitalName: "",
        tagline: "",
        doctorName: "",
        degrees: "",
        chamberAddress: "",
        phone: "",
      },
  );
  const [mode, setMode] = useState<"image" | "text">(
    previewImg ? "image" : "text",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const typeLabel =
    headerType === "hospital" ? "Hospital Header" : "Chamber Header";
  const TypeIcon = headerType === "hospital" ? Hospital : Building2;

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a JPG or PNG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewImg(dataUrl);
      setMode("image");
      if (e.target) e.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (mode === "image" && previewImg) {
      setPrescriptionHeaderImage(headerType, previewImg);
      toast.success("Header image saved.");
    } else {
      // Clear image, save text
      const email = getDoctorEmail();
      const imgKey = `prescriptionHeaders_${headerType}_${email}`;
      localStorage.removeItem(imgKey);
      setPreviewImg(null);
      setPrescriptionHeaderText(headerType, textData);
      toast.success("Header text saved.");
    }
    setDialogOpen(false);
  }

  function handleClearImage() {
    const email = getDoctorEmail();
    const imgKey = `prescriptionHeaders_${headerType}_${email}`;
    localStorage.removeItem(imgKey);
    setPreviewImg(null);
    setMode("text");
    toast.success("Header image removed.");
  }

  const hasSavedHeader =
    previewImg !== null || getPrescriptionHeaderText(headerType) !== null;

  return (
    <div className="border rounded-lg overflow-hidden mb-2">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
        data-ocid="rx.header_settings.toggle"
      >
        <span className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-teal-600" />
          Header Settings
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
              headerType === "hospital"
                ? "bg-blue-100 text-blue-700 border-blue-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200"
            }`}
          >
            {typeLabel}
          </span>
          {isAdmitted !== undefined && (
            <span className="text-xs text-muted-foreground">
              ({isAdmitted ? "Admitted patient" : "Chamber patient"})
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3 bg-white">
          {/* Current header preview */}
          {previewImg ? (
            <div className="flex items-start gap-3">
              <img
                src={previewImg}
                alt="Header preview"
                className="h-16 object-contain border rounded"
              />
              <div className="text-xs text-muted-foreground">
                Custom header image uploaded.
              </div>
            </div>
          ) : getPrescriptionHeaderText(headerType) ? (
            <div className="text-xs text-muted-foreground border-l-2 border-teal-300 pl-2">
              {headerType === "hospital" ? (
                <>
                  <div className="font-semibold">
                    {getPrescriptionHeaderText(headerType)?.hospitalName}
                  </div>
                  <div>{getPrescriptionHeaderText(headerType)?.tagline}</div>
                </>
              ) : (
                <>
                  <div className="font-semibold">
                    {getPrescriptionHeaderText(headerType)?.doctorName}
                  </div>
                  <div>{getPrescriptionHeaderText(headerType)?.degrees}</div>
                  <div>
                    {getPrescriptionHeaderText(headerType)?.chamberAddress}
                  </div>
                  <div>{getPrescriptionHeaderText(headerType)?.phone}</div>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No custom header set. Default header will be used.
            </p>
          )}

          {/* Edit button (Admin / Consultant only) */}
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="gap-1.5 text-sm border-teal-300 text-teal-700 hover:bg-teal-50"
                data-ocid="rx.header_edit.button"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Header
              </Button>
              {hasSavedHeader && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleClearImage();
                    const email = getDoctorEmail();
                    localStorage.removeItem(
                      `${HEADER_TEXT_KEY_PREFIX}${headerType}_${email}`,
                    );
                    toast.success("Header cleared.");
                  }}
                  className="gap-1.5 text-sm border-red-300 text-red-600 hover:bg-red-50"
                  data-ocid="rx.header_clear.button"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-700">
              <TypeIcon className="w-5 h-5" />
              Edit {typeLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("image")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === "image"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Upload Image
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === "text"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Text Header
              </button>
            </div>

            {mode === "image" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload JPG/PNG (max 2MB). The image will span the full width
                  of the prescription header.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
                >
                  <Upload className="w-4 h-4" /> Choose Image
                </Button>
                {previewImg && (
                  <div className="border rounded p-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Preview:
                    </p>
                    <img
                      src={previewImg}
                      alt="Header preview"
                      className="w-full h-24 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewImg(null)}
                      className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {headerType === "hospital" ? (
                  <>
                    <div>
                      <Label className="text-xs font-semibold">
                        Hospital Name
                      </Label>
                      <Input
                        value={textData.hospitalName}
                        onChange={(e) =>
                          setTextData((d) => ({
                            ...d,
                            hospitalName: e.target.value,
                          }))
                        }
                        placeholder="e.g. Dhaka Medical College Hospital"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        Tagline (optional)
                      </Label>
                      <Input
                        value={textData.tagline}
                        onChange={(e) =>
                          setTextData((d) => ({
                            ...d,
                            tagline: e.target.value,
                          }))
                        }
                        placeholder="e.g. Dept. of General Surgery"
                        className="mt-1 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs font-semibold">
                        Doctor Name
                      </Label>
                      <Input
                        value={textData.doctorName}
                        onChange={(e) =>
                          setTextData((d) => ({
                            ...d,
                            doctorName: e.target.value,
                          }))
                        }
                        placeholder="Dr. Arman Kabir"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        Degrees / Designation
                      </Label>
                      <Input
                        value={textData.degrees}
                        onChange={(e) =>
                          setTextData((d) => ({
                            ...d,
                            degrees: e.target.value,
                          }))
                        }
                        placeholder="MBBS (DU), FCPS | Consultant Surgeon"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        Chamber Address
                      </Label>
                      <Input
                        value={textData.chamberAddress}
                        onChange={(e) =>
                          setTextData((d) => ({
                            ...d,
                            chamberAddress: e.target.value,
                          }))
                        }
                        placeholder="সেন্চুরি আর্কেড মার্কেট, মগবাজার, ঢাকা"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Phone</Label>
                      <Input
                        value={textData.phone}
                        onChange={(e) =>
                          setTextData((d) => ({ ...d, phone: e.target.value }))
                        }
                        placeholder="01751959262"
                        className="mt-1 text-sm"
                      />
                    </div>
                  </>
                )}
                {/* Live preview */}
                <div className="border rounded p-3 bg-gray-50">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <div className="border-b pb-2">
                    {headerType === "hospital" ? (
                      <div className="text-center">
                        <p className="font-bold text-base">
                          {textData.hospitalName || "Hospital Name"}
                        </p>
                        {textData.tagline && (
                          <p className="text-sm text-gray-600">
                            {textData.tagline}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm">
                            {textData.doctorName || "Doctor Name"}
                          </p>
                          {textData.degrees && (
                            <p className="text-xs text-gray-600">
                              {textData.degrees}
                            </p>
                          )}
                          {textData.chamberAddress && (
                            <p className="text-xs text-gray-600">
                              {textData.chamberAddress}
                            </p>
                          )}
                        </div>
                        {textData.phone && (
                          <p className="text-xs text-gray-600">
                            Mob: {textData.phone}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                data-ocid="rx.header_save.button"
              >
                Save Header
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
