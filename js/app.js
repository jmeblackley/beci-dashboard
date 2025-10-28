/*
 * Main application logic for the BECI dashboard prototype.
 *
 * This script initialises an ArcGIS JS MapView. By default it uses a
 * Pacific-centred view with wrap-around (no projection change).
 * If you provide BOTH a custom spatial reference AND a matching basemap
 * URL in config.local.js, it will initialise in that projection instead.
 *
 * Layer visibility is controlled by tabs + checkboxes. A TimeSlider
 * placeholder is included for when time-enabled services are available.
 */

require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Legend",
  "esri/widgets/ScaleBar",
  "esri/widgets/TimeSlider",
  "esri/layers/TileLayer",
  "esri/layers/ImageryLayer",
  "esri/layers/ImageryTileLayer"
], function (
  esriConfig,
  Map,
  MapView,
  Legend,
  ScaleBar,
  TimeSlider,
  TileLayer,
  ImageryLayer,
  ImageryTileLayer
) {
  const RC = window.BECI_CONFIG || {};
  esriConfig.apiKey = RC.apiKey || "";
  const wantsCustomSR = RC.spatialReference && RC.basemapUrl;

  const map = new Map({
    basemap: wantsCustomSR ? null : "oceans"
  });

  if (wantsCustomSR) {
    const baseLayer = (RC.basemapType === "imagery") ?
      new ImageryLayer({ url: RC.basemapUrl, spatialReference: RC.spatialReference }) :
      new TileLayer({ url: RC.basemapUrl, spatialReference: RC.spatialReference });

    map.basemap = {
      baseLayers: [baseLayer],
      spatialReference: RC.spatialReference
    };
  }

  // --- Operational layers ---
  const sstLayer = new ImageryTileLayer({
    portalItem: {
      id: "91743c7b6f354494acc8c822e2a40df6"
    },
    title: "Sea Surface Temperature",
    visible: true
  });


  const chlLayer = new ImageryLayer({
    url: "https://sampleserver7.arcgisonline.com/arcgis/rest/services/Amberg_DE/ImageServer",
    title: "Chlorophyll-a",
    visible: false,
    opacity: 0.6
  });

  map.addMany([sstLayer, chlLayer]);

  // --- MapView ---
  const view = new MapView({
    container: "view",
    map,
    spatialReference: wantsCustomSR ? RC.spatialReference : undefined,
    center: wantsCustomSR ? [170, 0] : [180, 15],
    zoom: 3,
    constraints: {
      wrapAround: "always"
    }
  });

  view.ui.add(new Legend({ view }), "bottom-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // --- Themes ---
  const themes = {
    intro: {
      title: "Introduction",
      content: `<p>The Basin Events to Coastal Impacts (BECI) dashboard aggregates ocean
      and fisheries intelligence to support decision makers...</p>`,
      layersVisible: []
    },
    env: {
      title: "Environmental Conditions",
      content: `<p>Environmental conditions include indicators such as sea surface
      temperature and chlorophyll-a...</p>`,
      layersVisible: ["sst", "chl"]
    },
    pressures: {
      title: "Environmental Pressures",
      content: `<p>Configure this theme with ocean pressures...</p>`,
      layersVisible: []
    },
    jurisdictions: {
      title: "Management Jurisdictions",
      content: `<p>Visualise management jurisdictions, maritime boundaries, and EEZs...</p>`,
      layersVisible: []
    },
    fish: {
      title: "Fish Impacts",
      content: `<p>Future enhancements could summarise stock assessments...</p>`,
      layersVisible: []
    }
  };

  const themeTitleEl = document.getElementById("themeTitle");
  const themeContentEl = document.getElementById("themeContent");
  const tabButtons = document.querySelectorAll(".tab");
  const layerPanel = document.getElementById("layerPanel");
  const timePanel = document.getElementById("timePanel");

  function updateLayerVisibility(selectedThemeKey) {
    const t = themes[selectedThemeKey];
    const showSST = t.layersVisible.includes("sst") && document.getElementById("toggleSST").checked;
    const showChl = t.layersVisible.includes("chl") && document.getElementById("toggleChl").checked;
    sstLayer.visible = showSST;
    chlLayer.visible = showChl;
  }

  document.getElementById("toggleSST").addEventListener("change", () => updateLayerVisibility(currentTheme));
  document.getElementById("toggleChl").addEventListener("change", () => updateLayerVisibility(currentTheme));

  let currentTheme = "intro";
  function selectTheme(key) {
    currentTheme = key;
    tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.theme === key));
    const t = themes[key];
    themeTitleEl.textContent = t.title;
    themeContentEl.innerHTML = t.content;
    const usesLayers = t.layersVisible && t.layersVisible.length > 0;
    layerPanel.style.display = usesLayers ? "block" : "none";
    timePanel.style.display = key === "env" ? "block" : "none";
    updateLayerVisibility(key);
  }
  tabButtons.forEach(btn => btn.addEventListener("click", () => selectTheme(btn.dataset.theme)));

  // --- TimeSlider ---
  const timeSlider = new TimeSlider({
    container: "timeSlider",
    view: view,
    mode: "time-window"
  });

  sstLayer.when(() => {
    timeSlider.fullTimeExtent = sstLayer.timeInfo.fullTimeExtent;
    timeSlider.stops = {
      interval: sstLayer.timeInfo.interval
    };
  });

  selectTheme("intro");

  if (RC.spatialReference && !RC.basemapUrl) {
    console.warn("[BECI] You specified a custom spatialReference but no basemapUrl...");
  }
  if (RC.basemapUrl && !RC.spatialReference) {
    console.warn("[BECI] You provided a custom basemapUrl without a spatialReference...");
  }
});
