import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCheck,
  ChevronDown,
  Eye,
  MessageCircle,
  Phone,
  Send,
  Stethoscope,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "doctor" | "admin" | "patient" | "staff";
  senderName: string;
  text: string;
  timestamp: string;
  /** Filled when a doctor/admin views the message */
  seenAt?: string;
  seenBy?: string;
}

export interface TeleconsultRecord {
  id: string;
  patientId: string;
  doctorName: string;
  doctorRole: string;
  chiefComplaint: string;
  assessment: string;
  advice: string;
  hasPrescription: boolean;
  timestamp: string;
}

interface PatientChatProps {
  patientId: bigint;
  currentRole: string;
  currentUserName: string;
  patientName?: string;
  /** If true, renders as a floating panel overlay */
  floating?: boolean;
  onClose?: () => void;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function getChatKey(patientId: bigint) {
  return `patientChat_${patientId}`;
}

function loadMessages(patientId: bigint): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getChatKey(patientId));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(patientId: bigint, msgs: ChatMessage[]) {
  localStorage.setItem(getChatKey(patientId), JSON.stringify(msgs));
}

export function loadTeleconsults(patientId: bigint): TeleconsultRecord[] {
  try {
    const raw = localStorage.getItem(`teleconsults_${patientId}`);
    return raw ? (JSON.parse(raw) as TeleconsultRecord[]) : [];
  } catch {
    return [];
  }
}

function saveTeleconsults(patientId: bigint, records: TeleconsultRecord[]) {
  localStorage.setItem(`teleconsults_${patientId}`, JSON.stringify(records));
}

/** Mark all unread patient messages as seen by the doctor/admin */
function markPatientMessagesSeen(
  patientId: bigint,
  seenBy: string,
): ChatMessage[] {
  const msgs = loadMessages(patientId);
  const now = new Date().toISOString();
  let changed = false;
  const updated = msgs.map((m) => {
    if (m.senderRole === "patient" && !m.seenAt) {
      changed = true;
      return { ...m, seenAt: now, seenBy };
    }
    return m;
  });
  if (changed) saveMessages(patientId, updated);
  return updated;
}

function seenAgo(seenAt: string): string {
  try {
    return formatDistanceToNow(new Date(seenAt), { addSuffix: true });
  } catch {
    return "Seen";
  }
}

const CLINICAL_ROLES = [
  "consultant_doctor",
  "medical_officer",
  "intern_doctor",
  "doctor",
  "admin",
];

// ── TeleconsultHistory sub-component (also exported for HistoryFeatures) ──────

interface TeleconsultHistoryProps {
  patientId: bigint;
}

export function TeleconsultHistory({ patientId }: TeleconsultHistoryProps) {
  const [records, setRecords] = useState<TeleconsultRecord[]>(() =>
    [...loadTeleconsults(patientId)].reverse(),
  );

  if (records.length === 0) {
    return (
      <div
        className="text-center py-8 text-muted-foreground"
        data-ocid="teleconsult_history.empty_state"
      >
        <Phone className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No teleconsult sessions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-ocid="teleconsult_history.list">
      {records.map((rec, idx) => (
        <div
          key={rec.id}
          className="bg-card border border-border rounded-xl p-4 space-y-2"
          data-ocid={`teleconsult_history.item.${idx + 1}`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge className="bg-teal-100 text-teal-800 border-teal-200 border text-xs">
                Teleconsult
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(rec.timestamp), "dd MMM yyyy, h:mm a")}
              </span>
            </div>
            <span className="text-xs font-medium text-foreground">
              {rec.doctorName}
              <span className="text-muted-foreground font-normal ml-1">
                ({rec.doctorRole})
              </span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Chief Complaint
              </span>
              <p className="mt-0.5 text-foreground">{rec.chiefComplaint}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Assessment
              </span>
              <p className="mt-0.5 text-foreground whitespace-pre-wrap">
                {rec.assessment}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Advice
              </span>
              <p className="mt-0.5 text-foreground whitespace-pre-wrap">
                {rec.advice}
              </p>
            </div>
            {rec.hasPrescription && (
              <p className="text-xs text-primary font-medium">
                Prescription indicated — see Patient Profile → Prescriptions
              </p>
            )}
          </div>
        </div>
      ))}
      {/* reset to latest if state gets stale */}
      <button
        type="button"
        className="hidden"
        onClick={() => setRecords([...loadTeleconsults(patientId)].reverse())}
      />
    </div>
  );
}

