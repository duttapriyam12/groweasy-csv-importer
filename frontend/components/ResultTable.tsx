"use client";

import { useState } from "react";
import { ImportResult, CRM_COLUMNS } from "@/lib/api";

interface ResultTableProps {
  result: ImportResult;
}

const STATUS_STYLES: Record<string, string> = {
  GOOD_LEAD_FOLLOW_UP: "bg-emerald-100 text-emerald-700",
  DID_NOT_CONNECT: "bg-amber-100 text-amber-700",
  BAD_LEAD: "bg-red-100 text-red-700",
  SALE_DONE: "bg-accent/15 text-accent-dark",
};

export default function ResultTable({ result }: ResultTableProps) {
  const [tab, setTab] = useState<"imported" | "skipped">("imported");

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

      <div className="mb-4 flex gap-1 rounded-lg bg-ink/5 p-1 w-fit">
        <button
          onClick={() => setTab("imported")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "imported" ? "bg-white shadow-sm text-ink" : "text-ink/50 hover:text-ink/80"
          }`}
        >
          Imported ({result.totalImported})
        </button>
        <button
          onClick={() => setTab("skipped")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "skipped" ? "bg-white shadow-sm text-ink" : "text-ink/50 hover:text-ink/80"
          }`}
        >
          Skipped ({result.totalSkipped})
        </button>
      </div>

      {tab === "imported" ? (
        <div className="overflow-auto rounded-xl border border-ink/10 bg-white" style={{ maxHeight: 460 }}>
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-ink text-paper">
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
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-paper/60"}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink/40">{i + 1}</td>
                  {CRM_COLUMNS.map((c) => {
                    const value = rec[c.key];
                    if (c.key === "crm_status" && value) {
                      return (
                        <td key={c.key} className="whitespace-nowrap px-4 py-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              STATUS_STYLES[value] || "bg-ink/10 text-ink/70"
                            }`}
                          >
                            {value.replaceAll("_", " ")}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-ink/80">
                        {value || <span className="text-ink/25">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-ink/10 bg-white" style={{ maxHeight: 460 }}>
          {result.skipped.length === 0 ? (
            <p className="p-6 text-sm text-ink/50">No rows were skipped. Everything imported cleanly.</p>
          ) : (
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-ink text-paper">
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
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-paper/60"}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink/40">{i + 1}</td>
                    <td className="px-4 py-2.5 text-warn">{s.reason}</td>
                    <td className="max-w-md truncate px-4 py-2.5 text-ink/60">
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
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          accent ? "text-accent" : warn ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
