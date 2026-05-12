const COLORS = [
  "#2F80ED", "#F2994A", "#27AE60", "#EB5757",
  "#9B51E0", "#56CCF2", "#F2C94C", "#6FCF97",
  "#BB6BD9", "#FF8A65", "#26A69A", "#5C6BC0"
];

const state = {
  data: null,
  markers: [],
  activeLayer: null,
  selectedFeatureKey: "",
  selectedYear: "",
  featureSearchMap: {},
  chart: null,
  layerCounts: {},
  colorMap: {},
  clusterGroup: null
};

const workCountEl = document.getElementById("workCount");
const legendListEl = document.getElementById("legendList");
const chartLegendEl = document.getElementById("chartLegend");
const topbarSubtitleEl = document.getElementById("topbarSubtitle");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const searchInputEl = document.getElementById("searchInput");
const worksDatalistEl = document.getElementById("worksDatalist");
const yearSelectEl = document.getElementById("yearSelect");
const lightboxEl = document.getElementById("imageLightbox");
const lightboxImageEl = document.getElementById("lightboxImage");
const lightboxCloseEl = document.getElementById("lightboxClose");

const map = L.map("map", { zoomControl: true, minZoom: 6 }).setView([46.57, 26.92], 11);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: "abcd",
  maxZoom: 20
}).addTo(map);

state.clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  disableClusteringAtZoom: 16,
  maxClusterRadius: 42
});
map.addLayer(state.clusterGroup);

function normalizeLayerName(value) {
  return String(value || "Necategorizat").replace(/\s+/g, " ").trim();
}

function getFeatureKey(feature, index = 0) {
  const p = feature.properties || {};
  return String(p.gid || `${p.titlu || "lucrare"}-${index}`);
}

function getFeatureYear(feature) {
  const layer = normalizeLayerName(feature.properties?.layer);
  return (layer.match(/20\d{2}/) || [])[0] || "Necunoscut";
}

function getLayerYear(layer) {
  return (normalizeLayerName(layer).match(/20\d{2}/) || [])[0] || "Necunoscut";
}

function sortLayers(layers) {
  return [...layers].sort((a, b) => {
    const ay = (a.match(/20\d{2}/) || [])[0];
    const by = (b.match(/20\d{2}/) || [])[0];
    if (ay && by && ay !== by) return Number(ay) - Number(by);
    return a.localeCompare(b, "ro");
  });
}

function splitDescription(text) {
  if (!text) return { ro: "", en: "" };
  const cleaned = String(text)
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const markerRegex = /(\n|^|\s)(EN|ENG)\s*[:\-]?\s*(\n|\s)/i;
  const match = cleaned.match(markerRegex);
  if (!match || typeof match.index !== "number") return { ro: cleaned, en: "" };
  const idx = match.index + (match[1] ? match[1].length : 0);
  return {
    ro: cleaned.slice(0, idx).replace(/^(RO)\s*[:\-]?\s*/i, "").trim(),
    en: cleaned.slice(idx).replace(/^(EN|ENG)\s*[:\-]?\s*/i, "").trim()
  };
}

