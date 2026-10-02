import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Dimensions, FlatList, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Svg, Path, Circle as SvgCircle, G, Defs, LinearGradient, Stop, Line as SvgLine, Text as SvgText } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import { devLog } from "../../utils/devLog";
import {
  BLE_AVAILABLE,
  buildUserCommands,
  buildUserCommand,
  calculateBodyComposition,
  clearPairedDevice,
  connectAndMeasure,
  destroyBleManager,
  getPairedDevice,
  savePairedDevice,
  scanForDevices,
} from "../../utils/QNScaleService";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W  = SCREEN_W - spacing.lg * 4;

const METRICS = [
  { key: "weightValue",     label: "Weight",       unit: "kg",  color: "#0b84ff", scaleOnly: false, decimals: 2, icon: "scale-outline",    sources: ["manual","scale"] },
  { key: "bodyFatPercent",  label: "Body Fat",     unit: "%",   color: "#f97316", scaleOnly: true,  decimals: 1, icon: "flame-outline",    sources: ["scale"] },
  { key: "muscleMassKg",    label: "Muscle",       unit: "kg",  color: "#6366f1", scaleOnly: true,  decimals: 1, icon: "barbell-outline",  sources: ["scale"] },
  { key: "proteinPercent",  label: "Protein",      unit: "%",   color: "#a855f7", scaleOnly: true,  decimals: 1, icon: "nutrition-outline",sources: ["scale"] },
  { key: "bmi",             label: "BMI",          unit: "",    color: "#22c55e", scaleOnly: true,  decimals: 1, icon: "body-outline",     sources: ["scale"] },
  { key: "visceralFatLevel",label: "Visceral Fat", unit: "",    color: "#ef4444", scaleOnly: true,  decimals: 1, icon: "fitness-outline",  sources: ["scale"] },
  { key: "boneMassKg",      label: "Bone Mass",    unit: "kg",  color: "#eab308", scaleOnly: true,  decimals: 2, icon: "medical-outline",  sources: ["scale"] },
  { key: "waterPercent",    label: "Water",        unit: "%",   color: "#06b6d4", scaleOnly: true,  decimals: 1, icon: "rainy-outline",    sources: ["scale"] },
];

// Metrics the user can log manually (not scale-only)
const MANUAL_METRICS = new Set(["weightValue"]);

const PERIODS = ["Week", "Month", "Year"];

function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v, d) { return v == null ? "—" : Number(v).toFixed(d); }

/**
 * Convert a profile height value + unit to centimetres.
 * Handles: "ft"/"feet"/"foot", "m"/"meter"/"meters",
 *          "cm"/"centimeter"/"centimeters", and the common case
 *          where the unit is stored as "cm" but the value was saved
 *          as a decimal-metres number (e.g. 1.63 instead of 163).
 */
function toHeightCm(heightValue, heightUnit) {
  const v = toN(heightValue);
  if (!v) return 0;
  const u = (heightUnit || "cm").toLowerCase().trim();
  if (u.startsWith("f"))   return v * 30.48;   // ft / feet / foot
  if (u === "m" || u.startsWith("met")) return v * 100;  // m / meter / meters
  // "cm" — if the value is suspiciously small (< 3) it was likely entered in
  // metres by mistake; auto-correct rather than silently break body comp.
  if (v > 0 && v < 3)     return v * 100;
  return v;                                    // cm (normal case)
}

// ── Custom SVG chart ──────────────────────────────────────────────────────────
const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CP = { l: 46, r: 14, t: 26, b: 28 };        // chart padding

/** Monotone cubic (Fritsch-Carlson) spline → SVG cubic bezier path.
 *  Never overshoots between adjacent data points; control-point Y is clamped
 *  to [yMin, yMax] so the curve stays within chart bounds. */
function monotonePath(pts, yMin, yMax) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  // Secant slopes
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }
  // Tangents
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if ((d[i - 1] >= 0 && d[i] <= 0) || (d[i - 1] <= 0 && d[i] >= 0)) {
      m[i] = 0; // local extremum — prevent overshoot
    } else {
      m[i] = (d[i - 1] + d[i]) / 2;
    }
  }
  // Monotonicity constraint (Fritsch-Carlson step 5)
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
    const cp1x = pts[i].x + h / 3;
    const cp2x = pts[i + 1].x - h / 3;
    let cp1y = pts[i].y + (m[i] * h) / 3;
    let cp2y = pts[i + 1].y - (m[i + 1] * h) / 3;
    // Clamp control-point Y to chart bounds (convex-hull property keeps curve within bounds)
    if (yMin !== undefined) { cp1y = Math.max(yMin, cp1y); cp2y = Math.max(yMin, cp2y); }
    if (yMax !== undefined) { cp1y = Math.min(yMax, cp1y); cp2y = Math.min(yMax, cp2y); }
    path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return path;
}

