import { useCallback, useState } from "react";

export interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

export interface EmergencyContact {
  doctorName: string;
  whatsappNumber: string;
  prefilledMessage: string;
}

export interface HeroSection {
  taglineEn: string;
  taglineBn: string;
  subheadingEn: string;
  subheadingBn: string;
  cta1Label: string;
  cta2Label: string;
}

export interface AboutSection {
  visible: boolean;
  clinicNameEn: string;
  clinicNameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  yearsExperience: number;
  patientCount: string;
  doctorCount: number;
  specialties: string[];
  affiliations: string[];
}

export interface FooterSection {
  addressEn: string;
  addressBn: string;
  phone: string;
  email: string;
  openingHours: string;
  copyrightText: string;
  socialLinks: SocialLink[];
}

export interface SiteConfig {
  heroSection: HeroSection;
  aboutSection: AboutSection;
  footerSection: FooterSection;
  emergencyContacts: EmergencyContact[];
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  heroSection: {
    taglineEn: "Expert Medical Care — Book Your Appointment Today",
    taglineBn: "বিশেষজ্ঞ চিকিৎসা সেবা — আজই অ্যাপয়েন্টমেন্ট নিন",
    subheadingEn: "Compassionate, evidence-based care for your family's health",
    subheadingBn: "আপনার পরিবারের স্বাস্থ্যের জন্য সহানুভূতিশীল, বৈজ্ঞানিক চিকিৎসা",
    cta1Label: "Book Appointment",
    cta2Label: "Emergency",
  },
  aboutSection: {
    visible: true,
    clinicNameEn: "Dr. Arman Kabir's Care",
    clinicNameBn: "ডা. আরমান কবিরের চেম্বার",
    descriptionEn:
      "Comprehensive patient management and medical education serving patients and students across Bangladesh.",
    descriptionBn:
      "বাংলাদেশ জুড়ে রোগী ও শিক্ষার্থীদের জন্য পূর্ণাঙ্গ রোগী ব্যবস্থাপনা ও চিকিৎসা শিক্ষা।",
    yearsExperience: 10,
    patientCount: "500+",
    doctorCount: 2,
    specialties: [
      "Internal Medicine",
      "Respiratory Medicine",
      "Diabetes & Endocrinology",
      "General Practice",
    ],
    affiliations: [
      "BSMMU",
      "DMCH",
      "Dhaka Medical College",
      "National Institute of Diseases of Chest & Hospital",
    ],
  },
  footerSection: {
    addressEn: "Dhaka, Bangladesh",
    addressBn: "ঢাকা, বাংলাদেশ",
    phone: "+880-1751-959262",
    email: "dr.armankabir011@gmail.com",
    openingHours: "Sat–Thu: 9 AM – 8 PM",
    copyrightText: "Dr. Arman Kabir's Care. All rights reserved.",
    socialLinks: [],
  },
  emergencyContacts: [
    {
      doctorName: "Dr. Arman Kabir",
      whatsappNumber: "8801751959262",
      prefilledMessage: "Hello Dr. Arman, I need an emergency consultation.",
    },
    {
      doctorName: "Dr. Samia Shikder",
      whatsappNumber: "8801957212210",
      prefilledMessage: "Hello Dr. Samia, I need an emergency consultation.",
    },
  ],
};

const STORAGE_KEY = "siteConfig";

function deepMerge<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base } as T;
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const val = overrides[key];
    if (Array.isArray(val)) {
      (result as Record<string, unknown>)[key as string] = val;
    } else if (
      val !== null &&
      val !== undefined &&
      typeof val === "object" &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        result[key] as object,
        val as object,
      );
    } else if (val !== undefined) {
      (result as Record<string, unknown>)[key as string] = val;
    }
  }
  return result;
}

function loadConfig(): SiteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SITE_CONFIG;
    return deepMerge(
      DEFAULT_SITE_CONFIG,
      JSON.parse(raw) as Partial<SiteConfig>,
    );
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

function saveConfig(cfg: SiteConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>(loadConfig);

  const updateHero = useCallback((hero: Partial<HeroSection>) => {
    setConfig((prev) => {
      const next = { ...prev, heroSection: { ...prev.heroSection, ...hero } };
      saveConfig(next);
      return next;
    });
  }, []);

  const updateAbout = useCallback((about: Partial<AboutSection>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        aboutSection: { ...prev.aboutSection, ...about },
      };
      saveConfig(next);
      return next;
    });
  }, []);

  const updateFooter = useCallback((footer: Partial<FooterSection>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        footerSection: { ...prev.footerSection, ...footer },
      };
      saveConfig(next);
      return next;
    });
  }, []);

  const updateEmergencyContacts = useCallback(
    (contacts: EmergencyContact[]) => {
      setConfig((prev) => {
        const next = { ...prev, emergencyContacts: contacts };
        saveConfig(next);
        return next;
      });
    },
    [],
  );

  const resetSection = useCallback((section: keyof SiteConfig) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        [section]: DEFAULT_SITE_CONFIG[section],
      };
      saveConfig(next);
      return next;
    });
  }, []);

  return {
    config,
    updateHero,
    updateAbout,
    updateFooter,
    updateEmergencyContacts,
    resetSection,
  };
}
