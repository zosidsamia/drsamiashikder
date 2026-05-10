import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, Pencil, Trash2, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface GalleryPhoto {
  id: string;
  dataUrl: string;
  caption: string;
}

const STORAGE_KEY = "galleryPhotos";
const HEADING_KEY = "galleryHeading";
const DEFAULT_HEADING = "Our Clinic Gallery";

function loadPhotos(): GalleryPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GalleryPhoto[]) : [];
  } catch {
    return [];
  }
}

function savePhotos(photos: GalleryPhoto[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}

function loadHeading(): string {
  return localStorage.getItem(HEADING_KEY) || DEFAULT_HEADING;
}

export default function GallerySection({ isAdmin }: { isAdmin: boolean }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(loadPhotos);
  const [heading, setHeading] = useState(loadHeading);
  const [editHeading, setEditHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(heading);
  const [editCaptionId, setEditCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = useCallback((list: GalleryPhoto[]) => {
    savePhotos(list);
    setPhotos(list);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const readers: Promise<GalleryPhoto>[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              dataUrl: e.target?.result as string,
              caption: file.name.replace(/\.[^.]+$/, ""),
            });
          };
          reader.readAsDataURL(file);
        }),
      );
    }
    Promise.all(readers).then((newPhotos) => {
      const updated = [...photos, ...newPhotos];
      save(updated);
      setUploading(false);
      toast.success(`${newPhotos.length} photo(s) uploaded.`);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = (id: string) => {
    save(photos.filter((p) => p.id !== id));
    toast.success("Photo removed.");
  };

  const startEditCaption = (p: GalleryPhoto) => {
    setEditCaptionId(p.id);
    setCaptionDraft(p.caption);
  };

  const saveCaption = (id: string) => {
    save(
      photos.map((p) => (p.id === id ? { ...p, caption: captionDraft } : p)),
    );
    setEditCaptionId(null);
    toast.success("Caption updated.");
  };

  const saveHeading = () => {
    const h = headingDraft.trim() || DEFAULT_HEADING;
    localStorage.setItem(HEADING_KEY, h);
    setHeading(h);
    setEditHeading(false);
    toast.success("Gallery heading updated.");
  };

  return (
    <section
      id="gallery"
      className="py-16 px-4 sm:px-6"
      data-ocid="gallery.section"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              {editHeading ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={headingDraft}
                    onChange={(e) => setHeadingDraft(e.target.value)}
                    className="text-lg font-bold h-9 w-64"
                    data-ocid="gallery.heading.input"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={saveHeading}
                    data-ocid="gallery.heading.save_button"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditHeading(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {heading}
                  </h2>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeadingDraft(heading);
                        setEditHeading(true);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label="Edit heading"
                      data-ocid="gallery.heading.edit_button"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-ocid="gallery.upload_button"
              >
                <Upload className="w-4 h-4" />
                Upload Photos
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            A glimpse of our clinic and facilities.
          </p>
        </motion.div>

        {/* Hidden file input */}
        {isAdmin && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        )}

        {/* Drop zone or grid */}
        {photos.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (isAdmin && (e.key === "Enter" || e.key === " "))
                fileInputRef.current?.click();
            }}
            role={isAdmin ? "button" : undefined}
            tabIndex={isAdmin ? 0 : undefined}
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors ${
              isAdmin
                ? "border-primary/30 hover:border-primary/60 cursor-pointer"
                : "border-muted"
            }`}
            onClick={() => isAdmin && fileInputRef.current?.click()}
            data-ocid="gallery.empty_state"
          >
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            {isAdmin ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Drop photos here or click to upload
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  JPEG, PNG, WebP supported
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No photos yet.</p>
            )}
          </div>
        ) : (
          <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo, idx) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  data-ocid={`gallery.item.${idx + 1}`}
                >
                  <img
                    src={photo.dataUrl}
                    alt={photo.caption || `Gallery photo ${idx + 1}`}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />
                  {/* Caption */}
                  <div className="bg-background/90 px-3 py-2">
                    {isAdmin && editCaptionId === photo.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={captionDraft}
                          onChange={(e) => setCaptionDraft(e.target.value)}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveCaption(photo.id);
                            if (e.key === "Escape") setEditCaptionId(null);
                          }}
                          data-ocid={`gallery.caption.input.${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => saveCaption(photo.id)}
                          className="p-1 rounded hover:bg-muted"
                          aria-label="Save caption"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditCaptionId(null)}
                          className="p-1 rounded hover:bg-muted"
                          aria-label="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {photo.caption || ""}
                        </p>
                        {isAdmin && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEditCaption(photo)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              aria-label="Edit caption"
                              data-ocid={`gallery.edit_button.${idx + 1}`}
                            >
                              <Pencil className="w-3 h-3 text-primary" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(photo.id)}
                              className="p-1 rounded hover:bg-destructive/10 transition-colors"
                              aria-label="Delete photo"
                              data-ocid={`gallery.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {/* Upload tile for admin */}
              {isAdmin && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-2 border-dashed border-primary/30 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  data-ocid="gallery.add_more.button"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs font-medium">Add more</span>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
