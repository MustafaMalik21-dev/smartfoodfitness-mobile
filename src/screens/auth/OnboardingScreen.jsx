/**
 * OnboardingScreen — 6-step quick setup
 * Steps: Personal → Measurements → Current Body → Goal Body → Nutrition → Aims
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Svg, Circle, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import { AIM_CATEGORIES, MAX_AIMS } from "../../data/aims";

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function lbsToKg(v) { return Number(v) / 2.2046226218; }
function round1(x) { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
function clampInt(x, lo, hi) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : lo;
}
function calcBMI(wKg, hCm) {
  if (!wKg || !hCm || hCm <= 0) return null;
  return wKg / ((hCm / 100) ** 2);
}
function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return { label: "Underweight", color: "#0ea5e9" };
  if (bmi < 25)   return { label: "Healthy",     color: "#22c55e" };
  if (bmi < 30)   return { label: "Overweight",  color: "#f59e0b" };
  return                  { label: "Obese",       color: "#ef4444" };
}
function healthyRange(hCm) {
  if (!hCm) return null;
  const h = hCm / 100;
  return { lo: round1(18.5 * h * h), hi: round1(24.9 * h * h) };
}
function activityMult(level) {
  const v = String(level || "").toLowerCase();
  if (v === "low")      return 1.2;
  if (v === "moderate") return 1.55;
  if (v === "high")     return 1.725;
  return 1.2;
}
function mifflinBMR({ sex, age, heightCm, weightKg }) {
  const a = Number(age), h = Number(heightCm), w = Number(weightKg);
  if (!Number.isFinite(a) || !Number.isFinite(h) || !Number.isFinite(w)) return null;
  const base = 10 * w + 6.25 * h - 5 * a;
  if (sex === "male")   return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}
function weeklyChange(tdee, calGoal) {
  if (!tdee || !calGoal) return null;
  // diff is a DAILY calorie difference. Multiply by 7 to get weekly energy
  // imbalance, then divide by 7700 kcal (energy in 1 kg of body fat).
  const diff      = Number(calGoal) - Number(tdee);
  const kgPerWeek = round1((Math.abs(diff) * 7) / 7700);
  if (Math.abs(diff) < 50) return { text: "Maintain current weight",      col: "#22c55e", icon: "remove-circle-outline" };
  if (diff < 0)            return { text: `Lose ~${kgPerWeek} kg / week`, col: "#0ea5e9", icon: "trending-down-outline" };
  return                          { text: `Gain ~${kgPerWeek} kg / week`, col: "#f59e0b", icon: "trending-up-outline"   };
}

// ─────────────────────────────────────────────────────────────────────────────
// GOAL OPTIONS  (replaces the Picker — each has its own card with explanation)
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  {
    value: "lose_fast",
    label: "Lose Fat — Aggressive",
    icon: "flame-outline",
    color: "#ef4444",
    calAdj: -500,
    badge: "−500 kcal/day",
    desc: "A 500 kcal/day deficit is the clinical maximum recommended for safe fat loss. Expect to drop ~0.5 kg per week.",
    tip: "Best for: significantly overweight. High protein (≥2g/kg) is essential to protect muscle during a steep deficit.",
  },
  {
    value: "lose",
    label: "Lose Fat — Steady",
    icon: "trending-down-outline",
    color: "#0ea5e9",
    calAdj: -300,
    badge: "−300 kcal/day",
    desc: "300 kcal/day deficit — sustainable and muscle-preserving. ~0.3 kg loss per week, easier to maintain long-term.",
    tip: "Best for: most people cutting. Low hunger, minimal energy impact, and very effective over 3–6 months.",
  },
  {
    value: "recomp",
    label: "Recomposition",
    icon: "swap-horizontal-outline",
    color: "#8b5cf6",
    calAdj: -100,
    badge: "≈ Maintenance",
    desc: "Near-maintenance calories. Gradually lose fat while building muscle simultaneously — a slower but powerful strategy.",
    tip: "Best for: skinny fat or beginners. Demands high protein (2.4g/kg) and consistent resistance training.",
  },
  {
    value: "maintain",
    label: "Maintain Weight",
    icon: "remove-circle-outline",
    color: "#22c55e",
    calAdj: 0,
    badge: "TDEE",
    desc: "Eat exactly at your maintenance (TDEE). Focus on performance, health, and body composition without major weight change.",
    tip: "Best for: athletes in-season, already at a healthy weight, or taking a diet break between cuts/bulks.",
  },
  {
    value: "gain",
    label: "Lean Bulk",
    icon: "trending-up-outline",
    color: "#f59e0b",
    calAdj: 250,
    badge: "+250 kcal/day",
    desc: "A modest 250 kcal/day surplus prioritises muscle gain while keeping fat gain minimal. Slow, quality mass.",
    tip: "Best for: most people building muscle. Expect 0.5–1 kg per month. Ideal 3–6 month bulk phase.",
  },
  {
    value: "gain_fast",
    label: "Aggressive Bulk",
    icon: "barbell-outline",
    color: "#f97316",
    calAdj: 500,
    badge: "+500 kcal/day",
    desc: "500 kcal/day surplus maximises muscle and strength gain speed. Some fat gain is expected alongside muscle.",
    tip: "Best for: ectomorphs, hardgainers, or off-season athletes prioritising maximum size. Limit to 3–4 months.",
  },
];

// Body-type pair → suggested goal value
function suggestGoal(cur, ideal) {
  const isFat  = ["overweight", "endomorph"].includes(cur);
  const isThin = cur === "ectomorph";
  const isSF   = cur === "skinny_fat";
  const wantsSize = ["muscular_ideal", "athletic_ideal"].includes(ideal);
  const wantsLean = ["lean", "slim", "healthy"].includes(ideal);
  if (isFat  && wantsLean)  return "lose";
  if (isFat)                return "lose";
  if (isThin && wantsSize)  return "gain";
  if (isSF)                 return "recomp";
  if (wantsSize)            return "gain";
  if (wantsLean)            return "lose";
  return "maintain";
}

// Protein multiplier (g/kg)
function protMult(cur, ideal) {
  if (cur === "skinny_fat")              return 2.4;
  if (ideal === "muscular_ideal")        return 2.2;
  if (ideal === "athletic_ideal")        return 2.0;
  return 1.8;
}

function deriveTargets({ weightKg, tdee, curBT, idealBT, goalValue }) {
  const w = Number(weightKg), c = Number(tdee);
  if (!Number.isFinite(w) || !Number.isFinite(c) || w <= 0 || c <= 0)
    return { calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30, waterMl: 2500 };
  const opt    = GOAL_OPTIONS.find(g => g.value === goalValue);
  const calAdj = opt ? opt.calAdj : 0;
  const tgt    = Math.max(1200, Math.round(c + calAdj));
  const prot   = Math.round(w * protMult(curBT, idealBT));
  const fat    = Math.round((tgt * 0.25) / 9);
  const carbs  = Math.max(0, Math.round((tgt - prot * 4 - fat * 9) / 4));
  const fiber  = Math.max(20, Math.min(45, Math.round(carbs * 0.06 + 20)));
  const waterMl = Math.round(Math.min(4000, Math.max(2000, w * 35)));
  return { calories: tgt, protein: prot, carbs, fat, fiber, waterMl };
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY TYPE DATA
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_BODY_TYPES = [
  { key: "ectomorph",   label: "Ectomorph",          tag: "Naturally Thin",
    desc: "Fast metabolism, struggles to gain weight or muscle. Narrow shoulders and hips, low body fat but also very little muscle mass.",
    guidance: "Eat in a calorie surplus with high carbs and protein. Prioritise heavy compound lifts to build size." },
  { key: "skinny_fat",  label: "Skinny Fat",          tag: "Thin but Soft",
    desc: "Appears slim or even underweight, but carries a higher body fat percentage with little visible muscle. Often feels 'soft' or 'untoned'.",
    guidance: "A recomposition strategy (maintenance calories + high protein + resistance training) works best." },
  { key: "average",     label: "Average / Mesomorph", tag: "Balanced Build",
    desc: "Medium frame with typical proportions. Responds well to training changes and dietary adjustments. Good baseline to work from.",
    guidance: "You're well positioned to go in any direction. Define your goal and be consistent." },
  { key: "athletic",    label: "Athletic",            tag: "Active & Toned",
    desc: "Regularly active with visible muscle tone and a lower body fat percentage. Good cardiovascular fitness.",
    guidance: "Fine-tune your nutrition to the next level — consider cutting, bulking, or improving performance." },
  { key: "muscular",    label: "Muscular",            tag: "Well Built",
    desc: "Significant muscle mass from consistent resistance training. May be at a higher weight due to muscle.",
    guidance: "A cut phase to reduce body fat will reveal the muscle you've already built." },
  { key: "overweight",  label: "Overweight",          tag: "Excess Body Fat",
    desc: "Carrying excess body fat that impacts energy, mobility, and health markers. Looking to make a significant change.",
    guidance: "A consistent calorie deficit (300–500 kcal) with high protein and resistance training will transform your body." },
  { key: "endomorph",   label: "Endomorph",           tag: "Larger Frame",
    desc: "Naturally rounder, larger build with a slower metabolism. Gains fat more easily, especially around the midsection.",
    guidance: "A moderate deficit (300 kcal) with strength training and reduced refined carbs works best for your type." },
];

const IDEAL_BODY_TYPES = [
  { key: "lean",          label: "Lean & Toned",      tag: "Defined & Light",
    desc: "Low body fat with visible muscle definition throughout. Slim but strong — similar to a swimmer, runner or gymnast.",
    macro: "Moderate calorie deficit, high protein (2g/kg), moderate carbs, low fat." },
  { key: "athletic_ideal", label: "Athletic",          tag: "Fit & Functional",
    desc: "Balanced muscle mass and cardiovascular endurance. Looks and performs like a natural all-round athlete.",
    macro: "Maintenance to slight surplus, even protein/carb/fat split." },
  { key: "muscular_ideal", label: "Muscular & Strong", tag: "Built & Powerful",
    desc: "Significant muscle mass with a powerful, well-built frame. Think bodybuilder, powerlifter, or strength athlete.",
    macro: "Calorie surplus, very high protein (2.2g/kg), high carbs for performance." },
  { key: "slim",           label: "Slim",              tag: "Lighter Frame",
    desc: "Simply lighter and slimmer overall — not focused on building muscle, just a leaner, lighter physique.",
    macro: "Moderate calorie deficit, balanced macros." },
  { key: "healthy",        label: "Healthy Weight",    tag: "Balanced BMI",
    desc: "Primary goal is reaching and maintaining a healthy BMI with more energy and better health markers. No specific aesthetic required.",
    macro: "Moderate deficit to reach healthy BMI, then move to maintenance." },
];

// ─────────────────────────────────────────────────────────────────────────────
// SVG BODY SILHOUETTE  (all arms now precisely symmetric)
// Canvas 76 × 144, cx = 38
// ─────────────────────────────────────────────────────────────────────────────

const FIGURE_PARAMS = {
  // Each row: [shoulderHalfW, waistHalfW, hipHalfW, bellyHalfW, armW, legW]
  // For belly types (belly > sw), sw must be close enough to belly that the arm
  // (positioned at sl = cx-sw) visibly sticks out past the shoulder edge.
  // Rule of thumb: sw ≈ belly × 0.78 keeps the belly visually wider while
  // ensuring the arm protrudes enough to not be covered at shoulder level.
  //                sw    ww   hw  belly  armW  legW
  ectomorph:     [ 11,   8,  10,   8,   3.5,  4.0 ],
  skinny_fat:    [ 13,  13,  13,  16,   4.0,  5.5 ],  // wider shoulders → arms clear the belly
  average:       [ 17,  12,  14,  11,   5.0,  6.5 ],
  athletic:      [ 22,  12,  14,  11,   6.5,  7.5 ],
  muscular:      [ 27,  15,  16,  14,   8.5,  9.0 ],
  overweight:    [ 21,  22,  23,  27,   7.0, 10.0 ],  // wider shoulders → arms visible at shoulder level
  endomorph:     [ 19,  21,  27,  24,   7.0, 11.0 ],  // same — pear shape but arms no longer hidden
  lean:          [ 13,   9,  11,   9,   4.0,  5.0 ],
  athletic_ideal:[ 21,  11,  13,  10,   5.5,  7.0 ],
  muscular_ideal:[ 26,  14,  15,  13,   8.0,  8.5 ],
  slim:          [  9,   7,   8,   7,   3.0,  3.5 ],
  healthy:       [ 16,  12,  13,  10,   4.5,  6.0 ],
};

function BodyFigure({ type, primaryColor, size = 1 }) {
  const W = 76, H = 144, cx = 38;
  const [sw, ww, hw, belly, armW, legW] = FIGURE_PARAMS[type] || FIGURE_PARAMS.average;

  const HEAD_CY = 11, HEAD_R = 10;
  const NECK_TOP = 21, NECK_BOT = 28, NECK_HW = 4.5;
  const SHOULDER_Y = 35, BELLY_Y = 64, HIP_Y = 78;
  const CROTCH_Y = 88, ANKLE_Y = 135, ARM_BOT = 79;

  const sl = cx - sw, sr = cx + sw;
  const hl = cx - hw, hr = cx + hw;
  const hasBelly = belly > sw;
  const lMid = hasBelly ? cx - belly : cx - ww;
  const rMid = hasBelly ? cx + belly : cx + ww;

  // Legs — symmetric, centred under hips
  const LG = 2.5;
  const llO = cx - LG - legW, llI = cx - LG;
  const rlI = cx + LG,        rlO = cx + LG + legW;

  // Arms — symmetric offsets from shoulder edges
  // Left arm:  outer = sl - armW - 1,  inner = sl - 1
  // Right arm: inner = sr + 1,         outer = sr + armW + 1
  // Both drawn with IDENTICAL bezier control offsets so they mirror exactly
  const ALO = sl - armW - 1, ALI = sl - 1;
  const ARI = sr + 1,        ARO = sr + armW + 1;
  const ARM_CTRL = 20; // bezier bow — same for both arms

  const gradId = `g${type}`;

  // ── Torso + legs path ───────────────────────────────────────────────────────
  const body = [
    `M ${cx - NECK_HW} ${NECK_TOP}`,
    `L ${cx - NECK_HW} ${NECK_BOT}`,
    `C ${sl - 1} ${NECK_BOT + 5} ${sl} ${SHOULDER_Y - 3} ${sl} ${SHOULDER_Y}`,
    `C ${lMid - 1} ${SHOULDER_Y + 14} ${lMid} ${BELLY_Y - 5} ${lMid} ${BELLY_Y}`,
    `C ${lMid} ${BELLY_Y + 6} ${hl - 1} ${HIP_Y - 4} ${hl} ${HIP_Y}`,
    `L ${llO} ${CROTCH_Y} L ${llO} ${ANKLE_Y} L ${llI} ${ANKLE_Y} L ${llI} ${CROTCH_Y}`,
    `L ${rlI} ${CROTCH_Y} L ${rlI} ${ANKLE_Y} L ${rlO} ${ANKLE_Y} L ${rlO} ${CROTCH_Y}`,
    `L ${hr} ${HIP_Y}`,
    `C ${hr + 1} ${HIP_Y - 4} ${rMid} ${BELLY_Y + 6} ${rMid} ${BELLY_Y}`,
    `C ${rMid} ${BELLY_Y - 5} ${sr + 1} ${SHOULDER_Y + 14} ${sr} ${SHOULDER_Y}`,
    `C ${sr} ${SHOULDER_Y - 3} ${cx + NECK_HW + 1} ${NECK_BOT + 5} ${cx + NECK_HW} ${NECK_BOT}`,
    `L ${cx + NECK_HW} ${NECK_TOP} Z`,
  ].join(" ");

  // ── Left arm — straight bezier (symmetric template) ─────────────────────────
  // outer edge bows LEFT by 1px; inner edge bows RIGHT by 1px
  const leftArm = [
    `M ${ALO} ${SHOULDER_Y}`,
    `C ${ALO - 1} ${SHOULDER_Y + ARM_CTRL} ${ALO - 1} ${ARM_BOT - 6} ${ALO} ${ARM_BOT}`,
    `L ${ALI} ${ARM_BOT}`,
    `C ${ALI + 1} ${ARM_BOT - 6} ${ALI + 1} ${SHOULDER_Y + ARM_CTRL} ${ALI} ${SHOULDER_Y}`,
    `Z`,
  ].join(" ");

  // ── Right arm — exact mirror of left arm ──────────────────────────────────
  // outer edge bows RIGHT by 1px; inner edge bows LEFT by 1px
  const rightArm = [
    `M ${ARI} ${SHOULDER_Y}`,
    `C ${ARI - 1} ${SHOULDER_Y + ARM_CTRL} ${ARI - 1} ${ARM_BOT - 6} ${ARI} ${ARM_BOT}`,
    `L ${ARO} ${ARM_BOT}`,
    `C ${ARO + 1} ${ARM_BOT - 6} ${ARO + 1} ${SHOULDER_Y + ARM_CTRL} ${ARO} ${SHOULDER_Y}`,
    `Z`,
  ].join(" ");

  return (
    <Svg width={W * size} height={H * size} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor={primaryColor} stopOpacity="1"    />
          <Stop offset="0.55" stopColor={primaryColor} stopOpacity="0.9"  />
          <Stop offset="1"   stopColor={primaryColor} stopOpacity="0.65" />
        </LinearGradient>
      </Defs>
      {/* Arms rendered FIRST so the body covers any overlap at the belly/hip zone.
          For belly types (skinny_fat, overweight, endomorph) the torso path
          naturally covers the lower arm region, making arms appear behind the body — correct. */}
      <Path d={leftArm}  fill={`url(#${gradId})`} />
      <Path d={rightArm} fill={`url(#${gradId})`} />
      <Path d={body}     fill={`url(#${gradId})`} />
      {/* Head on top of everything */}
      <Circle cx={cx} cy={HEAD_CY} r={HEAD_R} fill={`url(#${gradId})`} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY TYPE CAROUSEL  — one full card per type, swipeable + arrow navigation
