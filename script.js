pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let originalPdfBytes = null;
let pdfDocProxy = null;
let currentSignatureDataUrl = null;
let selectedField = null;
let pdfScale = 1.35;
let fieldId = 1;

const viewer = document.getElementById("viewer");
const pdfUpload = document.getElementById("pdfUpload");
const fileName = document.getElementById("fileName");
const pageList = document.getElementById("pageList");
const btnAddSignature = document.getElementById("btnAddSignature");
const btnAddName = document.getElementById("btnAddName");
const btnAddDate = document.getElementById("btnAddDate");
const btnDownload = document.getElementById("btnDownload");
const btnReset = document.getElementById("btnReset");

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

  fileName.textContent = file.name;
  originalPdfBytes = await file.arrayBuffer();
  pdfDocProxy = await pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise;

  await renderAllPages();

  btnAddSignature.disabled = false;
  btnAddName.disabled = false;
  btnAddDate.disabled = false;
  btnDownload.disabled = false;
});

async function renderAllPages() {
  viewer.innerHTML = "";
  pageList.innerHTML = "";

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

    const thumb = document.createElement("div");
    thumb.className = "pageThumb";
    thumb.textContent = "Page " + i;
    thumb.onclick = () => pageWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    pageList.appendChild(thumb);
  }
}

btnAddSignature.addEventListener("click", () => signatureModal.classList.remove("hidden"));
closeModal.addEventListener("click", () => signatureModal.classList.add("hidden"));

btnAddName.addEventListener("click", () => {
  const name = prompt("Enter name:");
  if (name) addField("name", name);
});

btnAddDate.addEventListener("click", () => {
  const today = new Date().toLocaleDateString();
  addField("date", today);
});

function addField(type, value) {
  const pageWrap = document.querySelector(".pageWrap");
  if (!pageWrap) return;

  const field = document.createElement("div");
  field.className = "field";
  field.dataset.id = fieldId++;
  field.dataset.type = type;
  field.dataset.page = pageWrap.dataset.page;
  field.style.left = "80px";
  field.style.top = "80px";
  field.style.width = type === "signature" ? "180px" : "160px";
  field.style.height = type === "signature" ? "70px" : "45px";

  if (type === "signature") {
    field.dataset.image = currentSignatureDataUrl;
    field.innerHTML = `<span class="remove">×</span><img src="${currentSignatureDataUrl}"><span class="resize"></span>`;
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
    selectedField = field;
  });
}

function startDrag(e) {
  if (e.target.classList.contains("resize") || e.target.classList.contains("remove")) return;
  const field = e.currentTarget;
  const parent = field.parentElement;
  const startX = e.clientX, startY = e.clientY;
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
  const startX = e.clientX, startY = e.clientY;
  const startW = field.clientWidth, startH = field.clientHeight;

  function move(ev) {
    field.style.width = Math.max(80, startW + ev.clientX - startX) + "px";
    field.style.height = Math.max(35, startH + ev.clientY - startY) + "px";
  }
  function up() {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  }
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

/* Signature modal */
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

clearSig.addEventListener("click", () => sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height));

typedSignature.addEventListener("input", () => {
  typedPreview.textContent = typedSignature.value || "Your Signature";
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tabPanel").forEach(p => p.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "Panel").classList.remove("hidden");
  };
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
      alert("Please upload signature image.");
      return;
    }
    currentSignatureDataUrl = await fileToDataUrl(file);
  }

  signatureModal.classList.add("hidden");
  addField("signature", currentSignatureDataUrl);
});

function makeTypedSignatureImage(text) {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 200;
  const ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle = "#111";
  ctx.font = "72px Brush Script MT, cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width/2, c.height/2);
  return c.toDataURL("image/png");
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

btnDownload.addEventListener("click", async () => {
  const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const fields = [...document.querySelectorAll(".field")];

  for (const f of fields) {
    const pageIndex = Number(f.parentElement.dataset.page) - 1;
    const page = pages[pageIndex];
    const pdfW = page.getWidth();
    const pdfH = page.getHeight();

    const pageWrap = f.parentElement;
    const scaleX = pdfW / pageWrap.clientWidth;
    const scaleY = pdfH / pageWrap.clientHeight;

    const x = parseFloat(f.style.left) * scaleX;
    const y = pdfH - (parseFloat(f.style.top) + f.clientHeight) * scaleY;
    const w = f.clientWidth * scaleX;
    const h = f.clientHeight * scaleY;

    if (f.dataset.type === "signature") {
      const img = await pdfDoc.embedPng(f.dataset.image);
      page.drawImage(img, { x, y, width: w, height: h });
    } else {
      page.drawText(f.dataset.text, {
        x,
        y: y + h * 0.25,
        size: Math.min(18, h * 0.55),
        color: PDFLib.rgb(0,0,0)
      });
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "KC-SIGN-signed.pdf";
  link.click();
});

btnReset.addEventListener("click", () => location.reload());
