import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc,
  onSnapshot, query, orderBy, where,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const REACTION_EMOJIS  = ["❤️", "😂", "👍", "😮", "😢", "🔥"];
const CRYPTO_PEPPER    = "c00kly-e2ee-pepper-2024";
const keyCache         = new Map();

/* ── Crypto helpers ── */
async function getKey(convoId) {
  if (keyCache.has(convoId)) return keyCache.get(convoId);

  const raw = new TextEncoder().encode(convoId + CRYPTO_PEPPER);
  const keyMaterial = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(convoId), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  keyCache.set(convoId, key);
  return key;
}

async function encryptMessage(text, convoId) {
  const key       = await getKey(convoId);
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text)
  );
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...combined));
}

async function decryptMessage(ciphertext, convoId) {
  try {
    const combined  = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    if (combined.length < 13) return ciphertext; // too short — unencrypted old message
    const key       = await getKey(convoId);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: combined.slice(0, 12) },
      key,
      combined.slice(12)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return ciphertext; // old unencrypted message — show as-is
  }
}

const convoList      = document.getElementById("convoList");
const chatWindow     = document.getElementById("chatWindow");
const chatEmptyState = document.getElementById("chatEmptyState");
const chatHeader     = document.getElementById("chatHeader");
const chatMessages   = document.getElementById("chatMessages");
const chatInput      = document.getElementById("chatInput");
const sendBtn        = document.getElementById("sendBtn");
const chatSidebar    = document.querySelector(".chat-sidebar");
const chatMain       = document.querySelector(".chat-main");
const chatBackBtn    = document.getElementById("chatBackBtn");

function isMobile() { return window.innerWidth <= 720; }

function showChat() {
  chatSidebar?.classList.add("hidden-mobile");
  chatMain?.classList.add("visible-mobile");
}

function showSidebar() {
  chatSidebar?.classList.remove("hidden-mobile");
  chatMain?.classList.remove("visible-mobile");
}


let currentUser   = null;
let activeConvoId = null;
let messagesUnsub = null;
let convosUnsub   = null;

