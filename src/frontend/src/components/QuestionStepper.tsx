import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Pencil,
  Plus,
  Rows3,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";

interface Question {
  q: string;
  options: string[];
}

interface QuestionStepperProps {
  questions?: (Question | string)[];
  answers?: string[];
  onChange: (index: number, value: string) => void;
  numberOffset?: number;
  /** Doctor / Admin only — enables inline editing of question text and options */
  canEdit?: boolean;
  /** Called when question label text is edited */
  onEditQuestion?: (index: number, newText: string) => void;
  /** Called when a new option badge is added */
  onAddOption?: (index: number, option: string) => void;
  /** Called when an option badge is deleted */
  onDeleteOption?: (index: number, option: string) => void;
}

// Color palette for options
const OPTION_PALETTE = [
  {
    base: "bg-blue-100 text-blue-800 border-blue-300",
    active: "bg-blue-500 text-white border-blue-500 shadow-sm",
  },
  {
    base: "bg-green-100 text-green-800 border-green-300",
    active: "bg-green-500 text-white border-green-500 shadow-sm",
  },
  {
    base: "bg-amber-100 text-amber-800 border-amber-300",
    active: "bg-amber-500 text-white border-amber-500 shadow-sm",
  },
  {
    base: "bg-purple-100 text-purple-800 border-purple-300",
    active: "bg-purple-500 text-white border-purple-500 shadow-sm",
  },
  {
    base: "bg-rose-100 text-rose-800 border-rose-300",
    active: "bg-rose-500 text-white border-rose-500 shadow-sm",
  },
  {
    base: "bg-cyan-100 text-cyan-800 border-cyan-300",
    active: "bg-cyan-500 text-white border-cyan-500 shadow-sm",
  },
  {
    base: "bg-orange-100 text-orange-800 border-orange-300",
    active: "bg-orange-500 text-white border-orange-500 shadow-sm",
  },
  {
    base: "bg-teal-100 text-teal-800 border-teal-300",
    active: "bg-teal-500 text-white border-teal-500 shadow-sm",
  },
  {
    base: "bg-indigo-100 text-indigo-800 border-indigo-300",
    active: "bg-indigo-500 text-white border-indigo-500 shadow-sm",
  },
  {
    base: "bg-lime-100 text-lime-800 border-lime-300",
    active: "bg-lime-600 text-white border-lime-600 shadow-sm",
  },
];

