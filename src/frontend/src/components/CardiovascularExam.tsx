import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import CustomBadgeAdder from "./CustomBadgeAdder";

const cvsData = {
  inspection: {
    precordium: [
      { en: "Normal", bn: "স্বাভাবিক" },
      { en: "Precordial bulge", bn: "প্রিকর্ডিয়াল ফোলা" },
      { en: "Visible pulsations", bn: "দৃশ্যমান স্পন্দন" },
      { en: "Surgical scar", bn: "অপারেশনের দাগ" },
      { en: "Pacemaker scar", bn: "পেসমেকারের দাগ" },
    ],
    apexBeatVisible: [
      { en: "Visible", bn: "দৃশ্যমান" },
      { en: "Not visible", bn: "দৃশ্যমান নয়" },
    ],
    peripheralSigns: [
      { en: "No peripheral oedema", bn: "পেরিফেরাল শোথ নেই" },
      { en: "Ankle oedema present", bn: "গোড়ালি ফোলা আছে" },
      { en: "Facial puffiness", bn: "মুখ ফোলা" },
      { en: "Raised JVP visible", bn: "জেভিপি বৃদ্ধি দৃশ্যমান" },
      { en: "Cyanosis", bn: "নীলাভ বর্ণ" },
      { en: "Pallor", bn: "রক্তহীনতা" },
      { en: "Clubbing", bn: "আঙুল ফুলে যাওয়া" },
    ],
  },
  palpation: {
    apexBeat: [
      { en: "Normal position (5th ICS MCL)", bn: "স্বাভাবিক অবস্থান" },
      { en: "Displaced laterally", bn: "পার্শ্বে বিচ্যুত" },
      { en: "Displaced downward", bn: "নীচে বিচ্যুত" },
      { en: "Not palpable", bn: "অনুভব করা যাচ্ছে না" },
      { en: "Heaving", bn: "হেভিং" },
      { en: "Tapping", bn: "ট্যাপিং" },
    ],
    thrills: [
      { en: "No thrill", bn: "কোনো কম্পন নেই" },
      { en: "Systolic thrill", bn: "সিস্টোলিক কম্পন" },
      { en: "Diastolic thrill", bn: "ডায়াস্টোলিক কম্পন" },
      { en: "Thrill at apex", bn: "অ্যাপেক্সে কম্পন" },
      { en: "Thrill at base", bn: "বেসে কম্পন" },
    ],
    parasternal: [
      { en: "No parasternal heave", bn: "প্যারাস্টার্নাল হেভ নেই" },
      { en: "Left parasternal heave", bn: "বাম প্যারাস্টার্নাল হেভ" },
      { en: "Right parasternal heave", bn: "ডান প্যারাস্টার্নাল হেভ" },
    ],
  },
  percussion: {
    cardiacDullness: [
      { en: "Normal cardiac dullness", bn: "স্বাভাবিক কার্ডিয়াক ডালনেস" },
      { en: "Enlarged cardiac dullness", bn: "বর্ধিত কার্ডিয়াক ডালনেস" },
      { en: "Shifted to left", bn: "বামে স্থানান্তরিত" },
      { en: "Shifted to right", bn: "ডানে স্থানান্তরিত" },
    ],
    pericardialEffusion: [
      { en: "No signs of effusion", bn: "ইফিউশনের কোনো চিহ্ন নেই" },
      { en: "Stony dullness suggesting effusion", bn: "ইফিউশন সূচিত ডালনেস" },
    ],
  },
  auscultation: {
    heartSounds: [
      { en: "S1 S2 normal", bn: "এস১ এস২ স্বাভাবিক" },
      { en: "S1 loud", bn: "এস১ উচ্চ" },
      { en: "S1 soft", bn: "এস১ মৃদু" },
      { en: "S2 loud", bn: "এস২ উচ্চ" },
      { en: "S2 soft", bn: "এস২ মৃদু" },
      { en: "S2 split", bn: "এস২ বিভক্ত" },
      { en: "Muffled heart sounds", bn: "বিমূর্ত হার্টের শব্দ" },
    ],
    addedSounds: [
      { en: "S3 (ventricular gallop)", bn: "এস৩ (ভেন্ট্রিকুলার গ্যালপ)" },
      { en: "S4 (atrial gallop)", bn: "এস৪ (এট্রিয়াল গ্যালপ)" },
      { en: "Opening snap", bn: "ওপেনিং স্ন্যাপ" },
      { en: "Ejection click", bn: "ইজেকশন ক্লিক" },
      { en: "Pericardial rub", bn: "পেরিকার্ডিয়াল রাব" },
    ],
    murmurs: [
      { en: "No murmur", bn: "কোনো মার্মার নেই" },
      { en: "Systolic murmur", bn: "সিস্টোলিক মার্মার" },
      { en: "Diastolic murmur", bn: "ডায়াস্টোলিক মার্মার" },
      { en: "Continuous murmur", bn: "ধারাবাহিক মার্মার" },
      { en: "Murmur at apex", bn: "অ্যাপেক্সে মার্মার" },
      { en: "Murmur at aortic area", bn: "মহাধমনী অঞ্চলে মার্মার" },
      { en: "Murmur at pulmonary area", bn: "পালমোনারি অঞ্চলে মার্মার" },
      { en: "Murmur at tricuspid area", bn: "ট্রাইকাসপিড অঞ্চলে মার্মার" },
    ],
    lungBases: [
      { en: "Clear", bn: "পরিষ্কার" },
      { en: "Basal crackles", bn: "বেসাল ক্র্যাকল" },
      { en: "Bilateral crackles", bn: "দ্বিপাক্ষিক ক্র্যাকল" },
    ],
  },
  specialTests: [
    { en: "JVP normal", bn: "জেভিপি স্বাভাবিক" },
    { en: "JVP raised", bn: "জেভিপি বৃদ্ধি" },
    { en: "JVP with hepatojugular reflux", bn: "হেপাটোজুগুলার রিফ্লাক্স" },
    { en: "All peripheral pulses present", bn: "সব পেরিফেরাল নাড়ি আছে" },
    { en: "Radial pulse weak", bn: "রেডিয়াল নাড়ি দুর্বল" },
    { en: "Pedal pulses absent", bn: "পেডাল নাড়ি অনুপস্থিত" },
    { en: "Radio-femoral delay", bn: "রেডিও-ফেমোরাল বিলম্ব" },
    { en: "Ankle-brachial index reduced", bn: "অ্যাঙ্কল-ব্র্যাকিয়াল ইনডেক্স কম" },
    { en: "Capillary refill < 2 sec", bn: "ক্যাপিলারি রিফিল < ২ সেকেন্ড" },
    { en: "Capillary refill > 2 sec", bn: "ক্যাপিলারি রিফিল > ২ সেকেন্ড" },
    { en: "Pitting oedema (grade 1)", bn: "পিটিং শোথ (গ্রেড ১)" },
    { en: "Pitting oedema (grade 2)", bn: "পিটিং শোথ (গ্রেড ২)" },
    { en: "Pitting oedema (grade 3)", bn: "পিটিং শোথ (গ্রেড ৩)" },
  ],
};

