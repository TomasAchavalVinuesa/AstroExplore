const form = document.getElementById("query-form");
const raInput = document.getElementById("ra-input");
const decInput = document.getElementById("dec-input");
const collectionSelect = document.getElementById("collection-select");
const bandSelect = document.getElementById("band-select");
const radiusInput = document.getElementById("radius-input");
const sizeInput = document.getElementById("size-input");
const stretchSelect = document.getElementById("stretch-select");
const colormapSelect = document.getElementById("colormap-select");
const zodiCheckbox = document.getElementById("zodi-checkbox");
const crosshairCheckbox = document.getElementById("crosshair-checkbox");
const searchBtn = document.getElementById("search-btn");

const statusBanner = document.getElementById("status-banner");
const placeholder = document.getElementById("placeholder");
const cutoutImg = document.getElementById("cutout-img");
const crosshair = document.getElementById("crosshair");
const downloadFitsBtn = document.getElementById("download-fits-btn");
const viewerTitle = document.getElementById("viewer-title");
const viewerSubtitle = document.getElementById("viewer-subtitle");

const statsGrid = document.getElementById("stats-grid");
const statBand = document.getElementById("stat-band");
const statWave = document.getElementById("stat-wave");
const statShape = document.getElementById("stat-shape");
const statFlux = document.getElementById("stat-flux");

const apiTrace = document.getElementById("api-trace");
const traceSia = document.getElementById("trace-sia");
const traceCutout = document.getElementById("trace-cutout");

const resultsCount = document.getElementById("results-count");
const observationsList = document.getElementById("observations-list");

let currentObservations = [];
let selectedObs = null;
let lastSiaUrl = "";

function setStatus(message, isError = false) {
  if (!message) {
    statusBanner.classList.add("hidden");
    return;
  }
  statusBanner.textContent = message;
  statusBanner.classList.toggle("error", isError);
  statusBanner.classList.remove("hidden");
}

function updateCrosshairVisibility() {
  const show = crosshairCheckbox.checked && !cutoutImg.classList.contains("hidden");
  crosshair.classList.toggle("hidden", !show);
}

