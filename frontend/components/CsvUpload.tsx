"use client";

import { useCallback, useRef, useState } from "react";

interface CsvUploadProps {
  onFileParsed: (file: File, rows: Record<string, string>[]) => void;
  onError: (message: string) => void;
}

export default function CsvUpload({ onFileParsed, onError }: CsvUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        onError("Please upload a valid .csv file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onError("File is too large. Max size is 5MB.");
        return;
      }

      setIsParsing(true);
      try {
        // Dynamic import keeps papaparse out of the initial bundle.
        const Papa = (await import("papaparse")).default;
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setIsParsing(false);
            if (results.errors?.length) {
              onError(
                `CSV parsing warning: ${results.errors[0].message}. Showing what could be read.`
              );
            }
            onFileParsed(file, results.data);
          },
          error: (err: Error) => {
            setIsParsing(false);
            onError(`Could not read this CSV: ${err.message}`);
          },
        });
      } catch (err) {
        setIsParsing(false);
        onError("Something went wrong while reading the file.");
      }
    },
    [onFileParsed, onError]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors
        ${isDragging ? "border-accent bg-accent/5" : "border-ink/15 hover:border-accent/60 hover:bg-accent/[0.03]"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-hover:scale-105">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="font-display text-lg font-semibold text-ink">
        {isParsing ? "Reading your file…" : "Drop your CSV file here"}
      </p>
      <p className="mt-1 text-sm text-ink/50">or click to browse — any lead export format works</p>
      <p className="mt-4 text-xs text-ink/40">Supported: .csv · Max 5MB</p>
    </div>
  );
}
