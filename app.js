const COLORS = [
  "#2F80ED", "#F2994A", "#27AE60", "#EB5757",
  "#9B51E0", "#56CCF2", "#F2C94C", "#6FCF97",
  "#BB6BD9", "#FF8A65", "#26A69A", "#5C6BC0"
];

const state = {
  data: null,
  markers: [],
  activeLayer: null,
  chart: null,
  layerCounts: {}
};

const workCountEl = document.getElementById("workCount");
const layerCountEl = document.getElementById("layerCount");
const legendListEl = document.getElementById("legendList");
const topbarSubtitleEl = document.getElementById("topbarSubtitle");
const resetFilterBtn = document.getElementById("resetFilterBtn");

const map = L.map("map", {
  zoomControl: true,
  minZoom: 6
}).setView([46.57, 26.92], 11);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }
).addTo(map);

function splitDescription(text) {
  if (!text) return { ro: "", en: "" };
  const cleaned = String(text).replace(/<br\s*\/?>/gi, "\n").trim();
  const match = cleaned.match(/(?:^|\n)\s*(EN|ENG)\s*[:\-]?\s*\n?/i);
  if (!match) return { ro: cleaned, en: "" };
  const idx = match.index;
  return {
    ro: cleaned.slice(0, idx).trim(),
    en: cleaned.slice(idx).replace(/^(EN|ENG)\s*[:\-]?\s*/i, "").trim()
  };
}

function getImageUrls(properties) {
  return Object.keys(properties)
    .filter(k => /^image_\d+$/i.test(k) && properties[k])
    .map(k => properties[k]);
}

