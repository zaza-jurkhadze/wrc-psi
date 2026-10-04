"use client";

import { useMemo, useState } from "react";
import {
  abstainReasonLabel,
  type AbstainReason,
} from "@/lib/abstainReason";
import { assessmentLabel, type AssessmentLevel } from "@/lib/labels";
import { prevDayISO, nextDayISO } from "@/lib/dates";

export type RosterPatient = {
  id: string;
  fullName: string;
  personalId: string | null;
  historyNumber: string | null;
  source?: string;
  departmentName: string | null;
  age: number | null;
  doctorName: string | null;
  surveyedToday: boolean;
  todaySurveyId: string | null;
  todayAssessment: AssessmentLevel | null;
  todayAbstainReason?: AbstainReason | null;
};

export function PatientSidebar({
  patients,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onRefreshApi,
  onImportExcel,
  onAddPatient,
  busy,
  message,
  canDelete = false,
  selectedDeleteIds,
  onToggleDelete,
  onDeleteSelected,
  date,
  onDateChange,
  canEditToday = true,
  canManageRoster = true,
}: {
  patients: RosterPatient[];
  selectedId: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (id: string) => void;
  onRefreshApi: () => void;
  onImportExcel: (file: File) => void;
  onAddPatient: () => void;
  busy: boolean;
  message: string;
  canDelete?: boolean;
  selectedDeleteIds?: string[];
  onToggleDelete?: (id: string) => void;
  onDeleteSelected?: () => void;
  date: string;
  onDateChange: (iso: string) => void;
  canEditToday?: boolean;
  canManageRoster?: boolean;
}) {
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const p of patients) {
      if (p.departmentName) set.add(p.departmentName);
    }
    return Array.from(set).sort();
  }, [patients]);

  const visiblePatients = useMemo(() => {
    let list = patients;
    if (deptFilter !== "all") {
      list = list.filter((p) => p.departmentName === deptFilter);
    }
    return list;
  }, [patients, deptFilter]);

  const showDelete = canDelete && canEditToday;

  const deletablePatients = useMemo(
    () => visiblePatients.filter((p) => !p.surveyedToday),
    [visiblePatients],
  );

  const allSelected =
    showDelete &&
    deletablePatients.length > 0 &&
    deletablePatients.every((p) => selectedDeleteIds?.includes(p.id));

  const surveyedCount = useMemo(
    () => visiblePatients.filter((p) => p.surveyedToday).length,
    [visiblePatients],
  );

  function toggleAllVisible() {
    if (!onToggleDelete) return;
    const ids = deletablePatients.map((p) => p.id);
    const allChecked = ids.every((id) => selectedDeleteIds?.includes(id));
    for (const id of ids) {
      const isChecked = selectedDeleteIds?.includes(id);
      if (allChecked && isChecked) onToggleDelete(id);
      if (!allChecked && !isChecked) onToggleDelete(id);
    }
  }

  return (
    <aside className="w-full md:w-[520px] shrink-0 border-r border-border bg-card flex flex-col h-[calc(100vh-73px)]">
      <div className="p-3 space-y-2 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-muted">
            პაციენტი:{" "}
            <span className="text-foreground">{visiblePatients.length}</span>
            <span className="mx-2 text-border">·</span>
            შევსებული:{" "}
            <span className="text-foreground">{surveyedCount}</span>
          </h2>

          {showDelete && (
            <div className="ml-auto flex items-center gap-3">
              {deletablePatients.length > 0 && (
                <label
                  className="flex items-center gap-1.5 text-xs text-muted cursor-pointer"
                  title="მხოლოდ გამოუკითხავი პაციენტების მონიშვნა (შეფასებული არ წაიშლება)"
                >
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={toggleAllVisible}
                    className="rounded"
                  />
                  ყველას მონიშვნა ({deletablePatients.length})
                </label>
              )}
              <button
                type="button"
                disabled={busy || !selectedDeleteIds?.length}
                onClick={onDeleteSelected}
                className="text-[11px] text-fix hover:underline disabled:opacity-50"
              >
                წაშლა ({selectedDeleteIds?.length || 0})
              </button>
            </div>
          )}
        </div>

        <label className="block text-xs text-muted">
          თარიღი
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDateChange(prevDayISO(date))}
              className="shrink-0 w-10 h-10 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition flex items-center justify-center"
              title="წინა დღე"
              aria-label="წინა დღე"
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button
              type="button"
              onClick={() => onDateChange(nextDayISO(date))}
              disabled={canEditToday}
              className="shrink-0 w-10 h-10 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              title="შემდეგი დღე"
              aria-label="შემდეგი დღე"
            >
              ›
            </button>
          </div>
        </label>
        {!canEditToday && (
          <p className="text-[11px] text-muted">
            წინა დღე — მხოლოდ ნახვა. გამოკითხვა და სიის ცვლილება დღევანდელ თარიღზეა.
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ძებნა (სახელი, პ/ნ, ისტორია...)"
            className="flex-1 min-w-0 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          />

          {uniqueDepartments.length > 0 && (
            <label className="relative shrink-0">
              <span className="sr-only">განყოფილება</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="appearance-none rounded-xl border border-border bg-card pl-2.5 pr-7 py-2 text-xs text-muted outline-none focus:ring-2 focus:ring-primary/25 max-w-[140px] cursor-pointer"
                title="განყოფილება"
              >
                <option value="all">ყველა</option>
                {uniqueDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-[10px]"
              >
                ▾
              </span>
            </label>
          )}
        </div>

        {canManageRoster && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={busy || !canEditToday}
                onClick={onRefreshApi}
                className="rounded-lg bg-primary text-white text-xs py-1.5 px-2 hover:bg-primary-dark disabled:opacity-50"
              >
                პაციენტების განახლება
              </button>
              <button
                type="button"
                disabled={busy || !canEditToday}
                onClick={onAddPatient}
                className="rounded-lg border border-border text-xs py-1.5 px-2 hover:bg-accent disabled:opacity-50"
              >
                ახალი პაციენტი
              </button>
            </div>
            <label className="block">
              <span className="sr-only">Excel იმპორტი</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={busy || !canEditToday}
                className="block w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-primary file:font-medium disabled:opacity-50"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportExcel(f);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}
        {message && <p className="text-xs text-muted">{message}</p>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {visiblePatients.length === 0 ? (
          <p className="p-4 text-sm text-muted">ამ თარიღზე სია ცარიელია</p>
        ) : (
          <ul>
            {visiblePatients.map((p) => {
              const active = p.id === selectedId;
              const checked = selectedDeleteIds?.includes(p.id);
              const cannotDelete = showDelete && p.surveyedToday;
              return (
                <li key={p.id}>
                  <div className="flex items-stretch border-b border-border/70">
                    {showDelete && (
                      <label
                        className={`flex items-center px-2 ${cannotDelete ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/40"}`}
                        title={cannotDelete ? "შეფასებულია — სიიდან ამოღება არ შეიძლება" : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={!!checked}
                          disabled={cannotDelete}
                          onChange={() => onToggleDelete?.(p.id)}
                          className="rounded disabled:cursor-not-allowed"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      className={`flex-1 text-left px-3 py-3 transition ${
                        active ? "bg-accent" : "hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.fullName}</p>
                          <p className="text-xs text-muted truncate">
                            {p.departmentName || "განყოფილება უცნობია"}
                            {p.historyNumber ? ` · ${p.historyNumber}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                            !p.surveyedToday
                              ? "bg-border text-muted"
                              : p.todayAssessment === "ABSTAINED"
                                ? "bg-attention/10 text-attention"
                                : "bg-good/10 text-good"
                          }`}
                        >
                          {!p.surveyedToday
                            ? "გამოუკითხავი"
                            : p.todayAssessment === "ABSTAINED"
                              ? abstainReasonLabel(p.todayAbstainReason)
                              : p.todayAssessment
                                ? assessmentLabel(p.todayAssessment)
                                : "შევსებული"}
                        </span>
                      </div>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
