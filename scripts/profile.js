import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  multiFactor,
  TotpMultiFactorGenerator
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { auth, db, storage } from "./firebase.js";

// ── Add any admin emails to this array ──
const ADMIN_EMAILS = ["total_carnage24@yahoo.com"];

/* ── DOM refs ── */
const profileAvatar        = document.getElementById("profileAvatar");
const profileName          = document.getElementById("profileName");
const profileEmail         = document.getElementById("profileEmail");
const profileJoinDate      = document.getElementById("profileJoinDate");
const favCount             = document.getElementById("favCount");
const recipeCount          = document.getElementById("recipeCount");
const myRecipesPreview     = document.getElementById("myRecipesPreview");
const recipesPreviewStatus = document.getElementById("recipesPreviewStatus");
const signOutBtn           = document.getElementById("signOutBtn");

const nameDisplay   = document.getElementById("nameDisplay");
const nameEdit      = document.getElementById("nameEdit");
const editNameBtn   = document.getElementById("editNameBtn");
const cancelNameBtn = document.getElementById("cancelNameBtn");
const saveNameBtn   = document.getElementById("saveNameBtn");
const newNameInput  = document.getElementById("newName");
const nameMessage   = document.getElementById("nameMessage");

const emailDisplay   = document.getElementById("emailDisplay");
const emailEdit      = document.getElementById("emailEdit");
const editEmailBtn   = document.getElementById("editEmailBtn");
const cancelEmailBtn = document.getElementById("cancelEmailBtn");
const saveEmailBtn   = document.getElementById("saveEmailBtn");
const newEmailInput  = document.getElementById("newEmail");
const emailMessage   = document.getElementById("emailMessage");

const passwordDisplay   = document.getElementById("passwordDisplay");
const passwordEdit      = document.getElementById("passwordEdit");
const editPasswordBtn   = document.getElementById("editPasswordBtn");
const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
const savePasswordBtn   = document.getElementById("savePasswordBtn");
const passwordMessage   = document.getElementById("passwordMessage");

/* ── Helpers ── */
const OVERLAY = `<div class="avatar-overlay">📷</div>`;

function setAvatarInitial(initial) {
  profileAvatar.innerHTML = `${initial}${OVERLAY}`;
}

function setAvatarImage(url) {
  profileAvatar.innerHTML = `<img src="${url}" class="avatar-img" alt="Profile" />${OVERLAY}`;
}

/* ── Avatar upload with crop ── */
const avatarInput   = document.getElementById("avatarInput");
const cropModal     = document.getElementById("cropModal");
const cropImageEl   = document.getElementById("cropImage");
const cropSaveBtn   = document.getElementById("cropSaveBtn");
const cropCancelBtn = document.getElementById("cropCancelBtn");
const cropStatus    = document.getElementById("cropStatus");

let cropper = null;

profileAvatar?.addEventListener("click", () => avatarInput?.click());

avatarInput?.addEventListener("change", () => {
  const file = avatarInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    cropImageEl.src = e.target.result;
    cropModal.classList.remove("hidden");
    cropStatus.textContent = "";

    if (cropper) { cropper.destroy(); cropper = null; }
    cropper = new Cropper(cropImageEl, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.8,
      cropBoxResizable: true,
      guides: false,
      background: false
    });
  };
  reader.readAsDataURL(file);
  avatarInput.value = "";
});

cropCancelBtn?.addEventListener("click", () => {
  cropModal.classList.add("hidden");
  if (cropper) { cropper.destroy(); cropper = null; }
});

cropSaveBtn?.addEventListener("click", async () => {
  if (!cropper || !auth.currentUser) return;

  cropSaveBtn.disabled = true;
  cropStatus.style.color = "var(--primary)";
  cropStatus.textContent = "Uploading...";

  try {
    const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));

    const storageRef = ref(storage, `profile_pictures/${auth.currentUser.uid}/profile.jpg`);
    const snapshot   = await uploadBytes(storageRef, blob);
    const url        = await getDownloadURL(snapshot.ref);

    await updateProfile(auth.currentUser, { photoURL: url });
    setAvatarImage(url);

    cropModal.classList.add("hidden");
    cropper.destroy();
    cropper = null;
  } catch (err) {
    console.error("Avatar upload error:", err);
    cropStatus.style.color = "var(--accent)";
    cropStatus.textContent = "Upload failed. Try again.";
  } finally {
    cropSaveBtn.disabled = false;
  }
});

