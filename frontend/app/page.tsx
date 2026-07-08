"use client";

import { useRef, useState } from "react";
import CsvUpload from "@/components/CsvUpload";
import PreviewTable from "@/components/PreviewTable";
import ResultTable from "@/components/ResultTable";
import { startImport, pollJobStatus, ImportResult } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

type Step = "upload" | "preview" | "processing" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uploadPercent, setUploadPercent] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });

  const [processingPercent, setProcessingPercent] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    setStep("upload");
    setFile(null);
    setPreviewRows([]);
    setResult(null);
    setError(null);
    setUploadPercent(0);
    setBatchProgress({ completed: 0, total: 0 });
    setProcessingPercent(0);
  }

  function handleFileParsed(f: File, rows: Record<string, string>[]) {
    setError(null);
    setFile(f);
    setPreviewRows(rows);
    setStep("preview");
  }

  async function handleConfirm() {
    if (!file) return;
    setError(null);
    setStep("processing");
    setUploadPercent(0);
    setBatchProgress({ completed: 0, total: 0 });
    setProcessingPercent(0);

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProcessingPercent((p) => {
        if (p >= 92) return p;
        const step = p < 50 ? 4 : p < 80 ? 2 : 0.5;
        return Math.min(92, p + step);
      });
    }, 150);

    try {
      const { jobId, totalBatches } = await startImport(file, setUploadPercent);
      setBatchProgress({ completed: 0, total: totalBatches });

      const pollInterval = setInterval(async () => {
        try {
          const status = await pollJobStatus(jobId);
          setBatchProgress({
            completed: status.completedBatches,
            total: status.totalBatches,
          });

          if (status.status === "done" && status.result) {
            clearInterval(pollInterval);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            setProcessingPercent(100);
            setTimeout(() => {
              setResult(status.result);
              setStep("result");
            }, 400);
          } else if (status.status === "error") {
            clearInterval(pollInterval);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            setError(status.error || "Import failed.");
            setStep("preview");
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          setError(pollErr instanceof Error ? pollErr.message : "Failed to check progress.");
          setStep("preview");
        }
      }, 1200);
    } catch (err) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("preview");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-paper px-4 py-10 dark:bg-paper-dark sm:px-8">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            GrowEasy
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink dark:text-ink-dark sm:text-3xl">
            AI Lead Importer
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <StepIndicator step={step} />
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      {step === "upload" && (
        <section>
          <p className="mb-4 text-sm text-ink/60 dark:text-ink-dark/60">
            Upload a CSV in any layout — Facebook leads, Google Ads exports, a manually made
            spreadsheet — the AI will map it to your CRM fields.
          </p>
          <CsvUpload onFileParsed={handleFileParsed} onError={setError} />
        </section>
      )}

      {step === "preview" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink dark:text-ink-dark">{file?.name}</p>
              <p className="text-sm text-ink/50 dark:text-ink-dark/50">
                {previewRows.length} rows detected — raw preview, no AI applied yet
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 dark:border-ink-dark/15 dark:text-ink-dark/70 dark:hover:bg-white/5"
              >
                Choose different file
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-dark dark:hover:bg-accent-light"
              >
                Confirm &amp; Import with AI
              </button>
            </div>
          </div>
          <PreviewTable rows={previewRows} />
        </section>
      )}

      {step === "processing" && (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-ink/10 bg-white py-20 dark:border-ink-dark/10 dark:bg-surface-dark">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          <p className="font-display font-semibold text-ink dark:text-ink-dark">
            {uploadPercent < 100
              ? `Uploading… ${uploadPercent}%`
              : batchProgress.total > 0
                ? batchProgress.completed === 0
                  ? "Starting AI processing..."
                  : `Mapping with AI — Batch ${batchProgress.completed} of ${batchProgress.total}`
                : "Starting AI processing..."}
          </p>
          <p className="mt-1 text-sm text-ink/50 dark:text-ink-dark/50">
            This can take a few seconds for larger files, since rows are processed in batches.
          </p>

          <div className="mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out dark:bg-accent-light"
              style={{
                width: `${uploadPercent < 100 ? uploadPercent : processingPercent}%`,
              }}
            />
          </div>
        </section>
      )}

      {step === "result" && result && (
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-ink dark:text-ink-dark">Import complete</p>
            <button
              onClick={reset}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 dark:border-ink-dark/15 dark:text-ink-dark/70 dark:hover:bg-white/5"
            >
              Import another file
            </button>
          </div>
          <ResultTable result={result} />
        </section>
      )}
    </main>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "preview", label: "Preview" },
    { key: "processing", label: "Processing" },
    { key: "result", label: "Result" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="hidden items-center gap-2 sm:flex">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${i <= activeIndex
              ? "bg-accent text-white"
              : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-ink-dark/40"
              }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs ${i <= activeIndex ? "text-ink dark:text-ink-dark" : "text-ink/40 dark:text-ink-dark/40"
              }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="h-px w-6 bg-ink/10 dark:bg-white/10" />}
        </div>
      ))}
    </div>
  );
}