import type { Pool } from '@/data/mockData';
import { POOL_TOKEN_ADDRESS } from '@/lib/chain-constants';

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
  totalWithdrawn?: string;
  totalDeployed?: string;
  totalRepaid?: string;
  lpTokenAddress?: string;
  lpTokenName?: string;
  draftId?: string;
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
  const requested = num(p.poolSize) / 1e6;
  const deposited = num(p.totalDeposited) / 1e6;
  const withdrawn = num(p.totalWithdrawn) / 1e6;
  const deployed = num(p.totalDeployed) / 1e6;
  const repaid = num(p.totalRepaid) / 1e6;

  const borrowerPools = p.borrowerPools ?? [];
  const allocations = borrowerPools.map((b) => ({
    wallet: b.dedicatedWalletAddress,
    percentage: b.allocationBps / 100,
    fundsAssigned: deployed * (b.allocationBps / 10_000),
  }));

  const statusMap: Record<string, Pool['status']> = {
    pending: 'pending',
    active: 'active',
    paused: 'paused',
    closed: 'closed',
  };

  return {
    id: p.id,
    contractAddress: p.contractAddress || '',
    fundManagerAddress: p.fundManagerAddress || '',
    name: p.name,
    symbol: p.symbol,
    borrowerAddress: p.borrowerAddress || '',
    totalRequested: requested || 1,
    totalReceived: deposited,
    totalWithdrawn: withdrawn,
    totalFunded: deployed,
    totalRepaid: repaid,
    apyBasisPoints: p.apyBasisPoints || 0,
    apy: (p.apyBasisPoints ?? 0) / 100,
    poolSize: p.poolSize ?? '0',
    totalDeposited: p.totalDeposited ?? '0',
    assetUnderManagement: p.assetUnderManagement ?? '0',
    status: statusMap[p.status] ?? 'active',
    riskLevel: 'medium',
    acceptedTokens: (() => {
      const addr = p.poolTokenAddress?.trim();
      if (!addr) return ['USDC'];
      if (addr.toLowerCase() === POOL_TOKEN_ADDRESS.toLowerCase()) return ['USDC (mock)'];
      if (/^0x[a-fA-F0-9]{40}$/i.test(addr)) return [`0x${addr.slice(2, 6)}...${addr.slice(-4)}`];
      return [addr];
    })(),
    createdAt: p.createdAt ?? new Date().toISOString(),
    txHash: p.contractAddress,
    poolTokenAddress: p.poolTokenAddress || '',
    poolTokenName: 'USDC',
    lpTokenAddress: p.lpTokenAddress || '',
    lpTokenName: p.lpTokenName || `${p.symbol} LP`,
    draftId: p.draftId || '',
    allocations,
    borrowerPools: borrowerPools.map((b) => ({
      v1PoolId: b.v1PoolId,
      dedicatedWalletAddress: b.dedicatedWalletAddress,
      allocationBps: b.allocationBps ?? 0,
      fundsDeployed: b.fundsDeployed ?? '0',
      fundsRepaid: b.fundsRepaid ?? '0',
    })),
  };
}
