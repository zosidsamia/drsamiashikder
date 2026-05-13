import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import React, { useState } from "react";
import CustomBadgeAdder from "./CustomBadgeAdder";

const LIMBS = [
  { key: "right_upper", en: "Right Upper", bn: "ডান উপরের" },
  { key: "left_upper", en: "Left Upper", bn: "বাম উপরের" },
  { key: "right_lower", en: "Right Lower", bn: "ডান নিচের" },
  { key: "left_lower", en: "Left Lower", bn: "বাম নিচের" },
];

const DTR_LIST = [
  { key: "biceps_r", en: "Biceps R", bn: "বাইসেপস ডান" },
  { key: "biceps_l", en: "Biceps L", bn: "বাইসেপস বাম" },
  { key: "triceps_r", en: "Triceps R", bn: "ট্রাইসেপস ডান" },
  { key: "triceps_l", en: "Triceps L", bn: "ট্রাইসেপস বাম" },
  { key: "knee_r", en: "Knee R", bn: "হাঁটু ডান" },
  { key: "knee_l", en: "Knee L", bn: "হাঁটু বাম" },
  { key: "ankle_r", en: "Ankle R", bn: "গোড়ালি ডান" },
  { key: "ankle_l", en: "Ankle L", bn: "গোড়ালি বাম" },
];

const neuroData = {
  inspection: {
    general: [
      { en: "Normal", bn: "স্বাভাবিক" },
      { en: "Facial asymmetry", bn: "মুখের অসমতা" },
      { en: "Ptosis", bn: "চোখের পাতা ঝুলে পড়া" },
      { en: "Nystagmus", bn: "নাইস্টাগমাস" },
      { en: "Tremor at rest", bn: "বিশ্রামে কাঁপুনি" },
      { en: "Intention tremor", bn: "ইনটেনশন ট্রেমর" },
      { en: "Fasciculations", bn: "ফ্যাসিকুলেশন" },
      { en: "Muscle wasting", bn: "পেশী ক্ষয়" },
      { en: "Abnormal posture", bn: "অস্বাভাবিক ভঙ্গি" },
      { en: "Abnormal gait", bn: "অস্বাভাবিক হাঁটা" },
    ],
    consciousness: [
      { en: "Alert & oriented", bn: "সজাগ ও অভিমুখ" },
      { en: "Confused", bn: "বিভ্রান্ত" },
      { en: "Drowsy", bn: "তন্দ্রাচ্ছন্ন" },
      { en: "Stuporous", bn: "স্তুপোরাস" },
      { en: "Comatose", bn: "কোমায়" },
    ],
  },
  palpation: {
    skull: [
      { en: "No tenderness", bn: "কোনো ব্যথা নেই" },
      { en: "Tenderness present", bn: "ব্যথা আছে" },
      { en: "Bony defect", bn: "হাড়ের ত্রুটি" },
    ],
    spine: [
      { en: "No tenderness", bn: "কোনো ব্যথা নেই" },
      { en: "Cervical tenderness", bn: "সার্ভিকাল ব্যথা" },
      { en: "Thoracic tenderness", bn: "থোরাসিক ব্যথা" },
      { en: "Lumbar tenderness", bn: "লাম্বার ব্যথা" },
    ],
    toneOptions: [
      "Normal / স্বাভাবিক",
      "Hypotonia / হাইপোটোনিয়া",
      "Hypertonia (spastic) / হাইপারটোনিয়া (স্প্যাস্টিক)",
      "Hypertonia (rigid) / হাইপারটোনিয়া (রিজিড)",
      "Cogwheel rigidity / কগহুইল রিজিডিটি",
    ],
    meningeal: [
      {
        key: "neck_rigidity",
        en: "Neck rigidity",
        bn: "ঘাড়ের শক্ততা",
        options: ["Absent / নেই", "Present / আছে"],
      },
      {
        key: "kernig",
        en: "Kernig's sign",
        bn: "কার্নিগের চিহ্ন",
        options: ["Negative / নেতিবাচক", "Positive / ইতিবাচক"],
      },
      {
        key: "brudzinski",
        en: "Brudzinski's sign",
        bn: "ব্রুজিন্সকির চিহ্ন",
        options: ["Negative / নেতিবাচক", "Positive / ইতিবাচক"],
      },
    ],
  },
  percussion: {
    dtrOptions: [
      "Normal / স্বাভাবিক",
      "Brisk / তীক্ষ্ণ",
      "Hyperreflexia / হাইপাররিফ্লেক্সিয়া",
      "Hyporeflexia / হাইপোরিফ্লেক্সিয়া",
      "Absent / অনুপস্থিত",
    ],
    plantarOptions: [
      { en: "Flexor (normal)", bn: "ফ্লেক্সর (স্বাভাবিক)" },
      { en: "Extensor (Babinski +ve)", bn: "এক্সটেনসর (বাবিনস্কি ধনাত্মক)" },
      { en: "No response", bn: "কোনো সাড়া নেই" },
    ],
  },
  auscultation: {
    carotid: [
      { en: "None", bn: "কোনটি নেই" },
      { en: "Right carotid bruit", bn: "ডান ক্যারোটিড ব্রুই" },
      { en: "Left carotid bruit", bn: "বাম ক্যারোটিড ব্রুই" },
      { en: "Bilateral", bn: "উভয় পাশে" },
    ],
    cranial: [
      { en: "None", bn: "কোনটি নেই" },
      { en: "Present over orbit", bn: "চোখের কোটরে আছে" },
      { en: "Present over skull", bn: "মাথার খুলিতে আছে" },
    ],
  },
};

