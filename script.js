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
const clearSig = document.getElementById("clearSig");
const saveSignature = document.getElementById("saveSignature");
const typedSignature = document.getElementById("typedSignature");
const typedPreview = document.getElementById("typedPreview");
const sigUpload = document.getElementById("sigUpload");

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

document.querySelectorAll(".seal-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".seal-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".seal-panel").forEach(panel => panel.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.sealTab + "Panel").classList.remove("hidden");
  });
});

saveSeal.addEventListener("click", async () => {
  const activeTab = document.querySelector(".seal-tab.active").dataset.sealTab;
  let sealImage = "assets/kc-sign-logo.png";

  if (activeTab === "uploadSeal") {
    const file = sealUpload.files[0];
    if (!file) {
      alert("Please upload seal image first.");
      return;
    }
    sealImage = await fileToDataUrl(file);
  }

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
  field.addEventListener("mousedown", startDrag);
  field.addEventListener("touchstart", startDrag, { passive: false });
  field.querySelector(".resize").addEventListener("mousedown", startResize);
  field.querySelector(".resize").addEventListener("touchstart", startResize, { passive: false });

  field.querySelector(".remove").addEventListener("click", (e) => {
    e.stopPropagation();
    field.remove();
  });

  field.addEventListener("click", () => {
    selectField(field);
  });
}

function getPoint(e) {
  return e.touches ? e.touches[0] : e;
}

function selectField(field) {
  document.querySelectorAll(".field").forEach(f => f.classList.remove("selected"));
  field.classList.add("selected");
}

function startDrag(e) {
  if (e.target.classList.contains("resize") || e.target.classList.contains("remove")) return;
  e.preventDefault();

  const point = getPoint(e);
  const field = e.currentTarget;
  const startX = point.clientX;
  const startY = point.clientY;
  const rect = field.getBoundingClientRect();
  const shiftX = startX - rect.left;
  const shiftY = startY - rect.top;

  field.classList.add("selected");
  field.style.zIndex = "1000";

  function move(ev) {
    const pages = Array.from(document.querySelectorAll(".pageWrap"));
    let targetPage = null;

    // Pick the page under the mouse. This allows dragging from page 1 to page 2.
    const point = getPoint(ev);
    for (const page of pages) {
      const r = page.getBoundingClientRect();
      if (point.clientX >= r.left && point.clientX <= r.right && point.clientY >= r.top && point.clientY <= r.bottom) {
        targetPage = page;
        break;
      }
    }

    if (!targetPage) {
      targetPage = field.parentElement;
    }

    if (field.parentElement !== targetPage) {
      targetPage.appendChild(field);
    }

    const pageRect = targetPage.getBoundingClientRect();
    let left = point.clientX - pageRect.left - shiftX;
    let top = point.clientY - pageRect.top - shiftY;

    left = Math.max(0, Math.min(left, targetPage.clientWidth - field.clientWidth));
    top = Math.max(0, Math.min(top, targetPage.clientHeight - field.clientHeight));

    field.style.left = left + "px";
    field.style.top = top + "px";
  }

  function up() {
    field.style.zIndex = "";
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", up);
}

function startResize(e) {
  e.stopPropagation();
  e.preventDefault();

  const point = getPoint(e);
  const field = e.currentTarget.parentElement;
  const startX = point.clientX;
  const startY = point.clientY;
  const startW = field.clientWidth;
  const startH = field.clientHeight;

  function move(ev) {
    const point = getPoint(ev);
    field.style.width = Math.max(70, startW + point.clientX - startX) + "px";
    field.style.height = Math.max(35, startH + point.clientY - startY) + "px";
  }

  function up() {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", up);
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

sigCanvas.addEventListener("mousedown", (e) => {
  drawing = true;
  sigCtx.beginPath();
  drawSig(e);
});

sigCanvas.addEventListener("mousemove", drawSig);
sigCanvas.addEventListener("mouseup", () => drawing = false);
sigCanvas.addEventListener("mouseleave", () => drawing = false);

function drawSig(e) {
  if (!drawing) return;

  const rect = sigCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (sigCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (sigCanvas.height / rect.height);

  sigCtx.lineWidth = 3;
  sigCtx.lineCap = "round";
  sigCtx.strokeStyle = "#111";
  sigCtx.lineTo(x, y);
  sigCtx.stroke();
  sigCtx.beginPath();
  sigCtx.moveTo(x, y);
}

clearSig.addEventListener("click", () => {
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
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
    currentSignatureDataUrl = await fileToDataUrl(file);
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Convert uploaded JPG/PNG signature to PNG with a solid white background.
        // This keeps the uploaded signature looking like the original photo.
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function embedAnyImage(pdfDoc, imageData) {
  if (!imageData) throw new Error("Missing image data");

  // Data URLs made by the tool are PNG. Uploaded JPG files are converted to PNG in fileToDataUrl().
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
    link.download = "KC-SIGN-signed.pdf";
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
