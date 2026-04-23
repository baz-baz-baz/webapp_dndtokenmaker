import { removeBackground } from "https://esm.sh/@imgly/background-removal";

const fileInput = document.getElementById("fileInput");
const removeBgBtn = document.getElementById("removeBgBtn");
const restoreBtn = document.getElementById("restoreBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const breakoutInput = document.getElementById("breakoutY");
const breakoutValue = document.getElementById("breakoutValue");
const statusBox = document.getElementById("status");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const tokenFrame = new Image();
tokenFrame.crossOrigin = "anonymous";
tokenFrame.src = "assets/token.png";

const CANVAS_SIZE = 300;
const TOKEN_SIZE = 256;
const TOKEN_X = (CANVAS_SIZE - TOKEN_SIZE) / 2;
const TOKEN_Y = (CANVAS_SIZE - TOKEN_SIZE) / 2;

const TOKEN = {
  cx: 150,
  cy: 150,
  radius: 105,
};

const state = {
  image: null,
  originalImage: null,
  originalFile: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  breakoutY: 95,
};

const interaction = {
  dragging: false,
  lastX: 0,
  lastY: 0,
};

fileInput?.addEventListener("change", handleUpload);
removeBgBtn?.addEventListener("click", removeBg);
restoreBtn?.addEventListener("click", restoreOriginal);
resetBtn?.addEventListener("click", resetView);
downloadBtn?.addEventListener("click", downloadPNG);

breakoutInput?.addEventListener("input", () => {
  state.breakoutY = parseInt(breakoutInput.value, 10);
  if (breakoutValue) breakoutValue.textContent = `${state.breakoutY}px`;
  draw();
});

canvas?.addEventListener("mousedown", startDrag);
window.addEventListener("mousemove", onDrag);
window.addEventListener("mouseup", endDrag);
canvas?.addEventListener("wheel", onWheel, { passive: false });

tokenFrame.onload = draw;

if (breakoutValue) {
  breakoutValue.textContent = `${state.breakoutY}px`;
}
if (breakoutInput) {
  breakoutInput.value = String(state.breakoutY);
}

function setStatus(text) {
  if (statusBox) statusBox.textContent = text;
}

async function handleUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  state.originalFile = file;

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    state.image = img;
    state.originalImage = img;
    fitImage();
    draw();
    setStatus("Image loaded");
  };

  img.src = url;
}

async function removeBg() {
  if (!state.originalFile) {
    setStatus("Upload an image first");
    return;
  }

  try {
    setStatus("Removing background… first run can take longer");

    const resultBlob = await removeBackground(state.originalFile);
    const url = URL.createObjectURL(resultBlob);
    const img = new Image();

    img.onload = () => {
      state.image = img;
      draw();
      setStatus("Background removed");
    };

    img.src = url;
  } catch (err) {
    console.error("Background removal failed:", err);
    setStatus(`Error: ${err.message || err}`);
  }
}

function restoreOriginal() {
  if (!state.originalImage) {
    setStatus("No original image to restore");
    return;
  }
  state.image = state.originalImage;
  draw();
  setStatus("Restored original");
}

function resetView() {
  if (!state.image) {
    setStatus("Upload an image first");
    return;
  }
  fitImage();
  draw();
  setStatus("Position reset");
}

function fitImage() {
  if (!state.image) return;

  const img = state.image;
  const maxDim = Math.max(img.width, img.height);

  state.scale = 240 / maxDim;
  state.offsetX = 0;
  state.offsetY = 0;
}

function startDrag(e) {
  if (!state.image) return;
  interaction.dragging = true;
  interaction.lastX = e.clientX;
  interaction.lastY = e.clientY;
  canvas.classList.add("dragging");
}

function onDrag(e) {
  if (!interaction.dragging || !state.image) return;

  const rect = canvas.getBoundingClientRect();
  const dx = (e.clientX - interaction.lastX) * (canvas.width / rect.width);
  const dy = (e.clientY - interaction.lastY) * (canvas.height / rect.height);

  state.offsetX += dx;
  state.offsetY += dy;

  interaction.lastX = e.clientX;
  interaction.lastY = e.clientY;

  draw();
}

function endDrag() {
  interaction.dragging = false;
  canvas.classList.remove("dragging");
}

function onWheel(e) {
  if (!state.image) return;
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

  const before = getPlacement();
  const imageXBefore = (mouseX - before.x) / before.w;
  const imageYBefore = (mouseY - before.y) / before.h;

  const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
  const newScale = clamp(state.scale * zoomFactor, 0.1, 8);

  state.scale = newScale;

  const after = getPlacement();
  const newX = mouseX - imageXBefore * after.w;
  const newY = mouseY - imageYBefore * after.h;

  state.offsetX += newX - after.x;
  state.offsetY += newY - after.y;

  draw();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPlacement() {
  const img = state.image;
  const w = img.width * state.scale;
  const h = img.height * state.scale;
  const x = (canvas.width - w) / 2 + state.offsetX;
  const y = (canvas.height - h) / 2 + state.offsetY;
  return { x, y, w, h };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state.image) {
    drawPlaceholder();
    return;
  }

  drawInsideToken();
  drawFrame();
  drawBreakout();
}

function drawInsideToken() {
  const { x, y, w, h } = getPlacement();

  ctx.save();
  ctx.beginPath();
  ctx.arc(TOKEN.cx, TOKEN.cy, TOKEN.radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(state.image, x, y, w, h);
  ctx.restore();
}

function drawFrame() {
  if (tokenFrame.complete && tokenFrame.naturalWidth > 0) {
    ctx.drawImage(tokenFrame, TOKEN_X, TOKEN_Y, TOKEN_SIZE, TOKEN_SIZE);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(TOKEN.cx, TOKEN.cy, TOKEN.radius, 0, Math.PI * 2);
    ctx.lineWidth = 18;
    ctx.strokeStyle = "#222";
    ctx.stroke();
    ctx.restore();
  }
}

function drawBreakout() {
  const { x, y, w, h } = getPlacement();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, state.breakoutY);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(state.image, x, y, w, h);
  ctx.restore();
}

function downloadPNG() {
  try {
    const link = document.createElement("a");
    link.download = "token.png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus("Downloaded PNG");
  } catch (err) {
    console.error("Download failed:", err);
    setStatus(`Download error: ${err.message || err}`);
  }
}