// =====================================================================
// ACCOUNT TAB: sign in with Google or Facebook (via Firebase Authentication)
//
// Firebase does the hard OAuth work: it opens the Google / Facebook login
// popup, checks the result, and remembers the user between visits.
// =====================================================================
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const $ = (id) => document.getElementById(id);
const googleBtn = $("googleBtn");
const facebookBtn = $("facebookBtn");
const authError = $("authError");

$("authNote").classList.add("hidden");   // the module loaded, so hide the "loading…" hint

// Friendly messages for the most common errors
const AUTH_ERRORS = {
  "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
  "auth/cancelled-popup-request": "The sign-in window was closed before finishing.",
  "auth/account-exists-with-different-credential":
    "You already signed up with this email using a different provider. Use that one instead.",
  "auth/operation-not-allowed":
    "This sign-in method isn't enabled yet. Turn it on in Firebase → Authentication → Sign-in method.",
  "auth/unauthorized-domain":
    "This website address isn't allowed. Add it in Firebase → Authentication → Settings → Authorized domains.",
  "auth/invalid-api-key": "The Firebase config is wrong. Check firebase-config.js.",
  "auth/network-request-failed": "Network error. Check your internet connection.",
};

function showError(err) {
  authError.textContent = "⚠️ " + (AUTH_ERRORS[err.code] || err.message);
}

// No config yet -> explain how to set it up and stop here
if (!firebaseConfig.apiKey) {
  $("setupNotice").classList.remove("hidden");
  throw new Error("Firebase is not configured yet — see firebase-config.js");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
googleBtn.disabled = false;
facebookBtn.disabled = false;

async function signInWith(provider, button) {
  authError.textContent = "";
  button.disabled = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Some browsers block popups -> use a full-page redirect instead
    if (err.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider).catch(showError);
      return;
    }
    showError(err);
  } finally {
    button.disabled = false;
  }
}

googleBtn.addEventListener("click", () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });  // always let user pick an account
  signInWith(provider, googleBtn);
});

facebookBtn.addEventListener("click", () => {
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  signInWith(provider, facebookBtn);
});

$("signOutBtn").addEventListener("click", () => signOut(auth));

// Finish a redirect sign-in (only used when the popup was blocked)
getRedirectResult(auth).catch(showError);

// ---------- Show the right screen whenever the user signs in or out ----------
const PROVIDER_NAMES = { "google.com": "Google", "facebook.com": "Facebook" };

function initials(name) {
  return (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

onAuthStateChanged(auth, (user) => {
  $("signedOut").classList.toggle("hidden", !!user);
  $("signedIn").classList.toggle("hidden", !user);

  $("menuBtn").classList.toggle("signed-in", !!user);   // green dot on ☰
  if (!user) return;

  const name = user.displayName || "Math lover";
  const providerId = user.providerData[0]?.providerId;
  window.suggestName?.(user.displayName);   // fill "Your name" if it's empty
  $("userName").textContent = name;
  $("userEmail").textContent = user.email || "No email shared";
  $("userProvider").textContent = "Signed in with " + (PROVIDER_NAMES[providerId] || providerId);
  $("userProvider").dataset.provider = providerId;
  $("userSince").textContent =
    "Member since " + new Date(user.metadata.creationTime).toLocaleDateString();

  // Profile photo, or coloured initials if there's no photo / it fails to load
  const photo = $("userPhoto");
  const fallback = $("userInitials");
  fallback.textContent = initials(name);
  const showInitials = () => {
    photo.classList.add("hidden");
    fallback.classList.remove("hidden");
  };
  if (user.photoURL) {
    photo.classList.remove("hidden");
    fallback.classList.add("hidden");
    photo.onerror = showInitials;
    photo.src = user.photoURL;
  } else {
    showInitials();
  }
});