function BodyChart({ entries, metric, period, activeMeta, colors,
                     weekOffset, setWeekOffset, monthOffset, setMonthOffset,
                     yearOffset, setYearOffset }) {
  const W = CHART_W;
  const H = 230;
  const pw = W - CP.l - CP.r;
  const ph = H - CP.t - CP.b;
  const col = activeMeta?.color || "#0b84ff";
  const unit = activeMeta?.unit || "";
  const dec = activeMeta?.decimals ?? 1;
  const gradId = `bcg_${metric}`;

  function scaleY(v, lo, hi) { return CP.t + ph * (1 - (v - lo) / (hi - lo)); }

  // ── All hooks must be called unconditionally ───────────────────────────
  const chart = useMemo(() => {
    const sorted = [...entries]
      .filter(e => e[metric] != null)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    function yPad(vals) {
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const p = Math.max(3, (mx - mn) * 0.35);
      return { lo: mn - p, hi: mx + p };
    }

    function dailyBuckets(count, endDate) {
      const base = new Date(endDate); base.setHours(23,59,59,999);
      const start = new Date(base); start.setDate(start.getDate() - (count - 1)); start.setHours(0,0,0,0);
      const bkts = Array.from({length: count}, (_, i) => {
        const d = new Date(start); d.setDate(d.getDate() + i);
        const s = new Date(d); s.setHours(0,0,0,0);
        const e = new Date(d); e.setHours(23,59,59,999);
        const hits = sorted.filter(en => { const t = new Date(en.recordedAt); return t >= s && t <= e; });
        const val = hits.length ? Number(hits[hits.length - 1][metric]) : null;
        return { d, val, lbl: `${d.getDate()}/${d.getMonth()+1}` };
      });
      let last = null;
      const fw = bkts.map(b => { if (b.val !== null) last = b.val; return last; });
      const seed = fw.find(v => v !== null);
      if (seed == null) return null;
      const vals = fw.map(v => v ?? seed);
      return { bkts, vals, start, end: base };
    }

    // ── Week ──────────────────────────────────────────────────────────────
    if (period === "Week") {
      const end = new Date(); end.setDate(end.getDate() + weekOffset * 7);
      const res = dailyBuckets(7, end);
      if (!res) return null;
      const { bkts, vals, start } = res;
      const { lo, hi } = yPad(vals);
      const linePts = vals.map((v, i) => ({ x: CP.l + (i / 6) * pw, y: scaleY(v, lo, hi) }));
      const dots = bkts.map((b, i) => b.val !== null
        ? { x: CP.l + (i/6)*pw, y: scaleY(b.val, lo, hi), lbl: `${b.val.toFixed(dec)}${unit}` }
        : null).filter(Boolean);
      const xlbls = bkts.map((b, i) => ({ x: CP.l + (i/6)*pw, lbl: b.lbl }));
      const range = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
      return { segs: [linePts], dots, xlbls, lo, hi, range };
    }

    // ── Month (30-day scrollable window, daily buckets) ───────────────────
    if (period === "Month") {
      const end = new Date(); end.setDate(end.getDate() + monthOffset * 30);
      const res = dailyBuckets(30, end);
      if (!res) return null;
      const { bkts, vals, start } = res;
      const { lo, hi } = yPad(vals);
      const linePts = vals.map((v, i) => ({ x: CP.l + (i / 29) * pw, y: scaleY(v, lo, hi) }));
      const dots = bkts.map((b, i) => b.val !== null
        ? { x: CP.l + (i/29)*pw, y: scaleY(b.val, lo, hi) }
        : null).filter(Boolean);
      // 5 labels at equal intervals across the 30 days
      const xlbls = [0, 7, 14, 21, 29].map(i => ({ x: CP.l + (i/29)*pw, lbl: bkts[i].lbl }));
      const range = `${start.getDate()}/${start.getMonth()+1} – ${end.getDate()}/${end.getMonth()+1}`;
      return { segs: [linePts], dots, xlbls, lo, hi, range };
    }

    // ── Year (monthly averages for a specific calendar year) ─────────────
    const targetYear = new Date().getFullYear() + yearOffset;
    const yBkts = Array.from({length: 12}, (_, i) => {
      const start = new Date(targetYear, i, 1, 0, 0, 0, 0);
      const end   = new Date(targetYear, i + 1, 0, 23, 59, 59, 999);
      const hits  = sorted.filter(e => { const t = new Date(e.recordedAt); return t >= start && t <= end; });
      const avg   = hits.length ? hits.reduce((s, e) => s + Number(e[metric]), 0) / hits.length : null;
      return { lbl: MO[i], avg };
    });
    if (!yBkts.some(b => b.avg !== null)) return null;
    const { lo, hi } = yPad(yBkts.filter(b => b.avg !== null).map(b => b.avg));
    const xpts = yBkts.map((b, i) => ({
      x: CP.l + (i / 11) * pw,
      y: b.avg !== null ? scaleY(b.avg, lo, hi) : null,
      has: b.avg !== null, lbl: b.lbl,
    }));
    const segs = []; let cur = [];
    xpts.forEach(p => {
      if (p.has) { cur.push({ x: p.x, y: p.y }); }
      else { if (cur.length >= 2) segs.push(cur); cur = []; }
    });
    if (cur.length >= 2) segs.push(cur);
    if (cur.length === 1) segs.push(cur); // single-point segment still renders a dot
    return { segs, dots: xpts.filter(p => p.has).map(p => ({ x: p.x, y: p.y })),
             xlbls: xpts.map(p => ({ x: p.x, lbl: p.lbl })), lo, hi,
             range: String(targetYear) };
  }, [entries, metric, period, weekOffset, monthOffset, yearOffset]);

  // Y-axis — always computed (no early return before this) ──────────────
  const yAxis = useMemo(() => {
    if (!chart) return [];
    return Array.from({length: 6}, (_, i) => ({
      y: CP.t + ph * (1 - i / 5),
      lbl: Math.round(chart.lo + (i / 5) * (chart.hi - chart.lo)).toString(),
    }));
  }, [chart]);

  // ── Minimum offset: don't scroll back past the earliest data point ────
  const minOffset = useMemo(() => {
    const dates = entries
      .filter(e => e[metric] != null)
      .map(e => new Date(e.recordedAt).getTime());
    if (!dates.length) return 0;
    const earliest = Math.min(...dates);
    const todayMs = Date.now();
    const diffDays = (earliest - todayMs) / 86400000; // negative number
    if (period === "Week")  return Math.ceil(diffDays / 7);
    if (period === "Month") return Math.ceil(diffDays / 30);
    if (period === "Year")  return new Date(earliest).getFullYear() - new Date().getFullYear(); // e.g. -1
    return 0;
  }, [entries, metric, period]);

  // ── Variables needed before any conditional return ────────────────────
  const botY = CP.t + ph;
  const showNav = period === "Week" || period === "Month" || period === "Year";
  const offset  = period === "Week" ? weekOffset : period === "Month" ? monthOffset : yearOffset;
  const setOff  = period === "Week" ? setWeekOffset : period === "Month" ? setMonthOffset : setYearOffset;

  // ── Early return AFTER all hooks — keep nav visible so user can go fwd ─
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
    } else if (period === "Year") {
      emptyRange = String(new Date().getFullYear() + yearOffset);
    }
    const atMin = offset <= minOffset;
    return (
      <View>
        {showNav && (
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom: 6, paddingHorizontal: 2 }}>
            <TouchableOpacity
              onPress={() => setOff(Math.max(minOffset, offset - 1))}
              hitSlop={{top:10,bottom:10,left:10,right:10}}
              disabled={atMin}
            >
              <Ionicons name="chevron-back-circle" size={22} color={atMin ? colors.border : colors.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: "600" }}>{emptyRange}</Text>
            <TouchableOpacity
              onPress={() => setOff(Math.min(0, offset + 1))}
              hitSlop={{top:10,bottom:10,left:10,right:10}}
              disabled={offset >= 0}
            >
              <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : colors.primary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 230, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Ionicons name="analytics-outline" size={28} color={colors.textSecondary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>No data for this period</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Scroll navigation row (Week + Month) */}
      {showNav && (
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom: 6, paddingHorizontal: 2 }}>
          <TouchableOpacity
            onPress={() => setOff(Math.max(minOffset, offset - 1))}
            hitSlop={{top:10,bottom:10,left:10,right:10}}
            disabled={offset <= minOffset}
          >
            <Ionicons name="chevron-back-circle" size={22} color={offset <= minOffset ? colors.border : colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: "600" }}>{chart.range}</Text>
          <TouchableOpacity
            onPress={() => setOff(Math.min(0, offset + 1))}
            hitSlop={{top:10,bottom:10,left:10,right:10}}
            disabled={offset >= 0}
          >
            <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={col} stopOpacity="0.18" />
            <Stop offset="1" stopColor={col} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines + Y labels */}
        {yAxis.map((yl, i) => (
          <G key={`y${i}`}>
            <SvgLine x1={CP.l} y1={yl.y} x2={CP.l + pw} y2={yl.y} stroke={colors.border} strokeWidth={0.6} strokeDasharray="4,4" />
            <SvgText x={CP.l - 5} y={yl.y + 4} textAnchor="end" fontSize={9} fill={colors.textSecondary}>{yl.lbl}</SvgText>
          </G>
        ))}

        {/* Fill */}
        {chart.segs.map((seg, si) => seg.length >= 2 && (
          <Path key={`f${si}`}
            d={`${monotonePath(seg, CP.t, botY)} L${seg[seg.length-1].x.toFixed(1)},${botY} L${seg[0].x.toFixed(1)},${botY} Z`}
            fill={`url(#${gradId})`} />
        ))}

        {/* Line */}
        {chart.segs.map((seg, si) => seg.length >= 2 && (
          <Path key={`l${si}`} d={monotonePath(seg, CP.t, botY)} stroke={col} strokeWidth={2.5} fill="none" />
        ))}

        {/* Dots */}
        {chart.dots.map((pt, i) => (
          <G key={`d${i}`}>
            <SvgCircle cx={pt.x} cy={pt.y} r={period === "Month" ? 2 : 3.5} fill="#fff" stroke={col} strokeWidth={1.5} />
            {period === "Week" && pt.lbl && (
              <SvgText x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize={9} fill={col} fontWeight="bold">{pt.lbl}</SvgText>
            )}
          </G>
        ))}

        {/* X labels */}
        {chart.xlbls.map((xl, i) => (
          <SvgText key={`x${i}`} x={xl.x} y={H - 4} textAnchor="middle" fontSize={9} fill={colors.textSecondary}>{xl.lbl}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ── Body Composition display card ─────────────────────────────────────────────
function CompositionRow({ label, value, unit, color }) {
  if (value == null) return null;
  return (
    <View style={compStyles.row}>
      <View style={[compStyles.dot, { backgroundColor: color }]} />
      <Text style={compStyles.label}>{label}</Text>
      <Text style={[compStyles.value, { color }]}>{value}{unit}</Text>
    </View>
  );
}
const compStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: font.sm, color: "#64748b" },
  value: { fontSize: font.sm, fontWeight: "700" },
});

