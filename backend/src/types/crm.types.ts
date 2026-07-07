/**
 * Allowed enum values as per GrowEasy CRM assignment spec.
 * Keeping these as `as const` tuples gives us both a runtime array
 * (for validation) and a TypeScript union type (for compile-time safety).
 */
export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;
export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;
export type DataSource = (typeof DATA_SOURCE_VALUES)[number] | "";

/** A single row exactly as read from the uploaded CSV (raw, untyped). */
export type RawCsvRecord = Record<string, string>;

/** The normalized CRM lead shape the AI must produce for every valid row. */
export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus | "";
  crm_note: string;
  data_source: DataSource;
  possession_time: string;
  description: string;
}

/** A row the AI decided to skip, with the raw data + reason for transparency. */
export interface SkippedRecord {
  raw: RawCsvRecord;
  reason: string;
}

export interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
}
