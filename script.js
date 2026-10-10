// JavaScript = how the page BEHAVES
//
// Libraries used (loaded in index.html):
//   math.js  -> evaluates expressions like "sin(30) + 2^3"
//   nerdamer -> symbolic calculus: derivatives & integrals
//   KaTeX    -> draws formulas like a textbook

// Stop early if the libraries didn't load (e.g. no internet)
if (typeof math === "undefined" || typeof nerdamer === "undefined" || typeof katex === "undefined") {
  document.getElementById("offline").classList.remove("hidden");
}

// =====================================================================
// 1. FLOATING MATH SYMBOLS BACKGROUND
// =====================================================================
const SYMBOLS = [
  "∫", "∑", "π", "√", "∞", "θ", "Δ", "∂", "λ", "Ω", "α", "β", "μ", "σ", "φ",
  "≈", "≠", "≤", "±", "÷", "×", "∇", "∮", "∏", "eˣ", "x²", "sin θ", "cos θ",
  "tan θ", "log", "dy/dx", "f(x)", "lim", "n!", "a²+b²=c²", "E=mc²", "∫f(x)dx",
  "e^(iπ)+1=0", "√2", "x⁻¹",
];
function random(min, max) {
  return min + Math.random() * (max - min);
}

// Symbols use one soft theme colour (set in style.css), so the background stays calm
function createBackground() {
  const bg = document.getElementById("bg");
  for (let i = 0; i < 30; i++) {
    const s = document.createElement("span");
    const duration = random(30, 60);
    s.className = "symbol";
    s.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    s.style.left = random(-5, 100) + "%";
    s.style.fontSize = random(18, 52) + "px";
    s.style.animationDuration = duration + "s";
    s.style.animationDelay = -random(0, duration) + "s"; // negative = already mid-flight
    s.style.setProperty("--drift", random(-120, 120) + "px");
    s.style.setProperty("--spin", random(-360, 360) + "deg");
    bg.appendChild(s);
  }
}
createBackground();

// =====================================================================
// 2. TABS
// =====================================================================
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    panels.forEach((p) => p.classList.toggle("active", p.id === tab.dataset.panel));
  });
});

// Side menu: adding "menu-open" to <body> slides it in (see style.css)
function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  document.getElementById("drawer").setAttribute("aria-hidden", String(!open));
}

document.getElementById("menuBtn").addEventListener("click", () => setMenu(true));
document.getElementById("drawerClose").addEventListener("click", () => setMenu(false));
document.getElementById("drawerOverlay").addEventListener("click", () => setMenu(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
    setMenu(false);
    e.stopImmediatePropagation();   // don't let Esc also clear the calculator
  }
});

// =====================================================================
// 3. SCIENTIFIC CALCULATOR
// =====================================================================
const historyEl = document.getElementById("history");
const expressionEl = document.getElementById("expression");
const previewEl = document.getElementById("preview");
const degBtn = document.getElementById("degBtn");
const invBtn = document.getElementById("invBtn");

// State
// Each token has:  v = what math.js evaluates,  d = what the user sees
let tokens = [];
let cursor = 0;         // position of the blinking cursor inside tokens
let ans = 0;
let degMode = true;     // angles in degrees (true) or radians (false)
let invMode = false;    // INV turns sin -> sin⁻¹, log -> 10ˣ, etc.
let justEvaluated = false;