/* ── Helpers ── */
function getConvoId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function timeLabel(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateLabel(ts) {
  if (!ts) return "Today";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/* ── Get or create conversation document ── */
async function getOrCreateConvo(otherUid, otherName, otherPhoto = "") {
  const convoId  = getConvoId(currentUser.uid, otherUid);
  const convoRef = doc(db, "conversations", convoId);
  const snap     = await getDoc(convoRef);

  if (!snap.exists()) {
    await setDoc(convoRef, {
      participants: [currentUser.uid, otherUid],
      participantInfo: {
        [currentUser.uid]: {
          name:     currentUser.displayName || currentUser.email.split("@")[0],
          photoURL: currentUser.photoURL || ""
        },
        [otherUid]: { name: otherName, photoURL: otherPhoto }
      },
      lastMessage:    "",
      lastMessageAt:  new Date(),
      unread:         { [currentUser.uid]: 0, [otherUid]: 0 },
      createdAt:      new Date()
    });
  }

  return convoId;
}

/* ── Open a conversation ── */
function openConvo(convoId, data) {
  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
  activeConvoId = convoId;

  // Reset unread for current user
  if ((data.unread?.[currentUser.uid] || 0) > 0) {
    updateDoc(doc(db, "conversations", convoId), {
      [`unread.${currentUser.uid}`]: 0
    }).catch(console.error);
  }

  // Show chat window (slide in on mobile)
  chatEmptyState?.classList.add("hidden");
  chatWindow?.classList.remove("hidden");
  showChat();

  // Highlight active item in sidebar
  document.querySelectorAll(".convo-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === convoId);
  });

  // Render header
  const otherUid  = data.participants.find(uid => uid !== currentUser.uid);
  const otherInfo = data.participantInfo?.[otherUid] || {};
  const otherName = otherInfo.name || "User";

  chatHeader.innerHTML = `
    <button class="chat-back-btn" id="chatBackBtn">← Back</button>
    <div class="chat-header-avatar">${otherName[0].toUpperCase()}</div>
    <div class="chat-header-info">
      <span class="chat-header-name">${otherName}</span>
    </div>
  `;
  document.getElementById("chatBackBtn")?.addEventListener("click", () => {
    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
    activeConvoId = null;
    chatWindow?.classList.add("hidden");
    chatEmptyState?.classList.remove("hidden");
    showSidebar();
  });

  // Subscribe to messages in real time
  let prevCount = 0;
  messagesUnsub = onSnapshot(
    query(collection(db, "conversations", convoId, "messages"), orderBy("createdAt", "asc")),
    (snap) => {
      const isNewMessage = snap.size > prevCount;
      prevCount = snap.size;

      let lastDate = null;
      chatMessages.innerHTML = "";

      snap.forEach(d => {
        const msgData = d.data();
        const ds = dateLabel(msgData.createdAt);
        if (ds !== lastDate) {
          lastDate = ds;
          const sep = document.createElement("div");
          sep.className = "date-separator";
          sep.textContent = ds;
          chatMessages.appendChild(sep);
        }
        chatMessages.appendChild(buildMessageEl(d.id, msgData));
      });

      if (isNewMessage) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  );
}

/* ── Build a single message element ── */
function buildMessageEl(msgId, data) {
  const isMine = data.senderId === currentUser.uid;
  const el     = document.createElement("div");
  el.className = `message-wrap ${isMine ? "mine" : "theirs"}`;
  el.dataset.msgId = msgId;

  const reactionsHtml = buildReactionsHtml(data.reactions || {});

  el.innerHTML = `
    <div class="message-bubble-wrap">
      <div class="message-bubble">...</div>
      <button class="reaction-trigger" title="React">＋</button>
    </div>
    <span class="message-time">${timeLabel(data.createdAt)}</span>
    ${reactionsHtml ? `<div class="message-reactions">${reactionsHtml}</div>` : ""}
    <div class="reaction-picker hidden">
      ${REACTION_EMOJIS.map(e => `<button class="reaction-emoji-btn" data-emoji="${e}">${e}</button>`).join("")}
    </div>
  `;

  // Toggle reaction picker
  const picker = el.querySelector(".reaction-picker");
  el.querySelector(".reaction-trigger").addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".reaction-picker").forEach(p => {
      if (p !== picker) p.classList.add("hidden");
    });
    picker.classList.toggle("hidden");
  });

  // Pick an emoji from the picker
  el.querySelectorAll(".reaction-emoji-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      picker.classList.add("hidden");
      toggleReaction(activeConvoId, msgId, btn.dataset.emoji, data.reactions || {});
    });
  });

  // Click an existing reaction pill to toggle
  // Decrypt and render the message text
  decryptMessage(data.text, activeConvoId).then(plaintext => {
    const bubble = el.querySelector(".message-bubble");
    if (bubble) bubble.innerHTML = escapeHtml(plaintext);
  });

  el.querySelectorAll(".reaction-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleReaction(activeConvoId, msgId, pill.dataset.emoji, data.reactions || {});
    });
  });

  return el;
}

function buildReactionsHtml(reactions) {
  return Object.entries(reactions)
    .filter(([, uids]) => Array.isArray(uids) && uids.length > 0)
    .map(([emoji, uids]) => {
      const reacted = uids.includes(currentUser.uid);
      return `<button class="reaction-pill${reacted ? " reacted" : ""}" data-emoji="${emoji}">${emoji} ${uids.length}</button>`;
    }).join("");
}

/* ── Toggle a reaction ── */
async function toggleReaction(convoId, msgId, emoji, currentReactions) {
  const msgRef     = doc(db, "conversations", convoId, "messages", msgId);
  const existingUids = currentReactions[emoji] || [];
  const hasReacted   = existingUids.includes(currentUser.uid);

  try {
    if (hasReacted) {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(currentUser.uid) });
    }
  } catch (err) {
    console.error("toggleReaction:", err);
  }
}

