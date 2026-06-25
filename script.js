pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let originalPdfBytes = null;
let pdfDocProxy = null;
let currentSignatureDataUrl = null;
let pdfScale = 1.35;
let zoomLevel = 1;
let fieldId = 1;

const viewer = document.getElementById("viewer");
const welcome = document.getElementById("welcome");
const pdfUpload = document.getElementById("pdfUpload");
const fileName = document.getElementById("fileName");

const btnAddSignature = document.getElementById("btnAddSignature");
const btnAddName = document.getElementById("btnAddName");
const btnAddDate = document.getElementById("btnAddDate");
const btnAddText = document.getElementById("btnAddText");
const btnAddStamp = document.getElementById("btnAddStamp");
const btnDownload = document.getElementById("btnDownload");
const btnTheme = document.getElementById("btnTheme");
const btnTutorial = document.getElementById("btnTutorial");
const btnDuplicateField = document.getElementById("btnDuplicateField");
const viewerToolbar = document.getElementById("viewerToolbar");
const pageIndicator = document.getElementById("pageIndicator");
const btnPrevPage = document.getElementById("btnPrevPage");
const btnNextPage = document.getElementById("btnNextPage");
const btnZoomIn = document.getElementById("btnZoomIn");
const btnZoomOut = document.getElementById("btnZoomOut");
const tutorialModal = document.getElementById("tutorialModal");
const closeTutorial = document.getElementById("closeTutorial");
const sealModal = document.getElementById("sealModal");
const closeSealModal = document.getElementById("closeSealModal");
const sealUpload = document.getElementById("sealUpload");
const saveSeal = document.getElementById("saveSeal");

const signatureModal = document.getElementById("signatureModal");
const closeModal = document.getElementById("closeModal");
const sigCanvas = document.getElementById("sigCanvas");
const sigCtx = sigCanvas.getContext("2d");

function prepareSignatureCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = sigCanvas.getBoundingClientRect();
  const cssW = rect.width || 620;
  const cssH = rect.height || 210;
  sigCanvas.width = Math.round(cssW * ratio);
  sigCanvas.height = Math.round(cssH * ratio);
  sigCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
}
setTimeout(prepareSignatureCanvas, 0);
window.addEventListener("resize", prepareSignatureCanvas);
const clearSig = document.getElementById("clearSig");
const saveSignature = document.getElementById("saveSignature");
const typedSignature = document.getElementById("typedSignature");
const typedPreview = document.getElementById("typedPreview");
const sigUpload = document.getElementById("sigUpload");
const sigEnhanceToggle = document.getElementById("sigEnhanceToggle");
const sigRemoveBgToggle = document.getElementById("sigRemoveBgToggle");
const sigInkMode = document.getElementById("sigInkMode");
const sigCleanStrength = document.getElementById("sigCleanStrength");
const sigQualityBadge = document.getElementById("sigQualityBadge");
const sigOriginalPreview = document.getElementById("sigOriginalPreview");
const sigEnhancedPreview = document.getElementById("sigEnhancedPreview");
let latestOptimizedSignatureDataUrl = null;

pdfUpload.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (fileName) fileName.textContent = file.name;
  originalPdfBytes = await file.arrayBuffer();
  pdfDocProxy = await pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise;

  welcome.classList.add("hidden");
  viewerToolbar.classList.remove("hidden");
  await renderAllPages();

  [btnAddSignature, btnAddName, btnAddDate, btnAddText, btnAddStamp, btnDownload, btnDuplicateField].forEach(btn => btn.disabled = false);
  updatePageIndicator();
});

