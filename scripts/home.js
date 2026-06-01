import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  runTransaction,
  onSnapshot,
  where,
  query
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

/* Ensure missing HTML blocks exist (safe fallback) */
function ensureNavActions() {
  const navActions = document.getElementById("navActions");
  if (!navActions) return;

  if (!document.getElementById("guestActions") || !document.getElementById("userActions")) {
    navActions.innerHTML = `
      <div id="guestActions" class="auth-actions">
        <a href="pages/Login.html" class="btn btn-outline">Log In</a>
        <a href="pages/Register.html" class="btn btn-primary">Get Started</a>
      </div>
      <div id="userActions" class="auth-actions" style="display:none;">
        <a id="welcomeText" href="pages/profile.html"></a>
        <button id="logoutBtn" class="btn btn-outline" type="button">Log Out</button>
      </div>
      <button class="menu-toggle" id="menuToggle">☰</button>
    `;
  }
}

function ensureRecipeUI() {
  const recipesSection = document.getElementById("recipes");
  const container = recipesSection?.querySelector(".container");
  if (!container) return;

  if (!document.getElementById("recipeSearch")) {
    const searchWrap = document.createElement("div");
    searchWrap.className = "search-bar";
    searchWrap.innerHTML = `
      <input id="recipeSearch" placeholder="Search for pasta, chicken..." />
      <button id="searchButton" class="btn btn-primary">Search</button>
    `;
    container.appendChild(searchWrap);
  }

  if (!document.getElementById("recipeGrid")) {
    const grid = document.createElement("div");
    grid.className = "recipe-grid";
    grid.id = "recipeGrid";
    container.appendChild(grid);
  }

  if (!document.getElementById("categoryDropdown")) {
    const filtersWrap = document.createElement("div");
    filtersWrap.className = "search-filters";
    filtersWrap.setAttribute("aria-label", "Recipe filters");
    filtersWrap.innerHTML = `
      <div class="filter-dropdown" id="categoryDropdown">
        <button class="filter-pill-btn" id="categoryToggleBtn">
          <span id="categoryLabel">All categories</span>
          <span class="dropdown-arrow">▾</span>
        </button>
        <div class="filter-dropdown-menu" id="categoryMenu"></div>
      </div>
      <input id="maxTimeFilter" class="filter-pill-input" type="number" min="0" placeholder="Max time (min)" />
      <input id="maxCaloriesFilter" class="filter-pill-input" type="number" min="0" placeholder="Max calories" />
      <select id="sortSelect" class="filter-pill-btn">
        <option value="default">Sort: Default</option>
        <option value="most_liked">Most Liked</option>
        <option value="least_liked">Least Liked</option>
      </select>
      <button id="clearFilters" class="filter-pill-btn" type="button">Clear</button>
    `;
    const searchBar = document.querySelector(".search-bar");
    if (searchBar?.parentNode) {
      searchBar.parentNode.insertBefore(filtersWrap, searchBar.nextSibling);
    } else {
      container.appendChild(filtersWrap);
    }
  }
}

ensureNavActions();
ensureRecipeUI();

/* DOM */
const recipeGrid = document.getElementById("recipeGrid");
const recipeSearch = document.getElementById("recipeSearch");
const searchButton = document.getElementById("searchButton");
const categoryDropdown = document.getElementById("categoryDropdown");
const categoryToggleBtn = document.getElementById("categoryToggleBtn");
const categoryLabel = document.getElementById("categoryLabel");
const categoryMenu = document.getElementById("categoryMenu");
const maxTimeFilter = document.getElementById("maxTimeFilter");
const maxCaloriesFilter = document.getElementById("maxCaloriesFilter");
const clearFiltersBtn = document.getElementById("clearFilters");
const sortDropdown    = document.getElementById("sortDropdown");
const sortToggleBtn   = document.getElementById("sortToggleBtn");
const sortLabel       = document.getElementById("sortLabel");
const sortMenu        = document.getElementById("sortMenu");

