import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { useTour } from "./TourContext";

export default function TourTarget({ tourKey, children, style }) {
  const ctx = useTour();
  const ref = useRef(null);

  const remeasure = useCallback(() => {
    if (!ref.current || !ctx) return;
    ref.current.measure((fx, fy, width, height, pageX, pageY) => {
      if (width > 0 && height > 0) {
        ctx.registerTarget(tourKey, { x: pageX, y: pageY, width, height });
      }
    });
  }, [tourKey, ctx]);

  function onLayout(event) {
    if (!ctx) return;
    // Store scroll-content y for scrolling (position within scroll content view)
    ctx.registerContentY(tourKey, event.nativeEvent.layout.y);
    // Measure screen coordinates with a small delay to ensure layout is finalised
    setTimeout(remeasure, 80);
  }

  useEffect(() => {
    if (ctx) ctx.registerRemeasure(tourKey, remeasure);
  }, [tourKey, remeasure, ctx]);

  return (
    <View ref={ref} onLayout={onLayout} collapsable={false} style={style}>
      {children}
    </View>
  );
}
