"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "გამოკითხვა" },
  { href: "/results", label: "შედეგები" },
  { href: "/forms", label: "კითხვარები" },
  { href: "/users", label: "მომხმარებლები" },
];

function useNavAccess() {
  const { data } = useSession();
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

  return { visibleLinks, canSendReports };
}

function useDailyReport() {
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState("");

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

  return { reportBusy, reportMsg, sendDailyReport };
}

function linkClass(active: boolean, mobile?: boolean) {
  if (mobile) {
    return `block w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition ${
      active
        ? "bg-white text-[#f58220]"
        : "text-white/95 hover:bg-white/15"
    }`;
  }
  return `px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
    active
      ? "bg-white text-[#f58220]"
      : "text-white/95 hover:bg-white/15"
  }`;
}

function NavLinks({
  onNavigate,
  vertical,
}: {
  onNavigate?: () => void;
  vertical?: boolean;
}) {
  const pathname = usePathname();
  const { visibleLinks, canSendReports } = useNavAccess();
  const { reportBusy, reportMsg, sendDailyReport } = useDailyReport();

  return (
    <>
      {visibleLinks.map((l) => {
        const active =
          pathname === l.href ||
          (l.href !== "/" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className={linkClass(active, vertical)}
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
            onClick={() => {
              void sendDailyReport();
            }}
            className={
              vertical
                ? "w-full text-left px-4 py-3 text-sm font-medium rounded-lg border border-white/40 text-white hover:bg-white/15 disabled:opacity-50"
                : "px-2.5 py-1.5 rounded-lg text-sm font-medium border border-white/40 text-white hover:bg-white/15 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            }
            title={reportMsg || undefined}
          >
            {reportBusy ? "იგზავნება…" : "დღის ანგარიშის გაგზავნა"}
          </button>
          {reportMsg && !vertical && (
            <span
              className="text-[11px] text-white/90 truncate max-w-[180px]"
              title={reportMsg}
            >
              {reportMsg}
            </span>
          )}
        </>
      )}
      {reportMsg && vertical && (
        <p className="px-4 py-1 text-[11px] text-white/90">{reportMsg}</p>
      )}
    </>
  );
}

/** Desktop / tablet landscape — horizontal nav in header row */
export function AppNavDesktop() {
  return (
    <nav className="hidden xl:flex flex-wrap items-center gap-1 min-w-0 flex-1 justify-start">
      <NavLinks />
    </nav>
  );
}

/** Mobile — hamburger trigger + dropdown panel */
export function AppNavMobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-white/40 bg-white/15 p-2 text-white hover:bg-white/25 cursor-pointer"
        aria-expanded={open}
        aria-label={open ? "მენიუს დახურვა" : "მენიუ"}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          {open ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="მენიუს დახურვა"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-1.5rem,280px)] rounded-xl border border-white/30 bg-[#e07018] shadow-lg py-2 flex flex-col gap-0.5">
            <NavLinks vertical onNavigate={() => setOpen(false)} />
          </nav>
        </>
      )}
    </div>
  );
}

/** @deprecated use AppNavDesktop — kept for any external import */
export function AppNav() {
  return <AppNavDesktop />;
}