const guestActions = document.getElementById("guestActions");
const userActions = document.getElementById("userActions");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");

/* State */
let currentUser = null;
let allRecipes = [];
let filteredRecipes = [];
let favoriteRecipeIds = new Set();
let votesCache     = new Map();
let userVotesCache = new Map();
let currentSource = "default";
let selectedCategory = "";
let currentSort = "default";
const PAGE_SIZE = 12;
let currentPage = 1;

/* Auth UI */
function getStoredName() {
  return (
    localStorage.getItem("userName") ||
    sessionStorage.getItem("userName") ||
    localStorage.getItem("loggedInUser") ||
    sessionStorage.getItem("loggedInUser") ||
    ""
  );
}

function updateNavbar(user) {
  if (!guestActions || !userActions || !welcomeText) return;

  const name = user?.displayName || getStoredName() || user?.name?.split("@")[0] || "";

  if (user || name) {
    guestActions.style.display = "none";
    userActions.style.display = "flex";
    welcomeText.textContent = `Hi, ${name || "User"}`;
  } else {
    guestActions.style.display = "flex";
    userActions.style.display = "none";
    welcomeText.textContent = "";
  }

  const msgLink = document.getElementById("messagesNavLink");
  if (msgLink) {
    if (user) {
      msgLink.style.display = "";
      onSnapshot(
        query(collection(db, "conversations"), where("participants", "array-contains", user.uid)),
        (snap) => {
          let total = 0;
          snap.forEach(d => { total += d.data().unread?.[user.uid] || 0; });
          const existing = msgLink.querySelector(".nav-msg-badge");
          if (existing) existing.remove();
          if (total > 0) {
            msgLink.insertAdjacentHTML("beforeend", `<span class="nav-msg-badge">${total}</span>`);
          }
        }
      );
    } else {
      msgLink.style.display = "none";
    }
  }

  const startBtn = document.getElementById("startCookingBtn");
  if (startBtn) {
    if (user) {
      startBtn.href = "#recipes";
      startBtn.onclick = (e) => {
        e.preventDefault();
        document.getElementById("recipes")?.scrollIntoView({ behavior: "smooth" });
      };
    } else {
      startBtn.href = "pages/Register.html";
      startBtn.onclick = null;
    }
  }
}

logoutBtn?.addEventListener("click", async () => {
  try { await signOut(auth); } catch {}
  localStorage.removeItem("userName");
  localStorage.removeItem("loggedInUser");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("loggedInUser");
  window.location.href = "Cookly.html";
});

/* Data */
async function loadFavoriteIds() {
  favoriteRecipeIds = new Set();
  if (!currentUser) return;

  const favSnap = await getDocs(collection(db, "users", currentUser.uid, "favorites"));
  favSnap.forEach((d) => {
    const rid = d.data()?.recipeId || d.id;
    if (rid) favoriteRecipeIds.add(rid);
  });
}

function heartIcon(recipeId) {
  return favoriteRecipeIds.has(recipeId) ? "❤️" : "🤍";
}

function getRecipeMeta(recipe) {
  const calories =
    recipe.calories ?? recipe.calorie ?? recipe.kcal ?? recipe.energy ?? null;
  const time =
    recipe.time ?? recipe.cookTime ?? recipe.cookingTime ?? recipe.prepTime ?? null;

  const normalizeCalories = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";
    const text = String(value).trim();
    return /cal|kcal/i.test(text) ? text : `${text} cal`;
  };

  const normalizeTime = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";
    const text = String(value).trim();
    return /min|hour|hr/i.test(text) ? text : `${text} min`;
  };

  return {
    calories: normalizeCalories(calories),
    time: normalizeTime(time)
  };
}

function renderRecipes(recipes) {
  if (!recipeGrid) return;

  filteredRecipes = recipes;
  currentPage = 1;

  recipeGrid.innerHTML = "";
  document.getElementById("loadMoreWrap")?.remove();

  if (!recipes.length) {
    recipeGrid.innerHTML = `<p style="grid-column:1/-1;text-align:center;">No recipes found.</p>`;
    return;
  }

  renderPage();
}

