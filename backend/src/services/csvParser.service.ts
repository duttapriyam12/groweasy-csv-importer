import { parse } from "csv-parse/sync";
import { RawCsvRecord } from "../types/crm.types";

/**
 * Parses raw CSV buffer/text into an array of row objects keyed by header.
 * We deliberately do NOT assume fixed column names here — whatever headers
 * exist in the file become the object keys. The AI layer figures out mapping.
 */
export function parseCsv(fileContent: string): RawCsvRecord[] {
  if (!fileContent || !fileContent.trim()) {
    throw new Error("Uploaded CSV file is empty.");
  }

  let records: RawCsvRecord[];
  try {
    records = parse(fileContent, {
      columns: (header: string[]) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // messy real-world CSVs often have ragged rows
      bom: true,
    });
  } catch (err) {
    throw new Error(
      `Failed to parse CSV. Please make sure it is a valid CSV file. (${
        (err as Error).message
      })`
    );
  }

  if (records.length === 0) {
    throw new Error("CSV has headers but no data rows.");
  }

  return records;
}
