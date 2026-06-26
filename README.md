# AI Sales Agent - Shopify Plugin

一套完整的 AI 销售代理 SaaS，模仿 Lumi (magarri) 的模式。

## 功能

- 🤖 **AI 聊天组件** — 嵌入店铺前台，自动回答产品问题、推荐商品
- 📊 **商家后台 Dashboard** — 实时查看 AI 对话数、转化率、GMV 归因
- 🔗 **Shopify API 集成** — 读取真实商品数据，追踪订单归因
- 💰 **GMV 抽成模式** — 精确追踪 AI 促成的订单，按效果收费

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填写：
- `AI_API_KEY` — 任意 OpenAI 兼容接口（OpenAI / DeepSeek / 通义）
- `SHOPIFY_CLIENT_ID` — （可选）Shopify Partner App 凭证

### 3. 启动后端

```bash
cd backend
node server.js
```

### 4. 打开前端

- **商家后台**: 打开 `frontend/dashboard.html`
- **测试店铺**: 打开 `frontend/test-store.html`（点右下角💬聊天）

---

## 接入真实 Shopify 数据

### 方式 A：用自己的店铺测试（最快）

1. 在 Shopify 后台 → **Apps** → **Develop apps** → **Create an app**
2. 配置 Admin API 权限：`read_products`, `read_orders`
3. 生成 Access Token
4. 在 `.env` 里填写：
   ```
   SHOPIFY_SHOP=your-store.myshopify.com
   SHOPIFY_ACCESS_TOKEN=shpat_xxx
   ```
5. 重启后端，Dashboard 会自动读取真实商品

### 方式 B：做成一个可发布的 Shopify App

1. 注册 [Shopify Partners](https://partners.shopify.com)（免费）
2. 创建 App，获取 Client ID / Secret
3. 填写 `.env` 的 `SHOPIFY_CLIENT_ID` 和 `SHOPIFY_CLIENT_SECRET`
4. 部署后端到公网（Render / Railway）
5. 设置 Redirect URI: `https://your-domain.com/api/shopify/callback`
6. 商家通过 OAuth 安装，自动授权

---

## 项目结构

```
shopify-ai-sales-agent/
├── backend/
│   ├── server.js          # Express 后端 + Shopify API + OAuth
│   ├── .env.example       # 环境变量模板
│   └── package.json
├── frontend/
│   ├── dashboard.html     # 商家后台（仿 Lumi 界面）
│   ├── widget.js          # 嵌入店铺的聊天组件
│   └── test-store.html    # 模拟店铺首页
└── README.md
```

---

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | AI 对话 |
| `/api/products` | GET | 商品列表（真实/模拟） |
| `/api/analytics` | GET | 仪表盘数据 |
| `/api/setup` | GET | 安装状态 |
| `/api/track/order` | POST | 订单归因追踪 |
| `/api/shopify/auth` | GET | OAuth 授权入口 |
| `/health` | GET | 健康检查 |

---

## 下一步

- [ ] 部署后端（Render 免费）
- [ ] 接入 Stripe 订阅支付
- [ ] 中文版界面
- [ ] 支持微信小程序商城

---

## License

MIT
