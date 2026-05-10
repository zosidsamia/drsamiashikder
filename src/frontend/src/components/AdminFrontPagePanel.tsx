import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  AboutSection,
  EmergencyContact,
  FooterSection,
  HeroSection,
  SiteConfig,
  SocialLink,
} from "@/hooks/useSiteConfig";
import { DEFAULT_SITE_CONFIG } from "@/hooks/useSiteConfig";
import {
  Megaphone,
  MinusCircle,
  Pencil,
  Phone,
  PlusCircle,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  config: SiteConfig;
  updateHero: (h: Partial<HeroSection>) => void;
  updateAbout: (a: Partial<AboutSection>) => void;
  updateFooter: (f: Partial<FooterSection>) => void;
  updateEmergencyContacts: (c: EmergencyContact[]) => void;
  resetSection: (s: keyof SiteConfig) => void;
}

// ──── Hero Tab ────────────────────────────────────────────────────────────────
function HeroTab({
  config,
  updateHero,
  resetSection,
}: Pick<Props, "config" | "updateHero" | "resetSection">) {
  const h = config.heroSection;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Hero section text and CTAs
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-xs"
          onClick={() => {
            resetSection("heroSection");
            toast.success("Hero reset to default.");
          }}
          data-ocid="admin_panel.hero.reset_button"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tagline (English)</Label>
        <Textarea
          rows={2}
          value={h.taglineEn}
          onChange={(e) => updateHero({ taglineEn: e.target.value })}
          data-ocid="admin_panel.hero.tagline_en.textarea"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tagline (Bangla)</Label>
        <Textarea
          rows={2}
          value={h.taglineBn}
          onChange={(e) => updateHero({ taglineBn: e.target.value })}
          style={{ fontFamily: "'Noto Sans Bengali', Arial, sans-serif" }}
          data-ocid="admin_panel.hero.tagline_bn.textarea"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subheading (English)</Label>
        <Input
          value={h.subheadingEn}
          onChange={(e) => updateHero({ subheadingEn: e.target.value })}
          data-ocid="admin_panel.hero.subheading_en.input"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subheading (Bangla)</Label>
        <Input
          value={h.subheadingBn}
          onChange={(e) => updateHero({ subheadingBn: e.target.value })}
          style={{ fontFamily: "'Noto Sans Bengali', Arial, sans-serif" }}
          data-ocid="admin_panel.hero.subheading_bn.input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">CTA 1 Label</Label>
          <Input
            value={h.cta1Label}
            onChange={(e) => updateHero({ cta1Label: e.target.value })}
            data-ocid="admin_panel.hero.cta1.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA 2 Label</Label>
          <Input
            value={h.cta2Label}
            onChange={(e) => updateHero({ cta2Label: e.target.value })}
            data-ocid="admin_panel.hero.cta2.input"
          />
        </div>
      </div>
    </div>
  );
}

