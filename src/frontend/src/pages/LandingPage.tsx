import AdminFrontPagePanel from "@/components/AdminFrontPagePanel";
import EmergencyConsultationModal from "@/components/EmergencyConsultationModal";
import GallerySection from "@/components/GallerySection";
import PrescriptionPDFManager from "@/components/PrescriptionPDFManager";
import TestimonialsSection from "@/components/TestimonialsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DoctorKey } from "@/data/doctorsData";
import { useDoctorContent } from "@/hooks/useDoctorContent";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import {
  AlertTriangle,
  Award,
  BookOpen,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Heart,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Navigation,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
  Youtube,
  ZoomIn,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface LandingPageProps {
  onLoginClick: () => void;
  onAdminLoginClick: () => void;
  isAdmin: boolean;
  adminLogout: () => void;
}

interface PublicBooking {
  id: string;
  patientName: string;
  phone: string;
  doctor: string;
  date?: string;
  preferredDate?: string;
  time?: string;
  preferredTime?: string;
  reason?: string;
  chamber?: string;
  preferredChamber?: string;
  submittedAt: string;
  status: "pending" | "confirmed" | "cancelled";
  registerNumber?: string;
  appointmentType?: string;
  hospitalName?: string;
  bedWardNumber?: string;
  admissionReason?: string;
  referringDoctor?: string;
  serialNumber?: number;
  serialDate?: string;
}

function loadPublicBookings(): PublicBooking[] {
  try {
    return JSON.parse(
      localStorage.getItem("public_appointment_requests") || "[]",
    );
  } catch {
    return [];
  }
}

function savePublicBookings(data: PublicBooking[]) {
  localStorage.setItem("public_appointment_requests", JSON.stringify(data));
}

// ─── Classroom helpers ────────────────────────────────────────────────────────

const DAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function isNewItem(dateStr: string): boolean {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function buildGCalUrl(
  subject: string,
  location: string,
  doctorName: string,
): string {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: subject,
    details: `${doctorName} classroom session`,
    dates: `${dateStr}/${dateStr}`,
    location: location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── Classroom Tab Content ────────────────────────────────────────────────────

function ClassroomContent({
  doctorKey,
  isAdmin,
  isConsultantDoctor,
  currentDoctorId,
  updateField,
}: {
  doctorKey: DoctorKey;
  isAdmin: boolean;
  isConsultantDoctor?: boolean;
  currentDoctorId?: string;
  updateField: (key: DoctorKey, path: string, value: any) => void;
}) {
  const { getContent } = useDoctorContent();
  const doc = getContent(doctorKey);
  const cls = doc.classroom;

  // Permission: admin OR consultant editing their own classroom
  const canEdit =
    isAdmin || (isConsultantDoctor && currentDoctorId === doctorKey);

  const color = doctorKey === "arman" ? "text-primary" : "text-rose-600";
  const bg = doctorKey === "arman" ? "bg-primary/10" : "bg-rose-100";
  const border =
    doctorKey === "arman" ? "border-primary/20" : "border-rose-200";
  const activeTabColor =
    doctorKey === "arman"
      ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
      : "data-[state=active]:bg-rose-600 data-[state=active]:text-white";

  // Global search
  const [globalSearch, setGlobalSearch] = useState("");
  const q = globalSearch.toLowerCase().trim();

  // Announcement state
  const [addAnn, setAddAnn] = useState(false);
  const [annForm, setAnnForm] = useState({
    title: "",
    date: "",
    body: "",
    isPinned: false,
  });
  const [editAnnIdx, setEditAnnIdx] = useState<number | null>(null);
  const [editAnnForm, setEditAnnForm] = useState({
    title: "",
    date: "",
    body: "",
    isPinned: false,
  });

  // Note state
  const [addNote, setAddNote] = useState(false);
  const [noteForm, setNoteForm] = useState({
    title: "",
    description: "",
    link: "",
    pdfUrl: "",
    datePublished: new Date().toISOString().split("T")[0],
  });
  const [editNoteIdx, setEditNoteIdx] = useState<number | null>(null);
  const [editNoteForm, setEditNoteForm] = useState({
    title: "",
    description: "",
    link: "",
    pdfUrl: "",
    datePublished: "",
  });

  // Video state
  const [addVideo, setAddVideo] = useState(false);
  const [videoForm, setVideoForm] = useState({
    title: "",
    url: "",
    description: "",
    isFeatured: false,
  });
  const [editVideoIdx, setEditVideoIdx] = useState<number | null>(null);
  const [editVideoForm, setEditVideoForm] = useState({
    title: "",
    url: "",
    description: "",
    isFeatured: false,
  });

  // Schedule state
  const [addSchedule, setAddSchedule] = useState(false);
  const [schedForm, setSchedForm] = useState({
    day: "",
    time: "",
    subject: "",
    venue: "",
  });
  const [editSchedIdx, setEditSchedIdx] = useState<number | null>(null);
  const [editSchedForm, setEditSchedForm] = useState({
    day: "",
    time: "",
    subject: "",
    venue: "",
  });

  // ── Filtered data ────────────────────────────────────────────────────────────
  const filteredAnn = (cls.announcements as any[]).filter(
    (a: any) =>
      !q ||
      a.title?.toLowerCase().includes(q) ||
      a.body?.toLowerCase().includes(q),
  );
  const filteredNotes = (cls.notes as any[]).filter(
    (n: any) =>
      !q ||
      n.title?.toLowerCase().includes(q) ||
      n.description?.toLowerCase().includes(q),
  );
  const filteredVideos = (cls.videos as any[]).filter(
    (v: any) =>
      !q ||
      v.title?.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q),
  );
  const filteredSchedule = (cls.schedule as any[]).filter(
    (s: any) =>
      !q ||
      s.subject?.toLowerCase().includes(q) ||
      s.venue?.toLowerCase().includes(q),
  );

  // Auto-switch to tab with most results when searching
  // Gallery lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Gallery data from classroom content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const galleryImages: Array<{
    id: string;
    dataUrl: string;
    caption: string;
    category: string;
  }> = ((cls.gallery as any[]) ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (g: any) => ({
      id: g.id ?? "",
      dataUrl: g.dataUrl ?? "",
      caption: g.caption ?? "",
      category: g.category ?? "",
    }),
  );

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };
  const prevImg = () =>
    setLightboxIdx((i) => (i === 0 ? galleryImages.length - 1 : i - 1));
  const nextImg = () =>
    setLightboxIdx((i) => (i === galleryImages.length - 1 ? 0 : i + 1));

  const tabCounts = {
    announcements: filteredAnn.length,
    notes: filteredNotes.length,
    videos: filteredVideos.length,
    schedule: filteredSchedule.length,
    gallery: galleryImages.length,
  };
  const defaultTab = q
    ? (Object.entries(tabCounts).sort((a, b) => b[1] - a[1])[0][0] as string)
    : "announcements";

  // Sorted schedule (Mon first)
  const sortedSchedule = [...filteredSchedule].sort((a: any, b: any) => {
    const ai = DAY_ORDER.indexOf(a.day);
    const bi = DAY_ORDER.indexOf(b.day);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return (a.time || "").localeCompare(b.time || "");
  });

  // ── Announcement CRUD ────────────────────────────────────────────────────────
  const saveAnn = () => {
    if (!annForm.title || !annForm.date || !annForm.body) return;
    const entry = { ...annForm, datePublished: annForm.date };
    const updated = [...(cls.announcements || []), entry];
    updateField(doctorKey, "classroom.announcements", updated);
    setAnnForm({ title: "", date: "", body: "", isPinned: false });
    setAddAnn(false);
    toast.success("Announcement added");
  };
  const deleteAnn = (idx: number) => {
    updateField(
      doctorKey,
      "classroom.announcements",
      (cls.announcements as any[]).filter((_: any, i: number) => i !== idx),
    );
    toast.success("Announcement deleted");
  };
  const saveEditAnn = () => {
    if (editAnnIdx === null) return;
    const updated = (cls.announcements as any[]).map((a: any, i: number) =>
      i === editAnnIdx ? editAnnForm : a,
    );
    updateField(doctorKey, "classroom.announcements", updated);
    setEditAnnIdx(null);
    toast.success("Announcement updated");
  };
  const togglePin = (idx: number) => {
    const updated = (cls.announcements as any[]).map((a: any, i: number) =>
      i === idx ? { ...a, isPinned: !a.isPinned } : a,
    );
    updateField(doctorKey, "classroom.announcements", updated);
  };

  // ── Note CRUD ────────────────────────────────────────────────────────────────
  const saveNote = () => {
    if (!noteForm.title) return;
    const entry = { ...noteForm, downloadCount: 0 };
    const updated = [...(cls.notes || []), entry];
    updateField(doctorKey, "classroom.notes", updated);
    setNoteForm({
      title: "",
      description: "",
      link: "",
      pdfUrl: "",
      datePublished: new Date().toISOString().split("T")[0],
    });
    setAddNote(false);
    toast.success("Note added");
  };
  const deleteNote = (idx: number) => {
    updateField(
      doctorKey,
      "classroom.notes",
      (cls.notes as any[]).filter((_: any, i: number) => i !== idx),
    );
    toast.success("Note deleted");
  };
  const saveEditNote = () => {
    if (editNoteIdx === null) return;
    const updated = (cls.notes as any[]).map((n: any, i: number) =>
      i === editNoteIdx ? editNoteForm : n,
    );
    updateField(doctorKey, "classroom.notes", updated);
    setEditNoteIdx(null);
    toast.success("Note updated");
  };
  const incrementDownload = (idx: number) => {
    const updated = (cls.notes as any[]).map((n: any, i: number) =>
      i === idx ? { ...n, downloadCount: (n.downloadCount || 0) + 1 } : n,
    );
    updateField(doctorKey, "classroom.notes", updated);
  };

  // ── Video CRUD ───────────────────────────────────────────────────────────────
  const saveVideo = () => {
    if (!videoForm.title || !videoForm.url) return;
    const updated = [...(cls.videos || []), videoForm];
    updateField(doctorKey, "classroom.videos", updated);
    setVideoForm({ title: "", url: "", description: "", isFeatured: false });
    setAddVideo(false);
    toast.success("Video added");
  };
  const deleteVideo = (idx: number) => {
    updateField(
      doctorKey,
      "classroom.videos",
      (cls.videos as any[]).filter((_: any, i: number) => i !== idx),
    );
    toast.success("Video deleted");
  };
  const saveEditVideo = () => {
    if (editVideoIdx === null) return;
    const updated = (cls.videos as any[]).map((v: any, i: number) =>
      i === editVideoIdx ? editVideoForm : v,
    );
    updateField(doctorKey, "classroom.videos", updated);
    setEditVideoIdx(null);
    toast.success("Video updated");
  };
  const toggleFeatured = (idx: number) => {
    const updated = (cls.videos as any[]).map((v: any, i: number) =>
      i === idx ? { ...v, isFeatured: !v.isFeatured } : v,
    );
    updateField(doctorKey, "classroom.videos", updated);
  };

  // ── Schedule CRUD ────────────────────────────────────────────────────────────
  const saveSched = () => {
    if (!schedForm.day || !schedForm.subject) return;
    const updated = [...(cls.schedule || []), schedForm];
    updateField(doctorKey, "classroom.schedule", updated);
    setSchedForm({ day: "", time: "", subject: "", venue: "" });
    setAddSchedule(false);
    toast.success("Schedule entry added");
  };
  const deleteSched = (idx: number) => {
    updateField(
      doctorKey,
      "classroom.schedule",
      (cls.schedule as any[]).filter((_: any, i: number) => i !== idx),
    );
    toast.success("Schedule entry deleted");
  };
  const saveEditSched = () => {
    if (editSchedIdx === null) return;
    const updated = (cls.schedule as any[]).map((s: any, i: number) =>
      i === editSchedIdx ? editSchedForm : s,
    );
    updateField(doctorKey, "classroom.schedule", updated);
    setEditSchedIdx(null);
    toast.success("Schedule updated");
  };

  // Sorted announcements: pinned first
  const sortedAnn = [...filteredAnn].sort(
    (a: any, b: any) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0),
  );
  // Featured videos first
  const sortedVideos = [...filteredVideos].sort(
    (a: any, b: any) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0),
  );
  // Gallery lightbox keyboard nav
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setLightboxIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setLightboxIdx((i) => Math.min(galleryImages.length - 1, i + 1));
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, galleryImages.length]);

  return (
    <div className="space-y-4">
      {/* Global Search */}
      <div className="relative" data-ocid="classroom.global.search_input">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search announcements, notes, videos, schedule…"
          className="pl-9 h-10"
        />
        {globalSearch && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setGlobalSearch("")}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content Tabs */}
      <Tabs
        defaultValue={defaultTab}
        key={defaultTab}
        className="space-y-4"
        data-ocid="classroom.content.panel"
      >
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto gap-1 bg-muted/50 p-1 rounded-xl">
          {[
            {
              value: "announcements",
              label: "Announcements",
              count: tabCounts.announcements,
              icon: <BriefcaseMedical className="w-3.5 h-3.5" />,
            },
            {
              value: "notes",
              label: "Lecture Notes",
              count: tabCounts.notes,
              icon: <BookOpen className="w-3.5 h-3.5" />,
            },
            {
              value: "videos",
              label: "Video Lectures",
              count: tabCounts.videos,
              icon: <Youtube className="w-3.5 h-3.5" />,
            },
            {
              value: "schedule",
              label: "Class Schedule",
              count: tabCounts.schedule,
              icon: <CalendarDays className="w-3.5 h-3.5" />,
            },
            {
              value: "gallery",
              label: "Gallery",
              count: tabCounts.gallery,
              icon: <ImageIcon className="w-3.5 h-3.5" />,
            },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm rounded-lg ${activeTabColor}`}
              data-ocid={`classroom.${tab.value}.tab`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-background/60 text-xs font-bold">
                {tab.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Announcements Tab ───────────────────────────────────────────── */}
        <TabsContent value="announcements" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddAnn(true)}
                data-ocid="classroom.ann.open_modal_button"
              >
                <Plus className="w-3 h-3" /> Add Announcement
              </Button>
            </div>
          )}
          {sortedAnn.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-6"
              data-ocid="classroom.ann.empty_state"
            >
              No announcements yet.
            </p>
          )}
          {/* Pinned section label */}
          {sortedAnn.some((a: any) => a.isPinned) && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              📌 Pinned
            </p>
          )}
          {sortedAnn.map((ann: any, displayIdx: number) => {
            const realIdx = (cls.announcements as any[]).indexOf(ann);
            const showUnpinnedLabel =
              displayIdx > 0 &&
              !ann.isPinned &&
              sortedAnn[displayIdx - 1]?.isPinned;
            return (
              <div key={ann.title + String(realIdx)}>
                {showUnpinnedLabel && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-3">
                    Recent
                  </p>
                )}
                <Card
                  className={`border ${ann.isPinned ? (doctorKey === "arman" ? "border-primary/40 bg-primary/5" : "border-rose-300 bg-rose-50/50") : border}`}
                >
                  <CardContent className="p-4">
                    {editAnnIdx === realIdx ? (
                      <div className="space-y-2">
                        <Input
                          value={editAnnForm.title}
                          onChange={(e) =>
                            setEditAnnForm((f) => ({
                              ...f,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Title"
                        />
                        <Input
                          type="date"
                          value={editAnnForm.date}
                          onChange={(e) =>
                            setEditAnnForm((f) => ({
                              ...f,
                              date: e.target.value,
                            }))
                          }
                        />
                        <Textarea
                          value={editAnnForm.body}
                          onChange={(e) =>
                            setEditAnnForm((f) => ({
                              ...f,
                              body: e.target.value,
                            }))
                          }
                          placeholder="Body"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={saveEditAnn}
                            data-ocid="classroom.ann.save_button"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditAnnIdx(null)}
                            data-ocid="classroom.ann.cancel_button"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {ann.isPinned && (
                              <span className="text-xs">📌</span>
                            )}
                            <p className="font-semibold text-foreground">
                              {ann.title}
                            </p>
                            {isNewItem(ann.datePublished || ann.date) && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500 text-white border-0">
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {ann.body}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                          >
                            {new Date(ann.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </Badge>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                title={ann.isPinned ? "Unpin" : "Pin"}
                                className={`p-1 transition-colors ${ann.isPinned ? color : "hover:text-amber-500"}`}
                                onClick={() => togglePin(realIdx)}
                                data-ocid={`classroom.ann.toggle.${realIdx + 1}`}
                              >
                                <span className="text-xs">
                                  {ann.isPinned ? "📌" : "📍"}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="p-1 hover:text-primary"
                                onClick={() => {
                                  setEditAnnIdx(realIdx);
                                  setEditAnnForm({
                                    title: ann.title,
                                    date: ann.date,
                                    body: ann.body,
                                    isPinned: !!ann.isPinned,
                                  });
                                }}
                                data-ocid={`classroom.ann.edit_button.${realIdx + 1}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 hover:text-destructive"
                                onClick={() => deleteAnn(realIdx)}
                                data-ocid={`classroom.ann.delete_button.${realIdx + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {/* Add announcement dialog */}
          <Dialog open={addAnn} onOpenChange={setAddAnn}>
            <DialogContent
              className="max-w-sm"
              data-ocid="classroom.ann.dialog"
            >
              <DialogHeader>
                <DialogTitle>Add Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={annForm.title}
                    onChange={(e) =>
                      setAnnForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Announcement title"
                    data-ocid="classroom.ann.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={annForm.date}
                    onChange={(e) =>
                      setAnnForm((f) => ({ ...f, date: e.target.value }))
                    }
                    data-ocid="classroom.ann.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Body</Label>
                  <Textarea
                    value={annForm.body}
                    onChange={(e) =>
                      setAnnForm((f) => ({ ...f, body: e.target.value }))
                    }
                    placeholder="Announcement text..."
                    rows={3}
                    data-ocid="classroom.ann.textarea"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ann-pin"
                    checked={annForm.isPinned}
                    onChange={(e) =>
                      setAnnForm((f) => ({ ...f, isPinned: e.target.checked }))
                    }
                    className="accent-primary"
                    data-ocid="classroom.ann.checkbox"
                  />
                  <Label htmlFor="ann-pin" className="cursor-pointer">
                    Pin this announcement
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveAnn}
                    className="flex-1"
                    data-ocid="classroom.ann.submit_button"
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAddAnn(false)}
                    className="flex-1"
                    data-ocid="classroom.ann.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Lecture Notes Tab ───────────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddNote(true)}
                data-ocid="classroom.notes.open_modal_button"
              >
                <Plus className="w-3 h-3" /> Add Note
              </Button>
            </div>
          )}
          {filteredNotes.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-6"
              data-ocid="classroom.notes.empty_state"
            >
              No lecture notes yet.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredNotes.map((note: any, displayIdx: number) => {
              const realIdx = (cls.notes as any[]).indexOf(note);
              return (
                <Card
                  key={note.title + String(realIdx)}
                  className={`border ${border} hover:shadow-md transition-shadow`}
                  data-ocid={`classroom.notes.item.${displayIdx + 1}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      {note.pdfUrl ? (
                        <FileText className="w-4 h-4 text-red-600" />
                      ) : (
                        <BookOpen className={`w-4 h-4 ${color}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editNoteIdx === realIdx ? (
                        <div className="space-y-1.5">
                          <Input
                            value={editNoteForm.title}
                            onChange={(e) =>
                              setEditNoteForm((f) => ({
                                ...f,
                                title: e.target.value,
                              }))
                            }
                            placeholder="Title"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={editNoteForm.description}
                            onChange={(e) =>
                              setEditNoteForm((f) => ({
                                ...f,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Description"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={editNoteForm.pdfUrl}
                            onChange={(e) =>
                              setEditNoteForm((f) => ({
                                ...f,
                                pdfUrl: e.target.value,
                              }))
                            }
                            placeholder="PDF Link (URL)"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={editNoteForm.link}
                            onChange={(e) =>
                              setEditNoteForm((f) => ({
                                ...f,
                                link: e.target.value,
                              }))
                            }
                            placeholder="Link (URL)"
                            className="h-7 text-xs"
                          />
                          <Input
                            type="date"
                            value={editNoteForm.datePublished}
                            onChange={(e) =>
                              setEditNoteForm((f) => ({
                                ...f,
                                datePublished: e.target.value,
                              }))
                            }
                            className="h-7 text-xs"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-6 text-xs"
                              onClick={saveEditNote}
                              data-ocid="classroom.notes.save_button"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => setEditNoteIdx(null)}
                              data-ocid="classroom.notes.cancel_button"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-sm text-foreground">
                            {note.title}
                          </p>
                          {note.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {note.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {note.datePublished && (
                              <span className="text-[10px] text-muted-foreground">
                                Published:{" "}
                                {new Date(
                                  note.datePublished,
                                ).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                            {(note.downloadCount || 0) > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Downloaded {note.downloadCount} times
                              </span>
                            )}
                          </div>
                          {note.pdfUrl && (
                            <a
                              href={note.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                              onClick={() => incrementDownload(realIdx)}
                              data-ocid={`classroom.notes.download.${displayIdx + 1}`}
                            >
                              <FileText className="w-3 h-3" />
                              Download PDF
                            </a>
                          )}
                        </>
                      )}
                    </div>
                    {editNoteIdx !== realIdx && (
                      <div className="flex items-start gap-1 shrink-0">
                        {note.link && !note.pdfUrl && (
                          <a
                            href={note.link}
                            className={`${color} hover:opacity-70`}
                            aria-label="View note"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="p-0.5 hover:text-primary"
                              onClick={() => {
                                setEditNoteIdx(realIdx);
                                setEditNoteForm({
                                  title: note.title,
                                  description: note.description || "",
                                  link: note.link || "",
                                  pdfUrl: note.pdfUrl || "",
                                  datePublished: note.datePublished || "",
                                });
                              }}
                              data-ocid={`classroom.notes.edit_button.${displayIdx + 1}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 hover:text-destructive"
                              onClick={() => deleteNote(realIdx)}
                              data-ocid={`classroom.notes.delete_button.${displayIdx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Dialog open={addNote} onOpenChange={setAddNote}>
            <DialogContent
              className="max-w-sm"
              data-ocid="classroom.notes.dialog"
            >
              <DialogHeader>
                <DialogTitle>Add Lecture Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={noteForm.title}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Note title"
                    data-ocid="classroom.notes.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={noteForm.description}
                    onChange={(e) =>
                      setNoteForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description"
                    data-ocid="classroom.notes.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>PDF Link (URL)</Label>
                  <Input
                    value={noteForm.pdfUrl}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, pdfUrl: e.target.value }))
                    }
                    placeholder="https://...pdf"
                    data-ocid="classroom.notes.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Web Link (URL)</Label>
                  <Input
                    value={noteForm.link}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, link: e.target.value }))
                    }
                    placeholder="https://..."
                    data-ocid="classroom.notes.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date Published</Label>
                  <Input
                    type="date"
                    value={noteForm.datePublished}
                    onChange={(e) =>
                      setNoteForm((f) => ({
                        ...f,
                        datePublished: e.target.value,
                      }))
                    }
                    data-ocid="classroom.notes.input"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveNote}
                    className="flex-1"
                    data-ocid="classroom.notes.submit_button"
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAddNote(false)}
                    className="flex-1"
                    data-ocid="classroom.notes.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Video Lectures Tab ──────────────────────────────────────────── */}
        <TabsContent value="videos" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddVideo(true)}
                data-ocid="classroom.videos.open_modal_button"
              >
                <Plus className="w-3 h-3" /> Add Video
              </Button>
            </div>
          )}
          {sortedVideos.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-6"
              data-ocid="classroom.videos.empty_state"
            >
              No videos yet.
            </p>
          )}
          {sortedVideos.some((v: any) => v.isFeatured) && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              ⭐ Featured
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedVideos.map((vid: any, displayIdx: number) => {
              const realIdx = (cls.videos as any[]).indexOf(vid);
              const showNonFeaturedLabel =
                displayIdx > 0 &&
                !vid.isFeatured &&
                sortedVideos[displayIdx - 1]?.isFeatured;
              return (
                <div key={vid.title + String(realIdx)}>
                  {showNonFeaturedLabel && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                      All Videos
                    </p>
                  )}
                  <VideoThumbnailCard
                    vid={vid}
                    idx={realIdx}
                    displayIdx={displayIdx}
                    isAdmin={!!canEdit}
                    editVideoIdx={editVideoIdx}
                    editVideoForm={editVideoForm}
                    setEditVideoIdx={setEditVideoIdx}
                    setEditVideoForm={(f) =>
                      setEditVideoForm(f as typeof editVideoForm)
                    }
                    onSaveEdit={saveEditVideo}
                    onDelete={deleteVideo}
                    onToggleFeatured={canEdit ? toggleFeatured : undefined}
                  />
                </div>
              );
            })}
          </div>

          <Dialog open={addVideo} onOpenChange={setAddVideo}>
            <DialogContent
              className="max-w-sm"
              data-ocid="classroom.videos.dialog"
            >
              <DialogHeader>
                <DialogTitle>Add Video</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={videoForm.title}
                    onChange={(e) =>
                      setVideoForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Video title"
                    data-ocid="classroom.videos.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>YouTube URL</Label>
                  <Input
                    value={videoForm.url}
                    onChange={(e) =>
                      setVideoForm((f) => ({ ...f, url: e.target.value }))
                    }
                    placeholder="https://youtube.com/..."
                    data-ocid="classroom.videos.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={videoForm.description}
                    onChange={(e) =>
                      setVideoForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description (2-3 lines)..."
                    rows={2}
                    data-ocid="classroom.videos.input"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="vid-featured"
                    checked={videoForm.isFeatured}
                    onChange={(e) =>
                      setVideoForm((f) => ({
                        ...f,
                        isFeatured: e.target.checked,
                      }))
                    }
                    className="accent-primary"
                    data-ocid="classroom.videos.checkbox"
                  />
                  <Label htmlFor="vid-featured" className="cursor-pointer">
                    Feature this video
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveVideo}
                    className="flex-1"
                    data-ocid="classroom.videos.submit_button"
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAddVideo(false)}
                    className="flex-1"
                    data-ocid="classroom.videos.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Class Schedule Tab ──────────────────────────────────────────── */}
        <TabsContent value="schedule" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddSchedule(true)}
                data-ocid="classroom.schedule.open_modal_button"
              >
                <Plus className="w-3 h-3" /> Add Entry
              </Button>
            </div>
          )}
          {sortedSchedule.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-6"
              data-ocid="classroom.schedule.empty_state"
            >
              No schedule entries yet.
            </p>
          )}
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Day</TableHead>
                  <TableHead className="font-semibold">Time</TableHead>
                  <TableHead className="font-semibold">Topic</TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="font-semibold w-20">Calendar</TableHead>
                  {canEdit && (
                    <TableHead className="font-semibold w-16">Edit</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSchedule.map((s: any, displayIdx: number) => {
                  const realIdx = (cls.schedule as any[]).indexOf(s);
                  return (
                    <TableRow
                      key={s.day + String(realIdx)}
                      data-ocid={`classroom.schedule.item.${displayIdx + 1}`}
                    >
                      {editSchedIdx === realIdx ? (
                        <TableCell colSpan={canEdit ? 6 : 5}>
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={editSchedForm.day}
                              onChange={(e) =>
                                setEditSchedForm((f) => ({
                                  ...f,
                                  day: e.target.value,
                                }))
                              }
                              placeholder="Day"
                              className="w-24"
                            />
                            <Input
                              value={editSchedForm.time}
                              onChange={(e) =>
                                setEditSchedForm((f) => ({
                                  ...f,
                                  time: e.target.value,
                                }))
                              }
                              placeholder="Time"
                              className="w-36"
                            />
                            <Input
                              value={editSchedForm.subject}
                              onChange={(e) =>
                                setEditSchedForm((f) => ({
                                  ...f,
                                  subject: e.target.value,
                                }))
                              }
                              placeholder="Topic"
                              className="w-36"
                            />
                            <Input
                              value={editSchedForm.venue}
                              onChange={(e) =>
                                setEditSchedForm((f) => ({
                                  ...f,
                                  venue: e.target.value,
                                }))
                              }
                              placeholder="Location"
                              className="w-36"
                            />
                            <Button
                              size="sm"
                              onClick={saveEditSched}
                              data-ocid="classroom.schedule.save_button"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditSchedIdx(null)}
                              data-ocid="classroom.schedule.cancel_button"
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="font-medium">{s.day}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {s.time}
                          </TableCell>
                          <TableCell>{s.subject}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {s.venue}
                          </TableCell>
                          <TableCell>
                            <a
                              href={buildGCalUrl(s.subject, s.venue, doc.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                              data-ocid={`classroom.schedule.calendar.${displayIdx + 1}`}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Add</span>
                            </a>
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="p-1 hover:text-primary"
                                  onClick={() => {
                                    setEditSchedIdx(realIdx);
                                    setEditSchedForm(s);
                                  }}
                                  data-ocid={`classroom.schedule.edit_button.${displayIdx + 1}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1 hover:text-destructive"
                                  onClick={() => deleteSched(realIdx)}
                                  data-ocid={`classroom.schedule.delete_button.${displayIdx + 1}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          )}
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Add schedule dialog */}
          <Dialog open={addSchedule} onOpenChange={setAddSchedule}>
            <DialogContent
              className="max-w-sm"
              data-ocid="classroom.schedule.dialog"
            >
              <DialogHeader>
                <DialogTitle>Add Schedule Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Day</Label>
                  <Select
                    value={schedForm.day}
                    onValueChange={(v) =>
                      setSchedForm((f) => ({ ...f, day: v }))
                    }
                  >
                    <SelectTrigger data-ocid="classroom.schedule.select">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_ORDER.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input
                    value={schedForm.time}
                    onChange={(e) =>
                      setSchedForm((f) => ({ ...f, time: e.target.value }))
                    }
                    placeholder="e.g., 8:00 AM – 10:00 AM"
                    data-ocid="classroom.schedule.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Topic</Label>
                  <Input
                    value={schedForm.subject}
                    onChange={(e) =>
                      setSchedForm((f) => ({ ...f, subject: e.target.value }))
                    }
                    placeholder="Subject name"
                    data-ocid="classroom.schedule.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input
                    value={schedForm.venue}
                    onChange={(e) =>
                      setSchedForm((f) => ({ ...f, venue: e.target.value }))
                    }
                    placeholder="Lecture Hall / Ward"
                    data-ocid="classroom.schedule.input"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveSched}
                    className="flex-1"
                    data-ocid="classroom.schedule.submit_button"
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAddSchedule(false)}
                    className="flex-1"
                    data-ocid="classroom.schedule.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
        {/* ── Gallery Tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="gallery" className="space-y-3">
          {galleryImages.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-8"
              data-ocid="classroom.gallery.empty_state"
            >
              {canEdit
                ? "No gallery images yet. Add some in Settings → Classroom → Gallery."
                : "No gallery images yet."}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground text-right">
                {galleryImages.length} image
                {galleryImages.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryImages.map((img, idx) => (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openLightbox(idx)}
                    data-ocid={`classroom.gallery.item.${idx + 1}`}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.caption || `Gallery image ${idx + 1}`}
                      className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-90 transition-opacity" />
                    </div>
                    {/* Caption bar */}
                    <div className="bg-background/90 backdrop-blur-sm px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-foreground/80 truncate">
                          {img.caption || ""}
                        </p>
                        {img.category && (
                          <span
                            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                              img.category === "Medical"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : img.category === "Educational"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : img.category === "Event"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {img.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Lightbox */}
              <AnimatePresence>
                {lightboxOpen && galleryImages[lightboxIdx] && (
                  <motion.div
                    key="lightbox"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightboxOpen(false)}
                    data-ocid="classroom.gallery.dialog"
                  >
                    {/* Close button */}
                    <button
                      type="button"
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      onClick={() => setLightboxOpen(false)}
                      aria-label="Close lightbox"
                      data-ocid="classroom.gallery.close_button"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {/* Prev */}
                    {galleryImages.length > 1 && (
                      <button
                        type="button"
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImg();
                        }}
                        aria-label="Previous image"
                        data-ocid="classroom.gallery.pagination_prev"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                    )}

                    {/* Image */}
                    <motion.div
                      key={lightboxIdx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={galleryImages[lightboxIdx].dataUrl}
                        alt={
                          galleryImages[lightboxIdx].caption ||
                          `Gallery image ${lightboxIdx + 1}`
                        }
                        className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl"
                      />
                      {(galleryImages[lightboxIdx].caption ||
                        galleryImages[lightboxIdx].category) && (
                        <div className="flex items-center gap-2 bg-black/50 rounded-lg px-4 py-2">
                          {galleryImages[lightboxIdx].caption && (
                            <p className="text-white text-sm">
                              {galleryImages[lightboxIdx].caption}
                            </p>
                          )}
                          {galleryImages[lightboxIdx].category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
                              {galleryImages[lightboxIdx].category}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-white/50 text-xs">
                        {lightboxIdx + 1} / {galleryImages.length}
                      </p>
                    </motion.div>

                    {/* Next */}
                    {galleryImages.length > 1 && (
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImg();
                        }}
                        aria-label="Next image"
                        data-ocid="classroom.gallery.pagination_next"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── CV Content ────────────────────────────────────────────────────────────────

function CVContent({
  doctorKey,
  isAdmin,
  updateField,
}: {
  doctorKey: DoctorKey;
  isAdmin: boolean;
  updateField: (key: DoctorKey, path: string, value: any) => void;
}) {
  const { getContent } = useDoctorContent();
  const doc = getContent(doctorKey);
  const cv = doc.cv;
  const color = doctorKey === "arman" ? "text-primary" : "text-rose-600";
  const bg = doctorKey === "arman" ? "bg-primary" : "bg-rose-600";

  const [showPdfEdit, setShowPdfEdit] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(doc.cvPdfUrl || "");
  const [showCvEdit, setShowCvEdit] = useState(false);
  const [cvEditForm, setCvEditForm] = useState<{
    qualifications: any[];
    experience: any[];
    publications: string[];
    awards: string[];
    memberships: string[];
  }>({
    qualifications: cv.qualifications || [],
    experience: cv.experience || [],
    publications: cv.publications || [],
    awards: cv.awards || [],
    memberships: cv.memberships || [],
  });

  const savePdfUrl = () => {
    updateField(doctorKey, "cvPdfUrl", pdfUrl || null);
    setShowPdfEdit(false);
    toast.success("CV PDF URL updated");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden gap-2">
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => setShowPdfEdit(true)}
            data-ocid="cv.pdf.open_modal_button"
          >
            <Edit className="w-3.5 h-3.5" />
            Update CV PDF
          </Button>
        )}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => {
              setCvEditForm({
                qualifications: cv.qualifications || [],
                experience: cv.experience || [],
                publications: cv.publications || [],
                awards: cv.awards || [],
                memberships: cv.memberships || [],
              });
              setShowCvEdit(true);
            }}
            data-ocid="cv.edit.open_modal_button"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit CV Content
          </Button>
        )}
        {doc.cvPdfUrl ? (
          <a href={doc.cvPdfUrl} download>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download CV as PDF
            </Button>
          </a>
        ) : (
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download CV as PDF
          </Button>
        )}
      </div>

      {/* PDF URL Edit Dialog */}
      <Dialog open={showPdfEdit} onOpenChange={setShowPdfEdit}>
        <DialogContent className="max-w-sm" data-ocid="cv.pdf.dialog">
          <DialogHeader>
            <DialogTitle>Update CV PDF URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>PDF URL or Path</Label>
              <Input
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="/assets/uploads/cv.pdf or https://..."
                data-ocid="cv.pdf.input"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use browser print as fallback.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={savePdfUrl}
                className="flex-1"
                data-ocid="cv.pdf.save_button"
              >
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPdfEdit(false)}
                className="flex-1"
                data-ocid="cv.pdf.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CV Content Edit Dialog */}
      <Dialog open={showCvEdit} onOpenChange={setShowCvEdit}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto"
          data-ocid="cv.edit.dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit CV Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Qualifications */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">
                  Academic Qualifications
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCvEditForm((f) => ({
                      ...f,
                      qualifications: [
                        ...f.qualifications,
                        { degree: "", institution: "", year: "" },
                      ],
                    }))
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {cvEditForm.qualifications.map((q, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: edit form uses index as key
                <div key={`item-${i}`} className="flex gap-2 mb-2 items-center">
                  <Input
                    placeholder="Degree"
                    value={q.degree}
                    onChange={(e) => {
                      const arr = [...cvEditForm.qualifications];
                      arr[i] = { ...arr[i], degree: e.target.value };
                      setCvEditForm((f) => ({ ...f, qualifications: arr }));
                    }}
                  />
                  <Input
                    placeholder="Institution"
                    value={q.institution}
                    onChange={(e) => {
                      const arr = [...cvEditForm.qualifications];
                      arr[i] = { ...arr[i], institution: e.target.value };
                      setCvEditForm((f) => ({ ...f, qualifications: arr }));
                    }}
                  />
                  <Input
                    placeholder="Year"
                    value={q.year}
                    className="w-24"
                    onChange={(e) => {
                      const arr = [...cvEditForm.qualifications];
                      arr[i] = { ...arr[i], year: e.target.value };
                      setCvEditForm((f) => ({ ...f, qualifications: arr }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCvEditForm((f) => ({
                        ...f,
                        qualifications: f.qualifications.filter(
                          (_, j) => j !== i,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Experience */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">
                  Professional Experience
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCvEditForm((f) => ({
                      ...f,
                      experience: [
                        ...f.experience,
                        { title: "", institution: "", period: "" },
                      ],
                    }))
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {cvEditForm.experience.map((exp, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: edit form uses index as key
                <div key={`item-${i}`} className="flex gap-2 mb-2 items-center">
                  <Input
                    placeholder="Role/Title"
                    value={exp.title}
                    onChange={(e) => {
                      const arr = [...cvEditForm.experience];
                      arr[i] = { ...arr[i], title: e.target.value };
                      setCvEditForm((f) => ({ ...f, experience: arr }));
                    }}
                  />
                  <Input
                    placeholder="Hospital/Institution"
                    value={exp.institution}
                    onChange={(e) => {
                      const arr = [...cvEditForm.experience];
                      arr[i] = { ...arr[i], institution: e.target.value };
                      setCvEditForm((f) => ({ ...f, experience: arr }));
                    }}
                  />
                  <Input
                    placeholder="Period"
                    value={exp.period}
                    className="w-28"
                    onChange={(e) => {
                      const arr = [...cvEditForm.experience];
                      arr[i] = { ...arr[i], period: e.target.value };
                      setCvEditForm((f) => ({ ...f, experience: arr }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCvEditForm((f) => ({
                        ...f,
                        experience: f.experience.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Publications */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Publications</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCvEditForm((f) => ({
                      ...f,
                      publications: [...f.publications, ""],
                    }))
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {cvEditForm.publications.map((pub, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: edit form uses index as key
                <div key={`item-${i}`} className="flex gap-2 mb-2 items-center">
                  <Input
                    value={pub}
                    onChange={(e) => {
                      const arr = [...cvEditForm.publications];
                      arr[i] = e.target.value;
                      setCvEditForm((f) => ({ ...f, publications: arr }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCvEditForm((f) => ({
                        ...f,
                        publications: f.publications.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Awards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">
                  Awards &amp; Distinctions
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCvEditForm((f) => ({ ...f, awards: [...f.awards, ""] }))
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {cvEditForm.awards.map((award, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: edit form uses index as key
                <div key={`item-${i}`} className="flex gap-2 mb-2 items-center">
                  <Input
                    value={award}
                    onChange={(e) => {
                      const arr = [...cvEditForm.awards];
                      arr[i] = e.target.value;
                      setCvEditForm((f) => ({ ...f, awards: arr }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCvEditForm((f) => ({
                        ...f,
                        awards: f.awards.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Memberships */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Memberships</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCvEditForm((f) => ({
                      ...f,
                      memberships: [...f.memberships, ""],
                    }))
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {cvEditForm.memberships.map((m, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: edit form uses index as key
                <div key={`item-${i}`} className="flex gap-2 mb-2 items-center">
                  <Input
                    value={m}
                    onChange={(e) => {
                      const arr = [...cvEditForm.memberships];
                      arr[i] = e.target.value;
                      setCvEditForm((f) => ({ ...f, memberships: arr }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCvEditForm((f) => ({
                        ...f,
                        memberships: f.memberships.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => {
                  updateField(
                    doctorKey,
                    "cv.qualifications",
                    cvEditForm.qualifications,
                  );
                  updateField(
                    doctorKey,
                    "cv.experience",
                    cvEditForm.experience,
                  );
                  updateField(
                    doctorKey,
                    "cv.publications",
                    cvEditForm.publications,
                  );
                  updateField(doctorKey, "cv.awards", cvEditForm.awards);
                  updateField(
                    doctorKey,
                    "cv.memberships",
                    cvEditForm.memberships,
                  );
                  setShowCvEdit(false);
                  toast.success("CV updated");
                }}
                data-ocid="cv.edit.confirm_button"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCvEdit(false)}
                data-ocid="cv.edit.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CV Header */}
      <div className="text-center py-6 border-b print:border-b print:pb-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-bold text-primary">
            {doc.name
              .split(" ")
              .slice(1, 3)
              .map((w: string) => w[0])
              .join("")}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-foreground">{doc.name}</h2>
        <p className={`font-medium mt-1 ${color}`}>{doc.degree}</p>
        {((doc.posts as string[]) || []).map((post) => (
          <p key={post} className="text-sm text-muted-foreground mt-0.5">
            {post}
          </p>
        ))}
        <p className="text-muted-foreground text-sm mt-0.5">
          {doc.specialization}
        </p>
        <p className="text-muted-foreground text-sm">{doc.hospital}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {doc.phone}
          </span>
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {doc.email}
          </span>
        </div>
      </div>

      {/* Qualifications */}
      <div>
        <h3
          className={`font-bold text-base uppercase tracking-wide mb-3 flex items-center gap-2 ${color}`}
        >
          <BookOpen className="w-4 h-4" /> Academic Qualifications
        </h3>
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Degree</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Year</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cv.qualifications.map((q: any) => (
                <TableRow key={q.degree}>
                  <TableCell className="font-semibold">{q.degree}</TableCell>
                  <TableCell>{q.institution}</TableCell>
                  <TableCell>{q.year}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Experience */}
      <div>
        <h3
          className={`font-bold text-base uppercase tracking-wide mb-3 flex items-center gap-2 ${color}`}
        >
          <BriefcaseMedical className="w-4 h-4" /> Professional Experience
        </h3>
        <div className="space-y-3">
          {cv.experience.map((exp: any) => (
            <div key={exp.title} className="flex gap-4">
              <div className={`w-2 h-2 rounded-full ${bg} mt-2 shrink-0`} />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {exp.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {exp.institution}
                </p>
                <p className="text-xs text-muted-foreground">{exp.period}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Publications */}
      <div>
        <h3
          className={`font-bold text-base uppercase tracking-wide mb-3 flex items-center gap-2 ${color}`}
        >
          <BookOpen className="w-4 h-4" /> Publications
        </h3>
        <ul className="space-y-2">
          {cv.publications.map((pub: string) => (
            <li key={pub} className="flex gap-3 text-sm">
              <span className={`mt-1 shrink-0 ${color}`}>•</span>
              <span className="text-foreground">{pub}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Awards */}
      <div>
        <h3
          className={`font-bold text-base uppercase tracking-wide mb-3 flex items-center gap-2 ${color}`}
        >
          <Trophy className="w-4 h-4" /> Awards &amp; Distinctions
        </h3>
        <ul className="space-y-2">
          {cv.awards.map((award: string) => (
            <li key={award} className="flex items-center gap-3 text-sm">
              <Award className={`w-4 h-4 shrink-0 ${color}`} />
              <span className="text-foreground">{award}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Memberships */}
      <div>
        <h3
          className={`font-bold text-base uppercase tracking-wide mb-3 flex items-center gap-2 ${color}`}
        >
          <Users className="w-4 h-4" /> Memberships
        </h3>
        <ul className="space-y-2">
          {cv.memberships.map((m: string) => (
            <li key={m} className="flex items-center gap-3 text-sm">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${color}`} />
              <span className="text-foreground">{m}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Profile Edit Dialog ──────────────────────────────────────────────────────

function ProfileEditDialog({
  doctorKey,
  open,
  onClose,
  updateField,
}: {
  doctorKey: DoctorKey;
  open: boolean;
  onClose: () => void;
  updateField: (key: DoctorKey, path: string, value: any) => void;
}) {
  const { getContent } = useDoctorContent();
  const doc = getContent(doctorKey);

  const [form, setForm] = useState({
    name: doc.name,
    degree: doc.degree,
    posts: (doc.posts as string[]) || [],
    specialization: doc.specialization,
    hospital: doc.hospital,
    phone: doc.phone,
    email: doc.email,
  });

  const handleSave = () => {
    for (const [key, value] of Object.entries(form)) {
      if (key === "posts") {
        updateField(
          doctorKey,
          key,
          (value as string[]).filter((p) => p.trim()),
        );
      } else {
        updateField(doctorKey, key, value);
      }
    }
    toast.success("Profile updated successfully");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-ocid="profile.edit.dialog">
        <DialogHeader>
          <DialogTitle>Edit Profile — {doc.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              data-ocid="profile.edit.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Degree(s)</Label>
            <Input
              value={form.degree}
              onChange={(e) =>
                setForm((f) => ({ ...f, degree: e.target.value }))
              }
              placeholder="MBBS, FCPS..."
              data-ocid="profile.edit.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Posts</Label>
            <div className="space-y-2">
              {form.posts.map((post, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: posts are ordered
                <div key={`post-edit-${i}`} className="flex gap-2 items-center">
                  <Input
                    value={post}
                    onChange={(e) =>
                      setForm((f) => {
                        const updated = [...f.posts];
                        updated[i] = e.target.value;
                        return { ...f, posts: updated };
                      })
                    }
                    placeholder="e.g. Registrar, Dept. of Surgery"
                    data-ocid="profile.edit.input"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        posts: f.posts.filter((_, j) => j !== i),
                      }))
                    }
                    data-ocid="profile.edit.delete_button"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, posts: [...f.posts, ""] }))
                }
                data-ocid="profile.edit.button"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Post
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Specialization</Label>
            <Input
              value={form.specialization}
              onChange={(e) =>
                setForm((f) => ({ ...f, specialization: e.target.value }))
              }
              data-ocid="profile.edit.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hospital / Department</Label>
            <Input
              value={form.hospital}
              onChange={(e) =>
                setForm((f) => ({ ...f, hospital: e.target.value }))
              }
              data-ocid="profile.edit.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              data-ocid="profile.edit.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              data-ocid="profile.edit.input"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              className="flex-1"
              data-ocid="profile.edit.save_button"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-ocid="profile.edit.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin: Treatment Reference PDF (for DIMS auto-fill) ────────────────────

function TreatmentReferencePDFAdmin() {
  const LS_KEY = "treatmentReferencePDF";
  const [stored, setStored] = useState<string | null>(() =>
    localStorage.getItem(LS_KEY),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    localStorage.setItem(LS_KEY, file.name);
    setStored(file.name);
    toast.success(`Treatment reference PDF "${file.name}" uploaded`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = () => {
    localStorage.removeItem(LS_KEY);
    setStored(null);
    toast.success("Treatment reference PDF removed");
  };

  return (
    <Card className="border-teal-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-teal-800 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Treatment Reference PDF (for DIMS Auto-fill)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-teal-700">
          Upload a clinical treatment reference PDF. When DIMS auto-generates a
          prescription from a diagnosis, it will reference this PDF in
          collaboration with DIMS guidelines.
        </p>
        {stored ? (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
            <FileText className="w-5 h-5 text-teal-600 shrink-0" />
            <span className="text-sm text-teal-800 flex-1 truncate">
              {stored}
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              data-ocid="admin.treatment_pdf.delete_button"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="text-sm text-slate-500 italic">
            No treatment reference PDF uploaded yet.
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            data-ocid="admin.treatment_pdf.upload_button"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            {stored ? "Replace PDF" : "Upload PDF"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
        {stored && (
          <div className="text-xs bg-teal-50 border border-teal-200 rounded p-2 text-teal-700">
            <span className="font-medium">Active reference:</span> {stored} —
            DIMS auto-generation will use this PDF as a treatment guideline
            reference.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Admin: Differential Diagnosis Reference PDF ─────────────────────────────

function DifferentialDiagnosisPDFAdmin() {
  const LS_KEY = "ddReferencePDF";
  const [stored, setStored] = useState<string | null>(() =>
    localStorage.getItem(LS_KEY),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    localStorage.setItem(LS_KEY, file.name);
    setStored(file.name);
    toast.success(`DD reference PDF "${file.name}" uploaded`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = () => {
    localStorage.removeItem(LS_KEY);
    setStored(null);
    toast.success("DD reference PDF removed");
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-purple-800 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Differential Diagnosis Reference PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-purple-700">
          Upload a clinical reference PDF for generating differential diagnoses.
          The AI will use this as a reference when suggesting differentials in
          the visit form.
        </p>
        {stored ? (
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <FileText className="w-5 h-5 text-purple-600 shrink-0" />
            <span className="text-sm text-purple-800 flex-1 truncate">
              {stored}
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              data-ocid="admin.dd_pdf.delete_button"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="text-sm text-slate-500 italic">
            No DD reference PDF uploaded yet.
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            data-ocid="admin.dd_pdf.upload_button"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            {stored ? "Replace PDF" : "Upload PDF"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Admin: Interpretation Reference PDF ─────────────────────────────────────

function StaffApprovalsAdmin() {
  const [accounts, setAccounts] = useState<any[]>([]);

  const refresh = useCallback(() => {
    try {
      const registry = JSON.parse(
        localStorage.getItem("medicare_doctors_registry") || "[]",
      );
      setAccounts(registry.filter((d: any) => d.status === "pending"));
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approve = (id: string) => {
    try {
      const registry = JSON.parse(
        localStorage.getItem("medicare_doctors_registry") || "[]",
      );
      const idx = registry.findIndex((d: any) => d.id === id);
      if (idx >= 0) {
        registry[idx] = { ...registry[idx], status: "approved" };
        localStorage.setItem(
          "medicare_doctors_registry",
          JSON.stringify(registry),
        );
        toast.success("Account approved");
        refresh();
      }
    } catch {}
  };

  const reject = (id: string) => {
    try {
      const registry = JSON.parse(
        localStorage.getItem("medicare_doctors_registry") || "[]",
      );
      const idx = registry.findIndex((d: any) => d.id === id);
      if (idx >= 0) {
        registry[idx] = { ...registry[idx], status: "rejected" };
        localStorage.setItem(
          "medicare_doctors_registry",
          JSON.stringify(registry),
        );
        toast.success("Account rejected");
        refresh();
      }
    } catch {}
  };

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-5">
      <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        Pending Staff Approvals ({accounts.length})
      </h3>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc: any) => (
            <div
              key={acc.id}
              className="flex items-center justify-between gap-3 border border-border rounded-lg p-3"
            >
              <div>
                <p className="font-medium text-sm">{acc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {acc.email} · {acc.role}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1 h-7 text-xs"
                  onClick={() => approve(acc.id)}
                  data-ocid="admin.approve.button"
                >
                  <CheckCircle2 className="w-3 h-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-300 hover:bg-red-50 gap-1 h-7 text-xs"
                  onClick={() => reject(acc.id)}
                  data-ocid="admin.reject.button"
                >
                  <X className="w-3 h-3" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterpretationRefPDFAdmin() {
  const LS_KEY = "interpretationReferencePDF";
  const [stored, setStored] = useState<string | null>(() =>
    localStorage.getItem(LS_KEY),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Store file name as reference (real apps would upload to blob storage)
    const ref = file.name;
    localStorage.setItem(LS_KEY, ref);
    setStored(ref);
    toast.success("Investigation interpretation reference PDF saved.");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = () => {
    localStorage.removeItem(LS_KEY);
    setStored(null);
    toast.success("Reference PDF removed.");
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Investigation Interpretation Reference PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-amber-700">
          Upload a PDF containing interpretation guidelines for investigation
          results. Only admins can add or delete this reference.
        </p>
        {stored ? (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <FileText className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 flex-1 truncate">
              {stored}
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              data-ocid="admin.interpretation_pdf.delete_button"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="text-sm text-slate-500 italic">
            No reference PDF uploaded yet.
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            data-ocid="admin.interpretation_pdf.upload_button"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            {stored ? "Replace PDF" : "Upload PDF"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── YouTube thumbnail helper ─────────────────────────────────────────────────

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
}

// ─── Video Thumbnail Card ─────────────────────────────────────────────────────

function VideoThumbnailCard({
  vid,
  idx,
  displayIdx,
  isAdmin,
  editVideoIdx,
  editVideoForm,
  setEditVideoIdx,
  setEditVideoForm,
  onSaveEdit,
  onDelete,
  onToggleFeatured,
}: {
  vid: {
    title: string;
    url: string;
    description?: string;
    isFeatured?: boolean;
  };
  idx: number;
  displayIdx: number;
  isAdmin: boolean;
  editVideoIdx: number | null;
  editVideoForm: {
    title: string;
    url: string;
    description: string;
    isFeatured: boolean;
  };
  setEditVideoIdx: (i: number | null) => void;
  setEditVideoForm: (f: {
    title: string;
    url: string;
    description: string;
    isFeatured: boolean;
  }) => void;
  onSaveEdit: () => void;
  onDelete: (i: number) => void;
  onToggleFeatured?: (i: number) => void;
}) {
  const ytId = getYouTubeId(vid.url);
  return (
    <Card
      className={`border hover:shadow-md transition-all overflow-hidden ${vid.isFeatured ? "border-amber-400 ring-1 ring-amber-300/50" : "border-border"}`}
      data-ocid={`classroom.videos.item.${displayIdx + 1}`}
    >
      {editVideoIdx === idx ? (
        <CardContent className="p-4 space-y-1.5">
          <Input
            value={editVideoForm.title}
            onChange={(e) =>
              setEditVideoForm({ ...editVideoForm, title: e.target.value })
            }
            placeholder="Title"
            className="h-7 text-xs"
          />
          <Input
            value={editVideoForm.url}
            onChange={(e) =>
              setEditVideoForm({ ...editVideoForm, url: e.target.value })
            }
            placeholder="YouTube URL"
            className="h-7 text-xs"
          />
          <Textarea
            value={editVideoForm.description}
            onChange={(e) =>
              setEditVideoForm({
                ...editVideoForm,
                description: e.target.value,
              })
            }
            placeholder="Description (2-3 lines)..."
            rows={2}
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`vid-feat-${idx}`}
              checked={editVideoForm.isFeatured}
              onChange={(e) =>
                setEditVideoForm({
                  ...editVideoForm,
                  isFeatured: e.target.checked,
                })
              }
              className="accent-amber-500"
            />
            <label
              htmlFor={`vid-feat-${idx}`}
              className="text-xs cursor-pointer"
            >
              Featured
            </label>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-6 text-xs"
              onClick={onSaveEdit}
              data-ocid="classroom.videos.save_button"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => setEditVideoIdx(null)}
              data-ocid="classroom.videos.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      ) : (
        <>
          <a
            href={vid.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative aspect-video bg-muted overflow-hidden group"
          >
            {ytId ? (
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt={vid.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Youtube className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 fill-red-600 ml-0.5"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {vid.isFeatured && (
              <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                ⭐ Featured
              </div>
            )}
          </a>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">
                  {vid.title}
                </p>
                {vid.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                    {vid.description}
                  </p>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  {onToggleFeatured && (
                    <button
                      type="button"
                      title={vid.isFeatured ? "Unfeature" : "Feature"}
                      className={`p-0.5 transition-colors ${vid.isFeatured ? "text-amber-500" : "hover:text-amber-500"}`}
                      onClick={() => onToggleFeatured(idx)}
                      data-ocid={`classroom.videos.toggle.${displayIdx + 1}`}
                    >
                      <span className="text-sm">
                        {vid.isFeatured ? "⭐" : "☆"}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-0.5 hover:text-primary"
                    onClick={() => {
                      setEditVideoIdx(idx);
                      setEditVideoForm({
                        title: vid.title,
                        url: vid.url,
                        description: vid.description || "",
                        isFeatured: vid.isFeatured || false,
                      });
                    }}
                    data-ocid={`classroom.videos.edit_button.${displayIdx + 1}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-0.5 hover:text-destructive"
                    onClick={() => onDelete(idx)}
                    data-ocid={`classroom.videos.delete_button.${displayIdx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function LandingPage({
  onLoginClick,
  onAdminLoginClick,
  isAdmin,
  adminLogout,
}: LandingPageProps) {
  const { getContent, updateField, updateChambers } = useDoctorContent();
  const {
    config: siteConfig,
    updateHero,
    updateAbout,
    updateFooter,
    updateEmergencyContacts,
    resetSection,
  } = useSiteConfig();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [editProfileKey, setEditProfileKey] = useState<DoctorKey | null>(null);
  type ChamberForm = {
    id: string;
    nameBn: string;
    addressBn: string;
    address: string;
    visitingHours: string;
    phone: string;
    emergencyPhone: string;
    lat: string;
    lng: string;
  };
  const [editChamberKey, setEditChamberKey] = useState<DoctorKey | null>(null);
  const [editChamberIdx, setEditChamberIdx] = useState<number>(-1);
  const [chamberEditForm, setChamberEditForm] = useState<ChamberForm>({
    id: "",
    nameBn: "",
    addressBn: "",
    address: "",
    visitingHours: "",
    phone: "",
    emergencyPhone: "",
    lat: "",
    lng: "",
  });
  // Near-me geolocation state
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [nearestChamberId, setNearestChamberId] = useState<string | null>(null);
  const chamberRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Booking state ─────────────────────────────────────────────────────
  type BookingType = "chamber" | "admitted";
  const [activeBookingTab, setActiveBookingTab] =
    useState<BookingType>("chamber");

  interface FoundPatientInfo {
    patientName: string;
    phone: string;
    age?: string;
    gender?: string;
    registerNumber?: string;
  }

  // Chamber booking form
  const emptyChamberForm = {
    patientName: "",
    phone: "",
    doctor: "",
    date: "",
    time: "",
    reason: "",
    chamber: "",
    registerNumber: "",
  };
  const [chamberForm, setChamberForm] = useState(emptyChamberForm);
  const [chamberLookup, setChamberLookup] = useState("");
  const [chamberFoundPatient, setChamberFoundPatient] =
    useState<FoundPatientInfo | null>(null);
  const [chamberLookupMsg, setChamberLookupMsg] = useState("");
  const [chamberSubmitted, setChamberSubmitted] = useState(false);

  // Admitted booking form
  const emptyAdmitForm = {
    patientName: "",
    phone: "",
    doctor: "",
    admissionDate: "",
    hospitalName: "",
    bedWardNumber: "",
    admissionReason: "",
    referringDoctor: "",
    registerNumber: "",
  };
  const [admitForm, setAdmitForm] = useState(emptyAdmitForm);
  const [admitLookup, setAdmitLookup] = useState("");
  const [admitFoundPatient, setAdmitFoundPatient] =
    useState<FoundPatientInfo | null>(null);
  const [admitLookupMsg, setAdmitLookupMsg] = useState("");
  const [admitSubmitted, setAdmitSubmitted] = useState(false);

  const [bookingCount, setBookingCount] = useState(0);

  // Generic patient lookup from localStorage
  function lookupPatientRecord(query: string): FoundPatientInfo | null {
    if (!query.trim()) return null;
    const norm = (rn: string) => {
      const parts = rn.trim().split("/");
      if (parts.length === 2) {
        const n = Number.parseInt(parts[0].trim(), 10);
        return `${Number.isNaN(n) ? parts[0].trim() : n}/${parts[1].trim()}`;
      }
      return rn.trim().toLowerCase();
    };
    const isPhone =
      /^[0-9+\-() ]{7,}$/.test(query.trim()) && !query.includes("/");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("patients_")) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(key) || "[]") as any[];
        let found: any;
        if (isPhone) {
          found = arr.find((p) =>
            p.phone?.replace(/\D/g, "").includes(query.replace(/\D/g, "")),
          );
        } else {
          found = arr.find(
            (p) =>
              p.registerNumber &&
              norm(String(p.registerNumber)) === norm(query),
          );
        }
        if (found) {
          const dob = found.dateOfBirth;
          let ageStr = "";
          if (dob) {
            try {
              const birthYear = new Date(
                Number(dob) > 1e12 ? Number(dob) / 1e6 : Number(dob),
              ).getFullYear();
              ageStr = `${new Date().getFullYear() - birthYear} yrs`;
            } catch {}
          }
          return {
            patientName: found.fullName || "",
            phone: found.phone || "",
            age: found.age ? String(found.age) : ageStr,
            gender: found.gender || "",
            registerNumber: found.registerNumber || "",
          };
        }
      } catch {}
    }
    return null;
  }

  const handleChamberLookup = (query: string) => {
    setChamberLookup(query);
    setChamberForm((f) => ({ ...f, registerNumber: query }));
    if (!query.trim()) {
      setChamberFoundPatient(null);
      setChamberLookupMsg("");
      return;
    }
    const found = lookupPatientRecord(query);
    if (found) {
      setChamberFoundPatient(found);
      setChamberForm((f) => ({
        ...f,
        patientName: found.patientName,
        phone: found.phone,
        registerNumber: query,
      }));
      setChamberLookupMsg(`✓ Found: ${found.patientName}`);
    } else {
      setChamberFoundPatient(null);
      setChamberLookupMsg(
        "Patient not found. Please contact the clinic to get registered first.",
      );
    }
  };

  const handleAdmitLookup = (query: string) => {
    setAdmitLookup(query);
    setAdmitForm((f) => ({ ...f, registerNumber: query }));
    if (!query.trim()) {
      setAdmitFoundPatient(null);
      setAdmitLookupMsg("");
      return;
    }
    const found = lookupPatientRecord(query);
    if (found) {
      setAdmitFoundPatient(found);
      setAdmitForm((f) => ({
        ...f,
        patientName: found.patientName,
        phone: found.phone,
        registerNumber: query,
      }));
      setAdmitLookupMsg(`✓ Found: ${found.patientName}`);
    } else {
      setAdmitFoundPatient(null);
      setAdmitLookupMsg(
        "Patient not found. Please contact the clinic to get registered first.",
      );
    }
  };

  function getOrAssignSerial(name: string, date: string): number {
    try {
      const existing = JSON.parse(
        localStorage.getItem("clinic_appointments") || "[]",
      ) as any[];
      const match = existing.find(
        (a: any) =>
          a.serialDate === date &&
          a.patientName?.trim().toLowerCase() === name.trim().toLowerCase() &&
          a.serialNumber,
      );
      if (match) return match.serialNumber;
      const daySerials = existing
        .filter((a: any) => a.serialDate === date && a.serialNumber)
        .map((a: any) => a.serialNumber as number);
      // Also check public bookings
      const pub = JSON.parse(
        localStorage.getItem("public_appointment_requests") || "[]",
      ) as any[];
      const pubDay = pub
        .filter(
          (a: any) => (a.preferredDate || a.date) === date && a.serialNumber,
        )
        .map((a: any) => a.serialNumber as number);
      const allSerials = [...daySerials, ...pubDay];
      return allSerials.length > 0 ? Math.max(...allSerials) + 1 : 1;
    } catch {
      return 1;
    }
  }

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bookingDate = chamberForm.date;
    const serial = chamberFoundPatient
      ? getOrAssignSerial(chamberForm.patientName, bookingDate)
      : undefined;
    if (
      !chamberForm.patientName ||
      !chamberForm.phone ||
      !chamberForm.doctor ||
      !chamberForm.date
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const newBooking = {
      id: Math.random().toString(36).slice(2, 10),
      patientName: chamberForm.patientName,
      phone: chamberForm.phone,
      doctor: chamberForm.doctor,
      preferredDate: chamberForm.date,
      preferredTime: chamberForm.time,
      reason: chamberForm.reason,
      preferredChamber: chamberForm.chamber,
      registerNumber: chamberForm.registerNumber,
      submittedAt: new Date().toISOString(),
      status: "pending" as const,
      appointmentType: "chamber",
      serialNumber: serial,
      serialDate: bookingDate,
    };
    const existing = loadPublicBookings();
    savePublicBookings([...existing, newBooking]);
    setBookingCount(existing.length + 1);
    setChamberSubmitted(true);
    toast.success("Chamber appointment request submitted!");
  };

  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !admitForm.patientName ||
      !admitForm.phone ||
      !admitForm.admissionDate
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const serial = admitFoundPatient
      ? getOrAssignSerial(admitForm.patientName, admitForm.admissionDate)
      : undefined;
    const newBooking = {
      id: Math.random().toString(36).slice(2, 10),
      patientName: admitForm.patientName,
      phone: admitForm.phone,
      doctor: admitForm.doctor,
      preferredDate: admitForm.admissionDate,
      hospitalName: admitForm.hospitalName,
      bedWardNumber: admitForm.bedWardNumber,
      admissionReason: admitForm.admissionReason,
      referringDoctor: admitForm.referringDoctor,
      registerNumber: admitForm.registerNumber,
      submittedAt: new Date().toISOString(),
      status: "pending" as const,
      appointmentType: "admitted",
      serialNumber: serial,
      serialDate: admitForm.admissionDate,
    };
    const existing = loadPublicBookings();
    savePublicBookings([...existing, newBooking]);
    setBookingCount(existing.length + 1);
    setAdmitSubmitted(true);
    toast.success("Hospital admission request submitted!");
  };

  useEffect(() => {
    setBookingCount(loadPublicBookings().length);
  }, []);

  const navLinks = [
    { label: "Home", id: "home" },
    { label: "Classroom", id: "classroom" },
    { label: "Chamber", id: "chamber" },
    { label: "Appointments", id: "appointments" },
    { label: "CV", id: "cv" },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const armanDoc = getContent("arman");
  const samiaDoc = getContent("samia");
  const allDocs = { arman: armanDoc, samia: samiaDoc };

  return (
    <div className="min-h-screen bg-background">
      {/* Emergency Consultation Modal */}
      <EmergencyConsultationModal
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
      />

      {/* Profile Edit Dialog */}
      {editProfileKey && (
        <ProfileEditDialog
          doctorKey={editProfileKey}
          open={!!editProfileKey}
          onClose={() => setEditProfileKey(null)}
          updateField={updateField}
        />
      )}

      {/* ── Sticky Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-sm sm:text-base leading-tight">
              Dr. Arman Kabir&apos;s Care
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                type="button"
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                data-ocid={`nav.${link.label.toLowerCase()}.link`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Emergency Button (desktop) */}
            <Button
              size="sm"
              variant="destructive"
              className="hidden md:flex gap-1.5 font-semibold"
              onClick={() => setEmergencyOpen(true)}
              data-ocid="landing.emergency.button"
            >
              <AlertTriangle className="w-4 h-4" />
              Emergency
            </Button>

            {/* Admin mode indicator or login */}
            {isAdmin ? (
              <div className="hidden sm:flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-400 text-amber-700 bg-amber-50"
                >
                  <ShieldCheck className="w-3 h-3" />
                  Admin Mode
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    adminLogout();
                    toast.success("Admin logged out");
                  }}
                  className="text-xs"
                  data-ocid="landing.admin_logout.button"
                >
                  Admin Logout
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="hidden sm:flex gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={onAdminLoginClick}
                data-ocid="landing.admin_login.button"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Login
              </Button>
            )}

            <Button
              onClick={onLoginClick}
              size="sm"
              className="hidden sm:flex gap-2"
              data-ocid="landing.staff_login.button"
            >
              <Stethoscope className="w-4 h-4" />
              Staff Login
            </Button>
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-ocid="landing.menu.toggle"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border bg-background px-4 pb-3"
            >
              {navLinks.map((link) => (
                <button
                  type="button"
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors block"
                >
                  {link.label}
                </button>
              ))}
              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-2 gap-2"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setEmergencyOpen(true);
                }}
                data-ocid="landing.emergency_mobile.button"
              >
                <AlertTriangle className="w-4 h-4" />
                Emergency Consultation
              </Button>
              {isAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 gap-2 border-amber-300 text-amber-700"
                  onClick={() => {
                    adminLogout();
                    setMobileMenuOpen(false);
                    toast.success("Admin logged out");
                  }}
                  data-ocid="landing.admin_logout_mobile.button"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Logout
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 gap-2 border-amber-300 text-amber-700"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onAdminLoginClick();
                  }}
                  data-ocid="landing.admin_login_mobile.button"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Login
                </Button>
              )}
              <Button
                onClick={onLoginClick}
                size="sm"
                className="w-full mt-2 gap-2"
              >
                <Stethoscope className="w-4 h-4" />
                Staff Login
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1d4ed8 0%, #0d9488 100%)",
        }}
        data-ocid="landing.hero.section"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              // Open panel hero tab — handled by FAB
              document
                .querySelector<HTMLButtonElement>(
                  '[data-ocid="admin_panel.open_modal_button"]',
                )
                ?.click();
            }}
            className="absolute top-3 right-3 z-10 bg-amber-500/90 hover:bg-amber-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all"
            data-ocid="hero.edit_button"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit Hero
          </button>
        )}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-3 leading-tight drop-shadow-lg">
              {siteConfig.heroSection.taglineEn}
            </h1>
            <p className="text-blue-100 text-xl sm:text-2xl font-semibold mb-2">
              {siteConfig.heroSection.subheadingEn}
            </p>
            {siteConfig.heroSection.heroTaglineEn && (
              <p className="text-blue-200 text-base sm:text-lg italic font-medium mb-3">
                {siteConfig.heroSection.heroTaglineEn}
              </p>
            )}
            {siteConfig.heroSection.heroDescriptionEn ? (
              <p className="text-blue-100/90 text-sm sm:text-base max-w-2xl mx-auto mb-8">
                {siteConfig.heroSection.heroDescriptionEn}
              </p>
            ) : (
              <div className="mb-8" />
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("booking-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-bold px-8 py-3.5 rounded-xl text-lg shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all"
                data-ocid="hero.book_appointment.primary_button"
              >
                <CalendarDays className="w-5 h-5" />
                {siteConfig.heroSection.cta1Label}
              </button>
              <button
                type="button"
                onClick={() => setEmergencyOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-red-500/90 text-white font-semibold px-8 py-3.5 rounded-xl text-lg shadow-lg hover:bg-red-500 transition-all"
                data-ocid="hero.emergency.button"
              >
                <AlertTriangle className="w-5 h-5" />
                {siteConfig.heroSection.cta2Label}
              </button>
            </div>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto"
            data-ocid="hero.trust_badges.section"
          >
            {[
              {
                icon: "🏥",
                label: `${siteConfig.aboutSection.doctorCount} Expert Doctors`,
              },
              {
                icon: "👥",
                label: `${siteConfig.aboutSection.patientCount} Patients Treated`,
              },
              {
                icon: "⭐",
                label: `${siteConfig.aboutSection.yearsExperience}+ Years Experience`,
              },
              { icon: "📱", label: "English & Bangla" },
            ].map((badge) => (
              <div
                key={badge.label}
                className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-3 text-white text-center"
              >
                <div className="text-2xl mb-1">{badge.icon}</div>
                <div className="text-xs font-semibold leading-tight">
                  {badge.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Home / Hero (doctor profiles) ───────────────────────── */}
      <section id="home" className="py-16 sm:py-20 px-4 sm:px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-5">
              <Heart className="w-4 h-4" />
              Excellence in Patient Care &amp; Medical Education
            </div>
            <h2
              className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight"
              id="doctors-section"
            >
              Meet Our Consultants
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              A comprehensive patient management and medical education platform
              serving patients and students across Bangladesh.
            </p>
          </motion.div>

          {/* Doctor Profile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(["arman", "samia"] as const).map((key, idx) => {
              const doc = allDocs[key];
              const initials = doc.name
                .split(" ")
                .slice(1, 3)
                .map((w: string) => w[0])
                .join("");
              const accentColor =
                key === "arman"
                  ? "bg-primary text-primary-foreground"
                  : "bg-rose-600 text-white";
              const borderColor =
                key === "arman" ? "border-primary/20" : "border-rose-200";
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                >
                  <Card
                    className={`border-2 ${borderColor} hover:shadow-lg transition-all`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {(() => {
                          const photoKey =
                            key === "arman"
                              ? "medicare_doctor_photo_arman"
                              : "medicare_doctor_photo_samia";
                          const savedPhoto = localStorage.getItem(photoKey);
                          return savedPhoto ? (
                            <div className="w-16 h-16 rounded-2xl shrink-0 overflow-hidden border-2 border-border">
                              <img
                                src={savedPhoto}
                                alt={doc.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={`w-16 h-16 rounded-2xl ${accentColor} flex items-center justify-center text-xl font-bold shrink-0`}
                            >
                              {initials}
                            </div>
                          );
                        })()}
                        <div className="flex-1 min-w-0">
                          <h2 className="font-display text-xl font-bold text-foreground">
                            {doc.name}
                          </h2>
                          <p className="text-primary font-medium text-sm">
                            {doc.degree}
                          </p>
                          {((doc.posts as string[]) || []).map((post) => (
                            <p
                              key={post}
                              className="text-xs text-muted-foreground mt-0.5"
                            >
                              {post}
                            </p>
                          ))}
                          <p className="text-muted-foreground text-sm">
                            {doc.specialization}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4 shrink-0" />
                          <span>{doc.hospital}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4 shrink-0" />
                          <span>{doc.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4 shrink-0" />
                          <span className="truncate">{doc.email}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            document
                              .getElementById("booking-section")
                              ?.scrollIntoView({ behavior: "smooth" })
                          }
                          className={`flex-1 text-center py-2 rounded-lg text-sm font-semibold ${accentColor} transition-opacity hover:opacity-90`}
                        >
                          Book Appointment
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollTo("cv")}
                          className="flex-1 text-center py-2 rounded-lg text-sm font-semibold border border-border hover:bg-accent transition-colors"
                        >
                          View CV
                        </button>
                        {isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => setEditProfileKey(key)}
                              data-ocid={`profile.${key}.edit_button`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit Profile
                            </Button>
                            <label className="cursor-pointer">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
                                <Upload className="w-3 h-3" />
                                Photo
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const photoKey =
                                      key === "arman"
                                        ? "medicare_doctor_photo_arman"
                                        : "medicare_doctor_photo_samia";
                                    localStorage.setItem(
                                      photoKey,
                                      ev.target?.result as string,
                                    );
                                    import("sonner").then(({ toast }) =>
                                      toast.success(
                                        "Photo updated — refresh to see",
                                      ),
                                    );
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Trust Signals / About ──────────────────────────────── */}
      {siteConfig.aboutSection.visible && (
        <section
          className="py-14 px-4 sm:px-6 bg-blue-50 border-y border-blue-100 relative"
          data-ocid="landing.trust_signals.section"
        >
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                document
                  .querySelector<HTMLButtonElement>(
                    '[data-ocid="admin_panel.open_modal_button"]',
                  )
                  ?.click();
              }}
              className="absolute top-3 right-3 bg-amber-500/90 hover:bg-amber-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
              data-ocid="trust_signals.edit_button"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                {
                  value: siteConfig.aboutSection.patientCount,
                  label: "Patients Treated",
                  icon: "👥",
                },
                {
                  value: `${siteConfig.aboutSection.yearsExperience}+`,
                  label: "Years Experience",
                  icon: "⭐",
                },
                {
                  value: `${siteConfig.aboutSection.doctorCount}`,
                  label: "Expert Consultants",
                  icon: "🩺",
                },
                { value: "Bilingual", label: "English & Bangla", icon: "🌐" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl p-5 text-center shadow-sm border border-blue-100"
                >
                  <div className="text-3xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold text-blue-700">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mb-4 max-w-2xl mx-auto">
              {siteConfig.aboutSection.descriptionEn}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {siteConfig.aboutSection.affiliations.map((affil) => (
                <span
                  key={affil}
                  className="px-3 py-1.5 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700 shadow-sm"
                >
                  🏥 {affil}
                </span>
              ))}
            </div>
            {siteConfig.aboutSection.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {siteConfig.aboutSection.specialties.map((spec) => (
                  <span
                    key={spec}
                    className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium text-primary"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Classroom ──────────────────────────────────────────────── */}
      <section
        id="classroom"
        className="py-16 bg-muted/30 px-4 sm:px-6"
        data-ocid="landing.classroom.section"
      >
        <div className="max-w-6xl mx-auto" id="classrooms-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Classroom
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Lecture notes, schedules, videos, and announcements for students.
            </p>
          </motion.div>

          <Tabs defaultValue="arman" className="space-y-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger
                value="arman"
                className="gap-2"
                data-ocid="classroom.arman.tab"
              >
                Dr. Arman&apos;s Classroom
              </TabsTrigger>
              <TabsTrigger
                value="samia"
                className="gap-2"
                data-ocid="classroom.samia.tab"
              >
                Dr. Samia&apos;s Classroom
              </TabsTrigger>
            </TabsList>
            <TabsContent value="arman">
              <ClassroomContent
                doctorKey="arman"
                isAdmin={isAdmin}
                updateField={updateField}
              />
            </TabsContent>
            <TabsContent value="samia">
              <ClassroomContent
                doctorKey="samia"
                isAdmin={isAdmin}
                updateField={updateField}
              />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* ── Chamber Address ─────────────────────────────────────────── */}
      <section id="chamber" className="py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap gap-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Chamber Address
                </h2>
              </div>
              {/* Find Near Me */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                disabled={nearMeLoading}
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error(
                      "Geolocation is not supported by your browser.",
                    );
                    return;
                  }
                  setNearMeLoading(true);
                  setNearestChamberId(null);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const userLat = pos.coords.latitude;
                      const userLng = pos.coords.longitude;
                      function haversine(
                        lat1: number,
                        lon1: number,
                        lat2: number,
                        lon2: number,
                      ): number {
                        const R = 6371;
                        const dLat = ((lat2 - lat1) * Math.PI) / 180;
                        const dLon = ((lon2 - lon1) * Math.PI) / 180;
                        const a =
                          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos((lat1 * Math.PI) / 180) *
                            Math.cos((lat2 * Math.PI) / 180) *
                            Math.sin(dLon / 2) *
                            Math.sin(dLon / 2);
                        return (
                          R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                        );
                      }
                      let nearest: { id: string; dist: number } | null = null;
                      for (const dKey of ["arman", "samia"] as const) {
                        const chs = (allDocs[dKey].chambers as any[]) || [];
                        for (const ch of chs) {
                          const lat =
                            typeof ch.lat === "number" ? ch.lat : 23.8103;
                          const lng =
                            typeof ch.lng === "number" ? ch.lng : 90.4125;
                          const dist = haversine(userLat, userLng, lat, lng);
                          if (!nearest || dist < nearest.dist) {
                            nearest = { id: ch.id || ch.nameBn || "", dist };
                          }
                        }
                      }
                      setNearMeLoading(false);
                      if (nearest) {
                        setNearestChamberId(nearest.id);
                        const el = chamberRefs.current[nearest.id];
                        if (el)
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        toast.success(
                          `Nearest chamber found! (${nearest.dist.toFixed(1)} km away)`,
                        );
                      }
                    },
                    (err) => {
                      setNearMeLoading(false);
                      if (err.code === 1) {
                        toast.error(
                          "Location access denied — please enable location in your browser settings.",
                        );
                      } else {
                        toast.error(
                          "Unable to get your location. Please try again.",
                        );
                      }
                    },
                    { timeout: 10000, maximumAge: 60000 },
                  );
                }}
                data-ocid="chamber.find_near_me_button"
              >
                {nearMeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {nearMeLoading ? "Finding..." : "Find Near Me"}
                <span
                  className="text-muted-foreground text-[0.75rem]"
                  style={{
                    fontFamily: "'Noto Sans Bengali', Arial, sans-serif",
                  }}
                >
                  / কাছের চেম্বার
                </span>
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Visit us at our clinic chambers for consultations.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(["arman", "samia"] as const).map((key, docIdx) => {
              const doc = allDocs[key];
              const chambers = (doc.chambers as any[]) || [];
              const accentColor =
                key === "arman" ? "text-primary" : "text-rose-600";
              const _bg = key === "arman" ? "bg-primary/10" : "bg-rose-100";
              const _border =
                key === "arman" ? "border-primary/30" : "border-rose-300";
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: docIdx === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: docIdx * 0.1 }}
                  className="space-y-4"
                >
                  {/* Doctor header + Add chamber button */}
                  <div className="flex items-center justify-between">
                    <h3
                      className={`flex items-center gap-2 font-semibold text-lg ${accentColor}`}
                    >
                      <MapPin className="w-5 h-5" />
                      {doc.name}
                    </h3>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => {
                          setChamberEditForm({
                            id: "",
                            nameBn: "",
                            addressBn: "",
                            address: "",
                            visitingHours: "",
                            phone: "",
                            emergencyPhone: "",
                            lat: "",
                            lng: "",
                          });
                          setEditChamberIdx(-1);
                          setEditChamberKey(key);
                        }}
                        data-ocid="chamber.open_modal_button"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Chamber
                      </Button>
                    )}
                  </div>

                  {chambers.map((chamber: any, cIdx: number) => {
                    const chamberId = chamber.id || String(cIdx);
                    const isNearest = nearestChamberId === chamberId;
                    const encodedAddr = encodeURIComponent(
                      chamber.address || chamber.addressBn || "",
                    );
                    const gradients =
                      key === "arman"
                        ? [
                            "from-blue-600 to-indigo-700",
                            "from-teal-500 to-cyan-600",
                            "from-violet-600 to-purple-700",
                          ]
                        : [
                            "from-rose-500 to-pink-600",
                            "from-amber-500 to-orange-600",
                            "from-emerald-500 to-green-600",
                          ];
                    const gradClass = gradients[cIdx % gradients.length];
                    const accentBtn =
                      key === "arman"
                        ? cIdx % 3 === 0
                          ? "border-blue-400 text-blue-700 hover:bg-blue-50"
                          : cIdx % 3 === 1
                            ? "border-teal-400 text-teal-700 hover:bg-teal-50"
                            : "border-violet-400 text-violet-700 hover:bg-violet-50"
                        : cIdx % 3 === 0
                          ? "border-rose-400 text-rose-700 hover:bg-rose-50"
                          : cIdx % 3 === 1
                            ? "border-amber-400 text-amber-700 hover:bg-amber-50"
                            : "border-emerald-400 text-emerald-700 hover:bg-emerald-50";
                    const iconColorClass =
                      key === "arman"
                        ? cIdx % 3 === 0
                          ? "text-blue-600"
                          : cIdx % 3 === 1
                            ? "text-teal-600"
                            : "text-violet-600"
                        : cIdx % 3 === 0
                          ? "text-rose-600"
                          : cIdx % 3 === 1
                            ? "text-amber-600"
                            : "text-emerald-600";
                    return (
                      <Card
                        key={chamberId}
                        ref={(el) => {
                          chamberRefs.current[chamberId] = el;
                        }}
                        className={`overflow-hidden border-0 shadow-md transition-all duration-500 ${isNearest ? "ring-2 ring-emerald-400 shadow-xl" : "hover:shadow-lg"}`}
                      >
                        {/* Gradient header */}
                        <div
                          className={`bg-gradient-to-r ${gradClass} px-5 py-4 flex items-center justify-between`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MapPin className="w-5 h-5 text-white/80 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-bold text-white text-base leading-tight block truncate">
                                {chamber.nameBn || chamber.address}
                              </span>
                              {isNearest && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/20 text-white rounded-full px-2 py-0.5 mt-0.5">
                                  <MapPin className="w-3 h-3" /> Nearest to you
                                </span>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
                                onClick={() => {
                                  setChamberEditForm({
                                    id: chamber.id || String(cIdx),
                                    nameBn: chamber.nameBn || "",
                                    addressBn: chamber.addressBn || "",
                                    address: chamber.address || "",
                                    visitingHours: chamber.visitingHours || "",
                                    phone: chamber.phone || "",
                                    emergencyPhone:
                                      chamber.emergencyPhone || "",
                                    lat:
                                      chamber.lat != null
                                        ? String(chamber.lat)
                                        : "",
                                    lng:
                                      chamber.lng != null
                                        ? String(chamber.lng)
                                        : "",
                                  });
                                  setEditChamberIdx(cIdx);
                                  setEditChamberKey(key);
                                }}
                                data-ocid="chamber.edit_button"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-white/70 hover:text-red-200 hover:bg-white/20"
                                disabled={chambers.length <= 1}
                                onClick={() => {
                                  if (!confirm("Delete this chamber?")) return;
                                  updateChambers(
                                    key,
                                    chambers.filter(
                                      (_: any, i: number) => i !== cIdx,
                                    ),
                                  );
                                }}
                                data-ocid="chamber.delete_button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <CardContent className="space-y-4 pt-4">
                          <div className="p-3 rounded-xl bg-muted/40 border border-border">
                            <div className="flex items-start gap-3">
                              <MapPin
                                className={`w-5 h-5 ${iconColorClass} shrink-0 mt-0.5`}
                              />
                              <div className="flex-1 min-w-0">
                                {chamber.addressBn && (
                                  <p
                                    className="text-sm font-medium text-foreground"
                                    style={{
                                      fontFamily:
                                        "'Noto Sans Bengali', Arial, sans-serif",
                                    }}
                                  >
                                    {chamber.addressBn
                                      .split("\n")
                                      .map(
                                        (
                                          line: string,
                                          lineIdx: number,
                                          arr: string[],
                                        ) => (
                                          <span key={line}>
                                            {line}
                                            {lineIdx < arr.length - 1 && <br />}
                                          </span>
                                        ),
                                      )}
                                  </p>
                                )}
                                {chamber.address && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {chamber.address}
                                  </p>
                                )}
                                {(chamber.address || chamber.addressBn) && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodedAddr}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${iconColorClass} hover:opacity-80 transition-colors`}
                                    data-ocid="chamber.maps.link"
                                  >
                                    <MapPin className="w-3 h-3" /> View on Map
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          {(chamber.address || chamber.addressBn) && (
                            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                              <iframe
                                src={`https://maps.google.com/maps?q=${encodedAddr}&output=embed&z=15`}
                                width="100%"
                                height="180"
                                style={{ border: 0, display: "block" }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title={`Map — ${chamber.nameBn || chamber.address}`}
                                data-ocid="chamber.map_embed"
                              />
                            </div>
                          )}
                          {(chamber.address || chamber.addressBn) && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodedAddr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                              data-ocid="chamber.get_directions_button"
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className={`w-full gap-2 font-semibold ${accentBtn} transition-colors`}
                              >
                                <Navigation className="w-4 h-4" />
                                Get Directions
                                <span
                                  className="text-muted-foreground text-[0.7rem]"
                                  style={{
                                    fontFamily:
                                      "'Noto Sans Bengali', Arial, sans-serif",
                                  }}
                                >
                                  / দিকনির্দেশনা
                                </span>
                              </Button>
                            </a>
                          )}
                          <div className="space-y-3">
                            {chamber.visitingHours && (
                              <div className="flex items-center gap-3">
                                <Clock
                                  className={`w-4 h-4 ${iconColorClass} shrink-0`}
                                />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Visiting Hours
                                  </p>
                                  <p className="text-sm font-medium">
                                    {chamber.visitingHours}
                                  </p>
                                </div>
                              </div>
                            )}
                            {chamber.phone && (
                              <div className="flex items-center gap-3">
                                <Phone
                                  className={`w-4 h-4 ${iconColorClass} shrink-0`}
                                />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Phone
                                  </p>
                                  <p className="text-sm font-medium">
                                    {chamber.phone}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <Mail
                                className={`w-4 h-4 ${iconColorClass} shrink-0`}
                              />
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Email
                                </p>
                                <p className="text-sm font-medium">
                                  {doc.email}
                                </p>
                              </div>
                            </div>
                            {chamber.emergencyPhone && (
                              <div className="flex items-center gap-3">
                                <PhoneCall
                                  className={`w-4 h-4 ${iconColorClass} shrink-0`}
                                />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Emergency
                                  </p>
                                  <p className="text-sm font-medium">
                                    {chamber.emergencyPhone}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chamber Add/Edit Dialog */}
      {editChamberKey && (
        <Dialog
          open={!!editChamberKey}
          onOpenChange={(o) => !o && setEditChamberKey(null)}
        >
          <DialogContent className="max-w-md" data-ocid="chamber.dialog">
            <DialogHeader>
              <DialogTitle>
                {editChamberIdx === -1 ? "Add Chamber" : "Edit Chamber"} —{" "}
                {editChamberKey === "arman"
                  ? "Dr. Arman Kabir"
                  : "Dr. Samia Shikder"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name (Bangla)</Label>
                <Input
                  value={chamberEditForm.nameBn}
                  onChange={(e) =>
                    setChamberEditForm((f) => ({
                      ...f,
                      nameBn: e.target.value,
                    }))
                  }
                  placeholder="চেম্বারের নাম"
                  data-ocid="chamber.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address (Bangla)</Label>
                <Textarea
                  value={chamberEditForm.addressBn}
                  onChange={(e) =>
                    setChamberEditForm((f) => ({
                      ...f,
                      addressBn: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="বাংলা ঠিকানা"
                  data-ocid="chamber.textarea"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address (English)</Label>
                <Textarea
                  value={chamberEditForm.address}
                  onChange={(e) =>
                    setChamberEditForm((f) => ({
                      ...f,
                      address: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="English address"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visiting Hours</Label>
                <Input
                  value={chamberEditForm.visitingHours}
                  onChange={(e) =>
                    setChamberEditForm((f) => ({
                      ...f,
                      visitingHours: e.target.value,
                    }))
                  }
                  placeholder="e.g. Sat–Thu: 5 PM – 9 PM"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={chamberEditForm.phone}
                  onChange={(e) =>
                    setChamberEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Emergency Phone</Label>
                <Input
                  value={chamberEditForm.emergencyPhone}
                  onChange={(e) =>
                    setChamberEditForm((f) => ({
                      ...f,
                      emergencyPhone: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    Latitude{" "}
                    <span className="text-muted-foreground text-xs">
                      (for map)
                    </span>
                  </Label>
                  <Input
                    value={chamberEditForm.lat}
                    onChange={(e) =>
                      setChamberEditForm((f) => ({ ...f, lat: e.target.value }))
                    }
                    placeholder="e.g. 23.7461"
                    data-ocid="chamber.lat_input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Longitude{" "}
                    <span className="text-muted-foreground text-xs">
                      (for map)
                    </span>
                  </Label>
                  <Input
                    value={chamberEditForm.lng}
                    onChange={(e) =>
                      setChamberEditForm((f) => ({ ...f, lng: e.target.value }))
                    }
                    placeholder="e.g. 90.4066"
                    data-ocid="chamber.lng_input"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (!editChamberKey) return;
                    const doc = allDocs[editChamberKey];
                    const chambers = (doc.chambers as any[]) || [];
                    if (editChamberIdx === -1) {
                      // Add new
                      const latNum = Number.parseFloat(chamberEditForm.lat);
                      const lngNum = Number.parseFloat(chamberEditForm.lng);
                      const newChamber = {
                        ...chamberEditForm,
                        id: Date.now().toString(),
                        lat: !Number.isNaN(latNum) ? latNum : undefined,
                        lng: !Number.isNaN(lngNum) ? lngNum : undefined,
                      };
                      updateChambers(editChamberKey, [...chambers, newChamber]);
                    } else {
                      // Update existing
                      const latNum = Number.parseFloat(chamberEditForm.lat);
                      const lngNum = Number.parseFloat(chamberEditForm.lng);
                      const updated = chambers.map((c: any, i: number) =>
                        i === editChamberIdx
                          ? {
                              ...c,
                              ...chamberEditForm,
                              lat: !Number.isNaN(latNum) ? latNum : c.lat,
                              lng: !Number.isNaN(lngNum) ? lngNum : c.lng,
                            }
                          : c,
                      );
                      updateChambers(editChamberKey, updated);
                    }
                    setEditChamberKey(null);
                    toast.success(
                      editChamberIdx === -1
                        ? "Chamber added"
                        : "Chamber updated",
                    );
                  }}
                  data-ocid="chamber.confirm_button"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditChamberKey(null)}
                  data-ocid="chamber.cancel_button"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Testimonials ──────────────────────────────────────── */}
      <TestimonialsSection isAdmin={isAdmin} />

      {/* ── Gallery ──────────────────────────────────────────── */}
      <GallerySection isAdmin={isAdmin} />

      {/* ── Appointments ────────────────────────────────────────────── */}
      <section id="appointments" className="py-16 bg-muted/30 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto" id="booking-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Book an Appointment
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Fill in your details and we will confirm your appointment.
              {bookingCount > 0 && (
                <span className="ml-1 text-primary font-medium">
                  {bookingCount} appointment{bookingCount !== 1 ? "s" : ""}{" "}
                  booked so far.
                </span>
              )}
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key="booking-tabs"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              data-ocid="appointments.booking.panel"
            >
              {/* Tab switcher */}
              <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setActiveBookingTab("chamber")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${activeBookingTab === "chamber" ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                  data-ocid="appointments.booking.chamber_tab"
                >
                  <Stethoscope className="w-4 h-4" />
                  Chamber (Outpatient)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBookingTab("admitted")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${activeBookingTab === "admitted" ? "bg-card text-rose-700 shadow-sm border border-rose-200" : "text-muted-foreground hover:text-foreground"}`}
                  data-ocid="appointments.booking.admitted_tab"
                >
                  <Building2 className="w-4 h-4" />
                  Hospital (Admitted)
                </button>
              </div>

              {/* Chamber booking */}
              {activeBookingTab === "chamber" &&
                (chamberSubmitted ? (
                  <div
                    className="text-center py-10"
                    data-ocid="appointments.chamber.success_state"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">
                      Chamber Appointment Submitted!
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Our staff will confirm your appointment shortly.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChamberSubmitted(false);
                        setChamberForm(emptyChamberForm);
                        setChamberLookup("");
                        setChamberFoundPatient(null);
                        setChamberLookupMsg("");
                      }}
                      data-ocid="appointments.chamber.new_button"
                    >
                      Book Another
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    <Card className="border-2 border-primary/20">
                      <CardContent className="p-5 space-y-4">
                        {/* Patient search */}
                        <div className="space-y-1.5">
                          <Label>
                            Search Patient{" "}
                            <span className="text-xs text-muted-foreground font-normal">
                              (Register No. or Mobile)
                            </span>
                          </Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              className="pl-9"
                              placeholder="0001/26 or 01XXXXXXXXX — auto-fills details"
                              value={chamberLookup}
                              onChange={(e) =>
                                handleChamberLookup(e.target.value)
                              }
                              data-ocid="appointments.chamber.lookup_input"
                            />
                          </div>
                          {chamberLookupMsg && (
                            <p
                              className={`text-xs font-medium ${chamberLookupMsg.startsWith("✓") ? "text-emerald-600" : "text-amber-600"}`}
                            >
                              {chamberLookupMsg}
                            </p>
                          )}
                        </div>

                        {/* Found patient card */}
                        {chamberFoundPatient && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-emerald-900 text-sm">
                                {chamberFoundPatient.patientName}
                              </p>
                              <div className="flex gap-3 text-xs text-emerald-700 mt-0.5 flex-wrap">
                                {chamberFoundPatient.age && (
                                  <span>Age: {chamberFoundPatient.age}</span>
                                )}
                                {chamberFoundPatient.gender && (
                                  <span>{chamberFoundPatient.gender}</span>
                                )}
                                {chamberFoundPatient.phone && (
                                  <span>{chamberFoundPatient.phone}</span>
                                )}
                                {chamberFoundPatient.registerNumber && (
                                  <span className="font-mono">
                                    Reg: {chamberFoundPatient.registerNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fallback name/phone if not found via lookup */}
                        {!chamberFoundPatient && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>
                                Patient Name{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                placeholder="Full name"
                                value={chamberForm.patientName}
                                onChange={(e) =>
                                  setChamberForm((f) => ({
                                    ...f,
                                    patientName: e.target.value,
                                  }))
                                }
                                data-ocid="appointments.chamber.name_input"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>
                                Phone{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="tel"
                                placeholder="+880 1XXXXXXXXX"
                                value={chamberForm.phone}
                                onChange={(e) =>
                                  setChamberForm((f) => ({
                                    ...f,
                                    phone: e.target.value,
                                  }))
                                }
                                data-ocid="appointments.chamber.phone_input"
                              />
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>
                              Doctor <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={chamberForm.doctor}
                              onValueChange={(v) =>
                                setChamberForm((f) => ({
                                  ...f,
                                  doctor: v,
                                  chamber: "",
                                }))
                              }
                            >
                              <SelectTrigger data-ocid="appointments.chamber.doctor_select">
                                <SelectValue placeholder="Select doctor" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Dr. Arman Kabir">
                                  Dr. Arman Kabir
                                </SelectItem>
                                <SelectItem value="Dr. Samia Shikder">
                                  Dr. Samia Shikder
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {(() => {
                            const dKey =
                              chamberForm.doctor === "Dr. Arman Kabir"
                                ? "arman"
                                : chamberForm.doctor === "Dr. Samia Shikder"
                                  ? "samia"
                                  : null;
                            const dChambers = dKey
                              ? (allDocs[dKey as "arman" | "samia"]
                                  ?.chambers as any[]) || []
                              : [];
                            if (dChambers.length === 0) return null;
                            return (
                              <div className="space-y-1.5">
                                <Label>Chamber</Label>
                                <Select
                                  value={chamberForm.chamber}
                                  onValueChange={(v) =>
                                    setChamberForm((f) => ({
                                      ...f,
                                      chamber: v,
                                    }))
                                  }
                                >
                                  <SelectTrigger data-ocid="appointments.chamber.chamber_select">
                                    <SelectValue placeholder="Select chamber" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dChambers.map((ch: any, i: number) => (
                                      <SelectItem
                                        key={ch.id || i}
                                        value={
                                          ch.address ||
                                          ch.nameBn ||
                                          `Chamber ${i + 1}`
                                        }
                                      >
                                        {ch.address ||
                                          ch.nameBn ||
                                          `Chamber ${i + 1}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>
                              Preferred Date{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="date"
                              value={chamberForm.date}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={(e) =>
                                setChamberForm((f) => ({
                                  ...f,
                                  date: e.target.value,
                                }))
                              }
                              data-ocid="appointments.chamber.date_input"
                            />
                          </div>
                        </div>

                        {/* Time Slot Chips */}
                        {chamberForm.date && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Today&apos;s Available Times
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const slots: string[] = [];
                                for (let h = 9; h < 17; h++) {
                                  for (const m of [0, 30]) {
                                    const hh = String(h).padStart(2, "0");
                                    const mm = String(m).padStart(2, "0");
                                    slots.push(`${hh}:${mm}`);
                                  }
                                }
                                const existingBookings: PublicBooking[] =
                                  (() => {
                                    try {
                                      return JSON.parse(
                                        localStorage.getItem(
                                          "public_appointment_requests",
                                        ) || "[]",
                                      );
                                    } catch {
                                      return [];
                                    }
                                  })();
                                const bookedTimes = new Set(
                                  existingBookings
                                    .filter(
                                      (b) =>
                                        (b.preferredDate || b.date) ===
                                        chamberForm.date,
                                    )
                                    .map((b) => b.preferredTime || b.time)
                                    .filter(Boolean),
                                );
                                return slots.map((slot) => {
                                  const isBooked = bookedTimes.has(slot);
                                  const [hh, mm] = slot.split(":");
                                  const h = Number.parseInt(hh, 10);
                                  const ampm = h >= 12 ? "PM" : "AM";
                                  const h12 =
                                    h > 12 ? h - 12 : h === 0 ? 12 : h;
                                  const label = `${h12}:${mm} ${ampm}`;
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      disabled={isBooked}
                                      onClick={() =>
                                        !isBooked &&
                                        setChamberForm((f) => ({
                                          ...f,
                                          time: slot,
                                        }))
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                        chamberForm.time === slot
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : isBooked
                                            ? "bg-muted text-muted-foreground border-border cursor-not-allowed line-through"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                      }`}
                                      data-ocid={`appointments.chamber.slot.${slot.replace(":", "")}`}
                                    >
                                      {label}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label>Preferred Time</Label>
                          <Input
                            type="time"
                            value={chamberForm.time}
                            onChange={(e) =>
                              setChamberForm((f) => ({
                                ...f,
                                time: e.target.value,
                              }))
                            }
                            data-ocid="appointments.chamber.time_input"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Reason for Visit</Label>
                          <Textarea
                            placeholder="Briefly describe your symptoms..."
                            rows={2}
                            value={chamberForm.reason}
                            onChange={(e) =>
                              setChamberForm((f) => ({
                                ...f,
                                reason: e.target.value,
                              }))
                            }
                            className="resize-none"
                            data-ocid="appointments.chamber.reason_input"
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 font-semibold"
                          data-ocid="appointments.chamber.submit_button"
                        >
                          <CalendarDays className="w-4 h-4 mr-2" />
                          Submit Chamber Appointment
                        </Button>
                      </CardContent>
                    </Card>
                  </form>
                ))}

              {/* Hospital/Admitted booking */}
              {activeBookingTab === "admitted" &&
                (admitSubmitted ? (
                  <div
                    className="text-center py-10"
                    data-ocid="appointments.admitted.success_state"
                  >
                    <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-7 h-7 text-rose-600" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">
                      Admission Request Submitted!
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Our staff will confirm your hospital admission shortly.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAdmitSubmitted(false);
                        setAdmitForm(emptyAdmitForm);
                        setAdmitLookup("");
                        setAdmitFoundPatient(null);
                        setAdmitLookupMsg("");
                      }}
                      data-ocid="appointments.admitted.new_button"
                    >
                      New Request
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleAdmitSubmit} className="space-y-4">
                    <Card className="border-2 border-rose-200">
                      <CardContent className="p-5 space-y-4">
                        {/* Patient search */}
                        <div className="space-y-1.5">
                          <Label>
                            Search Patient{" "}
                            <span className="text-xs text-muted-foreground font-normal">
                              (Register No. or Mobile)
                            </span>
                          </Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              className="pl-9"
                              placeholder="0001/26 or 01XXXXXXXXX — auto-fills details"
                              value={admitLookup}
                              onChange={(e) =>
                                handleAdmitLookup(e.target.value)
                              }
                              data-ocid="appointments.admitted.lookup_input"
                            />
                          </div>
                          {admitLookupMsg && (
                            <p
                              className={`text-xs font-medium ${admitLookupMsg.startsWith("✓") ? "text-emerald-600" : "text-amber-600"}`}
                            >
                              {admitLookupMsg}
                            </p>
                          )}
                        </div>

                        {/* Found patient card */}
                        {admitFoundPatient && (
                          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-rose-900 text-sm">
                                {admitFoundPatient.patientName}
                              </p>
                              <div className="flex gap-3 text-xs text-rose-700 mt-0.5 flex-wrap">
                                {admitFoundPatient.age && (
                                  <span>Age: {admitFoundPatient.age}</span>
                                )}
                                {admitFoundPatient.gender && (
                                  <span>{admitFoundPatient.gender}</span>
                                )}
                                {admitFoundPatient.phone && (
                                  <span>{admitFoundPatient.phone}</span>
                                )}
                                {admitFoundPatient.registerNumber && (
                                  <span className="font-mono">
                                    Reg: {admitFoundPatient.registerNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fallback name/phone */}
                        {!admitFoundPatient && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>
                                Patient Name{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                placeholder="Full name"
                                value={admitForm.patientName}
                                onChange={(e) =>
                                  setAdmitForm((f) => ({
                                    ...f,
                                    patientName: e.target.value,
                                  }))
                                }
                                data-ocid="appointments.admitted.name_input"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>
                                Phone{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="tel"
                                placeholder="+880 1XXXXXXXXX"
                                value={admitForm.phone}
                                onChange={(e) =>
                                  setAdmitForm((f) => ({
                                    ...f,
                                    phone: e.target.value,
                                  }))
                                }
                                data-ocid="appointments.admitted.phone_input"
                              />
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>
                              Admission Date{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="date"
                              value={admitForm.admissionDate}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={(e) =>
                                setAdmitForm((f) => ({
                                  ...f,
                                  admissionDate: e.target.value,
                                }))
                              }
                              data-ocid="appointments.admitted.date_input"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Hospital Name</Label>
                            <Input
                              placeholder="e.g. DMCH, BSMMU"
                              value={admitForm.hospitalName}
                              onChange={(e) =>
                                setAdmitForm((f) => ({
                                  ...f,
                                  hospitalName: e.target.value,
                                }))
                              }
                              data-ocid="appointments.admitted.hospital_input"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>Bed / Ward (optional)</Label>
                            <Input
                              placeholder="e.g. Ward 7, Bed 12"
                              value={admitForm.bedWardNumber}
                              onChange={(e) =>
                                setAdmitForm((f) => ({
                                  ...f,
                                  bedWardNumber: e.target.value,
                                }))
                              }
                              data-ocid="appointments.admitted.bed_input"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Doctor</Label>
                            <Select
                              value={admitForm.doctor}
                              onValueChange={(v) =>
                                setAdmitForm((f) => ({ ...f, doctor: v }))
                              }
                            >
                              <SelectTrigger data-ocid="appointments.admitted.doctor_select">
                                <SelectValue placeholder="Select doctor (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Dr. Arman Kabir">
                                  Dr. Arman Kabir
                                </SelectItem>
                                <SelectItem value="Dr. Samia Shikder">
                                  Dr. Samia Shikder
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Referring Doctor (optional)</Label>
                          <Input
                            placeholder="Referring doctor name"
                            value={admitForm.referringDoctor}
                            onChange={(e) =>
                              setAdmitForm((f) => ({
                                ...f,
                                referringDoctor: e.target.value,
                              }))
                            }
                            data-ocid="appointments.admitted.referring_input"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Admission Reason</Label>
                          <Textarea
                            placeholder="Reason for admission / chief complaint..."
                            rows={2}
                            value={admitForm.admissionReason}
                            onChange={(e) =>
                              setAdmitForm((f) => ({
                                ...f,
                                admissionReason: e.target.value,
                              }))
                            }
                            className="resize-none"
                            data-ocid="appointments.admitted.reason_input"
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 font-semibold bg-rose-600 hover:bg-rose-700"
                          data-ocid="appointments.admitted.submit_button"
                        >
                          <Building2 className="w-4 h-4 mr-2" />
                          Submit Admission Request
                        </Button>
                      </CardContent>
                    </Card>
                  </form>
                ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── CV ──────────────────────────────────────────────────────── */}
      <section id="cv" className="py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Curriculum Vitae
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Academic qualifications, experience, and publications.
            </p>
          </motion.div>

          <Tabs defaultValue="arman" className="space-y-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="arman" data-ocid="cv.arman.tab">
                Dr. Arman Kabir
              </TabsTrigger>
              <TabsTrigger value="samia" data-ocid="cv.samia.tab">
                Dr. Samia Shikder
              </TabsTrigger>
            </TabsList>
            <TabsContent value="arman">
              <Card className="border-2 border-primary/20">
                <CardContent className="p-6">
                  <CVContent
                    doctorKey="arman"
                    isAdmin={isAdmin}
                    updateField={updateField}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="samia">
              <Card className="border-2 border-rose-200">
                <CardContent className="p-6">
                  <CVContent
                    doctorKey="samia"
                    isAdmin={isAdmin}
                    updateField={updateField}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* ── Admin Tools ──────────────────────────────────────────── */}
      {isAdmin && (
        <section className="py-12 px-4 bg-amber-50/30 border-t border-amber-100">
          <div className="max-w-6xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              Admin Tools
            </h2>
            <StaffApprovalsAdmin />
            <PrescriptionPDFManager />
            <TreatmentReferencePDFAdmin />
            <DifferentialDiagnosisPDFAdmin />
            <InterpretationRefPDFAdmin />
          </div>
        </section>
      )}
      {isAdmin && (
        <AdminFrontPagePanel
          config={siteConfig}
          updateHero={updateHero}
          updateAbout={updateAbout}
          updateFooter={updateFooter}
          updateEmergencyContacts={updateEmergencyContacts}
          resetSection={resetSection}
        />
      )}
      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="bg-slate-800 text-white px-4 sm:px-6 pt-12 pb-6 relative"
        data-ocid="landing.footer.section"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-8">
            {/* Left: Clinic Info */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-white">
                  {siteConfig.aboutSection.clinicNameEn}
                </span>
              </div>
              <p className="text-slate-300 text-sm mb-4 max-w-sm">
                {siteConfig.aboutSection.descriptionEn}
              </p>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{siteConfig.footerSection.addressEn}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    {siteConfig.footerSection.phone || armanDoc.phone}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    {siteConfig.footerSection.email || armanDoc.email}
                  </span>
                </div>
                {siteConfig.footerSection.openingHours && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>{siteConfig.footerSection.openingHours}</span>
                  </div>
                )}
              </div>
              {siteConfig.footerSection.socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {siteConfig.footerSection.socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-100 transition-colors"
                    >
                      <span>{link.icon}</span>
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    document
                      .querySelector<HTMLButtonElement>(
                        '[data-ocid="admin_panel.open_modal_button"]',
                      )
                      ?.click()
                  }
                  className="mt-3 bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all w-fit"
                  data-ocid="footer.edit_button"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Footer
                </button>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.footerSection.addressEn)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                data-ocid="footer.get_directions.link"
              >
                <MapPin className="w-4 h-4" />📍 Get Directions
              </a>
            </div>
            {/* Right: Quick Links */}
            <div>
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("booking-section")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="text-left text-sm text-slate-300 hover:text-white transition-colors py-1 flex items-center gap-2"
                  data-ocid="footer.book_appointment.link"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                  Book Appointment
                </button>
                <button
                  type="button"
                  onClick={() => setEmergencyOpen(true)}
                  className="text-left text-sm text-slate-300 hover:text-white transition-colors py-1 flex items-center gap-2"
                  data-ocid="footer.emergency.button"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  Emergency WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("doctors-section")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="text-left text-sm text-slate-300 hover:text-white transition-colors py-1 flex items-center gap-2"
                  data-ocid="footer.doctors.link"
                >
                  <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
                  Doctor Profiles
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("classrooms-section")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="text-left text-sm text-slate-300 hover:text-white transition-colors py-1 flex items-center gap-2"
                  data-ocid="footer.classrooms.link"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  Classrooms
                </button>
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="text-left text-sm text-slate-300 hover:text-white transition-colors py-1 flex items-center gap-2"
                  data-ocid="footer.staff_login.button"
                >
                  <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
                  Staff Login
                </button>
                <button
                  type="button"
                  onClick={onAdminLoginClick}
                  className="text-left text-sm text-slate-300 hover:text-white transition-colors py-1 flex items-center gap-2"
                  data-ocid="footer.admin_login.button"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Admin Login
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-slate-700 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 text-center">
              © {new Date().getFullYear()}{" "}
              {siteConfig.footerSection.copyrightText} Built with{" "}
              <Heart className="w-3 h-3 inline text-rose-400" /> using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-200"
              >
                caffeine.ai
              </a>
            </p>
            <button
              type="button"
              onClick={() => setPrivacyModalOpen(true)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline"
              data-ocid="footer.privacy_policy.link"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="max-w-md" data-ocid="privacy.dialog">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              We collect patient information solely for medical care purposes.
              Data is stored securely and never shared with third parties
              without consent.
            </p>
            <p>
              Your personal data (name, contact information, medical history) is
              used only to facilitate appointments, clinical records, and
              communications from your doctor.
            </p>
            <p>
              You may request access to, correction of, or deletion of your
              personal data by contacting the clinic directly.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Last updated: {new Date().getFullYear()}. Dr. Arman Kabir&apos;s
              Care, Dhaka, Bangladesh.
            </p>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => setPrivacyModalOpen(false)}
              className="w-full"
              data-ocid="privacy.close_button"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky Emergency WhatsApp Button (mobile only) */}
      <button
        type="button"
        className="md:hidden fixed bottom-4 right-4 z-50 bg-green-500 hover:bg-green-600 text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-2 font-semibold text-sm transition-all active:scale-95"
        onClick={() => setEmergencyOpen(true)}
        data-ocid="landing.whatsapp_fab.button"
        aria-label="Emergency consultation via WhatsApp"
      >
        <span className="text-base">💬</span>
        Emergency Consult
      </button>
    </div>
  );
}
