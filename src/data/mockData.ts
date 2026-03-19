export const TOKENS = ['HBAR', 'USDC', 'USDT', 'HBARX', 'SAUCE', 'DAI'] as const;

export interface Pool {
  id: string;
  name: string;
  symbol: string;
  borrower: string;
  totalRequested: number;
  totalReceived: number;
  totalRepaid: number;
  apy: number;
  status: 'active' | 'paused' | 'closed';
  riskLevel: 'low' | 'medium' | 'high';
  acceptedTokens: string[];
  createdAt: string;
  txHash: string;
  allocations: { wallet: string; percentage: number; fundsAssigned: number }[];
}

export interface LenderPosition {
  poolId: string;
  poolName: string;
  deposited: number;
  currentValue: number;
  yield: number;
  pending: number;
  lpTokens: number;
}

export interface TxHistory {
  id: string;
  type: 'borrow' | 'repay' | 'deposit' | 'withdraw' | 'transfer';
  amount: number;
  token: string;
  timestamp: string;
  txHash: string;
  status: 'confirmed' | 'pending' | 'failed';
}

export const mockPools: Pool[] = [
  {
    id: 'pool-1',
    name: 'OneYield Growth Fund',
    symbol: 'HGF',
    borrower: '0.0.4515312',
    totalRequested: 500000,
    totalReceived: 375000,
    totalRepaid: 125000,
    apy: 8.5,
    status: 'active',
    riskLevel: 'low',
    acceptedTokens: ['USDC', 'USDT'],
    createdAt: '2024-01-15',
    txHash: '0.0.12345-1705334400-000000000',
    allocations: [
      { wallet: '0.0.5001234', percentage: 40, fundsAssigned: 150000 },
      { wallet: '0.0.5005678', percentage: 35, fundsAssigned: 131250 },
      { wallet: '0.0.5009012', percentage: 25, fundsAssigned: 93750 },
    ],
  },
  {
    id: 'pool-2',
    name: 'RWA Bridge Capital',
    symbol: 'RBC',
    borrower: '0.0.4515312',
    totalRequested: 1000000,
    totalReceived: 820000,
    totalRepaid: 320000,
    apy: 12.3,
    status: 'active',
    riskLevel: 'medium',
    acceptedTokens: ['USDC', 'HBAR'],
    createdAt: '2024-02-20',
    txHash: '0.0.12345-1708416000-000000000',
    allocations: [
      { wallet: '0.0.6001234', percentage: 50, fundsAssigned: 410000 },
      { wallet: '0.0.6005678', percentage: 50, fundsAssigned: 410000 },
    ],
  },
  {
    id: 'pool-3',
    name: 'Institutional Yield',
    symbol: 'IYF',
    borrower: '0.0.7721000',
    totalRequested: 250000,
    totalReceived: 250000,
    totalRepaid: 250000,
    apy: 6.2,
    status: 'closed',
    riskLevel: 'low',
    acceptedTokens: ['USDC'],
    createdAt: '2023-11-01',
    txHash: '0.0.12345-1698796800-000000000',
    allocations: [
      { wallet: '0.0.8001234', percentage: 100, fundsAssigned: 250000 },
    ],
  },
  {
    id: 'pool-4',
    name: 'DeFi Infrastructure',
    symbol: 'DIF',
    borrower: '0.0.9921000',
    totalRequested: 750000,
    totalReceived: 180000,
    totalRepaid: 0,
    apy: 15.1,
    status: 'active',
    riskLevel: 'high',
    acceptedTokens: ['USDC', 'USDT', 'DAI'],
    createdAt: '2024-03-10',
    txHash: '0.0.12345-1710028800-000000000',
    allocations: [],
  },
];

export const mockLenderPositions: LenderPosition[] = [
  { poolId: 'pool-1', poolName: 'OneYield Growth Fund', deposited: 50000, currentValue: 53250, yield: 3250, pending: 850, lpTokens: 50000 },
  { poolId: 'pool-2', poolName: 'RWA Bridge Capital', deposited: 100000, currentValue: 108500, yield: 8500, pending: 2100, lpTokens: 100000 },
];

export const mockTxHistory: TxHistory[] = [
  { id: 'tx-1', type: 'borrow', amount: 375000, token: 'USDC', timestamp: '2024-01-15T10:30:00Z', txHash: '0.0.12345-1705334400-000000000', status: 'confirmed' },
  { id: 'tx-2', type: 'repay', amount: 50000, token: 'USDC', timestamp: '2024-02-15T14:20:00Z', txHash: '0.0.12345-1708013200-000000000', status: 'confirmed' },
  { id: 'tx-3', type: 'deposit', amount: 50000, token: 'USDC', timestamp: '2024-01-20T09:00:00Z', txHash: '0.0.12345-1705741200-000000000', status: 'confirmed' },
  { id: 'tx-4', type: 'repay', amount: 75000, token: 'USDC', timestamp: '2024-03-01T11:45:00Z', txHash: '0.0.12345-1709292300-000000000', status: 'confirmed' },
  { id: 'tx-5', type: 'deposit', amount: 100000, token: 'USDC', timestamp: '2024-02-25T16:30:00Z', txHash: '0.0.12345-1708878600-000000000', status: 'confirmed' },
  { id: 'tx-6', type: 'transfer', amount: 200000, token: 'USDC', timestamp: '2024-03-05T08:15:00Z', txHash: '0.0.12345-1709626500-000000000', status: 'pending' },
];

export const aumChartData = [
  { month: 'Jul', aum: 450000 },
  { month: 'Aug', aum: 620000 },
  { month: 'Sep', aum: 580000 },
  { month: 'Oct', aum: 750000 },
  { month: 'Nov', aum: 920000 },
  { month: 'Dec', aum: 1100000 },
  { month: 'Jan', aum: 1350000 },
  { month: 'Feb', aum: 1500000 },
  { month: 'Mar', aum: 1695000 },
];

export const apyChartData = [
  { month: 'Jul', apy: 6.2 },
  { month: 'Aug', apy: 7.1 },
  { month: 'Sep', apy: 6.8 },
  { month: 'Oct', apy: 8.3 },
  { month: 'Nov', apy: 9.1 },
  { month: 'Dec', apy: 8.7 },
  { month: 'Jan', apy: 8.5 },
  { month: 'Feb', apy: 9.8 },
  { month: 'Mar', apy: 10.2 },
];
