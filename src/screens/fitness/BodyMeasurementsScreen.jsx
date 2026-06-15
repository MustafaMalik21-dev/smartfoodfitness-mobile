import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  Svg, Path, Circle as SvgCircle, G, Defs, LinearGradient, Stop,
  Line as SvgLine, Text as SvgText, Rect as SvgRect,
} from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - spacing.lg * 4;
const PX_PER  = 20; // pixels per 1 unit on the tape ruler

// ── 14 body measurements ──────────────────────────────────────────────────────
// bodyX / bodyY = where the connecting line touches the figure in the 300×380 viewBox
const MEASUREMENTS = [
  // ── Left column (7) ─────────────────────────────────────────────────────────
  { key: "neckCm",         label: "Neck",       side: "L", labelY: 58,  bodyX: 143, bodyY: 58,  color: "#0b84ff" },
  { key: "chestCm",        label: "Chest",      side: "L", labelY: 90,  bodyX: 113, bodyY: 90,  color: "#ef4444" },
  { key: "leftBicepCm",    label: "L. Bicep",   side: "L", labelY: 114, bodyX: 88,  bodyY: 114, color: "#f97316" },
  { key: "abdomenCm",      label: "Abdomen",    side: "L", labelY: 141, bodyX: 116, bodyY: 141, color: "#ec4899" },
  { key: "leftForearmCm",  label: "L. Forearm", side: "L", labelY: 163, bodyX: 83,  bodyY: 163, color: "#14b8a6" },
  { key: "leftThighCm",    label: "L. Thigh",   side: "L", labelY: 246, bodyX: 115, bodyY: 246, color: "#eab308" },
  { key: "leftCalfCm",     label: "L. Calf",    side: "L", labelY: 314, bodyX: 112, bodyY: 314, color: "#06b6d4" },
  // ── Right column (7) ────────────────────────────────────────────────────────
  { key: "shoulderCm",     label: "Shoulder",   side: "R", labelY: 75,  bodyX: 190, bodyY: 75,  color: "#8b5cf6" },
  { key: "rightBicepCm",   label: "R. Bicep",   side: "R", labelY: 114, bodyX: 212, bodyY: 114, color: "#f97316" },
  { key: "rightForearmCm", label: "R. Forearm", side: "R", labelY: 152, bodyX: 217, bodyY: 152, color: "#14b8a6" },
  { key: "waistCm",        label: "Waist",      side: "R", labelY: 169, bodyX: 183, bodyY: 169, color: "#6366f1" },
  { key: "hipCm",          label: "Hips",       side: "R", labelY: 196, bodyX: 186, bodyY: 196, color: "#22c55e" },
  { key: "rightThighCm",   label: "R. Thigh",   side: "R", labelY: 246, bodyX: 185, bodyY: 246, color: "#eab308" },
  { key: "rightCalfCm",    label: "R. Calf",    side: "R", labelY: 314, bodyX: 188, bodyY: 314, color: "#06b6d4" },
];

const PERIODS = ["Week", "Month", "Year"];
const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CP = { l: 46, r: 14, t: 26, b: 28 };

// ── Unit helpers ──────────────────────────────────────────────────────────────
function toCm(v, unit)   { return unit === "in" ? v / 0.393701 : v; }
function fromCm(v, unit) { return unit === "in" ? v * 0.393701 : v; }
function unitLabel(unit) { return unit === "in" ? "in" : "cm"; }
function unitRange(unit) { return unit === "in" ? { min: 4, max: 80 } : { min: 10, max: 200 }; }

function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v, d = 1) { return v == null ? "—" : Number(v).toFixed(d); }