// What each button inserts. "inv" is used when INV is on.
const KEYS = {
  sin:    { v: "sin(",  d: "sin(",  inv: { v: "asin(", d: "sin⁻¹(", label: "sin⁻¹" } },
  cos:    { v: "cos(",  d: "cos(",  inv: { v: "acos(", d: "cos⁻¹(", label: "cos⁻¹" } },
  tan:    { v: "tan(",  d: "tan(",  inv: { v: "atan(", d: "tan⁻¹(", label: "tan⁻¹" } },
  log:    { v: "log(",  d: "log(",  inv: { v: "10^(",  d: "10^(",   label: "10ˣ" } },
  ln:     { v: "ln(",   d: "ln(",   inv: { v: "e^(",   d: "e^(",    label: "eˣ" } },
  sqrt:   { v: "sqrt(", d: "√(",    inv: { v: "cbrt(", d: "∛(",     label: "∛" } },
  square: { v: "^2",    d: "²",     inv: { v: "^3",    d: "³",      label: "x³" } },
  abs:    { v: "abs(",  d: "abs(" },
  reciprocal: { v: "^(-1)", d: "⁻¹" },
  mod:    { v: " mod ", d: " mod " },
  exp:    { v: "*10^",  d: "×10^" },
  pow:    { v: "^",     d: "^" },
  fact:   { v: "!",     d: "!" },
  pi:     { v: "pi",    d: "π" },
  e:      { v: "e",     d: "e" },
  ans:    { v: "Ans",   d: "Ans" },
  "(":    { v: "(",     d: "(" },
  ")":    { v: ")",     d: ")" },
  "+":    { v: "+",     d: "+" },
  "-":    { v: "-",     d: "−" },
  "*":    { v: "*",     d: "×" },
  "/":    { v: "/",     d: "÷" },
  "%":    { v: "%",     d: "%" },
  ".":    { v: ".",     d: "." },
};
for (let i = 0; i <= 9; i++) KEYS[i] = { v: String(i), d: String(i) };

// Remember the normal label of INV-able buttons so we can switch back
document.querySelectorAll(".inv-able").forEach((btn) => {
  btn.dataset.label = btn.textContent;
});

// Custom functions: degree support + log = base 10, ln = natural log
function makeScope() {
  const toRad = (x) => (degMode ? (x * Math.PI) / 180 : x);
  const fromRad = (x) => (degMode ? (x * 180) / Math.PI : x);
  return {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(x)),
    acos: (x) => fromRad(Math.acos(x)),
    atan: (x) => fromRad(Math.atan(x)),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    Ans: ans,
  };
}

function countChar(str, ch) {
  return str.split(ch).length - 1;
}

function evaluateTokens() {
  let expr = tokens.map((t) => t.v).join("").replace(/%/g, "/100");
  // Auto-close brackets: "sin(30" -> "sin(30)"
  expr += ")".repeat(Math.max(0, countChar(expr, "(") - countChar(expr, ")")));
  return math.evaluate(expr, makeScope());
}

function formatResult(r) {
  if (typeof r === "number") {
    if (isNaN(r)) return "Error";
    if (!isFinite(r)) return r > 0 ? "∞" : "−∞";
    // toPrecision(12) hides tiny float errors like sin(180°) = 1.2e-16
    const clean = parseFloat(r.toPrecision(12));
    return String(Math.abs(clean) < 1e-12 ? 0 : clean);
  }
  return math.format(r, { precision: 12 }); // complex numbers etc.
}

function updateInvLabels() {
  invBtn.classList.toggle("on", invMode);
  document.querySelectorAll(".inv-able").forEach((btn) => {
    const def = KEYS[btn.dataset.key];
    btn.textContent = invMode ? def.inv.label : btn.dataset.label;
  });
}

function render() {
  if (!tokens.length) {
    expressionEl.textContent = "0";
  } else if (justEvaluated) {
    expressionEl.textContent = tokens.map((t) => t.d).join("");
  } else {
    // text before cursor + blinking caret + text after cursor
    const caret = document.createElement("span");
    caret.className = "caret";
    expressionEl.replaceChildren(
      tokens.slice(0, cursor).map((t) => t.d).join(""),
      caret,
      tokens.slice(cursor).map((t) => t.d).join("")
    );
  }
  degBtn.textContent = degMode ? "DEG" : "RAD";

  // Live preview of the answer while typing
  previewEl.textContent = "";
  if (!justEvaluated && tokens.length) {
    try {
      const text = formatResult(evaluateTokens());
      if (text !== "Error") previewEl.textContent = "= " + text;
    } catch {
      // incomplete expression like "5 +" -> show nothing
    }
  }
}

// History list (right side on wide screens). Click an item to reuse its answer.
const historyList = document.getElementById("historyList");

