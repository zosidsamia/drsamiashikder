import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";
import CustomBadgeAdder from "./CustomBadgeAdder";

const JOINTS = [
  { key: "shoulder_r", en: "Right Shoulder", bn: "ডান কাঁধ" },
  { key: "shoulder_l", en: "Left Shoulder", bn: "বাম কাঁধ" },
  { key: "elbow_r", en: "Right Elbow", bn: "ডান কনুই" },
  { key: "elbow_l", en: "Left Elbow", bn: "বাম কনুই" },
  { key: "wrist_r", en: "Right Wrist", bn: "ডান কব্জি" },
  { key: "wrist_l", en: "Left Wrist", bn: "বাম কব্জি" },
  { key: "knee_r", en: "Right Knee", bn: "ডান হাঁটু" },
  { key: "knee_l", en: "Left Knee", bn: "বাম হাঁটু" },
  { key: "ankle_r", en: "Right Ankle", bn: "ডান গোড়ালি" },
  { key: "ankle_l", en: "Left Ankle", bn: "বাম গোড়ালি" },
  { key: "hip_r", en: "Right Hip", bn: "ডান নিতম্ব" },
  { key: "hip_l", en: "Left Hip", bn: "বাম নিতম্ব" },
];

const mskData = {
  inspection: {
    general: [
      { en: "Normal posture", bn: "স্বাভাবিক ভঙ্গি" },
      { en: "Abnormal posture", bn: "অস্বাভাবিক ভঙ্গি" },
      { en: "Muscle wasting", bn: "পেশী ক্ষয়" },
      { en: "Joint swelling", bn: "জয়েন্ট ফোলা" },
      { en: "Joint deformity", bn: "জয়েন্ট বিকৃতি" },
      { en: "Skin changes", bn: "ত্বকের পরিবর্তন" },
      { en: "Erythema (redness)", bn: "লালভাব" },
      { en: "Warmth", bn: "উষ্ণতা" },
      { en: "Scars", bn: "দাগ" },
      { en: "Limb length discrepancy", bn: "অঙ্গের দৈর্ঘ্যের পার্থক্য" },
    ],
    spine: [
      { en: "Normal curvature", bn: "স্বাভাবিক বক্রতা" },
      { en: "Kyphosis", bn: "কাইফোসিস" },
      { en: "Lordosis", bn: "লর্ডোসিস" },
      { en: "Scoliosis", bn: "স্কোলিওসিস" },
      { en: "Flat back", bn: "সমতল পিঠ" },
    ],
  },
  palpation: {
    jointOptions: [
      "Normal / স্বাভাবিক",
      "Tender / ব্যথাযুক্ত",
      "Swollen / ফোলা",
      "Warmth / উষ্ণ",
      "Crepitus / ক্রেপিটাস",
      "Deformed / বিকৃত",
    ],
    muscleTenderness: [
      { en: "None", bn: "কোনটি নেই" },
      { en: "Localized", bn: "স্থানীয়" },
      { en: "Generalized", bn: "সাধারণীকৃত" },
    ],
    boneTenderness: [
      { en: "None", bn: "কোনটি নেই" },
      { en: "Present", bn: "আছে" },
    ],
  },
  percussion: {
    spine: [
      { en: "No pain", bn: "কোনো ব্যথা নেই" },
      { en: "Tenderness on percussion", bn: "পারকাশনে ব্যথা" },
    ],
    bone: [
      { en: "No tenderness", bn: "কোনো ব্যথা নেই" },
      { en: "Tenderness present", bn: "ব্যথা আছে" },
    ],
    special: [
      { en: "Heel strike test - Negative", bn: "হিল স্ট্রাইক পরীক্ষা - নেতিবাচক" },
      { en: "Heel strike test - Positive", bn: "হিল স্ট্রাইক পরীক্ষা - ইতিবাচক" },
      {
        en: "Fist percussion spine - Negative",
        bn: "মুষ্টি পারকাশন মেরুদণ্ড - নেতিবাচক",
      },
      {
        en: "Fist percussion spine - Positive",
        bn: "মুষ্টি পারকাশন মেরুদণ্ড - ইতিবাচক",
      },
    ],
  },
  auscultation: {
    jointSounds: [
      { en: "No abnormal sounds", bn: "কোনো অস্বাভাবিক শব্দ নেই" },
      { en: "Fine crepitus", bn: "সূক্ষ্ম ক্রেপিটাস" },
      { en: "Coarse crepitus", bn: "মোটা ক্রেপিটাস" },
      { en: "Click", bn: "ক্লিক" },
      { en: "Clunk", bn: "ক্লাঙ্ক" },
      { en: "Snap", bn: "স্ন্যাপ" },
    ],
    vascular: [
      { en: "None", bn: "কোনটি নেই" },
      { en: "Bruit over joint", bn: "জয়েন্টে ব্রুই" },
    ],
    gait: [
      { en: "Normal gait", bn: "স্বাভাবিক হাঁটা" },
      { en: "Antalgic gait", bn: "ব্যথায় হাঁটা" },
      { en: "Trendelenburg gait", bn: "ট্রেন্ডেলেনবার্গ হাঁটা" },
      { en: "Waddling gait", bn: "ওয়াডলিং হাঁটা" },
      { en: "High stepping gait", bn: "উঁচু পদক্ষেপ" },
      { en: "Scissoring gait", bn: "কাঁচির মতো হাঁটা" },
      { en: "Ataxic gait", bn: "অ্যাটাক্সিক হাঁটা" },
    ],
  },
};

