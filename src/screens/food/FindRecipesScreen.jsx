import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const FAV_KEY      = "sff_fav_recipes";
const FEATURED_KEY = "sff_featured_recipe";

// ─── Daily rotation — two independent cycles so home strips vary each day ─────
const ROTATION_A = ["Chicken","Beef","Pasta","Seafood","Vegetarian","Lamb","Breakfast","Dessert","Vegan","Side","Starter"];
const ROTATION_B = ["Vegetarian","Pasta","Seafood","Chicken","Vegan","Lamb","Beef","Breakfast","Starter","Dessert","Side"];

function todayRotation() {
  const d = Math.floor(Date.now() / 86400000);
  return {
    catA: ROTATION_A[d % ROTATION_A.length],
    catB: ROTATION_B[d % ROTATION_B.length],
  };
}

// ─── Filter definitions ───────────────────────────────────────────────────────
// type "home"       → show hero + daily strips (no category fetch)
// type "category"   → GET /api/recipes/category/:value
// type "ingredient" → GET /api/recipes/ingredient/:value
const FILTERS = [
  { key: "all",        label: "All",        emoji: "🏠", type: "home"                              },
  { key: "breakfast",  label: "Breakfast",  emoji: "🌅", type: "category",   value: "Breakfast"   },
  { key: "lunch",      label: "Lunch",      emoji: "☀️",  type: "category",   value: "Pasta"       },
  { key: "dinner",     label: "Dinner",     emoji: "🌙", type: "category",   value: "Lamb"        },
  { key: "chicken",    label: "Chicken",    emoji: "🍗", type: "category",   value: "Chicken"     },
  { key: "beef",       label: "Beef",       emoji: "🥩", type: "category",   value: "Beef"        },
  { key: "fish",       label: "Fish",       emoji: "🐟", type: "ingredient", value: "Salmon"      },
  { key: "seafood",    label: "Seafood",    emoji: "🦐", type: "category",   value: "Seafood"     },
  { key: "vegetarian", label: "Vegetarian", emoji: "🥗", type: "category",   value: "Vegetarian"  },
  { key: "vegan",      label: "Vegan",      emoji: "🌿", type: "category",   value: "Vegan"       },
  { key: "pasta",      label: "Pasta",      emoji: "🍝", type: "category",   value: "Pasta"       },
  { key: "dessert",    label: "Desserts",   emoji: "🍰", type: "category",   value: "Dessert"     },
  { key: "lamb",       label: "Lamb",       emoji: "🐑", type: "category",   value: "Lamb"        },
];

// ─── Estimated macros per serving by MealDB category ─────────────────────────
const MACRO_EST = {
  Beef:       { kcal: 450, p: 35, c: 20, f: 22 },
  Chicken:    { kcal: 380, p: 40, c: 15, f: 14 },
  Lamb:       { kcal: 430, p: 32, c: 18, f: 22 },
  Pasta:      { kcal: 520, p: 18, c: 75, f: 12 },
  Seafood:    { kcal: 290, p: 32, c: 12, f: 10 },
  Vegetarian: { kcal: 320, p: 12, c: 42, f: 10 },
  Vegan:      { kcal: 280, p: 10, c: 45, f:  8 },
  Breakfast:  { kcal: 380, p: 16, c: 40, f: 16 },
  Dessert:    { kcal: 420, p:  6, c: 62, f: 18 },
  Side:       { kcal: 200, p:  5, c: 30, f:  8 },
  Starter:    { kcal: 250, p: 10, c: 25, f: 12 },
};

function getMacros(category) {
  return MACRO_EST[category] ?? { kcal: 380, p: 20, c: 35, f: 15 };
}

// Splits raw instruction text into individual step strings
function parseSteps(raw) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