function getImageUrls(properties) {
  return Object.keys(properties)
    .filter((k) => /^image_\d+$/i.test(k) && properties[k])
    .map((k) => String(properties[k]).trim())
    .filter((v) => /^https?:\/\//i.test(v));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("'", "&#39;");
}

function linkifyText(str) {
  return escapeHtml(str || "").replace(/(https?:\/\/[^\s<]+)/gi, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function popupHtml(feature, color) {
  const p = feature.properties || {};
  const images = getImageUrls(p);
  const description = splitDescription(p.descriere);

  const gallery = images.length
    ? `<div class="popup-section-title">Galerie foto</div>
      <div class="popup-gallery">
        ${images.map((img) => `
          <a href="${img}" data-lightbox-image="${escapeAttr(img)}" title="Deschide imaginea mărită">
            <img src="${img}" alt="${escapeAttr(p.titlu || "Imagine ZIDART")}" loading="lazy"
                 onerror="this.closest('a').style.display='none'">
          </a>`).join("")}
      </div>`
    : `<div class="popup-section-title">Galerie foto</div><div class="popup-empty">Nu există imagini disponibile pentru această lucrare.</div>`;

  const descriptionBlock = description.ro || description.en
    ? `<div class="popup-section-title">Descriere</div>
      <div class="popup-grid">
        ${description.ro ? `<div class="popup-field full"><span class="popup-label">RO</span><div class="popup-value">${linkifyText(description.ro)}</div></div>` : ""}
        ${description.en ? `<div class="popup-field full"><span class="popup-label">EN</span><div class="popup-value">${linkifyText(description.en)}</div></div>` : ""}
      </div>`
    : "";

  return `<div class="popup-card">
    <div class="popup-hero" style="box-shadow: inset 0 0 0 9999px rgba(0,0,0,.06);">
      <span class="popup-badge" style="background:${color}22;border-color:${color}55;">ZIDART</span>
      <div class="popup-title">${escapeHtml(p.titlu || "Lucrare")}</div>
      <div class="popup-layer">${escapeHtml(normalizeLayerName(p.layer || ""))}</div>
    </div>
    <div class="popup-body">
      <div class="popup-grid">
        ${p.nume_artist ? `<div class="popup-field"><span class="popup-label">Nume artist</span><div class="popup-value">${escapeHtml(p.nume_artist)}</div></div>` : ""}
        ${p.suprafata_lucrare ? `<div class="popup-field"><span class="popup-label">Suprafață lucrare</span><div class="popup-value">${escapeHtml(p.suprafata_lucrare)}</div></div>` : ""}
        ${p.adresa_lucrare ? `<div class="popup-field full"><span class="popup-label">Adresă lucrare</span><div class="popup-value">${linkifyText(p.adresa_lucrare)}</div></div>` : ""}
      </div>
      ${gallery}
      ${descriptionBlock}
    </div>
  </div>`;
}

function makeMarker(feature, color) {
  const coords = feature.geometry?.coordinates || [];
  const icon = L.divIcon({
    className: "",
    html: `<div class="zidart-marker" style="width:18px;height:18px;background:${color};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12]
  });
  const marker = L.marker([coords[1], coords[0]], { icon });
  marker.feature = feature;
  marker.bindPopup(popupHtml(feature, color), {
    className: "zidart-popup",
    maxWidth: 420,
    autoPanPadding: [20, 20]
  });
  return marker;
}

function computeLayerCounts(features) {
  return features.reduce((acc, feature) => {
    const key = normalizeLayerName(feature.properties?.layer);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getColorMap(counts) {
  const entries = sortLayers(Object.keys(counts));
  return Object.fromEntries(entries.map((layer, i) => [layer, COLORS[i % COLORS.length]]));
}

function getAllFeatures() {
  return state.data?.features || [];
}

function getSearchOptionFeatures() {
  return getAllFeatures().filter((feature) => {
    const layer = normalizeLayerName(feature.properties?.layer);
    if (state.selectedYear && getFeatureYear(feature) !== state.selectedYear) return false;
    if (state.activeLayer && layer !== state.activeLayer) return false;
    return true;
  });
}

function populateSearchOptions(features) {
  if (!worksDatalistEl) return;
  state.featureSearchMap = {};
  const sorted = [...features].sort((a, b) => String(a.properties?.titlu || "").localeCompare(String(b.properties?.titlu || ""), "ro"));
  worksDatalistEl.innerHTML = sorted.map((feature, index) => {
    const p = feature.properties || {};
    const key = getFeatureKey(feature, index);
    const label = `${p.titlu || "Lucrare"}${p.nume_artist ? " — " + p.nume_artist : ""}`;
    state.featureSearchMap[label] = key;
    return `<option value="${escapeAttr(label)}"></option>`;
  }).join("");
}

function populateYearOptions(features) {
  if (!yearSelectEl) return;
  const years = [...new Set(features.map(getFeatureYear))].sort((a, b) => {
    if (a === "Necunoscut") return 1;
    if (b === "Necunoscut") return -1;
    return Number(a) - Number(b);
  });
  yearSelectEl.innerHTML = `<option value="">Toți anii</option>` + years.map((year) => `<option value="${escapeAttr(year)}">${escapeHtml(year)}</option>`).join("");
}

function populateFilters(features) {
  populateSearchOptions(features);
  populateYearOptions(features);
}

function syncControls() {
  if (searchInputEl) {
    const selectedLabel = Object.keys(state.featureSearchMap).find((label) => state.featureSearchMap[label] === state.selectedFeatureKey) || "";
    searchInputEl.value = selectedLabel;
  }
  if (yearSelectEl) yearSelectEl.value = state.selectedYear;
}

function refreshSearchOptionsAndControls() {
  populateSearchOptions(getSearchOptionFeatures());
  syncControls();
}

function renderLegendItems(container, colorMap, counts) {
  if (!container) return;
  const activeLayer = state.activeLayer;
  const activeYear = state.selectedYear;
  container.innerHTML = "";
  sortLayers(Object.keys(counts)).forEach((layer) => {
    const count = counts[layer];
    const layerYear = getLayerYear(layer);
    const isActive = activeLayer === layer || Boolean(activeYear && layerYear === activeYear);
    const shouldDim = Boolean((activeLayer || activeYear) && !isActive);
    const li = document.createElement("li");
    if (isActive) li.classList.add("active");
    else if (shouldDim) li.classList.add("dimmed");
    li.innerHTML = `<span class="legend-swatch" style="background:${colorMap[layer]}"></span>
      <span class="legend-text"><span class="legend-title">${escapeHtml(layer)}</span><span class="legend-sub">${count} lucrări</span></span>`;
    li.addEventListener("click", () => {
      state.selectedYear = "";
      state.selectedFeatureKey = "";
      toggleLayerFilter(layer);
    });
    container.appendChild(li);
  });
}

function updateLegends(colorMap, counts) {
  renderLegendItems(legendListEl, colorMap, counts);
  renderLegendItems(chartLegendEl, colorMap, counts);
}

function updateStats(filteredFeatures) {
  workCountEl.textContent = filteredFeatures.length;
  const parts = [];
  if (state.selectedFeatureKey) parts.push("lucrare selectată");
  if (state.selectedYear) parts.push(`an: ${state.selectedYear}`);
  if (state.activeLayer) parts.push(`filtru grafic: ${state.activeLayer}`);
  topbarSubtitleEl.textContent = parts.length ? `Filtru activ: ${parts.join(" · ")}` : "Toate lucrările";
}

function getFilteredFeatures() {
  return getAllFeatures().filter((feature, index) => {
    const layer = normalizeLayerName(feature.properties?.layer);
    const key = getFeatureKey(feature, index);
    if (state.selectedFeatureKey && key !== state.selectedFeatureKey) return false;
    if (state.selectedYear && getFeatureYear(feature) !== state.selectedYear) return false;
    if (state.activeLayer && layer !== state.activeLayer) return false;
    return true;
  });
}

function renderMarkers(features, colorMap) {
  state.clusterGroup.clearLayers();
  state.markers = features.map((feature) => {
    const layer = normalizeLayerName(feature.properties?.layer);
    return makeMarker(feature, colorMap[layer]);
  });
  state.clusterGroup.addLayers(state.markers);
  if (state.markers.length) {
    const group = L.featureGroup(state.markers);
    map.fitBounds(group.getBounds().pad(0.12), { maxZoom: state.selectedFeatureKey ? 18 : 14 });
    if (state.selectedFeatureKey && state.markers.length === 1) {
      setTimeout(() => state.markers[0].openPopup(), 250);
    }
  }
}

function buildChart(counts, colorMap) {
  const ctx = document.getElementById("layerChart");
  const labels = sortLayers(Object.keys(counts));
  const values = labels.map((l) => counts[l]);
  const colors = labels.map((l) => colorMap[l]);
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#ffffff", borderWidth: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw}` } }
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        state.selectedYear = "";
        state.selectedFeatureKey = "";
        toggleLayerFilter(labels[elements[0].index]);
      }
    }
  });
}