function addToHistory(shown, text, value) {
  historyList.querySelector(".history-empty")?.remove();
  const item = document.createElement("button");
  item.className = "history-item";
  item.title = "Click to use this answer";
  item.innerHTML = `<span class="history-q"></span><span class="history-a"></span>`;
  item.querySelector(".history-q").textContent = shown + " =";
  item.querySelector(".history-a").textContent = text;
  item.addEventListener("click", () => {
    ans = value;
    tokens = [{ v: "Ans", d: text }];
    cursor = tokens.length;
    justEvaluated = true;
    render();
  });
  historyList.prepend(item);                                        // newest on top
  while (historyList.children.length > 30) historyList.lastChild.remove();
}

document.getElementById("clearHistory").addEventListener("click", () => {
  historyList.innerHTML = `<p class="history-empty">Your calculations will appear here.</p>`;
});

function equals() {
  if (!tokens.length) return;
  const shown = tokens.map((t) => t.d).join("");
  try {
    const r = evaluateTokens();
    const text = formatResult(r);
    if (text === "Error") throw new Error();
    historyEl.textContent = shown + " =";
    ans = r;
    tokens = [{ v: "Ans", d: text }]; // result can be used in the next calculation
    addToHistory(shown, text, r);
  } catch {
    historyEl.textContent = shown;
    tokens = [{ v: "", d: "Error" }];
  }
  cursor = tokens.length;
  justEvaluated = true;
}

// Insert a token at the cursor. Anything ending in "(" gets its ")" too.
function insertToken(item) {
  tokens.splice(cursor, 0, { v: item.v, d: item.d });
  cursor++;
  if (item.v.endsWith("(")) tokens.splice(cursor, 0, { v: ")", d: ")" });
}

function deleteBeforeCursor() {
  if (cursor === 0) return;
  const removed = tokens[cursor - 1];
  const next = tokens[cursor];
  // Deleting "sin(" right before its ")" removes the whole empty pair
  if (removed.v.endsWith("(") && next && next.v === ")") tokens.splice(cursor, 1);
  tokens.splice(cursor - 1, 1);
  cursor--;
}

function press(key) {
  if (key === "clear") {
    tokens = [];
    cursor = 0;
    historyEl.textContent = "";
    justEvaluated = false;
  } else if (key === "del") {
    if (justEvaluated) { tokens = []; cursor = 0; }
    else deleteBeforeCursor();
    justEvaluated = false;
  } else if (key === "left" || key === "right") {
    justEvaluated = false;
    cursor = Math.min(tokens.length, Math.max(0, cursor + (key === "left" ? -1 : 1)));
  } else if (key === ")" && tokens[cursor] && tokens[cursor].v === ")" && !justEvaluated) {
    cursor++;   // ")" just steps over an existing closing bracket
  } else if (key === "equals") {
    equals();
  } else if (key === "deg") {
    degMode = !degMode;
  } else if (key === "inv") {
    invMode = !invMode;
    updateInvLabels();
  } else {
    const def = KEYS[key];
    if (!def) return;
    const item = invMode && def.inv ? def.inv : def;

    // After "=", an operator continues with the answer, anything else starts fresh
    if (justEvaluated) {
      const continues = /^([+\-*/^%!]| mod )/.test(item.v) && tokens[0].d !== "Error";
      if (!continues) tokens = [];
      cursor = tokens.length;
      justEvaluated = false;
    }
    insertToken(item);

    if (invMode && def.inv) {   // INV works for one press, like a real calculator
      invMode = false;
      updateInvLabels();
    }
  }
  render();
}

document.querySelectorAll(".btn").forEach((btn) => {
  btn.addEventListener("click", () => press(btn.dataset.key));
});

// Keyboard support (only on the Scientific tab, not while typing in an input)
document.addEventListener("keydown", (e) => {
  const scientificActive = document.getElementById("scientific").classList.contains("active");
  const menuOpen = document.body.classList.contains("menu-open");
  if (!scientificActive || menuOpen || e.target.tagName === "INPUT") return;

  if (/^[0-9.+\-*/^()%!]$/.test(e.key)) press(e.key);
  else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); press("equals"); }
  else if (e.key === "Backspace") press("del");
  else if (e.key === "ArrowLeft") press("left");
  else if (e.key === "ArrowRight") press("right");
  else if (e.key === "Escape") press("clear");
});

render();

