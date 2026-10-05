"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type ScannerHandle = {
  stop: () => Promise<null>;
  clear: () => void;
  getState: () => number;
};

/** html5-qrcode: 2 = scanning */
const SCANNING_STATE = 2;

function qrScanBoxSize(viewfinderWidth: number, viewfinderHeight: number) {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const size = Math.floor(minEdge * 0.85);
  return { width: size, height: size };
}

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280, min: 640 },
  height: { ideal: 720, min: 480 },
};

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
    if (open) {
      setError("");
      setMounted(true);
    } else {
      setMounted(false);
    }
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

        const instance = new Html5Qrcode(regionId, {
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scanner = instance as unknown as ScannerHandle;

        await instance.start(
          CAMERA_CONSTRAINTS,
          {
            fps: 18,
            qrbox: qrScanBoxSize,
            videoConstraints: CAMERA_CONSTRAINTS,
            disableFlip: false,
          },
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
    <div className="fixed inset-0 z-[60] flex flex-col bg-black sm:items-center sm:justify-center sm:bg-black/60 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col bg-card sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:flex-none sm:rounded-2xl sm:border sm:border-border sm:shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:border-0 sm:pb-0">
          <h3 className="text-base font-semibold text-foreground">QR სკანერი</h3>
          <button
            type="button"
            onClick={requestClose}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            დახურვა
          </button>
        </div>
        <div
          id={regionId}
          className="min-h-0 w-full flex-1 overflow-hidden bg-black sm:mx-4 sm:mt-3 sm:min-h-[280px] sm:flex-none sm:rounded-xl"
        />
        <div className="shrink-0 space-y-2 px-4 py-3 text-xs text-muted">
          {error && <p className="text-sm text-fix">{error}</p>}
          <p>
            მიმართეთ კამერა სამაჯურის QR კოდს. Chrome-ით გახსენით — in-app
            ბრაუზერში კამერა ხშირად ცუდად მუშაობს.
          </p>
          <p className="text-[11px] opacity-80">
            ველები წარმატებული სкан-ის შემდეგ ავტომატურად შეივსება.
          </p>
        </div>
      </div>
    </div>
  );
}
