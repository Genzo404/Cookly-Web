import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { auth, db, storage } from "./firebase.js";

const GEMINI_API_KEY = "AIzaSyCTPSUpGCjWn4r33a807E1ZWZ7BiZlfLAg";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const JSON_PROMPT_SUFFIX = `
Return ONLY a valid JSON object with exactly these fields:
{
  "name": "Recipe name",
  "category": "one of: Breakfast, Dessert, Dinner, Drinks, Lunch, Snacks",
  "description": "A short appetising description (2-3 sentences)",
  "calories": 000,
  "time": 00,
  "ingredients": "ingredient 1\\ningredient 2\\ningredient 3",
  "instructions": "Step 1: ...\\nStep 2: ...\\nStep 3: ..."
}
calories is a number (kcal per serving), time is a number (minutes). No markdown, no extra text, just the JSON.`;

let currentUser       = null;
let selectedImageFile = null;
let activeAiTab       = "photo";

const form      = document.getElementById("createRecipeForm");
const messageEl = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

/* ── Recipe image picker ── */
const recipeImageFile    = document.getElementById("recipeImageFile");
const recipeImagePreview = document.getElementById("recipeImagePreview");
const recipeImageLabel   = document.getElementById("recipeImageLabel");

recipeImageFile?.addEventListener("change", () => {
  const file = recipeImageFile.files[0];
  if (!file) return;
  selectedImageFile = file;
  recipeImagePreview.src = URL.createObjectURL(file);
  recipeImagePreview.style.display = "block";
  recipeImageLabel.textContent = `📷 ${file.name}`;
});

/* ── AI section ── */
const aiImageInput  = document.getElementById("aiImageInput");
const aiPreview     = document.getElementById("aiPreview");
const aiGenerateBtn = document.getElementById("aiGenerateBtn");
const aiStatus      = document.getElementById("aiStatus");
const aiTextInput   = document.getElementById("aiTextInput");

/* Tab switching */
document.getElementById("tabPhoto")?.addEventListener("click", () => {
  activeAiTab = "photo";
  document.getElementById("tabPhoto").classList.add("active");
  document.getElementById("tabText").classList.remove("active");
  document.getElementById("aiPhotoSection").style.display = "block";
  document.getElementById("aiTextSection").style.display = "none";
  aiGenerateBtn.disabled = !aiImageInput?.files[0];
  aiStatus.textContent = "";
});

document.getElementById("tabText")?.addEventListener("click", () => {
  activeAiTab = "text";
  document.getElementById("tabText").classList.add("active");
  document.getElementById("tabPhoto").classList.remove("active");
  document.getElementById("aiPhotoSection").style.display = "none";
  document.getElementById("aiTextSection").style.display = "block";
  aiGenerateBtn.disabled = !aiTextInput?.value.trim();
  aiStatus.textContent = "";
});

/* Enable generate button when photo chosen */
aiImageInput?.addEventListener("change", () => {
  const file = aiImageInput.files[0];
  if (!file) return;
  aiPreview.src = URL.createObjectURL(file);
  aiPreview.style.display = "inline-block";
  aiGenerateBtn.disabled = false;
  aiStatus.textContent = "";
});

