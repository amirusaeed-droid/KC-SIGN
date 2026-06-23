pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let originalPdfBytes = null;
let pdfDocProxy = null;
let currentSignatureDataUrl = null;
let pdfScale = 1.35;
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

  try {
    fileName.textContent = file.name;
    originalPdfBytes = await file.arrayBuffer();
    pdfDocProxy = await pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise;

    welcome.classList.add("hidden");
    await renderAllPages();

    [btnAddSignature, btnAddName, btnAddDate, btnAddText, btnAddStamp, btnDownload].forEach(btn => btn.disabled = false);
  } catch (error) {
    console.error("PDF upload error:", error);
    alert("PDF could not be opened. Please try another PDF file.");
  }
});

async function renderAllPages() {
  viewer.innerHTML = "";

  for (let i = 1; i <= pdfDocProxy.numPages; i++) {
    const page = await pdfDocProxy.getPage(i);
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

btnAddStamp.addEventListener("click", () => {
  addField("stamp", "assets/kondey-council-logo.png", 95, 95);
});

btnTheme.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  btnTheme.textContent = document.body.classList.contains("dark") ? "☾ Dark" : "☀ Light";
});

function addField(type, value, width = 190, height = 70) {
  const pageWrap = document.querySelector(".pageWrap");
  if (!pageWrap) return;

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
  pageWrap.appendChild(field);
}

function makeFieldInteractive(field) {
  field.addEventListener("mousedown", startDrag);
  field.querySelector(".resize").addEventListener("mousedown", startResize);

  field.querySelector(".remove").addEventListener("click", (e) => {
    e.stopPropagation();
    field.remove();
  });

  field.addEventListener("click", () => {
    document.querySelectorAll(".field").forEach(f => f.classList.remove("selected"));
    field.classList.add("selected");
  });
}

function startDrag(e) {
  if (e.target.classList.contains("resize") || e.target.classList.contains("remove")) return;

  const field = e.currentTarget;
  const parent = field.parentElement;
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = parseFloat(field.style.left);
  const startTop = parseFloat(field.style.top);

  function move(ev) {
    let left = startLeft + ev.clientX - startX;
    let top = startTop + ev.clientY - startY;

    left = Math.max(0, Math.min(left, parent.clientWidth - field.clientWidth));
    top = Math.max(0, Math.min(top, parent.clientHeight - field.clientHeight));

    field.style.left = left + "px";
    field.style.top = top + "px";
  }

  function up() {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

function startResize(e) {
  e.stopPropagation();

  const field = e.currentTarget.parentElement;
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = field.clientWidth;
  const startH = field.clientHeight;

  function move(ev) {
    field.style.width = Math.max(70, startW + ev.clientX - startX) + "px";
    field.style.height = Math.max(35, startH + ev.clientY - startY) + "px";
  }

  function up() {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
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

  // Keep uploaded/drawn signature in its original proportion.
  // This prevents the signature from being squeezed or stretched.
  let signatureWidth = 280;
  let signatureHeight = 110;
  try {
    const size = await getImageNaturalSize(currentSignatureDataUrl);
    const ratio = size.width / size.height;
    signatureHeight = Math.round(signatureWidth / ratio);

    if (signatureHeight < 55) signatureHeight = 55;
    if (signatureHeight > 140) {
      signatureHeight = 140;
      signatureWidth = Math.round(signatureHeight * ratio);
    }
  } catch (e) {
    console.warn("Could not read signature size", e);
  }

  addField("signature", currentSignatureDataUrl, signatureWidth, signatureHeight);
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
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageNaturalSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageKeepOriginalLook(page, img, box) {
  // White background keeps uploaded signature photos looking like the original.
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    color: PDFLib.rgb(1, 1, 1)
  });

  const ratio = img.width / img.height;
  let drawW = box.w;
  let drawH = drawW / ratio;

  if (drawH > box.h) {
    drawH = box.h;
    drawW = drawH * ratio;
  }

  const drawX = box.x + (box.w - drawW) / 2;
  const drawY = box.y + (box.h - drawH) / 2;

  page.drawImage(img, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH
  });
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function embedImage(pdfDoc, imageSource) {
  let bytes;
  let type = "png";

  if (imageSource.startsWith("data:")) {
    type = imageSource.substring(5, imageSource.indexOf(";"));
    bytes = dataUrlToBytes(imageSource);
  } else {
    const response = await fetch(imageSource);
    if (!response.ok) throw new Error("Image not found: " + imageSource);
    bytes = new Uint8Array(await response.arrayBuffer());
    type = imageSource.toLowerCase().endsWith(".jpg") || imageSource.toLowerCase().endsWith(".jpeg") ? "jpeg" : "png";
  }

  if (type.includes("jpeg") || type.includes("jpg")) {
    return await pdfDoc.embedJpg(bytes);
  }
  return await pdfDoc.embedPng(bytes);
}

btnDownload.addEventListener("click", async () => {
  if (!originalPdfBytes) {
    alert("Please upload a PDF first.");
    return;
  }

  btnDownload.disabled = true;
  const oldText = btnDownload.textContent;
  btnDownload.textContent = "Preparing PDF...";

  try {
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
        try {
          const img = await embedImage(pdfDoc, field.dataset.image);

          if (field.dataset.type === "signature") {
            drawImageKeepOriginalLook(page, img, { x, y, w, h });
          } else {
            page.drawImage(img, { x, y, width: w, height: h });
          }
        } catch (imageError) {
          console.warn("Image skipped:", imageError);
        }
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
    console.error("Download failed:", error);
    alert("Download failed. Please check that the PDF is valid and try again.");
  } finally {
    btnDownload.disabled = false;
    btnDownload.textContent = oldText;
  }
});
