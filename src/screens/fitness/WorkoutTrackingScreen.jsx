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

const WORKOUT_METRICS = [
  { key: "duration",  label: "Duration",  unit: "min", color: "#f97316", icon: "timer-outline",
    desc: "Length of each workout session" },
  { key: "volume",    label: "Volume",    unit: "kg",  color: "#6366f1", icon: "barbell-outline",
    desc: "Total weight × reps lifted per session" },
  { key: "frequency", label: "Frequency", unit: "",    color: "#22c55e", icon: "calendar-outline",
    desc: "Number of workouts completed" },
  { key: "records",   label: "Records",   unit: "",    color: "#f59e0b", icon: "trophy-outline",
    desc: "Your personal bests per exercise" },
];

const PERIODS = ["Week", "Month", "Year"];
const MO      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CP      = { l: 50, r: 14, t: 26, b: 28 };

// ── Utilities ─────────────────────────────────────────────────────────────────

function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function safeJson(s) {
  if (!s || typeof s !== "string") return null;
  try { return JSON.parse(s); } catch { return null; }
}

function getLogDate(log) {
  return log?.performedAt || log?.completedAt || null;
}

/** Total weight × reps across all completed sets in one workout log. */
function getLogVolume(log) {
  const details = safeJson(log?.detailsJson);
  if (!details?.exercises?.length) return 0;
  let vol = 0;
  for (const ex of details.exercises) {
    for (const set of (ex?.sets || [])) {
      if (set?.done) vol += toN(set.weight) * toN(set.reps);
    }
  }
  return vol;
}

/** Per-exercise personal records across all workout logs. */
function computeRecords(logs) {
  const map = {};
  for (const log of (logs || [])) {
    const details = safeJson(log?.detailsJson);
    if (!details?.exercises?.length) continue;
    for (const ex of details.exercises) {
      if (!ex?.name) continue;
      const key = ex.name.trim();
      if (!map[key]) map[key] = { name: key, bestWeight: 0, bestSetVol: 0, totalSets: 0, sessions: 0 };
      map[key].sessions++;
      for (const set of (ex?.sets || [])) {
        if (!set?.done) continue;
        const w = toN(set.weight), r = toN(set.reps);
        if (w > map[key].bestWeight) map[key].bestWeight = w;
        const sv = w * r;
        if (sv > map[key].bestSetVol) map[key].bestSetVol = sv;
        map[key].totalSets++;
      }
    }
  }
  return Object.values(map)
    .filter(r => r.totalSets > 0)
    .sort((a, b) => b.totalSets - a.totalSets);
}

/** Monotone cubic (Fritsch-Carlson) → SVG cubic bezier path. */
function monotonePath(pts, yMin, yMax) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }
  const m = new Array(n);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if ((d[i - 1] >= 0 && d[i] <= 0) || (d[i - 1] <= 0 && d[i] >= 0)) {
      m[i] = 0;
    } else {
      m[i] = (d[i - 1] + d[i]) / 2;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; }
    else {
      const a = m[i] / d[i], b = m[i + 1] / d[i];
      const sq = a * a + b * b;
      if (sq > 9) { const t = 3 / Math.sqrt(sq); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
  }
  let path = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    const cp1x = pts[i].x + h / 3, cp2x = pts[i + 1].x - h / 3;
    let cp1y = pts[i].y + (m[i] * h) / 3, cp2y = pts[i + 1].y - (m[i + 1] * h) / 3;
    if (yMin !== undefined) { cp1y = Math.max(yMin, cp1y); cp2y = Math.max(yMin, cp2y); }
    if (yMax !== undefined) { cp1y = Math.min(yMax, cp1y); cp2y = Math.min(yMax, cp2y); }
    path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return path;
}

function avgNonZero(vals) {
  const nz = vals.filter(v => v > 0);
  return nz.length ? nz.reduce((s, v) => s + v, 0) / nz.length : 0;
}

