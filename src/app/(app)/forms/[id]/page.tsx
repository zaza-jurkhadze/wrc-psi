"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "RATING"
  | "SHORT_TEXT"
  | "LONG_TEXT";


type Option = {
  label: string;
  value: string;
  isNegative: boolean;
  requireReason: boolean;
};

type QuestionDraft = {
  text: string;
  type: QuestionType;
  required: boolean;
  ratingMin: number;
  ratingMax: number;
  options: Option[];
};

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "SINGLE_CHOICE", label: "ერთი არჩევანი" },
  { value: "MULTI_CHOICE", label: "რამდენიმე არჩევანი" },
  { value: "RATING", label: "რეიტინგი" },
  { value: "SHORT_TEXT", label: "მოკლე ტექსტი" },
  { value: "LONG_TEXT", label: "გრძელი ტექსტი" },
];

function emptyQuestion(): QuestionDraft {
  return {
    text: "",
    type: "SINGLE_CHOICE",
    required: true,
    ratingMin: 1,
    ratingMax: 5,
    options: [
      { label: "დიახ", value: "yes", isNegative: false, requireReason: false },
      { label: "არა", value: "no", isNegative: true, requireReason: true },
    ],
  };
}

export default function FormEditorPage() {
  const { data: session } = useSession();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const r = session?.user?.role;
    if (r && r !== "ADMIN" && r !== "QUALITY_MANAGER") {
      router.replace("/");
    }
  }, [session, router]);

  useEffect(() => {
    fetch(`/api/forms/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.title || "");
        setDescription(data.description || "");
        setActive(Boolean(data.active));
        setQuestions(
          (data.questions || []).map(
            (q: {
              text: string;
              type: QuestionType;
              required: boolean;
              ratingMin: number | null;
              ratingMax: number | null;
              options: Option[];
            }) => ({
              text: q.text,
              type: q.type,
              required: q.required,
              ratingMin: q.ratingMin ?? 1,
              ratingMax: q.ratingMax ?? 5,
              options: (q.options || []).map((o) => ({
                label: o.label,
                value: o.value,
                isNegative: o.isNegative,
                requireReason: o.requireReason,
              })),
            }),
          ),
        );
      });
  }, [id]);

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/forms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, active, questions }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(data.error || "შენახვა ვერ მოხერხდა");
      return;
    }
    if (data?.versioned && data?.id) {
      setMsg(`შექმნილია ახალი ვერსია v${data.version || ""}`);
      router.replace(`/forms/${data.id}`);
      return;
    }
    setMsg("შენახულია");
  }

  async function remove() {
    if (!confirm("წავშალოთ კითხვარი?")) return;
    await fetch(`/api/forms/${id}`, { method: "DELETE" });
    router.push("/forms");
  }

  return (
    <div>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">კითხვარის რედაქტორი</h1>
        <button
          type="button"
          onClick={remove}
          className="text-sm text-fix hover:underline"
        >
          წაშლა
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2"
          placeholder="სათაური"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2"
          placeholder="აღწერა"
          rows={2}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          აქტიური კითხვარი (პლანშეტზე ეს გამოჩნდება)
        </label>
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={q.text}
              onChange={(e) => {
                const next = [...questions];
                next[qi] = { ...q, text: e.target.value };
                setQuestions(next);
              }}
              className="flex-1 rounded-xl border border-border px-3 py-2"
              placeholder={`კითხვა ${qi + 1}`}
            />
            <button
              type="button"
              className="text-sm text-fix px-2"
              onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}
            >
              წაშლა
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={q.type}
              onChange={(e) => {
                const next = [...questions];
                next[qi] = { ...q, type: e.target.value as QuestionType };
                setQuestions(next);
              }}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => {
                  const next = [...questions];
                  next[qi] = { ...q, required: e.target.checked };
                  setQuestions(next);
                }}
              />
              კითხვა სავალდებულია
            </label>
          </div>

          {q.type === "RATING" && (
            <div className="flex gap-3 text-sm">
              <label>
                მინ{" "}
                <input
                  type="number"
                  value={q.ratingMin}
                  onChange={(e) => {
                    const next = [...questions];
                    next[qi] = { ...q, ratingMin: Number(e.target.value) };
                    setQuestions(next);
                  }}
                  className="w-16 rounded-lg border border-border px-2 py-1 ml-1"
                />
              </label>
              <label>
                მაქს{" "}
                <input
                  type="number"
                  value={q.ratingMax}
                  onChange={(e) => {
                    const next = [...questions];
                    next[qi] = { ...q, ratingMax: Number(e.target.value) };
                    setQuestions(next);
                  }}
                  className="w-16 rounded-lg border border-border px-2 py-1 ml-1"
                />
              </label>
            </div>
          )}

          {(q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") && (
            <div className="space-y-2">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex flex-wrap items-center gap-2">
                  <input
                    value={o.label}
                    onChange={(e) => {
                      const next = [...questions];
                      const opts = [...q.options];
                      opts[oi] = {
                        ...o,
                        label: e.target.value,
                        value: e.target.value,
                      };
                      next[qi] = { ...q, options: opts };
                      setQuestions(next);
                    }}
                    className="flex-1 min-w-[140px] rounded-lg border border-border px-2 py-1.5 text-sm"
                  />
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={o.isNegative}
                      onChange={(e) => {
                        const next = [...questions];
                        const opts = [...q.options];
                        opts[oi] = { ...o, isNegative: e.target.checked };
                        next[qi] = { ...q, options: opts };
                        setQuestions(next);
                      }}
                    />
                    ნეგატიური
                  </label>
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={o.requireReason}
                      onChange={(e) => {
                        const next = [...questions];
                        const opts = [...q.options];
                        opts[oi] = { ...o, requireReason: e.target.checked };
                        next[qi] = { ...q, options: opts };
                        setQuestions(next);
                      }}
                    />
                    მიზეზი
                  </label>
                  <button
                    type="button"
                    className="text-xs text-muted"
                    onClick={() => {
                      const next = [...questions];
                      next[qi] = {
                        ...q,
                        options: q.options.filter((_, i) => i !== oi),
                      };
                      setQuestions(next);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-primary"
                onClick={() => {
                  const next = [...questions];
                  next[qi] = {
                    ...q,
                    options: [
                      ...q.options,
                      {
                        label: `ვარიანტი ${q.options.length + 1}`,
                        value: `opt${q.options.length + 1}`,
                        isNegative: false,
                        requireReason: false,
                      },
                    ],
                  };
                  setQuestions(next);
                }}
              >
                + ვარიანტი
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setQuestions([...questions, emptyQuestion()])}
        className="rounded-xl border border-dashed border-primary/40 text-primary px-4 py-3 w-full hover:bg-accent"
      >
        + კითხვის დამატება
      </button>

      {msg && <p className="text-sm text-muted">{msg}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="rounded-xl bg-primary text-white px-6 py-3 hover:bg-primary-dark disabled:opacity-60"
      >
        {saving ? "ინახება..." : "შენახვა"}
      </button>
      </div>
    </div>
  );
}
