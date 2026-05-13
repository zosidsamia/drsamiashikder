/**
 * VisitPage — full-page visit form route
 * Route: /Visit/:patientId or /Visit?id=<patientId>
 */
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import VisitForm from "../components/VisitForm";
import { useCreateVisit, useGetPatient } from "../hooks/useQueries";

function getPatientIdFromUrl(): bigint | null {
  // Try path param /Visit/<id>
  const pathParts = window.location.pathname.split("/");
  const visitIdx = pathParts.findIndex((p) => p.toLowerCase() === "visit");
  if (visitIdx >= 0 && pathParts[visitIdx + 1]) {
    try {
      const raw = pathParts[visitIdx + 1];
      const cleaned = raw.replace(/[^0-9]/g, "");
      if (cleaned) return BigInt(cleaned);
    } catch {}
  }
  // Try ?id=<id>
  const search = new URLSearchParams(window.location.search);
  const id = search.get("id");
  if (id) {
    try {
      const s = String(id);
      const raw = s.startsWith("__bigint__") ? s.slice(10) : s;
      const cleaned = raw.replace(/[^0-9]/g, "");
      if (cleaned) return BigInt(cleaned);
    } catch {}
  }
  return null;
}

export default function VisitPage() {
  const patientId = getPatientIdFromUrl();
  const formRef = useRef<HTMLFormElement | null>(null);

  const { data: patient, isLoading } = useGetPatient(patientId ?? 0n);
  const createVisitMutation = useCreateVisit();

  const handleBack = () => {
    if (patientId) {
      window.location.href = `/PatientProfile?id=${patientId}`;
    } else {
      window.history.back();
    }
  };

  const handleSave = () => {
    // Programmatically submit the inner form by clicking its hidden submit btn
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  if (!patientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground font-medium">
            No patient specified.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/Patients";
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background p-6 space-y-4"
        data-ocid="visit_page.loading_state"
      >
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Derive patient type for initial visitType default
  const isPatientAdmitted =
    patient?.isAdmitted === true ||
    (patient as Record<string, unknown> | undefined)?.status === "Admitted" ||
    patient?.patientType === "admitted" ||
    patient?.patientType === "indoor";

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      data-ocid="visit_page.page"
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 text-muted-foreground hover:text-foreground"
            data-ocid="visit_page.link"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Patient Profile</span>
            <span className="sm:hidden">Back</span>
          </Button>

          {/* Center: patient name */}
          <div className="flex-1 text-center min-w-0">
            {patient && (
              <p className="font-semibold text-foreground truncate text-sm sm:text-base">
                New Visit — {patient.fullName}
              </p>
            )}
          </div>

          {/* Save button */}
          <Button
            size="sm"
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave}
            disabled={createVisitMutation.isPending}
            data-ocid="visit_page.save_button"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">
              {createVisitMutation.isPending ? "Saving..." : "Save Visit"}
            </span>
            <span className="sm:hidden">
              {createVisitMutation.isPending ? "..." : "Save"}
            </span>
          </Button>
        </div>
      </header>

      {/* ── Form Content ─────────────────────────────────────────── */}
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 max-w-5xl mx-auto w-full">
        <VisitForm
          patientId={patientId}
          patient={
            patient
              ? {
                  fullName: patient.fullName,
                  dateOfBirth: patient.dateOfBirth,
                  gender: patient.gender,
                  address: patient.address,
                }
              : undefined
          }
          patientType={isPatientAdmitted ? "admitted" : "outdoor"}
          formRef={formRef}
          onSubmit={(data) => {
            createVisitMutation.mutate(data, {
              onSuccess: () => {
                toast.success("Visit saved successfully");
                handleBack();
              },
              onError: () => toast.error("Failed to save visit"),
            });
          }}
          onCancel={handleBack}
          isLoading={createVisitMutation.isPending}
        />
      </main>
    </div>
  );
}
