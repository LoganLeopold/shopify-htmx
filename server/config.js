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

// Validate token format
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
if (token && !token.startsWith('shpat_') && !token.startsWith('shpca_')) {
  console.warn('⚠️  WARNING: Storefront API token should start with "shpat_" or "shpca_"');
  console.warn('   Current token starts with:', token.substring(0, 10) + '...');
}

// Validate store domain format
const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
if (storeDomain && !storeDomain.includes('.myshopify.com')) {
  console.warn('⚠️  WARNING: Store domain should include ".myshopify.com"');
  console.warn('   Current domain:', storeDomain);
}

// Log configuration in development (without exposing full token)
if (process.env.NODE_ENV === 'development') {
  console.log('\n📋 Shopify Configuration:');
  console.log('   Store Domain:', storeDomain || '❌ MISSING');
  console.log('   Token:', token ? `${token.substring(0, 15)}...${token.substring(token.length - 5)}` : '❌ MISSING');
  console.log('   Token Length:', token ? token.length : 0, '(should be 32+ characters)');
  console.log('   API Version:', process.env.SHOPIFY_API_VERSION || '2024-01');
  console.log('');
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
