"use client";

import { useState } from "react";
import { ImportResult, CRM_COLUMNS, CrmRecord, SkippedRecord } from "@/lib/api";

interface ResultTableProps {
  result: ImportResult;
}

const STATUS_STYLES: Record<string, string> = {
  GOOD_LEAD_FOLLOW_UP: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  DID_NOT_CONNECT: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  BAD_LEAD: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  SALE_DONE: "bg-accent/15 text-accent-dark dark:bg-accent/10 dark:text-accent-light",
};

function timestampSuffix() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
}


const TEXT_FIELDS_IMPORTED = new Set(["created_at", "mobile_without_country_code", "country_code"]);
const looksNumericOrDate = (key: string) =>
  /mobile|phone|contact|created|date|pincode|pin_code|zip|postal|code|_id|reference|order_no/i.test(key);

async function exportImportedXlsx(rows: CrmRecord[]): Promise<void> {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");

  const fields = CRM_COLUMNS.map((c) => c.key);
  const headerLabels = CRM_COLUMNS.map((c) => c.label);

  const aoa: any[][] = [headerLabels];
  rows.forEach((r) => {
    aoa.push(fields.map((f) => r[f] ?? ""));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);


  fields.forEach((f, colIndex) => {
    if (!TEXT_FIELDS_IMPORTED.has(f)) return;
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[cellRef];
      if (cell) cell.t = "s";
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Imported Leads");
  XLSX.writeFile(workbook, `groweasy_imported_leads_${timestampSuffix()}.xlsx`);
}

async function exportSkippedXlsx(rows: SkippedRecord[]): Promise<void> {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");


  const rawKeySet = new Set<string>();
  rows.forEach((s) => Object.keys(s.raw || {}).forEach((k) => rawKeySet.add(k)));
  const rawKeys = Array.from(rawKeySet);

  const headerLabels = ["#", "Reason", ...rawKeys];
  const aoa: any[][] = [headerLabels];
  rows.forEach((s, i) => {
    aoa.push([i + 1, s.reason, ...rawKeys.map((k) => s.raw?.[k] ?? "")]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);


  rawKeys.forEach((key, i) => {
    if (!looksNumericOrDate(key)) return;
    const colIndex = i + 2;
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[cellRef];
      if (cell) cell.t = "s";
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Skipped Leads");
  XLSX.writeFile(workbook, `groweasy_skipped_leads_${timestampSuffix()}.xlsx`);
}

export default function ResultTable({ result }: ResultTableProps) {
  const [tab, setTab] = useState<"imported" | "skipped">("imported");
  const [exporting, setExporting] = useState<"imported" | "skipped" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExportImported() {
    setExportError(null);
    setExporting("imported");
    try {
      await exportImportedXlsx(result.imported);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? `Could not export imported leads: ${err.message}`
          : "Could not export imported leads. Please try again."
      );
    } finally {
      setExporting(null);
    }
  }

  async function handleExportSkipped() {
    setExportError(null);
    setExporting("skipped");
    try {
      await exportSkippedXlsx(result.skipped);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? `Could not export skipped leads: ${err.message}`
          : "Could not export skipped leads. Please try again."
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Rows" value={result.totalImported + result.totalSkipped} />
        <StatCard label="Imported" value={result.totalImported} accent />
        <StatCard label="Skipped" value={result.totalSkipped} warn />
        <StatCard
          label="Success Rate"
          value={
            result.totalImported + result.totalSkipped > 0
              ? `${Math.round(
                (result.totalImported / (result.totalImported + result.totalSkipped)) * 100
              )}%`
              : "—"
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-ink/5 p-1 w-fit dark:bg-white/5">
          <button
            onClick={() => setTab("imported")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === "imported"
              ? "bg-white shadow-sm text-ink dark:bg-surface-dark dark:text-ink-dark"
              : "text-ink/50 hover:text-ink/80 dark:text-ink-dark/50 dark:hover:text-ink-dark/80"
              }`}
          >
            Imported ({result.totalImported})
          </button>
          <button
            onClick={() => setTab("skipped")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === "skipped"
              ? "bg-white shadow-sm text-ink dark:bg-surface-dark dark:text-ink-dark"
              : "text-ink/50 hover:text-ink/80 dark:text-ink-dark/50 dark:hover:text-ink-dark/80"
              }`}
          >
            Skipped ({result.totalSkipped})
          </button>
        </div>

        <div className="flex gap-2">
          <ExportButton
            label="Export Imported"
            disabled={result.totalImported === 0 || exporting !== null}
            loading={exporting === "imported"}
            onClick={handleExportImported}
          />
          <ExportButton
            label="Export Skipped"
            disabled={result.totalSkipped === 0 || exporting !== null}
            loading={exporting === "skipped"}
            onClick={handleExportSkipped}
          />
        </div>
      </div>

      {exportError && (
        <div className="mb-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-sm text-warn">
          {exportError}
        </div>
      )}

      {tab === "imported" ? (
        <div
          className="overflow-auto rounded-xl border border-ink/10 bg-white dark:border-ink-dark/10 dark:bg-surface-dark"
          style={{ maxHeight: 460 }}
        >
          <table className="w-full min-w-max border-collapse text-sm font-mono">
            <thead className="sticky top-0 z-10 bg-ink text-paper dark:bg-black/40 dark:text-ink-dark">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide">
                  #
                </th>
                {CRM_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.imported.map((rec, i) => (
                <tr
                  key={i}
                  className={
                    i % 2 === 0
                      ? "bg-white dark:bg-surface-dark"
                      : "bg-paper/60 dark:bg-white/[0.02]"
                  }
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink/40 dark:text-ink-dark/40">
                    {i + 1}
                  </td>
                  {CRM_COLUMNS.map((c) => {
                    const value = rec[c.key];
                    if (c.key === "crm_status" && value) {
                      return (
                        <td key={c.key} className="whitespace-nowrap px-4 py-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[value] || "bg-ink/10 text-ink/70 dark:bg-white/10 dark:text-ink-dark/70"
                              }`}
                          >
                            {value.replaceAll("_", " ")}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-ink/80 dark:text-ink-dark/80">
                        {value || <span className="text-ink/25 dark:text-ink-dark/25">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="overflow-auto rounded-xl border border-ink/10 bg-white dark:border-ink-dark/10 dark:bg-surface-dark"
          style={{ maxHeight: 460 }}
        >
          {result.skipped.length === 0 ? (
            <p className="p-6 text-sm text-ink/50 dark:text-ink-dark/50">
              No rows were skipped. Everything imported cleanly.
            </p>
          ) : (
            <table className="w-full min-w-max border-collapse text-sm font-mono">
              <thead className="sticky top-0 z-10 bg-ink text-paper dark:bg-black/40 dark:text-ink-dark">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide">
                    #
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide">
                    Reason
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide">
                    Raw Row (preview)
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((s, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-surface-dark"
                        : "bg-paper/60 dark:bg-white/[0.02]"
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink/40 dark:text-ink-dark/40">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 text-warn">{s.reason}</td>
                    <td className="max-w-md truncate px-4 py-2.5 text-ink/60 dark:text-ink-dark/60">
                      {JSON.stringify(s.raw)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors
        ${disabled
          ? "cursor-not-allowed border-ink/10 text-ink/30 dark:border-ink-dark/10 dark:text-ink-dark/30"
          : "border-ink/15 text-ink/70 hover:bg-ink/5 dark:border-ink-dark/15 dark:text-ink-dark/70 dark:hover:bg-white/5"
        }`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12M12 15l-4-4M12 15l4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 17v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {loading ? "Exporting…" : label}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 dark:border-ink-dark/10 dark:bg-surface-dark">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/40 dark:text-ink-dark/40">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${accent
          ? "text-accent dark:text-accent-light"
          : warn
            ? "text-warn"
            : "text-ink dark:text-ink-dark"
          }`}
      >
        {value}
      </p>
    </div>
  );
}