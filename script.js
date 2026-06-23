let pdfBytes = null;
let signatureImage = null;
let signatureX = 100;
let signatureY = 100;

const pdfCanvas = document.getElementById("pdfCanvas");
const sigCanvas = document.getElementById("signatureCanvas");
const sigCtx = sigCanvas.getContext("2d");

sigCanvas.width = 400;
sigCanvas.height = 150;

let drawing = false;

sigCanvas.addEventListener("mousedown", () => drawing = true);
sigCanvas.addEventListener("mouseup", () => drawing = false);
sigCanvas.addEventListener("mousemove", drawSignature);

function drawSignature(e) {
  if (!drawing) return;

  const rect = sigCanvas.getBoundingClientRect();
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = "round";

  sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  sigCtx.stroke();
  sigCtx.beginPath();
  sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function clearSignature() {
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
}

document.getElementById("pdfUpload").addEventListener("change", async function(e) {
  const file = e.target.files[0];
  pdfBytes = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1.5 });
  const context = pdfCanvas.getContext("2d");

  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
});

pdfCanvas.addEventListener("click", function(e) {
  const rect = pdfCanvas.getBoundingClientRect();
  signatureX = e.clientX - rect.left;
  signatureY = e.clientY - rect.top;
  alert("Signature position selected");
});

async function downloadSignedPDF() {
  if (!pdfBytes) {
    alert("Please upload a PDF first");
    return;
  }

  const signatureDataUrl = sigCanvas.toDataURL("image/png");

  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const pngImage = await pdfDoc.embedPng(signatureDataUrl);

  firstPage.drawImage(pngImage, {
    x: signatureX,
    y: firstPage.getHeight() - signatureY - 60,
    width: 160,
    height: 60
  });

  const signedPdfBytes = await pdfDoc.save();

  const blob = new Blob([signedPdfBytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "signed-document.pdf";
  link.click();
}