import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from "./firebase.js";

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

const redirectAfterLogin = new URLSearchParams(window.location.search).get("redirect");
function getLoginRedirect() {
  return redirectAfterLogin || "../Cookly.html";
}

// GOOGLE SIGN-IN
const googleBtn = document.getElementById("googleSignInBtn");

googleBtn?.addEventListener("click", async () => {
  googleBtn.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const user  = cred.user;
    const name  = user.displayName || user.email?.split("@")[0] || "User";
    localStorage.setItem("userName", name);
    localStorage.setItem("loggedInUser", name);
    window.location.href = getLoginRedirect();
  } catch (err) {
    if (err.code === "auth/multi-factor-auth-required") {
      mfaResolver = getMultiFactorResolver(auth, err);
      loginForm?.classList.add("hidden");
      mfaForm?.classList.remove("hidden");
    } else if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
      console.error("Google sign-in error:", err.code);
      setMessage("Google sign-in failed. Please try again.");
    }
  } finally {
    googleBtn.disabled = false;
  }
});

// MFA CHALLENGE
let mfaResolver = null;

const mfaForm      = document.getElementById("mfaForm");
const mfaSubmitBtn = document.getElementById("mfaSubmitBtn");
const mfaBackBtn   = document.getElementById("mfaBackBtn");

mfaBackBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  mfaResolver = null;
  mfaForm?.classList.add("hidden");
  loginForm?.classList.remove("hidden");
  if (messageEl) messageEl.textContent = "";
});

mfaSubmitBtn?.addEventListener("click", async () => {
  const code = (document.getElementById("mfaCode")?.value || "").trim();
  if (!code || !mfaResolver) return;

  mfaSubmitBtn.disabled = true;
  try {
    const hint      = mfaResolver.hints[0];
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
    const cred      = await mfaResolver.resolveSignIn(assertion);
    const user      = cred.user;
    const name      = user.displayName || user.email?.split("@")[0] || "User";
    localStorage.setItem("userName", name);
    localStorage.setItem("loggedInUser", name);
    setMessage("Login successful.", true);
    window.location.href = getLoginRedirect();
  } catch (err) {
    setMessage("Invalid code. Please try again.");
  } finally {
    mfaSubmitBtn.disabled = false;
  }
});

// FORGOT PASSWORD
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotForm         = document.getElementById("forgotForm");
const sendResetBtn       = document.getElementById("sendResetBtn");
const backToLogin        = document.getElementById("backToLogin");
const resetEmailInput    = document.getElementById("resetEmail");

forgotPasswordLink?.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  forgotForm.classList.remove("hidden");
  if (messageEl) messageEl.textContent = "";
});

backToLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  forgotForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  if (messageEl) messageEl.textContent = "";
});

sendResetBtn?.addEventListener("click", async () => {
  const email = (resetEmailInput?.value || "").trim();
  if (!email) {
    setMessage("Please enter your email.");
    return;
  }

  sendResetBtn.disabled = true;
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage("Reset link sent! Check your inbox.", true);
    resetEmailInput.value = "";
  } catch (err) {
    setMessage("No account found with that email.");
  } finally {
    sendResetBtn.disabled = false;
  }
});

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
      window.location.href = getLoginRedirect();
    } catch (err) {
      if (err.code === "auth/multi-factor-auth-required") {
        mfaResolver = getMultiFactorResolver(auth, err);
        loginForm?.classList.add("hidden");
        mfaForm?.classList.remove("hidden");
        setMessage("");
      } else {
        console.error(err);
        setMessage("Invalid email or password.");
      }
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
      await sendEmailVerification(cred.user);

      localStorage.setItem("userName", name);
      localStorage.setItem("loggedInUser", name);

      setMessage("Account created! We sent a verification link to " + email + ". Please check your inbox before continuing.", true);
      setTimeout(() => { window.location.href = getLoginRedirect(); }, 4000);
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