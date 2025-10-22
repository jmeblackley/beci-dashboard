/*
 * Main application logic for the BECI dashboard prototype.
 *
 * This script initialises an ArcGIS JS MapView with a Pacific‑centred
 * projection and provides a simple tabbed interface for navigating
 * between thematic contexts. Layer visibility is toggled based on
 * both tab selection and checkbox state. A placeholder time slider
 * has been added to illustrate where temporal controls can be wired
 * once time‑enabled services are available.
 */

require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Legend",
  "esri/widgets/ScaleBar",
  "esri/widgets/TimeSlider",
  "esri/layers/ImageryTileLayer"
], function (esriConfig, Map, MapView, Legend, ScaleBar, TimeSlider, ImageryTileLayer) {
  // Read API key from local runtime config (config.local.js). If your
  // services are public, this can remain an empty string.
  const rc = window.BECI_CONFIG || {};
  esriConfig.apiKey = rc.apiKey || "";

  // -------------------------------------------------------------------------
  // Basemap and operational layers
  // -------------------------------------------------------------------------
  // Create a base map. In this prototype we use the "oceans" basemap.
  // When switching to a projection such as PDC Mercator (EPSG:3832), the
  // ArcGIS API for JavaScript will attempt to reproject vector and image
  // services on the fly. For the highest fidelity, consider using a
  // basemap designed for your projection (e.g. Spilhaus Ocean or Equal
  // Earth APAC) once you deploy this dashboard.
  const map = new Map({ basemap: "oceans" });

  // Example imagery layers. Replace the URLs with your AGOL imagery
  // services. These layers are off by default except the SST layer.
  const sstLayer = new ImageryTileLayer({
    // TODO: replace with the URL to your Sea Surface Temperature image service
    url: "https://services.arcgisonline.com/arcgis/rest/services/World_Ocean_Base/MapServer",
    title: "Sea Surface Temperature",
    visible: true
  });

  const chlLayer = new ImageryTileLayer({
    // TODO: replace with the URL to your Chlorophyll‑a image service
    url: "https://services.arcgisonline.com/arcgis/rest/services/World_Ocean_Reference/MapServer",
    title: "Chlorophyll‑a",
    visible: false
  });

  map.addMany([sstLayer, chlLayer]);

  // -------------------------------------------------------------------------
  // MapView configuration
  // -------------------------------------------------------------------------
  // Use the PDC Mercator projection (EPSG:3832) which centres the map on
  // longitude 150°E. This avoids splitting features that cross the
  // international date line and is suitable for Pacific‑wide datasets.
  const view = new MapView({
    container: "view",
    map,
    // Setting spatialReference causes the view and operational layers to
    // display in the specified projection. If your basemap doesn't
    // support this projection, you may see reprojection warnings or
    // performance impacts. You can remove this line to fall back to
    // Web Mercator if needed.
    spatialReference: { wkid: 3832 },
    center: [170, 0],
    zoom: 3
  });

  // Add a legend and scale bar to the view. Position them inside the map
  // so they overlay the content without consuming sidebar space.
  view.ui.add(new Legend({ view }), "bottom-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // -------------------------------------------------------------------------
  // Theme definitions
  // -------------------------------------------------------------------------
  // Themes define the heading, descriptive content and the layers that
  // should be visible when a tab is selected. You can extend these
  // definitions with additional metadata or configuration as needed.
  const themes = {
    intro: {
      title: "Introduction",
      content: `
        <p>The Basin Events to Coastal Impacts (BECI) dashboard aggregates ocean
        and fisheries intelligence to support decision makers. Use the
        navigation tabs above to switch between themes and explore regional
        conditions. This prototype emphasises the map so that it can be
        embedded in other websites with minimal chrome.</p>
      `,
      layersVisible: []
    },
    env: {
      title: "Environmental Conditions",
      content: `
        <p>Environmental conditions include indicators such as sea surface
        temperature and chlorophyll‑a. Toggle the layers below to view
        available data. A time slider will appear for layers that support
        temporal queries once you configure a time‑enabled service.</p>
      `,
      layersVisible: ["sst", "chl"]
    },
    pressures: {
      title: "Environmental Pressures",
      content: `
        <p>This theme can be configured to display information about
        environmental pressures affecting the Pacific, such as ocean
        acidification or pollution events. Add your own layers in
        <code>app.js</code> and update this content accordingly.</p>
      `,
      layersVisible: []
    },
    jurisdictions: {
      title: "Management Jurisdictions",
      content: `
        <p>Visualise management jurisdictions, maritime boundaries and
        exclusive economic zones. Replace the placeholder layers with
        authoritative boundaries to support decision making.</p>
      `,
      layersVisible: []
    },
    fish: {
      title: "Fish Impacts",
      content: `
        <p>Future themes might explore fish impacts, including stock
        assessments and catch data. Integrate your fisheries datasets to
        showcase the relationships between environmental conditions and
        fisheries productivity.</p>
      `,
      layersVisible: []
    }
  };

  // Cache DOM references for efficiency
  const themeTitleEl = document.getElementById("themeTitle");
  const themeContentEl = document.getElementById("themeContent");
  const tabButtons = document.querySelectorAll(".tab");

  // Helper to set layer visibility based on theme and checkbox state
  function updateLayerVisibility(selectedThemeKey) {
    const selectedTheme = themes[selectedThemeKey];
    // Determine which layers should be visible for this theme.
    const sstShouldBeVisible = selectedTheme.layersVisible.includes("sst") &&
      document.getElementById("toggleSST").checked;
    const chlShouldBeVisible = selectedTheme.layersVisible.includes("chl") &&
      document.getElementById("toggleChl").checked;
    sstLayer.visible = sstShouldBeVisible;
    chlLayer.visible = chlShouldBeVisible;
  }

  // Toggle layer visibility when checkboxes change (only takes effect
  // within the Environmental Conditions theme)
  document.getElementById("toggleSST").addEventListener("change", () => {
    updateLayerVisibility(currentTheme);
  });
  document.getElementById("toggleChl").addEventListener("change", () => {
    updateLayerVisibility(currentTheme);
  });

  // Track the current theme so that we can update layer visibility when
  // checkboxes change.
  let currentTheme = "intro";

  // Select a theme: updates tab styles, panel content and layer visibility
  function selectTheme(key) {
    currentTheme = key;
    // Update active tab styling
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === key);
    });
    // Update panel heading and content
    const theme = themes[key];
    themeTitleEl.textContent = theme.title;
    themeContentEl.innerHTML = theme.content;
    // Show or hide layer toggles depending on whether the theme uses layers
    const layerPanel = document.querySelectorAll(".panel")[1];
    if (theme.layersVisible && theme.layersVisible.length > 0) {
      layerPanel.style.display = "block";
    } else {
      layerPanel.style.display = "none";
    }
    // Show the time panel only for the Environmental Conditions theme
    const timePanel = document.querySelectorAll(".panel")[2];
    if (key === "env") {
      timePanel.style.display = "block";
    } else {
      timePanel.style.display = "none";
    }
    // Update layer visibility
    updateLayerVisibility(key);
  }

  // Attach click handlers to each tab button
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => selectTheme(btn.dataset.theme));
  });

  // -------------------------------------------------------------------------
  // Time slider placeholder
  // -------------------------------------------------------------------------
  // The time slider is created once. When you configure a time‑enabled
  // image service (for example, monthly SST or chlorophyll data), set
  // fullTimeExtent and stops based on the service's time extent. For
  // demonstration purposes, the slider is added here without any stops.
  const timeSlider = new TimeSlider({
    container: "timeSlider",
    mode: "time-window"
    // You will set fullTimeExtent and stops once you have a real time-enabled layer
  });

  // Initialise the interface to the introduction
  selectTheme("intro");
});