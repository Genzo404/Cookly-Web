import {
  doc, getDoc,
  collection, addDoc, getDocs, deleteDoc,
  runTransaction, query, orderBy, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth } from "./firebase.js";

const ADMIN_EMAILS = ["total_carnage24@yahoo.com"];

const detailsCard   = document.getElementById("detailsCard");
const detailsStatus = document.getElementById("detailsStatus");

/* ── Helpers ── */
function markdownToHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function normalizeMeta(recipe) {
  const calories = recipe.calories ?? recipe.calorie ?? recipe.kcal ?? recipe.energy ?? "N/A";
  const time     = recipe.time ?? recipe.cookTime ?? recipe.cookingTime ?? recipe.prepTime ?? "N/A";
  const caloriesText = /cal|kcal/i.test(String(calories)) ? String(calories) : `${calories} cal`;
  const timeText     = /min|hour|hr/i.test(String(time))  ? String(time)     : `${time} min`;
  return { caloriesText, timeText };
}

function buildInstructions(instructions) {
  if (Array.isArray(instructions) && instructions.length) {
    return `<ol class="details-list">${instructions.map(s => `<li>${markdownToHtml(s)}</li>`).join("")}</ol>`;
  }
  if (typeof instructions === "string" && instructions.trim()) {
    const lines = instructions.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) return `<ol class="details-list">${lines.map(s => `<li>${markdownToHtml(s)}</li>`).join("")}</ol>`;
    return `<p class="details-text">${markdownToHtml(instructions)}</p>`;
  }
  return `<p class="details-text">No instructions available.</p>`;
}

function buildIngredients(ingredients) {
  if (Array.isArray(ingredients) && ingredients.length) {
    return `<ul class="details-list">${ingredients.map(i => `<li>${markdownToHtml(String(i).trim())}</li>`).join("")}</ul>`;
  }
  if (typeof ingredients === "string" && ingredients.trim()) {
    const items = ingredients.split(/\r?\n|,/).map(i => i.trim()).filter(Boolean);
    if (items.length) return `<ul class="details-list">${items.map(i => `<li>${markdownToHtml(i)}</li>`).join("")}</ul>`;
  }
  return `<p class="details-text">No ingredients listed.</p>`;
}

function resolveRecipeImagePath(value) {
  const fallback = "https://via.placeholder.com/900x420?text=No+Image";
  if (!value) return fallback;
  const normalized = String(value).trim().replace(/\\/g, "/");
  if (!normalized) return fallback;
  if (/^(https?:|data:|blob:|\/|\.\/|\.\.\/)/i.test(normalized)) return normalized;
  return `../${normalized.replace(/^\/+/, "")}`;
}

/* ── Render recipe ── */
function renderRecipe(recipe) {
  const name        = recipe.name || recipe.title || "Untitled Recipe";
  const category    = recipe.category || "General";
  const description = recipe.description || "No description available.";
  const image       = resolveRecipeImagePath(recipe.imageURL || recipe.image);
  const { caloriesText, timeText } = normalizeMeta(recipe);

  detailsCard.innerHTML = `
    <div class="details-hero">
      <img class="details-media" src="${image}" alt="${name}" />
    </div>
    <div class="details-content-wrap">
      <div class="details-summary-card">
        <span class="recipe-tag details-category">${category}</span>
        <h1 class="details-title">${name}</h1>
        <div class="details-meta-row" aria-label="Recipe summary">
          <span class="details-meta-chip"><span class="details-meta-icon">⏱</span>${timeText}</span>
          <span class="details-divider">|</span>
          <span class="details-meta-chip"><span class="details-meta-icon">🔥</span>${caloriesText}</span>
        </div>
      </div>
      <div class="details-content">
        <section class="details-panel details-panel-full">
          <h3>Description</h3>
          <p class="details-text">${description}</p>
        </section>
        <section class="details-panel">
          <h3>Ingredients</h3>
          ${buildIngredients(recipe.ingredients)}
        </section>
        <section class="details-panel">
          <h3>Instructions</h3>
          ${buildInstructions(recipe.instructions)}
        </section>
        <section class="details-panel details-panel-full" id="interactionPanel"></section>
        <section class="details-panel details-panel-full">
          <div class="details-actions">
            <a class="btn btn-outline" href="javascript:history.back()">Back</a>
            <a class="btn btn-primary" href="../Cookly.html#recipes">Browse More Recipes</a>
          </div>
        </section>
      </div>
    </div>
  `;
}