function formatJoinDate(user) {
  const raw = user.metadata?.creationTime;
  if (!raw) return "";
  const d = new Date(raw);
  return `Joined ${d.toLocaleString("default", { month: "long", year: "numeric" })}`;
}

function getInitial(user) {
  return (user.displayName || user.email || "?")[0].toUpperCase();
}

/* ── Recipe preview cards ── */
function buildPreviewCard(recipe) {
  const id     = recipe.id;
  const name   = recipe.name || recipe.title || "Untitled Recipe";
  const img    = recipe.imageURL || recipe.image || "https://via.placeholder.com/300";
  const cat    = recipe.category || "General";
  const status = recipe.status || "private";
  const url    = `recipe_details.html?id=${encodeURIComponent(id)}&source=mine`;

  let statusBadge = "";
  if (status === "published") statusBadge = `<span class="recipe-status-badge published">✓ Published</span>`;
  else if (status === "pending") statusBadge = `<span class="recipe-status-badge pending">⏳ Pending</span>`;

  const editBtn = status === "private"
    ? `<a class="btn btn-outline btn-sm" href="edit_recipe.html?id=${encodeURIComponent(id)}">Edit</a>`
    : "";
  const publishBtn = status === "private"
    ? `<button class="btn btn-outline btn-sm publish-btn" data-id="${id}">Publish</button>`
    : "";

  const card = document.createElement("article");
  card.className = "recipe-card";
  card.innerHTML = `
    <img src="${img}" alt="${name}" />
    <div class="recipe-card-content">
      <div class="recipe-card-top">
        <span class="recipe-tag">${cat}</span>
        ${statusBadge}
      </div>
      <h3>${name}</h3>
      <div class="recipe-card-footer">
        <div class="recipe-card-actions">
          <a class="btn btn-primary recipe-view-btn" href="${url}">View</a>
          ${editBtn}
          ${publishBtn}
        </div>
      </div>
    </div>
  `;

  card.querySelector(".publish-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Submitting...";
    await submitForReview(id, recipe, card);
  });

  return card;
}

async function submitForReview(recipeId, recipe, cardEl) {
  const user = auth.currentUser;
  if (!user) return;

  const isAdmin = ADMIN_EMAILS.includes(user.email);
  const { id: _ignored, ...recipeData } = recipe;

  try {
    if (isAdmin) {
      // Admins skip the queue — publish immediately
      await updateDoc(doc(db, "users", user.uid, "recipes_created", recipeId), { status: "published" });
      await addDoc(collection(db, "published_recipes"), {
        ...recipeData,
        uid: user.uid,
        recipeId,
        ownerName: user.displayName || user.email?.split("@")[0] || "Admin",
        status: "published",
        publishedAt: new Date()
      });
      const topRow = cardEl.querySelector(".recipe-card-top");
      if (topRow) topRow.insertAdjacentHTML("beforeend", `<span class="recipe-status-badge published">✓ Published</span>`);
    } else {
      await updateDoc(doc(db, "users", user.uid, "recipes_created", recipeId), { status: "pending" });
      await addDoc(collection(db, "pending_reviews"), {
        ...recipeData,
        uid: user.uid,
        recipeId,
        ownerName: user.displayName || user.email?.split("@")[0] || "Unknown",
        status: "pending",
        submittedAt: new Date()
      });
      const topRow = cardEl.querySelector(".recipe-card-top");
      if (topRow) topRow.insertAdjacentHTML("beforeend", `<span class="recipe-status-badge pending">⏳ Pending</span>`);
    }
    cardEl.querySelector(".publish-btn")?.remove();
  } catch (err) {
    console.error("Submit for review error:", err);
    const btn = cardEl.querySelector(".publish-btn");
    if (btn) { btn.disabled = false; btn.textContent = "Publish"; }
  }
}

