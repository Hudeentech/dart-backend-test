export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dart_jwt_access_secret_key_dev',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dart_jwt_refresh_secret_key_dev',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    paystack: {
      secretKey: process.env.PAYSTACK_SECRET_KEY,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
    },
  },
  notification: {
    provider: process.env.NOTIFICATION_PROVIDER || 'mock',
    termiiApiKey: process.env.TERMII_API_KEY,
    fcmServerKey: process.env.FCM_SERVER_KEY,
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    region: process.env.AWS_REGION || 'eu-west-1',
    bucket: process.env.AWS_S3_BUCKET || 'dart-uploads',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
});