// ═════════════════════════════════════════════════════════════════════════════
export default function BodyTrackingScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const userId = auth?.userId;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [userProfile, setUserProfile] = useState(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [metric, setMetric]     = useState("weightValue");
  const [period, setPeriod]     = useState("Week");
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = current week, -1 = prev week, …
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current 30-day window, -1 = prev, …
  const [yearOffset, setYearOffset] = useState(0);   // 0 = current year, -1 = last year, …
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ── Manual log modal ──────────────────────────────────────────────────────
  const [manualOpen, setManualOpen] = useState(false);
  const [manualVal, setManualVal]   = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualErr, setManualErr]   = useState("");

  // ── BLE: paired device + auto-connect ────────────────────────────────────
  const [pairedDevice, setPairedDevice]         = useState(null);
  // scaleStatus: idle | searching | connecting | measuring | result
  const [scaleStatus, setScaleStatus]           = useState("idle");
  const [measureOpen, setMeasureOpen]           = useState(false); // measurement bottom sheet
  const [pairOpen, setPairOpen]                 = useState(false); // initial pairing sheet
  const [pairPhase, setPairPhase]               = useState("idle"); // idle | scanning
  const [pairDevices, setPairDevices]           = useState([]);
  const [pairMsg, setPairMsg]                   = useState("");
  const [liveWeight, setLiveWeight]             = useState(null);
  const [scaleMeasurement, setScaleMeasurement] = useState(null);
  const bleCleanupRef      = useRef(null);
  const pairScanCleanupRef = useRef(null);
  const doConnectRef       = useRef(null); // set by useFocusEffect, shared with selectPairDevice
  const writeInitRef       = useRef(null); // function to re-send the init command to the scale
  const sheetOpenedRef     = useRef(false); // true once sheet has been opened for the current session
  const motionWindowRef    = useRef([]);    // rolling weight window for screen-side motion detection
  const savingRef          = useRef(false); // prevents duplicate auto-saves from repeated stable packets
  const pulseAnim          = useRef(new Animated.Value(1)).current;

  // Keep a ref to userProfile so BLE callbacks never have a stale copy
  const userProfileRef = useRef(null);
  useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);

  // Re-send init command whenever the user profile loads / changes.
  // doConnect runs immediately on focus — before the profile API call returns —
  // so the first write uses CMD_START (zeros). Once the profile arrives, we
  // write the real profile command so the scale shows its BLE symbol.
  useEffect(() => {
    if (!userProfile || !writeInitRef.current) return;
    const p = userProfile;
    const hCm = toHeightCm(p?.heightValue, p?.heightUnit);
    if (hCm < 100 || toN(p?.age) < 10) return;
    const cmd = buildUserCommand(Math.round(hCm), Math.round(toN(p.age)), p?.gender);
    devLog("[BLE] re-sending init cmd with profile:",
      cmd.map(b => b.toString(16).padStart(2,"0")).join(" "));
    writeInitRef.current(cmd);
  }, [userProfile]);

  // ── Pulse animation ───────────────────────────────────────────────────────
  // "measuring" = user is on the scale → pulse
  // "ready"     = silently connected, waiting → no pulse
  useEffect(() => {
    if (scaleStatus === "measuring" || pairPhase === "scanning") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [scaleStatus, pairPhase]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setErr("");
    try {
      let wu = "kg";
      try {
        const raw = await AsyncStorage.getItem("sff_settings_v1");
        const p = raw ? JSON.parse(raw) : null;
        wu = p?.units?.weight || "kg";
      } catch {}
      setWeightUnit(wu);

      const [wRes, pRes] = await Promise.all([
        apiClient.get(`/api/weight-entries/user/${userId}`),
        apiClient.get(`/api/user-profile/${userId}`).catch(() => ({ data: null })),
      ]);

      const raw = Array.isArray(wRes.data) ? wRes.data : [];
      // Sort newest first for history list, oldest first for chart
      setEntries(raw.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
      if (pRes.data) setUserProfile(pRes.data);
    } catch {
      setErr("Failed to load body tracking data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => () => destroyBleManager(), []);

  // ── Auto-connect on screen focus ─────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    let active     = true;
    let retryTimer = null;

    function cancelBle() {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (bleCleanupRef.current) {
        try { bleCleanupRef.current(); } catch {}
        bleCleanupRef.current = null;
      }
      writeInitRef.current    = null; // prevent stale profile re-sends
      sheetOpenedRef.current  = false;
      motionWindowRef.current = [];
      savingRef.current       = false;
    }

    // ── Shared connect helper ────────────────────────────────────────────────
    // deviceOrSaved: either a full ble-plx Device (from pairing scan) or the
    //   plain { id, name } object stored in AsyncStorage.
    // connectAndMeasure returns its cleanup synchronously — we store it in
    // bleCleanupRef immediately so screen blur can cancel even a pending
    // autoConnect (i.e. while waiting for the scale to wake up).
    function doConnect(deviceOrSaved) {
      if (!active) return;
      devLog("[BLE] doConnect called, device:", deviceOrSaved?.id || deviceOrSaved, "active:", active);
      setScaleStatus("connecting");

      // Build the full 4-command init sequence (profile, device, session, heartbeat)
      // so the scale shows its BLE symbol and enters measurement mode.
      // If the profile isn't loaded yet, pass null → service uses built-in defaults.
      const p = userProfileRef.current;
      const hCm = toHeightCm(p?.heightValue, p?.heightUnit);
      const userCmd = (hCm >= 100 && toN(p?.age) >= 10)
        ? buildUserCommands(Math.round(hCm), Math.round(toN(p.age)), p?.gender)
        : null;
      if (__DEV__) {
        if (userCmd) {
          console.log("[BLE] userCmd:", userCmd[0].map(b => b.toString(16).padStart(2,"0")).join(" ") + " (+ 3 more)");
        } else {
          console.log(`[BLE] userCmd: null — profile: heightValue=${p?.heightValue} heightUnit=${p?.heightUnit} → hCm=${hCm}, age=${p?.age} (using defaults)`);
        }
      }

      // connectAndMeasure is now synchronous-return: cleanup is available
      // immediately, even before the GATT connection resolves.
      const stopMeasure = connectAndMeasure(
        deviceOrSaved,
        // onMeasurement — fires for every packet from the scale.
        // 0x12 packets = scale in replay/idle mode (cached last measurement).
        // 0x1C / 0x1D packets = scale in live measurement mode.
        // We open the sheet only when the scale is actually measuring the user:
        //   (a) packetType is 0x1C / 0x1D  — scale confirmed live mode, OR
        //   (b) weight changes ≥ 0.3 kg across 4 packets — scale is live but
        //       still sending 0x12 type (varies by firmware version).
        (measurement) => {
          if (!active) return;
          setLiveWeight(measurement.weight);

          if (!sheetOpenedRef.current) {
            // Screen-side motion detection (backup for firmware that keeps 0x12 in live mode)
            const win = motionWindowRef.current;
            win.push(measurement.weight);
            if (win.length > 4) win.shift();
            const range = win.length >= 2
              ? Math.max(...win) - Math.min(...win)
              : 0;

            const livePacket = measurement.isLiveMode; // 0x1C or 0x1D
            const motionDetected = range >= 0.3;

            if (!livePacket && !motionDetected) return; // still in replay/idle, wait

            // User is actively measuring — open the sheet
            sheetOpenedRef.current = true;
            motionWindowRef.current = [];
            setMeasureOpen(true);
            setScaleStatus("measuring");
          }

          if (measurement.isStable && !savingRef.current) {
            savingRef.current = true;
            const p = userProfileRef.current;
            const hCm = toHeightCm(p?.heightValue, p?.heightUnit);
            if (__DEV__) console.log(
              `[BLE] stable — profile: heightValue=${p?.heightValue} heightUnit=${p?.heightUnit}` +
              ` → hCm=${hCm}, age=${p?.age}, gender=${p?.gender}, impedance=${measurement.impedance}`
            );
            const comp = calculateBodyComposition(
              measurement.weight, hCm, toN(p?.age), p?.gender, measurement.impedance
            );
            if (__DEV__) console.log("[BLE] body comp:", JSON.stringify(comp));
            const data = { weight: measurement.weight, ...comp };
            setScaleMeasurement(data);
            setScaleStatus("saving");
            saveScaleResult(data);
          }
        },
        // onError
        (err) => {
          if (!active) return;
          devLog("[BLE] error:", err);
          sheetOpenedRef.current = false;
          bleCleanupRef.current  = null;
          setMeasureOpen(false);
          // Scale disconnected on its own (not user-triggered) → auto-retry
          const hwDisconnect = typeof err === "string" && (
            err.includes("isconnect") || err.includes("device") || err.includes("Device")
          );
          if (hwDisconnect) {
            setScaleStatus("searching");
            retryTimer = setTimeout(() => { if (active) startAutoConnect(); }, 1500);
          } else {
            setScaleStatus("idle");
          }
        },
        userCmd,
        // onConnected: GATT is up and init cmd written — stay silent, no sheet yet.
        // The sheet opens only when the user steps on and the first measurement fires.
        () => {
          if (!active) return;
          setScaleStatus("ready"); // connected & waiting, but sheet stays hidden
        },
        // onWriteReady: gives us a function to re-send the init command later
        // (used by the userProfile useEffect above when the profile finishes loading)
        (writeFn) => { writeInitRef.current = writeFn; },
      );

      // Store cleanup immediately — cancels even a pending connection
      bleCleanupRef.current = stopMeasure;
    }

    // ── Auto-connect on focus ────────────────────────────────────────────────
    // No scan needed — connectAndMeasure handles direct-connect + autoConnect
    // fallback internally, so the scale wakes up any time and connects itself.
    async function startAutoConnect() {
      if (!active) return;
      devLog("[BLE] startAutoConnect, BLE_AVAILABLE:", BLE_AVAILABLE);
      const paired = await getPairedDevice();
      devLog("[BLE] pairedDevice from storage:", paired);
      if (!active) return;
      setPairedDevice(paired);
      if (!paired || !BLE_AVAILABLE) { setScaleStatus("idle"); return; }

      setScaleStatus("searching");
      setLiveWeight(null);
      setScaleMeasurement(null);

      doConnect(paired); // pass saved { id, name } — no scan required
    }

    // Expose for the initial-pair path (selectPairDevice calls this)
    doConnectRef.current = doConnect;

    startAutoConnect();

    return () => {
      active = false;
      cancelBle(); // also resets sheetOpenedRef
      setScaleStatus("idle");
      setMeasureOpen(false);
      setLiveWeight(null);
      setScaleMeasurement(null);
    };
  }, []));

  // Reset history expansion whenever the active metric changes
  useEffect(() => { setShowAllHistory(false); }, [metric]);

  // ── Stats (min/avg/max) from raw entries for current period ─────────────
  const stats = useMemo(() => {
    const cutoff = new Date();
    if (period === "Week")  cutoff.setDate(cutoff.getDate() - 7);
    else if (period === "Month") cutoff.setMonth(cutoff.getMonth() - 9);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);
    const vals = entries
      .filter(e => e[metric] != null && new Date(e.recordedAt) >= cutoff)
      .map(e => Number(e[metric]));
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    return { min, max, avg: vals.reduce((s, v) => s + v, 0) / vals.length };
  }, [entries, metric, period]);

  // ── Current (latest) value ────────────────────────────────────────────────
  const currentEntry = entries.find((e) => e[metric] != null);
  const currentVal   = currentEntry ? currentEntry[metric] : null;
  const activeMeta   = METRICS.find((m) => m.key === metric);

  // ── Manual save ───────────────────────────────────────────────────────────
  async function saveManual() {
    const v = parseFloat(manualVal);
    const isWeight = metric === "weightValue";

    if (isWeight) {
      const isLbs = weightUnit === "lbs";
      const [lo, hi] = isLbs ? [44, 660] : [20, 300];
      if (!v || v < lo || v > hi) {
        setManualErr(`Enter a valid weight (${lo}–${hi} ${weightUnit}).`);
        return;
      }
    } else {
      // circumference: 20–300 cm is a safe range
      if (!v || v < 20 || v > 300) {
        setManualErr("Enter a valid measurement (20–300 cm).");
        return;
      }
    }

    setManualSaving(true); setManualErr("");
    try {
      if (isWeight) {
        await apiClient.post("/api/weight-entries", {
          userId, weightValue: v, weightUnit, source: "manual",
          recordedAt: new Date().toISOString(),
        });
      } else {
        await apiClient.post("/api/weight-entries", {
          userId,
          weightUnit: "kg",
          source: "measurement",
          recordedAt: new Date().toISOString(),
          [metric]: v,          // e.g. waistCm: 85.0
        });
      }
      setManualOpen(false); setManualVal("");
      load();
    } catch {
      setManualErr("Could not save. Try again.");
    } finally { setManualSaving(false); }
  }

  // ── Pairing flow (first-time only, opened from header button) ───────────
  function openPairModal() {
    setPairPhase("idle");
    setPairDevices([]);
    setPairMsg("");
    setPairOpen(true);
  }

  async function startPairScan() {
    setPairPhase("scanning");
    setPairDevices([]);
    setPairMsg("Looking for nearby scales…");
    const stop = await scanForDevices(
      (device) => setPairDevices((prev) =>
        prev.find((d) => d.id === device.id) ? prev : [...prev, device],
      ),
      (e) => setPairMsg(e),
    );
    pairScanCleanupRef.current = stop;
  }

  async function selectPairDevice(device) {
    // Stop the pairing scan
    if (pairScanCleanupRef.current) { pairScanCleanupRef.current(); pairScanCleanupRef.current = null; }
    // Cancel any ongoing auto-connect attempt
    if (bleCleanupRef.current) { try { bleCleanupRef.current(); } catch {} bleCleanupRef.current = null; }

    await savePairedDevice(device);
    setPairedDevice({ id: device.id, name: device.name || device.localName || "Smart Scale" });
    setPairOpen(false);
    setPairPhase("idle");
    setLiveWeight(null);
    setScaleMeasurement(null);

    // Immediately connect via the same shared helper used by auto-connect.
    // doConnect is synchronous (connectAndMeasure returns cleanup immediately).
    if (doConnectRef.current) doConnectRef.current(device);
  }

  function closePairModal() {
    if (pairScanCleanupRef.current) { pairScanCleanupRef.current(); pairScanCleanupRef.current = null; }
    setPairOpen(false);
    setPairPhase("idle");
  }

  function disconnectScale() {
    if (bleCleanupRef.current) { try { bleCleanupRef.current(); } catch {} bleCleanupRef.current = null; }
    writeInitRef.current   = null;
    sheetOpenedRef.current = false;
    setScaleStatus("idle");
    setMeasureOpen(false);
    setLiveWeight(null);
    setScaleMeasurement(null);
  }

  async function forgetScale() {
    disconnectScale();
    await clearPairedDevice();
    setPairedDevice(null);
  }

  // ── Measurement sheet (auto-shown when scale sends readings) ─────────────
  function closeMeasureSheet() {
    if (bleCleanupRef.current) { try { bleCleanupRef.current(); } catch {} bleCleanupRef.current = null; }
    setMeasureOpen(false);
    setScaleStatus("idle");
    setLiveWeight(null);
    setScaleMeasurement(null);
    savingRef.current      = false;
    sheetOpenedRef.current = false;
    motionWindowRef.current = [];
  }

  async function saveScaleResult(data) {
    if (!data) return;
    try {
      await apiClient.post("/api/weight-entries", {
        userId,
        weightValue:      data.weight,
        weightUnit:       "kg",
        source:           "scale",
        recordedAt:       new Date().toISOString(),
        bodyFatPercent:   data.bodyFatPercent,
        muscleMassKg:     data.muscleMassKg,
        visceralFatLevel: data.visceralFatLevel,
        bmi:              data.bmi,
        boneMassKg:       data.boneMassKg,
        waterPercent:     data.waterPercent,
        bmr:              data.bmr,
        proteinPercent:   data.proteinPercent,
      });
      load();
      setScaleStatus("saved");
      setTimeout(() => closeSheetOnly(), 1500);
    } catch {
      setScaleStatus("saveError");
      savingRef.current = false; // allow retry
    }
  }

  // Close the measurement sheet but keep the BLE connection alive so the
  // user can weigh themselves again without reopening the page.
  function closeSheetOnly() {
    setMeasureOpen(false);
    setScaleStatus("ready");
    setLiveWeight(null);
    setScaleMeasurement(null);
    savingRef.current       = false;
    sheetOpenedRef.current  = false;
    motionWindowRef.current = [];
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = useMemo(() => makeStyles(colors), [colors]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Body Tracking</Text>
        {pairedDevice ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons
              name={scaleStatus !== "idle" ? "bluetooth" : "bluetooth-outline"}
              size={16}
              color={scaleStatus !== "idle" ? colors.primary : colors.textSecondary}
            />
            <Text style={[s.scaleBtnText, {
              color: scaleStatus !== "idle" ? colors.primary : colors.textSecondary,
              maxWidth: 90,
            }]} numberOfLines={1}>
              {pairedDevice.name}
            </Text>
            {/* Disconnect — shown when scale is active */}
            {scaleStatus !== "idle" ? (
              <TouchableOpacity onPress={disconnectScale} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.error} />
              </TouchableOpacity>
            ) : (
              /* Forget — long-press target when idle */
              <TouchableOpacity onPress={forgetScale} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
                <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity onPress={openPairModal} style={s.scaleBtn}>
            <Ionicons name="add-circle-outline" size={18} color={BLE_AVAILABLE ? colors.primary : colors.textSecondary} />
            <Text style={[s.scaleBtnText, { color: BLE_AVAILABLE ? colors.primary : colors.textSecondary }]}>Pair Scale</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {err ? <Text style={s.errText}>{err}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}

        {/* Current value hero */}
        <View style={[s.heroCard, { borderColor: activeMeta?.color + "44" }]}>
          <View style={[s.heroIconWrap, { backgroundColor: activeMeta?.color + "22" }]}>
            <Ionicons name={activeMeta?.icon || "body-outline"} size={28} color={activeMeta?.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel}>{activeMeta?.label}</Text>
            {activeMeta?.scaleOnly && currentVal == null ? (
              <Text style={s.heroScaleNote}>Connect a smart scale to track this</Text>
            ) : (
              <Text style={[s.heroValue, { color: activeMeta?.color }]}>
                {fmt(currentVal, activeMeta?.decimals ?? 1)}
                <Text style={s.heroUnit}> {activeMeta?.unit}</Text>
              </Text>
            )}
            {currentEntry && (
              <Text style={s.heroDate}>
                Last recorded {new Date(currentEntry.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            )}
          </View>
        </View>

        {/* Period selector */}
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

        {/* Metric selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricScroll}>
          {METRICS.map((m) => {
            const active = metric === m.key;
            const hasData = entries.some((e) => e[m.key] != null);
            const dimmed = !hasData && m.scaleOnly && !active;
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  s.metricChip,
                  active && { backgroundColor: m.color, borderColor: m.color },
                  dimmed && s.metricChipEmpty,
                ]}
                onPress={() => setMetric(m.key)}
              >
                <View style={{ alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    {dimmed && (
                      <Ionicons name="bluetooth-outline" size={10} color={colors.textLight} />
                    )}
                    <Text style={[s.metricChipText, active && { color: "#fff" }, dimmed && { color: colors.textLight }]}>
                      {m.label}
                    </Text>
                    {m.unit ? <Text style={[s.metricChipUnit, active && { color: "#ffffffbb" }, dimmed && { color: colors.textLight }]}>{m.unit}</Text> : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
                    {m.sources.includes("scale") && <Ionicons name="scale-outline" size={9} color={active ? "#ffffffaa" : colors.textLight} />}
                    {m.sources.includes("scan")  && <Ionicons name="camera-outline" size={9} color={active ? "#ffffffaa" : colors.textLight} />}
                    {m.sources.includes("manual") && !m.sources.includes("scan") && !m.sources.includes("scale") && <Ionicons name="create-outline" size={9} color={active ? "#ffffffaa" : colors.textLight} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Chart card */}
        <View style={s.chartCard}>
          {activeMeta?.scaleOnly && !entries.some((e) => e[metric] != null) ? (
            <View style={s.scaleOnlyPlaceholder}>
              <Ionicons name="bluetooth-outline" size={36} color={colors.textLight} />
              <Text style={s.scaleOnlyTitle}>Smart Scale Required</Text>
              <Text style={s.scaleOnlySub}>
                {activeMeta.label} is measured automatically when you weigh yourself with your smart scale.
              </Text>
              {pairedDevice ? (
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#22c55e" />
                  <Text style={{ fontSize: font.sm, color: colors.textSecondary, textAlign: "center" }}>
                    {pairedDevice.name} is paired.{"\n"}Open the app near your scale to auto-connect.
                  </Text>
                  {(scaleStatus === "searching" || scaleStatus === "connecting") && (
                    <ActivityIndicator color={colors.primary} />
                  )}
                  {scaleStatus === "ready" && (
                    <Text style={{ fontSize: font.sm, color: "#22c55e", fontWeight: "600" }}>
                      ● Connected — step on the scale to begin
                    </Text>
                  )}
                </View>
              ) : (
                <TouchableOpacity style={[s.connectScaleBtn, { backgroundColor: colors.primary }]} onPress={openPairModal}>
                  <Ionicons name="bluetooth" size={16} color="#fff" />
                  <Text style={s.connectScaleBtnText}>Pair Scale</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : entries.some((e) => e[metric] != null) ? (
            <>
              <BodyChart
                entries={entries}
                metric={metric}
                period={period}
                activeMeta={activeMeta}
                colors={colors}
                weekOffset={weekOffset}
                setWeekOffset={setWeekOffset}
                monthOffset={monthOffset}
                setMonthOffset={setMonthOffset}
                yearOffset={yearOffset}
                setYearOffset={setYearOffset}
              />
              {/* Stats row */}
              {stats && (
                <View style={s.statsRow}>
                  {[
                    ["Min",  fmt(stats.min, activeMeta?.decimals ?? 1)],
                    ["Avg",  fmt(stats.avg, activeMeta?.decimals ?? 1)],
                    ["Max",  fmt(stats.max, activeMeta?.decimals ?? 1)],
                  ].map(([lbl, val]) => (
                    <View key={lbl} style={s.statBox}>
                      <Text style={s.statLbl}>{lbl}</Text>
                      <Text style={[s.statVal, { color: activeMeta?.color }]}>
                        {val}{activeMeta?.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Log manually — weight and measurement metrics */}
              {MANUAL_METRICS.has(metric) && (
                <TouchableOpacity
                  style={[s.manualBtn, { marginTop: spacing.sm }]}
                  onPress={() => { setManualErr(""); setManualVal(""); setManualOpen(true); }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={s.manualBtnText}>Log {activeMeta?.label} Manually</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={s.emptyChart}>
              <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
              <Text style={s.emptyText}>No {activeMeta?.label} data yet.</Text>
              <Text style={s.emptySub}>
                {MANUAL_METRICS.has(metric)
                  ? "Log your first measurement to start tracking."
                  : "Connect a smart scale to start tracking."}
              </Text>
              {MANUAL_METRICS.has(metric) && (
                <TouchableOpacity
                  style={[s.manualBtn, { marginTop: spacing.md, alignSelf: "stretch" }]}
                  onPress={() => { setManualErr(""); setManualVal(""); setManualOpen(true); }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={s.manualBtnText}>Log {activeMeta?.label} Manually</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Body Measurements button */}
        <TouchableOpacity
          style={s.measurementsBtn}
          onPress={() => navigation.navigate("BodyMeasurements")}
          activeOpacity={0.8}
        >
          <View style={s.measurementsBtnLeft}>
            <View style={[s.measurementsBtnIcon, { backgroundColor: "#8b5cf622" }]}>
              <Ionicons name="body-outline" size={20} color="#8b5cf6" />
            </View>
            <View>
              <Text style={s.measurementsBtnTitle}>Body Measurements</Text>
              <Text style={s.measurementsBtnSub}>Neck, chest, waist, hips, arms, legs…</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* History list — filtered to current metric only */}
        {(() => {
          const metricEntries = entries.filter(e => e[metric] != null);
          if (!metricEntries.length) return null;
          const PREVIEW = 10;
          const shown   = showAllHistory ? metricEntries : metricEntries.slice(0, PREVIEW);
          const hasMore = metricEntries.length > PREVIEW;
          return (
            <View style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={s.sectionTitle}>History</Text>
                <Text style={s.historyCount}>{metricEntries.length} {metricEntries.length === 1 ? "entry" : "entries"}</Text>
              </View>
              {shown.map((e, i) => {
                const val     = e[metric];
                const d       = new Date(e.recordedAt);
                const dateStr = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                const isScale = e.source === "scale";
                return (
                  <View key={e.id ?? i} style={[s.historyRow, i > 0 && s.historyRowBorder]}>
                    <View style={s.historyLeft}>
                      <Ionicons
                        name={isScale ? "bluetooth-outline" : "create-outline"}
                        size={14}
                        color={isScale ? colors.primary : colors.textSecondary}
                      />
                      <View>
                        <Text style={s.historyDate}>{dateStr}</Text>
                        <Text style={s.historySource}>{isScale ? "Smart Scale" : "Manual"}</Text>
                      </View>
                    </View>
                    <Text style={s.historyVal}>
                      {fmt(val, activeMeta?.decimals ?? 1)}{activeMeta?.unit}
                    </Text>
                  </View>
                );
              })}
              {hasMore && (
                <TouchableOpacity
                  style={s.viewAllBtn}
                  onPress={() => setShowAllHistory(v => !v)}
                >
                  <Text style={s.viewAllText}>
                    {showAllHistory
                      ? "Show less"
                      : `View all ${metricEntries.length} entries`}
                  </Text>
                  <Ionicons
                    name={showAllHistory ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })()}
      </ScrollView>


      {/* ── Manual log modal ─────────────────────────────────────────────── */}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Log {activeMeta?.label}</Text>
            <Text style={s.modalSub}>
              {metric === "weightValue"
                ? `Enter your weight in ${weightUnit === "lbs" ? "pounds" : "kilograms"}.`
                : `Enter your ${activeMeta?.label.toLowerCase()} measurement in centimetres.`}
            </Text>
            <TextInput
              style={s.weightInput}
              value={manualVal}
              onChangeText={setManualVal}
              placeholder={
                metric === "weightValue"
                  ? (weightUnit === "lbs" ? "e.g. 172" : "e.g. 75.5")
                  : "e.g. 85"
              }
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
            {manualErr ? <Text style={s.modalErr}>{manualErr}</Text> : null}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setManualOpen(false)}>
                <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveManual} disabled={manualSaving}>
                {manualSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Pair Scale Modal (first-time pairing only) ───────────────────── */}
      <Modal visible={pairOpen} transparent animationType="slide" onRequestClose={closePairModal}>
        <View style={s.bleOverlay}>
          <View style={s.bleSheet}>
            <View style={s.bleHandle} />
            <TouchableOpacity style={s.bleClose} onPress={closePairModal}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {pairPhase === "idle" && (
              <View style={s.bleCenter}>
                <View style={s.bleIconCircle}>
                  <Ionicons name="scale-outline" size={48} color={colors.primary} />
                </View>
                <Text style={s.bleTitle}>Pair Your Scale</Text>
                <Text style={s.bleSub}>
                  Turn on your scale and make sure Bluetooth is enabled. You only need to do this once — after pairing, the app connects automatically.
                </Text>
                {!BLE_AVAILABLE && (
                  <View style={s.bleWarning}>
                    <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                    <Text style={s.bleWarningText}>
                      BLE requires a custom dev build (expo-dev-client). Rebuild to enable.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[s.blePrimaryBtn, { backgroundColor: colors.primary }, !BLE_AVAILABLE && { opacity: 0.5 }]}
                  onPress={startPairScan}
                  disabled={!BLE_AVAILABLE}
                >
                  <Ionicons name="bluetooth" size={18} color="#fff" />
                  <Text style={s.blePrimaryBtnText}>Scan for Scale</Text>
                </TouchableOpacity>
              </View>
            )}

            {pairPhase === "scanning" && (
              <View style={s.bleCenter}>
                <Animated.View style={[s.bleIconCircle, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="bluetooth" size={40} color={colors.primary} />
                </Animated.View>
                <Text style={s.bleTitle}>Scanning…</Text>
                <Text style={s.bleSub}>{pairMsg || "Looking for nearby scales…"}</Text>
                {pairDevices.length > 0 ? (
                  <>
                    <Text style={[s.bleSectionLabel, { color: colors.text }]}>Select your scale:</Text>
                    {pairDevices.map((d) => (
                      <TouchableOpacity key={d.id} style={s.bleDeviceRow} onPress={() => selectPairDevice(d)}>
                        <Ionicons name="scale-outline" size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.bleDeviceName}>{d.name || d.localName || "Smart Scale"}</Text>
                          <Text style={s.bleDeviceId}>{d.id.slice(0, 20)}…</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Measurement Sheet (auto-appears when scale is active) ────────── */}
      <Modal visible={measureOpen} transparent animationType="slide" onRequestClose={closeMeasureSheet}>
        <View style={s.bleOverlay}>
          <View style={s.bleSheet}>
            <View style={s.bleHandle} />

            {/* Close button — hidden while saving so we don't interrupt the API call */}
            {scaleStatus !== "saving" && scaleStatus !== "saved" && (
              <TouchableOpacity style={s.bleClose} onPress={closeMeasureSheet}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Connecting / waiting for scale to wake up */}
            {scaleStatus === "connecting" && (
              <View style={s.bleCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.bleTitle}>Waiting for Scale…</Text>
                <Text style={s.bleSub}>Step on your scale to wake it up, or just wait — the app will connect automatically.</Text>
              </View>
            )}

            {/* Measuring — user is on the scale, weight still settling */}
            {scaleStatus === "measuring" && (
              <View style={s.bleCenter}>
                <Animated.View style={[s.bleIconCircle, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="scale-outline" size={40} color={colors.primary} />
                </Animated.View>
                <Text style={s.bleTitle}>Measuring…</Text>
                <Text style={s.bleSub}>Stand still until the reading stabilises.</Text>
                {liveWeight != null && (
                  <Text style={[s.bleLiveWeight, { color: colors.primary }]}>
                    {liveWeight.toFixed(2)} kg
                  </Text>
                )}
              </View>
            )}

            {/* Saving — stable reading received, saving to API */}
            {scaleStatus === "saving" && scaleMeasurement && (
              <View style={s.bleCenter}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.sm }} />
                <Text style={s.bleTitle}>Saving…</Text>
                <Text style={[s.bleLiveWeight, { color: colors.primary }]}>
                  {scaleMeasurement.weight.toFixed(2)} kg
                </Text>
              </View>
            )}

            {/* Saved — success, auto-closes after 1.5 s */}
            {scaleStatus === "saved" && scaleMeasurement && (
              <View style={s.bleCenter}>
                <View style={[s.bleIconCircle, { backgroundColor: "#22c55e18" }]}>
                  <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                </View>
                <Text style={s.bleTitle}>Saved!</Text>
                <Text style={[s.bleLiveWeight, { color: colors.primary }]}>
                  {scaleMeasurement.weight.toFixed(2)} kg
                </Text>
                {scaleMeasurement.bmi != null && (
                  <View style={{ alignItems: "center", gap: 3, marginTop: spacing.xs }}>
                    <Text style={{ fontSize: font.sm, color: colors.textSecondary }}>
                      BMI {scaleMeasurement.bmi}  ·  {scaleMeasurement.bodyFatPercent}% body fat
                    </Text>
                    {scaleMeasurement.muscleMassKg != null && (
                      <Text style={{ fontSize: font.sm, color: colors.textSecondary }}>
                        {scaleMeasurement.muscleMassKg} kg muscle  ·  {scaleMeasurement.proteinPercent}% protein
                      </Text>
                    )}
                  </View>
                )}
                {!userProfileRef.current?.heightValue && (
                  <Text style={[s.bleProfileNote, { marginTop: spacing.sm }]}>
                    Tip: complete your profile (height, age, gender) for body composition data.
                  </Text>
                )}
              </View>
            )}

            {/* Save error — API call failed, offer retry */}
            {scaleStatus === "saveError" && scaleMeasurement && (
              <View style={s.bleCenter}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                <Text style={s.bleTitle}>Could Not Save</Text>
                <Text style={s.bleSub}>
                  Your measurement of {scaleMeasurement.weight.toFixed(2)} kg could not be saved.
                </Text>
                <View style={[s.modalBtns, { width: "100%", marginTop: spacing.md }]}>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeMeasureSheet}>
                    <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={() => {
                    setScaleStatus("saving");
                    saveScaleResult(scaleMeasurement);
                  }}>
                    <Text style={s.saveBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    scaleBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    scaleBtnText: { fontSize: font.sm, fontWeight: "700" },
    body: { padding: spacing.lg, gap: spacing.md },

    heroCard: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      borderWidth: 1.5,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    },
    heroIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
    heroLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: "600", marginBottom: 2 },
    heroValue: { fontSize: 32, fontWeight: "800", lineHeight: 36 },
    heroUnit: { fontSize: font.base, fontWeight: "600" },
    heroDate: { fontSize: 11, color: colors.textLight, marginTop: 4 },
    heroScaleNote: { fontSize: font.sm, color: colors.textLight, fontStyle: "italic" },

    periodRow: {
      flexDirection: "row", backgroundColor: colors.surface,
      borderRadius: radius.lg, padding: 3, gap: 3,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    periodChip: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: "center" },
    periodText: { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },
    periodTextOn: { color: "#fff" },

    metricScroll: { gap: spacing.sm, paddingVertical: 2 },
    metricChip: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: spacing.md, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    metricChipEmpty: { borderStyle: "dashed", opacity: 0.6 },
    metricChipText: { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },
    metricChipUnit: { fontSize: 10, color: colors.textLight },

    chartCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    statsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    statBox: { alignItems: "center", gap: 3 },
    statLbl: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    statVal: { fontSize: font.base, fontWeight: "800" },

    scaleOnlyPlaceholder: { alignItems: "center", paddingVertical: spacing.xl * 2, gap: spacing.md },
    scaleOnlyTitle: { fontSize: font.lg, fontWeight: "700", color: colors.text },
    scaleOnlySub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    connectScaleBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.xl, paddingVertical: 13, borderRadius: radius.lg, marginTop: spacing.sm },
    connectScaleBtnText: { color: "#fff", fontSize: font.base, fontWeight: "700" },


    emptyChart: { alignItems: "center", paddingVertical: spacing.xl, gap: 8 },
    emptyText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
    emptySub: { color: colors.textSecondary, fontSize: font.sm, opacity: 0.7, textAlign: "center" },

    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    sectionTitle: { fontSize: font.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
    historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
    historyRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    historyLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    historyDate: { fontSize: font.sm, fontWeight: "600", color: colors.text },
    historySource: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    historyVal:   { fontSize: font.base, fontWeight: "700", color: colors.text },
    historyCount: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },

    measurementsBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    measurementsBtnLeft:  { flexDirection: "row", alignItems: "center", gap: spacing.md },
    measurementsBtnIcon:  { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    measurementsBtnTitle: { fontSize: font.base, fontWeight: "700", color: colors.text },
    measurementsBtnSub:   { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    viewAllBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
    viewAllText:  { fontSize: font.sm, fontWeight: "600", color: colors.primary },

    footer: {
      backgroundColor: colors.surface, padding: spacing.lg,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    manualBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.lg, paddingVertical: 13,
    },
    manualBtnText: { color: colors.primary, fontSize: font.base, fontWeight: "700" },

    errText: { color: colors.error, fontSize: font.sm, textAlign: "center" },

    // Manual modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, width: "85%", gap: spacing.md },
    modalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    modalSub: { fontSize: font.sm, color: colors.textSecondary },
    weightInput: {
      backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md,
      paddingVertical: 12, fontSize: font.lg, color: colors.text, borderWidth: 1, borderColor: colors.border,
      textAlign: "center",
    },
    modalErr: { fontSize: font.sm, color: colors.error },
    modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.md, alignItems: "center", backgroundColor: colors.background },
    cancelBtnText: { fontSize: font.base, fontWeight: "600" },
    saveBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.md, alignItems: "center", backgroundColor: colors.primary },
    saveBtnText: { color: "#fff", fontSize: font.base, fontWeight: "700" },

    // BLE modal
    bleOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    bleSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: radius.xl * 1.5, borderTopRightRadius: radius.xl * 1.5,
      padding: spacing.xl, paddingBottom: spacing.xl * 2, minHeight: 380, maxHeight: "85%",
    },
    bleHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: spacing.lg },
    bleClose: { position: "absolute", top: spacing.lg, right: spacing.lg, padding: 6 },
    bleCenter: { alignItems: "center", gap: spacing.md, paddingTop: spacing.md },
    bleIconCircle: {
      width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary + "18",
      alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
    },
    bleTitle: { fontSize: font.xl, fontWeight: "800", color: colors.text, textAlign: "center" },
    bleSub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.md },
    bleWarning: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#fff7ed",
      borderRadius: radius.md, padding: spacing.sm, marginHorizontal: spacing.md,
    },
    bleWarningText: { flex: 1, fontSize: 11, color: "#92400e", lineHeight: 16 },
    blePrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.lg, marginTop: spacing.sm },
    blePrimaryBtnText: { color: "#fff", fontSize: font.base, fontWeight: "700" },
    bleSectionLabel: { fontSize: font.sm, fontWeight: "700", alignSelf: "flex-start", marginTop: spacing.md },
    bleDeviceRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md, width: "100%",
      paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    bleDeviceName: { fontSize: font.base, fontWeight: "600", color: colors.text },
    bleDeviceId: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    bleLiveWeight: { fontSize: 48, fontWeight: "900", marginVertical: spacing.md },
    bleResultContainer: { paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
    bleResultHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    bleCompCard: {
      backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md,
      gap: 2, width: "100%",
    },
    bleProfileNote: { fontSize: 11, color: colors.textSecondary, fontStyle: "italic", textAlign: "center" },
  });
}
