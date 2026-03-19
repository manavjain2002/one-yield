import type { Pool } from '@/data/mockData';
import { MOCK_USDC_ADDRESS } from '@/lib/chain-constants';

/** API pool row from Nest (enriched) */
export type ApiPool = {
  id: string;
  contractAddress: string;
  fundManagerAddress: string;
  name: string;
  symbol: string;
  status: string;
  poolTokenAddress: string;
  apyBasisPoints: number;
  poolSize: string;
  assetUnderManagement: string;
  borrowerAddress: string;
  feeCollectorAddress: string;
  createdAt?: string;
  totalDeposited?: string;
  borrowerPools?: Array<{
    v1PoolId: string;
    allocationBps: number;
    dedicatedWalletAddress: string;
    fundsDeployed?: string;
    fundsRepaid?: string;
  }>;
};

function num(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Map backend pool to UI `Pool` shape (amounts in same nominal units as mock for display). */
export function mapApiPoolToUi(p: ApiPool): Pool {
  const requested = num(p.poolSize);
  const received = num(p.totalDeposited);
  const aum = num(p.assetUnderManagement);
  const allocations = (p.borrowerPools ?? []).map((b) => ({
    wallet: b.dedicatedWalletAddress,
    percentage: b.allocationBps / 100,
    fundsAssigned: received * (b.allocationBps / 10_000),
  }));
  const statusMap: Record<string, Pool['status']> = {
    pending: 'active',
    active: 'active',
    paused: 'paused',
    closed: 'closed',
  };
  return {
    id: p.id,
    name: p.name,
    symbol: p.symbol,
    borrower: p.borrowerAddress || '',
    totalRequested: requested || 1,
    totalReceived: received,
    totalRepaid: aum > received ? aum - received : 0,
    apy: (p.apyBasisPoints ?? 0) / 100,
    status: statusMap[p.status] ?? 'active',
    riskLevel: 'medium',
    acceptedTokens: (() => {
      const addr = p.poolTokenAddress?.trim();
      if (!addr) return ['USDC'];
      if (addr.toLowerCase() === MOCK_USDC_ADDRESS.toLowerCase()) return ['USDC (mock)'];
      if (/^0x[a-fA-F0-9]{40}$/i.test(addr)) return [`0x${addr.slice(2, 6)}...${addr.slice(-4)}`];
      return [addr];
    })(),
    createdAt: p.createdAt ?? new Date().toISOString(),
    txHash: p.contractAddress,
    allocations,
  };
}
