"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("ელფოსტა ან პაროლი არასწორია");
      return;
    }
    router.push(params.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[linear-gradient(160deg,#f4f8fa_0%,#e3eef3_50%,#f7fafb_100%)]">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Image
            src="/wrc-logo-mark.png"
            alt="WRC"
            width={72}
            height={72}
            className="h-16 w-16 object-contain"
            priority
          />
          <p className="text-xs text-foreground font-medium text-center leading-snug px-2">
            თანამედროვე სამედიცინო ტექნოლოგიების დასავლეთის რეგიონალური ცენტრი
          </p>
          <p className="text-sm text-muted text-center">
            პაციენტის მომსახურების ინდექსი
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
            <span className="text-sm text-muted">პაროლი</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 pr-11 outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground transition"
                aria-label={showPassword ? "დაფარვა პაროლი" : "პაროლის ჩვენება"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-13-8-13-8a19.7 19.7 0 0 1 5.06-6.06"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 13 8 13 8a19.65 19.65 0 0 1-2.45 3.56"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </label>
          {error && <p className="text-sm text-fix">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white py-3 font-medium transition disabled:opacity-60"
          >
            {loading ? "შესვლა..." : "შესვლა"}
          </button>
        </form>
      </div>
    </div>
  );
}
