import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type React from "react";
import { useState } from "react";
import CustomBadgeAdder from "./CustomBadgeAdder";

const ZONES = [
  { key: "upper_r", en: "Upper Right", bn: "উপরে ডান" },
  { key: "upper_l", en: "Upper Left", bn: "উপরে বাম" },
  { key: "middle_r", en: "Middle Right", bn: "মাঝে ডান" },
  { key: "middle_l", en: "Middle Left", bn: "মাঝে বাম" },
  { key: "lower_r", en: "Lower Right", bn: "নীচে ডান" },
  { key: "lower_l", en: "Lower Left", bn: "নীচে বাম" },
];

const respiratoryData = {
  inspection: {
    chestShape: [
      { en: "Normal chest", bn: "স্বাভাবিক বুক" },
      { en: "Barrel chest", bn: "ব্যারেল বুক" },
      { en: "Pectus excavatum", bn: "পেকটাস এক্সকেভেটাম" },
      { en: "Pectus carinatum", bn: "পেকটাস ক্যারিনেটাম" },
      { en: "Kyphoscoliosis", bn: "কাইফোস্কোলিওসিস" },
    ],
    symmetry: [
      { en: "Symmetrical", bn: "প্রতিসম" },
      { en: "Asymmetrical", bn: "অপ্রতিসম" },
      { en: "Unilateral expansion reduced", bn: "এক দিকে প্রসারণ কম" },
    ],
    breathingPattern: [
      { en: "Normal", bn: "স্বাভাবিক" },
      { en: "Tachypnoeic", bn: "দ্রুত শ্বাস" },
      { en: "Bradypnoeic", bn: "ধীর শ্বাস" },
      { en: "Cheyne-Stokes", bn: "চেইন-স্টোকস" },
      { en: "Kussmaul", bn: "কুসমল" },
      { en: "Biot's", bn: "বায়টের শ্বাস" },
    ],
    other: [
      { en: "Accessory muscle use", bn: "সহায়ক পেশী ব্যবহার" },
      { en: "Pursed lip breathing", bn: "ঠোঁট সংকুচিত শ্বাস" },
      { en: "Intercostal recession", bn: "পাঁজরের মধ্যবর্তী প্রত্যাহার" },
      { en: "Nasal flaring", bn: "নাকের পাখা প্রসারণ" },
      { en: "Cyanosis", bn: "নীলাভ বর্ণ" },
      { en: "Clubbing", bn: "আঙুল ফুলে যাওয়া" },
      { en: "Tracheal tug", bn: "শ্বাসনালী টান" },
    ],
  },
  palpation: {
    trachea: [
      { en: "Central", bn: "কেন্দ্রীয়" },
      { en: "Deviated to right", bn: "ডানে বিচ্যুত" },
      { en: "Deviated to left", bn: "বামে বিচ্যুত" },
    ],
    expansion: [
      { en: "Equal bilaterally", bn: "উভয় পাশে সমান" },
      { en: "Reduced right", bn: "ডানে কম" },
      { en: "Reduced left", bn: "বামে কম" },
      { en: "Reduced bilaterally", bn: "উভয় পাশে কম" },
    ],
    vocalFremitusSides: [
      { key: "vf_upper_r", en: "Upper Right", bn: "উপরে ডান" },
      { key: "vf_upper_l", en: "Upper Left", bn: "উপরে বাম" },
      { key: "vf_middle_r", en: "Middle Right", bn: "মাঝে ডান" },
      { key: "vf_middle_l", en: "Middle Left", bn: "মাঝে বাম" },
      { key: "vf_lower_r", en: "Lower Right", bn: "নীচে ডান" },
      { key: "vf_lower_l", en: "Lower Left", bn: "নীচে বাম" },
    ],
    vocalFremitusOptions: [
      "Normal / স্বাভাবিক",
      "Increased / বৃদ্ধি",
      "Decreased / হ্রাস",
      "Absent / অনুপস্থিত",
    ],
    tenderness: [
      { en: "No tenderness", bn: "কোনো ব্যথা নেই" },
      { en: "Tenderness present", bn: "ব্যথা আছে" },
    ],
  },
  percussion: {
    options: [
      "Resonant / রেজোন্যান্ট",
      "Dull / নিস্তব্ধ",
      "Stony dull / পাথরের মতো নিস্তব্ধ",
      "Hyperresonant / হাইপাররেজোন্যান্ট",
    ],
  },
  auscultation: {
    breathSoundOptions: [
      "Vesicular / ভেসিকুলার",
      "Bronchial / ব্রঙ্কিয়াল",
      "Bronchovesicular / ব্রঙ্কোভেসিকুলার",
      "Diminished / কম",
      "Absent / অনুপস্থিত",
    ],
    addedSounds: [
      { en: "Fine crackles", bn: "সূক্ষ্ম ক্র্যাকল" },
      { en: "Coarse crackles", bn: "মোটা ক্র্যাকল" },
      { en: "Wheeze", bn: "হুইজ" },
      { en: "Rhonchi", bn: "রঙ্কি" },
      { en: "Pleural rub", bn: "প্লুরাল রাব" },
      { en: "Stridor", bn: "স্ট্রিডোর" },
    ],
    vocalResonance: [
      { en: "Normal", bn: "স্বাভাবিক" },
      { en: "Increased", bn: "বৃদ্ধি" },
      { en: "Decreased", bn: "হ্রাস" },
      { en: "Aegophony present", bn: "অ্যাগোফোনি আছে" },
      { en: "Whispering pectoriloquy", bn: "ফিসফিসানো পেক্টোরিলোকুই" },
    ],
  },
};

