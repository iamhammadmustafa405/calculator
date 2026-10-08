// =====================================================================
// INPUT TOOLS: 🎤 voice, 📷 image (OCR), ✍️ handwriting
//
//   Voice  -> the browser's built-in SpeechRecognition (Chrome / Edge)
//   Images -> Tesseract.js reads text from a picture (OCR)
//   Draw   -> a <canvas> you write on, then Tesseract reads it
// =====================================================================

// ---------- Toast: small message at the bottom of the screen ----------
const toastEl = document.getElementById("toast");
let toastTimer;

function toast(message, isError = false, ms = 4000) {
  toastEl.textContent = message;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function activeTab() {
  return document.querySelector(".panel.active").id;
}

// =====================================================================
// 1. SPOKEN WORDS -> MATH
// =====================================================================
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES = { hundred: 100, thousand: 1000, million: 1e6 };

// "two hundred twenty five point five" -> "225.5"
// (Chrome usually writes digits already, but not always)
function wordsToNumbers(text) {
  const out = [];
  let current = null;   // number being built
  let total = 0;        // finished thousands / millions part
  let decimals = null;  // digits after "point"

  const flush = () => {
    if (current !== null) out.push(String(total + current) + (decimals ? "." + decimals : ""));
    current = null; total = 0; decimals = null;
  };

  for (const word of text.split(/\s+/)) {
    const w = word.toLowerCase().replace(/[.,;:!?]+$/, "");
    if (Object.hasOwn(NUMBER_WORDS, w)) {
      const value = NUMBER_WORDS[w];
      if (decimals !== null) { decimals += value; continue; }
      // "twenty five" joins into 25, but "five five" is two numbers
      const joins = current !== null &&
        ((value < 10 && current % 10 === 0) || (value < 100 && current % 100 === 0)) &&
        current % 1000 !== value;
      if (current !== null && !joins) flush();
      current = (current || 0) + value;
    } else if (Object.hasOwn(SCALES, w) && current !== null && decimals === null) {
      if (w === "hundred") current *= 100;
      else { total += current * SCALES[w]; current = 0; }
    } else if (w === "point" && current !== null && decimals === null) {
      decimals = "";
    } else if (w === "and" && current !== null && decimals === null) {
      // "one hundred and five" -> ignore "and"
    } else {
      flush();
      out.push(word);
    }
  }
  flush();
  return out.join(" ");
}

const FUNCTIONS = ["asin", "acos", "atan", "sin", "cos", "tan", "log", "ln", "sqrt", "cbrt", "abs"];

// Turn a spoken sentence into a math expression.
// context = "scientific" (x means ×) or "calculus" (x is the variable)
function speechToMath(spoken, context) {
  let s = " " + wordsToNumbers(spoken.toLowerCase()) + " ";
  s = s.replace(/²/g, "^2").replace(/³/g, "^3").replace(/×/g, "*")
       .replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/[?,!]/g, " ");

  const rules = [
    [/\b(what is|what's|calculate|equals|equal to|is)\b/g, " "],
    [/\bto the power( of)?\b|\braised to( the power of)?\b|\bpower\b/g, " ^ "],
    [/\bsquared\b/g, " ^ 2 "],
    [/\bcubed\b/g, " ^ 3 "],
    [/\bsquare root( of)?\b|\broot( of)?\b/g, " sqrt( "],
    [/\bcube\s+sqrt\(/g, " cbrt( "],
    [/\b(inverse sine?|arc ?sine?|sine? inverse)( of)?\b/g, " asin( "],
    [/\b(inverse cos(ine)?|arc ?cos(ine)?|cos(ine)? inverse)( of)?\b/g, " acos( "],
    [/\b(inverse tan(gent)?|arc ?tan(gent)?|tan(gent)? inverse)( of)?\b/g, " atan( "],
    [/\b(sine?)( of)?\b/g, " sin( "],
    [/\b(cosine|cos)( of)?\b/g, " cos( "],
    [/\b(tangent|tan)( of)?\b/g, " tan( "],
    [/\b(natural log(arithm)?|ln)( of)?\b/g, " ln( "],
    [/\blog(arithm)?( of)?\b/g, " log( "],
    [/\babsolute value( of)?\b|\bmodulus of\b/g, " abs( "],
    [/\be to the\b/g, " e ^ "],
    [/\bfactorial\b/g, " ! "],
    [/\b(plus|add)\b/g, " + "],
    [/\b(minus|negative|subtract)\b/g, " - "],
    [/\b(times|multiplied by|multiply)\b/g, " * "],
    [/\b(divided by|over)\b/g, " / "],
    [/\b(mod|modulo)\b/g, " mod "],
    [/\bpercent\b/g, " % "],
    [/\b(open|left) (bracket|parenthesis|paren)\b/g, " ( "],
    [/\b(close|right) (bracket|parenthesis|paren)\b/g, " ) "],
    [/\b(the|of|by|and)\b/g, " "],
  ];
  rules.forEach(([pattern, replacement]) => (s = s.replace(pattern, replacement)));

  s = context === "calculus" ? s.replace(/\bex\b/g, " x ") : s.replace(/\bx\b/g, " * ");

  // Split into pieces: numbers, names, operators. Unknown words are dropped.
  const pieces = [];
  for (const chunk of s.split(/\s+/).filter(Boolean)) {
    if (/^[a-z]+$/.test(chunk) && !["pi", "e", "x", "mod"].includes(chunk)) continue;
    const found = chunk.match(/(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt|abs)\(|\d*\.?\d+|pi|mod|[ex]|[+\-*/^()!%]/g);
    if (found) pieces.push(...found);
  }

  // "sin( 30 + 5" means sin(30) + 5: a function grabs just the next value
  const isAtom = (p) => p !== undefined && /^(\d*\.?\d+|pi|e|x)$/.test(p);
  const out = [];
  for (let i = 0; i < pieces.length; i++) {
    out.push(pieces[i]);
    if (!pieces[i].endsWith("(") || pieces[i] === "(") continue;
    let j = i + 1;
    const arg = [];
    if (pieces[j] === "-") arg.push(pieces[j++]);
    if (!isAtom(pieces[j])) continue;
    arg.push(pieces[j++]);
    if (pieces[j] === "^" && isAtom(pieces[j + 1])) arg.push(pieces[j++], pieces[j++]);
    out.push(...arg, ")");
    i = j - 1;
  }

  let expr = out.join(" ").replace(/\s*mod\s*/g, " mod ").replace(/\s+/g, " ").trim();
  // Close any brackets left open
  const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
  expr += ")".repeat(Math.max(0, open));
  return expr.replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ \^ /g, "^");
}

// Math string -> Scientific-tab tokens, so DEL / ◀ ▶ work as usual
const V2D = {};
Object.values(KEYS).forEach((k) => {
  V2D[k.v.trim()] = k;
  if (k.inv) V2D[k.inv.v] = k.inv;
});

function expressionToTokens(expr) {
  const parts = expr.match(/(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt|abs)\(|\d|\.|pi|mod|e|[+\-*/^()!%]/g) || [];
  return parts.map((p) => {
    const key = V2D[p];
    return key ? { v: key.v, d: key.d } : { v: p, d: p };
  });
}

// ----- What to do with speech on each tab -----
function handleScientificSpeech(text) {
  const expr = speechToMath(text, "scientific");
  if (!expr) return toast(`Didn't catch a calculation in "${text}"`, true);
  tokens = expressionToTokens(expr);
  cursor = tokens.length;
  justEvaluated = false;
  equals();
  render();
  toast(`🎤 "${text}"`);
}

function handleCalculusSpeech(text) {
  let s = " " + text.toLowerCase() + " ";
  let action = null;
  let a = null, b = null;

  if (/\b(derivative|differentiate|d by dx|d\/dx)\b/.test(s)) action = "diff";
  else if (/\b(integral|integrate|integration|antiderivative)\b/.test(s)) action = "int";

  const order = /\bthird\b/.test(s) ? "3" : /\bsecond\b/.test(s) ? "2" : "1";

  // "integral of x squared from 0 to 2"
  const limits = s.match(/\bfrom (.+?) to (.+?)\s*$/);
  if (action === "int" && limits) {
    a = speechToMath(limits[1], "scientific");
    b = speechToMath(limits[2], "scientific");
    s = s.slice(0, limits.index);
    action = "defint";
  }

  s = s.replace(/\b(find|first|second|third|derivative|differentiate|d by dx|integral|integrate|integration|antiderivative|with respect to x|dx|d x)\b/g, " ");
  const f = speechToMath(s, "calculus");
  if (!f) return toast(`Didn't catch a function in "${text}"`, true);

  fnInput.value = f;
  updateFnPreview();
  orderSelect.value = order;
  if (action === "diff") differentiate();
  else if (action === "int") integrate();
  else if (action === "defint") {
    lowerInput.value = a;
    upperInput.value = b;
    definiteIntegral();
  }
  toast(`🎤 "${text}"`);
}

function handleStatsSpeech(text) {
  const cleaned = wordsToNumbers(text.toLowerCase()).replace(/\b(minus|negative)\s+/g, "-");
  const numbers = parseNumbers(cleaned);
  if (!numbers.length) return toast(`No numbers found in "${text}"`, true);
  const where = addStatsNumbers(numbers);
  toast(`🎤 Added ${numbers.length} number${numbers.length > 1 ? "s" : ""} to ${where}`);
}

const SPEECH_HANDLERS = {
  scientific: handleScientificSpeech,
  calculus: handleCalculusSpeech,
  stats: handleStatsSpeech,
};

// =====================================================================
// 2. VOICE INPUT
// =====================================================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

const VOICE_ERRORS = {
  "not-allowed": "Microphone blocked. Allow mic access in the address bar, then try again.",
  "no-speech": "Didn't hear anything — try again and speak clearly.",
  "audio-capture": "No microphone found.",
  network: "Voice recognition needs an internet connection.",
};

function startVoice(button, target) {
  if (!SpeechRecognition) {
    return toast("Voice input isn't supported in this browser. Try Chrome or Edge.", true);
  }
  if (recognition) {        // second click = stop listening
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;   // show words while you speak
  let finalText = "";

  recognition.onstart = () => {
    button.classList.add("listening");
    toast("🎤 Listening…", false, 0);
  };
  recognition.onresult = (event) => {
    const text = Array.from(event.results).map((r) => r[0].transcript).join("");
    toast("🎤 " + text, false, 0);
    if (event.results[event.results.length - 1].isFinal) finalText = text;
  };
  recognition.onerror = (event) => {
    if (event.error !== "aborted") toast(VOICE_ERRORS[event.error] || "Voice error: " + event.error, true);
  };
  recognition.onend = () => {
    button.classList.remove("listening");
    recognition = null;
    if (finalText) SPEECH_HANDLERS[target](finalText);
    else if (!toastEl.classList.contains("error")) toastEl.classList.add("hidden");
  };
  recognition.start();
}

// =====================================================================
// 3. OCR (reading text from images and drawings)
// =====================================================================
let ocrWorker = null;
let ocrBusy = false;
const ocrStatus = document.getElementById("ocrStatus");

const OCR_MESSAGES = {
  "loading tesseract core": "Loading OCR engine…",
  "loading language traineddata": "Downloading English model (first time only)…",
  "initializing api": "Starting…",
  "recognizing text": "Reading",
};

async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        const label = OCR_MESSAGES[m.status];
        if (!label) return;
        ocrStatus.textContent = m.status === "recognizing text"
          ? `${label}… ${Math.round(m.progress * 100)}%` : label;
      },
    });
  }
  return ocrWorker;
}

