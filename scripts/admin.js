import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// Your admin email — only this account can access the page
const ADMIN_EMAIL = "total_carnage24@yahoo.com";

const adminStatus = document.getElementById("adminStatus");
const pendingGrid = document.getElementById("pendingGrid");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "Login.html";
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    adminStatus.textContent = "Access denied.";
    return;
  }
  loadPendingReviews();
});

async function loadPendingReviews() {
  adminStatus.textContent = "Loading...";
  try {
    const snap = await getDocs(collection(db, "pending_reviews"));
    pendingGrid.innerHTML = "";

    if (snap.empty) {
      adminStatus.textContent = "No pending recipes to review. You're all caught up!";
      return;
    }

    adminStatus.textContent = "";
    snap.forEach((d) => pendingGrid.appendChild(buildPendingCard(d.id, d.data())));
  } catch (err) {
    console.error("loadPendingReviews error:", err);
    adminStatus.textContent = "Failed to load recipes to review.";
  }
}

function buildPendingCard(pendingId, data) {
  const card = document.createElement("div");
  card.className = "pending-card";
  const img = data.imageURL || "https://via.placeholder.com/300x160?text=No+Image";
  const desc = data.description || "";

  card.innerHTML = `
    <img src="${img}" alt="${data.name || "Recipe"}" onerror="this.src='https://via.placeholder.com/300x160?text=No+Image'" />
    <div class="pending-card-body">
      <h3>${data.name || "Untitled"}</h3>
      <p class="pending-meta">By ${data.ownerName || "Unknown"} · ${data.category || "General"}</p>
      <p class="pending-desc">${desc.slice(0, 120)}${desc.length > 120 ? "..." : ""}</p>
      <div class="pending-card-actions">
        <button class="btn btn-primary btn-sm approve-btn">Approve</button>
        <button class="btn btn-outline btn-sm reject-btn">Reject</button>
      </div>
      <p class="action-msg"></p>
    </div>
  `;

  card.querySelector(".approve-btn").addEventListener("click", () => handleApprove(pendingId, data, card));
  card.querySelector(".reject-btn").addEventListener("click", () => handleReject(pendingId, data, card));

  return card;
}

async function handleApprove(pendingId, data, cardEl) {
  const approveBtn = cardEl.querySelector(".approve-btn");
  const rejectBtn  = cardEl.querySelector(".reject-btn");
  const msg        = cardEl.querySelector(".action-msg");

  approveBtn.disabled = true;
  rejectBtn.disabled  = true;
  msg.textContent     = "Approving...";

  try {
    const { id: _ignored, uid, recipeId, ownerName, submittedAt, status: _s, ...recipeData } = data;

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

    msg.style.color = "green";
    msg.textContent = "Approved!";
    cardEl.style.opacity = "0.5";
    setTimeout(() => cardEl.remove(), 1200);
  } catch (err) {
    console.error("Approve error:", err);
    msg.style.color = "var(--accent)";
    msg.textContent = `Error: ${err.message}`;
    approveBtn.disabled = false;
    rejectBtn.disabled  = false;
  }
}

async function handleReject(pendingId, data, cardEl) {
  const approveBtn = cardEl.querySelector(".approve-btn");
  const rejectBtn  = cardEl.querySelector(".reject-btn");
  const msg        = cardEl.querySelector(".action-msg");

  approveBtn.disabled = true;
  rejectBtn.disabled  = true;
  msg.textContent     = "Rejecting...";

  try {
    await updateDoc(doc(db, "users", data.uid, "recipes_created", data.recipeId), { status: "private" });
    await deleteDoc(doc(db, "pending_reviews", pendingId));

    msg.style.color = "var(--accent)";
    msg.textContent = "Rejected.";
    cardEl.style.opacity = "0.5";
    setTimeout(() => cardEl.remove(), 1200);
  } catch (err) {
    console.error("Reject error:", err);
    msg.style.color = "var(--accent)";
    msg.textContent = `Error: ${err.message}`;
    approveBtn.disabled = false;
    rejectBtn.disabled  = false;
  }
}
