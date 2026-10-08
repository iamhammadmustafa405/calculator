// =====================================================================
// STATISTICS TAB
// Three kinds of data:
//   list   -> one list of numbers
//   freq   -> values (x) + how many times each appears (f)
//   paired -> x and y pairs -> correlation & regression line
// =====================================================================
const statsMode = document.getElementById("statsMode");
const xData = document.getElementById("xData");
const yData = document.getElementById("yData");
const xLabel = document.getElementById("xLabel");
const yLabel = document.getElementById("yLabel");
const yField = document.getElementById("yField");
const statsResults = document.getElementById("statsResults");
const statsSorted = document.getElementById("statsSorted");

// Which box voice / images / handwriting should fill
let activeStatsField = xData;
xData.addEventListener("focus", () => (activeStatsField = xData));
yData.addEventListener("focus", () => (activeStatsField = yData));

const MODES = {
  list:   { x: "Data", y: null, xHint: "12, 15, 18, 20, 15", example: ["4, 8, 15, 16, 23, 42, 8, 15, 8", ""] },
  freq:   { x: "Values (x)", y: "Frequencies (f)", xHint: "10, 20, 30, 40", yHint: "3, 7, 5, 1",
            example: ["10, 20, 30, 40, 50", "2, 5, 9, 4, 1"] },
  paired: { x: "x values", y: "y values", xHint: "1, 2, 3, 4, 5", yHint: "2.1, 3.9, 6.2, 7.8, 10.1",
            example: ["1, 2, 3, 4, 5, 6", "2.1, 3.9, 6.2, 7.8, 10.1, 12.2"] },
};

// Pull every number out of a piece of text: "12, 15 and -3.5" -> [12, 15, -3.5]
function parseNumbers(text) {
  return (text.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) || []).map(Number);
}

function fmt(value) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  return String(parseFloat(value.toPrecision(10)));
}

function card(label, value, extra = "") {
  return `<div class="stat-card ${extra}"><div class="stat-label">${label}</div>` +
         `<div class="stat-value">${value}</div></div>`;
}

// "values + frequencies" -> one long list:  x=[2,5] f=[3,1] -> [2,2,2,5]
function expand(values, freqs) {
  if (values.length !== freqs.length) {
    throw new Error(`Each value needs a frequency (you have ${values.length} values and ${freqs.length} frequencies).`);
  }
  if (freqs.some((f) => f < 0 || !Number.isInteger(f))) {
    throw new Error("Frequencies must be whole numbers (0, 1, 2, …).");
  }
  const total = freqs.reduce((a, b) => a + b, 0);
  if (total === 0) throw new Error("The frequencies add up to 0.");
  if (total > 1e6) throw new Error("That's more than a million data points — too many for the browser.");

  const data = [];
  values.forEach((v, i) => { for (let k = 0; k < freqs[i]; k++) data.push(v); });
  return data;
}

function findModes(data) {
  const counts = new Map();
  data.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const max = Math.max(...counts.values());
  if (max === 1) return "None";
  const modes = [...counts].filter(([, c]) => c === max).map(([v]) => v);
  const shown = modes.slice(0, 4).map(fmt).join(", ") + (modes.length > 4 ? ", …" : "");
  return `${shown} <small>(×${max})</small>`;
}

function renderSingle(data) {
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const q1 = math.quantileSeq(sorted, 0.25);
  const q3 = math.quantileSeq(sorted, 0.75);
  const sample = n > 1; // sample variance needs at least 2 numbers

  statsResults.innerHTML = [
    card("Count n", n),
    card("Sum Σx", fmt(sum)),
    card("Mean x̄", fmt(sum / n), "highlight"),
    card("Median", fmt(math.median(sorted)), "highlight"),
    card("Mode", findModes(data), "highlight"),
    card("Minimum", fmt(sorted[0])),
    card("Maximum", fmt(sorted[n - 1])),
    card("Range", fmt(sorted[n - 1] - sorted[0])),
    card("Q1 (25%)", fmt(q1)),
    card("Q3 (75%)", fmt(q3)),
    card("IQR", fmt(q3 - q1)),
    card("Std dev σ (population)", fmt(math.std(data, "uncorrected"))),
    card("Std dev s (sample)", sample ? fmt(math.std(data, "unbiased")) : "—"),
    card("Variance σ²", fmt(math.variance(data, "uncorrected"))),
    card("Variance s²", sample ? fmt(math.variance(data, "unbiased")) : "—"),
  ].join("");

  const preview = sorted.slice(0, 80).map(fmt).join(", ");
  statsSorted.textContent = `Sorted: ${preview}${n > 80 ? ", …" : ""}`;
}

