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
  "esri/layers/TileLayer",          // correct for MapServer/tiles
  "esri/layers/ImageryLayer"        // use this if you have ImageServer
], function (
  esriConfig,
  Map,
  MapView,
  Legend,
  ScaleBar,
  TimeSlider,
  TileLayer,
  ImageryLayer
) {
  // ---------------------------------------------------------------------------
  // Runtime config (apiKey, spatialReference, basemapUrl)
  // ---------------------------------------------------------------------------
  const RC = window.BECI_CONFIG || {};
  esriConfig.apiKey = RC.apiKey || "";

  // If you want a true non-Mercator projection:
  //  - RC.spatialReference: { wkid: <your WKID> } or { wkt: "..." }
  //  - RC.basemapUrl: URL to tiles or an image service IN THE SAME SR.
  // If either piece is missing, we fall back to Pacific-centred default.
  const wantsCustomSR = RC.spatialReference && RC.basemapUrl;

  // ---------------------------------------------------------------------------
  // Basemap
  // ---------------------------------------------------------------------------
  // Default basemap is Esri "oceans" (Web Mercator). We keep Mercator here
  // to avoid reprojection issues until you supply a proper custom basemap.
  const map = new Map({
    basemap: wantsCustomSR ? null : "oceans"
  });

  // If a custom basemap is supplied, add it (choose the right class).
  if (wantsCustomSR) {
    const baseLayer = (RC.basemapType === "imagery") ?
      new ImageryLayer({ url: RC.basemapUrl, spatialReference: RC.spatialReference }) :
      new TileLayer({ url: RC.basemapUrl, spatialReference: RC.spatialReference });

    map.basemap = {
      baseLayers: [baseLayer],
      // Not strictly required, but helps some widgets
      spatialReference: RC.spatialReference
    };
  }

  // ---------------------------------------------------------------------------
  // Operational layers (placeholders — swap URLs for your services)
  // ---------------------------------------------------------------------------
  // If you have ImageServer endpoints for SST/Chl, use ImageryLayer.
  // If you have cached tiles (MapServer), use TileLayer.
  const sstLayer = new ImageryLayer({
    // TODO: replace with your SST ImageServer (time-enabled if possible)
    // url: "https://<your-server>/arcgis/rest/services/SST/ImageServer",
    // Temporary placeholder (won't be time-enabled and may not match SR):
    url: "https://sampleserver7.arcgisonline.com/arcgis/rest/services/Amberg_DE/ImageServer",
    title: "Sea Surface Temperature",
    visible: true
  });

  const chlLayer = new ImageryLayer({
    // TODO: replace with your Chlorophyll-a ImageServer
    // url: "https://<your-server>/arcgis/rest/services/ChlorA/ImageServer",
    // Temporary placeholder:
    url: "https://sampleserver7.arcgisonline.com/arcgis/rest/services/Amberg_DE/ImageServer",
    title: "Chlorophyll-a",
    visible: false,
    opacity: 0.6
  });

  map.addMany([sstLayer, chlLayer]);

  // ---------------------------------------------------------------------------
  // MapView configuration
  // ---------------------------------------------------------------------------
  // DEFAULT: keep Mercator, centre on the Pacific and wrap around the 180th.
  // CUSTOM SR: use RC.spatialReference and let your custom basemap draw natively.
  const view = new MapView({
    container: "view",
    map,
    spatialReference: wantsCustomSR ? RC.spatialReference : undefined,
    center: wantsCustomSR ? [170, 0] : [180, 15],
    zoom: 3,
    constraints: {
      // Always-on wrap to make Pacific-centred navigation pleasant
      wrapAround: "always"
    }
  });

  // Add widgets
  view.ui.add(new Legend({ view }), "bottom-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // ---------------------------------------------------------------------------
  // Theme definitions
  // ---------------------------------------------------------------------------
  const themes = {
    intro: {
      title: "Introduction",
      content: `
        <p>The Basin Events to Coastal Impacts (BECI) dashboard aggregates ocean
        and fisheries intelligence to support decision makers. Use the tabs above
        to switch between themes. This prototype emphasises the map so that it can
        be embedded with minimal chrome.</p>
      `,
      layersVisible: []
    },
    env: {
      title: "Environmental Conditions",
      content: `
        <p>Environmental conditions include indicators such as sea surface
        temperature and chlorophyll-a. Toggle the layers below to view
        available data. A time slider will appear once these layers are
        pointed at time-enabled services.</p>
      `,
      layersVisible: ["sst", "chl"]
    },
    pressures: {
      title: "Environmental Pressures",
      content: `
        <p>Configure this theme with ocean pressures, e.g., acidification or
        pollution events. Add layers in <code>app.js</code> and update this text.</p>
      `,
      layersVisible: []
    },
    jurisdictions: {
      title: "Management Jurisdictions",
      content: `
        <p>Visualise management jurisdictions, maritime boundaries, and EEZs.
        Replace placeholder layers with authoritative sources.</p>
      `,
      layersVisible: []
    },
    fish: {
      title: "Fish Impacts",
      content: `
        <p>Future enhancements could summarise stock assessments, catch data,
        and link them to the environmental indicators.</p>
      `,
      layersVisible: []
    }
  };

  // DOM references
  const themeTitleEl = document.getElementById("themeTitle");
  const themeContentEl = document.getElementById("themeContent");
  const tabButtons = document.querySelectorAll(".tab");
  const layerPanel = document.getElementById("layerPanel");
  const timePanel = document.getElementById("timePanel");

  // Visibility helper
  function updateLayerVisibility(selectedThemeKey) {
    const t = themes[selectedThemeKey];
    const showSST = t.layersVisible.includes("sst") && document.getElementById("toggleSST").checked;
    const showChl = t.layersVisible.includes("chl") && document.getElementById("toggleChl").checked;
    sstLayer.visible = showSST;
    chlLayer.visible = showChl;
  }

  // Checkbox handlers (only meaningful in the ENV theme)
  document.getElementById("toggleSST").addEventListener("change", () => updateLayerVisibility(currentTheme));
  document.getElementById("toggleChl").addEventListener("change", () => updateLayerVisibility(currentTheme));

  // Tab selection
  let currentTheme = "intro";
  function selectTheme(key) {
    currentTheme = key;

    // tabs
    tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.theme === key));

    // panel text
    const t = themes[key];
    themeTitleEl.textContent = t.title;
    themeContentEl.innerHTML = t.content;

    // layer & time panels
    const usesLayers = t.layersVisible && t.layersVisible.length > 0;
    layerPanel.style.display = usesLayers ? "block" : "none";
    timePanel.style.display = key === "env" ? "block" : "none";

    // layer visibility
    updateLayerVisibility(key);
  }
  tabButtons.forEach(btn => btn.addEventListener("click", () => selectTheme(btn.dataset.theme)));

  // ---------------------------------------------------------------------------
  // Time slider placeholder (wire this once your layers are time-enabled)
  // ---------------------------------------------------------------------------
  const timeSlider = new TimeSlider({
    container: "timeSlider",
    mode: "time-window"
    // Later: set fullTimeExtent and stops from your imagery layer's timeInfo.
  });

  // Kick off UI
  selectTheme("intro");

  // ---------------------------------------------------------------------------
  // Helpful warnings for projection/basemap mismatches
  // ---------------------------------------------------------------------------
  if (RC.spatialReference && !RC.basemapUrl) {
    // eslint-disable-next-line no-console
    console.warn("[BECI] You specified a custom spatialReference but no basemapUrl. The app kept the default (Mercator) basemap to avoid projection issues. Add RC.basemapUrl in config.local.js to use your SR.");
  }
  if (RC.basemapUrl && !RC.spatialReference) {
    // eslint-disable-next-line no-console
    console.warn("[BECI] You provided a custom basemapUrl without a spatialReference. Please add RC.spatialReference = { wkid: <...> } (or wkt) so the view initialises correctly.");
  }
});
