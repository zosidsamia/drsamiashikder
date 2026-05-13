import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";
import CustomBadgeAdder from "./CustomBadgeAdder";

const gastrointestinalExamData = {
  inspection: {
    general: {
      en: "General Inspection",
      bn: "সাধারণ পরীক্ষা",
      findings: [
        { en: "Normal build", bn: "স্বাভাবিক গঠন" },
        { en: "Cachexia", bn: "কৃশতা" },
        { en: "Jaundice", bn: "জন্ডিস" },
        { en: "Pallor", bn: "ফ্যাকাশে" },
        { en: "Cyanosis", bn: "নীলাভ বর্ণ" },
        { en: "Clubbing", bn: "আঙুল ফুলে যাওয়া" },
        { en: "Koilonychia (spoon nails)", bn: "চামচ আকৃতির নখ" },
        { en: "Palmar erythema", bn: "হাতের তালু লাল" },
        { en: "Spider naevi", bn: "মাকড়সার মতো শিরা" },
      ],
    },
    abdomen: {
      en: "Abdominal Inspection",
      bn: "পেটের পরীক্ষা",
      findings: [
        { en: "Flat abdomen", bn: "সমতল পেট" },
        { en: "Distended abdomen", bn: "ফোলা পেট" },
        { en: "Scaphoid abdomen", bn: "দৈর্ঘ্য পেট" },
        { en: "Asymmetrical", bn: "অসম" },
        { en: "Visible peristalsis", bn: "দৃশ্যমান পেরিস্টালসিস" },
        { en: "Visible veins", bn: "দৃশ্যমান শিরা" },
        { en: "Umbilical hernia", bn: "নাভিতে হার্নিয়া" },
        { en: "Surgical scars", bn: "অপারেশনের দাগ" },
        { en: "Striae", bn: "প্রসারিত দাগ" },
        { en: "Caput medusae", bn: "মেডুসার মাথা" },
      ],
    },
  },
  palpation: {
    en: "Palpation",
    bn: "স্পর্শ পরীক্ষা",
    general: {
      en: "General palpation",
      bn: "সাধারণ স্পর্শ",
      findings: [
        { en: "Soft abdomen", bn: "নরম পেট" },
        { en: "Tender", bn: "ব্যথাযুক্ত" },
        { en: "Guarding", bn: "গার্ডিং" },
        { en: "Rigidity", bn: "শক্ত" },
        { en: "Rebound tenderness", bn: "রিবাউন্ড ব্যথা" },
        { en: "Mass present", bn: "গোটা আছে" },
      ],
    },
    organs: {
      en: "Organ palpation",
      bn: "অঙ্গ স্পর্শ",
      liver: {
        en: "Liver",
        bn: "যকৃত",
        options: [
          "Not palpable / স্পর্শ করা যায় না",
          "Palpable (normal) / স্পর্শযোগ্য (স্বাভাবিক)",
          "Enlarged / বড়",
          "Tender / ব্যথাযুক্ত",
          "Nodular / গোটাযুক্ত",
        ],
      },
      spleen: {
        en: "Spleen",
        bn: "প্লীহা",
        options: [
          "Not palpable / স্পর্শ করা যায় না",
          "Palpable (normal) / স্পর্শযোগ্য (স্বাভাবিক)",
          "Enlarged / বড়",
          "Tender / ব্যথাযুক্ত",
        ],
      },
      kidneys: {
        en: "Kidneys",
        bn: "কিডনি",
        options: [
          "Not palpable / স্পর্শ করা যায় না",
          "Right kidney palpable / ডান কিডনি স্পর্শযোগ্য",
          "Left kidney palpable / বাম কিডনি স্পর্শযোগ্য",
          "Both palpable / উভয়ই স্পর্শযোগ্য",
          "Ballotable / বেলটেবল",
        ],
      },
    },
  },
  percussion: {
    en: "Percussion",
    bn: "পারকাশন",
    findings: [
      { en: "Tympanic (normal)", bn: "টিম্পানিক (স্বাভাবিক)" },
      { en: "Dull - liver area", bn: "নিস্তব্ধ - যকৃত এলাকা" },
      { en: "Dull - spleen area", bn: "নিস্তব্ধ - প্লীহা এলাকা" },
      { en: "Shifting dullness (ascites)", bn: "সরানো নিস্তব্ধতা (জলোদর)" },
      { en: "Fluid thrill", bn: "তরল কম্পন" },
    ],
  },
  auscultation: {
    en: "Auscultation",
    bn: "শ্রবণ পরীক্ষা",
    bowelSounds: {
      en: "Bowel sounds",
      bn: "অন্ত্রের শব্দ",
      options: [
        { en: "Normal / স্বাভাবিক", value: "Normal" },
        { en: "Hyperactive / অতিসক্রিয়", value: "Hyperactive" },
        { en: "Hypoactive / কম সক্রিয়", value: "Hypoactive" },
        { en: "Absent / অনুপস্থিত", value: "Absent" },
        { en: "Tinkling sounds / ঝনঝন শব্দ", value: "Tinkling" },
      ],
    },
    vascularBruits: {
      en: "Vascular bruits",
      bn: "রক্তনালীর শব্দ",
      findings: [
        { en: "None / কোনটি নেই", bn: "কোনটি নেই" },
        { en: "Aortic bruit / মহাধমনীর শব্দ", bn: "মহাধমনীর শব্দ" },
        { en: "Renal artery bruit / কিডনির ধমনীর শব্দ", bn: "কিডনির ধমনীর শব্দ" },
        { en: "Hepatic bruit / যকৃতের শব্দ", bn: "যকৃতের শব্দ" },
      ],
    },
  },
  special: {
    en: "Special Tests",
    bn: "বিশেষ পরীক্ষা",
    tests: [
      { en: "Murphy's sign - Negative", bn: "মার্ফির চিহ্ন - নেতিবাচক" },
      { en: "Murphy's sign - Positive", bn: "মার্ফির চিহ্ন - ইতিবাচক" },
      { en: "Rovsing's sign - Negative", bn: "রভসিংয়ের চিহ্ন - নেতিবাচক" },
      { en: "Rovsing's sign - Positive", bn: "রভসিংয়ের চিহ্ন - ইতিবাচক" },
      { en: "McBurney's point tenderness", bn: "ম্যাকবার্নির পয়েন্ট ব্যথা" },
      { en: "Psoas sign - Negative", bn: "সোয়াস চিহ্ন - নেতিবাচক" },
      { en: "Psoas sign - Positive", bn: "সোয়াস চিহ্ন - ইতিবাচক" },
    ],
  },
};

