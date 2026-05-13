import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useRef, useState } from "react";

const BADGE_PALETTE = [
  {
    base: "bg-blue-100 text-blue-800 border-blue-300",
    active: "bg-blue-500 text-white border-blue-500",
  },
  {
    base: "bg-green-100 text-green-800 border-green-300",
    active: "bg-green-500 text-white border-green-500",
  },
  {
    base: "bg-amber-100 text-amber-800 border-amber-300",
    active: "bg-amber-500 text-white border-amber-500",
  },
  {
    base: "bg-purple-100 text-purple-800 border-purple-300",
    active: "bg-purple-500 text-white border-purple-500",
  },
  {
    base: "bg-rose-100 text-rose-800 border-rose-300",
    active: "bg-rose-500 text-white border-rose-500",
  },
  {
    base: "bg-cyan-100 text-cyan-800 border-cyan-300",
    active: "bg-cyan-500 text-white border-cyan-500",
  },
  {
    base: "bg-orange-100 text-orange-800 border-orange-300",
    active: "bg-orange-500 text-white border-orange-500",
  },
  {
    base: "bg-teal-100 text-teal-800 border-teal-300",
    active: "bg-teal-500 text-white border-teal-500",
  },
  {
    base: "bg-indigo-100 text-indigo-800 border-indigo-300",
    active: "bg-indigo-500 text-white border-indigo-500",
  },
  {
    base: "bg-lime-100 text-lime-800 border-lime-300",
    active: "bg-lime-600 text-white border-lime-600",
  },
];

interface ExamData {
  [key: string]: unknown;
}

interface CustomBadgeAdderProps {
  field: string;
  customField: string;
  examData: ExamData;
  isMulti?: boolean;
  accentColor?: string;
  onUpdate: (patch: ExamData) => void;
  placeholder?: string;
}

export default function CustomBadgeAdder({
  field,
  customField,
  examData,
  isMulti = true,
  onUpdate,
  placeholder = "Add custom finding...",
}: CustomBadgeAdderProps) {
  const [inputVal, setInputVal] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const rawCustom = examData[customField];
  const customOptions: string[] = Array.isArray(rawCustom)
    ? (rawCustom as string[])
    : [];
  const rawSelected = examData[field];
  const selected: string | string[] = Array.isArray(rawSelected)
    ? (rawSelected as string[])
    : typeof rawSelected === "string"
      ? rawSelected
      : isMulti
        ? []
        : "";

  const isSelected = (val: string) =>
    isMulti ? (selected as string[]).includes(val) : selected === val;

  const toggleValue = (val: string) => {
    if (isMulti) {
      const cur = Array.isArray(selected) ? (selected as string[]) : [];
      onUpdate({
        [field]: cur.includes(val)
          ? cur.filter((v) => v !== val)
          : [...cur, val],
      });
    } else {
      onUpdate({ [field]: selected === val ? "" : val });
    }
  };

  const addCustom = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || customOptions.includes(trimmed)) return;
    const newOptions = [...customOptions, trimmed];
    const patch: ExamData = { [customField]: newOptions };
    if (isMulti) {
      const cur = Array.isArray(selected) ? (selected as string[]) : [];
      patch[field] = [...cur, trimmed];
    } else {
      patch[field] = trimmed;
    }
    onUpdate(patch);
    setInputVal("");
  };

  const startEdit = (val: string) => {
    setEditingValue(val);
    setEditText(val);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editingValue) return;
    const newText = editText.trim();
    if (!newText || newText === editingValue) {
      setEditingValue(null);
      return;
    }
    const newOptions = customOptions.map((o) =>
      o === editingValue ? newText : o,
    );
    const patch: ExamData = { [customField]: newOptions };
    if (isMulti) {
      const cur = Array.isArray(selected) ? (selected as string[]) : [];
      patch[field] = cur.map((v) => (v === editingValue ? newText : v));
    } else {
      if (selected === editingValue) patch[field] = newText;
    }
    onUpdate(patch);
    setEditingValue(null);
  };

  const deleteCustom = (val: string) => {
    const newOptions = customOptions.filter((o) => o !== val);
    const patch: ExamData = { [customField]: newOptions };
    if (isMulti) {
      const cur = Array.isArray(selected) ? (selected as string[]) : [];
      patch[field] = cur.filter((v) => v !== val);
    } else {
      if (selected === val) patch[field] = "";
    }
    onUpdate(patch);
  };

  return (
    <div className="space-y-2">
      {customOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customOptions.map((opt, optIdx) => {
            const colors = BADGE_PALETTE[optIdx % BADGE_PALETTE.length];
            const active = isSelected(opt);
            if (editingValue === opt) {
              return (
                <div key={opt} className="flex items-center gap-1">
                  <Input
                    ref={editRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingValue(null);
                    }}
                    className="h-7 text-xs w-36 px-2"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-green-600"
                    onClick={commitEdit}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              );
            }
            return (
              <Badge
                key={opt}
                variant="outline"
                className={`cursor-pointer text-sm py-2 px-2 flex items-center gap-1 group border transition-all min-h-[36px] ${active ? colors.active : colors.base}`}
                onClick={() => toggleValue(opt)}
              >
                <span>{opt}</span>
                <button
                  type="button"
                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(opt);
                  }}
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCustom(opt);
                  }}
                  title="Delete"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-xs flex-1 max-w-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 flex-shrink-0 min-h-[44px] min-w-[44px]"
          onClick={addCustom}
          disabled={!inputVal.trim()}
          title="Add custom finding"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