/* ── Load profile data ── */
async function loadProfile(user) {
  profileName.textContent     = user.displayName || user.email?.split("@")[0] || "User";
  profileEmail.textContent    = user.email || "";
  profileJoinDate.textContent = formatJoinDate(user);
  if (user.photoURL) {
    setAvatarImage(user.photoURL);
  } else {
    setAvatarInitial(getInitial(user));
  }

  const uid = user.uid;

  const [favSnap, allRecipesSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "favorites")),
    getDocs(query(collection(db, "users", uid, "recipes_created"), orderBy("createdAt", "desc")))
  ]);

  favCount.textContent    = favSnap.size;
  recipeCount.textContent = allRecipesSnap.size;

  const allRecipeDocs = allRecipesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  myRecipesPreview.innerHTML = "";
  const showMoreWrap = document.getElementById("showMoreWrap");
  const showMoreBtn  = document.getElementById("showMoreBtn");

  if (allRecipeDocs.length === 0) {
    recipesPreviewStatus.textContent = "You haven't created any recipes yet.";
  } else {
    recipesPreviewStatus.textContent = "";
    allRecipeDocs.slice(0, 3).forEach(r => myRecipesPreview.appendChild(buildPreviewCard(r)));

    if (allRecipeDocs.length > 3 && showMoreWrap && showMoreBtn) {
      showMoreWrap.style.display = "block";
      showMoreBtn.addEventListener("click", () => {
        allRecipeDocs.slice(3).forEach(r => myRecipesPreview.appendChild(buildPreviewCard(r)));
        showMoreWrap.style.display = "none";
      });
    }
  }

  loadTwoFaStatus(user);

  if (ADMIN_EMAILS.includes(user.email)) {
    loadAdminSection();
  }
}

/* ── Admin: Recipes to Review ── */
async function loadAdminSection() {
  const section = document.getElementById("adminSection");
  const status  = document.getElementById("adminSectionStatus");
  const list    = document.getElementById("pendingReviewsList");
  const badge   = document.getElementById("pendingBadge");

  section?.classList.remove("hidden");
  if (status) status.textContent = "Loading...";

  try {
    const snap = await getDocs(collection(db, "pending_reviews"));
    list.innerHTML = "";

    if (snap.empty) {
      if (status) status.textContent = "No pending submissions right now.";
      if (badge) badge.textContent = "0 pending";
      return;
    }

    if (status) status.textContent = "";
    if (badge) badge.textContent = `${snap.size} pending`;

    snap.forEach((d) => list.appendChild(buildPendingRow(d.id, d.data())));
  } catch (err) {
    console.error("loadAdminSection error:", err);
    if (status) status.textContent = "Failed to load recipes to review.";
  }
}

function buildPendingRow(pendingId, data) {
  const row = document.createElement("div");
  row.className = "pending-row";
  const img = data.imageURL || "https://via.placeholder.com/400x200?text=No+Image";

  const calories = data.calories ? `${data.calories} cal` : "N/A";
  const time     = data.time     ? `${data.time} min`     : "N/A";

  const ingredients = (() => {
    if (!data.ingredients) return "Not listed.";
    if (typeof data.ingredients === "string") {
      return data.ingredients.split(/\n|,/).map(i => i.trim()).filter(Boolean)
        .map(i => `<li>${i}</li>`).join("");
    }
    if (Array.isArray(data.ingredients)) return data.ingredients.map(i => `<li>${i}</li>`).join("");
    return "Not listed.";
  })();

  const instructions = (() => {
    if (!data.instructions) return "<li>Not provided.</li>";
    if (Array.isArray(data.instructions)) return data.instructions.map(s => `<li>${s}</li>`).join("");
    if (typeof data.instructions === "string") {
      return data.instructions.split("\n").map(s => s.trim()).filter(Boolean)
        .map(s => `<li>${s}</li>`).join("");
    }
    return "<li>Not provided.</li>";
  })();

  row.innerHTML = `
    <img class="pending-row-hero" src="${img}" alt="${data.name || "Recipe"}"
      onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'" />
    <div class="pending-row-body">
      <div class="pending-row-header">
        <div>
          <h4>${data.name || "Untitled"}</h4>
          <p class="pending-row-meta">${data.category || "General"} · by ${data.ownerName || "Unknown"} · ${calories} · ${time}</p>
        </div>
        <div class="pending-row-actions">
          <button class="btn btn-outline btn-sm toggle-details-btn">▼ Details</button>
          <button class="btn btn-primary btn-sm approve-btn">Approve</button>
          <button class="btn btn-outline btn-sm reject-btn" style="color:#c0392b;border-color:rgba(192,57,43,0.3);">Reject</button>
        </div>
      </div>

      <div class="pending-row-expandable" style="display:none;">
        ${data.description ? `<p class="pending-row-desc">${data.description}</p>` : ""}
        <div class="pending-row-details">
          <div class="pending-detail-col">
            <p class="pending-detail-label">Ingredients</p>
            <ul class="pending-detail-list">${ingredients}</ul>
          </div>
          <div class="pending-detail-col">
            <p class="pending-detail-label">Instructions</p>
            <ol class="pending-detail-list">${instructions}</ol>
          </div>
        </div>
      </div>

      <p class="pending-row-msg"></p>
    </div>
  `;

  const toggleBtn   = row.querySelector(".toggle-details-btn");
  const expandable  = row.querySelector(".pending-row-expandable");
  toggleBtn.addEventListener("click", () => {
    const open = expandable.style.display !== "none";
    expandable.style.display = open ? "none" : "block";
    toggleBtn.textContent = open ? "▼ Details" : "▲ Hide";
  });

  row.querySelector(".approve-btn").addEventListener("click", () => handleApprove(pendingId, data, row));
  row.querySelector(".reject-btn").addEventListener("click", () => handleReject(pendingId, data, row));

  return row;
}

