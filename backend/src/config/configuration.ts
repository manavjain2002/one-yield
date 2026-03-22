export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8080',
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'oneyield',
    password: process.env.DATABASE_PASSWORD ?? 'oneyield',
    name: process.env.DATABASE_NAME ?? 'oneyield',
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDISHOST ?? process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDISPORT ?? process.env.REDIS_PORT ?? '6379', 10),
    username: process.env.REDISUSER,
    password: process.env.REDISPASSWORD ?? process.env.REDIS_PASSWORD,
  },
  blockchain: {
    network: process.env.BLOCKCHAIN_NETWORK ?? 'testnet',
    rpcUrl: process.env.RPC_URL ?? 'https://testnet.hashio.io/api',
    factoryAddress:
      process.env.FACTORY_ADDRESS ?? '0xe9BE1b4E0dB6AF4123562CB01A5B44fD66606647',
    poolTokenAddress:
      process.env.POOL_TOKEN_ADDRESS ?? '0x1Cf407eCB2Cd690d4E6E3F465111E019032ACA74',
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
});
