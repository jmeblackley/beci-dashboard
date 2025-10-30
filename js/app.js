// Revised application logic for the BECI dashboard POC.
//
// This version restores the original TimeSlider behaviour (two‑thumb time
// window) while retaining the streamlined UI from the proof‑of‑concept.  It
// reads portal item IDs and other runtime options from `window.BECI_CONFIG`
// (loaded from config.local.js in the project root) and binds the slider to
// whichever time‑aware raster layer is currently visible.  Only one raster
// is shown at a time to avoid ambiguous temporal states.  Vector overlays
// (administrative areas and species shifts) are controlled via checkboxes.

require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/ImageryLayer",
  "esri/layers/ImageryTileLayer",
  "esri/layers/FeatureLayer",
  "esri/widgets/Legend",
  "esri/widgets/ScaleBar",
  "esri/widgets/TimeSlider"
], function (
  esriConfig,
  Map,
  MapView,
  ImageryLayer,
  ImageryTileLayer,
  FeatureLayer,
  Legend,
  ScaleBar,
  TimeSlider
) {
  // ---- Runtime configuration ----
  // Pull API key, spatial reference and portal item IDs from the injected
  // config.  The config is defined in `config.local.js` and attached to
  // window.BECI_CONFIG.  Fallbacks are provided for all values in case a
  // particular field is omitted.
  const CFG = window.BECI_CONFIG || {};
  esriConfig.apiKey = CFG.apiKey || "";

  // Determine whether to honour a custom spatial reference.  If both a
  // spatialReference and a corresponding basemapUrl are supplied via
  // the runtime config, we will attempt to use them; otherwise we
  // default to Web Mercator (wkid 3857).  Most Esri basemaps do not
  // support arbitrary projections, so using a custom SR without a
  // matching basemap will cause the map to fail to draw.
  const wantsCustomSR = !!(CFG.spatialReference && CFG.basemapUrl);
  const spatialRef = wantsCustomSR ? CFG.spatialReference : { wkid: 3857 };
  const items = CFG.items || {};

  // ---- Map and view ----
  // Use the Esri “oceans” basemap in Web Mercator unless the runtime
  // config specifies a different spatial reference.  A bespoke basemap
  // implementation (e.g. using a custom URL) could be added here if
  // necessary; for this POC the default basemap is sufficient.
  // Create the map.  If a custom basemap is requested (with SR and URL),
  // build a basemap from the provided layer; otherwise use the default
  // "oceans" basemap in Web Mercator.
  let map;
  if (wantsCustomSR) {
    map = new Map({ basemap: { baseLayers: [ new ImageryLayer({ url: CFG.basemapUrl, spatialReference: spatialRef }) ], spatialReference: spatialRef } });
  } else {
    map = new Map({ basemap: "oceans" });
  }
  const view = new MapView({
    container: "viewDiv",
    map,
    spatialReference: spatialRef,
    center: [180, 35],
    zoom: 3,
    constraints: { wrapAround: false, rotationEnabled: false, snapToZoom: false }
  });

  // Add a legend and a scale bar to help interpret the map.  The legend
  // automatically reflects the layers in the map’s operational stack.
  view.ui.add(new Legend({ view }), "bottom-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // ---- Time‑aware raster layers ----
  // Sea‑surface temperature (SST) monthly and annual layers are delivered
  // as tiled imagery services when published that way.  Chlorophyll is
  // served as a dynamic imagery service.  IDs are pulled from the config
  // where possible.  Only one of these rasters will be visible at any time.
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
  // Chlorophyll is published as a tiled imagery service (see service
  // description).  Use ImageryTileLayer instead of ImageryLayer so that
  // timeInfo and tiling information are respected.
  const chlMonthly = new ImageryTileLayer({
    portalItem: { id: items.chlMonthlyId || "f08e5246b0814aabb1df13dae5ec862b" },
    title: "Chlorophyll (Monthly)",
    visible: false
  });
  const rasters = [sstMonthly, sstAnnual, chlMonthly];
  map.addMany(rasters);

  // ---- Additional layers for other themes ----
  // Marine heatwave (MHW) mask.  Only create if an ID is provided in the
  // configuration under CFG.items.mhwId.  This is intended to be a
  // time-enabled imagery layer representing stress events.  It remains
  // invisible until the Environmental Pressures tab is active.
  let mhwLayer = null;
  if (items.mhwId) {
    mhwLayer = new ImageryTileLayer({
      portalItem: { id: items.mhwId },
      title: "MHW mask (monthly)",
      visible: false
    });
    map.add(mhwLayer);
  }

  // Large Marine Ecosystems (LME) boundaries.  Only create if an ID is
  // provided in the configuration under CFG.items.lmeId.  This is a
  // FeatureLayer representing governance boundaries.  It remains
  // invisible until the Management Jurisdictions tab is active.
  let lmeLayer = null;
  if (items.lmeId) {
    lmeLayer = new FeatureLayer({
      portalItem: { id: items.lmeId },
      title: "LME boundaries",
      visible: false
    });
    map.add(lmeLayer);
  }

  // ---- Vector overlay layers ----
  // The species/admin collection contains four sublayers: admin areas,
  // species shift lines, and start/end points.  Their visibility is
  // toggled independently via checkboxes in the UI.
  const speciesItemId = items.speciesCollectionId || "f97d35b2f30c4c1fb29df6c7df9030d5";
  const adminAreas = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 3, title: "Admin areas", opacity: 0.25, visible: true });
  const spLines    = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 2, title: "Species shift (lines)", visible: true });
  const spStart    = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 1, title: "Species shift (start)", visible: true });
  const spEnd      = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 0, title: "Species shift (end)", visible: true });
  map.addMany([adminAreas, spLines, spStart, spEnd]);

  // ---- TimeSlider widget ----
  // Create a TimeSlider with two thumbs (“time‑window” mode).  It is
  // injected into the map’s UI (bottom‑right) rather than using the
  // legacy custom time bar.  The slider is bound to whichever raster is
  // currently visible and time‑enabled.  When the user scrubs the slider,
  // the view’s timeExtent is updated to filter the raster accordingly.
  const timeSlider = new TimeSlider({
    view,
    mode: "time-window"
  });
  view.ui.add(timeSlider, "bottom-right");

  // Configure playback options.  Setting playRate defines how quickly
  // the slider thumbs advance when the play button is engaged (in
  // milliseconds per stop).  Enabling loop allows the animation to
  // restart automatically when it reaches the end of the range.  These
  // settings also ensure the play button is enabled when a time extent
  // and stops are defined.
  timeSlider.playRate = 1000; // one second per interval
  timeSlider.loop = true;

  /**
   * Bind the TimeSlider to the given raster layer.  This function waits
   * for the layer to finish loading so that its timeInfo becomes
   * available.  If no timeInfo is present, the slider is cleared.
   * @param {ImageryLayer|ImageryTileLayer} layer The active time‑aware layer.
   */
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
      // Determine the interval: use the service interval if defined,
      // otherwise guess monthly vs annual based on the selected layer.
      const guessedInterval = (layer === sstAnnual)
        ? { interval: { unit: "years", value: 1 } }
        : { interval: { unit: "months", value: 1 } };
      // Wrap the service interval in an object expected by the TimeSlider.
      // layer.timeInfo.interval is a TimeInterval object ({ value, unit }) but
      // timeSlider.stops must be of the form { interval: { value, unit } }.
      const serviceInterval = ti.interval;
      const stops = serviceInterval
        ? { interval: serviceInterval }
        : guessedInterval;
      timeSlider.stops = stops;
      // Reset slider to the full span of the raster.  This uses two
      // values (start and end) since the slider is in time‑window mode.
      timeSlider.values = [ti.fullTimeExtent.start, ti.fullTimeExtent.end];
      // When the slider values change, update the map’s time extent.
      view.timeExtent = timeSlider.timeExtent;
    });
  }

  /**
   * Make the specified layer visible and hide the others.  Afterwards,
   * bind the slider to the visible layer so that its timeInfo drives the
   * slider’s extent and interval.
   * @param {ImageryLayer|ImageryTileLayer} activeLayer The layer to show.
   */
  function setOnlyVisible(activeLayer) {
    rasters.forEach((layer) => {
      layer.visible = (layer === activeLayer);
    });
    bindSliderTo(activeLayer);
  }

  // Initial binding: SST monthly is visible by default.
  bindSliderTo(sstMonthly);

  // Listen for slider changes to keep the view’s time extent in sync.
  timeSlider.watch("timeExtent", (te) => {
    view.timeExtent = te;
  });

  // ---- UI wiring: raster radio buttons ----
  // Radio inputs defined in index.html control which raster is visible.
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

  // ---- UI wiring: vector overlay checkboxes ----
  // Toggle the visibility of the admin/species layers based on the
  // checkboxes in the sidebar.  Each checkbox has an id corresponding
  // to the layer it controls (e.g. chkAdmin => adminAreas).
  const chkAdmin = document.getElementById("chkAdmin");
  const chkLines = document.getElementById("chkLines");
  const chkStart = document.getElementById("chkStart");
  const chkEnd   = document.getElementById("chkEnd");
  if (chkAdmin) chkAdmin.addEventListener("change", () => { adminAreas.visible = chkAdmin.checked; });
  if (chkLines) chkLines.addEventListener("change", () => { spLines.visible    = chkLines.checked; });
  if (chkStart) chkStart.addEventListener("change", () => { spStart.visible    = chkStart.checked; });
  if (chkEnd)   chkEnd.addEventListener("change", () => { spEnd.visible      = chkEnd.checked; });

  // ---- Additional overlay checkboxes ----
  const chkMHW = document.getElementById("chkMHW");
  if (chkMHW && mhwLayer) {
    chkMHW.addEventListener("change", () => { mhwLayer.visible = chkMHW.checked; });
  }
  const chkLME = document.getElementById("chkLME");
  if (chkLME && lmeLayer) {
    chkLME.addEventListener("change", () => { lmeLayer.visible = chkLME.checked; });
  }

  // ---- Theme switching ----
  // Define per-theme configuration: title, content, and which panels/widgets
  // should be visible.  Descriptions may be replaced with actual copy and
  // infographics when available.
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
        // hide all rasters and overlays
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        if (lmeLayer) lmeLayer.visible = false;
        bindSliderTo(null);
      }
    },
    env: {
      title: "Baseline state",
      content:
        "<p>Environmental conditions such as sea surface temperature (SST) and chlorophyll‑<i>a</i> provide a baseline context. Use the radio buttons below to choose a dataset and scrub through time with the slider.</p>",
      showLayerPanel: true,
      showVectorPanel: true,
      showPressuresPanel: false,
      showJurisPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        // make sure only the selected raster is visible
        const checked = document.querySelector('input[name="rasterChoice"]:checked');
        if (checked) {
          if (checked.value === "sstMonthly") setOnlyVisible(sstMonthly);
          if (checked.value === "sstAnnual")  setOnlyVisible(sstAnnual);
          if (checked.value === "chlMonthly") setOnlyVisible(chlMonthly);
        } else {
          setOnlyVisible(sstMonthly);
        }
        // hide pressure/jurisdiction overlays
        if (mhwLayer) mhwLayer.visible = false;
        if (lmeLayer) lmeLayer.visible = false;
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
        // hide SST/Chl‑a rasters
        rasters.forEach(l => l.visible = false);
        bindSliderTo(null);
        // show MHW layer if exists
        if (mhwLayer) {
          mhwLayer.visible = chkMHW ? chkMHW.checked : true;
          // bind slider to MHW layer
          bindSliderTo(mhwLayer);
        }
        // hide species & LME overlays
        if (lmeLayer) lmeLayer.visible = false;
        adminAreas.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
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
        // hide all rasters and MHW
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        bindSliderTo(null);
        // show LME boundaries if exists
        if (lmeLayer) lmeLayer.visible = chkLME ? chkLME.checked : true;
        // hide species overlays by default
        adminAreas.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
      }
    },
    fish: {
      title: "Ecosystem effects",
      content:
        "<p>Future enhancements will include fish stock models and OBIS snapshots. Stay tuned for interactivity linking graphs and maps.</p>",
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
      }
    }
  };

  // Grab references to DOM panels to show/hide
  const layerPanelEl    = document.getElementById('layerPanel');
  const vectorPanelEl   = document.getElementById('vectorPanel');
  const pressuresPanelEl= document.getElementById('pressuresPanel');
  const jurisPanelEl    = document.getElementById('jurisPanel');
  const themeTitleEl    = document.getElementById('themeTitle');
  const themeContentEl  = document.getElementById('themeContent');
  const tabButtons      = document.querySelectorAll('.tab');

  // Helper to set panel visibility
  function showPanel(el, show) {
    if (!el) return;
    el.style.display = show ? '' : 'none';
  }

  // Theme switching handler
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-theme');
      if (!key || !themes[key]) return;
      // Set active tab
      tabButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      const theme = themes[key];
      // Update title and content
      if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = theme.title;
      if (themeContentEl) themeContentEl.innerHTML = theme.content;
      // Show/hide panels
      showPanel(layerPanelEl,    theme.showLayerPanel);
      showPanel(vectorPanelEl,   theme.showVectorPanel);
      showPanel(pressuresPanelEl,theme.showPressuresPanel);
      showPanel(jurisPanelEl,    theme.showJurisPanel);
      // Toggle time slider visibility
      timeSlider.visible = theme.showTimeSlider;
      // Activate layers accordingly
      theme.activateLayers();
    });
  });

  // On load, activate intro theme explicitly
  // On initial load, apply the intro theme settings: update UI and layer
  // visibility.  This mirrors the behaviour of clicking the "Introduction"
  // tab on startup.
  (function initTheme() {
    const key = 'intro';
    const theme = themes[key];
    if (!theme) return;
    // Set active tab class on the first tab (Introduction)
    tabButtons.forEach((b) => {
      const isActive = b.getAttribute('data-theme') === key;
      b.classList.toggle('is-active', isActive);
    });
    // Update title and content
    if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = theme.title;
    if (themeContentEl) themeContentEl.innerHTML = theme.content;
    // Show/hide panels
    showPanel(layerPanelEl,    theme.showLayerPanel);
    showPanel(vectorPanelEl,   theme.showVectorPanel);
    showPanel(pressuresPanelEl,theme.showPressuresPanel);
    showPanel(jurisPanelEl,    theme.showJurisPanel);
    // Toggle time slider visibility
    timeSlider.visible = theme.showTimeSlider;
    // Activate layers
    theme.activateLayers();
  })();
});