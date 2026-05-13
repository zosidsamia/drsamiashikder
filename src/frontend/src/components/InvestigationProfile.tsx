import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import React, { useState } from "react";

interface Investigation {
  name: string;
  result: string;
  unit: string;
  category: string;
}

interface InvestigationProfileProps {
  data?: Investigation[];
  onChange: (data: Investigation[]) => void;
}

const commonInvestigations: Investigation[] = [
  { name: "Hemoglobin (Hb)", unit: "g/dl", category: "Hematology", result: "" },
  { name: "Total WBC count", unit: "/cmm", category: "Hematology", result: "" },
  { name: "Platelet count", unit: "/cmm", category: "Hematology", result: "" },
  { name: "ESR", unit: "mm/1st hr", category: "Hematology", result: "" },
  { name: "PCV/Hematocrit", unit: "%", category: "Hematology", result: "" },
  {
    name: "RBC count",
    unit: "million/cmm",
    category: "Hematology",
    result: "",
  },
  {
    name: "Fasting blood sugar",
    unit: "mmol/dl",
    category: "Blood Sugar",
    result: "",
  },
  {
    name: "Random blood sugar",
    unit: "mmol/dl",
    category: "Blood Sugar",
    result: "",
  },
  { name: "HbA1c", unit: "%", category: "Blood Sugar", result: "" },
  {
    name: "2 hr after breakfast",
    unit: "mmol/dl",
    category: "Blood Sugar",
    result: "",
  },
  {
    name: "Total cholesterol",
    unit: "mg/dl",
    category: "Lipid Profile",
    result: "",
  },
  {
    name: "Triglycerides",
    unit: "mg/dl",
    category: "Lipid Profile",
    result: "",
  },
  {
    name: "HDL cholesterol",
    unit: "mg/dl",
    category: "Lipid Profile",
    result: "",
  },
  {
    name: "LDL cholesterol",
    unit: "mg/dl",
    category: "Lipid Profile",
    result: "",
  },
  {
    name: "S. Bilirubin (Total)",
    unit: "mg/dl",
    category: "Liver Function",
    result: "",
  },
  { name: "SGPT/ALT", unit: "U/L", category: "Liver Function", result: "" },
  { name: "SGOT/AST", unit: "U/L", category: "Liver Function", result: "" },
  {
    name: "Alkaline phosphatase",
    unit: "U/L",
    category: "Liver Function",
    result: "",
  },
  { name: "S. Albumin", unit: "g/dl", category: "Liver Function", result: "" },
  {
    name: "S. Creatinine",
    unit: "mg/dl",
    category: "Kidney Function",
    result: "",
  },
  {
    name: "Blood urea",
    unit: "mg/dl",
    category: "Kidney Function",
    result: "",
  },
  {
    name: "Serum uric acid",
    unit: "mg/dl",
    category: "Kidney Function",
    result: "",
  },
  { name: "eGFR", unit: "ml/min", category: "Kidney Function", result: "" },
  {
    name: "S. Sodium (Na+)",
    unit: "mmol/L",
    category: "Electrolytes",
    result: "",
  },
  {
    name: "S. Potassium (K+)",
    unit: "mmol/L",
    category: "Electrolytes",
    result: "",
  },
  {
    name: "S. Chloride (Cl-)",
    unit: "mmol/L",
    category: "Electrolytes",
    result: "",
  },
  { name: "S. Calcium", unit: "mg/dl", category: "Electrolytes", result: "" },
  { name: "TSH", unit: "mIU/L", category: "Thyroid", result: "" },
  { name: "Free T3", unit: "pg/ml", category: "Thyroid", result: "" },
  { name: "Free T4", unit: "ng/dl", category: "Thyroid", result: "" },
  { name: "Urine R/E", unit: "", category: "Urine", result: "" },
  { name: "Urine C/S", unit: "", category: "Urine", result: "" },
  { name: "24hr urine protein", unit: "g/24hr", category: "Urine", result: "" },
  { name: "HBsAg", unit: "", category: "Serology", result: "" },
  { name: "Anti-HCV", unit: "", category: "Serology", result: "" },
  { name: "VDRL", unit: "", category: "Serology", result: "" },
  { name: "HIV screening", unit: "", category: "Serology", result: "" },
  { name: "Chest X-ray", unit: "", category: "Imaging", result: "" },
  { name: "Ultrasound abdomen", unit: "", category: "Imaging", result: "" },
  { name: "ECG", unit: "", category: "Imaging", result: "" },
  { name: "Echocardiography", unit: "", category: "Imaging", result: "" },
  { name: "CT scan", unit: "", category: "Imaging", result: "" },
];