// ──── About Tab ───────────────────────────────────────────────────────────────
function AboutTab({
  config,
  updateAbout,
  resetSection,
}: Pick<Props, "config" | "updateAbout" | "resetSection">) {
  const a = config.aboutSection;
  const [newSpec, setNewSpec] = useState("");
  const [newAffil, setNewAffil] = useState("");

  const addSpecialty = () => {
    if (!newSpec.trim()) return;
    updateAbout({ specialties: [...a.specialties, newSpec.trim()] });
    setNewSpec("");
  };
  const removeSpecialty = (i: number) => {
    updateAbout({ specialties: a.specialties.filter((_, idx) => idx !== i) });
  };
  const addAffil = () => {
    if (!newAffil.trim()) return;
    updateAbout({ affiliations: [...a.affiliations, newAffil.trim()] });
    setNewAffil("");
  };
  const removeAffil = (i: number) => {
    updateAbout({ affiliations: a.affiliations.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">About section content</p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={a.visible}
              onChange={(e) => updateAbout({ visible: e.target.checked })}
              className="rounded"
              data-ocid="admin_panel.about.visible.checkbox"
            />
            Show section
          </label>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={() => {
              resetSection("aboutSection");
              toast.success("About section reset.");
            }}
            data-ocid="admin_panel.about.reset_button"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Clinic Name (EN)</Label>
          <Input
            value={a.clinicNameEn}
            onChange={(e) => updateAbout({ clinicNameEn: e.target.value })}
            data-ocid="admin_panel.about.clinic_name_en.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Clinic Name (বাংলা)</Label>
          <Input
            value={a.clinicNameBn}
            onChange={(e) => updateAbout({ clinicNameBn: e.target.value })}
            style={{ fontFamily: "'Noto Sans Bengali', Arial, sans-serif" }}
            data-ocid="admin_panel.about.clinic_name_bn.input"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description (English)</Label>
        <Textarea
          rows={2}
          value={a.descriptionEn}
          onChange={(e) => updateAbout({ descriptionEn: e.target.value })}
          data-ocid="admin_panel.about.desc_en.textarea"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description (Bangla)</Label>
        <Textarea
          rows={2}
          value={a.descriptionBn}
          onChange={(e) => updateAbout({ descriptionBn: e.target.value })}
          style={{ fontFamily: "'Noto Sans Bengali', Arial, sans-serif" }}
          data-ocid="admin_panel.about.desc_bn.textarea"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Years Exp.</Label>
          <Input
            type="number"
            min={0}
            value={a.yearsExperience}
            onChange={(e) =>
              updateAbout({ yearsExperience: Number(e.target.value) })
            }
            data-ocid="admin_panel.about.years.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Patient Count</Label>
          <Input
            value={a.patientCount}
            onChange={(e) => updateAbout({ patientCount: e.target.value })}
            data-ocid="admin_panel.about.patients.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Doctors</Label>
          <Input
            type="number"
            min={1}
            value={a.doctorCount}
            onChange={(e) =>
              updateAbout({ doctorCount: Number(e.target.value) })
            }
            data-ocid="admin_panel.about.doctors.input"
          />
        </div>
      </div>

      {/* Specialties */}
      <div className="space-y-2">
        <Label className="text-xs">Specialties</Label>
        <div className="flex flex-wrap gap-1.5">
          {a.specialties.map((s, i) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full"
            >
              {s}
              <button
                type="button"
                onClick={() => removeSpecialty(i)}
                aria-label="Remove"
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newSpec}
            onChange={(e) => setNewSpec(e.target.value)}
            placeholder="Add specialty..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && addSpecialty()}
            data-ocid="admin_panel.about.specialty.input"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addSpecialty}
            data-ocid="admin_panel.about.specialty.add_button"
          >
            <PlusCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Affiliations */}
      <div className="space-y-2">
        <Label className="text-xs">Affiliations</Label>
        <div className="flex flex-wrap gap-1.5">
          {a.affiliations.map((af, i) => (
            <span
              key={af}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-100"
            >
              🏥 {af}
              <button
                type="button"
                onClick={() => removeAffil(i)}
                aria-label="Remove"
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newAffil}
            onChange={(e) => setNewAffil(e.target.value)}
            placeholder="Add affiliation..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && addAffil()}
            data-ocid="admin_panel.about.affil.input"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addAffil}
            data-ocid="admin_panel.about.affil.add_button"
          >
            <PlusCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──── Emergency Tab ───────────────────────────────────────────────────────────
function EmergencyTab({
  config,
  updateEmergencyContacts,
  resetSection,
}: Pick<Props, "config" | "updateEmergencyContacts" | "resetSection">) {
  const contacts = config.emergencyContacts;

  const update = (idx: number, field: keyof EmergencyContact, val: string) => {
    const updated = contacts.map((c, i) =>
      i === idx ? { ...c, [field]: val } : c,
    );
    updateEmergencyContacts(updated);
  };

  const addContact = () => {
    updateEmergencyContacts([
      ...contacts,
      { doctorName: "", whatsappNumber: "", prefilledMessage: "" },
    ]);
  };

  const removeContact = (idx: number) => {
    updateEmergencyContacts(contacts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Emergency WhatsApp contacts
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={addContact}
            data-ocid="admin_panel.emergency.add_button"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={() => {
              resetSection("emergencyContacts");
              toast.success("Emergency contacts reset.");
            }}
            data-ocid="admin_panel.emergency.reset_button"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>
      </div>

      {contacts.map((c, idx) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: admin-only panel, order doesn't change dynamically
          key={idx}
          className="border border-border rounded-xl p-3 space-y-2 relative"
          data-ocid={`admin_panel.emergency.item.${idx + 1}`}
        >
          <button
            type="button"
            onClick={() => removeContact(idx)}
            className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10"
            aria-label="Remove contact"
            data-ocid={`admin_panel.emergency.delete_button.${idx + 1}`}
          >
            <MinusCircle className="w-4 h-4 text-destructive" />
          </button>
          <div className="space-y-1.5">
            <Label className="text-xs">Doctor Name</Label>
            <Input
              value={c.doctorName}
              onChange={(e) => update(idx, "doctorName", e.target.value)}
              placeholder="Dr. Name"
              className="h-8 text-xs"
              data-ocid={`admin_panel.emergency.name.input.${idx + 1}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              WhatsApp Number (international, no +)
            </Label>
            <Input
              value={c.whatsappNumber}
              onChange={(e) => update(idx, "whatsappNumber", e.target.value)}
              placeholder="8801XXXXXXXXX"
              className="h-8 text-xs"
              data-ocid={`admin_panel.emergency.number.input.${idx + 1}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pre-filled Message</Label>
            <Input
              value={c.prefilledMessage}
              onChange={(e) => update(idx, "prefilledMessage", e.target.value)}
              placeholder="Hello Doctor..."
              className="h-8 text-xs"
              data-ocid={`admin_panel.emergency.msg.input.${idx + 1}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ──── Footer Tab ──────────────────────────────────────────────────────────────
function FooterTab({
  config,
  updateFooter,
  resetSection,
}: Pick<Props, "config" | "updateFooter" | "resetSection">) {
  const f = config.footerSection;
  const [newLink, setNewLink] = useState<SocialLink>({
    label: "",
    url: "",
    icon: "🔗",
  });

  const addLink = () => {
    if (!newLink.label.trim() || !newLink.url.trim()) return;
    updateFooter({ socialLinks: [...f.socialLinks, { ...newLink }] });
    setNewLink({ label: "", url: "", icon: "🔗" });
  };

  const removeLink = (i: number) => {
    updateFooter({ socialLinks: f.socialLinks.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Footer text and links</p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-xs"
          onClick={() => {
            resetSection("footerSection");
            toast.success("Footer reset.");
          }}
          data-ocid="admin_panel.footer.reset_button"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Address (English)</Label>
          <Input
            value={f.addressEn}
            onChange={(e) => updateFooter({ addressEn: e.target.value })}
            data-ocid="admin_panel.footer.address_en.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Address (Bangla)</Label>
          <Input
            value={f.addressBn}
            onChange={(e) => updateFooter({ addressBn: e.target.value })}
            style={{ fontFamily: "'Noto Sans Bengali', Arial, sans-serif" }}
            data-ocid="admin_panel.footer.address_bn.input"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input
            value={f.phone}
            onChange={(e) => updateFooter({ phone: e.target.value })}
            data-ocid="admin_panel.footer.phone.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={f.email}
            onChange={(e) => updateFooter({ email: e.target.value })}
            data-ocid="admin_panel.footer.email.input"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Opening Hours</Label>
        <Input
          value={f.openingHours}
          onChange={(e) => updateFooter({ openingHours: e.target.value })}
          placeholder="e.g. Sat–Thu: 9 AM – 8 PM"
          data-ocid="admin_panel.footer.hours.input"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Copyright Text</Label>
        <Input
          value={f.copyrightText}
          onChange={(e) => updateFooter({ copyrightText: e.target.value })}
          data-ocid="admin_panel.footer.copyright.input"
        />
      </div>

      {/* Social Links */}
      <div className="space-y-2">
        <Label className="text-xs">Social / Quick Links</Label>
        {f.socialLinks.map((link, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: social links list in admin panel
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-base">{link.icon}</span>
            <span className="flex-1 truncate font-medium">{link.label}</span>
            <span className="text-muted-foreground truncate max-w-[120px]">
              {link.url}
            </span>
            <button
              type="button"
              onClick={() => removeLink(i)}
              aria-label="Remove"
              className="text-destructive hover:bg-destructive/10 p-1 rounded"
              data-ocid={`admin_panel.footer.social.delete.${i + 1}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Input
            value={newLink.icon}
            onChange={(e) =>
              setNewLink((l) => ({ ...l, icon: e.target.value }))
            }
            placeholder="🔗"
            className="h-8 text-xs"
          />
          <Input
            value={newLink.label}
            onChange={(e) =>
              setNewLink((l) => ({ ...l, label: e.target.value }))
            }
            placeholder="Label"
            className="h-8 text-xs"
            data-ocid="admin_panel.footer.social_label.input"
          />
          <Input
            value={newLink.url}
            onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))}
            placeholder="https://..."
            className="h-8 text-xs"
            data-ocid="admin_panel.footer.social_url.input"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1 text-xs"
          onClick={addLink}
          data-ocid="admin_panel.footer.social.add_button"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Add Link
        </Button>
      </div>
    </div>
  );
}

// ──── Main Panel ──────────────────────────────────────────────────────────────
export default function AdminFrontPagePanel(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-50 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-2 font-semibold text-sm transition-all active:scale-95 md:bottom-6"
        data-ocid="admin_panel.open_modal_button"
        aria-label="Edit Front Page"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Edit Front Page</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-full sm:w-[420px] overflow-y-auto"
          data-ocid="admin_panel.sheet"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-600" />
              Edit Front Page
            </SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="hero" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="hero" data-ocid="admin_panel.hero.tab">
                Hero
              </TabsTrigger>
              <TabsTrigger value="about" data-ocid="admin_panel.about.tab">
                About
              </TabsTrigger>
              <TabsTrigger
                value="emergency"
                data-ocid="admin_panel.emergency.tab"
              >
                Emergency
              </TabsTrigger>
            </TabsList>
            <TabsList className="grid grid-cols-2 w-full mt-1">
              <TabsTrigger value="footer" data-ocid="admin_panel.footer.tab">
                Footer
              </TabsTrigger>
              <TabsTrigger
                value="testimonials"
                data-ocid="admin_panel.testimonials.tab"
              >
                Testimonials
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hero">
              <HeroTab
                config={props.config}
                updateHero={props.updateHero}
                resetSection={props.resetSection}
              />
            </TabsContent>
            <TabsContent value="about">
              <AboutTab
                config={props.config}
                updateAbout={props.updateAbout}
                resetSection={props.resetSection}
              />
            </TabsContent>
            <TabsContent value="emergency">
              <EmergencyTab
                config={props.config}
                updateEmergencyContacts={props.updateEmergencyContacts}
                resetSection={props.resetSection}
              />
            </TabsContent>
            <TabsContent value="footer">
              <FooterTab
                config={props.config}
                updateFooter={props.updateFooter}
                resetSection={props.resetSection}
              />
            </TabsContent>
            <TabsContent value="testimonials">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Megaphone className="w-4 h-4 shrink-0" />
                  <span>
                    Manage testimonials directly on the page — use the Add /
                    Edit / Delete controls in the Testimonials section below.
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(() => {
                      document
                        .getElementById("testimonials")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }, 300);
                  }}
                  data-ocid="admin_panel.testimonials.goto_button"
                >
                  Go to Testimonials Section
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(() => {
                      document
                        .getElementById("gallery")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }, 300);
                  }}
                  data-ocid="admin_panel.gallery.goto_button"
                >
                  Go to Gallery Section
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