function toggleLayerFilter(layer) {
  state.activeLayer = state.activeLayer === layer ? null : layer;
  refreshSearchOptionsAndControls();
  refreshUI();
}

function refreshUI() {
  const filtered = getFilteredFeatures();
  updateStats(filtered);
  updateLegends(state.colorMap, state.layerCounts);
  renderMarkers(filtered, state.colorMap);
}

function resetAllFilters() {
  state.activeLayer = null;
  state.selectedFeatureKey = "";
  state.selectedYear = "";
  refreshSearchOptionsAndControls();
  refreshUI();
}

function applySearchInput() {
  if (!searchInputEl) return;
  const label = searchInputEl.value.trim();
  state.selectedFeatureKey = state.featureSearchMap[label] || "";
  state.activeLayer = null;
  refreshUI();
}

function openLightbox(url) {
  if (!lightboxEl || !lightboxImageEl) return;
  lightboxImageEl.src = url;
  lightboxEl.classList.add("open");
  lightboxEl.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  if (!lightboxEl || !lightboxImageEl) return;
  lightboxEl.classList.remove("open");
  lightboxEl.setAttribute("aria-hidden", "true");
  lightboxImageEl.src = "";
}

resetFilterBtn.addEventListener("click", resetAllFilters);

if (searchInputEl) {
  searchInputEl.addEventListener("input", () => {
    const label = searchInputEl.value.trim();
    if (state.featureSearchMap[label]) applySearchInput();
    else if (!label) {
      state.selectedFeatureKey = "";
      refreshUI();
    }
  });
  searchInputEl.addEventListener("change", applySearchInput);
  searchInputEl.addEventListener("search", () => {
    if (!searchInputEl.value.trim()) {
      state.selectedFeatureKey = "";
      refreshUI();
    }
  });
}

if (yearSelectEl) {
  yearSelectEl.addEventListener("change", () => {
    state.selectedYear = yearSelectEl.value;
    state.activeLayer = "";
    state.selectedFeatureKey = "";
    refreshSearchOptionsAndControls();
    refreshUI();
  });
}

if (lightboxCloseEl) lightboxCloseEl.addEventListener("click", closeLightbox);
if (lightboxEl) {
  lightboxEl.addEventListener("click", (event) => {
    if (event.target === lightboxEl) closeLightbox();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-lightbox-image]");
  if (!link) return;
  event.preventDefault();
  openLightbox(link.dataset.lightboxImage || link.href);
});

fetch("./zidart.geojson")
  .then((response) => response.json())
  .then((data) => {
    state.data = data;
    const features = data.features || [];
    state.layerCounts = computeLayerCounts(features);
    state.colorMap = getColorMap(state.layerCounts);
    populateFilters(features);
    buildChart(state.layerCounts, state.colorMap);
    refreshUI();
  })
  .catch((error) => {
    console.error("Nu am putut încărca fișierul GeoJSON:", error);
    topbarSubtitleEl.textContent = "Eroare la încărcarea datelor";
  });
