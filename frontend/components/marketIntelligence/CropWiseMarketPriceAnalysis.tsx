"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  BarChart3,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Info,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  ShieldCheck,
  Layers,
  ArrowUpDown,
  Tag,
  Coins,
} from "lucide-react";
import {
  marketService,
  CommodityItem,
  MarketItem,
  HistoricalAnalysisResponse,
  HistoricalTrendPoint,
} from "@/services/marketService";
import { cleanCropName, isAllowedCrop, translateCropCategory } from "@/i18n/marathiHelper";

interface CropWiseMarketPriceAnalysisProps {
  selectedMarket?: string;
  selectedDistrict?: string;
}

interface CropCardData {
  commodity: CommodityItem;
  cleanNameEn: string;
  cleanNameMr: string;
  categoryEn: string;
  categoryMr: string;
  analysis: HistoricalAnalysisResponse | null;
  loading: boolean;
  error: string | null;
}

export const CropWiseMarketPriceAnalysis: React.FC<CropWiseMarketPriceAnalysisProps> = ({
  selectedMarket = "Baramati APMC",
  selectedDistrict = "Pune",
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  // Filter States
  const [timeWindow, setTimeWindow] = useState<string>("30d");
  const [activeMarketName, setActiveMarketName] = useState<string>(selectedMarket);
  const [compareMarketId, setCompareMarketId] = useState<number | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Metadata
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [activeMarketId, setActiveMarketId] = useState<number>(1);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [cropCards, setCropCards] = useState<CropCardData[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Active Tooltip State for hover interaction
  const [hoveredPoint, setHoveredPoint] = useState<{
    cropCode: string;
    point: HistoricalTrendPoint;
    comparisonPrice?: number;
  } | null>(null);

  // 1. Initial Load of Markets and Commodities
  useEffect(() => {
    let isMounted = true;
    setLoadingInitial(true);

    Promise.all([
      marketService.getMarkets({ districtName: selectedDistrict }),
      marketService.getCommodities(),
    ])
      .then(([mktList, commList]) => {
        if (!isMounted) return;
        setMarkets(mktList);

        // Find primary market
        const matchMkt = mktList.find(
          (m) =>
            m.name.toLowerCase().includes(selectedMarket.toLowerCase()) ||
            selectedMarket.toLowerCase().includes(m.name.toLowerCase())
        );
        const resolvedMarketId = matchMkt ? matchMkt.id : mktList[0]?.id || 1;
        setActiveMarketId(resolvedMarketId);
        setActiveMarketName(matchMkt ? matchMkt.name : selectedMarket);

        // Filter and deduplicate commodities by clean main crop name
        const allowedComms = commList.filter(isAllowedCrop);
        const seenCleanNames = new Set<string>();
        const uniqueComms: CommodityItem[] = [];

        for (const comm of allowedComms) {
          const clean = cleanCropName(comm.name).toLowerCase();
          if (!seenCleanNames.has(clean)) {
            seenCleanNames.add(clean);
            uniqueComms.push(comm);
          }
        }

        // Canonical display priority order (Banana, Tomato, Onion, Sugarcane, Maize, Soybean, Pomegranate)
        const priorityCodes = ["BANANA", "TOMATO", "ONION", "SUGARCANE", "MAIZE", "SOYBEAN", "POMEGRANATE", "WHEAT", "COTTON", "GRAM"];
        uniqueComms.sort((a, b) => {
          const idxA = priorityCodes.indexOf(a.code.toUpperCase());
          const idxB = priorityCodes.indexOf(b.code.toUpperCase());
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        setCommodities(uniqueComms);

        // Initialize cards skeleton
        setCropCards(
          uniqueComms.map((c) => ({
            commodity: c,
            cleanNameEn: cleanCropName(c.name),
            cleanNameMr: cleanCropName(c.name_mr || c.name),
            categoryEn: translateCropCategory(c.category, false),
            categoryMr: translateCropCategory(c.category, true),
            analysis: null,
            loading: true,
            error: null,
          }))
        );
      })
      .catch((err) => {
        console.warn("Failed to load initial metadata for crop-wise market analysis:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMarket, selectedDistrict]);

  // 2. Fetch crop-specific historical time-series for every crop card whenever filters change
  useEffect(() => {
    if (commodities.length === 0) return;

    let isCancelled = false;

    // Set loading state on cards
    setCropCards((prev) =>
      prev.map((card) => ({
        ...card,
        loading: true,
        error: null,
      }))
    );

    // Fetch in parallel for each unique crop
    const fetchPromises = commodities.map(async (comm) => {
      try {
        const analysis = await marketService.getHistoricalAnalysis({
          commodityId: comm.id,
          commodityCode: comm.code,
          marketId: activeMarketId,
          district: selectedDistrict,
          window: timeWindow,
          comparisonMarketId: compareMarketId,
        });
        return { commodityId: comm.id, analysis, error: null };
      } catch (err: any) {
        return {
          commodityId: comm.id,
          analysis: null,
          error: err?.message || "No market data available",
        };
      }
    });

    Promise.all(fetchPromises).then((results) => {
      if (isCancelled) return;

      setCropCards((prev) =>
        prev.map((card) => {
          const res = results.find((r) => r.commodityId === card.commodity.id);
          return {
            ...card,
            analysis: res?.analysis || null,
            loading: false,
            error: res?.error || null,
          };
        })
      );
    });

    return () => {
      isCancelled = true;
    };
  }, [commodities, activeMarketId, timeWindow, compareMarketId, selectedDistrict]);

  // 3. Filter crop cards by category & search query
  const filteredCropCards = useMemo(() => {
    return cropCards.filter((card) => {
      // Category filter
      if (categoryFilter !== "all") {
        const cat = (card.commodity.category || "").toLowerCase();
        if (categoryFilter === "cash_crops" && !cat.includes("cash")) return false;
        if (categoryFilter === "vegetables" && !cat.includes("veg")) return false;
        if (categoryFilter === "cereals" && !cat.includes("cereal") && !cat.includes("millet")) return false;
        if (categoryFilter === "oilseeds" && !cat.includes("oilseed")) return false;
        if (categoryFilter === "pulses" && !cat.includes("pulse")) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEn = card.cleanNameEn.toLowerCase().includes(q);
        const matchMr = card.cleanNameMr.toLowerCase().includes(q);
        return matchEn || matchMr;
      }

      return true;
    });
  }, [cropCards, categoryFilter, searchQuery]);

  // Format date helper for X-axis (e.g. "13 Nov" or "13/11")
  const formatDateLabel = (isoDate: string) => {
    try {
      const parts = isoDate.split("-");
      if (parts.length === 3) {
        const day = parts[2];
        const monthNum = parseInt(parts[1], 10);
        const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthsMr = ["जाने", "फेब्रु", "मार्च", "एप्रि", "मे", "जून", "जुलै", "ऑग", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें"];
        return `${day} ${isMr ? monthsMr[monthNum - 1] : monthsEn[monthNum - 1]}`;
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  const selectedMarketObj = markets.find((m) => m.id === activeMarketId);
  const compareMarketObj = markets.find((m) => m.id === compareMarketId);

  return (
    <div className="bg-[#FAFBF9] rounded-3xl border border-[#E6E9E5] p-5 sm:p-7 shadow-xs space-y-6">
      {/* ============================================================== */}
      {/* 1. SECTION TITLE & SUBTITLE */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E6E9E5]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-[#2A7C13]/10 text-[#2A7C13]">
              <BarChart3 className="w-6 h-6" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B4D2B] tracking-tight">
              {isMr ? "पीकनिहाय बाजारभाव विश्लेषण" : "Crop-wise Market Price Analysis"}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#4A6B67] max-w-3xl">
            {isMr
              ? "वैयक्तिक पिकांचे बाजारभाव पहा, प्रत्यक्ष दरांच्या हालचालींची तुलना करा आणि बाजारातील चढ-उतार समजून घ्या."
              : "Explore individual crop market prices, compare observed price movements and understand market variations."}
          </p>
        </div>

        {/* Official Mandi Observation Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFF8CF] border border-[#FBE6C2] text-[#2A7C13] self-start lg:self-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#2A7C13]" />
          <span className="text-xs font-bold text-amber-950">
            {isMr ? "अधिकृत बाजार लिलाव दर (₹ / टन)" : "Verified APMC Mandi Rates (₹ / Ton)"}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. TOP FILTERS & MARKET SELECTION BAR */}
      {/* ============================================================== */}
      <div className="p-4 rounded-2xl bg-white border border-[#E6E9E5] shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Time Period Filter: 7 Days, 30 Days, 90 Days, 1 Year, All */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="text-[11px] font-bold text-[#1A2E22] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#2A7C13]" />
              <span>{isMr ? "कालावधी (Time Period)" : "Time Period"}</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] text-xs font-bold">
              {[
                { id: "7d", labelEn: "7 Days", labelMr: "७ दिवस" },
                { id: "30d", labelEn: "30 Days", labelMr: "३० दिवस" },
                { id: "90d", labelEn: "90 Days", labelMr: "९० दिवस" },
                { id: "1y", labelEn: "1 Year", labelMr: "१ वर्ष" },
                { id: "all", labelEn: "All", labelMr: "सर्व" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeWindow(t.id)}
                  className={`py-1.5 px-1 sm:px-2 text-center rounded-lg transition-all ${
                    timeWindow === t.id
                      ? "bg-[#2A7C13] text-white shadow-xs font-black"
                      : "text-text-muted hover:text-text-main hover:bg-white/60"
                  }`}
                >
                  <span className="text-[11px] block truncate">{isMr ? t.labelMr : t.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Market / APMC Selector */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[11px] font-bold text-[#1A2E22] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#2A7C13]" />
              <span>{isMr ? "बाजार समिती (Primary Market)" : "Primary Market (APMC)"}</span>
            </label>
            <select
              value={activeMarketId}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setActiveMarketId(id);
                const found = markets.find((m) => m.id === id);
                if (found) setActiveMarketName(found.name);
              }}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-[#E6E9E5] bg-white text-text-main focus:ring-2 focus:ring-[#2A7C13]/20 focus:border-[#2A7C13] outline-none"
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {isMr ? m.name_mr || m.name : m.name} ({m.district_name || selectedDistrict})
                </option>
              ))}
            </select>
          </div>

          {/* Compare Market (Optional) Selector */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[11px] font-bold text-[#1A2E22] uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-700" />
              <span>{isMr ? "तुलना बाजार (Compare Market)" : "Compare Market (Optional)"}</span>
            </label>
            <select
              value={compareMarketId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setCompareMarketId(val ? parseInt(val, 10) : undefined);
              }}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-[#E6E9E5] bg-white text-text-main focus:ring-2 focus:ring-[#2A7C13]/20 focus:border-[#2A7C13] outline-none"
            >
              <option value="">{isMr ? "— कोणताही नाही (एकक बाजार) —" : "— None (Single Market) —"}</option>
              {markets
                .filter((m) => m.id !== activeMarketId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {isMr ? m.name_mr || m.name : m.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Secondary Bar: Category Pills & Crop Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#E6E9E5]/60 text-xs">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", labelEn: "All Crops", labelMr: "सर्व पिके" },
              { id: "cash_crops", labelEn: "Cash Crops", labelMr: "नगदी पिके" },
              { id: "vegetables", labelEn: "Vegetables", labelMr: "भाजीपाला" },
              { id: "cereals", labelEn: "Cereals & Millets", labelMr: "धान्य" },
              { id: "oilseeds", labelEn: "Oilseeds", labelMr: "तेलबिया" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  categoryFilter === cat.id
                    ? "bg-[#2A7C13]/15 text-[#0B4D2B] border border-[#2A7C13]/30"
                    : "bg-[#F5F7F3] text-text-muted hover:text-text-main border border-transparent"
                }`}
              >
                {isMr ? cat.labelMr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Quick Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMr ? "पीक शोधा (उदा. केळी, कांदा)..." : "Search crop (e.g. Banana, Onion)..."}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E6E9E5] bg-[#F5F7F3] focus:bg-white focus:ring-2 focus:ring-[#2A7C13]/20 focus:border-[#2A7C13] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Comparison Legend when Compare Market is active */}
      {compareMarketObj && (
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-950">
              {isMr ? "बाजार तुलना सुरू आहे:" : "Market Comparison Active:"}
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-xs bg-[#2A7C13]" />
              <span className="font-semibold text-text-main">
                {isMr ? selectedMarketObj?.name_mr || activeMarketName : activeMarketName} (Primary)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-xs bg-amber-500" />
              <span className="font-semibold text-amber-950">
                {isMr ? compareMarketObj.name_mr || compareMarketObj.name : compareMarketObj.name} (Compare)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCompareMarketId(undefined)}
            className="text-[11px] font-bold text-amber-800 hover:underline"
          >
            {isMr ? "तुलना बंद करा" : "Clear Comparison"}
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. INDIVIDUAL CROP CARDS GRID */}
      {/* ============================================================== */}
      {loadingInitial ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-96 rounded-2xl bg-white border border-[#E6E9E5] p-5 animate-pulse space-y-4"
            >
              <div className="h-6 w-1/3 bg-slate-200 rounded-md" />
              <div className="grid grid-cols-2 gap-2 h-20 bg-slate-100 rounded-xl" />
              <div className="h-44 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredCropCards.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#E6E9E5] space-y-3">
          <Info className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-sm font-bold text-text-main">
            {isMr ? "कोणतेही पीक सापडले नाही" : "No crop records found"}
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {isMr
              ? "निवडलेल्या फिल्टरसाठी किंवा शोध संज्ञेसाठी कोणतेही पीक जुळत नाही. कृपया फिल्टर रीसेट करा."
              : "No crops match the selected category or search filter. Try clearing your filters."}
          </p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("all");
              setSearchQuery("");
            }}
            className="px-4 py-2 bg-[#2A7C13] text-white text-xs font-bold rounded-xl hover:bg-[#2A7C13]/90 transition-colors"
          >
            {isMr ? "फिल्टर रीसेट करा" : "Reset Filters"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredCropCards.map((card) => {
            const metrics = card.analysis?.summary_metrics;
            const series = card.analysis?.series || [];
            const comparisonSeries = card.analysis?.comparison_series || [];
            const hasData = series.length > 0 && metrics?.latest_price != null;

            // Compute Y-Axis bounds for scaling vertical bars
            const allModalPrices = series.map((s) => s.modal_price);
            if (comparisonSeries.length > 0) {
              comparisonSeries.forEach((cs) => allModalPrices.push(cs.comparison_modal_price));
            }
            const minObs = allModalPrices.length > 0 ? Math.min(...allModalPrices) : 0;
            const maxObs = allModalPrices.length > 0 ? Math.max(...allModalPrices) : 100;
            // Floor & ceil to nice boundaries
            const yMin = Math.max(0, Math.floor((minObs * 0.88) / 100) * 100);
            const yMax = Math.ceil((maxObs * 1.1) / 100) * 100;
            const yRange = yMax - yMin || 1;

            const trend = metrics?.trend_direction || "STABLE";
            const pctChange = metrics?.percentage_change ?? 0;

            return (
              <div
                key={card.commodity.id}
                className="bg-white rounded-2xl border border-[#E6E9E5] p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                {/* ---------------------------------------------------- */}
                {/* A. CROP HEADER (Clean Name Only, No Varieties) */}
                {/* ---------------------------------------------------- */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black text-[#0B4D2B] tracking-tight">
                      {isMr ? card.cleanNameMr : card.cleanNameEn}
                    </h3>
                    <span className="inline-block text-[11px] font-semibold text-text-muted mt-0.5">
                      {isMr ? card.categoryMr : card.categoryEn}
                    </span>
                  </div>

                  {/* Trend Indicator Badge */}
                  {hasData && (
                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                        trend === "RISING"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : trend === "FALLING"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {trend === "RISING" ? (
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                      ) : trend === "FALLING" ? (
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                      ) : (
                        <Minus className="w-3 h-3 text-slate-500" />
                      )}
                      <span>
                        {pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`}{" "}
                        {trend === "RISING" ? (isMr ? "वाढ" : "Rising") : trend === "FALLING" ? (isMr ? "घट" : "Falling") : (isMr ? "स्थिर" : "Stable")}
                      </span>
                    </div>
                  )}
                </div>

                {/* ---------------------------------------------------- */}
                {/* B. PRICE SUMMARY: 4 KEY VALUES IN ₹ / TON */}
                {/* ---------------------------------------------------- */}
                {hasData ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* 1. Latest Price */}
                    <div className="p-2.5 rounded-xl bg-[#FFF8CF]/60 border border-[#FBE6C2] space-y-0.5">
                      <span className="text-[10px] font-bold text-amber-900 block uppercase tracking-wider">
                        {isMr ? "सद्य भाव (Latest)" : "Latest Price"}
                      </span>
                      <div className="font-black text-[#2A7C13] text-base leading-tight">
                        ₹{metrics?.latest_price?.toLocaleString("en-IN")}
                      </div>
                      <span className="text-[9px] font-medium text-text-muted block">
                        {isMr ? "₹ / टन" : "₹ / Ton"}
                      </span>
                    </div>

                    {/* 2. Minimum Price */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wider">
                        {isMr ? "किमान भाव (Min)" : "Minimum Price"}
                      </span>
                      <div className="font-extrabold text-text-main text-sm leading-tight">
                        ₹{metrics?.min_observed_price?.toLocaleString("en-IN") || "—"}
                      </div>
                      <span className="text-[9px] font-medium text-text-muted block">
                        {isMr ? "₹ / टन" : "₹ / Ton"}
                      </span>
                    </div>

                    {/* 3. Maximum Price */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wider">
                        {isMr ? "कमाल भाव (Max)" : "Maximum Price"}
                      </span>
                      <div className="font-extrabold text-text-main text-sm leading-tight">
                        ₹{metrics?.max_observed_price?.toLocaleString("en-IN") || "—"}
                      </div>
                      <span className="text-[9px] font-medium text-text-muted block">
                        {isMr ? "₹ / टन" : "₹ / Ton"}
                      </span>
                    </div>

                    {/* 4. Average Price */}
                    <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 space-y-0.5">
                      <span className="text-[10px] font-bold text-emerald-900 block uppercase tracking-wider">
                        {isMr ? "सरासरी भाव (Avg)" : "Average Price"}
                      </span>
                      <div className="font-extrabold text-[#0B4D2B] text-sm leading-tight">
                        ₹{metrics?.average_modal_price?.toLocaleString("en-IN") || "—"}
                      </div>
                      <span className="text-[9px] font-medium text-emerald-800 block">
                        {isMr ? "₹ / टन" : "₹ / Ton"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-xs text-text-muted font-medium">
                      {isMr ? "बाजार दर माहिती उपलब्ध नाही" : "No market data available"}
                    </span>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* C. MARKET INFORMATION & DATE RANGE */}
                {/* ---------------------------------------------------- */}
                <div className="pt-2 pb-1 border-t border-[#E6E9E5]/60 flex items-center justify-between text-[11px] text-text-muted">
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <Building2 className="w-3.5 h-3.5 text-[#2A7C13] shrink-0" />
                    <span className="font-semibold text-text-main truncate">
                      {isMr ? selectedMarketObj?.name_mr || activeMarketName : activeMarketName}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium whitespace-nowrap">
                    {card.analysis?.date_range
                      ? `${formatDateLabel(card.analysis.date_range.start_date)} – ${formatDateLabel(card.analysis.date_range.end_date)}`
                      : timeWindow.toUpperCase()}
                  </span>
                </div>

                {/* ---------------------------------------------------- */}
                {/* D. SEPARATE INDEPENDENT VERTICAL BAR GRAPH */}
                {/* ---------------------------------------------------- */}
                {hasData ? (
                  <div className="space-y-1.5 pt-2 border-t border-[#E6E9E5]">
                    <div className="flex items-center justify-between text-[10px] text-text-muted font-bold">
                      <span>{isMr ? "प्रत्यक्ष बाजार लिलाव दर (₹/टन)" : "Observed Mandi Price (₹/Ton)"}</span>
                      <span>{card.cleanNameEn}</span>
                    </div>

                    {/* Chart Box */}
                    <div className="relative pt-5 pb-1 bg-[#F9FAF8] rounded-xl border border-[#E6E9E5]/70 p-2.5">
                      {/* Y-Axis dashed guidelines */}
                      <div className="absolute inset-x-2.5 top-5 bottom-7 flex flex-col justify-between pointer-events-none text-[9px] text-slate-300">
                        <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                          <span>₹{yMax >= 10000 ? `${Math.round(yMax / 1000)}k` : yMax.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="border-b border-dashed border-slate-200 pb-0.5 flex justify-between">
                          <span>₹{Math.round((yMax + yMin) / 2) >= 10000 ? `${Math.round((yMax + yMin) / 2000)}k` : Math.round((yMax + yMin) / 2).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="border-b border-slate-200" />
                      </div>

                      {/* Vertical Bars Container */}
                      <div className="relative z-10 flex items-end justify-between gap-1.5 sm:gap-2 h-36 pt-2">
                        {series.map((pt, idx) => {
                          const heightPct = Math.max(8, Math.round(((pt.modal_price - yMin) / yRange) * 100));
                          const compPt = comparisonSeries[idx];
                          const compHeightPct = compPt
                            ? Math.max(8, Math.round(((compPt.comparison_modal_price - yMin) / yRange) * 100))
                            : 0;

                          const isHovered =
                            hoveredPoint?.cropCode === card.commodity.code &&
                            hoveredPoint?.point.date === pt.date;

                          return (
                            <div
                              key={pt.date}
                              onMouseEnter={() =>
                                setHoveredPoint({
                                  cropCode: card.commodity.code,
                                  point: pt,
                                  comparisonPrice: compPt?.comparison_modal_price,
                                })
                              }
                              onMouseLeave={() => setHoveredPoint(null)}
                              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                            >
                              {/* Hover Tooltip Popup */}
                              {isHovered && (
                                <div className="absolute -top-16 z-30 px-2 py-1.5 bg-[#0B4D2B] text-white rounded-lg shadow-lg text-[10px] whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                                  <div className="font-bold">{formatDateLabel(pt.date)}</div>
                                  <div className="text-amber-200 font-extrabold">
                                    ₹{pt.modal_price.toLocaleString("en-IN")}{isMr ? " / टन" : " / Ton"}
                                  </div>
                                  {compPt && (
                                    <div className="text-amber-300 text-[9px]">
                                      Compare: ₹{compPt.comparison_modal_price.toLocaleString("en-IN")}{isMr ? " / टन" : " / Ton"}
                                    </div>
                                  )}
                                  <div className="text-[8px] text-slate-300">
                                    Spread: ₹{pt.min_price?.toLocaleString("en-IN")} – ₹{pt.max_price?.toLocaleString("en-IN")}
                                  </div>
                                </div>
                              )}

                              {/* Dual or Single Bar Group */}
                              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                                {/* Primary Market Bar */}
                                <div
                                  className={`w-full max-w-[16px] rounded-t-md transition-all duration-300 ${
                                    isHovered
                                      ? "bg-gradient-to-t from-[#0B4D2B] to-emerald-400 ring-2 ring-[#2A7C13]/50 scale-105"
                                      : "bg-gradient-to-t from-[#2A7C13] to-[#76C457] group-hover:from-[#1b530c] group-hover:to-emerald-400"
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />

                                {/* Comparison Market Bar (if compare market is active) */}
                                {compPt && (
                                  <div
                                    className={`w-full max-w-[16px] rounded-t-md transition-all duration-300 ${
                                      isHovered
                                        ? "bg-gradient-to-t from-amber-700 to-amber-400 ring-2 ring-amber-500/50 scale-105"
                                        : "bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-700 group-hover:to-amber-300"
                                    }`}
                                    style={{ height: `${compHeightPct}%` }}
                                  />
                                )}
                              </div>

                              {/* X-Axis Date Tick */}
                              <span
                                className={`text-[9px] mt-1.5 block text-center truncate max-w-full font-medium transition-colors ${
                                  isHovered ? "text-[#2A7C13] font-bold" : "text-text-muted"
                                }`}
                              >
                                {idx === 0 || idx === Math.floor(series.length / 2) || idx === series.length - 1
                                  ? formatDateLabel(pt.date)
                                  : "•"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center p-4 text-center">
                    <span className="text-xs text-text-muted">
                      {isMr
                        ? "या कालावधीसाठी पुरेसे बाजार लिलाव आलेख उपलब्ध नाहीत"
                        : "Insufficient observed mandi auctions to display graph"}
                    </span>
                  </div>
                )}

                {/* Card Footer: Source attribution */}
                <div className="pt-2 border-t border-[#E6E9E5]/60 flex items-center justify-between text-[10px] text-text-muted">
                  <span className="truncate max-w-[210px]">
                    {card.analysis?.source_info?.name || "Official Mandi Gateway / Agmarknet"}
                  </span>
                  <span className="text-emerald-700 font-bold shrink-0">
                    {isMr ? "पडताळणीकृत" : "Verified APMC"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
