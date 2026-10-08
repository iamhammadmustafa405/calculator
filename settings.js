// =====================================================================
// SETTINGS (in the ☰ side menu): your name + colour theme
//
// Both are saved in localStorage, a small storage space inside your
// browser, so they're remembered the next time you open the page.
// =====================================================================

// localStorage can be blocked (e.g. private windows), so wrap it safely
function loadSetting(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

// ---------- Your name ----------
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const nameSaved = document.getElementById("nameSaved");
const greeting = document.getElementById("greeting");

function showName(name) {
  greeting.textContent = name ? `Hi, ${name} 👋` : "";
  nameInput.value = name || "";
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();                      // stop the form from reloading the page
  const name = nameInput.value.trim();
  saveSetting("calc-name", name);
  showName(name);
  nameSaved.textContent = name ? "✔ Saved!" : "Name removed.";
  setTimeout(() => (nameSaved.textContent = ""), 2500);
});

// Called by auth.js after Google sign-in: use your first name if you haven't typed one
window.suggestName = (fullName) => {
  if (loadSetting("calc-name") || !fullName) return;
  const first = fullName.split(" ")[0];
  saveSetting("calc-name", first);
  showName(first);
};

showName(loadSetting("calc-name"));

// ---------- Theme ----------
const themeButtons = document.querySelectorAll(".theme-choice");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;   // <html data-theme="blue">
  themeButtons.forEach((b) => b.classList.toggle("active", b.dataset.themeChoice === theme));
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeChoice;
    applyTheme(theme);
    saveSetting("calc-theme", theme);
  });
});

applyTheme(loadSetting("calc-theme") || "black");
