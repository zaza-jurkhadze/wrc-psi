"use client";

import { useEffect, useId, useRef, useState } from "react";

export function PatientQrScanner({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<{ stop: () => Promise<unknown>; clear: () => void } | null>(
    null,
  );
  const [error, setError] = useState("");
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setError("");
    let cancelled = false;

    void (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onScanRef.current(decoded);
            void scanner.stop().then(() => scanner.clear());
            onCloseRef.current();
          },
          () => {},
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "კამერის გახსნა ვერ მოხერხდა";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      void s
        .stop()
        .catch(() => {})
        .finally(() => {
          try {
            s.clear();
          } catch {
            /* ignore */
          }
        });
    };
  }, [open, regionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold">QR სკანერი</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2 py-1 text-sm hover:bg-accent"
          >
            დახურვა
          </button>
        </div>
        <div id={regionId} className="overflow-hidden rounded-xl" />
        {error && <p className="mt-3 text-sm text-fix">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          მიმართეთ კამერა სამაჯურის QR კოდს. ველები ავტომატურად შეივსება.
        </p>
      </div>
    </div>
  );
}