async function handleApprove(pendingId, data, rowEl) {
  const approveBtn = rowEl.querySelector(".approve-btn");
  const rejectBtn  = rowEl.querySelector(".reject-btn");
  const msg        = rowEl.querySelector(".pending-row-msg");

  approveBtn.disabled = true;
  rejectBtn.disabled  = true;
  if (msg) msg.textContent = "Approving...";

  try {
    const { id: _i, uid, recipeId, ownerName, submittedAt, status: _s, ...recipeData } = data;

    await addDoc(collection(db, "published_recipes"), {
      ...recipeData,
      uid,
      recipeId,
      ownerName,
      status: "published",
      publishedAt: new Date()
    });

    await updateDoc(doc(db, "users", uid, "recipes_created", recipeId), { status: "published" });
    await deleteDoc(doc(db, "pending_reviews", pendingId));

    if (msg) { msg.style.color = "green"; msg.textContent = "Approved!"; }
    rowEl.style.opacity = "0.5";
    setTimeout(() => rowEl.remove(), 1200);

    const badge = document.getElementById("pendingBadge");
    const remaining = document.querySelectorAll(".pending-row").length - 1;
    if (badge) badge.textContent = remaining > 0 ? `${remaining} pending` : "0 pending";
    if (remaining === 0) {
      const status = document.getElementById("adminSectionStatus");
      if (status) status.textContent = "No pending submissions right now.";
    }
  } catch (err) {
    console.error("Approve error:", err);
    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = `Error: ${err.message}`; }
    approveBtn.disabled = false;
    rejectBtn.disabled  = false;
  }
}

async function handleReject(pendingId, data, rowEl) {
  const approveBtn = rowEl.querySelector(".approve-btn");
  const rejectBtn  = rowEl.querySelector(".reject-btn");
  const msg        = rowEl.querySelector(".pending-row-msg");

  approveBtn.disabled = true;
  rejectBtn.disabled  = true;
  if (msg) msg.textContent = "Rejecting...";

  try {
    await updateDoc(doc(db, "users", data.uid, "recipes_created", data.recipeId), { status: "private" });
    await deleteDoc(doc(db, "pending_reviews", pendingId));

    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = "Rejected."; }
    rowEl.style.opacity = "0.5";
    setTimeout(() => rowEl.remove(), 1200);

    const badge = document.getElementById("pendingBadge");
    const remaining = document.querySelectorAll(".pending-row").length - 1;
    if (badge) badge.textContent = remaining > 0 ? `${remaining} pending` : "0 pending";
  } catch (err) {
    console.error("Reject error:", err);
    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = `Error: ${err.message}`; }
    approveBtn.disabled = false;
    rejectBtn.disabled  = false;
  }
}

/* ── Inline name editing ── */
editNameBtn?.addEventListener("click", () => {
  newNameInput.value = profileName.textContent;
  nameDisplay.classList.add("hidden");
  nameEdit.classList.remove("hidden");
  nameMessage.textContent = "";
  newNameInput.focus();
});

