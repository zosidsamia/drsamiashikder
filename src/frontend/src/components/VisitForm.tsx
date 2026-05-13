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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { getDoctorEmail, loadFromStorage } from "@/hooks/useQueries";
import {
  Activity,
  CheckCircle,
  Heart,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FamilyHistoryRisk } from "../types";
import CardiovascularExam from "./CardiovascularExam";
import GastrointestinalExam from "./GastrointestinalExam";
import MusculoskeletalExam from "./MusculoskeletalExam";
import NeurologicalExam from "./NeurologicalExam";
import PreviousInvestigationTable, {
  type InvestigationRow,
} from "./PreviousInvestigationTable";
import QuestionStepper from "./QuestionStepper";
import RespiratoryExam from "./RespiratoryExam";
import {
  loadFamilyHistoryRisk,
  saveFamilyHistoryRisk,
} from "./patientDashboardTypes";

// ─── Examination Quick-fill Templates ─────────────────────────────────────────

type ExamTemplateRow = { finding: string; value: string };

const EXAM_TEMPLATES: Record<string, ExamTemplateRow[]> = {
  Cardiology: [
    { finding: "Heart Rate", value: "Normal" },
    { finding: "JVP", value: "Normal" },
    { finding: "Heart Sounds", value: "S1+S2+0" },
    { finding: "Precordial", value: "No thrill, no heave, apex normal" },
    { finding: "Peripheral Pulses", value: "Equal bilaterally" },
  ],
  Respiratory: [
    { finding: "Breath Sounds", value: "Vesicular" },
    { finding: "Crackles", value: "None" },
    { finding: "Wheeze", value: "None" },
    { finding: "Respiratory Rate", value: "Normal" },
    { finding: "Chest Expansion", value: "Equal" },
  ],
  GI: [
    { finding: "Bowel Sounds", value: "Present" },
    { finding: "Palpation", value: "Soft" },
    { finding: "Liver Edge", value: "Not palpable" },
    { finding: "Spleen", value: "Not palpable" },
    { finding: "Tenderness", value: "None" },
  ],
};

// ─── Data constants ───────────────────────────────────────────────────────────

const BADGE_PALETTE = [
  {
    base: "bg-blue-100 text-blue-800 border-blue-300",
    active: "bg-blue-500 text-white",
  },
  {
    base: "bg-green-100 text-green-800 border-green-300",
    active: "bg-green-500 text-white",
  },
  {
    base: "bg-amber-100 text-amber-800 border-amber-300",
    active: "bg-amber-500 text-white",
  },
  {
    base: "bg-purple-100 text-purple-800 border-purple-300",
    active: "bg-purple-500 text-white",
  },
  {
    base: "bg-rose-100 text-rose-800 border-rose-300",
    active: "bg-rose-500 text-white",
  },
  {
    base: "bg-cyan-100 text-cyan-800 border-cyan-300",
    active: "bg-cyan-500 text-white",
  },
  {
    base: "bg-orange-100 text-orange-800 border-orange-300",
    active: "bg-orange-500 text-white",
  },
  {
    base: "bg-teal-100 text-teal-800 border-teal-300",
    active: "bg-teal-500 text-white",
  },
  {
    base: "bg-indigo-100 text-indigo-800 border-indigo-300",
    active: "bg-indigo-500 text-white",
  },
  {
    base: "bg-lime-100 text-lime-800 border-lime-300",
    active: "bg-lime-600 text-white",
  },
];

const systemReviewData: Record<string, string[]> = {
  Cardiovascular: [
    "Chest pain",
    "Palpitations",
    "Shortness of breath",
    "Leg swelling",
    "Syncope",
  ],
  Respiratory: [
    "Cough",
    "Shortness of breath",
    "Wheezing",
    "Hemoptysis",
    "Chest pain",
  ],
  Gastrointestinal: [
    "Abdominal pain",
    "Nausea",
    "Vomiting",
    "Diarrhea",
    "Constipation",
    "Blood in stool",
  ],
  Genitourinary: [
    "Dysuria",
    "Frequency",
    "Hematuria",
    "Incontinence",
    "Urgency",
  ],
  Neurological: [
    "Headache",
    "Dizziness",
    "Seizures",
    "Weakness",
    "Numbness",
    "Vision changes",
  ],
  Musculoskeletal: [
    "Joint pain",
    "Muscle pain",
    "Back pain",
    "Stiffness",
    "Swelling",
  ],
  Endocrine: [
    "Heat/cold intolerance",
    "Weight changes",
    "Excessive thirst",
    "Frequent urination",
  ],
  Psychiatric: ["Depression", "Anxiety", "Sleep disturbances", "Mood changes"],
};

const medicalHistoryOptions = [
  "DM",
  "HTN",
  "Asthma",
  "IHD",
  "CKD",
  "COPD",
  "TB",
  "Cancer",
];

const surgicalHistoryQuestions = [
  { q: "Any previous surgeries?", options: ["Yes", "No"] },
  { q: "Type of surgery / সার্জারির ধরন", options: [] },
  { q: "When was it done? / কখন হয়েছিল?", options: [] },
  { q: "Any complications? / কোনো জটিলতা?", options: ["No", "Yes - specify"] },
];

const personalHistoryQuestions = [
  {
    q: "Smoking status / ধূমপানের অবস্থা",
    options: ["Non-smoker", "Current smoker", "Ex-smoker"],
  },
  {
    q: "Alcohol consumption / অ্যালকোহল সেবন",
    options: ["None", "Occasional", "Regular"],
  },
  { q: "Diet / খাদ্যাভ্যাস", options: ["Regular", "Vegetarian", "Irregular"] },
  { q: "Occupation / পেশা", options: [] },
  { q: "Exercise / ব্যায়াম", options: ["None", "Light", "Moderate", "Regular"] },
];

const familyHistoryQuestions = [
  {
    q: "Any family history of diabetes? / পরিবারে ডায়াবেটিস?",
    options: [
      "No",
      "Yes - Father",
      "Yes - Mother",
      "Yes - Sibling",
      "Yes - Other",
    ],
  },
  {
    q: "Any family history of hypertension? / পরিবারে উচ্চ রক্তচাপ?",
    options: [
      "No",
      "Yes - Father",
      "Yes - Mother",
      "Yes - Sibling",
      "Yes - Other",
    ],
  },
  {
    q: "Any family history of heart disease? / পরিবারে হৃদরোগ?",
    options: ["No", "Yes - specify"],
  },
  {
    q: "Any family history of cancer? / পরিবারে ক্যান্সার?",
    options: ["No", "Yes - specify"],
  },
];

const immunizationQuestions = [
  { q: "BCG vaccination / বিসিজি টিকা", options: ["Yes", "No", "Unknown"] },
  {
    q: "COVID-19 vaccination / কোভিড-১৯ টিকা",
    options: [
      "Not vaccinated",
      "Partially vaccinated",
      "Fully vaccinated",
      "Booster received",
    ],
  },
  {
    q: "Tetanus toxoid / টিটেনাস টক্সয়েড",
    options: ["Up to date", "Not sure", "Not received"],
  },
  { q: "Other vaccinations / অন্যান্য টিকা", options: [] },
];

const allergyQuestions = [
  { q: "Any drug allergies? / ওষুধে এলার্জি?", options: ["No", "Yes - specify"] },
  { q: "Any food allergies? / খাবারে এলার্জি?", options: ["No", "Yes - specify"] },
  {
    q: "Environmental allergies? / পরিবেশগত এলার্জি?",
    options: ["No", "Dust", "Pollen", "Animal dander", "Other"],
  },
  {
    q: "Type of reaction / প্রতিক্রিয়ার ধরন",
    options: ["Rash", "Swelling", "Breathing difficulty", "Other"],
  },
];

const obstetricQuestions = [
  { q: "Gravida (Total pregnancies) / মোট গর্ভধারণ", options: [] },
  { q: "Para (Live births) / জীবিত সন্তান", options: [] },
  { q: "Abortion (Miscarriages) / গর্ভপাত", options: [] },
  { q: "Last menstrual period (LMP) / শেষ মাসিকের তারিখ", options: [] },
  {
    q: "Any pregnancy complications? / গর্ভাবস্থায় জটিলতা?",
    options: ["No", "Yes - specify"],
  },
];

const gynaecologicalQuestions = [
  {
    q: "Menstrual cycle regularity / মাসিকের নিয়মিততা",
    options: ["Regular", "Irregular"],
  },
  {
    q: "Duration of period / মাসিকের সময়কাল",
    options: ["3-5 days", "5-7 days", "> 7 days"],
  },
  {
    q: "Menstrual pain / মাসিকের ব্যথা",
    options: ["None", "Mild", "Moderate", "Severe"],
  },
  { q: "Age at menarche / প্রথম মাসিকের বয়স", options: [] },
  {
    q: "Menopause status / মেনোপজের অবস্থা",
    options: [
      "Premenopausal",
      "Perimenopausal",
      "Postmenopausal",
      "Not applicable",
    ],
  },
];

const generalExaminationCategories: Record<string, string[]> = {
  Appearance: ["Well", "Ill-looking", "Distressed", "Toxic"],
  "Body Build": ["Normal", "Obese", "Thin", "Cachexic"],
  Nutrition: ["Well-nourished", "Malnourished", "Overweight"],
  Cooperation: ["Cooperative", "Uncooperative", "Agitated", "Confused"],
  Dehydration: ["Not dehydrated", "Mild", "Moderate", "Severe"],
  Edema: [
    "Absent",
    "Pedal edema",
    "Facial edema",
    "Generalized",
    "Pitting",
    "Non-pitting",
  ],
  Anemia: ["No pallor", "Mild pallor", "Moderate pallor", "Severe pallor"],
  Jaundice: ["Absent", "Mild icterus", "Moderate icterus", "Severe icterus"],
  Cyanosis: ["Absent", "Central", "Peripheral", "Both"],
  Clubbing: ["Absent", "Grade 1", "Grade 2", "Grade 3", "Grade 4"],
  Koilonychia: ["Absent", "Present"],
  "Lymph nodes": [
    "Not palpable",
    "Cervical enlarged",
    "Axillary enlarged",
    "Inguinal enlarged",
    "Generalized lymphadenopathy",
  ],
  "Thyroid gland": [
    "Not palpable",
    "Palpable - normal",
    "Enlarged - diffuse",
    "Enlarged - nodular",
  ],
};