function renderPage() {
  const start = 0;
  const end   = currentPage * PAGE_SIZE;
  const slice = filteredRecipes.slice(start, end);

  // Remove existing cards (keep load more button out of grid)
  Array.from(recipeGrid.children).forEach(c => c.remove());

  slice.forEach((recipe) => {
    const id = recipe.id || recipe.recipeId || "";
    const name = recipe.name || recipe.title || "Untitled Recipe";
    const img = recipe.imageURL || recipe.image || "https://via.placeholder.com/300";
    const cat = recipe.category || "General";
    const { calories, time } = getRecipeMeta(recipe);
    const sourceSuffix = recipe._source === "mine" ? "&source=mine"
      : recipe._source === "community" ? "&source=community"
      : "";
    const detailsUrl = id
      ? `pages/recipe_details.html?id=${encodeURIComponent(id)}${sourceSuffix}`
      : "pages/recipe_details.html";

    const votes     = votesCache.get(id);
    const upvotes   = votes?.upvotes   ?? 0;
    const downvotes = votes?.downvotes ?? 0;
    const userVote  = userVotesCache.get(id) || null;

    const notVerified = currentUser && !currentUser.emailVerified;
    const lockedStyle = notVerified ? ' style="opacity:0.5;cursor:not-allowed;"' : '';

    // Always render vote buttons for non-mine recipes (starts at 0, updated after background fetch)
    const voteRow = recipe._source !== "mine" ? `
      <div class="card-vote-row">
        <button class="card-vote-btn card-upvote-btn${userVote === "up" ? " card-vote-active-up" : ""}"${lockedStyle}>
          👍 <span class="card-up-count">${upvotes}</span>
        </button>
        <button class="card-vote-btn card-downvote-btn${userVote === "down" ? " card-vote-active-down" : ""}"${lockedStyle}>
          👎 <span class="card-down-count">${downvotes}</span>
        </button>
      </div>` : "";

    const card = document.createElement("article");
    card.className = "recipe-card";
    card.dataset.recipeId = id;
    card.innerHTML = `
      <img src="${img}" alt="${name}" loading="lazy" />
      <div class="recipe-card-content">
        <div class="recipe-card-top">
          <span class="recipe-tag">${cat}</span>
          <button class="fav-btn" data-id="${id}">
            ${heartIcon(id)}
          </button>
        </div>
        <h3>${name}</h3>
        ${voteRow}
        <div class="recipe-card-footer">
          <div class="recipe-meta" aria-label="Recipe details">
            <span class="recipe-meta-item">${calories}</span>
            <span class="recipe-meta-item">${time}</span>
          </div>
          <div class="recipe-card-actions">
            <a class="btn btn-primary recipe-view-btn" href="${detailsUrl}">View</a>
          </div>
        </div>
      </div>
    `;

    card.querySelector(".fav-btn")?.addEventListener("click", async () => {
      await toggleFavorite(recipe);
      renderRecipes(allRecipes);
    });

    card.querySelector(".card-upvote-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleCardVote(id, "up", card);
    });
    card.querySelector(".card-downvote-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleCardVote(id, "down", card);
    });

    recipeGrid.appendChild(card);
  });

  // Fetch votes only for this page's recipes (after cards are rendered)
  const votable = slice.filter(r => r._source !== "mine" && r.id && !votesCache.has(r.id));
  if (votable.length) {
    Promise.all(votable.map(r => getDoc(doc(db, "recipe_interactions", r.id)))).then(docs => {
      votable.forEach((r, i) => {
        const d = docs[i];
        votesCache.set(r.id, d.exists()
          ? { upvotes: d.data().upvotes || 0, downvotes: d.data().downvotes || 0 }
          : { upvotes: 0, downvotes: 0 }
        );
        const upCount   = recipeGrid.querySelector(`[data-recipe-id="${r.id}"] .card-up-count`);
        const downCount = recipeGrid.querySelector(`[data-recipe-id="${r.id}"] .card-down-count`);
        if (upCount)   upCount.textContent   = votesCache.get(r.id).upvotes;
        if (downCount) downCount.textContent = votesCache.get(r.id).downvotes;
      });
    });

    if (currentUser?.emailVerified) {
      Promise.all(votable.map(r => getDoc(doc(db, "recipe_interactions", r.id, "votes", currentUser.uid)))).then(docs => {
        votable.forEach((r, i) => {
          if (docs[i].exists()) {
            userVotesCache.set(r.id, docs[i].data().type);
            const type    = docs[i].data().type;
            const upBtn   = recipeGrid.querySelector(`[data-recipe-id="${r.id}"] .card-upvote-btn`);
            const downBtn = recipeGrid.querySelector(`[data-recipe-id="${r.id}"] .card-downvote-btn`);
            upBtn?.classList.toggle("card-vote-active-up",    type === "up");
            downBtn?.classList.toggle("card-vote-active-down", type === "down");
          }
        });
      });
    }
  }

  // Load More button
  document.getElementById("loadMoreWrap")?.remove();
  if (filteredRecipes.length > end) {
    const wrap = document.createElement("div");
    wrap.id = "loadMoreWrap";
    wrap.style.cssText = "grid-column:1/-1;text-align:center;margin-top:8px;";
    wrap.innerHTML = `<button class="btn btn-outline" id="loadMoreBtn">Load More</button>`;
    recipeGrid.appendChild(wrap);
    wrap.querySelector("#loadMoreBtn").addEventListener("click", () => {
      currentPage++;
      renderPage();
    });
  }
}

function extractNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function populateCategoryFilter(recipes) {
  if (!categoryMenu) return;

  const categories = [...new Set(recipes
    .map((r) => (r.category || "").toString().trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const allItems = [{ label: "All categories", value: "" }, ...categories.map(c => ({ label: c, value: c }))];

  categoryMenu.innerHTML = allItems.map(({ label, value }) =>
    `<button class="filter-dropdown-item${selectedCategory === value ? " active" : ""}" data-category="${value}">${label}</button>`
  ).join("");

  categoryMenu.querySelectorAll(".filter-dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedCategory = item.dataset.category;
      categoryLabel.textContent = selectedCategory || "All categories";
      categoryMenu.querySelectorAll(".filter-dropdown-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      categoryDropdown?.classList.remove("open");
      applyFilters();
    });
  });
}

function applyFilters() {
  const q = (recipeSearch?.value || "").trim().toLowerCase();
  const maxTime = extractNumber(maxTimeFilter?.value || "");
  const maxCalories = extractNumber(maxCaloriesFilter?.value || "");

  const filtered = allRecipes.filter((r) => {
    const recipeText = `${r.name || r.title || ""} ${r.category || ""} ${r.description || ""}`.toLowerCase();
    if (q && !recipeText.includes(q)) return false;

    const recipeCategory = (r.category || "").toString().trim().toLowerCase();
    if (selectedCategory && recipeCategory !== selectedCategory.toLowerCase()) return false;

    const recipeTime = extractNumber(r.time ?? r.cookTime ?? r.cookingTime ?? r.prepTime);
    if (maxTime !== null && (recipeTime === null || recipeTime > maxTime)) return false;

    const recipeCalories = extractNumber(r.calories ?? r.calorie ?? r.kcal ?? r.energy);
    if (maxCalories !== null && (recipeCalories === null || recipeCalories > maxCalories)) return false;

    return true;
  });

  if (currentSort === "most_liked") {
    filtered.sort((a, b) => (votesCache.get(b.id)?.upvotes || 0) - (votesCache.get(a.id)?.upvotes || 0));
  } else if (currentSort === "least_liked") {
    filtered.sort((a, b) => (votesCache.get(a.id)?.upvotes || 0) - (votesCache.get(b.id)?.upvotes || 0));
  }

  renderRecipes(filtered);
}

async function loadRecipes() {
  if (!recipeGrid) return;
  try {
    if (currentSource === "community") {
      const snap = await getDocs(collection(db, "published_recipes"));
      allRecipes = snap.docs.map((d) => ({ id: d.id, _source: "community", ...d.data() }));
    } else if (currentSource === "mine") {
      if (!currentUser) {
        recipeGrid.innerHTML = `<p style="grid-column:1/-1;text-align:center;">Log in to see your recipes.</p>`;
        return;
      }
      const snap = await getDocs(collection(db, "users", currentUser.uid, "recipes_created"));
      allRecipes = snap.docs.map((d) => ({ id: d.id, _source: "mine", ...d.data() }));
    } else if (currentSource === "all") {
      const [defaultSnap, communitySnap] = await Promise.all([
        getDocs(collection(db, "recipes")),
        getDocs(collection(db, "published_recipes"))
      ]);
      const defaultRecipes   = defaultSnap.docs.map((d) => ({ id: d.id, _source: "default", ...d.data() }));
      const communityRecipes = communitySnap.docs.map((d) => ({ id: d.id, _source: "community", ...d.data() }));
      if (currentUser) {
        const mySnap = await getDocs(collection(db, "users", currentUser.uid, "recipes_created"));
        const myRecipes = mySnap.docs.map((d) => ({ id: d.id, _source: "mine", ...d.data() }));
        allRecipes = [...defaultRecipes, ...communityRecipes, ...myRecipes];
      } else {
        allRecipes = [...defaultRecipes, ...communityRecipes];
      }
    } else {
      const [defaultSnap, communitySnap] = await Promise.all([
        getDocs(collection(db, "recipes")),
        getDocs(collection(db, "published_recipes"))
      ]);
      const defaultRecipes   = defaultSnap.docs.map((d) => ({ id: d.id, _source: "default", ...d.data() }));
      const communityRecipes = communitySnap.docs.map((d) => ({ id: d.id, _source: "community", ...d.data() }));
      allRecipes = [...defaultRecipes, ...communityRecipes];
    }
    // Votes are fetched lazily per page in renderPage — not upfront for all recipes
    votesCache     = new Map();
    userVotesCache = new Map();

    populateCategoryFilter(allRecipes);
    applyFilters();
  } catch (e) {
    console.error("loadRecipes error:", e);
    recipeGrid.innerHTML = `<p style="grid-column:1/-1;text-align:center;">Failed to load recipes.</p>`;
  }
}

async function toggleFavorite(recipe) {
  if (!currentUser) {
    window.location.href = "pages/Login.html";
    return;
  }

  const recipeId = recipe.id || recipe.recipeId;
  if (!recipeId) return;

  const favRef = doc(db, "users", currentUser.uid, "favorites", recipeId);

  if (favoriteRecipeIds.has(recipeId)) {
    await deleteDoc(favRef);
    favoriteRecipeIds.delete(recipeId);
  } else {
    await setDoc(favRef, { recipeId, createdAt: new Date() });
    favoriteRecipeIds.add(recipeId);
  }
}

function showVerifyToast() {
  if (document.getElementById("verifyToast")) return;
  const toast = document.createElement("div");
  toast.id = "verifyToast";
  toast.style.cssText = `
    position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    background:#022175;color:#fff;padding:14px 24px;border-radius:12px;
    font-size:0.9rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.25);
    white-space:nowrap;
  `;
  toast.textContent = "Please verify your email to vote.";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function handleCardVote(recipeId, type, cardEl) {
  if (!currentUser) { window.location.href = "pages/Login.html"; return; }
  if (!currentUser.emailVerified) { showVerifyToast(); return; }

  const voteRef    = doc(db, "recipe_interactions", recipeId, "votes", currentUser.uid);
  const counterRef = doc(db, "recipe_interactions", recipeId);

  let newCounts = null;
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
      votesCache.set(recipeId, newCounts);
      if (newActiveType) userVotesCache.set(recipeId, newActiveType);
      else userVotesCache.delete(recipeId);

      const upBtn   = cardEl.querySelector(".card-upvote-btn");
      const downBtn = cardEl.querySelector(".card-downvote-btn");
      cardEl.querySelector(".card-up-count").textContent   = newCounts.upvotes;
      cardEl.querySelector(".card-down-count").textContent = newCounts.downvotes;
      upBtn?.classList.toggle("card-vote-active-up",    newActiveType === "up");
      downBtn?.classList.toggle("card-vote-active-down", newActiveType === "down");
    }
  } catch (err) {
    console.error("handleCardVote:", err);
  }
}

