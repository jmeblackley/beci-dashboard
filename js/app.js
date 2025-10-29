/* Simplified BECI dashboard with a working TimeSlider bound to the visible time-aware layer */

require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Legend",
  "esri/widgets/ScaleBar",
  "esri/widgets/TimeSlider",
  "esri/layers/TileLayer",
  "esri/layers/ImageryLayer",
  "esri/layers/ImageryTileLayer",
  "esri/geometry/Extent",
  "esri/geometry/Polygon"
], function (
  esriConfig,
  Map,
  MapView,
  Legend,
  ScaleBar,
  TimeSlider,
  TileLayer,
  ImageryLayer,
  ImageryTileLayer,
  Extent,
  Polygon
) {
  // ---- Runtime config / basemap ----
  const RC = window.BECI_CONFIG || {};
  esriConfig.apiKey = RC.apiKey || "";

  const wantsCustomSR = !!(RC.spatialReference && RC.basemapUrl);
  const map = new Map({ basemap: wantsCustomSR ? null : "oceans" });

  if (wantsCustomSR) {
    const baseLayer =
      RC.basemapType === "imagery"
        ? new ImageryLayer({ url: RC.basemapUrl, spatialReference: RC.spatialReference })
        : new TileLayer({ url: RC.basemapUrl, spatialReference: RC.spatialReference });

    map.basemap = { baseLayers: [baseLayer], spatialReference: RC.spatialReference };
  }

  // ---- Operational layers (time-enabled) ----
  const sstAnnual = new ImageryTileLayer({
    portalItem: { id: "91743c7b6f354494acc8c822e2a40df6" },
    title: "SST (Annual)",
    visible: true
  });

  const sstMonthly = new ImageryTileLayer({
    portalItem: { id: "8c551d176e0e48ddaec623545f4899f2" },
    title: "SST (Monthly)",
    visible: false
  });

  map.addMany([sstAnnual, sstMonthly]);

  // ---- MapView (pacific-centred clamp) ----
  const bbox = { xmin: -256.921871, ymin: -15.388022, xmax: -100.828121, ymax: 79.534085 };
  const clampPoly4326 = new Polygon({
    spatialReference: { wkid: 4326 },
    rings: [[[bbox.xmin, bbox.ymin],[bbox.xmax, bbox.ymin],[bbox.xmax, bbox.ymax],[bbox.xmin, bbox.ymax],[bbox.xmin, bbox.ymin]]]
  });
  const pacificExtent4326 = new Extent({ spatialReference: { wkid: 4326 }, ...bbox });

  const view = new MapView({
    container: "view",
    map,
    extent: pacificExtent4326,
    spatialReference: wantsCustomSR ? RC.spatialReference : undefined,
    constraints: {
      geometry: clampPoly4326,
      wrapAround: false,
      rotationEnabled: false
    }
  });

  view.when(() => {
    view.goTo(pacificExtent4326, { animate: false }).then(() => {
      const currentScale = view.scale;
      let targetMinScale = currentScale * 1.5;
      if (view.constraints && view.constraints.lods?.length) {
        for (const lod of view.constraints.lods) {
          if (lod.scale > currentScale * 1.01) {
            targetMinScale = lod.scale;
            break;
          }
        }
      }
      view.constraints.minScale = targetMinScale;
    });
  });

  // ---- Widgets ----
  view.ui.add(new Legend({ view }), "bottom-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // ---- Simple theme text (unchanged UI) ----
  const themes = {
    intro: {
      title: "Introduction",
      content:
        "<p>The Basin Events to Coastal Impacts (BECI) dashboard aggregates ocean and fisheries intelligence to support decision makers...</p>",
      layersVisible: []
    },
    env: {
      title: "Environmental Conditions",
      content:
        "<p>Environmental conditions include sea surface temperature. Toggle annual vs monthly SST and use the time slider.</p>",
      layersVisible: ["sstAnnual", "sstMonthly"]
    },
    pressures: { title: "Environmental Pressures", content: "<p>Configure this theme with ocean pressures...</p>", layersVisible: [] },
    jurisdictions: { title: "Management Jurisdictions", content: "<p>Visualise management jurisdictions, maritime boundaries, and EEZs...</p>", layersVisible: [] },
    fish: { title: "Fish Impacts", content: "<p>Future enhancements could summarise stock assessments...</p>", layersVisible: [] }
  };

  const themeTitleEl = document.getElementById("themeTitle");
  const themeContentEl = document.getElementById("themeContent");
  const tabButtons = document.querySelectorAll(".tab");
  const layerPanel = document.getElementById("layerPanel");

  const chkAnnual = document.getElementById("toggleSST");  // Annual
  const chkMonthly = document.getElementById("toggleChl"); // Monthly

  // ---- TimeSlider: keep it always present; bind to the active layer ----
  // Mount the panel if present in the DOM
  const timePanel = document.getElementById("timePanel");
  if (timePanel) {
    timePanel.classList.add("esri-component", "esri-widget");
    view.ui.add(timePanel, { position: "top-right", index: 0 });
    timePanel.style.display = ""; // always show; we decide functionality below
  }

  const timeSlider = new TimeSlider({
    container: "timeSlider",
    view,
    mode: "time-window" // This will set and react to view.timeExtent
  });

  /**
   * Pick the first visible time-aware layer
   */
  function getActiveTimeLayer() {
    const candidates = [sstMonthly, sstAnnual]; // prefer monthly if both are toggled
    for (const lyr of candidates) {
      if (lyr?.visible && lyr.timeInfo) return lyr;
    }
    return null;
  }

  /**
   * Initialises/binds the slider to the layer's timeInfo
   */
  function bindSliderToLayer(layer) {
    if (!layer || !layer.timeInfo) {
      // If no time-aware layer is visible, clear the slider + view extent
      timeSlider.fullTimeExtent = null;
      timeSlider.values = null;
      view.timeExtent = null;
      return;
    }

    const { fullTimeExtent, interval } = layer.timeInfo;

    // If service has an interval, use it; otherwise choose sensible default
    const inferredInterval =
      interval ||
      (layer === sstMonthly
        ? { value: 1, unit: "months" }
        : { value: 1, unit: "years" });

    timeSlider.fullTimeExtent = fullTimeExtent;
    timeSlider.stops = { interval: inferredInterval };

    // Reset slider to full span each time we switch datasets
    timeSlider.values = [fullTimeExtent.start, fullTimeExtent.end];

    // view.timeExtent will be driven by the slider since it’s bound to view
    // (No extra watchers required)
  }

  /**
   * Update visible layers based on checkboxes and (re)bind slider
   */
  function applyVisibility() {
    const wantsAnnual = !!chkAnnual?.checked;
    const wantsMonthly = !!chkMonthly?.checked;

    // Only allow one SST series at a time for clarity
    // If both checked, prefer monthly
    sstMonthly.visible = wantsMonthly || (wantsMonthly && wantsAnnual);
    sstAnnual.visible = !sstMonthly.visible && wantsAnnual;

    bindSliderToLayer(getActiveTimeLayer());
  }

  // Layer ready => (re)bind if this one is active
  sstAnnual.when(() => { if (sstAnnual.visible) bindSliderToLayer(sstAnnual); });
  sstMonthly.when(() => { if (sstMonthly.visible) bindSliderToLayer(sstMonthly); });

  // Checkbox handlers
  if (chkAnnual)  chkAnnual.addEventListener("change", applyVisibility);
  if (chkMonthly) chkMonthly.addEventListener("change", applyVisibility);

  // ---- Theme switching kept minimal; env shows layer panel; others hide it
  let currentTheme = "intro";
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-theme");
      if (!key) return;
      currentTheme = key;

      tabButtons.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-theme") === key)
      );

      const t = themes[key];
      if (themeTitleEl) themeTitleEl.textContent = t.title;
      if (themeContentEl) themeContentEl.innerHTML = t.content;
      if (layerPanel) layerPanel.style.display = t.layersVisible?.length ? "block" : "none";

      // When entering a non-env theme, hide both SST layers and clear slider
      if (!(t.layersVisible?.length)) {
        sstAnnual.visible = false;
        sstMonthly.visible = false;
        bindSliderToLayer(null);
      } else {
        // env theme: apply current checkboxes to decide active time layer
        applyVisibility();
      }
    });
  });

  // Wait for both layers, then start on "intro"
  Promise.all([sstAnnual.when(), sstMonthly.when()]).then(() => {
    // Start on intro with slider idle
    themeTitleEl && (themeTitleEl.textContent = themes.intro.title);
    themeContentEl && (themeContentEl.innerHTML = themes.intro.content);
    layerPanel && (layerPanel.style.display = "none");
    // If you prefer to land directly on the env tab, uncomment:
    // document.querySelector('.tab[data-theme="env"]').click();
  });

  // ---- Sanity warnings ----
  if (RC.spatialReference && !RC.basemapUrl) {
    console.warn("[BECI] You specified a custom spatialReference but no basemapUrl...");
  }
  if (RC.basemapUrl && !RC.spatialReference) {
    console.warn("[BECI] You provided a custom basemapUrl without a spatialReference...");
  }
});