const commonComplaints: Record<string, { q: string; options: string[] }[]> = {
  Cough: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 1 week", "1-2 weeks", "2-4 weeks", "> 1 month"],
    },
    {
      q: "Character (dry or productive)? / শুষ্ক নাকি কফসহ?",
      options: ["Dry", "Productive", "Both"],
    },
    {
      q: "Sputum color / কফের রং?",
      options: ["Clear", "Yellow", "Green", "Blood-stained"],
    },
    { q: "Aggravating factors / কিসে বাড়ে?", options: [] },
  ],
  Fever: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 24 hours", "1-3 days", "3-7 days", "> 1 week"],
    },
    {
      q: "Highest temperature recorded / সর্বোচ্চ জ্বরের মাত্রা?",
      options: ["< 100°F", "100-102°F", "102-104°F", "> 104°F"],
    },
    {
      q: "Pattern / জ্বরের ধরন?",
      options: ["Continuous", "Intermittent", "Only at night", "Remittent"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু আছে?",
      options: ["Chills", "Sweating", "Body aches", "Rash"],
    },
  ],
  Headache: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 24 hours", "1-3 days", "3-7 days", "> 1 week"],
    },
    {
      q: "Location / কোথায় ব্যথা?",
      options: ["Frontal", "Temporal", "Occipital", "Whole head"],
    },
    {
      q: "Severity (1-10 scale) / তীব্রতা?",
      options: ["1-3 Mild", "4-6 Moderate", "7-10 Severe"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Nausea", "Vomiting", "Vision changes", "Photophobia"],
    },
  ],
  "Abdominal Pain": [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 6 hours", "6-24 hours", "1-3 days", "> 3 days"],
    },
    {
      q: "Location / কোথায় ব্যথা?",
      options: [
        "Upper abdomen",
        "Lower abdomen",
        "Right side",
        "Left side",
        "All over",
      ],
    },
    {
      q: "Character / ব্যথার ধরন?",
      options: ["Sharp", "Dull", "Cramping", "Burning"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Nausea", "Vomiting", "Diarrhea", "Constipation"],
    },
  ],
  "Chest Pain": [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 1 hour", "1-6 hours", "6-24 hours", "> 24 hours"],
    },
    {
      q: "Location and radiation / কোথায়, কোথায় ছড়ায়?",
      options: [
        "Central chest",
        "Left side",
        "Right side",
        "Radiates to arm",
        "Radiates to jaw",
      ],
    },
    {
      q: "Character / ব্যথার ধরন?",
      options: ["Sharp", "Pressure", "Burning", "Squeezing"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Shortness of breath", "Sweating", "Nausea", "Palpitations"],
    },
  ],
  "Back Pain": [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 24 hours", "1-7 days", "1-4 weeks", "> 1 month"],
    },
    {
      q: "Location / কোথায় ব্যথা?",
      options: ["Upper back", "Middle back", "Lower back"],
    },
    { q: "Any trauma or injury? / কোনো আঘাত পেয়েছেন?", options: ["Yes", "No"] },
    {
      q: "Radiation to legs? / পায়ে ছড়ায়?",
      options: ["No", "Yes - right leg", "Yes - left leg", "Both legs"],
    },
  ],
  "Shortness of Breath": [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 1 hour", "1-6 hours", "6-24 hours", "> 24 hours"],
    },
    {
      q: "At rest or exertion? / বিশ্রামে নাকি পরিশ্রমে?",
      options: ["At rest", "With exertion", "Both"],
    },
    {
      q: "Severity / তীব্রতা?",
      options: ["Mild", "Moderate", "Severe", "Cannot speak in sentences"],
    },
    {
      q: "Leg swelling? / পা ফোলা আছে?",
      options: ["No", "Yes - mild", "Yes - moderate", "Yes - severe"],
    },
  ],
  Dizziness: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 1 hour", "1-24 hours", "1-7 days", "> 1 week"],
    },
    {
      q: "Type / কি ধরনের মাথা ঘোরা?",
      options: ["Spinning (vertigo)", "Light-headed", "Both"],
    },
    {
      q: "With position changes? / নড়াচড়ায় বাড়ে?",
      options: ["Yes", "No", "Sometimes"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Nausea", "Hearing loss", "Tinnitus", "Vomiting"],
    },
  ],
  "Nausea/Vomiting": [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 6 hours", "6-24 hours", "1-3 days", "> 3 days"],
    },
    {
      q: "Frequency of vomiting / কতবার বমি হয়?",
      options: ["Not vomiting", "1-2 times", "3-5 times", "> 5 times"],
    },
    { q: "Blood in vomit? / বমিতে রক্ত আছে?", options: ["No", "Yes"] },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Abdominal pain", "Diarrhea", "Fever", "Headache"],
    },
  ],
  Diarrhea: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 24 hours", "1-3 days", "3-7 days", "> 1 week"],
    },
    {
      q: "Frequency per day / দিনে কতবার?",
      options: ["3-5 times", "6-10 times", "> 10 times"],
    },
    {
      q: "Blood or mucus in stool? / মলে রক্ত বা আম?",
      options: ["No", "Blood", "Mucus", "Both"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Fever", "Abdominal pain", "Vomiting", "Weakness"],
    },
  ],
  Fatigue: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 1 week", "1-4 weeks", "1-3 months", "> 3 months"],
    },
    {
      q: "Does rest help? / বিশ্রামে ভালো হয়?",
      options: ["Yes", "No", "Partially"],
    },
    {
      q: "Weight changes? / ওজন পরিবর্তন?",
      options: ["No change", "Weight loss", "Weight gain"],
    },
    {
      q: "Associated symptoms / সাথে কি আর কিছু?",
      options: ["Fever", "Sweating", "Pallor", "Shortness of breath"],
    },
  ],
  Rash: [
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 24 hours", "1-3 days", "3-7 days", "> 1 week"],
    },
    {
      q: "Location / কোথায়?",
      options: ["Localized", "Spreading", "All over body"],
    },
    {
      q: "Itchy or painful? / চুলকায় নাকি ব্যথা করে?",
      options: ["Not itchy/painful", "Itchy", "Painful", "Both"],
    },
    { q: "New medications or exposure? / নতুন ওষুধ বা সংস্পর্শ?", options: [] },
  ],
  "Joint Pain": [
    {
      q: "Which joints? / কোন জয়েন্টে?",
      options: ["Knee", "Hip", "Shoulder", "Elbow", "Wrist", "Multiple joints"],
    },
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 1 week", "1-4 weeks", "1-3 months", "> 3 months"],
    },
    {
      q: "Swelling or redness? / ফোলা বা লালভাব আছে?",
      options: ["No", "Swelling only", "Redness only", "Both"],
    },
    {
      q: "Morning stiffness? / সকালে শক্ত হয়?",
      options: ["No", "Yes - < 30 min", "Yes - > 30 min"],
    },
  ],
  "Urinary Problem": [
    {
      q: "Main issue / প্রধান সমস্যা?",
      options: ["Pain/burning", "Frequency", "Blood in urine", "Multiple"],
    },
    {
      q: "Duration / কতদিন ধরে?",
      options: ["< 24 hours", "1-3 days", "3-7 days", "> 1 week"],
    },
    {
      q: "Associated fever or back pain? / জ্বর বা কোমর ব্যথা?",
      options: ["No", "Fever only", "Back pain only", "Both"],
    },
    {
      q: "Difficulty urinating? / প্রস্রাবে কষ্ট?",
      options: [
        "No",
        "Difficulty starting",
        "Weak stream",
        "Incomplete emptying",
      ],
    },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitalSignsForm {
  blood_pressure: string;
  pulse: string | number;
  heart_rate?: string | number;
  temperature: string | number;
  respiratory_rate: string | number;
  oxygen_saturation: string | number;
  weight?: string;
  height?: string;
}

interface VisitFormData {
  patient_id?: bigint;
  visit_type?: string;
  visit_date?: string;
  chief_complaint?: string;
  complaint_details?: Record<string, unknown>;
  system_review?: Record<string, unknown>;
  past_medical_history?: Record<string, string>;
  past_surgical_history?: string;
  personal_history?: string;
  family_history?: string;
  immunization_history?: string;
  allergy_history?: string;
  drug_history?: { drug_name: string; dose: string; daily_dose: string }[];
  obstetric_history?: string;
  gynaecological_history?: string;
  other_history?: string;
  history_of_present_illness?: string;
  vital_signs?: VitalSignsForm;
  general_examination?: Record<string, string>;
  systemic_examination?: Record<string, string>;
  physical_examination?: string;
  investigation_profile?: {
    name: string;
    result: string;
    unit: string;
    category: string;
  }[];
  diagnosis?: string;
  notes?: string;
  other_medical_history?: string;
  salient_features?: string;
  previous_investigation_report?: string;
  previous_investigation_rows?: InvestigationRow[];
  differential_diagnosis?: string;
  investigation_advice?: string;
}

interface VisitFormProps {
  patientId: bigint;
  patient?: {
    fullName?: string;
    dateOfBirth?: bigint;
    gender?: string;
    address?: string;
  };
  patientType?: string;
  visit?: Partial<VisitFormData>;
  /** When provided, the form element will be attached to this ref so the parent page can call requestSubmit() */
  formRef?: React.RefObject<HTMLFormElement | null>;
  onSubmit: (data: {
    patientId: bigint;
    visitDate: bigint;
    chiefComplaint: string;
    historyOfPresentIllness: string | null;
    vitalSigns: {
      bloodPressure?: string;
      pulse?: string;
      temperature?: string;
      respiratoryRate?: string;
      oxygenSaturation?: string;
    };
    physicalExamination: string | null;
    diagnosis: string | null;
    notes: string | null;
    visitType: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function nowDateTimeLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

// ─── Vital Unit Badge ─────────────────────────────────────────────────────────

function UnitBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-bold text-teal-700 text-sm bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-xs ml-1">
      {children}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VisitForm({
  patientId,
  patient,
  patientType,
  visit,
  formRef,
  onSubmit,
  onCancel,
  isLoading,
}: VisitFormProps) {
  const [visitType, setVisitType] = useState(
    visit?.visit_type || (patientType === "outdoor" ? "outdoor" : "outdoor"),
  );

  const [formData, setFormData] = useState<VisitFormData>(
    visit || {
      patient_id: patientId,
      visit_type: visitType,
      visit_date: nowDateTimeLocal(),
      chief_complaint: "",
      complaint_details: {},
      system_review: {},
      past_medical_history: {},
      past_surgical_history: "",
      personal_history: "",
      family_history: "",
      immunization_history: "",
      allergy_history: "",
      drug_history: [{ drug_name: "", dose: "", daily_dose: "" }],
      salient_features: "",
      obstetric_history: "",
      gynaecological_history: "",
      other_history: "",
      history_of_present_illness: "",
      vital_signs: {
        blood_pressure: "",
        pulse: "",
        temperature: "",
        respiratory_rate: "",
        oxygen_saturation: "",
        weight: "",
        height: "",
      },
      general_examination: {},
      systemic_examination: {},
      physical_examination: "",
      investigation_profile: [],
      previous_investigation_report: "",
      previous_investigation_rows: [],
      differential_diagnosis: "",
      investigation_advice: "",
      diagnosis: "",
      notes: "",
    },
  );

  const [ddImageConfirmOpen, setDdImageConfirmOpen] = useState(false);
  const [ddReportDate, setDdReportDate] = useState("");
  const [ddImageHasData, setDdImageHasData] = useState(false);
  const ddImageInputRef = useRef<HTMLInputElement>(null);
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [complaintAnswers, setComplaintAnswers] = useState<
    Record<string, string[]>
  >({});
  const [customComplaints, setCustomComplaints] = useState<
    Record<string, { q: string; options: string[] }[]>
  >({});
  const [complaintQuestions, setComplaintQuestions] = useState<
    Record<string, { q: string; options: string[] }[]>
  >({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newComplaint, setNewComplaint] = useState("");
  const [newQuestions, setNewQuestions] = useState([
    { q: "", options: [] as string[] },
    { q: "", options: [] as string[] },
    { q: "", options: [] as string[] },
    { q: "", options: [] as string[] },
  ]);
  const [systemReviewAnswers, setSystemReviewAnswers] = useState<
    Record<string, string[]>
  >({});
  const [customSystems, setCustomSystems] = useState<Record<string, string[]>>(
    {},
  );
  const [medicalHistory, setMedicalHistory] = useState<Record<string, string>>(
    {},
  );
  const [generalExamFindings, setGeneralExamFindings] = useState<
    Record<string, string>
  >({});
  const [respiratoryExam, setRespiratoryExam] = useState<
    Record<string, unknown>
  >({});
  const [neurologicalExam, setNeurologicalExam] = useState<
    Record<string, unknown>
  >({});
  const [gastrointestinalExam, setGastrointestinalExam] = useState<
    Record<string, unknown>
  >({});
  const [musculoskeletalExam, setMusculoskeletalExam] = useState<
    Record<string, unknown>
  >({});
  const [cardiovascularExam, setCardiovascularExam] = useState<
    Record<string, unknown>
  >({});

  // ─── Provisional / Final Diagnosis state ─────────────────────────────────
  const [diagnosisStatus, setDiagnosisStatus] = useState<
    "provisional" | "final"
  >("provisional");

  // ─── Family History Risk structured checkboxes ───────────────────────────
  const [familyRisk, setFamilyRisk] = useState<FamilyHistoryRisk>(() => {
    try {
      const email = getDoctorEmail();
      const patientIdStr = patientId?.toString() ?? "new";
      return (
        loadFamilyHistoryRisk(email, patientIdStr) ?? {
          diabetes: false,
          hypertension: false,
          ihd: false,
          cancer: false,
          stroke: false,
          additionalNotes: "",
        }
      );
    } catch {
      return {
        diabetes: false,
        hypertension: false,
        ihd: false,
        cancer: false,
        stroke: false,
        additionalNotes: "",
      };
    }
  });

  const saveFamilyRisk = (updated: FamilyHistoryRisk) => {
    try {
      const email = getDoctorEmail();
      const patientIdStr = patientId?.toString() ?? "new";
      saveFamilyHistoryRisk(email, patientIdStr, updated);
    } catch {
      /* ignore */
    }
  };

  // ─── Autosave state ───────────────────────────────────────────────────────
  const [autosavedAt, setAutosavedAt] = useState<Date | null>(null);
  const autosaveKeyRef = useRef<string>("");

  const [showSurgicalQuestions, setShowSurgicalQuestions] = useState(false);
  const [showPersonalQuestions, setShowPersonalQuestions] = useState(false);
  const [showFamilyQuestions, setShowFamilyQuestions] = useState(false);
  const [showImmunizationQuestions, setShowImmunizationQuestions] =
    useState(false);
  const [showAllergyQuestions, setShowAllergyQuestions] = useState(false);
  const [showObstetricQuestions, setShowObstetricQuestions] = useState(false);
  const [showGynaecologicalQuestions, setShowGynaecologicalQuestions] =
    useState(false);

  const [surgicalHistoryAnswers, setSurgicalHistoryAnswers] = useState(
    Array(surgicalHistoryQuestions.length).fill("") as string[],
  );
  const [personalHistoryAnswers, setPersonalHistoryAnswers] = useState(
    Array(personalHistoryQuestions.length).fill("") as string[],
  );
  const [familyHistoryAnswers, setFamilyHistoryAnswers] = useState(
    Array(familyHistoryQuestions.length).fill("") as string[],
  );
  const [immunizationAnswers, setImmunizationAnswers] = useState(
    Array(immunizationQuestions.length).fill("") as string[],
  );
  const [epiSchedule, setEpiSchedule] = useState<"yes" | "no" | "">("");
  const [allergyAnswers, setAllergyAnswers] = useState(
    Array(allergyQuestions.length).fill("") as string[],
  );
  const [obstetricAnswers, setObstetricAnswers] = useState(
    Array(obstetricQuestions.length).fill("") as string[],
  );
  const [gynaecologicalAnswers, setGynaecologicalAnswers] = useState(
    Array(gynaecologicalQuestions.length).fill("") as string[],
  );

  const [extraHistoryQuestions, setExtraHistoryQuestions] = useState<
    Record<string, { q: string; options: string[] }[]>
  >({});
  const [extraHistoryAnswers, setExtraHistoryAnswers] = useState<
    Record<string, string[]>
  >({});
  const [newHistoryQuestionText, setNewHistoryQuestionText] = useState<
    Record<string, string>
  >({});

  // Inline "add question" state per complaint card
  const [addingQuestionFor, setAddingQuestionFor] = useState<string | null>(
    null,
  );
  const [newQuestionForComplaint, setNewQuestionForComplaint] = useState<{
    q: string;
    options: string[];
  }>({ q: "", options: [] });
  const [newOptionDraftForQuestion, setNewOptionDraftForQuestion] =
    useState("");

  // Edits to base complaint question text/options made by Doctor/Admin
  // Shape: { [complaintName]: { [questionIndex]: { q?: string; options?: string[] } } }
  const [editedComplaintQuestions, setEditedComplaintQuestions] = useState<
    Record<string, Record<number, { q?: string; options?: string[] }>>
  >({});

  // ─── Autosave setup (after all state is declared) ─────────────────────────

  // Build the autosave key and restore any saved draft on first render
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect
  useEffect(() => {
    const email = getDoctorEmail();
    const id = patientId?.toString() || "new";
    autosaveKeyRef.current = `visitFormAutosave_${id}_${email}`;

    try {
      const raw = localStorage.getItem(autosaveKeyRef.current);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (saved.formData) setFormData(saved.formData as VisitFormData);
      if (saved.visitType) setVisitType(saved.visitType as string);
      if (saved.selectedComplaints)
        setSelectedComplaints(saved.selectedComplaints as string[]);
      if (saved.complaintAnswers)
        setComplaintAnswers(saved.complaintAnswers as Record<string, string[]>);
      if (saved.systemReviewAnswers)
        setSystemReviewAnswers(
          saved.systemReviewAnswers as Record<string, string[]>,
        );
      if (saved.medicalHistory)
        setMedicalHistory(saved.medicalHistory as Record<string, string>);
      if (saved.generalExamFindings)
        setGeneralExamFindings(
          saved.generalExamFindings as Record<string, string>,
        );
      if (saved.diagnosisStatus)
        setDiagnosisStatus(saved.diagnosisStatus as "provisional" | "final");
      if (saved.surgicalHistoryAnswers)
        setSurgicalHistoryAnswers(saved.surgicalHistoryAnswers as string[]);
      if (saved.personalHistoryAnswers)
        setPersonalHistoryAnswers(saved.personalHistoryAnswers as string[]);
      if (saved.familyHistoryAnswers)
        setFamilyHistoryAnswers(saved.familyHistoryAnswers as string[]);
      if (saved.allergyAnswers)
        setAllergyAnswers(saved.allergyAnswers as string[]);
      if (saved.epiSchedule)
        setEpiSchedule(saved.epiSchedule as "yes" | "no" | "");
      if (saved.autosavedAt)
        setAutosavedAt(new Date(saved.autosavedAt as string));
    } catch {
      // ignore restore errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 60-second autosave
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional stable interval with broad state snapshot
  useEffect(() => {
    const interval = setInterval(() => {
      if (!autosaveKeyRef.current) return;
      try {
        const snapshot = {
          formData,
          visitType,
          selectedComplaints,
          complaintAnswers,
          systemReviewAnswers,
          medicalHistory,
          generalExamFindings,
          diagnosisStatus,
          surgicalHistoryAnswers,
          personalHistoryAnswers,
          familyHistoryAnswers,
          allergyAnswers,
          epiSchedule,
          autosavedAt: new Date().toISOString(),
        };
        localStorage.setItem(autosaveKeyRef.current, JSON.stringify(snapshot));
        setAutosavedAt(new Date());
      } catch {
        // ignore storage errors
      }
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData,
    visitType,
    selectedComplaints,
    complaintAnswers,
    systemReviewAnswers,
    medicalHistory,
    generalExamFindings,
    diagnosisStatus,
  ]);

  // ─── Role / permissions ───────────────────────────────────────────────────

  const { currentDoctor } = useEmailAuth();
  const EDIT_ROLES: ReadonlyArray<string> = [
    "admin",
    "consultant_doctor",
    "doctor",
  ];
  const canEditQuestions =
    !currentDoctor || EDIT_ROLES.includes(currentDoctor.role);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = (field: keyof VisitFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleVitalChange = (field: keyof VitalSignsForm, value: string) => {
    setFormData((prev) => ({
      ...prev,
      vital_signs: { ...prev.vital_signs!, [field]: value },
    }));
  };

  const handleDrugHistoryChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    setFormData((prev) => {
      const current = prev.drug_history?.length
        ? prev.drug_history
        : [{ drug_name: "", dose: "", daily_dose: "" }];
      return {
        ...prev,
        drug_history: current.map((d, i) =>
          i === index ? { ...d, [field]: value } : d,
        ),
      };
    });
  };

  const addDrugHistory = () => {
    setFormData((prev) => ({
      ...prev,
      drug_history: [
        ...(prev.drug_history || []),
        { drug_name: "", dose: "", daily_dose: "" },
      ],
    }));
  };

  const removeDrugHistory = (index: number) => {
    if ((formData.drug_history || []).length > 1) {
      setFormData((prev) => ({
        ...prev,
        drug_history: (prev.drug_history || []).filter((_, i) => i !== index),
      }));
    }
  };

  const toggleSystemReview = (system: string, symptom: string) => {
    setSystemReviewAnswers((prev) => {
      const current = prev[system] || [];
      return {
        ...prev,
        [system]: current.includes(symptom)
          ? current.filter((s) => s !== symptom)
          : [...current, symptom],
      };
    });
  };

  const toggleMedicalHistory = (condition: string) => {
    setMedicalHistory((prev) => ({
      ...prev,
      [condition]:
        prev[condition] === "+" ? "-" : prev[condition] === "-" ? "" : "+",
    }));
  };

  const toggleGeneralExam = (finding: string, status: string) => {
    setGeneralExamFindings((prev) => ({
      ...prev,
      [finding]: prev[finding] === status ? "" : status,
    }));
  };

  // ─── Examination Templates ────────────────────────────────────────────────

  const [templateExamRows, setTemplateExamRows] = useState<ExamTemplateRow[]>(
    [],
  );

  const applyExamTemplate = (templateName: string) => {
    const rows = EXAM_TEMPLATES[templateName] || [];
    setTemplateExamRows((prev) => {
      // Append only rows not already present (by finding name)
      const existingFindings = new Set(prev.map((r) => r.finding));
      const newRows = rows.filter((r) => !existingFindings.has(r.finding));
      return [...prev, ...newRows];
    });
  };

  const updateTemplateRow = (
    idx: number,
    field: keyof ExamTemplateRow,
    value: string,
  ) => {
    setTemplateExamRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const removeTemplateRow = (idx: number) => {
    setTemplateExamRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addHistoryQuestion = (sectionKey: string) => {
    const text = (newHistoryQuestionText[sectionKey] || "").trim();
    if (!text) return;
    setExtraHistoryQuestions((prev) => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] || []), { q: text, options: [] }],
    }));
    setExtraHistoryAnswers((prev) => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] || []), ""],
    }));
    setNewHistoryQuestionText((prev) => ({ ...prev, [sectionKey]: "" }));
  };

  const allComplaints = { ...commonComplaints, ...customComplaints };

  const getComplaintQuestions = (complaint: string) => {
    const base = allComplaints[complaint] || [];
    const edits = editedComplaintQuestions[complaint] || {};
    // Merge base questions with any inline edits
    const mergedBase = base.map((q, i) => ({
      q: edits[i]?.q ?? q.q,
      options: edits[i]?.options ?? q.options,
    }));
    const extra = complaintQuestions[complaint] || [];
    return [...mergedBase, ...extra];
  };

  const handleTemplateSelect = (template: string) => {
    const isSelected = selectedComplaints.includes(template);
    const updated = isSelected
      ? selectedComplaints.filter((c) => c !== template)
      : [...selectedComplaints, template];
    setSelectedComplaints(updated);
    if (!isSelected) {
      setComplaintAnswers((prev) => ({
        ...prev,
        [template]: (allComplaints[template] || []).map(() => ""),
      }));
    } else {
      const newAnswers = { ...complaintAnswers };
      delete newAnswers[template];
      setComplaintAnswers(newAnswers);
    }
    setFormData((prev) => ({ ...prev, chief_complaint: updated.join(", ") }));
  };

  const handleAddComplaint = () => {
    if (newComplaint.trim()) {
      const questions = newQuestions.filter((item) => item.q.trim() !== "");
      if (questions.length > 0) {
        setCustomComplaints((prev) => ({ ...prev, [newComplaint]: questions }));
        setNewComplaint("");
        setNewQuestions([
          { q: "", options: [] },
          { q: "", options: [] },
          { q: "", options: [] },
          { q: "", options: [] },
        ]);
        setShowAddDialog(false);
      }
    }
  };

  const handleQuestionChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    const updated = [...newQuestions];
    if (field === "question") {
      updated[index] = { ...updated[index], q: value };
    } else if (field === "options") {
      updated[index] = {
        ...updated[index],
        options: value
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o !== ""),
      };
    }
    setNewQuestions(updated);
  };

  const handleAnswerChange = (
    complaint: string,
    questionIndex: number,
    value: string,
  ) => {
    setComplaintAnswers((prev) => ({
      ...prev,
      [complaint]: (prev[complaint] || []).map((ans, idx) =>
        idx === questionIndex ? value : ans,
      ),
    }));
  };

  // ─── Complaint question/option edit callbacks (Doctor/Admin only) ──────────

  const handleEditComplaintQuestion = (
    complaint: string,
    idx: number,
    newText: string,
  ) => {
    const base = allComplaints[complaint] || [];
    if (idx < base.length) {
      // Base question — store override in editedComplaintQuestions
      setEditedComplaintQuestions((prev) => ({
        ...prev,
        [complaint]: {
          ...(prev[complaint] || {}),
          [idx]: { ...(prev[complaint]?.[idx] || {}), q: newText },
        },
      }));
    } else {
      // Extra question — update complaintQuestions
      const extraIdx = idx - base.length;
      setComplaintQuestions((prev) => {
        const arr = [...(prev[complaint] || [])];
        if (arr[extraIdx]) arr[extraIdx] = { ...arr[extraIdx], q: newText };
        return { ...prev, [complaint]: arr };
      });
    }
  };

  const handleAddComplaintOption = (
    complaint: string,
    idx: number,
    option: string,
  ) => {
    const base = allComplaints[complaint] || [];
    if (idx < base.length) {
      const currentOpts =
        editedComplaintQuestions[complaint]?.[idx]?.options ??
        base[idx]?.options ??
        [];
      setEditedComplaintQuestions((prev) => ({
        ...prev,
        [complaint]: {
          ...(prev[complaint] || {}),
          [idx]: {
            ...(prev[complaint]?.[idx] || {}),
            options: [...currentOpts, option],
          },
        },
      }));
    } else {
      const extraIdx = idx - base.length;
      setComplaintQuestions((prev) => {
        const arr = [...(prev[complaint] || [])];
        if (arr[extraIdx]) {
          arr[extraIdx] = {
            ...arr[extraIdx],
            options: [...arr[extraIdx].options, option],
          };
        }
        return { ...prev, [complaint]: arr };
      });
    }
  };

  const handleDeleteComplaintOption = (
    complaint: string,
    idx: number,
    option: string,
  ) => {
    const base = allComplaints[complaint] || [];
    if (idx < base.length) {
      const currentOpts =
        editedComplaintQuestions[complaint]?.[idx]?.options ??
        base[idx]?.options ??
        [];
      setEditedComplaintQuestions((prev) => ({
        ...prev,
        [complaint]: {
          ...(prev[complaint] || {}),
          [idx]: {
            ...(prev[complaint]?.[idx] || {}),
            options: currentOpts.filter((o) => o !== option),
          },
        },
      }));
    } else {
      const extraIdx = idx - base.length;
      setComplaintQuestions((prev) => {
        const arr = [...(prev[complaint] || [])];
        if (arr[extraIdx]) {
          arr[extraIdx] = {
            ...arr[extraIdx],
            options: arr[extraIdx].options.filter((o) => o !== option),
          };
        }
        return { ...prev, [complaint]: arr };
      });
    }
  };

  const commitNewQuestionForComplaint = (complaint: string) => {
    if (!newQuestionForComplaint.q.trim()) {
      setAddingQuestionFor(null);
      return;
    }
    setComplaintQuestions((prev) => ({
      ...prev,
      [complaint]: [
        ...(prev[complaint] || []),
        {
          q: newQuestionForComplaint.q.trim(),
          options: newQuestionForComplaint.options,
        },
      ],
    }));
    setComplaintAnswers((prev) => ({
      ...prev,
      [complaint]: [...(prev[complaint] || []), ""],
    }));
    setAddingQuestionFor(null);
    setNewQuestionForComplaint({ q: "", options: [] });
    setNewOptionDraftForQuestion("");
  };

  const handleAddQuestionToComplaint = (complaint: string) => {
    // Opens inline form — handled via addingQuestionFor state below
    setAddingQuestionFor(complaint);
    setNewQuestionForComplaint({ q: "", options: [] as string[] });
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const buildSummary = (
      baseQs: { q: string; options: string[] }[],
      baseAnswers: string[],
      sectionKey: string,
    ) =>
      [
        ...baseQs.map((q, i) =>
          baseAnswers[i] ? `${q.q}: ${baseAnswers[i]}` : "",
        ),
        ...(extraHistoryQuestions[sectionKey] || []).map((q, i) =>
          extraHistoryAnswers[sectionKey]?.[i]
            ? `${q.q}: ${extraHistoryAnswers[sectionKey][i]}`
            : "",
        ),
      ]
        .filter(Boolean)
        .join("\n");

    const surgicalHistorySummary = buildSummary(
      surgicalHistoryQuestions,
      surgicalHistoryAnswers,
      "surgical",
    );
    const personalHistorySummary = buildSummary(
      personalHistoryQuestions,
      personalHistoryAnswers,
      "personal",
    );
    const familyHistorySummary = buildSummary(
      familyHistoryQuestions,
      familyHistoryAnswers,
      "family",
    );
    const immunizationSummary = buildSummary(
      immunizationQuestions,
      immunizationAnswers,
      "immunization",
    );
    const allergySummary = buildSummary(
      allergyQuestions,
      allergyAnswers,
      "allergy",
    );
    const obstetricSummary = buildSummary(
      obstetricQuestions,
      obstetricAnswers,
      "obstetric",
    );
    const gynaecologicalSummary = buildSummary(
      gynaecologicalQuestions,
      gynaecologicalAnswers,
      "gynaecological",
    );

    let historyOfPresentIllness: string | null = null;
    if (visitType === "outdoor") {
      const sections = [
        surgicalHistorySummary &&
          `Past Surgical History:\n${surgicalHistorySummary}`,
        personalHistorySummary &&
          `Personal History:\n${personalHistorySummary}`,
        familyHistorySummary && `Family History:\n${familyHistorySummary}`,
        immunizationSummary && `Immunization History:\n${immunizationSummary}`,
        allergySummary && `Allergy History:\n${allergySummary}`,
        obstetricSummary && `Obstetric History:\n${obstetricSummary}`,
        gynaecologicalSummary &&
          `Gynaecological History:\n${gynaecologicalSummary}`,
        formData.other_history && `Other History:\n${formData.other_history}`,
      ].filter(Boolean);
      historyOfPresentIllness =
        sections.length > 0 ? sections.join("\n\n") : null;
    } else {
      // Admitted: include HPI
      historyOfPresentIllness =
        formData.history_of_present_illness?.trim() || null;
    }

    // Build physical examination text
    let physicalExamination: string | null = null;
    {
      const genExamLines = Object.entries(generalExamFindings)
        .filter(([, v]) => v && !String(v).endsWith("_note"))
        .map(([k, v]) => `${k}: ${v}`);
      const flattenExam = (
        exam: Record<string, unknown>,
        label: string,
      ): string => {
        const parts: string[] = [];
        for (const [, v] of Object.entries(exam)) {
          if (!v) continue;
          if (Array.isArray(v) && v.length > 0) parts.push(...v.map(String));
          else if (typeof v === "object" && v !== null) {
            const sub = Object.values(v as Record<string, unknown>)
              .filter(Boolean)
              .map(String);
            parts.push(...sub);
          } else if (typeof v === "string" && v.trim()) parts.push(v);
        }
        return parts.length > 0
          ? `${label}: ${parts.slice(0, 4).join(", ")}.`
          : "";
      };
      const parts = [
        genExamLines.length > 0 &&
          `General Examination:\n${genExamLines.join("\n")}`,
        flattenExam(respiratoryExam, "Respiratory system"),
        flattenExam(neurologicalExam, "Neurological system"),
        flattenExam(gastrointestinalExam, "Gastrointestinal system"),
        flattenExam(musculoskeletalExam, "Musculoskeletal system"),
        flattenExam(cardiovascularExam, "Cardiovascular system"),
      ].filter(Boolean);
      physicalExamination = parts.length > 0 ? parts.join("\n\n") : null;
    }

    const vs = formData.vital_signs;
    const toStr = (v: string | number | undefined) =>
      v !== undefined && v !== "" ? String(v) : undefined;
    const vitalSigns = {
      bloodPressure: vs?.blood_pressure?.trim() || undefined,
      pulse: toStr(vs?.pulse),
      temperature: toStr(vs?.temperature),
      respiratoryRate: toStr(vs?.respiratory_rate),
      oxygenSaturation: toStr(vs?.oxygen_saturation),
    };

    const notesParts = [
      formData.previous_investigation_report,
      formData.differential_diagnosis,
      formData.investigation_advice,
      Array.isArray(formData.investigation_profile) &&
      formData.investigation_profile.length > 0
        ? formData.investigation_profile
            .map((inv) => `${inv.name}: ${inv.result} ${inv.unit}`.trim())
            .join("\n")
        : undefined,
      formData.notes,
    ].filter(Boolean);
    const notes = notesParts.length > 0 ? notesParts.join("\n\n") : null;

    const chiefComplaint =
      selectedComplaints.length > 0
        ? selectedComplaints.join(", ")
        : formData.chief_complaint?.trim() || "";

    const visitDate =
      BigInt(new Date(formData.visit_date || nowDateTimeLocal()).getTime()) *
      1000000n;

    // Save extended visit form data to localStorage
    try {
      const doctorEmail = getDoctorEmail();
      const existingVisits = loadFromStorage<{ id: bigint }>(
        `visits_${doctorEmail}`,
      );
      const nextVisitId =
        existingVisits.length === 0
          ? 1n
          : existingVisits.reduce(
              (max, v) => (v.id > max ? v.id : max),
              0n as bigint,
            ) + 1n;
      const extendedKey = `visit_form_data_${nextVisitId}_${doctorEmail}`;
      const extendedData = {
        visitType,
        chiefComplaints: selectedComplaints,
        complaintAnswers: (() => {
          const result: Record<string, Record<string, string>> = {};
          for (const complaint of selectedComplaints) {
            const qs = getComplaintQuestions(complaint);
            const ans = complaintAnswers[complaint] || [];
            result[complaint] = {};
            qs.forEach((q, i) => {
              if (ans[i]) result[complaint][q.q] = ans[i];
            });
          }
          return result;
        })(),
        systemReviewAnswers,
        pastMedicalHistory: Object.entries(medicalHistory)
          .filter(([, v]) => v === "+")
          .map(([k]) => k),
        pastMedicalHistoryAll: medicalHistory,
        drugHistory: (formData.drug_history || [])
          .filter((d) => d.drug_name?.trim())
          .map((d) => ({
            name: d.drug_name,
            dose: d.dose,
            duration: d.daily_dose,
          })),
        surgicalHistory: surgicalHistoryAnswers.filter(Boolean),
        familyHistory: familyHistoryAnswers.filter(Boolean),
        personalHistory: personalHistoryAnswers.filter(Boolean),
        immunizationHistory: immunizationAnswers.filter(Boolean),
        epiSchedule,
        allergyHistory: allergyAnswers.filter(Boolean),
        obstetricHistory: obstetricAnswers.filter(Boolean),
        gynaecologicalHistory: gynaecologicalAnswers.filter(Boolean),
        historyOfPresentIllness: formData.history_of_present_illness || "",
        vitalSigns: {
          bloodPressure: vs?.blood_pressure?.trim() || undefined,
          pulse: vs?.pulse ? String(vs.pulse) : undefined,
          temperature: vs?.temperature ? String(vs.temperature) : undefined,
          respiratoryRate: vs?.respiratory_rate
            ? String(vs.respiratory_rate)
            : undefined,
          oxygenSaturation: vs?.oxygen_saturation
            ? String(vs.oxygen_saturation)
            : undefined,
          weight: vs?.weight ? String(vs.weight) : undefined,
          height: vs?.height ? String(vs.height) : undefined,
        },
        generalExamFindings,
        respiratoryExam,
        neurologicalExam,
        gastrointestinalExam,
        musculoskeletalExam,
        cardiovascularExam,
        previousInvestigationRows: Array.isArray(
          formData.previous_investigation_rows,
        )
          ? formData.previous_investigation_rows
          : [],
        differentialDiagnosis: formData.differential_diagnosis || "",
        investigationAdvice: formData.investigation_advice || "",
        diagnosis: formData.diagnosis || "",
        salientFeatures: formData.salient_features || "",
        otherMedicalHistory:
          (formData as Record<string, unknown>).other_medical_history || "",
        diagnosisStatus,
        templateExamRows,
      };
      localStorage.setItem(extendedKey, JSON.stringify(extendedData));
      // Clear autosave entry on successful manual save
      if (autosaveKeyRef.current) {
        localStorage.removeItem(autosaveKeyRef.current);
        setAutosavedAt(null);
      }
    } catch {
      // ignore storage errors
    }

    onSubmit({
      patientId,
      visitDate,
      chiefComplaint,
      historyOfPresentIllness,
      vitalSigns,
      physicalExamination,
      diagnosis: formData.diagnosis?.trim() || null,
      notes,
      visitType,
    });
  };

  const generateSalientFeatures = (): string => {
    const title = patient?.gender?.toLowerCase() === "female" ? "Mrs/Ms" : "Mr";
    const name = patient?.fullName || "...";
    let age = "...";
    if (patient?.dateOfBirth) {
      const ms = Number(patient.dateOfBirth) / 1_000_000;
      age = String(Math.floor((Date.now() - ms) / (365.25 * 24 * 3600 * 1000)));
    }
    const occupation = personalHistoryAnswers[3]?.trim() || "...";
    const address = patient?.address?.trim() || "...";
    const htn = medicalHistory.HTN === "+" ? "hypertensive" : "normotensive";
    const dm = medicalHistory.DM === "+" ? "diabetic" : "nondiabetic";

    const complaintLines: string[] = [];
    if (selectedComplaints.length > 0) {
      selectedComplaints.forEach((complaint, i) => {
        const qs = getComplaintQuestions(complaint);
        const answers = complaintAnswers[complaint] || [];
        const parts = qs
          .map((_q, idx) => (answers[idx] ? answers[idx] : ""))
          .filter(Boolean)
          .slice(0, 4);
        complaintLines.push(
          parts.length > 0
            ? `${i + 1}. ${complaint} — ${parts.join(", ")}`
            : `${i + 1}. ${complaint}`,
        );
      });
    } else if (formData.chief_complaint?.trim()) {
      complaintLines.push(`1. ${formData.chief_complaint.trim()}`);
    }

    const presentedWith =
      complaintLines.length > 0
        ? `presented with:\n${complaintLines.join("\n")}`
        : "presented with various complaints";

    const positiveSysReview: string[] = [];
    for (const [k, v] of Object.entries(systemReviewAnswers)) {
      const vals = Array.isArray(v) ? v.filter(Boolean) : [];
      if (
        vals.length > 0 &&
        !vals.every((x) => x === "Normal" || x === "None" || x === "No")
      ) {
        positiveSysReview.push(`${k}: ${vals.join(", ")}`);
      }
    }
    const sysReviewLine =
      positiveSysReview.length > 0
        ? `He/She also complains of ${positiveSysReview.join("; ")}.`
        : "";

    const vitalParts: string[] = [];
    if (formData.vital_signs?.blood_pressure)
      vitalParts.push(`BP ${formData.vital_signs.blood_pressure} mmHg`);
    if (formData.vital_signs?.pulse)
      vitalParts.push(`Pulse ${formData.vital_signs.pulse} beats/min`);
    if (formData.vital_signs?.temperature)
      vitalParts.push(`Temp ${formData.vital_signs.temperature} °C`);
    if (formData.vital_signs?.respiratory_rate)
      vitalParts.push(
        `RR ${formData.vital_signs.respiratory_rate} breaths/min`,
      );
    if (formData.vital_signs?.oxygen_saturation)
      vitalParts.push(`SpO₂ ${formData.vital_signs.oxygen_saturation}%`);
    if (formData.vital_signs?.weight)
      vitalParts.push(`Weight ${formData.vital_signs.weight} kg`);
    const vitalsLine =
      vitalParts.length > 0 ? `On examination, ${vitalParts.join(", ")}.` : "";

    const genExamParts = Object.entries(generalExamFindings)
      .filter(([k, v]) => v && !k.endsWith("_note"))
      .map(([k, v]) => `${k}: ${v}`);
    const genExamLine =
      genExamParts.length > 0
        ? `On general examination: ${genExamParts.join(", ")}.`
        : "On general examination: within normal limits.";

    const flattenExam = (
      exam: Record<string, unknown>,
      label: string,
    ): string => {
      const parts: string[] = [];
      for (const [, v] of Object.entries(exam)) {
        if (!v) continue;
        if (Array.isArray(v) && v.length > 0) parts.push(...v.map(String));
        else if (typeof v === "object" && v !== null) {
          const sub = Object.values(v as Record<string, unknown>)
            .filter(Boolean)
            .map(String);
          parts.push(...sub);
        } else if (typeof v === "string" && v.trim()) parts.push(v);
      }
      return parts.length > 0
        ? `${label}: ${parts.slice(0, 4).join(", ")}.`
        : "";
    };

    const systemicParts = [
      flattenExam(cardiovascularExam, "Cardiovascular system"),
      flattenExam(respiratoryExam, "Respiratory system"),
      flattenExam(gastrointestinalExam, "Gastrointestinal system"),
      flattenExam(neurologicalExam, "Neurological system"),
      flattenExam(musculoskeletalExam, "Musculoskeletal system"),
    ].filter(Boolean);
    const systemicLine =
      systemicParts.length > 0
        ? `On systemic examination:\n${systemicParts.join("\n")}`
        : "On systemic examination: Heart: S1+S2+0, Lung: Clear, P/A: NAD";

    const smokingStatus = personalHistoryAnswers[0]?.trim();
    const smokingLine =
      smokingStatus && smokingStatus !== "Non-smoker"
        ? `He/She is a ${smokingStatus.toLowerCase()}.`
        : "";

    const familyLines = familyHistoryAnswers
      .map((ans, i) =>
        ans && ans !== "No"
          ? `${familyHistoryQuestions[i].q.split("/")[0].trim()}: ${ans}`
          : "",
      )
      .filter(Boolean);

    // Add structured family history risk factors
    const riskFactors: string[] = [];
    if (familyRisk.diabetes) riskFactors.push("Diabetes");
    if (familyRisk.hypertension) riskFactors.push("Hypertension");
    if (familyRisk.ihd) riskFactors.push("IHD");
    if (familyRisk.cancer) riskFactors.push("Cancer");
    if (familyRisk.stroke) riskFactors.push("Stroke");

    const familyLine =
      familyLines.length > 0 || riskFactors.length > 0
        ? `On query, family history reveals ${[...familyLines, ...(riskFactors.length > 0 ? [`hereditary risk: ${riskFactors.join(", ")}`] : [])].join("; ")}.`
        : "";

    const drugs = (formData.drug_history || []).filter((d) =>
      d.drug_name?.trim(),
    );
    const drugLine =
      drugs.length > 0
        ? `He/She uses ${drugs.map((d) => d.drug_name.trim()).join(", ")}.`
        : "";

    let invLine = "";
    const prevInvRows = formData.previous_investigation_rows || [];
    if (prevInvRows.length > 0) {
      const invItems = prevInvRows
        .filter((r) => r.name)
        .map(
          (r) =>
            `${r.date ? `${r.date} - ` : ""}${r.name}${r.result ? ` ${r.result}` : ""}${r.unit ? ` ${r.unit}` : ""}${r.interpretation ? ` (${r.interpretation})` : ""}`,
        )
        .join("; ");
      if (invItems) invLine = `Previous investigations: ${invItems}.`;
    }

    const parts = [
      `${title} ${name}, ${age} years old, ${occupation}, ${htn}, ${dm}, hailing from ${address}, ${presentedWith}.`,
      sysReviewLine,
      smokingLine,
      familyLine,
      drugLine,
      vitalsLine,
      genExamLine,
      systemicLine,
      invLine,
    ].filter(Boolean);

    return `Salient Features\n\n${parts.join("\n\n")}`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const drugHistory = formData.drug_history || [
    { drug_name: "", dose: "", daily_dose: "" },
  ];

  const historySections = [
    {
      key: "surgical",
      label: "Past Surgical History / অতীতের অস্ত্রোপচারের ইতিহাস",
      show: showSurgicalQuestions,
      setShow: setShowSurgicalQuestions,
      questions: surgicalHistoryQuestions,
      answers: surgicalHistoryAnswers,
      setAnswers: setSurgicalHistoryAnswers,
    },
    {
      key: "personal",
      label: "Personal History / ব্যক্তিগত ইতিহাস",
      show: showPersonalQuestions,
      setShow: setShowPersonalQuestions,
      questions: personalHistoryQuestions,
      answers: personalHistoryAnswers,
      setAnswers: setPersonalHistoryAnswers,
    },
    {
      key: "family",
      label: "Family History / পারিবারিক ইতিহাস",
      show: showFamilyQuestions,
      setShow: setShowFamilyQuestions,
      questions: familyHistoryQuestions,
      answers: familyHistoryAnswers,
      setAnswers: setFamilyHistoryAnswers,
    },
    {
      key: "immunization",
      label: "Immunization History / টিকার ইতিহাস",
      show: showImmunizationQuestions,
      setShow: setShowImmunizationQuestions,
      questions: immunizationQuestions,
      answers: immunizationAnswers,
      setAnswers: setImmunizationAnswers,
    },
    {
      key: "allergy",
      label: "Allergy History / এলার্জির ইতিহাস",
      show: showAllergyQuestions,
      setShow: setShowAllergyQuestions,
      questions: allergyQuestions,
      answers: allergyAnswers,
      setAnswers: setAllergyAnswers,
    },
    {
      key: "obstetric",
      label: "Obstetric History / প্রসূতি ইতিহাস",
      show: showObstetricQuestions,
      setShow: setShowObstetricQuestions,
      questions: obstetricQuestions,
      answers: obstetricAnswers,
      setAnswers: setObstetricAnswers,
    },
    {
      key: "gynaecological",
      label: "Gynaecological History / স্ত্রীরোগ বিষয়ক ইতিহাস",
      show: showGynaecologicalQuestions,
      setShow: setShowGynaecologicalQuestions,
      questions: gynaecologicalQuestions,
      answers: gynaecologicalAnswers,
      setAnswers: setGynaecologicalAnswers,
    },
  ] as {
    key: string;
    label: string;
    show: boolean;
    setShow: (v: boolean) => void;
    questions: { q: string; options: string[] }[];
    answers: string[];
    setAnswers: (v: string[]) => void;
  }[];

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-6 pb-28 lg:pb-8"
    >
      {/* Visit Type Toggle */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Visit Type / রোগীর ধরন *
        </Label>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              value: "outdoor",
              emoji: "🚶",
              en: "Outdoor Patient",
              bn: "বহির্বিভাগ রোগী",
            },
            {
              value: "admitted",
              emoji: "🏥",
              en: "Admitted Patient",
              bn: "ভর্তি রোগী",
            },
          ].map(({ value, emoji, en, bn }) => (
            <Card
              key={value}
              className={`cursor-pointer transition-all ${visitType === value ? "border-teal-500 bg-teal-50 shadow-md ring-2 ring-teal-300" : "border-slate-200 hover:border-slate-300"}`}
              onClick={() => setVisitType(value)}
              data-ocid="visit_form.toggle"
            >
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-2">{emoji}</div>
                <h4 className="font-semibold text-slate-800">{en}</h4>
                <p className="text-xs text-slate-500 mt-1">{bn}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Visit Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="visit_date" className="text-base font-semibold">
            Visit Date & Time *
          </Label>
          <Input
            id="visit_date"
            type="datetime-local"
            value={formData.visit_date || ""}
            onChange={(e) => handleChange("visit_date", e.target.value)}
            required
            className="h-11"
            data-ocid="visit_form.input"
          />
        </div>
      </div>

      {/* Chief Complaints */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            Chief Complaints / প্রধান অভিযোগ *
          </Label>
          <span className="text-xs text-slate-500">Select one or more</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(allComplaints).map((complaint, ccIdx) => {
            const colors = BADGE_PALETTE[ccIdx % BADGE_PALETTE.length];
            const isActive = selectedComplaints.includes(complaint);
            return (
              <Badge
                key={complaint}
                variant="outline"
                className={`cursor-pointer border min-h-[38px] flex items-center transition-all text-sm font-medium px-3 ${isActive ? colors.active : colors.base}`}
                onClick={() => handleTemplateSelect(complaint)}
              >
                {complaint}
                {isActive && <X className="h-3 w-3 ml-1" />}
              </Badge>
            );
          })}
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-slate-100 border-dashed min-h-[38px]"
            onClick={() => setShowAddDialog(true)}
            data-ocid="visit_form.open_modal_button"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Custom
          </Badge>
        </div>
        {selectedComplaints.length > 0 && (
          <Input
            value={selectedComplaints
              .map((c, idx) => `${idx + 1}. ${c}`)
              .join(", ")}
            readOnly
            className="bg-slate-50 h-11 text-sm"
            placeholder="Selected complaints"
          />
        )}
      </div>

      {/* Complaint Question Steppers */}
      {selectedComplaints.length > 0 && (
        <div className="space-y-5">
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-l-4 border-teal-500 p-4 rounded-lg">
            <p className="text-sm font-medium text-teal-900">
              📋 Please answer the following questions for each selected
              complaint
            </p>
          </div>
          {selectedComplaints.map((complaint) => (
            <Card
              key={complaint}
              className="border-2 border-teal-200 shadow-md"
            >
              <CardHeader className="pb-4 bg-gradient-to-r from-teal-500 to-blue-500 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                    <HelpCircle className="h-5 w-5" />
                    {complaint}
                  </CardTitle>
                  {canEditQuestions && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddQuestionToComplaint(complaint)}
                      className="h-8 text-white hover:bg-white/20"
                      data-ocid="visit_form.add_button"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Question
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <QuestionStepper
                  questions={getComplaintQuestions(complaint)}
                  answers={complaintAnswers[complaint] || []}
                  onChange={(idx, value) =>
                    handleAnswerChange(complaint, idx, value)
                  }
                  canEdit={canEditQuestions}
                  onEditQuestion={(idx, newText) =>
                    handleEditComplaintQuestion(complaint, idx, newText)
                  }
                  onAddOption={(idx, option) =>
                    handleAddComplaintOption(complaint, idx, option)
                  }
                  onDeleteOption={(idx, option) =>
                    handleDeleteComplaintOption(complaint, idx, option)
                  }
                />

                {/* Inline add-question form (Doctor/Admin only) */}
                {canEditQuestions && addingQuestionFor === complaint && (
                  <div className="border border-dashed border-teal-400 rounded-xl bg-teal-50/50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-teal-800">
                      New Question
                    </p>
                    <Input
                      value={newQuestionForComplaint.q}
                      onChange={(e) =>
                        setNewQuestionForComplaint((prev) => ({
                          ...prev,
                          q: e.target.value,
                        }))
                      }
                      placeholder="Question text / প্রশ্নের টেক্সট..."
                      className="h-10 bg-white border-teal-300 focus:border-teal-500"
                      data-ocid="visit_form.input"
                    />
                    {/* Options for the new question */}
                    {newQuestionForComplaint.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {newQuestionForComplaint.options.map((opt) => (
                          <Badge
                            key={opt}
                            variant="outline"
                            className="text-xs bg-white border-teal-300 text-teal-700 flex items-center gap-1"
                          >
                            {opt}
                            <button
                              type="button"
                              onClick={() =>
                                setNewQuestionForComplaint((prev) => ({
                                  ...prev,
                                  options: prev.options.filter(
                                    (o) => o !== opt,
                                  ),
                                }))
                              }
                              className="ml-0.5 hover:bg-teal-100 rounded-full p-0.5"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={newOptionDraftForQuestion}
                        onChange={(e) =>
                          setNewOptionDraftForQuestion(e.target.value)
                        }
                        placeholder="Add option (Enter to add)..."
                        className="h-9 bg-white border-teal-300 text-sm flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = newOptionDraftForQuestion.trim();
                            if (trimmed) {
                              setNewQuestionForComplaint((prev) => ({
                                ...prev,
                                options: [...prev.options, trimmed],
                              }));
                              setNewOptionDraftForQuestion("");
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 shrink-0"
                        onClick={() => {
                          const trimmed = newOptionDraftForQuestion.trim();
                          if (trimmed) {
                            setNewQuestionForComplaint((prev) => ({
                              ...prev,
                              options: [...prev.options, trimmed],
                            }));
                            setNewOptionDraftForQuestion("");
                          }
                        }}
                      >
                        + Option
                      </Button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 h-9"
                        onClick={() => commitNewQuestionForComplaint(complaint)}
                        data-ocid="visit_form.confirm_button"
                      >
                        Save Question
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setAddingQuestionFor(null)}
                        data-ocid="visit_form.cancel_button"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* History of Present Illness — ADMITTED patients only */}
      {visitType === "admitted" && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3 bg-blue-600 rounded-t-xl">
            <CardTitle className="text-base font-medium text-white">
              History of Present Illness / বর্তমান রোগের ইতিহাস
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <Textarea
              id="history_of_present_illness"
              value={formData.history_of_present_illness || ""}
              onChange={(e) =>
                handleChange("history_of_present_illness", e.target.value)
              }
              placeholder="Detailed history of the current illness..."
              rows={5}
              className="text-sm"
            />
          </CardContent>
        </Card>
      )}

      {/* System Review */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4 bg-slate-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium text-white">
              System Review / সিস্টেম রিভিউ
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const systemName = window.prompt("Enter new system name:");
                if (systemName?.trim()) {
                  setCustomSystems((prev) => ({
                    ...prev,
                    [systemName.trim()]: [],
                  }));
                }
              }}
              className="h-8 bg-white/10 text-white border-white/30 hover:bg-white/20"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add System
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {Object.entries({ ...systemReviewData, ...customSystems }).map(
            ([system, symptoms]) => (
              <div key={system} className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">
                  {system}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom, sIdx) => {
                    const colors = BADGE_PALETTE[sIdx % BADGE_PALETTE.length];
                    const isActive =
                      systemReviewAnswers[system]?.includes(symptom);
                    return (
                      <Badge
                        key={symptom}
                        variant="outline"
                        className={`cursor-pointer border min-h-[36px] flex items-center transition-all text-sm ${isActive ? colors.active : colors.base}`}
                        onClick={() => toggleSystemReview(system, symptom)}
                      >
                        {symptom}
                      </Badge>
                    );
                  })}
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-slate-100 border-dashed"
                    onClick={() => {
                      const symptom = window.prompt(
                        `Add symptom to ${system}:`,
                      );
                      if (symptom?.trim()) {
                        setCustomSystems((prev) => ({
                          ...prev,
                          [system]: [
                            ...(prev[system] || systemReviewData[system] || []),
                            symptom.trim(),
                          ],
                        }));
                      }
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Badge>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      {/* History Card */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-4 bg-amber-600 rounded-t-xl">
          <CardTitle className="text-base font-medium text-white">
            History / ইতিহাস
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Past Medical History */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">
              Past Medical History / অতীত চিকিৎসা ইতিহাস
            </Label>
            <div className="flex flex-wrap gap-2">
              {medicalHistoryOptions.map((condition) => (
                <Badge
                  key={condition}
                  variant="outline"
                  className={`cursor-pointer min-h-[36px] text-sm font-medium px-3 ${
                    medicalHistory[condition] === "+"
                      ? "bg-green-50 border-green-500 text-green-700"
                      : medicalHistory[condition] === "-"
                        ? "bg-red-50 border-red-500 text-red-700"
                        : ""
                  }`}
                  onClick={() => toggleMedicalHistory(condition)}
                >
                  {condition}
                  {medicalHistory[condition] || ""}
                </Badge>
              ))}
            </div>
            <Input
              value={
                ((formData as Record<string, unknown>)
                  .other_medical_history as string) || ""
              }
              onChange={(e) =>
                handleChange(
                  "other_medical_history" as keyof VisitFormData,
                  e.target.value,
                )
              }
              placeholder="Other chronic disease / অন্যান্য দীর্ঘমেয়াদী রোগ..."
              className="h-10 text-sm"
            />
          </div>

          {/* History sub-sections */}
          {historySections.map(
            ({ key, label, show, setShow, questions, answers, setAnswers }) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-700">
                    {label}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShow(!show)}
                    className="h-8"
                  >
                    {show ? "Hide" : "Answer"} Questions
                  </Button>
                </div>
                {show && (
                  <>
                    <QuestionStepper
                      questions={questions}
                      answers={answers}
                      onChange={(idx, value) => {
                        const a = [...answers];
                        a[idx] = value;
                        setAnswers(a);
                      }}
                    />
                    {key === "immunization" && (
                      <div className="mt-3 space-y-2 bg-lime-50 border border-lime-200 rounded-lg p-3">
                        <Label className="text-lime-800 font-semibold text-sm">
                          Immunized as per EPI Schedule / ইপিআই সূচি অনুযায়ী টিকা
                        </Label>
                        <div className="flex gap-3 flex-wrap">
                          {(["yes", "no"] as const).map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() =>
                                setEpiSchedule(epiSchedule === val ? "" : val)
                              }
                              className={`px-5 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                                epiSchedule === val
                                  ? val === "yes"
                                    ? "bg-lime-500 border-lime-500 text-white"
                                    : "bg-rose-500 border-rose-500 text-white"
                                  : "bg-white border-slate-300 text-slate-600 hover:border-lime-400"
                              }`}
                              data-ocid={`epi_schedule.${val === "yes" ? "primary_button" : "secondary_button"}`}
                            >
                              {val === "yes" ? "✓ Yes / হ্যাঁ" : "✗ No / না"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {key === "family" && (
                      <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
                        <Label className="text-rose-800 font-semibold text-sm">
                          🧬 Hereditary Risk Factors / বংশগত ঝুঁকি
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              {
                                key: "diabetes",
                                label: "Diabetes Mellitus / ডায়াবেটিস",
                              },
                              {
                                key: "hypertension",
                                label: "Hypertension / উচ্চ রক্তচাপ",
                              },
                              { key: "ihd", label: "IHD / হৃদরোগ" },
                              { key: "cancer", label: "Cancer / ক্যান্সার" },
                              { key: "stroke", label: "Stroke / স্ট্রোক" },
                            ] as {
                              key: keyof FamilyHistoryRisk;
                              label: string;
                            }[]
                          ).map((item) => (
                            <label
                              key={item.key}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${familyRisk[item.key] ? "bg-rose-100 border-rose-400" : "bg-white border-slate-200 hover:border-rose-300"}`}
                              data-ocid={`family_risk.${item.key}.checkbox`}
                            >
                              <input
                                type="checkbox"
                                checked={!!familyRisk[item.key]}
                                onChange={(e) => {
                                  const updated = {
                                    ...familyRisk,
                                    [item.key]: e.target.checked,
                                  };
                                  setFamilyRisk(updated);
                                  saveFamilyRisk(updated);
                                }}
                                className="w-4 h-4 accent-rose-600"
                              />
                              <span className="text-xs font-medium text-slate-700">
                                {item.label}
                              </span>
                            </label>
                          ))}
                        </div>
                        <Input
                          value={familyRisk.additionalNotes ?? ""}
                          onChange={(e) => {
                            const updated = {
                              ...familyRisk,
                              additionalNotes: e.target.value,
                            };
                            setFamilyRisk(updated);
                            saveFamilyRisk(updated);
                          }}
                          placeholder="Additional notes / অতিরিক্ত মন্তব্য"
                          className="h-9 text-sm bg-white border-rose-200"
                          data-ocid="family_risk.notes.input"
                        />
                      </div>
                    )}
                    {(extraHistoryQuestions[key] || []).map((item, eIdx) => (
                      <div
                        key={`ex-${key}-${item.q}-${eIdx}`}
                        className="space-y-2"
                      >
                        <Label className="text-sm font-medium text-blue-700">
                          {item.q}
                        </Label>
                        <Input
                          value={extraHistoryAnswers[key]?.[eIdx] || ""}
                          onChange={(e) => {
                            const arr = [...(extraHistoryAnswers[key] || [])];
                            arr[eIdx] = e.target.value;
                            setExtraHistoryAnswers((prev) => ({
                              ...prev,
                              [key]: arr,
                            }));
                          }}
                          placeholder="Type answer..."
                          className="h-10 bg-blue-50"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2 border-t border-dashed border-slate-200 mt-2">
                      <Input
                        value={newHistoryQuestionText[key] || ""}
                        onChange={(e) =>
                          setNewHistoryQuestionText((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder="Add a question..."
                        className="h-9 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addHistoryQuestion(key);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addHistoryQuestion(key)}
                        className="h-9 px-3 shrink-0"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ),
          )}

          {/* Drug History */}
          <div className="space-y-3 bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <Label className="text-fuchsia-700 font-semibold">
                Drug History / ওষুধের ইতিহাস
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDrugHistory}
                className="h-8"
                data-ocid="drug_history.add_button"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Drug
              </Button>
            </div>
            <div className="flex gap-2 items-center bg-slate-100 rounded-lg p-2">
              <Input
                id="drugSearchInput"
                placeholder="Search drug in Medex..."
                className="h-8 text-sm bg-white flex-1"
                data-ocid="drug_history.search_input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs whitespace-nowrap"
                onClick={() => {
                  const val = (
                    document.getElementById(
                      "drugSearchInput",
                    ) as HTMLInputElement
                  )?.value;
                  if (!val.trim()) {
                    toast.error("Enter a drug name first");
                    return;
                  }
                  window.open(
                    `https://medex.com.bd/?search=${encodeURIComponent(val.trim())}`,
                    "_blank",
                  );
                }}
                data-ocid="drug_history.medex_button"
              >
                Search Medex
              </Button>
            </div>
            {drugHistory.map((drug, index) => {
              // Show Current/Previous status badge if available from auto-update
              const status = (drug as Record<string, unknown>).status as
                | string
                | undefined;
              return (
                <Card
                  key={String(index)}
                  className={`p-3 ${status === "Previous" ? "bg-slate-100 border-slate-300 opacity-80" : "bg-slate-50 border-slate-200"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="col-span-1 space-y-1">
                        {status && (
                          <Badge
                            className={`text-xs h-5 ${status === "Current" ? "bg-green-100 text-green-700 border-green-300" : "bg-slate-200 text-slate-500 border-slate-300"}`}
                            variant="outline"
                          >
                            {status === "Current" ? "✓ Active" : "Previous"}
                          </Badge>
                        )}
                        <Input
                          value={drug.drug_name}
                          onChange={(e) =>
                            handleDrugHistoryChange(
                              index,
                              "drug_name",
                              e.target.value,
                            )
                          }
                          placeholder="Drug name"
                          className={`h-9 bg-white ${status === "Previous" ? "line-through text-slate-400" : ""}`}
                          data-ocid={`drug_history.input.${index + 1}`}
                        />
                      </div>
                      <Input
                        value={drug.dose}
                        onChange={(e) =>
                          handleDrugHistoryChange(index, "dose", e.target.value)
                        }
                        placeholder="Dose (e.g. 500mg)"
                        className="h-9 bg-white"
                      />
                      <Input
                        value={drug.daily_dose}
                        onChange={(e) =>
                          handleDrugHistoryChange(
                            index,
                            "daily_dose",
                            e.target.value,
                          )
                        }
                        placeholder="Frequency (e.g. 1+1+1)"
                        className="h-9 bg-white"
                      />
                    </div>
                    {drugHistory.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDrugHistory(index)}
                        className="h-9 w-9 text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Other History */}
          <div className="space-y-2">
            <Label
              htmlFor="other_history"
              className="text-sm font-semibold text-slate-700"
            >
              Other History / অন্যান্য ইতিহাস
            </Label>
            <Textarea
              id="other_history"
              value={formData.other_history || ""}
              onChange={(e) => handleChange("other_history", e.target.value)}
              placeholder="Other relevant history..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vital Signs — shown for both types */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-4 bg-green-600 rounded-t-xl">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
            <Activity className="h-5 w-5 text-white/80" />
            Vital Signs / জীবনের চিহ্ন
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-red-500" />
              Blood Pressure <UnitBadge>mmHg</UnitBadge>
            </Label>
            <Input
              type="text"
              value={formData.vital_signs?.blood_pressure || ""}
              onChange={(e) =>
                handleChange("vital_signs", {
                  ...formData.vital_signs,
                  blood_pressure: e.target.value,
                })
              }
              placeholder="120/80"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-pink-500" />
              Pulse Rate <UnitBadge>beats/min</UnitBadge>
            </Label>
            <Input
              type="number"
              value={formData.vital_signs?.pulse || ""}
              onChange={(e) => handleVitalChange("pulse", e.target.value)}
              placeholder="72"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-500" />
              Heart Rate <UnitBadge>beats/min</UnitBadge>
            </Label>
            <Input
              type="number"
              value={formData.vital_signs?.heart_rate || ""}
              onChange={(e) => handleVitalChange("heart_rate", e.target.value)}
              placeholder="72"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5 text-orange-500" />
              Temperature <UnitBadge>°C</UnitBadge>
            </Label>
            <Input
              type="number"
              step="0.1"
              value={formData.vital_signs?.temperature || ""}
              onChange={(e) => handleVitalChange("temperature", e.target.value)}
              placeholder="37.0"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Wind className="h-3.5 w-3.5 text-blue-500" />
              Resp. Rate <UnitBadge>breaths/min</UnitBadge>
            </Label>
            <Input
              type="number"
              value={formData.vital_signs?.respiratory_rate || ""}
              onChange={(e) =>
                handleVitalChange("respiratory_rate", e.target.value)
              }
              placeholder="16"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              SpO₂ <UnitBadge>%</UnitBadge>
            </Label>
            <Input
              type="number"
              value={formData.vital_signs?.oxygen_saturation || ""}
              onChange={(e) =>
                handleVitalChange("oxygen_saturation", e.target.value)
              }
              placeholder="98"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Weight <UnitBadge>kg</UnitBadge>
            </Label>
            <Input
              type="number"
              step="0.1"
              value={formData.vital_signs?.weight || ""}
              onChange={(e) => handleVitalChange("weight", e.target.value)}
              placeholder="65"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Height <UnitBadge>cm</UnitBadge>
            </Label>
            <Input
              type="number"
              step="0.1"
              value={formData.vital_signs?.height || ""}
              onChange={(e) => handleVitalChange("height", e.target.value)}
              placeholder="170"
              className="h-11 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* General Examination — shown for both types */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-4 bg-purple-600 rounded-t-xl">
          <CardTitle className="text-base font-medium text-white">
            General Examination / সাধারণ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {Object.entries(generalExaminationCategories).map(
            ([category, options]) => (
              <div key={category} className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">
                  {category}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {options.map((option, optIdx) => {
                    const colors = BADGE_PALETTE[optIdx % BADGE_PALETTE.length];
                    const isActive = generalExamFindings[category] === option;
                    return (
                      <Badge
                        key={option}
                        variant="outline"
                        className={`cursor-pointer border min-h-[36px] flex items-center transition-all text-sm ${isActive ? colors.active : colors.base}`}
                        onClick={() => toggleGeneralExam(category, option)}
                      >
                        {option}
                      </Badge>
                    );
                  })}
                </div>
                <Input
                  value={generalExamFindings[`${category}_note`] || ""}
                  onChange={(e) =>
                    setGeneralExamFindings((prev) => ({
                      ...prev,
                      [`${category}_note`]: e.target.value,
                    }))
                  }
                  placeholder={`Add note for ${category}...`}
                  className="h-9 text-sm bg-slate-50"
                />
              </div>
            ),
          )}
        </CardContent>
      </Card>

      {/* Systemic Examination — shown for both types */}
      <Card className="border-teal-200 bg-teal-50/30">
        <CardHeader className="pb-4 bg-teal-600 rounded-t-xl">
          <CardTitle className="text-base font-medium text-white">
            Systemic Examination / পদ্ধতিগত পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Quick-fill specialty templates */}
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
              Quick-fill Templates
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(EXAM_TEMPLATES).map((tName) => (
                <Button
                  key={tName}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-teal-400 text-teal-700 hover:bg-teal-50"
                  onClick={() => applyExamTemplate(tName)}
                  data-ocid={`exam_template.${tName.toLowerCase()}_button`}
                >
                  + {tName}
                </Button>
              ))}
            </div>
            {/* Template rows table */}
            {templateExamRows.length > 0 && (
              <div className="mt-3 border border-teal-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-teal-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-teal-800 w-2/5">
                        Finding
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-teal-800">
                        Value / Description
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {templateExamRows.map((row, idx) => (
                      <tr
                        key={`${row.finding}-${idx}`}
                        className="border-t border-teal-100 hover:bg-teal-50/50"
                      >
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-teal-400 rounded px-1 py-0.5 text-sm font-medium text-slate-800"
                            value={row.finding}
                            onChange={(e) =>
                              updateTemplateRow(idx, "finding", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-teal-400 rounded px-1 py-0.5 text-sm text-slate-700"
                            value={row.value}
                            onChange={(e) =>
                              updateTemplateRow(idx, "value", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeTemplateRow(idx)}
                            className="text-rose-400 hover:text-rose-600 p-1 rounded"
                            aria-label="Remove row"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-teal-50 border-t border-teal-100 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-teal-600"
                    onClick={() =>
                      setTemplateExamRows((prev) => [
                        ...prev,
                        { finding: "", value: "" },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Row
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Tabs defaultValue="cardiovascular">
            <TabsList className="flex flex-wrap w-full gap-1 h-auto">
              <TabsTrigger
                value="cardiovascular"
                className="flex-1 min-w-[70px]"
                data-ocid="systemic.cardiovascular.tab"
              >
                CVS
              </TabsTrigger>
              <TabsTrigger
                value="respiratory"
                className="flex-1 min-w-[70px]"
                data-ocid="systemic.respiratory.tab"
              >
                Respiratory
              </TabsTrigger>
              <TabsTrigger
                value="neurological"
                className="flex-1 min-w-[70px]"
                data-ocid="systemic.neurological.tab"
              >
                Neuro
              </TabsTrigger>
              <TabsTrigger
                value="gastrointestinal"
                className="flex-1 min-w-[70px]"
                data-ocid="systemic.gastrointestinal.tab"
              >
                GI
              </TabsTrigger>
              <TabsTrigger
                value="musculoskeletal"
                className="flex-1 min-w-[70px]"
                data-ocid="systemic.musculoskeletal.tab"
              >
                MSK
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cardiovascular">
              <CardiovascularExam
                data={cardiovascularExam}
                onChange={setCardiovascularExam}
              />
            </TabsContent>
            <TabsContent value="respiratory">
              <RespiratoryExam
                data={respiratoryExam}
                onChange={setRespiratoryExam}
              />
            </TabsContent>
            <TabsContent value="neurological">
              <NeurologicalExam
                data={neurologicalExam}
                onChange={setNeurologicalExam}
              />
            </TabsContent>
            <TabsContent value="gastrointestinal">
              <GastrointestinalExam
                data={gastrointestinalExam}
                onChange={setGastrointestinalExam}
              />
            </TabsContent>
            <TabsContent value="musculoskeletal">
              <MusculoskeletalExam
                data={musculoskeletalExam}
                onChange={setMusculoskeletalExam}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Previous Investigation Report */}
      <Card className="border-cyan-200 bg-cyan-50/30">
        <CardHeader className="pb-3 bg-cyan-600 rounded-t-xl">
          <CardTitle className="text-base font-medium text-white">
            Previous Investigation Report / পূর্ববর্তী তদন্ত প্রতিবেদন
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <PreviousInvestigationTable
            rows={
              Array.isArray(formData.previous_investigation_rows)
                ? formData.previous_investigation_rows
                : []
            }
            onChange={(rows) =>
              handleChange("previous_investigation_rows", rows)
            }
            onArchive={() => {
              const rows = formData.previous_investigation_rows || [];
              if (rows.length === 0) return;
              const key = `archived_investigations_${patientId}`;
              const existing = JSON.parse(localStorage.getItem(key) || "[]");
              localStorage.setItem(key, JSON.stringify([...existing, ...rows]));
              handleChange("previous_investigation_rows", []);
              toast.success("Investigation profile archived successfully.");
            }}
          />
          <p className="text-xs text-slate-400 mt-2">
            Five-field structured report. Values included in Auto-Generated
            Salient Features.
          </p>
        </CardContent>
      </Card>

      {/* Salient Features */}
      <Card className="border-rose-200 bg-rose-50/30">
        <CardHeader className="pb-3 bg-rose-600 rounded-t-xl">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span className="text-white">Salient Features / বিশেষ বৈশিষ্ট্য</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                handleChange("salient_features", generateSalientFeatures())
              }
              className="flex items-center gap-2 text-teal-700 border-teal-300 hover:bg-teal-50"
              data-ocid="salient_features.button"
            >
              <Sparkles className="h-4 w-4" />
              Auto-Generate
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.salient_features || ""}
            onChange={(e) => handleChange("salient_features", e.target.value)}
            placeholder="Click 'Auto-Generate' to build salient features from form data, or type manually..."
            rows={12}
            className="bg-slate-50 font-mono text-sm leading-relaxed"
            data-ocid="salient_features.textarea"
          />
        </CardContent>
      </Card>

      {/* Diagnosis */}
      <Card className="border-teal-200 bg-teal-50/30">
        <CardHeader className="pb-3 bg-teal-600 rounded-t-xl">
          <CardTitle className="text-base font-medium flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              Diagnosis / রোগ নির্ণয়
              {diagnosisStatus === "provisional" ? (
                <Badge className="bg-yellow-400 text-yellow-900 border-0 text-xs font-semibold">
                  Provisional
                </Badge>
              ) : (
                <Badge className="bg-green-400 text-green-900 border-0 text-xs font-semibold">
                  ✓ Final
                </Badge>
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const complaints =
                  selectedComplaints.length > 0
                    ? selectedComplaints.join(", ")
                    : formData.chief_complaint?.trim() || "";
                const pmh = Object.entries(medicalHistory)
                  .map(([k, v]) => `${k}${v}`)
                  .join(", ");
                handleChange(
                  "diagnosis",
                  `Based on clinical presentation and examination findings:\n\nPossible Diagnosis: [Review and enter diagnosis based on: ${complaints ? `complaints of ${complaints}, ` : ""}${pmh ? `history of ${pmh}, ` : ""}salient features reviewed]`,
                );
              }}
              className="flex items-center gap-2 text-teal-700 border-teal-200 hover:bg-teal-50"
              data-ocid="diagnosis.button"
            >
              <Sparkles className="h-4 w-4" />
              AI Generate
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {/* Provisional warning banner */}
          {diagnosisStatus === "provisional" && formData.diagnosis?.trim() && (
            <div
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3"
              data-ocid="diagnosis.provisional_warning"
            >
              <span className="text-yellow-800 text-sm flex-1">
                ⚠ Diagnosis is still marked as <strong>Provisional</strong> —
                please confirm as Final before writing prescription.
              </span>
              <Button
                type="button"
                size="sm"
                className="shrink-0 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                onClick={() => setDiagnosisStatus("final")}
                data-ocid="diagnosis.mark_final_button"
              >
                ✓ Mark as Final
              </Button>
            </div>
          )}
          {diagnosisStatus === "final" && formData.diagnosis?.trim() && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <span className="text-green-700 text-sm font-semibold">
                ✓ Final Diagnosis Confirmed
              </span>
              <button
                type="button"
                className="ml-auto text-xs text-green-600 underline"
                onClick={() => setDiagnosisStatus("provisional")}
              >
                Revert to Provisional
              </button>
            </div>
          )}
          <Textarea
            id="diagnosis"
            value={formData.diagnosis || ""}
            onChange={(e) => {
              handleChange("diagnosis", e.target.value);
              // Reset to provisional when diagnosis text changes
              if (diagnosisStatus === "final")
                setDiagnosisStatus("provisional");
            }}
            placeholder="Enter diagnosis here, or click AI Generate..."
            rows={3}
            className="bg-slate-50 text-sm"
            data-ocid="diagnosis.textarea"
          />
          {/* Mark Final button also shown below textarea when no text yet */}
          {diagnosisStatus === "provisional" && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs border-green-400 text-green-700 hover:bg-green-50"
                onClick={() => setDiagnosisStatus("final")}
                data-ocid="diagnosis.confirm_button"
              >
                ✓ Confirm Final Diagnosis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Differential Diagnosis */}
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader className="pb-3 bg-orange-600 rounded-t-xl">
          <CardTitle className="text-base font-medium flex items-center justify-between text-white">
            <span>Differential Diagnosis / ডিফারেনশিয়াল ডায়াগনসিস</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const complaints =
                    selectedComplaints.length > 0
                      ? selectedComplaints.join(", ")
                      : formData.chief_complaint?.trim() || "";
                  const pmh = Object.entries(medicalHistory)
                    .filter(([, v]) => v === "+")
                    .map(([k]) => k)
                    .join(", ");
                  const diagnosis = formData.diagnosis?.trim() || "";
                  handleChange(
                    "differential_diagnosis",
                    `Differential Diagnosis:\n\nBased on: ${complaints ? `complaints of ${complaints}` : "presenting symptoms"}${pmh ? `, history of ${pmh}` : ""}${diagnosis ? `, diagnosis of ${diagnosis}` : ""}\n\n1. [DDx 1]\n2. [DDx 2]\n3. [DDx 3]\n\nPlease review and edit based on clinical findings.`,
                  );
                }}
                className="flex items-center gap-2 text-violet-700 border-violet-300 hover:bg-violet-50"
              >
                <Sparkles className="h-4 w-4" />
                AI Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => ddImageInputRef.current?.click()}
                className="flex items-center gap-2 text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                Upload Image
              </Button>
              <input
                ref={ddImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={() => setDdImageConfirmOpen(true)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ddImageHasData && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              ⚠️ Image data extracted. Please review all values before
              finalizing.
            </div>
          )}
          <Textarea
            value={formData.differential_diagnosis || ""}
            onChange={(e) =>
              handleChange("differential_diagnosis", e.target.value)
            }
            placeholder="Click 'AI Generate' to suggest differential diagnoses, or enter manually..."
            rows={8}
            className="bg-slate-50 text-sm"
            data-ocid="differential_diagnosis.textarea"
          />
        </CardContent>
      </Card>

      {/* New Investigation Advice */}
      <Card className="border-lime-200 bg-lime-50/30">
        <CardHeader className="pb-3 bg-lime-600 rounded-t-xl">
          <CardTitle className="text-base font-medium flex items-center justify-between text-white">
            <span>New Investigation Advice / নতুন তদন্তের পরামর্শ</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleChange(
                  "investigation_advice",
                  "Suggested investigations:\n1. Complete Blood Count (CBC)\n2. Blood Glucose (Fasting & PP)\n3. Liver Function Tests (LFT)\n4. Renal Function Tests (RFT)\n5. Chest X-Ray\n6. ECG\n\n[Doctor to review and customize]",
                );
              }}
              className="flex items-center gap-2 text-teal-700 border-teal-300 hover:bg-teal-50"
            >
              <Sparkles className="h-4 w-4" />
              AI Suggest
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.investigation_advice || ""}
            onChange={(e) =>
              handleChange("investigation_advice", e.target.value)
            }
            placeholder="New investigation advice..."
            rows={4}
            className="bg-slate-50 text-sm"
            data-ocid="investigation_advice.textarea"
          />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 bg-slate-600 rounded-t-xl">
          <CardTitle className="text-base font-medium text-white">
            Additional Notes / অতিরিক্ত নোট
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <Textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Autosave indicator */}
      {autosavedAt && (
        <p className="text-xs text-muted-foreground text-right pr-1">
          <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
          Autosaved at{" "}
          {autosavedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      {/* Sticky Save Bar — mobile/tablet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card border-t shadow-2xl px-4 py-3">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-14 text-base font-semibold"
            data-ocid="visit_form.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 h-14 text-base font-semibold bg-teal-600 hover:bg-teal-700"
            data-ocid="visit_form.save_button"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Save Visit
          </Button>
        </div>
      </div>

      {/* Desktop Save Bar */}
      <div className="hidden lg:flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="px-8 h-12 text-base"
          data-ocid="visit_form.cancel_button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="px-10 h-12 text-base font-semibold bg-teal-600 hover:bg-teal-700"
          data-ocid="visit_form.save_button"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          Save Visit
        </Button>
      </div>

      {/* Add Custom Complaint Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg" data-ocid="visit_form.dialog">
          <DialogHeader>
            <DialogTitle>Add Custom Chief Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_complaint">Complaint Name *</Label>
              <Input
                id="new_complaint"
                value={newComplaint}
                onChange={(e) => setNewComplaint(e.target.value)}
                placeholder="e.g., Joint Pain"
                className="h-11"
                data-ocid="visit_form.input"
              />
            </div>
            <div className="space-y-3">
              <Label>Questions to Ask (at least 1 required)</Label>
              {newQuestions.map((item, idx) => (
                <div
                  key={String(idx)}
                  className="space-y-2 p-3 border rounded-lg bg-slate-50"
                >
                  <Input
                    value={item.q}
                    onChange={(e) =>
                      handleQuestionChange(idx, "question", e.target.value)
                    }
                    placeholder={`Question ${idx + 1}`}
                    className="h-10 bg-white"
                  />
                  <Input
                    value={item.options.join(", ")}
                    onChange={(e) =>
                      handleQuestionChange(idx, "options", e.target.value)
                    }
                    placeholder="Options (comma separated, optional)"
                    className="h-10 bg-white text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewComplaint("");
                  setNewQuestions([
                    { q: "", options: [] },
                    { q: "", options: [] },
                    { q: "", options: [] },
                    { q: "", options: [] },
                  ]);
                }}
                data-ocid="visit_form.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAddComplaint}
                className="bg-teal-600 hover:bg-teal-700"
                data-ocid="visit_form.confirm_button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Complaint
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DD Image Confirm Dialog */}
      <Dialog open={ddImageConfirmOpen} onOpenChange={setDdImageConfirmOpen}>
        <DialogContent data-ocid="dd_image.dialog">
          <DialogHeader>
            <DialogTitle>
              Confirm Image Upload for Differential Diagnosis
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Report Date</Label>
              <Input
                type="date"
                value={ddReportDate}
                onChange={(e) => setDdReportDate(e.target.value)}
                className="h-10"
              />
            </div>
            <p className="text-sm text-slate-600">
              The AI will attempt to extract differential diagnosis suggestions
              from the uploaded image. Please review all extracted content
              before saving.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setDdImageHasData(true);
                  setDdImageConfirmOpen(false);
                  toast.success(
                    "Image processed. Please review the extracted data.",
                  );
                }}
                className="flex-1"
                data-ocid="dd_image.confirm_button"
              >
                Confirm & Process
              </Button>
              <Button
                variant="outline"
                onClick={() => setDdImageConfirmOpen(false)}
                className="flex-1"
                data-ocid="dd_image.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