/* Enable generate button when text typed */
aiTextInput?.addEventListener("input", () => {
  aiGenerateBtn.disabled = !aiTextInput.value.trim();
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fillFormFromRecipe(recipe) {
  document.getElementById("recipeName").value         = recipe.name        || "";
  document.getElementById("recipeDescription").value  = recipe.description || "";
  document.getElementById("recipeCalories").value     = recipe.calories    || "";
  document.getElementById("recipeTime").value         = recipe.time        || "";
  document.getElementById("recipeIngredients").value  = recipe.ingredients || "";
  document.getElementById("recipeInstructions").value = recipe.instructions || "";

  const validCategories = ["Breakfast","Dessert","Dinner","Drinks","Lunch","Snacks"];
  if (validCategories.includes(recipe.category)) {
    document.getElementById("recipeCategory").value = recipe.category;
  }
}

function parseGeminiRecipe(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  return JSON.parse(jsonMatch[0]);
}

aiGenerateBtn?.addEventListener("click", async () => {
  aiGenerateBtn.disabled = true;
  aiStatus.style.color = "var(--primary)";

  try {
    let recipe;

    if (activeAiTab === "photo") {
      const file = aiImageInput.files[0];
      if (!file) return;

      aiStatus.textContent = "Analysing image...";
      const base64 = await toBase64(file);

      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: file.type, data: base64 } },
              { text: `Look at this food image and generate a complete recipe for it.${JSON_PROMPT_SUFFIX}` }
            ]
          }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`);
      recipe = parseGeminiRecipe(data.candidates?.[0]?.content?.parts?.[0]?.text || "");

      // Auto-use the AI photo as the recipe image
      selectedImageFile = file;
      recipeImagePreview.src = URL.createObjectURL(file);
      recipeImagePreview.style.display = "block";
      recipeImageLabel.textContent = `📷 ${file.name}`;

    } else {
      const description = aiTextInput.value.trim();
      if (!description) return;

      aiStatus.textContent = "Generating recipe...";

      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Generate a complete recipe for: "${description}"${JSON_PROMPT_SUFFIX}` }]
          }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`);
      recipe = parseGeminiRecipe(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
    }

    fillFormFromRecipe(recipe);
    aiStatus.style.color = "green";
    aiStatus.textContent = "Recipe generated! Review and edit below, then save.";
    document.querySelector(".create-card").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error("Gemini error:", err);
    aiStatus.style.color = "var(--accent)";
    aiStatus.textContent = `Error: ${err.message}`;
  } finally {
    aiGenerateBtn.disabled = false;
  }
});

/* ── Form submit ── */
function setMessage(text, ok = false) {
  messageEl.textContent = text;
  messageEl.style.color = ok ? "#1e7e34" : "#c0392b";
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "Login.html";
    return;
  }
  currentUser = user;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    window.location.href = "Login.html";
    return;
  }

  const name         = document.getElementById("recipeName").value.trim();
  const category     = document.getElementById("recipeCategory").value.trim();
  const description  = document.getElementById("recipeDescription").value.trim();
  const calories     = Number(document.getElementById("recipeCalories").value) || 0;
  const time         = Number(document.getElementById("recipeTime").value) || 0;
  const ingredients  = document.getElementById("recipeIngredients").value.trim();
  const instructions = document.getElementById("recipeInstructions").value
    .split("\n").map(s => s.trim()).filter(Boolean);

  if (!name || !category || !description || !ingredients || !instructions.length) {
    setMessage("Please fill in all required fields.");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    let imageURL = "";
    if (selectedImageFile) {
      submitBtn.textContent = "Uploading image...";
      const storageRef = ref(storage, `recipe_images/${currentUser.uid}/${Date.now()}_${selectedImageFile.name}`);
      const snapshot   = await uploadBytes(storageRef, selectedImageFile);
      imageURL         = await getDownloadURL(snapshot.ref);
    }

    await addDoc(collection(db, "users", currentUser.uid, "recipes_created"), {
      name,
      nameLower: name.toLowerCase(),
      category,
      description,
      calories,
      time,
      imageURL,
      ingredients,
      instructions,
      status: "private",
      createdAt: new Date()
    });

    setMessage("Recipe saved! Redirecting to your profile...", true);
    setTimeout(() => { window.location.href = "profile.html"; }, 1500);
    form.reset();

    selectedImageFile = null;
    recipeImagePreview.style.display = "none";
    recipeImagePreview.src = "";
    recipeImageLabel.textContent = "📷 Choose Image";
    aiPreview.style.display = "none";
    aiPreview.src = "";
    aiGenerateBtn.disabled = true;
    aiStatus.textContent = "";
    if (aiTextInput) aiTextInput.value = "";

  } catch (err) {
    console.error("Create recipe error:", err);
    setMessage("Failed to save recipe. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Recipe";
  }
});