// mode "numbers" -> only digits; "math" -> letters/symbols for functions
async function readText(source, mode, singleLine) {
  const worker = await getOcrWorker();
  await worker.setParameters({
    tessedit_char_whitelist: mode === "numbers"
      ? "0123456789.,- \n"
      : "0123456789xabcdeghilnopqrst+-*/^().= ",
    tessedit_pageseg_mode: singleLine ? "7" : "6",   // 7 = one line, 6 = a block of text
  });
  const { data } = await worker.recognize(source);
  return data.text;
}

function cleanMathText(text) {
  return text.replace(/\s+/g, " ").replace(/[×]/g, "*").replace(/[—–−]/g, "-")
    .replace(/([x)])(\d+)/g, "$1^$2")   // OCR loses superscripts: "x2" -> "x^2"
    .trim();
}

// =====================================================================
// 4. POPUP: handwriting canvas or image preview
// =====================================================================
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");
const drawTools = document.getElementById("drawTools");
const imagePreview = document.getElementById("imagePreview");
const ocrText = document.getElementById("ocrText");
const imageInput = document.getElementById("imageInput");

let modalTarget = "calculus";    // "calculus" or "stats"
let strokes = [];                // each stroke = list of points
let currentStroke = null;

function ocrMode() {
  return modalTarget === "stats" ? "numbers" : "math";
}

