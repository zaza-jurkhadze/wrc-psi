"use client";

import { useEffect, useMemo, useState } from "react";
import { assessmentLabel, type AssessmentLevel } from "@/lib/labels";
import { EditPatientModal } from "@/components/EditPatientModal";

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
  source?: string;
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

type QuestionStatus = {
  answered: boolean;
  requireReason: boolean;
  reasonFilled: boolean;
  valid: boolean;
  message?: string;
};

function evaluateQuestion(q: Question, a: AnswerState): QuestionStatus {
  const selectedValues = (a.selectedValues || []).filter((v) => v != null && v !== "");
  const ratingValue =
    a.ratingValue === 0 || a.ratingValue ? Number(a.ratingValue) : null;
  const textValue = a.textValue && a.textValue.trim() !== "" ? a.textValue : null;
  const reasonFilled = !!(a.reason && a.reason.trim() !== "");
  const isRequired = q.required !== false;

  let answered = true;
  let message: string | undefined;

  if (q.type === "SINGLE_CHOICE") {
    if (selectedValues.length !== 1) {
      answered = false;
      if (isRequired) message = "აირჩიეთ 1 პასუხი";
    }
  } else if (q.type === "MULTI_CHOICE") {
    if (selectedValues.length === 0) {
      answered = false;
      if (isRequired) message = "აირჩიეთ მინიმუმ 1 პასუხი";
    }
  } else if (q.type === "RATING") {
    const min = q.ratingMin ?? 1;
    const max = q.ratingMax ?? 5;
    if (ratingValue == null || Number.isNaN(ratingValue)) {
      answered = false;
      if (isRequired) message = "არჩიეთ შეფასება";
    } else if (ratingValue < min || ratingValue > max) {
      answered = false;
      message = `შეფასება ${min}–${max} საზრაში`;
    }
  } else if (q.type === "SHORT_TEXT" || q.type === "LONG_TEXT") {
    if (!textValue) {
      answered = false;
      if (isRequired) message = "დაწერეთ პასუხი";
    }
  }

  if (!isRequired && !answered) {
    answered = true;
    message = undefined;
  }

  let isNegative = false;
  let requireReason = false;
  if (q.type === "RATING") {
    const max = q.ratingMax ?? 5;
    if (ratingValue != null && ratingValue <= Math.ceil(max * 0.4)) {
      isNegative = true;
      requireReason = true;
    }
  } else {
    for (const v of selectedValues) {
      const opt = q.options.find((o) => o.value === v);
      if (opt?.isNegative) isNegative = true;
      if (opt?.requireReason) requireReason = true;
    }
  }

  const notApplicable =
    isNegative && (a.reason ?? "").trim() === "0";

  const reasonValid =
    notApplicable || !requireReason || !isNegative || reasonFilled;
  if (!reasonValid) {
    message = "მიზეზი სავალდებულოა";
  }

  return {
    answered,
    requireReason: requireReason && isNegative && !notApplicable,
    reasonFilled,
    valid: answered && reasonValid,
    message,
  };
}

