require('dotenv').config();
const Redis = require('ioredis');

async function testConnection(urlOrOpts, label) {
  return new Promise((resolve) => {
    console.log(`\n--- Testing ${label} ---`);
    console.log(JSON.stringify(urlOrOpts, null, 2));
    let redis;
    try {
      if (typeof urlOrOpts === 'object') {
         redis = new Redis({ ...urlOrOpts, maxRetriesPerRequest: 0, connectTimeout: 3000, lazyConnect: true });
      } else {
         redis = new Redis(urlOrOpts, { maxRetriesPerRequest: 0, connectTimeout: 3000, lazyConnect: true });
      }
    } catch(e) {
      console.log(`❌ Failed instantiate for ${label}: ${e.message}`);
      return resolve(false);
    }

    redis.connect().then(() => {
      console.log(`✅ Success for ${label}`);
      redis.disconnect();
      resolve(true);
    }).catch((err) => {
      console.log(`❌ Failed for ${label}: ${err.message}`);
      redis.disconnect();
      resolve(false);
    });
  });
}

async function run() {
  console.log('ENV:');
  console.log('REDISHOST:', process.env.REDISHOST);
  console.log('REDIS_URL:', process.env.REDIS_URL);
  console.log('REDIS_PUBLIC_URL:', process.env.REDIS_PUBLIC_URL);

  if (process.env.REDIS_PUBLIC_URL) await testConnection(process.env.REDIS_PUBLIC_URL, 'REDIS_PUBLIC_URL');
  if (process.env.REDIS_URL) await testConnection(process.env.REDIS_URL, 'REDIS_URL');
  
  await testConnection({
    host: process.env.REDISHOST || 'localhost',
    port: Number(process.env.REDISPORT || 6379),
    password: process.env.REDISPASSWORD
  }, 'Internal Parts');

  // Let's test the configuration.ts logic
  const config = require('./src/config/configuration.ts').default();
  console.log('\n--- Configuration.ts Output ---');
  console.log(config.redis);
  await testConnection(config.redis, 'config.redis output');

  process.exit(0);
}

run();
