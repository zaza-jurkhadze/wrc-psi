"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

const links = [
  { href: "/", label: "გამოკითხვა" },
  { href: "/results", label: "შედეგები" },
  { href: "/forms", label: "კითხვარები" },
  { href: "/users", label: "მომხმარებლები" },
];

export function AppNav() {
  const pathname = usePathname();
  const { data } = useSession();
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState("");

  const role = data?.user?.role;
  const canSeeForms = role === "ADMIN" || role === "QUALITY_MANAGER";
  const canSeeUsers = role === "ADMIN";
  const canSendReports =
    role === "ADMIN" || role === "QUALITY_MANAGER" || role === "INTERVIEWER";

  const visibleLinks = links.filter((l) => {
    if (l.href === "/forms") return canSeeForms;
    if (l.href === "/users") return canSeeUsers;
    return true;
  });

  async function sendDailyReport() {
    const confirmed = window.confirm("გსურთ დღის ანგარიშის გაგზავნა?");
    if (!confirmed) return;
    setReportBusy(true);
    setReportMsg("");
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "გაგზავნა ვერ მოხერხდა");
      setReportMsg(
        payload.skipped
          ? `SMTP არაა მზად — რეზიუმე შენახულია`
          : `გაიგზავნა (${payload.total} გამოკითხული)`,
      );
    } catch (e) {
      setReportMsg(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 min-w-0 flex-1 justify-center xl:justify-start">
      {visibleLinks.map((l) => {
        const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              active
                ? "bg-white text-[#f58220]"
                : "text-white/95 hover:bg-white/15"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      {canSendReports && (
        <>
          <button
            type="button"
            disabled={reportBusy}
            onClick={sendDailyReport}
            className="px-2.5 py-1.5 rounded-lg text-sm font-medium border border-white/40 text-white hover:bg-white/15 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            title={reportMsg || undefined}
          >
            {reportBusy ? "იგზავნება…" : "დღის ანგარიშის გაგზავნა"}
          </button>
          {reportMsg && (
            <span className="text-[11px] text-white/90 truncate max-w-[180px]" title={reportMsg}>
              {reportMsg}
            </span>
          )}
        </>
      )}
    </nav>
  );
}