// ── Bucketing helpers ─────────────────────────────────────────────────────────

function dailyWorkoutBuckets(logs, count, endDate, getVal) {
  const base = new Date(endDate); base.setHours(23, 59, 59, 999);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base); d.setDate(d.getDate() - (count - 1 - i));
    const s = new Date(d); s.setHours(0, 0, 0, 0);
    const e = new Date(d); e.setHours(23, 59, 59, 999);
    const dayLogs = logs.filter(x => {
      const t = new Date(getLogDate(x));
      return !isNaN(t.getTime()) && t >= s && t <= e;
    });
    return { lbl: `${d.getDate()}/${d.getMonth() + 1}`, total: getVal(dayLogs) };
  });
}

/** 10 three-day buckets — average of non-zero days (duration/volume). */
function avgBuckets3DayWorkout(logs, endDate, getVal) {
  const base = new Date(endDate); base.setHours(23, 59, 59, 999);
  return Array.from({ length: 10 }, (_, i) => {
    const offsets = [29 - i * 3, 28 - i * 3, 27 - i * 3];
    const bucketVals = offsets.map(off => {
      const d = new Date(base); d.setDate(d.getDate() - off);
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      return getVal(logs.filter(x => {
        const t = new Date(getLogDate(x));
        return !isNaN(t.getTime()) && t >= s && t <= e;
      }));
    });
    const nz  = bucketVals.filter(v => v > 0);
    const avg = nz.length ? nz.reduce((a, v) => a + v, 0) / nz.length : 0;
    const lDay = new Date(base); lDay.setDate(lDay.getDate() - offsets[0]);
    return { lbl: `${lDay.getDate()}/${lDay.getMonth() + 1}`, total: avg };
  });
}

/**
 * 10 weekly buckets (each exactly 7 days) — total workouts per week.
 * Covers 70 days ≈ 2.5 months.
 * i=0 → oldest week, i=9 → most recent week.
 */
function weeklyTotalBuckets(logs, endDate, getVal) {
  const base = new Date(endDate); base.setHours(23, 59, 59, 999);
  return Array.from({ length: 10 }, (_, i) => {
    // Newest bucket (i=9) ends at base; each step back = 7 days
    const daysToEnd = (9 - i) * 7;
    const wEnd   = new Date(base); wEnd.setDate(wEnd.getDate() - daysToEnd); wEnd.setHours(23, 59, 59, 999);
    const wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 6);    wStart.setHours(0, 0, 0, 0);
    const weekLogs = logs.filter(x => {
      const t = new Date(getLogDate(x));
      return !isNaN(t.getTime()) && t >= wStart && t <= wEnd;
    });
    return {
      lbl: `${wStart.getDate()}/${wStart.getMonth() + 1}`,
      total: getVal(weekLogs),
    };
  });
}

/** 12 monthly buckets — avg of active days (duration/volume). */
function avgBucketsMonthlyWorkout(logs, yr, getVal) {
  return Array.from({ length: 12 }, (_, m) => {
    const ms = new Date(yr, m, 1, 0, 0, 0, 0);
    const me = new Date(yr, m + 1, 0, 23, 59, 59, 999);
    const monthLogs = logs.filter(x => {
      const t = new Date(getLogDate(x));
      return !isNaN(t.getTime()) && t >= ms && t <= me;
    });
    if (!monthLogs.length) return { lbl: MO[m], total: 0 };
    const daysInMonth = new Date(yr, m + 1, 0).getDate();
    const dailyVals = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = new Date(yr, m, day, 0, 0, 0, 0);
      const de = new Date(yr, m, day, 23, 59, 59, 999);
      const val = getVal(monthLogs.filter(x => {
        const t = new Date(getLogDate(x));
        return !isNaN(t.getTime()) && t >= ds && t <= de;
      }));
      if (val > 0) dailyVals.push(val);
    }
    const avg = dailyVals.length ? dailyVals.reduce((a, v) => a + v, 0) / dailyVals.length : 0;
    return { lbl: MO[m], total: avg };
  });
}