// ─────────────────────────────────────────────────────────────────────────────

function BodyTypeCarousel({ types, selected, onSelect, colors, accentColor }) {
  const scrollRef = useRef(null);
  const [cardW, setCardW]   = useState(0);
  const accent = accentColor || colors.primary || "#0b84ff";

  const selectedIdx = Math.max(0, types.findIndex(t => t.key === selected));

  function scrollTo(idx) {
    const clamped = Math.max(0, Math.min(types.length - 1, idx));
    scrollRef.current?.scrollTo({ x: clamped * cardW, animated: true });
    onSelect(types[clamped].key);
  }

  function onMomentumEnd(e) {
    if (!cardW) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardW);
    const clamped = Math.max(0, Math.min(types.length - 1, idx));
    onSelect(types[clamped].key);
  }

  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < types.length - 1;

  return (
    <View style={car.root}>
      {/* Scrollable cards */}
      <View
        style={car.viewport}
        onLayout={e => setCardW(e.nativeEvent.layout.width)}
      >
        {cardW > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            decelerationRate="fast"
            bounces={false}
          >
            {types.map((bt, i) => {
              const isSel = selected === bt.key;
              const figCol = isSel ? accent : "#b0bec5";
              return (
                <View key={bt.key} style={{ width: cardW, padding: 4 }}>
                  <TouchableOpacity
                    style={[
                      car.card,
                      {
                        backgroundColor: isSel ? accent + "10" : colors.background,
                        borderColor: isSel ? accent : colors.border,
                        borderWidth: isSel ? 2 : 1.5,
                      },
                    ]}
                    onPress={() => scrollTo(i)}
                    activeOpacity={0.9}
                  >
                    {/* Selected tick */}
                    {isSel && (
                      <View style={[car.tick, { backgroundColor: accent }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}

                    {/* Figure — large and centred */}
                    <View style={car.figBox}>
                      <BodyFigure type={bt.key} primaryColor={figCol} size={1.3} />
                    </View>

                    {/* Name */}
                    <Text style={[car.name, { color: isSel ? accent : colors.text }]}>
                      {bt.label}
                    </Text>

                    {/* Tag badge */}
                    <View style={[car.tagBadge, { backgroundColor: isSel ? accent : colors.border }]}>
                      <Text style={[car.tagText, { color: isSel ? "#fff" : colors.textSecondary }]}>
                        {bt.tag}
                      </Text>
                    </View>

                    {/* Description */}
                    <Text style={[car.desc, { color: colors.textSecondary }]}>
                      {bt.desc}
                    </Text>

                    {/* Guidance / macro tip */}
                    {(bt.guidance || bt.macro) && (
                      <View style={[car.tip, { backgroundColor: accent + "0e", borderColor: accent + "30" }]}>
                        <Ionicons name="bulb-outline" size={14} color={accent} />
                        <Text style={[car.tipText, { color: colors.text }]}>
                          {bt.guidance || bt.macro}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Navigation row: ← dots → */}
      <View style={car.navRow}>
        <TouchableOpacity
          onPress={() => scrollTo(selectedIdx - 1)}
          disabled={!hasPrev}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[car.arrow, { opacity: hasPrev ? 1 : 0.25, backgroundColor: accent + "18" }]}
        >
          <Ionicons name="chevron-back" size={20} color={accent} />
        </TouchableOpacity>

        {/* Pagination dots */}
        <View style={car.dots}>
          {types.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollTo(i)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <View style={[
                car.dot,
                {
                  backgroundColor: selectedIdx === i ? accent : colors.border,
                  width: selectedIdx === i ? 18 : 7,
                },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => scrollTo(selectedIdx + 1)}
          disabled={!hasNext}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[car.arrow, { opacity: hasNext ? 1 : 0.25, backgroundColor: accent + "18" }]}
        >
          <Ionicons name="chevron-forward" size={20} color={accent} />
        </TouchableOpacity>
      </View>

      {/* Counter */}
      <Text style={[car.counter, { color: colors.textLight }]}>
        {selectedIdx + 1} / {types.length} — swipe or use arrows
      </Text>
    </View>
  );
}

const car = StyleSheet.create({
  root:     { gap: 10 },
  viewport: { overflow: "hidden" },
  card: {
    borderRadius: 20, padding: 20, alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    position: "relative",
  },
  tick: {
    position: "absolute", top: 12, right: 12,
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  figBox:   { height: 188, justifyContent: "center", alignItems: "center" },
  name:     { fontSize: 20, fontWeight: "800", textAlign: "center" },
  tagBadge: { borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5 },
  tagText:  { fontSize: 12, fontWeight: "700", textAlign: "center" },
  desc:     { fontSize: 13, lineHeight: 20, textAlign: "center" },
  tip: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, alignSelf: "stretch",
  },
  tipText:  { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  navRow:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  arrow: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, justifyContent: "center" },
  dot:  { height: 7, borderRadius: 3.5 },
  counter: { textAlign: "center", fontSize: 11, fontWeight: "600" },
});

// ─────────────────────────────────────────────────────────────────────────────
// GOAL SELECTOR  (replaces the broken Picker — full explanation cards)
// ─────────────────────────────────────────────────────────────────────────────

// Produces a human-readable reason for why a goal is recommended based on body types
function recReasonText(curBT, idealBT, goalValue) {
  const curLabel   = CURRENT_BODY_TYPES.find(x => x.key === curBT)?.label   || "your current physique";
  const idealLabel = IDEAL_BODY_TYPES.find(x  => x.key === idealBT)?.label  || "your goal physique";
  switch (goalValue) {
    case "lose_fast":
      return `Your ${curLabel} body carries excess fat — an aggressive 500 kcal deficit accelerates fat loss quickly while still allowing recovery.`;
    case "lose":
      return `Going from ${curLabel} to ${idealLabel} works best with a steady cut. It preserves muscle while losing fat at a sustainable pace.`;
    case "recomp":
      return `Skinny Fat means low muscle + higher fat. Recomposition (near-maintenance + high protein + lifting) changes both at the same time without aggressive dieting.`;
    case "gain":
      return `As an ${curLabel}, a lean bulk of +250 kcal is the most efficient way to build towards a ${idealLabel} physique without gaining excess fat.`;
    case "gain_fast":
      return `Ectomorphs have fast metabolisms and need a larger surplus to overcome resistance to weight gain and build size efficiently.`;
    case "maintain":
      return `You're already in a good position. Maintenance calories let you focus on performance and training quality without dramatic weight changes.`;
    default:
      return `Based on your ${curLabel} body type and ${idealLabel} goal, this is the most appropriate strategy.`;
  }
}

// Single goal option card — extracted for reuse in both recommended + list sections
function GoalCard({ opt, sel, isRec, onChange, tdee, colors }) {
  const projected = tdee ? tdee + opt.calAdj : null;
  const chg       = projected ? weeklyChange(tdee, projected) : null;
  return (
    <TouchableOpacity
      style={[
        gs.card,
        {
          backgroundColor: sel ? opt.color + "0f" : colors.background,
          borderColor:     sel ? opt.color : (isRec ? opt.color + "50" : colors.border),
          borderWidth:     sel ? 2 : (isRec ? 1.5 : 1.5),
        },
      ]}
      onPress={() => onChange(opt.value)}
      activeOpacity={0.82}
    >
      <View style={gs.header}>
        <View style={[gs.iconBox, { backgroundColor: opt.color + "20" }]}>
          <Ionicons name={opt.icon} size={18} color={opt.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[gs.label, { color: sel ? opt.color : colors.text }]}>{opt.label}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <View style={[gs.badge, { backgroundColor: opt.color + "20" }]}>
              <Text style={[gs.badgeText, { color: opt.color }]}>{opt.badge}</Text>
            </View>
            {chg && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name={chg.icon} size={12} color={chg.col} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: chg.col }}>{chg.text}</Text>
              </View>
            )}
          </View>
        </View>
        {sel
          ? <Ionicons name="checkmark-circle" size={22} color={opt.color} />
          : <View style={[gs.radio, { borderColor: colors.border }]} />
        }
      </View>
      <Text style={[gs.desc, { color: colors.textSecondary }]}>{opt.desc}</Text>
      <View style={[gs.tip, { backgroundColor: opt.color + "08", borderColor: opt.color + "20" }]}>
        <Ionicons name="person-circle-outline" size={13} color={opt.color} />
        <Text style={[gs.tipText, { color: colors.textSecondary }]}>
          <Text style={{ fontWeight: "700" }}>Best for: </Text>
          {opt.tip.replace(/^Best for: /, "")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function GoalSelector({ value, onChange, tdee, colors, curBT, idealBT }) {
  const recValue = suggestGoal(curBT, idealBT);
  const recOpt   = GOAL_OPTIONS.find(g => g.value === recValue);
  const others   = GOAL_OPTIONS.filter(g => g.value !== recValue);

  return (
    <View style={{ gap: 10 }}>

      {/* ── RECOMMENDED ─────────────────────────────────────────────────── */}
      {recOpt && (
        <View style={{ gap: 6 }}>
          {/* Recommendation banner */}
          <View style={[gs.recBanner, { backgroundColor: "#22c55e12", borderColor: "#22c55e40" }]}>
            <View style={[gs.recIconBox, { backgroundColor: "#22c55e20" }]}>
              <Ionicons name="sparkles" size={16} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={gs.recTitle}>⭐ Recommended for you</Text>
              <Text style={[gs.recReason, { color: colors.textSecondary }]}>
                {recReasonText(curBT, idealBT, recValue)}
              </Text>
            </View>
          </View>
          {/* The recommended card — with a glowing tinted ring */}
          <GoalCard opt={recOpt} sel={value === recOpt.value} isRec onChange={onChange} tdee={tdee} colors={colors} />
        </View>
      )}

      {/* ── DIVIDER ──────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textLight }}>All options</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      {/* ── OTHER OPTIONS ────────────────────────────────────────────────── */}
      {others.map(opt => (
        <GoalCard key={opt.value} opt={opt} sel={value === opt.value} onChange={onChange} tdee={tdee} colors={colors} />
      ))}
    </View>
  );
}

const gs = StyleSheet.create({
  card:     { borderRadius: 14, padding: 14, gap: 8 },
  header:   { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox:  { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  label:    { fontSize: 14, fontWeight: "800" },
  badge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:{ fontSize: 11, fontWeight: "700" },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, marginTop: 2 },
  desc:     { fontSize: 12, lineHeight: 18 },
  tip:      { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 8, borderWidth: 1, padding: 9 },
  tipText:  { flex: 1, fontSize: 11, lineHeight: 17 },
  // Recommended section
  recBanner:  { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 12 },
  recIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 1 },
  recTitle:   { fontSize: 13, fontWeight: "800", color: "#15803d", marginBottom: 3 },
  recReason:  { fontSize: 12, lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SOMATOTYPE GUIDE (expandable)
// ─────────────────────────────────────────────────────────────────────────────

const SOMA = [
  { name: "Ectomorph", color: "#0ea5e9", icon: "🪶",
    summary: "Naturally thin and lean, fast metabolism, struggles to gain weight or muscle.",
    howTo: "You're likely an ectomorph if you've always been slim, eat a lot without gaining, have narrow shoulders and hips, and find building muscle difficult." },
  { name: "Mesomorph", color: "#22c55e", icon: "🧍",
    summary: "Medium athletic build. Responds well to training and diet changes.",
    howTo: "You're likely a mesomorph if your weight is fairly stable, you gain muscle reasonably quickly, and have a naturally athletic, balanced shape." },
  { name: "Endomorph", color: "#f59e0b", icon: "🔵",
    summary: "Naturally larger, rounder build with a slower metabolism. Gains fat easily.",
    howTo: "You're likely an endomorph if you gain weight quickly even with modest eating, struggle to lose fat, and carry most weight in your stomach and hips." },
];

function SomatotypeGuide({ colors }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[sg.wrap, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
      <TouchableOpacity style={sg.header} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <View style={sg.iconCircle}>
          <Ionicons name="help-circle-outline" size={18} color="#0ea5e9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sg.title}>Not sure which type fits you?</Text>
          <Text style={sg.sub}>Tap to read the somatotype guide</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#0ea5e9" />
      </TouchableOpacity>
      {open && (
        <View style={sg.body}>
          <Text style={sg.intro}>
            Somatotypes describe your naturally inherited body shape and metabolism. Most people are a blend — pick the one that sounds most like you.
          </Text>
          {SOMA.map(t => (
            <View key={t.name} style={[sg.card, { borderLeftColor: t.color, backgroundColor: t.color + "0c" }]}>
              <Text style={[sg.cardTitle, { color: t.color }]}>{t.icon}  {t.name}</Text>
              <Text style={[sg.cardSummary, { color: colors.text }]}>{t.summary}</Text>
              <View style={sg.divider} />
              <View style={sg.row}>
                <Ionicons name="checkmark-circle-outline" size={13} color={t.color} />
                <Text style={[sg.howTo, { color: colors.textSecondary }]}>
                  <Text style={{ fontWeight: "700" }}>How to identify: </Text>{t.howTo}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const sg = StyleSheet.create({
  wrap:       { borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  header:     { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#0ea5e920", alignItems: "center", justifyContent: "center" },
  title:      { fontSize: 13, fontWeight: "700", color: "#1e40af" },
  sub:        { fontSize: 11, color: "#3b82f6", marginTop: 1 },
  body:       { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  intro:      { fontSize: 12, lineHeight: 18, color: "#475569" },
  card:       { borderLeftWidth: 3, borderRadius: 8, padding: 10, gap: 5 },
  cardTitle:  { fontSize: 13, fontWeight: "800" },
  cardSummary:{ fontSize: 12, lineHeight: 18 },
  divider:    { height: 1, backgroundColor: "#e2e8f0" },
  row:        { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  howTo:      { flex: 1, fontSize: 11, lineHeight: 17 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UTILITY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function BMICard({ bmi, heightCm, colors }) {
  if (!bmi) return null;
  const cat   = bmiCategory(bmi);
  const range = healthyRange(heightCm);
  return (
    <View style={[bmiS.wrap, { backgroundColor: cat.color + "12", borderColor: cat.color + "30" }]}>
      <View style={bmiS.row}>
        <View>
          <Text style={[bmiS.val, { color: cat.color }]}>{round1(bmi)}</Text>
          <Text style={bmiS.sub}>BMI</Text>
        </View>
        <View>
          <View style={[bmiS.badge, { backgroundColor: cat.color }]}>
            <Text style={bmiS.badgeText}>{cat.label}</Text>
          </View>
          {range && <Text style={[bmiS.range, { color: colors.textSecondary }]}>Healthy: {range.lo}–{range.hi} kg</Text>}
        </View>
      </View>
    </View>
  );
}
const bmiS = StyleSheet.create({
  wrap:      { borderRadius: 12, borderWidth: 1.5, padding: 12 },
  row:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  val:       { fontSize: 28, fontWeight: "900" },
  sub:       { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  badge:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  badgeText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  range:     { fontSize: 11, marginTop: 4 },
});

function MacroBar({ protein, carbs, fat, fiber, colors }) {
  // Fibre is a carbohydrate so we split carbs → net carbs + fibre for clarity.
  // Caloric contributions: protein 4 kcal/g, net carbs 4 kcal/g,
  // fibre ~2 kcal/g (partially fermented), fat 9 kcal/g.
  const pG    = Math.max(0, Number(protein));
  const fibG  = Math.max(0, Number(fiber));
  const carbG = Math.max(0, Number(carbs));
  const ncG   = Math.max(0, carbG - fibG);   // net carbs
  const fG    = Math.max(0, Number(fat));

  const pC   = pG   * 4;
  const ncC  = ncG  * 4;
  const fibC = fibG * 2;  // partial digestion
  const fC   = fG   * 9;
  const sum  = pC + ncC + fibC + fC;
  if (!sum) return null;

  const pp   = Math.round((pC   / sum) * 100);
  const ncp  = Math.round((ncC  / sum) * 100);
  const fibp = Math.round((fibC / sum) * 100);
  const fp   = Math.max(0, 100 - pp - ncp - fibp);

  const SEGMENTS = [
    { lbl: "Protein",    pct: pp,   col: "#6366f1" },
    { lbl: "Net Carbs",  pct: ncp,  col: "#f59e0b" },
    { lbl: "Fibre",      pct: fibp, col: "#06b6d4" },
    { lbl: "Fat",        pct: fp,   col: "#22c55e" },
  ];

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>Macro split (kcal)</Text>
      {/* Segmented bar */}
      <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" }}>
        {SEGMENTS.map(({ lbl, pct, col }) =>
          pct > 0 ? <View key={lbl} style={{ flex: pct, backgroundColor: col }} /> : null
        )}
      </View>
      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {SEGMENTS.map(({ lbl, pct, col }) => (
          <View key={lbl} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>
              {lbl} {pct}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StepHeader({ title, subtitle, icon, color }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (color || "#0b84ff") + "18", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={color || "#0b84ff"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: font.lg, fontWeight: "800", color: "#0f172a" }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: font.sm, color: "#64748b", marginTop: 2, lineHeight: 18 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const ACTIVITY_OPTS = [
  { value: "low",      label: "Sedentary",   icon: "laptop-outline",  desc: "Desk job, little or no planned exercise" },
  { value: "moderate", label: "Moderate",    icon: "walk-outline",    desc: "Exercise 3–5× per week or active job" },
  { value: "high",     label: "Very Active", icon: "barbell-outline", desc: "Hard training 6–7× / week or labour job" },
];
const EXPERIENCE_OPTS = [
  { value: "beginner",     label: "Beginner",     icon: "leaf-outline",    desc: "Less than 1 year of consistent training" },
  { value: "intermediate", label: "Intermediate", icon: "fitness-outline", desc: "1–3 years of consistent training" },
  { value: "advanced",     label: "Advanced",     icon: "trophy-outline",  desc: "3+ years of serious, structured training" },
];

function OptionCards({ options, value, onChange, colors }) {
  return (
    <View style={{ gap: 8 }}>
      {options.map(opt => {
        const sel = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              oc.card,
              {
                backgroundColor: sel ? (colors.primary + "12") : colors.background,
                borderColor: sel ? colors.primary : colors.border,
                borderWidth: sel ? 2 : 1.5,
              },
            ]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <View style={[oc.ico, { backgroundColor: sel ? (colors.primary + "20") : colors.border + "60" }]}>
              <Ionicons name={opt.icon} size={18} color={sel ? colors.primary : colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[oc.lbl, { color: sel ? colors.primary : colors.text }]}>{opt.label}</Text>
              <Text style={[oc.desc, { color: colors.textSecondary }]}>{opt.desc}</Text>
            </View>
            {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const oc = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  ico:  { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  lbl:  { fontSize: 13, fontWeight: "700" },
  desc: { fontSize: 11, lineHeight: 16, marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL = 7;

const VISIBILITY_OPTS = [
  {
    value: "public",
    label: "Public",
    icon: "earth-outline",
    desc: "Anyone on Smart Food & Fitness can view your profile and activity.",
  },
  {
    value: "friends",
    label: "Friends Only",
    icon: "people-outline",
    desc: "Only people you've accepted as friends can see your profile.",
  },
  {
    value: "private",
    label: "Private",
    icon: "lock-closed-outline",
    desc: "Your profile is hidden from everyone. Nothing is shared.",
  },
];

export default function OnboardingScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth, setAuth, logout } = useAuth();
  const userId = auth?.userId ?? null;

  const [step, setStep] = useState(1);

  const [age,             setAge]             = useState("");
  const [gender,          setGender]          = useState("");
  const [activityLevel,   setActivityLevel]   = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  const [heightUnit,   setHeightUnit]   = useState("ft");
  const [heightFt,     setHeightFt]     = useState("");
  const [heightIn,     setHeightIn]     = useState("");
  const [heightM,      setHeightM]      = useState("");
  const [heightCmPart, setHeightCmPart] = useState("");
  const [weightValue,  setWeightValue]  = useState("");
  const [weightUnit,   setWeightUnit]   = useState("kg");

  const [currentBodyType, setCurrentBodyType] = useState("");
  const [idealBodyType,   setIdealBodyType]   = useState("");

  const [goal,        setGoal]        = useState("maintain");
  const [calorieGoal, setCalorieGoal] = useState("2000");
  const [proteinGoal, setProteinGoal] = useState("150");
  const [carbGoal,    setCarbGoal]    = useState("200");
  const [fatGoal,     setFatGoal]     = useState("60");
  const [fiberGoal,   setFiberGoal]   = useState("30");
  const [waterGoal,   setWaterGoal]   = useState("2500");
  const [showAdv,     setShowAdv]     = useState(false);
  const [tdeeCache,   setTdeeCache]   = useState(null);

  const [aims,               setAims]               = useState([]);
  const [aimCat,             setAimCat]             = useState(AIM_CATEGORIES[0].key);
  const [profileVisibility,  setProfileVisibility]  = useState("friends");
  const [shareWeight,        setShareWeight]        = useState(true);
  const [shareActivity,      setShareActivity]      = useState(true);
  const [loading,            setLoading]            = useState(false);
  const [err,                setErr]                = useState("");

  // ── Parsed measurements ──────────────────────────────────────────────────────
  const parsed = useMemo(() => {
    const a  = toNum(age);
    const wv = toNum(weightValue);
    let heightCm = null;
    if (heightUnit === "ft") {
      const ft = toNum(heightFt), inch = toNum(heightIn);
      if (ft != null && inch != null) heightCm = ft * 30.48 + inch * 2.54;
    } else {
      const m = toNum(heightM), cm = toNum(heightCmPart);
      if (m != null && cm != null) heightCm = m * 100 + cm;
    }
    let weightKg = wv == null ? null : (weightUnit === "lbs" ? lbsToKg(wv) : wv);
    return { a, wv, heightCm, weightKg };
  }, [age, weightValue, weightUnit, heightUnit, heightFt, heightIn, heightM, heightCmPart]);

  const liveBMI = useMemo(() => calcBMI(parsed.weightKg, parsed.heightCm), [parsed]);

  // ── Unit converters ──────────────────────────────────────────────────────────
  function changeHeightUnit(u) {
    if (u === heightUnit) return;
    if (u === "m") {
      const ft = toNum(heightFt), inch = toNum(heightIn);
      if (ft != null && inch != null) {
        const cm = ft * 30.48 + inch * 2.54;
        setHeightM(String(Math.floor(cm / 100)));
        setHeightCmPart(String(Math.round(cm % 100)));
      }
    } else {
      const m = toNum(heightM), cm = toNum(heightCmPart);
      if (m != null && cm != null) {
        const inches = (m * 100 + cm) / 2.54;
        setHeightFt(String(Math.floor(inches / 12)));
        setHeightIn(String(Math.round(inches % 12)));
      }
    }
    setHeightUnit(u);
  }
  function changeWeightUnit(u) {
    if (u === weightUnit) return;
    const v = toNum(weightValue);
    if (v != null) setWeightValue(String(round1(u === "lbs" ? v * 2.20462 : v / 2.20462)));
    setWeightUnit(u);
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function v1() {
    const a = parsed.a;
    if (a == null)         return "Please enter your age.";
    if (a < 13 || a > 100) return "Age must be between 13 and 100.";
    if (!gender)           return "Please select your biological sex.";
    if (!activityLevel)    return "Please select your activity level.";
    if (!experienceLevel)  return "Please select your experience level.";
    return "";
  }
  function v2() {
    const hc = parsed.heightCm;
    if (hc == null || hc < 60 || hc > 275) return "Please enter a realistic height.";
    const wv = parsed.wv;
    if (wv == null) return "Please enter your weight.";
    if (weightUnit === "kg"  && (wv < 30 || wv > 300)) return "Please enter a realistic weight (30–300 kg).";
    if (weightUnit === "lbs" && (wv < 66 || wv > 660)) return "Please enter a realistic weight (66–660 lbs).";
    return "";
  }

  // ── Auto-calculate targets ───────────────────────────────────────────────────
  const calcTargets = useCallback((overrideGoal) => {
    const sex = gender?.toLowerCase();
    const { a, heightCm, weightKg } = parsed;
    if (!sex || a == null || heightCm == null || weightKg == null) return;
    const bmr = mifflinBMR({ sex, age: a, heightCm, weightKg });
    if (!bmr) return;
    const tdee = bmr * activityMult(activityLevel);
    setTdeeCache(Math.round(tdee));
    const goalToUse = overrideGoal ?? goal;
    const rec = deriveTargets({ weightKg, tdee, curBT: currentBodyType, idealBT: idealBodyType, goalValue: goalToUse });
    setCalorieGoal(String(rec.calories));
    setProteinGoal(String(rec.protein));
    setCarbGoal(String(rec.carbs));
    setFatGoal(String(rec.fat));
    setFiberGoal(String(rec.fiber));
    setWaterGoal(String(rec.waterMl));
  }, [gender, parsed, activityLevel, currentBodyType, idealBodyType, goal]);

  // Recommended aims based on body type goal
  const recAimKeys = useMemo(() => {
    const r = [];
    if (["overweight", "endomorph"].includes(currentBodyType)) r.push("weight_loss", "calorie_deficit");
    if (currentBodyType === "ectomorph")   r.push("muscle_gain", "bulking");
    if (currentBodyType === "skinny_fat")  r.push("body_recomp", "lean_muscle");
    if (idealBodyType === "muscular_ideal") r.push("muscle_gain", "strength");
    if (["lean", "slim"].includes(idealBodyType)) r.push("weight_loss", "fat_loss");
    return r;
  }, [currentBodyType, idealBodyType]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function finish() {
    const e1 = v1(); if (e1) { setErr(e1); setStep(1); return; }
    const e2 = v2(); if (e2) { setErr(e2); setStep(2); return; }
    setErr("");
    try {
      setLoading(true);
      let hv;
      const hUnit = heightUnit.toLowerCase();
      if (hUnit === "ft") hv = round1(clampInt(heightFt, 0, 20) + clampInt(heightIn, 0, 11) / 12);
      else                hv = round1(clampInt(heightM, 0, 3) + clampInt(heightCmPart, 0, 99) / 100);

      await apiClient.put(`/api/user-profile/${userId}`, {
        email: auth?.email ?? null, displayName: auth?.displayName ?? null,
        age: toNum(age), gender: gender.toLowerCase(),
        activityLevel: activityLevel.toLowerCase(), experienceLevel: experienceLevel.toLowerCase(),
        heightValue: hv, heightUnit: hUnit,
        weightValue: toNum(weightValue), weightUnit: weightUnit.toLowerCase(),
        aims: aims.map(a => a.label),
        onboardingComplete: true,
        currentBodyType: currentBodyType || null,
        idealBodyType:   idealBodyType   || null,
        profileVisibility,
        shareWeight,
        shareActivity,
      });
      try {
        await apiClient.post("/api/user-goals", {
          userId,
          calorieGoal: Math.max(1, Number(calorieGoal)),
          proteinGoal: Math.max(1, Number(proteinGoal)),
          carbGoal:    Math.max(1, Number(carbGoal)),
          fatGoal:     Math.max(1, Number(fatGoal)),
        });
      } catch (e) { if (e?.response?.status !== 409) throw e; }
      if (weightValue.trim()) {
        try {
          await apiClient.post("/api/weight-entries", {
            userId, weightValue: toNum(weightValue),
            weightUnit: weightUnit.toLowerCase(),
            recordedAt: new Date().toISOString(),
          });
        } catch (e) { if (e?.response?.status !== 409) throw e; }
      }
      setAuth({ ...auth, onboardingComplete: true });
      navigation.replace("OnboardingGuide");
    } catch (e) {
      setErr(String(e?.response?.data?.message || e?.response?.data || "Setup failed. Please try again."));
    } finally { setLoading(false); }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);
  const activeCat = AIM_CATEGORIES.find(c => c.key === aimCat);
  const selCurBT  = CURRENT_BODY_TYPES.find(x => x.key === currentBodyType);
  const selIdealBT = IDEAL_BODY_TYPES.find(x => x.key === idealBodyType);
  const changeInfo = useMemo(() => weeklyChange(tdeeCache, Number(calorieGoal)), [tdeeCache, calorieGoal]);

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back */}
          <TouchableOpacity style={s.back} onPress={logout}>
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={[s.backText, { color: colors.textSecondary }]}>Back to sign up</Text>
          </TouchableOpacity>

          <Text style={[s.brand, { color: colors.primary }]}>Smart Food & Fitness</Text>

          <View style={[s.card, { backgroundColor: colors.surface }]}>
            {/* Progress bar */}
            <View style={s.progressWrap}>
              <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[s.progressFill, { width: `${(step / TOTAL) * 100}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[s.progressLbl, { color: colors.textLight }]}>Step {step} of {TOTAL}</Text>
            </View>

            {/* Error */}
            {err ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" />
                <Text style={s.errText}>{err}</Text>
              </View>
            ) : null}

            {/* ── STEP 1 ─ Personal Info ─────────────────────────────────────── */}
            {step === 1 && (
              <View style={s.form}>
                <StepHeader title="About You" subtitle="Used to personalise your calorie and macro calculations." icon="person-outline" color={colors.primary} />

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Age</Text>
                <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="e.g. 24" placeholderTextColor={colors.textLight} maxLength={3} />

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Biological Sex <Text style={{ fontWeight: "400", fontSize: 11 }}>(used for BMR formula)</Text></Text>
                <View style={s.segRow}>
                  {[{ v: "male", label: "Male", icon: "male-outline" }, { v: "female", label: "Female", icon: "female-outline" }].map(o => (
                    <TouchableOpacity key={o.v} style={[s.seg, { borderColor: gender === o.v ? colors.primary : colors.border, backgroundColor: gender === o.v ? colors.primary : colors.background }]} onPress={() => setGender(o.v)}>
                      <Ionicons name={o.icon} size={16} color={gender === o.v ? "#fff" : colors.textSecondary} />
                      <Text style={[s.segTxt, { color: gender === o.v ? "#fff" : colors.textSecondary }]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Activity Level</Text>
                <OptionCards options={ACTIVITY_OPTS} value={activityLevel} onChange={setActivityLevel} colors={colors} />

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Training Experience</Text>
                <OptionCards options={EXPERIENCE_OPTS} value={experienceLevel} onChange={setExperienceLevel} colors={colors} />

                <TouchableOpacity style={[s.btnP, { backgroundColor: colors.primary }]} onPress={() => { const e = v1(); if (e) return setErr(e); setErr(""); setStep(2); }}>
                  <Text style={s.btnPTxt}>Continue</Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2 ─ Measurements ─────────────────────────────────────── */}
            {step === 2 && (
              <View style={s.form}>
                <StepHeader title="Your Measurements" subtitle="Used to calculate your TDEE and BMI." icon="body-outline" color="#0ea5e9" />

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Height</Text>
                <View style={s.unitRow}>
                  {["ft", "m"].map(u => (
                    <TouchableOpacity key={u} style={[s.unitBtn, { borderColor: heightUnit === u ? colors.primary : colors.border, backgroundColor: heightUnit === u ? colors.primary : colors.background }]} onPress={() => changeHeightUnit(u)}>
                      <Text style={[s.unitTxt, { color: heightUnit === u ? "#fff" : colors.textSecondary }]}>{u === "ft" ? "Feet / Inches" : "Metres / Cm"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {heightUnit === "ft" ? (
                  <View style={s.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mini, { color: colors.textSecondary }]}>Feet</Text>
                      <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={heightFt} onChangeText={setHeightFt} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.textLight} maxLength={1} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mini, { color: colors.textSecondary }]}>Inches</Text>
                      <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={heightIn} onChangeText={setHeightIn} keyboardType="numeric" placeholder="10" placeholderTextColor={colors.textLight} maxLength={2} />
                    </View>
                  </View>
                ) : (
                  <View style={s.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mini, { color: colors.textSecondary }]}>Metres</Text>
                      <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={heightM} onChangeText={setHeightM} keyboardType="numeric" placeholder="1" placeholderTextColor={colors.textLight} maxLength={1} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mini, { color: colors.textSecondary }]}>Cm</Text>
                      <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={heightCmPart} onChangeText={setHeightCmPart} keyboardType="numeric" placeholder="78" placeholderTextColor={colors.textLight} maxLength={2} />
                    </View>
                  </View>
                )}

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Weight</Text>
                <View style={s.unitRow}>
                  {["kg", "lbs"].map(u => (
                    <TouchableOpacity key={u} style={[s.unitBtn, { borderColor: weightUnit === u ? colors.primary : colors.border, backgroundColor: weightUnit === u ? colors.primary : colors.background }]} onPress={() => changeWeightUnit(u)}>
                      <Text style={[s.unitTxt, { color: weightUnit === u ? "#fff" : colors.textSecondary }]}>{u.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={weightValue} onChangeText={setWeightValue} keyboardType="decimal-pad" placeholder={weightUnit === "lbs" ? "e.g. 172" : "e.g. 78"} placeholderTextColor={colors.textLight} />

                <BMICard bmi={liveBMI} heightCm={parsed.heightCm} colors={colors} />

                <View style={s.navRow}>
                  <TouchableOpacity style={[s.btnS, { borderColor: colors.border }]} onPress={() => setStep(1)}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[s.btnSTxt, { color: colors.textSecondary }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnP, { flex: 2, backgroundColor: colors.primary }]} onPress={() => { const e = v2(); if (e) return setErr(e); setErr(""); setStep(3); }}>
                    <Text style={s.btnPTxt}>Continue</Text>
                    <Ionicons name="arrow-forward" size={17} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 3 ─ Current Body Type ────────────────────────────────── */}
            {step === 3 && (
              <View style={s.form}>
                <StepHeader title="Your Current Body" subtitle="Swipe through the options and select the one that best matches you right now." icon="body-outline" color="#8b5cf6" />
                <SomatotypeGuide colors={colors} />
                <BodyTypeCarousel
                  types={CURRENT_BODY_TYPES}
                  selected={currentBodyType}
                  onSelect={v => { setCurrentBodyType(v); setErr(""); }}
                  colors={colors}
                  accentColor="#8b5cf6"
                />
                <View style={s.navRow}>
                  <TouchableOpacity style={[s.btnS, { borderColor: colors.border }]} onPress={() => setStep(2)}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[s.btnSTxt, { color: colors.textSecondary }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btnP, { flex: 2, backgroundColor: !currentBodyType ? colors.border : "#8b5cf6" }]}
                    onPress={() => {
                      if (!currentBodyType) return setErr("Please select your current body type.");
                      setErr(""); setStep(4);
                    }}
                  >
                    <Text style={[s.btnPTxt, { color: !currentBodyType ? colors.textSecondary : "#fff" }]}>Continue</Text>
                    <Ionicons name="arrow-forward" size={17} color={!currentBodyType ? colors.textSecondary : "#fff"} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 4 ─ Ideal Body Type ──────────────────────────────────── */}
            {step === 4 && (
              <View style={s.form}>
                <StepHeader title="Your Goal Physique" subtitle="Swipe through and pick where you want to get to." icon="star-outline" color="#f59e0b" />

                {/* Transformation preview */}
                {selCurBT && (
                  <View style={[s.xform, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.xformLbl, { color: colors.textSecondary }]}>FROM</Text>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <BodyFigure type={currentBodyType} primaryColor={colors.textLight} size={0.5} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textSecondary }}>{selCurBT.label}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={26} color={colors.primary} />
                    <View style={{ alignItems: "center", gap: 4 }}>
                      {idealBodyType
                        ? <>
                            <BodyFigure type={idealBodyType} primaryColor={colors.primary} size={0.5} />
                            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>{selIdealBT?.label}</Text>
                          </>
                        : <View style={[s.xformPh, { borderColor: colors.border }]}>
                            <Ionicons name="help-outline" size={22} color={colors.textLight} />
                            <Text style={{ fontSize: 9, color: colors.textLight }}>Select below</Text>
                          </View>
                      }
                    </View>
                    <Text style={[s.xformLbl, { color: colors.textSecondary }]}>TO</Text>
                  </View>
                )}

                <BodyTypeCarousel
                  types={IDEAL_BODY_TYPES}
                  selected={idealBodyType}
                  onSelect={v => { setIdealBodyType(v); setErr(""); }}
                  colors={colors}
                  accentColor="#f59e0b"
                />

                <View style={s.navRow}>
                  <TouchableOpacity style={[s.btnS, { borderColor: colors.border }]} onPress={() => setStep(3)}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[s.btnSTxt, { color: colors.textSecondary }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btnP, { flex: 2, backgroundColor: !idealBodyType ? colors.border : "#f59e0b" }]}
                    onPress={() => {
                      if (!idealBodyType) return setErr("Please select your goal physique.");
                      setErr("");
                      const suggested = suggestGoal(currentBodyType, idealBodyType);
                      setGoal(suggested);
                      calcTargets(suggested);
                      setStep(5);
                    }}
                  >
                    <Text style={[s.btnPTxt, { color: !idealBodyType ? colors.textSecondary : "#fff" }]}>Continue</Text>
                    <Ionicons name="arrow-forward" size={17} color={!idealBodyType ? colors.textSecondary : "#fff"} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 5 ─ Nutrition Targets ──────────────────────────────── */}
            {step === 5 && (
              <View style={s.form}>
                <StepHeader title="Nutrition Targets" subtitle="Personalised from your body types, stats and activity." icon="nutrition-outline" color="#22c55e" />

                {/* TDEE insight */}
                {tdeeCache != null && (
                  <View style={[s.insight, { backgroundColor: colors.primary + "0c", borderColor: colors.primary + "28" }]}>
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.insightSub, { color: colors.textSecondary }]}>MAINTENANCE CALORIES (TDEE)</Text>
                        <Text style={[s.insightBig, { color: colors.text }]}>
                          {tdeeCache} <Text style={s.insightUnit}>kcal/day</Text>
                        </Text>
                        <Text style={[s.insightNote, { color: colors.textSecondary }]}>
                          Estimated from Mifflin-St Jeor BMR × activity. Your goal adjusts from here.
                        </Text>
                      </View>
                      <Ionicons name="flame-outline" size={34} color={colors.primary} />
                    </View>
                    {changeInfo && (
                      <View style={[s.changeRow, { backgroundColor: changeInfo.col + "15" }]}>
                        <Ionicons name={changeInfo.icon} size={15} color={changeInfo.col} />
                        <Text style={[s.changeTxt, { color: changeInfo.col }]}>{changeInfo.text}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Goal selector — replaces broken Picker */}
                <Text style={[s.lbl, { color: colors.textSecondary }]}>Select your goal</Text>
                <GoalSelector
                  value={goal}
                  onChange={v => { setGoal(v); calcTargets(v); }}
                  tdee={tdeeCache}
                  colors={colors}
                  curBT={currentBodyType}
                  idealBT={idealBodyType}
                />

                {/* Recalculate */}
                <TouchableOpacity style={[s.recalc, { borderColor: colors.primary }]} onPress={() => calcTargets()}>
                  <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                  <Text style={[s.recalcTxt, { color: colors.primary }]}>Recalculate from measurements</Text>
                </TouchableOpacity>

                {/* Macro preview */}
                <View style={[s.macroWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={s.macroBoxRow}>
                    {[
                      { lbl: "Calories", val: calorieGoal, unit: "kcal", col: colors.primary || "#0b84ff" },
                      { lbl: "Protein",  val: proteinGoal, unit: "g",    col: "#6366f1" },
                      { lbl: "Carbs",    val: carbGoal,    unit: "g",    col: "#f59e0b" },
                      { lbl: "Fat",      val: fatGoal,     unit: "g",    col: "#22c55e" },
                    ].map(({ lbl, val, unit, col }) => (
                      <View key={lbl} style={{ alignItems: "center" }}>
                        <Text style={[s.macroVal, { color: col }]}>{val}</Text>
                        <Text style={[s.macroUnit, { color: colors.textLight }]}>{unit}</Text>
                        <Text style={[s.macroLbl, { color: colors.textSecondary }]}>{lbl}</Text>
                      </View>
                    ))}
                  </View>
                  <MacroBar protein={proteinGoal} carbs={carbGoal} fat={fatGoal} fiber={fiberGoal} colors={colors} />
                </View>

                {/* Editable fields */}
                <Text style={[s.lbl, { color: colors.textSecondary }]}>Daily Calories (kcal)</Text>
                <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={calorieGoal} onChangeText={setCalorieGoal} keyboardType="numeric" placeholderTextColor={colors.textLight} />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}><Text style={[s.mini, { color: colors.textSecondary }]}>Protein (g)</Text><TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={proteinGoal} onChangeText={setProteinGoal} keyboardType="numeric" placeholderTextColor={colors.textLight} /></View>
                  <View style={{ flex: 1 }}><Text style={[s.mini, { color: colors.textSecondary }]}>Carbs (g)</Text><TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={carbGoal} onChangeText={setCarbGoal} keyboardType="numeric" placeholderTextColor={colors.textLight} /></View>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}><Text style={[s.mini, { color: colors.textSecondary }]}>Fat (g)</Text><TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={fatGoal} onChangeText={setFatGoal} keyboardType="numeric" placeholderTextColor={colors.textLight} /></View>
                  <View style={{ flex: 1 }}><Text style={[s.mini, { color: colors.textSecondary }]}>Fibre (g)</Text><TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} value={fiberGoal} onChangeText={setFiberGoal} keyboardType="numeric" placeholderTextColor={colors.textLight} /></View>
                </View>

                {/* Advanced */}
                <TouchableOpacity style={[s.advToggle, { borderColor: colors.border }]} onPress={() => setShowAdv(v => !v)}>
                  <Ionicons name={showAdv ? "chevron-up" : "settings-outline"} size={14} color={colors.textSecondary} />
                  <Text style={[s.advTxt, { color: colors.textSecondary }]}>{showAdv ? "Hide advanced" : "Advanced options"}</Text>
                </TouchableOpacity>
                {showAdv && (
                  <View style={[s.advBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.lbl, { color: colors.textSecondary }]}>Daily Water Target (ml)</Text>
                    <TextInput style={[s.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]} value={waterGoal} onChangeText={setWaterGoal} keyboardType="numeric" placeholder="e.g. 2500" placeholderTextColor={colors.textLight} />
                    <Text style={[s.note, { color: colors.textSecondary }]}>Default: 35 ml × your body weight. Adjust if you have specific hydration needs.</Text>
                  </View>
                )}

                <View style={s.navRow}>
                  <TouchableOpacity style={[s.btnS, { borderColor: colors.border }]} onPress={() => setStep(4)}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[s.btnSTxt, { color: colors.textSecondary }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnP, { flex: 2, backgroundColor: colors.primary }]} onPress={() => { setErr(""); setStep(6); }}>
                    <Text style={s.btnPTxt}>Continue</Text>
                    <Ionicons name="arrow-forward" size={17} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 6 ─ Aims ─────────────────────────────────────────────── */}
            {step === 6 && (
              <View style={s.form}>
                <StepHeader title={`Your Goals (${aims.length}/${MAX_AIMS})`} subtitle={`Choose up to ${MAX_AIMS} goals. You can change these later.`} icon="flag-outline" color="#ef4444" />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
                  {AIM_CATEGORIES.map(cat => {
                    const active = aimCat === cat.key;
                    return (
                      <TouchableOpacity key={cat.key} onPress={() => setAimCat(cat.key)} style={[s.catTab, active && { backgroundColor: cat.color, borderColor: cat.color }]}>
                        <Text style={[s.catTxt, active && { color: "#fff" }]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={s.chips}>
                  {activeCat?.aims.map(a => {
                    const sel = !!aims.find(x => x.key === a.key);
                    const col = activeCat.color;
                    return (
                      <TouchableOpacity
                        key={a.key}
                        disabled={!sel && aims.length >= MAX_AIMS}
                        onPress={() => setAims(prev => prev.find(x => x.key === a.key) ? prev.filter(x => x.key !== a.key) : [...prev, { ...a, color: col }])}
                        style={[s.chip, { backgroundColor: sel ? col : col + "22", borderWidth: 1.5, borderColor: col, opacity: !sel && aims.length >= MAX_AIMS ? 0.35 : 1 }]}
                      >
                        <Text style={[s.chipTxt, { color: sel ? "#fff" : col }]}>{a.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>


                {aims.length > 0 && (
                  <View style={[s.selSection, { borderTopColor: colors.border }]}>
                    <Text style={[s.mini, { color: colors.textSecondary }]}>Selected:</Text>
                    <View style={s.chips}>
                      {aims.map(a => (
                        <TouchableOpacity key={a.key} onPress={() => setAims(prev => prev.filter(x => x.key !== a.key))} style={[s.chip, { backgroundColor: a.color, borderWidth: 0 }]}>
                          <Text style={[s.chipTxt, { color: "#fff" }]}>{a.label} ×</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={s.navRow}>
                  <TouchableOpacity style={[s.btnS, { borderColor: colors.border }]} onPress={() => setStep(5)}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[s.btnSTxt, { color: colors.textSecondary }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnP, { flex: 2, backgroundColor: colors.primary }]} onPress={() => { setErr(""); setStep(7); }}>
                    <Text style={s.btnPTxt}>Continue</Text>
                    <Ionicons name="arrow-forward" size={17} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 7 ─ Privacy ──────────────────────────────────────────── */}
            {step === 7 && (
              <View style={s.form}>
                <StepHeader
                  title="Privacy Settings"
                  subtitle="Control who can see your profile and activity. You can change this anytime in Settings."
                  icon="shield-checkmark-outline"
                  color="#6366f1"
                />

                <Text style={[s.lbl, { color: colors.textSecondary }]}>Who can see your profile?</Text>
                {VISIBILITY_OPTS.map(opt => {
                  const sel = profileVisibility === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        pv.card,
                        {
                          backgroundColor: sel ? "#6366f110" : colors.background,
                          borderColor: sel ? "#6366f1" : colors.border,
                          borderWidth: sel ? 2 : 1.5,
                        },
                      ]}
                      onPress={() => setProfileVisibility(opt.value)}
                      activeOpacity={0.8}
                    >
                      <View style={[pv.iconBox, { backgroundColor: sel ? "#6366f120" : colors.border + "60" }]}>
                        <Ionicons name={opt.icon} size={18} color={sel ? "#6366f1" : colors.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[pv.label, { color: sel ? "#6366f1" : colors.text }]}>{opt.label}</Text>
                        <Text style={[pv.desc, { color: colors.textSecondary }]}>{opt.desc}</Text>
                      </View>
                      {sel
                        ? <Ionicons name="checkmark-circle" size={20} color="#6366f1" />
                        : <View style={[pv.radio, { borderColor: colors.border }]} />
                      }
                    </TouchableOpacity>
                  );
                })}

                <Text style={[s.lbl, { color: colors.textSecondary, marginTop: 4 }]}>Share with friends</Text>

                <View style={[pv.toggleCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[pv.iconBox, { backgroundColor: "#6366f115" }]}>
                    <Ionicons name="barbell-outline" size={18} color="#6366f1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[pv.label, { color: colors.text }]}>Body stats</Text>
                    <Text style={[pv.desc, { color: colors.textSecondary }]}>Weight and body measurements</Text>
                  </View>
                  <Switch
                    value={shareWeight}
                    onValueChange={setShareWeight}
                    trackColor={{ false: colors.border, true: "#6366f140" }}
                    thumbColor={shareWeight ? "#6366f1" : colors.textLight}
                  />
                </View>

                <View style={[pv.toggleCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[pv.iconBox, { backgroundColor: "#6366f115" }]}>
                    <Ionicons name="footsteps-outline" size={18} color="#6366f1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[pv.label, { color: colors.text }]}>Activity</Text>
                    <Text style={[pv.desc, { color: colors.textSecondary }]}>Workouts and fitness activity</Text>
                  </View>
                  <Switch
                    value={shareActivity}
                    onValueChange={setShareActivity}
                    trackColor={{ false: colors.border, true: "#6366f140" }}
                    thumbColor={shareActivity ? "#6366f1" : colors.textLight}
                  />
                </View>

                <View style={[pv.note, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                  <Ionicons name="information-circle-outline" size={14} color="#3b82f6" />
                  <Text style={[pv.noteText, { color: "#1e40af" }]}>
                    These can be changed anytime from your profile settings.
                  </Text>
                </View>

                <View style={s.navRow}>
                  <TouchableOpacity style={[s.btnS, { borderColor: colors.border }]} onPress={() => setStep(6)}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[s.btnSTxt, { color: colors.textSecondary }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnP, { flex: 2, backgroundColor: "#6366f1" }, loading && { opacity: 0.5 }]} onPress={finish} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={s.btnPTxt}>Finish Setup</Text>
                        <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.xxxl },
    back:     { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md },
    backText: { fontSize: font.sm, fontWeight: "600" },
    brand:    { fontSize: font.xl, fontWeight: "800", textAlign: "center", marginBottom: spacing.xl, marginTop: spacing.sm },
    card: {
      borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 20, elevation: 5,
    },
    progressWrap:  { gap: 5 },
    progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
    progressFill:  { height: "100%", borderRadius: 3 },
    progressLbl:   { fontSize: 11, textAlign: "right", fontWeight: "600" },
    errBox:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fee2e2", borderRadius: radius.sm, padding: spacing.md },
    errText: { color: "#b91c1c", fontSize: font.sm, flex: 1, fontWeight: "600" },
    form:    { gap: spacing.md },
    lbl:     { fontSize: font.sm, fontWeight: "700" },
    mini:    { fontSize: font.sm, fontWeight: "700" },
    input:   { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, fontSize: font.base, lineHeight: 20 },
    segRow:  { flexDirection: "row", gap: spacing.sm },
    seg:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 12 },
    segTxt:  { fontSize: font.sm, fontWeight: "700" },
    unitRow: { flexDirection: "row", gap: spacing.sm },
    unitBtn: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
    unitTxt: { fontSize: font.sm, fontWeight: "700" },
    row2:    { flexDirection: "row", gap: spacing.sm },
    navRow:  { flexDirection: "row", gap: spacing.sm },
    btnP:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.md, paddingVertical: 15 },
    btnPTxt: { fontSize: font.base, fontWeight: "800", color: "#fff" },
    btnS:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 15 },
    btnSTxt: { fontSize: font.base, fontWeight: "600" },
    // Transformation banner
    xform:   { borderRadius: 14, borderWidth: 1.5, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
    xformLbl:{ fontSize: 9, fontWeight: "800", letterSpacing: 1 },
    xformPh: { width: 38, height: 72, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 3 },
    // Nutrition
    insight:      { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 8 },
    insightSub:   { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    insightBig:   { fontSize: 26, fontWeight: "900", lineHeight: 30 },
    insightUnit:  { fontSize: 14, fontWeight: "600" },
    insightNote:  { fontSize: 11, lineHeight: 16, marginTop: 2 },
    changeRow:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    changeTxt:    { fontSize: 13, fontWeight: "700" },
    macroWrap:    { borderRadius: 12, borderWidth: 1.5, padding: 14, gap: 12 },
    macroBoxRow:  { flexDirection: "row", justifyContent: "space-around" },
    macroVal:     { fontSize: font.lg, fontWeight: "900", lineHeight: 22 },
    macroUnit:    { fontSize: 10 },
    macroLbl:     { fontSize: 10, fontWeight: "600", marginTop: 1 },
    recalc:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, borderWidth: 1.5, borderRadius: radius.md },
    recalcTxt:    { fontSize: font.sm, fontWeight: "700" },
    advToggle:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5 },
    advTxt:       { fontSize: font.sm, fontWeight: "600" },
    advBox:       { borderRadius: 12, borderWidth: 1.5, padding: 12, gap: spacing.md },
    note:         { fontSize: 11, lineHeight: 17 },
    // Aims
    catRow:     { flexDirection: "row", gap: 8, paddingVertical: 2 },
    catTab:     { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
    catTxt:     { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },
    chips:      { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip:       { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7 },
    chipTxt:    { fontSize: font.sm, fontWeight: "700" },
    recBadge:   { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
    recTxt:     { fontSize: 9, color: "#fff", fontWeight: "800" },
    recNote:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
    recNoteTxt: { flex: 1, fontSize: 11, lineHeight: 16 },
    selSection: { borderTopWidth: 1, paddingTop: spacing.md, gap: spacing.sm },
  });
}

const pv = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  toggleCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12, borderWidth: 1.5 },
  iconBox:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label:      { fontSize: 13, fontWeight: "700" },
  desc:       { fontSize: 11, lineHeight: 16, marginTop: 1 },
  radio:      { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  note:       { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  noteText:   { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "500" },
});
