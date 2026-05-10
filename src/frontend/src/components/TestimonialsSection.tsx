import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Edit,
  MessageSquareQuote,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface Testimonial {
  id: string;
  patientName: string;
  quote: string;
  rating: number;
  date?: string;
}

const STORAGE_KEY = "testimonials";
const HEADING_KEY = "testimonialsHeading";

const DEFAULT_HEADING = "What Our Patients Say";

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    patientName: "Rahim Uddin",
    quote:
      "Dr. Arman Kabir's care is exceptional. He listened carefully and gave clear guidance. I feel much better now.",
    rating: 5,
    date: "2025-03-10",
  },
  {
    id: "t2",
    patientName: "Nasrin Begum",
    quote:
      "Dr. Samia is very kind and thorough. The clinic is clean and the staff is helpful. Highly recommend.",
    rating: 5,
    date: "2025-02-20",
  },
  {
    id: "t3",
    patientName: "Karim Hossain",
    quote:
      "Excellent service. The online booking is very easy and I got an appointment the same day.",
    rating: 4,
    date: "2025-01-15",
  },
];

function loadTestimonials(): Testimonial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Testimonial[]) : DEFAULT_TESTIMONIALS;
  } catch {
    return DEFAULT_TESTIMONIALS;
  }
}

function saveTestimonials(list: Testimonial[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadHeading(): string {
  return localStorage.getItem(HEADING_KEY) || DEFAULT_HEADING;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={`transition-colors ${
            onChange ? "cursor-pointer hover:scale-110" : "cursor-default"
          }`}
          aria-label={`Rate ${n} stars`}
        >
          <Star
            className={`w-4 h-4 ${
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const emptyForm = { patientName: "", quote: "", rating: 5, date: "" };

export default function TestimonialsSection({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const [testimonials, setTestimonials] =
    useState<Testimonial[]>(loadTestimonials);
  const [heading, setHeading] = useState(loadHeading);
  const [editHeading, setEditHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(heading);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const save = useCallback((list: Testimonial[]) => {
    saveTestimonials(list);
    setTestimonials(list);
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditId(t.id);
    setForm({
      patientName: t.patientName,
      quote: t.quote,
      rating: t.rating,
      date: t.date || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.patientName.trim() || !form.quote.trim()) {
      toast.error("Name and quote are required.");
      return;
    }
    if (editId) {
      const updated = testimonials.map((t) =>
        t.id === editId ? { ...t, ...form } : t,
      );
      save(updated);
      toast.success("Testimonial updated.");
    } else {
      const newT: Testimonial = {
        id: Date.now().toString(36),
        ...form,
      };
      save([...testimonials, newT]);
      toast.success("Testimonial added.");
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    save(testimonials.filter((t) => t.id !== id));
    toast.success("Testimonial removed.");
  };

  const saveHeading = () => {
    const h = headingDraft.trim() || DEFAULT_HEADING;
    localStorage.setItem(HEADING_KEY, h);
    setHeading(h);
    setEditHeading(false);
    toast.success("Heading updated.");
  };

  return (
    <section
      id="testimonials"
      className="py-16 px-4 sm:px-6 bg-blue-50/40 border-y border-blue-100"
      data-ocid="testimonials.section"
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
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <MessageSquareQuote className="w-5 h-5 text-amber-600" />
              </div>
              {editHeading ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={headingDraft}
                    onChange={(e) => setHeadingDraft(e.target.value)}
                    className="text-lg font-bold h-9 w-64"
                    data-ocid="testimonials.heading.input"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={saveHeading}
                    data-ocid="testimonials.heading.save_button"
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
                      data-ocid="testimonials.heading.edit_button"
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
                onClick={openAdd}
                className="gap-1.5"
                data-ocid="testimonials.add_button"
              >
                <Plus className="w-4 h-4" />
                Add Testimonial
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Real feedback from our patients.
          </p>
        </motion.div>

        {/* Cards */}
        {testimonials.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="testimonials.empty_state"
          >
            <MessageSquareQuote className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No testimonials yet.</p>
            {isAdmin && (
              <Button size="sm" className="mt-4" onClick={openAdd}>
                Add First Testimonial
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
                data-ocid={`testimonials.item.${idx + 1}`}
              >
                <Card className="h-full border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col h-full">
                    <StarRating value={t.rating} />
                    <blockquote className="mt-3 text-sm text-foreground/80 leading-relaxed flex-1 italic">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {t.patientName}
                        </p>
                        {t.date && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(t.date).toLocaleDateString("en-BD", {
                              year: "numeric",
                              month: "short",
                            })}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            aria-label="Edit"
                            data-ocid={`testimonials.edit_button.${idx + 1}`}
                          >
                            <Edit className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                            aria-label="Delete"
                            data-ocid={`testimonials.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !v && setDialogOpen(false)}
      >
        <DialogContent className="max-w-md" data-ocid="testimonials.dialog">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Testimonial" : "Add Testimonial"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Patient Name *</Label>
              <Input
                id="t-name"
                value={form.patientName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, patientName: e.target.value }))
                }
                placeholder="e.g. Rahim Uddin"
                data-ocid="testimonials.name.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-quote">Quote *</Label>
              <Textarea
                id="t-quote"
                value={form.quote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quote: e.target.value }))
                }
                placeholder="Patient's feedback..."
                rows={3}
                data-ocid="testimonials.quote.textarea"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <StarRating
                value={form.rating}
                onChange={(v) => setForm((f) => ({ ...f, rating: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Date (optional)</Label>
              <Input
                id="t-date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                data-ocid="testimonials.date.input"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                data-ocid="testimonials.cancel_button"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                data-ocid="testimonials.submit_button"
              >
                {editId ? "Save Changes" : "Add Testimonial"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
