/**
 * Site Config Service
 * Fetches site configuration from Shopify metafields
 * Uses Shopify CLI-style client for better connection handling
 */
import { shopifyClient } from '../lib/shopify-client.js';
import { config } from '../config.js';

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
    
    const data = await shopifyClient.request(query);
    
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
    // Silently handle errors - return default config
    
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