// ── TeleconsultPanel — inline panel that appears above chat ───────────────────

interface TeleconsultPanelProps {
  patientId: bigint;
  patientName: string;
  doctorName: string;
  doctorRole: string;
  onSaved: (record: TeleconsultRecord) => void;
  onClose: () => void;
}

function TeleconsultPanel({
  patientId,
  patientName,
  doctorName,
  doctorRole,
  onSaved,
  onClose,
}: TeleconsultPanelProps) {
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [assessment, setAssessment] = useState("");
  const [advice, setAdvice] = useState("");
  const [hasPrescription, setHasPrescription] = useState(false);

  function handleSave() {
    if (!chiefComplaint.trim()) {
      toast.error("Chief complaint is required.");
      return;
    }
    const record: TeleconsultRecord = {
      id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      patientId: String(patientId),
      doctorName,
      doctorRole,
      chiefComplaint: chiefComplaint.trim(),
      assessment: assessment.trim(),
      advice: advice.trim(),
      hasPrescription,
      timestamp: new Date().toISOString(),
    };
    const existing = loadTeleconsults(patientId);
    saveTeleconsults(patientId, [...existing, record]);
    toast.success("Teleconsult note saved");
    onSaved(record);
  }

  return (
    <div
      className="border-b border-border bg-teal-50/60 px-4 py-4 space-y-3"
      data-ocid="teleconsult_panel.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-teal-800">
            Teleconsult — {patientName} —{" "}
            {format(new Date(), "dd MMM yyyy, h:mm a")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          data-ocid="teleconsult_panel.close_button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-teal-800">
            Chief Complaint <span className="text-destructive">*</span>
          </Label>
          <input
            type="text"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="e.g. Fever for 3 days, headache"
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-teal-300"
            data-ocid="teleconsult_panel.chief_complaint.input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-teal-800">
            Brief Assessment
          </Label>
          <Textarea
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="Clinical assessment, probable diagnosis, severity..."
            className="resize-none text-sm min-h-[72px]"
            data-ocid="teleconsult_panel.assessment.textarea"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-teal-800">Advice</Label>
          <Textarea
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            placeholder="Medication advice, dietary instructions, when to visit..."
            className="resize-none text-sm min-h-[60px]"
            data-ocid="teleconsult_panel.advice.textarea"
          />
        </div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasPrescription}
            onChange={(e) => setHasPrescription(e.target.checked)}
            className="mt-0.5 accent-teal-600"
            data-ocid="teleconsult_panel.prescription.checkbox"
          />
          <span className="text-sm text-foreground">
            Write Prescription
            {hasPrescription && (
              <span className="block text-xs text-muted-foreground mt-0.5">
                Prescription can be written via Patient Profile → Prescriptions
              </span>
            )}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
          data-ocid="teleconsult_panel.submit_button"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          Save Teleconsult Note
        </Button>
      </div>
    </div>
  );
}

// ── Main PatientChat ──────────────────────────────────────────────────────────

