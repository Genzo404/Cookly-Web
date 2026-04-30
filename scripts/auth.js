import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCvCaNzHTh3UqIpD_41bHLU1s5n6ikFh8",
  authDomain: "cookly-e712f.firebaseapp.com",
  projectId: "cookly-e712f",
  storageBucket: "cookly-e712f.firebasestorage.app",
  messagingSenderId: "997020620472",
  appId: "1:997020620472:web:0079ce8ac214cb5af3864d",
  measurementId: "G-PW4N8P0RQZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const messageEl =
  document.getElementById("message") ||
  document.getElementById("formMessage") ||
  document.getElementById("loginError");

function setMessage(text, ok = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = ok ? "#1e7e34" : "#c0392b";
}

// LOGIN
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (document.getElementById("email")?.value || "").trim();
    const password = document.getElementById("password")?.value || "";

    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const name = user.displayName || user.email?.split("@")[0] || "User";

      localStorage.setItem("userName", name);
      localStorage.setItem("loggedInUser", name);

      setMessage("Login successful.", true);
      window.location.href = "../Cookly.html";
    } catch (err) {
      console.error(err);
      setMessage("Invalid email or password.");
    }
  });
}

// REGISTER
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name =
      (document.getElementById("name")?.value ||
        document.getElementById("username")?.value ||
        document.getElementById("fullName")?.value ||
        "").trim();

    const email =
      (document.getElementById("email")?.value ||
        document.getElementById("registerEmail")?.value ||
        "").trim();

    const password =
      document.getElementById("password")?.value ||
      document.getElementById("registerPassword")?.value ||
      "";

    const confirmPassword =
      document.getElementById("confirmPassword")?.value ||
      document.getElementById("confirm")?.value ||
      "";

    if (!name || !email || !password) {
      setMessage("Please fill all required fields.");
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      localStorage.setItem("userName", name);
      localStorage.setItem("loggedInUser", name);

      setMessage("Account created successfully.", true);
      window.location.href = "../Cookly.html";
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setMessage("Email is already in use.");
      } else if (err.code === "auth/weak-password") {
        setMessage("Password should be at least 6 characters.");
      } else {
        setMessage("Registration failed.");
      }
    }
  });
}