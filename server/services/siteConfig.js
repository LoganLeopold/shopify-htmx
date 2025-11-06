/**
 * Site Config Service
 * Fetches site configuration from Shopify metafields
 */
import { GraphQLClient } from 'graphql-request';
import { config } from '../config.js';

const client = new GraphQLClient(
  `https://${config.shopify.storeDomain}/api/${config.shopify.apiVersion}/graphql.json`,
  {
    headers: {
      'X-Shopify-Storefront-Access-Token': config.shopify.storefrontAccessToken,
    },
  }
);

// Cache config for a short time (5 minutes)
let configCache = null;
let configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getSiteConfig() {
  // Return cached config if still valid
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CACHE_TTL) {
    return configCache;
  }
  
  try {
    const query = `
      query {
        shop {
          name
          description
          primaryDomain {
            url
          }
          metafield(namespace: "theme", key: "primary_color") {
            value
          }
          metafield(namespace: "theme", key: "hero_title") {
            value
          }
          metafield(namespace: "theme", key: "hero_description") {
            value
          }
        }
      }
    `;
    
    const data = await client.request(query);
    
    const siteConfig = {
      name: data.shop.name || 'Shop',
      description: data.shop.description || '',
      url: data.shop.primaryDomain?.url || '',
      primaryColor: data.shop.metafield?.value || '#000',
      heroTitle: data.shop.metafield?.value || 'Welcome',
      heroDescription: data.shop.metafield?.value || '',
    };
    
    // Update cache
    configCache = siteConfig;
    configCacheTime = now;
    
    return siteConfig;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('\n❌ Authentication failed for getSiteConfig');
      console.error('   Status:', error.response.status);
      console.error('   Store Domain:', config.shopify.storeDomain);
      console.error('   Token (first 15 chars):', config.shopify.storefrontAccessToken?.substring(0, 15) + '...');
      console.error('   API Version:', config.shopify.apiVersion);
      console.error('\n🔍 Troubleshooting steps:');
      console.error('   1. Verify your .env file has correct SHOPIFY_STOREFRONT_ACCESS_TOKEN');
      console.error('   2. Ensure the token starts with "shpat_" or "shpca_"');
      console.error('   3. Check that the app is INSTALLED on your store');
      console.error('   4. Verify Storefront API scopes are enabled in Partner Dashboard');
      console.error('   5. Generate a NEW token after installing the app');
      console.error('   6. Ensure store domain includes ".myshopify.com"');
      console.error('');
    } else {
      console.error('Error fetching site config:', error.message || error);
    }
    
    // Return default config on error (don't crash the app)
    return {
      name: 'Shop',
      description: '',
      url: '',
      primaryColor: '#000',
      heroTitle: 'Welcome',
      heroDescription: '',
    };
  }
}