async function renderAllPages() {
  viewer.innerHTML = "";

  // Make the PDF viewer behave like a real document viewer:
  // only one page fits in the visible area, and the remaining pages are reached by mouse/touch scrolling.
  const firstPage = await pdfDocProxy.getPage(1);
  const baseViewport = firstPage.getViewport({ scale: 1 });
  const workspace = document.querySelector(".workspace");
  const toolbarHeight = viewerToolbar && !viewerToolbar.classList.contains("hidden") ? viewerToolbar.offsetHeight : 0;
  const availableWidth = Math.max(300, (workspace?.clientWidth || window.innerWidth) - 140);
  const availableHeight = Math.max(460, (workspace?.clientHeight || window.innerHeight) - toolbarHeight - 150);
  const fitScale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
  pdfScale = Math.max(0.45, Math.min(fitScale * zoomLevel, 2.4));

  for (let i = 1; i <= pdfDocProxy.numPages; i++) {
    const page = i === 1 ? firstPage : await pdfDocProxy.getPage(i);
    const viewport = page.getViewport({ scale: pdfScale });

    const pageWrap = document.createElement("div");
    pageWrap.className = "pageWrap";
    pageWrap.dataset.page = i;
    pageWrap.style.width = viewport.width + "px";
    pageWrap.style.height = viewport.height + "px";

    const canvas = document.createElement("canvas");
    canvas.className = "pageCanvas";
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    pageWrap.appendChild(canvas);
    viewer.appendChild(pageWrap);
  }
}

btnAddSignature.addEventListener("click", () => signatureModal.classList.remove("hidden"));
closeModal.addEventListener("click", () => signatureModal.classList.add("hidden"));

btnAddName.addEventListener("click", () => {
  const name = prompt("Enter name:");
  if (name) addField("text", name, 170, 45);
});

btnAddDate.addEventListener("click", () => {
  addField("text", new Date().toLocaleDateString(), 140, 45);
});

btnAddText.addEventListener("click", () => {
  const text = prompt("Enter text:");
  if (text) addField("text", text, 190, 45);
});

btnAddStamp.addEventListener("click", () => sealModal.classList.remove("hidden"));

closeSealModal.addEventListener("click", () => sealModal.classList.add("hidden"));

saveSeal.addEventListener("click", async () => {
  const file = sealUpload.files[0];
  if (!file) {
    alert("Please upload custom seal image first.");
    return;
  }

  const sealImage = await fileToDataUrl(file);
  sealModal.classList.add("hidden");
  addField("stamp", sealImage, 115, 115);
});

btnTheme.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  btnTheme.textContent = document.body.classList.contains("dark") ? "☾ Dark" : "☀ Light";
});

function addField(type, value, width = 190, height = 70) {
  const pageWrap = getActivePageWrap();
  if (!pageWrap) return;

  const field = createFieldElement(type, value, width, height);
  pageWrap.appendChild(field);
  selectField(field);
}

function makeFieldInteractive(field) {
  // Pointer events work on mouse, touch, and stylus.
  // This fixes the phone issue where dragged fields could jump/disappear during touch scrolling.
  field.addEventListener("pointerdown", startDrag);
  field.querySelector(".resize").addEventListener("pointerdown", startResize);

  field.querySelector(".remove").addEventListener("click", (e) => {
    e.stopPropagation();
    field.remove();
  });

  field.addEventListener("click", () => {
    selectField(field);
  });
}

function getPoint(e) {
  if (e.touches && e.touches.length) return e.touches[0];
  if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
  return e;
}

function selectField(field) {
  document.querySelectorAll(".field").forEach(f => f.classList.remove("selected"));
  field.classList.add("selected");
}

function startDrag(e) {
  if (e.target.classList.contains("resize") || e.target.classList.contains("remove")) return;
  e.preventDefault();
  e.stopPropagation();

  const field = e.currentTarget;
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = field.getBoundingClientRect();
  const shiftX = startX - rect.left;
  const shiftY = startY - rect.top;

  selectField(field);
  field.style.zIndex = "1000";
  field.classList.add("dragging");

  try {
    field.setPointerCapture(e.pointerId);
  } catch (_) {}

  function move(ev) {
    ev.preventDefault();

    const pages = Array.from(document.querySelectorAll(".pageWrap"));
    let targetPage = null;

    // Pick the page under the finger/mouse. If the finger is between pages,
    // keep the current page so the field never vanishes.
    for (const page of pages) {
      const r = page.getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
        targetPage = page;
        break;
      }
    }

    if (!targetPage) targetPage = field.parentElement;
    if (!targetPage) return;

    if (field.parentElement !== targetPage) {
      targetPage.appendChild(field);
    }

    const pageRect = targetPage.getBoundingClientRect();
    let left = ev.clientX - pageRect.left - shiftX;
    let top = ev.clientY - pageRect.top - shiftY;

    const maxLeft = Math.max(0, targetPage.clientWidth - field.offsetWidth);
    const maxTop = Math.max(0, targetPage.clientHeight - field.offsetHeight);

    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    field.style.left = left + "px";
    field.style.top = top + "px";
  }

  function up(ev) {
    field.style.zIndex = "";
    field.classList.remove("dragging");
    try {
      field.releasePointerCapture(e.pointerId);
    } catch (_) {}
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
  }

  document.addEventListener("pointermove", move, { passive: false });
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
}

