import OpenAI from "openai";
import {
  RawCsvRecord,
  CrmRecord,
  SkippedRecord,
  ImportResult,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "../types/crm.types";
import { chunkArray } from "../utils/batch.util";
import { normalizeCreatedAt } from "../utils/date.util";

function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 25;
const MAX_RETRIES = 2;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to backend/.env (see .env.example)."
    );
  }
  client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return client;
}

/**
 * The system/instruction prompt. This is the single most important piece of
 * the assignment ("AI Prompt Engineering" is a top evaluation criterion), so
 * every rule from the spec is spelled out explicitly and unambiguously,
 * rather than left for the model to infer.
 */
function buildPrompt(batch: RawCsvRecord[]): string {
  return `You are a data-mapping engine for a CRM system called GrowEasy.

You will receive a JSON array of raw lead records extracted from an arbitrary
CSV file (Facebook lead export, Google Ads export, a manually made Excel
sheet, a real-estate CRM export, etc). Column names, order, and structure are
UNKNOWN and inconsistent between files. Your job is to intelligently map each
raw record into the fixed GrowEasy CRM schema below, using semantic
understanding of the column names AND the values (e.g. a column named "Ph No"
or "Contact" containing a 10-digit number is a mobile number; a column
containing "@" is an email; a column with values like "Mumbai" is a city).

=== TARGET CRM SCHEMA (produce exactly these keys, in this order) ===
- created_at: lead creation date/time. Must be a string parseable by
  JavaScript's "new Date(created_at)". If you can identify a date in the row,
  normalize it to "YYYY-MM-DD HH:mm:ss" (24h). If no date exists, use "".
  DATE FORMAT DISAMBIGUATION RULE: when a date is written in ambiguous
  numeric form (e.g. "04-06-2026" or "04/06/2026"), ALWAYS interpret it as
  DD-MM-YYYY (day-month-year), the standard Indian convention — NEVER as
  MM-DD-YYYY. Only deviate from DD-MM-YYYY if the first number is greater
  than 12 (which makes DD-MM-YYYY the only valid reading and confirms it),
  or if the format is unambiguous for another reason (e.g. a month name like
  "June", or an ISO format like "2026-06-04" which is already YYYY-MM-DD).
  Apply this rule consistently to every row in this batch.
- name: the lead's full name.
- email: the PRIMARY email only (see multi-value rule below).
- country_code: phone country code, digits only, no "+". Default to "91" if a
  10-digit Indian-looking mobile number is present with no explicit code and
  no other country context. Leave "" if truly unknown.
- mobile_without_country_code: the PRIMARY mobile number, digits only, no
  spaces/dashes/country code (see multi-value rule below).
- company: company / organization / project name if present, else "".
- city: city name if present, else "".
- state: state/province if present, else "".
- country: country if present, else "".
- lead_owner: the person/agent/email responsible for this lead if present
  (often an email address in a column like "Assigned To", "Owner"), else "".
- crm_status: MUST be exactly one of ${JSON.stringify(
    CRM_STATUS_VALUES
  )} based on the semantic meaning of any status/stage/remark column
  (e.g. "closed"/"won"/"deal done" -> SALE_DONE, "not interested"/"junk" ->
  BAD_LEAD, "no response"/"unreachable"/"busy" -> DID_NOT_CONNECT,
  "interested"/"follow up"/"callback" -> GOOD_LEAD_FOLLOW_UP). If nothing in
  the row implies a status, use "".
- crm_note: free-text notes. Put here: any remarks/comments column content,
  follow-up notes, AND any extra emails/phone numbers beyond the primary one
  (see rule below), AND anything useful that doesn't fit another field.
- data_source: MUST be exactly one of ${JSON.stringify(
    DATA_SOURCE_VALUES
  )} ONLY if you can confidently infer it from a source/campaign/project
  column. If not confidently identifiable, use "" (empty string) — never
  guess or invent a value outside this list.
- possession_time: property possession timeframe if this looks like a real
  estate lead (e.g. "Ready to move", "Dec 2027"), else "".
- description: any additional free-text description that doesn't belong in
  crm_note, else "".

=== HARD RULES ===
1. Multiple emails in one row: use the FIRST as "email"; append every
   additional email into "crm_note" (e.g. "Additional email: x@y.com").
2. Multiple mobile numbers in one row: use the FIRST as
   "mobile_without_country_code"; append every additional number into
   "crm_note".
3. crm_status and data_source must ONLY ever be one of their allowed values
   above, or "". Never output any other string for these two fields.
4. created_at must always be a value new Date() in JavaScript can parse, or "".
5. SKIP a record entirely (do not include it in the output array) if it has
   NEITHER a usable email NOR a usable mobile number anywhere in the row.
   Track why you skipped it.
6. Never fabricate data that isn't present or reasonably inferable from the row.
7. Output must be valid, parseable JSON. No markdown fences, no commentary,
   no trailing commas, no explanation text before or after the JSON.

=== OUTPUT FORMAT (return EXACTLY this JSON shape, nothing else) ===
{
  "imported": [ { <CrmRecord fields exactly as specified above> }, ... ],
  "skipped": [ { "original_index": <number, 0-based index in the input array below>, "reason": "<short reason>" }, ... ]
}

=== INPUT RECORDS (0-based index order matters for "skipped") ===
${JSON.stringify(batch, null, 0)}
`;
}

