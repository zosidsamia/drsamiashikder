/**
 * StatusBadge — saturated, vivid pill badges for patient/prescription status.
 * Use across PatientList, PatientDashboard, Prescription, and WardRound.
 */
import { cn } from "@/lib/utils";

export type StatusType =
  | "OPD"
  | "Admitted"
  | "Discharged"
  | "Emergency"
  | "Draft"
  | "Finalized"
  | "Pending"
  | "Expired"
  | "Active"
  | "Resolved"
  | "InProgress"
  | "Cancelled"
  | "Overdue";

const STATUS_STYLES: Record<StatusType, string> = {
  OPD: "bg-blue-500 text-white",
  Admitted: "bg-orange-500 text-white",
  Discharged: "bg-green-600 text-white",
  Emergency: "bg-red-600 text-white animate-status-pulse",
  Draft: "bg-yellow-400 text-yellow-900",
  Finalized: "bg-green-500 text-white",
  Pending: "bg-amber-500 text-white",
  Expired: "bg-gray-500 text-white",
  Active: "bg-blue-500 text-white",
  Resolved: "bg-green-600 text-white",
  InProgress: "bg-teal-500 text-white",
  Cancelled: "bg-gray-400 text-white",
  Overdue: "bg-red-500 text-white",
};

const STATUS_LABELS: Partial<Record<StatusType, string>> = {
  OPD: "OPD",
  Admitted: "Admitted",
  Discharged: "Discharged",
  Emergency: "⚡ Emergency",
  InProgress: "In Progress",
};

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  className,
  label,
  size = "sm",
}: StatusBadgeProps) {
  const displayLabel = label ?? STATUS_LABELS[status] ?? status;
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold leading-none shrink-0",
        sizeClass,
        STATUS_STYLES[status] ?? "bg-gray-400 text-white",
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
