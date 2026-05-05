import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc
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
        <span id="welcomeText"></span>
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

  if (!document.getElementById("categoryFilter")) {
    const filtersWrap = document.createElement("div");
    filtersWrap.className = "search-filters";
    filtersWrap.setAttribute("aria-label", "Recipe filters");
    filtersWrap.innerHTML = `
      <select id="categoryFilter">
        <option value="">All categories</option>
      </select>
      <input id="maxTimeFilter" type="number" min="0" placeholder="Max time (min)" />
      <input id="maxCaloriesFilter" type="number" min="0" placeholder="Max calories" />
      <button id="clearFilters" class="btn btn-outline" type="button">Clear</button>
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
const categoryFilter = document.getElementById("categoryFilter");
const maxTimeFilter = document.getElementById("maxTimeFilter");
const maxCaloriesFilter = document.getElementById("maxCaloriesFilter");
const clearFiltersBtn = document.getElementById("clearFilters");

const guestActions = document.getElementById("guestActions");
const userActions = document.getElementById("userActions");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");

/* State */
let currentUser = null;
let allRecipes = [];
let favoriteRecipeIds = new Set();

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

  const favQ = query(collection(db, "favorites"), where("userId", "==", currentUser.uid));
  const favSnap = await getDocs(favQ);

  favSnap.forEach((d) => {
    const rid = d.data()?.recipeId;
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
  recipeGrid.innerHTML = "";

  if (!recipes.length) {
    recipeGrid.innerHTML = `<p style="grid-column:1/-1;text-align:center;">No recipes found.</p>`;
    return;
  }

  recipes.forEach((recipe) => {
    const id = recipe.id || recipe.recipeId || "";
    const name = recipe.name || recipe.title || "Untitled Recipe";
    const img = recipe.imageURL || recipe.image || "https://via.placeholder.com/300";
    const cat = recipe.category || "General";
    const { calories, time } = getRecipeMeta(recipe);
    const detailsUrl = id
      ? `pages/recipe_details.html?id=${encodeURIComponent(id)}`
      : "pages/recipe_details.html";

    const card = document.createElement("article");
    card.className = "recipe-card";
    card.innerHTML = `
      <img src="${img}" alt="${name}" />
      <div class="recipe-card-content">
        <div class="recipe-card-top">
          <span class="recipe-tag">${cat}</span>
          <button class="fav-btn" data-id="${id}">
            ${heartIcon(id)}
          </button>
        </div>
        <h3>${name}</h3>
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

    recipeGrid.appendChild(card);
  });
}

function extractNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function populateCategoryFilter(recipes) {
  if (!categoryFilter) return;

  const selected = categoryFilter.value;
  const categories = [...new Set(recipes
    .map((r) => (r.category || "").toString().trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  categoryFilter.innerHTML = `<option value="">All categories</option>${categories
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join("")}`;

  if (selected && categories.includes(selected)) {
    categoryFilter.value = selected;
  }
}

function applyFilters() {
  const q = (recipeSearch?.value || "").trim().toLowerCase();
  const selectedCategory = (categoryFilter?.value || "").trim().toLowerCase();
  const maxTime = extractNumber(maxTimeFilter?.value || "");
  const maxCalories = extractNumber(maxCaloriesFilter?.value || "");

  const filtered = allRecipes.filter((r) => {
    const recipeText = `${r.name || r.title || ""} ${r.category || ""} ${r.description || ""}`.toLowerCase();
    if (q && !recipeText.includes(q)) return false;

    const recipeCategory = (r.category || "").toString().trim().toLowerCase();
    if (selectedCategory && recipeCategory !== selectedCategory) return false;

    const recipeTime = extractNumber(r.time ?? r.cookTime ?? r.cookingTime ?? r.prepTime);
    if (maxTime !== null && (recipeTime === null || recipeTime > maxTime)) return false;

    const recipeCalories = extractNumber(r.calories ?? r.calorie ?? r.kcal ?? r.energy);
    if (maxCalories !== null && (recipeCalories === null || recipeCalories > maxCalories)) return false;

    return true;
  });

  renderRecipes(filtered);
}

async function loadRecipes() {
  if (!recipeGrid) return;
  try {
    const snap = await getDocs(collection(db, "recipes"));
    allRecipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  const qFav = query(
    collection(db, "favorites"),
    where("userId", "==", currentUser.uid),
    where("recipeId", "==", recipeId)
  );
  const snap = await getDocs(qFav);

  if (!snap.empty) {
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    favoriteRecipeIds.delete(recipeId);
  } else {
    await addDoc(collection(db, "favorites"), {
      userId: currentUser.uid,
      recipeId,
      createdAt: new Date()
    });
    favoriteRecipeIds.add(recipeId);
  }
}

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
categoryFilter?.addEventListener("change", applyFilters);
maxTimeFilter?.addEventListener("input", applyFilters);
maxCaloriesFilter?.addEventListener("input", applyFilters);
clearFiltersBtn?.addEventListener("click", () => {
  if (recipeSearch) recipeSearch.value = "";
  if (categoryFilter) categoryFilter.value = "";
  if (maxTimeFilter) maxTimeFilter.value = "";
  if (maxCaloriesFilter) maxCaloriesFilter.value = "";
  applyFilters();
});

/* Boot */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateNavbar(user);
  await loadFavoriteIds();
  await loadRecipes();
});