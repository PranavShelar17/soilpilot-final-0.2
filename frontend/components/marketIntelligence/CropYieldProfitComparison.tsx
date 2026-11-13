"use client";

import React, { useState, useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  BarChart3,
  TrendingUp,
  Coins,
  Scale,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Droplets,
  Layers,
} from "lucide-react";

interface CropBenchmarkData {
  crop_code: string;
  name_en: string;
  name_mr: string;
  category: "cash_crops" | "vegetables" | "cereals" | "oilseeds";
  category_label_en: string;
  category_label_mr: string;
  season_en: string;
  season_mr: string;
  duration_days: string;
  water_req_en: string;
  water_req_mr: string;
  yield_min_ha: number;
  yield_exp_ha: number;
  yield_max_ha: number;
  price_per_ton: number;
  op_cost_ha: number;
  tot_cost_ha: number;
  source: string;
}

// Clean crop names without variety adjectives
const CROP_BENCHMARKS: CropBenchmarkData[] = [
  {
    crop_code: "POMEGRANATE",
    name_en: "Pomegranate",
    name_mr: "डाळिंब",
    category: "cash_crops",
    category_label_en: "Cash Crop",
    category_label_mr: "नगदी पीक",
    season_en: "Annual / Hasta Bahar",
    season_mr: "वार्षिक / हस्त बहार",
    duration_days: "180–210",
    water_req_en: "Medium (Drip)",
    water_req_mr: "मध्यम (ठिबक)",
    yield_min_ha: 9.0,
    yield_exp_ha: 12.0,
    yield_max_ha: 15.0,
    price_per_ton: 85000.0,
    op_cost_ha: 145000.0,
    tot_cost_ha: 220000.0,
    source: "ICAR-NRCP Solapur & MPKV Rahuri",
  },
  {
    crop_code: "BANANA",
    name_en: "Banana",
    name_mr: "केळी",
    category: "cash_crops",
    category_label_en: "Cash Crop",
    category_label_mr: "नगदी पीक",
    season_en: "Annual",
    season_mr: "वार्षिक",
    duration_days: "330–390",
    water_req_en: "Very High",
    water_req_mr: "अतिउच्च",
    yield_min_ha: 55.0,
    yield_exp_ha: 65.0,
    yield_max_ha: 75.0,
    price_per_ton: 14000.0,
    op_cost_ha: 135000.0,
    tot_cost_ha: 195000.0,
    source: "NRCB & Jain Irrigation R&D Jalgaon",
  },
  {
    crop_code: "TOMATO",
    name_en: "Tomato",
    name_mr: "टोमॅटो",
    category: "vegetables",
    category_label_en: "Vegetables",
    category_label_mr: "भाजीपाला",
    season_en: "Rabi / Early Winter",
    season_mr: "रब्बी / हिवाळी",
    duration_days: "100–130",
    water_req_en: "Medium (Staking)",
    water_req_mr: "मध्यम (स्टेकिंग)",
    yield_min_ha: 28.0,
    yield_exp_ha: 34.0,
    yield_max_ha: 40.0,
    price_per_ton: 14500.0,
    op_cost_ha: 95000.0,
    tot_cost_ha: 142000.0,
    source: "MPKV Rahuri & CACP",
  },
  {
    crop_code: "ONION",
    name_en: "Onion",
    name_mr: "कांदा",
    category: "vegetables",
    category_label_en: "Vegetables",
    category_label_mr: "भाजीपाला",
    season_en: "Rabi",
    season_mr: "रब्बी",
    duration_days: "120–140",
    water_req_en: "Medium",
    water_req_mr: "मध्यम",
    yield_min_ha: 18.0,
    yield_exp_ha: 21.0,
    yield_max_ha: 24.0,
    price_per_ton: 16500.0,
    op_cost_ha: 88000.0,
    tot_cost_ha: 132000.0,
    source: "ICAR-DOGR Pune & MPKV Rahuri",
  },
  {
    crop_code: "SUGARCANE",
    name_en: "Sugarcane",
    name_mr: "ऊस",
    category: "cash_crops",
    category_label_en: "Cash Crop",
    category_label_mr: "नगदी बागायत",
    season_en: "Annual / Suru",
    season_mr: "वार्षिक / सुरू",
    duration_days: "360–420",
    water_req_en: "Very High",
    water_req_mr: "अतिउच्च",
    yield_min_ha: 85.0,
    yield_exp_ha: 100.0,
    yield_max_ha: 115.0,
    price_per_ton: 3150.0,
    op_cost_ha: 118000.0,
    tot_cost_ha: 175000.0,
    source: "Vasantdada Sugar Institute (VSI) Pune",
  },
  {
    crop_code: "MAIZE",
    name_en: "Maize",
    name_mr: "मका",
    category: "cereals",
    category_label_en: "Cereals & Millets",
    category_label_mr: "धान्य पीक",
    season_en: "Rabi",
    season_mr: "रब्बी",
    duration_days: "100–115",
    water_req_en: "Medium",
    water_req_mr: "मध्यम",
    yield_min_ha: 4.5,
    yield_exp_ha: 5.2,
    yield_max_ha: 6.0,
    price_per_ton: 21500.0,
    op_cost_ha: 32000.0,
    tot_cost_ha: 49000.0,
    source: "ICAR-IIMR & MPKV Rahuri",
  },
  {
    crop_code: "SOYBEAN",
    name_en: "Soybean",
    name_mr: "सोयाबीन",
    category: "oilseeds",
    category_label_en: "Oilseeds",
    category_label_mr: "गळीत धान्य",
    season_en: "Kharif",
    season_mr: "खरीप",
    duration_days: "90–105",
    water_req_en: "Low–Medium",
    water_req_mr: "कमी-मध्यम",
    yield_min_ha: 1.5,
    yield_exp_ha: 1.75,
    yield_max_ha: 2.0,
    price_per_ton: 46500.0,
    op_cost_ha: 27500.0,
    tot_cost_ha: 41000.0,
    source: "ICAR-IISR Indore & CACP",
  },
];