function openModal(kind, target) {
  modalTarget = target;
  const what = target === "stats" ? "numbers" : "a function of x";
  modalTitle.textContent = kind === "draw" ? `✍️ Write ${what}` : `📷 Read ${what} from an image`;
  canvas.classList.toggle("hidden", kind !== "draw");
  drawTools.classList.toggle("hidden", kind !== "draw");
  imagePreview.classList.toggle("hidden", kind !== "image");
  ocrText.value = "";
  ocrStatus.textContent = "";
  if (kind === "draw") { strokes = []; redraw(); }
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  if (imagePreview.src) URL.revokeObjectURL(imagePreview.src);
}

async function recognize(source, singleLine) {
  if (ocrBusy) return;
  ocrBusy = true;
  ocrStatus.textContent = "Starting…";
  try {
    const raw = await readText(source, ocrMode(), singleLine);
    if (ocrMode() === "numbers") {
      const numbers = parseNumbers(raw);
      ocrText.value = numbers.join(", ");
      ocrStatus.textContent = numbers.length ? `Found ${numbers.length} numbers ✔` : "No numbers found 😕";
    } else {
      ocrText.value = cleanMathText(raw);
      ocrStatus.textContent = ocrText.value ? "Done ✔ — check it carefully" : "Couldn't read anything 😕";
    }
  } catch (err) {
    ocrStatus.textContent = "OCR failed: " + (err.message || err);
  } finally {
    ocrBusy = false;
  }
}

