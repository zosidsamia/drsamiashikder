import {
  AlertTriangle,
  Maximize2,
  MonitorPlay,
  Plus,
  Search,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SerialEntry {
  id: string;
  serial: number;
  patientName: string;
  phone: string;
  arrivalTime: string;
  status: "waiting" | "in-progress" | "done";
  walkIn?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayKey(): string {
  return `clinic_serials_${new Date().toISOString().slice(0, 10)}`;
}

const DEFAULT_VIDEO_URL =
  "https://www.youtube.com/embed/videoseries?list=PLbpi6ZahtOH6Ar_3GPy3workfN8S9-fvo&autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&modestbranding=1";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowTime(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function todayKeyLocal(): string {
  return `clinic_serials_${new Date().toISOString().slice(0, 10)}`;
}

/** Returns true if the current logged-in user is a Consultant Doctor or Staff */
function canAddWalkIn(): boolean {
  try {
    const raw = localStorage.getItem("medicare_current_doctor");
    if (!raw) return false;
    const user = JSON.parse(raw) as { role?: string };
    const allowedRoles = ["doctor", "consultant_doctor", "staff", "admin"];
    return allowedRoles.includes(user.role ?? "");
  } catch {
    return false;
  }
}

/** All patients from localStorage for search */
function getAllPatientNames(): Array<{ name: string; phone: string }> {
  const results: Array<{ name: string; phone: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("patients_")) continue;
      const arr = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
        fullName?: string;
        phone?: string;
      }>;
      for (const p of arr) {
        if (p.fullName)
          results.push({ name: p.fullName, phone: p.phone ?? "" });
      }
    }
  } catch {}
  return results;
}

/** Resolve the video embed URL for the serial display.
 *  Reads serialDisplayVideoUrl_{doctorEmail} from localStorage.
 *  Falls back to the default playlist when nothing is saved.
 */
function resolveVideoUrl(): string {
  try {
    const email = localStorage.getItem("app_current_user_email");
    if (email) {
      const custom = localStorage.getItem(`serialDisplayVideoUrl_${email}`);
      if (custom?.trim()) return toDisplayEmbedUrl(custom.trim());
    }
    // Also try a scan for any saved key as fallback (e.g. when display is open without login)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("serialDisplayVideoUrl_")) {
        const v = localStorage.getItem(k);
        if (v?.trim()) return toDisplayEmbedUrl(v.trim());
      }
    }
  } catch {}
  return DEFAULT_VIDEO_URL;
}

