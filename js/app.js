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

  //view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");

  // ---- Legend in left panel ----
  const legendDiv = document.getElementById('legendDiv');
  let legend;
  if (legendDiv) legend = new Legend({ view, container: legendDiv });

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
    visible: false,
    listMode: "hide"
  });

  //const mhwRenderer = new RasterColormapRenderer({
  //  colormapInfos: [
  //    { value: 0.00, color: [0, 0, 0, 0], label: "No heatwave" },     // fully transparent
  //    { value: 1.00, color: [253, 126, 20, 153], label: "Heatwave" }  // 60% opacity = 0.6 * 255
  //  ]
  //});




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
  mhwLayer.renderer = sstRenderer;
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
    // Detailed RFMO popup template.  This returns an object that defines
    // the popup title, a set of Arcade expressionInfos to normalize
    // attribute names (e.g. full name, acronym, species, members, dates),
    // and a list of content blocks.  Each content block is conditionally
    // displayed based on the presence of data.  The title uses a coloured
    // pill to display the RFMO acronym; the colour comes from
    // DisplayColorHex/DisplayColor when available.
    return {
      // Full name + coloured acronym pill (uses DisplayColorHex when present)
      title:
        `{expression/fullName} ` +
        `<span style="font-size:12px;padding:2px 8px;border-radius:9999px;` +
        `background:{expression/pillColor};color:#fff;margin-left:8px;">` +
        `{expression/acronym}</span>`,

      expressionInfos: [
        // Coalesce helpers (handle alternate field names & blanks)
        { name: "fullName",
          expression:
            // Use the full name field if present; fall back to the RFB code.
            "When(!IsEmpty($feature.RFMO_Full_Name), $feature.RFMO_Full_Name," +
            "     !IsEmpty($feature.RFB),            $feature.RFB," +
            "     'Regional Fisheries Body')" },
        { name: "acronym",
          expression:
            // Use the RFMO acronym if present; fall back to the RFB code or a generic placeholder.
            "When(!IsEmpty($feature.RFMO_Acronym), $feature.RFMO_Acronym," +
            "     !IsEmpty($feature.RFB),           Upper($feature.RFB)," +
            "     'RFMO')" },

        // Species & members: simple coalesced text fields.  Prefer SpeciesManaged/Members,
        // then fallback to Species_Managed/Member_Nations.
        { name: "speciesText",
          expression:
            // Read the species list from Species_Managed field; use null if empty.
            "IIf(!IsEmpty($feature.Species_Managed), $feature.Species_Managed, null)" },
        { name: "membersText",
          expression:
            // Read the member list from Member_Nations field; use null if empty.
            "IIf(!IsEmpty($feature.Member_Nations), $feature.Member_Nations, null)" },

        // Convention area: coalesce different field names
        { name: "convArea",
          expression: "When(!IsEmpty($feature.ConventionArea), $feature.ConventionArea, !IsEmpty($feature.Convention_Area), $feature.Convention_Area, null)" },
        // Why critical: fallback to null if empty
        { name: "whyCritical",
          expression: "DefaultValue($feature.WhyCritical, null)" },

        // Established: display just the year, rounding float values to the nearest integer.
        { name: "establishedPretty",
          expression:
            "IIf(IsEmpty($feature.Established_Date), null, Text(Round(Number($feature.Established_Date), 0)))" },

        // Website URL (display raw link).  Do not pre‑pend http or alter; rely on stored value.
        { name: "websiteUrl",
          expression: "DefaultValue($feature.Website_Link, null)" },

        // Long-form fields (render only if present).  Use the primary field names.
        { name: "keyApproaches",
          expression: "DefaultValue($feature.Key_Management_Approaches, null)" },
        { name: "methods",
          expression: "DefaultValue($feature.Management_methods, null)" },
        { name: "refLevel",
          expression: "DefaultValue($feature.Fishing_reference_level, null)" },
        { name: "hcr",
          expression: "DefaultValue($feature.Harvest_control_rule, null)" },
        { name: "research",
          expression: "DefaultValue($feature.Additional_research, null)" },
        { name: "climate",
          expression: "DefaultValue($feature.Climate_Adaptation_Initiatives, null)" },

        // Pill colour (prefer hex field; fall back to DisplayColor)
        { name: "pillColor",
          expression:
            "When(!IsEmpty($feature.DisplayColorHex), $feature.DisplayColorHex," +
            "     !IsEmpty($feature.DisplayColor),    $feature.DisplayColor," +
            "     '#6C757D')" }
      ],

      content: [
        // Section 1: Species managed (raw text)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.45;">
               <div><b>Species managed</b></div>
               <div>{expression/speciesText}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.speciesText)"
        },

        // Section 2: Members (raw text)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.45;margin-top:10px;">
               <div><b>Member nations / parties</b></div>
               <div>{expression/membersText}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.membersText)"
        },

        // Established date (separate row)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:12px;">
               <div><b>Established:</b> {expression/establishedPretty}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.establishedPretty)"
        },
        // Website link (separate row)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:6px;">
               <div><b>Website:</b> <a href="{expression/websiteUrl}" target="_blank" rel="noopener">{expression/websiteUrl}</a></div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.websiteUrl)"
        },

        // Convention area (field present but not displayed)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Convention area</b></div>
               <div>{expression/convArea}</div>
             </div>`,
          visibleExpression: "false"
        },

        // Why critical (field present but not displayed)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Why critical</b></div>
               <div>{expression/whyCritical}</div>
             </div>`,
          visibleExpression: "false"
        },

        // Long-form blocks (each hides if empty)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:6px;">
               <div><b>Key management approaches</b></div>
               <div>{expression/keyApproaches}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.keyApproaches)"
        },
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Management methods</b></div>
               <div>{expression/methods}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.methods)"
        },
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Fishing reference level</b></div>
               <div>{expression/refLevel}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.refLevel)"
        },
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Harvest control rule</b></div>
               <div>{expression/hcr}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.hcr)"
        },
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Additional research</b></div>
               <div>{expression/research}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.research)"
        },
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Climate adaptation initiatives</b></div>
               <div>{expression/climate}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.climate)"
        }
      ]
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
      visible: false
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
  // ---- LME health polygons ----

  // Popup for LME health – title pill + score bar + plain-text sections
  const lmeHealthPopup = {
    // Title with coloured status pill
    title:
      `{expression/cleanName} ` +
      `<span style="font-size:12px;padding:2px 8px;border-radius:9999px;` +
      `background:{expression/statusColor};color:#fff;margin-left:8px;">` +
      `{Overall_Status}</span>`,

    expressionInfos: [
      {
        name: "cleanName",
        title: "Normalized LME name",
        expression:
          "IIf(Find(Upper($feature.LME_Name), 'JAPAN') > -1 || " +
          "Find(Upper($feature.LME_Name), 'EAST SEA') > -1, " +
          "'LME 50', $feature.LME_Name)"
      },
      { // rounded score for display
        name: "scoreRounded",
        expression: "Round(DefaultValue($feature.Health_Score, 0))"
      },
      { // clamped score for bar width
        name: "scoreClamped",
        expression: "Max(0, Min(100, Round(DefaultValue($feature.Health_Score, 0))))"
      },
      { // pretty concern text
        name: "concernPretty",
        expression: "IIf(IsEmpty($feature.Primary_Concern), null, Proper($feature.Primary_Concern))"
      },
      { // safe notes (may be null)
        name: "notesSafe",
        expression: "IIf(IsEmpty($feature.Notes), null, $feature.Notes)"
      },
      { // colour for status pill + bar
        name: "statusColor",
        expression:
          "When( " +
          "$feature.Overall_Status == 'Critical', '#DC3545', " +
          "$feature.Overall_Status == 'Warning',  '#FD7E14', " +
          "$feature.Overall_Status == 'Caution',  '#FFC107', " +
          "$feature.Overall_Status == 'Good',     '#28A745', " +
          "'#6C757D')"
      }
    ],

    content: [
      // Score bar + primary concern
      {
        type: "text",
        text:
          `<div style="font-size:12px;line-height:1.45;">
             <div><b>Health score:</b> {expression/scoreRounded}/100</div>
             <div style="height:8px;background:#eee;border-radius:6px;margin:6px 0 10px;">
               <div style="height:8px;width:{expression/scoreClamped}%;
                           background:{expression/statusColor};
                           border-radius:6px;"></div>
             </div>
             <div><b>Primary concern:</b> {expression/concernPretty}</div>
           </div>`
      },
      // Notes as plain text (only renders when not empty)
      {
        type: "text",
        text:
          `<div style="font-size:12px;line-height:1.45;margin-top:8px;">
             <div><b>Notes:</b> {expression/notesSafe}</div>
           </div>`,
        visibleExpression: "!IsEmpty($feature.Notes)"
      }
    ]
  };

  // Feature layer
  const lmeHealthLayer = new FeatureLayer({
    portalItem: { id: items.lmeHealthId || "3ca4c0dfea2c4212b15c4dba53eb4189" },
    layerId: 0,
    title: "LME health",
    visible: false,
    outFields: ["LME_Name","Overall_Status","Health_Score","Primary_Concern","Notes"],
    popupTemplate: lmeHealthPopup
  });
  map.add(lmeHealthLayer);

  // Reapply your unique-value renderer *after* the layer loads
  function applyLmeHealthRenderer() {
    lmeHealthLayer.renderer = {
      type: "unique-value",
      field: "Overall_Status",
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
          symbol: { type: "simple-fill",
            color: [220, 53, 69, 0.7],
            outline: { color: [255,255,255,0.7], width: 0.5 } }
        },
        {
          value: "Warning",
          label: "Warning",
          symbol: { type: "simple-fill",
            color: [253,126,20,0.7],
            outline: { color: [255,255,255,0.7], width: 0.5 } }
        },
        {
          value: "Caution",
          label: "Caution",
          symbol: { type: "simple-fill",
            color: [255,193,7,0.7],
            outline: { color: [255,255,255,0.7], width: 0.5 } }
        },
        {
          value: "Good",
          label: "Good",
          symbol: { type: "simple-fill",
            color: [40,167,69,0.7],
            outline: { color: [255,255,255,0.7], width: 0.5 } }
        }
      ]
    };
  }

  // Ensure renderer wins over any saved portal style
  lmeHealthLayer.when(applyLmeHealthRenderer);
  // (Optional) also re-apply once the layer view is ready in the map view
  // view.whenLayerView(lmeHealthLayer).then(() => applyLmeHealthRenderer());
