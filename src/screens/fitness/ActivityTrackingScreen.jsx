import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  Svg, Path, Circle as SvgCircle, G, Defs, LinearGradient, Stop,
  Line as SvgLine, Rect as SvgRect, Text as SvgText,
} from "react-native-svg";
import { Linking } from "react-native";
import {
  HK_AVAILABLE,
  initHealthKit,
  getHKStatus,
  getDailySteps,
  getDailyCalories,
  getHeartRateSamples,
} from "../../utils/HealthKitService";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - spacing.lg * 4;
const CP = { l: 46, r: 14, t: 26, b: 28 };
const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STEP_GOAL = 10000; // daily step goal

const METRICS = [
  {
    key: "steps",
    label: "Steps",
    unit: "steps",
    color: "#22c55e",
    icon: "footsteps-outline",
    desc: "Daily step count from your iPhone & Apple Watch",
    chartType: "bar",
  },
  {
    key: "calories",
    label: "Calories",
    unit: "kcal",
    color: "#f97316",
    icon: "flame-outline",
    desc: "Active calories burned throughout the day",
    chartType: "line",
  },
  {
    key: "heartrate",
    label: "Heart Rate",
    unit: "bpm",
    color: "#ef4444",
    icon: "heart-outline",
    desc: "Heart rate readings recorded by your Apple Watch",
    chartType: "line",
  },
];

