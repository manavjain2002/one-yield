/**
 * Safe parsing for ERC20 human amounts: avoid parseFloat → parseUnits (float noise breaks ethers v6 parseUnits).
 */

function fractionDigits(s: string): number {
  const t = s.trim();
  const dot = t.indexOf('.');
  if (dot === -1) return 0;
  return t.length - dot - 1;
}

/** True if string is empty or a non-negative decimal integer string (optional single '.'). */
export function isPlainDecimalString(s: string): boolean {
  const t = s.trim();
  if (t === '') return true;
  if (t === '.') return false;
  return /^\d*\.?\d*$/.test(t);
}

export function isValidTokenDecimalInput(s: string, maxDecimals: number): boolean {
  if (!s.trim()) return true;
  if (!isPlainDecimalString(s)) return false;
  return fractionDigits(s) <= maxDecimals;
}

/** User-facing validation before parseUnits — prevents INVALID_ARGUMENT from too many fractional digits. */
export function getTokenDecimalInputError(
  amount: string,
  fee: string,
  maxDecimals: number
): string | null {
  if (!isValidTokenDecimalInput(amount, maxDecimals)) {
    return `Amount must have at most ${maxDecimals} decimal places for this token.`;
  }
  if (!isValidTokenDecimalInput(fee, maxDecimals)) {
    return `Fee must have at most ${maxDecimals} decimal places for this token.`;
  }
  return null;
}
