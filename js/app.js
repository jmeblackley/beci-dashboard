/*
 * BECI dashboard prototype (repo-structure aligned)
 * - SST (Annual) + SST (Monthly) — chlorophyll removed
 * - One TimeSlider that adapts to the active SST series (years vs months)
 * - Pacific-centred hard clamp to your bbox; initial view is absolute zoom-out
 */

/* global window, document */
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
  ImageryLayer,          // used only if RC.basemapType === "imagery"
  ImageryTileLayer,
  Extent,
  Polygon
) {
  // ---- Runtime config / basemap ----
  const RC = window.BECI_CONFIG || {};
  esriConfig.apiKey = RC.apiKey || "";
  const wantsCustomSR = !!(RC.spatialReference && RC.basemapUrl);

  const map = new Map({
    basemap: wantsCustomSR ? null : "oceans"
  });

  if (wantsCustomSR) {
    var baseLayer;
    if (RC.basemapType === "imagery") {
      baseLayer = new ImageryLayer({
        url: RC.basemapUrl,
        spatialReference: RC.spatialReference
      });
    } else {
      baseLayer = new TileLayer({
        url: RC.basemapUrl,
        spatialReference: RC.spatialReference
      });
    }
    map.basemap = {
      baseLayers: [baseLayer],
      spatialReference: RC.spatialReference
    };
  }

  // ---- Operational layers ----
  // SST (Annual) — existing item
  const sstAnnual = new ImageryTileLayer({
    portalItem: { id: "91743c7b6f354494acc8c822e2a40df6" },
    title: "SST (Annual)",
    visible: true
  });

  // SST (Monthly) — new item
  const sstMonthly = new ImageryTileLayer({
    portalItem: { id: "8c551d176e0e48ddaec623545f4899f2" },
    title: "SST (Monthly)",
    visible: false
  });

  map.addMany([sstAnnual, sstMonthly]);

  // ---- MapView (strict clamp to Pacific-centred bbox) ----
  const bbox = {
    xmin: -256.921871,
    ymin: -15.388022,
    xmax: -100.828121,
    ymax: 79.534085
  };

  const clampPoly4326 = new Polygon({
    spatialReference: { wkid: 4326 },
    rings: [[
      [bbox.xmin, bbox.ymin],
      [bbox.xmax, bbox.ymin],
      [bbox.xmax, bbox.ymax],
      [bbox.xmin, bbox.ymax],
      [bbox.xmin, bbox.ymin]
    ]]
  });

  const pacificExtent4326 = new Extent({
    spatialReference: { wkid: 4326 },
    xmin: bbox.xmin,
    ymin: bbox.ymin,
    xmax: bbox.xmax,
    ymax: bbox.ymax
  });

  const view = new MapView({
    container: "view",
    map: map,
    extent: pacificExtent4326,
    spatialReference: wantsCustomSR ? RC.spatialReference : undefined,
    constraints: {
      geometry: clampPoly4326,   // hard clamp to bbox
      wrapAround: false,
      rotationEnabled: false
      // minScale set after initial fit
    }
  });

  view.when(function () {
    view.goTo(pacificExtent4326, { animate: false }).then(function () {
      // Allow one additional zoom-out step beyond the initial view.
      var currentScale = view.scale;
      var targetMinScale = currentScale * 1.5;

      if (view.constraints && view.constraints.lods && view.constraints.lods.length) {
        for (var i = 0; i < view.constraints.lods.length; i++) {
          var lod = view.constraints.lods[i];
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
  view.ui.add(new Legend({ view: view }), "bottom-left");
  view.ui.add(new ScaleBar({ view: view, unit: "metric" }), "bottom-right");

  // ---- Themes (chl removed; two SST series) ----
  const themes = {
    intro: {
      title: "Introduction",
      content:
        "<p>The Basin Events to Coastal Impacts (BECI) dashboard aggregates ocean " +
        "and fisheries intelligence to support decision makers...</p>",
      layersVisible: []
    },
    env: {
      title: "Environmental Conditions",
      content:
        "<p>Environmental conditions include sea surface temperature. " +
        "Toggle annual vs monthly SST and use the time slider.</p>",
      layersVisible: ["sstAnnual", "sstMonthly"]
    },
    pressures: {
      title: "Environmental Pressures",
      content: "<p>Configure this theme with ocean pressures...</p>",
      layersVisible: []
    },
    jurisdictions: {
      title: "Management Jurisdictions",
      content:
        "<p>Visualise management jurisdictions, maritime boundaries, and EEZs...</p>",
      layersVisible: []
    },
    fish: {
      title: "Fish Impacts",
      content:
        "<p>Future enhancements could summarise stock assessments...</p>",
      layersVisible: []
    }
  };

  const themeTitleEl = document.getElementById("themeTitle");
  const themeContentEl = document.getElementById("themeContent");
  const tabButtons = document.querySelectorAll(".tab");
  const layerPanel = document.getElementById("layerPanel");
  const timePanel = document.getElementById("timePanel");

  // Reuse existing checkboxes in index.html:
  //  - #toggleSST = Annual
  //  - #toggleChl = Monthly (label text updated below)
  const chkAnnual = document.getElementById("toggleSST");
  const chkMonthly = document.getElementById("toggleChl");

  // Update label text (no short-circuit expressions → no JSHint W030)
  const labelAnnual = document.querySelector('label[for="toggleSST"]');
  if (labelAnnual && labelAnnual.lastChild) {
    labelAnnual.lastChild.textContent = " Sea Surface Temperature (Annual)";
  }
  const labelMonthly = document.querySelector('label[for="toggleChl"]');
  if (labelMonthly && labelMonthly.lastChild) {
    labelMonthly.lastChild.textContent = " Sea Surface Temperature (Monthly)";
  }

  // ---- One TimeSlider that adapts to the active SST series ----
  const timeSlider = new TimeSlider({
    container: "timeSlider",
    view: view,
    mode: "time-window"
  });

  function getActiveLayer() {
    if (chkMonthly && chkMonthly.checked && sstMonthly.visible) { return sstMonthly; }
    if (chkAnnual && chkAnnual.checked && sstAnnual.visible) { return sstAnnual; }
    return null;
  }

  function configureSliderFor(layer) {
    if (!layer || !layer.timeInfo) {
      if (timePanel) { timePanel.style.display = "none"; }
      return;
    }
    if (timePanel) { timePanel.style.display = "block"; }
    timeSlider.fullTimeExtent = layer.timeInfo.fullTimeExtent;

    var interval;
    if (layer === sstMonthly) {
      interval = { value: 1, unit: "months" };
    } else if (layer === sstAnnual) {
      interval = { value: 1, unit: "years" };
    } else {
      interval = layer.timeInfo.interval;
    }

    timeSlider.stops = { interval: interval };
    // IMPORTANT: always reset slider values to the active layer range,
    // otherwise a previous range can filter the new layer to nothing.
    timeSlider.values = [
      layer.timeInfo.fullTimeExtent.start,
      layer.timeInfo.fullTimeExtent.end
    ];
  }

  function updateLayerVisibility(selectedThemeKey) {
    const t = themes[selectedThemeKey];

    const wantsAnnual =
      t.layersVisible.indexOf("sstAnnual") !== -1 &&
      chkAnnual && chkAnnual.checked;

    const wantsMonthly =
      t.layersVisible.indexOf("sstMonthly") !== -1 &&
      chkMonthly && chkMonthly.checked;

    sstAnnual.visible = wantsAnnual;
    sstMonthly.visible = wantsMonthly;

    configureSliderFor(getActiveLayer());
  }

  if (chkAnnual) {
    chkAnnual.addEventListener("change", function () {
      updateLayerVisibility(currentTheme);
    });
  }
  if (chkMonthly) {
    chkMonthly.addEventListener("change", function () {
      updateLayerVisibility(currentTheme);
    });
  }

  // ---- Theme switching ----
  let currentTheme = "intro";
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const key = btn.getAttribute("data-theme");
      if (key) {
        selectTheme(key);
      }
    });
  });

  function selectTheme(key) {
    currentTheme = key;
    tabButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-theme") === key);
    });
    const t = themes[key];
    themeTitleEl.textContent = t.title;
    themeContentEl.innerHTML = t.content;

    const usesLayers = t.layersVisible && t.layersVisible.length > 0;
    layerPanel.style.display = usesLayers ? "block" : "none";
    // timePanel handled by configureSliderFor()

    updateLayerVisibility(key);
  }

  // Wait for both SST layers before first slider setup
  Promise.all([sstAnnual.when(), sstMonthly.when()]).then(function () {
    selectTheme("intro");
  });

  // ---- Sanity warnings ----
  if (RC.spatialReference && !RC.basemapUrl) {
    console.warn("[BECI] You specified a custom spatialReference but no basemapUrl...");
  }
  if (RC.basemapUrl && !RC.spatialReference) {
    console.warn("[BECI] You provided a custom basemapUrl without a spatialReference...");
  }
});
