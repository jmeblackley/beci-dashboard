// Revised application logic for the BECI dashboard POC.
require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/ImageryLayer",
  "esri/layers/ImageryTileLayer",
  "esri/layers/FeatureLayer",
  "esri/widgets/Legend",
  "esri/widgets/ScaleBar",
  "esri/widgets/TimeSlider",
  "esri/Basemap",
  "esri/layers/TileLayer",
  "esri/layers/VectorTileLayer"
], function (
  esriConfig,
  Map,
  MapView,
  ImageryLayer,
  ImageryTileLayer,
  FeatureLayer,
  Legend,
  ScaleBar,
  TimeSlider,
  Basemap,
  TileLayer,
  VectorTileLayer
) {
  // ---- Runtime configuration ----
  const CFG = window.BECI_CONFIG || {};
  esriConfig.apiKey = CFG.apiKey || "";

  const wantsCustomSR = !!(CFG.spatialReference && CFG.basemapUrl);
  const spatialRef = wantsCustomSR ? CFG.spatialReference : { wkid: 3857 };
  const items = CFG.items || {};

  // Oceans basemap without bathy labels + vector reference
  const oceansNoDepths = new Basemap({
    baseLayers: [
      new TileLayer({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer"
      })
    ],
    referenceLayers: [
      new VectorTileLayer({
        portalItem: { id: "14fbc125ccc9488888b014db09f35f67" }
      })
    ]
  });

  // ---- Map and view ----
  let map;
  if (wantsCustomSR) {
    map = new Map({
      basemap: {
        baseLayers: [ new ImageryLayer({ url: CFG.basemapUrl, spatialReference: spatialRef }) ],
        spatialReference: spatialRef
      }
    });
  } else {
    map = new Map({ basemap: oceansNoDepths });
  }

  const view = new MapView({
    container: "viewDiv",
    map,
    spatialReference: spatialRef,
    center: [180, 35],
    zoom: 3,
    constraints: { wrapAround: false, rotationEnabled: false, snapToZoom: false }
  });

  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // ---- Legend in left panel ----
  const legendDiv = document.getElementById('legendDiv');
  let legend;
  if (legendDiv) legend = new Legend({ view, container: legendDiv });

  // ---- Time-aware rasters ----
  const sstMonthly = new ImageryTileLayer({
    portalItem: { id: items.sstMonthlyId || "8c551d176e0e48ddaec623545f4899f2" },
    title: "SST (Monthly)",
    visible: true
  });
  const sstAnnual = new ImageryTileLayer({
    portalItem: { id: items.sstAnnualId || "91743c7b6f354494acc8c822e2a40df6" },
    title: "SST (Annual)",
    visible: false
  });
  const mhwLayer = new ImageryTileLayer({
    portalItem: { id: items.mhwMonthlyId || "3eb9dc4649204d0498760ead24c58afc" },
    title: "Marine Heat Wave (Monthly)",
    visible: false
  });
  const chlMonthly = new ImageryTileLayer({
    portalItem: { id: items.chlMonthlyId || "f08e5246b0814aabb1df13dae5ec862b" },
    title: "Chlorophyll (Monthly)",
    visible: false
  });

  const rasters = [sstMonthly, sstAnnual, chlMonthly];
  map.addMany(rasters);
  map.add(mhwLayer);

  // ---- LME boundaries (optional) ----
  let lmeLayer = null;
  if (items.lmeId) {
    lmeLayer = new FeatureLayer({
      portalItem: { id: items.lmeId },
      title: "LME boundaries",
      visible: false
    });
    map.add(lmeLayer);
  }

  // ---- Species/admin overlays ----
  const speciesItemId = items.speciesCollectionId || "f97d35b2f30c4c1fb29df6c7df9030d5";
  const adminAreas = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 3, title: "Admin areas", opacity: 0.25, visible: true });
  const spLines    = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 2, title: "Species shift (lines)", visible: true });
  const spStart    = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 1, title: "Species shift (start)", visible: true });
  const spEnd      = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 0, title: "Species shift (end)", visible: true });
  map.addMany([adminAreas, spLines, spStart, spEnd]);

  // ---- Fish impact layers (IDs now read from config) ----
  // Helpers (unchanged from previous step) for renderers
  function parseHexColor(hex, alpha = 1) {
    if (!hex) return [128, 128, 128, alpha];
    const h = hex.trim().replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.substr(0, 2), 16);
    const g = parseInt(full.substr(2, 2), 16);
    const b = parseInt(full.substr(4, 2), 16);
    return [r, g, b, alpha];
  }
  function dedupe(arr, keyFn) {
    const s = new Set();
    return arr.filter(v => {
      const k = keyFn(v);
      if (s.has(k)) return false;
      s.add(k);
      return true;
    });
  }
  const IMPACT_PALETTE = [
    [38, 70, 83, 1], [231, 111, 81, 1], [42, 157, 143, 1], [244, 162, 97, 1],
    [233, 196, 106, 1], [90, 122, 166, 1], [188, 80, 144, 1], [124, 173, 67, 1],
  ];
  function pickImpactColor(index) { return IMPACT_PALETTE[index % IMPACT_PALETTE.length]; }

  const impactLayer = new FeatureLayer({
    portalItem: { id: items.impactMapId || "5a820135359e42ac9fe107e3043e5a33" },
    title: "Impact Map",
    visible: false,
    outFields: ["*"],
    popupTemplate: { title: "{Impact_Type}", content: "{popup}" }
  });
  const stockLayer = new FeatureLayer({
    portalItem: { id: items.stockStatusId || "7ac11d00696c4760bd80666254ca2c6f" },
    title: "Stock Status",
    visible: false,
    outFields: ["*"],
    popupTemplate: { title: "{species_name}", content: "{popup}" }
  });
  map.addMany([impactLayer, stockLayer]);

  // Renderers (unchanged logic)
  function applyStockRenderer() {
    stockLayer.queryFeatures({
      where: "status_label IS NOT NULL",
      outFields: ["status_label", "status_color"],
      returnGeometry: false
    }).then((fs) => {
      const rows = fs.features.map(f => ({
        label: f.attributes.status_label,
        color: f.attributes.status_color
      }));
      const uniq = dedupe(rows, r => `${r.label}|${r.color}`);
      const uniqueValueInfos = uniq.map((r) => ({
        value: r.label,
        label: r.label,
        symbol: {
          type: "simple-marker",
          size: 9,
          color: parseHexColor(r.color, 0.95),
          outline: { color: [255, 255, 255, 0.7], width: 0.5 }
        }
      }));
      stockLayer.renderer = {
        type: "unique-value",
        field: "status_label",
        defaultSymbol: {
          type: "simple-marker",
          size: 9,
          color: [150, 150, 150, 0.9],
          outline: { color: [255, 255, 255, 0.7], width: 0.5 }
        },
        defaultLabel: "Other/Unknown",
        uniqueValueInfos
      };
    });
  }

  function applyImpactRenderer() {
    impactLayer.queryFeatures({
      where: "Impact_Type IS NOT NULL",
      outFields: ["Impact_Type"],
      returnGeometry: false
    }).then((fs) => {
      const types = dedupe(
        fs.features.map(f => f.attributes.Impact_Type).filter(Boolean),
        t => t
      );
      const uniqueValueInfos = types.map((t, i) => ({
        value: t,
        label: t,
        symbol: {
          type: "simple-marker",
          size: 10,
          color: pickImpactColor(i),
          outline: { color: [255, 255, 255, 0.7], width: 0.5 }
        }
      }));
      impactLayer.renderer = {
        type: "unique-value",
        field: "Impact_Type",
        defaultSymbol: {
          type: "simple-marker",
          size: 10,
          color: [120, 120, 120, 0.9],
          outline: { color: [255, 255, 255, 0.7], width: 0.5 }
        },
        defaultLabel: "Other/Unspecified",
        uniqueValueInfos,
        visualVariables: [
          {
            type: "size",
            valueExpression: `
              var s = Upper($feature.Severity);
              Decode(s,
                'LOW', 6,
                'MEDIUM', 10,
                'MODERATE', 10,
                'HIGH', 14,
                9
              );
            `,
            minDataValue: 6,
            maxDataValue: 14
          }
        ]
      };
    });
  }

  applyStockRenderer();
  applyImpactRenderer();

  // ---- TimeSlider ----
  const timeSlider = new TimeSlider({ view, mode: "time-window" });
  view.ui.add(timeSlider, "bottom-right");
  timeSlider.playRate = 1000;
  timeSlider.loop = true;

  function bindSliderTo(layer) {
    if (!layer) {
      timeSlider.fullTimeExtent = null;
      timeSlider.values = null;
      view.timeExtent = null;
      return;
    }
    layer.load().then(() => {
      const ti = layer.timeInfo;
      if (!ti || !ti.fullTimeExtent) {
        timeSlider.fullTimeExtent = null;
        timeSlider.values = null;
        view.timeExtent = null;
        return;
      }
      timeSlider.fullTimeExtent = ti.fullTimeExtent;
      const guessedInterval = (layer === sstAnnual)
        ? { interval: { unit: "years", value: 1 } }
        : { interval: { unit: "months", value: 1 } };
      const serviceInterval = ti.interval;
      const stops = serviceInterval ? { interval: serviceInterval } : guessedInterval;
      timeSlider.stops = stops;
      timeSlider.values = [ti.fullTimeExtent.start, ti.fullTimeExtent.end];
      view.timeExtent = timeSlider.timeExtent;
    });
  }

  function setOnlyVisible(activeLayer) {
    rasters.forEach((layer) => { layer.visible = (layer === activeLayer); });
    bindSliderTo(activeLayer);
  }

  bindSliderTo(sstMonthly);
  timeSlider.watch("timeExtent", (te) => { view.timeExtent = te; });

  // ---- Raster radio buttons ----
  const radios = document.querySelectorAll('input[name="rasterChoice"]');
  radios.forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      switch (r.value) {
        case "sstMonthly": setOnlyVisible(sstMonthly); break;
        case "sstAnnual":  setOnlyVisible(sstAnnual);  break;
        case "chlMonthly": setOnlyVisible(chlMonthly); break;
        default: break;
      }
    });
  });

  // ---- Overlay checkboxes ----
  const chkAdmin = document.getElementById("chkAdmin");
  const chkLines = document.getElementById("chkLines");
  const chkStart = document.getElementById("chkStart");
  const chkEnd   = document.getElementById("chkEnd");
  if (chkAdmin) chkAdmin.addEventListener("change", () => { adminAreas.visible = chkAdmin.checked; });
  if (chkLines) chkLines.addEventListener("change", () => { spLines.visible    = chkLines.checked; });
  if (chkStart) chkStart.addEventListener("change", () => { spStart.visible    = chkStart.checked; });
  if (chkEnd)   chkEnd.addEventListener("change", () => { spEnd.visible        = chkEnd.checked; });

  const chkMHW = document.getElementById("chkMHW");
  if (chkMHW && mhwLayer) chkMHW.addEventListener("change", () => { mhwLayer.visible = chkMHW.checked; });
  const chkLME = document.getElementById("chkLME");
  if (chkLME && lmeLayer) chkLME.addEventListener("change", () => { lmeLayer.visible = chkLME.checked; });

  // ---- Fish layer toggles (resilient to late DOM insertion) ----
  const chkStock  = document.getElementById("chkStock");   // optional
  const chkImpact = document.getElementById("chkImpact");  // optional

  function syncFishToggles() {
    const stockOn  = chkStock  ? !!chkStock.checked  : true;
    const impactOn = chkImpact ? !!chkImpact.checked : true;
    stockLayer.visible  = stockOn;
    impactLayer.visible = impactOn;
    if (legend) legend.view = view; // keep legend current
  }

  if (chkStock)  chkStock.addEventListener("change", syncFishToggles);
  if (chkImpact) chkImpact.addEventListener("change", syncFishToggles);

  // NEW: if checkboxes appear later (e.g., panel lazy-render), delegation still works
  document.addEventListener("change", (e) => {
    if (e.target && (e.target.id === "chkStock" || e.target.id === "chkImpact")) {
      syncFishToggles();
    }
  });

  // ---- Themes ----
  const themes = {
    intro: {
      title: "Orientation",
      content:
        "<p>Welcome to the BECI dashboard. Use the tabs above to explore different aspects of the ocean–climate–fisheries system. This introduction provides orientation with branding, infographics and copy.</p>",
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: false,
      showTimeSlider: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        if (lmeLayer) lmeLayer.visible = false;
        bindSliderTo(null);
        impactLayer.visible = false;
        stockLayer.visible = false;
      }
    },
    env: {
      title: "Baseline state",
      content:
        "<p>Environmental conditions such as sea surface temperature (SST) and chlorophyll-<i>a</i> provide a baseline context. Use the radio buttons below to choose a dataset and scrub through time with the slider.</p>",
      showLayerPanel: true,
      showVectorPanel: true,
      showPressuresPanel: false,
      showJurisPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        const checked = document.querySelector('input[name="rasterChoice"]:checked');
        if (checked) {
          if (checked.value === "sstMonthly") setOnlyVisible(sstMonthly);
          if (checked.value === "sstAnnual")  setOnlyVisible(sstAnnual);
          if (checked.value === "chlMonthly") setOnlyVisible(chlMonthly);
        } else {
          setOnlyVisible(sstMonthly);
        }
        if (mhwLayer) mhwLayer.visible = false;
        if (lmeLayer) lmeLayer.visible = false;
        impactLayer.visible = false;
        stockLayer.visible = false;
      }
    },
    pressures: {
      title: "Stress events",
      content:
        "<p>Explore environmental stress events such as marine heatwaves. Use the checkbox below to toggle the heatwave mask and scrub the timeline.</p>",
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: true,
      showJurisPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        bindSliderTo(null);
        if (mhwLayer) {
          mhwLayer.visible = chkMHW ? chkMHW.checked : true;
          bindSliderTo(mhwLayer);
        }
        if (lmeLayer) lmeLayer.visible = false;
        adminAreas.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
        impactLayer.visible = false;
        stockLayer.visible = false;
      }
    },
    jurisdictions: {
      title: "Governance",
      content:
        "<p>View management jurisdictions such as Large Marine Ecosystems (LMEs). Toggle boundaries below. Time series are not applicable here.</p>",
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: true,
      showTimeSlider: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        bindSliderTo(null);
        if (lmeLayer) lmeLayer.visible = chkLME ? chkLME.checked : true;
        adminAreas.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
        impactLayer.visible = false;
        stockLayer.visible = false;
      }
    },
    fish: {
      title: "Ecosystem effects",
      content:
        "<p>This tab displays point layers representing fish stock status and observed ecosystem impacts. Click or tap on a point to view detailed information in a popup.</p>",
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: false,
      showTimeSlider: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        if (lmeLayer) lmeLayer.visible = false;
        bindSliderTo(null);
        adminAreas.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;

        // Ensure fish layers reflect current (or default) checkbox state
        syncFishToggles();
      }
    }
  };

  // ---- Panel wiring ----
  const layerPanelEl     = document.getElementById('layerPanel');
  const vectorPanelEl    = document.getElementById('vectorPanel');
  const pressuresPanelEl = document.getElementById('pressuresPanel');
  const jurisPanelEl     = document.getElementById('jurisPanel');
  const themeTitleEl     = document.getElementById('themeTitle');
  const themeContentEl   = document.getElementById('themeContent');
  const tabButtons       = document.querySelectorAll('.tab');

  function showPanel(el, show) { if (el) el.style.display = show ? '' : 'none'; }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-theme');
      if (!key || !themes[key]) return;
      tabButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      const theme = themes[key];
      if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = theme.title;
      if (themeContentEl) themeContentEl.innerHTML = theme.content;
      showPanel(layerPanelEl,     theme.showLayerPanel);
      showPanel(vectorPanelEl,    theme.showVectorPanel);
      showPanel(pressuresPanelEl, theme.showPressuresPanel);
      showPanel(jurisPanelEl,     theme.showJurisPanel);
      timeSlider.visible = theme.showTimeSlider;
      theme.activateLayers();
    });
  });

  // Initial theme
  (function initTheme() {
    const key = 'intro';
    const theme = themes[key];
    if (!theme) return;
    tabButtons.forEach((b) => {
      const isActive = b.getAttribute('data-theme') === key;
      b.classList.toggle('is-active', isActive);
    });
    if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = theme.title;
    if (themeContentEl) themeContentEl.innerHTML = theme.content;
    showPanel(layerPanelEl,     theme.showLayerPanel);
    showPanel(vectorPanelEl,    theme.showVectorPanel);
    showPanel(pressuresPanelEl, theme.showPressuresPanel);
    showPanel(jurisPanelEl,     theme.showJurisPanel);
    timeSlider.visible = theme.showTimeSlider;
    theme.activateLayers();

    // Ensure fish layer visibility matches any existing checkboxes at load
    syncFishToggles();
  })();
});
