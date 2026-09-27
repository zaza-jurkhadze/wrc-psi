"use client";

import { FormEvent, useState } from "react";

const NAME_RE = /^[\p{L}\s'\-]+$/u;
const DIGITS_RE = /^\d+$/;

export type NewPatientPayload = {
  fullName: string;
  departmentName: string;
  personalId: string;
  historyNumber: string;
};

export function AddPatientModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: NewPatientPayload) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [personalId, setPersonalId] = useState("");
  const [historyNumber, setHistoryNumber] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function reset() {
    setFullName("");
    setDepartmentName("");
    setPersonalId("");
    setHistoryNumber("");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const name = fullName.trim();
    if (!name) {
      setError("სახელი და გვარი სავალდებულოა");
      return;
    }
    if (!NAME_RE.test(name)) {
      setError("სახელსა და გვარში მხოლოდ ასოებია დაშვებული");
      return;
    }

    const pid = personalId.trim();
    if (!pid) {
      setError("პირადი ნომერი სავალდებულოა");
      return;
    }
    if (!DIGITS_RE.test(pid)) {
      setError("პირად ნომერში მხოლოდ ციფრებია დაშვებული");
      return;
    }

    const dept = departmentName.trim();
    if (!dept) {
      setError("განყოფილება სავალდებულოა");
      return;
    }

    const hist = historyNumber.trim();
    if (!hist) {
      setError("ისტორიის ნომერი სავალდებულოა");
      return;
    }

    try {
      await onSubmit({
        fullName: name,
        departmentName: dept,
        personalId: pid,
        historyNumber: hist,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-patient-title"
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-5"
      >
        <h2 id="add-patient-title" className="text-lg font-semibold">
          ახალი პაციენტი
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted">სახელი და გვარი</span>
            <input
              value={fullName}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || NAME_RE.test(v)) setFullName(v);
              }}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
              required
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">განყოფილება</span>
            <input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">პირადი ნომერი (მხოლოდ ციფრები)</span>
            <input
              value={personalId}
              inputMode="numeric"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || DIGITS_RE.test(v)) setPersonalId(v);
              }}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">ისტორიის ნომერი</span>
            <input
              value={historyNumber}
              onChange={(e) => setHistoryNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/25"
              required
            />
          </label>

          {error && <p className="text-sm text-fix">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                reset();
                onClose();
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-primary text-white px-4 py-2 text-sm hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "ინახება…" : "დამატება"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
