/**
 * Onboarding age check (DEC-010): a neutral age screen for a 13+ audience.
 *
 * The player enters a birth month and year; nothing in the form reveals the threshold.
 * The decision is made here, on the server, and only its outcome is stored (policy id
 * and time). The month and year are never stored or logged.
 *
 * Conservative rule: without a day of birth, assume the latest possible birthday in
 * that month, so nobody is admitted before their 13th birthday.
 */

export const AGE_POLICY = { id: "13plus-v1", minimumAge: 13 } as const;

export type AgeCheckResult =
  { ok: true; eligible: true } | { ok: true; eligible: false } | { ok: false; reason: string };

export function checkAge(
  input: { birthYear: unknown; birthMonth: unknown },
  today: Date,
  minimumAge: number = AGE_POLICY.minimumAge,
): AgeCheckResult {
  const year = Number(input.birthYear);
  const month = Number(input.birthMonth);
  const thisYear = today.getUTCFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12)
    return { ok: false, reason: "Choose your birth month." };
  if (!Number.isInteger(year) || year < thisYear - 120 || year > thisYear)
    return { ok: false, reason: "Enter your birth year as four digits." };

  // Last day of the birth month (day 0 of the next month).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const birthdayPassed =
    today.getUTCMonth() + 1 > month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() >= lastDay);
  const age = thisYear - year - (birthdayPassed ? 0 : 1);
  if (age < 0) return { ok: false, reason: "Enter your birth year as four digits." };
  return age >= minimumAge ? { ok: true, eligible: true } : { ok: true, eligible: false };
}
