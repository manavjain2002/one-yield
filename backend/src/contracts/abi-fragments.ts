/**
 * Minimal ABI fragments for OneYield contracts (encode only).
 * Full ABIs should be generated from compiled artifacts in production.
 */
export const FACTORY_ABI = [
  'function createPool(string _poolName, string _poolSymbol, address _poolManager, address _poolToken, address _oracleManager, address __feeCollector, uint256 _projectedAPY, uint256 _poolSize) returns (address _poolAddress, address _fundManager)',
  'event PoolCreated(address _pool, address indexed _poolManager, address _assetManager, address indexed _poolToken, address indexed _oracleManager, uint256 _poolAPY, uint256 _poolSize)',
  'function totalV1Pools() view returns (uint256)',
  'function pools(uint256) view returns (address)',
  'function pauseTarget(address target)',
  'function unpauseTarget(address target)',
] as const;

export const POOL_ABI = [
  'function activatePool()',
  'function pause()',
  'function unpause()',
  'function updateAssetUnderManagement(uint256 aum)',
  'function sendReserveToAssetManager(uint256 amount)',
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)',
  'function totalAssets() view returns (uint256)',
  'function assetUnderManagement() view returns (uint256)',
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event AssetUnderManagementUpdated(address indexed _by, uint256 _prevValue, uint256 _newValue)',
  'event PoolStatusUpdated(address indexed _by, uint8 _prevStatus, uint8 _newStatus)',
  'event MinimumInvestmentLimitUpdated(address indexed _by, uint256 _prevValue, uint256 _newValue)',
] as const;

export const ASSET_MANAGER_ABI = [
  'function addPool(string _v1PoolId, uint16 _allocation, address _dedicatedWallet)',
  'function removePool(uint256 index)',
  'function updatePoolAllocation(uint256 index, uint16 allocation)',
  'function deployFunds()',
  'function pay(string _v1PoolId, uint256 _amount, uint256 _fee)',
  'function sendToReserve(uint256 _v2Amount)',
  'function totalAssets() view returns (uint256)',
  'event FundDeployed(address indexed _executor, uint256 _amount)',
  'event FundDeployedToChildPool(address indexed _to, string _poolId, uint256 _amount)',
  'event FundsPaid(address indexed payer, string _poolId, uint256 amount)',
  'event FeePaidToFeeCollector(address indexed payer, string _poolId, uint256 fee, address recipient)',
  'event V1PoolAdded(address indexed _executor, uint16 _allocation, string _v1PoolId, address wallet)',
  'event V1PoolRemoved(address indexed _executor, uint16 _allocation, string _v1PoolId)',
] as const;