/* ── Interactions (votes + comments) ── */
function initInteractions(recipeId, recipe = {}) {
  const panel = document.getElementById("interactionPanel");
  if (!panel) return;

  panel.innerHTML = `
    <div class="vote-row">
      <button class="vote-btn" id="upvoteBtn" disabled>👍 <span id="upvoteCount">—</span></button>
      <button class="vote-btn" id="downvoteBtn" disabled>👎 <span id="downvoteCount">—</span></button>
    </div>
    <div class="comments-wrap">
      <h3>Comments</h3>
      <div id="commentForm" class="hidden">
        <textarea id="commentInput" class="comment-input" placeholder="Write a comment..." rows="3"></textarea>
        <button id="submitCommentBtn" class="btn btn-primary btn-sm" style="margin-top:8px;">Post Comment</button>
      </div>
      <p id="commentGate" class="comment-gate"></p>
      <div id="commentsList" class="comments-list"></div>
    </div>
  `;

  loadVoteCounts(recipeId);
  loadComments(recipeId);

  onAuthStateChanged(auth, (user) => {
    // Message author button — only for community recipes with a known author who isn't you
    if (recipe.uid && (!user || user.uid !== recipe.uid)) {
      const voteRow = panel.querySelector(".vote-row");
      if (voteRow && !voteRow.querySelector(".message-author-btn")) {
        const authorName = encodeURIComponent(recipe.ownerName || "User");
        const messageBtn = document.createElement("a");
        messageBtn.className = "btn btn-outline btn-sm message-author-btn";
        messageBtn.style.marginLeft = "8px";
        messageBtn.textContent = `💬 Message ${recipe.ownerName || "Author"}`;
        messageBtn.href = user
          ? `chat.html?uid=${recipe.uid}&name=${authorName}`
          : "Login.html";
        voteRow.appendChild(messageBtn);
      }
    }
    const upvoteBtn     = document.getElementById("upvoteBtn");
    const downvoteBtn   = document.getElementById("downvoteBtn");
    const commentForm   = document.getElementById("commentForm");
    const commentGate   = document.getElementById("commentGate");

    if (user?.emailVerified) {
      if (upvoteBtn)   { upvoteBtn.disabled   = false; upvoteBtn.onclick   = () => handleVote(recipeId, user.uid, "up");   }
      if (downvoteBtn) { downvoteBtn.disabled = false; downvoteBtn.onclick = () => handleVote(recipeId, user.uid, "down"); }
      commentForm?.classList.remove("hidden");
      if (commentGate) commentGate.textContent = "";

      loadUserVote(recipeId, user.uid);

      document.getElementById("submitCommentBtn")?.addEventListener("click", () => {
        submitComment(recipeId, user);
      });
    } else {
      if (commentGate) {
        commentGate.textContent = user
          ? "Verify your email to vote and leave comments."
          : "Log in to vote and leave comments.";
      }
    }
  });
}

/* ── Votes ── */
async function loadVoteCounts(recipeId) {
  try {
    const snap = await getDoc(doc(db, "recipe_interactions", recipeId));
    const data = snap.exists() ? snap.data() : { upvotes: 0, downvotes: 0 };
    document.getElementById("upvoteCount").textContent   = data.upvotes   ?? 0;
    document.getElementById("downvoteCount").textContent = data.downvotes ?? 0;
  } catch (err) {
    console.error("loadVoteCounts:", err);
  }
}

async function loadUserVote(recipeId, userId) {
  try {
    const snap = await getDoc(doc(db, "recipe_interactions", recipeId, "votes", userId));
    if (snap.exists()) setVoteButtonState(snap.data().type);
  } catch (err) {
    console.error("loadUserVote:", err);
  }
}

function setVoteButtonState(activeType) {
  const upBtn   = document.getElementById("upvoteBtn");
  const downBtn = document.getElementById("downvoteBtn");
  upBtn?.classList.toggle("vote-active-up",   activeType === "up");
  upBtn?.classList.toggle("vote-active-down",  false);
  downBtn?.classList.toggle("vote-active-down", activeType === "down");
  downBtn?.classList.toggle("vote-active-up",   false);
}

async function handleVote(recipeId, userId, type) {
  const voteRef    = doc(db, "recipe_interactions", recipeId, "votes", userId);
  const counterRef = doc(db, "recipe_interactions", recipeId);

  let newCounts    = null;
  let newActiveType = null;

  try {
    await runTransaction(db, async (tx) => {
      const voteDoc    = await tx.get(voteRef);
      const counterDoc = await tx.get(counterRef);

      const existing = voteDoc.exists() ? voteDoc.data().type : null;
      const counts   = counterDoc.exists()
        ? { upvotes: counterDoc.data().upvotes || 0, downvotes: counterDoc.data().downvotes || 0 }
        : { upvotes: 0, downvotes: 0 };

      if (existing === type) {
        tx.delete(voteRef);
        counts[type === "up" ? "upvotes" : "downvotes"] = Math.max(0, counts[type === "up" ? "upvotes" : "downvotes"] - 1);
        newActiveType = null;
      } else {
        if (existing) counts[existing === "up" ? "upvotes" : "downvotes"] = Math.max(0, counts[existing === "up" ? "upvotes" : "downvotes"] - 1);
        counts[type === "up" ? "upvotes" : "downvotes"]++;
        tx.set(voteRef, { type });
        newActiveType = type;
      }
      tx.set(counterRef, counts);
      newCounts = counts;
    });

    if (newCounts) {
      document.getElementById("upvoteCount").textContent   = newCounts.upvotes;
      document.getElementById("downvoteCount").textContent = newCounts.downvotes;
    }
    setVoteButtonState(newActiveType);
  } catch (err) {
    console.error("handleVote:", err);
  }
}

