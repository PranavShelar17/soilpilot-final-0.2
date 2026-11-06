import fs from "fs";
import path from "path";

export interface CriterionDef {
  name: string;
  unit: string;
  weight: number;
  s1: any;
  s2: any;
  s3: any;
  n?: any;
  n_ranges?: any;
  notes?: string;
  rainfall_type?: string;
}

export interface CropDef {
  crop_code: string;
  crop_name: string;
  crop_name_mr: string;
  tolerance: string;
  category: string;
  parameters: Record<string, CriterionDef>;
}

export interface RulesData {
  version: string;
  framework: string;
  crops: Record<string, CropDef>;
}

export interface SoilIndicators {
  gat_no: string;
  area_ha?: number | null;
  area_acres?: number | null;
  village?: string;
  centroid?: [number, number];
  bounds?: [number, number, number, number];
  ph?: number | null;
  soc?: number | null;
  nitrogen?: number | null;
  bd?: number | null;
  elevation?: number | null;
  slope?: number | null;
  texture?: string | null;
  ec?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  irrigation_available?: boolean;
}

const CLASS_SCORES: Record<string, number> = {
  S1: 100.0,
  S2: 75.0,
  S3: 50.0,
  N: 20.0,
};

const CLASS_RANKS: Record<string, number> = {
  S1: 1,
  S2: 2,
  S3: 3,
  N: 4,
};

const RANK_TO_CLASS: Record<number, string> = {
  1: "S1",
  2: "S2",
  3: "S3",
  4: "N",
};

const CLASS_COLORS: Record<string, string> = {
  S1: "#16a34a",
  S2: "#eab308",
  S3: "#f97316",
  N: "#dc2626",
  UNCERTAIN: "#9ca3af",
};

// Weather normals for Malegaon Khurd / Baramati (1991-2020 WMO Baseline)
export const WEATHER_NORMALS = {
  annual_rainfall_mm: 654.1,
  kharif_rainfall_mm: 495.2,
  rabi_rainfall_mm: 112.4,
  mean_temperature_c: 26.6,
  relative_humidity_pct: 58.2,
};

export const WEATHER_SUMMARY = {
  metadata: {
    latitude: 18.101933,
    longitude: 74.4888,
    elevation_m: 542.0,
    timezone: "Asia/Kolkata",
    source: "Open-Meteo ERA5 / ERA5-Land Reanalysis",
  },
  baseline_period: "1991-2020",
  historical_30yr: {
    annual_rainfall_mm: 654.1,
    annual_rainfall_min_mm: 363.8,
    annual_rainfall_max_mm: 1042.4,
    annual_rainfall_std_mm: 162.3,
    kharif_rainfall_mm: 495.2,
    rabi_rainfall_mm: 112.4,
    mean_temperature_c: 26.6,
    mean_max_temperature_c: 33.1,
    mean_min_temperature_c: 20.2,
    relative_humidity_pct: 58.2,
    reference_et0_annual_mm: 1725.8,
    vpd_mean_kpa: 1.34,
    mean_rainy_days_count: 41.5,
  },
  recent_period_2016_2025: {
    annual_rainfall_mm: 678.5,
    annual_rainfall_min_mm: 395.2,
    annual_rainfall_max_mm: 982.1,
    mean_temperature_c: 26.9,
  },
  quality_reports: {
    historical_30yr: {
      period: "1991-2020 (WMO Climatological Normal)",
      latitude: 18.101933,
      longitude: 74.4888,
      elevation_m: 542.0,
      timezone: "Asia/Kolkata",
      expected_days: 10958,
      actual_days: 10958,
      missing_days: 0,
      expected_hours: 262992,
      actual_hours: 262992,
      missing_hours: 0,
      is_continuous: true,
    },
    recent_variability: {
      period: "2016-2025 (Recent Climate Variability)",
      latitude: 18.1,
      longitude: 74.49,
      elevation_m: 542.0,
      timezone: "Asia/Kolkata",
      total_days: 3652,
    },
  },
};

let cachedRules: RulesData | null = null;
let cachedSoils: Record<string, SoilIndicators> | null = null;
let cachedGeoJson: any | null = null;