async function runSearch(event) {
  if (event) event.preventDefault();

  const ra = parseFloat(raInput.value);
  const dec = parseFloat(decInput.value);
  const radius = parseFloat(radiusInput.value);
  const collection = collectionSelect.value;
  const band = bandSelect.value;

  if (Number.isNaN(ra) || ra < 0 || ra > 360) {
    setStatus("La Ascensión Recta (RA) debe estar entre 0° y 360°.", true);
    return;
  }
  if (Number.isNaN(dec) || dec < -90 || dec > 90) {
    setStatus("La Declinación (Dec) debe estar entre -90° y +90°.", true);
    return;
  }

  searchBtn.disabled = true;
  setStatus(`Consultando IRSA SIA en RA=${ra}°, Dec=${dec}° (${collection})...`);

  try {
    const qs = new URLSearchParams({
      ra: ra.toString(),
      dec: dec.toString(),
      radius: radius.toString(),
      collection,
      band,
    });
    const res = await fetch(`/api/search?${qs.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Error en la consulta SIA.");
    }

    lastSiaUrl = data.sia_url;
    currentObservations = data.observations || [];
    resultsCount.textContent = `${data.total_found}`;
    renderObservationsList();

    if (currentObservations.length === 0) {
      setStatus(
        `No se encontraron exposiciones en "${collection}" para RA=${ra}°, Dec=${dec}°. Prueba aumentar el radio o cambiar de colección.`,
        true
      );
      cutoutImg.classList.add("hidden");
      placeholder.classList.remove("hidden");
      statsGrid.classList.add("hidden");
      downloadFitsBtn.classList.add("hidden");
      updateCrosshairVisibility();
      return;
    }

    await selectObservation(0);
  } catch (err) {
    setStatus(err.message || "Error inesperado consultando IRSA.", true);
  } finally {
    searchBtn.disabled = false;
  }
}

function renderObservationsList() {
  if (currentObservations.length === 0) {
    observationsList.innerHTML = `<p class="muted">Sin resultados para estas coordenadas.</p>`;
    return;
  }

  observationsList.innerHTML = "";
  currentObservations.forEach((obs, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "obs-item";
    btn.dataset.index = String(idx);

    const waveText =
      obs.em_min_um != null && obs.em_max_um != null
        ? `${obs.em_min_um}–${obs.em_max_um} µm`
        : "IR";

    btn.innerHTML = `
      <div class="obs-top">
        <span class="obs-band">${obs.bandpass || "SPHEREx"}</span>
        <span class="obs-wave">${waveText}</span>
      </div>
      <div class="obs-id">${obs.obs_id}</div>
    `;
    btn.addEventListener("click", () => selectObservation(idx));
    observationsList.appendChild(btn);
  });
}

async function selectObservation(index) {
  selectedObs = currentObservations[index];
  if (!selectedObs) return;

  document.querySelectorAll(".obs-item").forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });

  await loadCutoutForSelected();
}

async function loadCutoutForSelected() {
  if (!selectedObs) return;

  const ra = parseFloat(raInput.value);
  const dec = parseFloat(decInput.value);
  const size = parseFloat(sizeInput.value);
  const stretch = stretchSelect.value;
  const colormap = colormapSelect.value;
  const subtractZodi = zodiCheckbox.checked;

  setStatus(`Descargando y renderizando recorte FITS (${selectedObs.bandpass} — ${selectedObs.obs_id})...`);

  try {
    const qs = new URLSearchParams({
      access_url: selectedObs.access_url,
      ra: ra.toString(),
      dec: dec.toString(),
      size: size.toString(),
      stretch,
      colormap,
      subtract_zodi: String(subtractZodi),
    });

    const res = await fetch(`/api/cutout?${qs.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "No se pudo obtener el recorte FITS.");
    }

    cutoutImg.src = `data:image/png;base64,${data.image_base64}`;
    cutoutImg.classList.remove("hidden");
    placeholder.classList.add("hidden");
    updateCrosshairVisibility();

    viewerTitle.textContent = `${selectedObs.bandpass} · ${selectedObs.obs_id}`;
    viewerSubtitle.textContent = `Centro: RA ${ra.toFixed(5)}°, Dec ${dec.toFixed(5)}° · Recorte ${size}°`;

    downloadFitsBtn.href = data.fits_cutout_url;
    downloadFitsBtn.classList.remove("hidden");

    const waveText =
      selectedObs.em_min_um != null && selectedObs.em_max_um != null
        ? `${selectedObs.em_min_um} – ${selectedObs.em_max_um} µm`
        : "—";

    statBand.textContent = selectedObs.bandpass || "—";
    statWave.textContent = waveText;
    statShape.textContent = `${data.width} × ${data.height} px`;
    statFlux.textContent = `${data.stats.median} / ${data.stats.max} ${data.stats.unit}`;
    statsGrid.classList.remove("hidden");

    traceSia.textContent = lastSiaUrl;
    traceCutout.textContent = data.fits_cutout_url;
    apiTrace.classList.remove("hidden");

    setStatus("");
  } catch (err) {
    setStatus(err.message || "Error al renderizar la imagen.", true);
  }
}

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    raInput.value = chip.dataset.ra;
    decInput.value = chip.dataset.dec;
    if (chip.dataset.col) {
      collectionSelect.value = chip.dataset.col;
    }
    runSearch();
  });
});

form.addEventListener("submit", runSearch);
stretchSelect.addEventListener("change", loadCutoutForSelected);
colormapSelect.addEventListener("change", loadCutoutForSelected);
zodiCheckbox.addEventListener("change", loadCutoutForSelected);
crosshairCheckbox.addEventListener("change", updateCrosshairVisibility);
