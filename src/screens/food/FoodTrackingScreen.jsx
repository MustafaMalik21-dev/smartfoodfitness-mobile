import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  Svg, Path, Rect, Circle as SvgCircle, ClipPath, G, Defs,
  LinearGradient, Stop, Line as SvgLine, Text as SvgText,
} from "react-native-svg";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W  = SCREEN_W - spacing.lg * 4;

const FOOD_METRICS = [
  { key: "calories", label: "Calories", unit: "kcal", color: "#f97316", icon: "flame-outline",     desc: "Total calorie intake per day" },
  { key: "macros",   label: "Macros",   unit: "g",    color: "#3b82f6", icon: "nutrition-outline", desc: "Protein, carbs & fat consumed" },
  { key: "micros",   label: "Micros",   unit: "",     color: "#8b5cf6", icon: "flask-outline",      desc: "Vitamins, minerals & other nutrients" },
  { key: "water",    label: "Water",    unit: "ml",   color: "#0ea5e9", icon: "water-outline",      desc: "Daily water intake" },
];

const PERIODS = ["Week", "Month", "Year"];

const MACRO_SERIES = [
  { key: "proteins", label: "Protein", color: "#ef4444" },
  { key: "carbs",    label: "Carbs",   color: "#f59e0b" },
  { key: "fats",     label: "Fat",     color: "#8b5cf6" },
];
const MACRO_FILTERS    = ["All", "Protein", "Carbs", "Fat"];
const MACRO_FILTER_MAP = { Protein: "proteins", Carbs: "carbs", Fat: "fats" };

const MICRO_GROUPS = {
  Dietary:  [{ key: "fiberG",        label: "Fiber",       color: "#06b6d4" }, { key: "sugarG",        label: "Sugar",       color: "#f472b6" }],
  Minerals: [{ key: "sodiumMg",      label: "Sodium",      color: "#eab308" }, { key: "potassiumMg",   label: "Potassium",   color: "#7c3aed" },
             { key: "calciumMg",     label: "Calcium",     color: "#3b82f6" }, { key: "ironMg",        label: "Iron",        color: "#b45309" }],
  Vitamins: [{ key: "vitaminAMcg",   label: "Vitamin A",   color: "#f59e0b" }, { key: "vitaminCMg",    label: "Vitamin C",   color: "#22c55e" },
             { key: "vitaminDMcg",   label: "Vitamin D",   color: "#8b5cf6" }],
  Lipids:   [{ key: "saturatedFatG", label: "Sat. Fat",    color: "#f97316" }, { key: "cholesterolMg", label: "Cholesterol", color: "#d946ef" }],
};
const MICRO_FILTERS     = ["Dietary", "Minerals", "Vitamins", "Lipids"];
const MICRO_CHIP_COLORS = { Dietary: "#06b6d4", Minerals: "#3b82f6", Vitamins: "#8b5cf6", Lipids: "#f97316" };

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CP = { l: 50, r: 14, t: 26, b: 28 };

function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Monotone cubic interpolation — full Fritsch-Carlson algorithm.
//
// Two-part guarantee:
//  1. Local-extremum zeroing: if adjacent secants have opposite signs the tangent
//     is set to 0, preventing the curve from curling past a peak or trough.
//  2. Control-point Y clamping (yMin/yMax): by the Bezier convex-hull property,
//     clamping the two internal control points guarantees the rendered curve
//     stays within [yMin, yMax] — no dipping below the chart floor.
//
// Call as: monotonePath(pts, CP.t, botY)
function monotonePath(pts, yMin, yMax) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

  // 1. Secant slopes
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }

  // 2. Initial tangents — zero at local extrema (sign change), average otherwise
  const m = new Array(n);
  m[0]     = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if ((d[i - 1] >= 0 && d[i] <= 0) || (d[i - 1] <= 0 && d[i] >= 0)) {
      m[i] = 0; // local extremum — flat tangent prevents any overshoot
    } else {
      m[i] = (d[i - 1] + d[i]) / 2;
    }
  }

  // 3. Fritsch-Carlson scale constraint (prevents remaining overshoot)
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0; m[i + 1] = 0;
    } else {
      const a = m[i] / d[i], b = m[i + 1] / d[i];
      const sq = a * a + b * b;
      if (sq > 9) {
        const t = 3 / Math.sqrt(sq);
        m[i]     = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
  }

  // 4. Build cubic Hermite path; clamp control-point Y to chart area
  let path = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h    = pts[i + 1].x - pts[i].x;
    const cp1x = pts[i].x     + h / 3;
    const cp2x = pts[i + 1].x - h / 3;
    let   cp1y = pts[i].y     + (m[i]     * h) / 3;
    let   cp2y = pts[i + 1].y - (m[i + 1] * h) / 3;
    // Clamp: yMin is chart top (CP.t), yMax is chart bottom (botY) in SVG coords
    if (yMin !== undefined) { cp1y = Math.max(yMin, cp1y); cp2y = Math.max(yMin, cp2y); }
    if (yMax !== undefined) { cp1y = Math.min(yMax, cp1y); cp2y = Math.min(yMax, cp2y); }
    path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return path;
}

