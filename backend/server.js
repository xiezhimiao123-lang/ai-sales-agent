require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// Shopify API Client
// ============================================================

async function fetchShopifyProducts(shop, accessToken) {
  const url = `https://${shop}/admin/api/2024-01/products.json?limit=50`;
  const res = await axios.get(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  return res.data.products.map(p => ({
    id: p.id,
    title: p.title,
    price: p.variants[0]?.price || '0',
    description: p.body_html ? p.body_html.replace(/<[^>]*>/g, '').slice(0, 200) : '',
    handle: p.handle,
    image: p.image?.src || null,
    url: `https://${shop}/products/${p.handle}`,
  }));
}

async function fetchShopifyOrders(shop, accessToken, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const url = `https://${shop}/admin/api/2024-01/orders.json?created_at_min=${since.toISOString()}&status=any&limit=50`;
  const res = await axios.get(url, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  return res.data.orders;
}

// ============================================================
// Mock data (fallback when no Shopify credentials)
// ============================================================

const mockProducts = [
  { id: 1, title: 'Wireless Headphones', price: '79.99', description: 'Premium noise-cancelling wireless headphones with 30hr battery life.' },
  { id: 2, title: 'Organic Cotton T-Shirt', price: '29.99', description: 'Soft, sustainable organic cotton t-shirt in multiple colors.' },
  { id: 3, title: 'Ceramic Coffee Mug Set', price: '34.99', description: 'Set of 4 handcrafted ceramic mugs, dishwasher safe.' },
  { id: 4, title: 'Yoga Mat Premium', price: '59.99', description: 'Eco-friendly non-slip yoga mat, 6mm thick with carrying strap.' },
  { id: 5, title: 'Leather Wallet', price: '49.99', description: 'Genuine leather bifold wallet with RFID protection.' },
  { id: 6, title: 'Smart Water Bottle', price: '39.99', description: 'Insulated stainless steel bottle that tracks hydration via app.' },
  { id: 7, title: 'Desk Lamp LED', price: '89.99', description: 'Adjustable LED desk lamp with wireless charging base.' },
];

// In-memory analytics store (in production, use a database)
let analyticsData = {
  conversations: 13,
  aiOrders: 1,
  aiSales: 159.00,
  conversationLogs: [],
  dailyConversations: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 4, 25 + i).toISOString().slice(5, 10),
    count: i >= 26 ? [1, 2, 1, 8][i - 26] : 0,
  })),
  dailySales: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 4, 25 + i).toISOString().slice(5, 10),
    amount: i >= 28 ? 159 * (i - 27) : 0,
  })),
  channelData: [
    { name: 'Meta / Facebook', percentage: 61.5, count: 8 },
    { name: 'Referral Domain', percentage: 30.8, count: 4 },
    { name: 'Direct', percentage: 7.7, count: 1 },
  ],
};

// ============================================================
// AI Chat Endpoint
// ============================================================