function insertRecognized() {
  const text = ocrText.value.trim();
  if (!text) return closeModal();
  if (modalTarget === "stats") {
    const where = addStatsNumbers(parseNumbers(text));
    toast(`Added to ${where}`);
  } else {
    fnInput.value = text;
    updateFnPreview();
  }
  closeModal();
}

function openImage(file, target) {
  if (!file || !file.type.startsWith("image/")) return toast("That isn't an image file.", true);
  openModal("image", target);
  imagePreview.src = URL.createObjectURL(file);
  recognize(file, false);
}

// ---------- Drawing with mouse, finger or stylus ----------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * canvas.width) / rect.width,
    y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    p: e.pressure || 0.5,   // stylus pressure makes lines thicker
  };
}

function redraw() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineWidth = 7 + stroke[i].p * 8;
      ctx.beginPath();
      ctx.moveTo(stroke[i - 1].x, stroke[i - 1].y);
      ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
    if (stroke.length === 1) {   // a single tap = a dot (decimal point!)
      ctx.beginPath();
      ctx.arc(stroke[0].x, stroke[0].y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.fillStyle = "#fff";
    }
  }
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  currentStroke = [canvasPoint(e)];
  strokes.push(currentStroke);
  redraw();
});
canvas.addEventListener("pointermove", (e) => {
  if (!currentStroke) return;
  currentStroke.push(canvasPoint(e));
  redraw();
});
["pointerup", "pointercancel"].forEach((type) =>
  canvas.addEventListener(type, () => (currentStroke = null))
);

document.getElementById("undoStroke").addEventListener("click", () => { strokes.pop(); redraw(); });
document.getElementById("clearCanvas").addEventListener("click", () => { strokes = []; redraw(); });
document.getElementById("recognizeBtn").addEventListener("click", () => {
  if (!strokes.length) return (ocrStatus.textContent = "Write something first ✍️");
  recognize(canvas, true);
});
document.getElementById("modalInsert").addEventListener("click", insertRecognized);
document.getElementById("modalCancel").addEventListener("click", closeModal);
document.getElementById("modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
ocrText.addEventListener("keydown", (e) => { if (e.key === "Enter") insertRecognized(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

// =====================================================================
// 5. WIRE UP THE 🎤 📷 ✍️ BUTTONS
// =====================================================================
let imageTarget = "calculus";

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;
    const tool = button.dataset.tool;
    if (tool === "voice") startVoice(button, target);
    else if (tool === "draw") openModal("draw", target);
    else if (tool === "image") { imageTarget = target; imageInput.click(); }
  });
});

imageInput.addEventListener("change", () => {
  openImage(imageInput.files[0], imageTarget);
  imageInput.value = "";   // lets you pick the same file again
});

// Screenshot shortcut: Win+Shift+S to snip, then Ctrl+V here
document.addEventListener("paste", (e) => {
  const tab = activeTab();
  if (tab === "scientific") return;
  const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
  if (!item) return;           // normal text paste
  e.preventDefault();
  openImage(item.getAsFile(), tab === "statistics" ? "stats" : "calculus");
});

// Drag & drop an image onto the page
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const tab = activeTab();
  if (tab === "scientific") return toast("Drop images on the Calculus or Statistics tab.", true);
  openImage(e.dataTransfer.files[0], tab === "statistics" ? "stats" : "calculus");
});
