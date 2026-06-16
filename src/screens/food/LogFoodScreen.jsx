import { Fragment, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { postNotification } from "../../utils/notificationService";
import { isNotifEnabled } from "../../utils/notificationScheduler";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

// Macro color tokens (static so they work in both themes)
const MACRO_COLORS = {
  calories: { bar: "#0b84ff", bg: "#0b84ff22", text: "#0b84ff" },
  protein:  { bar: "#6366f1", bg: "#6366f122", text: "#6366f1" },
  carbs:    { bar: "#f59e0b", bg: "#f59e0b22", text: "#d97706" },
  fat:      { bar: "#22c55e", bg: "#22c55e22", text: "#16a34a" },
};

const MICRO_COLORS = {
  fiber:        "#06b6d4",
  sugar:        "#f472b6",
  saturatedFat: "#f97316",
  sodium:       "#eab308",
  potassium:    "#7c3aed",
  cholesterol:  "#d946ef",
  calcium:      "#3b82f6",
  iron:         "#b45309",
  zinc:         "#10b981",
  vitaminA:     "#f59e0b",
  vitaminC:     "#22c55e",
  vitaminD:     "#8b5cf6",
};

// ── Curated popular foods (clean, unbranded, USDA-based per-100g values) ────
const CURATED_POPULAR = [
  { fdcId: "c-egg-whole",      name: "Egg, Whole",             kcalPer100g: 143, proteinPer100g: 12.6, carbsPer100g: 0.7,  fatPer100g: 9.5,  sodiumPer100g: 142, cholesterolPer100g: 373, saturatedFatPer100g: 3.1, isCurated: true },
  { fdcId: "c-egg-white",      name: "Egg White",              kcalPer100g: 52,  proteinPer100g: 10.9, carbsPer100g: 0.7,  fatPer100g: 0.2,  sodiumPer100g: 166, isCurated: true },
  { fdcId: "c-chicken-breast", name: "Chicken Breast",         kcalPer100g: 165, proteinPer100g: 31.0, carbsPer100g: 0,    fatPer100g: 3.6,  sodiumPer100g: 74,  cholesterolPer100g: 85,  saturatedFatPer100g: 1.0, isCurated: true },
  { fdcId: "c-chicken-thigh",  name: "Chicken Thigh",          kcalPer100g: 209, proteinPer100g: 25.9, carbsPer100g: 0,    fatPer100g: 10.9, sodiumPer100g: 84,  cholesterolPer100g: 93,  saturatedFatPer100g: 2.9, isCurated: true },
  { fdcId: "c-beef-sirloin",   name: "Beef, Sirloin Steak",    kcalPer100g: 207, proteinPer100g: 26.1, carbsPer100g: 0,    fatPer100g: 10.6, sodiumPer100g: 56,  cholesterolPer100g: 83,  saturatedFatPer100g: 4.1, isCurated: true },
  { fdcId: "c-beef-ribeye",    name: "Beef, Ribeye Steak",     kcalPer100g: 291, proteinPer100g: 22.4, carbsPer100g: 0,    fatPer100g: 21.6, sodiumPer100g: 57,  cholesterolPer100g: 80,  saturatedFatPer100g: 9.0, isCurated: true },
  { fdcId: "c-rice-white",     name: "Rice, White (Cooked)",   kcalPer100g: 130, proteinPer100g: 2.7,  carbsPer100g: 28.2, fatPer100g: 0.3,  fiberPer100g: 0.4,  sodiumPer100g: 1, isCurated: true },
  { fdcId: "c-rice-brown",     name: "Rice, Brown (Cooked)",   kcalPer100g: 122, proteinPer100g: 2.3,  carbsPer100g: 25.6, fatPer100g: 0.9,  fiberPer100g: 1.8,  sodiumPer100g: 2, isCurated: true },
  { fdcId: "c-salmon",         name: "Salmon, Atlantic",       kcalPer100g: 208, proteinPer100g: 20.4, carbsPer100g: 0,    fatPer100g: 13.4, sodiumPer100g: 59,  cholesterolPer100g: 63,  saturatedFatPer100g: 3.1, potassiumPer100g: 490, isCurated: true },
  { fdcId: "c-tuna",           name: "Tuna, Canned in Water",  kcalPer100g: 116, proteinPer100g: 25.5, carbsPer100g: 0,    fatPer100g: 1.0,  sodiumPer100g: 337, cholesterolPer100g: 50, isCurated: true },
  { fdcId: "c-oats",           name: "Oats, Rolled",           kcalPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9,  fiberPer100g: 10.6, sodiumPer100g: 2, isCurated: true },
  { fdcId: "c-banana",         name: "Banana",                 kcalPer100g: 89,  proteinPer100g: 1.1,  carbsPer100g: 22.8, fatPer100g: 0.3,  fiberPer100g: 2.6,  sugarPer100g: 12.2, potassiumPer100g: 358, isCurated: true },
  { fdcId: "c-sweet-potato",   name: "Sweet Potato (Cooked)",  kcalPer100g: 86,  proteinPer100g: 1.6,  carbsPer100g: 20.1, fatPer100g: 0.1,  fiberPer100g: 3.0,  sugarPer100g: 4.2, potassiumPer100g: 337, vitaminAPer100g: 961, isCurated: true },
  { fdcId: "c-broccoli",       name: "Broccoli",               kcalPer100g: 34,  proteinPer100g: 2.8,  carbsPer100g: 7.0,  fatPer100g: 0.4,  fiberPer100g: 2.6,  vitaminCPer100g: 89.2, potassiumPer100g: 316, isCurated: true },
  { fdcId: "c-greek-yogurt",   name: "Greek Yogurt, Plain",    kcalPer100g: 59,  proteinPer100g: 10.2, carbsPer100g: 3.6,  fatPer100g: 0.4,  sugarPer100g: 3.2,  calciumPer100g: 111, sodiumPer100g: 36, isCurated: true },
];

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function roundInt(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

function calcFromPer100(per100, grams) {
  return (n(per100) * n(grams)) / 100;
}

function clampNonNeg(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, x);
}

export default function LogFoodScreen({ navigation, route }) {
  const { startLogFoodTour } = useTour();
  useEffect(() => { startLogFoodTour(); }, []);
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState("Popular");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const [recentLoading, setRecentLoading] = useState(false);
  const [recentErr, setRecentErr] = useState("");
  const [recentItems, setRecentItems] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState("100");
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState("");

  const [scanResults, setScanResults] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanGrams, setScanGrams] = useState({});
  const [scanNames, setScanNames] = useState({});

  const [microExpanded, setMicroExpanded] = useState(false);
  const [expandedFoodKey, setExpandedFoodKey] = useState(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mGrams, setMGrams] = useState("100");
  const [mKcal, setMKcal] = useState("");
  const [mP, setMP] = useState("");
  const [mC, setMC] = useState("");
  const [mF, setMF] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualErr, setManualErr] = useState("");

  // Always go to FoodMain when leaving LogFood — prevents back going to FoodCamera
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      navigation.navigate("FoodMain");
    });
    return unsub;
  }, [navigation]);

  // AI photo scan results → open the multi-item scan review sheet
  useEffect(() => {
    const items = route?.params?.scanResults;
    if (!items || !Array.isArray(items) || items.length === 0) return;
    const initialGrams = {};
    const initialNames = {};
    items.forEach((item, i) => {
      initialGrams[i] = String(item.estimatedGrams);
      initialNames[i] = item.name;
    });
    setScanResults(items);
    setScanGrams(initialGrams);
    setScanNames(initialNames);
    setScanOpen(true);
    navigation.setParams({ scanResults: undefined });
  }, [route?.params?.scanResults]);

  // Barcode scan result → open single-food add modal directly, pre-filled
  useEffect(() => {
    const row = route?.params?.barcodeResult;
    if (!row) return;
    openAdd(row, row.defaultGrams ?? 100);
    navigation.setParams({ barcodeResult: undefined });
  }, [route?.params?.barcodeResult]);

  const query = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    let cancelled = false;
    async function runPopular() {
      setErr(""); setLoading(true);
      try {
        let next = [];
        if (query) {
          // Search: fetch from API, sort non-branded (Foundation/SR Legacy) first
          const res = await apiClient.get("/api/food-database/search", { params: { q: query, limit: 25 } });
          const raw = res?.data?.items || [];
          next = [...raw].sort((a, b) => (a.brand ? 1 : 0) - (b.brand ? 1 : 0));
        } else {
          // No search: user's most-logged foods first, then curated staples
          let freqItems = [];
          if (userId) {
            try {
              const res = await apiClient.get(`/api/food-entry-logs/user/${userId}`);
              const list = Array.isArray(res.data) ? res.data : [];
              // Group by food name, count frequency
              const grouped = {};
              list.forEach(entry => {
                const name = entry.foodName;
                if (!name) return;
                if (!grouped[name]) grouped[name] = { count: 0, entries: [] };
                grouped[name].count++;
                grouped[name].entries.push(entry);
              });
              // Top 5 most logged — derive per-100g nutrition from their latest log entry
              freqItems = Object.entries(grouped)
                .sort(([, a], [, b]) => b.count - a.count)
                .slice(0, 5)
                .map(([name, { count, entries }]) => {
                  const latest = entries[entries.length - 1];
                  const w = clampNonNeg(latest.weightValue) || 100;
                  return {
                    fdcId: `freq-${name}`,
                    name,
                    isUserFrequency: true,
                    count,
                    kcalPer100g:    w > 0 ? (clampNonNeg(latest.calories) / w) * 100 : 0,
                    proteinPer100g: w > 0 ? (clampNonNeg(latest.proteins) / w) * 100 : 0,
                    carbsPer100g:   w > 0 ? (clampNonNeg(latest.carbs)    / w) * 100 : 0,
                    fatPer100g:     w > 0 ? (clampNonNeg(latest.fats)     / w) * 100 : 0,
                  };
                });
            } catch { /* no history yet — show curated only */ }
          }
          // Curated list, skip any names the user already has in their freq list
          const freqNames = new Set(freqItems.map(r => r.name.toLowerCase()));
          const curatedItems = CURATED_POPULAR.filter(f => !freqNames.has(f.name.toLowerCase()));
          next = [...freqItems, ...curatedItems];
        }
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setErr("Failed to load foods.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (tab === "Popular") runPopular();
    else setItems([]);
    return () => { cancelled = true; };
  }, [query, tab, userId]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecent() {
      if (tab !== "Recent" || !userId) { setRecentItems([]); return; }
      setRecentErr(""); setRecentLoading(true);
      try {
        const res = await apiClient.get(`/api/food-entry-logs/user/${userId}`);
        const list = Array.isArray(res.data) ? res.data : [];
        if (cancelled) return;
        const MICRO_LOG_KEYS = [
          ["fiberG",        "fiber"],
          ["sugarG",        "sugar"],
          ["saturatedFatG", "saturatedFat"],
          ["sodiumMg",      "sodium"],
          ["potassiumMg",   "potassium"],
          ["cholesterolMg", "cholesterol"],
          ["calciumMg",     "calcium"],
          ["ironMg",        "iron"],
          ["zincMg",        "zinc"],
          ["vitaminAMcg",   "vitaminA"],
          ["vitaminCMg",    "vitaminC"],
          ["vitaminDMcg",   "vitaminD"],
        ];
        const mapped = list.map((x, i) => {
          const weight = clampNonNeg(x?.weightValue);
          const kcal = clampNonNeg(x?.calories);
          const p = clampNonNeg(x?.proteins);
          const c = clampNonNeg(x?.carbs);
          const f = clampNonNeg(x?.fats);
          const per100 = weight > 0 ? (kcal / weight) * 100 : 0;

          // Derive per-100g micronutrient values using the same key names as Popular tab
          const per100Micros = {};
          MICRO_LOG_KEYS.forEach(([logKey, displayKey]) => {
            const absVal = x?.[logKey] != null ? clampNonNeg(x[logKey]) : null;
            if (absVal != null) {
              per100Micros[displayKey] = weight > 0 ? (absVal / weight) * 100 : absVal;
            }
          });

          return {
            key: String(x?.id ?? `${x?.foodName ?? "food"}-${i}`),
            name: String(x?.foodName || "Food item"),
            grams: roundInt(weight),
            kcal: roundInt(kcal),
            per100Derived: {
              kcal: per100,
              p: weight > 0 ? (p / weight) * 100 : 0,
              c: weight > 0 ? (c / weight) * 100 : 0,
              f: weight > 0 ? (f / weight) * 100 : 0,
              ...per100Micros,
            },
          };
        });
        setRecentItems(mapped);
      } catch {
        if (!cancelled) { setRecentItems([]); setRecentErr("Could not load recent foods."); }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    }
    loadRecent();
    return () => { cancelled = true; };
  }, [tab, userId]);

  const rows = useMemo(() => {
    if (tab !== "Popular") return [];
    return items.map((x) => ({
      fdcId: x.fdcId,
      name: x.brand ? `${x.name} (${x.brand})` : x.name,
      isUserFrequency: x.isUserFrequency || false,
      isCurated: x.isCurated || false,
      count: x.count,
      per100: {
        kcal: x.kcalPer100g, p: x.proteinPer100g, c: x.carbsPer100g, f: x.fatPer100g,
        fiber: x.fiberPer100g, sugar: x.sugarPer100g, sodium: x.sodiumPer100g,
        potassium: x.potassiumPer100g, cholesterol: x.cholesterolPer100g,
        saturatedFat: x.saturatedFatPer100g, vitaminA: x.vitaminAPer100g,
        vitaminC: x.vitaminCPer100g, vitaminD: x.vitaminDPer100g,
        calcium: x.calciumPer100g, iron: x.ironPer100g, zinc: x.zincPer100g,
      },
    }));
  }, [items, tab]);

  const gramsNum = useMemo(() => {
    const g = Number(String(grams).trim());
    return Number.isFinite(g) && g >= 1 ? g : 0;
  }, [grams]);

  const modalTotals = useMemo(() => {
    if (!selected) return { kcal: 0, p: 0, c: 0, f: 0 };
    return {
      kcal: roundInt(calcFromPer100(selected.per100.kcal, gramsNum)),
      p: roundInt(calcFromPer100(selected.per100.p, gramsNum)),
      c: roundInt(calcFromPer100(selected.per100.c, gramsNum)),
      f: roundInt(calcFromPer100(selected.per100.f, gramsNum)),
    };
  }, [selected, gramsNum]);

  const microTotals = useMemo(() => {
    if (!selected?.per100) return null;
    const p = selected.per100;
    function scale(v) { return v != null ? Math.round(calcFromPer100(v, gramsNum) * 10) / 10 : null; }
    const result = {
      fiberG: scale(p.fiber), sugarG: scale(p.sugar), sodiumMg: scale(p.sodium),
      potassiumMg: scale(p.potassium), cholesterolMg: scale(p.cholesterol),
      saturatedFatG: scale(p.saturatedFat), vitaminAMcg: scale(p.vitaminA),
      vitaminCMg: scale(p.vitaminC), vitaminDMcg: scale(p.vitaminD),
      calciumMg: scale(p.calcium), ironMg: scale(p.iron), zincMg: scale(p.zinc),
    };
    const hasAny = Object.values(result).some((v) => v != null);
    return hasAny ? result : null;
  }, [selected, gramsNum]);

  function openAdd(row, defaultG = 100) {
    setSelected(row);
    setGrams(String(defaultG && defaultG > 0 ? Math.round(defaultG) : 100));
    setAddErr("");
    setMicroExpanded(false);
    setModalOpen(true);
  }

  function openAddFromRecent(r) {
    setSelected({
      fdcId: null, name: r.name,
      per100: r.per100Derived,  // includes macros + any micronutrients derived from stored log
    });
    setGrams(String(r.grams || 100)); setAddErr(""); setMicroExpanded(false); setModalOpen(true);
  }

  async function confirmAdd() {
    if (!selected || gramsNum <= 0) { setAddErr("Enter a valid weight."); return; }
    setSaving(true); setAddErr("");
    try {
      await apiClient.post("/api/food-entry-logs", {
        userId, foodName: selected.name, weightValue: gramsNum, weightUnit: "g",
        calories: modalTotals.kcal, proteins: modalTotals.p, carbs: modalTotals.c, fats: modalTotals.f,
        ...(microTotals || {}),
        mealType: null, loggedAt: new Date().toISOString(),
      });
      if (await isNotifEnabled("food")) postNotification(userId, "food", "Meal logged! 🍽️", `${selected.name} — ${modalTotals.kcal} kcal, ${modalTotals.p}g protein logged.`);
      setModalOpen(false); setSelected(null);
      navigation.goBack();
    } catch {
      setAddErr("Could not add food.");
    } finally { setSaving(false); }
  }

  function openScan() {
    navigation.navigate("FoodCamera");
  }

  async function logAllScanned() {
    if (!scanResults) return;
    setSaving(true);
    try {
      await Promise.all(scanResults.map((item, i) => {
        const g = Math.max(1, parseInt(scanGrams[i] || item.estimatedGrams, 10));
        const scale = g / item.estimatedGrams;
        const name = (scanNames[i] || item.name).trim() || item.name;
        return apiClient.post("/api/food-entry-logs", {
          userId,
          foodName: name,
          weightValue: g,
          weightUnit: "g",
          calories: Math.round(item.calories * scale),
          proteins: Math.round(item.protein * scale),
          carbs: Math.round(item.carbs * scale),
          fats: Math.round(item.fat * scale),
          mealType: null,
          loggedAt: new Date().toISOString(),
        });
      }));
      const totalKcal = scanResults.reduce((sum, item, i) => {
        const g = Math.max(1, parseInt(scanGrams[i] || item.estimatedGrams, 10));
        return sum + Math.round(item.calories * (g / item.estimatedGrams));
      }, 0);
      if (await isNotifEnabled("food")) postNotification(userId, "food", `${scanResults.length} item${scanResults.length > 1 ? "s" : ""} logged! 📸`, `AI scan logged ${totalKcal} kcal across ${scanResults.length} food item${scanResults.length > 1 ? "s" : ""}.`);
      setScanOpen(false);
      setScanResults(null);
      navigation.navigate("FoodMain");
    } catch {
      setAddErr("Could not log food.");
    } finally {
      setSaving(false);
    }
  }

  function addScanItem() {
    const i = scanResults.length;
    setScanResults((prev) => [...prev, { name: "", estimatedGrams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 }]);
    setScanGrams((prev) => ({ ...prev, [i]: "100" }));
    setScanNames((prev) => ({ ...prev, [i]: "" }));
  }

  function deleteScanItem(idx) {
    const next = scanResults.filter((_, i) => i !== idx);
    const nextGrams = {};
    const nextNames = {};
    next.forEach((_, i) => {
      const oldIdx = i < idx ? i : i + 1;
      nextGrams[i] = scanGrams[oldIdx] || "100";
      nextNames[i] = scanNames[oldIdx] || next[i].name;
    });
    setScanResults(next);
    setScanGrams(nextGrams);
    setScanNames(nextNames);
  }

  function openManual() {
    setManualErr(""); setMName(""); setMGrams("100"); setMKcal(""); setMP(""); setMC(""); setMF("");
    setManualOpen(true);
  }

  async function confirmManual() {
    const foodName = String(mName || "").trim();
    const g = clampNonNeg(mGrams === "" ? 0 : mGrams);
    if (!foodName) { setManualErr("Enter a food name."); return; }
    if (g <= 0) { setManualErr("Enter a valid weight."); return; }
    setManualSaving(true); setManualErr("");
    try {
      const kcal = roundInt(clampNonNeg(mKcal || 0));
      await apiClient.post("/api/food-entry-logs", {
        userId, foodName, weightValue: roundInt(g), weightUnit: "g",
        calories: kcal, proteins: roundInt(clampNonNeg(mP || 0)),
        carbs: roundInt(clampNonNeg(mC || 0)), fats: roundInt(clampNonNeg(mF || 0)),
        mealType: null, loggedAt: new Date().toISOString(),
      });
      if (await isNotifEnabled("food")) postNotification(userId, "food", "Meal logged! 🍽️", `${foodName}${kcal > 0 ? ` — ${kcal} kcal` : ""} logged manually.`);
      setManualOpen(false);
      navigation.goBack();
    } catch {
      setManualErr("Could not add food.");
    } finally { setManualSaving(false); }
  }

  const isLoading = tab === "Popular" ? loading : recentLoading;
  const displayErr = tab === "Popular" ? err : recentErr;
  const displayRows = tab === "Popular" ? rows : recentItems;

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Log Food</Text>
        <TourTarget tourKey="logfood_scan">
          <TouchableOpacity onPress={openScan} style={[s.headerBtn, { alignItems: "center" }]}>
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={{ fontSize: 9, color: colors.primary, fontWeight: "700", marginTop: 1, letterSpacing: 0.3 }}>
              SCAN
            </Text>
          </TouchableOpacity>
        </TourTarget>
      </View>

      <TourTarget tourKey="logfood_search">
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <TextInput style={s.searchInput} value={q} onChangeText={setQ} placeholder="Search for Foods" placeholderTextColor={colors.textSecondary} />
        </View>
      </TourTarget>

      <TourTarget tourKey="logfood_list">
        <View style={s.tabs}>
          {["Recent", "Popular"].map((t) => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextOn]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TourTarget>

      <ScrollView contentContainerStyle={s.body}>
        {displayErr ? <Text style={s.errText}>{displayErr}</Text> : null}
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}

        {!isLoading && displayRows.length === 0 ? (
          <Text style={s.empty}>{tab === "Popular" ? "No results" : "No recent foods yet"}</Text>
        ) : null}

        {!isLoading && displayRows.map((x, idx) => {
          const rowKey = tab === "Popular" ? String(x.fdcId || x.name) : x.key;
          const isOpen = expandedFoodKey === rowKey;
          const isPopular = tab === "Popular";
          const prevX = idx > 0 ? displayRows[idx - 1] : null;
          const hasFreqItems = isPopular && displayRows.some(r => r.isUserFrequency);
          const showFreqHeader = isPopular && x.isUserFrequency && !prevX?.isUserFrequency;
          const showCuratedHeader = isPopular && x.isCurated && !prevX?.isCurated && hasFreqItems;
          const p = isPopular ? x.per100 : x.per100Derived;
          const servingLabel = isPopular ? "per 100g" : `per ${x.grams || 100}g`;

          // Macros for the preview
          const previewMacros = [
            { label: "Calories", val: roundInt(p?.kcal),  unit: "kcal", color: MACRO_COLORS.calories },
            { label: "Protein",  val: roundInt(p?.p),     unit: "g",    color: MACRO_COLORS.protein },
            { label: "Carbs",    val: roundInt(p?.c),     unit: "g",    color: MACRO_COLORS.carbs },
            { label: "Fat",      val: roundInt(p?.f),     unit: "g",    color: MACRO_COLORS.fat },
          ];

          // Micros — shown for both Popular and Recent (Recent derives values from stored log)
          const previewMicros = [
            ["Fiber",       p?.fiber,        "g",   MICRO_COLORS.fiber],
            ["Sugar",       p?.sugar,        "g",   MICRO_COLORS.sugar],
            ["Sat. Fat",    p?.saturatedFat, "g",   MICRO_COLORS.saturatedFat],
            ["Sodium",      p?.sodium,       "mg",  MICRO_COLORS.sodium],
            ["Potassium",   p?.potassium,    "mg",  MICRO_COLORS.potassium],
            ["Cholesterol", p?.cholesterol,  "mg",  MICRO_COLORS.cholesterol],
            ["Calcium",     p?.calcium,      "mg",  MICRO_COLORS.calcium],
            ["Iron",        p?.iron,         "mg",  MICRO_COLORS.iron],
            ["Zinc",        p?.zinc,         "mg",  MICRO_COLORS.zinc],
            ["Vitamin A",   p?.vitaminA,     "mcg", MICRO_COLORS.vitaminA],
            ["Vitamin C",   p?.vitaminC,     "mg",  MICRO_COLORS.vitaminC],
            ["Vitamin D",   p?.vitaminD,     "mcg", MICRO_COLORS.vitaminD],
          ].filter(([, v]) => v != null && Number(v) > 0);

          return (
            <Fragment key={rowKey}>
              {showFreqHeader && <Text style={s.sectionHeader}>Your Favourites</Text>}
              {showCuratedHeader && <Text style={s.sectionHeader}>Popular Foods</Text>}
              <View style={s.rowWrap}>
              <TouchableOpacity
                style={s.row}
                onPress={() => setExpandedFoodKey(isOpen ? null : rowKey)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 2 }}>
                  <Text style={s.rowName} numberOfLines={2}>{x.name}</Text>
                  {isPopular && x.isUserFrequency && x.count > 0 && (
                    <View style={s.freqBadge}>
                      <Ionicons name="flame" size={11} color="#f97316" />
                      <Text style={s.freqBadgeText}>{x.count}× logged</Text>
                    </View>
                  )}
                </View>
                <Text style={s.rowMeta}>{isPopular ? "100g" : x.grams ? `${x.grams}g` : "—"}</Text>
                <Text style={s.rowKcal}>{isPopular ? (roundInt(p?.kcal) || "—") : (x.kcal || "—")}</Text>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} style={{ marginHorizontal: 4 }} />
                <TouchableOpacity style={s.addBtn} onPress={() => isPopular ? openAdd(x) : openAddFromRecent(x)}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>

              {isOpen && (
                <View style={s.previewPanel}>
                  <Text style={s.previewServing}>{servingLabel}</Text>
                  <View style={s.previewMacros}>
                    {previewMacros.map(({ label, val, unit, color }) => (
                      <View key={label} style={[s.previewMacroItem, { backgroundColor: color.bg }]}>
                        <View style={[s.macroColorBar, { backgroundColor: color.bar }]} />
                        <Text style={s.macroLabel}>{label}</Text>
                        <Text style={[s.macroVal, { color: color.text }]}>{val ?? "—"}</Text>
                        {val != null && <Text style={[s.macroUnit, { color: color.text }]}>{unit}</Text>}
                      </View>
                    ))}
                  </View>
                  {previewMicros.length > 0 && (
                    <>
                      <Text style={s.previewMicroTitle}>Micronutrients</Text>
                      <View style={s.microGrid}>
                        {previewMicros.map(([label, val, unit, color]) => (
                          <View key={label} style={[s.microItem, { backgroundColor: color + "22" }]}>
                            <View style={[s.microItemDot, { backgroundColor: color }]} />
                            <Text style={[s.microLabel, { color }]}>{label}</Text>
                            <Text style={[s.microVal, { color }]}>{Math.round(Number(val) * 10) / 10}{unit}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
              </View>
            </Fragment>
          );
        })}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom || spacing.lg }]}>
        <TouchableOpacity style={s.manualBtn} onPress={openManual}>
          <Text style={s.manualBtnText}>Manual Entry</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => !saving && setModalOpen(false)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={s.cardTitle}>Add Food</Text>
                {selected?.defaultGrams != null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.primary + "18", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Ionicons name="barcode-outline" size={11} color={colors.primary} />
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "700" }}>Barcode</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => !saving && setModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={s.foodName} numberOfLines={2}>{selected?.name}</Text>

            <Text style={s.fieldLabel}>Weight (g)</Text>
            <TextInput style={s.fieldInput} value={grams} onChangeText={setGrams} keyboardType="numeric" placeholder="e.g. 150" placeholderTextColor={colors.textSecondary} />

            <View style={s.macroGrid}>
              {[
                ["Calories", `${modalTotals.kcal} kcal`, MACRO_COLORS.calories],
                ["Protein",  `${modalTotals.p}g`,        MACRO_COLORS.protein],
                ["Carbs",    `${modalTotals.c}g`,        MACRO_COLORS.carbs],
                ["Fat",      `${modalTotals.f}g`,        MACRO_COLORS.fat],
              ].map(([label, val, mc]) => (
                <View key={label} style={[s.macroItem, { backgroundColor: mc.bg }]}>
                  <View style={[s.macroColorBar, { backgroundColor: mc.bar }]} />
                  <Text style={s.macroLabel}>{label}</Text>
                  <Text style={[s.macroVal, { color: mc.text }]}>{val}</Text>
                </View>
              ))}
            </View>

            {microTotals ? (
              <>
                <TouchableOpacity style={s.microToggle} onPress={() => setMicroExpanded((v) => !v)}>
                  <Text style={s.microToggleText}>Micronutrients</Text>
                  <Ionicons name={microExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {microExpanded && (
                  <View style={s.microGrid}>
                    {[
                      ["Fiber",       microTotals.fiberG,        "g",   MICRO_COLORS.fiber],
                      ["Sugar",       microTotals.sugarG,        "g",   MICRO_COLORS.sugar],
                      ["Sat. Fat",    microTotals.saturatedFatG, "g",   MICRO_COLORS.saturatedFat],
                      ["Sodium",      microTotals.sodiumMg,      "mg",  MICRO_COLORS.sodium],
                      ["Potassium",   microTotals.potassiumMg,   "mg",  MICRO_COLORS.potassium],
                      ["Cholesterol", microTotals.cholesterolMg, "mg",  MICRO_COLORS.cholesterol],
                      ["Calcium",     microTotals.calciumMg,     "mg",  MICRO_COLORS.calcium],
                      ["Iron",        microTotals.ironMg,        "mg",  MICRO_COLORS.iron],
                      ["Zinc",        microTotals.zincMg,        "mg",  MICRO_COLORS.zinc],
                      ["Vitamin A",   microTotals.vitaminAMcg,   "mcg", MICRO_COLORS.vitaminA],
                      ["Vitamin C",   microTotals.vitaminCMg,    "mg",  MICRO_COLORS.vitaminC],
                      ["Vitamin D",   microTotals.vitaminDMcg,   "mcg", MICRO_COLORS.vitaminD],
                    ].filter(([, v]) => v != null).map(([label, val, unit, color]) => (
                      <View key={label} style={[s.microItem, { backgroundColor: color + "22" }]}>
                        <View style={[s.microItemDot, { backgroundColor: color }]} />
                        <Text style={[s.microLabel, { color }]}>{label}</Text>
                        <Text style={[s.microVal, { color }]}>{val}{unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}

            {addErr ? <Text style={s.errText}>{addErr}</Text> : null}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => !saving && setModalOpen(false)} disabled={saving}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={confirmAdd} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={scanOpen} animationType="slide" transparent onRequestClose={() => !saving && setScanOpen(false)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>AI Scan Results</Text>
              <TouchableOpacity onPress={() => !saving && setScanOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={s.foodName}>
              {(scanResults?.length || 0)} item{(scanResults?.length || 0) !== 1 ? "s" : ""} detected — edit names or grams as needed.
            </Text>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {(scanResults || []).map((item, i) => {
                const g = Math.max(1, parseInt(scanGrams[i] || item.estimatedGrams, 10) || 1);
                const scale = g / (item.estimatedGrams || 1);
                const kcal = Math.round(item.calories * scale);
                const prot = Math.round(item.protein * scale);
                return (
                  <View key={i} style={s.scanItem}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <TextInput
                        style={s.scanNameInput}
                        value={scanNames[i] ?? item.name}
                        onChangeText={(v) => setScanNames((prev) => ({ ...prev, [i]: v }))}
                        placeholder="Food name"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <Text style={s.scanItemMeta}>~{kcal} kcal • {prot}g protein</Text>
                    </View>
                    <View style={s.scanGramsRow}>
                      <TextInput
                        style={s.scanGramsInput}
                        value={scanGrams[i]}
                        onChangeText={(v) => setScanGrams((prev) => ({ ...prev, [i]: v }))}
                        keyboardType="numeric"
                      />
                      <Text style={s.scanGramsLabel}>g</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteScanItem(i)} style={s.deleteItemBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity style={s.addItemBtn} onPress={addScanItem}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[s.addItemBtnText, { color: colors.primary }]}>Add item</Text>
              </TouchableOpacity>
            </ScrollView>

            {scanResults && scanResults.length > 0 ? (() => {
              const total = scanResults.reduce((sum, item, i) => {
                const g = Math.max(1, parseInt(scanGrams[i] || item.estimatedGrams, 10) || 1);
                return sum + Math.round(item.calories * (g / (item.estimatedGrams || 1)));
              }, 0);
              return (
                <View style={s.scanTotalRow}>
                  <Text style={s.scanTotalLabel}>Total</Text>
                  <Text style={s.scanTotalVal}>{total} kcal</Text>
                </View>
              );
            })() : null}

            {addErr ? <Text style={s.errText}>{addErr}</Text> : null}
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.retakeScanBtn}
                disabled={saving}
                onPress={() => {
                  setScanOpen(false);
                  setScanResults(null);
                  navigation.navigate("FoodCamera");
                }}
              >
                <Ionicons name="camera-outline" size={16} color={colors.text} />
                <Text style={s.retakeScanBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={logAllScanned} disabled={saving || !scanResults?.length}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnText}>Log All</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={manualOpen} animationType="fade" transparent onRequestClose={() => !manualSaving && setManualOpen(false)}>
        <KeyboardAvoidingView
          style={[s.centeredOverlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.centeredCard}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>Manual Entry</Text>
              <TouchableOpacity onPress={() => !manualSaving && setManualOpen(false)} style={s.closeIconBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {manualErr ? <Text style={s.errText}>{manualErr}</Text> : null}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {[["Food name", mName, setMName, "default", "e.g. Homemade wrap"],
                ["Weight (g)", mGrams, setMGrams, "numeric", "e.g. 250"],
                ["Calories (kcal)", mKcal, setMKcal, "numeric", "0"],
                ["Protein (g)", mP, setMP, "numeric", "0"],
                ["Carbs (g)", mC, setMC, "numeric", "0"],
                ["Fat (g)", mF, setMF, "numeric", "0"]
              ].map(([label, val, setter, kbType, ph]) => (
                <View key={label} style={{ marginBottom: spacing.sm }}>
                  <Text style={s.fieldLabel}>{label}</Text>
                  <TextInput style={s.fieldInput} value={val} onChangeText={setter} keyboardType={kbType} placeholder={ph} placeholderTextColor={colors.textSecondary} />
                </View>
              ))}
              <Text style={s.hint}>Tip: leave macros empty if unknown — they'll be saved as 0.</Text>
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => !manualSaving && setManualOpen(false)} disabled={manualSaving}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={confirmManual} disabled={manualSaving}>
                {manualSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    searchRow: { flexDirection: "row", alignItems: "center", margin: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    searchInput: { flex: 1, fontSize: font.base, color: colors.text },
    tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    tab: { flex: 1, paddingVertical: 8, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semiBold },
    tabTextOn: { color: "#fff" },
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
    errText: { color: colors.error, fontSize: font.sm, textAlign: "center", marginVertical: spacing.sm },
    empty: { color: colors.textSecondary, textAlign: "center", marginVertical: spacing.xl, fontSize: font.sm },
    sectionHeader: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, paddingTop: spacing.md, paddingBottom: spacing.xs },
    freqBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f9731618", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginTop: 3 },
    freqBadgeText: { fontSize: 10, fontWeight: "700", color: "#f97316" },
    rowWrap: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.sm, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
    rowName: { fontSize: font.sm, color: colors.text, fontWeight: font.semiBold },
    rowMeta: { flex: 1, fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    rowKcal: { flex: 1, fontSize: font.sm, color: colors.text, textAlign: "right" },
    addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    previewPanel: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    previewServing: { fontSize: 11, color: colors.textSecondary, fontWeight: "600", marginTop: spacing.sm },
    previewMacros: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    previewMacroItem: { borderRadius: radius.md, padding: spacing.sm, minWidth: "22%", flex: 1, overflow: "hidden" },
    previewMicroTitle: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
    footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
    manualBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.lg, paddingVertical: 13, alignItems: "center" },
    manualBtnText: { color: colors.primary, fontSize: font.base, fontWeight: font.semiBold },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    card: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl * 2 },
    centeredOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: spacing.lg },
    centeredCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, maxHeight: "85%" },
    closeIconBtn: { padding: 6 },
    cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    foodName: { fontSize: font.base, color: colors.textSecondary, marginBottom: spacing.md },
    fieldLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semiBold, marginBottom: 4 },
    fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: font.base, color: colors.text, marginBottom: spacing.md, backgroundColor: colors.background },
    macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.sm },
    macroItem: { borderRadius: radius.md, padding: spacing.sm, minWidth: "45%", flex: 1, overflow: "hidden" },
    macroColorBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
    macroLabel: { fontSize: 11, color: colors.textSecondary, marginLeft: 6 },
    macroVal: { fontSize: font.base, fontWeight: font.bold, marginLeft: 6 },
    macroUnit: { fontSize: 11, fontWeight: font.semiBold, marginLeft: 6, opacity: 0.75 },
    microToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
    microToggleText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    microGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
    microItem: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 5 },
    microItemDot: { width: 6, height: 6, borderRadius: 3 },
    microLabel: { fontSize: 11, fontWeight: "600" },
    microVal: { fontSize: 11, fontWeight: "700" },
    hint: { fontSize: font.sm, color: colors.textSecondary, fontStyle: "italic", marginBottom: spacing.md },
    modalBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 13, alignItems: "center" },
    cancelBtnText: { color: colors.text, fontSize: font.base, fontWeight: font.semiBold },
    confirmBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 13, alignItems: "center" },
    confirmBtnText: { color: "#fff", fontSize: font.base, fontWeight: font.bold },
    scanItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
    scanNameInput: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 },
    scanItemMeta: { fontSize: font.sm, color: colors.textSecondary },
    scanGramsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    scanGramsInput: { width: 56, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 6, fontSize: font.base, color: colors.text, textAlign: "center" },
    scanGramsLabel: { fontSize: font.sm, color: colors.textSecondary },
    deleteItemBtn: { padding: 6 },
    addItemBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm },
    addItemBtnText: { fontSize: font.sm, fontWeight: font.semiBold },
    scanTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
    scanTotalLabel: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    scanTotalVal: { fontSize: font.base, fontWeight: font.bold, color: colors.primary },
    retakeScanBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 13 },
    retakeScanBtnText: { color: colors.text, fontSize: font.base, fontWeight: font.semiBold },
  });
}