// =====================================================================
// 4. CALCULUS: DERIVATIVES & INTEGRALS
// =====================================================================
const fnInput = document.getElementById("fnInput");
const fnPreview = document.getElementById("fnPreview");
const orderSelect = document.getElementById("order");
const lowerInput = document.getElementById("lowerInput");
const upperInput = document.getElementById("upperInput");
const calcResult = document.getElementById("calcResult");
const calcNote = document.getElementById("calcNote");

// Clean up what the user typed into a form both libraries understand.
// Returns { text, node } where node is the math.js expression tree.
// vars: the letters allowed as variables (the Live graph tab also allows t for time)
function parseFunction(input, vars = ["x"]) {
  const raw = input.trim()
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/\bln\s*\(/g, "log(");   // ln -> log (both libraries use log = natural log)
  if (!raw) throw new Error("Type a function of x first.");

  let node;
  try {
    node = math.parse(raw);
  } catch {
    throw new Error("That doesn't look like a valid function. Check the brackets and operators.");
  }

  // Only allow the variables (plus the constants e and pi)
  node.traverse((n, path, parent) => {
    const isFunctionName = parent && parent.isFunctionNode && path === "fn";
    if (n.isSymbolNode && !isFunctionName && ![...vars, "e", "pi"].includes(n.name)) {
      const use = vars.length > 1 ? vars.join(" and ") + " as the variables" : vars[0] + " as the variable";
      throw new Error(`Unknown symbol "${n.name}". Use ${use}.`);
    }
  });

  // implicit: "show" turns "2x" into "2 * x" so nerdamer reads it correctly
  return { text: node.toString({ implicit: "show" }), node };
}

// Make nerdamer's LaTeX show natural log as "ln"
function fixTex(tex) {
  return tex.replace(/\\mathrm\{log\}/g, "\\ln").replace(/\\log(?![_a-zA-Z])/g, "\\ln");
}

function texOf(expression) {
  return fixTex(nerdamer(expression).toTeX());
}

