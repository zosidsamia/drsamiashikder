import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bone, Brain, Heart, Layers, Plus, Search, Wind } from "lucide-react";
import React, { useState } from "react";
import QuestionStepper from "./QuestionStepper";

interface SystemicExaminationSectionProps {
  systemicExamFindings: Record<string, unknown>;
  onSystemicExamChange: (system: string, value: unknown) => void;
}

interface CustomSystem {
  label: string;
  questions: { q: string; options: string[] }[];
}

const systemsConfig = [
  {
    key: "Cardiovascular",
    label: "Cardiovascular System",
    labelBn: "হৃদ-সংবহন তন্ত্র",
    icon: Heart,
    headerBg: "bg-teal-600",
    borderColor: "border-teal-300",
    badgeBg: "bg-teal-50",
    questions: [
      {
        q: "Apex beat location / অ্যাপেক্স বিটের অবস্থান",
        options: [
          "Normal position (5th ICS MCL)",
          "Displaced laterally",
          "Displaced downward",
          "Not palpable",
        ],
      },
      {
        q: "Heart sounds / হার্টের শব্দ",
        options: [
          "S1 S2 normal",
          "S1 S2 + murmur",
          "S3 added",
          "S4 added",
          "Muffled",
        ],
      },
      {
        q: "Murmur / মার্মার",
        options: [
          "Absent",
          "Systolic murmur",
          "Diastolic murmur",
          "Continuous murmur",
        ],
      },
      {
        q: "Jugular venous pressure (JVP) / জেভিপি",
        options: ["Normal", "Raised", "Not visible"],
      },
      {
        q: "Peripheral pulses / প্রান্তিক নাড়ি",
        options: [
          "All present and equal",
          "Diminished",
          "Absent",
          "Asymmetric",
        ],
      },
      {
        q: "Pedal edema / পায়ের ফোলা",
        options: [
          "Absent",
          "Mild pitting",
          "Moderate pitting",
          "Severe pitting",
        ],
      },
      { q: "Additional findings / অতিরিক্ত ফলাফল", options: [] },
    ],
  },
  {
    key: "Respiratory",
    label: "Respiratory System",
    labelBn: "শ্বাসযন্ত্র",
    icon: Wind,
    headerBg: "bg-indigo-600",
    borderColor: "border-indigo-300",
    badgeBg: "bg-indigo-50",
    questions: [
      {
        q: "Chest expansion / বুকের প্রসারণ",
        options: [
          "Equal bilaterally",
          "Reduced right",
          "Reduced left",
          "Reduced bilaterally",
        ],
      },
      {
        q: "Trachea position / শ্বাসনালীর অবস্থান",
        options: ["Central", "Deviated right", "Deviated left"],
      },
      {
        q: "Percussion note / পার্কাশন নোট",
        options: [
          "Resonant bilaterally",
          "Dull right base",
          "Dull left base",
          "Hyperresonant",
          "Stony dull",
        ],
      },
      {
        q: "Breath sounds / শ্বাসের শব্দ",
        options: [
          "Vesicular bilaterally",
          "Bronchial breathing",
          "Reduced right",
          "Reduced left",
          "Absent",
        ],
      },
      {
        q: "Added sounds / অতিরিক্ত শব্দ",
        options: [
          "None",
          "Crackles (fine)",
          "Crackles (coarse)",
          "Wheeze",
          "Pleural rub",
        ],
      },
      {
        q: "Vocal resonance / ভোকাল রেজোন্যান্স",
        options: ["Normal", "Increased", "Decreased", "Aegophony"],
      },
      { q: "Additional findings / অতিরিক্ত ফলাফল", options: [] },
    ],
  },
  {
    key: "Gastrointestinal",
    label: "Gastrointestinal System",
    labelBn: "পরিপাক তন্ত্র",
    icon: Layers,
    headerBg: "bg-cyan-600",
    borderColor: "border-cyan-300",
    badgeBg: "bg-cyan-50",
    questions: [
      {
        q: "Abdomen shape / পেটের আকৃতি",
        options: ["Flat", "Scaphoid", "Distended", "Obese"],
      },
      {
        q: "Tenderness / ব্যথা",
        options: [
          "Non-tender",
          "Epigastric",
          "RUQ",
          "LUQ",
          "RIF",
          "LIF",
          "Generalized",
        ],
      },
      {
        q: "Guarding / গার্ডিং",
        options: ["Absent", "Mild", "Moderate", "Rigidity"],
      },
      {
        q: "Liver / যকৃত",
        options: [
          "Not palpable",
          "Enlarged (specify cm)",
          "Tender",
          "Non-tender",
        ],
      },
      {
        q: "Spleen / প্লীহা",
        options: ["Not palpable", "Enlarged", "Massively enlarged"],
      },
      {
        q: "Kidneys / কিডনি",
        options: [
          "Not palpable",
          "Right palpable",
          "Left palpable",
          "Both palpable",
          "Ballotable",
        ],
      },
      {
        q: "Bowel sounds / অন্ত্রের শব্দ",
        options: ["Normal", "Increased", "Reduced", "Absent", "Tinkling"],
      },
      {
        q: "Ascites / অ্যাসাইটিস",
        options: [
          "Absent",
          "Shifting dullness present",
          "Fluid thrill present",
        ],
      },
      { q: "Additional findings / অতিরিক্ত ফলাফল", options: [] },
    ],
  },
  {
    key: "Neurological",
    label: "Neurological System",
    labelBn: "স্নায়ুতন্ত্র",
    icon: Brain,
    headerBg: "bg-pink-600",
    borderColor: "border-pink-300",
    badgeBg: "bg-pink-50",
    questions: [
      {
        q: "Consciousness / চেতনা",
        options: ["Alert", "Drowsy", "Stuporous", "Comatose"],
      },
      {
        q: "Orientation / দিক নির্ণয়",
        options: [
          "Oriented to time/place/person",
          "Disoriented to time",
          "Disoriented to place",
          "Disoriented to person",
        ],
      },
      {
        q: "Cranial nerves / ক্রেনিয়াল নার্ভ",
        options: [
          "Intact",
          "II affected",
          "III/IV/VI affected",
          "VII affected",
          "Other - specify",
        ],
      },
      {
        q: "Motor power / মোটর শক্তি",
        options: [
          "Normal (5/5)",
          "Mild weakness",
          "Moderate weakness (3/5)",
          "Severe weakness (1-2/5)",
          "Plegia",
        ],
      },
      {
        q: "Tone / টোন",
        options: ["Normal", "Hypertonic", "Hypotonic", "Spastic", "Rigidity"],
      },
      {
        q: "Reflexes / রিফ্লেক্স",
        options: [
          "Normal",
          "Hyperreflexia",
          "Hyporeflexia",
          "Absent",
          "Plantar extensor",
        ],
      },
      {
        q: "Sensation / সংবেদন",
        options: ["Intact", "Reduced", "Absent", "Paresthesia"],
      },
      {
        q: "Coordination / সমন্বয়",
        options: ["Normal", "Ataxia", "Dysmetria", "Dysdiadochokinesia"],
      },
      { q: "Additional findings / অতিরিক্ত ফলাফল", options: [] },
    ],
  },
  {
    key: "Musculoskeletal",
    label: "Musculoskeletal System",
    labelBn: "পেশী-কঙ্কাল তন্ত্র",
    icon: Bone,
    headerBg: "bg-slate-600",
    borderColor: "border-slate-300",
    badgeBg: "bg-slate-50",
    questions: [
      {
        q: "Gait / চলাফেরা",
        options: [
          "Normal",
          "Antalgic",
          "Trendelenburg",
          "Ataxic",
          "Spastic",
          "Non-ambulatory",
        ],
      },
      {
        q: "Joint swelling / জয়েন্ট ফোলা",
        options: [
          "None",
          "Knee",
          "Hip",
          "Ankle",
          "Wrist",
          "Shoulder",
          "Multiple",
        ],
      },
      {
        q: "Joint tenderness / জয়েন্টে ব্যথা",
        options: ["None", "Present - specify"],
      },
      {
        q: "Range of motion / নড়াচড়ার পরিধি",
        options: ["Full ROM", "Restricted - specify"],
      },
      {
        q: "Muscle wasting / মাংসপেশির ক্ষয়",
        options: ["None", "Mild", "Moderate", "Severe"],
      },
      {
        q: "Deformity / বিকৃতি",
        options: ["None", "Valgus", "Varus", "Kyphosis", "Scoliosis", "Other"],
      },
      { q: "Additional findings / অতিরিক্ত ফলাফল", options: [] },
    ],
  },
];

