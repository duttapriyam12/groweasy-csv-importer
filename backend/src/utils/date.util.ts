/**
 * Deterministic date normalization — a safety net so date correctness never
 * depends solely on the AI's judgement call for ambiguous numeric formats
 * like "04-06-2026" (which could be read as either DD-MM-YYYY or
 * MM-DD-YYYY). This assumes DD-MM-YYYY (Indian convention) whenever the
 * format is genuinely ambiguous, and leaves unambiguous / already-ISO dates
 * untouched.
 *
 * Use this AFTER the AI returns created_at, as a corrective pass — not as a
 * replacement for the AI's semantic date extraction (it still needs the AI
 * to have found *a* date in the row in the first place).
 */

const PAD = (n: number) => String(n).padStart(2, "0");

/**
 * Attempts to normalize a created_at string to "YYYY-MM-DD HH:mm:ss".
 * Returns the original string unchanged if it doesn't match a known
 * ambiguous numeric pattern (e.g. it's already ISO, or unparseable — in
 * which case we trust the AI's output or leave it for downstream validation).
 */
export function normalizeCreatedAt(raw: string): string {
  if (!raw || typeof raw !== "string") return raw ?? "";

  const trimmed = raw.trim();

  // Already ISO-like: "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" — leave as-is.
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(trimmed)) {
    return trimmed.replace("T", " ");
  }

  // Matches D(D)-M(M)-YYYY or D(D)/M(M)/YYYY, optionally with a time part.
  const match = trimmed.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return trimmed; // Unknown format — don't touch it.

  let [, first, second, year, hour = "00", minute = "00", second_ = "00"] =
    match;

  let day = Number(first);
  let month = Number(second);

  // Disambiguation: if `first` > 12, it MUST be the day (DD-MM-YYYY),
  // confirming our default assumption. If `second` > 12, the input was
  // actually MM-DD-YYYY (day and month were swapped in the raw string), so
  // flip them. Otherwise (both <= 12, genuinely ambiguous), default to
  // DD-MM-YYYY per Indian convention — i.e. keep `first` as day.
  if (day > 12 && month <= 12) {
    // Already correct: first is day.
  } else if (month > 12 && day <= 12) {
    // Raw string was actually MM-DD-YYYY; swap.
    [day, month] = [month, day];
  }
  // else: ambiguous (both <= 12) -> default DD-MM-YYYY, no change needed.

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return trimmed; // Doesn't look like a valid date after all; bail safely.
  }

  return `${year}-${PAD(month)}-${PAD(day)} ${PAD(Number(hour))}:${PAD(
    Number(minute)
  )}:${PAD(Number(second_))}`;
}