"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type ScannerHandle = {
  stop: () => Promise<null>;
  clear: () => void;
  getState: () => number;
};

/** html5-qrcode: 2 = scanning */
const SCANNING_STATE = 2;

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
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const stopRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    let scanned = false;
    let scanner: ScannerHandle | null = null;
    let stopInFlight: Promise<void> | null = null;

    const safeStop = (): Promise<void> => {
      if (stopInFlight) return stopInFlight;

      stopInFlight = (async () => {
        const s = scanner;
        scanner = null;
        if (!s) return;

        try {
          if (s.getState() === SCANNING_STATE) {
            await s.stop();
          }
        } catch {
          /* already stopped */
        }
        try {
          s.clear();
        } catch {
          /* DOM may be gone */
        }
      })();

      return stopInFlight;
    };

    stopRef.current = safeStop;

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const instance = new Html5Qrcode(regionId, false);
        scanner = instance as unknown as ScannerHandle;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            if (scanned) return;
            scanned = true;
            void (async () => {
              await safeStop();
              if (cancelled) return;
              onScanRef.current(decoded);
              setMounted(false);
              onCloseRef.current();
            })();
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
      stopRef.current = null;
      void safeStop();
    };
  }, [mounted, regionId]);

  const requestClose = useCallback(() => {
    void (async () => {
      await stopRef.current?.();
      setMounted(false);
      onCloseRef.current();
    })();
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold">QR სკანერი</h3>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg border border-border px-2 py-1 text-sm hover:bg-accent"
          >
            დახურვა
          </button>
        </div>
        <div id={regionId} className="overflow-hidden rounded-xl min-h-[240px]" />
        {error && <p className="mt-3 text-sm text-fix">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          მიმართეთ კამერა სამაჯურის QR კოდს. ველები ავტომატურად შეივსება.
        </p>
      </div>
    </div>
  );
}