function startResize(e) {
  e.stopPropagation();
  e.preventDefault();

  const field = e.currentTarget.parentElement;
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = field.offsetWidth;
  const startH = field.offsetHeight;

  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch (_) {}

  function move(ev) {
    ev.preventDefault();
    field.style.width = Math.max(70, startW + ev.clientX - startX) + "px";
    field.style.height = Math.max(35, startH + ev.clientY - startY) + "px";
  }

  function up() {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
  }

  document.addEventListener("pointermove", move, { passive: false });
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
}


btnTutorial.addEventListener("click", () => tutorialModal.classList.remove("hidden"));
closeTutorial.addEventListener("click", () => tutorialModal.classList.add("hidden"));

btnDuplicateField.addEventListener("click", () => {
  const selected = document.querySelector(".field.selected");
  if (!selected) {
    alert("Please select a signature, seal, or text field first.");
    return;
  }
  const type = selected.dataset.type;
  const value = (type === "signature" || type === "stamp") ? selected.dataset.image : selected.dataset.text;
  const copy = createFieldElement(type, value, selected.clientWidth, selected.clientHeight);
  copy.style.left = Math.min(parseFloat(selected.style.left) + 24, selected.parentElement.clientWidth - selected.clientWidth) + "px";
  copy.style.top = Math.min(parseFloat(selected.style.top) + 24, selected.parentElement.clientHeight - selected.clientHeight) + "px";
  selected.parentElement.appendChild(copy);
  selectField(copy);
});

function createFieldElement(type, value, width = 190, height = 70) {
  const field = document.createElement("div");
  field.className = "field";
  field.dataset.id = fieldId++;
  field.dataset.type = type;
  field.style.left = "90px";
  field.style.top = "90px";
  field.style.width = width + "px";
  field.style.height = height + "px";

  if (type === "signature" || type === "stamp") {
    field.dataset.image = value;
    field.innerHTML = `<span class="remove">×</span><img src="${value}"><span class="resize"></span>`;
  } else {
    field.dataset.text = value;
    field.innerHTML = `<span class="remove">×</span><div class="textField">${value}</div><span class="resize"></span>`;
  }

  makeFieldInteractive(field);
  return field;
}

function getActivePageWrap() {
  const pages = Array.from(document.querySelectorAll(".pageWrap"));
  if (!pages.length) return null;
  const viewerRect = viewer.getBoundingClientRect();
  const mid = viewerRect.top + viewerRect.height / 2;
  return pages.reduce((best, page) => {
    const r = page.getBoundingClientRect();
    const dist = Math.abs((r.top + r.bottom) / 2 - mid);
    return !best || dist < best.dist ? { page, dist } : best;
  }, null).page;
}

function updatePageIndicator() {
  if (!pdfDocProxy || !pageIndicator) return;
  const active = getActivePageWrap();
  const current = active ? active.dataset.page : 1;
  pageIndicator.textContent = `Page ${current} / ${pdfDocProxy.numPages}`;
}

viewer.addEventListener("scroll", updatePageIndicator);
window.addEventListener("scroll", updatePageIndicator);

btnPrevPage.addEventListener("click", () => scrollToPage(-1));
btnNextPage.addEventListener("click", () => scrollToPage(1));

function scrollToPage(direction) {
  const active = getActivePageWrap();
  if (!active) return;
  const current = Number(active.dataset.page);
  const target = document.querySelector(`.pageWrap[data-page="${current + direction}"]`);
  if (!target) return;
  const viewerRect = viewer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = viewer.scrollTop + (targetRect.top - viewerRect.top) - 18;
  viewer.scrollTo({ top, behavior: "smooth" });
}

