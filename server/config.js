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
  // Third-party marketing/analytics scripts (see docs/third-party-scripts.md)
  thirdParty: {
    // 'partytown' (run in a web worker), 'main' (classic main-thread tags) or 'off'
    mode: process.env.THIRD_PARTY_MODE || 'partytown',
    // Allow ?third_party=main|partytown|off to override the mode per request,
    // for side-by-side performance comparisons. On by default outside production.
    allowModeOverride: process.env.THIRD_PARTY_ALLOW_OVERRIDE
      ? process.env.THIRD_PARTY_ALLOW_OVERRIDE === 'true'
      : (process.env.NODE_ENV || 'development') !== 'production',
    ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || '',
    klaviyoCompanyId: process.env.KLAVIYO_COMPANY_ID || '',
    // Logs every dispatched commerce event to the console and enables
    // Partytown's debug build + GA4 debug_mode (DebugView).
    debug: process.env.THIRD_PARTY_DEBUG === 'true',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
};

export default config;
