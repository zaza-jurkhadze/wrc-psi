"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PatientSidebar, type RosterPatient } from "@/components/PatientSidebar";
import { SurveyPanel } from "@/components/SurveyPanel";
import { AddPatientModal, type NewPatientPayload } from "@/components/AddPatientModal";
import { isTodayISO, localDateISO } from "@/lib/dates";

type Question = Parameters<typeof SurveyPanel>[0]["questions"][number];
type ExistingSurvey = Parameters<typeof SurveyPanel>[0]["existing"];

export default function HomePage() {
  const { data: session } = useSession();
  const [date, setDate] = useState(() => localDateISO());
  const [patients, setPatients] = useState<RosterPatient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formQuestions, setFormQuestions] = useState<Question[]>([]);
  const [existing, setExisting] = useState<ExistingSurvey>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const canDelete = useMemo(() => {
    const r = session?.user?.role;
    return r === "ADMIN" || r === "QUALITY_MANAGER" || r === "INTERVIEWER";
  }, [session]);

  const canManageRoster = canDelete; // same role set: ADMIN/QM/INTERVIEWER

  const canEditToday = isTodayISO(date);
  const selected = patients.find((p) => p.id === selectedId) || null;
  const questions = existing?.questionnaire?.questions?.length
    ? existing.questionnaire.questions
    : formQuestions;

  function toggleDelete(id: string) {
    setDeleteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function deleteSelected() {
    if (deleteIds.length === 0) return;
    if (!confirm(`ამოვიღოთ ${deleteIds.length} პაციენტი ამ დღის სიიდან? შეფასებული პაციენტები არ წაიშლება, გამოკითხვების შედეგები რჩება.`))
      return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/patients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deleteIds, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "წაშლა ვერ მოხერხდა");
      const removed = Number(data.count) || 0;
      const skipped = Number(data.skipped) || 0;
      const skippedIds = Array.isArray(data.skippedIds) ? data.skippedIds : [];
      if (removed > 0 && skipped > 0) {
        setMessage(`სიიდან ამოვიღე: ${removed}. გამოტოვებული (შეფასებული): ${skipped}`);
      } else if (removed > 0) {
        setMessage(`სიიდან ამოვიღე: ${removed}`);
      } else if (skipped > 0) {
        setMessage(`${skipped} შეფასებული პაციენტი — სიიდან ვერ ამოვიღე (შედეგები რჩება)`);
      }
      setDeleteIds(skippedIds.length > 0 ? skippedIds : []);
      if (
        selectedId &&
        deleteIds.includes(selectedId) &&
        !skippedIds.includes(selectedId)
      ) {
        setSelectedId(null);
      }
      await loadPatients();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setBusy(false);
    }
  }

  const loadPatients = useCallback(async (q = query, day = date) => {
    try {
      const res = await fetch(
        `/api/patients?q=${encodeURIComponent(q)}&date=${encodeURIComponent(day)}`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
      }
      const data = await res.json();
      setPatients(data.patients || []);
    } catch (e) {
      console.error("loadPatients failed", e);
      setMessage(e instanceof Error ? e.message : "ჩამოტვირთვის შეცდომა");
      setPatients([]);
    }
  }, [query, date]);

  const loadForm = useCallback(async () => {
    try {
      const res = await fetch("/api/forms/active");
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.questions || []) as Question[];
    } catch (e) {
      console.error("loadForm failed", e);
      return [];
    }
  }, []);

  const loadSurvey = useCallback(async (patientId: string, day = date) => {
    try {
      const res = await fetch(
        `/api/surveys?patientId=${patientId}&date=${encodeURIComponent(day)}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.id ? (data as ExistingSurvey) : null;
    } catch (e) {
      console.error("loadSurvey failed", e);
      return null;
    }
  }, [date]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadPatients(query, date);
    }, 250);
    return () => clearTimeout(t);
  }, [query, date, loadPatients]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const questions = await loadForm();
      if (!cancelled) setFormQuestions(questions);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadForm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedId) {
        if (!cancelled) setExisting(null);
        return;
      }
      const result = await loadSurvey(selectedId, date);
      if (!cancelled) setExisting(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, date, loadSurvey]);

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

  async function withBusy(fn: () => Promise<void>, okMsg: string) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(okMsg);
      await loadPatients();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPatient(payload: NewPatientPayload) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, surveyDate: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "დამატება ვერ მოხერხდა");
      setSelectedId(data.id);
      setMessage("პაციენტი დაემატა");
      await loadPatients();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
      <PatientSidebar
        patients={patients}
        selectedId={selectedId}
        query={query}
        onQueryChange={(v) => {
          setQuery(v);
        }}
        date={date}
        onDateChange={(iso) => {
          setDate(iso);
          setSelectedId(null);
          setDeleteIds([]);
          setExisting(null);
        }}
        canEditToday={canEditToday}
        canManageRoster={canManageRoster}
        onSelect={setSelectedId}
        busy={busy}
        message={message}
        canDelete={canDelete}
        selectedDeleteIds={deleteIds}
        onToggleDelete={toggleDelete}
        onDeleteSelected={deleteSelected}
        onRefreshApi={() =>
          withBusy(async () => {
            const res = await fetch("/api/patients/sync", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "API სინქი ვერ მოხერხდა");
            setMessage(`განახლდა: ${data.count}`);
          }, "API განახლება დასრულდა")
        }
        onImportExcel={(file) =>
          withBusy(async () => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("date", date);
            const res = await fetch("/api/patients/import", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "იმპორტი ვერ მოხერხდა");
            // იმპორტის შემდეგ ავტომატურად ვტვირთავთ პაციენტების სიას, რომ ახალნი ჩანდეს
            await loadPatients();
            setMessage(
              `იმპორტი დასრულდა: ჯამური ${data.count} (ახალი: ${data.created ?? 0}, განახლებული: ${data.updated ?? 0})`,
            );
          }, "Excel იმპორტი დასრულდა")
        }
        onAddPatient={() => setAddOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <SurveyPanel
          patient={selected}
          questions={questions}
          existing={existing}
          surveyDate={date}
          readOnly={!canEditToday}
          onSaved={async () => {
            await loadPatients();
            if (selectedId) await loadSurvey(selectedId);
            setMessage("გამოკითხვა შენახულია");
          }}
        />
      </div>

      <AddPatientModal
        open={addOpen}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddPatient}
      />
    </div>
  );
}