export default function SystemicExaminationSection({
  systemicExamFindings,
  onSystemicExamChange,
}: SystemicExaminationSectionProps) {
  const [search, setSearch] = useState("");
  const [expandedSystems, setExpandedSystems] = useState<
    Record<string, boolean>
  >({});
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [customSystems, setCustomSystems] = useState<
    Record<string, CustomSystem>
  >({});
  const [newSystemName, setNewSystemName] = useState("");
  const [addingSystem, setAddingSystem] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState<
    Record<string, string>
  >({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string[]>>(
    {},
  );

  // systemicExamFindings is kept for prop compatibility
  void systemicExamFindings;

  const filteredSystems = search.trim()
    ? systemsConfig.filter(
        (s) =>
          s.label.toLowerCase().includes(search.toLowerCase()) ||
          s.labelBn.includes(search),
      )
    : systemsConfig;

  const toggleSystem = (key: string) => {
    setExpandedSystems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAnswer = (
    sysKey: string,
    questions: { q: string; options: string[] }[],
    idx: number,
    value: string,
  ) => {
    const newAnswers: Record<string, string[]> = {
      ...answers,
      [sysKey]: [...(answers[sysKey] || Array(questions.length).fill(""))],
    };
    newAnswers[sysKey][idx] = value;
    setAnswers(newAnswers);
    const findings: Record<string, string> = {};
    questions.forEach((q, i) => {
      if (newAnswers[sysKey]?.[i]) findings[q.q] = newAnswers[sysKey][i];
    });
    onSystemicExamChange(sysKey, findings);
  };

  const addCustomSystem = () => {
    const name = newSystemName.trim();
    if (!name) return;
    setCustomSystems((prev) => ({
      ...prev,
      [name]: { label: name, questions: [] },
    }));
    setExpandedSystems((prev) => ({ ...prev, [name]: true }));
    setNewSystemName("");
    setAddingSystem(false);
  };

  const addQuestionToSystem = (sysKey: string) => {
    const text = (newQuestionText[sysKey] || "").trim();
    if (!text) return;
    setCustomSystems((prev) => ({
      ...prev,
      [sysKey]: {
        ...prev[sysKey],
        questions: [...prev[sysKey].questions, { q: text, options: [] }],
      },
    }));
    setNewQuestionText((prev) => ({ ...prev, [sysKey]: "" }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-800">
            Systemic Examination
            <span className="ml-2 text-sm font-normal text-slate-500">
              / পদ্ধতিগত পরীক্ষা
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tap a system to expand and fill examination findings
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search system..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredSystems.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No system matches your search.
          </p>
        )}

        {filteredSystems.map((sys) => {
          const {
            key,
            label,
            labelBn,
            icon: Icon,
            headerBg,
            borderColor,
            badgeBg,
            questions,
          } = sys;
          const isOpen = !!expandedSystems[key];
          const sysAnswers = answers[key] || Array(questions.length).fill("");
          const filledCount = sysAnswers.filter((a) => a?.trim()).length;

          return (
            <Card
              key={key}
              className={`border-2 ${borderColor} overflow-hidden shadow-sm`}
            >
              <button
                type="button"
                onClick={() => toggleSystem(key)}
                className={`w-full flex items-center justify-between px-5 py-3 ${headerBg} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-white" />
                  <div className="text-left">
                    <p className="text-white font-semibold text-sm leading-tight">
                      {label}
                    </p>
                    <p className="text-white/70 text-xs leading-tight">
                      {labelBn}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {filledCount > 0 && (
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {filledCount}/{questions.length}
                    </span>
                  )}
                  <span className="text-white text-lg font-bold leading-none">
                    {isOpen ? "−" : "+"}
                  </span>
                </div>
              </button>

              {isOpen && (
                <CardContent className={`pt-4 pb-4 ${badgeBg}`}>
                  <QuestionStepper
                    questions={questions}
                    answers={sysAnswers}
                    onChange={(idx, value) =>
                      handleAnswer(key, questions, idx, value)
                    }
                  />
                </CardContent>
              )}
            </Card>
          );
        })}

        {Object.entries(customSystems).map(([sysKey, sys]) => {
          const isOpen = !!expandedSystems[sysKey];
          const cAnswers = customAnswers[sysKey] || [];
          return (
            <Card
              key={sysKey}
              className="border-2 border-violet-300 overflow-hidden shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleSystem(sysKey)}
                className="w-full flex items-center justify-between px-5 py-3 bg-violet-600 hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5 text-white" />
                  <p className="text-white font-semibold text-sm">
                    {sys.label}
                  </p>
                </div>
                <span className="text-white text-lg font-bold leading-none">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <CardContent className="pt-4 pb-4 bg-violet-50 space-y-3">
                  {sys.questions.length > 0 && (
                    <QuestionStepper
                      questions={sys.questions}
                      answers={cAnswers}
                      onChange={(idx, value) => {
                        const arr = [...cAnswers];
                        arr[idx] = value;
                        setCustomAnswers((prev) => ({
                          ...prev,
                          [sysKey]: arr,
                        }));
                      }}
                    />
                  )}

                  <div className="flex gap-2 pt-2 border-t border-dashed border-violet-200">
                    <Input
                      value={newQuestionText[sysKey] || ""}
                      onChange={(e) =>
                        setNewQuestionText((prev) => ({
                          ...prev,
                          [sysKey]: e.target.value,
                        }))
                      }
                      placeholder="Add a question to this system..."
                      className="h-9 text-sm bg-white"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addQuestionToSystem(sysKey);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addQuestionToSystem(sysKey)}
                      className="h-9 px-3 shrink-0 border-violet-400 text-violet-700"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {addingSystem ? (
          <div className="flex gap-2 items-center p-3 border-2 border-dashed border-violet-300 rounded-xl bg-violet-50">
            <Input
              value={newSystemName}
              onChange={(e) => setNewSystemName(e.target.value)}
              placeholder="System name (e.g. Dermatological)..."
              className="h-10 bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSystem();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={addCustomSystem}
              className="h-10 bg-violet-600 hover:bg-violet-700 shrink-0"
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAddingSystem(false)}
              className="h-10 shrink-0"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSystem(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add New System / নতুন সিস্টেম যোগ করুন
          </button>
        )}
      </div>
    </div>
  );
}