/* Signature Modal */
let drawing = false;

function startSignatureDraw(e) {
  e.preventDefault();
  drawing = true;
  sigCtx.beginPath();
  try {
    sigCanvas.setPointerCapture(e.pointerId);
  } catch (_) {}
  drawSig(e);
}

function stopSignatureDraw(e) {
  if (!drawing) return;
  drawing = false;
  sigCtx.beginPath();
  try {
    sigCanvas.releasePointerCapture(e.pointerId);
  } catch (_) {}
}

sigCanvas.addEventListener("pointerdown", startSignatureDraw, { passive: false });
sigCanvas.addEventListener("pointermove", drawSig, { passive: false });
sigCanvas.addEventListener("pointerup", stopSignatureDraw);
sigCanvas.addEventListener("pointerleave", stopSignatureDraw);
sigCanvas.addEventListener("pointercancel", stopSignatureDraw);

function drawSig(e) {
  if (!drawing) return;
  e.preventDefault();

  const rect = sigCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  sigCtx.lineWidth = 3;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
  sigCtx.strokeStyle = "#111";
  sigCtx.lineTo(x, y);
  sigCtx.stroke();
  sigCtx.beginPath();
  sigCtx.moveTo(x, y);
}

clearSig.addEventListener("click", () => {
  sigCtx.save();
  sigCtx.setTransform(1, 0, 0, 1, 0, 0);
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  sigCtx.restore();
});

typedSignature.addEventListener("input", () => {
  typedPreview.textContent = typedSignature.value || "Your Signature";
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "Panel").classList.remove("hidden");
  });
});

saveSignature.addEventListener("click", async () => {
  const activeTab = document.querySelector(".tab.active").dataset.tab;

  if (activeTab === "draw") {
    currentSignatureDataUrl = sigCanvas.toDataURL("image/png");
  }

  if (activeTab === "type") {
    currentSignatureDataUrl = makeTypedSignatureImage(typedSignature.value || "Signature");
  }

  if (activeTab === "upload") {
    const file = sigUpload.files[0];
    if (!file) {
      alert("Please upload signature image first.");
      return;
    }
    currentSignatureDataUrl = latestOptimizedSignatureDataUrl || await signatureFileToDataUrl(file);
  }

  signatureModal.classList.add("hidden");
  addField("signature", currentSignatureDataUrl, 320, 125);
});

function makeTypedSignatureImage(text) {
  const c = document.createElement("canvas");
  c.width = 650;
  c.height = 220;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#111";
  ctx.font = "78px Brush Script MT, cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2);
  return c.toDataURL("image/png");
}



function signatureFileToDataUrl(file) {
  // Original mode preserves exact upload. Enhanced mode creates a clean transparent PNG.
  if (!sigEnhanceToggle || !sigEnhanceToggle.checked) {
    return fileToDataUrl(file);
  }
  return optimizeSignatureFile(file, {
    removeBackground: !sigRemoveBgToggle || sigRemoveBgToggle.checked,
    inkMode: sigInkMode ? sigInkMode.value : "blue",
    cleanStrength: sigCleanStrength ? Number(sigCleanStrength.value) : 48,
    preview: false
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function colourDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function estimateBackgroundColour(data, w, h) {
  // Average the outer border. This handles white paper, grey scans and dark photos.
  let r = 0, g = 0, b = 0, count = 0;
  const border = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > border && x < w - border && y > border && y < h - border) continue;
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
  }
  if (!count) return [255, 255, 255];
  return [r / count, g / count, b / count];
}

function pixelInkScore(r, g, b, bg) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const darkness = 255 - ((r + g + b) / 3);
  const bgDist = colourDistance([r, g, b], bg);
  // Higher score = more likely to be signature ink.
  return bgDist * 0.85 + saturation * 0.75 + darkness * 0.55;
}