/* ── Comments ── */
async function loadComments(recipeId) {
  try {
    const snap = await getDocs(query(
      collection(db, "recipe_interactions", recipeId, "comments"),
      orderBy("createdAt", "desc")
    ));
    const list = document.getElementById("commentsList");
    if (!list) return;
    list.innerHTML = "";
    if (snap.empty) {
      list.innerHTML = `<p class="comment-empty">No comments yet. Be the first!</p>`;
      return;
    }
    snap.forEach(d => list.appendChild(buildCommentEl(d.id, d.data(), recipeId)));
  } catch (err) {
    console.error("loadComments:", err);
  }
}

function buildCommentEl(commentId, data, recipeId) {
  const el   = document.createElement("div");
  el.className = "comment-item";
  el.id        = `comment-${commentId}`;

  const time = data.createdAt?.toDate
    ? data.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const isOwn    = auth.currentUser?.uid === data.userId;
  const isAdmin  = ADMIN_EMAILS.includes(auth.currentUser?.email);
  const canDelete = isOwn || isAdmin;

  el.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${data.userName || "Anonymous"}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="comment-time">${time}</span>
        ${canDelete ? `<button class="comment-delete-btn" data-id="${commentId}">✕</button>` : ""}
      </div>
    </div>
    <p class="comment-text">${data.text}</p>
  `;

  el.querySelector(".comment-delete-btn")?.addEventListener("click", () => deleteComment(commentId, recipeId));
  return el;
}

async function submitComment(recipeId, user) {
  const input = document.getElementById("commentInput");
  const text  = input?.value.trim();
  if (!text) return;

  const btn = document.getElementById("submitCommentBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Posting..."; }

  try {
    const ref = await addDoc(collection(db, "recipe_interactions", recipeId, "comments"), {
      userId:      user.uid,
      userName:    user.displayName || user.email?.split("@")[0] || "User",
      userPhotoURL: user.photoURL || "",
      text,
      createdAt:   new Date()
    });

    if (input) input.value = "";

    const list      = document.getElementById("commentsList");
    const emptyMsg  = list?.querySelector(".comment-empty");
    if (emptyMsg) emptyMsg.remove();

    const newEl = buildCommentEl(ref.id, {
      userId:   user.uid,
      userName: user.displayName || user.email?.split("@")[0] || "User",
      text,
      createdAt: { toDate: () => new Date() }
    }, recipeId);

    list?.insertBefore(newEl, list.firstChild);
  } catch (err) {
    console.error("submitComment:", err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Post Comment"; }
  }
}

async function deleteComment(commentId, recipeId) {
  try {
    await deleteDoc(doc(db, "recipe_interactions", recipeId, "comments", commentId));
    document.getElementById(`comment-${commentId}`)?.remove();
    const list = document.getElementById("commentsList");
    if (list && !list.children.length) {
      list.innerHTML = `<p class="comment-empty">No comments yet. Be the first!</p>`;
    }
  } catch (err) {
    console.error("deleteComment:", err);
  }
}

/* ── Load recipe ── */
async function loadRecipeDetails() {
  const params   = new URLSearchParams(window.location.search);
  const recipeId = params.get("id");
  const source   = params.get("source");

  if (!recipeId) { detailsStatus.textContent = "Recipe id is missing from the URL."; return; }

  if (source === "mine") {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { detailsStatus.textContent = "You must be logged in to view this recipe."; return; }
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "recipes_created", recipeId));
        if (!snap.exists()) { detailsStatus.textContent = "Recipe not found."; return; }
        renderRecipe({ id: snap.id, ...snap.data() });
        // No interactions for private recipes
      } catch (err) {
        console.error(err);
        detailsStatus.textContent = "Failed to load recipe details. Please try again.";
      }
    });
  } else {
    try {
      const col    = source === "community" ? "published_recipes" : "recipes";
      const snap   = await getDoc(doc(db, col, recipeId));
      if (!snap.exists()) { detailsStatus.textContent = "Recipe not found."; return; }
      const recipe = { id: snap.id, ...snap.data() };
      renderRecipe(recipe);
      initInteractions(recipeId, recipe);
    } catch (err) {
      console.error(err);
      detailsStatus.textContent = "Failed to load recipe details. Please try again.";
    }
  }
}

loadRecipeDetails();
