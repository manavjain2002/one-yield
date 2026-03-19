export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8080',
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'oneyield',
    password: process.env.DATABASE_PASSWORD ?? 'oneyield',
    name: process.env.DATABASE_NAME ?? 'oneyield',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  hedera: {
    network: process.env.HEDERA_NETWORK ?? 'testnet',
    mirrorNodeUrl:
      process.env.HEDERA_MIRROR_NODE_URL ??
      'https://testnet.mirrornode.hedera.com',
    /** Hedera contract id `0.0.x` or EVM `0x…` (factory on Hedera EVM) */
    factoryContractId: process.env.FACTORY_CONTRACT_ID ?? '0.0.8290502',
    /** Default pool token when borrower omits `poolTokenAddress` (mock USDC on testnet) */
    mockUsdcEvmAddress:
      process.env.MOCK_USDC_EVM_ADDRESS ??
      '0x1Cf407eCB2Cd690d4E6E3F465111E019032ACA74',
    poolManagerAddress: process.env.POOL_MANAGER_ADDRESS,
    oracleManagerAddress: process.env.ORACLE_MANAGER_ADDRESS,
    feeCollectorAddress: process.env.FEE_COLLECTOR_ADDRESS,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '24h',
  },
  chainalysis: {
    apiKey: process.env.CHAINALYSIS_API_KEY ?? '',
  },
  oracle: {
    cron: process.env.ORACLE_CRON ?? '30 0 * * *',
  },
  indexer: {
    pollIntervalSec: parseInt(
      process.env.INDEXER_POLL_INTERVAL_SEC ?? '15',
      10,
    ),
  },
});