app.post('/api/chat', async (req, res) => {
  const { message, history, shop, accessToken } = req.body;

  // Try to get real products from Shopify
  let products = mockProducts;
  if (shop && accessToken) {
    try {
      products = await fetchShopifyProducts(shop, accessToken);
    } catch (e) {
      console.warn('Failed to fetch Shopify products, using mock:', e.message);
    }
  }

  // Track conversation
  analyticsData.conversations += 1;
  const today = new Date().toISOString().slice(5, 10);
  const dayEntry = analyticsData.dailyConversations.find(d => d.date === today);
  if (dayEntry) dayEntry.count += 1;

  // Build product context for AI
  const productContext = products.map(p =>
    `- ${p.title}: $${p.price} - ${p.description || 'No description'}`
  ).join('\n');

  const systemPrompt = `You are Lumi, an AI sales assistant for an online store.
Your job is to help customers find products, answer questions, and encourage purchases.
Be friendly, concise, and helpful. Always try to recommend relevant products from the list.

Available products:
${productContext}

Rules:
- Keep responses under 100 words
- If unsure about stock/details, say you'll check
- Gently guide toward a purchase when appropriate
- Never make up product details not listed above`;

  try {
    const apiKey = process.env.AI_API_KEY;
    const apiBase = process.env.AI_API_BASE || 'https://api.openai.com/v1';

    if (apiKey) {
      const response = await axios.post(`${apiBase}/chat/completions`, {
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-6),
          { role: 'user', content: message }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      const aiReply = response.data.choices[0].message.content;

      // Try to find recommended product
      const recommendedProduct = products.find(p =>
        aiReply.toLowerCase().includes(p.title.toLowerCase())
      );

      res.json({
        reply: aiReply,
        product: recommendedProduct || null,
      });
      return;
    }

    // Fallback: rule-based
    const fallbackReply = getFallbackReply(message, products);
    res.json(fallbackReply);

  } catch (err) {
    console.error('AI API error:', err.message);
    const fallbackReply = getFallbackReply(message, products);
    res.json(fallbackReply);
  }
});

function getFallbackReply(message, products) {
  const msg = message.toLowerCase();

  const keywordMap = {
    'headphone': products.find(p => p.title.toLowerCase().includes('headphone')),
    'audio|music|earphone': products.find(p => p.title.toLowerCase().includes('headphone')),
    'shirt|t-shirt|cloth|wear': products.find(p => p.title.toLowerCase().includes('t-shirt') || p.title.toLowerCase().includes('cotton')),
    'mug|coffee|cup': products.find(p => p.title.toLowerCase().includes('mug')),
    'yoga|mat': products.find(p => p.title.toLowerCase().includes('yoga')),
    'wallet|leather': products.find(p => p.title.toLowerCase().includes('wallet')),
    'bottle|water': products.find(p => p.title.toLowerCase().includes('bottle')),
    'lamp|light|desk': products.find(p => p.title.toLowerCase().includes('lamp')),
  };

  for (const [keywords, product] of Object.entries(keywordMap)) {
    const pattern = new RegExp(keywords);
    if (pattern.test(msg) && product) {
      return {
        reply: `Great choice! ${product.title} is $${product.price}. ${product.description}. Want to see more details?`,
        product,
      };
    }
  }

  if (msg.includes('price') || msg.includes('cost')) {
    return { reply: `We have fair prices across all products, mostly between $29-$89. Plus free shipping over $50! Anything specific you're eyeing?` };
  }

  if (msg.includes('shipping') || msg.includes('deliver')) {
    return { reply: `Free shipping on orders over $50! Standard delivery is 3-5 business days. 📦` };
  }

  if (msg.includes('return') || msg.includes('refund')) {
    return { reply: `30-day hassle-free returns. Not satisfied? Full refund, no questions asked.` };
  }

  const randomProduct = products[Math.floor(Math.random() * products.length)];
  return {
    reply: `Hi! I'm Lumi, your AI shopping assistant. I can help you find the perfect product. What are you looking for today?`,
    product: randomProduct,
  };
}

// ============================================================
// Products Endpoint - NOW SUPPORTS REAL SHOPIFY DATA
// ============================================================

app.get('/api/products', async (req, res) => {
  const { shop, accessToken } = req.query;

  if (shop && accessToken) {
    try {
      const products = await fetchShopifyProducts(shop, accessToken);
      return res.json({ products, indexed: products.length, source: 'shopify' });
    } catch (e) {
      console.warn('Shopify API error:', e.message);
      return res.json({ products: mockProducts, indexed: mockProducts.length, source: 'mock', error: e.message });
    }
  }

  // No credentials → return mock data
  res.json({ products: mockProducts, indexed: mockProducts.length, source: 'mock' });
});

// ============================================================
// Order Attribution Tracking
// ============================================================

// Call this when a customer adds to cart via AI recommendation
app.post('/api/track/add-to-cart', (req, res) => {
  const { sessionId, productId, productTitle } = req.body;
  console.log(`🛒 AI-influenced add-to-cart: ${productTitle} (session: ${sessionId})`);
  res.json({ success: true });
});

// Call this when an AI-influenced order is placed (webhook from Shopify)
app.post('/api/track/order', (req, res) => {
  const order = req.body;
  const orderValue = order.total_price || 0;

  analyticsData.aiOrders += 1;
  analyticsData.aiSales += parseFloat(orderValue);
  analyticsData.conversionRate = ((analyticsData.aiOrders / analyticsData.conversations) * 100).toFixed(1);

  const today = new Date().toISOString().slice(5, 10);
  const dayEntry = analyticsData.dailySales.find(d => d.date === today);
  if (dayEntry) dayEntry.amount += parseFloat(orderValue);

  console.log(`💰 AI-assisted order: $${orderValue} (total AI sales: $${analyticsData.aiSales})`);
  res.json({ success: true });
});

// ============================================================
// Analytics Endpoint
// ============================================================

app.get('/api/analytics', (req, res) => {
  const conversionRate = analyticsData.conversations > 0
    ? ((analyticsData.aiOrders / analyticsData.conversations) * 100).toFixed(1)
    : 0;

  res.json({
    conversations: analyticsData.conversations,
    conversionRate: parseFloat(conversionRate),
    aiOrders: analyticsData.aiOrders,
    aiSales: parseFloat(analyticsData.aiSales.toFixed(2)),
    conversationsTrend: analyticsData.dailyConversations,
    salesTrend: analyticsData.dailySales,
    channelData: analyticsData.channelData,
  });
});

// ============================================================
// Shopify OAuth Endpoints
// ============================================================

// Step 1: Merchant installs app → redirect to Shopify OAuth
app.get('/api/shopify/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const scopes = 'read_products,read_orders,read_customers,write_script_tags';
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || `http://localhost:3000/api/shopify/callback`;

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(authUrl);
});

