interface PreviewTableProps {
  rows: Record<string, string>[];
  maxHeight?: string;
}

export default function PreviewTable({ rows, maxHeight = "420px" }: PreviewTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-ink/10 bg-white p-6 text-sm text-ink/50">
        No rows found in this file.
      </p>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div
      className="overflow-auto rounded-xl border border-ink/10 bg-white"
      style={{ maxHeight }}
    >
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-ink text-paper">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide">
              #
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wide"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-paper/60"}
            >
              <td className="whitespace-nowrap px-4 py-2.5 text-ink/40">{i + 1}</td>
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-4 py-2.5 text-ink/80">
                  {row[col] || <span className="text-ink/25">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
