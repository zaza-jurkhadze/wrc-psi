"use client";

import { useEffect, useMemo, useState } from "react";

type Role =
  | "INTERVIEWER"
  | "HEAD_NURSE"
  | "QUALITY_MANAGER"
  | "MEDICAL_DIRECTOR"
  | "GENERAL_DIRECTOR"
  | "ADMIN";

type Department = { id: string; name: string };

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  departmentId: string | null;
  department: Department | null;
  createdAt: string;
  isSelf: boolean;
};

type EditState = null | { mode: "create" } | { mode: "edit"; user: UserRow };

const ROLE_LABELS: Record<Role, string> = {
  INTERVIEWER: "ინტერვიუერი",
  HEAD_NURSE: "უფროსი ექთანი",
  QUALITY_MANAGER: "ხარისხის მენეჯერი",
  MEDICAL_DIRECTOR: "სამედიცინო დირექტორი",
  GENERAL_DIRECTOR: "გენერალური დირექტორი",
  ADMIN: "ადმინისტრატორი",
};

const ROLE_ORDER: Role[] = [
  "ADMIN",
  "GENERAL_DIRECTOR",
  "MEDICAL_DIRECTOR",
  "QUALITY_MANAGER",
  "HEAD_NURSE",
  "INTERVIEWER",
];

const PASSWORD_SYMBOLS = "!@#$%^&*";

function validatePassword(raw: string | undefined): { ok: boolean; reason: string } {
  if (!raw || raw.length < 6) {
    return { ok: false, reason: "მინიმუმ 6 სიმბოლო" };
  }
  if (!/[A-Z]/.test(raw)) {
    return { ok: false, reason: "≥ 1 დიდი ასო (A–Z)" };
  }
  if (!/[0-9]/.test(raw)) {
    return { ok: false, reason: "≥ 1 ციფრი (0–9)" };
  }
  const hasSymbol = PASSWORD_SYMBOLS.split("").some((s) => raw.includes(s));
  if (!hasSymbol) {
    return { ok: false, reason: `≥ 1 სიმბოლო (${PASSWORD_SYMBOLS.split("").join(" ")})` };
  }
  return { ok: true, reason: "ლოპინარი სწორია" };
}

