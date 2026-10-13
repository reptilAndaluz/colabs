"use strict";

const MODEL_URL = "./modelo/model.json";
const METADATA_URL = "./modelo/metadata.json";
const CAMERA_SIZE = 400;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const els = {
  btnCamera: document.getElementById("btn-camera"),
  fileInput: document.getElementById("file-input"),
  status: document.getElementById("status"),
  preview: document.getElementById("preview"),
  results: document.getElementById("results"),
};

let model = null;
let webcam = null;
let rafId = null;

/* ---------- Modelo ---------- */

async function loadModel() {
  try {
    model = await tmImage.load(MODEL_URL, METADATA_URL);
    setStatus("Modelo listo.");
    createResultRows(model.getTotalClasses());
  } catch (err) {
    console.error(err);
    setStatus("No se pudo cargar el modelo. ¿Estás usando un servidor local o HTTPS?");
    els.btnCamera.disabled = true;
  }
}

async function predict(source) {
  const predictions = await model.predict(source);
  renderResults(predictions);
}

/* ---------- Cámara ---------- */

async function startCamera() {
  if (webcam) return stopCamera();

  try {
    webcam = new tmImage.Webcam(CAMERA_SIZE, CAMERA_SIZE, true);
    await webcam.setup();
    await webcam.play();
  } catch (err) {
    console.error(err);
    webcam = null;
    setStatus("No se pudo acceder a la cámara (permiso denegado o no disponible).");
    return;
  }

  els.preview.replaceChildren(webcam.canvas);
  els.btnCamera.textContent = "Detener cámara";
  rafId = requestAnimationFrame(loop);
}

async function loop() {
  webcam.update();
  await predict(webcam.canvas);
  rafId = requestAnimationFrame(loop);
}

function stopCamera() {
  if (rafId) cancelAnimationFrame(rafId);
  if (webcam) webcam.stop(); // libera la cámara
  webcam = null;
  rafId = null;
  els.btnCamera.textContent = "Iniciar cámara";
}

/* ---------- Imagen subida ---------- */

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) {
    setStatus("Archivo no válido (solo imágenes de hasta 5 MB).");
    return;
  }

  stopCamera();

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    els.preview.replaceChildren(img);
    await predict(img);
    URL.revokeObjectURL(url); // evita fuga de memoria
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("No se pudo leer la imagen.");
  };
  img.src = url;
}

/* ---------- UI ---------- */

function setStatus(message) {
  els.status.textContent = message;
}

function createResultRows(total) {
  const rows = Array.from({ length: total }, () => {
    const li = document.createElement("li");
    li.append(
      document.createElement("span"),
      document.createElement("progress"),
      document.createElement("span")
    );
    li.querySelector("progress").max = 1;
    return li;
  });
  els.results.replaceChildren(...rows);
}

function renderResults(predictions) {
  predictions.forEach((p, i) => {
    const [label, bar, pct] = els.results.children[i].children;
    label.textContent = p.className; // textContent, nunca innerHTML
    bar.value = p.probability;
    pct.textContent = `${(p.probability * 100).toFixed(1)}%`;
  });
}

/* ---------- Eventos ---------- */

els.btnCamera.addEventListener("click", startCamera);
els.fileInput.addEventListener("change", handleFile);
window.addEventListener("beforeunload", stopCamera);

loadModel();