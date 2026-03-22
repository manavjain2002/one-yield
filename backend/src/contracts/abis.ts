/**
 * ABI fragments for all OneYield smart contracts.
 *
 * To add a new contract call:
 *   1. Add the function/event signature here
 *   2. Use ContractService.getReadContract() or getWriteContract() to call it
 *
 * Format: human-readable ABI (ethers.js style)
 */

// ── PoolFactory ──────────────────────────────────────────────
export const POOL_FACTORY_ABI = [
  // Write
  'function createPool(string _poolName, string _poolSymbol, address _poolManager, address _poolToken, address _oracleManager, address __feeCollector, uint256 _projectedAPY, uint256 _poolSize) returns (address _poolAddress, address _fundManager)',
  'function pauseTarget(address target)',
  'function unpauseTarget(address target)',

  // Read
  'function totalV1Pools() view returns (uint256)',
  'function pools(uint256) view returns (address)',

  // Events
  'event PoolCreated(address _pool, address indexed _poolManager, address _assetManager, address indexed _poolToken, address indexed _oracleManager, uint256 _poolAPY, uint256 _poolSize)',
] as const;

// ── LendingPool ──────────────────────────────────────────────
export const LENDING_POOL_ABI = [
  // Write
  'function activatePool()',
  'function pause()',
  'function unpause()',
  'function updateAssetUnderManagement(uint256 aum)',
  'function sendReserveToAssetManager(uint256 amount)',
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)',
  'function maxWithdraw(address owner) view returns (uint256)',
  'function maxRedeem(address owner) view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function assetUnderManagement() view returns (uint256)',

  // Events
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event AssetUnderManagementUpdated(address indexed _by, uint256 _prevValue, uint256 _newValue)',
  'event PoolStatusUpdated(address indexed _by, uint8 _prevStatus, uint8 _newStatus)',
  'event MinimumInvestmentLimitUpdated(address indexed _by, uint256 _prevValue, uint256 _newValue)',
] as const;

// ── AssetManager ──────────────────────────────────────────────
export const ASSET_MANAGER_ABI = [
  // Write
  'function addPool(string _v1PoolId, uint16 _allocation, address _dedicatedWallet)',
  'function removePool(uint256 index)',
  'function updatePoolAllocation(uint256 index, uint16 allocation)',
  'function updateWallet(uint256 index, address wallet)',
  'function deployFunds()',
  'function pay(string _v1PoolId, uint256 _amount, uint256 _fee)',
  'function sendToReserve(uint256 _v2Amount)',

  // Read
  'function totalAssets() view returns (uint256)',
  'function totalQueued() view returns (uint256)',

  // Events
  'event FundDeployed(address indexed _executor, uint256 _amount)',
  'event FundDeployedToChildPool(address indexed _to, string _poolId, uint256 _amount)',
  'event FundsPaid(address indexed payer, string _poolId, uint256 amount)',
  'event FeePaidToFeeCollector(address indexed payer, string _poolId, uint256 fee, address recipient)',
  'event V1PoolAdded(address indexed _executor, uint16 _allocation, string _v1PoolId, address wallet)',
  'event V1PoolRemoved(address indexed _executor, uint16 _allocation, string _v1PoolId)',
] as const;

// ── ERC20 (for token approve / balance checks) ──────────────
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',

  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;
