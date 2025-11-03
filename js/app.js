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
  , "esri/renderers/RasterColormapRenderer"
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
  VectorTileLayer,
  RasterColormapRenderer
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
  // Monthly sea surface temperature (default visible)
  const sstMonthly = new ImageryTileLayer({
    portalItem: { id: items.sstMonthlyId || "8c551d176e0e48ddaec623545f4899f2" },
    title: "SST (Monthly)",
    visible: true
  });
  // Annual sea surface temperature (hidden by default)
  const sstAnnual = new ImageryTileLayer({
    portalItem: { id: items.sstAnnualId || "91743c7b6f354494acc8c822e2a40df6" },
    title: "SST (Annual)",
    visible: false
  });
  // Marine heat wave mask (monthly)
  const mhwLayer = new ImageryTileLayer({
    portalItem: { id: items.mhwMonthlyId || "3eb9dc4649204d0498760ead24c58afc" },
    title: "Marine Heat Wave (Monthly)",
    visible: false
  });

  // Define a colormap renderer for the marine heat wave mask.  Pixels with
  // value 0 (no heatwave) are fully transparent; value 1 (heatwave) are drawn
  // with a semi‑transparent orange.  This makes heatwave extent easy to see
  // without obscuring the base map.  See the RasterColormapRenderer docs for
  // more details.
  const mhwRenderer = new RasterColormapRenderer({
    colormapInfos: [
      { value: 0, color: [0, 0, 0, 0], label: "No heatwave" },
      { value: 1, color: [253, 126, 20, 0.6], label: "Heatwave" }
    ]
  });
  mhwLayer.renderer = mhwRenderer;
  // Monthly chlorophyll-a concentration
  const chlMonthly = new ImageryTileLayer({
    portalItem: { id: items.chlMonthlyId || "f08e5246b0814aabb1df13dae5ec862b" },
    title: "Chlorophyll (Monthly)",
    visible: false
  });
  // Annual chlorophyll-a concentration
  // NOTE: The annual chlorophyll layer was missing in the original code.  We add it here,
  // using the same fallback portalItem ID as the monthly chlorophyll until a distinct ID is provided.
  const chlAnnual = new ImageryTileLayer({
    portalItem: { id: items.chlAnnualId || "f08e5246b0814aabb1df13dae5ec862b" },
    title: "Chlorophyll (Annual)",
    visible: false
  });

  // -----------------------------------------------------------------------------
  // Custom renderers for raster layers
  //
  // The default renderers for these imagery layers use a generic color stretch
  // that produces a rainbow‑like palette. To better align with NOAA’s
  // visualization styles (see the provided reference images), we define two
  // custom `raster-stretch` renderers below. These renderers use multipart
  // algorithmic colour ramps that transition smoothly through a series of colours.
  //
  // For sea surface temperature (SST) layers we follow a cool‑to‑warm palette:
  // deep blue → blue → purple → pink → orange.  This helps communicate
  // temperature gradients from cold waters (dark blues) to warm waters (warm
  // oranges).  The ranges roughly correspond to the typical SST span of
  // approximately −2 °C to 35 °C, but the renderer will work with whatever
  // statistics are provided by the service.
  const sstRenderer = {
    type: "raster-stretch",
    stretchType: "min-max",
    colorRamp: {
      type: "multipart",
      colorRamps: [
        {
          // Segment 1: very cold → cold
          type: "algorithmic",
          fromColor: [8, 29, 88, 255],    // #081d58 dark navy
          toColor: [37, 52, 148, 255],    // #253494 deep blue
          algorithm: "lab-lch"
        },
        {
          // Segment 2: cold → moderate
          type: "algorithmic",
          fromColor: [37, 52, 148, 255],  // #253494 deep blue
          toColor: [108, 93, 154, 255],   // #6c5d9a purple
          algorithm: "lab-lch"
        },
        {
          // Segment 3: moderate → warm
          type: "algorithmic",
          fromColor: [108, 93, 154, 255], // #6c5d9a purple
          toColor: [179, 88, 127, 255],   // #b3587f mauve
          algorithm: "lab-lch"
        },
        {
          // Segment 4: warm → very warm
          type: "algorithmic",
          fromColor: [179, 88, 127, 255], // #b3587f mauve
          toColor: [224, 130, 20, 255],   // #e08214 light orange
          algorithm: "lab-lch"
        },
        {
          // Segment 5: very warm → hottest
          type: "algorithmic",
          fromColor: [224, 130, 20, 255], // #e08214 light orange
          toColor: [235, 98, 54, 255],    // #eb6236 orange‑red
          algorithm: "lab-lch"
        }
      ]
    }
  };

  // Chlorophyll‑a concentrations typically range from near zero in open ocean
  // waters to tens of milligrams per cubic metre in highly productive coastal
  // areas.  To emulate NOAA’s chlorophyll map, we define a palette that
  // progresses from deep blue (very low concentration) through turquoise and
  // greens to a yellow‑green for the highest values.  Each segment is
  // intentionally kept broad to avoid banding and to promote perceptual
  // uniformity.
  const chlRenderer = {
    type: "raster-stretch",
    // Use a standard deviation stretch for chlorophyll.  This focuses the
    // contrast on values within ±2 standard deviations of the mean, which
    // better reveals variation among low concentrations that otherwise appear
    // uniformly blue when using a min–max stretch.  The number of standard
    // deviations is derived empirically; adjust as needed if the data range
    // changes significantly.
    stretchType: "standard-deviation",
    numberOfStandardDeviations: 2,
    colorRamp: {
      type: "multipart",
      colorRamps: [
        {
          // Segment 1: oligotrophic waters (very low chlorophyll)
          type: "algorithmic",
          fromColor: [9, 46, 92, 255],    // #092e5c dark navy blue
          toColor: [0, 96, 159, 255],     // #00609f medium blue
          algorithm: "lab-lch"
        },
        {
          // Segment 2: low concentrations
          type: "algorithmic",
          fromColor: [0, 96, 159, 255],   // #00609f medium blue
          toColor: [54, 152, 196, 255],   // #3698c4 turquoise
          algorithm: "lab-lch"
        },
        {
          // Segment 3: moderate concentrations
          type: "algorithmic",
          fromColor: [54, 152, 196, 255], // #3698c4 turquoise
          toColor: [81, 200, 98, 255],    // #51c862 medium green
          algorithm: "lab-lch"
        },
        {
          // Segment 4: high concentrations
          type: "algorithmic",
          fromColor: [81, 200, 98, 255],  // #51c862 medium green
          toColor: [183, 231, 99, 255],   // #b7e763 yellow‑green
          algorithm: "lab-lch"
        }
      ]
    }
  };

  // Apply custom renderers to the imagery layers.  This must be done after
  // layer creation and before they are added to the map.  If the service
  // supports server‑side dynamic rendering, these client‑side renderers will
  // override the default rainbow palette.
  sstMonthly.renderer = sstRenderer;
  sstAnnual.renderer  = sstRenderer;
  chlMonthly.renderer = chlRenderer;
  chlAnnual.renderer  = chlRenderer;

  // Collect raster layers in an array for easy toggling.  Include the newly added
  // annual chlorophyll layer so it can participate in exclusive visibility logic.
  const rasters = [sstMonthly, sstAnnual, chlMonthly, chlAnnual];
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

  // ---- Species and LME overlays ----
  // The species collection contains multiple sublayers: the last (layerId 3) represents
  // the administrative boundary for Large Marine Ecosystems (LMEs).  We rename this
  // layer to "LMEs" and assign a simple popup so that clicking on a boundary only
  // displays the LME name.  This layer remains visible across all tabs to provide
  // geographic context.  Species distribution shifts are represented by line and
  // point sublayers.  Visibility for these layers is toggled per tab below.
  const speciesItemId = items.speciesCollectionId || "f97d35b2f30c4c1fb29df6c7df9030d5";
  const lmeShell = new FeatureLayer({
    portalItem: { id: speciesItemId },
    layerId: 3,
    title: "LMEs",
    opacity: 0.25,
    visible: true,
    outFields: ["*"],
    popupTemplate: { title: "{LME_Name}" }
  });
  const spLines = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 2, title: "Species shift (lines)", visible: true });
  const spStart = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 1, title: "Species shift (start)", visible: true });
  const spEnd   = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 0, title: "Species shift (end)", visible: true });
  map.addMany([lmeShell, spLines, spStart, spEnd]);

  // ---- Fish impact layers (IDs now read from config) ----
  // Helpers for renderers
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

  // ---------------------------------------------------------------------------
  // LME health polygons
  //
  // Add a dedicated layer for LME health status polygons.  The layer ID is
  // provided in the config (items.lmeHealthId).  The renderer is based on the
  // "Overall_Status" field with the fixed colours defined in the North Pacific
  // implementation package.  Popups expose the fields requested in the PDF.
  //
  // Popup template for the LME health polygons.
  //
  // The service backing this layer prefixes the health attributes with
  // `lme_health_csv_` (for example `lme_health_csv_Overall_Status`).  The
  // original implementation attempted to reference un‑prefixed field names
  // which don’t exist on the layer, causing the renderer and popups to fail
  // silently.  To fix this we explicitly reference the prefixed field names.
  // See the item’s JSON for the authoritative field names:
  // https://www.arcgis.com/sharing/rest/content/items/3ca4c0dfea2c4212b15c4dba53eb4189/data?f=pjson
  const lmeHealthPopup = {
    title: "{lme_health_csv_LME_Name}",
    content: [
      {
        type: "fields",
        fieldInfos: [
          {
            fieldName: "lme_health_csv_LME_Name",
            label: "Large Marine Ecosystem"
          },
          {
            fieldName: "lme_health_csv_Overall_Status",
            label: "Health Status"
          },
          {
            fieldName: "lme_health_csv_Health_Score",
            label: "Health Score (0–100)"
          },
          {
            fieldName: "lme_health_csv_Primary_Concern",
            label: "Primary Concern"
          },
          {
            fieldName: "lme_health_csv_Notes",
            label: "Additional Information"
          }
        ]
      }
    ]
  };
  const lmeHealthLayer = new FeatureLayer({
    portalItem: { id: items.lmeHealthId || "3ca4c0dfea2c4212b15c4dba53eb4189" },
    layerId: 0,
    title: "LME health",
    // Start hidden; the appropriate tab logic will toggle visibility.
    visible: false,
    // Explicitly list the fields used in the popup and renderer.  Referencing
    // only the required fields reduces payload size and avoids exposing
    // implementation details.
    outFields: [
      "lme_health_csv_LME_Name",
      "lme_health_csv_Overall_Status",
      "lme_health_csv_Health_Score",
      "lme_health_csv_Primary_Concern",
      "lme_health_csv_Notes"
    ],
    popupTemplate: lmeHealthPopup
  });
  map.add(lmeHealthLayer);

  function applyLmeHealthRenderer() {
    // Define the LME health renderer using the prefixed status field.  Without
    // this the renderer falls back to the default symbol and polygons draw
    // invisibly.  The colours follow the implementation package: red for
    // critical, orange for warning, yellow for caution, green for good.  Any
    // unknown or missing statuses fall back to a light grey.
    lmeHealthLayer.renderer = {
      type: "unique-value",
      field: "lme_health_csv_Overall_Status",
      defaultSymbol: {
        type: "simple-fill",
        color: [200, 200, 200, 0.3],
        outline: { color: [255, 255, 255, 0.7], width: 0.5 }
      },
      defaultLabel: "Unknown",
      uniqueValueInfos: [
        {
          value: "Critical",
          label: "Critical",
          symbol: {
            type: "simple-fill",
            color: [220, 53, 69, 0.7],
            outline: { color: [255, 255, 255, 0.7], width: 0.5 }
          }
        },
        {
          value: "Warning",
          label: "Warning",
          symbol: {
            type: "simple-fill",
            color: [253, 126, 20, 0.7],
            outline: { color: [255, 255, 255, 0.7], width: 0.5 }
          }
        },
        {
          value: "Caution",
          label: "Caution",
          symbol: {
            type: "simple-fill",
            color: [255, 193, 7, 0.7],
            outline: { color: [255, 255, 255, 0.7], width: 0.5 }
          }
        },
        {
          value: "Good",
          label: "Good",
          symbol: {
            type: "simple-fill",
            color: [40, 167, 69, 0.7],
            outline: { color: [255, 255, 255, 0.7], width: 0.5 }
          }
        }
      ]
    };
  }
  applyLmeHealthRenderer();

  // ---------------------------------------------------------------------------
  // Species shift renderer
  //
  // Classify species distribution shift lines into categories (Groundfish,
  // Pelagic, Salmon and General) based on keywords in the Species field.  Each
  // category is symbolised with the colours defined in the implementation
  // package.  If the Species field is absent or does not match, the line is
  // drawn with a default black colour.  Endpoints and start points retain
  // their default symbolisation but inherit visibility toggles from the UI.
  function applySpeciesRenderer() {
    const categories = [
      {
        value: "Groundfish",
        label: "Groundfish",
        symbol: {
          type: "simple-line",
          color: [0, 102, 204, 0.7],
          width: 2.5
        }
      },
      {
        value: "Pelagic",
        label: "Pelagic",
        symbol: {
          type: "simple-line",
          color: [255, 102, 0, 0.7],
          width: 2.5
        }
      },
      {
        value: "Salmon",
        label: "Salmon",
        symbol: {
          type: "simple-line",
          color: [204, 0, 0, 0.7],
          width: 2.5
        }
      },
      {
        value: "General",
        label: "General",
        symbol: {
          type: "simple-line",
          color: [0, 0, 0, 0.7],
          width: 2.5
        }
      }
    ];
    // The species distribution shift lines are classified using the
    // `SpeciesGroup` attribute rather than a custom value expression.  The
    // original implementation attempted to parse species names from a
    // nonexistent `Species` field, which resulted in all lines being drawn
    // with the default symbol.  The `SpeciesGroup` field stores the category
    // directly (e.g. "Groundfish", "Pelagic", "Salmon", "General pattern"), so
    // a simple unique‑value renderer suffices.  If an unknown value is
    // encountered it falls back to the General colour (black).
    spLines.renderer = {
      type: "unique-value",
      // Use a value expression to perform a case‑insensitive classification of the
      // SpeciesGroup string.  This ensures that compound values such as
      // "General pattern" or "Pelagic (Saury/Sardine)" map into the correct
      // categories.  Upper() normalises the text and IndexOf() searches for
      // keywords.  If no keyword matches, the fallback category is "General".
      valueExpression: `var sg = Upper(Trim($feature.SpeciesGroup));
        var gf  = IndexOf(sg, 'GROUNDFISH') >= 0;
        var pel = IndexOf(sg, 'PELAGIC') >= 0;
        var sal = IndexOf(sg, 'SALMON') >= 0;
        return IIf(gf, 'Groundfish', IIf(pel, 'Pelagic', IIf(sal, 'Salmon', 'General')));`,
      uniqueValueInfos: categories,
      defaultSymbol: {
        type: "simple-line",
        color: [0, 0, 0, 0.7],
        width: 2.5
      },
      defaultLabel: "General"
    };
  }
  applySpeciesRenderer();

  const impactLayer = new FeatureLayer({
    portalItem: { id: items.impactMapId || "5a820135359e42ac9fe107e3043e5a33" },
    // Renamed from "Impact Map" to "Ecosystem impacts" to better reflect
    // the contents of the layer.  This title will appear in the legend.
    title: "Ecosystem impacts",
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
      const guessedInterval = (layer === sstAnnual || layer === chlAnnual)
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
        case "chlAnnual":  setOnlyVisible(chlAnnual);  break;
        default: break;
      }
    });
  });

  // ---- Overlay checkboxes ----
  const chkLMEs = document.getElementById("chkLMEs");
  const chkLines = document.getElementById("chkLines");
  const chkStart = document.getElementById("chkStart");
  const chkEnd   = document.getElementById("chkEnd");
  // Toggle visibility of LME boundaries (shell) via the checkbox.  The shell
  // remains visible across all tabs unless explicitly unchecked.
  if (chkLMEs) chkLMEs.addEventListener("change", () => { lmeShell.visible = chkLMEs.checked; });
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
      showFishPanel: false,
      showTimeSlider: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        // Always show the LME shell unless the user has toggled it off.  Enable
        // popups so users can see the LME name on click.
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        // Ensure health polygons are hidden on the intro tab
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        bindSliderTo(null);
        impactLayer.visible = false;
        stockLayer.visible = false;
        // Hide species shift overlays on the intro tab
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
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
      showFishPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        const checked = document.querySelector('input[name="rasterChoice"]:checked');
        if (checked) {
          if (checked.value === "sstMonthly") setOnlyVisible(sstMonthly);
          if (checked.value === "sstAnnual")  setOnlyVisible(sstAnnual);
          if (checked.value === "chlMonthly") setOnlyVisible(chlMonthly);
          if (checked.value === "chlAnnual")  setOnlyVisible(chlAnnual);
        } else {
          setOnlyVisible(sstMonthly);
        }
        if (mhwLayer) mhwLayer.visible = false;
        // Keep the LME shell visible depending on the toggle and allow popups
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        // Hide LME health polygons on the baseline tab
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        // Hide species shift overlays on baseline tab
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
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
      showFishPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        // Hide all rasters and clear the TimeSlider binding
        rasters.forEach(l => l.visible = false);
        bindSliderTo(null);
        // Heatwave mask is optional and controlled by its checkbox
        if (mhwLayer) {
          mhwLayer.visible = chkMHW ? chkMHW.checked : true;
          bindSliderTo(mhwLayer);
        }
        // Always show the LME boundaries (shell) if toggled on.  Disable
        // popups for the shell on this tab so that clicking on the map
        // displays details only from the health polygons or other layers.
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = false;
        // Display the LME health polygons for environmental pressure context.  Enable
        // popups on this layer so users can access detailed health information.
        if (lmeHealthLayer) {
          lmeHealthLayer.visible = true;
          lmeHealthLayer.popupEnabled = true;
        }
        // Show species shift overlays based on user toggles (default on)
        spLines.visible = chkLines ? chkLines.checked : true;
        spStart.visible = chkStart ? chkStart.checked : true;
        spEnd.visible   = chkEnd   ? chkEnd.checked   : true;
        // Fish impact layers are hidden on this tab
        impactLayer.visible = false;
        stockLayer.visible  = false;
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
      showFishPanel: false,
      showTimeSlider: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        bindSliderTo(null);
        // Show the LME boundaries (shell) if toggled on and allow popups
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        // Hide the LME health polygons on the jurisdictions tab
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        // Hide species shift overlays
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
        // Hide fish impact layers
        impactLayer.visible = false;
        stockLayer.visible  = false;
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
      showFishPanel: true,
      showTimeSlider: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        // Always show the LME boundaries (shell) if toggled on and allow popups
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        // Hide the LME health polygons on the fish tab
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        bindSliderTo(null);
        // Hide species shift overlays on the fish tab
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible   = false;

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
  // New panel for fish overlays (stock status and ecosystem impacts)
  const fishPanelEl      = document.getElementById('fishPanel');
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
      // Display the fish overlays panel when appropriate
      showPanel(fishPanelEl,      theme.showFishPanel);
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
    showPanel(fishPanelEl,      theme.showFishPanel);
    timeSlider.visible = theme.showTimeSlider;
    theme.activateLayers();

    // Ensure fish layer visibility matches any existing checkboxes at load
    syncFishToggles();
  })();
});