//
//  const lmeHealthPopup = {
//    title: "{LME_Name}",
//    content: [
//      {
//        type: "fields",
//        fieldInfos: [
//          { fieldName: "LME_Name", label: "Large Marine Ecosystem" },
//          { fieldName: "Overall_Status", label: "Health Status" },
//          { fieldName: "Health_Score", label: "Health Score (0–100)" },
//          { fieldName: "Primary_Concern", label: "Primary Concern" },
//          { fieldName: "Notes", label: "Additional Information" }
//        ]
//      }
//    ]
//  };
//  const lmeHealthLayer = new FeatureLayer({
//    portalItem: { id: items.lmeHealthId || "3ca4c0dfea2c4212b15c4dba53eb4189" },
//    layerId: 0,
//    title: "LME health",
//    visible: false,
//    outFields: [
//      "LME_Name",
//      "Overall_Status",
//      "Health_Score",
//      "Primary_Concern",
//      "Notes"
//    ],
//    popupTemplate: lmeHealthPopup
//  });
//  map.add(lmeHealthLayer);
//
//  function applyLmeHealthRenderer() {
//    lmeHealthLayer.renderer = {
//      type: "unique-value",
//      field: "Overall_Status",
//      defaultSymbol: {
//        type: "simple-fill",
//        color: [200, 200, 200, 0.3],
//        outline: { color: [255, 255, 255, 0.7], width: 0.5 }
//      },
//      defaultLabel: "Unknown",
//      uniqueValueInfos: [
//        { value: "Critical", label: "Critical", symbol: { type: "simple-fill", color: [220, 53, 69, 0.7],  outline: { color: [255,255,255,0.7], width: 0.5 } } },
//        { value: "Warning",  label: "Warning",  symbol: { type: "simple-fill", color: [253, 126, 20, 0.7], outline: { color: [255,255,255,0.7], width: 0.5 } } },
//        { value: "Caution",  label: "Caution",  symbol: { type: "simple-fill", color: [255, 193, 7, 0.7],  outline: { color: [255,255,255,0.7], width: 0.5 } } },
//        { value: "Good",     label: "Good",     symbol: { type: "simple-fill", color: [40, 167, 69, 0.7],  outline: { color: [255,255,255,0.7], width: 0.5 } } }
//      ]
//    };
//  }
//  applyLmeHealthRenderer();

  // ---- Species shift renderer ----
  function applySpeciesRenderer() {
    const categories = [
      { value: "Groundfish", label: "Groundfish", symbol: { type: "simple-line", color: [0, 102, 204, 0.7], width: 2.5 } },
      { value: "Pelagic",    label: "Pelagic",    symbol: { type: "simple-line", color: [255,102,  0, 0.7], width: 2.5 } },
      { value: "Salmon",     label: "Salmon",     symbol: { type: "simple-line", color: [204,  0,  0, 0.7], width: 2.5 } },
      { value: "General",    label: "General",    symbol: { type: "simple-line", color: [0,    0,  0, 0.7], width: 2.5 } }
    ];
    spLines.renderer = {
      type: "unique-value",
      valueExpression: `var sg = Upper(Trim($feature.SpeciesGroup));
        var gf  = IndexOf(sg, 'GROUNDFISH') >= 0;
        var pel = IndexOf(sg, 'PELAGIC') >= 0;
        var sal = IndexOf(sg, 'SALMON') >= 0;
        return IIf(gf, 'Groundfish', IIf(pel, 'Pelagic', IIf(sal, 'Salmon', 'General')));`,
      uniqueValueInfos: categories,
      defaultSymbol: { type: "simple-line", color: [0,0,0,0.7], width: 2.5 },
      defaultLabel: "General"
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
      // Only respond to raster changes when the Environmental conditions theme
      // is active and the Ocean State sub‑tab is selected.  This prevents
      // invisible rasters from being toggled while other themes are active.
      if (envSubTabList && envSubTabList.style.display !== 'none' && currentEnvSubTab === 'ocean') {
        switch (r.value) {
          case 'sstMonthly': setOnlyVisible(sstMonthly); break;
          case 'sstAnnual':  setOnlyVisible(sstAnnual);  break;
          case 'chlMonthly': setOnlyVisible(chlMonthly); break;
          case 'chlAnnual':  setOnlyVisible(chlAnnual);  break;
          default: break;
        }
      }
    });
  });

  // ---- Overlay checkboxes (LMEs/species) ----
  const chkLMEs  = document.getElementById("chkLMEs");
  const chkLines = document.getElementById("chkLines");
  const chkStart = document.getElementById("chkStart");
  const chkEnd   = document.getElementById("chkEnd");

  if (chkLMEs) chkLMEs.addEventListener("change", () => { lmeShell.visible = chkLMEs.checked; });
  if (chkLines) chkLines.addEventListener("change", () => { spLines.visible = chkLines.checked; });
  if (chkStart) chkStart.addEventListener("change", () => { spStart.visible = chkStart.checked; });
  if (chkEnd)   chkEnd.addEventListener("change", () => { spEnd.visible   = chkEnd.checked; });

  const chkMHW = document.getElementById("chkMHW");
  if (chkMHW && mhwLayer) chkMHW.addEventListener("change", () => {
    // Only toggle the marine heatwave layer when the Environmental conditions theme
    // is active and the Extreme Events sub‑tab is selected.  This prevents
    // inadvertently showing the layer on other themes.
    if (envSubTabList && envSubTabList.style.display !== 'none' && currentEnvSubTab === 'extreme') {
      mhwLayer.visible = chkMHW.checked;
    }
  });
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
  // ---- Startup defaults (no URL mutation; works in embedded iframes) ----
  // Edit these to change first-load visibility WITHOUT changing the URL.
  // Leave any field as null/undefined to use the code's existing defaults.
  const STARTUP_STATE = {
    // Start the application on the Introduction tab by default.  Previously this
    // defaulted to the Ocean state ("env") tab.  Changing this to 'intro'
    // ensures the landing page matches the label shown in the UI.
    tab: 'intro',               // 'intro' | 'env' | 'pressures' | 'jurisdictions' | 'fish'
    raster: 'sstMonthly',       // 'sstMonthly' | 'sstAnnual' | 'chlMonthly' | 'chlAnnual'
    overlays: {
      lmes: true,               // LME shell outline
      eez: false,               // Exclusive Economic Zones
      mhw: false,               // Marine heatwave mask (if available)
      rfmo: [],                 // e.g., ['NPFC','PSC'] — empty => all on
      fish: { stock: true, impact: true } // Fish tab toggles
    },
    // Set to true to have the app remember the user's last selections per session (no URL changes).
    persistSession: true
  };

  // Helper to load/save session state without touching the URL (works when embedded)
  function loadSessionState() {
    try { return JSON.parse(sessionStorage.getItem('beciState') || 'null'); } catch(_) { return null; }
  }
  function saveSessionState(state) {
    try { sessionStorage.setItem('beciState', JSON.stringify(state)); } catch(_) {}
  }


  // Backwards-compat: if old RFMO checkboxes exist, we can still read them
  const rfmoChecksFallback = {
    NPFC:  document.getElementById("chkRFMO_NPFC"),
    NPAFC: document.getElementById("chkRFMO_NPAFC"),
    PSC:   document.getElementById("chkRFMO_PSC"),
    IPHC:  document.getElementById("chkRFMO_IPHC"),
    WCPFC: document.getElementById("chkRFMO_WCPFC"),
    IATTC: document.getElementById("chkRFMO_IATTC")
  };

  // ==== Species filter control ====
  // Grab the species multi-select from the DOM (added in index.html).  It may be null
  // if the element is omitted from the page.
  const speciesSelect = document.getElementById("rfmoSpeciesSelect");

  // ---- Member nations filter control ----
  // Grab the member nations multi-select from the DOM.  This will be populated
  // dynamically when the RFMO layer is queried.
  const memberSelect = document.getElementById("rfmoMemberSelect");

  // Map of member nation / party name -> set of RFMO codes that include it.
  const memberToRfmoMap = {};

  // Map of species name -> set of RFMO codes that manage it.  This is populated
  // once when the RFMO layer is queried and used to update the RFMO list.
  const speciesToRfmoMap = {};

  /**
   * Helper to split a Member_Nations string into individual member names.  The field
   * uses commas to separate names, but some names contain commas within parentheses
   * (e.g. "Chinese Taipei (Taiwan, as separate entity)").  This function splits
   * on commas that are not inside parentheses.
   */
  function splitMembers(str) {
    const result = [];
    let token = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        const trimmed = token.trim();
        if (trimmed) result.push(trimmed);
        token = '';
      } else {
        token += ch;
      }
    }
    const finalTrimmed = token.trim();
    if (finalTrimmed) result.push(finalTrimmed);
    return result;
  }

  /**
   * Apply the species filter to all RFMO layers.  This function builds a
   * definitionExpression for each layer that preserves the per-RFMO acronym
   * filter and adds an OR-ed set of LIKE clauses for each selected species.
   */
  function applySpeciesFilter() {
    // Build filter expressions based on selected species and member nations. If neither
    // select element exists, there is nothing to filter.
    const selectedSpecies = speciesSelect ? Array.from(speciesSelect.selectedOptions).map(o => o.value) : [];
    const selectedMembers = memberSelect ? Array.from(memberSelect.selectedOptions).map(o => o.value) : [];
    Object.entries(rfmoLayers).forEach(([code, lyr]) => {
      if (!lyr) return;
      let expr = `RFMO_Acronym='${code}'`;
      // Append species filter if any species are selected
      if (selectedSpecies && selectedSpecies.length > 0) {
        const speciesParts = selectedSpecies.map(sp => {
          const up = sp.toUpperCase();
          return `(Upper(SpeciesManaged) LIKE '%${up}%' OR Upper(Species_Managed) LIKE '%${up}%')`;
        });
        expr += ' AND (' + speciesParts.join(' OR ') + ')';
      }
      // Append member filter if any member nations are selected
      if (selectedMembers && selectedMembers.length > 0) {
        const memberParts = selectedMembers.map(m => {
          const up = m.toUpperCase();
          return `Upper(Member_Nations) LIKE '%${up}%'`;
        });
        expr += ' AND (' + memberParts.join(' OR ') + ')';
      }
      lyr.definitionExpression = expr;
    });
  }

  /**
   * Open a popup for the given RFMO code by querying the full RFMO layer and
   * centering the view on the first matching feature.  This allows double‑
   * clicking an RFMO name in the list to zoom to and display its popup.
   */
  function openRfmoPopup(code) {
    if (!rfmoAll || !view) return;
    rfmoAll.queryFeatures({
      where: `RFMO_Acronym='${code}'`,
      outFields: ["*"],
      returnGeometry: true
    }).then((fs) => {
      if (!fs || !fs.features || fs.features.length === 0) return;
      const feature = fs.features[0];
      // Zoom to the feature and open its popup
      view.goTo(feature.geometry).then(() => {
        view.popup.open({
          features: [feature],
          location: feature.geometry
        });
      });
    });
  }

  /**
   * Update the RFMO multi-select options based on the species currently selected.
   * When no species are selected, all RFMOs are shown.  Otherwise only the RFMOs
   * that manage at least one selected species remain.  After rebuilding the
   * options list, this calls applyRfmoSelectionFromUI() which applies both
   * visibility and species filters to the layers.
   */
  function updateRfmoSelectBasedOnSpecies() {
    if (!speciesSelect || !rfmoSelect) {
      // Still ensure layers are filtered
      applyRfmoSelectionFromUI();
      return;
    }
    // Build allowed codes based on selected species and member nations.
    const selectedSpecies = speciesSelect ? Array.from(speciesSelect.selectedOptions).map(o => o.value) : [];
    const selectedMembers = memberSelect ? Array.from(memberSelect.selectedOptions).map(o => o.value) : [];
    // Determine species-allowed codes (all codes if none selected)
    let speciesAllowed;
    if (!selectedSpecies || selectedSpecies.length === 0) {
      speciesAllowed = new Set(Object.keys(rfmoFullNames));
    } else {
      speciesAllowed = new Set();
      selectedSpecies.forEach(sp => {
        const codes = speciesToRfmoMap[sp];
        if (codes) {
          codes.forEach(c => speciesAllowed.add(c));
        }
      });
    }
    // Determine member-allowed codes (all codes if none selected)
    let memberAllowed;
    if (!selectedMembers || selectedMembers.length === 0) {
      memberAllowed = new Set(Object.keys(rfmoFullNames));
    } else {
      memberAllowed = new Set();
      selectedMembers.forEach(m => {
        const codes = memberToRfmoMap[m];
        if (codes) {
          codes.forEach(c => memberAllowed.add(c));
        }
      });
    }
    // Intersection of speciesAllowed and memberAllowed
    const allowedCodes = new Set();
    speciesAllowed.forEach((code) => {
      if (memberAllowed.has(code)) allowedCodes.add(code);
    });
    // Preserve currently selected RFMOs, but only if they are still allowed
    const prevSelected = new Set(Array.from(rfmoSelect.selectedOptions).map(o => o.value));
    rfmoSelect.innerHTML = '';
    Object.keys(rfmoFullNames).forEach(code => {
      if (allowedCodes.has(code)) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = rfmoFullNames[code];
        // Select option if it was previously selected, or if no species and no members are selected
        const noneSelected = (!selectedSpecies || selectedSpecies.length === 0) && (!selectedMembers || selectedMembers.length === 0);
        if (prevSelected.has(code) || noneSelected) opt.selected = true;
        rfmoSelect.appendChild(opt);
      }
    });
    // If no RFMO remained selected, decide whether to auto‑select the
    // remaining options.  Historically the code selected all allowed RFMOs
    // whenever none were selected.  To support a default state where no
    // RFMO boundaries are shown on initial load, only auto‑select if the
    // user had previously made a selection (prevSelected non‑empty) and that
    // selection has been filtered out by the current species/member filters.
    if (rfmoSelect.selectedOptions.length === 0) {
      const hadPrevious = prevSelected && prevSelected.size > 0;
      if (hadPrevious) {
        Array.from(rfmoSelect.options).forEach(o => { o.selected = true; });
      }
    }
    // Apply selections and filters
    applyRfmoSelectionFromUI();
  }

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
    // Re-apply species filter when RFMO visibility changes to ensure
    // definition expressions reflect current selections.
    applySpeciesFilter();
  }

  function applyJurisdictionVisibilityFromUI() {
    if (eezLayer) eezLayer.visible = chkEEZ ? !!chkEEZ.checked : true;
    applyRfmoSelectionFromUI();
  }

  // Initial sync
  if (rfmoSelect) {
    // Previously the RFMO multi‑select defaulted to selecting all options.  To
    // honour the specification that RFMO boundaries be off by default, we
    // instead deselect all options on first load.
    Array.from(rfmoSelect.options).forEach(o => { o.selected = false; });
  }
  // Apply visibility after adjusting the selection so the layers start hidden.
  applyJurisdictionVisibilityFromUI();

  // Listeners
  if (chkEEZ && eezLayer) chkEEZ.addEventListener("change", () => { eezLayer.visible = chkEEZ.checked; });

  if (rfmoSelect) {
    rfmoSelect.addEventListener("change", applyRfmoSelectionFromUI);
    if (btnAll)  btnAll.addEventListener("click", () => { Array.from(rfmoSelect.options).forEach(o => o.selected = true);  applyRfmoSelectionFromUI(); });
    if (btnNone) btnNone.addEventListener("click", () => { Array.from(rfmoSelect.options).forEach(o => o.selected = false); applyRfmoSelectionFromUI(); });
    // Open the RFMO popup on double‑click of a list item
    rfmoSelect.addEventListener("dblclick", (e) => {
      const target = e.target;
      // Only respond to double‑clicks on option elements
      if (target && target.tagName === 'OPTION') {
        const code = target.value;
        if (code) openRfmoPopup(code);
      }
    });
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

  // Populate the speciesSelect with unique species names by querying the full RFMO layer.
  if (rfmoAll && speciesSelect) {
    rfmoAll.queryFeatures({
      where: "1=1",
      outFields: ["SpeciesManaged", "Species_Managed", "Member_Nations", "RFMO_Acronym"],
      returnGeometry: false
    }).then((fs) => {
      const speciesSet = new Set();
      const memberSet = new Set();
      fs.features.forEach((feature) => {
        const code = feature.attributes["RFMO_Acronym"];
        ["SpeciesManaged", "Species_Managed"].forEach((field) => {
          const list = feature.attributes[field];
          if (list) {
            list.split(/[;,]/).forEach((s) => {
              const trimmed = s.trim();
              if (!trimmed) return;
              speciesSet.add(trimmed);
              // Record mapping of species to RFMO codes
              if (!speciesToRfmoMap[trimmed]) speciesToRfmoMap[trimmed] = new Set();
              speciesToRfmoMap[trimmed].add(code);
            });
          }
        });
        // Parse member nations; use only Member_Nations field as requested
        const membersStr = feature.attributes["Member_Nations"];
        if (membersStr) {
          const names = splitMembers(membersStr);
          names.forEach((name) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            memberSet.add(trimmed);
            if (!memberToRfmoMap[trimmed]) memberToRfmoMap[trimmed] = new Set();
            memberToRfmoMap[trimmed].add(code);
          });
        }
      });
      const sorted = Array.from(speciesSet).sort();
      sorted.forEach((sp) => {
        const opt = document.createElement("option");
        opt.value = sp;
        opt.textContent = sp;
        speciesSelect.appendChild(opt);
      });
      // Populate member nations select
      if (memberSelect) {
        const memSorted = Array.from(memberSet).sort();
        memSorted.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          memberSelect.appendChild(opt);
        });
        // Select all by default
        Array.from(memberSelect.options).forEach(o => { o.selected = true; });
      }
      // Initially synchronise the RFMO list and filters with no species selected
      updateRfmoSelectBasedOnSpecies();
    });
    // When the user changes the species selection, update the RFMO list and filters
    speciesSelect.addEventListener("change", updateRfmoSelectBasedOnSpecies);
    // When the user changes the member selection, update the RFMO list and filters
    if (memberSelect) {
      memberSelect.addEventListener("change", updateRfmoSelectBasedOnSpecies);
    }
  }

  // Wire up the clear species button to reset selections
  const speciesClearBtn = document.getElementById("rfmoSpeciesClear");
  if (speciesClearBtn && speciesSelect) {
    speciesClearBtn.addEventListener("click", () => {
      Array.from(speciesSelect.options).forEach(o => { o.selected = false; });
      updateRfmoSelectBasedOnSpecies();
    });
  }

  // Wire up the clear member nations button to reset selections
  const memberClearBtn = document.getElementById("rfmoMemberClear");
  if (memberClearBtn && memberSelect) {
    memberClearBtn.addEventListener("click", () => {
      Array.from(memberSelect.options).forEach(o => { o.selected = false; });
      updateRfmoSelectBasedOnSpecies();
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
      activateLayers: () => {
        // Hide the Environmental conditions sub-tab list when leaving that theme
        if (envSubTabList) envSubTabList.style.display = 'none';
        // Hide all data layers and overlays for the introduction view.
        // Reset visibility for all raster datasets and time-aware layers.
        rasters.forEach((layer) => { layer.visible = false; });
        if (mhwLayer) mhwLayer.visible = false;
        // Hide species shift overlays.
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
        // Hide fish stock/impact overlays.
        impactLayer.visible = false;
        stockLayer.visible = false;
        // Hide LME health polygons.
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        // Completely hide jurisdiction and shell boundaries on the intro view.
        if (lmeShell) {
          lmeShell.visible = false;
          lmeShell.popupEnabled = false;
        }
        if (lmeLayer) lmeLayer.visible = false;
        if (eezLayer) eezLayer.visible = false;
        // Hide all individual RFMO layers and the aggregate layer.
        Object.values(rfmoLayers).forEach((lyr) => { if (lyr) lyr.visible = false; });
        if (rfmoAll) rfmoAll.visible = false;
        // Detach the TimeSlider since nothing is displayed.
        bindSliderTo(null);
        // Do not restore jurisdiction visibility here; other themes will handle that.
      }
    },
    env: {
      // Environmental conditions tab: contains two sub‑sections (Ocean State & Extreme Events).
      title: "Environmental conditions",
      content: '',
      // Keep all panels visible so they can be toggled per sub‑tab.  The sub‑tab logic
      // will decide which panels to show or hide.
      showLayerPanel: true,
      showVectorPanel: true,
      showPressuresPanel: true,
      showJurisPanel: false,
      showFishPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        // When entering the Environmental conditions theme, reveal the sub-tab list and
        // delegate layer activation to the current sub-tab.  The sub-tab logic will
        // handle which panels and layers should be visible.
        if (envSubTabList) envSubTabList.style.display = '';
        activateEnvSubTab(currentEnvSubTab);
      }
    },
    pressures: {
      // Ecosystem status tab: compare health indicators across LMEs.
      title: "Ecosystem status",
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
      activateLayers: () => {
        // Hide the Environmental conditions sub-tab list when this theme is activated
        if (envSubTabList) envSubTabList.style.display = 'none';
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
      title: "Management & ecosystem boundaries",
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
      activateLayers: () => {
        // Hide the Environmental conditions sub-tab list when this theme is activated
        if (envSubTabList) envSubTabList.style.display = 'none';
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
      title: "Fish dynamics & impacts",
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
      activateLayers: () => {
        // Hide the Environmental conditions sub-tab list when this theme is activated
        if (envSubTabList) envSubTabList.style.display = 'none';
        rasters.forEach(l => l.visible = false);
        if (mhwLayer) mhwLayer.visible = false;
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        bindSliderTo(null);
        spLines.visible = true;
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
  // Select only the primary theme tabs.  The .subtab buttons inside the side panel
  // lack the data-theme attribute and are excluded from this list.
  const tabButtons       = document.querySelectorAll('.tab[data-theme]');

  // ----- Environmental conditions sub-tabs -----
  // Grab the sub-tab container and its buttons.  This list is hidden until the
  // Environmental conditions tab is selected.  Each button has a data-sub
  // attribute indicating the subcategory ('ocean' or 'extreme').
  const envSubTabList = document.getElementById('envSubTabList');
  const envSubTabButtons = envSubTabList ? envSubTabList.querySelectorAll('.subtab') : [];
  // Maintain state of which sub-tab is currently active.  Defaults to the
  // Ocean State view.
  let currentEnvSubTab = 'ocean';
  // Map sub-tab identifiers to their descriptive HTML strings.  These blocks
  // will be injected into the themeContent element when the sub-tab is chosen.
  const envSubTabDescriptions = {
    ocean: [
      '<p>View environmental conditions across the North Pacific Ocean. Select a dataset below and use the time slider to explore temporal patterns. Only one dataset is displayed at a time to maintain temporal clarity.</p>',
      '<p>Environmental conditions such as sea surface temperature (SST) and chlorophyll-<i>a</i> provide a baseline context.</p>'
    ].join(''),
    extreme: [
      '<p>Track extreme events that affect marine ecosystems. Toggle to view marine heatwave events and use the timeline to explore the spatial and temporal patterns of these events.</p>'
    ].join('')
  };
  /**
   * Switches the Environmental conditions sub-tabs and updates the UI accordingly.
   *
   * Selecting a sub-tab toggles which control panels are visible (raster vs. extreme
   * events), updates the descriptive content, and adjusts the map layers.  It also
   * hides ancillary overlays such as species shift and fish impacts which are not
   * relevant to this theme.
   *
   * @param {string} sub - Either 'ocean' (Ocean State) or 'extreme' (Extreme Events).
   */
  function activateEnvSubTab(sub) {
    currentEnvSubTab = sub;
    // Highlight the active sub-tab button
    if (envSubTabButtons && envSubTabButtons.forEach) {
      envSubTabButtons.forEach((btn) => {
        const subKey = btn.getAttribute('data-sub');
        btn.classList.toggle('is-active', subKey === sub);
      });
    }
    // Update the description in the content area
    if (themeContentEl) {
      themeContentEl.innerHTML = envSubTabDescriptions[sub] || '';
    }
    // Hide overlays that are not pertinent in this theme
    spLines.visible = false;
    spStart.visible = false;
    spEnd.visible   = false;
    if (lmeHealthLayer) lmeHealthLayer.visible = false;
    impactLayer.visible = false;
    stockLayer.visible  = false;
    // Always apply jurisdiction visibility after toggling overlays
    applyJurisdictionVisibilityFromUI();
    // Adjust panels and map layers for the selected sub-tab
    if (sub === 'ocean') {
      // Display raster controls and vector overlays
      showPanel(layerPanelEl, true);
      showPanel(vectorPanelEl, true);
      showPanel(pressuresPanelEl, false);
      // Determine which raster is selected and show it exclusively
      const checkedRadio = document.querySelector('input[name="rasterChoice"]:checked');
      if (checkedRadio) {
        switch (checkedRadio.value) {
          case 'sstMonthly': setOnlyVisible(sstMonthly); break;
          case 'sstAnnual':  setOnlyVisible(sstAnnual);  break;
          case 'chlMonthly': setOnlyVisible(chlMonthly); break;
          case 'chlAnnual':  setOnlyVisible(chlAnnual);  break;
          default: break;
        }
      } else {
        setOnlyVisible(sstMonthly);
      }
      // Ensure marine heatwave events are hidden in the Ocean State view
      if (mhwLayer) mhwLayer.visible = false;
    } else {
      // Extreme Events view: hide raster and vector panels, show extreme events panel
      showPanel(layerPanelEl, false);
      showPanel(vectorPanelEl, false);
      showPanel(pressuresPanelEl, true);
      // Hide all rasters
      rasters.forEach((layer) => { layer.visible = false; });
      // Show or hide the marine heatwave layer based on the checkbox
      const chk = document.getElementById('chkMHW');
      if (mhwLayer) {
        mhwLayer.visible = chk ? !!chk.checked : true;
      }
      // Bind the time slider to the marine heatwave layer
      bindSliderTo(mhwLayer);
    }
  }
  // Attach click handlers to the sub-tab buttons so they switch views
  if (envSubTabButtons && envSubTabButtons.forEach) {
    envSubTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const subKey = btn.getAttribute('data-sub');
        if (subKey) {
          activateEnvSubTab(subKey);
        }
      });
    });
  }

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
      showPanel(fishPanelEl,      theme.showFishPanel);
      timeSlider.visible = theme.showTimeSlider;
      theme.activateLayers();
    });
  });

  // Initial theme
  (function initTheme() {
    // Merge persisted session state with static STARTUP_STATE
    const ss = (STARTUP_STATE.persistSession && loadSessionState()) || {};
    const initialTab = (ss.tab || STARTUP_STATE.tab || 'intro');
    const themeKey = themes[initialTab] ? initialTab : 'intro';
    const theme = themes[themeKey];
    if (!theme) return;

    // Apply control defaults BEFORE activating tab logic
    const rasterVal = ss.raster || STARTUP_STATE.raster;
    if (rasterVal) {
      const r = document.querySelector(`input[name="rasterChoice"][value="${rasterVal}"]`);
      if (r) r.checked = true;
    }
    const overlays = Object.assign({},
      { lmes: undefined, eez: undefined, mhw: undefined, rfmo: undefined,
        fish: { stock: undefined, impact: undefined } },
      ss.overlays || {}, STARTUP_STATE.overlays || {}
    );
    if (typeof overlays.lmes === 'boolean') {
      const el = document.getElementById('chkLMEs'); if (el) el.checked = overlays.lmes;
    }
    if (typeof overlays.eez === 'boolean') {
      const el = document.getElementById('chkEEZ'); if (el) el.checked = overlays.eez;
    }
    if (typeof overlays.mhw === 'boolean') {
      const el = document.getElementById('chkMHW'); if (el) el.checked = overlays.mhw;
    }
    if (overlays.fish && typeof overlays.fish.stock === 'boolean') {
      const el = document.getElementById('chkStock'); if (el) el.checked = overlays.fish.stock;
    }
    if (overlays.fish && typeof overlays.fish.impact === 'boolean') {
      const el = document.getElementById('chkImpact'); if (el) el.checked = overlays.fish.impact;
    }
    // RFMO multi-select defaults (if specific codes provided)
    if (Array.isArray(overlays.rfmo) && overlays.rfmo.length && rfmoSelect) {
      Array.from(rfmoSelect.options).forEach(o => { o.selected = overlays.rfmo.includes(o.value); });
    }

    // Set tab button state
    tabButtons.forEach((b) => {
      const isActive = b.getAttribute('data-theme') === themeKey;
      b.classList.toggle('is-active', isActive);
    });

    // Write panels & activate the tab's visibility logic
    if (themeTitleEl) themeTitleEl.querySelector('h2').textContent = theme.title;
    if (themeContentEl) themeContentEl.innerHTML = theme.content;
    showPanel(layerPanelEl,     theme.showLayerPanel);
    showPanel(vectorPanelEl,    theme.showVectorPanel);
    showPanel(pressuresPanelEl, theme.showPressuresPanel);
    showPanel(jurisPanelEl,     theme.showJurisPanel);
    showPanel(fishPanelEl,      theme.showFishPanel);
    timeSlider.visible = theme.showTimeSlider;
    theme.activateLayers();

    // Make sure overlays reflect the just-applied UI
    syncFishToggles();
    applyJurisdictionVisibilityFromUI();

    // Persist after first activation
    if (STARTUP_STATE.persistSession) {
      saveSessionState({ tab: themeKey, raster: rasterVal || 'sstMonthly', overlays });
    }
  })();