// Step 2: OAuth callback → exchange code for access token
app.get('/api/shopify/callback', async (req, res) => {
  const { shop, code } = req.query;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  try {
    const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    const accessToken = tokenRes.data.access_token;

    // TODO: Save shop + accessToken to database
    console.log(`✅ Shopify access token obtained for ${shop}`);

    // Redirect to dashboard with token
    res.redirect(`/dashboard.html?shop=${shop}&token=${accessToken}`);
  } catch (err) {
    console.error('OAuth error:', err.message);
    res.status(500).json({ error: 'OAuth failed', details: err.message });
  }
});

// ============================================================
// Setup Status
// ============================================================

app.get('/api/setup', async (req, res) => {
  const { shop, accessToken } = req.query;
  let productCount = mockProducts.length;
  let realProducts = false;

  if (shop && accessToken) {
    try {
      const products = await fetchShopifyProducts(shop, accessToken);
      productCount = products.length;
      realProducts = true;
    } catch (e) {
      // fallback to mock count
    }
  }

  res.json({
    steps: [
      { id: 'products_indexed', label: `${productCount} products indexed`, done: true },
      { id: 'app_embed', label: 'Enable the app embed', done: true, detail: 'App embed enabled in your live theme.' },
      { id: 'proactive_rules', label: 'Configure your proactive sales', done: true, detail: '2 proactive rules enabled' },
    ],
    agentName: 'Lumi · Sales Advisor',
    agentLive: true,
    realProducts,
  });
});

// ============================================================
// Health Check
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    shopify: !!(process.env.SHOPIFY_CLIENT_ID),
    ai: !!(process.env.AI_API_KEY),
    time: new Date().toISOString(),
  });
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, () => {
  console.log(`\n🚀 AI Sales Agent backend running on http://localhost:${PORT}\n`);
  console.log('📡 API Endpoints:');
  console.log('   POST /api/chat                - AI chat');
  console.log('   GET  /api/products             - Product list (real Shopify or mock)');
  console.log('   GET  /api/analytics            - Dashboard data');
  console.log('   GET  /api/setup                - Setup status');
  console.log('   POST /api/track/order          - Order attribution');
  console.log('   GET  /api/shopify/auth         - OAuth install');
  console.log('   GET  /api/shopify/callback     - OAuth callback\n');
  console.log('⚙️  Environment:');
  console.log(`   AI API:     ${process.env.AI_API_KEY ? '✅ configured' : '❌ not set (using fallback)'}`);
  console.log(`   Shopify:    ${process.env.SHOPIFY_CLIENT_ID ? '✅ configured' : '❌ not set (using mock data)'}\n`);
});
