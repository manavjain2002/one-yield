/**
 * Borrower dashboard debt from `borrower_pools` rows only:
 * max(0, Σ fundsDeployed − Σ fundsRepaid) per pool (6-decimal wei strings), then nominal ÷ 1e6.
 */

export type BorrowerPoolRowForDebt = {
  fundsDeployed?: string;
  fundsRepaid?: string;
};

function sumWei(rows: BorrowerPoolRowForDebt[], key: 'fundsDeployed' | 'fundsRepaid'): bigint {
  let s = 0n;
  for (const r of rows) {
    const raw = r[key] ?? '0';
    try {
      s += BigInt(raw);
    } catch {
      /* skip bad row */
    }
  }
  return s;
}

/** Outstanding principal in pool token nominal units (e.g. USDC). */
export function outstandingPrincipalNominalFromBorrowerPoolRows(
  rows: BorrowerPoolRowForDebt[] | undefined,
): number {
  const list = rows ?? [];
  if (list.length === 0) return 0;
  const deployed = sumWei(list, 'fundsDeployed');
  const repaid = sumWei(list, 'fundsRepaid');
  const out = deployed - repaid;
  if (out <= 0n) return 0;
  return Number(out) / 1e6;
}

/** Same convention as BorrowerDashboard: principal × (APR% / 200). */
export function estimatedCouponNominalFromPrincipal(principalNominal: number, apyPercent: number): number {
  return principalNominal * apyPercent / 200;
}

export function estimatedTotalDebtNominalFromBorrowerPoolRows(
  rows: BorrowerPoolRowForDebt[] | undefined,
  apyPercent: number,
): number {
  const p = outstandingPrincipalNominalFromBorrowerPoolRows(rows);
  return p + estimatedCouponNominalFromPrincipal(p, apyPercent);
}
