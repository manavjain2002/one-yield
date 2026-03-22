import type { ApiPool } from '@/lib/pool-mapper';
import { mapApiPoolToUi } from '@/lib/pool-mapper';
import type { Pool } from '@/data/mockData';

export type BorrowerDashboardSummaryDto = {
  outstandingPrincipalNominal: number;
  outstandingCouponNominal: number;
  totalDebtNominal: number;
  activePoolCount: number;
};

export type BorrowerActivePoolApiRow = ApiPool & {
  outstandingPrincipalNominal: number;
  outstandingCouponNominal: number;
  totalOutstandingNominal: number;
  totalDeployedNominal: number;
  totalRepaidNominal: number;
};

export type BorrowerMyPoolApiRow = ApiPool & {
  debtOwedPrincipalNominal: number;
  couponAmountNominal: number;
  principalRepaidNominal: number;
};

export type BorrowerDashboardActivePoolUi = {
  pool: Pool;
  outstandingPrincipalNominal: number;
  outstandingCouponNominal: number;
  totalOutstandingNominal: number;
  totalDeployedNominal: number;
  totalRepaidNominal: number;
};

/** Map GET /borrower/dashboard/active-pools row to UI pool + server metrics. */
export function mapBorrowerActivePoolRowToUi(row: BorrowerActivePoolApiRow): BorrowerDashboardActivePoolUi {
  const {
    outstandingPrincipalNominal,
    outstandingCouponNominal,
    totalOutstandingNominal,
    totalDeployedNominal,
    totalRepaidNominal,
    ...apiRest
  } = row;
  return {
    pool: mapApiPoolToUi(apiRest as ApiPool),
    outstandingPrincipalNominal,
    outstandingCouponNominal,
    totalOutstandingNominal,
    totalDeployedNominal,
    totalRepaidNominal,
  };
}

export type BorrowerMyPoolUi = {
  pool: Pool;
  debtOwedPrincipalNominal: number;
  couponAmountNominal: number;
  principalRepaidNominal: number;
};

/** Map GET /borrower/pools row (requirement 8) to UI pool + page metrics. */
export function mapBorrowerMyPoolRowToUi(row: BorrowerMyPoolApiRow): BorrowerMyPoolUi {
  const { debtOwedPrincipalNominal, couponAmountNominal, principalRepaidNominal, ...apiRest } = row;
  return {
    pool: mapApiPoolToUi(apiRest as ApiPool),
    debtOwedPrincipalNominal,
    couponAmountNominal,
    principalRepaidNominal,
  };
}