type CvsExamData = Record<string, unknown>;

interface CardiovascularExamProps {
  data: CvsExamData;
  onChange: (data: CvsExamData) => void;
}

export default function CardiovascularExam({
  data,
  onChange,
}: CardiovascularExamProps) {
  const [examData, setExamData] = useState<CvsExamData>(
    data || {
      precordium: [],
      apex_beat_visible: "",
      peripheral_signs: [],
      apex_beat: "",
      thrills: [],
      parasternal: "",
      cardiac_dullness: "",
      pericardial_effusion: "",
      heart_sounds: [],
      added_sounds: [],
      murmurs: [],
      lung_bases: "",
      special_tests: [],
    },
  );

  const update = (patch: CvsExamData) => {
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
    update({ [field]: examData[field] === value ? "" : value });

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
              className={`cursor-pointer text-sm py-2 px-3 transition-all ${
                active
                  ? `bg-${accentColor || "rose-600"} border-transparent`
                  : ""
              }`}
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
          accentColor={accentColor || "rose-600"}
          onUpdate={update}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. INSPECTION */}
      <Card className="border-2 border-rose-200">
        <CardHeader className="bg-gradient-to-r from-rose-500 to-rose-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-slate-700 text-sm">
              1
            </span>
            Inspection / পরিদর্শন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <BadgeGroup
            label="Precordium / প্রিকর্ডিয়াম"
            field="precordium"
            options={cvsData.inspection.precordium}
            customField="custom_precordium"
            accentColor="rose-600"
          />
          <BadgeGroup
            label="Apex Beat (Visible) / অ্যাপেক্স বিট দৃশ্যমানতা"
            field="apex_beat_visible"
            options={cvsData.inspection.apexBeatVisible}
            single
            accentColor="rose-600"
          />
          <BadgeGroup
            label="Peripheral Signs / পেরিফেরাল চিহ্ন"
            field="peripheral_signs"
            options={cvsData.inspection.peripheralSigns}
            customField="custom_peripheral_signs"
            accentColor="rose-600"
          />
        </CardContent>
      </Card>

      {/* 2. PALPATION */}
      <Card className="border-2 border-orange-200">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-slate-700 text-sm">
              2
            </span>
            Palpation / স্পর্শ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <BadgeGroup
            label="Apex Beat Position / অ্যাপেক্স বিটের অবস্থান"
            field="apex_beat"
            options={cvsData.palpation.apexBeat}
            single
            customField="custom_apex_beat"
            accentColor="orange-600"
          />
          <BadgeGroup
            label="Thrills / কম্পন"
            field="thrills"
            options={cvsData.palpation.thrills}
            customField="custom_thrills"
            accentColor="orange-600"
          />
          <BadgeGroup
            label="Parasternal Heave / প্যারাস্টার্নাল হেভ"
            field="parasternal"
            options={cvsData.palpation.parasternal}
            single
            accentColor="orange-600"
          />
        </CardContent>
      </Card>

      {/* 3. PERCUSSION */}
      <Card className="border-2 border-amber-200">
        <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-slate-700 text-sm">
              3
            </span>
            Percussion / পারকাশন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <BadgeGroup
            label="Cardiac Dullness / কার্ডিয়াক ডালনেস"
            field="cardiac_dullness"
            options={cvsData.percussion.cardiacDullness}
            single
            customField="custom_cardiac_dullness"
            accentColor="amber-600"
          />
          <BadgeGroup
            label="Pericardial Signs / পেরিকার্ডিয়াল চিহ্ন"
            field="pericardial_effusion"
            options={cvsData.percussion.pericardialEffusion}
            single
            accentColor="amber-600"
          />
        </CardContent>
      </Card>

      {/* 4. AUSCULTATION */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-slate-700 text-sm">
              4
            </span>
            Auscultation / শ্রবণ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <BadgeGroup
            label="Heart Sounds / হার্টের শব্দ"
            field="heart_sounds"
            options={cvsData.auscultation.heartSounds}
            customField="custom_heart_sounds"
            accentColor="purple-600"
          />
          <BadgeGroup
            label="Added Sounds / অতিরিক্ত শব্দ"
            field="added_sounds"
            options={cvsData.auscultation.addedSounds}
            customField="custom_added_sounds"
            accentColor="purple-600"
          />
          <BadgeGroup
            label="Murmurs / মার্মার"
            field="murmurs"
            options={cvsData.auscultation.murmurs}
            customField="custom_murmurs"
            accentColor="purple-600"
          />
          <BadgeGroup
            label="Lung Bases / ফুসফুসের ভিত্তি"
            field="lung_bases"
            options={cvsData.auscultation.lungBases}
            single
            accentColor="purple-600"
          />
        </CardContent>
      </Card>

      {/* 5. SPECIAL TESTS */}
      <Card className="border-2 border-teal-200">
        <CardHeader className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="bg-white text-teal-600 rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm">
              5
            </span>
            Special Tests / বিশেষ পরীক্ষা
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-2">
            {cvsData.specialTests.map((test) => {
              const active = (
                (examData.special_tests as string[]) || []
              ).includes(test.en);
              return (
                <Badge
                  key={test.en}
                  variant={active ? "default" : "outline"}
                  className={`cursor-pointer text-sm py-2 px-3 ${
                    active ? "bg-teal-600 border-transparent" : ""
                  }`}
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
            accentColor="teal-600"
            onUpdate={update}
          />
        </CardContent>
      </Card>
    </div>
  );
}