/* Source Filter Dropdown Toggle */
const filterDropdown = document.querySelector(".filter-dropdown");
const sourceToggleBtn = document.getElementById("sourceToggleBtn");

sourceToggleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  filterDropdown?.classList.toggle("open");
});

categoryToggleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  categoryDropdown?.classList.toggle("open");
});

document.addEventListener("click", () => {
  filterDropdown?.classList.remove("open");
  categoryDropdown?.classList.remove("open");
  sortDropdown?.classList.remove("open");
});

/* Source Filter */
function setActiveSource(source) {
  currentSource = source;
  document.querySelectorAll(".source-btn[data-source]").forEach((b) => {
    b.classList.toggle("active", b.dataset.source === source);
  });
  const activeBtn = document.querySelector(`.filter-dropdown-menu .source-btn[data-source="${source}"]`);
  const label = document.getElementById("sourceLabel");
  if (label && activeBtn) label.textContent = activeBtn.textContent.trim();
  document.getElementById("sourceToggleBtn")?.classList.add("active");
}

document.querySelectorAll(".source-btn[data-source]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setActiveSource(btn.dataset.source);
    filterDropdown?.classList.remove("open");
    document.getElementById("recipes")?.scrollIntoView({ behavior: "smooth" });
    loadRecipes();
  });
});

