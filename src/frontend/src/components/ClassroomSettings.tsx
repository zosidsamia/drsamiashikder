import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DoctorKey } from "@/data/doctorsData";
import { useDoctorContent } from "@/hooks/useDoctorContent";
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit2,
  ExternalLink,
  FileText,
  Image,
  ImageIcon,
  MonitorPlay,
  Pin,
  Plus,
  Save,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  isPinned: boolean;
}

interface LectureNote {
  id: string;
  title: string;
  description: string;
  link: string;
  pdfLink: string;
  datePublished: string;
}

interface VideoItem {
  id: string;
  title: string;
  url: string;
  description: string;
  isFeatured: boolean;
}

interface ScheduleEntry {
  id: string;
  day: string;
  time: string;
  subject: string;
  venue: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getYoutubeThumbnail(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  return null;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ── Classroom Gallery Types ──────────────────────────────────────────────────

export interface ClassroomGalleryImage {
  id: string;
  dataUrl: string;
  caption: string;
  category: "Medical" | "Educational" | "Event" | "Facility" | "";
}

// ── Gallery Section (Admin) ───────────────────────────────────────────────────

function ClassroomGallerySection({
  items,
  onSave,
}: {
  items: ClassroomGalleryImage[];
  onSave: (items: ClassroomGalleryImage[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editCaptionId, setEditCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [categoryDraft, setCategoryDraft] =
    useState<ClassroomGalleryImage["category"]>("");

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const readers: Promise<ClassroomGalleryImage>[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id: uid(),
              dataUrl: e.target?.result as string,
              caption: file.name.replace(/\.[^.]+$/, ""),
              category: "",
            });
          };
          reader.readAsDataURL(file);
        }),
      );
    }
    Promise.all(readers).then((newImgs) => {
      onSave([...items, ...newImgs]);
      setUploading(false);
      toast.success(`${newImgs.length} image(s) added to gallery.`);
    });
  };

  const startEdit = (img: ClassroomGalleryImage) => {
    setEditCaptionId(img.id);
    setCaptionDraft(img.caption);
    setCategoryDraft(img.category);
  };

  const saveCaption = (id: string) => {
    onSave(
      items.map((img) =>
        img.id === id
          ? { ...img, caption: captionDraft, category: categoryDraft }
          : img,
      ),
    );
    setEditCaptionId(null);
    toast.success("Image updated.");
  };

  const deleteImage = (id: string) => {
    onSave(items.filter((img) => img.id !== id));
    toast.success("Image removed.");
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const arr = [...items];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onSave(arr);
  };

  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return;
    const arr = [...items];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onSave(arr);
  };

  const CATEGORIES: ClassroomGalleryImage["category"][] = [
    "",
    "Medical",
    "Educational",
    "Event",
    "Facility",
  ];

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {items.length} image{items.length !== 1 ? "s" : ""} in classroom
          gallery
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-ocid="classroom.gallery.upload_button"
        >
          <Image className="w-3.5 h-3.5" />
          Upload Images
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Empty state — use button element so useSemanticElements is satisfied */}
      {items.length === 0 && (
        <button
          type="button"
          className="w-full border-2 border-dashed border-primary/30 rounded-xl p-10 text-center cursor-pointer hover:border-primary/60 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          data-ocid="classroom.gallery.empty_state"
        >
          <ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Drop images here or click to upload
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            JPEG, PNG, WebP supported
          </p>
        </button>
      )}

      {/* Image list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((img, i) => (
            <div
              key={img.id}
              className="bg-card border border-border rounded-xl p-3 flex gap-3 items-start"
              data-ocid={`classroom.gallery.item.${i + 1}`}
            >
              {/* Thumbnail */}
              <img
                src={img.dataUrl}
                alt={img.caption || `Gallery image ${i + 1}`}
                className="w-20 h-16 object-cover rounded-lg shrink-0 border border-border"
              />
              {/* Info / edit */}
              <div className="flex-1 min-w-0">
                {editCaptionId === img.id ? (
                  <div className="space-y-2">
                    <Input
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      placeholder="Caption (optional)"
                      className="h-7 text-xs"
                      data-ocid={`classroom.gallery.caption.input.${i + 1}`}
                    />
                    <Select
                      value={categoryDraft}
                      onValueChange={(v) =>
                        setCategoryDraft(v as ClassroomGalleryImage["category"])
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Category (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c || "none"} value={c || "none"}>
                            {c || "No category"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => saveCaption(img.id)}
                        data-ocid={`classroom.gallery.save_button.${i + 1}`}
                      >
                        <Save className="w-3 h-3" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => setEditCaptionId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {img.caption || (
                        <span className="text-muted-foreground italic">
                          No caption
                        </span>
                      )}
                    </p>
                    {img.category && (
                      <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {img.category}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Actions */}
              {editCaptionId !== img.id && (
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => startEdit(img)}
                    data-ocid={`classroom.gallery.edit_button.${i + 1}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => moveDown(i)}
                    disabled={i === items.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteImage(img.id)}
                    data-ocid={`classroom.gallery.delete_button.${i + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

// Announcements
function AnnouncementsSection({
  items,
  onSave,
}: {
  items: Announcement[];
  onSave: (items: Announcement[]) => void;
}) {
  const blank: Omit<Announcement, "id"> = {
    title: "",
    body: "",
    date: new Date().toISOString().slice(0, 10),
    isPinned: false,
  };
  const [form, setForm] = useState<Omit<Announcement, "id">>(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const startEdit = (item: Announcement) => {
    setEditId(item.id);
    setForm({
      title: item.title,
      body: item.body,
      date: item.date,
      isPinned: item.isPinned,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(blank);
  };

  const saveItem = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editId) {
      onSave(items.map((a) => (a.id === editId ? { ...form, id: editId } : a)));
      toast.success("Announcement updated");
    } else {
      onSave([...items, { ...form, id: uid() }]);
      toast.success("Announcement added");
    }
    setEditId(null);
    setForm(blank);
  };

  const deleteItem = (id: string) => {
    onSave(items.filter((a) => a.id !== id));
    toast.success("Announcement deleted");
  };

  const sorted = [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  return (
    <div className="space-y-4">
      {/* List */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg"
            data-ocid="classroom.announcements.empty_state"
          >
            No announcements yet. Add one below.
          </p>
        )}
        {sorted.map((item, i) => (
          <div
            key={item.id}
            className="bg-card border border-border rounded-xl p-3 space-y-1"
            data-ocid={`classroom.announcements.item.${i + 1}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {item.isPinned && (
                  <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <p className="font-semibold text-sm text-foreground truncate">
                  {item.title}
                </p>
                {item.isPinned && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs shrink-0">
                    Pinned
                  </Badge>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => startEdit(item)}
                  data-ocid={`classroom.announcements.edit_button.${i + 1}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteItem(item.id)}
                  data-ocid={`classroom.announcements.delete_button.${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{item.date}</p>
            <p className="text-sm text-foreground/80 line-clamp-2">
              {item.body}
            </p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-primary" />
          {editId ? "Edit Announcement" : "Add Announcement"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="ann-title" className="text-xs">
            Title
          </Label>
          <Input
            id="ann-title"
            placeholder="e.g. Ward Round Schedule Change"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            data-ocid="classroom.announcements.title.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ann-body" className="text-xs">
            Body
          </Label>
          <Textarea
            id="ann-body"
            placeholder="Write the announcement details here..."
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            className="min-h-[80px]"
            data-ocid="classroom.announcements.body.textarea"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ann-date" className="text-xs">
              Date
            </Label>
            <Input
              id="ann-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              data-ocid="classroom.announcements.date.input"
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <Checkbox
              id="ann-pinned"
              checked={form.isPinned}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isPinned: !!v }))}
              data-ocid="classroom.announcements.pinned.checkbox"
            />
            <Label htmlFor="ann-pinned" className="text-sm cursor-pointer">
              Pin this announcement
            </Label>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={saveItem}
            data-ocid="classroom.announcements.save_button"
          >
            <Save className="w-3.5 h-3.5" />
            {editId ? "Update" : "Add"}
          </Button>
          {editId && (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              data-ocid="classroom.announcements.cancel_button"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Lecture Notes
function LectureNotesSection({
  items,
  onSave,
}: {
  items: LectureNote[];
  onSave: (items: LectureNote[]) => void;
}) {
  const blank: Omit<LectureNote, "id"> = {
    title: "",
    description: "",
    link: "",
    pdfLink: "",
    datePublished: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState<Omit<LectureNote, "id">>(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const startEdit = (item: LectureNote) => {
    setEditId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      link: item.link,
      pdfLink: item.pdfLink,
      datePublished: item.datePublished,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(blank);
  };

  const saveItem = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editId) {
      onSave(items.map((n) => (n.id === editId ? { ...form, id: editId } : n)));
      toast.success("Note updated");
    } else {
      onSave([...items, { ...form, id: uid() }]);
      toast.success("Note added");
    }
    setEditId(null);
    setForm(blank);
  };

  const deleteItem = (id: string) => {
    onSave(items.filter((n) => n.id !== id));
    toast.success("Note deleted");
  };

  const sorted = [...items].sort((a, b) =>
    b.datePublished.localeCompare(a.datePublished),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg"
            data-ocid="classroom.notes.empty_state"
          >
            No lecture notes yet. Add one below.
          </p>
        )}
        {sorted.map((item, i) => (
          <div
            key={item.id}
            className="bg-card border border-border rounded-xl p-3 space-y-1"
            data-ocid={`classroom.notes.item.${i + 1}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm text-foreground flex-1 min-w-0 truncate">
                {item.title}
              </p>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => startEdit(item)}
                  data-ocid={`classroom.notes.edit_button.${i + 1}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteItem(item.id)}
                  data-ocid={`classroom.notes.delete_button.${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.datePublished}
            </p>
            {item.description && (
              <p className="text-sm text-foreground/80 line-clamp-2">
                {item.description}
              </p>
            )}
            <div className="flex gap-3">
              {item.link && item.link !== "#" && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Link
                </a>
              )}
              {item.pdfLink && item.pdfLink !== "#" && (
                <a
                  href={item.pdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  PDF
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-primary" />
          {editId ? "Edit Note" : "Add Lecture Note"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="note-title" className="text-xs">
            Title
          </Label>
          <Input
            id="note-title"
            placeholder="e.g. Acute Abdomen — Differential Diagnosis"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            data-ocid="classroom.notes.title.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-desc" className="text-xs">
            Description
          </Label>
          <Textarea
            id="note-desc"
            placeholder="Brief description of the lecture note..."
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="min-h-[60px]"
            data-ocid="classroom.notes.description.textarea"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="note-link" className="text-xs">
              Link (URL)
            </Label>
            <Input
              id="note-link"
              type="url"
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              data-ocid="classroom.notes.link.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-pdf" className="text-xs">
              PDF / Document Link
            </Label>
            <Input
              id="note-pdf"
              type="url"
              placeholder="https://... (PDF URL)"
              value={form.pdfLink}
              onChange={(e) =>
                setForm((f) => ({ ...f, pdfLink: e.target.value }))
              }
              data-ocid="classroom.notes.pdf_link.input"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-date" className="text-xs">
            Date Published
          </Label>
          <Input
            id="note-date"
            type="date"
            value={form.datePublished}
            onChange={(e) =>
              setForm((f) => ({ ...f, datePublished: e.target.value }))
            }
            className="w-auto"
            data-ocid="classroom.notes.date.input"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={saveItem}
            data-ocid="classroom.notes.save_button"
          >
            <Save className="w-3.5 h-3.5" />
            {editId ? "Update" : "Add"}
          </Button>
          {editId && (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              data-ocid="classroom.notes.cancel_button"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Video Lectures
function VideoLecturesSection({
  items,
  onSave,
}: {
  items: VideoItem[];
  onSave: (items: VideoItem[]) => void;
}) {
  const blank: Omit<VideoItem, "id"> = {
    title: "",
    url: "",
    description: "",
    isFeatured: false,
  };
  const [form, setForm] = useState<Omit<VideoItem, "id">>(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const startEdit = (item: VideoItem) => {
    setEditId(item.id);
    setForm({
      title: item.title,
      url: item.url,
      description: item.description,
      isFeatured: item.isFeatured,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(blank);
  };

  const saveItem = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.url.trim()) {
      toast.error("Video URL is required");
      return;
    }
    if (editId) {
      onSave(items.map((v) => (v.id === editId ? { ...form, id: editId } : v)));
      toast.success("Video updated");
    } else {
      onSave([...items, { ...form, id: uid() }]);
      toast.success("Video added");
    }
    setEditId(null);
    setForm(blank);
  };

  const deleteItem = (id: string) => {
    onSave(items.filter((v) => v.id !== id));
    toast.success("Video deleted");
  };

  const sorted = [...items].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return 0;
  });

  const previewThumb = getYoutubeThumbnail(form.url);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg"
            data-ocid="classroom.videos.empty_state"
          >
            No videos yet. Add one below.
          </p>
        )}
        {sorted.map((item, i) => {
          const thumb = getYoutubeThumbnail(item.url);
          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex gap-3"
              data-ocid={`classroom.videos.item.${i + 1}`}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={item.title}
                  className="w-20 h-14 object-cover rounded-lg shrink-0 border border-border"
                />
              ) : (
                <div className="w-20 h-14 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border">
                  <Video className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  {item.isFeatured && (
                    <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <p className="font-semibold text-sm text-foreground truncate">
                    {item.title}
                  </p>
                  {item.isFeatured && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs shrink-0">
                      Featured
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {item.description}
                  </p>
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Video
                </a>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => startEdit(item)}
                  data-ocid={`classroom.videos.edit_button.${i + 1}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteItem(item.id)}
                  data-ocid={`classroom.videos.delete_button.${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-primary" />
          {editId ? "Edit Video" : "Add Video Lecture"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="vid-title" className="text-xs">
            Title
          </Label>
          <Input
            id="vid-title"
            placeholder="e.g. Surgical Emergencies — Lecture"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            data-ocid="classroom.videos.title.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vid-url" className="text-xs">
            Video URL (YouTube / Vimeo)
          </Label>
          <Input
            id="vid-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            data-ocid="classroom.videos.url.input"
          />
        </div>
        {/* Live thumbnail preview */}
        {form.url && (
          <div className="rounded-lg overflow-hidden border border-border w-40">
            {previewThumb ? (
              <img
                src={previewThumb}
                alt="Thumbnail preview"
                className="w-full object-cover"
              />
            ) : (
              <div className="w-full h-24 bg-muted/40 flex items-center justify-center">
                <p className="text-xs text-muted-foreground text-center px-2">
                  Preview unavailable for this URL
                </p>
              </div>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="vid-desc" className="text-xs">
            Description (optional)
          </Label>
          <Textarea
            id="vid-desc"
            placeholder="Brief description of the video..."
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="min-h-[60px]"
            data-ocid="classroom.videos.description.textarea"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="vid-featured"
            checked={form.isFeatured}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isFeatured: !!v }))}
            data-ocid="classroom.videos.featured.checkbox"
          />
          <Label htmlFor="vid-featured" className="text-sm cursor-pointer">
            Feature this video (shown at top)
          </Label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={saveItem}
            data-ocid="classroom.videos.save_button"
          >
            <Save className="w-3.5 h-3.5" />
            {editId ? "Update" : "Add"}
          </Button>
          {editId && (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              data-ocid="classroom.videos.cancel_button"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Class Schedule
function ClassScheduleSection({
  items,
  onSave,
}: {
  items: ScheduleEntry[];
  onSave: (items: ScheduleEntry[]) => void;
}) {
  const blank: Omit<ScheduleEntry, "id"> = {
    day: "Monday",
    time: "08:00",
    subject: "",
    venue: "",
  };
  const [form, setForm] = useState<Omit<ScheduleEntry, "id">>(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const startEdit = (item: ScheduleEntry) => {
    setEditId(item.id);
    setForm({
      day: item.day,
      time: item.time,
      subject: item.subject,
      venue: item.venue,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(blank);
  };

  const saveItem = () => {
    if (!form.subject.trim()) {
      toast.error("Subject / topic is required");
      return;
    }
    if (editId) {
      onSave(items.map((s) => (s.id === editId ? { ...form, id: editId } : s)));
      toast.success("Schedule entry updated");
    } else {
      onSave([...items, { ...form, id: uid() }]);
      toast.success("Schedule entry added");
    }
    setEditId(null);
    setForm(blank);
  };

  const deleteItem = (id: string) => {
    onSave(items.filter((s) => s.id !== id));
    toast.success("Schedule entry deleted");
  };

  const dayOrder = (d: string) => DAYS.indexOf(d);
  const sorted = [...items].sort(
    (a, b) => dayOrder(a.day) - dayOrder(b.day) || a.time.localeCompare(b.time),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg"
            data-ocid="classroom.schedule.empty_state"
          >
            No classes scheduled yet. Add one below.
          </p>
        )}
        {sorted.map((item, i) => (
          <div
            key={item.id}
            className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
            data-ocid={`classroom.schedule.item.${i + 1}`}
          >
            <div className="shrink-0 text-center bg-primary/10 rounded-lg px-2.5 py-1.5 min-w-[64px]">
              <p className="text-xs font-bold text-primary">
                {item.day.slice(0, 3).toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {item.time}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">
                {item.subject}
              </p>
              {item.venue && (
                <p className="text-xs text-muted-foreground">{item.venue}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => startEdit(item)}
                data-ocid={`classroom.schedule.edit_button.${i + 1}`}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => deleteItem(item.id)}
                data-ocid={`classroom.schedule.delete_button.${i + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-primary" />
          {editId ? "Edit Class" : "Add Class"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Day</Label>
            <Select
              value={form.day}
              onValueChange={(v) => setForm((f) => ({ ...f, day: v }))}
            >
              <SelectTrigger data-ocid="classroom.schedule.day.select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-time" className="text-xs">
              Time
            </Label>
            <Input
              id="class-time"
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              data-ocid="classroom.schedule.time.input"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="class-subject" className="text-xs">
            Subject / Topic
          </Label>
          <Input
            id="class-subject"
            placeholder="e.g. Clinical Surgery — Ward Round"
            value={form.subject}
            onChange={(e) =>
              setForm((f) => ({ ...f, subject: e.target.value }))
            }
            data-ocid="classroom.schedule.subject.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="class-venue" className="text-xs">
            Venue / Location
          </Label>
          <Input
            id="class-venue"
            placeholder="e.g. Lecture Hall A"
            value={form.venue}
            onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            data-ocid="classroom.schedule.venue.input"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={saveItem}
            data-ocid="classroom.schedule.save_button"
          >
            <Save className="w-3.5 h-3.5" />
            {editId ? "Update" : "Add"}
          </Button>
          {editId && (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              data-ocid="classroom.schedule.cancel_button"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * ClassroomSettings — shown only to Consultant Doctors in the Settings page.
 * Derives the doctor's DoctorKey from their email and persists via useDoctorContent.
 */
export function ClassroomSettings({ doctorEmail }: { doctorEmail: string }) {
  const { getContent, updateField } = useDoctorContent();

  // Derive doctorKey from email
  const doctorKey: DoctorKey =
    doctorEmail === "samiashikder33@gmail.com" ? "samia" : "arman";

  const content = getContent(doctorKey);
  const classroom = content.classroom ?? {};

  const announcements: Announcement[] = (classroom.announcements ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any, i: number) => ({
      id: a.id ?? `legacy_ann_${i}`,
      title: a.title ?? "",
      body: a.body ?? "",
      date: a.date ?? "",
      isPinned: a.isPinned ?? false,
    }),
  );

  const notes: LectureNote[] = (classroom.notes ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n: any, i: number) => ({
      id: n.id ?? `legacy_note_${i}`,
      title: n.title ?? "",
      description: n.description ?? "",
      link: n.link ?? "",
      pdfLink: n.pdfLink ?? "",
      datePublished: n.datePublished ?? "",
    }),
  );

  const videos: VideoItem[] = (classroom.videos ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (v: any, i: number) => ({
      id: v.id ?? `legacy_vid_${i}`,
      title: v.title ?? "",
      url: v.url ?? "",
      description: v.description ?? "",
      isFeatured: v.isFeatured ?? false,
    }),
  );

  const schedule: ScheduleEntry[] = (classroom.schedule ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any, i: number) => ({
      id: s.id ?? `legacy_sched_${i}`,
      day: s.day ?? "Monday",
      time: s.time ?? "",
      subject: s.subject ?? "",
      venue: s.venue ?? "",
    }),
  );

  const gallery: ClassroomGalleryImage[] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((classroom.gallery ?? []) as any[]).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g: any, i: number) => ({
        id: g.id ?? `legacy_gal_${i}`,
        dataUrl: g.dataUrl ?? "",
        caption: g.caption ?? "",
        category: g.category ?? "",
      }),
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          My Classroom
        </CardTitle>
        <CardDescription>
          Manage announcements, lecture notes, video lectures, class schedule,
          and picture gallery for your public classroom page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="announcements" data-ocid="classroom.tab">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1 mb-4">
            <TabsTrigger
              value="announcements"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="classroom.announcements.tab"
            >
              <Bell className="w-3.5 h-3.5" />
              Announcements
              {announcements.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 text-xs py-0 px-1.5">
                  {announcements.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="classroom.notes.tab"
            >
              <FileText className="w-3.5 h-3.5" />
              Lecture Notes
              {notes.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 text-xs py-0 px-1.5">
                  {notes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="videos"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="classroom.videos.tab"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              Videos
              {videos.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 text-xs py-0 px-1.5">
                  {videos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="classroom.schedule.tab"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule
              {schedule.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 text-xs py-0 px-1.5">
                  {schedule.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="gallery"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
              data-ocid="classroom.gallery.tab"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Gallery
              {gallery.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 text-xs py-0 px-1.5">
                  {gallery.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements">
            <AnnouncementsSection
              items={announcements}
              onSave={(updated) =>
                updateField(doctorKey, "classroom.announcements", updated)
              }
            />
          </TabsContent>

          <TabsContent value="notes">
            <LectureNotesSection
              items={notes}
              onSave={(updated) =>
                updateField(doctorKey, "classroom.notes", updated)
              }
            />
          </TabsContent>

          <TabsContent value="videos">
            <VideoLecturesSection
              items={videos}
              onSave={(updated) =>
                updateField(doctorKey, "classroom.videos", updated)
              }
            />
          </TabsContent>

          <TabsContent value="schedule">
            <ClassScheduleSection
              items={schedule}
              onSave={(updated) =>
                updateField(doctorKey, "classroom.schedule", updated)
              }
            />
          </TabsContent>

          <TabsContent value="gallery">
            <ClassroomGallerySection
              items={gallery}
              onSave={(updated) =>
                updateField(doctorKey, "classroom.gallery", updated)
              }
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