type RespExamData = Record<string, unknown>;

interface RespiratoryExamProps {
  data: RespExamData;
  onChange: (data: RespExamData) => void;
}

export default function RespiratoryExam({
  data,
  onChange,
}: RespiratoryExamProps) {
  const [examData, setExamData] = useState<RespExamData>(
    data || {
      chest_shape: "",
      symmetry: "",
      breathing_pattern: "",
      other_inspection: [],
      trachea: "",
      expansion: "",
      vocal_fremitus: {},
      tenderness: "",
      percussion_zones: {},
      breath_sounds: {},
      added_sounds: [],
      vocal_resonance: "",
      special_tests: [],
    },
  );

  const update = (patch: RespExamData) => {
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

  const SectionCard = ({
    num,
    title,
    colorClass,
    headerClass,
    children,
  }: {
    num: number;
    title: string;
    colorClass: string;
    headerClass: string;
    children: React.ReactNode;
  }) => (
    <Card className={`border-2 ${colorClass}`}>
      <CardHeader className={`${headerClass} rounded-t-lg`}>
        <CardTitle className="text-white flex items-center gap-2">
          <span
            className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm"
            style={{ color: "inherit" }}
          >
            <span className="text-slate-700">{num}</span>
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">{children}</CardContent>
    </Card>
  );

  const BadgeGroup = ({
    label,
    field,
    options,
    single,
    customField,
    accentColor,
  }: {
    label: string;
    field: string;
    options: { en: string; bn: string }[];
    single?: boolean;
    customField?: string;
    accentColor?: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = single
            ? examData[field] === opt.en
            : ((examData[field] as string[]) || []).includes(opt.en);
          return (
            <Badge
              key={opt.en}
              variant={active ? "default" : "outline"}
              className={`cursor-pointer text-sm py-2 px-3 ${active ? `bg-${accentColor || "teal-600"}` : ""}`}
              onClick={() =>
                single ? setSingle(field, opt.en) : toggleMulti(field, opt.en)
              }
            >
              {opt.en} / {opt.bn}
            </Badge>
          );
        })}
      </div>
      {customField && (
        <CustomBadgeAdder
          field={field}
          customField={customField}
          examData={examData}
          isMulti={!single}
          accentColor={accentColor || "teal-600"}
          onUpdate={update}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. INSPECTION */}
      <SectionCard
        num={1}
        title="Inspection / পরিদর্শন"
        colorClass="border-teal-200"
        headerClass="bg-gradient-to-r from-teal-500 to-teal-600"
      >
        <BadgeGroup
          label="Chest Shape / বুকের আকৃতি"
          field="chest_shape"
          options={respiratoryData.inspection.chestShape}
          single
          customField="custom_chest_shape"
          accentColor="teal-600"
        />
        <BadgeGroup
          label="Symmetry / প্রতিসম্মতা"
          field="symmetry"
          options={respiratoryData.inspection.symmetry}
          single
        />
        <BadgeGroup
          label="Breathing Pattern / শ্বাসের ধরন"
          field="breathing_pattern"
          options={respiratoryData.inspection.breathingPattern}
          single
          customField="custom_breathing_pattern"
          accentColor="teal-600"
        />
        <BadgeGroup
          label="Other Findings / অন্যান্য"
          field="other_inspection"
          options={respiratoryData.inspection.other}
          customField="custom_other_inspection"
          accentColor="teal-600"
        />
      </SectionCard>

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
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Trachea / শ্বাসনালী
            </Label>
            <div className="flex flex-wrap gap-2">
              {respiratoryData.palpation.trachea.map((opt) => {
                const active = examData.trachea === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-blue-600" : ""}`}
                    onClick={() => setSingle("trachea", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Chest Expansion / বুকের প্রসারণ
            </Label>
            <div className="flex flex-wrap gap-2">
              {respiratoryData.palpation.expansion.map((opt) => {
                const active = examData.expansion === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-blue-600" : ""}`}
                    onClick={() => setSingle("expansion", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">
              Vocal Fremitus / ভোকাল ফ্রেমিটাস
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {respiratoryData.palpation.vocalFremitusSides.map((side) => (
                <div key={side.key} className="space-y-1">
                  <Label className="text-xs text-slate-500">
                    {side.en} / {side.bn}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {respiratoryData.palpation.vocalFremitusOptions.map(
                      (opt) => {
                        const active =
                          (examData.vocal_fremitus as Record<string, string>)?.[
                            side.key
                          ] === opt;
                        return (
                          <Badge
                            key={opt}
                            variant={active ? "default" : "outline"}
                            className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-blue-600" : ""}`}
                            onClick={() =>
                              setNested("vocal_fremitus", side.key, opt)
                            }
                          >
                            {opt}
                          </Badge>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Tenderness / ব্যথা
            </Label>
            <div className="flex flex-wrap gap-2">
              {respiratoryData.palpation.tenderness.map((opt) => {
                const active = examData.tenderness === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-blue-600" : ""}`}
                    onClick={() => setSingle("tenderness", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. PERCUSSION */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              <span className="text-slate-700">3</span>
            </span>
            Percussion / পারকাশন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ZONES.map((zone) => (
              <div key={zone.key} className="space-y-1">
                <Label className="text-xs text-slate-500">
                  {zone.en} / {zone.bn}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {respiratoryData.percussion.options.map((opt) => {
                    const active =
                      (examData.percussion_zones as Record<string, string>)?.[
                        zone.key
                      ] === opt;
                    return (
                      <Badge
                        key={opt}
                        variant={active ? "default" : "outline"}
                        className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-purple-600" : ""}`}
                        onClick={() =>
                          setNested("percussion_zones", zone.key, opt)
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
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Breath Sounds / শ্বাসের শব্দ
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ZONES.map((zone) => (
                <div key={zone.key} className="space-y-1">
                  <Label className="text-xs text-slate-500">
                    {zone.en} / {zone.bn}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {respiratoryData.auscultation.breathSoundOptions.map(
                      (opt) => {
                        const active =
                          (examData.breath_sounds as Record<string, string>)?.[
                            zone.key
                          ] === opt;
                        return (
                          <Badge
                            key={opt}
                            variant={active ? "default" : "outline"}
                            className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-indigo-600" : ""}`}
                            onClick={() =>
                              setNested("breath_sounds", zone.key, opt)
                            }
                          >
                            {opt}
                          </Badge>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Added Sounds / অতিরিক্ত শব্দ
            </Label>
            <div className="flex flex-wrap gap-2">
              {respiratoryData.auscultation.addedSounds.map((opt) => {
                const active = (
                  (examData.added_sounds as string[]) || []
                ).includes(opt.en);
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() => toggleMulti("added_sounds", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="added_sounds"
              customField="custom_added_sounds"
              examData={examData}
              isMulti={true}
              accentColor="indigo-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Vocal Resonance / ভোকাল রেজোন্যান্স
            </Label>
            <div className="flex flex-wrap gap-2">
              {respiratoryData.auscultation.vocalResonance.map((opt) => {
                const active = examData.vocal_resonance === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() => setSingle("vocal_resonance", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. SPECIAL TESTS */}
      <Card className="border-2 border-rose-200">
        <CardHeader className="bg-gradient-to-r from-rose-500 to-rose-600">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-rose-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              5
            </span>
            Special Tests / বিশেষ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-2">
            {[
              { en: "Peak Flow - Normal", bn: "পিক ফ্লো - স্বাভাবিক" },
              { en: "Peak Flow - Reduced", bn: "পিক ফ্লো - কম" },
              { en: "Spirometry - Normal", bn: "স্পাইরোমেট্রি - স্বাভাবিক" },
              { en: "Spirometry - Obstructive", bn: "স্পাইরোমেট্রি - অব্স্ট্রাক্টিভ" },
              { en: "Spirometry - Restrictive", bn: "স্পাইরোমেট্রি - রেস্ট্রিক্টিভ" },
              { en: "6-min walk test - Normal", bn: "৬ মিনিট হাঁটা - স্বাভাবিক" },
              { en: "6-min walk test - Reduced", bn: "৬ মিনিট হাঁটা - কম" },
              {
                en: "Bronchodilator response - Positive",
                bn: "ব্রঙ্কোডাইলেটর সাড়া - ইতিবাচক",
              },
              {
                en: "Bronchodilator response - Negative",
                bn: "ব্রঙ্কোডাইলেটর সাড়া - নেতিবাচক",
              },
            ].map((test) => {
              const active = (
                (examData.special_tests as string[]) || []
              ).includes(test.en);
              return (
                <Badge
                  key={test.en}
                  variant={active ? "default" : "outline"}
                  className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-rose-600" : ""}`}
                  onClick={() => toggleMulti("special_tests", test.en)}
                >
                  {test.en} / {test.bn}
                </Badge>
              );
            })}
          </div>
          <CustomBadgeAdder
            field="special_tests"
            customField="custom_special_tests"
            examData={examData}
            isMulti={true}
            accentColor="rose-600"
            onUpdate={update}
          />
        </CardContent>
      </Card>
    </div>
  );
}