function describeCorrelation(r) {
  const a = Math.abs(r);
  const strength = a >= 0.8 ? "Strong" : a >= 0.5 ? "Moderate" : a >= 0.3 ? "Weak" : "Very weak / none";
  if (a < 0.3) return strength;
  return `${strength} ${r > 0 ? "positive ↗" : "negative ↘"}`;
}

function renderPaired(xs, ys) {
  if (xs.length !== ys.length) {
    throw new Error(`x and y need the same count (you have ${xs.length} x values and ${ys.length} y values).`);
  }
  const n = xs.length;
  if (n < 2) throw new Error("Paired data needs at least 2 points.");

  const mx = math.mean(xs);
  const my = math.mean(ys);
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) throw new Error("All x values are the same, so there's no line to fit.");

  const slope = sxy / sxx;               // b
  const intercept = my - slope * mx;     // a
  const r = syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
  const sign = intercept < 0 ? "−" : "+";

  statsResults.innerHTML = [
    card("Regression line (least squares)",
         `ŷ = ${fmt(slope)}x ${sign} ${fmt(Math.abs(intercept))}`, "wide highlight"),
    card("Pairs n", n),
    card("Mean x̄", fmt(mx)),
    card("Mean ȳ", fmt(my)),
    card("Correlation r", fmt(r), "highlight"),
    card("R²", fmt(r * r)),
    card("Relationship", isNaN(r) ? "—" : describeCorrelation(r)),
    card("Slope b", fmt(slope)),
    card("Intercept a", fmt(intercept)),
    card("Covariance (sample)", fmt(sxy / (n - 1))),
    card("Std dev x (sample)", fmt(Math.sqrt(sxx / (n - 1)))),
    card("Std dev y (sample)", fmt(Math.sqrt(syy / (n - 1)))),
  ].join("");
  statsSorted.textContent = "";
}

function updateStats() {
  const mode = statsMode.value;
  const xs = parseNumbers(xData.value);
  const ys = parseNumbers(yData.value);
  statsSorted.textContent = "";

  if (!xs.length) {
    statsResults.innerHTML = `<p class="stats-empty">Type, speak 🎤, paste a screenshot 📷 or write ✍️ some numbers to see the statistics.</p>`;
    return;
  }
  try {
    if (mode === "paired") renderPaired(xs, ys);
    else renderSingle(mode === "freq" ? expand(xs, ys) : xs);
  } catch (err) {
    statsResults.innerHTML = `<p class="stats-error">⚠️ ${err.message}</p>`;
  }
}

function applyMode() {
  const m = MODES[statsMode.value];
  xLabel.textContent = m.x;
  xData.placeholder = m.xHint;
  yField.classList.toggle("hidden", !m.y);
  if (m.y) {
    yLabel.textContent = m.y;
    yData.placeholder = m.yHint;
  } else {
    activeStatsField = xData;
  }
  updateStats();
}

// Used by voice / image / handwriting input
function addStatsNumbers(numbers) {
  const field = activeStatsField;
  const existing = field.value.trim();
  const sep = existing && !/[,\s]$/.test(existing) ? ", " : "";
  field.value = existing + sep + numbers.join(", ");
  updateStats();
  return field === xData ? xLabel.textContent : yLabel.textContent;
}

statsMode.addEventListener("change", applyMode);
xData.addEventListener("input", updateStats);
yData.addEventListener("input", updateStats);

document.getElementById("statsExample").addEventListener("click", () => {
  const [x, y] = MODES[statsMode.value].example;
  xData.value = x;
  yData.value = y;
  updateStats();
});

document.getElementById("statsClear").addEventListener("click", () => {
  xData.value = "";
  yData.value = "";
  updateStats();
});

applyMode();