const ACRE_RATIO = 0.404685642;

interface CropYieldProfitComparisonProps {
  selectedMarket?: string;
  activeDistrict?: string;
}

export const CropYieldProfitComparison: React.FC<CropYieldProfitComparisonProps> = ({
  selectedMarket = "Baramati APMC",
  activeDistrict = "Pune",
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  const [activeTab, setActiveTab] = useState<"both" | "profit" | "yield">("both");
  const [areaUnit, setAreaUnit] = useState<"acre" | "ha">("acre");
  const [selectedCropCode, setSelectedCropCode] = useState<string>("POMEGRANATE");

  // Calculated metrics for each crop
  const crops = useMemo(() => {
    return CROP_BENCHMARKS.map((c) => {
      const yieldMin = areaUnit === "acre" ? Math.round(c.yield_min_ha * ACRE_RATIO * 100) / 100 : c.yield_min_ha;
      const yieldExp = areaUnit === "acre" ? Math.round(c.yield_exp_ha * ACRE_RATIO * 100) / 100 : c.yield_exp_ha;
      const yieldMax = areaUnit === "acre" ? Math.round(c.yield_max_ha * ACRE_RATIO * 100) / 100 : c.yield_max_ha;

      const cost = areaUnit === "acre" ? Math.round(c.op_cost_ha * ACRE_RATIO) : c.op_cost_ha;
      const totalCost = areaUnit === "acre" ? Math.round(c.tot_cost_ha * ACRE_RATIO) : c.tot_cost_ha;
      const grossRevenue = Math.round(yieldExp * c.price_per_ton);
      const netProfit = Math.round(grossRevenue - cost);
      const profitMarginPct = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;
      const returnOnCost = cost > 0 ? Math.round((grossRevenue / cost) * 10) / 10 : 0;

      return {
        ...c,
        yieldMin,
        yieldExp,
        yieldMax,
        cost,
        totalCost,
        grossRevenue,
        netProfit,
        profitMarginPct,
        returnOnCost,
      };
    });
  }, [areaUnit]);

  // Crops sorted for profit graph
  const cropsSortedByProfit = useMemo(() => {
    return [...crops].sort((a, b) => b.netProfit - a.netProfit);
  }, [crops]);

  // Crops sorted for yield graph
  const cropsSortedByYield = useMemo(() => {
    return [...crops].sort((a, b) => b.yieldExp - a.yieldExp);
  }, [crops]);

  // Max values for bar scaling
  const maxProfit = useMemo(() => {
    return Math.max(...crops.map((c) => c.netProfit), 1);
  }, [crops]);

  const maxYield = useMemo(() => {
    return Math.max(...crops.map((c) => c.yieldExp), 1);
  }, [crops]);

  // Active selected crop for the detail inspector
  const activeCrop = useMemo(() => {
    return crops.find((c) => c.crop_code === selectedCropCode) || crops[0];
  }, [crops, selectedCropCode]);

  const unitLabel = areaUnit === "acre" ? (isMr ? "एकर" : "ac") : (isMr ? "हे" : "ha");
  const yieldUnitLabel = areaUnit === "acre" ? (isMr ? "टन/एकर" : "Ton/ac") : (isMr ? "टन/हे" : "Ton/ha");

  return (
    <div className="bg-white rounded-2xl border border-[#E6E9E5] p-5 sm:p-6 shadow-2xs space-y-6">
      {/* 1. SECTION HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E6E9E5]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2A7C13]/10 text-[#2A7C13]">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-black text-[#0B4D2B] tracking-tight">
              {isMr ? "सर्व पिकांचे उत्पादन व संभाव्य नफा बार आलेख" : "All Crops: Yield & Net Profit Bar Graphs"}
            </h3>
          </div>
          <p className="text-xs text-text-muted">
            {isMr
              ? "सीएसीपी व एमपीकेव्ही राहुरी अधिकृत मानके: कोणत्या पिकातून किती उत्पादन (टन) मिळेल आणि किती संभाव्य नफा होईल याचे स्वतंत्र तुलनात्मक बार आलेख."
              : "Authoritative CACP & MPKV verified benchmarks showing yield output (Ton) and net profit return for each crop."}
          </p>
        </div>

        {/* Action Controls: Area Unit and Graph Display Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Unit Toggle */}
          <div className="inline-flex items-center p-1 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] text-xs font-bold">
            <button
              type="button"
              onClick={() => setAreaUnit("acre")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                areaUnit === "acre"
                  ? "bg-white text-[#2A7C13] shadow-2xs font-black"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {isMr ? "प्रति एकर (/ac)" : "Per Acre (/ac)"}
            </button>
            <button
              type="button"
              onClick={() => setAreaUnit("ha")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                areaUnit === "ha"
                  ? "bg-white text-[#2A7C13] shadow-2xs font-black"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {isMr ? "प्रति हेक्टर (/ha)" : "Per Hectare (/ha)"}
            </button>
          </div>

          {/* Graph View Toggle */}
          <div className="inline-flex items-center p-1 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("both")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "both"
                  ? "bg-[#2A7C13] text-white shadow-2xs font-black"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isMr ? "दोन्ही आलेख" : "Both Graphs"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("profit")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "profit"
                  ? "bg-[#2A7C13] text-white shadow-2xs font-black"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{isMr ? "नफा आलेख" : "Profit Graph"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("yield")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "yield"
                  ? "bg-[#2A7C13] text-white shadow-2xs font-black"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{isMr ? "उत्पादन आलेख" : "Yield Graph"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-800 block">
              {isMr ? "सर्वाधिक निव्वळ नफा देणारे पीक" : "Highest Profit Crop"}
            </span>
            <span className="text-sm font-black text-emerald-950">
              {isMr ? cropsSortedByProfit[0].name_mr : cropsSortedByProfit[0].name_en}
            </span>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-[#2A7C13] block">
              ₹{cropsSortedByProfit[0].netProfit.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] font-medium text-text-muted">/{unitLabel}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-800 block">
              {isMr ? "सर्वाधिक उत्पादन देणारे पीक" : "Highest Yield Crop"}
            </span>
            <span className="text-sm font-black text-amber-950">
              {isMr ? cropsSortedByYield[0].name_mr : cropsSortedByYield[0].name_en}
            </span>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-amber-900 block">
              {cropsSortedByYield[0].yieldExp} {isMr ? "टन" : "Ton"}
            </span>
            <span className="text-[10px] font-medium text-text-muted">/{unitLabel}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-border/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-text-muted block">
              {isMr ? "अधिकृत बाजार व मानके" : "Benchmark Market"}
            </span>
            <span className="text-xs font-extrabold text-text-primary block">
              {selectedMarket} ({activeDistrict})
            </span>
            <span className="text-[10px] text-text-muted">CACP A2+FL & MPKV Rahuri</span>
          </div>
          <Sparkles className="w-5 h-5 text-soil-primary shrink-0 opacity-70" />
        </div>
      </div>

      {/* 3. DEDICATED SEPARATE BAR GRAPHS CONTAINER */}
      <div className={`grid gap-6 ${activeTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* ======================================================== */}
        {/* BAR GRAPH 1: EXPECTED NET PROFIT PER CROP */}
        {/* ======================================================== */}
        {(activeTab === "both" || activeTab === "profit") && (
          <div className="p-5 rounded-2xl border border-border/80 bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#2A7C13]" />
                  <h4 className="font-extrabold text-sm text-[#0B4D2B]">
                    {isMr ? "पिकांचा अपेक्षित निव्वळ नफा (₹ / " + unitLabel + ")" : "Expected Net Profit (₹ / " + unitLabel + ")"}
                  </h4>
                </div>
                <span className="text-[11px] text-text-muted block mt-0.5">
                  {isMr ? "उत्पन्न वजा सीएसीपी लागवड खर्च" : "Gross Revenue minus CACP A2+FL Cultivation Cost"}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {isMr ? "नफ्यानुसार क्रमवारी" : "Ranked by Profit"}
              </span>
            </div>

            {/* Vertical Bar Chart Canvas */}
            <div className="relative pt-6 pb-2">
              {/* Y-Axis Guidelines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>₹{Math.round(maxProfit / 1000)}k</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>₹{Math.round((maxProfit * 0.75) / 1000)}k</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>₹{Math.round((maxProfit * 0.5) / 1000)}k</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>₹{Math.round((maxProfit * 0.25) / 1000)}k</span>
                </div>
                <div className="border-b border-slate-300" />
              </div>

              {/* Vertical Bars Container */}
              <div className="relative z-10 flex items-end justify-between gap-2 sm:gap-3 h-56 pt-6 px-1">
                {cropsSortedByProfit.map((c) => {
                  const heightPct = Math.max(8, Math.round((c.netProfit / maxProfit) * 100));
                  const isSelected = selectedCropCode === c.crop_code;

                  return (
                    <div
                      key={c.crop_code}
                      onClick={() => setSelectedCropCode(c.crop_code)}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    >
                      {/* Top Value Label */}
                      <span className={`text-[10px] font-extrabold mb-1 whitespace-nowrap transition-transform duration-200 ${
                        isSelected ? "text-[#2A7C13] scale-110 font-black" : "text-slate-600 group-hover:text-[#2A7C13]"
                      }`}>
                        ₹{Math.round(c.netProfit / 1000)}k
                      </span>

                      {/* Bar Column */}
                      <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg h-full flex items-end overflow-hidden p-0.5">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isSelected
                              ? "bg-gradient-to-t from-[#0B4D2B] via-[#2A7C13] to-emerald-400 ring-2 ring-[#2A7C13]/40"
                              : "bg-gradient-to-t from-[#2A7C13] to-emerald-500 group-hover:from-[#1b530c] group-hover:to-emerald-400"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>

                      {/* X-Axis Crop Name */}
                      <span className={`text-[11px] font-bold mt-2 text-center truncate max-w-[54px] block transition-colors ${
                        isSelected ? "text-[#2A7C13] font-black" : "text-text-main group-hover:text-[#2A7C13]"
                      }`}>
                        {isMr ? c.name_mr : c.name_en}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-text-muted text-center pt-1 border-t border-slate-100">
              {isMr ? "* पिकावर क्लिक करा आणि खाली सविस्तर हिशोब पहा" : "* Click any crop bar to view detailed economics below"}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BAR GRAPH 2: EXPECTED YIELD PER CROP (TONNES) */}
        {/* ======================================================== */}
        {(activeTab === "both" || activeTab === "yield") && (
          <div className="p-5 rounded-2xl border border-border/80 bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-amber-700" />
                  <h4 className="font-extrabold text-sm text-amber-950">
                    {isMr ? "पिकांचे अपेक्षित उत्पादन (" + yieldUnitLabel + ")" : "Expected Yield Output (" + yieldUnitLabel + ")"}
                  </h4>
                </div>
                <span className="text-[11px] text-text-muted block mt-0.5">
                  {isMr ? "टन मध्ये अपेक्षित कृषी उत्पादन क्षमता" : "Expected agricultural output volume in Metric Tonnes"}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                {isMr ? "उत्पादनानुसार क्रमवारी" : "Ranked by Yield"}
              </span>
            </div>

            {/* Vertical Bar Chart Canvas */}
            <div className="relative pt-6 pb-2">
              {/* Y-Axis Guidelines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>{maxYield} Ton</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>{Math.round(maxYield * 0.75 * 10) / 10} Ton</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>{Math.round(maxYield * 0.5 * 10) / 10} Ton</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                  <span>{Math.round(maxYield * 0.25 * 10) / 10} Ton</span>
                </div>
                <div className="border-b border-slate-300" />
              </div>

              {/* Vertical Bars Container */}
              <div className="relative z-10 flex items-end justify-between gap-2 sm:gap-3 h-56 pt-6 px-1">
                {cropsSortedByYield.map((c) => {
                  const heightPct = Math.max(8, Math.round((c.yieldExp / maxYield) * 100));
                  const isSelected = selectedCropCode === c.crop_code;

                  return (
                    <div
                      key={c.crop_code}
                      onClick={() => setSelectedCropCode(c.crop_code)}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    >
                      {/* Top Value Label */}
                      <span className={`text-[10px] font-extrabold mb-1 whitespace-nowrap transition-transform duration-200 ${
                        isSelected ? "text-amber-900 scale-110 font-black" : "text-slate-600 group-hover:text-amber-900"
                      }`}>
                        {c.yieldExp}T
                      </span>

                      {/* Bar Column */}
                      <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg h-full flex items-end overflow-hidden p-0.5">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isSelected
                              ? "bg-gradient-to-t from-amber-700 via-amber-500 to-amber-300 ring-2 ring-amber-500/40"
                              : "bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-700 group-hover:to-amber-300"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>

                      {/* X-Axis Crop Name */}
                      <span className={`text-[11px] font-bold mt-2 text-center truncate max-w-[54px] block transition-colors ${
                        isSelected ? "text-amber-950 font-black" : "text-text-main group-hover:text-amber-900"
                      }`}>
                        {isMr ? c.name_mr : c.name_en}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-text-muted text-center pt-1 border-t border-slate-100">
              {isMr ? "* पिकावर क्लिक करा आणि खाली उत्पादन व दर पहा" : "* Click any crop bar to view yield and rate details below"}
            </div>
          </div>
        )}
      </div>

      {/* 4. SELECTED CROP COMPREHENSIVE DETAIL CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-[#FFF8CF]/20 border border-[#2A7C13]/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-text-main">
                {isMr ? activeCrop.name_mr : activeCrop.name_en}
              </h4>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 text-text-muted">
                {isMr ? activeCrop.category_label_mr : activeCrop.category_label_en}
              </span>
            </div>
            <span className="text-xs text-text-muted mt-0.5 block">
              {isMr ? "हंगाम: " : "Season: "}<strong>{isMr ? activeCrop.season_mr : activeCrop.season_en}</strong> | {isMr ? "कालावधी: " : "Duration: "}<strong>{activeCrop.duration_days} {isMr ? "दिवस" : "Days"}</strong> | {isMr ? "पाणी: " : "Water: "}<strong>{isMr ? activeCrop.water_req_mr : activeCrop.water_req_en}</strong>
            </span>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "संभाव्य निव्वळ नफा" : "Possible Net Profit"}
            </span>
            <span className="text-xl font-black text-[#2A7C13]">
              ₹{activeCrop.netProfit.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-text-muted ml-1">/{unitLabel}</span>
          </div>
        </div>

        {/* 4 Key Stat Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
          {/* 1. Yield */}
          <div className="p-3 bg-white rounded-xl border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">
              {isMr ? "अपेक्षित उत्पादन" : "Expected Yield"}
            </span>
            <span className="text-base font-black text-amber-950 block">
              {activeCrop.yieldExp} {isMr ? "टन" : "Ton"}
            </span>
            <span className="text-[10px] text-text-muted block">
              ({activeCrop.yieldMin} – {activeCrop.yieldMax} {isMr ? "टन" : "Ton"})
            </span>
          </div>

          {/* 2. Selling Price */}
          <div className="p-3 bg-white rounded-xl border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "विक्री बाजारभाव" : "Selling Price"}
            </span>
            <span className="text-base font-black text-[#2A7C13] block">
              ₹{activeCrop.price_per_ton.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-text-muted block">
              /{isMr ? "टन" : "Ton"} ({selectedMarket})
            </span>
          </div>

          {/* 3. Gross Revenue */}
          <div className="p-3 bg-white rounded-xl border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "एकूण उत्पन्न (Gross)" : "Gross Revenue"}
            </span>
            <span className="text-base font-extrabold text-text-primary block">
              ₹{activeCrop.grossRevenue.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-text-muted block">/{unitLabel}</span>
          </div>

          {/* 4. Cultivation Cost */}
          <div className="p-3 bg-white rounded-xl border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase block">
              {isMr ? "लागवड खर्च (A2+FL)" : "CACP Cost (A2+FL)"}
            </span>
            <span className="text-base font-extrabold text-rose-700 block">
              ₹{activeCrop.cost.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-text-muted block">/{unitLabel}</span>
          </div>
        </div>

        {/* Calculation Formula Callout */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-text-muted pt-1">
          <code className="text-text-primary bg-white/80 px-2.5 py-1 rounded-md border border-slate-200">
            {isMr
              ? `संभाव्य निव्वळ नफा = (${activeCrop.yieldExp} टन × ₹${activeCrop.price_per_ton.toLocaleString("en-IN")}) − ₹${activeCrop.cost.toLocaleString("en-IN")} = ₹${activeCrop.netProfit.toLocaleString("en-IN")}`
              : `Net Profit = (${activeCrop.yieldExp} Ton × ₹${activeCrop.price_per_ton.toLocaleString("en-IN")}) − ₹${activeCrop.cost.toLocaleString("en-IN")} = ₹${activeCrop.netProfit.toLocaleString("en-IN")}`}
          </code>
          <span className="text-[10px] text-text-muted mt-1 sm:mt-0">{activeCrop.source}</span>
        </div>
      </div>

      {/* 5. ALL CROPS TABULAR OVERVIEW */}
      <div className="space-y-2">
        <h4 className="font-extrabold text-xs text-text-primary uppercase tracking-wider">
          {isMr ? "सर्व पिकांचा एकत्रित तुलनात्मक तक्ता" : "All Crops Comparative Matrix"}
        </h4>

        <div className="overflow-x-auto border border-border/80 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-border/80 font-bold text-[11px] text-text-muted uppercase">
                <th className="p-3">{isMr ? "पीक" : "Crop"}</th>
                <th className="p-3">{isMr ? "वर्ग" : "Category"}</th>
                <th className="p-3">{isMr ? `अपेक्षित उत्पादन (${yieldUnitLabel})` : `Expected Yield (${yieldUnitLabel})`}</th>
                <th className="p-3">{isMr ? "बाजारभाव (₹/टन)" : "Selling Price (₹/Ton)"}</th>
                <th className="p-3">{isMr ? `लागवड खर्च (₹/${unitLabel})` : `Cost (₹/${unitLabel})`}</th>
                <th className="p-3">{isMr ? `संभाव्य नफा (₹/${unitLabel})` : `Possible Profit (₹/${unitLabel})`}</th>
                <th className="p-3">{isMr ? "परतावा (B:C)" : "B:C Ratio"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {cropsSortedByProfit.map((c) => {
                const isSelected = selectedCropCode === c.crop_code;

                return (
                  <tr
                    key={c.crop_code}
                    onClick={() => setSelectedCropCode(c.crop_code)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-[#2A7C13]/10 font-semibold" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="p-3 font-bold text-text-primary">
                      {isMr ? c.name_mr : c.name_en}
                    </td>
                    <td className="p-3 text-text-muted">
                      {isMr ? c.category_label_mr : c.category_label_en}
                    </td>
                    <td className="p-3 font-extrabold text-amber-900">
                      {c.yieldExp} {isMr ? "टन" : "Ton"}
                    </td>
                    <td className="p-3 font-medium text-text-main">
                      ₹{c.price_per_ton.toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 text-text-secondary">
                      ₹{c.cost.toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 font-black text-[#2A7C13]">
                      ₹{c.netProfit.toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 font-bold text-emerald-800">
                      {c.returnOnCost}x
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