/* ── Send a message ── */
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !activeConvoId) return;

  const convoRef  = doc(db, "conversations", activeConvoId);
  const convoSnap = await getDoc(convoRef);
  if (!convoSnap.exists()) return;

  const otherUid = convoSnap.data().participants.find(uid => uid !== currentUser.uid);

  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;

  try {
    const encryptedText = await encryptMessage(text, activeConvoId);

    await addDoc(collection(db, "conversations", activeConvoId, "messages"), {
      senderId:   currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split("@")[0],
      text:       encryptedText,
      createdAt:  new Date(),
      reactions:  {}
    });

    await updateDoc(convoRef, {
      lastMessage:              encryptedText,
      lastMessageAt:            new Date(),
      [`unread.${otherUid}`]:   (convoSnap.data().unread?.[otherUid] || 0) + 1
    });
  } catch (err) {
    console.error("sendMessage:", err);
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

/* ── Load conversation list (real-time) ── */
function loadConversations(user) {
  if (convosUnsub) convosUnsub();

  convosUnsub = onSnapshot(
    query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    ),
    (snap) => {
      convoList.innerHTML = "";
      if (snap.empty) {
        convoList.innerHTML = `<p class="convo-empty">No conversations yet.<br>Message a recipe author to get started.</p>`;
        return;
      }
      snap.forEach(d => convoList.appendChild(buildConvoItem(d.id, d.data())));
    },
    (err) => {
      console.error("loadConversations:", err);
      convoList.innerHTML = `<p class="convo-empty">Failed to load. Check the console for an index link.</p>`;
    }
  );
}

/* ── Build a conversation list item ── */
function buildConvoItem(convoId, data) {
  const otherUid  = data.participants.find(uid => uid !== currentUser.uid);
  const otherInfo = data.participantInfo?.[otherUid] || {};
  const otherName = otherInfo.name || "User";
  const unread = data.unread?.[currentUser.uid] || 0;

  const el = document.createElement("div");
  el.className = `convo-item${activeConvoId === convoId ? " active" : ""}`;
  el.dataset.id = convoId;
  el.innerHTML = `
    <div class="convo-avatar">${otherName[0].toUpperCase()}</div>
    <div class="convo-info">
      <div class="convo-name-row">
        <span class="convo-name">${otherName}</span>
        ${unread > 0 ? `<span class="convo-unread-badge">${unread}</span>` : ""}
      </div>
      <span class="convo-preview">…</span>
    </div>
  `;

  if (data.lastMessage) {
    decryptMessage(data.lastMessage, convoId).then(plaintext => {
      const preview = el.querySelector(".convo-preview");
      if (preview) preview.textContent = plaintext.length > 42 ? plaintext.slice(0, 42) + "…" : plaintext;
    });
  } else {
    const preview = el.querySelector(".convo-preview");
    if (preview) preview.textContent = "No messages yet";
  }

  el.addEventListener("click", () => openConvo(convoId, data));
  return el;
}

/* ── Input auto-resize + send shortcuts ── */
chatInput?.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
});

chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn?.addEventListener("click", sendMessage);

// Close any open reaction picker on outside click
document.addEventListener("click", () => {
  document.querySelectorAll(".reaction-picker").forEach(p => p.classList.add("hidden"));
});

/* ── Boot ── */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "Login.html"; return; }
  currentUser = user;

  // Show empty state on desktop only (mobile never shows it)
  if (window.innerWidth > 720) chatEmptyState?.classList.remove("hidden");

  loadConversations(user);

  const params     = new URLSearchParams(window.location.search);
  const targetUid  = params.get("uid");
  const targetName = decodeURIComponent(params.get("name") || "User");

  if (targetUid && targetUid !== user.uid) {
    try {
      const convoId   = await getOrCreateConvo(targetUid, targetName);
      const convoSnap = await getDoc(doc(db, "conversations", convoId));
      if (convoSnap.exists()) openConvo(convoId, convoSnap.data());
    } catch (err) {
      console.error("Failed to open conversation:", err.message);
      if (chatEmptyState) {
        chatEmptyState.classList.remove("hidden");
        chatEmptyState.querySelector("p").textContent =
          "Could not open this conversation. Check your Firestore rules.";
      }
    }
  }
});