type MskExamData = Record<string, unknown>;

interface MusculoskeletalExamProps {
  data: MskExamData;
  onChange: (data: MskExamData) => void;
}

export default function MusculoskeletalExam({
  data,
  onChange,
}: MusculoskeletalExamProps) {
  const [examData, setExamData] = useState<MskExamData>(
    data || {
      inspection_general: [],
      inspection_spine: [],
      joint_findings: {},
      muscle_tenderness: "",
      bone_tenderness: "",
      bone_tenderness_area: "",
      spine_percussion: "",
      bone_percussion: "",
      special_percussion: [],
      joint_sounds: [],
      vascular_sounds: "",
      gait: [],
      special_tests_shoulder: [],
      special_tests_knee: [],
      special_tests_spine: [],
    },
  );

  const update = (patch: MskExamData) => {
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
        <CardHeader className="bg-gradient-to-r from-slate-500 to-slate-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-slate-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              1
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
              {mskData.inspection.general.map((opt) => {
                const active = (
                  (examData.inspection_general as string[]) || []
                ).includes(opt.en);
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-slate-600" : ""}`}
                    onClick={() => toggleMulti("inspection_general", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="inspection_general"
              customField="custom_inspection_general"
              examData={examData}
              isMulti={true}
              accentColor="slate-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Spine Shape / মেরুদণ্ডের আকৃতি
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.inspection.spine.map((opt) => {
                const active = (
                  (examData.inspection_spine as string[]) || []
                ).includes(opt.en);
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-slate-600" : ""}`}
                    onClick={() => toggleMulti("inspection_spine", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="inspection_spine"
              customField="custom_inspection_spine"
              examData={examData}
              isMulti={true}
              accentColor="slate-600"
              onUpdate={update}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. PALPATION */}
      <Card className="border-2 border-orange-200">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-orange-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              2
            </span>
            Palpation / স্পর্শ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Joint Findings / জয়েন্টের ফলাফল
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {JOINTS.map((joint) => (
                <div key={joint.key} className="space-y-1">
                  <Label className="text-xs text-slate-500">
                    {joint.en} / {joint.bn}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {mskData.palpation.jointOptions.map((opt) => {
                      const active =
                        (examData.joint_findings as Record<string, string>)?.[
                          joint.key
                        ] === opt;
                      return (
                        <Badge
                          key={opt}
                          variant={active ? "default" : "outline"}
                          className={`cursor-pointer text-xs py-1 px-2 ${active ? "bg-orange-600" : ""}`}
                          onClick={() =>
                            setNested("joint_findings", joint.key, opt)
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
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Muscle Tenderness / পেশীর ব্যথা
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.palpation.muscleTenderness.map((opt) => {
                const active = examData.muscle_tenderness === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-orange-600" : ""}`}
                    onClick={() => setSingle("muscle_tenderness", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Bone Tenderness / হাড়ের ব্যথা
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.palpation.boneTenderness.map((opt) => {
                const active = examData.bone_tenderness === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-orange-600" : ""}`}
                    onClick={() => setSingle("bone_tenderness", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
            {examData.bone_tenderness === "Present" && (
              <Input
                value={(examData.bone_tenderness_area as string) || ""}
                onChange={(e) =>
                  update({ bone_tenderness_area: e.target.value })
                }
                placeholder="Specify area / এলাকা উল্লেখ করুন"
                className="mt-2"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. PERCUSSION */}
      <Card className="border-2 border-yellow-200">
        <CardHeader className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-yellow-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              3
            </span>
            Percussion / পারকাশন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Spine Percussion / মেরুদণ্ড পারকাশন
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.percussion.spine.map((opt) => {
                const active = examData.spine_percussion === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-yellow-600" : ""}`}
                    onClick={() => setSingle("spine_percussion", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Bone Percussion / হাড়ের পারকাশন
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.percussion.bone.map((opt) => {
                const active = examData.bone_percussion === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-yellow-600" : ""}`}
                    onClick={() => setSingle("bone_percussion", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Special Percussion Tests / বিশেষ পারকাশন পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.percussion.special.map((opt) => {
                const active = (
                  (examData.special_percussion as string[]) || []
                ).includes(opt.en);
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-yellow-600" : ""}`}
                    onClick={() => toggleMulti("special_percussion", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. AUSCULTATION */}
      <Card className="border-2 border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-green-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              4
            </span>
            Auscultation & Gait / শ্রবণ ও গতি পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Joint Sounds / জয়েন্টের শব্দ
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.auscultation.jointSounds.map((opt) => {
                const active = (
                  (examData.joint_sounds as string[]) || []
                ).includes(opt.en);
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-green-600" : ""}`}
                    onClick={() => toggleMulti("joint_sounds", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Vascular Sounds / রক্তনালীর শব্দ
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.auscultation.vascular.map((opt) => {
                const active = examData.vascular_sounds === opt.en;
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-green-600" : ""}`}
                    onClick={() => setSingle("vascular_sounds", opt.en)}
                  >
                    {opt.en} / {opt.bn}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              Gait Observation / হাঁটার পর্যবেক্ষণ
            </Label>
            <div className="flex flex-wrap gap-2">
              {mskData.auscultation.gait.map((opt) => {
                const active = ((examData.gait as string[]) || []).includes(
                  opt.en,
                );
                return (
                  <Badge
                    key={opt.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-green-600" : ""}`}
                    onClick={() => toggleMulti("gait", opt.en)}
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
      <Card className="border-2 border-indigo-200">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-indigo-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
              5
            </span>
            Special Tests / বিশেষ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Shoulder Tests / কাঁধের পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { en: "Neer's test - Negative", bn: "নিয়ার পরীক্ষা - নেতিবাচক" },
                { en: "Neer's test - Positive", bn: "নিয়ার পরীক্ষা - ইতিবাচক" },
                { en: "Hawkins test - Negative", bn: "হকিন্স পরীক্ষা - নেতিবাচক" },
                { en: "Hawkins test - Positive", bn: "হকিন্স পরীক্ষা - ইতিবাচক" },
                {
                  en: "Drop arm test - Negative",
                  bn: "ড্রপ আর্ম পরীক্ষা - নেতিবাচক",
                },
                {
                  en: "Drop arm test - Positive",
                  bn: "ড্রপ আর্ম পরীক্ষা - ইতিবাচক",
                },
              ].map((test) => {
                const active = (
                  (examData.special_tests_shoulder as string[]) || []
                ).includes(test.en);
                return (
                  <Badge
                    key={test.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() =>
                      toggleMulti("special_tests_shoulder", test.en)
                    }
                  >
                    {test.en} / {test.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="special_tests_shoulder"
              customField="custom_special_tests_shoulder"
              examData={examData}
              isMulti={true}
              accentColor="indigo-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Knee Tests / হাঁটুর পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  en: "McMurray test - Negative",
                  bn: "ম্যাকমারে পরীক্ষা - নেতিবাচক",
                },
                { en: "McMurray test - Positive", bn: "ম্যাকমারে পরীক্ষা - ইতিবাচক" },
                {
                  en: "Anterior drawer - Negative",
                  bn: "অ্যান্টিরিয়র ড্রয়ার - নেতিবাচক",
                },
                {
                  en: "Anterior drawer - Positive",
                  bn: "অ্যান্টিরিয়র ড্রয়ার - ইতিবাচক",
                },
                { en: "Lachman test - Negative", bn: "ল্যাকম্যান পরীক্ষা - নেতিবাচক" },
                { en: "Lachman test - Positive", bn: "ল্যাকম্যান পরীক্ষা - ইতিবাচক" },
              ].map((test) => {
                const active = (
                  (examData.special_tests_knee as string[]) || []
                ).includes(test.en);
                return (
                  <Badge
                    key={test.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() => toggleMulti("special_tests_knee", test.en)}
                  >
                    {test.en} / {test.bn}
                  </Badge>
                );
              })}
            </div>
            <CustomBadgeAdder
              field="special_tests_knee"
              customField="custom_special_tests_knee"
              examData={examData}
              isMulti={true}
              accentColor="indigo-600"
              onUpdate={update}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-800">
              Spine Tests / মেরুদণ্ড পরীক্ষা
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  en: "Straight leg raise - Negative",
                  bn: "সোজা পা তোলা - নেতিবাচক",
                },
                {
                  en: "Straight leg raise - Positive",
                  bn: "সোজা পা তোলা - ইতিবাচক",
                },
                { en: "FABER test - Negative", bn: "FABER পরীক্ষা - নেতিবাচক" },
                { en: "FABER test - Positive", bn: "FABER পরীক্ষা - ইতিবাচক" },
              ].map((test) => {
                const active = (
                  (examData.special_tests_spine as string[]) || []
                ).includes(test.en);
                return (
                  <Badge
                    key={test.en}
                    variant={active ? "default" : "outline"}
                    className={`cursor-pointer text-sm py-2 px-3 ${active ? "bg-indigo-600" : ""}`}
                    onClick={() => toggleMulti("special_tests_spine", test.en)}
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
