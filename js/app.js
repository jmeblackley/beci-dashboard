require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Legend",
  "esri/widgets/ScaleBar",
  "esri/widgets/TimeSlider",
  "esri/layers/ImageryTileLayer"
], function (esriConfig, Map, MapView, Legend, ScaleBar, TimeSlider, ImageryTileLayer) {

  // Read API key from local runtime config (config.local.js)
  const rc = window.BECI_CONFIG || {};
  esriConfig.apiKey = rc.apiKey || ""; // empty is OK if all services are public

  // Base map
  const map = new Map({ basemap: "oceans" });

  // Example imagery layers (swap these URLs for your AGOL items or services)
  // For POC: start with one working public imagery service, then iterate.
  const sstLayer = new ImageryTileLayer({
    // TODO: replace with your AGOL imagery tiles URL
    // e.g., "https://tiles.arcgis.com/…/arcgis/rest/services/SST_monthly/ImageServer"
    url: "https://services.arcgisonline.com/arcgis/rest/services/World_Ocean_Base/MapServer", // placeholder
    title: "SST (placeholder)"
  });

  const chlLayer = new ImageryTileLayer({
    // TODO: replace with your Chlorophyll imagery tiles
    url: "https://services.arcgisonline.com/arcgis/rest/services/World_Ocean_Reference/MapServer", // placeholder
    title: "Chlorophyll-a (placeholder)",
    visible: false
  });

  map.addMany([sstLayer, chlLayer]);

  const view = new MapView({
    container: "view",
    map,
    center: [-160, 35], // North Pacific-ish
    zoom: 3
  });

  // UI widgets
  view.ui.add(new Legend({ view }), "bottom-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // Simple layer toggles
  document.getElementById("toggleSST").addEventListener("change", (e) => {
    sstLayer.visible = e.target.checked;
  });
  document.getElementById("toggleChl").addEventListener("change", (e) => {
    chlLayer.visible = e.target.checked;
  });

  // Time slider shell (wire it to your time-enabled imagery when ready)
  const timeSlider = new TimeSlider({
    container: "timeSlider",
    mode: "time-window",
    // You will set fullTimeExtent & stops from your service once you use a real time-enabled layer
  });
});
