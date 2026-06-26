const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// Mock product data
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

// In-memory analytics (resets on deploy - use DB in production)
let analyticsData = {
  conversations: 13,
  aiOrders: 1,
  aiSales: 159.00,
  dailyConversations: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return { date: `${d.getMonth() + 1}/${d.getDate()}`, count: i >= 26 ? [1, 2, 1, 8][i - 26] : 0 };
  }),
  dailySales: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return { date: `${d.getMonth() + 1}/${d.getDate()}`, amount: i >= 28 ? 159 * (i - 27) : 0 };
  }),
  channelData: [
    { name: 'Meta / Facebook', percentage: 61.5, count: 8 },
    { name: 'Referral Domain', percentage: 30.8, count: 4 },
    { name: 'Direct', percentage: 7.7, count: 1 },
  ],
};

// ============================================================
// AI Chat
// ============================================================
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  const products = mockProducts;

  analyticsData.conversations += 1;
  const today = new Date();
  const todayStr = `${today.getMonth() + 1}/${today.getDate()}`;
  const dayEntry = analyticsData.dailyConversations.find(d => d.date === todayStr);
  if (dayEntry) dayEntry.count += 1;

  const apiKey = process.env.AI_API_KEY;
  const apiBase = process.env.AI_API_BASE || 'https://api.openai.com/v1';

  if (apiKey) {
    try {
      const productContext = products.map(p => `- ${p.title}: $${p.price} - ${p.description}`).join('\n');
      const response = await axios.post(`${apiBase}/chat/completions`, {
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are Lumi, an AI sales assistant. Help customers find products.\n\nProducts:\n${productContext}\n\nKeep replies under 100 words. Be friendly.` },
          ...(history || []).slice(-6),
          { role: 'user', content: message }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }, { headers: { 'Authorization': `Bearer ${apiKey}` } });

      const aiReply = response.data.choices[0].message.content;
      const recommendedProduct = products.find(p => aiReply.toLowerCase().includes(p.title.toLowerCase()));
      return res.json({ reply: aiReply, product: recommendedProduct || null });
    } catch (e) { /* fall through to fallback */ }
  }

  // Fallback
  const msg = message.toLowerCase();
  const found = products.find(p => msg.includes(p.title.toLowerCase().split(' ')[0].toLowerCase()));
  if (found) return res.json({ reply: `Great choice! ${found.title} is $${found.price}. ${found.description}`, product: found });
  if (msg.includes('shipping')) return res.json({ reply: 'Free shipping on orders over $50! Delivery takes 3-5 business days. 📦' });
  if (msg.includes('return')) return res.json({ reply: '30-day hassle-free returns. Not satisfied? Full refund!' });
  const random = products[Math.floor(Math.random() * products.length)];
  return res.json({ reply: `Hi! I'm Lumi, your AI shopping assistant. What are you looking for today?`, product: random });
});

// ============================================================
// Products
// ============================================================
app.get('/api/products', (req, res) => {
  res.json({ products: mockProducts, indexed: mockProducts.length });
});

// ============================================================
// Analytics
// ============================================================
app.get('/api/analytics', (req, res) => {
  const conversionRate = analyticsData.conversations > 0 ? ((analyticsData.aiOrders / analyticsData.conversations) * 100).toFixed(1) : 0;
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
// Setup
// ============================================================
app.get('/api/setup', (req, res) => {
  res.json({
    steps: [
      { id: 'products_indexed', label: `${mockProducts.length} products indexed`, done: true },
      { id: 'app_embed', label: 'Enable the app embed', done: true, detail: 'App embed enabled in your live theme.' },
      { id: 'proactive_rules', label: 'Configure your proactive sales', done: true, detail: '2 proactive rules enabled' },
    ],
    agentName: 'Lumi · Sales Advisor',
    agentLive: true,
  });
});

// ============================================================
// Track order (for GMV attribution)
// ============================================================
app.post('/api/track/order', (req, res) => {
  const { amount } = req.body;
  analyticsData.aiOrders += 1;
  analyticsData.aiSales += parseFloat(amount || 0);
  console.log(`💰 AI-assisted order: $${amount}`);
  res.json({ success: true });
});

// ============================================================
// Health
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Export for Vercel
module.exports = app;
