"use client";

import { Fragment, useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startOfMonth,
  subWeeks,
  subMonths,
  format,
} from "date-fns";
import { assessmentLabel, type AssessmentLevel } from "@/lib/labels";
import { topProblemsByAssessment, type TopProblem } from "@/lib/problems";
import { localDateISO, prevDayISO, nextDayISO, isTodayISO } from "@/lib/dates";
import {
  ABSTAIN_REASON_ORDER,
  abstainReasonLabel,
  abstainReasonWithNumber,
  effectiveAbstainReason,
  type AbstainReason,
} from "@/lib/abstainReason";
import { isNotApplicableAnswer } from "@/lib/notApplicable";

type AnswerRow = {
  questionId: string;
  question: { text: string; type: string } | null;
  selectedValues: string[];
  textValue: string | null;
  ratingValue: number | null;
  reason: string | null;
  isNegative: boolean;
};

type Row = {
  id: string;
  surveyDate: string;
  assessment: AssessmentLevel;
  abstainReason?: AbstainReason | null;
  comment: string | null;
  patient: {
    fullName: string;
    departmentName: string | null;
    historyNumber: string | null;
    personalId: string | null;
  };
  author: { name: string };
  questionnaire: { title: string };
  answers: AnswerRow[];
};

export default function ResultsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [questionTexts, setQuestionTexts] = useState<string[]>([]);
  const [date, setDate] = useState(() => localDateISO());
  const [fromDate, setFromDate] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [toDate, setToDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detailOpen, setDetailOpen] = useState<"ATTENTION" | "FIX_NEEDED" | null>(
    null,
  );

  function setPreset(kind: "week" | "month1" | "month2" | "month3" | "thisMonth") {
    const today = new Date();
    let from = startOfMonth(today);
    let to = today;
    switch (kind) {
      case "week":
        from = subWeeks(today, 1);
        to = today;
        break;
      case "month1":
        from = subWeeks(today, 4);
        to = today;
        break;
      case "month2":
        from = subMonths(today, 2);
        to = today;
        break;
      case "month3":
        from = subMonths(today, 3);
        to = today;
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = today;
        break;
    }
    setFromDate(format(from, "yyyy-MM-dd"));
    setToDate(format(to, "yyyy-MM-dd"));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [surveysRes, patientsRes] = await Promise.allSettled([
        fetch(`/api/surveys?date=${date}`),
        fetch(`/api/patients?date=${date}`),
      ]);
      if (cancelled) return;
      if (surveysRes.status === "fulfilled") {
        try {
          const data = await surveysRes.value.json();
          setRows(Array.isArray(data) ? data : []);
        } catch {
          setRows([]);
        }
      } else {
        setRows([]);
      }
      if (patientsRes.status === "fulfilled") {
        try {
          const data = await patientsRes.value.json();
          setRosterTotal(Array.isArray(data.patients) ? data.patients.length : 0);
        } catch {
          setRosterTotal(0);
        }
      } else {
        setRosterTotal(0);
      }
      setFromDate(date);
      setToDate(date);
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/forms/active");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        const texts = (data?.questions || [])
          .map((q: { text?: string }) => String(q.text || "").trim())
          .filter(Boolean);
        setQuestionTexts(texts.slice(0, 8));
      } catch {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function rolloverIfNeeded() {
      const today = localDateISO();
      setDate((current) => (current !== today ? today : current));
    }
    rolloverIfNeeded();
    const t = setInterval(rolloverIfNeeded, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") rolloverIfNeeded();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const p = r.patient;
      return (
        p.fullName.toLowerCase().includes(q) ||
        (p.personalId || "").toLowerCase().includes(q) ||
        (p.historyNumber || "").toLowerCase().includes(q) ||
        (p.departmentName || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const interviewed = filteredRows.length;
  const good = filteredRows.filter((r) => r.assessment === "GOOD").length;
  const attention = filteredRows.filter((r) => r.assessment === "ATTENTION").length;
  const fix = filteredRows.filter((r) => r.assessment === "FIX_NEEDED").length;
  const abstainedRows = filteredRows.filter(
    (r) => r.assessment === "ABSTAINED",
  );
  const abstainByReason = Object.fromEntries(
    ABSTAIN_REASON_ORDER.map((key) => [
      key,
      abstainedRows.filter(
        (r) => effectiveAbstainReason(r.abstainReason) === key,
      ).length,
    ]),
  ) as Record<AbstainReason, number>;

  const attentionProblems = useMemo(
    () => topProblemsByAssessment(filteredRows, "ATTENTION", 8, questionTexts),
    [filteredRows, questionTexts],
  );
  const fixProblems = useMemo(
    () => topProblemsByAssessment(filteredRows, "FIX_NEEDED", 8, questionTexts),
    [filteredRows, questionTexts],
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function answerText(a: AnswerRow) {
    if (a.ratingValue != null) return `რეიტინგი: ${a.ratingValue}`;
    if (a.selectedValues && a.selectedValues.length > 0) return a.selectedValues.join(", ");
    if (a.textValue) return a.textValue;
    return "—";
  }

  function exportExcel() {
    const url = `/api/reports/export?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
    router.push(url);
  }

  return (
    <div>
      <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">შედეგები</h1>
          <p className="text-sm text-muted mt-1">
            აქ ჩანს ვინ რა შეფასება მიიღო (დეტალები იმეილში არ იგზავნება)
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row md:flex-wrap md:items-end">
          <label className="text-sm flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted shrink-0">თარიღი</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDate(prevDayISO(date))}
                className="shrink-0 w-9 h-9 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition flex items-center justify-center"
                title="წინა დღე"
                aria-label="წინა დღე"
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-border px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setDate(nextDayISO(date))}
                disabled={isTodayISO(date)}
                className="shrink-0 w-9 h-9 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                title="შემდეგი დღე"
                aria-label="შემდეგი დღე"
              >
                ›
              </button>
            </div>
          </label>
          <label className="text-sm flex flex-col gap-1.5 w-full md:w-auto">
            <span className="text-muted">ძებნა</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="სახელი, პ/ნ, ისტორია..."
              className="w-full md:w-[220px] rounded-xl border border-border px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
        <div className="text-sm font-medium">ექსელის ექსპორტი (პერიოდით)</div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <label className="text-sm flex flex-col gap-1 flex-1 min-w-[140px]">
            <span className="text-muted text-xs">დან</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm flex flex-col gap-1 flex-1 min-w-[140px]">
            <span className="text-muted text-xs">მდე</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {(
            [
              ["week", "1 კვირა"],
              ["month1", "1 თვე"],
              ["month2", "2 თვე"],
              ["month3", "3 თვე"],
              ["thisMonth", "მიმდ. თვე"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent text-muted cursor-pointer whitespace-nowrap shrink-0"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportExcel}
          className="w-full sm:w-auto rounded-xl bg-primary text-white px-4 py-2.5 hover:bg-primary-dark"
        >
          გადმოტანა Excel-ში
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <Stat label="გამოსაკითხი იყო" value={rosterTotal} />
        <Stat label="გამოიკითხა" value={interviewed} />
        <Stat label="კარგია" value={good} tone="good" />
        <Stat
          label="საყურადღებოა"
          value={attention}
          tone="attention"
          detailLabel="დეტალურად"
          detailOpen={detailOpen === "ATTENTION"}
          onDetail={() =>
            setDetailOpen((v) => (v === "ATTENTION" ? null : "ATTENTION"))
          }
        />
        <Stat
          label="გამოსასწორებელია"
          value={fix}
          tone="fix"
          detailLabel="დეტალურად"
          detailOpen={detailOpen === "FIX_NEEDED"}
          onDetail={() =>
            setDetailOpen((v) => (v === "FIX_NEEDED" ? null : "FIX_NEEDED"))
          }
        />
        <Stat
          label=""
          value={0}
          tone="attention"
          breakdownOnly
          subLines={ABSTAIN_REASON_ORDER.map((key) => ({
            label: abstainReasonWithNumber(key),
            value: abstainByReason[key] ?? 0,
          }))}
        />
      </div>

      {detailOpen === "ATTENTION" && (
        <TopProblemsPanel
          title="ტოპ პრობლემები — საყურადღებოა"
          problems={attentionProblems}
          onClose={() => setDetailOpen(null)}
        />
      )}
      {detailOpen === "FIX_NEEDED" && (
        <TopProblemsPanel
          title="ტოპ პრობლემები — გამოსასწორებელია"
          problems={fixProblems}
          onClose={() => setDetailOpen(null)}
        />
      )}

      <div className="md:hidden space-y-3">
        {filteredRows.length === 0 && (
          <p className="text-center text-muted py-8 bg-card border border-border rounded-2xl text-sm">
            ჩანაწერები არ არის
          </p>
        )}
        {filteredRows.map((r) => {
          const isOpen = !!expanded[r.id];
          return (
            <article
              key={r.id}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="p-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(r.id)}
                  className="shrink-0 w-9 h-9 rounded-lg border border-border hover:bg-accent text-muted flex items-center justify-center"
                  aria-expanded={isOpen}
                >
                  {isOpen ? "−" : "+"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[15px] leading-snug">
                    {r.patient.fullName}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {r.patient.historyNumber || "—"}
                    {r.patient.personalId
                      ? ` · პ/ნ ${r.patient.personalId}`
                      : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AssessmentBadge
                      level={r.assessment}
                      abstainReason={r.abstainReason}
                    />
                    <span className="text-xs text-muted">
                      {r.patient.departmentName || "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5">
                    {r.author.name}
                    {r.surveyDate ? ` · ${r.surveyDate.slice(0, 10)}` : ""}
                  </p>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-border bg-accent/20 px-3 py-3 space-y-3">
                  <SurveyAnswersBlock row={r} answerText={answerText} />
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-left">
            <tr>
              <th className="p-3 w-10"></th>
              <th className="p-3 font-medium">პაციენტი</th>
              <th className="p-3 font-medium">განყოფილება</th>
              <th className="p-3 font-medium">შეფასება</th>
              <th className="p-3 font-medium">გამომკითხველი</th>
              <th className="p-3 font-medium">თარიღი</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  ჩანაწერები არ არის
                </td>
              </tr>
            )}
            {filteredRows.map((r) => {
              const isOpen = !!expanded[r.id];
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-border">
                    <td className="p-3 align-top">
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.id)}
                        className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-muted"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "−" : "+"}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.patient.fullName}</div>
                      <div className="text-xs text-muted">{r.patient.historyNumber || "—"}</div>
                    </td>
                    <td className="p-3">{r.patient.departmentName || "—"}</td>
                    <td className="p-3">
                      {r.assessment === "ABSTAINED"
                        ? abstainReasonLabel(r.abstainReason)
                        : assessmentLabel(r.assessment)}
                    </td>
                    <td className="p-3">{r.author.name}</td>
                    <td className="p-3 text-xs text-muted">
                      {r.surveyDate ? r.surveyDate.slice(0, 10) : ""}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-border bg-accent/20">
                      <td></td>
                      <td colSpan={5} className="p-4">
                        <SurveyAnswersBlock row={r} answerText={answerText} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function AssessmentBadge({
  level,
  abstainReason,
}: {
  level: AssessmentLevel;
  abstainReason?: AbstainReason | null;
}) {
  const tone =
    level === "GOOD"
      ? "bg-good/15 text-good border-good/30"
      : level === "ATTENTION" || level === "ABSTAINED"
        ? "bg-attention/15 text-attention border-attention/30"
        : level === "FIX_NEEDED"
          ? "bg-fix/15 text-fix border-fix/30"
          : "bg-accent text-foreground border-border";
  const text =
    level === "ABSTAINED"
      ? abstainReasonLabel(abstainReason)
      : assessmentLabel(level);
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md border ${tone}`}
    >
      {text}
    </span>
  );
}

function SurveyAnswersBlock({
  row,
  answerText,
}: {
  row: Row;
  answerText: (a: AnswerRow) => string;
}) {
  return (
    <div className="space-y-3">
      {row.assessment === "ABSTAINED" && (
        <p className="text-sm font-medium text-attention">
          {abstainReasonLabel(row.abstainReason)}
        </p>
      )}
      {row.comment && (
        <div className="bg-white rounded-xl p-3 border border-border">
          <p className="text-xs text-muted mb-1">დამატებითი კომენტარი</p>
          <p className="text-sm">{row.comment}</p>
        </div>
      )}
      <div className="space-y-2">
        {(row.answers || []).map((a, idx) => (
          <div
            key={a.questionId || idx}
            className="bg-white rounded-xl p-3 border border-border space-y-1"
          >
            <p className="text-sm font-medium leading-snug break-words">
              {idx + 1}. {a.question?.text || "კითხვა"}
            </p>
            {isNotApplicableAnswer(a) ? (
              <p className="text-sm text-muted leading-snug">
                (მიზეზი 0) - პასუხი არ აქვს, რადგან ეს მომსახურება ჯერ არ
                მიუღია
              </p>
            ) : (
              <>
                <p className="text-sm text-muted break-words">
                  პასუხი: {answerText(a)}
                </p>
                {a.reason && (
                  <p className="text-sm break-words">
                    <span className="text-muted">მიზეზი: </span>
                    {a.reason}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
        {(!row.answers || row.answers.length === 0) && (
          <p className="text-xs text-muted">პასუხები ვერ მოიძებნა</p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  detailLabel,
  detailOpen,
  onDetail,
  subLines,
  breakdownOnly,
}: {
  label: string;
  value: number;
  tone?: "good" | "attention" | "fix";
  detailLabel?: string;
  detailOpen?: boolean;
  onDetail?: () => void;
  subLines?: { label: string; value: number }[];
  breakdownOnly?: boolean;
}) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "attention"
        ? "text-attention"
        : tone === "fix"
          ? "text-fix"
          : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 min-h-[88px] sm:min-h-[108px] flex flex-col overflow-hidden">
      {breakdownOnly && subLines && subLines.length > 0 ? (
        <ul
          className={`space-y-1.5 text-[11px] sm:text-xs leading-snug flex-1 ${color}`}
        >
          {subLines.map((line) => (
            <li key={line.label} className="flex justify-between gap-3">
              <span className="min-w-0 leading-snug">{line.label}</span>
              <span className="tabular-nums font-semibold shrink-0">
                {line.value}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {label ? (
            <p className="text-[11px] sm:text-xs text-muted pr-1 break-words leading-snug">
              {label}
            </p>
          ) : null}
          <p className={`text-xl sm:text-2xl font-semibold mt-1 ${color}`}>
            {value}
          </p>
          {subLines && subLines.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10px] sm:text-[11px] text-muted leading-snug">
              {subLines.map((line) => (
                <li key={line.label} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{line.label}</span>
                  <span className="tabular-nums font-medium shrink-0">
                    {line.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {detailLabel && onDetail && (
        <button
          type="button"
          onClick={onDetail}
          className={`mt-auto self-end text-[11px] font-medium cursor-pointer rounded-md px-2 py-0.5 transition ${
            detailOpen
              ? "bg-primary text-white"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {detailLabel}
        </button>
      )}
    </div>
  );
}

function TopProblemsPanel({
  title,
  problems,
  onClose,
}: {
  title: string;
  problems: TopProblem[];
  onClose: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted mt-0.5">
            დალაგებულია სიხშირის მიხედვით (ყველაზე ხშირი ზემოთ)
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground"
        >
          დახურვა
        </button>
      </div>
      {problems.length === 0 ? (
        <p className="text-sm text-muted">პრობლემები ამ კატეგორიაში არ არის</p>
      ) : (
        <ol className="space-y-2">
          {problems.map((p, i) => (
            <li
              key={p.question}
              className="flex items-start justify-between gap-3 text-sm border-b border-border/60 pb-2 last:border-0"
            >
              <span className="min-w-0">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-primary text-xs font-semibold mr-2 shrink-0 align-middle">
                  {i + 1}
                </span>
                {p.question}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-primary">
                {p.count}-ჯერ
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
