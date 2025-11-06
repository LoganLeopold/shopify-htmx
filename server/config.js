import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_STOREFRONT_ACCESS_TOKEN',
  'SESSION_SECRET'
];

const missingVars = requiredEnvVars.filter(
  varName => !process.env[varName]
);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n` +
    'Please check your .env file.'
  );
}


export const config = {
  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
    storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  },
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
};

export default config;
