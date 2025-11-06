/**
 * Shopify Storefront API Client
 * Follows Shopify CLI patterns for connection handling and validation
 */
import { GraphQLClient } from 'graphql-request';
import { config } from '../config.js';

/**
 * Create Shopify Storefront API client with enhanced error handling
 */
function createShopifyClient() {
  const apiUrl = `https://${config.shopify.storeDomain}/api/${config.shopify.apiVersion}/graphql.json`;
  
  // Create client with proper headers
  const client = new GraphQLClient(apiUrl, {
    headers: {
      'Shopify-Storefront-Private-Token': config.shopify.storefrontAccessToken,
      'Content-Type': 'application/json',
    },
    // Add timeout for better error handling
    timeout: 30000,
  });
  
  // Wrap request method with enhanced error handling
  const originalRequest = client.request.bind(client);
  
  client.request = async function(query, variables) {
    try {
      return await originalRequest(query, variables);
    } catch (error) {
      // Enhanced error handling following Shopify CLI patterns
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText || '';
        const errorBody = error.response.error || error.message || '';
        
        // Parse error message if it's JSON
        let errorMessage = errorBody;
        try {
          if (typeof errorBody === 'string') {
            const parsed = JSON.parse(errorBody);
            if (parsed.errors && parsed.errors.length > 0) {
              errorMessage = parsed.errors[0].message || parsed.errors[0].extensions?.code || 'Unknown error';
            }
          }
        } catch (e) {
          // Not JSON, use as-is
        }
        
        if (status === 401 || status === 403) {
          const authError = new Error(`Shopify Storefront API authentication failed: ${errorMessage || statusText}`);
          authError.status = status;
          authError.code = 'UNAUTHORIZED';
          throw authError;
        }
        
        if (status === 429) {
          const rateLimitError = new Error('Shopify API rate limit exceeded. Please try again later.');
          rateLimitError.status = status;
          rateLimitError.code = 'RATE_LIMIT';
          throw rateLimitError;
        }
        
        if (status >= 500) {
          const serverError = new Error(`Shopify API server error: ${errorMessage || statusText}`);
          serverError.status = status;
          serverError.code = 'SERVER_ERROR';
          throw serverError;
        }
        
        // Generic HTTP error
        const httpError = new Error(`Shopify API error (${status}): ${errorMessage || statusText}`);
        httpError.status = status;
        httpError.code = 'HTTP_ERROR';
        throw httpError;
      }
      
      // Network or other errors
      if (error.message?.includes('timeout')) {
        const timeoutError = new Error('Shopify API request timed out');
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      
      // Re-throw error
      throw error;
    }
  };
  
  return client;
}

// Create and export singleton client
export const shopifyClient = createShopifyClient();

