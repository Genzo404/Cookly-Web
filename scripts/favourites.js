import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  limit,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const favStatus = document.getElementById("favStatus");
const favoritesGrid = document.getElementById("favoritesGrid");
const favLoader = document.getElementById("favLoader");

function setLoading(isLoading) {
  if (!favLoader) return;
  favLoader.classList.toggle("show", isLoading);
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

function resolveRecipeImagePath(value) {
  const fallback = "https://via.placeholder.com/400x240?text=No+Image";
  if (!value) return fallback;

  const normalized = String(value).trim().replace(/\\/g, "/");
  if (!normalized) return fallback;

  // Keep already absolute/explicit paths untouched.
  if (/^(https?:|data:|blob:|\/|\.\/|\.\.\/)/i.test(normalized)) {
    return normalized;
  }

  // This file runs from /pages, so prepend ../ for project-root relative asset paths.
  return `../${normalized.replace(/^\/+/, "")}`;
}

async function unfavorite(recipeId, uid, cardEl) {
  try {
    const q = query(
      collection(db, "favorites"),
      where("userId", "==", uid),
      where("recipeId", "==", recipeId)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    cardEl.remove();

    if (!favoritesGrid.children.length) {
      favStatus.textContent = "You have no favorites yet.";
    }
  } catch (err) {
    console.error("Unfavorite error:", err);
  }
}

function recipeCard(recipe, uid) {
  const id = recipe.id || recipe.recipeId || "";
  const name = recipe.name || recipe.title || "Untitled Recipe";
  const image = resolveRecipeImagePath(recipe.imageURL || recipe.image);
  const category = recipe.category || "General";
  const { calories, time } = getRecipeMeta(recipe);
  const detailsUrl = id
    ? `recipe_details.html?id=${encodeURIComponent(id)}`
    : "recipe_details.html";

  const article = document.createElement("article");
  article.className = "recipe-card";
  article.innerHTML = `
    <img src="${image}" alt="${name}" />
    <div class="recipe-card-content">
      <div class="recipe-card-top">
        <span class="recipe-tag">${category}</span>
        <button class="fav-btn is-fav" aria-label="Remove from favorites">❤️</button>
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

  article.querySelector(".fav-btn").addEventListener("click", () => unfavorite(id, uid, article));

  return article;
}

async function fetchRecipeById(recipeId) {
  // Try doc id = recipeId
  const direct = await getDoc(doc(db, "recipes", recipeId));
  if (direct.exists()) return { id: direct.id, ...direct.data() };

  // Fallback: recipe has field recipeId
  const q = query(collection(db, "recipes"), where("recipeId", "==", recipeId), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const r = snap.docs[0];
    return { id: r.id, ...r.data() };
  }

  return null;
}

async function loadFavorites(uid) {
  try {
    setLoading(true);
    favStatus.textContent = "";
    favoritesGrid.innerHTML = "";

    const favQ = query(collection(db, "favorites"), where("userId", "==", uid));
    const favSnap = await getDocs(favQ);

    if (favSnap.empty) {
      favStatus.textContent = "You have no favorites yet.";
      return;
    }

    const recipeIds = [...new Set(
      favSnap.docs.map(d => d.data().recipeId).filter(Boolean)
    )];

    const recipes = (await Promise.all(recipeIds.map(fetchRecipeById))).filter(Boolean);

    if (!recipes.length) {
      favStatus.textContent = "Favorites found, but matching recipes were not found in 'recipes' collection.";
      return;
    }

    recipes.forEach(recipe => favoritesGrid.appendChild(recipeCard(recipe, uid)));
  } catch (err) {
    console.error("Favorites load error:", err);
    favStatus.textContent = `Failed to load favorites: ${err.message}`;
  } finally {
    setLoading(false);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "Login.html";
    return;
  }
  loadFavorites(user.uid);
});