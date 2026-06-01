const GEMINI_API_KEY = "AIzaSyCTPSUpGCjWn4r33a807E1ZWZ7BiZlfLAg";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are Cookly's friendly recipe assistant. Your name is Chef AI.
You ONLY help with cooking, recipes, ingredients, meal planning, nutrition, and food-related topics.
If anyone asks about anything unrelated to food or cooking, politely decline and say you can only help with cooking and recipes.
Keep your answers concise and friendly. Use simple formatting — no markdown headers. You may use **bold** for recipe names or key terms, and bullet points for lists, but keep it minimal.`;

const conversationHistory = [];

/* ── Build UI ── */
function buildChatWidget() {
  const bubble = document.createElement("button");
  bubble.className = "chat-bubble";
  bubble.id = "chatBubble";
  bubble.title = "Ask Chef AI";
  bubble.textContent = "👨‍🍳";

  const window_ = document.createElement("div");
  window_.className = "chat-window hidden";
  window_.id = "chatWindow";
  window_.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-info">
        <div class="chat-header-avatar">👨‍🍳</div>
        <div class="chat-header-text">
          <h4>Chef AI</h4>
          <p>Your recipe assistant</p>
        </div>
      </div>
      <button class="chat-close-btn" id="chatCloseBtn">✕</button>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input-row">
      <input type="text" class="chat-input" id="chatInput" placeholder="Ask me anything about cooking..." />
      <button class="chat-send-btn" id="chatSendBtn">➤</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(window_);

  const messagesEl = document.getElementById("chatMessages");
  const inputEl    = document.getElementById("chatInput");
  const sendBtn    = document.getElementById("chatSendBtn");

  /* Open / close */
  bubble.addEventListener("click", () => {
    window_.classList.toggle("hidden");
    if (!window_.classList.contains("hidden") && messagesEl.children.length === 0) {
      appendMessage("bot", "Hi! I'm Chef AI 👨‍🍳 Ask me anything about cooking, recipes, or ingredients!");
    }
    inputEl.focus();
  });

  document.getElementById("chatCloseBtn").addEventListener("click", () => {
    window_.classList.add("hidden");
  });

  /* Send on button click or Enter */
  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    sendBtn.disabled = true;
    appendMessage("user", text);

    const typingEl = appendMessage("typing", "Chef AI is thinking...");

    conversationHistory.push({ role: "user", parts: [{ text }] });

    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: conversationHistory
        })
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error?.message || `API error ${res.status}`;
        throw new Error(errMsg);
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        const reason = data.promptFeedback?.blockReason;
        throw new Error(reason ? `Blocked: ${reason}` : "Empty response from AI.");
      }

      conversationHistory.push({ role: "model", parts: [{ text: reply }] });

      typingEl.remove();
      appendMessage("bot", reply);
    } catch (err) {
      console.error("Chatbot error:", err);
      typingEl.remove();
      // Remove the failed user message from history so it doesn't corrupt context
      conversationHistory.pop();
      appendMessage("bot", `Something went wrong: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function markdownToHtml(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^[\*\-] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
      .replace(/\n/g, "<br>");
  }

  function appendMessage(type, text) {
    const msg = document.createElement("div");
    msg.className = `chat-msg ${type}`;
    if (type === "typing") {
      msg.textContent = text;
    } else {
      msg.innerHTML = markdownToHtml(text);
    }
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }
}

buildChatWidget();