type NeuroExamData = Record<string, unknown>;

interface NeurologicalExamProps {
  data: NeuroExamData;
  onChange: (data: NeuroExamData) => void;
}

export default function NeurologicalExam({
  data,
  onChange,
}: NeurologicalExamProps) {
  const [examData, setExamData] = useState<NeuroExamData>(
    data || {
      general_inspection: [],
      consciousness: "",
      skull_palpation: "",
      spine_palpation: "",
      muscle_tone: {},
      meningeal: {},
      dtr: {},
      plantar_right: "",
      plantar_left: "",
      carotid_bruits: "",
      cranial_bruits: "",
      auscultation_notes: "",
      coordination_tests: [],
      romberg: "",
      cognitive_tests: [],
    },
  );

  const update = (patch: NeuroExamData) => {
    const newData = { ...examData, ...patch };
    setExamData(newData);
    onChange(newData);
  };

  const toggleMulti = (field: string, value: string) => {
    const current: string[] = (examData[field] as string[]) || [];
    update({
      [field]: current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value],
    });
  };

  const setSingle = (field: string, value: string) =>
    update({ [field]: value });

  const setNested = (parent: string, key: string, value: string) => {
    const existing = (examData[parent] as Record<string, string>) || {};
    update({ [parent]: { ...existing, [key]: value } });
  };

  return (
    <div className="space-y-6">
      {/* 1. INSPECTION */}
      <Card className="border-2 border-slate-200">
        <CardHeader className="bg-gradient-to-r from-slate-500 to-purple-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              <span className="text-slate-700">1</span>
            </span>
            Inspection / পরিদর্শন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              General Findings / সাধারণ ফলাফল
            </Label>
            <div className="flex flex-wrap gap-2">
              {neuroData.inspection.general.map((opt) => {
                const active = (
                  (examData.general_inspection as string[]) || []
                ).includes(opt.en);
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-purple-600" : ""}`}
                    onClick={() => toggleMulti("general_inspection", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="general_inspection"
              customField="custom_general_inspection"
              examData={examData}
              isMulti={true}
              accentColor="purple-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Consciousness Level / চেতনার মাত্রা
            </Label>
            <div className="flex flex-wrap gap-2">
              {neuroData.inspection.consciousness.map((opt) => {
                const active = examData.consciousness === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-purple-600" : ""}`}
                    onClick={() => setSingle("consciousness", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. PALPATION */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              <span className="text-slate-700">2</span>
            </span>
            Palpation / স্পর্শ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Skull / মাথার খুলি
            </Label>
            <div className="flex flex-wrap gap-2">
              {neuroData.palpation.skull.map((opt) => {
                const active = examData.skull_palpation === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-blue-600" : ""}`}
                    onClick={() => setSingle("skull_palpation", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Spine / মেরুদণ্ড
            </Label>
            <div className="flex flex-wrap gap-2">
              {neuroData.palpation.spine.map((opt) => {
                const active = examData.spine_palpation === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-blue-600" : ""}`}
                    onClick={() => setSingle("spine_palpation", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">
              Muscle Tone / পেশীর টোন
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LIMBS.map((limb) => (
                <div key={limb.key} className="space-y-1">
                  <Label className="text-xs text-slate-500">
                    {limb.en} / {limb.bn}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {neuroData.palpation.toneOptions.map((opt) => {
                      const active =
                        (examData.muscle_tone as Record<string, string>)?.[
                          limb.key
                        ] === opt;
                      return (
                        <Badge
                          key={opt}
                          variant={active ? "default" : "outline"}
                          className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-blue-600" : ""}`}
                          onClick={() =>
                            setNested("muscle_tone", limb.key, opt)
                          }
                        >
                          {opt}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">
              Meningeal Signs / মেনিনজিয়াল চিহ্ন
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {neuroData.palpation.meningeal.map((sign) => (
                <div key={sign.key} className="space-y-1">
                  <Label className="text-xs text-slate-500">
                    {sign.en} / {sign.bn}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {sign.options.map((opt) => {
                      const active =
                        (examData.meningeal as Record<string, string>)?.[
                          sign.key
                        ] === opt;
                      return (
                        <Badge
                          key={opt}
                          variant={active ? "default" : "outline"}
                          className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-blue-600" : ""}`}
                          onClick={() => setNested("meningeal", sign.key, opt)}
                        >
                          {opt}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. PERCUSSION — Reflexes */}
      <Card className="border-2 border-violet-200">
        <CardHeader className="bg-gradient-to-r from-violet-500 to-violet-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              <span className="text-slate-700">3</span>
            </span>
            Percussion (Reflexes) / পারকাশন (রিফ্লেক্স)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Deep Tendon Reflexes / ডিপ টেন্ডন রিফ্লেক্স
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DTR_LIST.map((ref) => (
                <div key={ref.key} className="space-y-1">
                  <Label className="text-xs text-slate-500">
                    {ref.en} / {ref.bn}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {neuroData.percussion.dtrOptions.map((opt) => {
                      const active =
                        (examData.dtr as Record<string, string>)?.[ref.key] ===
                        opt;
                      return (
                        <Badge
                          key={opt}
                          variant={active ? "default" : "outline"}
                          className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-violet-600" : ""}`}
                          onClick={() => setNested("dtr", ref.key, opt)}
                        >
                          {opt}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { field: "plantar_right", label: "Plantar Right / ডান প্ল্যান্টার" },
              { field: "plantar_left", label: "Plantar Left / বাম প্ল্যান্টার" },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">
                  {label}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {neuroData.percussion.plantarOptions.map((opt) => {
                    const active = examData[field] === opt.en;
                    return (
                      <Badge
                        key={opt.en}
                        variant={active ? "default" : "outline"}
                        className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-violet-600" : ""}`}
                        onClick={() => setSingle(field, opt.en)}
                      >
                        {opt.en} / {opt.bn}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. AUSCULTATION */}
      <Card className="border-2 border-indigo-200">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              <span className="text-slate-700">4</span>
            </span>
            Auscultation / শ্রবণ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Carotid Bruits / ক্যারোটিড ব্রুই
            </Label>
            <div className="flex flex-wrap gap-2">
              {neuroData.auscultation.carotid.map((opt) => {
                const active = examData.carotid_bruits === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() => setSingle("carotid_bruits", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Cranial Bruits / ক্র্যানিয়াল ব্রুই
            </Label>
            <div className="flex flex-wrap gap-2">
              {neuroData.auscultation.cranial.map((opt) => {
                const active = examData.cranial_bruits === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() => setSingle("cranial_bruits", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Notes / নোট
            </Label>
            <Textarea
              value={(examData.auscultation_notes as string) || ""}
              onChange={(e) => update({ auscultation_notes: e.target.value })}
              placeholder="Additional auscultation findings..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. SPECIAL TESTS */}
      <Card className="border-2 border-amber-200">
        <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-amber-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              5
            </span>
            Special Tests / বিশেষ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Coordination Tests / সমন্বয় পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  en: "Finger-nose test - Normal",
                  bn: "আঙুল-নাক পরীক্ষা - স্বাভাবিক",
                },
                {
                  en: "Finger-nose test - Abnormal",
                  bn: "আঙুল-নাক পরীক্ষা - অস্বাভাবিক",
                },
                {
                  en: "Heel-shin test - Normal",
                  bn: "গোড়ালি-পায়ের হাঁটু পরীক্ষা - স্বাভাবিক",
                },
                {
                  en: "Heel-shin test - Abnormal",
                  bn: "গোড়ালি-পায়ের হাঁটু পরীক্ষা - অস্বাভাবিক",
                },
                {
                  en: "Rapid alternating movements - Normal",
                  bn: "দ্রুত পর্যায়ক্রমিক গতি - স্বাভাবিক",
                },
                {
                  en: "Rapid alternating movements - Abnormal",
                  bn: "দ্রুত পর্যায়ক্রমিক গতি - অস্বাভাবিক",
                },
              ].map((test) => {
                const active = (
                  (examData.coordination_tests as string[]) || []
                ).includes(test.en);
                return (
                  <Badge
                    key={test.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-amber-600" : ""}`}
                    onClick={() => toggleMulti("coordination_tests", test.en)}
                  >
                    {test.en} / {test.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="coordination_tests"
              customField="custom_coordination_tests"
              examData={examData}
              isMulti={true}
              accentColor="amber-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Romberg Test / রোমবার্গ পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { en: "Negative", bn: "নেতিবাচক" },
                { en: "Positive", bn: "ইতিবাচক" },
              ].map((opt) => {
                const active = examData.romberg === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-amber-600" : ""}`}
                    onClick={() => setSingle("romberg", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Cognitive Screening / জ্ঞানীয় পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { en: "MMSE score normal (≥24)", bn: "MMSE স্কোর স্বাভাবিক" },
                { en: "MMSE score impaired (<24)", bn: "MMSE স্কোর দুর্বল" },
                { en: "Orientation intact", bn: "দিক নির্ণয় স্বাভাবিক" },
                { en: "Orientation impaired", bn: "দিক নির্ণয় দুর্বল" },
              ].map((test) => {
                const active = (
                  (examData.cognitive_tests as string[]) || []
                ).includes(test.en);
                return (
                  <Badge
                    key={test.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-amber-600" : ""}`}
                    onClick={() => toggleMulti("cognitive_tests", test.en)}
                  >
                    {test.en} / {test.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
