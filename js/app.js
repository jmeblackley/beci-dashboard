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
            // Prefer the full name field, then the short name, and fall back to RFB or a default label.
            "When(!IsEmpty($feature.RFMO_Full_Name), $feature.RFMO_Full_Name," +
            "     !IsEmpty($feature.RFMO_Name),      $feature.RFMO_Name," +
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
            // Coalesce species lists.  Only access a field if it exists to avoid
            // runtime errors when a service schema differs.  Prefer SpeciesManaged,
            // then Species_Managed.  Return null if neither field exists or both
            // are empty.
            "When(HasKey($feature,'SpeciesManaged') && !IsEmpty($feature['SpeciesManaged']), $feature['SpeciesManaged']," +
            "     HasKey($feature,'Species_Managed') && !IsEmpty($feature['Species_Managed']), $feature['Species_Managed']," +
            "     null)" },
        { name: "membersText",
          expression:
            // Coalesce member lists.  Prefer Members, then Member_Nations.
            "When(HasKey($feature,'Members') && !IsEmpty($feature['Members']), $feature['Members']," +
            "     HasKey($feature,'Member_Nations') && !IsEmpty($feature['Member_Nations']), $feature['Member_Nations']," +
            "     null)" },

        // Convention area: coalesce different field names
        { name: "convArea",
          expression: "When(!IsEmpty($feature.ConventionArea), $feature.ConventionArea, !IsEmpty($feature.Convention_Area), $feature.Convention_Area, null)" },
        // Why critical: fallback to null if empty
        { name: "whyCritical",
          expression: "DefaultValue($feature.WhyCritical, null)" },

        // Established: display year if we can parse a date, else show raw.
        { name: "establishedPretty",
          expression:
            "When(IsEmpty($feature.Established_Date), null," +
            "     TypeOf($feature.Established_Date) == 'Date', Text(Year($feature.Established_Date))," +
            "     IsNumeric($feature.Established_Date), $feature.Established_Date," +
            "     $feature.Established_Date)" },

        // Website: ensure protocol + clickable anchor.  Use Website_Link if present.
        { name: "websiteHref",
          expression:
            "var u = $feature.Website_Link;" +
            "IIf(IsEmpty(u), null, IIf(Left(Lower(u),4) == 'http', u, 'https://' + u))" },
        { name: "websiteHtml",
          expression:
            "IIf(IsEmpty($expression.websiteHref), null," +
            "'<a href=\"' + $expression.websiteHref + '\" target=\"_blank\" rel=\"noopener\">' + $expression.websiteHref + '</a>')" },

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

        // Meta row: Established + Website
        {
          type: "text",
          text:
            `<div style="display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 6px;font-size:12px;">
               <div><b>Established:</b> {expression/establishedPretty}</div>
               <div><b>Website:</b> {expression/websiteHtml}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.establishedPretty) || !IsEmpty($expression.websiteHtml)"
        },

        // Convention area (only shows when available)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Convention area</b></div>
               <div>{expression/convArea}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.convArea)"
        },

        // Why critical (only shows when available)
        {
          type: "text",
          text:
            `<div style="font-size:12px;line-height:1.55;margin-top:8px;">
               <div><b>Why critical</b></div>
               <div>{expression/whyCritical}</div>
             </div>`,
          visibleExpression: "!IsEmpty($expression.whyCritical)"
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
  const lmeHealthPopup = {
    title: "{lme_health_csv_LME_Name}",
    content: [
      {
        type: "fields",
        fieldInfos: [
          { fieldName: "lme_health_csv_LME_Name", label: "Large Marine Ecosystem" },
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

  if (chkLMEs) chkLMEs.addEventListener("change", () => { lmeShell.visible = chkLMEs.checked; });
  if (chkLines) chkLines.addEventListener("change", () => { spLines.visible = chkLines.checked; });
  if (chkStart) chkStart.addEventListener("change", () => { spStart.visible = chkStart.checked; });
  if (chkEnd)   chkEnd.addEventListener("change", () => { spEnd.visible   = chkEnd.checked; });

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
      // Ocean state tab: environmental conditions such as SST and chlorophyll provide a baseline context.
      title: "Ocean state",
      content:
        [
          '<p>View environmental conditions across the North Pacific Ocean. Select a dataset below and use the time slider to explore temporal patterns. Only one dataset is displayed at a time to maintain temporal clarity.</p>',
          '<p>Environmental conditions such as sea surface temperature (SST) and chlorophyll-<i>a</i> provide a baseline context.</p>'
        ].join(''),
      showLayerPanel: true,
      showVectorPanel: true,
      showPressuresPanel: false,
      showJurisPanel: false,
      showFishPanel: false,
      showTimeSlider: true,
      activateLayers: () => {
        // Show the selected raster dataset and hide others.
        const checked = document.querySelector('input[name="rasterChoice"]:checked');
        if (checked) {
          if (checked.value === "sstMonthly") setOnlyVisible(sstMonthly);
          if (checked.value === "sstAnnual")  setOnlyVisible(sstAnnual);
          if (checked.value === "chlMonthly") setOnlyVisible(chlMonthly);
          if (checked.value === "chlAnnual")  setOnlyVisible(chlAnnual);
        } else {
          setOnlyVisible(sstMonthly);
        }
        // Hide marine heatwave and other overlays by default.
        if (mhwLayer) mhwLayer.visible = false;
        lmeShell.visible = chkLMEs ? chkLMEs.checked : true;
        lmeShell.popupEnabled = true;
        if (lmeHealthLayer) lmeHealthLayer.visible = false;
        spLines.visible = false;
        spStart.visible = false;
        spEnd.visible = false;
        impactLayer.visible = false;
        stockLayer.visible = false;

        applyJurisdictionVisibilityFromUI();
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

    // Ensure layer vis matches UI at load
    syncFishToggles();
    applyJurisdictionVisibilityFromUI();
  })();
});