export default function QuestionStepper({
  questions = [],
  answers = [],
  onChange,
  numberOffset = 0,
  canEdit = false,
  onEditQuestion,
  onAddOption,
  onDeleteOption,
}: QuestionStepperProps) {
  const [stepMode, setStepMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [editingAnswerIdx, setEditingAnswerIdx] = useState<number | null>(null);

  // Inline question label editing
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(
    null,
  );
  const [questionDraft, setQuestionDraft] = useState("");

  // Per-question "add option" input state
  const [addingOptionIdx, setAddingOptionIdx] = useState<number | null>(null);
  const [optionDraft, setOptionDraft] = useState("");
  const addOptionInputRef = useRef<HTMLInputElement>(null);

  const total = questions.length;

  const handleOptionClick = (idx: number, option: string) => {
    onChange(idx, option);
    if (stepMode && idx === currentStep && currentStep < total - 1) {
      setTimeout(() => setCurrentStep((s) => s + 1), 300);
    }
  };

  const startEditQuestion = (idx: number, currentText: string) => {
    setEditingQuestionIdx(idx);
    setQuestionDraft(currentText);
  };

  const commitEditQuestion = (idx: number) => {
    const trimmed = questionDraft.trim();
    if (trimmed && onEditQuestion) {
      onEditQuestion(idx, trimmed);
    }
    setEditingQuestionIdx(null);
    setQuestionDraft("");
  };

  const startAddOption = (idx: number) => {
    setAddingOptionIdx(idx);
    setOptionDraft("");
    setTimeout(() => addOptionInputRef.current?.focus(), 50);
  };

  const commitAddOption = (idx: number) => {
    const trimmed = optionDraft.trim();
    if (trimmed && onAddOption) {
      onAddOption(idx, trimmed);
    }
    setAddingOptionIdx(null);
    setOptionDraft("");
  };

  const renderQuestion = (item: Question | string, idx: number) => {
    const question = typeof item === "string" ? item : item.q;
    const options = typeof item === "object" ? item.options || [] : [];
    const answer = answers[idx] || "";
    const isAnswered = answer.trim() !== "";
    const isEditingAnswer = editingAnswerIdx === idx;
    const isEditingQuestion = editingQuestionIdx === idx;
    const isAddingOption = addingOptionIdx === idx;

    return (
      <div
        key={idx}
        className={`rounded-xl border-2 transition-all ${
          isAnswered
            ? "border-teal-300 bg-teal-50/50"
            : "border-slate-200 bg-white"
        }`}
        data-ocid={`question_stepper.item.${numberOffset + idx + 1}`}
      >
        {/* Question header */}
        <div className="flex items-start gap-3 p-3 sm:p-4">
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              isAnswered
                ? "bg-teal-500 text-white"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {isAnswered ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              numberOffset + idx + 1
            )}
          </div>

          {/* Question text — inline edit for Doctor/Admin */}
          {canEdit && isEditingQuestion ? (
            <input
              ref={(el) => {
                if (el) el.focus();
              }}
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              onBlur={() => commitEditQuestion(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEditQuestion(idx);
                }
                if (e.key === "Escape") {
                  setEditingQuestionIdx(null);
                  setQuestionDraft("");
                }
              }}
              className="flex-1 text-slate-800 font-semibold text-sm leading-relaxed bg-amber-50 border border-amber-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-ocid={`question_stepper.input.${numberOffset + idx + 1}`}
            />
          ) : (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <p className="text-slate-800 font-semibold text-sm leading-relaxed pt-0.5 flex-1">
                {question}
              </p>
              {canEdit && (
                <button
                  type="button"
                  title="Edit question text"
                  onClick={() => startEditQuestion(idx, question)}
                  className="flex-shrink-0 p-1 rounded hover:bg-amber-100 text-amber-600 hover:text-amber-800 transition-colors"
                  data-ocid={`question_stepper.edit_button.${numberOffset + idx + 1}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Option badges */}
        {(options.length > 0 || canEdit) && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 px-3 sm:px-4 pb-2">
            {options.map((option, optIdx) => {
              const colors = OPTION_PALETTE[optIdx % OPTION_PALETTE.length];
              const isSelected = answer === option;
              return (
                <div key={option} className="relative inline-flex group">
                  <Badge
                    variant="outline"
                    className={`cursor-pointer text-xs sm:text-sm py-1 sm:py-1.5 px-2 sm:px-3 transition-all border font-medium min-h-[36px] flex items-center gap-1 ${
                      isSelected ? colors.active : colors.base
                    } ${canEdit ? "pr-1" : ""}`}
                    onClick={() => handleOptionClick(idx, option)}
                    data-ocid={`question_stepper.toggle.${numberOffset + idx + 1}`}
                  >
                    {option}
                    {/* Delete option — Doctor/Admin only */}
                    {canEdit && (
                      <button
                        type="button"
                        title={`Remove option "${option}"`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOption?.(idx, option);
                          // If this was the selected answer, clear it
                          if (isSelected) onChange(idx, "");
                        }}
                        className="ml-0.5 rounded-full hover:bg-black/20 p-0.5 transition-colors"
                        data-ocid={`question_stepper.delete_button.${numberOffset + idx + 1}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </Badge>
                </div>
              );
            })}

            {/* Add option — Doctor/Admin only */}
            {canEdit &&
              (isAddingOption ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={addOptionInputRef}
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    onBlur={() => commitAddOption(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitAddOption(idx);
                      }
                      if (e.key === "Escape") {
                        setAddingOptionIdx(null);
                        setOptionDraft("");
                      }
                    }}
                    placeholder="Option text…"
                    className="h-8 w-32 text-xs border border-teal-400 rounded px-2 bg-teal-50 focus:outline-none focus:ring-1 focus:ring-teal-400"
                    data-ocid={`question_stepper.input.option.${numberOffset + idx + 1}`}
                  />
                </div>
              ) : (
                <Badge
                  variant="outline"
                  className="cursor-pointer border-dashed border-teal-400 text-teal-600 hover:bg-teal-50 text-xs min-h-[36px] flex items-center gap-1 px-2"
                  onClick={() => startAddOption(idx)}
                  data-ocid={`question_stepper.add_button.${numberOffset + idx + 1}`}
                >
                  <Plus className="h-3 w-3" />
                  Add option
                </Badge>
              ))}
          </div>
        )}

        {/* Answer input */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          {isAnswered && !isEditingAnswer ? (
            <button
              type="button"
              className="flex items-center gap-2 bg-teal-100 border border-teal-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-teal-200 transition-colors group w-full text-left"
              onClick={() => setEditingAnswerIdx(idx)}
            >
              <span className="text-teal-800 font-medium text-sm flex-1">
                ✓ {answer}
              </span>
              <span className="text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to edit
              </span>
            </button>
          ) : (
            <Input
              value={answer}
              onChange={(e) => onChange(idx, e.target.value)}
              onBlur={() => setEditingAnswerIdx(null)}
              ref={(el) => {
                if (isEditingAnswer && el) el.focus();
              }}
              placeholder={
                options.length > 0
                  ? "Or type a custom answer..."
                  : "Type your answer here..."
              }
              className="h-10 bg-white border-slate-300 focus:border-teal-500 text-sm"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setStepMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              !stepMode
                ? "bg-white text-slate-800 shadow"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setStepMode(true);
              setCurrentStep(0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              stepMode
                ? "bg-white text-slate-800 shadow"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Rows3 className="h-3.5 w-3.5" />
            One by One
          </button>
        </div>
      </div>

      {stepMode ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 font-medium shrink-0">
              {currentStep + 1} / {total}
            </span>
          </div>

          {total > 0 && renderQuestion(questions[currentStep], currentStep)}

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="h-9 px-4 min-h-[44px]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>

            <div className="flex gap-1.5">
              {questions.map((q, idx) => (
                <button
                  key={`dot-${typeof q === "string" ? q : q.q}-${idx}`}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    idx === currentStep
                      ? "bg-teal-600 scale-125"
                      : (answers[idx] || "").trim()
                        ? "bg-teal-300"
                        : "bg-slate-300"
                  }`}
                />
              ))}
            </div>

            <Button
              type="button"
              variant={currentStep === total - 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentStep((s) => Math.min(total - 1, s + 1))}
              disabled={currentStep === total - 1}
              className={`h-9 px-4 min-h-[44px] ${
                currentStep === total - 1 ? "bg-teal-600 hover:bg-teal-700" : ""
              }`}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((item, idx) => renderQuestion(item, idx))}
        </div>
      )}
    </div>
  );
}