// Average of non-zero values only
function avgNonZero(vals) {
  const nz = vals.filter(v => v > 0);
  return nz.length ? nz.reduce((s, v) => s + v, 0) / nz.length : 0;
}

// ── Bucketing helpers ─────────────────────────────────────────────────────────

// 10 buckets × 3 days each (covers last 30 days from endDate).
// Each bucket value = average of the non-zero days within that 3-day window.
// i=0 → oldest bucket (days 29,28,27 before end), i=9 → newest (days 2,1,0).
function avgBuckets3Day(entries, endDate, getVal) {
  const base = new Date(endDate); base.setHours(23, 59, 59, 999);
  return Array.from({ length: 10 }, (_, i) => {
    const offsets = [29 - i * 3, 28 - i * 3, 27 - i * 3];
    const dayVals = offsets.map(off => {
      const d = new Date(base); d.setDate(d.getDate() - off);
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      return entries
        .filter(x => { const t = new Date(x.loggedAt); return t >= s && t <= e; })
        .reduce((sum, x) => sum + toN(getVal(x)), 0);
    });
    const nz  = dayVals.filter(v => v > 0);
    const avg = nz.length ? nz.reduce((a, v) => a + v, 0) / nz.length : 0;
    // Label = first (oldest) day of the bucket
    const labelDay = new Date(base); labelDay.setDate(labelDay.getDate() - offsets[0]);
    return { lbl: `${labelDay.getDate()}/${labelDay.getMonth() + 1}`, total: avg };
  });
}

// 12 monthly buckets for a given year.
// Each bucket value = average daily total for days that have any data (non-zero days).
function avgBucketsMonthly(entries, yr, getVal) {
  return Array.from({ length: 12 }, (_, m) => {
    const ms   = new Date(yr, m, 1, 0, 0, 0, 0);
    const me   = new Date(yr, m + 1, 0, 23, 59, 59, 999);
    const hits = entries.filter(x => { const t = new Date(x.loggedAt); return t >= ms && t <= me; });
    if (!hits.length) return { lbl: MO[m], total: 0 };
    const daysInMonth = new Date(yr, m + 1, 0).getDate();
    const dailyTotals = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = new Date(yr, m, d, 0, 0, 0, 0);
      const de = new Date(yr, m, d, 23, 59, 59, 999);
      const dayTotal = hits
        .filter(x => { const t = new Date(x.loggedAt); return t >= ds && t <= de; })
        .reduce((sum, x) => sum + toN(getVal(x)), 0);
      if (dayTotal > 0) dailyTotals.push(dayTotal);
    }
    const avg = dailyTotals.length ? dailyTotals.reduce((a, v) => a + v, 0) / dailyTotals.length : 0;
    return { lbl: MO[m], total: avg };
  });
}