const PERIODS = ["Week", "Month", "Year"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

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

// ── Chart component ───────────────────────────────────────────────────────────
function ActivityChart({ samples, metric, period, colors,
                         weekOffset, setWeekOffset,
                         monthOffset, setMonthOffset,
                         yearOffset, setYearOffset }) {
  const W  = CHART_W;
  const H  = 230;
  const pw = W - CP.l - CP.r;
  const ph = H - CP.t - CP.b;
  const col     = metric.color;
  const gradId  = `acg_${metric.key}`;
  const isBar   = metric.chartType === "bar";

  // date string → value lookup map
  const byDay = useMemo(() => {
    const m = {};
    for (const s of samples) {
      const key = s.date.slice(0, 10);
      // For HR keep last sample of day; for others sum
      if (metric.key === "heartrate") {
        if (!m[key] || s.date > m[key]._raw) m[key] = { value: s.value, _raw: s.date };
      } else {
        m[key] = (m[key] || 0) + s.value;
      }
    }
    return m;
  }, [samples, metric.key]);

  function scaleY(v, lo, hi) { return CP.t + ph * (1 - (v - lo) / (hi - lo)); }

  function yPad(vals) {
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const p  = Math.max(1, (mx - mn) * 0.25);
    return { lo: Math.max(0, mn - p), hi: mx + p };
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  const chart = useMemo(() => {
    // ── Week: 7 daily points ──────────────────────────────────────────────
    if (period === "Week") {
      const base = new Date(); base.setDate(base.getDate() + weekOffset * 7);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() - (6 - i));
        const key = dateKey(d);
        const raw = byDay[key];
        const val = metric.key === "heartrate" ? raw?.value ?? null : raw ?? null;
        return {
          d, key, val,
          lbl: `${d.getDate()}/${d.getMonth()+1}`,
        };
      });
      const present = days.filter(d => d.val !== null);
      if (!present.length) return null;
      const vals   = days.map(d => d.val ?? 0);
      const { lo, hi } = yPad(present.map(d => d.val));
      const range  = `${days[0].lbl} – ${days[6].lbl}`;
      const xOf    = (i) => CP.l + (i / 6) * pw;
      if (isBar) {
        const barW = pw / 7 * 0.6;
        const bars = days.map((d, i) => ({
          x: xOf(i) - barW/2,
          h: d.val != null ? ph * (d.val / (hi || 1)) : 0,
          val: d.val, lbl: d.lbl,
        }));
        return { kind:"bar", bars, xlbls: days.map((d,i) => ({ x: xOf(i), lbl: d.lbl })), lo, hi, range, barW };
      }
      const pts = days.map((d, i) => ({ x: xOf(i), y: d.val != null ? scaleY(d.val, lo, hi) : null, val: d.val }));
      const segs = []; let cur = [];
      pts.forEach(p => { if (p.y != null) cur.push({x:p.x, y:p.y}); else { if (cur.length) segs.push(cur); cur = []; }});
      if (cur.length) segs.push(cur);
      const dots = pts.filter(p => p.y != null).map(p => ({ x: p.x, y: p.y }));
      return { kind:"line", segs, dots, xlbls: days.map((d,i) => ({ x: xOf(i), lbl: d.lbl })), lo, hi, range };
    }

    // ── Month: daily buckets for 30-day window ────────────────────────────
    if (period === "Month") {
      const base = new Date(); base.setDate(base.getDate() + monthOffset * 30);
      const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() - (29 - i));
        const key = dateKey(d);
        const raw = byDay[key];
        const val = metric.key === "heartrate" ? raw?.value ?? null : raw ?? null;
        return { d, val, lbl: `${d.getDate()}/${d.getMonth()+1}` };
      });
      const present = days.filter(d => d.val !== null);
      if (!present.length) return null;
      const { lo, hi } = yPad(present.map(d => d.val));
      const xOf = (i) => CP.l + (i / 29) * pw;
      const xlbls = [0, 7, 14, 21, 29].map(i => ({ x: xOf(i), lbl: days[i].lbl }));
      const start = days[0], end = days[29];
      const range = `${start.lbl} – ${end.lbl}`;
      if (isBar) {
        const barW = pw / 30 * 0.7;
        const bars = days.map((d, i) => ({
          x: xOf(i) - barW/2,
          h: d.val != null ? ph * (d.val / (hi || 1)) : 0,
          val: d.val,
        }));
        return { kind:"bar", bars, xlbls, lo, hi, range, barW };
      }
      const pts  = days.map((d, i) => ({ x: xOf(i), y: d.val != null ? scaleY(d.val, lo, hi) : null }));
      const segs = []; let cur = [];
      pts.forEach(p => { if (p.y != null) cur.push({x:p.x, y:p.y}); else { if (cur.length) segs.push(cur); cur = []; }});
      if (cur.length) segs.push(cur);
      const dots = pts.filter(p => p.y != null).map(p => ({ x: p.x, y: p.y }));
      return { kind:"line", segs, dots, xlbls, lo, hi, range };
    }

    // ── Year: monthly averages ────────────────────────────────────────────
    const targetYear = new Date().getFullYear() + yearOffset;
    const mBkts = Array.from({ length: 12 }, (_, mo) => {
      const daysInMo = new Date(targetYear, mo + 1, 0).getDate();
      let total = 0, count = 0;
      for (let day = 1; day <= daysInMo; day++) {
        const d = new Date(targetYear, mo, day);
        const key = dateKey(d);
        const raw = byDay[key];
        const val = metric.key === "heartrate" ? raw?.value ?? null : raw ?? null;
        if (val != null) { total += val; count++; }
      }
      return { lbl: MO[mo], avg: count ? (metric.key === "steps" ? Math.round(total / count) : Math.round(total / count)) : null };
    });
    const present = mBkts.filter(b => b.avg != null);
    if (!present.length) return null;
    const { lo, hi } = yPad(present.map(b => b.avg));
    const xOf = (i) => CP.l + (i / 11) * pw;
    const xpts = mBkts.map((b, i) => ({ x: xOf(i), y: b.avg != null ? scaleY(b.avg, lo, hi) : null, lbl: b.lbl, val: b.avg }));
    if (isBar) {
      const barW = pw / 12 * 0.6;
      const bars = xpts.map(p => ({ x: p.x - barW/2, h: p.val != null ? ph*(p.val/(hi||1)) : 0, val: p.val }));
      return { kind:"bar", bars, xlbls: xpts.map(p => ({ x: p.x, lbl: p.lbl })), lo, hi, range: String(targetYear), barW };
    }
    const segs = []; let cur = [];
    xpts.forEach(p => { if (p.y != null) cur.push({x:p.x, y:p.y}); else { if (cur.length) segs.push(cur); cur = []; }});
    if (cur.length) segs.push(cur);
    return {
      kind:"line", segs, dots: xpts.filter(p => p.y != null).map(p => ({ x:p.x, y:p.y })),
      xlbls: xpts.map(p => ({ x: p.x, lbl: p.lbl })), lo, hi, range: String(targetYear),
    };
  }, [byDay, period, weekOffset, monthOffset, yearOffset, metric, isBar]);

  const yAxis = useMemo(() => {
    if (!chart) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      y:   CP.t + ph * (1 - i/4),
      lbl: chart.kind === "bar"
        ? Math.round(chart.lo + (i/4) * (chart.hi - chart.lo)).toLocaleString()
        : Math.round(chart.lo + (i/4) * (chart.hi - chart.lo)).toString(),
    }));
  }, [chart]);

  const offset = period === "Week" ? weekOffset : period === "Month" ? monthOffset : yearOffset;
  const setOff = period === "Week" ? setWeekOffset : period === "Month" ? setMonthOffset : setYearOffset;
  const botY   = CP.t + ph;

  const NavRow = ({ range }) => (
    <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:6, paddingHorizontal:2 }}>
      <TouchableOpacity onPress={() => setOff(o => o - 1)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
        <Ionicons name="chevron-back-circle" size={22} color={colors.primary} />
      </TouchableOpacity>
      <Text style={{ fontSize:11, color:colors.textSecondary, fontWeight:"600" }}>{range}</Text>
      <TouchableOpacity onPress={() => setOff(o => Math.min(0, o + 1))} disabled={offset >= 0} hitSlop={{top:10,bottom:10,left:10,right:10}}>
        <Ionicons name="chevron-forward-circle" size={22} color={offset >= 0 ? colors.border : colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (!chart) {
    let emptyRange = "";
    if (period === "Week") {
      const base = new Date(); base.setDate(base.getDate() + weekOffset * 7);
      const s = new Date(base); s.setDate(s.getDate() - 6);
      emptyRange = `${s.getDate()}/${s.getMonth()+1} – ${base.getDate()}/${base.getMonth()+1}`;
    } else if (period === "Month") {
      const base = new Date(); base.setDate(base.getDate() + monthOffset * 30);
      const s = new Date(base); s.setDate(s.getDate() - 29);
      emptyRange = `${s.getDate()}/${s.getMonth()+1} – ${base.getDate()}/${base.getMonth()+1}`;
    } else {
      emptyRange = String(new Date().getFullYear() + yearOffset);
    }
    return (
      <View>
        <NavRow range={emptyRange} />
        <View style={{ height:230, alignItems:"center", justifyContent:"center", gap:8 }}>
          <Ionicons name="analytics-outline" size={28} color={colors.textSecondary} />
          <Text style={{ fontSize:12, color:colors.textSecondary }}>No data for this period</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <NavRow range={chart.range} />
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={col} stopOpacity="0.2" />
            <Stop offset="1" stopColor={col} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines + Y labels */}
        {yAxis.map((yl, i) => (
          <G key={`y${i}`}>
            <SvgLine x1={CP.l} y1={yl.y} x2={CP.l+pw} y2={yl.y} stroke={colors.border} strokeWidth={0.6} strokeDasharray="4,4" />
            <SvgText x={CP.l-5} y={yl.y+4} textAnchor="end" fontSize={9} fill={colors.textSecondary}>{yl.lbl}</SvgText>
          </G>
        ))}

        {chart.kind === "bar" ? (
          /* ── Bar chart ────────────────────────────────────────────────── */
          chart.bars.map((b, i) => b.h > 0 && (
            <G key={`b${i}`}>
              <SvgRect
                x={b.x} y={botY - b.h}
                width={chart.barW} height={b.h}
                fill={col} opacity={0.85}
                rx={2}
              />
            </G>
          ))
        ) : (
          /* ── Line chart ───────────────────────────────────────────────── */
          <>
            {chart.segs.map((seg, si) => seg.length >= 2 && (
              <Path key={`f${si}`}
                d={`${monotonePath(seg, CP.t, botY)} L${seg[seg.length-1].x.toFixed(1)},${botY} L${seg[0].x.toFixed(1)},${botY} Z`}
                fill={`url(#${gradId})`} />
            ))}
            {chart.segs.map((seg, si) => seg.length >= 1 && (
              <Path key={`l${si}`} d={monotonePath(seg, CP.t, botY)} stroke={col} strokeWidth={2.5} fill="none" />
            ))}
            {chart.dots.map((pt, i) => (
              <SvgCircle key={`d${i}`} cx={pt.x} cy={pt.y}
                r={period === "Month" ? 1.5 : 3}
                fill="#fff" stroke={col} strokeWidth={1.5} />
            ))}
          </>
        )}

        {/* X labels */}
        {chart.xlbls.map((xl, i) => (
          <SvgText key={`x${i}`} x={xl.x} y={H-4} textAnchor="middle" fontSize={9} fill={colors.textSecondary}>{xl.lbl}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ActivityTrackingScreen({ navigation }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();

  const [metric,      setMetric]      = useState(METRICS[0].key);
  const [period,      setPeriod]      = useState("Week");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset,  setYearOffset]  = useState(0);

  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");
  // "idle" | "requesting" | "granted" | "denied"
  const [hkStatus,    setHkStatus]    = useState(() => HK_AVAILABLE ? getHKStatus() : "unavailable");

  // Raw data stores
  const [stepsData,   setStepsData]   = useState([]);
  const [calData,     setCalData]     = useState([]);
  const [hrData,      setHrData]      = useState([]);

  // Today's snapshots
  const [todaySteps,  setTodaySteps]  = useState(null);
  const [todayCals,   setTodayCals]   = useState(null);
  const [latestHR,    setLatestHR]    = useState(null);

  // Request HealthKit permissions explicitly
  const requestPermissions = useCallback(async () => {
    if (!HK_AVAILABLE) return;
    setHkStatus("requesting");
    const granted = await initHealthKit();
    setHkStatus(granted ? "granted" : "denied");
    if (granted) load();
  }, []);

  const load = useCallback(async () => {
    if (!HK_AVAILABLE) { setLoading(false); return; }
    // Auto-init on first load — triggers iOS permission dialog if not yet shown
    const status = getHKStatus();
    if (status === "idle") {
      setHkStatus("requesting");
      const granted = await initHealthKit();
      setHkStatus(granted ? "granted" : "denied");
      if (!granted) { setLoading(false); return; }
    } else if (status === "denied") {
      setLoading(false); return;
    }
    setLoading(true); setErr("");
    try {
      const [steps, cals, hr] = await Promise.all([
        getDailySteps(365),
        getDailyCalories(365),
        getHeartRateSamples(90),
      ]);
      setStepsData(steps);
      setCalData(cals);
      setHrData(hr);

      // Derive today's snapshot from fetched data
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayS   = steps.find(s => s.date === todayKey)?.value ?? 0;
      const todayC   = cals.find(c => c.date === todayKey)?.value ?? 0;
      const latestH  = hr.length ? hr[hr.length - 1] : null;
      setTodaySteps(todayS);
      setTodayCals(todayC);
      setLatestHR(latestH);
    } catch {
      setErr("Could not load health data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeMeta = METRICS.find(m => m.key === metric);

  // Pick dataset for active metric
  const activeSamples = useMemo(() => {
    if (metric === "steps")     return stepsData;
    if (metric === "calories")  return calData;
    return hrData;
  }, [metric, stepsData, calData, hrData]);

  // Stats for current active samples (all time)
  const stats = useMemo(() => {
    const vals = activeSamples.map(s => s.value).filter(v => v > 0);
    if (!vals.length) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    };
  }, [activeSamples]);

  const stepProgress = todaySteps != null ? Math.min(1, todaySteps / STEP_GOAL) : 0;

  const s = useMemo(() => makeStyles(colors), [colors]);

  // ── HealthKit unavailable (non-iOS or module missing) ────────────────────────
  if (!HK_AVAILABLE) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Activity Tracking</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.unavailWrap}>
          <Ionicons name="watch-outline" size={52} color={colors.textLight} />
          <Text style={s.unavailTitle}>HealthKit Not Available</Text>
          <Text style={s.unavailSub}>
            Activity tracking requires a custom development build on a physical iOS device.
            It reads data from your iPhone and paired Apple Watch automatically.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Permissions not yet granted ───────────────────────────────────────────────
  if (hkStatus === "idle" || hkStatus === "requesting" || hkStatus === "denied") {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Activity Tracking</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.unavailWrap}>
          {hkStatus === "requesting" ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={s.unavailTitle}>Requesting Access…</Text>
              <Text style={s.unavailSub}>
                Please allow access to Apple Health when the system prompt appears.
              </Text>
            </>
          ) : hkStatus === "denied" ? (
            <>
              <Ionicons name="lock-closed-outline" size={52} color={colors.textLight} />
              <Text style={s.unavailTitle}>Health Access Denied</Text>
              <Text style={s.unavailSub}>
                SmartFoodFitness needs access to your Health data to show steps, calories burned,
                and heart rate. Please enable it in Settings.
              </Text>
              <TouchableOpacity
                style={s.permBtn}
                onPress={() => Linking.openURL("app-settings:")}
              >
                <Ionicons name="settings-outline" size={16} color="#fff" />
                <Text style={s.permBtnText}>Open Settings</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="heart-outline" size={52} color={colors.primary} />
              <Text style={s.unavailTitle}>Connect Apple Health</Text>
              <Text style={s.unavailSub}>
                Allow SmartFoodFitness to read your steps, active calories, and heart rate from
                Apple Health. Your data stays on your device.
              </Text>
              <TouchableOpacity style={s.permBtn} onPress={requestPermissions}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={s.permBtnText}>Grant Access</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Activity Tracking</Text>
        <TouchableOpacity onPress={load} style={s.headerBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {err ? <Text style={s.errText}>{err}</Text> : null}
        {loading && (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        )}

        {/* ── Today's Activity ─────────────────────────────────────────── */}
        <View style={s.todayCard}>
          <Text style={s.todayTitle}>Today's Activity</Text>
          <View style={s.todayRow}>

            {/* Steps */}
            <View style={s.todayStat}>
              <View style={[s.todayIconWrap, { backgroundColor: "#22c55e22" }]}>
                <Ionicons name="footsteps-outline" size={20} color="#22c55e" />
              </View>
              <Text style={[s.todayVal, { color: "#22c55e" }]}>
                {todaySteps != null ? todaySteps.toLocaleString() : "—"}
              </Text>
              <Text style={s.todayLbl}>Steps</Text>
              {/* Progress toward goal */}
              <View style={s.stepBarWrap}>
                <View style={[s.stepBar, { width: `${Math.round(stepProgress * 100)}%` }]} />
              </View>
              <Text style={s.stepGoalText}>{Math.round(stepProgress * 100)}% of {STEP_GOAL.toLocaleString()}</Text>
            </View>

            <View style={s.todayDivider} />

            {/* Calories */}
            <View style={s.todayStat}>
              <View style={[s.todayIconWrap, { backgroundColor: "#f9731622" }]}>
                <Ionicons name="flame-outline" size={20} color="#f97316" />
              </View>
              <Text style={[s.todayVal, { color: "#f97316" }]}>
                {todayCals != null ? todayCals.toLocaleString() : "—"}
              </Text>
              <Text style={s.todayLbl}>Cal Burned</Text>
            </View>

            <View style={s.todayDivider} />

            {/* Heart Rate */}
            <View style={s.todayStat}>
              <View style={[s.todayIconWrap, { backgroundColor: "#ef444422" }]}>
                <Ionicons name="heart-outline" size={20} color="#ef4444" />
              </View>
              <Text style={[s.todayVal, { color: "#ef4444" }]}>
                {latestHR ? `${latestHR.value}` : "—"}
              </Text>
              <Text style={s.todayLbl}>BPM</Text>
              {latestHR && (
                <Text style={s.hrTime}>
                  {new Date(latestHR.date).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Metric selector ──────────────────────────────────────────── */}
        <View style={s.metricRow}>
          {METRICS.map((m) => {
            const active = metric === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[s.metricChip, active && { backgroundColor: m.color, borderColor: m.color }]}
                onPress={() => setMetric(m.key)}
              >
                <Ionicons name={m.icon} size={14} color={active ? "#fff" : colors.textSecondary} />
                <Text style={[s.metricChipText, active && { color: "#fff" }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Period selector ───────────────────────────────────────────── */}
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

        {/* ── Chart card ───────────────────────────────────────────────── */}
        <View style={s.chartCard}>
          <View style={s.chartTitleRow}>
            <View style={[s.chartDot, { backgroundColor: activeMeta.color }]} />
            <View>
              <Text style={s.chartTitle}>{activeMeta.label}</Text>
              <Text style={s.chartDesc}>{activeMeta.desc}</Text>
            </View>
          </View>

          {activeSamples.length > 0 ? (
            <>
              <ActivityChart
                samples={activeSamples}
                metric={activeMeta}
                period={period}
                colors={colors}
                weekOffset={weekOffset}   setWeekOffset={setWeekOffset}
                monthOffset={monthOffset} setMonthOffset={setMonthOffset}
                yearOffset={yearOffset}   setYearOffset={setYearOffset}
              />
              {stats && (
                <View style={s.statsRow}>
                  {[
                    ["Min",  metric === "steps" ? stats.min.toLocaleString() : String(stats.min)],
                    ["Avg",  metric === "steps" ? stats.avg.toLocaleString() : String(stats.avg)],
                    ["Max",  metric === "steps" ? stats.max.toLocaleString() : String(stats.max)],
                  ].map(([lbl, val]) => (
                    <View key={lbl} style={s.statBox}>
                      <Text style={s.statLbl}>{lbl}</Text>
                      <Text style={[s.statVal, { color: activeMeta.color }]}>
                        {val} <Text style={s.statUnit}>{activeMeta.unit}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : !loading && (
            <View style={s.emptyChart}>
              <Ionicons name={activeMeta.icon} size={32} color={colors.textSecondary} />
              <Text style={s.emptyText}>No {activeMeta.label} data yet</Text>
              <Text style={s.emptySub}>
                Make sure your Apple Watch is paired and Health permissions are granted.
              </Text>
            </View>
          )}
        </View>

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

    // Unavailable
    unavailWrap:  { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl * 2, gap: spacing.md },
    unavailTitle: { fontSize: font.xl, fontWeight: "800", color: colors.text, textAlign: "center" },
    unavailSub:   { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    permBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: radius.lg,
      paddingHorizontal: spacing.xl, paddingVertical: 14, marginTop: spacing.sm,
    },
    permBtnText: { color: "#fff", fontSize: font.base, fontWeight: "700" },

    // Today card
    todayCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      shadowColor: "#000", shadowOffset: { width:0, height:2 }, shadowOpacity:0.06, shadowRadius:10, elevation:2,
      gap: spacing.md,
    },
    todayTitle:   { fontSize: font.base, fontWeight: "700", color: colors.text },
    todayRow:     { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around" },
    todayStat:    { flex: 1, alignItems: "center", gap: 4 },
    todayDivider: { width: 1, height: 80, backgroundColor: colors.border, alignSelf: "center" },
    todayIconWrap:{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    todayVal:     { fontSize: 20, fontWeight: "800" },
    todayLbl:     { fontSize: 10, color: colors.textSecondary, fontWeight: "600" },
    hrTime:       { fontSize: 9, color: colors.textLight },

    stepBarWrap:  { width: "90%", height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden", marginTop: 2 },
    stepBar:      { height: "100%", backgroundColor: "#22c55e", borderRadius: 2 },
    stepGoalText: { fontSize: 9, color: colors.textLight, fontWeight: "600" },

    // Metric chips
    metricRow:  { flexDirection: "row", gap: spacing.sm },
    metricChip: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
      paddingVertical: 9, borderRadius: radius.lg,
      borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    metricChipText: { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },

    // Period
    periodRow: {
      flexDirection: "row", backgroundColor: colors.surface,
      borderRadius: radius.lg, padding: 3, gap: 3,
      shadowColor: "#000", shadowOffset: { width:0, height:1 }, shadowOpacity:0.04, shadowRadius:4, elevation:1,
    },
    periodChip:   { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: "center" },
    periodText:   { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },
    periodTextOn: { color: "#fff" },

    // Chart card
    chartCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      shadowColor: "#000", shadowOffset: { width:0, height:2 }, shadowOpacity:0.06, shadowRadius:10, elevation:2,
    },
    chartTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    chartDot:      { width: 10, height: 10, borderRadius: 5 },
    chartTitle:    { fontSize: font.base, fontWeight: "700", color: colors.text },
    chartDesc:     { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

    statsRow: {
      flexDirection: "row", justifyContent: "space-around",
      marginTop: spacing.md, paddingTop: spacing.md,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    statBox:  { alignItems: "center", gap: 3 },
    statLbl:  { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    statVal:  { fontSize: font.base, fontWeight: "800" },
    statUnit: { fontSize: 10, fontWeight: "600" },

    emptyChart: { alignItems: "center", paddingVertical: spacing.xl, gap: 8 },
    emptyText:  { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
    emptySub:   { color: colors.textSecondary, fontSize: font.sm, opacity: 0.7, textAlign: "center", lineHeight: 18 },
  });
}
