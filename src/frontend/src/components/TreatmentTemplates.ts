// Treatment Templates — Common Bangladeshi clinical conditions
// Each template has diagnosis + array of drugs that can be bulk-inserted

export interface TreatmentDrug {
  route: string;
  name: string;
  nameType: "brand" | "generic";
  dose: string;
  duration: string;
  instructions: string;
}

export interface TreatmentTemplate {
  id: string;
  name: string;
  diagnosis: string;
  category: string;
  drugs: TreatmentDrug[];
  advice?: string[];
}

export const TREATMENT_TEMPLATES: TreatmentTemplate[] = [
  // RESPIRATORY
  {
    id: "tt1",
    name: "Upper Respiratory Tract Infection",
    diagnosis: "URTI / সর্দি-কাশি",
    category: "Respiratory",
    drugs: [
      {
        route: "PO",
        name: "Amoxicillin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "5 days",
        instructions: "After meal",
      },
      {
        route: "PO",
        name: "Paracetamol 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "5 days",
        instructions: "After meal (when needed)",
      },
      {
        route: "PO",
        name: "Cetirizine 10mg",
        nameType: "generic",
        dose: "10mg",
        duration: "5 days",
        instructions: "At night",
      },
    ],
    advice: ["পর্যাপ্ত বিশ্রাম নিন", "পর্যাপ্ত পানি পান করুন", "৭ দিন পর পুনরায় দেখান"],
  },
  {
    id: "tt2",
    name: "Acute Bronchitis",
    diagnosis: "Acute Bronchitis",
    category: "Respiratory",
    drugs: [
      {
        route: "PO",
        name: "Azithromycin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "3 days",
        instructions: "Once daily, empty stomach",
      },
      {
        route: "PO",
        name: "Salbutamol 4mg",
        nameType: "generic",
        dose: "4mg",
        duration: "5 days",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Ambroxol 30mg",
        nameType: "generic",
        dose: "30mg",
        duration: "7 days",
        instructions: "Three times daily after meal",
      },
    ],
    advice: ["ঠান্ডা ও ধুলা এড়িয়ে চলুন", "ধূমপান পরিহার করুন", "১৪ দিন পর পুনরায় দেখান"],
  },
  {
    id: "tt3",
    name: "Community-Acquired Pneumonia",
    diagnosis: "Pneumonia",
    category: "Respiratory",
    drugs: [
      {
        route: "PO",
        name: "Co-Amoxiclav 625mg",
        nameType: "generic",
        dose: "625mg",
        duration: "7 days",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Azithromycin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "5 days",
        instructions: "Once daily",
      },
      {
        route: "PO",
        name: "Paracetamol 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "5 days",
        instructions: "Three times daily when needed",
      },
    ],
    advice: [
      "পর্যাপ্ত বিশ্রাম নিন",
      "শ্বাসকষ্ট বাড়লে দ্রুত হাসপাতালে যান",
      "৭ দিন পর পুনরায় দেখান",
    ],
  },
  // GASTROINTESTINAL
  {
    id: "tt4",
    name: "Acute Gastroenteritis",
    diagnosis: "Gastroenteritis / পেটের পীড়া",
    category: "Gastrointestinal",
    drugs: [
      {
        route: "PO",
        name: "Metronidazole 400mg",
        nameType: "generic",
        dose: "400mg",
        duration: "5 days",
        instructions: "Three times daily after meal",
      },
      {
        route: "PO",
        name: "Domperidone 10mg",
        nameType: "generic",
        dose: "10mg",
        duration: "5 days",
        instructions: "Three times daily before meal",
      },
      {
        route: "PO",
        name: "ORS",
        nameType: "generic",
        dose: "1 sachet",
        duration: "3 days",
        instructions: "After each loose stool",
      },
    ],
    advice: ["প্রচুর পানি ও স্যালাইন পান করুন", "বাইরের খাবার এড়িয়ে চলুন", "হালকা খাবার খান"],
  },
  {
    id: "tt5",
    name: "Peptic Ulcer Disease",
    diagnosis: "Peptic Ulcer / গ্যাস্ট্রিক আলসার",
    category: "Gastrointestinal",
    drugs: [
      {
        route: "PO",
        name: "Omeprazole 20mg",
        nameType: "generic",
        dose: "20mg",
        duration: "4 weeks",
        instructions: "Once daily before breakfast",
      },
      {
        route: "PO",
        name: "Amoxicillin 1g",
        nameType: "generic",
        dose: "1g",
        duration: "7 days",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Clarithromycin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "7 days",
        instructions: "Twice daily after meal",
      },
    ],
    advice: [
      "তৈলাক্ত ও মশলাদার খাবার পরিহার করুন",
      "চা-কফি কম পান করুন",
      "১ মাস পর পুনরায় দেখান",
    ],
  },
  // FEVER & INFECTION
  {
    id: "tt6",
    name: "Typhoid Fever",
    diagnosis: "Typhoid / টাইফয়েড জ্বর",
    category: "Infection",
    drugs: [
      {
        route: "PO",
        name: "Ciprofloxacin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "10 days",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Paracetamol 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "7 days",
        instructions: "Three times daily when fever",
      },
    ],
    advice: [
      "বিছানায় সম্পূর্ণ বিশ্রাম নিন",
      "হালকা ও সহজপাচ্য খাবার খান",
      "জ্বর বাড়লে দ্রুত যোগাযোগ করুন",
    ],
  },
  {
    id: "tt7",
    name: "Dengue Fever",
    diagnosis: "Dengue / ডেঙ্গু জ্বর",
    category: "Infection",
    drugs: [
      {
        route: "PO",
        name: "Paracetamol 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "5 days",
        instructions: "Three times daily when fever",
      },
    ],
    advice: [
      "প্রচুর পানি পান করুন",
      "NSAIDs (Ibuprofen/Aspirin) সেবন করবেন না",
      "রক্তের CBC পরীক্ষা করুন",
      "জ্বর বাড়লে দ্রুত হাসপাতালে যান",
    ],
  },
  // DIABETES
  {
    id: "tt8",
    name: "Type 2 Diabetes (Initial)",
    diagnosis: "Type 2 Diabetes Mellitus / ডায়াবেটিস",
    category: "Diabetes",
    drugs: [
      {
        route: "PO",
        name: "Metformin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "Continue",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Glibenclamide 5mg",
        nameType: "generic",
        dose: "5mg",
        duration: "Continue",
        instructions: "Once daily before breakfast",
      },
    ],
    advice: [
      "নিয়মিত রক্তের সুগার পরীক্ষা করুন",
      "মিষ্টি খাবার ও কার্বোহাইড্রেট কমিয়ে খান",
      "প্রতিদিন ৩০ মিনিট হাঁটুন",
      "১ মাস পর পুনরায় দেখান",
    ],
  },
  // HYPERTENSION
  {
    id: "tt9",
    name: "Essential Hypertension",
    diagnosis: "Hypertension / উচ্চ রক্তচাপ",
    category: "Cardiovascular",
    drugs: [
      {
        route: "PO",
        name: "Amlodipine 5mg",
        nameType: "generic",
        dose: "5mg",
        duration: "Continue",
        instructions: "Once daily after meal",
      },
      {
        route: "PO",
        name: "Enalapril 5mg",
        nameType: "generic",
        dose: "5mg",
        duration: "Continue",
        instructions: "Once daily",
      },
    ],
    advice: [
      "নিয়মিত রক্তচাপ পরিমাপ করুন",
      "লবণ খাওয়া কমিয়ে দিন",
      "মানসিক চাপ এড়িয়ে চলুন",
      "১ মাস পর পুনরায় দেখান",
    ],
  },
  // PAIN
  {
    id: "tt10",
    name: "Musculoskeletal Pain",
    diagnosis: "Musculoskeletal Pain / ব্যথা",
    category: "Pain",
    drugs: [
      {
        route: "PO",
        name: "Diclofenac 50mg",
        nameType: "generic",
        dose: "50mg",
        duration: "5 days",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Omeprazole 20mg",
        nameType: "generic",
        dose: "20mg",
        duration: "5 days",
        instructions: "Once daily before meal (gastroprotection)",
      },
      {
        route: "Topical",
        name: "Diclofenac Gel",
        nameType: "generic",
        dose: "Apply locally",
        duration: "5 days",
        instructions: "Three times daily on affected area",
      },
    ],
    advice: [
      "আক্রান্ত স্থানে বিশ্রাম দিন",
      "গরম সেঁক দিতে পারেন",
      "পরিশ্রমের কাজ এড়িয়ে চলুন",
    ],
  },
  // SKIN
  {
    id: "tt11",
    name: "Allergic Dermatitis",
    diagnosis: "Allergic Dermatitis / এলার্জি",
    category: "Skin",
    drugs: [
      {
        route: "PO",
        name: "Cetirizine 10mg",
        nameType: "generic",
        dose: "10mg",
        duration: "7 days",
        instructions: "Once daily at night",
      },
      {
        route: "PO",
        name: "Prednisolone 10mg",
        nameType: "generic",
        dose: "10mg",
        duration: "5 days",
        instructions: "Once daily after breakfast",
      },
      {
        route: "Topical",
        name: "Hydrocortisone cream 1%",
        nameType: "generic",
        dose: "Apply thinly",
        duration: "7 days",
        instructions: "Twice daily on affected area",
      },
    ],
    advice: [
      "অ্যালার্জেন থেকে দূরে থাকুন",
      "ধূলো ও ধোঁয়া এড়িয়ে চলুন",
      "৭ দিন পর পুনরায় দেখান",
    ],
  },
  // UTI
  {
    id: "tt12",
    name: "Urinary Tract Infection",
    diagnosis: "UTI / মূত্রনালীর সংক্রমণ",
    category: "Urology",
    drugs: [
      {
        route: "PO",
        name: "Ciprofloxacin 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "5 days",
        instructions: "Twice daily after meal",
      },
      {
        route: "PO",
        name: "Phenazopyridine 200mg",
        nameType: "generic",
        dose: "200mg",
        duration: "2 days",
        instructions: "Three times daily after meal",
      },
    ],
    advice: [
      "প্রচুর পানি পান করুন",
      "পরিষ্কার-পরিচ্ছন্নতা বজায় রাখুন",
      "প্রস্রাব পরীক্ষা করুন (C/S)",
    ],
  },
];

