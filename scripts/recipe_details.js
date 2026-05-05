import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const detailsCard = document.getElementById("detailsCard");
const detailsStatus = document.getElementById("detailsStatus");

function normalizeMeta(recipe) {
  const calories = recipe.calories ?? recipe.calorie ?? recipe.kcal ?? recipe.energy ?? "N/A";
  const time = recipe.time ?? recipe.cookTime ?? recipe.cookingTime ?? recipe.prepTime ?? "N/A";

  const caloriesText = /cal|kcal/i.test(String(calories)) ? String(calories) : `${calories} cal`;
  const timeText = /min|hour|hr/i.test(String(time)) ? String(time) : `${time} min`;

  return { caloriesText, timeText };
}

function buildInstructions(instructions) {
  if (Array.isArray(instructions) && instructions.length) {
    return `<ol class="details-list">${instructions.map((step) => `<li>${step}</li>`).join("")}</ol>`;
  }

  if (typeof instructions === "string" && instructions.trim()) {
    return `<p class="details-text">${instructions}</p>`;
  }

  return "<p class=\"details-text\">No instructions available.</p>";
}

function buildIngredients(ingredients) {
  if (Array.isArray(ingredients) && ingredients.length) {
    return `<ul class="details-list">${ingredients
      .map((item) => `<li>${String(item).trim()}</li>`)
      .join("")}</ul>`;
  }

  if (typeof ingredients === "string" && ingredients.trim()) {
    const items = ingredients
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (items.length) {
      return `<ul class="details-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    }
  }

  return "<p class=\"details-text\">No ingredients listed.</p>";
}

function resolveRecipeImagePath(value) {
  const fallback = "https://via.placeholder.com/900x420?text=No+Image";
  if (!value) return fallback;

  const normalized = String(value).trim().replace(/\\/g, "/");
  if (!normalized) return fallback;

  if (/^(https?:|data:|blob:|\/|\.\/|\.\.\/)/i.test(normalized)) {
    return normalized;
  }

  return `../${normalized.replace(/^\/+/, "")}`;
}

function renderRecipe(recipe) {
  const name = recipe.name || recipe.title || "Untitled Recipe";
  const category = recipe.category || "General";
  const description = recipe.description || "No description available.";
  const ingredients = recipe.ingredients;
  const image = resolveRecipeImagePath(recipe.imageURL || recipe.image);
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
          <span class="details-meta-chip">
            <span class="details-meta-icon">⏱</span>
            ${timeText}
          </span>
          <span class="details-divider">|</span>
          <span class="details-meta-chip">
            <span class="details-meta-icon">🔥</span>
            ${caloriesText}
          </span>
        </div>
      </div>

      <div class="details-content">
      <section class="details-panel details-panel-full">
        <h3>Description</h3>
        <p class="details-text">${description}</p>
      </section>

      <section class="details-panel">
        <h3>Ingredients</h3>
        ${buildIngredients(ingredients)}
      </section>

      <section class="details-panel">
        <h3>Instructions</h3>
        ${buildInstructions(recipe.instructions)}
      </section>

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

async function loadRecipeDetails() {
  const recipeId = new URLSearchParams(window.location.search).get("id");

  if (!recipeId) {
    detailsStatus.textContent = "Recipe id is missing from the URL.";
    return;
  }

  try {
    const recipeDoc = await getDoc(doc(db, "recipes", recipeId));

    if (!recipeDoc.exists()) {
      detailsStatus.textContent = "Recipe not found.";
      return;
    }

    renderRecipe({ id: recipeDoc.id, ...recipeDoc.data() });
  } catch (error) {
    console.error("Failed to load recipe details:", error);
    detailsStatus.textContent = "Failed to load recipe details. Please try again.";
  }
}

loadRecipeDetails();