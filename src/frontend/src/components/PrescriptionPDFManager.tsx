import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const PDF_KEY = "prescription_pad_pdf";
const PDF_NAME_KEY = "prescription_pad_pdf_name";

export default function PrescriptionPDFManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfName, setPdfName] = useState<string | null>(() =>
    localStorage.getItem(PDF_NAME_KEY),
  );
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem(PDF_KEY, base64);
      localStorage.setItem(PDF_NAME_KEY, file.name);
      setPdfName(file.name);
      setUploading(false);
      toast.success("Prescription PDF template uploaded.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error("Failed to read the file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = () => {
    localStorage.removeItem(PDF_KEY);
    localStorage.removeItem(PDF_NAME_KEY);
    setPdfName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("PDF template removed.");
  };

  const handlePreview = () => {
    const stored = localStorage.getItem(PDF_KEY);
    if (!stored) {
      toast.error("No PDF template stored.");
      return;
    }
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${stored}" width="100%" height="100%" style="border:none;"></iframe>`,
      );
    }
  };

  return (
    <Card
      className="border-2 border-amber-200 bg-amber-50/40"
      data-ocid="prescription_pdf.card"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-900 text-base">
          <FileText className="w-5 h-5 text-amber-600" />
          Prescription Pad PDF Template
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {pdfName ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium border border-green-200">
                <FileText className="w-3.5 h-3.5" />
                {pdfName}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border text-xs">
              No PDF uploaded
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-ocid="prescription_pdf.upload_button"
          >
            <Upload className="w-4 h-4" />
            {uploading
              ? "Uploading..."
              : pdfName
                ? "Replace PDF"
                : "Upload PDF"}
          </Button>

          {pdfName && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handlePreview}
                data-ocid="prescription_pdf.secondary_button"
              >
                <Eye className="w-4 h-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleDelete}
                data-ocid="prescription_pdf.delete_button"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <p className="text-xs text-muted-foreground">
          Upload a PDF prescription pad template. Doctors can view it when
          writing prescriptions. Only admins can upload or delete the template.
        </p>
      </CardContent>
    </Card>
  );
}