export function SurveyPanel({
  patient,
  questions,
  existing,
  onSaved,
  onPatientUpdated,
  surveyDate,
  readOnly = false,
  canEditPatientDemographics = false,
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
  onSaved: () => void | Promise<void>;
  onPatientUpdated?: () => void;
  surveyDate: string;
  readOnly?: boolean;
  canEditPatientDemographics?: boolean;
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
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [patientBusy, setPatientBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const emptyAnswers = useMemo(() => {
    const map: Record<string, AnswerState> = {};
    for (const q of questions) {
      map[q.id] = {
        selectedValues: [],
        textValue: "",
        ratingValue: null,
        reason: "",
      };
    }
    return map;
  }, [questions]);

  const statuses = useMemo<Record<string, QuestionStatus>>(() => {
    const s: Record<string, QuestionStatus> = {};
    for (const q of questions) {
      const a = answers[q.id] || {
        selectedValues: [],
        textValue: "",
        ratingValue: null,
        reason: "",
      };
      s[q.id] = evaluateQuestion(q, a);
    }
    return s;
  }, [answers, questions]);

  const { allValid, invalidCount } = useMemo(() => {
    let n = 0;
    for (const q of questions) {
      if (!statuses[q.id]?.valid) n++;
    }
    return { allValid: n === 0, invalidCount: n };
  }, [questions, statuses]);

  const draftDirty = useMemo(() => {
    if (existing) return false;
    if (comment.trim()) return true;
    for (const q of questions) {
      const a = answers[q.id];
      if (!a) continue;
      if (a.reason.trim() || a.textValue.trim()) return true;
      if (a.ratingValue != null) return true;
      if (a.selectedValues.length > 0) return true;
    }
    return false;
  }, [answers, comment, existing, questions]);

  const canEditManualPatient =
    canEditPatientDemographics &&
    !readOnly &&
    patient?.source === "manual";

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setAnswers(initial);
      setComment(existing?.comment || "");
      setError("");
    });
    return () => {
      cancelled = true;
    };
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

  async function flashSavedThen(onDone: () => void | Promise<void>) {
    setSavedFlash(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSavedFlash(false);
    await onDone();
  }

  async function save() {
    if (!allValid) {
      setError(`შეავსეთ ყველა კითხვა: გაუცდელია ${invalidCount}`);
      return;
    }
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
      await flashSavedThen(onSaved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setSaving(false);
    }
  }

  function cancelDraft() {
    if (existing) return;
    if (!draftDirty) return;
    if (
      !confirm(
        "გაუქმდეს შევსებული პასუხები? (შენახული გამოკითხვა არ შეიცვლება)",
      )
    ) {
      return;
    }
    setAnswers(emptyAnswers);
    setComment("");
    setError("");
  }

  async function savePatientDemographics(data: {
    id: string;
    fullName: string;
    personalId: string;
    historyNumber: string;
  }) {
    setPatientBusy(true);
    try {
      const res = await fetch("/api/patients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "რედაქტირება ვერ მოხერხდა");
      onPatientUpdated?.();
    } finally {
      setPatientBusy(false);
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
      await flashSavedThen(onSaved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
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
          {(canEditManualPatient || existing) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {canEditManualPatient ? (
                <button
                  type="button"
                  onClick={() => setEditPatientOpen(true)}
                  className="text-sm rounded-xl border border-border px-3 py-1.5 hover:bg-accent"
                >
                  პაციენტის რედაქტირება
                </button>
              ) : (
                <span />
              )}
              {existing && (
                <span className="text-sm px-3 py-1 rounded-full bg-accent text-primary ml-auto">
                  {assessmentLabel(existing.assessment)}
                  {readOnly ? " · მხოლოდ ნახვა" : ""}
                </span>
              )}
            </div>
          )}
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
          const st = statuses[q.id];
          const showReason = !!st?.requireReason;

          return (
            <div
              key={q.id}
              className={`bg-card border rounded-2xl p-5 space-y-3 ${
                !readOnly && st && !st.valid
                  ? "border-fix/60 ring-2 ring-fix/15"
                  : "border-border"
              }`}
            >
              <p className="font-medium">
                {idx + 1}. {q.text}
                <span className="text-fix"> *</span>
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
                  />
                </label>
              )}

              {!readOnly && st && !st.valid && st.message && (
                <p className="text-fix text-xs -mt-1">✕ {st.message}</p>
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
          <div className="space-y-2">
            <div className="flex flex-row gap-2 w-full items-center portrait:flex-wrap landscape:grid landscape:grid-cols-3 landscape:gap-3">
            <button
              type="button"
              disabled={saving || !allValid}
              onClick={save}
              title={
                !allValid
                  ? `${invalidCount} კითხვა პასუხგაუცემელია`
                  : existing
                    ? "განახლება"
                    : "შენახვა"
              }
              aria-label={
                saving
                  ? "ინახება"
                  : existing
                    ? "განახლება"
                    : "შენახვა"
              }
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary-dark text-white h-11 w-11 portrait:w-11 landscape:w-auto landscape:min-w-0 landscape:px-8 landscape:py-3 font-medium disabled:opacity-60 landscape:justify-self-start"
            >
              <span className="hidden portrait:inline-flex landscape:hidden" aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </span>
              <span className="hidden landscape:inline">
                {saving
                  ? "ინახება..."
                  : !allValid
                    ? `${invalidCount} კითხვა პასუხგაუცემელია`
                    : existing
                      ? "განახლება"
                      : "შენახვა"}
              </span>
            </button>
            <button
              type="button"
              disabled={saving || !!existing || !draftDirty}
              onClick={cancelDraft}
              title={
                existing
                  ? "შენახულ გამოკითხვაზე გაუქმება არ მუშაობს"
                  : !draftDirty
                    ? "შესავსები ცვლილება არ არის"
                    : "გაუქმება"
              }
              aria-label="გაუქმება"
              className="shrink-0 inline-flex items-center justify-center rounded-xl border border-border h-11 w-11 portrait:w-11 landscape:w-auto landscape:px-6 landscape:py-3 font-medium hover:bg-accent disabled:opacity-60 landscape:justify-self-center"
            >
              <span className="hidden portrait:inline-flex landscape:hidden" aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </span>
              <span className="hidden landscape:inline">გაუქმება</span>
            </button>
            <button
              type="button"
              disabled={saving || !!existing}
              onClick={abstain}
              title={
                existing
                  ? "შეფასება უკვე შენახულია — თავის შეკავება აღარ შეიძლება"
                  : undefined
              }
              className="flex-1 min-w-0 portrait:flex-1 landscape:flex-none w-auto rounded-xl border border-border text-muted px-3 landscape:px-6 py-3 text-sm landscape:text-base font-medium hover:bg-accent disabled:opacity-60 landscape:justify-self-end landscape:w-full"
            >
              თავი შეიკავა
            </button>
            </div>
            {savedFlash && (
              <p
                className="text-center text-sm font-semibold text-good pt-1"
                role="status"
                aria-live="polite"
              >
                შენახულია
              </p>
            )}
          </div>
        )}

        <EditPatientModal
          open={editPatientOpen}
          busy={patientBusy}
          patient={patient}
          onClose={() => setEditPatientOpen(false)}
          onSubmit={savePatientDemographics}
        />
      </div>
    </div>
  );
}