export default function PatientChat({
  patientId,
  currentRole,
  currentUserName,
  patientName = "Patient",
  floating = false,
  onClose,
}: PatientChatProps) {
  const isDoctor =
    currentRole === "doctor" ||
    currentRole === "admin" ||
    currentRole === "consultant_doctor" ||
    currentRole === "medical_officer" ||
    currentRole === "intern_doctor";
  const canTeleconsult = CLINICAL_ROLES.includes(currentRole);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    isDoctor
      ? markPatientMessagesSeen(patientId, currentUserName)
      : loadMessages(patientId),
  );
  const [text, setText] = useState("");
  const [showTeleconsult, setShowTeleconsult] = useState(false);
  const [showTeleconsultHistory, setShowTeleconsultHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // When doctor opens chat, mark patient messages as seen
  // biome-ignore lint/correctness/useExhaustiveDependencies: run when doctor opens chat for this patient
  useEffect(() => {
    if (isDoctor) {
      const updated = markPatientMessagesSeen(patientId, currentUserName);
      setMessages(updated);
    }
  }, [patientId, isDoctor]);

  // Patient side: poll every 5s to pick up "seenAt" updates written by the doctor
  useEffect(() => {
    if (isDoctor) return;
    const iv = setInterval(() => {
      setMessages(loadMessages(patientId));
    }, 5000);
    return () => clearInterval(iv);
  }, [patientId, isDoctor]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll on message change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      senderId: currentUserName,
      senderRole: currentRole as ChatMessage["senderRole"],
      senderName: currentUserName,
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, msg];
    setMessages(updated);
    saveMessages(patientId, updated);
    setText("");
  }

  function handleTeleconsultSaved(record: TeleconsultRecord) {
    // Add a chat notification message
    const notifMsg: ChatMessage = {
      id: `tc_notif_${Date.now()}`,
      senderId: currentUserName,
      senderRole: "doctor",
      senderName: currentUserName,
      text: `${currentUserName} completed a teleconsult at ${format(new Date(record.timestamp), "h:mm a")}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, notifMsg];
    setMessages(updated);
    saveMessages(patientId, updated);
    setShowTeleconsult(false);
  }

  const teleconsultCount = loadTeleconsults(patientId).length;

  const inner = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-teal-600 to-teal-700 rounded-t-xl">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Patient Chat</span>
        </div>
        <div className="flex items-center gap-2">
          {canTeleconsult && (
            <button
              type="button"
              onClick={() => setShowTeleconsult((p) => !p)}
              className="flex items-center gap-1.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
              data-ocid="teleconsult.open_modal_button"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Teleconsult
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              data-ocid="patient_chat.close_button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Teleconsult panel — inline, appears above messages */}
      {showTeleconsult && (
        <TeleconsultPanel
          patientId={patientId}
          patientName={patientName}
          doctorName={currentUserName}
          doctorRole={currentRole}
          onSaved={handleTeleconsultSaved}
          onClose={() => setShowTeleconsult(false)}
        />
      )}

      {/* Teleconsult history toggle */}
      {canTeleconsult && teleconsultCount > 0 && !showTeleconsult && (
        <button
          type="button"
          onClick={() => setShowTeleconsultHistory((p) => !p)}
          className="flex items-center justify-between px-4 py-2 bg-teal-50 border-b border-border text-xs text-teal-700 hover:bg-teal-100 transition-colors"
          data-ocid="teleconsult_history.toggle"
        >
          <span className="flex items-center gap-1.5">
            <Phone className="w-3 h-3" />
            {teleconsultCount} teleconsult{teleconsultCount !== 1 ? "s" : ""} on
            record
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${showTeleconsultHistory ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {/* Teleconsult history inline */}
      {showTeleconsultHistory && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 max-h-72 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Teleconsult History
          </p>
          <TeleconsultHistory patientId={patientId} />
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div
            className="text-center py-8"
            data-ocid="patient_chat.empty_state"
          >
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start a conversation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = isDoctor
                ? msg.senderRole === "doctor" ||
                  msg.senderRole === "admin" ||
                  msg.senderName === currentUserName
                : msg.senderRole === "patient";
              // Patient sees "Seen" indicator on their own messages
              const showSeen =
                !isDoctor && msg.senderRole === "patient" && msg.seenAt;
              const isTeleconsultNotif = msg.id.startsWith("tc_notif_");

              if (isTeleconsultNotif) {
                return (
                  <div
                    key={msg.id}
                    className="flex justify-center"
                    data-ocid="patient_chat.row"
                  >
                    <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 text-xs text-teal-700">
                      <Stethoscope className="w-3 h-3" />
                      {msg.text}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                  data-ocid="patient_chat.row"
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isOwn
                        ? "bg-teal-600 text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                        {msg.senderName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        isOwn ? "text-teal-200" : "text-muted-foreground"
                      }`}
                    >
                      {format(new Date(msg.timestamp), "h:mm a")}
                    </p>
                  </div>
                  {/* Seen receipt — only shown to patient on their own messages */}
                  {showSeen && (
                    <div
                      className="flex items-center gap-1 mt-0.5 px-1"
                      data-ocid="patient_chat.seen_indicator"
                    >
                      <CheckCheck className="w-3 h-3 text-teal-500" />
                      <Eye className="w-3 h-3 text-teal-500" />
                      <span className="text-[10px] text-teal-600 font-medium">
                        Seen {seenAgo(msg.seenAt!)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border flex gap-2">
        <input
          className="flex-1 border border-input rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-background"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          data-ocid="patient_chat.input"
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={!text.trim()}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-full w-9 h-9 p-0"
          data-ocid="patient_chat.submit_button"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );

  if (floating) {
    return (
      <div
        className="fixed bottom-6 right-6 w-80 h-[420px] bg-card rounded-xl shadow-2xl border border-border flex flex-col z-50 overflow-hidden"
        data-ocid="patient_chat.modal"
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col"
      style={{ minHeight: 380 }}
      data-ocid="patient_chat.panel"
    >
      {inner}
    </div>
  );
}
