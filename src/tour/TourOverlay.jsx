import { Animated, Dimensions, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../ThemeContext";
import { useTour } from "./TourContext";

const PAD = 10;
const OVERLAY_CLR = "rgba(0,0,0,0.72)";
const TOOLTIP_W_MAX = 320;
const TOOLTIP_H_EST = 220;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function TourOverlay() {
  const tour = useTour();
  const { active, stepIdx, tourMode, currentSteps, nextStep, endTour,
          getTargetLayout, getContentY, remeasureTarget, getScrollRef } = tour;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState(null);

  // ── Animations ─────────────────────────────────────────────
  const overlayAnim    = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTransY  = useRef(new Animated.Value(20)).current;

  const steps = currentSteps || [];
  const step = steps[stepIdx];
  const { width: SW, height: SH } = Dimensions.get("window");

  // Fade entire overlay in/out when tour starts or ends
  useEffect(() => {
    Animated.timing(overlayAnim, {
      toValue: active ? 1 : 0,
      duration: active ? 380 : 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [active]);

  // Load layout each time the step index changes
  useEffect(() => {
    if (!active || !step) { setLayout(null); return; }

    // Reset tooltip immediately so old one disappears
    tooltipOpacity.setValue(0);
    tooltipTransY.setValue(20);

    let cancelled = false;

    async function load() {
      setLayout(null);

      // ── Phase 1: wait until TourTarget registers its layout ──
      let l = null;
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        l = getTargetLayout(step.target);
        if (l) break;
        await wait(100);
      }
      if (cancelled) return;

      // ── Phase 2: scroll element into view ──────────────────
      const contentY = getContentY(step.target);
      const scrollTab = step.tab || tourMode;
      const scrollRef = getScrollRef(scrollTab);
      if (contentY !== null && scrollRef?.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, contentY - 160), animated: true });
        await wait(350);
      }
      if (cancelled) return;

      // ── Phase 3: re-measure after scroll ───────────────────
      remeasureTarget(step.target);
      await wait(80);
      if (cancelled) return;

      const updated = getTargetLayout(step.target);
      setLayout(updated || l);

      // ── Phase 4: animate tooltip in ────────────────────────
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 1, duration: 240,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(tooltipTransY, {
          toValue: 0, tension: 110, friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }

    const t = setTimeout(load, 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, [active, stepIdx]);

  if (!active) return null;

  // ── Spotlight rect ─────────────────────────────────────────
  const hl = layout
    ? {
        x: Math.max(0, layout.x - PAD),
        y: Math.max(0, layout.y - PAD),
        w: Math.min(SW, layout.width + PAD * 2),
        h: layout.height + PAD * 2,
      }
    : null;

  // ── Tooltip position (always stays within safe area) ──────
  const tooltipW = Math.min(SW - 32, TOOLTIP_W_MAX);
  const tooltipX = (SW - tooltipW) / 2;
  const safeTop    = insets.top + 8;
  const safeBottom = SH - insets.bottom - 8;

  let tooltipTop;
  if (hl) {
    const belowY = hl.y + hl.h + 14;
    const aboveY = hl.y - TOOLTIP_H_EST - 14;

    if (belowY + TOOLTIP_H_EST <= safeBottom) {
      // Plenty of room below
      tooltipTop = belowY;
    } else if (aboveY >= safeTop) {
      // Fits above
      tooltipTop = aboveY;
    } else {
      // Element is very tall — place on whichever side has more space
      const spaceBelow = safeBottom - (hl.y + hl.h);
      const spaceAbove = hl.y - safeTop;
      tooltipTop = spaceBelow >= spaceAbove
        ? Math.min(belowY, safeBottom - TOOLTIP_H_EST)
        : Math.max(safeTop, aboveY);
    }
  } else {
    tooltipTop = SH / 2 - TOOLTIP_H_EST / 2;
  }

  // Hard clamp — tooltip can never escape the safe area
  tooltipTop = Math.max(safeTop, Math.min(tooltipTop, safeBottom - TOOLTIP_H_EST));

  const isLast = stepIdx === steps.length - 1;
  const progress = steps.length > 0 ? (stepIdx + 1) / steps.length : 1;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayAnim }]} pointerEvents="box-none">

        {/* ── Spotlight cutout ── */}
        {hl ? (
          <>
            <View style={[s.overlay, { top: 0,           left: 0,          right: 0,         height: hl.y  }]} />
            <View style={[s.overlay, { top: hl.y,        left: 0,          width: hl.x,      height: hl.h  }]} />
            <View style={[s.overlay, { top: hl.y,        left: hl.x + hl.w, right: 0,        height: hl.h  }]} />
            <View style={[s.overlay, { top: hl.y + hl.h, left: 0,          right: 0,         bottom: 0     }]} />
            <View pointerEvents="none"
              style={[s.hlBorder, { top: hl.y, left: hl.x, width: hl.w, height: hl.h }]}
            />
          </>
        ) : (
          <View style={[s.overlay, StyleSheet.absoluteFill]} />
        )}

        {/* ── Tooltip card ── */}
        <Animated.View
          style={[
            s.tooltip,
            { top: tooltipTop, left: tooltipX, width: tooltipW, backgroundColor: colors.surface },
            { opacity: tooltipOpacity, transform: [{ translateY: tooltipTransY }] },
          ]}
        >
          {/* Progress bar */}
          <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[s.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]}
            />
          </View>

          <View style={s.topRow}>
            <Text style={[s.stepCounter, { color: colors.textSecondary }]}>
              {stepIdx + 1} of {steps.length}
            </Text>
            <TouchableOpacity onPress={endTour} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[s.skipBtn, { color: colors.textSecondary }]}>
                {tourMode === "main" ? "Skip tour" : "Skip"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.title, { color: colors.text }]}>{step.title}</Text>
          <Text style={[s.desc,  { color: colors.textSecondary }]}>{step.description}</Text>

          <TouchableOpacity
            style={[s.nextBtn, { backgroundColor: colors.primary }]}
            onPress={isLast ? endTour : nextStep}
            activeOpacity={0.82}
          >
            <Text style={s.nextBtnText}>{isLast ? "Done" : "Next  →"}</Text>
          </TouchableOpacity>
        </Animated.View>

      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { position: "absolute", backgroundColor: OVERLAY_CLR },
  hlBorder: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },
  tooltip: {
    position: "absolute",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 14,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
    overflow: "hidden",
  },
  progressFill: { height: 3, borderRadius: 2 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  stepCounter: { fontSize: 12, fontWeight: "600" },
  skipBtn: { fontSize: 13 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 7 },
  desc:  { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  nextBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
});