// ── Monotone cubic interpolation (Fritsch-Carlson) ────────────────────────────
function monotonePath(pts, yMin, yMax) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i+1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i+1].y - pts[i].y) / dx);
  }
  const m = new Array(n);
  m[0] = d[0]; m[n-1] = d[n-2];
  for (let i = 1; i < n-1; i++) {
    m[i] = ((d[i-1] >= 0 && d[i] <= 0) || (d[i-1] <= 0 && d[i] >= 0)) ? 0 : (d[i-1]+d[i])/2;
  }
  for (let i = 0; i < n-1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i+1] = 0; }
    else {
      const a = m[i]/d[i], b = m[i+1]/d[i], sq = a*a+b*b;
      if (sq > 9) { const t = 3/Math.sqrt(sq); m[i] = t*a*d[i]; m[i+1] = t*b*d[i]; }
    }
  }
  let path = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n-1; i++) {
    const h = pts[i+1].x - pts[i].x;
    const cp1x = pts[i].x + h/3, cp2x = pts[i+1].x - h/3;
    let cp1y = pts[i].y + (m[i]*h)/3, cp2y = pts[i+1].y - (m[i+1]*h)/3;
    if (yMin !== undefined) { cp1y = Math.max(yMin, cp1y); cp2y = Math.max(yMin, cp2y); }
    if (yMax !== undefined) { cp1y = Math.min(yMax, cp1y); cp2y = Math.min(yMax, cp2y); }
    path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pts[i+1].x.toFixed(1)},${pts[i+1].y.toFixed(1)}`;
  }
  return path;
}

// ── Body Diagram ──────────────────────────────────────────────────────────────
function BodyDiagram({ metric, entries, onSelect }) {
  const { colors } = useTheme();
  // body padding (spacing.lg each side) + card padding (spacing.lg each side) = 4×
  const diagramW  = SCREEN_W - spacing.lg * 4;
  const diagramH  = diagramW * (380 / 300);
  const BODY_FILL = "#9ca3af";
  // Background colour used to mask the connecting line behind each label
  const bgFill    = colors.surface;

  return (
    <Svg width={diagramW} height={diagramH} viewBox="0 0 300 380">
      {/* ── Silhouette ─────────────────────────────────────────────────── */}
      <G>
        {/* Head */}
        <SvgCircle cx={150} cy={28} r={22} fill={BODY_FILL} />
        {/* Neck */}
        <SvgRect x={142} y={50} width={16} height={19} rx={3} fill={BODY_FILL} />
        {/* Torso: shoulders → waist → hips */}
        <Path d="M 110,68 L 190,68 L 184,163 L 186,210 L 114,210 L 116,163 Z" fill={BODY_FILL} />
        {/* Left upper arm */}
        <Path d="M 88,70 L 108,70 L 104,148 L 84,148 Z" fill={BODY_FILL} />
        {/* Left lower arm */}
        <Path d="M 84,148 L 102,148 L 100,192 L 80,192 Z" fill={BODY_FILL} />
        {/* Right upper arm */}
        <Path d="M 192,70 L 212,70 L 216,148 L 196,148 Z" fill={BODY_FILL} />
        {/* Right lower arm */}
        <Path d="M 196,148 L 216,148 L 218,192 L 198,192 Z" fill={BODY_FILL} />
        {/* Left thigh */}
        <Path d="M 113,210 L 145,210 L 143,292 L 113,292 Z" fill={BODY_FILL} />
        {/* Left calf */}
        <Path d="M 111,292 L 141,292 L 139,358 L 111,358 Z" fill={BODY_FILL} />
        {/* Right thigh */}
        <Path d="M 155,210 L 187,210 L 187,292 L 157,292 Z" fill={BODY_FILL} />
        {/* Right calf */}
        <Path d="M 159,292 L 189,292 L 189,358 L 161,358 Z" fill={BODY_FILL} />
      </G>

      {/* ── Labels, lines, dots ────────────────────────────────────────── */}
      {MEASUREMENTS.map((m) => {
        const isActive  = metric === m.key;
        const hasData   = entries.some(e => e[m.key] != null);
        // Active = full colour · has data = 70% opacity · no data = grey
        const col       = isActive ? m.color : hasData ? m.color + "b3" : "#b0b8c4";
        const isLeft    = m.side === "L";

        // Left labels: text right-anchored at x=66, line from x=72 to bodyX
        // Right labels: text left-anchored at x=234, line from bodyX to x=228
        const labelX    = isLeft ? 66  : 234;
        const lineFromX = isLeft ? 72  : m.bodyX;
        const lineToX   = isLeft ? m.bodyX : 228;

        return (
          <G key={m.key}>
            {/* Connecting line */}
            <SvgLine
              x1={lineFromX} y1={m.bodyY}
              x2={lineToX}   y2={m.bodyY}
              stroke={col}
              strokeWidth={isActive ? 1.5 : 0.8}
              strokeDasharray={isActive ? undefined : "3,2"}
            />
            {/* Dot on body */}
            <SvgCircle cx={m.bodyX} cy={m.bodyY} r={isActive ? 4.5 : 2.5} fill={col} />
            {/* Background mask — paints over the line where the label sits */}
            <SvgRect
              x={isLeft ? 0   : labelX - 2}
              y={m.labelY - 9}
              width={isLeft ? labelX + 4 : 300 - labelX + 2}
              height={18}
              fill={bgFill}
            />
            {/* Label text */}
            <SvgText
              x={labelX} y={m.labelY + 4}
              textAnchor={isLeft ? "end" : "start"}
              fontSize={9.5}
              fill={col}
              fontWeight={isActive ? "bold" : "normal"}
            >
              {m.label}
            </SvgText>
            {/* Touch hitbox */}
            <SvgRect
              x={isLeft ? 0           : m.bodyX - 5}
              y={m.labelY - 11}
              width={isLeft ? m.bodyX + 6 : 305 - m.bodyX}
              height={22}
              fill="transparent"
              onPress={() => onSelect(m.key)}
            />
          </G>
        );
      })}
    </Svg>
  );
}

// ── Tape Measure Picker ───────────────────────────────────────────────────────
function TapeMeasurePicker({ value, onChange, unit }) {
  const { colors }  = useTheme();
  const scrollRef   = useRef(null);
  const { min, max } = unitRange(unit);
  const RULER_H    = 72;
  const paddingH   = SCREEN_W / 2;
  const totalW     = (max - min) * PX_PER + SCREEN_W;

  // Ticks: every 0.5 units — but only render whole-unit ticks for simplicity
  const ticks = useMemo(() => {
    const arr = [];
    for (let v = min; v <= max; v++) {
      const x      = paddingH + (v - min) * PX_PER;
      const isMaj  = v % 10 === 0;
      const isMed  = v % 5  === 0 && !isMaj;
      const h      = isMaj ? 30 : isMed ? 21 : 13;
      arr.push({ x, h, label: isMaj ? String(v) : null });
    }
    // Half-unit ticks
    for (let v = min + 0.5; v < max; v++) {
      const x = paddingH + (v - min) * PX_PER;
      arr.push({ x, h: 8, label: null });
    }
    return arr;
  }, [min, max, paddingH]);

  // Scroll to value on mount / value-change
  useEffect(() => {
    const targetX = (value - min) * PX_PER;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: targetX, animated: false });
    }, 30);
    return () => clearTimeout(t);
  }, [value, min]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScrollEnd(e) {
    const x   = e.nativeEvent.contentOffset.x;
    const raw = min + x / PX_PER;
    const snapped = Math.round(raw * 2) / 2; // nearest 0.5
    onChange(Math.max(min, Math.min(max, snapped)));
  }

  return (
    <View style={{ height: RULER_H + 28, position: "relative" }}>
      {/* Primary-coloured center indicator */}
      <View pointerEvents="none" style={{
        position: "absolute", left: SCREEN_W / 2 - 1.5, top: 0,
        width: 3, height: RULER_H + 2, backgroundColor: colors.primary,
        zIndex: 10, borderRadius: 2,
      }} />
      {/* Value display below indicator */}
      <View pointerEvents="none" style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        alignItems: "center",
      }}>
        <View style={{
          backgroundColor: colors.primary + "22", borderRadius: radius.md,
          paddingHorizontal: spacing.md, paddingVertical: 3,
        }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>
            {value.toFixed(1)} {unitLabel(unit)}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PX_PER * 0.5}   // 10 px → 0.5 unit snap
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={32}
        contentContainerStyle={{ width: totalW }}
      >
        <Svg width={totalW} height={RULER_H}>
          {/* Background — matches app surface */}
          <SvgRect x={0} y={0} width={totalW} height={RULER_H} fill={colors.surface} />
          {/* Fade-out edges */}
          <SvgRect x={0} y={0} width={paddingH * 0.25} height={RULER_H} fill={colors.background + "cc"} />
          <SvgRect x={totalW - paddingH * 0.25} y={0} width={paddingH * 0.25} height={RULER_H} fill={colors.background + "cc"} />
          {/* Horizontal base line */}
          <SvgLine x1={0} y1={RULER_H - 1} x2={totalW} y2={RULER_H - 1} stroke={colors.border} strokeWidth={1.5} />
          {/* Ticks */}
          {ticks.map((t, i) => (
            <G key={i}>
              <SvgLine
                x1={t.x} y1={RULER_H - t.h - 1}
                x2={t.x} y2={RULER_H - 1}
                stroke={colors.textSecondary}
                strokeWidth={t.h >= 30 ? 1.5 : t.h >= 21 ? 1.1 : 0.7}
              />
              {t.label && (
                <SvgText
                  x={t.x} y={RULER_H - t.h - 5}
                  textAnchor="middle" fontSize={9} fill={colors.textSecondary} fontWeight="600"
                >
                  {t.label}
                </SvgText>
              )}
            </G>
          ))}
        </Svg>
      </ScrollView>
    </View>
  );
}

// ── Measurement Chart ─────────────────────────────────────────────────────────
function MeasurementChart({ entries, metric, period, activeMeta, displayUnit, colors,
                            weekOffset, setWeekOffset, monthOffset, setMonthOffset,
                            yearOffset, setYearOffset }) {
  const W  = CHART_W;
  const H  = 230;
  const pw = W - CP.l - CP.r;
  const ph = H - CP.t - CP.b;
  const col    = activeMeta?.color || "#0b84ff";
  const unit   = unitLabel(displayUnit);
  const gradId = `mcg_${metric}`;

  function scaleY(v, lo, hi) { return CP.t + ph * (1 - (v - lo) / (hi - lo)); }

  const chart = useMemo(() => {
    // Convert all values from cm to displayUnit for charting
    const sorted = entries
      .filter(e => e[metric] != null)
      .map(e => ({ ...e, _v: fromCm(toN(e[metric]), displayUnit) }))
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    function yPad(vals) {
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const p  = Math.max(1, (mx - mn) * 0.35);
      return { lo: mn - p, hi: mx + p };
    }

    function dailyBuckets(count, endDate) {
      const base  = new Date(endDate); base.setHours(23,59,59,999);
      const start = new Date(base); start.setDate(start.getDate() - (count - 1)); start.setHours(0,0,0,0);
      const bkts  = Array.from({ length: count }, (_, i) => {
        const d = new Date(start); d.setDate(d.getDate() + i);
        const s = new Date(d); s.setHours(0,0,0,0);
        const e = new Date(d); e.setHours(23,59,59,999);
        const hits = sorted.filter(en => { const t = new Date(en.recordedAt); return t >= s && t <= e; });
        const val  = hits.length ? hits[hits.length - 1]._v : null;
        return { d, val, lbl: `${d.getDate()}/${d.getMonth()+1}` };
      });
      let last = null;
      const fw   = bkts.map(b => { if (b.val !== null) last = b.val; return last; });
      const seed = fw.find(v => v !== null);
      if (seed == null) return null;
      const vals = fw.map(v => v ?? seed);
      return { bkts, vals, start, end: base };
    }

    if (period === "Week") {
      const end = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const res = dailyBuckets(7, end);
      if (!res) return null;
      const { bkts, vals, start } = res;
      const { lo, hi } = yPad(vals);
      const linePts = vals.map((v, i) => ({ x: CP.l + (i/6)*pw, y: scaleY(v, lo, hi) }));
      const dots    = bkts.map((b, i) => b.val !== null
        ? { x: CP.l+(i/6)*pw, y: scaleY(b.val, lo, hi), lbl: `${b.val.toFixed(1)}${unit}` }
        : null).filter(Boolean);
      const xlbls = bkts.map((b, i) => ({ x: CP.l+(i/6)*pw, lbl: b.lbl }));
      const range = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
      return { segs: [linePts], dots, xlbls, lo, hi, range };
    }

    if (period === "Month") {
      const end = new Date(); end.setDate(end.getDate() + monthOffset * 30);
      const res = dailyBuckets(30, end);
      if (!res) return null;
      const { bkts, vals, start } = res;
      const { lo, hi } = yPad(vals);
      const linePts = vals.map((v, i) => ({ x: CP.l+(i/29)*pw, y: scaleY(v, lo, hi) }));
      const dots    = bkts.map((b, i) => b.val !== null
        ? { x: CP.l+(i/29)*pw, y: scaleY(b.val, lo, hi) }
        : null).filter(Boolean);
      const xlbls = [0,7,14,21,29].map(i => ({ x: CP.l+(i/29)*pw, lbl: bkts[i].lbl }));
      const range = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
      return { segs: [linePts], dots, xlbls, lo, hi, range };
    }

    // Year — monthly averages
    const targetYear = new Date().getFullYear() + yearOffset;
    const yBkts = Array.from({ length: 12 }, (_, i) => {
      const s   = new Date(targetYear, i, 1, 0, 0, 0, 0);
      const e   = new Date(targetYear, i+1, 0, 23, 59, 59, 999);
      const hits = sorted.filter(en => { const t = new Date(en.recordedAt); return t >= s && t <= e; });
      const avg  = hits.length ? hits.reduce((acc, en) => acc + en._v, 0) / hits.length : null;
      return { lbl: MO[i], avg };
    });
    if (!yBkts.some(b => b.avg !== null)) return null;
    const { lo, hi } = yPad(yBkts.filter(b => b.avg !== null).map(b => b.avg));
    const xpts = yBkts.map((b, i) => ({
      x: CP.l + (i/11)*pw, y: b.avg !== null ? scaleY(b.avg, lo, hi) : null,
      has: b.avg !== null, lbl: b.lbl,
    }));
    const segs = []; let cur = [];
    xpts.forEach(p => {
      if (p.has) cur.push({ x: p.x, y: p.y });
      else { if (cur.length >= 1) segs.push(cur); cur = []; }
    });
    if (cur.length >= 1) segs.push(cur);
    return {
      segs, dots: xpts.filter(p => p.has).map(p => ({ x: p.x, y: p.y })),
      xlbls: xpts.map(p => ({ x: p.x, lbl: p.lbl })), lo, hi,
      range: String(targetYear),
    };
  }, [entries, metric, period, weekOffset, monthOffset, yearOffset, displayUnit]);

  const yAxis = useMemo(() => {
    if (!chart) return [];
    return Array.from({ length: 6 }, (_, i) => ({
      y:   CP.t + ph * (1 - i/5),
      lbl: (chart.lo + (i/5) * (chart.hi - chart.lo)).toFixed(1),
    }));
  }, [chart]);

  const minOffset = useMemo(() => {
    const dates = entries.filter(e => e[metric] != null).map(e => new Date(e.recordedAt).getTime());
    if (!dates.length) return 0;
    const earliest = Math.min(...dates), diffDays = (earliest - Date.now()) / 86400000;
    if (period === "Week")  return Math.ceil(diffDays / 7);
    if (period === "Month") return Math.ceil(diffDays / 30);
    if (period === "Year")  return new Date(earliest).getFullYear() - new Date().getFullYear();
    return 0;
  }, [entries, metric, period]);

  const botY   = CP.t + ph;
  const offset = period === "Week" ? weekOffset : period === "Month" ? monthOffset : yearOffset;
  const setOff = period === "Week" ? setWeekOffset : period === "Month" ? setMonthOffset : setYearOffset;

  if (!chart) {
    let emptyRange = "";
    if (period === "Week") {
      const end = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      emptyRange = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
    } else if (period === "Month") {
      const end = new Date(); end.setDate(end.getDate() + monthOffset * 30);
      const start = new Date(end); start.setDate(start.getDate() - 29);
      emptyRange = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
    } else {
      emptyRange = String(new Date().getFullYear() + yearOffset);
    }
    const atMin = offset <= minOffset;
    return (
      <View>
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:6, paddingHorizontal:2 }}>
          <TouchableOpacity onPress={() => setOff(Math.max(minOffset, offset-1))} disabled={atMin} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="chevron-back-circle" size={22} color={atMin ? colors.border : colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize:11, color:colors.textSecondary, fontWeight:"600" }}>{emptyRange}</Text>
          <TouchableOpacity onPress={() => setOff(Math.min(0, offset+1))} disabled={offset >= 0} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ height:230, alignItems:"center", justifyContent:"center", gap:8 }}>
          <Ionicons name="analytics-outline" size={28} color={colors.textSecondary} />
          <Text style={{ fontSize:12, color:colors.textSecondary }}>No data for this period</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:6, paddingHorizontal:2 }}>
        <TouchableOpacity onPress={() => setOff(Math.max(minOffset, offset-1))} disabled={offset <= minOffset} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="chevron-back-circle" size={22} color={offset <= minOffset ? colors.border : colors.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize:11, color:colors.textSecondary, fontWeight:"600" }}>{chart.range}</Text>
        <TouchableOpacity onPress={() => setOff(Math.min(0, offset+1))} disabled={offset >= 0} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={col} stopOpacity="0.18" />
            <Stop offset="1" stopColor={col} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {yAxis.map((yl, i) => (
          <G key={`y${i}`}>
            <SvgLine x1={CP.l} y1={yl.y} x2={CP.l+pw} y2={yl.y} stroke={colors.border} strokeWidth={0.6} strokeDasharray="4,4" />
            <SvgText x={CP.l-5} y={yl.y+4} textAnchor="end" fontSize={9} fill={colors.textSecondary}>{yl.lbl}</SvgText>
          </G>
        ))}
        {chart.segs.map((seg, si) => seg.length >= 2 && (
          <Path key={`f${si}`}
            d={`${monotonePath(seg, CP.t, botY)} L${seg[seg.length-1].x.toFixed(1)},${botY} L${seg[0].x.toFixed(1)},${botY} Z`}
            fill={`url(#${gradId})`} />
        ))}
        {chart.segs.map((seg, si) => seg.length >= 1 && (
          <Path key={`l${si}`} d={monotonePath(seg, CP.t, botY)} stroke={col} strokeWidth={2.5} fill="none" />
        ))}
        {chart.dots.map((pt, i) => (
          <G key={`d${i}`}>
            <SvgCircle cx={pt.x} cy={pt.y} r={period === "Month" ? 2 : 3.5} fill="#fff" stroke={col} strokeWidth={1.5} />
            {period === "Week" && pt.lbl && (
              <SvgText x={pt.x} y={pt.y-10} textAnchor="middle" fontSize={9} fill={col} fontWeight="bold">{pt.lbl}</SvgText>
            )}
          </G>
        ))}
        {chart.xlbls.map((xl, i) => (
          <SvgText key={`x${i}`} x={xl.x} y={H-4} textAnchor="middle" fontSize={9} fill={colors.textSecondary}>{xl.lbl}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function BodyMeasurementsScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth }   = useAuth();
  const insets     = useSafeAreaInsets();
  const userId     = auth?.userId;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [entries,      setEntries]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState("");
  const [measureUnit,  setMeasureUnit]  = useState("cm");  // "cm" | "in"

  // ── UI state ──────────────────────────────────────────────────────────────
  const [metric,       setMetric]       = useState(MEASUREMENTS[0].key);
  const [period,       setPeriod]       = useState("Week");
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [monthOffset,  setMonthOffset]  = useState(0);
  const [yearOffset,   setYearOffset]   = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ── Tape picker value ─────────────────────────────────────────────────────
  const [tapeValue,    setTapeValue]    = useState(50);
  const [saving,       setSaving]       = useState(false);
  const [saveErr,      setSaveErr]      = useState("");
  const [saveOk,       setSaveOk]       = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setErr("");
    try {
      let mu = "cm";
      try {
        const raw = await AsyncStorage.getItem("sff_settings_v1");
        const p   = raw ? JSON.parse(raw) : null;
        mu = p?.units?.measurement || "cm";
      } catch {}
      setMeasureUnit(mu);

      const res = await apiClient.get(`/api/weight-entries/user/${userId}`);
      const raw = Array.isArray(res.data) ? res.data : [];
      setEntries(raw.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
    } catch {
      setErr("Failed to load measurements.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Reset history toggle when metric changes
  useEffect(() => { setShowAllHistory(false); }, [metric]);

  // Update tape value when metric or entries change
  useEffect(() => {
    const lastEntry = entries.find(e => e[metric] != null);
    const { min, max } = unitRange(measureUnit);
    if (lastEntry) {
      const displayed = fromCm(toN(lastEntry[metric]), measureUnit);
      const clamped   = Math.max(min, Math.min(max, displayed));
      setTapeValue(Math.round(clamped * 2) / 2);
    } else {
      setTapeValue(Math.round((min + max) / 2 * 2) / 2);
    }
  }, [metric, entries, measureUnit]);

  // ── Save measurement ──────────────────────────────────────────────────────
  async function saveMeasurement() {
    setSaving(true); setSaveErr(""); setSaveOk(false);
    try {
      const cmValue = toCm(tapeValue, measureUnit);
      await apiClient.post("/api/weight-entries", {
        userId,
        weightUnit: "kg",
        source: "measurement",
        recordedAt: new Date().toISOString(),
        [metric]: parseFloat(cmValue.toFixed(2)),
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
      load();
    } catch {
      setSaveErr("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeMeta   = MEASUREMENTS.find(m => m.key === metric);
  const currentEntry = entries.find(e => e[metric] != null);
  const currentCm    = currentEntry ? toN(currentEntry[metric]) : null;
  const currentDisp  = currentCm != null ? fromCm(currentCm, measureUnit) : null;

  const stats = useMemo(() => {
    const cutoff = new Date();
    if (period === "Week")       cutoff.setDate(cutoff.getDate() - 7);
    else if (period === "Month") cutoff.setMonth(cutoff.getMonth() - 1);
    else                         cutoff.setFullYear(cutoff.getFullYear() - 1);
    const vals = entries
      .filter(e => e[metric] != null && new Date(e.recordedAt) >= cutoff)
      .map(e => fromCm(toN(e[metric]), measureUnit));
    if (!vals.length) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
    };
  }, [entries, metric, period, measureUnit]);

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Body Measurements</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {err ? <Text style={s.errText}>{err}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}

        {/* ── Body Diagram ────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.diagramHeader}>
            <Text style={s.sectionTitle}>Body Measurements</Text>
            <Text style={s.diagramHint}>Tap any label to select</Text>
          </View>
          <BodyDiagram
            metric={metric}
            entries={entries}
            onSelect={(key) => setMetric(key)}
          />
        </View>

        {/* ── Metric chips ────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricScroll}>
          {MEASUREMENTS.map((m) => {
            const active   = metric === m.key;
            const hasData  = entries.some(e => e[m.key] != null);
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  s.metricChip,
                  active && { backgroundColor: m.color, borderColor: m.color },
                  !hasData && !active && s.metricChipEmpty,
                ]}
                onPress={() => setMetric(m.key)}
              >
                <Text style={[s.metricChipText, active && { color: "#fff" }, !hasData && !active && { color: colors.textLight }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Current value + Tape picker + Log button ─────────────────────── */}
        <View style={s.card}>
          <View style={s.pickerHeader}>
            <View style={[s.pickerIconWrap, { backgroundColor: activeMeta?.color + "22" }]}>
              <Ionicons name="resize-outline" size={22} color={activeMeta?.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pickerLabel}>{activeMeta?.label}</Text>
              {currentDisp != null ? (
                <Text style={[s.pickerCurrentVal, { color: activeMeta?.color }]}>
                  Last: {currentDisp.toFixed(1)} {unitLabel(measureUnit)}
                </Text>
              ) : (
                <Text style={s.pickerNoData}>No data recorded yet</Text>
              )}
            </View>
          </View>

          <TapeMeasurePicker
            key={`tape-${metric}-${measureUnit}`}
            value={tapeValue}
            onChange={setTapeValue}
            unit={measureUnit}
          />

          {saveErr ? <Text style={s.saveErr}>{saveErr}</Text> : null}
          <TouchableOpacity
            style={[s.logBtn, { backgroundColor: saveOk ? "#22c55e" : activeMeta?.color }]}
            onPress={saveMeasurement}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : saveOk ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.logBtnText}>Saved!</Text>
              </>
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={s.logBtnText}>Log {activeMeta?.label}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Period selector ──────────────────────────────────────────────── */}
        <View style={s.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[s.periodChip, period === p && { backgroundColor: colors.primary }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[s.periodText, period === p && s.periodTextOn]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Chart card ──────────────────────────────────────────────────── */}
        <View style={s.chartCard}>
          <View style={s.chartTitleRow}>
            <View style={[s.chartTitleDot, { backgroundColor: activeMeta?.color }]} />
            <Text style={s.chartTitle}>{activeMeta?.label} over time</Text>
          </View>
          {entries.some(e => e[metric] != null) ? (
            <>
              <MeasurementChart
                entries={entries}
                metric={metric}
                period={period}
                activeMeta={activeMeta}
                displayUnit={measureUnit}
                colors={colors}
                weekOffset={weekOffset}   setWeekOffset={setWeekOffset}
                monthOffset={monthOffset} setMonthOffset={setMonthOffset}
                yearOffset={yearOffset}   setYearOffset={setYearOffset}
              />
              {stats && (
                <View style={s.statsRow}>
                  {[["Min", stats.min], ["Avg", stats.avg], ["Max", stats.max]].map(([lbl, val]) => (
                    <View key={lbl} style={s.statBox}>
                      <Text style={s.statLbl}>{lbl}</Text>
                      <Text style={[s.statVal, { color: activeMeta?.color }]}>
                        {val.toFixed(1)} {unitLabel(measureUnit)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={s.emptyChart}>
              <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
              <Text style={s.emptyText}>No {activeMeta?.label} data yet</Text>
              <Text style={s.emptySub}>Use the tape picker above to log your first measurement.</Text>
            </View>
          )}
        </View>

        {/* ── History ──────────────────────────────────────────────────────── */}
        {(() => {
          const metricEntries = entries.filter(e => e[metric] != null);
          if (!metricEntries.length) return null;
          const PREVIEW = 10;
          const shown   = showAllHistory ? metricEntries : metricEntries.slice(0, PREVIEW);
          const hasMore = metricEntries.length > PREVIEW;
          return (
            <View style={s.card}>
              <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
                <Text style={s.sectionTitle}>History</Text>
                <Text style={s.historyCount}>{metricEntries.length} {metricEntries.length === 1 ? "entry" : "entries"}</Text>
              </View>
              {shown.map((e, i) => {
                const valCm  = toN(e[metric]);
                const valDsp = fromCm(valCm, measureUnit);
                const d      = new Date(e.recordedAt);
                const dateStr = d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
                return (
                  <View key={e.id ?? i} style={[s.historyRow, i > 0 && s.historyRowBorder]}>
                    <View style={s.historyLeft}>
                      <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                      <View>
                        <Text style={s.historyDate}>{dateStr}</Text>
                        <Text style={s.historySource}>Manual</Text>
                      </View>
                    </View>
                    <Text style={s.historyVal}>
                      {valDsp.toFixed(1)} {unitLabel(measureUnit)}
                    </Text>
                  </View>
                );
              })}
              {hasMore && (
                <TouchableOpacity style={s.viewAllBtn} onPress={() => setShowAllHistory(v => !v)}>
                  <Text style={s.viewAllText}>
                    {showAllHistory ? "Show less" : `View all ${metricEntries.length} entries`}
                  </Text>
                  <Ionicons name={showAllHistory ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    screen:      { flex: 1, backgroundColor: colors.background },
    header:      {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn:   { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    body:        { padding: spacing.lg, gap: spacing.md },
    errText:     { color: colors.error, fontSize: font.sm, textAlign: "center" },

    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width:0, height:2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    sectionTitle:  { fontSize: font.base, fontWeight: "700", color: colors.text },

    diagramHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    diagramHint:   { fontSize: 11, color: colors.textLight, fontStyle: "italic" },

    metricScroll: { gap: spacing.sm, paddingVertical: 2 },
    metricChip: {
      paddingHorizontal: spacing.md, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    metricChipEmpty: { borderStyle: "dashed", opacity: 0.65 },
    metricChipText:  { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },

    pickerHeader:    { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
    pickerIconWrap:  { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
    pickerLabel:     { fontSize: font.base, fontWeight: "700", color: colors.text },
    pickerCurrentVal:{ fontSize: font.sm, fontWeight: "600", marginTop: 2 },
    pickerNoData:    { fontSize: font.sm, color: colors.textLight, marginTop: 2, fontStyle: "italic" },

    logBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 14, borderRadius: radius.lg, marginTop: spacing.sm,
    },
    logBtnText: { color: "#fff", fontSize: font.base, fontWeight: "700" },
    saveErr:    { fontSize: font.sm, color: colors.error, textAlign: "center" },

    periodRow: {
      flexDirection: "row", backgroundColor: colors.surface,
      borderRadius: radius.lg, padding: 3, gap: 3,
      shadowColor: "#000", shadowOffset: { width:0, height:1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    periodChip:   { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: "center" },
    periodText:   { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },
    periodTextOn: { color: "#fff" },

    chartCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      shadowColor: "#000", shadowOffset: { width:0, height:2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    chartTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
    chartTitleDot: { width: 10, height: 10, borderRadius: 5 },
    chartTitle:    { fontSize: font.base, fontWeight: "700", color: colors.text },
    statsRow: {
      flexDirection: "row", justifyContent: "space-around",
      marginTop: spacing.md, paddingTop: spacing.md,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    statBox: { alignItems: "center", gap: 3 },
    statLbl: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    statVal: { fontSize: font.base, fontWeight: "800" },

    emptyChart: { alignItems: "center", paddingVertical: spacing.xl, gap: 8 },
    emptyText:  { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
    emptySub:   { color: colors.textSecondary, fontSize: font.sm, opacity: 0.7, textAlign: "center" },

    historyRow:       { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
    historyRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    historyLeft:      { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    historyDate:      { fontSize: font.sm, fontWeight: "600", color: colors.text },
    historySource:    { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    historyVal:       { fontSize: font.base, fontWeight: "700", color: colors.text },
    historyCount:     { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    viewAllBtn:  { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4, paddingTop:spacing.sm, borderTopWidth:1, borderTopColor:colors.border, marginTop:spacing.xs },
    viewAllText: { fontSize: font.sm, fontWeight: "600", color: colors.primary },
  });
}