/* Search */
function handleSearch() {
  applyFilters();
}

function debounce(fn, delay = 220) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

const handleLiveSearch = debounce(handleSearch, 220);

searchButton?.addEventListener("click", handleSearch);
recipeSearch?.addEventListener("input", handleLiveSearch);
recipeSearch?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});
maxTimeFilter?.addEventListener("input", applyFilters);
maxCaloriesFilter?.addEventListener("input", applyFilters);
sortToggleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  sortDropdown?.classList.toggle("open");
});

sortMenu?.querySelectorAll(".filter-dropdown-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    currentSort = item.dataset.sort;
    const labels = { default: "Sort: Default", most_liked: "Most Liked", least_liked: "Least Liked" };
    if (sortLabel) sortLabel.textContent = labels[currentSort] || "Sort: Default";
    sortMenu.querySelectorAll(".filter-dropdown-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    sortDropdown?.classList.remove("open");
    applyFilters();
  });
});

clearFiltersBtn?.addEventListener("click", () => {
  if (recipeSearch) recipeSearch.value = "";
  selectedCategory = "";
  currentSort = "default";
  if (sortLabel) sortLabel.textContent = "Sort: Default";
  sortMenu?.querySelectorAll(".filter-dropdown-item").forEach((item, i) => {
    item.classList.toggle("active", i === 0);
  });
  if (categoryLabel) categoryLabel.textContent = "All categories";
  categoryMenu?.querySelectorAll(".filter-dropdown-item").forEach((item, i) => {
    item.classList.toggle("active", i === 0);
  });
  if (maxTimeFilter) maxTimeFilter.value = "";
  if (maxCaloriesFilter) maxCaloriesFilter.value = "";
  applyFilters();
});

/* Mobile nav toggle */
const menuToggle = document.getElementById("menuToggle");
const navLinks   = document.getElementById("navLinks");
menuToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  navLinks?.classList.toggle("active");
});
document.addEventListener("click", (e) => {
  if (!navLinks?.contains(e.target) && e.target !== menuToggle) {
    navLinks?.classList.remove("active");
  }
});

/* Boot */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateNavbar(user);
  await loadFavoriteIds();
  await loadRecipes();
});