cancelNameBtn?.addEventListener("click", () => {
  nameEdit.classList.add("hidden");
  nameDisplay.classList.remove("hidden");
  nameMessage.textContent = "";
});

saveNameBtn?.addEventListener("click", async () => {
  const newName = newNameInput.value.trim();
  if (!newName) {
    nameMessage.style.color = "var(--accent)";
    nameMessage.textContent = "Please enter a name.";
    return;
  }
  saveNameBtn.disabled = true;
  try {
    await updateProfile(auth.currentUser, { displayName: newName });
    localStorage.setItem("userName", newName);
    profileName.textContent = newName;
    if (!auth.currentUser?.photoURL) setAvatarInitial(newName[0].toUpperCase());
    nameEdit.classList.add("hidden");
    nameDisplay.classList.remove("hidden");
    nameMessage.style.color   = "green";
    nameMessage.textContent   = "Name updated!";
    setTimeout(() => { nameMessage.textContent = ""; }, 3000);
  } catch (err) {
    nameMessage.style.color = "var(--accent)";
    nameMessage.textContent = "Failed to update name. Try again.";
  } finally {
    saveNameBtn.disabled = false;
  }
});

/* ── Inline email editing ── */
editEmailBtn?.addEventListener("click", () => {
  newEmailInput.value = "";
  emailDisplay.classList.add("hidden");
  emailEdit.classList.remove("hidden");
  emailMessage.textContent = "";
  newEmailInput.focus();
});

cancelEmailBtn?.addEventListener("click", () => {
  emailEdit.classList.add("hidden");
  emailDisplay.classList.remove("hidden");
  emailMessage.textContent = "";
});

saveEmailBtn?.addEventListener("click", async () => {
  const newEmail = newEmailInput.value.trim();
  if (!newEmail) {
    emailMessage.style.color = "var(--accent)";
    emailMessage.textContent = "Please enter a new email.";
    return;
  }
  saveEmailBtn.disabled = true;
  try {
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
    emailEdit.classList.add("hidden");
    emailDisplay.classList.remove("hidden");
    emailMessage.style.color = "green";
    emailMessage.textContent = "Verification sent! Check your new inbox.";
    setTimeout(() => { emailMessage.textContent = ""; }, 5000);
  } catch (err) {
    emailMessage.style.color = "var(--accent)";
    emailMessage.textContent = err.code === "auth/requires-recent-login"
      ? "Session expired. Please sign out and back in, then try again."
      : "Failed to update email. Try again.";
  } finally {
    saveEmailBtn.disabled = false;
  }
});

/* ── Inline password editing ── */
editPasswordBtn?.addEventListener("click", () => {
  passwordDisplay.classList.add("hidden");
  passwordEdit.classList.remove("hidden");
  passwordMessage.textContent = "";
});

cancelPasswordBtn?.addEventListener("click", () => {
  passwordEdit.classList.add("hidden");
  passwordDisplay.classList.remove("hidden");
  passwordMessage.textContent = "";
});

savePasswordBtn?.addEventListener("click", async () => {
  savePasswordBtn.disabled = true;
  try {
    await sendPasswordResetEmail(auth, auth.currentUser.email);
    passwordEdit.classList.add("hidden");
    passwordDisplay.classList.remove("hidden");
    passwordMessage.style.color = "green";
    passwordMessage.textContent = "Reset link sent! Check your inbox.";
    setTimeout(() => { passwordMessage.textContent = ""; }, 5000);
  } catch (err) {
    passwordMessage.style.color = "var(--accent)";
    passwordMessage.textContent = "Failed to send reset email. Try again.";
  } finally {
    savePasswordBtn.disabled = false;
  }
});

/* ── TOTP 2FA ── */
let pendingTotpSecret = null;

function loadTwoFaStatus(user) {
  try {
    const enrolled = multiFactor(user).enrolledFactors.some(f => f.factorId === "totp");
    const badge    = document.getElementById("twoFaStatusBadge");
    const disabledSection = document.getElementById("twoFaDisabled");
    const enabledSection  = document.getElementById("twoFaEnabled");
    const setupSection    = document.getElementById("twoFaSetup");

    setupSection?.classList.add("hidden");

    if (enrolled) {
      disabledSection?.classList.add("hidden");
      enabledSection?.classList.remove("hidden");
      if (badge) { badge.textContent = "Enabled"; badge.className = "recipe-status-badge published"; }
    } else {
      disabledSection?.classList.remove("hidden");
      enabledSection?.classList.add("hidden");
      if (badge) { badge.textContent = "Disabled"; badge.className = "recipe-status-badge pending"; }
    }
  } catch (err) {
    console.warn("2FA status:", err.message);
  }
}