function popupHtml(feature, color) {
  const p = feature.properties || {};
  const images = getImageUrls(p);
  const description = splitDescription(p.descriere);
  const descriptionBlock = description.ro || description.en
    ? `
      <div class="popup-section-title">Descriere</div>
      <div class="popup-grid">
        ${description.ro ? `
          <div class="popup-field full">
            <span class="popup-label">RO</span>
            <div class="popup-value">${escapeHtml(description.ro)}</div>
          </div>` : ""}
        ${description.en ? `
          <div class="popup-field full">
            <span class="popup-label">EN</span>
            <div class="popup-value">${escapeHtml(description.en)}</div>
          </div>` : ""}
      </div>`
    : "";

  const gallery = images.length
    ? `
      <div class="popup-section-title">Galerie foto</div>
      <div class="popup-gallery">
        ${images.map((img) => `
          <a href="${img}" target="_blank" rel="noopener noreferrer">
            <img src="${img}" alt="${escapeAttr(p.titlu || "Imagine ZIDART")}">
          </a>`).join("")}
      </div>`
    : `<div class="popup-section-title">Galerie foto</div><div class="popup-empty">Nu există imagini disponibile pentru această lucrare.</div>`;

  return `
    <div class="popup-card">
      <div class="popup-hero" style="box-shadow: inset 0 0 0 9999px rgba(0,0,0,.06);">
        <span class="popup-badge" style="background:${color}22;border-color:${color}55;">ZIDART</span>
        <div class="popup-title">${escapeHtml(p.titlu || "Lucrare")}</div>
        <div class="popup-layer">${escapeHtml(p.layer || "")}</div>
      </div>
      <div class="popup-body">
        <div class="popup-grid">
          ${p.nume_artist ? `
          <div class="popup-field">
            <span class="popup-label">Nume artist</span>
            <div class="popup-value">${escapeHtml(p.nume_artist)}</div>
          </div>` : ""}
          ${p.suprafata_lucrare ? `
          <div class="popup-field">
            <span class="popup-label">Suprafață lucrare</span>
            <div class="popup-value">${escapeHtml(p.suprafata_lucrare)}</div>
          </div>` : ""}
          ${p.adresa_lucrare ? `
          <div class="popup-field full">
            <span class="popup-label">Adresă lucrare</span>
            <div class="popup-value">${escapeHtml(p.adresa_lucrare)}</div>
          </div>` : ""}
        </div>
        ${descriptionBlock}
        ${gallery}
      </div>
    </div>
  `;
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

function makeMarker(feature, color) {
  const coords = feature.geometry?.coordinates || [];
  const lat = coords[1];
  const lng = coords[0];
  const icon = L.divIcon({
    className: "",
    html: `<div class="zidart-marker" style="width:18px;height:18px;background:${color};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12]
  });

  const marker = L.marker([lat, lng], { icon });
  marker.feature = feature;
  marker.bindPopup(popupHtml(feature, color), {
    className: "zidart-popup",
    maxWidth: 440
  });
  return marker;
}

function computeLayerCounts(features) {
  return features.reduce((acc, feature) => {
    const key = feature.properties?.layer || "Necategorizat";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getColorMap(counts) {
  const entries = Object.keys(counts);
  return Object.fromEntries(entries.map((layer, i) => [layer, COLORS[i % COLORS.length]]));
}

function updateLegend(colorMap, counts) {
  const active = state.activeLayer;
  legendListEl.innerHTML = "";
  Object.entries(counts).forEach(([layer, count]) => {
    const li = document.createElement("li");
    if (active === layer) li.classList.add("active");
    li.innerHTML = `
      <span class="legend-swatch" style="background:${colorMap[layer]}"></span>
      <span class="legend-text">
        <span class="legend-title">${layer}</span>
        <span class="legend-sub">${count} lucrări</span>
      </span>
    `;
    li.addEventListener("click", () => toggleLayerFilter(layer));
    legendListEl.appendChild(li);
  });
}

function updateStats(filteredFeatures, allCounts) {
  workCountEl.textContent = filteredFeatures.length;
  layerCountEl.textContent = Object.keys(allCounts).length;
  topbarSubtitleEl.textContent = state.activeLayer
    ? `Filtru activ: ${state.activeLayer}`
    : "Toate lucrările";
}

function renderMarkers(features, colorMap) {
  state.markers.forEach(marker => map.removeLayer(marker));
  state.markers = features.map(feature => {
    const layer = feature.properties?.layer || "Necategorizat";
    const marker = makeMarker(feature, colorMap[layer]);
    marker.addTo(map);
    return marker;
  });

  const group = L.featureGroup(state.markers);
  if (state.markers.length) {
    map.fitBounds(group.getBounds().pad(0.12), { maxZoom: 14 });
  }
}

function getFilteredFeatures() {
  const features = state.data?.features || [];
  if (!state.activeLayer) return features;
  return features.filter(f => f.properties?.layer === state.activeLayer);
}

function buildChart(counts, colorMap) {
  const ctx = document.getElementById("layerChart");
  const labels = Object.keys(counts);
  const values = labels.map(l => counts[l]);
  const colors = labels.map(l => colorMap[l]);

  if (state.chart) state.chart.destroy();

  state.chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.raw}`
          }
        }
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        toggleLayerFilter(labels[index]);
      }
    }
  });
}

function toggleLayerFilter(layer) {
  state.activeLayer = state.activeLayer === layer ? null : layer;
  refreshUI();
}

function refreshUI() {
  const filtered = getFilteredFeatures();
  updateStats(filtered, state.layerCounts);
  updateLegend(state.colorMap, state.layerCounts);
  renderMarkers(filtered, state.colorMap);
}

resetFilterBtn.addEventListener("click", () => {
  state.activeLayer = null;
  refreshUI();
});

fetch("./zidart.geojson")
  .then(response => response.json())
  .then(data => {
    state.data = data;
    state.layerCounts = computeLayerCounts(data.features || []);
    state.colorMap = getColorMap(state.layerCounts);
    buildChart(state.layerCounts, state.colorMap);
    refreshUI();
  })
  .catch(error => {
    console.error("Nu am putut încărca fișierul GeoJSON:", error);
    topbarSubtitleEl.textContent = "Eroare la încărcarea datelor";
  });
