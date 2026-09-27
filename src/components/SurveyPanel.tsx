"use client";

import { useEffect, useMemo, useState } from "react";
import { assessmentLabel, type AssessmentLevel } from "@/lib/labels";

type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "RATING"
  | "SHORT_TEXT"
  | "LONG_TEXT";


type Option = {
  id: string;
  label: string;
  value: string;
  isNegative: boolean;
  requireReason: boolean;
};

type Question = {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  ratingMin: number | null;
  ratingMax: number | null;
  options: Option[];
};

type Patient = {
  id: string;
  fullName: string;
  personalId: string | null;
  historyNumber: string | null;
  departmentName: string | null;
  age: number | null;
  doctorName: string | null;
};

type AnswerState = {
  selectedValues: string[];
  textValue: string;
  ratingValue: number | null;
  reason: string;
};

export function SurveyPanel({
  patient,
  questions,
  existing,
  onSaved,
  surveyDate,
  readOnly = false,
}: {
  patient: Patient | null;
  questions: Question[];
  existing: {
    id: string;
    comment: string | null;
    assessment: AssessmentLevel;
    answers: {
      questionId: string;
      selectedValues: string[];
      textValue: string | null;
      ratingValue: number | null;
      reason: string | null;
    }[];
    questionnaire?: { questions?: Question[] } | null;
  } | null;
  onSaved: () => void;
  surveyDate: string;
  readOnly?: boolean;
}) {
  const initial = useMemo(() => {
    const map: Record<string, AnswerState> = {};
    for (const q of questions) {
      const a = existing?.answers.find((x) => x.questionId === q.id);
      map[q.id] = {
        selectedValues: a?.selectedValues || [],
        textValue: a?.textValue || "",
        ratingValue: a?.ratingValue ?? null,
        reason: a?.reason || "",
      };
    }
    return map;
  }, [questions, existing]);

  const [answers, setAnswers] = useState<Record<string, AnswerState>>(initial);
  const [comment, setComment] = useState(existing?.comment || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAnswers(initial);
    setComment(existing?.comment || "");
    setError("");
  }, [initial, existing?.comment, patient?.id]);

  if (!patient) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted p-8">
        აირჩიეთ პაციენტი მარცხენა სიიდან
      </div>
    );
  }

  function update(qid: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        patientId: patient!.id,
        surveyDate,
        comment,
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedValues: answers[q.id]?.selectedValues || [],
          textValue: answers[q.id]?.textValue || null,
          ratingValue: answers[q.id]?.ratingValue,
          reason: answers[q.id]?.reason || null,
        })),
      };

      const res = await fetch("/api/surveys", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing ? { ...payload, surveyId: existing.id } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "შენახვა ვერ მოხერხდა");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setSaving(false);
    }
  }

  async function abstain() {
    if (!confirm("პაციენტმა თავი შეიკავა გამოკითხვისგან?")) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        patientId: patient!.id,
        surveyDate,
        comment: comment || null,
        abstained: true,
        answers: [],
      };
      const res = await fetch("/api/surveys", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing ? { ...payload, surveyId: existing.id } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "შენახვა ვერ მოხერხდა");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{patient.fullName}</h1>
              <p className="text-sm text-muted mt-1">
                {patient.departmentName || "—"}
                {patient.historyNumber ? ` · ისტორია ${patient.historyNumber}` : ""}
                {patient.personalId ? ` · პ/ნ ${patient.personalId}` : ""}
                {patient.age != null ? ` · ${patient.age} წ` : ""}
              </p>
              {patient.doctorName && (
                <p className="text-sm text-muted">ექიმი: {patient.doctorName}</p>
              )}
            </div>
            {existing && (
              <span className="text-sm px-3 py-1 rounded-full bg-accent text-primary">
                {assessmentLabel(existing.assessment)}
                {readOnly ? " · ნახვა" : " · რედაქტირება"}
              </span>
            )}
          </div>
        </div>

        {readOnly && (
          <p className="text-sm text-muted bg-accent/50 border border-border rounded-xl px-4 py-3">
            ამ თარიღის გამოკითხვა მხოლოდ სანახავია.
          </p>
        )}

        {questions.map((q, idx) => {
          const a = answers[q.id] || {
            selectedValues: [],
            textValue: "",
            ratingValue: null,
            reason: "",
          };
          const selectedOpt = q.options.find((o) => a.selectedValues.includes(o.value));
          const showReason =
            selectedOpt?.requireReason ||
            (q.type === "RATING" && a.ratingValue != null && a.ratingValue <= 2);

          return (
            <div key={q.id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <p className="font-medium">
                {idx + 1}. {q.text}
                {q.required && <span className="text-fix"> *</span>}
              </p>

              {(q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => {
                    const checked = a.selectedValues.includes(o.value);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          if (readOnly) return;
                          if (q.type === "SINGLE_CHOICE") {
                            update(q.id, { selectedValues: [o.value], reason: "" });
                          } else {
                            const next = checked
                              ? a.selectedValues.filter((v) => v !== o.value)
                              : [...a.selectedValues, o.value];
                            update(q.id, { selectedValues: next });
                          }
                        }}
                        className={`min-w-[88px] rounded-xl px-4 py-2.5 text-sm border transition ${
                          checked
                            ? "bg-primary text-white border-primary"
                            : "bg-white border-border hover:bg-accent"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "RATING" && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    { length: (q.ratingMax || 5) - (q.ratingMin || 1) + 1 },
                    (_, i) => (q.ratingMin || 1) + i,
                  ).map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        if (readOnly) return;
                        update(q.id, { ratingValue: n });
                      }}
                      className={`w-11 h-11 rounded-xl border text-sm font-medium ${
                        a.ratingValue === n
                          ? "bg-primary text-white border-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {(q.type === "SHORT_TEXT" || q.type === "LONG_TEXT") && (
                <textarea
                  value={a.textValue}
                  readOnly={readOnly}
                  onChange={(e) => update(q.id, { textValue: e.target.value })}
                  rows={q.type === "LONG_TEXT" ? 4 : 2}
                  className="w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25 disabled:bg-accent/40"
                />
              )}

              {showReason && (
                <label className="block">
                  <span className="text-sm text-muted">მიზეზი / კომენტარი *</span>
                  <textarea
                    value={a.reason}
                    readOnly={readOnly}
                    onChange={(e) => update(q.id, { reason: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
                    required
                  />
                </label>
              )}
            </div>
          );
        })}

        <div className="bg-card border border-border rounded-2xl p-5">
          <label className="block">
            <span className="font-medium">დამატებითი კომენტარი</span>
            <textarea
              value={comment}
              readOnly={readOnly}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
              placeholder="თუ რამე არ არის კითხვებში..."
            />
          </label>
        </div>

        {error && <p className="text-fix text-sm">{error}</p>}

        {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="w-full md:w-auto rounded-xl bg-primary hover:bg-primary-dark text-white px-8 py-3 font-medium disabled:opacity-60"
          >
            {saving ? "ინახება..." : existing ? "განახლება" : "შენახვა"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={abstain}
            className="w-full md:w-auto rounded-xl border border-border text-muted px-6 py-3 font-medium hover:bg-accent disabled:opacity-60"
          >
            თავი შეიკავა
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