export default function InvestigationProfile({
  data,
  onChange,
}: InvestigationProfileProps) {
  const [investigations, setInvestigations] = useState<Investigation[]>(
    data || [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredInvestigations = commonInvestigations.filter(
    (inv) =>
      inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const addInvestigation = (investigation: Investigation) => {
    const newInv: Investigation = {
      name: investigation.name,
      result: "",
      unit: investigation.unit,
      category: investigation.category,
    };
    const updated = [...investigations, newInv];
    setInvestigations(updated);
    onChange(updated);
    setSearchTerm("");
    setShowSuggestions(false);
  };

  const addCustomInvestigation = () => {
    if (searchTerm.trim()) {
      const newInv: Investigation = {
        name: searchTerm.trim(),
        result: "",
        unit: "",
        category: "Other",
      };
      const updated = [...investigations, newInv];
      setInvestigations(updated);
      onChange(updated);
      setSearchTerm("");
      setShowSuggestions(false);
    }
  };

  const updateInvestigation = (
    index: number,
    field: keyof Investigation,
    value: string,
  ) => {
    const updated = investigations.map((inv, idx) =>
      idx === index ? { ...inv, [field]: value } : inv,
    );
    setInvestigations(updated);
    onChange(updated);
  };

  const removeInvestigation = (index: number) => {
    const updated = investigations.filter((_, idx) => idx !== index);
    setInvestigations(updated);
    onChange(updated);
  };

  const groupedByCategory = investigations.reduce(
    (acc: Record<string, (Investigation & { index: number })[]>, inv, idx) => {
      if (!acc[inv.category]) acc[inv.category] = [];
      acc[inv.category].push({ ...inv, index: idx });
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Search & Add Investigation</Label>
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Type to search investigations..."
              className="h-10"
            />
            <Button
              type="button"
              onClick={addCustomInvestigation}
              variant="outline"
              className="h-10"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Custom
            </Button>
          </div>

          {showSuggestions && searchTerm && (
            <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
              <div className="p-2 space-y-1">
                {filteredInvestigations.length > 0 ? (
                  filteredInvestigations.map((inv) => (
                    <button
                      type="button"
                      key={inv.name}
                      className="p-2 hover:bg-slate-100 cursor-pointer rounded flex justify-between items-center w-full text-left"
                      onClick={() => addInvestigation(inv)}
                    >
                      <div>
                        <div className="font-medium text-sm">{inv.name}</div>
                        <div className="text-xs text-slate-500">
                          {inv.category} {inv.unit && `• ${inv.unit}`}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-teal-600" />
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-sm text-slate-500 text-center">
                    No investigations found. Click "Add Custom" to add manually.
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {investigations.length > 0 && (
        <div className="space-y-4">
          {Object.keys(groupedByCategory).map((category) => (
            <div key={category} className="space-y-2">
              <Badge variant="outline" className="bg-slate-100">
                {category}
              </Badge>
              <div className="space-y-2">
                {groupedByCategory[category].map((inv) => (
                  <Card key={inv.index} className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-1">
                          <Label className="text-xs text-slate-500">
                            Investigation
                          </Label>
                          <div className="text-sm font-medium mt-1">
                            {inv.name}
                          </div>
                        </div>
                        <div className="md:col-span-1">
                          <Label className="text-xs text-slate-500">
                            Result
                          </Label>
                          <Input
                            value={inv.result}
                            onChange={(e) =>
                              updateInvestigation(
                                inv.index,
                                "result",
                                e.target.value,
                              )
                            }
                            placeholder="Enter result"
                            className="h-9 mt-1"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label className="text-xs text-slate-500">Unit</Label>
                          <Input
                            value={inv.unit}
                            onChange={(e) =>
                              updateInvestigation(
                                inv.index,
                                "unit",
                                e.target.value,
                              )
                            }
                            placeholder="Unit"
                            className="h-9 mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInvestigation(inv.index)}
                        className="h-9 w-9 text-red-500 mt-5"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