// ─── FoodChart ────────────────────────────────────────────────────────────────
function FoodChart({
  foodLogs, waterEntries, metric, period,
  macroFilter, microFilter, colors,
  weekOffset, setWeekOffset,
  monthOffset, setMonthOffset,
  yearOffset, setYearOffset,
}) {
  const W    = CHART_W;
  const H    = 230;
  const pw   = W - CP.l - CP.r;
  const ph   = H - CP.t - CP.b;
  const botY = CP.t + ph;

  function scaleY(v, lo, hi) {
    if (hi === lo) return CP.t + ph / 2;
    return CP.t + ph * (1 - (v - lo) / (hi - lo));
  }

  function yPad(vals) {
    if (!vals.length) return { lo: 0, hi: 1 };
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const p  = Math.max(mx * 0.15, (mx - mn) * 0.35, 10);
    return { lo: Math.max(0, mn - p), hi: mx + p };
  }

  // xlbls for 10 three-day buckets — needs pw from closure
  function make3DayXlbls(endDate) {
    const base = new Date(endDate); base.setHours(23, 59, 59, 999);
    return Array.from({ length: 10 }, (_, i) => {
      const dayOffset = 29 - i * 3;
      const d = new Date(base); d.setDate(d.getDate() - dayOffset);
      return { x: CP.l + (i / 9) * pw, lbl: `${d.getDate()}/${d.getMonth() + 1}` };
    });
  }

  // xlbls for 12 monthly buckets
  function makeYearXlbls() {
    return MO.map((lbl, i) => ({ x: CP.l + (i / 11) * pw, lbl }));
  }

  // ── Daily buckets for Week ─────────────────────────────────────────────────
  function dailyFoodBuckets(count, endDate, getVal) {
    const base = new Date(endDate); base.setHours(23, 59, 59, 999);
    return Array.from({ length: count }, (_, i) => {
      const d  = new Date(base); d.setDate(d.getDate() - (count - 1 - i));
      const s  = new Date(d);    s.setHours(0, 0, 0, 0);
      const e  = new Date(d);    e.setHours(23, 59, 59, 999);
      const hits = foodLogs.filter(x => { const t = new Date(x.loggedAt); return t >= s && t <= e; });
      return { date: d, lbl: `${d.getDate()}/${d.getMonth() + 1}`, total: hits.reduce((sum, x) => sum + toN(getVal(x)), 0) };
    });
  }

  function dailyWaterBuckets(count, endDate) {
    const base = new Date(endDate); base.setHours(23, 59, 59, 999);
    return Array.from({ length: count }, (_, i) => {
      const d  = new Date(base); d.setDate(d.getDate() - (count - 1 - i));
      const s  = new Date(d);    s.setHours(0, 0, 0, 0);
      const e  = new Date(d);    e.setHours(23, 59, 59, 999);
      const hits = waterEntries.filter(x => { const t = new Date(x.loggedAt); return t >= s && t <= e; });
      return { date: d, lbl: `${d.getDate()}/${d.getMonth() + 1}`, total: hits.reduce((sum, x) => sum + toN(x.waterMl), 0) };
    });
  }

  // ── Chart object builders ──────────────────────────────────────────────────
  function makeBars(bkts, count, color) {
    const vals  = bkts.map(b => b.total);
    const { lo, hi } = yPad(vals);
    const barW  = Math.max(3, (pw / count) * 0.62);
    const xStep = pw / (count - 1);
    return {
      type: "bar", color,
      bars: bkts.map((b, i) => {
        const xc = CP.l + i * xStep;
        const y  = scaleY(b.total, lo, hi);
        return { x: xc - barW / 2, y, w: barW, h: Math.max(2, botY - y) };
      }),
      xlbls: bkts.map((b, i) => ({ x: CP.l + i * xStep, lbl: b.lbl })),
      lo, hi,
    };
  }

  function makeLineFromVals(vals, xlbls, color, gradId) {
    const { lo, hi } = yPad(vals);
    const pts = vals.map((v, i) => ({ x: xlbls[i].x, y: scaleY(v, lo, hi) }));
    return { type: "line", series: [{ color, pts, gradId }], xlbls, lo, hi };
  }

  function makeMultiline(seriesData, xlbls) {
    const allVals = seriesData.flatMap(s => s.vals);
    if (!allVals.some(v => v > 0)) return null;
    const { lo, hi } = yPad(allVals);
    const series = seriesData.map(s => ({
      color: s.color, label: s.label,
      pts: s.vals.map((v, i) => ({ x: xlbls[i].x, y: scaleY(v, lo, hi) })),
    }));
    return { type: "multiline", series, xlbls, lo, hi };
  }

  // ── Main chart computation ─────────────────────────────────────────────────
  const chart = useMemo(() => {
    const isCal   = metric === "calories";
    const isMacro = metric === "macros";
    const isMicro = metric === "micros";
    const isWater = metric === "water";

    const avgLbl = "Avg / day";

    function singleStat(vals, unit, color) {
      const avg = avgNonZero(vals);
      if (!avg) return [];
      return [{ label: avgLbl, value: Math.round(avg).toLocaleString(), unit, color }];
    }

    function multiStats(seriesData, unit) {
      return seriesData.map(s => {
        const avg = avgNonZero(s.vals);
        return { label: s.label, value: Math.round(avg).toLocaleString(), unit, color: s.color };
      }).filter(s => Number(s.value.replace(/,/g, "")) > 0);
    }

    // ── WEEK (7 daily data points) ─────────────────────────────────────────
    if (period === "Week") {
      const end   = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
      const range = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;

      if (isCal) {
        const bkts  = dailyFoodBuckets(7, end, x => toN(x.calories));
        const vals  = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const xlbls = bkts.map((b, i) => ({ x: CP.l + (i / 6) * pw, lbl: b.lbl }));
        return { ...makeLineFromVals(vals, xlbls, "#f97316", "fc_cal_w"), range, stats: singleStat(vals, "kcal", "#f97316") };
      }

      if (isMacro) {
        const base   = new Date(end); base.setHours(23,59,59,999);
        const active = macroFilter === "All" ? MACRO_SERIES : MACRO_SERIES.filter(s => s.key === MACRO_FILTER_MAP[macroFilter]);
        const xlbls  = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(base); d.setDate(d.getDate() - (6 - i));
          return { x: CP.l + (i / 6) * pw, lbl: `${d.getDate()}/${d.getMonth()+1}` };
        });
        const seriesData = active.map(s => ({
          ...s, vals: xlbls.map((_, i) => {
            const d  = new Date(base); d.setDate(d.getDate() - (6 - i));
            const dS = new Date(d); dS.setHours(0,0,0,0);
            const dE = new Date(d); dE.setHours(23,59,59,999);
            return foodLogs.filter(x => { const t = new Date(x.loggedAt); return t >= dS && t <= dE; })
                           .reduce((sum, x) => sum + toN(x[s.key]), 0);
          }),
        }));
        const res = makeMultiline(seriesData, xlbls);
        if (!res) return null;
        return { ...res, range, stats: multiStats(seriesData, "g") };
      }

      if (isMicro) {
        const base  = new Date(end); base.setHours(23,59,59,999);
        const group = MICRO_GROUPS[microFilter] || [];
        const xlbls = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(base); d.setDate(d.getDate() - (6 - i));
          return { x: CP.l + (i / 6) * pw, lbl: `${d.getDate()}/${d.getMonth()+1}` };
        });
        const seriesData = group.map(g => ({
          ...g, vals: xlbls.map((_, i) => {
            const d  = new Date(base); d.setDate(d.getDate() - (6 - i));
            const dS = new Date(d); dS.setHours(0,0,0,0);
            const dE = new Date(d); dE.setHours(23,59,59,999);
            return foodLogs.filter(x => { const t = new Date(x.loggedAt); return t >= dS && t <= dE; })
                           .reduce((sum, x) => sum + toN(x[g.key]), 0);
          }),
        }));
        const res = makeMultiline(seriesData, xlbls);
        if (!res) return null;
        const unit = (MICRO_GROUPS[microFilter]?.[0]?.key || "").endsWith("Mcg") ? "mcg" : "mg";
        return { ...res, range, stats: multiStats(seriesData, unit) };
      }

      if (isWater) {
        const bkts = dailyWaterBuckets(7, end);
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const res  = makeBars(bkts, 7, "#0ea5e9");
        const avg  = avgNonZero(vals);
        return { ...res, range, stats: avg > 0 ? [{ label: avgLbl, value: (avg / 1000).toFixed(1), unit: "L", color: "#0ea5e9" }] : [] };
      }
    }

    // ── MONTH (10 buckets × 3-day average each) ────────────────────────────
    if (period === "Month") {
      const end   = new Date(); end.setDate(end.getDate() + monthOffset * 30);
      const start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0,0,0,0);
      const range = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
      const periodLabel = "3-day avg";

      if (isCal) {
        const bkts = avgBuckets3Day(foodLogs, end, x => toN(x.calories));
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const xlbls = make3DayXlbls(end);
        return { ...makeLineFromVals(vals, xlbls, "#f97316", "fc_cal_m"), range, periodLabel, stats: singleStat(vals, "kcal", "#f97316") };
      }

      if (isMacro) {
        const active = macroFilter === "All" ? MACRO_SERIES : MACRO_SERIES.filter(s => s.key === MACRO_FILTER_MAP[macroFilter]);
        const xlbls  = make3DayXlbls(end);
        const seriesData = active.map(s => ({
          ...s, vals: avgBuckets3Day(foodLogs, end, x => toN(x[s.key])).map(b => b.total),
        }));
        const res = makeMultiline(seriesData, xlbls);
        if (!res) return null;
        return { ...res, range, periodLabel, stats: multiStats(seriesData, "g") };
      }

      if (isMicro) {
        const group = MICRO_GROUPS[microFilter] || [];
        const xlbls  = make3DayXlbls(end);
        const seriesData = group.map(g => ({
          ...g, vals: avgBuckets3Day(foodLogs, end, x => toN(x[g.key])).map(b => b.total),
        }));
        const res = makeMultiline(seriesData, xlbls);
        if (!res) return null;
        const unit = (MICRO_GROUPS[microFilter]?.[0]?.key || "").endsWith("Mcg") ? "mcg" : "mg";
        return { ...res, range, periodLabel, stats: multiStats(seriesData, unit) };
      }

      if (isWater) {
        const bkts = avgBuckets3Day(waterEntries, end, x => toN(x.waterMl));
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const res  = makeBars(bkts, 10, "#0ea5e9");
        const avg  = avgNonZero(vals);
        return { ...res, range, periodLabel, stats: avg > 0 ? [{ label: avgLbl, value: (avg / 1000).toFixed(1), unit: "L", color: "#0ea5e9" }] : [] };
      }
    }

    // ── YEAR (12 monthly buckets, each = daily avg for that month) ─────────
    if (period === "Year") {
      const yr          = new Date().getFullYear() + yearOffset;
      const range       = String(yr);
      const periodLabel = "Daily avg / month";
      const xlbls12     = makeYearXlbls();

      if (isCal) {
        const bkts = avgBucketsMonthly(foodLogs, yr, x => toN(x.calories));
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        return { ...makeLineFromVals(vals, xlbls12, "#f97316", "fc_cal_y"), range, periodLabel, stats: singleStat(vals, "kcal", "#f97316") };
      }

      if (isMacro) {
        const active = macroFilter === "All" ? MACRO_SERIES : MACRO_SERIES.filter(s => s.key === MACRO_FILTER_MAP[macroFilter]);
        const seriesData = active.map(s => ({
          ...s, vals: avgBucketsMonthly(foodLogs, yr, x => toN(x[s.key])).map(b => b.total),
        }));
        const res = makeMultiline(seriesData, xlbls12);
        if (!res) return null;
        return { ...res, range, periodLabel, stats: multiStats(seriesData, "g") };
      }

      if (isMicro) {
        const group = MICRO_GROUPS[microFilter] || [];
        const seriesData = group.map(g => ({
          ...g, vals: avgBucketsMonthly(foodLogs, yr, x => toN(x[g.key])).map(b => b.total),
        }));
        const res = makeMultiline(seriesData, xlbls12);
        if (!res) return null;
        const unit = (MICRO_GROUPS[microFilter]?.[0]?.key || "").endsWith("Mcg") ? "mcg" : "mg";
        return { ...res, range, periodLabel, stats: multiStats(seriesData, unit) };
      }

      if (isWater) {
        const bkts = avgBucketsMonthly(waterEntries, yr, x => toN(x.waterMl));
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const res  = makeBars(bkts, 12, "#0ea5e9");
        const avg  = avgNonZero(vals);
        return { ...res, range, periodLabel, stats: avg > 0 ? [{ label: avgLbl, value: (avg / 1000).toFixed(1), unit: "L", color: "#0ea5e9" }] : [] };
      }
    }

    return null;
  }, [foodLogs, waterEntries, metric, period, weekOffset, monthOffset, yearOffset, macroFilter, microFilter]);

  // Y-axis labels
  const yAxis = useMemo(() => {
    if (!chart) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      y:   CP.t + ph * (1 - i / 4),
      lbl: Math.round(chart.lo + (i / 4) * (chart.hi - chart.lo)).toLocaleString(),
    }));
  }, [chart, ph]);

  const minOffset = useMemo(() => {
    const src   = metric === "water" ? waterEntries : foodLogs;
    const dates = src.map(e => new Date(e.loggedAt).getTime()).filter(t => !isNaN(t));
    if (!dates.length) return 0;
    const earliest  = Math.min(...dates);
    const diffDays  = (earliest - Date.now()) / 86400000;
    if (period === "Week")  return Math.ceil(diffDays / 7);
    if (period === "Month") return Math.ceil(diffDays / 30);
    if (period === "Year")  return new Date(earliest).getFullYear() - new Date().getFullYear();
    return 0;
  }, [foodLogs, waterEntries, metric, period]);

  const offset     = period === "Week" ? weekOffset : period === "Month" ? monthOffset : yearOffset;
  const setOff     = period === "Week" ? setWeekOffset : period === "Month" ? setMonthOffset : setYearOffset;
  const activeMeta = FOOD_METRICS.find(m => m.key === metric);
  const atMin      = offset <= minOffset;

  const emptyRange = useMemo(() => {
    if (period === "Week") {
      const end = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const s   = new Date(end); s.setDate(s.getDate() - 6);
      return `${s.getDate()}/${s.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
    }
    if (period === "Month") {
      const end = new Date(); end.setDate(end.getDate() + monthOffset * 30);
      const s   = new Date(end); s.setDate(s.getDate() - 29);
      return `${s.getDate()}/${s.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
    }
    return String(new Date().getFullYear() + yearOffset);
  }, [period, weekOffset, monthOffset, yearOffset]);

  // Navigation bar
  const navBar = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, paddingHorizontal: 2 }}>
      <TouchableOpacity
        onPress={() => setOff(Math.max(minOffset, offset - 1))}
        hitSlop={{ top:10, bottom:10, left:10, right:10 }}
        disabled={atMin}
      >
        <Ionicons name="chevron-back-circle" size={22} color={atMin ? colors.border : (activeMeta?.color || colors.primary)} />
      </TouchableOpacity>

      <View style={{ alignItems: "center", gap: 2 }}>
        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: "600" }}>
          {chart ? chart.range : emptyRange}
        </Text>
        {chart?.periodLabel ? (
          <Text style={{ fontSize: 9, color: colors.textLight, fontStyle: "italic" }}>
            {chart.periodLabel}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => setOff(Math.min(0, offset + 1))}
        hitSlop={{ top:10, bottom:10, left:10, right:10 }}
        disabled={offset >= 0}
      >
        <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : (activeMeta?.color || colors.primary)} />
      </TouchableOpacity>
    </View>
  );

  if (!chart) {
    return (
      <View>
        {navBar}
        <View style={{ height: H, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Ionicons name="analytics-outline" size={28} color={colors.textSecondary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>No data for this period</Text>
          <Text style={{ fontSize: 11, color: colors.textLight, textAlign: "center" }}>
            {metric === "water" ? "Log water intake to see trends here." : "Log meals to see trends here."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {navBar}

      {/* SVG chart */}
      <Svg width={W} height={H}>
        <Defs>
          {/* Safety clip — straight lines shouldn't need this, but kept as a guard */}
          <ClipPath id="chartClip">
            <Rect x={CP.l} y={CP.t} width={pw} height={ph} />
          </ClipPath>
          {/* Gradient fills for line charts */}
          {chart.type === "line" && chart.series?.map(s => (
            <LinearGradient key={s.gradId || s.color} id={s.gradId || `grad_${s.color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color} stopOpacity="0.25" />
              <Stop offset="1" stopColor={s.color} stopOpacity="0" />
            </LinearGradient>
          ))}
        </Defs>

        {/* Grid lines + Y labels */}
        {yAxis.map((yl, i) => (
          <G key={`y${i}`}>
            <SvgLine x1={CP.l} y1={yl.y} x2={CP.l + pw} y2={yl.y} stroke={colors.border} strokeWidth={0.6} strokeDasharray="4,4" />
            <SvgText x={CP.l - 4} y={yl.y + 4} textAnchor="end" fontSize={8} fill={colors.textSecondary}>{yl.lbl}</SvgText>
          </G>
        ))}

        {/* Bar chart */}
        {chart.type === "bar" && chart.bars?.map((bar, i) => (
          <Rect key={`bar${i}`} x={bar.x} y={bar.y} width={bar.w} height={bar.h} fill={chart.color} opacity={0.78} rx={2} />
        ))}

        {/* Line chart — monotone cubic, control points clamped to chart area */}
        {chart.type === "line" && chart.series?.map(s => (
          <G key={`ls_${s.gradId || s.color}`} clipPath="url(#chartClip)">
            {s.pts.length >= 2 && (
              <Path
                d={`${monotonePath(s.pts, CP.t, botY)} L${s.pts[s.pts.length - 1].x.toFixed(1)},${botY} L${s.pts[0].x.toFixed(1)},${botY} Z`}
                fill={`url(#${s.gradId || `grad_${s.color.replace("#","")}`})`}
              />
            )}
            {s.pts.length >= 2 && (
              <Path d={monotonePath(s.pts, CP.t, botY)} stroke={s.color} strokeWidth={2.5} fill="none" />
            )}
          </G>
        ))}
        {/* Dots for line chart — not clipped */}
        {chart.type === "line" && chart.series?.map(s =>
          s.pts.map((pt, pi) => (
            <SvgCircle key={`d_${pi}`} cx={pt.x} cy={pt.y} r={3} fill="#fff" stroke={s.color} strokeWidth={1.5} />
          ))
        )}

        {/* Multi-line chart — monotone cubic, control points clamped to chart area */}
        {chart.type === "multiline" && chart.series?.map((s, si) => (
          <G key={`ml${si}`} clipPath="url(#chartClip)">
            {s.pts.length >= 2 && <Path d={monotonePath(s.pts, CP.t, botY)} stroke={s.color} strokeWidth={2} fill="none" />}
          </G>
        ))}
        {/* Dots for multi-line — not clipped */}
        {chart.type === "multiline" && chart.series?.map((s, si) =>
          s.pts.map((pt, pi) => (
            <SvgCircle key={`mld${si}_${pi}`} cx={pt.x} cy={pt.y} r={2.5} fill="#fff" stroke={s.color} strokeWidth={1.5} />
          ))
        )}

        {/* X labels */}
        {chart.xlbls?.map((xl, i) =>
          xl.lbl ? (
            <SvgText key={`x${i}`} x={xl.x} y={H - 4} textAnchor="middle" fontSize={9} fill={colors.textSecondary}>{xl.lbl}</SvgText>
          ) : null
        )}
      </Svg>

      {/* Stats row — below chart */}
      {chart.stats?.length > 0 && (
        <View style={{
          flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around",
          paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
        }}>
          {chart.stats.map((s, i) => (
            <View key={i} style={{ alignItems: "center", minWidth: 70, gap: 2 }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: "600" }}>{s.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: s.color }}>
                {s.value}<Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}> {s.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function FoodTrackingScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth }   = useAuth();
  const userId     = auth?.userId;

  const [foodLogs,     setFoodLogs]     = useState([]);
  const [waterEntries, setWaterEntries] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState("");

  const [metric,      setMetric]      = useState("calories");
  const [period,      setPeriod]      = useState("Week");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset,  setYearOffset]  = useState(0);
  const [macroFilter, setMacroFilter] = useState("All");
  const [microFilter, setMicroFilter] = useState("Dietary");

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setErr("");
    try {
      const [fRes, wRes] = await Promise.all([
        apiClient.get(`/api/food-entry-logs/user/${userId}`),
        apiClient.get(`/api/water-entries/user/${userId}`),
      ]);
      setFoodLogs(Array.isArray(fRes.data) ? fRes.data : []);
      setWaterEntries(Array.isArray(wRes.data) ? wRes.data : []);
    } catch {
      setErr("Failed to load food tracking data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeMeta = FOOD_METRICS.find(m => m.key === metric);
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={st.screen} edges={["top"]}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Food Tracking</Text>
        <View style={st.headerIconBtn} />
      </View>

      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>

        {/* Metric selector */}
        <View style={st.metricRow}>
          {FOOD_METRICS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[st.metricBtn, metric === m.key && { backgroundColor: m.color + "20", borderColor: m.color, borderWidth: 1.5 }]}
              onPress={() => setMetric(m.key)}
              activeOpacity={0.75}
            >
              <View style={[st.metricIcon, { backgroundColor: m.color + (metric === m.key ? "30" : "15") }]}>
                <Ionicons name={m.icon} size={18} color={m.color} />
              </View>
              <Text style={[st.metricLabel, metric === m.key && { color: m.color, fontWeight: "700" }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period tabs */}
        <View style={st.tabsWrap}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[st.tab, period === p && { backgroundColor: activeMeta?.color || colors.primary }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[st.tabText, period === p && st.tabTextOn]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {err ? <Text style={st.errText}>{err}</Text> : null}

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <ActivityIndicator color={activeMeta?.color || colors.primary} />
          </View>
        ) : (
          <View style={st.card}>
            {/* Card header */}
            <View style={st.cardTitleRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={activeMeta?.icon || "analytics-outline"} size={18} color={activeMeta?.color || colors.primary} />
                <Text style={st.cardTitle}>{activeMeta?.label}</Text>
                {activeMeta?.unit ? (
                  <Text style={[st.unitBadge, { color: activeMeta.color, borderColor: activeMeta.color + "40" }]}>
                    {activeMeta.unit}
                  </Text>
                ) : null}
              </View>
            </View>
            {activeMeta?.desc ? (
              <Text style={st.metricDesc}>{activeMeta.desc}</Text>
            ) : null}

            {/* Filter chips */}
            {metric === "macros" && (
              <View style={st.chipRow}>
                {MACRO_FILTERS.map(f => {
                  const c = f === "All" ? "#3b82f6" : f === "Protein" ? "#ef4444" : f === "Carbs" ? "#f59e0b" : "#8b5cf6";
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[st.chip, macroFilter === f && { backgroundColor: c, borderColor: c }]}
                      onPress={() => setMacroFilter(f)}
                    >
                      <Text style={[st.chipText, macroFilter === f && st.chipTextOn]}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {metric === "micros" && (
              <View style={st.chipRow}>
                {MICRO_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[st.chip, microFilter === f && { backgroundColor: MICRO_CHIP_COLORS[f], borderColor: MICRO_CHIP_COLORS[f] }]}
                    onPress={() => setMicroFilter(f)}
                  >
                    <Text style={[st.chipText, microFilter === f && st.chipTextOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Chart */}
            <FoodChart
              foodLogs={foodLogs}
              waterEntries={waterEntries}
              metric={metric}
              period={period}
              macroFilter={macroFilter}
              microFilter={microFilter}
              colors={colors}
              weekOffset={weekOffset}   setWeekOffset={setWeekOffset}
              monthOffset={monthOffset} setMonthOffset={setMonthOffset}
              yearOffset={yearOffset}   setYearOffset={setYearOffset}
            />

            {/* Legend for multi-series */}
            {metric === "macros" && (
              <View style={st.legend}>
                {(macroFilter === "All" ? MACRO_SERIES : MACRO_SERIES.filter(item => item.key === MACRO_FILTER_MAP[macroFilter])).map(item => (
                  <View key={item.key} style={st.legendItem}>
                    <View style={[st.legendDot, { backgroundColor: item.color }]} />
                    <Text style={st.legendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}
            {metric === "micros" && (
              <View style={st.legend}>
                {(MICRO_GROUPS[microFilter] || []).map(g => (
                  <View key={g.key} style={st.legendItem}>
                    <View style={[st.legendDot, { backgroundColor: g.color }]} />
                    <Text style={st.legendText}>{g.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    headerIconBtn: { width: 36, alignItems: "center" },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },

    metricRow: { flexDirection: "row", gap: spacing.sm },
    metricBtn: {
      flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.lg,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    metricLabel: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },

    tabsWrap: {
      flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: 4, gap: 4,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    tab: { flex: 1, paddingVertical: 9, borderRadius: radius.md, alignItems: "center" },
    tabText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    tabTextOn: { color: "#fff" },

    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    unitBadge:  { fontSize: 11, fontWeight: "700", borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    metricDesc: { fontSize: 11, color: colors.textSecondary, marginTop: -4 },

    chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    chip: {
      paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
    },
    chipText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    chipTextOn: { color: "#fff" },

    legend: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: colors.textSecondary },

    errText: { color: colors.error, fontSize: font.sm, textAlign: "center" },
  });
}
