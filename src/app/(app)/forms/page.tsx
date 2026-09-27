"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type FormRow = {
  id: string;
  title: string;
  active: boolean;
  version: number;
  updatedAt: string;
  _count: { surveys: number };
  questions: { id: string }[];
};

export default function FormsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const r = session?.user?.role;
    if (r && r !== "ADMIN" && r !== "QUALITY_MANAGER") {
      router.replace("/");
    }
  }, [session, router]);

  async function load() {
    const res = await fetch("/api/forms");
    setForms(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function createForm() {
    if (!title.trim()) return;
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, active: forms.length === 0 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "შეცდომა");
      return;
    }
    setTitle("");
    await load();
  }

  return (
    <div>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">კითხვარები</h1>
        <p className="text-muted text-sm mt-1">
          შექმენით და შეცვალეთ კითხვები, პასუხის ვარიანტები და რეიტინგი
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ახალი კითხვარის სათაური"
          className="flex-1 rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
        />
        <button
          type="button"
          onClick={createForm}
          className="rounded-xl bg-primary text-white px-5 py-2 hover:bg-primary-dark"
        >
          შექმნა
        </button>
      </div>
      {msg && <p className="text-sm text-fix">{msg}</p>}

      <ul className="space-y-3">
        {forms.map((f) => (
          <li
            key={f.id}
            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-medium">
                {f.title}{" "}
                {f.active && (
                  <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-good/10 text-good">
                    აქტიური
                  </span>
                )}
              </p>
              <p className="text-xs text-muted mt-1">
                ვერსია {f.version} · კითხვები: {f.questions.length} · გამოკითხვები:{" "}
                {f._count.surveys}
              </p>
            </div>
            <Link
              href={`/forms/${f.id}`}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              რედაქტირება
            </Link>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