/** 12 monthly buckets — total count per month (frequency). */
function totalBucketsMonthlyWorkout(logs, yr, getVal) {
  return Array.from({ length: 12 }, (_, m) => {
    const ms = new Date(yr, m, 1, 0, 0, 0, 0);
    const me = new Date(yr, m + 1, 0, 23, 59, 59, 999);
    return {
      lbl: MO[m],
      total: getVal(logs.filter(x => {
        const t = new Date(getLogDate(x));
        return !isNaN(t.getTime()) && t >= ms && t <= me;
      })),
    };
  });
}

// ─── WorkoutChart ─────────────────────────────────────────────────────────────

function WorkoutChart({
  workoutLogs, metric, period, colors,
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

  function make3DayXlbls(endDate) {
    const base = new Date(endDate); base.setHours(23, 59, 59, 999);
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(base); d.setDate(d.getDate() - (29 - i * 3));
      return { x: CP.l + (i / 9) * pw, lbl: `${d.getDate()}/${d.getMonth() + 1}` };
    });
  }

  function makeYearXlbls() {
    return MO.map((lbl, i) => ({ x: CP.l + (i / 11) * pw, lbl }));
  }

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

  const isFrequency = metric === "frequency";

  // Frequency month uses a 70-day window (10 weekly buckets); others use 30 days.
  const monthWindowDays = isFrequency ? 70 : 30;

  const chart = useMemo(() => {
    const isDuration  = metric === "duration";
    const isFreq      = metric === "frequency";
    const col = isDuration ? "#f97316" : isFreq ? "#22c55e" : "#6366f1";

    const getDurVal  = dl => dl.reduce((s, l) => s + toN(l.durationMinutes), 0);
    const getVolVal  = dl => dl.reduce((s, l) => s + getLogVolume(l), 0);
    const getFreqVal = dl => dl.length;
    const getVal = isDuration ? getDurVal : isFreq ? getFreqVal : getVolVal;

    function makeLineChart(vals, xlbls, gradId) {
      const { lo, hi } = yPad(vals);
      const pts = vals.map((v, i) => ({ x: xlbls[i].x, y: scaleY(v, lo, hi) }));
      return { type: "line", series: [{ color: col, pts, gradId }], xlbls, lo, hi };
    }

    function lineStats(vals, unit, avgLabel) {
      const nonZero = vals.filter(v => v > 0);
      if (!nonZero.length) return [];
      const avg  = avgNonZero(vals);
      const best = Math.max(...nonZero);
      return [
        { label: avgLabel || "Avg / session", value: Math.round(avg).toLocaleString(), unit, color: col },
        { label: "Best",                      value: Math.round(best).toLocaleString(), unit, color: col },
      ];
    }

    function buildFreqStats(total, periodWeeks) {
      return [
        { label: "Sessions",   value: String(total), unit: "",  color: "#22c55e" },
        { label: "Avg / week", value: (total / Math.max(1, periodWeeks)).toFixed(1), unit: "", color: "#22c55e" },
      ];
    }

    // ── WEEK (7 daily points) ────────────────────────────────────────────────
    if (period === "Week") {
      const end   = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      const range = `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
      const bkts  = dailyWorkoutBuckets(workoutLogs, 7, end, getVal);
      const vals  = bkts.map(b => b.total);
      if (!vals.some(v => v > 0)) return null;
      const xlbls = bkts.map((b, i) => ({ x: CP.l + (i / 6) * pw, lbl: b.lbl }));
      if (isFreq) {
        const total = vals.reduce((s, v) => s + v, 0);
        return { ...makeBars(bkts, 7, "#22c55e"), range, stats: buildFreqStats(total, 1) };
      }
      return {
        ...makeLineChart(vals, xlbls, `wc_${metric}_w`), range,
        stats: lineStats(vals, isDuration ? "min" : "kg"),
      };
    }

    // ── MONTH ────────────────────────────────────────────────────────────────
    // Frequency: 10 weekly buckets spanning 70 days (~2.5 months)
    // Duration/Volume: 10 three-day-avg buckets spanning 30 days
    if (period === "Month") {
      const windowDays = isFreq ? 69 : 29; // inclusive span
      const offsetStep = isFreq ? 70 : 30;
      const end   = new Date(); end.setDate(end.getDate() + monthOffset * offsetStep);
      const start = new Date(end); start.setDate(start.getDate() - windowDays); start.setHours(0, 0, 0, 0);
      const range = `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;

      if (isFreq) {
        const bkts = weeklyTotalBuckets(workoutLogs, end, getFreqVal);
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const total = vals.reduce((s, v) => s + v, 0);
        return { ...makeBars(bkts, 10, "#22c55e"), range, periodLabel: "Weekly total", stats: buildFreqStats(total, 10) };
      }

      const xlbls = make3DayXlbls(end);
      const bkts  = avgBuckets3DayWorkout(workoutLogs, end, getVal);
      const vals  = bkts.map(b => b.total);
      if (!vals.some(v => v > 0)) return null;
      return {
        ...makeLineChart(vals, xlbls, `wc_${metric}_m`), range, periodLabel: "3-session avg",
        stats: lineStats(vals, isDuration ? "min" : "kg"),
      };
    }

    // ── YEAR (12 monthly buckets) ─────────────────────────────────────────────
    if (period === "Year") {
      const yr    = new Date().getFullYear() + yearOffset;
      const range = String(yr);
      const xlbls = makeYearXlbls();

      if (isFreq) {
        const bkts = totalBucketsMonthlyWorkout(workoutLogs, yr, getFreqVal);
        const vals = bkts.map(b => b.total);
        if (!vals.some(v => v > 0)) return null;
        const total = vals.reduce((s, v) => s + v, 0);
        return { ...makeBars(bkts, 12, "#22c55e"), range, periodLabel: "Per month", stats: buildFreqStats(total, 52) };
      }

      const bkts = avgBucketsMonthlyWorkout(workoutLogs, yr, getVal);
      const vals = bkts.map(b => b.total);
      if (!vals.some(v => v > 0)) return null;
      return {
        ...makeLineChart(vals, xlbls, `wc_${metric}_y`), range, periodLabel: "Avg / month",
        stats: lineStats(vals, isDuration ? "min" : "kg", "Avg / month"),
      };
    }

    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutLogs, metric, period, weekOffset, monthOffset, yearOffset]);

  const yAxis = useMemo(() => {
    if (!chart) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      y:   CP.t + ph * (1 - i / 4),
      lbl: Math.round(chart.lo + (i / 4) * (chart.hi - chart.lo)).toLocaleString(),
    }));
  }, [chart, ph]);

  // How far back user can navigate (oldest available data)
  const minOffset = useMemo(() => {
    const dates = (workoutLogs || []).map(e => new Date(getLogDate(e)).getTime()).filter(t => !isNaN(t));
    if (!dates.length) return 0;
    const earliest = Math.min(...dates);
    const diffDays = (earliest - Date.now()) / 86400000;
    if (period === "Week")  return Math.ceil(diffDays / 7);
    if (period === "Month") return Math.ceil(diffDays / monthWindowDays);
    if (period === "Year")  return new Date(earliest).getFullYear() - new Date().getFullYear();
    return 0;
  }, [workoutLogs, period, monthWindowDays]);

  const offset = period === "Week" ? weekOffset : period === "Month" ? monthOffset : yearOffset;
  const setOff = period === "Week" ? setWeekOffset : period === "Month" ? setMonthOffset : setYearOffset;
  const atMin  = offset <= minOffset;
  const col    = metric === "duration" ? "#f97316" : metric === "frequency" ? "#22c55e" : "#6366f1";

  const emptyRange = useMemo(() => {
    if (period === "Week") {
      const end = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const s = new Date(end); s.setDate(s.getDate() - 6);
      return `${s.getDate()}/${s.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
    }
    if (period === "Month") {
      const windowDays = isFrequency ? 69 : 29;
      const offsetStep = isFrequency ? 70 : 30;
      const end = new Date(); end.setDate(end.getDate() + monthOffset * offsetStep);
      const s   = new Date(end); s.setDate(s.getDate() - windowDays);
      return `${s.getDate()}/${s.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
    }
    return String(new Date().getFullYear() + yearOffset);
  }, [period, weekOffset, monthOffset, yearOffset, isFrequency]);

  const navBar = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, paddingHorizontal: 2 }}>
      <TouchableOpacity
        onPress={() => setOff(Math.max(minOffset, offset - 1))}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        disabled={atMin}
      >
        <Ionicons name="chevron-back-circle" size={22} color={atMin ? colors.border : col} />
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
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        disabled={offset >= 0}
      >
        <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : col} />
      </TouchableOpacity>
    </View>
  );

  if (!chart) {
    return (
      <View>
        {navBar}
        <View style={{ height: H, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Ionicons name="barbell-outline" size={28} color={colors.textSecondary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>No data for this period</Text>
          <Text style={{ fontSize: 11, color: colors.textLight, textAlign: "center" }}>
            Complete workouts to see trends here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {navBar}

      <Svg width={W} height={H}>
        <Defs>
          <ClipPath id="wcClip">
            <Rect x={CP.l} y={CP.t} width={pw} height={ph} />
          </ClipPath>
          {chart.type === "line" && chart.series?.map(s => (
            <LinearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color} stopOpacity="0.22" />
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

        {/* Line fill + stroke (clipped) */}
        {chart.type === "line" && chart.series?.map(s => (
          <G key={`ls_${s.gradId}`} clipPath="url(#wcClip)">
            {s.pts.length >= 2 && (
              <Path
                d={`${monotonePath(s.pts, CP.t, botY)} L${s.pts[s.pts.length - 1].x.toFixed(1)},${botY} L${s.pts[0].x.toFixed(1)},${botY} Z`}
                fill={`url(#${s.gradId})`}
              />
            )}
            {s.pts.length >= 2 && (
              <Path d={monotonePath(s.pts, CP.t, botY)} stroke={s.color} strokeWidth={2.5} fill="none" />
            )}
          </G>
        ))}
        {chart.type === "line" && chart.series?.map(s =>
          s.pts.map((pt, pi) => (
            <SvgCircle key={`d${pi}`} cx={pt.x} cy={pt.y} r={3} fill="#fff" stroke={s.color} strokeWidth={1.5} />
          ))
        )}

        {/* X-axis labels */}
        {chart.xlbls?.map((xl, i) =>
          xl.lbl ? (
            <SvgText key={`x${i}`} x={xl.x} y={H - 4} textAnchor="middle" fontSize={9} fill={colors.textSecondary}>{xl.lbl}</SvgText>
          ) : null
        )}
      </Svg>

      {/* Stats row below chart */}
      {chart.stats?.length > 0 && (
        <View style={{
          flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around",
          paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
        }}>
          {chart.stats.map((s, i) => (
            <View key={i} style={{ alignItems: "center", minWidth: 70, gap: 2 }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: "600" }}>{s.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: s.color }}>
                {s.value}
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>{s.unit ? ` ${s.unit}` : ""}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutTrackingScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth }   = useAuth();
  const userId     = auth?.userId;

  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");

  const [metric,      setMetric]      = useState("duration");
  const [period,      setPeriod]      = useState("Week");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset,  setYearOffset]  = useState(0);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setErr("");
    try {
      const res = await apiClient.get(`/api/workout-logs/user/${userId}`);
      setWorkoutLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setErr("Failed to load workout data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const records = useMemo(() => computeRecords(workoutLogs), [workoutLogs]);

  const recentWorkouts = useMemo(() => {
    return [...workoutLogs]
      .sort((a, b) => new Date(b.performedAt || b.completedAt || 0) - new Date(a.performedAt || a.completedAt || 0))
      .slice(0, 8);
  }, [workoutLogs]);

  const recordsSummary = useMemo(() => ({
    exercises: records.length,
    totalSets: records.reduce((s, r) => s + r.totalSets, 0),
    totalSessions: workoutLogs.length,
  }), [records, workoutLogs]);

  const activeMeta = WORKOUT_METRICS.find(m => m.key === metric);
  const st         = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={st.screen} edges={["top"]}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Workout Tracking</Text>
        <View style={st.headerIconBtn} />
      </View>

      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>

        {/* ── Metric selector (4 icon tabs) ── */}
        <View style={st.metricRow}>
          {WORKOUT_METRICS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[st.metricBtn, metric === m.key && { backgroundColor: m.color + "20", borderColor: m.color, borderWidth: 1.5 }]}
              onPress={() => setMetric(m.key)}
              activeOpacity={0.75}
            >
              <View style={[st.metricIcon, { backgroundColor: m.color + (metric === m.key ? "30" : "15") }]}>
                <Ionicons name={m.icon} size={18} color={m.color} />
              </View>
              <Text style={[st.metricLabel, metric === m.key && { color: m.color, fontWeight: "700" }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Period tabs (hidden for Records) ── */}
        {metric !== "records" && (
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
        )}

        {err ? <Text style={st.errText}>{err}</Text> : null}

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <ActivityIndicator color={activeMeta?.color || colors.primary} />
          </View>

        ) : metric === "records" ? (
          /* ── Records tab ── */
          <View style={st.card}>
            <View style={st.cardTitleRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="trophy-outline" size={18} color="#f59e0b" />
                <Text style={st.cardTitle}>Personal Records</Text>
              </View>
              {records.length > 0 && (
                <Text style={[st.unitBadge, { color: "#f59e0b", borderColor: "#f59e0b50" }]}>
                  {records.length} exercises
                </Text>
              )}
            </View>
            <Text style={st.metricDesc}>{activeMeta?.desc}</Text>

            {/* Summary pills */}
            {records.length > 0 && (
              <View style={st.summaryRow}>
                {[
                  { label: "Workouts",   value: String(recordsSummary.totalSessions), color: "#22c55e" },
                  { label: "Exercises",  value: String(recordsSummary.exercises),     color: "#f59e0b" },
                  { label: "Total sets", value: String(recordsSummary.totalSets),     color: "#6366f1" },
                ].map(item => (
                  <View key={item.label} style={st.summaryPill}>
                    <Text style={[st.summaryVal, { color: item.color }]}>{item.value}</Text>
                    <Text style={st.summaryLbl}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {records.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: 8 }}>
                <Ionicons name="trophy-outline" size={32} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" }}>No records yet</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, opacity: 0.7, textAlign: "center" }}>
                  Complete workouts with sets logged to see your personal bests here.
                </Text>
              </View>
            ) : (
              records.map((rec, i) => {
                const rankColor = i === 0 ? "#f59e0b" : i === 1 ? "#64748b" : i === 2 ? "#cd7c32" : colors.textSecondary;
                const rankBg    = i === 0 ? "#f59e0b18" : i === 1 ? "#64748b15" : i === 2 ? "#cd7c3215" : colors.background;
                return (
                  <View key={rec.name} style={[st.recordRow, i === records.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[st.rankBadge, { backgroundColor: rankBg }]}>
                      <Text style={[st.rankText, { color: rankColor }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={st.recordName} numberOfLines={1}>{rec.name}</Text>
                      <Text style={st.recordMeta}>
                        {rec.sessions} session{rec.sessions !== 1 ? "s" : ""} · {rec.totalSets} set{rec.totalSets !== 1 ? "s" : ""} done
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      {rec.bestWeight > 0 && (
                        <View style={[st.recBadge, { backgroundColor: "#6366f115" }]}>
                          <Ionicons name="barbell-outline" size={10} color="#6366f1" />
                          <Text style={[st.recBadgeText, { color: "#6366f1" }]}>{rec.bestWeight} kg</Text>
                        </View>
                      )}
                      <View style={[st.recBadge, { backgroundColor: "#f59e0b15" }]}>
                        <Ionicons name="checkmark-circle-outline" size={10} color="#f59e0b" />
                        <Text style={[st.recBadgeText, { color: "#f59e0b" }]}>{rec.totalSets} sets</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

        ) : (
          /* ── Chart tab (Duration / Volume / Frequency) ── */
          <View style={st.card}>
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

            <WorkoutChart
              workoutLogs={workoutLogs}
              metric={metric}
              period={period}
              colors={colors}
              weekOffset={weekOffset}   setWeekOffset={setWeekOffset}
              monthOffset={monthOffset} setMonthOffset={setMonthOffset}
              yearOffset={yearOffset}   setYearOffset={setYearOffset}
            />
          </View>
        )}

        {/* ── Recent Workouts ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="time-outline" size={18} color="#22c55e" />
              <Text style={st.cardTitle}>Recent Workouts</Text>
            </View>
            {workoutLogs.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate("WorkoutHistory")}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentWorkouts.length === 0 && !loading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: 8 }}>
              <Ionicons name="barbell-outline" size={28} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: font.sm }}>No workouts logged yet.</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, opacity: 0.7 }}>
                Complete a workout to see your history here.
              </Text>
            </View>
          ) : (
            recentWorkouts.map((log, i) => {
              const d       = new Date(log.performedAt || log.completedAt || "");
              const dateStr = isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              const mins    = Math.round(Number(log.durationMinutes) || 0);
              const details = safeJson(log?.detailsJson);
              const exCount = details?.exercises?.length || 0;
              return (
                <View key={log.id ?? i} style={[st.recentRow, i === recentWorkouts.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={st.recentIcon}>
                    <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.recentName}>{log.workoutName || "Workout"}</Text>
                    <Text style={st.recentMeta}>
                      {dateStr}
                      {mins > 0 ? ` · ${mins} min` : ""}
                      {exCount > 0 ? ` · ${exCount} exercise${exCount !== 1 ? "s" : ""}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

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
    headerTitle:   { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    headerIconBtn: { width: 36, alignItems: "center" },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },

    metricRow: { flexDirection: "row", gap: spacing.sm },
    metricBtn: {
      flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.lg,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    metricIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    metricLabel: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },

    tabsWrap: {
      flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: 4, gap: 4,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    tab:       { flex: 1, paddingVertical: 9, borderRadius: radius.md, alignItems: "center" },
    tabText:   { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    tabTextOn: { color: "#fff" },

    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle:    { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    unitBadge:    { fontSize: 11, fontWeight: "700", borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    metricDesc:   { fontSize: 11, color: colors.textSecondary, marginTop: -4 },

    // Records
    summaryRow:  { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md },
    summaryPill: { alignItems: "center", gap: 2 },
    summaryVal:  { fontSize: 18, fontWeight: "800" },
    summaryLbl:  { fontSize: 10, color: colors.textSecondary, fontWeight: "600" },
    recordRow:   { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    rankBadge:   { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    rankText:    { fontSize: 12, fontWeight: "800" },
    recordName:  { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    recordMeta:  { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    recBadge:    { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
    recBadgeText:{ fontSize: 11, fontWeight: "700" },

    // Recent workouts
    recentRow:  { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
    recentIcon: { width: 28, alignItems: "center" },
    recentName: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    recentMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

    errText: { color: colors.error, fontSize: font.sm, textAlign: "center" },
  });
}
