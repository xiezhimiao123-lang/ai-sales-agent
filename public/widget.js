<!-- AI Sales Agent Chat Widget -->
<!-- Embed this script in your Shopify theme or any website -->

<div id="ai-sales-agent-root"></div>

<script>
(function() {
  // Configuration - override these before loading the script
  window.AISalesAgent = window.AISalesAgent || {};
  const CONFIG = {
    apiBase: window.AISalesAgent.apiBase || '/api',
    agentName: window.AISalesAgent.agentName || 'Lumi',
    agentTitle: window.AISalesAgent.agentTitle || 'Sales Advisor',
    primaryColor: window.AISalesAgent.primaryColor || '#3266ad',
    position: window.AISalesAgent.position || 'bottom-right', // bottom-right | bottom-left
  };

  // State
  let isOpen = false;
  let history = [];
  let products = [];

  // Load products
  async function loadProducts() {
    try {
      const res = await fetch(`${CONFIG.apiBase}/products`);
      const data = await res.json();
      products = data.products || [];
    } catch (e) {
      console.warn('Could not load products:', e);
    }
  }

  // Send message
  async function sendMessage(text) {
    if (!text.trim()) return;

    addMessage(text, 'user');
    showTyping();

    try {
      const res = await fetch(`${CONFIG.apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, products }),
      });
      const data = await res.json();
      removeTyping();
      addMessage(data.reply, 'ai', data.product);
      history.push({ role: 'user', content: text });
      history.push({ role: 'assistant', content: data.reply });
    } catch (e) {
      removeTyping();
      addMessage('Sorry, I had trouble connecting. Please try again!', 'ai');
    }
  }

  // Add message to chat
  function addMessage(text, sender, product) {
    const body = document.getElementById('asa-chat-body');
    const msgEl = document.createElement('div');
    msgEl.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-direction: ${sender === 'user' ? 'row-reverse' : 'row'};
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      background: ${sender === 'user' ? CONFIG.primaryColor : '#f4f4f0'};
      color: ${sender === 'user' ? '#fff' : '#1a1a1a'};
      padding: 10px 14px;
      border-radius: 12px;
      max-width: 80%;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
    `;
    bubble.textContent = text;

    msgEl.appendChild(bubble);

    // Product card
    if (product) {
      const card = document.createElement('div');
      card.style.cssText = `
        background: #fff;
        border: 0.5px solid #ddd;
        border-radius: 8px;
        padding: 10px 12px;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      `;
      card.innerHTML = `
        <div style="width:40px;height:40px;background:#eee;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">📦</div>
        <div>
          <div style="font-size:12px;font-weight:500;color:#1a1a1a;">${product.title}</div>
          <div style="font-size:12px;color:#888;">$${product.price}</div>
        </div>
      `;
      bubble.appendChild(card);
    }

    body.appendChild(msgEl);
    body.scrollTop = body.scrollHeight;
  }

  // Typing indicator
  function showTyping() {
    const body = document.getElementById('asa-chat-body');
    const el = document.createElement('div');
    el.id = 'asa-typing';
    el.style.cssText = 'display:flex;gap:4px;margin-bottom:12px;';
    el.innerHTML = '<span style="width:6px;height:6px;background:#aaa;border-radius:50%;display:inline-block;animation:bounce 1s infinite">●</span>'.repeat(3).replace(/●/g, '') +
      '<span style="width:6px;height:6px;background:#aaa;border-radius:50%;display:inline-block;animation:bounce 1s infinite;animation-delay:0s"></span>' +
      '<span style="width:6px;height:6px;background:#aaa;border-radius:50%;display:inline-block;animation:bounce 1s infinite;animation-delay:0.2s"></span>' +
      '<span style="width:6px;height:6px;background:#aaa;border-radius:50%;display:inline-block;animation:bounce 1s infinite;animation-delay:0.4s"></span>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('asa-typing');
    if (el) el.remove();
  }

  // Build widget UI
  function buildWidget() {
    const root = document.getElementById('ai-sales-agent-root');
    const isLeft = CONFIG.position === 'bottom-left';

    root.innerHTML = `
      <style>
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        #asa-chat-window {
          position: fixed;
          ${isLeft ? 'left: 20px;' : 'right: 20px;'}
          bottom: 80px;
          width: 340px;
          height: 480px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
          z-index: 999999;
          animation: slideUp 0.2s ease;
        }
        #asa-chat-window.open { display: flex; }
        #asa-chat-header {
          background: ${CONFIG.primaryColor};
          color: #fff;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        #asa-chat-body {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          background: #fafaf8;
        }
        #asa-chat-input-area {
          border-top: 0.5px solid #eee;
          padding: 10px 12px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        #asa-chat-input {
          flex: 1;
          border: 0.5px solid #ddd;
          border-radius: 20px;
          padding: 8px 14px;
          font-size: 13px;
          outline: none;
        }
        #asa-chat-input:focus { border-color: ${CONFIG.primaryColor}; }
        #asa-send-btn {
          background: ${CONFIG.primaryColor};
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #asa-toggle-btn {
          position: fixed;
          ${isLeft ? 'left: 20px;' : 'right: 20px;'}
          bottom: 20px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: ${CONFIG.primaryColor};
          color: #fff;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999998;
        }
      </style>

      <div id="asa-chat-window">
        <div id="asa-chat-header">
          <div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;">🧑</div>
          <div>
            <div style="font-size:13px;font-weight:500;">${CONFIG.agentName}</div>
            <div style="font-size:11px;opacity:0.8;">${CONFIG.agentTitle} · Online</div>
          </div>
        </div>
        <div id="asa-chat-body">
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <div style="background:#f4f4f0;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;color:#1a1a1a;max-width:85%;">
              Hi! I'm ${CONFIG.agentName}, your AI shopping assistant. How can I help you today? 😊
            </div>
          </div>
        </div>
        <div id="asa-chat-input-area">
          <input id="asa-chat-input" type="text" placeholder="Type a message..." />
          <button id="asa-send-btn">↑</button>
        </div>
      </div>

      <button id="asa-toggle-btn">💬</button>
    `;

    // Events
    const toggleBtn = document.getElementById('asa-toggle-btn');
    const chatWindow = document.getElementById('asa-chat-window');
    const input = document.getElementById('asa-chat-input');
    const sendBtn = document.getElementById('asa-send-btn');

    toggleBtn.onclick = () => {
      isOpen = !isOpen;
      chatWindow.classList.toggle('open', isOpen);
      if (isOpen) input.focus();
    };

    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    };

    sendBtn.onclick = handleSend;
    input.onkeydown = (e) => { if (e.key === 'Enter') handleSend(); };
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { buildWidget(); loadProducts(); });
  } else {
    buildWidget();
    loadProducts();
  }
})();
</script>