function generatePassword(len = 10) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const dig = "23456789";
  const sym = PASSWORD_SYMBOLS;
  const all = upper + lower + dig + sym;
  let out = "";
  out += upper[Math.floor(Math.random() * upper.length)];
  out += dig[Math.floor(Math.random() * dig.length)];
  out += sym[Math.floor(Math.random() * sym.length)];
  while (out.length < len) {
    out += all[Math.floor(Math.random() * all.length)];
  }
  return out
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [busy, setBusy] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [edit, setEdit] = useState<EditState>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const [uRes, dRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/departments"),
        ]);
        if (cancelled) return;
        if (!uRes.ok) throw new Error((await uRes.json()).error || "მომხმარებელთა ჩატვირთვა ვერ მოხერხდა");
        const u = await uRes.json();
        setRows(u.rows || []);

        if (dRes.ok) {
          const d = await dRes.json();
          setDepartments((d.rows || d.departments || []) as Department[]);
        }
      } catch (e) {
        if (!cancelled) setToast({ type: "err", text: (e as Error).message });
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleActive(user: UserRow) {
    if (user.isSelf) {
      setToast({ type: "err", text: "საკუთარი პროფილის აქტიურობა არ შეიცვლება" });
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, active: !user.active }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "შეცდომა");
      setRows((rs) => rs.map((r) => (r.id === user.id ? { ...r, active: !r.active } : r)));
      setToast({ type: "ok", text: !user.active ? "აქტიურდება" : "გამორთულია" });
    } catch (e) {
      setToast({ type: "err", text: (e as Error).message });
    }
  }

  async function removeUser(user: UserRow) {
    if (user.isSelf) {
      setToast({ type: "err", text: "საკუთარი თავი ვერ წაშლით" });
      return;
    }
    const ok = window.confirm(`მართლა გსურთ მომხმარებლის "${user.name}" წაშლა?`);
    if (!ok) return;
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "წაშლა ვერ მოხერხდა");
      setRows((rs) => rs.filter((r) => r.id !== user.id));
      setToast({ type: "ok", text: "წაიშალა" });
    } catch (e) {
      setToast({ type: "err", text: (e as Error).message });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.department?.name || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, roleFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.active).length;
    const byRole = ROLE_ORDER.reduce<Record<Role, number>>((acc, r) => {
      acc[r] = rows.filter((x) => x.role === r).length;
      return acc;
    }, {} as Record<Role, number>);
    return { total, active, byRole };
  }, [rows]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <header className="flex flex-wrap gap-3 items-end justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">მომხმარებლები</h1>
          <p className="text-sm text-muted mt-1">
            სულ {stats.total} — აქტიური {stats.active}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdit({ mode: "create" })}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition disabled:opacity-60"
        >
          + ახალი მომხმარებელი
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {ROLE_ORDER.map((r) => (
          <div
            key={r}
            className={`rounded-xl border border-border p-3 bg-card ${
              roleFilter === r ? "ring-2 ring-primary/30" : ""
            }`}
          >
            <div className="text-[11px] uppercase text-muted tracking-wider">
              {ROLE_LABELS[r]}
            </div>
            <div className="mt-1 text-xl font-semibold">{stats.byRole[r]}</div>
            <button
              type="button"
              onClick={() => setRoleFilter((x) => (x === r ? "ALL" : r))}
              className="mt-1 text-[11px] text-primary hover:underline"
            >
              {roleFilter === r ? "ფილტრის გაწმენდა" : "ფილტრი"}
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col sm:flex-row gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ძებნა სახელით, ელფოსტით ან განყოფილებით..."
          className="flex-1 rounded-xl border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
        />
      </section>

      {busy ? (
        <div className="p-10 text-center text-muted">იტვირთება...</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center rounded-xl border border-dashed border-border bg-card text-muted">
          {rows.length === 0 ? "მომხმარებლები არ არის" : "შედეგი არ მოიძებნა"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted">
                <th className="text-left font-medium px-4 py-3">სახელი</th>
                <th className="text-left font-medium px-4 py-3">ელფოსტა</th>
                <th className="text-left font-medium px-4 py-3">როლი</th>
                <th className="text-left font-medium px-4 py-3">განყოფილება</th>
                <th className="text-left font-medium px-4 py-3">სტატუსი</th>
                <th className="text-right font-medium px-4 py-3">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-muted">
                      შექმნილია {new Date(u.createdAt).toLocaleDateString("ka-GE")}
                      {u.isSelf ? " · თქვენ" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="px-4 py-3 text-muted">
                    {u.department?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.active
                          ? "bg-good/15 text-good"
                          : "bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      {u.active ? "აქტიური" : "გამორთული"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEdit({ mode: "edit", user: u })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/30"
                      >
                        რედაქტირება
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={u.isSelf}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/30 disabled:opacity-40"
                      >
                        {u.active ? "გამორთვა" : "აქტივაცია"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUser(u)}
                        disabled={u.isSelf}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-fix/10 text-fix hover:bg-fix/20 disabled:opacity-40"
                      >
                        წაშლა
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <UserFormModal
          mode={edit.mode}
          user={edit.mode === "edit" ? edit.user : undefined}
          departments={departments}
          onClose={() => setEdit(null)}
          onSaved={(saved, created) => {
            if (created) {
              setRows((rs) => [saved, ...rs]);
            } else {
              setRows((rs) =>
                rs.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)),
              );
            }
            setEdit(null);
            setToast({ type: "ok", text: created ? "დაემატა" : "შეიცვალა" });
          }}
          onError={(t) => setToast({ type: "err", text: t })}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border ${
            toast.type === "ok"
              ? "bg-good text-white border-good-dark"
              : "bg-fix text-white border-fix-dark"
          }`}
        >
          {toast.text}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-4 opacity-80 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function UserFormModal(props: {
  mode: "create" | "edit";
  user?: UserRow;
  departments: Department[];
  onClose: () => void;
  onSaved: (u: UserRow, created: boolean) => void;
  onError: (text: string) => void;
}) {
  const isCreate = props.mode === "create";
  const [name, setName] = useState(props.user?.name || "");
  const [email, setEmail] = useState(props.user?.email || "");
  const [role, setRole] = useState<Role>(props.user?.role || "INTERVIEWER");
  const [departmentId, setDepartmentId] = useState<string | "">(
    props.user?.departmentId || "",
  );
  const [password, setPassword] = useState(isCreate ? generatePassword() : "");
  const [active, setActive] = useState<boolean>(props.user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const passwordCheck = validatePassword(isCreate ? password : password || undefined);
  const canSubmitPassword = isCreate ? passwordCheck.ok : !password || passwordCheck.ok;
  const formValid =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    canSubmitPassword;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name,
        email,
        role,
        departmentId: departmentId || null,
      };
      if (isCreate) body.password = password;
      if (!isCreate) {
        if (password) body.password = password;
        body.active = active;
        (body as { id?: string }).id = props.user!.id;
      } else {
        body.active = true;
      }

      const res = await fetch("/api/users", {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "შეცდომა");
      props.onSaved(payload.user || payload, isCreate);
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function copyPass() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setErr("Clipboard ვერ მუშაობს");
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {isCreate ? "ახალი მომხმარებელი" : "რედაქტირება"}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              ინფორმაციის შეტანა / რედაქტირება
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="text-muted hover:text-foreground text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <label className="block">
          <span className="text-sm text-muted">სახელი, გვარი</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted">ელფოსტა</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted">როლი</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            required
          >
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-muted">განყოფილება (არასავალდებულო)</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 bg-background"
          >
            <option value="">— არ მივუთითო —</option>
            {props.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-muted">
            {isCreate ? "პაროლი" : "პაროლი (შეცვლისთვის — ცარიელი დატოვე თუ არ გინდა)"}
          </span>
          <div className="relative mt-1">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 pr-24 outline-none focus:ring-2 focus:ring-primary/30 font-mono ${
                !password || passwordCheck.ok
                  ? "border-border"
                  : "border-fix focus:ring-fix/30"
              }`}
              placeholder={isCreate ? "ავტომატური გენერირებულია" : "ცარიელი — არ შეიცვლება"}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isCreate && (
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="px-2 py-1 rounded-md text-xs border border-border hover:bg-muted/30"
                >
                  ახალი
                </button>
              )}
              {password && (
                <button
                  type="button"
                  onClick={copyPass}
                  className={`px-2 py-1 rounded-md text-xs border ${
                    copied
                      ? "bg-good text-white border-good-dark"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  {copied ? "დაკოპირდა" : "COPY"}
                </button>
              )}
            </div>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px]">
            {[
              { label: "მინიმუმ 6 სიმბოლო", ok: !password || password.length >= 6 },
              { label: "≥ 1 დიდი ასო (A–Z)", ok: !password || /[A-Z]/.test(password) },
              { label: "≥ 1 ციფრი (0–9)", ok: !password || /[0-9]/.test(password) },
              {
                label: `≥ 1 სიმბოლო (${PASSWORD_SYMBOLS.split("").join(" ")})`,
                ok: !password || PASSWORD_SYMBOLS.split("").some((s) => password.includes(s)),
              },
            ].map((r) => (
              <li
                key={r.label}
                className={`flex items-center gap-1.5 ${
                  r.ok ? "text-good" : "text-muted"
                }`}
              >
                <span aria-hidden>{r.ok ? "✓" : "·"}</span>
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
        </label>

        {!isCreate && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-foreground">
              აქტიური მომხმარებელი (შეუძლია დალოგინება)
            </span>
          </label>
        )}

        {err && <p className="text-sm text-fix">{err}</p>}

        <div className="flex items-center gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={props.onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted/30 font-medium"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={busy || !formValid}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "ინახავს..." : isCreate ? "დამატება" : "შენახვა"}
          </button>
        </div>
      </form>
    </div>
  );
}