const CUSTOM_KEY = "medicare_custom_treatment_templates";

export function getCustomTreatmentTemplates(): TreatmentTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Smart Clinical Templates (Dengue, DKA, Sepsis, Post-op added) ─────────────

const SMART_TEMPLATES: TreatmentTemplate[] = [
  {
    id: "smart_dka",
    name: "Diabetic Ketoacidosis (DKA)",
    diagnosis: "DKA / Diabetic Ketoacidosis",
    category: "Diabetes",
    drugs: [
      {
        route: "IV",
        name: "Normal Saline 0.9%",
        nameType: "generic",
        dose: "1 L",
        duration: "first hour",
        instructions: "IV infusion — fluid resuscitation",
      },
      {
        route: "IV",
        name: "Regular Insulin (Actrapid)",
        nameType: "brand",
        dose: "0.1 unit/kg/hr",
        duration: "until DKA resolved",
        instructions: "IV infusion — monitor glucose hourly",
      },
      {
        route: "IV",
        name: "Potassium Chloride (KCl)",
        nameType: "generic",
        dose: "20-40 mEq/L",
        duration: "as needed",
        instructions: "Add to IV fluid when K+ < 5.5 mEq/L",
      },
    ],
    advice: [
      "Monitor blood glucose hourly",
      "Check electrolytes every 2-4 hours",
      "Transition to S/C insulin when DKA resolved",
      "Identify and treat precipitating cause",
    ],
  },
  {
    id: "smart_sepsis",
    name: "Sepsis / Septicaemia",
    diagnosis: "Sepsis / সেপসিস",
    category: "Infectious",
    drugs: [
      {
        route: "IV",
        name: "Ceftriaxone 2g",
        nameType: "generic",
        dose: "2g",
        duration: "7-10 days",
        instructions: "Once daily IV — start within 1 hour of diagnosis",
      },
      {
        route: "IV",
        name: "Metronidazole 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "7 days",
        instructions: "8-hourly if abdominal source suspected",
      },
      {
        route: "IV",
        name: "Normal Saline 0.9%",
        nameType: "generic",
        dose: "30 mL/kg",
        duration: "first 3 hours",
        instructions: "IV fluid resuscitation bolus",
      },
      {
        route: "IV",
        name: "Paracetamol 1g",
        nameType: "generic",
        dose: "1g",
        duration: "as needed",
        instructions: "6-hourly for fever",
      },
    ],
    advice: [
      "Sepsis bundle: blood cultures before antibiotics",
      "Monitor urine output hourly",
      "Check lactate and repeat in 2h if >2 mmol/L",
      "Reassess antibiotic at 48-72h based on culture",
    ],
  },
  {
    id: "smart_postop",
    name: "Post-operative Day 1 (General Surgery)",
    diagnosis: "Post-op / Post-operative Care",
    category: "Surgical",
    drugs: [
      {
        route: "IV",
        name: "Ceftriaxone 1g",
        nameType: "generic",
        dose: "1g",
        duration: "3 days",
        instructions: "Once daily IV — prophylaxis",
      },
      {
        route: "IV",
        name: "Metronidazole 500mg",
        nameType: "generic",
        dose: "500mg",
        duration: "3 days",
        instructions: "8-hourly IV",
      },
      {
        route: "IV",
        name: "Ketorolac 30mg",
        nameType: "generic",
        dose: "30mg",
        duration: "2 days",
        instructions: "8-hourly IV — post-op analgesia",
      },
      {
        route: "IV",
        name: "Pantoprazole 40mg",
        nameType: "generic",
        dose: "40mg",
        duration: "5 days",
        instructions: "Once daily IV — GI protection",
      },
      {
        route: "IV",
        name: "Normal Saline 0.9%",
        nameType: "generic",
        dose: "125 mL/hr",
        duration: "as ordered",
        instructions: "IV maintenance fluid",
      },
    ],
    advice: [
      "Strict I/O chart monitoring",
      "Wound inspection daily",
      "Incentive spirometry every 2 hours (prevent atelectasis)",
      "Ambulate day 1 if stable",
      "Oral feeds when bowel sounds return",
    ],
  },
];

export function getAllTreatmentTemplates(): TreatmentTemplate[] {
  return [
    ...TREATMENT_TEMPLATES,
    ...SMART_TEMPLATES,
    ...getCustomTreatmentTemplates(),
  ];
}

export function saveTreatmentTemplate(template: TreatmentTemplate): void {
  const existing = getCustomTreatmentTemplates();
  const updated = [...existing.filter((t) => t.id !== template.id), template];
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
}

export function getTreatmentCategories(): string[] {
  const all = getAllTreatmentTemplates();
  return ["All", ...Array.from(new Set(all.map((t) => t.category)))];
}

export function searchTreatmentTemplates(query: string): TreatmentTemplate[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  return getAllTreatmentTemplates().filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.diagnosis.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q),
  );
}
