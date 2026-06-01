import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { auth, db, storage } from "./firebase.js";

const params   = new URLSearchParams(window.location.search);
const recipeId = params.get("id");

const form      = document.getElementById("editRecipeForm");
const messageEl = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

const recipeImageFile  = document.getElementById("recipeImageFile");
const newImagePreview  = document.getElementById("newImagePreview");
const recipeImageLabel = document.getElementById("recipeImageLabel");

let currentUser    = null;
let newImageFile   = null;
let existingImageURL = "";

function setMessage(text, ok = false) {
  messageEl.textContent = text;
  messageEl.style.color = ok ? "#1e7e34" : "#c0392b";
}

recipeImageFile?.addEventListener("change", () => {
  const file = recipeImageFile.files[0];
  if (!file) return;
  newImageFile = file;
  newImagePreview.src = URL.createObjectURL(file);
  newImagePreview.style.display = "block";
  recipeImageLabel.textContent = `📷 ${file.name}`;
});

async function loadRecipe(user) {
  if (!recipeId) {
    setMessage("No recipe ID provided.");
    return;
  }

  try {
    const recipeDoc = await getDoc(doc(db, "users", user.uid, "recipes_created", recipeId));

    if (!recipeDoc.exists()) {
      setMessage("Recipe not found.");
      return;
    }

    const data = recipeDoc.data();

    // Only allow editing private recipes
    if (data.status !== "private") {
      setMessage("Only private recipes can be edited.");
      submitBtn.disabled = true;
      return;
    }

    // Pre-fill form
    document.getElementById("recipeName").value        = data.name        || "";
    document.getElementById("recipeDescription").value = data.description || "";
    document.getElementById("recipeCalories").value    = data.calories    || "";
    document.getElementById("recipeTime").value        = data.time        || "";
    document.getElementById("recipeIngredients").value = data.ingredients || "";
    document.getElementById("recipeInstructions").value = Array.isArray(data.instructions)
      ? data.instructions.join("\n")
      : data.instructions || "";

    const categorySelect = document.getElementById("recipeCategory");
    if (data.category) categorySelect.value = data.category;

    // Show current image if one exists
    if (data.imageURL) {
      existingImageURL = data.imageURL;
      const wrap = document.getElementById("currentImageWrap");
      const img  = document.getElementById("currentImagePreview");
      if (wrap && img) {
        img.src = data.imageURL;
        wrap.style.display = "block";
      }
    }
  } catch (err) {
    console.error("loadRecipe error:", err);
    setMessage("Failed to load recipe.");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !recipeId) return;

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

    let imageURL = existingImageURL;

    if (newImageFile) {
      submitBtn.textContent = "Uploading image...";
      const storageRef = ref(storage, `recipe_images/${currentUser.uid}/${Date.now()}_${newImageFile.name}`);
      const snapshot   = await uploadBytes(storageRef, newImageFile);
      imageURL         = await getDownloadURL(snapshot.ref);
    }

    await updateDoc(doc(db, "users", currentUser.uid, "recipes_created", recipeId), {
      name,
      nameLower: name.toLowerCase(),
      category,
      description,
      calories,
      time,
      imageURL,
      ingredients,
      instructions
    });

    setMessage("Recipe updated successfully!", true);
    setTimeout(() => window.location.href = "profile.html", 1500);

  } catch (err) {
    console.error("Edit recipe error:", err);
    setMessage("Failed to save changes. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Changes";
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "Login.html";
    return;
  }
  currentUser = user;
  loadRecipe(user);
});
