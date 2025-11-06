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
  "esri/layers/VectorTileLayer",
  "esri/renderers/RasterColormapRenderer"
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

  // The legend lives inside a fieldset (parent of legendDiv).  We can hide
  // or show the entire legend area by toggling the fieldset’s display.
  const legendFieldset = legendDiv ? legendDiv.parentElement : null;

  // ---- Time-aware rasters ----
  // Include physical units in the raster titles for clarity.  SST is measured in degrees Celsius (°C).
  const sstMonthly = new ImageryTileLayer({
    portalItem: { id: items.sstMonthlyId || "8c551d176e0e48ddaec623545f4899f2" },
    title: "SST (Monthly, °C)",
    visible: true
  });
  const sstAnnual = new ImageryTileLayer({
    portalItem: { id: items.sstAnnualId || "91743c7b6f354494acc8c822e2a40df6" },
    title: "SST (Annual, °C)",
    visible: false
  });
  const mhwLayer = new ImageryTileLayer({
    portalItem: { id: items.mhwMonthlyId || "3eb9dc4649204d0498760ead24c58afc" },
    title: "Marine Heat Wave (Monthly)",
    visible: false
  });

  const mhwRenderer = new RasterColormapRenderer({
    colormapInfos: [
      { value: 0, color: [0, 0, 0, 0], label: "No heatwave" },
      { value: 1, color: [253, 126, 20, 0.6], label: "Heatwave" }
    ]
  });
  mhwLayer.renderer = mhwRenderer;

  // Chlorophyll concentrations are measured in milligrams per cubic metre (mg/m³).
  const chlMonthly = new ImageryTileLayer({
    portalItem: { id: items.chlMonthlyId || "f08e5246b0814aabb1df13dae5ec862b" },
    title: "Chlorophyll (Monthly, mg/m³)",
    visible: false
  });
  const chlAnnual = new ImageryTileLayer({
    portalItem: { id: items.chlAnnualId || "f08e5246b0814aabb1df13dae5ec862b" },
    title: "Chlorophyll (Annual, mg/m³)",
    visible: false
  });

  // ---- Custom raster renderers ----
  const sstRenderer = {
    type: "raster-stretch",
    stretchType: "min-max",
    colorRamp: {
      type: "multipart",
      colorRamps: [
        { type: "algorithmic", fromColor: [8, 29, 88, 255],   toColor: [37, 52, 148, 255],  algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [37, 52, 148, 255], toColor: [108, 93, 154, 255], algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [108, 93, 154, 255],toColor: [179, 88, 127, 255], algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [179, 88, 127, 255],toColor: [224, 130, 20, 255], algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [224, 130, 20, 255],toColor: [235, 98, 54, 255],  algorithm: "lab-lch" }
      ]
    }
  };
  const chlRenderer = {
    type: "raster-stretch",
    stretchType: "standard-deviation",
    numberOfStandardDeviations: 2,
    colorRamp: {
      type: "multipart",
      colorRamps: [
        { type: "algorithmic", fromColor: [9, 46, 92, 255],  toColor: [0, 96, 159, 255],  algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [0, 96, 159, 255], toColor: [54, 152, 196, 255],algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [54, 152, 196, 255],toColor: [81, 200, 98, 255], algorithm: "lab-lch" },
        { type: "algorithmic", fromColor: [81, 200, 98, 255], toColor: [183, 231, 99, 255],algorithm: "lab-lch" }
      ]
    }
  };

  sstMonthly.renderer = sstRenderer;
  sstAnnual.renderer  = sstRenderer;
  chlMonthly.renderer = chlRenderer;
  chlAnnual.renderer  = chlRenderer;

  const rasters = [sstMonthly, sstAnnual, chlMonthly, chlAnnual];
  map.addMany(rasters);
  map.add(mhwLayer);

  // ---- EEZ boundaries ----
  let eezLayer = null;
  if (items.eezId) {
    eezLayer = new FeatureLayer({
      portalItem: { id: items.eezId },
      // Simplify the title so it does not imply a particular nation.  Popups are enabled to show basic info.
      title: "EEZ Boundaries",
      visible: true,
      outFields: ["*"],
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [0, 0, 0, 0],
          outline: { color: [80, 80, 80, 0.6], width: 0.5 }
        }
      },
      popupEnabled: true
    });
    map.add(eezLayer);
  }

  // ---- RFMOs (one service), with six filtered views ----
  const rfmoColors = {
    NPFC:  "#2ECC40",
    NPAFC: "#0074D9",
    PSC:   "#7FDBFF",
    IPHC:  "#B10DC9",
    WCPFC: "#FF851B",
    IATTC: "#FFDC00"
  };
  const rfmoFullNames = {
    NPFC:  "North Pacific Fisheries Commission (NPFC)",
    NPAFC: "North Pacific Anadromous Fish Commission (NPAFC)",
    PSC:   "Pacific Salmon Commission (PSC)",
    IPHC:  "International Pacific Halibut Commission (IPHC)",
    WCPFC: "Western & Central Pacific Fisheries Commission (WCPFC)",
    IATTC: "Inter-American Tropical Tuna Commission (IATTC)"
  };
  function rfmoFill(hex, alpha = 0.25) {
    const h = hex.replace("#",""), r = parseInt(h.slice(0,2),16),
          g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return { type: "simple-fill", color: [r,g,b,alpha], outline: { color: [r,g,b,0.85], width: 0.7 } };
  }
  function rfmoPopup() {
    return {
      title: "{RFMO_Name} ({RFMO_Acronym})",
      content: `
        <div style="line-height:1.35">
          <div><b>Species managed:</b> {SpeciesManaged}</div>
          <div><b>Members:</b> {Members}</div>
          <div><b>Convention area:</b> {ConventionArea}</div>
          <div><b>Why critical:</b> {WhyCritical}</div>
        </div>`
    };
  }

  let rfmoAll = null, rfmoLayers = {};
  if (items.rfmoId) {
    rfmoAll = new FeatureLayer({
      portalItem: { id: items.rfmoId },
      title: "RFMOs (all)",
      visible: false,
      outFields: ["*"]
    });
    map.add(rfmoAll);

    ["NPFC","NPAFC","PSC","IPHC","WCPFC","IATTC"].forEach(code => {
      const lyr = new FeatureLayer({
        portalItem: { id: items.rfmoId },
        title: rfmoFullNames[code], // full name in legend
        definitionExpression: `RFMO_Acronym='${code}'`,
        outFields: ["*"],
        visible: true,
        renderer: { type: "simple", symbol: rfmoFill(rfmoColors[code]) },
        popupTemplate: rfmoPopup()
      });
      rfmoLayers[code] = lyr;
      map.add(lyr);
    });
  }

  // ---- LMEs + species shift overlays ----
  let lmeLayer = null;
  if (items.lmeId) {
    lmeLayer = new FeatureLayer({
      portalItem: { id: items.lmeId },
      title: "LME boundaries",
      visible: false,
      outFields: ["*"],
      // Show only the LME name in the popup for shell boundaries
      popupTemplate: {
        title: "{LME_Name}",
        content: "{LME_Name}"
      }
    });
    map.add(lmeLayer);
  }

  const speciesItemId = items.speciesCollectionId || "f97d35b2f30c4c1fb29df6c7df9030d5";
  // Use the dedicated LME boundary layer for the shell outlines.
  const lmeShell = new FeatureLayer({
    portalItem: { id: items.lmeId || speciesItemId },
    title: "LMEs",
    opacity: 0.25,
    visible: true,
    outFields: ["*"],
    // Normalize contested LME names to a neutral identifier.  Any LME whose name
    // references disputed bodies of water will be labeled "LME 50" in the popup.
    // For all other LMEs the original name is preserved. This only impacts the popup title.
    popupTemplate: {
      title: "{expression/cleanName}",
      expressionInfos: [
        {
          name: "cleanName",
          title: "Normalized LME name",
          // Arcade expression: for any LME name containing references to disputed bodies of water,
          // return a neutral identifier "LME 50". This avoids using contested names.
          // If the name does not refer to those bodies of water, return the original.
          expression: "IIf(Find(Upper($feature.LME_Name), 'JAPAN') > -1 || Find(Upper($feature.LME_Name), 'EAST SEA') > -1, 'LME 50', $feature.LME_Name)"
        }
      ]
    }
  });
  const spLines = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 2, title: "Species shift (lines)", visible: true });
  const spStart = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 1, title: "Species shift (start)", visible: true });
  const spEnd   = new FeatureLayer({ portalItem: { id: speciesItemId }, layerId: 0, title: "Species shift (end)", visible: true });
  map.addMany([lmeShell, spLines, spStart, spEnd]);

  // ---- Helper funcs ----
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

  // ---- LME health polygons ----
  // Use an expression to normalise contested LME names.  Any record whose LME name refers
  // to a disputed body of water will display as "LME 50". Otherwise the original name is used.
  const lmeHealthPopup = {
    title: "{expression/cleanName}",
    expressionInfos: [
      {
        name: "cleanName",
        title: "Normalized LME name",
        expression:
          "IIf(Find(Upper($feature.lme_health_csv_LME_Name), 'JAPAN') > -1 || Find(Upper($feature.lme_health_csv_LME_Name), 'EAST SEA') > -1, 'LME 50', $feature.lme_health_csv_LME_Name)"
      }
    ],
    content: [
      {
        type: "fields",
        fieldInfos: [
          { fieldName: "expression/cleanName", label: "Large Marine Ecosystem" },
          { fieldName: "lme_health_csv_Overall_Status", label: "Health Status" },
          { fieldName: "lme_health_csv_Health_Score", label: "Health Score (0–100)" },
          { fieldName: "lme_health_csv_Primary_Concern", label: "Primary Concern" },
          { fieldName: "lme_health_csv_Notes", label: "Additional Information" }
        ]
      }
    ]
  };
  const lmeHealthLayer = new FeatureLayer({
    portalItem: { id: items.lmeHealthId || "3ca4c0dfea2c4212b15c4dba53eb4189" },
    layerId: 0,
    title: "LME health",
    visible: false,
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
        { value: "Critical", label: "Critical", symbol: { type: "simple-fill", color: [220, 53, 69, 0.7],  outline: { color: [255,255,255,0.7], width: 0.5 } } },
        { value: "Warning",  label: "Warning",  symbol: { type: "simple-fill", color: [253, 126, 20, 0.7], outline: { color: [255,255,255,0.7], width: 0.5 } } },
        { value: "Caution",  label: "Caution",  symbol: { type: "simple-fill", color: [255, 193, 7, 0.7],  outline: { color: [255,255,255,0.7], width: 0.5 } } },
        { value: "Good",     label: "Good",     symbol: { type: "simple-fill", color: [40, 167, 69, 0.7],  outline: { color: [255,255,255,0.7], width: 0.5 } } }
      ]
    };
  }
  applyLmeHealthRenderer();

  // ---- Species shift renderer ----
  function applySpeciesRenderer() {
    // Update species categories based on the language guidance.  The “General” group is
    // removed and additional groups for Anadromous and Forage are added.
    const categories = [
      { value: "Groundfish",  label: "Groundfish",  symbol: { type: "simple-line", color: [0, 102, 204, 0.7], width: 2.5 } },
      { value: "Pelagic",     label: "Pelagic",     symbol: { type: "simple-line", color: [255,102,   0, 0.7], width: 2.5 } },
      { value: "Salmon",      label: "Salmon",      symbol: { type: "simple-line", color: [204,  0,   0, 0.7], width: 2.5 } },
      { value: "Anadromous",  label: "Anadromous",  symbol: { type: "simple-line", color: [102, 51, 153, 0.7], width: 2.5 } },
      { value: "Forage",      label: "Forage",      symbol: { type: "simple-line", color: [0, 153, 51, 0.7], width: 2.5 } }
    ];
    spLines.renderer = {
      type: "unique-value",
      valueExpression: `var sg = Upper(Trim($feature.SpeciesGroup));
        var gf   = IndexOf(sg, 'GROUNDFISH') >= 0;
        var pel  = IndexOf(sg, 'PELAGIC') >= 0;
        var sal  = IndexOf(sg, 'SALMON') >= 0;
        var ana  = IndexOf(sg, 'ANADROMOUS') >= 0;
        var forg = IndexOf(sg, 'FORAGE') >= 0;
        return IIf(gf, 'Groundfish', IIf(pel, 'Pelagic', IIf(sal, 'Salmon', IIf(ana, 'Anadromous', IIf(forg, 'Forage', 'Other')))));`,
      uniqueValueInfos: categories,
      defaultSymbol: { type: "simple-line", color: [0,0,0,0.7], width: 2.5 },
      defaultLabel: "Other"
    };
  }
  applySpeciesRenderer();

  // ---- Fish layers ----
  const impactLayer = new FeatureLayer({
    portalItem: { id: items.impactMapId || "5a820135359e42ac9fe107e3043e5a33" },
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
      // Dedupe by label and color.  Then apply language cleanup from the
      // language guide: remove Moderate concern and Other/Unknown categories,
      // and rename Likely healthy to Healthy (green).  This ensures the legend
      // only shows the desired categories.
      // Deduplicate by label and color, then filter out undesired categories and apply renaming.
      const uniqDeduped = dedupe(rows, r => `${r.label}|${r.color}`);
      const filtered = [];
      uniqDeduped.forEach((row) => {
        const label = row.label;
        // Skip categories flagged for removal
        if (label === 'Moderate concern' || label === 'Other/Unknown') return;
        // Rename Likely healthy to Healthy (green) to match the language guide
        if (label === 'Likely healthy') {
          filtered.push({ value: label, label: 'Healthy (green)', color: row.color });
        } else {
          filtered.push({ value: label, label: label, color: row.color });
        }
      });
      const uniqueValueInfos = filtered.map((r) => ({
        value: r.value,
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
        // After filtering, set default label to blank to avoid showing a legend entry
        defaultLabel: "",
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

  // ---- Overlay checkboxes (LMEs/species) ----
  const chkLMEs  = document.getElementById("chkLMEs");
  const chkLines = document.getElementById("chkLines");
  const chkStart = document.getElementById("chkStart");
  const chkEnd   = document.getElementById("chkEnd");

  // Additional checkbox for LME boundaries in the jurisdiction panel.  This allows
  // users to toggle LMEs on/off from the management & ecosystem boundaries tab.
  const chkJurLMEs = document.getElementById("chkJurLMEs");

  if (chkLMEs) chkLMEs.addEventListener("change", () => { lmeShell.visible = chkLMEs.checked; });
  if (chkLines) chkLines.addEventListener("change", () => { spLines.visible = chkLines.checked; });
  if (chkStart) chkStart.addEventListener("change", () => { spStart.visible = chkStart.checked; });
  if (chkEnd)   chkEnd.addEventListener("change", () => { spEnd.visible   = chkEnd.checked; });

  if (chkJurLMEs) chkJurLMEs.addEventListener("change", () => {
    // When toggling LME boundaries from the management tab, also reflect
    // the state in the main LMEs checkbox so that other themes respect the
    // user’s preference. This ensures activateLayers uses the same value.
    lmeShell.visible = chkJurLMEs.checked;
    if (chkLMEs) chkLMEs.checked = chkJurLMEs.checked;
  });

  const chkMHW = document.getElementById("chkMHW");
  if (chkMHW && mhwLayer) chkMHW.addEventListener("change", () => { mhwLayer.visible = chkMHW.checked; });
  const chkLME = document.getElementById("chkLME");
  if (chkLME && lmeLayer) chkLME.addEventListener("change", () => { lmeLayer.visible = chkLME.checked; });

  // ---- Fish layer toggles ----
  const chkStock  = document.getElementById("chkStock");
  const chkImpact = document.getElementById("chkImpact");

  function syncFishToggles() {
    const stockOn  = chkStock  ? !!chkStock.checked  : true;
    const impactOn = chkImpact ? !!chkImpact.checked : true;
    stockLayer.visible  = stockOn;
    impactLayer.visible = impactOn;
    if (legend) legend.view = view;
  }
  if (chkStock)  chkStock.addEventListener("change", syncFishToggles);
  if (chkImpact) chkImpact.addEventListener("change", syncFishToggles);
  document.addEventListener("change", (e) => {
    if (e.target && (e.target.id === "chkStock" || e.target.id === "chkImpact")) {
      syncFishToggles();
    }
  });

  // ==== NEW: Jurisdiction controls (EEZ + RFMO multi-select dropdown) ====
  const chkEEZ = document.getElementById("chkEEZ");

  // New dropdown controls (expected in index.html)
  const rfmoSelect = document.getElementById("rfmoSelect");
  const btnAll  = document.getElementById("rfmoAll");
  const btnNone = document.getElementById("rfmoNone");

  // Backwards-compat: if old RFMO checkboxes exist, we can still read them
  const rfmoChecksFallback = {
    NPFC:  document.getElementById("chkRFMO_NPFC"),
    NPAFC: document.getElementById("chkRFMO_NPAFC"),
    PSC:   document.getElementById("chkRFMO_PSC"),
    IPHC:  document.getElementById("chkRFMO_IPHC"),
    WCPFC: document.getElementById("chkRFMO_WCPFC"),
    IATTC: document.getElementById("chkRFMO_IATTC")
  };

  function selectedRfmoCodes() {
    if (rfmoSelect) {
      return new Set(Array.from(rfmoSelect.selectedOptions).map(o => o.value));
    }
    // Fallback to checkboxes if dropdown missing
    const s = new Set();
    Object.entries(rfmoChecksFallback).forEach(([code, el]) => {
      if (el && el.checked) s.add(code);
    });
    return s.size ? s : new Set(Object.keys(rfmoLayers)); // default all on
  }

  function applyRfmoSelectionFromUI() {
    const sel = selectedRfmoCodes();
    Object.entries(rfmoLayers).forEach(([code, lyr]) => {
      if (lyr) lyr.visible = sel.has(code);
    });
  }

  function applyJurisdictionVisibilityFromUI() {
    if (eezLayer) eezLayer.visible = chkEEZ ? !!chkEEZ.checked : true;
    applyRfmoSelectionFromUI();
  }

  // Initial sync
  if (rfmoSelect) {
    // Select all by default at first load
    Array.from(rfmoSelect.options).forEach(o => o.selected = true);
  }
  applyJurisdictionVisibilityFromUI();

  // Listeners
  if (chkEEZ && eezLayer) chkEEZ.addEventListener("change", () => { eezLayer.visible = chkEEZ.checked; });

  if (rfmoSelect) {
    rfmoSelect.addEventListener("change", applyRfmoSelectionFromUI);
    if (btnAll)  btnAll.addEventListener("click", () => { Array.from(rfmoSelect.options).forEach(o => o.selected = true);  applyRfmoSelectionFromUI(); });
    if (btnNone) btnNone.addEventListener("click", () => { Array.from(rfmoSelect.options).forEach(o => o.selected = false); applyRfmoSelectionFromUI(); });
  } else {
    // Fallback: old checkboxes
    Object.entries(rfmoChecksFallback).forEach(([code, el]) => {
      if (el && rfmoLayers[code]) {
        el.addEventListener("change", () => { rfmoLayers[code].visible = el.checked; });
      }
    });
    document.addEventListener("change", (e) => {
      const id = e.target && e.target.id;
      if (id && id.startsWith("chkRFMO_")) applyRfmoSelectionFromUI();
    });
  }

  // ---- Themes ----
  const themes = {
    intro: {
      // Orientation tab: welcome users to the prototype and provide basic guidance.
      title: "Welcome to the Demo North Pacific Ocean Knowledge Network Interactive Map",
      content:
        [
          '<p>Explore ocean conditions and environmental pressures, ecosystem status, fish dynamics and impacts.</p>',
          '<p><strong>How to navigate:</strong> Use the tabs above to switch between different datasets and map layers.</p>',
          '<p class="muted">Disclaimer: This is a demo. Do not use for decision‑making. Data shown are for illustrative purposes only.</p>'
        ].join(''),
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: false,
      showFishPanel: false,
      showTimeSlider: false,
      showLegend: false,
      activateLayers: () => {
        // Hide all data layers and overlays for the orientation view.
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        bindSliderTo(null);
        impactLayer.visible = false;
        stockLayer.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;

        applyJurisdictionVisibilityFromUI();
      }
    },
    env: {
      // Environmental Conditions tab with sub-tabs for Ocean state and Extreme events.
      title: '',
      content: '',
      // Hide all panels by default; sub-tabs will override visibility via applyEnvSubTab().
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: false,
      showFishPanel: false,
      showTimeSlider: false,
      showLegend: false,
      activateLayers: () => {
        // Delegate control to the sub-tab logic for Environmental Conditions.
        applyEnvSubTab();
      }
    },
    pressures: {
      // Ecosystem status tab: compare health indicators across LMEs.
      title: "Ecosystem Status",
      content:
        [
          '<p>View and compare ecosystem health indicators across North Pacific Large Marine Ecosystems (LMEs), including physical conditions, biological productivity and fisheries status. Standardised metrics enable cross‑regional comparisons to identify basin‑wide patterns and regional anomalies.</p>',
          '<p>Click on specific LMEs to view health status and primary concerns of that region.</p>',
          '<p class="muted">Disclaimer: Health score indices are for illustrative purposes only. These simplified indicators demonstrate platform functionality and should not be used for decision‑making.</p>'
        ].join(''),
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: false,
      showFishPanel: false,
      showTimeSlider: false,
      showLegend: true,
      activateLayers: () => {
        // Hide rasters and heatwave masks. LME health is static.
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        bindSliderTo(null);
        // Show LME shell boundaries (if user has enabled them) with popups.
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        // Show LME health polygons with their renderer and popups.
        if (lmeHealthLayer) {
          lmeHealthLayer.visible = true;
          lmeHealthLayer.popupEnabled = true;
        }
        // Hide species shift overlays and fish layers.
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible   = false;
        impactLayer.visible = false;
        stockLayer.visible  = false;
        // Sync jurisdiction overlays.
        applyJurisdictionVisibilityFromUI();
      }
    },
    jurisdictions: {
      // Management & ecosystem boundaries tab: explore governance layers.
      title: "Management & Ecosystem Boundaries",
      content:
        [
          '<p>View management and ecosystem boundaries such as Exclusive Economic Zones (EEZs), Regional Fisheries Management Organisation (RFMO) convention areas, and Large Marine Ecosystems (LMEs) that define how ocean resources are governed and monitored.</p>',
          '<p>Use the box below to toggle or multi‑select boundaries on the map.</p>'
        ].join(''),
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: true,
      showFishPanel: false,
      showTimeSlider: false,
      showLegend: false,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        bindSliderTo(null);
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
        impactLayer.visible = false;
        stockLayer.visible  = false;

        applyJurisdictionVisibilityFromUI();
      }
    },
    fish: {
      // Fish dynamics & impacts tab: explore fish population and impact data.
      title: "Fish Dynamics & Impacts",
      content:
        [
          '<p>Explore fish population trends, distribution patterns and reported impacts.</p>',
          '<p class="muted">Disclaimer: Fish data are for illustrative purposes and may not reflect current distributions or abundances. These visualisations demonstrate platform capabilities and should not be used for decision‑making at this time.</p>'
        ].join(''),
      showLayerPanel: false,
      showVectorPanel: false,
      showPressuresPanel: false,
      showJurisPanel: false,
      showFishPanel: true,
      showTimeSlider: false,
      showLegend: true,
      activateLayers: () => {
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        bindSliderTo(null);
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible   = false;

        syncFishToggles();
        applyJurisdictionVisibilityFromUI();
      }
    }
  };

  // ---- Panel wiring ----
  const layerPanelEl     = document.getElementById('layerPanel');
  const vectorPanelEl    = document.getElementById('vectorPanel');
  const pressuresPanelEl = document.getElementById('pressuresPanel');
  const jurisPanelEl     = document.getElementById('jurisPanel');
  const fishPanelEl      = document.getElementById('fishPanel');
  const themeTitleEl     = document.getElementById('themeTitle');
  const themeContentEl   = document.getElementById('themeContent');
  const tabButtons       = document.querySelectorAll('.tab');

  // ---- Environmental Conditions sub-tabs ----
  const envSubTabsEl      = document.getElementById('envSubTabs');
  const envSubTabButtons  = envSubTabsEl ? envSubTabsEl.querySelectorAll('.subtab') : [];
  let currentEnvSubTab    = 'ocean';

  /**
   * Apply the current Environmental Conditions sub-tab settings.  This function
   * updates the side panel title, description and which UI panels are shown
   * based on whether the user is viewing the Ocean state or Extreme events.
   */
  function applyEnvSubTab() {
    // Reset some defaults: hide all optional panels; this theme will decide which to show
    showPanel(layerPanelEl, false);
    showPanel(vectorPanelEl, false);
    showPanel(pressuresPanelEl, false);
    showPanel(jurisPanelEl, false);
    showPanel(fishPanelEl, false);
    // Default hide time slider and legend; we will enable as needed
    timeSlider.visible = false;
    if (legend) legend.visible = false;
    if (legendFieldset) legendFieldset.style.display = 'none';

    if (currentEnvSubTab === 'ocean') {
      // ---- Ocean state sub-view ----
      // Title
      if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = 'Ocean State';
      // Description
      if (themeContentEl) themeContentEl.innerHTML = [
        '<p>View environmental conditions across the north Pacific Ocean.</p>',
        '<p>Select a dataset below and use the time slider to explore temporal patterns. Only one dataset displays at a time to maintain temporal clarity.</p>'
      ].join('');
      // Panels: show raster dataset selection, vector overlays and the heatwave toggle
      showPanel(layerPanelEl, true);
      showPanel(vectorPanelEl, true);
      showPanel(pressuresPanelEl, true);
      // Show time slider and legend
      timeSlider.visible = true;
      if (legend) legend.visible = true;
      if (legendFieldset) legendFieldset.style.display = '';
      // Show rasters based on the selected radio button
      const checked = document.querySelector('input[name="rasterChoice"]:checked');
      if (checked) {
        if (checked.value === 'sstMonthly') setOnlyVisible(sstMonthly);
        if (checked.value === 'sstAnnual')  setOnlyVisible(sstAnnual);
        if (checked.value === 'chlMonthly') setOnlyVisible(chlMonthly);
        if (checked.value === 'chlAnnual')  setOnlyVisible(chlAnnual);
      } else {
        setOnlyVisible(sstMonthly);
      }
      // Heatwave overlay visible if checkbox is checked
      if (mhwLayer) mhwLayer.visible = chkMHW ? !!chkMHW.checked : false;
      // LME boundaries and species overlays
      lmeShell.visible = chkLMEs ? !!chkLMEs.checked : true;
      lmeShell.popupEnabled = true;
      if (lmeHealthLayer) lmeHealthLayer.visible = false;
      // Hide fish and species shift layers
      spLines.visible = false;
      spStart.visible = false;
      spEnd.visible   = false;
      impactLayer.visible = false;
      stockLayer.visible  = false;
      // Sync RFMO/EEZ visibility
      applyJurisdictionVisibilityFromUI();
      // Apply fish toggles to ensure stock/impact layers remain off
      syncFishToggles();
    } else if (currentEnvSubTab === 'extreme') {
      // ---- Extreme events sub-view ----
      if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = 'Extreme Events';
      if (themeContentEl) themeContentEl.innerHTML = [
        '<p>Track extreme events that affect marine ecosystems.</p>',
        '<p>Toggle to view marine heatwave events and use the timeline to explore the spatial and temporal patterns of these events.</p>'
      ].join('');
      // Only vector overlays (LMEs) and heatwave toggle should show
      showPanel(layerPanelEl, false);
      showPanel(vectorPanelEl, true);
      showPanel(pressuresPanelEl, true);
      // Show time slider and legend
      timeSlider.visible = true;
      if (legend) legend.visible = true;
      if (legendFieldset) legendFieldset.style.display = '';
      // Hide all rasters
      rasters.forEach(l => l.visible = false);
      // Heatwave overlay visible according to checkbox
      if (mhwLayer) mhwLayer.visible = chkMHW ? !!chkMHW.checked : false;
      // LME boundaries
      lmeShell.visible = chkLMEs ? !!chkLMEs.checked : true;
      lmeShell.popupEnabled = true;
      if (lmeHealthLayer) lmeHealthLayer.visible = false;
      // Hide fish and species shift layers
      spLines.visible = false;
      spStart.visible = false;
      spEnd.visible   = false;
      impactLayer.visible = false;
      stockLayer.visible  = false;
      // Sync RFMO/EEZ visibility
      applyJurisdictionVisibilityFromUI();
      syncFishToggles();
    }
  }

  // Listen for sub-tab clicks
  envSubTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-env-subtab');
      if (!tab || tab === currentEnvSubTab) return;
      currentEnvSubTab = tab;
      envSubTabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      applyEnvSubTab();
    });
  });

  function showPanel(el, show) { if (el) el.style.display = show ? '' : 'none'; }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-theme');
      if (!key || !themes[key]) return;
      tabButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      const theme = themes[key];
      // Show or hide the Environmental Conditions sub-tabs container
      if (envSubTabsEl) envSubTabsEl.style.display = (key === 'env') ? '' : 'none';
      // For non-env themes, reset currentEnvSubTab to ocean and clear active class on sub-tabs
      if (key !== 'env' && envSubTabButtons.length) {
        currentEnvSubTab = 'ocean';
        envSubTabButtons.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-env-subtab') === 'ocean'));
      }
      // Update title and content for themes other than env; env will override via applyEnvSubTab
      if (key !== 'env') {
        if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = theme.title;
        if (themeContentEl) themeContentEl.innerHTML = theme.content;
      }
      // For non-env themes, respect the show/hide flags defined by the theme; env will override via applyEnvSubTab
      showPanel(layerPanelEl,     theme.showLayerPanel);
      showPanel(vectorPanelEl,    theme.showVectorPanel);
      showPanel(pressuresPanelEl, theme.showPressuresPanel);
      showPanel(jurisPanelEl,     theme.showJurisPanel);
      showPanel(fishPanelEl,      theme.showFishPanel);
      timeSlider.visible = theme.showTimeSlider;
      // Show or hide the legend for non-env themes; env will control legend inside applyEnvSubTab
      if (key !== 'env') {
        if (legend) legend.visible = !!theme.showLegend;
        if (legendFieldset) legendFieldset.style.display = theme.showLegend ? '' : 'none';
      }
      theme.activateLayers();
      // If the selected theme is env, apply the sub-tab logic after activation
      if (key === 'env') {
        applyEnvSubTab();
      }
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
    // Apply legend visibility for the initial theme.
    if (legend) legend.visible = !!theme.showLegend;
    if (legendFieldset) legendFieldset.style.display = theme.showLegend ? '' : 'none';
    theme.activateLayers();

    // Ensure layer vis matches UI at load
    syncFishToggles();
    applyJurisdictionVisibilityFromUI();
  })();
});
