import { useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/apiClient";

const OVERLAY = "rgba(0,0,0,0.62)";

// ── Frame geometry ────────────────────────────────────────────────────────────
// Photo mode: wide portrait window
const PHOTO_FRAME = { top: "28%", bottom: "38%", side: "5%" };
// Barcode mode: landscape strip in the center
const BAR_FRAME   = { top: "38%", bottom: "43%", side: "8%" };

const CORNER_SIZE  = 22;
const CORNER_THICK = 3;
const CORNER_COLOR = "#fff";

// ── Open Food Facts helpers ───────────────────────────────────────────────────
function off(n, key) {
  const v = n[key];
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
}

/**
 * Map an Open Food Facts product to the same shape used by LogFoodScreen rows:
 *   { name, defaultGrams, per100: { kcal, p, c, f, fiber, sugar, saturatedFat,
 *     sodium(mg), potassium(mg), cholesterol(mg), calcium(mg), iron(mg),
 *     zinc(mg), vitaminA(mcg), vitaminC(mg), vitaminD(mcg) } }
 *
 * Unit notes (OFF stores all per 100 g):
 *   macros      → g
 *   sodium      → g  (×1000 → mg)
 *   potassium, calcium, iron, zinc, cholesterol → mg (already correct)
 *   vitamin A   → µg (= mcg, already correct)
 *   vitamin C   → mg (already correct)
 *   vitamin D   → µg (= mcg, already correct)
 */
function parseOFF(product) {
  const n = product.nutriments || {};

  const name = [product.product_name, product.brands]
    .map((s) => (s || "").trim()).filter(Boolean).join(" — ") || "Unknown Product";

  // If a serving size is present (e.g. "30g", "1 cup (240ml)"), parse the first number
  const servingMatch = (product.serving_size || "").match(/^(\d+(\.\d+)?)/);
  const defaultGrams = servingMatch ? Math.round(Number(servingMatch[1])) : 100;

  const sodiumG = off(n, "sodium_100g");

  return {
    name,
    defaultGrams,
    per100: {
      kcal:         off(n, "energy-kcal_100g"),
      p:            off(n, "proteins_100g"),
      c:            off(n, "carbohydrates_100g"),
      f:            off(n, "fat_100g"),
      fiber:        off(n, "fiber_100g"),
      sugar:        off(n, "sugars_100g"),
      saturatedFat: off(n, "saturated-fat_100g"),
      sodium:       sodiumG != null ? sodiumG * 1000 : null, // g → mg
      potassium:    off(n, "potassium_100g"),
      cholesterol:  off(n, "cholesterol_100g"),
      calcium:      off(n, "calcium_100g"),
      iron:         off(n, "iron_100g"),
      zinc:         off(n, "zinc_100g"),
      vitaminA:     off(n, "vitamin-a_100g"),
      vitaminC:     off(n, "vitamin-c_100g"),
      vitaminD:     off(n, "vitamin-d_100g"),
    },
  };
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FoodCameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // "photo" | "barcode"
  const [mode, setMode] = useState("photo");

  // Photo mode state
  const [flash, setFlash]       = useState("off");
  const [photo, setPhoto]       = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError]       = useState("");

  // Barcode mode state
  const barcodeLockedRef            = useRef(false); // prevents double-fire
  const [barcodeStatus, setBarcodeStatus] = useState("idle"); // idle|looking|found|error
  const [barcodeErr, setBarcodeErr] = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function switchMode(next) {
    setMode(next);
    setError("");
    setBarcodeErr("");
    setBarcodeStatus("idle");
    barcodeLockedRef.current = false;
    setPhoto(null);
  }

  // ── Photo handlers ───────────────────────────────────────────────────────────
  async function handleCapture() {
    if (!cameraRef.current) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      setPhoto(pic);
      setError("");
    } catch {
      setError("Could not take photo. Try again.");
    }
  }

  async function handleAnalyse() {
    if (!photo?.base64) return;
    setAnalysing(true);
    setError("");
    try {
      const mediaType = photo.mimeType || "image/jpeg";
      const res = await apiClient.post("/api/ai/analyze-food", {
        imageBase64: photo.base64,
        mediaType,
      });
      const items = Array.isArray(res.data) ? res.data : [];
      if (items.length === 0) {
        setError("No food detected. Try a clearer photo from above.");
        setAnalysing(false);
        return;
      }
      navigation.navigate("LogFood", { scanResults: items });
    } catch {
      setError("Analysis failed. Check your connection and try again.");
    } finally {
      setAnalysing(false);
    }
  }

  // ── Barcode handler ──────────────────────────────────────────────────────────
  async function handleBarcodeScanned({ data: barcode }) {
    if (barcodeLockedRef.current) return;
    barcodeLockedRef.current = true;
    setBarcodeStatus("looking");
    setBarcodeErr("");

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        { headers: { "User-Agent": "SmartFoodFitness/1.0" } },
      );
      const data = await res.json();

      if (data.status !== 1 || !data.product) {
        setBarcodeStatus("error");
        setBarcodeErr("Product not found in database. Try searching manually.");
        barcodeLockedRef.current = false;
        return;
      }

      const row = parseOFF(data.product);
      setBarcodeStatus("found");
      // Small delay so the user sees the "Found!" state before navigation
      setTimeout(() => navigation.navigate("LogFood", { barcodeResult: row }), 400);
    } catch {
      setBarcodeStatus("error");
      setBarcodeErr("Could not look up barcode. Check your connection.");
      barcodeLockedRef.current = false;
    }
  }

  // ── Permission screen ────────────────────────────────────────────────────────
  if (!permission) {
    return <View style={s.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.permScreen}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={s.permContent}>
          <Ionicons name="camera-outline" size={64} color="#fff" style={{ marginBottom: 16 }} />
          <Text style={s.permTitle}>Camera Access Needed</Text>
          <Text style={s.permDesc}>
            Allow camera access to scan food with AI or scan product barcodes.
          </Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.permCancel} onPress={() => navigation.goBack()}>
            <Text style={s.permCancelText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Photo preview (after capture, before AI analysis) ────────────────────────
  if (photo) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

        <SafeAreaView style={s.previewTop} edges={["top"]}>
          <TouchableOpacity style={s.retakeBtn} onPress={() => { setPhoto(null); setError(""); }}>
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={s.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {error ? (
          <View style={s.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#fff" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <SafeAreaView style={s.previewBottom} edges={["bottom"]}>
          <TouchableOpacity
            style={[s.analyseBtn, analysing && s.analyseBtnDisabled]}
            onPress={handleAnalyse}
            disabled={analysing}
          >
            {analysing ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.analyseBtnText}>Analysing your meal…</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={20} color="#fff" />
                <Text style={s.analyseBtnText}>Analyse with AI</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Camera live view ─────────────────────────────────────────────────────────
  const F = mode === "barcode" ? BAR_FRAME : PHOTO_FRAME;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Camera — barcode scanning only active in barcode mode */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        onBarcodeScanned={mode === "barcode" ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
        }}
      />

      {/* Overlay strips — create a transparent "window" */}
      <View style={[s.strip, { top: 0, left: 0, right: 0, height: F.top }]} />
      <View style={[s.strip, { bottom: 0, left: 0, right: 0, height: F.bottom }]} />
      <View style={[s.strip, { top: F.top, bottom: F.bottom, left: 0, width: F.side }]} />
      <View style={[s.strip, { top: F.top, bottom: F.bottom, right: 0, width: F.side }]} />

      {/* Corner markers */}
      <View style={[s.corner, { top: F.top, left: F.side, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderTopLeftRadius: 4 }]} />
      <View style={[s.corner, { top: F.top, right: F.side, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderTopRightRadius: 4 }]} />
      <View style={[s.corner, { bottom: F.bottom, left: F.side, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderBottomLeftRadius: 4 }]} />
      <View style={[s.corner, { bottom: F.bottom, right: F.side, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: 4 }]} />

      {/* In-frame instruction label — sits just below the frame window */}
      <View style={[s.frameLabel, mode === "barcode" ? s.frameLabelBarcode : s.frameLabelPhoto]}>
        <Text style={s.frameLabelText}>
          {mode === "barcode"
            ? "Align barcode within the frame"
            : "Place your meal inside the frame"}
        </Text>
      </View>

      {/* Barcode status overlay (inside frame) */}
      {mode === "barcode" && barcodeStatus !== "idle" && (
        <View style={s.barcodeStatusOverlay}>
          {barcodeStatus === "looking" && (
            <View style={s.barcodeStatusBubble}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.barcodeStatusText}>Looking up product…</Text>
            </View>
          )}
          {barcodeStatus === "found" && (
            <View style={[s.barcodeStatusBubble, { backgroundColor: "rgba(34,197,94,0.92)" }]}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={s.barcodeStatusText}>Product found!</Text>
            </View>
          )}
          {barcodeStatus === "error" && (
            <View style={[s.barcodeStatusBubble, { backgroundColor: "rgba(239,68,68,0.92)" }]}>
              <Ionicons name="warning-outline" size={18} color="#fff" />
              <Text style={s.barcodeStatusText}>{barcodeErr}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <SafeAreaView style={s.topBar} edges={["top"]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>
          {mode === "barcode" ? "Scan Barcode" : "Scan Food"}
        </Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
        >
          <Ionicons
            name={flash === "on" ? "flash" : "flash-off-outline"}
            size={24}
            color={flash === "on" ? "#fbbf24" : "#fff"}
          />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Mode toggle pill (below top bar) ────────────────────────────────── */}
      <View style={s.modePill}>
        <TouchableOpacity
          style={[s.modeBtn, mode === "photo" && s.modeBtnOn]}
          onPress={() => switchMode("photo")}
        >
          <Ionicons name="camera-outline" size={15} color={mode === "photo" ? "#fff" : "rgba(255,255,255,0.65)"} />
          <Text style={[s.modeBtnText, mode === "photo" && s.modeBtnTextOn]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeBtn, mode === "barcode" && s.modeBtnOn]}
          onPress={() => switchMode("barcode")}
        >
          <Ionicons name="barcode-outline" size={15} color={mode === "barcode" ? "#fff" : "rgba(255,255,255,0.65)"} />
          <Text style={[s.modeBtnText, mode === "barcode" && s.modeBtnTextOn]}>Barcode</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <SafeAreaView style={s.bottomBar} edges={["bottom"]}>
        {mode === "photo" ? (
          <>
            <Text style={s.tipText}>Good lighting and a top-down angle gives the best results</Text>
            <TouchableOpacity style={s.captureBtn} onPress={handleCapture} activeOpacity={0.75}>
              <View style={s.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity style={s.switchModeLink} onPress={() => switchMode("barcode")}>
              <Ionicons name="barcode-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={s.switchModeLinkText}>Scan a barcode instead</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.tipText}>
              Hold steady — the barcode will be detected automatically
            </Text>
            {barcodeStatus === "error" && (
              <TouchableOpacity
                style={s.retryBarcodeBtn}
                onPress={() => { setBarcodeStatus("idle"); barcodeLockedRef.current = false; setBarcodeErr(""); }}
              >
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={s.retryBarcodeBtnText}>Try Again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.switchModeLink} onPress={() => switchMode("photo")}>
              <Ionicons name="camera-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={s.switchModeLinkText}>Take a photo instead</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },

  // Permission
  permScreen:  { flex: 1, backgroundColor: "#111" },
  backBtn:     { padding: 16 },
  permContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  permTitle:   { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  permDesc:    { color: "rgba(255,255,255,0.65)", fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  permBtn:     { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 12 },
  permBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  permCancel:  { paddingVertical: 10 },
  permCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 15 },

  // Overlay strips
  strip: { position: "absolute", backgroundColor: OVERLAY, zIndex: 2 },

  // Corner markers (shared; position supplied inline)
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
    zIndex: 3,
  },

  // Frame instruction label
  frameLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: "center",
  },
  frameLabelPhoto:   { bottom: "40%" },  // just below photo frame window
  frameLabelBarcode: { bottom: "45%" },  // just below barcode frame window
  frameLabelText: {
    color: "#fff",
    fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: "hidden",
  },

  // Barcode status bubble (centred in frame area)
  barcodeStatusOverlay: {
    position: "absolute",
    top: "46%",
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: "center",
  },
  barcodeStatusBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  barcodeStatusText: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1 },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  iconBtn:  { width: 42, height: 42, alignItems: "center", justifyContent: "center" },

  // Mode pill toggle (just below top bar, ~80pt from top works across device sizes)
  modePill: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 24,
    padding: 4,
    zIndex: 10,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  modeBtnOn:     { backgroundColor: "rgba(255,255,255,0.22)" },
  modeBtnText:   { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600" },
  modeBtnTextOn: { color: "#fff" },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
    alignItems: "center",
    paddingBottom: 32,
    gap: 14,
  },
  tipText: { color: "rgba(255,255,255,0.65)", fontSize: 12, textAlign: "center", paddingHorizontal: 32 },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 3, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  switchModeLink: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  switchModeLinkText: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  retryBarcodeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20, paddingVertical: 9, paddingHorizontal: 20,
  },
  retryBarcodeBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Photo preview
  previewTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  retakeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    alignSelf: "flex-start",
  },
  retakeBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  errorBanner: {
    position: "absolute",
    bottom: 140, left: 20, right: 20,
    zIndex: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.92)",
    padding: 12, borderRadius: 12,
  },
  errorText: { color: "#fff", fontSize: 14, flex: 1 },
  previewBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
    padding: 20, paddingBottom: 36,
  },
  analyseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#22c55e", borderRadius: 16, paddingVertical: 16,
  },
  analyseBtnDisabled: { opacity: 0.7 },
  analyseBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