/** Convert plain YouTube/Vimeo watch URLs to embed format. */
function toDisplayEmbedUrl(raw: string): string {
  const url = raw.trim();
  const ytWatch = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytWatch) {
    return `https://www.youtube.com/embed/${ytWatch[1]}?autoplay=1&mute=1&loop=1&controls=1&rel=0&modestbranding=1`;
  }
  if (url.includes("youtube.com/embed")) return url;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1`;
  }
  if (url.includes("player.vimeo.com")) return url;
  return url;
}

function safeParseQueue(raw: string | null): SerialEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SerialEntry =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as SerialEntry).id === "string" &&
        typeof (item as SerialEntry).serial === "number" &&
        typeof (item as SerialEntry).patientName === "string" &&
        ["waiting", "in-progress", "done"].includes(
          (item as SerialEntry).status,
        ),
    );
  } catch {
    return [];
  }
}

function mergeQueues(
  local: SerialEntry[],
  remote: SerialEntry[],
): SerialEntry[] {
  const map = new Map<string, SerialEntry>();
  for (const item of local) map.set(item.id, item);
  // Remote wins for same id
  for (const item of remote) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => a.serial - b.serial);
}

function isSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

class QueueErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SerialDisplay error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center px-6">
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Queue display unavailable
            </h1>
            <p className="text-gray-400 max-w-sm mx-auto">
              Unable to load the patient queue. Please refresh the page to try
              again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Canister queue sync (best-effort) ─────────────────────────────────────────
// The canister backend has no dedicated queue API, so we piggy-back on
// ClinicalNotes: we store the queue as a JSON blob in a note with
// noteSubtype = "queue_display". All devices writing or reading this key
// see the same cross-device state within 1–2 canister round-trips.

const QUEUE_NOTE_SUBTYPE = "queue_display";

async function tryPullQueueFromCanister(): Promise<SerialEntry[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = (window as any).__canisterActorForQueue;
    if (!actor || !navigator.onLine) return [];
    const today = new Date().toISOString().slice(0, 10);
    const notes: Array<{
      content: string;
      noteSubtype?: string;
      createdAt: bigint;
    }> = await actor.getClinicalNotesByType(0n, "General");
    const queueNotes = notes
      .filter((n) => n.noteSubtype === QUEUE_NOTE_SUBTYPE)
      .sort((a, b) => Number(b.createdAt - a.createdAt));
    if (queueNotes.length === 0) return [];
    const parsed: unknown = JSON.parse(queueNotes[0].content);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "date" in parsed &&
      (parsed as { date: string }).date === today &&
      "entries" in parsed
    ) {
      return safeParseQueue(
        JSON.stringify((parsed as { entries: unknown }).entries),
      );
    }
    return [];
  } catch {
    return [];
  }
}

// ── Walk-In Modal ─────────────────────────────────────────────────────────────

interface WalkInModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<SerialEntry, "id" | "serial">) => void;
}

function WalkInModal({ open, onClose, onAdd }: WalkInModalProps) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    name: string;
    phone: string;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const allPatients = getAllPatientNames();
  const filtered = searchQuery.trim()
    ? allPatients.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  function handleAdd() {
    if (mode === "search") {
      if (!selectedPatient) return;
      onAdd({
        patientName: selectedPatient.name,
        phone: selectedPatient.phone,
        arrivalTime: nowTime(),
        status: "waiting",
        walkIn: true,
      });
    } else {
      const name =
        newName.trim() || `Walk-in #${Math.floor(Math.random() * 90) + 10}`;
      onAdd({
        patientName: name,
        phone: "",
        arrivalTime: nowTime(),
        status: "waiting",
        walkIn: true,
      });
    }
    // Reset
    setSearchQuery("");
    setNewName("");
    setSelectedPatient(null);
    setMode("search");
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      data-ocid="serial_display.walkin_modal"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-white text-lg">
              Add Walk-In Patient
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
            aria-label="Close"
            data-ocid="serial_display.walkin_close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("search");
              setSelectedPatient(null);
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === "search"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            data-ocid="serial_display.walkin_search_tab"
          >
            Registered Patient
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("new");
              setSelectedPatient(null);
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === "new"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            data-ocid="serial_display.walkin_new_tab"
          >
            New Walk-In
          </button>
        </div>

        {/* Content */}
        {mode === "search" ? (
          <div className="space-y-3" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search patient name…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedPatient(null);
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                data-ocid="serial_display.walkin_search_input"
              />
            </div>
            {selectedPatient ? (
              <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {selectedPatient.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    {selectedPatient.name}
                  </p>
                  {selectedPatient.phone && (
                    <p className="text-gray-400 text-xs">
                      {selectedPatient.phone}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              filtered.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 divide-y divide-gray-700">
                  {filtered.slice(0, 8).map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors flex items-center justify-between gap-2"
                      onClick={() => {
                        setSelectedPatient(p);
                        setSearchQuery(p.name);
                      }}
                      data-ocid="serial_display.walkin_patient_option"
                    >
                      <span className="font-medium truncate">{p.name}</span>
                      {p.phone && (
                        <span className="text-gray-400 text-xs shrink-0">
                          {p.phone}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="walkin-name"
              className="text-sm text-gray-400 font-medium"
            >
              Walk-in name (optional)
            </label>
            <input
              id="walkin-name"
              type="text"
              placeholder="e.g. Walk-in #3 or leave blank for auto"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              data-ocid="serial_display.walkin_name_input"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            data-ocid="serial_display.walkin_cancel_button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={mode === "search" && !selectedPatient}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-1.5"
            data-ocid="serial_display.walkin_add_button"
          >
            <Plus className="w-4 h-4" />
            Add to Queue
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Health Tip Slideshow (fallback when video fails) ─────────────────────────

const SLIDESHOW_TIPS = [
  {
    text: "Wash your hands for at least 20 seconds to prevent infections",
    bg: "from-blue-900 to-blue-800",
    icon: "🧼",
  },
  {
    text: "Drink 8 glasses of water daily to stay hydrated",
    bg: "from-cyan-900 to-cyan-800",
    icon: "💧",
  },
  {
    text: "Regular exercise for 30 minutes daily improves heart health",
    bg: "from-teal-900 to-teal-800",
    icon: "🏃",
  },
  {
    text: "Blood pressure check recommended every 6 months",
    bg: "from-purple-900 to-purple-800",
    icon: "❤️",
  },
  {
    text: "Diabetes screening is advised for adults over 40",
    bg: "from-green-900 to-green-800",
    icon: "🔬",
  },
  {
    text: "Adequate sleep (7-8 hours) strengthens your immune system",
    bg: "from-indigo-900 to-indigo-800",
    icon: "😴",
  },
  {
    text: "Avoid self-medication — consult your doctor before taking new drugs",
    bg: "from-rose-900 to-rose-800",
    icon: "💊",
  },
  {
    text: "Regular eye checkups recommended every 2 years",
    bg: "from-amber-900 to-amber-800",
    icon: "👁️",
  },
  {
    text: "Take all prescribed antibiotics as directed — do not stop early",
    bg: "from-orange-900 to-orange-800",
    icon: "⚕️",
  },
  {
    text: "Vaccinations protect you and your community — stay up to date",
    bg: "from-emerald-900 to-emerald-800",
    icon: "💉",
  },
];

function HealthTipSlideshow() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % SLIDESHOW_TIPS.length);
        setVisible(true);
      }, 500);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const tip = SLIDESHOW_TIPS[idx];

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br ${tip.bg} transition-all duration-500`}
      data-ocid="serial_display.health_slideshow"
    >
      <div
        className={`text-center transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="text-6xl mb-6">{tip.icon}</div>
        <p className="text-white text-xl sm:text-2xl font-semibold leading-relaxed max-w-xs mx-auto">
          {tip.text}
        </p>
        <div className="mt-8 text-gray-400 text-sm">
          <p className="font-semibold text-gray-300">
            Dr. Arman Kabir&apos;s Care
          </p>
          <p className="text-xs mt-1">Health Education Series</p>
        </div>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {SLIDESHOW_TIPS.map((t, i) => (
            <div
              key={t.text.slice(0, 10)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-3" : "bg-white/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function SerialDisplayInner() {
  const [serials, setSerials] = useState<SerialEntry[]>([]);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showVideoPanel, setShowVideoPanel] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>(() => resolveVideoUrl());
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const allowWalkIn = canAddWalkIn();
  const prevNowServingIdRef = useRef<string | null>(null);
  const lastCanisterPollRef = useRef<number>(0);

  // Real-time clock
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // BroadcastChannel for same-browser tab sync
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    try {
      const bc = new BroadcastChannel("clinic_queue_sync");
      bcRef.current = bc;
      bc.onmessage = (e: MessageEvent) => {
        const incoming = safeParseQueue(JSON.stringify(e.data));
        if (incoming.length > 0) {
          setSerials((prev) => mergeQueues(prev, incoming));
        }
      };
      return () => bc.close();
    } catch {
      // BroadcastChannel not supported — gracefully degrade
      return undefined;
    }
  }, []);

  // Listen for video URL updates from Settings page
  useEffect(() => {
    try {
      const bc = new BroadcastChannel("serial_display_video_sync");
      bc.onmessage = (e: MessageEvent<{ videoUrl: string | null }>) => {
        const newUrl = e.data?.videoUrl;
        setVideoUrl(newUrl ? toDisplayEmbedUrl(newUrl) : DEFAULT_VIDEO_URL);
        setVideoLoadError(false); // reset error on new URL
      };
      return () => bc.close();
    } catch {
      return undefined;
    }
  }, []);

  // Re-read video URL on tab visibility change (cross-device: doctor saves on phone, display picks up)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setVideoUrl(resolveVideoUrl());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Primary poll: localStorage every 2s + canister every 5s
  useEffect(() => {
    const load = async () => {
      try {
        // 1. Read localStorage (fast, always)
        const raw = localStorage.getItem(todayKeyLocal());
        const localEntries = safeParseQueue(raw);

        // 2. Try canister every 5 seconds for cross-device sync
        const now = Date.now();
        let merged = localEntries;
        if (now - lastCanisterPollRef.current >= 5_000) {
          lastCanisterPollRef.current = now;
          const remoteEntries = await tryPullQueueFromCanister();
          if (remoteEntries.length > 0) {
            merged = mergeQueues(localEntries, remoteEntries);
            // Write back merged result to localStorage so future local reads are up-to-date
            try {
              localStorage.setItem(todayKey(), JSON.stringify(merged));
            } catch {
              // localStorage full or unavailable
            }
          }
        }

        setSerials(merged);
        setHasError(false);
      } catch (err) {
        console.error("SerialDisplay poll error:", err);
        setHasError(true);
        // Ensure we always show something rather than crashing
        setSerials([]);
      }
    };

    load();
    const interval = setInterval(load, 2_000);
    return () => clearInterval(interval);
  }, []);

  const nowServing = serials.find((s) => s.status === "in-progress") ?? null;
  const waiting = serials.filter((s) => s.status === "waiting");
  const doneCount = serials.filter((s) => s.status === "done").length;

  // Announce when now-serving changes
  useEffect(() => {
    const currentId = nowServing?.id ?? null;
    if (
      currentId &&
      currentId !== prevNowServingIdRef.current &&
      speechEnabled &&
      isSpeechAvailable()
    ) {
      try {
        const serial = nowServing?.serial ?? 0;
        const text = `Patient number ${serial} please come. আসুন পেশেন্ট নম্বর ${serial}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch {
        // Speech synthesis failed — ignore silently
      }
    }
    prevNowServingIdRef.current = currentId;
  }, [nowServing, speechEnabled]);

  const handleFullscreen = () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Fullscreen not available
    }
  };

  function handleAddWalkIn(entry: Omit<SerialEntry, "id" | "serial">) {
    const next =
      serials.length > 0 ? Math.max(...serials.map((s) => s.serial)) + 1 : 1;
    const newEntry: SerialEntry = {
      ...entry,
      id: uid(),
      serial: next,
    };
    const updated = [...serials, newEntry];
    setSerials(updated);
    // Persist to localStorage
    try {
      localStorage.setItem(todayKeyLocal(), JSON.stringify(updated));
      // Broadcast to other tabs
      const bc = new BroadcastChannel("clinic_queue_sync");
      bc.postMessage(updated);
      bc.close();
    } catch {}
  }

  const currentTimeStr = time.toLocaleTimeString("en-BD", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const currentDateStr = time.toLocaleDateString("en-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col select-none"
      data-ocid="serial_display.page"
    >
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-3 bg-gray-900/90 border-b border-gray-800 backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wide truncate">
            Dr. Arman Kabir&apos;s Care
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            Patient Queue Display
          </p>
        </div>

        {/* Date + time — center on large screens */}
        <div className="hidden sm:block text-center flex-1">
          <p className="text-xl sm:text-3xl font-bold text-white tabular-nums leading-tight">
            {currentTimeStr}
          </p>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">
            {currentDateStr}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Walk-In button — only for Consultant Doctor and Staff */}
          {allowWalkIn && (
            <button
              type="button"
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              title="Add walk-in patient to queue"
              data-ocid="serial_display.walkin_button"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Walk-In</span>
            </button>
          )}

          {/* Online status indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
              isOnline
                ? "bg-emerald-900/40 border border-emerald-700/40 text-emerald-400"
                : "bg-red-900/40 border border-red-700/40 text-red-400"
            }`}
            data-ocid="serial_display.sync_status"
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {isOnline ? "Synced" : "Offline"}
          </div>

          {/* Video panel toggle */}
          <button
            type="button"
            onClick={() => setShowVideoPanel((v) => !v)}
            className={`p-2.5 rounded-xl transition-colors ${
              showVideoPanel
                ? "bg-blue-800 hover:bg-blue-700"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            title={showVideoPanel ? "Hide video panel" : "Show video panel"}
            data-ocid="serial_display.video_toggle"
          >
            <MonitorPlay
              className={`w-5 h-5 ${showVideoPanel ? "text-blue-300" : "text-gray-400"}`}
            />
          </button>

          {/* Speech toggle */}
          <button
            type="button"
            onClick={() => setSpeechEnabled((v) => !v)}
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
            title={
              speechEnabled ? "Mute announcements" : "Enable announcements"
            }
            aria-label={
              speechEnabled ? "Mute announcements" : "Enable announcements"
            }
            data-ocid="serial_display.speech_toggle"
          >
            {speechEnabled ? (
              <Volume2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
            title="Fullscreen"
            aria-label="Enter fullscreen"
            data-ocid="serial_display.fullscreen_button"
          >
            <Maximize2 className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      {/* ── Mobile clock strip ───────────────────────────────────────────── */}
      <div className="sm:hidden flex items-center justify-between px-4 py-2 bg-gray-900/60 border-b border-gray-800/60 text-sm">
        <span className="text-gray-400 text-xs">{currentDateStr}</span>
        <span className="font-bold text-white tabular-nums">
          {currentTimeStr}
        </span>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {hasError && (
        <div
          className="mx-4 mt-3 flex items-center gap-3 bg-red-900/40 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300"
          data-ocid="serial_display.error_state"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          Queue data unavailable — reconnecting automatically. Check your
          connection.
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col gap-4 p-3 sm:p-6 ${showVideoPanel ? "lg:flex-row" : ""}`}
      >
        {/* Left section: Now Serving + Waiting Queue */}
        <div
          className={`flex flex-col gap-4 ${showVideoPanel ? "lg:flex-1" : "flex-1"}`}
        >
          {/* Now Serving hero panel */}
          <div
            className="flex-1 bg-gray-900/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center py-8 px-4 min-h-[240px]"
            data-ocid="serial_display.now_serving.panel"
          >
            <AnimatePresence mode="wait">
              {nowServing ? (
                <motion.div
                  key={nowServing.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35 }}
                  className="text-center w-full max-w-md"
                >
                  <p className="text-gray-400 text-sm sm:text-base uppercase tracking-[0.25em] mb-4 font-medium">
                    Now Serving
                  </p>
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 0px #10b98180",
                        "0 0 40px #10b98180",
                        "0 0 0px #10b98180",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                    className="w-24 h-24 sm:w-40 sm:h-40 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-5 ring-4 ring-emerald-400/30"
                  >
                    <span className="text-4xl sm:text-7xl font-black text-white">
                      {nowServing.serial}
                    </span>
                  </motion.div>
                  <h2 className="text-2xl sm:text-5xl lg:text-6xl font-bold text-white mb-2 px-2 break-words leading-tight">
                    {nowServing.patientName}
                  </h2>
                  <p className="text-gray-400 text-base sm:text-xl">
                    Serial #{nowServing.serial}
                  </p>
                  {speechEnabled && isSpeechAvailable() && (
                    <div className="mt-4 inline-flex items-center gap-2 text-emerald-400 text-sm bg-emerald-900/30 border border-emerald-800/40 rounded-full px-3 py-1.5">
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                      Announcement active
                    </div>
                  )}
                </motion.div>
              ) : serials.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                  data-ocid="serial_display.empty_state"
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-5">
                    <Users className="w-12 h-12 sm:w-14 sm:h-14 text-gray-600" />
                  </div>
                  <h2 className="text-xl sm:text-3xl font-bold text-gray-500 px-4">
                    No patients in queue
                  </h2>
                  <p className="text-gray-600 mt-2 text-sm max-w-xs mx-auto leading-relaxed">
                    The queue is empty for today. Patients will appear here when
                    added by the doctor.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-5">
                    <Users className="w-12 h-12 sm:w-14 sm:h-14 text-gray-600" />
                  </div>
                  <h2 className="text-xl sm:text-3xl font-bold text-gray-500 px-4">
                    No patient currently being served
                  </h2>
                  <p className="text-gray-600 mt-2 text-sm">
                    Waiting for the doctor to call the next patient
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Up Next indicator */}
            {waiting.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 px-6 sm:px-10 py-3 sm:py-4 bg-gray-800/80 rounded-2xl border border-amber-700/30 text-center"
                data-ocid="serial_display.up_next"
              >
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1 font-medium">
                  Up Next
                </p>
                <p className="text-lg sm:text-3xl font-bold text-amber-400">
                  #{waiting[0].serial} — {waiting[0].patientName}
                </p>
              </motion.div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-3">
            <div
              className="flex-1 bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-3 text-center"
              data-ocid="serial_display.waiting_count"
            >
              <p className="text-2xl sm:text-3xl font-bold text-amber-400">
                {waiting.length}
              </p>
              <p className="text-amber-600/80 text-xs uppercase tracking-wide mt-0.5 font-medium">
                Waiting
              </p>
            </div>
            <div
              className="flex-1 bg-emerald-900/20 border border-emerald-800/30 rounded-xl px-4 py-3 text-center"
              data-ocid="serial_display.done_count"
            >
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                {doneCount}
              </p>
              <p className="text-emerald-600/80 text-xs uppercase tracking-wide mt-0.5 font-medium">
                Completed
              </p>
            </div>
            <div
              className="flex-1 bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 text-center"
              data-ocid="serial_display.total_count"
            >
              <p className="text-2xl sm:text-3xl font-bold text-blue-400">
                {serials.length}
              </p>
              <p className="text-blue-600/80 text-xs uppercase tracking-wide mt-0.5 font-medium">
                Total
              </p>
            </div>
          </div>

          {/* Waiting queue list */}
          <div
            className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden"
            data-ocid="serial_display.queue.list"
          >
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/80">
              <h3 className="font-bold text-gray-200 text-base">
                Waiting Queue
              </h3>
              <span className="bg-amber-500 text-black text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[1.5rem] text-center">
                {waiting.length}
              </span>
            </div>
            <div className="overflow-y-auto max-h-48 sm:max-h-56 p-3 space-y-2">
              {waiting.length === 0 ? (
                <p
                  className="text-gray-600 text-sm text-center py-8"
                  data-ocid="serial_display.queue.empty_state"
                >
                  No patients waiting
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {waiting.map((s, idx) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${
                        idx === 0
                          ? "bg-amber-900/30 border border-amber-700/30"
                          : "bg-gray-800/60"
                      }`}
                      data-ocid={`serial_display.queue.item.${idx + 1}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                          idx === 0
                            ? "bg-amber-500 text-black"
                            : "bg-gray-700 text-white"
                        }`}
                      >
                        {s.serial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate text-sm">
                          {s.patientName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Arrived: {s.arrivalTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.walkIn && (
                          <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">
                            Walk-In
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded">
                            NEXT
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {/* Right section: Health education video panel */}
        {showVideoPanel && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="lg:w-[420px] xl:w-[500px] flex flex-col gap-3"
            data-ocid="serial_display.video.panel"
          >
            <div className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden flex-1 flex flex-col min-h-[200px] sm:min-h-[280px]">
              <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-gray-200 text-sm">
                    Health Education
                  </h3>
                </div>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  Live
                </span>
              </div>

              {/* Video embed — falls back to health tip slideshow on error */}
              <div className="flex-1 relative bg-black flex flex-col">
                {!videoLoadError ? (
                  <iframe
                    key={videoUrl}
                    src={videoUrl}
                    title="Health Education"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                    onError={() => setVideoLoadError(true)}
                  />
                ) : (
                  <HealthTipSlideshow />
                )}
              </div>

              {/* Health tip ticker */}
              <div className="px-4 py-2.5 bg-gray-900/90 border-t border-gray-800">
                <HealthTicker />
              </div>
            </div>

            {/* Quick health facts */}
            <div className="grid grid-cols-2 gap-2.5">
              {HEALTH_FACTS.map((fact) => (
                <div
                  key={fact.label}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl p-3"
                >
                  <p className="text-lg font-bold text-emerald-400">
                    {fact.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                    {fact.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Walk-In Modal */}
      <AnimatePresence>
        {showWalkIn && (
          <WalkInModal
            open={showWalkIn}
            onClose={() => setShowWalkIn(false)}
            onAdd={handleAddWalkIn}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Health ticker ─────────────────────────────────────────────────────────────

const HEALTH_TIPS = [
  "💧 Drink at least 8 glasses of water daily to stay healthy.",
  "🚶 Walk 30 minutes every day to maintain a healthy heart.",
  "🥦 Eat more vegetables and fruits for essential vitamins.",
  "😴 Get 7–8 hours of sleep every night for body recovery.",
  "🩺 Visit your doctor regularly for preventive check-ups.",
  "🚭 Avoid smoking — it causes heart disease and cancer.",
  "🧘 Manage stress with yoga, meditation, or deep breathing.",
  "💊 Never skip prescribed medicines without consulting your doctor.",
];

const HEALTH_FACTS = [
  { value: "150 min", label: "Weekly exercise target" },
  { value: "5 servings", label: "Fruits & veggies per day" },
  { value: "8 hrs", label: "Recommended daily sleep" },
  { value: "<120/80", label: "Healthy blood pressure" },
];

function HealthTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % HEALTH_TIPS.length);
        setVisible(true);
      }, 400);
    }, 6_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <p
      className={`text-xs text-gray-300 transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ minHeight: "1.25rem" }}
    >
      {HEALTH_TIPS[idx]}
    </p>
  );
}

// ── Exported component with error boundary ────────────────────────────────────

export default function SerialDisplay() {
  return (
    <QueueErrorBoundary>
      <SerialDisplayInner />
    </QueueErrorBoundary>
  );
}
