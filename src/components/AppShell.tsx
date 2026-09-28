"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";

const CLINIC_NAME =
  "თანამედროვე სამედიცინო ტექნოლოგიების დასავლეთის რეგიონალური ცენტრი";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">იტვირთება...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#e07018]/40 bg-[#f58220] shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 py-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 cursor-pointer rounded-xl bg-white p-1.5 shadow-sm hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              title="განახლება"
              aria-label="გვერდის განახლება"
            >
              <Image
                src="/wrc-logo-mark.png"
                alt="WRC"
                width={48}
                height={48}
                className="h-9 w-9 object-contain pointer-events-none"
                priority
              />
            </button>
            <p className="hidden xl:block text-[11px] leading-snug text-white font-medium max-w-[220px] drop-shadow-sm">
              {CLINIC_NAME}
            </p>
          </div>
          <AppNav />
          <div className="flex items-center gap-3 text-sm shrink-0 ml-auto">
            <span className="text-white/90 truncate max-w-[140px]">
              {data?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-white hover:bg-white/25 cursor-pointer"
            >
              გამოსვლა
            </button>
          </div>
        </div>
        <p className="xl:hidden px-4 pb-2 text-[10px] leading-snug text-white/90">
          {CLINIC_NAME}
        </p>
      </header>
      <main className="flex-1 max-w-[1600px] w-full mx-auto min-h-0">{children}</main>
    </div>
  );
}