// Splits array into rows of a given size
function chunk(arr, size) {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

// ─── Chip badge ───────────────────────────────────────────────────────────────
function Chip({ label, color }) {
  return (
    <View style={{ backgroundColor: color + "20", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, color, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

// ─── Single macro box (used in detail sheet and log modal) ───────────────────
function MacroBox({ label, value, color, bg }) {
  return (
    <View style={[macroBoxS.wrap, { backgroundColor: bg }]}>
      <Text style={[macroBoxS.value, { color }]}>{value}</Text>
      <Text style={macroBoxS.label}>{label}</Text>
    </View>
  );
}
const macroBoxS = StyleSheet.create({
  wrap:  { flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 11, paddingHorizontal: 4 },
  value: { fontSize: font.base, fontWeight: "800", lineHeight: 20 },
  label: { fontSize: 10, color: "#94a3b8", marginTop: 3 },
});

// ─── Recipe grid card ─────────────────────────────────────────────────────────
function RecipeCard({ item, onPress, isFav, onToggleFav, colors, categoryHint }) {
  const cat = item.category || categoryHint || null;
  return (
    <TouchableOpacity
      style={[cardS.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Image */}
      <View style={cardS.imgWrap}>
        {item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={cardS.img} resizeMode="cover" />
        ) : (
          <View style={[cardS.img, cardS.placeholder, { backgroundColor: colors.border }]}>
            <Ionicons name="restaurant-outline" size={30} color={colors.textLight} />
          </View>
        )}
        {/* Favourite heart */}
        <TouchableOpacity
          style={cardS.heartBtn}
          onPress={onToggleFav}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={15}
            color={isFav ? "#ef4444" : "#fff"}
          />
        </TouchableOpacity>
        {/* Category badge */}
        {cat && (
          <View style={cardS.badge}>
            <Text style={cardS.badgeText}>{cat}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={cardS.info}>
        <Text style={[cardS.name, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        {item.area ? (
          <View style={cardS.areaRow}>
            <Ionicons name="location-outline" size={10} color={colors.textLight} />
            <Text style={[cardS.area, { color: colors.textLight }]}>{item.area}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const cardS = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    flex: 1,
    margin: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  imgWrap:     { position: "relative" },
  img:         { width: "100%", height: 140 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  heartBtn: {
    position: "absolute", top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", bottom: 8, left: 8,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  info:      { padding: 10 },
  name:      { fontSize: font.sm, fontWeight: "700", lineHeight: 18, marginBottom: 4 },
  areaRow:   { flexDirection: "row", alignItems: "center", gap: 3 },
  area:      { fontSize: 10 },
});

// ─── Horizontal recipe strip (used on home view) ──────────────────────────────
function RecipeStrip({ title, subtitle, items, loading, favourites, onPress, onToggleFav, colors, categoryHint }) {
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      {/* Strip header */}
      <View style={stripS.header}>
        <Text style={[stripS.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[stripS.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(x) => String(x.mealId)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <View style={{ width: 158 }}>
              <RecipeCard
                item={item}
                onPress={() => onPress(item.mealId)}
                isFav={favourites.has(String(item.mealId))}
                onToggleFav={() => onToggleFav(item)}
                colors={colors}
                categoryHint={categoryHint}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}
const stripS = StyleSheet.create({
  header:   { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: spacing.lg, marginBottom: 4 },
  title:    { fontSize: font.base, fontWeight: "800" },
  subtitle: { fontSize: 12 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FindRecipesScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth }   = useAuth();
  const userId     = auth?.userId;
  const insets     = useSafeAreaInsets();

  // Daily rotation categories
  const { catA, catB } = useMemo(() => todayRotation(), []);

  // Filter / browse state
  const [activeFilter,  setActiveFilter]  = useState("all");
  const [filterItems,   setFilterItems]   = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);

  // Home-view strips
  const [featured,      setFeatured]      = useState(null);
  const [stripAItems,   setStripAItems]   = useState([]);
  const [stripALoading, setStripALoading] = useState(false);
  const [stripBItems,   setStripBItems]   = useState([]);
  const [stripBLoading, setStripBLoading] = useState(false);

  // Favourites
  const [favourites, setFavourites] = useState(new Set()); // Set of mealId strings
  const [favItems,   setFavItems]   = useState([]);        // full objects for display

  // Search
  const [searchQ,       setSearchQ]       = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);

  // Detail bottom sheet
  const [detail,        setDetail]        = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen,    setDetailOpen]    = useState(false);

  // Inline log panel (inside detail sheet — avoids nested-Modal iOS bug)
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [logServings,  setLogServings]  = useState("1");
  const [logKcal,      setLogKcal]      = useState("");
  const [logSaving,    setLogSaving]    = useState(false);
  const [logErr,       setLogErr]       = useState("");

  const s = useMemo(() => makeStyles(colors), [colors]);

  // ── Favourites ───────────────────────────────────────────────────────────────
  const loadFavs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(FAV_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setFavItems(arr);
      setFavourites(new Set(arr.map((x) => String(x.mealId))));
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadFavs(); }, [loadFavs]));

  async function toggleFav(item) {
    const id   = String(item.mealId);
    const next = favourites.has(id)
      ? favItems.filter((x) => String(x.mealId) !== id)
      : [
          { mealId: item.mealId, name: item.name, thumbUrl: item.thumbUrl, category: item.category },
          ...favItems,
        ];
    setFavItems(next);
    setFavourites(new Set(next.map((x) => String(x.mealId))));
    await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  }

  // ── Home: featured hero (cached per day) ────────────────────────────────────
  useEffect(() => {
    const todayKey = `${FEATURED_KEY}_${new Date().toDateString()}`;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(todayKey);
        if (cached) { setFeatured(JSON.parse(cached)); return; }
        const res   = await apiClient.get(`/api/recipes/category/${encodeURIComponent(catA)}`);
        const items = Array.isArray(res.data) ? res.data : [];
        if (!items.length) return;
        const picked = items[Math.floor(Math.random() * Math.min(items.length, 10))];
        setFeatured(picked);
        await AsyncStorage.setItem(todayKey, JSON.stringify(picked));
      } catch {}
    })();
  }, [catA]);

  // ── Home: strip A (daily category) ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStripALoading(true);
    apiClient.get(`/api/recipes/category/${encodeURIComponent(catA)}`)
      .then((r) => { if (!cancelled) setStripAItems(Array.isArray(r.data) ? r.data.slice(0, 14) : []); })
      .catch(() => { if (!cancelled) setStripAItems([]); })
      .finally(() => { if (!cancelled) setStripALoading(false); });
    return () => { cancelled = true; };
  }, [catA]);

  // ── Home: strip B (second daily category) ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStripBLoading(true);
    apiClient.get(`/api/recipes/category/${encodeURIComponent(catB)}`)
      .then((r) => { if (!cancelled) setStripBItems(Array.isArray(r.data) ? r.data.slice(0, 14) : []); })
      .catch(() => { if (!cancelled) setStripBItems([]); })
      .finally(() => { if (!cancelled) setStripBLoading(false); });
    return () => { cancelled = true; };
  }, [catB]);

  // ── Filter: load recipes when a non-home chip is selected ───────────────────
  useEffect(() => {
    const f = FILTERS.find((x) => x.key === activeFilter);
    if (!f || f.type === "home") return;
    let cancelled = false;
    setFilterLoading(true);
    setFilterItems([]);
    const url = f.type === "ingredient"
      ? `/api/recipes/ingredient/${encodeURIComponent(f.value)}`
      : `/api/recipes/category/${encodeURIComponent(f.value)}`;
    apiClient.get(url)
      .then((r) => { if (!cancelled) setFilterItems(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (!cancelled) setFilterItems([]); })
      .finally(() => { if (!cancelled) setFilterLoading(false); });
    return () => { cancelled = true; };
  }, [activeFilter]);

  // ── Search: debounced, fires after 350ms of no typing ───────────────────────
  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiClient.get("/api/recipes/search", { params: { q } });
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // ── Detail sheet ─────────────────────────────────────────────────────────────
  async function openDetail(mealId) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get(`/api/recipes/${mealId}`);
      setDetail(res.data || null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Log meal ─────────────────────────────────────────────────────────────────
  async function logMeal() {
    if (!detail) return;
    const servings = Math.max(0.5, parseFloat(logServings) || 1);
    const est      = getMacros(detail.category);
    const kcal     = parseFloat(logKcal) || Math.round(est.kcal * servings);
    const proteins = Math.round(est.p * servings);
    const carbs    = Math.round(est.c * servings);
    const fats     = Math.round(est.f * servings);
    setLogSaving(true);
    setLogErr("");
    try {
      await apiClient.post("/api/food-entry-logs", {
        userId,
        foodName:    `${detail.name} (homemade)`,
        weightValue: Math.round(servings * 300), // rough 300g per serving
        weightUnit:  "g",
        calories: kcal, proteins, carbs, fats,
        source:      "manual",
        loggedAt:    new Date().toISOString(),
      });
      setLogPanelOpen(false);
      setDetailOpen(false);
    } catch {
      setLogErr("Could not save. Please try again.");
    } finally {
      setLogSaving(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const activeFilt  = FILTERS.find((f) => f.key === activeFilter) ?? FILTERS[0];
  const isHome      = activeFilt.type === "home";
  const isSearching = searchQ.trim().length > 0;

  // Macro preview (live-updates when servings changes)
  const logPreview = useMemo(() => {
    if (!detail) return null;
    const sv  = parseFloat(logServings) || 1;
    const est = getMacros(detail.category);
    return {
      kcal: Math.round(est.kcal * sv),
      p:    Math.round(est.p * sv),
      c:    Math.round(est.c * sv),
      f:    Math.round(est.f * sv),
    };
  }, [detail, logServings]);

  // Close detail sheet and reset log panel
  function closeDetail() {
    setDetailOpen(false);
    setLogPanelOpen(false);
    setLogErr("");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={["top"]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate("FoodMain");
          }}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Find Recipes</Text>
        <View style={s.headerSide} />
      </View>

      {/* ── Search bar (always visible) ──────────────────────────────────────── */}
      <View style={[s.searchWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[s.searchBar, { backgroundColor: colors.background, borderColor: isSearching ? colors.primary : colors.border }]}>
          <Ionicons name="search-outline" size={16} color={isSearching ? colors.primary : colors.textSecondary} />
          <TextInput
            ref={searchRef}
            style={[s.searchInput, { color: colors.text }]}
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Search any recipe…"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQ.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQ("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content area (flex: 1 ensures it never overflows the screen) ───── */}
      <View style={{ flex: 1 }}>

        {/* ── Search results ────────────────────────────────────────────────── */}
        {isSearching ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.searchResultsList, { paddingBottom: insets.bottom + spacing.xl }]}
          >
            {searchLoading && (
              <View style={s.centerPad}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            )}

            {!searchLoading && searchQ.trim().length < 2 && (
              <Text style={[s.hint, { color: colors.textSecondary }]}>Type at least 2 characters to search</Text>
            )}

            {!searchLoading && searchQ.trim().length >= 2 && searchResults.length === 0 && (
              <View style={s.emptyWrap}>
                <Ionicons name="search-outline" size={44} color={colors.textLight} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>No results found</Text>
                <Text style={[s.emptyHint, { color: colors.textSecondary }]}>
                  Try a different dish name or ingredient
                </Text>
              </View>
            )}

            {!searchLoading && searchResults.map((item) => (
              <TouchableOpacity
                key={item.mealId}
                style={[s.searchRow, { backgroundColor: colors.surface }]}
                onPress={() => { setSearchQ(""); openDetail(item.mealId); }}
                activeOpacity={0.82}
              >
                {item.thumbUrl ? (
                  <Image source={{ uri: item.thumbUrl }} style={s.searchThumb} resizeMode="cover" />
                ) : (
                  <View style={[s.searchThumb, { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="restaurant-outline" size={22} color={colors.textLight} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.searchName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {(item.category || item.area) ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {[item.category, item.area].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </ScrollView>

        ) : (
          /* ── Browse view ─────────────────────────────────────────────────── */
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          >
            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filtersRow}
            >
              {FILTERS.map((f) => {
                const active = activeFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      s.filterChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor:     active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setActiveFilter(f.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.filterEmoji}>{f.emoji}</Text>
                    <Text style={[s.filterLabel, { color: active ? "#fff" : colors.text }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── HOME VIEW ───────────────────────────────────────────────── */}
            {isHome ? (
              <>
                {/* Today's featured hero */}
                {featured && (
                  <TouchableOpacity style={s.hero} onPress={() => openDetail(featured.mealId)} activeOpacity={0.9}>
                    {featured.thumbUrl ? (
                      <Image source={{ uri: featured.thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.border }]} />
                    )}
                    <View style={s.heroOverlay}>
                      <View style={s.heroBadge}>
                        <Ionicons name="star" size={10} color="#fbbf24" />
                        <Text style={s.heroBadgeText}>Today's Feature</Text>
                      </View>
                      <Text style={s.heroName} numberOfLines={2}>{featured.name}</Text>
                      <Text style={s.heroCta}>Tap to view recipe →</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Favourites strip */}
                {favItems.length > 0 && (
                  <RecipeStrip
                    title="❤️ Your Favourites"
                    items={favItems}
                    favourites={favourites}
                    onPress={openDetail}
                    onToggleFav={toggleFav}
                    colors={colors}
                  />
                )}

                {/* Daily strip A */}
                <RecipeStrip
                  title={`🍽️ ${catA} Recipes`}
                  subtitle="Today's picks"
                  items={stripAItems}
                  loading={stripALoading}
                  favourites={favourites}
                  onPress={openDetail}
                  onToggleFav={toggleFav}
                  colors={colors}
                  categoryHint={catA}
                />

                {/* Daily strip B */}
                <RecipeStrip
                  title={`✨ Explore ${catB}`}
                  subtitle="You might enjoy"
                  items={stripBItems}
                  loading={stripBLoading}
                  favourites={favourites}
                  onPress={openDetail}
                  onToggleFav={toggleFav}
                  colors={colors}
                  categoryHint={catB}
                />
              </>

            ) : (
              /* ── FILTER GRID VIEW ───────────────────────────────────────── */
              <View style={s.gridWrap}>
                {/* Section header */}
                <View style={s.gridHeader}>
                  <Text style={[s.gridTitle, { color: colors.text }]}>
                    {activeFilt.emoji} {activeFilt.label}
                  </Text>
                  {filterItems.length > 0 && (
                    <View style={[s.countBadge, { backgroundColor: colors.primary + "18" }]}>
                      <Text style={[s.countText, { color: colors.primary }]}>
                        {filterItems.length} recipes
                      </Text>
                    </View>
                  )}
                </View>

                {/* Loading */}
                {filterLoading && (
                  <View style={s.centerPad}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                )}

                {/* Empty state */}
                {!filterLoading && filterItems.length === 0 && (
                  <View style={s.emptyWrap}>
                    <Ionicons name="restaurant-outline" size={44} color={colors.textLight} />
                    <Text style={[s.emptyTitle, { color: colors.text }]}>No recipes found</Text>
                    <Text style={[s.emptyHint, { color: colors.textSecondary }]}>
                      Try a different filter
                    </Text>
                  </View>
                )}

                {/* 2-column grid */}
                {!filterLoading && filterItems.length > 0 &&
                  chunk(filterItems, 2).map((pair, pi) => (
                    <View key={pi} style={s.gridRow}>
                      {pair.map((item) => (
                        <View key={item.mealId} style={{ flex: 1 }}>
                          <RecipeCard
                            item={item}
                            onPress={() => openDetail(item.mealId)}
                            isFav={favourites.has(String(item.mealId))}
                            onToggleFav={() => toggleFav(item)}
                            colors={colors}
                            categoryHint={activeFilt.label}
                          />
                        </View>
                      ))}
                      {/* Filler if odd number of items */}
                      {pair.length === 1 && <View style={{ flex: 1, margin: 5 }} />}
                    </View>
                  ))
                }
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          RECIPE DETAIL BOTTOM SHEET
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={detailOpen}
        animationType="slide"
        transparent
        onRequestClose={closeDetail}
      >
        <View style={s.overlay}>
          {/* Tap backdrop to close */}
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeDetail} />

          <View style={[s.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            {/* Handle row — drag bar + ✕ close button */}
            <View style={s.handleRow}>
              <View style={[s.handle, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={s.sheetCloseBtn}
                onPress={closeDetail}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Loading state */}
            {detailLoading && (
              <View style={s.sheetCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.hint, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  Loading recipe…
                </Text>
              </View>
            )}

            {/* Error state */}
            {!detailLoading && !detail && (
              <View style={s.sheetCenter}>
                <Ionicons name="alert-circle-outline" size={44} color={colors.textLight} />
                <Text style={[s.hint, { color: colors.textSecondary }]}>Could not load this recipe.</Text>
              </View>
            )}

            {/* Recipe content */}
            {!detailLoading && detail && (() => {
              const est   = getMacros(detail.category);
              const steps = parseSteps(detail.instructions);
              const isFav = favourites.has(String(detail.mealId));

              return (
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                  {/* ── Hero image ─────────────────────────────────────────── */}
                  {detail.thumbUrl ? (
                    <Image source={{ uri: detail.thumbUrl }} style={s.sheetHero} resizeMode="cover" />
                  ) : (
                    <View style={[s.sheetHero, { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="restaurant-outline" size={56} color={colors.textLight} />
                    </View>
                  )}

                  <View style={s.sheetBody}>

                    {/* ── Title ─────────────────────────────────────────────── */}
                    <Text style={[s.sheetTitle, { color: colors.text }]}>{detail.name}</Text>

                    {/* ── Meta chips ────────────────────────────────────────── */}
                    <View style={s.chipsRow}>
                      {detail.category && <Chip label={detail.category} color="#6366f1" />}
                      {detail.area     && <Chip label={`🌍 ${detail.area}`} color="#0ea5e9" />}
                      {detail.tags
                        ?.split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((t) => <Chip key={t} label={t} color="#22c55e" />)
                      }
                    </View>

                    {/* ── Estimated macros ─────────────────────────────────── */}
                    <View style={[s.macroCard, { backgroundColor: colors.background }]}>
                      <View style={s.macroCardHeader}>
                        <Ionicons name="nutrition-outline" size={15} color={colors.primary} />
                        <Text style={[s.macroCardTitle, { color: colors.text }]}>
                          Estimated Nutrition
                        </Text>
                        <Text style={[s.macroCardNote, { color: colors.textLight }]}>per serving (approx.)</Text>
                      </View>
                      <View style={s.macroBoxRow}>
                        <MacroBox
                          label="Calories"
                          value={`${est.kcal}`}
                          color={colors.primary || "#0b84ff"}
                          bg={(colors.primary || "#0b84ff") + "14"}
                        />
                        <MacroBox label="Protein" value={`${est.p}g`}  color="#6366f1" bg="#6366f114" />
                        <MacroBox label="Carbs"   value={`${est.c}g`}  color="#f59e0b" bg="#f59e0b14" />
                        <MacroBox label="Fat"     value={`${est.f}g`}  color="#22c55e" bg="#22c55e14" />
                      </View>
                    </View>

                    {/* ── Ingredients ──────────────────────────────────────── */}
                    {detail.ingredients?.length > 0 && (
                      <>
                        <View style={s.sectionHeader}>
                          <Text style={[s.sectionTitle, { color: colors.text }]}>🧂 Ingredients</Text>
                          <View style={[s.sectionBadge, { backgroundColor: colors.primary + "18" }]}>
                            <Text style={[s.sectionBadgeText, { color: colors.primary }]}>
                              {detail.ingredients.length}
                            </Text>
                          </View>
                        </View>

                        {/* Ingredient list — clear rows with measure + name columns */}
                        <View style={[s.ingList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          {detail.ingredients.map((ing, i) => {
                            const isLast = i === detail.ingredients.length - 1;
                            return (
                              <View
                                key={i}
                                style={[
                                  s.ingRow,
                                  !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                  i % 2 === 0 && { backgroundColor: colors.primary + "05" },
                                ]}
                              >
                                {/* Bullet icon */}
                                <View style={[s.ingIcon, { backgroundColor: colors.primary + "16" }]}>
                                  <Text style={{ fontSize: 11 }}>🥄</Text>
                                </View>
                                {/* Measure (fixed width so names align) */}
                                <Text
                                  style={[s.ingMeasure, { color: colors.primary }]}
                                  numberOfLines={2}
                                >
                                  {ing.measure?.trim() || "—"}
                                </Text>
                                {/* Ingredient name */}
                                <Text style={[s.ingName, { color: colors.text }]} numberOfLines={2}>
                                  {ing.ingredient}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </>
                    )}

                    {/* ── Instructions ─────────────────────────────────────── */}
                    {steps.length > 0 && (
                      <>
                        <View style={[s.sectionHeader, { marginTop: spacing.xl }]}>
                          <Text style={[s.sectionTitle, { color: colors.text }]}>📋 Instructions</Text>
                          <View style={[s.sectionBadge, { backgroundColor: colors.primary + "18" }]}>
                            <Text style={[s.sectionBadgeText, { color: colors.primary }]}>{steps.length} steps</Text>
                          </View>
                        </View>

                        {steps.map((step, i) => (
                          <View key={i} style={s.stepRow}>
                            {/* Step number bubble */}
                            <View style={[s.stepCircle, { backgroundColor: colors.primary }]}>
                              <Text style={s.stepNum}>{i + 1}</Text>
                            </View>
                            {/* Step text card */}
                            <View style={[s.stepCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                              <Text style={[s.stepText, { color: colors.text }]}>{step}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    )}

                    {/* ── YouTube link ─────────────────────────────────────── */}
                    {detail.youtubeUrl ? (
                      <TouchableOpacity
                        style={[s.ytBtn, { backgroundColor: "#ff000012", borderColor: "#ff000030" }]}
                        onPress={() => Linking.openURL(detail.youtubeUrl)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="logo-youtube" size={20} color="#ff0000" />
                        <Text style={{ color: "#ff0000", fontWeight: "700", fontSize: font.sm }}>
                          Watch on YouTube
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* ── Action buttons ───────────────────────────────────── */}
                    <View style={s.actionRow}>
                      {/* Log recipe — opens inline panel below */}
                      <TouchableOpacity
                        style={[s.actionBtn, {
                          backgroundColor: logPanelOpen ? colors.background : colors.primary,
                          borderWidth: logPanelOpen ? 1.5 : 0,
                          borderColor: colors.primary,
                          flex: 2,
                        }]}
                        onPress={() => {
                          if (!logPanelOpen) {
                            setLogServings("1");
                            setLogKcal(String(est.kcal));
                            setLogErr("");
                          }
                          setLogPanelOpen((v) => !v);
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={logPanelOpen ? "chevron-up" : "add-circle-outline"}
                          size={19}
                          color={logPanelOpen ? colors.primary : "#fff"}
                        />
                        <Text style={[s.actionBtnTxt, { color: logPanelOpen ? colors.primary : "#fff" }]}>
                          {logPanelOpen ? "Cancel Log" : "Log this Recipe"}
                        </Text>
                      </TouchableOpacity>

                      {/* Save / favourite */}
                      <TouchableOpacity
                        style={[
                          s.actionBtn,
                          {
                            flex: 1,
                            backgroundColor: isFav ? "#fee2e2" : colors.background,
                            borderWidth: 1.5,
                            borderColor: isFav ? "#fecaca" : colors.border,
                          },
                        ]}
                        onPress={() =>
                          toggleFav({
                            mealId:   detail.mealId,
                            name:     detail.name,
                            thumbUrl: detail.thumbUrl,
                            category: detail.category,
                          })
                        }
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={isFav ? "heart" : "heart-outline"}
                          size={19}
                          color={isFav ? "#ef4444" : colors.textSecondary}
                        />
                        <Text style={[s.actionBtnTxt, { color: isFav ? "#ef4444" : colors.textSecondary }]}>
                          {isFav ? "Saved" : "Save"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* ── Inline log panel (expands when "Log this Recipe" tapped) ── */}
                    {logPanelOpen && (
                      <View style={[s.logPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[s.logPanelTitle, { color: colors.text }]}>Log Recipe</Text>

                        {/* Servings */}
                        <Text style={[s.logLabel, { color: colors.textSecondary }]}>Number of servings</Text>
                        <View style={s.servingRow}>
                          {["0.5", "1", "1.5", "2", "3"].map((v) => {
                            const sel = logServings === v;
                            return (
                              <TouchableOpacity
                                key={v}
                                style={[s.servingBtn, {
                                  borderColor:     sel ? colors.primary : colors.border,
                                  backgroundColor: sel ? colors.primary : colors.surface,
                                }]}
                                onPress={() => {
                                  setLogServings(v);
                                  const e = getMacros(detail.category);
                                  setLogKcal(String(Math.round(e.kcal * parseFloat(v))));
                                }}
                              >
                                <Text style={[s.servingBtnTxt, { color: sel ? "#fff" : colors.textSecondary }]}>{v}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Live macro preview */}
                        {logPreview && (
                          <View style={[s.macroPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {[
                              { label: "Kcal",    val: logPreview.kcal,       color: colors.primary || "#0b84ff" },
                              { label: "Protein", val: `${logPreview.p}g`,    color: "#6366f1" },
                              { label: "Carbs",   val: `${logPreview.c}g`,    color: "#f59e0b" },
                              { label: "Fat",     val: `${logPreview.f}g`,    color: "#22c55e" },
                            ].map(({ label, val, color }) => (
                              <View key={label} style={{ alignItems: "center" }}>
                                <Text style={{ fontSize: font.sm, fontWeight: "800", color }}>{val}</Text>
                                <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }}>{label}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Calorie override */}
                        <Text style={[s.logLabel, { color: colors.textSecondary }]}>Calories (kcal) — edit if needed</Text>
                        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                          <TextInput
                            style={[s.logInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                            value={logKcal}
                            onChangeText={setLogKcal}
                            keyboardType="numeric"
                            placeholder="e.g. 450"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </KeyboardAvoidingView>

                        {logErr ? (
                          <Text style={{ color: colors.error, fontSize: font.sm, marginTop: 4 }}>{logErr}</Text>
                        ) : null}

                        {/* Confirm */}
                        <TouchableOpacity
                          style={[s.logSaveBtn, { backgroundColor: colors.primary }, logSaving && { opacity: 0.6 }]}
                          onPress={logMeal}
                          disabled={logSaving}
                          activeOpacity={0.85}
                        >
                          {logSaving
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={{ color: "#fff", fontWeight: "700", fontSize: font.base }}>Log it ✓</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    )}

                  </View>{/* end sheetBody */}
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({

    screen: { flex: 1 },

    // ── Header
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      borderBottomWidth: 1,
    },
    // back button — explicit padding so touch target is always easy to hit
    backBtn: {
      width: 40, height: 40,
      alignItems: "center", justifyContent: "center",
    },
    headerSide:  { width: 40, height: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: "800" },

    // ── Search bar
    searchWrap: {
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderBottomWidth: 1,
    },
    searchBar: {
      flexDirection: "row", alignItems: "center", gap: 9,
      borderWidth: 1.5, borderRadius: radius.lg,
      paddingHorizontal: spacing.md, paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: font.base, padding: 0 },

    // ── Search results list
    searchResultsList: { padding: spacing.lg, gap: spacing.sm },
    searchRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      borderRadius: radius.lg, padding: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04, elevation: 1,
    },
    searchThumb: { width: 64, height: 64, borderRadius: radius.md },
    searchName:  { fontSize: font.base, fontWeight: "700", lineHeight: 20 },

    // ── Filter chips
    filtersRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
    filterChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 13, paddingVertical: 8,
      borderRadius: radius.full, borderWidth: 1.5,
    },
    filterEmoji: { fontSize: 13 },
    filterLabel: { fontSize: font.sm, fontWeight: "600" },

    // ── Hero card
    hero: {
      marginHorizontal: spacing.lg, marginBottom: spacing.xl,
      height: 215, borderRadius: radius.xl, overflow: "hidden",
    },
    heroOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.44)",
      padding: spacing.lg, justifyContent: "flex-end",
    },
    heroBadge: {
      flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
      backgroundColor: "rgba(0,0,0,0.40)",
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: 8, marginBottom: 8,
    },
    heroBadgeText: { color: "#fbbf24", fontSize: 11, fontWeight: "700" },
    heroName: { color: "#fff", fontSize: font.xl, fontWeight: "800", lineHeight: 28 },
    heroCta:  { color: "rgba(255,255,255,0.72)", fontSize: font.sm, marginTop: 4 },

    // ── Grid
    gridWrap:   { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
    gridHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    gridTitle:  { fontSize: font.base, fontWeight: "800" },
    gridRow:    { flexDirection: "row", marginHorizontal: -5 },
    countBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    countText:  { fontSize: 11, fontWeight: "700" },

    // ── Empty / hint
    centerPad:  { alignItems: "center", paddingVertical: 50 },
    emptyWrap:  { alignItems: "center", paddingVertical: 56, gap: spacing.sm },
    emptyTitle: { fontSize: font.base, fontWeight: "700" },
    emptyHint:  { fontSize: font.sm, textAlign: "center", paddingHorizontal: spacing.xl },
    hint:       { textAlign: "center", fontSize: font.sm, paddingVertical: spacing.xl },

    // ── Detail overlay / sheet
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" },
    sheet: {
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      maxHeight: "88%",   // leave more visible backdrop so users can see they can tap outside
      shadowColor: "#000", shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.14, shadowRadius: 20, elevation: 24,
    },
    // row containing the drag handle + ✕ close button
    handleRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingTop: 10, paddingBottom: 4, paddingHorizontal: spacing.md,
    },
    handle:        { width: 40, height: 4, borderRadius: 2, flex: 1, marginLeft: 32 },
    sheetCloseBtn: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
    },
    sheetCenter:{ alignItems: "center", paddingVertical: 60, gap: spacing.sm },
    sheetHero:  { width: "100%", height: 245 },
    sheetBody:  { padding: spacing.lg },
    sheetTitle: { fontSize: font.xl, fontWeight: "800", lineHeight: 28, marginBottom: spacing.sm },
    chipsRow:   { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: spacing.md },

    // ── Macro card (in detail)
    macroCard:       { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
    macroCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    macroCardTitle:  { fontSize: font.sm, fontWeight: "700" },
    macroCardNote:   { fontSize: 11, color: "#94a3b8" },
    macroBoxRow:     { flexDirection: "row", gap: spacing.sm },

    // ── Section header (ingredients / instructions)
    sectionHeader: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    sectionTitle:     { fontSize: font.base, fontWeight: "800", flex: 1 },
    sectionBadge:     { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
    sectionBadgeText: { fontSize: 11, fontWeight: "700" },

    // ── Ingredient list
    ingList: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", marginBottom: spacing.md },
    ingRow:  {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm,
    },
    ingIcon:    { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    ingMeasure: { fontSize: font.sm, fontWeight: "700", width: 76 },
    ingName:    { fontSize: font.sm, flex: 1 },

    // ── Instruction steps
    stepRow:   { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, alignItems: "flex-start" },
    stepCircle:{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 3 },
    stepNum:   { color: "#fff", fontSize: font.sm, fontWeight: "800" },
    stepCard:  { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
    stepText:  { fontSize: font.sm, lineHeight: 22 },

    // ── YouTube button
    ytBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, borderRadius: radius.lg, borderWidth: 1.5,
      paddingVertical: 12, marginTop: spacing.md, marginBottom: spacing.sm,
    },

    // ── Action buttons
    actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    actionBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 7, borderRadius: radius.lg, paddingVertical: 15,
    },
    actionBtnTxt: { fontWeight: "700", fontSize: font.base },

    // ── Inline log panel (inside detail sheet)
    logPanel: {
      borderRadius: radius.lg, borderWidth: 1,
      padding: spacing.lg, marginTop: spacing.md, gap: spacing.xs,
    },
    logPanelTitle: { fontSize: font.base, fontWeight: "800", marginBottom: spacing.xs },
    logLabel:      { fontSize: font.sm, fontWeight: "600", marginBottom: spacing.xs, marginTop: spacing.xs },
    servingRow:    { flexDirection: "row", gap: spacing.xs },
    servingBtn: {
      flex: 1, paddingVertical: 10, borderRadius: radius.md,
      borderWidth: 1.5, alignItems: "center",
    },
    servingBtnTxt: { fontSize: font.sm, fontWeight: "700" },
    macroPreview: {
      flexDirection: "row", justifyContent: "space-around",
      borderRadius: radius.md, borderWidth: 1,
      paddingVertical: 12, marginTop: spacing.xs,
    },
    logInput: {
      borderWidth: 1.5, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: 12,
      fontSize: font.base, textAlign: "center", marginTop: 4,
    },
    logSaveBtn: {
      borderRadius: radius.lg, paddingVertical: 14,
      alignItems: "center", justifyContent: "center", marginTop: spacing.sm,
    },
  });
}