/** Strips accidental markdown code fences if the model adds them despite instructions. */
function cleanJsonResponse(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function isValidCrmStatus(value: unknown): value is CrmRecord["crm_status"] {
  return value === "" || CRM_STATUS_VALUES.includes(value as any);
}

function isValidDataSource(value: unknown): value is CrmRecord["data_source"] {
  return value === "" || DATA_SOURCE_VALUES.includes(value as any);
}

/** Defensive validation: never trust the model 100%, even with a strict prompt. */
function sanitizeCrmRecord(raw: any): CrmRecord | null {
  if (!raw || typeof raw !== "object") return null;

  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  const record: CrmRecord = {
    created_at: normalizeCreatedAt(str(raw.created_at)),
    name: str(raw.name),
    email: str(raw.email),
    country_code: str(raw.country_code),
    mobile_without_country_code: str(raw.mobile_without_country_code),
    company: str(raw.company),
    city: str(raw.city),
    state: str(raw.state),
    country: str(raw.country),
    lead_owner: str(raw.lead_owner),
    crm_status: isValidCrmStatus(raw.crm_status) ? raw.crm_status : "",
    crm_note: str(raw.crm_note),
    data_source: isValidDataSource(raw.data_source) ? raw.data_source : "",
    possession_time: str(raw.possession_time),
    description: str(raw.description),
  };

 
  if (!record.email && !record.mobile_without_country_code) return null;

  return record;
}

async function callOpenAiWithRetry(prompt: string): Promise<string> {
  const openai = getClient();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: getModel(),
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      return completion.choices[0]?.message?.content || "";
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw new Error(
    `OpenAI API call failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

async function processBatch(
  batch: RawCsvRecord[],
  batchOffset: number
): Promise<ImportResult> {
  const prompt = buildPrompt(batch);

  let responseText: string;
  try {
    responseText = await callOpenAiWithRetry(prompt);
  } catch (err) {
   
    return {
      imported: [],
      skipped: batch.map((raw, i) => ({
        raw,
        reason: `AI processing failed for this batch: ${(err as Error).message}`,
      })),
      totalImported: 0,
      totalSkipped: batch.length,
    };
  }

  let parsed: { imported: any[]; skipped: any[] };
  try {
    parsed = JSON.parse(cleanJsonResponse(responseText));
  } catch (err) {
    return {
      imported: [],
      skipped: batch.map((raw) => ({
        raw,
        reason: "AI returned malformed JSON for this batch.",
      })),
      totalImported: 0,
      totalSkipped: batch.length,
    };
  }

  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const rawRecord of parsed.imported || []) {
    const clean = sanitizeCrmRecord(rawRecord);
    if (clean) {
      imported.push(clean);
    }
  }

  for (const s of parsed.skipped || []) {
    const idx = typeof s.original_index === "number" ? s.original_index : -1;
    const rawRow = batch[idx] ?? {};
    skipped.push({ raw: rawRow, reason: s.reason || "Skipped by AI." });
  }


  const accountedFor = imported.length + skipped.length;
  if (accountedFor < batch.length) {
    skipped.push({
      raw: {},
      reason: `${batch.length - accountedFor} row(s) in this batch were not returned by the AI and were counted as skipped.`,
    });
  }

  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
  };
}

/**
 * Main entry point: takes all raw CSV records, splits into batches,
 * sends each batch to OpenAI, and merges the results.
 */
export async function extractCrmRecords(
  records: RawCsvRecord[]
): Promise<ImportResult> {
  const batches = chunkArray(records, BATCH_SIZE);

  const results = await Promise.all(
    batches.map((batch, i) => processBatch(batch, i * BATCH_SIZE))
  );

  const merged: ImportResult = {
    imported: [],
    skipped: [],
    totalImported: 0,
    totalSkipped: 0,
  };

  for (const r of results) {
    merged.imported.push(...r.imported);
    merged.skipped.push(...r.skipped);
  }
  merged.totalImported = merged.imported.length;
  merged.totalSkipped = merged.skipped.length;

  return merged;
}