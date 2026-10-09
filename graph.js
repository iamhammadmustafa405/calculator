// =====================================================================
// GRAPH: draw functions y = f(x) on a grid you can drag and zoom
//
// How it works: for every pixel across the canvas we work out x,
// calculate y = f(x) with math.js, and join the points with a line.
// "view" remembers which part of the graph is on screen.
// =====================================================================
(() => {
  const wrap = document.getElementById("graphWrap");
  const canvas = document.getElementById("graphCanvas");
  const ctx = canvas.getContext("2d");
  const listEl = document.getElementById("graphList");
  const addBtn = document.getElementById("graphAdd");
  const readout = document.getElementById("graphReadout");

  const COLORS = ["#ff4d5e", "#4da3ff", "#12b886", "#ffb020", "#b06cff", "#ff7ac6"];
  const MAX_FUNCTIONS = COLORS.length;
  const STORAGE_KEY = "calc-graphs";

  let width = 0;          // canvas size in CSS pixels
  let height = 0;
  let view = null;        // { cx, cy, scale }: centre of the screen + pixels per 1 unit
  let fns = [];           // [{ text, color, compiled, error }]
  let hoverX = null;      // mouse position (pixels) for the trace line
  let drag = null;        // set while the user is dragging the graph

  // ---------- Converting between graph units and screen pixels ----------
  const toPx = (x) => width / 2 + (x - view.cx) * view.scale;
  const toPy = (y) => height / 2 - (y - view.cy) * view.scale;
  const fromPx = (px) => view.cx + (px - width / 2) / view.scale;
  const fromPy = (py) => view.cy - (py - height / 2) / view.scale;

  function resetView() {
    view = { cx: 0, cy: 0, scale: width / 20 || 40 };   // show x from -10 to 10
  }

  // A "nice" gap between grid lines: 1, 2 or 5 × 10ⁿ
  function niceStep(rough) {
    const power = 10 ** Math.floor(Math.log10(rough));
    const n = rough / power;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * power;
  }

  function formatTick(value, step) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    return String(parseFloat(value.toFixed(Math.min(decimals, 10))));
  }

  function formatValue(v) {
    if (!Number.isFinite(v)) return "undefined";
    return String(parseFloat(v.toPrecision(5)));
  }

  // ---------- Working out y = f(x) ----------
  function compile(fn) {
    fn.compiled = null;
    fn.error = "";
    const text = fn.text.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, "");   // allow "y = ..."
    if (!text.trim()) return;
    try {
      fn.compiled = parseFunction(text).node.compile();   // parseFunction is in script.js
    } catch (err) {
      fn.error = err.message;
    }
  }

  function valueAt(fn, x) {
    try {
      const y = fn.compiled.evaluate({ x });
      return typeof y === "number" ? y : NaN;   // e.g. √(−1) is not a real number
    } catch {
      return NaN;
    }
  }

  // ---------- Drawing ----------
  function draw() {
    if (!width || !height) return;
    const css = getComputedStyle(document.documentElement);
    const color = (name) => css.getPropertyValue(name).trim();

    ctx.fillStyle = color("--raised");
    ctx.fillRect(0, 0, width, height);

    drawGrid(color);
    fns.forEach((fn) => fn.compiled && plot(fn));
    drawTrace(color);
  }

  function drawGrid(color) {
    const step = niceStep(80 / view.scale);   // a grid line about every 80 pixels
    const left = fromPx(0), right = fromPx(width);
    const bottom = fromPy(height), top = fromPy(0);

    // Grid lines
    ctx.strokeStyle = color("--border");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const px = Math.round(toPx(x)) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      const py = Math.round(toPy(y)) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();

    // The x and y axes (kept at the edge if they're off screen)
    const axisY = Math.min(Math.max(toPy(0), 0), height);
    const axisX = Math.min(Math.max(toPx(0), 0), width);
    ctx.strokeStyle = color("--muted");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(width, axisY);
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, height);
    ctx.stroke();

    // Numbers along the axes
    ctx.fillStyle = color("--muted");
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelY = Math.min(axisY + 4, height - 16);
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      if (Math.abs(x) < step / 2) continue;   // skip 0
      ctx.fillText(formatTick(x, step), toPx(x), labelY);
    }
    ctx.textAlign = axisX > width - 40 ? "right" : "left";
    ctx.textBaseline = "middle";
    const labelX = axisX > width - 40 ? axisX - 5 : axisX + 5;
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      if (Math.abs(y) < step / 2) continue;
      ctx.fillText(formatTick(y, step), labelX, toPy(y));
    }
  }

  function plot(fn) {
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let drawing = false;
    let prevPy = 0;
    for (let px = 0; px <= width; px++) {
      const y = valueAt(fn, fromPx(px));
      if (!Number.isFinite(y)) { drawing = false; continue; }
      const py = Math.min(Math.max(toPy(y), -1e5), 1e5);
      // A huge jump across the middle (like tan(x) or 1/x) means the curve breaks here
      const jumped = drawing && Math.abs(py - prevPy) > height &&
                     (py - height / 2) * (prevPy - height / 2) < 0;
      if (drawing && !jumped) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      drawing = true;
      prevPy = py;
    }
    ctx.stroke();
  }

  // Dashed line under the mouse + a dot on each curve, with the values in a box
  function drawTrace(color) {
    const active = fns.filter((fn) => fn.compiled);
    if (hoverX === null || drag || !active.length) {
      readout.classList.add("hidden");
      return;
    }
    const x = fromPx(hoverX);
    ctx.strokeStyle = color("--muted");
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hoverX, 0);
    ctx.lineTo(hoverX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    readout.replaceChildren();
    const xLine = document.createElement("div");
    xLine.textContent = "x = " + formatValue(x);
    readout.appendChild(xLine);

    active.forEach((fn) => {
      const y = valueAt(fn, x);
      if (Number.isFinite(y)) {
        ctx.fillStyle = fn.color;
        ctx.beginPath();
        ctx.arc(hoverX, toPy(y), 5, 0, Math.PI * 2);
        ctx.fill();
      }
      const line = document.createElement("div");
      const dot = document.createElement("span");
      dot.className = "graph-dot";
      dot.style.background = fn.color;
      line.append(dot, " y = " + formatValue(y));
      readout.appendChild(line);
    });
    readout.classList.remove("hidden");
  }

  // ---------- Keeping the canvas sharp and the right size ----------
  new ResizeObserver(() => {
    width = wrap.clientWidth;
    height = wrap.clientHeight;
    if (!width || !height) return;   // tab is hidden
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!view) resetView();
    draw();
  }).observe(wrap);

  // Redraw when the theme changes, so the grid uses the new colours
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // ---------- Drag to move, scroll to zoom ----------
  function zoomAt(px, py, factor) {
    const x = fromPx(px), y = fromPy(py);
    view.scale = Math.min(Math.max(view.scale * factor, 1e-4), 1e6);
    // keep the point under the mouse in the same place
    view.cx = x - (px - width / 2) / view.scale;
    view.cy = y + (py - height / 2) / view.scale;
    draw();
  }

  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    hoverX = e.clientX - canvas.getBoundingClientRect().left;
    if (drag) {
      view.cx = drag.cx - (e.clientX - drag.x) / view.scale;
      view.cy = drag.cy + (e.clientY - drag.y) / view.scale;
    }
    draw();
  });

  const endDrag = () => {
    drag = null;
    canvas.classList.remove("dragging");
    draw();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    if (drag) return;
    hoverX = null;
    draw();
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();   // zoom the graph instead of scrolling the page
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });

  document.getElementById("zoomIn").addEventListener("click", () => zoomAt(width / 2, height / 2, 1.5));
  document.getElementById("zoomOut").addEventListener("click", () => zoomAt(width / 2, height / 2, 1 / 1.5));
  document.getElementById("zoomReset").addEventListener("click", () => { resetView(); draw(); });

  // ---------- The list of functions (side pane) ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fns.map((fn) => fn.text)));
    } catch {}
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) return saved.filter((t) => typeof t === "string");
    } catch {}
    return null;
  }

  function addFunction(text = "") {
    if (fns.length >= MAX_FUNCTIONS) return null;
    const used = fns.map((fn) => fn.color);
    const fn = { text, color: COLORS.find((c) => !used.includes(c)) };
    compile(fn);
    fns.push(fn);
    return fn;
  }

  function renderList(focusFn) {
    listEl.replaceChildren();
    fns.forEach((fn) => {
      const row = document.createElement("div");
      row.className = "graph-row";

      const dot = document.createElement("span");
      dot.className = "graph-dot";
      dot.style.background = fn.color;

      const label = document.createElement("span");
      label.className = "graph-y";
      label.textContent = "y =";

      const input = document.createElement("input");
      input.className = "fn-input graph-input";
      input.type = "text";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.placeholder = "e.g. x^2 - 4";
      input.value = fn.text;

      const remove = document.createElement("button");
      remove.className = "graph-remove";
      remove.title = "Remove";
      remove.textContent = "✕";

      const error = document.createElement("p");
      error.className = "graph-error";
      error.textContent = fn.error;

      input.addEventListener("input", () => {
        fn.text = input.value;
        compile(fn);
        error.textContent = fn.error;
        save();
        draw();
      });
      remove.addEventListener("click", () => {
        fns = fns.filter((f) => f !== fn);
        if (!fns.length) addFunction();
        save();
        renderList();
        draw();
      });

      row.append(dot, label, input, remove, error);
      listEl.appendChild(row);
      if (fn === focusFn) input.focus();
    });
    addBtn.disabled = fns.length >= MAX_FUNCTIONS;
  }

  addBtn.addEventListener("click", () => {
    const fn = addFunction();
    if (fn) { save(); renderList(fn); }
  });

  // "Try:" buttons fill the last empty box, or add a new one
  document.querySelectorAll(".graph-example").forEach((btn) => {
    btn.addEventListener("click", () => {
      let fn = fns.find((f) => !f.text.trim()) || addFunction();
      if (!fn) fn = fns[fns.length - 1];   // list is full: replace the last one
      fn.text = btn.textContent;
      compile(fn);
      save();
      renderList();
      draw();
    });
  });

  (load() || ["sin(x)"]).slice(0, MAX_FUNCTIONS).forEach((text) => addFunction(text));
  if (!fns.length) addFunction();
  renderList();
})();