// Persist tab & key control changes (no URL changes)
  if (STARTUP_STATE.persistSession) {
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-theme');
        const checked = document.querySelector('input[name="rasterChoice"]:checked');
        const state = loadSessionState() || {};
        state.tab = key;
        state.raster = checked ? checked.value : state.raster;
        state.overlays = state.overlays || {};
        state.overlays.lmes = document.getElementById('chkLMEs')?.checked ?? state.overlays.lmes;
        state.overlays.eez  = document.getElementById('chkEEZ')?.checked  ?? state.overlays.eez;
        state.overlays.mhw  = document.getElementById('chkMHW')?.checked  ?? state.overlays.mhw;
        state.overlays.fish = state.overlays.fish || {};
        state.overlays.fish.stock  = document.getElementById('chkStock')?.checked  ?? state.overlays.fish.stock;
        state.overlays.fish.impact = document.getElementById('chkImpact')?.checked ?? state.overlays.fish.impact;
        // RFMO dropdown selections
        if (rfmoSelect) {
          state.overlays.rfmo = Array.from(rfmoSelect.selectedOptions).map(o => o.value);
        }
        saveSessionState(state);
      });
    });
    document.addEventListener('change', (e) => {
      const id = e.target && e.target.id;
      if (!id) return;
      const state = loadSessionState() || {};
      state.overlays = state.overlays || {};
      if (id === 'chkLMEs') state.overlays.lmes = !!e.target.checked;
      if (id === 'chkEEZ')  state.overlays.eez  = !!e.target.checked;
      if (id === 'chkMHW')  state.overlays.mhw  = !!e.target.checked;
      if (id === 'chkStock' || id === 'chkImpact') {
        state.overlays.fish = state.overlays.fish || {};
        if (id === 'chkStock')  state.overlays.fish.stock  = !!e.target.checked;
        if (id === 'chkImpact') state.overlays.fish.impact = !!e.target.checked;
      }
      if (e.target.name === 'rasterChoice') state.raster = e.target.value;
      saveSessionState(state);
    });
  }

});