document.getElementById("enableTwoFaBtn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const btn = document.getElementById("enableTwoFaBtn");
  const msg = document.getElementById("twoFaMessage");
  btn.disabled = true; btn.textContent = "Setting up...";

  try {
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      if (msg) {
        msg.style.color = "var(--primary)";
        msg.textContent = "Verification email sent! Check your inbox, verify your email, then try again.";
      }
      btn.disabled = false; btn.textContent = "Enable 2FA";
      return;
    }

    const session = await multiFactor(user).getSession();
    const secret  = await TotpMultiFactorGenerator.generateSecret(session);
    pendingTotpSecret = secret;

    const qrUrl = secret.generateQrCodeUrl(user.email, "Cookly");
    const qrImg = document.getElementById("twoFaQr");
    const keyEl = document.getElementById("twoFaSecretKey");
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`;
    if (keyEl) keyEl.textContent = secret.secretKey;

    document.getElementById("twoFaDisabled")?.classList.add("hidden");
    document.getElementById("twoFaSetup")?.classList.remove("hidden");
    document.getElementById("twoFaCode")?.focus();
  } catch (err) {
    if (msg) {
      msg.style.color = "var(--accent)";
      msg.textContent = err.code === "auth/requires-recent-login"
        ? "Please sign out and sign back in, then try again."
        : `Error: ${err.message}`;
    }
  } finally {
    btn.disabled = false; btn.textContent = "Enable 2FA";
  }
});

document.getElementById("cancelTwoFaBtn")?.addEventListener("click", () => {
  pendingTotpSecret = null;
  document.getElementById("twoFaSetup")?.classList.add("hidden");
  document.getElementById("twoFaDisabled")?.classList.remove("hidden");
  const msg = document.getElementById("twoFaMessage");
  if (msg) msg.textContent = "";
});

document.getElementById("verifyTwoFaBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("twoFaCode")?.value.trim();
  const msg  = document.getElementById("twoFaMessage");
  const btn  = document.getElementById("verifyTwoFaBtn");

  if (!code || code.length !== 6) {
    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = "Enter the 6-digit code from your app."; }
    return;
  }
  if (!pendingTotpSecret) {
    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = "Session expired. Please start over."; }
    return;
  }

  btn.disabled = true; btn.textContent = "Verifying...";
  try {
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(pendingTotpSecret, code);
    await multiFactor(auth.currentUser).enroll(assertion, "Cookly Authenticator");
    pendingTotpSecret = null;
    if (msg) msg.textContent = "";
    loadTwoFaStatus(auth.currentUser);
  } catch (err) {
    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = "Invalid code. Check your app and try again."; }
  } finally {
    btn.disabled = false; btn.textContent = "Verify & Enable";
  }
});

document.getElementById("disableTwoFaBtn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const btn = document.getElementById("disableTwoFaBtn");
  const msg = document.getElementById("twoFaMessage");
  btn.disabled = true; btn.textContent = "Disabling...";

  try {
    const factor = multiFactor(user).enrolledFactors.find(f => f.factorId === "totp");
    if (factor) await multiFactor(user).unenroll(factor);
    if (msg) msg.textContent = "";
    loadTwoFaStatus(user);
  } catch (err) {
    if (msg) { msg.style.color = "var(--accent)"; msg.textContent = `Failed: ${err.message}`; }
  } finally {
    btn.disabled = false; btn.textContent = "Disable 2FA";
  }
});

/* ── Sign out ── */
signOutBtn?.addEventListener("click", async () => {
  try { await signOut(auth); } catch {}
  localStorage.removeItem("userName");
  localStorage.removeItem("loggedInUser");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("loggedInUser");
  window.location.href = "../Cookly.html";
});

/* ── Boot ── */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "Login.html";
    return;
  }
  console.log("Logged in as:", user.email); // Check this matches ADMIN_EMAIL
  loadProfile(user).catch((err) => console.error("loadProfile error:", err));
});
