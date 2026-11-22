/**
 * Shopify Storefront API Service
 * All GraphQL queries and mutations for Shopify Storefront API
 * Uses Shopify CLI-style client for better connection handling
 */
import { shopifyClient } from '../lib/shopify-client.js';
import { config } from '../config.js';

// Helper function to handle authentication errors (silent - no logging)
function handleAuthError(error, operation) {
  // Error is already thrown with proper details, just re-throw
  throw error;
}

/**
 * Helper to transform Shopify image URLs with CDN optimizations
 */
function optimizeImageUrl(url, options = {}) {
  if (!url) return null;
  
  const params = new URLSearchParams();
  if (options.width) params.set('width', options.width);
  if (options.height) params.set('height', options.height);
  if (options.format) params.set('format', options.format || 'webp');
  if (options.quality) params.set('quality', options.quality);
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * Get products for a collection with filtering and sorting
 */
export async function getProducts(collectionHandle, options = {}) {
  const { sort = 'best-selling', available, priceMax, page = 1, limit = 24 } = options;
  
  const sortKeyMap = {
    'best-selling': 'BEST_SELLING',
    'price-low': 'PRICE',
    'price-high': 'PRICE',
    'newest': 'CREATED',
    'title-asc': 'TITLE',
    'title-desc': 'TITLE',
  };
  
  const reverse = ['price-high', 'title-desc'].includes(sort);
  
  let query;
  if (collectionHandle) {
    query = `
      query getCollectionProducts($handle: String!, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean!, $first: Int!, $after: String) {
        collection(handle: $handle) {
          id
          title
          description
          handle
          image {
            url
          }
          products(first: $first, sortKey: $sortKey, reverse: $reverse, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                description
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                images(first: 1) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      availableForSale
                      priceV2 {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
  } else {
    query = `
      query getAllProducts($sortKey: ProductSortKeys!, $reverse: Boolean!, $first: Int!, $after: String) {
        products(first: $first, sortKey: $sortKey, reverse: $reverse, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              description
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    availableForSale
                    priceV2 {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
  }
  
  const variables = {
    handle: collectionHandle,
    sortKey: sortKeyMap[sort] || 'BEST_SELLING',
    reverse,
    first: limit,
    after: page > 1 ? options.cursor : null,
  };
  
  if (!collectionHandle) {
    delete variables.handle;
  }
  
  try {
    const data = collectionHandle
      ? await shopifyClient.request(query, variables)
      : await shopifyClient.request(query, variables);
    
    const products = collectionHandle
      ? data.collection?.products.edges.map(e => {
          const product = e.node;
          return {
            ...product,
            image: product.images.edges[0]?.node || null,
            price: product.priceRange.minVariantPrice,
            variant: product.variants.edges[0]?.node || null,
            imageUrl: optimizeImageUrl(product.images.edges[0]?.node?.url, { width: 400, format: 'webp' }),
          };
        })
      : data.products.edges.map(e => {
          const product = e.node;
          return {
            ...product,
            image: product.images.edges[0]?.node || null,
            price: product.priceRange.minVariantPrice,
            variant: product.variants.edges[0]?.node || null,
            imageUrl: optimizeImageUrl(product.images.edges[0]?.node?.url, { width: 400, format: 'webp' }),
          };
        });
    
    // Filter by availability if requested
    let filteredProducts = products;
    if (available === 'true') {
      filteredProducts = products.filter(p => p.variant?.availableForSale);
    }
    
    // Filter by price if requested
    if (priceMax) {
      filteredProducts = filteredProducts.filter(
        p => parseFloat(p.price.amount) <= parseFloat(priceMax)
      );
    }
    
    const pageInfo = collectionHandle
      ? data.collection?.products.pageInfo
      : data.products.pageInfo;
    
    return {
      products: filteredProducts,
      hasNextPage: pageInfo?.hasNextPage || false,
      endCursor: pageInfo?.endCursor || null,
    };
  } catch (error) {
    handleAuthError(error, 'getProducts');
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Get single product by handle
 */
export async function getProduct(handle) {
  const query = `
    query getProduct($handle: String!) {
      product(handle: $handle) {
        id
        title
        description
        descriptionHtml
        handle
        vendor
        productType
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        images(first: 10) {
          edges {
            node {
              url
              altText
            }
          }
        }
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              availableForSale
              priceV2 {
                amount
                currencyCode
              }
              compareAtPriceV2 {
                amount
                currencyCode
              }
              image {
                url
              }
              selectedOptions {
                name
                value
              }
            }
          }
        }
        options {
          name
          values
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(query, { handle });
    const product = data.product;
    
    if (!product) {
      return null;
    }
    
    return {
      ...product,
      images: product.images.edges.map(e => ({
        ...e.node,
        url: optimizeImageUrl(e.node.url, { width: 800, format: 'webp' }),
      })),
      variants: product.variants.edges.map(e => ({
        ...e.node,
        imageUrl: e.node.image
          ? optimizeImageUrl(e.node.image.url, { width: 400, format: 'webp' })
          : null,
      })),
    };
  } catch (error) {
    handleAuthError(error, 'getProduct');
    console.error('Error fetching product:', error);
    throw error;
  }
}

/**
 * Product recommendations (Storefront API `productRecommendations`), mapped
 * to the same shape as collection products so product cards can render them.
 */
export async function getProductRecommendations(productId, limit = 4) {
  const query = `
    query productRecommendations($productId: ID!) {
      productRecommendations(productId: $productId) {
        id
        title
        handle
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        images(first: 1) {
          edges {
            node {
              url
              altText
            }
          }
        }
      }
    }
  `;

  try {
    const data = await shopifyClient.request(query, { productId });
    return (data.productRecommendations || []).slice(0, limit).map(product => ({
      ...product,
      image: product.images.edges[0]?.node || null,
      price: product.priceRange.minVariantPrice,
      imageUrl: optimizeImageUrl(product.images.edges[0]?.node?.url, { width: 400, format: 'webp' }),
    }));
  } catch (error) {
    console.error('Error fetching product recommendations:', error);
    throw error;
  }
}

/**
 * Get all collections
 */
export async function getCollections() {
  const query = `
    query getCollections {
      collections(first: 250) {
        edges {
          node {
            id
            title
            handle
            description
            image {
              url
              altText
            }
          }
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(query);
    return data.collections.edges.map(e => ({
      ...e.node,
      imageUrl: optimizeImageUrl(e.node.image?.url, { width: 400, format: 'webp' }),
    }));
  } catch (error) {
    handleAuthError(error, 'getCollections');
    console.error('Error fetching collections:', error);
    throw error;
  }
}

/**
 * Get single collection
 */
export async function getCollection(handle) {
  const query = `
    query getCollection($handle: String!) {
      collection(handle: $handle) {
        id
        title
        handle
        description
        descriptionHtml
        image {
          url
          altText
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(query, { handle });
    if (!data.collection) return null;
    
    return {
      ...data.collection,
      imageUrl: optimizeImageUrl(data.collection.image?.url, { width: 800, format: 'webp' }),
    };
  } catch (error) {
    handleAuthError(error, 'getCollection');
    console.error('Error fetching collection:', error);
    throw error;
  }
}

/**
 * Search products
 */
export async function searchProducts(query, limit = 10) {
  const searchQuery = `
    query searchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(searchQuery, { query, first: limit });
    return data.products.edges.map(e => {
      const product = e.node;
      return {
        ...product,
        image: product.images.edges[0]?.node || null,
        price: product.priceRange.minVariantPrice,
        imageUrl: optimizeImageUrl(product.images.edges[0]?.node?.url, { width: 200, format: 'webp' }),
      };
    });
  } catch (error) {
    handleAuthError(error, 'searchProducts');
    console.error('Error searching products:', error);
    throw error;
  }
}

/**
 * Cart Operations
 */
export async function createCart() {
  const mutation = `
    mutation cartCreate {
      cartCreate {
        cart {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(mutation);
    if (data.cartCreate.userErrors?.length > 0) {
      throw new Error(data.cartCreate.userErrors[0].message);
    }
    return data.cartCreate.cart;
  } catch (error) {
    console.error('Error creating cart:', error);
    throw error;
  }
}

export async function getCart(cartId) {
  const query = `
    query getCart($cartId: ID!) {
      cart(id: $cartId) {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 250) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  priceV2 {
                    amount
                    currencyCode
                  }
                  product {
                    title
                  }
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(query, { cartId });
    if (!data.cart) return null;
    
    return {
      ...data.cart,
      lines: data.cart.lines.edges.map(e => ({
        ...e.node,
        merchandise: {
          ...e.node.merchandise,
          imageUrl: optimizeImageUrl(e.node.merchandise.image?.url, { width: 200, format: 'webp' }),
        },
      })),
    };
  } catch (error) {
    console.error('Error fetching cart:', error);
    throw error;
  }
}

export async function addToCart(cartId, variantId, quantity = 1) {
  const mutation = `
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          id
          totalQuantity
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(mutation, {
      cartId,
      lines: [{ merchandiseId: variantId, quantity }],
    });
    
    if (data.cartLinesAdd.userErrors?.length > 0) {
      throw new Error(data.cartLinesAdd.userErrors[0].message);
    }
    
    return await getCart(data.cartLinesAdd.cart.id);
  } catch (error) {
    console.error('Error adding to cart:', error);
    throw error;
  }
}

export async function updateCartLine(cartId, lineId, quantity) {
  const mutation = `
    mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(mutation, {
      cartId,
      lines: [{ id: lineId, quantity }],
    });
    
    if (data.cartLinesUpdate.userErrors?.length > 0) {
      throw new Error(data.cartLinesUpdate.userErrors[0].message);
    }
    
    return await getCart(data.cartLinesUpdate.cart.id);
  } catch (error) {
    console.error('Error updating cart:', error);
    throw error;
  }
}

export async function removeFromCart(cartId, lineId) {
  const mutation = `
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(mutation, {
      cartId,
      lineIds: [lineId],
    });
    
    if (data.cartLinesRemove.userErrors?.length > 0) {
      throw new Error(data.cartLinesRemove.userErrors[0].message);
    }
    
    return await getCart(data.cartLinesRemove.cart.id);
  } catch (error) {
    console.error('Error removing from cart:', error);
    throw error;
  }
}

/**
 * Customer Operations
 */
export async function customerAccessTokenCreate(email, password) {
  const mutation = `
    mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken {
          accessToken
          expiresAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(mutation, {
      input: { email, password },
    });
    
    if (data.customerAccessTokenCreate.userErrors?.length > 0) {
      return { error: data.customerAccessTokenCreate.userErrors[0].message };
    }
    
    return { token: data.customerAccessTokenCreate.customerAccessToken };
  } catch (error) {
    console.error('Error creating access token:', error);
    throw error;
  }
}

export async function customerCreate(email, password, firstName, lastName) {
  const mutation = `
    mutation customerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(mutation, {
      input: {
        email,
        password,
        firstName,
        lastName,
      },
    });
    
    if (data.customerCreate.userErrors?.length > 0) {
      return { error: data.customerCreate.userErrors[0].message };
    }
    
    return { customer: data.customerCreate.customer };
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
}

export async function getCustomer(accessToken) {
  const query = `
    query getCustomer($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        id
        firstName
        lastName
        email
        phone
        defaultAddress {
          id
          address1
          address2
          city
          province
          zip
          country
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(query, { customerAccessToken: accessToken });
    return data.customer;
  } catch (error) {
    console.error('Error fetching customer:', error);
    throw error;
  }
}

export async function getCustomerOrders(accessToken, limit = 10) {
  const query = `
    query getCustomerOrders($customerAccessToken: String!, $first: Int!) {
      customer(customerAccessToken: $customerAccessToken) {
        orders(first: $first) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceV2 {
                amount
                currencyCode
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    quantity
                    variant {
                      title
                      image {
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const data = await shopifyClient.request(query, { customerAccessToken: accessToken, first: limit });
    return data.customer?.orders?.edges.map(e => e.node) || [];
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    throw error;
  }
}