function showResult(tex, note, isError = false) {
  calcResult.innerHTML = "";
  // Inline mode lets long formulas wrap onto the next line;
  // \displaystyle keeps the big ∫ and fractions
  if (tex) katex.render("\\displaystyle " + tex, calcResult, { throwOnError: false });
  calcNote.textContent = note.replace(/\blog\(/g, "ln(");
  calcNote.classList.toggle("error", isError);
}

function showError(err) {
  showResult("", "⚠️ " + err.message, true);
}

// Pick the shorter of the raw and simplified answers
function simplest(expr) {
  try {
    const simplified = nerdamer(`simplify(${expr})`).toString();
    return simplified.length < expr.length ? simplified : expr;
  } catch {
    return expr;
  }
}

function differentiate() {
  try {
    const f = parseFunction(fnInput.value).text;
    const n = orderSelect.value;
    const result = simplest(nerdamer(`diff(${f}, x, ${n})`).toString());

    const op = n === "1" ? "\\frac{d}{dx}" : `\\frac{d^{${n}}}{dx^{${n}}}`;
    const names = { 1: "f'(x)", 2: "f''(x)", 3: "f'''(x)" };
    showResult(
      `${op}\\left[${texOf(f)}\\right] = ${texOf(result)}`,
      `${names[n]} = ${result}`
    );
  } catch (err) {
    showError(err);
  }
}

// Returns the antiderivative as a string, or null if nerdamer can't find one
function antiderivative(f) {
  const result = nerdamer(`integrate(${f}, x)`).toString();
  return result.includes("integrate") ? null : simplest(result);
}

function integrate() {
  try {
    const f = parseFunction(fnInput.value).text;
    const F = antiderivative(f);
    if (!F) {
      showResult(
        `\\int ${texOf(f)}\\,dx`,
        "No closed-form answer found. Some functions (like e^(x^2)) have none — try a definite integral for a numeric answer.",
        true
      );
      return;
    }
    showResult(`\\int ${texOf(f)}\\,dx = ${texOf(F)} + C`, `F(x) = ${F} + C`);
  } catch (err) {
    showError(err);
  }
}

// Simpson's rule: approximates the area under a curve very accurately
function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

function parseLimit(input, name) {
  const raw = input.trim().replace(/π/g, "pi");
  try {
    const value = math.evaluate(raw);
    if (typeof value !== "number" || !isFinite(value)) throw new Error();
    return { value, tex: math.parse(raw).toTex() };
  } catch {
    throw new Error(`Limit ${name} must be a number (like 0, 2.5 or pi/2).`);
  }
}

function definiteIntegral() {
  try {
    const { text: f, node } = parseFunction(fnInput.value);
    const a = parseLimit(lowerInput.value, "a");
    const b = parseLimit(upperInput.value, "b");

    // Numeric value (always works if f is defined on [a, b])
    const compiled = node.compile();
    const fx = (x) => {
      const y = compiled.evaluate({ x });
      if (typeof y !== "number" || !isFinite(y)) {
        throw new Error("f(x) is undefined or infinite somewhere between a and b.");
      }
      return y;
    };
    const value = formatResult(simpson(fx, a.value, b.value));

    // Also show the exact antiderivative if one exists
    const F = antiderivative(f);
    const lhs = `\\int_{${a.tex}}^{${b.tex}} ${texOf(f)}\\,dx`;
    const middle = F ? ` = \\Big[${texOf(F)}\\Big]_{${a.tex}}^{${b.tex}}` : "";
    showResult(`${lhs}${middle} \\approx ${value}`, `Area under f(x) from a to b ≈ ${value}`);
  } catch (err) {
    showError(err);
  }
}

// Live preview of the function as you type
function updateFnPreview() {
  fnPreview.innerHTML = "";
  if (!fnInput.value.trim()) return;
  try {
    const { node } = parseFunction(fnInput.value);
    katex.render("f(x) = " + node.toTex(), fnPreview, { throwOnError: false });
  } catch {
    fnPreview.textContent = "…";
  }
}

// Insert text at the cursor. "sin(" becomes "sin()" with the cursor inside;
// if text is selected, it gets wrapped: x^2 -> sin(x^2)
function insertAtCursor(text) {
  const start = fnInput.selectionStart;
  const end = fnInput.selectionEnd;
  const selected = fnInput.value.slice(start, end);
  const pairs = text.endsWith("(");
  const inserted = pairs ? text + selected + ")" : text;

  fnInput.value = fnInput.value.slice(0, start) + inserted + fnInput.value.slice(end);
  fnInput.focus();
  const pos = pairs ? start + text.length + selected.length : start + inserted.length;
  fnInput.selectionStart = fnInput.selectionEnd = pos;
  updateFnPreview();
}

document.getElementById("diffBtn").addEventListener("click", differentiate);
document.getElementById("intBtn").addEventListener("click", integrate);
document.getElementById("defIntBtn").addEventListener("click", definiteIntegral);
fnInput.addEventListener("input", updateFnPreview);
fnInput.addEventListener("keydown", (e) => {
  const pos = fnInput.selectionStart;
  const noSelection = pos === fnInput.selectionEnd;
  const before = fnInput.value[pos - 1];
  const after = fnInput.value[pos];

  if (e.key === "Enter") {
    differentiate();
  } else if (e.key === "(") {
    e.preventDefault();
    insertAtCursor("(");                       // types "()" with cursor inside
  } else if (e.key === ")" && noSelection && after === ")") {
    e.preventDefault();
    fnInput.selectionStart = fnInput.selectionEnd = pos + 1;   // step over ")"
  } else if (e.key === "Backspace" && noSelection && before === "(" && after === ")") {
    e.preventDefault();                        // delete the empty "()" pair
    fnInput.value = fnInput.value.slice(0, pos - 1) + fnInput.value.slice(pos + 1);
    fnInput.selectionStart = fnInput.selectionEnd = pos - 1;
    updateFnPreview();
  }
});

document.querySelectorAll(".chip[data-insert]").forEach((chip) => {
  chip.addEventListener("click", () => insertAtCursor(chip.dataset.insert));
});

document.querySelectorAll(".example").forEach((ex) => {
  ex.addEventListener("click", () => {
    fnInput.value = ex.textContent;
    updateFnPreview();
    differentiate();
  });
});