async function optimizeSignatureFile(file, options = {}) {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageFromDataUrl(dataUrl);

  const originalW = img.naturalWidth || img.width;
  const originalH = img.naturalHeight || img.height;
  if (!originalW || !originalH) return dataUrl;

  // Upscale small images before cleanup. This improves signatures from WhatsApp/photos/screenshots.
  const longest = Math.max(originalW, originalH);
  const upscale = longest < 900 ? Math.min(4, Math.ceil(1200 / longest)) : 1;
  const w = originalW * upscale;
  const h = originalH * upscale;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const bg = estimateBackgroundColour(data, w, h);
  const strength = Math.max(15, Math.min(90, Number(options.cleanStrength || 48)));
  const threshold = 44 + strength * 1.55;
  const removeBg = options.removeBackground !== false;
  const inkMode = options.inkMode || "blue";

  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 20) continue;

      const score = pixelInkScore(r, g, b, bg);
      const isLightPaper = r > 185 && g > 185 && b > 185 && Math.abs(r - g) < 32 && Math.abs(g - b) < 32;
      const isNearBg = colourDistance([r, g, b], bg) < threshold;
      const keep = !removeBg || (!isNearBg && !isLightPaper) || score > threshold + 18;

      if (keep) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return dataUrl;

  const pad = Math.max(14 * upscale, Math.round(Math.min(w, h) * 0.035));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext("2d", { willReadFrequently: true });
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const out = outCtx.getImageData(0, 0, cropW, cropH);
  const od = out.data;
  const croppedBg = estimateBackgroundColour(od, cropW, cropH);
  const cropThreshold = 40 + strength * 1.45;

  for (let i = 0; i < od.length; i += 4) {
    const r = od[i], g = od[i + 1], b = od[i + 2], a = od[i + 3];
    if (a < 20) { od[i + 3] = 0; continue; }

    const dist = colourDistance([r, g, b], croppedBg);
    const lightPaper = r > 182 && g > 182 && b > 182 && Math.abs(r - g) < 34 && Math.abs(g - b) < 34;
    const darkPaper = r < 55 && g < 55 && b < 55 && dist < cropThreshold;
    const score = pixelInkScore(r, g, b, croppedBg);
    const isBackground = removeBg && ((dist < cropThreshold) || lightPaper || darkPaper) && score < cropThreshold + 28;

    if (isBackground) {
      od[i + 3] = 0;
      continue;
    }

    // Strengthen weak low-quality ink while preserving the shape.
    let alpha = Math.min(255, Math.max(90, a + 55));
    od[i + 3] = alpha;

    if (inkMode === "blue") {
      const lum = (r + g + b) / 3;
      const depth = Math.max(0, Math.min(1, (210 - lum + strength) / 210));
      od[i] = Math.round(34 + 18 * (1 - depth));
      od[i + 1] = Math.round(79 + 28 * (1 - depth));
      od[i + 2] = Math.round(164 + 40 * (1 - depth));
    } else if (inkMode === "black") {
      const lum = (r + g + b) / 3;
      const v = Math.max(8, Math.min(45, lum * 0.18));
      od[i] = v; od[i + 1] = v; od[i + 2] = v;
    } else {
      // Original colour but better contrast.
      od[i] = Math.max(0, Math.min(255, (r - 128) * 1.25 + 128));
      od[i + 1] = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128));
      od[i + 2] = Math.max(0, Math.min(255, (b - 128) * 1.25 + 128));
    }
  }

  outCtx.putImageData(out, 0, 0);
  return outCanvas.toDataURL("image/png");
}

async function updateSignaturePreview() {
  if (!sigUpload || !sigUpload.files || !sigUpload.files[0]) return;
  const file = sigUpload.files[0];
  try {
    const original = await readFileAsDataUrl(file);
    latestOptimizedSignatureDataUrl = await signatureFileToDataUrl(file);
    if (sigOriginalPreview) sigOriginalPreview.src = original;
    if (sigEnhancedPreview) sigEnhancedPreview.src = latestOptimizedSignatureDataUrl;
    if (sigQualityBadge) {
      const img = await loadImageFromDataUrl(original);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const label = Math.max(w, h) >= 1200 ? "Good quality" : Math.max(w, h) >= 700 ? "Medium quality" : "Low quality · optimizer recommended";
      sigQualityBadge.textContent = `${label} (${w}×${h})`;
    }
  } catch (err) {
    console.warn(err);
    if (sigQualityBadge) sigQualityBadge.textContent = "Could not preview image";
  }
}