function resolveDataFile(filename: string): string {
  const candidates = [
    path.join(process.cwd(), "public", "data", filename),
    path.join(process.cwd(), "frontend", "public", "data", filename),
    path.join(process.cwd(), "market-0.2-main", "frontend", "public", "data", filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function loadRules(): RulesData {
  if (cachedRules) return cachedRules;
  const filePath = resolveDataFile("crop_suitability_rules.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedRules = JSON.parse(raw);
  return cachedRules!;
}

function loadSoils(): Record<string, SoilIndicators> {
  if (cachedSoils) return cachedSoils;
  const filePath = resolveDataFile("gat_soil_indicators_cache.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedSoils = JSON.parse(raw);
  return cachedSoils!;
}

function loadGeoJson(): any {
  if (cachedGeoJson) return cachedGeoJson;
  const filePath = resolveDataFile("malegaon_plots.geojson");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedGeoJson = JSON.parse(raw);
  return cachedGeoJson!;
}

function evaluateNumericRange(val: number, sRange: any): boolean {
  if (sRange === null || sRange === undefined) return false;
  if (Array.isArray(sRange) && sRange.length > 0 && Array.isArray(sRange[0])) {
    return sRange.some((sub) => evaluateNumericRange(val, sub));
  }
  if (Array.isArray(sRange) && sRange.length === 2) {
    const [low, high] = sRange;
    if (low !== null && val < low) return false;
    if (high !== null && val > high) return false;
    return true;
  }
  return false;
}

function formatRange(r: any): string {
  if (!r) return "N/A";
  if (Array.isArray(r) && r.length === 2 && !Array.isArray(r[0])) {
    const [low, high] = r;
    if (low === null) return `< ${high}`;
    if (high === null) return `> ${low}`;
    return `${low} – ${high}`;
  }
  return String(r);
}

export function evaluateCriterion(
  paramKey: string,
  paramDef: CriterionDef,
  observedValue: any,
  dataSource = "DSM_RASTER"
): any {
  const unit = paramDef.unit || "";
  const weight = Number(paramDef.weight) || 0;
  const paramName = paramDef.name || paramKey;

  if (observedValue === null || observedValue === undefined || isNaN(observedValue)) {
    return {
      parameter_key: paramKey,
      parameter_name: paramName,
      unit,
      weight,
      value: null,
      suitability_class: "UNCERTAIN",
      score: null,
      is_limiting: false,
      status: "MISSING_DATA",
      explanation: `Missing or unrecorded data for ${paramName}.`,
      source: dataSource,
    };
  }

  // Categorical texture evaluation
  if (paramKey === "texture") {
    const textVal = String(observedValue).trim().toLowerCase();
    const s1List = (paramDef.s1 || []).map((t: string) => t.toLowerCase());
    const s2List = (paramDef.s2 || []).map((t: string) => t.toLowerCase());
    const s3List = (paramDef.s3 || []).map((t: string) => t.toLowerCase());
    const nList = (paramDef.n || []).map((t: string) => t.toLowerCase());

    const matches = (target: string, list: string[]) =>
      list.some(
        (item) =>
          target === item ||
          target === item.replace(/ /g, "") ||
          target === item.replace(/-/g, "")
      );

    let matchedClass = "N";
    if (matches(textVal, s1List)) matchedClass = "S1";
    else if (matches(textVal, s2List)) matchedClass = "S2";
    else if (matches(textVal, s3List)) matchedClass = "S3";
    else if (matches(textVal, nList)) matchedClass = "N";
    else if (s1List.some((item: string) => item.length > 4 && textVal.includes(item))) matchedClass = "S1";
    else if (s2List.some((item: string) => item.length > 4 && textVal.includes(item))) matchedClass = "S2";
    else if (s3List.some((item: string) => item.length > 4 && textVal.includes(item))) matchedClass = "S3";
    else matchedClass = "N";

    const score = CLASS_SCORES[matchedClass] ?? 50.0;
    const isLimiting = ["S2", "S3", "N"].includes(matchedClass);
    const explanation = `Soil texture '${observedValue}' evaluated as ${matchedClass} (S1 requires: ${(paramDef.s1 || []).join(", ")}).`;

    return {
      parameter_key: paramKey,
      parameter_name: paramName,
      unit,
      weight,
      value: observedValue,
      suitability_class: matchedClass,
      score,
      is_limiting: isLimiting,
      status: "EVALUATED",
      explanation,
      source: dataSource,
    };
  }

  const valFloat = Number(observedValue);
  if (isNaN(valFloat)) {
    return {
      parameter_key: paramKey,
      parameter_name: paramName,
      unit,
      weight,
      value: observedValue,
      suitability_class: "UNCERTAIN",
      score: null,
      is_limiting: false,
      status: "INVALID_VALUE",
      explanation: `Invalid numerical value: ${observedValue}`,
      source: dataSource,
    };
  }

  let assignedClass = "N";
  if (evaluateNumericRange(valFloat, paramDef.s1)) assignedClass = "S1";
  else if (evaluateNumericRange(valFloat, paramDef.s2)) assignedClass = "S2";
  else if (evaluateNumericRange(valFloat, paramDef.s3)) assignedClass = "S3";
  else if (paramDef.n && evaluateNumericRange(valFloat, paramDef.n)) assignedClass = "N";
  else if (paramDef.n_ranges && paramDef.n_ranges.some((r: any) => evaluateNumericRange(valFloat, r))) assignedClass = "N";
  else assignedClass = "N";

  const score = CLASS_SCORES[assignedClass] ?? 20.0;
  const isLimiting = ["S2", "S3", "N"].includes(assignedClass);
  let explanation = `${paramName}: ${valFloat.toFixed(1)} ${unit} is ${assignedClass}.`;
  if (isLimiting) {
    explanation += ` (Optimum S1: ${formatRange(paramDef.s1)} ${unit}).`;
  }

  return {
    parameter_key: paramKey,
    parameter_name: paramName,
    unit,
    weight,
    value: Math.round(valFloat * 100) / 100,
    suitability_class: assignedClass,
    score,
    is_limiting: isLimiting,
    status: "EVALUATED",
    explanation,
    source: dataSource,
  };
}

export function evaluateCropSuitability(
  cropCode: string,
  soilIndicators: SoilIndicators,
  weatherIndicators = WEATHER_NORMALS,
  gatNo = ""
): any {
  const rulesData = loadRules();
  const cleanCode = cropCode.toLowerCase().trim();
  const cropDef = rulesData.crops[cleanCode];
  if (!cropDef) throw new Error(`Unknown crop code: '${cropCode}'`);

  const paramDefs = cropDef.parameters || {};
  const evaluatedCriteria: any[] = [];
  const missingInputs: string[] = [];
  const limitingFactors: any[] = [];

  const activeRanks: number[] = [];
  let weightedScoreSum = 0.0;
  let totalActiveWeights = 0.0;

  for (const [pKey, pDef] of Object.entries(paramDefs)) {
    let obsVal: any = null;
    let srcLabel = "DSM_RASTER";

    if (pKey === "nitrogen") {
      const rawN = soilIndicators.nitrogen;
      obsVal = rawN !== null && rawN !== undefined ? Math.round(rawN * 20.0 * 10) / 10 : null;
      srcLabel = "DSM_RASTER (mg/kg x20 = kg/ha)";
    } else if (pKey === "oc") {
      obsVal = soilIndicators.soc;
      srcLabel = "DSM_RASTER (SOC %)";
    } else if (pKey === "slope") {
      obsVal = soilIndicators.slope;
      srcLabel = "SRTM_SLOPE_RASTER (%)";
    } else if (pKey === "texture") {
      obsVal = soilIndicators.texture;
      srcLabel = "SOIL_TEXTURE_RASTER (USDA Class)";
    } else if (pKey in soilIndicators) {
      obsVal = (soilIndicators as any)[pKey];
      srcLabel = "DSM_RASTER";
    } else if (pKey === "rainfall") {
      const rType = pDef.rainfall_type || "annual";
      if (rType === "kharif") obsVal = weatherIndicators.kharif_rainfall_mm;
      else if (rType === "rabi") obsVal = weatherIndicators.rabi_rainfall_mm;
      else obsVal = weatherIndicators.annual_rainfall_mm;
      srcLabel = `OPEN_METEO_NORMAL_30YR (${rType})`;

      if (pDef.notes && pDef.notes.toLowerCase().includes("irrigation")) {
        if (soilIndicators.irrigation_available !== false) {
          const baseVal = obsVal || 654.0;
          obsVal = Math.max(baseVal, 1550.0);
          srcLabel = `OPEN_METEO_NORMAL (${baseVal.toFixed(0)}mm) + ASSURED CANAL IRRIGATION`;
        }
      }
    } else if (pKey === "temperature") {
      obsVal = weatherIndicators.mean_temperature_c;
      srcLabel = "OPEN_METEO_NORMAL_30YR";
    } else if (pKey === "humidity") {
      obsVal = weatherIndicators.relative_humidity_pct;
      srcLabel = "OPEN_METEO_NORMAL_30YR";
    } else if (["phosphorus", "potassium", "ec"].includes(pKey)) {
      if ((soilIndicators as any)[pKey] !== undefined && (soilIndicators as any)[pKey] !== null) {
        obsVal = (soilIndicators as any)[pKey];
        srcLabel = "LAB_OBSERVATION";
      } else {
        const defaultLabValues: Record<string, number> = {
          ec: 0.85,
          phosphorus: 22.5,
          potassium: 320.0,
        };
        obsVal = defaultLabValues[pKey];
        srcLabel = "LAB_REPORT_BASELINE (Regional Estimate)";
      }
    }

    const critRes = evaluateCriterion(pKey, pDef, obsVal, srcLabel);
    evaluatedCriteria.push(critRes);

    if (critRes.status === "MISSING_DATA") {
      missingInputs.push(critRes.parameter_name);
    } else {
      const sClass = critRes.suitability_class;
      activeRanks.push(CLASS_RANKS[sClass] || 4);
      const w = critRes.weight;
      const s = critRes.score;
      weightedScoreSum += s * w;
      totalActiveWeights += w;

      if (critRes.is_limiting) {
        limitingFactors.push({
          parameter: critRes.parameter_name,
          class: sClass,
          value: critRes.value,
          unit: critRes.unit,
          explanation: critRes.explanation,
        });
      }
    }
  }

  let finalClass = "UNCERTAIN";
  let scoreFinal = 0.0;

  if (activeRanks.length > 0 && totalActiveWeights > 0) {
    scoreFinal = Math.round((weightedScoreSum / totalActiveWeights) * 10) / 10;
    if (scoreFinal >= 80.0) finalClass = "S1";
    else if (scoreFinal >= 60.0) finalClass = "S2";
    else if (scoreFinal >= 40.0) finalClass = "S3";
    else finalClass = "N";
  }

  const titles: Record<string, { en: string; mr: string }> = {
    S1: { en: "Highly Suitable", mr: "उच्च अनुकूल" },
    S2: { en: "Moderately Suitable", mr: "मध्यम अनुकूल" },
    S3: { en: "Marginally Suitable", mr: "किमान अनुकूल" },
    N: { en: "Not Suitable", mr: "अनुकूल नाही" },
    UNCERTAIN: { en: "Uncertain / Insufficient Data", mr: "अपूर्ण माहिती" },
  };

  const tObj = titles[finalClass] || titles.UNCERTAIN;

  return {
    gat_no: gatNo,
    crop_code: cleanCode,
    crop_name: cropDef.crop_name,
    crop_name_mr: cropDef.crop_name_mr,
    tolerance: cropDef.tolerance,
    category: cropDef.category,
    final_suitability_class: finalClass,
    class_title: tObj.en,
    class_title_mr: tObj.mr,
    suitability_score: scoreFinal,
    limiting_factors: limitingFactors,
    missing_inputs: missingInputs,
    data_quality: {
      total_criteria: Object.keys(paramDefs).length,
      evaluated_criteria_count: evaluatedCriteria.filter((c) => c.status !== "MISSING_DATA").length,
      missing_criteria_count: missingInputs.length,
      completeness_pct: Math.round(
        (evaluatedCriteria.filter((c) => c.status !== "MISSING_DATA").length / Object.keys(paramDefs).length) * 100
      ),
    },
    evaluated_criteria: evaluatedCriteria,
    rule_version: rulesData.version || "1.0",
  };
}

export function getSupportedCrops(): any[] {
  const rules = loadRules();
  return Object.values(rules.crops).map((c) => ({
    crop_code: c.crop_code,
    crop_name: c.crop_name,
    crop_name_mr: c.crop_name_mr,
    tolerance: c.tolerance,
    category: c.category,
    parameters_count: Object.keys(c.parameters || {}).length,
  }));
}

export function getCropDefinition(cropCode: string): any {
  const rules = loadRules();
  return rules.crops[cropCode.toLowerCase().trim()] || null;
}

export function getGatCropSuitability(gatNo: string, irrigationAvailable = true): any {
  const soils = loadSoils();
  const cleanGat = gatNo.replace(/[^0-9]/g, "") || gatNo.trim();
  const soilData = soils[cleanGat] || soils[gatNo];
  if (!soilData) return null;

  const soilWithOptions = { ...soilData, irrigation_available: irrigationAvailable };
  const crops = getSupportedCrops();
  const evaluations = crops.map((c) =>
    evaluateCropSuitability(c.crop_code, soilWithOptions, WEATHER_NORMALS, cleanGat)
  );

  return {
    gat_no: cleanGat,
    village: soilData.village || "Malegaon Kh.",
    area_ha: soilData.area_ha,
    area_acres: soilData.area_acres,
    centroid: soilData.centroid,
    bounds: soilData.bounds,
    soil_indicators: soilData,
    weather_indicators: WEATHER_NORMALS,
    evaluations,
    timestamp: new Date().toISOString(),
  };
}

export function getCropSuitabilityAllGats(cropCode: string, irrigationAvailable = true): any {
  const cropDef = getCropDefinition(cropCode);
  if (!cropDef) return null;

  const soils = loadSoils();
  const classCounts: Record<string, number> = { S1: 0, S2: 0, S3: 0, N: 0, UNCERTAIN: 0 };
  const classAreaHa: Record<string, number> = { S1: 0, S2: 0, S3: 0, N: 0, UNCERTAIN: 0 };
  const classAreaAcres: Record<string, number> = { S1: 0, S2: 0, S3: 0, N: 0, UNCERTAIN: 0 };

  const gatResults: any[] = [];
  for (const [gatNo, sData] of Object.entries(soils)) {
    const soilWithOptions = { ...sData, irrigation_available: irrigationAvailable };
    const res = evaluateCropSuitability(cropCode, soilWithOptions, WEATHER_NORMALS, gatNo);
    const sClass = res.final_suitability_class;
    const ha = Number(sData.area_ha) || 0;
    const acres = Number(sData.area_acres) || 0;

    classCounts[sClass] = (classCounts[sClass] || 0) + 1;
    classAreaHa[sClass] = Math.round(((classAreaHa[sClass] || 0) + ha) * 100) / 100;
    classAreaAcres[sClass] = Math.round(((classAreaAcres[sClass] || 0) + acres) * 100) / 100;

    gatResults.push({
      gat_no: gatNo,
      area_ha: ha,
      area_acres: acres,
      centroid: sData.centroid,
      bounds: sData.bounds,
      final_suitability_class: sClass,
      suitability_score: res.suitability_score,
      limiting_factors: res.limiting_factors,
      missing_inputs: res.missing_inputs,
    });
  }

  const totalGats = gatResults.length;
  const totalHa = Math.round(Object.values(classAreaHa).reduce((a, b) => a + b, 0) * 100) / 100;
  const totalAcres = Math.round(Object.values(classAreaAcres).reduce((a, b) => a + b, 0) * 100) / 100;

  return {
    crop_code: cropCode,
    crop_name: cropDef.crop_name,
    crop_name_mr: cropDef.crop_name_mr,
    tolerance: cropDef.tolerance,
    category: cropDef.category,
    total_gats: totalGats,
    total_area_ha: totalHa,
    total_area_acres: totalAcres,
    class_summary: {
      S1: {
        count: classCounts.S1,
        percentage_gats: totalGats ? Math.round((classCounts.S1 / totalGats) * 1000) / 10 : 0,
        area_ha: classAreaHa.S1,
        area_acres: classAreaAcres.S1,
      },
      S2: {
        count: classCounts.S2,
        percentage_gats: totalGats ? Math.round((classCounts.S2 / totalGats) * 1000) / 10 : 0,
        area_ha: classAreaHa.S2,
        area_acres: classAreaAcres.S2,
      },
      S3: {
        count: classCounts.S3,
        percentage_gats: totalGats ? Math.round((classCounts.S3 / totalGats) * 1000) / 10 : 0,
        area_ha: classAreaHa.S3,
        area_acres: classAreaAcres.S3,
      },
      N: {
        count: classCounts.N,
        percentage_gats: totalGats ? Math.round((classCounts.N / totalGats) * 1000) / 10 : 0,
        area_ha: classAreaHa.N,
        area_acres: classAreaAcres.N,
      },
      UNCERTAIN: {
        count: classCounts.UNCERTAIN,
        percentage_gats: totalGats ? Math.round((classCounts.UNCERTAIN / totalGats) * 1000) / 10 : 0,
        area_ha: classAreaHa.UNCERTAIN,
        area_acres: classAreaAcres.UNCERTAIN,
      },
    },
    gats: gatResults,
  };
}

export function getCropSuitabilityGeoJSON(cropCode: string, irrigationAvailable = true): any {
  const geojson = loadGeoJson();
  const soils = loadSoils();

  const outFeatures = (geojson.features || []).map((feat: any) => {
    const props = { ...(feat.properties || {}) };
    const gatNo = String(props.gat_no || "").trim();
    const soilData = soils[gatNo] || {};
    const soilWithOptions = { ...soilData, irrigation_available: irrigationAvailable };

    const res = evaluateCropSuitability(cropCode, soilWithOptions, WEATHER_NORMALS, gatNo);
    const sClass = res.final_suitability_class;

    props.crop_code = cropCode;
    props.crop_name = res.crop_name;
    props.suitability_class = sClass;
    props.suitability_score = res.suitability_score;
    props.fill_color = CLASS_COLORS[sClass] || "#9ca3af";
    props.limiting_factors_count = res.limiting_factors.length;
    props.limiting_factors = res.limiting_factors;
    props.soil_indicators = soilData;

    return {
      type: "Feature",
      properties: props,
      geometry: feat.geometry,
    };
  });

  return {
    type: "FeatureCollection",
    name: `crop_suitability_${cropCode}`,
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features: outFeatures,
  };
}

export function generateCsvReport(cropCode?: string, gatNo?: string): string {
  const soils = loadSoils();
  const crops = cropCode ? [getCropDefinition(cropCode)].filter(Boolean) : getSupportedCrops();

  const headers = [
    "Gat Number",
    "Village",
    "Area (ha)",
    "Area (acres)",
    "Crop Code",
    "Crop Name",
    "Suitability Class",
    "Suitability Score",
    "Soil pH",
    "SOC (%)",
    "Available N (kg/ha)",
    "EC (dS/m)",
    "Available P (kg/ha)",
    "Available K (kg/ha)",
    "Slope (%)",
    "Soil Texture",
    "Annual Rainfall (mm)",
    "Mean Temp (°C)",
    "Relative Humidity (%)",
    "Limiting Factors",
    "Calculated At",
  ];

  const rows: string[] = [headers.join(",")];
  const now = new Date().toISOString();

  const targetGats = gatNo ? { [gatNo]: soils[gatNo] } : soils;

  for (const [gId, sData] of Object.entries(targetGats)) {
    if (!sData) continue;
    for (const c of crops) {
      const res = evaluateCropSuitability(c.crop_code, sData, WEATHER_NORMALS, gId);
      const limStr = res.limiting_factors.map((f: any) => `${f.parameter} (${f.class})`).join("; ");
      const nKgHa = sData.nitrogen ? (sData.nitrogen * 20).toFixed(1) : "";

      const row = [
        `"${gId}"`,
        `"${sData.village || "Malegaon Kh."}"`,
        `"${sData.area_ha || ""}"`,
        `"${sData.area_acres || ""}"`,
        `"${res.crop_code}"`,
        `"${res.crop_name}"`,
        `"${res.final_suitability_class}"`,
        `"${res.suitability_score}"`,
        `"${sData.ph || ""}"`,
        `"${sData.soc || ""}"`,
        `"${nKgHa}"`,
        `"0.85"`,
        `"22.5"`,
        `"320.0"`,
        `"${sData.slope || ""}"`,
        `"${sData.texture || ""}"`,
        `"${WEATHER_NORMALS.annual_rainfall_mm}"`,
        `"${WEATHER_NORMALS.mean_temperature_c}"`,
        `"${WEATHER_NORMALS.relative_humidity_pct}"`,
        `"${limStr}"`,
        `"${now}"`,
      ];
      rows.push(row.join(","));
    }
  }

  return rows.join("\n");
}