type GiExamData = Record<string, unknown>;

interface GastrointestinalExamProps {
  data: GiExamData;
  onChange: (data: GiExamData) => void;
}

export default function GastrointestinalExam({
  data,
  onChange,
}: GastrointestinalExamProps) {
  const [examData, setExamData] = useState<GiExamData>(
    data || {
      inspection_general: [],
      inspection_abdomen: [],
      palpation_general: [],
      palpation_liver: "",
      palpation_spleen: "",
      palpation_kidneys: "",
      percussion: [],
      bowel_sounds: "",
      vascular_bruits: [],
      special_tests: [],
    },
  );

  const update = (patch: GiExamData) => {
    const newData = { ...examData, ...patch };
    setExamData(newData);
    onChange(newData);
  };

  const handleMultiSelect = (category: string, value: string) => {
    const current: string[] = (examData[category] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    update({ [category]: updated });
  };

  const handleSingleSelect = (field: string, value: string) => {
    update({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* 1. INSPECTION */}
      <Card className="border-2 border-cyan-200">
        <CardHeader className="bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-cyan-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              1
            </span>
            Inspection / পরিদর্শন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              {gastrointestinalExamData.inspection.general.en} /{" "}
              {gastrointestinalExamData.inspection.general.bn}
            </Label>
            <div className="flex flex-wrap gap-2">
              {gastrointestinalExamData.inspection.general.findings.map(
                (finding) => (
                  <Badge
                    key={finding.en}
                    variant={
                      (
                        (examData.inspection_general as string[]) || []
                      ).includes(finding.en)
                        ? "default"
                        : "outline"
                    }
                    className={`cursor-pointer text-sm py-2 px-3 ${((examData.inspection_general as string[]) || []).includes(finding.en) ? "bg-cyan-600" : ""}`}
                    onClick={() =>
                      handleMultiSelect("inspection_general", finding.en)
                    }
                  >
                    {finding.en} / {finding.bn}
                  </Badge>
                ),
              )}
            </div>
            <CustomBadgeAdder
              field="inspection_general"
              customField="custom_inspection_general"
              examData={examData}
              isMulti={true}
              accentColor="cyan-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              {gastrointestinalExamData.inspection.abdomen.en} /{" "}
              {gastrointestinalExamData.inspection.abdomen.bn}
            </Label>
            <div className="flex flex-wrap gap-2">
              {gastrointestinalExamData.inspection.abdomen.findings.map(
                (finding) => (
                  <Badge
                    key={finding.en}
                    variant={
                      (
                        (examData.inspection_abdomen as string[]) || []
                      ).includes(finding.en)
                        ? "default"
                        : "outline"
                    }
                    className={`cursor-pointer text-sm py-2 px-3 ${((examData.inspection_abdomen as string[]) || []).includes(finding.en) ? "bg-cyan-600" : ""}`}
                    onClick={() =>
                      handleMultiSelect("inspection_abdomen", finding.en)
                    }
                  >
                    {finding.en} / {finding.bn}
                  </Badge>
                ),
              )}
            </div>
            <CustomBadgeAdder
              field="inspection_abdomen"
              customField="custom_inspection_abdomen"
              examData={examData}
              isMulti={true}
              accentColor="cyan-600"
              onUpdate={update}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. PALPATION */}
      <Card className="border-2 border-lime-200">
        <CardHeader className="bg-gradient-to-r from-lime-500 to-lime-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-lime-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              2
            </span>
            {gastrointestinalExamData.palpation.en} /{" "}
            {gastrointestinalExamData.palpation.bn}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              {gastrointestinalExamData.palpation.general.en} /{" "}
              {gastrointestinalExamData.palpation.general.bn}
            </Label>
            <div className="flex flex-wrap gap-2">
              {gastrointestinalExamData.palpation.general.findings.map(
                (finding) => (
                  <Badge
                    key={finding.en}
                    variant={
                      ((examData.palpation_general as string[]) || []).includes(
                        finding.en,
                      )
                        ? "default"
                        : "outline"
                    }
                    className={`cursor-pointer text-sm py-2 px-3 ${((examData.palpation_general as string[]) || []).includes(finding.en) ? "bg-lime-600" : ""}`}
                    onClick={() =>
                      handleMultiSelect("palpation_general", finding.en)
                    }
                  >
                    {finding.en} / {finding.bn}
                  </Badge>
                ),
              )}
            </div>
            <CustomBadgeAdder
              field="palpation_general"
              customField="custom_palpation_general"
              examData={examData}
              isMulti={true}
              accentColor="lime-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-4">
            <Label className="text-base font-semibold text-slate-800">
              {gastrointestinalExamData.palpation.organs.en} /{" "}
              {gastrointestinalExamData.palpation.organs.bn}
            </Label>
            {(["liver", "spleen", "kidneys"] as const).map((organ) => (
              <div key={organ} className="space-y-2">
                <Label className="text-sm text-slate-600">
                  {gastrointestinalExamData.palpation.organs[organ].en} /{" "}
                  {gastrointestinalExamData.palpation.organs[organ].bn}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {gastrointestinalExamData.palpation.organs[organ].options.map(
                    (opt) => (
                      <Badge
                        key={opt}
                        variant={
                          examData[`palpation_${organ}`] === opt
                            ? "default"
                            : "outline"
                        }
                        className={`cursor-pointer text-xs py-1.5 px-2 ${examData[`palpation_${organ}`] === opt ? "bg-lime-600" : ""}`}
                        onClick={() =>
                          handleSingleSelect(`palpation_${organ}`, opt)
                        }
                      >
                        {opt}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. PERCUSSION */}
      <Card className="border-2 border-fuchsia-200">
        <CardHeader className="bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-fuchsia-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              3
            </span>
            {gastrointestinalExamData.percussion.en} /{" "}
            {gastrointestinalExamData.percussion.bn}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-2">
            {gastrointestinalExamData.percussion.findings.map((finding) => (
              <Badge
                key={finding.en}
                variant={
                  ((examData.percussion as string[]) || []).includes(finding.en)
                    ? "default"
                    : "outline"
                }
                className={`cursor-pointer text-sm py-2 px-3 ${((examData.percussion as string[]) || []).includes(finding.en) ? "bg-fuchsia-600" : ""}`}
                onClick={() => handleMultiSelect("percussion", finding.en)}
              >
                {finding.en} / {finding.bn}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. AUSCULTATION */}
      <Card className="border-2 border-sky-200">
        <CardHeader className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-sky-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              4
            </span>
            {gastrointestinalExamData.auscultation.en} /{" "}
            {gastrointestinalExamData.auscultation.bn}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              {gastrointestinalExamData.auscultation.bowelSounds.en} /{" "}
              {gastrointestinalExamData.auscultation.bowelSounds.bn}
            </Label>
            <div className="flex flex-wrap gap-2">
              {gastrointestinalExamData.auscultation.bowelSounds.options.map(
                (option) => (
                  <Badge
                    key={option.value}
                    variant={
                      examData.bowel_sounds === option.value
                        ? "default"
                        : "outline"
                    }
                    className={`cursor-pointer text-sm py-2 px-3 ${examData.bowel_sounds === option.value ? "bg-sky-600" : ""}`}
                    onClick={() =>
                      handleSingleSelect("bowel_sounds", option.value)
                    }
                  >
                    {option.en}
                  </Badge>
                ),
              )}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              {gastrointestinalExamData.auscultation.vascularBruits.en} /{" "}
              {gastrointestinalExamData.auscultation.vascularBruits.bn}
            </Label>
            <div className="flex flex-wrap gap-2">
              {gastrointestinalExamData.auscultation.vascularBruits.findings.map(
                (finding) => (
                  <Badge
                    key={finding.en}
                    variant={
                      ((examData.vascular_bruits as string[]) || []).includes(
                        finding.en,
                      )
                        ? "default"
                        : "outline"
                    }
                    className={`cursor-pointer text-sm py-2 px-3 ${((examData.vascular_bruits as string[]) || []).includes(finding.en) ? "bg-sky-600" : ""}`}
                    onClick={() =>
                      handleMultiSelect("vascular_bruits", finding.en)
                    }
                  >
                    {finding.en} / {finding.bn}
                  </Badge>
                ),
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. SPECIAL TESTS */}
      <Card className="border-2 border-violet-200">
        <CardHeader className="bg-gradient-to-r from-violet-500 to-violet-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-violet-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              5
            </span>
            {gastrointestinalExamData.special.en} /{" "}
            {gastrointestinalExamData.special.bn}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-2">
            {gastrointestinalExamData.special.tests.map((test) => (
              <Badge
                key={test.en}
                variant={
                  ((examData.special_tests as string[]) || []).includes(test.en)
                    ? "default"
                    : "outline"
                }
                className={`cursor-pointer text-sm py-2 px-3 ${((examData.special_tests as string[]) || []).includes(test.en) ? "bg-violet-600" : ""}`}
                onClick={() => handleMultiSelect("special_tests", test.en)}
              >
                {test.en} / {test.bn}
              </Badge>
            ))}
          </div>
          <CustomBadgeAdder
            field="special_tests"
            customField="custom_special_tests"
            examData={examData}
            isMulti={true}
            accentColor="violet-600"
            onUpdate={update}
          />
        </CardContent>
      </Card>
    </div>
  );
}