if (sigUpload) sigUpload.addEventListener("change", updateSignaturePreview);
[sigEnhanceToggle, sigRemoveBgToggle, sigInkMode, sigCleanStrength].forEach(el => {
  if (el) el.addEventListener("input", updateSignaturePreview);
  if (el) el.addEventListener("change", updateSignaturePreview);
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      // Keep the uploaded image exactly as it is.
      // This preserves transparent PNG backgrounds and avoids color changes.
      resolve(reader.result);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function embedAnyImage(pdfDoc, imageData) {
  if (!imageData) throw new Error("Missing image data");

  // Uploaded images are preserved as original data URLs to avoid color/background changes.
  if (typeof imageData === "string" && imageData.startsWith("data:image/")) {
    if (imageData.startsWith("data:image/jpeg") || imageData.startsWith("data:image/jpg")) {
      return await pdfDoc.embedJpg(imageData);
    }
    return await pdfDoc.embedPng(imageData);
  }

  const res = await fetch(imageData);
  if (!res.ok) throw new Error("Image not found: " + imageData);
  const bytes = await res.arrayBuffer();
  const lower = imageData.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return await pdfDoc.embedJpg(bytes);
  }
  return await pdfDoc.embedPng(bytes);
}

function drawImageKeepRatio(page, img, x, y, boxW, boxH) {
  const ratio = img.width / img.height;
  let drawW = boxW;
  let drawH = boxW / ratio;

  if (drawH > boxH) {
    drawH = boxH;
    drawW = boxH * ratio;
  }

  // Center image inside the field box and keep original proportions.
  const drawX = x + (boxW - drawW) / 2;
  const drawY = y + (boxH - drawH) / 2;

  page.drawImage(img, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH
  });
}

btnDownload.addEventListener("click", async () => {
  if (!originalPdfBytes) {
    alert("Please upload a PDF first.");
    return;
  }

  try {
    btnDownload.disabled = true;
    btnDownload.textContent = "Preparing PDF...";

    const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    for (const field of document.querySelectorAll(".field")) {
      const pageIndex = Number(field.parentElement.dataset.page) - 1;
      const page = pages[pageIndex];
      if (!page) continue;

      const pdfW = page.getWidth();
      const pdfH = page.getHeight();
      const pageWrap = field.parentElement;

      const scaleX = pdfW / pageWrap.clientWidth;
      const scaleY = pdfH / pageWrap.clientHeight;

      const x = parseFloat(field.style.left) * scaleX;
      const y = pdfH - (parseFloat(field.style.top) + field.clientHeight) * scaleY;
      const w = field.clientWidth * scaleX;
      const h = field.clientHeight * scaleY;

      if (field.dataset.type === "signature" || field.dataset.type === "stamp") {
        const img = await embedAnyImage(pdfDoc, field.dataset.image);
        drawImageKeepRatio(page, img, x, y, w, h);
      } else {
        page.drawText(field.dataset.text || "", {
          x,
          y: y + h * 0.25,
          size: Math.min(18, h * 0.55),
          color: PDFLib.rgb(0, 0, 0)
        });
      }
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "E-SOI-signed.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error(error);
    alert("Download failed: " + error.message);
  } finally {
    btnDownload.disabled = false;
    btnDownload.textContent = "⬇ Download Signed PDF";
  }
});

if (btnZoomIn) {
  btnZoomIn.addEventListener("click", async () => {
    if (!pdfDocProxy) return;
    zoomLevel = Math.min(2.5, zoomLevel + 0.15);
    await renderAllPages();
    updatePageIndicator();
  });
}

if (btnZoomOut) {
  btnZoomOut.addEventListener("click", async () => {
    if (!pdfDocProxy) return;
    zoomLevel = Math.max(0.55, zoomLevel - 0.15);
    await renderAllPages();
    updatePageIndicator();
  });
}

window.addEventListener("resize", async () => {
  if (!pdfDocProxy) return;
  await renderAllPages();
  updatePageIndicator();
});
