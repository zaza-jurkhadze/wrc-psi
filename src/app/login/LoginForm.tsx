"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("z.jurkhadze@gmail.com");
  const [password, setPassword] = useState("");
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
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
